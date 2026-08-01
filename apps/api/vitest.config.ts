/**
 * Configuração de teste do serviço de aplicação.
 *
 * Este arquivo é o projeto que a configuração da raiz (`vitest.config.ts`, de T4) agrega pelo
 * padrão `apps/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/api test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui. A verificação sobe instâncias efêmeras
 * próprias de banco e de fila (`packages/shared/test/`) e monta o ambiente do processo a partir
 * do que os helpers devolvem — uma leitura de configuração de conexão neste arquivo bastaria
 * para a suíte alcançar, em silêncio, o ambiente que atende a operação.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O transformador do arcabouço deduz as opções de TypeScript do `tsconfig.json` que ALCANÇA
  // cada arquivo, e o deste pacote alcança apenas `src/` — é ele que emite o serviço, e alargá-lo
  // faria `dist/` levar junto o código de teste. A consequência é que um decorador escrito dentro
  // de `test/` (o controlador-fixture que provoca a exceção não prevista do CT-006) chegaria ao
  // runtime sem transformação, e o processo falharia com erro de sintaxe. Declarar aqui a forma de
  // decorador que o projeto usa resolve para os arquivos de verificação sem tocar no que é emitido.
  oxc: { decorator: { legacy: true } },
  test: {
    name: '@sysloc/api',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Os casos de rota sobem instância real de banco e de fila; o teto padrão de 5 s do arcabouço
    // reprovaria a subida antes de ela terminar. O teto de CASO fica no padrão de propósito: cada
    // caso que sobe instância declara o próprio limite, e afrouxá-lo aqui só alargaria o teto dos
    // casos que não precisam dele.
    hookTimeout: 90_000,
    // Descartar as instâncias efêmeras é trabalho de encerramento: teto curto abortaria o descarte
    // no meio e deixaria exatamente o resíduo que a CA-7 proíbe.
    teardownTimeout: 60_000,
  },
});
