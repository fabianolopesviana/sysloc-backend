/**
 * Guarda de cobertura de isolamento — o schema íntegro aprovado, e a tabela sem isolamento apontada
 * pelo nome.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério       | Caso            | Invariante |
 * |----------------|-----------------|------------|
 * | CA-16 · CA-14  | CT-008 → CT-300 | Sobre o schema migrado — `0000_fundacao.sql` e
 * |                |                 | `0001_seguranca.sql`, mais `0005_dominio_locacao.sql` e
 * |                |                 | `0006_seguranca_dominio.sql` —, a consulta de cobertura
 * |                |                 | devolve lista VAZIA de exceções e a lista de tabelas
 * |                |                 | EXAMINADAS igual, na íntegra, às OITO tabelas de `negocio`
 * |                |                 | — nem mais, nem menos. As duas metades importam: sem a
 * |                |                 | segunda, "nenhuma exceção" e "nada foi olhado" seriam
 * |                |                 | indistinguíveis, e um schema vazio passaria por verde.
 * |                |                 | **É UM caso só, com dois identificadores**: o CT-008 o
 * |                |                 | criou sobre as duas tabelas da F1, e o CT-300 é o mesmo
 * |                |                 | invariante depois que a fatia de cadastro acrescentou as
 * |                |                 | seis entidades do domínio — todas cobertas sem exceção. |
 * | CA-14          | CT-301          | Retirado `FORCE ROW LEVEL SECURITY` de `negocio.imovel`
 * |                |                 | numa instância DEDICADA, a MESMA asserção do CT-300 reprova
 * |                |                 | nomeando aquela tabela com motivo `RLS_NAO_FORCADA` —
 * |                |                 | exatamente uma entrada, não mais —, a lista de examinadas
 * |                |                 | continua com as oito, e o controle volta ao verde quando o
 * |                |                 | `FORCE` é restaurado. É o par que impede o CT-300 de passar
 * |                |                 | por vacuidade: sem ele, uma guarda quebrada devolveria
 * |                |                 | `excecoes: []` sobre qualquer schema. |
 * | CA-16          | CT-009          | Criado em `negocio` um objeto sem isolamento — tabela sem
 * |                |                 | `empresa_id`, sem RLS forçada ou sem a restrição única
 * |                |                 | `(id, empresa_id)`, ou objeto que não admite isolamento em
 * |                |                 | espécie alguma —, a guarda devolve EXATAMENTE uma exceção,
 * |                |                 | nomeando aquele objeto e aquele motivo; as OITO tabelas
 * |                |                 | legítimas seguem examinadas e fora das exceções; e,
 * |                |                 | removido o defeito, a lista volta a vazia. A lista de
 * |                |                 | EXAMINADAS é cobrada por igualdade de array — posição
 * |                |                 | inclusive —, e a primeira variante existe para que a ordem
 * |                |                 | seja falsificável: ela é criada por ÚLTIMO e ordena
 * |                |                 | PRIMEIRO, de modo que a ordem alfabética prometida diverge
 * |                |                 | da ordem em que o catálogo devolveria as linhas sem
 * |                |                 | `ORDER BY`. A ÚLTIMA variante é uma visão materializada:
 * |                |                 | ela guarda linha fisicamente, o PostgreSQL não suporta RLS
 * |                |                 | sobre ela, e é o "terceiro estado" que a ADR-0009 declara
 * |                |                 | não existir — a guarda a examina e a reprova com
 * |                |                 | `OBJETO_SEM_ISOLAMENTO_POSSIVEL`. |
 *
 * O aceite 5 da §4 da task — *"a guarda é exportada por `@sysloc/db` e consumível fora do
 * pacote"* — é provado pelo **CT-012**, em `unidade-de-trabalho.spec.ts`: ele resolve o
 * especificador público num processo Node de verdade e compara a superfície do pacote por
 * igualdade de conjunto, que a partir desta task inclui `verificarCoberturaDeIsolamento`. Este
 * arquivo importa do fonte, como todos os demais casos do pacote, porque o que ele prova é
 * comportamento contra banco real, não resolução de módulo.
 *
 * ===========================================================================
 * Por que DUAS instâncias efêmeras, e não uma compartilhada
 * ===========================================================================
 *
 * O CT-009 cria tabelas deliberadamente sem isolamento. Numa instância compartilhada elas ficariam
 * de pé enquanto o arquivo roda e alcançariam a suíte de isolamento — que passaria a conviver com
 * tabela sem política. A instância do CT-009 é DEDICADA e descartada ao fim, no mesmo padrão que o
 * CT-007 de `isolamento.spec.ts` adota para aplicar mutantes de schema.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * A tabela defeituosa nasce de **DDL do próprio caso**, executada pela cadeia de
 * `conexaoDeMigracao()` — o mesmo acessório e a mesma origem de privilégio do CT-007. Nenhuma
 * bandeira, semente condicional ou ramo de produção que "pule" o isolamento foi acrescentado para
 * que o defeito exista: ele é escrito em SQL, num schema real, como um autor futuro o escreveria
 * por descuido.
 *
 * A guarda, por outro lado, é sempre invocada pela cadeia SEM privilégio (`banco.cadeiaConexao`, o
 * papel `sysloc_app`). Isso não é detalhe de conveniência: é a demonstração de que responder pela
 * cobertura não exige privilégio, que é a condição para o verificador de infraestrutura da T5
 * invocá-la com o papel que a aplicação usa.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CoberturaDeIsolamento,
  type MotivoDeExcecao,
  verificarCoberturaDeIsolamento,
} from '../src/catalogo.ts';
import { abrirConexao } from '../src/conexao.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas instruções de estrutura e duas consultas ao catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

// ---------------------------------------------------------------------------
// As tabelas que o schema íntegro tem — e o que se afirma sobre elas
// ---------------------------------------------------------------------------

const TABELA_DE_ACESSO = 'negocio.acesso_usuario_app';
const TABELA_DE_PERMISSAO = 'negocio.acesso_usuario_permissao';

// As seis entidades do domínio de locação, criadas pela migração `0005` (T2 da fatia
// `cadastro-de-imoveis-e-pessoas`). `comodo` está entre elas: ele é tabela de negócio, tem
// `empresa_id`, RLS forçada e a única composta — o que ele NÃO tem é `retirado_em`, que a guarda
// não cobra de ninguém (ADR-0014).
const TABELA_DE_COMODO = 'negocio.comodo';
const TABELA_DE_CONJUNTO = 'negocio.conjunto';
const TABELA_DE_FIADOR = 'negocio.fiador';
const TABELA_DE_IMOVEL = 'negocio.imovel';
const TABELA_DE_LOCADOR = 'negocio.locador';
const TABELA_DE_LOCATARIO = 'negocio.locatario';

/**
 * As oito, na ordem em que a guarda promete devolvê-las (nome de tabela, intercalação `C`).
 *
 * Este conjunto é do CASO, não da guarda: é aqui que o nome de tabela pode ser escrito à mão, e é
 * exatamente por escrevê-lo aqui — e nunca em `src/catalogo.ts` — que a comparação tem valor. Uma
 * guarda que trouxesse a mesma lista por dentro estaria se conferindo contra si mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: até a fatia anterior eram DUAS, e a igualdade sobre as duas é o que
 * reprovou quando a migração `0005` entrou — a rede funcionando, não defeito. A guarda continua
 * respondendo o que sempre respondeu (todo objeto de `negocio`, ordenado); o que mudou foi o
 * schema, e declarar as seis entidades novas aqui é a atualização legítima. Enfraquecer a asserção
 * para contê-las (`toContain`) seria regressão de prova: a tabela que nascesse sem isolamento
 * continuaria passando.
 */
const TABELAS_LEGITIMAS: readonly string[] = [
  TABELA_DE_ACESSO,
  TABELA_DE_PERMISSAO,
  TABELA_DE_COMODO,
  TABELA_DE_CONJUNTO,
  TABELA_DE_FIADOR,
  TABELA_DE_IMOVEL,
  TABELA_DE_LOCADOR,
  TABELA_DE_LOCATARIO,
];

// ---------------------------------------------------------------------------
// As variantes de defeito do CT-009
// ---------------------------------------------------------------------------

/**
 * Um objeto nascido sem isolamento: como criá-lo, o motivo que ele deve produzir, como removê-lo e
 * a lista de examinadas que a guarda deve devolver enquanto ele está de pé.
 *
 * Os três defeitos de tabela são **independentes de propósito**, e é a independência que dá poder
 * ao caso: uma guarda que só olhasse `relrowsecurity` passaria a variante sem a restrição única;
 * uma que só olhasse a coluna passaria a variante sem `FORCE`; e uma que só olhasse a restrição
 * passaria as outras duas.
 *
 * As duas variantes das PONTAS não acrescentam motivo de tabela — cada uma acrescenta um eixo que
 * os três defeitos deixavam sem prova, e o comentário de cada uma explica qual:
 *
 *   * a **primeira** acrescenta a **ordem** da lista de examinadas;
 *   * a **última** acrescenta a **espécie do objeto** — ela não é tabela, e prova que o que a
 *     guarda examina não se restringe ao que ela pode mandar consertar.
 */
interface VarianteDefeituosa {
  /** Entra no nome do caso, depois do ID literal. */
  readonly descricao: string;
  readonly tabela: string;
  readonly motivo: MotivoDeExcecao;
  readonly criar: readonly string[];
  readonly remover: readonly string[];
  /**
   * A lista de tabelas examinadas que a guarda deve devolver enquanto esta variante está de pé —
   * **escrita por extenso, na ordem exata**, e não derivada por ordenação aqui no caso.
   *
   * Derivá-la (`[...TABELAS_LEGITIMAS, variante.tabela].sort()`) reimplementaria no teste a
   * propriedade que ele existe para provar, e a guarda passaria a se conferir contra uma cópia de
   * si mesma — o defeito que a `.claude/rules/testing-stack.md` registra como o pior dos três da
   * F0 (o verificador que reimplementava o leitor e aprovava 5/5 um alvo defeituoso).
   *
   * **O que a proibição alcança é a ORDENAÇÃO, não o reúso do nome.** Espalhar
   * `...TABELAS_LEGITIMAS` é escrever as oito legítimas na ordem em que elas já estão escritas
   * acima — nenhuma ordenação acontece, e a posição do objeto DEFEITUOSO, que é o que discrimina,
   * segue declarada à mão em cada variante. Onde ele não cai no fim da lista, a variante escreve as
   * nove posições por extenso.
   */
  readonly examinadasEsperadas: readonly string[];
}

const VARIANTES: readonly VarianteDefeituosa[] = [
  {
    // ---------------------------------------------------------------------------
    // Esta variante existe pela ORDEM, não pelo motivo — e o NOME dela é a asserção
    // ---------------------------------------------------------------------------
    //
    // As demais provam os três motivos de tabela e a espécie do objeto. Nenhuma delas prova que a
    // lista de examinadas vem ORDENADA, e a guarda promete isso no docblock de
    // `CoberturaDeIsolamento.tabelasExaminadas`:
    // é a promessa que autoriza quem consome — o verificador de infraestrutura da T5 — a afirmar a
    // lista inteira em vez de só o conjunto.
    //
    // A promessa não era falsificável porque os nomes de todas as demais (`sem_empresa`,
    // `sem_forca`, `sem_chave_composta`, `resumo_por_empresa`) ordenam DEPOIS das duas legítimas,
    // que é também a ordem em que as
    // linhas do catálogo chegam quando ninguém as ordena: a varredura de `pg_class` devolve as
    // tabelas da migração antes da tabela que o caso acabou de criar. Alfabética e física
    // coincidiam, e o Gate 1 mediu o efeito — apagado `ORDER BY c.relname` do SUT, os cinco casos
    // ficavam verdes.
    //
    // DECISÃO FECHADA — T4 / Gate 1 (MED-001) · 2026-08-02
    // O QUÊ: o nome desta tabela começa com `aaa_` para que ela seja a ÚLTIMA a ser criada e a
    //        PRIMEIRA em ordem alfabética, fazendo a ordem prometida divergir da ordem física.
    // POR QUÊ: é a única fonte de discriminação da ordem em toda a suíte. Sem a divergência, o
    //          `toEqual` de array compara posição contra uma lista em que posição não distingue
    //          nada, e a remoção de `ORDER BY c.relname` do SUT sobrevive verde — mutante que o
    //          Gate 1 aplicou e mediu vivo em duas execuções independentes.
    // REVERTER EXIGE: provar que a ordem de `tabelasExaminadas` é falsificada por outro caso —
    //                 isto é, exibir uma execução em que o SUT sem `ORDER BY c.relname` reprova
    //                 sem esta variante. Renomear para algo que ordene depois de
    //                 `acesso_usuario_app`, sem essa prova, desarma a única prova de ordem da
    //                 suíte e devolve o MED-001.
    descricao:
      'tabela defeituosa criada POR ÚLTIMO e nomeada para ordenar PRIMEIRO aparece à frente das ' +
      'legítimas na lista de examinadas',
    tabela: 'negocio.aaa_sem_empresa',
    motivo: 'SEM_COLUNA_EMPRESA',
    criar: [
      'CREATE TABLE negocio.aaa_sem_empresa (id uuid PRIMARY KEY DEFAULT gen_random_uuid())',
      'ALTER TABLE negocio.aaa_sem_empresa ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.aaa_sem_empresa FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.aaa_sem_empresa'],
    // As nove posições por extenso: esta é a variante da ORDEM, e espalhar a lista legítima
    // esconderia justamente o que ela discrimina — a defeituosa vindo ANTES das oito.
    examinadasEsperadas: [
      'negocio.aaa_sem_empresa',
      TABELA_DE_ACESSO,
      TABELA_DE_PERMISSAO,
      TABELA_DE_COMODO,
      TABELA_DE_CONJUNTO,
      TABELA_DE_FIADOR,
      TABELA_DE_IMOVEL,
      TABELA_DE_LOCADOR,
      TABELA_DE_LOCATARIO,
    ],
  },
  {
    descricao: 'tabela sem a coluna `empresa_id` reprova nomeando a tabela',
    tabela: 'negocio.sem_empresa',
    motivo: 'SEM_COLUNA_EMPRESA',
    // As outras duas propriedades são satisfeitas até onde é possível: a RLS nasce habilitada E
    // forçada, e só a restrição única sobre o par fica de fora — porque sem a coluna ela é
    // inescrevível. É por isso que a guarda cobra a PRIMEIRA propriedade ausente: sem a ordem, esta
    // tabela renderia duas exceções e o defeito viria misturado com a consequência dele.
    criar: [
      'CREATE TABLE negocio.sem_empresa (id uuid PRIMARY KEY DEFAULT gen_random_uuid())',
      'ALTER TABLE negocio.sem_empresa ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.sem_empresa FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_empresa'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_empresa'],
  },
  {
    descricao: 'tabela com RLS habilitada mas NÃO forçada reprova nomeando a tabela',
    tabela: 'negocio.sem_forca',
    motivo: 'RLS_NAO_FORCADA',
    // Tem tudo o mais: coluna de empresa e a restrição única sobre o par. Falta só o `FORCE` — que
    // é justamente a propriedade invisível para o papel da aplicação, e por isso a que uma suíte
    // conectada com o dono jamais acusaria (ADR-0008, Cons).
    criar: [
      'CREATE TABLE negocio.sem_forca (' +
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        'empresa_id uuid NOT NULL, ' +
        'CONSTRAINT sem_forca_id_empresa_key UNIQUE (id, empresa_id))',
      'ALTER TABLE negocio.sem_forca ENABLE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_forca'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_forca'],
  },
  {
    descricao: 'tabela sem a restrição única `(id, empresa_id)` reprova nomeando a tabela',
    tabela: 'negocio.sem_chave_composta',
    motivo: 'SEM_UNICA_COMPOSTA',
    // A chave primária sobre `id` sozinho NÃO serve: a chave estrangeira composta referencia o PAR,
    // e sem unicidade sobre o par o PostgreSQL recusa a referência. Uma guarda que aceitasse
    // qualquer restrição única da tabela passaria esta variante.
    criar: [
      'CREATE TABLE negocio.sem_chave_composta (' +
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        'empresa_id uuid NOT NULL)',
      'ALTER TABLE negocio.sem_chave_composta ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.sem_chave_composta FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_chave_composta'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_chave_composta'],
  },
  {
    // ---------------------------------------------------------------------------
    // Esta variante não é uma tabela — e é justamente por isso que ela existe
    // ---------------------------------------------------------------------------
    //
    // As quatro acima criam TABELA, e uma tabela sempre pode ser consertada: falta `empresa_id`,
    // acrescenta-se; falta `FORCE`, força-se. A visão materializada não tem conserto: ela guarda
    // linha FISICAMENTE, e o PostgreSQL não suporta RLS sobre ela — não existe
    // `ALTER MATERIALIZED VIEW … ENABLE ROW LEVEL SECURITY`, e `CREATE POLICY` só alcança tabela.
    // Ler dela não reavalia política nenhuma: é um retrato já materializado, com as linhas de
    // todas as empresas misturadas. Um relatório ou painel de fatia futura a cria sem pensar duas
    // vezes, e o Gate 2 mediu o efeito: com o filtro por INCLUSÃO da primeira escrita
    // (`relkind IN ('r','p')`), a guarda devolvia `excecoes: []` sobre ela e nem a listava em
    // `tabelasExaminadas`.
    //
    // A coluna `empresa_id` está presente DE PROPÓSITO, e é o que dá poder discriminante ao caso.
    // Sem ela, `SEM_COLUNA_EMPRESA` também produziria exceção, e o caso ficaria verde com a
    // precondição em qualquer posição da fila. Com ela, a única ausência possível seria
    // `RLS_NAO_FORCADA` — de modo que só a precondição vindo PRIMEIRO produz o motivo afirmado
    // aqui. O caso mata, portanto, três mutantes de uma vez: readmitir o filtro por inclusão (o
    // objeto some da lista de examinadas e a exceção some junto), mover
    // `OBJETO_SEM_ISOLAMENTO_POSSIVEL` para depois de `RLS_NAO_FORCADA` (o motivo muda), e trocar
    // `admiteIsolamento` por uma condição que a visão materializada satisfaça.
    //
    // Não há variante irmã para TABELA ESTRANGEIRA (`relkind = 'f'`), que o mesmo `admiteIsolamento`
    // também reprova: criá-la exigiria extensão de FDW e privilégio de superusuário — uma origem de
    // privilégio que este arquivo não usa em lugar nenhum —, e ela atravessaria exatamente a mesma
    // expressão booleana já exercitada aqui. O que faltava prova era o buraco, não cada espécie.
    descricao:
      'visão materializada em `negocio` — que guarda linha e não admite RLS — reprova por não ' +
      'admitir isolamento, mesmo tendo a coluna `empresa_id`',
    tabela: 'negocio.resumo_por_empresa',
    motivo: 'OBJETO_SEM_ISOLAMENTO_POSSIVEL',
    criar: [
      'CREATE MATERIALIZED VIEW negocio.resumo_por_empresa AS ' +
        'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
    ],
    remover: ['DROP MATERIALIZED VIEW negocio.resumo_por_empresa'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.resumo_por_empresa'],
  },
  {
    // ---------------------------------------------------------------------------
    // A visão SEM delegação — o buraco que o D38 registrou, fechado
    // ---------------------------------------------------------------------------
    //
    // A visão era EXCLUÍDA do exame, sob a razão de que "reavalia a política da origem a cada
    // consulta". A razão é condicional e a condição não estava escrita: o PostgreSQL avalia aquela
    // política com os direitos da DONA da visão, não de quem consulta. Uma visão de dona que
    // contorne RLS devolvia todas as empresas e **nem aparecia em `tabelasExaminadas`** — mesmo
    // desfecho da visão materializada logo acima, por outra porta.
    //
    // O critério é `security_invoker = true`, e não a identidade da dona: com a opção, só o
    // privilégio de QUEM CONSULTA conta, de modo que a visão deixa de poder ser caminho mais fraco
    // que a tabela **seja quem for a dona**. Cobrar a dona seria cobrar propriedade de papel, que
    // muda por instalação e não é desta guarda.
    //
    // A coluna `empresa_id` está presente pela mesma razão da variante acima: sem ela,
    // `SEM_COLUNA_EMPRESA` também produziria exceção e o caso ficaria verde com o critério da visão
    // em qualquer posição. Com ela, o único motivo possível é o afirmado aqui — o que mata o mutante
    // que manda a visão para a lista de propriedades da TABELA (ali ela reprovaria por
    // `OBJETO_SEM_ISOLAMENTO_POSSIVEL`, motivo diferente) e o que reintroduz a exclusão de `v` (o
    // objeto some das examinadas e a exceção some junto).
    descricao:
      'visão SEM `security_invoker` reprova por não delegar o isolamento, mesmo tendo a coluna ' +
      '`empresa_id`',
    tabela: 'negocio.espelho_sem_delegacao',
    motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO',
    criar: [
      'CREATE VIEW negocio.espelho_sem_delegacao AS ' +
        'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
    ],
    remover: ['DROP VIEW negocio.espelho_sem_delegacao'],
    // `espelho_...` ordena entre `conjunto` e `fiador`, e não no fim: as nove posições vão por
    // extenso, porque é a POSIÇÃO que a igualdade de array cobra.
    examinadasEsperadas: [
      TABELA_DE_ACESSO,
      TABELA_DE_PERMISSAO,
      TABELA_DE_COMODO,
      TABELA_DE_CONJUNTO,
      'negocio.espelho_sem_delegacao',
      TABELA_DE_FIADOR,
      TABELA_DE_IMOVEL,
      TABELA_DE_LOCADOR,
      TABELA_DE_LOCATARIO,
    ],
  },
];

// ---------------------------------------------------------------------------
// Execução privilegiada — a DDL do defeito, e apenas ela
// ---------------------------------------------------------------------------

async function executarPrivilegiado(cadeia: string, instrucoes: readonly string[]): Promise<void> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    for (const instrucao of instrucoes) {
      await sql.unsafe(instrucao);
    }
  } finally {
    await sql.end();
  }
}

/** A política tal como o catálogo a guarda hoje — para recriá-la sem reescrever a decisão. */
interface PoliticaCapturada {
  readonly nome: string;
  readonly usando: string;
  readonly comVerificacao: string;
}

/**
 * Lê do catálogo a política de uma tabela, para que o mutante M6 possa derrubá-la e devolvê-la
 * depois **idêntica**.
 *
 * Recriá-la a partir de um texto copiado de `0001_seguranca.sql` seria uma segunda cópia da mesma
 * decisão, que envelheceria em silêncio quando a migração mudasse. O catálogo é a fonte.
 */
async function capturarPolitica(cadeia: string, tabela: string): Promise<PoliticaCapturada> {
  const [schema, nomeDaTabela] = tabela.split('.');
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });

  try {
    const linhas = await sql<{ nome: string; usando: string; comVerificacao: string }[]>`
      SELECT policyname AS "nome", qual AS "usando", with_check AS "comVerificacao"
      FROM pg_policies
      WHERE schemaname = ${schema ?? ''} AND tablename = ${nomeDaTabela ?? ''}
    `;

    const politica = linhas[0];
    if (linhas.length !== 1 || politica === undefined) {
      throw new Error(
        `esperava exatamente uma política em ${tabela}, e o catálogo devolveu ${linhas.length} — ` +
          'sem ela o mutante M6 não teria o que derrubar, e o caso passaria sem exercitar nada',
      );
    }
    return politica;
  } finally {
    await sql.end();
  }
}

function recriarPolitica(tabela: string, politica: PoliticaCapturada): string {
  return (
    `CREATE POLICY "${politica.nome}" ON ${tabela} FOR ALL ` +
    `USING (${politica.usando}) WITH CHECK (${politica.comVerificacao})`
  );
}

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('guarda de cobertura de isolamento — schema íntegro', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-300 (estende o CT-008) — guarda de catálogo aprova o schema íntegro sem apontar exceção',
    async () => {
      const cobertura = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

      // Igualdade nas DUAS listas, numa asserção só: nenhuma exceção **e** as oito tabelas
      // examinadas, nem mais nem menos. É o par que detecta — "exceções vazias" sozinho ficaria
      // verde contra um banco em que a consulta não alcançou tabela nenhuma, e "oito examinadas"
      // sozinho não diria que todas passaram.
      expect(cobertura).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('guarda de cobertura de isolamento — tabela nascida sem isolamento', () => {
  let banco: BancoMigrado;
  let doMigrador: string;

  beforeAll(async () => {
    banco = await bancoEfemero();
    doMigrador = conexaoDeMigracao(banco);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  for (const variante of VARIANTES) {
    it(
      `CT-009 — ${variante.descricao}`,
      async () => {
        await executarPrivilegiado(doMigrador, variante.criar);

        try {
          const comDefeito = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

          // Exatamente uma exceção, com a tabela e o motivo exatos — não "alguma exceção".
          expect(comDefeito.excecoes).toEqual([
            { tabela: variante.tabela, motivo: variante.motivo },
          ]);

          // As duas legítimas foram OLHADAS e ficaram fora das exceções. As duas afirmações são
          // necessárias: sem a primeira, "não aparecem nas exceções" também seria verdade se a
          // consulta simplesmente não as tivesse alcançado.
          //
          // A lista esperada vem da variante e é comparada por `toEqual` de array, que compara
          // POSIÇÃO — é aqui que a promessa de ordem estável do docblock da guarda é cobrada. A
          // primeira variante é a que discrimina: ela é criada por último e ordena primeiro.
          expect(comDefeito.tabelasExaminadas).toEqual(variante.examinadasEsperadas);
          expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_ACESSO,
          );
          expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_PERMISSAO,
          );
        } finally {
          await executarPrivilegiado(doMigrador, variante.remover);
        }

        // Removido o defeito, a guarda volta ao vazio. Sem este passo, "reprovou" não distinguiria
        // o defeito de um estado residual deixado por outra variante — e a guarda poderia estar
        // reprovando sempre.
        const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(restaurado).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
      },
      LIMITE_DO_CASO_MS,
    );
  }

  it(
    'CT-009 (v-ok) — visão COM `security_invoker` é aprovada, e ainda assim aparece entre as examinadas',
    async () => {
      // O companheiro POSITIVO da variante `espelho_sem_delegacao`, e é ele que dá poder
      // discriminante ao critério. Sem este caso, um mutante que reprovasse TODA visão — trocar
      // `linha.delegaIsolamento` por `false`, ou mandar a visão para a lista de propriedades da
      // tabela — passaria pela suíte inteira, e a guarda estaria proibindo um padrão legítimo em vez
      // de exigir a delegação. É o par que detecta, nunca a asserção isolada.
      //
      // A segunda afirmação não é redundante com a primeira: uma visão aprovada por estar EXCLUÍDA
      // do exame também produziria `excecoes: []`. Só a presença dela em `tabelasExaminadas`
      // distingue "foi olhada e passou" de "não foi olhada" — que é a distinção inteira do D38.
      const VISAO_SEGURA = 'negocio.espelho_com_delegacao';

      await executarPrivilegiado(doMigrador, [
        `CREATE VIEW ${VISAO_SEGURA} WITH (security_invoker = true) AS ` +
          'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
      ]);

      try {
        const cobertura = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

        expect(cobertura).toEqual({
          excecoes: [],
          // A visão segura ordena entre `conjunto` e `fiador`, pela mesma razão da irmã acima.
          tabelasExaminadas: [
            TABELA_DE_ACESSO,
            TABELA_DE_PERMISSAO,
            TABELA_DE_COMODO,
            TABELA_DE_CONJUNTO,
            VISAO_SEGURA,
            TABELA_DE_FIADOR,
            TABELA_DE_IMOVEL,
            TABELA_DE_LOCADOR,
            TABELA_DE_LOCATARIO,
          ],
        } satisfies CoberturaDeIsolamento);
      } finally {
        await executarPrivilegiado(doMigrador, [`DROP VIEW ${VISAO_SEGURA}`]);
      }

      const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
      expect(restaurado).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-009 (M6) — isolamento retirado de UMA tabela legítima reprova aquela tabela, e só ela',
    async () => {
      // O mutante que o Gate 1 da T2 deferiu para esta task: `FORCE` e política removidos **só** de
      // `acesso_usuario_permissao`. Ele é a prova que as três variantes acima não dão, porque as
      // três criam tabela NOVA: uma guarda que carregasse por dentro a lista das tabelas conhecidas
      // — o antipadrão que a ADR-0009 rejeita nominalmente — continuaria pegando tabela nova e
      // ficaria cega justamente para a tabela que a migração criou. Aqui ela morre.
      const politica = await capturarPolitica(doMigrador, TABELA_DE_PERMISSAO);

      await executarPrivilegiado(doMigrador, [
        `DROP POLICY "${politica.nome}" ON ${TABELA_DE_PERMISSAO}`,
        `ALTER TABLE ${TABELA_DE_PERMISSAO} NO FORCE ROW LEVEL SECURITY`,
      ]);

      try {
        const comDefeito = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

        expect(comDefeito.excecoes).toEqual([
          { tabela: TABELA_DE_PERMISSAO, motivo: 'RLS_NAO_FORCADA' },
        ]);
        // A tabela irmã, intacta, continua examinada e aprovada — a guarda distingue as duas em vez
        // de reprovar o schema em bloco.
        expect(comDefeito.tabelasExaminadas).toEqual(TABELAS_LEGITIMAS);
        expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
          TABELA_DE_ACESSO,
        );
      } finally {
        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_DE_PERMISSAO} FORCE ROW LEVEL SECURITY`,
          recriarPolitica(TABELA_DE_PERMISSAO, politica),
        ]);
      }

      const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
      expect(restaurado).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-301 — a falsificação do CT-300, sobre uma ENTIDADE NOVA da fatia
// ===========================================================================
//
// O CT-009 já falsifica a guarda com tabela criada pelo próprio caso, e o M6 dele já a falsifica
// sobre uma tabela que a MIGRAÇÃO criou. O que nenhum dos dois cobre é a pergunta que esta task
// abre: **as tabelas que a `0006` acabou de forçar estão mesmo forçadas?** Se a migração de
// segurança tivesse esquecido uma delas, o CT-300 reprovaria — mas se a GUARDA tivesse deixado de
// enxergar `FORCE`, o CT-300 ficaria verde sobre um schema sem isolamento, e é esse o par que falta.
//
// Um único mutante, sobre uma única tabela nova, basta: o mecanismo da guarda é o mesmo para as
// oito, e o CT-009 já cobre as demais variantes de defeito (sem coluna, sem única composta, objeto
// sem isolamento possível).
//
// A instância é DEDICADA e descartada ao fim — nunca a compartilhada pelos demais casos, que
// passaria a conviver com tabela sem política enquanto o arquivo roda. É o mesmo padrão do CT-007
// de `isolamento.spec.ts`.

/** O caso sobe a própria instância, então o teto soma a subida ao trabalho. */
const LIMITE_COM_INSTANCIA_PROPRIA_MS = 180_000;

/** A entidade nova sobre a qual o mutante age. Uma só, e o comentário acima diz por quê. */
const TABELA_MUTANTE = TABELA_DE_IMOVEL;

describe('CT-301 — entidade nova sem RLS forçada é nomeada pela guarda', () => {
  it(
    'CT-301 — retirado o `FORCE` de `negocio.imovel`, a guarda o acusa por RLS_NAO_FORCADA e volta ao verde restaurado',
    async () => {
      const banco = await bancoEfemero();
      const doMigrador = conexaoDeMigracao(banco);

      try {
        // Controle ANTES: sem ele, "reprovou com o mutante" não distingue a guarda que discrimina
        // daquela que reprova qualquer coisa.
        const controle = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(controle).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);

        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_MUTANTE} NO FORCE ROW LEVEL SECURITY`,
        ]);

        try {
          // A guarda é invocada pela cadeia SEM privilégio, como no controle: `NO FORCE` é
          // invisível para o papel da aplicação em toda leitura de dado, e é justamente por isso
          // que a resposta tem de vir do catálogo.
          const comMutante = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

          // Exatamente UMA entrada, com a tabela e o motivo exatos — não "alguma exceção". A
          // igualdade de array é o que impede a guarda de reprovar as oito em bloco e ainda assim
          // passar aqui.
          expect(comMutante.excecoes).toEqual([
            { tabela: TABELA_MUTANTE, motivo: 'RLS_NAO_FORCADA' },
          ]);

          // As oito continuam EXAMINADAS: sem esta metade, uma guarda que tivesse perdido de vista
          // as sete irmãs reportaria a mesma exceção única e passaria.
          expect(comMutante.tabelasExaminadas).toEqual(TABELAS_LEGITIMAS);

          // E as irmãs seguem aprovadas — a guarda distingue a tabela defeituosa em vez de
          // reprovar o schema inteiro.
          expect(comMutante.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_CONJUNTO,
          );
          expect(comMutante.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_COMODO,
          );
        } finally {
          await executarPrivilegiado(doMigrador, [
            `ALTER TABLE ${TABELA_MUTANTE} FORCE ROW LEVEL SECURITY`,
          ]);
        }

        // Controle DEPOIS: restaurado o `FORCE`, a guarda volta ao vazio. É a terceira perna do par
        // controle→mutante→controle, e sem ela "reprovou" poderia ser estado residual.
        const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(restaurado).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
      } finally {
        await banco.parar();
      }
    },
    LIMITE_COM_INSTANCIA_PROPRIA_MS,
  );
});
