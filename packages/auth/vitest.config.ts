/**
 * Configuração de teste da camada de identidade.
 *
 * Este arquivo é o projeto que a configuração da raiz agrega pelo padrão
 * `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/auth test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui. Os casos de integração sobem a própria
 * instância efêmera por `packages/db/test/banco-efemero.ts`, que envolve o helper de
 * `packages/shared/test/` sem alterá-lo.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/auth',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Os casos de integração sobem instância real de banco, criam papéis e schemas e aplicam as
    // duas migrações; o teto padrão de 5 s do arcabouço reprovaria a subida antes de ela terminar.
    hookTimeout: 90_000,
    // Descartar a instância efêmera é trabalho de encerramento: teto curto abortaria o descarte no
    // meio e deixaria processo e diretório de dados para trás.
    teardownTimeout: 60_000,
    // A derivação de senha do arcabouço é `scrypt` — deliberadamente cara (§12.1: a latência da
    // entrada é dominada por ela). O CT-015 executa sete entradas reais em sequência, e o teto
    // padrão de 5 s por caso não as acomoda.
    testTimeout: 120_000,
  },
});
