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
 * asserção de igualdade barata de manter. É também o que a `.claude/rules/ancoras-de-superficie.md`
 * pede ao exigir igualdade de conjunto com controle antivácuo, e não contenção.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio, e por que ele nasce AGORA
 * ---------------------------------------------------------------------------
 *
 * O `CLAUDE.md` é literal na convenção *"acessório de suíte se importa, não se copia"*: antes de
 * escrever num arquivo de teste um acessório, procura-se a casa compartilhada do diretório (os `.ts`
 * sem `.spec` ao lado) — *"se existir, importe; se não existir, **crie-a**"*. Em
 * `packages/db/test/` ela não existia, e a casa nasceu quando a função chegou à segunda ocorrência.
 *
 * ✅ **As cópias locais não existem mais.** Elas viviam em `emissao-em-lote.spec.ts` e em
 * `conferencia-bancaria.spec.ts`, cada uma com uma nota declarando ser a "primeira" e a "segunda"
 * ocorrência do diretório — e foram trocadas por `import` na T2 da fatia `webhook-e-carne`, que abriu
 * os dois arquivos por outra razão. Hoje os consumidores são **quatro**, todos importando daqui:
 * `catalogo-de-plataforma.spec.ts`, `fonte-unica-do-estado.spec.ts`, `emissao-em-lote.spec.ts` e
 * `conferencia-bancaria.spec.ts`. Com cópia, endurecer uma deixa as outras para trás — é o defeito
 * que o Limiar de Três do `CLAUDE.md` existe para evitar, e a casa só o evita de fato quando ninguém
 * mais declara a função localmente.
 *
 * Isto **não** esbarra no `D28` (F0/T5): aquele débito é sobre importar `packages/shared/test/` por
 * caminho relativo profundo, ATRAVESSANDO fronteira de pacote. Este arquivo é irmão de quem o
 * importa, e a importação é `./conjuntos.ts`.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar
 * os tipos dele. Mesma forma, e mesma razão, de `packages/auth/test/conjuntos.ts`.
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
