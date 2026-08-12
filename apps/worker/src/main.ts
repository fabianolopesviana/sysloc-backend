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
 * ⚠️ **Aqui o modo perigoso é o inverso do habitual** (CA-17). Desde que este processo passou a
 * falar com um servidor de e-mail, *"tentar mesmo assim"* não degrada em erro: um transporte
 * construído a partir de cadeia vazia aponta para o `localhost` que a biblioteca assume por
 * omissão, e o que estava em jogo era alcançar a caixa de uma pessoa real. A barreira **falha
 * fechado** em dois degraus, e os dois são de partida: {@link lerAmbiente} recusa a variável
 * **não declarada**, e `criarAdaptadorSmtp` recusa a que está declarada e **não serve como
 * endereço** — construído antes de qualquer recurso ser aberto, de modo que a recusa dele não
 * deixa reserva nem conexão para trás.
 *
 * ---------------------------------------------------------------------------
 * A composição raiz escolhe as portas — e é a ÚNICA que as escolhe
 * ---------------------------------------------------------------------------
 *
 * É daqui que saem a reserva de conexões e o adaptador de produção de e-mail, e é por **parâmetro**
 * que eles chegam à borda do trabalho (ADR-0025). A verificação entrega o capturador pelo mesmo
 * parâmetro, e é isso que a torna incapaz de alcançar rede: não existe bandeira, variável de
 * ambiente ou ramo que escolha entre as duas implementações — a escolha é de quem compõe.
 *
 * ---------------------------------------------------------------------------
 * Por que a partida está atrás de um guarda
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina de `apps/api/src/main.ts`: o módulo só sobe o processador quando é EXECUTADO
 * como programa. Importá-lo não liga consumidor nenhum.
 */

import { pathToFileURL } from 'node:url';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '@sysloc/db';
import { criarAdaptadorSmtp } from '@sysloc/regua';
import {
  criarLogger,
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
} from '@sysloc/shared';
import { conectarFila, type DesfechoDoEncerramento, type Fila } from './fila.js';
import { processarEco } from './tarefas/eco.js';
import { processarReguaDeCobranca } from './tarefas/regua.js';

/** Sinais pelos quais o supervisor pede o encerramento. */
const SINAIS_DE_DESLIGAMENTO = ['SIGTERM', 'SIGINT'] as const;

/**
 * Prazo da devolução da reserva de conexões, **depois** de a fila já ter sido devolvida.
 *
 * Ele existe pela mesma razão medida que fez o encerramento da fila ganhar prazo próprio (ver o
 * marcador `DECISÃO FECHADA` de `./fila.ts`): recurso que não é devolvido segura o laço de eventos,
 * e o processo fica vivo sem consumir nada até o `SIGKILL` do supervisor — que não deixa registro e
 * leva a unidade para `failed`. Uma reserva com consulta pendente contra um banco que não responde
 * é exatamente esse caso, e ele acontece no desligamento do sistema.
 *
 * O valor soma com o prazo da fila (15 s) e fica **abaixo** do `TimeoutStopSec` de 30 s que as duas
 * unidades declaram: quem desiste primeiro precisa ser o processo, que sabe explicar no journal por
 * que desistiu.
 */
const LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS = 5_000;

/** Configuração validada do processador. */
export interface Ambiente {
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão da fila, de `REDIS_URL`. */
  readonly cadeiaConexaoFila: string;
  /** Cadeia de conexão do banco, de `DATABASE_URL`. */
  readonly cadeiaConexaoBanco: string;
  /** Cadeia de conexão do servidor de e-mail, de `SMTP_URL`. **Carrega credencial**. */
  readonly urlDoTransporte: string;
  /** Endereço que assina o aviso, de `EMAIL_REMETENTE`. */
  readonly remetenteDoAviso: string;
}

/**
 * Lê e valida as variáveis que o processador exige.
 *
 * São **cinco** desde a T8, e o crescimento é a natureza do processo mudando: ele deixou de ser um
 * consumidor que só fala com a fila e passou a falar com o **banco** e com um **servidor de
 * e-mail**. O conjunto continua PRÓPRIO deste processo (ele não escuta porta, e `PORT` não entra),
 * mas as **regras** das duas variáveis originais vêm do pacote compartilhado: os dois processos
 * sobem do mesmo `EnvironmentFile`, e duas definições independentes do que é uma severidade ou uma
 * cadeia de fila válida divergiriam em silêncio até um arquivo subir um processo e recusar o outro
 * — no boot.
 *
 * Das três novas, o que se exige aqui é **presença e não-vacuidade**, e a divisão é deliberada:
 * a forma da `SMTP_URL` é conferida por `coordenadasDoTransporte` (em `@sysloc/regua`), que a
 * recusa por esquema e por hospedeiro **também na partida**, quando o adaptador é construído.
 * Reimplementar aquela conferência aqui criaria duas definições do que é um transporte utilizável,
 * e a segunda escaparia da primeira.
 *
 * Valor em branco é tratado como **ausente** porque o `.env.example` versionado declara toda
 * variável sem valor, e um arquivo copiado dele sem preenchimento entrega cadeias vazias.
 *
 * A fonte é PARÂMETRO e a falha é EXCEÇÃO, como em `apps/api/src/configuracao/ambiente.ts`: quem
 * decide abortar é o ponto de entrada, e é isso que torna a validação verificável sem subprocesso.
 *
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia
 * **todas** as variáveis com problema, e nunca ecoa o valor recebido — a cadeia da fila, a do banco
 * e a do transporte carregam credencial, e a mensagem de falha vai para o journal.
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

  const banco = fonte.DATABASE_URL?.trim() ?? '';
  if (banco === '') {
    problemas.push('DATABASE_URL: ausente');
  }

  const transporte = fonte.SMTP_URL?.trim() ?? '';
  if (transporte === '') {
    problemas.push('SMTP_URL: ausente');
  }

  const remetente = fonte.EMAIL_REMETENTE?.trim() ?? '';
  if (remetente === '') {
    problemas.push('EMAIL_REMETENTE: ausente');
  }

  if (problemas.length > 0) {
    throw new Error(
      `configuração inválida na partida: ${problemas.join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  return {
    nivelDeLog: nivel as NivelDeLog,
    cadeiaConexaoFila: fila,
    cadeiaConexaoBanco: banco,
    urlDoTransporte: transporte,
    remetenteDoAviso: remetente,
  };
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
 * Devolve a reserva de conexões com o banco, em **tempo limitado**.
 *
 * A falha é registrada e **não sobe**: no desligamento, uma rejeição aqui derrubaria o caminho que
 * termina o processo com registro, trocando um diagnóstico por um travamento. O que o chamador
 * precisa saber é apenas se a devolução aconteceu dentro do prazo — ver
 * {@link LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS} para por que o prazo existe.
 *
 * @returns `true` quando a reserva foi devolvida dentro do prazo.
 */
async function devolverReserva(banco: AcessoAoBanco, logger: Logger): Promise<boolean> {
  let prazo: NodeJS.Timeout | undefined;
  const expirar = new Promise<false>((resolver) => {
    prazo = setTimeout(() => resolver(false), LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS);
  });

  try {
    return await Promise.race([banco.encerrar().then(() => true), expirar]);
  } catch (erro) {
    logger.error({ erro }, 'falha ao devolver a reserva de conexões com o banco');

    return false;
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * Devolve os recursos do processo, na ordem que o trabalho em voo exige.
 *
 * A **fila primeiro**: encerrá-la espera a tarefa em andamento terminar, e essa tarefa ainda
 * consulta o banco — fechar a reserva antes derrubaria no meio exatamente o trabalho que a espera
 * existe para não abandonar. A reserva depois, e **incondicionalmente**, inclusive quando o
 * encerramento da fila falhou: enquanto ela estiver de pé o processo não termina, e a falha da fila
 * deixaria de ser diagnóstico para virar travamento.
 *
 * A reserva que não é devolvida no prazo rebaixa o desfecho para `PRAZO-ESTOURADO` — é o valor que
 * o chamador consome para terminar o processo por decisão própria, e ele descreve o encerramento
 * inteiro, não só a fila.
 */
async function devolverRecursos(
  fila: Fila,
  banco: AcessoAoBanco,
  logger: Logger,
): Promise<DesfechoDoEncerramento> {
  try {
    const desfecho = await fila.encerrar();

    return (await devolverReserva(banco, logger)) ? desfecho : 'PRAZO-ESTOURADO';
  } catch (erro) {
    await devolverReserva(banco, logger);

    throw erro;
  }
}

/**
 * Atende ao sinal do supervisor encerrando a fila sem abandonar a tarefa em andamento.
 *
 * O ouvinte fica registrado em `process`, que já está vivo — ele não segura o laço de eventos, de
 * modo que o processo termina naturalmente assim que o encerramento devolver o último recurso.
 */
function instalarDesligamentoGracioso(fila: Fila, banco: AcessoAoBanco, logger: Logger): void {
  let encerrando = false;

  for (const sinal of SINAIS_DE_DESLIGAMENTO) {
    process.on(sinal, () => {
      if (encerrando) {
        return;
      }
      encerrando = true;
      logger.info({ sinal }, 'desligamento pedido — aguardando a tarefa em andamento terminar');

      devolverRecursos(fila, banco, logger).then(
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

  // O adaptador de produção é construído ANTES de qualquer recurso ser aberto, e a ordem é
  // conteúdo: ele **recusa a partida** quando a `SMTP_URL` não serve como endereço, e uma recusa
  // depois da reserva ou da conexão deixaria as duas para trás num processo que morre.
  const email = criarAdaptadorSmtp({
    urlDoTransporte: ambiente.urlDoTransporte,
    remetente: ambiente.remetenteDoAviso,
  });
  const banco = abrirAcessoAoBanco({ cadeiaDeConexao: ambiente.cadeiaConexaoBanco });
  const fila = conectarFila(ambiente.cadeiaConexaoFila, logger);

  try {
    fila.processar(fila.eco, processarEco);
    fila.processar(
      fila.regua,
      async (tarefa, registrador) =>
        await processarReguaDeCobranca(tarefa, registrador, { banco, email }),
    );
  } catch (erro) {
    // Devolver o que já foi aberto é o que permite ao processo terminar: uma conexão de pé
    // seguraria o laço de eventos e o processador ficaria vivo sem consumir nada. A falha da
    // devolução é registrada e não substitui a original — é a original que diz por que o processo
    // não subiu, e é ela que o ponto de entrada escreve na saída de erro.
    await devolverRecursos(fila, banco, logger).catch((falha: unknown) => {
      logger.error({ erro: falha }, 'falha ao devolver os recursos de uma partida frustrada');
    });
    throw erro;
  }

  instalarDesligamentoGracioso(fila, banco, logger);
  logger.info({ filas: [fila.eco.name, fila.regua.name] }, 'processador de trabalho no ar');
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
