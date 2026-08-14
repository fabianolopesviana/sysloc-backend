/**
 * A normalização que a comparação com o oráculo aplica aos dois lados — **fechada em três
 * operações**.
 *
 * ===========================================================================
 * Por que ela é curta, e por que encurtá-la ainda mais seria melhor do que alongá-la
 * ===========================================================================
 *
 * A normalização é o lugar onde divergência se esconde. Cada operação a mais é uma classe de
 * diferença **real** que a comparação deixa de enxergar, e o custo não é uniforme: a que mais
 * importa é dinheiro. Uma regra que removesse dígitos, ou que arredondasse número, faria
 * `R$ 2.500,00` e `R$ 2.550,00` passarem como o mesmo valor — e a prova de equivalência inteira
 * viraria carimbo, verde por construção.
 *
 * As três operações abaixo existem porque **duas divergências medidas** no oráculo são artefato do
 * extrator de PDF do sistema antigo, e não conteúdo:
 *
 * - **DV-02** — a ligadura tipográfica `ﬁ` (U+FB01) aparece em `identiﬁcado`, `ﬁns`, `ﬁcará`,
 *   `ﬁnanceiras`. Ela é como o extrator escreveu `fi`, não como o contrato foi redigido.
 * - **DV-03** — o layout do wkhtmltopdf quebra linha no meio de frases, e a quebra é decisão de
 *   paginação de outro motor.
 *
 * ⚠️ **O que ela NÃO faz, e a lista é vinculante**: não remove pontuação, não muda caixa, não
 * remove acento, não reordena, não remove palavra, não arredonda número, não normaliza moeda.
 *
 * ===========================================================================
 * ⚠️ Ela NÃO tem chamador de produção, e aplicá-la ao texto que vai ao PDF corrompe o documento
 * ===========================================================================
 *
 * Esta função existe para **comparar contra o oráculo**, e só para isso. O tech spec a classifica
 * duas vezes como *"a normalização declarada e fechada do D3, usada **só pela verificação**"* (§3,
 * na tabela de símbolos e na de arquivos), e o único chamador planejado é o **CT-709** da T5, em
 * `test/composicao.spec.ts`. Nenhum adaptador, nenhuma composição e nenhuma borda a chama: **a
 * ausência de chamador de produção é o desenho**, não uma lacuna a preencher.
 *
 * O aviso é concreto porque o convite é concreto — o nome é atraente e a assinatura é
 * `(texto: string) => string`, que encaixa em qualquer lugar. **Quem a aplicasse ao `texto` de um
 * bloco antes de renderizar colapsaria toda quebra de linha e todo espaço múltiplo do layout**, e o
 * PDF sairia com forma diferente da que o oráculo tem. E o defeito não apareceria em lugar nenhum:
 * a comparação normaliza **os dois lados**, de modo que ela seguiria verde justamente porque a
 * corrupção passou pela mesma função que a comparação aplica. É a classe de defeito que esta fatia
 * existe para não portar.
 *
 * O aviso simétrico mora em `porta-de-renderizacao.ts`, e os dois se leem juntos: lá, o que não pode
 * ser renderizado é o `rotulo`, identidade que o oráculo não tem; aqui, o que não pode tocar o que
 * vai ser renderizado é esta função.
 *
 * ===========================================================================
 * Duas consequências do NFKC que não são óbvias, e que foram medidas no oráculo
 * ===========================================================================
 *
 * 1. Ele resolve **mais** compatibilidades do que a ligadura: no golden, `º` (U+00BA, de
 *    `PARÁGRAFO 1º`) vira `o`. É aceito de propósito — a operação incide sobre **os dois lados** da
 *    comparação, de modo que ela não esconde divergência entre eles; o que ela faz é escolher uma
 *    grafia canônica para os dois. Trocar NFKC por NFC para "preservar o ordinal" deixaria de
 *    resolver a ligadura, que é a razão de a operação existir.
 * 2. Ele **não** toca acento nem travessão: `á` continua `á` e `–` (U+2013) continua `–`. Quem
 *    esperar que "normalizar Unicode" remova acento vai encontrar o contrário, e é o correto —
 *    acento é conteúdo.
 */

/**
 * Toda sequência de espaço em branco vira um espaço só.
 *
 * `\s` alcança `\n`, `\t`, `\r`, o espaço fino e o **espaço inquebrável** `U+00A0` — os quatro
 * primeiros aparecem no oráculo. Enumerar os caracteres à mão seria a alternativa explícita e foi
 * descartada: a lista fica incompleta em silêncio no primeiro extrator que emitir um espaço
 * tipográfico que ninguém previu.
 *
 * A constante é global (`g`) porque `String.prototype.replace` só substitui todas as ocorrências
 * assim. Reutilizar uma expressão global é armadilha conhecida com `.test()` e `.exec()`, que
 * carregam `lastIndex` entre chamadas — `replace` o reinicia, e por isso o compartilhamento é
 * seguro aqui.
 */
const SEQUENCIA_DE_ESPACO_EM_BRANCO = /\s+/gu;

/** O único espaço que sobrevive à normalização — `U+0020`, e nenhuma das variantes tipográficas. */
const ESPACO_CANONICO = ' ';

// DECISÃO FECHADA — T4 / fatia `documentos-e-confirmacao` · 2026-08-13
// O QUÊ: a normalização aplicada antes de comparar com o oráculo faz EXATAMENTE três operações,
//        nesta ordem — `normalize('NFKC')`, colapso de espaço em branco e `trim()` — e nada além.
//        A lista negativa do docblock acima é parte da decisão: acrescentar caixa, pontuação,
//        acento, ordem, omissão de palavra, arredondamento ou moeda está vedado.
// POR QUÊ: a alternativa idiomática — "normalizar mais para reduzir ruído" — é justamente a que
//        destrói a prova: cada operação a mais apaga uma classe de divergência REAL, e a prova de
//        equivalência fica verde por construção. A tentação não chega hoje; ela chega na rodada em
//        que a comparação com o golden reprovar, quando afrouxar a regra é o caminho de menor
//        resistência para o vermelho virar verde. É o risco central desta fatia, e por isso a
//        decisão mora aqui, na linha, e não só no relatório.
// REVERTER EXIGE: demonstrar, com a regra alterada, que os CINCO mutantes de §21.2 do tech spec
//        continuam deixando o CT-707 VERMELHO — m1 palavra trocada, m2 `R$ 2.500,00` →
//        `R$ 2.500,01`, m3 dois parágrafos invertidos, m4 `CLÁUSULA VIGÉSIMA PRIMEIRA` removida,
//        m5 `LOCATÁRIO` → `locatário` — mais o controle pela outra ponta (dois blocos distintos do
//        oráculo não colapsam no mesmo valor). Falhar um só deles significa que a operação
//        acrescentada absorve conteúdo, e a mudança está vedada.
/**
 * Normaliza um texto para comparação com o oráculo.
 *
 * O `trim` existe porque o colapso deixa exatamente um espaço nas pontas quando o texto começa ou
 * termina com quebra de linha, que é o caso de todo bloco fatiado do oráculo.
 *
 * ⚠️ **A ordem das três operações é convenção declarada, não propriedade falsificável** — e isto foi
 * medido, não suposto. O mecanismo que a justificaria existe em tese: **52** caracteres do Unicode
 * produzem espaço sob NFKC sem que `\s` os alcance antes (todos diacríticos isolados — `¨`, `´`,
 * `˘`, `΄`), e mesmo eles só mudam a saída quando aparecem **colados a um espaço** (`'a ¨ b'` sai
 * com um espaço antes do diacrítico nesta ordem, e com dois se o colapso vier primeiro). **Nenhum
 * dos 52 ocorre no oráculo**, e para tudo que ocorre — `U+00A0`, `U+3000`, a ligadura de DV-02, o
 * ordinal `º` — as **seis** permutações das três operações produzem saída idêntica, o golden
 * inteiro incluído.
 *
 * A consequência importa para quem for honrar o marcador acima: **um mutante que troque a ordem é
 * equivalente**, e nenhum caso desta suíte pode matá-lo — não porque a suíte seja fraca, e sim
 * porque o corpus não contém a única classe de entrada que discriminaria. É também por isso que
 * nenhum dos cinco mutantes do `REVERTER EXIGE` incide sobre a ordem: o que a decisão fecha é o
 * **conjunto** das três operações, e é o conjunto que eles guardam.
 */
export function normalizarParaComparacao(texto: string): string {
  return texto.normalize('NFKC').replace(SEQUENCIA_DE_ESPACO_EM_BRANCO, ESPACO_CANONICO).trim();
}
