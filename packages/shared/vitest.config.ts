/**
 * Configuração de teste do pacote compartilhado.
 *
 * Mínima e local de propósito: a configuração agregada do workspace (`vitest.config.ts` da
 * raiz) nasce em T4, junto das instâncias efêmeras de banco e fila que ela precisa orquestrar.
 * Até lá cada pacote executa a própria suíte, e `turbo run test` as agrega.
 *
 * **Destino deste arquivo** (`.claude/rules/testing-stack.md` manda "config na raiz"): quando
 * a config da raiz nascer em T4, este arquivo **é absorvido e removido** — `environment` e
 * `include` são idênticos ao que a raiz vai declarar para todo pacote. O que NÃO é absorvível
 * é o `globalSetup`: ele compila este pacote, e um pacote só sabe compilar a si mesmo. Se em
 * T4 a raiz não oferecer forma de declarar preparação por pacote, este arquivo sobrevive
 * reduzido a essa única linha.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    // Garante que `dist/` — que CT-009 resolve pelo `exports` do manifesto — corresponde ao
    // `src/` desta execução, inclusive quando a suíte é invocada fora do script `test`.
    globalSetup: ['./test/preparar-artefato.ts'],
  },
});
