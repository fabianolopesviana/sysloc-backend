/**
 * A normalização do texto antes da comparação com o oráculo — declarada, **fechada** e provada por
 * falsificação.
 *
 * Rastreabilidade: CA-03 → CT-707 (RN-15).
 *
 * INVARIANTES
 * - CT-707 (a): o par **tolerado** — a mesma frase com quebra de linha de layout e com a ligadura
 *   `ﬁ` (U+FB01) contra a forma limpa — normaliza para o **mesmo** texto, e o texto é afirmado por
 *   **valor literal**, nunca só por igualdade entre os dois lados.
 * - CT-707 (b): o par **não tolerado** — `R$ 2.500,00` contra `R$ 2.550,00` — permanece
 *   **diferente** depois de normalizado, e os dois valores são afirmados literalmente. É o
 *   companheiro negativo (`ct_id: self`): a normalização não pode absorver conteúdo, e dinheiro é o
 *   conteúdo que mais importa no documento.
 * - CT-707 (c): cada uma das **quatro âncoras** lidas do oráculo normaliza **exatamente** para o
 *   texto que o produto emite, escrito à mão neste arquivo. O lado esperado é **independente do
 *   SUT** — é isto que impede a asserção de ser tautológica (AP-29) e é isto que os cinco mutantes
 *   de §21.2 derrubam.
 * - CT-707 (d): as **cinco classes** de divergência de conteúdo **sobrevivem** à normalização —
 *   palavra trocada, centavo, ordem de parágrafos, cláusula removida e caixa. Cada linha afirma
 *   também **qual** trecho some, para que a asserção não passe por uma mutação que não incidiu.
 * - CT-707 (e): **controle pela outra ponta** — dois blocos distintos do oráculo não colapsam no
 *   mesmo valor normalizado.
 *
 * ---------------------------------------------------------------------------
 * Por que este caso existe, e por que ele é o mais delicado da fatia
 * ---------------------------------------------------------------------------
 *
 * A normalização é o lugar onde divergência se esconde. Uma regra mais frouxa do que a declarada
 * deixaria de detectar divergência de conteúdo **real** e transformaria toda a prova de equivalência
 * com o oráculo num carimbo — verde por construção, e portanto sem valor. O risco é nomeado no
 * tech-alignment (D3) e é o risco central da §20 do tech spec.
 *
 * ---------------------------------------------------------------------------
 * O lado do oráculo é LIDO do arquivo; o lado do produto é ESCRITO à mão
 * ---------------------------------------------------------------------------
 *
 * O golden nunca é redigitado aqui — é o molde do `CT-636` da fatia irmã, e a razão é que um
 * oráculo transcrito prova a transcrição, não o oráculo. O lado do **produto**, ao contrário, é
 * literal neste arquivo: é o texto que a composição (T5) deverá emitir, e escrevê-lo à mão é o que
 * dá à asserção um lado que não passou pelo SUT.
 *
 * ⚠️ **Nesta task a composição ainda não existe** — ela chega na T5, e a igualdade de ponta a ponta
 * é o CT-709, lá. O que se prova aqui é a propriedade da **função**: ela absorve exatamente DV-02
 * (a ligadura do extrator) e DV-03 (a quebra de linha do layout), e nada além.
 *
 * **Real execution boundary**: `none`. O domínio não abre banco, não fala com SMTP e não renderiza
 * PDF; a única leitura de disco é o artefato golden, que é dado de entrada versionado. Nenhum mock
 * existe neste arquivo — não há colaborador a dublar numa função pura.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizarParaComparacao } from '../src/normalizacao.ts';

// ---------------------------------------------------------------------------
// O oráculo, lido do repositório
// ---------------------------------------------------------------------------

/** A raiz do monorepo, resolvida a partir deste módulo — `packages/documentos/test/` menos três. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** O texto do documento do contrato, extraído do PDF do sistema antigo pela fatia de caracterização. */
const CAMINHO_DO_GOLDEN = join(
  RAIZ_DO_REPOSITORIO,
  'docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf.txt',
);

const GOLDEN = readFileSync(CAMINHO_DO_GOLDEN, 'utf8');

/**
 * Fatia o oráculo entre dois marcadores estruturais que ele próprio carrega.
 *
 * Ela **falha ruidosamente** quando um marcador não é encontrado, e a escolha é deliberada:
 * devolver texto vazio faria toda asserção seguinte comparar nada com nada, que é o pior desfecho
 * possível de uma asserção — verde por cegueira. O marcador inicial entra no trecho (ele é
 * conteúdo: é o cabeçalho da cláusula); o final não.
 */
function trechoDoGolden(marcadorInicial: string, marcadorFinal: string): string {
  const inicio = GOLDEN.indexOf(marcadorInicial);
  if (inicio === -1) {
    throw new Error(`marcador inicial ausente no oráculo: ${marcadorInicial}`);
  }

  const fim = GOLDEN.indexOf(marcadorFinal, inicio + marcadorInicial.length);
  if (fim === -1) {
    throw new Error(`marcador final ausente no oráculo: ${marcadorFinal}`);
  }

  return GOLDEN.slice(inicio, fim);
}

// ---------------------------------------------------------------------------
// As quatro âncoras — o oráculo de um lado, o texto do produto do outro
// ---------------------------------------------------------------------------

/** Uma âncora: o trecho do oráculo e o texto que o produto emite para o mesmo conteúdo. */
interface Ancora {
  readonly nome: string;
  readonly doOraculo: string;
  readonly comoOProdutoEmite: string;
}

/** O bloco das partes — dois parágrafos, e o alvo de m1, m3 e m5. */
const PARTES_COMO_O_PRODUTO_EMITE =
  'LOCADOR (A): Maria Locadora, portador(a) da cédula de identidade civil número MG-1234567, e do CPF número 111.222.333-44, residente e domiciliado em Avenida Central, 1000, Centro, Caratinga - MG, CEP 35300-001. LOCATÁRIO (A) (S): Joao Locatario, portador(a) da cédula de identidade civil número MG-7654321, e do CPF número 555.666.777-88, residente e domiciliado em Rua B, 55, Bela Vista, Caratinga - MG, CEP 35300-002.';

/** O bloco do objeto — onde a ligadura `identiﬁcado` aparece no oráculo (DV-02). */
const OBJETO_COMO_O_PRODUTO_EMITE =
  'CLÁUSULA PRIMEIRA: O objeto do presente contrato é o imóvel residencial identificado como Imovel PDF-001 , localizado em Rua das Flores, 120, Fundos, Centro, Caratinga - MG, CEP 35300-000 .';

/**
 * O bloco do valor — o alvo de m2.
 *
 * O `two thousand, five hundred only reais` é a **DV-01** e está aqui de propósito: o legado emite o
 * extenso em inglês, e o veredito escrito é `PRODUTO_VENCE`. A normalização **não** o absorve — ele
 * entra na lista de divergência esperada do CT-709 (T5). Reproduzi-lo aqui mantém a âncora fiel ao
 * oráculo; corrigi-lo silenciosamente faria este arquivo esconder a divergência que a fatia existe
 * para declarar.
 */
const VALOR_COMO_O_PRODUTO_EMITE =
  'CLÁUSULA SÉTIMA: O aluguel mensal é de R$ 2.500,00 ( two thousand, five hundred only reais ), com reajuste anual pelo índice IGPM-FGV, no período acumulativamente ou outro índice oficial determinado pelo governo que venha a substituí-lo. Daí por diante, caso ocorra a hipótese prevista na cláusula Sexta, ficará sujeito a reajustamentos periódicos estabelecidos na legislação pertinente que estiver em vigor.';

/** O bloco do foro — o alvo de m4, e a prova de que o travessão `–` sobrevive ao NFKC. */
const FORO_COMO_O_PRODUTO_EMITE =
  'CLÁUSULA VIGÉSIMA PRIMEIRA: As partes contratantes elegem o foro da Comarca de Caratinga – MG para dirimir quaisquer duvidas oriundas deste Contrato, renunciando a qualquer outro, por mais privilegio que seja.';

const ANCORAS: readonly Ancora[] = [
  {
    nome: 'as partes qualificadas — dois parágrafos, com as quebras de linha do layout (DV-03)',
    doOraculo: trechoDoGolden('LOCADOR (A):', 'OBJETO'),
    comoOProdutoEmite: PARTES_COMO_O_PRODUTO_EMITE,
  },
  {
    nome: 'o objeto — onde a ligadura `identiﬁcado` (U+FB01) aparece no oráculo (DV-02)',
    doOraculo: trechoDoGolden('CLÁUSULA PRIMEIRA:', 'DESTINAÇÃO'),
    comoOProdutoEmite: OBJETO_COMO_O_PRODUTO_EMITE,
  },
  {
    nome: 'o valor — onde `R$ 2.500,00` aparece, e onde a divergência DV-01 do extenso mora',
    doOraculo: trechoDoGolden('CLÁUSULA SÉTIMA:', 'a) VALOR TOTAL DO CONTRATO:'),
    comoOProdutoEmite: VALOR_COMO_O_PRODUTO_EMITE,
  },
  {
    nome: 'o foro — a `CLÁUSULA VIGÉSIMA PRIMEIRA`, com o travessão `–` que o NFKC preserva',
    doOraculo: trechoDoGolden('CLÁUSULA VIGÉSIMA PRIMEIRA:', 'E por estarem justos'),
    comoOProdutoEmite: FORO_COMO_O_PRODUTO_EMITE,
  },
];

// ---------------------------------------------------------------------------
// As cinco classes de divergência que a normalização NÃO pode absorver
// ---------------------------------------------------------------------------

/**
 * Uma classe de divergência de conteúdo, com a evidência que a discrimina.
 *
 * `trechoQueSai` é o que existe no texto íntegro e **desaparece** no mutado. Sem ele, uma mutação
 * que não incidisse (um `replace` cujo padrão não casa) deixaria os dois lados iguais — e a
 * asserção de desigualdade acusaria a falha, mas sem dizer qual classe deixou de ser exercitada.
 */
interface ClasseDeDivergencia {
  readonly nome: string;
  readonly integro: string;
  readonly mutado: string;
  readonly trechoQueSai: string;
}

/** As duas metades do bloco das partes, para que m3 troque a ordem sem reescrever o texto. */
const PARAGRAFO_DO_LOCADOR = PARTES_COMO_O_PRODUTO_EMITE.slice(
  0,
  PARTES_COMO_O_PRODUTO_EMITE.indexOf('LOCATÁRIO (A) (S):'),
);
const PARAGRAFO_DO_LOCATARIO = PARTES_COMO_O_PRODUTO_EMITE.slice(PARAGRAFO_DO_LOCADOR.length);

const CLASSES_DE_DIVERGENCIA: readonly ClasseDeDivergencia[] = [
  {
    nome: 'm1 — uma palavra trocada: `Avenida Central` vira `Avenida Lateral`',
    integro: PARTES_COMO_O_PRODUTO_EMITE,
    mutado: PARTES_COMO_O_PRODUTO_EMITE.replace('Avenida Central', 'Avenida Lateral'),
    trechoQueSai: 'Avenida Central',
  },
  {
    nome: 'm2 — um centavo: `R$ 2.500,00` vira `R$ 2.500,01`',
    integro: VALOR_COMO_O_PRODUTO_EMITE,
    mutado: VALOR_COMO_O_PRODUTO_EMITE.replace('R$ 2.500,00', 'R$ 2.500,01'),
    trechoQueSai: 'R$ 2.500,00',
  },
  {
    nome: 'm3 — dois parágrafos invertidos: o locatário passa a vir antes do locador',
    integro: PARTES_COMO_O_PRODUTO_EMITE,
    mutado: `${PARAGRAFO_DO_LOCATARIO} ${PARAGRAFO_DO_LOCADOR}`,
    trechoQueSai: 'CEP 35300-001. LOCATÁRIO (A) (S):',
  },
  {
    nome: 'm4 — uma cláusula removida: some o cabeçalho `CLÁUSULA VIGÉSIMA PRIMEIRA:`',
    integro: FORO_COMO_O_PRODUTO_EMITE,
    mutado: FORO_COMO_O_PRODUTO_EMITE.replace('CLÁUSULA VIGÉSIMA PRIMEIRA: ', ''),
    trechoQueSai: 'CLÁUSULA VIGÉSIMA PRIMEIRA:',
  },
  {
    nome: 'm5 — a caixa: `LOCATÁRIO (A) (S):` vira `locatário (a) (s):`',
    integro: PARTES_COMO_O_PRODUTO_EMITE,
    mutado: PARTES_COMO_O_PRODUTO_EMITE.replace('LOCATÁRIO (A) (S):', 'locatário (a) (s):'),
    trechoQueSai: 'LOCATÁRIO (A) (S):',
  },
];

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('CT-707 — a normalização do texto é declarada, fechada e provada por falsificação', () => {
  it('CT-707 (a) — o par tolerado normaliza para o mesmo texto, e o texto é literal', () => {
    // Os dois lados diferem exatamente nas duas dimensões declaradas: a ligadura `ﬁ` (DV-02) e a
    // quebra de linha do layout (DV-03).
    const doExtrator = 'identiﬁcado como\nImovel PDF-001';
    const doProduto = 'identificado como Imovel PDF-001';

    expect(normalizarParaComparacao(doExtrator)).toBe(normalizarParaComparacao(doProduto));
    // O valor exato, e não só a igualdade entre os dois: sem esta linha, uma normalização que
    // devolvesse sempre a string vazia satisfaria a igualdade acima.
    expect(normalizarParaComparacao(doExtrator)).toBe('identificado como Imovel PDF-001');
  });

  it('CT-707 (b) — o par NÃO tolerado permanece diferente: dinheiro não é absorvido', () => {
    const doOraculo = 'R$ 2.500,00';
    const outroValor = 'R$ 2.550,00';

    expect(normalizarParaComparacao(doOraculo)).not.toBe(normalizarParaComparacao(outroValor));
    // Os dois valores exatos, para que a desigualdade acima não possa vir de a normalização ter
    // corrompido um dos lados de um jeito qualquer.
    expect(normalizarParaComparacao(doOraculo)).toBe('R$ 2.500,00');
    expect(normalizarParaComparacao(outroValor)).toBe('R$ 2.550,00');
  });

  describe('CT-707 (c) — cada âncora do oráculo normaliza exatamente para o texto do produto', () => {
    it.each(ANCORAS)('$nome', ({ doOraculo, comoOProdutoEmite }) => {
      // O lado esperado é escrito à mão neste arquivo e NÃO passou pelo SUT — é o que faz esta
      // asserção poder falhar, e é ela que os cinco mutantes de §21.2 derrubam.
      expect(normalizarParaComparacao(doOraculo)).toBe(comoOProdutoEmite);
    });
  });

  describe('CT-707 (d) — as cinco classes de divergência de conteúdo sobrevivem à normalização', () => {
    it.each(CLASSES_DE_DIVERGENCIA)('$nome', ({ integro, mutado, trechoQueSai }) => {
      const normalizadoIntegro = normalizarParaComparacao(integro);
      const normalizadoMutado = normalizarParaComparacao(mutado);

      expect(normalizadoMutado).not.toBe(normalizadoIntegro);
      // A evidência de que a mutação incidiu de fato, e sobre esta classe: o trecho existe no
      // íntegro e desaparece no mutado, os dois já normalizados.
      expect(normalizadoIntegro).toContain(trechoQueSai);
      expect(normalizadoMutado).not.toContain(trechoQueSai);
    });
  });

  it('CT-707 (e) — controle pela outra ponta: dois blocos distintos não colapsam', () => {
    const [partes, objeto] = ANCORAS;
    if (partes === undefined || objeto === undefined) {
      throw new Error('as âncoras do oráculo não foram carregadas');
    }

    const normalizadoDasPartes = normalizarParaComparacao(partes.doOraculo);
    const normalizadoDoObjeto = normalizarParaComparacao(objeto.doOraculo);

    expect(normalizadoDasPartes).not.toBe(normalizadoDoObjeto);
    // E cada lado vale exatamente o texto que o produto emite: é isto que fecha a outra ponta —
    // dois blocos DISTINTOS do oráculo não convergem para um mesmo valor normalizado, propriedade
    // que nenhum outro caso deste arquivo afirma. Contra o colapso para `''` a suíte já é
    // redundante: a segunda asserção do caso (a) o derruba, e o mutante reprova os 12 casos.
    expect(normalizadoDasPartes).toBe(PARTES_COMO_O_PRODUTO_EMITE);
    expect(normalizadoDoObjeto).toBe(OBJETO_COMO_O_PRODUTO_EMITE);
  });
});
