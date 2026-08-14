-- Documentos e confirmação de endereço — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003`, `0005`, `0007`, `0009`
-- e `0011`: o nome do arquivo e o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo —
-- o gerador sorteia um nome sem significado (`0013_empty_thunderbolts`). **Nenhuma instrução foi
-- trocada de ordem e nenhuma foi editada**: o gerador emitiu a tabela, depois o `ENABLE ROW LEVEL
-- SECURITY`, depois a coluna nova do locatário, depois as duas chaves estrangeiras, depois o índice e
-- por fim o `DROP COLUMN`, de modo que o alvo de cada referência já existe quando ela é criada.
-- (Conferir vale a cada regeração, porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- ⚠️ Esta é a primeira migração DESTRUTIVA do produto, e ela NÃO tem descida
-- ---------------------------------------------------------------------------
--
-- A última instrução remove `negocio.contrato.pdf_contrato_arquivo` **e o dado que houver nela**. É
-- a materialização da **ADR-0030**: o documento do contrato é composto no instante do pedido e nunca
-- armazenado, de modo que não existe caminho de escrita dele — a coerência entre artefato e cadastro
-- vem da **ausência de cópia**, e não de uma rotina de invalidação. Com a coluna fora, a
-- pré-condição do legado *"sem PDF, não cancela"* deixa de ser representável (era o débito **D36**
-- da fatia `contratos-de-locacao`).
--
-- **Reverter exige restauração de backup**, que é o item 1 da F7 e ainda não está entregue. Aplicar
-- este arquivo a banco durável é ato sem volta enquanto aquele item não fechar. A ordem operacional
-- é **migrar → construir → reiniciar**: invertida, a API subiria contra um esquema que ainda tem a
-- coluna que o código já não conhece.
--
-- ---------------------------------------------------------------------------
-- A `0007` NÃO é emendada, e a razão é mecânica
-- ---------------------------------------------------------------------------
--
-- `deploy/scripts/instalacao/migrar-banco.sh` registra `sha256sum` por arquivo aplicado em
-- `identidade.migracao_aplicada` e **aborta** quando um arquivo já aplicado muda. Editar a `0007`
-- para tirar de lá a coluna quebraria a instalação de todo banco que já a aplicou, e não faria
-- diferença nenhuma para o banco vazio. Arquivo NOVO é correto nos dois estados possíveis.
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe um `0014`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma nem função. Sem `FORCE`, o DONO da tabela ignora a
-- política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum (ADR-0008,
-- Cons). O `FORCE`, a política e a função `SECURITY DEFINER` que resolve o portador vivem em
-- `0014_seguranca_confirmacao.sql`, escrito à mão, pela mesma regra que separou o `0001` do `0000`, o
-- `0006` do `0005`, o `0008` do `0007`, o `0010` do `0009` e o `0012` do `0011`: **gerado e autoral
-- nunca convivem no mesmo arquivo**, porque uma regeração futura sobrescreve o trecho autoral em
-- silêncio e ninguém percebe.
--
-- ⚠️ **A `0010` NÃO é tocada por esta fatia.** Ela carrega uma `DECISÃO FECHADA` e o
-- `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco durável e **fecha em
-- silêncio**. O par `0013`/`0014` são arquivos NOVOS.
--
-- ---------------------------------------------------------------------------
-- A tabela nova, e o que ela traz DESTE arquivo
-- ---------------------------------------------------------------------------
--
--   * `portador_de_confirmacao` — `empresa_id` não nulo, restrição única `(id, empresa_id)`, RLS
--     habilitada e **uma** chave estrangeira composta, para o locatário. A quarta propriedade
--     (`FORCE`) vem do `0014`; a guarda de cobertura de `src/catalogo.ts` é a autoridade sobre o
--     estado real das quatro, e reprova a tabela que nasça sem qualquer uma delas;
--   * **`portador_de_confirmacao_derivado_key` é unicidade GLOBAL**, e não por empresa: a resolução
--     acontece ANTES de existir contexto de tenant — é ela que descobre a empresa. Unicidade por
--     empresa admitiria colisão que a função `SECURITY DEFINER` teria de desempatar, e o desempate
--     só poderia vir do pedido, que é a segunda origem de contexto que a **ADR-0024** fecha;
--   * **não há coluna do segredo em claro** — a ausência é a decisão. O que se guarda é o derivado;
--   * **não há `retirado_em`**, e a guarda não a cobra de ninguém: o portador não é referenciável, e
--     a linha consumida **permanece** porque a RN-10 precisa distinguir *"já foi usado"* de *"nunca
--     existiu"*.
--
-- **`locatario.email_confirmado_em` é anulável e mora SÓ nessa tabela** — locador e fiador não a
-- ganham. É o **fato** (ADR-0022); o estado publicado é derivado dele, e nenhuma rotina "vira uma
-- bandeira" que possa deixar de rodar.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

CREATE TABLE "negocio"."portador_de_confirmacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"locatario_id" uuid NOT NULL,
	"derivado" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"consumido_em" timestamp with time zone,
	"invalidado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portador_de_confirmacao_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "portador_de_confirmacao_derivado_key" UNIQUE("derivado")
);
--> statement-breakpoint
ALTER TABLE "negocio"."portador_de_confirmacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."locatario" ADD COLUMN "email_confirmado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "negocio"."portador_de_confirmacao" ADD CONSTRAINT "portador_de_confirmacao_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."portador_de_confirmacao" ADD CONSTRAINT "portador_de_confirmacao_locatario_empresa_fkey" FOREIGN KEY ("locatario_id","empresa_id") REFERENCES "negocio"."locatario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portador_de_confirmacao_empresa_locatario_idx" ON "negocio"."portador_de_confirmacao" USING btree ("empresa_id","locatario_id");--> statement-breakpoint
ALTER TABLE "negocio"."contrato" DROP COLUMN "pdf_contrato_arquivo";