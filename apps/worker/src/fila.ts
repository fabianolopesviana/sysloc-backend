/**
 * Conexão com o servidor de fila e políticas de reconexão e encerramento.
 *
 * ---------------------------------------------------------------------------
 * O contrato da fila NÃO mora aqui — ele vem de `@sysloc/shared`
 * ---------------------------------------------------------------------------
 *
 * Nome, opções de repetição e tipos de carga são **importados**, e a razão fechou o D32 (F0/T6):
 * este pacote é aplicação privada e sem `exports`, de modo que produtor nenhum — a API, o relógio
 * da F5, a suíte — conseguiria importar o que fosse definido aqui. Cada um construiria a própria
 * fila e ou repetiria as opções, ou as ignoraria: `defaultJobOptions` vale só para a **instância**
 * que as declara, e a política documentada como "a de produção" passaria a valer só neste
 * processo. O detalhe da decisão está no cabeçalho de `packages/shared/src/fila.ts`.
 *
 * O que fica aqui é o que **depende da biblioteca de fila**: a conexão, o tipo `Job<…>`, o
 * registro de processadores e o encerramento.
 *
 * ---------------------------------------------------------------------------
 * Duas políticas de repetição, que resolvem problemas diferentes
 * ---------------------------------------------------------------------------
 *
 * 1. **Repetição da TAREFA** ({@link OPCOES_PADRAO_DA_TAREFA}) — falha de execução é frequentemente
 *    transitória (a dependência que a tarefa consulta piscou). A tarefa é retentada com espera
 *    crescente, e só depois da última tentativa é dada por falha.
 * 2. **Reconexão do CLIENTE** ({@link OPCOES_DE_CONEXAO}) — o servidor de fila pode cair e voltar
 *    (é o que a CA-10 exige que sobreviva). O cliente tenta reconectar **para sempre**, com espera
 *    crescente até um teto: desistir deixaria o processador de pé e mudo, com o supervisor
 *    reportando um serviço `active` que não consome nada.
 *
 * A distinção importa na leitura de um caso de verificação: reduzir tentativas para observar uma
 * falha depressa é opção da tarefa ENFILEIRADA, não desta política — mexer aqui trocaria o
 * comportamento de produção para acomodar a verificação.
 *
 * ---------------------------------------------------------------------------
 * Ouvinte de `error`: por que ele não é ornamento
 * ---------------------------------------------------------------------------
 *
 * O cliente, a fila e o consumidor emitem `error` a cada tentativa de reconexão frustrada. **Sem
 * ouvinte a falha não some — ela sai pior**: o cliente cai no caminho de último recurso e despeja
 * a pilha crua na saída de erro (`[ioredis] Unhandled error event`), fora do formato estruturado,
 * e a fila descarta o evento em silêncio. Nos dois casos o journal deixa de ter, como campo
 * nomeado e já redigido (T3), a única pista de que o processador está de pé e não consome nada —
 * que é exatamente o estado em que a queda do servidor de fila o deixa.
 */

import {
  type CargaDaRegua,
  type CargaDoEco,
  FILA_DA_REGUA,
  FILA_DO_ECO,
  type Logger,
  OPCOES_PADRAO_DA_TAREFA,
} from '@sysloc/shared';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

// DECISÃO FECHADA — T6 · 2026-08-01
// O QUÊ: a biblioteca de fila é fixada na linha 5.x (`bullmq` 5.81.3), e não na major 6.x, que já
//        existe e é a escolha óbvia de quem instala hoje.
// POR QUÊ: a 6.0.0 saiu em 2026-07-30 e acumulou CINCO correções em 48 horas (6.0.1 a 6.0.5), e a
//          major move o cliente de Redis para dependência de par opcional com armazenamento
//          plugável — mudança estrutural no ponto exato que esta fatia existe para provar. A CA-10
//          (trabalho enfileirado sobrevive à queda do servidor de fila) é a única prova da decisão
//          de ligar persistência em disco tomada em T2, e apostá-la numa linha em correção diária
//          troca uma base provada por churn. A 5.81.3 traz o cliente `ioredis` 5.11.1, exatamente
//          o que `apps/api` já fixa — uma versão do cliente no monorepo inteiro.
// REVERTER EXIGE: demonstrar que a linha 6.x parou de receber correção em cadência diária e que
//                 CT-001 a CT-004 — a CA-10 inclusive — passam contra ela.

/** Espera entre tentativas de reconexão do cliente, e seu teto. */
const PASSO_DE_RECONEXAO_MS = 200;
const MAIOR_ESPERA_DE_RECONEXAO_MS = 5_000;

// DECISÃO FECHADA — T6 / Gate 2 · 2026-08-01
// O QUÊ: o encerramento gracioso INTEIRO corre contra um prazo (`LIMITE_DE_DESLIGAMENTO_MS`), e
//        a devolução da conexão acontece num `finally` — em vez de esperar indefinidamente que
//        cada etapa devolva o seu recurso, que é a forma óbvia e a que estava escrita.
// POR QUÊ: com o servidor de fila fora do ar, a espera não termina. O `close` do consumidor
//          fecha uma conexão que a biblioteca DUPLICA por dentro (`shared: false`), e o
//          fechamento dela emite `QUIT`; a política de reconexão desta fatia é infinita e
//          `maxRetriesPerRequest` é nulo, então o comando fica na fila de espera local para
//          sempre. Verificado nesta máquina: com a fila derrubada, o processo não terminou em
//          40 s após o `SIGTERM` — reconectava sem parar. E o cenário não é hipotético: é o
//          desligamento do sistema com a unidade da fila parando antes da do processador.
// REVERTER EXIGE: (a) que o par ordenação-de-unidades + política de reconexão garanta que
//                 nenhuma etapa do encerramento possa esperar por um servidor de fila ausente, e
//                 (b) que o `TimeoutStopSec` das unidades de T7 seja o único prazo em jogo. Este
//                 limite é deliberadamente MENOR que aquele: quem desiste primeiro precisa ser o
//                 processo, que sabe explicar no journal por que desistiu — o supervisor só sabe
//                 mandar SIGKILL. Alterar um dos dois sem o outro quebra o par: T7 declara
//                 `TimeoutStopSec` com folga sobre este valor.
const LIMITE_DE_DESLIGAMENTO_MS = 15_000;

/** Uma tarefa de eco, como o processador a recebe. */
export type TarefaDeEco = Job<CargaDoEco, string>;

/** Uma tarefa da régua de cobrança, como o processador a recebe. */
export type TarefaDaRegua = Job<CargaDaRegua, void>;

/**
 * Como o encerramento terminou.
 *
 * O desfecho é DEVOLVIDO a quem pediu, em vez de ficar guardado aqui, porque a decisão que ele
 * habilita é do ponto de entrada: só quem tem o processo na mão pode decidir terminá-lo quando a
 * espera foi abandonada.
 */
export type DesfechoDoEncerramento =
  /** Consumidores e lado produtor devolveram os recursos dentro do prazo. */
  | 'RECURSOS-DEVOLVIDOS'
  /** O prazo estourou; a conexão foi devolvida sem esperar o restante. */
  | 'PRAZO-ESTOURADO';

/**
 * Um processador de tarefa: recebe a tarefa e o registrador do processo, devolve o resultado.
 *
 * O registrador chega por parâmetro, e não por variável de módulo, porque quem o cria é a
 * composição raiz — é ela que conhece `LOG_LEVEL` e o destino do registro. É também o que permite
 * ao ponto de entrada e à verificação exercitarem exatamente a mesma fiação.
 *
 * ---------------------------------------------------------------------------
 * Por que ele é PARAMETRIZADO pela carga e pelo resultado
 * ---------------------------------------------------------------------------
 *
 * Até a T7 o consumo era de **uma** fila, e o tipo trazia a carga do eco escrita por dentro. Com o
 * trabalho da régua o processo passa a consumir duas filas com cargas e resultados diferentes, e
 * as duas saídas para isso não são equivalentes: um tipo por fila multiplicaria a fiação de
 * registro, e um tipo frouxo (`Job<unknown, unknown>`) devolveria à borda a conferência que o
 * compilador já faz. Parametrizar mantém **um** caminho de registro e faz o par carga/resultado ser
 * conferido no ponto do registro — ver {@link Fila.processar}, que recebe o próprio produtor.
 */
export type ProcessadorDeTarefa<Carga, Resultado> = (
  tarefa: Job<Carga, Resultado>,
  logger: Logger,
) => Promise<Resultado>;

/** A fila conectada: o lado que enfileira, o lado que consome e o encerramento dos dois. */
export interface Fila {
  /** Lado produtor da fila de eco, já com a política de repetição de tarefa declarada. */
  readonly eco: Queue<CargaDoEco, string>;
  /**
   * Lado produtor da fila da régua de cobrança, com a mesma política de repetição.
   *
   * Ele nasce com {@link OPCOES_PADRAO_DA_TAREFA} e é encerrado junto com os demais recursos — uma
   * fila construída à parte, depois, é exatamente o que o D32 previa. O consumidor dela é
   * registrado pela composição raiz, com {@link processar}.
   */
  readonly regua: Queue<CargaDaRegua, void>;
  /**
   * Registra o processador de uma das filas **deste** módulo. Ele passa a consumir de imediato.
   *
   * O primeiro parâmetro é o **produtor**, e não o nome da fila, e a escolha é o mecanismo: dele
   * saem o nome que o consumidor escuta e o par carga/resultado que o processador precisa honrar,
   * de modo que (a) não há como registrar processador para uma fila que este módulo não construiu
   * — e portanto não encerra —, e (b) um processador com a carga da outra fila não compila. Com o
   * nome por cadeia, as duas coisas seriam convenção, e a segunda nem existiria.
   */
  processar<Carga, Resultado>(
    produtor: Queue<Carga, Resultado>,
    processador: ProcessadorDeTarefa<Carga, Resultado>,
  ): void;
  /**
   * Encerra os consumidores — **esperando a tarefa em andamento terminar** —, depois o lado
   * produtor e, por último, a conexão.
   *
   * Termina em **tempo limitado** e devolve a conexão em **qualquer** desfecho, inclusive com o
   * servidor de fila inalcançável (ver a decisão fechada no topo do módulo). Chamadas repetidas
   * devolvem o mesmo encerramento — a segunda não reabre a espera da primeira.
   *
   * @returns Se os recursos foram devolvidos pelo caminho gracioso ou se o prazo estourou.
   */
  encerrar(): Promise<DesfechoDoEncerramento>;
}

/** Opções do cliente de Redis. Ver o cabeçalho para o porquê de cada uma. */
const OPCOES_DE_CONEXAO = {
  // Exigido pela biblioteca de fila: o consumidor bloqueia numa leitura de duração indefinida, e
  // um teto de reenvios por comando a cancelaria no meio.
  maxRetriesPerRequest: null,
  retryStrategy: (tentativa: number): number =>
    Math.min(tentativa * PASSO_DE_RECONEXAO_MS, MAIOR_ESPERA_DE_RECONEXAO_MS),
} as const;

/**
 * Conecta ao servidor de fila e devolve o lado produtor, o registro de processadores e o
 * encerramento.
 *
 * @param cadeiaConexao Endereço do servidor de fila, na forma `redis://HOSPEDEIRO:PORTA`.
 * @param logger Registrador do processo. Recebe as falhas de conexão e é repassado a cada
 * processador registrado.
 */
export function conectarFila(cadeiaConexao: string, logger: Logger): Fila {
  const conexao = new Redis(cadeiaConexao, OPCOES_DE_CONEXAO);

  // A cadeia de conexão NÃO é registrada: ela pode carregar credencial, e a linha vai para o
  // journal. O que o operador precisa saber é que o cliente da fila está em falha — a exceção
  // nomeia o endereço, e o registro estruturado (T3) redige o que houver de sensível nela.
  conexao.on('error', (erro: Error) => {
    logger.warn({ erro }, 'cliente da fila reportou falha de conexão');
  });

  const eco = new Queue<CargaDoEco, string>(FILA_DO_ECO, {
    connection: conexao,
    defaultJobOptions: OPCOES_PADRAO_DA_TAREFA,
  });
  const regua = new Queue<CargaDaRegua, void>(FILA_DA_REGUA, {
    connection: conexao,
    defaultJobOptions: OPCOES_PADRAO_DA_TAREFA,
  });

  // Nível de diagnóstico, e não de alerta: o que a fila emite aqui é o MESMO defeito de conexão
  // que o cliente acima já reportou uma vez, repassado adiante. O ouvinte existe para o evento
  // chegar ao journal em vez de ser descartado, não para duplicar a linha de alerta. Vale para
  // cada fila: sem ouvinte, a biblioteca descarta o evento em silêncio.
  for (const [nome, produtor] of [
    [FILA_DO_ECO, eco],
    [FILA_DA_REGUA, regua],
  ] as const) {
    produtor.on('error', (erro: Error) => {
      logger.debug({ erro, origem: 'fila', fila: nome }, 'a fila repassou uma falha da conexão');
    });
  }

  /**
   * O que o encerramento precisa saber de um consumidor: como fechá-lo.
   *
   * O arranjo é tipado pelo que se **faz** com ele, e não pela carga que ele consome: com duas
   * filas de cargas diferentes registradas no mesmo processo, um arranjo tipado por uma das cargas
   * ou (a) excluiria a outra, ou (b) exigiria alargar a assinatura até `any` — e `any` aqui
   * apagaria justamente a conferência que {@link Fila.processar} faz. O que `devolverGraciosamente`
   * chama é `close()`, e é só isso que este tipo promete.
   */
  interface ConsumidorEncerravel {
    close(): Promise<void>;
  }

  const consumidores: ConsumidorEncerravel[] = [];

  /**
   * Devolve consumidores e lados produtores, na ordem, **sem prazo** — quem impõe o prazo é
   * {@link Fila.encerrar}. Os consumidores primeiro, e um de cada vez: `close()` espera a tarefa
   * em andamento terminar, que é o que impede o trabalho de ser abandonado no meio quando o
   * supervisor encerra o processo.
   *
   * **Todo produtor construído aqui é fechado aqui** — inclusive o que ainda não tem consumidor.
   * Fila aberta e não devolvida deixa ouvinte preso ao laço de eventos, e o sintoma é o processo
   * que não termina no desligamento.
   */
  const devolverGraciosamente = async (): Promise<void> => {
    for (const consumidor of consumidores) {
      await consumidor.close();
    }
    consumidores.length = 0;

    await eco.close();
    await regua.close();
  };

  /** O encerramento já pedido, se houver. Ver {@link Fila.encerrar}. */
  let encerramento: Promise<DesfechoDoEncerramento> | undefined;

  const encerrarUmaVez = async (): Promise<DesfechoDoEncerramento> => {
    const gracioso = devolverGraciosamente();
    // Rejeição TARDIA — depois de o prazo ter estourado e a espera ter sido abandonada — não
    // pode virar rejeição não tratada e derrubar o processo justamente no desligamento. Quando a
    // rejeição chega DENTRO do prazo, é a corrida abaixo que a propaga a quem pediu o
    // encerramento; este ouvinte só a registra.
    gracioso.catch((erro: unknown) => {
      logger.debug({ erro }, 'a devolução dos recursos da fila falhou depois do prazo');
    });

    let prazo: NodeJS.Timeout | undefined;
    const expirar = new Promise<DesfechoDoEncerramento>((resolver) => {
      prazo = setTimeout(() => resolver('PRAZO-ESTOURADO'), LIMITE_DE_DESLIGAMENTO_MS);
    });

    try {
      const desfecho = await Promise.race([
        gracioso.then((): DesfechoDoEncerramento => 'RECURSOS-DEVOLVIDOS'),
        expirar,
      ]);
      if (desfecho === 'PRAZO-ESTOURADO') {
        // Desistir por decisão própria, dizendo no journal por quê, é melhor do que ser morto
        // pelo supervisor sem registro: a linha abaixo é a única pista de que uma tarefa em voo
        // pode ter ficado para trás.
        // O campo é a LISTA das filas devolvidas, e não o nome de uma delas (D32 · F3/T7). A
        // mensagem fala do "restante", e a partir da T8 há tarefa de negócio na segunda fila:
        // nomear só a primeira faria uma tarefa da régua abandonada no desligamento produzir uma
        // linha que nomeia `eco`. Os nomes saem dos próprios produtores que
        // `devolverGraciosamente` fecha, e não de literais — uma fila acrescentada ao encerramento
        // não tem como ficar de fora daqui.
        logger.error(
          { limiteMs: LIMITE_DE_DESLIGAMENTO_MS, filas: [eco.name, regua.name] },
          'o encerramento excedeu o limite — devolvendo a conexão sem esperar o restante',
        );
      }
      return desfecho;
    } finally {
      clearTimeout(prazo);
      // Devolução INCONDICIONAL da conexão: ela roda em qualquer desfecho da espera acima —
      // sucesso, falha de uma etapa anterior ou estouro do prazo. Enquanto a conexão estiver de
      // pé, o temporizador de reconexão segura o laço de eventos e o processo não termina.
      //
      // Encerramento incondicional (`disconnect()`), e não o gracioso (`quit()`): a política
      // acima reconecta para sempre e `maxRetriesPerRequest` é nulo, de modo que um `QUIT`
      // emitido com o servidor fora ficaria na fila de espera local até o servidor voltar — e o
      // cenário em que isso acontece é justamente o desligamento com a fila caída. Nada se perde
      // no caminho feliz: os dois fechamentos acima já aguardaram todo comando pendente.
      conexao.disconnect();
    }
  };

  return {
    eco,
    regua,

    processar<Carga, Resultado>(
      produtor: Queue<Carga, Resultado>,
      processador: ProcessadorDeTarefa<Carga, Resultado>,
    ): void {
      const consumidor = new Worker<Carga, Resultado>(
        produtor.name,
        (tarefa: Job<Carga, Resultado>) => processador(tarefa, logger),
        { connection: conexao },
      );

      consumidor.on('error', (erro: Error) => {
        logger.debug(
          { erro, origem: 'consumidor', fila: produtor.name },
          'o consumidor repassou uma falha da conexão',
        );
      });

      // Tarefa que termina em falha some do processo sem deixar rastro se ninguém a registrar: o
      // motivo fica gravado no servidor de fila, e ninguém o lê antes de o problema ser notado.
      consumidor.on('failed', (tarefa: Job<Carga, Resultado> | undefined, erro: Error) => {
        logger.error(
          { idTarefa: tarefa?.id, fila: produtor.name, tentativa: tarefa?.attemptsMade, erro },
          'tarefa terminou em falha',
        );
      });

      consumidores.push(consumidor);
    },

    encerrar(): Promise<DesfechoDoEncerramento> {
      // Um pedido de encerramento, um encerramento: o segundo chamador recebe o mesmo, em vez de
      // reabrir a espera (que, com o servidor de fila fora do ar, custaria o prazo inteiro de
      // novo). O ponto de entrada tem dois chamadores — a falha ao registrar o processador e o
      // manipulador de sinal —, e a verificação encerra a fila no descarte do caso.
      encerramento ??= encerrarUmaVez();
      return encerramento;
    },
  };
}
