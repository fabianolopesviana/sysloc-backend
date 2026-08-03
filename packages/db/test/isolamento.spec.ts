/**
 * Suíte de isolamento — a camada de aplicação contornada, o banco respondendo sozinho.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-01    | CT-003 | Dentro de uma unidade de trabalho com `app.empresa_id` fixado na empresa A,
 * |          |        | toda leitura em `negocio` devolve o conjunto exato de identificadores de A e
 * |          |        | nenhum de B — sem que nenhum repositório aplique filtro por empresa. |
 * | CA-02    | CT-004 | Com o contexto fixado em A, `INSERT` com `empresa_id` de B é recusado por
 * |          |        | `WITH CHECK`, e `UPDATE`/`DELETE` sobre linha de B afetam zero linhas — o
 * |          |        | estado de B, lido em seguida no contexto de B, é bit a bit o mesmo. |
 * | CA-05    | CT-005 | Sem empresa no contexto, `nullif(current_setting('app.empresa_id',true),'')`
 * | CA-02    |        | é nulo, nenhuma política casa: toda leitura de negócio devolve zero linhas
 * |          |        | sem erro e toda gravação é recusada — sem ramo de aplicação por perfil NO
 * |          |        | CAMINHO DO DADO (a autorização por perfil, que a ADR-0008 não proíbe, fica
 * |          |        | fora do alcance da varredura, e o controle negativo o demonstra). |
 * | CA-04    | CT-006 | `negocio.acesso_usuario_permissao` só aceita `acesso_id` cujo par
 * |          |        | `(acesso_id, empresa_id)` exista no pai; o vínculo cruzado é recusado pela
 * |          |        | chave estrangeira composta, nas DUAS direções. |
 * | CA-03    | CT-007 | Removido o isolamento de propósito, os predicados dos CT-003 a CT-006
 * |          |        | REPROVAM, e o conjunto de predicados reprovados é exato e nomeado por
 * |          |        | mutante; com o schema íntegro, todos passam. |
 *
 * ===========================================================================
 * Por que os predicados são funções, e não asserções soltas
 * ===========================================================================
 *
 * O CT-007 aplica mutantes ao schema e precisa afirmar **quais** predicados reprovaram. Uma bateria
 * que lançasse exceção só permitiria afirmar "reprovou" — e "reprovou" também fica verde quando a
 * conexão cai. Por isso cada conferência **coleta** as reprovações, no mesmo padrão já aprovado em
 * `papel-de-conexao.spec.ts`, e o CT-007 invoca **as mesmas funções** dos CT-003 a CT-006. Se as
 * reimplementasse, reproduziria o defeito da "reimplementação do leitor no próprio verificador"
 * registrado em `.claude/rules/testing-stack.md`.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * O dado vem de `semente.ts`, aplicado por `bancoEfemero()` — o mesmo caminho que a operação usa
 * enquanto não há rotas de administração. O contexto vem exclusivamente da API pública do pacote:
 * `contextoDeTenant.executarCom` (o mesmo escritor que a guarda de `apps/api` usará) e
 * `abrirAcessoAoBanco`. Nenhum `SET LOCAL` é composto à mão aqui, e nenhum símbolo foi acrescentado
 * a `packages/db/src/**` para que a prova exista.
 *
 * A cadeia privilegiada aparece **apenas** no CT-007, por `conexaoDeMigracao()`, e apenas para
 * aplicar e desfazer mutantes de schema numa instância efêmera DEDICADA — descartada ao fim, nunca
 * a que os demais casos compartilham.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  EMPRESA_A,
  EMPRESA_B,
  USUARIO_MASTER,
} from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';
import { type VarreduraDeFontes, varrerArquivos } from './varredura-de-fontes.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso lê e escreve poucas linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** O CT-007 sobe instância própria e roda a bateria seis vezes — controle, 4 mutantes e controle. */
const LIMITE_DA_FALSIFICACAO_MS = 300_000;

// ---------------------------------------------------------------------------
// As consultas de negócio — declaradas como valor para que a ausência de filtro
// por empresa seja CONFERIDA, e não apenas prometida (ADR-0008)
// ---------------------------------------------------------------------------

const CONSULTA_ACESSOS = 'SELECT id FROM negocio.acesso_usuario_app ORDER BY id';

const CONSULTA_LINHAS_DE_ACESSO =
  'SELECT id, usuario_id AS "usuarioId", criado_em AS "criadoEm" ' +
  'FROM negocio.acesso_usuario_app ORDER BY id';

const CONSULTA_PERMISSOES =
  'SELECT id, acesso_id AS "acessoId" FROM negocio.acesso_usuario_permissao ORDER BY id';

/** As três acima, e apenas elas, são as leituras de negócio dos casos. */
const CONSULTAS_DE_NEGOCIO = [
  CONSULTA_ACESSOS,
  CONSULTA_LINHAS_DE_ACESSO,
  CONSULTA_PERMISSOES,
] as const;

/**
 * Esta NÃO entra na conferência acima: ela nomeia a variável de sessão de propósito, porque é a
 * própria variável o objeto sob observação — não uma coluna de tabela usada como filtro.
 */
const CONSULTA_DO_CONTEXTO =
  "SELECT current_setting('app.empresa_id', true) AS bruto, " +
  "nullif(current_setting('app.empresa_id', true), '') AS resolvido";

// ---------------------------------------------------------------------------
// Identificadores descartáveis — linhas que os casos criam e removem
// ---------------------------------------------------------------------------

/** Linha da empresa B, criada pela própria B, sobre a qual A tenta `UPDATE` e `DELETE`. */
const ACESSO_DESCARTAVEL_EM_B = 'dddddddd-0000-4000-8000-000000000001';
/** Linha que A tenta gravar com `empresa_id` de B — a gravação cruzada do CT-004. */
const ACESSO_CRUZADO_EM_B = 'dddddddd-0000-4000-8000-000000000002';
/** Linhas que o contexto sem empresa tenta gravar, uma por cenário (CT-005). */
const ACESSO_SEM_CONTEXTO_1 = 'dddddddd-0000-4000-8000-000000000003';
const ACESSO_SEM_CONTEXTO_2 = 'dddddddd-0000-4000-8000-000000000004';

/** Permissão legítima do CT-006: empresa A apontando para vínculo de A. */
const PERMISSAO_LEGITIMA = 'dddddddd-1111-4000-8000-000000000001';
/** Permissão cruzada A → B e a simétrica B → A. */
const PERMISSAO_CRUZADA_A_PARA_B = 'dddddddd-1111-4000-8000-000000000002';
const PERMISSAO_CRUZADA_B_PARA_A = 'dddddddd-1111-4000-8000-000000000003';
/**
 * Permissão de apoio do CT-005: existe para que "a leitura sem contexto devolve vazio" seja uma
 * afirmação com conteúdo. Contra tabela vazia, vazio é verdade e não prova isolamento nenhum.
 */
const PERMISSAO_DE_APOIO = 'dddddddd-1111-4000-8000-000000000004';

const ACESSOS_DESCARTAVEIS = [
  ACESSO_DESCARTAVEL_EM_B,
  ACESSO_CRUZADO_EM_B,
  ACESSO_SEM_CONTEXTO_1,
  ACESSO_SEM_CONTEXTO_2,
] as const;

const PERMISSOES_DESCARTAVEIS = [
  PERMISSAO_LEGITIMA,
  PERMISSAO_CRUZADA_A_PARA_B,
  PERMISSAO_CRUZADA_B_PARA_A,
  PERMISSAO_DE_APOIO,
] as const;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;
const CONTEXTO_SEM_EMPRESA = { empresaId: null } as const;

const IDENTIFICADORES_DE_A = ACESSOS_DA_EMPRESA_A.map((acesso) => acesso.id);
const IDENTIFICADORES_DE_B = ACESSOS_DA_EMPRESA_B.map((acesso) => acesso.id);

const ACESSO_A_1 = IDENTIFICADORES_DE_A[0] ?? '';
const USUARIO_ADMIN_A = ACESSOS_DA_EMPRESA_A[0]?.usuarioId ?? '';
const USUARIO_ADMIN_B = ACESSOS_DA_EMPRESA_B[0]?.usuarioId ?? '';

// ---------------------------------------------------------------------------
// Utilidades de coleta
// ---------------------------------------------------------------------------

interface Conferencia<TObservado> {
  readonly observado: TObservado;
  /** Uma entrada por predicado violado, no formato `<predicado>: <detalhe>`. Vazia = tudo passou. */
  readonly reprovacoes: readonly string[];
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

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

function mensagemDo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/** O nome do predicado, sem o detalhe — é o que o CT-007 afirma por igualdade de conjunto. */
function nomesDe(reprovacoes: readonly string[]): string[] {
  return reprovacoes.map((linha) => linha.split(':')[0] ?? linha);
}

function ordenado(valores: readonly string[]): string[] {
  return [...valores].sort();
}

function mesmoConjunto(obtido: readonly string[], esperado: readonly string[]): boolean {
  return JSON.stringify(ordenado(obtido)) === JSON.stringify(ordenado(esperado));
}

function intersecao(a: readonly string[], b: readonly string[]): string[] {
  const outros = new Set(b);
  return ordenado(a.filter((valor) => outros.has(valor)));
}

function comoTexto(valores: readonly string[]): string {
  return JSON.stringify(ordenado(valores));
}

// ---------------------------------------------------------------------------
// Acesso ao dado — sempre pela API pública do pacote
// ---------------------------------------------------------------------------

/**
 * Reserva de UMA conexão em toda conferência.
 *
 * Não é economia: com uma conexão só, a sequência de unidades de trabalho de cada conferência corre
 * sobre a MESMA conexão física, e o estado de sessão que a unidade anterior deixou é sempre o mesmo
 * — o que torna determinístico o cenário em que uma unidade herda a conexão que outra acabou de
 * usar. O cenário complementar, o da conexão que nunca atendeu unidade alguma, é obtido abrindo uma
 * reserva nova (`acessoVirgem`, abaixo).
 */
const RESERVA_DE_UMA = 1;

function abrir(cadeiaDeConexao: string): AcessoAoBanco {
  return abrirAcessoAoBanco({ cadeiaDeConexao, maximoDeConexoes: RESERVA_DE_UMA });
}

type Contexto = contextoDeTenant.ContextoDeTenant;

/** Marca a ausência total de contexto — ninguém chamou o escritor. */
const SEM_CONTEXTO = Symbol('sem contexto');

function noContexto<T>(
  contexto: Contexto | typeof SEM_CONTEXTO,
  trabalho: () => Promise<T>,
): Promise<T> {
  return contexto === SEM_CONTEXTO ? trabalho() : contextoDeTenant.executarCom(contexto, trabalho);
}

async function lerAcessos(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<string[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<{ id: string }[]>(CONSULTA_ACESSOS);
      return linhas.map((linha) => linha.id);
    }),
  );
}

interface LinhaDeAcesso {
  readonly id: string;
  readonly usuarioId: string;
  readonly criadoEm: Date;
}

async function lerLinhasDeAcesso(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<LinhaDeAcesso[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<LinhaDeAcesso[]>(CONSULTA_LINHAS_DE_ACESSO);
      return linhas.map((linha) => ({ ...linha }));
    }),
  );
}

interface LinhaDePermissao {
  readonly id: string;
  readonly acessoId: string;
}

async function lerPermissoes(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<LinhaDePermissao[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<LinhaDePermissao[]>(CONSULTA_PERMISSOES);
      return linhas.map((linha) => ({ id: linha.id, acessoId: linha.acessoId }));
    }),
  );
}

/** Estado de um conjunto de linhas, comparável bit a bit. */
function serializar(linhas: readonly LinhaDeAcesso[]): string {
  return JSON.stringify(
    [...linhas]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((linha) => [linha.id, linha.usuarioId, new Date(linha.criadoEm).toISOString()]),
  );
}

/**
 * Remove toda linha descartável, pelo identificador — nunca por `empresa_id`, que é o filtro que a
 * ADR-0008 proíbe à aplicação. Rodada nos dois contextos porque, com o isolamento íntegro, cada
 * linha só é alcançável pelo contexto da sua própria empresa.
 */
async function limparDescartaveis(cadeiaDeConexao: string): Promise<void> {
  const acesso = abrir(cadeiaDeConexao);
  try {
    for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
      await contextoDeTenant.executarCom(contexto, async () => {
        await acesso.emUnidadeDeTrabalho(async (tx) => {
          for (const id of PERMISSOES_DESCARTAVEIS) {
            await tx`DELETE FROM negocio.acesso_usuario_permissao WHERE id = ${id}`;
          }
          for (const id of ACESSOS_DESCARTAVEIS) {
            await tx`DELETE FROM negocio.acesso_usuario_app WHERE id = ${id}`;
          }
        });
      });
    }
  } finally {
    await acesso.encerrar();
  }
}

// ===========================================================================
// CT-003 — leitura isolada
// ===========================================================================

interface LeituraIsolada {
  readonly emA: readonly string[];
  readonly emB: readonly string[];
}

async function conferirLeituraIsolada(
  cadeiaDeConexao: string,
): Promise<Conferencia<LeituraIsolada>> {
  const acesso = abrir(cadeiaDeConexao);
  const reprovacoes: string[] = [];

  try {
    const emA = await tentar(() => lerAcessos(acesso, CONTEXTO_DE_A));
    const emB = await tentar(() => lerAcessos(acesso, CONTEXTO_DE_B));

    const lidosEmA = emA.ok ? emA.valor : [];
    const lidosEmB = emB.ok ? emB.valor : [];

    if (!emA.ok) {
      reprovacoes.push(`leitura-em-A/conjunto: erro ${mensagemDo(emA.erro)}`);
    } else if (!mesmoConjunto(lidosEmA, IDENTIFICADORES_DE_A)) {
      reprovacoes.push(
        `leitura-em-A/conjunto: ${comoTexto(lidosEmA)} (esperado ${comoTexto(IDENTIFICADORES_DE_A)})`,
      );
    }

    const invasaoEmA = intersecao(lidosEmA, IDENTIFICADORES_DE_B);
    if (invasaoEmA.length > 0) {
      reprovacoes.push(`leitura-em-A/intersecao-com-B: ${comoTexto(invasaoEmA)}`);
    }

    if (!emB.ok) {
      reprovacoes.push(`leitura-em-B/conjunto: erro ${mensagemDo(emB.erro)}`);
    } else if (!mesmoConjunto(lidosEmB, IDENTIFICADORES_DE_B)) {
      reprovacoes.push(
        `leitura-em-B/conjunto: ${comoTexto(lidosEmB)} (esperado ${comoTexto(IDENTIFICADORES_DE_B)})`,
      );
    }

    const invasaoEmB = intersecao(lidosEmB, IDENTIFICADORES_DE_A);
    if (invasaoEmB.length > 0) {
      reprovacoes.push(`leitura-em-B/intersecao-com-A: ${comoTexto(invasaoEmB)}`);
    }

    return { observado: { emA: lidosEmA, emB: lidosEmB }, reprovacoes };
  } finally {
    await acesso.encerrar();
  }
}

// ===========================================================================
// CT-004 — gravação cruzada recusada, e nada gravado
// ===========================================================================

interface GravacaoCruzada {
  readonly sqlstateDaInsercao: string | undefined;
  readonly mensagemDaInsercao: string;
  readonly linhasNaAtualizacao: number | undefined;
  readonly linhasNaRemocao: number | undefined;
  readonly estadoAntes: string;
  readonly estadoDepois: string;
}

async function conferirGravacaoCruzadaRecusada(
  cadeiaDeConexao: string,
): Promise<Conferencia<GravacaoCruzada>> {
  await limparDescartaveis(cadeiaDeConexao);
  const acesso = abrir(cadeiaDeConexao);
  const reprovacoes: string[] = [];

  try {
    // A empresa B cria, no PRÓPRIO contexto, a linha sobre a qual A vai tentar escrever. Ela é
    // descartável de propósito: com o isolamento removido (CT-007), a tentativa de A a alcança de
    // verdade, e o estrago fica contido numa linha que o caso mesmo criou — a carga inicial, que os
    // demais predicados afirmam, sobrevive intacta e o mutante continua atribuível.
    const preparo = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_B, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          await tx`
            INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
            VALUES (${ACESSO_DESCARTAVEL_EM_B}, ${EMPRESA_B.id}, ${USUARIO_MASTER.id})
          `;
        }),
      ),
    );
    if (!preparo.ok) {
      reprovacoes.push(`preparo/linha-descartavel-em-B: ${mensagemDo(preparo.erro)}`);
    }

    const estadoAntes = serializar(await lerLinhasDeAcesso(acesso, CONTEXTO_DE_B));

    const insercao = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          await tx`
            INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
            VALUES (${ACESSO_CRUZADO_EM_B}, ${EMPRESA_B.id}, ${USUARIO_ADMIN_A})
          `;
        }),
      ),
    );

    const codigoDaInsercao = insercao.ok ? undefined : sqlstate(insercao.erro);
    const textoDaInsercao = insercao.ok ? '' : mensagemDo(insercao.erro);

    if (codigoDaInsercao !== '42501') {
      reprovacoes.push(
        `insercao-cruzada/sqlstate: ${codigoDaInsercao ?? 'nenhum erro'} (esperado 42501)`,
      );
    }
    if (!textoDaInsercao.includes('row-level security policy')) {
      reprovacoes.push(
        `insercao-cruzada/mensagem: ${textoDaInsercao || 'nenhum erro'} ` +
          "(esperado conter 'row-level security policy')",
      );
    }

    // `criado_em` não participa de restrição de unicidade nenhuma: a atualização mede visibilidade,
    // e não colide com outra regra que confundiria o diagnóstico.
    const atualizacao = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          const resultado = await tx`
            UPDATE negocio.acesso_usuario_app SET criado_em = now()
             WHERE id = ${ACESSO_DESCARTAVEL_EM_B}
          `;
          return resultado.count;
        }),
      ),
    );
    if (!atualizacao.ok) {
      reprovacoes.push(`atualizacao-cruzada/erro: ${mensagemDo(atualizacao.erro)}`);
    } else if (atualizacao.valor !== 0) {
      reprovacoes.push(`atualizacao-cruzada/linhas-afetadas: ${atualizacao.valor} (esperado 0)`);
    }

    const remocao = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          const resultado = await tx`
            DELETE FROM negocio.acesso_usuario_app WHERE id = ${ACESSO_DESCARTAVEL_EM_B}
          `;
          return resultado.count;
        }),
      ),
    );
    if (!remocao.ok) {
      reprovacoes.push(`remocao-cruzada/erro: ${mensagemDo(remocao.erro)}`);
    } else if (remocao.valor !== 0) {
      reprovacoes.push(`remocao-cruzada/linhas-afetadas: ${remocao.valor} (esperado 0)`);
    }

    // A conferência acontece numa unidade de trabalho SEPARADA, no contexto de B — nunca por
    // conexão privilegiada: a auditoria não pode ser mais poderosa que o ato que ela audita.
    const estadoDepois = serializar(await lerLinhasDeAcesso(acesso, CONTEXTO_DE_B));
    if (estadoDepois !== estadoAntes) {
      reprovacoes.push(`estado-de-B/inalterado: antes ${estadoAntes} depois ${estadoDepois}`);
    }

    return {
      observado: {
        sqlstateDaInsercao: codigoDaInsercao,
        mensagemDaInsercao: textoDaInsercao,
        linhasNaAtualizacao: atualizacao.ok ? atualizacao.valor : undefined,
        linhasNaRemocao: remocao.ok ? remocao.valor : undefined,
        estadoAntes,
        estadoDepois,
      },
      reprovacoes,
    };
  } finally {
    await acesso.encerrar();
    await limparDescartaveis(cadeiaDeConexao);
  }
}

// ===========================================================================
// CT-005 — contexto sem empresa: leitura vazia, gravação recusada
// ===========================================================================

interface LeituraSemEmpresa {
  readonly acessos: readonly string[];
  readonly permissoes: readonly string[];
  readonly bruto: string | null;
  readonly resolvido: string | null;
  readonly sqlstateDaInsercao: string | undefined;
}

interface ContextoSemEmpresa {
  readonly semContexto: LeituraSemEmpresa;
  readonly contextoNulo: LeituraSemEmpresa;
  readonly contagemEmA: number;
}

const CENARIO_VAZIO: LeituraSemEmpresa = {
  acessos: [],
  permissoes: [],
  bruto: null,
  resolvido: null,
  sqlstateDaInsercao: undefined,
};

async function conferirContextoSemEmpresa(
  cadeiaDeConexao: string,
): Promise<Conferencia<ContextoSemEmpresa>> {
  await limparDescartaveis(cadeiaDeConexao);
  const reprovacoes: string[] = [];

  // Duas reservas, e a ordem importa: a segunda é aberta DEPOIS do preparo justamente para que a
  // conexão dela nunca tenha atendido outra unidade. É assim que o cenário "ninguém chamou o
  // escritor de contexto" é obtido pelo caminho normal — e não desligando a fixação por bandeira.
  // Desde o P1 do Gate 2 a unidade fixa a variável mesmo aí, e o cenário deixou de depender da
  // conexão virgem para ser fail-closed; a reserva separada permanece porque é ela que mantém os
  // dois cenários independentes um do outro.
  const acesso = abrir(cadeiaDeConexao);
  let acessoVirgem: AcessoAoBanco | undefined;

  try {
    const preparo = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          await tx`
            INSERT INTO negocio.acesso_usuario_permissao (id, empresa_id, acesso_id, tipo, chave)
            VALUES (${PERMISSAO_DE_APOIO}, ${EMPRESA_A.id}, ${ACESSO_A_1},
                    ${'TELA'}::negocio.tipo_permissao, ${'contratos'})
          `;
        }),
      ),
    );
    if (!preparo.ok) {
      reprovacoes.push(`preparo/permissao-de-apoio: ${mensagemDo(preparo.erro)}`);
    }

    acessoVirgem = abrir(cadeiaDeConexao);

    const semContexto = await observarSemEmpresa(
      acessoVirgem,
      SEM_CONTEXTO,
      ACESSO_SEM_CONTEXTO_1,
      USUARIO_MASTER.id,
      'sem-contexto',
      reprovacoes,
    );

    const contextoNulo = await observarSemEmpresa(
      acesso,
      CONTEXTO_SEM_EMPRESA,
      ACESSO_SEM_CONTEXTO_2,
      USUARIO_ADMIN_B,
      'contexto-nulo',
      reprovacoes,
    );

    // O companheiro positivo, na mesma semente e nas mesmas tabelas: se A também viesse vazia, o
    // vazio dos dois cenários acima não provaria isolamento — provaria banco sem dado.
    const contagem = await tentar(() => lerAcessos(acesso, CONTEXTO_DE_A));
    const contagemEmA = contagem.ok ? contagem.valor.length : -1;
    if (!contagem.ok) {
      reprovacoes.push(`contagem-em-A: erro ${mensagemDo(contagem.erro)}`);
    } else if (contagemEmA !== IDENTIFICADORES_DE_A.length) {
      reprovacoes.push(`contagem-em-A: ${contagemEmA} (esperado ${IDENTIFICADORES_DE_A.length})`);
    }

    return { observado: { semContexto, contextoNulo, contagemEmA }, reprovacoes };
  } finally {
    await acessoVirgem?.encerrar();
    await acesso.encerrar();
    await limparDescartaveis(cadeiaDeConexao);
  }
}

/**
 * Um cenário de ausência de empresa. Cada leitura corre na PRÓPRIA unidade de trabalho: erro numa
 * delas abortaria a transação e faria a seguinte reprovar por transação abortada, escondendo o que
 * de fato aconteceu.
 */
async function observarSemEmpresa(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
  idDaInsercao: string,
  usuarioDaInsercao: string,
  rotulo: string,
  reprovacoes: string[],
): Promise<LeituraSemEmpresa> {
  const acessos = await tentar(() => lerAcessos(acesso, contexto));
  if (!acessos.ok) {
    reprovacoes.push(`${rotulo}/leitura-acesso: erro ${mensagemDo(acessos.erro)}`);
  } else if (acessos.valor.length > 0) {
    reprovacoes.push(`${rotulo}/leitura-acesso: ${comoTexto(acessos.valor)} (esperado [])`);
  }

  const permissoes = await tentar(() => lerPermissoes(acesso, contexto));
  if (!permissoes.ok) {
    reprovacoes.push(`${rotulo}/leitura-permissao: erro ${mensagemDo(permissoes.erro)}`);
  } else if (permissoes.valor.length > 0) {
    reprovacoes.push(
      `${rotulo}/leitura-permissao: ${comoTexto(permissoes.valor.map((linha) => linha.id))} ` +
        '(esperado [])',
    );
  }

  const variavel = await tentar(() =>
    noContexto(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        const [linha] =
          await tx.unsafe<{ bruto: string | null; resolvido: string | null }[]>(
            CONSULTA_DO_CONTEXTO,
          );
        return { bruto: linha?.bruto ?? null, resolvido: linha?.resolvido ?? null };
      }),
    ),
  );
  const bruto = variavel.ok ? variavel.valor.bruto : null;
  const resolvido = variavel.ok ? variavel.valor.resolvido : null;
  if (!variavel.ok) {
    reprovacoes.push(`${rotulo}/variavel-resolvida: erro ${mensagemDo(variavel.erro)}`);
  } else if (resolvido !== null) {
    reprovacoes.push(`${rotulo}/variavel-resolvida: ${JSON.stringify(resolvido)} (esperado nulo)`);
  }

  const insercao = await tentar(() =>
    noContexto(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        await tx`
          INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
          VALUES (${idDaInsercao}, ${EMPRESA_A.id}, ${usuarioDaInsercao})
        `;
      }),
    ),
  );
  const codigo = insercao.ok ? undefined : sqlstate(insercao.erro);
  if (codigo !== '42501') {
    reprovacoes.push(`${rotulo}/insercao-recusada: ${codigo ?? 'nenhum erro'} (esperado 42501)`);
  }

  return {
    acessos: acessos.ok ? acessos.valor : CENARIO_VAZIO.acessos,
    permissoes: permissoes.ok
      ? permissoes.valor.map((linha) => linha.id)
      : CENARIO_VAZIO.permissoes,
    bruto,
    resolvido,
    sqlstateDaInsercao: codigo,
  };
}

// ===========================================================================
// CT-006 — chave estrangeira composta, nas duas direções
// ===========================================================================

interface ChaveComposta {
  readonly linhasNaLegitima: number | undefined;
  readonly sqlstateDeAparaB: string | undefined;
  readonly mensagemDeAparaB: string;
  readonly sqlstateDeBparaA: string | undefined;
  readonly permissoesEmA: readonly LinhaDePermissao[];
  readonly permissoesEmB: readonly LinhaDePermissao[];
  readonly acessoDeBLidoEmB: string | undefined;
}

async function conferirChaveEstrangeiraComposta(
  cadeiaDeConexao: string,
): Promise<Conferencia<ChaveComposta>> {
  await limparDescartaveis(cadeiaDeConexao);
  const acesso = abrir(cadeiaDeConexao);
  const reprovacoes: string[] = [];

  try {
    // O identificador alheio é obtido LENDO no contexto de B — não por consulta privilegiada. Assim
    // o caso prova também o outro lado da moeda: conhecer o identificador de outra empresa não
    // basta para usá-lo.
    const lidosEmB = await tentar(() => lerAcessos(acesso, CONTEXTO_DE_B));
    const acessoDeB = lidosEmB.ok
      ? lidosEmB.valor.find((id) => IDENTIFICADORES_DE_B.includes(id))
      : undefined;
    if (acessoDeB === undefined) {
      reprovacoes.push(
        'preparo/acesso-de-B: não foi possível ler um vínculo de B no contexto de B',
      );
    }

    const legitima = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          const resultado = await tx`
            INSERT INTO negocio.acesso_usuario_permissao (id, empresa_id, acesso_id, tipo, chave)
            VALUES (${PERMISSAO_LEGITIMA}, ${EMPRESA_A.id}, ${ACESSO_A_1},
                    ${'TELA'}::negocio.tipo_permissao, ${'contratos'})
          `;
          return resultado.count;
        }),
      ),
    );
    if (!legitima.ok) {
      reprovacoes.push(`permissao-legitima/linhas-gravadas: erro ${mensagemDo(legitima.erro)}`);
    } else if (legitima.valor !== 1) {
      reprovacoes.push(`permissao-legitima/linhas-gravadas: ${legitima.valor} (esperado 1)`);
    }

    const cruzadaAparaB = await gravarPermissaoCruzada(
      acesso,
      CONTEXTO_DE_A,
      PERMISSAO_CRUZADA_A_PARA_B,
      EMPRESA_A.id,
      acessoDeB ?? ACESSO_A_1,
    );
    avaliarCruzada('permissao-cruzada-A-para-B', cruzadaAparaB, reprovacoes);

    const cruzadaBparaA = await gravarPermissaoCruzada(
      acesso,
      CONTEXTO_DE_B,
      PERMISSAO_CRUZADA_B_PARA_A,
      EMPRESA_B.id,
      ACESSO_A_1,
    );
    avaliarCruzada('permissao-cruzada-B-para-A', cruzadaBparaA, reprovacoes);

    const permissoesEmA = await lerPermissoes(acesso, CONTEXTO_DE_A);
    const esperadoEmA = JSON.stringify([{ id: PERMISSAO_LEGITIMA, acessoId: ACESSO_A_1 }]);
    if (JSON.stringify(permissoesEmA) !== esperadoEmA) {
      reprovacoes.push(
        `permissoes-em-A/conjunto: ${JSON.stringify(permissoesEmA)} (esperado ${esperadoEmA})`,
      );
    }

    const permissoesEmB = await lerPermissoes(acesso, CONTEXTO_DE_B);
    if (permissoesEmB.length > 0) {
      reprovacoes.push(`permissoes-em-B/vazio: ${JSON.stringify(permissoesEmB)} (esperado [])`);
    }

    return {
      observado: {
        linhasNaLegitima: legitima.ok ? legitima.valor : undefined,
        sqlstateDeAparaB: cruzadaAparaB.codigo,
        mensagemDeAparaB: cruzadaAparaB.mensagem,
        sqlstateDeBparaA: cruzadaBparaA.codigo,
        permissoesEmA,
        permissoesEmB,
        acessoDeBLidoEmB: acessoDeB,
      },
      reprovacoes,
    };
  } finally {
    await acesso.encerrar();
    await limparDescartaveis(cadeiaDeConexao);
  }
}

interface TentativaCruzada {
  readonly codigo: string | undefined;
  readonly mensagem: string;
}

async function gravarPermissaoCruzada(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  id: string,
  empresaId: string,
  acessoId: string,
): Promise<TentativaCruzada> {
  const tentativa = await tentar(() =>
    contextoDeTenant.executarCom(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        await tx`
          INSERT INTO negocio.acesso_usuario_permissao (id, empresa_id, acesso_id, tipo, chave)
          VALUES (${id}, ${empresaId}, ${acessoId}, ${'TELA'}::negocio.tipo_permissao, ${'contratos'})
        `;
      }),
    ),
  );

  return tentativa.ok
    ? { codigo: undefined, mensagem: '' }
    : { codigo: sqlstate(tentativa.erro), mensagem: mensagemDo(tentativa.erro) };
}

const RESTRICAO_COMPOSTA = 'acesso_usuario_permissao_acesso_empresa_fkey';

function avaliarCruzada(rotulo: string, tentativa: TentativaCruzada, reprovacoes: string[]): void {
  if (tentativa.codigo !== '23503') {
    reprovacoes.push(`${rotulo}/sqlstate: ${tentativa.codigo ?? 'nenhum erro'} (esperado 23503)`);
  }
  if (!tentativa.mensagem.includes(RESTRICAO_COMPOSTA)) {
    reprovacoes.push(
      `${rotulo}/restricao: ${tentativa.mensagem || 'nenhum erro'} ` +
        `(esperado conter '${RESTRICAO_COMPOSTA}')`,
    );
  }
}

// ===========================================================================
// A bateria — a MESMA função de conferência para o caso e para o mutante
// ===========================================================================

interface Bateria {
  readonly leitura: Conferencia<LeituraIsolada>;
  readonly gravacao: Conferencia<GravacaoCruzada>;
  readonly semEmpresa: Conferencia<ContextoSemEmpresa>;
  readonly chaveComposta: Conferencia<ChaveComposta>;
}

async function rodarBateria(cadeiaDeConexao: string): Promise<Bateria> {
  await limparDescartaveis(cadeiaDeConexao);
  return {
    leitura: await conferirLeituraIsolada(cadeiaDeConexao),
    gravacao: await conferirGravacaoCruzadaRecusada(cadeiaDeConexao),
    semEmpresa: await conferirContextoSemEmpresa(cadeiaDeConexao),
    chaveComposta: await conferirChaveEstrangeiraComposta(cadeiaDeConexao),
  };
}

interface PredicadosReprovados {
  readonly leitura: string[];
  readonly gravacao: string[];
  readonly semEmpresa: string[];
  readonly chaveComposta: string[];
}

function predicadosReprovados(bateria: Bateria): PredicadosReprovados {
  return {
    leitura: nomesDe(bateria.leitura.reprovacoes),
    gravacao: nomesDe(bateria.gravacao.reprovacoes),
    semEmpresa: nomesDe(bateria.semEmpresa.reprovacoes),
    chaveComposta: nomesDe(bateria.chaveComposta.reprovacoes),
  };
}

const BATERIA_VERDE: PredicadosReprovados = {
  leitura: [],
  gravacao: [],
  semEmpresa: [],
  chaveComposta: [],
};

// ===========================================================================
// Asserção estática: nenhum ramo por perfil Master no CAMINHO DO DADO
// ===========================================================================

/**
 * O caminho do dado — arquivo a arquivo, e não "os diretórios de fonte".
 *
 * O que a ADR-0008 proíbe é a decisão sobre **empresa** voltar para a aplicação no caminho que
 * alcança o dado: ramo por perfil que componha ou emita consulta. Ela **não** proíbe ramificar por
 * perfil na **autorização** — e a T6/T9 precisa escrever exatamente
 * `perfil === 'SYSLOC_MASTER' ? null : acesso.empresaId` para derivar o contexto que este próprio
 * pacote exige (nulo é o valor de domínio do Master, `contexto.ts`). Um alcance de dois diretórios
 * inteiros reprovaria essa linha legítima, e detector que reprova o correto ensina a ignorá-lo.
 *
 * Por isso o alcance é uma **lista declarada** dos arquivos que compõem ou emitem consulta. A lista
 * é o alcance e também a prova de cobertura: arquivo renomeado faz `readFile` levantar, em vez de
 * reduzir a varredura a zero em silêncio. Módulo novo que passe a emitir consulta entra aqui.
 *
 * Fora dela ficam, deliberadamente: `esquema/*.ts` (declaração de estrutura — o `CHECK` de
 * `identidade.ts` nomeia o perfil dentro do BANCO, que é onde a ADR-0008 quer a decisão) e
 * `index.ts` (reexportação).
 */
const CAMINHO_DO_DADO = [
  'db/src/unidade-de-trabalho.ts',
  'db/src/contexto.ts',
  'db/src/conexao.ts',
  'db/src/semente.ts',
] as const;

/** `packages/` — a raiz a partir da qual `CAMINHO_DO_DADO` é resolvido. */
const RAIZ_DOS_PACOTES = fileURLToPath(new URL('../../', import.meta.url));

function arquivosDoCaminhoDoDado(raizDePacotes: string): string[] {
  return CAMINHO_DO_DADO.map((relativo) => join(raizDePacotes, relativo));
}

/**
 * Sem `\b` antes de `MASTER`, e a ausência foi ganha na prova de falsificação: `\bMASTER` NÃO casa
 * em `SYSLOC_MASTER`, porque o sublinhado é caractere de palavra e não abre fronteira. Com a
 * âncora, o detector ficava verde diante do ramo por perfil reintroduzido — o defeito exato que
 * `.claude/rules/testing-stack.md` descreve como "asserção que não podia falhar pelo defeito que
 * perseguia".
 */
const MENCAO_A_MASTER = /MASTER/;

/** Ramificação de fluxo escrita por palavra-chave. */
const PALAVRA_DE_RAMO = /\b(?:if|else|switch|case)\b/;

/** Comparação por identidade — o que distingue "decidir por perfil" de "nomear o perfil". */
const COMPARACAO_DE_IDENTIDADE = /[=!]==/;

/**
 * Ramificação escrita por operador: ternário, `&&`, `||`.
 *
 * O `?` é reconhecido só quando é **ternário**. A negativa dupla exclui os três vizinhos que a
 * versão anterior confundia com ramo e que fizeram o detector reprovar código correto:
 * encadeamento opcional (`?.`), coalescência nula (`??`) e propriedade opcional do TypeScript
 * (`?:`) — nenhum dos três é bifurcação de fluxo.
 */
const OPERADOR_DE_RAMO = /(?<!\?)\?(?![.?:])|&&|\|\|/;

/**
 * Uma linha é ramo por perfil Master quando **nomeia o perfil** e **bifurca o fluxo**.
 *
 * A bifurcação por operador exige, além do operador, a comparação por identidade na mesma linha:
 * `perfil === 'SYSLOC_MASTER' ? …` é ramo; `readonly perfil: 'SYSLOC_MASTER' | 'ADMIN_EMPRESA'` é
 * união de tipo, e `contexto?.empresaId ?? USUARIO_MASTER.id` é valor padrão.
 */
function ehRamoPorPerfilMaster(linha: string): boolean {
  if (!MENCAO_A_MASTER.test(linha)) {
    return false;
  }
  return (
    PALAVRA_DE_RAMO.test(linha) ||
    (COMPARACAO_DE_IDENTIDADE.test(linha) && OPERADOR_DE_RAMO.test(linha))
  );
}

/**
 * Procura ramo condicional por perfil Master nos arquivos informados.
 *
 * Comentários são removidos ANTES da comparação pelo acessório comum — sem isso, o cabeçalho deste
 * próprio pacote, que explica em prosa por que o Master não tem ramo, faria a asserção reprovar o
 * código correto (`varredura-de-fontes.ts`).
 */
function varrerRamosPorPerfilMaster(arquivos: readonly string[]): Promise<VarreduraDeFontes> {
  return varrerArquivos(arquivos, ehRamoPorPerfilMaster);
}

async function escrever(caminho: string, conteudo: string): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo, 'utf8');
}

async function acrescentar(caminho: string, conteudo: string): Promise<void> {
  await writeFile(caminho, `${await readFile(caminho, 'utf8')}\n${conteudo}`, 'utf8');
}

/**
 * Uma árvore descartável com **cópia bit a bit** dos arquivos reais do caminho do dado.
 *
 * A cópia é do original, e não de um esqueleto escrito à mão: um esqueleto provaria que o detector
 * funciona sobre um arquivo inventado, e é justamente sobre o arquivo real — com a prosa que
 * menciona o Master, com os tipos que nomeiam o perfil — que ele precisa passar limpo.
 */
async function arvoreDeFalsificacao(): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'sysloc-ramo-master-'));
  for (const relativo of CAMINHO_DO_DADO) {
    await escrever(join(raiz, relativo), await readFile(join(RAIZ_DOS_PACOTES, relativo), 'utf8'));
  }
  return raiz;
}

// ===========================================================================
// Os casos
// ===========================================================================

describe('isolamento multi-tenant garantido pelo banco', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-003 — consulta no contexto da empresa A devolve exatamente as linhas de A e nenhuma de B',
    async () => {
      // A ausência de filtro por empresa é INVARIANTE (ADR-0008), e por isso é conferida no próprio
      // texto das consultas que o caso emite — não deixada a cargo de convenção.
      for (const consulta of CONSULTAS_DE_NEGOCIO) {
        expect(consulta.toLowerCase()).not.toContain('empresa_id');
        expect(consulta.toLowerCase()).not.toContain('where');
      }

      const { observado, reprovacoes } = await conferirLeituraIsolada(banco.cadeiaConexao);

      expect(ordenado(observado.emA)).toEqual(ordenado(IDENTIFICADORES_DE_A));
      expect(intersecao(observado.emA, IDENTIFICADORES_DE_B)).toEqual([]);
      expect(ordenado(observado.emB)).toEqual(ordenado(IDENTIFICADORES_DE_B));
      expect(intersecao(observado.emB, IDENTIFICADORES_DE_A)).toEqual([]);

      expect(reprovacoes).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-004 — no contexto de A, gravar linha da empresa B é recusado pelo banco e nada é gravado',
    async () => {
      const { observado, reprovacoes } = await conferirGravacaoCruzadaRecusada(banco.cadeiaConexao);

      expect(observado.sqlstateDaInsercao).toBe('42501');
      expect(observado.mensagemDaInsercao).toContain('row-level security policy');

      // A distinção entre "erro no INSERT" e "0 linhas no UPDATE/DELETE" é o comportamento real do
      // PostgreSQL sob RLS: a linha alheia é invisível, não proibida. Exigir erro nos três
      // reprovaria o alvo correto.
      expect(observado.linhasNaAtualizacao).toBe(0);
      expect(observado.linhasNaRemocao).toBe(0);

      expect(observado.estadoDepois).toBe(observado.estadoAntes);
      expect(reprovacoes).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-005 — sem empresa no contexto, toda leitura de negócio é vazia e toda gravação é recusada',
    async () => {
      const { observado, reprovacoes } = await conferirContextoSemEmpresa(banco.cadeiaConexao);

      for (const cenario of [observado.semContexto, observado.contextoNulo]) {
        expect(cenario.acessos).toEqual([]);
        expect(cenario.permissoes).toEqual([]);
        expect(cenario.resolvido).toBeNull();
        expect(cenario.sqlstateDaInsercao).toBe('42501');
      }

      // Os dois cenários chegam ao mesmo nulo pelo MESMO caminho, e é isso que se afirma aqui: a
      // unidade de trabalho emite a fixação em cadeia vazia também quando ninguém escreveu contexto
      // algum (P1 do Gate 2). Antes, "sem contexto" não emitia instrução e a variável vinha nula
      // crua — o que só era fail-closed enquanto nenhuma conexão da reserva carregasse um `SET` de
      // sessão. O `''` nos dois cenários é a prova de que a fixação não depende de haver contexto.
      expect(observado.semContexto.bruto).toBe('');
      expect(observado.contextoNulo.bruto).toBe('');

      // O companheiro positivo, exigido pelo card: sem ele, vazio não distingue isolamento de
      // banco sem dado.
      expect(observado.contagemEmA).toBe(IDENTIFICADORES_DE_A.length);

      expect(reprovacoes).toEqual([]);

      const varredura = await varrerRamosPorPerfilMaster(arquivosDoCaminhoDoDado(RAIZ_DOS_PACOTES));
      // Todo arquivo declarado foi LIDO. A contagem exata, e não `> 0`: a guarda global anterior
      // ficava satisfeita por um alvo só, e a cobertura dos demais podia cair a zero sem alarme.
      expect(varredura.arquivos).toBe(CAMINHO_DO_DADO.length);
      expect(varredura.ocorrencias).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-005 (falsificação) — a varredura reprova o ramo por perfil Master no caminho do dado',
    async () => {
      const raiz = await arvoreDeFalsificacao();

      try {
        // Controle: a árvore íntegra — cópia bit a bit dos arquivos reais — passa limpa. Sem ele,
        // "a cópia mutada reprovou" não distingue detector que funciona de detector que reprova
        // qualquer coisa.
        const integra = await varrerRamosPorPerfilMaster(arquivosDoCaminhoDoDado(raiz));
        expect(integra.arquivos).toBe(CAMINHO_DO_DADO.length);
        expect(integra.ocorrencias).toEqual([]);

        // O defeito reintroduzido: a decisão sobre o Master voltando para a aplicação, que é o que
        // a ADR-0008 tira dela.
        const alvo = join(raiz, 'db/src/unidade-de-trabalho.ts');
        await acrescentar(
          alvo,
          'export function resolverEmpresa(perfil: string, empresaId: string | null) {\n' +
            "  if (perfil === 'SYSLOC_MASTER') {\n" +
            '    return null;\n' +
            '  }\n' +
            '  return empresaId;\n' +
            '}\n',
        );

        const mutada = await varrerRamosPorPerfilMaster(arquivosDoCaminhoDoDado(raiz));

        expect(mutada.arquivos).toBe(CAMINHO_DO_DADO.length);
        expect(mutada.ocorrencias).toHaveLength(1);
        expect(mutada.ocorrencias[0]).toContain('db/src/unidade-de-trabalho.ts');
        expect(mutada.linhas[0]).toBe("if (perfil === 'SYSLOC_MASTER') {");
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-005 (controle negativo) — a linha legítima de autorização da T6/T9 não é reportada',
    async () => {
      const raiz = await arvoreDeFalsificacao();

      try {
        // (a) A linha que a T6/T9 PRECISA escrever, no lugar em que ela vai morar: a camada de
        // autorização. Ela decide por PERFIL para derivar o contexto — que é o que `contexto.ts`
        // exige, com nulo como valor de domínio do Master. A ADR-0008 não a proíbe.
        const guarda = join(raiz, 'auth/src/guarda-de-contexto.ts');
        await escrever(
          guarda,
          'export function contextoDaSessao(perfil: string, acesso: { empresaId: string }) {\n' +
            "  return { empresaId: perfil === 'SYSLOC_MASTER' ? null : acesso.empresaId };\n" +
            '}\n',
        );

        const doCaminhoDoDado = await varrerRamosPorPerfilMaster(arquivosDoCaminhoDoDado(raiz));
        expect(doCaminhoDoDado.ocorrencias).toEqual([]);

        // …e o controle não é vazio: a MESMA linha, movida para o caminho do dado, É reportada. É
        // o alcance que a distingue, não uma cegueira do detector.
        const alvo = join(raiz, 'db/src/contexto.ts');
        await acrescentar(alvo, await readFile(guarda, 'utf8'));

        const comALinhaNoCaminhoDoDado = await varrerRamosPorPerfilMaster(
          arquivosDoCaminhoDoDado(raiz),
        );
        expect(comALinhaNoCaminhoDoDado.ocorrencias).toHaveLength(1);
        expect(comALinhaNoCaminhoDoDado.ocorrencias[0]).toContain('db/src/contexto.ts');
        expect(comALinhaNoCaminhoDoDado.linhas[0]).toContain("perfil === 'SYSLOC_MASTER' ? null");

        // (b) Os vizinhos que NÃO são ramificação de fluxo, dentro do caminho do dado. Os dois do
        // meio — propriedade opcional e coalescência nula — eram reportados pela marca anterior
        // (`?` solto), e são a razão de ela ter sido estreitada.
        const vizinhos = join(raiz, 'db/src/semente.ts');
        await escrever(
          vizinhos,
          [
            "export const perfis = ['SYSLOC_MASTER', 'ADMIN_EMPRESA'] as const;",
            "export interface U { readonly perfil: 'SYSLOC_MASTER' | 'ADMIN_EMPRESA' }",
            "export interface V { readonly perfil?: 'SYSLOC_MASTER' }",
            'export const alvo = (c?: { id: string }) => c?.id ?? USUARIO_MASTER.id;',
            // A restrição de catálogo de `esquema/identidade.ts`, com a interpolação trocada por
            // nome literal para não plantar `${…}` numa cadeia deste arquivo: o que importa ao
            // detector é o `=` que NÃO é comparação por identidade.
            "export const chk = sql`(perfil = 'SYSLOC_MASTER') = (empresa_id IS NULL)`;",
            '',
          ].join('\n'),
        );

        const semRamo = await varrerRamosPorPerfilMaster([vizinhos]);
        expect(semRamo.arquivos).toBe(1);
        expect(semRamo.ocorrencias).toEqual([]);
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-006 — vincular informação de A a informação de B é recusado pela chave estrangeira composta',
    async () => {
      const { observado, reprovacoes } = await conferirChaveEstrangeiraComposta(
        banco.cadeiaConexao,
      );

      expect(observado.linhasNaLegitima).toBe(1);
      expect(observado.acessoDeBLidoEmB).toBe(IDENTIFICADORES_DE_B[0]);

      expect(observado.sqlstateDeAparaB).toBe('23503');
      expect(observado.mensagemDeAparaB).toContain(RESTRICAO_COMPOSTA);
      // A simetria fecha o caminho de a restrição valer em um sentido só.
      expect(observado.sqlstateDeBparaA).toBe('23503');

      expect(observado.permissoesEmA).toEqual([{ id: PERMISSAO_LEGITIMA, acessoId: ACESSO_A_1 }]);
      expect(observado.permissoesEmB).toEqual([]);

      expect(reprovacoes).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-007 — a prova de falsificação da fatia inteira
// ===========================================================================

/**
 * Um mutante: o que ele remove, por qual cadeia a bateria é observada, e o conjunto EXATO de
 * predicados que ele deve fazer reprovar.
 */
interface Mutante {
  readonly nome: string;
  readonly aplicar: readonly string[];
  readonly reverter: readonly string[];
  /** `true` quando o mutante só é observável pela conexão do DONO das tabelas. */
  readonly pelaConexaoDoDono: boolean;
  readonly esperado: PredicadosReprovados;
}

/**
 * Reprovações de "o isolamento não alcança esta conexão": elas são as mesmas para o mutante que
 * desliga a RLS e para o que a deixa de forçar sobre o dono, porque o efeito observável é o mesmo —
 * a política deixa de ser consultada.
 */
const ISOLAMENTO_AUSENTE: PredicadosReprovados = {
  leitura: [
    'leitura-em-A/conjunto',
    'leitura-em-A/intersecao-com-B',
    'leitura-em-B/conjunto',
    'leitura-em-B/intersecao-com-A',
  ],
  gravacao: [
    'insercao-cruzada/sqlstate',
    'insercao-cruzada/mensagem',
    'atualizacao-cruzada/linhas-afetadas',
    'remocao-cruzada/linhas-afetadas',
    'estado-de-B/inalterado',
  ],
  semEmpresa: [
    'sem-contexto/leitura-acesso',
    'sem-contexto/leitura-permissao',
    'sem-contexto/insercao-recusada',
    'contexto-nulo/leitura-acesso',
    'contexto-nulo/leitura-permissao',
    'contexto-nulo/insercao-recusada',
    'contagem-em-A',
  ],
  chaveComposta: ['permissoes-em-B/vazio'],
};

const TABELAS_DE_NEGOCIO = [
  'negocio.acesso_usuario_app',
  'negocio.acesso_usuario_permissao',
] as const;

const MUTANTES: readonly Mutante[] = [
  {
    // `DISABLE`, e não `DROP POLICY`: com a RLS habilitada e nenhuma política, o PostgreSQL nega
    // TUDO — a suíte reprovaria pelo motivo oposto ao que se quer demonstrar, e o mutante deixaria
    // de exercitar "dado alheio alcançado". O que remove o isolamento de verdade é desligá-lo.
    nome: 'M1 — isolamento desligado (DISABLE ROW LEVEL SECURITY)',
    aplicar: TABELAS_DE_NEGOCIO.map((t) => `ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY`),
    reverter: TABELAS_DE_NEGOCIO.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`),
    pelaConexaoDoDono: false,
    esperado: ISOLAMENTO_AUSENTE,
  },
  {
    // Avaliado pela conexão do DONO: para o papel da aplicação, `NO FORCE` não muda nada — e é
    // exatamente por isso que este mutante existe. Sem `FORCE`, uma suíte conectada com o dono
    // ficaria verde contra um schema sem isolamento (ADR-0008, Cons).
    nome: 'M2 — NO FORCE ROW LEVEL SECURITY, observado pelo dono das tabelas',
    aplicar: TABELAS_DE_NEGOCIO.map((t) => `ALTER TABLE ${t} NO FORCE ROW LEVEL SECURITY`),
    reverter: TABELAS_DE_NEGOCIO.map((t) => `ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`),
    pelaConexaoDoDono: true,
    esperado: ISOLAMENTO_AUSENTE,
  },
  {
    nome: 'M3 — chave estrangeira composta removida',
    aplicar: [`ALTER TABLE negocio.acesso_usuario_permissao DROP CONSTRAINT ${RESTRICAO_COMPOSTA}`],
    reverter: [
      `ALTER TABLE negocio.acesso_usuario_permissao ADD CONSTRAINT ${RESTRICAO_COMPOSTA} ` +
        'FOREIGN KEY (acesso_id, empresa_id) ' +
        'REFERENCES negocio.acesso_usuario_app (id, empresa_id)',
    ],
    pelaConexaoDoDono: false,
    esperado: {
      leitura: [],
      gravacao: [],
      semEmpresa: [],
      chaveComposta: [
        'permissao-cruzada-A-para-B/sqlstate',
        'permissao-cruzada-A-para-B/restricao',
        'permissao-cruzada-B-para-A/sqlstate',
        'permissao-cruzada-B-para-A/restricao',
        'permissoes-em-A/conjunto',
        'permissoes-em-B/vazio',
      ],
    },
  },
  {
    // O `nullif` é o que faz a cadeia vazia — o contexto do Sysloc Master — resolver para nulo. Sem
    // ele, `''::uuid` levanta erro e o caso do Master deixa de ser "vazio" para virar "quebrado".
    // Este mutante estava anotado pelo Gate 1 da T2 como "passa hoje com a suíte verde"; é aqui que
    // ele morre.
    //
    // Alcança os DOIS cenários sem empresa desde o P1 do Gate 2: a unidade de trabalho passou a
    // emitir a fixação em cadeia vazia também quando não há contexto algum, então "sem contexto"
    // também depende do `nullif`. Antes, "sem contexto" não emitia nada e escapava deste mutante —
    // que é o mesmo motivo pelo qual escapava de um `SET` de sessão deixado na conexão.
    nome: 'M4 — política sem `nullif`: contexto sem empresa deixa de resolver para nulo',
    aplicar: politicaDegradada(),
    // Nada a desfazer à mão: a restauração comum já derruba toda política e reaplica a migração.
    reverter: [],
    pelaConexaoDoDono: false,
    esperado: {
      leitura: [],
      gravacao: [],
      semEmpresa: [
        'sem-contexto/leitura-acesso',
        'sem-contexto/leitura-permissao',
        'sem-contexto/insercao-recusada',
        'contexto-nulo/leitura-acesso',
        'contexto-nulo/leitura-permissao',
        'contexto-nulo/insercao-recusada',
      ],
      chaveComposta: [],
    },
  },
];

function nomeDaPolitica(tabela: string): string {
  return `${tabela.split('.')[1] ?? tabela}_isolamento_empresa`;
}

function politicaDegradada(): string[] {
  return TABELAS_DE_NEGOCIO.flatMap((tabela) => [
    `DROP POLICY ${nomeDaPolitica(tabela)} ON ${tabela}`,
    `CREATE POLICY ${nomeDaPolitica(tabela)} ON ${tabela} FOR ALL ` +
      "USING (empresa_id = current_setting('app.empresa_id', true)::uuid) " +
      "WITH CHECK (empresa_id = current_setting('app.empresa_id', true)::uuid)",
  ]);
}

/** A migração de segurança, relida do disco — a restauração não reescreve a decisão, ela a reaplica. */
const MIGRACAO_DE_SEGURANCA = new URL('../migracoes/0001_seguranca.sql', import.meta.url);

async function executarPrivilegiado(cadeia: string, instrucoes: readonly string[]): Promise<void> {
  const sql = abrirConexao(cadeia);
  try {
    for (const instrucao of instrucoes) {
      await sql.unsafe(instrucao);
    }
  } finally {
    await sql.end();
  }
}

/**
 * Desfaz o mutante e devolve o schema ao estado que a migração define.
 *
 * A ordem é o que a torna uniforme: primeiro o inverso específico do mutante (o que a migração não
 * cobre — `ENABLE`, a chave estrangeira), depois a derrubada de TODA política, e só então a
 * reaplicação da migração, que as recria exatamente como ela as declara. Sem a derrubada, a
 * reaplicação falharia por política já existente nos mutantes que não a removeram.
 */
async function restaurarSchema(cadeia: string, inversoDoMutante: readonly string[]): Promise<void> {
  await executarPrivilegiado(cadeia, [
    ...inversoDoMutante,
    ...TABELAS_DE_NEGOCIO.map((t) => `DROP POLICY IF EXISTS ${nomeDaPolitica(t)} ON ${t}`),
  ]);

  const conteudo = await readFile(MIGRACAO_DE_SEGURANCA, 'utf8');
  const sql = abrirConexao(cadeia);
  try {
    await sql.unsafe(conteudo).simple();
  } finally {
    await sql.end();
  }
}

describe('CT-007 — isolamento removido de propósito faz a suíte de isolamento REPROVAR', () => {
  it(
    'CT-007 — cada mutante reprova um conjunto exato e nomeado de predicados, e o schema íntegro passa',
    async () => {
      // Instância DEDICADA: mutar a que os demais casos compartilham deixaria de ser prova e
      // passaria a ser sabotagem da suíte.
      const banco = await bancoEfemero();
      const doDono = conexaoDeMigracao(banco);

      try {
        // -------------------------------------------------------------------
        // Controle — com o schema íntegro, os quatro conjuntos passam pelas DUAS conexões
        // -------------------------------------------------------------------
        expect(predicadosReprovados(await rodarBateria(banco.cadeiaConexao))).toEqual(
          BATERIA_VERDE,
        );
        expect(predicadosReprovados(await rodarBateria(doDono))).toEqual(BATERIA_VERDE);

        for (const mutante of MUTANTES) {
          await executarPrivilegiado(doDono, mutante.aplicar);

          try {
            const cadeia = mutante.pelaConexaoDoDono ? doDono : banco.cadeiaConexao;
            const bateria = await rodarBateria(cadeia);

            // O conjunto EXATO de predicados, e não "a bateria reprovou": reprovar por queda de
            // conexão também deixaria "a bateria reprovou" verde.
            expect({ mutante: mutante.nome, ...predicadosReprovados(bateria) }).toEqual({
              mutante: mutante.nome,
              ...mutante.esperado,
            });

            if (mutante.nome.startsWith('M1')) {
              // A narrativa do card, afirmada como observação e não como rótulo: a leitura no
              // contexto de A passa a devolver TAMBÉM os três identificadores de B.
              expect(intersecao(bateria.leitura.observado.emA, IDENTIFICADORES_DE_B)).toEqual(
                ordenado(IDENTIFICADORES_DE_B),
              );
              expect(bateria.gravacao.observado.sqlstateDaInsercao).toBeUndefined();
            }

            if (mutante.nome.startsWith('M3')) {
              expect(bateria.chaveComposta.observado.sqlstateDeAparaB).toBeUndefined();
              expect(bateria.chaveComposta.observado.permissoesEmA).toHaveLength(2);
            }

            if (mutante.nome.startsWith('M4')) {
              // `22P02` (invalid_text_representation) é o `''::uuid` da política degradada — e o
              // fato de os DOIS cenários o levantarem é a observação que prova que a fixação em
              // cadeia vazia é emitida também sem contexto (P1).
              expect(bateria.semEmpresa.observado.contextoNulo.sqlstateDaInsercao).toBe('22P02');
              expect(bateria.semEmpresa.observado.semContexto.sqlstateDaInsercao).toBe('22P02');
            }
          } finally {
            // A restauração relê a migração em vez de reescrever a política aqui: uma cópia da
            // expressão neste arquivo divergiria da migração sem que nada acusasse.
            await restaurarSchema(doDono, mutante.reverter);
          }
        }

        // -------------------------------------------------------------------
        // Controle final — a restauração é parte da prova: sem ela, "o mutante reprovou" poderia
        // ser dano acumulado das rodadas anteriores.
        // -------------------------------------------------------------------
        expect(predicadosReprovados(await rodarBateria(banco.cadeiaConexao))).toEqual(
          BATERIA_VERDE,
        );
        expect(predicadosReprovados(await rodarBateria(doDono))).toEqual(BATERIA_VERDE);
      } finally {
        await banco.parar();
      }
    },
    LIMITE_DA_FALSIFICACAO_MS,
  );
});
