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
 * | CA-16    | CT-209 | Os ajustes individuais de uma pessoa da empresa A são invisíveis sob o
 * |          |        | contexto da empresa B e sob contexto ausente, e o ÚNICO mecanismo que os
 * |          |        | escopa é a política do banco: o fonte que os lê e os grava
 * |          |        | (`src/permissao.ts`) não contém cláusula alguma que compare a coluna de
 * |          |        | tenant. Chave gravada que o catálogo corrente não reconhece é descartada
 * |          |        | da leitura, e volta nomeada em vez de sumir. |
 * | CA-16    | CT-209 | O companheiro NEGATIVO do lado da ESCRITA: sob o contexto da empresa B e
 * |          |        | sob contexto ausente, as TRÊS escritas do módulo (`escreverAjustes`,
 * |          |        | `trocarPerfilDaPessoa`, `incrementarVersaoPermissoes`) sobre a pessoa da
 * |          |        | empresa A recusam com `ErroDePessoaForaDoContexto` E deixam o contador, o
 * |          |        | perfil e as linhas de ajuste bit a bit como estavam — enquanto a MESMA
 * |          |        | operação, sob o contexto de A, grava. É a prova de que o escopo das
 * |          |        | escritas em `identidade` (schema SEM RLS, ADR-0009) vem do alcance ao
 * |          |        | vínculo em `negocio`, e não de uma comparação escrita na aplicação. |
 * | CA-14    | CT-302 | Com uma linha descartável semeada nas duas empresas, a leitura de cada uma
 * |          |        | das NOVE relações de `negocio` que a fatia de cadastro, a de contrato e a
 * |          |        | de confirmação criaram (`conjunto`, `imovel`, `comodo`, `locador`,
 * |          |        | `locatario`, `fiador`, `contrato`, `contrato_fiador`,
 * |          |        | `portador_de_confirmacao`) sob o contexto de A devolve o conjunto exato
 * |          |        | de identificadores de A e interseção vazia com os de B; sob B, o simétrico; e
 * |          |        | sob contexto ausente e sob contexto de empresa nula devolve zero linhas nas
 * |          |        | nove, sem erro — enquanto a mesma leitura sob A segue devolvendo conjunto
 * |          |        | não vazio. Nenhuma das consultas escreve filtro por `empresa_id`. |
 * | CA-14    | CT-303 | Sob o contexto da empresa A, `INSERT` em qualquer das nove relações com
 * |          |        | `empresa_id` de B é recusado com `42501` e mensagem contendo 'row-level
 * |          |        | security policy'; `UPDATE` e `DELETE` sobre linha existente de B afetam ZERO
 * |          |        | linhas, sem erro; o estado de B, lido em seguida no contexto de B, é
 * |          |        | caractere a caractere o mesmo; e a MESMA atualização, sob o contexto de B,
 * |          |        | alcança a linha. |
 * | CA-14    | CT-304 | `negocio.imovel` só aceita `conjunto_id` cujo par `(conjunto_id, empresa_id)`
 * |          |        | exista em `negocio.conjunto (id, empresa_id)`, e `negocio.comodo` só aceita
 * |          |        | `imovel_id` cujo par exista em `negocio.imovel` — o apontamento cruzado é
 * |          |        | recusado com `23503` NOMEANDO a restrição composta, nas duas direções,
 * |          |        | enquanto o apontamento legítimo grava exatamente uma linha. |
 * | CA-16    | CT-207 | Depois da conciliação estrutural (migração `0003`),
 * |          |        | `negocio.acesso_usuario_app` referencia o par `(pessoa, empresa)` por chave
 * |          |        | estrangeira composta — de modo que um vínculo cuja empresa difere da empresa
 * |          |        | da pessoa é recusado PELO BANCO, e não por validação de aplicação. A pessoa
 * |          |        | sem empresa (o Master) continua inserível e simplesmente não é alvo de
 * |          |        | vínculo. |
 * | CA-11    | CT-522 | Sob o contexto de uma empresa, a VISÃO `negocio.cobranca_derivada` devolve
 * |          |        | apenas as cobranças dela — interseção vazia com as da outra —, e os valores
 * |          |        | de mora saem da configuração DELA: com cobranças idênticas de `2000,00`
 * |          |        | vencidas há 30 dias, A apura `40.00`/`20.00`/`2060.00` e B apura
 * |          |        | `200.00`/`100.00`/`2300.00`, e os dois resultados DIFEREM. Sem contexto e
 * |          |        | com empresa nula a leitura devolve vazio, sem erro, enquanto a mesma
 * |          |        | leitura sob A segue devolvendo a linha. A consulta emitida não escreve
 * |          |        | filtro por `empresa_id`. |
 * | CA-11    | CT-523 | A visão `negocio.cobranca_derivada` DELEGA o isolamento às tabelas-base —
 * |          |        | ela não adquire direitos próprios (ADR-0023). Recriada com o MESMO corpo,
 * |          |        | lido da migração `0010` do disco, mas SEM `security_invoker` e por dona
 * |          |        | privilegiada, a leitura sob o MESMO contexto de A passa a devolver a
 * |          |        | cobrança de B, e `verificarCoberturaDeIsolamento` acusa exatamente
 * |          |        | `{ tabela: 'negocio.cobranca_derivada', motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO' }`.
 * |          |        | Restaurada pelo papel de migração e com o atributo, as duas vias voltam ao
 * |          |        | verde. |
 * | CA-02    | CT-607 | Sob o contexto da empresa B, nenhuma linha de `negocio.politica_de_aviso`
 * | CA-12    |        | nem de `negocio.envio_de_cobranca` da empresa A é legível (contagem CRUA
 * |          |        | `0` nas duas), atualizável ou apagável (`rowCount` `0` nos quatro
 * |          |        | comandos, e sem erro), e toda inserção com `empresa_id` de A é recusada
 * |          |        | pelo `WITH CHECK` com `42501` e a mensagem da política de linha — a recusa
 * |          |        | vem do BANCO, não da aplicação. Sob A, o retrato das duas relações
 * |          |        | permanece igual ao gravado, campo a campo; sem contexto e com empresa nula
 * |          |        | a leitura devolve vazio, sem erro, enquanto a mesma leitura sob A segue
 * |          |        | devolvendo as linhas. E as duas tabelas têm `relrowsecurity` E
 * |          |        | `relforcerowsecurity` verdadeiros. Nenhuma das consultas emitidas escreve
 * |          |        | filtro por `empresa_id`. |
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
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verificarCoberturaDeIsolamento } from '../src/catalogo.ts';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  type AjustePersistido,
  type AjustesDaPessoa,
  ErroDePessoaForaDoContexto,
  escreverAjustes,
  incrementarVersaoPermissoes,
  lerAjustesDaPessoa,
  type PerfilDaPessoa,
  trocarPerfilDaPessoa,
} from '../src/permissao.ts';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  EMPRESA_A,
  EMPRESA_B,
  USUARIO_MASTER,
  USUARIOS,
} from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import {
  type BancoMigrado,
  bancoEfemero,
  conexaoDeMigracao,
  conexaoSuperusuaria,
} from './banco-efemero.ts';
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

/**
 * Pessoa descartável da empresa B, criada pelo próprio caso em `identidade.usuario`.
 *
 * Ela existe por causa da chave estrangeira composta que a migração `0003` instalou: o vínculo
 * descartável do CT-004 precisa apontar para uma pessoa que **pertença mesmo** à empresa B, e as
 * três pessoas de B da carga inicial já têm vínculo — a restrição
 * `acesso_usuario_app_empresa_usuario_key` admite um vínculo por pessoa e empresa. Reaproveitar uma
 * delas colidiria; usar o Master, como antes, é hoje impossível por construção, que é exatamente o
 * que o CT-207 prova.
 *
 * Ela mora em `identidade`, que não é tenantizado (ADR-0009), e não entra em contagem nenhuma dos
 * demais casos — todos afirmam conjuntos de `negocio.acesso_usuario_app`.
 */
const PESSOA_DESCARTAVEL_EM_B = {
  id: 'dddddddd-2222-4000-8000-000000000001',
  email: 'descartavel.b@exemplo.com.br',
  nome: 'Pessoa Descartável de B',
} as const;

/**
 * A SEGUNDA pessoa de B, sujeito da linha que a empresa A tenta gravar no CT-004.
 *
 * Ela é uma pessoa de B, e não de A, por uma razão de método: o que o CT-004 mede é a RLS, e só
 * ela. Com uma pessoa de A, a linha seria incoerente também para a chave estrangeira composta da
 * migração `0003` — e, no mutante M1 do CT-007, que desliga a RLS de propósito, a gravação passaria
 * a ser barrada pela referência em vez de acontecer. O mutante deixaria de exibir "o dado alheio
 * foi alcançado", que é justamente o que ele existe para exibir.
 *
 * São DUAS pessoas, e não uma, porque `acesso_usuario_app_empresa_usuario_key` admite um vínculo
 * por pessoa e empresa: a linha do preparo e a linha da tentativa cruzada precisam de sujeitos
 * distintos.
 */
const PESSOA_CRUZADA_EM_B = {
  id: 'dddddddd-2222-4000-8000-000000000004',
  email: 'cruzada.b@exemplo.com.br',
  nome: 'Segunda Pessoa Descartável de B',
} as const;

/**
 * Pessoa descartável da empresa A — o sujeito do CT-207.
 *
 * É a MESMA pessoa nas duas pernas do caso: o vínculo incoerente a coloca sob a empresa B e o
 * coerente sob a empresa A. Usar a mesma pessoa é o que faz a empresa ser a única variável entre a
 * recusa e o sucesso; duas pessoas diferentes deixariam a diferença atribuível a qualquer outra
 * coisa.
 */
const PESSOA_DESCARTAVEL_EM_A = {
  id: 'dddddddd-2222-4000-8000-000000000002',
  email: 'descartavel.a@exemplo.com.br',
  nome: 'Pessoa Descartável de A',
} as const;

/**
 * Um SEGUNDO operador sem empresa. Ele não substitui o Master da carga — ele coexiste com ele, e é
 * essa coexistência que prova que a unicidade `(id, empresa_id)` acrescentada pela migração `0003`
 * **não** tenantiza `identidade.usuario`: no PostgreSQL, unicidade não compara nulos entre si.
 */
const MASTER_DESCARTAVEL = {
  id: 'dddddddd-2222-4000-8000-000000000003',
  email: 'master.descartavel@sysloc.com.br',
  nome: 'Segundo Operador Sysloc',
} as const;

/**
 * A chave das permissões CRUZADAS do CT-006 — distinta da `contratos` usada pela legítima e pela de
 * apoio. Ver o comentário de `gravarPermissaoCruzada`: é o que impede a unicidade do trio, criada
 * pela migração `0003`, de responder no lugar da chave estrangeira composta.
 */
const CHAVE_DA_CRUZADA = 'financeiro';

/** Vínculos que o CT-207 tenta gravar: o incoerente, o coerente e o do operador sem empresa. */
const VINCULO_INCOERENTE = 'dddddddd-3333-4000-8000-000000000001';
const VINCULO_COERENTE = 'dddddddd-3333-4000-8000-000000000002';
const VINCULO_DO_MASTER = 'dddddddd-3333-4000-8000-000000000003';

const ACESSOS_DESCARTAVEIS = [
  ACESSO_DESCARTAVEL_EM_B,
  ACESSO_CRUZADO_EM_B,
  ACESSO_SEM_CONTEXTO_1,
  ACESSO_SEM_CONTEXTO_2,
  VINCULO_INCOERENTE,
  VINCULO_COERENTE,
  VINCULO_DO_MASTER,
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
// `USUARIO_ADMIN_A` saiu: a gravação cruzada do CT-004 passou a usar `PESSOA_CRUZADA_EM_B`, e
// nenhum outro ponto o consumia. Símbolo que esta mudança tornou órfão é removido por ela.
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

/**
 * O nome da restrição que o servidor apontou, ou `undefined` quando o erro não veio dele.
 *
 * O campo se chama `constraint_name` porque é assim que o driver nomeia o campo `n` da resposta de
 * erro do PostgreSQL (`postgres/src/connection.js`). Afirmar o nome da restrição — e não só o
 * SQLSTATE — é o que distingue "alguma chave estrangeira recusou" de "ESTA chave estrangeira
 * recusou": a tabela tem três, e um `23503` sozinho não diz qual delas falou.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
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
    //
    // A pessoa da linha é criada aqui, e pertence a B: desde a migração `0003` o par
    // `(usuario_id, empresa_id)` é referenciado por chave estrangeira composta, e o Master — que
    // ocupava este lugar antes — não pertence a empresa alguma. Ver `PESSOA_DESCARTAVEL_EM_B`.
    const preparo = await tentar(() =>
      contextoDeTenant.executarCom(CONTEXTO_DE_B, async () =>
        acesso.emUnidadeDeTrabalho(async (tx) => {
          for (const pessoa of [PESSOA_DESCARTAVEL_EM_B, PESSOA_CRUZADA_EM_B]) {
            await tx`
              INSERT INTO identidade.usuario (id, email, nome, perfil, empresa_id)
              VALUES (${pessoa.id}, ${pessoa.email}, ${pessoa.nome},
                      ${'USUARIO_EMPRESA'}::identidade.perfil_usuario, ${EMPRESA_B.id})
              ON CONFLICT DO NOTHING
            `;
          }
          await tx`
            INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
            VALUES (${ACESSO_DESCARTAVEL_EM_B}, ${EMPRESA_B.id}, ${PESSOA_DESCARTAVEL_EM_B.id})
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
          // A linha é bem formada em tudo menos no contexto de quem a escreve: a pessoa pertence
          // mesmo a B (ver `PESSOA_CRUZADA_EM_B`). É o que faz a RLS ser o ÚNICO motivo possível da
          // recusa aqui — e o que mantém o mutante M1 do CT-007 exibindo a gravação alheia
          // acontecendo de verdade quando o isolamento é removido.
          await tx`
            INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
            VALUES (${ACESSO_CRUZADO_EM_B}, ${EMPRESA_B.id}, ${PESSOA_CRUZADA_EM_B.id})
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
            INSERT INTO negocio.acesso_usuario_permissao
                        (id, empresa_id, acesso_id, tipo, chave, efeito)
            VALUES (${PERMISSAO_DE_APOIO}, ${EMPRESA_A.id}, ${ACESSO_A_1},
                    ${'TELA'}::negocio.tipo_permissao, ${'contratos'},
                    ${'CONCEDIDA'}::negocio.efeito_permissao)
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
            INSERT INTO negocio.acesso_usuario_permissao
                        (id, empresa_id, acesso_id, tipo, chave, efeito)
            VALUES (${PERMISSAO_LEGITIMA}, ${EMPRESA_A.id}, ${ACESSO_A_1},
                    ${'TELA'}::negocio.tipo_permissao, ${'contratos'},
                    ${'CONCEDIDA'}::negocio.efeito_permissao)
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
        // A chave é OUTRA, e não `contratos`: desde a migração `0003` existe unicidade sobre
        // `(acesso_id, tipo, chave)`, e a tentativa cruzada de B para A aponta justamente para
        // `ACESSO_A_1` — o mesmo vínculo da permissão legítima. Com a mesma chave, o banco recusaria
        // por `23505` ANTES de a chave estrangeira composta ser consultada, e o caso passaria a
        // provar a unicidade em vez da referência. Nomes distintos mantêm a referência como o único
        // motivo possível da recusa.
        await tx`
          INSERT INTO negocio.acesso_usuario_permissao
                      (id, empresa_id, acesso_id, tipo, chave, efeito)
          VALUES (${id}, ${empresaId}, ${acessoId}, ${'TELA'}::negocio.tipo_permissao,
                  ${CHAVE_DA_CRUZADA}, ${'CONCEDIDA'}::negocio.efeito_permissao)
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
// CT-207 — conciliação estrutural do D5: vínculo cross-tenant é impossível
// ===========================================================================
//
// Ele NÃO entra em `rodarBateria`. A bateria existe para o CT-007, que aplica mutantes ao
// isolamento e afirma o conjunto exato de predicados reprovados por mutante; acrescentar um quinto
// conjunto a ela mudaria o esperado dos quatro mutantes já fixados, sem que nenhum deles tenha
// relação com esta restrição. O CT-006 já cobre a família do lado das permissões, e a prova aqui é
// o PAR — a mesma pessoa recusada sob a empresa errada e aceita sob a certa.

const RESTRICAO_DO_VINCULO = 'acesso_usuario_app_usuario_empresa_fkey';

interface PessoaDescartavel {
  readonly id: string;
  readonly email: string;
  readonly nome: string;
}

/**
 * Cria uma pessoa em `identidade.usuario` pelo caminho restrito que a ADR-0009 autoriza — o mesmo
 * acesso sem privilégio que a aplicação usa, nunca a conexão de migração.
 *
 * Devolve quantas linhas foram gravadas, para que quem chama possa afirmar a criação em vez de
 * presumi-la: com `ON CONFLICT DO NOTHING`, uma pessoa que já existisse devolveria zero.
 */
async function criarPessoa(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  pessoa: PessoaDescartavel,
  perfil: 'SYSLOC_MASTER' | 'ADMIN_EMPRESA' | 'USUARIO_EMPRESA',
  empresaId: string | null,
): Promise<number> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const resultado = await tx`
        INSERT INTO identidade.usuario (id, email, nome, perfil, empresa_id)
        VALUES (${pessoa.id}, ${pessoa.email}, ${pessoa.nome},
                ${perfil}::identidade.perfil_usuario, ${empresaId})
        ON CONFLICT DO NOTHING
      `;
      return resultado.count;
    }),
  );
}

interface TentativaDeVinculo {
  readonly codigo: string | undefined;
  readonly restricao: string | undefined;
  readonly linhas: number | undefined;
}

/** Tenta gravar um vínculo de acesso sob o contexto informado. */
async function gravarVinculo(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  id: string,
  empresaId: string,
  usuarioId: string,
): Promise<TentativaDeVinculo> {
  const tentativa = await tentar(() =>
    contextoDeTenant.executarCom(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        const resultado = await tx`
          INSERT INTO negocio.acesso_usuario_app (id, empresa_id, usuario_id)
          VALUES (${id}, ${empresaId}, ${usuarioId})
        `;
        return resultado.count;
      }),
    ),
  );

  return tentativa.ok
    ? { codigo: undefined, restricao: undefined, linhas: tentativa.valor }
    : {
        codigo: sqlstate(tentativa.erro),
        restricao: nomeDaRestricao(tentativa.erro),
        linhas: undefined,
      };
}

/** Os identificadores das pessoas SEM empresa, lidos de `identidade` pelo acesso sem privilégio. */
async function lerPessoasSemEmpresa(acesso: AcessoAoBanco, contexto: Contexto): Promise<string[]> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<{ id: string }[]>`
        SELECT id FROM identidade.usuario WHERE empresa_id IS NULL ORDER BY id
      `;
      return linhas.map((linha) => linha.id);
    }),
  );
}

/** Quantos vínculos existem para a pessoa informada, no contexto dado. */
async function contarVinculosDe(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  usuarioId: string,
): Promise<number> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<{ total: string }[]>`
        SELECT count(*)::text AS total FROM negocio.acesso_usuario_app
         WHERE usuario_id = ${usuarioId}
      `;
      return Number(linhas[0]?.total ?? -1);
    }),
  );
}

// ===========================================================================
// CT-302 · CT-303 · CT-304 — as nove relações do domínio (seis de cadastro, duas de contrato,
// uma de confirmação)
// ===========================================================================
//
// Os três NÃO entram em `rodarBateria`, e o motivo é o mesmo já registrado para o CT-207: a bateria
// afirma o conjunto EXATO de predicados reprovados por mutante do CT-007, e acrescentar predicados
// mudaria o esperado dos quatro mutantes — nenhum dos quais tem relação com estas tabelas. Alterar
// aquele esperado seria regressão de prova.
//
// Eles também não reimplementam nada: `tentar`, `sqlstate`, `nomeDaRestricao`, `intersecao` e
// `comoTexto` são as mesmas utilidades dos CT-003 a CT-006, e o contexto vem exclusivamente de
// `contextoDeTenant.executarCom` mais `abrirAcessoAoBanco`. Nenhum símbolo foi acrescentado a
// `packages/db/src/**` para que estes casos existam — as linhas de cadastro nascem de SQL do
// próprio caso, sob o contexto da empresa DONA, que é o caminho que a aplicação usará.

/** Os dados de uma linha descartável de cadastro. Um só formato para as nove relações. */
interface DadosDeCadastro {
  readonly id: string;
  readonly empresaId: string;
  /** O pai tenantizado de `imovel`. Ignorado pelas entidades que não têm pai. */
  readonly conjuntoId: string;
  /** O pai tenantizado de `comodo` — e um dos três de `contrato`. */
  readonly imovelId: string;
  /** Os outros dois pais tenantizados de `contrato`. */
  readonly locadorId: string;
  readonly locatarioId: string;
  /** Os dois pais tenantizados de `contrato_fiador`. */
  readonly contratoId: string;
  readonly fiadorId: string;
  /** Posição do cômodo. Distinta por tentativa: `unique(imovel_id, posicao)` recusaria antes da FK. */
  readonly posicao: number;
  /**
   * Sufixo que torna únicos o identificador municipal e o documento.
   *
   * Ele existe pela mesma razão do comentário de `gravarPermissaoCruzada`: com valor repetido, o
   * banco recusaria por `23505` ANTES de a política ou a chave estrangeira composta serem
   * consultadas, e o caso passaria a provar a unicidade em vez do isolamento.
   */
  readonly marca: string;
}

/**
 * Uma das relações do domínio: como lê-la, como gravá-la e qual coluna é livre para ser atualizada.
 *
 * A lista abaixo é o ALVO DECLARADO dos três casos. Entidade acrescentada a `negocio` sem entrada
 * aqui é entidade sem prova de isolamento — que é exatamente a lacuna que estes casos fecham. É por
 * isso que a T3 da fatia `contratos-de-locacao` acrescenta as duas relações dela aqui, em vez de
 * escrever casos próprios: o mecanismo já existe, e o que faltava era a linha na lista.
 */
interface EntidadeDeCadastro {
  readonly nome: string;
  readonly relacao: string;
  /**
   * A leitura, **declarada como valor** para que a ausência de filtro por empresa seja CONFERIDA e
   * não apenas prometida (ADR-0008) — mesmo mecanismo de {@link CONSULTAS_DE_NEGOCIO}.
   */
  readonly consulta: string;
  /** A leitura do retrato: identificador mais a coluna livre, para comparação bit a bit. */
  readonly consultaDoRetrato: string;
  /**
   * Coluna reescrevível que **não participa de restrição de unicidade alguma**. A atualização
   * cruzada do CT-303 mede visibilidade; colidir com outra regra confundiria o diagnóstico.
   *
   * Ela é de **texto** na maioria das entidades, e nessas o valor gravado sai de
   * {@link TEXTO_DA_ESCRITA_CRUZADA}. Onde a entidade não tem coluna de texto livre — hoje TRÊS
   * delas: `contrato_fiador` (`uuid`), `contrato` (`numeric`) e `portador_de_confirmacao`
   * (`timestamptz`) —, a coluna é **tipada** e o valor vem de {@link valorDaEscritaCruzada}.
   */
  readonly colunaLivre: string;
  /**
   * O valor que a atualização cruzada do CT-303 tenta gravar em {@link colunaLivre}. Omitido, é
   * {@link TEXTO_DA_ESCRITA_CRUZADA} — o que vale para toda coluna de texto.
   *
   * Ele nasceu por causa de `contrato_fiador`, que é **vínculo puro** e não tem coluna de texto
   * alguma: a ADR-0014 o exclui da exclusão lógica, e o sistema antigo mede um único campo na
   * tabela-filha correspondente. A única coluna reescrevível dele é uma referência `uuid`, e um
   * texto ali seria recusado na conversão do parâmetro — ANTES de a política ser consultada —,
   * fazendo o caso provar tipagem em vez de isolamento.
   *
   * Hoje **três** entidades o declaram, pela mesma razão e com tipos diferentes: `contrato_fiador`
   * (`uuid`), `contrato` (`numeric(15,2)`) e `portador_de_confirmacao` (`timestamptz`). O plural
   * está escrito porque a lista cresce a cada fatia, e um docblock no singular convida a próxima a
   * tratar o campo como exceção de uma entidade só.
   */
  readonly valorDaEscritaCruzada?: string;
  /** Todo identificador que os três casos usam nesta entidade — a lista que a limpeza percorre. */
  readonly descartaveis: readonly string[];
  gravar(tx: TransactionSql, dados: DadosDeCadastro): Promise<number>;
}

// Uma linha descartável por entidade e por empresa. O segundo grupo do identificador distingue a
// empresa (`4444` = A, `5555` = B) e o último distingue a entidade.
const CADASTROS_DE_A = {
  conjunto: 'dddddddd-4444-4000-8000-000000000001',
  imovel: 'dddddddd-4444-4000-8000-000000000002',
  comodo: 'dddddddd-4444-4000-8000-000000000003',
  locador: 'dddddddd-4444-4000-8000-000000000004',
  locatario: 'dddddddd-4444-4000-8000-000000000005',
  fiador: 'dddddddd-4444-4000-8000-000000000006',
  contrato: 'dddddddd-4444-4000-8000-000000000007',
  contrato_fiador: 'dddddddd-4444-4000-8000-000000000008',
  portador_de_confirmacao: 'dddddddd-4444-4000-8000-000000000009',
} as const;

const CADASTROS_DE_B = {
  conjunto: 'dddddddd-5555-4000-8000-000000000001',
  imovel: 'dddddddd-5555-4000-8000-000000000002',
  comodo: 'dddddddd-5555-4000-8000-000000000003',
  locador: 'dddddddd-5555-4000-8000-000000000004',
  locatario: 'dddddddd-5555-4000-8000-000000000005',
  fiador: 'dddddddd-5555-4000-8000-000000000006',
  contrato: 'dddddddd-5555-4000-8000-000000000007',
  contrato_fiador: 'dddddddd-5555-4000-8000-000000000008',
  portador_de_confirmacao: 'dddddddd-5555-4000-8000-000000000009',
} as const;

/** As linhas que a empresa A tenta gravar com `empresa_id` da empresa B (CT-303). */
const CADASTROS_CRUZADOS = {
  conjunto: 'dddddddd-6666-4000-8000-000000000001',
  imovel: 'dddddddd-6666-4000-8000-000000000002',
  comodo: 'dddddddd-6666-4000-8000-000000000003',
  locador: 'dddddddd-6666-4000-8000-000000000004',
  locatario: 'dddddddd-6666-4000-8000-000000000005',
  fiador: 'dddddddd-6666-4000-8000-000000000006',
  contrato: 'dddddddd-6666-4000-8000-000000000007',
  contrato_fiador: 'dddddddd-6666-4000-8000-000000000008',
  portador_de_confirmacao: 'dddddddd-6666-4000-8000-000000000009',
} as const;

// As seis tentativas do CT-304: a legítima e as duas cruzadas, para cada uma das duas relações
// tenantizadas (`imovel` → `conjunto` e `comodo` → `imovel`).
const IMOVEL_LEGITIMO_EM_A = 'dddddddd-7777-4000-8000-000000000001';
const IMOVEL_CRUZADO_A_PARA_B = 'dddddddd-7777-4000-8000-000000000002';
const IMOVEL_CRUZADO_B_PARA_A = 'dddddddd-7777-4000-8000-000000000003';
const COMODO_LEGITIMO_EM_A = 'dddddddd-7777-4000-8000-000000000004';
const COMODO_CRUZADO_A_PARA_B = 'dddddddd-7777-4000-8000-000000000005';
const COMODO_CRUZADO_B_PARA_A = 'dddddddd-7777-4000-8000-000000000006';

/** Os nomes das duas restrições compostas do domínio, escritos UMA vez cada (CT-304). */
const RESTRICAO_DO_IMOVEL = 'imovel_conjunto_empresa_fkey';
const RESTRICAO_DO_COMODO = 'comodo_imovel_empresa_fkey';

/**
 * Posições distintas por tentativa de cômodo.
 *
 * `unique(imovel_id, posicao)` é restrição de índice e é verificada ANTES dos gatilhos de
 * integridade referencial: repetir a posição faria o banco recusar por `23505` e o CT-304 provaria
 * a unicidade em vez da chave estrangeira composta.
 */
const POSICAO_SEMEADA = 1;
const POSICAO_CRUZADA = 2;
const POSICAO_LEGITIMA_EM_A = 3;
const POSICAO_CRUZADA_A_PARA_B = 4;
const POSICAO_CRUZADA_B_PARA_A = 5;

/**
 * A gravação de um cadastro de pessoa, por relação.
 *
 * As três tabelas têm a mesma forma (ver `camposDeCadastroDePessoa` em `src/esquema/negocio.ts`), e
 * escrever quinze colunas três vezes aqui criaria três cópias livres para divergir. O nome da
 * relação vem da lista fechada abaixo, nunca de entrada externa.
 */
function gravarCadastroDePessoa(relacao: string) {
  return async (tx: TransactionSql, dados: DadosDeCadastro): Promise<number> => {
    const resultado = await tx.unsafe(
      `INSERT INTO ${relacao}
              (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
               logradouro, numero, complemento, bairro, cidade, estado, cep)
       VALUES ($1, $2, $3, 'PESSOA_FISICA', $4, NULL, $5, '8699990000',
               'Rua das Laranjeiras', '100', NULL, 'Centro', 'Teresina', 'PI', '64000000')`,
      [
        dados.id,
        dados.empresaId,
        `Cadastro ${dados.marca}`,
        `DOC-${dados.marca}`,
        `cadastro.${dados.marca}@exemplo.com.br`,
      ],
    );
    return resultado.count;
  };
}

function consultaDeIds(relacao: string): string {
  return `SELECT id FROM ${relacao} ORDER BY id`;
}

function consultaDeRetrato(relacao: string, colunaLivre: string): string {
  return `SELECT id, ${colunaLivre} AS livre FROM ${relacao} ORDER BY id`;
}

/**
 * As nove, na ordem PAI → FILHO.
 *
 * A ordem é normativa em dois pontos: a semeadura precisa criar o conjunto antes do imóvel, o imóvel
 * antes do cômodo, e as três pontas do contrato (imóvel, locador, locatário) antes dele — e o
 * contrato antes do vínculo de fiador. A limpeza percorre a lista ao contrário, para que nenhuma
 * remoção esbarre numa chave estrangeira.
 */
const ENTIDADES_DE_CADASTRO: readonly EntidadeDeCadastro[] = [
  {
    nome: 'conjunto',
    relacao: 'negocio.conjunto',
    consulta: consultaDeIds('negocio.conjunto'),
    consultaDoRetrato: consultaDeRetrato('negocio.conjunto', 'nome'),
    colunaLivre: 'nome',
    descartaveis: [CADASTROS_DE_A.conjunto, CADASTROS_DE_B.conjunto, CADASTROS_CRUZADOS.conjunto],
    gravar: async (tx, dados) => {
      const resultado = await tx`
        INSERT INTO negocio.conjunto (id, empresa_id, nome)
        VALUES (${dados.id}, ${dados.empresaId}, ${`Conjunto ${dados.marca}`})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'imovel',
    relacao: 'negocio.imovel',
    consulta: consultaDeIds('negocio.imovel'),
    consultaDoRetrato: consultaDeRetrato('negocio.imovel', 'observacoes'),
    colunaLivre: 'observacoes',
    descartaveis: [
      CADASTROS_DE_A.imovel,
      CADASTROS_DE_B.imovel,
      CADASTROS_CRUZADOS.imovel,
      IMOVEL_LEGITIMO_EM_A,
      IMOVEL_CRUZADO_A_PARA_B,
      IMOVEL_CRUZADO_B_PARA_A,
    ],
    gravar: async (tx, dados) => {
      const resultado = await tx`
        INSERT INTO negocio.imovel
                    (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                     logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao,
                     observacoes)
        VALUES (${dados.id}, ${dados.empresaId}, ${dados.conjuntoId}, ${`Imóvel ${dados.marca}`},
                ${`IM-${dados.marca}`}, ${'RESIDENCIAL'}::negocio.tipo_imovel,
                ${'Rua das Laranjeiras'}, ${'100'}, ${null}, ${'Centro'}, ${'Teresina'}, ${'PI'},
                ${'64000000'}, ${'DISPONIVEL'}::negocio.status_locacao, ${null})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'comodo',
    relacao: 'negocio.comodo',
    consulta: consultaDeIds('negocio.comodo'),
    consultaDoRetrato: consultaDeRetrato('negocio.comodo', 'observacoes'),
    colunaLivre: 'observacoes',
    descartaveis: [
      CADASTROS_DE_A.comodo,
      CADASTROS_DE_B.comodo,
      CADASTROS_CRUZADOS.comodo,
      COMODO_LEGITIMO_EM_A,
      COMODO_CRUZADO_A_PARA_B,
      COMODO_CRUZADO_B_PARA_A,
    ],
    gravar: async (tx, dados) => {
      const resultado = await tx`
        INSERT INTO negocio.comodo
                    (id, empresa_id, imovel_id, nome_comodo, metragem, posicao, observacoes)
        VALUES (${dados.id}, ${dados.empresaId}, ${dados.imovelId}, ${`Sala ${dados.marca}`},
                ${'12.50'}, ${dados.posicao}, ${null})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'locador',
    relacao: 'negocio.locador',
    consulta: consultaDeIds('negocio.locador'),
    consultaDoRetrato: consultaDeRetrato('negocio.locador', 'nome'),
    colunaLivre: 'nome',
    descartaveis: [CADASTROS_DE_A.locador, CADASTROS_DE_B.locador, CADASTROS_CRUZADOS.locador],
    gravar: gravarCadastroDePessoa('negocio.locador'),
  },
  {
    nome: 'locatario',
    relacao: 'negocio.locatario',
    consulta: consultaDeIds('negocio.locatario'),
    consultaDoRetrato: consultaDeRetrato('negocio.locatario', 'nome'),
    colunaLivre: 'nome',
    descartaveis: [
      CADASTROS_DE_A.locatario,
      CADASTROS_DE_B.locatario,
      CADASTROS_CRUZADOS.locatario,
    ],
    gravar: gravarCadastroDePessoa('negocio.locatario'),
  },
  {
    nome: 'fiador',
    relacao: 'negocio.fiador',
    consulta: consultaDeIds('negocio.fiador'),
    consultaDoRetrato: consultaDeRetrato('negocio.fiador', 'nome'),
    colunaLivre: 'nome',
    descartaveis: [CADASTROS_DE_A.fiador, CADASTROS_DE_B.fiador, CADASTROS_CRUZADOS.fiador],
    gravar: gravarCadastroDePessoa('negocio.fiador'),
  },
  // -------------------------------------------------------------------------
  // T3 da fatia `contratos-de-locacao` — as duas relações da migração `0007`
  // -------------------------------------------------------------------------
  //
  // Elas entram aqui, e não em casos próprios, pela razão escrita no docblock de
  // {@link EntidadeDeCadastro}: o mecanismo dos CT-302/303/304 já é o alvo declarado de TODA relação
  // de `negocio`, e o que faltava era a linha na lista. Nenhuma asserção anterior foi afrouxada — os
  // conjuntos esperados cresceram em duas entradas cada, e continuam cobrados por igualdade.
  //
  // A posição é o FIM da lista porque a ordem é pai → filho: o contrato aponta para imóvel, locador
  // e locatário, e o vínculo aponta para o contrato e para o fiador. A limpeza percorre ao
  // contrário, de modo que o vínculo sai antes do contrato, e o contrato antes dos pais dele.
  {
    nome: 'contrato',
    relacao: 'negocio.contrato',
    consulta: consultaDeIds('negocio.contrato'),
    // ---------------------------------------------------------------------------
    // O contrato não tem MAIS coluna de texto livre, e a substituta é tipada
    // ---------------------------------------------------------------------------
    //
    // A coluna livre era `pdf_contrato_arquivo`, a única de texto do contrato fora de restrição de
    // unicidade — `codigo` participa de `contrato_empresa_codigo_key`, e reescrevê-lo faria o caso
    // disputar com a unicidade em vez de medir visibilidade. A migração `0013` a **removeu**
    // (ADR-0030), e depois do `DROP` a tabela fica sem coluna de texto livre alguma.
    //
    // A substituta aplica o precedente que o próprio arquivo instalou para `contrato_fiador` (ver o
    // docblock de {@link EntidadeDeCadastro.valorDaEscritaCruzada}): coluna reescrevível **tipada**,
    // com `valorDaEscritaCruzada` explícito. `valor_total_contrato` é `numeric(15,2)` ANULÁVEL, sem
    // unicidade e sem `CHECK` — as demais ou são `NOT NULL`, ou carregam `CHECK`
    // (`dia_vencimento`, `prazo_meses`, `valor_mensal`), ou são chave estrangeira. Ela é derivada na
    // ativação (RD-10) e as linhas que este caso semeia são `RASCUNHO`, logo nasce `NULL` e nada
    // mais no produto disputa aquele valor.
    //
    // `'9999.99'` é literal numérico VÁLIDO, e é isso que importa: sem ele, a conversão do parâmetro
    // recusaria ANTES de a política ser consultada e o caso passaria a medir tipagem em vez de
    // política — exatamente o risco que aquele docblock nomeia.
    consultaDoRetrato: consultaDeRetrato('negocio.contrato', 'valor_total_contrato'),
    colunaLivre: 'valor_total_contrato',
    valorDaEscritaCruzada: '9999.99',
    descartaveis: [CADASTROS_DE_A.contrato, CADASTROS_DE_B.contrato, CADASTROS_CRUZADOS.contrato],
    gravar: async (tx, dados) => {
      // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança
      // `ATIVO`, e semear contratos ativos faria a segunda gravação sobre o mesmo imóvel disputar
      // com a vigência única — que é outro invariante, provado pelo CT-407 na T5.
      const resultado = await tx`
        INSERT INTO negocio.contrato
                    (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                     data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento,
                     gerar_cobrancas_automaticamente)
        VALUES (${dados.id}, ${dados.empresaId}, ${`CTR-2026-${dados.marca}`}, ${dados.imovelId},
                ${dados.locadorId}, ${dados.locatarioId},
                ${'RASCUNHO'}::negocio.status_contrato,
                ${'2026-01-10'}::date, ${12}, ${'1500.00'}, ${10}, ${true})
      `;
      return resultado.count;
    },
  },
  {
    nome: 'contrato_fiador',
    relacao: 'negocio.contrato_fiador',
    consulta: consultaDeIds('negocio.contrato_fiador'),
    consultaDoRetrato: consultaDeRetrato('negocio.contrato_fiador', 'fiador_id'),
    // ---------------------------------------------------------------------------
    // O vínculo não tem coluna de texto livre, e a ausência é a decisão (ADR-0014)
    // ---------------------------------------------------------------------------
    //
    // A única coluna reescrevível é uma referência `uuid`, e o único valor legítimo dela na empresa
    // B — que é sempre o alvo da escrita cruzada — é o próprio fiador de B. A atualização é, por
    // consequência, uma REATRIBUIÇÃO DO MESMO VALOR, e o que ela mede é a **visibilidade da linha**
    // (1 linha sob o contexto de B, 0 sob o de A), que é exatamente o predicado do CT-303.
    //
    // O eixo do CONTEÚDO, que nas outras sete vem da coluna livre, aqui vem do `DELETE` cruzado: o
    // retrato carrega o par `(id, fiador_id)` e reprova se a linha de B tiver sumido.
    colunaLivre: 'fiador_id',
    valorDaEscritaCruzada: CADASTROS_DE_B.fiador,
    descartaveis: [
      CADASTROS_DE_A.contrato_fiador,
      CADASTROS_DE_B.contrato_fiador,
      CADASTROS_CRUZADOS.contrato_fiador,
    ],
    gravar: async (tx, dados) => {
      const resultado = await tx`
        INSERT INTO negocio.contrato_fiador (id, empresa_id, contrato_id, fiador_id)
        VALUES (${dados.id}, ${dados.empresaId}, ${dados.contratoId}, ${dados.fiadorId})
      `;
      return resultado.count;
    },
  },
  // -------------------------------------------------------------------------
  // T3 da fatia `documentos-e-confirmacao` — a relação da migração `0013`
  // -------------------------------------------------------------------------
  //
  // Ela entra aqui, e não em caso próprio, pela razão escrita no docblock de
  // {@link EntidadeDeCadastro}: o mecanismo dos CT-302/303/304 já é o alvo declarado de TODA relação
  // de `negocio`, e o que faltava era a linha na lista. Nenhuma asserção anterior foi afrouxada — os
  // conjuntos esperados cresceram em uma entrada cada, e continuam cobrados por igualdade.
  //
  // O portador é filho do LOCATÁRIO, que já vem antes nesta lista, então a posição no fim satisfaz a
  // ordem pai → filho da semeadura; a limpeza percorre ao contrário e o remove primeiro.
  //
  // ⚠️ O que este bloco NÃO prova é a função `SECURITY DEFINER` da `0014` — ela existe justamente
  // para atravessar a política que os três casos aqui medem, e é a T8 que a exercita (CT-727,
  // CT-728). Aqui se prova a outra metade: **fora** daquela função, o portador de uma empresa é
  // inalcançável pela outra, como qualquer tabela deste schema.
  {
    nome: 'portador_de_confirmacao',
    relacao: 'negocio.portador_de_confirmacao',
    consulta: consultaDeIds('negocio.portador_de_confirmacao'),
    // ---------------------------------------------------------------------------
    // A coluna livre é um INSTANTE, e o valor da escrita cruzada é explícito
    // ---------------------------------------------------------------------------
    //
    // A tabela não tem coluna de texto reescrevível: `derivado` é o único `text`, e ele carrega a
    // unicidade GLOBAL `portador_de_confirmacao_derivado_key` — reescrevê-lo faria o caso disputar
    // com ela em vez de medir visibilidade, e a colisão seria entre empresas, que é exatamente o
    // ruído a evitar.
    //
    // `invalidado_em` é `timestamptz` anulável, sem unicidade e sem `CHECK`, e nasce `NULL` na
    // semeadura — nada mais no produto disputa aquele valor nas linhas descartáveis. Mesmo
    // precedente de `contrato_fiador` e de `contrato`: coluna tipada com `valorDaEscritaCruzada`
    // explícito, para que a conversão do parâmetro passe e o caso volte a medir POLÍTICA.
    consultaDoRetrato: consultaDeRetrato('negocio.portador_de_confirmacao', 'invalidado_em'),
    colunaLivre: 'invalidado_em',
    valorDaEscritaCruzada: '2026-01-01T00:00:00.000Z',
    descartaveis: [
      CADASTROS_DE_A.portador_de_confirmacao,
      CADASTROS_DE_B.portador_de_confirmacao,
      CADASTROS_CRUZADOS.portador_de_confirmacao,
    ],
    gravar: async (tx, dados) => {
      // `derivado` é único GLOBALMENTE (e não por empresa): a marca entra nele pela mesma razão do
      // comentário de `DadosDeCadastro.marca` — com valor repetido, o banco recusaria por `23505`
      // ANTES de a política ou a chave composta serem consultadas, e o caso passaria a provar a
      // unicidade em vez do isolamento. Aqui isso vale em dobro, porque a unicidade atravessa as
      // duas empresas.
      //
      // `expira_em` fica no FUTURO e é composto pelo relógio do BANCO (ADR-0026), nunca por um
      // `Date` do processo: o prazo não é o que este caso mede, e fixá-lo pelo relógio do Node
      // reintroduziria a dependência de fuso que a `0014` existe para remover.
      const resultado = await tx`
        INSERT INTO negocio.portador_de_confirmacao
                    (id, empresa_id, locatario_id, derivado, expira_em)
        VALUES (${dados.id}, ${dados.empresaId}, ${dados.locatarioId},
                ${`derivado-${dados.marca}`}, pg_catalog.now() + interval '1 day')
      `;
      return resultado.count;
    },
  },
];

/** As duas relações tenantizadas do CT-304, tomadas da lista acima — nunca redeclaradas. */
const ENTIDADE_CONJUNTO = exigirEntidade('conjunto');
const ENTIDADE_IMOVEL = exigirEntidade('imovel');
const ENTIDADE_COMODO = exigirEntidade('comodo');

function exigirEntidade(nome: string): EntidadeDeCadastro {
  const entidade = ENTIDADES_DE_CADASTRO.find((candidata) => candidata.nome === nome);
  if (entidade === undefined) {
    throw new Error(`entidade de cadastro '${nome}' não está declarada em ENTIDADES_DE_CADASTRO`);
  }
  return entidade;
}

/** Os identificadores semeados de cada empresa, para a conferência de interseção do CT-302. */
const IDS_SEMEADOS_EM_A = Object.values(CADASTROS_DE_A);
const IDS_SEMEADOS_EM_B = Object.values(CADASTROS_DE_B);

/**
 * Cria, sob o contexto da PRÓPRIA empresa, uma linha descartável de cada entidade.
 *
 * Tudo numa unidade só, na ordem pai → filho: a chave estrangeira composta exige que o conjunto
 * exista antes do imóvel, e o imóvel antes do cômodo.
 */
async function semearCadastros(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  empresaId: string,
  ids: Record<string, string>,
  marca: string,
): Promise<void> {
  await contextoDeTenant.executarCom(contexto, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      for (const entidade of ENTIDADES_DE_CADASTRO) {
        await entidade.gravar(tx, {
          id: idDe(ids, entidade.nome),
          empresaId,
          conjuntoId: ids.conjunto ?? '',
          imovelId: ids.imovel ?? '',
          locadorId: ids.locador ?? '',
          locatarioId: ids.locatario ?? '',
          contratoId: ids.contrato ?? '',
          fiadorId: ids.fiador ?? '',
          posicao: POSICAO_SEMEADA,
          marca: `${entidade.nome}-${marca}`,
        });
      }
    });
  });
}

/**
 * Remove toda linha descartável de cadastro, **pelo identificador** — nunca por `empresa_id`, que é
 * o filtro que a ADR-0008 proíbe à aplicação. Rodada nos dois contextos porque, com o isolamento
 * íntegro, cada linha só é alcançável pelo contexto da sua própria empresa; e na ordem filho → pai,
 * para que nenhuma remoção esbarre numa chave estrangeira.
 */
async function limparCadastros(cadeiaDeConexao: string): Promise<void> {
  const acesso = abrir(cadeiaDeConexao);
  try {
    for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
      await contextoDeTenant.executarCom(contexto, async () => {
        await acesso.emUnidadeDeTrabalho(async (tx) => {
          for (const entidade of [...ENTIDADES_DE_CADASTRO].reverse()) {
            for (const id of entidade.descartaveis) {
              await tx.unsafe(`DELETE FROM ${entidade.relacao} WHERE id = $1`, [id]);
            }
          }
        });
      });
    }
  } finally {
    await acesso.encerrar();
  }
}

/** Lê os identificadores de uma entidade sob o contexto dado, pela consulta DECLARADA dela. */
async function lerCadastros(
  acesso: AcessoAoBanco,
  entidade: EntidadeDeCadastro,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<string[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<{ id: string }[]>(entidade.consulta);
      return linhas.map((linha) => linha.id);
    }),
  );
}

/** Uma entrada por entidade, no formato `<rótulo>: <detalhe>`. */
function comoLinha(rotulo: string, detalhe: string): string {
  return `${rotulo}: ${detalhe}`;
}

/** Uma entrada por entidade, no formato `<entidade>: <conjunto ordenado>`. */
function porEntidade(nome: string, valores: readonly string[]): string {
  return comoLinha(nome, comoTexto(valores));
}

/**
 * O identificador descartável de uma entidade, ou uma falha que a NOMEIA.
 *
 * Devolver cadeia vazia para a entidade ausente faria a gravação recusar por identificador
 * malformado, e o caso reprovaria longe da causa.
 */
function idDe(ids: Record<string, string>, nome: string): string {
  const id = ids[nome];
  if (id === undefined) {
    throw new Error(`sem identificador descartável para a entidade '${nome}'`);
  }
  return id;
}

/**
 * O estado das nove relações sob um contexto, comparável **caractere a caractere**.
 *
 * Carrega o identificador E a coluna livre: sem a segunda, uma atualização cruzada que tivesse
 * passado não moveria o retrato, e "nada mudou" ficaria verde sobre uma escrita que mudou tudo.
 */
async function retratoDosCadastros(acesso: AcessoAoBanco, contexto: Contexto): Promise<string> {
  const partes: string[] = [];
  for (const entidade of ENTIDADES_DE_CADASTRO) {
    const linhas = await contextoDeTenant.executarCom(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) =>
        tx.unsafe<{ id: string; livre: string | null }[]>(entidade.consultaDoRetrato),
      ),
    );
    partes.push(
      `${entidade.nome}: ${JSON.stringify(linhas.map((linha) => [linha.id, linha.livre]))}`,
    );
  }
  return partes.join(' | ');
}

/** O desfecho de uma tentativa de gravação, como texto comparável — o código E a mensagem. */
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

/** O desfecho de uma tentativa de referência — o código E o nome da restrição que recusou. */
function desfechoDaReferencia(tentativa: Resultado<number>): string {
  if (tentativa.ok) {
    return `GRAVOU (${tentativa.valor} linha(s))`;
  }
  const codigo = sqlstate(tentativa.erro) ?? 'sem sqlstate';
  return `${codigo} · ${nomeDaRestricao(tentativa.erro) ?? 'sem restrição nomeada'}`;
}

/**
 * As duas escritas que o CT-303 tenta sobre a linha ALHEIA já existente.
 *
 * Elas são declaradas como valor, e não escritas no meio do caso, pelo mesmo motivo das consultas
 * de leitura: o `WHERE` é por IDENTIFICADOR, nunca por `empresa_id` — o filtro que a ADR-0008
 * proíbe à aplicação. A coluna atualizada é a livre de cada entidade, que não participa de
 * restrição de unicidade alguma.
 */
type EscritaSobreLinha = 'UPDATE' | 'DELETE';

/** O texto que a atualização cruzada tenta gravar. Distinto do semeado, senão "não mudou" seria vácuo. */
const TEXTO_DA_ESCRITA_CRUZADA = 'tocado por quem não deveria alcançar';

async function tentarEscreverEmLinhaAlheia(
  acesso: AcessoAoBanco,
  entidade: EntidadeDeCadastro,
  contexto: Contexto,
  id: string,
  verbo: EscritaSobreLinha,
): Promise<Resultado<number>> {
  const instrucao =
    verbo === 'UPDATE'
      ? `UPDATE ${entidade.relacao} SET ${entidade.colunaLivre} = $2 WHERE id = $1`
      : `DELETE FROM ${entidade.relacao} WHERE id = $1`;
  const parametros =
    verbo === 'UPDATE' ? [id, entidade.valorDaEscritaCruzada ?? TEXTO_DA_ESCRITA_CRUZADA] : [id];

  return tentar(() =>
    contextoDeTenant.executarCom(contexto, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        const resultado = await tx.unsafe(instrucao, parametros);
        return resultado.count;
      }),
    ),
  );
}

/** Quantas linhas a escrita alcançou — ou o erro, quando ela nem chegou a contar. */
function desfechoDaEscritaSobreLinha(tentativa: Resultado<number>): string {
  return tentativa.ok
    ? `${tentativa.valor} linha(s)`
    : `erro ${sqlstate(tentativa.erro) ?? '?'} ${mensagemDo(tentativa.erro)}`;
}

// ---------------------------------------------------------------------------
// Os conjuntos ESPERADOS — literais do caso, entidade a entidade
// ---------------------------------------------------------------------------

const ESPERADO_SOB_A: readonly string[] = [
  porEntidade('conjunto', [CADASTROS_DE_A.conjunto]),
  porEntidade('imovel', [CADASTROS_DE_A.imovel]),
  porEntidade('comodo', [CADASTROS_DE_A.comodo]),
  porEntidade('locador', [CADASTROS_DE_A.locador]),
  porEntidade('locatario', [CADASTROS_DE_A.locatario]),
  porEntidade('fiador', [CADASTROS_DE_A.fiador]),
  porEntidade('contrato', [CADASTROS_DE_A.contrato]),
  porEntidade('contrato_fiador', [CADASTROS_DE_A.contrato_fiador]),
  porEntidade('portador_de_confirmacao', [CADASTROS_DE_A.portador_de_confirmacao]),
];

const ESPERADO_SOB_B: readonly string[] = [
  porEntidade('conjunto', [CADASTROS_DE_B.conjunto]),
  porEntidade('imovel', [CADASTROS_DE_B.imovel]),
  porEntidade('comodo', [CADASTROS_DE_B.comodo]),
  porEntidade('locador', [CADASTROS_DE_B.locador]),
  porEntidade('locatario', [CADASTROS_DE_B.locatario]),
  porEntidade('fiador', [CADASTROS_DE_B.fiador]),
  porEntidade('contrato', [CADASTROS_DE_B.contrato]),
  porEntidade('contrato_fiador', [CADASTROS_DE_B.contrato_fiador]),
  porEntidade('portador_de_confirmacao', [CADASTROS_DE_B.portador_de_confirmacao]),
];

/** As nove relações sem linha alcançável. Escrito por extenso: o nome de cada uma importa. */
const NOVE_LISTAS_VAZIAS: readonly string[] = [
  porEntidade('conjunto', []),
  porEntidade('imovel', []),
  porEntidade('comodo', []),
  porEntidade('locador', []),
  porEntidade('locatario', []),
  porEntidade('fiador', []),
  porEntidade('contrato', []),
  porEntidade('contrato_fiador', []),
  porEntidade('portador_de_confirmacao', []),
];

/** As nove escritas cruzadas que não alcançam linha nenhuma — zero linhas, e nunca erro. */
const NOVE_ESCRITAS_SEM_EFEITO: readonly string[] = [
  'conjunto: 0 linha(s)',
  'imovel: 0 linha(s)',
  'comodo: 0 linha(s)',
  'locador: 0 linha(s)',
  'locatario: 0 linha(s)',
  'fiador: 0 linha(s)',
  'contrato: 0 linha(s)',
  'contrato_fiador: 0 linha(s)',
  'portador_de_confirmacao: 0 linha(s)',
];

/** Grava uma linha de cadastro sob o contexto informado, coletando o desfecho em vez de abortar. */
async function tentarGravarCadastro(
  acesso: AcessoAoBanco,
  entidade: EntidadeDeCadastro,
  contexto: Contexto,
  dados: DadosDeCadastro,
): Promise<Resultado<number>> {
  return tentar(() =>
    contextoDeTenant.executarCom(contexto, async () =>
      acesso.emUnidadeDeTrabalho((tx) => entidade.gravar(tx, dados)),
    ),
  );
}

// ===========================================================================
// CT-522 · CT-523 — a cobrança, e o que a VISÃO derivada devolve a cada empresa
// ===========================================================================
//
// Os dois não entram em `rodarBateria`, pela razão já registrada para o CT-207 e para os
// CT-302/303/304: a bateria afirma o conjunto EXATO de predicados reprovados por mutante do CT-007,
// e acrescentar predicados mudaria o esperado dos quatro mutantes — nenhum dos quais tem relação
// com estas relações.
//
// O que eles provam, e que nenhum caso anterior alcança, é a **visão**. Até aqui todo objeto de
// `negocio` era tabela, e o isolamento vinha da política dela; `negocio.cobranca_derivada` é o
// primeiro objeto DERIVADO do produto (ADR-0023), e ele delega o isolamento às tabelas-base em vez
// de ter política própria. A delegação tem exatamente um mecanismo — `security_invoker = true` — e
// duas vias independentes de detecção, que é o par CT-522 (comportamento) + CT-523 (a guarda de
// catálogo, mais o vazamento com o atributo removido).
//
// A montagem de cadastro é a MESMA dos CT-302/303/304 (`semearCadastros`/`limparCadastros`): a
// cobrança aponta para o contrato pelo par `(contrato_id, empresa_id)`, de modo que o contrato de
// cada empresa precisa existir antes dela.

/** A cobrança descartável de cada empresa, e a que serve à falsificação do CT-523. */
const COBRANCA_DE_A = 'dddddddd-8888-4000-8000-000000000001';
const COBRANCA_DE_B = 'dddddddd-8888-4000-8000-000000000002';

/** A política de mora descartável de cada empresa. */
const MORA_DE_A = 'dddddddd-9999-4000-8000-000000000001';
const MORA_DE_B = 'dddddddd-9999-4000-8000-000000000002';

/**
 * A política de cada empresa, DEZ VEZES distinta uma da outra.
 *
 * O fator dez não é estético: com percentuais próximos, uma apuração que tomasse a configuração
 * alheia produziria valores parecidos, e a asserção literal poderia passar por coincidência de
 * arredondamento. Com `2%` contra `10%`, qualquer troca aparece na primeira casa.
 */
const MULTA_DE_A = '2.00';
const JUROS_DE_A = '1.00';
const MULTA_DE_B = '10.00';
const JUROS_DE_B = '5.00';

/** O valor original das duas cobranças — IDÊNTICO, para que a única variável seja a política. */
const VALOR_DA_COBRANCA = '2000.00';

/** Quantos dias antes da data corrente da operação as duas cobranças venceram. */
const DIAS_DE_ATRASO = 30;

/**
 * A mora esperada de cada empresa, apurada à mão a partir da fórmula do oráculo
 * (`golden/calcular-mora.json`) e escrita como literal — nunca recalculada no caso.
 *
 * Recalcular aqui reimplementaria a expressão da visão no teste, e o par passaria a se conferir
 * contra uma cópia de si mesmo: é o defeito que a `.claude/rules/testing-stack.md` registra como o
 * pior dos três da F0. Os números vêm da conta feita uma vez, com papel:
 *
 *   * A — multa `2000,00 × 2% = 40,00`; juros `2000,00 × 1%/30 × 30 = 20,00`; total `2 060,00`;
 *   * B — multa `2000,00 × 10% = 200,00`; juros `2000,00 × 5%/30 × 30 = 100,00`; total `2 300,00`.
 *
 * O caso de trinta dias é, além disso, o `juros_um_mes_e_exatamente_a_taxa_mensal` do golden: um mês
 * de atraso rende exatamente a taxa mensal sobre o valor original.
 */
const MORA_ESPERADA_DE_A = {
  valorMulta: '40.00',
  valorJuros: '20.00',
  valorTotal: '2060.00',
} as const;

const MORA_ESPERADA_DE_B = {
  valorMulta: '200.00',
  valorJuros: '100.00',
  valorTotal: '2300.00',
} as const;

/** O nome da visão, escrito UMA vez: ele é lido, recriado e nomeado na exceção da guarda. */
const VISAO_DERIVADA = 'negocio.cobranca_derivada';

/**
 * A leitura da visão, **declarada como valor** para que a ausência de filtro por empresa seja
 * CONFERIDA e não apenas prometida (ADR-0008) — mesmo mecanismo de {@link CONSULTAS_DE_NEGOCIO} e
 * de {@link EntidadeDeCadastro.consulta}.
 */
const CONSULTA_DA_DERIVADA =
  'SELECT id, codigo, status::text AS status, dias_atraso AS "diasAtraso", ' +
  'valor_multa AS "valorMulta", valor_juros AS "valorJuros", valor_total AS "valorTotal", ' +
  `contrato_codigo AS "contratoCodigo" FROM ${VISAO_DERIVADA} ORDER BY id`;

/** Uma linha da visão, como o driver a devolve: `numeric` vem como texto, `integer` como número. */
interface LinhaDerivada {
  readonly id: string;
  readonly codigo: string;
  readonly status: string;
  readonly diasAtraso: number;
  readonly valorMulta: string;
  readonly valorJuros: string;
  readonly valorTotal: string;
  readonly contratoCodigo: string;
}

/**
 * Semeia, sob o contexto da PRÓPRIA empresa, a política de mora e uma cobrança vencida.
 *
 * O vencimento é composto a partir de `negocio.data_corrente_da_operacao()`, e não de um `Date` do
 * processo: fixá-lo pelo relógio do Node reintroduziria no caso exatamente a dependência do fuso da
 * sessão que aquela função existe para remover, e o caso passaria a virar por volta da meia-noite
 * conforme o fuso de quem o roda. O que este caso mede é o ISOLAMENTO e a origem da política — a
 * fronteira do vencimento é do CT-513, na T4.
 */
async function semearCobranca(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  empresaId: string,
  cobrancaId: string,
  moraId: string,
  contratoId: string,
  multaPercentual: string,
  jurosPercentual: string,
): Promise<void> {
  await contextoDeTenant.executarCom(contexto, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.configuracao_de_mora
                    (id, empresa_id, multa_percentual, juros_percentual)
        VALUES (${moraId}, ${empresaId}, ${multaPercentual}, ${jurosPercentual})
      `;
      await tx`
        INSERT INTO negocio.cobranca
                    (id, empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                     data_vencimento, valor_original)
        VALUES (${cobrancaId}, ${empresaId}, ${`COB-2026-${cobrancaId.slice(-7)}`}, ${contratoId},
                ${'ALUGUEL'}::negocio.natureza_cobranca, ${'01/01/2026 à 31/01/2026'},
                ${'2026-01-01'}::date,
                negocio.data_corrente_da_operacao() - ${DIAS_DE_ATRASO}::integer,
                ${VALOR_DA_COBRANCA})
      `;
    });
  });
}

/**
 * Remove as linhas descartáveis de cobrança e de mora, **pelo identificador** — nunca por
 * `empresa_id`, que é o filtro que a ADR-0008 proíbe à aplicação.
 *
 * Corre nos DOIS contextos, porque com o isolamento íntegro cada linha só é alcançável pelo contexto
 * da própria empresa; e ANTES de `limparCadastros`, porque a cobrança referencia o contrato.
 */
async function limparCobrancas(cadeiaDeConexao: string): Promise<void> {
  const acesso = abrir(cadeiaDeConexao);
  try {
    for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
      await contextoDeTenant.executarCom(contexto, async () => {
        await acesso.emUnidadeDeTrabalho(async (tx) => {
          for (const id of [COBRANCA_DE_A, COBRANCA_DE_B]) {
            await tx`DELETE FROM negocio.cobranca WHERE id = ${id}`;
          }
          for (const id of [MORA_DE_A, MORA_DE_B]) {
            await tx`DELETE FROM negocio.configuracao_de_mora WHERE id = ${id}`;
          }
        });
      });
    }
  } finally {
    await acesso.encerrar();
  }
}

/** Lê a visão derivada sob o contexto dado, pela consulta DECLARADA acima. */
async function lerDerivada(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<LinhaDerivada[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<LinhaDerivada[]>(CONSULTA_DA_DERIVADA);
      return linhas.map((linha) => ({ ...linha }));
    }),
  );
}

/** Semeia cadastro e cobrança das DUAS empresas, cada uma sob o próprio contexto. */
async function semearAsDuasCarteiras(acesso: AcessoAoBanco): Promise<void> {
  await semearCadastros(acesso, CONTEXTO_DE_A, EMPRESA_A.id, CADASTROS_DE_A, 'a');
  await semearCadastros(acesso, CONTEXTO_DE_B, EMPRESA_B.id, CADASTROS_DE_B, 'b');
  await semearCobranca(
    acesso,
    CONTEXTO_DE_A,
    EMPRESA_A.id,
    COBRANCA_DE_A,
    MORA_DE_A,
    CADASTROS_DE_A.contrato,
    MULTA_DE_A,
    JUROS_DE_A,
  );
  await semearCobranca(
    acesso,
    CONTEXTO_DE_B,
    EMPRESA_B.id,
    COBRANCA_DE_B,
    MORA_DE_B,
    CADASTROS_DE_B.contrato,
    MULTA_DE_B,
    JUROS_DE_B,
  );
}

// ===========================================================================
// CT-607 — a régua: a política de aviso e o registro de envios de cada empresa
// ===========================================================================
//
// Ele não entra em `rodarBateria`, pela razão já registrada para o CT-207, para os CT-302/303/304 e
// para o CT-522: a bateria afirma o conjunto EXATO de predicados reprovados por mutante do CT-007, e
// acrescentar predicados mudaria o esperado dos quatro mutantes — nenhum dos quais tem relação com
// estas duas relações.
//
// O que ele prova, e que nenhum caso anterior alcança, são as DUAS tabelas da migração `0011`. O
// isolamento desta suíte é auditado **por conjunto, e não por amostra**: relação de `negocio` sem
// entrada aqui é relação sem prova comportamental de isolamento, e é exatamente a lacuna que o
// CT-302/303/304 fechou para o cadastro e o CT-522 para a cobrança.
//
// A montagem reusa `semearAsDuasCarteiras`: o registro de envio aponta para a cobrança pelo par
// `(cobranca_id, empresa_id)`, de modo que a cobrança de cada empresa — e, antes dela, o contrato —
// precisa existir.

/** A política de aviso descartável de cada empresa, e a que a tentativa cruzada usaria. */
const POLITICA_DE_A = 'dddddddd-aaaa-4000-8000-000000000001';
const POLITICA_DE_B = 'dddddddd-aaaa-4000-8000-000000000002';
const POLITICA_CRUZADA = 'dddddddd-aaaa-4000-8000-000000000003';

/** Os três envios da empresa A — um por desfecho — e o que a tentativa cruzada usaria. */
const ENVIO_ENTREGUE_EM_A = 'dddddddd-bbbb-4000-8000-000000000001';
const ENVIO_FALHO_EM_A = 'dddddddd-bbbb-4000-8000-000000000002';
const ENVIO_SEM_ENDERECO_EM_A = 'dddddddd-bbbb-4000-8000-000000000003';
const ENVIO_CRUZADO = 'dddddddd-bbbb-4000-8000-000000000004';

/**
 * A política que a empresa A grava, com valor DISTINTO do padrão em cada campo.
 *
 * A distinção é o que dá poder ao passo final: com os padrões da migração (`false`, `0`, `1`,
 * `00:00`, `23:59`), "a política de A permanece intacta" ficaria verde também sobre uma linha que
 * tivesse sido recriada do zero por uma escrita alheia.
 */
const POLITICA_GRAVADA_EM_A = {
  ativo: true,
  diasAntesDoVencimento: 3,
  intervaloMinimoDias: 7,
  janelaInicio: '09:00',
  janelaFim: '18:00',
  canal: 'EMAIL',
} as const;

/**
 * Os três envios da empresa A, um por desfecho — e a `causa` pareada com cada um.
 *
 * Os três desfechos estão presentes de propósito: `envio_de_cobranca_causa_chk` é BICONDICIONAL, e
 * uma semeadura só com `ENVIADA` deixaria a metade "falha COM causa" sem exercício nenhum. O
 * `destinatario` de `SEM_DESTINATARIO` é **cadeia vazia**, que é o contrato da RD-11.
 */
const ENVIOS_DE_A = [
  {
    id: ENVIO_ENTREGUE_EM_A,
    caminho: 'AUTOMATICO',
    desfecho: 'ENVIADA',
    destinatario: 'locatario.a@exemplo.com.br',
    causa: null,
  },
  {
    id: ENVIO_FALHO_EM_A,
    caminho: 'AUTOMATICO',
    desfecho: 'FALHOU',
    destinatario: 'locatario.a@exemplo.com.br',
    causa: 'o servidor de correio recusou a mensagem',
  },
  {
    id: ENVIO_SEM_ENDERECO_EM_A,
    caminho: 'MANUAL',
    desfecho: 'SEM_DESTINATARIO',
    destinatario: '',
    causa: 'o locatário não tem endereço de correio cadastrado',
  },
] as const;

/**
 * As leituras da régua, **declaradas como valor** para que a ausência de filtro por empresa seja
 * CONFERIDA e não apenas prometida (ADR-0008) — mesmo mecanismo de {@link CONSULTAS_DE_NEGOCIO} e de
 * {@link CONSULTA_DA_DERIVADA}.
 *
 * Os dois horários saem por `to_char(coluna, 'HH24:MI')`, e não crus: a coluna é `time`, o driver
 * devolveria `'09:00:00'`, e o molde ancorado que `esquemaDaPoliticaDeAviso` publica recusa essa
 * forma. A decisão está por extenso no cabeçalho da tabela em `src/esquema/negocio.ts` e tem prova
 * própria no CT-608 — aqui ela é apenas OBEDECIDA, para que o retrato comparado seja o mesmo que a
 * porta de leitura da T5 vai produzir.
 */
const CONSULTA_DA_POLITICA_DE_AVISO =
  'SELECT id, ativo, dias_antes_do_vencimento AS "diasAntesDoVencimento", ' +
  'intervalo_minimo_dias AS "intervaloMinimoDias", ' +
  `to_char(janela_inicio, 'HH24:MI') AS "janelaInicio", ` +
  `to_char(janela_fim, 'HH24:MI') AS "janelaFim", ` +
  'canal::text AS canal FROM negocio.politica_de_aviso ORDER BY id';

const CONSULTA_DOS_ENVIOS =
  'SELECT id, caminho::text AS caminho, desfecho::text AS desfecho, destinatario, causa ' +
  'FROM negocio.envio_de_cobranca ORDER BY id';

/** As duas contagens CRUAS — `count(*)` sem projeção nenhuma, que é o que mede invisibilidade. */
const CONTAGEM_DE_POLITICAS = 'SELECT count(*)::integer AS total FROM negocio.politica_de_aviso';
const CONTAGEM_DE_ENVIOS = 'SELECT count(*)::integer AS total FROM negocio.envio_de_cobranca';

/** A política como o retrato a compara — a linha inteira, e não campo a campo. */
interface LinhaDePolitica {
  readonly id: string;
  readonly ativo: boolean;
  readonly diasAntesDoVencimento: number;
  readonly intervaloMinimoDias: number;
  readonly janelaInicio: string;
  readonly janelaFim: string;
  readonly canal: string;
}

/** Um envio como o retrato o compara. */
interface LinhaDeEnvio {
  readonly id: string;
  readonly caminho: string;
  readonly desfecho: string;
  readonly destinatario: string;
  readonly causa: string | null;
}

/** Semeia, sob o contexto da PRÓPRIA empresa, a política de aviso e os três envios. */
async function semearReguaDeA(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.politica_de_aviso
                    (id, empresa_id, ativo, dias_antes_do_vencimento, intervalo_minimo_dias,
                     janela_inicio, janela_fim, canal)
        VALUES (${POLITICA_DE_A}, ${EMPRESA_A.id}, ${POLITICA_GRAVADA_EM_A.ativo},
                ${POLITICA_GRAVADA_EM_A.diasAntesDoVencimento},
                ${POLITICA_GRAVADA_EM_A.intervaloMinimoDias},
                ${POLITICA_GRAVADA_EM_A.janelaInicio}::time,
                ${POLITICA_GRAVADA_EM_A.janelaFim}::time,
                ${POLITICA_GRAVADA_EM_A.canal}::negocio.canal_de_aviso)
      `;
      for (const envio of ENVIOS_DE_A) {
        await tx`
          INSERT INTO negocio.envio_de_cobranca
                      (id, empresa_id, cobranca_id, caminho, desfecho, destinatario, causa)
          VALUES (${envio.id}, ${EMPRESA_A.id}, ${COBRANCA_DE_A},
                  ${envio.caminho}::negocio.caminho_do_aviso,
                  ${envio.desfecho}::negocio.desfecho_do_aviso,
                  ${envio.destinatario}, ${envio.causa})
        `;
      }
    });
  });
}

/**
 * Remove as linhas descartáveis da régua, **pelo identificador** — nunca por `empresa_id`.
 *
 * Corre nos DOIS contextos, porque com o isolamento íntegro cada linha só é alcançável pelo contexto
 * da própria empresa; e ANTES de `limparCobrancas`, porque o envio referencia a cobrança.
 */
async function limparRegua(cadeiaDeConexao: string): Promise<void> {
  const acesso = abrir(cadeiaDeConexao);
  try {
    for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
      await contextoDeTenant.executarCom(contexto, async () => {
        await acesso.emUnidadeDeTrabalho(async (tx) => {
          for (const id of [...ENVIOS_DE_A.map((envio) => envio.id), ENVIO_CRUZADO]) {
            await tx`DELETE FROM negocio.envio_de_cobranca WHERE id = ${id}`;
          }
          for (const id of [POLITICA_DE_A, POLITICA_DE_B, POLITICA_CRUZADA]) {
            await tx`DELETE FROM negocio.politica_de_aviso WHERE id = ${id}`;
          }
        });
      });
    }
  } finally {
    await acesso.encerrar();
  }
}

/** Lê as duas relações da régua sob o contexto dado, pelas consultas DECLARADAS acima. */
async function lerRegua(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<{ politicas: LinhaDePolitica[]; envios: LinhaDeEnvio[] }> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const politicas = await tx.unsafe<LinhaDePolitica[]>(CONSULTA_DA_POLITICA_DE_AVISO);
      const envios = await tx.unsafe<LinhaDeEnvio[]>(CONSULTA_DOS_ENVIOS);
      return {
        politicas: politicas.map((linha) => ({ ...linha })),
        envios: envios.map((linha) => ({ ...linha })),
      };
    }),
  );
}

/** As duas contagens CRUAS sob o contexto dado — o que mede invisibilidade sem passar por projeção. */
async function contarRegua(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<{ politicas: number; envios: number }> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const [politicas] = await tx.unsafe<{ total: number }[]>(CONTAGEM_DE_POLITICAS);
      const [envios] = await tx.unsafe<{ total: number }[]>(CONTAGEM_DE_ENVIOS);
      return { politicas: politicas?.total ?? -1, envios: envios?.total ?? -1 };
    }),
  );
}

/**
 * As quatro escritas cruzadas que **alcançam linha existente da outra empresa** — e não devem
 * alcançar nenhuma.
 *
 * Elas são `UPDATE`/`DELETE` porque é o par que a política recusa **sem erro**: `USING` não casa a
 * linha, o comando afeta zero linhas e o cliente não recebe exceção alguma. A ausência de exceção é
 * conteúdo — um caso que só afirmasse "levantou" ficaria verde sobre um banco que recusasse tudo.
 *
 * O produto **não** atualiza nem apaga `negocio.envio_de_cobranca` em lugar nenhum (o registro é
 * fato, não cadastro): as duas linhas de envio abaixo existem para provar que **nem por esse
 * caminho** a linha alheia é alcançável, e não para descrever uma operação do produto.
 */
const ESCRITAS_CRUZADAS_NA_REGUA: readonly { readonly nome: string; readonly sql: string }[] = [
  {
    nome: 'politica/update',
    sql: `UPDATE negocio.politica_de_aviso SET ativo = false WHERE id = '${POLITICA_DE_A}'`,
  },
  {
    nome: 'politica/delete',
    sql: `DELETE FROM negocio.politica_de_aviso WHERE id = '${POLITICA_DE_A}'`,
  },
  {
    nome: 'envio/update',
    sql:
      "UPDATE negocio.envio_de_cobranca SET destinatario = 'invasor@exemplo.com.br' " +
      `WHERE id = '${ENVIO_ENTREGUE_EM_A}'`,
  },
  {
    nome: 'envio/delete',
    sql: `DELETE FROM negocio.envio_de_cobranca WHERE id = '${ENVIO_ENTREGUE_EM_A}'`,
  },
];

/** O retrato da régua de A, escrito por extenso — é ele que o passo final compara por igualdade. */
const REGUA_INTACTA_DE_A = {
  politicas: [{ id: POLITICA_DE_A, ...POLITICA_GRAVADA_EM_A }],
  envios: ENVIOS_DE_A.map((envio) => ({
    id: envio.id,
    caminho: envio.caminho,
    desfecho: envio.desfecho,
    destinatario: envio.destinatario,
    causa: envio.causa,
  })),
} as const;

/** O que o catálogo responde sobre a RLS de uma tabela — as duas metades, nunca só a primeira. */
interface EstadoDeRls {
  readonly tabela: string;
  readonly habilitada: boolean;
  readonly forcada: boolean;
}

/**
 * Lê `relrowsecurity` e `relforcerowsecurity` das duas tabelas novas.
 *
 * Ela existe DENTRO deste caso, e não só no CT-608, porque as duas metades respondem perguntas
 * diferentes: o comportamento cruzado acima ficaria verde sem `FORCE` (o papel da aplicação não é
 * dono das tabelas), e é o `FORCE` que impede uma suíte futura conectada com o dono de ficar verde
 * contra um schema sem isolamento (ADR-0008, Cons).
 */
async function lerEstadoDeRls(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  tabelas: readonly string[],
): Promise<EstadoDeRls[]> {
  return contextoDeTenant.executarCom(contexto, () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<EstadoDeRls[]>`
        SELECT c.relname                AS tabela,
               c.relrowsecurity         AS habilitada,
               c.relforcerowsecurity    AS forcada
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'negocio' AND c.relname = ANY(${tabelas as string[]})
         ORDER BY c.relname
      `;
      return linhas.map((linha) => ({ ...linha }));
    }),
  );
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
  // T3 da fatia `autorizacao-e-ciclo-de-acesso` — módulo NOVO que compõe e emite consulta, que é o
  // critério declarado acima para entrar nesta lista. Ele também é o alvo declarado da asserção
  // estática do CT-209, que procura outra coisa: aqui se procura ramo por perfil, lá se procura
  // comparação por empresa. As duas varreduras são independentes de propósito — um alcance único
  // com dois predicados faria a falsificação de uma provar a da outra.
  'db/src/permissao.ts',
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
// CT-209 — o efetivo é montado sob RLS, sem filtro por empresa na aplicação
// ===========================================================================

/**
 * O vínculo sobre o qual o caso semeia os ajustes.
 *
 * É o **segundo** da empresa A de propósito: o primeiro (`ACESSO_A_1`) carrega a permissão legítima
 * do CT-006, cujo conjunto é asserido por igualdade. Semear no mesmo vínculo tornaria os dois casos
 * dependentes da ordem de execução.
 */
const VINCULO_DO_EFETIVO = ACESSOS_DA_EMPRESA_A[1]?.id ?? '';
const PESSOA_DO_EFETIVO = ACESSOS_DA_EMPRESA_A[1]?.usuarioId ?? '';

/**
 * Um catálogo de três chaves, no lugar do catálogo de `@sysloc/auth`.
 *
 * O predicado de pertinência entra por parâmetro em produção porque `@sysloc/auth` **depende** de
 * `@sysloc/db`, e não o contrário (ver o cabeçalho de `src/permissao.ts`). O daqui tem a **mesma
 * assinatura** de `ehChaveDoCatalogo` — recebe `unknown` e estreita —, de modo que o caso exercita a
 * composição exatamente como a guarda de `apps/api` a fará.
 */
const CHAVES_CONHECIDAS = ['TELA:financeiro', 'TELA:relatorios', 'ACAO:emitir_boleto'] as const;

type ChaveConhecida = (typeof CHAVES_CONHECIDAS)[number];

const CATALOGO_DO_CASO: ReadonlySet<unknown> = new Set<string>(CHAVES_CONHECIDAS);

function ehChaveConhecida(valor: unknown): valor is ChaveConhecida {
  return CATALOGO_DO_CASO.has(valor);
}

/**
 * A chave **órfã**: gravada no banco e ausente do catálogo corrente.
 *
 * É a forma exata do risco que a Revisão Técnica da T2 encaminhou para a T3 — chave de um catálogo
 * anterior, removida do código e ainda gravada, entrando no efetivo por uma leitura crua e saindo
 * publicada em `GET /v1/sessao`. Ela existe aqui para que "a leitura descarta" seja afirmação
 * comportamental, e não promessa do comentário.
 */
const CHAVE_ORFA = 'TELA:tela_extinta';

/** Os quatro ajustes semeados: as três do catálogo do caso, mais a órfã. */
const AJUSTES_DO_EFETIVO: readonly AjustePersistido[] = [
  { chave: 'TELA:financeiro', efeito: 'CONCEDIDA' },
  { chave: 'TELA:relatorios', efeito: 'CONCEDIDA' },
  { chave: 'ACAO:emitir_boleto', efeito: 'NEGADA' },
  { chave: CHAVE_ORFA, efeito: 'CONCEDIDA' },
];

/** O que a leitura deve devolver sob o contexto que ENXERGA o vínculo. */
const EFETIVO_VISIVEL = {
  ajustes: [
    { chave: 'ACAO:emitir_boleto', efeito: 'NEGADA' },
    { chave: 'TELA:financeiro', efeito: 'CONCEDIDA' },
    { chave: 'TELA:relatorios', efeito: 'CONCEDIDA' },
  ],
  chavesDesconhecidas: [CHAVE_ORFA],
} as const;

/** O que ela deve devolver sob QUALQUER contexto que não o enxergue. Vazio, e nunca erro. */
const EFETIVO_INVISIVEL = { ajustes: [], chavesDesconhecidas: [] } as const;

/**
 * A coerência entre os eixos NÃO é o objeto deste caso — ela é do CT-205, em `@sysloc/auth`.
 * A regra que a semeadura passa apenas aceita, para que o caso exercite o caminho real de escrita
 * sem reimplementar a regra de domínio dentro do verificador.
 */
function aceitarQualquerAjuste(): void {
  // Nada a fazer: aceitar é o comportamento declarado desta regra de semeadura.
}

/** Leitura comparável: o objeto devolvido, achatado para igualdade estrutural. */
function comoObjeto(leitura: AjustesDaPessoa): {
  ajustes: { chave: string; efeito: string }[];
  chavesDesconhecidas: string[];
} {
  return {
    ajustes: leitura.ajustes.map((ajuste) => ({ chave: ajuste.chave, efeito: ajuste.efeito })),
    chavesDesconhecidas: [...leitura.chavesDesconhecidas],
  };
}

async function lerEfetivo(
  acesso: AcessoAoBanco,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<AjustesDaPessoa<ChaveConhecida>> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho((tx) => lerAjustesDaPessoa(tx, PESSOA_DO_EFETIVO, ehChaveConhecida)),
  );
}

/** Remove só o que este caso gravou, pelo vínculo — nunca por `empresa_id` (ADR-0008). */
async function limparEfetivo(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`DELETE FROM negocio.acesso_usuario_permissao WHERE acesso_id = ${VINCULO_DO_EFETIVO}`;
      await tx`
        UPDATE identidade.usuario SET versao_permissoes = 0 WHERE id = ${PESSOA_DO_EFETIVO}
      `;
    });
  });
}

// ---------------------------------------------------------------------------
// A asserção ESTÁTICA do CT-209 — comparação por empresa na cláusula de filtro
// ---------------------------------------------------------------------------

/**
 * O fonte que lê e grava o ajuste — o alvo declarado, arquivo a arquivo.
 *
 * Declarado, e não "o diretório `src/`": arquivo renomeado faz `readFile` levantar, em vez de
 * reduzir a varredura a zero em silêncio (`varredura-de-fontes.ts`).
 */
const FONTE_DO_EFETIVO = ['db/src/permissao.ts'] as const;

function arquivosDoEfetivo(raizDePacotes: string): string[] {
  return FONTE_DO_EFETIVO.map((relativo) => join(raizDePacotes, relativo));
}

/** A coluna de tenant, nas duas grafias que o módulo poderia usar — a do SQL e a do domínio. */
const COLUNA_DE_EMPRESA = /empresa_?id/i;

/**
 * O que transforma a MENÇÃO à coluna em CLÁUSULA DE FILTRO: um operador de comparação.
 *
 * A distinção é a razão de o predicado ter duas partes, e não uma. O módulo **menciona**
 * `empresa_id` em dois lugares legítimos — a lista de colunas do `INSERT` e o item de projeção
 * `SELECT a.empresa_id`, que carrega o valor do PAI para a linha-filha sem que ele passe pela
 * aplicação. Um predicado que casasse a simples menção reprovaria o código correto, e detector que
 * reprova o correto é detector desligado na rodada seguinte. Um que exigisse a palavra `WHERE` na
 * mesma linha deixaria passar o `AND a.empresa_id = …` da linha de baixo, que é a forma em que o
 * filtro de fato reaparece.
 */
const COMPARACAO_SQL = /={1,3}|!==?|<>|\bin\b|\bany\b/i;

function ehFiltroPorEmpresa(linha: string): boolean {
  return COLUNA_DE_EMPRESA.test(linha) && COMPARACAO_SQL.test(linha);
}

function varrerFiltroPorEmpresa(arquivos: readonly string[]): Promise<VarreduraDeFontes> {
  return varrerArquivos(arquivos, ehFiltroPorEmpresa);
}

/**
 * Monta a marca de interpolação em vez de escrevê-la.
 *
 * O texto produzido é idêntico ao do fonte — que é o que o mutante precisa casar —, e a montagem
 * evita plantar `${…}` numa cadeia comum deste arquivo, pela mesma razão que o controle negativo do
 * CT-005 já registra ao trocar a interpolação por nome literal.
 */
function interpolacao(nome: string): string {
  return `$\{${nome}}`;
}

/**
 * A cláusula que o mutante reintroduz, e o trecho real em que ela entra.
 *
 * O mutante **altera a consulta de verdade** — não acrescenta uma função inventada ao fim do
 * arquivo. É a diferença entre provar que o detector reconhece um filtro qualquer e provar que ele
 * reconhece o filtro **na forma em que o defeito voltaria**: dentro da leitura que monta o efetivo.
 */
const TRECHO_ALVO_DO_MUTANTE = `WHERE a.usuario_id = ${interpolacao('usuarioId')}`;
const FILTRO_REINTRODUZIDO = `AND a.empresa_id = ${interpolacao('empresaId')}`;

/**
 * As quatro formas em que a comparação por empresa de fato reapareceria: SQL na cláusula, SQL
 * invertida, filtro escrito em TypeScript e conjunto.
 *
 * São a ENTRADA do controle negativo e também o ESPERADO dele — a mesma lista nas duas pontas, para
 * que uma forma acrescentada aqui tenha de ser detectada, e não apenas escrita no gabarito.
 */
const LINHAS_COM_FILTRO = [
  `const a = \`AND a.empresa_id = ${interpolacao('empresaId')}\`;`,
  `const b = \`AND ${interpolacao('empresaId')} = a.empresa_id\`;`,
  'const c = linhas.filter((l) => l.empresaId === empresaId);',
  `const d = \`AND p.empresa_id IN (${interpolacao('lista')})\`;`,
] as const;

// ---------------------------------------------------------------------------
// O companheiro NEGATIVO de tenant do lado da ESCRITA
// ---------------------------------------------------------------------------

/**
 * Por que este bloco existe, e por que ele NÃO é redundante com o CT-209 acima.
 *
 * O CT-209 prova a invisibilidade da **leitura** (3 em A, 0 em B, 0 sem contexto) e, pela varredura,
 * a ausência de comparação por empresa no fonte. Nenhuma das duas alcança o modo de falha das
 * **escritas**: elas gravam em `identidade.usuario`, que **não tem RLS** (ADR-0009), e só ficam
 * escopadas porque alcançam a pessoa **através do vínculo** em `negocio.acesso_usuario_app`, que
 * está sob a política. Trocar `FROM negocio.acesso_usuario_app AS a WHERE a.usuario_id = u.id` por
 * um `WHERE u.id = $1` sozinho — a forma que o cabeçalho de `src/permissao.ts` nomeia e proíbe —
 * faz a escrita alcançar pessoa de qualquer empresa, e a asserção estática nada acusa: ela procura a
 * **presença** de comparação por `empresa_id`, e este defeito é a **ausência** do alcance pelo pai.
 *
 * Daí a forma do caso: o produto cartesiano {três escritas} × {contexto de B, contexto ausente}, com
 * as **duas pernas** por célula — o erro nomeado e o estado bit a bit. Só o `throws` não distingue
 * *"recusou"* de *"recusou depois de escrever"*, e só o estado não distingue *"não escreveu"* de
 * *"escreveu e o desfazimento apagou"*. A perna do estado discrimina, em particular, a escrita que
 * **escapa da unidade de trabalho** — a que abrisse conexão própria para alcançar `identidade`, que
 * é o desvio que o cabeçalho de `src/permissao.ts` recusa por nome —, porque essa o desfazimento da
 * transação da borda não alcançaria. O companheiro POSITIVO fecha a terceira leitura possível: sem
 * ele, uma operação que recusasse sempre — inclusive sob o contexto que enxerga — passaria.
 */

/** O perfil com que a pessoa do efetivo é semeada — o valor que a troca recusada NÃO pode mover. */
const PERFIL_SEMEADO_DO_EFETIVO: PerfilDaPessoa =
  USUARIOS.find((pessoa) => pessoa.id === PESSOA_DO_EFETIVO)?.perfil ?? 'USUARIO_EMPRESA';

/**
 * O perfil que a troca recusada tentaria gravar. **Diferente do semeado, de propósito**: com o mesmo
 * valor, "o perfil não mudou" seria verdade também sobre uma troca que tivesse acontecido.
 */
const PERFIL_DA_TROCA_RECUSADA: PerfilDaPessoa = 'ADMIN_EMPRESA';

/** O estado observável da pessoa do efetivo — as três coisas que uma escrita recusada não move. */
interface EstadoDoEfetivo {
  readonly versao: number;
  readonly perfil: string;
  /** Uma entrada por linha de ajuste do vínculo, na forma `TIPO:chave=EFEITO`. */
  readonly ajustes: string[];
}

/**
 * Lê o estado **sob o contexto da empresa A** — o único que enxerga o vínculo.
 *
 * Ler sob o contexto da tentativa devolveria vazio por invisibilidade, e "não mudou nada" ficaria
 * verde contra uma escrita que mudou tudo. É a mesma disciplina do CT-004, que confere o estado de B
 * no contexto de B depois de A tentar escrever nele.
 */
async function lerEstadoDoEfetivo(acesso: AcessoAoBanco): Promise<EstadoDoEfetivo> {
  return contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const [pessoa] = await tx<{ versao: number; perfil: string }[]>`
        SELECT versao_permissoes AS versao, perfil AS perfil
          FROM identidade.usuario
         WHERE id = ${PESSOA_DO_EFETIVO}
      `;
      // `ORDER BY` sobre coluna de enum segue a ordem de DECLARAÇÃO do tipo, não a alfabética — daí
      // o `::text`, como em `permissao.spec.ts` e no CT-210.
      const linhas = await tx<{ tipo: string; chave: string; efeito: string }[]>`
        SELECT tipo::text AS tipo, chave AS chave, efeito::text AS efeito
          FROM negocio.acesso_usuario_permissao
         WHERE acesso_id = ${VINCULO_DO_EFETIVO}
         ORDER BY tipo::text, chave
      `;
      return {
        // `-1` em vez de `0`: pessoa não encontrada tem de ser distinguível de contador zerado.
        versao: Number(pessoa?.versao ?? -1),
        perfil: pessoa?.perfil ?? '',
        ajustes: linhas.map((linha) => `${linha.tipo}:${linha.chave}=${linha.efeito}`),
      };
    }),
  );
}

/**
 * Devolve a pessoa do efetivo ao estado semeado — ajustes, contador e **perfil**.
 *
 * É mais que `limparEfetivo`, e de propósito: este caso tenta trocar o perfil, e um mutante que
 * deixasse a troca acontecer sob contexto alheio vazaria o perfil trocado para os casos seguintes.
 * `limparEfetivo` não é alterada — ela serve ao CT-209, que não movimenta perfil algum.
 */
async function restaurarPessoaDoEfetivo(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`DELETE FROM negocio.acesso_usuario_permissao WHERE acesso_id = ${VINCULO_DO_EFETIVO}`;
      await tx`
        UPDATE identidade.usuario
           SET versao_permissoes = 0, perfil = ${PERFIL_SEMEADO_DO_EFETIVO}::identidade.perfil_usuario
         WHERE id = ${PESSOA_DO_EFETIVO}
      `;
    }),
  );
}

/** Uma escrita do módulo, nomeada — o nome entra na asserção para o relatório apontar a célula. */
interface EscritaDoModulo {
  readonly nome: string;
  readonly executar: (tx: TransactionSql) => Promise<number>;
}

/**
 * As TRÊS escritas do módulo, e apenas elas.
 *
 * A lista é o alvo declarado: uma quarta escrita acrescentada a `src/permissao.ts` sem entrada aqui
 * é escrita sem companheiro negativo de tenant — que é exatamente a lacuna que este caso fecha.
 */
const ESCRITAS_DO_MODULO: readonly EscritaDoModulo[] = [
  {
    nome: 'escreverAjustes',
    executar: (tx) =>
      escreverAjustes(tx, {
        usuarioId: PESSOA_DO_EFETIVO,
        ajustes: AJUSTES_DO_EFETIVO,
        validarCoerencia: aceitarQualquerAjuste,
      }),
  },
  {
    nome: 'trocarPerfilDaPessoa',
    executar: (tx) =>
      trocarPerfilDaPessoa(tx, {
        usuarioId: PESSOA_DO_EFETIVO,
        perfil: PERFIL_DA_TROCA_RECUSADA,
      }),
  },
  {
    nome: 'incrementarVersaoPermissoes',
    executar: (tx) => incrementarVersaoPermissoes(tx, PESSOA_DO_EFETIVO),
  },
];

/** Os dois alcances que NÃO enxergam o vínculo da pessoa de A. */
const ALCANCES_QUE_NAO_ENXERGAM = [
  { nome: 'contexto-de-B', contexto: CONTEXTO_DE_B },
  { nome: 'sem-contexto', contexto: SEM_CONTEXTO },
] as const;

/**
 * O desfecho de uma tentativa, como texto comparável.
 *
 * Sucesso carrega o valor devolvido: com um rótulo genérico, o relatório de falha diria "gravou" sem
 * dizer o que gravou, e o mutante que este caso persegue é justamente o que devolve um contador.
 */
function desfechoDaEscrita(tentativa: Resultado<number>): string {
  if (tentativa.ok) {
    return `GRAVOU (devolveu ${tentativa.valor})`;
  }
  return tentativa.erro instanceof ErroDePessoaForaDoContexto
    ? 'ErroDePessoaForaDoContexto'
    : `outro erro: ${mensagemDo(tentativa.erro)}`;
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

  it(
    'CT-207 — vínculo cuja empresa difere da empresa da pessoa é recusado pela chave composta',
    async () => {
      await limparDescartaveis(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);

      try {
        // --- Preparo: uma pessoa que pertence, de fato, à empresa A -------------------------
        expect(
          await criarPessoa(
            acesso,
            CONTEXTO_DE_A,
            PESSOA_DESCARTAVEL_EM_A,
            'USUARIO_EMPRESA',
            EMPRESA_A.id,
          ),
        ).toBe(1);

        // --- Perna negativa: a MESMA pessoa, sob a empresa B --------------------------------
        // A recusa vem do driver, e é isso que as duas asserções afirmam: o SQLSTATE e o nome da
        // restrição são campos da resposta de erro do servidor — nenhum código de aplicação os
        // produz, e nenhuma verificação nossa foi consultada no caminho.
        const incoerente = await gravarVinculo(
          acesso,
          CONTEXTO_DE_B,
          VINCULO_INCOERENTE,
          EMPRESA_B.id,
          PESSOA_DESCARTAVEL_EM_A.id,
        );
        expect(incoerente.codigo).toBe('23503');
        expect(incoerente.restricao).toBe(RESTRICAO_DO_VINCULO);

        // --- Perna positiva: a MESMA pessoa, sob a empresa A --------------------------------
        // Sem ela, a recusa acima não distinguiria "a empresa está errada" de "esta pessoa não
        // pode ter vínculo nenhum". A empresa é a única variável entre as duas pernas.
        const coerente = await gravarVinculo(
          acesso,
          CONTEXTO_DE_A,
          VINCULO_COERENTE,
          EMPRESA_A.id,
          PESSOA_DESCARTAVEL_EM_A.id,
        );
        expect(coerente.codigo).toBeUndefined();
        expect(coerente.linhas).toBe(1);

        // O estado observável confirma as duas pernas: B ficou com exatamente a carga inicial, e A
        // ganhou o vínculo coerente e nada mais.
        expect(ordenado(await lerAcessos(acesso, CONTEXTO_DE_B))).toEqual(
          ordenado(IDENTIFICADORES_DE_B),
        );
        expect(ordenado(await lerAcessos(acesso, CONTEXTO_DE_A))).toEqual(
          ordenado([...IDENTIFICADORES_DE_A, VINCULO_COERENTE]),
        );

        // --- O controle da pessoa SEM empresa ----------------------------------------------
        // Ela continua inserível: a unicidade `(id, empresa_id)` da migração `0003` não impede um
        // SEGUNDO operador sem empresa, porque o PostgreSQL não compara nulos entre si. É esta
        // linha que prova que a restrição não tenantizou `identidade.usuario`.
        expect(
          await criarPessoa(acesso, CONTEXTO_DE_A, MASTER_DESCARTAVEL, 'SYSLOC_MASTER', null),
        ).toBe(1);
        expect(await lerPessoasSemEmpresa(acesso, CONTEXTO_DE_A)).toEqual(
          ordenado([USUARIO_MASTER.id, MASTER_DESCARTAVEL.id]),
        );

        // E ela não é alvo de vínculo — afirmado por COMPORTAMENTO, e não pela ausência de linha:
        // "não tem vínculo" também é verdade sobre quem ninguém tentou vincular.
        const doMaster = await gravarVinculo(
          acesso,
          CONTEXTO_DE_A,
          VINCULO_DO_MASTER,
          EMPRESA_A.id,
          MASTER_DESCARTAVEL.id,
        );
        expect(doMaster.codigo).toBe('23503');
        expect(doMaster.restricao).toBe(RESTRICAO_DO_VINCULO);
        expect(await contarVinculosDe(acesso, CONTEXTO_DE_A, MASTER_DESCARTAVEL.id)).toBe(0);
      } finally {
        await acesso.encerrar();
        await limparDescartaveis(banco.cadeiaConexao);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-302 — a leitura de cada entidade nova é escopada pelo banco, e o contexto ausente lê vazio',
    async () => {
      await limparCadastros(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);
      let acessoVirgem: AcessoAoBanco | undefined;

      try {
        // A ausência de filtro por empresa é INVARIANTE (ADR-0008), e por isso é conferida no
        // próprio texto das consultas que o caso emite — mesmo mecanismo do CT-003, e não uma
        // convenção que alguém precise lembrar.
        for (const entidade of ENTIDADES_DE_CADASTRO) {
          for (const consulta of [entidade.consulta, entidade.consultaDoRetrato]) {
            expect(consulta.toLowerCase()).not.toContain('empresa_id');
            expect(consulta.toLowerCase()).not.toContain('where');
          }
        }

        // Cada empresa cria as PRÓPRIAS linhas, dentro do próprio contexto — nunca por conexão
        // privilegiada, e nunca uma escrevendo pela outra.
        await semearCadastros(acesso, CONTEXTO_DE_A, EMPRESA_A.id, CADASTROS_DE_A, 'a');
        await semearCadastros(acesso, CONTEXTO_DE_B, EMPRESA_B.id, CADASTROS_DE_B, 'b');

        // A reserva virgem é aberta DEPOIS do preparo, para que a conexão dela nunca tenha atendido
        // outra unidade. É assim que o cenário "ninguém chamou o escritor de contexto" é obtido
        // pelo caminho normal — padrão `acessoVirgem` do CT-005.
        acessoVirgem = abrir(banco.cadeiaConexao);

        const sobA: string[] = [];
        const sobB: string[] = [];
        const semContexto: string[] = [];
        const contextoNulo: string[] = [];
        const invasaoEmA: string[] = [];
        const invasaoEmB: string[] = [];

        for (const entidade of ENTIDADES_DE_CADASTRO) {
          const emA = await lerCadastros(acesso, entidade, CONTEXTO_DE_A);
          const emB = await lerCadastros(acesso, entidade, CONTEXTO_DE_B);

          sobA.push(porEntidade(entidade.nome, emA));
          sobB.push(porEntidade(entidade.nome, emB));
          invasaoEmA.push(porEntidade(entidade.nome, intersecao(emA, IDS_SEMEADOS_EM_B)));
          invasaoEmB.push(porEntidade(entidade.nome, intersecao(emB, IDS_SEMEADOS_EM_A)));
          semContexto.push(
            porEntidade(entidade.nome, await lerCadastros(acessoVirgem, entidade, SEM_CONTEXTO)),
          );
          contextoNulo.push(
            porEntidade(entidade.nome, await lerCadastros(acesso, entidade, CONTEXTO_SEM_EMPRESA)),
          );
        }

        // O conjunto EXATO de cada empresa, entidade por entidade — nunca "alguma linha".
        expect(sobA).toEqual(ESPERADO_SOB_A);
        expect(sobB).toEqual(ESPERADO_SOB_B);

        // …e a interseção vazia, que é a outra metade: sem ela, uma leitura que devolvesse TUDO
        // ainda conteria o conjunto esperado como subconjunto se a igualdade acima fosse afrouxada.
        expect(invasaoEmA).toEqual(NOVE_LISTAS_VAZIAS);
        expect(invasaoEmB).toEqual(NOVE_LISTAS_VAZIAS);

        // Sem contexto e com empresa nula: vazio nas nove, e SEM erro. Não é recusa — é
        // invisibilidade, que é o que a política produz para qualquer leitura fora do tenant.
        expect(semContexto).toEqual(NOVE_LISTAS_VAZIAS);
        expect(contextoNulo).toEqual(NOVE_LISTAS_VAZIAS);

        // O companheiro POSITIVO, lido DEPOIS dos vazios e na mesma reserva: sem ele, "vazio" não
        // distingue isolamento de banco sem dado.
        const conferenciaEmA: string[] = [];
        for (const entidade of ENTIDADES_DE_CADASTRO) {
          conferenciaEmA.push(
            porEntidade(entidade.nome, await lerCadastros(acesso, entidade, CONTEXTO_DE_A)),
          );
        }
        expect(conferenciaEmA).toEqual(ESPERADO_SOB_A);
      } finally {
        await acessoVirgem?.encerrar();
        await acesso.encerrar();
        await limparCadastros(banco.cadeiaConexao);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-303 — no contexto de A, gravar cadastro da empresa B é recusado pelo banco e nada muda em B',
    async () => {
      await limparCadastros(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);

      try {
        // A empresa B cria, no PRÓPRIO contexto, as linhas sobre as quais A vai tentar escrever. As
        // chaves estrangeiras das linhas cruzadas apontam para pais que pertencem mesmo a B (um
        // `conjunto` de B para o `imovel`, um `imovel` de B para o `comodo`): sem isso, a chave
        // composta recusaria ANTES da política e o caso provaria a referência em vez do isolamento
        // — a armadilha que o comentário de `PESSOA_CRUZADA_EM_B` documenta.
        await semearCadastros(acesso, CONTEXTO_DE_B, EMPRESA_B.id, CADASTROS_DE_B, 'b');

        const antes = await retratoDosCadastros(acesso, CONTEXTO_DE_B);

        const insercoes: string[] = [];
        const atualizacoes: string[] = [];
        const remocoes: string[] = [];

        for (const entidade of ENTIDADES_DE_CADASTRO) {
          const cruzada = await tentarGravarCadastro(acesso, entidade, CONTEXTO_DE_A, {
            id: idDe(CADASTROS_CRUZADOS, entidade.nome),
            empresaId: EMPRESA_B.id,
            conjuntoId: CADASTROS_DE_B.conjunto,
            imovelId: CADASTROS_DE_B.imovel,
            locadorId: CADASTROS_DE_B.locador,
            locatarioId: CADASTROS_DE_B.locatario,
            contratoId: CADASTROS_DE_B.contrato,
            fiadorId: CADASTROS_DE_B.fiador,
            posicao: POSICAO_CRUZADA,
            marca: `cruzada-${entidade.nome}`,
          });
          insercoes.push(comoLinha(entidade.nome, desfechoDaGravacao(cruzada)));
        }

        for (const entidade of ENTIDADES_DE_CADASTRO) {
          const alvo = idDe(CADASTROS_DE_B, entidade.nome);
          atualizacoes.push(
            comoLinha(
              entidade.nome,
              desfechoDaEscritaSobreLinha(
                await tentarEscreverEmLinhaAlheia(acesso, entidade, CONTEXTO_DE_A, alvo, 'UPDATE'),
              ),
            ),
          );
          remocoes.push(
            comoLinha(
              entidade.nome,
              desfechoDaEscritaSobreLinha(
                await tentarEscreverEmLinhaAlheia(acesso, entidade, CONTEXTO_DE_A, alvo, 'DELETE'),
              ),
            ),
          );
        }

        // O SQLSTATE **e** a mensagem, numa asserção literal por entidade: `42501` sozinho não diz
        // que foi a política, e a mensagem sozinha não diz que a recusa veio do servidor.
        expect(insercoes).toEqual([
          'conjunto: 42501 · row-level security policy',
          'imovel: 42501 · row-level security policy',
          'comodo: 42501 · row-level security policy',
          'locador: 42501 · row-level security policy',
          'locatario: 42501 · row-level security policy',
          'fiador: 42501 · row-level security policy',
          'contrato: 42501 · row-level security policy',
          // ---------------------------------------------------------------------------
          // Por que o vínculo também devolve 42501, e não a violação de unicidade
          // ---------------------------------------------------------------------------
          //
          // Esta é a única linha cruzada que colide com uma restrição além da política: o par
          // `(contrato_id, fiador_id)` é o MESMO da linha que a empresa B semeou, porque B tem um
          // contrato e um fiador — não há segundo par legítimo a compor sem inventar cadastro que a
          // fatia não pede.
          //
          // Ela ainda assim reprova pela POLÍTICA, e não pela unicidade, porque o PostgreSQL avalia
          // `WITH CHECK` antes de inserir a tupla e os índices dela. **Medido nesta task**, em
          // instância efêmera: uma tabela com `unique` e política, alvo de um `INSERT` que viola as
          // duas, devolveu `42501 · new row violates row-level security policy`.
          //
          // A igualdade abaixo é, portanto, mais forte do que parece: um `23505` aqui significaria
          // que a ordem mudou, e o caso teria deixado de provar isolamento. **Não o "conserte"
          // aceitando os dois códigos** — se isso acontecer, o conserto é dar a B um segundo fiador,
          // não afrouxar a asserção.
          'contrato_fiador: 42501 · row-level security policy',
          // O portador é filho do LOCATÁRIO de B, e o `derivado` cruzado é distinto do semeado (a
          // marca entra nele), de modo que nem a chave composta nem a unicidade global disputam com
          // a política — a recusa aqui é da política, e só dela.
          'portador_de_confirmacao: 42501 · row-level security policy',
        ]);

        // Zero linhas afetadas é o desfecho CORRETO, e é diferente de erro: sob `USING`, a linha
        // alheia simplesmente não existe para quem escreve. Asserir "lançou exceção" aqui seria
        // asserir o comportamento errado.
        expect(atualizacoes).toEqual(NOVE_ESCRITAS_SEM_EFEITO);
        expect(remocoes).toEqual(NOVE_ESCRITAS_SEM_EFEITO);

        // O estado de B, lido numa unidade SEPARADA e no contexto de B — nunca por conexão
        // privilegiada: a auditoria não pode ser mais poderosa que o ato que ela audita.
        expect(await retratoDosCadastros(acesso, CONTEXTO_DE_B)).toBe(antes);

        // O companheiro POSITIVO: a MESMA atualização, sob o contexto de B, alcança a linha. Sem
        // ele, "0 linhas" não distinguiria invisibilidade de uma instrução que não atualiza nada.
        const atualizacoesEmB: string[] = [];
        for (const entidade of ENTIDADES_DE_CADASTRO) {
          atualizacoesEmB.push(
            comoLinha(
              entidade.nome,
              desfechoDaEscritaSobreLinha(
                await tentarEscreverEmLinhaAlheia(
                  acesso,
                  entidade,
                  CONTEXTO_DE_B,
                  idDe(CADASTROS_DE_B, entidade.nome),
                  'UPDATE',
                ),
              ),
            ),
          );
        }
        expect(atualizacoesEmB).toEqual([
          'conjunto: 1 linha(s)',
          'imovel: 1 linha(s)',
          'comodo: 1 linha(s)',
          'locador: 1 linha(s)',
          'locatario: 1 linha(s)',
          'fiador: 1 linha(s)',
          'contrato: 1 linha(s)',
          'contrato_fiador: 1 linha(s)',
          'portador_de_confirmacao: 1 linha(s)',
        ]);
      } finally {
        await acesso.encerrar();
        await limparCadastros(banco.cadeiaConexao);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-304 — referência entre cadastros de empresas diferentes é impossível pela chave composta',
    async () => {
      await limparCadastros(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);

      try {
        await semearCadastros(acesso, CONTEXTO_DE_A, EMPRESA_A.id, CADASTROS_DE_A, 'a');
        await semearCadastros(acesso, CONTEXTO_DE_B, EMPRESA_B.id, CADASTROS_DE_B, 'b');

        // Os identificadores alheios são obtidos LENDO sob o contexto de B — nunca por consulta
        // privilegiada. Assim o caso prova também o outro lado: conhecer o identificador de outra
        // empresa não basta para usá-lo.
        const conjuntosDeB = await lerCadastros(acesso, ENTIDADE_CONJUNTO, CONTEXTO_DE_B);
        const imoveisDeB = await lerCadastros(acesso, ENTIDADE_IMOVEL, CONTEXTO_DE_B);
        expect(conjuntosDeB).toEqual([CADASTROS_DE_B.conjunto]);
        expect(imoveisDeB).toEqual([CADASTROS_DE_B.imovel]);

        const desfechos: string[] = [];

        // --- `imovel` → `conjunto` ---------------------------------------------------------
        desfechos.push(
          comoLinha(
            'imovel/legitima',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_IMOVEL, CONTEXTO_DE_A, {
                id: IMOVEL_LEGITIMO_EM_A,
                empresaId: EMPRESA_A.id,
                conjuntoId: CADASTROS_DE_A.conjunto,
                imovelId: '',
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: 0,
                marca: 'imovel-legitimo-em-a',
              }),
            ),
          ),
        );
        desfechos.push(
          comoLinha(
            'imovel/cruzada-A-para-B',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_IMOVEL, CONTEXTO_DE_A, {
                id: IMOVEL_CRUZADO_A_PARA_B,
                empresaId: EMPRESA_A.id,
                conjuntoId: CADASTROS_DE_B.conjunto,
                imovelId: '',
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: 0,
                marca: 'imovel-cruzado-a-para-b',
              }),
            ),
          ),
        );
        desfechos.push(
          comoLinha(
            'imovel/cruzada-B-para-A',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_IMOVEL, CONTEXTO_DE_B, {
                id: IMOVEL_CRUZADO_B_PARA_A,
                empresaId: EMPRESA_B.id,
                conjuntoId: CADASTROS_DE_A.conjunto,
                imovelId: '',
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: 0,
                marca: 'imovel-cruzado-b-para-a',
              }),
            ),
          ),
        );

        // --- `comodo` → `imovel` -----------------------------------------------------------
        desfechos.push(
          comoLinha(
            'comodo/legitima',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_COMODO, CONTEXTO_DE_A, {
                id: COMODO_LEGITIMO_EM_A,
                empresaId: EMPRESA_A.id,
                conjuntoId: '',
                imovelId: CADASTROS_DE_A.imovel,
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: POSICAO_LEGITIMA_EM_A,
                marca: 'comodo-legitimo-em-a',
              }),
            ),
          ),
        );
        desfechos.push(
          comoLinha(
            'comodo/cruzada-A-para-B',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_COMODO, CONTEXTO_DE_A, {
                id: COMODO_CRUZADO_A_PARA_B,
                empresaId: EMPRESA_A.id,
                conjuntoId: '',
                imovelId: CADASTROS_DE_B.imovel,
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: POSICAO_CRUZADA_A_PARA_B,
                marca: 'comodo-cruzado-a-para-b',
              }),
            ),
          ),
        );
        desfechos.push(
          comoLinha(
            'comodo/cruzada-B-para-A',
            desfechoDaReferencia(
              await tentarGravarCadastro(acesso, ENTIDADE_COMODO, CONTEXTO_DE_B, {
                id: COMODO_CRUZADO_B_PARA_A,
                empresaId: EMPRESA_B.id,
                conjuntoId: '',
                imovelId: CADASTROS_DE_A.imovel,
                locadorId: '',
                locatarioId: '',
                contratoId: '',
                fiadorId: '',
                posicao: POSICAO_CRUZADA_B_PARA_A,
                marca: 'comodo-cruzado-b-para-a',
              }),
            ),
          ),
        );

        // O nome da restrição é afirmado ALÉM do SQLSTATE, e a razão é a mesma de `nomeDaRestricao`:
        // cada uma destas tabelas tem mais de uma chave estrangeira, e um `23503` sozinho não diz
        // qual delas falou. O nome vem de uma constante única do arquivo, nunca duplicado por
        // tentativa.
        expect(desfechos).toEqual([
          'imovel/legitima: GRAVOU (1 linha(s))',
          `imovel/cruzada-A-para-B: 23503 · ${RESTRICAO_DO_IMOVEL}`,
          `imovel/cruzada-B-para-A: 23503 · ${RESTRICAO_DO_IMOVEL}`,
          'comodo/legitima: GRAVOU (1 linha(s))',
          `comodo/cruzada-A-para-B: 23503 · ${RESTRICAO_DO_COMODO}`,
          `comodo/cruzada-B-para-A: 23503 · ${RESTRICAO_DO_COMODO}`,
        ]);

        // O estado final das duas empresas: a legítima entrou, nenhuma cruzada apareceu de nenhum
        // dos dois lados.
        const finalEmA: string[] = [];
        const finalEmB: string[] = [];
        for (const entidade of ENTIDADES_DE_CADASTRO) {
          finalEmA.push(
            porEntidade(entidade.nome, await lerCadastros(acesso, entidade, CONTEXTO_DE_A)),
          );
          finalEmB.push(
            porEntidade(entidade.nome, await lerCadastros(acesso, entidade, CONTEXTO_DE_B)),
          );
        }
        expect(finalEmA).toEqual([
          porEntidade('conjunto', [CADASTROS_DE_A.conjunto]),
          porEntidade('imovel', [CADASTROS_DE_A.imovel, IMOVEL_LEGITIMO_EM_A]),
          porEntidade('comodo', [CADASTROS_DE_A.comodo, COMODO_LEGITIMO_EM_A]),
          porEntidade('locador', [CADASTROS_DE_A.locador]),
          porEntidade('locatario', [CADASTROS_DE_A.locatario]),
          porEntidade('fiador', [CADASTROS_DE_A.fiador]),
          // As duas relações do contrato e a do portador não participam das seis tentativas de
          // referência deste caso — as chaves compostas que ele exercita são `imovel → conjunto` e
          // `comodo → imovel` —, mas continuam SEMEADAS por `semearCadastros`, e portanto continuam
          // legíveis sob A. Omiti-las aqui esconderia da igualdade três relações inteiras.
          porEntidade('contrato', [CADASTROS_DE_A.contrato]),
          porEntidade('contrato_fiador', [CADASTROS_DE_A.contrato_fiador]),
          porEntidade('portador_de_confirmacao', [CADASTROS_DE_A.portador_de_confirmacao]),
        ]);
        expect(finalEmB).toEqual(ESPERADO_SOB_B);
      } finally {
        await acesso.encerrar();
        await limparCadastros(banco.cadeiaConexao);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-209 — a mesma leitura de ajustes devolve 3 em A, 0 em B e 0 sem contexto, e o fonte não filtra por empresa',
    async () => {
      // Reserva de UMA conexão: as três leituras correm sobre a MESMA conexão física, alternando o
      // contexto pela unidade de trabalho publicada. Com reservas distintas, "0 linhas sob B"
      // poderia ser propriedade de uma conexão nova, e não da política.
      const acesso = abrir(banco.cadeiaConexao);

      try {
        await limparEfetivo(acesso);

        // --- A semeadura, pelo caminho real de escrita -------------------------------------
        const versao = await contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            escreverAjustes(tx, {
              usuarioId: PESSOA_DO_EFETIVO,
              ajustes: AJUSTES_DO_EFETIVO,
              validarCoerencia: aceitarQualquerAjuste,
            }),
          ),
        );
        expect(versao).toBe(1);

        // --- A MESMA leitura, sob os três contextos ----------------------------------------
        const emA = await lerEfetivo(acesso, CONTEXTO_DE_A);
        const emB = await lerEfetivo(acesso, CONTEXTO_DE_B);
        const semContexto = await lerEfetivo(acesso, SEM_CONTEXTO);

        // Sob A: as três chaves do catálogo, e a órfã DESCARTADA e nomeada. Igualdade do objeto
        // inteiro, e não contagem: a contagem sozinha não distinguiria "descartou a órfã" de
        // "perdeu uma das três".
        expect(comoObjeto(emA)).toEqual(EFETIVO_VISIVEL);

        // Sob B e sem contexto: vazio, sem erro. Não é recusa — é invisibilidade, que é o que a
        // política produz para qualquer leitura de negócio fora do tenant.
        expect(comoObjeto(emB)).toEqual(EFETIVO_INVISIVEL);
        expect(comoObjeto(semContexto)).toEqual(EFETIVO_INVISIVEL);

        // A contagem, dita também de forma direta — os três números do card.
        expect([emA.ajustes.length, emB.ajustes.length, semContexto.ajustes.length]).toEqual([
          3, 0, 0,
        ]);

        // --- A asserção ESTÁTICA ------------------------------------------------------------
        const varredura = await varrerFiltroPorEmpresa(arquivosDoEfetivo(RAIZ_DOS_PACOTES));
        // A contagem exata, e não `> 0`, fixa que `arquivosDoEfetivo` é TOTAL sobre
        // `FONTE_DO_EFETIVO` — nenhum alvo declarado fica de fora da lista entregue ao varredor.
        // Quem barra o alvo RENOMEADO é outro mecanismo, e a atribuição importa: `varrerArquivos`
        // devolve `arquivos: arquivos.length`, o tamanho da lista de ENTRADA, e é o `readFile` de
        // `varredura-de-fontes.ts` que levanta em vez de engolir a ausência do arquivo.
        expect(varredura.arquivos).toBe(FONTE_DO_EFETIVO.length);
        expect(varredura.ocorrencias).toEqual([]);
      } finally {
        await limparEfetivo(acesso);
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-209 (escrita fora do contexto) — as três escritas recusam sob B e sem contexto, e não movem contador, perfil nem ajuste',
    async () => {
      // Reserva de UMA conexão, pela mesma razão do CT-209: as tentativas e as conferências correm
      // sobre a MESMA conexão física, alternando o contexto pela unidade de trabalho publicada.
      const acesso = abrir(banco.cadeiaConexao);

      try {
        await restaurarPessoaDoEfetivo(acesso);

        // --- Estado de partida NÃO vazio ---------------------------------------------------
        // Contra contador zerado e vínculo sem ajuste, "nada mudou" também é verdade sobre uma
        // escrita que não teria como mudar coisa alguma. A semeadura é pelo caminho real, sob o
        // contexto que enxerga — e é ela o companheiro POSITIVO da primeira operação.
        const versaoSemeada = await contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            escreverAjustes(tx, {
              usuarioId: PESSOA_DO_EFETIVO,
              ajustes: AJUSTES_DO_EFETIVO,
              validarCoerencia: aceitarQualquerAjuste,
            }),
          ),
        );
        expect(versaoSemeada).toBe(1);

        const antes = await lerEstadoDoEfetivo(acesso);
        expect(antes).toEqual({
          versao: 1,
          perfil: PERFIL_SEMEADO_DO_EFETIVO,
          ajustes: [
            'ACAO:emitir_boleto=NEGADA',
            'TELA:financeiro=CONCEDIDA',
            'TELA:relatorios=CONCEDIDA',
            'TELA:tela_extinta=CONCEDIDA',
          ],
        });

        // --- As seis células: {três escritas} × {contexto de B, contexto ausente} -----------
        const desfechos: string[] = [];
        const estados: EstadoDoEfetivo[] = [];

        for (const alcance of ALCANCES_QUE_NAO_ENXERGAM) {
          for (const escrita of ESCRITAS_DO_MODULO) {
            const tentativa = await tentar(() =>
              noContexto(alcance.contexto, () =>
                acesso.emUnidadeDeTrabalho((tx) => escrita.executar(tx)),
              ),
            );

            desfechos.push(`${escrita.nome}/${alcance.nome}: ${desfechoDaEscrita(tentativa)}`);
            // Lido DEPOIS de cada célula, e não uma vez ao fim: com uma conferência só, uma escrita
            // indevida desfeita por outra célula passaria despercebida.
            estados.push(await lerEstadoDoEfetivo(acesso));
          }
        }

        // Perna (a) — a recusa, com o erro NOMEADO. As seis células declaradas de uma vez: a lista
        // inteira é o esperado, de modo que uma célula que passe a gravar apareça pelo nome.
        expect(desfechos).toEqual([
          'escreverAjustes/contexto-de-B: ErroDePessoaForaDoContexto',
          'trocarPerfilDaPessoa/contexto-de-B: ErroDePessoaForaDoContexto',
          'incrementarVersaoPermissoes/contexto-de-B: ErroDePessoaForaDoContexto',
          'escreverAjustes/sem-contexto: ErroDePessoaForaDoContexto',
          'trocarPerfilDaPessoa/sem-contexto: ErroDePessoaForaDoContexto',
          'incrementarVersaoPermissoes/sem-contexto: ErroDePessoaForaDoContexto',
        ]);

        // Perna (b) — o estado bit a bit, lido sob o contexto de A. Sem ela, o `throws` não
        // distingue "recusou" de "recusou depois de escrever".
        expect(estados).toEqual([antes, antes, antes, antes, antes, antes]);

        // --- O companheiro POSITIVO das outras duas escritas -------------------------------
        // Sem ele, "recusa sempre" — inclusive sob o contexto que enxerga — passaria neste caso.
        // A empresa do contexto é a ÚNICA variável entre a recusa e o sucesso: mesma pessoa, mesma
        // operação, mesma conexão.
        const versaoTrocada = await contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            trocarPerfilDaPessoa(tx, {
              usuarioId: PESSOA_DO_EFETIVO,
              perfil: PERFIL_DA_TROCA_RECUSADA,
            }),
          ),
        );
        expect(versaoTrocada).toBe(2);

        const versaoIncrementada = await contextoDeTenant.executarCom(CONTEXTO_DE_A, () =>
          acesso.emUnidadeDeTrabalho((tx) => incrementarVersaoPermissoes(tx, PESSOA_DO_EFETIVO)),
        );
        expect(versaoIncrementada).toBe(3);

        // A troca de perfil descarta os ajustes — é a operação, não efeito colateral esquecido.
        expect(await lerEstadoDoEfetivo(acesso)).toEqual({
          versao: 3,
          perfil: PERFIL_DA_TROCA_RECUSADA,
          ajustes: [],
        });
      } finally {
        await restaurarPessoaDoEfetivo(acesso);
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-209 (falsificação) — a varredura reprova o filtro por empresa reintroduzido na leitura',
    async () => {
      const raiz = await arvoreDeFalsificacao();

      try {
        // Controle: a cópia bit a bit do arquivo real passa limpa. Sem ele, "a cópia mutada
        // reprovou" não distingue detector que funciona de detector que reprova qualquer coisa —
        // e o arquivo real é justamente o que MENCIONA `empresa_id` em dois pontos legítimos.
        const integra = await varrerFiltroPorEmpresa(arquivosDoEfetivo(raiz));
        expect(integra.arquivos).toBe(FONTE_DO_EFETIVO.length);
        expect(integra.ocorrencias).toEqual([]);

        const alvo = join(raiz, 'db/src/permissao.ts');
        const original = await readFile(alvo, 'utf8');
        const mutado = original.replace(
          TRECHO_ALVO_DO_MUTANTE,
          `${TRECHO_ALVO_DO_MUTANTE}\n       ${FILTRO_REINTRODUZIDO}`,
        );
        // Sem esta linha, um trecho-alvo que deixasse de existir tornaria o mutante um no-op — e o
        // caso seguinte estaria afirmando que o detector reprova um arquivo íntegro.
        expect(mutado).not.toBe(original);
        await writeFile(alvo, mutado, 'utf8');

        const comFiltro = await varrerFiltroPorEmpresa(arquivosDoEfetivo(raiz));

        expect(comFiltro.arquivos).toBe(FONTE_DO_EFETIVO.length);
        expect(comFiltro.ocorrencias).toHaveLength(1);
        expect(comFiltro.ocorrencias[0]).toContain('db/src/permissao.ts');
        expect(comFiltro.linhas[0]).toBe(FILTRO_REINTRODUZIDO);
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-209 (controle negativo) — a menção legítima a `empresa_id` não é reportada, e a comparação é',
    async () => {
      const raiz = await mkdtemp(join(tmpdir(), 'sysloc-filtro-empresa-'));

      try {
        // (a) As duas formas legítimas que o módulo real usa: a coluna na lista do `INSERT` e o
        // item de projeção que carrega o valor do PAI. Nenhuma delas compara nada.
        const legitimo = join(raiz, 'legitimo.ts');
        await escrever(
          legitimo,
          [
            'const consulta = `',
            '  INSERT INTO negocio.acesso_usuario_permissao (empresa_id, acesso_id, tipo)',
            '  SELECT a.empresa_id,',
            '         a.id,',
            "         'TELA'::negocio.tipo_permissao",
            '    FROM negocio.acesso_usuario_app AS a`;',
            '',
          ].join('\n'),
        );

        const semFiltro = await varrerFiltroPorEmpresa([legitimo]);
        expect(semFiltro.arquivos).toBe(1);
        expect(semFiltro.ocorrencias).toEqual([]);

        // (b) …e o controle não é vazio: as quatro formas em que a comparação de fato reapareceria
        // — SQL na cláusula, SQL invertida, filtro em TypeScript e conjunto — são todas reportadas.
        const comFiltro = join(raiz, 'com-filtro.ts');
        await escrever(comFiltro, `${LINHAS_COM_FILTRO.join('\n')}\n`);

        const reportadas = await varrerFiltroPorEmpresa([comFiltro]);
        expect(reportadas.arquivos).toBe(1);
        expect(reportadas.ocorrencias).toHaveLength(LINHAS_COM_FILTRO.length);
        expect(reportadas.linhas).toEqual([...LINHAS_COM_FILTRO]);
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-522 — duas empresas apuram cada uma pela PRÓPRIA política de mora, e nenhuma enxerga a outra',
    async () => {
      await limparCobrancas(banco.cadeiaConexao);
      await limparCadastros(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);
      let acessoVirgem: AcessoAoBanco | undefined;

      try {
        // A ausência de filtro por empresa é INVARIANTE (ADR-0008), e por isso é conferida no
        // próprio texto da consulta que o caso emite — mesmo mecanismo do CT-003 e do CT-302. O que
        // escopa a leitura é a política das tabelas-base, alcançada pela visão por delegação.
        expect(CONSULTA_DA_DERIVADA.toLowerCase()).not.toContain('empresa_id');
        expect(CONSULTA_DA_DERIVADA.toLowerCase()).not.toContain('where');

        // Cada empresa cria as PRÓPRIAS linhas, dentro do próprio contexto — nunca por conexão
        // privilegiada, e nunca uma escrevendo pela outra.
        await semearAsDuasCarteiras(acesso);

        // A reserva virgem é aberta DEPOIS do preparo, para que a conexão dela nunca tenha atendido
        // outra unidade — padrão `acessoVirgem` do CT-005 e do CT-302.
        acessoVirgem = abrir(banco.cadeiaConexao);

        // --- Sob o contexto de A -----------------------------------------------------------
        const sobA = await lerDerivada(acesso, CONTEXTO_DE_A);

        expect(sobA.map((linha) => linha.id)).toEqual([COBRANCA_DE_A]);
        // Companheiro negativo EXPLÍCITO, no molde do CT-107: a igualdade acima já o implica, mas é
        // esta linha que nomeia o vazamento se ele voltar.
        expect(
          intersecao(
            sobA.map((linha) => linha.id),
            [COBRANCA_DE_B],
          ),
        ).toEqual([]);

        // A linha inteira por igualdade, e não campo a campo: o estado derivado, o atraso, as duas
        // parcelas de mora, o total e o código do contrato saem da MESMA leitura, e é o objeto
        // completo que discrimina uma apuração feita com a política alheia.
        expect(sobA[0]).toEqual({
          id: COBRANCA_DE_A,
          codigo: 'COB-2026-0000001',
          status: 'VENCIDA',
          diasAtraso: DIAS_DE_ATRASO,
          contratoCodigo: 'CTR-2026-contrato-a',
          ...MORA_ESPERADA_DE_A,
        } satisfies LinhaDerivada);

        // --- Sob o contexto de B -----------------------------------------------------------
        const sobB = await lerDerivada(acesso, CONTEXTO_DE_B);

        expect(sobB.map((linha) => linha.id)).toEqual([COBRANCA_DE_B]);
        expect(
          intersecao(
            sobB.map((linha) => linha.id),
            [COBRANCA_DE_A],
          ),
        ).toEqual([]);
        expect(sobB[0]).toEqual({
          id: COBRANCA_DE_B,
          codigo: 'COB-2026-0000002',
          status: 'VENCIDA',
          diasAtraso: DIAS_DE_ATRASO,
          contratoCodigo: 'CTR-2026-contrato-b',
          ...MORA_ESPERADA_DE_B,
        } satisfies LinhaDerivada);

        // --- Os dois resultados DIFEREM ----------------------------------------------------
        //
        // Dito de forma direta, e não deduzido das duas igualdades acima: se coincidissem, a
        // configuração de uma teria alcançado a outra — que é o defeito que este caso persegue, e
        // ele é distinto de "enxergou a linha alheia".
        expect([sobA[0]?.valorMulta, sobA[0]?.valorJuros, sobA[0]?.valorTotal]).not.toEqual([
          sobB[0]?.valorMulta,
          sobB[0]?.valorJuros,
          sobB[0]?.valorTotal,
        ]);

        // --- Sem contexto: VAZIO, e sem erro -----------------------------------------------
        //
        // O terceiro pé do caso, e o que impede que ele fique verde sobre uma visão que ignorasse
        // `empresa_id` e devolvesse tudo para todos: contexto ausente resulta em vazio, nunca em
        // dado alheio. Não é recusa — é invisibilidade, que é o que a política produz.
        expect(await lerDerivada(acessoVirgem, SEM_CONTEXTO)).toEqual([]);
        expect(await lerDerivada(acesso, CONTEXTO_SEM_EMPRESA)).toEqual([]);

        // O companheiro POSITIVO, lido DEPOIS dos vazios e na mesma reserva: sem ele, "vazio" não
        // distingue isolamento de banco sem dado.
        expect((await lerDerivada(acesso, CONTEXTO_DE_A)).map((linha) => linha.id)).toEqual([
          COBRANCA_DE_A,
        ]);
      } finally {
        await acessoVirgem?.encerrar();
        await acesso.encerrar();
        await limparCobrancas(banco.cadeiaConexao);
        await limparCadastros(banco.cadeiaConexao);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-607 — a política de aviso e os envios de uma empresa são inalcançáveis sob o contexto da outra',
    async () => {
      await limparRegua(banco.cadeiaConexao);
      await limparCobrancas(banco.cadeiaConexao);
      await limparCadastros(banco.cadeiaConexao);
      const acesso = abrir(banco.cadeiaConexao);
      let acessoVirgem: AcessoAoBanco | undefined;

      try {
        // A ausência de filtro por empresa é INVARIANTE (ADR-0008), e por isso é conferida no
        // próprio texto das consultas que o caso emite — mesmo mecanismo do CT-003, do CT-302 e do
        // CT-522. Quem escopa a leitura é a política das duas tabelas, e nada mais.
        for (const consulta of [
          CONSULTA_DA_POLITICA_DE_AVISO,
          CONSULTA_DOS_ENVIOS,
          CONTAGEM_DE_POLITICAS,
          CONTAGEM_DE_ENVIOS,
        ]) {
          expect(consulta.toLowerCase()).not.toContain('empresa_id');
          expect(consulta.toLowerCase()).not.toContain('where');
        }

        // --- Passo 1: cada empresa grava as PRÓPRIAS linhas, sob o próprio contexto -----------
        //
        // Nunca por conexão privilegiada, nunca uma escrevendo pela outra, e nunca com
        // `app.empresa_id` fixado por fora da barreira: o caminho é o real da porta —
        // `executarCom` na borda, `SET LOCAL` por transação.
        await semearAsDuasCarteiras(acesso);
        await semearReguaDeA(acesso);

        // A reserva virgem é aberta DEPOIS do preparo, para que a conexão dela nunca tenha atendido
        // outra unidade — padrão `acessoVirgem` do CT-005, do CT-302 e do CT-522.
        acessoVirgem = abrir(banco.cadeiaConexao);

        // --- Passo 2: sob B, a contagem CRUA das duas tabelas é zero -------------------------
        //
        // `count(*)` sem projeção nenhuma: é a forma que mede invisibilidade sem passar por coluna,
        // e a que continuaria contando se a política deixasse de valer.
        expect(await contarRegua(acesso, CONTEXTO_DE_B)).toEqual({ politicas: 0, envios: 0 });
        expect(await lerRegua(acesso, CONTEXTO_DE_B)).toEqual({ politicas: [], envios: [] });

        // --- Passo 3: sob B, `UPDATE` e `DELETE` nas linhas de A afetam ZERO linhas ----------
        //
        // Sem erro: `USING` não casa a linha, e o comando simplesmente não a alcança. A ausência de
        // exceção é conteúdo — um caso que só afirmasse "levantou" ficaria verde sobre um banco que
        // recusasse tudo, inclusive o legítimo.
        const efeitoDasEscritasCruzadas = await contextoDeTenant.executarCom(
          CONTEXTO_DE_B,
          async () =>
            acesso.emUnidadeDeTrabalho(async (tx) => {
              const linhas: string[] = [];
              for (const escrita of ESCRITAS_CRUZADAS_NA_REGUA) {
                const resultado = await tx.unsafe(escrita.sql);
                linhas.push(`${escrita.nome}: ${resultado.count} linha(s)`);
              }
              return linhas;
            }),
        );
        expect(efeitoDasEscritasCruzadas).toEqual([
          'politica/update: 0 linha(s)',
          'politica/delete: 0 linha(s)',
          'envio/update: 0 linha(s)',
          'envio/delete: 0 linha(s)',
        ]);

        // --- Passo 4: sob B, `INSERT` com `empresa_id` de A é RECUSADO pelo banco ------------
        //
        // `42501` (`insufficient_privilege`) com a mensagem da política de linha: a recusa vem do
        // `WITH CHECK`, e não de validação de aplicação nenhuma. A mensagem é afirmada junto do
        // código porque `42501` sozinho também sai de uma concessão faltando.
        const insercaoCruzadaDaPolitica = await tentar(() =>
          contextoDeTenant.executarCom(CONTEXTO_DE_B, () =>
            acesso.emUnidadeDeTrabalho(
              (tx) => tx`
                INSERT INTO negocio.politica_de_aviso (id, empresa_id)
                VALUES (${POLITICA_CRUZADA}, ${EMPRESA_A.id})
              `,
            ),
          ),
        );
        expect(insercaoCruzadaDaPolitica.ok).toBe(false);
        expect(
          sqlstate(insercaoCruzadaDaPolitica.ok ? undefined : insercaoCruzadaDaPolitica.erro),
        ).toBe('42501');
        expect(
          mensagemDo(insercaoCruzadaDaPolitica.ok ? undefined : insercaoCruzadaDaPolitica.erro),
        ).toContain('row-level security policy');

        const insercaoCruzadaDoEnvio = await tentar(() =>
          contextoDeTenant.executarCom(CONTEXTO_DE_B, () =>
            acesso.emUnidadeDeTrabalho(
              (tx) => tx`
                INSERT INTO negocio.envio_de_cobranca
                            (id, empresa_id, cobranca_id, caminho, desfecho, destinatario, causa)
                VALUES (${ENVIO_CRUZADO}, ${EMPRESA_A.id}, ${COBRANCA_DE_A},
                        ${'AUTOMATICO'}::negocio.caminho_do_aviso,
                        ${'ENVIADA'}::negocio.desfecho_do_aviso,
                        ${'invasor@exemplo.com.br'}, ${null})
              `,
            ),
          ),
        );
        expect(insercaoCruzadaDoEnvio.ok).toBe(false);
        expect(sqlstate(insercaoCruzadaDoEnvio.ok ? undefined : insercaoCruzadaDoEnvio.erro)).toBe(
          '42501',
        );
        expect(
          mensagemDo(insercaoCruzadaDoEnvio.ok ? undefined : insercaoCruzadaDoEnvio.erro),
        ).toContain('row-level security policy');

        // --- Passo 5: sob A, TUDO permanece exatamente como foi gravado ----------------------
        //
        // O retrato inteiro por igualdade, e não campo a campo: é o objeto completo que discrimina
        // uma escrita cruzada que tivesse alcançado a linha. Ele vem DEPOIS das quatro tentativas —
        // "zero linhas afetadas" não distingue "não alcançou" de "alcançou e o desfazimento
        // apagou", e este passo é quem fecha essa terceira leitura.
        expect(await lerRegua(acesso, CONTEXTO_DE_A)).toEqual(REGUA_INTACTA_DE_A);
        expect(await contarRegua(acesso, CONTEXTO_DE_A)).toEqual({
          politicas: 1,
          envios: ENVIOS_DE_A.length,
        });

        // --- Passo 6: sem contexto e com empresa nula, VAZIO — e sem erro --------------------
        //
        // O que impede o caso de ficar verde sobre tabelas que ignorassem `empresa_id` e
        // devolvessem tudo para todos: contexto ausente resulta em vazio, nunca em dado alheio.
        expect(await contarRegua(acessoVirgem, SEM_CONTEXTO)).toEqual({ politicas: 0, envios: 0 });
        expect(await contarRegua(acesso, CONTEXTO_SEM_EMPRESA)).toEqual({
          politicas: 0,
          envios: 0,
        });

        // O companheiro POSITIVO, lido DEPOIS dos vazios e na mesma reserva: sem ele, "vazio" não
        // distingue isolamento de banco sem dado.
        expect(await contarRegua(acesso, CONTEXTO_DE_A)).toEqual({
          politicas: 1,
          envios: ENVIOS_DE_A.length,
        });

        // --- Passo 7: RLS habilitada E FORÇADA nas duas -------------------------------------
        //
        // O comportamento acima ficaria verde sem `FORCE`, porque `sysloc_app` não é dono das
        // tabelas. É esta asserção que impede o isolamento de existir só para quem não é dono —
        // ADR-0008, Cons: "suíte que conecte com o papel errado fica verde sem provar nada".
        expect(
          await lerEstadoDeRls(acesso, CONTEXTO_DE_A, ['envio_de_cobranca', 'politica_de_aviso']),
        ).toEqual([
          { tabela: 'envio_de_cobranca', habilitada: true, forcada: true },
          { tabela: 'politica_de_aviso', habilitada: true, forcada: true },
        ]);
      } finally {
        await acessoVirgem?.encerrar();
        await acesso.encerrar();
        await limparRegua(banco.cadeiaConexao);
        await limparCobrancas(banco.cadeiaConexao);
        await limparCadastros(banco.cadeiaConexao);
      }
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

// ---------------------------------------------------------------------------
// CT-107 — o que `security_invoker` de fato faz, provado por COMPORTAMENTO
// ---------------------------------------------------------------------------
//
// A guarda de catálogo (`catalogo.ts`) cobra `security_invoker = true` de toda visão em `negocio`,
// e o CT-009 prova que ela cobra. **Isto é forma, não semântica** — e o cabeçalho daquela guarda é
// explícito sobre a divisão: o conteúdo da política se prova aqui, exercitando o banco.
//
// Sem este caso, o critério inteiro repousaria numa afirmação de comentário sobre como o PostgreSQL
// avalia a política de uma visão. É exatamente o padrão que a §7 do Protocolo Antirregressão
// registra — *"provou-se o que era fácil provar"*: a presença da opção é trivial de asserir, e o
// que discrimina (a linha que vaza, ou não vaza, para quem consulta) ficava sem asserção.
//
// O par é o que detecta, e cada perna morre sozinha:
//
//   * só a visão SEGURA provaria que a leitura respeita o contexto — mas não que a opção é
//     NECESSÁRIA: uma visão comum sobre tabela com `FORCE` também respeita, quando a dona não
//     contorna RLS, e foi essa coincidência que sustentou a exclusão de `v` até o D38;
//   * só a visão VAZADA provaria que existe um caminho ruim — mas não que a opção o fecha.
//
// A dona da visão vazada é a SUPERUSUÁRIA, e essa é a única origem de privilégio deste arquivo além
// da de migração. Não é conveniência de teste: é a reprodução exata da condição que o D38 mediu — a
// política da origem sendo avaliada com os direitos de quem DONA a visão, e não de quem consulta.
const VISAO_QUE_DELEGA = 'negocio.espelho_delegante';
const VISAO_QUE_VAZA = 'negocio.espelho_vazante';

/** A tabela tenantizada que as duas visões espelham — e a referência de comportamento do caso. */
const TABELA_ESPELHADA = 'negocio.acesso_usuario_app';

/**
 * O corpo das duas visões, IDÊNTICO nas duas de propósito: o que as distingue é exclusivamente a
 * opção e a dona. Se o corpo divergisse, o vazamento poderia ser atribuído à consulta.
 */
const CORPO_DAS_VISOES = `SELECT id, empresa_id FROM ${TABELA_ESPELHADA}`;

/**
 * O papel sem privilégio que a suíte usa — o mesmo que a aplicação usa. Escrito aqui porque a visão
 * de dona privilegiada precisa CONCEDER leitura a ele: sem a concessão, o caso reprovaria por falta
 * de permissão e não por ausência de vazamento, que é outra coisa.
 */
const PAPEL_DA_APLICACAO = 'sysloc_app';

/** Lê identificadores de uma relação qualquer, pela conexão SEM privilégio, no contexto dado. */
async function lerIdsDe(
  acesso: AcessoAoBanco,
  relacao: string,
  contexto: Contexto | typeof SEM_CONTEXTO,
): Promise<string[]> {
  return noContexto(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx.unsafe<{ id: string }[]>(`SELECT id FROM ${relacao} ORDER BY id`);
      return linhas.map((linha) => linha.id);
    }),
  );
}

describe('CT-107 — `security_invoker` decide de QUEM é o privilégio que a visão empresta', () => {
  it(
    'CT-107 — a visão que delega respeita o contexto; a de dona privilegiada sem a opção vaza as duas empresas',
    async () => {
      // Instância DEDICADA, como o CT-007: as duas visões são DDL, e criá-las na instância que os
      // demais casos compartilham mudaria o que eles examinam.
      const banco = await bancoEfemero();

      try {
        const doDono = conexaoDeMigracao(banco);
        const daSuperusuaria = conexaoSuperusuaria(banco);

        // A que DELEGA é criada pelo papel de migração — `NOSUPERUSER … NOBYPASSRLS`. A que VAZA é
        // criada pela superusuária, e é dela que herda o privilégio de contornar a política.
        await executarPrivilegiado(doDono, [
          `CREATE VIEW ${VISAO_QUE_DELEGA} WITH (security_invoker = true) AS ${CORPO_DAS_VISOES}`,
        ]);
        await executarPrivilegiado(daSuperusuaria, [
          `CREATE VIEW ${VISAO_QUE_VAZA} AS ${CORPO_DAS_VISOES}`,
          `GRANT SELECT ON ${VISAO_QUE_VAZA} TO ${PAPEL_DA_APLICACAO}`,
        ]);

        const acesso = abrir(banco.cadeiaConexao);

        try {
          // --- a tabela, como referência: é o comportamento que a visão não pode enfraquecer ---
          expect(ordenado(await lerIdsDe(acesso, TABELA_ESPELHADA, CONTEXTO_DE_A))).toEqual(
            ordenado(IDENTIFICADORES_DE_A),
          );

          // --- perna 1: COM a opção, a visão é tão forte quanto a tabela ---
          const peloDelegante = await lerIdsDe(acesso, VISAO_QUE_DELEGA, CONTEXTO_DE_A);
          expect(ordenado(peloDelegante)).toEqual(ordenado(IDENTIFICADORES_DE_A));
          // Companheiro negativo explícito: nenhum identificador de B atravessou. A igualdade acima
          // já o implica, mas é ESTA linha que nomeia o vazamento se ele voltar.
          expect(intersecao(peloDelegante, IDENTIFICADORES_DE_B)).toEqual([]);

          // --- perna 2: SEM a opção e com dona privilegiada, a mesma consulta vaza ---
          const peloVazante = await lerIdsDe(acesso, VISAO_QUE_VAZA, CONTEXTO_DE_A);
          expect(
            intersecao(peloVazante, IDENTIFICADORES_DE_B),
            'a visão de dona privilegiada deveria vazar B — se não vaza, a premissa do CT-107 ' +
              'mudou e o critério de `catalogo.ts` precisa ser reavaliado, não o teste',
          ).toEqual(ordenado(IDENTIFICADORES_DE_B));

          // E o vazamento acontece com o MESMO contexto fixado que a perna 1 usou — não é ausência
          // de contexto. É o que prova que a diferença está na visão, e não no chamador.
          expect(ordenado(peloVazante)).not.toEqual(ordenado(peloDelegante));
        } finally {
          await acesso.encerrar();
        }
      } finally {
        await banco.parar();
      }
    },
    LIMITE_DA_FALSIFICACAO_MS,
  );
});

// ---------------------------------------------------------------------------
// CT-523 — `security_invoker` da visão da COBRANÇA, falsificado por duas vias
// ---------------------------------------------------------------------------
//
// O CT-107 provou o que o atributo FAZ, sobre um espelho sintético de `acesso_usuario_app`. Este
// caso prova o mesmo sobre o objeto REAL da fatia — a visão que a migração `0010` cria, com o corpo
// que ela declara — e acrescenta a segunda via de detecção: a guarda de cobertura de
// `packages/db/src/catalogo.ts`, que nomeia a visão com `VISAO_NAO_DELEGA_ISOLAMENTO`.
//
// As duas vias são INDEPENDENTES, e é por isso que as duas estão aqui: a guarda responde por FORMA
// (o atributo está declarado?) e o vazamento responde por SEMÂNTICA (a linha alheia atravessa?).
// Uma guarda quebrada e uma visão correta produziriam o mesmo `excecoes: []` que uma guarda correta
// e uma visão correta; só a perna comportamental distingue os dois.
//
// **O corpo da visão é LIDO do arquivo `0010` do disco**, e não recomposto aqui. Recompô-lo faria a
// asserção concordar com quem a escreveu — é a mesma razão pela qual o CT-007 relê a política da
// migração em vez de reescrevê-la no teste.
//
// **A instância é DEDICADA**, como a do CT-007 e a do CT-107: as duas variantes são DDL sobre um
// objeto que os demais casos deste arquivo consultam, e recriá-las na instância compartilhada
// mudaria o que eles examinam.
//
// ===========================================================================
// MUTANTE EXECUTADO SOBRE A MIGRAÇÃO — MT-SI1 (2026-08-10)
// ===========================================================================
//
// A prova de falsificação não para nas variantes que este caso cria: ela alcança o ARQUIVO
// versionado. O atributo `WITH (security_invoker = true)` foi removido da
// `0010_seguranca_cobranca.sql` real, a suíte foi invocada pelo **script do pacote**
// (`pnpm --filter @sysloc/db test`, nunca `vitest run` avulso — `.claude/rules/testing-stack.md`), e
// o resultado foi medido:
//
//   * **controle** — árvore íntegra: `88 passed`;
//   * **MT-SI1 · atributo removido da migração real**: `13 failed | 75 passed`. Reprovam o **CT-523**
//     (por não achar o cabeçalho da visão na migração, que é o modo de falha desejado: ele NOMEIA o
//     que sumiu) e **doze casos que afirmam `excecoes: []`**, entre eles o CT-300, o CT-301, o
//     CT-421 e todas as variantes do CT-009 — todos com
//     `{ motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO', tabela: 'negocio.cobranca_derivada' }` a mais;
//   * **reversão** — o arquivo foi restaurado e conferido idêntico ao original por `sha256sum`
//     (`5c91980109…`), e o controle voltou a `88 passed`.
//
// ---------------------------------------------------------------------------
// O CT-522 **não** reprova sob o MT-SI1, e a premissa do card foi refutada pela medição
// ---------------------------------------------------------------------------
//
// O card previa que a migração mutada faria o CT-522 reprovar. **Não faz**, e a razão é estrutural,
// não um defeito do caso: a visão que a `0010` cria pertence a `sysloc_migracao`, que é dono das
// tabelas-base mas **não contorna a política** — o `FORCE ROW LEVEL SECURITY` do bloco 1 alcança
// também o dono. Sem `security_invoker`, a política continua sendo avaliada, com os direitos da dona
// e sobre a MESMA variável de sessão que quem consulta fixou; o conjunto devolvido é o mesmo, e o
// vazamento não acontece.
//
// O vazamento comportamental exige dona que contorne RLS — e é exatamente essa condição que a perna
// 2 deste caso CONSTRÓI, recriando a visão pela superusuária. Ela é, portanto, a prova
// comportamental permanente, e ela não depende de o `FORCE` estar lá; a guarda de catálogo é a
// segunda via, independente, e é ela que responde pelo objeto REAL.
//
// Isto é registro de medição, e não conveniência: o que o atributo garante hoje é que a visão não
// possa ser caminho mais fraco que a tabela **seja quem for a dona** — incluindo o dia em que uma
// migração for aplicada por papel privilegiado, ou em que o `FORCE` de uma tabela-base for perdido.
// É literalmente o invariante que o D38 instalou, e é por isso que o marcador `DECISÃO FECHADA` da
// `0010` fala em *provar por outro mecanismo*, e não em *hoje dá no mesmo*.
//
// A âncora deste registro é SIMBÓLICA — {@link ATRIBUTO_DE_DELEGACAO} e {@link MIGRACAO_DA_COBRANCA}
// —, e nunca número de linha.

/** A migração autoral desta fatia, de onde o corpo da visão é lido. */
const MIGRACAO_DA_COBRANCA = new URL('../migracoes/0010_seguranca_cobranca.sql', import.meta.url);

/** O atributo que faz a visão delegar. Escrito UMA vez: ele é procurado, aplicado e omitido. */
const ATRIBUTO_DE_DELEGACAO = 'WITH (security_invoker = true)';

/** O cabeçalho literal da criação da visão na migração — a âncora do recorte do corpo. */
const ABERTURA_DA_VISAO = `CREATE VIEW "${VISAO_DERIVADA.replace('.', '"."')}"\n\t${ATRIBUTO_DE_DELEGACAO} AS\n`;

/** O terminador de instrução que a migração usa, e onde o corpo da visão termina. */
const FIM_DA_INSTRUCAO = ';--> statement-breakpoint';

/**
 * O corpo da visão, recortado da migração do disco.
 *
 * Levanta NOMEANDO o que não encontrou, em vez de devolver cadeia vazia: um recorte que falhasse em
 * silêncio criaria uma visão vazia, e as duas pernas do caso ficariam iguais — verdes sobre nada.
 */
async function corpoDaVisaoDerivada(): Promise<string> {
  const migracao = await readFile(MIGRACAO_DA_COBRANCA, 'utf8');
  const abertura = migracao.indexOf(ABERTURA_DA_VISAO);
  if (abertura < 0) {
    throw new Error(
      `não encontrei ${JSON.stringify(ABERTURA_DA_VISAO)} em 0010_seguranca_cobranca.sql — o ` +
        'corpo da visão precisa vir da migração, nunca ser recomposto neste arquivo',
    );
  }

  const inicioDoCorpo = abertura + ABERTURA_DA_VISAO.length;
  const fim = migracao.indexOf(FIM_DA_INSTRUCAO, inicioDoCorpo);
  if (fim < 0) {
    throw new Error('a criação da visão em 0010_seguranca_cobranca.sql não termina em `;`');
  }

  return migracao.slice(inicioDoCorpo, fim);
}

describe('CT-523 — a visão da cobrança delega o isolamento, e sem o atributo ela vaza', () => {
  it(
    'CT-523 — sem `security_invoker` a cobrança de outra empresa atravessa a leitura e a guarda acusa a visão',
    async () => {
      // Instância DEDICADA — ver o cabeçalho.
      const banco = await bancoEfemero();

      try {
        const doDono = conexaoDeMigracao(banco);
        const daSuperusuaria = conexaoSuperusuaria(banco);
        const corpo = await corpoDaVisaoDerivada();

        // O recorte tem de ter trazido a consulta, e não um pedaço dela: sem esta âncora, um corpo
        // truncado produziria uma visão que reprova por sintaxe, longe da causa.
        expect(corpo).toContain('FROM "negocio"."cobranca" c');
        expect(corpo).toContain('LEFT JOIN "negocio"."configuracao_de_mora" m');
        // E ele NÃO carrega o atributo: ele é aplicado (ou omitido) pelo caso, e é essa omissão que
        // separa as duas pernas.
        expect(corpo).not.toContain(ATRIBUTO_DE_DELEGACAO);

        const acesso = abrir(banco.cadeiaConexao);

        try {
          await semearAsDuasCarteiras(acesso);

          // --- Perna 1: a visão COMO A MIGRAÇÃO A CRIOU, que delega -----------------------
          //
          // Nada é recriado aqui: o que se lê é o objeto real, criado pelo papel de migração ao
          // aplicar a `0010`. É o controle ANTES do par controle→mutante→controle.
          const peloDelegante = await lerDerivada(acesso, CONTEXTO_DE_A);
          expect(peloDelegante.map((linha) => linha.id)).toEqual([COBRANCA_DE_A]);
          expect(
            intersecao(
              peloDelegante.map((linha) => linha.id),
              [COBRANCA_DE_B],
            ),
          ).toEqual([]);

          // A primeira via de detecção, sobre o objeto íntegro: a visão consta das examinadas E não
          // rende exceção. As duas metades importam — uma visão aprovada por estar EXCLUÍDA do exame
          // também produziria `excecoes: []`.
          const coberturaComDelegacao = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
          expect(coberturaComDelegacao.excecoes).toEqual([]);
          expect(coberturaComDelegacao.tabelasExaminadas).toContain(VISAO_DERIVADA);

          // --- Perna 2: a MESMA visão, sem o atributo e de dona privilegiada ---------------
          //
          // O corpo é o mesmo, o nome é o mesmo e o chamador é o mesmo — o papel da aplicação, pela
          // cadeia sem privilégio. A ÚNICA coisa que muda é o atributo e a dona, e é por isso que o
          // que a perna seguinte observar é atribuível à visão, e não ao chamador.
          await executarPrivilegiado(daSuperusuaria, [
            `DROP VIEW ${VISAO_DERIVADA}`,
            `CREATE VIEW ${VISAO_DERIVADA} AS ${corpo}`,
            `GRANT SELECT ON ${VISAO_DERIVADA} TO ${PAPEL_DA_APLICACAO}`,
          ]);

          const peloVazante = await lerDerivada(acesso, CONTEXTO_DE_A);
          expect(
            intersecao(
              peloVazante.map((linha) => linha.id),
              [COBRANCA_DE_B],
            ),
            'a visão de dona privilegiada deveria vazar B — se não vaza, a premissa do CT-523 ' +
              'mudou e o critério de `catalogo.ts` precisa ser reavaliado, não o teste',
          ).toEqual([COBRANCA_DE_B]);

          // O vazamento acontece com o MESMO contexto fixado que a perna 1 usou — não é ausência de
          // contexto. É o que prova que a diferença está na visão.
          expect(peloVazante.map((linha) => linha.id)).not.toEqual(
            peloDelegante.map((linha) => linha.id),
          );

          // A segunda via de detecção, sobre o objeto defeituoso: EXATAMENTE uma exceção, com o nome
          // da visão e o motivo próprio dela — não "alguma exceção".
          const coberturaSemDelegacao = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
          expect(coberturaSemDelegacao.excecoes).toEqual([
            { tabela: VISAO_DERIVADA, motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO' },
          ]);
          expect(coberturaSemDelegacao.tabelasExaminadas).toContain(VISAO_DERIVADA);

          // --- Restauração: o controle DEPOIS ----------------------------------------------
          //
          // A visão volta a nascer do papel de MIGRAÇÃO e com o atributo, que é o estado que a
          // `0010` aplica. Sem esta terceira perna, "reprovou" poderia ser estado residual.
          await executarPrivilegiado(daSuperusuaria, [`DROP VIEW ${VISAO_DERIVADA}`]);
          await executarPrivilegiado(doDono, [
            `CREATE VIEW ${VISAO_DERIVADA} ${ATRIBUTO_DE_DELEGACAO} AS ${corpo}`,
          ]);

          const restaurada = await lerDerivada(acesso, CONTEXTO_DE_A);
          expect(restaurada.map((linha) => linha.id)).toEqual([COBRANCA_DE_A]);
          expect((await verificarCoberturaDeIsolamento(banco.cadeiaConexao)).excecoes).toEqual([]);
        } finally {
          await acesso.encerrar();
        }
      } finally {
        await banco.parar();
      }
    },
    LIMITE_DA_FALSIFICACAO_MS,
  );
});
