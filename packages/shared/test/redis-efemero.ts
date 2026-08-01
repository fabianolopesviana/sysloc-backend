/**
 * Instância efêmera de fila para a verificação — T4 da fatia `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * De onde vem o binário, e por quê
 * ---------------------------------------------------------------------------
 *
 * A instância sobe a partir do binário JÁ PROVISIONADO no sistema por
 * `deploy/scripts/instalacao/provisionar-base.sh` (T2), com diretório de dados e porta
 * próprios. A alternativa — uma dependência de teste que empacotasse o próprio binário, como a
 * do banco — foi descartada no scope §3.6: o binário já existe por força do provisionamento, e
 * a dependência extra traria mais superfície do que resolve.
 *
 * A consequência é que a falha realista deste helper é "o binário mudou de lugar / não foi
 * provisionado". Por isso a busca falha NOMEANDO o que procurou, em vez de travar: um
 * travamento silencioso aqui custaria uma sessão de depuração inteira (CT-006).
 *
 * ---------------------------------------------------------------------------
 * ADR-0006 — esta instância nunca é a provisionada
 * ---------------------------------------------------------------------------
 *
 * Compartilhar o BINÁRIO não é compartilhar a INSTÂNCIA. A porta vem da faixa efêmera (que
 * exclui a 6380 do provisionamento e a 6379 do ambiente legado) e o diretório de dados nasce em
 * `os.tmpdir()`. Nada aqui lê `REDIS_URL` nem qualquer outra coordenada de conexão do ambiente
 * — o CT-002 e o CT-003 são as provas.
 *
 * ---------------------------------------------------------------------------
 * Queda e retorno preservando os dados
 * ---------------------------------------------------------------------------
 *
 * `parar({ preservarDados: true })` seguido de `religar()` derruba e traz de volta a instância
 * SOBRE O MESMO DIRETÓRIO DE DADOS. É o que torna escrevível o caso de T6 que prova a CA-10
 * (trabalho enfileirado sobrevive à queda do servidor de fila): sem esse par, a persistência em
 * disco ligada no provisionamento não teria como ser verificada.
 *
 * A instância roda com `appendfsync always` de propósito: com a política padrão (`everysec`),
 * uma escrita confirmada podia não estar no disco no instante da queda, e o caso de T6 falharia
 * de vez em quando por um motivo que não é o defeito que ele persegue.
 */

import { spawn } from 'node:child_process';
import { accessSync, constants, realpathSync, rmSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { processoVivo, registrarDescarte, reservarPorta, sondarAte } from './efemero-comum.ts';

/** Nome do binário provisionado que atende a fila. */
export const BINARIO_FILA = 'redis-server';

/** Prefixo do diretório de dados, sob a raiz temporária do sistema. */
const PREFIXO_DIRETORIO_FILA = 'sysloc-fila-';

/** Limite para a instância responder ao protocolo depois de nascer. */
const LIMITE_SUBIDA_MS = 15_000;

/** Limite para o processo desaparecer depois do pedido de parada. */
const LIMITE_MORTE_DO_PROCESSO_MS = 15_000;

/** Limite de uma requisição de comando à instância. */
const LIMITE_COMANDO_MS = 5_000;

/** Últimas linhas de diagnóstico preservadas por instância, para compor mensagem de erro. */
const LINHAS_DE_DIAGNOSTICO = 10;

/** O que o protocolo da fila devolve. Basta ao que a verificação precisa asserir. */
export type RespostaFila = string | number | null | (string | null)[];

export interface FilaEfemera {
  /** Cadeia de conexão completa da instância — o único endereço que a suíte deve usar. */
  readonly cadeiaConexao: string;
  /** Porta TCP em que a instância escuta, sorteada dentro da faixa efêmera. */
  readonly porta: number;
  /** Identificador do processo que atende. Muda a cada `religar()`. */
  readonly pid: number;
  /** Diretório de dados, sob `os.tmpdir()`, criado e apagado por esta instância. */
  readonly diretorioDados: string;
  /**
   * Encerra a instância. Por padrão apaga também o diretório de dados; com
   * `{ preservarDados: true }` o diretório fica de pé para um `religar()` posterior.
   * Idempotente nas duas formas.
   */
  parar(opcoes?: { readonly preservarDados?: boolean }): Promise<void>;
  /** Sobe de novo, no mesmo diretório de dados e na mesma porta. */
  religar(): Promise<void>;
}

/**
 * Localiza o binário provisionado percorrendo o `PATH` vigente.
 *
 * Falha nomeando o binário procurado e os diretórios em que procurou — a mensagem é o produto
 * principal deste caminho, porque quem a lê está diante de uma máquina sem provisionamento.
 */
function resolverBinarioDaFila(): string {
  const diretorios = (process.env.PATH ?? '').split(delimiter).filter((parte) => parte.length > 0);

  for (const diretorio of diretorios) {
    const candidato = join(diretorio, BINARIO_FILA);
    try {
      accessSync(candidato, constants.X_OK);
      return candidato;
    } catch {
      // Diretório do PATH que não tem o binário executável — segue procurando.
    }
  }

  throw new Error(
    `binário '${BINARIO_FILA}' não encontrado em nenhum diretório do PATH ` +
      `(${diretorios.join(delimiter) || '<PATH vazio>'}). Ele é instalado por ` +
      'deploy/scripts/instalacao/provisionar-base.sh — provisione a máquina antes de verificar.',
  );
}

/** Sobe uma instância efêmera de fila, com diretório de dados temporário e porta dinâmica. */
export async function redisEfemero(): Promise<FilaEfemera> {
  // A resolução do binário vem ANTES de qualquer efeito colateral: uma máquina sem
  // provisionamento falha sem deixar diretório para trás (CT-006, cenário negativo).
  const binario = resolverBinarioDaFila();

  // `realpath` porque o CT-006 compara este valor com o `dir` que a própria instância reporta.
  const diretorioDados = realpathSync(await mkdtemp(join(tmpdir(), PREFIXO_DIRETORIO_FILA)));
  const porta = await reservarPorta();

  let pidAtual = 0;
  let estado: 'ativa' | 'pausada' | 'descartada' = 'ativa';

  // Uma função de descarte, dois chamadores: o gancho de encerramento e o caminho de falha de
  // subida. Duplicá-la faria uma mudança futura aplicada só ao gancho deixar o caminho de falha
  // com o comportamento antigo — resíduo ou processo órfão numa trilha que nenhum caso cobre.
  const descartar = (): void => {
    if (pidAtual > 0 && processoVivo(pidAtual)) {
      try {
        process.kill(pidAtual, 'SIGKILL');
      } catch {
        // Já morreu entre a checagem e o sinal — nada a fazer.
      }
    }
    rmSync(diretorioDados, { recursive: true, force: true });
  };
  const soltarDescarte = registrarDescarte(descartar);

  const subir = async (): Promise<void> => {
    const diagnostico: string[] = [];

    const processo = spawn(
      binario,
      [
        '--port',
        String(porta),
        // Sem escuta fora do endereço de retorno: a instância da verificação não se expõe.
        '--bind',
        '127.0.0.1',
        '--protected-mode',
        'yes',
        '--dir',
        diretorioDados,
        // Persistência em disco ligada, como na instância provisionada — é o que torna
        // verificável a sobrevivência do trabalho enfileirado a uma queda.
        '--appendonly',
        'yes',
        '--appendfsync',
        'always',
        // Sem instantâneo periódico: ele não acrescenta nada ao que o registro contínuo já
        // garante e só produziria arquivo a mais no diretório temporário.
        '--save',
        '',
        '--daemonize',
        'no',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    processo.stderr?.setEncoding('utf8');
    processo.stderr?.on('data', (pedaco: string) => {
      diagnostico.push(pedaco.trimEnd());
      if (diagnostico.length > LINHAS_DE_DIAGNOSTICO) {
        diagnostico.shift();
      }
    });

    let erroDeExecucao: Error | undefined;
    processo.on('error', (erro: Error) => {
      erroDeExecucao = erro;
    });

    let morreuCedo = false;
    processo.on('exit', () => {
      morreuCedo = estado === 'ativa';
    });

    // O processo filho não segura o laço de eventos: uma instância esquecida de pé travaria a
    // saída da suíte em vez de aparecer como caso vermelho. O gancho de encerramento continua
    // valendo — ele é quem garante que nada sobreviva ao processo da suíte.
    processo.unref();

    pidAtual = processo.pid ?? 0;

    try {
      await sondarAte(
        `a instância efêmera de fila responder na porta ${porta}`,
        async () => {
          if (erroDeExecucao !== undefined || morreuCedo) {
            return true;
          }
          try {
            return (await comandoFila(porta, 'PING')) === 'PONG';
          } catch {
            return false;
          }
        },
        LIMITE_SUBIDA_MS,
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new Error(
        `instância efêmera de fila não subiu na porta ${porta} (${diretorioDados}): ${motivo}` +
          (diagnostico.length > 0 ? `\n${diagnostico.join('\n')}` : ''),
      );
    }

    if (erroDeExecucao !== undefined || morreuCedo) {
      throw new Error(
        `instância efêmera de fila morreu ao subir na porta ${porta} (${diretorioDados}): ` +
          `${erroDeExecucao?.message ?? 'processo encerrou sozinho'}` +
          (diagnostico.length > 0 ? `\n${diagnostico.join('\n')}` : ''),
      );
    }
  };

  const encerrarProcesso = async (): Promise<void> => {
    if (pidAtual > 0 && processoVivo(pidAtual)) {
      // `SIGTERM` porque o servidor de fila fecha o registro contínuo antes de sair; com o
      // sinal incondicional, a preservação dos dados dependeria do momento da última gravação.
      process.kill(pidAtual, 'SIGTERM');
    }

    await sondarAte(
      `o processo ${pidAtual} da fila efêmera desaparecer`,
      () => pidAtual === 0 || !processoVivo(pidAtual),
      LIMITE_MORTE_DO_PROCESSO_MS,
    );
  };

  try {
    await subir();
  } catch (erro) {
    soltarDescarte();
    descartar();
    throw erro;
  }

  const fila: FilaEfemera = {
    cadeiaConexao: `redis://127.0.0.1:${porta}`,
    porta,
    get pid(): number {
      return pidAtual;
    },
    diretorioDados,
    async parar(opcoes?: { readonly preservarDados?: boolean }): Promise<void> {
      const preservar = opcoes?.preservarDados === true;

      if (estado === 'descartada') {
        return;
      }
      if (estado === 'ativa') {
        estado = 'pausada';
        await encerrarProcesso();
      }
      if (preservar) {
        return;
      }

      estado = 'descartada';
      await rm(diretorioDados, { recursive: true, force: true });
      soltarDescarte();
    },
    async religar(): Promise<void> {
      if (estado === 'ativa') {
        throw new Error(
          `a fila efêmera da porta ${porta} ainda está de pé — religar() só faz sentido depois ` +
            'de parar({ preservarDados: true })',
        );
      }
      if (estado === 'descartada') {
        throw new Error(
          `a fila efêmera da porta ${porta} foi descartada com o diretório de dados; religar() ` +
            'exige a parada que preserva os dados: parar({ preservarDados: true })',
        );
      }

      estado = 'ativa';
      await subir();
    },
  };

  return fila;
}

/**
 * Envia um comando à instância e devolve a resposta já traduzida.
 *
 * Cliente mínimo, escrito à mão de propósito: acrescentar uma biblioteca de cliente ao pacote
 * compartilhado só para as sondas desta verificação traria uma dependência inteira para
 * executar cinco comandos. O que a suíte precisa é exatamente o que está aqui.
 */
export function comandoFila(porta: number, ...argumentos: string[]): Promise<RespostaFila> {
  return new Promise((resolver, rejeitar) => {
    const soquete = createConnection({ host: '127.0.0.1', port: porta });
    let acumulado = Buffer.alloc(0);
    let concluido = false;

    const encerrar = (acao: () => void): void => {
      if (concluido) {
        return;
      }
      concluido = true;
      soquete.destroy();
      acao();
    };

    soquete.setTimeout(LIMITE_COMANDO_MS, () => {
      encerrar(() =>
        rejeitar(
          new Error(
            `a instância da porta ${porta} não respondeu a '${argumentos.join(' ')}' em ` +
              `${LIMITE_COMANDO_MS} ms`,
          ),
        ),
      );
    });

    soquete.on('error', (erro: Error) => {
      encerrar(() => rejeitar(erro));
    });

    soquete.on('connect', () => {
      let requisicao = `*${argumentos.length}\r\n`;
      for (const argumento of argumentos) {
        requisicao += `$${Buffer.byteLength(argumento)}\r\n${argumento}\r\n`;
      }
      soquete.write(requisicao);
    });

    soquete.on('data', (pedaco: Buffer) => {
      acumulado = Buffer.concat([acumulado, pedaco]);
      let analisada: ValorAnalisado | undefined;
      try {
        analisada = analisarResposta(acumulado, 0);
      } catch (erro) {
        encerrar(() => rejeitar(erro));
        return;
      }
      if (analisada !== undefined) {
        encerrar(() => resolver(analisada.valor));
      }
    });

    soquete.on('close', () => {
      encerrar(() =>
        rejeitar(
          new Error(
            `a conexão com a porta ${porta} fechou antes da resposta a ` +
              `'${argumentos.join(' ')}'`,
          ),
        ),
      );
    });
  });
}

interface ValorAnalisado {
  valor: RespostaFila;
  fim: number;
}

/** Traduz uma resposta do protocolo. Devolve `undefined` enquanto ela estiver incompleta. */
function analisarResposta(dados: Buffer, inicio: number): ValorAnalisado | undefined {
  const fimDaLinha = dados.indexOf('\r\n', inicio);
  if (fimDaLinha === -1) {
    return undefined;
  }

  const marca = String.fromCharCode(dados[inicio] ?? 0);
  const corpo = dados.toString('utf8', inicio + 1, fimDaLinha);
  const apos = fimDaLinha + 2;

  switch (marca) {
    case '+':
      return { valor: corpo, fim: apos };
    case '-':
      throw new Error(`a instância recusou o comando: ${corpo}`);
    case ':':
      return { valor: Number.parseInt(corpo, 10), fim: apos };
    case '$': {
      const tamanho = Number.parseInt(corpo, 10);
      if (tamanho === -1) {
        return { valor: null, fim: apos };
      }
      if (dados.length < apos + tamanho + 2) {
        return undefined;
      }
      return { valor: dados.toString('utf8', apos, apos + tamanho), fim: apos + tamanho + 2 };
    }
    case '*': {
      const quantidade = Number.parseInt(corpo, 10);
      if (quantidade === -1) {
        return { valor: null, fim: apos };
      }
      const itens: (string | null)[] = [];
      let cursor = apos;
      for (let indice = 0; indice < quantidade; indice += 1) {
        const item = analisarResposta(dados, cursor);
        if (item === undefined) {
          return undefined;
        }
        // Elemento que não seja texto nem nulo NÃO vira `null` em silêncio: a sonda que o
        // consumisse compararia contra um valor que a instância nunca devolveu, e a divergência
        // apareceria como asserção falhando em outro lugar. Mesma disciplina do `default` abaixo.
        if (typeof item.valor !== 'string' && item.valor !== null) {
          throw new Error(
            `o elemento ${indice} do arranjo veio como ${typeof item.valor}, e este cliente ` +
              'mínimo só traduz elementos de texto ou nulos dentro de um arranjo',
          );
        }
        itens.push(item.valor);
        cursor = item.fim;
      }
      return { valor: itens, fim: cursor };
    }
    default:
      throw new Error(`resposta em formato desconhecido: ${dados.toString('utf8', inicio)}`);
  }
}
