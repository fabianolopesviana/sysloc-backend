/**
 * O estado da entrega da notícia do provedor — o banco respondendo sozinho.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-02    | CT-1027 | `negocio.entrega_da_noticia` tem `relrowsecurity` E `relforcerowsecurity`
 * |          |         | verdadeiros em `pg_class`; tem EXATAMENTE uma política `FOR ALL`, com
 * |          |         | `qual` e `with_check` não nulos, idênticos entre si e idênticos à
 * |          |         | expressão já aplicada em `negocio.cobranca` pela `0010`; a lista INTEIRA
 * |          |         | de restrições (`f`, `u`, `c`) é a declarada — a única `(id, empresa_id)`,
 * |          |         | a única por empresa, a FK simples da empresa, a FK **composta** da autoria
 * |          |         | `(verificada_por, empresa_id) → usuario(id, empresa_id)` e a `CHECK` de
 * |          |         | coerência. A segunda linha da mesma empresa sai `23505`, enquanto a linha
 * |          |         | de OUTRA empresa grava; as três combinações coerentes gravam e as três
 * |          |         | incoerentes saem `23514`; o instante da verificação está dentro da janela
 * |          |         | lida do BANCO, e o módulo não o recebe por parâmetro. E, com uma linha
 * |          |         | semeada sob a empresa A: sob o contexto de B o `SELECT` devolve ZERO
 * |          |         | linhas, enquanto sob A devolve a semeada (controle antivácuo); o `INSERT`
 * |          |         | com `empresa_id` de A, sob o contexto de B, é recusado com `code ===
 * |          |         | '42501'` e a mensagem da política de linha; e a MESMA linha, sob A, grava
 * |          |         | — o que torna o contexto a única variável entre a recusa e o sucesso. As
 * |          |         | mesmas propriedades valem pelas funções publicadas do módulo, cujas
 * |          |         | assinaturas **não recebem identificador de empresa**. |
 * | CA-18    | CT-1049 | O teto anti-abuso do `diagnostico` VIGORA NA ESCRITA: gravado pelo
 * |          |         | módulo e relido do banco, um diagnóstico com uma chave a mais que
 * |          |         | `MAIOR_DIAGNOSTICO_EM_CHAVES` chega à coluna com exatamente as do teto —
 * |          |         | as PRIMEIRAS que o provedor mandou, com os valores verbatim —, enquanto
 * |          |         | o que está NO limite chega íntegro (controle antivácuo); no eixo de
 * |          |         | tamanho, a chave que estoura `MAIOR_DIAGNOSTICO_EM_CARACTERES` é
 * |          |         | descartada e a que cabe sobrevive, e a que estoura SOZINHA deixa `{}`,
 * |          |         | que **não** é `null`; `null` atravessa como `null` e nunca vira `{}`; a
 * |          |         | chave `__proto__` vinda de `JSON.parse` — que é como a resposta do
 * |          |         | provedor entra — cabe nos dois eixos e sobrevive VERBATIM, afirmada
 * |          |         | pelo valor **e** pela igualdade das chaves ORDENADAS, que é o que
 * |          |         | discrimina o descarte silencioso da atribuição indexada; e
 * |          |         | o motivo relido satisfaz `esquemaDoMotivoDaRecusa` enquanto o motivo
 * |          |         | ENVIADO o reprova pelo `path` `['diagnostico']` — o par que mostra que
 * |          |         | quem converte um no outro é a camada que grava. |
 *
 * ===========================================================================
 * Por que um arquivo NOVO, e não uma entrada em `isolamento-bancario.spec.ts`
 * ===========================================================================
 *
 * Nenhuma suíte existente cobre esta invariante. `isolamento-bancario.spec.ts` é dedicado às
 * **quatro** tabelas da migração `0017` e afirma os conjuntos delas por igualdade da lista inteira,
 * com o molde `RELACOES_BANCARIAS` parametrizado — acrescentar a quinta relação ali **mudaria os
 * esperados de casos já provados por acréscimo alheio**, que é exatamente a razão registrada no
 * cabeçalho daquele arquivo para ele próprio ter nascido separado de `isolamento.spec.ts`.
 *
 * O precedente que sustenta a decisão é `identidade-no-provedor.spec.ts`: a tabela irmã do par
 * `0021`/`0022` ganhou suíte própria, com o isolamento afirmado dentro dela.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — MT-E1 e MT-E2 (2026-08-22)
 * ===========================================================================
 *
 * Os passos 1 a 3 observam CATÁLOGO (estrutura), e não comportamento de domínio ⇒ prova de
 * falsificação obrigatória (`.claude/rules/testing-stack.md`). O defeito foi reintroduzido no
 * artefato REAL e medido, com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — o pacote resolve `"."` para
 * `dist/`, e o defeito no fonte não alcançaria o que executa:
 *
 *   * **controle** — árvore íntegra: `234 passed`, 34 arquivos;
 *   * **MT-E1 · o `FORCE ROW LEVEL SECURITY` removido da `0024`** — a ausência exata que o gerador
 *     produziria se a parceira autoral não existisse. `14 failed | 220 passed`, e o passo 1 deste
 *     caso reprova NOMEANDO a propriedade:
 *     `- { tabela: 'entrega_da_noticia', habilitada: true, forcada: true }` contra
 *     `+ { … forcada: false }`. A guarda de cobertura de `catalogo.spec.ts` acusa em paralelo —
 *     duas vias independentes. **O alcance largo é a rede funcionando**: `FORCE` ausente é defeito
 *     de schema, e a suíte inteira que depende dele cai junto;
 *   * **MT-E2 · a FK COMPOSTA da autoria trocada pela simples** na `0023`
 *     (`FOREIGN KEY ("verificada_por") REFERENCES "identidade"."usuario"("id")`). `1 failed | 233
 *     passed`: **só** o passo 3 deste caso reprova, com `colunas: ['verificada_por']` e
 *     `colunasReferidas: ['id']` contra o par declarado. **Nenhum outro caso da suíte acusa**, e é
 *     exatamente esse o ponto: sem este passo, a FK simples entraria em produção verde — e o estado
 *     da empresa A poderia constar como verificado por alguém da empresa B;
 *   * **reversão** — a `0023` e a `0024` foram restauradas e conferidas por `sha256sum` idêntico ao
 *     original (`cf93150780c5…` e `19c9d4372c12…`), e o controle voltou a `234 passed`.
 *
 * A âncora deste registro é SIMBÓLICA — {@link RELACAO} e {@link RESTRICOES_ESPERADAS} —, nunca
 * número de linha.
 *
 * Os passos 4 a 9 são **comportamentais** e **não ganham mutante**: mutation testing está fora da
 * stack por decisão de 2026-08-16, e o P4 do Protocolo Antirregressão manda **declarar** qual
 * asserção discrimina, o que cada passo faz no próprio comentário.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * O contexto vem exclusivamente da API pública do pacote — `contextoDeTenant.executarCom` e
 * `abrirAcessoAoBanco` —, e a conexão é a do papel `sysloc_app`: `conexaoDeMigracao` e
 * `conexaoSuperusuaria` **não são importados nem invocados em instrução alguma deste arquivo**, e a
 * ausência dos dois nomes fora deste parágrafo é greppável. Isso não é
 * detalhe: o superusuário contorna RLS com ou sem `FORCE`, e o dono da tabela a contorna enquanto
 * não houver `FORCE` — uma suíte conectada por qualquer um dos dois passaria integralmente contra
 * um schema sem isolamento algum, que é o modo de falha registrado nos próprios `Cons` da ADR-0008.
 *
 * As empresas e os usuários vêm de `../src/semente.ts`, **derivados da carga e não redigitados**: a
 * chave estrangeira composta cobra justamente o par `(usuario, empresa)` que a carga gravou, e
 * copiar o identificador criaria uma segunda declaração livre para divergir dela. As linhas do
 * arranjo nascem de SQL do próprio caso, sob o contexto da empresa dona — o caminho que a aplicação
 * usa. **Nenhum símbolo foi acrescentado a `packages/db/src/**` nem às migrações para este caso
 * existir.**
 */

import {
  esquemaDoMotivoDaRecusa,
  MAIOR_DIAGNOSTICO_EM_CARACTERES,
  MAIOR_DIAGNOSTICO_EM_CHAVES,
} from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  type DadosDoDesfechoDaEntrega,
  gravarDesfechoDaEntrega,
  lerEstadoDaEntrega,
} from '../src/entrega-da-noticia.ts';
import { EMPRESA_A, EMPRESA_B, USUARIOS, type UsuarioSemeado } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso lê o catálogo e faz várias rodadas de escrita e leitura; o teto é folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física, e é isso
 * que faz o `SET LOCAL` do contexto ser de fato o que recorta. */
const RESERVA_DE_UMA = 1;

/** A relação sob teste, pelo nome com que o catálogo a devolve. */
const RELACAO = 'entrega_da_noticia';

/** A tabela cuja política serve de ÂNCORA da expressão — declarada pela `0010`, intocada aqui. */
const TABELA_ANCORA = 'cobranca';

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * O usuário da carga de cada empresa — **derivado**, e não um literal reescrito aqui.
 *
 * O par `(usuario, empresa)` que a chave estrangeira composta cobra é o mesmo que `semente.ts`
 * gravou; copiar o identificador criaria uma segunda declaração livre para divergir da carga que a
 * instância efêmera aplica.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const achado = USUARIOS.find((usuario) => usuario.empresaId === empresaId);
  if (achado === undefined) {
    throw new Error(`a carga não tem usuário da empresa ${empresaId}`);
  }
  return achado;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);
const USUARIO_DE_B = exigirUsuarioDa(EMPRESA_B.id);

// ---------------------------------------------------------------------------
// Identificadores descartáveis — nenhum valor sai de material versionado
// ---------------------------------------------------------------------------

const LINHA_DE_A = 'dddddddd-1111-4000-8000-000000000001';
const LINHA_CRUZADA = 'dddddddd-2222-4000-8000-000000000002';
const SEGUNDA_LINHA_DE_A = 'dddddddd-3333-4000-8000-000000000003';
const LINHA_DE_B = 'dddddddd-4444-4000-8000-000000000004';

/** O motivo da recusa, como o provedor o devolveria. */
const CODIGO_DA_RECUSA = 'RH01';
const MENSAGEM_DA_RECUSA = 'Cadastro recusado';
const DIAGNOSTICO_DA_RECUSA = { campo: 'contaCorrente' } as const;

// ---------------------------------------------------------------------------
// As formas do catálogo
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

/**
 * A lista INTEIRA de restrições, por igualdade — e não uma busca pela FK composta.
 *
 * Uma busca ficaria verde com a FK **simples** da autoria convivendo ao lado, que é a forma em que o
 * defeito de fato voltaria: `verificada_por → usuario(id)` sozinha permite que o estado da empresa A
 * conste como verificado por alguém da empresa B.
 *
 * A ordem é a do catálogo (`conname`, intercalação `C`).
 */
const RESTRICOES_ESPERADAS: readonly RestricaoDoCatalogo[] = [
  {
    tabela: RELACAO,
    nome: 'entrega_da_noticia_coerencia_chk',
    tipo: 'c',
    // ⚠️ **`habilitada` SAIU e `situacao` entrou**, e a troca é o conteúdo da `0025`: o eixo da
    // coerência do motivo deixou de ser o booleano e passou a ser o ternário. Sob o eixo antigo, uma
    // entrega *em validação* — verificada, não habilitada, sem motivo — era irrepresentável.
    // A asserção **não foi afrouxada**: continua sendo igualdade de lista, agora sobre as colunas
    // que a restrição de fato alcança.
    colunas: [
      'situacao',
      'verificada_em',
      'motivo_codigo',
      'motivo_mensagem',
      'motivo_diagnostico',
    ],
    tabelaReferida: null,
    colunasReferidas: null,
  },
  {
    tabela: RELACAO,
    nome: 'entrega_da_noticia_empresa_id_empresa_id_fk',
    tipo: 'f',
    colunas: ['empresa_id'],
    tabelaReferida: 'empresa',
    colunasReferidas: ['id'],
  },
  {
    tabela: RELACAO,
    nome: 'entrega_da_noticia_empresa_key',
    tipo: 'u',
    colunas: ['empresa_id'],
    tabelaReferida: null,
    colunasReferidas: null,
  },
  {
    tabela: RELACAO,
    nome: 'entrega_da_noticia_id_empresa_key',
    tipo: 'u',
    colunas: ['id', 'empresa_id'],
    tabelaReferida: null,
    colunasReferidas: null,
  },
  {
    tabela: RELACAO,
    // A restrição que a `0025` acrescenta: o domínio de `situacao` e a amarra que impede
    // `habilitada` de discordar dela. A ordem das colunas é a de aparição no texto da `CHECK`.
    nome: 'entrega_da_noticia_situacao_chk',
    tipo: 'c',
    colunas: ['situacao', 'habilitada'],
    tabelaReferida: null,
    colunasReferidas: null,
  },
  {
    tabela: RELACAO,
    nome: 'entrega_da_noticia_usuario_empresa_fkey',
    tipo: 'f',
    colunas: ['verificada_por', 'empresa_id'],
    tabelaReferida: 'usuario',
    colunasReferidas: ['id', 'empresa_id'],
  },
];

// ---------------------------------------------------------------------------
// Utilidades de coleta — as mesmas formas de `isolamento-bancario.spec.ts`
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

/** O nome da restrição que o servidor apontou, quando ele o apontou. */
function restricaoViolada(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/**
 * O desfecho de uma tentativa de gravação, como texto comparável — o código E **qual** restrição.
 *
 * Ele existe para que a asserção seja UMA igualdade que nomeia o que divergiu, em vez de um
 * `toThrow` que aprovaria qualquer recusa. O discriminador é o **nome da restrição**, e não o texto
 * da mensagem: o texto é do servidor e muda entre versões, enquanto o nome é o que a migração
 * declarou — um `23514` de outra `CHECK` não satisfaz esta forma.
 *
 * A política de linha não é restrição nomeada, e por isso ela entra pela marca que o servidor emite
 * para ela — que é a única coisa que distingue a recusa da política de um `42501` de privilégio.
 */
function desfechoDaGravacao(tentativa: Resultado<number>): string {
  if (tentativa.ok) {
    return `GRAVOU (${tentativa.valor} linha(s))`;
  }
  const codigo = sqlstate(tentativa.erro) ?? 'sem sqlstate';
  const restricao = restricaoViolada(tentativa.erro);
  if (restricao !== undefined) {
    return `${codigo} · ${restricao}`;
  }
  const texto = mensagemDo(tentativa.erro);
  return texto.includes('row-level security policy')
    ? `${codigo} · row-level security policy`
    : `${codigo} · ${texto}`;
}

/** A forma de uma linha do arranjo, em vocabulário do banco. */
interface LinhaDoArranjo {
  readonly id: string;
  readonly empresaId: string;
  readonly habilitada: boolean;
  readonly verificada: boolean;
  readonly comMotivo: boolean;
  readonly verificadaPor: string | null;
}

/**
 * Grava uma linha por SQL do próprio caso, sob o contexto de quem chama.
 *
 * ⚠️ **`pg_catalog.now()` para o instante, nunca um valor do processo** (ADR-0026): o arranjo usa o
 * mesmo relógio que a produção usa, e o passo 6 mede a janela contra ele.
 */
async function gravarLinha(tx: TransactionSql, linha: LinhaDoArranjo): Promise<number> {
  const resultado = await tx`
    INSERT INTO negocio.entrega_da_noticia
                (id, empresa_id, habilitada, situacao, verificada_em, motivo_codigo, motivo_mensagem,
                 motivo_diagnostico, verificada_por)
    VALUES (${linha.id}, ${linha.empresaId}, ${linha.habilitada},
            -- A situacao e DERIVADA do booleano do arranjo, e nao um terceiro campo dele: este caso
            -- mede isolamento, e nao o ternario -- quem mede o ternario e o CT-1054. Derivar aqui
            -- mantem o arranjo com um eixo so e satisfaz a amarra da 0025 por construcao.
            ${linha.habilitada ? 'HABILITADA' : 'DESABILITADA'},
            ${linha.verificada ? tx`pg_catalog.now()` : tx`NULL`},
            ${linha.comMotivo ? CODIGO_DA_RECUSA : null},
            ${linha.comMotivo ? MENSAGEM_DA_RECUSA : null},
            ${linha.comMotivo ? JSON.stringify(DIAGNOSTICO_DA_RECUSA) : null}::text::jsonb,
            ${linha.verificadaPor})
  `;
  return resultado.count;
}

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

beforeEach(async () => {
  // Sob o contexto de CADA empresa: a política recorta o `DELETE` também, e apagar sob uma só
  // deixaria a linha da outra viva — a independência de ordem é o que este bloco compra.
  for (const empresa of [EMPRESA_A, EMPRESA_B]) {
    await emUnidade(empresa.id, async (tx) => {
      await tx`DELETE FROM negocio.entrega_da_noticia`;
    });
  }
}, LIMITE_DO_CASO_MS);

async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Os identificadores da relação sob o contexto dado — SEM filtro por empresa (ADR-0008). */
async function lerIdentificadores(
  contexto: contextoDeTenant.ContextoDeTenant,
): Promise<readonly string[]> {
  return await contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<{ id: string }[]>`
        SELECT id FROM negocio.entrega_da_noticia ORDER BY id
      `;
      return linhas.map((linha) => linha.id);
    }),
  );
}

/**
 * A referência opaca ao cadastro, escrita por extenso — o que a `0025` passou a guardar.
 *
 * Ela é opaca **por decisão**: nada no produto a interpreta, e o caso não a compara com nada além
 * dela mesma. O valor é arbitrário de propósito.
 */
const REFERENCIA_DO_CADASTRO = '4';

/** O desfecho de uma tentativa que RECUSOU — os três campos do motivo, verbatim do provedor. */
const DESFECHO_RECUSADO: DadosDoDesfechoDaEntrega = {
  situacao: 'DESABILITADA',
  referenciaNoProvedor: null,
  motivo: {
    codigo: CODIGO_DA_RECUSA,
    mensagem: MENSAGEM_DA_RECUSA,
    diagnostico: { ...DIAGNOSTICO_DA_RECUSA },
  },
  verificadaPor: USUARIO_DE_A.id,
};

/** O desfecho de uma tentativa que HABILITOU — sem motivo, que é o que a `CHECK` exige. */
const DESFECHO_HABILITADO: DadosDoDesfechoDaEntrega = {
  situacao: 'HABILITADA',
  referenciaNoProvedor: REFERENCIA_DO_CADASTRO,
  motivo: null,
  verificadaPor: null,
};

/**
 * O desfecho de uma tentativa que deixou a entrega **em validação** — o terceiro estado da `0025`.
 *
 * ⚠️ Ele é o que a `CHECK` da `0023` tornava **irrepresentável**: verificada, não habilitada e
 * **sem motivo**, porque ninguém recusou nada. É o estado normal de saída de toda ação corretiva.
 */
const DESFECHO_EM_VALIDACAO: DadosDoDesfechoDaEntrega = {
  situacao: 'EM_VALIDACAO',
  referenciaNoProvedor: REFERENCIA_DO_CADASTRO,
  motivo: null,
  verificadaPor: null,
};

describe('CT-1054 — o terceiro estado da entrega é representável, e a amarra o impede de divergir', () => {
  it(
    'CT-1054 — EM_VALIDACAO grava: verificada, NÃO habilitada e SEM motivo — o que a `0023` proibia',
    async () => {
      await emUnidade(
        EMPRESA_A.id,
        async (tx) => await gravarDesfechoDaEntrega(tx, DESFECHO_EM_VALIDACAO),
      );

      const gravado = await emUnidade(EMPRESA_A.id, lerEstadoDaEntrega);

      // ⚠️ A ASSERÇÃO QUE DISCRIMINA: sob a `CHECK` da `0023`, esta gravação **violava a restrição**
      // e a chamada levantava. A cláusula antiga exigia motivo sempre que a entrega não estivesse
      // habilitada e já tivesse sido verificada — e uma entrega em validação é exatamente isso,
      // **sem** motivo, porque ninguém recusou nada. O terceiro estado era irrepresentável.
      expect(gravado?.situacao).toBe('EM_VALIDACAO');
      expect(gravado?.motivo).toBeNull();
      expect(gravado?.verificadaEm).toBeInstanceOf(Date);

      // A amarra da `0025`: `habilitada` é a projeção booleana da situação, e em validação ela é
      // falsa — a entrega ainda não entrega nada.
      expect(gravado?.habilitada).toBe(false);

      // E a referência atravessa opaca, que é o que autoriza a correção do endereço depois.
      expect(gravado?.referenciaNoProvedor).toBe(REFERENCIA_DO_CADASTRO);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1054 (b) — a amarra é do BANCO: `habilitada` que discorde da situação é RECUSADA',
    async () => {
      // ⚠️ Por SQL direto, e não pela porta: `gravarDesfechoDaEntrega` **deriva** `habilitada` da
      // situação, de modo que a divergência é inalcançável por ela. O que este caso prova é que a
      // garantia não depende dessa derivação — se um segundo caminho de escrita nascer amanhã, é o
      // banco que recusa. Sem esta perna, a amarra seria uma convenção da aplicação.
      await expect(
        emUnidade(EMPRESA_A.id, async (tx) => {
          await tx`
            INSERT INTO negocio.entrega_da_noticia
                        (empresa_id, habilitada, situacao, verificada_em, verificada_por)
            VALUES (${EMPRESA_A.id}, true, 'EM_VALIDACAO', pg_catalog.now(), NULL)
          `;
        }),
      ).rejects.toThrow(/entrega_da_noticia_situacao_chk/);

      // O controle positivo: a MESMA instrução, com o par coerente, é aceita. Sem ele, uma tabela
      // que recusasse toda inserção satisfaria a asserção acima.
      await expect(
        emUnidade(EMPRESA_A.id, async (tx) => {
          await tx`
            INSERT INTO negocio.entrega_da_noticia
                        (empresa_id, habilitada, situacao, verificada_em, verificada_por)
            VALUES (${EMPRESA_A.id}, false, 'EM_VALIDACAO', pg_catalog.now(), NULL)
          `;
        }),
      ).resolves.toBeUndefined();
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('estado da entrega da notícia (T4)', () => {
  it(
    'CT-1027 — a tabela do estado da entrega nasce isolada pelo banco: RLS forçada, política única, restrição única e FK composta, com leitura cruzada vazia e gravação cruzada recusada',
    async () => {
      const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });

      try {
        // --- 1. RLS habilitada E FORÇADA -------------------------------------------------
        //
        // As duas metades numa asserção só, e por igualdade de objeto: `ENABLE` sem `FORCE` é o
        // estado em que o isolamento existe para quem não é dono e some para o dono — exatamente o
        // que a `0023` sozinha produziria, porque o gerador não emite `FORCE`.
        const rls = await sql<EstadoDeRls[]>`
          SELECT c.relname             AS tabela,
                 c.relrowsecurity      AS habilitada,
                 c.relforcerowsecurity AS forcada
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname = ${RELACAO}
        `;
        expect(rls.map((linha) => ({ ...linha }))).toEqual([
          { tabela: 'entrega_da_noticia', habilitada: true, forcada: true },
        ] satisfies EstadoDeRls[]);

        // --- 2. Exatamente UMA política, `FOR ALL`, com `USING` e `WITH CHECK` idênticos ---
        const politicas = await sql<PoliticaDoCatalogo[]>`
          SELECT tablename  AS tabela,
                 policyname AS nome,
                 cmd        AS comando,
                 qual       AS usando,
                 with_check AS "comVerificacao"
            FROM pg_catalog.pg_policies
           WHERE schemaname = 'negocio'
             AND tablename = ANY(${[RELACAO, TABELA_ANCORA]})
           ORDER BY tablename, policyname
        `;

        const daFatia = politicas.filter((politica) => politica.tabela !== TABELA_ANCORA);
        // A contagem vem ANTES: duas políticas na mesma tabela seriam OU lógico entre elas, e a
        // segunda poderia alargar o que a primeira restringe sem que a inspeção da primeira acusasse.
        expect(daFatia).toHaveLength(1);
        // O nome por extenso, e não composto por interpolação: derivá-lo do nome da tabela faria a
        // asserção aceitar qualquer convenção que o autor da migração tivesse escolhido.
        expect(
          daFatia.map((politica) => [politica.tabela, politica.nome, politica.comando]),
        ).toEqual([['entrega_da_noticia', 'entrega_da_noticia_isolamento_empresa', 'ALL']]);

        // A expressão é LIDA da política da cobrança, e não redigitada aqui: redigitá-la criaria a
        // segunda redação do mesmo isolamento, livre para divergir junto com a errada. A âncora é
        // **externa à fatia**, que é o que a torna capaz de reprovar.
        const ancora = politicas.find((politica) => politica.tabela === TABELA_ANCORA);
        // Sem esta linha, uma âncora ausente faria as igualdades abaixo compararem `undefined` com
        // `undefined` e passarem por vacuidade.
        expect(typeof ancora?.usando).toBe('string');
        expect(ancora?.usando).toBe(ancora?.comVerificacao);

        const daEntrega = daFatia[0];
        // Não nulos, primeiro: um `WITH CHECK` ausente é SUBSTITUÍDO pelo `USING` em silêncio, e uma
        // expressão mais larga passaria a valer para a gravação.
        expect(typeof daEntrega?.usando).toBe('string');
        expect(typeof daEntrega?.comVerificacao).toBe('string');
        expect(daEntrega?.usando).toBe(daEntrega?.comVerificacao);
        expect(daEntrega?.usando).toBe(ancora?.usando);

        // --- 3. A lista INTEIRA de restrições, por igualdade ------------------------------
        const restricoes = await sql<RestricaoDoCatalogo[]>`
          SELECT c.relname         AS tabela,
                 con.conname       AS nome,
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
             AND c.relname = ${RELACAO}
             AND con.contype IN ('f', 'u', 'c')
           ORDER BY con.conname
        `;
        expect(restricoes.map((linha) => ({ ...linha }))).toEqual(RESTRICOES_ESPERADAS);

        // A coluna do dono-empresa é NÃO NULA (AT-1). A lista acima não a cobre: uma FK admite
        // coluna anulável, e `empresa_id` nulo faria a política nunca casar — a linha ficaria
        // invisível para todo mundo, inclusive para quem a gravou.
        const [colunaDaEmpresa] = await sql<{ tipo: string; naoNula: boolean }[]>`
          SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS tipo,
                 a.attnotnull                                    AS "naoNula"
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname = ${RELACAO}
             AND a.attname = 'empresa_id'
             AND NOT a.attisdropped
        `;
        expect(colunaDaEmpresa).toEqual({ tipo: 'uuid', naoNula: true });

        // --- 4. Unicidade POR EMPRESA, comportamental -------------------------------------
        await emUnidade(EMPRESA_A.id, async (tx) => {
          await gravarLinha(tx, {
            id: LINHA_DE_A,
            empresaId: EMPRESA_A.id,
            habilitada: false,
            verificada: true,
            comMotivo: true,
            verificadaPor: USUARIO_DE_A.id,
          });
        });

        const segundaDeA = await tentar(async () =>
          emUnidade(EMPRESA_A.id, async (tx) =>
            gravarLinha(tx, {
              id: SEGUNDA_LINHA_DE_A,
              empresaId: EMPRESA_A.id,
              habilitada: false,
              verificada: true,
              comMotivo: true,
              verificadaPor: USUARIO_DE_A.id,
            }),
          ),
        );
        expect(desfechoDaGravacao(segundaDeA)).toBe('23505 · entrega_da_noticia_empresa_key');

        // …e a linha de B GRAVA. Sem esta perna, uma unicidade GLOBAL — `UNIQUE` sem a coluna de
        // empresa, ou uma tabela de linha única — satisfaria a asserção acima e travaria o produto
        // na segunda imobiliária que ativasse a entrega.
        const primeiraDeB = await tentar(async () =>
          emUnidade(EMPRESA_B.id, async (tx) =>
            gravarLinha(tx, {
              id: LINHA_DE_B,
              empresaId: EMPRESA_B.id,
              habilitada: true,
              verificada: true,
              comMotivo: false,
              verificadaPor: USUARIO_DE_B.id,
            }),
          ),
        );
        expect(desfechoDaGravacao(primeiraDeB)).toBe('GRAVOU (1 linha(s))');

        // --- 5. A `CHECK` de coerência, comportamental ------------------------------------
        //
        // As TRÊS legítimas primeiro: sem elas, uma `CHECK` que recusasse tudo passaria nas três
        // negativas e o caso passaria a provar que o banco não aceita nada.
        const legitimas = [
          {
            rotulo: 'habilitada, verificada, sem motivo',
            linha: { habilitada: true, verificada: true, comMotivo: false },
          },
          {
            rotulo: 'desabilitada, verificada, com motivo',
            linha: { habilitada: false, verificada: true, comMotivo: true },
          },
          {
            rotulo: 'nunca tentou: desabilitada, sem verificação, sem motivo',
            linha: { habilitada: false, verificada: false, comMotivo: false },
          },
        ] as const;

        const desfechosLegitimos: string[] = [];
        for (const caso of legitimas) {
          const tentativa = await tentar(async () =>
            emUnidade(EMPRESA_A.id, async (tx) => {
              await tx`DELETE FROM negocio.entrega_da_noticia`;
              return gravarLinha(tx, {
                id: LINHA_DE_A,
                empresaId: EMPRESA_A.id,
                verificadaPor: caso.linha.verificada ? USUARIO_DE_A.id : null,
                ...caso.linha,
              });
            }),
          );
          desfechosLegitimos.push(`${caso.rotulo}: ${desfechoDaGravacao(tentativa)}`);
        }
        expect(desfechosLegitimos).toEqual(
          legitimas.map((caso) => `${caso.rotulo}: GRAVOU (1 linha(s))`),
        );

        // As TRÊS incoerentes. A terceira fecha a cláusula (a) da `CHECK`: habilitada sem
        // verificação publicaria `{ habilitada: true, verificadaEm: null }`, e `verificadaEm` nulo é
        // — pelo contrato — *"nunca houve tentativa"*, de modo que a linha se contradiria na própria
        // superfície.
        const incoerentes = [
          {
            rotulo: 'habilitada COM motivo',
            linha: { habilitada: true, verificada: true, comMotivo: true },
          },
          {
            rotulo: 'desabilitada, verificada e SEM motivo',
            linha: { habilitada: false, verificada: true, comMotivo: false },
          },
          {
            rotulo: 'habilitada SEM verificação',
            linha: { habilitada: true, verificada: false, comMotivo: false },
          },
        ] as const;

        const desfechosIncoerentes: string[] = [];
        for (const caso of incoerentes) {
          const tentativa = await tentar(async () =>
            emUnidade(EMPRESA_A.id, async (tx) => {
              await tx`DELETE FROM negocio.entrega_da_noticia`;
              return gravarLinha(tx, {
                id: LINHA_DE_A,
                empresaId: EMPRESA_A.id,
                verificadaPor: caso.linha.verificada ? USUARIO_DE_A.id : null,
                ...caso.linha,
              });
            }),
          );
          desfechosIncoerentes.push(`${caso.rotulo}: ${desfechoDaGravacao(tentativa)}`);
        }
        // O código E o nome da restrição: um `23514` de outra `CHECK` não satisfaz esta asserção.
        expect(desfechosIncoerentes).toEqual(
          incoerentes.map((caso) => `${caso.rotulo}: 23514 · entrega_da_noticia_coerencia_chk`),
        );

        // --- 6. O instante é do BANCO (ADR-0026) ------------------------------------------
        //
        // A janela vem do PRÓPRIO banco, das duas pontas. O teste não planta o instante que depois
        // asserta, e não há `new Date()` no caminho — nem aqui nem no módulo, cuja assinatura não
        // tem campo de instante (é a mesma ausência que o passo 9 exercita).
        await emUnidade(EMPRESA_A.id, async (tx) => {
          await tx`DELETE FROM negocio.entrega_da_noticia`;
        });
        const [antes] = await sql<{ agora: Date }[]>`SELECT pg_catalog.now() AS agora`;
        const gravado = await emUnidade(
          EMPRESA_A.id,
          async (tx) => await gravarDesfechoDaEntrega(tx, DESFECHO_RECUSADO),
        );
        const [depois] = await sql<{ agora: Date }[]>`SELECT pg_catalog.now() AS agora`;

        expect(antes?.agora).toBeInstanceOf(Date);
        expect(depois?.agora).toBeInstanceOf(Date);
        expect(gravado.verificadaEm).toBeInstanceOf(Date);
        expect(gravado.verificadaEm?.getTime()).toBeGreaterThanOrEqual(
          antes?.agora.getTime() ?? Number.POSITIVE_INFINITY,
        );
        expect(gravado.verificadaEm?.getTime()).toBeLessThanOrEqual(
          depois?.agora.getTime() ?? Number.NEGATIVE_INFINITY,
        );
        // Igualdade de CONJUNTO de chaves mais o valor de cada uma: um campo novo na projeção reprova
        // aqui, em vez de depender de alguém reparar nele. O instante fica de fora dos valores
        // porque a janela acima é quem o fixa — afirmá-lo por igualdade exigiria plantá-lo.
        // ⚠️ A `0025` publica dois campos novos no estado gravado, e a lista cresce **no mesmo diff**
        // que os publica. A asserção continua sendo igualdade de conjunto, nunca contenção: um campo
        // que sumisse — ou que nascesse sem decisão — segue reprovando aqui.
        expect(Object.keys(gravado).sort()).toEqual([
          'habilitada',
          'id',
          'motivo',
          'referenciaNoProvedor',
          'situacao',
          'verificadaEm',
          'verificadaPor',
        ]);
        expect(gravado.habilitada).toBe(false);
        expect(gravado.motivo).toEqual({
          codigo: CODIGO_DA_RECUSA,
          mensagem: MENSAGEM_DA_RECUSA,
          diagnostico: DIAGNOSTICO_DA_RECUSA,
        });
        expect(gravado.verificadaPor).toBe(USUARIO_DE_A.id);

        // --- 7. Comportamento cruzado — LEITURA -------------------------------------------
        //
        // O companheiro POSITIVO vem primeiro: sem ele, o vazio sob B não provaria isolamento —
        // provaria banco sem dado.
        // A linha de B, gravada no passo 4, é apagada aqui — e **sob o contexto de B**, porque a
        // política recorta o `DELETE` também. Sem isso o passo mediria a presença da linha legítima
        // de B em vez do vazamento da linha de A, que é o que ele existe para discriminar.
        await emUnidade(EMPRESA_B.id, async (tx) => {
          await tx`DELETE FROM negocio.entrega_da_noticia`;
        });
        await emUnidade(EMPRESA_A.id, async (tx) => {
          await tx`DELETE FROM negocio.entrega_da_noticia`;
          await gravarLinha(tx, {
            id: LINHA_DE_A,
            empresaId: EMPRESA_A.id,
            habilitada: false,
            verificada: true,
            comMotivo: true,
            verificadaPor: USUARIO_DE_A.id,
          });
        });

        expect(await lerIdentificadores(CONTEXTO_DE_A)).toEqual([LINHA_DE_A]);
        expect(await lerIdentificadores(CONTEXTO_DE_B)).toEqual([]);

        // --- 8. Comportamento cruzado — GRAVAÇÃO ------------------------------------------
        //
        // A linha é bem formada em tudo menos no contexto de quem a escreve: `empresa_id` e
        // `verificada_por` existem e pertencem a A, de modo que a política de linha é o ÚNICO motivo
        // possível da recusa.
        const cruzadaSobB = await tentar(async () =>
          emUnidade(EMPRESA_B.id, async (tx) =>
            gravarLinha(tx, {
              id: LINHA_CRUZADA,
              empresaId: EMPRESA_A.id,
              habilitada: false,
              verificada: true,
              comMotivo: true,
              verificadaPor: USUARIO_DE_A.id,
            }),
          ),
        );
        expect(desfechoDaGravacao(cruzadaSobB)).toBe('42501 · row-level security policy');

        // …e a MESMA linha, sob A, GRAVA. Sem esta perna, um `INSERT` malformado produziria o mesmo
        // vermelho acima e o caso passaria a provar outra coisa. A linha de A é apagada antes porque
        // a unicidade por empresa — provada no passo 4 — recusaria a segunda, e a recusa seria
        // `23505` em vez do sucesso que discrimina.
        const cruzadaSobA = await tentar(async () =>
          emUnidade(EMPRESA_A.id, async (tx) => {
            await tx`DELETE FROM negocio.entrega_da_noticia`;
            return gravarLinha(tx, {
              id: LINHA_CRUZADA,
              empresaId: EMPRESA_A.id,
              habilitada: false,
              verificada: true,
              comMotivo: true,
              verificadaPor: USUARIO_DE_A.id,
            });
          }),
        );
        expect(desfechoDaGravacao(cruzadaSobA)).toBe('GRAVOU (1 linha(s))');

        // A escrita legítima em A **não vazou**: o vazio de B continua sendo propriedade da política,
        // e não consequência de a tabela estar vazia.
        expect(await lerIdentificadores(CONTEXTO_DE_B)).toEqual([]);

        // --- 9. As mesmas propriedades PELO MÓDULO, sem `empresaId` em assinatura ----------
        //
        // Exercitar pelas funções publicadas, e não só por SQL cru, é o que prova que o recorte
        // continua sendo do banco quando quem consulta é a camada de dados. As assinaturas recebem
        // `(tx)` e `(tx, dados)` — **nenhum identificador de empresa** —, e é por isso que uma
        // segunda regra de tenant não tem por onde entrar (ADR-0008). A ausência é afirmada pela
        // ARIDADE declarada, que o compilador já cobra, e pela chamada abaixo, que não a passa.
        expect(lerEstadoDaEntrega).toHaveLength(1);
        expect(gravarDesfechoDaEntrega).toHaveLength(2);

        // Sob A o módulo lê a linha; sob B, `undefined`. O positivo vem primeiro, pela mesma razão
        // do passo 7.
        const peloModuloEmA = await emUnidade(EMPRESA_A.id, lerEstadoDaEntrega);
        expect(peloModuloEmA?.id).toBe(LINHA_CRUZADA);
        expect(await emUnidade(EMPRESA_B.id, lerEstadoDaEntrega)).toBeUndefined();

        // A gravação pelo módulo, sob B, cria a linha DE B — e a de A permanece intacta. É a
        // substituição da RN-04 sendo recortada pela política: o `ON CONFLICT` de B não alcança a
        // linha de A, e sem isso a ativação de uma imobiliária apagaria a da outra.
        const gravadoEmB = await emUnidade(
          EMPRESA_B.id,
          async (tx) => await gravarDesfechoDaEntrega(tx, DESFECHO_HABILITADO),
        );
        expect(gravadoEmB.habilitada).toBe(true);
        expect(gravadoEmB.motivo).toBeNull();

        const aDepois = await emUnidade(EMPRESA_A.id, lerEstadoDaEntrega);
        expect(aDepois?.id).toBe(LINHA_CRUZADA);
        expect(aDepois?.habilitada).toBe(false);
        expect(aDepois?.motivo?.codigo).toBe(CODIGO_DA_RECUSA);

        // E a substituição da RN-04 dentro da MESMA empresa: uma linha só, com o desfecho novo.
        const substituido = await emUnidade(
          EMPRESA_A.id,
          async (tx) => await gravarDesfechoDaEntrega(tx, DESFECHO_HABILITADO),
        );
        expect(substituido.id).toBe(LINHA_CRUZADA);
        expect(substituido.habilitada).toBe(true);
        expect(substituido.motivo).toBeNull();
        expect(await lerIdentificadores(CONTEXTO_DE_A)).toEqual([LINHA_CRUZADA]);
      } finally {
        await sql.end();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1049 — o teto anti-abuso do diagnóstico, no ponto que GRAVA (T5 · correção)
// ===========================================================================

/**
 * O teto do `diagnostico` **vigorando** — e não apenas declarado (CA-18 · RN-02 · ADR-0016).
 *
 * ===========================================================================
 * Por que este caso existe, e por que ele NÃO podia viver em `@sysloc/contracts`
 * ===========================================================================
 *
 * Os dois tetos nasceram como `.refine()` de `esquemaDoMotivoDaRecusa`, e a suíte de contratos os
 * provava chamando `safeParse` **direto**. Medido depois: esse é o único contexto do produto em que
 * aqueles refinos executam — esquema de **saída nunca é `parse`ado em execução** nesta base (o único
 * `parse` da borda é o de entrada, em `apps/api/src/comum/validacao.ts`), e `.refine()` **não
 * sobrevive** ao `z.toJSONSchema` que publica o documento. O teto estava provado e inoperante.
 *
 * Este caso mede a outra ponta, e é a ponta que importa: ele **grava pelo módulo** e **relê do
 * banco**, de modo que o que ele afirma é o que a coluna `motivo_diagnostico` de fato recebeu. Um
 * teto que voltasse a existir só no texto reprova aqui, porque nada no caminho o aplicaria.
 *
 * ⚠️ **Comportamental — e portanto SEM mutante** (`.claude/rules/testing-stack.md`; P4 do Protocolo
 * Antirregressão). A asserção que discrimina o defeito da rodada 1 é o passo 2:
 * `expect(chavesDe(gravado)).toEqual(...)` sobre um diagnóstico de `MAIOR_DIAGNOSTICO_EM_CHAVES + 1`
 * chaves — com o código antigo, `gravarDesfechoDaEntrega` serializava o registro inteiro e a releitura
 * devolveria as 33 chaves, reprovando a igualdade. E a que discrimina o defeito da **rodada 2** — a
 * escrita por atribuição indexada, cuja semântica `Set` invoca o acessor herdado de `__proto__` e
 * diverge da medição por spread — é o passo 6:
 * `expect(chavesDe(gravado)).toEqual(['__proto__', 'a', 'b'])`, que com aquele código leria
 * `['a', 'b']`, porque a chave que cabia nos dois eixos era descartada em silêncio. Nenhum passo
 * aqui inspeciona o *texto* do fonte.
 *
 * ⚠️ **A ordem das chaves NÃO é asserida, e a razão é do banco**: `jsonb` normaliza a ordem das
 * chaves ao gravar (por tamanho, depois lexicograficamente), de modo que a ordem lida não é a de
 * inserção. O que discrimina o truncamento *na ordem em que o provedor mandou* é **quais** chaves
 * sobreviveram — `campo0..campo31` é um conjunto distinto de qualquer outro recorte de 32.
 *
 * ⚠️ **Todo teto vem IMPORTADO de `@sysloc/contracts`**, jamais redigitado: o número mora num lugar
 * só, e é essa mesma constante que a camada de escrita consome — redigitá-la aqui faria o caso
 * aprovar um clamp que divergisse do contrato publicado.
 */
describe('teto anti-abuso do diagnóstico gravado (T5)', () => {
  /** Um registro com exatamente `chaves` entradas, nomeadas e valoradas de forma determinística. */
  function diagnosticoComChaves(chaves: number): Record<string, unknown> {
    return Object.fromEntries(
      Array.from({ length: chaves }, (_, indice) => [`campo${indice}`, indice]),
    );
  }

  /** Os nomes das chaves gravadas, ORDENADOS — ver a nota sobre a normalização do `jsonb`. */
  function chavesDe(diagnostico: Record<string, unknown> | null | undefined): readonly string[] {
    return Object.keys(diagnostico ?? {}).sort();
  }

  /**
   * O registro **como o provedor o entrega**: de `JSON.parse`, jamais de literal.
   *
   * A distinção é o eixo do passo 7 e não é cosmética. `JSON.parse('{"__proto__":…}')` cria
   * `__proto__` como propriedade **própria**, ao passo que o literal `{ __proto__: … }` troca o
   * protótipo do objeto e **não cria chave alguma** — de modo que um caso escrito com literal não
   * exercitaria a chave que se quer provar, e passaria com qualquer implementação.
   */
  function comoOProvedorEntrega(json: string): Record<string, unknown> {
    return JSON.parse(json) as Record<string, unknown>;
  }

  /** O desfecho recusado que leva o diagnóstico dado — os outros dois campos, verbatim. */
  function recusaCom(diagnostico: Record<string, unknown> | null): DadosDoDesfechoDaEntrega {
    return {
      situacao: 'DESABILITADA',
      referenciaNoProvedor: null,
      motivo: { codigo: CODIGO_DA_RECUSA, mensagem: MENSAGEM_DA_RECUSA, diagnostico },
      verificadaPor: USUARIO_DE_A.id,
    };
  }

  /** Grava sob a empresa A e **relê numa segunda unidade** — é a coluna que responde, não o retorno. */
  async function gravarERelerSobA(dados: DadosDoDesfechoDaEntrega) {
    await emUnidade(EMPRESA_A.id, async (tx) => await gravarDesfechoDaEntrega(tx, dados));
    return await emUnidade(EMPRESA_A.id, lerEstadoDaEntrega);
  }

  it(
    'CT-1049 — o diagnóstico que excede qualquer dos dois tetos é TRUNCADO ao ser gravado, e o que cabe chega íntegro',
    async () => {
      // --- 1. Controle antivácuo: NO limite, o registro chega ÍNTEGRO ---------------------
      //
      // Ele vem primeiro e é indispensável: sem esta perna, um clamp que apagasse tudo — ou um teto
      // de zero — satisfaria todos os passos seguintes, e o caso estaria medindo destruição em vez
      // de contenção.
      const noLimite = diagnosticoComChaves(MAIOR_DIAGNOSTICO_EM_CHAVES);
      const gravadoNoLimite = await gravarERelerSobA(recusaCom(noLimite));

      expect(gravadoNoLimite?.motivo?.diagnostico).toEqual(noLimite);

      // --- 2. Uma chave a mais: sobrevivem exatamente as do teto, e são as PRIMEIRAS -------
      //
      // É a asserção que discrimina o defeito: com o código anterior a esta correção, a serialização
      // levava o registro inteiro à coluna e a releitura devolveria as 33 chaves.
      const acimaDoTeto = diagnosticoComChaves(MAIOR_DIAGNOSTICO_EM_CHAVES + 1);
      const gravadoAcima = await gravarERelerSobA(recusaCom(acimaDoTeto));

      expect(chavesDe(gravadoAcima?.motivo?.diagnostico)).toEqual(
        chavesDe(diagnosticoComChaves(MAIOR_DIAGNOSTICO_EM_CHAVES)),
      );
      // E os VALORES atravessam verbatim — truncar descarta chave inteira, nunca reescreve valor.
      // Sem esta linha, um clamp que gravasse as 32 chaves com valores zerados passaria acima.
      expect(gravadoAcima?.motivo?.diagnostico).toEqual(
        diagnosticoComChaves(MAIOR_DIAGNOSTICO_EM_CHAVES),
      );
      // Os outros dois campos do motivo NÃO são tocados pelo teto — o que se perde é o excedente do
      // diagnóstico, jamais a recusa. É a assimetria que escolheu truncar em vez de recusar.
      expect(gravadoAcima?.motivo?.codigo).toBe(CODIGO_DA_RECUSA);
      expect(gravadoAcima?.motivo?.mensagem).toBe(MENSAGEM_DA_RECUSA);

      // --- 3. O SEGUNDO eixo: poucas chaves, uma delas imensa ------------------------------
      //
      // O eixo de chaves não alcança este caso — são duas chaves, bem abaixo do teto —, e sem o eixo
      // de tamanho o registro inteiro iria para a coluna. A que cabe sobrevive; a que estoura sai.
      const comChaveImensa = {
        pequena: 'ok',
        imensa: 'x'.repeat(MAIOR_DIAGNOSTICO_EM_CARACTERES),
      };
      const gravadoPorTamanho = await gravarERelerSobA(recusaCom(comChaveImensa));

      expect(gravadoPorTamanho?.motivo?.diagnostico).toEqual({ pequena: 'ok' });

      // --- 4. O extremo: a chave que estoura SOZINHA deixa registro vazio, e não nulo ------
      //
      // `{}` e `null` são coisas distintas, e a distinção é conteúdo: `null` é *"o provedor não mandou
      // campo variável nenhum"*. O truncamento nunca inventa o nulo — ele esvazia.
      const gravadoExtremo = await gravarERelerSobA(
        recusaCom({ imensa: 'x'.repeat(MAIOR_DIAGNOSTICO_EM_CARACTERES) }),
      );

      expect(gravadoExtremo?.motivo?.diagnostico).toEqual({});
      expect(gravadoExtremo?.motivo?.diagnostico).not.toBeNull();

      // --- 5. O nulo atravessa como nulo, e nunca vira `{}` -------------------------------
      //
      // A outra metade do passo 4, e ela é o que impede um `?? {}` de entrar no caminho da escrita:
      // converter a ausência em registro vazio faria o dado mentir sobre a própria origem.
      const gravadoNulo = await gravarERelerSobA(recusaCom(null));

      expect(gravadoNulo?.motivo?.diagnostico).toBeNull();

      // --- 6. A chave com armadilha de protótipo sobrevive VERBATIM -----------------------
      //
      // `__proto__` cabe nos DOIS eixos — está entre as primeiras e não estoura o teto de
      // caracteres —, logo ela tem de sobreviver: *"o que sobrevive sobrevive verbatim"* é a
      // promessa escrita no docblock de `limitarDiagnostico`, e uma implementação que compusesse o
      // registro por atribuição indexada a falsificaria em silêncio (a atribuição invoca o acessor
      // herdado de `Object.prototype`, descarta a chave e ainda troca o protótipo do acumulador).
      //
      // ⚠️ **`toEqual` sozinho NÃO discrimina**: ele compara propriedades próprias e ignora o
      // protótipo, de modo que um resultado sem a chave passaria contra um esperado escrito como
      // literal `{ __proto__: … }` — que também não tem a chave. Por isso o esperado nasce do
      // MESMO texto, por `JSON.parse`, e a igualdade das chaves **ordenadas** vai junto: é ela que
      // reprova o descarte silencioso.
      const COM_ARMADILHA_DE_PROTOTIPO = '{"a":1,"__proto__":{"x":1},"b":2}';
      const gravadoComArmadilha = await gravarERelerSobA(
        recusaCom(comoOProvedorEntrega(COM_ARMADILHA_DE_PROTOTIPO)),
      );

      expect(gravadoComArmadilha?.motivo?.diagnostico).toEqual(
        comoOProvedorEntrega(COM_ARMADILHA_DE_PROTOTIPO),
      );
      expect(chavesDe(gravadoComArmadilha?.motivo?.diagnostico)).toEqual(['__proto__', 'a', 'b']);

      // --- 7. A COSTURA com o contrato publicado, nas duas direções ------------------------
      //
      // O que a camada de dados deixa passar satisfaz o esquema publicado — é o que torna os dois
      // `.refine()` de `esquemaDoMotivoDaRecusa` uma afirmação verdadeira em vez de uma guarda que
      // não executa. O par é o que discrimina: o motivo ENVIADO reprova o mesmo esquema, pelo `path`
      // do campo. Sem a segunda metade, um esquema sem teto algum satisfaria a primeira.
      expect(esquemaDoMotivoDaRecusa.safeParse(gravadoAcima?.motivo).success).toBe(true);
      expect(
        esquemaDoMotivoDaRecusa.safeParse(recusaCom(acimaDoTeto).motivo).error?.issues[0]?.path,
      ).toEqual(['diagnostico']);
    },
    LIMITE_DO_CASO_MS,
  );
});
