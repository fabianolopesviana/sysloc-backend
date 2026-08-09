/**
 * A porta de dados do contrato contra banco real — CT-403, CT-403 (b), CT-403 (c), CT-404, CT-405,
 * CT-407 e CT-407 (b). T5 da fatia `contratos-de-locacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-04    | CT-403 | Todo contrato recebe, ao nascer, um código `CTR-{ano}-{cinco dígitos}`, e a
 * |          |        | unicidade é por `(empresa, código)`: duas empresas emitindo no mesmo ano
 * |          |        | recebem **o mesmo** número, e nenhuma restrição global as impede; o segundo
 * |          |        | contrato da MESMA empresa recebe o **próximo**. O contrato nasce `RASCUNHO`,
 * |          |        | em circulação, com `dataFimLocacao` e `valorTotalContrato` **nulos**. |
 * | CA-04    | CT-403 | As DUAS traduções de `23505` são distintas, e **nenhuma outra é capturada**:
 * |          | (b)    | o código já em uso vira `ErroDeCodigoEmUso`; a violação de
 * |          |        | `contrato_fiador_contrato_fiador_key` sobe **intacta**, com o `code` e o nome
 * |          |        | da restrição do servidor, sem virar erro de domínio nenhum — e a unidade
 * |          |        | inteira desfaz, de modo que a contagem crua de contratos não muda. |
 * | CA-04    | CT-403 | O código é composto com o ano **recebido junto do número**, e não com um ano
 * |          | (c)    | relido na gravação: o número emitido pelo contador de um ano produz o código
 * |          |        | daquele ano, ainda que a gravação corra sob outro. É a virada do ano entre as
 * |          |        | duas unidades sequenciais, tornada irrepresentável pelo par. |
 * | CA-04    | CT-404 | O número emitido por uma unidade que **aborta** nunca é atribuído a contrato
 * |          |        | posterior: o contrato seguinte usa `N+1`, e **nenhuma** linha da empresa usa
 * |          |        | `N`. O furo é do mecanismo (a sequência não retrocede no desfazimento), e
 * |          |        | não promessa de disciplina. |
 * | CA-04    | CT-405 | Duas emissões concorrentes no mesmo `(empresa, ano)`, em conexões
 * |          |        | independentes e **antes de qualquer commit**, devolvem números **distintos**
 * |          |        | dentro de um limite declarado — nenhuma espera pela outra. |
 * | CA-07    | CT-407 | Com duas transações concorrentes ativando contratos distintos sobre o
 * |          |        | **mesmo** imóvel, exatamente **uma** commita: a vencedora fica `ATIVO` e o
 * |          |        | imóvel `LOCADO`; a perdedora recebe `ErroDeImovelComContratoVigente`
 * |          |        | discriminada pelo **código da vencedora**, e o contrato dela segue
 * |          |        | `RASCUNHO`. O mecanismo é o índice único parcial — a tentativa crua recebe
 * |          |        | `23505` nomeando `contrato_imovel_vigente_uidx` —, e ele é **parcial**:
 * |          |        | cancelado o vigente, a ativação seguinte sobre o mesmo imóvel passa. |
 * | CA-07    | CT-407 | A **alteração** também alcança o índice, porque `imovel_id` é a chave dele:
 * |          | (b)    | mover um contrato vigente para imóvel já ocupado recebe a **mesma**
 * |          |        | `ErroDeImovelComContratoVigente`, discriminada pelo vigente do imóvel de
 * |          |        | **destino** — nunca pelo contrato que está sendo movido —, nada é gravado, e
 * |          |        | o mesmo movimento para um imóvel livre **passa**. |
 *
 * Rastreabilidade: `CA-04 → CT-403 (RN-04)` · `CA-04 → CT-403 (b) (RN-04)` ·
 * `CA-04 → CT-403 (c) (RN-04)` · `CA-04 → CT-404 (RN-04)` · `CA-04 → CT-405 (RN-04)` ·
 * `CA-07 → CT-407 (RN-09)` · `CA-07 → CT-407 (b) (RN-09)`.
 *
 * ===========================================================================
 * POR QUE A CONCORRÊNCIA É REAL, E NÃO SIMULADA
 * ===========================================================================
 *
 * O CT-405 e o CT-407 são os dois casos que esta task existe para produzir, e **um caso sequencial
 * não os prova**:
 *
 *   * uma emissão depois da outra devolveria números distintos mesmo sob um mecanismo de **fila** —
 *     que é o modo rejeitado nomeado pela ADR-0020 (*"criações concorrentes não esperam umas pelas
 *     outras"*). Só duas emissões **abertas ao mesmo tempo**, nenhuma commitada, distinguem as duas
 *     implementações: sob a fila, a segunda bloquearia até a primeira commitar — e como a primeira só
 *     commita depois de a segunda ter emitido, o caso **trava** e o limite declarado o acusa;
 *   * uma ativação depois da outra seria recusada também por um `if` que lesse antes de gravar. O
 *     que discrimina é a **sobreposição**: a segunda transação escreve enquanto a primeira ainda não
 *     commitou, de modo que uma leitura-antes-de-gravar **não veria** o contrato vigente e as duas
 *     passariam. Aqui a segunda fica bloqueada no índice e, no commit da primeira, recebe `23505`.
 *
 * Por isso cada uma das duas transações mora numa **reserva de conexão própria** (`abrirAcessoAoBanco`
 * dedicado), e a sobreposição é **verificada**, não presumida: o CT-407 sonda `pg_stat_activity` até
 * ver a sessão que espera pelo bloqueio, com limite de tempo nomeado — nunca com espera fixa.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * As duas tabelas do contrato nascem sob RLS **forçada** (`migracoes/0008_seguranca_contrato.sql`), e
 * as duas funções da série levantam sem contexto: ler e escrever exige contexto de tenant fixado. O
 * contexto vem **exclusivamente** da API pública do pacote — `contextoDeTenant.executarCom` mais
 * `abrirAcessoAoBanco` —, que é o mesmo caminho da operação e o mesmo que `isolamento.spec.ts` usa
 * (CT-302/CT-303).
 *
 * **Nenhuma conexão privilegiada é aberta neste arquivo, nenhuma consulta compara `empresa_id`, e
 * nenhum símbolo foi acrescentado a `packages/db/src/**` para que estas provas existam** (Iron Law
 * #6, ADR-0006, ADR-0008). Todo cadastro do cenário — conjunto, imóvel, locador, locatário e fiadores
 * — nasce pelas portas públicas do pacote, e a criação de contrato segue o mesmo protocolo de **duas
 * unidades sequenciais** que a borda usará (tech spec §7.4).
 *
 * As duas consultas cruas que existem aqui (`negocio.contrato` e `pg_stat_activity`) são
 * **observação**, não caminho de escrita: elas leem o que a porta gravou, sob a mesma política, para
 * que "nenhuma linha usa N" e "exatamente uma commitou" sejam afirmações sobre o banco, e não sobre o
 * valor que a porta devolveu.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os oito reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` pedem demonstrar que a
 * prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * `packages/db/src/contrato.ts` — os quatro últimos na **rodada 2**, junto das correções do Gate 2 —
 * e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca por
 * `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `13 arquivos, 81 casos, 0 falhas` na rodada 1; `83 casos` na
 *     rodada 2, com o `CT-403 (c)` e o `CT-407 (b)`;
 *   * **M1 · a tradução de `23505` deixa de discriminar a restrição** (`ehViolacaoDe` passa a comparar
 *     só o `code`): `1 failed | 80 passed` — o `CT-403 (b)` reprova em
 *     `expected undefined to be '23505'`, porque a colisão do vínculo de fiador passa a ser relatada
 *     ao cliente como `ErroDeCodigoEmUso`, que não carrega `code` algum. É a medida literal de
 *     *"nenhuma outra `23505` é capturada"*;
 *   * **M2 · a ativação perde a tradução** (`ativarContrato` grava sem `gravarSobIndiceDeVigencia`):
 *     `1 failed | 80 passed` — o `CT-407` reprova em
 *     `expected PostgresError: duplicate key value violat… to be an instance of
 *     ErroDeImovelComContratoVigente`: a transação perdedora passa a receber o erro cru do driver, que
 *     na borda viraria `500`;
 *   * **M3 · o discriminante mente** (`lerCodigoDoContratoVigente` devolve o código **pedido** em vez
 *     do vigente): `1 failed | 80 passed` — o `CT-407` reprova em
 *     `expected 'CTR-2026-00010' to be 'CTR-2026-00009'`. Sem esta asserção, o M2 e o M3 seriam
 *     indistinguíveis pela suíte: os dois deixariam a classe certa subir com o conteúdo errado;
 *   * **M4 · o nulo vira zero** (`contratoPublicado` converte `valorTotalContrato` sem o ramo do
 *     nulo): `1 failed | 80 passed` — o `CT-403` reprova em `expected +0 to be null`, que é a
 *     distinção entre *"ainda não derivado"* e *"vale zero"* que a RD-10 exige;
 *   * **M5 · a ALTERAÇÃO perde a tradução** (`alterarContrato` volta a gravar direto no `tx`, sem
 *     `gravarSobIndiceDeVigencia` — a forma que o Gate 2 reprovou): `1 failed | 82 passed` — o
 *     `CT-407 (b)` reprova em `expected PostgresError: duplicate key value violat… to be an instance
 *     of ErroDeImovelComContratoVigente`. É a medida de que a defesa **não** depende do `if` da
 *     RD-05, que vive noutra camada e ainda não existe;
 *   * **M6 · o discriminante volta a derivar do contrato PEDIDO** (`alterarContrato` passa
 *     `{ origem: 'contrato', codigo }`): `1 failed | 82 passed` — o `CT-407 (b)` reprova em
 *     `expected 'CTR-2026-00013' to be 'CTR-2026-00012'`, nomeando o contrato que está sendo movido
 *     em vez daquele que bloqueia o destino. Sem esta asserção, o M5 e o M6 seriam indistinguíveis:
 *     os dois deixariam a classe certa subir com o conteúdo errado;
 *   * **M7 · a criação volta a RELER o ano** (`criarContrato` compõe o código com
 *     `lerAnoDaSerieDeContrato` em vez do ano recebido): `1 failed | 82 passed` — o `CT-403 (c)`
 *     reprova, porque o número emitido pelo contador de um ano passa a compor o código de outro;
 *   * **M8 · a ordem dos `describe`** — este mutante é do próprio arquivo, e mede a
 *     `test_order_dependency` que o Gate 1 apontou: com o `CT-403 (b)` e o `CT-403 (c)` movidos para
 *     **antes** do `CT-403`, a forma anterior reprovava em
 *     `expected 'CTR-2026-00001' to be 'CTR-2026-00003'` — a igualdade entre as duas empresas, que
 *     só valia enquanto o `CT-403` fosse o primeiro do arquivo. Com o {@link ANO_DEDICADO_AO_CT403},
 *     a **mesma** reordenação passa `83 casos, 0 falhas`;
 *   * **reversão** — em cada mutante o arquivo foi restaurado de cópia e conferido idêntico por
 *     `diff -q`, e o controle voltou a `13 arquivos, 0 falhas`.
 *
 * Os mutantes M1 e M2 **não compilam** na forma mais óbvia (`noUnusedParameters` e `noUnusedLocals`
 * acusam o parâmetro e o envoltório que deixariam de ser lidos), e por isso foram escritos na forma
 * que preserva o uso do símbolo sem preservar o efeito — a compilação não é a rede aqui, e tomá-la
 * como tal daria por provado o que só a asserção prova.
 */

import { formatarCodigoDeContrato } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  alterarContrato,
  ativarContrato,
  cancelarContrato,
  criarContrato,
  type DadosDoContrato,
  ErroDeCodigoEmUso,
  ErroDeImovelComContratoVigente,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
  localizarContrato,
} from '../src/contrato.ts';
import { derivarTerminoDaLocacao, derivarValorTotal } from '../src/derivacao-de-contrato.ts';
import { criarImovel, definirSituacaoDeLocacaoDoImovel, localizarImovel } from '../src/imovel.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso escreve poucas linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/**
 * O teto das DUAS emissões concorrentes do CT-405, medidas **antes de qualquer commit**.
 *
 * Ele não mede desempenho: ele discrimina implementações. Sob o mecanismo de linha travada que a
 * ADR-0020 rejeita, a segunda emissão esperaria o commit da primeira — que só acontece depois de a
 * segunda ter emitido —, e o caso ficaria pendurado até aqui. Duas chamadas de função no mesmo
 * agrupamento levam poucos milissegundos; o valor é folgado em três ordens de grandeza.
 */
const LIMITE_DA_EMISSAO_CONCORRENTE_MS = 5_000;

/** Até quando o CT-407 sonda `pg_stat_activity` à espera da sessão bloqueada pelo índice. */
const LIMITE_DA_SONDAGEM_MS = 20_000;

/** O intervalo entre sondagens — espera por estado observável, nunca espera fixa por tempo. */
const INTERVALO_DA_SONDAGEM_MS = 25;

/** Reserva de UMA conexão: cada acesso deste arquivo corre sobre uma conexão física própria. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * A forma publicada do código, escrita **por extenso** — a única coisa deste arquivo que a redigita.
 *
 * Ela é a **decisão**, e não um valor que o caso descubra do próprio SUT: derivá-la de
 * `ESQUEMA_DO_CODIGO_DE_CONTRATO` faria o caso concordar com qualquer forma que o contrato viesse a
 * declarar — inclusive quatro dígitos, que o marcador `DECISÃO FECHADA` de
 * `packages/contracts/src/contrato.ts` existe para impedir. Mesmo desenho de `PAPEIS_DECLARADOS` em
 * `cadastro-de-pessoa.spec.ts`.
 */
const FORMA_DO_CODIGO = /^CTR-\d{4}-\d{5}$/;

/**
 * O ano da série que o CT-403 usa — **fixo, e nenhum outro caso o toca**.
 *
 * Ele existe porque aquele caso afirma a **posição** do contador de duas empresas (o número `1` para
 * cada uma, e a coincidência entre elas). No ano corrente, que a suíte inteira compartilha, isso só
 * seria verdade enquanto ele fosse o primeiro `describe` do arquivo: um caso inserido acima moveria
 * o contador de A sem tocar o de B. Com escopo exclusivo, os absolutos passam a ser verdade **por
 * construção**. A faixa que `negocio.garantir_contador_de_contrato` guarda é 2000–2999.
 */
const ANO_DEDICADO_AO_CT403 = 2001;

/** Os cadastros que um contrato precisa ter para nascer, todos criados pelas portas públicas. */
interface CenarioDeContrato {
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadorId: string;
}

/** Os campos que a porta grava; os cadastros entram por {@link dadosDoContrato}. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-03-01',
  prazoMeses: 12,
  valorMensal: 2500.5,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
  pdfContratoArquivo: null,
} as const;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-403 — o código nasce no formato certo, e a unicidade é POR EMPRESA
// ===========================================================================

describe('CT-403 — o código do contrato nasce `CTR-{ano}-{5 dígitos}`, único por empresa', () => {
  it(
    'duas empresas recebem o MESMO número no mesmo ano, e o segundo da mesma empresa recebe o próximo',
    async () => {
      const cenarioDeA = await semearCenario(CONTEXTO_DE_A, 'ct403-a');
      const cenarioDeB = await semearCenario(CONTEXTO_DE_B, 'ct403-b');

      // Este caso afirma a POSIÇÃO do contador — o número absoluto e a coincidência entre as duas
      // empresas —, e por isso corre num ano **dedicado a ele**. No ano corrente, que a suíte
      // inteira compartilha, as duas afirmações só valeriam enquanto este fosse o primeiro caso do
      // arquivo: um caso inserido acima moveria o contador de A sem tocar o de B, e a igualdade do
      // passo 2 reprovaria sem que nada tivesse quebrado.
      const ano = ANO_DEDICADO_AO_CT403;

      // --- Passo 1: o primeiro contrato da empresa A ------------------------------------------
      const primeiroDeA = await montarContrato(CONTEXTO_DE_A, cenarioDeA, ano);

      expect(primeiroDeA.codigo).toMatch(FORMA_DO_CODIGO);

      // O nascimento, afirmado no mesmo caso porque é o mesmo ato: `RASCUNHO`, em circulação, e as
      // duas derivações NULAS. `null` e não `0`: a distinção entre "ainda não derivado" e "vale
      // zero" é a RD-10, e ela desapareceria numa conversão sem o ramo do nulo.
      expect(primeiroDeA.status).toBe('RASCUNHO');
      expect(primeiroDeA.retiradoEm).toBeNull();
      expect(primeiroDeA.dataFimLocacao).toBeNull();
      expect(primeiroDeA.valorTotalContrato).toBeNull();
      // O que a porta gravou volta como foi informado — inclusive a data, que atravessa como cadeia
      // `YYYY-MM-DD` sem passar por `Date`, e o valor mensal, que volta do `numeric` como número.
      expect(primeiroDeA.dataInicioLocacao).toBe(TERMOS_DO_CONTRATO.dataInicioLocacao);
      expect(primeiroDeA.valorMensal).toBe(TERMOS_DO_CONTRATO.valorMensal);
      expect(primeiroDeA.fiadores).toEqual([{ id: cenarioDeA.fiadorId, nome: 'Fiador ct403-a' }]);

      // --- Passo 2: o primeiro contrato da empresa B, no MESMO ano ------------------------------
      //
      // O código é IGUAL, e essa igualdade é o caso: a unicidade é `(empresa_id, codigo)`, e cada
      // empresa tem contador próprio. Uma restrição global sobre `codigo` recusaria esta gravação, e
      // um contador global daria a B um número que ninguém pediu.
      const primeiroDeB = await montarContrato(CONTEXTO_DE_B, cenarioDeB, ano);

      expect(primeiroDeB.codigo).toBe(primeiroDeA.codigo);

      // --- Passo 3: o segundo contrato da empresa A ---------------------------------------------
      //
      // O número **seguinte**, e não um repetido: é o companheiro que impede o passo 2 de passar
      // sobre uma implementação que devolvesse sempre o mesmo código.
      const segundoDeA = await montarContrato(CONTEXTO_DE_A, cenarioDeA, ano);

      // Os absolutos `1` e `2` valem aqui porque o contador do ano dedicado nasce neste caso, para
      // as duas empresas. É a **igualdade do código inteiro**, e não só do sufixo: ela afirma
      // também o ano gravado e o preenchimento com zeros.
      expect(primeiroDeA.codigo).toBe(formatarCodigoDeContrato(ano, 1));
      expect(primeiroDeB.codigo).toBe(formatarCodigoDeContrato(ano, 1));
      expect(segundoDeA.codigo).toBe(formatarCodigoDeContrato(ano, 2));
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-403 (c) — o código carrega o ano do contador que emitiu o número
// ===========================================================================

describe('CT-403 (c) — o código é composto com o ano RECEBIDO junto do número', () => {
  it(
    'a porta não relê o ano na gravação: o par `{ano, numero}` chega junto e é gravado junto',
    async () => {
      const cenario = await semearCenario(CONTEXTO_DE_A, 'ct403c');
      const anoCorrente = await emUnidade(acesso, CONTEXTO_DE_A, lerAnoDaSerieDeContrato);

      // O contador de um ano que **não** é o corrente. É a forma direta do cenário que a virada do
      // ano produz entre as duas unidades sequenciais da borda: o número sai do contador de um ano e
      // a gravação acontece já no outro. Uma segunda leitura do ano dentro da porta comporia o
      // código com o ano da gravação — anunciando um contador que não emitiu aquele número.
      const anoDaSerie = anoCorrente - 1;

      await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        await garantirContadorDeContrato(tx, anoDaSerie);
      });

      let numeroEmitido = 0;

      const contrato = await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        numeroEmitido = await emitirNumeroDeContrato(tx, anoDaSerie);
        return await criarContrato(tx, dadosDoContrato(cenario), {
          ano: anoDaSerie,
          numero: numeroEmitido,
        });
      });

      expect(contrato.codigo).toBe(formatarCodigoDeContrato(anoDaSerie, numeroEmitido));
      // O companheiro que discrimina: o código NÃO é o que sairia de um ano relido na gravação. Sem
      // esta metade, a asserção acima passaria numa máquina cujo relógio coincidisse com o cenário.
      expect(contrato.codigo).not.toBe(formatarCodigoDeContrato(anoCorrente, numeroEmitido));

      // E o que foi gravado é o que a leitura devolve — a afirmação é sobre o banco, não sobre o
      // valor que a porta retornou.
      expect((await localizar(contrato.codigo))?.codigo).toBe(contrato.codigo);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-403 (b) — as duas traduções de `23505`, e nenhuma outra capturada
// ===========================================================================

describe('CT-403 (b) — a tradução de unicidade discrimina a restrição que recusou', () => {
  it(
    'o código em uso vira ErroDeCodigoEmUso, e a colisão do vínculo de fiador sobe INTACTA',
    async () => {
      const cenario = await semearCenario(CONTEXTO_DE_A, 'ct403b');

      const contrato = await montarContrato(CONTEXTO_DE_A, cenario);
      const ano = await emUnidade(acesso, CONTEXTO_DE_A, lerAnoDaSerieDeContrato);
      const numeroJaUsado = numeroDo(contrato.codigo);

      const contratosAntes = await lerCodigosCrus(CONTEXTO_DE_A);

      // --- O código já em uso ---------------------------------------------------------------
      //
      // O mesmo número é entregue à porta duas vezes. É a forma direta do cenário que a semeadura da
      // virada (F7) produz: `garantir_contador_de_contrato` aceita valor inicial, e um contador
      // reposicionado abaixo do último código emitido devolve número já gravado. Sem tradução, a
      // recusa chegaria ao cliente como erro de driver em `500`.
      const colisaoDeCodigo = await tentar(
        async () =>
          await emUnidade(
            acesso,
            CONTEXTO_DE_A,
            async (tx) =>
              await criarContrato(tx, dadosDoContrato(cenario), { ano, numero: numeroJaUsado }),
          ),
      );

      expect(colisaoDeCodigo.ok).toBe(false);
      expect(erroDe(colisaoDeCodigo)).toBeInstanceOf(ErroDeCodigoEmUso);
      // A mensagem não carrega o código recusado — o dado em disputa não entra em texto que chega ao
      // registro estruturado.
      expect(mensagemDe(colisaoDeCodigo)).not.toContain(contrato.codigo);

      // --- A violação de OUTRA restrição --------------------------------------------------------
      //
      // O mesmo fiador citado duas vezes viola `contrato_fiador_contrato_fiador_key`. Ela é `23505`
      // como a anterior, e **não** pode ser traduzida: dizer ao cliente que o código colidiu quando
      // quem colidiu foi o vínculo esconde o defeito atrás de um `422` plausível.
      const colisaoDeVinculo = await tentar(
        async () =>
          await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
            const numero = await emitirNumeroDeContrato(tx, ano);
            return await criarContrato(
              tx,
              dadosDoContrato(cenario, [cenario.fiadorId, cenario.fiadorId]),
              { ano, numero },
            );
          }),
      );

      expect(colisaoDeVinculo.ok).toBe(false);
      expect(sqlstate(erroDe(colisaoDeVinculo))).toBe('23505');
      expect(nomeDaRestricao(erroDe(colisaoDeVinculo))).toBe('contrato_fiador_contrato_fiador_key');
      // O par que discrimina: o erro sobe cru, sem virar NENHUM dos dois erros de domínio.
      expect(erroDe(colisaoDeVinculo)).not.toBeInstanceOf(ErroDeCodigoEmUso);
      expect(erroDe(colisaoDeVinculo)).not.toBeInstanceOf(ErroDeImovelComContratoVigente);

      // Nenhuma das duas recusas gravou coisa alguma: a contagem crua é a que separa "respondeu com
      // erro" de "respondeu com erro e não deixou linha para trás".
      expect(await lerCodigosCrus(CONTEXTO_DE_A)).toEqual(contratosAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-404 — a criação abortada queima o número para SEMPRE
// ===========================================================================

describe('CT-404 — criação abortada queima o número da série para sempre', () => {
  it(
    'o número reservado por uma unidade que desfaz nunca é atribuído a contrato posterior',
    async () => {
      const cenario = await semearCenario(CONTEXTO_DE_A, 'ct404');
      const ano = await emUnidade(acesso, CONTEXTO_DE_A, lerAnoDaSerieDeContrato);

      // --- Passo 1: a unidade 1 da borda, que COMMITA -------------------------------------------
      await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        await garantirContadorDeContrato(tx, ano);
      });

      const queimado = await emUnidade(
        acesso,
        CONTEXTO_DE_A,
        async (tx) => await emitirNumeroDeContrato(tx, ano),
      );

      // --- Passo 2: a unidade 2 aborta DEPOIS de o contador ter avançado -------------------------
      //
      // `prazoMeses: 0` viola `contrato_prazo_positivo_chk` — um `check`, e não a unicidade: a
      // recusa não passa por tradução nenhuma e derruba a unidade inteira, que é o cenário da
      // criação abortada.
      const abortada = await tentar(
        async () =>
          await emUnidade(
            acesso,
            CONTEXTO_DE_A,
            async (tx) =>
              await criarContrato(
                tx,
                { ...dadosDoContrato(cenario), prazoMeses: 0 },
                {
                  ano,
                  numero: queimado,
                },
              ),
          ),
      );

      expect(abortada.ok).toBe(false);
      expect(sqlstate(erroDe(abortada))).toBe('23514');

      // --- Passo 3: o contrato seguinte, criado NORMALMENTE --------------------------------------
      const seguinte = await montarContrato(CONTEXTO_DE_A, cenario);

      // O `N+1`, e não o `N`: a sequência não retrocedeu no desfazimento. Um contador em linha de
      // tabela — o mecanismo que a ADR-0020 rejeita — teria devolvido `N` aqui.
      expect(seguinte.codigo).toBe(formatarCodigoDeContrato(ano, queimado + 1));

      // E o furo é permanente: NENHUMA linha da empresa usa o número queimado. Sem esta metade, o
      // caso ficaria verde sobre uma implementação que gravasse o contrato abortado assim mesmo.
      const codigos = await lerCodigosCrus(CONTEXTO_DE_A);
      expect(codigos).not.toContain(formatarCodigoDeContrato(ano, queimado));
      expect(codigos).toContain(formatarCodigoDeContrato(ano, queimado + 1));
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-405 — duas emissões concorrentes NÃO esperam uma pela outra
// ===========================================================================

describe('CT-405 — duas emissões concorrentes obtêm números distintos sem esperar', () => {
  it(
    'as duas retornam antes de qualquer commit, dentro do limite declarado, com números diferentes',
    async () => {
      const ano = await emUnidade(acesso, CONTEXTO_DE_A, lerAnoDaSerieDeContrato);

      await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        await garantirContadorDeContrato(tx, ano);
      });

      // Duas reservas independentes: com uma só, a segunda unidade esperaria por CONEXÃO, e o caso
      // mediria a reserva em vez do contador.
      const primeiro = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const segundo = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      // O portão é o que mantém as DUAS transações abertas: cada uma emite, anuncia o número e só
      // então espera a liberação para commitar. Sob um mecanismo de fila, a segunda emissão nunca
      // anunciaria — ela estaria bloqueada esperando o commit da primeira, que só vem depois.
      const liberacao = portao<void>();
      const emitido = [portao<number>(), portao<number>()] as const;

      const emissao = (dono: AcessoAoBanco, indice: 0 | 1): Promise<number> =>
        emUnidade(dono, CONTEXTO_DE_A, async (tx) => {
          const numero = await emitirNumeroDeContrato(tx, ano);
          emitido[indice].abrir(numero);
          await liberacao.espera;
          return numero;
        });

      try {
        const inicio = Date.now();
        const emissoes = [emissao(primeiro, 0), emissao(segundo, 1)];

        const numeros = await comLimiteDeTempo(
          Promise.all([emitido[0].espera, emitido[1].espera]),
          LIMITE_DA_EMISSAO_CONCORRENTE_MS,
          'as duas emissões não retornaram antes do commit — uma esperou pela outra, que é o ' +
            'mecanismo de fila que a ADR-0020 rejeita',
        );
        const decorrido = Date.now() - inicio;

        // Números DISTINTOS: o contador é o mesmo objeto, e `nextval` nunca repete.
        expect(numeros[0]).not.toBe(numeros[1]);
        // E os dois vieram antes de qualquer commit, dentro do limite declarado.
        expect(decorrido).toBeLessThan(LIMITE_DA_EMISSAO_CONCORRENTE_MS);

        liberacao.abrir();
        expect(await Promise.all(emissoes)).toEqual(numeros);
      } finally {
        // A liberação é idempotente: se a asserção acima falhar, ela impede que as duas unidades
        // fiquem penduradas e o encerramento das reservas trave.
        liberacao.abrir();
        await primeiro.encerrar();
        await segundo.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-407 — duas ativações simultâneas sobre o mesmo imóvel
// ===========================================================================

describe('CT-407 — a vigência única por imóvel é do índice parcial, sob concorrência real', () => {
  it(
    'exatamente uma ativação commita; a outra recebe a recusa do banco e segue RASCUNHO',
    async () => {
      const cenario = await semearCenario(CONTEXTO_DE_A, 'ct407');

      // Três rascunhos sobre o MESMO imóvel: dois para a corrida e um para as duas pernas seguintes.
      const vencedor = await montarContrato(CONTEXTO_DE_A, cenario);
      const perdedor = await montarContrato(CONTEXTO_DE_A, cenario);
      const terceiro = await montarContrato(CONTEXTO_DE_A, cenario);

      const primeiro = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const segundo = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      const escreveu = portao<void>();
      const liberacao = portao<void>();

      try {
        // --- Passo 1: a transação vencedora escreve e SEGURA o commit ---------------------------
        const ativacaoVencedora = emUnidade(primeiro, CONTEXTO_DE_A, async (tx) => {
          const ativado = await ativarContrato(tx, vencedor.codigo, derivacoesDaAtivacao());
          await definirSituacaoDeLocacaoDoImovel(tx, cenario.imovelId, 'LOCADO');
          escreveu.abrir();
          await liberacao.espera;
          return ativado;
        });

        await escreveu.espera;

        // --- Passo 2: a segunda transação escreve enquanto a primeira ainda NÃO commitou ---------
        //
        // É esta sobreposição que discrimina o índice de um `if`: uma leitura-antes-de-gravar não
        // enxergaria o contrato vigente da transação aberta, e as duas ativações passariam.
        const ativacaoPerdedora = emUnidade(segundo, CONTEXTO_DE_A, async (tx) => {
          const ativado = await ativarContrato(tx, perdedor.codigo, derivacoesDaAtivacao());
          await definirSituacaoDeLocacaoDoImovel(tx, cenario.imovelId, 'LOCADO');
          return ativado;
        });

        // A sobreposição é VERIFICADA, e não presumida: sondagem por estado observável, com limite
        // declarado. Sem ela, a segunda transação poderia sequer ter começado quando a primeira
        // commitasse, e o caso viraria um teste sequencial disfarçado.
        await esperarSessaoBloqueada();

        liberacao.abrir();

        const desfechos = await Promise.allSettled([ativacaoVencedora, ativacaoPerdedora]);
        const [daVencedora, daPerdedora] = desfechos;

        // --- Passo 3: exatamente UMA commitou ----------------------------------------------------
        expect(desfechos.map((desfecho) => desfecho.status)).toEqual(['fulfilled', 'rejected']);

        expect(daVencedora?.status === 'fulfilled' ? daVencedora.value?.status : undefined).toBe(
          'ATIVO',
        );

        // --- Passo 4: a perdedora recebeu a recusa TRADUZIDA e DISCRIMINADA ----------------------
        const recusa = daPerdedora?.status === 'rejected' ? daPerdedora.reason : undefined;

        expect(recusa).toBeInstanceOf(ErroDeImovelComContratoVigente);
        // O discriminante é o código da VENCEDORA: sem esta asserção, uma tradução que devolvesse
        // qualquer código — o do próprio contrato recusado, por exemplo — passaria.
        expect((recusa as ErroDeImovelComContratoVigente).contratoVigente).toBe(vencedor.codigo);

        // --- Passo 5: o estado, lido do banco depois da poeira baixar ----------------------------
        expect((await localizar(vencedor.codigo))?.status).toBe('ATIVO');
        expect((await localizar(perdedor.codigo))?.status).toBe('RASCUNHO');
        // A transação perdedora desfez INTEIRA: a escrita da situação de locação dela não sobrou.
        expect((await localizarImovelDeA(cenario.imovelId))?.statusLocacao).toBe('LOCADO');
        expect(await contarVigentesDoImovel(cenario.imovelId)).toBe(1);

        // --- Passo 6: o MECANISMO tem nome -------------------------------------------------------
        //
        // A escrita crua contorna a tradução da porta e exibe quem recusou: é o índice, e não uma
        // conferência de aplicação. Sem esta perna, "a porta levanta a classe certa" seria
        // compatível com um `if` que lesse antes de gravar.
        const cru = await tentar(
          async () =>
            await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
              await tx`
                UPDATE negocio.contrato SET status = 'ATIVO' WHERE codigo = ${terceiro.codigo}
              `;
            }),
        );

        expect(cru.ok).toBe(false);
        expect(sqlstate(erroDe(cru))).toBe('23505');
        expect(nomeDaRestricao(erroDe(cru))).toBe('contrato_imovel_vigente_uidx');

        // --- Passo 7: o índice é PARCIAL ---------------------------------------------------------
        //
        // Cancelado o vigente, o mesmo imóvel aceita a ativação seguinte. É o companheiro que
        // impede a leitura "um imóvel nunca tem dois contratos" de virar "um imóvel nunca tem dois
        // contratos em estado nenhum" — que é o que uma restrição única total faria, quebrando o
        // recontrato.
        await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
          await cancelarContrato(tx, vencedor.codigo);
        });

        const reativado = await emUnidade(
          acesso,
          CONTEXTO_DE_A,
          async (tx) => await ativarContrato(tx, terceiro.codigo, derivacoesDaAtivacao()),
        );

        expect(reativado?.status).toBe('ATIVO');
        expect((await localizar(vencedor.codigo))?.status).toBe('CANCELADO');
      } finally {
        liberacao.abrir();
        await primeiro.encerrar();
        await segundo.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-407 (b) — a ALTERAÇÃO também alcança o índice, e a recusa é a mesma
// ===========================================================================

describe('CT-407 (b) — mover um contrato vigente para imóvel ocupado recebe a MESMA tradução', () => {
  it(
    'a recusa nomeia o vigente do imóvel de DESTINO, nada é gravado, e o destino livre passa',
    async () => {
      const origem = await semearCenario(CONTEXTO_DE_A, 'ct407b-origem');
      const destino = await semearCenario(CONTEXTO_DE_A, 'ct407b-destino');
      const livre = await semearCenario(CONTEXTO_DE_A, 'ct407b-livre');

      // Dois contratos **vigentes**, cada um sobre o seu imóvel. É o `status` já gravado — e não um
      // `status` que a alteração escreva, porque ela não escreve nenhum — que põe a linha do
      // `mudante` dentro de `contrato_imovel_vigente_uidx`.
      const ocupante = await montarContrato(CONTEXTO_DE_A, destino);
      const mudante = await montarContrato(CONTEXTO_DE_A, origem);

      await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        await ativarContrato(tx, ocupante.codigo, derivacoesDaAtivacao());
      });
      await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
        await ativarContrato(tx, mudante.codigo, derivacoesDaAtivacao());
      });

      const antes = await lerCodigosCrus(CONTEXTO_DE_A);

      // --- A alteração que move o contrato para o imóvel já ocupado -----------------------------
      const recusa = await tentar(
        async () =>
          await emUnidade(
            acesso,
            CONTEXTO_DE_A,
            async (tx) => await alterarContrato(tx, mudante.codigo, dadosDoContrato(destino)),
          ),
      );

      expect(recusa.ok).toBe(false);
      // A classe traduzida, e não o erro cru do driver: sem a tradução, a borda responderia `500` a
      // uma colisão que o cliente causou e pode corrigir.
      expect(erroDe(recusa)).toBeInstanceOf(ErroDeImovelComContratoVigente);
      expect(sqlstate(erroDe(recusa))).toBeUndefined();

      // O discriminante é o vigente do imóvel de DESTINO. Derivá-lo do contrato **pedido** — que
      // depois do desfazimento do ponto de retorno ainda aponta para o imóvel de ORIGEM — nomearia
      // o próprio `mudante`, isto é, quem está sendo movido em vez de quem bloqueia.
      const recusado = erroDe(recusa) as ErroDeImovelComContratoVigente;

      expect(recusado.contratoVigente).toBe(ocupante.codigo);
      expect(recusado.contratoVigente).not.toBe(mudante.codigo);

      // --- Nada foi gravado --------------------------------------------------------------------
      //
      // A contagem crua é o que separa "respondeu com erro" de "respondeu com erro e não deixou
      // linha para trás"; o imóvel do contrato é o que prova que o `UPDATE` recusado desfez.
      expect(await lerCodigosCrus(CONTEXTO_DE_A)).toEqual(antes);
      expect((await localizar(mudante.codigo))?.imovelId).toBe(origem.imovelId);
      expect((await localizar(mudante.codigo))?.status).toBe('ATIVO');

      // --- O companheiro que discrimina: o destino LIVRE passa ----------------------------------
      //
      // Sem esta perna, uma implementação que recusasse toda alteração de contrato vigente ficaria
      // indistinguível da tradução do índice.
      const movido = await emUnidade(
        acesso,
        CONTEXTO_DE_A,
        async (tx) => await alterarContrato(tx, mudante.codigo, dadosDoContrato(livre)),
      );

      expect(movido?.imovelId).toBe(livre.imovelId);
      // A alteração continua sem tocar o estado: o envoltório do índice não mudou o que a porta
      // escreve, só o que ela faz quando o banco recusa.
      expect(movido?.status).toBe('ATIVO');
      expect(movido?.fiadores).toEqual([{ id: livre.fiadorId, nome: 'Fiador ct407b-livre' }]);
      expect((await localizar(mudante.codigo))?.imovelId).toBe(livre.imovelId);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — todo acesso pela API pública do pacote, sob o contexto de cada empresa
// ---------------------------------------------------------------------------------------------

type Contexto = contextoDeTenant.ContextoDeTenant;

/** Uma unidade de trabalho sob o contexto informado — o caminho real da operação. */
async function emUnidade<T>(
  dono: AcessoAoBanco,
  contexto: Contexto,
  acao: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await dono.emUnidadeDeTrabalho(acao),
  );
}

/**
 * Cria, pelas portas públicas, os cadastros que um contrato precisa apontar.
 *
 * O sufixo entra em todo nome e documento para que os cenários dos cinco casos não disputem a
 * unicidade `(empresa, documento)` de cada papel, nem a `(empresa, identificador_municipal)` do
 * imóvel — a suíte compartilha uma instância só.
 */
async function semearCenario(contexto: Contexto, sufixo: string): Promise<CenarioDeContrato> {
  return await emUnidade(acesso, contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${sufixo}` });

    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${sufixo}`,
      identificadorMunicipal: `IPTU-${sufixo}`,
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

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${sufixo}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${sufixo}`));
    const fiador = await criarPessoa(tx, 'fiador', pessoaDe(`Fiador ${sufixo}`));

    return {
      imovelId: imovel.id,
      locadorId: locador.id,
      locatarioId: locatario.id,
      fiadorId: fiador.id,
    };
  });
}

/**
 * O documento do próximo cadastro — **só dígitos**, e distinto a cada chamada.
 *
 * A coluna guarda o documento normalizado por `somenteDigitos` (§6.2), de modo que um sufixo textual
 * desapareceria na gravação e os cenários dos cinco casos colidiriam na
 * `unique(empresa_id, documento_principal)` de cada papel — que foi o que aconteceu na primeira
 * escrita deste arquivo. O contador cresce por chamada e nunca repete dentro da execução.
 */
let proximoDocumento = 10_000_000_000;

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: 'contato@exemplo.com.br',
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

function dadosDoContrato(
  cenario: CenarioDeContrato,
  fiadoresIds: readonly string[] = [cenario.fiadorId],
): DadosDoContrato {
  return {
    imovelId: cenario.imovelId,
    locadorId: cenario.locadorId,
    locatarioId: cenario.locatarioId,
    fiadoresIds,
    ...TERMOS_DO_CONTRATO,
  };
}

/**
 * Monta um contrato **pelo protocolo das duas unidades sequenciais** que a borda usará (§7.4).
 *
 * A primeira unidade garante o contador e commita; a segunda emite o número e grava. Fundir as duas
 * é justamente o desenho que a ADR-0015 recusa, e um acessório que o fizesse tornaria o CT-404 uma
 * prova sobre outra coisa.
 *
 * O `anoDaSerie` é **opcional**, e existe para que um caso possa correr num escopo de contador
 * **exclusivo dele**. O ano corrente é compartilhado por toda a suíte, e a série é por
 * `(empresa, ano)`: um caso que afirme qualquer coisa sobre a **posição** do contador — o número
 * absoluto, ou a coincidência entre duas empresas — só é verdadeiro enquanto for o primeiro do
 * arquivo. Quem afirma posição declara o ano; quem não afirma omite, e usa o relógio do banco.
 */
async function montarContrato(contexto: Contexto, cenario: CenarioDeContrato, anoDaSerie?: number) {
  const ano = anoDaSerie ?? (await emUnidade(acesso, contexto, lerAnoDaSerieDeContrato));

  await emUnidade(acesso, contexto, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  return await emUnidade(acesso, contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);
    return await criarContrato(tx, dadosDoContrato(cenario), { ano, numero });
  });
}

/** As derivações da ativação, produzidas pelo ponto único da RD-10 — nunca recalculadas aqui. */
function derivacoesDaAtivacao() {
  return {
    dataFimLocacao: derivarTerminoDaLocacao(
      TERMOS_DO_CONTRATO.dataInicioLocacao,
      TERMOS_DO_CONTRATO.prazoMeses,
    ),
    valorTotalContrato: derivarValorTotal(
      TERMOS_DO_CONTRATO.valorMensal,
      TERMOS_DO_CONTRATO.prazoMeses,
    ),
  };
}

/** A leitura por código, pela porta, sob o contexto de A. */
async function localizar(codigo: string) {
  return await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => await localizarContrato(tx, codigo));
}

/** A leitura do imóvel, pela porta, sob o contexto de A. */
async function localizarImovelDeA(id: string) {
  return await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => await localizarImovel(tx, id));
}

/**
 * Os códigos gravados, lidos **cruamente** da tabela.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política, e escrever o filtro no
 * teste provaria a aplicação em vez do banco (ADR-0008).
 */
async function lerCodigosCrus(contexto: Contexto): Promise<string[]> {
  return await emUnidade(acesso, contexto, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      SELECT codigo FROM negocio.contrato ORDER BY codigo
    `;
    return linhas.map((linha) => linha.codigo);
  });
}

/** Quantos contratos vigentes o imóvel tem — a contagem que o índice parcial limita a um. */
async function contarVigentesDoImovel(imovelId: string): Promise<number> {
  return await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total
        FROM negocio.contrato
       WHERE imovel_id = ${imovelId}
         AND status = 'ATIVO'
    `;
    return Number(linha?.total ?? -1);
  });
}

/**
 * Sonda até existir uma sessão **esperando por bloqueio** neste banco, com limite declarado.
 *
 * É espera por **estado observável**, e não por tempo: a `.claude/rules/testing-stack.md` proíbe
 * espera fixa, e uma espera fixa aqui seria pior que lenta — ela deixaria o caso passar por acaso nas
 * máquinas em que a segunda transação chegasse a tempo, e falhar nas demais.
 *
 * A visão de `pg_stat_activity` é a das sessões do próprio papel, que é o mesmo `sysloc_app` das
 * duas transações — nenhuma conexão privilegiada participa.
 */
async function esperarSessaoBloqueada(): Promise<void> {
  const limite = Date.now() + LIMITE_DA_SONDAGEM_MS;

  while (Date.now() < limite) {
    const bloqueadas = await emUnidade(acesso, CONTEXTO_DE_A, async (tx) => {
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*) AS total
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND wait_event_type = 'Lock'
      `;
      return Number(linha?.total ?? 0);
    });

    if (bloqueadas > 0) {
      return;
    }

    await new Promise((resolver) => setTimeout(resolver, INTERVALO_DA_SONDAGEM_MS));
  }

  throw new Error(
    'a segunda ativação não chegou a esperar pelo bloqueio da primeira dentro do limite — sem a ' +
      'sobreposição das duas transações, o caso não distingue o índice de uma leitura-antes-de-gravar',
  );
}

/** Um ponto de encontro entre transações — o que mantém duas unidades abertas ao mesmo tempo. */
interface Portao<T> {
  readonly espera: Promise<T>;
  /** Idempotente: chamar duas vezes não muda o valor nem levanta. */
  abrir(valor: T): void;
}

function portao<T>(): Portao<T> {
  let abrir: (valor: T) => void = () => undefined;
  const espera = new Promise<T>((resolver) => {
    abrir = resolver;
  });

  return { espera, abrir: (valor: T) => abrir(valor) };
}

/**
 * Impõe um teto de tempo à promessa, com mensagem que nomeia o modo de falha que ele detecta.
 *
 * O temporizador é sempre limpo: sem isso, um caso verde deixaria o processo do Vitest pendurado até
 * o teto expirar.
 */
async function comLimiteDeTempo<T>(
  promessa: Promise<T>,
  limiteEmMs: number,
  mensagem: string,
): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promessa,
      new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(() => rejeitar(new Error(mensagem)), limiteEmMs);
      }),
    ]);
  } finally {
    if (temporizador !== undefined) {
      clearTimeout(temporizador);
    }
  }
}

type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: unknown };

async function tentar<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await acao() };
  } catch (erro) {
    return { ok: false, erro };
  }
}

function erroDe<T>(resultado: Resultado<T>): unknown {
  return resultado.ok ? undefined : resultado.erro;
}

function mensagemDe<T>(resultado: Resultado<T>): string {
  const erro = erroDe(resultado);
  return erro instanceof Error ? erro.message : String(erro);
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição que o servidor apontou.
 *
 * Afirmá-lo — e não só o `SQLSTATE` — é o que distingue "alguma unicidade recusou" de "ESTA unicidade
 * recusou": `negocio.contrato` tem duas restrições únicas e um índice único parcial, e um `23505`
 * sozinho não diz qual delas falou.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/** O sequencial embutido no código — usado para reapresentar à porta um número já consumido. */
function numeroDo(codigo: string): number {
  return Number(codigo.slice(codigo.lastIndexOf('-') + 1));
}
