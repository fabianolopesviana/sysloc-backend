/**
 * As duas derivações puras da ativação, contra o oráculo — CT-401, CT-402 e CT-432.
 * T4 da fatia `contratos-de-locacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-20    | CT-401 | Para os **23** pares `(dataInicio, prazoMeses)` que o golden capturado fixa
 * | CA-08    |        | — 18 do bloco `derivacao`, 3 das validações aceitas e 2 dos fluxos que
 * |          |        | ativaram —, `derivarTerminoDaLocacao` devolve a **mesma cadeia** que o
 * |          |        | sistema antigo, sem divergência de um dia sequer. O exemplo que o aceite
 * |          |        | nomeia, `2026-01-31 + 1 mês = 2026-02-27`, é afirmado isoladamente. E os
 * |          |        | cenários DISCRIMINAM: um controle sem a saturação diverge em **13** deles,
 * |          |        | nomeados um a um, e um controle sem o `-1 dia` diverge nos **23**. |
 * | CA-20    | CT-402 | Para os mesmos 23 pares, `derivarValorTotal` reproduz o valor total do
 * |          |        | golden por **igualdade exata** de número. **Nenhum** dos 23 discrimina a
 * |          |        | aritmética — a multiplicação ingênua acerta os 23, e isso é MEDIDO —, de
 * |          |        | modo que a prova da exatidão vem de três pares achados por busca:
 * |          |        | `500.03 × 13` e `500.10 × 6`, cujo produto direto carrega resíduo binário,
 * |          |        | e `512.05 × 6`, em que `512.05 × 100` vale `51204.99999999999` e truncar
 * |          |        | devolveria `3072.24` no lugar de `3072.30`. |
 * | CA-20    | CT-432 | `derivarTerminoDaLocacao('2027-01-31', 1)` devolve `'2027-02-27'` sob
 * |          |        | `TZ=UTC`, `TZ=America/Sao_Paulo` e `TZ=Pacific/Kiritimati` (UTC+14) — a
 * |          |        | mesma cadeia nos três. E a fixação do fuso é ela mesma afirmada (pelos
 * |          |        | deslocamentos `0`, `180` e `-840`), sem o que o caso ficaria verde sem ter
 * |          |        | trocado de fuso. O controle que constrói o instante no **relógio local**
 * |          |        | devolve `'2027-02-26'` no terceiro fuso: é ele que mede a discriminação. |
 *
 * | —        | RG-D21-01 | `derivarTerminoDaLocacao` devolve o ano de destino **literal** quando
 * |          |        | ele cai entre 1 e 99, em vez do `1900 + ano` que `Date.UTC` produzia: o
 * |          |        | caso do débito (`0050-03-15` + 12 → `0051-03-14`), as duas pontas da
 * |          |        | faixa, e o par de fronteira que só o AVANÇO separa — `0099-12-01`, dentro
 * |          |        | dela, contra `0099-12-31`, cujo destino transborda para `0100`. Um
 * |          |        | controle positivo na faixa moderna impede que a correção do século
 * |          |        | quebre o resto. |
 *
 * Rastreabilidade: `CA-20 → CT-401 (RN-10)`, `CA-08 → CT-401 (RN-08)`, `CA-20 → CT-402 (RN-10)`,
 * `CA-20 → CT-432 (RN-10)`. O `RG-D21-01` **não tem critério de aceitação**: ele nasce da resolução
 * do débito D21, e não da §6 de uma task — ver o docblock do bloco.
 *
 * ===========================================================================
 * O GOLDEN É LIDO DO ARQUIVO VERSIONADO, NUNCA REDIGITADO
 * ===========================================================================
 *
 * Ele é o **oráculo** — o registro capturado do sistema antigo, em
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-ativacao.json`, produzido
 * pela T1 e aprovado nos dois gates. Redigitá-lo aqui faria a asserção concordar com quem a
 * escreveu, e o valor de equivalência com o legado desapareceria em silêncio no primeiro erro de
 * transcrição. **Se a implementação divergir dele, o errado é a implementação.**
 *
 * A contagem de cenários é ela mesma afirmada, e **por bloco de origem**: sem isso, um golden
 * truncado, um `id` que deixasse de casar entre `entrada` e `retorno`, ou um laço que parasse cedo
 * deixariam o caso verde tendo provado um punhado de cenários.
 *
 * ---------------------------------------------------------------------------
 * OS TRÊS BLOCOS DO GOLDEN QUE CARREGAM DERIVAÇÃO, e por que os três entram
 * ---------------------------------------------------------------------------
 *
 * 1. **`derivacao`** (18) — o bloco desenhado para isto, com a bateria de virada de mês;
 * 2. **`validacao`**, só os `aceito: true` (3) — são as entradas que **satisfazem** as seis
 *    condições portadas e, por isso, produzem derivação. É a metade positiva do CA-08, que este
 *    arquivo alcança: a recusa (a metade negativa) é da T7, pela rota;
 * 3. **`estado_resultante.fluxo`**, só os que ficaram `Ativo` (2) — a derivação como ela foi
 *    **persistida** pelo sistema antigo ao ativar de verdade. O terceiro fluxo foi recusado, ficou
 *    `Rascunho` e tem `data_fim_locacao: null`: não há derivação a comparar, e incluí-lo seria
 *    afirmar sobre um cálculo que nunca aconteceu.
 *
 * ---------------------------------------------------------------------------
 * DIVERGÊNCIA DECLARADA DA §6.6 — o par sugerido no card NÃO discrimina
 * ---------------------------------------------------------------------------
 *
 * O card do CT-402 sugere `1350.50 × 12 → 16206.00` como o "par de resíduo binário achado por
 * busca". Ele foi **medido, e é exato**: `1350.5 * 12` vale exatamente `16206` em ponto flutuante,
 * e um caso construído sobre ele não mataria mutante nenhum — exatamente o que aconteceu com
 * `0.29 + 0.07` no `CT-305 (b)` da fatia anterior, cuja lição está registrada lá. O card manda
 * "achado por busca", e a busca é que decide: os três pares usados aqui saíram dela, e a medição de
 * cada um está asserida **antes** da asserção que ele sustenta. O par do card também está medido
 * abaixo, para que a razão de não usá-lo fique no código e não só nesta nota.
 *
 * ===========================================================================
 * NADA AQUI TOCA BANCO, RELÓGIO OU REQUISIÇÃO
 * ===========================================================================
 *
 * As duas funções são puras, e a suíte prova isso por construção: **não há instância efêmera, não há
 * `contextoDeTenant`, não há unidade de trabalho e não há mock** (a §6.0 do card manda "mocks:
 * nenhum"). O único acesso ao mundo é a leitura do arquivo golden, que é dado de entrada.
 *
 * O `CT-432` escreve `process.env.TZ`, que é **mecanismo nativo do Node** e estado do processo, não
 * um ponto de injeção de produção: nenhum símbolo foi acrescentado a `packages/db/src/**` para que
 * estas provas existam (Iron Law #6). O valor original é restaurado no `afterAll`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os quatro da §6.4 reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar
 * que a prova **reprova** com o defeito reintroduzido. Os quatro mutantes abaixo foram aplicados ao
 * fonte de produção (`src/derivacao-de-contrato.ts`) e a suíte foi invocada pelo **script do
 * pacote** (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — os pacotes resolvem
 * `"."` para `dist/`, e o modo de falha é silencioso e **inverte a conclusão**.
 *
 *   * **controle** — árvore íntegra: `12 arquivos, 76 casos, 0 falhas`;
 *   * **MT4-1 · o ajuste de `-1 dia` removido** (a subtração de `MILISSEGUNDOS_POR_DIA` sai da linha
 *     de retorno, com a constante removida junto — que é o que o compilador obriga):
 *     `2 failed | 74 passed`. O **CT-401** reprova no primeiro cenário do golden
 *     (`controle_dia_seguro_doze_meses: expected '2028-01-15' to be '2028-01-14'`) e o **CT-432**
 *     reprova em bloco (`['2027-02-28', …]`);
 *   * **MT4-2 · a saturação de fim de mês removida** (`Math.min(dia, ultimoDiaDoMes(…))` virando
 *     `dia`, com `ultimoDiaDoMes`, `ehBissexto` e as constantes de calendário removidos junto — que
 *     é o que o compilador obriga e o que a "simplificação" faria): `2 failed | 74 passed`. O
 *     **CT-401** reprova no primeiro cenário de virada
 *     (`dia_vinte_e_nove_para_fevereiro_nao_bissexto: expected '2027-02-28' to be '2027-02-27'`),
 *     que é um dos 13 de {@link CENARIOS_QUE_A_SATURACAO_DECIDE}, e o **CT-432** também
 *     (`['2027-03-02', …]` — sem saturação o dia 29 transborda para março);
 *   * **MT4-3 · a multiplicação volta a ser direta em ponto flutuante** (`valorMensal * prazoMeses`,
 *     com `CENTAVOS_POR_UNIDADE` removido junto): `1 failed | 75 passed`, **só** no terceiro caso do
 *     **CT-402** — `500.03: expected 6500.389999999999 to be 6500.39`. Os 23 cenários do golden
 *     ficam **verdes**, tal como o caso da medição afirma que ficariam, e é exatamente essa cegueira
 *     que os três pares achados por busca existem para fechar;
 *   * **MT4-4 · a aritmética passa pelo relógio local** (`Date.UTC(…)` virando
 *     `new Date(…).getTime()`): `1 failed | 75 passed`, **só** no **CT-432** — o terceiro elemento
 *     vira `'2027-02-26'`. O **CT-401 sobrevive**, e a razão é medida: esta máquina roda em `UTC-3`,
 *     fuso em que o defeito não desloca a data. É por isso que `Pacific/Kiritimati` está na lista —
 *     sem o terceiro fuso, o mutante atravessaria a suíte inteira;
 *   * **os dois casos de MEDIÇÃO seguem verdes sob todos os mutantes, e isso é por desenho**: o
 *     segundo caso do CT-401 e o segundo do CT-402 comparam os **controles defeituosos** contra o
 *     **oráculo**, não contra a produção. Eles não existem para pegar o mutante — existem para
 *     provar que os cenários do golden o pegariam, que é a afirmação de que os outros casos
 *     dependem;
 *   * **reversão** — `src/derivacao-de-contrato.ts` foi restaurado e conferido idêntico ao original
 *     por `diff -q` após cada mutante, com `pnpm build` refeito, e o controle voltou a `76 passed`.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { derivarTerminoDaLocacao, derivarValorTotal } from '../src/derivacao-de-contrato.ts';

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

/** Quantos cenários com derivação o golden traz, por bloco — a âncora contra arquivo truncado. */
const CENARIOS_POR_ORIGEM = { derivacao: 18, validacao: 3, fluxo: 2 } as const;

/** O total dos três blocos, escrito uma vez. */
const TOTAL_DE_CENARIOS =
  CENARIOS_POR_ORIGEM.derivacao + CENARIOS_POR_ORIGEM.validacao + CENARIOS_POR_ORIGEM.fluxo;

/** O rótulo do estado ativo, como o sistema antigo o gravava — o filtro do bloco `fluxo`. */
const CONTRATO_ATIVO = 'Ativo';

/** Os campos de contrato que os três blocos do golden têm em comum. */
interface ContratoDoGolden {
  readonly data_inicio_locacao: string;
  readonly prazo_meses: number;
  readonly valor_mensal: number;
}

/** O que o sistema antigo devolveu para um cenário aceito. */
interface RetornoDaDerivacao {
  readonly data_fim_locacao: string;
  readonly valor_total_contrato: number;
}

interface EntradaDoGolden {
  readonly id: string;
  readonly contrato: ContratoDoGolden;
}

interface ResultadoDoGolden {
  readonly id: string;
  readonly resultado: {
    readonly aceito: boolean;
    readonly retorno?: RetornoDaDerivacao;
  };
}

/** O contrato como o sistema antigo o **persistiu** após a ativação. */
interface ContratoPersistidoDoGolden extends ContratoDoGolden {
  readonly data_fim_locacao: string | null;
  readonly status_contrato: string;
  readonly valor_total_contrato: number;
}

interface Golden {
  readonly entrada: {
    readonly derivacao: readonly EntradaDoGolden[];
    readonly validacao: readonly EntradaDoGolden[];
  };
  readonly estado_resultante: {
    readonly fluxo: readonly {
      readonly id: string;
      readonly contrato: ContratoPersistidoDoGolden;
    }[];
  };
  readonly retorno: {
    readonly derivacao: readonly ResultadoDoGolden[];
    readonly validacao: readonly ResultadoDoGolden[];
  };
}

/** De qual bloco do golden o cenário veio — é o que a âncora de contagem separa. */
type OrigemDoCenario = keyof typeof CENARIOS_POR_ORIGEM;

/** Um cenário na forma que os casos comparam: as entradas e as duas saídas que o oráculo fixa. */
interface CenarioDeDerivacao {
  readonly origem: OrigemDoCenario;
  readonly id: string;
  readonly dataInicio: string;
  readonly prazoMeses: number;
  readonly valorMensal: number;
  readonly dataFimEsperada: string;
  readonly valorTotalEsperado: number;
}

let cenarios: readonly CenarioDeDerivacao[];

// ---------------------------------------------------------------------------
// O exemplo que o aceite nomeia, e os pares medidos da aritmética
// ---------------------------------------------------------------------------

/**
 * O exemplo verificável da §3 da task e da §6.2 da tech spec, afirmado **isoladamente**.
 *
 * Ele não vem do golden — vem da especificação, que o declara como o caso que torna a saturação
 * legível: fevereiro de 2026 não tem 31 dias, o avanço satura em `2026-02-28` e o `-1 dia` leva a
 * `2026-02-27`. Estando fora dos 23 cenários, ele continua reprovando ainda que o golden mudasse.
 */
const EXEMPLO_DA_SATURACAO = {
  dataInicio: '2026-01-31',
  prazoMeses: 1,
  fim: '2026-02-27',
} as const;

/**
 * Os 13 cenários do golden cuja data de fim a **saturação** decide — nomeados, e não contados.
 *
 * A lista foi MEDIDA: é o conjunto de identificadores em que o controle sem saturação diverge do
 * oráculo. Nomeá-los, em vez de afirmar só a quantidade, é o que faz o caso reprovar quando a
 * saturação deixar de agir num cenário específico — uma queda de 13 para 12 diria que algo mudou,
 * mas não o quê.
 */
const CENARIOS_QUE_A_SATURACAO_DECIDE: readonly string[] = [
  'dia_trinta_e_um_para_fevereiro_bissexto',
  'dia_trinta_e_um_para_fevereiro_nao_bissexto',
  'dia_trinta_e_um_seis_meses_para_fevereiro_bissexto',
  'dia_trinta_e_um_seis_meses_para_fevereiro_nao_bissexto',
  'dia_trinta_e_um_tres_meses_para_mes_de_trinta_dias',
  'dia_trinta_e_um_treze_meses_para_fevereiro_bissexto',
  'dia_trinta_e_um_um_mes_para_mes_de_trinta_dias',
  'dia_trinta_para_fevereiro_bissexto',
  'dia_trinta_para_fevereiro_nao_bissexto',
  'dia_vinte_e_nove_para_fevereiro_nao_bissexto',
  'imovel_com_o_mesmo_contrato',
  'imovel_livre',
  'vinte_e_nove_de_fevereiro_bissexto_mais_doze_meses',
];

/**
 * Os três pares achados por busca, com o produto direto e o valor exato — **medidos, não supostos**.
 *
 * Os dois primeiros discriminam a multiplicação: o produto em ponto flutuante carrega resíduo. O
 * terceiro discrimina o `Math.round`: `512.05 × 100` vale `51204.99999999999`, e truncar em vez de
 * arredondar devolveria `3072.24` — seis centavos a menos — no lugar de `3072.30`.
 */
const PARES_DE_RESIDUO = [
  { valorMensal: 500.03, prazoMeses: 13, total: 6500.39 },
  { valorMensal: 500.1, prazoMeses: 6, total: 3000.6 },
  { valorMensal: 512.05, prazoMeses: 6, total: 3072.3 },
] as const;

/** Os três fusos do CT-432, com o deslocamento que cada um impõe em fevereiro de 2027. */
const FUSOS_DO_CASO = [
  { tz: 'UTC', deslocamento: 0 },
  { tz: 'America/Sao_Paulo', deslocamento: 180 },
  { tz: 'Pacific/Kiritimati', deslocamento: -840 },
] as const;

/** O cenário de virada avaliado sob os três fusos — o mesmo `31/01` que o CT-401 exercita. */
const CENARIO_DO_FUSO = { dataInicio: '2027-01-31', prazoMeses: 1, fim: '2027-02-27' } as const;

/** O que o controle pelo relógio local devolve em cada fuso — medido, e é a prova da discriminação. */
const TERMINO_PELO_RELOGIO_LOCAL: readonly string[] = ['2027-02-27', '2027-02-27', '2027-02-26'];

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

beforeAll(async () => {
  cenarios = montarCenarios(JSON.parse(await readFile(CAMINHO_DO_GOLDEN, 'utf8')) as Golden);
});

// ===========================================================================
// CT-401 — o término da locação reproduz o oráculo, inclusive na virada de mês
// ===========================================================================

describe('CT-401 — a data de fim reproduz o golden nos 23 cenários, com a saturação de fim de mês', () => {
  it('devolve a cadeia do oráculo em todos eles, e o exemplo 2026-01-31 + 1 mês dá 2026-02-27', () => {
    // --- As âncoras, ANTES de qualquer asserção sobre valores ---------------------------------
    //
    // Sem elas, um golden truncado — ou um `id` que deixasse de casar entre `entrada` e `retorno` —
    // deixaria o caso verde tendo provado meia dúzia de cenários. A contagem é por BLOCO: um erro
    // de junção que perdesse os três da `validacao` manteria o total plausível se fosse só um número.
    expect(contarPorOrigem(cenarios)).toEqual(CENARIOS_POR_ORIGEM);
    expect(cenarios).toHaveLength(TOTAL_DE_CENARIOS);

    let exercitados = 0;

    for (const cenario of cenarios) {
      // Igualdade de cadeia, com o identificador do cenário como rótulo: a divergência de um dia
      // sequer reprova NOMEANDO qual cenário do legado deixou de ser reproduzido.
      expect(derivarTerminoDaLocacao(cenario.dataInicio, cenario.prazoMeses), cenario.id).toBe(
        cenario.dataFimEsperada,
      );

      exercitados += 1;
    }

    // A segunda metade da âncora: o laço percorreu os 23, e não saiu na primeira volta.
    expect(exercitados).toBe(TOTAL_DE_CENARIOS);

    // --- O exemplo que o aceite nomeia, isolado ------------------------------------------------
    //
    // Ele vive fora do golden de propósito (ver {@link EXEMPLO_DA_SATURACAO}): é a especificação
    // dizendo o que a saturação faz, e continua reprovando ainda que o oráculo mudasse.
    expect(
      derivarTerminoDaLocacao(EXEMPLO_DA_SATURACAO.dataInicio, EXEMPLO_DA_SATURACAO.prazoMeses),
    ).toBe(EXEMPLO_DA_SATURACAO.fim);
  });

  it('os cenários DISCRIMINAM: sem saturação 13 divergem, e sem o -1 dia divergem os 23', () => {
    // Este é o controle NEGATIVO, e ele é o que prova que o caso acima não está verde por acaso.
    // Os dois controles são implementações DEFEITUOSAS de propósito — nenhuma asserção deste
    // arquivo afirma que qualquer uma delas está certa; o que se afirma é que elas DIVERGEM do
    // oráculo, que é o que torna os dois mutantes da §6.4 detectáveis para sempre.

    // --- Sem a saturação: divergem exatamente os 13 cenários de virada, nomeados ---------------
    expect(divergentes(cenarios, { semSaturacao: true })).toEqual([
      ...CENARIOS_QUE_A_SATURACAO_DECIDE,
    ]);

    // --- Sem o ajuste de um dia: divergem TODOS ------------------------------------------------
    //
    // O `-1 dia` é terminal e desloca toda data de fim; a divergência universal é a forma de dizer
    // que nenhum cenário do golden é cego a esse defeito.
    expect(divergentes(cenarios, { semAjusteDeUmDia: true })).toHaveLength(TOTAL_DE_CENARIOS);

    // E a consequência concreta no exemplo do aceite: sem o ajuste, `2026-01-31 + 1 mês` pararia em
    // `2026-02-28` — a saturação sozinha não basta, que é o item 1 da §6.4.
    expect(
      controleDefeituoso(EXEMPLO_DA_SATURACAO.dataInicio, EXEMPLO_DA_SATURACAO.prazoMeses, {
        semAjusteDeUmDia: true,
      }),
    ).toBe('2026-02-28');
  });
});

// ===========================================================================
// CT-402 — o valor total multiplica em centavos inteiros, sem resíduo binário
// ===========================================================================

describe('CT-402 — o valor total reproduz o golden e é exato onde o produto direto não é', () => {
  it('bate com o oráculo nos 23 cenários por igualdade exata de número', () => {
    expect(contarPorOrigem(cenarios)).toEqual(CENARIOS_POR_ORIGEM);

    let exercitados = 0;

    for (const cenario of cenarios) {
      // Valor exato, e não aproximação: `toBeCloseTo` deixaria passar exatamente o resíduo que o
      // desenho existe para eliminar, e é ele que viajaria no JSON como `valorTotalContrato`.
      expect(derivarValorTotal(cenario.valorMensal, cenario.prazoMeses), cenario.id).toBe(
        cenario.valorTotalEsperado,
      );

      exercitados += 1;
    }

    expect(exercitados).toBe(TOTAL_DE_CENARIOS);
  });

  it('nenhum cenário do golden discrimina a aritmética — a medição é asserida, não suposta', () => {
    // A afirmação do cabeçalho, posta sob prova: para os 23 pares do oráculo, a multiplicação
    // INGÊNUA acerta. É o mesmo achado do `CT-305 (b)` da fatia anterior, e é o que obriga os pares
    // achados por busca a existirem — sem esta linha, alguém leria os 23 cenários verdes como prova
    // da exatidão, que é precisamente o que eles NÃO são.
    expect(divergentesNoValor(cenarios)).toEqual([]);

    // E o par sugerido pelo card da §6.6 também não discrimina — medido, e é a razão de não usá-lo.
    expect(1350.5 * 12).toBe(16206);
  });

  it('os três pares achados por busca são exatos onde o produto direto e o truncamento erram', () => {
    // --- O controle NEGATIVO, e ele vem PRIMEIRO ----------------------------------------------
    //
    // É esta metade que prova que os pares DISCRIMINAM. Sem ela, o caso poderia estar construído
    // sobre valores que a multiplicação ingênua acerta — que é o que acontece com os 23 do golden.
    expect(500.03 * 13).not.toBe(6500.39);
    expect(500.1 * 6).not.toBe(3000.6);

    // O terceiro par ataca o outro lado, o do `Math.round`: o número que chega já veio de um
    // `numeric(15,2)` convertido, e multiplicá-lo por cem cai ABAIXO do inteiro. Truncar devolveria
    // seis centavos a menos.
    expect(512.05 * 100).not.toBe(51_205);
    expect((Math.trunc(512.05 * 100) * 6) / 100).not.toBe(3072.3);

    // --- E a derivação acerta os três ---------------------------------------------------------
    let exercitados = 0;

    for (const par of PARES_DE_RESIDUO) {
      expect(derivarValorTotal(par.valorMensal, par.prazoMeses), String(par.valorMensal)).toBe(
        par.total,
      );

      exercitados += 1;
    }

    expect(exercitados).toBe(PARES_DE_RESIDUO.length);
  });
});

// ===========================================================================
// CT-432 — a derivação não desloca com o fuso do processo
// ===========================================================================

describe('CT-432 — a data de fim é a mesma cadeia em qualquer TZ do processo', () => {
  const FUSO_ORIGINAL = process.env.TZ;

  afterAll(() => {
    // O fuso é estado do PROCESSO: deixá-lo trocado vazaria para qualquer caso que rodasse depois.
    if (FUSO_ORIGINAL === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = FUSO_ORIGINAL;
    }
  });

  it('devolve 2027-02-27 sob UTC, America/Sao_Paulo e Pacific/Kiritimati, e o controle local não', () => {
    const pelaDerivacao: string[] = [];
    const peloRelogioLocal: string[] = [];

    for (const fuso of FUSOS_DO_CASO) {
      process.env.TZ = fuso.tz;

      // A ÂNCORA da precondição, e ela não é ornamento: escrever `process.env.TZ` depois de o
      // processo já ter resolvido o fuso pode não surtir efeito, e o caso ficaria verde tendo
      // avaliado três vezes o MESMO fuso — provando nada. O deslocamento é lido de um instante
      // construído no relógio local, que é justamente o que a troca precisa afetar.
      expect(new Date(2027, 1, 28).getTimezoneOffset(), fuso.tz).toBe(fuso.deslocamento);

      pelaDerivacao.push(
        derivarTerminoDaLocacao(CENARIO_DO_FUSO.dataInicio, CENARIO_DO_FUSO.prazoMeses),
      );
      peloRelogioLocal.push(
        controleDefeituoso(CENARIO_DO_FUSO.dataInicio, CENARIO_DO_FUSO.prazoMeses, {
          peloRelogioLocal: true,
        }),
      );
    }

    // A mesma cadeia nos três, e o valor EXATO — não só "iguais entre si": três resultados
    // igualmente errados também seriam iguais entre si.
    expect(pelaDerivacao).toEqual([CENARIO_DO_FUSO.fim, CENARIO_DO_FUSO.fim, CENARIO_DO_FUSO.fim]);

    // --- O controle NEGATIVO ------------------------------------------------------------------
    //
    // A MESMA aritmética, construindo o instante no relógio local em vez de `Date.UTC`, devolve
    // outra data no fuso de UTC+14 — um dia inteiro a menos. É a medição que dá conteúdo ao caso:
    // sem ela, "a cadeia é igual nos três" ficaria verde sobre uma implementação que também fosse
    // imune por acidente, e o mutante da §6.4 sobreviveria.
    expect(peloRelogioLocal).toEqual([...TERMINO_PELO_RELOGIO_LOCAL]);
    expect(peloRelogioLocal).not.toEqual(pelaDerivacao);
  });
});

// ===========================================================================
// RG-D21-01 — o ano de destino de um a noventa e nove não é remapeado para 1900+
// ===========================================================================

/**
 * Rede da correção do débito **D21** (F2/T4, Tech Review).
 *
 * ===========================================================================
 * Por que o identificador NÃO é um `CT-4xx`
 * ===========================================================================
 *
 * Mesma razão, e mesma forma, do `RG-T3-01` de `coerencia-de-migracoes.spec.ts`: os casos planejados
 * desta fatia ocupam `CT-401`–`CT-434` e estão distribuídos em `_run/test-cases.json`. Este não está
 * na §6 de task nenhuma — nasceu da **resolução de um débito**, fora do pipeline —, e dar-lhe um
 * número daquela faixa o faria passar por planejado. A âncora depois do prefixo é o **débito**, e
 * não a task, porque é o débito que o identifica: `RG-D21-01` lê-se *rede do D21, primeira*.
 *
 * ===========================================================================
 * O que ele prova, e por que fora do golden
 * ===========================================================================
 *
 * `Date.UTC` herda do construtor de `Date` a regra que remapeia argumento de ano entre 0 e 99 para
 * `1900 + ano`. Como `formatarEmUtc` imprime o ano resultante com quatro dígitos, o valor errado
 * saía com a **forma certa** — `derivarTerminoDaLocacao('0050-03-15', 12)` devolvia `'1951-03-14'`,
 * errado em mil e novecentos anos, sem nada na cadeia denunciando.
 *
 * O oráculo **não tem** cenário nessa faixa e não vai ganhar um: o golden reproduz o sistema antigo,
 * que nunca operou nela. Por isso as asserções abaixo são literais, escritas contra a aritmética do
 * calendário gregoriano proléptico, e não contra o golden nem contra o controle deste arquivo —
 * {@link controleDefeituoso} constrói com `Date.UTC` e portanto **carrega o mesmo defeito**;
 * compará-los aqui devolveria dois erros idênticos e um caso verde. Não o corrija por isto: na faixa
 * que ele serve (a moderna, dos defeitos injetados) ele está certo, e mexer nele sem necessidade é
 * superfície de regressão de graça.
 *
 * ===========================================================================
 * A faixa é do ano de DESTINO, não do de início
 * ===========================================================================
 *
 * Detalhe medido, e é o que faz a fronteira do caso: o remapeamento incide sobre o argumento que
 * chega a `Date.UTC`, que é o ano **depois** do avanço de `prazoMeses`. Um contrato iniciado em
 * `0099-12-31` com prazo 1 tem destino em `0100`, fora da faixa, e **sempre** esteve correto — ao
 * passo que `0001-01-01` com prazo 1 permanece em `0001` e estava errado. Por isso o par de
 * fronteira abaixo é `0099-12-01` (dentro, errado antes) contra `0099-12-31` (destino em `0100`,
 * correto antes): eles diferem **só** no dia de início, e é o avanço que os separa.
 */
describe('RG-D21-01 — o ano de destino entre 1 e 99 não sofre o remapeamento de `Date.UTC`', () => {
  it('devolve o ano literal na faixa baixa, e não `1900 + ano`', () => {
    // --- O caso que o débito mede, nomeado ------------------------------------------------------
    //
    // Antes da correção: `'1951-03-14'`. O `-1 dia` do passo 3 é o que leva 15 de março a 14.
    expect(derivarTerminoDaLocacao('0050-03-15', 12)).toBe('0051-03-14');

    // --- As duas pontas da faixa ----------------------------------------------------------------
    //
    // Ano 1 e ano 99 de destino: os extremos do intervalo que o remapeamento alcançava. Antes:
    // `'1901-01-31'` e `'1999-12-31'`.
    expect(derivarTerminoDaLocacao('0001-01-01', 1)).toBe('0001-01-31');
    expect(derivarTerminoDaLocacao('0099-01-01', 12)).toBe('0099-12-31');

    // --- A fronteira, pelo par que só o AVANÇO separa -------------------------------------------
    //
    // Os dois começam em dezembro de 99 e têm prazo 1; o segundo só difere no dia. O primeiro
    // termina dentro da faixa (destino `0099`) e reprovava; o segundo transborda para `0100` e
    // sempre passou. Asserir os dois juntos é o que impede uma "correção" que desloque a fronteira.
    expect(derivarTerminoDaLocacao('0099-12-01', 1)).toBe('0099-12-31');
    expect(derivarTerminoDaLocacao('0099-12-31', 1)).toBe('0100-01-30');

    // --- O controle POSITIVO --------------------------------------------------------------------
    //
    // A faixa moderna, inalterada pela correção: sem esta linha o caso ficaria verde sobre uma
    // implementação que consertasse o século e quebrasse todo o resto. É o mesmo cenário que o
    // aceite da T4 nomeia, e ele também vive no `CT-401`.
    expect(derivarTerminoDaLocacao('2026-01-31', 1)).toBe('2026-02-27');
  });
});

// ---------------------------------------------------------------------------------------------
// Acessórios — a normalização do golden e os controles DEFEITUOSOS
// ---------------------------------------------------------------------------------------------

/**
 * Junta os três blocos do golden numa lista única de cenários com derivação.
 *
 * A junção entre `entrada` e `retorno` é por `id`, e um `id` que não case simplesmente **não entra**
 * — o que faria a lista encolher. É por isso que a contagem por origem é asserida nos casos: ela é
 * o que transforma uma junção quebrada em reprovação, em vez de em silêncio.
 */
function montarCenarios(golden: Golden): CenarioDeDerivacao[] {
  const montados: CenarioDeDerivacao[] = [];

  for (const origem of ['derivacao', 'validacao'] as const) {
    const entradas = new Map(golden.entrada[origem].map(({ id, contrato }) => [id, contrato]));

    for (const { id, resultado } of golden.retorno[origem]) {
      const contrato = entradas.get(id);

      // Só os aceitos derivam: o recusado não tem `retorno`, e afirmá-lo seria comparar contra um
      // cálculo que o sistema antigo nunca chegou a fazer.
      if (contrato === undefined || !resultado.aceito || resultado.retorno === undefined) {
        continue;
      }

      montados.push({
        origem,
        id,
        dataInicio: contrato.data_inicio_locacao,
        prazoMeses: contrato.prazo_meses,
        valorMensal: contrato.valor_mensal,
        dataFimEsperada: resultado.retorno.data_fim_locacao,
        valorTotalEsperado: resultado.retorno.valor_total_contrato,
      });
    }
  }

  for (const { id, contrato } of golden.estado_resultante.fluxo) {
    // A derivação como o sistema antigo a PERSISTIU. O fluxo recusado ficou `Rascunho`, com
    // `data_fim_locacao: null` — não há o que comparar.
    if (contrato.status_contrato !== CONTRATO_ATIVO || contrato.data_fim_locacao === null) {
      continue;
    }

    montados.push({
      origem: 'fluxo',
      id,
      dataInicio: contrato.data_inicio_locacao,
      prazoMeses: contrato.prazo_meses,
      valorMensal: contrato.valor_mensal,
      dataFimEsperada: contrato.data_fim_locacao,
      valorTotalEsperado: contrato.valor_total_contrato,
    });
  }

  return montados;
}

/** Quantos cenários vieram de cada bloco — a âncora contra junção quebrada e golden truncado. */
function contarPorOrigem(lista: readonly CenarioDeDerivacao[]): Record<OrigemDoCenario, number> {
  const contagem: Record<OrigemDoCenario, number> = { derivacao: 0, validacao: 0, fluxo: 0 };

  for (const cenario of lista) {
    contagem[cenario.origem] += 1;
  }

  return contagem;
}

/** Os cenários em que o controle defeituoso diverge do oráculo, em ordem — medida, não suposição. */
function divergentes(
  lista: readonly CenarioDeDerivacao[],
  defeitos: DefeitosDoControle,
): readonly string[] {
  return lista
    .filter(
      (cenario) =>
        controleDefeituoso(cenario.dataInicio, cenario.prazoMeses, defeitos) !==
        cenario.dataFimEsperada,
    )
    .map((cenario) => cenario.id)
    .sort();
}

/** Os cenários em que a multiplicação INGÊNUA diverge do oráculo — hoje, medidamente, nenhum. */
function divergentesNoValor(lista: readonly CenarioDeDerivacao[]): readonly string[] {
  return lista
    .filter((cenario) => cenario.valorMensal * cenario.prazoMeses !== cenario.valorTotalEsperado)
    .map((cenario) => cenario.id)
    .sort();
}

/** Quais defeitos o controle reintroduz — cada um é um dos mutantes da §6.4. */
interface DefeitosDoControle {
  /** Não satura o dia no último dia do mês de destino (item 2 da §6.4). */
  readonly semSaturacao?: boolean;
  /** Não subtrai o dia final (item 1 da §6.4). */
  readonly semAjusteDeUmDia?: boolean;
  /** Constrói o instante no relógio local em vez de `Date.UTC` (item 4 da §6.4). */
  readonly peloRelogioLocal?: boolean;
}

const MESES_POR_ANO = 12;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * A MESMA aritmética da produção, com o defeito pedido reintroduzido — o controle **negativo**.
 *
 * Ele existe para uma coisa só: **medir que os cenários discriminam**. Nenhuma asserção deste
 * arquivo afirma que ele está certo; todas afirmam que ele DIVERGE do oráculo, e é essa divergência
 * que torna os mutantes da §6.4 detectáveis por esta suíte para sempre, e não apenas na rodada em
 * que alguém os aplicou à mão.
 *
 * Ele **não** é um segundo lugar onde a derivação mora: vive em `test/`, não sai daqui, e nenhum
 * símbolo de produção foi criado ou exportado para que ele exista (Iron Law #6).
 */
function controleDefeituoso(
  dataInicio: string,
  prazoMeses: number,
  defeitos: DefeitosDoControle,
): string {
  const ano = Number(dataInicio.slice(0, 4));
  const mes = Number(dataInicio.slice(5, 7));
  const dia = Number(dataInicio.slice(8, 10));

  const mesesAbsolutos = ano * MESES_POR_ANO + (mes - 1) + prazoMeses;
  const anoDeDestino = Math.floor(mesesAbsolutos / MESES_POR_ANO);
  const mesDeDestino = mesesAbsolutos - anoDeDestino * MESES_POR_ANO + 1;

  const diaDeDestino =
    defeitos.semSaturacao === true
      ? dia
      : Math.min(dia, ultimoDiaDoMesDoControle(anoDeDestino, mesDeDestino));

  const inicioDoDia =
    defeitos.peloRelogioLocal === true
      ? new Date(anoDeDestino, mesDeDestino - 1, diaDeDestino).getTime()
      : Date.UTC(anoDeDestino, mesDeDestino - 1, diaDeDestino);

  const ajuste = defeitos.semAjusteDeUmDia === true ? 0 : MILISSEGUNDOS_POR_DIA;

  return new Date(inicioDoDia - ajuste).toISOString().slice(0, 10);
}

/** O comprimento do mês, no controle. Duplicado de propósito: o controle não consome a produção. */
function ultimoDiaDoMesDoControle(ano: number, mes: number): number {
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

  if (mes === 2) {
    return bissexto ? 29 : 28;
  }

  return new Set([4, 6, 9, 11]).has(mes) ? 30 : 31;
}
