/**
 * Composição da instância de autenticação — CT-1203.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT      | Invariante |
 * |----------|---------|------------|
 * | —        | CT-1203 | **Todo** ponto do repositório que compõe uma instância de autenticação
 * |          |         | nomeia `origensPublicas`. O campo é obrigatório e sem valor padrão, e
 * |          |         | omiti-lo não falha na construção: falha no uso, com
 * |          |         | `opcoes.origensPublicas is not iterable`. |
 *
 * Rastreabilidade: rede antirregressão de correção dirigida (2026-08-31) — não há CA de fatia.
 *
 * ---------------------------------------------------------------------------
 * Por que a asserção varre o REPOSITÓRIO, e não confere um arquivo
 * ---------------------------------------------------------------------------
 *
 * O defeito que a motiva foi medido: `criarAutenticacao` ganhou `origensPublicas` como campo
 * obrigatório no commit `9d96bf7` (T7 da fatia `publicacao-e-backup`), e dos três pontos de
 * composição existentes **um não acompanhou** — `deploy/scripts/instalacao/criar-sysloc-master.mjs`,
 * criado em `fdd2b91`. Ele é o caminho de recuperação do primeiro `SYSLOC_MASTER` de uma base nova,
 * de modo que a falha só apareceria no dia em que ninguém consegue entrar no produto.
 *
 * **O compilador não pega, e é por isso que a suíte precisa pegar.** O script é `.mjs`: ele não
 * entra em `tsc --build`, e o campo faltando atravessa a construção inteira sem uma palavra. Uma
 * asserção sobre aquele arquivo fecharia a ocorrência; a varredura fecha a classe, porque alcança
 * também o ponto de composição que ainda não existe.
 *
 * A extensão varrida inclui `.mjs` e `.js` justamente por isso — restringir a `.ts` reproduziria
 * no teste exatamente o ponto cego que ele existe para cobrir.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** A raiz do monorepo, a partir deste arquivo (`packages/auth/test/`). */
const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));

/** Onde pontos de composição podem morar. `docs/` não executa; `node_modules` não é nosso. */
const ARVORES = ['apps', 'packages', 'deploy'];

/** Diretórios que não se varre. `dist` é saída de build e ESPELHA o fonte — contaria duas vezes. */
const IGNORADOS = new Set(['node_modules', 'dist', '.git', '.turbo', 'coverage']);

const EXTENSOES = ['.ts', '.mjs', '.js'];

/** A chamada, e não a declaração: `export function criarAutenticacao` não é ponto de composição. */
const CHAMADA = 'criarAutenticacao({';
const CAMPO_OBRIGATORIO = 'origensPublicas';

function* arquivosDe(raiz: string): Generator<string> {
  for (const entrada of readdirSync(raiz)) {
    if (IGNORADOS.has(entrada)) continue;
    const caminho = join(raiz, entrada);
    if (statSync(caminho).isDirectory()) yield* arquivosDe(caminho);
    else if (EXTENSOES.some((extensao) => caminho.endsWith(extensao))) yield caminho;
  }
}

/**
 * O bloco de argumentos de cada chamada, e **não** o arquivo inteiro.
 *
 * ⚠️ A distinção é o caso — e ela nasceu de um mutante que sobreviveu. A primeira versão desta
 * suíte procurava o campo em qualquer ponto do arquivo, e por isso **não discriminava**: retirar
 * `origensPublicas` da chamada deixava o teste verde, porque o nome seguia escrito na guarda de
 * ausência, poucas linhas acima. Era o antipadrão que a §7 do Protocolo Antirregressão nomeia —
 * *"provou-se o que era fácil provar"*. Contar as chaves resolve: o que se afirma é o que a chamada
 * recebe.
 */
function blocosDeArgumento(fonte: string): string[] {
  const blocos: string[] = [];
  let procurarDe = 0;

  for (;;) {
    const inicio = fonte.indexOf(CHAMADA, procurarDe);
    if (inicio === -1) return blocos;

    // A `{` do objeto literal é a última do marcador; daí em diante conta-se até fechar.
    let profundidade = 0;
    let posicao = inicio + CHAMADA.length - 1;
    for (; posicao < fonte.length; posicao += 1) {
      if (fonte[posicao] === '{') profundidade += 1;
      else if (fonte[posicao] === '}') {
        profundidade -= 1;
        if (profundidade === 0) break;
      }
    }

    blocos.push(fonte.slice(inicio, posicao + 1));
    procurarDe = posicao + 1;
  }
}

function pontosDeComposicao(): { caminho: string; blocos: string[] }[] {
  const achados: { caminho: string; blocos: string[] }[] = [];
  for (const arvore of ARVORES) {
    for (const caminho of arquivosDe(join(RAIZ, arvore))) {
      const fonte = readFileSync(caminho, 'utf8');
      if (!fonte.includes(CHAMADA)) continue;
      achados.push({ caminho: relative(RAIZ, caminho), blocos: blocosDeArgumento(fonte) });
    }
  }
  return achados;
}

describe('CT-1203 · composição da instância de autenticação', () => {
  it('a varredura encontra os pontos de composição conhecidos (controle antivácuo)', () => {
    const caminhos = pontosDeComposicao().map((ponto) => ponto.caminho);

    // Sem este controle, uma varredura quebrada — raiz errada, extensão de menos — devolveria lista
    // vazia e o caso seguinte passaria por vacuidade, afirmando nada sobre nenhum arquivo.
    expect(caminhos).toEqual(
      expect.arrayContaining([
        'apps/api/src/autenticacao/autenticacao.module.ts',
        'packages/auth/test/identidade-efemera.ts',
        'deploy/scripts/instalacao/criar-sysloc-master.mjs',
      ]),
    );
  });

  it('todo ponto de composição nomeia `origensPublicas`', () => {
    const pontos = pontosDeComposicao();

    // Cada chamada é conferida em separado: um arquivo com duas composições, uma correta e uma
    // esquecida, tem de reprovar — e reprovaria por vacuidade se o filtro olhasse só a primeira.
    const todosOsBlocos = pontos.flatMap((ponto) => ponto.blocos);
    expect(todosOsBlocos.length).toBeGreaterThanOrEqual(pontos.length);

    const semOCampo = pontos
      .filter((ponto) => ponto.blocos.some((bloco) => !bloco.includes(CAMPO_OBRIGATORIO)))
      .map((ponto) => ponto.caminho);

    expect(semOCampo).toEqual([]);
  });
});
