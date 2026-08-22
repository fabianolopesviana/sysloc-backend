-- Segurança do estado da entrega da notícia — arquivo AUTORAL, parceiro de
-- `0023_dominio_entrega_da_noticia.sql`.
--
-- ⚠️ **Autoral e gerado nunca convivem**: a `0023` é saída de `drizzle-kit generate` e pode ser
-- regerada a qualquer momento; um trecho autoral lá seria apagado em silêncio na regeração. Tudo o
-- que o gerador não sabe emitir — `FORCE ROW LEVEL SECURITY` e a política de isolamento — mora aqui.
--
-- ---------------------------------------------------------------------------
-- POR QUE `FORCE`, e não apenas `ENABLE`
-- ---------------------------------------------------------------------------
--
-- A `0023` emite `ENABLE ROW LEVEL SECURITY`, que vem do `.enableRLS()` do esquema. `ENABLE` sozinho
-- **não alcança o dono da tabela**: o papel que a criou continua lendo tudo, de todas as empresas.
-- `FORCE` fecha exatamente esse caminho, e é a forma que a `0022`, a `0018` e a `0016` já usam.
--
-- ---------------------------------------------------------------------------
-- NENHUM `GRANT` AQUI, e a ausência é a decisão
-- ---------------------------------------------------------------------------
--
-- O `ALTER DEFAULT PRIVILEGES` de `0001_seguranca.sql` alcança `sysloc_app`, de modo que toda tabela
-- nova do schema `negocio` já nasce com os privilégios dele. Um `GRANT` explícito aqui seria uma
-- segunda declaração do mesmo fato, livre para divergir daquela.
--
-- ---------------------------------------------------------------------------
-- NENHUM PAPEL DE LEITURA SEM CONTEXTO DE EMPRESA — e a distinção importa
-- ---------------------------------------------------------------------------
--
-- Diferente de `negocio.cobranca`, que a `0020` abre a `sysloc_roteamento` para a **travessia
-- nominal** da notícia bancária (ADR-0024, emenda de 2026-08-18), esta tabela nunca é lida fora do
-- contexto da empresa. Aquele caso é distinto e **não se copia para cá**: lá a empresa é o
-- *resultado* da travessia, e por isso a leitura precede o contexto; aqui a empresa já é conhecida
-- antes de qualquer leitura — é ela quem o Admin autenticou, ou a que a carga da reconferência
-- carrega porque quem enfileirou já detinha direito a ela.
--
-- Abrir um papel de leitura aqui seria acrescentar a esta tabela a única forma de alcance que a
-- ADR-0024 admite por exceção, sem que exista o caso que a justifica.

ALTER TABLE "negocio"."entrega_da_noticia" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "entrega_da_noticia_isolamento_empresa"
	ON "negocio"."entrega_da_noticia"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
