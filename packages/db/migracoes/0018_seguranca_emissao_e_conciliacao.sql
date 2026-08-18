-- Segurança da emissão e da conciliação — ESCRITA À MÃO, e não gerada.
--
-- ---------------------------------------------------------------------------
-- Por que este arquivo existe separado da `0017`
-- ---------------------------------------------------------------------------
--
-- É a mesma separação que o `0001_seguranca.sql` fez para as duas tabelas da F1, que o
-- `0006_seguranca_dominio.sql` fez para as seis entidades de cadastro, que o
-- `0008_seguranca_contrato.sql` fez para o contrato, que o `0010_seguranca_cobranca.sql` fez para a
-- cobrança, que o `0012_seguranca_regua.sql` fez para a régua, que o `0014_seguranca_confirmacao.sql`
-- fez para o portador e que o `0016_seguranca_bancaria.sql` fez para o certificado, pela mesma razão,
-- que não envelheceu: o gerador de migração declara `ENABLE ROW LEVEL SECURITY` (a `0017` o faz),
-- mas **não emite `FORCE ROW LEVEL SECURITY`, política alguma nem concessão de tipo** — a
-- consequência que a ADR-0009 registra entre os Neutros.
--
-- As duas primeiras ausências são exatamente as que fariam o isolamento existir só no papel:
--
--   * sem `FORCE`, o DONO das tabelas ignora a política (ADR-0008, Cons). A suíte que conectasse
--     com ele ficaria verde sem provar nada;
--   * sem política, `ENABLE` sozinho faz o PostgreSQL negar TUDO para quem não é dono — a aplicação
--     não leria uma linha sequer.
--
-- **Gerado e autoral nunca convivem no mesmo arquivo**: uma regeração futura da `0017` sobrescreve o
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
--   * **não cria schema.** `identidade`, `negocio` e `plataforma` nascem do provisionamento, e a
--     guarda é executável: `verificar-migracao.sh`, asserção `(e)`, exige **zero** `CREATE SCHEMA` em
--     código nos arquivos de migração, com o mutante ao lado provando que a varredura acusa;
--   * **não cria tabela.** As quatro são da `0017`, e escrevê-las aqui seria a mistura que o
--     cabeçalho acima proíbe;
--   * **não cria os dois índices únicos parciais.** `emissao_em_lote_em_andamento_uidx` e
--     `conferencia_bancaria_em_andamento_uidx` são declaráveis no Drizzle e saem da `0017` gerada,
--     pelo precedente literal de `contrato_imovel_vigente_uidx` na `0007` e de
--     `certificado_do_provedor_vigente_uidx` na `0015`. Escrevê-los aqui criaria uma SEGUNDA
--     declaração do mesmo índice, ausente do schema declarado, e a regeração seguinte proporia
--     criá-los de novo;
--   * **não concede privilégio de TABELA** — o `ALTER DEFAULT PRIVILEGES FOR ROLE "sysloc_migracao"
--     IN SCHEMA "identidade", "negocio" … ON TABLES` do `0001_seguranca.sql` já faz a concessão
--     acompanhar a criação. As quatro tabelas e os três tipos deste par de migrações nascem daquele
--     papel e naquele schema; os `GRANT USAGE ON TYPE` do bloco 2 são a única concessão declarada
--     aqui, pelo mesmo precedente da `0012`;
--   * **não cria papel, sequência nem função.** O contador desta fatia já existe: é a sequência de
--     `plataforma` que a `0016` criou, avançada pela função `SECURITY DEFINER` **sem parâmetro** que
--     ela declara sob `DECISÃO FECHADA` (ADR-0033). Nada aqui a duplica nem a reabre;
--   * **não cria tipo enumerado nem visão** — os três tipos são da `0017` gerada (o quarto arranjo
--     publicado pela T1, `ESTADOS_DA_EMISSAO_EM_LOTE`, não vira tipo em lugar nenhum: o estado do
--     lote é derivado dos dois instantes de desfecho, ADR-0022), e nenhuma destas quatro tabelas
--     deriva estado publicado que participe de seleção (ADR-0023).
--
-- ⚠️ **Nenhuma tabela desta fatia vai para `plataforma`.** As quatro têm dono-empresa e por isso
-- pertencem a `negocio` (ADR-0031, pela contrapositiva); o roster enumerado de `plataforma` não
-- cresce, e quem o afirma é `conferirAdmissaoDePlataforma`.
--
-- Aplicada por `deploy/scripts/instalacao/migrar-banco.sh` em operação e por
-- `packages/db/test/banco-efemero.ts` na verificação — os dois lendo este mesmo arquivo.

-- ===========================================================================
-- 1. RLS forçada nas quatro tabelas novas, e as quatro políticas
-- ===========================================================================
--
-- `ENABLE` (na `0017`) faz a política ser consultada para quem não é dono; `FORCE` a faz ser
-- consultada TAMBÉM para o dono. É `FORCE` que torna o isolamento uma propriedade do banco em vez de
-- uma propriedade de com qual papel alguém conectou.
--
-- A expressão é, literalmente, a do `0001_seguranca.sql`, a do `0006_seguranca_dominio.sql`, a do
-- `0008_seguranca_contrato.sql`, a do `0010_seguranca_cobranca.sql`, a do `0012_seguranca_regua.sql`,
-- a do `0014_seguranca_confirmacao.sql` e a do `0016_seguranca_bancaria.sql`. Ela não é reinventada
-- aqui, e o motivo é o mesmo que faz o CT-007 reler a migração do disco em vez de recompor a
-- política no teste: duas redações do mesmo isolamento são livres para divergir, e a divergência não
-- faz barulho — ela aparece como uma tabela que enxerga o que não devia.
--
-- `USING` decide o que a linha existente deixa ser vista, atualizada e apagada; `WITH CHECK` decide o
-- que pode ser gravado, e as duas são a MESMA expressão: divergi-las abriria o caso "enxerga só o
-- seu, grava para o alheio". O segundo argumento `true` de `current_setting` devolve NULO quando a
-- variável não foi fixada, e `nullif(…, '')` trata a variável fixada em cadeia vazia — nos dois casos
-- a comparação vira `empresa_id = NULL`, que não casa linha nenhuma: **contexto ausente resulta em
-- vazio, nunca em dado alheio**. `FOR ALL` cobre os quatro verbos numa política só.
--
-- ⚠️ Aqui não há exceção nominal alguma, e a ausência é a decisão: diferente do portador da `0014`,
-- **nada neste domínio é lido sem contexto de empresa**. Quem emite, interrompe e confere é sempre
-- alguém com sessão da própria empresa (ADR-0027 não o alcança); e o disparo pelo relógio que a F5
-- prevê corre com o contexto fixado pelo próprio processo, não sem ele — é por isso que
-- `conferencia_bancaria.solicitada_por` é anulável **e** a política continua comparando `empresa_id`.
-- A notificação recebida do provedor, que chega sem sessão, é da fatia (iii) e não escreve nestas
-- tabelas por caminho nenhum declarado aqui.
ALTER TABLE "negocio"."evento_bancario" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."emissao_em_lote" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."item_da_emissao_em_lote" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "negocio"."conferencia_bancaria" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evento_bancario_isolamento_empresa"
	ON "negocio"."evento_bancario"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "emissao_em_lote_isolamento_empresa"
	ON "negocio"."emissao_em_lote"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "item_da_emissao_em_lote_isolamento_empresa"
	ON "negocio"."item_da_emissao_em_lote"
	FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "conferencia_bancaria_isolamento_empresa"
	ON "negocio"."conferencia_bancaria"
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
-- `0008`, do `0010` e do `0012`, que nomeiam os tipos um a um mesmo tendo o padrão.
--
-- Os três são declarados **um a um**, e não por um laço ou por `ALL TYPES IN SCHEMA`: é neste ponto
-- que se lê qual papel pode gravar em cada coluna enumerada, e uma forma coletiva alcançaria em
-- silêncio o tipo que uma fatia futura criasse para outro fim.
GRANT USAGE ON TYPE "negocio"."tipo_de_evento_bancario" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."origem_do_evento_bancario" TO "sysloc_app";--> statement-breakpoint
GRANT USAGE ON TYPE "negocio"."desfecho_do_item_do_lote" TO "sysloc_app";
