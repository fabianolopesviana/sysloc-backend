/**
 * Guarda de admissão do schema `plataforma` — o roster vazio aprovado, e a tabela intrusa apontada
 * pelo nome.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério       | Caso            | Invariante |
 * |----------------|-----------------|------------|
 * | A1 · A2 · A3   | CT-812          | Sobre o schema migrado até a `0016`, a guarda devolve
 * | A4 · RN-09     |                 | `excecoes` VAZIO **e** `tabelasExaminadas` VAZIO, e este
 * |                |                 | último é afirmado **igual a `ROSTER_DE_PLATAFORMA`** na
 * |                |                 | mesma asserção. As duas afirmações juntas são o caso: com
 * |                |                 | um roster vazio, `excecoes: []` é também o que uma
 * |                |                 | consulta apontada para o schema errado devolveria, e só a
 * |                |                 | igualdade com o roster separa *"está tudo certo"* de
 * |                |                 | *"não olhei nada"*. No mesmo caso, e por consequência da
 * |                |                 | igualdade: `plataforma.identificador_bancario_seq` — que a
 * |                |                 | `0016` cria e que existe de fato — **não** aparece entre as
 * |                |                 | examinadas, porque sequência não é tabela e o filtro de
 * |                |                 | espécie a exclui por construção (RN-09: o contador vive
 * |                |                 | fora do território de negócio, e não vira tabela ao mudar
 * |                |                 | de schema). |
 * | A1 · A2 · A3   | CT-813          | Criada em `plataforma` uma tabela que o roster não admite,
 * |                | (3 variantes)   | a guarda devolve **exatamente uma** exceção por objeto,
 * |                |                 | nomeando a tabela **e** o motivo, e a tabela aparece entre
 * |                |                 | as examinadas; removida a tabela, as duas listas voltam a
 * |                |                 | vazias. A tabela é **descoberta**, nunca declarada: nada no
 * |                |                 | caso diz à guarda que ela existe (A1). As três variantes
 * |                |                 | são o que dá poder discriminante ao caso —
 * |                |                 | (a) com `empresa_id` reprova por `CARREGA_COLUNA_DE_EMPRESA`
 * |                |                 | e (b) sem `empresa_id` reprova por `FORA_DO_ROSTER`, de modo
 * |                |                 | que nenhum dos dois motivos fica sem prova e a ORDEM em que
 * |                |                 | são cobrados é falsificável (invertida, a variante (a) muda
 * |                |                 | de motivo); (c) as DUAS de pé ao mesmo tempo, criadas em
 * |                |                 | ordem inversa à alfabética, provam que cada objeto rende UMA
 * |                |                 | exceção e que as duas listas vêm ORDENADAS pelo nome — a
 * |                |                 | única fonte de discriminação da ordem neste arquivo. |
 * | A1             | CT-813          | A tabela intrusa nasce pelo papel de MIGRAÇÃO e **sem
 * |                |                 | `GRANT` algum**, e a guarda a encontra correndo pelo papel
 * |                |                 | `sysloc_app`. Isto não é detalhe de arranjo: é a asserção
 * |                |                 | comportamental que mata o mutante de trocar `pg_catalog`
 * |                |                 | pelo `information_schema` — cujas views filtram por
 * |                |                 | privilégio e devolveriam lista vazia para exatamente esta
 * |                |                 | tabela. Ver a `DECISÃO FECHADA` no cabeçalho do SUT. |
 *
 * ===========================================================================
 * Uma instância, e por que ela basta aqui
 * ===========================================================================
 *
 * `catalogo.spec.ts` usa DUAS instâncias porque as tabelas defeituosas dele nascem em `negocio` e
 * alcançariam a suíte de isolamento. Aqui não há o que contaminar: as intrusas nascem em
 * `plataforma`, que nenhuma outra suíte consulta, e cada variante as remove no `finally` e reconfere
 * o verde antes de sair. É a mesma instância que o CT-812 usa, como a task fixa.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * A tabela intrusa nasce de **DDL do próprio caso**, executada pela cadeia de `conexaoDeMigracao()`
 * — o mesmo acessório e a mesma origem de privilégio de `executarPrivilegiado` em
 * `catalogo.spec.ts`. Nenhuma bandeira, semente condicional ou símbolo de produção foi acrescentado
 * para que o defeito exista: ele é escrito em SQL, num schema real, como um autor futuro o
 * escreveria por descuido.
 *
 * A guarda, por outro lado, é sempre invocada pela cadeia SEM privilégio (`banco.cadeiaConexao`, o
 * papel `sysloc_app`) — e, aqui, isso é conteúdo do caso e não conveniência: ver a última linha da
 * tabela de INVARIANTES.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type AdmissaoDePlataforma,
  conferirAdmissaoDePlataforma,
  type ExcecaoDeAdmissao,
  ROSTER_DE_PLATAFORMA,
} from '../src/catalogo-de-plataforma.ts';
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
// O veredito do schema íntegro — escrito UMA vez, afirmado em toda variante
// ---------------------------------------------------------------------------

/**
 * O que a guarda deve devolver quando nada de estranho está de pé.
 *
 * `tabelasExaminadas` é escrito como `ROSTER_DE_PLATAFORMA` de propósito, e não como `[]` literal: é
 * a igualdade com o roster que o CT-812 existe para afirmar, e escrevê-la aqui faz toda reconferência
 * de "voltou ao verde" cobrar a mesma coisa. Hoje os dois são vazios — quando o roster deixar de ser,
 * este objeto continua dizendo a verdade sem edição.
 */
const ADMISSAO_INTEGRA: AdmissaoDePlataforma = {
  excecoes: [],
  tabelasExaminadas: ROSTER_DE_PLATAFORMA,
};

// ---------------------------------------------------------------------------
// As variantes intrusas do CT-813
// ---------------------------------------------------------------------------

/**
 * Uma tabela que o roster não admite: como criá-la, o que a guarda deve responder enquanto ela está
 * de pé, e como removê-la.
 *
 * As duas primeiras variantes são **independentes de propósito**, e é a independência que dá poder ao
 * caso: uma guarda que só olhasse a coluna de empresa aprovaria a segunda em silêncio, e uma que só
 * comparasse com o roster reportaria a primeira pelo motivo errado — o que mandaria quem lê
 * acrescentá-la ao roster, que é precisamente a correção que a ADR-0031 recusa.
 *
 * A terceira não acrescenta motivo: acrescenta os dois eixos que as duas primeiras deixavam sem
 * prova — **uma exceção por objeto** e a **ordem** das duas listas.
 */
interface VarianteIntrusa {
  /** Entra no nome do caso, depois do ID literal. */
  readonly descricao: string;
  readonly criar: readonly string[];
  readonly remover: readonly string[];
  /** As exceções esperadas, por extenso e na ordem — nunca "alguma exceção". */
  readonly excecoesEsperadas: readonly ExcecaoDeAdmissao[];
  /**
   * A lista de examinadas esperada, **escrita por extenso, na ordem exata**, e não derivada por
   * ordenação aqui no caso.
   *
   * Derivá-la (`[...nomes].sort()`) reimplementaria no teste a propriedade que ele existe para
   * provar, e a guarda passaria a se conferir contra uma cópia de si mesma — o defeito que a
   * `.claude/rules/testing-stack.md` registra como o pior dos três da F0.
   */
  readonly examinadasEsperadas: readonly string[];
}

const INTRUSA_COM_EMPRESA = 'plataforma.residuo_com_empresa';
const INTRUSA_SEM_EMPRESA = 'plataforma.residuo_sem_empresa';

// A terceira variante põe as duas de pé ao mesmo tempo, e os nomes são escolhidos para que a ordem
// ALFABÉTICA divirja da ordem de CRIAÇÃO — ver o comentário da variante.
const INTRUSA_ORDENA_PRIMEIRO = 'plataforma.aa_residuo_com_empresa';
const INTRUSA_ORDENA_ULTIMO = 'plataforma.zz_residuo_sem_empresa';

const VARIANTES: readonly VarianteIntrusa[] = [
  {
    // A intrusa literal da task: dado com dono-empresa estacionado fora do alcance de qualquer
    // política de linha. É o cenário que a ADR-0031 nomeia entre os *Pros* — *"coluna de empresa em
    // `plataforma` vira erro que uma consulta acha, não que uma revisão precisa lembrar de
    // procurar"*.
    //
    // O motivo afirmado é `CARREGA_COLUNA_DE_EMPRESA`, e não `FORA_DO_ROSTER`, embora as DUAS
    // propriedades faltem nela: a ordem é normativa no SUT, e é ela que decide qual correção quem lê
    // vai fazer. Invertida a ordem, esta asserção reprova — é o mutante que a variante mata.
    //
    // O índice `residuo_com_empresa_pkey` nasce junto com a chave primária e **não** entra em
    // `examinadasEsperadas`: a igualdade de lista com UM elemento é o que prova que o filtro de
    // espécie o exclui.
    descricao:
      'tabela com coluna de empresa reprova nomeando a tabela e a coluna como motivo, e o índice ' +
      'da chave primária não entra no exame',
    criar: [`CREATE TABLE ${INTRUSA_COM_EMPRESA} (id uuid PRIMARY KEY, empresa_id uuid)`],
    remover: [`DROP TABLE ${INTRUSA_COM_EMPRESA}`],
    excecoesEsperadas: [{ tabela: INTRUSA_COM_EMPRESA, motivo: 'CARREGA_COLUNA_DE_EMPRESA' }],
    examinadasEsperadas: [INTRUSA_COM_EMPRESA],
  },
  {
    // A intrusa SEM coluna de empresa — a que uma guarda que só procurasse `empresa_id` aprovaria em
    // silêncio. Ela é o que a ADR-0031 fecha ao exigir o roster ENUMERADO: a tabela nova em
    // `plataforma` reprova por não ter licença, e a licença só se dá por alteração explícita e
    // revisada de `ROSTER_DE_PLATAFORMA`.
    //
    // Sem esta variante, `FORA_DO_ROSTER` ficaria sem prova — e trocar a segunda propriedade por
    // `() => true` sobreviveria à suíte inteira.
    descricao:
      'tabela sem coluna de empresa, mas ausente do roster, reprova por não ter licença para ' +
      'viver em `plataforma`',
    criar: [`CREATE TABLE ${INTRUSA_SEM_EMPRESA} (id uuid PRIMARY KEY)`],
    remover: [`DROP TABLE ${INTRUSA_SEM_EMPRESA}`],
    excecoesEsperadas: [{ tabela: INTRUSA_SEM_EMPRESA, motivo: 'FORA_DO_ROSTER' }],
    examinadasEsperadas: [INTRUSA_SEM_EMPRESA],
  },
  {
    // ---------------------------------------------------------------------------
    // Esta variante existe pela ORDEM e pela CONTAGEM, não pelos motivos
    // ---------------------------------------------------------------------------
    //
    // As duas acima provam os dois motivos, e nenhuma delas prova (i) que as listas vêm ORDENADAS
    // pelo nome, nem (ii) que cada objeto rende UMA exceção — com uma intrusa por vez, "ordenado" e
    // "na ordem em que o catálogo devolveu" são indistinguíveis, e "uma exceção" é indistinguível de
    // "uma exceção por execução".
    //
    // A discriminação vem da ordem de CRIAÇÃO invertida: `zz_…` é criada PRIMEIRO e `aa_…` DEPOIS, de
    // modo que a ordem física em que a varredura de `pg_class` devolve as linhas é o oposto da ordem
    // alfabética prometida. Apagado `ORDER BY c.relname` do SUT, esta é a única asserção do arquivo
    // que reprova — as duas variantes acima seguem verdes, porque uma lista de um elemento está
    // sempre ordenada. É o mesmo desenho, e a mesma razão, da variante `aaa_sem_empresa` de
    // `catalogo.spec.ts`, cuja ausência o Gate 1 mediu como MED-001.
    //
    // As duas intrusas têm defeitos DIFERENTES de propósito: assim a lista de exceções afirma, de uma
    // vez, a contagem (duas, uma por objeto), a ordem (a de `tabelasExaminadas`) e a independência
    // dos dois motivos.
    descricao:
      'duas intrusas de pé ao mesmo tempo, criadas em ordem INVERSA à alfabética, rendem uma ' +
      'exceção cada, e as duas listas vêm ordenadas pelo nome',
    criar: [
      `CREATE TABLE ${INTRUSA_ORDENA_ULTIMO} (id uuid PRIMARY KEY)`,
      `CREATE TABLE ${INTRUSA_ORDENA_PRIMEIRO} (id uuid PRIMARY KEY, empresa_id uuid)`,
    ],
    remover: [`DROP TABLE ${INTRUSA_ORDENA_ULTIMO}`, `DROP TABLE ${INTRUSA_ORDENA_PRIMEIRO}`],
    excecoesEsperadas: [
      { tabela: INTRUSA_ORDENA_PRIMEIRO, motivo: 'CARREGA_COLUNA_DE_EMPRESA' },
      { tabela: INTRUSA_ORDENA_ULTIMO, motivo: 'FORA_DO_ROSTER' },
    ],
    examinadasEsperadas: [INTRUSA_ORDENA_PRIMEIRO, INTRUSA_ORDENA_ULTIMO],
  },
];

// ---------------------------------------------------------------------------
// Execução privilegiada — a DDL da intrusa, e apenas ela
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

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('guarda de admissão do schema `plataforma`', () => {
  let banco: BancoMigrado;
  let doMigrador: string;

  beforeAll(async () => {
    banco = await bancoEfemero();
    doMigrador = conexaoDeMigracao(banco);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-812 — a guarda aprova o roster E devolve o conjunto examinado, que é igual a ele',
    async () => {
      const admissao = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);

      // As duas metades numa asserção só. Sozinha, a primeira ficaria verde contra um banco em que a
      // consulta não alcançou schema nenhum — que é o modo de falha desta classe de guarda, e o que
      // um roster vazio torna indistinguível da integridade.
      expect(admissao).toEqual({
        excecoes: [],
        tabelasExaminadas: [],
      } satisfies AdmissaoDePlataforma);

      // A igualdade com o ROSTER, e não com o vazio literal: é ela que a ADR-0031 pede ("o conjunto
      // observado é igual ao roster declarado"), e é ela que continua dizendo a coisa certa no dia em
      // que o roster deixar de ser vazio. As duas afirmações juntas são o caso.
      expect(admissao.tabelasExaminadas).toEqual(ROSTER_DE_PLATAFORMA);

      // O roster é declaração congelada, não estado (A4): admitir uma tabela é editar o arquivo e
      // passar pelo diff, nunca empurrar um nome em tempo de execução. Sem esta asserção, trocar o
      // `Object.freeze` por um array comum passaria despercebido, e a exigência da ADR-0031 de
      // "alteração explícita e revisada" viraria convenção.
      expect(Object.isFrozen(ROSTER_DE_PLATAFORMA)).toBe(true);
      expect(() => (ROSTER_DE_PLATAFORMA as string[]).push('plataforma.intrusa')).toThrow(
        TypeError,
      );
      expect(ROSTER_DE_PLATAFORMA).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  for (const variante of VARIANTES) {
    it(
      `CT-813 — ${variante.descricao}`,
      async () => {
        await executarPrivilegiado(doMigrador, variante.criar);

        try {
          // A guarda corre pelo papel SEM privilégio, sobre tabelas criadas pelo papel de migração e
          // sem `GRANT` algum. É o que torna esta asserção a prova comportamental de que a fonte é o
          // catálogo do sistema: sobre o `information_schema`, cujas views filtram por privilégio, as
          // duas listas viriam VAZIAS aqui, e o caso reprovaria.
          const comIntrusa = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);

          // Exceções e examinadas por igualdade, na mesma asserção e por extenso: a contagem exata, o
          // nome da tabela, o motivo e a POSIÇÃO de cada uma — nunca "alguma exceção".
          expect(comIntrusa).toEqual({
            excecoes: variante.excecoesEsperadas,
            tabelasExaminadas: variante.examinadasEsperadas,
          } satisfies AdmissaoDePlataforma);
        } finally {
          await executarPrivilegiado(doMigrador, variante.remover);
        }

        // Removida a intrusa, a guarda volta ao verde. Sem este passo, "reprovou" não distinguiria o
        // defeito de uma guarda que reprova SEMPRE — e é o passo que a task fixa por escrito.
        const restaurada = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);
        expect(restaurada).toEqual(ADMISSAO_INTEGRA);
      },
      LIMITE_DO_CASO_MS,
    );
  }
});
