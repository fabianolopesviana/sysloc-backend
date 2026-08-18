/**
 * Isolamento das quatro tabelas da emissão e da conciliação — o banco respondendo sozinho.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-14    | CT-940 | `evento_bancario`, `emissao_em_lote`, `item_da_emissao_em_lote` e
 * |          |        | `conferencia_bancaria` têm `relrowsecurity` E `relforcerowsecurity`
 * |          |        | verdadeiros em `pg_class`; cada uma tem EXATAMENTE uma política `FOR ALL`,
 * |          |        | com `qual` e `with_check` não nulos, idênticos entre si e idênticos à
 * |          |        | expressão já aplicada em `negocio.cobranca` pela `0010`; cada uma tem a
 * |          |        | restrição única `(id, empresa_id)` e a chave estrangeira COMPOSTA que lhe
 * |          |        | cabe — `(cobranca_id, empresa_id) → cobranca(id, empresa_id)`,
 * |          |        | `(lote_id, empresa_id) → emissao_em_lote(id, empresa_id)` ou
 * |          |        | `(solicitado_por|solicitada_por, empresa_id) → usuario(id, empresa_id)` —,
 * |          |        | afirmadas por igualdade da lista INTEIRA de restrições. Os dois índices
 * |          |        | únicos PARCIAIS (`emissao_em_lote_em_andamento_uidx` e
 * |          |        | `conferencia_bancaria_em_andamento_uidx`) e o índice único GLOBAL de
 * |          |        | `cobranca.identificador_no_provedor` — que **não** contém `empresa_id`,
 * |          |        | ADR-0033 — são afirmados pela definição inteira que o catálogo reconstrói,
 * |          |        | e a coluna nova é `text` ANULÁVEL. E, com uma linha
 * |          |        | semeada em cada uma sob a empresa A: sob o contexto de B o `SELECT`
 * |          |        | devolve ZERO linhas nas quatro, enquanto sob A devolve exatamente as
 * |          |        | semeadas (controle antivácuo); o `INSERT` com `empresa_id` de A, sob o
 * |          |        | contexto de B, é recusado com `code === '42501'` e a mensagem da política
 * |          |        | de linha; e a MESMA linha, sob o contexto de A, grava — o que torna o
 * |          |        | contexto a única variável entre a recusa e o sucesso. |
 *
 * ===========================================================================
 * Por que um arquivo NOVO, e não uma entrada em `isolamento.spec.ts`
 * ===========================================================================
 *
 * A designação é da spec (§5.1 da T2), e ela é coerente: as três entidades que os CT-302/303/304
 * percorrem são **cadastro** — linhas que o usuário cria, edita e retira —, e o mecanismo daquele
 * arquivo é construído em torno de uma "coluna livre" reescrevível que não participe de restrição
 * alguma. As quatro daqui são registro de **fato**: nenhuma tem coluna livre nesse sentido, três
 * carregam `check` bicondicional e duas carregam índice único parcial sobre `empresa_id`. Encaixá-las
 * na lista de lá exigiria alargar `EntidadeDeCadastro` com casos especiais para cada uma — e o preço
 * seria pago pelos casos já provados, cujos conjuntos esperados mudariam por acréscimo alheio.
 *
 * O que **não** muda é o alvo declarado: relação de `negocio` sem prova comportamental de isolamento
 * é lacuna, e é esta que o arquivo fecha para as quatro da migração `0017`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — MT-M2 e MT-M3 (2026-08-16)
 * ===========================================================================
 *
 * Os passos 1 a 3 observam CATÁLOGO (estrutura), e não comportamento de domínio ⇒ prova de
 * falsificação, pelo precedente que o CT-608 instalou (`.claude/rules/testing-stack.md`). O defeito
 * foi reintroduzido no artefato REAL e medido, com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso:
 *
 *   * **controle** — árvore íntegra: `194 passed`, 26 arquivos;
 *   * **MT-M2 · o `FORCE ROW LEVEL SECURITY` de `item_da_emissao_em_lote` removido da `0018`** — a
 *     ausência exata que o gerador produziria se a parceira autoral não existisse. `15 failed | 179
 *     passed`, e o passo 1 deste caso reprova NOMEANDO a tabela:
 *     `- { tabela: 'item_da_emissao_em_lote', habilitada: true, forcada: true }` contra
 *     `+ { … forcada: false }`. O CT-946 reprova pelo passo 5 e a guarda de cobertura de
 *     `catalogo.spec.ts` acusa `RLS_NAO_FORCADA` — três vias independentes, como no par
 *     CT-522/CT-523. **O alcance largo é a rede funcionando**: `FORCE` ausente é defeito de schema,
 *     e a suíte inteira que depende dele cai junto;
 *   * **MT-M3 · o índice único do identificador perante o provedor pareado com `empresa_id`** — a
 *     "correção" que a ADR-0033 nomeia e proíbe, aplicada à `0017`
 *     (`UNIQUE("empresa_id","identificador_no_provedor")`). `1 failed | 193 passed`: **só** o passo
 *     3-b deste caso reprova, com
 *     `USING btree (empresa_id, identificador_no_provedor)` contra `USING btree
 *     (identificador_no_provedor)`. **Nenhum outro caso da suíte acusa**, e é exatamente esse o
 *     ponto: sem este passo, o pareamento entraria em produção verde — a colisão entre duas
 *     imobiliárias só apareceria no provedor, longe da causa;
 *   * **reversão** — a `0017` e a `0018` foram restauradas e conferidas por `sha256sum` idêntico ao
 *     original (`2c96462a5b…` e `44bbde15c1…`), e o controle voltou a `194 passed`.
 *
 * A âncora deste registro é SIMBÓLICA — {@link TABELAS_EM_ORDEM_DO_CATALOGO} —, e nunca número de
 * linha.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * O contexto vem exclusivamente da API pública do pacote — `contextoDeTenant.executarCom` e
 * `abrirAcessoAoBanco` —, e a conexão é a do papel `sysloc_app`: `conexaoDeMigracao` e
 * `conexaoSuperusuaria` **não aparecem aqui**. Isso não é detalhe: o superusuário contorna RLS com ou
 * sem `FORCE`, e o caso passaria sem provar nada — é o que `papel-de-conexao.spec.ts` afirma no
 * CT-001 (a conexão da suíte não é superusuária, não contorna política, não é membro do papel dono) e
 * demonstra no CT-002 (com a conexão privilegiada, a bateria reprova).
 *
 * As linhas semeadas nascem de SQL do próprio caso, sob o contexto da empresa DONA, que é o caminho
 * que a aplicação usará. Nenhum símbolo foi acrescentado a `packages/db/src/**` nem às migrações para
 * este caso existir.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { ACESSOS_DA_EMPRESA_A, EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso semeia poucas linhas e faz quatro rodadas de leitura e escrita; o teto é folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física. */
const RESERVA_DE_UMA = 1;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * O usuário da carga inicial da empresa A — o `solicitado_por` do lote e o `solicitada_por` da
 * conferência.
 *
 * Ele é **derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que a
 * chave estrangeira composta cobra é o mesmo que `semente.ts` gravou, e copiar o identificador
 * criaria uma segunda declaração livre para divergir da carga que a instância efêmera aplica.
 */
function exigirUsuarioDaCarga(): string {
  const primeiro = ACESSOS_DA_EMPRESA_A[0];
  if (primeiro === undefined) {
    throw new Error('a carga inicial não tem vínculo de acesso da empresa A');
  }
  return primeiro.usuarioId;
}

const USUARIO_DE_A = exigirUsuarioDaCarga();

// ---------------------------------------------------------------------------
// Identificadores descartáveis — o segundo grupo distingue o papel da linha
// ---------------------------------------------------------------------------

/** As linhas de apoio: o cadastro e as duas cobranças sobre as quais as quatro relações apontam. */
const CONJUNTO_DE_A = 'eeeeeeee-1111-4000-8000-000000000001';
const IMOVEL_DE_A = 'eeeeeeee-1111-4000-8000-000000000002';
const LOCADOR_DE_A = 'eeeeeeee-1111-4000-8000-000000000003';
const LOCATARIO_DE_A = 'eeeeeeee-1111-4000-8000-000000000004';
const CONTRATO_DE_A = 'eeeeeeee-1111-4000-8000-000000000005';

/**
 * DUAS cobranças, e não uma.
 *
 * A segunda existe por causa de `item_da_emissao_em_lote_lote_cobranca_key`: a linha cruzada aponta
 * para o MESMO lote da semeada, e com a mesma cobrança o banco recusaria por `23505` — o caso
 * passaria a provar a unicidade em vez da política. É o mesmo cuidado que o `isolamento.spec.ts` já
 * registra para a posição do cômodo e para o documento das pessoas: **tirar do caminho toda
 * restrição que não seja a política**.
 */
const COBRANCA_DE_A = 'eeeeeeee-1111-4000-8000-000000000006';
const COBRANCA_SECUNDARIA_DE_A = 'eeeeeeee-1111-4000-8000-000000000007';

/** As quatro linhas semeadas — uma por relação, todas da empresa A. */
const SEMEADOS = {
  evento_bancario: 'eeeeeeee-2222-4000-8000-000000000001',
  emissao_em_lote: 'eeeeeeee-2222-4000-8000-000000000002',
  item_da_emissao_em_lote: 'eeeeeeee-2222-4000-8000-000000000003',
  conferencia_bancaria: 'eeeeeeee-2222-4000-8000-000000000004',
} as const;

/** As quatro linhas que a empresa B tenta gravar com `empresa_id` da empresa A. */
const CRUZADOS = {
  evento_bancario: 'eeeeeeee-3333-4000-8000-000000000001',
  emissao_em_lote: 'eeeeeeee-3333-4000-8000-000000000002',
  item_da_emissao_em_lote: 'eeeeeeee-3333-4000-8000-000000000003',
  conferencia_bancaria: 'eeeeeeee-3333-4000-8000-000000000004',
} as const;

type NomeDeRelacao = keyof typeof SEMEADOS;

/**
 * Uma das quatro relações: como lê-la e como gravar nela a linha semeada e a cruzada.
 *
 * A leitura é **declarada como valor** para que a ausência de filtro por empresa seja CONFERIDA e não
 * apenas prometida (ADR-0008) — mesmo mecanismo de `CONSULTAS_DE_NEGOCIO` em `isolamento.spec.ts`.
 */
interface RelacaoBancaria {
  readonly nome: NomeDeRelacao;
  readonly relacao: string;
  readonly consulta: string;
  gravar(tx: TransactionSql, id: string, empresaId: string): Promise<number>;
}

const RELACOES_BANCARIAS: readonly RelacaoBancaria[] = [
  {
    nome: 'evento_bancario',
    relacao: 'negocio.evento_bancario',
    consulta: 'SELECT id FROM negocio.evento_bancario ORDER BY id',
    gravar: async (tx, id, empresaId) => {
      const resultado = await tx`
        INSERT INTO negocio.evento_bancario
                    (id, empresa_id, cobranca_id, tipo, origem, diagnostico, valor_informado)
        VALUES (${id}, ${empresaId}, ${COBRANCA_DE_A},
                ${'BOLETO_EMITIDO'}::negocio.tipo_de_evento_bancario,
                ${'ATO_DO_ADMIN'}::negocio.origem_do_evento_bancario, ${null}, ${null})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'emissao_em_lote',
    relacao: 'negocio.emissao_em_lote',
    consulta: 'SELECT id FROM negocio.emissao_em_lote ORDER BY id',
    // ---------------------------------------------------------------------------
    // A linha semeada nasce CONCLUÍDA, e é isso que a tira do caminho do índice parcial
    // ---------------------------------------------------------------------------
    //
    // `emissao_em_lote_em_andamento_uidx` é único sobre `empresa_id` onde os dois instantes de
    // desfecho são nulos. Semeada em andamento, a linha cruzada — que nasce em andamento — colidiria
    // com ela pelo índice, e o desfecho passaria a depender de o `WITH CHECK` ser avaliado antes do
    // índice: o caso mediria ORDEM DE AVALIAÇÃO em vez de isolamento. Mesmo precedente do
    // certificado semeado substituído, em `isolamento.spec.ts`.
    gravar: async (tx, id, empresaId) => {
      const concluido = id === SEMEADOS.emissao_em_lote;
      const resultado = await tx`
        INSERT INTO negocio.emissao_em_lote
                    (id, empresa_id, competencia, solicitado_por, concluido_em)
        VALUES (${id}, ${empresaId}, ${'2026-01-01'}::date, ${USUARIO_DE_A},
                ${concluido ? tx`pg_catalog.now()` : tx`NULL`})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'item_da_emissao_em_lote',
    relacao: 'negocio.item_da_emissao_em_lote',
    consulta: 'SELECT id FROM negocio.item_da_emissao_em_lote ORDER BY id',
    // A cobrança é distinta por linha — ver {@link COBRANCA_SECUNDARIA_DE_A}. O desfecho é
    // `EMITIDO` com motivo nulo, que é o único par que `item_da_emissao_em_lote_motivo_chk` admite
    // sem motivo: gravar `RECUSADO` sem motivo seria recusado pela `CHECK`, e a recusa apareceria
    // como um caso vermelho longe da causa.
    gravar: async (tx, id, empresaId) => {
      const cobrancaId =
        id === SEMEADOS.item_da_emissao_em_lote ? COBRANCA_DE_A : COBRANCA_SECUNDARIA_DE_A;
      const resultado = await tx`
        INSERT INTO negocio.item_da_emissao_em_lote
                    (id, empresa_id, lote_id, cobranca_id, desfecho, motivo)
        VALUES (${id}, ${empresaId}, ${SEMEADOS.emissao_em_lote}, ${cobrancaId},
                ${'EMITIDO'}::negocio.desfecho_do_item_do_lote, ${null})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'conferencia_bancaria',
    relacao: 'negocio.conferencia_bancaria',
    consulta: 'SELECT id FROM negocio.conferencia_bancaria ORDER BY id',
    // A semeada nasce CONCLUÍDA pela mesma razão do lote: `conferencia_bancaria_em_andamento_uidx` é
    // único sobre `empresa_id` onde `concluida_em` é nulo.
    gravar: async (tx, id, empresaId) => {
      const concluida = id === SEMEADOS.conferencia_bancaria;
      const resultado = await tx`
        INSERT INTO negocio.conferencia_bancaria
                    (id, empresa_id, solicitada_por, concluida_em)
        VALUES (${id}, ${empresaId}, ${USUARIO_DE_A},
                ${concluida ? tx`pg_catalog.now()` : tx`NULL`})
      `;
      return resultado.count;
    },
  },
];

// ---------------------------------------------------------------------------
// Utilidades de coleta — as mesmas formas de `isolamento.spec.ts`
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

function mensagemDo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * O desfecho de uma tentativa de gravação, como texto comparável — o código E a marca da política.
 *
 * Ele existe para que a asserção seja UMA igualdade sobre as quatro relações, nomeando a que
 * divergiu, em vez de quatro asserções soltas que parariam na primeira.
 */
function desfechoDaGravacao(tentativa: Resultado<number>): string {
  if (tentativa.ok) {
    return `GRAVOU (${tentativa.valor} linha(s))`;
  }
  const codigo = sqlstate(tentativa.erro) ?? 'sem sqlstate';
  const texto = mensagemDo(tentativa.erro);
  return texto.includes('row-level security policy')
    ? `${codigo} · row-level security policy`
    : `${codigo} · ${texto}`;
}

type Contexto = contextoDeTenant.ContextoDeTenant;

function abrir(cadeiaDeConexao: string): AcessoAoBanco {
  return abrirAcessoAoBanco({ cadeiaDeConexao, maximoDeConexoes: RESERVA_DE_UMA });
}

/** Lê os identificadores de uma relação sob o contexto dado, pela consulta DECLARADA dela. */
async function lerIdentificadores(
  acesso: AcessoAoBanco,
  relacao: RelacaoBancaria,
  contexto: Contexto,
): Promise<string[]> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<{ id: string }[]>(relacao.consulta);
      return linhas.map((linha) => linha.id);
    }),
  );
}

/** Uma entrada por relação, no formato `<relação>: <valor>` — é o que a igualdade compara. */
function porRelacao(nome: string, valor: string): string {
  return `${nome}: ${valor}`;
}

/**
 * Semeia, sob o contexto da empresa A, o cadastro de apoio e as duas cobranças.
 *
 * Tudo numa unidade só, na ordem pai → filho: a chave estrangeira composta exige que o conjunto
 * exista antes do imóvel, e o imóvel, o locador e o locatário antes do contrato.
 */
async function semearApoio(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.conjunto (id, empresa_id, nome)
        VALUES (${CONJUNTO_DE_A}, ${EMPRESA_A.id}, ${'Conjunto da emissão'})
      `;
      await tx`
        INSERT INTO negocio.imovel
                    (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                     logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
        VALUES (${IMOVEL_DE_A}, ${EMPRESA_A.id}, ${CONJUNTO_DE_A}, ${'Imóvel da emissão'},
                ${'IM-EMISSAO'}, ${'RESIDENCIAL'}::negocio.tipo_imovel,
                ${'Rua das Laranjeiras'}, ${'100'}, ${null}, ${'Centro'}, ${'Teresina'}, ${'PI'},
                ${'64000000'}, ${'DISPONIVEL'}::negocio.status_locacao)
      `;
      for (const pessoa of [
        { relacao: 'negocio.locador', id: LOCADOR_DE_A, marca: 'locador' },
        { relacao: 'negocio.locatario', id: LOCATARIO_DE_A, marca: 'locatario' },
      ]) {
        await tx.unsafe(
          `INSERT INTO ${pessoa.relacao}
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
           VALUES ($1, $2, $3, 'PESSOA_FISICA', $4, NULL, $5, '8699990000',
                   'Rua das Laranjeiras', '100', NULL, 'Centro', 'Teresina', 'PI', '64000000')`,
          [
            pessoa.id,
            EMPRESA_A.id,
            `Cadastro ${pessoa.marca}`,
            `DOC-EMISSAO-${pessoa.marca}`,
            `emissao.${pessoa.marca}@exemplo.com.br`,
          ],
        );
      }
      // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`,
      // e o que este caso mede não é a vigência única.
      await tx`
        INSERT INTO negocio.contrato
                    (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                     data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
        VALUES (${CONTRATO_DE_A}, ${EMPRESA_A.id}, ${'CTR-2026-90001'}, ${IMOVEL_DE_A},
                ${LOCADOR_DE_A}, ${LOCATARIO_DE_A}, ${'RASCUNHO'}::negocio.status_contrato,
                ${'2026-01-10'}::date, ${12}, ${'1500.00'}, ${10})
      `;
      for (const cobranca of [
        { id: COBRANCA_DE_A, codigo: 'COB-2026-9000001' },
        { id: COBRANCA_SECUNDARIA_DE_A, codigo: 'COB-2026-9000002' },
      ]) {
        await tx`
          INSERT INTO negocio.cobranca
                      (id, empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                       data_vencimento, valor_original)
          VALUES (${cobranca.id}, ${EMPRESA_A.id}, ${cobranca.codigo}, ${CONTRATO_DE_A},
                  ${'ALUGUEL'}::negocio.natureza_cobranca, ${'01/01/2026 à 31/01/2026'},
                  ${'2026-01-01'}::date, ${'2026-01-10'}::date, ${'2000.00'})
        `;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// As leituras do catálogo — estrutura, e não comportamento
// ---------------------------------------------------------------------------

interface EstadoDeRls {
  readonly tabela: string;
  readonly habilitada: boolean;
  readonly forcada: boolean;
}

interface PoliticaDoCatalogo {
  readonly tabela: string;
  readonly nome: string;
  readonly comando: string;
  readonly usando: string | null;
  readonly comVerificacao: string | null;
}

interface RestricaoDoCatalogo {
  readonly tabela: string;
  readonly nome: string;
  readonly tipo: string;
  readonly colunas: string[];
  readonly tabelaReferida: string | null;
  readonly colunasReferidas: string[] | null;
}

/** As quatro tabelas, na ordem em que o catálogo as devolve (nome, intercalação `C`). */
const TABELAS_EM_ORDEM_DO_CATALOGO: readonly NomeDeRelacao[] = [
  'conferencia_bancaria',
  'emissao_em_lote',
  'evento_bancario',
  'item_da_emissao_em_lote',
];

/** A tabela cuja política serve de ÂNCORA da expressão — declarada pela `0010`, intocada aqui. */
const TABELA_ANCORA = 'cobranca';

describe('CT-940 — as quatro tabelas da emissão e da conciliação nascem isoladas', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-940 — RLS habilitada E forçada, política com `USING` e `WITH CHECK`, única e FK compostas, e a linha de A invisível e ininserível sob B',
    async () => {
      const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });
      const acesso = abrir(banco.cadeiaConexao);

      try {
        // --- 1. RLS habilitada E FORÇADA nas quatro ---------------------------------------
        //
        // As duas metades numa asserção só, e por igualdade de objeto: `ENABLE` sem `FORCE` é o
        // estado em que o isolamento existe para quem não é dono e some para o dono — exatamente o
        // que a `0017` sozinha produziria, porque o gerador não emite `FORCE`.
        const rls = await sql<EstadoDeRls[]>`
          SELECT c.relname             AS tabela,
                 c.relrowsecurity      AS habilitada,
                 c.relforcerowsecurity AS forcada
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname = ANY(${[...TABELAS_EM_ORDEM_DO_CATALOGO]})
           ORDER BY c.relname
        `;
        // As quatro por extenso, e não `map(() => …)`: a propriedade é afirmada POR TABELA, de modo
        // que a que nascesse sem `FORCE` apareça pela posição. Derivar o esperado da mesma lista que
        // alimenta a consulta faria a contagem responder no lugar da propriedade.
        expect(rls.map((linha) => ({ ...linha }))).toEqual([
          { tabela: 'conferencia_bancaria', habilitada: true, forcada: true },
          { tabela: 'emissao_em_lote', habilitada: true, forcada: true },
          { tabela: 'evento_bancario', habilitada: true, forcada: true },
          { tabela: 'item_da_emissao_em_lote', habilitada: true, forcada: true },
        ] satisfies EstadoDeRls[]);

        // --- 2. Exatamente UMA política por tabela, `FOR ALL`, `USING` = `WITH CHECK` -------
        const politicas = await sql<PoliticaDoCatalogo[]>`
          SELECT tablename  AS tabela,
                 policyname AS nome,
                 cmd        AS comando,
                 qual       AS usando,
                 with_check AS "comVerificacao"
            FROM pg_catalog.pg_policies
           WHERE schemaname = 'negocio'
             AND tablename = ANY(${[...TABELAS_EM_ORDEM_DO_CATALOGO, TABELA_ANCORA]})
           ORDER BY tablename, policyname
        `;

        const daFatia = politicas.filter((politica) => politica.tabela !== TABELA_ANCORA);
        // A contagem vem ANTES: duas políticas na mesma tabela seriam OU lógico entre elas, e a
        // segunda poderia alargar o que a primeira restringe sem que a inspeção da primeira acusasse.
        expect(daFatia).toHaveLength(4);
        // Os nomes por extenso, e não compostos por interpolação: o nome da política é o que aparece
        // num `pg_policies` de diagnóstico, e derivá-lo do nome da tabela faria a asserção aceitar
        // qualquer convenção que o autor da migração tivesse escolhido.
        expect(
          daFatia.map((politica) => [politica.tabela, politica.nome, politica.comando]),
        ).toEqual([
          ['conferencia_bancaria', 'conferencia_bancaria_isolamento_empresa', 'ALL'],
          ['emissao_em_lote', 'emissao_em_lote_isolamento_empresa', 'ALL'],
          ['evento_bancario', 'evento_bancario_isolamento_empresa', 'ALL'],
          ['item_da_emissao_em_lote', 'item_da_emissao_em_lote_isolamento_empresa', 'ALL'],
        ]);

        // A expressão é lida da política da COBRANÇA, e não redigitada aqui: redigitá-la criaria a
        // segunda redação do mesmo isolamento, livre para divergir junto com a errada. A âncora é
        // **externa à fatia**, que é o que a torna capaz de reprovar.
        const ancora = politicas.find((politica) => politica.tabela === TABELA_ANCORA);
        // Sem esta linha, uma âncora ausente faria as igualdades abaixo compararem `undefined` com
        // `undefined` e passarem por vacuidade.
        expect(typeof ancora?.usando).toBe('string');
        expect(ancora?.usando).toBe(ancora?.comVerificacao);

        for (const politica of daFatia) {
          // Não nulos, primeiro: um `WITH CHECK` ausente é SUBSTITUÍDO pelo `USING` em silêncio, e
          // uma expressão mais larga passaria a valer para a gravação.
          expect(typeof politica.usando).toBe('string');
          expect(typeof politica.comVerificacao).toBe('string');
          expect(politica.usando).toBe(politica.comVerificacao);
          expect(politica.usando).toBe(ancora?.usando);
        }

        // --- 3. As restrições: a única `(id, empresa_id)` e as FKs COMPOSTAS ---------------
        //
        // A lista INTEIRA por igualdade, e não uma busca pela FK composta: uma busca ficaria verde
        // com a FK simples convivendo ao lado, que é a forma em que o defeito de fato voltaria.
        const restricoes = await sql<RestricaoDoCatalogo[]>`
          SELECT c.relname   AS tabela,
                 con.conname AS nome,
                 con.contype::text AS tipo,
                 (SELECT array_agg(att.attname ORDER BY u.ord)
                    FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
                    JOIN pg_catalog.pg_attribute att
                      ON att.attrelid = con.conrelid AND att.attnum = u.attnum) AS colunas,
                 alvo.relname AS "tabelaReferida",
                 (SELECT array_agg(att.attname ORDER BY u.ord)
                    FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, ord)
                    JOIN pg_catalog.pg_attribute att
                      ON att.attrelid = con.confrelid AND att.attnum = u.attnum) AS "colunasReferidas"
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_class alvo ON alvo.oid = con.confrelid
           WHERE n.nspname = 'negocio'
             AND c.relname = ANY(${[...TABELAS_EM_ORDEM_DO_CATALOGO]})
             AND con.contype IN ('f', 'u')
           ORDER BY c.relname, con.conname
        `;

        expect(restricoes.map((linha) => ({ ...linha }))).toEqual([
          {
            tabela: 'conferencia_bancaria',
            nome: 'conferencia_bancaria_empresa_id_empresa_id_fk',
            tipo: 'f',
            colunas: ['empresa_id'],
            tabelaReferida: 'empresa',
            colunasReferidas: ['id'],
          },
          {
            tabela: 'conferencia_bancaria',
            nome: 'conferencia_bancaria_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: 'conferencia_bancaria',
            nome: 'conferencia_bancaria_usuario_empresa_fkey',
            tipo: 'f',
            colunas: ['solicitada_por', 'empresa_id'],
            tabelaReferida: 'usuario',
            colunasReferidas: ['id', 'empresa_id'],
          },
          {
            tabela: 'emissao_em_lote',
            nome: 'emissao_em_lote_empresa_id_empresa_id_fk',
            tipo: 'f',
            colunas: ['empresa_id'],
            tabelaReferida: 'empresa',
            colunasReferidas: ['id'],
          },
          {
            tabela: 'emissao_em_lote',
            nome: 'emissao_em_lote_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: 'emissao_em_lote',
            nome: 'emissao_em_lote_usuario_empresa_fkey',
            tipo: 'f',
            colunas: ['solicitado_por', 'empresa_id'],
            tabelaReferida: 'usuario',
            colunasReferidas: ['id', 'empresa_id'],
          },
          {
            tabela: 'evento_bancario',
            nome: 'evento_bancario_cobranca_empresa_fkey',
            tipo: 'f',
            colunas: ['cobranca_id', 'empresa_id'],
            tabelaReferida: 'cobranca',
            colunasReferidas: ['id', 'empresa_id'],
          },
          {
            tabela: 'evento_bancario',
            nome: 'evento_bancario_empresa_id_empresa_id_fk',
            tipo: 'f',
            colunas: ['empresa_id'],
            tabelaReferida: 'empresa',
            colunasReferidas: ['id'],
          },
          {
            tabela: 'evento_bancario',
            nome: 'evento_bancario_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: 'item_da_emissao_em_lote',
            nome: 'item_da_emissao_em_lote_cobranca_empresa_fkey',
            tipo: 'f',
            colunas: ['cobranca_id', 'empresa_id'],
            tabelaReferida: 'cobranca',
            colunasReferidas: ['id', 'empresa_id'],
          },
          {
            tabela: 'item_da_emissao_em_lote',
            nome: 'item_da_emissao_em_lote_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: 'item_da_emissao_em_lote',
            nome: 'item_da_emissao_em_lote_lote_cobranca_key',
            tipo: 'u',
            colunas: ['lote_id', 'cobranca_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: 'item_da_emissao_em_lote',
            nome: 'item_da_emissao_em_lote_lote_empresa_fkey',
            tipo: 'f',
            colunas: ['lote_id', 'empresa_id'],
            tabelaReferida: 'emissao_em_lote',
            colunasReferidas: ['id', 'empresa_id'],
          },
        ] satisfies RestricaoDoCatalogo[]);

        // --- 3-b. Os DOIS índices únicos parciais, e o índice único GLOBAL do provedor ------
        //
        // A definição inteira por igualdade: é ela que carrega o `UNIQUE` e o `WHERE`, e perder
        // qualquer um dos dois é mudança silenciosa. Sem o `WHERE`, a empresa emitiria **uma vez só,
        // para sempre** — o lote concluído continuaria disputando com o próximo; sem o `UNIQUE`, o
        // disparo concorrente abriria dois lotes e a recusa passaria a depender de uma leitura antes
        // da gravação, que é corrida disfarçada.
        //
        // `cobranca_identificador_no_provedor_key` entra aqui porque é o **único lugar da suíte** em
        // que a ADR-0033 é verificável: a série é do SaaS, e a definição do índice **não contém
        // `empresa_id`**. Parear com a empresa é o *"corrigir o contador para ser por empresa"* que a
        // ADR proíbe, e ele passaria despercebido — o schema ficaria "mais uniforme" e duas
        // imobiliárias emitiriam o mesmo número para o mesmo provedor.
        const indices = await sql<{ nome: string; definicao: string }[]>`
          SELECT indexname AS nome, indexdef AS definicao
            FROM pg_catalog.pg_indexes
           WHERE schemaname = 'negocio'
             AND indexname = ANY(${[
               'emissao_em_lote_em_andamento_uidx',
               'conferencia_bancaria_em_andamento_uidx',
               'cobranca_identificador_no_provedor_key',
             ]})
           ORDER BY indexname
        `;
        expect(indices.map((linha) => ({ ...linha }))).toEqual([
          {
            nome: 'cobranca_identificador_no_provedor_key',
            definicao:
              'CREATE UNIQUE INDEX cobranca_identificador_no_provedor_key ON negocio.cobranca ' +
              'USING btree (identificador_no_provedor)',
          },
          {
            nome: 'conferencia_bancaria_em_andamento_uidx',
            definicao:
              'CREATE UNIQUE INDEX conferencia_bancaria_em_andamento_uidx ON ' +
              'negocio.conferencia_bancaria USING btree (empresa_id) WHERE (concluida_em IS NULL)',
          },
          {
            nome: 'emissao_em_lote_em_andamento_uidx',
            definicao:
              'CREATE UNIQUE INDEX emissao_em_lote_em_andamento_uidx ON negocio.emissao_em_lote ' +
              'USING btree (empresa_id) WHERE ((concluido_em IS NULL) AND ' +
              '(interrompido_em IS NULL))',
          },
        ]);

        // A coluna nova é ANULÁVEL: nulo é *"ainda não apresentada ao provedor"*, e o PostgreSQL não
        // compara nulos entre si numa restrição única — sem isso, a segunda cobrança não emitida
        // colidiria com a primeira e a carteira inteira travaria.
        const [colunaDoProvedor] = await sql<{ tipo: string; naoNula: boolean }[]>`
          SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS tipo,
                 a.attnotnull                                    AS "naoNula"
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname = 'cobranca'
             AND a.attname = 'identificador_no_provedor'
             AND NOT a.attisdropped
        `;
        expect(colunaDoProvedor).toEqual({ tipo: 'text', naoNula: false });

        // --- 4. O comportamento: semear em A, ler e gravar sob B ---------------------------
        //
        // ⚠️ A gravação legítima do fim deste passo é também a prova de que os dois índices acima são
        // **parciais na prática**, e não só no texto: a empresa A já tem um lote e uma conferência —
        // semeados CONCLUÍDOS —, e a segunda linha de cada uma, em andamento, é ACEITA. Um índice
        // que tivesse perdido o `WHERE` recusaria as duas com `23505`.
        await semearApoio(acesso);

        await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
          await acesso.emUnidadeDeTrabalho(async (tx) => {
            for (const relacao of RELACOES_BANCARIAS) {
              await relacao.gravar(tx, SEMEADOS[relacao.nome], EMPRESA_A.id);
            }
          });
        });

        // O companheiro POSITIVO vem primeiro: sem ele, o vazio sob B não provaria isolamento —
        // provaria banco sem dado.
        const lidosEmA: string[] = [];
        const lidosEmB: string[] = [];
        for (const relacao of RELACOES_BANCARIAS) {
          lidosEmA.push(
            porRelacao(
              relacao.nome,
              JSON.stringify(await lerIdentificadores(acesso, relacao, CONTEXTO_DE_A)),
            ),
          );
          lidosEmB.push(
            porRelacao(
              relacao.nome,
              JSON.stringify(await lerIdentificadores(acesso, relacao, CONTEXTO_DE_B)),
            ),
          );
        }

        expect(lidosEmA).toEqual(
          RELACOES_BANCARIAS.map((relacao) =>
            porRelacao(relacao.nome, JSON.stringify([SEMEADOS[relacao.nome]])),
          ),
        );
        expect(lidosEmB).toEqual(
          RELACOES_BANCARIAS.map((relacao) => porRelacao(relacao.nome, JSON.stringify([]))),
        );

        // A gravação cruzada: sob o contexto de B, com `empresa_id` de A. A linha é bem formada em
        // tudo menos no contexto de quem a escreve — os pais existem e pertencem a A —, de modo que
        // a RLS é o ÚNICO motivo possível da recusa.
        const cruzadasSobB: string[] = [];
        for (const relacao of RELACOES_BANCARIAS) {
          const tentativa = await tentar(() =>
            contextoDeTenant.executarCom(CONTEXTO_DE_B, async () =>
              acesso.emUnidadeDeTrabalho(async (tx) =>
                relacao.gravar(tx, CRUZADOS[relacao.nome], EMPRESA_A.id),
              ),
            ),
          );
          cruzadasSobB.push(porRelacao(relacao.nome, desfechoDaGravacao(tentativa)));
        }

        expect(cruzadasSobB).toEqual(
          RELACOES_BANCARIAS.map((relacao) =>
            porRelacao(relacao.nome, '42501 · row-level security policy'),
          ),
        );

        // …e a MESMA linha, sob o contexto de A, GRAVA. É o que torna o contexto a única variável
        // entre a recusa e o sucesso: sem esta perna, um `INSERT` malformado produziria o mesmo
        // vermelho acima e o caso passaria a provar outra coisa.
        const cruzadasSobA: string[] = [];
        for (const relacao of RELACOES_BANCARIAS) {
          const tentativa = await tentar(() =>
            contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
              acesso.emUnidadeDeTrabalho(async (tx) =>
                relacao.gravar(tx, CRUZADOS[relacao.nome], EMPRESA_A.id),
              ),
            ),
          );
          cruzadasSobA.push(porRelacao(relacao.nome, desfechoDaGravacao(tentativa)));
        }

        expect(cruzadasSobA).toEqual(
          RELACOES_BANCARIAS.map((relacao) => porRelacao(relacao.nome, 'GRAVOU (1 linha(s))')),
        );

        // E a escrita legítima em A **não** vazou para B: o vazio de B continua sendo propriedade da
        // política, e não consequência de a tabela estar vazia.
        const depoisEmB: string[] = [];
        for (const relacao of RELACOES_BANCARIAS) {
          depoisEmB.push(
            porRelacao(
              relacao.nome,
              JSON.stringify(await lerIdentificadores(acesso, relacao, CONTEXTO_DE_B)),
            ),
          );
        }
        expect(depoisEmB).toEqual(
          RELACOES_BANCARIAS.map((relacao) => porRelacao(relacao.nome, JSON.stringify([]))),
        );
      } finally {
        await acesso.encerrar();
        await sql.end();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});
