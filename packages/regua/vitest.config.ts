/**
 * Configuração de teste do pacote de domínio da régua.
 *
 * Este arquivo é o projeto que a configuração da raiz agrega pelo padrão
 * `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/regua test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado.
 *
 * Nenhum teto é alargado aqui, e a ausência é informação: o domínio não abre banco, não fala com
 * SMTP e não lê relógio (ADR-0025 e ADR-0026), de modo que esta suíte não atravessa fronteira real
 * alguma — o padrão de 5 s do arcabouço sobra. O dia em que um teto precisar subir neste arquivo é
 * o dia em que o pacote passou a conhecer algo que ele existe para não conhecer.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui, pela mesma razão escrita nos irmãos.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/regua',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
