-- Segurança da confirmação de endereço — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0013
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro, que o
-- `0008_seguranca_contrato.sql` fez para o contrato, que o `0010_seguranca_cobranca.sql` fez para a
-- cobrança e que o `0012_seguranca_regua.sql` fez para a régua, pela mesma razão, que não
-- envelheceu: o gerador de migração declara `ENABLE ROW LEVEL SECURITY` (o `0013` o faz), mas **não
-- emite `FORCE ROW LEVEL SECURITY`, política alguma nem função** — a consequência que a ADR-0009
-- registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO da tabela ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura do `0013` sobrescreve
-- o que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento.
-- Pela mesma razão, **nada aqui emenda a `0007` ou a `0008`** — elas descrevem schemas já aplicados.
-- ⚠️ A `0010` tem, além disso, uma `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho
-- (a primeira aplicação a banco durável) **fecha em silêncio**: quem for tocá-la lê o marcador
-- primeiro. Esta fatia não a toca.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec). Vale com força redobrada aqui, porque a parceira
-- `0013` é **destrutiva** — ver o cabeçalho dela.
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não concede privilégio de TABELA** — o `ALTER DEFAULT PRIVILEGES FOR ROLE
--     "sysloc_migracao" IN SCHEMA "identidade", "negocio" … ON TABLES` do `0001_seguranca.sql` já
--     faz a concessão acompanhar a criação. A tabela deste par de migrações nasce daquele papel;
--   * **não cria tipo enumerado, visão nem sequência** — a confirmação não tem série declarada (o
--     portador não é recurso exposto: ele é resolvido pelo segredo e nunca aparece na superfície,
--     ADR-0017), não deriva estado publicado que participe de seleção (ADR-0023) e não tem estado a
--     enumerar: os três instantes são fatos, e o estado publicado é derivado deles (ADR-0022).
--     **A tabela continua sob `sysloc_app`**, o mesmo papel dos dois processos: quem a lê e a
--     escreve na operação é ele, sob a política do bloco 1. O papel `sysloc_resolucao` do bloco 2
--     **não atende requisição nem é dono de tabela** — ele é dono de UMA função, e a alternativa que
--     a ADR-0008 rejeita por escrito (papel de aplicação sem RLS) permanece rejeitada;
--   * **não cria schema nem papel** — os três vêm do provisionamento, inclusive o
--     `sysloc_resolucao` do bloco 2: `sysloc_migracao` é `NOCREATEROLE`, e criar papel daqui devolve
--     `42501 · Only roles with the CREATEROLE attribute may create roles` (medido). O que este
--     arquivo faz é **conferir** que ele existe, e abortar nomeando o provisionamento se não;
--   * **nenhum `ALTER ... OWNER` de TABELA** — ela nasce do papel de migração por consequência de
--     ser ele quem a cria. O único `ALTER … OWNER` deste arquivo alcança a FUNÇÃO do bloco 3, e ele
--     é a decisão inteira do bloco 2: sem ele a resolução devolve zero linhas.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada na tabela nova, e a política
-- ===========================================================================
--
-- `ENABLE` (no 0013) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`, a do `0006_seguranca_dominio.sql`, a do
-- `0008_seguranca_contrato.sql`, a do `0010_seguranca_cobranca.sql` e a do `0012_seguranca_regua.sql`.
-- Ela não é reinventada aqui, e o motivo é o mesmo que faz o CT-007 reler a migração do disco em vez
-- de recompor a política no teste: duas redações do mesmo isolamento são livres para divergir, e a
-- divergência não faz barulho — ela aparece como uma tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado, e as duas são a MESMA expressão: divergi-las abriria o caso "enxerga só o
-- seu, grava para o alheio". O segundo argumento `true` de `current_setting` devolve NULO quando a
-- variável não foi fixada, e `nullif(…, '')` trata a variável fixada em cadeia vazia — nos dois
-- casos a comparação vira `empresa_id = NULL`, que não casa linha nenhuma: **contexto ausente
-- resulta em vazio, nunca em dado alheio**. `FOR ALL` cobre os quatro verbos numa política só.
--
-- ⚠️ A política alcança TODO acesso à tabela pelo papel da aplicação — inclusive a emissão e o
-- consumo do portador, que correm sob o contexto da empresa dona do locatário. Ela alcança também o
-- DONO da tabela, por causa do `FORCE`, e é dela que a resolução do bloco 3 precisa escapar — por um
-- caminho NOMINAL, declarado no bloco 2, e não por privilégio de papel.
ALTER TABLE "negocio"."portador_de_confirmacao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "portador_de_confirmacao_isolamento_empresa"
	ON "negocio"."portador_de_confirmacao"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 2. O papel de propósito único que a resolução usa, e a política nominal dele
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- ⚠️ `SECURITY DEFINER` NÃO atravessa `FORCE ROW LEVEL SECURITY` — medido
-- ---------------------------------------------------------------------------
--
-- Esta é a correção de um defeito que a especificação carregava, e o registro fica aqui porque é
-- aqui que a tentação de "simplificar" acontece. A rodada 1 desta task escreveu a função como
-- `SECURITY DEFINER` pertencente a `sysloc_migracao`, no molde das quatro funções da `0008` e da
-- `0010`, e a Revisão Técnica mediu que ela devolve **zero linhas em 100% das chamadas** do único
-- cenário que existe para atender.
--
-- O mecanismo, em três frases: `SECURITY DEFINER` faz `current_user` virar o **dono da função**;
-- o dono era `sysloc_migracao`, que é também o **dono da tabela**; e `FORCE` é precisamente o que
-- deixa de isentar o dono da tabela. Nada resgata o papel — ele nasce `NOSUPERUSER NOBYPASSRLS` nas
-- duas frentes de provisionamento —, então a política do bloco 1 é avaliada DENTRO da função, sem
-- contexto vira `empresa_id = NULL`, e não casa linha nenhuma.
--
-- **Por que o molde não transportava a propriedade**: as quatro funções `DEFINER` já existentes
-- operam sobre **sequências**, que não têm RLS. Esta é a primeira do produto a ler uma tabela com
-- `FORCE`, e o molde foi copiado sem a propriedade de que ela dependia.
--
-- ---------------------------------------------------------------------------
-- O que atravessa, então: um papel NOMINAL com política própria
-- ---------------------------------------------------------------------------
--
-- A função passa a pertencer a `sysloc_resolucao`, um papel **`NOLOGIN`** de propósito único que não
-- é dono de tabela alguma e **não conecta**, e a tabela ganha uma segunda política que alcança
-- exclusivamente esse papel. A travessia deixa de ser um efeito colateral de quem é dono e vira uma
-- exceção **declarada, nominal e auditável por nome** — `\dp` e `pg_policies` a mostram.
--
-- A alternativa considerada e descartada era conceder a leitura irrestrita a `sysloc_migracao` (uma
-- política `FOR SELECT TO sysloc_migracao USING (true)`, mantendo o dono). Ela funciona igual e é
-- pior: `sysloc_migracao` é o papel que aplica TODA migração e é dono de TODAS as tabelas, de modo
-- que a exceção viraria precedente copiável para a próxima tabela — e o invariante que o projeto
-- sustenta em toda parte é *nenhum papel enxerga linha de outra empresa sem contexto, nem o dono*.
--
-- ⚠️ **O papel NÃO nasce aqui**: `sysloc_migracao` é `NOCREATEROLE`. Ele vem do provisionamento, nas
-- duas frentes — `deploy/scripts/instalacao/provisionar-base.sh` (P15) e `provisionar()` de
-- `packages/db/test/banco-efemero.ts`. O bloco abaixo apenas **confere**, e a falha é ruidosa e
-- nomeia o que fazer: uma migração que criasse o papel em silêncio esconderia um provisionamento
-- incompleto, e o desencontro apareceria mais tarde como uma função que resolve nada.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sysloc_resolucao') THEN
		RAISE EXCEPTION 'o papel "sysloc_resolucao" não existe neste agrupamento'
			USING HINT = 'execute deploy/scripts/instalacao/provisionar-base.sh (passo P15) antes de migrar';
	END IF;
END
$$;--> statement-breakpoint

-- A política nominal. `FOR SELECT` e nada mais: o papel resolve, e **não** escreve — o consumo e a
-- invalidação do portador correm por `sysloc_app`, sob a política do bloco 1, com contexto fixado.
-- `USING (true)` é o que se pretende: o recorte de QUAL linha sai não é desta política, e sim do
-- `WHERE` da função, que casa pelo derivado (um segredo de 256 bits) e cobra prazo e invalidação.
-- Políticas permissivas se combinam por OU, então esta **acrescenta** um caminho para um papel só e
-- não relaxa nada do bloco 1 para os demais.
CREATE POLICY "portador_de_confirmacao_resolucao_sem_contexto"
	ON "negocio"."portador_de_confirmacao"
	FOR SELECT
	TO "sysloc_resolucao"
	USING (true);--> statement-breakpoint

-- Política libera a LINHA; privilégio libera a RELAÇÃO — são coisas diferentes, e sem as duas
-- concessões abaixo a função levantaria `42501` em vez de devolver vazio. O `ALTER DEFAULT
-- PRIVILEGES` do `0001_seguranca.sql` alcança `sysloc_app`, e só ele.
--
-- São exatamente os dois privilégios do estado final, e a minimalidade foi **medida** (retirar
-- qualquer um deles reprova o CT-735): `USAGE` no schema — sem `CREATE`, que o bloco 4 empresta e
-- devolve — e `SELECT` sobre UMA tabela, sem `INSERT`/`UPDATE`/`DELETE` e sem alcance a nenhuma
-- outra relação de `negocio`.
GRANT USAGE ON SCHEMA "negocio" TO "sysloc_resolucao";--> statement-breakpoint
GRANT SELECT ON TABLE "negocio"."portador_de_confirmacao" TO "sysloc_resolucao";--> statement-breakpoint

-- ===========================================================================
-- 3. A resolução do portador — a ÚNICA leitura legítima sem contexto de empresa
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- Por que ela precisa ser `SECURITY DEFINER` **com o dono do bloco 2**
-- ---------------------------------------------------------------------------
--
-- Quem apresenta o segredo **não tem sessão** (ADR-0027): é o locatário, que nunca terá uma, agindo
-- sobre o próprio dado. Não existe, portanto, contexto de empresa a fixar antes da leitura — e sob a
-- política do bloco 1 a leitura sem contexto devolve **zero linhas**, corretamente. A empresa é o
-- RESULTADO desta resolução, não a entrada dela.
--
-- `SECURITY DEFINER` é o que troca `current_user` pelo dono da função; é o **dono ser
-- `sysloc_resolucao`**, e a política nominal do bloco 2 alcançar esse papel, o que permite a esta
-- única leitura enxergar a linha sem contexto. Os dois são necessários, e nenhum basta sozinho: com
-- o dono errado, a política do bloco 1 se aplica e a função devolve vazio (foi o defeito da rodada
-- 1); sem `DEFINER`, a função rodaria como `sysloc_app` e a política nominal não o alcançaria. A
-- partir daí o caminho volta ao normal: a borda fixa `app.empresa_id` com o valor descoberto e toda
-- escrita seguinte corre sob a política do bloco 1.
--
-- ---------------------------------------------------------------------------
-- As quatro propriedades, e cada uma é conteúdo
-- ---------------------------------------------------------------------------
--
-- 1. **NÃO aceita `empresa_id` por parâmetro.** É a mesma decisão das quatro funções de série já
--    existentes: um tenant vindo de fora seria uma segunda origem de contexto, e é exatamente o que
--    a **ADR-0024** fecha. O contexto vem do REGISTRO que o portador resolve, e de nenhum outro
--    lugar. Acrescentar o parâmetro aqui reconstituiria o request como origem, com outro nome.
--
-- 2. **Devolve três colunas, e nenhuma a mais.** Não devolve `derivado`, `expira_em`, `criado_em`
--    nem coluna alguma do locatário. Uma função `SECURITY DEFINER` é um furo declarado na política:
--    o que ela publica é o que qualquer portador de segredo alcança sem sessão, e cada coluna a mais
--    alarga esse furo. `consumido_em` sai porque a borda precisa dele para responder `200` à
--    reapresentação (RN-10) — e ele é instante, não dado pessoal.
--
-- 3. **O prazo e a invalidação estão no `WHERE`, e não na aplicação.** Portador vencido ou
--    invalidado produz **zero linhas**, indistinguível de derivado inexistente — a RN-14 vira
--    propriedade do banco, e não um `if` na borda que alguém pode reordenar ou esquecer.
--
-- 4. **`pg_catalog.now()`, e não relógio do processo** (ADR-0026). Sendo `timestamptz`, a comparação
--    é absoluta e **não precisa de literal de fuso** — o que evita, por construção, criar uma
--    terceira declaração executável do fuso da operação e agravar o **D14 (F3/T5)**.
--
-- `SET search_path = pg_catalog, pg_temp` fecha o vetor clássico de `SECURITY DEFINER`: sem ele,
-- quem chama escolhe o `search_path` e pode interpor objeto próprio no caminho de resolução de nome,
-- executando-o com os direitos da dona. O mesmo molde da `0008` e da `0010`.
--
-- ---------------------------------------------------------------------------
-- ⚠️ `AND p.consumido_em IS NULL` **NÃO** entra neste `WHERE` — a linha pareceria endurecimento
-- ---------------------------------------------------------------------------
--
-- DECISÃO FECHADA — T3 · 2026-08-13
-- O QUÊ: a resolução do portador NÃO filtra por `consumido_em`. O portador já consumido continua
--        resolvendo enquanto estiver dentro da validade e não tiver sido invalidado.
-- POR QUÊ: "uso único" é o EFEITO, não a RESOLUÇÃO. A leitura conjunta ADR-0027 × RN-10 está
--          registrada por escrito na §21.3 da tech spec desta fatia. Acrescentar a linha daria a
--          RN-14 de graça e **quebraria a RN-10**: a reapresentação dentro da validade passaria a
--          receber `404`, e a pré-visualização de link pelo provedor de correio queimaria a
--          confirmação ANTES de o locatário clicar — o defeito que a RN-10 existe para fechar. A
--          unicidade do ato é imposta pelo banco em outro ponto, e não aqui: o consumo é
--          `UPDATE … WHERE consumido_em IS NULL RETURNING`, cuja ausência de retorno é ela própria o
--          resultado, de modo que a segunda apresentação **resolve e não escreve**.
-- REVERTER EXIGE: provar que a reapresentação do mesmo segredo dentro da validade deve receber
--                 `404` — o que contraria a RN-10 do PRD —, ou exibir outro mecanismo que impeça a
--                 pré-visualização de link de consumir a confirmação antes do locatário.
CREATE FUNCTION "negocio"."resolver_portador_de_confirmacao"(p_derivado text)
	RETURNS TABLE (empresa_id uuid, locatario_id uuid, consumido_em timestamptz)
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
	SELECT p.empresa_id, p.locatario_id, p.consumido_em
	FROM negocio.portador_de_confirmacao p
	WHERE p.derivado = p_derivado
	  AND p.invalidado_em IS NULL
	  AND p.expira_em > pg_catalog.now();
$$;--> statement-breakpoint

-- ===========================================================================
-- 4. Privilégio da função — `EXECUTE`, e SÓ ele — e, por último, o DONO
-- ===========================================================================
--
-- O PostgreSQL concede `EXECUTE` a `PUBLIC` por omissão em toda função nova, e `PUBLIC` alcança
-- TODO papel do agrupamento, presente e futuro. Numa função `SECURITY DEFINER` que atravessa a
-- política de linha, isso significaria que qualquer papel capaz de conectar resolveria portador de
-- qualquer empresa. O `REVOKE` vem ANTES do `GRANT` de propósito: invertido, ele apagaria a
-- concessão nominal que acabou de ser feita.
--
-- A assinatura é escrita por extenso (com o tipo do parâmetro) porque é ela que identifica a
-- função — o nome sozinho é ambíguo para o `REVOKE`/`GRANT` quando houver sobrecarga. Mesmo molde
-- do bloco 5 da `0008` e do bloco 6 da `0010`.
REVOKE ALL ON FUNCTION "negocio"."resolver_portador_de_confirmacao"(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."resolver_portador_de_confirmacao"(text) TO "sysloc_app";--> statement-breakpoint

-- A troca de dono vem por ÚLTIMO, e a posição é conteúdo — não arrumação.
--
-- O provisionamento concede a membership com `WITH INHERIT FALSE, SET TRUE`: `sysloc_migracao` pode
-- **assumir** `sysloc_resolucao` deliberadamente, mas não **herda** os privilégios dele. Daí que,
-- depois do `ALTER`, ele deixa de poder conceder sobre esta função sem um `SET ROLE` explícito — e é
-- por isso que o `REVOKE`/`GRANT` acima vem antes. Invertida a ordem, a migração aborta com `42501`
-- na primeira instalação, e o motivo não seria óbvio para quem lesse só o erro.
--
-- ⚠️ **A consequência NÃO se limita a conceder, e vale para as migrações seguintes.** O PostgreSQL
-- avalia a verificação de propriedade por `has_privs_of_role`, que **respeita o `INHERIT`** — logo
-- `sysloc_migracao` deixa de ser reconhecido como dono desta função para TODO ato de propriedade, e
-- não apenas para o `GRANT`/`REVOKE` acima. A partir daqui, **qualquer migração que substitua,
-- altere ou remova `negocio.resolver_portador_de_confirmacao(text)` precisa de
-- `SET ROLE "sysloc_resolucao";` antes** — isso alcança `CREATE OR REPLACE FUNCTION`,
-- `DROP FUNCTION`, `ALTER FUNCTION … SET search_path` e um novo `ALTER … OWNER TO`. Sem o `SET ROLE`
-- a migração aborta com `42501`, e o erro nomeia a função, não a membership: quem estiver lendo só a
-- mensagem não tem como chegar sozinho até aqui.
--
-- `ALTER … OWNER TO` cobra DUAS coisas, e as duas foram medidas contra o servidor:
--
--   1. quem executa tem de ser **membro** do papel de destino — é a razão de existir daquela
--      membership, e a única coisa para que ela serve;
--   2. o papel de destino tem de ter **`CREATE` no schema da função**. Sem ele a migração aborta com
--      `permission denied for schema negocio`, e foi assim que a exigência apareceu.
--
-- O `CREATE` é, portanto, **emprestado e devolvido na mesma migração**: ele é exigência do ato de
-- trocar o dono, não do ato de resolver o portador. Deixá-lo concedido daria a um papel de propósito
-- único a capacidade permanente de criar objeto em `negocio` — e o estado final auditável passa a
-- ser exatamente `USAGE` no schema mais `SELECT` em uma tabela. O `CT-735` afirma isso pelo
-- catálogo.
GRANT CREATE ON SCHEMA "negocio" TO "sysloc_resolucao";--> statement-breakpoint
ALTER FUNCTION "negocio"."resolver_portador_de_confirmacao"(text) OWNER TO "sysloc_resolucao";--> statement-breakpoint
REVOKE CREATE ON SCHEMA "negocio" FROM "sysloc_resolucao";
