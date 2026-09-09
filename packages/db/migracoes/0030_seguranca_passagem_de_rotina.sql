-- Segurança do batimento das rotinas agendadas — arquivo AUTORAL, parceiro de
-- `0029_dominio_passagem_de_rotina.sql`.
--
-- ⚠️ **Autoral e gerado nunca convivem**: a `0029` é saída de `drizzle-kit generate` e pode ser
-- regerada a qualquer momento — e, numa geração DO ZERO, ela ainda carrega uma supressão a refazer à
-- mão (o delta da `0028`, que o cabeçalho dela separa). Um trecho autoral lá seria apagado em
-- silêncio na regeração seguinte. Tudo o que o gerador não sabe emitir — `FORCE ROW LEVEL SECURITY`
-- e a política de isolamento — mora aqui.
--
-- ---------------------------------------------------------------------------
-- POR QUE `FORCE`, e não apenas `ENABLE`
-- ---------------------------------------------------------------------------
--
-- A `0029` emite `ENABLE ROW LEVEL SECURITY`, que vem do `.enableRLS()` do esquema. `ENABLE`
-- sozinho **não alcança o dono da tabela**: o papel que a criou continua lendo tudo, de todas as
-- empresas. `FORCE` fecha exatamente esse caminho, e é a forma que a `0027`, a `0024`, a `0022`, a
-- `0018` e a `0016` já usam. É também o que impede a suíte de isolamento de ficar verde sem provar
-- nada (ADR-0008, Cons: "suíte que conecte com o papel errado fica verde sem provar nada").
--
-- ⚠️ **A guarda de cobertura de `src/catalogo.ts` cobra as duas colunas de `pg_class`** —
-- `relrowsecurity` E `relforcerowsecurity` —, nunca só a primeira. Uma tabela nova em `negocio` sem
-- este arquivo reprova a suíte, e é assim que a regra não fica dependendo de disciplina.
--
-- ---------------------------------------------------------------------------
-- NENHUM `GRANT` AQUI, e a ausência é a decisão
-- ---------------------------------------------------------------------------
--
-- O `ALTER DEFAULT PRIVILEGES` de `0001_seguranca.sql` alcança `sysloc_app`, de modo que toda
-- tabela nova do schema `negocio` já nasce com os privilégios dele. Um `GRANT` explícito aqui seria
-- uma segunda declaração do mesmo fato, livre para divergir daquela.
--
-- ---------------------------------------------------------------------------
-- NENHUM PAPEL DE LEITURA SEM CONTEXTO DE EMPRESA
-- ---------------------------------------------------------------------------
--
-- Mesma razão que a `0027` fixa para a tabela irmã: o agendador percorre as empresas **uma a uma**,
-- fixando o contexto de cada uma antes de qualquer leitura ou gravação. A empresa é conhecida
-- **antes** do alcance ao dado, e nunca o resultado dele — de modo que não existe aqui o caso que a
-- exceção da ADR-0024 admite. Um papel de leitura sem contexto daria ao processo de trabalho um
-- caminho para o batimento de todas as empresas de uma vez.
--
-- ---------------------------------------------------------------------------
-- A POLÍTICA É `FOR ALL`, e o `WITH CHECK` importa mais aqui do que na irmã
-- ---------------------------------------------------------------------------
--
-- O batimento é escrito por `INSERT … ON CONFLICT DO UPDATE`, que exerce **as duas** metades da
-- política: o `USING` decide qual linha o `ON CONFLICT` alcança, e o `WITH CHECK` decide o que a
-- escrita pode gravar. Uma política só de leitura deixaria a atualização de outra empresa passar
-- pelo caminho do conflito — que é exatamente o alcance que esta tabela concentra, por ter uma
-- linha por par `(empresa, rotina)`.

ALTER TABLE "negocio"."passagem_de_rotina" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "passagem_de_rotina_isolamento_empresa"
	ON "negocio"."passagem_de_rotina"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
