/**
 * A **borda da tarefa de emissão em lote** — o job entra pela fila real, o contexto nasce da carga, e
 * o lote de UMA empresa é percorrido. T16 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-01    | CT-944 | Executado o job com o `empresaId` e o `loteId` da empresa A, os itens
 * | CA-03    |        | gravados nomeiam EXATAMENTE as cobranças de A, o lote de A fica
 * |          |        | `CONCLUIDA` com todas emitidas, e a empresa B — que tem lote aberto e
 * |          |        | cobranças elegíveis na MESMA competência — permanece intocada: zero itens
 * |          |        | e nenhuma cobrança com título. O contexto é aberto uma vez na borda, pelo
 * |          |        | escritor único, e a fronteira continua sendo do banco. |
 * | CA-01    | CT-944 | Carga sem `empresaId`, carga com `empresaId` que não é UUID e carga com
 * | CA-03    | (b)    | campo extra terminam em FALHA com razão contendo literalmente o nome do
 * |          |        | campo recusado — `empresaId` nas duas primeiras, a chave excedente na
 * |          |        | terceira —, não aparecem entre as concluídas, e a contagem crua de
 * |          |        | `item_da_emissao_em_lote` permanece a de antes (**delta `0`**). Nenhuma
 * |          |        | das três razões ecoa o VALOR recebido. |
 * | CA-03    | CT-944 | A empresa **sem certificado vigente** tem o lote gravado como `INTERROMPIDA`
 * |          | (c)    | com o motivo EXATO que a borda publica, zero emitidas e zero recusadas;
 * |          |        | **nada** é pedido ao provedor e nenhum item é gravado; e a tarefa termina
 * |          |        | `completed`. |
 * | CA-01    | CT-944 | O reenvio sobre um lote **já concluído** termina `completed` sem pedir nada
 * | CA-03    | (d)    | ao provedor e sem gravar item novo; e o desfecho que **não alcança linha
 * |          |        | alguma** com o lote sem desfecho gravado termina `failed`, nomeando o lote.
 * |          |        | O par é o que impede o `catch` em bloco proibido pelo cabeçalho da borda. |
 * | CA-01    | CT-944 | O reenvio sobre um lote já **INTERROMPIDO por falta de certificado** termina
 * | CA-03    | (f)    | `completed`, preservando o carimbo e o motivo da primeira passada, sem pedir
 * |          |        | nada ao provedor e sem gravar item. É o percurso irmão do `(d)`: sem ele, a
 * |          |        | metade não tratada da reentrância termina `failed` sobre um lote correto. |
 * | CA-20    | CT-944 | Com o erro subindo **enquanto o claro está em escopo** (o invólucro chegou ao
 * |          | (e)    | adaptador e ele levantou), nem o arquivo de diário INTEIRO do processo nem o
 * |          |        | `failedReason` gravado no servidor de fila carregam a senha, o material em
 * |          |        | base64 ou o recorte hexadecimal de **qualquer** segredo que este arquivo
 * |          |        | cifrou — enquanto o mesmo varredor acha todas as agulhas no controle
 * |          |        | positivo, canal a canal, afirmado por igualdade. |
 *
 * Rastreabilidade: `CA-01, CA-03 → CT-944 (RN-01)` · `CA-20 → CT-944 (e)` (ADR-0032).
 *
 * ===========================================================================
 * O QUE O `CT-944 (e)` MEDE, e por que ele não podia faltar (ADR-0032)
 * ===========================================================================
 *
 * A T16 fez este processo **decifrar o segredo operável**: a superfície capaz de abrir o segredo mais
 * forte do produto passou de **um** processo para **dois**. A `Decision` da ADR-0032 é literal quanto
 * ao método — *"a ausência de vazamento é afirmada por **medição da saída real**, nunca por leitura do
 * código"* — e as `Consequences → Cons` quanto ao gatilho: *"cada superfície de saída nova cobra um
 * caso que a observe de fato"*.
 *
 * São **duas** superfícies novas, e as duas são alcançadas pelo mesmo vetor que originou a ADR-0032:
 * `apps/worker/src/fila.ts` registra `consumidor.on('failed', … { erro })` com o **objeto de exceção
 * cru**, e a biblioteca de fila grava a mensagem dele como `failedReason` no servidor. Enquanto o
 * registrador deste arquivo tinha destino que **descartava** a saída, nenhuma das duas era observável,
 * e a garantia ficava afirmada por leitura do cabeçalho da borda — o método que a `Decision` proíbe.
 *
 * O destino passou a ser um **arquivo temporário**: é o mesmo parâmetro `destino` que a unidade
 * systemd usa em operação, e o caminho legítimo já praticado por `packages/shared/test/log.spec.ts`.
 * Ele é **um só para o arquivo inteiro**, de modo que a varredura alcança também as linhas dos
 * caminhos de **sucesso** — onde o claro esteve igualmente em escopo.
 *
 * ⚠️ **As agulhas são derivadas do dado que DE FATO circulou**: a senha e o material que
 * `gravarCertificadoVigente` cifrou e gravou, e que a borda decifrou pelo banco. Antes elas eram
 * descartadas dentro daquela função, e por isso não havia o que buscar.
 *
 * **O que a medição encontrou (2026-08-18), e por que a linha continua sendo necessária.** O objeto de
 * exceção cru **não** vaza: o `failedReason` gravado no servidor carrega apenas a mensagem do erro, e
 * a linha do diário sai como
 * `"erro":{"tipo":"Error","mensagem":"…","pilha":"…"}`. ⚠️ **Mas a redação de
 * `packages/shared/src/log.ts` COPIA as propriedades próprias da exceção** — a linha do
 * `ErroDeLoteNaoAlcancado` sai com `"loteId"` e `"desfecho"` ao lado da mensagem —, e ela reconhece o
 * que é sensível **pelo nome da chave**. Uma exceção que passasse a carregar o claro sob nome neutro
 * (`argumentos`, `contexto`, `opcoes` — que é a forma exata do achado crítico da fase anterior, e a
 * que uma biblioteca de terceiro escolheria) chegaria ao diário legível. É por isso que a ausência
 * precisa ser **medida a cada rodada**, e não deduzida do fato de hoje nada anexar.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO, e é isso que o caso existe para provar
 * ===========================================================================
 *
 * Nada aqui chama `processarEmissaoEmLote` diretamente. A tarefa é **enfileirada pela fila real** e
 * consumida pelo consumidor que `conectarFila().processar(…)` registra — a mesma fiação que
 * `apps/worker/src/main.ts` monta em operação, com a única diferença sendo qual implementação do
 * `AdaptadorCobrancaBancaria` a composição injeta. Chamar a borda direto provaria a função; o que se
 * quer provar é o **caminho**, e é ele que carrega a decisão da ADR-0024.
 *
 * ⚠️ **O contexto de tenant NÃO é fixado por fora.** O arranjo semeia sob o contexto da empresa que
 * ele monta, e para o job ele entrega apenas a **carga**; quem abre o contexto do trabalho é a borda,
 * uma vez, pelo mesmo `contextoDeTenant.executarCom` da guarda HTTP. Se o teste fixasse
 * `app.empresa_id` por fora, o caso passaria mesmo com a borda não abrindo contexto nenhum — que é
 * exatamente o defeito que ele existe para pegar.
 *
 * ⚠️ **O certificado NÃO é entregue à borda**: ele é **gravado no banco**, cifrado, e a borda o
 * resolve sozinha sob o contexto que a carga estabelece, decifrando com a chave que a composição raiz
 * lhe passa. É a ADR-0032 exercitada pelo caminho real — a carga leva dois identificadores e nada
 * mais, e a prova disso é que o percurso funciona sem que nada de segredo tenha atravessado a fila.
 *
 * ===========================================================================
 * O ADAPTADOR, e por que ele NÃO é mock
 * ===========================================================================
 *
 * `adaptadorQueAceita` é **implementação** da porta que o domínio declarou, com a mesma assinatura
 * pela qual a produção é exercitada; o que ela substitui é o **destino do pedido**, nunca a lógica sob
 * prova. As três operações que a emissão não deve chamar levantam nomeando-se: um percurso que
 * consultasse situação ou pedisse revogação derrubaria o caso no ponto.
 *
 * ===========================================================================
 * A ESPERA É POR SONDAGEM, com limite declarado no topo
 * ===========================================================================
 *
 * Nenhuma pausa fixa (`.claude/rules/testing-stack.md`): o que se espera é o **estado terminal da
 * tarefa**, observado no próprio servidor de fila.
 *
 * ===========================================================================
 * De onde vêm o banco e a fila (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras **próprias**, descartadas ao fim. Nenhuma coordenada é lida do ambiente.
 * **Nenhum `WHERE empresa_id` é escrito neste arquivo**, nem nas contagens cruas: quem recorta é a
 * política (ADR-0008).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import {
  type AdaptadorCobrancaBancaria,
  type BoletoEmitido,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
  type PedidoDeEmissao,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirEmissaoEmLote,
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
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerLote,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import {
  type CargaDaEmissaoEmLote,
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  FILA_DA_EMISSAO_EM_LOTE,
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
import { conectarFila, type Fila, type TarefaDaEmissaoEmLote } from '../src/fila.ts';
import { processarEmissaoEmLote } from '../src/tarefas/emissao-em-lote.ts';
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

/** Cada caso monta cadastros, cobranças e percorre o lote em unidades sequenciais. */
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

/** A competência do lote — primeiro dia do mês, como o `check` do banco exige. */
const COMPETENCIA = '2026-03-01';

/**
 * A competência de cada caso que semeia a empresa A uma segunda vez.
 *
 * Elas são distintas de propósito: `selecionarCobrancasSemBoleto` recorta por **competência**, e um
 * caso que reusasse a de outro veria o conjunto residual dele — a contagem de pedidos passaria a
 * descrever o acúmulo do arquivo em vez do cenário sob prova, e a asserção ficaria amarrada à ordem
 * de execução.
 */
const COMPETENCIA_SEM_CERTIFICADO = '2026-05-01';
const COMPETENCIA_DO_REENVIO = '2026-06-01';
const COMPETENCIA_DO_DESFECHO_PERDIDO = '2026-07-01';
const COMPETENCIA_DO_REENVIO_SEM_CERTIFICADO = '2026-09-01';
const COMPETENCIA_DA_MEDICAO = '2026-08-01';

/** O vencimento das cobranças do arranjo — nada aqui o lê para decidir. */
const VENCIMENTO_DA_COBRANCA = '2026-03-10';

/** Quantas cobranças cada empresa recebe. Duas bastam para o conjunto não ser unitário. */
const COBRANCAS_POR_EMPRESA = 2;

/** O valor de cada cobrança, em reais. */
const VALOR_DA_COBRANCA = 1000;

/**
 * Quantos bytes sorteados o material do certificado do arranjo carrega além do prefixo legível.
 *
 * Sessenta e quatro, e não uma dezena: o recorte hexadecimal das agulhas sai da **metade** do
 * material, e um cofre curto demais faria o acessório recusar o recorte.
 */
const BYTES_DO_MATERIAL = 64;

/** O que o dublê antepõe aos bytes do boleto, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** O nome do campo que a razão da falha tem de nomear (ADR-0024). Cadeia EXATA. */
const CAMPO_DA_EMPRESA = 'empresaId';

/** A chave excedente do terceiro cenário — a que o `strictObject` tem de nomear na recusa. */
const CHAVE_EXCEDENTE = 'material';

/** O valor da chave excedente — sentinela: nenhuma razão de falha pode contê-lo. */
const VALOR_DA_CHAVE_EXCEDENTE = 'material-que-nao-pode-vazar';

/** O `empresaId` que não é UUID — sentinela do segundo cenário, pela mesma razão. */
const EMPRESA_QUE_NAO_E_UUID = 'nao-e-uuid-empresa-sentinela';

/** Tentativas de uma tarefa que os cenários inválidos reduzem — nas opções do ENFILEIRAMENTO. */
const UMA_TENTATIVA = 1;

/**
 * O motivo com que a borda interrompe o lote da empresa sem certificado vigente — cadeia EXATA.
 *
 * Ela é escrita aqui por extenso, e não importada: é **texto publicado** na prestação de contas do
 * lote, e o que o `CT-944 (c)` afirma é o que o Admin lê. Derivá-la do fonte faria a asserção
 * concordar com a implementação em vez de fixá-la.
 */
const MOTIVO_SEM_CERTIFICADO =
  'a empresa não tem certificado vigente do provedor bancário: nenhuma cobrança foi tentada';

/** Quantas agulhas cada segredo do arranjo produz — senha, material em base64 e recorte hexadecimal. */
const AGULHAS_POR_SEGREDO = 3;

/** A mensagem com que o adaptador do `CT-944 (e)` levanta — nenhum segredo nela, de propósito. */
const FALHA_DO_ADAPTADOR = 'o par remoto encerrou o aperto de mão antes da resposta';

/** A mensagem que `fila.ts` emite ao registrar o objeto de exceção CRU de uma tarefa que falhou. */
const REGISTRO_DA_TAREFA_EM_FALHA = 'tarefa terminou em falha';

/**
 * A mensagem que `ErroDeLoteNaoAlcancado` compõe para a porta de **interrupção** — cadeia EXATA.
 *
 * Ela discrimina a recusa do desfecho de uma falha de driver qualquer: é o que separa *"o percurso
 * não alcançou o lote"* de *"o banco caiu"*, e é o que o operador lê no `failedReason`.
 */
const RECUSA_DA_INTERRUPCAO = 'o lote foi interrompido e não foi alcançado';

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
 * que faz a varredura do `CT-944 (e)` alcançar o diário **inteiro** — inclusive o caminho de sucesso
 * dos casos anteriores, em que o claro do certificado também esteve em escopo — em vez de um trecho
 * recortado pelo caso que a executa.
 */
let registrador: Logger;

/**
 * As agulhas de **todo** segredo que este arquivo cifrou e gravou, acumuladas cenário a cenário.
 *
 * O `CT-944 (e)` varre o arquivo de diário inteiro contra este mapa, e não apenas contra o segredo do
 * cenário dele: o diário guarda as linhas de todos os casos, e olhar por menos do que circulou seria
 * medir menos do que a ADR-0032 cobra.
 */
const agulhasDoArranjo: Record<string, string> = {};

/**
 * A chave que a composição raiz entrega às bordas — 32 bytes sorteados por execução.
 *
 * Ela é **sorteada**, e não literal: um valor fixo no arquivo seria uma chave de cifra versionada, e
 * o invariante 3 do `CLAUDE.md` não abre exceção para arquivo de teste.
 */
const CHAVE_DE_CIFRA = randomBytes(32);

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequencia = 0;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-boletos-ct944-'));

  // O DESTINO DO REGISTRADOR É UM ARQUIVO, e é isso que torna o `CT-944 (e)` uma medição do diário do
  // processo real em vez de uma inspeção de memória. O caminho é o legítimo — o mesmo parâmetro
  // `destino` que a unidade systemd usa em operação (`packages/shared/test/log.spec.ts`).
  //
  // ⚠️ **O destino que DESCARTA a saída, que este arquivo usava, tornava a ADR-0032 inauditável aqui**:
  // as duas superfícies de saída que a T16 abriu para o claro — o diário e o `failedReason` — não
  // tinham como ser observadas, e a ausência de vazamento ficava afirmada por LEITURA DO CÓDIGO, que é
  // o método que a `Decision` proíbe.
  arquivoDoDiario = join(mkdtempSync(join(tmpdir(), 'sysloc-diario-ct944-')), 'eventos.log');
  registrador = criarLogger({ nivel: 'info', destino: arquivoDoDiario });

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera.
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
// CT-944 — o job de uma empresa não alcança o lote nem as cobranças da outra
// ===========================================================================

describe('CT-944 — o contexto nasce da carga, e o job de A não alcança nada de B', () => {
  it(
    'CT-944 — o lote de A é percorrido sob o contexto de A, e B permanece intocada',
    async () => {
      const cenarioA = await semearCenario(EMPRESA_A.id);
      const cenarioB = await semearCenario(EMPRESA_B.id);

      const itensDeAAntes = await contarItensDoLote(cenarioA.empresaId);
      const itensDeBAntes = await contarItensDoLote(cenarioB.empresaId);
      expect(itensDeAAntes).toBe(0);
      expect(itensDeBAntes).toBe(0);

      const adaptador = adaptadorQueAceita();
      const fila = montarConsumidor(adaptador.porta);

      // Só o job de A é enfileirado. O de B não existe — e é isso que faz a asserção sobre B
      // significar alguma coisa.
      const tarefa = await executarJob(fila, {
        empresaId: cenarioA.empresaId,
        loteId: cenarioA.loteId,
      });

      expect(await tarefa.getState()).toBe('completed');

      // O que foi PEDIDO ao provedor: exatamente as cobranças de A, e nenhuma de B.
      const pedidas = adaptador.pedidos.map((pedido) => pedido.locatario.nome).sort();
      expect(pedidas).toEqual(cenarioA.codigos.map(() => cenarioA.nomeDoLocatario).sort());
      expect(adaptador.pedidos).toHaveLength(COBRANCAS_POR_EMPRESA);
      // E a empresa que a borda apresentou ao provedor é a da CARGA, em toda chamada.
      expect([...new Set(adaptador.pedidos.map((pedido) => pedido.empresaId))]).toEqual([
        cenarioA.empresaId,
      ]);

      // O que foi GRAVADO em A: um item EMITIDO por cobrança, nomeando os códigos de A.
      expect(await itensDoLote(cenarioA.empresaId, cenarioA.loteId)).toEqual(
        cenarioA.codigos.map((codigo) => ({ codigo, desfecho: 'EMITIDO', motivo: null })),
      );
      expect(await titulosGravados(cenarioA.empresaId)).toHaveLength(COBRANCAS_POR_EMPRESA);

      // E o desfecho do lote de A, lido pela porta de produção.
      const lote = await emUnidade(cenarioA.empresaId, async (tx) => lerLote(tx, cenarioA.loteId));
      expect(lote?.estado).toBe('CONCLUIDA');
      expect(lote?.emitidas).toBe(COBRANCAS_POR_EMPRESA);
      expect(lote?.recusadas).toBe(0);

      // B não se moveu: nem item, nem título. É esta asserção que discrimina "correu sob o contexto
      // de A" de "correu sob contexto nenhum e por sorte não escreveu em B".
      expect(await contarItensDoLote(cenarioB.empresaId)).toBe(itensDeBAntes);
      expect(await titulosGravados(cenarioB.empresaId)).toEqual([]);
      const loteDeB = await emUnidade(cenarioB.empresaId, async (tx) =>
        lerLote(tx, cenarioB.loteId),
      );
      expect(loteDeB?.estado).toBe('EM_ANDAMENTO');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-944 (b) — as três cargas inválidas FALHAM nomeando o campo, e nada é escrito',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id);

      // A contagem de ANTES é lida, e não afirmada como zero: a empresa A é a mesma dos casos
      // anteriores, e o que este caso mede é o **delta**. Um zero literal aqui amarraria a asserção à
      // ordem de execução dos casos, que é exatamente o que a torna frágil.
      const itensAntes = await contarItensDoLote(cenario.empresaId);

      const adaptador = adaptadorQueAceita();
      const fila = montarConsumidor(adaptador.porta);

      // As três cargas inválidas, com o campo que cada razão tem de nomear declarado ANTES da
      // execução. A terceira é a chave excedente: `strictObject` RECUSA o que veio a mais, em vez de
      // ignorar — a carga é a origem do contexto, e ignorar o excedente é o começo de ela virar "o
      // novo request" (ADR-0024).
      const cenarios = [
        { rotulo: 'sem empresaId', carga: { loteId: cenario.loteId }, nomeado: CAMPO_DA_EMPRESA },
        {
          rotulo: 'empresaId que não é UUID',
          carga: { empresaId: EMPRESA_QUE_NAO_E_UUID, loteId: cenario.loteId },
          nomeado: CAMPO_DA_EMPRESA,
        },
        {
          rotulo: 'campo extra além dos dois',
          carga: {
            empresaId: cenario.empresaId,
            loteId: cenario.loteId,
            [CHAVE_EXCEDENTE]: VALOR_DA_CHAVE_EXCEDENTE,
          },
          nomeado: CHAVE_EXCEDENTE,
        },
      ];

      const falhadas: TarefaDaEmissaoEmLote[] = [];
      for (const { carga } of cenarios) {
        falhadas.push(
          await executarJob(fila, carga as unknown as CargaDaEmissaoEmLote, UMA_TENTATIVA),
        );
      }

      for (const [indice, { rotulo, nomeado }] of cenarios.entries()) {
        const tarefa = falhadas[indice];
        expect(tarefa, rotulo).toBeDefined();
        expect(await tarefa?.getState(), rotulo).toBe('failed');
        // A razão NOMEIA o campo recusado: mensagem genérica não diz a quem opera o que faltou.
        expect(tarefa?.failedReason, rotulo).toBeTypeOf('string');
        expect(tarefa?.failedReason, rotulo).toContain(nomeado);
        // E NUNCA o valor: nome de campo não é segredo, valor de campo pode ser dado de outra
        // empresa — e a razão fica gravada no servidor de fila e alcança o journal.
        expect(tarefa?.failedReason, rotulo).not.toContain(VALOR_DA_CHAVE_EXCEDENTE);
        expect(tarefa?.failedReason, rotulo).not.toContain(EMPRESA_QUE_NAO_E_UUID);
      }

      const concluidas = (await fila.emissaoEmLote.getCompleted()).map((tarefa) => tarefa.id);
      for (const tarefa of falhadas) {
        expect(concluidas).not.toContain(tarefa.id);
      }

      // Nada foi pedido ao provedor e nada foi gravado — em particular, o lote NÃO correu sem
      // contexto devolvendo conjunto vazio como se fosse sucesso, que é o pior desfecho possível.
      expect(adaptador.pedidos).toEqual([]);
      expect(await contarItensDoLote(cenario.empresaId)).toBe(itensAntes);
      const lote = await emUnidade(cenario.empresaId, async (tx) => lerLote(tx, cenario.loteId));
      expect(lote?.estado).toBe('EM_ANDAMENTO');

      // --- O controle positivo, obrigatório -------------------------------------------------
      // Sem ele, o caso seria satisfeito por um consumidor que falha sempre.
      const controle = await executarJob(fila, {
        empresaId: cenario.empresaId,
        loteId: cenario.loteId,
      });

      expect(await controle.getState()).toBe('completed');
      expect(adaptador.pedidos).toHaveLength(COBRANCAS_POR_EMPRESA);
      expect(await contarItensDoLote(cenario.empresaId)).toBe(itensAntes + COBRANCAS_POR_EMPRESA);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-944 (c) — a empresa SEM certificado vigente: lote INTERROMPIDO, tarefa concluída
// ===========================================================================

describe('CT-944 (c) — sem certificado vigente, o lote é interrompido e a tarefa termina bem', () => {
  it(
    'CT-944 (c) — o lote fica INTERROMPIDA nomeando a causa, nada é pedido ao provedor, e a tarefa conclui',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, {
        comCertificado: false,
        competencia: COMPETENCIA_SEM_CERTIFICADO,
      });
      const itensAntes = await contarItensDoLote(cenario.empresaId);

      const adaptador = adaptadorQueAceita();
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(fila, {
        empresaId: cenario.empresaId,
        loteId: cenario.loteId,
      });

      // A TAREFA CONCLUI, e é essa metade que a decisão de projeto carrega: deixar o erro subir
      // queimaria as três tentativas, o lote ficaria `EM_ANDAMENTO` para sempre e o índice único
      // parcial recusaria toda abertura seguinte da empresa.
      expect(await tarefa.getState()).toBe('completed');

      // NADA foi pedido ao provedor: a ausência do certificado é reconhecida ANTES da decifra e antes
      // da rede. Um percurso que tentasse emitir sem certificado cairia aqui.
      expect(adaptador.pedidos).toEqual([]);

      // E o DESFECHO gravado, com a causa legível: é o que o Admin lê na prestação de contas para
      // saber que precisa cadastrar o certificado e reabrir. `INTERROMPIDA` sem motivo seria o pior
      // desfecho da CA-03.
      const lote = await emUnidade(cenario.empresaId, async (tx) => lerLote(tx, cenario.loteId));

      expect(lote?.estado).toBe('INTERROMPIDA');
      expect(lote?.motivoDaInterrupcao).toBe(MOTIVO_SEM_CERTIFICADO);
      expect(lote?.emitidas).toBe(0);
      expect(lote?.recusadas).toBe(0);
      expect(await contarItensDoLote(cenario.empresaId)).toBe(itensAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-944 (d) — o discriminador da reentrância: o benigno conclui, o GRAVE sobe
// ===========================================================================

describe('CT-944 (d) — a recusa do desfecho NÃO é engolida em bloco', () => {
  it(
    'CT-944 (d) — o reenvio sobre um lote JÁ CONCLUÍDO termina completo, sem refazer nada',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, {
        competencia: COMPETENCIA_DO_REENVIO,
      });

      const adaptador = adaptadorQueAceita();
      const fila = montarConsumidor(adaptador.porta);

      // A primeira passada: ela conclui o lote, e é o estado que ela deixa que o reenvio encontra.
      const primeira = await executarJob(fila, {
        empresaId: cenario.empresaId,
        loteId: cenario.loteId,
      });

      expect(await primeira.getState()).toBe('completed');
      expect(adaptador.pedidos).toHaveLength(COBRANCAS_POR_EMPRESA);
      const itensDepoisDaPrimeira = await contarItensDoLote(cenario.empresaId);

      // O REENVIO — a MESMA carga, que é o que a entrega *at-least-once* desta fila produz quando a
      // tentativa anterior comitou e o processo caiu antes do reconhecimento.
      const reenvio = await executarJob(fila, {
        empresaId: cenario.empresaId,
        loteId: cenario.loteId,
      });

      // ⚠️ ESTA é a asserção que discrimina: `concluirLote` NÃO alcança a linha (o desfecho já está
      // gravado) e levanta `ErroDeLoteNaoAlcancado`. Sem a releitura que reconhece o reenvio, o erro
      // subiria e a tarefa terminaria `failed`, queimando as três tentativas de um trabalho que já
      // fora feito.
      expect(await reenvio.getState()).toBe('completed');

      // E NADA foi refeito: nem pedido ao provedor, nem item novo. É o par que impede o caso de ser
      // satisfeito por um reenvio que emitisse tudo de novo e concluísse por outro caminho.
      expect(adaptador.pedidos).toHaveLength(COBRANCAS_POR_EMPRESA);
      expect(await contarItensDoLote(cenario.empresaId)).toBe(itensDepoisDaPrimeira);

      const lote = await emUnidade(cenario.empresaId, async (tx) => lerLote(tx, cenario.loteId));
      expect(lote?.estado).toBe('CONCLUIDA');
      expect(lote?.emitidas).toBe(COBRANCAS_POR_EMPRESA);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-944 (d) — o desfecho que não alcança linha alguma FALHA, e não termina como sucesso',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, {
        competencia: COMPETENCIA_DO_DESFECHO_PERDIDO,
      });

      // O adaptador APAGA o lote na primeira chamada e recusa com falha DA_EMPRESA: o percurso cessa
      // sem gravar item (é o que `executarEmissaoEmLote` faz com essa classe) e chama `interromper`,
      // que não alcança linha alguma. É o **caso grave** — a escrita não teve efeito em tentativa
      // nenhuma, e o lote não tem desfecho gravado porque ele não existe mais.
      const adaptador = adaptadorQueApagaOLoteERecusa(cenario.empresaId, cenario.loteId);
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(
        fila,
        { empresaId: cenario.empresaId, loteId: cenario.loteId },
        UMA_TENTATIVA,
      );

      // ⚠️ ESTA é a asserção que discrimina o `catch` em bloco que o cabeçalho de
      // `emissao-em-lote.ts` proíbe por escrito (`catch (e) { if (e instanceof
      // ErroDeLoteNaoAlcancado) return; }`): com ele, a tarefa terminaria `completed` — dizendo ao
      // operador o oposto da verdade sobre um lote que não foi desfechado.
      expect(await tarefa.getState()).toBe('failed');
      // E a razão é a da RECUSA DO DESFECHO, e não uma falha de driver qualquer: é ela que diz ao
      // operador que a interrupção não alcançou linha alguma.
      expect(tarefa.failedReason).toBeTypeOf('string');
      expect(tarefa.failedReason).toContain(RECUSA_DA_INTERRUPCAO);
      // A ÂNCORA ANTIVÁCUO do arranjo: o adaptador de fato correu — sem esta linha, um `failed`
      // vindo de qualquer erro anterior à emissão satisfaria o caso.
      expect(adaptador.apagou).toBe(true);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-944 (f) — a OUTRA metade da reentrância: o reenvio sobre o lote INTERROMPIDO
// ===========================================================================

describe('CT-944 (f) — o reenvio sobre o lote interrompido por falta de certificado conclui', () => {
  it(
    'CT-944 (f) — a segunda passada da empresa sem certificado termina completa, sem reescrever o desfecho',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, {
        comCertificado: false,
        competencia: COMPETENCIA_DO_REENVIO_SEM_CERTIFICADO,
      });
      const itensAntes = await contarItensDoLote(cenario.empresaId);

      const adaptador = adaptadorQueAceita();
      const fila = montarConsumidor(adaptador.porta);
      const carga = { empresaId: cenario.empresaId, loteId: cenario.loteId };

      // A PRIMEIRA passada interrompe o lote. É o estado que ela deixa que o reenvio encontra, e as
      // asserções que vão daqui até `interrompidoEm` são a âncora contra satisfação espúria: sem
      // elas, um caso em que a primeira passada tivesse falhado — e o "reenvio" fosse, de fato, a
      // primeira interrupção que deu certo — satisfaria o `completed` de baixo sem ter reentrado
      // sobre coisa alguma.
      //
      // ⚠️ O recorte é NOMEADO, e não contado: numeral em prosa envelhece na primeira asserção
      // acrescentada, e convida a próxima rodada a "corrigir" o código para caber nele. É a
      // preferência que o Gate 1 desta fatia registrou, e o fecho do `D57 · F4/T16`.
      const primeira = await executarJob(fila, carga);

      expect(await primeira.getState()).toBe('completed');

      const loteDepoisDaPrimeira = await emUnidade(cenario.empresaId, async (tx) =>
        lerLote(tx, cenario.loteId),
      );

      expect(loteDepoisDaPrimeira?.estado).toBe('INTERROMPIDA');
      expect(loteDepoisDaPrimeira?.motivoDaInterrupcao).toBe(MOTIVO_SEM_CERTIFICADO);
      expect(loteDepoisDaPrimeira?.interrompidoEm).toBeTypeOf('string');

      // O REENVIO — a MESMA carga, que é o que a entrega *at-least-once* produz quando a tentativa
      // anterior comitou e o processo caiu antes do reconhecimento. Ele corre com UMA tentativa: um
      // `completed` obtido por repetição da fila não provaria que a passada tratou a reentrância.
      const reenvio = await executarJob(fila, carga, UMA_TENTATIVA);

      // ⚠️ ESTA é a asserção que discrimina: `interromperLote` NÃO alcança a linha no reenvio (o
      // `interrompido_em IS NULL` da instrução deixa de casar) e levanta `ErroDeLoteNaoAlcancado`.
      // Com a recusa sem tratamento neste percurso, o erro sobe e a tarefa termina `failed` sobre um
      // lote que está corretamente `INTERROMPIDA` — dizendo ao operador o oposto da verdade.
      expect(await reenvio.getState()).toBe('completed');

      const loteDepoisDoReenvio = await emUnidade(cenario.empresaId, async (tx) =>
        lerLote(tx, cenario.loteId),
      );

      // E o desfecho da PRIMEIRA passada sobrevive intacto — carimbo e motivo. É a segunda metade da
      // âncora: ela reprova a "correção" que tornasse a interrupção idempotente por SOBRESCRITA, em
      // que a tarefa também terminaria `completed`, mas o instante em que a emissão parou seria o do
      // reenvio e o motivo original teria sido reescrito sem deixar rastro.
      expect(loteDepoisDoReenvio?.estado).toBe('INTERROMPIDA');
      expect(loteDepoisDoReenvio?.motivoDaInterrupcao).toBe(MOTIVO_SEM_CERTIFICADO);
      expect(loteDepoisDoReenvio?.interrompidoEm).toBe(loteDepoisDaPrimeira?.interrompidoEm);

      // E NADA foi tentado nem gravado em nenhuma das duas passadas: sem certificado vigente, a
      // ausência é reconhecida antes da decifra e antes da rede.
      expect(adaptador.pedidos).toEqual([]);
      expect(await contarItensDoLote(cenario.empresaId)).toBe(itensAntes);
      expect(loteDepoisDoReenvio?.emitidas).toBe(0);
      expect(loteDepoisDoReenvio?.recusadas).toBe(0);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-944 (e) — ADR-0032: a medição das DUAS superfícies de saída novas do processo
// ===========================================================================

describe('CT-944 (e) — o claro do certificado não alcança o diário nem o motivo da falha', () => {
  it(
    'CT-944 (e) — com o erro subindo COM o claro em escopo, nada do segredo sai pelo diário nem pelo failedReason',
    async () => {
      const cenario = await semearCenario(EMPRESA_A.id, {
        competencia: COMPETENCIA_DA_MEDICAO,
      });
      const agulhas = { ...agulhasDoArranjo };

      // O CONTROLE POSITIVO, antes de qualquer afirmação de ausência: sem ele, uma varredura quebrada
      // devolveria lista vazia e este caso aprovaria um processo vazando tudo (AP-29).
      expect(ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)).toEqual(
        rotulosDoControle(agulhas),
      );
      // E a âncora do próprio conjunto de agulhas: elas são as dos cenários que este arquivo semeou, e
      // um mapa vazio faria toda ausência abaixo passar por vacuidade.
      expect(Object.keys(agulhas).length).toBeGreaterThanOrEqual(AGULHAS_POR_SEGREDO);

      const linhasAntes = (await lerLinhasDoDiario()).length;

      // O ADAPTADOR LEVANTA — e ele levanta DEPOIS de receber o invólucro, isto é, com o claro já
      // decifrado e vivo no escopo do percurso. É o caminho de falha que o achado crítico da fase
      // anterior percorreu: o erro sobe intacto, o consumidor o registra CRU em `fila.ts`
      // (`logger.error({ …, erro })`) e a biblioteca de fila grava a mensagem dele no servidor.
      const adaptador = adaptadorQueLevanta();
      const fila = montarConsumidor(adaptador.porta);

      const tarefa = await executarJob(
        fila,
        { empresaId: cenario.empresaId, loteId: cenario.loteId },
        UMA_TENTATIVA,
      );

      // As DUAS âncoras de que os canais foram de fato exercitados, antes de qualquer ausência:
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
      // arquivo, inclusive os de sucesso — e o `failedReason` lido do servidor de fila, nas três
      // serializações. A igualdade com lista vazia, e não `toHaveLength(0)`: é ela que faz a
      // reprovação NOMEAR o canal e a agulha ofensora.
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

/** O adaptador de teste, com os pedidos que chegaram a ele — a lista prova o que NÃO foi tentado. */
interface AdaptadorDeTeste {
  readonly porta: AdaptadorCobrancaBancaria;
  readonly pedidos: readonly PedidoDeEmissao[];
}

/**
 * A operação que a emissão **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: um percurso que consultasse a situação ou pedisse revogação durante a
 * emissão derrubaria o caso no ponto, em vez de passar despercebido por ninguém ter olhado.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`a emissão em lote chamou uma operação que ela não deve chamar: ${nome}`);
  };
}

/**
 * Uma implementação de `AdaptadorCobrancaBancaria` que aceita toda emissão.
 *
 * O boleto devolvido é derivado do `identificadorNoProvedor` **recebido no pedido**, e não de um valor
 * combinado: é isso que permite ao caso afirmar que o identificador gravado é o que foi ENVIADO.
 */
function adaptadorQueAceita(): AdaptadorDeTeste {
  const pedidos: PedidoDeEmissao[] = [];

  const porta: AdaptadorCobrancaBancaria = {
    emitir: async (pedido) => {
      pedidos.push(pedido);

      const valor: BoletoEmitido = {
        numeroDoTituloNoProvedor: `T-${pedido.identificadorNoProvedor}`,
        linhaDigitavel: `L-${pedido.identificadorNoProvedor}`,
        codigoDeBarras: `B-${pedido.identificadorNoProvedor}`,
        documento: Buffer.from(`${PREFIXO_DO_DOCUMENTO}${pedido.identificadorNoProvedor}`),
      };

      return { aceito: true, valor };
    },
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    consultarSituacao: operacaoNaoEsperada('consultarSituacao'),
  };

  return { porta, pedidos };
}

/**
 * Conecta a fila real e registra o consumidor da emissão em lote com o adaptador informado.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.emissaoEmLote, …)`, com a borda recebendo o acesso ao banco, o adaptador, a guarda
 * e a chave de cifra por parâmetro. A única diferença é qual implementação da porta a composição
 * injeta — e é justamente essa a diferença que a operação também tem entre si mesma e a verificação.
 */
function montarConsumidor(adaptador: AdaptadorCobrancaBancaria): Fila {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.emissaoEmLote,
    async (tarefa, registrador) =>
      await processarEmissaoEmLote(tarefa, registrador, {
        banco: acesso,
        adaptador,
        guarda: criarGuardaDosBoletos(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  return fila;
}

/** A guarda de produção, apontada para o diretório efêmero deste arquivo. */
function criarGuardaDosBoletos(): GuardaDeBoletos {
  return criarGuardaDeBoletos(diretorioDosBoletos);
}

/** O adaptador do caso GRAVE, com a marca de que ele de fato correu. */
interface AdaptadorQueApaga {
  readonly porta: AdaptadorCobrancaBancaria;
  /** `true` depois de o lote ter sido apagado — a âncora antivácuo do `CT-944 (d)`. */
  readonly apagou: boolean;
}

/**
 * Um adaptador que **apaga o lote** e recusa com falha `DA_EMPRESA` — a precondição do caso grave.
 *
 * A falha `DA_EMPRESA` cessa o percurso **sem gravar item** para a cobrança que a recebeu (é o que
 * `executarEmissaoEmLote` faz com essa classe), de modo que o `DELETE` não esbarra na chave
 * estrangeira dos itens. O que sobra é exatamente o estado que a borda precisa distinguir:
 * `interromperLote` não alcança linha alguma, e a releitura **também não** — o lote não existe mais.
 *
 * A remoção é escrita em SQL cru porque **nenhuma porta pública apaga lote**: o percurso legítimo
 * nunca produz este estado, e é justamente por isso que ele é o caso grave. Sem `WHERE empresa_id` —
 * quem recorta é a política (ADR-0008).
 */
function adaptadorQueApagaOLoteERecusa(empresaId: string, loteId: string): AdaptadorQueApaga {
  const marca = { apagou: false };

  const porta: AdaptadorCobrancaBancaria = {
    emitir: async () => {
      await emUnidade(empresaId, async (tx) => {
        await tx`DELETE FROM negocio.emissao_em_lote WHERE id = ${loteId}`;
      });
      marca.apagou = true;

      return {
        aceito: false,
        classe: 'DA_EMPRESA',
        motivo: 'o provedor recusou a identidade da empresa',
      };
    },
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    consultarSituacao: operacaoNaoEsperada('consultarSituacao'),
  };

  return {
    porta,
    get apagou(): boolean {
      return marca.apagou;
    },
  };
}

/** O adaptador que levanta, com a marca de que o invólucro do segredo chegou até ele. */
interface AdaptadorQueLevanta {
  readonly porta: AdaptadorCobrancaBancaria;
  /** `true` depois de o pedido ter chegado **com** o invólucro — a âncora do `CT-944 (e)`. */
  readonly recebeuOSegredo: boolean;
}

/**
 * Um adaptador que **levanta** ao ser chamado — o caminho em que o erro sobe com o claro em escopo.
 *
 * É a forma de uma falha de rede no aperto de mão: o invólucro já foi decifrado e entregue, e a
 * exceção sobe intacta pela borda até o consumidor, que a registra **crua** em `fila.ts` e cuja
 * mensagem a biblioteca de fila grava no servidor. É esse par de superfícies que o `CT-944 (e)` mede.
 *
 * ⚠️ **A exceção NÃO carrega nada do segredo**, e a ausência é deliberada: plantar o claro nela seria
 * violar o contrato de quem recebe `abrir()` (ver `packages/shared/src/segredo-operavel.ts`) e mediria
 * o dublê, não o produto. O que o caso mede é se **o produto** — a borda, o registrador e a biblioteca
 * de fila — deixa escapar o que passou por ele.
 */
function adaptadorQueLevanta(): AdaptadorQueLevanta {
  const marca = { recebeuOSegredo: false };

  const porta: AdaptadorCobrancaBancaria = {
    emitir: async (pedido) => {
      // A marca é a prova de que o claro ESTAVA em escopo quando o erro subiu: o invólucro chegou ao
      // adaptador, o que só acontece depois de `decifrarSegredo` ter corrido na borda.
      marca.recebeuOSegredo = pedido.segredo !== undefined;

      throw new Error(FALHA_DO_ADAPTADOR);
    },
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    consultarSituacao: operacaoNaoEsperada('consultarSituacao'),
  };

  return {
    porta,
    get recebeuOSegredo(): boolean {
      return marca.recebeuOSegredo;
    },
  };
}

/** As linhas não vazias do arquivo de diário do processo — a superfície que o `CT-944 (e)` varre. */
async function lerLinhasDoDiario(): Promise<string[]> {
  const conteudo = await readFile(arquivoDoDiario, 'utf8');

  return conteudo.split('\n').filter((linha) => linha.trim() !== '');
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` **não** encerram a
 * espera, e é essa distinção que faz o caso observar o desfecho depois de eventual repetição.
 */
async function executarJob(
  fila: Fila,
  carga: CargaDaEmissaoEmLote,
  tentativas?: number,
): Promise<TarefaDaEmissaoEmLote> {
  const enfileirada = await fila.emissaoEmLote.add(
    FILA_DA_EMISSAO_EM_LOTE,
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
      const estado = await (await fila.emissaoEmLote.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.emissaoEmLote.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par da operação. Ele monta o estado; **nunca** o contexto do job,
 * que nasce na borda a partir da carga.
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

/** Um cenário montado: a empresa, o lote aberto e os códigos das cobranças elegíveis dela. */
interface Cenario {
  readonly empresaId: string;
  readonly loteId: string;
  readonly codigos: readonly string[];
  readonly nomeDoLocatario: string;
  /**
   * O par em claro que o arranjo cifrou e gravou — `undefined` quando o cenário nasceu **sem**
   * certificado vigente.
   *
   * Ele é **devolvido**, e não descartado dentro de `gravarCertificadoVigente` como era: é dele que
   * saem as agulhas do `CT-944 (e)`, e uma agulha inventada mediria uma cadeia que nunca entrou no
   * produto.
   */
  readonly segredo: SegredoDoArranjo | undefined;
}

/** O que `semearCenario` aceita variar. */
interface OpcoesDoCenario {
  /** `false` monta a empresa **sem** certificado vigente — o ramo que o `CT-944 (c)` percorre. */
  readonly comCertificado?: boolean;
  /**
   * A competência do lote e das cobranças — {@link COMPETENCIA} quando não informada.
   *
   * Ela é variável porque `selecionarCobrancasSemBoleto` recorta por **competência**, e não por lote:
   * dois cenários da mesma empresa na mesma competência veriam o conjunto um do outro, e a contagem
   * de um caso passaria a descrever o resíduo do anterior. Cada caso que semeia mais de uma vez a
   * empresa A declara a sua.
   */
  readonly competencia?: string;
}

/**
 * O usuário que dispara os lotes de uma empresa — **derivado da carga inicial**, nunca redigitado.
 *
 * O par `(usuario, empresa)` que a chave estrangeira composta cobra é o mesmo que `semente.ts`
 * gravou, e copiar o identificador criaria uma segunda declaração livre para divergir.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }

  return usuario;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 70_000_000_000;

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
 * Semeia a empresa inteira: cadastros, contrato, certificado vigente, cobranças e o lote aberto.
 *
 * Tudo pelas **portas públicas** de `@sysloc/db`, sob o contexto da própria empresa — é o caminho
 * legítimo, e é o que faz o estado do arranjo ser indistinguível do que a operação produz.
 */
async function semearCenario(empresaId: string, opcoes: OpcoesDoCenario = {}): Promise<Cenario> {
  sequencia += 1;
  const marca = `t16-${String(sequencia)}`;
  const nomeDoLocatario = `Locatário ${marca}`;
  const competencia = opcoes.competencia ?? COMPETENCIA;

  // O certificado é gravado ANTES de tudo, e a retirada acontece depois de gravado: a empresa é a
  // mesma entre os casos, e um cenário "sem certificado" que apenas deixasse de gravar herdaria o
  // vigente que um caso anterior deixou.
  const segredo = await gravarCertificadoVigente(empresaId);

  if (opcoes.comCertificado === false) {
    await retirarCertificadoVigente(empresaId);
  } else {
    Object.assign(agulhasDoArranjo, agulhasDoSegredo(marca, segredo));
  }

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
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(nomeDoLocatario));

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

  const codigos: string[] = [];
  for (let indice = 0; indice < COBRANCAS_POR_EMPRESA; indice += 1) {
    const cobranca = await emUnidade(empresaId, async (tx) => {
      const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

      return await criarCobranca(
        tx,
        {
          contratoId: contrato.id,
          natureza: 'ALUGUEL',
          referencia: `Aluguel ${marca}-${String(indice)}`,
          competencia,
          dataVencimento: VENCIMENTO_DA_COBRANCA,
          valorOriginal: VALOR_DA_COBRANCA,
        },
        { ano: anoDaCobranca, numero },
      );
    });

    codigos.push(cobranca.codigo);
  }

  const lote = await emUnidade(
    empresaId,
    async (tx) =>
      await abrirEmissaoEmLote(tx, {
        competencia,
        solicitadoPor: exigirUsuarioDa(empresaId).id,
      }),
  );

  return {
    empresaId,
    loteId: lote.id,
    codigos: codigos.sort(),
    nomeDoLocatario,
    segredo: opcoes.comCertificado === false ? undefined : segredo,
  };
}

/**
 * Grava um certificado **vigente** da empresa, com o envelope cifrado pela mesma chave da composição.
 *
 * O material é opaco para o banco (ADR-0032) e nada neste arquivo o abre: quem o abriria é o adaptador
 * de produção, que este arquivo não constrói. O que importa é que a borda **o resolve pelo banco** e o
 * decifra com a chave que recebeu — sem que nada de segredo tenha atravessado a fila.
 *
 * ⚠️ **O par em claro é DEVOLVIDO**, e não descartado aqui dentro como antes: ele é o dado que de fato
 * circula pelo produto (o banco guarda a cifra, a borda a decifra, o adaptador recebe o invólucro), e
 * é dele que o `CT-944 (e)` deriva as agulhas. Agulha que não venha daqui mediria uma cadeia que nunca
 * entrou — a variante oca que a ADR-0032 fecha ao exigir medição da saída real.
 *
 * O material carrega **bytes sorteados** além do prefixo legível: o recorte hexadecimal do miolo
 * precisa ser deste cofre, e um material só de texto previsível produziria agulha que outro cenário
 * também teria.
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
    // As duas pontas saem do relógio do BANCO (ADR-0026), e não de `new Date()` do processo: é o
    // mesmo eixo que `recusarCertificadoVencido` compara.
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
 * Retira o certificado vigente da empresa — a precondição do `CT-944 (c)`.
 *
 * É **a mesma instrução** que `registrarCertificado` executa para anular o anterior antes de inserir
 * o substituto, e ela está escrita aqui porque nenhuma porta pública produz o estado *"empresa sem
 * vigente"* sozinha: a porta que anula só existe acoplada à inserção do substituto. Sem `WHERE
 * empresa_id` — quem recorta é a política (ADR-0008).
 *
 * A `CHECK` da RN-13 é o que obriga o carimbo e o segredo a mudarem na **mesma** instrução: anular um
 * sem apagar o outro é irrepresentável.
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

/** Um item da prestação de contas, como a tabela o guarda. */
interface ItemLido {
  readonly codigo: string;
  readonly desfecho: string;
  readonly motivo: string | null;
}

/** Os itens de um lote, com o CÓDIGO da cobrança que cada um nomeia — sem cláusula de empresa. */
async function itensDoLote(empresaId: string, loteId: string): Promise<ItemLido[]> {
  return await emUnidade(empresaId, async (tx) => {
    const linhas = await tx<ItemLido[]>`
      SELECT c.codigo AS codigo, i.desfecho::text AS desfecho, i.motivo AS motivo
        FROM negocio.item_da_emissao_em_lote i
        JOIN negocio.cobranca c ON c.id = i.cobranca_id
       WHERE i.lote_id = ${loteId}
       ORDER BY c.codigo
    `;

    return linhas.map((linha) => ({
      codigo: linha.codigo,
      desfecho: linha.desfecho,
      motivo: linha.motivo,
    }));
  });
}

/** A contagem CRUA de itens alcançáveis sob o contexto informado — quem recorta é a política. */
async function contarItensDoLote(empresaId: string): Promise<number> {
  return await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total FROM negocio.item_da_emissao_em_lote
    `;

    return Number(linha?.total ?? '0');
  });
}

/** Os títulos gravados nas cobranças alcançáveis sob o contexto informado, em ordem de código. */
async function titulosGravados(empresaId: string): Promise<string[]> {
  return await emUnidade(empresaId, async (tx) => {
    const linhas = await tx<{ titulo: string }[]>`
      SELECT numero_do_titulo_no_provedor AS titulo
        FROM negocio.cobranca
       WHERE numero_do_titulo_no_provedor IS NOT NULL
       ORDER BY codigo
    `;

    return linhas.map((linha) => linha.titulo);
  });
}
