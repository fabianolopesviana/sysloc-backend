/**
 * A **borda da tarefa de conferência bancária** — o job entra pela fila real, o contexto nasce da
 * carga, e a apuração de UMA empresa corre. T16 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-15    | CT-948 | Executado o job com o `empresaId` e o `conferenciaId` da empresa A, a
 * |          |        | conferência de A fecha com `concluida_em` não nulo e as duas contagens
 * |          |        | gravadas, as cobranças de A ficam pagas, e a empresa B — que tem
 * |          |        | conferência aberta e carteira equivalente — permanece intocada: a
 * |          |        | conferência dela segue com `concluida_em` NULO e nenhuma cobrança dela foi
 * |          |        | paga. O contexto é aberto uma vez na borda, pelo escritor único. |
 * | CA-15    | CT-948 | Carga sem `empresaId`, carga com `empresaId` que não é UUID e carga com
 * |          | (b)    | campo extra terminam em FALHA com razão contendo literalmente o nome do
 * |          |        | campo recusado — `empresaId` nas duas primeiras, a chave excedente na
 * |          |        | terceira —, não aparecem entre as concluídas, e a contagem de conferências
 * |          |        | concluídas permanece a de antes (**delta `0`**). Nenhuma das três razões
 * |          |        | ecoa o VALOR recebido. O controle positivo conclui e produz efeitos. |
 * | CA-15    | CT-948 | A empresa **sem certificado vigente** tem a conferência CONCLUÍDA com
 * |          | (c)    | `{0, 0}`, nada é perguntado ao provedor, nenhuma cobrança é paga, a tarefa
 * |          |        | termina `completed` — e uma NOVA `abrirConferencia` devolve
 * |          |        | `iniciadaAgora: true`, que é a única asserção que prova que o índice único
 * |          |        | parcial foi devolvido à empresa. |
 * | CA-15    | CT-948 | Na SEGUNDA ativação, o fecho que não alcança a linha termina `completed` e
 * |          | (d)    | **preserva** as contagens já gravadas; na PRIMEIRA, termina `failed`
 * |          |        | nomeando a recusa. O par é o que impede o `catch` em bloco proibido pelo
 * |          |        | cabeçalho da borda. |
 * | CA-20    | CT-948 | Com o erro subindo **enquanto o claro está em escopo**, nem o arquivo de
 * |          | (e)    | diário INTEIRO do processo nem o `failedReason` gravado no servidor de fila
 * |          |        | carregam a senha, o material em base64 ou o recorte hexadecimal de
 * |          |        | **qualquer** segredo que este arquivo cifrou — enquanto o mesmo varredor
 * |          |        | acha todas as agulhas no controle positivo, canal a canal, por igualdade. |
 *
 * Rastreabilidade: `CA-15 → CT-948 (RN-11)` · `CA-20 → CT-948 (e)` (ADR-0032). Ele é o **espelho do CT-944** para a segunda borda, com
 * o mesmo invariante e a mesma âncora antivácuo — ver o cabeçalho daquele arquivo para as razões que
 * valem palavra por palavra aqui: o caminho é o da operação (nada chama a borda direto), o contexto
 * **não** é fixado por fora, o certificado é resolvido **pelo banco** e a espera é por sondagem.
 *
 * ⚠️ **O que é próprio deste arquivo** é o modo de falha que ele fecha: a conferência que corre sem
 * contexto seleciona conjunto vazio, conclui com `cobrancasConferidas: 0` e **parece ter apurado** —
 * com o agravante de que a conferência é o caminho por onde o produto descobre pagamento feito fora
 * dele. As asserções sobre B, e o delta `0` depois de cada recusa, são o que discrimina *"apurou sob
 * o contexto de A"* de *"correu sem contexto e não achou nada"*.
 *
 * ===========================================================================
 * O QUE O `CT-948 (e)` MEDE, e por que ele não podia faltar (ADR-0032)
 * ===========================================================================
 *
 * Vale aqui, palavra por palavra, a seção homônima de `./emissao-em-lote.spec.ts` — leia-a lá. Em
 * resumo: a T16 fez este processo **decifrar o segredo operável**, e com isso abriu **duas**
 * superfícies de saída novas para o claro, ambas alcançadas pelo vetor que originou a ADR-0032 (o
 * `consumidor.on('failed', … { erro })` de `apps/worker/src/fila.ts`, que registra o **objeto de
 * exceção cru**): o **diário do processo** e o **`failedReason` gravado no servidor de fila**.
 * Enquanto o registrador deste arquivo tinha destino que **descartava** a saída, nenhuma das duas era
 * observável, e a garantia ficava afirmada por leitura do código — o método que a `Decision` proíbe.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import {
  type AdaptadorCobrancaBancaria,
  type ConsultaDeSituacao,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirConferencia,
  concluirConferencia,
  contextoDeTenant,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  EMPRESA_B,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarBoletoDaCobranca,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  revogarBoleto,
  selecionarCobrancasAConferir,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import {
  type CargaDaConferenciaBancaria,
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  FILA_DA_CONFERENCIA_BANCARIA,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/db` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` daqueles manifestos.
// QUANDO FECHA: declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`,
//        ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaConferenciaBancaria } from '../src/fila.ts';
import { processarConferenciaBancaria } from '../src/tarefas/conferencia-bancaria.ts';
import {
  agulhasDoSegredo,
  controleComAsAgulhas,
  esvaziarDiario,
  ocorrenciasDe,
  rotulosDoControle,
  type SegredoDoArranjo,
  superficiesDoDiario,
} from './varredura-de-segredo.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso monta cadastros, cobranças com boleto e percorre a apuração em unidades sequenciais. */
const LIMITE_DO_CASO_MS = 180_000;

/** Limite para a tarefa alcançar estado terminal, folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo enquanto o job corre. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** A competência das cobranças — primeiro dia do mês, como o `check` do banco exige. */
const COMPETENCIA = '2026-04-01';

/** Quantas cobranças com boleto cada empresa recebe. */
const COBRANCAS_POR_EMPRESA = 2;

/** O valor de cada cobrança, em reais — e o que o provedor informa como pago, sem divergência. */
const VALOR_DA_COBRANCA = 1000;

/** O que o arranjo antepõe aos bytes do boleto, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** O nome do campo que a razão da falha tem de nomear (ADR-0024). Cadeia EXATA. */
const CAMPO_DA_EMPRESA = 'empresaId';

/** A chave excedente do terceiro cenário — a que o `strictObject` tem de nomear na recusa. */
const CHAVE_EXCEDENTE = 'senha';

/** O valor da chave excedente — sentinela: nenhuma razão de falha pode contê-lo. */
const VALOR_DA_CHAVE_EXCEDENTE = 'senha-que-nao-pode-vazar';

/** O `empresaId` que não é UUID — sentinela do segundo cenário, pela mesma razão. */
const EMPRESA_QUE_NAO_E_UUID = 'nao-e-uuid-empresa-sentinela';

/** Tentativas de uma tarefa que os cenários inválidos reduzem — nas opções do ENFILEIRAMENTO. */
const UMA_TENTATIVA = 1;

/** Duas tentativas — o `CT-948 (d)` precisa da SEGUNDA ativação para exercitar a reentrância. */
const DUAS_TENTATIVAS = 2;

/**
 * Quantos bytes sorteados o material do certificado do arranjo carrega além do prefixo legível.
 *
 * Sessenta e quatro, e não uma dezena: o recorte hexadecimal das agulhas sai da **metade** do
 * material, e um cofre curto demais faria o acessório recusar o recorte.
 */
const BYTES_DO_MATERIAL = 64;

/** Quantas agulhas cada segredo do arranjo produz — senha, material em base64 e recorte hexadecimal. */
const AGULHAS_POR_SEGREDO = 3;

/** A mensagem com que o adaptador do `CT-948 (e)` levanta — nenhum segredo nela, de propósito. */
const FALHA_DO_ADAPTADOR = 'o par remoto encerrou o aperto de mão antes da resposta';

/** A mensagem que `fila.ts` emite ao registrar o objeto de exceção CRU de uma tarefa que falhou. */
const REGISTRO_DA_TAREFA_EM_FALHA = 'tarefa terminou em falha';

/**
 * A mensagem que `ErroDeConferenciaNaoAlcancada` compõe — cadeia EXATA.
 *
 * Ela discrimina a recusa do fecho de uma falha de driver qualquer, e é o que o operador lê no
 * `failedReason` quando a conferência não foi alcançada na **primeira** ativação da tarefa.
 */
const RECUSA_DO_FECHO = 'a conferência foi concluída e não foi alcançada';

/** As contagens com que a borda fecha a conferência da empresa sem certificado vigente. */
const CONFERENCIA_SEM_PASSADA = { concluida: true, cobrancasConferidas: 0, efeitos: 0 } as const;

/** Os termos do contrato de apoio — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let diretorioDosBoletos: string;
let arquivoDoDiario: string;

/**
 * O registrador que **todos** os consumidores deste arquivo recebem, com destino em ARQUIVO.
 *
 * Ele é **um só** de propósito: as linhas de todos os casos se acumulam no mesmo arquivo, e é isso
 * que faz a varredura do `CT-948 (e)` alcançar o diário **inteiro** — inclusive o caminho de sucesso
 * dos casos anteriores, em que o claro do certificado também esteve em escopo.
 */
let registrador: Logger;

/**
 * As agulhas de **todo** segredo que este arquivo cifrou e gravou, acumuladas cenário a cenário.
 *
 * O `CT-948 (e)` varre o arquivo de diário inteiro contra este mapa, e não apenas contra o segredo do
 * cenário dele: o diário guarda as linhas de todos os casos, e olhar por menos do que circulou seria
 * medir menos do que a ADR-0032 cobra.
 */
const agulhasDoArranjo: Record<string, string> = {};

/** A chave que a composição raiz entrega à borda — 32 bytes sorteados por execução, nunca literal. */
const CHAVE_DE_CIFRA = randomBytes(32);

/** O contador que mantém documentos, códigos e títulos distintos entre os cenários. */
let sequencia = 0;

/** A data que o provedor informa como a do pagamento — derivada do relógio do BANCO na subida. */
let DATA_DO_PAGAMENTO: string;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-boletos-ct948-'));

  // O DESTINO DO REGISTRADOR É UM ARQUIVO, e é isso que torna o `CT-948 (e)` uma medição do diário do
  // processo real em vez de uma inspeção de memória. O caminho é o legítimo — o mesmo parâmetro
  // `destino` que a unidade systemd usa em operação (`packages/shared/test/log.spec.ts`).
  //
  // ⚠️ **O destino que DESCARTA a saída, que este arquivo usava, tornava a ADR-0032 inauditável aqui**:
  // as duas superfícies de saída que a T16 abriu para o claro — o diário e o `failedReason` — não
  // tinham como ser observadas, e a ausência de vazamento ficava afirmada por LEITURA DO CÓDIGO, que é
  // o método que a `Decision` proíbe.
  arquivoDoDiario = join(mkdtempSync(join(tmpdir(), 'sysloc-diario-ct948-')), 'eventos.log');
  registrador = criarLogger({ nivel: 'info', destino: arquivoDoDiario });

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

  // O pagamento fica confortavelmente dentro da janela de 30 dias do predicado de seleção, e a data
  // sai do relógio do BANCO (ADR-0026) — nunca de `new Date()` do processo.
  DATA_DO_PAGAMENTO = await dataDeslocada(EMPRESA_A.id, -5);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-948 — o job de uma empresa não alcança a conferência nem a carteira da outra
// ===========================================================================

describe('CT-948 — o contexto nasce da carga, e o job de A não alcança nada de B', () => {
  it(
    'CT-948 — a conferência de A fecha sob o contexto de A, e B permanece intocada',
    async () => {
      const cenarioA = await semearCenario(EMPRESA_A.id);
      const cenarioB = await semearCenario(EMPRESA_B.id);

      expect(await conferenciasConcluidas(cenarioA.empresaId)).toBe(0);
      expect(await conferenciasConcluidas(cenarioB.empresaId)).toBe(0);

      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      // Só o job de A é enfileirado. O de B não existe — e é isso que faz a asserção sobre B
      // significar alguma coisa.
      const tarefa = await executarJob(fila, {
        empresaId: cenarioA.empresaId,
        conferenciaId: cenarioA.conferenciaId,
      });

      expect(await tarefa.getState()).toBe('completed');

      // O que foi PERGUNTADO ao provedor: exatamente os títulos de A, e nenhum de B.
      expect(
        adaptador.consultas.map((consulta) => consulta.numeroDoTituloNoProvedor).sort(),
      ).toEqual([...cenarioA.titulos].sort());
      // E a empresa que a borda apresentou ao provedor é a da CARGA, em toda chamada.
      expect([...new Set(adaptador.consultas.map((consulta) => consulta.empresaId))]).toEqual([
        cenarioA.empresaId,
      ]);

      // O que foi GRAVADO em A: a conferência fechada, com as duas contagens.
      const conferenciaDeA = await lerConferencia(cenarioA.empresaId, cenarioA.conferenciaId);
      expect(conferenciaDeA).toEqual({
        concluida: true,
        cobrancasConferidas: COBRANCAS_POR_EMPRESA,
        efeitos: COBRANCAS_POR_EMPRESA,
      });
      expect(await cobrancasPagas(cenarioA.empresaId)).toEqual([...cenarioA.codigos].sort());

      // B não se moveu: a conferência dela segue ABERTA e nenhuma cobrança dela foi paga. É esta
      // asserção que discrimina "apurou sob o contexto de A" de "correu sob contexto nenhum".
      expect(await lerConferencia(cenarioB.empresaId, cenarioB.conferenciaId)).toEqual({
        concluida: false,
        cobrancasConferidas: 0,
        efeitos: 0,
      });
      expect(await cobrancasPagas(cenarioB.empresaId)).toEqual([]);
      expect(await conferenciasConcluidas(cenarioB.empresaId)).toBe(0);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-948 (b) — as três cargas inválidas FALHAM nomeando o campo, e nada é concluído',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id);

      // A contagem de ANTES é lida, e não afirmada como zero: a empresa A é a mesma do caso anterior,
      // e o que este caso mede é o **delta**.
      const concluidasAntes = await conferenciasConcluidas(cenario.empresaId);

      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      // As três cargas inválidas, com o campo que cada razão tem de nomear declarado ANTES da
      // execução. A terceira é a chave excedente: `strictObject` RECUSA o que veio a mais — e o nome
      // escolhido é `senha` de propósito, porque é exatamente o campo que alguém acrescentaria "para
      // o processo de trabalho não precisar consultar o banco" (ADR-0032).
      const cenarios = [
        {
          rotulo: 'sem empresaId',
          carga: { conferenciaId: cenario.conferenciaId },
          nomeado: CAMPO_DA_EMPRESA,
        },
        {
          rotulo: 'empresaId que não é UUID',
          carga: { empresaId: EMPRESA_QUE_NAO_E_UUID, conferenciaId: cenario.conferenciaId },
          nomeado: CAMPO_DA_EMPRESA,
        },
        {
          rotulo: 'campo extra além dos dois',
          carga: {
            empresaId: cenario.empresaId,
            conferenciaId: cenario.conferenciaId,
            [CHAVE_EXCEDENTE]: VALOR_DA_CHAVE_EXCEDENTE,
          },
          nomeado: CHAVE_EXCEDENTE,
        },
      ];

      const falhadas: TarefaDaConferenciaBancaria[] = [];
      for (const { carga } of cenarios) {
        falhadas.push(
          await executarJob(fila, carga as unknown as CargaDaConferenciaBancaria, UMA_TENTATIVA),
        );
      }

      for (const [indice, { rotulo, nomeado }] of cenarios.entries()) {
        const tarefa = falhadas[indice];
        expect(tarefa, rotulo).toBeDefined();
        expect(await tarefa?.getState(), rotulo).toBe('failed');
        expect(tarefa?.failedReason, rotulo).toBeTypeOf('string');
        expect(tarefa?.failedReason, rotulo).toContain(nomeado);
        // E NUNCA o valor: a razão fica gravada no servidor de fila e alcança o journal.
        expect(tarefa?.failedReason, rotulo).not.toContain(VALOR_DA_CHAVE_EXCEDENTE);
        expect(tarefa?.failedReason, rotulo).not.toContain(EMPRESA_QUE_NAO_E_UUID);
      }

      const concluidas = (await fila.conferenciaBancaria.getCompleted()).map((tarefa) => tarefa.id);
      for (const tarefa of falhadas) {
        expect(concluidas).not.toContain(tarefa.id);
      }

      // Nada foi perguntado ao provedor e nada foi concluído — em particular, a apuração NÃO rodou
      // sem contexto fechando a conferência como se ela tivesse acontecido.
      expect(adaptador.consultas).toEqual([]);
      expect(await conferenciasConcluidas(cenario.empresaId)).toBe(concluidasAntes);
      expect(await lerConferencia(cenario.empresaId, cenario.conferenciaId)).toEqual({
        concluida: false,
        cobrancasConferidas: 0,
        efeitos: 0,
      });

      // --- O controle positivo, obrigatório -------------------------------------------------
      // Sem ele, o caso seria satisfeito por um consumidor que falha sempre.
      const controle = await executarJob(fila, {
        empresaId: cenario.empresaId,
        conferenciaId: cenario.conferenciaId,
      });

      expect(await controle.getState()).toBe('completed');
      expect(adaptador.consultas).toHaveLength(COBRANCAS_POR_EMPRESA);
      expect(await conferenciasConcluidas(cenario.empresaId)).toBe(concluidasAntes + 1);
      expect(await lerConferencia(cenario.empresaId, cenario.conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: COBRANCAS_POR_EMPRESA,
        efeitos: COBRANCAS_POR_EMPRESA,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-948 (c) — a empresa SEM certificado vigente: conferência CONCLUÍDA com zero
// ===========================================================================

describe('CT-948 (c) — sem certificado vigente, a conferência conclui com zero e devolve o índice', () => {
  it(
    'CT-948 (c) — concluida_em deixa de ser nulo com {0,0}, nada é perguntado, e a empresa volta a poder abrir',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, { comCertificado: false });
      const concluidasAntes = await conferenciasConcluidas(cenario.empresaId);
      // As pagas de ANTES são lidas, e não afirmadas como vazias: a empresa A é a mesma dos casos
      // anteriores, e o que este caso mede é o **delta**.
      const pagasAntes = await cobrancasPagas(cenario.empresaId);

      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(fila, {
        empresaId: cenario.empresaId,
        conferenciaId: cenario.conferenciaId,
      });

      expect(await tarefa.getState()).toBe('completed');

      // NADA foi perguntado ao provedor: a ausência do certificado é reconhecida ANTES da decifra e
      // antes da rede.
      expect(adaptador.consultas).toEqual([]);

      // A CONFERÊNCIA FECHA COM ZERO — e é o par de contagens que diz "a apuração não percorreu nada
      // e não mudou nada", em vez de deixar a linha para sempre com `concluida_em` nulo.
      expect(await lerConferencia(cenario.empresaId, cenario.conferenciaId)).toEqual(
        CONFERENCIA_SEM_PASSADA,
      );
      expect(await conferenciasConcluidas(cenario.empresaId)).toBe(concluidasAntes + 1);
      // Nenhuma cobrança foi tocada: concluir com zero não é liquidar em silêncio.
      expect(await cobrancasPagas(cenario.empresaId)).toEqual(pagasAntes);

      // ⚠️ E ESTA é a asserção pela qual a decisão de projeto se justifica, e a ÚNICA que prova que o
      // índice único parcial `(empresa_id) WHERE concluida_em IS NULL` foi DEVOLVIDO à empresa: uma
      // nova abertura nasce agora, em vez de reencontrar a presa. Sem ela, o Admin receberia
      // `iniciadaAgora: false` indefinidamente e sem caminho pela interface — que é exatamente o custo
      // medido que fez a borda concluir em vez de deixar o erro subir.
      const seguinte = await emUnidade(
        cenario.empresaId,
        async (tx) =>
          await abrirConferencia(tx, { solicitadaPor: exigirUsuarioDa(cenario.empresaId).id }),
      );

      expect(seguinte.iniciadaAgora).toBe(true);
      expect(seguinte.id).not.toBe(cenario.conferenciaId);

      // Limpeza do ARRANJO, e não asserção: a conferência recém-aberta seguraria o índice único
      // parcial e faria o `semearCenario` do caso seguinte recusar.
      await emUnidade(cenario.empresaId, async (tx) => {
        await concluirConferencia(tx, seguinte.id, { cobrancasConferidas: 0, efeitos: 0 });
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-948 (d) — o discriminador da reentrância: a REATIVAÇÃO conclui, a PRIMEIRA sobe
// ===========================================================================

describe('CT-948 (d) — a recusa do fecho NÃO é engolida em bloco', () => {
  it(
    'CT-948 (d) — na SEGUNDA ativação, o fecho recusado termina completo e preserva o fecho anterior',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id);

      // O adaptador fecha a conferência POR FORA na primeira ativação e levanta: a tarefa falha e é
      // redistribuída. É o percurso literal do *at-least-once* — a passada anterior fez o trabalho e o
      // reconhecimento não chegou.
      const adaptador = adaptadorQueFechaAConferenciaELevantaUmaVez(
        cenario.empresaId,
        cenario.conferenciaId,
      );
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(
        fila,
        { empresaId: cenario.empresaId, conferenciaId: cenario.conferenciaId },
        DUAS_TENTATIVAS,
      );

      // ⚠️ ESTA é a asserção que discrimina: na segunda ativação `concluirConferencia` NÃO alcança a
      // linha (ela já foi fechada) e levanta `ErroDeConferenciaNaoAlcancada`. Sem o predicado de
      // reentrada, o erro subiria e a tarefa terminaria `failed` sobre um trabalho já feito.
      expect(await tarefa.getState()).toBe('completed');

      // A ÂNCORA ANTIVÁCUO: as DUAS ativações aconteceram, e o fecho por fora de fato correu — sem
      // ela, um `completed` de primeira ativação satisfaria o caso.
      expect(adaptador.ativacoes).toBe(DUAS_TENTATIVAS);
      // E o fecho ANTERIOR é preservado: as contagens gravadas continuam sendo as da passada que de
      // fato fechou, e não as que esta reativação apurou. É a segunda metade do desfecho benigno —
      // reconhecer o reenvio e **não** reescrever o que já estava gravado.
      expect(await lerConferencia(cenario.empresaId, cenario.conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 0,
        efeitos: 0,
      });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-948 (d) — na PRIMEIRA ativação, o fecho recusado FALHA e não termina como sucesso',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id);

      // A conferência é fechada por fora ANTES de a tarefa correr: quando a passada chegar ao fecho,
      // `concluirConferencia` não alcançará a linha — e a tarefa está na PRIMEIRA ativação.
      await emUnidade(cenario.empresaId, async (tx) => {
        await concluirConferencia(tx, cenario.conferenciaId, {
          cobrancasConferidas: 0,
          efeitos: 0,
        });
      });

      const adaptador = adaptadorQueLiquida();
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(
        fila,
        { empresaId: cenario.empresaId, conferenciaId: cenario.conferenciaId },
        UMA_TENTATIVA,
      );

      // ⚠️ ESTA é a asserção que discrimina o `catch` em bloco que o cabeçalho de
      // `conferencia-bancaria.ts` proíbe por escrito: com ele, a tarefa terminaria `completed` sobre
      // uma conferência que esta passada não fechou — dizendo ao operador o oposto da verdade.
      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toBeTypeOf('string');
      expect(tarefa.failedReason).toContain(RECUSA_DO_FECHO);
      // A ÂNCORA ANTIVÁCUO: a passada de fato correu até o fecho — sem esta linha, um `failed` vindo
      // de qualquer erro anterior satisfaria o caso.
      expect(adaptador.consultas).toHaveLength(COBRANCAS_POR_EMPRESA);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-948 (e) — ADR-0032: a medição das DUAS superfícies de saída novas do processo
// ===========================================================================

describe('CT-948 (e) — o claro do certificado não alcança o diário nem o motivo da falha', () => {
  it(
    'CT-948 (e) — com o erro subindo COM o claro em escopo, nada do segredo sai pelo diário nem pelo failedReason',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id);
      const agulhas = { ...agulhasDoArranjo };

      // O CONTROLE POSITIVO, antes de qualquer afirmação de ausência: sem ele, uma varredura quebrada
      // devolveria lista vazia e este caso aprovaria um processo vazando tudo (AP-29).
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );
      // E a âncora do próprio conjunto de agulhas: um mapa vazio faria toda ausência passar por
      // vacuidade.
      expect(Object.keys(agulhas).length).toBeGreaterThanOrEqual(AGULHAS_POR_SEGREDO);

      const linhasAntes = (await lerLinhasDoDiario()).length;

      // O ADAPTADOR LEVANTA — e ele levanta DEPOIS de receber o invólucro, isto é, com o claro já
      // decifrado e vivo no escopo da passada. É o caminho de falha que o achado crítico da fase
      // anterior percorreu: o erro sobe intacto, o consumidor o registra CRU em `fila.ts` e a
      // biblioteca de fila grava a mensagem dele no servidor.
      const adaptador = adaptadorQueLevanta();
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(
        fila,
        { empresaId: cenario.empresaId, conferenciaId: cenario.conferenciaId },
        UMA_TENTATIVA,
      );

      // As âncoras de que os canais foram de fato exercitados, antes de qualquer ausência:
      expect(await tarefa.getState()).toBe('failed');
      expect(adaptador.recebeuOSegredo).toBe(true);
      expect(tarefa.failedReason).toBeTypeOf('string');
      expect(tarefa.failedReason).toContain(FALHA_DO_ADAPTADOR);

      await esvaziarDiario(registrador);
      const linhas = await lerLinhasDoDiario();

      // REGISTROU, e não vazou — as duas metades, e a primeira vem antes: um registrador silenciado
      // passaria em qualquer varredura de ausência.
      expect(linhas.length).toBeGreaterThan(linhasAntes);
      expect(linhas.some((linha) => linha.includes(REGISTRO_DA_TAREFA_EM_FALHA))).toBe(true);

      // A MEDIÇÃO: o arquivo de diário INTEIRO — que carrega as linhas de todos os casos deste
      // arquivo, inclusive os de sucesso — e o `failedReason` lido do servidor de fila. A igualdade
      // com lista vazia, e não `toHaveLength(0)`: é ela que faz a reprovação NOMEAR o canal e a agulha
      // ofensora.
      const superficies = [
        ...superficiesDoDiario(linhas),
        { rotulo: 'failedReason (texto cru)', texto: String(tarefa.failedReason) },
        { rotulo: 'failedReason (json)', texto: JSON.stringify(tarefa.failedReason ?? null) },
        { rotulo: 'tarefa gravada (inspeção)', texto: inspect(tarefa.toJSON(), { depth: null }) },
      ];

      expect(ocorrenciasDe(superficies, agulhas)).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a fiação da operação, o arranjo e as leituras cruas
// ---------------------------------------------------------------------------

/** O adaptador de teste, com as consultas que chegaram a ele — a lista prova o que NÃO foi perguntado. */
interface AdaptadorDeTeste {
  readonly porta: AdaptadorCobrancaBancaria;
  readonly consultas: readonly ConsultaDeSituacao[];
}

/**
 * A operação que a apuração **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: uma apuração que emitisse ou pedisse revogação derrubaria o caso no ponto,
 * em vez de passar despercebida por ninguém ter olhado.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`a conferência chamou uma operação que ela não deve chamar: ${nome}`);
  };
}

/**
 * Uma implementação de `AdaptadorCobrancaBancaria` que responde **liquidado** para todo título.
 *
 * O valor informado é **igual** ao esperado, de propósito: o que este arquivo mede é a origem do
 * contexto, e não a divergência da CA-11 — que tem caso próprio em
 * `packages/cobranca-bancaria/test/conferencia.spec.ts`.
 */
function adaptadorQueLiquida(): AdaptadorDeTeste {
  const consultas: ConsultaDeSituacao[] = [];

  const porta: AdaptadorCobrancaBancaria = {
    consultarSituacao: async (consulta) => {
      consultas.push(consulta);

      return {
        aceito: true,
        valor: {
          situacao: 'LIQUIDADO',
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA,
          documento: null,
        },
      };
    },
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };

  return { porta, consultas };
}

/**
 * Conecta a fila real e registra o consumidor da conferência com o adaptador informado.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.conferenciaBancaria, …)`, com a borda recebendo o acesso ao banco, o adaptador, a
 * guarda e a chave de cifra por parâmetro.
 */
function montarConsumidor(adaptador: AdaptadorCobrancaBancaria): Fila {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.conferenciaBancaria,
    async (tarefa, registrador) =>
      await processarConferenciaBancaria(tarefa, registrador, {
        banco: acesso,
        adaptador,
        guarda: guardaDeProducao(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  return fila;
}

/** A guarda de produção, apontada para o diretório efêmero deste arquivo. */
function guardaDeProducao(): GuardaDeBoletos {
  return criarGuardaDeBoletos(diretorioDosBoletos);
}

/** O adaptador do reenvio benigno, com a contagem de ativações que serve de âncora antivácuo. */
interface AdaptadorQueFecha {
  readonly porta: AdaptadorCobrancaBancaria;
  /** Quantas vezes a tarefa foi ativada — uma por chamada da primeira consulta de cada passada. */
  readonly ativacoes: number;
}

/**
 * Um adaptador que **fecha a conferência por fora e levanta** na primeira ativação, e liquida depois.
 *
 * É a precondição do reenvio benigno, e ela é montada assim porque o produto não tem gancho para
 * simular *"comitou e o processo caiu antes do reconhecimento"*: o efeito observável daquele percurso
 * é exatamente este — a conferência já fechada, e a tarefa **reativada**. O fecho por fora passa pela
 * porta de produção (`concluirConferencia`), e não por SQL cru.
 */
function adaptadorQueFechaAConferenciaELevantaUmaVez(
  empresaId: string,
  conferenciaId: string,
): AdaptadorQueFecha {
  const marca = { ativacoes: 0 };
  let primeiraConsultaDaAtivacao = true;

  const porta: AdaptadorCobrancaBancaria = {
    consultarSituacao: async () => {
      if (primeiraConsultaDaAtivacao) {
        primeiraConsultaDaAtivacao = false;
        marca.ativacoes += 1;

        if (marca.ativacoes === 1) {
          await emUnidade(empresaId, async (tx) => {
            await concluirConferencia(tx, conferenciaId, { cobrancasConferidas: 0, efeitos: 0 });
          });
          // A ativação seguinte volta a ser "primeira consulta".
          primeiraConsultaDaAtivacao = true;

          throw new Error(FALHA_DO_ADAPTADOR);
        }
      }

      return {
        aceito: true,
        valor: {
          situacao: 'LIQUIDADO',
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA,
          documento: null,
        },
      };
    },
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };

  return {
    porta,
    get ativacoes(): number {
      return marca.ativacoes;
    },
  };
}

/** O adaptador que levanta, com a marca de que o invólucro do segredo chegou até ele. */
interface AdaptadorQueLevanta {
  readonly porta: AdaptadorCobrancaBancaria;
  /** `true` depois de a consulta ter chegado **com** o invólucro — a âncora do `CT-948 (e)`. */
  readonly recebeuOSegredo: boolean;
}

/**
 * Um adaptador que **levanta** ao ser chamado — o caminho em que o erro sobe com o claro em escopo.
 *
 * ⚠️ **A exceção NÃO carrega nada do segredo**, e a ausência é deliberada: plantar o claro nela seria
 * violar o contrato de quem recebe `abrir()` (ver `packages/shared/src/segredo-operavel.ts`) e mediria
 * o dublê, não o produto. O que o caso mede é se **o produto** — a borda, o registrador e a biblioteca
 * de fila — deixa escapar o que passou por ele.
 */
function adaptadorQueLevanta(): AdaptadorQueLevanta {
  const marca = { recebeuOSegredo: false };

  const porta: AdaptadorCobrancaBancaria = {
    consultarSituacao: async (consulta) => {
      // A marca é a prova de que o claro ESTAVA em escopo quando o erro subiu: o invólucro chegou ao
      // adaptador, o que só acontece depois de `decifrarSegredo` ter corrido na borda.
      marca.recebeuOSegredo = consulta.segredo !== undefined;

      throw new Error(FALHA_DO_ADAPTADOR);
    },
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };

  return {
    porta,
    get recebeuOSegredo(): boolean {
      return marca.recebeuOSegredo;
    },
  };
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` **não** encerram a
 * espera, e é essa distinção que faz o caso observar o desfecho depois de eventual repetição.
 */
async function executarJob(
  fila: Fila,
  carga: CargaDaConferenciaBancaria,
  tentativas?: number,
): Promise<TarefaDaConferenciaBancaria> {
  const enfileirada = await fila.conferenciaBancaria.add(
    FILA_DA_CONFERENCIA_BANCARIA,
    carga,
    tentativas === undefined ? {} : { attempts: tentativas },
  );
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.conferenciaBancaria.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.conferenciaBancaria.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança o banco. Ele monta o estado;
 * **nunca** o contexto do job, que nasce na borda a partir da carga.
 */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data deste arranjo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que o predicado de
 * `selecionarCobrancasAConferir` compara.
 */
async function dataDeslocada(empresaId: string, dias: number): Promise<string> {
  return await emUnidade(empresaId, async (tx) => {
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

/** Um cenário montado: a empresa, a conferência aberta e a carteira com boleto dela. */
interface Cenario {
  readonly empresaId: string;
  readonly conferenciaId: string;
  readonly codigos: readonly string[];
  readonly titulos: readonly string[];
  /**
   * O par em claro que o arranjo cifrou e gravou — `undefined` quando o cenário nasceu **sem**
   * certificado vigente.
   *
   * Ele é **devolvido**, e não descartado dentro de `gravarCertificadoVigente` como era: é dele que
   * saem as agulhas do `CT-948 (e)`, e uma agulha inventada mediria uma cadeia que nunca entrou no
   * produto.
   */
  readonly segredo: SegredoDoArranjo | undefined;
}

/** O que `semearCenario` aceita variar — hoje, só a existência do certificado vigente. */
interface OpcoesDoCenario {
  /** `false` monta a empresa **sem** certificado vigente — o ramo que o `CT-948 (c)` percorre. */
  readonly comCertificado?: boolean;
}

/**
 * Aposenta tudo o que ainda é conferível na empresa — pela porta de produção.
 *
 * `revogarBoleto` é a mesma porta que a apuração usa, e é ela que tira a cobrança do conjunto: sem
 * `numero_do_titulo_no_provedor`, o primeiro termo do predicado deixa de alcançá-la. Sem isto, a carteira de um caso
 * sobreviveria ao seguinte — a cobrança **paga** continua conferível por trinta dias (CA-16) —, e as
 * contagens do caso passariam a descrever a carteira acumulada em vez do cenário que ele montou.
 */
async function esvaziarCarteira(empresaId: string): Promise<void> {
  await emUnidade(empresaId, async (tx) => {
    for (const cobranca of await selecionarCobrancasAConferir(tx)) {
      await revogarBoleto(tx, cobranca.codigo);
    }
  });
}

/** O usuário que dispara as conferências de uma empresa — derivado da carga inicial. */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }

  return usuario;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 80_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: `${nome.toLowerCase().replaceAll(' ', '-')}@exemplo.invalid`,
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
 * Semeia a empresa inteira: cadastros, contrato, certificado vigente, cobranças **com boleto** e a
 * conferência aberta.
 *
 * As cobranças recebem boleto pela porta de produção (`gravarBoletoDaCobranca`), e é isso que as põe
 * dentro do conjunto que `selecionarCobrancasAConferir` recorta: o primeiro termo do predicado exige
 * `numero_do_titulo_no_provedor IS NOT NULL`.
 */
async function semearCenario(empresaId: string, opcoes: OpcoesDoCenario = {}): Promise<Cenario> {
  sequencia += 1;
  const marca = `t16-conf-${String(sequencia)}`;

  // O certificado é gravado ANTES de tudo, e a retirada acontece depois de gravado: a empresa é a
  // mesma entre os casos, e um cenário "sem certificado" que apenas deixasse de gravar herdaria o
  // vigente que um caso anterior deixou.
  const segredo = await gravarCertificadoVigente(empresaId);

  if (opcoes.comCertificado === false) {
    await retirarCertificadoVigente(empresaId);
  } else {
    Object.assign(agulhasDoArranjo, agulhasDoSegredo(marca, segredo));
  }

  await esvaziarCarteira(empresaId);

  const cadastros = await emUnidade(empresaId, async (tx) => {
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
    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidade(empresaId, lerAnoDaSerieDeContrato);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });
  const contrato = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano: anoDoContrato, numero },
    );
  });

  const anoDaCobranca = await emUnidade(empresaId, lerAnoDaSerieDeCobranca);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  const guarda = guardaDeProducao();
  const vencimento = await dataDeslocada(empresaId, 30);
  const codigos: string[] = [];
  const titulos: string[] = [];

  for (let indice = 0; indice < COBRANCAS_POR_EMPRESA; indice += 1) {
    sequencia += 1;
    const ordem = String(sequencia).padStart(7, '0');
    const cobranca = await emUnidade(empresaId, async (tx) => {
      const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

      return await criarCobranca(
        tx,
        {
          contratoId: contrato.id,
          natureza: 'ALUGUEL',
          referencia: `Aluguel ${marca}-${String(indice)}`,
          competencia: COMPETENCIA,
          dataVencimento: vencimento,
          valorOriginal: VALOR_DA_COBRANCA,
        },
        { ano: anoDaCobranca, numero },
      );
    });

    const numeroDoTitulo = `T-${ordem}`;
    const nomeDoArquivo = await guarda.gravar(
      cobranca.codigo,
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${ordem}`),
    );

    await emUnidade(empresaId, async (tx) => {
      await gravarBoletoDaCobranca(tx, cobranca.codigo, {
        numeroDoTituloNoProvedor: numeroDoTitulo,
        linhaDigitavel: `L-${ordem}`,
        codigoDeBarras: `B-${ordem}`,
        identificadorNoProvedor: `00000000000${ordem}`,
        caminhoDoArquivo: nomeDoArquivo,
      });
    });

    codigos.push(cobranca.codigo);
    titulos.push(numeroDoTitulo);
  }

  const conferencia = await emUnidade(
    empresaId,
    async (tx) => await abrirConferencia(tx, { solicitadaPor: exigirUsuarioDa(empresaId).id }),
  );

  if (!conferencia.iniciadaAgora) {
    throw new Error(
      'o arranjo encontrou uma conferência em andamento que o caso anterior não fechou',
    );
  }

  return {
    empresaId,
    conferenciaId: conferencia.id,
    codigos,
    titulos,
    segredo: opcoes.comCertificado === false ? undefined : segredo,
  };
}

/**
 * Grava um certificado **vigente** da empresa, com o envelope cifrado pela mesma chave da composição.
 *
 * O material é opaco para o banco (ADR-0032) e nada neste arquivo o abre. O que importa é que a borda
 * **o resolve pelo banco** e o decifra com a chave que recebeu — sem que nada de segredo tenha
 * atravessado a fila.
 */
async function gravarCertificadoVigente(empresaId: string): Promise<SegredoDoArranjo> {
  const segredo: SegredoDoArranjo = {
    material: Buffer.concat([
      Buffer.from(`material-${randomUUID()}-`),
      randomBytes(BYTES_DO_MATERIAL),
    ]),
    senha: `senha-${randomUUID()}`,
  };
  const envelopeCifrado = cifrarSegredo(criarSegredoOperavel(segredo), CHAVE_DE_CIFRA);

  const validade = await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ de: Date; ate: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
             (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
    }

    return linha;
  });

  await emUnidade(empresaId, async (tx) => {
    await registrarCertificado(tx, {
      titular: `Empresa ${empresaId.slice(0, 8)}`,
      validoDe: validade.de,
      validoAte: validade.ate,
      impressaoDigital: randomUUID(),
      segredoCifrado: envelopeCifrado,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });

    // A identidade da empresa perante o provedor é pré-condição do MESMO tipo que o certificado
    // (`D36 · F4/T10`, fechado em 2026-08-20): sem ela as tarefas interrompem antes de tentar. Ela
    // nasce aqui, na mesma unidade, para que o arranjo continue produzindo uma empresa que consegue
    // operar — e não uma que passa a interromper por configuração faltante.
    await registrarIdentidadeNoProvedor(tx, {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        `identificador-${empresaId.slice(0, 8)}`,
        CHAVE_DE_CIFRA,
      ),
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });
  });

  return segredo;
}

/**
 * Retira o certificado vigente da empresa — a precondição do `CT-948 (c)`.
 *
 * É **a mesma instrução** que `registrarCertificado` executa para anular o anterior antes de inserir
 * o substituto, e ela está escrita aqui porque nenhuma porta pública produz o estado *"empresa sem
 * vigente"* sozinha: a porta que anula só existe acoplada à inserção do substituto. Sem `WHERE
 * empresa_id` — quem recorta é a política (ADR-0008).
 */
async function retirarCertificadoVigente(empresaId: string): Promise<void> {
  await emUnidade(empresaId, async (tx) => {
    const resultado = await tx`
      UPDATE negocio.certificado_do_provedor
         SET substituido_em = pg_catalog.now(),
             segredo_cifrado = NULL
       WHERE substituido_em IS NULL
    `;

    if (resultado.count !== 1) {
      throw new Error('o arranjo não encontrou certificado vigente a retirar');
    }
  });
}

/** As linhas não vazias do arquivo de diário do processo — a superfície que o `CT-948 (e)` varre. */
async function lerLinhasDoDiario(): Promise<string[]> {
  const conteudo = await readFile(arquivoDoDiario, 'utf8');

  return conteudo.split('\n').filter((linha) => linha.trim() !== '');
}

/** O estado gravado de uma conferência — os fatos crus, sem derivação. */
interface ConferenciaLida {
  readonly concluida: boolean;
  readonly cobrancasConferidas: number;
  readonly efeitos: number;
}

/** Lê a conferência pelo identificador, sob o contexto informado — sem cláusula de empresa. */
async function lerConferencia(
  empresaId: string,
  conferenciaId: string,
): Promise<ConferenciaLida | undefined> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ concluida: boolean; conferidas: number; efeitos: number }[]>`
      SELECT (concluida_em IS NOT NULL) AS concluida,
             cobrancas_conferidas AS conferidas,
             efeitos AS efeitos
        FROM negocio.conferencia_bancaria
       WHERE id = ${conferenciaId}
    `;

    return linha === undefined
      ? undefined
      : {
          concluida: linha.concluida,
          cobrancasConferidas: linha.conferidas,
          efeitos: linha.efeitos,
        };
  });
}

/** A contagem CRUA de conferências concluídas alcançáveis sob o contexto — quem recorta é a política. */
async function conferenciasConcluidas(empresaId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total
        FROM negocio.conferencia_bancaria
       WHERE concluida_em IS NOT NULL
    `;

    return Number(linha?.total ?? '0');
  });
}

/** Os códigos das cobranças pagas alcançáveis sob o contexto informado, em ordem. */
async function cobrancasPagas(empresaId: string): Promise<string[]> {
  return await emUnidade(empresaId, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      SELECT codigo
        FROM negocio.cobranca
       WHERE pago_em IS NOT NULL
       ORDER BY codigo
    `;

    return linhas.map((linha) => linha.codigo);
  });
}
