/**
 * Comparação de conjuntos que **nomeia** o que sobra e o que falta — a casa única do diretório.
 *
 * ---------------------------------------------------------------------------
 * Por que devolve as duas listas, e não um booleano
 * ---------------------------------------------------------------------------
 *
 * Uma reprovação que diz apenas *"os conjuntos diferem"* obriga quem lê a caçar qual item mudou — e é
 * essa fricção que faz a asserção ser afrouxada na rodada seguinte, que é exatamente a regressão de
 * prova (R2) que `.claude/rules/nao-regressao.md` §4.2 proíbe. `excedentes` é o que apareceu sem
 * ninguém decidir; `ausentes` é o que sumiu. Cada uma sai **ordenada**, para que a mensagem não
 * dependa da ordem em que os fontes ou as linhas foram lidos.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio — o limiar de três, disparado
 * ---------------------------------------------------------------------------
 *
 * A função nasceu copiada palavra por palavra em `vocabulario-canonico.spec.ts` (âncora de
 * superfície do pacote) e em `guarda-de-boletos.spec.ts` (âncora da árvore de arquivos), e o
 * percurso do lote seria a **terceira** cópia do mesmo diretório. É o gatilho que o `CLAUDE.md`
 * declara: *"com duas cópias, endurecer uma deixa a outra para trás; com três, elas já divergiram"* —
 * e o débito **D29**, anotado pelo Gate 2 da T9, nomeia exatamente este ponto. Duas cópias de uma
 * função de asserção divergem em silêncio: um ajuste na ordenação ou no tratamento de repetidos
 * aplicado a uma só faria as âncoras deixarem de comparar a mesma coisa, e a diferença apareceria
 * como discordância entre casos — o diagnóstico mais enganoso possível.
 *
 * ⚠️ **A gêmea de `packages/auth/test/conjuntos.ts` NÃO é importada daqui, e a duplicação entre os
 * dois pacotes é deliberada.** Aquele arquivo é local ao diretório dele pela mesma razão que este é
 * local a este; alcançá-lo por caminho relativo profundo atravessaria fronteira de pacote, que é o
 * débito **D28 · F0/T5**. O limiar de três é sobre cópias que **um mesmo diretório** carrega.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar
 * os tipos dele.
 */

/** As duas direções em que dois conjuntos de nomes divergem — o que a contenção nunca vê. */
export function diferencasDeConjunto(
  observados: readonly string[],
  declarados: readonly string[],
): { excedentes: string[]; ausentes: string[] } {
  const conjuntoObservado = new Set(observados);
  const conjuntoDeclarado = new Set(declarados);

  return {
    excedentes: [...conjuntoObservado].filter((nome) => !conjuntoDeclarado.has(nome)).sort(),
    ausentes: [...conjuntoDeclarado].filter((nome) => !conjuntoObservado.has(nome)).sort(),
  };
}
