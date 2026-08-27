/**
 * Configuração de teste do pacote de contratos.
 *
 * Este arquivo é o projeto que a configuração da raiz agrega pelo padrão
 * `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @syslocbr/contracts test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * Nenhum teto é alargado aqui, e a ausência é informação: os esquemas são funções puras e a única
 * fronteira real que esta suíte atravessa é o filesystem (CT-339, que lê o fonte do pacote). Sem
 * banco, sem fila, sem HTTP — o padrão de 5 s do arcabouço sobra.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui, pela mesma razão escrita nos irmãos.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@syslocbr/contracts',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
