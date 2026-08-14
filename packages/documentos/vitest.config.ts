/**
 * Configuração de teste do pacote de domínio do documento.
 *
 * Este arquivo é o projeto que a configuração da raiz agrega pelo padrão
 * `packages/*​/vitest.config.ts`, e é também o que `pnpm --filter @sysloc/documentos test` usa
 * diretamente. Por isso ele declara o ambiente de execução do pacote INTEIRO, e não apenas a
 * diferença — as duas formas de invocar a verificação precisam produzir o mesmo resultado. Sem ele,
 * o pacote novo ficaria de fora de `vitest` na raiz e a contagem por pacote não o veria.
 *
 * Nenhum teto é alargado aqui, e a ausência é informação. Quatro das cinco suítes não atravessam
 * fronteira real alguma — não abrem banco, não falam com SMTP (ADR-0025) e recebem o instante já
 * resolvido —, de modo que o padrão de 5 s do arcabouço sobra para elas. A quinta atravessa
 * `filesystem`, porque renderiza o PDF de fato, e declara o próprio teto NO CASO
 * (`TETO_DA_RENDERIZACAO`, em `test/renderizador-pdf.spec.ts`), que é onde a fronteira existe.
 * É deliberado: teto alargado aqui valeria para as cinco, e o custo de uma suíte viraria licença
 * global — folga que ninguém pediu é onde a lentidão de amanhã se esconde.
 *
 * ADR-0006: nenhuma coordenada de conexão é lida aqui, pela mesma razão escrita nos irmãos.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/documentos',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
  },
});
