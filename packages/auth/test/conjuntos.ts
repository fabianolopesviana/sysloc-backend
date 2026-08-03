/**
 * Comparação de conjuntos que **nomeia** o que sobra e o que falta.
 *
 * ---------------------------------------------------------------------------
 * Por que devolve as diferenças, e não um booleano
 * ---------------------------------------------------------------------------
 *
 * Uma reprovação que diz apenas "os conjuntos diferem" obriga quem lê a caçar qual item mudou — e é
 * essa fricção que faz a asserção ser afrouxada na rodada seguinte, que é exatamente a regressão de
 * prova (R2) que `.claude/rules/nao-regressao.md` §4.2 proíbe. Devolver os nomes é o que mantém a
 * asserção de igualdade barata de manter.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio
 * ---------------------------------------------------------------------------
 *
 * Ela nasceu duplicada palavra por palavra em `admissao.spec.ts` (ferramental do CT-026) e
 * `definicao-de-senha.spec.ts` (âncora da classe "definição de senha") — dois arquivos do MESMO
 * diretório, sem fronteira de pacote entre eles. Duas cópias de uma função de asserção divergem em
 * silêncio: um ajuste na ordenação ou no tratamento de repetidos aplicado a uma só faria as duas
 * âncoras deixarem de comparar a mesma coisa, e a diferença apareceria como discordância entre
 * casos, que é o diagnóstico mais enganoso possível aqui. É a mesma decisão que `decodificarBase32`
 * já recebeu em `apps/api/test/base32.ts`, pela mesma razão.
 *
 * Isto **não** esbarra no `D28` (F0/T5): aquele débito é sobre importar `packages/shared/test/` por
 * caminho relativo profundo, ATRAVESSANDO fronteira de pacote. Este arquivo é irmão dos dois que o
 * importam, e a importação é `./conjuntos.ts`.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a
 * verificar os tipos dele.
 */

/** O que sobra e o que falta entre o observado e o declarado, com os nomes. */
export function diferencasDeConjunto(
  observado: readonly string[],
  declarado: readonly string[],
): { excedentes: string[]; ausentes: string[] } {
  const noDeclarado = new Set(declarado);
  const noObservado = new Set(observado);

  return {
    excedentes: [...noObservado].filter((item) => !noDeclarado.has(item)).sort(),
    ausentes: [...noDeclarado].filter((item) => !noObservado.has(item)).sort(),
  };
}
