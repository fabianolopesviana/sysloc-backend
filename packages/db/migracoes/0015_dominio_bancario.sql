-- Domínio bancário — GERADA por `drizzle-kit generate` a partir de `src/esquema/negocio.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao` (com `pnpm build` antes — ver o cabeçalho de
-- `drizzle.config.ts`).
--
-- UMA intervenção à mão sobre a saída do gerador, no padrão de `0002`, `0003`, `0005`, `0007`,
-- `0009`, `0011` e `0013`: o nome do arquivo e o `tag` de `meta/_journal.json` foram trocados pelo
-- nome descritivo — o gerador sorteia um nome sem significado (`0015_parallel_preak`). **Nenhuma
-- instrução foi trocada de ordem e nenhuma foi editada**: o gerador emitiu a tabela, depois o
-- `ENABLE ROW LEVEL SECURITY`, depois as duas chaves estrangeiras e por fim os dois índices, de modo
-- que o alvo de cada referência já existe quando ela é criada. (Conferir vale a cada regeração,
-- porque a ordem é do gerador, não nossa.)
--
-- ---------------------------------------------------------------------------
-- NENHUM `CREATE SCHEMA` — e desta vez o gerador não emitiu nenhum
-- ---------------------------------------------------------------------------
--
-- Os schemas nascem do provisionamento (`deploy/scripts/instalacao/provisionar-base.sh`), e a razão
-- está no cabeçalho da `0000_fundacao.sql`: criá-los na migração exigiria conceder ao papel de
-- migração o privilégio `CREATE` sobre um banco cujo dono é o papel da aplicação — poder maior do
-- que a tarefa pede. Esta geração foi **incremental** e `migracoes/meta/0000_snapshot.json` já
-- registra os schemas como existentes, então a supressão manual descrita em `drizzle.config.ts` não
-- teve o que suprimir. **Ela continua obrigatória numa geração DO ZERO**, e a guarda é executável:
-- `verificar-migracao.sh`, asserção `(e)`, exige zero `CREATE SCHEMA` em código nos arquivos de
-- migração, com o mutante ao lado provando que a varredura acusa.
--
-- ⚠️ O schema `plataforma`, que a parceira `0016` povoa, tem o MESMO desfecho — ele nasce no
-- provisionamento (e, na verificação, em `packages/db/test/banco-efemero.ts`), nunca aqui —, mas
-- **a razão é OUTRA, e confundi-las custa caro na fatia (iii)**:
--
--   * para `identidade` e `negocio`, o gerador CONHECE os schemas (há objetos deles declarados no
--     Drizzle) e só não os reemite porque esta geração foi incremental, com o snapshot anterior
--     registrando-os como existentes;
--   * para `plataforma`, o gerador NÃO O CONHECE. Ele está fora do `schemaFilter` de
--     `drizzle.config.ts` e **nenhum objeto dele é declarado no Drizzle** — a sequência e as duas
--     funções vivem só na `0016`, escrita à mão. Medido: nem `meta/0000_snapshot.json` nem
--     `meta/0015_snapshot.json` contêm a cadeia `plataforma`.
--
-- ⚠️ **Consequência para a fatia (iii)**: no dia em que a tabela crua da notificação bancária for
-- declarada em `plataforma` no Drizzle, o snapshot anterior não conterá o schema e o gerador
-- **proporá `CREATE SCHEMA "plataforma"`** — que a restrição de manutenção 1 proíbe. A supressão
-- manual volta a ser obrigatória ali, exatamente como numa geração do zero. E a "correção" intuitiva
-- — pôr `plataforma` no `schemaFilter` — é **errada**: aquela lista governa a introspecção de
-- `pull`/`push`, não a saída de `generate`, e não suprime linha alguma (ver o comentário do
-- `schemaFilter` em `drizzle.config.ts`, onde a medição está registrada).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e é por isso que existe uma `0016`
-- ---------------------------------------------------------------------------
--
-- Ele emite `ENABLE ROW LEVEL SECURITY` e **nada mais** de segurança: o gerador não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma, sequência nem função. Sem `FORCE`, o DONO da tabela
-- ignora a política, e a suíte de isolamento ficaria verde contra um schema sem isolamento nenhum
-- (ADR-0008, Cons). O `FORCE`, as duas políticas e os objetos de `plataforma` vivem em
-- `0016_seguranca_bancaria.sql`, escrito à mão, pela mesma regra que separou o `0001` do `0000`, o
-- `0006` do `0005`, o `0008` do `0007`, o `0010` do `0009`, o `0012` do `0011` e o `0014` do `0013`:
-- **gerado e autoral nunca convivem no mesmo arquivo**, porque uma regeração futura sobrescreve o
-- trecho autoral em silêncio e ninguém percebe.
--
-- ⚠️ **Nenhuma migração de `0000` a `0014` é tocada por esta fatia.** A `0010` carrega uma
-- `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho é a primeira aplicação a banco
-- durável e **fecha em silêncio**. O par `0015`/`0016` são arquivos NOVOS, e o `sha256sum` que
-- `migrar-banco.sh` registra por arquivo continua batendo para todas as anteriores.
--
-- ---------------------------------------------------------------------------
-- A tabela nova, e o que ela traz DESTE arquivo
-- ---------------------------------------------------------------------------
--
--   * `certificado_do_provedor` — `empresa_id` não nulo, restrição única `(id, empresa_id)`, RLS
--     habilitada e **uma** chave estrangeira composta, para o usuário que o registrou. A quarta
--     propriedade (`FORCE`) vem da `0016`; a guarda de cobertura de `src/catalogo.ts` é a autoridade
--     sobre o estado real das quatro, e reprova a tabela que nasça sem qualquer uma delas;
--   * **`certificado_do_provedor_vigente_uidx` sai DAQUI, e não da parceira autoral** — ele é
--     declarável no Drizzle (`uniqueIndex(...).where(...)`) e o gerador o emite corretamente, como
--     já emitiu `contrato_imovel_vigente_uidx` na `0007`. Escrevê-lo à mão na `0016` criaria uma
--     SEGUNDA declaração do mesmo índice: o schema declarado deixaria de o conter, e a regeração
--     seguinte proporia criá-lo de novo — a divergência silenciosa que o cabeçalho de
--     `drizzle.config.ts` nomeia como ruído permanente;
--   * **não há coluna do segredo em claro** — a ausência é a decisão (ADR-0032). O que se guarda é o
--     cifrado, e a chave que o desfaz não vive no banco;
--   * **não há `retirado_em`**, e a guarda não a cobra de ninguém: o certificado não é referenciável
--     (ADR-0014 não o alcança), e a linha substituída **permanece** porque ela é o histórico de com
--     qual material cada emissão foi assinada.
--
-- Sem descida (`down`): o caminho de volta é restauração de backup (§7.3 da tech spec).
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

CREATE TABLE "negocio"."certificado_do_provedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"titular" text NOT NULL,
	"valido_de" timestamp with time zone NOT NULL,
	"valido_ate" timestamp with time zone NOT NULL,
	"impressao_digital" text NOT NULL,
	"segredo_cifrado" text,
	"registrado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"substituido_em" timestamp with time zone,
	CONSTRAINT "certificado_do_provedor_id_empresa_key" UNIQUE("id","empresa_id"),
	CONSTRAINT "certificado_do_provedor_segredo_chk" CHECK (("negocio"."certificado_do_provedor"."segredo_cifrado" IS NULL) = ("negocio"."certificado_do_provedor"."substituido_em" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "negocio"."certificado_do_provedor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."certificado_do_provedor" ADD CONSTRAINT "certificado_do_provedor_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "identidade"."empresa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."certificado_do_provedor" ADD CONSTRAINT "certificado_do_provedor_usuario_empresa_fkey" FOREIGN KEY ("registrado_por","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificado_do_provedor_vigente_uidx" ON "negocio"."certificado_do_provedor" USING btree ("empresa_id") WHERE substituido_em IS NULL;--> statement-breakpoint
CREATE INDEX "certificado_do_provedor_historico_idx" ON "negocio"."certificado_do_provedor" USING btree ("empresa_id","criado_em" DESC NULLS LAST);