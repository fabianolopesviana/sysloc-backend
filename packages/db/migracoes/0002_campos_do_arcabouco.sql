-- Campos que o arcabouço de identidade exige — GERADA por `drizzle-kit generate` a partir de
-- `src/esquema/identidade.ts`. Regenerar: `pnpm --filter @sysloc/db gerar-migracao`.
-- (O nome do arquivo e o `tag` de `meta/_journal.json` foram trocados à mão pelo nome descritivo,
-- no padrão de `0000_fundacao` e `0001_seguranca`; o gerador sorteia um nome sem significado.)
--
-- ---------------------------------------------------------------------------
-- Por que estas seis colunas existem, e por que não podiam esperar
-- ---------------------------------------------------------------------------
--
-- Nenhuma delas é campo do produto. São o que os modelos do arcabouço declaram, e o adaptador
-- Drizzle falha de dois jeitos distintos quando a coluna não existe — medidos contra o pacote
-- publicado: na CRIAÇÃO ele confere campo por coluna e levanta
-- `BetterAuthError: The field "<x>" does not exist in the "<model>" Drizzle schema`; na ATUALIZAÇÃO
-- ele não confere, e o campo simplesmente não chega ao banco.
--
--   * `usuario.email_verificado` e `usuario.atualizado_em` — o modelo `user` as declara
--     OBRIGATÓRIAS e com padrão, de modo que as duas viajam em **toda** criação de pessoa: o convite
--     de pessoa (T7/T8) detonaria na primeira. E o adaptador acrescenta `atualizado_em` a **todo**
--     update, onde a ausência da coluna não detona — perde o instante em silêncio, que é pior;
--   * `usuario.imagem` — o mesmo modelo a oferece como opcional;
--   * `dois_fatores.verificado`, `.falhas_verificacao` e `.bloqueado_ate` — as três são do plugin de
--     segundo fator, escritas **pelo próprio adaptador** (`input: false`). A T10, ao ligar o segundo
--     fator, cria a linha e falharia em `verificado`.
--
-- Migração é imutável: fechar isto mais tarde custaria outra migração, sobre um banco que já
-- atenderia a operação. A T6 é o último momento barato.
--
-- Nenhuma concessão nova é necessária: o `GRANT ... ON ALL TABLES IN SCHEMA identidade` de
-- `0001_seguranca.sql` é por TABELA, e alcança coluna acrescentada depois.
--
-- Sem descida (`down`), pela mesma razão do `0001`: o caminho de volta é restauração de backup.

ALTER TABLE "identidade"."dois_fatores" ADD COLUMN "verificado" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."dois_fatores" ADD COLUMN "falhas_verificacao" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."dois_fatores" ADD COLUMN "bloqueado_ate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD COLUMN "email_verificado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD COLUMN "imagem" text;--> statement-breakpoint
ALTER TABLE "identidade"."usuario" ADD COLUMN "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL;