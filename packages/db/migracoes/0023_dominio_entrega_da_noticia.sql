-- Domínio do estado da entrega da notícia do provedor — GERADA por `drizzle-kit generate` a partir
-- de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes).
--
-- UMA intervenção à mão sobre a saída do gerador, a do padrão de `0002`, `0003`, `0005`, `0007`,
-- `0009`, `0011`, `0013`, `0015`, `0017`, `0019` e `0021`: o nome do arquivo e o `tag` de
-- `meta/_journal.json` foram trocados pelo nome descritivo — o gerador sorteia um nome sem
-- significado (`0023_romantic_spiral`). **Nenhuma instrução foi editada ou reordenada.**
--
-- ⚠️ **Não há instrução AUTORAL neste arquivo, e a ausência é a decisão** (a regra que as irmãs
-- enunciam: gerado e autoral nunca convivem no mesmo arquivo). A RLS desta tabela — `FORCE` e a
-- política de isolamento — vive na parceira `0024_seguranca_entrega_da_noticia.sql`.
--
-- O `ENABLE ROW LEVEL SECURITY` abaixo é do GERADOR, e vem do `.enableRLS()` do esquema; ele
-- habilita, mas **não** força nem cria política. Sem a parceira, a tabela fica sem política alguma
-- e o dono do schema a lê inteira.
--
-- Por que a tabela vive em `negocio` e não em `plataforma`, por que a unicidade é por empresa
-- SOZINHA (sem índice parcial, porque não há histórico a preservar — RN-04) e o que cada cláusula
-- da `CHECK` de coerência torna irrepresentável: ver o docblock de `entregaDaNoticia` em
-- `src/esquema/negocio.ts`.

CREATE TABLE "negocio"."entrega_da_noticia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"habilitada" boolean NOT NULL,
	"verificada_em" timestamp with time zone,
	"motivo_codigo" text,
	"motivo_mensagem" text,
	"motivo_diagnostico" jsonb,
	"verificada_por" uuid,
	CONSTRAINT "entrega_da_noticia_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "entrega_da_noticia_empresa_key" UNIQUE("empresa_id"),
	CONSTRAINT "entrega_da_noticia_coerencia_chk" CHECK ((NOT "negocio"."entrega_da_noticia"."habilitada" OR "negocio"."entrega_da_noticia"."verificada_em" IS NOT NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_codigo" IS NOT NULL) = (NOT "negocio"."entrega_da_noticia"."habilitada" AND "negocio"."entrega_da_noticia"."verificada_em" IS NOT NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_mensagem" IS NULL) = ("negocio"."entrega_da_noticia"."motivo_codigo" IS NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_diagnostico" IS NULL OR "negocio"."entrega_da_noticia"."motivo_codigo" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."entrega_da_noticia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."entrega_da_noticia" ADD CONSTRAINT "entrega_da_noticia_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."entrega_da_noticia" ADD CONSTRAINT "entrega_da_noticia_usuario_empresa_fkey" FOREIGN KEY ("verificada_por","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;