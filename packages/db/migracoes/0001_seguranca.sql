-- Migração de segurança — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0000
-- ---------------------------------------------------------------------------
--
-- O gerador de migração declara `ENABLE ROW LEVEL SECURITY` (o 0000 o faz), mas **não emite
-- `FORCE ROW LEVEL SECURITY` nem concessão nenhuma** — é a consequência que a ADR-0009 registra
-- entre os Neutros. As duas ausências são exatamente as que fariam o isolamento existir só no
-- papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem `GRANT`, o papel da aplicação não alcança tabela alguma, e o processo não sobe.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não cria schema** — `identidade` e `negocio` vêm do provisionamento, com dono
--     `sysloc_migracao`;
--   * **não cria papel** — `sysloc_migracao` e `sysloc_app` vêm do provisionamento, que é quem tem
--     privilégio administrativo na instância;
--   * **nenhum `ALTER ... OWNER`** — as tabelas nascem do migrador por consequência de ele ser
--     quem as cria. Transferir propriedade exigiria que quem executa pertencesse ao papel de
--     destino, e esse pertencimento é justamente o que o CT-001 prova NÃO existir.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas tabelas de negócio
-- ===========================================================================
--
-- `ENABLE` (no 0000) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
ALTER TABLE "negocio"."acesso_usuario_app" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_permissao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- ===========================================================================
-- 2. Políticas — a MESMA expressão em `USING` e em `WITH CHECK`
-- ===========================================================================
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado. Divergir as duas abriria o caso "enxerga só o seu, grava para o alheio",
-- que é a metade da ADR-0008 que trata da escrita.
--
-- O segundo argumento `true` de `current_setting` faz a função devolver NULO quando a variável não
-- foi fixada, em vez de levantar erro. `nullif(..., '')` trata o outro caminho, o da variável
-- fixada em cadeia vazia. Nos dois casos a comparação vira `empresa_id = NULL`, que não casa linha
-- nenhuma: **contexto ausente resulta em vazio, nunca em dado alheio** — que é o caso do Sysloc
-- Master (RN-04).
--
-- `FOR ALL` cobre os quatro verbos numa política só. Uma política por verbo multiplicaria por
-- quatro a superfície em que as duas expressões podem divergir sem que nada acuse.
CREATE POLICY "acesso_usuario_app_isolamento_empresa"
	ON "negocio"."acesso_usuario_app"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "acesso_usuario_permissao_isolamento_empresa"
	ON "negocio"."acesso_usuario_permissao"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 3. Retirada do que é concedido por omissão
-- ===========================================================================
--
-- O PostgreSQL não concede privilégio de TABELA a `PUBLIC` por omissão, então a primeira linha não
-- retira nada hoje. Ela existe porque `PUBLIC` alcança TODO papel do agrupamento, presente e
-- futuro: uma concessão feita por engano em operação abriria as duas classes de tabela para
-- qualquer papel que conseguisse conectar, e a RLS de `negocio` não cobriria `identidade`, que não
-- tem política nenhuma por decisão da ADR-0009. O custo é uma linha; a alternativa é depender de
-- que ninguém conceda.
REVOKE ALL ON ALL TABLES IN SCHEMA "identidade", "negocio" FROM PUBLIC;--> statement-breakpoint
-- Esta segunda, sim, retira algo: o provisionamento cria os schemas, e retirar de `PUBLIC` o
-- alcance a eles é o que faz a concessão nominal do bloco 4 ser a ÚNICA porta de entrada.
REVOKE ALL ON SCHEMA "identidade", "negocio" FROM PUBLIC;--> statement-breakpoint

-- ===========================================================================
-- 4. Concessões ao papel da aplicação
-- ===========================================================================
--
-- O papel da aplicação lê e escreve; ele **não** recebe privilégio de estrutura (`CREATE`,
-- `TRUNCATE`, `REFERENCES`) e não é dono de nada. É essa combinação — mais o `FORCE` do bloco 1 —
-- que faz a política valer para ele sem exceção.
--
-- `USAGE` no schema é o que permite alcançar os objetos: sem ele a concessão de tabela não é
-- utilizável. `USAGE` no tipo enumerado é exigido para gravar valor em coluna do tipo.
GRANT USAGE ON SCHEMA "identidade", "negocio" TO "sysloc_app";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "identidade", "negocio" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "identidade"."perfil_usuario" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "identidade"."desfecho_tentativa" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."tipo_permissao" TO "sysloc_app";--> statement-breakpoint

-- Tabela criada por uma migração FUTURA nasceria sem concessão alguma, e o serviço quebraria na
-- primeira consulta a ela — falha tardia, longe da causa. Esta declaração faz a concessão
-- acompanhar a criação, e vale apenas para objetos criados PELO papel de migração, que é quem cria
-- objeto neste banco. Ela não substitui a concessão explícita acima: `ALTER DEFAULT PRIVILEGES`
-- não alcança o que já existe.
ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao" IN SCHEMA "identidade", "negocio"
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "sysloc_app";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao" IN SCHEMA "identidade", "negocio"
	GRANT USAGE ON TYPES TO "sysloc_app";
