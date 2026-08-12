-- Régua de cobrança — GERADA por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003`, `0005`, `0007` e
-- `0009`: o nome do arquivo e o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo —
-- o gerador sorteia um nome sem significado (`0011_high_proemial_gods`). **Nenhuma instrução foi
-- trocada de ordem e nenhuma foi editada**: o gerador emitiu os três tipos, depois as duas tabelas,
-- depois as três chaves estrangeiras e por fim os dois índices, de modo que o alvo de cada
-- referência já existe quando ela é criada. (Conferir vale a cada regeração, porque a ordem é do
-- gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe um `0012`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma nem concessão de tipo. Sem `FORCE`, o DONO das tabelas
-- ignora a política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum
-- (ADR-0008, Cons). O `FORCE`, as duas políticas e os três `GRANT USAGE ON TYPE` vivem em
-- `0012_seguranca_regua.sql`, escrito à mão, pela mesma regra que separou o `0001` do `0000`, o
-- `0006` do `0005`, o `0008` do `0007` e o `0010` do `0009`: **gerado e autoral nunca convivem no
-- mesmo arquivo**, porque uma regeração futura sobrescreve o trecho autoral em silêncio e ninguém
-- percebe.
--
-- ⚠️ **A `0010` NÃO é tocada por esta fatia.** Ela carrega uma `DECISÃO FECHADA` e o
-- `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco durável e **fecha em
-- silêncio**. O par `0011`/`0012` são arquivos NOVOS, e o `sha256sum` que
-- `deploy/scripts/instalacao/migrar-banco.sh` mantém sobre os anteriores continua valendo.
--
-- ---------------------------------------------------------------------------
-- As duas tabelas, e o que cada uma traz DESTE arquivo
-- ---------------------------------------------------------------------------
--
--   * `politica_de_aviso` e `envio_de_cobranca` — as duas com `empresa_id` não nulo, restrição
--     única `(id, empresa_id)` e RLS habilitada. A quarta propriedade (`FORCE`) vem do `0012`; a
--     guarda de cobertura de `src/catalogo.ts` é a autoridade sobre o estado real das quatro, e
--     reprova a tabela que nasça sem qualquer uma delas;
--   * **uma única chave estrangeira composta**, em `envio_de_cobranca` — para a cobrança. O par
--     `(cobranca_id, empresa_id)` é o que torna **estruturalmente impossível** um registro da
--     empresa A apontar para cobrança da empresa B; a forma simples (`REFERENCES cobranca(id)`)
--     aceitaria o apontamento cruzado em silêncio;
--   * **`politica_de_aviso` nasce com `ativo = false`**, e o padrão é a decisão: a régua entra em
--     produção DESLIGADA em toda empresa, inclusive nas que já existem quando esta migração roda.
--     O dano de um aviso indevido à caixa de um locatário não se desfaz;
--   * **nenhuma das duas tem `retirado_em`**, e a guarda não a cobra de ninguém: a política é
--     singular por empresa e o registro de envio é **fato**, nunca cadastro (ADR-0014).
--
-- **`envio_de_cobranca_causa_chk` é BICONDICIONAL** — `(desfecho = 'ENVIADA') = (causa IS NULL)`
-- recusa as DUAS incoerências, o sucesso com causa e a falha sem ela. Uma implicação simples
-- deixaria aberta justamente a metade que dói: a tentativa que não saiu sem dizer por quê, que não é
-- recuperável depois. Mesma forma de `cobranca_carimbo_coerente_chk`, no `0009`.
--
-- **`envio_de_cobranca_trava_idx` é ÍNDICE PARCIAL** — repare no `WHERE desfecho = 'ENVIADA'`. É
-- exatamente o conjunto que a trava consulta (RD-05), e o irmão `envio_de_cobranca_historico_idx`
-- cobre as mesmas colunas SEM a condição porque o histórico lê todas. Os dois não são redundantes:
-- um índice parcial é inalcançável pela consulta que não repete a condição dele — a medição com
-- `EXPLAIN (ANALYZE, BUFFERS)` que fixa isso está no cabeçalho homônimo do `0009`, e não é recopiada
-- aqui. Remover a condição "por consistência" com o irmão faria o índice da trava crescer com todo o
-- histórico de falhas.
--
-- **Os dois horários são `time`, e a projeção deles é `to_char(coluna, 'HH24:MI')`.** O driver
-- devolve `'08:00:00'`, e o molde ancorado que o contrato publica recusa essa forma — recusa de
-- esquema de SAÍDA não produz `422`, ela derruba a rota. A decisão está por extenso no cabeçalho da
-- tabela em `src/esquema/negocio.ts`, e tem prova executável no CT-608.
--
-- Nenhuma concessão de TABELA é necessária: o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"`
-- de `0001_seguranca.sql` faz a concessão acompanhar a criação, tanto das tabelas quanto dos tipos.
-- Os `GRANT USAGE ON TYPE` explícitos ficam no `0012`, seguindo o precedente do `0001`, do `0008` e
-- do `0010`.
--
-- Sem descida (`down`), pela mesma razão dos anteriores: o caminho de volta é restauração de
-- backup (§7.3 da tech spec).

CREATE TYPE "negocio"."caminho_do_aviso" AS ENUM('AUTOMATICO', 'MANUAL');--> statement-breakpoint
CREATE TYPE "negocio"."canal_de_aviso" AS ENUM('EMAIL');--> statement-breakpoint
CREATE TYPE "negocio"."desfecho_do_aviso" AS ENUM('ENVIADA', 'FALHOU', 'SEM_DESTINATARIO');--> statement-breakpoint
CREATE TABLE "negocio"."envio_de_cobranca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cobranca_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"caminho" "negocio"."caminho_do_aviso" NOT NULL,
	"desfecho" "negocio"."desfecho_do_aviso" NOT NULL,
	"destinatario" text NOT NULL,
	"causa" text,
	CONSTRAINT "envio_de_cobranca_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "envio_de_cobranca_causa_chk" CHECK (("negocio"."envio_de_cobranca"."desfecho" = 'ENVIADA') = ("negocio"."envio_de_cobranca"."causa" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."envio_de_cobranca" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."politica_de_aviso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"dias_antes_do_vencimento" integer DEFAULT 0 NOT NULL,
	"intervalo_minimo_dias" integer DEFAULT 1 NOT NULL,
	"janela_inicio" time DEFAULT '00:00' NOT NULL,
	"janela_fim" time DEFAULT '23:59' NOT NULL,
	"canal" "negocio"."canal_de_aviso" DEFAULT 'EMAIL' NOT NULL,
	CONSTRAINT "politica_de_aviso_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "politica_de_aviso_empresa_key" UNIQUE("empresa_id"),
	CONSTRAINT "politica_de_aviso_faixa_chk" CHECK ("negocio"."politica_de_aviso"."dias_antes_do_vencimento" BETWEEN 0 AND 90 AND "negocio"."politica_de_aviso"."intervalo_minimo_dias" BETWEEN 1 AND 90),
	CONSTRAINT "politica_de_aviso_janela_chk" CHECK ("negocio"."politica_de_aviso"."janela_fim" >= "negocio"."politica_de_aviso"."janela_inicio")
);
--> statement-breakpoint
ALTER TABLE "negocio"."politica_de_aviso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."envio_de_cobranca" ADD CONSTRAINT "envio_de_cobranca_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."envio_de_cobranca" ADD CONSTRAINT "envio_de_cobranca_cobranca_empresa_fkey" FOREIGN KEY ("cobranca_id","empresa_id") REFERENCES "negocio"."cobranca"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."politica_de_aviso" ADD CONSTRAINT "politica_de_aviso_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "envio_de_cobranca_trava_idx" ON "negocio"."envio_de_cobranca" USING btree ("empresa_id","cobranca_id","criado_em" DESC NULLS LAST) WHERE desfecho = 'ENVIADA';--> statement-breakpoint
CREATE INDEX "envio_de_cobranca_historico_idx" ON "negocio"."envio_de_cobranca" USING btree ("empresa_id","cobranca_id","criado_em" DESC NULLS LAST);