/**
 * Configuração da verificação automatizada do monorepo — T4 da fatia `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo decide (e o que ele deliberadamente NÃO decide)
 * ---------------------------------------------------------------------------
 *
 * Ele declara **quem participa** da verificação: cada pacote do workspace com configuração
 * própria vira um projeto desta execução, e `vitest` invocado na raiz roda todos eles de uma
 * vez. É o ponto de entrada único de "verificar o repositório inteiro".
 *
 * Ele NÃO redeclara o ambiente de execução de cada pacote. Essa decisão fica no
 * `vitest.config.ts` do próprio pacote, por uma razão concreta: parte dela é conhecimento que
 * só o pacote tem — `packages/shared` precisa compilar o próprio artefato antes do primeiro
 * caso rodar, porque um dos seus casos resolve o pacote pelo especificador público e cairia em
 * `dist/` obsoleto sem essa preparação. Centralizar isto aqui obrigaria a raiz a saber como
 * cada pacote se prepara.
 *
 * A consequência prática é que as duas formas de invocar a verificação produzem o MESMO
 * resultado: `pnpm test` (que é `turbo run test`, e executa o script `test` de cada pacote, com
 * a configuração local) e `vitest` na raiz (que carrega os projetos declarados abaixo). Se o
 * ambiente estivesse declarado aqui, o primeiro caminho rodaria sem ele.
 *
 * ---------------------------------------------------------------------------
 * ADR-0006
 * ---------------------------------------------------------------------------
 *
 * Nenhuma coordenada de conexão é lida aqui — nem para preencher valor padrão, nem para
 * escolher instância. A verificação sobe instâncias efêmeras próprias de banco e de fila
 * (`packages/shared/test/{postgres,redis}-efemero.ts`), e é assim que a suíte nunca alcança o
 * ambiente que atende a operação. Uma leitura de `DATABASE_URL` neste arquivo bastaria para
 * desfazer isso em silêncio.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // O padrão aponta para o ARQUIVO de configuração de cada pacote, e não para o diretório:
    // `packages/*` casaria também com `packages/.gitkeep`, e o arcabouço recusa a execução
    // inteira quando um projeto declarado não é um diretório com configuração. `apps/*` ainda
    // não tem pacote — o serviço de aplicação e o processador chegam em T5 e T6 —, e um padrão
    // sem correspondência é tolerado; declará-lo agora evita uma edição de configuração
    // escondida no meio daquelas tasks.
    projects: ['packages/*/vitest.config.ts', 'apps/*/vitest.config.ts'],

    // -----------------------------------------------------------------------------------------
    // Cobertura — INFORMATIVA, e nunca bloqueante
    // -----------------------------------------------------------------------------------------
    //
    // Mora aqui, e não no `vitest.config.ts` de cada pacote, porque com `projects` a cobertura é
    // opção de RAIZ: declarada num projeto, ela é ignorada. É também o que dá um relatório único
    // em vez de nove parciais que ninguém soma.
    //
    // Ela NÃO entra no script `test` de nenhum pacote, de propósito. `pnpm test` é a baseline que
    // o Protocolo Antirregressão manda comparar antes e depois de cada edição; pendurar a
    // instrumentação nela mudaria o custo e o comportamento do comando que existe para não mudar.
    // A medição tem comando próprio: `pnpm coverage`.
    //
    // Não há `thresholds`, e a ausência é a decisão — não um esquecimento. A
    // `.claude/rules/testing-stack.md` fixa que o gate julga por rastreabilidade `CA → CT` e
    // qualidade de asserção; um piso de porcentagem aqui reintroduziria pela configuração o
    // critério que a rule recusou por medição.
    coverage: {
      provider: 'v8',
      // `text` para quem está no terminal, `html` para quem quer navegar arquivo a arquivo.
      reporter: ['text', 'html'],
      // Denominador honesto: sem isto, um arquivo que NENHUM caso importa fica fora da conta e o
      // número sobe justamente por causa do que não é testado — que é o modo de mentir que a rule
      // adverte. Com `all`, o arquivo sem teste aparece com 0%.
      all: true,
      // Só fonte de produção. `dist/` é build (espelharia o fonte e contaria duas vezes), `test/`
      // é o instrumento de medida, e configuração não é comportamento.
      include: ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['**/dist/**', '**/node_modules/**', '**/*.config.ts', '**/*.d.ts'],
    },
  },
});
