/**
 * Configuração de teste do processador de trabalho.
 *
 * Este arquivo é o projeto que a configuração da raiz (`vitest.config.ts`, de T4) agrega pelo
 * padrão `apps/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/worker test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui. A verificação sobe a sua própria instância
 * efêmera de fila (`packages/shared/test/redis-efemero.ts`) e conecta o processador ao que o
 * helper devolve — uma leitura de `REDIS_URL` neste arquivo bastaria para a suíte alcançar, em
 * silêncio, o servidor de fila que atende a operação.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/worker',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Os casos sobem instância real de fila, e um deles a derruba e religa no meio; o teto padrão
    // de 5 s do arcabouço reprovaria a subida antes de ela terminar. O teto de CASO fica no padrão
    // de propósito: cada caso que sobe instância declara o próprio limite, e afrouxá-lo aqui só
    // alargaria o teto dos casos que não precisam dele.
    hookTimeout: 90_000,
    // Descartar a instância efêmera é trabalho de encerramento: teto curto abortaria o descarte no
    // meio e deixaria exatamente o resíduo que a CA-7 proíbe.
    teardownTimeout: 60_000,
  },
});
