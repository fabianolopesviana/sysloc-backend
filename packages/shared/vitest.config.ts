/**
 * Configuração de teste do pacote compartilhado.
 *
 * Este arquivo é o projeto que a configuração da raiz (`vitest.config.ts`, nascida em T4)
 * agrega, e é também o que `pnpm --filter @sysloc/shared test` usa diretamente. Por isso ele
 * declara o ambiente de execução do pacote INTEIRO, e não apenas a diferença: as duas formas de
 * invocar a verificação — `vitest` na raiz e `turbo run test` por pacote — precisam produzir o
 * mesmo resultado, e só a segunda passa por aqui.
 *
 * O `globalSetup` é o item que a raiz não teria como declarar: ele compila este pacote, e um
 * pacote só sabe compilar a si mesmo. Ver o cabeçalho de `test/preparar-artefato.ts` para o
 * defeito que ele impede.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@sysloc/shared',
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Garante que `dist/` — que o CT-009 de T3 resolve pelo `exports` do manifesto —
    // corresponde ao `src/` desta execução, inclusive quando a suíte é invocada fora do script
    // `test`.
    globalSetup: ['./test/preparar-artefato.ts'],
    // Os casos de T4 sobem instância real de banco e de fila; o teto padrão de 5 s do arcabouço
    // reprovaria a subida antes de ela terminar. O teto de CASO fica no padrão de propósito: os
    // oito casos de `ambiente-efemero.spec.ts` declaram o próprio limite, um por um, e afrouxá-lo
    // aqui só alargaria o teto dos casos que não precisam dele — um caso travado passaria a levar
    // 90 s para reprovar em vez de 5 s, sem que nada ganhasse com isso.
    hookTimeout: 90_000,
    // Descartar as instâncias efêmeras é trabalho de encerramento: teto curto aqui abortaria o
    // descarte no meio e deixaria exatamente o resíduo que a CA-7 proíbe.
    teardownTimeout: 60_000,
  },
});
