/**
 * A derivação pura das parcelas de aluguel, contra o oráculo — CT-504, CT-505, CT-506 e CT-507.
 * T8 da fatia `cobranca-e-mora`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-02    | CT-504 | Para cada um dos **3** cenários do bloco `cobrancas` de
 * |          |        | `contrato-ativacao.json`, `derivarParcelasDoContrato` devolve lista de
 * |          |        | comprimento igual ao `prazo_meses` (3, 4 e 13) e cada parcela iguala o
 * |          |        | registro do golden em `competencia`, `dataVencimento`, `referencia` e
 * |          |        | `valorOriginal` — igualdade exata de cadeia e de número, sem tolerância. A
 * |          |        | contagem **total** de parcelas comparadas é asserida: `3 + 4 + 13 = 20`. |
 * | CA-02    | CT-505 | O início de cada período é derivado do início do período **anterior**
 * |          |        | (`inicio[i] = avançar 1 mês de inicio[i-1]`, com saturação no último dia do
 * |          |        | mês), nunca do início original — de modo que para `2027-01-31` os inícios são
 * |          |        | `31/01`, `28/02`, **`28/03`**, `28/04`, e a saturação de fevereiro é HERDADA
 * |          |        | pelos meses seguintes. O controle não-iterativo escrito neste arquivo produz
 * |          |        | `31/03/2027` no terceiro período, e a divergência é afirmada **pelo índice**:
 * |          |        | `[1, 2, 3]` no cenário de 4 meses e `[1 … 12]` no de 13 — doze dos treze. E o
 * |          |        | cenário de dia seguro (15) **não discrimina**: divergência vazia, medida. |
 * | CA-02    | CT-506 | A função devolve as mesmas cadeias sob `TZ=UTC`, `TZ=America/Sao_Paulo` e
 * |          |        | `TZ=Pacific/Kiritimati` (UTC+14) — a fixação do fuso é ela mesma afirmada
 * |          |        | pelos deslocamentos `0`, `180` e `-840`, **antes** do resultado. O ano de
 * |          |        | destino entre 1 e 99 sai literal (`0050-04-01`, não `1950-04-01`). E o fonte
 * |          |        | de `src/derivacao-de-cobranca.ts` **não contém** `Date.UTC(` nem `new Date(`
 * |          |        | com três ou mais argumentos, em posição executável. |
 * | CA-02    | CT-507 | Para prazo `N ∈ {1, 3, 4, 12, 13}` e dia de vencimento nas duas pontas
 * |          |        | admitidas (`1` e `28`), a lista tem exatamente `N` parcelas; toda parcela tem
 * |          |        | `natureza === 'ALUGUEL'` e `valorOriginal === valorMensal`; a competência é
 * |          |        | sempre o primeiro dia do mês e é estritamente crescente; e o dia de
 * |          |        | `dataVencimento` é exatamente `diaVencimento`, **sem saturar**, inclusive na
 * |          |        | competência de fevereiro. Prazo `0` devolve lista vazia, prazo impossível
 * |          |        | levanta `RangeError`, e `diaVencimento = 29` é recusado **pelo esquema**. |
 *
 * Rastreabilidade: `CA-02 → CT-504 (RN-06)`, `CA-02 → CT-505 (RN-06)`, `CA-02 → CT-506 (RN-06)`,
 * `CA-02 → CT-507 (RN-07)`.
 *
 * ===========================================================================
 * O GOLDEN É LIDO DO ARQUIVO VERSIONADO, NUNCA REDIGITADO
 * ===========================================================================
 *
 * Ele é o **oráculo** — o registro capturado do sistema antigo, em
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-ativacao.json`, produzido na
 * fatia `contratos-de-locacao` e aprovado nos dois gates. Esta task o **consome do disco**: não o
 * recaptura (ADR-0006 — a captura correu contra ambiente separado do que atende a operação) e não o
 * redigita, porque redigitá-lo faria a asserção concordar com quem a escreveu, e o valor de
 * equivalência com o legado desapareceria em silêncio no primeiro erro de transcrição. **Se a
 * implementação divergir dele, o errado é a implementação.**
 *
 * O bloco `cobrancas` tem três cenários e **nenhum caso o tocava até aqui**:
 * `derivacao-de-contrato.spec.ts` afirma sobre os blocos `derivacao`, `validacao` e `fluxo`.
 *
 * A contagem de cenários e a de parcelas são elas mesmas asseridas: sem isso, um golden truncado, um
 * `id` que deixasse de casar entre `entrada` e `retorno`, ou um laço que parasse cedo deixariam o caso
 * verde tendo provado um punhado de parcelas.
 *
 * ---------------------------------------------------------------------------
 * DIVERGÊNCIA DECLARADA DA §6.6 — o fim do terceiro período do controle é `29/04`, e não `30/04`
 * ---------------------------------------------------------------------------
 *
 * O card do CT-505 diz que o controle não-iterativo *"devolve `31/03/2027 à 30/04/2027` no terceiro
 * período"*. O **início** está certo, e é ele que a RD-19 nomeia como o discriminador: `31/03/2027`
 * contra `28/03/2027`. O fim, **medido**, é `29/04/2027` — porque a mesma saturação que o controle
 * aplica ao início também se aplica ao fim (abril tem 30 dias, e a véspera de `30/04` é `29/04`).
 * Escrever `30/04` no teste exigiria um controle que saturasse o início e **não** o fim, isto é, um
 * terceiro defeito que ninguém propôs. O valor asserido abaixo é o medido, com a razão aqui e não só
 * no relatório — mesma forma da divergência que `derivacao-de-contrato.spec.ts` registra sobre o par
 * `1350.50 × 12` do card do CT-402.
 *
 * ===========================================================================
 * NADA AQUI TOCA BANCO, RELÓGIO OU REQUISIÇÃO
 * ===========================================================================
 *
 * A função é pura, e a suíte prova isso por construção: **não há instância efêmera, não há
 * `contextoDeTenant`, não há unidade de trabalho e não há mock** (a §6.0 do card manda "mocks:
 * nenhum"). O único acesso ao mundo é a leitura de dois arquivos — o golden, que é dado de entrada, e
 * o próprio fonte sob teste, que é o alvo da asserção estática do CT-506.
 *
 * O `CT-506` escreve `process.env.TZ`, que é **mecanismo nativo do Node** e estado do processo, não um
 * ponto de injeção de produção: nenhum símbolo, parâmetro, sinalizador ou ramo foi acrescentado a
 * `packages/db/src/**` para que estas provas existam (Iron Law #6). É o mesmo seam do `CT-432`, e o
 * valor original é restaurado no `afterAll`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os cinco reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os cinco mutantes abaixo foram aplicados ao fonte
 * de produção (`src/derivacao-de-cobranca.ts`) e a suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — os pacotes resolvem `"."` para
 * `dist/`, e o modo de falha é silencioso e **inverte a conclusão** (verde lido como *"o mutante
 * sobreviveu"*).
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 114 casos, 0 falhas`;
 *   * **MT8-1 · o cursor deixa de ser ITERATIVO** (o dia é reposto ao da data de início original a
 *     cada avanço, que é `addMeses(inicioOriginal, i)` escrito de outro jeito): `3 failed |
 *     111 passed`. Reprovam o **CT-504** (`inicio_no_dia_trinta_e_um_quatro_meses#1`), o **CT-505**
 *     no caso das quatro referências e o **CT-506** no bloco dos três fusos. O cenário de dia seguro
 *     (15) segue **verde**, e é essa cegueira que o discriminador existe para fechar;
 *   * **MT8-2 · a saturação de fim de mês removida** (`Math.min(data.dia, ultimoDiaDoMes(…))` virando
 *     `data.dia`): `3 failed | 111 passed` — o **CT-504** reprova já no primeiro período do
 *     discriminador (`inicio_no_dia_trinta_e_um_quatro_meses#0`), o **CT-505** com
 *     `'31/01/2027 à 30/02/2027'` — um trinta de fevereiro, que é a forma mais legível do defeito — e
 *     o **CT-506** em bloco;
 *   * **MT8-3 · `Date.UTC` reintroduzido** (`formatarEmIso` passa a construir o instante com
 *     `new Date(Date.UTC(ano, mes - 1, dia))` e a ler pelos acessores UTC): `2 failed | 112 passed` —
 *     o **CT-506** reprova no contrato de ano baixo (`1950-03-01` no lugar de `0050-03-01`, o defeito
 *     `D21` de volta) **e** na asserção ESTÁTICA, que passa a contar **1** ocorrência onde afirma
 *     zero. É a prova de falsificação que o passo 5 do card exige, medida sobre a asserção commitada;
 *   * **MT8-4 · a aritmética passa pelo relógio local** (`formatarEmIso` construindo
 *     `new Date(ano, mes - 1, dia)`): `2 failed | 112 passed` — o **CT-506** reprova no fuso
 *     `Pacific/Kiritimati`, porque as cadeias deixam de ser iguais nos três, **e** na asserção
 *     estática, agora pela segunda expressão (`new Date(` com três argumentos);
 *   * **MT8-5 · o vencimento cai no mês do período SEGUINTE** (`{ ...inicioDoPeriodoSeguinte, dia:
 *     diaVencimento }` no lugar de `{ ...competencia, … }`): `3 failed | 111 passed` — reprovam o
 *     **CT-504** já no primeiro cenário (`dia_seguro_tres_meses#0`), o **CT-506** e o **CT-507**
 *     (`['2027-02-28', …]` no lugar de `['2027-01-28', …]`). É o mutante que prova que os treze
 *     vencimentos literais do CT-507 e a comparação de objeto inteiro do CT-504 não são decoração;
 *   * **reversão** — `src/derivacao-de-cobranca.ts` foi restaurado e conferido idêntico ao original
 *     por `diff -q` após cada mutante, com o `tsc --build` do próprio script refeito, e o controle
 *     voltou a `114 passed`.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { esquemaDeContratoNovo } from '@syslocbr/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ContratoParaParcelas,
  derivarParcelasDoContrato,
  type ParcelaDerivada,
} from '../src/derivacao-de-cobranca.ts';
import { semComentarios, varrerArquivos } from './varredura-de-fontes.ts';

// ---------------------------------------------------------------------------
// O golden — o oráculo, lido do arquivo versionado
// ---------------------------------------------------------------------------

/** O registro capturado do sistema antigo. Caminho relativo a este arquivo, nunca ao processo. */
const CAMINHO_DO_GOLDEN = fileURLToPath(
  new URL(
    '../../../docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-ativacao.json',
    import.meta.url,
  ),
);

/** O fonte sob teste — o alvo da asserção ESTÁTICA do CT-506. */
const CAMINHO_DO_FONTE = fileURLToPath(new URL('../src/derivacao-de-cobranca.ts', import.meta.url));

/**
 * Os três cenários do bloco `cobrancas`, nomeados e em ordem.
 *
 * Nomeá-los — em vez de contar quantos são — é o que faz o caso reprovar quando um cenário for
 * trocado por outro sem que o total mude, e é a metade da bijeção que o card do CT-504 pede.
 */
const CENARIOS_DO_BLOCO: readonly string[] = [
  'dia_seguro_tres_meses',
  'inicio_no_dia_trinta_e_um_quatro_meses',
  'inicio_no_dia_trinta_e_um_treze_meses',
];

/** Quantas parcelas cada cenário produz, e o total que o CT-504 afirma: `3 + 4 + 13`. */
const PARCELAS_POR_CENARIO: readonly number[] = [3, 4, 13];
const TOTAL_DE_PARCELAS = PARCELAS_POR_CENARIO.reduce((soma, quantas) => soma + quantas, 0);

/** O contrato de um cenário, nos nomes que o sistema antigo grava. */
interface ContratoDoGolden {
  readonly data_inicio_locacao: string;
  readonly dia_vencimento: number;
  readonly prazo_meses: number;
  readonly valor_mensal: number;
}

/** Uma cobrança como o sistema antigo a devolveu — quatro dos onze campos entram na comparação. */
interface ParcelaDoGolden {
  readonly competencia: string;
  readonly data_vencimento: string;
  readonly referencia: string;
  readonly valor_original: number;
}

interface Golden {
  readonly entrada: {
    readonly cobrancas: readonly { readonly id: string; readonly contrato: ContratoDoGolden }[];
  };
  readonly retorno: {
    readonly cobrancas: readonly {
      readonly id: string;
      readonly resultado: {
        readonly aceito: boolean;
        readonly retorno?: readonly ParcelaDoGolden[];
      };
    }[];
  };
}

/** A projeção comparável de uma parcela — os quatro campos que o oráculo fixa. */
interface ParcelaComparavel {
  readonly competencia: string;
  readonly dataVencimento: string;
  readonly referencia: string;
  readonly valorOriginal: number;
}

/** Um cenário na forma que os casos consomem: a entrada da função e as parcelas do oráculo. */
interface CenarioDeParcelas {
  readonly id: string;
  readonly contrato: ContratoParaParcelas;
  readonly esperadas: readonly ParcelaComparavel[];
}

let golden: Golden;
let cenarios: readonly CenarioDeParcelas[];

beforeAll(async () => {
  golden = JSON.parse(await readFile(CAMINHO_DO_GOLDEN, 'utf8')) as Golden;
  cenarios = montarCenarios(golden);
});

// ---------------------------------------------------------------------------
// Os valores MEDIDOS que os casos afirmam
// ---------------------------------------------------------------------------

/** O cenário discriminador, pelo nome — o `2027-01-31` com prazo 4. */
const DISCRIMINADOR = 'inicio_no_dia_trinta_e_um_quatro_meses';

/** O segundo cenário iniciado em `2027-01-31`, com prazo 13 — a saturação herdada por um ano. */
const DISCRIMINADOR_LONGO = 'inicio_no_dia_trinta_e_um_treze_meses';

/** O cenário de dia seguro (15), em que a forma não-iterativa **acerta** — e é o que a mede. */
const DIA_SEGURO = 'dia_seguro_tres_meses';

/**
 * As quatro referências do cenário discriminador, como o oráculo as escreve.
 *
 * Elas estão escritas aqui **além** de virem do golden, e o CT-505 afirma as duas pontas: que a
 * constante bate com o oráculo, e que a implementação bate com a constante. É a terceira que a RD-19
 * nomeia — `28/03/2027`, e não `31/03/2027`.
 */
const REFERENCIAS_DO_DISCRIMINADOR: readonly string[] = [
  '31/01/2027 à 27/02/2027',
  '28/02/2027 à 27/03/2027',
  '28/03/2027 à 27/04/2027',
  '28/04/2027 à 27/05/2027',
];

/** O terceiro período do controle NÃO-ITERATIVO — medido. Ver a divergência declarada no cabeçalho. */
const TERCEIRO_PERIODO_DO_CONTROLE = '31/03/2027 à 29/04/2027';

/** Em quais períodos o controle não-iterativo diverge do oráculo — **medido**, não suposto. */
const INDICES_DIVERGENTES_EM_QUATRO_MESES: readonly number[] = [1, 2, 3];
const INDICES_DIVERGENTES_EM_TREZE_MESES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

/** Os três fusos do caso, com o deslocamento que cada um impõe em janeiro de 2027. */
const FUSOS_DO_CASO = [
  { tz: 'UTC', deslocamento: 0 },
  { tz: 'America/Sao_Paulo', deslocamento: 180 },
  { tz: 'Pacific/Kiritimati', deslocamento: -840 },
] as const;

/**
 * As competências que o controle pelo **relógio local** devolve em cada fuso — medidas.
 *
 * No terceiro fuso a primeira competência retrocede um mês inteiro: `2026-12-01` no lugar de
 * `2027-01-01`. É a medição que dá conteúdo ao caso — sem ela, "as cadeias são iguais nos três" ficaria
 * verde sobre uma implementação imune por acidente, e o mutante `MT8-4` sobreviveria.
 */
const COMPETENCIAS_PELO_RELOGIO_LOCAL: readonly (readonly string[])[] = [
  ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01'],
  ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01'],
  ['2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'],
];

/**
 * O contrato de ano baixo, fora do golden de propósito.
 *
 * O oráculo **não tem** cenário nessa faixa e não vai ganhar um: ele reproduz o sistema antigo, que
 * nunca operou nela. O caso existe porque `Date.UTC` remapeia argumento de ano entre 0 e 99 para
 * `1900 + ano`, e o valor errado sairia com a **forma certa** — foi o defeito `D21`, fechado em
 * 2026-08-09 no commit `3697027`, e a rede dele é o `RG-D21-01` da suíte irmã.
 */
const CONTRATO_DE_ANO_BAIXO: ContratoParaParcelas = {
  dataInicioLocacao: '0050-03-15',
  prazoMeses: 2,
  diaVencimento: 10,
  valorMensal: 1500,
};

/** O que a derivação produz para ele — o ano **literal**, não `1950`. */
const PARCELAS_DO_ANO_BAIXO: readonly ParcelaComparavel[] = [
  {
    competencia: '0050-03-01',
    dataVencimento: '0050-03-10',
    referencia: '15/03/0050 à 14/04/0050',
    valorOriginal: 1500,
  },
  {
    competencia: '0050-04-01',
    dataVencimento: '0050-04-10',
    referencia: '15/04/0050 à 14/05/0050',
    valorOriginal: 1500,
  },
];

// ===========================================================================
// CT-504 — as 20 parcelas dos três cenários do golden, campo a campo
// ===========================================================================

describe('CT-504 — a derivação reproduz o bloco `cobrancas` do golden nos três cenários', () => {
  it('devolve as 20 parcelas iguais ao oráculo em competência, vencimento, referência e valor', () => {
    // --- As âncoras, ANTES de qualquer asserção sobre valores ---------------------------------
    //
    // Contagem, identidade e bijeção num golpe: as duas listas do golden têm os MESMOS três `id`, na
    // mesma ordem. Um golden truncado, um cenário renomeado ou um `id` que deixasse de casar entre
    // `entrada` e `retorno` reprovam aqui, e não silenciosamente lá embaixo com meia dúzia de
    // parcelas provadas.
    expect(golden.entrada.cobrancas.map(({ id }) => id)).toEqual([...CENARIOS_DO_BLOCO]);
    expect(golden.retorno.cobrancas.map(({ id }) => id)).toEqual([...CENARIOS_DO_BLOCO]);

    // A junção não perdeu cenário: `montarCenarios` descarta o que não casa, e sem esta linha o
    // descarte seria silencioso.
    expect(cenarios.map(({ id }) => id)).toEqual([...CENARIOS_DO_BLOCO]);

    // E o oráculo traz 3, 4 e 13 parcelas — a âncora contra um `retorno` truncado, que faria o laço
    // abaixo comparar menos do que afirma comparar.
    expect(cenarios.map(({ esperadas }) => esperadas.length)).toEqual([...PARCELAS_POR_CENARIO]);

    let comparadas = 0;

    for (const cenario of cenarios) {
      const parcelas = derivarParcelasDoContrato(cenario.contrato);

      // O comprimento é o prazo do cenário — 3, 4 e 13 —, e a lista do oráculo o confirma.
      expect(parcelas, cenario.id).toHaveLength(cenario.contrato.prazoMeses);

      for (const [indice, parcela] of parcelas.entries()) {
        // Igualdade do OBJETO inteiro projetado, e não de campo em campo: um campo esquecido na
        // comparação passaria despercebido. O rótulo nomeia cenário e período, de modo que a
        // divergência de um dia sequer reprova dizendo QUAL parcela do legado deixou de ser
        // reproduzida.
        expect(comparavel(parcela), `${cenario.id}#${indice}`).toEqual(cenario.esperadas[indice]);

        comparadas += 1;
      }
    }

    // A segunda metade da âncora: o laço percorreu as 20, e não saiu na primeira volta.
    expect(comparadas).toBe(TOTAL_DE_PARCELAS);
    expect(TOTAL_DE_PARCELAS).toBe(20);

    // --- E a última parcela do cenário mais longo, isolada -------------------------------------
    //
    // O card a nomeia, e ela é a que só existe se a iteração alcançou o décimo terceiro período — um
    // ano e um mês depois do início, já com a saturação de fevereiro herdada.
    expect(
      comparavel(ultima(derivarParcelasDoContrato(cenarioDoGolden(DISCRIMINADOR_LONGO).contrato))),
    ).toEqual({
      competencia: '2028-01-01',
      dataVencimento: '2028-01-05',
      referencia: '28/01/2028 à 27/02/2028',
      valorOriginal: 1000,
    });
  });
});

// ===========================================================================
// CT-505 — a saturação é ITERATIVA: o terceiro período de `2027-01-31` é `28/03`
// ===========================================================================

describe('CT-505 — o início de cada período vem do anterior, e a saturação é herdada', () => {
  it('reproduz as quatro referências do discriminador, com `28/03/2027` no terceiro período', () => {
    // A constante deste arquivo bate com o oráculo — sem esta linha, ela poderia ter sido escrita
    // errada e o caso seguinte concordaria com o erro.
    expect(referencias(cenarioDoGolden(DISCRIMINADOR).esperadas)).toEqual([
      ...REFERENCIAS_DO_DISCRIMINADOR,
    ]);

    // E a implementação bate com a constante. A terceira é a que a RD-19 nomeia.
    const parcelas = derivarParcelasDoContrato(cenarioDoGolden(DISCRIMINADOR).contrato);
    expect(referencias(parcelas.map(comparavel))).toEqual([...REFERENCIAS_DO_DISCRIMINADOR]);
  });

  it('os cenários DISCRIMINAM: o controle não-iterativo dá `31/03` e diverge nos índices nomeados', () => {
    // Este é o controle NEGATIVO, e ele é o que prova que o caso acima não está verde por acaso. O
    // controle é uma implementação DEFEITUOSA de propósito — nenhuma asserção deste arquivo afirma
    // que ele está certo; o que se afirma é que ele DIVERGE do oráculo, e é essa divergência que
    // torna o mutante `MT8-1` detectável por esta suíte para sempre, e não apenas na rodada em que
    // alguém o aplicou à mão.
    const controle = controleNaoIterativo(cenarioDoGolden(DISCRIMINADOR).contrato);

    // O terceiro período parte do 31 original outra vez — é o defeito, com nome e valor.
    expect(controle[2]).toBe(TERCEIRO_PERIODO_DO_CONTROLE);

    // E o período que ele produz não é NENHUM dos quatro do oráculo. A negativa é sobre a lista, e não
    // sobre `esperadas[2]`: uma indexação que devolvesse `undefined` faria um `not.toBe` passar
    // trivialmente, que é a forma silenciosa de perder a metade discriminante do par.
    expect(REFERENCIAS_DO_DISCRIMINADOR).not.toContain(TERCEIRO_PERIODO_DO_CONTROLE);
    expect(referencias(cenarioDoGolden(DISCRIMINADOR).esperadas)).not.toContain(controle[2]);

    // A divergência é NOMEADA pelo índice do período, e não contada: uma queda de três para dois
    // diria que algo mudou, mas não o quê.
    expect(indicesDivergentes(controle, cenarioDoGolden(DISCRIMINADOR))).toEqual([
      ...INDICES_DIVERGENTES_EM_QUATRO_MESES,
    ]);

    // --- O mesmo par no cenário de treze meses ------------------------------------------------
    //
    // Doze dos treze períodos divergem — a saturação de fevereiro é herdada por um ano inteiro, e só
    // o primeiro período (que antecede a virada) coincide.
    const controleLongo = controleNaoIterativo(cenarioDoGolden(DISCRIMINADOR_LONGO).contrato);
    expect(indicesDivergentes(controleLongo, cenarioDoGolden(DISCRIMINADOR_LONGO))).toEqual([
      ...INDICES_DIVERGENTES_EM_TREZE_MESES,
    ]);

    // --- E a medição que explica por que o discriminador é NECESSÁRIO --------------------------
    //
    // No cenário de dia seguro (15), a forma não-iterativa acerta os três períodos. Sem os dois
    // cenários iniciados em `2027-01-31`, o defeito atravessaria o golden inteiro sem ser visto — é
    // o mesmo achado do `CT-402` da suíte irmã, em que nenhum dos 23 cenários discrimina a
    // aritmética do valor total.
    expect(
      indicesDivergentes(
        controleNaoIterativo(cenarioDoGolden(DIA_SEGURO).contrato),
        cenarioDoGolden(DIA_SEGURO),
      ),
    ).toEqual([]);
  });
});

// ===========================================================================
// CT-506 — indiferença ao fuso, ano baixo literal, e as duas construções proibidas
// ===========================================================================

describe('CT-506 — a derivação não passa pelo relógio do processo nem pelo construtor de `Date`', () => {
  const FUSO_ORIGINAL = process.env.TZ;

  afterAll(() => {
    // O fuso é estado do PROCESSO: deixá-lo trocado vazaria para qualquer caso que rodasse depois.
    if (FUSO_ORIGINAL === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = FUSO_ORIGINAL;
    }
  });

  it('devolve as mesmas cadeias nos três fusos, e o ano de destino 0050 não vira 1950', () => {
    const pelaDerivacao: ParcelaComparavel[][] = [];
    const peloRelogioLocal: string[][] = [];

    for (const fuso of FUSOS_DO_CASO) {
      process.env.TZ = fuso.tz;

      // A ÂNCORA da precondição, e ela não é ornamento: escrever `process.env.TZ` depois de o
      // processo já ter resolvido o fuso pode não surtir efeito, e o caso ficaria verde tendo
      // avaliado três vezes o MESMO fuso — provando nada. O deslocamento é lido de um instante
      // construído no relógio local, que é justamente o que a troca precisa afetar.
      expect(new Date(2027, 0, 1).getTimezoneOffset(), fuso.tz).toBe(fuso.deslocamento);

      pelaDerivacao.push(
        derivarParcelasDoContrato(cenarioDoGolden(DISCRIMINADOR).contrato).map(comparavel),
      );
      peloRelogioLocal.push(competenciasPeloRelogioLocal(cenarioDoGolden(DISCRIMINADOR).contrato));
    }

    // As mesmas parcelas nos três, e o valor EXATO — não só "iguais entre si": três resultados
    // igualmente errados também seriam iguais entre si.
    const esperadas = [...cenarioDoGolden(DISCRIMINADOR).esperadas];
    expect(pelaDerivacao).toEqual([esperadas, esperadas, esperadas]);

    // --- O controle NEGATIVO do fuso ------------------------------------------------------------
    //
    // A MESMA competência, construída no relógio local em vez de por aritmética de cadeia, retrocede
    // um mês inteiro em UTC+14.
    expect(peloRelogioLocal).toEqual(COMPETENCIAS_PELO_RELOGIO_LOCAL.map((lista) => [...lista]));
    expect(peloRelogioLocal[2]).not.toEqual(peloRelogioLocal[0]);

    // --- O ano baixo, e o controle com `Date.UTC` ----------------------------------------------
    expect(derivarParcelasDoContrato(CONTRATO_DE_ANO_BAIXO).map(comparavel)).toEqual([
      ...PARCELAS_DO_ANO_BAIXO,
    ]);

    // O controle que constrói o instante com `Date.UTC` devolve o ano remapeado — com a FORMA certa
    // e mil e novecentos anos de erro, que é o que tornava o defeito `D21` mudo.
    expect(competenciaComDateUtc(50, 4)).toBe('1950-04-01');
    expect(competenciaComDateUtc(50, 4)).not.toBe('0050-04-01');
  });

  it('o fonte não contém `Date.UTC(` nem `new Date(` com três argumentos, fora de comentário', async () => {
    // --- O par de CONTROLE da detecção, e ele vem PRIMEIRO -------------------------------------
    //
    // Uma asserção estática que não pode falhar é o defeito registrado em
    // `.claude/rules/testing-stack.md` ("asserção que casava `ALTER ROLE` em comentário e mensagem de
    // erro"). O par positivo prova que o predicado ENXERGA as duas construções; o negativo prova que
    // ele não é cego às formas legítimas nem casa o que está em comentário.
    for (const proibida of [
      'const inicio = Date.UTC(ano, mes - 1, dia);',
      'const inicio = new Date(ano, mes - 1, dia);',
      'return new Date(2027, 0, 1).getTime();',
    ]) {
      expect(casaConstrucaoProibida(semComentarios(proibida)), proibida).toBe(true);
    }

    for (const legitima of [
      '// nunca `Date.UTC(ano, mes, dia)`, que remapeia o século',
      '/* e nunca `new Date(ano, mes, dia)`, que lê o fuso do processo */',
      'const epoca = new Date(0);',
      'const instante = new Date(cadeia);',
      'const janela = new Date(inicio, fim);',
    ]) {
      expect(casaConstrucaoProibida(semComentarios(legitima)), legitima).toBe(false);
    }

    // --- E o fonte de produção não tem nenhuma das duas ---------------------------------------
    const varredura = await varrerArquivos([CAMINHO_DO_FONTE], casaConstrucaoProibida);

    // O alvo foi lido de verdade: zero arquivo varrido daria zero ocorrência e um caso vacuamente
    // verde — que é o segundo defeito medido da mesma rule.
    expect(varredura.arquivos).toBe(1);
    expect(varredura.ocorrencias).toEqual([]);
  });
});

// ===========================================================================
// CT-507 — prazo N produz N parcelas de ALUGUEL, e o vencimento não satura
// ===========================================================================

/** Os prazos e os dias de vencimento das duas pontas admitidas, mais dois valores mensais. */
const PRAZOS_EXERCITADOS: readonly number[] = [1, 3, 4, 12, 13];
const DIAS_DE_VENCIMENTO_EXERCITADOS: readonly number[] = [1, 28];
const VALORES_MENSAIS_EXERCITADOS: readonly number[] = [1500, 1333.33];

/** O que a tabela produz no par (prazo 13, dia 28) — as competências de um ano e um mês. */
const COMPETENCIAS_DE_TREZE_MESES: readonly string[] = [
  '2027-01-01',
  '2027-02-01',
  '2027-03-01',
  '2027-04-01',
  '2027-05-01',
  '2027-06-01',
  '2027-07-01',
  '2027-08-01',
  '2027-09-01',
  '2027-10-01',
  '2027-11-01',
  '2027-12-01',
  '2028-01-01',
];

/**
 * E os treze vencimentos correspondentes — todos em `-28`, **inclusive** em fevereiro.
 *
 * Escritos por extenso, e **não** derivados da lista acima por substituição do dia: derivá-los
 * espelharia no teste a mesma composição que a produção faz (competência mais dia de vencimento), e um
 * esperado que repete o cálculo do SUT não pode discordar dele.
 */
const VENCIMENTOS_DE_TREZE_MESES: readonly string[] = [
  '2027-01-28',
  '2027-02-28',
  '2027-03-28',
  '2027-04-28',
  '2027-05-28',
  '2027-06-28',
  '2027-07-28',
  '2027-08-28',
  '2027-09-28',
  '2027-10-28',
  '2027-11-28',
  '2027-12-28',
  '2028-01-28',
];

/**
 * O corpo de contrato que o esquema aceita — a base do par positivo/negativo do dia de vencimento.
 *
 * Os identificadores são UUID canônicos porque `ESQUEMA_DO_IDENTIFICADOR` canoniza a caixa e recusa o
 * que não é UUID; `gerarCobrancasAutomaticamente` fica de fora porque tem valor por omissão.
 */
const CORPO_DE_CONTRATO = {
  imovelId: '11111111-1111-4111-8111-111111111111',
  locadorId: '22222222-2222-4222-8222-222222222222',
  locatarioId: '33333333-3333-4333-8333-333333333333',
  fiadoresIds: [],
  dataInicioLocacao: '2027-01-31',
  prazoMeses: 4,
  valorMensal: 1500,
  diaVencimento: 28,
} as const;

describe('CT-507 — o comprimento é o prazo, a natureza é ALUGUEL e o vencimento não satura', () => {
  it('cumpre as quatro invariantes em 5 prazos × 2 dias de vencimento × 2 valores mensais', () => {
    let combinacoes = 0;

    for (const prazoMeses of PRAZOS_EXERCITADOS) {
      for (const diaVencimento of DIAS_DE_VENCIMENTO_EXERCITADOS) {
        for (const valorMensal of VALORES_MENSAIS_EXERCITADOS) {
          const rotulo = `prazo ${prazoMeses} · dia ${diaVencimento} · valor ${valorMensal}`;
          const parcelas = derivarParcelasDoContrato({
            dataInicioLocacao: '2027-01-31',
            prazoMeses,
            diaVencimento,
            valorMensal,
          });

          expect(parcelas, rotulo).toHaveLength(prazoMeses);

          // Igualdade de cadeia e de número em TODA parcela — nunca `toBeDefined`, e nunca "existe".
          expect(
            parcelas.map(({ natureza }) => natureza),
            rotulo,
          ).toEqual(Array.from({ length: prazoMeses }, () => 'ALUGUEL'));
          expect(
            parcelas.map(({ valorOriginal }) => valorOriginal),
            rotulo,
          ).toEqual(Array.from({ length: prazoMeses }, () => valorMensal));

          // O dia do vencimento é exatamente o do contrato, **inclusive** nas competências de
          // fevereiro: com dia 28 não há o que saturar, e é a ausência do `Math.min` que se afirma.
          expect(
            parcelas.map(({ dataVencimento }) => dataVencimento.slice(8, 10)),
            rotulo,
          ).toEqual(
            Array.from({ length: prazoMeses }, () => String(diaVencimento).padStart(2, '0')),
          );

          // A competência é o primeiro dia do mês, e a sucessão é estritamente crescente. A forma é
          // afirmada pela lista das que NÃO casam — vazia —, e não por um booleano: a falha nomeia a
          // competência culpada em vez de dizer `false !== true`.
          const competencias = parcelas.map(({ competencia }) => competencia);
          expect(
            competencias.filter((competencia) => !competencia.endsWith('-01')),
            rotulo,
          ).toEqual([]);
          expect([...competencias].sort(), rotulo).toEqual(competencias);
          expect(new Set(competencias).size, rotulo).toBe(prazoMeses);

          combinacoes += 1;
        }
      }
    }

    // A âncora da tabela: as 20 combinações foram exercitadas, e o laço não saiu na primeira volta.
    expect(combinacoes).toBe(
      PRAZOS_EXERCITADOS.length *
        DIAS_DE_VENCIMENTO_EXERCITADOS.length *
        VALORES_MENSAIS_EXERCITADOS.length,
    );

    // --- E o par nomeado pelo card, com os treze valores literais -----------------------------
    const treze = derivarParcelasDoContrato({
      dataInicioLocacao: '2027-01-31',
      prazoMeses: 13,
      diaVencimento: 28,
      valorMensal: 1500,
    });

    expect(treze.map(({ competencia }) => competencia)).toEqual([...COMPETENCIAS_DE_TREZE_MESES]);
    expect(treze.map(({ dataVencimento }) => dataVencimento)).toEqual([
      ...VENCIMENTOS_DE_TREZE_MESES,
    ]);
    // Fevereiro de 2027 é comum e tem 28 dias: o vencimento cai no último dia do mês e NÃO transborda.
    expect(treze.map(({ dataVencimento }) => dataVencimento)).toContain('2027-02-28');
  });

  it('prazo zero devolve lista vazia, prazo impossível levanta, e o dia 29 é recusado pelo esquema', () => {
    // --- Prazo zero: aritmeticamente legítimo, e é o caminho da RD-20 -------------------------
    expect(
      derivarParcelasDoContrato({
        dataInicioLocacao: '2027-01-31',
        prazoMeses: 0,
        diaVencimento: 28,
        valorMensal: 1500,
      }),
    ).toEqual([]);

    // --- Prazo impossível: LEVANTA, em vez de devolver lista vazia em silêncio ----------------
    //
    // O tipo do erro é asserido, e não apenas "lançou algo": um `TypeError` vindo de outro defeito
    // passaria por um `toThrow()` genérico.
    for (const prazoMeses of [-1, -13, 2.5]) {
      expect(
        () =>
          derivarParcelasDoContrato({
            dataInicioLocacao: '2027-01-31',
            prazoMeses,
            diaVencimento: 28,
            valorMensal: 1500,
          }),
        String(prazoMeses),
      ).toThrow(RangeError);
      expect(() =>
        derivarParcelasDoContrato({
          dataInicioLocacao: '2027-01-31',
          prazoMeses,
          diaVencimento: 28,
          valorMensal: 1500,
        }),
      ).toThrow('prazoMeses precisa ser um inteiro não negativo');
    }

    // --- O teto do dia de vencimento é da BORDA, e não desta função ---------------------------
    //
    // A função não satura o vencimento em silêncio porque quem recusa o dia 29 é
    // `esquemaDeContratoNovo` (e o `check` do banco), e é essa recusa que se afirma aqui — nomeando
    // o campo, que é o que a borda traduz em `422 CAMPO_INVALIDO`.
    const recusado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, diaVencimento: 29 });
    expect(recusado.success).toBe(false);
    expect(recusado.error?.issues[0]?.path).toEqual(['diaVencimento']);

    // O controle POSITIVO: o mesmo corpo com o teto admitido passa. Sem ele, um corpo inválido por
    // outro campo faria a recusa acima parecer prova do dia 29.
    expect(
      esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, diaVencimento: 28 }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Acessórios — a normalização do golden, os controles DEFEITUOSOS e o predicado estático
// ---------------------------------------------------------------------------------------------

/**
 * Junta `entrada.cobrancas` com `retorno.cobrancas` numa lista de cenários comparáveis.
 *
 * A junção é por `id`, e um `id` que não case simplesmente **não entra** — o que faria a lista
 * encolher. É por isso que o CT-504 afirma os três identificadores: é o que transforma uma junção
 * quebrada em reprovação, em vez de em silêncio.
 */
function montarCenarios(lido: Golden): CenarioDeParcelas[] {
  const entradas = new Map(lido.entrada.cobrancas.map(({ id, contrato }) => [id, contrato]));
  const montados: CenarioDeParcelas[] = [];

  for (const { id, resultado } of lido.retorno.cobrancas) {
    const contrato = entradas.get(id);

    // Só o cenário aceito tem parcelas a comparar: afirmar sobre um recusado seria comparar contra
    // um cálculo que o sistema antigo nunca chegou a fazer.
    if (contrato === undefined || !resultado.aceito || resultado.retorno === undefined) {
      continue;
    }

    montados.push({
      id,
      contrato: {
        dataInicioLocacao: contrato.data_inicio_locacao,
        prazoMeses: contrato.prazo_meses,
        diaVencimento: contrato.dia_vencimento,
        valorMensal: contrato.valor_mensal,
      },
      esperadas: resultado.retorno.map((parcela) => ({
        competencia: parcela.competencia,
        dataVencimento: parcela.data_vencimento,
        referencia: parcela.referencia,
        valorOriginal: parcela.valor_original,
      })),
    });
  }

  return montados;
}

/** O cenário pelo nome. Ausência é ERRO: um `id` renomeado no golden não pode virar caso vazio. */
function cenarioDoGolden(id: string): CenarioDeParcelas {
  const achado = cenarios.find((candidato) => candidato.id === id);

  if (achado === undefined) {
    throw new Error(`cenário ausente no golden: ${id}`);
  }

  return achado;
}

/** A parcela reduzida aos quatro campos que o oráculo fixa. */
function comparavel(parcela: ParcelaDerivada): ParcelaComparavel {
  return {
    competencia: parcela.competencia,
    dataVencimento: parcela.dataVencimento,
    referencia: parcela.referencia,
    valorOriginal: parcela.valorOriginal,
  };
}

/** As referências de uma lista de parcelas comparáveis, na ordem. */
function referencias(parcelas: readonly ParcelaComparavel[]): string[] {
  return parcelas.map(({ referencia }) => referencia);
}

/** A última parcela de uma lista. Lista vazia é ERRO — provaria nada. */
function ultima(parcelas: readonly ParcelaDerivada[]): ParcelaDerivada {
  const derradeira = parcelas.at(-1);

  if (derradeira === undefined) {
    throw new Error('a lista de parcelas está vazia');
  }

  return derradeira;
}

/** Em quais períodos as referências do controle divergem das do oráculo — a medida da discriminação. */
function indicesDivergentes(doControle: readonly string[], esperado: CenarioDeParcelas): number[] {
  return referencias(esperado.esperadas)
    .map((referencia, indice) => (doControle[indice] === referencia ? -1 : indice))
    .filter((indice) => indice >= 0);
}

// --- Os controles DEFEITUOSOS ----------------------------------------------------------------
//
// Eles existem para uma coisa só: **medir que os cenários discriminam**. Nenhuma asserção deste
// arquivo afirma que qualquer um deles está certo; todas afirmam que eles DIVERGEM do oráculo, e é
// essa divergência que torna os mutantes detectáveis por esta suíte para sempre, e não apenas na
// rodada em que alguém os aplicou à mão. Eles vivem em `test/`, não saem daqui, e nenhum símbolo de
// produção foi criado ou exportado para que existam (Iron Law #6).

const MESES_POR_ANO = 12;

/**
 * A forma INTUITIVA, e errada: cada período parte da data de início **original**.
 *
 * Ela acerta todo cenário cujo dia de início seja ≤ 28 — e é por isso que os dois cenários iniciados
 * em `2027-01-31` são o discriminador declarado do golden.
 */
function controleNaoIterativo(contrato: ContratoParaParcelas): string[] {
  const original = lerDataDoControle(contrato.dataInicioLocacao);
  const referenciasDoControle: string[] = [];

  for (let indice = 0; indice < contrato.prazoMeses; indice += 1) {
    const inicio = avancarMesesDoControle(original, indice);
    const fim = recuarUmDiaDoControle(avancarMesesDoControle(original, indice + 1));

    referenciasDoControle.push(`${formatarDoControle(inicio)} à ${formatarDoControle(fim)}`);
  }

  return referenciasDoControle;
}

/**
 * A competência construída no RELÓGIO LOCAL — o outro controle defeituoso.
 *
 * `new Date(ano, mes, 1)` interpreta os campos no fuso do processo; lida de volta pelos acessores
 * UTC, a data retrocede em fusos a leste. É a mesma aritmética, com o instante no lugar da cadeia.
 */
function competenciasPeloRelogioLocal(contrato: ContratoParaParcelas): string[] {
  const { ano, mes } = lerDataDoControle(contrato.dataInicioLocacao);
  const competencias: string[] = [];

  for (let indice = 0; indice < contrato.prazoMeses; indice += 1) {
    const instante = new Date(ano, mes - 1 + indice, 1);
    const anoLido = String(instante.getUTCFullYear()).padStart(4, '0');
    const mesLido = String(instante.getUTCMonth() + 1).padStart(2, '0');

    competencias.push(`${anoLido}-${mesLido}-01`);
  }

  return competencias;
}

/**
 * A competência construída com `Date.UTC` — o controle do defeito `D21`.
 *
 * `Date.UTC` remapeia argumento de ano entre 0 e 99 para `1900 + ano`, e `getUTCFullYear` imprime o
 * ano remapeado: o valor errado sai com quatro dígitos e forma impecável.
 */
function competenciaComDateUtc(ano: number, mes: number): string {
  const instante = new Date(Date.UTC(ano, mes - 1, 1));

  return `${String(instante.getUTCFullYear()).padStart(4, '0')}-${String(
    instante.getUTCMonth() + 1,
  ).padStart(2, '0')}-01`;
}

interface DataDoControle {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

function lerDataDoControle(cadeia: string): DataDoControle {
  return {
    ano: Number(cadeia.slice(0, 4)),
    mes: Number(cadeia.slice(5, 7)),
    dia: Number(cadeia.slice(8, 10)),
  };
}

/** O avanço de N meses a partir de uma data, com saturação. O controle NÃO consome a produção. */
function avancarMesesDoControle(data: DataDoControle, meses: number): DataDoControle {
  const absolutos = data.ano * MESES_POR_ANO + (data.mes - 1) + meses;
  const ano = Math.floor(absolutos / MESES_POR_ANO);
  const mes = absolutos - ano * MESES_POR_ANO + 1;

  return { ano, mes, dia: Math.min(data.dia, ultimoDiaDoMesDoControle(ano, mes)) };
}

function recuarUmDiaDoControle(data: DataDoControle): DataDoControle {
  if (data.dia > 1) {
    return { ...data, dia: data.dia - 1 };
  }

  const ano = data.mes === 1 ? data.ano - 1 : data.ano;
  const mes = data.mes === 1 ? MESES_POR_ANO : data.mes - 1;

  return { ano, mes, dia: ultimoDiaDoMesDoControle(ano, mes) };
}

/** O comprimento do mês, no controle. Duplicado de propósito: o controle não consome a produção. */
function ultimoDiaDoMesDoControle(ano: number, mes: number): number {
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

  if (mes === 2) {
    return bissexto ? 29 : 28;
  }

  return new Set([4, 6, 9, 11]).has(mes) ? 30 : 31;
}

function formatarDoControle({ ano, mes, dia }: DataDoControle): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(ano).padStart(
    4,
    '0',
  )}`;
}

// --- O predicado da asserção ESTÁTICA --------------------------------------------------------

/** `Date.UTC(` — a construção que remapeia o século (defeito `D21`). */
const CHAMADA_DE_DATE_UTC = /Date\s*\.\s*UTC\s*\(/;

/**
 * `new Date(` com **três ou mais** argumentos — a construção que lê o fuso do processo.
 *
 * A detecção é por número de argumentos, e não por eles serem literais numéricos, e a escolha é
 * deliberada: o defeito real escreve `new Date(ano, mes - 1, dia)` com **variáveis**, e um predicado
 * que exigisse dígitos ficaria cego justamente nele. Três argumentos é sempre a forma
 * `(ano, mês, dia)` — o construtor de `Date` aceita 1, 2 ou 7, e nenhuma sobrecarga legítima de dois
 * argumentos existe no domínio deste pacote.
 */
const CONSTRUCAO_LOCAL_DE_DATE = /new\s+Date\s*\([^)]*,[^)]*,[^)]*\)/;

/** O predicado que a varredura aplica linha a linha, já sem comentários. */
function casaConstrucaoProibida(linha: string): boolean {
  return CHAMADA_DE_DATE_UTC.test(linha) || CONSTRUCAO_LOCAL_DE_DATE.test(linha);
}
