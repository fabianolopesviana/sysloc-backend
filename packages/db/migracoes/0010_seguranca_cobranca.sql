-- Segurança da cobrança e da mora — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0009
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro e que o
-- `0008_seguranca_contrato.sql` fez para o contrato, pela mesma razão, que não envelheceu: o gerador
-- de migração declara `ENABLE ROW LEVEL SECURITY` (o `0009` o faz), mas **não emite
-- `FORCE ROW LEVEL SECURITY`, política alguma, função nem visão** — a consequência que a ADR-0009
-- registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura do `0009` sobrescreve
-- o que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento.
-- Pela mesma razão, **nada aqui emenda a `0007` ou a `0008`** — elas descrevem schemas já aplicados
-- e são, portanto, imutáveis.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não concede privilégio de TABELA nem de VISÃO** — o `ALTER DEFAULT PRIVILEGES FOR ROLE
--     "sysloc_migracao" IN SCHEMA "identidade", "negocio" … ON TABLES` do `0001_seguranca.sql` já
--     faz a concessão acompanhar a criação, e `ON TABLES` alcança visão. As duas tabelas, os dois
--     tipos e a visão deste par de migrações nascem daquele papel. Os `GRANT USAGE ON TYPE` do
--     bloco 2 são a única concessão declarada de novo, seguindo o precedente do `0001` e do `0008`;
--   * **não concede `USAGE ON SEQUENCES`** — ver o bloco 5, onde a ausência é a decisão;
--   * **não cria schema nem papel** — os dois vêm do provisionamento;
--   * **nenhum `ALTER ... OWNER`** — as tabelas, a visão e as funções nascem do papel de migração
--     por consequência de ser ele quem as cria, e é dele que o `SECURITY DEFINER` toma os direitos.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas duas tabelas, e as políticas
-- ===========================================================================
--
-- `ENABLE` (no 0009) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`, a do `0006_seguranca_dominio.sql` e a do
-- `0008_seguranca_contrato.sql`. Ela não é reinventada aqui, e o motivo é o mesmo que faz o CT-007
-- reler a migração do disco em vez de recompor a política no teste: duas redações do mesmo
-- isolamento são livres para divergir, e a divergência não faz barulho — ela aparece como uma
-- tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado, e as duas são a MESMA expressão: divergi-las abriria o caso "enxerga só o
-- seu, grava para o alheio". O segundo argumento `true` de `current_setting` devolve NULO quando a
-- variável não foi fixada, e `nullif(…, '')` trata a variável fixada em cadeia vazia — nos dois
-- casos a comparação vira `empresa_id = NULL`, que não casa linha nenhuma: **contexto ausente
-- resulta em vazio, nunca em dado alheio**. `FOR ALL` cobre os quatro verbos numa política só.
ALTER TABLE "negocio"."cobranca" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."configuracao_de_mora" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cobranca_isolamento_empresa"
	ON "negocio"."cobranca"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "configuracao_de_mora_isolamento_empresa"
	ON "negocio"."configuracao_de_mora"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 2. Os dois tipos enumerados novos
-- ===========================================================================
--
-- `USAGE` no tipo enumerado é exigido para gravar valor em coluna do tipo — e, no caso do
-- `status_cobranca`, para LER a coluna derivada da visão, que é do tipo. O `ALTER DEFAULT
-- PRIVILEGES … GRANT USAGE ON TYPES` do `0001` já cobriria, porque os tipos são criados por
-- `sysloc_migracao`; a declaração explícita segue o precedente daquele arquivo e do `0008`, que
-- nomeiam os tipos um a um mesmo tendo o padrão. O parágrafo do bloco 3 da `0008` registra a
-- divergência com a `0006` (que decidiu ao contrário) e a razão de a linha valer a pena — ela vale
-- aqui pelos mesmos motivos, com um a mais: o `status_cobranca` não tem coluna de tabela alguma, e
-- é neste ponto que se lê qual papel pode consultá-lo.
GRANT USAGE ON TYPE "negocio"."natureza_cobranca" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."status_cobranca" TO "sysloc_app";--> statement-breakpoint

-- ===========================================================================
-- 3. A data corrente da operação — ponto único, e o fuso é do OBJETO
-- ===========================================================================
--
-- A transição para `VENCIDA` depende de "que dia é hoje", e `CURRENT_DATE` responde isso segundo o
-- fuso da **sessão**: a virada do dia — e portanto a transição — mudaria de hora conforme quem
-- conectou, e a mesma cobrança apareceria vencida para um cliente e em dia para outro. Esta função
-- torna o fuso propriedade do OBJETO: quem consulta não tem como mudá-lo, e nada precisa fixar
-- `TimeZone` na sessão. Em especial, ela **não toca** o `DECISÃO FECHADA` de
-- `packages/db/src/unidade-de-trabalho.ts`, que governa o que a unidade de trabalho emite.
--
-- `STABLE` (e não `VOLATILE`): dentro de uma mesma instrução o valor não muda, que é o que permite
-- ao planejador avaliá-la uma vez e ao índice ser usado numa comparação com ela. Não é `IMMUTABLE`
-- — o valor muda entre instruções, e marcá-la assim autorizaria o servidor a congelá-la num índice.
--
-- É `LANGUAGE sql` sem `SET search_path`: ela não é `SECURITY DEFINER`, roda com os direitos de quem
-- chama, e tudo que o corpo referencia é qualificado em `pg_catalog`. A ausência do `SET` é o que
-- mantém a função INLINÁVEL pelo planejador — com ele, a visão perderia a substituição e a
-- comparação com `data_vencimento` deixaria de aproveitar índice.
CREATE FUNCTION "negocio"."data_corrente_da_operacao"()
	RETURNS date
	LANGUAGE sql
	STABLE
AS $$
	SELECT (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;--> statement-breakpoint

-- ===========================================================================
-- 4. A visão `cobranca_derivada` — a fonte ÚNICA do estado publicado e da mora
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- Por que ela existe, e por que no BANCO
-- ---------------------------------------------------------------------------
--
-- A ADR-0022 decide que o estado publicado da cobrança é **derivado dos fatos gravados**, nunca
-- coluna movida por rotina; a ADR-0023 decide **onde** a derivação vive: no banco, quando ela
-- participa de seleção (filtrar as vencidas, ordenar por estado, paginar) ou compõe aritmética
-- monetária. As duas coisas são verdadeiras aqui, e o preço de derivar na aplicação seria trazer a
-- carteira inteira para a memória antes de filtrar, e devolver o dinheiro ao ponto flutuante.
--
-- A assimetria é o que torna a unicidade VERIFICÁVEL: a **escrita** vai na tabela, a **leitura** vai
-- na visão. Não há segundo lugar em que `status` ou mora sejam calculados — e é a divergência entre
-- três avaliações do mesmo estado que o legado carrega e que esta fatia existe para fechar.
--
-- `c.*` expande as colunas de `negocio.cobranca` **no instante da criação da visão**: coluna
-- acrescentada à tabela depois NÃO aparece aqui sozinha. É o comportamento desejado — a visão é
-- superfície publicada, e crescer por acidente é como um campo interno vaza — mas quem acrescentar
-- coluna que deva ser publicada precisa recriar a visão numa migração nova.
--
-- ---------------------------------------------------------------------------
-- A precedência do estado (RD-04), e a fronteira ESTRITA do vencimento
-- ---------------------------------------------------------------------------
--
-- `CANCELADA` se há cancelamento; senão `PAGA` se há pagamento; senão `VENCIDA` se o vencimento já
-- passou; senão `A_VENCER`. A ordem é conteúdo: ela é o que impede uma linha paga e vencida ao mesmo
-- tempo de existir na leitura — e a restrição `cobranca_desfecho_unico_chk` do `0009` é o que impede
-- a linha incoerente de existir na ESCRITA. As duas se somam; nenhuma substitui a outra.
--
-- A comparação é `<`, e não `<=`: **quem vence hoje ainda está em dia**. É decisão desta fatia, e
-- não porte — medido, o golden `marcar-cobrancas-vencidas.json` tem os deslocamentos `-12`, `-3`,
-- `+15` e `-40`, e **nenhum `0`**, de modo que o legado nunca foi perguntado sobre o único ponto em
-- que `<` e `<=` discordam. Com `<=`, a multa integral incidiria no próprio dia do vencimento, com
-- `dias_atraso = 0` — 2% por zero dia de atraso. **Não "corrija" para `<=` contra o golden.**
--
-- ---------------------------------------------------------------------------
-- A mora (RD-07), e o UM arredondamento por parcela
-- ---------------------------------------------------------------------------
--
-- Juros **simples**, base **mês comercial de 30 dias**, e eles **não incidem sobre a multa** — a
-- base dos dois é sempre `valor_original`. A fórmula é a do oráculo
-- (`docs/specs/features/caracterizacao-regras-legadas/v1/golden/calcular-mora.json`), escrita na
-- mesma ordem dele:
--
--     multa = round(valor_original * multa_pct / 100, 2)
--     juros = round(valor_original * (juros_pct / 100) / 30 * dias_atraso, 2)
--     total = round(valor_original + multa + juros, 2)
--
-- **A posição do arredondamento é conteúdo, não estilo**, e a razão é a LITERALIDADE do oráculo:
-- `formula.juros` do golden declara `arredondar(valor_original * (juros_percentual / 100) / 30 *
-- dias_atraso)`, e é essa a forma escrita aqui — um `round` por parcela, nenhum nos passos
-- intermediários. Qualquer outra ordem de arredondamento, e qualquer forma algebricamente
-- equivalente — inclusive a divisão única (`valor_original * juros_pct * dias / 3000`) —, passa a
-- exigir prova PRÓPRIA contra o golden, caso a caso, e nunca entra por parecer mais limpa. O
-- `numeric` do PostgreSQL leva a divisão a 16+ dígitos significativos, de modo que a forma acima é
-- exata.
--
-- Este parágrafo citava um contrafactual (`1234.56` a 17 dias indo de `7,00` a `7,02` se o
-- arredondamento subisse de posição), **removido em 2026-08-10 por não se reproduzir**: medidas as
-- três ordens num PostgreSQL efêmero, todas dão o mesmo centavo. Justificativa que não se reproduz
-- é pior que justificativa ausente — ela convida a rodada seguinte a "corrigir" a fórmula quando
-- descobrir que o número não bate. O que sustenta a decisão é o oráculo, não aquele caso.
--
-- **`round(numeric, 2)` arredonda meio para LONGE DO ZERO** — é o `ROUND_HALF_UP` que o oráculo
-- declara em `formula.arredondamento`, e não o modo bancário. A coincidência está afirmada aqui
-- porque ela é premissa da equivalência, e não consequência dela: `round(double precision)` do
-- PostgreSQL segue outra regra, e trocar o tipo em qualquer ponto do caminho a quebraria em
-- silêncio. É a razão de toda a aritmética desta visão correr em `numeric` (RD-16).
--
-- A mora só é APURADA no estado `VENCIDA`: nos demais, as duas expressões dão zero. É a precedência
-- que impede o produto de reproduzir a divergência do legado, em que uma cobrança paga com atraso
-- continuava apurando mora depois de liquidada — aqui, o que foi cobrado no ato do pagamento está
-- CARIMBADO em `multa_aplicada`/`juros_aplicados`, e não recalculado a cada leitura.
--
-- ---------------------------------------------------------------------------
-- O CARIMBO TEM PRECEDÊNCIA SOBRE A APURAÇÃO — emenda da T7, e por que ela mora AQUI
-- ---------------------------------------------------------------------------
--
-- CAUSA-RAIZ: apurar zero fora de `VENCIDA` e **publicar** zero são coisas diferentes, e a primeira
-- redação desta visão as confundia. O carimbo é fato gravado na tabela, mas `multa_aplicada` e
-- `juros_aplicados` **não estão entre as dezoito colunas que o contrato publica**
-- (`esquemaDaCobranca`, em `packages/contracts/src/cobranca.ts`): as duas grandezas chegam ao cliente
-- por `valor_multa` e `valor_juros`, e só por elas. Sem o `COALESCE` abaixo, a cobrança PAGA publicava
-- `0.00`/`0.00` e `valor_total = valor_original` — o que o cliente lia de uma cobrança liquidada não
-- era o que foi cobrado dela, e o carimbo, apesar de gravado, era inalcançável.
--
-- POR QUE ISTO FECHA A CLASSE: porque o carimbo entra na MESMA expressão que a apuração, no único
-- lugar em que a mora é avaliada. As quatro leituras publicadas (o item, a carteira sem filtro e os
-- dois recortes) e o próprio `UPDATE` que carimba passam a ler o mesmo `valor_multa`/`valor_juros`, e
-- `valor_total` os soma sem saber de onde vieram. Não existe segundo lugar em que alguém escolha
-- entre o derivado e o gravado — que é exatamente a escolha que, escrita na porta de dados ou no
-- serviço, reabriria o defeito de duas avaliações do mesmo valor (ADR-0023).
--
-- O QUE ESTA MUDANÇA REMOVE: **nada**. As duas expressões de mora, a comparação estrita do
-- vencimento, a precedência do `CASE`, o `LEFT JOIN` com `COALESCE` da RD-08, o atributo
-- `security_invoker` e o marcador `DECISÃO FECHADA` abaixo permanecem **literalmente** como estavam —
-- inclusive byte a byte na expressão dos juros, que é alvo de três mutantes de falsificação da T3 e
-- da T4 (`EXPRESSAO_DOS_JUROS`, em `packages/db/test/cobranca.spec.ts`, exige **uma** ocorrência
-- exata). O que se acrescenta é um `COALESCE` **por fora** de cada `CASE` e duas colunas de saída.
--
-- **Ela emenda a `0010` em vez de nascer numa `0011`, e a escolha é conteúdo.** Uma migração nova com
-- `CREATE OR REPLACE VIEW` deixaria **duas** redações da mesma visão no repositório — o defeito
-- "livres para divergir" que esta fatia existe para fechar — e, pior, `blocoDaVisao()` da suíte extrai
-- o bloco `CREATE VIEW` **deste** arquivo para aplicar os mutantes do CT-513 e do CT-526: com a visão
-- viva definida noutro lugar, as duas falsificações passariam a mutar e restaurar um objeto que não é
-- o do produto, e a prova valeria sobre outra coisa. A `0010` **não descreve schema já aplicado** —
-- diferente da `0007` e da `0008`, que o cabeçalho declara imutáveis por isso —, e nada além de
-- instância efêmera a executou até aqui.
--
-- Os dois percentuais **vigentes** saem publicados junto (`multa_percentual_vigente`,
-- `juros_percentual_vigente`) para que os QUATRO carimbos do pagamento venham de UMA referência a
-- esta visão, e não de uma segunda leitura da política escrita no `UPDATE`. Eles repetem o
-- `COALESCE(…, 0)` da RD-08 que as expressões já usam, e a repetição é deliberada: extrair o valor
-- comum trocaria o texto da expressão dos juros, que os três mutantes casam por igualdade exata.
--
-- DÉBITO COM GATILHO — D20 · F3/T7 · registrado 2026-08-10
-- O QUÊ: a legitimidade de EMENDAR este arquivo, em vez de escrever uma migração nova, é
--        CONDICIONAL a ele nunca ter sido aplicado a banco durável — e a condição não está
--        registrada em lugar nenhum que quem for emendar de novo vá abrir.
-- QUANDO FECHA: a PRIMEIRA aplicação da `0010` a banco durável. A partir dela o arquivo é imutável:
--               `deploy/scripts/instalacao/migrar-banco.sh` mantém `identidade.migracao_aplicada`
--               com `sha256sum` por arquivo e ABORTA a instalação, sem alterar nada, em divergência.
--               Quem precisar mudar a visão depois disso escreve uma `00NN` nova — e, se for o caso,
--               move `blocoDaVisao()` (`packages/db/test/cobranca.spec.ts`) para ler o arquivo novo,
--               ou os mutantes do CT-513 e do CT-526 passam a mutar objeto que não é o do produto.
-- POR QUE NÃO AGORA: hoje a emenda é a escolha CORRETA, e a alternativa é pior — ver o parágrafo
--                    acima. A janela está aberta e nada além de instância efêmera executou este
--                    arquivo; o que faltava era ela fechar sem ser em silêncio.
-- MEDIDO EM 2026-08-16: a janela CONTINUA ABERTA, e agora por medição e não por presunção.
--                    `select arquivo from identidade.migracao_aplicada` no banco durável deste
--                    servidor devolve TRÊS linhas — `0000`, `0001` e `0002` —, contra as 17 do
--                    repositório. Esta migração não está entre elas.
--                    ⚠️ E a medição diz ALGO MAIS, que torna o gatilho concreto: há 14 migrações
--                    pendentes, de modo que a primeira execução de `migrar-banco.sh` neste
--                    servidor aplica a `0003` até a `0016` DE UMA VEZ — e fecha esta janela junto,
--                    numa única passagem. É exatamente o "fecha em silêncio" que este marcador
--                    existe para não deixar acontecer sem aviso.
-- ÍNDICE: docs/specs/features/cobranca-e-mora/v1/_run/run-report.md §2, D20
--
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Empresa sem configuração de mora: `LEFT JOIN` e `COALESCE`, nunca `INNER JOIN`
-- ---------------------------------------------------------------------------
--
-- A junção com `configuracao_de_mora` é **externa**, e os dois percentuais passam por `COALESCE`.
-- A empresa que nunca escreveu a política apura **zero** (RD-08 e RD-21: ausência de linha e política
-- zerada são a mesma coisa publicada), e a linha **continua constando** na carteira. Um `INNER JOIN`
-- faria a cobrança inteira SUMIR da carteira dessa empresa, que é falha pior do que cobrar errado —
-- e silenciosa, porque nada acusa a linha que não veio.
--
-- A junção não escreve `empresa_id` como filtro de tenant: ela iguala a coluna das duas relações
-- para escolher a política DAQUELA cobrança, e as duas já estão sob a mesma política de linha. Não
-- há, portanto, segundo caminho para o dado (ADR-0008) — só o banco decide o que se enxerga.
--
-- ---------------------------------------------------------------------------
-- As três laterais, e por que não uma só
-- ---------------------------------------------------------------------------
--
-- Cada expressão é escrita **uma vez** e consumida pelas seguintes: `e.status` decide o estado,
-- `t.dias_atraso` deriva do estado, e `d` compõe a mora a partir dos dois. Fundi-las obrigaria a
-- repetir a expressão do estado em quatro lugares e a do atraso em dois — e expressão repetida é
-- livre para divergir, que é exatamente o defeito que esta visão existe para fechar.

-- DECISÃO FECHADA — F3/T3 · 2026-08-10
-- O QUÊ: a view roda com os direitos de QUEM A CONSULTA, nunca com os da dona.
-- POR QUÊ: o invariante é *uma visão em `negocio` não pode ser caminho mais fraco que a tabela que
--          ela lê, SEJA QUEM FOR A DONA* — o mesmo que o `DECISÃO FECHADA — fechamento da F1 (D38)`
--          de `packages/db/src/catalogo.ts` registra por extenso, REFERENCIADO daqui e não
--          recopiado (mesmo molde que o bloco 6 usa para a `0008` §5). É a obrigação literal da
--          ADR-0023: "objeto derivado com direitos próprios não é admitido".
--          **Hoje a ausência do atributo NÃO produz vazamento imediato**, e quem mediu foi esta
--          task: o mutante MT-SI1 (2026-08-10) removeu o atributo deste arquivo e a suíte deu
--          `13 failed | 75 passed`, com o CT-522 — o caso COMPORTAMENTAL — entre os aprovados e os
--          treze reprovados vindos todos da guarda de cobertura de catálogo. A razão é estrutural:
--          `sysloc_migracao` é dona das tabelas-base, mas está sob o `FORCE ROW LEVEL SECURITY` que
--          o bloco 1 deste arquivo declara, de modo que a política segue sendo avaliada sobre a
--          mesma variável de sessão e o conjunto devolvido não muda.
--          O que a ausência produz é DEPENDÊNCIA de uma propriedade que nada nesta migração
--          garante — o `FORCE` de uma tabela-base, ou o papel que aplicar a migração —, e é essa
--          dependência que o atributo remove. Não o leia como guarda sobre o dono: ele existe para
--          tornar o dono IRRELEVANTE, e é por isso que o `REVERTER EXIGE` abaixo cobra outro
--          mecanismo, e não "hoje dá no mesmo".
-- REVERTER EXIGE: provar que a view preserva o isolamento por empresa por outro mecanismo, medido
--                 com duas empresas e com a guarda de cobertura de `catalogo.ts` sem exceção.
CREATE VIEW "negocio"."cobranca_derivada"
	WITH (security_invoker = true) AS
SELECT
	c.*,
	ctr.codigo AS contrato_codigo,
	ctr.locatario_id,
	d.dias_atraso,
	d.status,
	d.valor_multa,
	d.valor_juros,
	COALESCE(m.multa_percentual, 0) AS multa_percentual_vigente,
	COALESCE(m.juros_percentual, 0) AS juros_percentual_vigente,
	round(c.valor_original + d.valor_multa + d.valor_juros, 2) AS valor_total
FROM "negocio"."cobranca" c
JOIN "negocio"."contrato" ctr
	ON ctr.id = c.contrato_id AND ctr.empresa_id = c.empresa_id
LEFT JOIN "negocio"."configuracao_de_mora" m
	ON m.empresa_id = c.empresa_id
CROSS JOIN LATERAL (
	SELECT CASE
		WHEN c.cancelado_em IS NOT NULL THEN 'CANCELADA'
		WHEN c.pago_em IS NOT NULL THEN 'PAGA'
		WHEN c.data_vencimento < "negocio"."data_corrente_da_operacao"() THEN 'VENCIDA'
		ELSE 'A_VENCER'
	END::"negocio"."status_cobranca" AS status
) AS e
CROSS JOIN LATERAL (
	SELECT CASE
		WHEN e.status = 'VENCIDA'
			THEN "negocio"."data_corrente_da_operacao"() - c.data_vencimento
		ELSE 0
	END AS dias_atraso
) AS t
CROSS JOIN LATERAL (
	SELECT
		e.status,
		t.dias_atraso,
		COALESCE(c.multa_aplicada, CASE
			WHEN e.status = 'VENCIDA'
				THEN round(c.valor_original * COALESCE(m.multa_percentual, 0) / 100, 2)
			ELSE 0.00
		END) AS valor_multa,
		COALESCE(c.juros_aplicados, CASE
			WHEN e.status = 'VENCIDA'
				THEN round(
					c.valor_original * (COALESCE(m.juros_percentual, 0) / 100) / 30 * t.dias_atraso,
					2
				)
			ELSE 0.00
		END) AS valor_juros
) AS d;--> statement-breakpoint

-- ===========================================================================
-- 5. O mecanismo de emissão da série declarada (ADR-0015 e ADR-0020)
-- ===========================================================================
--
-- **Cópia ESTRUTURAL das duas funções do contrato**, em `0008_seguranca_contrato.sql` §4 — e o
-- raciocínio por extenso mora lá, REFERENCIADO e não recopiado. Recopiá-lo criaria uma segunda
-- redação da mesma justificativa, e cópia de justificativa apodrece: o original é corrigido e a
-- cópia não. O que aquele bloco registra, e vale item a item aqui:
--
--   * **por que SEQUÊNCIA** — ela satisfaz as duas cláusulas da ADR-0015 que se excluem sob uma
--     linha de contador (furo aceito E número nunca reusado), porque `nextval` não participa do
--     desfazimento;
--   * **por que DUAS funções** — criar a sequência e consumi-la precisam cair em transações
--     diferentes, senão a criação abortada devolveria o número `1`;
--   * **por que nenhuma aceita `empresa_id` por parâmetro** — `SECURITY DEFINER` roda com os
--     direitos da dona, e aceitar a empresa por argumento daria à aplicação exatamente o poder que a
--     RLS lhe tira. A assinatura sem parâmetro de empresa é o que torna o pedido cruzado
--     **irrepresentável**, e é isso que o CT-535 afirma por introspecção do catálogo;
--   * **por que o SQL dinâmico é seguro por construção** — o ano é `integer` guardado por faixa, a
--     empresa vem do contexto **convertida para `uuid`** (o cast recusa o que não for UUID antes de
--     o nome ser composto), e `%I` ainda cita o identificador resultante;
--   * **por que `SET search_path = pg_catalog, pg_temp`, com o temporário em ÚLTIMO** — nenhum
--     objeto criado por quem chama pode sequestrar um nome que a função resolve.
--
-- O que é PRÓPRIO desta série, e por isso está escrito aqui:
--
--   * o nome da sequência é `negocio.cobranca_{ano}_{32 hexadecimais}` — 46 caracteres (`cobranca_`
--     + 4 do ano + `_` + 32 da empresa sem hífens), dentro do limite de 63 do identificador. Um nome
--     truncado faria dois escopos partilharem a mesma sequência em silêncio;
--   * o código é `COB-{ano}-{7 dígitos}`, e a largura SETE diverge da largura cinco do contrato de
--     propósito — é o valor medido no sistema antigo, e o marcador `DECISÃO FECHADA` de
--     `packages/contracts/src/cobranca.ts` é quem o protege;
--   * **o ano do escopo é o da EMISSÃO, não o da competência.** Um contrato de treze meses atravessa
--     a virada do ano, e derivar o escopo da competência exigiria garantir dois contadores por
--     ativação. O sistema antigo também nomeia pelo instante da criação (`COB-.YYYY.-.#######`), de
--     modo que a escolha reproduz o oráculo em vez de divergir dele.

CREATE FUNCTION "negocio"."garantir_contador_de_cobranca"(p_ano integer, p_inicio bigint DEFAULT 1)
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

	-- A faixa do ano e o piso da série são guardas IRMÃS, e existem pela mesma razão que a `0008` §4
	-- registra: os dois parâmetros compõem o código legível `COB-{ano}-{7 dígitos}`, e valor fora de
	-- faixa em qualquer um deles produz código fora do formato publicado — que o marcador
	-- `DECISÃO FECHADA` de `packages/contracts/src/cobranca.ts` fixa.
	--
	-- O `IS NULL` do ano não é zelo: esta função NÃO é `STRICT`, de modo que `garantir_…(NULL)`
	-- correria o corpo, e `format('cobranca_%s_%s', NULL, …)` rende CADEIA VAZIA no lugar do ano —
	-- criando `cobranca__<32 hexadecimais>`, um contador de escopo INDETERMINADO, permanente e
	-- invisível a toda a rede de verificação: a guarda de cobertura de `packages/db/src/catalogo.ts`
	-- exclui sequências por espécie (`relkind`), e o `verificar-migracao.sh` deliberadamente não as
	-- lista.
	--
	-- A faixa 2000–2999 é a MESMA da série do contrato, e a igualdade é deliberada: duas séries com
	-- faixas diferentes seriam duas regras a lembrar, e a diferença não teria fato que a sustentasse.
	-- Ela é folgada para a semeadura da virada (F7) e para o produto inteiro.
	IF p_ano IS NULL OR p_ano < 2000 OR p_ano > 2999 THEN
		RAISE EXCEPTION 'ano do contador fora da faixa admitida: %', p_ano;
	END IF;

	IF p_inicio < 1 THEN
		RAISE EXCEPTION 'valor inicial do contador deve ser positivo';
	END IF;

	v_qualificado := format('negocio.%I', format('cobranca_%s_%s', p_ano, replace(v_empresa::text, '-', '')));

	-- A saída rápida existe pelo RUÍDO, não pelo custo, e define a PRECONDIÇÃO da semeadura da
	-- virada (F7) — as duas coisas estão escritas por extenso na `0008` §4, e valem sem alteração
	-- aqui: `garantir_…` é idempotente por contrato, `p_inicio` é ignorado quando o contador já
	-- existe, e semear exige escopo virgem.
	--
	-- O volume torna o ruído MAIOR nesta série do que na do contrato: a ativação de um contrato de
	-- doze meses emite doze cobranças, e sem esta saída cada uma acima da primeira imprimiria
	-- `NOTICE: relation … already exists, skipping` fora do registrador estruturado.
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

CREATE FUNCTION "negocio"."proximo_numero_de_cobranca"(p_ano integer)
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
	-- `proximo_numero_de_cobranca(NULL)` consumiria sem reclamar exatamente o contador de escopo
	-- indeterminado que a irmã guardada não cria mais. É o que o passo 4 do CT-535 afirma nas DUAS.
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
			format('cobranca_%s_%s', p_ano, replace(v_empresa::text, '-', ''))
		)::regclass
	);
END;
$$;--> statement-breakpoint

-- ===========================================================================
-- 6. Privilégio das funções da série — `EXECUTE`, e SÓ ele
-- ===========================================================================
--
-- O PostgreSQL concede `EXECUTE` a `PUBLIC` por omissão em toda função nova, e `PUBLIC` alcança
-- TODO papel do agrupamento, presente e futuro. Sem o `REVOKE`, qualquer papel que conseguisse
-- conectar avançaria o contador da empresa cujo contexto estivesse fixado. O `REVOKE` vem ANTES do
-- `GRANT` de propósito: invertido, ele apagaria a concessão nominal que acabou de ser feita.
--
-- A assinatura é escrita por extenso (com os tipos dos parâmetros) porque é ela que identifica a
-- função — o nome sozinho é ambíguo para o `REVOKE`/`GRANT` quando houver sobrecarga.
--
-- `data_corrente_da_operacao()` NÃO entra aqui, e a ausência é a decisão: ela não é
-- `SECURITY DEFINER`, roda com os direitos de quem chama e não devolve nada que o chamador já não
-- possa obter de `now()`. Revogá-la de `PUBLIC` custaria uma concessão a manter sem fechar risco
-- algum — e quebraria a leitura da visão para todo papel que viesse a ser criado depois.
REVOKE ALL ON FUNCTION "negocio"."garantir_contador_de_cobranca"(integer, bigint) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "negocio"."proximo_numero_de_cobranca"(integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."garantir_contador_de_cobranca"(integer, bigint) TO "sysloc_app";--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "negocio"."proximo_numero_de_cobranca"(integer) TO "sysloc_app";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- E o que NÃO se concede: `USAGE ON SEQUENCES`
-- ---------------------------------------------------------------------------
--
-- DECISÃO FECHADA — F3/T3 · 2026-08-10
-- O QUÊ: `sysloc_app` recebe `EXECUTE` sobre as duas funções da série da COBRANÇA e **nada** sobre
--        a sequência do contador — nem `USAGE`, nem `SELECT`, nem `UPDATE`, nem por
--        `ALTER DEFAULT PRIVILEGES`.
-- POR QUÊ: é a mesma decisão que o `DECISÃO FECHADA — T3 · 2026-08-09` de
--          `0008_seguranca_contrato.sql` §5 registra por extenso para a série do contrato, e o
--          raciocínio dela é REFERENCIADO daqui em vez de recopiado. Em uma linha: conceder abriria
--          um SEGUNDO caminho para o número — um `nextval('negocio.cobranca_2026_<outra empresa>')`
--          direto —, pelo qual o escopo `(empresa, ano)` deixaria de ser imposto pela função, que é
--          justamente o que impede pedir o contador alheio.
-- REVERTER EXIGE: o mesmo que o `REVERTER EXIGE` daquele marcador — provar que existe consumidor
--                 legítimo do contador FORA das duas funções, e que ele não pode alcançar o contador
--                 de outra empresa.
--
-- A ausência é cobrada pelo CT-535, nos passos 7 e 8.
--
-- Nada precisa ser revogado aqui: o `ALTER DEFAULT PRIVILEGES` do `0001` declara apenas `ON TABLES`
-- e `ON TYPES`, e nem `GRANT ... ON ALL TABLES` nem aquele padrão alcançam sequência. As sequências
-- que a função criar nascem, portanto, sem privilégio algum para `sysloc_app` — por construção, e
-- não por revogação que alguém precise lembrar de escrever.
