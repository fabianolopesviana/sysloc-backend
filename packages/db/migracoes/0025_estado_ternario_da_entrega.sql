-- O TERCEIRO ESTADO da entrega da notícia, e a referência ao cadastro no provedor — arquivo
-- AUTORAL, e a autoria é a decisão.
--
-- ⚠️ **Autoral e gerado nunca convivem**, e por isso esta migração NÃO saiu de `drizzle-kit
-- generate`: ela **reescreve** uma `CHECK` que a `0023` criou, e o gerador não emite
-- `DROP CONSTRAINT` seguido de `ADD CONSTRAINT` com o texto novo — ele emitiria a tabela inteira.
-- O esquema em `src/esquema/negocio.ts` acompanha, e é ele que uma regeração futura consulta.
--
-- ⚠️ **A `0023` e a `0024` NÃO são tocadas.** Elas já foram aplicadas, o verificador de migração
-- confere cada arquivo por `sha256sum` e **aborta a instalação** em divergência. Toda mudança de
-- estrutura desta tabela vive aqui.
--
-- ===========================================================================
-- POR QUE UM TERCEIRO ESTADO, e por que um booleano não bastava
-- ===========================================================================
--
-- A documentação oficial do provedor declara, por escrito, que **três** atos corretivos levam o
-- webhook à mesma situação — `1 - Aguardando validação`: cadastrar um novo, alterar a URL de um
-- existente e reativar um inativado. A validação do endereço é o aperto de mão que o provedor faz
-- **contra a URL cadastrada**, e é assíncrona por construção: no instante em que o cadastro é
-- aceito, ela ainda não aconteceu.
--
-- Com um booleano, esse estado só podia ser dito de duas formas, e **as duas são falsas**:
--
--   * como `habilitada = true` — falso positivo: a entrega ainda não entrega nada;
--   * como `habilitada = false` — falso negativo em **toda ativação nova**: o Admin clica, o
--     cadastro é criado com sucesso no provedor, e a tela diz que falhou.
--
-- É por isso que exigir *"registro validado"* na consulta **não podia** ser feito antes desta
-- migração: sozinha, aquela correção trocaria um falso positivo por um falso negativo universal.
--
-- ===========================================================================
-- `habilitada` PERMANECE, e a `CHECK` a amarra a `situacao`
-- ===========================================================================
--
-- Ela não é redundância nem legado tolerado: é a coluna que o contrato publicado carrega, e o
-- consumidor dele continua lendo o booleano que sempre leu. O que a `0025` acrescenta é a garantia,
-- **imposta pelo banco**, de que ela nunca discorda da situação — `habilitada = (situacao =
-- 'HABILITADA')`. Sem a amarra, o produto passaria a ter duas fontes de verdade para o mesmo fato,
-- livres para divergir na primeira escrita que esquecesse uma delas.
--
-- ===========================================================================
-- POR QUE A `CHECK` DE COERÊNCIA MUDA DE EIXO
-- ===========================================================================
--
-- A da `0023` exigia motivo sempre que a entrega **não estivesse habilitada** e já tivesse sido
-- verificada. Uma entrega *em validação* satisfaz as duas condições e **não tem motivo** — ninguém
-- recusou nada —, de modo que o terceiro estado era literalmente irrepresentável sob aquela
-- restrição. O eixo passa de `habilitada` para `situacao = 'DESABILITADA'`, e o que a cláusula
-- torna irrepresentável continua sendo o mesmo: desabilitação verificada **sem** causa registrada.
--
-- ===========================================================================
-- A REFERÊNCIA AO CADASTRO — por que ela é persistida, contra a recomendação anterior
-- ===========================================================================
--
-- A análise que originou este trabalho recomendou **não** persistir o identificador do cadastro,
-- com o argumento de que a consulta o devolve e ele poderia viver o tempo do ato. O argumento
-- **não se sustenta para o caso que importa**, e a razão é concreta:
--
-- O produto **não pode tocar cadastro de terceiro** — é cláusula da porta, e ela é real: alterar ou
-- reativar o webhook de outro sistema é interferência na conta do cliente. Logo, para corrigir o
-- endereço de um cadastro, é preciso **provar que ele é nosso**. A URL sozinha não prova: um
-- cadastro com URL diferente da atual é indistinguível entre *"o meu, com o endereço antigo"* e
-- *"o de outro sistema"*. Sem a referência, o primeiro caso fica **sem conserto pela tela** — o
-- cadastro ocupa a vaga, o cadastro novo é recusado, a consulta não confirma, e o Admin clica em
-- ativar para sempre.
--
-- Ela é **opaca**: nada no produto a interpreta, compara ou decide por ela. Responde uma pergunta
-- só — *"a vaga é ocupada por um cadastro que eu criei?"* — e é essa resposta que autoriza a
-- correção sem tocar o que não é nosso.

ALTER TABLE "negocio"."entrega_da_noticia"
	ADD COLUMN "situacao" text;--> statement-breakpoint

-- O preenchimento das linhas existentes é DERIVADO, e não arbitrado: antes desta migração o único
-- estado representável era o par (habilitada, desabilitada), e é exatamente ele que se preserva.
-- Nenhuma linha existente vira `EM_VALIDACAO` — esse estado só nasce de um ato posterior a esta
-- migração, e inventá-lo aqui afirmaria sobre o provedor algo que ninguém mediu.
UPDATE "negocio"."entrega_da_noticia"
   SET "situacao" = CASE WHEN "habilitada" THEN 'HABILITADA' ELSE 'DESABILITADA' END;--> statement-breakpoint

ALTER TABLE "negocio"."entrega_da_noticia"
	ALTER COLUMN "situacao" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "negocio"."entrega_da_noticia"
	ADD COLUMN "referencia_no_provedor" text;--> statement-breakpoint

-- A reescrita da coerência: o eixo do motivo deixa de ser `habilitada` e passa a ser a situação.
ALTER TABLE "negocio"."entrega_da_noticia"
	DROP CONSTRAINT "entrega_da_noticia_coerencia_chk";--> statement-breakpoint

ALTER TABLE "negocio"."entrega_da_noticia"
	ADD CONSTRAINT "entrega_da_noticia_coerencia_chk" CHECK (("negocio"."entrega_da_noticia"."situacao" = 'DESABILITADA' OR "negocio"."entrega_da_noticia"."verificada_em" IS NOT NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_codigo" IS NOT NULL) = ("negocio"."entrega_da_noticia"."situacao" = 'DESABILITADA' AND "negocio"."entrega_da_noticia"."verificada_em" IS NOT NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_mensagem" IS NULL) = ("negocio"."entrega_da_noticia"."motivo_codigo" IS NULL)
            AND ("negocio"."entrega_da_noticia"."motivo_diagnostico" IS NULL OR "negocio"."entrega_da_noticia"."motivo_codigo" IS NOT NULL));--> statement-breakpoint

-- O domínio da situação, e a amarra que impede `habilitada` de discordar dela.
ALTER TABLE "negocio"."entrega_da_noticia"
	ADD CONSTRAINT "entrega_da_noticia_situacao_chk" CHECK ("negocio"."entrega_da_noticia"."situacao" IN ('HABILITADA', 'EM_VALIDACAO', 'DESABILITADA')
            AND "negocio"."entrega_da_noticia"."habilitada" = ("negocio"."entrega_da_noticia"."situacao" = 'HABILITADA'));
