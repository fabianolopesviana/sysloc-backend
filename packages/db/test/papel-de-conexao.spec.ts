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
 * | CA-04    | CT-406  | As duas funções de emissão da série (`0008`) leem o contexto de empresa
 * | CA-18    |         | EXCLUSIVAMENTE de `current_setting('app.empresa_id')` e **levantam** quando
 * |          |         | ele está ausente, nomeando-o na mensagem; e a introspecção do catálogo
 * |          |         | mostra que a assinatura de nenhuma delas aceita empresa por parâmetro —
 * |          |         | de modo que pedir o contador de OUTRA empresa é irrepresentável, e não
 * |          |         | apenas recusado. A recusa não deixa resíduo: nenhuma sequência é criada.
 * |          |         | O companheiro POSITIVO, com o contexto fixado, é o que impede o caso de
 * |          |         | ficar verde sobre uma função que levantasse sempre. E as DUAS funções
 * |          |         | guardam o ano com a MESMA faixa: nulo, abaixo do piso e acima do teto são
 * |          |         | recusados com contexto VÁLIDO fixado — o que discrimina a guarda de faixa
 * |          |         | da guarda de contexto —, e a recusa também não deixa contador de escopo
 * |          |         | indeterminado para trás. |
 * | CA-04    | CT-431  | O ÚNICO privilégio que a `0008` concede a `sysloc_app` é `EXECUTE` sobre
 * | CA-18    |         | as duas funções: ele as executa, e o `nextval` DIRETO sobre a sequência do
 * |          |         | contador é recusado por `42501` — enquanto o papel DONO o executa, o que
 * |          |         | prova que a recusa é de privilégio e não de objeto ausente. Pelo catálogo,
 * |          |         | a lista de concessões das duas funções é exatamente
 * |          |         | `{sysloc_app, sysloc_migracao} × EXECUTE`: **`PUBLIC` não está nela**, e
 * |          |         | `sysloc_app` não tem privilégio algum sobre a sequência. |
 * | CA-15    | CT-735  | Chamada por `sysloc_app` e **SEM `app.empresa_id` fixado**,
 * |          |         | `negocio.resolver_portador_de_confirmacao` devolve a tripla
 * |          |         | `(empresa_id, locatario_id, consumido_em)` do portador vivo — a resolução
 * |          |         | ACONTECE sem contexto, que é a propriedade central da rota sem sessão
 * |          |         | (ADR-0027). Os companheiros negativos — derivado inexistente, portador
 * |          |         | VENCIDO e portador INVALIDADO — devolvem zero linhas e são
 * |          |         | indistinguíveis entre si (RN-14). E a mesma leitura, feita DIRETO na
 * |          |         | tabela sem contexto, continua devolvendo vazio, enquanto com contexto
 * |          |         | devolve as três linhas: a política segue fechada, e o que atravessa é a
 * |          |         | função — não um isolamento afrouxado. |
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
import { criarPessoa } from '../src/cadastro-de-pessoa.ts';
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

/**
 * As tabelas do schema de negócio, na ordem em que o catálogo as devolve.
 *
 * SUT_IS_CORRECT_BECAUSE: o valor esperado é do CASO, não do SUT — ele existe justamente para que
 * uma consulta que não alcançasse tabela nenhuma não passe por verde. A T2 da fatia
 * `cadastro-de-imoveis-e-pessoas` criou SEIS tabelas em `negocio` pela migração `0005`, a T3 da
 * fatia `contratos-de-locacao` acrescentou DUAS pela `0007`, a T3 da fatia `cobranca-e-mora`
 * acrescentou DUAS pela `0009`, a T3 da fatia `regua-de-cobranca` acrescentou DUAS pela `0011`, e a
 * T3 da sub-fatia `documentos-e-confirmacao` acrescenta UMA pela `0013`. O
 * papel da conexão — que é o que estes casos provam — não mudou: `sysloc_app` continua sem
 * privilégio, e a tabela nova continua pertencendo a `sysloc_migracao`. Declarar as quinze é a
 * atualização legítima; derivar a lista da própria consulta faria o esperado vir da mesma fonte que
 * o obtido, e a asserção deixaria de poder falhar. **Crescimento da lista esperada é o caminho
 * legítimo; trocar a igualdade por contenção (`toContain`) seria regressão de prova.**
 *
 * A VISÃO `negocio.cobranca_derivada`, criada pela `0010`, **não aparece aqui**, e a ausência não é
 * esquecimento: a consulta que alimenta estes casos lê `pg_tables`, e o que eles afirmam é o DONO de
 * cada tabela. Quem responde pela visão é a guarda de cobertura, em `catalogo.spec.ts`.
 */
const TABELAS_DE_NEGOCIO_ESPERADAS = [
  'acesso_usuario_app',
  'acesso_usuario_permissao',
  'cobranca',
  'comodo',
  'configuracao_de_mora',
  'conjunto',
  'contrato',
  'contrato_fiador',
  'envio_de_cobranca',
  'fiador',
  'imovel',
  'locador',
  'locatario',
  'politica_de_aviso',
  'portador_de_confirmacao',
] as const;

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
      expect(observado.tabelasDeNegocio).toHaveLength(15);
      expect(observado.tabelasDeNegocio.map((linha) => linha.tabela)).toEqual([
        'acesso_usuario_app',
        'acesso_usuario_permissao',
        'cobranca',
        'comodo',
        'configuracao_de_mora',
        'conjunto',
        'contrato',
        'contrato_fiador',
        'envio_de_cobranca',
        'fiador',
        'imovel',
        'locador',
        'locatario',
        'politica_de_aviso',
        'portador_de_confirmacao',
      ]);
      // As quinze escritas por extenso, e não `map(() => …)`: a propriedade é afirmada POR TABELA, de
      // modo que uma delas que nascesse com outro dono apareça pela posição. Derivar a lista do
      // tamanho da anterior faria a contagem responder no lugar da propriedade.
      expect(observado.tabelasDeNegocio.map((linha) => linha.dono)).toEqual([
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
        'sysloc_migracao',
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
        "tableowner = current_user ('sysloc_migracao') em acesso_usuario_app, " +
          'acesso_usuario_permissao, cobranca, comodo, configuracao_de_mora, conjunto, contrato, ' +
          'contrato_fiador, envio_de_cobranca, fiador, imovel, locador, locatario, ' +
          'politica_de_aviso, portador_de_confirmacao',
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

// ===========================================================================
// CT-406 e CT-431 — o mecanismo de emissão da série, e o privilégio que o cerca
// ===========================================================================
//
// As duas funções `SECURITY DEFINER` da migração `0008` são a superfície de maior risco desta fatia,
// e por uma razão precisa: elas rodam com os direitos de `sysloc_migracao`, que é DONO das tabelas
// de `negocio`. Tudo o que elas aceitarem por argumento, a aplicação passa a poder pedir com o
// privilégio da dona — inclusive o que a política de linha lhe tira.
//
// É por isso que nenhuma das duas tem parâmetro de empresa, e é por isso que o CT-406 afirma a
// AUSÊNCIA dele por introspecção do catálogo, e não apenas o comportamento: comportamento se
// conserta com uma conferência a mais dentro da função; assinatura sem o parâmetro torna o pedido
// cruzado **irrepresentável**, que é a mesma escolha estrutural do isolamento entre empresas.
//
// O CT-431 fecha a outra metade — o privilégio. O `nextval` corre DENTRO da função; o papel da
// aplicação nunca toca a sequência, e não recebe `USAGE ON SEQUENCES`. A ADR-0020 registra entre os
// *Neutros* que alargar o privilégio do papel da aplicação **não é o caminho**, e este caso é o que
// impede que alguém o alargue "para simplificar" sem que nada acuse.

/** O escopo que o CT-431 usa. Ano fixo: o que se observa é o privilégio, não o valor emitido. */
const ANO_DO_CONTADOR = 2026;

/** O ano do CT-406 é OUTRO, para que a recusa dele não dependa do estado deixado pelo CT-431. */
const ANO_SEM_CONTEXTO = 2027;

/** `SQLSTATE` de privilégio insuficiente — o que o servidor devolve ao negar a sequência. */
const PRIVILEGIO_INSUFICIENTE = '42501';

/** `SQLSTATE` de `RAISE EXCEPTION` sem código próprio — o que as duas funções levantam. */
const EXCECAO_LEVANTADA = 'P0001';

/**
 * Os anos que a guarda de faixa das duas funções recusa, escritos como literal de SQL.
 *
 * Os três discriminam ramos diferentes da guarda, e nenhum é redundante: `NULL::integer` cobre a
 * função **não ser `STRICT`** — o corpo correria, e `format('contrato_%s_%s', NULL, …)` renderia
 * cadeia vazia no lugar do ano, criando um contador de escopo indeterminado; `1999` e `3000` cobrem
 * os dois extremos da faixa, e um só deles deixaria vivo um mutante que trocasse a comparação por
 * uma desigualdade de um lado só.
 */
const ANOS_FORA_DA_FAIXA = ['NULL::integer', '1999', '3000'] as const;

/** A mensagem única da guarda de faixa. `%` renderiza argumento nulo como `<NULL>` no `RAISE`. */
const RECUSA_DE_FAIXA = 'ano do contador fora da faixa admitida';

/** O desfecho de uma instrução, coletado em vez de abortar — mesmo padrão de `conferirPapel…`. */
interface DesfechoDeSql {
  readonly codigo: string;
  readonly mensagem: string;
}

/**
 * Executa uma instrução e devolve o desfecho como valor.
 *
 * `GRAVOU` é um desfecho legítimo e distinguível: o caso que espera recusa afirma o par
 * `(código, mensagem)` por igualdade, e uma execução bem-sucedida aparece como `GRAVOU` em vez de
 * passar despercebida.
 */
async function tentarSql(cadeia: string, instrucao: string): Promise<DesfechoDeSql> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    await sql.unsafe(instrucao);
    return { codigo: 'GRAVOU', mensagem: '' };
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? 'sem sqlstate';
    return { codigo, mensagem: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    await sql.end();
  }
}

/**
 * Executa uma instrução com o contexto de empresa VÁLIDO e fixado, e devolve o desfecho como valor.
 *
 * O contexto é fixado na SESSÃO (`is_local = false`) e não numa transação, e a escolha é conteúdo:
 * as duas instruções correm em autocommit, de modo que um `CREATE SEQUENCE` executado ANTES da
 * guarda ficaria commitado e apareceria no retrato de sequências do passo seguinte. Sob `sql.begin`
 * o desfazimento apagaria o resíduo, e a asserção de resíduo deixaria de poder falhar.
 */
async function tentarSqlComContexto(
  cadeia: string,
  empresaId: string,
  instrucao: string,
): Promise<DesfechoDeSql> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    await sql`SELECT set_config('app.empresa_id', ${empresaId}, false)`;
    await sql.unsafe(instrucao);
    return { codigo: 'GRAVOU', mensagem: '' };
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? 'sem sqlstate';
    return { codigo, mensagem: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    await sql.end();
  }
}

/** As sequências de `negocio`, ordenadas pelo nome. É o que o CT-406 compara antes e depois. */
async function sequenciasDeNegocio(cadeia: string): Promise<string[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<{ nome: string }[]>`
      SELECT c.relname AS nome
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'negocio' AND c.relkind = 'S'
       ORDER BY c.relname
    `;
    return linhas.map((linha) => linha.nome);
  } finally {
    await sql.end();
  }
}

/** Assinatura de cada função de `negocio`, tal como o catálogo a reconstrói. */
interface AssinaturaDeFuncao {
  readonly nome: string;
  readonly argumentos: string;
  readonly seguranca: string;
  readonly caminhoDeBusca: string;
}

async function assinaturasDeNegocio(cadeia: string): Promise<AssinaturaDeFuncao[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    return await sql<AssinaturaDeFuncao[]>`
      SELECT p.proname                          AS nome,
             pg_get_function_arguments(p.oid)   AS argumentos,
             CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS seguranca,
             coalesce(array_to_string(p.proconfig, ' | '), 'SEM CONFIGURACAO') AS "caminhoDeBusca"
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'negocio'
       ORDER BY p.proname
    `;
  } finally {
    await sql.end();
  }
}

/**
 * Toda concessão viva sobre as funções de `negocio`, no formato `função → beneficiário → privilégio`.
 *
 * `grantee = 0` é `PUBLIC` no catálogo, e é por isso que a consulta o traduz em vez de filtrá-lo:
 * filtrar esconderia justamente o que o caso procura. A lista é afirmada por IGUALDADE — uma
 * concessão a mais, para quem for, aparece como linha nova.
 */
async function concessoesDasFuncoes(cadeia: string): Promise<string[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<{ linha: string }[]>`
      SELECT p.proname || ' -> ' ||
             CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END ||
             ' -> ' || a.privilege_type AS linha
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        CROSS JOIN LATERAL aclexplode(p.proacl) AS a
       WHERE n.nspname = 'negocio'
       ORDER BY 1
    `;
    return linhas.map((linha) => linha.linha);
  } finally {
    await sql.end();
  }
}

/** Emite um número sob o contexto de uma empresa, pelo caminho que a borda usará (§7.4). */
async function emitirNumero(cadeia: string, empresaId: string, ano: number): Promise<string> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    // As DUAS unidades, na ordem da §7.4: a primeira cria e COMMITA a sequência, a segunda a
    // consome. Fundi-las faria o desfazimento devolver o número, contra a ADR-0015.
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      await tx`SELECT negocio.garantir_contador_de_contrato(${ano})`;
    });
    return await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      const [linha] = await tx<{ numero: string }[]>`
        SELECT negocio.proximo_numero_de_contrato(${ano})::text AS numero
      `;
      if (linha === undefined) {
        throw new Error('a emissão não devolveu linha');
      }
      return linha.numero;
    });
  } finally {
    await sql.end();
  }
}

describe('emissão da série declarada — contexto e privilégio', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-406 — a emissão recusa sem contexto de empresa, e a assinatura não aceita empresa por parâmetro',
    async () => {
      // O retrato ANTES, e não "a lista vazia": o caso não pode depender da ordem em que os `it`
      // deste arquivo rodam, e o que ele afirma é que a recusa NÃO DEIXA RESÍDUO — comparação
      // antes/depois, no molde das contagens cruas do resto da suíte.
      const antes = await sequenciasDeNegocio(banco.cadeiaConexao);

      // --- Passo 1: as duas funções, chamadas SEM contexto -------------------------------------
      //
      // A chamada é direta, por SQL, sem passar por `contextoDeTenant.executarCom` — é o que
      // reproduz o estado real de uma conexão que ninguém preparou, no mesmo padrão do CT-005 de
      // `isolamento.spec.ts`.
      const semContexto = [
        await tentarSql(
          banco.cadeiaConexao,
          `SELECT negocio.proximo_numero_de_contrato(${ANO_SEM_CONTEXTO})`,
        ),
        await tentarSql(
          banco.cadeiaConexao,
          `SELECT negocio.garantir_contador_de_contrato(${ANO_SEM_CONTEXTO})`,
        ),
      ];

      // O SQLSTATE **e** a mensagem, por igualdade: `P0001` sozinho não diz que foi o contexto que
      // faltou — qualquer `RAISE` da função devolveria o mesmo —, e a mensagem sozinha não diz que a
      // recusa veio do servidor. A mensagem NOMEIA `app.empresa_id`, que é a variável de sessão em
      // falta, e não ecoa entrada nenhuma.
      expect(semContexto.map((desfecho) => `${desfecho.codigo} · ${desfecho.mensagem}`)).toEqual([
        `${EXCECAO_LEVANTADA} · contexto de empresa ausente: app.empresa_id não está fixado nesta transação`,
        `${EXCECAO_LEVANTADA} · contexto de empresa ausente: app.empresa_id não está fixado nesta transação`,
      ]);

      // --- Passo 2: a recusa não deixa resíduo -------------------------------------------------
      //
      // Sem esta asserção, uma função que criasse a sequência ANTES de conferir o contexto passaria
      // pelo passo 1 e teria deixado um contador órfão — de escopo indeterminado — para trás.
      expect(await sequenciasDeNegocio(banco.cadeiaConexao)).toEqual(antes);

      // --- Passo 3: a ASSINATURA, pelo catálogo ------------------------------------------------
      //
      // Este é o passo que o comportamento não dá. A igualdade cobre quatro fatos de uma vez, e cada
      // um deles é um mutante morto:
      //
      //   * TODA função de `negocio` está aqui — uma a mais, criada para "facilitar", apareceria;
      //   * nenhuma das quatro da série tem parâmetro de empresa, e o `p_inicio bigint DEFAULT 1`
      //     está declarado com o padrão que a semeadura da F7 depende de poder omitir;
      //   * as quatro são `SECURITY DEFINER` — sem isso, o `nextval` correria com os direitos de
      //     quem chama e o CT-431 recusaria a chamada legítima;
      //   * as quatro fixam `search_path`, com o schema temporário em ÚLTIMO lugar. Uma
      //     `SECURITY DEFINER` sem `search_path` fixo é sequestrável por quem chama, e o catálogo é
      //     o único lugar onde essa propriedade é observável.
      //
      // SUT_IS_CORRECT_BECAUSE: a lista é do CASO e é EXATA de propósito, e a T3 da fatia
      // `cobranca-e-mora` cria TRÊS funções novas por decisão declarada — as duas da série da
      // cobrança (`0010`) e a `data_corrente_da_operacao`. O caso reprovaria não porque a superfície
      // cresceu por descuido, que é o defeito que ele existe para pegar, mas porque cresceu por
      // decisão que ele ainda não conhecia. **Nenhuma entrada anterior sai**, e a igualdade (nunca
      // contenção) segue sendo asserida.
      //
      // `data_corrente_da_operacao` entra com `INVOKER` e `SEM CONFIGURACAO`, e as duas coisas são o
      // conteúdo da linha, não ruído: ela **não** é `SECURITY DEFINER` — roda com os direitos de
      // quem chama e não empresta privilégio nenhum —, e por isso não precisa (nem deve) fixar
      // `search_path`: o `SET` a tornaria não-inlinável pelo planejador, e a comparação da visão com
      // `data_vencimento` deixaria de aproveitar índice. Se algum dia ela aparecer aqui como
      // `DEFINER`, é regressão de segurança, e é esta linha que a nomeia.
      expect(await assinaturasDeNegocio(banco.cadeiaConexao)).toEqual([
        {
          nome: 'data_corrente_da_operacao',
          argumentos: '',
          seguranca: 'INVOKER',
          caminhoDeBusca: 'SEM CONFIGURACAO',
        },
        {
          nome: 'garantir_contador_de_cobranca',
          argumentos: 'p_ano integer, p_inicio bigint DEFAULT 1',
          seguranca: 'DEFINER',
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
        },
        {
          nome: 'garantir_contador_de_contrato',
          argumentos: 'p_ano integer, p_inicio bigint DEFAULT 1',
          seguranca: 'DEFINER',
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
        },
        {
          nome: 'proximo_numero_de_cobranca',
          argumentos: 'p_ano integer',
          seguranca: 'DEFINER',
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
        },
        {
          nome: 'proximo_numero_de_contrato',
          argumentos: 'p_ano integer',
          seguranca: 'DEFINER',
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
        },
        // SUT_IS_CORRECT_BECAUSE: a lista é do CASO e é EXATA de propósito, e a T3 da sub-fatia
        // `documentos-e-confirmacao` cria UMA função nova por decisão declarada — a resolução do
        // portador (`0014`). O caso reprovaria não porque a superfície cresceu por descuido, que é o
        // defeito que ele existe para pegar, mas porque cresceu por decisão que ele ainda não
        // conhecia. **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo
        // asserida.
        //
        // Esta linha é, além disso, a prova de catálogo de DUAS propriedades que nenhum teste
        // comportamental dá:
        //
        //   * o único parâmetro é `p_derivado text` — **não há parâmetro de empresa** (ADR-0024). O
        //     contexto vem do registro que o portador resolve, e um `p_empresa uuid` acrescentado
        //     "para filtrar" apareceria aqui como diferença literal, exatamente como nas quatro da
        //     série;
        //   * `DEFINER` mais `search_path` fixo com o schema temporário em ÚLTIMO lugar — sem o
        //     `SET`, quem chama escolheria o caminho de resolução de nome e executaria objeto
        //     próprio com os direitos da dona. Numa função que atravessa a política de linha, essa
        //     é a diferença entre um furo declarado e um furo aberto.
        //
        // O que esta linha **não** prova é a superfície de RETORNO (as três colunas da §7.3, e
        // nenhuma a mais): `pg_get_function_arguments` devolve só os parâmetros de entrada — medido
        // nesta task, contra a instância efêmera. Quem afirma o retorno é o `CT-727`, na T8, e
        // prometer aqui o que a asserção não verifica seria asserção infalível.
        {
          nome: 'resolver_portador_de_confirmacao',
          argumentos: 'p_derivado text',
          seguranca: 'DEFINER',
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
        },
      ] satisfies AssinaturaDeFuncao[]);

      // --- Passo 4: o companheiro POSITIVO -----------------------------------------------------
      //
      // Sem ele, o caso ficaria verde sobre uma função que levantasse SEMPRE — e "recusa sem
      // contexto" não distinguiria isolamento de função quebrada. O escopo é o do CT-406, e o
      // primeiro número de um escopo novo é `1`, por `START WITH 1`.
      expect(await emitirNumero(banco.cadeiaConexao, EMPRESA_A.id, ANO_SEM_CONTEXTO)).toBe('1');

      // --- Passo 5: a guarda de faixa do ano, nas DUAS funções ---------------------------------
      //
      // O contexto aqui é VÁLIDO e fixado, e é isso que separa esta recusa da do passo 1: sem o
      // contexto, a guarda de contexto levantaria primeiro e a asserção ficaria verde sobre funções
      // sem guarda de faixa nenhuma. O par `(SQLSTATE, mensagem)` é afirmado por igualdade sobre as
      // SEIS linhas de uma vez — três entradas × duas funções —, porque o invariante é que as duas
      // superfícies pelas quais o escopo `(empresa, ano)` é nomeado tenham a MESMA superfície de
      // entrada: guardar só a que cria deixaria a que consome aceitar o ano nulo.
      //
      // Os dois mutantes foram medidos nesta task, um por função: retirar a guarda de
      // `garantir_contador_de_contrato` e retirar a de `proximo_numero_de_contrato` reprovam este
      // caso separadamente. É o par que discrimina — uma asserção sobre uma função só sobreviveria
      // à divergência entre as duas, que é justamente o defeito que o passo procura.
      const antesDaFaixa = await sequenciasDeNegocio(banco.cadeiaConexao);

      const foraDaFaixa: string[] = [];
      for (const funcao of ['garantir_contador_de_contrato', 'proximo_numero_de_contrato']) {
        for (const ano of ANOS_FORA_DA_FAIXA) {
          const desfecho = await tentarSqlComContexto(
            banco.cadeiaConexao,
            EMPRESA_A.id,
            `SELECT negocio.${funcao}(${ano})`,
          );
          foraDaFaixa.push(`${funcao}(${ano}) -> ${desfecho.codigo} · ${desfecho.mensagem}`);
        }
      }

      // O RESÍDUO é afirmado ANTES das mensagens, e a ordem é conteúdo: é ela que torna esta
      // asserção capaz de falhar. Sem a guarda, `garantir_…(NULL)` cria de fato
      // `contrato__<32 hexadecimais>` — um contador de escopo INDETERMINADO, permanente e invisível
      // à guarda de cobertura do catálogo, que exclui sequências por espécie —, e é este retrato,
      // não a mensagem, que nomeia o dano. Posta depois da igualdade de mensagens, ela nunca
      // chegaria a ser avaliada no mutante que ela discrimina.
      //
      // O que ela NÃO discrimina, medido nesta task: a guarda posta DEPOIS do `CREATE SEQUENCE`
      // sobrevive — a chamada corre em autocommit, e o `RAISE` desfaz a criação junto com a
      // instrução. Esse caminho é fechado pelo PostgreSQL, não por asserção, e afirmar o contrário
      // seria escrever uma asserção que não pode falhar.
      expect(await sequenciasDeNegocio(banco.cadeiaConexao)).toEqual(antesDaFaixa);

      expect(foraDaFaixa).toEqual([
        `garantir_contador_de_contrato(NULL::integer) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: <NULL>`,
        `garantir_contador_de_contrato(1999) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 1999`,
        `garantir_contador_de_contrato(3000) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 3000`,
        `proximo_numero_de_contrato(NULL::integer) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: <NULL>`,
        `proximo_numero_de_contrato(1999) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 1999`,
        `proximo_numero_de_contrato(3000) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 3000`,
      ]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-431 — o papel da aplicação executa as duas funções e não alcança a sequência diretamente',
    async () => {
      // --- Pré-condição: a sequência do escopo, criada pelo caminho legítimo -------------------
      //
      // A conexão é a do papel da APLICAÇÃO — a única que `bancoEfemero()` publica como campo. É ela
      // que a operação usa, e é sobre ela que a conclusão deste caso precisa valer.
      expect(await emitirNumero(banco.cadeiaConexao, EMPRESA_A.id, ANO_DO_CONTADOR)).toBe('1');

      const sequencias = await sequenciasDeNegocio(banco.cadeiaConexao);
      const contador = sequencias.find((nome) => nome.startsWith(`contrato_${ANO_DO_CONTADOR}_`));
      // O nome vem do catálogo, e não é recomposto aqui: recompô-lo reimplementaria no caso a regra
      // que a função aplica, e o par passaria a se conferir contra uma cópia de si mesmo.
      expect(contador).toBeTypeOf('string');
      const alvo = `negocio."${contador ?? ''}"`;

      // --- O que o papel da aplicação NÃO alcança ----------------------------------------------
      const direto = await tentarSql(banco.cadeiaConexao, `SELECT nextval('${alvo}')`);
      expect(direto.codigo).toBe(PRIVILEGIO_INSUFICIENTE);
      expect(direto.mensagem).toContain('permission denied for sequence');

      // O companheiro POSITIVO da recusa, e sem ele `42501` não distinguiria "sem privilégio" de
      // "objeto que não existe com esse nome": o papel DONO executa o mesmo `nextval` sobre o mesmo
      // objeto. A sequência existe, é utilizável, e o que separa os dois papéis é o privilégio.
      const peloDono = await tentarSql(conexaoDeMigracao(banco), `SELECT nextval('${alvo}')`);
      expect(peloDono).toEqual({ codigo: 'GRAVOU', mensagem: '' });

      // --- E a função continua funcionando para o papel da aplicação ---------------------------
      //
      // Lido DEPOIS da recusa e na mesma instância: é a metade que prova que o menor privilégio não
      // quebrou o caminho legítimo. O número é `3` porque o dono acabou de consumir o `2` — e a
      // igualdade exata é o que torna o avanço observável, em vez de "algum número".
      expect(await emitirNumero(banco.cadeiaConexao, EMPRESA_A.id, ANO_DO_CONTADOR)).toBe('3');

      // --- As concessões, pelo catálogo --------------------------------------------------------
      //
      // Igualdade sobre a lista inteira, e não `not.toContain('PUBLIC')`: a segunda ficaria verde
      // diante de um `GRANT ALL` a um papel qualquer, e o invariante é que o privilégio novo seja
      // **exclusivamente** `EXECUTE` para `sysloc_app` (mais o do dono, que é implícito à criação).
      //
      // SUT_IS_CORRECT_BECAUSE: a lista é do CASO e é EXATA de propósito, e a T3 da fatia
      // `cobranca-e-mora` cria as duas funções da série da COBRANÇA, com o mesmo par
      // `REVOKE`/`GRANT`. **Nenhuma entrada anterior sai.** `data_corrente_da_operacao` não aparece
      // aqui, e a ausência é a decisão: ela não é `SECURITY DEFINER`, seu `proacl` permanece nulo —
      // o padrão do PostgreSQL, `EXECUTE` a `PUBLIC` —, e `aclexplode(NULL)` não rende linha. O
      // `0010` registra por que revogá-la não fecharia risco algum e quebraria a leitura da visão
      // para todo papel criado depois.
      expect(await concessoesDasFuncoes(banco.cadeiaConexao)).toEqual([
        'garantir_contador_de_cobranca -> sysloc_app -> EXECUTE',
        'garantir_contador_de_cobranca -> sysloc_migracao -> EXECUTE',
        'garantir_contador_de_contrato -> sysloc_app -> EXECUTE',
        'garantir_contador_de_contrato -> sysloc_migracao -> EXECUTE',
        'proximo_numero_de_cobranca -> sysloc_app -> EXECUTE',
        'proximo_numero_de_cobranca -> sysloc_migracao -> EXECUTE',
        'proximo_numero_de_contrato -> sysloc_app -> EXECUTE',
        'proximo_numero_de_contrato -> sysloc_migracao -> EXECUTE',
        // SUT_IS_CORRECT_BECAUSE: a T3 da sub-fatia `documentos-e-confirmacao` cria a resolução do
        // portador com o MESMO par `REVOKE ALL … FROM PUBLIC` / `GRANT EXECUTE … TO "sysloc_app"`
        // (bloco 4 da `0014`). As duas linhas abaixo são o que a igualdade cobra: se o `REVOKE`
        // sumisse do arquivo, apareceria aqui uma terceira,
        // `resolver_portador_de_confirmacao -> PUBLIC -> EXECUTE` — e ela significaria que qualquer
        // papel capaz de conectar resolveria portador de qualquer empresa, atravessando a política
        // pelo `SECURITY DEFINER`. **Nenhuma entrada anterior sai.**
        //
        // SUT_IS_CORRECT_BECAUSE (rodada 2): a segunda linha diz `sysloc_resolucao`, e não
        // `sysloc_migracao`, porque a `0014` termina com `ALTER FUNCTION … OWNER TO
        // "sysloc_resolucao"` — a correção do achado CRÍTICO da Revisão Técnica. Ela **não** é uma
        // concessão nova: é a entrada implícita do DONO, que o `ALTER … OWNER` reescreve junto com a
        // propriedade. O papel de destino é `NOLOGIN` e não é dono de tabela alguma; o que ele
        // carrega é a política nominal do bloco 2 da `0014`, sem a qual a função devolve vazio. A
        // troca aparecer AQUI é a propriedade útil deste caso: mudar o dono de uma `SECURITY
        // DEFINER` é mudar com quais direitos ela roda, e a igualdade não deixa isso passar calado.
        'resolver_portador_de_confirmacao -> sysloc_app -> EXECUTE',
        'resolver_portador_de_confirmacao -> sysloc_resolucao -> EXECUTE',
      ]);

      // E nenhum dos três privilégios de sequência alcança o papel da aplicação. A afirmação é por
      // catálogo além de por comportamento: o `nextval` acima só exercita `USAGE`/`UPDATE`, e um
      // `SELECT` concedido por engano deixaria o valor corrente do contador de uma empresa legível
      // por qualquer conexão da aplicação.
      const privilegiosDaSequencia = await (async () => {
        const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });
        try {
          const [linha] = await sql<{ usa: boolean; le: boolean; escreve: boolean }[]>`
            SELECT has_sequence_privilege(${PAPEL_ESPERADO}, ${alvo}, 'USAGE')  AS usa,
                   has_sequence_privilege(${PAPEL_ESPERADO}, ${alvo}, 'SELECT') AS le,
                   has_sequence_privilege(${PAPEL_ESPERADO}, ${alvo}, 'UPDATE') AS escreve
          `;
          return linha;
        } finally {
          await sql.end();
        }
      })();
      expect(privilegiosDaSequencia).toEqual({ usa: false, le: false, escreve: false });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-735 — a resolução do portador acontece SEM contexto, e a política segue fechada
// ===========================================================================
//
// Este caso nasceu na rodada 2 da T3, e a razão dele é a razão de existir do mecanismo que a `0014`
// instala: a Revisão Técnica mediu que `SECURITY DEFINER` **não** basta para atravessar
// `FORCE ROW LEVEL SECURITY`. `DEFINER` troca `current_user` pelo DONO da função, e o dono era
// `sysloc_migracao` — que é também o dono da tabela, e é exatamente o papel que o `FORCE` deixa de
// isentar. Sem contexto, a política vira `empresa_id = NULL` e a função devolvia `[]` em 100% das
// chamadas do único cenário que ela existe para atender.
//
// O que a T3 tinha era cobertura de CATÁLOGO — assinatura, `prosecdef`, `search_path` e as duas
// concessões, todas no `CT-406`/`CT-431`. As quatro passavam integralmente sobre uma função morta. A
// lição está registrada porque ela se repete: **asserção de catálogo sobre um mecanismo prova que
// ele foi DECLARADO, nunca que ele FUNCIONA.**
//
// As três pernas deste caso não são redundantes entre si, e a ordem é conteúdo:
//
//   1. a leitura DIRETA da tabela sem contexto devolve vazio — a política de empresa continua
//      valendo, e nada foi afrouxado para a função passar;
//   2. a MESMA leitura com contexto devolve as três linhas — sem ela, a perna 1 ficaria verde contra
//      uma semeadura que não gravou nada, e o caso inteiro seria vácuo;
//   3. a função, sem contexto, devolve a tripla exata do portador vivo — é a travessia, e é o que a
//      rota sem sessão (ADR-0027) precisa que seja verdade.
//
// Ele **não** duplica o `CT-727` da T8: aquele mede a SUPERFÍCIE DE RETORNO (o conjunto de colunas,
// e o que ela não devolve); este mede que a RESOLUÇÃO ACONTECE.

/** O locatário semeado, e os três portadores dele — nomes literais, resolvidos por instância. */
const DERIVADO_VIVO = 'derivado-ct735-vivo';
const DERIVADO_VENCIDO = 'derivado-ct735-vencido';
const DERIVADO_INVALIDADO = 'derivado-ct735-invalidado';
/** O quarto derivado NUNCA é gravado: é o companheiro "inexistente" da indistinguibilidade. */
const DERIVADO_INEXISTENTE = 'derivado-ct735-que-nunca-existiu';

/** A tripla que a função publica, tal como o driver a devolve. */
interface PortadorResolvido {
  readonly empresa_id: string;
  readonly locatario_id: string;
  readonly consumido_em: Date | null;
}

/**
 * Semeia um locatário da empresa A e os TRÊS portadores dele, pelo caminho da operação.
 *
 * O locatário nasce por `criarPessoa` — a porta de produção —, e os portadores por instrução própria
 * sob o contexto da empresa: a emissão em `packages/db/src/portador-de-confirmacao.ts` é da T8, e
 * antecipá-la aqui faria este caso depender de código que ainda não existe.
 *
 * `expira_em` sai de `pg_catalog.now()` (ADR-0026), e nunca de um `Date` do processo: o prazo é
 * comparado DENTRO da função, com o relógio do banco, e fixá-lo pelo relógio do Node faria o caso
 * medir a diferença entre dois relógios.
 */
async function semearPortadoresDaEmpresaA(cadeia: string): Promise<string> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });

  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${EMPRESA_A.id}, true)`;

      const locatario = await criarPessoa(tx, 'locatario', {
        nome: 'Locatária do CT-735',
        tipoPessoa: 'PESSOA_FISICA',
        documentoPrincipal: '39053344705',
        rg: null,
        email: 'ct735@exemplo.test',
        telefone: '11999990000',
        logradouro: 'Rua da Resolução',
        numero: '735',
        complemento: null,
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01001000',
      });

      await tx`
        INSERT INTO negocio.portador_de_confirmacao
                    (empresa_id, locatario_id, derivado, expira_em, invalidado_em)
        VALUES
          (${EMPRESA_A.id}, ${locatario.id}, ${DERIVADO_VIVO},
           pg_catalog.now() + interval '1 day', NULL),
          (${EMPRESA_A.id}, ${locatario.id}, ${DERIVADO_VENCIDO},
           pg_catalog.now() - interval '1 day', NULL),
          (${EMPRESA_A.id}, ${locatario.id}, ${DERIVADO_INVALIDADO},
           pg_catalog.now() + interval '1 day', pg_catalog.now())
      `;

      return locatario.id;
    });
  } finally {
    await sql.end();
  }
}

/** Chama a função **sem contexto algum** — o estado exato de uma conexão que ninguém preparou. */
async function resolverSemContexto(cadeia: string, derivado: string): Promise<PortadorResolvido[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<PortadorResolvido[]>`
      SELECT * FROM negocio.resolver_portador_de_confirmacao(${derivado})
    `;
    return linhas.map((linha) => ({ ...linha }));
  } finally {
    await sql.end();
  }
}

/** Quantos portadores a tabela devolve pela leitura DIRETA, com o contexto dado ou sem nenhum. */
async function contarPortadores(cadeia: string, empresaId: string | null): Promise<number> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    return await sql.begin(async (tx) => {
      if (empresaId !== null) {
        await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      }
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*)::text AS total FROM negocio.portador_de_confirmacao
      `;
      return Number(linha?.total ?? '-1');
    });
  } finally {
    await sql.end();
  }
}

/** O papel `NOLOGIN` que a `0014` instala como dono da função, e nada mais. */
const PAPEL_RESOLUCAO = 'sysloc_resolucao';

/** O mecanismo inteiro, tal como o catálogo o guarda — dono, políticas e privilégio do papel. */
interface RetratoDoMecanismo {
  readonly donoDaFuncao: string;
  readonly politicas: readonly string[];
  readonly papel: {
    readonly conecta: boolean;
    readonly superusuario: boolean;
    readonly contornaPolitica: boolean;
    readonly usaSchema: boolean;
    readonly criaNoSchema: boolean;
    readonly lePortador: boolean;
    readonly escrevePortador: boolean;
    readonly tabelasDeQueEhDono: number;
  };
}

/**
 * Lê do catálogo as três peças de que a travessia depende, para afirmá-las numa igualdade só.
 *
 * Elas estão juntas de propósito: separadas, cada uma seria uma asserção de catálogo do tipo que já
 * ficou verde sobre uma função morta (ver o cabeçalho deste bloco). Aqui elas vêm DEPOIS das três
 * pernas comportamentais, e o que fazem é nomear QUAL peça caiu quando o comportamento cair —
 * papel virou dono de tabela, `CREATE` ficou concedido, a política nominal alargou.
 */
async function retratoDoMecanismo(cadeia: string): Promise<RetratoDoMecanismo> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });

  try {
    const [dono] = await sql<{ dono: string }[]>`
      SELECT pg_get_userbyid(p.proowner) AS dono
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'negocio' AND p.proname = 'resolver_portador_de_confirmacao'
    `;

    // As políticas da tabela, inteiras: nome, comando, papéis alcançados e as duas expressões. É a
    // lista que CRESCEU nesta correção, e ela é cobrada por igualdade — uma terceira política, ou
    // um `TO` alargado para `public`, aparece como diferença literal.
    const politicas = await sql<{ linha: string }[]>`
      SELECT policyname || ' | ' || cmd || ' | ' || array_to_string(roles, ',') ||
             ' | usando=' || coalesce(qual, '(nenhum)') ||
             ' | checando=' || coalesce(with_check, '(nenhum)') AS linha
        FROM pg_catalog.pg_policies
       WHERE schemaname = 'negocio' AND tablename = 'portador_de_confirmacao'
       ORDER BY policyname
    `;

    const [papel] = await sql<
      {
        conecta: boolean;
        superusuario: boolean;
        contornaPolitica: boolean;
        usaSchema: boolean;
        criaNoSchema: boolean;
        lePortador: boolean;
        escrevePortador: boolean;
        tabelasDeQueEhDono: string;
      }[]
    >`
      SELECT r.rolcanlogin  AS conecta,
             r.rolsuper     AS "superusuario",
             r.rolbypassrls AS "contornaPolitica",
             has_schema_privilege(${PAPEL_RESOLUCAO}, 'negocio', 'USAGE')  AS "usaSchema",
             has_schema_privilege(${PAPEL_RESOLUCAO}, 'negocio', 'CREATE') AS "criaNoSchema",
             has_table_privilege(
               ${PAPEL_RESOLUCAO}, 'negocio.portador_de_confirmacao', 'SELECT') AS "lePortador",
             has_table_privilege(
               ${PAPEL_RESOLUCAO}, 'negocio.portador_de_confirmacao', 'UPDATE') AS "escrevePortador",
             (SELECT count(*)::text FROM pg_tables
               WHERE schemaname = 'negocio' AND tableowner = ${PAPEL_RESOLUCAO})
                                            AS "tabelasDeQueEhDono"
        FROM pg_catalog.pg_roles r
       WHERE r.rolname = ${PAPEL_RESOLUCAO}
    `;

    if (dono === undefined || papel === undefined) {
      throw new Error(
        'o catálogo não devolveu a função `resolver_portador_de_confirmacao` ou o papel ' +
          `'${PAPEL_RESOLUCAO}' — sem eles este caso não teria o que examinar`,
      );
    }

    return {
      donoDaFuncao: dono.dono,
      politicas: politicas.map((politica) => politica.linha),
      papel: {
        conecta: papel.conecta,
        superusuario: papel.superusuario,
        contornaPolitica: papel.contornaPolitica,
        usaSchema: papel.usaSchema,
        criaNoSchema: papel.criaNoSchema,
        lePortador: papel.lePortador,
        escrevePortador: papel.escrevePortador,
        tabelasDeQueEhDono: Number(papel.tabelasDeQueEhDono),
      },
    };
  } finally {
    await sql.end();
  }
}

/** A expressão de isolamento por empresa, tal como as seis migrações de segurança a escrevem. */
const EXPRESSAO_DE_ISOLAMENTO =
  "(empresa_id = (NULLIF(current_setting('app.empresa_id'::text, true), ''::text))::uuid)";

describe('CT-735 — a função resolve o portador sem contexto, e a política continua fechada', () => {
  let banco: BancoMigrado;
  let locatarioId: string;

  beforeAll(async () => {
    banco = await bancoEfemero();
    locatarioId = await semearPortadoresDaEmpresaA(banco.cadeiaConexao);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-735 — sem `app.empresa_id`, a resolução devolve a tripla do portador vivo; vencido, invalidado e inexistente devolvem o MESMO vazio',
    async () => {
      // --- Perna 1: a política continua fechada para a leitura direta -------------------------
      expect(await contarPortadores(banco.cadeiaConexao, null)).toBe(0);

      // --- Perna 2: e as linhas existem — sem isto, a perna 1 seria vácuo ---------------------
      expect(await contarPortadores(banco.cadeiaConexao, EMPRESA_A.id)).toBe(3);

      // --- Perna 3: a travessia ---------------------------------------------------------------
      //
      // Igualdade sobre a tripla inteira, e não `toHaveLength(1)`: o que a borda sem sessão precisa
      // é do `empresa_id` CERTO — um caso que só contasse linhas ficaria verde diante de uma função
      // que resolvesse o portador de outra empresa.
      expect(await resolverSemContexto(banco.cadeiaConexao, DERIVADO_VIVO)).toEqual([
        { empresa_id: EMPRESA_A.id, locatario_id: locatarioId, consumido_em: null },
      ]);

      // --- Os companheiros negativos, e a indistinguibilidade entre eles -----------------------
      //
      // As três recusas são coletadas e comparadas ENTRE SI, além de com o vazio: a RN-14 não pede
      // apenas que cada uma devolva nada, e sim que nenhuma delas seja distinguível da outra — é o
      // que impede a borda de vazar "existe, mas expirou".
      const recusas = [
        await resolverSemContexto(banco.cadeiaConexao, DERIVADO_INEXISTENTE),
        await resolverSemContexto(banco.cadeiaConexao, DERIVADO_VENCIDO),
        await resolverSemContexto(banco.cadeiaConexao, DERIVADO_INVALIDADO),
      ];
      expect(recusas).toEqual([[], [], []]);

      // --- Perna 4: o mecanismo, pelo catálogo, para NOMEAR a peça quando ela cair --------------
      //
      // Igualdade sobre o retrato inteiro. As duas políticas aparecem como lista, e é ela que
      // cresceu: a de isolamento por empresa continua `ALL` para `public`, com `USING` e
      // `WITH CHECK` idênticos, e a nova alcança **um papel só**, em `SELECT`. Alargar o `TO` para
      // `public`, ou dar-lhe `ALL`, aparece como diferença literal — e seria o furo real, porque
      // `USING (true)` fora de um papel nominal é a política de isolamento desligada.
      expect(await retratoDoMecanismo(banco.cadeiaConexao)).toEqual({
        donoDaFuncao: PAPEL_RESOLUCAO,
        politicas: [
          `portador_de_confirmacao_isolamento_empresa | ALL | public | usando=${EXPRESSAO_DE_ISOLAMENTO} | checando=${EXPRESSAO_DE_ISOLAMENTO}`,
          `portador_de_confirmacao_resolucao_sem_contexto | SELECT | ${PAPEL_RESOLUCAO} | usando=true | checando=(nenhum)`,
        ],
        papel: {
          // Ele não conecta e não contorna política nenhuma: a travessia é NOMINAL, dada pela
          // política acima, e não um `BYPASSRLS` disfarçado — que é o que a ADR-0008 rejeita.
          conecta: false,
          superusuario: false,
          contornaPolitica: false,
          // O privilégio de estado final: `USAGE` no schema e `SELECT` em UMA tabela. O `CREATE`
          // que o `ALTER … OWNER` exige é emprestado e devolvido dentro da própria `0014`, e é
          // esta linha que prova a devolução.
          usaSchema: true,
          criaNoSchema: false,
          lePortador: true,
          escrevePortador: false,
          tabelasDeQueEhDono: 0,
        },
      } satisfies RetratoDoMecanismo);
    },
    LIMITE_DO_CASO_MS,
  );
});
