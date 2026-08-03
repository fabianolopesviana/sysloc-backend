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
    // -----------------------------------------------------------------------------------------
    // Segredo de assinatura de sessão do PROCESSO DE VERIFICAÇÃO (T8)
    // -----------------------------------------------------------------------------------------
    //
    // A partir da T8 a validação de partida exige `BETTER_AUTH_SECRET`, e todo caso que sobe a
    // aplicação real passa por ela. Ele é declarado AQUI, e não em cada arquivo de verificação, por
    // uma razão de disciplina: `test/saude.e2e.spec.ts` é a prova das rotas de saúde e da ADR-0007
    // e não tem nada a ver com identidade — acrescentar a variável ao arranjo dele seria editar,
    // por causa desta task, um arquivo que a task declara intocável.
    //
    // O valor é literal e ostensivamente inútil: ele assina sessões que morrem com a instância
    // efêmera do caso. Isto NÃO enfraquece a exigência — quem prova que a variável é obrigatória é
    // `test/ambiente.spec.ts`, que chama a validação com a fonte de variáveis por PARÂMETRO e
    // demonstra a falha por ausência e por valor curto demais, sem depender do ambiente do
    // processo. E não fere a ADR-0006: nada aqui é coordenada de conexão, e nada é lido do
    // ambiente — o valor é fixado, não herdado.
    env: {
      BETTER_AUTH_SECRET: 'segredo-de-verificacao-sem-valor-operacional',
    },
  },
});
