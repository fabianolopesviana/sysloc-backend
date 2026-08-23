-- Segurança do registro de execução das rotinas agendadas — arquivo AUTORAL, parceiro de
-- `0026_dominio_execucao_de_rotina.sql`.
--
-- ⚠️ **Autoral e gerado nunca convivem**: a `0026` é saída de `drizzle-kit generate` e pode ser
-- regerada a qualquer momento — e, numa geração DO ZERO, ela ainda carrega uma supressão a refazer à
-- mão (o delta da `0025`, que o cabeçalho dela separa por cenário). Um trecho autoral lá seria
-- apagado em silêncio na regeração seguinte. Tudo o que o gerador não sabe emitir —
-- `FORCE ROW LEVEL SECURITY` e a política de isolamento — mora aqui.
--
-- ---------------------------------------------------------------------------
-- POR QUE `FORCE`, e não apenas `ENABLE`
-- ---------------------------------------------------------------------------
--
-- A `0026` emite `ENABLE ROW LEVEL SECURITY`, que vem do `.enableRLS()` do esquema. `ENABLE`
-- sozinho **não alcança o dono da tabela**: o papel que a criou continua lendo tudo, de todas as
-- empresas. `FORCE` fecha exatamente esse caminho, e é a forma que a `0024`, a `0022`, a `0018` e a
-- `0016` já usam. É também o que impede a suíte de isolamento de ficar verde sem provar nada
-- (ADR-0008, Cons: "suíte que conecte com o papel errado fica verde sem provar nada") — e por isso
-- o `CT-1073` afirma **as duas** colunas de `pg_class`, `relrowsecurity` e `relforcerowsecurity`,
-- nunca só a primeira.
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
-- NENHUM PAPEL DE LEITURA SEM CONTEXTO DE EMPRESA — e a distinção importa
-- ---------------------------------------------------------------------------
--
-- Diferente de `negocio.cobranca`, que a `0020` abre a `sysloc_roteamento` para a **travessia
-- nominal** da notícia bancária (ADR-0024, emenda de 2026-08-18), esta tabela nunca é lida fora do
-- contexto da empresa. O agendador percorre as empresas **uma a uma**, fixando o contexto de cada
-- uma antes de qualquer leitura ou gravação: a empresa é conhecida **antes** do alcance ao dado, e
-- nunca o resultado dele. Um papel de leitura sem contexto acrescentaria aqui a única forma de
-- alcance que a ADR-0024 admite por exceção, sem que exista o caso que a justifica — e ele daria ao
-- processo de trabalho um caminho para o histórico de todas as empresas de uma vez.
--
-- ---------------------------------------------------------------------------
-- A política é UMA, `FOR ALL`, com `USING` **e** `WITH CHECK`
-- ---------------------------------------------------------------------------
--
-- Uma só, porque duas políticas na mesma tabela se combinam por OU lógico: a segunda poderia
-- alargar o que a primeira restringe sem que a inspeção da primeira acusasse. E `WITH CHECK`
-- escrito por extenso, e não omitido: omitido, ele é **substituído pelo `USING` em silêncio**, e a
-- expressão da leitura passaria a valer também para a gravação — o que hoje coincide, e é
-- exatamente por coincidir que a omissão sobreviveria a qualquer teste até deixar de coincidir.
--
-- A expressão é a mesma das dez irmãs, byte a byte: `nullif(current_setting('app.empresa_id',
-- true), '')::uuid`. O `true` é o `missing_ok` — sem contexto fixado a leitura devolve vazio, e não
-- erro; o `nullif` traduz a cadeia vazia em nulo, e nulo não casa com `empresa_id` algum, de modo
-- que contexto ausente e contexto vazio produzem o mesmo nada.

ALTER TABLE "negocio"."execucao_de_rotina" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "execucao_de_rotina_isolamento_empresa"
	ON "negocio"."execucao_de_rotina"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
