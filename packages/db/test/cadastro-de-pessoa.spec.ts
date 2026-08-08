/**
 * A porta parametrizada pelo papel — CT-349, CT-350, CT-350 (b), CT-351 e CT-352.
 * T8 da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-09    | CT-349 | A unicidade do documento é **por papel**, não global: o MESMO
 * |          |        | `documentoPrincipal`, na mesma empresa, é gravado com sucesso nos três
 * |          |        | papéis e devolve três identificadores distintos; a SEGUNDA gravação do
 * |          |        | mesmo documento no MESMO papel é recusada pelo banco com `23505`,
 * |          |        | nomeando a restrição única **daquela** tabela. Contagem crua final:
 * |          |        | exatamente 1 linha em cada uma das três. |
 * | CA-07    | CT-350 | A parametrização **não vaza**: gravar num papel deixa 1 linha na tabela
 * |          |        | dele e ZERO nas outras duas — as três contagens na MESMA asserção —, a
 * |          |        | leitura por identificador com qualquer dos outros dois papéis devolve
 * |          |        | `undefined`, e a listagem daqueles dois devolve `[]`. |
 * | CA-10    | CT-350 | A porta de leitura aplica o predicado de circulação **por padrão**, nos
 * | CA-11    | (b)    | três papéis: com um cadastro em circulação e outro retirado, a listagem
 * |          |        | sem opção devolve **só** o que circula, e a listagem com
 * |          |        | `incluirRetirados` devolve os dois; a retirada **não apaga** (a contagem
 * |          |        | crua continua 2) e a leitura por identificador alcança o retirado. |
 * | CA-07    | CT-351 | A união **publicada** de papéis tem exatamente `locador`, `locatario` e
 * |          |        | `fiador`; e papel fora desse conjunto **não é aceito pelo verificador de
 * |          |        | tipos**. Que cada papel aponte para a **sua** tabela é afirmado pelo
 * |          |        | `CT-350`, no comportamento; a totalidade das chaves do mapa é do
 * |          |        | compilador, pelo `Readonly<Record<PapelDePessoa, string>>`. |
 * | CA-09    | CT-352 | O documento é gravado **só com dígitos**: a coluna lida crua vale
 * |          |        | `'12345678909'` para o CPF mascarado e `'11222333000181'` para o CNPJ
 * |          |        | mascarado; e por isso a segunda gravação do mesmo documento na outra
 * |          |        | grafia, no mesmo papel e na mesma empresa, é recusada com `23505`. A
 * |          |        | alteração normaliza pelo mesmo ponto que a criação. |
 *
 * Rastreabilidade: `CA-09 → CT-349 (RN-04)` · `CA-07 → CT-350 (RN-11)` ·
 * `CA-10 → CT-350 (b) (RN-05)` · `CA-11 → CT-350 (b) (RN-05)` · `CA-07 → CT-351 (RN-11)` ·
 * `CA-09 → CT-352 (RN-04)`.
 *
 * ===========================================================================
 * POR QUE O PAR É O QUE DETECTA, caso a caso
 * ===========================================================================
 *
 * **CT-349.** Só o lado que **aceita** (o mesmo documento nos três papéis) deixaria verde uma
 * implementação **sem unicidade alguma**; só o lado que **recusa** deixaria verde uma unicidade
 * **global** sobre os três papéis. É a conjunção que fixa "por papel", e nenhuma das metades
 * sozinha o faz.
 *
 * **CT-350.** As **três** contagens são afirmadas na MESMA asserção porque contar só a tabela
 * esperada não detecta **escrita duplicada** — a linha estaria onde deveria, e também onde não
 * deveria, e a contagem da tabela alvo seguiria valendo 1. Uma implementação com um `if` errado num
 * dos três ramos reprova aqui e **passaria** num caso que só exercitasse `locador`.
 *
 * **CT-350 (b).** O par *"não aparece sem o parâmetro"* + *"aparece com ele"* é o que discrimina:
 * a primeira metade sozinha ficaria verde com uma porta que nunca devolvesse retirado (predicado
 * ausente do caminho com opção), e a segunda sozinha ficaria verde com o predicado **ausente** de
 * vez — que é o defeito silencioso que a ADR-0014 nomeia entre os próprios *Cons*.
 *
 * **CT-351.** A igualdade do conjunto publicado, e não `toContain`: **um quarto papel dormente
 * reprova**, e é para isso que esta metade existe. Ela afirma o que só o teste pode afirmar — o
 * conjunto que o módulo **publica** —, e não o mapa interno de papel → tabela: o mapa não é
 * exportado, a distinção das tabelas é medida no comportamento pelo `CT-350`, e a totalidade das
 * chaves é do compilador. A metade de tipo é **asserção estática** e por isso carrega prova de
 * falsificação — ver os mutantes abaixo.
 *
 * **CT-352.** As duas metades são obrigatórias: a asserção sobre a coluna sozinha não prova que a
 * unicidade **alcança as duas grafias**, e a recusa sozinha não distingue *"normalizou"* de
 * *"recusou por coincidência de texto"*. Cobre CPF **e** CNPJ, em papéis diferentes.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * As três tabelas nascem sob RLS **forçada** (`migracoes/0006_seguranca_dominio.sql`): escrever
 * nelas exige contexto de tenant fixado. O contexto vem exclusivamente da API pública do pacote —
 * `contextoDeTenant.executarCom` mais `abrirAcessoAoBanco` —, que é o mesmo caminho da operação.
 * **Nenhuma conexão privilegiada é aberta neste arquivo, nenhuma consulta compara `empresa_id`, e
 * nenhum símbolo foi acrescentado a `packages/db/src/**` para que estas provas existam** (Iron Law
 * #6, ADR-0006, ADR-0008).
 *
 * As leituras cruas — a coluna do `CT-352` e as contagens do `CT-349`, do `CT-350` e do
 * `CT-350 (b)` — são **observação de estado**, não caminho de escrita, e correm sob o mesmo contexto
 * de tenant: é a política que as recorta, exatamente como recorta a operação. Mesmo padrão de
 * `lerAjustesDe` em `permissao.spec.ts` e de `contarConjuntos` em
 * `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`.
 *
 * Os nomes das restrições são **literais declarados no topo do arquivo**, nunca derivados do erro
 * observado: derivá-los faria a asserção concordar com qualquer coisa que o servidor dissesse. Mesmo
 * desenho de `RESTRICAO_DO_TRIO` em `permissao.spec.ts`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os cinco reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca
 * por `vitest run` avulso — o script roda `tsc -p tsconfig.test.json` ANTES do `vitest run`, e é ele
 * que torna o MT8-4 exequível.
 *
 *   * **controle** — árvore íntegra: `9 arquivos, 59 casos, 0 falhas`;
 *   * **MT8-1 · dois papéis apontando para a MESMA tabela** — `TABELA_POR_PAPEL.fiador` passa a
 *     valer `'negocio.locador'`: `3 failed | 56 passed`, no **CT-350**, no **CT-350 (b)** e no
 *     **CT-349**. O CT-350 reprova já na iteração do **LOCADOR**, na asserção de **leitura por
 *     identificador** (a `expect(lidas).toEqual(…)` do `CT-350`, neste arquivo), com
 *     `fiador: { id, documentoPrincipal }` onde se espera `fiador: undefined` — a porta do fiador
 *     passa a ler a tabela do locador e alcança a linha que não é dela. **As três contagens da
 *     asserção anterior PASSAM naquela iteração** (`{ locador: 1, locatario: 0, fiador: 0 }` é
 *     exatamente `apenasEm('locador')`): elas detectam o mesmo defeito e disparariam na iteração do
 *     fiador, que o caso não alcança por já ter reprovado. É o CT-350 (b) que o expõe **pela
 *     contagem**, e aí sim na iteração do fiador — `{ locador: 2, fiador: 0 }` onde se espera
 *     `{ locador: 0, fiador: 2 }` —, porque lá a leitura e a listagem são consistentes com a escrita
 *     desviada e só a contagem crua discrimina. O CT-349 cai por consequência: o fiador passa a
 *     disputar a restrição do locador
 *     (`duplicate key value violates unique constraint "locador_empresa_documento_key"`).
 *
 *     **Ordem de disparo remedida em 2026-08-06**, pelo script do pacote: o registro anterior dizia
 *     que o CT-350 morria na iteração do fiador, pelas contagens. O poder de detecção medido não
 *     mudou — os mesmos três casos —, mas a asserção que dispara primeiro naquele caso é a de
 *     leitura, e enfraquecê-la por julgá-la redundante deixaria de pegar o mutante ali.
 *
 *     **Medição refeita na correção da rodada 2**, depois que `TABELA_POR_PAPEL` deixou de ser
 *     exportado e o `CT-351` parou de lê-lo: antes, o mutante matava **quatro** casos, e o quarto era
 *     o próprio CT-351, por igualdade do mapa. A cardinalidade distinta dos valores segue afirmada —
 *     agora **só no comportamento**, que é onde o defeito se manifesta —, e é essa medida que
 *     sustenta o `SUT_IS_CORRECT_BECAUSE:` daquele caso;
 *   * **MT8-2 · a unicidade vira GLOBAL** — `criarPessoa` passa a varrer as três tabelas atrás do
 *     documento antes de gravar e recusa quando acha (a "conferência cruzada" que uma leitura
 *     ingênua da regra produziria): `2 failed | 57 passed`, no **CT-349** e no **CT-352**. O CT-349
 *     morre na segunda gravação — o mesmo documento deixa de poder existir como locatário —, e é o
 *     **lado que aceita** do par que o mata. No CT-352 a recusa deixa de vir do banco
 *     (`{ codigo: undefined, … }` onde se espera `{ codigo: '23505', … }`), que é a segunda face do
 *     mesmo defeito: a validação de aplicação **imita** a recusa e perde a restrição nomeada;
 *   * **MT8-3 · a normalização some** — `comDocumentoNormalizado` passa a devolver `dados` intacto:
 *     `1 failed | 58 passed`, só no **CT-352**, na leitura crua da coluna
 *     (`expected '123.456.789-09' to be '12345678909'`). Nenhum outro caso o alcança, e é essa
 *     assimetria que justifica a metade crua existir: os documentos dos demais casos já chegam sem
 *     máscara, e a porta seguiria "correta" para todos eles;
 *   * **MT8-4 · o tipo do papel alargado para `string`** — `PapelDePessoa` redeclarado como
 *     `string`, `TABELA_POR_PAPEL` como `Readonly<Record<string, string>>` e o acesso indexado
 *     fechado com `?? ''` (o que o compilador obriga quem alarga o tipo a escrever): o passo de
 *     **compilação da suíte** reprova antes de o `vitest` rodar, com
 *     `error TS2578: Unused '@ts-expect-error' directive` nas **duas** supressões do **CT-351**. É a
 *     prova de falsificação da asserção estática, e ela só é observável pelo script do pacote —
 *     `vitest run` avulso não compila e devolveria falso negativo;
 *   * **MT8-5 · o predicado de circulação invertido** — `predicadoDeCirculacao` troca os dois ramos
 *     (`incluirRetirados` passando a esconder o retirado, e a ausência a mostrá-lo):
 *     `1 failed | 58 passed`, no **CT-350 (b)**, já na primeira metade — a listagem padrão devolve
 *     os dois (`{ ids: [ …(2) ], total: 2 }` onde se espera um só). A metade com `incluirRetirados`
 *     reprova junto, e é o par que impede a "correção" que só troca um dos lados;
 *   * **reversão** — `src/cadastro-de-pessoa.ts` foi restaurado e conferido idêntico ao original por
 *     `diff -q`, e o controle voltou a `59 passed`.
 */

import type { TipoDePessoa } from '@sysloc/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  alterarPessoa,
  criarPessoa,
  type DadosDaPessoa,
  definirCirculacaoDaPessoa,
  type JanelaDePessoasCadastradas,
  listarPessoas,
  localizarPessoa,
  PAPEIS_DE_PESSOA,
  type PapelDePessoa,
} from '../src/cadastro-de-pessoa.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso escreve poucas linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho do arquivo correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/**
 * Os três papéis, escritos **por extenso** — a única coisa deste arquivo que redigita a lista.
 *
 * Ela é a **decisão**, e não um valor que o teste descobre do próprio SUT: derivá-la de
 * `PAPEIS_DE_PESSOA` faria o caso concordar com qualquer conjunto que o fonte declarasse, inclusive
 * um quarto papel dormente — que é justamente o mutante que o `CT-351` existe para pegar. Mesmo
 * desenho de `TETO_DECLARADO_DA_PAGINA` no `CT-338`.
 */
const PAPEIS_DECLARADOS = ['fiador', 'locador', 'locatario'] as const;

/**
 * Os nomes de tabela que as leituras CRUAS deste arquivo consultam — literais do teste.
 *
 * Eles **não** vêm do SUT: o mapa de papel → tabela é declaração interna da porta e não é exportado,
 * e derivá-lo faria a conferência crua consultar exatamente a tabela que o defeito escolheu.
 */
const TABELAS_DECLARADAS = {
  locador: 'negocio.locador',
  locatario: 'negocio.locatario',
  fiador: 'negocio.fiador',
} as const;

/**
 * A restrição que o banco deve nomear ao recusar o documento repetido — uma por papel.
 *
 * Literais, e **não** derivados do erro: afirmar o NOME, e não apenas o `SQLSTATE`, é o que
 * distingue *"alguma unicidade recusou"* de *"a unicidade do documento daquele papel recusou"* —
 * cada tabela tem outra restrição única, `(id, empresa_id)`, que também produziria `23505`.
 */
const RESTRICAO_DO_DOCUMENTO: Readonly<Record<PapelDePessoa, string>> = {
  locador: 'locador_empresa_documento_key',
  locatario: 'locatario_empresa_documento_key',
  fiador: 'fiador_empresa_documento_key',
};

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar a restrição acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/** O documento que o `CT-349` faz existir nos TRÊS papéis ao mesmo tempo. */
const DOCUMENTO_DO_TRIO = '52998224725';

/** Um documento por papel para o `CT-350` — distintos, para não colidir com os demais casos. */
const DOCUMENTO_EXCLUSIVO: Readonly<Record<PapelDePessoa, string>> = {
  locador: '11144477735',
  locatario: '39053344705',
  fiador: '16899535009',
};

/** Os dois cadastros que o `CT-350 (b)` cria por papel — um circula, o outro é retirado. */
const DOCUMENTO_QUE_CIRCULA: Readonly<Record<PapelDePessoa, string>> = {
  locador: '19131243000197',
  locatario: '34028316000103',
  fiador: '60746948000112',
};
const DOCUMENTO_RETIRADO: Readonly<Record<PapelDePessoa, string>> = {
  locador: '11222333000181',
  locatario: '12345678909',
  fiador: '52998224725',
};

/** Os dois pares de grafia do `CT-352` — o mesmo documento mascarado e cru, em papéis distintos. */
const PARES_DE_GRAFIA = [
  {
    rotulo: 'CPF',
    papel: 'locador',
    mascarado: '123.456.789-09',
    cru: '12345678909',
    tipoPessoa: 'PESSOA_FISICA',
  },
  {
    rotulo: 'CNPJ',
    papel: 'locatario',
    mascarado: '11.222.333/0001-81',
    cru: '11222333000181',
    tipoPessoa: 'PESSOA_JURIDICA',
  },
] as const satisfies readonly {
  readonly rotulo: string;
  readonly papel: PapelDePessoa;
  readonly mascarado: string;
  readonly cru: string;
  readonly tipoPessoa: TipoDePessoa;
}[];

/** A janela usada por toda listagem deste arquivo — folgada sobre o que os casos gravam. */
const JANELA: JanelaDePessoasCadastradas = { limite: 50, deslocamento: 0 };

/** Alcança os retirados. Nomeado porque a decisão precisa aparecer na chamada. */
const COM_RETIRADOS = { incluirRetirados: true } as const;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

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

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição apontada pelo servidor. O campo se chama `constraint_name` porque é assim que
 * o driver nomeia o campo `n` da resposta de erro do PostgreSQL.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/** A recusa observada, na forma que os casos afirmam. */
interface Recusa {
  readonly codigo: string | undefined;
  readonly restricao: string | undefined;
}

function recusaDe(erro: unknown): Recusa {
  return { codigo: sqlstate(erro), restricao: nomeDaRestricao(erro) };
}

/** Um cadastro completo e válido, variando só o que o caso precisa variar. */
function dadosDe(
  nome: string,
  documentoPrincipal: string,
  tipoPessoa: TipoDePessoa = 'PESSOA_FISICA',
): DadosDaPessoa {
  return {
    nome,
    tipoPessoa,
    documentoPrincipal,
    rg: tipoPessoa === 'PESSOA_FISICA' ? '12.345.678-9' : null,
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

/** As contagens CRUAS das três tabelas — um objeto só, para caberem numa asserção só. */
type ContagemPorTabela = Readonly<Record<PapelDePessoa, number>>;

const NENHUMA: ContagemPorTabela = { locador: 0, locatario: 0, fiador: 0 };

/** As contagens esperadas quando só o papel informado tem uma linha. */
function apenasEm(papel: PapelDePessoa): ContagemPorTabela {
  return { ...NENHUMA, [papel]: 1 };
}

// ---------------------------------------------------------------------------
// CT-351 — o conjunto de papéis é FECHADO em três (unitário, sem banco)
// ---------------------------------------------------------------------------

describe('CT-351 — o conjunto de papéis é fechado em três, e papel inventado não é representável', () => {
  /**
   * O conjunto de papéis, afirmado sobre o que o módulo **publica**.
   *
   * SUT_IS_CORRECT_BECAUSE: três asserções deste caso liam `TABELA_POR_PAPEL`, e liam-no só porque a
   * constante carregava um `export` que **nenhum caminho de produção consumia** — visibilidade de
   * execução alargada por causa do teste. O código de produção está certo ao fechá-la; o teste é que
   * observava pela porta errada. O poder de detecção **não cai**, e a medida é do próprio registro de
   * mutantes deste arquivo: o `MT8-1` (dois papéis para a mesma tabela) morre em `CT-349`, `CT-350` e
   * `CT-350 (b)`. No `CT-350` quem dispara primeiro é a **leitura por identificador**, já na iteração
   * do locador — a porta do fiador alcança a linha gravada na tabela do locador —, e no `CT-350 (b)`
   * são as **três contagens na mesma asserção** que mostram a linha na tabela errada; nos dois é o
   * comportamento que denuncia o defeito, que é o modo de falha real, e não a forma do mapa. A
   * totalidade das chaves não precisava de asserção alguma: ela é do **compilador**, pela
   * anotação `Readonly<Record<PapelDePessoa, string>>` no ponto da declaração — papel na união sem
   * entrada no mapa não compila. O que resta aqui é o que só o teste pode afirmar: que a união
   * **publicada** é exatamente a que se decidiu publicar.
   */
  it('a união publicada de papéis tem exatamente os três papéis declarados', () => {
    // Igualdade do CONJUNTO, e não `toContain`: um quarto papel dormente reprova aqui, e é para isso
    // que esta metade do caso existe. `PAPEIS_DECLARADOS` é literal do teste — derivá-lo do SUT
    // faria a asserção concordar com qualquer conjunto que o fonte declarasse.
    expect([...PAPEIS_DE_PESSOA].sort()).toEqual([...PAPEIS_DECLARADOS]);
  });

  it('papel fora da união não é aceito pelo verificador de tipos', () => {
    // ATENÇÃO: as duas supressões abaixo SÃO a asserção. Elas passam hoje porque `PapelDePessoa` é
    // uma união fechada de três literais; se o tipo for alargado (para `string`, por exemplo), a
    // atribuição passa a compilar, a supressão fica sem erro correspondente e o `tsc` do script do
    // pacote reprova com `TS2578`. É a prova de falsificação da metade estática — ver `MT8-4` no
    // cabeçalho. Nenhuma consulta é executada aqui: o que se afirma é o TIPO.

    // @ts-expect-error — 'inquilino' não pertence à união fechada `PapelDePessoa`
    const papelInventado: PapelDePessoa = 'inquilino';

    // E o mesmo vale para o PARÂMETRO das portas: alargar a assinatura sem alargar a união também
    // reabriria o defeito, e esta segunda supressão é quem o pega.
    // @ts-expect-error — o segundo parâmetro de `criarPessoa` é `PapelDePessoa`, não `string`
    const papelDaPorta: Parameters<typeof criarPessoa>[1] = 'inquilino';

    // O valor recusado pelo compilador continua sendo o mesmo texto em execução — a asserção de
    // tipo acima não muda dado nenhum, e afirmar isso impede que a linha seja lida como um
    // comportamento que ela não tem.
    expect([papelInventado, papelDaPorta]).toEqual(['inquilino', 'inquilino']);
    expect(PAPEIS_DECLARADOS).not.toContain(papelInventado);
  });
});

// ---------------------------------------------------------------------------
// Os casos de integração — instância efêmera, migrada e semeada
// ---------------------------------------------------------------------------

describe('a porta parametrizada pelo papel, sob o contexto da empresa A', () => {
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

  /** Uma unidade de trabalho sob o contexto de A — o caminho real da operação. */
  async function emUnidade<T>(
    acao: (tx: Parameters<Parameters<AcessoAoBanco['emUnidadeDeTrabalho']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
      acesso.emUnidadeDeTrabalho(acao),
    );
  }

  /**
   * As contagens cruas das TRÊS tabelas, lidas na mesma transação.
   *
   * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política, e escrever o filtro
   * no teste provaria a aplicação em vez do banco (ADR-0008).
   */
  async function contarCruas(): Promise<ContagemPorTabela> {
    return emUnidade(async (tx) => {
      const [linha] = await tx<{ locador: string; locatario: string; fiador: string }[]>`
        SELECT (SELECT count(*) FROM negocio.locador)    AS locador,
               (SELECT count(*) FROM negocio.locatario)  AS locatario,
               (SELECT count(*) FROM negocio.fiador)     AS fiador
      `;

      return {
        locador: Number(linha?.locador ?? -1),
        locatario: Number(linha?.locatario ?? -1),
        fiador: Number(linha?.fiador ?? -1),
      };
    });
  }

  /** O documento como a COLUNA o guarda — leitura crua, sem passar pela projeção da porta. */
  async function lerDocumentoCru(papel: PapelDePessoa, id: string): Promise<string | undefined> {
    return emUnidade(async (tx) => {
      const [linha] = await tx<{ documento: string }[]>`
        SELECT documento_principal AS documento
          FROM ${tx(TABELAS_DECLARADAS[papel])}
         WHERE id = ${id}
      `;
      return linha?.documento;
    });
  }

  /**
   * Esvazia as três tabelas.
   *
   * `DELETE` sem `WHERE` corre **sob a política**, e é justamente isso que o torna correto aqui: ele
   * alcança só as linhas da empresa do contexto. Cada caso começa e termina com as três vazias, que
   * é o que torna as contagens cruas afirmações com conteúdo.
   */
  async function limpar(): Promise<void> {
    await emUnidade(async (tx) => {
      await tx`DELETE FROM negocio.locador`;
      await tx`DELETE FROM negocio.locatario`;
      await tx`DELETE FROM negocio.fiador`;
    });
  }

  it(
    'CT-349 — o mesmo documento existe nos três papéis, e repetir no mesmo papel é recusado',
    async () => {
      await limpar();

      try {
        // --- O lado que ACEITA: o mesmo documento, nos três papéis --------------------------
        const identificadores: string[] = [];
        for (const papel of PAPEIS_DE_PESSOA) {
          const gravada = await emUnidade(
            async (tx) =>
              await criarPessoa(tx, papel, dadosDe('Pessoa Tríplice', DOCUMENTO_DO_TRIO)),
          );
          identificadores.push(gravada.id);
        }

        // Três gravações, três identificadores DISTINTOS: sem isso, uma implementação que
        // devolvesse sempre a mesma linha passaria pelo laço acima.
        expect(identificadores).toHaveLength(PAPEIS_DECLARADOS.length);
        expect(new Set(identificadores).size).toBe(PAPEIS_DECLARADOS.length);

        // --- O lado que RECUSA: repetir no MESMO papel ---------------------------------------
        // Cada repetição corre na própria unidade de trabalho porque a violação **aborta** a
        // transação: emendá-las numa só faria a segunda falhar com `25P02` e o caso provaria o
        // estado abortado em vez da restrição.
        const recusas: Record<string, Recusa> = {};
        for (const papel of PAPEIS_DE_PESSOA) {
          const tentativa = await tentar(
            async () =>
              await emUnidade(
                async (tx) =>
                  await criarPessoa(tx, papel, dadosDe('Pessoa Repetida', DOCUMENTO_DO_TRIO)),
              ),
          );

          expect(tentativa.ok).toBe(false);
          recusas[papel] = tentativa.ok
            ? { codigo: undefined, restricao: undefined }
            : recusaDe(tentativa.erro);
        }

        // As três recusas por igualdade de objeto inteiro, e a restrição nomeada é a DAQUELA
        // tabela — literal declarado no topo, nunca derivado do erro observado.
        expect(recusas).toEqual({
          locador: { codigo: VIOLACAO_DE_UNICIDADE, restricao: RESTRICAO_DO_DOCUMENTO.locador },
          locatario: { codigo: VIOLACAO_DE_UNICIDADE, restricao: RESTRICAO_DO_DOCUMENTO.locatario },
          fiador: { codigo: VIOLACAO_DE_UNICIDADE, restricao: RESTRICAO_DO_DOCUMENTO.fiador },
        });

        // --- O estado final, cru --------------------------------------------------------------
        expect(await contarCruas()).toEqual({ locador: 1, locatario: 1, fiador: 1 });
      } finally {
        await limpar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-350 — gravar num papel não escreve nos outros dois, e a leitura não os alcança',
    async () => {
      for (const papel of PAPEIS_DE_PESSOA) {
        await limpar();

        try {
          const gravada = await emUnidade(
            async (tx) =>
              await criarPessoa(tx, papel, dadosDe('Pessoa do Papel', DOCUMENTO_EXCLUSIVO[papel])),
          );

          // AS TRÊS contagens na MESMA asserção: contar só a tabela esperada não detectaria a
          // escrita duplicada, que é o modo de falha silencioso da parametrização malfeita.
          expect(await contarCruas()).toEqual(apenasEm(papel));

          // A leitura por identificador com o papel gravado devolve o registro; com os outros dois,
          // `undefined`. As três lidas na mesma asserção, pela mesma razão das contagens.
          const lidas = await emUnidade(async (tx) => {
            const porPapel: Record<string, { id: string; documentoPrincipal: string } | undefined> =
              {};
            for (const outro of PAPEIS_DE_PESSOA) {
              const lida = await localizarPessoa(tx, outro, gravada.id);
              porPapel[outro] =
                lida === undefined
                  ? undefined
                  : { id: lida.id, documentoPrincipal: lida.documentoPrincipal };
            }
            return porPapel;
          });

          expect(lidas).toEqual({
            ...{ locador: undefined, locatario: undefined, fiador: undefined },
            [papel]: { id: gravada.id, documentoPrincipal: DOCUMENTO_EXCLUSIVO[papel] },
          });

          // E a listagem: exatamente 1 item no papel gravado, `[]` nos outros dois.
          const listadas = await emUnidade(async (tx) => {
            const porPapel: Record<string, string[]> = {};
            for (const outro of PAPEIS_DE_PESSOA) {
              const pagina = await listarPessoas(tx, outro, JANELA);
              porPapel[outro] = pagina.pessoas.map((pessoa) => pessoa.id);
            }
            return porPapel;
          });

          expect(listadas).toEqual({
            ...{ locador: [], locatario: [], fiador: [] },
            [papel]: [gravada.id],
          });
        } finally {
          await limpar();
        }
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-350 (b) — a porta esconde o retirado por padrão e o devolve sob o parâmetro, nos três papéis',
    async () => {
      for (const papel of PAPEIS_DE_PESSOA) {
        await limpar();

        try {
          const emCirculacao = await emUnidade(
            async (tx) =>
              await criarPessoa(
                tx,
                papel,
                dadosDe('Aurora Circulante', DOCUMENTO_QUE_CIRCULA[papel], 'PESSOA_JURIDICA'),
              ),
          );
          const retirada = await emUnidade(
            async (tx) =>
              await criarPessoa(tx, papel, dadosDe('Zulmira Retirada', DOCUMENTO_RETIRADO[papel])),
          );

          const marcada = await emUnidade(
            async (tx) => await definirCirculacaoDaPessoa(tx, papel, retirada.id, false),
          );
          expect(marcada?.retiradoEm).toBeInstanceOf(Date);

          // A metade que discrimina o predicado AUSENTE: sem opção, o retirado não aparece — e o
          // `total` acompanha, porque o mesmo predicado governa a página e a contagem.
          const padrao = await emUnidade(async (tx) => await listarPessoas(tx, papel, JANELA));
          expect({ ids: padrao.pessoas.map((pessoa) => pessoa.id), total: padrao.total }).toEqual({
            ids: [emCirculacao.id],
            total: 1,
          });

          // A metade que discrimina o predicado INVERTIDO: com a opção, os dois aparecem, na ordem
          // de `nome` que a porta declara.
          const comRetirados = await emUnidade(
            async (tx) => await listarPessoas(tx, papel, JANELA, COM_RETIRADOS),
          );
          expect({
            ids: comRetirados.pessoas.map((pessoa) => pessoa.id),
            total: comRetirados.total,
          }).toEqual({ ids: [emCirculacao.id, retirada.id], total: 2 });

          // A retirada NÃO apaga (ADR-0014), e a leitura por identificador alcança o retirado — sem
          // isso a recirculação ficaria inalcançável pela interface.
          expect(await contarCruas()).toEqual({ ...NENHUMA, [papel]: 2 });
          const alcancada = await emUnidade(
            async (tx) => await localizarPessoa(tx, papel, retirada.id),
          );
          expect(alcancada?.id).toBe(retirada.id);
          expect(alcancada?.retiradoEm).toBeInstanceOf(Date);
        } finally {
          await limpar();
        }
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-352 — o documento é gravado só com dígitos, e a unicidade alcança a forma mascarada',
    async () => {
      for (const par of PARES_DE_GRAFIA) {
        await limpar();

        try {
          const gravada = await emUnidade(
            async (tx) =>
              await criarPessoa(
                tx,
                par.papel,
                dadosDe(`Pessoa de ${par.rotulo}`, par.mascarado, par.tipoPessoa),
              ),
          );

          // Metade 1 — a COLUNA guarda dígitos. Lida crua, sem passar pela projeção da porta: se a
          // normalização morasse na leitura em vez da escrita, esta linha a denunciaria.
          expect(await lerDocumentoCru(par.papel, gravada.id)).toBe(par.cru);
          // E o que a porta devolve é o mesmo valor — as duas pontas concordam.
          expect(gravada.documentoPrincipal).toBe(par.cru);

          // Metade 2 — a unicidade alcança a OUTRA grafia. Sozinha, ela não distinguiria
          // "normalizou" de "recusou por coincidência de texto"; junto da metade 1, distingue.
          const repetida = await tentar(
            async () =>
              await emUnidade(
                async (tx) =>
                  await criarPessoa(
                    tx,
                    par.papel,
                    dadosDe(`Repetida de ${par.rotulo}`, par.cru, par.tipoPessoa),
                  ),
              ),
          );

          expect(repetida.ok).toBe(false);
          expect(repetida.ok ? undefined : recusaDe(repetida.erro)).toEqual({
            codigo: VIOLACAO_DE_UNICIDADE,
            restricao: RESTRICAO_DO_DOCUMENTO[par.papel],
          });

          // A ALTERAÇÃO normaliza pelo mesmo ponto que a criação: um `PUT` que gravasse a máscara
          // faria a linha escapar da restrição, e a repetição acima passaria a ser aceita.
          const alterada = await emUnidade(
            async (tx) =>
              await alterarPessoa(
                tx,
                par.papel,
                gravada.id,
                dadosDe(`Pessoa de ${par.rotulo} (revista)`, par.mascarado, par.tipoPessoa),
              ),
          );
          expect(alterada?.documentoPrincipal).toBe(par.cru);
          expect(await lerDocumentoCru(par.papel, gravada.id)).toBe(par.cru);

          expect(await contarCruas()).toEqual(apenasEm(par.papel));
        } finally {
          await limpar();
        }
      }
    },
    LIMITE_DO_CASO_MS,
  );
});
