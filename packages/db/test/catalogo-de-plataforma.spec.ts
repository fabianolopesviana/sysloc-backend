/**
 * Guarda de admissão do schema `plataforma` — o roster conferido nas duas direções, e a tabela
 * intrusa apontada pelo nome.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério       | Caso            | Invariante |
 * |----------------|-----------------|------------|
 * | A1 · A2 · A3   | CT-812          | Sobre o schema migrado, a guarda devolve `excecoes` VAZIO
 * | A4 · RN-09     |                 | **e** `tabelasExaminadas` afirmado **igual a
 * |                |                 | `ROSTER_DE_PLATAFORMA`** na mesma asserção. As duas
 * |                |                 | afirmações juntas são o caso: `excecoes: []` é também o que
 * |                |                 | uma consulta apontada para o schema errado devolveria, e só
 * |                |                 | a igualdade com o roster separa *"está tudo certo"* de
 * |                |                 | *"não olhei nada"*. No mesmo caso, e por consequência da
 * |                |                 | igualdade: `plataforma.identificador_bancario_seq` — que a
 * |                |                 | `0016` cria e que existe de fato — **não** aparece entre as
 * |                |                 | examinadas, porque sequência não é tabela e o filtro de
 * |                |                 | espécie a exclui por construção (RN-09: o contador vive
 * |                |                 | fora do território de negócio, e não vira tabela ao mudar
 * |                |                 | de schema). |
 * | ADR-0031       | CT-994          | O roster deixou de ser vazio na fatia `webhook-e-carne`, e
 * | (as 2 cláusulas)| (5 sub-casos)  | as duas cláusulas dela ganham prova sobre conteúdo real:
 * |                |                 | (a) `ROSTER_DE_PLATAFORMA` é igual, **por igualdade de
 * |                |                 | conjunto com controle antivácuo**, a
 * |                |                 | `['plataforma.notificacao_bancaria']` — nome QUALIFICADO —,
 * |                |                 | e a guarda devolve `excecoes: []` com `tabelasExaminadas`
 * |                |                 | afirmado contra o roster, nunca contra o vazio;
 * |                |                 | (b) a tabela admitida existe no catálogo **sem
 * |                |                 | `empresa_id`**, sem RLS habilitada, com o `check`
 * |                |                 | bicondicional e os TRÊS índices (dois deles PARCIAIS), e o
 * |                |                 | enum `plataforma.desfecho_da_notificacao` tem exatamente
 * |                |                 | nove rótulos NA ORDEM declarada;
 * |                |                 | (c) com o roster povoado, a intrusa que carrega
 * |                |                 | `empresa_id` reprova por `CARREGA_COLUNA_DE_EMPRESA` — e
 * |                |                 | **não** por `FORA_DO_ROSTER` — enquanto a tabela admitida
 * |                |                 | segue sem exceção, o que o CT-813 não podia afirmar com o
 * |                |                 | roster vazio;
 * |                |                 | (d) RENOMEADA a tabela admitida, a guarda reporta as DUAS
 * |                |                 | direções na mesma resposta: `FORA_DO_ROSTER` para o nome
 * |                |                 | novo e `AUSENTE_DO_BANCO` para o declarado — é a segunda
 * |                |                 | direção da igualdade, que era irrepresentável enquanto o
 * |                |                 | roster era vazio;
 * |                |                 | (e) o `check` da tabela recusa, **nas duas direções**,
 * |                |                 | `tratado_em` preenchido com `desfecho = 'RECEBIDO'` e
 * |                |                 | `tratado_em` nulo com desfecho diferente de `RECEBIDO`. |
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
 * **O CT-994 vive no mesmo `describe` e usa a MESMA instância**, pela mesma razão e mais uma: subir
 * uma segunda custaria dezenas de segundos para observar exatamente o mesmo schema. Os dois
 * sub-casos que mexem no banco desfazem o que fizeram — o (d) restaura o nome no `finally` e o (e)
 * esvazia a tabela —, e ambos reconferem o veredito íntegro antes de sair, que é o que impede um
 * caso de contaminar o seguinte.
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
import { diferencasDeConjunto } from './conjuntos.ts';

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
 * `tabelasExaminadas` é escrito como `ROSTER_DE_PLATAFORMA` de propósito, e não como lista literal: é
 * a igualdade com o roster que o CT-812 existe para afirmar, e escrevê-la aqui faz toda reconferência
 * de "voltou ao verde" cobrar a mesma coisa.
 *
 * ⚠️ **A previsão se cumpriu, e este objeto atravessou sem edição.** Ele nasceu quando o roster era
 * vazio, dizendo *"quando o roster deixar de ser, este objeto continua dizendo a verdade sem
 * edição"* — a fatia `webhook-e-carne` povoou o roster com `plataforma.notificacao_bancaria` e
 * nenhuma linha daqui mudou. Não o "simplifique" para lista literal: seria trocar a afirmação que a
 * ADR-0031 pede por uma cópia congelada dela, livre para divergir na fatia seguinte.
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

/**
 * A única tabela admitida — a que a migração `0019` criou e que o roster declara.
 *
 * Escrita aqui por extenso, e **não** derivada de `ROSTER_DE_PLATAFORMA[0]`: derivá-la poria o
 * artefato sob prova nos dois lados da igualdade, e um roster que apontasse para o nome errado
 * passaria por toda a suíte. É a mesma razão registrada em `evento-bancario.spec.ts` sobre os
 * rótulos dos enums.
 */
const TABELA_ADMITIDA = 'plataforma.notificacao_bancaria';

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
    // A admitida entra na lista de examinadas — e NÃO na de exceções. As duas coisas na mesma
    // igualdade são o que separa "a guarda reprova a intrusa" de "a guarda reprova tudo".
    examinadasEsperadas: [TABELA_ADMITIDA, INTRUSA_COM_EMPRESA],
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
    examinadasEsperadas: [TABELA_ADMITIDA, INTRUSA_SEM_EMPRESA],
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
    examinadasEsperadas: [INTRUSA_ORDENA_PRIMEIRO, TABELA_ADMITIDA, INTRUSA_ORDENA_ULTIMO],
  },
];

// ---------------------------------------------------------------------------
// CT-994 — as DUAS cláusulas da ADR-0031, agora que o roster tem conteúdo
// ---------------------------------------------------------------------------

/**
 * A forma que a migração `0019` declara para a tabela admitida, escrita por extenso.
 *
 * Ela **não** é derivada do esquema Drizzle nem da migração: derivá-la poria o artefato sob prova
 * nos dois lados da igualdade, e um `plataforma.ts` que declarasse `empresa_id` por descuido passaria
 * verde. O que se compara é o catálogo do PostgreSQL contra esta lista escrita à mão.
 */
const COLUNAS_DA_NOTIFICACAO: readonly string[] = [
  'id',
  'recebido',
  'recebido_em',
  'desfecho',
  'identificador_perante_o_provedor',
  'identificador_da_liquidacao',
  'diagnostico',
  'tratado_em',
];

/**
 * Os NOVE rótulos do enum, na ORDEM em que a `0019` os declara — e a ordem é conteúdo: um enum do
 * PostgreSQL a guarda, e é ela que governa comparação e ordenação do tipo.
 */
const DESFECHOS_DECLARADOS: readonly string[] = [
  'RECEBIDO',
  'VALIDACAO_DE_ENDERECO',
  'ILEGIVEL',
  'SEM_CORRESPONDENCIA',
  'DIVERGENTE',
  'RETIDO',
  'REENTREGA',
  'CONFERIDO_SEM_EFEITO',
  'APLICADO',
];

/** Os três índices da tabela, com o predicado parcial de cada um — `null` quando é total. */
const INDICES_DA_NOTIFICACAO: readonly { nome: string; predicado: string | null }[] = [
  {
    nome: 'notificacao_bancaria_efeito_idx',
    predicado: "(desfecho = 'APLICADO'::plataforma.desfecho_da_notificacao)",
  },
  { nome: 'notificacao_bancaria_expurgo_idx', predicado: null },
  {
    nome: 'notificacao_bancaria_retida_idx',
    predicado: "(desfecho = 'RETIDO'::plataforma.desfecho_da_notificacao)",
  },
];

/** O nome para o qual a tabela admitida é renomeada no sub-caso (d) — ver o comentário lá. */
const NOME_APOS_O_RENOME = 'plataforma.notificacao_bancaria_antiga';

/** O código do PostgreSQL para violação de restrição de verificação (`check_violation`). */
const VIOLACAO_DE_CHECK = '23514';

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
      // consulta não alcançou schema nenhum — que é o modo de falha desta classe de guarda.
      //
      // SUT_IS_CORRECT_BECAUSE: a lista esperada era `[]` porque o roster era vazio e `plataforma`
      // não tinha tabela alguma. A migração `0019` criou `plataforma.notificacao_bancaria` e a
      // ADR-0031 exige que ela entre no roster por alteração explícita — o que o SUT fez. O que este
      // caso afirma não mudou (as duas metades, por igualdade); mudou o conteúdo do schema que ele
      // descreve. Nenhuma asserção foi afrouxada.
      expect(admissao).toEqual({
        excecoes: [],
        tabelasExaminadas: [TABELA_ADMITIDA],
      } satisfies AdmissaoDePlataforma);

      // A igualdade com o ROSTER, e não com uma lista literal: é ela que a ADR-0031 pede ("o conjunto
      // observado é igual ao roster declarado"). As duas afirmações juntas são o caso.
      expect(admissao.tabelasExaminadas).toEqual(ROSTER_DE_PLATAFORMA);

      // O roster é declaração congelada, não estado (A4): admitir uma tabela é editar o arquivo e
      // passar pelo diff, nunca empurrar um nome em tempo de execução. Sem esta asserção, trocar o
      // `Object.freeze` por um array comum passaria despercebido, e a exigência da ADR-0031 de
      // "alteração explícita e revisada" viraria convenção.
      expect(Object.isFrozen(ROSTER_DE_PLATAFORMA)).toBe(true);
      expect(() => (ROSTER_DE_PLATAFORMA as string[]).push('plataforma.intrusa')).toThrow(
        TypeError,
      );
      expect(ROSTER_DE_PLATAFORMA).toEqual([TABELA_ADMITIDA]);
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

  describe('CT-994 — o roster de `plataforma` admite exatamente a notícia crua', () => {
    it(
      'CT-994 — (a) o roster é igual, por conjunto, à única tabela admitida, e a guarda a aprova',
      async () => {
        // Igualdade de CONJUNTO com controle antivácuo, como a `.claude/rules/ancoras-de-superficie.md`
        // exige: `toContain` aprovaria tanto o nome que sumiu quanto o que apareceu sem ninguém
        // decidir, e comparar duas listas vazias passaria por vacuidade. O comprimento é o controle.
        expect(ROSTER_DE_PLATAFORMA.length).toBe(1);
        expect(diferencasDeConjunto([...ROSTER_DE_PLATAFORMA], [TABELA_ADMITIDA])).toEqual({
          excedentes: [],
          ausentes: [],
        });

        // O nome é QUALIFICADO pelo schema. O SUT compara o que devolve (`nspname || '.' || relname`)
        // com o que o roster declara: um nome curto aqui faria TODA tabela admitida reprovar como
        // `FORA_DO_ROSTER` e, na direção contrária, produziria `AUSENTE_DO_BANCO` para ela.
        expect(ROSTER_DE_PLATAFORMA[0]).toBe('plataforma.notificacao_bancaria');

        const admissao = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);

        // As duas metades numa asserção só, e `tabelasExaminadas` afirmado CONTRA O ROSTER na linha
        // seguinte — nunca contra o vazio. Ver o cabeçalho do SUT.
        expect(admissao).toEqual(ADMISSAO_INTEGRA);
        expect(admissao.tabelasExaminadas).toEqual(ROSTER_DE_PLATAFORMA);
      },
      LIMITE_DO_CASO_MS,
    );

    it(
      'CT-994 — (b) a tabela admitida existe sem `empresa_id`, sem RLS, com o `check` e os três índices',
      async () => {
        const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });

        try {
          // --- as colunas, por igualdade e na ordem do catálogo -------------------------------------
          const colunas = await sql<{ nome: string }[]>`
            SELECT a.attname AS "nome"
              FROM pg_catalog.pg_attribute a
              JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'plataforma'
               AND c.relname = 'notificacao_bancaria'
               AND a.attnum > 0
               AND NOT a.attisdropped
             ORDER BY a.attnum
          `;

          // Igualdade, e não `not.toContain('empresa_id')`: a asserção negativa sozinha passaria verde
          // sobre uma coluna `id_da_empresa` acrescentada por descuido — é o mesmo movimento que
          // `fonte-unica-do-estado.spec.ts` registra sobre a ausência de `status`.
          expect(colunas.map((coluna) => coluna.nome)).toEqual(COLUNAS_DA_NOTIFICACAO);

          // --- as duas ausências que são a decisão da ADR-0031 ---------------------------------------
          const [forma] = await sql<{ comRls: boolean; comForce: boolean }[]>`
            SELECT c.relrowsecurity AS "comRls", c.relforcerowsecurity AS "comForce"
              FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'plataforma' AND c.relname = 'notificacao_bancaria'
          `;

          // Em `plataforma` não há política de linha a impor (ADR-0031, Cons). `ENABLE` sem política
          // faria o PostgreSQL negar tudo a quem não é dono, e a tabela pararia de aceitar a notícia
          // que ela existe para guardar.
          expect(forma).toEqual({ comRls: false, comForce: false });

          // --- o `check`, pelo texto que o catálogo guarda -------------------------------------------
          const restricoes = await sql<{ nome: string; expressao: string }[]>`
            SELECT r.conname AS "nome",
                   pg_catalog.pg_get_constraintdef(r.oid) AS "expressao"
              FROM pg_catalog.pg_constraint r
              JOIN pg_catalog.pg_class c ON c.oid = r.conrelid
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'plataforma'
               AND c.relname = 'notificacao_bancaria'
               AND r.contype = 'c'
             ORDER BY r.conname
          `;

          expect(restricoes).toEqual([
            {
              nome: 'notificacao_bancaria_tratamento_chk',
              expressao:
                "CHECK (((tratado_em IS NULL) = (desfecho = 'RECEBIDO'::plataforma.desfecho_da_notificacao)))",
            },
          ]);

          // --- os três índices, e o predicado PARCIAL de dois deles -----------------------------------
          const indices = await sql<{ nome: string; predicado: string | null }[]>`
            SELECT i.relname AS "nome",
                   pg_catalog.pg_get_expr(x.indpred, x.indrelid) AS "predicado"
              FROM pg_catalog.pg_index x
              JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
              JOIN pg_catalog.pg_class c ON c.oid = x.indrelid
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'plataforma'
               AND c.relname = 'notificacao_bancaria'
               AND i.relname <> 'notificacao_bancaria_pkey'
             ORDER BY i.relname
          `;

          // Por igualdade, com o predicado de cada um: sem o predicado, um índice que perdesse o `WHERE`
          // continuaria "existindo" e a asserção passaria — e é justamente a parcialidade que faz a
          // reativação achar as retidas sem varrer os 90 dias de cru.
          expect(indices).toEqual(INDICES_DA_NOTIFICACAO);

          // --- o enum, com os nove rótulos NA ORDEM -------------------------------------------------
          const rotulos = await sql<{ rotulo: string }[]>`
            SELECT e.enumlabel AS "rotulo"
              FROM pg_catalog.pg_enum e
              JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
              JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
             WHERE n.nspname = 'plataforma' AND t.typname = 'desfecho_da_notificacao'
             ORDER BY e.enumsortorder
          `;

          expect(rotulos.map((linha) => linha.rotulo)).toEqual(DESFECHOS_DECLARADOS);
        } finally {
          await sql.end();
        }
      },
      LIMITE_DO_CASO_MS,
    );

    it(
      'CT-994 — (c) a intrusa com `empresa_id` reprova por CARREGA_COLUNA_DE_EMPRESA, e a admitida não reprova',
      async () => {
        await executarPrivilegiado(doMigrador, [
          `CREATE TABLE ${INTRUSA_COM_EMPRESA} (id uuid PRIMARY KEY, empresa_id uuid)`,
        ]);

        try {
          const comIntrusa = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);

          // A ORDEM NORMATIVA dos motivos, afirmada sobre um roster POVOADO — que é o que o CT-813 não
          // podia fazer. A intrusa falha as DUAS propriedades ao mesmo tempo (tem coluna de empresa e
          // está fora do roster), e o motivo reportado decide qual correção quem lê vai fazer:
          // `FORA_DO_ROSTER` convidaria a acrescentá-la ao roster — a correção que a ADR-0031 recusa.
          // Invertida a ordem em `PROPRIEDADES_DA_ADMISSAO`, esta asserção reprova.
          //
          // E a tabela ADMITIDA aparece entre as examinadas **sem render exceção alguma**: é o que
          // separa "a guarda reprova a intrusa" de "a guarda reprova tudo que olha".
          expect(comIntrusa).toEqual({
            excecoes: [{ tabela: INTRUSA_COM_EMPRESA, motivo: 'CARREGA_COLUNA_DE_EMPRESA' }],
            tabelasExaminadas: [TABELA_ADMITIDA, INTRUSA_COM_EMPRESA],
          } satisfies AdmissaoDePlataforma);
        } finally {
          await executarPrivilegiado(doMigrador, [`DROP TABLE ${INTRUSA_COM_EMPRESA}`]);
        }

        expect(await conferirAdmissaoDePlataforma(banco.cadeiaConexao)).toEqual(ADMISSAO_INTEGRA);
      },
      LIMITE_DO_CASO_MS,
    );

    it(
      'CT-994 — (d) renomeada a tabela admitida, as DUAS direções da igualdade reprovam na mesma resposta',
      async () => {
        // A segunda direção é exercitada pelo caminho LEGÍTIMO: o roster continua congelado e intocado,
        // e o que muda é o BANCO — a tabela declarada deixa de existir com aquele nome. É literalmente
        // o cenário que o motivo nomeia ("renomeada, ainda não migrada, dropada"), e o único que não
        // exige alargar a superfície de produção para o teste enxergar algo.
        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_ADMITIDA} RENAME TO notificacao_bancaria_antiga`,
        ]);

        try {
          const aposORenome = await conferirAdmissaoDePlataforma(banco.cadeiaConexao);

          // As duas direções, na ordem que o SUT documenta: primeiro o que o banco tem e o roster não
          // admite, depois o que o roster declara e o banco não tem.
          //
          // Sem a segunda direção, esta resposta traria APENAS a linha `FORA_DO_ROSTER` — e o roster
          // continuaria concedendo licença a um nome que ninguém mais escreve, em silêncio. É a
          // asserção que discrimina: ela reprova com a implementação de uma direção só.
          expect(aposORenome).toEqual({
            excecoes: [
              { tabela: NOME_APOS_O_RENOME, motivo: 'FORA_DO_ROSTER' },
              { tabela: TABELA_ADMITIDA, motivo: 'AUSENTE_DO_BANCO' },
            ],
            tabelasExaminadas: [NOME_APOS_O_RENOME],
          } satisfies AdmissaoDePlataforma);
        } finally {
          await executarPrivilegiado(doMigrador, [
            `ALTER TABLE ${NOME_APOS_O_RENOME} RENAME TO notificacao_bancaria`,
          ]);
        }

        // Desfeito o renome, a guarda volta ao verde — sem este passo, "reprovou" não distinguiria o
        // defeito de uma guarda que reprova sempre.
        expect(await conferirAdmissaoDePlataforma(banco.cadeiaConexao)).toEqual(ADMISSAO_INTEGRA);
      },
      LIMITE_DO_CASO_MS,
    );

    it(
      'CT-994 — (e) o `check` recusa as duas metades da bicondicional, e aceita as duas coerentes',
      async () => {
        // As escritas correm pela cadeia de MIGRAÇÃO, e a escolha é conteúdo: o `GRANT` de
        // `plataforma.notificacao_bancaria` ao papel da aplicação é da migração `0020` (T3), que
        // esta task não escreve — medido, `sysloc_app` recebe `42501 permission denied` aqui. O
        // `check` é propriedade do BANCO e independe de quem escreve, de modo que provar por outro
        // papel prova a mesma coisa; e é o mesmo acessório e a mesma origem de privilégio de
        // {@link executarPrivilegiado}, que os casos acima já usam para a DDL.
        const sql = abrirConexao(doMigrador, { maximoDeConexoes: 1 });

        try {
          // --- a metade "tratado sem desfecho": `tratado_em` preenchido com `RECEBIDO` --------------
          await expect(
            sql`
              INSERT INTO plataforma.notificacao_bancaria (recebido, desfecho, tratado_em)
              VALUES (${sql.json({ eco: 1 })}, 'RECEBIDO', now())
            `,
          ).rejects.toMatchObject({
            code: VIOLACAO_DE_CHECK,
            constraint_name: 'notificacao_bancaria_tratamento_chk',
          });

          // --- a metade "desfecho sem carimbo": desfecho definitivo com `tratado_em` nulo -----------
          //
          // As duas metades são independentes, e é por isso que as duas têm caso: escrita como duas
          // restrições soltas, a bicondicional deixaria passar exatamente aquela que fosse esquecida.
          await expect(
            sql`
              INSERT INTO plataforma.notificacao_bancaria (recebido, desfecho)
              VALUES (${sql.json({ eco: 2 })}, 'APLICADO')
            `,
          ).rejects.toMatchObject({
            code: VIOLACAO_DE_CHECK,
            constraint_name: 'notificacao_bancaria_tratamento_chk',
          });

          // --- os dois estados COERENTES entram, e a contagem prova que nada foi gravado antes -------
          //
          // Sem este par positivo, um `check` que recusasse TUDO passaria nas duas asserções acima. E a
          // contagem crua discrimina "recusou" de "recusou e não gravou".
          await sql`
            INSERT INTO plataforma.notificacao_bancaria (recebido)
            VALUES (${sql.json({ eco: 3 })})
          `;
          await sql`
            INSERT INTO plataforma.notificacao_bancaria (recebido, desfecho, tratado_em)
            VALUES (${sql.json({ eco: 4 })}, 'APLICADO', now())
          `;

          const gravadas = await sql<{ desfecho: string; comCarimbo: boolean }[]>`
            SELECT desfecho, (tratado_em IS NOT NULL) AS "comCarimbo"
              FROM plataforma.notificacao_bancaria
             ORDER BY recebido->>'eco'
          `;

          expect(gravadas).toEqual([
            { desfecho: 'RECEBIDO', comCarimbo: false },
            { desfecho: 'APLICADO', comCarimbo: true },
          ]);
        } finally {
          await sql`DELETE FROM plataforma.notificacao_bancaria`.catch(() => undefined);
          await sql.end();
        }
      },
      LIMITE_DO_CASO_MS,
    );
  });
});
