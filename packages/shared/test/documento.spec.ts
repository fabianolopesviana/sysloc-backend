/**
 * Conferência de dígito verificador de CPF e CNPJ — CT-314.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-08    | CT-314 | A conferência devolve verdadeiro **exatamente** para as cadeias cujo dígito
 * |          |        | verificador confere segundo o algoritmo oficial, e falso para dígito errado,
 * |          |        | para todos os dígitos iguais, para comprimento fora do previsto e para cadeia
 * |          |        | com caractere não numérico — com e sem máscara de formatação. |
 *
 * Rastreabilidade: `CA-08 → CT-314 (RN-04)`. A mesma regra é exercitada pela borda em CT-313
 * (T9), que é o companheiro de integração exigido pela Mock Budget Rule — aqui a fronteira real
 * de execução é legitimamente **nenhuma**: aritmética sem I/O.
 *
 * ---------------------------------------------------------------------------
 * Por que a tabela é assim, e não menor
 * ---------------------------------------------------------------------------
 *
 * **O controle positivo é o eixo do caso.** Uma conferência que recusasse tudo passaria numa
 * tabela só de inválidos, e é exatamente a armadilha que a §7 do Protocolo Antirregressão
 * descreve — *"provou-se o que era fácil provar"*. Por isso metade das entradas são documentos
 * legítimos, e por isso quatro delas carregam **dígito verificador zero**: é o ramo `resto < 2`,
 * o único que discrimina a implementação ingênua, que devolveria `11` ou `10` ali.
 *
 * Cada par de entradas inválidas foi escolhido para **isolar** um ramo, e não para repetir o
 * mesmo modo de falha:
 *
 * - o *primeiro* dígito trocado vem acompanhado do *segundo* recalculado sobre o prefixo já
 *   corrompido — assim a cadeia só reprova se a conferência olhar o primeiro dígito. Uma
 *   implementação que conferisse apenas o segundo aprovaria esta entrada;
 * - o *segundo* dígito trocado, ao contrário, só reprova se a conferência olhar o segundo;
 * - as cadeias com letra vêm em duas formas: uma que a normalização reduz a um documento
 *   **válido** (`5299822472A5` vira `52998224725`) e outra que ela reduz a comprimento errado.
 *   Só a primeira discrimina a guarda de forma; sem ela, a guarda poderia ser removida sem que
 *   nenhuma asserção quebrasse.
 *
 * Os literais desta tabela foram **conferidos aritmeticamente** contra uma implementação
 * independente do algoritmo antes de serem escritos, e não recuperados de memória: um "válido"
 * que na verdade é inválido transforma o controle positivo em ruído e faz o caso provar o
 * contrário do que promete. As âncoras ao final do arquivo mantêm essa propriedade viva.
 *
 * Sem colaborador algum: as duas funções são puras.
 */

import { describe, expect, it } from 'vitest';
import { conferirDocumento, somenteDigitos } from '../src/documento.ts';

/** Qual dos dois dígitos verificadores é zero — o ramo `resto < 2`. */
type PosicaoDoDigitoZero = 'primeiro' | 'segundo' | 'nenhuma';

interface DocumentoValido {
  readonly rotulo: string;
  readonly mascarado: string;
  readonly simples: string;
  readonly digitoZero: PosicaoDoDigitoZero;
}

interface DocumentoInvalido {
  readonly rotulo: string;
  readonly valor: string;
}

/**
 * Os dois documentos canônicos do arquivo, declarados **uma única vez**.
 *
 * Eles são consumidos pela tabela de válidos e pela de normalização. Repetir o literal nas duas
 * faria uma edição parcial deixar as tabelas falando de documentos diferentes **sem que nada
 * reprovasse** — o arquivo ficaria internamente incoerente e continuaria verde.
 */
const CPF_CANONICO = { mascarado: '529.982.247-25', simples: '52998224725' } as const;
const CNPJ_CANONICO = { mascarado: '11.222.333/0001-81', simples: '11222333000181' } as const;

const CPF_VALIDOS: readonly DocumentoValido[] = [
  {
    rotulo: 'CPF com os dois dígitos verificadores diferentes de zero',
    mascarado: CPF_CANONICO.mascarado,
    simples: CPF_CANONICO.simples,
    digitoZero: 'nenhuma',
  },
  {
    rotulo: 'CPF cujo primeiro dígito verificador é zero por resto 1',
    mascarado: '453.489.578-01',
    simples: '45348957801',
    digitoZero: 'primeiro',
  },
  {
    rotulo: 'CPF cujo primeiro dígito verificador é zero por resto 0',
    mascarado: '250.474.781-06',
    simples: '25047478106',
    digitoZero: 'primeiro',
  },
  {
    rotulo: 'CPF cujo segundo dígito verificador é zero por resto 1',
    mascarado: '791.042.501-50',
    simples: '79104250150',
    digitoZero: 'segundo',
  },
  {
    rotulo: 'CPF cujo segundo dígito verificador é zero por resto 0',
    mascarado: '513.637.680-50',
    simples: '51363768050',
    digitoZero: 'segundo',
  },
];

const CNPJ_VALIDOS: readonly DocumentoValido[] = [
  {
    rotulo: 'CNPJ com os dois dígitos verificadores diferentes de zero',
    mascarado: CNPJ_CANONICO.mascarado,
    simples: CNPJ_CANONICO.simples,
    digitoZero: 'nenhuma',
  },
  {
    rotulo: 'CNPJ cujo primeiro dígito verificador é zero por resto 1',
    mascarado: '79.274.833/0001-09',
    simples: '79274833000109',
    digitoZero: 'primeiro',
  },
  {
    rotulo: 'CNPJ cujo primeiro dígito verificador é zero por resto 0',
    mascarado: '83.572.920/0001-01',
    simples: '83572920000101',
    digitoZero: 'primeiro',
  },
  {
    rotulo: 'CNPJ cujo segundo dígito verificador é zero por resto 0',
    mascarado: '94.587.716/0001-80',
    simples: '94587716000180',
    digitoZero: 'segundo',
  },
  {
    rotulo: 'CNPJ cujo segundo dígito verificador é zero por resto 1',
    mascarado: '59.429.617/0001-70',
    simples: '59429617000170',
    digitoZero: 'segundo',
  },
];

const CPF_INVALIDOS: readonly DocumentoInvalido[] = [
  {
    rotulo: 'primeiro dígito trocado, com o segundo coerente com o prefixo corrompido',
    valor: '529.982.247-33',
  },
  { rotulo: 'segundo dígito trocado', valor: '529.982.247-26' },
  {
    rotulo: 'todos os dígitos iguais a zero — o cálculo do verificador aprova',
    valor: '000.000.000-00',
  },
  {
    rotulo: 'todos os dígitos iguais a um — o cálculo do verificador aprova',
    valor: '111.111.111-11',
  },
  { rotulo: 'dez dígitos', valor: '5299822472' },
  { rotulo: 'doze dígitos', valor: '529982247250' },
  { rotulo: 'letra entre onze dígitos que conferem', valor: '5299822472A5' },
  { rotulo: 'letra no lugar de um dígito', valor: '529.982.247-2A' },
  { rotulo: 'cadeia vazia', valor: '' },
];

const CNPJ_INVALIDOS: readonly DocumentoInvalido[] = [
  {
    rotulo: 'primeiro dígito trocado, com o segundo coerente com o prefixo corrompido',
    valor: '11.222.333/0001-90',
  },
  { rotulo: 'segundo dígito trocado', valor: '11.222.333/0001-82' },
  {
    rotulo: 'todos os dígitos iguais a zero — o cálculo do verificador aprova',
    valor: '00.000.000/0000-00',
  },
  { rotulo: 'treze dígitos', valor: '1122233300018' },
  { rotulo: 'quinze dígitos', valor: '112223330001810' },
  { rotulo: 'letra entre catorze dígitos que conferem', valor: '1122233300018A1' },
  { rotulo: 'letra no lugar de um dígito', valor: '11.222.333/0001-8A' },
];

const VALIDOS = [...CPF_VALIDOS, ...CNPJ_VALIDOS];
const INVALIDOS = [...CPF_INVALIDOS, ...CNPJ_INVALIDOS];

/** Toda cadeia que a tabela leva ao SUT — a base da âncora de contagem. */
const CADEIAS_EXERCITADAS: readonly string[] = [
  ...VALIDOS.flatMap((documento) => [documento.mascarado, documento.simples]),
  ...INVALIDOS.map((documento) => documento.valor),
];

describe('CT-314 — conferência de CPF e CNPJ pelo dígito verificador', () => {
  describe('documentos legítimos são aprovados, com e sem máscara', () => {
    it.each(VALIDOS)('$rotulo é aprovado com máscara', ({ mascarado }) => {
      expect(conferirDocumento(mascarado)).toBe(true);
    });

    it.each(VALIDOS)('$rotulo é aprovado sem máscara', ({ simples }) => {
      expect(conferirDocumento(simples)).toBe(true);
    });

    it.each(VALIDOS)(
      'a máscara de $rotulo normaliza exatamente para a forma sem máscara',
      ({ mascarado, simples }) => {
        // É o que torna "a mesma cadeia com e sem máscara" literal: as duas formas da tabela são o
        // mesmo documento, e não dois documentos diferentes que por acaso ambos conferem.
        expect(somenteDigitos(mascarado)).toBe(simples);
      },
    );
  });

  describe('documentos inválidos são recusados', () => {
    it.each(CPF_INVALIDOS)('CPF com $rotulo é recusado', ({ valor }) => {
      expect(conferirDocumento(valor)).toBe(false);
    });

    it.each(CNPJ_INVALIDOS)('CNPJ com $rotulo é recusado', ({ valor }) => {
      expect(conferirDocumento(valor)).toBe(false);
    });
  });

  describe('normalização para dígitos', () => {
    // Só entra aqui o que a tabela de válidos NÃO alcança. A remoção da máscara canônica de CPF e
    // de CNPJ já é afirmada, para os dez documentos, pelo `it.each(VALIDOS)` acima — repeti-la
    // aqui somava dois casos sem somar detecção, e qualquer mutante que as matasse já morria lá.
    // As quatro que restam exercitam entradas que nenhuma outra asserção do arquivo produz.
    const NORMALIZACOES: readonly { rotulo: string; valor: string; esperado: string }[] = [
      {
        rotulo: 'cadeia já normalizada (idempotência)',
        valor: CPF_CANONICO.simples,
        esperado: CPF_CANONICO.simples,
      },
      { rotulo: 'espaço e letra no meio dos dígitos', valor: ' 52 abc 99 ', esperado: '5299' },
      { rotulo: 'cadeia sem dígito algum', valor: 'sem-digito', esperado: '' },
      { rotulo: 'cadeia vazia', valor: '', esperado: '' },
    ];

    it.each(NORMALIZACOES)('$rotulo vira exatamente os dígitos', ({ valor, esperado }) => {
      expect(somenteDigitos(valor)).toBe(esperado);
    });
  });

  describe('âncoras da tabela', () => {
    // Estas quatro asserções não exercitam o SUT — elas impedem que a tabela deixe de discriminar
    // sem que nada quebre. Sem elas, truncar a tabela ou trocar um literal reduziria o poder de
    // detecção do caso em silêncio, que é a forma de regressão de prova mais difícil de notar.

    it('a tabela tem exatamente as entradas que o caso declara', () => {
      expect(CPF_VALIDOS).toHaveLength(5);
      expect(CNPJ_VALIDOS).toHaveLength(5);
      expect(CPF_INVALIDOS).toHaveLength(9);
      expect(CNPJ_INVALIDOS).toHaveLength(7);
    });

    it('as 36 cadeias exercitadas são distintas entre si', () => {
      expect(CADEIAS_EXERCITADAS).toHaveLength(36);
      expect(new Set(CADEIAS_EXERCITADAS).size).toBe(36);
    });

    it.each([
      { documento: 'CPF', tabela: CPF_VALIDOS },
      { documento: 'CNPJ', tabela: CNPJ_VALIDOS },
    ])(
      'a tabela de $documento cobre o ramo `resto < 2` nas duas posições do verificador',
      ({ tabela }) => {
        const porPosicao = (posicao: PosicaoDoDigitoZero) =>
          tabela.filter((documento) => documento.digitoZero === posicao).length;

        expect(porPosicao('primeiro')).toBe(2);
        expect(porPosicao('segundo')).toBe(2);
        expect(porPosicao('nenhuma')).toBe(1);
      },
    );

    it.each(VALIDOS)(
      'os verificadores de $rotulo são os que a tabela declara',
      ({ simples, digitoZero }) => {
        // Sem esta asserção, trocar um literal marcado como `primeiro`/`segundo` por outro documento
        // válido de verificador não-zero deixaria as duas asserções acima verdes e apagaria a
        // cobertura do ramo `resto < 2` — o único ramo que a implementação ingênua erra.
        const zeroEsperado: Record<PosicaoDoDigitoZero, readonly [boolean, boolean]> = {
          primeiro: [true, false],
          segundo: [false, true],
          nenhuma: [false, false],
        };

        expect([simples.slice(-2, -1) === '0', simples.slice(-1) === '0']).toEqual(
          zeroEsperado[digitoZero],
        );
      },
    );
  });
});
