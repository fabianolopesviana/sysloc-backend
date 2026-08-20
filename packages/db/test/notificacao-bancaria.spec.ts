/**
 * A notícia crua do provedor — gravação **sem contexto de tenant** e ausência de dono. Caso CT-969
 * (T3) da fatia `webhook-e-carne`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-02    | CT-969 | A tabela do recebido cru **não é dado de empresa nenhuma** (ADR-0031): ela
 * |          |  (a)   | não carrega coluna que identifique empresa, e o conjunto das colunas é
 * |          |        | afirmado por **igualdade** contra as oito declaradas, com controle
 * |          |        | antivácuo — contenção aprovaria tanto a coluna que sumiu quanto a que
 * |          |        | apareceu sem ninguém decidir. |
 * | CA-02    | CT-969 | Gravá-la **não exige** contexto de tenant: numa transação em que
 * |          |  (b)   | `app.empresa_id` nunca foi fixado, `registrarNotificacaoBancaria` grava e
 * |          |        | `lerNotificacaoBancaria` devolve a linha — com o `recebido` **idêntico** ao
 * |          |        | enviado (igualdade sobre o objeto inteiro, nunca sobre um campo),
 * |          |        | `desfecho = 'RECEBIDO'`, `tratadoEm` nulo e `recebidoEm` do **banco**. |
 * | CA-06    | CT-969 | O cru lido sob o contexto da empresa A e sob o da empresa B é **a mesma
 * |          |  (c)   | linha**, por igualdade de objeto. A ausência de filtro é a decisão, e não um
 * |          |        | vazamento: a tabela não tem dono. É o companheiro que impede (b) de ser
 * |          |        | lido como *"a política deixou passar"* — não há política a deixar passar. |
 * | CA-02    | CT-969 | O privilégio de `sysloc_app` sobre a tabela crua é **exatamente** o que o
 * |          |  (d)   | bloco 6 da `0020` concede: os sete verbos de relação num objeto só, quatro
 * |          |        | ligados e três desligados. Aqui o privilégio é a **única** proteção que
 * |          |        | existe — a ADR-0031 tira a tabela do alcance da RLS —, e a direção do
 * |          |        | EXCESSO é muda: a FALTA sai como `42501`, mas um `GRANT ALL` não produz
 * |          |        | erro nenhum. É a igualdade que a torna audível. |
 *
 * Rastreabilidade: `CA-02 → CT-969 (RN-08)` · `CA-06 → CT-969 (RN-08)`.
 *
 * ===========================================================================
 * O companheiro NEGATIVO deste caso vive na T2
 * ===========================================================================
 *
 * O sub-caso de tabela com `empresa_id` do **CT-994** é o companion na direção oposta: lá a presença
 * da coluna **reprova**, e a guarda de admissão de `src/catalogo-de-plataforma.ts` a recusa com o
 * motivo `CARREGA_COLUNA_DE_EMPRESA`. Aqui a ausência é medida contra o catálogo do banco de pé, o
 * que fecha a outra ponta: a guarda poderia estar certa sobre um schema que a migração nunca aplicou.
 *
 * ===========================================================================
 * Precondição privilegiada — NENHUMA
 * ===========================================================================
 *
 * Toda consulta corre sobre a cadeia do papel `sysloc_app`, que é o papel da operação. A ausência de
 * contexto **é o caminho normal desta tabela** — a notícia é gravada antes de o roteamento existir —,
 * e por isso a transação é aberta por `sql.begin` sem `set_config`, que é o estado exato de uma
 * conexão que ninguém preparou. A unidade de trabalho do produto não serve aqui de propósito: ela
 * **exige** contexto (`ErroDeContextoInvalido`), e usá-la obrigaria a fixar uma empresa que esta
 * borda não tem.
 *
 * Nenhum símbolo de produção foi acrescentado para o caso existir (Iron Law #6).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import {
  lerNotificacaoBancaria,
  type NotificacaoBancariaPersistida,
  registrarNotificacaoBancaria,
} from '../src/notificacao-bancaria.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso faz poucas transações curtas e duas consultas de catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão basta: os casos correm em série dentro do arquivo. */
const RESERVA_DE_UMA = 1;

/** O papel que a aplicação usa para atender requisição — o único que este arquivo utiliza. */
const PAPEL_DA_APLICACAO = 'sysloc_app';

/** A tabela crua, qualificada pelo schema da ADR-0031 — o alvo do `GRANT` do bloco 6 da `0020`. */
const TABELA_CRUA = 'plataforma.notificacao_bancaria';

/**
 * As **oito** colunas de `plataforma.notificacao_bancaria`, em ordem alfabética.
 *
 * Escritas por extenso, e **não** derivadas do esquema Drizzle: derivá-las do artefato que elas
 * conferem faria a asserção concordar consigo mesma — uma coluna de empresa acrescentada aos dois
 * lados de uma vez passaria verde. É o mesmo critério de `COLUNAS_DA_COBRANCA` em `cobranca.spec.ts`.
 *
 * ⚠️ **Nenhuma delas identifica empresa**, e é isso que o caso mede. Um `empresa_id`, um
 * `empresa_documento` ou qualquer outro nome que carregasse o tenant apareceria aqui como excedente.
 */
const COLUNAS_DA_NOTIFICACAO: readonly string[] = [
  'desfecho',
  'diagnostico',
  'id',
  'identificador_da_liquidacao',
  'identificador_perante_o_provedor',
  'recebido',
  'recebido_em',
  'tratado_em',
];

/**
 * O corpo recebido — o **Caso A** da §4.1.1 do tech spec, no vocabulário do provedor.
 *
 * Ele é copiado do tech spec de propósito: o que a tabela guarda é o que o terceiro mandou, e um
 * objeto inventado pelo caso provaria a travessia de um formato que ninguém envia.
 */
const CORPO_RECEBIDO = {
  idWebhook: 990,
  tipoMovimento: 7,
  dados: {
    seuNumero: '202608000000000042',
    nossoNumero: 1_234_567,
    numeroCliente: 25_546_454,
    numeroIdentificadorBaixa: '1600100000000000001',
    valorBoleto: 1500.0,
    valorPagamento: 1500.0,
    dataHoraSituacaoBaixa: '2026-08-18T14:03:11Z',
    dataVencimento: '2026-08-20',
    cancelamentoBaixa: false,
    baixaRealizadaEmContigencia: false,
    codigoMotivoCancelamento: 2,
  },
} as const;

let banco: BancoMigrado;

/**
 * Grava a notícia numa transação **sem contexto de tenant algum**.
 *
 * Nenhum `set_config('app.empresa_id', …)` é emitido, de propósito: é o estado exato da borda que
 * recebe a notícia, que não sabe — e não pode saber — de que empresa o fato é (ADR-0024, emenda de
 * 2026-08-18). O identificador viaja de volta dentro de um arranjo porque `sql.begin` desembrulha
 * promessas do retorno, e devolver a cadeia crua faria o tipo do resultado perder a forma.
 */
async function gravarSemContexto(recebido: unknown): Promise<string> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [id] = await sql.begin(async (tx) => [
      await registrarNotificacaoBancaria(tx, { recebido }),
    ]);
    if (id === undefined) {
      throw new Error('a transação sem contexto não devolveu o identificador gravado');
    }
    return id;
  } finally {
    await sql.end();
  }
}

/** Lê o cru na mesma condição da gravação: transação **sem** contexto de tenant algum. */
async function lerSemContexto(
  notificacaoId: string,
): Promise<NotificacaoBancariaPersistida | undefined> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [linha] = await sql.begin(async (tx) => [
      await lerNotificacaoBancaria(tx, notificacaoId),
    ]);
    return linha;
  } finally {
    await sql.end();
  }
}

/** Lê o cru **sob** o contexto da empresa dada — a perna (c), que mede a ausência de dono. */
async function lerSobContexto(
  empresaId: string,
  notificacaoId: string,
): Promise<NotificacaoBancariaPersistida | undefined> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [linha] = await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      return [await lerNotificacaoBancaria(tx, notificacaoId)];
    });
    return linha;
  } finally {
    await sql.end();
  }
}

/**
 * O retrato dos privilégios de um papel sobre a tabela crua — os **sete** verbos que o Postgres
 * reconhece para uma relação, num objeto só.
 *
 * São sete, e não oito: `MAINTAIN` (PG 17+) governa `VACUUM`/`ANALYZE`/`REINDEX` e não dá acesso a
 * dado nenhum, de modo que não pertence à minimalidade que o bloco 6 da `0020` declara. O vetor real
 * — um `GRANT ALL` escrito por engano ou por migração futura — liga os três desligados de uma vez, e
 * já reprova aqui.
 */
interface PrivilegiosSobreOCru {
  readonly selecionar: boolean;
  readonly inserir: boolean;
  readonly atualizar: boolean;
  readonly remover: boolean;
  readonly truncar: boolean;
  readonly referenciar: boolean;
  readonly disparar: boolean;
}

/**
 * Lê do catálogo, por `has_table_privilege`, o que `sysloc_app` alcança na tabela crua.
 *
 * `has_table_privilege` e não o texto de `relacl`: é a leitura EFETIVA do privilégio — ela responde
 * *quem pode o quê*, e não muda de forma entre versões do servidor, ao contrário da lista de controle
 * renderizada.
 */
async function privilegiosDaAplicacaoSobreOCru(): Promise<PrivilegiosSobreOCru> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [linha] = await sql<PrivilegiosSobreOCru[]>`
      SELECT has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'SELECT')     AS selecionar,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'INSERT')     AS inserir,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'UPDATE')     AS atualizar,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'DELETE')     AS remover,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'TRUNCATE')   AS truncar,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'REFERENCES') AS referenciar,
             has_table_privilege(${PAPEL_DA_APLICACAO}, ${TABELA_CRUA}, 'TRIGGER')    AS disparar
    `;
    if (linha === undefined) {
      throw new Error(
        `o catálogo não devolveu privilégio algum de '${PAPEL_DA_APLICACAO}' sobre ` +
          `'${TABELA_CRUA}' — sem isso este caso não teria o que examinar`,
      );
    }
    return linha;
  } finally {
    await sql.end();
  }
}

/** As colunas que o catálogo do banco de pé declara para a tabela crua. */
async function colunasDaTabela(): Promise<readonly string[]> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const linhas = await sql<{ nome: string }[]>`
      SELECT a.attname AS nome
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'plataforma'
         AND c.relname = 'notificacao_bancaria'
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY a.attname
    `;
    return linhas.map((linha) => linha.nome);
  } finally {
    await sql.end();
  }
}

describe('CT-969 — o cru é gravado sem contexto de tenant e sem coluna de empresa', () => {
  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-969 — a gravação sucede sem `app.empresa_id`, a linha volta íntegra, e a tabela não tem coluna de empresa',
    async () => {
      // --- (a) A tabela não tem dono, e o conjunto de colunas é afirmado por igualdade -----------
      //
      // O controle antivácuo vem primeiro: comparar duas listas vazias passaria por vacuidade, e
      // uma tabela inexistente devolveria exatamente isso.
      const colunas = await colunasDaTabela();
      expect(colunas.length).toBe(COLUNAS_DA_NOTIFICACAO.length);
      expect(colunas).toEqual(COLUNAS_DA_NOTIFICACAO);

      // --- (b) A gravação sem contexto, e a leitura de volta -------------------------------------
      const notificacaoId = await gravarSemContexto(CORPO_RECEBIDO);
      const persistida = await lerSemContexto(notificacaoId);

      // Igualdade sobre o objeto inteiro, e não campo a campo: uma coluna que passasse a ser
      // preenchida por engano — `tratado_em`, um dos identificadores — apareceria como diferença
      // literal. `recebidoEm` sai da comparação porque é instante do **banco**, e não fato do caso;
      // ele é afirmado logo abaixo, pelo que dele se pode afirmar.
      expect(
        persistida === undefined ? undefined : { ...persistida, recebidoEm: undefined },
      ).toEqual({
        id: notificacaoId,
        recebido: CORPO_RECEBIDO,
        recebidoEm: undefined,
        desfecho: 'RECEBIDO',
        identificadorPeranteOProvedor: null,
        identificadorDaLiquidacao: null,
        diagnostico: null,
        tratadoEm: null,
      });
      // O carimbo existe e é do banco: `Date`, e não nulo nem cadeia. Sem esta linha, a exclusão
      // acima deixaria `recebido_em` inteiramente sem asserção.
      expect(persistida?.recebidoEm).toBeInstanceOf(Date);

      // --- (c) O cru NÃO é filtrado por empresa — a ausência de dono, medida ---------------------
      //
      // As duas leituras são comparadas ENTRE SI, e não apenas com o esperado: o que a ADR-0031
      // decide é que a linha é a mesma para qualquer contexto, e duas asserções separadas contra o
      // mesmo literal ficariam verdes se cada contexto enxergasse uma linha diferente com o mesmo
      // conteúdo — o que aqui é impossível, mas a comparação direta é o que o afirma.
      const sobA = await lerSobContexto(EMPRESA_A.id, notificacaoId);
      const sobB = await lerSobContexto(EMPRESA_B.id, notificacaoId);

      expect(sobA).toEqual(sobB);
      expect(sobA).toEqual(persistida);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-969 (d) — `sysloc_app` alcança a tabela crua com os quatro verbos concedidos, e com nenhum a mais',
    async () => {
      // Igualdade sobre o objeto inteiro, e não uma asserção por verbo concedido: o bloco 6 da
      // `0020` declara em prosa *"os quatro verbos, e nenhum a mais (sem `TRUNCATE`, sem
      // `REFERENCES`, sem `TRIGGER`)"*, e é a metade NEGATIVA dessa frase que não tinha medição.
      //
      // A assimetria é a razão de o caso existir. A FALTA de um dos quatro é barulhenta — a
      // operação para com `42501`, e nunca com resultado errado. O EXCESSO é MUDO: um `GRANT ALL`
      // escrito por engano, ou trazido por migração futura, atravessaria a fatia inteira sem
      // produzir erro nenhum. E aqui o privilégio é a ÚNICA proteção que existe: a ADR-0031 tira
      // esta tabela do alcance da política de linha, de modo que não há segunda barreira atrás.
      expect(await privilegiosDaAplicacaoSobreOCru()).toEqual({
        // Os quatro que as operações de `src/notificacao-bancaria.ts` consomem: gravar a notícia,
        // ler o cru, carimbar o desfecho (T7) e expurgar o vencido dos 90 dias (RN-11).
        selecionar: true,
        inserir: true,
        atualizar: true,
        remover: true,
        // Os três que não foram concedidos, e cuja ausência é o conteúdo desta asserção.
        truncar: false,
        referenciar: false,
        disparar: false,
      } satisfies PrivilegiosSobreOCru);
    },
    LIMITE_DO_CASO_MS,
  );
});
