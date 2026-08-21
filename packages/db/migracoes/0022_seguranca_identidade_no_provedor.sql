-- Segurança da identidade no provedor — arquivo AUTORAL, parceiro de
-- `0021_dominio_identidade_no_provedor.sql`.
--
-- ⚠️ **Autoral e gerado nunca convivem**: a `0021` é saída de `drizzle-kit generate` e pode ser
-- regerada a qualquer momento; um trecho autoral lá seria apagado em silêncio na regeração. Tudo o
-- que o gerador não sabe emitir — `FORCE ROW LEVEL SECURITY` e a política de isolamento — mora aqui.
--
-- ---------------------------------------------------------------------------
-- POR QUE `FORCE`, e não apenas `ENABLE`
-- ---------------------------------------------------------------------------
--
-- A `0021` emite `ENABLE ROW LEVEL SECURITY`, que vem do `.enableRLS()` do esquema. `ENABLE` sozinho
-- **não alcança o dono da tabela**: o papel que a criou continua lendo tudo, de todas as empresas.
-- `FORCE` fecha exatamente esse caminho, e é a forma que a `0016` já usa no certificado — a tabela
-- irmã, com o mesmo tipo de conteúdo.
--
-- ---------------------------------------------------------------------------
-- NENHUM `GRANT` AQUI, e a ausência é a decisão
-- ---------------------------------------------------------------------------
--
-- O `ALTER DEFAULT PRIVILEGES` de `0001_seguranca.sql` alcança `sysloc_app`, de modo que toda tabela
-- nova do schema `negocio` já nasce com os privilégios dele. Um `GRANT` explícito aqui seria uma
-- segunda declaração do mesmo fato, livre para divergir daquela.
--
-- Não há papel de leitura sem contexto de empresa para esta tabela — diferente de
-- `negocio.cobranca`, que a `0020` abre a `sysloc_roteamento` para a travessia nominal da notícia
-- bancária (ADR-0024, emenda de 2026-08-18). A identidade nunca é lida fora do contexto da empresa:
-- quem a consome é o processo de trabalho que já resolveu a empresa pela cobrança encontrada.

ALTER TABLE "negocio"."identidade_no_provedor" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "identidade_no_provedor_isolamento_empresa"
	ON "negocio"."identidade_no_provedor"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
