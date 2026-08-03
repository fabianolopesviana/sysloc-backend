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
  schemaFilter: ['identidade', 'negocio'],
  verbose: true,
  strict: true,
});
