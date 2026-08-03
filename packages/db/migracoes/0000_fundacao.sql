-- Migração estrutural — GERADA por `drizzle-kit generate` a partir de `src/esquema/*.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao`.
--
-- DUAS INSTRUÇÕES FORAM REMOVIDAS DA SAÍDA DO GERADOR, e a remoção é deliberada:
-- `CREATE SCHEMA "identidade"` e `CREATE SCHEMA "negocio"`. Os dois schemas vêm do
-- provisionamento (`deploy/scripts/instalacao/provisionar-base.sh`), com dono `sysloc_migracao` e
-- uso concedido ao `sysloc_app` — §7.3 da tech spec. Criá-los aqui exigiria conceder ao papel de
-- migração o privilégio `CREATE` sobre um banco cujo dono é o papel da aplicação: poder maior do
-- que a tarefa pede. Esta migração conecta COMO o migrador e cria apenas objetos dentro dos
-- schemas — que nascem dele por consequência, sem nenhum `ALTER ... OWNER`.
--
-- O instantâneo em `meta/0000_snapshot.json` já registra os dois schemas como existentes, de modo
-- que uma geração futura não os reemite. Uma REgeração deste 0000 do zero, sim — e nesse caso as
-- duas linhas têm de sair de novo. `deploy/scripts/instalacao/verificar-migracao.sh` (T5) é o que
-- reprova se elas voltarem.
CREATE TYPE "identidade"."desfecho_tentativa" AS ENUM('SUCESSO', 'CREDENCIAL_INCORRETA', 'EMAIL_INEXISTENTE', 'CONTA_BLOQUEADA', 'ACESSO_RECUSADO');--> statement-breakpoint
CREATE TYPE "identidade"."perfil_usuario" AS ENUM('SYSLOC_MASTER', 'ADMIN_EMPRESA', 'USUARIO_EMPRESA');--> statement-breakpoint
CREATE TYPE "negocio"."tipo_permissao" AS ENUM('TELA', 'ACAO');--> statement-breakpoint
CREATE TABLE "identidade"."conta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"conta_id" text NOT NULL,
	"provedor_id" text NOT NULL,
	"senha_derivada" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidade"."dois_fatores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"segredo" text NOT NULL,
	"codigos_recuperacao" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidade"."empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"documento" text NOT NULL,
	"suspensa_em" timestamp with time zone,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresa_documento_unique" UNIQUE("documento")
);
--> statement-breakpoint
CREATE TABLE "identidade"."sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"origem" text,
	"agente" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessao_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "identidade"."tentativa_login" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_informado" text NOT NULL,
	"usuario_id" uuid,
	"desfecho" "identidade"."desfecho_tentativa" NOT NULL,
	"origem" "inet",
	"agente" text,
	"ocorrida_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identidade"."usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"perfil" "identidade"."perfil_usuario" NOT NULL,
	"empresa_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"senha_provisoria" boolean DEFAULT false NOT NULL,
	"dois_fatores_ativo" boolean DEFAULT false NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email"),
	CONSTRAINT "usuario_master_sem_empresa_chk" CHECK (("identidade"."usuario"."perfil" = 'SYSLOC_MASTER') = ("identidade"."usuario"."empresa_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "identidade"."verificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identificador" text NOT NULL,
	"valor" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negocio"."acesso_usuario_app" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acesso_usuario_app_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "acesso_usuario_app_empresa_usuario_key" UNIQUE("empresa_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_app" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."acesso_usuario_permissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"acesso_id" uuid NOT NULL,
	"tipo" "negocio"."tipo_permissao" NOT NULL,
	"chave" text NOT NULL,
	CONSTRAINT "acesso_usuario_permissao_id_empresa_key" UNIQUE("id","empresa_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_permissao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "identidade"."conta" ADD CONSTRAINT "conta_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidade"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidade"."dois_fatores" ADD CONSTRAINT "dois_fatores_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidade"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidade"."sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidade"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidade"."tentativa_login" ADD CONSTRAINT "tentativa_login_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidade"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD CONSTRAINT "usuario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_app" ADD CONSTRAINT "acesso_usuario_app_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_app" ADD CONSTRAINT "acesso_usuario_app_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "identidade"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_permissao" ADD CONSTRAINT "acesso_usuario_permissao_acesso_empresa_fkey" FOREIGN KEY ("acesso_id","empresa_id") REFERENCES "negocio"."acesso_usuario_app"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conta_usuario_id_idx" ON "identidade"."conta" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "conta_provedor_conta_idx" ON "identidade"."conta" USING btree ("provedor_id","conta_id");--> statement-breakpoint
CREATE INDEX "dois_fatores_usuario_id_idx" ON "identidade"."dois_fatores" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sessao_usuario_id_idx" ON "identidade"."sessao" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tentativa_login_ocorrida_em_idx" ON "identidade"."tentativa_login" USING btree ("ocorrida_em");--> statement-breakpoint
CREATE INDEX "tentativa_login_email_informado_idx" ON "identidade"."tentativa_login" USING btree ("email_informado");--> statement-breakpoint
CREATE INDEX "usuario_empresa_id_idx" ON "identidade"."usuario" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "verificacao_identificador_idx" ON "identidade"."verificacao" USING btree ("identificador");--> statement-breakpoint
CREATE INDEX "acesso_usuario_permissao_empresa_acesso_idx" ON "negocio"."acesso_usuario_permissao" USING btree ("empresa_id","acesso_id");