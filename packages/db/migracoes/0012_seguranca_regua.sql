-- Segurança da régua de cobrança — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado do 0011
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro, que o
-- `0008_seguranca_contrato.sql` fez para o contrato e que o `0010_seguranca_cobranca.sql` fez para a
-- cobrança, pela mesma razão, que não envelheceu: o gerador de migração declara
-- `ENABLE ROW LEVEL SECURITY` (o `0011` o faz), mas **não emite `FORCE ROW LEVEL SECURITY`, política
-- alguma, função nem visão** — a consequência que a ADR-0009 registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura do `0011` sobrescreve
-- o que estiver lá, e um trecho autoral perdido em silêncio é a pior forma de perder isolamento.
-- Pela mesma razão, **nada aqui emenda a `0009` ou a `0010`** — elas descrevem schemas já aplicados.
-- ⚠️ A `0010` tem, além disso, uma `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20`, cujo gatilho
-- (a primeira aplicação a banco durável) **fecha em silêncio**: quem for tocá-la lê o marcador
-- primeiro. Esta fatia não a toca.
--
-- Sem descida (`down`): reverter isolamento por migração é operação de risco, e o caminho de volta
-- é restauração de backup (§7.3 da tech spec).
--
-- ---------------------------------------------------------------------------
-- O que este arquivo NÃO faz, e não é esquecimento
-- ---------------------------------------------------------------------------
--
--   * **não concede privilégio de TABELA** — o `ALTER DEFAULT PRIVILEGES FOR ROLE
--     "sysloc_migracao" IN SCHEMA "identidade", "negocio" … ON TABLES` do `0001_seguranca.sql` já
--     faz a concessão acompanhar a criação. As duas tabelas e os três tipos deste par de migrações
--     nascem daquele papel. Os `GRANT USAGE ON TYPE` do bloco 2 são a única concessão declarada de
--     novo, seguindo o precedente do `0001`, do `0008` e do `0010`;
--   * **não cria função, visão nem sequência** — a régua não tem série declarada (a chave exposta do
--     registro de envio é o UUID, ADR-0017), não deriva estado publicado que participe de seleção
--     (ADR-0023) e lê a hora corrente da operação pelo relógio do banco por consulta direta
--     (ADR-0026), sem objeto novo a criar. **Nenhum papel novo**: as duas tabelas ficam sob
--     `sysloc_app`, o mesmo dos dois processos — a alternativa (papel próprio sem RLS) é a que a
--     ADR-0008 rejeita por escrito;
--   * **não cria schema nem papel** — os dois vêm do provisionamento;
--   * **nenhum `ALTER ... OWNER`** — as tabelas nascem do papel de migração por consequência de ser
--     ele quem as cria.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas duas tabelas, e as políticas
-- ===========================================================================
--
-- `ENABLE` (no 0011) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez
-- de uma propriedade de com qual papel alguém conectou.
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`, a do `0006_seguranca_dominio.sql`, a do
-- `0008_seguranca_contrato.sql` e a do `0010_seguranca_cobranca.sql`. Ela não é reinventada aqui, e
-- o motivo é o mesmo que faz o CT-007 reler a migração do disco em vez de recompor a política no
-- teste: duas redações do mesmo isolamento são livres para divergir, e a divergência não faz barulho
-- — ela aparece como uma tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide
-- o que pode ser gravado, e as duas são a MESMA expressão: divergi-las abriria o caso "enxerga só o
-- seu, grava para o alheio". O segundo argumento `true` de `current_setting` devolve NULO quando a
-- variável não foi fixada, e `nullif(…, '')` trata a variável fixada em cadeia vazia — nos dois
-- casos a comparação vira `empresa_id = NULL`, que não casa linha nenhuma: **contexto ausente
-- resulta em vazio, nunca em dado alheio**. `FOR ALL` cobre os quatro verbos numa política só.
ALTER TABLE "negocio"."politica_de_aviso" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."envio_de_cobranca" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "politica_de_aviso_isolamento_empresa"
	ON "negocio"."politica_de_aviso"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "envio_de_cobranca_isolamento_empresa"
	ON "negocio"."envio_de_cobranca"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint

-- ===========================================================================
-- 2. Os três tipos enumerados novos
-- ===========================================================================
--
-- `USAGE` no tipo enumerado é exigido para gravar valor em coluna do tipo e para lê-la. O
-- `ALTER DEFAULT PRIVILEGES … GRANT USAGE ON TYPES` do `0001` já cobriria, porque os tipos são
-- criados por `sysloc_migracao`; a declaração explícita segue o precedente daquele arquivo, do
-- `0008` e do `0010`, que nomeiam os tipos um a um mesmo tendo o padrão. O parágrafo do bloco 3 da
-- `0008` registra a divergência com a `0006` (que decidiu ao contrário) e a razão de a linha valer a
-- pena — ela vale aqui pelos mesmos motivos.
--
-- Os três são declarados **um a um**, e não por um laço ou por `ALL TYPES IN SCHEMA`: é neste ponto
-- que se lê qual papel pode gravar em cada coluna enumerada, e uma forma coletiva alcançaria em
-- silêncio o tipo que uma fatia futura criasse para outro fim.
GRANT USAGE ON TYPE "negocio"."canal_de_aviso" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."caminho_do_aviso" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."desfecho_do_aviso" TO "sysloc_app";
