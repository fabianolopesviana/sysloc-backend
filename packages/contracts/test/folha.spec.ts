/**
 * O pacote de contratos é FOLHA — CT-339.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-16    | CT-339 | Nenhum arquivo de `packages/contracts/src/**` importa `@sysloc/db`,
 * |          |        | `@sysloc/api` ou caminho relativo que saia do pacote; e o manifesto não
 * |          |        | declara nenhum dos dois em `dependencies`, `peerDependencies` ou
 * |          |        | `devDependencies`. |
 *
 * Rastreabilidade: `CA-16 → CT-339`.
 *
 * ---------------------------------------------------------------------------
 * Por que este invariante merece um caso, e por que ele é ESTÁTICO
 * ---------------------------------------------------------------------------
 *
 * É o que permite ao frontend importar o contrato **sem arrastar o servidor** (§3.3 da tech spec).
 * A aresta proibida não quebra nada aqui dentro — ao contrário, ela compila e funciona; o custo
 * aparece do outro lado da entrega, quando o React passa a resolver `drizzle-orm`, `postgres` e o
 * arcabouço HTTP para conhecer o tipo de um imóvel. Um invariante que só dói fora do repositório
 * precisa de uma asserção **dentro** dele.
 *
 * A asserção é ESTÁTICA (inspeciona o texto do fonte e o manifesto), e por isso a prova de
 * falsificação é OBRIGATÓRIA (`.claude/rules/testing-stack.md`). O mutante aplicado foi a aresta
 * COMPLETA — `"@sysloc/db": "workspace:*"` acrescentada às `dependencies` do manifesto, `pnpm
 * install`, e `import { SENHA_DA_CARGA } from '@sysloc/db';` em `src/comum.ts`. A aresta precisa das
 * duas pontas para ser fiel: sem a declaração no manifesto, o `tsc --build` do script reprovaria por
 * módulo não resolvido e a asserção nunca chegaria a ser executada — "reprovou" sem provar nada.
 * Resultado: `2 failed | 29 passed`, com `ocorrencias` contendo **uma** entrada
 * (`…/src/comum.ts:17`) e `declaradas` começando por `@sysloc/db`. Revertido, o controle voltou a
 * `31 passed`.
 *
 * A prova rodou pelo SCRIPT do pacote — `pnpm --filter @syslocbr/contracts test` —, e não por
 * `vitest run` avulso: a regra vale mesmo aqui, onde a suíte lê o fonte por caminho relativo, porque
 * *sempre pelo script* é o que dispensa apurar a cadeia de acessórios.
 *
 * As duas metades são obrigatórias. O fonte sozinho não pega uma dependência declarada no manifesto
 * e ainda não usada — que é como a aresta costuma entrar, um `pnpm add` antes do primeiro `import`.
 * O manifesto sozinho não pega o caminho relativo profundo, que não passa por manifesto nenhum.
 */

// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. Aqui ele é mais grave do que nos consumidores
//        anteriores: `@sysloc/db` NÃO é dependência declarada deste pacote, e não pode ser — o
//        CT-339, logo abaixo, existe para provar que ela não existe. O acessório é reusado, e não
//        recopiado, porque cópia de varredor diverge em silêncio e passa a provar coisa diferente
//        da que o caso afirma provar.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`. Para ESTE consumidor, só a segunda saída serve: a
//        primeira criaria a aresta `@syslocbr/contracts` → `@sysloc/db` que o caso proíbe.
// POR QUE NÃO AGORA: extrair o pacote de acessórios é trabalho de sete consumidores, alheio a esta
//        task, e o Protocolo Antirregressão veda refactor fora do escopo.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarFontesTs, varrerArquivos } from '../../db/test/varredura-de-fontes.ts';

/** A raiz deste pacote, derivada da posição deste arquivo. */
const RAIZ_DO_PACOTE = dirname(import.meta.dirname);

/** Os pacotes cujo alcance tornaria o contrato inútil para o frontend. */
const ESPECIFICADORES_PROIBIDOS = ['@sysloc/db', '@sysloc/api'] as const;

/** Os campos do manifesto em que uma dependência pode se esconder. */
const CAMPOS_DE_DEPENDENCIA = ['dependencies', 'peerDependencies', 'devDependencies'] as const;

/**
 * Casa o especificador proibido, com ou sem subcaminho, entre aspas simples ou duplas.
 *
 * Alcança `import … from`, `export … from` e `import(…)` de uma vez, porque o que discrimina é o
 * especificador entre aspas — e não a forma da declaração que o carrega.
 */
const IMPORTACOES_PROIBIDAS = ESPECIFICADORES_PROIBIDOS.map(
  (especificador) => new RegExp(`['"]${especificador}(/[^'"]*)?['"]`),
);

/**
 * Casa o caminho relativo que SAI do pacote (`../../`).
 *
 * `src/` tem um nível só, então `../` alcança a raiz do pacote e `../../` já está fora dele. É a
 * forma pela qual a aresta entraria sem passar pelo manifesto — e por isso o manifesto sozinho não
 * bastaria.
 */
const FUGA_DO_PACOTE = /['"]\.\.\/\.\.\//;

function casaImportacaoProibida(linha: string): boolean {
  return IMPORTACOES_PROIBIDAS.some((padrao) => padrao.test(linha)) || FUGA_DO_PACOTE.test(linha);
}

interface Manifesto {
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

describe('CT-339 — o pacote de contratos é folha', () => {
  it('nenhum fonte de src/ alcança @sysloc/db, @sysloc/api ou o lado de fora do pacote', async () => {
    // Diretório ausente LEVANTA (é o desenho de `listarFontesTs`): um `src/` renomeado reduziria a
    // varredura a zero arquivos, e o caso seguiria verde provando nada.
    const fontes = await listarFontesTs(join(RAIZ_DO_PACOTE, 'src'));

    const varredura = await varrerArquivos(fontes, casaImportacaoProibida);

    expect(varredura.ocorrencias).toEqual([]);
    // O zero nunca é escondido: sem esta linha, uma varredura que não leu arquivo algum passaria.
    expect(varredura.arquivos).toBeGreaterThan(0);
  });

  it('o manifesto não declara @sysloc/db nem @sysloc/api em nenhum campo de dependência', async () => {
    const manifesto = JSON.parse(
      await readFile(join(RAIZ_DO_PACOTE, 'package.json'), 'utf8'),
    ) as Manifesto;

    const declaradas = CAMPOS_DE_DEPENDENCIA.flatMap((campo) =>
      Object.keys(manifesto[campo] ?? {}),
    );

    // A contagem afirmada é a garantia de que os campos foram efetivamente lidos: o pacote declara
    // `zod` e as três ferramentas de verificação, e um manifesto que voltasse vazio passaria no
    // `not.toContain` sem examinar nada.
    expect(declaradas).toEqual(['zod', '@types/node', 'typescript', 'vitest']);
    for (const proibido of ESPECIFICADORES_PROIBIDOS) {
      expect(declaradas).not.toContain(proibido);
    }
  });
});
