-- Segurança do domínio bancário — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado da `0015`
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro, que o
-- `0008_seguranca_contrato.sql` fez para o contrato, que o `0010_seguranca_cobranca.sql` fez para a
-- cobrança, que o `0012_seguranca_regua.sql` fez para a régua e que o `0014_seguranca_confirmacao.sql`
-- fez para o portador, pela mesma razão, que não envelheceu: o gerador de migração declara
-- `ENABLE ROW LEVEL SECURITY` (a `0015` o faz), mas **não emite `FORCE ROW LEVEL SECURITY`, política
-- alguma, sequência nem função** — a consequência que a ADR-0009 registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO da tabela ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura da `0015` sobrescreve o
-- que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento. Pela
-- mesma razão, **nada aqui emenda migração já aplicada**: elas descrevem schemas já aplicados.
-- ⚠️ A `0010` tem, além disso, uma `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho
-- (a primeira aplicação a banco durável) **fecha em silêncio**: quem for tocá-la lê o marcador
-- primeiro. Esta fatia não a toca.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta é
-- restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não cria schema.** `plataforma` nasce no provisionamento, com dono `sysloc_migracao` — as
--     duas frentes o criam: `deploy/scripts/instalacao/provisionar-base.sh` (P16) em operação e
--     `provisionar()` de `packages/db/test/banco-efemero.ts` na verificação. Criá-lo aqui exigiria
--     conceder ao migrador o privilégio `CREATE` sobre um banco cujo dono é o papel da aplicação —
--     poder maior do que a tarefa pede, e é o que o cabeçalho da `0000_fundacao.sql` registra. A
--     guarda é executável: `verificar-migracao.sh`, asserção `(e)`, exige **zero** `CREATE SCHEMA`
--     em código nos arquivos de migração, e o mutante ao lado prova que a varredura acusa;
--   * **não cria o índice único parcial do vigente.** `certificado_do_provedor_vigente_uidx` é
--     declarável no Drizzle e sai da `0015` gerada, pelo precedente literal de
--     `contrato_imovel_vigente_uidx` na `0007`. Escrevê-lo aqui criaria uma SEGUNDA declaração do
--     mesmo índice, ausente do schema declarado, e a regeração seguinte proporia criá-lo de novo;
--   * **não concede privilégio de TABELA** — o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"
--     IN SCHEMA "identidade", "negocio" … ON TABLES` do `0001_seguranca.sql` já faz a concessão
--     acompanhar a criação. A tabela deste par de migrações nasce daquele papel e naquele schema;
--   * **não cria papel.** `sysloc_migracao` é `NOCREATEROLE`, e nenhum papel novo é preciso: a função
--     do bloco 3 pertence ao próprio migrador (ver ali por que ela **não** precisa do
--     `sysloc_resolucao` da `0014`);
--   * **não cria tipo enumerado nem visão** — o certificado não tem estado a enumerar (vigente é
--     `substituido_em IS NULL`, e vencido é `valido_ate` no passado, os dois derivados no instante da
--     leitura, ADR-0022) e não deriva estado publicado que participe de seleção (ADR-0023).
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada na tabela nova, e a política
-- ===========================================================================
--
-- `ENABLE` (na `0015`) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez de
-- uma propriedade de com qual papel alguém conectou.
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`, a do `0006_seguranca_dominio.sql`, a do
-- `0008_seguranca_contrato.sql`, a do `0010_seguranca_cobranca.sql`, a do `0012_seguranca_regua.sql`
-- e a do `0014_seguranca_confirmacao.sql`. Ela não é reinventada aqui, e o motivo é o mesmo que faz
-- o CT-007 reler a migração do disco em vez de recompor a política no teste: duas redações do mesmo
-- isolamento são livres para divergir, e a divergência não faz barulho — ela aparece como uma tabela
-- que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide o
-- que pode ser gravado, e as duas são a MESMA expressão: divergi-las abriria o caso "enxerga só o
-- seu, grava para o alheio". O segundo argumento `true` de `current_setting` devolve NULO quando a
-- variável não foi fixada, e `nullif(…, '')` trata a variável fixada em cadeia vazia — nos dois casos
-- a comparação vira `empresa_id = NULL`, que não casa linha nenhuma: **contexto ausente resulta em
-- vazio, nunca em dado alheio**. `FOR ALL` cobre os quatro verbos numa política só.
--
-- ⚠️ Aqui não há exceção nominal alguma, e a ausência é a decisão: diferente do portador da `0014`,
-- **nada neste domínio é lido sem contexto de empresa**. Quem instala, substitui e usa o certificado
-- é sempre alguém com sessão da própria empresa (ADR-0027 não o alcança), de modo que não existe o
-- caso que justificaria uma segunda política nem uma função que atravesse esta.
ALTER TABLE "negocio"."certificado_do_provedor" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "certificado_do_provedor_isolamento_empresa"
	ON "negocio"."certificado_do_provedor"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 2. O alcance de `sysloc_app` ao schema `plataforma` — `USAGE`, e SÓ ele
-- ===========================================================================
--
-- Sem `USAGE` no schema, o papel da aplicação não consegue sequer RESOLVER o nome da função do bloco
-- 3, e a chamada morre em `42501` antes de qualquer `EXECUTE` concedido importar.
--
-- ⚠️ **A concessão precisa estar AQUI, e não só no provisionamento.** O
-- `GRANT USAGE ON SCHEMA "identidade", "negocio" TO "sysloc_app"` do `0001_seguranca.sql` nomeia
-- exatamente dois schemas, e `0001` é imutável; o provisionamento concede `plataforma` em operação,
-- mas a instância efêmera da suíte **não roda `provisionar-base.sh`** — ela reproduz dele apenas a
-- criação dos papéis e dos schemas. Confiar só no provisionamento faria a verificação divergir da
-- operação exatamente no privilégio que a fatia introduz. As duas frentes concedem, e `GRANT` é
-- idempotente.
--
-- **`CREATE` NÃO é concedido**, e a ausência é o que mantém verdadeira a asserção `(d)` do CT-031 e
-- a `(d)` do CT-030: o papel que atende requisição não cria objeto em schema nenhum.
GRANT USAGE ON SCHEMA "plataforma" TO "sysloc_app";--> statement-breakpoint

-- ===========================================================================
-- 3. O contador do identificador perante o provedor — escopo do SaaS (ADR-0033)
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- Por que a sequência mora em `plataforma`, e não em `negocio`
-- ---------------------------------------------------------------------------
--
-- Ela não é dado de empresa nenhuma. O número que ela emite é o identificador com que **o SaaS** se
-- apresenta ao provedor, e a unicidade dele é exigida por um terceiro que não conhece a fronteira de
-- empresa: duas imobiliárias emitindo o mesmo número é o defeito que o sistema antigo tinha, pela
-- razão oposta. É a ADR-0031 — o que não tem dono-empresa vive fora do schema de negócio e **não
-- carrega `empresa_id`** —, e é por isso que uma sequência por empresa aqui seria erro, não variação.
--
-- ⚠️ **A ADR-0015 está SUPERSEDED pela ADR-0033.** Não "corrija" este contador para ser por empresa
-- citando aquela: o quantificador universal dela (*"todo contador sequencial deste produto é único
-- por empresa"*) é exatamente o que esta série falsifica, e foi o que motivou a substituição.
--
-- ---------------------------------------------------------------------------
-- As três propriedades da declaração, e cada uma é conteúdo
-- ---------------------------------------------------------------------------
--
--   * **`MINVALUE 1` com `START 1`** — o primeiro identificador é `1`, e não um valor negociado com
--     o provedor. A faixa começa onde o formato começa;
--   * **`MAXVALUE 999999999999`** — doze posições, que é o que o campo do provedor comporta. O teto
--     declarado é o que faz o esgotamento virar erro ruidoso em vez de um número que o provedor
--     recusaria depois, longe da causa;
--   * **`NO CYCLE`** — esgotada a faixa, a sequência **levanta** em vez de voltar ao início.
--     Reciclar reusaria número já entregue ao provedor, e a ADR-0033 é literal: furo na sequência é
--     aceito, e o número **nunca** é reusado — nem por registro excluído, nem por criação abortada.
--     `nextval` não participa do desfazimento (ADR-0020), que é o que produz o furo e o que garante
--     que criações concorrentes não esperem umas pelas outras.
CREATE SEQUENCE "plataforma"."identificador_bancario_seq"
	AS bigint
	START WITH 1
	MINVALUE 1
	MAXVALUE 999999999999
	NO CYCLE;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- A função SEM PARÂMETRO — e a ausência de parâmetro É a declaração de escopo
-- ---------------------------------------------------------------------------
--
-- DECISÃO FECHADA — F4/T4 · 2026-08-14
-- O QUÊ: `plataforma.proximo_identificador_bancario()` não recebe parâmetro algum — nem
--        `empresa_id`, nem ano, nem prefixo — e a sequência que ela avança é UMA, fixa e nomeada
--        aqui.
-- POR QUÊ: é a ADR-0033 materializada. O escopo desta série é o SaaS, e **pedir o próximo
--          identificador em nome de uma empresa precisa ser irrepresentável** — não recusado por
--          conferência que alguém possa reordenar ou esquecer. Um parâmetro de empresa, ainda que
--          ignorado no corpo, reintroduziria a assinatura pela qual a próxima fatia comporia um
--          nome de sequência por empresa (é o molde da `0008` e da `0010`, que valem para séries de
--          escopo `(empresa, ano)` e **não** para esta). O acréscimo seria silencioso: nada
--          quebraria, e duas imobiliárias passariam a emitir o mesmo número para o mesmo provedor.
-- REVERTER EXIGE: provar que o provedor distingue emissores pela fronteira de empresa deste SaaS —
--                 o que a ADR-0033 registra como falso, e cuja consequência medida é a colisão entre
--                 imobiliárias —, ou exibir supersessão da ADR-0033 por `/agent-spec-adr-supersede`.
--
-- `SECURITY DEFINER` é o que permite a `sysloc_app` avançar o contador **sem** ter privilégio algum
-- sobre a sequência: a função roda com os direitos do dono dela, que é `sysloc_migracao`, dono também
-- do schema e da sequência. É o mesmo mecanismo das quatro funções de série já existentes.
--
-- ⚠️ **Ela NÃO precisa do papel `sysloc_resolucao` da `0014`, e a distinção importa.** Lá o
-- `SECURITY DEFINER` existia para **atravessar `FORCE ROW LEVEL SECURITY`** de uma tabela de negócio
-- — e não atravessava, justamente porque o dono da função era o dono da tabela forçada. Aqui não há
-- política de linha a atravessar: sequência não tem RLS, e em `plataforma` a proteção é papel e
-- privilégio (ADR-0031, Cons). Copiar o papel de propósito único para cá seria transportar a solução
-- de um problema que não existe neste bloco.
--
-- `SET search_path = pg_catalog, pg_temp` fecha o vetor clássico de `SECURITY DEFINER`: sem ele, quem
-- chama escolhe o `search_path` e pode interpor objeto próprio no caminho de resolução de nome,
-- executando-o com os direitos da dona. O schema temporário vem por ÚLTIMO pela mesma razão que a
-- `0010` registra. O nome da sequência é escrito **qualificado** no corpo, e não depende do caminho.
CREATE FUNCTION "plataforma"."proximo_identificador_bancario"()
	RETURNS bigint
	LANGUAGE plpgsql
	SECURITY DEFINER
	SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
	RETURN nextval('plataforma.identificador_bancario_seq'::regclass);
END;
$$;--> statement-breakpoint

-- ===========================================================================
-- 4. Privilégio da função — `EXECUTE`, e SÓ ele
-- ===========================================================================
--
-- O PostgreSQL concede `EXECUTE` a `PUBLIC` por omissão em toda função nova, e `PUBLIC` alcança TODO
-- papel do agrupamento, presente e futuro. Numa função `SECURITY DEFINER` que avança um contador do
-- SaaS inteiro, isso significaria que qualquer papel capaz de conectar consumiria identificadores —
-- furos que ninguém pediu, num espaço numérico finito. O `REVOKE` vem ANTES do `GRANT` de propósito:
-- invertido, ele apagaria a concessão nominal que acabou de ser feita — é o que a §6 da `0010`
-- registra por extenso.
--
-- A assinatura é escrita por extenso, e aqui ela é o par de parênteses VAZIO — que é a assinatura
-- completa de uma função sem parâmetro. Ela identifica a função; o nome sozinho é ambíguo para o
-- `REVOKE`/`GRANT` quando houver sobrecarga, e uma sobrecarga com parâmetro é precisamente o que a
-- `DECISÃO FECHADA` do bloco 3 proíbe.
REVOKE ALL ON FUNCTION "plataforma"."proximo_identificador_bancario"() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "plataforma"."proximo_identificador_bancario"() TO "sysloc_app";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- E o que NÃO se concede: privilégio algum sobre a SEQUÊNCIA
-- ---------------------------------------------------------------------------
--
-- DECISÃO FECHADA — F4/T4 · 2026-08-14
-- O QUÊ: `sysloc_app` recebe `EXECUTE` sobre a função e **nada** sobre
--        `plataforma.identificador_bancario_seq` — nem `USAGE`, nem `SELECT`, nem `UPDATE`, nem por
--        `ALTER DEFAULT PRIVILEGES`.
-- POR QUÊ: é a mesma decisão que o `DECISÃO FECHADA — F3/T3 · 2026-08-10` da `0010` §6 e o
--          `DECISÃO FECHADA — T3 · 2026-08-09` da `0008` §5 registram para as séries de contrato e
--          cobrança, e o raciocínio é REFERENCIADO daqui em vez de recopiado. Em uma linha: conceder
--          abriria um SEGUNDO caminho para o número — um `nextval` direto —, pelo qual a assinatura
--          sem parâmetro deixaria de ser o único acesso ao contador, e a irrepresentabilidade que o
--          bloco 3 protege viraria mera convenção.
-- REVERTER EXIGE: provar que existe consumidor legítimo do contador FORA desta função.
--
-- Nada precisa ser revogado aqui: o `ALTER DEFAULT PRIVILEGES` do `0001` declara apenas `ON TABLES` e
-- `ON TYPES`, e **em `identidade` e `negocio`** — nem ele nem `GRANT … ON ALL TABLES` alcançam
-- sequência, e nenhum dos dois alcança `plataforma`. A sequência nasce, portanto, sem privilégio
-- algum para `sysloc_app` **por construção**, e não por revogação que alguém precise lembrar de
-- escrever. O `GRANT USAGE` do bloco 2 é de SCHEMA, e schema não empresta privilégio ao que está
-- dentro dele.
