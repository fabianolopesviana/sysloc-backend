-- Domínio do batimento das rotinas agendadas — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- DUAS intervenções à mão sobre a saída do gerador, e as duas são de SUPRESSÃO ou de nome — nenhuma
-- instrução foi editada, reordenada ou acrescentada.
--
-- A primeira é a do padrão de `0002`, `0003`, `0005`, `0007`, `0009`, `0011`, `0013`, `0015`,
-- `0017`, `0019`, `0021`, `0023` e `0026`: o nome do arquivo e o `tag` de `meta/_journal.json`
-- foram trocados pelo nome descritivo — o gerador sorteia um nome sem significado
-- (`0029_crazy_invisible_woman`).
--
-- ---------------------------------------------------------------------------
-- A SEGUNDA: a instrução sobre `identidade.empresa` foi REMOVIDA, e a remoção é obrigatória
-- ---------------------------------------------------------------------------
--
-- O gerador emitiu, além da tabela desta correção, o delta inteiro da
-- `0028_email_de_contato_da_empresa.sql`:
--
--     ALTER TABLE "identidade"."empresa" ADD COLUMN "email_contato" text;
--
-- A razão é mecânica e não é defeito da `0028`: o snapshot de `meta/` só nasce em migração GERADA,
-- e a `0028` é **autoral** — de modo que o gerador ainda comparava o schema contra o estado
-- anterior a ela. Mantê-la aqui faria a instalação abortar sobre um banco onde a `0028` já correu,
-- porque `ADD COLUMN` sem `IF NOT EXISTS` recusa coluna que já existe.
--
-- ⚠️ É a **segunda ocorrência** desta classe no repositório, exatamente como o `D5 · F5/T3`
-- previu ao se declarar RECORRENTE: *"a próxima migração autoral que alterar estrutura declarada em
-- `src/esquema/*.ts`"*. A primeira foi a `0025` reemitida dentro da `0026`. **Cumprir o gatilho não
-- extingue o débito** — a obrigação volta idêntica na próxima regeração, porque a causa é do
-- `drizzle-kit` e não deste repositório.
--
-- ---------------------------------------------------------------------------
-- POR QUE ESTA TABELA EXISTE
-- ---------------------------------------------------------------------------
--
-- `negocio.execucao_de_rotina` guarda o HISTÓRICO e, por decisão (RD-15), só recebe linha quando a
-- passagem produziu efeito. A vigilância das rotinas (RN-18) pergunta outra coisa — *"a rotina
-- executou?"* — e, até esta tabela existir, recebia a resposta da primeira: rotina pontual sem
-- trabalho era indistinguível de rotina parada.
--
-- Medido em produção em 2026-09-08: as três rotinas publicadas anunciadas como *"rotina agendada
-- parada"* a cada 15 minutos, com os relógios disparando pontualmente. O detalhe está no docblock
-- de `passagemDeRotina`, em `src/esquema/negocio.ts`.
--
-- ⚠️ A restrição `passagem_de_rotina_empresa_rotina_key` **não é ornamento**: ela é o alvo do
-- `ON CONFLICT` do batimento, e é o que mantém o acervo em três linhas por empresa. Sem ela, cada
-- passagem acrescentaria uma linha — reintroduzindo, com outro nome, o acervo de ~525 mil linhas por
-- ano por empresa que a RD-15 recusa.

CREATE TABLE "negocio"."passagem_de_rotina" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"rotina" "negocio"."rotina_agendada" NOT NULL,
	"ocorrida_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passagem_de_rotina_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "passagem_de_rotina_empresa_rotina_key" UNIQUE("empresa_id","rotina")
);
--> statement-breakpoint
ALTER TABLE "negocio"."passagem_de_rotina" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."passagem_de_rotina" ADD CONSTRAINT "passagem_de_rotina_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;
