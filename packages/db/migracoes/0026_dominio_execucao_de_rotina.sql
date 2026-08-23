-- Domínio do registro de execução das rotinas agendadas — GERADA por `drizzle-kit generate` a
-- partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- DUAS intervenções à mão sobre a saída do gerador, e as duas são de SUPRESSÃO ou de nome — nenhuma
-- instrução foi editada, reordenada ou acrescentada.
--
-- A primeira é a do padrão de `0002`, `0003`, `0005`, `0007`, `0009`, `0011`, `0013`, `0015`,
-- `0017`, `0019`, `0021` e `0023`: o nome do arquivo e o `tag` de `meta/_journal.json` foram
-- trocados pelo nome descritivo — o gerador sorteia um nome sem significado
-- (`0026_lethal_harry_osborn`).
--
-- ---------------------------------------------------------------------------
-- A SEGUNDA: as cinco instruções sobre `entrega_da_noticia` foram REMOVIDAS, e a remoção é
-- obrigatória
-- ---------------------------------------------------------------------------
--
-- O gerador emitiu, além dos objetos desta fatia, o delta inteiro da `0025_estado_ternario_da_
-- entrega.sql`: `ADD COLUMN "situacao"`, `ADD COLUMN "referencia_no_provedor"`, o `DROP CONSTRAINT`
-- e os dois `ADD CONSTRAINT` das `CHECK` daquela tabela. A razão é mecânica e não é defeito da
-- `0025`: o snapshot de `meta/` só nasce em migração GERADA, e a `0025` é **autoral** — ela é a
-- primeira autoral do produto a alterar estrutura que o Drizzle declara, de modo que o gerador
-- ainda comparava o schema contra o estado anterior a ela.
--
-- Mantê-las ABORTARIA a instalação: aplicadas em ordem sobre um banco vazio, a `0025` cria a coluna
-- `situacao` e a `0026` tentaria criá-la de novo (`42701`, *column already exists*). Sobre o banco
-- durável, o mesmo — a `0025` já correu. Não há terceira leitura possível.
--
-- ⚠️ **O `meta/0026_snapshot.json` NÃO foi tocado, e é ele que fecha o caminho INCREMENTAL**: o
-- snapshot registra o estado do schema **declarado**, que já inclui `situacao`,
-- `referencia_no_provedor` e as duas `CHECK` na forma que a `0025` deixou (medido: o `prevId` dele é
-- o `id` de `meta/0023_snapshot.json`). Suprimir a instrução e preservar o snapshot é a única
-- combinação que deixa as duas pontas coerentes.
--
-- ⚠️ **Mas isso vale para a geração INCREMENTAL, e só para ela.** A separação é a mesma que o
-- `drizzle.config.ts` já faz para os dois `CREATE SCHEMA`, e é onde ela mora por extenso:
--
--   * **incremental** (`meta/` intacto, que é o caso normal): o gerador parte do snapshot e **não**
--     reemite o delta suprimido acima — não há nada a refazer;
--   * **do zero** (`meta/` descartado, ou regeração deste próprio arquivo): o snapshot não existe
--     para consultar, o delta da `0025` volta na saída, e **a supressão tem de ser refeita à mão**.
--
-- ⚠️ **E as duas correções intuitivas são erradas, uma delas DESTRUTIVA**: editar a `0025` (migração
-- já aplicada, conferida por `sha256sum` — a divergência **aborta a instalação** sobre o banco
-- durável) ou aceitar a saída do gerador como veio. A casa canônica desse conhecimento é o docblock
-- de `drizzle.config.ts`, seção *"A SEGUNDA classe de intervenção manual"* — é lá que quem
-- for regerar passa, e não aqui.
--
-- ---------------------------------------------------------------------------
-- Nenhuma instrução AUTORAL neste arquivo, e a ausência é a decisão
-- ---------------------------------------------------------------------------
--
-- É a regra que as irmãs enunciam: gerado e autoral nunca convivem no mesmo arquivo, porque uma
-- regeração apagaria o trecho autoral em silêncio — e este arquivo carrega, **na geração do zero**,
-- uma supressão a refazer à mão (ver a separação acima; na incremental não há nada a refazer). A RLS
-- desta tabela — `FORCE` e a política de isolamento — vive na parceira
-- `0027_seguranca_execucao_de_rotina.sql`.
--
-- O `ENABLE ROW LEVEL SECURITY` abaixo é do GERADOR, e vem do `.enableRLS()` do esquema; ele
-- habilita, mas **não** força nem cria política. Sem a parceira, a tabela fica sem política alguma
-- e o dono do schema a lê inteira.
--
-- Por que o enum tem exatamente TRÊS valores (vigilância e expurgo não gravam), por que não há
-- `retirado_em` nem `iniciada_em`/`concluida_em`, por que `resumo` é `jsonb` com `CHECK` só de
-- espécie e por que UM índice serve aos três usos: ver o docblock de `execucaoDeRotina` em
-- `src/esquema/negocio.ts`.

CREATE TYPE "negocio"."rotina_agendada" AS ENUM('AVISO_DE_COBRANCA', 'ENCERRAMENTO_DE_CONTRATOS', 'CONFERENCIA_DE_LIQUIDACAO');--> statement-breakpoint
CREATE TABLE "negocio"."execucao_de_rotina" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rotina" "negocio"."rotina_agendada" NOT NULL,
	"ocorrida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resumo" jsonb NOT NULL,
	CONSTRAINT "execucao_de_rotina_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "execucao_de_rotina_resumo_chk" CHECK (jsonb_typeof("negocio"."execucao_de_rotina"."resumo") = 'object')
);
--> statement-breakpoint
ALTER TABLE "negocio"."execucao_de_rotina" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."execucao_de_rotina" ADD CONSTRAINT "execucao_de_rotina_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "execucao_de_rotina_historico_idx" ON "negocio"."execucao_de_rotina" USING btree ("empresa_id","rotina","ocorrida_em" DESC NULLS LAST);
