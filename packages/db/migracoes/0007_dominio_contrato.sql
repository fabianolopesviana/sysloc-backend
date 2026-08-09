-- Contrato de locação — GERADA por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003` e `0005`: o nome do
-- arquivo e o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo — o gerador sorteia
-- um nome sem significado (`0007_organic_gertrude_yorkes`). **Nenhuma instrução foi trocada de ordem
-- e nenhuma foi editada**: o gerador emitiu as duas tabelas antes das cinco chaves estrangeiras, de
-- modo que o alvo de cada referência já existe quando ela é criada. (Conferir vale a cada
-- regeração, porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe um `0008`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma, nem função. Sem `FORCE`, o DONO das tabelas ignora a
-- política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum (ADR-0008,
-- Cons). O `FORCE`, as duas políticas e o mecanismo de emissão da série vivem em
-- `0008_seguranca_contrato.sql`, escrito à mão, pela mesma regra que separou o `0001` do `0000` e o
-- `0006` do `0005`: **gerado e autoral nunca convivem no mesmo arquivo**, porque uma regeração
-- futura sobrescreve o trecho autoral em silêncio e ninguém percebe.
--
-- ---------------------------------------------------------------------------
-- As duas tabelas, e o que cada uma traz DESTE arquivo
-- ---------------------------------------------------------------------------
--
--   * `contrato` e `contrato_fiador` — as duas com `empresa_id` não nulo, restrição única
--     `(id, empresa_id)` e RLS habilitada. A quarta propriedade (`FORCE`) vem do `0008`; a guarda de
--     cobertura de `src/catalogo.ts` é a autoridade sobre o estado real das quatro, e reprova a
--     tabela que nasça sem qualquer uma delas;
--   * **cinco chaves estrangeiras compostas** — `contrato` para imóvel, locador e locatário;
--     `contrato_fiador` para contrato e fiador. É o que torna a referência entre empresas
--     *estruturalmente impossível* (ADR-0008), e é pelo NOME delas que os casos afirmam qual
--     restrição recusou;
--   * **`contrato_fiador` não tem `retirado_em`**, e a ausência é a decisão: a ADR-0014 exclui
--     vínculo do alcance da exclusão lógica. Acrescentar a coluna "por simetria" com as seis
--     entidades de cadastro desfaria a decisão em silêncio — a guarda de cobertura não a cobra de
--     ninguém. É o CT-430 que a afirma.
--
-- **`contrato_imovel_vigente_uidx` é ÍNDICE, e não restrição** — repare que ele sai como
-- `CREATE UNIQUE INDEX … WHERE`, e não como `CONSTRAINT` dentro do `CREATE TABLE`, porque o
-- PostgreSQL não admite restrição única parcial. Convertê-lo para restrição, "por consistência com
-- as vizinhas", removeria a condição `WHERE status = 'ATIVO'` e passaria a impedir dois contratos em
-- QUALQUER estado sobre o mesmo imóvel — o que quebra montar contrato novo depois de cancelar o
-- anterior. Ver o comentário por extenso em `src/esquema/negocio.ts`.
--
-- A unicidade `contrato_empresa_codigo_key` é **total**, e não parcial por circulação: parcial, a
-- recirculação de um contrato retirado colidiria com o que nasceu depois dele — e o código é
-- justamente a referência citada fora do sistema que a ADR-0015 existe para manter estável.
--
-- Nenhuma concessão de TABELA é necessária: o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"`
-- de `0001_seguranca.sql` faz a concessão acompanhar a criação, tanto das tabelas quanto dos tipos.
-- O `GRANT USAGE ON TYPE "negocio"."status_contrato"` explícito fica no `0008`, seguindo o
-- precedente do `0001`, que declara os tipos um a um mesmo tendo o padrão.
--
-- Sem descida (`down`), pela mesma razão dos anteriores: o caminho de volta é restauração de
-- backup (§7.3 da tech spec).

CREATE TYPE "negocio"."status_contrato" AS ENUM('RASCUNHO', 'ATIVO', 'CANCELADO', 'ENCERRADO');--> statement-breakpoint
CREATE TABLE "negocio"."contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"imovel_id" uuid NOT NULL,
	"locador_id" uuid NOT NULL,
	"locatario_id" uuid NOT NULL,
	"status" "negocio"."status_contrato" NOT NULL,
	"data_inicio_locacao" date NOT NULL,
	"prazo_meses" integer NOT NULL,
	"valor_mensal" numeric(15, 2) NOT NULL,
	"dia_vencimento" integer NOT NULL,
	"data_fim_locacao" date,
	"valor_total_contrato" numeric(15, 2),
	"gerar_cobrancas_automaticamente" boolean DEFAULT true NOT NULL,
	"pdf_contrato_arquivo" text,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "contrato_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "contrato_empresa_codigo_key" UNIQUE("empresa_id","codigo"),
	CONSTRAINT "contrato_dia_vencimento_chk" CHECK ("negocio"."contrato"."dia_vencimento" BETWEEN 1 AND 28),
	CONSTRAINT "contrato_prazo_positivo_chk" CHECK ("negocio"."contrato"."prazo_meses" > 0),
	CONSTRAINT "contrato_valor_mensal_positivo_chk" CHECK ("negocio"."contrato"."valor_mensal" > 0)
);
--> statement-breakpoint
ALTER TABLE "negocio"."contrato" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."contrato_fiador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"contrato_id" uuid NOT NULL,
	"fiador_id" uuid NOT NULL,
	CONSTRAINT "contrato_fiador_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "contrato_fiador_contrato_fiador_key" UNIQUE("contrato_id","fiador_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."contrato_fiador" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."contrato" ADD CONSTRAINT "contrato_imovel_empresa_fkey" FOREIGN KEY ("imovel_id","empresa_id") REFERENCES "negocio"."imovel"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."contrato" ADD CONSTRAINT "contrato_locador_empresa_fkey" FOREIGN KEY ("locador_id","empresa_id") REFERENCES "negocio"."locador"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."contrato" ADD CONSTRAINT "contrato_locatario_empresa_fkey" FOREIGN KEY ("locatario_id","empresa_id") REFERENCES "negocio"."locatario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."contrato_fiador" ADD CONSTRAINT "contrato_fiador_contrato_empresa_fkey" FOREIGN KEY ("contrato_id","empresa_id") REFERENCES "negocio"."contrato"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."contrato_fiador" ADD CONSTRAINT "contrato_fiador_fiador_empresa_fkey" FOREIGN KEY ("fiador_id","empresa_id") REFERENCES "negocio"."fiador"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contrato_imovel_vigente_uidx" ON "negocio"."contrato" USING btree ("imovel_id") WHERE status = 'ATIVO';--> statement-breakpoint
CREATE INDEX "contrato_empresa_retirado_idx" ON "negocio"."contrato" USING btree ("empresa_id","retirado_em");--> statement-breakpoint
CREATE INDEX "contrato_empresa_imovel_idx" ON "negocio"."contrato" USING btree ("empresa_id","imovel_id");--> statement-breakpoint
CREATE INDEX "contrato_fiador_empresa_contrato_idx" ON "negocio"."contrato_fiador" USING btree ("empresa_id","contrato_id");