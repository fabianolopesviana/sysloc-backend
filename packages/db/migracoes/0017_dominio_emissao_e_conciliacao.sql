-- Domínio da emissão e da conciliação — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003`, `0005`, `0007`,
-- `0009`, `0011`, `0013` e `0015`: o nome do arquivo e o `tag` de `meta/_journal.json` foram
-- trocados pelo nome descritivo — o gerador sorteia um nome sem significado
-- (`0017_wakeful_mentallo`). **Nenhuma instrução foi trocada de ordem e nenhuma foi editada**: o
-- gerador emitiu os três tipos, depois as quatro tabelas com o `ENABLE ROW LEVEL SECURITY` de cada
-- uma, depois o `ADD COLUMN` da cobrança, depois as chaves estrangeiras e por fim os índices e a
-- restrição única do identificador, de modo que o alvo de cada referência já existe quando ela é
-- criada. (Conferir vale a cada regeração, porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- NENHUM `CREATE SCHEMA` — e desta vez o gerador não emitiu nenhum
-- ---------------------------------------------------------------------------
--
-- Os schemas nascem do provisionamento (`deploy/scripts/instalacao/provisionar-base.sh`), e a razão
-- está no cabeçalho da `0000_fundacao.sql`: criá-los na migração exigiria conceder ao papel de
-- migração o privilégio `CREATE` sobre um banco cujo dono é o papel da aplicação — poder maior do
-- que a tarefa pede. Esta geração foi **incremental** e `migracoes/meta/0015_snapshot.json` já
-- registra `identidade` e `negocio` como existentes, então a supressão manual descrita em
-- `drizzle.config.ts` não teve o que suprimir. **Ela continua obrigatória numa geração DO ZERO**, e
-- a guarda é executável: `verificar-migracao.sh`, asserção `(e)`, exige zero `CREATE SCHEMA` em
-- código nos arquivos de migração, com o mutante ao lado provando que a varredura acusa.
--
-- ⚠️ O schema `plataforma` continua fora do alcance do gerador — **nenhum objeto dele é declarado no
-- Drizzle** —, e a advertência da `0015` sobre a fatia (iii) segue valendo palavra por palavra: no
-- dia em que a tabela crua da notificação bancária for declarada em `plataforma`, o gerador proporá
-- `CREATE SCHEMA "plataforma"`, que a restrição de manutenção 1 proíbe. **Esta fatia não declara
-- objeto algum em `plataforma`**, e o roster enumerado dele não cresce (ADR-0031): as quatro tabelas
-- daqui têm dono-empresa e por isso pertencem a `negocio`.
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe uma `0018`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma nem concessão de tipo. Sem `FORCE`, o DONO das tabelas
-- ignora a política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum
-- (ADR-0008, Cons); sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono.
-- O `FORCE`, as quatro políticas e os três `GRANT USAGE ON TYPE` vivem em
-- `0018_seguranca_emissao_e_conciliacao.sql`, escrito à mão, pela mesma regra que separou o `0001`
-- do `0000`, o `0006` do `0005`, o `0008` do `0007`, o `0010` do `0009`, o `0012` do `0011`, o `0014`
-- do `0013` e o `0016` do `0015`: **gerado e autoral nunca convivem no mesmo arquivo**, porque uma
-- regeração futura sobrescreve o trecho autoral em silêncio e ninguém percebe.
--
-- ⚠️ **Nenhuma migração de `0000` a `0016` é tocada por esta fatia.** A `0010` carrega uma
-- `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco
-- durável e **fecha em silêncio**. O par `0017`/`0018` são arquivos NOVOS, e o `sha256sum` que
-- `migrar-banco.sh` registra por arquivo continua batendo para todas as anteriores.
--
-- ---------------------------------------------------------------------------
-- As quatro tabelas, e os DOIS índices únicos parciais que saem DAQUI
-- ---------------------------------------------------------------------------
--
--   * `evento_bancario`, `emissao_em_lote`, `item_da_emissao_em_lote` e `conferencia_bancaria` — as
--     quatro com `empresa_id` não nulo, restrição única `(id, empresa_id)`, RLS habilitada e chave
--     estrangeira composta. A quarta propriedade (`FORCE`) vem da `0018`; a guarda de cobertura de
--     `src/catalogo.ts` é a autoridade sobre o estado real das quatro, e reprova a tabela que nasça
--     sem qualquer uma delas;
--   * **`emissao_em_lote_em_andamento_uidx` e `conferencia_bancaria_em_andamento_uidx` saem DAQUI, e
--     não da parceira autoral** — eles são declaráveis no Drizzle (`uniqueIndex(...).where(...)`) e o
--     gerador os emite corretamente, como já emitiu `contrato_imovel_vigente_uidx` na `0007` e
--     `certificado_do_provedor_vigente_uidx` na `0015`. Escrevê-los à mão na `0018` criaria uma
--     SEGUNDA declaração do mesmo índice: o schema declarado deixaria de os conter, e a regeração
--     seguinte proporia criá-los de novo — a divergência silenciosa que o cabeçalho de
--     `drizzle.config.ts` nomeia como ruído permanente. Eles são o MECANISMO de "um lote e uma
--     conferência em andamento por empresa", e não otimização: o disparo concorrente é recusado pelo
--     banco, nunca por leitura-antes-de-gravar;
--   * **`negocio.cobranca` ganha UMA coluna**, `identificador_no_provedor`, com unicidade **GLOBAL**
--     — sem `empresa_id`, porque a série é do SaaS (ADR-0033). O `ALTER` é aditivo sobre coluna
--     anulável: não reescreve linha existente nem exige janela. Parear o índice com a empresa é
--     exatamente o *"corrigir o contador para ser por empresa"* que a ADR-0033 proíbe;
--   * **nenhuma coluna de status nasce aqui** (ADR-0022, RN-14). O estado da cobrança continua saindo
--     da visão `cobranca_derivada`, e o estado do lote é derivado dos dois instantes de desfecho —
--     é por isso que `ESTADOS_DA_EMISSAO_EM_LOTE` não tem tipo enumerado neste arquivo, enquanto os
--     outros três arranjos da T1 têm;
--   * **nenhum `check` novo em `negocio.cobranca`**, e a ausência é decisão: uma bicondicional
--     pareando os cinco campos de conciliação recusaria o estado legítimo *"emitido e ainda não
--     pago"*, porque `data_credito` e `valor_creditado` nascem depois dos outros três. A versão fraca
--     fica de fora por escopo, e é a T6 — quem escreve os campos — que a registra como débito.
--
-- Sem descida (`down`): o caminho de volta é restauração de backup (§7.3 da tech spec).
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

CREATE TYPE "negocio"."desfecho_do_item_do_lote" AS ENUM('EMITIDO', 'RECUSADO');--> statement-breakpoint
CREATE TYPE "negocio"."origem_do_evento_bancario" AS ENUM('ATO_DO_ADMIN', 'CONFERENCIA');--> statement-breakpoint
CREATE TYPE "negocio"."tipo_de_evento_bancario" AS ENUM('BOLETO_EMITIDO', 'BOLETO_REVOGADO', 'EMISSAO_RECUSADA', 'COBRANCA_LIQUIDADA', 'LIQUIDACAO_ESTORNADA', 'DIVERGENCIA_DE_VALOR');--> statement-breakpoint
CREATE TABLE "negocio"."conferencia_bancaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"solicitada_por" uuid,
	"cobrancas_conferidas" integer DEFAULT 0 NOT NULL,
	"efeitos" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "conferencia_bancaria_id_empresa_key" UNIQUE("id","empresa_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."conferencia_bancaria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."emissao_em_lote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"competencia" date NOT NULL,
	"solicitado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluido_em" timestamp with time zone,
	"interrompido_em" timestamp with time zone,
	"motivo_da_interrupcao" text,
	CONSTRAINT "emissao_em_lote_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "emissao_em_lote_competencia_no_primeiro_dia_chk" CHECK (extract(day from "negocio"."emissao_em_lote"."competencia") = 1),
	CONSTRAINT "emissao_em_lote_desfecho_unico_chk" CHECK ("negocio"."emissao_em_lote"."concluido_em" IS NULL OR "negocio"."emissao_em_lote"."interrompido_em" IS NULL),
	CONSTRAINT "emissao_em_lote_interrupcao_coerente_chk" CHECK (("negocio"."emissao_em_lote"."interrompido_em" IS NULL) = ("negocio"."emissao_em_lote"."motivo_da_interrupcao" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."emissao_em_lote" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."evento_bancario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cobranca_id" uuid NOT NULL,
	"tipo" "negocio"."tipo_de_evento_bancario" NOT NULL,
	"origem" "negocio"."origem_do_evento_bancario" NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"diagnostico" text,
	"valor_informado" numeric(15, 2),
	CONSTRAINT "evento_bancario_id_empresa_key" UNIQUE("id","empresa_id")
);
--> statement-breakpoint
ALTER TABLE "negocio"."evento_bancario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."item_da_emissao_em_lote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"cobranca_id" uuid NOT NULL,
	"desfecho" "negocio"."desfecho_do_item_do_lote" NOT NULL,
	"motivo" text,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_da_emissao_em_lote_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "item_da_emissao_em_lote_lote_cobranca_key" UNIQUE("lote_id","cobranca_id"),
	CONSTRAINT "item_da_emissao_em_lote_motivo_chk" CHECK (("negocio"."item_da_emissao_em_lote"."desfecho" = 'RECUSADO') = ("negocio"."item_da_emissao_em_lote"."motivo" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."item_da_emissao_em_lote" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."cobranca" ADD COLUMN "identificador_no_provedor" text;--> statement-breakpoint
ALTER TABLE "negocio"."conferencia_bancaria" ADD CONSTRAINT "conferencia_bancaria_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."conferencia_bancaria" ADD CONSTRAINT "conferencia_bancaria_usuario_empresa_fkey" FOREIGN KEY ("solicitada_por","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."emissao_em_lote" ADD CONSTRAINT "emissao_em_lote_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."emissao_em_lote" ADD CONSTRAINT "emissao_em_lote_usuario_empresa_fkey" FOREIGN KEY ("solicitado_por","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."evento_bancario" ADD CONSTRAINT "evento_bancario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."evento_bancario" ADD CONSTRAINT "evento_bancario_cobranca_empresa_fkey" FOREIGN KEY ("cobranca_id","empresa_id") REFERENCES "negocio"."cobranca"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."item_da_emissao_em_lote" ADD CONSTRAINT "item_da_emissao_em_lote_lote_empresa_fkey" FOREIGN KEY ("lote_id","empresa_id") REFERENCES "negocio"."emissao_em_lote"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."item_da_emissao_em_lote" ADD CONSTRAINT "item_da_emissao_em_lote_cobranca_empresa_fkey" FOREIGN KEY ("cobranca_id","empresa_id") REFERENCES "negocio"."cobranca"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conferencia_bancaria_em_andamento_uidx" ON "negocio"."conferencia_bancaria" USING btree ("empresa_id") WHERE concluida_em IS NULL;--> statement-breakpoint
CREATE INDEX "conferencia_bancaria_historico_idx" ON "negocio"."conferencia_bancaria" USING btree ("empresa_id","iniciada_em" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "emissao_em_lote_em_andamento_uidx" ON "negocio"."emissao_em_lote" USING btree ("empresa_id") WHERE concluido_em IS NULL AND interrompido_em IS NULL;--> statement-breakpoint
CREATE INDEX "emissao_em_lote_historico_idx" ON "negocio"."emissao_em_lote" USING btree ("empresa_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "evento_bancario_trilha_idx" ON "negocio"."evento_bancario" USING btree ("empresa_id","cobranca_id","ocorrido_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "item_da_emissao_em_lote_empresa_lote_idx" ON "negocio"."item_da_emissao_em_lote" USING btree ("empresa_id","lote_id");--> statement-breakpoint
ALTER TABLE "negocio"."cobranca" ADD CONSTRAINT "cobranca_identificador_no_provedor_key" UNIQUE("identificador_no_provedor");