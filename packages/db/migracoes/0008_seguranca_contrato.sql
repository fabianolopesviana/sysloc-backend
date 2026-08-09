-- Segurança do contrato de locação — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0007
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1 e que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro, pela mesma razão, que não
-- envelheceu: o gerador de migração declara `ENABLE ROW LEVEL SECURITY` (o `0007` o faz), mas **não
-- emite `FORCE ROW LEVEL SECURITY`, política alguma nem função** — a consequência que a ADR-0009
-- registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada — e é isso que o CT-421 falsifica, retirando o `FORCE`
--     de `negocio.contrato` e exigindo que a guarda de catálogo o acuse pelo nome;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura do `0007` sobrescreve
-- o que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento.
-- Pela mesma razão, **nada aqui emenda a `0005` ou a `0006`** — elas descrevem schemas já aplicados
-- e são, portanto, imutáveis.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não concede privilégio de TABELA** — o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"
--     IN SCHEMA "identidade", "negocio"` do `0001_seguranca.sql` já faz a concessão de TABELAS e de
--     TIPOS acompanhar a criação, e as duas tabelas e o enum do `0007` são criados por aquele papel.
--     O `GRANT USAGE ON TYPE` do bloco 3 é a única concessão declarada de novo, e ela segue o
--     precedente do `0001`, que nomeia os tipos um a um mesmo tendo o padrão;
--   * **não concede `USAGE ON SEQUENCES`** — ver o bloco 5, onde a ausência é a decisão;
--   * **não cria schema nem papel** — os dois vêm do provisionamento;
--   * **nenhum `ALTER ... OWNER`** — as tabelas e as funções nascem do papel de migração por
--     consequência de ser ele quem as cria, e é dele que o `SECURITY DEFINER` toma os direitos.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas duas tabelas do contrato
-- ===========================================================================
--
-- `ENABLE` (no 0007) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
ALTER TABLE "negocio"."contrato" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."contrato_fiador" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- ===========================================================================
-- 2. Políticas — a MESMA expressão em `USING` e em `WITH CHECK`
-- ===========================================================================
--
-- A expressão é, literalmente, a do `0001_seguranca.sql` e a do `0006_seguranca_dominio.sql`. Ela
-- não é reinventada aqui, e o motivo é o mesmo que faz o CT-007 reler a migração do disco em vez de
-- recompor a política no teste: duas redações do mesmo isolamento são livres para divergir, e a
-- divergência não faz barulho — ela aparece como uma tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado. Divergir as duas abriria o caso "enxerga só o seu, grava para o alheio",
-- que é a metade da ADR-0008 que trata da escrita.
--
-- O segundo argumento `true` de `current_setting` faz a função devolver NULO quando a variável não
-- foi fixada, em vez de levantar erro. `nullif(..., '')` trata o outro caminho, o da variável
-- fixada em cadeia vazia. Nos dois casos a comparação vira `empresa_id = NULL`, que não casa linha
-- nenhuma: **contexto ausente resulta em vazio, nunca em dado alheio** — que é o caso do Sysloc
-- Master (RN-04).
--
-- `FOR ALL` cobre os quatro verbos numa política só. Uma política por verbo multiplicaria por
-- quatro a superfície em que as duas expressões podem divergir sem que nada acuse.
CREATE POLICY "contrato_isolamento_empresa"
	ON "negocio"."contrato"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "contrato_fiador_isolamento_empresa"
	ON "negocio"."contrato_fiador"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 3. O tipo enumerado novo
-- ===========================================================================
--
-- `USAGE` no tipo enumerado é exigido para gravar valor em coluna do tipo. O `ALTER DEFAULT
-- PRIVILEGES ... GRANT USAGE ON TYPES` do `0001` já cobriria, porque o tipo é criado por
-- `sysloc_migracao`; a declaração explícita segue o precedente daquele arquivo, que nomeia os cinco
-- tipos anteriores um a um mesmo tendo o padrão. Repetir aqui custa uma linha e torna a concessão
-- legível no ponto em que o tipo nasce.
--
-- **A predecessora decidiu ao contrário, e a divergência é declarada em vez de silenciosa.** A
-- `0006_seguranca_dominio.sql` recusou `GRANT` algum para os três enums do `0005`, escrevendo a
-- razão: *"repetir os `GRANT` aqui seria uma segunda escrita do mesmo fato, livre para divergir da
-- primeira"*. O argumento continua válido, e é ele que impede que este arquivo repita as concessões
-- de TABELA — que seguem sem declaração, no bloco acima. O que mudou de peso é o alcance: o enum é
-- UM, a concessão é a mesma que o padrão já faria, e a divergência possível é ela ser mais ESTREITA
-- que o padrão — redundância, não buraco. Diante disso, ler no ponto em que o tipo nasce qual papel
-- pode gravá-lo passou a valer a linha. Quem acrescentar o segundo enum a esta série decide de novo,
-- com este parágrafo à vista, em vez de descobrir dois precedentes opostos sem explicação.
GRANT USAGE ON TYPE "negocio"."status_contrato" TO "sysloc_app";--> statement-breakpoint

-- ===========================================================================
-- 4. O mecanismo de emissão da série declarada (ADR-0015 e ADR-0020)
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- Por que SEQUÊNCIA, e por que DUAS funções
-- ---------------------------------------------------------------------------
--
-- A ADR-0015 fixa duas cláusulas que se excluem sob o mecanismo mais óbvio (uma linha de contador
-- incrementada na transação da criação): *furo aceito, criações concorrentes não esperam umas pelas
-- outras* e *o número nunca é reusado, nem por criação abortada*. A linha travada serializa a
-- criação dentro da empresa E devolve o número no desfazimento. A ADR-0020 decide o mecanismo que
-- satisfaz as duas: **contador do próprio banco, um por escopo declarado, cujo avanço não participa
-- do desfazimento**. `nextval` nunca volta atrás — a criação abortada queima o número para sempre,
-- que é exatamente o furo que a ADR-0015 aceita por escrito.
--
-- São DUAS funções porque a criação da sequência e o consumo dela precisam cair em transações
-- diferentes: se a transação que CRIA a sequência e toma `nextval = 1` abortar, o `CREATE SEQUENCE`
-- é desfeito junto, a sequência deixa de existir, e o contrato seguinte a recria e toma `1` outra
-- vez — **o número teria sido reusado**, contra a cláusula que a ADR-0015 existe para sustentar. Com
-- a sequência já commitada, o `nextval` seguinte não tem como retroceder.
--
-- ---------------------------------------------------------------------------
-- Nenhuma das duas aceita `empresa_id` por parâmetro, e a ausência é o mecanismo
-- ---------------------------------------------------------------------------
--
-- As duas leem `nullif(current_setting('app.empresa_id', true), '')::uuid` — a MESMA expressão das
-- políticas do bloco 2 — e **levantam** quando ele está ausente. É isso, e não uma conferência de
-- aplicação, que impede pedir o contador de outra empresa: como `SECURITY DEFINER` roda com os
-- direitos da DONA (`sysloc_migracao`), aceitar a empresa por argumento daria à aplicação
-- exatamente o poder que a RLS lhe tira — bastaria passar o identificador alheio. A assinatura sem
-- parâmetro de empresa é o que torna o pedido cruzado **irrepresentável**, e é o que o CT-406 afirma
-- por introspecção do catálogo.
--
-- O contador fica fora do alcance da política de linha (a ADR-0020 registra isso entre os *Cons*):
-- o escopo é preservado pela **identidade do objeto**, não por `empresa_id` comparada pelo banco.
--
-- ---------------------------------------------------------------------------
-- O SQL dinâmico, e por que ele é seguro por construção
-- ---------------------------------------------------------------------------
--
-- O único SQL dinâmico desta fatia é o `format(… %I …)` abaixo, e nenhum dos dois insumos vem de
-- texto do cliente: o ano é `integer`, e a empresa vem do contexto convertida para `uuid` — o cast
-- recusa qualquer coisa que não seja UUID, antes de o nome ser composto. `%I` ainda cita o
-- identificador resultante. O nome tem 46 caracteres (`contrato_` + 4 do ano + `_` + 32 hexadecimais
-- da empresa sem hífens), dentro do limite de 63 do identificador — um nome truncado faria dois
-- escopos partilharem a mesma sequência em silêncio.
--
-- **A largura de 4 do ano é uma consequência da guarda de faixa, não do tipo**: `integer` admite dez
-- dígitos, e a função não é `STRICT`, de modo que sem a guarda o ano nulo renderia cadeia vazia e o
-- nome deixaria de identificar escopo algum. As duas funções guardam `p_ano` na entrada, com a
-- mesma faixa, e é essa guarda que torna verdadeira a contagem do parágrafo acima.
--
-- `SET search_path = pg_catalog, pg_temp` é obrigatório numa função `SECURITY DEFINER`, e a ordem é
-- conteúdo: com o schema temporário em ÚLTIMO lugar, nenhum objeto criado por quem chama pode
-- sequestrar um nome que a função resolve. Tudo o que os corpos referenciam é ou de `pg_catalog`
-- (`format`, `nextval`, `current_setting`, `nullif`, `replace`, `uuid`) ou qualificado à mão
-- (`negocio.%I`).

CREATE FUNCTION "negocio"."garantir_contador_de_contrato"(p_ano integer, p_inicio bigint DEFAULT 1)
	RETURNS void
	LANGUAGE plpgsql
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
	v_empresa uuid := nullif(current_setting('app.empresa_id', true), '')::uuid;
	v_qualificado text;
BEGIN
	IF v_empresa IS NULL THEN
		RAISE EXCEPTION
			'contexto de empresa ausente: app.empresa_id não está fixado nesta transação';
	END IF;

	-- A faixa do ano e o piso da série são guardas IRMÃS, e existem pela mesma razão: os dois
	-- parâmetros compõem o código legível `CTR-{ano}-{5 dígitos}`, e valor fora de faixa em qualquer
	-- um deles produz código fora do formato publicado — que o invariante 5 do projeto e o marcador
	-- `DECISÃO FECHADA` de `packages/contracts/src/contrato.ts` fixam. Guardar um e deixar o outro
	-- aberto seria decidir que o formato importa pela metade.
	--
	-- O `IS NULL` do ano não é zelo: esta função NÃO é `STRICT`, de modo que `garantir_…(NULL)`
	-- correria o corpo, e `format('contrato_%s_%s', NULL, …)` rende CADEIA VAZIA no lugar do ano —
	-- criando `contrato__<32 hexadecimais>`, um contador de escopo INDETERMINADO, permanente e
	-- invisível a toda a rede de verificação: a guarda de cobertura de `packages/db/src/catalogo.ts`
	-- exclui sequências por espécie (`relkind`), e o `verificar-migracao.sh` deliberadamente não as
	-- lista. O consumidor da T5 deriva o ano da data de início do contrato; um ano derivado errado
	-- não falharia — deixaria lixo permanente e emitiria código fora do formato.
	--
	-- A faixa 2000–2999 é folgada para a semeadura da virada (F7), que passa anos medidos no sistema
	-- antigo, e para o produto inteiro. O piso da série é 1 pela mesma largura fixa de cinco dígitos:
	-- um contador que comece em zero ou abaixo produziria código fora do formato.
	IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2999 THEN
		RAISE EXCEPTION 'ano do contador fora da faixa admitida: %', p_ano;
	END IF;

	IF p_inicio < 1 THEN
		RAISE EXCEPTION 'valor inicial do contador deve ser positivo';
	END IF;

	v_qualificado := format('negocio.%I', format('contrato_%s_%s', p_ano, replace(v_empresa::text, '-', '')));

	-- A saída rápida também define a PRECONDIÇÃO da semeadura da virada (F7): com o contador do escopo
	-- já existente, `p_inicio` é ignorado em silêncio — aqui e, de novo, no `IF NOT EXISTS` abaixo. É
	-- o comportamento certo, e não um descuido: `garantir_…` é idempotente por contrato, e levantar
	-- quando a sequência já existe quebraria o consumidor normal da T5, que a chama uma vez por
	-- contrato criado. A consequência para a F7 é que **semear exige escopo virgem** — semear depois
	-- de o primeiro contrato do ano ter sido emitido não reposiciona o contador, e o runbook da virada
	-- é quem garante a ordem.
	--
	-- A saída rápida existe pelo RUÍDO, não pelo custo: esta função é chamada uma vez por criação de
	-- contrato, e a partir do segundo contrato do escopo o `CREATE SEQUENCE IF NOT EXISTS` emite
	-- `NOTICE: relation … already exists, skipping` — que o cliente do banco imprime FORA do
	-- registrador estruturado, contornando a redação de entrada única que a F0 instalou. Uma linha de
	-- ruído por contrato, num canal que ninguém filtra.
	IF to_regclass(v_qualificado) IS NOT NULL THEN
		RETURN;
	END IF;

	-- `IF NOT EXISTS` é o caminho da CORRIDA, e continua sendo o mecanismo: ele bloqueia a segunda
	-- transação até a primeira decidir. O bloco de exceção cobre o caminho em que o PostgreSQL
	-- levanta em vez de bloquear — a variante `IF NOT EXISTS` NÃO é imune a corrida no índice único
	-- de `pg_class`. Nos três desfechos (saída rápida, criação, corrida) a função devolve sem erro e
	-- a sequência existe, que é o contrato dela.
	BEGIN
		EXECUTE format(
			'CREATE SEQUENCE IF NOT EXISTS %s START WITH %s MINVALUE %s NO CYCLE',
			v_qualificado,
			p_inicio,
			p_inicio
		);
	EXCEPTION
		WHEN duplicate_table OR unique_violation THEN
			NULL;
	END;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "negocio"."proximo_numero_de_contrato"(p_ano integer)
	RETURNS bigint
	LANGUAGE plpgsql
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
	v_empresa uuid := nullif(current_setting('app.empresa_id', true), '')::uuid;
BEGIN
	IF v_empresa IS NULL THEN
		RAISE EXCEPTION
			'contexto de empresa ausente: app.empresa_id não está fixado nesta transação';
	END IF;

	-- A MESMA guarda de faixa da função irmã, palavra por palavra, e não uma conferência a menos: as
	-- duas funções são as duas superfícies pelas quais o escopo `(empresa, ano)` é NOMEADO, e uma
	-- superfície mais larga que a outra é a divergência que reabre o buraco pelo outro lado. Sem ela,
	-- `proximo_numero_de_contrato(NULL)` consumiria sem reclamar exatamente o contador de escopo
	-- indeterminado que a irmã guardada não cria mais.
	IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2999 THEN
		RAISE EXCEPTION 'ano do contador fora da faixa admitida: %', p_ano;
	END IF;

	-- `nextval(regclass)` em vez de `EXECUTE`: o nome é composto pelo mesmo `format(… %I …)` da
	-- função irmã e resolvido como identificador, sem que instrução alguma seja montada como texto.
	-- A sequência inexistente levanta `undefined_table` (42P01) — desfecho correto, porque chamar
	-- esta função sem a irmã ter commitado é uso fora do protocolo declarado na §7.4.
	RETURN nextval(
		format(
			'negocio.%I',
			format('contrato_%s_%s', p_ano, replace(v_empresa::text, '-', ''))
		)::regclass
	);
END;
$$;--> statement-breakpoint

-- ===========================================================================
-- 5. Privilégio das funções — `EXECUTE`, e SÓ ele
-- ===========================================================================
--
-- O PostgreSQL concede `EXECUTE` a `PUBLIC` por omissão em toda função nova, e `PUBLIC` alcança
-- TODO papel do agrupamento, presente e futuro. Sem o `REVOKE`, qualquer papel que conseguisse
-- conectar avançaria o contador da empresa cujo contexto estivesse fixado. O `REVOKE` vem ANTES do
-- `GRANT` de propósito: invertido, ele apagaria a concessão nominal que acabou de ser feita.
--
-- A assinatura é escrita por extenso (com os tipos dos parâmetros) porque é ela que identifica a
-- função — o nome sozinho é ambíguo para o `REVOKE`/`GRANT` quando houver sobrecarga.
REVOKE ALL ON FUNCTION "negocio"."garantir_contador_de_contrato"(integer, bigint) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "negocio"."proximo_numero_de_contrato"(integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."garantir_contador_de_contrato"(integer, bigint) TO "sysloc_app";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."proximo_numero_de_contrato"(integer) TO "sysloc_app";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- E o que NÃO se concede: `USAGE ON SEQUENCES`
-- ---------------------------------------------------------------------------
--
-- DECISÃO FECHADA — T3 · 2026-08-09
-- O QUÊ: `sysloc_app` recebe `EXECUTE` sobre as duas funções e **nada** sobre a sequência do
--        contador — nem `USAGE`, nem `SELECT`, nem `UPDATE`, nem por `ALTER DEFAULT PRIVILEGES`.
-- POR QUÊ: a saída idiomática para "a aplicação precisa do contador" é conceder-lhe a sequência, e
--          ela é a errada: o `nextval` corre DENTRO da função `SECURITY DEFINER`, com os direitos da
--          dona, e a aplicação nunca toca o objeto. Conceder abriria um SEGUNDO caminho para o
--          número — um `nextval('negocio.contrato_2026_<outra empresa>')` direto —, pelo qual o
--          escopo `(empresa, ano)` deixaria de ser imposto pela função, que é justamente o que
--          impede pedir o contador alheio. A ADR-0020 registra entre os *Neutros* que alargar o
--          privilégio do papel da aplicação **não é o caminho**.
-- REVERTER EXIGE: provar que existe consumidor legítimo do contador FORA das duas funções, e que
--                 esse consumidor não pode alcançar o contador de outra empresa — o que hoje é
--                 garantido pela ausência de parâmetro de empresa nas funções, e não haveria como
--                 garantir num `nextval` direto, cujo argumento é o nome do objeto.
--
-- A ausência é cobrada pelo CT-431, e o mutante foi medido nesta task: um `ALTER DEFAULT PRIVILEGES
-- … GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "sysloc_app"` acrescentado aqui faz aquele caso
-- reprovar.
--
-- Nada precisa ser revogado aqui: o `ALTER DEFAULT PRIVILEGES` do `0001` declara apenas `ON TABLES`
-- e `ON TYPES`, e nem `GRANT ... ON ALL TABLES` nem aquele padrão alcançam sequência. As sequências
-- que a função criar nascem, portanto, sem privilégio algum para `sysloc_app` — por construção, e
-- não por revogação que alguém precise lembrar de escrever.
