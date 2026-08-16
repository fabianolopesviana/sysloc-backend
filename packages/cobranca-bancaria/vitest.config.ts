/**
 * Configuração de teste do pacote de domínio da cobrança bancária.
 *
 * Este arquivo é o projeto que a configuração da raiz agrega pelo padrão
 * `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/cobranca-bancaria test`
 * usa diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado. Sem ele,
 * o pacote novo (o sétimo do monorepo) ficaria de fora de `vitest` na raiz e a contagem por pacote
 * não o veria.
 *
 * Nenhum teto é alargado aqui, e a ausência é informação. A suíte desta task não atravessa fronteira
 * real alguma — ela lê os próprios fontes e os esquemas do contrato —, de modo que o padrão de 5 s
 * do arcabouço sobra. As suítes que atravessam `tls` chegam com a T9 e a T10, e cada uma declara o
 * próprio teto NO CASO, que é onde a fronteira existe. É deliberado: teto alargado aqui valeria para
 * todas, e o custo de uma suíte viraria licença global — folga que ninguém pediu é onde a lentidão de
 * amanhã se esconde.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui, pela mesma razão escrita nos irmãos. E
 * nenhum caso desta suíte alcança o provedor real — o que ela examina é vocabulário declarado.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/cobranca-bancaria',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
