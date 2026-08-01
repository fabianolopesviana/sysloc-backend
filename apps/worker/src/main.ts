/**
 * Ponto de entrada do processador de trabalho.
 *
 * ---------------------------------------------------------------------------
 * Desligamento gracioso
 * ---------------------------------------------------------------------------
 *
 * O supervisor do sistema operacional encerra o processo por sinal a cada reinício, e uma tarefa
 * cortada no meio é trabalho perdido — no domínio desta aplicação, cobrança não enviada e boleto
 * não emitido. Ao receber o sinal, o processo para de aceitar tarefa nova, **espera a que está em
 * andamento terminar** e só então devolve a conexão ({@link Fila.encerrar}). Um segundo sinal
 * durante essa janela é ignorado de propósito: ele significaria abandonar exatamente a tarefa que
 * se está esperando — e a espera tem prazo próprio, declarado em `fila.ts`, de modo que ignorar o
 * segundo sinal não é abrir mão de terminar.
 *
 * No desfecho normal o processo termina sozinho quando o encerramento devolve o último recurso.
 * No desfecho anômalo — prazo estourado ou falha ao devolver — ele termina **por decisão própria**,
 * depois da linha que explica por quê: a biblioteca de fila mantém por dentro uma conexão
 * duplicada, sem endereço público, que segue tentando reconectar e segura o laço de eventos.
 * Verificado nesta máquina: sem o término explícito, o processo não morre. Terminar aqui, com o
 * motivo já no journal, é melhor do que esperar o `SIGKILL` do supervisor, que não deixa registro
 * nenhum e leva a unidade para `failed`.
 *
 * ---------------------------------------------------------------------------
 * Falha de partida
 * ---------------------------------------------------------------------------
 *
 * Configuração inválida derruba o processo na partida, com uma mensagem que **nomeia cada variável
 * com problema** — e nunca o valor recebido, porque cadeia de conexão carrega credencial e a
 * mensagem vai para o journal. Subir e quebrar no primeiro uso é o comportamento que a validação
 * existe para impedir: o supervisor reportaria um serviço `active` que não consome tarefa alguma.
 *
 * ---------------------------------------------------------------------------
 * Por que a partida está atrás de um guarda
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina de `apps/api/src/main.ts`: o módulo só sobe o processador quando é EXECUTADO
 * como programa. Importá-lo não liga consumidor nenhum.
 */

import { pathToFileURL } from 'node:url';
import {
  criarLogger,
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
} from '@sysloc/shared';
import { conectarFila, type Fila, NOME_FILA_ECO } from './fila.js';
import { processarEco } from './tarefas/eco.js';

/** Sinais pelos quais o supervisor pede o encerramento. */
const SINAIS_DE_DESLIGAMENTO = ['SIGTERM', 'SIGINT'] as const;

/** Configuração validada do processador. */
export interface Ambiente {
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão da fila, de `REDIS_URL`. */
  readonly cadeiaConexaoFila: string;
}

/**
 * Lê e valida as variáveis que o processador exige.
 *
 * São só duas — o processador não escuta porta nem fala com o banco nesta fatia. O conjunto é
 * PRÓPRIO deste processo (o serviço de aplicação exige cinco), mas as **regras** das duas variáveis
 * vêm do pacote compartilhado: os dois processos sobem do mesmo `EnvironmentFile`, e duas
 * definições independentes do que é uma severidade ou uma cadeia de fila válida divergiriam em
 * silêncio até um arquivo subir um processo e recusar o outro — no boot.
 *
 * Valor em branco é tratado como **ausente** porque o `.env.example` versionado declara toda
 * variável sem valor, e um arquivo copiado dele sem preenchimento entrega cadeias vazias.
 *
 * A fonte é PARÂMETRO e a falha é EXCEÇÃO, como em `apps/api/src/configuracao/ambiente.ts`: quem
 * decide abortar é o ponto de entrada, e é isso que torna a validação verificável sem subprocesso.
 *
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia
 * **todas** as variáveis com problema, e nunca ecoa o valor recebido — a cadeia de conexão da fila
 * pode carregar credencial, e a mensagem de falha vai para o journal.
 */
export function lerAmbiente(fonte: Readonly<Record<string, string | undefined>>): Ambiente {
  const problemas: string[] = [];

  const nivel = fonte.LOG_LEVEL?.trim() ?? '';
  if (nivel === '') {
    problemas.push('LOG_LEVEL: ausente');
  } else if (!NIVEIS_DE_LOG.includes(nivel as NivelDeLog)) {
    problemas.push(`LOG_LEVEL: deve ser um de: ${NIVEIS_DE_LOG.join(', ')}`);
  }

  const fila = fonte.REDIS_URL?.trim() ?? '';
  if (fila === '') {
    problemas.push('REDIS_URL: ausente');
  } else if (!ehCadeiaDeFilaValida(fila)) {
    problemas.push(`REDIS_URL: ${EXIGENCIA_DA_CADEIA_DE_FILA}`);
  }

  if (problemas.length > 0) {
    throw new Error(
      `configuração inválida na partida: ${problemas.join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  return { nivelDeLog: nivel as NivelDeLog, cadeiaConexaoFila: fila };
}

/**
 * Termina o processo depois de um encerramento que NÃO devolveu tudo o que abriu.
 *
 * Só é alcançado no desfecho anômalo, e a razão é medida, não suposta: a biblioteca de fila
 * duplica a conexão por dentro para a leitura bloqueante e não publica endereço para ela, de modo
 * que uma reconexão pendurada nessa cópia segue segurando o laço de eventos mesmo depois de a
 * conexão de topo ter sido devolvida — o processo fica vivo sem consumir nada até o `SIGKILL` do
 * supervisor, que não deixa registro e leva a unidade para `failed`.
 *
 * `process.exit()` sem argumento **preserva** o `process.exitCode` já definido, em vez de o
 * sobrescrever. E não há linha a caminho para truncar: o registrador escreve de forma síncrona
 * (`packages/shared/src/log.ts`), justamente para que as últimas linhas — as que explicam a morte —
 * cheguem ao journal.
 */
function terminarPorDecisaoPropria(): never {
  process.exit();
}

/**
 * Atende ao sinal do supervisor encerrando a fila sem abandonar a tarefa em andamento.
 *
 * O ouvinte fica registrado em `process`, que já está vivo — ele não segura o laço de eventos, de
 * modo que o processo termina naturalmente assim que o encerramento devolver o último recurso.
 */
function instalarDesligamentoGracioso(fila: Fila, logger: Logger): void {
  let encerrando = false;

  for (const sinal of SINAIS_DE_DESLIGAMENTO) {
    process.on(sinal, () => {
      if (encerrando) {
        return;
      }
      encerrando = true;
      logger.info({ sinal }, 'desligamento pedido — aguardando a tarefa em andamento terminar');

      fila.encerrar().then(
        (desfecho) => {
          logger.info({ sinal, desfecho }, 'processador de trabalho encerrado');
          if (desfecho !== 'RECURSOS-DEVOLVIDOS') {
            terminarPorDecisaoPropria();
          }
        },
        (erro: unknown) => {
          logger.error({ erro, sinal }, 'falha ao encerrar o processador de trabalho');
          process.exitCode = 1;
          terminarPorDecisaoPropria();
        },
      );
    });
  }
}

async function principal(): Promise<void> {
  const ambiente = lerAmbiente(process.env);
  const logger = criarLogger({ nivel: ambiente.nivelDeLog });
  const fila = conectarFila(ambiente.cadeiaConexaoFila, logger);

  try {
    fila.processar(processarEco);
  } catch (erro) {
    // Devolver o que já foi aberto é o que permite ao processo terminar: uma conexão de pé
    // seguraria o laço de eventos e o processador ficaria vivo sem consumir nada.
    await fila.encerrar();
    throw erro;
  }

  instalarDesligamentoGracioso(fila, logger);
  logger.info({ fila: NOME_FILA_ECO }, 'processador de trabalho no ar');
}

/** Este módulo foi executado como programa, ou apenas importado? */
function ehPontoDeEntrada(): boolean {
  const invocado = process.argv[1];
  return invocado !== undefined && import.meta.url === pathToFileURL(invocado).href;
}

if (ehPontoDeEntrada()) {
  principal().catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    // Código de saída em vez de encerramento imediato: a escrita acima ainda pode estar a caminho
    // do journal, e `process.exit` a truncaria — justamente a linha que diz por que o processador
    // não subiu.
    process.exitCode = 1;
  });
}
