/**
 * Configuração do gerador de migração.
 *
 * Ele é usado APENAS para gerar SQL a partir do schema declarado (`pnpm --filter @sysloc/db
 * gerar-migracao`), nunca para aplicar migração: quem aplica é `deploy/scripts/instalacao/
 * migrar-banco.sh` em operação, e `test/banco-efemero.ts` na verificação — os dois lendo os
 * mesmos arquivos de `migracoes/`.
 *
 * Por isso NÃO existe aqui o bloco `dbCredentials`, e nenhuma coordenada de conexão é lida do
 * ambiente. A ausência é deliberada e tem duas razões que se somam:
 *
 *   1. **ADR-0006** — o gerador que soubesse conectar seria mais um caminho pelo qual a atividade
 *      de desenvolvimento alcança o ambiente que atende a operação. Ele não precisa disso:
 *      `drizzle-kit generate` compara o schema declarado com o histórico em `migracoes/meta/`,
 *      inteiramente fora de linha.
 *   2. **§7.3 da tech spec** — a migração é aplicada pelo papel `sysloc_migracao`, cuja credencial
 *      trafega por `PGPASSFILE` no script de operação (ADR-0005). Declará-la aqui a colocaria numa
 *      variável de ambiente do processo de desenvolvimento, que é exatamente o transporte que a
 *      ADR-0005 proíbe.
 *
 * ---------------------------------------------------------------------------
 * Antes de regerar: `pnpm build` é PRÉ-CONDIÇÃO (desde a T2 da fatia de cadastro)
 * ---------------------------------------------------------------------------
 *
 * `src/esquema/negocio.ts` importa os literais dos enums de `@sysloc/contracts`, cujo `exports`
 * resolve para `dist/` — que o `.gitignore` barra. Em árvore limpa,
 * `pnpm --filter @sysloc/db gerar-migracao` **falha na resolução do módulo**.
 *
 * O `references` do `tsconfig.json` daqui não salva: ele governa `tsc --build` e a suíte, e o
 * drizzle-kit não o consulta. O Turborepo também não, porque `gerar-migracao` **não é tarefa
 * declarada** em `turbo.json` (lá existem apenas `build`, `test` e `lint`) e portanto não tem grafo
 * de dependência a resolver. Rode `pnpm build` na raiz antes, e a falha não acontece.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO se "corrige" à mão na saída do gerador
 * ---------------------------------------------------------------------------
 *
 * A restrição de verificação de `negocio.comodo` sai **totalmente qualificada**:
 * `CHECK ("negocio"."comodo"."metragem" >= 0)`. É a forma que o drizzle-kit emite quando a
 * expressão interpola a coluna, o PostgreSQL a aceita dentro do `CREATE TABLE` (o nome resolve para
 * a tabela em criação), e ela está aplicada e provada na `0005_dominio_locacao.sql`.
 *
 * **Não a encurte para `CHECK (metragem >= 0)`.** O gerador voltaria a emitir a forma qualificada na
 * regeração seguinte, e o diff entre o arquivo versionado e a saída do gerador viraria ruído
 * permanente — o mesmo tipo de divergência silenciosa que a supressão manual dos `CREATE SCHEMA`,
 * logo abaixo, obriga a refazer de propósito e por escrito.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/esquema/*.ts',
  out: './migracoes',
  // O que esta linha faz: restringe a `identidade` e `negocio` os schemas do PostgreSQL que o
  // drizzle-kit INTROSPECTA nos comandos `pull` e `push` — o padrão dele é considerar apenas
  // `public`, que aqui não guarda objeto nenhum. É o que a documentação do próprio pacote declara
  // (`drizzle-kit/index.d.ts`, verbete `schemaFilter`).
  //
  // O que ela NÃO faz — e a afirmação contrária já esteve escrita aqui: ela não suprime linha
  // alguma da saída de `generate`. Verificado nesta task: uma geração DO ZERO (diretório de saída
  // vazio) com esta linha intacta emite `CREATE SCHEMA "identidade"` e `CREATE SCHEMA "negocio"`
  // assim mesmo, e o SQL produzido é byte a byte idêntico ao gerado sem ela. Faz sentido: o
  // `generate` é inteiramente fora de linha e não introspecta banco nenhum.
  //
  // Por isso a supressão dos dois `CREATE SCHEMA` é MANUAL e OBRIGATÓRIA a cada regeração do zero.
  // Os schemas nascem do provisionamento (`deploy/scripts/instalacao/provisionar-base.sh`), com
  // dono `sysloc_migracao`; criá-los na migração exigiria conceder ao migrador o privilégio
  // `CREATE` sobre o banco — poder maior do que a tarefa pede (§7.3 da tech spec). O cabeçalho de
  // `migracoes/0000_fundacao.sql` registra a remoção e diz o mesmo; quem regenerar tem de removê-
  // las de novo, e `deploy/scripts/instalacao/verificar-migracao.sh` (T5) é o que reprova se elas
  // voltarem. Uma geração INCREMENTAL não as reemite, porque `migracoes/meta/0000_snapshot.json`
  // já registra os dois schemas como existentes.
  //
  // ---------------------------------------------------------------------------
  // Por que `plataforma` NÃO está nesta lista — e o que muda quando ele tiver tabela
  // ---------------------------------------------------------------------------
  //
  // O terceiro schema do produto (`plataforma`, criado pelo provisionamento e povoado pela
  // `0016_seguranca_bancaria.sql`) fica de fora **de propósito**, e não por esquecimento: hoje ele
  // guarda apenas a sequência do identificador perante o provedor e as duas funções que a cercam,
  // objetos que vivem só em migração autoral. **Nenhum objeto de `plataforma` é declarado no
  // Drizzle**, de modo que não há o que introspectar nem o que comparar — pôr o nome aqui não
  // acrescentaria nada e sugeriria, falsamente, que o gerador governa aquele schema.
  //
  // ⚠️ O que muda quando a PRIMEIRA tabela de `plataforma` for declarada no Drizzle (a notificação
  // crua do provedor, prevista para a fatia (iii)): como nenhum snapshot anterior registra o schema
  // — medido, `meta/0000_snapshot.json` e `meta/0015_snapshot.json` não contêm a cadeia
  // `plataforma` —, o gerador **proporá `CREATE SCHEMA "plataforma"`** já na primeira geração
  // incremental, e a supressão manual descrita acima volta a ser obrigatória naquele arquivo.
  //
  // ⚠️ E acrescentar `plataforma` a esta lista **não** evita isso: como a medição acima registra,
  // `schemaFilter` não suprime linha alguma da saída de `generate` — ele restringe a introspecção de
  // `pull`/`push`. A correção intuitiva é a errada; a correta continua sendo remover o
  // `CREATE SCHEMA` à mão, com `verificar-migracao.sh` (asserção `(e)`) reprovando se ele voltar.
  schemaFilter: ['identidade', 'negocio'],
  verbose: true,
  strict: true,
});
