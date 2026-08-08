-- Segurança do domínio de locação — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0005
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, pela mesma razão,
-- que não envelheceu: o gerador de migração declara `ENABLE ROW LEVEL SECURITY` (o `0005` o faz),
-- mas **não emite `FORCE ROW LEVEL SECURITY` nem política alguma** — a consequência que a ADR-0009
-- registra entre os Neutros.
--
-- As duas ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada — e é isso que o CT-301 falsifica, retirando o `FORCE`
--     de `negocio.imovel` e exigindo que a guarda de catálogo o acuse pelo nome;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura do `0005` sobrescreve
-- o que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não concede nada** — o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao" IN SCHEMA
--     "identidade", "negocio"` do `0001_seguranca.sql` já faz a concessão de TABELAS e de TIPOS
--     acompanhar a criação, e as seis tabelas e os três enums do `0005` são criados por aquele
--     papel. Repetir os `GRANT` aqui seria uma segunda escrita do mesmo fato, livre para divergir
--     da primeira;
--   * **não cria schema nem papel** — os dois vêm do provisionamento;
--   * **nenhum `ALTER ... OWNER`** — as tabelas nascem do papel de migração por consequência de ser
--     ele quem as cria.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas seis tabelas do domínio
-- ===========================================================================
--
-- `ENABLE` (no 0005) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
ALTER TABLE "negocio"."conjunto" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."imovel" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."comodo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."locador" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."locatario" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."fiador" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- ===========================================================================
-- 2. Políticas — a MESMA expressão em `USING` e em `WITH CHECK`
-- ===========================================================================
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`. Ela não é reinventada aqui, e o motivo é
-- o mesmo que faz o CT-007 reler a migração do disco em vez de recompor a política no teste: duas
-- redações do mesmo isolamento são livres para divergir, e a divergência não faz barulho — ela
-- aparece como uma tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado. Divergir as duas abriria o caso "enxerga só o seu, grava para o alheio",
-- que é a metade da ADR-0008 que trata da escrita.
--
-- O segundo argumento `true` de `current_setting` faz a função devolver NULO quando a variável não
-- foi fixada, em vez de levantar erro. `nullif(..., '')` trata o outro caminho, o da variável
-- fixada em cadeia vazia. Nos dois casos a comparação vira `empresa_id = NULL`, que não casa linha
-- nenhuma: **contexto ausente resulta em vazio, nunca em dado alheio** — que é o caso do Sysloc
-- Master (RN-04), provado pelo CT-302.
--
-- `FOR ALL` cobre os quatro verbos numa política só. Uma política por verbo multiplicaria por
-- quatro a superfície em que as duas expressões podem divergir sem que nada acuse.
CREATE POLICY "conjunto_isolamento_empresa"
	ON "negocio"."conjunto"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "imovel_isolamento_empresa"
	ON "negocio"."imovel"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "comodo_isolamento_empresa"
	ON "negocio"."comodo"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "locador_isolamento_empresa"
	ON "negocio"."locador"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "locatario_isolamento_empresa"
	ON "negocio"."locatario"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "fiador_isolamento_empresa"
	ON "negocio"."fiador"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
