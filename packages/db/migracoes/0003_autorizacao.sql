-- Substrato de dados da autorização — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/negocio.ts` e `src/esquema/identidade.ts`.
-- Regenerar: `pnpm --filter @sysloc/db gerar-migracao`.
--
-- Duas intervenções à mão sobre a saída do gerador, ambas no padrão de `0002_campos_do_arcabouco`:
--
--   1. o nome do arquivo e o `tag` de `meta/_journal.json` foram trocados pelo nome descritivo, no
--      padrão de `0000_fundacao` e `0001_seguranca` — o gerador sorteia um nome sem significado;
--   2. **duas instruções foram TROCADAS DE ORDEM**, e isto é correção, não estilo: o gerador emitiu
--      a chave estrangeira composta de `negocio.acesso_usuario_app` ANTES da restrição de unicidade
--      `identidade.usuario (id, empresa_id)` que é o alvo dela. O PostgreSQL exige que o par
--      referenciado já seja único no instante em que a referência é criada, e o arquivo inteiro
--      corre numa transação implícita — na ordem gerada, a migração aborta com
--      `there is no unique constraint matching given keys for referenced table "usuario"`.
--      Quem regenerar do zero tem de refazer a troca; o CT-207 é o que reprova se ela se perder,
--      porque sem a migração aplicada não há restrição a nomear.
--
-- ---------------------------------------------------------------------------
-- O que entra aqui, e por que o valor novo do enum de desfecho NÃO entra
-- ---------------------------------------------------------------------------
--
-- Este arquivo é **inteiramente** o que o schema declarado produz. O acréscimo de valor ao enum
-- `identidade.desfecho_tentativa` vive em `0004_desfecho_de_recusa.sql`, escrito à mão, e a
-- separação é a mesma regra que separou `0001_seguranca.sql` do `0000`: **gerado e autoral nunca
-- convivem no mesmo arquivo**, porque uma regeneração futura sobrescreve o trecho autoral em
-- silêncio e ninguém percebe.
--
-- ---------------------------------------------------------------------------
-- As cinco coisas que esta migração instala
-- ---------------------------------------------------------------------------
--
--   * **`negocio.efeito_permissao`** — o enum que torna o ajuste bidirecional representável. A
--     coluna `efeito` é NOT NULL e SEM PADRÃO de propósito: quem escreve um ajuste declara se ele
--     concede ou retira, e um padrão escolheria por omissão entre as duas. O `ADD COLUMN ... NOT
--     NULL` sem padrão só é aplicável porque a tabela nasceu vazia na fatia anterior e nenhum
--     caminho a povoa até aqui;
--   * **`acesso_usuario_permissao_acesso_tipo_chave_key`** — a unicidade que torna o conflito
--     irrepresentável: concessão e negação da mesma chave para o mesmo vínculo não coexistem, e a
--     precedência da negação nunca precisa arbitrar dado inconsistente (CT-206);
--   * **`identidade.usuario.versao_permissoes`** — o contador que faz a sessão saber que o efetivo
--     que ela carrega ficou velho. Fica na pessoa, e não no vínculo, porque o Sysloc Master não tem
--     vínculo (decisão D3 do tech-alignment);
--   * **`usuario_id_empresa_key` + `acesso_usuario_app_usuario_empresa_fkey`** — a conciliação
--     estrutural do débito D5: um vínculo cuja empresa difere da empresa da pessoa passa a ser
--     recusado PELO BANCO (ADR-0008), e não por validação de aplicação (CT-207). A unicidade
--     **não** tenantiza `identidade.usuario` — ela é apenas o alvo que o PostgreSQL exige, e a
--     ADR-0009 permanece intacta;
--   * **`identidade.sessao.telas`, `.acoes` e `.versao_permissoes`** — o efetivo transportado no
--     registro de sessão, com arranjo vazio como padrão: sessão sem efetivo escrito não alcança
--     nada, que é o lado seguro.
--
-- Nenhuma concessão nova é necessária: o `GRANT ... ON ALL TABLES` de `0001_seguranca.sql` é por
-- TABELA e alcança coluna acrescentada depois, e o `ALTER DEFAULT PRIVILEGES ... GRANT USAGE ON
-- TYPES` do mesmo arquivo alcança o enum criado aqui, por ser criado pelo papel `sysloc_migracao`.
--
-- Nenhuma tabela nova nasce em `negocio`: a guarda de cobertura de isolamento (`src/catalogo.ts`)
-- examina o mesmo conjunto de antes.
--
-- Sem descida (`down`), pela mesma razão do `0001` e do `0002`: o caminho de volta é restauração de
-- backup. Reverter o código basta — as colunas novas ficam ignoradas pelo código antigo, e nenhuma
-- restrição nova recusa escrita que ele faria.

CREATE TYPE "negocio"."efeito_permissao" AS ENUM('CONCEDIDA', 'NEGADA');--> statement-breakpoint
ALTER TABLE "identidade"."sessao" ADD COLUMN "telas" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."sessao" ADD COLUMN "acoes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."sessao" ADD COLUMN "versao_permissoes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD COLUMN "versao_permissoes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_permissao" ADD COLUMN "efeito" "negocio"."efeito_permissao" NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD CONSTRAINT "usuario_id_empresa_key" UNIQUE("id","empresa_id");--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_app" ADD CONSTRAINT "acesso_usuario_app_usuario_empresa_fkey" FOREIGN KEY ("usuario_id","empresa_id") REFERENCES "identidade"."usuario"("id","empresa_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negocio"."acesso_usuario_permissao" ADD CONSTRAINT "acesso_usuario_permissao_acesso_tipo_chave_key" UNIQUE("acesso_id","tipo","chave");
