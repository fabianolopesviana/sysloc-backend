/**
 * O valor monetário do documento nas duas formas — **casos de apoio ao CT-709**, sem ID próprio.
 *
 * Rastreabilidade: CA-03 → CT-709 (RN-15), pela linha **DV-01**.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-03 | CT-709 (apoio a) | O valor por extenso sai em **pt-BR**, e a tabela cobre as
 * |       |                  | irregularidades da língua que uma implementação ingênua erra: `cem`
 * |       |                  | contra `cento e um`, `mil` sem o `um` na frente, a alternância entre
 * |       |                  | `, ` e ` e ` na junção dos grupos, e a concordância de `real`/`reais`
 * |       |                  | e `centavo`/`centavos`. Cada linha é afirmada por **igualdade
 * |       |                  | literal**. |
 * | CA-03 | CT-709 (apoio b) | O valor formatado sai como o documento o imprime — `R$ 2.500,00` —,
 * |       |                  | com separador de milhar a cada três dígitos e duas casas sempre. |
 * | CA-03 | CT-709 (apoio c) | Os **dois** valores que o golden carrega em inglês saem em pt-BR: a
 * |       |                  | DV-01 é vitória do produto, e o teste a **espera**. |
 * | CA-03 | CT-709 (apoio d) | Valor que não é dinheiro representável — negativo, `NaN`,
 * |       |                  | `Infinity`, acima do que as escalas nomeiam — **lança**
 * |       |                  | `ErroDeValorForaDeAlcance` com o valor recusado em campo, nas duas
 * |       |                  | funções. É o companheiro negativo: um documento com a parte inteira
 * |       |                  | faltando é pior que documento nenhum. |
 *
 * ===========================================================================
 * ⚠️ A DV-01 é vitória do produto, e este arquivo a espera
 * ===========================================================================
 *
 * O legado emite `two thousand, ﬁve hundred only reais` — está literalmente no golden, produzido por
 * `frappe.utils.money_in_words(v, "BRL")` com o idioma padrão do site. O veredito **PRODUTO_VENCE**
 * está escrito na §21.1 do tech spec, **antes** da execução. **Não "corrija" a implementação para
 * emitir em inglês** ao ver a diferença no CT-709: o golden é que carrega o defeito.
 *
 * **Por que estes casos não têm ID de CT novo**: os IDs são globais da feature e a faixa está fechada
 * em 33 casos (`CT-701`..`CT-715`, `CT-717`..`CT-734`), com o vão do `CT-716` intencional e
 * preservado (§19 do tech spec). Renumerar dessincronizaria as tabelas do tech spec e o
 * `_run/test-cases.json`. Eles são apoio direto do CT-709 e ficam rotulados como tal.
 *
 * **Real execution boundary**: `none`. Nenhum mock — não há colaborador a dublar.
 */

import { describe, expect, it } from 'vitest';
import {
  ErroDeValorForaDeAlcance,
  formatarValorEmReais,
  valorPorExtenso,
} from '../src/contrato/extenso.ts';

/** Um par valor → texto, escrito à mão: o lado esperado nunca sai do próprio SUT. */
interface ParDeExtenso {
  readonly valor: number;
  readonly porExtenso: string;
}

const EXTENSO_ESPERADO: readonly ParDeExtenso[] = [
  { valor: 0, porExtenso: 'zero reais' },
  { valor: 1, porExtenso: 'um real' },
  { valor: 2, porExtenso: 'dois reais' },
  { valor: 15, porExtenso: 'quinze reais' },
  { valor: 21, porExtenso: 'vinte e um reais' },
  // `cem` exato contra `cento e …`: a irregularidade que uma tabela de centenas ingênua erra.
  { valor: 100, porExtenso: 'cem reais' },
  { valor: 101, porExtenso: 'cento e um reais' },
  { valor: 199, porExtenso: 'cento e noventa e nove reais' },
  { valor: 200, porExtenso: 'duzentos reais' },
  // `mil` sozinho, nunca `um mil`.
  { valor: 1000, porExtenso: 'mil reais' },
  { valor: 1500, porExtenso: 'mil e quinhentos reais' },
  // O valor do contrato de referência do golden — a linha da DV-01.
  { valor: 2500, porExtenso: 'dois mil e quinhentos reais' },
  // O valor total do mesmo contrato — a outra linha da DV-01.
  { valor: 30000, porExtenso: 'trinta mil reais' },
  { valor: 33600, porExtenso: 'trinta e três mil e seiscentos reais' },
  // A junção por vírgula: o último grupo não é menor que cem nem é centena exata.
  { valor: 1101, porExtenso: 'mil, cento e um reais' },
  // A preposição das grandezas maiores: `um milhão **de** reais`, e não `um milhão reais`.
  { valor: 1000000, porExtenso: 'um milhão de reais' },
  { valor: 2000000000, porExtenso: 'dois bilhões de reais' },
  // …e ela some assim que existe algo abaixo da escala.
  { valor: 1500000, porExtenso: 'um milhão e quinhentos mil reais' },
  // O `e` volta quando o último grupo é centena exata, mesmo com um grupo nulo no meio.
  { valor: 1000100, porExtenso: 'um milhão e cem reais' },
  {
    valor: 1234567,
    porExtenso: 'um milhão, duzentos e trinta e quatro mil, quinhentos e sessenta e sete reais',
  },
  // A concordância dos centavos, no singular e no plural, e o `e` que os liga aos reais.
  { valor: 0.01, porExtenso: 'zero reais e um centavo' },
  { valor: 0.5, porExtenso: 'zero reais e cinquenta centavos' },
  { valor: 1.01, porExtenso: 'um real e um centavo' },
  {
    valor: 1234.56,
    porExtenso: 'mil, duzentos e trinta e quatro reais e cinquenta e seis centavos',
  },
];

/** Um par valor → texto formatado, também escrito à mão. */
const FORMATADO_ESPERADO: readonly { readonly valor: number; readonly formatado: string }[] = [
  { valor: 0, formatado: 'R$ 0,00' },
  { valor: 0.5, formatado: 'R$ 0,50' },
  { valor: 1, formatado: 'R$ 1,00' },
  { valor: 999, formatado: 'R$ 999,00' },
  { valor: 1000, formatado: 'R$ 1.000,00' },
  { valor: 2500, formatado: 'R$ 2.500,00' },
  { valor: 30000, formatado: 'R$ 30.000,00' },
  { valor: 1234.56, formatado: 'R$ 1.234,56' },
  { valor: 1234567.89, formatado: 'R$ 1.234.567,89' },
];

describe('CT-709 (apoio) — o valor monetário do documento sai em pt-BR (DV-01)', () => {
  it.each(EXTENSO_ESPERADO)(
    'CT-709 (apoio a) — $valor por extenso é "$porExtenso"',
    ({ valor, porExtenso }) => {
      expect(valorPorExtenso(valor)).toBe(porExtenso);
    },
  );

  it.each(FORMATADO_ESPERADO)(
    'CT-709 (apoio b) — $valor formatado é "$formatado"',
    ({ valor, formatado }) => {
      expect(formatarValorEmReais(valor)).toBe(formatado);
    },
  );

  it('CT-709 (apoio c) — os dois valores que o golden traz em inglês saem em português', () => {
    // O lado antigo, escrito aqui porque é a asserção da divergência — é o mesmo recorte que o
    // `CT-637` da sub-fatia irmã faz com o seu único par divergente.
    expect(valorPorExtenso(2500)).not.toBe('two thousand, five hundred only reais');
    expect(valorPorExtenso(2500)).toBe('dois mil e quinhentos reais');

    expect(valorPorExtenso(30000)).not.toBe('thirty thousand only reais');
    expect(valorPorExtenso(30000)).toBe('trinta mil reais');
  });

  it.each([
    { nome: 'negativo', valor: -1 },
    { nome: 'não numérico', valor: Number.NaN },
    { nome: 'infinito', valor: Number.POSITIVE_INFINITY },
    { nome: 'acima do que as escalas nomeiam', valor: 10 ** 15 },
    // Logo acima de `Number.MAX_SAFE_INTEGER / 100`: a partir daqui a conversão para centavos
    // deixaria de distinguir centavos vizinhos, e o extenso mentiria em silêncio.
    { nome: 'acima do que a aritmética exata alcança', valor: 90_071_992_547_410 },
  ])(
    'CT-709 (apoio d) — companheiro negativo: valor $nome é recusado pelas duas funções',
    ({ valor }) => {
      expect(() => valorPorExtenso(valor)).toThrow(ErroDeValorForaDeAlcance);
      expect(() => formatarValorEmReais(valor)).toThrow(ErroDeValorForaDeAlcance);

      try {
        valorPorExtenso(valor);
        expect.unreachable('o extenso deveria ter recusado o valor');
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDeValorForaDeAlcance);
        const recusa = erro as ErroDeValorForaDeAlcance;
        expect(recusa.name).toBe('ErroDeValorForaDeAlcance');
        // O valor recusado viaja em campo — `NaN` inclusive, e por isso a comparação é por `Object.is`.
        expect(Object.is(recusa.valor, valor)).toBe(true);
      }
    },
  );

  it('CT-709 (apoio e) — o maior valor que o contrato admite ainda é nomeável', () => {
    // `MAIOR_VALOR_MONETARIO` de `@syslocbr/contracts` vale 9.999.999.999.999,99. Ele NÃO é importado
    // aqui de propósito — ver a conferência do débito **D1 (F3/T2)** no relatório da T5, cujo
    // marcador vive em `packages/contracts/src/cobranca.ts`: o alcance desta função é o do
    // vocabulário que ela sabe nomear, não o da coluna que guarda o dinheiro. O que este caso afirma
    // é que um não estrangula o outro.
    expect(valorPorExtenso(9_999_999_999_999.99)).toBe(
      'nove trilhões, novecentos e noventa e nove bilhões, novecentos e noventa e nove milhões, novecentos e noventa e nove mil, novecentos e noventa e nove reais e noventa e nove centavos',
    );
    expect(formatarValorEmReais(9_999_999_999_999.99)).toBe('R$ 9.999.999.999.999,99');
  });
});
