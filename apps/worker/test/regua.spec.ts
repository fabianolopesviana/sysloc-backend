/**
 * A **borda do trabalho automático da régua** — o job entra pela fila real, o contexto nasce da
 * carga, e a régua de UMA empresa corre. T8 da fatia `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-12    | CT-621 | Executado o job com o `empresaId` da empresa B, o conjunto de
 * |          |        | destinatários capturados é EXATAMENTE o dos locatários de B, a interseção
 * |          |        | com os de A é vazia, e a contagem crua de `envio_de_cobranca` sob A é
 * |          |        | idêntica à de antes — o contexto é aberto uma vez na borda, pelo escritor
 * |          |        | único, e a fronteira continua sendo do banco. |
 * | CA-10    | CT-622 | Repetido o job pela política da própria fila depois de a porta recusar a
 * |          |        | partir da quinta entrega, o total de entregas é EXATAMENTE o número de
 * |          |        | candidatas, o conjunto ordenado de códigos capturados é o das dez sem
 * |          |        | repetição, e `GROUP BY cobranca_id HAVING count(*) FILTER (WHERE
 * |          |        | desfecho='ENVIADA') > 1` devolve `0` linhas. As que falharam têm um
 * |          |        | `FALHOU` e um `ENVIADA`. |
 * | CA-10    | CT-622 | O companheiro que discrimina: com a única tentativa em `ENVIADA`, um job
 * |          | (b)    | novo dentro do intervalo NÃO entrega de novo (captura `0`, contagem crua
 * |          |        | inalterada) — é a trava contar só `ENVIADA` que torna a retentativa
 * |          |        | possível E a duplicação impossível. |
 * | CA-12    | CT-623 | Carga sem `empresaId`, e carga com valor que não é UUID, terminam em FALHA
 * | CA-03    |        | com razão contendo literalmente `empresaId`, não aparecem entre as
 * |          |        | concluídas, e a contagem crua permanece a de antes. O controle positivo —
 * |          |        | a carga válida — CONCLUI e produz capturas. |
 *
 * Rastreabilidade: `CA-12 → CT-621 (RD-10)` · `CA-10 → CT-622 (RD-08)` ·
 * `CA-12, CA-03 → CT-623 (RD-03)`.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO, e é isso que o caso existe para provar
 * ===========================================================================
 *
 * Nada aqui chama `processarReguaDeCobranca` diretamente. A tarefa é **enfileirada pela fila real**
 * e consumida pelo consumidor que `conectarFila().processar(…)` registra — a mesma fiação que
 * `apps/worker/src/main.ts` monta em operação, com a única diferença sendo qual implementação da
 * `PortaDeEnvioDeEmail` a composição injeta. Chamar a borda direto provaria a função; o que se quer
 * provar é o **caminho**, e é ele que carrega a decisão da ADR-0024.
 *
 * ⚠️ **O contexto de tenant NÃO é fixado por fora.** O arranjo semeia sob o contexto da empresa que
 * ele monta, e para o job ele entrega apenas a **carga**; quem abre o contexto do trabalho é a
 * borda, uma vez, pelo mesmo `contextoDeTenant.executarCom` da guarda HTTP. Se o teste fixasse
 * `app.empresa_id` por fora, o CT-621 passaria mesmo com a borda não abrindo contexto nenhum — que
 * é exatamente o defeito que ele existe para pegar.
 *
 * ===========================================================================
 * A ESPERA É POR SONDAGEM, com limite declarado no topo
 * ===========================================================================
 *
 * Nenhuma pausa fixa (`.claude/rules/testing-stack.md`): o que se espera é o **estado terminal da
 * tarefa**, observado no próprio servidor de fila. O CT-622 depende da repetição da fila, que tem
 * espera crescente declarada em `@sysloc/shared` — uma pausa fixa ou reprovaria por ser curta, ou
 * seria uma aposta sobre o relógio.
 *
 * ===========================================================================
 * A porta de saída, e por que ela NÃO é mock
 * ===========================================================================
 *
 * `criarCapturadorDeEmail` é **implementação** da porta que o domínio declarou, com a mesma
 * assinatura pela qual a produção é exercitada; o que ela substitui é o **destino da mensagem**,
 * nunca a lógica sob prova. O CT-622 acrescenta um invólucro que **recusa por faixa de tentativa** —
 * também implementação da mesma porta, e a única forma honesta de provar a repetição sem depender
 * de um servidor real quebrar na quinta mensagem e voltar na sexta.
 *
 * Este arquivo **não tem caminho para construir o adaptador de produção**, e isso é auditado de
 * fora: a barreira da CA-17 (`packages/db/test/barreira-de-envio.spec.ts`, `CT-626`) afirma por
 * igualdade que nenhum arquivo dos quatro diretórios de teste o alcança.
 *
 * ===========================================================================
 * De onde vêm o banco e a fila (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras **próprias**, descartadas ao fim. Nenhuma coordenada é lida do ambiente: a
 * cadeia do banco é a que `bancoEfemero()` devolve e a da fila é a que `redisEfemero()` devolve, e a
 * porta em uso é conferida contra a faixa efêmera antes do primeiro caso. **Nenhum `WHERE
 * empresa_id` é escrito neste arquivo**, nem nas contagens cruas: quem recorta é a política
 * (ADR-0008).
 */

import type { PoliticaDeAvisoNova } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  admitirEmpresa,
  ativarContrato,
  contextoDeTenant,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  derivarTerminoDaLocacao,
  derivarValorTotal,
  EMPRESA_A,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarPoliticaDeAviso,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
} from '@sysloc/db';
import {
  type CapturadorDeEmail,
  criarCapturadorDeEmail,
  type MensagemDeAviso,
  type PortaDeEnvioDeEmail,
} from '@sysloc/regua';
import { type CargaDaRegua, criarLogger, FILA_DA_REGUA } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaRegua } from '../src/fila.ts';
import { processarReguaDeCobranca } from '../src/tarefas/regua.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 150_000;

/** Cada caso monta cadastros, contratos e até dez cobranças, cada uma em unidades sequenciais. */
const LIMITE_DO_CASO_MS = 300_000;

/**
 * Limite para a tarefa alcançar estado terminal.
 *
 * Ele é folgado sobre a repetição da fila: com `attempts: 3` e espera crescente a partir de 1 s
 * (`OPCOES_PADRAO_DA_TAREFA`, em `@sysloc/shared`), a segunda passagem do CT-622 começa cerca de um
 * segundo depois da falha da primeira, e cada passagem percorre dez cobranças contra banco real.
 */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo enquanto o job corre. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo dos cenários — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** A política dos casos: ligada, janela que nunca fecha, trava de dois dias. */
const POLITICA_LIGADA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 2,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
};

/** Deslocamento de vencimento de uma cobrança ELEGÍVEL — vencida há poucos dias. */
const VENCIDA_RECENTE = -12;

/** Valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** Quantas candidatas o CT-622 lança — o número que o total de entregas tem de bater. */
const CANDIDATAS_DO_CT622 = 10;

/** A faixa de tentativas que a porta do CT-622 recusa: da quinta à décima, na primeira passagem. */
const PRIMEIRA_TENTATIVA_RECUSADA = 5;
const ULTIMA_TENTATIVA_RECUSADA = 10;

/** O diagnóstico com que a porta recusa a entrega — cadeia EXATA, e ela vira a `causa` gravada. */
const CAUSA_DA_RECUSA = 'conexão recusada pelo transporte';

/** Tentativas de uma tarefa que o CT-623 reduz — nas opções do ENFILEIRAMENTO, nunca em `fila.ts`. */
const UMA_TENTATIVA = 1;

/** O molde do código de cobrança dentro do assunto do aviso — como ligar captura a cobrança. */
const CODIGO_NO_ASSUNTO = /COB-\d{4}-\d{7}/;

/** O nome do campo que a razão da falha tem de nomear (ADR-0024). Cadeia EXATA. */
const CAMPO_DA_EMPRESA = 'empresaId';

/** Os termos do contrato de todo cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

/** A competência de todas as cobranças do arranjo — não participa do recorte. */
const COMPETENCIA = '2026-01-01';

/** O contexto da empresa da carga inicial — usado só para admitir as empresas dos cenários. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });

  instanciaDaFila = await redisEfemero();

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera de
  // T4. A conferência mais completa (contra a porta que `provisionar-base.sh` declara) mora em
  // `apps/worker/test/eco.spec.ts`, e não é recopiada aqui: cópias de um verificador divergem.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-621 — o job de uma empresa não alcança linha alguma da outra
// ===========================================================================

describe('CT-621 — o job da empresa B não alcança nada da empresa A', () => {
  it(
    'CT-621 — os destinatários capturados são só os de B, e a contagem crua de A não se move',
    async () => {
      const empresaA = await admitirEmpresaNova('isolamento-a');
      const empresaB = await admitirEmpresaNova('isolamento-b');

      // Duas carteiras equivalentes, com locatários próprios: fossem do mesmo cenário, um conjunto
      // de destinatários de um elemento não distinguiria "cada empresa pela sua" de "a régua mandou
      // tudo para o mesmo lugar".
      const deA = [
        await semearCenario('isolamento-a1', empresaA),
        await semearCenario('isolamento-a2', empresaA),
      ];
      const deB = [
        await semearCenario('isolamento-b1', empresaB),
        await semearCenario('isolamento-b2', empresaB),
      ];

      await gravarPolitica(empresaA, POLITICA_LIGADA);
      await gravarPolitica(empresaB, POLITICA_LIGADA);

      for (const cenario of [...deA, ...deB]) {
        await lancar(cenario, VENCIDA_RECENTE);
      }

      const enviosDeAAntes = await contarEnviosDeCobranca(empresaA);
      const enviosDeBAntes = await contarEnviosDeCobranca(empresaB);
      expect(enviosDeAAntes).toBe(0);
      expect(enviosDeBAntes).toBe(0);

      const capturador = criarCapturadorDeEmail();
      const fila = montarConsumidor(capturador);

      // Só o job de B é enfileirado. O de A não existe — e é isso que faz a asserção sobre a
      // contagem crua de A significar alguma coisa.
      const tarefa = await executarJob(fila, empresaB.empresaId);
      expect(await tarefa.getState()).toBe('completed');

      // O que SAIU: exatamente os endereços dos locatários de B, e a interseção com os de A vazia.
      const capturados = capturador.capturas.map((captura) => captura.destinatario).sort();
      const esperadosDeB = deB.map((cenario) => cenario.destinatario).sort();
      const enderecosDeA = deA.map((cenario) => cenario.destinatario);

      expect(capturados).toEqual(esperadosDeB);
      expect(capturados.filter((endereco) => enderecosDeA.includes(endereco))).toEqual([]);

      // O que foi GRAVADO: B cresce pelo número de candidatas dela; A permanece onde estava.
      expect(await contarEnviosDeCobranca(empresaB)).toBe(enviosDeBAntes + deB.length);
      expect(await contarEnviosDeCobranca(empresaA)).toBe(enviosDeAAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-622 — a repetição do job NÃO duplica aviso
// ===========================================================================

describe('CT-622 — a repetição do job não duplica aviso: a idempotência vem da trava', () => {
  it(
    'CT-622 — a fila repete depois da recusa da quinta entrega, e cada cobrança tem UM `ENVIADA`',
    async () => {
      const empresa = await admitirEmpresaNova('repeticao');
      const cenario = await semearCenario('repeticao', empresa);
      await gravarPolitica(empresa, POLITICA_LIGADA);

      const cobrancas: LinhaDeCobranca[] = [];
      for (let indice = 0; indice < CANDIDATAS_DO_CT622; indice += 1) {
        cobrancas.push(await lancar(cenario, VENCIDA_RECENTE - indice));
      }

      const capturador = criarCapturadorDeEmail();
      // A recusa é por FAIXA DE TENTATIVA, e não por endereço: as dez cobranças são do mesmo
      // locatário, e a recusa por endereço as recusaria todas para sempre. Da quinta à décima
      // tentativa — que é a primeira passagem inteira a partir da quinta candidata — a porta
      // rejeita; da décima primeira em diante ela entrega. É o que faz a segunda passagem
      // encontrar o transporte de pé sem que nada dentro do job saiba que houve repetição.
      const porta = portaQueRecusaNaFaixa(
        capturador,
        PRIMEIRA_TENTATIVA_RECUSADA,
        ULTIMA_TENTATIVA_RECUSADA,
      );
      const fila = montarConsumidor(porta);

      const tarefa = await executarJob(fila, empresa.empresaId);

      // A tarefa CONCLUI — na segunda passagem, depois de a primeira ter levantado. Uma tarefa que
      // terminasse `failed` significaria que a borda não levantou ao fim, ou que a repetição não
      // aconteceu, e as contagens abaixo passariam a descrever outra coisa.
      expect(await tarefa.getState()).toBe('completed');
      expect(tarefa.attemptsMade).toBeGreaterThan(1);

      // O total de entregas bem-sucedidas é EXATAMENTE o número de candidatas, e nenhum código
      // aparece duas vezes: as quatro da primeira passagem mais as seis da segunda.
      const codigos = codigosCapturados(capturador).sort();
      expect(codigos).toEqual(cobrancas.map((cobranca) => cobranca.codigo).sort());
      expect(codigos).toHaveLength(CANDIDATAS_DO_CT622);
      expect(new Set(codigos).size).toBe(CANDIDATAS_DO_CT622);

      // A asserção do card, escrita como consulta agrupada: nenhuma cobrança tem mais de um
      // `ENVIADA`. É ela que discrimina "a régua entregou dez vezes" de "a régua entregou dez
      // mensagens, uma por cobrança".
      expect(await cobrancasComEnviadaRepetida(empresa)).toEqual([]);

      // E a que falhou tem exatamente um `FALHOU` e um `ENVIADA` — o registro da falha sobrevive à
      // repetição, que é o que sustenta a auditoria do operador.
      const desfechosPorCobranca = await desfechosDeEnvio(empresa);
      const comFalha = desfechosPorCobranca.filter((linha) => linha.falhou > 0);

      expect(comFalha).toHaveLength(CANDIDATAS_DO_CT622 - (PRIMEIRA_TENTATIVA_RECUSADA - 1));
      for (const linha of comFalha) {
        expect(linha).toStrictEqual({ codigo: linha.codigo, enviada: 1, falhou: 1 });
      }
      // E as demais têm apenas o `ENVIADA` da primeira passagem.
      for (const linha of desfechosPorCobranca.filter((atual) => atual.falhou === 0)) {
        expect(linha).toStrictEqual({ codigo: linha.codigo, enviada: 1, falhou: 0 });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-622 (b) — com `ENVIADA` gravada, um job novo dentro do intervalo NÃO entrega de novo',
    async () => {
      // O companheiro que discrimina. Sem ele, o caso acima seria satisfeito por uma régua que
      // simplesmente entregasse tudo de novo e por sorte não repetisse código — e a afirmação
      // "a idempotência vem do predicado" não teria testemunha.
      const empresa = await admitirEmpresaNova('trava');
      const cenario = await semearCenario('trava', empresa);
      await gravarPolitica(empresa, POLITICA_LIGADA);
      await lancar(cenario, VENCIDA_RECENTE);

      const primeiro = criarCapturadorDeEmail();
      const filaDoPrimeiro = montarConsumidor(primeiro);
      expect(await (await executarJob(filaDoPrimeiro, empresa.empresaId)).getState()).toBe(
        'completed',
      );
      expect(primeiro.capturas).toHaveLength(1);
      const enviosDepoisDoPrimeiro = await contarEnviosDeCobranca(empresa);
      expect(enviosDepoisDoPrimeiro).toBe(1);

      const segundo = criarCapturadorDeEmail();
      const filaDoSegundo = montarConsumidor(segundo);
      expect(await (await executarJob(filaDoSegundo, empresa.empresaId)).getState()).toBe(
        'completed',
      );

      // Nada saiu, e nada foi gravado: a cobrança caiu FORA do conjunto de candidatas porque tem
      // uma tentativa `ENVIADA` dentro do intervalo mínimo. Nenhuma guarda foi escrita para isso.
      expect(segundo.capturas).toEqual([]);
      expect(await contarEnviosDeCobranca(empresa)).toBe(enviosDepoisDoPrimeiro);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-623 — o job sem `empresaId` FALHA nomeando o campo
// ===========================================================================

describe('CT-623 — carga inválida falha nomeando o campo, e nunca roda sem contexto', () => {
  it(
    'CT-623 — as duas cargas inválidas FALHAM nomeando `empresaId`; o controle válido conclui',
    async () => {
      const empresa = await admitirEmpresaNova('carga');
      const cenario = await semearCenario('carga', empresa);
      await gravarPolitica(empresa, POLITICA_LIGADA);
      await lancar(cenario, VENCIDA_RECENTE);

      const enviosAntes = await contarEnviosDeCobranca(empresa);
      expect(enviosAntes).toBe(0);

      const capturador = criarCapturadorDeEmail();
      const fila = montarConsumidor(capturador);

      // --- As duas cargas inválidas ---------------------------------------------------------
      const invalidas = [{}, { empresaId: 'nao-e-uuid' }];
      const falhadas: TarefaDaRegua[] = [];

      for (const carga of invalidas) {
        falhadas.push(await executarJob(fila, carga as unknown as CargaDaRegua, UMA_TENTATIVA));
      }

      for (const tarefa of falhadas) {
        expect(await tarefa.getState()).toBe('failed');
        // A razão NOMEIA o campo: mensagem genérica não diz a quem opera o que faltou, e é essa
        // cadeia que a borda publica.
        expect(tarefa.failedReason).toBeTypeOf('string');
        expect(tarefa.failedReason).toContain(CAMPO_DA_EMPRESA);
      }

      const concluidas = (await fila.regua.getCompleted()).map((tarefa) => tarefa.id);
      for (const tarefa of falhadas) {
        expect(concluidas).not.toContain(tarefa.id);
      }

      // Nada saiu e nada foi gravado — em particular, a régua NÃO rodou sem contexto devolvendo
      // conjunto vazio como se fosse sucesso, que é o pior desfecho possível.
      expect(capturador.capturas).toEqual([]);
      expect(await contarEnviosDeCobranca(empresa)).toBe(enviosAntes);

      // --- O controle positivo, obrigatório -------------------------------------------------
      // Sem ele, o caso seria satisfeito por um consumidor que falha sempre.
      const controle = await executarJob(fila, empresa.empresaId);

      expect(await controle.getState()).toBe('completed');
      expect(capturador.capturas).toHaveLength(1);
      expect(await contarEnviosDeCobranca(empresa)).toBe(enviosAntes + 1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a fiação da operação, o arranjo e as leituras cruas
// ---------------------------------------------------------------------------

interface Contexto {
  readonly empresaId: string;
}

/** Um cenário montado: o contrato ativo e o contato do locatário que a junção projeta. */
interface Cenario {
  readonly contexto: Contexto;
  readonly contratoId: string;
  readonly destinatario: string;
}

/**
 * Conecta a fila real e registra o consumidor da régua com a porta de saída informada.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais `processar(fila.regua, …)`,
 * com a borda recebendo o acesso ao banco e a porta de e-mail por parâmetro. A única diferença é
 * qual implementação da porta a composição injeta — e é justamente essa a diferença que a operação
 * também tem entre si mesma e a verificação.
 *
 * Uma fila por caso, e não uma por arquivo: cada caso precisa da sua porta de saída, e um consumidor
 * compartilhado obrigaria a porta a virar variável mutável — um seam que este arquivo não abre.
 */
function montarConsumidor(email: PortaDeEnvioDeEmail): Fila {
  const logger = criarLogger({
    nivel: 'info',
    destino: {
      write(): void {
        // O registro é descartado: este arquivo assere o EFEITO da passagem (o que saiu e o que foi
        // gravado), e não a linha do journal — quem faz isso é `eco.spec.ts`. Descartar, em vez de
        // deixar o padrão, mantém a saída da suíte legível.
      },
    },
  });

  const fila = conectarFila(instanciaDaFila.cadeiaConexao, logger);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.regua,
    async (tarefa, registrador) =>
      await processarReguaDeCobranca(tarefa, registrador, { banco: acesso, email }),
  );

  return fila;
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` — que é onde a tarefa
 * fica entre as tentativas do CT-622 — **não** encerram a espera, e é essa distinção que faz o caso
 * observar o desfecho depois da repetição, e não o da primeira passagem.
 */
async function executarJob(
  fila: Fila,
  carga: CargaDaRegua | string,
  tentativas?: number,
): Promise<TarefaDaRegua> {
  const util: CargaDaRegua = typeof carga === 'string' ? { empresaId: carga } : carga;
  const enfileirada = await fila.regua.add(
    FILA_DA_REGUA,
    util,
    tentativas === undefined ? {} : { attempts: tentativas },
  );
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.regua.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.regua.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * A porta que recusa a entrega numa **faixa declarada de tentativas**.
 *
 * Ela é implementação da `PortaDeEnvioDeEmail`, como o capturador que ela envolve: a falha entra
 * pela mesma interface da produção, e o domínio não sabe que foi provocada. A recusa **não** entra
 * em `capturas`, porque a lista responde *"o que saiu"* — quem garante isso é o próprio capturador,
 * que só é chamado fora da faixa.
 */
function portaQueRecusaNaFaixa(
  capturador: CapturadorDeEmail,
  primeira: number,
  ultima: number,
): PortaDeEnvioDeEmail {
  let tentativas = 0;

  return {
    async enviar(destinatario: string, mensagem: MensagemDeAviso): Promise<void> {
      tentativas += 1;

      if (tentativas >= primeira && tentativas <= ultima) {
        throw new Error(CAUSA_DA_RECUSA);
      }

      await capturador.enviar(destinatario, mensagem);
    },
  };
}

/**
 * Os códigos das cobranças cujo aviso SAIU, lidos do **assunto da mensagem entregue**.
 *
 * Não de uma lista mantida pelo teste: é o que liga a captura à cobrança pelo conteúdo entregue, e é
 * o que faria uma régua que compõe o aviso de uma cobrança e o manda para outra reprovar.
 */
function codigosCapturados(capturador: CapturadorDeEmail): string[] {
  return capturador.capturas.map((captura) => {
    const achado = CODIGO_NO_ASSUNTO.exec(captura.mensagem.assunto);

    if (achado === null) {
      throw new Error(
        `o assunto capturado não traz código de cobrança: ${captura.mensagem.assunto}`,
      );
    }

    return achado[0];
  });
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par da operação. Ele monta o estado; **nunca** o contexto do job,
 * que nasce na borda a partir da carga.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marcaBase: string): Promise<Contexto> {
  sequenciaDoCenario += 1;

  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marcaBase}-${String(sequenciaDoCenario)}`,
        documento: `${String(Date.now()).slice(-8)}${String(sequenciaDoCenario).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marcaBase}`);
  }

  return { empresaId: criada.id };
}

/** Grava a política pela porta de produção — o mesmo caminho que a rota usa por dentro. */
async function gravarPolitica(contexto: Contexto, politica: PoliticaDeAvisoNova): Promise<void> {
  await emUnidade(contexto, async (tx) => await gravarPoliticaDeAviso(tx, politica));
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 60_000_000_000;

function pessoaDe(nome: string, email: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Cria os cadastros e um contrato **ATIVO** na empresa informada, pelas portas públicas.
 *
 * Mesmo desenho de `packages/db/test/execucao-da-regua.spec.ts`: o contrato é ativado pelo protocolo
 * das duas unidades sequenciais que a borda usa — a primeira garante o contador e commita, a segunda
 * emite o número e grava. Cada cenário tem locatário próprio, com endereço de contato próprio: é o
 * que faz a asserção do CT-621 sobre destinatários discriminar quem recebeu o quê.
 */
async function semearCenario(marcaBase: string, contexto: Contexto): Promise<Cenario> {
  sequenciaDoCenario += 1;
  const marca = `${marcaBase}-${String(sequenciaDoCenario)}`;
  const contato = `locatario-${marca}@exemplo.invalid`;

  const cadastros = await emUnidade(contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });

    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
      tipoImovel: 'RESIDENCIAL',
      logradouro: 'Rua das Acácias',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000000',
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`, contato));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`, contato));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const ano = await emUnidade(contexto, lerAnoDaSerieDeContrato);

  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  const contrato = await emUnidade(contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano, numero },
    );
  });

  await emUnidade(contexto, async (tx) => {
    const ativado = await ativarContrato(tx, contrato.codigo, {
      dataFimLocacao: derivarTerminoDaLocacao(
        TERMOS_DO_CONTRATO.dataInicioLocacao,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
      valorTotalContrato: derivarValorTotal(
        TERMOS_DO_CONTRATO.valorMensal,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
    });

    if (ativado === undefined) {
      throw new Error(`o arranjo não conseguiu ativar o contrato ${contrato.codigo}`);
    }
  });

  return { contexto, contratoId: contrato.id, destinatario: contato };
}

/**
 * Lança uma cobrança pelo protocolo das **duas unidades sequenciais** da série (ADR-0015).
 *
 * O vencimento é derivado de `negocio.data_corrente_da_operacao()` por deslocamento — **nunca** de
 * um `new Date()` do processo. É a mesma disciplina que o `CT-612` audita no fonte de produção.
 */
async function lancar(cenario: Cenario, diasAteVencimento: number): Promise<LinhaDeCobranca> {
  const ano = await emUnidade(cenario.contexto, lerAnoDaSerieDeCobranca);
  const dataVencimento = await dataDeslocada(cenario.contexto, diasAteVencimento);

  await emUnidade(cenario.contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, ano);
  });

  return await emUnidade(cenario.contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);

    return await criarCobranca(
      tx,
      {
        contratoId: cenario.contratoId,
        natureza: 'ALUGUEL',
        referencia: 'Aluguel de janeiro/2026',
        competencia: COMPETENCIA,
        dataVencimento,
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano, numero },
    );
  });
}

/** A data corrente da operação deslocada em `dias`, como cadeia `AAAA-MM-DD`. */
async function dataDeslocada(contexto: Contexto, dias: number): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/**
 * Quantas linhas de `negocio.envio_de_cobranca` o contexto corrente alcança.
 *
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008). O ramo
 * impossível levanta em vez de virar zero, que é justamente um dos valores esperados.
 */
async function contarEnviosDeCobranca(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.envio_de_cobranca
    `;

    if (linha === undefined) {
      throw new Error('a contagem crua de envio_de_cobranca não devolveu linha');
    }

    return Number.parseInt(linha.total, 10);
  });
}

interface DesfechosDaCobranca {
  readonly codigo: string;
  readonly enviada: number;
  readonly falhou: number;
}

/** Os desfechos agrupados por cobrança, sob o contexto corrente — a auditoria do CT-622. */
async function desfechosDeEnvio(contexto: Contexto): Promise<DesfechosDaCobranca[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ codigo: string; enviada: string; falhou: string }[]>`
      SELECT c.codigo,
             count(*) FILTER (WHERE ec.desfecho = 'ENVIADA') AS enviada,
             count(*) FILTER (WHERE ec.desfecho = 'FALHOU') AS falhou
        FROM negocio.envio_de_cobranca ec
        JOIN negocio.cobranca c ON c.id = ec.cobranca_id
       GROUP BY c.codigo
       ORDER BY c.codigo
    `;

    return linhas.map((linha) => ({
      codigo: linha.codigo,
      enviada: Number.parseInt(linha.enviada, 10),
      falhou: Number.parseInt(linha.falhou, 10),
    }));
  });
}

/**
 * As cobranças com mais de um `ENVIADA` — a consulta literal que o card do CT-622 declara.
 *
 * Ela devolve **linhas**, e não um booleano: o modo de falha desejado nomeia a cobrança duplicada,
 * e não apenas informa que houve duplicação.
 */
async function cobrancasComEnviadaRepetida(contexto: Contexto): Promise<string[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ cobrancaId: string }[]>`
      SELECT cobranca_id AS "cobrancaId"
        FROM negocio.envio_de_cobranca
       GROUP BY cobranca_id
      HAVING count(*) FILTER (WHERE desfecho = 'ENVIADA') > 1
    `;

    return linhas.map((linha) => linha.cobrancaId);
  });
}
