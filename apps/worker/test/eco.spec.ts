/**
 * Processador de trabalho — fila persistente e tarefa de ida e volta. T6 da fatia
 * `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-5  | CT-001 | Tarefa enfileirada em `NOME_FILA_ECO` é consumida, termina CONCLUÍDA com
 * | CA-6  |        | resultado igual ao valor enviado, e o registro estruturado emite o término
 * |       |        | carregando o identificador que o servidor de fila atribuiu. |
 * | CA-5  | CT-002 | Carga útil sem o campo de valor termina em FALHA, com razão não vazia que
 * |       |        | nomeia o campo, e não aparece entre as concluídas — nunca ecoa indefinido
 * |       |        | como sucesso. |
 * | CA-10 | CT-003 | Tarefa enfileirada e ainda não consumida sobrevive à queda e ao retorno do
 * | CA-6  |        | servidor de fila com o MESMO identificador e a MESMA carga, e é consumida
 * | CA-7  |        | normalmente depois; o encerramento com o servidor DE PÉ devolve
 * | §4    |        | 'RECURSOS-DEVOLVIDOS', e a efêmera é descartada sem processo nem diretório. |
 * | CA-10 | CT-004 | Durante a janela de queda, enfileirar falha com CONEXÃO RECUSADA em tempo
 * |       |        | curto, e nenhuma tarefa é criada — é o que prova que a queda foi real. |
 * | §4    | CT-005 | Pedido de encerramento com o servidor de fila FORA DO AR termina dentro do
 * |       |        | prazo declarado, devolve a conexão e DEVOLVE A QUEM PEDIU o desfecho
 * |       |        | 'PRAZO-ESTOURADO', com a linha de estouro no journal — não fica pendurado
 * |       |        | esperando um servidor que não vai responder, nem cala que desistiu. |
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-005 existe, e o que ele pega de volta
 * ---------------------------------------------------------------------------
 *
 * O desligamento gracioso é entregável da §4 desta task, e ele esperava **sem prazo**: o
 * fechamento do consumidor emite `QUIT` numa conexão que a biblioteca duplica por dentro, e a
 * política desta fatia reconecta para sempre — com o servidor fora do ar, o comando fica na fila
 * de espera local e a espera não termina. Medido nesta máquina antes da correção: 40 s após o
 * `SIGTERM`, com a fila derrubada, o processo seguia vivo e reconectando.
 *
 * Quem paga é a T7, que coloca o processador sob o supervisor: no desligamento do sistema, se a
 * unidade da fila parar antes, o processo é morto por `SIGKILL` com a tarefa em voo abandonada e a
 * unidade converge para `failed` — estado que o CT-006 da T7 reprova.
 *
 * O travamento do caminho gracioso é **construído pelo caso**, e não esperado do ambiente: uma
 * tarefa fica em voo num processador que bloqueia até o teste liberar, e `close()` tem de esperá-la
 * por contrato. Antes ele era induzido contando falhas de conexão depois da queda — proxy que
 * produzia o travamento "em cerca de metade das execuções" e que fez o caso reprovar sob a
 * concorrência do Turbo. O detalhe está no corpo do CT-005.
 *
 * **Origem desta correção**, porque ela não pertence a nenhum débito `Dnn` e o escopo tem de ser
 * rastreável: §4 do `docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md`,
 * nota *"Flake pré-existente que precisa de dono"*, fechada na intervenção de fechamento da F1. O
 * arquivo é da F0/T6 e nenhuma task da F1 o havia tocado — `git diff -- apps/worker/` era vazio
 * quando o flake foi observado. A `.claude/rules/testing-stack.md` é o que torna isto obrigatório e
 * não opcional: *"flaky é defeito: para a fila até ser corrigido"*.
 *
 * ---------------------------------------------------------------------------
 * ADR-0006 — de onde vem a fila desta verificação
 * ---------------------------------------------------------------------------
 *
 * De uma instância efêmera própria (T4), nunca da provisionada que atende (ou virá a atender) a
 * operação. As coordenadas usadas são EXCLUSIVAMENTE as que `redisEfemero()` devolve — nenhuma é
 * lida do ambiente nem assumida por porta padrão. {@link montarFila} compara a porta em uso com a
 * provisionada antes de qualquer caso rodar, no mesmo molde de
 * `packages/shared/test/ambiente-efemero.spec.ts` e de `apps/api/test/saude.e2e.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 * O que torna o CT-003 não-tautológico
 * ---------------------------------------------------------------------------
 *
 * A queda é REAL: o processo do servidor de fila é encerrado pelo helper de T4, preservando o
 * diretório de dados. Fechar apenas a conexão do cliente não provaria nada sobre persistência — a
 * tarefa continuaria viva na memória de um servidor que nunca caiu.
 *
 * Duas asserções sustentam isso, e sem elas o caso passaria mesmo se a queda não acontecesse:
 *
 *   1. **Antes** da queda, a persistência em disco é confirmada CONSULTANDO O PRÓPRIO SERVIDOR, e
 *      o arquivo de dados é procurado no diretório da efêmera. Sem essa pré-condição, um servidor
 *      sem persistência produziria um falso verde por outro motivo.
 *   2. **Durante** a janela de queda, o CT-004 mostra que a porta recusa conexão — `ECONNREFUSED`,
 *      e não tempo esgotado, que também ocorreria com o servidor vivo porém lento.
 *
 * ---------------------------------------------------------------------------
 * Como o término é observado (CT-001)
 * ---------------------------------------------------------------------------
 *
 * Pelo registrador de PRODUÇÃO — `criarLogger` de `@sysloc/shared`, com o mesmo parâmetro
 * `destino` que a unidade systemd usa —, apontado para um coletor em memória. Nenhum dublê de
 * registrador, nenhuma espionagem de chamada: a asserção recai sobre a linha que o processador de
 * fato escreve, e sobre um identificador que o SERVIDOR DE FILA atribuiu, não sobre valor plantado
 * pelo teste. Nada em `apps/worker/src` ganhou parâmetro, bandeira ou ramo para o término ser
 * observável: o registrador já chega ao processador por parâmetro, que é como o ponto de entrada o
 * entrega em operação.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { criarLogger } from '@sysloc/shared';
import { Queue } from 'bullmq';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
  FAIXA_PORTAS_EFEMERAS,
  processoVivo,
  sondarAte,
} from '../../../packages/shared/test/efemero-comum.ts';
import {
  comandoFila,
  type FilaEfemera,
  redisEfemero,
} from '../../../packages/shared/test/redis-efemero.ts';
import {
  type CargaDeEco,
  conectarFila,
  type Fila,
  NOME_FILA_ECO,
  type TarefaDeEco,
} from '../src/fila.ts';
import { processarEco } from '../src/tarefas/eco.ts';

/** Limite de um caso que sobe instância própria de fila. */
const LIMITE_CASO_MS = 120_000;

/** Limite para uma tarefa alcançar estado terminal (concluída ou falha). */
const LIMITE_ESTADO_TERMINAL_MS = 30_000;

/** Limite para o cliente de produção voltar a responder depois do religamento da instância. */
const LIMITE_DE_RECONEXAO_MS = 30_000;

/** Teto declarado pelo CT-004 para a recusa do enfileiramento durante a janela de queda. */
const LIMITE_DE_ENFILEIRAMENTO_RECUSADO_MS = 5_000;

/**
 * Teto declarado pelo CT-005 para o encerramento pedido com o servidor de fila fora do ar.
 *
 * É folga sobre o prazo de produção (`LIMITE_DE_DESLIGAMENTO_MS`, 15 s em `apps/worker/src/fila.ts`)
 * — o suficiente para o estouro acontecer e a conexão ser devolvida, e curto o bastante para que
 * uma espera sem prazo reprove aqui, e não no teto do caso. Subir o prazo de produção acima deste
 * valor reprova este caso de propósito: ele é o outro lado do par com o `TimeoutStopSec` que a T7
 * declara, e o par não pode ser mexido de um lado só.
 */
const LIMITE_DE_ENCERRAMENTO_OBSERVADO_MS = 25_000;

/** Limite para o processo acumular as falhas de conexão que antecedem o pedido do CT-005. */
const LIMITE_DE_ACOMODACAO_MS = 30_000;

/**
 * Janela em que o CT-005 observa a QUIETUDE do cliente depois do encerramento.
 *
 * Não é a espera fixa que a política de flaky proíbe — aquela substitui sondagem por estado
 * observável, e aqui o que se assere é uma **ausência**: uma conexão não devolvida seguiria
 * tentando reconectar e registrando falha, e ausência só se observa ao longo de um intervalo. A
 * janela é mais que o dobro do teto de espera entre reconexões declarado em `apps/worker/src/fila.ts`
 * (5 s), de modo que um cliente ainda de pé teria registrado ao menos duas falhas dentro dela.
 */
const JANELA_DE_QUIETUDE_MS = 12_000;

/** Limite para observar a porta de uma instância já derrubada. */
const LIMITE_DE_CONEXAO_MS = 10_000;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina. */
const PORTA_PADRAO_DA_FILA = 6379;

/**
 * Mensagem exata que o processador escreve ao concluir.
 *
 * Fica como literal AQUI, e não como constante importada do código sob teste: exportá-la de
 * `apps/worker/src` criaria símbolo de produção que só a verificação consome, e a asserção passaria
 * a comparar o valor com ele mesmo. O que se assere é a linha que o operador lê no journal.
 */
const MENSAGEM_DE_TERMINO = 'tarefa de eco concluída';

/** Mensagem exata que o cliente da fila escreve a cada tentativa de conexão frustrada. */
const MENSAGEM_DE_FALHA_DE_CONEXAO = 'cliente da fila reportou falha de conexão';

/**
 * Mensagem exata que o encerramento escreve ao desistir da espera.
 *
 * Literal aqui pelo mesmo critério de {@link MENSAGEM_DE_TERMINO}: o que se assere é a linha que o
 * operador lê no journal — a única pista de que uma tarefa em voo pode ter ficado para trás.
 */
const MENSAGEM_DE_ESTOURO_DO_ENCERRAMENTO =
  'o encerramento excedeu o limite — devolvendo a conexão sem esperar o restante';

/**
 * Prazo de produção do desligamento gracioso, como o journal o carimba no campo `limiteMs`.
 *
 * É o `LIMITE_DE_DESLIGAMENTO_MS` de `apps/worker/src/fila.ts`, repetido aqui como literal e não
 * importado: ele não é símbolo público do processador, e exportá-lo só para a verificação faria a
 * asserção comparar o valor com ele mesmo. Que a mudança do prazo de produção reprove este caso é
 * deliberado — a decisão fechada de `fila.ts` declara que este limite forma par com o
 * `TimeoutStopSec` que a T7 vai declarar, e o par não pode ser mexido de um lado só.
 */
const PRAZO_DE_DESLIGAMENTO_DECLARADO_MS = 15_000;

/** Tentativas de uma tarefa que o CT-002 reduz — nas opções do ENFILEIRAMENTO, nunca em `fila.ts`. */
const UMA_TENTATIVA = 1;

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT_DE_PROVISIONAMENTO = `${RAIZ_DO_REPOSITORIO}deploy/scripts/instalacao/provisionar-base.sh`;

/**
 * Lê uma constante declarada no script de provisionamento — o caminho legítimo para conhecer as
 * coordenadas da instância provisionada sem abrir conexão contra ela, que a ADR-0006 proíbe.
 * Mesmo padrão de `packages/shared/test/ambiente-efemero.spec.ts` e de `apps/api/test/saude.e2e.spec.ts`.
 */
function constanteDoProvisionamento(nome: string): string | undefined {
  const texto = readFileSync(SCRIPT_DE_PROVISIONAMENTO, 'utf8');
  return new RegExp(`^readonly ${nome}="?([^"\\n]+)"?$`, 'm').exec(texto)?.[1];
}

interface CoordenadaProvisionada {
  readonly porta: number;
  readonly origem: string;
}

/**
 * Porta da fila provisionada, com a ORIGEM declarada.
 *
 * A origem existe para que a degradação apareça: quando a constante deixa de ser encontrada no
 * script, o valor comparável passa a ser o padrão do serviço — e sem dizê-lo a asserção seguiria
 * verde por um motivo diferente do que ela afirma provar (`.claude/rules/testing-stack.md`:
 * ausência nunca faz o caso passar em silêncio).
 */
function portaProvisionadaDaFila(): CoordenadaProvisionada {
  const declarada = constanteDoProvisionamento('PORTA_FILA');
  if (declarada !== undefined) {
    return {
      porta: Number.parseInt(declarada, 10),
      origem: 'PORTA_FILA declarada em provisionar-base.sh',
    };
  }
  return {
    porta: PORTA_PADRAO_DA_FILA,
    origem: 'padrão do serviço (degradação: provisionar-base.sh não declarou PORTA_FILA)',
  };
}

/**
 * Código do erro ao conectar na porta — `ECONNREFUSED` quando ninguém escuta.
 *
 * O ramo de tempo esgotado é o que dá sentido à asserção: uma porta filtrada, ou um servidor vivo
 * porém travado, produziria `TEMPO-ESGOTADO`, e só a recusa prova encerramento. Mesmo instrumento
 * aprovado em `apps/api/test/saude.e2e.spec.ts`.
 */
function codigoAoConectar(porta: number): Promise<string> {
  return new Promise((resolver) => {
    const soquete = createConnection({ host: '127.0.0.1', port: porta });
    soquete.setTimeout(LIMITE_DE_CONEXAO_MS, () => {
      soquete.destroy();
      resolver('TEMPO-ESGOTADO');
    });
    soquete.on('error', (erro: NodeJS.ErrnoException) => {
      soquete.destroy();
      resolver(erro.code ?? 'SEM-CODIGO');
    });
    soquete.on('connect', () => {
      soquete.destroy();
      resolver('CONECTOU');
    });
  });
}

/**
 * Chave que o NÚCLEO do registrador carimba em toda linha, sem que a fatia peça, e cujo valor é
 * um número livre — o identificador do processo. Ver a asserção de porta do CT-001.
 */
const CHAVE_DO_NUCLEO_COM_NUMERO_LIVRE = 'pid';

/** Os campos que o produto escreveu no evento, sem o que o núcleo do registrador carimba. */
function camposDoProduto(evento: Record<string, unknown>): Record<string, unknown> {
  const { [CHAVE_DO_NUCLEO_COM_NUMERO_LIVRE]: _nucleo, ...doProduto } = evento;
  return doProduto;
}

/** O journal deste processador: as linhas cruas e os eventos já desserializados, em ordem. */
interface JournalObservavel {
  /** As linhas exatamente como o registrador as escreve — é o que o operador lê. */
  linhas: () => readonly string[];
  /** As mesmas linhas desserializadas, para asserção de campo. */
  eventos: () => readonly Record<string, unknown>[];
}

interface Montagem {
  readonly instancia: FilaEfemera;
  readonly fila: Fila;
  readonly journal: JournalObservavel;
}

/**
 * Sobe a instância efêmera de fila e conecta o processador a ela, com o journal observável.
 *
 * As coordenadas são PARÂMETRO implícito da montagem: `conectarFila` só é alcançado aqui dentro, e
 * o único endereço que ele recebe é o que `redisEfemero()` devolveu. É a diferença entre a garantia
 * da ADR-0006 vir da construção e vir da lembrança de quem escreve o caso seguinte — e é a primeira
 * alternativa que a própria ADR rejeita ("depende de cada teste respeitar o mecanismo").
 *
 * Nenhum processador é registrado aqui: quem decide isso é cada caso, porque o CT-003 precisa
 * enfileirar com a fila sem consumidor.
 */
async function montarFila(): Promise<Montagem> {
  const instancia = await redisEfemero();
  onTestFinished(() => instancia.parar());

  // ADR-0006: a instância em uso não é a provisionada, e está dentro da faixa efêmera de T4.
  const provisionada = portaProvisionadaDaFila();
  expect(
    instancia.porta,
    `a porta efêmera da fila não pode ser a provisionada (${provisionada.porta}, ` +
      `origem: ${provisionada.origem})`,
  ).not.toBe(provisionada.porta);
  expect(instancia.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instancia.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instancia.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

  const linhas: string[] = [];
  const logger = criarLogger({
    nivel: 'info',
    destino: {
      write(linha: string): void {
        linhas.push(linha);
      },
    },
  });

  const fila = conectarFila(instancia.cadeiaConexao, logger);
  // Registrado DEPOIS da instância: os descartes rodam em ordem inversa, então a fila é encerrada
  // antes de o servidor dela ser derrubado.
  onTestFinished(async () => {
    await fila.encerrar();
  });

  return {
    instancia,
    fila,
    journal: {
      linhas: () => linhas,
      eventos: () => linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>),
    },
  };
}

/**
 * Identificador atribuído pelo SERVIDOR DE FILA à tarefa enfileirada.
 *
 * A ausência é falha explícita, e não `undefined` propagado adiante: sem o identificador, toda
 * asserção que o compara passaria a comparar `undefined` com `undefined`.
 */
function identificadorDe(tarefa: TarefaDeEco): string {
  const id = tarefa.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }
  return id;
}

/** Espera a tarefa alcançar estado terminal por SONDAGEM com limite declarado — nunca espera fixa. */
async function aguardarEstadoTerminal(fila: Fila, id: string): Promise<TarefaDeEco> {
  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.eco.getJob(id))?.getState();
      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.eco.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }
  return terminada;
}

/** Rejeita depois do limite, para que a espera por uma falha não vire espera pelo teto do caso. */
function expirarEm(limiteMs: number, rotulo: string): Promise<never> {
  return new Promise((_, rejeitar) => {
    // Sem `unref`, o temporizador pendente seguraria o laço de eventos depois que a corrida for
    // decidida pelo outro lado.
    setTimeout(
      () => rejeitar(new Error(`${rotulo} não se resolveu em ${limiteMs} ms`)),
      limiteMs,
    ).unref();
  });
}

interface FalhaAoEnfileirar {
  readonly erro: NodeJS.ErrnoException;
  readonly decorridoMs: number;
}

interface CicloDeQueda extends Montagem {
  /** Identificador da tarefa enfileirada antes da queda, atribuído pelo servidor de fila. */
  readonly id: string;
  /** Valor único que a carga útil carrega. */
  readonly valor: string;
}

/**
 * Monta o ciclo que o CT-003 e o CT-004 compartilham: fila efêmera de pé, UMA tarefa enfileirada
 * sem consumidor registrado, e o servidor de fila derrubado de verdade, preservando os dados.
 *
 * Devolve com a instância JÁ DERRUBADA — é o passo intermediário do ciclo, e cada caso segue dali
 * para o que lhe cabe provar. As duas pré-condições da CA-10 são asseridas **antes** da queda: sem
 * elas o desfecho seria verde por acaso, e não por persistência.
 */
async function derrubarComTarefaEnfileirada(): Promise<CicloDeQueda> {
  const montagem = await montarFila();
  const { instancia, fila } = montagem;

  // Pré-condição 1 — a persistência em disco está habilitada. A pergunta é feita ao PRÓPRIO
  // servidor, não à configuração que o teste supõe ter sido usada.
  expect(
    await comandoFila(instancia.porta, 'CONFIG', 'GET', 'appendonly'),
    'a instância efêmera precisa estar com a persistência em disco habilitada — sem ela, ' +
      'sobreviver à queda não provaria nada sobre a decisão tomada em T2',
  ).toEqual(['appendonly', 'yes']);

  // Pré-condição 2 — o arquivo de dados existe no diretório da efêmera.
  const entradas = readdirSync(instancia.diretorioDados);
  expect(
    entradas.filter((entrada) => entrada.startsWith('appendonly')),
    `o diretório de dados da efêmera (${instancia.diretorioDados}) não tem arquivo de registro ` +
      `contínuo — encontrado: ${entradas.join(', ') || '<vazio>'}`,
  ).not.toHaveLength(0);

  // Enfileira SEM consumidor registrado: é o que remove a corrida entre consumo e queda sem
  // precisar de pausa arbitrária.
  const valor = `eco-${randomUUID()}`;
  const id = identificadorDe(await fila.eco.add(NOME_FILA_ECO, { valor }));
  expect(await fila.eco.getWaitingCount()).toBe(1);

  // Queda REAL do processo do servidor de fila, preservando o diretório de dados. Fechar apenas a
  // conexão do cliente deixaria a tarefa viva na memória de um servidor que nunca caiu.
  await instancia.parar({ preservarDados: true });

  return { ...montagem, id, valor };
}

/** Espera o cliente de produção voltar a responder depois do religamento, por sondagem. */
async function aguardarReconexao(fila: Fila): Promise<void> {
  await sondarAte(
    'o cliente de produção voltar a responder depois do religamento',
    async () => {
      try {
        return (await fila.eco.getWaitingCount()) >= 0;
      } catch {
        return false;
      }
    },
    LIMITE_DE_RECONEXAO_MS,
  );
}

/**
 * Tenta enfileirar contra as MESMAS coordenadas da instância derrubada, com repetição limitada.
 *
 * O cliente é próprio deste caso e a limitação de repetição vive NELE — a política de
 * `apps/worker/src/fila.ts` reconecta para sempre de propósito (é o que faz o processador
 * sobreviver à queda), e alterá-la para acomodar a verificação trocaria o comportamento de
 * produção. As coordenadas vêm da cadeia de conexão que `redisEfemero()` devolveu: apontar para
 * uma porta inventada provaria apenas que porta fechada recusa conexão, não que ESTA instância caiu.
 */
async function enfileirarNaJanelaDeQueda(
  cadeiaConexao: string,
  valor: string,
): Promise<FalhaAoEnfileirar> {
  const endereco = new URL(cadeiaConexao);
  const sonda = new Queue<CargaDeEco, string>(NOME_FILA_ECO, {
    connection: {
      host: endereco.hostname,
      port: Number.parseInt(endereco.port, 10),
      // Repetição limitada: uma tentativa, e o cliente desiste.
      retryStrategy: () => null,
    },
  });
  onTestFinished(() => sonda.close());

  const inicio = performance.now();
  const erro = await Promise.race([
    sonda.add(NOME_FILA_ECO, { valor }).then(
      (criada) => {
        throw new Error(
          `enfileirar criou a tarefa ${criada.id} com o servidor de fila derrubado — ` +
            'a janela de queda do CT-003 não foi real',
        );
      },
      (recusa: NodeJS.ErrnoException) => recusa,
    ),
    expirarEm(LIMITE_DE_ENFILEIRAMENTO_RECUSADO_MS, 'o enfileiramento na janela de queda'),
  ]);

  return { erro, decorridoMs: performance.now() - inicio };
}

describe('processador de trabalho (T6)', () => {
  it(
    'CT-001 — tarefa de eco enfileirada é consumida, devolve o mesmo valor e registra o término',
    async () => {
      const { instancia, fila, journal } = await montarFila();
      fila.processar(processarEco);

      // Fila vazia na partida: sem isto, "1 concluída" poderia ser resíduo de outra execução.
      expect(await fila.eco.getCompletedCount()).toBe(0);

      const valor = `eco-${randomUUID()}`;
      const id = identificadorDe(await fila.eco.add(NOME_FILA_ECO, { valor }));

      const terminada = await aguardarEstadoTerminal(fila, id);

      expect(await terminada.getState()).toBe('completed');
      // O valor atravessou serialização, gravação, leitura e execução, e voltou idêntico.
      expect(terminada.returnvalue).toBe(valor);

      // O registro do término, pelo identificador que o SERVIDOR DE FILA atribuiu.
      const doTermino = journal.eventos().filter((evento) => evento.idTarefa === id);
      expect(doTermino).toHaveLength(1);
      expect(doTermino[0]?.mensagem).toBe(MENSAGEM_DE_TERMINO);
      expect(doTermino[0]?.nivel).toBe('info');
      expect(doTermino[0]?.fila).toBe(NOME_FILA_ECO);
      expect(doTermino[0]?.valor).toBe(valor);

      // Nenhuma linha carrega a cadeia de conexão da fila nem credencial.
      for (const linha of journal.linhas()) {
        expect(linha).not.toContain(instancia.cadeiaConexao);
        expect(linha).not.toContain('redis://');
      }

      // A PORTA é procurada nos campos do produto, e não na linha crua: o núcleo do registrador
      // carimba `"pid":N` em toda linha, e um identificador de processo dentro da faixa efêmera
      // (24001–24999) faria a asserção reprovar por coincidência — falha intermitente numa
      // política que não admite nova tentativa. A cobertura é a mesma: campo aninhado continua
      // dentro do texto comparado.
      for (const evento of journal.eventos()) {
        expect(JSON.stringify(camposDoProduto(evento))).not.toContain(`:${instancia.porta}`);
      }
    },
    LIMITE_CASO_MS,
  );

  it.each([
    { cenario: 'carga vazia', carga: {} },
    { cenario: 'campo com nome errado', carga: { chaveErrada: 'algum-texto' } },
  ])(
    'CT-002 — tarefa com carga sem o valor esperado termina em falha e não entra nas concluídas ($cenario)',
    async ({ carga }) => {
      const { fila } = await montarFila();
      fila.processar(processarEco);

      // A conversão é o ponto do caso: a carga que chega do lado de fora do processo não obedece ao
      // tipo declarado, e é isso que o processador precisa recusar.
      const id = identificadorDe(
        await fila.eco.add(NOME_FILA_ECO, carga as unknown as CargaDeEco, {
          // Redução para UMA tentativa nas opções do enfileiramento — a política declarada em
          // `apps/worker/src/fila.ts` continua sendo a de produção.
          attempts: UMA_TENTATIVA,
        }),
      );

      const terminada = await aguardarEstadoTerminal(fila, id);

      expect(await terminada.getState()).toBe('failed');
      // Razão não vazia, e que NOMEIA o campo: mensagem genérica não diz a quem opera o que faltou.
      expect(terminada.failedReason).toBeTypeOf('string');
      expect(terminada.failedReason.length).toBeGreaterThan(0);
      expect(terminada.failedReason).toContain("'valor'");

      // Sanidade obrigatória: é exatamente isto que um `processarEco` sem validação produziria —
      // resultado indefinido registrado como conclusão bem-sucedida.
      expect(terminada.returnvalue).toBeNull();
      expect((await fila.eco.getCompleted()).map((concluida) => concluida.id)).not.toContain(id);
      expect(await fila.eco.getCompletedCount()).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-003 — tarefa enfileirada sobrevive à queda e ao retorno do servidor de fila, e é consumida depois',
    async () => {
      // A montagem já derruba a instância preservando os dados, depois de asserir as duas
      // pré-condições da CA-10 (persistência habilitada e arquivo de dados no diretório).
      const { instancia, fila, id, valor } = await derrubarComTarefaEnfileirada();

      // Religa sobre o MESMO diretório de dados, na mesma porta.
      await instancia.religar();
      await aguardarReconexao(fila);

      const recuperada = await fila.eco.getJob(id);
      // O identificador é o que o servidor de fila atribuiu ANTES da queda, e a carga é a mesma.
      expect(recuperada?.id).toBe(id);
      expect(recuperada?.data).toEqual({ valor });
      expect(await fila.eco.getWaitingCount()).toBe(1);

      // Só agora o consumidor sobe: a tarefa que sobreviveu é consumida e concluída normalmente.
      fila.processar(processarEco);
      const terminada = await aguardarEstadoTerminal(fila, id);
      expect(await terminada.getState()).toBe('completed');
      expect(terminada.returnvalue).toBe(valor);

      // CA-7 — descarte sem resíduo: nem processo, nem diretório de dados.
      //
      // O DESFECHO é asserido aqui porque este é o caminho gracioso — servidor de fila de pé, cada
      // etapa devolvendo o seu recurso dentro do prazo. É o outro lado do discriminador que o CT-005
      // exercita: sem esta asserção, um encerramento que devolvesse SEMPRE 'PRAZO-ESTOURADO' passaria
      // despercebido, e todo desligamento normal terminaria por decisão própria registrando um
      // estouro falso (ver `instalarDesligamentoGracioso` em `apps/worker/src/main.ts`).
      expect(await fila.encerrar()).toBe('RECURSOS-DEVOLVIDOS');
      const pid = instancia.pid;
      await instancia.parar();
      expect(processoVivo(pid)).toBe(false);
      expect(existsSync(instancia.diretorioDados)).toBe(false);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-004 — durante a janela de queda, enfileirar falha com conexão recusada e não cria tarefa',
    async () => {
      // Mesma montagem do CT-003, parada no passo intermediário do ciclo: instância derrubada,
      // uma tarefa enfileirada antes da queda.
      const { instancia, fila, valor } = await derrubarComTarefaEnfileirada();

      // A porta da instância derrubada RECUSA conexão. O instrumento distingue recusa de tempo
      // esgotado — o segundo também ocorreria com o servidor vivo porém lento, e não provaria
      // encerramento nenhum.
      expect(await codigoAoConectar(instancia.porta)).toBe('ECONNREFUSED');

      const recusa = await enfileirarNaJanelaDeQueda(instancia.cadeiaConexao, `sonda-${valor}`);
      expect(recusa.erro.code).toBe('ECONNREFUSED');
      expect(recusa.decorridoMs).toBeLessThan(LIMITE_DE_ENFILEIRAMENTO_RECUSADO_MS);

      // Depois do religamento, a fila tem EXATAMENTE a tarefa de antes da queda: a tentativa
      // recusada não criou tarefa nenhuma.
      await instancia.religar();
      await aguardarReconexao(fila);
      expect(await fila.eco.getWaitingCount()).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-005 — com o servidor de fila fora do ar, o encerramento termina no prazo e devolve a conexão',
    async () => {
      const { instancia, fila, journal } = await montarFila();

      // -------------------------------------------------------------------------------------
      // O arranjo é FORÇADO, e não esperado — correção do flake registrado no fechamento da F1
      // -------------------------------------------------------------------------------------
      // A versão anterior derrubava o servidor e então SONDAVA até o cliente registrar cinco
      // falhas de conexão, na expectativa de que aquele estado fizesse `close()` deixar de
      // retornar. Era proxy, não precondição: o cabeçalho deste arquivo admitia que o travamento
      // acontecia "em cerca de metade das execuções" logo após a queda, e sob a concorrência do
      // Turbo o caso reprovou com `expected 'RECURSOS-DEVOLVIDOS' to be 'PRAZO-ESTOURADO'` — isto
      // é, o caminho gracioso RETORNOU e o caso deixou de observar o defeito que existe para
      // cortar. A `.claude/rules/testing-stack.md` é explícita: *"flaky é defeito"*.
      //
      // Agora a precondição é construída pelo próprio caso e é observável: um processador que
      // SINALIZA ter começado e então bloqueia numa promessa que só este teste resolve. Com uma
      // tarefa em voo, `consumidor.close()` **tem** de esperar — é o contrato que o próprio
      // `fila.ts` declara ("`close()` espera a tarefa em andamento terminar") —, de modo que o
      // caminho gracioso não retorna por construção, e não por sorte de temporização.
      //
      // O cenário do invariante é preservado: o servidor continua sendo derrubado de verdade
      // ANTES do pedido de encerramento, e a porta continua recusando conexão. O que mudou é só
      // a origem do travamento, que passou a ser determinística — e ela é, além disso, a situação
      // que a T7 de fato enfrenta no desligamento do sistema: uma tarefa em voo quando o
      // supervisor manda parar.
      //
      // SUT_IS_CORRECT_BECAUSE: a precondição antiga — enfileirar uma tarefa e afirmar
      // `getState() === 'completed'` — SAIU, e não podia sobreviver: ela provava que o consumidor
      // estava operando fazendo a tarefa TERMINAR, e o arranjo novo depende de a tarefa NÃO
      // terminar. Não é asserção do invariante deste caso, e sim arranjo: o invariante é o desfecho
      // do encerramento, e as asserções que o carregam ('PRAZO-ESTOURADO', a linha única de estouro
      // com nível/limite/fila, a devolução da conexão e a janela de quietude) estão todas
      // intactas abaixo. A precondição substituta é MAIS forte — `sondarAte(… tarefaEmVoo …)`
      // observa o consumidor DENTRO do processador, que é o estado de que `close()` depende, em vez
      // de observar que ele já saiu. E o término normal de tarefa segue asserido, nos casos que
      // existem para isso: **CT-001** (`expect(await terminada.getState()).toBe('completed')`) e
      // **CT-003**, que o reafirma depois da queda e do religamento do servidor. (Sem número de
      // linha de propósito: ele envelhece a cada edição deste arquivo, e um ponteiro defasado é o
      // que faz um auditor concluir que a justificativa é fraudulenta quando ela é boa.)
      let liberarTarefa: () => void = () => undefined;
      const tarefaBloqueada = new Promise<void>((resolver) => {
        liberarTarefa = resolver;
      });
      // Liberada ao fim do caso em QUALQUER desfecho: promessa pendente presa a um consumidor já
      // abandonado seguraria o encerramento do arquivo de teste.
      onTestFinished(() => {
        liberarTarefa();
      });

      let tarefaEmVoo = false;
      fila.processar(async (tarefa) => {
        tarefaEmVoo = true;
        await tarefaBloqueada;
        return tarefa.data.valor;
      });

      const valor = `eco-${randomUUID()}`;
      await fila.eco.add(NOME_FILA_ECO, { valor });

      // Sondagem por estado observável — o consumidor ENTROU no processador. É a precondição que
      // torna o travamento de `close()` certo, e ela é afirmada, não suposta.
      await sondarAte(
        'o consumidor entrar no processador e a tarefa ficar em voo',
        () => tarefaEmVoo,
        LIMITE_DE_ACOMODACAO_MS,
      );

      // Queda REAL do processo do servidor de fila, e a porta passa a RECUSAR conexão.
      await instancia.parar({ preservarDados: true });
      expect(await codigoAoConectar(instancia.porta)).toBe('ECONNREFUSED');

      const falhasDeConexao = (): number =>
        journal.eventos().filter((evento) => evento.mensagem === MENSAGEM_DE_FALHA_DE_CONEXAO)
          .length;

      const inicio = performance.now();
      const desfecho = await Promise.race([
        fila.encerrar(),
        expirarEm(
          LIMITE_DE_ENCERRAMENTO_OBSERVADO_MS,
          'o encerramento pedido com o servidor de fila fora do ar',
        ),
      ]);
      expect(performance.now() - inicio).toBeLessThan(LIMITE_DE_ENCERRAMENTO_OBSERVADO_MS);

      // O DESFECHO devolvido, e não só o tempo: terminar no prazo é metade da correção; a outra é
      // DIZER a quem pediu que a espera foi abandonada. É este valor que
      // `instalarDesligamentoGracioso` (`apps/worker/src/main.ts`) consome para terminar o processo
      // por decisão própria — devolver 'RECURSOS-DEVOLVIDOS' aqui deixaria o processo pendurado
      // exatamente como antes desta correção, com o journal negando o estouro.
      expect(desfecho).toBe('PRAZO-ESTOURADO');

      // E a linha que o operador lê: sem ela, ninguém sabe que uma tarefa em voo pode ter ficado
      // para trás. Uma só — o encerramento é pedido uma vez e desiste uma vez.
      const doEstouro = journal
        .eventos()
        .filter((evento) => evento.mensagem === MENSAGEM_DE_ESTOURO_DO_ENCERRAMENTO);
      expect(doEstouro).toHaveLength(1);
      expect(doEstouro[0]?.nivel).toBe('error');
      expect(doEstouro[0]?.limiteMs).toBe(PRAZO_DE_DESLIGAMENTO_DECLARADO_MS);
      expect(doEstouro[0]?.fila).toBe(NOME_FILA_ECO);

      // A conexão foi DEVOLVIDA, e não apenas deixada para trás. É o que distingue "o
      // encerramento retornou" de "o encerramento devolveu o que abriu": uma conexão de pé com
      // temporizador de reconexão ativo segura o laço de eventos e o processo não termina — e o
      // servidor continua fora do ar, de modo que ela seguiria registrando falha atrás de falha.
      // Depois de devolvida, o processo fica em SILÊNCIO.
      const falhasAoEncerrar = falhasDeConexao();
      await new Promise((resolver) => setTimeout(resolver, JANELA_DE_QUIETUDE_MS));
      expect(falhasDeConexao()).toBe(falhasAoEncerrar);
    },
    LIMITE_CASO_MS,
  );
});
