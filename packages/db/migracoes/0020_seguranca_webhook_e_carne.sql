-- Segurança do webhook e do carnê — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado da `0019`
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, e que a `0006`, a
-- `0008`, a `0010`, a `0012`, a `0014`, a `0016` e a `0018` repetiram desde então, pela mesma razão,
-- que não envelheceu: o gerador de migração declara tabela, tipo e índice, mas **não emite papel,
-- política, `GRANT`, `REVOKE` nem função** — a consequência que a ADR-0009 registra entre os
-- Neutros.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura da `0019` sobrescreve o
-- que estiver lá, em silêncio, e o cabeçalho daquele arquivo declara a regeração como **esperada e
-- recorrente** (a supressão do `CREATE SCHEMA "plataforma"` é obrigatória a cada passada do
-- gerador). Pela mesma razão, **nada aqui emenda a `0010`, a `0016` ou a `0018`** — elas descrevem
-- schemas já aplicados, são conferidas por `sha256sum` por `migrar-banco.sh`, e a `0010` carrega
-- ainda uma `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta é
-- restauração de backup.
--
-- ---------------------------------------------------------------------------
-- A ORDEM DOS BLOCOS É CONTEÚDO, e invertê-la apaga o que se acabou de conceder
-- ---------------------------------------------------------------------------
--
-- Ela é o **molde literal da `0014`**, e cada posição responde por uma exigência medida:
--
--   1. a conferência do papel vem primeiro — sem ele, nada abaixo tem a quem endereçar;
--   2. o `RENAME` da visão vem logo depois, e **fora** da sequência de permissão (ver o bloco 2);
--   3. política e `GRANT` de tabela antes da função, para que a travessia exista quando ela nascer;
--   4. `REVOKE ALL … FROM PUBLIC` **antes** do `GRANT EXECUTE` — invertido, o `REVOKE` apagaria a
--      concessão nominal que o `GRANT` acabou de fazer;
--   5. `ALTER FUNCTION … OWNER TO` por **último** — depois dele, `sysloc_migracao` deixa de ser
--      reconhecido como dono e não consegue mais conceder sobre a função sem um `SET ROLE`.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. O papel de propósito único — CONFERIDO aqui, criado no provisionamento
-- ===========================================================================
--
-- ⚠️ **O papel NÃO nasce aqui**: `sysloc_migracao` é `NOCREATEROLE`, e criar papel de lá devolve
-- `42501 · Only roles with the CREATEROLE attribute may create roles`. Ele vem do provisionamento,
-- nas **duas** frentes que se espelham — `deploy/scripts/instalacao/provisionar-base.sh` (passo P15)
-- e `provisionar()` de `packages/db/test/banco-efemero.ts`. O bloco abaixo apenas **confere**, e a
-- falha é ruidosa e nomeia o que fazer: uma migração que criasse o papel em silêncio esconderia um
-- provisionamento incompleto, e o desencontro apareceria mais tarde como uma função que roteia nada.
--
-- **Por que um papel novo, e não o reuso de `sysloc_resolucao`**: a emenda de 2026-08-13 da ADR-0024
-- exige papel de **propósito único** com `SELECT` sobre *"a única tabela alcançada"*. Reusar o papel
-- do portador o faria alcançar **duas** tabelas e diluiria exatamente a propriedade que a ADR
-- nomeia. O custo — duas frentes de provisionamento — é mecânico e já precedentado.
--
-- ⚠️ **O passo e o script são nomeados na MENSAGEM, e não só no `HINT`** — e aqui esta migração
-- diverge do molde da `0014` de propósito. O `HINT` é campo separado do protocolo: `psql` o imprime,
-- mas todo invólucro que reembrulhe a falha numa cadeia carrega **apenas** a mensagem — é o que
-- `aplicarMigracoes` de `packages/db/test/banco-efemero.ts` faz, e foi medido. Com o passo só no
-- `HINT`, quem lê a falha pelo caminho da verificação recebe *"o papel não existe"* e nada sobre o
-- que fazer. O `HINT` **fica**, porque é ele que `psql` destaca ao operador.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sysloc_roteamento') THEN
		RAISE EXCEPTION 'o papel "sysloc_roteamento" não existe neste agrupamento; ele nasce no passo P15 de deploy/scripts/instalacao/provisionar-base.sh'
			USING HINT = 'execute deploy/scripts/instalacao/provisionar-base.sh (passo P15) antes de migrar';
	END IF;
END
$$;--> statement-breakpoint

-- ===========================================================================
-- 2. A visão `negocio.cobranca_derivada` publica o nome novo (AUTORAL, vinda da `0019`)
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- Por que esta instrução mora AQUI, e não na `0019` que faz o renome da coluna-base
-- ---------------------------------------------------------------------------
--
-- Ela nasceu na `0019` — arquivo **gerado** por `drizzle-kit generate` — porque este arquivo ainda
-- não existia quando a T2 correu, e mover para arquivo inexistente teria criado dependência entre
-- tasks. A T3, que o criou, a moveu, e a janela para mover era esta: a `0019` ainda não fora
-- aplicada a banco durável, de modo que o `sha256sum` que `migrar-banco.sh` confere ainda não a
-- congelara. O precedente que mede o custo de perder a janela é o `D20 · F3/T7`, cujo marcador hoje
-- **não pode mais sair** do arquivo — removê-lo mudaria o hash e abortaria a migração.
--
-- O motivo de mover é a regra que o cabeçalho da `0019` enuncia e que o próprio cabeçalho dela viola
-- ao carregar um trecho autoral: *gerado e autoral nunca convivem no mesmo arquivo*. Ali a violação
-- não era teórica — aquele cabeçalho declara a regeração como **esperada e obrigatória a cada
-- passada** (a supressão do `CREATE SCHEMA "plataforma"`), e uma regeração apagaria esta instrução
-- **em silêncio**: a visão voltaria a publicar `nosso_numero` sem que nada no diff dissesse por quê.
--
-- ---------------------------------------------------------------------------
-- Ela fica FORA da sequência de permissão, de propósito
-- ---------------------------------------------------------------------------
--
-- O `RENAME` é independente dos blocos 3 a 7, mas a ordem daqueles blocos **é** a garantia
-- (`REVOKE` antes de `GRANT`, `OWNER TO` por último). Intercalá-lo entre eles convidaria a próxima
-- leitura a tratar a sequência como arrumação e a reordená-la. Aqui, logo após a conferência do
-- papel e antes de qualquer concessão, ele não se intercala em nada.
--
-- ---------------------------------------------------------------------------
-- É `RENAME COLUMN` sobre a visão, e NÃO `DROP VIEW` + `CREATE VIEW`
-- ---------------------------------------------------------------------------
--
-- `negocio.cobranca_derivada` expandiu `c.*` no instante em que a `0010` a criou, de modo que o nome
-- de saída ficou gravado na definição e **não** muda com o renome da coluna-base (que a `0019` já
-- aplicou — ela roda antes deste arquivo, e a coluna nova já existe quando esta instrução corre).
--
-- ⚠️ A §7.3 do tech spec prescrevia a **recriação**, e a medição a refuta. Recriar com `c.*` faria a
-- visão passar a publicar `identificador_no_provedor`, coluna INTERNA acrescentada pela `0017`, que
-- o cabeçalho da `0010` mantém fora da superfície por escrito (*"a visão é superfície publicada, e
-- crescer por acidente é como um campo interno vaza"*). Recriá-la enumerando as colunas poria a
-- definição da fonte única da derivação em DOIS arquivos, livres para divergir, e reabriria a
-- `DECISÃO FECHADA` do `WITH (security_invoker = true)` que vive na `0010`. O `RENAME` preserva a
-- definição byte a byte, o atributo e os privilégios, e produz exatamente o efeito pedido. **Não
-- "corrija" para recriação.**
--
-- `ALTER TABLE` é a forma canônica do `RENAME` também para visão (não há `ALTER VIEW … RENAME
-- COLUMN`); o objeto continua sendo a visão.
--
-- ⚠️ **A REDE desta instrução é executável, e é o `CT-510 (e)`** de
-- `packages/db/test/fonte-unica-do-estado.spec.ts`: ele lê do catálogo as colunas de
-- `negocio.cobranca_derivada` na ordem de `ordinal_position` e as compara por IGUALDADE DE LISTA
-- contra 31 nomes escritos à mão. Suprimida esta instrução, a visão volta a publicar `nosso_numero`
-- e aquele caso reprova nomeando a coluna. Ele também é o que sustenta, por medição, a alegação de
-- que `identificador_no_provedor` continua fora da superfície. A mudança de arquivo **não o
-- alterou**: ele afirma o estado final do catálogo, e não onde a instrução mora.
ALTER TABLE "negocio"."cobranca_derivada"
	RENAME COLUMN "nosso_numero" TO "numero_do_titulo_no_provedor";--> statement-breakpoint

-- ===========================================================================
-- 3. A política nominal em `negocio.cobranca`, e o privilégio MÍNIMO do papel
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- ⚠️ `SECURITY DEFINER` NÃO atravessa `FORCE ROW LEVEL SECURITY` — medido, e já custou uma rodada
-- ---------------------------------------------------------------------------
--
-- O registro fica aqui porque é aqui que a tentação de "simplificar" acontece. A rodada 1 da task da
-- `0014` escreveu a função como `SECURITY DEFINER` pertencente a `sysloc_migracao`, no molde das
-- funções da `0008` e da `0010`, e a Revisão Técnica mediu que ela devolvia **zero linhas em 100%
-- das chamadas** do único cenário que existe para atender — silenciosamente, porque zero linhas é
-- resposta válida.
--
-- O mecanismo, em três frases: `SECURITY DEFINER` faz `current_user` virar o **dono da função**; o
-- dono era `sysloc_migracao`, que é também o **dono da tabela**; e `FORCE` é precisamente o que
-- deixa de isentar o dono da tabela. `negocio.cobranca` tem `FORCE` desde a `0010`, e nada resgata o
-- papel — ele nasce `NOSUPERUSER NOBYPASSRLS` nas duas frentes de provisionamento —, de modo que a
-- política de isolamento é avaliada DENTRO da função, sem contexto vira `empresa_id = NULL`, e não
-- casa linha nenhuma.
--
-- O que atravessa, então, são **duas** coisas que só funcionam juntas: a **posse** pelo papel
-- nominal (bloco 7) e a **política endereçada a ele** (aqui). Nenhuma basta sozinha.
--
-- `FOR SELECT` e nada mais: o papel **roteia, e não escreve** — toda escrita da notícia corre por
-- `sysloc_app`, sob a política de isolamento da `0010`, com o contexto já fixado pelo valor que esta
-- função descobriu. `USING (true)` é o que se pretende: o recorte de QUAL linha sai não é desta
-- política, e sim do `WHERE` da função, que casa pelo identificador que **o próprio produto** compôs
-- e enviou ao provedor, único no SaaS (ADR-0033). Políticas permissivas se combinam por OU, então
-- esta **acrescenta** um caminho para um papel só e não relaxa nada para os demais.
CREATE POLICY "cobranca_roteamento_sem_contexto"
	ON "negocio"."cobranca"
	FOR SELECT
	TO "sysloc_roteamento"
	USING (true);--> statement-breakpoint

-- Política libera a LINHA; privilégio libera a RELAÇÃO — são coisas diferentes, e sem as duas
-- concessões abaixo a função levantaria `42501` em vez de devolver vazio. O `ALTER DEFAULT
-- PRIVILEGES` do `0001_seguranca.sql` alcança `sysloc_app`, e só ele.
--
-- São exatamente os dois privilégios do estado final, e a minimalidade é o que a emenda da ADR-0024
-- cobra: `USAGE` no schema — sem `CREATE`, que o bloco 7 empresta e devolve — e `SELECT` sobre **UMA
-- tabela**, sem `INSERT`/`UPDATE`/`DELETE` e sem alcance a nenhuma outra relação de `negocio`.
GRANT USAGE ON SCHEMA "negocio" TO "sysloc_roteamento";--> statement-breakpoint
GRANT SELECT ON TABLE "negocio"."cobranca" TO "sysloc_roteamento";--> statement-breakpoint

-- ===========================================================================
-- 4. O roteamento da notícia — a ÚNICA leitura desta fatia sem contexto de empresa
-- ===========================================================================
--
-- Quem envia a notícia **não tem sessão** e não é ninguém do produto: é o provedor, relatando um
-- fato sobre um título nosso (ADR-0035). Não existe, portanto, contexto de empresa a fixar antes da
-- leitura — e sob a política de isolamento da `0010` a leitura sem contexto devolve **zero linhas**,
-- corretamente. **A empresa é o RESULTADO desta função, não a entrada dela**, e é literalmente o que
-- a emenda de 2026-08-18 da ADR-0024 declara ao dizer que a carga da fila desta borda **não** carrega
-- empresa: pôr `empresaId` ali não seria conformidade, seria violação, porque o único valor
-- disponível na borda viria do **recebido**.
--
-- ---------------------------------------------------------------------------
-- As quatro propriedades, e cada uma é conteúdo
-- ---------------------------------------------------------------------------
--
-- 1. **NÃO aceita `empresa_id` por parâmetro.** Pedir roteamento em nome de uma empresa é
--    **irrepresentável pela assinatura**, e não apenas recusado. Um tenant vindo de fora seria uma
--    segunda origem de contexto — exatamente o que a ADR-0024 fecha —, e aqui a origem externa é
--    literalmente não confiável.
--
-- 2. **Devolve quatro colunas, e nenhuma a mais.** Não devolve valor, vencimento, locatário nem
--    qualquer outra. Uma função `SECURITY DEFINER` é um furo declarado na política: o que ela
--    publica é o que qualquer chamador do papel de aplicação alcança sem sessão, e cada coluna a
--    mais alarga o furo. As quatro são o mínimo do consumidor: `empresa_id` fixa o contexto,
--    `cobranca_id` e `codigo` nomeiam a cobrança na trilha, e `numero_do_titulo_no_provedor` é o que
--    a conferência compara com o que a notícia trouxe.
--
-- 3. **`SET search_path = pg_catalog, pg_temp`** fecha o vetor clássico de `SECURITY DEFINER`: sem
--    ele, quem chama escolhe o `search_path` e pode interpor objeto próprio no caminho de resolução
--    de nome, executando-o com os direitos da dona. Mesmo molde da `0008`, da `0010` e da `0014`.
--
-- 4. **`STABLE`**, porque ela apenas lê. Ela não emite número, não grava nada e não avança contador
--    algum — ao contrário das funções de série da `0008` e da `0010`, que são `VOLATILE`.
--
-- ⚠️ **Nenhum `WHERE` de estado.** A função não filtra por `pago_em`, `cancelado_em` nem por boleto
-- vivo: quem decide o que fazer com a cobrança encontrada é a tarefa, que **confere com o provedor**
-- antes de qualquer efeito. Filtrar aqui faria a notícia de uma cobrança já baixada virar
-- indistinguível da notícia sem correspondência — e as duas têm desfechos diferentes e registrados.
CREATE FUNCTION "negocio"."rotear_notificacao_bancaria"(p_identificador text)
	RETURNS TABLE (empresa_id uuid, cobranca_id uuid, codigo text, numero_do_titulo_no_provedor text)
	LANGUAGE sql
	STABLE
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
	SELECT c.empresa_id, c.id, c.codigo, c.numero_do_titulo_no_provedor
	FROM negocio.cobranca c
	WHERE c.identificador_no_provedor = p_identificador;
$$;--> statement-breakpoint

-- ===========================================================================
-- 5. Privilégio da função — `EXECUTE`, e SÓ ele
-- ===========================================================================
--
-- O PostgreSQL concede `EXECUTE` a `PUBLIC` por omissão em toda função nova, e `PUBLIC` alcança TODO
-- papel do agrupamento, presente e futuro. Numa função `SECURITY DEFINER` que atravessa a política
-- de linha, isso significaria que qualquer papel capaz de conectar rotearia cobrança de qualquer
-- empresa. O `REVOKE` vem ANTES do `GRANT` de propósito: invertido, ele apagaria a concessão nominal
-- que acabou de ser feita.
--
-- A assinatura é escrita por extenso (com o tipo do parâmetro) porque é ela que identifica a função
-- — o nome sozinho é ambíguo para o `REVOKE`/`GRANT` quando houver sobrecarga. Mesmo molde do bloco
-- 5 da `0008`, do bloco 6 da `0010`, do bloco 4 da `0014` e do bloco 4 da `0016`.
REVOKE ALL ON FUNCTION "negocio"."rotear_notificacao_bancaria"(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."rotear_notificacao_bancaria"(text) TO "sysloc_app";--> statement-breakpoint

-- ===========================================================================
-- 6. A tabela crua de `plataforma` — os quatro verbos para o papel da aplicação
-- ===========================================================================
--
-- O `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"` do `0001_seguranca.sql` declara
-- `IN SCHEMA "identidade", "negocio"` — **`plataforma` não está lá**, e por isso a concessão precisa
-- ser escrita. O `USAGE` no schema já veio da `0016` (bloco 2), quando a função do identificador
-- bancário nasceu ali; o que falta é o alcance à relação.
--
-- Os quatro verbos, e nenhum a mais (sem `TRUNCATE`, sem `REFERENCES`, sem `TRIGGER`): a aplicação
-- grava a notícia, lê o cru, carimba o desfecho e expurga o vencido — são exatamente as quatro
-- operações de `packages/db/src/notificacao-bancaria.ts`. O `DELETE` está aqui por causa do expurgo
-- dos 90 dias (RN-11), e não é sobra.
--
-- ⚠️ **Nenhuma política a alcança, e a ausência é a decisão** (ADR-0031): a tabela não tem
-- `empresa_id`, não é dado de empresa nenhuma, e a `0019` não habilita RLS nela. A proteção do que
-- mora em `plataforma` é papel de conexão e privilégio — é o que esta concessão delimita.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "plataforma"."notificacao_bancaria" TO "sysloc_app";--> statement-breakpoint

-- ===========================================================================
-- 7. E, por ÚLTIMO, o DONO — a metade da travessia que a `0014` já custou aprender
-- ===========================================================================
--
-- A troca de dono vem por último, e a posição é conteúdo — não arrumação.
--
-- O provisionamento concede a membership com `WITH INHERIT FALSE, SET TRUE`: `sysloc_migracao` pode
-- **assumir** `sysloc_roteamento` deliberadamente, mas não **herda** os privilégios dele. Daí que,
-- depois do `ALTER`, ele deixa de poder conceder sobre esta função sem um `SET ROLE` explícito — e é
-- por isso que o `REVOKE`/`GRANT` do bloco 5 vem antes. Invertida a ordem, a migração aborta com
-- `42501` na primeira instalação, e o motivo não seria óbvio para quem lesse só o erro.
--
-- ⚠️ **A consequência NÃO se limita a conceder, e vale para as migrações seguintes.** O PostgreSQL
-- avalia a verificação de propriedade por `has_privs_of_role`, que **respeita o `INHERIT`** — logo
-- `sysloc_migracao` deixa de ser reconhecido como dono desta função para TODO ato de propriedade. A
-- partir daqui, **qualquer migração que substitua, altere ou remova
-- `negocio.rotear_notificacao_bancaria(text)` precisa de `SET ROLE "sysloc_roteamento";` antes** —
-- isso alcança `CREATE OR REPLACE FUNCTION`, `DROP FUNCTION`, `ALTER FUNCTION … SET search_path` e um
-- novo `ALTER … OWNER TO`. Sem o `SET ROLE` a migração aborta com `42501`, e o erro nomeia a função,
-- não a membership: quem estiver lendo só a mensagem não tem como chegar sozinho até aqui.
--
-- `ALTER … OWNER TO` cobra DUAS coisas, medidas contra o servidor na `0014`:
--
--   1. quem executa tem de ser **membro** do papel de destino — é a razão de existir daquela
--      membership, e a única coisa para que ela serve;
--   2. o papel de destino tem de ter **`CREATE` no schema da função**. Sem ele a migração aborta com
--      `permission denied for schema negocio`.
--
-- O `CREATE` é, portanto, **emprestado e devolvido na mesma migração**: ele é exigência do ato de
-- trocar o dono, não do ato de rotear. Deixá-lo concedido daria a um papel de propósito único a
-- capacidade permanente de criar objeto em `negocio` — e o estado final auditável passa a ser
-- exatamente `USAGE` no schema mais `SELECT` em uma tabela. O `CT-973` afirma isso pelo catálogo.
GRANT CREATE ON SCHEMA "negocio" TO "sysloc_roteamento";--> statement-breakpoint
ALTER FUNCTION "negocio"."rotear_notificacao_bancaria"(text) OWNER TO "sysloc_roteamento";--> statement-breakpoint
REVOKE CREATE ON SCHEMA "negocio" FROM "sysloc_roteamento";
