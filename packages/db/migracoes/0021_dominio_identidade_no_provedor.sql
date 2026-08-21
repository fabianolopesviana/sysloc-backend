-- Domínio da identidade no provedor — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes).
--
-- UMA intervenção à mão sobre a saída do gerador, a do padrão de `0002`, `0003`, `0005`, `0007`,
-- `0009`, `0011`, `0013`, `0015`, `0017` e `0019`: o nome do arquivo e o `tag` de
-- `meta/_journal.json` foram trocados pelo nome descritivo — o gerador sorteia um nome sem
-- significado (`0021_cooing_ezekiel_stane`). **Nenhuma instrução foi editada ou reordenada.**
--
-- ⚠️ **Não há instrução AUTORAL neste arquivo, e a ausência é a decisão** (a regra que as irmãs
-- enunciam: gerado e autoral nunca convivem no mesmo arquivo). A RLS desta tabela — `FORCE` e a
-- política de isolamento — vive na parceira `0022_seguranca_identidade_no_provedor.sql`.
--
-- O `ENABLE ROW LEVEL SECURITY` abaixo é do GERADOR, e vem do `.enableRLS()` do esquema; ele
-- habilita, mas **não** força nem cria política. Sem a parceira, a tabela fica sem política alguma
-- e o dono do schema a lê inteira.
--
-- Por que a identidade é tabela própria, e não colunas do certificado: ver o docblock de
-- `identidadeNoProvedor` em `src/esquema/negocio.ts` (ciclos de vida distintos).

CREATE TABLE "negocio"."identidade_no_provedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"identificador_da_aplicacao_cifrado" text,
	"numero_do_cliente" integer NOT NULL,
	"numero_da_conta_corrente" integer NOT NULL,
	"codigo_da_modalidade" integer NOT NULL,
	"registrado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"substituida_em" timestamp with time zone,
	CONSTRAINT "identidade_no_provedor_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "identidade_no_provedor_segredo_chk" CHECK (("negocio"."identidade_no_provedor"."identificador_da_aplicacao_cifrado" IS NULL) = ("negocio"."identidade_no_provedor"."substituida_em" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."identidade_no_provedor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."identidade_no_provedor" ADD CONSTRAINT "identidade_no_provedor_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."identidade_no_provedor" ADD CONSTRAINT "identidade_no_provedor_usuario_empresa_fkey" FOREIGN KEY ("registrado_por","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identidade_no_provedor_vigente_uidx" ON "negocio"."identidade_no_provedor" USING btree ("empresa_id") WHERE substituida_em IS NULL;--> statement-breakpoint
CREATE INDEX "identidade_no_provedor_historico_idx" ON "negocio"."identidade_no_provedor" USING btree ("empresa_id","criado_em" DESC NULLS LAST);