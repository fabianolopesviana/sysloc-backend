-- Domínio de locação — GERADA por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao`.
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002` e `0003`: o nome do arquivo e
-- o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo — o gerador sorteia um nome
-- sem significado (`0005_cold_dreadnoughts`). **Nenhuma instrução foi trocada de ordem**: o gerador
-- emitiu todas as tabelas antes de todas as chaves estrangeiras, então o alvo de cada referência já
-- existe quando ela é criada. (O `0003` precisou da troca; este não — conferir vale a cada
-- regeração, porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe um `0006`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY` nem política alguma — a consequência que a ADR-0009 registra entre os
-- Neutros. Sem `FORCE`, o DONO das tabelas ignora a política, e a suíte de isolamento ficaria verde
-- contra um schema sem isolamento nenhum (ADR-0008, Cons). O `FORCE` e as seis políticas vivem em
-- `0006_seguranca_dominio.sql`, escrito à mão, pela mesma regra que separou o `0001` do `0000`:
-- **gerado e autoral nunca convivem no mesmo arquivo**, porque uma regeração futura sobrescreve o
-- trecho autoral em silêncio e ninguém percebe.
--
-- ---------------------------------------------------------------------------
-- As seis tabelas, e as três propriedades que cada uma traz deste arquivo
-- ---------------------------------------------------------------------------
--
--   * `conjunto`, `imovel`, `comodo`, `locador`, `locatario`, `fiador` — todas com `empresa_id` não
--     nulo, restrição única `(id, empresa_id)` e RLS habilitada. A quarta propriedade (`FORCE`) vem
--     do `0006`; a guarda de cobertura de `src/catalogo.ts` é a autoridade sobre o estado real das
--     quatro, e reprova a tabela que nasça sem qualquer uma delas;
--   * **chave estrangeira composta** onde há pai tenantizado: `imovel_conjunto_empresa_fkey` e
--     `comodo_imovel_empresa_fkey`. É o que torna a referência entre empresas *estruturalmente
--     impossível* (ADR-0008), e é pelo NOME delas que o CT-304 afirma qual restrição recusou;
--   * **`comodo` não tem `retirado_em`**, e a ausência é a decisão: a ADR-0014 exclui o cômodo
--     nominalmente do alcance da exclusão lógica, por ser detalhe de composição que ninguém
--     referencia. Acrescentar a coluna "por simetria" desfaria a decisão em silêncio.
--
-- As duas unicidades de negócio — `imovel_empresa_identificador_municipal_key` e
-- `<papel>_empresa_documento_key` — são **totais**, e não parciais por circulação: parcial, a
-- recirculação de um registro retirado colidiria com o que nasceu depois dele. Ver o cabeçalho de
-- `imovel` em `src/esquema/negocio.ts`.
--
-- Nenhuma concessão nova é necessária: o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"` de
-- `0001_seguranca.sql` faz a concessão acompanhar a criação, tanto das TABELAS quanto dos TIPOS —
-- e as seis tabelas e os três enums daqui são criados por aquele papel.
--
-- Sem descida (`down`), pela mesma razão dos anteriores: o caminho de volta é restauração de
-- backup (§7.3 da tech spec).

CREATE TYPE "negocio"."status_locacao" AS ENUM('DISPONIVEL', 'LOCADO', 'INDISPONIVEL');--> statement-breakpoint
CREATE TYPE "negocio"."tipo_imovel" AS ENUM('RESIDENCIAL', 'COMERCIAL', 'MISTO');--> statement-breakpoint
CREATE TYPE "negocio"."tipo_pessoa" AS ENUM('PESSOA_FISICA', 'PESSOA_JURIDICA');--> statement-breakpoint
CREATE TABLE "negocio"."comodo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"imovel_id" uuid NOT NULL,
	"nome_comodo" text NOT NULL,
	"metragem" numeric(10, 2) DEFAULT '0' NOT NULL,
	"posicao" integer NOT NULL,
	"observacoes" text,
	CONSTRAINT "comodo_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "comodo_imovel_posicao_key" UNIQUE("imovel_id","posicao"),
	CONSTRAINT "comodo_metragem_nao_negativa_chk" CHECK ("negocio"."comodo"."metragem" >= 0)
);
--> statement-breakpoint
ALTER TABLE "negocio"."comodo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."conjunto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "conjunto_id_empresa_key" UNIQUE("id","empresa_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."conjunto" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."fiador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo_pessoa" "negocio"."tipo_pessoa" NOT NULL,
	"documento_principal" text NOT NULL,
	"rg" text,
	"email" text NOT NULL,
	"telefone" text NOT NULL,
	"logradouro" text NOT NULL,
	"numero" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"cep" text NOT NULL,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "fiador_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "fiador_empresa_documento_key" UNIQUE("empresa_id","documento_principal")
);
--> statement-breakpoint
ALTER TABLE "negocio"."fiador" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."imovel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"conjunto_id" uuid NOT NULL,
	"nome_imovel" text NOT NULL,
	"identificador_municipal" text NOT NULL,
	"tipo_imovel" "negocio"."tipo_imovel" NOT NULL,
	"logradouro" text NOT NULL,
	"numero" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"cep" text NOT NULL,
	"status_locacao" "negocio"."status_locacao" NOT NULL,
	"observacoes" text,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "imovel_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "imovel_empresa_identificador_municipal_key" UNIQUE("empresa_id","identificador_municipal")
);
--> statement-breakpoint
ALTER TABLE "negocio"."imovel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."locador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo_pessoa" "negocio"."tipo_pessoa" NOT NULL,
	"documento_principal" text NOT NULL,
	"rg" text,
	"email" text NOT NULL,
	"telefone" text NOT NULL,
	"logradouro" text NOT NULL,
	"numero" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"cep" text NOT NULL,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "locador_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "locador_empresa_documento_key" UNIQUE("empresa_id","documento_principal")
);
--> statement-breakpoint
ALTER TABLE "negocio"."locador" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."locatario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo_pessoa" "negocio"."tipo_pessoa" NOT NULL,
	"documento_principal" text NOT NULL,
	"rg" text,
	"email" text NOT NULL,
	"telefone" text NOT NULL,
	"logradouro" text NOT NULL,
	"numero" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"cep" text NOT NULL,
	"retirado_em" timestamp with time zone,
	CONSTRAINT "locatario_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "locatario_empresa_documento_key" UNIQUE("empresa_id","documento_principal")
);
--> statement-breakpoint
ALTER TABLE "negocio"."locatario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."comodo" ADD CONSTRAINT "comodo_imovel_empresa_fkey" FOREIGN KEY ("imovel_id","empresa_id") REFERENCES "negocio"."imovel"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."conjunto" ADD CONSTRAINT "conjunto_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."fiador" ADD CONSTRAINT "fiador_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."imovel" ADD CONSTRAINT "imovel_conjunto_empresa_fkey" FOREIGN KEY ("conjunto_id","empresa_id") REFERENCES "negocio"."conjunto"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."locador" ADD CONSTRAINT "locador_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."locatario" ADD CONSTRAINT "locatario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comodo_empresa_imovel_posicao_idx" ON "negocio"."comodo" USING btree ("empresa_id","imovel_id","posicao");--> statement-breakpoint
CREATE INDEX "conjunto_empresa_retirado_idx" ON "negocio"."conjunto" USING btree ("empresa_id","retirado_em");--> statement-breakpoint
CREATE INDEX "fiador_empresa_retirado_idx" ON "negocio"."fiador" USING btree ("empresa_id","retirado_em");--> statement-breakpoint
CREATE INDEX "imovel_empresa_conjunto_idx" ON "negocio"."imovel" USING btree ("empresa_id","conjunto_id");--> statement-breakpoint
CREATE INDEX "imovel_empresa_retirado_idx" ON "negocio"."imovel" USING btree ("empresa_id","retirado_em");--> statement-breakpoint
CREATE INDEX "locador_empresa_retirado_idx" ON "negocio"."locador" USING btree ("empresa_id","retirado_em");--> statement-breakpoint
CREATE INDEX "locatario_empresa_retirado_idx" ON "negocio"."locatario" USING btree ("empresa_id","retirado_em");