/**
 * Configuração de teste da camada de dados.
 *
 * Este arquivo é o projeto que a configuração da raiz (`vitest.config.ts`, de T4 da F0) agrega
 * pelo padrão `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/db test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui. Cada caso sobe a própria instância efêmera
 * por `test/banco-efemero.ts`, que envolve o helper de `packages/shared/test/` sem alterá-lo. Uma
 * leitura de configuração de conexão neste arquivo bastaria para a suíte alcançar, em silêncio, o
 * ambiente que atende a operação.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/db',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Cada caso sobe instância real de banco, cria papéis e schemas e aplica as duas migrações; o
    // teto padrão de 5 s do arcabouço reprovaria a subida antes de ela terminar. O teto de CASO
    // fica no padrão de propósito: quem sobe instância declara o próprio limite, e afrouxá-lo aqui
    // só alargaria o teto dos casos que não precisam dele.
    hookTimeout: 90_000,
    // Descartar a instância efêmera é trabalho de encerramento: teto curto abortaria o descarte no
    // meio e deixaria processo e diretório de dados para trás.
    teardownTimeout: 60_000,
  },
});
