/**
 * Papel da conexão — a prova de que a suíte de isolamento não está enganando a si mesma.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-17    | CT-001  | A conexão sobre a qual toda prova de isolamento roda pertence a um papel
 * |          |         | com `rolsuper = false`, `rolbypassrls = false`, sem pertencimento (direto
 * |          |         | ou herdado) ao papel dono, e que não é `tableowner` de nenhuma tabela do
 * |          |         | schema `negocio` — as quatro condições sob as quais o PostgreSQL
 * |          |         | ignoraria a RLS. |
 * | CA-17    | CT-002  | Executada sobre uma conexão privilegiada — o papel dono das tabelas ou o
 * | CA-03    |         | superusuário do agrupamento — a bateria do CT-001 REPROVA, nomeando o
 * |          |         | valor obtido em cada predicado; e a leitura de negócio pelo superusuário
 * |          |         | devolve também as linhas da outra empresa. As asserções discriminam
 * |          |         | privilégio em vez de serem infalíveis. |
 *
 * ===========================================================================
 * Por que este arquivo é o mais importante da fatia
 * ===========================================================================
 *
 * A ADR-0008 nomeia o modo de falha nos próprios *Cons*: **"suíte que conecte com o papel errado
 * fica verde sem provar nada"**. Sem o CT-001, toda a suíte de isolamento das tasks seguintes
 * poderia estar rodando com um papel que ignora a política — e passaria integralmente contra um
 * schema sem isolamento algum. Sem o CT-002, o CT-001 poderia ser um conjunto de asserções que
 * nunca reprovam, o que daria a mesma falsa segurança um nível acima.
 *
 * A bateria de predicados é **uma função só**, `conferirPapelDaConexao`, invocada com entradas
 * diferentes pelos dois casos. Reimplementá-la no caso negativo reproduziria o defeito registrado
 * em `.claude/rules/testing-stack.md` — a tabela que exercita a reimplementação do leitor dentro do
 * próprio verificador, e que aprovou 5/5 um alvo com o defeito de volta.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * As cadeias privilegiadas vêm dos acessórios `conexaoDeMigracao()` e `conexaoSuperusuaria()` de
 * `banco-efemero.ts`, e ficam confinadas a este arquivo. Nenhum símbolo, bandeira de ambiente ou
 * ramo condicional foi acrescentado a `packages/db/src/**` para que elas existam: os papéis nascem
 * do mesmo SQL que o provisionamento executa em operação.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import { ACESSOS_DA_EMPRESA_A, ACESSOS_DA_EMPRESA_B, EMPRESA_A } from '../src/semente.ts';
import {
  type BancoMigrado,
  bancoEfemero,
  conexaoDeMigracao,
  conexaoSuperusuaria,
} from './banco-efemero.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso só consulta catálogo e lê poucas linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 30_000;

/** O papel que a suíte de isolamento usa. Literal, e não derivado da cadeia de conexão. */
const PAPEL_ESPERADO = 'sysloc_app';

/** O papel dono dos objetos, do qual o papel da aplicação não pode ser membro. */
const PAPEL_DONO = 'sysloc_migracao';

/** As duas tabelas do schema de negócio nesta fatia, na ordem em que o catálogo as devolve. */
const TABELAS_DE_NEGOCIO_ESPERADAS = ['acesso_usuario_app', 'acesso_usuario_permissao'] as const;

interface TabelaDeNegocio {
  readonly tabela: string;
  readonly dono: string;
}

/** O que o catálogo respondeu sobre a identidade da própria conexão. */
interface ObservacaoDePapel {
  readonly usuarioCorrente: string;
  readonly superusuario: boolean;
  readonly contornaPolitica: boolean;
  readonly criaPapel: boolean;
  readonly membroDoPapelDono: boolean;
  readonly tabelasDeNegocio: readonly TabelaDeNegocio[];
}

interface ConferenciaDePapel {
  readonly observado: ObservacaoDePapel;
  /** Uma entrada por predicado violado, **nomeando o valor obtido**. Vazia = conexão adequada. */
  readonly reprovacoes: readonly string[];
}

/**
 * A bateria de predicados do CT-001, aplicada a uma cadeia de conexão qualquer.
 *
 * Ela **coleta** as reprovações em vez de abortar na primeira: é o que permite ao CT-002 aplicá-la a
 * uma conexão privilegiada e afirmar exatamente QUAIS predicados reprovaram. Uma bateria que
 * lançasse exceção só permitiria afirmar "reprovou", e "reprovou" não distingue a bateria que
 * discrimina privilégio daquela que quebrou por outro motivo.
 *
 * As consultas são todas ao catálogo do sistema, sobre a identidade da própria conexão — nenhuma
 * entrada de negócio participa.
 */
async function conferirPapelDaConexao(cadeiaDeConexao: string): Promise<ConferenciaDePapel> {
  const sql = abrirConexao(cadeiaDeConexao);

  try {
    const [atributos] = await sql<
      {
        usuario: string;
        superusuario: boolean;
        contornaPolitica: boolean;
        criaPapel: boolean;
        membroDoPapelDono: boolean;
      }[]
    >`
      SELECT current_user::text AS usuario,
             rolsuper           AS "superusuario",
             rolbypassrls       AS "contornaPolitica",
             rolcreaterole      AS "criaPapel",
             pg_has_role(current_user, ${PAPEL_DONO}, 'MEMBER') AS "membroDoPapelDono"
        FROM pg_roles
       WHERE rolname = current_user
    `;

    if (atributos === undefined) {
      throw new Error('o catálogo não devolveu linha para o papel corrente da conexão');
    }

    const tabelas = await sql<{ tabela: string; dono: string }[]>`
      SELECT tablename AS tabela, tableowner AS dono
        FROM pg_tables
       WHERE schemaname = 'negocio'
       ORDER BY tablename
    `;

    const observado: ObservacaoDePapel = {
      usuarioCorrente: atributos.usuario,
      superusuario: atributos.superusuario,
      contornaPolitica: atributos.contornaPolitica,
      criaPapel: atributos.criaPapel,
      membroDoPapelDono: atributos.membroDoPapelDono,
      tabelasDeNegocio: tabelas.map((linha) => ({ tabela: linha.tabela, dono: linha.dono })),
    };

    return { observado, reprovacoes: avaliar(observado) };
  } finally {
    await sql.end();
  }
}

/**
 * Os sete predicados, cada um produzindo uma reprovação que nomeia o valor obtido.
 *
 * Os quatro primeiros são as condições sob as quais o PostgreSQL ignoraria a RLS; o quinto é a
 * herança que produziria a quarta delas por caminho indireto; o sexto é a propriedade das tabelas.
 * O sétimo — a contagem — existe porque uma bateria sobre conjunto VAZIO passaria por verde: com o
 * schema `negocio` sem tabela alguma, os predicados de propriedade não examinariam nada e a
 * conclusão "nenhuma tabela é do papel da aplicação" seria verdadeira e inútil.
 */
function avaliar(observado: ObservacaoDePapel): string[] {
  const reprovacoes: string[] = [];

  if (observado.usuarioCorrente !== PAPEL_ESPERADO) {
    reprovacoes.push(
      `current_user = '${observado.usuarioCorrente}' (esperado '${PAPEL_ESPERADO}')`,
    );
  }
  if (observado.superusuario) {
    reprovacoes.push('rolsuper = true');
  }
  if (observado.contornaPolitica) {
    reprovacoes.push('rolbypassrls = true');
  }
  if (observado.criaPapel) {
    reprovacoes.push('rolcreaterole = true');
  }
  if (observado.membroDoPapelDono) {
    reprovacoes.push(`pg_has_role(current_user, '${PAPEL_DONO}', 'MEMBER') = true`);
  }

  const alheias = observado.tabelasDeNegocio.filter((linha) => linha.dono !== PAPEL_DONO);
  if (alheias.length > 0) {
    const detalhe = alheias.map((linha) => `${linha.tabela} -> '${linha.dono}'`).join(', ');
    reprovacoes.push(`tableowner != '${PAPEL_DONO}' em ${detalhe}`);
  }

  const proprias = observado.tabelasDeNegocio.filter(
    (linha) => linha.dono === observado.usuarioCorrente,
  );
  if (proprias.length > 0) {
    const detalhe = proprias.map((linha) => linha.tabela).join(', ');
    reprovacoes.push(`tableowner = current_user ('${observado.usuarioCorrente}') em ${detalhe}`);
  }

  if (observado.tabelasDeNegocio.length !== TABELAS_DE_NEGOCIO_ESPERADAS.length) {
    reprovacoes.push(
      `tabelas de negocio lidas = ${observado.tabelasDeNegocio.length} ` +
        `(esperado ${TABELAS_DE_NEGOCIO_ESPERADAS.length})`,
    );
  }

  return reprovacoes;
}

/**
 * Lê os identificadores de `negocio.acesso_usuario_app` visíveis a uma conexão, com o contexto de
 * empresa fixado na transação — o mesmo caminho que a unidade de trabalho usa em operação.
 */
async function lerAcessosNoContexto(
  cadeiaDeConexao: string,
  empresaId: string,
): Promise<readonly string[]> {
  const sql = abrirConexao(cadeiaDeConexao);
  const identificadores: string[] = [];

  try {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      const linhas = await tx<{ id: string }[]>`
        SELECT id FROM negocio.acesso_usuario_app ORDER BY id
      `;
      for (const linha of linhas) {
        identificadores.push(linha.id);
      }
    });
  } finally {
    await sql.end();
  }

  return identificadores;
}

const IDENTIFICADORES_DE_A = ACESSOS_DA_EMPRESA_A.map((acesso) => acesso.id);
const IDENTIFICADORES_DE_B = ACESSOS_DA_EMPRESA_B.map((acesso) => acesso.id);

describe('papel da conexão sobre a qual o isolamento é provado', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-001 — a conexão que a suíte de isolamento usa não tem privilégio capaz de contornar a política',
    async () => {
      const { observado, reprovacoes } = await conferirPapelDaConexao(banco.cadeiaConexao);

      expect(observado.usuarioCorrente).toBe('sysloc_app');
      expect(observado.superusuario).toBe(false);
      expect(observado.contornaPolitica).toBe(false);
      expect(observado.criaPapel).toBe(false);
      expect(observado.membroDoPapelDono).toBe(false);

      // A contagem é afirmada ANTES da propriedade, e é deliberada: sem ela, um schema `negocio`
      // vazio faria a asserção seguinte passar sem examinar tabela alguma.
      expect(observado.tabelasDeNegocio).toHaveLength(2);
      expect(observado.tabelasDeNegocio.map((linha) => linha.tabela)).toEqual([
        'acesso_usuario_app',
        'acesso_usuario_permissao',
      ]);
      expect(observado.tabelasDeNegocio.map((linha) => linha.dono)).toEqual([
        'sysloc_migracao',
        'sysloc_migracao',
      ]);

      expect(reprovacoes).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-002 — execução privilegiada não passa por verde: com o papel dono e com o superusuário, a bateria reprova',
    async () => {
      const dono = await conferirPapelDaConexao(conexaoDeMigracao(banco));

      // O papel dono não é superusuário e não contorna a política por atributo — ele reprova pelo
      // que o torna privilegiado de verdade: ser o DONO das tabelas, e ser ele próprio o papel do
      // qual a conexão da suíte não pode ser membro.
      expect(dono.observado.usuarioCorrente).toBe('sysloc_migracao');
      expect(dono.reprovacoes).toEqual([
        "current_user = 'sysloc_migracao' (esperado 'sysloc_app')",
        "pg_has_role(current_user, 'sysloc_migracao', 'MEMBER') = true",
        "tableowner = current_user ('sysloc_migracao') em acesso_usuario_app, acesso_usuario_permissao",
      ]);

      const superusuario = await conferirPapelDaConexao(conexaoSuperusuaria(banco));

      expect(superusuario.observado.superusuario).toBe(true);
      expect(superusuario.observado.contornaPolitica).toBe(true);
      expect(superusuario.reprovacoes).toEqual([
        `current_user = '${superusuario.observado.usuarioCorrente}' (esperado 'sysloc_app')`,
        'rolsuper = true',
        'rolbypassrls = true',
        'rolcreaterole = true',
        "pg_has_role(current_user, 'sysloc_migracao', 'MEMBER') = true",
      ]);

      // -------------------------------------------------------------------------------------
      // O outro eixo: o que cada conexão privilegiada ENXERGA no contexto da empresa A.
      //
      // Declaração explícita, e não afrouxamento (Obs do card): com `FORCE ROW LEVEL SECURITY`
      // aplicado, a política alcança TAMBÉM o dono das tabelas — então a leitura pelo papel dono
      // vem isolada, exatamente como a do papel da aplicação. É o `FORCE` funcionando, e é por
      // isso que o predicado de PROPRIEDADE (acima) continua sendo o que reprova o dono.
      //
      // O superusuário, esse, ignora a política com ou sem `FORCE` — e é a leitura dele que
      // demonstra que a suíte de isolamento só é significativa por causa do papel afirmado no
      // CT-001.
      // -------------------------------------------------------------------------------------
      const lidosPeloDono = await lerAcessosNoContexto(conexaoDeMigracao(banco), EMPRESA_A.id);
      expect(lidosPeloDono).toEqual(IDENTIFICADORES_DE_A);

      const lidosPeloSuperusuario = await lerAcessosNoContexto(
        conexaoSuperusuaria(banco),
        EMPRESA_A.id,
      );
      expect(lidosPeloSuperusuario).toEqual(
        [...IDENTIFICADORES_DE_A, ...IDENTIFICADORES_DE_B].sort(),
      );

      // A igualdade exata acima é a asserção dominante deste eixo, e ela IMPLICA a presença de cada
      // identificador da empresa B — o laço de `toContain` que existia aqui era restatement, e saiu
      // por isso (nenhum estado do alvo o faz reprovar com a igualdade verde).
      //
      // A comparação de contagem abaixo, essa, FICA: ela não é consequência da igualdade. Se a carga
      // inicial da empresa B degenerasse para vazio, `IDENTIFICADORES_DE_B` seria `[]`, a igualdade
      // acima passaria (leria só A), e o eixo inteiro — 'o superusuário enxerga o que o papel da
      // aplicação não enxerga' — ficaria vacuamente verde. É a mesma guarda de conjunto vazio que o
      // CT-001 instala com a asserção de contagem de tabelas, pelo mesmo motivo.
      expect(lidosPeloSuperusuario.length).toBeGreaterThan(lidosPeloDono.length);
    },
    LIMITE_DO_CASO_MS,
  );
});
