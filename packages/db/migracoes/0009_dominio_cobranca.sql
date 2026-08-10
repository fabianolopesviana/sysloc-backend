-- Cobrança e política de mora — GERADA por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003`, `0005` e `0007`: o
-- nome do arquivo e o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo — o gerador
-- sorteia um nome sem significado (`0009_chubby_marrow`). **Nenhuma instrução foi trocada de ordem e
-- nenhuma foi editada**: o gerador emitiu os dois tipos, depois as duas tabelas, depois as duas
-- chaves estrangeiras e por fim os três índices, de modo que o alvo de cada referência já existe
-- quando ela é criada. (Conferir vale a cada regeração, porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe um `0010`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma, função nem visão. Sem `FORCE`, o DONO das tabelas
-- ignora a política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum
-- (ADR-0008, Cons). O `FORCE`, as duas políticas, a data corrente da operação, a visão
-- `cobranca_derivada` e o mecanismo de emissão da série vivem em `0010_seguranca_cobranca.sql`,
-- escrito à mão, pela mesma regra que separou o `0001` do `0000`, o `0006` do `0005` e o `0008` do
-- `0007`: **gerado e autoral nunca convivem no mesmo arquivo**, porque uma regeração futura
-- sobrescreve o trecho autoral em silêncio e ninguém percebe.
--
-- ---------------------------------------------------------------------------
-- As duas tabelas, e o que cada uma traz DESTE arquivo
-- ---------------------------------------------------------------------------
--
--   * `cobranca` e `configuracao_de_mora` — as duas com `empresa_id` não nulo, restrição única
--     `(id, empresa_id)` e RLS habilitada. A quarta propriedade (`FORCE`) vem do `0010`; a guarda de
--     cobertura de `src/catalogo.ts` é a autoridade sobre o estado real das quatro, e reprova a
--     tabela que nasça sem qualquer uma delas;
--   * **uma única chave estrangeira composta** em `cobranca` — para o contrato. Ela é uma só porque
--     **não existe `locatario_id` na cobrança**: o locatário sai da junção com o contrato, o que
--     torna estruturalmente impossível a incoerência que a dupla referência do legado permite;
--   * **`cobranca` não tem `status`, coluna de mora em aberto, `locatario_id` nem `retirado_em`**, e
--     as quatro ausências são decisão, não esquecimento — ver o cabeçalho da tabela em
--     `src/esquema/negocio.ts`, que registra a razão de cada uma. A guarda de cobertura não cobra
--     nenhuma delas de ninguém, de modo que acrescentá-las "por simetria" desfaria a decisão em
--     silêncio.
--
-- **`negocio.status_cobranca` nasce SEM COLUNA que o carregue, e isso é o desenho**: o estado é
-- derivado (ADR-0022) e o tipo é o da coluna `status` da visão do `0010`. Quem procurar a coluna que
-- falta não vai achá-la, e a ausência é exatamente o que impede a segunda fonte do mesmo fato.
--
-- **`cobranca_aberta_idx` é ÍNDICE PARCIAL** — repare no `WHERE pago_em IS NULL AND cancelado_em IS
-- NULL`. É a carteira em aberto, a leitura mais frequente do produto; remover a condição "por
-- consistência" com os dois vizinhos o faria crescer com todo o histórico já liquidado.
--
-- **Ele NÃO é alcançável pelo predicado `status` da visão, e quem consulta a visão precisa dizer os
-- fatos.** Medido com `EXPLAIN (ANALYZE, BUFFERS)` em instância efêmera (2026-08-10), carteira de
-- 60.000 cobranças com 2.000 em aberto e vencidas, sob o contexto de uma empresa:
--
--   * `… FROM negocio.cobranca_derivada WHERE status = 'VENCIDA' ORDER BY data_vencimento LIMIT 50`
--     escolhe `Index Scan using cobranca_empresa_vencimento_idx` e resolve o `CASE` como `Filter`.
--     Com `enable_seqscan = off` o plano é o MESMO: não é preferência de custo, o índice parcial é
--     INALCANÇÁVEL por esse caminho — e é este passo que DISCRIMINA;
--   * a MESMA consulta acrescida de `AND pago_em IS NULL AND cancelado_em IS NULL` troca de
--     operador e passa a `Bitmap Index Scan on cobranca_aberta_idx`;
--   * a leitura DIRETA da tabela com o predicado do índice também usa
--     `Index Scan using cobranca_aberta_idx`.
--
-- **O que se reproduz é o PLANO e o OPERADOR, e é só isso que a decisão usa.** As cifras de linhas
-- descartadas e de `Buffers` que esta medição produziu **não** decorrem do cenário como ele está
-- escrito: elas dependem da distribuição de `data_vencimento` entre liquidadas e em aberto, e da
-- ordem de inserção — com `LIMIT 50` o `Index Scan` termina cedo, e só descarta a carteira toda se
-- as liquidadas ordenarem antes das vencidas. Reproduzi-las exigiria fixar no cenário duas condições
-- que ele não fixa, e por isso elas saíram: apresentar como medida uma cifra que não se reproduz
-- enfraquece a mesma classe de guarda que este comentário existe para sustentar (débito D5).
--
-- A razão é do planejador, não da visão: `status` é uma expressão `CASE` do `CROSS JOIN LATERAL` do
-- `0010`, e o provador de implicação de predicado — que é quem autoriza o uso de índice parcial —
-- resolve conjunção, disjunção, `IS NULL`/`IS NOT NULL` e comparação de operador btree, mas **não
-- decompõe `CASE`**. Ele não tem como provar que `status = 'VENCIDA'` implica os dois `IS NULL` do
-- índice.
--
-- **Consequência para quem escrever a porta de dados sobre a visão (T4)**: toda consulta que filtre
-- a carteira em aberto acompanha o filtro por `status` dos fatos que o índice cobre —
-- `AND pago_em IS NULL AND cancelado_em IS NULL`. É redundante para a semântica (a precedência do
-- estado já os implica) e decisivo para o planejador. Sem isso a leitura mais frequente do produto
-- varre também o histórico liquidado, e o ganho pelo qual este índice foi escolhido parcial em vez
-- de total deixa de existir. O índice **não muda** por causa disso: a forma parcial está correta, e
-- o que faltava era a decisão escrita.
--
-- A unicidade `cobranca_empresa_codigo_key` é **total** (ADR-0015): o código é a referência citada
-- fora do sistema, e a série nunca reusa número.
--
-- Nenhuma concessão de TABELA é necessária: o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"`
-- de `0001_seguranca.sql` faz a concessão acompanhar a criação, tanto das tabelas quanto dos tipos.
-- Os `GRANT USAGE ON TYPE` explícitos ficam no `0010`, seguindo o precedente do `0001` e do `0008`.
--
-- Sem descida (`down`), pela mesma razão dos anteriores: o caminho de volta é restauração de
-- backup (§7.3 da tech spec).

CREATE TYPE "negocio"."natureza_cobranca" AS ENUM('ALUGUEL', 'AGUA', 'CONDOMINIO', 'ENERGIA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "negocio"."status_cobranca" AS ENUM('A_VENCER', 'VENCIDA', 'PAGA', 'CANCELADA');--> statement-breakpoint
CREATE TABLE "negocio"."cobranca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"contrato_id" uuid NOT NULL,
	"natureza" "negocio"."natureza_cobranca" NOT NULL,
	"referencia" text NOT NULL,
	"competencia" date NOT NULL,
	"data_vencimento" date NOT NULL,
	"valor_original" numeric(15, 2) NOT NULL,
	"pago_em" date,
	"valor_pago" numeric(15, 2),
	"cancelado_em" timestamp with time zone,
	"multa_aplicada" numeric(15, 2),
	"juros_aplicados" numeric(15, 2),
	"multa_percentual_aplicado" numeric(5, 2),
	"juros_percentual_aplicado" numeric(5, 2),
	"nosso_numero" text,
	"linha_digitavel" text,
	"codigo_barras" text,
	"data_credito" date,
	"valor_creditado" numeric(15, 2),
	"boleto_arquivo" text,
	CONSTRAINT "cobranca_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "cobranca_empresa_codigo_key" UNIQUE("empresa_id","codigo"),
	CONSTRAINT "cobranca_valor_positivo_chk" CHECK ("negocio"."cobranca"."valor_original" > 0),
	CONSTRAINT "cobranca_competencia_no_primeiro_dia_chk" CHECK (extract(day from "negocio"."cobranca"."competencia") = 1),
	CONSTRAINT "cobranca_desfecho_unico_chk" CHECK ("negocio"."cobranca"."pago_em" IS NULL OR "negocio"."cobranca"."cancelado_em" IS NULL),
	CONSTRAINT "cobranca_carimbo_coerente_chk" CHECK (("negocio"."cobranca"."pago_em" IS NULL) = ("negocio"."cobranca"."multa_aplicada" IS NULL)
        AND ("negocio"."cobranca"."pago_em" IS NULL) = ("negocio"."cobranca"."juros_aplicados" IS NULL)
        AND ("negocio"."cobranca"."pago_em" IS NULL) = ("negocio"."cobranca"."multa_percentual_aplicado" IS NULL)
        AND ("negocio"."cobranca"."pago_em" IS NULL) = ("negocio"."cobranca"."juros_percentual_aplicado" IS NULL)
        AND ("negocio"."cobranca"."pago_em" IS NULL) = ("negocio"."cobranca"."valor_pago" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."cobranca" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "negocio"."configuracao_de_mora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"multa_percentual" numeric(5, 2) DEFAULT '0' NOT NULL,
	"juros_percentual" numeric(5, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "configuracao_de_mora_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "configuracao_de_mora_empresa_key" UNIQUE("empresa_id"),
	CONSTRAINT "configuracao_de_mora_faixa_chk" CHECK ("negocio"."configuracao_de_mora"."multa_percentual" BETWEEN 0 AND 100 AND "negocio"."configuracao_de_mora"."juros_percentual" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "negocio"."configuracao_de_mora" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."cobranca" ADD CONSTRAINT "cobranca_contrato_empresa_fkey" FOREIGN KEY ("contrato_id","empresa_id") REFERENCES "negocio"."contrato"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."configuracao_de_mora" ADD CONSTRAINT "configuracao_de_mora_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cobranca_empresa_vencimento_idx" ON "negocio"."cobranca" USING btree ("empresa_id","data_vencimento");--> statement-breakpoint
CREATE INDEX "cobranca_empresa_contrato_idx" ON "negocio"."cobranca" USING btree ("empresa_id","contrato_id");--> statement-breakpoint
CREATE INDEX "cobranca_aberta_idx" ON "negocio"."cobranca" USING btree ("empresa_id","data_vencimento") WHERE pago_em IS NULL AND cancelado_em IS NULL;