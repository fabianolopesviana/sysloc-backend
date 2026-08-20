-- Domínio do webhook e do carnê — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts` e do arquivo NOVO `src/esquema/plataforma.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- DUAS intervenções à mão sobre a saída do gerador. A primeira é a do padrão de `0002`, `0003`,
-- `0005`, `0007`, `0009`, `0011`, `0013`, `0015` e `0017`: o nome do arquivo e o `tag` de
-- `meta/_journal.json` foram trocados pelo nome descritivo — o gerador sorteia um nome sem
-- significado (`0019_white_vivisector`). A segunda é a **supressão do `CREATE SCHEMA`**, descrita
-- logo abaixo, e é a primeira vez que ela tem o que suprimir. **Nenhuma instrução foi trocada de
-- ordem e nenhuma foi editada**: o gerador emitiu o tipo novo, os dois `ALTER TYPE … ADD VALUE`, a
-- tabela com o `check`, o `RENAME COLUMN` e por fim os três índices, de modo que o alvo de cada
-- instrução já existe quando ela corre. (Conferir vale a cada regeração, porque a ordem é do
-- gerador, não nossa.)
--
-- ⚠️ **Não há instrução AUTORAL neste arquivo, e a ausência é a decisão.** Houve uma — o
-- `ALTER TABLE "negocio"."cobranca_derivada" RENAME COLUMN`, escrito na T2 porque a parceira `0020`
-- ainda não existia —, e a T3 a moveu para lá assim que o arquivo autoral passou a existir. A regra
-- que este cabeçalho enuncia mais abaixo (*gerado e autoral nunca convivem no mesmo arquivo*) não
-- era retórica aqui: a supressão do `CREATE SCHEMA` declarada logo adiante torna a regeração deste
-- arquivo **esperada e recorrente**, e cada regeração apagaria o trecho autoral em silêncio. Quem
-- regerar este arquivo pode substituí-lo pela saída do gerador **menos o `CREATE SCHEMA`**, sem
-- resgatar nada.
--
-- ---------------------------------------------------------------------------
-- O `CREATE SCHEMA "plataforma"` FOI EMITIDO e foi REMOVIDO à mão — e desta vez não era hipótese
-- ---------------------------------------------------------------------------
--
-- Os cabeçalhos da `0015` e da `0017` anunciam este momento com todas as letras: *"no dia em que a
-- tabela crua da notificação bancária for declarada em `plataforma`, o gerador proporá
-- `CREATE SCHEMA` … que a restrição de manutenção 1 proíbe"*. Esta fatia é a **primeira** a declarar
-- objeto de `plataforma` no Drizzle (`src/esquema/plataforma.ts`), nenhum snapshot anterior registra
-- o schema — medido: nem `meta/0000_snapshot.json` nem `meta/0017_snapshot.json` contêm a cadeia
-- `plataforma` —, e a instrução veio na primeira linha da saída. Ela foi removida.
--
-- Por que ela não pode ficar: os schemas nascem do provisionamento
-- (`deploy/scripts/instalacao/provisionar-base.sh`, `SCHEMA_PLATAFORMA`) e, na verificação, de
-- `test/banco-efemero.ts` (a lista `SCHEMAS` já o traz). Criá-los na migração exigiria conceder ao
-- papel de migração o privilégio `CREATE` sobre um banco cujo dono é outro papel — poder maior do
-- que a tarefa pede, e a razão por extenso está no cabeçalho da `0000_fundacao.sql`.
--
-- ⚠️ **A supressão é obrigatória A CADA regeração deste arquivo**, e não uma vez só. A "correção"
-- intuitiva — pôr `plataforma` no `schemaFilter` de `drizzle.config.ts` — é **errada e está medida**:
-- aquela lista governa a introspecção de `pull`/`push`, nunca a saída de `generate`. O detector é
-- executável e roda em `deploy/scripts/instalacao/verificar-migracao.sh`, asserção `(e)`: **zero**
-- `CREATE SCHEMA` em código nos arquivos de migração, com o mutante ao lado provando que a varredura
-- acusa. A citação em COMENTÁRIO, como esta, não conta — a varredura remove comentário antes de
-- casar, e essa exclusão é ela própria exercitada por um controle.
--
-- ---------------------------------------------------------------------------
-- Por que os dois `ALTER TYPE … ADD VALUE` estão AQUI, e não na parceira `0020`
-- ---------------------------------------------------------------------------
--
-- `ALTER TYPE … ADD VALUE` não corre dentro de bloco transacional em todos os contextos, e a `0020`
-- é a migração de **efetivo de permissão** (papel, política, `GRANT`, `REVOKE`, função
-- `SECURITY DEFINER`), cuja ordem interna — `REVOKE` antes de `GRANT`, `OWNER TO` por último — é o
-- molde literal da `0014`. Misturar as duas coisas amarraria uma instrução com restrição de
-- transação a um bloco cuja ordem é a garantia. Aqui os dois valores entram no **fim** de cada enum,
-- que é onde `ADD VALUE` sem `BEFORE`/`AFTER` os põe: é a mesma posição que os arranjos congelados de
-- `@sysloc/contracts` declaram, e a igualdade posicional entre os dois lados é o que o `CT-939`
-- afirma (ADR-0016 — o contrato é a fonte, o enum do banco deriva).
--
-- ---------------------------------------------------------------------------
-- O `RENAME COLUMN` fecha o `D14 · F4/T6`, e a VISÃO é renomeada na `0020`
-- ---------------------------------------------------------------------------
--
-- `negocio.cobranca.nosso_numero` era **vocabulário do provedor** numa coluna do produto (ADR-0001),
-- e o gatilho registrado no marcador era literal: *"a fatia (iii) ao consumir a coluna"*. Ela é
-- consumida na conferência da notícia recebida, e o marcador sai no mesmo commit deste arquivo.
--
-- ⚠️ **O renome da coluna-base NÃO alcança a visão, e a instrução que a alcança NÃO mora aqui.**
-- `negocio.cobranca_derivada` expandiu `c.*` no instante em que a `0010` a criou, de modo que o nome
-- de saída dela ficou gravado na definição. Quem a faz publicar o nome novo é um
-- `ALTER TABLE "negocio"."cobranca_derivada" RENAME COLUMN`, e ele vive no **bloco 2 da parceira
-- `0020_seguranca_webhook_e_carne.sql`** — que é escrita à mão e roda logo depois deste arquivo, de
-- modo que a coluna-base já está renomeada quando ele corre.
--
-- **A razão de ele viver lá é a regra que este cabeçalho enuncia mais abaixo**: *gerado e autoral
-- nunca convivem no mesmo arquivo*. Ele nasceu aqui, na T2, porque a `0020` ainda não existia; a
-- T3, que a criou, o moveu — e a janela para mover era esta, porque migração já aplicada a banco
-- durável é imutável, conferida por `sha256sum` (é o que o `D20 · F3/T7` registra). Mantê-lo aqui
-- teria custo medido e não hipotético: o bloco acima declara que a supressão do `CREATE SCHEMA` é
-- **obrigatória a cada regeração deste arquivo**, e uma regeração sobrescreve o trecho autoral em
-- silêncio — a visão voltaria a publicar `nosso_numero` sem que nada no diff dissesse por quê.
--
-- ⚠️ **A REDE daquela instrução é executável, e é o `CT-510 (e)`** de
-- `packages/db/test/fonte-unica-do-estado.spec.ts`: ele lê do catálogo as colunas de
-- `negocio.cobranca_derivada` na ordem de `ordinal_position` e as compara por IGUALDADE DE LISTA
-- contra 31 nomes escritos à mão. Ela continua valendo **onde quer que a instrução viva** — e é por
-- isso que mover não afrouxou nada.
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe uma `0020`
-- ---------------------------------------------------------------------------
--
-- Nenhum `GRANT`, nenhum `REVOKE`, nenhuma política, nenhum papel, nenhuma função. O papel
-- `sysloc_roteamento`, a política nominal em `negocio.cobranca`, a função `SECURITY DEFINER` do
-- roteamento e o `GRANT … ON plataforma.notificacao_bancaria TO sysloc_app` vivem em
-- `0020_seguranca_webhook_e_carne.sql`, escrita à mão, pela mesma regra que separou o `0001` do
-- `0000` até o `0018` do `0017`: **gerado e autoral nunca convivem no mesmo arquivo**, porque uma
-- regeração futura sobrescreve o trecho autoral em silêncio e ninguém percebe.
--
-- ---------------------------------------------------------------------------
-- A tabela de `plataforma` NÃO tem `empresa_id` e NÃO habilita RLS — as duas ausências são a decisão
-- ---------------------------------------------------------------------------
--
-- ADR-0031: tabela que não é dado de negócio de empresa nenhuma vive fora do schema de negócio e não
-- carrega coluna de empresa. A notícia crua é gravada **antes** do roteamento, inclusive quando não
-- casa com cobrança alguma — e nesse caso não há empresa derivável. `ENABLE ROW LEVEL SECURITY` não
-- aparece aqui, e a ausência é deliberada: em `plataforma` não há política de linha a impor (a
-- própria ADR declara nos `Cons` que a proteção ali *"é papel de conexão e privilégio, não RLS"*), e
-- `ENABLE` sem política faria o PostgreSQL negar tudo a quem não é dono — a tabela pararia de aceitar
-- a notícia que ela existe para guardar.
--
-- A admissão é conferida no catálogo do sistema, **nas duas pontas**, por
-- `src/catalogo-de-plataforma.ts`: `ROSTER_DE_PLATAFORMA` deixa de ser vazio nesta fatia e passa a
-- conter exatamente `plataforma.notificacao_bancaria`.
--
-- ---------------------------------------------------------------------------
-- Sem `down`
-- ---------------------------------------------------------------------------
--
-- Este projeto não tem migração reversível: as migrações são imutáveis e conferidas por `sha256sum`
-- por `migrar-banco.sh` (o `D20 · F3/T7` registra a consequência), e o desfazimento é operacional.
-- ⚠️ **Nenhuma migração de `0000` a `0018` é tocada por esta fatia** — o `sha256sum` de todas elas
-- continua batendo.

CREATE TYPE "plataforma"."desfecho_da_notificacao" AS ENUM('RECEBIDO', 'VALIDACAO_DE_ENDERECO', 'ILEGIVEL', 'SEM_CORRESPONDENCIA', 'DIVERGENTE', 'RETIDO', 'REENTREGA', 'CONFERIDO_SEM_EFEITO', 'APLICADO');--> statement-breakpoint
ALTER TYPE "negocio"."origem_do_evento_bancario" ADD VALUE 'NOTICIA_DO_PROVEDOR';--> statement-breakpoint
ALTER TYPE "negocio"."tipo_de_evento_bancario" ADD VALUE 'NOTICIA_RECUSADA';--> statement-breakpoint
CREATE TABLE "plataforma"."notificacao_bancaria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recebido" jsonb NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"desfecho" "plataforma"."desfecho_da_notificacao" DEFAULT 'RECEBIDO' NOT NULL,
	"identificador_perante_o_provedor" text,
	"identificador_da_liquidacao" text,
	"diagnostico" text,
	"tratado_em" timestamp with time zone,
	CONSTRAINT "notificacao_bancaria_tratamento_chk" CHECK (("plataforma"."notificacao_bancaria"."tratado_em" IS NULL) = ("plataforma"."notificacao_bancaria"."desfecho" = 'RECEBIDO'))
);
--> statement-breakpoint
ALTER TABLE "negocio"."cobranca" RENAME COLUMN "nosso_numero" TO "numero_do_titulo_no_provedor";--> statement-breakpoint
CREATE INDEX "notificacao_bancaria_expurgo_idx" ON "plataforma"."notificacao_bancaria" USING btree ("recebido_em");--> statement-breakpoint
CREATE INDEX "notificacao_bancaria_retida_idx" ON "plataforma"."notificacao_bancaria" USING btree ("recebido_em") WHERE desfecho = 'RETIDO';--> statement-breakpoint
CREATE INDEX "notificacao_bancaria_efeito_idx" ON "plataforma"."notificacao_bancaria" USING btree ("identificador_da_liquidacao") WHERE desfecho = 'APLICADO';