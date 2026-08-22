/**
 * O mecanismo do identificador perante o provedor — a composição das 18 posições e o contador de
 * escopo do SaaS. Casos CT-804, CT-805, CT-814, CT-815, CT-816 e CT-817 (T6) da fatia
 * `fundacao-bancaria`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | A1 · A3  | CT-804 | Compor a partir de competência e contador produz **sempre** 18 caracteres,
 * | CA-10    |        | com o contador preenchido à esquerda: `(202608, 1)`, `(202608, 42)` e
 * |          |        | `(202608, 999999999999)` devolvem `202608000000000001`,
 * |          |        | `202608000000000042` e `202608999999999999` — por **igualdade literal**,
 * |          |        | jamais por comprimento, que aprovaria um preenchimento à direita. As três
 * |          |        | saídas satisfazem `ESQUEMA_DO_IDENTIFICADOR_BANCARIO`, importado de
 * |          |        | `@sysloc/contracts`, e `LARGURA_DO_CONTADOR_BANCARIO` vale **12** — o valor
 * |          |        | por extenso, que é a decisão, e não um número que o caso descubra do SUT. |
 * | A2       | CT-805 | A composição é **total**: `(202608, 1_000_000_000_000)` — um a mais que o
 * |          |        | teto da sequência — levanta `ErroDeContadorForaDaLargura` e **nada** é
 * |          |        | devolvido. A mensagem **não ecoa** o valor recusado. As demais entradas que
 * |          |        | produziriam forma inválida (negativo, fracionário, competência fora de
 * |          |        | `AAAAMM`) também são recusadas antes de compor, de modo que nenhuma cadeia
 * |          |        | fora de forma exista — nem como valor intermediário (RN-07). ⚠️ Inclusive a
 * |          |        | competência de **seis caracteres que não é `AAAAMM`** (`-20268`, `2026.5`),
 * |          |        | que a conferência por comprimento aprovava — as duas pernas do `D21`,
 * |          |        | acrescentadas na intervenção dirigida de 2026-08-22. |
 * | A7       | CT-814 | `plataforma.proximo_identificador_bancario` tem **zero parâmetros**,
 * | CA-10    |        | `prosecdef` verdadeiro e `search_path` fixado; `sysloc_app` tem `EXECUTE`
 * | CA-11    |        | sobre ela e **nenhum** dos três privilégios (`SELECT`, `UPDATE`, `USAGE`)
 * |          |        | sobre `plataforma.identificador_bancario_seq`. Os cinco fatos numa
 * |          |        | igualdade só: o `EXECUTE` concedido é o companheiro POSITIVO das três
 * |          |        | recusas — sem ele, *"sem privilégio sobre a sequência"* também seria verdade
 * |          |        | sobre um papel que não pudesse fazer nada. A asserção de **zero
 * |          |        | parâmetros** é a medição literal da ADR-0033: com um parâmetro de empresa,
 * |          |        | pedir o contador em nome de uma empresa voltaria a ser representável. |
 * | A7       | CT-815 | **Nenhuma** das três formas de tocar o contador é alcançável pelo papel da
 * | RN-09    |        | aplicação: `nextval`, `setval` e `SELECT last_value` levantam **as três**
 * |          |        | `42501`, nomeando a sequência. As três palavras da RN-09 — *enxerga*,
 * |          |        | *influencia*, *alcança* — mapeiam uma a uma para `SELECT`, `setval` e
 * |          |        | `nextval`; provar só uma deixaria a regra dois terços aberta. |
 * | A4 · A5  | CT-816 | Chamadas sob contextos de empresas **distintas** devolvem identificadores
 * | CA-10    |        | diferentes e **consecutivos**, do MESMO contador: na ordem A → B → A, o
 * |          |        | segundo é a composição da competência dele com o contador do primeiro mais
 * |          |        | um, e o terceiro com o do segundo mais um — afirmado sobre a **cadeia
 * |          |        | inteira**. Dois contadores por empresa também dariam números diferentes; é
 * |          |        | a **consecutividade** que discrimina. E a competência dos três é a que
 * |          |        | `negocio.data_corrente_da_operacao()` publica na mesma unidade — não a do
 * |          |        | relógio do processo. |
 * | A4       | CT-816 | E o módulo **não tem relógio próprio**: o fonte executável (sem comentários)
 * |          | (b)    | não contém `new Date(` nem `Date.now(`, com o alcance do arquivo certo
 * |          |        | afirmado no mesmo caso. A perna é **estática** porque a comportamental não
 * |          |        | discrimina: as duas competências coincidem em quase todo instante do mês. |
 * | A6       | CT-817 | Número obtido em transação **desfeita** nunca é reentregue: obtido `n1` e
 * | CA-11    |        | abortada a unidade, a unidade seguinte recebe o contador `n1 + 1`. O furo é
 * |          |        | a consequência **aceita** (ADR-0033), e `n2 = n1` seria a falha que a CA-11
 * |          |        | existe para impedir. A contagem crua de identificadores gravados não entra
 * |          |        | porque esta fatia não grava nenhum: o que a unidade abortada deixaria para
 * |          |        | trás é o **avanço**, e é ele que o caso mede. |
 *
 * Rastreabilidade: `CA-10 → CT-804 (RN-07)` · `CA-10 → CT-805 (RN-07)` ·
 * `CA-10 → CT-814 (RN-09)` · `CA-11 → CT-814 (RN-09)` · `RN-09 → CT-815` ·
 * `CA-10 → CT-816 (RN-07)` · `CA-11 → CT-817 (RN-07)`.
 *
 * ===========================================================================
 * Colocação — a §3.5 da task é a autoridade
 * ===========================================================================
 *
 * A §19.2 do tech spec agrupa CT-816/CT-817 sob o cabeçalho de `certificado-do-provedor.spec.ts`, e
 * a §19.4(b) agrupa CT-814/CT-815 sob o mesmo. Os quatro são **do contador**, e a §3.5 da task
 * declara literalmente que este arquivo cobre *"não-reuso, avanço fora do desfazimento, ausência de
 * escopo por empresa, forma das 18 posições"*. Os invariantes são preservados na íntegra; o que muda
 * é em que arquivo eles moram.
 *
 * ===========================================================================
 * Precondição privilegiada — NENHUMA
 * ===========================================================================
 *
 * O contexto de empresa é fixado pela **unidade de trabalho real** (`contextoDeTenant.executarCom`
 * mais `emUnidadeDeTrabalho`), que é o mesmo par que a guarda e o controlador usam em operação, e o
 * contador é consumido pela porta pública sobre a cadeia do papel `sysloc_app`. A cadeia de migração
 * aparece **uma única vez**, no companheiro positivo do CT-815, e ali ela é conteúdo do caso: é o que
 * separa *"sem privilégio"* de *"objeto que não existe com esse nome"*.
 *
 * Nenhuma bandeira, semente condicional ou símbolo de produção foi acrescentado para os casos
 * existirem (Iron Law #6). O aborto do CT-817 é produzido pelo mecanismo que a produção já usa — uma
 * exceção levantada dentro da transação —, exatamente como o CT-536 da fatia `cobranca-e-mora`.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ESQUEMA_DO_IDENTIFICADOR_BANCARIO } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  comporIdentificadorBancario,
  ErroDeContadorForaDaLargura,
  LARGURA_DO_CONTADOR_BANCARIO,
  proximoIdentificadorBancario,
} from '../src/identificador-bancario.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';
import { semComentarios } from './varredura-de-fontes.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas unidades de trabalho e consultas escalares. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão basta: os casos correm em série dentro do arquivo. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// A forma publicada, escrita POR EXTENSO — a única coisa que este arquivo redigita
// ---------------------------------------------------------------------------

/**
 * As três composições esperadas, **por igualdade literal**.
 *
 * Elas são a **decisão** — 6 posições de competência mais 12 de contador, preenchido à esquerda —, e
 * não um valor que o caso descubra do próprio SUT. Derivá-las de `LARGURA_DO_CONTADOR_BANCARIO` faria
 * o caso concordar com qualquer largura que o contrato viesse a declarar, e é justamente a largura
 * que a RN-07 fixa. Mesmo desenho de `FORMA_DO_CODIGO` em `contrato.spec.ts` e da forma do código em
 * `cobranca.spec.ts`.
 *
 * O terceiro par é o **teto** da sequência (`MAXVALUE 999999999999`), e ele prende a fronteira por
 * dentro; o CT-805 a prende por fora, com um a mais.
 */
const COMPOSICOES_ESPERADAS: readonly (readonly [number, number, string])[] = [
  [202608, 1, '202608000000000001'],
  [202608, 42, '202608000000000042'],
  [202608, 999_999_999_999, '202608999999999999'],
];

/** A largura do contador, por extenso — o valor que a decomposição `6 + 12` fixa. */
const LARGURA_DO_CONTADOR_POR_EXTENSO = 12;

/**
 * A largura da competência, por extenso — a outra metade da mesma decomposição.
 *
 * Existe para as duas pernas do `D21`: elas precisam afirmar que `-20268` e `2026.5` têm
 * **exatamente** este comprimento, porque é isso que os torna discriminantes. Um valor de cinco ou
 * sete posições seria pego pela conferência de comprimento sozinha, e não separaria a guarda antiga
 * da nova.
 */
const LARGURA_DA_COMPETENCIA_POR_EXTENSO = 6;

/** Quantas posições o identificador inteiro tem, por extenso. */
const LARGURA_DO_IDENTIFICADOR_POR_EXTENSO = 18;

/** Um a mais que o teto da sequência — o contador que não cabe. */
const CONTADOR_ACIMA_DA_LARGURA = 1_000_000_000_000;

/** A competência das composições puras — qualquer `AAAAMM`, já que a função é pura. */
const COMPETENCIA_DE_REFERENCIA = 202608;

// ---------------------------------------------------------------------------
// A sequência e a função, escritas por extenso — é assim que o banco as nomeia
// ---------------------------------------------------------------------------

const SEQUENCIA = 'plataforma.identificador_bancario_seq';
const FUNCAO = 'plataforma.proximo_identificador_bancario()';
const PAPEL_DA_APLICACAO = 'sysloc_app';

/** O `SQLSTATE` de privilégio insuficiente. */
const PRIVILEGIO_INSUFICIENTE = '42501';

// ---------------------------------------------------------------------------
// O relógio do PROCESSO — as marcas que o módulo não pode ter (A4, ADR-0026)
// ---------------------------------------------------------------------------

/** O fonte do módulo sob teste, lido do disco pela asserção estática do CT-816. */
const CAMINHO_DO_MODULO = join(dirname(import.meta.dirname), 'src', 'identificador-bancario.ts');

/**
 * As duas formas de ler o relógio do processo em Node.
 *
 * A asserção que as procura é **estática**, e ela existe porque a comportamental não discrimina: a
 * competência do processo e a do banco coincidem em quase todo instante do mês, de modo que um
 * `new Date()` no lugar de `negocio.data_corrente_da_operacao()` produziria vermelho apenas nas
 * poucas horas em torno da virada — e num fuso, não no outro. Sem esta perna, o *"nenhum `new Date()`
 * no caminho"* da A4 ficaria sem prova.
 *
 * A varredura roda sobre o fonte **sem comentários**: o cabeçalho do módulo cita `new Date()` para
 * dizer que ele não existe ali, e casá-lo no comentário é o defeito literal que a
 * `.claude/rules/testing-stack.md` registra (*"asserção que casava `ALTER ROLE` em comentário"*).
 */
const MARCAS_DO_RELOGIO_DO_PROCESSO: readonly string[] = ['new Date(', 'Date.now('];

/** O que o servidor escreve quando o papel não alcança a sequência. */
const RECUSA_DE_SEQUENCIA = 'permission denied for sequence';

/**
 * As **três** formas de tocar o contador por fora da função, e a palavra da RN-09 que cada uma nega.
 *
 * Provar só uma deixaria a regra dois terços aberta: `USAGE` (o `nextval`), `UPDATE` (o `setval`) e
 * `SELECT` (o `last_value`) são privilégios distintos, e conceder qualquer um deles por engano abre
 * um segundo caminho para o contador — o que o `DECISÃO FECHADA — F4/T4` da `0016` existe para
 * impedir.
 */
const FORMAS_DE_TOCAR_O_CONTADOR: readonly (readonly [string, string])[] = [
  ['alcança (nextval)', `SELECT nextval('${SEQUENCIA}')`],
  ['influencia (setval)', `SELECT setval('${SEQUENCIA}', 1)`],
  ['enxerga (last_value)', `SELECT last_value FROM ${SEQUENCIA}`],
];

// ---------------------------------------------------------------------------
// Os contextos e os acessórios de execução
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

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

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco pela porta: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function emUnidade<T>(
  contexto: contextoDeTenant.ContextoDeTenant,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O desfecho de uma instrução, coletado em vez de abortar — mesmo padrão de `papel-de-conexao`. */
interface DesfechoDeSql {
  readonly codigo: string;
  readonly mensagem: string;
}

/**
 * Executa uma instrução e devolve o desfecho como valor.
 *
 * `EXECUTOU` é um desfecho legítimo e distinguível: o caso que espera recusa afirma o código, e uma
 * execução bem-sucedida aparece como `EXECUTOU` em vez de passar despercebida.
 */
async function tentarSql(cadeia: string, instrucao: string): Promise<DesfechoDeSql> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    await sql.unsafe(instrucao);
    return { codigo: 'EXECUTOU', mensagem: '' };
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? 'sem sqlstate';
    return { codigo, mensagem: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    await sql.end();
  }
}

/** O resultado de uma tentativa, como valor — para afirmar que ela NÃO devolveu nada. */
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

/**
 * O contador embutido num identificador — as últimas posições, lidas pela largura publicada.
 *
 * Ela **não reimplementa** a composição: a previsão de cada identificador seguinte é feita chamando
 * {@link comporIdentificadorBancario}, cuja saída literal o CT-804 já prendeu.
 */
function contadorDe(identificador: string): number {
  return Number(identificador.slice(-LARGURA_DO_CONTADOR_BANCARIO));
}

/** A competência embutida num identificador — o que sobra à esquerda do contador. */
function competenciaDe(identificador: string): number {
  return Number(identificador.slice(0, identificador.length - LARGURA_DO_CONTADOR_BANCARIO));
}

/** A competência que o banco publica, lida pelo mesmo relógio que a porta consulta (ADR-0026). */
async function competenciaDoBanco(tx: TransactionSql): Promise<number> {
  const [linha] = await tx<{ competencia: number }[]>`
    SELECT to_char(negocio.data_corrente_da_operacao(), 'YYYYMM')::integer AS competencia
  `;

  if (linha === undefined) {
    throw new Error('o relógio do banco não devolveu a competência');
  }

  return linha.competencia;
}

// ===========================================================================
// CT-804 e CT-805 — a composição pura das 18 posições
// ===========================================================================

describe('CT-804 — as 18 posições, com o contador preenchido à esquerda', () => {
  it('as três composições saem por igualdade literal e satisfazem o contrato publicado', () => {
    for (const [competencia, contador, esperado] of COMPOSICOES_ESPERADAS) {
      const identificador = comporIdentificadorBancario(competencia, contador);

      // Igualdade literal, e não comprimento: `000000000001202608` também teria 18 caracteres, e é
      // exatamente o preenchimento à direita que o comprimento sozinho aprovaria.
      expect(identificador).toBe(esperado);

      // A forma sai do CONTRATO (A3), e não de uma expressão redigitada aqui: é o mesmo objeto que
      // confere o identificador na borda e no documento publicado.
      expect(ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(identificador).success).toBe(true);
    }
  });

  it('a largura publicada é 12, e a decomposição `6 + 12` bate com a do contrato', () => {
    // O valor por extenso é a DECISÃO. Sem esta asserção, uma derivação que devolvesse qualquer
    // outra largura continuaria "consistente consigo mesma" — e o identificador sairia fora do
    // formato que o provedor impõe.
    expect(LARGURA_DO_CONTADOR_BANCARIO).toBe(LARGURA_DO_CONTADOR_POR_EXTENSO);

    // E a largura total: o contrato aceita exatamente 18 dígitos, nem 17 nem 19. É o que amarra a
    // derivação ao esquema publicado nos dois sentidos.
    expect(
      ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse('0'.repeat(LARGURA_DO_IDENTIFICADOR_POR_EXTENSO))
        .success,
    ).toBe(true);
    expect(
      ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(
        '0'.repeat(LARGURA_DO_IDENTIFICADOR_POR_EXTENSO - 1),
      ).success,
    ).toBe(false);
    expect(
      ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(
        '0'.repeat(LARGURA_DO_IDENTIFICADOR_POR_EXTENSO + 1),
      ).success,
    ).toBe(false);
  });
});

describe('CT-805 — contador acima da largura é recusado ANTES de compor', () => {
  it('levanta `ErroDeContadorForaDaLargura` e nada é devolvido', () => {
    // O resultado é coletado como VALOR: é o que separa *"levantou"* de *"levantou e não devolveu
    // cadeia nenhuma"*. Uma composição que compusesse antes de conferir teria a cadeia de 19
    // posições em mãos neste ponto.
    let devolvido: string | undefined;

    expect(() => {
      devolvido = comporIdentificadorBancario(COMPETENCIA_DE_REFERENCIA, CONTADOR_ACIMA_DA_LARGURA);
    }).toThrow(ErroDeContadorForaDaLargura);

    expect(devolvido).toBeUndefined();

    // A recusa carrega a largura que ela defende, e a mensagem **não ecoa** o valor recusado — ela
    // pode alcançar o registro estruturado.
    const erro = (() => {
      try {
        comporIdentificadorBancario(COMPETENCIA_DE_REFERENCIA, CONTADOR_ACIMA_DA_LARGURA);
        return undefined;
      } catch (capturado) {
        return capturado;
      }
    })();

    expect(erro).toBeInstanceOf(ErroDeContadorForaDaLargura);
    expect((erro as ErroDeContadorForaDaLargura).largura).toBe(LARGURA_DO_CONTADOR_POR_EXTENSO);
    expect((erro as Error).message).not.toContain(String(CONTADOR_ACIMA_DA_LARGURA));
  });

  it('as demais entradas que produziriam forma inválida também são recusadas antes de compor', () => {
    // A totalidade não é só sobre o teto: negativo e fracionário produziriam cadeias com sinal ou
    // ponto — 18 caracteres que o contrato recusa —, e a competência fora de `AAAAMM` produziria a
    // cadeia de 17 ou 19 que a RN-07 proíbe de existir.
    expect(() => comporIdentificadorBancario(COMPETENCIA_DE_REFERENCIA, -1)).toThrow(
      ErroDeContadorForaDaLargura,
    );
    expect(() => comporIdentificadorBancario(COMPETENCIA_DE_REFERENCIA, 1.5)).toThrow(
      ErroDeContadorForaDaLargura,
    );
    expect(() => comporIdentificadorBancario(20268, 1)).toThrow(RangeError);
    expect(() => comporIdentificadorBancario(2026081, 1)).toThrow(RangeError);

    // ⚠️ AS DUAS ASSERÇÕES QUE DISCRIMINAM O `D21` — e nenhuma das quatro acima as alcança. As
    // quatro medem competência FORA da largura (5 ou 7 posições), que o comprimento do texto já
    // pegava. Estas duas medem valores de EXATAMENTE seis caracteres que não são `AAAAMM`: uma
    // guarda que confira só `String(competencia).length` aprova as duas e compõe 18 caracteres com
    // sinal ou com ponto — os 18 que o `ESQUEMA_DO_IDENTIFICADOR_BANCARIO` (`^[0-9]{18}$`) recusa, e
    // que a RN-07 proíbe de existir nem como intermediário.
    expect(String(-20268)).toHaveLength(LARGURA_DA_COMPETENCIA_POR_EXTENSO);
    expect(String(2026.5)).toHaveLength(LARGURA_DA_COMPETENCIA_POR_EXTENSO);
    expect(() => comporIdentificadorBancario(-20268, 1)).toThrow(RangeError);
    expect(() => comporIdentificadorBancario(2026.5, 1)).toThrow(RangeError);

    // O controle positivo, sem o qual uma composição que recusasse TUDO passaria nas seis acima.
    expect(comporIdentificadorBancario(COMPETENCIA_DE_REFERENCIA, 0)).toBe('202608000000000000');
  });
});

// ===========================================================================
// CT-814 e CT-815 — a anatomia da função e o acesso direto à sequência
// ===========================================================================

describe('CT-814 — a função tem zero parâmetros, e a sequência não é alcançável por privilégio', () => {
  it(
    'zero parâmetros, `SECURITY DEFINER`, `search_path` fixado, `EXECUTE` sim e sequência não',
    async () => {
      const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });

      try {
        const [anatomia] = await sql<
          {
            parametros: number;
            definidoPeloDono: boolean;
            caminhoDeBusca: string;
            executa: boolean;
            usa: boolean;
            le: boolean;
            escreve: boolean;
          }[]
        >`
          SELECT p.pronargs                                                     AS parametros,
                 p.prosecdef                                                    AS "definidoPeloDono",
                 coalesce(array_to_string(p.proconfig, ' | '), 'SEM CONFIGURACAO')
                                                                                AS "caminhoDeBusca",
                 has_function_privilege(${PAPEL_DA_APLICACAO}, ${FUNCAO}, 'EXECUTE')  AS executa,
                 has_sequence_privilege(${PAPEL_DA_APLICACAO}, ${SEQUENCIA}, 'USAGE') AS usa,
                 has_sequence_privilege(${PAPEL_DA_APLICACAO}, ${SEQUENCIA}, 'SELECT') AS le,
                 has_sequence_privilege(${PAPEL_DA_APLICACAO}, ${SEQUENCIA}, 'UPDATE') AS escreve
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'plataforma'
             AND p.proname = 'proximo_identificador_bancario'
        `;

        // Os sete fatos numa igualdade só.
        //
        // `parametros: 0` é a medição literal da ADR-0033 — a ausência de parâmetro **é** a
        // declaração de escopo, e com um parâmetro de empresa pedir o contador em nome de uma
        // empresa voltaria a ser representável. `executa: true` é o companheiro POSITIVO das três
        // recusas: sem ele, "sem privilégio sobre a sequência" também seria verdade sobre um papel
        // que não pudesse fazer nada. E `has_sequence_privilege` levanta sobre objeto inexistente,
        // de modo que os três `false` são também a prova de que a sequência EXISTE.
        expect(anatomia).toEqual({
          parametros: 0,
          definidoPeloDono: true,
          caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
          executa: true,
          usa: false,
          le: false,
          escreve: false,
        });
      } finally {
        await sql.end();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-815 — nenhuma das três formas de tocar o contador é alcançável', () => {
  for (const [palavra, instrucao] of FORMAS_DE_TOCAR_O_CONTADOR) {
    it(
      `a forma que a RN-09 chama de "${palavra}" é recusada com 42501, nomeando a sequência`,
      async () => {
        const desfecho = await tentarSql(banco.cadeiaConexao, instrucao);

        expect(desfecho.codigo).toBe(PRIVILEGIO_INSUFICIENTE);
        expect(desfecho.mensagem).toContain(RECUSA_DE_SEQUENCIA);
        expect(desfecho.mensagem).toContain('identificador_bancario_seq');
      },
      LIMITE_DO_CASO_MS,
    );
  }

  it(
    'e o companheiro positivo: o papel DONO alcança a MESMA sequência pelo mesmo `SELECT`',
    async () => {
      // Sem esta perna, `42501` não distinguiria *"sem privilégio"* de *"objeto que não existe com
      // esse nome"*. `last_value` é escolhido de propósito entre as três: ele não avança nem
      // reposiciona o contador, de modo que o controle positivo não contamina o CT-816 nem o CT-817.
      const desfecho = await tentarSql(
        conexaoDeMigracao(banco),
        `SELECT last_value FROM ${SEQUENCIA}`,
      );

      expect(desfecho).toEqual({ codigo: 'EXECUTOU', mensagem: '' });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-816 e CT-817 — o contador, sob contexto real
// ===========================================================================

describe('CT-816 — duas empresas, UM contador', () => {
  it(
    'A → B → A devolve identificadores diferentes e consecutivos, com a competência do banco',
    async () => {
      const primeiroDeA = await emUnidade(CONTEXTO_DE_A, proximoIdentificadorBancario);
      const deB = await emUnidade(CONTEXTO_DE_B, proximoIdentificadorBancario);
      const segundoDeA = await emUnidade(CONTEXTO_DE_A, proximoIdentificadorBancario);

      // A CONSECUTIVIDADE é o que discrimina: dois contadores por empresa — o que a ADR-0015
      // superseded pediria — também dariam três números diferentes, e a empresa B receberia `1`
      // enquanto A recebia `2`. A previsão é feita pela porta pura, sobre a cadeia INTEIRA, e a
      // competência usada é a do próprio identificador previsto, de modo que a virada de mês entre
      // duas chamadas não possa produzir vermelho.
      expect(deB).toBe(
        comporIdentificadorBancario(competenciaDe(deB), contadorDe(primeiroDeA) + 1),
      );
      expect(segundoDeA).toBe(
        comporIdentificadorBancario(competenciaDe(segundoDeA), contadorDe(deB) + 1),
      );

      // E os três são distintos — dito de forma direta, para que o caso não dependa só da relação.
      expect(new Set([primeiroDeA, deB, segundoDeA]).size).toBe(3);

      // Os três satisfazem o contrato publicado.
      for (const identificador of [primeiroDeA, deB, segundoDeA]) {
        expect(ESQUEMA_DO_IDENTIFICADOR_BANCARIO.safeParse(identificador).success).toBe(true);
      }

      // A competência sai do RELÓGIO DO BANCO (A4, ADR-0026), e não do relógio do processo: ela é
      // lida na mesma unidade, pela mesma função que a porta consulta.
      const doBanco = await emUnidade(CONTEXTO_DE_A, competenciaDoBanco);
      expect(competenciaDe(segundoDeA)).toBe(doBanco);
    },
    LIMITE_DO_CASO_MS,
  );

  it('e o módulo não tem relógio próprio: nenhuma marca de `Date` no fonte executável', async () => {
    const executavel = semComentarios(await readFile(CAMINHO_DO_MODULO, 'utf8'));

    // O controle de que a leitura alcançou o arquivo certo: sem ele, um caminho errado devolveria
    // "nenhuma marca" sobre um arquivo vazio, e a asserção não poderia falhar (AP-29).
    expect(executavel).toContain('proximoIdentificadorBancario');
    expect(executavel).toContain('negocio.data_corrente_da_operacao()');

    const encontradas = MARCAS_DO_RELOGIO_DO_PROCESSO.filter((marca) => executavel.includes(marca));

    expect(encontradas).toEqual([]);
  });
});

describe('CT-817 — a unidade desfeita QUEIMA o número, e ele nunca é reentregue', () => {
  it(
    'obtido o identificador e abortada a unidade, a seguinte recebe o contador `n + 1`',
    async () => {
      let queimado: string | undefined;

      // O aborto é produzido pelo mecanismo que a produção já usa: uma exceção levantada dentro da
      // transação, de modo que o desfazimento normal ocorra. Nenhuma rota, bandeira ou símbolo de
      // teste participa (Iron Law #6).
      const abortada = await tentar(
        async () =>
          await emUnidade(CONTEXTO_DE_A, async (tx) => {
            queimado = await proximoIdentificadorBancario(tx);
            throw new Error('aborto deliberado do CT-817, depois de o contador ter avançado');
          }),
      );

      expect(abortada.ok).toBe(false);
      expect(queimado).toBeDefined();

      const seguinte = await emUnidade(CONTEXTO_DE_A, proximoIdentificadorBancario);

      // O furo é a decisão da ADR-0033, e não defeito: `nextval` não participa do desfazimento
      // (ADR-0020), e é o que faz o número **nunca** ser reusado. Um contador em linha de tabela —
      // o mecanismo que a ADR-0020 rejeita — teria devolvido aqui o mesmo número que foi queimado.
      expect(contadorDe(seguinte)).toBe(contadorDe(queimado as string) + 1);

      // Dito também pela negativa: o identificador queimado não volta.
      expect(seguinte).not.toBe(queimado);
    },
    LIMITE_DO_CASO_MS,
  );
});
