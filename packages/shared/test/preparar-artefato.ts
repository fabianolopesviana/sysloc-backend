/**
 * Preparação global da suíte: reconstrói `dist/` antes de qualquer caso rodar.
 *
 * CT-009 resolve o pacote pelo **especificador público** (`@sysloc/shared`), e o campo
 * `exports` do manifesto aponta para `dist/`. Sem esta preparação, a atualidade do artefato
 * ficava garantida apenas pelo encadeamento `tsc --build &&` do script `test`: quem
 * invocasse a suíte por caminho não-canônico — `npx vitest run`, `--watch`, o executor da
 * IDE — exercitaria o `dist/` da compilação anterior, e um símbolo removido de `src/`
 * continuaria "exposto", deixando o caso verde por artefato velho.
 *
 * O compilador é localizado a partir do **manifesto** resolvido do pacote `typescript`: o
 * `exports` dele não publica `./bin/tsc`, mas publica `./package.json`, e o diretório do
 * manifesto é a raiz do pacote por definição. Derivar dali não depende de layout de
 * `node_modules`, do `PATH` de quem invocou, nem de onde o `main`/`exports` aponta — esta
 * última suposição era a frágil: subir dois níveis a partir do ponto de entrada só acerta
 * enquanto o pacote publicar o `main` exatamente um diretório abaixo da raiz.
 */

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const executar = promisify(execFile);
const exigir = createRequire(import.meta.url);

const RAIZ_DO_TYPESCRIPT = dirname(exigir.resolve('typescript/package.json'));
const COMPILADOR = join(RAIZ_DO_TYPESCRIPT, 'bin', 'tsc');
const RAIZ_DO_PACOTE = dirname(import.meta.dirname);

export async function setup(): Promise<void> {
  await executar(process.execPath, [COMPILADOR, '--build'], { cwd: RAIZ_DO_PACOTE });
}
