# Rule candidates — emissao-e-conciliacao/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Recusa de campo afirmada pelo path do campo

**Regra que isto sugere:** recusa de valor inválido em esquema publicado se afirma pelo `path` do próprio campo, nunca pelo booleano de insucesso nem pelo `path` da raiz.

**O que ela faria (simples):** o mesmo par de linhas — `success` falso seguido de `issues[0].path` igual ao campo — aparece em seis pontos dos arquivos desta task, sempre com o mesmo comentário explicando que a raiz não diz ao cliente que campo corrigir. A rule irmã `contrato-publicado.md` já fixa a forma da recusa por chave desconhecida (`code` mais `keys`), mas não a da recusa por valor inválido; escrevê-la evitaria que o próximo esquema publicado se contentasse com o booleano.

- Evidência: `expect(resultado.error?.issues[0]?.path).toEqual([campo])` repetido em seis casos do mesmo arquivo — `packages/contracts/test/esquemas.spec.ts:2566` — T1 / contratos publicados da cobrança bancária
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-16T17:20:00Z

---

## [repeated_fixture] Recurso canônico por esquema de saída

**Regra que isto sugere:** cada esquema de saída ganha uma constante `<RECURSO>_PUBLICADO` no topo do arquivo de teste, e os casos derivam dela por espalhamento em vez de redigitar o objeto.

**O que ela faria (simples):** os quatro recursos novos desta fatia seguem a mesma forma — objeto congelado no topo, casos variando um campo por espalhamento —, e cada um é consumido por dois ou mais casos. É a convenção que faz a tabela de saídas do CT-942 poder ser escrita por extenso sem cópia; escrevê-la evita que a próxima fatia monte o recurso dentro de cada caso e deixe as cópias divergirem.

- Evidência: `LOTE_PUBLICADO`, `CONFERENCIA_PUBLICADA`, `EVENTO_PUBLICADO` e `ITEM_DO_LOTE_PUBLICADO` declarados uma vez e derivados por espalhamento em 2 ou mais casos cada — `packages/contracts/test/esquemas.spec.ts:4170` — T1 / contratos publicados da cobrança bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-16T17:20:00Z

---

## [repeated_fixture] Âncora externa da expressão de política RLS

**Regra que isto sugere:** toda suíte que afirme a expressão de uma política de isolamento a lê de uma tabela-âncora **externa** à fatia, e os tipos de leitura do catálogo vivem num acessório compartilhado.

**O que ela faria (simples):** o bloco `TABELA_ANCORA = 'cobranca'` mais as interfaces `EstadoDeRls`, `PoliticaDoCatalogo` e `RestricaoDoCatalogo` foi recriado por inteiro no arquivo novo, ficando com duas cópias livres para divergir; com uma regra apontando um acessório único, a terceira fatia que precisar dele não recomeça a cópia nem arrisca endurecer uma e deixar a outra para trás.

- Evidência: `TABELA_ANCORA = 'cobranca'` e as interfaces de leitura do catálogo duplicadas verbatim em dois specs de `packages/db/test/` — `packages/db/test/isolamento-bancario.spec.ts:442` e `packages/db/test/coerencia-de-migracoes.spec.ts:891` — T2 / esquema e migrações da emissão e conciliação
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-16T20:05:00Z

---

## [repeated_assertion_shape] Leitura de RLS habilitada e forçada em pg_class

**Regra que isto sugere:** a consulta que lê `relrowsecurity` e `relforcerowsecurity` de `pg_class` sai de um acessório único, e a asserção compara sempre as **duas** colunas por igualdade de objeto.

**O que ela faria (simples):** a mesma consulta e a mesma forma de asserção já foram reescritas em quatro suítes, e o risco é uma cópia futura afirmar só `relrowsecurity` — que deixaria o dono da tabela passando por cima da política sem nada acusar; a regra fixa que as duas colunas andam juntas e centraliza a consulta.

- Evidência: consulta `relrowsecurity`/`relforcerowsecurity` em `pg_class` reescrita em **quatro** arquivos de teste — `packages/db/test/isolamento-bancario.spec.ts:470`, `coerencia-de-migracoes.spec.ts:950`, `certificado-do-provedor.spec.ts:1290`, `isolamento.spec.ts:2431` — T2 / esquema e migrações da emissão e conciliação
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-16T20:05:00Z

---

## [convention_drift] FK simples de empresa em tabela tenantizada

**Regra que isto sugere:** tabela de negócio ganha FK simples para `identidade.empresa` **somente** quando nenhuma FK composta a implica de forma incondicional — isto é, quando a composta é `MATCH SIMPLE` sobre coluna anulável.

**O que ela faria (simples):** as quatro tabelas nascidas no mesmo diff divergem entre si — três declaram a FK simples para a empresa e uma não —, e os dois docblocks justificam a escolha citando precedentes do repositório que **se contradizem** quando aplicados às irmãs. O critério real existe e é preciso (a composta só vale quando nenhuma coluna referenciadora é nula), mas não está escrito, então cada tabela nova o redecide por imitação da vizinha mais próxima. A regra tornaria a decisão mecânica e removeria a redundância que hoje entra em migração **imutável**.

- Evidência: `evento_bancario`, `emissao_em_lote` e `conferencia_bancaria` declaram `.references(() => empresa.id)`; `item_da_emissao_em_lote` não, com racional que se aplicaria igualmente a `evento_bancario` — sweep em `.claude/rules/*` e `docs/adr/*` não encontra o critério escrito — `packages/db/src/esquema/negocio.ts:215,303,386,475` — T2 / esquema Drizzle e migrações 0017/0018
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-16T20:35:00Z

---

## [repeated_fixture] Cadeia de apoio para semear cobrança

**Regra que isto sugere:** a cadeia conjunto → imóvel → locador/locatário → contrato → cobrança tem um construtor único em `packages/db/test/banco-efemero.ts` a partir do **terceiro** consumidor.

**O que ela faria (simples):** a mesma cadeia de cinco relações obrigatórias foi montada à mão em dois arquivos de suíte, cada um com sua função `semearApoio`; uma regra apontando o construtor comum evitaria que o terceiro arranjo nasça com uma diferença silenciosa nas chaves obrigatórias.

- Evidência: função `semearApoio` reescrita em dois arquivos de suíte de `packages/db` — `packages/db/test/evento-bancario.spec.ts:316` e `packages/db/test/isolamento-bancario.spec.ts:344` — T3 / camada de dados da trilha bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-16T22:10:00Z

---

## [repeated_assertion_shape] Varredura afirmada por lista vazia

**Regra que isto sugere:** toda varredura de violações é afirmada **por igualdade contra `[]`**, acompanhada de **âncora antivácuo** do conjunto varrido.

**O que ela faria (simples):** o mesmo molde `expect(<lista de achados>).toEqual([])` aparece três vezes no arquivo, sempre precedido de algo que prova que o conjunto varrido não está vazio; escrever a regra impede que a próxima varredura nasça sem a âncora e passe **por não ter olhado nada**.

- Evidência: molde `expect(<varredura>).toEqual([])` em três asserções distintas — `packages/db/test/evento-bancario.spec.ts:506,597,605` — T3 / CT-939 (b) e (c)
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-16T22:10:00Z

---

## [repeated_fixture] Acessório tentar/Resultado redeclarado por suíte

**Regra que isto sugere:** o par `Resultado<T>` + `tentar()` tem casa única num acessório de `packages/db/test/`, e as suítes o importam em vez de redeclarar.

**O que ela faria (simples):** o mesmo par de tipo e função foi redigitado em **dez** suítes de `packages/db/test/`, a T4 acrescentando a décima; endurecer uma delas (capturar o `constraint_name`, distinguir erro do driver de erro do caso) deixa nove para trás — que é exatamente o que o limiar de três do `CLAUDE.md` existe para evitar.

- Evidência: `async function tentar<T>` declarado em 10 suítes — `packages/db/test/emissao-em-lote.spec.ts:340`, `evento-bancario.spec.ts:270`, `cobranca.spec.ts:2999`, `contrato.spec.ts:1241`, `isolamento-bancario.spec.ts:278` — T4 / porta de dados da emissão em lote
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17T01:10:00Z

---

## [repeated_assertion_shape] Recusa do banco asserida como sqlstate mais restrição

**Regra que isto sugere:** recusa vinda do PostgreSQL se afirma pelo par `<sqlstate> · <restrição>` numa **igualdade de texto**, nunca por booleano de insucesso.

**O que ela faria (simples):** a mesma forma aparece três vezes só nesta suíte e já existia em `evento-bancario.spec.ts`; escrita como regra, ela fixa o que hoje depende de cada autor lembrar — que um `23505` ou um `23514` **sozinho não diz qual restrição falou**, e que o ramo `ACEITO` é o que faz a asserção reprovar quando a escrita ilegítima passa.

- Evidência: `expect(desfechoDaTentativa(x)).toBe('<sqlstate> · <restrição>')` em 3 pontos (`emissao-em-lote.spec.ts:686,790,859`) mais a forma original em `evento-bancario.spec.ts:298` — T4 / recusas do índice parcial e das duas CHECK
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17T01:10:00Z

---

## [convention_drift] Escrita por id confere linha alcançada

**Regra que isto sugere:** porta de escrita por identificador que devolve `void` confere `resultado.count` e **levanta com nome** quando não alcança a linha.

**O que ela faria (simples):** a decisão de não deixar um `UPDATE` por `id` passar sem efeito existe **só no docblock de uma função** (`definirSituacaoDeLocacaoDoImovel`), e não em rule nem em ADR — por isso a porta nova do lote nasceu sem ela, e um lote pode ficar aberto para sempre sem que nada acuse. Escrita, a regra faria toda porta futura decidir isso na hora de escrever, em vez de na hora do gate.

- Evidência: duas escritas `UPDATE … WHERE id` novas devolvendo `void` sem observar `resultado.count` (`packages/db/src/emissao-em-lote.ts:599,619`), contra o precedente único do pacote que confere e levanta com nome (`packages/db/src/imovel.ts:801`) — T4 / porta de dados da emissão em lote
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-17T04:00:00Z

---

## [convention_drift] Mensagem de classe de erro composta internamente

**Regra que isto sugere:** classe de erro de domínio **compõe a própria mensagem** no construtor; parâmetro só para o **discriminante do fato**, nunca para o texto.

**O que ela faria (simples):** as **doze** classes de erro do repositório compõem o texto dentro do construtor, mas isso nunca foi escrito em lugar nenhum — e a décima terceira nasceu **recebendo a mensagem por parâmetro**, com dois pontos de chamada passando literais diferentes e livres para divergir. A regra manteria a mensagem com fonte única e empurraria o que varia para um discriminante tipado.

- Evidência: `constructor(loteId: string, mensagem: string)` repassando o texto ao `super` (`packages/db/src/emissao-em-lote.ts:300`), contra doze classes irmãs que compõem internamente (`emissao-em-lote.ts:262`, `imovel.ts:229`, `contrato.ts:342`) — T4 / camada de dados da emissão em lote
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-17T07:30:00Z

---

## [repeated_fixture] Comparação de superfície por diferenças de conjunto

**Regra que isto sugere:** a comparação por igualdade de conjunto usa um `diferencasDeConjunto` com **casa única por pacote**, e a terceira cópia dentro do mesmo pacote obriga a extração.

**O que ela faria (simples):** a mesma função foi reescrita em dois arquivos de teste de `packages/db/test/` (e existe uma terceira em `packages/auth/test/`), e **o próprio autor teve de escrever no docblock por que não a importou e quando o limiar de três dispara** — sinal de que a convenção existe mas não está escrita em lugar nenhum que o próximo autor leia.

- Evidência: `diferencasDeConjunto` redeclarada em 2 suítes de `packages/db/test/` mais 1 acessório em `packages/auth/test/conjuntos.ts` — `conferencia-bancaria.spec.ts:538`, `emissao-em-lote.spec.ts:600`, `packages/auth/test/conjuntos.ts:35` — T5 / camada de dados da conferência bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17T13:00:00Z

---

## [repeated_fixture] Posicionar datas contra o relógio do banco

**Regra que isto sugere:** toda data de teste que participe de **janela de negócio** nasce de um `dataDeslocada` que lê `negocio.data_corrente_da_operacao()`, **nunca** de `new Date()` do processo.

**O que ela faria (simples):** o mesmo acessório foi reescrito em duas suítes para posicionar datas contra o relógio do banco; sem a regra, a próxima suíte que precise de uma borda de dias tende a usar o relógio do **processo** e a passar (ou reprovar) **conforme o fuso de quem roda a suíte** — que é exatamente o que a ADR-0026 existe para impedir.

- Evidência: `dataDeslocada` reescrita com a mesma forma em duas suítes — `packages/db/test/conferencia-bancaria.spec.ts:671` e `packages/db/test/cobranca.spec.ts:2388` — T5 / arranjo das bordas de 29/30/31 dias
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17T13:00:00Z

---

## [repeated_assertion_shape] Instante comparado por forma, não por valor

**Regra que isto sugere:** carimbo gerado pelo banco entra na igualdade de corpo inteiro **reduzido a uma marca de forma**, e nunca comparado consigo mesmo nem deixado fora da igualdade.

**O que ela faria (simples):** o mesmo molde aparece **cinco** vezes no arquivo, sempre reduzindo os instantes a uma marca antes de comparar o corpo inteiro; escrita, a regra evita as duas saídas erradas que ela já previne aqui — comparar o instante **contra si mesmo** (tautologia) ou **deixá-lo fora** da igualdade, o que apagaria justamente o campo que distingue a linha em andamento da concluída.

- Evidência: `expect(retrato(...)).toEqual({ iniciadaEm: CARIMBO_DO_BANCO, ... })` em 5 pontos — `packages/db/test/conferencia-bancaria.spec.ts:965,992,1077,1163,1206` — T5 / conferência bancária
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17T13:00:00Z

---

## [convention_drift] Recusa de índice único parcial

**Regra que isto sugere:** a escrita governada por índice único parcial **escolhe o mecanismo pela natureza da recusa** — `ON CONFLICT <arbiter> DO NOTHING` quando ela é **desfecho legítimo**; captura discriminada por **nome de restrição** dentro de `SAVEPOINT` quando ela precisa chegar à borda como **erro de domínio**.

**O que ela faria (simples):** duas portas irmãs do mesmo pacote resolvem o mesmo problema de formas diferentes, e o critério que as separa está escrito **só na mais nova**; quem abrir a mais antiga primeiro copia a maquinaria pesada sem saber que há caminho mais barato quando a recusa não é erro. A regra escreveria o critério **uma vez, onde as duas o encontram**.

- Evidência: `tx.savepoint` + captura de `23505` discriminada por `constraint_name` (`packages/db/src/emissao-em-lote.ts:549,497`) contra `ON CONFLICT <arbiter> DO NOTHING` (`packages/db/src/conferencia-bancaria.ts:406,292`), para o **mesmo** desenho de índice `(empresa_id) WHERE <desfecho> IS NULL`. ⚠️ Varredura de `.claude/rules/*` e `docs/adr/` por *"ON CONFLICT"*, *"savepoint"* e *"índice único parcial"* **não retornou arquivo algum** — a convenção não está escrita. — T5 / porta de dados da conferência bancária
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-17T14:00:00Z

---

## [repeated_assertion_shape] Controle positivo obrigatório em varredura

**Regra que isto sugere:** toda varredura que decida veredito por lista vazia carrega, no mesmo caso, o controle positivo da MESMA função contra entrada sintética conhecida, afirmado por igualdade item a item.

**O que ela faria (simples):** o padrão `expect(<extrator>(<FONTE_DE_CONTROLE>)).toEqual([...])` imediatamente antes da asserção de ausência aparece nove vezes só neste arquivo, sempre com o mesmo formato e a mesma razão no comentário (AP-29). Hoje é redisciplina manual de quem escreve; uma regra o tornaria exigível, evitando a varredura que aprova tudo por nunca ter olhado.

- Evidência: padrão `controle positivo + toEqual(lista)` antes de cada asserção de ausência, 9 ocorrências — `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:595,641,669,679,785,815,844,869,898` — T7 / porta de cobrança e vocabulário canônico
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17

---

## [repeated_fixture] Objeto de controle dos termos do provedor

**Regra que isto sugere:** o objeto sintético que planta cada termo de `TERMOS_DO_PROVEDOR` como chave é construído num acessório único do arquivo, e não remontado inline por caso.

**O que ela faria (simples):** a mesma linha `Object.fromEntries(TERMOS_DO_PROVEDOR.map((termo) => [termo, true]))`, seguida da mesma asserção de igualdade, foi recriada em dois casos. Com duas cópias, endurecer uma deixa a outra para trás — é o gatilho do limiar de três que este repositório já pratica.

- Evidência: `objetoDeControle` remontado inline em dois casos — `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:667,842` — T7 / varredura do CT-834 e do CT-933
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17

---

## [repeated_assertion_shape] Varredura de ausência com controle positivo

**Regra que isto sugere:** prova de não-vazamento em forma canônica — o mesmo varredor aplicado a um controle com as agulhas plantadas, e as ausências afirmadas por igualdade com lista vazia.

**O que ela faria (simples):** o par — primeiro o controle devolvendo todas as agulhas por igualdade, depois o alvo devolvendo lista vazia — já se repete em três casos do mesmo arquivo e em dois outros que a rule de stack cita como forma canônica da ADR-0032. Cada autor a reescreve do zero, e a variante **sem** controle positivo é justamente a que aprova um produto vazando tudo (AP-29).

- Evidência: `ocorrenciasDe(controle…, agulhas, 'controle')).toEqual([...])` seguido de `ocorrenciasDe(alvo, agulhas, …)).toEqual([])` — `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:1306,1365,1533,1538` — T8 / CT-844, CT-863 e CT-943
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17

---

## [repeated_fixture] Empacotamento do segredo operável em teste

**Regra que isto sugere:** um construtor de teste único para o segredo operável, em vez de `criarSegredoOperavel({ material, senha })` reescrito em cada ponto de invocação.

**O que ela faria (simples):** a mesma linha aparece em dois helpers deste arquivo e em cinco pontos do arquivo irmão do mesmo pacote. Enquanto forem cópias, endurecer uma (acrescentar campo, mudar a forma do envelope) deixa as outras para trás — o que o limiar de três existe para antecipar.

- Evidência: `criarSegredoOperavel({ material, senha })` — `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:808,832` e `test/leitura-do-material.spec.ts:434` — T8 / helpers `pedidoDeEmissao` e `verificar`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17

---

## [repeated_fixture] Acessório de contexto de tenant em suíte

**Regra que isto sugere:** apontar um acessório único para abrir contexto de tenant e unidade de trabalho em suíte de integração, em vez de cada arquivo redeclarar o par.

**O que ela faria (simples):** toda suíte que toca o banco reescreve a mesma função de duas linhas combinando `contextoDeTenant.executarCom` com `acesso.emUnidadeDeTrabalho`, e a T10 acrescentou mais uma cópia. Uma regra apontando a casa única evitaria que endurecer uma delas — um timeout, uma checagem de contexto — deixasse as outras para trás.

- Evidência: o par `contextoDeTenant.executarCom` + `emUnidadeDeTrabalho` é redeclarado como acessório local em pelo menos **8** suítes de integração do monorepo, e o arquivo novo da T10 acrescentou a sua própria — `packages/cobranca-bancaria/test/emissao-em-lote.spec.ts:290` — T10 / percurso da emissão em lote, fatia `emissao-e-conciliacao` v1
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17T00:00:00Z

---

## [convention_drift] Marcador D28 em travessia de fronteira

**Regra que isto sugere:** `import` de `test/` que atravessa fronteira de pacote por caminho relativo carrega o marcador `DÉBITO COM GATILHO — D28` no ponto do import.

**O que ela faria (simples):** suítes alcançam acessórios de outro pacote por caminho de arquivo (`../../db/test/banco-efemero.ts`), e **31** arquivos de `apps/api/test/` marcam isso com o D28 enquanto cerca de **70** travessias não marcam nada — a prática existe mas não está escrita em rule nenhuma. Sem a regra, cada task decide sozinha, o inventário grepável do débito fica incompleto, e o mesmo diretório chega a afirmar **as duas leituras opostas**, como aconteceu aqui.

- Evidência: travessia de fronteira de pacote em `test/` por caminho relativo profundo, com o marcador D28 aplicado de forma inconsistente entre `apps/api/test` (31 arquivos **com**) e `apps/worker/test`, `packages/auth/test`, `packages/cobranca-bancaria/test` (**sem**) — `packages/cobranca-bancaria/test/emissao-em-lote.spec.ts:146` — T10 / percurso da emissão em lote
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-17T00:00:00Z

---

## [repeated_assertion_shape] Sequência de portas afirmada por igualdade de lista

**Regra que isto sugere:** a ordem de composição contra uma porta é afirmada por **igualdade de lista** sobre um coletor **agnóstico**, nunca por presença nem por contagem.

**O que ela faria (simples):** o mesmo molde aparece em oito asserções dos quatro casos da T11 — um acessório registra **toda** operação e **todo** efeito **sem filtrar por tipo**, e a asserção é `toEqual([...])` com a lista inteira. ⚠️ **A forma agnóstica do coletor é o que impede a igualdade de virar infalível** — foi um coletor que **filtrava por tipo** que derrubou a T9 desta mesma fatia. Escrever a convenção pouparia cada task de redescobrir por que o filtro tem de ficar **na asserção**, e não no acessório.

- Evidência: `toEqual` sobre `ambiente.operacoes` e `ambiente.efeitos` em 4 casos, com o coletor sem filtro declarado no cabeçalho — `packages/cobranca-bancaria/test/reemissao.spec.ts:394,423,490,527,575` — T11 / reemissão de boleto
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17T00:00:00Z

---

## [repeated_assertion_shape] Desfecho de apuração afirmado pelo objeto inteiro

**Regra que isto sugere:** o desfecho de um percurso de domínio é afirmado por **igualdade do objeto inteiro** — as quatro chaves de uma vez —, nunca campo a campo.

**O que ela faria (simples):** o mesmo formato aparece **nove vezes** no arquivo da T12, sempre comparando `desfecho` contra as quatro chaves juntas (`cobrancasConferidas`, `efeitos`, `interrompida`, `motivoDaInterrupcao`). Escrita como regra, ela impede a variante que afirma **só o campo que interessa ao caso** e deixa os outros três **livres para mudar sem ninguém decidir** — que é exatamente a contenção que a `ancoras-de-superficie.md` já proíbe para superfície publicada.

- Evidência: `expect(desfecho).toEqual({ cobrancasConferidas, efeitos, interrompida, motivoDaInterrupcao })` repetido em 9 pontos — `packages/cobranca-bancaria/test/conferencia.spec.ts:973,1044,1113,1236,1266,1330,1399,1457,1502` — T12 / apuração da conferência bancária
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17T00:00:00Z

---

## [repeated_fixture] Acessórios de arranjo das suítes E2E

**Regra que isto sugere:** os acessórios de arranjo E2E (`pedir`, `entrar`, `conceder`, `gerarMaterial`) vivem em **casa compartilhada**, e não recopiados por suíte.

**O que ela faria (simples):** esta suíte nasceu com a **25ª** cópia de `pedir` e a 3ª de `gerarMaterial`/`gerarAutoridadeDeTeste`. Endurecer um deles — um cabeçalho novo, um teto de tempo — hoje deixa **as outras 24 para trás**, e o `D63 · F4/fechamento` já aponta esse gatilho. Uma regra que nomeasse a casa evitaria a próxima cópia.

- Evidência: `pedir` reimplementado em `apps/api/test/boleto-da-cobranca.e2e.spec.ts:1503`, idêntico ao de `certificado-do-provedor.e2e.spec.ts:1720` — T13 / suíte E2E dos atos sobre o boleto
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-17T00:00:00Z

---

## [repeated_assertion_shape] Retrato da exigência por fatia publicada

**Regra que isto sugere:** toda fatia que publica **rota governada** acrescenta, **no mesmo diff**, um caso que afirma o **RETRATO da exigência** dela **por igualdade de objeto** — não apenas a presença do par no inventário.

**O que ela faria (simples):** ⚠️ **sete fatias seguidas escreveram o mesmo par de asserções** (presença do par **+** retrato do conteúdo, nos moldes CT-427/CT-533/CT-635/CT-732/CT-836), **e a oitava escreveu só a primeira metade** — deixando a chave de ação de **duas rotas que movem dinheiro** sem prova nenhuma. A repetição do molde mostra que ele **já é convenção de fato**; escrevê-la faria a metade que falta **deixar de depender de o autor lembrar**.

- Evidência: o molde `filter(par => LISTA.includes(par)) toEqual [...LISTA]` seguido de um retrato de conteúdo aparece em `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` para **sete** fatias (`:3626`, `:4075`); na oitava (`:3340`) **só a primeira metade foi escrita** — T13
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-17T00:00:00Z

---

## [repeated_fixture] Registro de certificado do provedor em suítes E2E

**Regra que isto sugere:** apontar uma **casa compartilhada** para o acessório que registra o certificado vigente da empresa **pela rota real**, consumida por toda suíte E2E que precise emitir boleto.

**O que ela faria (simples):** `registrarCertificadoDaEmpresa` foi copiado **palavra por palavra** da suíte do boleto para a do histórico — **o próprio docblock da cópia nova declara isso** —, e ele é **precondição de qualquer caso que emita**. Com duas cópias, endurecer uma (trocar a autoridade descartável, mudar o status esperado do registro) deixa a outra para trás; a regra evita a divergência **antes que a terceira cópia nasça**.

- Evidência: acessório idêntico em `apps/api/test/boleto-da-cobranca.e2e.spec.ts:1778` e `apps/api/test/historico-bancario.e2e.spec.ts:580`, com o docblock da segunda declarando *"É o mesmo acessório, palavra por palavra"* — T14
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_assertion_shape] Envelope de recusa 404 afirmado por objeto inteiro

**Regra que isto sugere:** fixar que a recusa `RECURSO_NAO_ENCONTRADO` é afirmada por **igualdade de objeto inteiro**, com `campo` incluído, e **nunca por presença de campos**.

**O que ela faria (simples):** a mesma forma aparece em **quatro casos de duas suítes**, sempre escrita à mão. Ela **está certa** — é o que a ADR-0017 pede e o que impede um `detalhes` inventado de passar —, mas hoje **cada autor a redescobre**; escrita como regra, o próximo caso **já nasce com a forma forte** em vez de cair num `toMatchObject` que **aprovaria campo a mais**.

- Evidência: `expect(resposta.corpo).toEqual({ codigo: CODIGO_DE_RECURSO_NAO_ENCONTRADO, mensagem: …, campo: 'codigo', … })` replicado em `boleto-da-cobranca.e2e.spec.ts:830,1632,1705` e `historico-bancario.e2e.spec.ts:533` — T14
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_fixture] Acessórios de arranjo das suítes E2E

**Regra que isto sugere:** os acessórios de arranjo das suítes E2E — o cliente HTTP `pedir` e a entrada de sessão `entrar` — vivem numa **casa compartilhada**, e não recopiados por suíte.

**O que ela faria (simples):** cada suíte E2E nova redigita as mesmas funções com a mesma assinatura; medido agora, são **29 e 26 cópias**. Endurecer uma — acrescentar um cabeçalho, tratar um redirecionamento, mudar o formato do cookie — deixa as outras 28 para trás, e **a divergência não aparece em lugar nenhum porque cada cópia tem a sua própria suíte verde**.

- Evidência: `pedir` idêntico em 29 suítes de `apps/api/test/` e `entrar` em 26 — a T15 acrescentou a 29ª e a 26ª. É o **`D63 · F4/fechamento`**, declarado disparado e **não fechado** — T15
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_assertion_shape] Envelope de erro afirmado por igualdade inteira

**Regra que isto sugere:** a recusa de uma rota é afirmada pelo **objeto INTEIRO** do envelope (`codigo`, `mensagem` e o discriminador), nunca campo a campo.

**O que ela faria (simples):** a mesma forma se repete a cada recusa medida, e **a razão é sempre a mesma e sempre reescrita à mão no comentário**: a igualdade inteira é o que pega o `detalhes` que apareceria com a **entrada recusada ecoada dentro**, e a conferência campo a campo não pega. Escrita como regra, ela pararia de depender de o autor lembrar de explicá-la de novo em cada caso.

⚠️ **Reforça o sinal homônimo emitido na T14** (*"Envelope de recusa 404 afirmado por objeto inteiro"*), agora com evidência de **outra task, outro código de erro e outro discriminador** — o que eleva o cluster de coincidência a padrão.

- Evidência: três recusas pela mesma forma no arquivo novo — 422/campo `competencia`, 422/campo `corpo`, 422/`detalhes.loteEmCurso` (`cobranca-bancaria.e2e.spec.ts:425,442,508`) — T15
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [convention_drift] Marcador de decisão com descrição envelhecida

**Regra que isto sugere:** procedimento para o marcador `DECISÃO FECHADA` cuja **descrição** envelhece sem que o código sob ele mude.

**O que ela faria (simples):** a rule antirregressão diz o que fazer quando alguém precisa **contrariar** um marcador (escalar), e a rule de workflow diz como **classificar** um registro vencido (BAIXO) — ⚠️ **mas nenhuma das duas diz o que fazer no caso que de fato apareceu**: o invariante segue valendo, o código sob o marcador **não foi tocado**, e só o aposto que o ilustra passou a descrever **menos** do que o marcador alcança. *"Sem regra, cada executor decide sozinho entre **editar** (que a §3.3 proíbe) e **deixar apodrecer**, e o marcador vai perdendo precisão a cada task que cresce o módulo."*

- Evidência: o campo `O QUÊ` enumera *"rejeição de `enfileirarConfirmacao` e linha dos **DOIS** ouvintes de `error`"* quando o módulo passou a ter **três** métodos de enfileiramento e **quatro** ouvintes — `apps/api/src/comum/produtor-de-fila.ts:173` — T15
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-18T00:00:00Z

---

## [repeated_fixture] Arranjo compartilhado das suítes de borda de fila

**Regra que isto sugere:** acessórios de arranjo de **borda de tarefa** (registrador descartável, certificado vigente cifrado, pessoa mínima, usuário da carga inicial) moram num acessório **compartilhado**, não em cópia por suíte.

**O que ela faria (simples):** as duas suítes novas do worker recriam quase o mesmo arranjo — `gravarCertificadoVigente`, `pessoaDe`, `exigirUsuarioDa`, `emUnidade`, `executarJob` e o registrador descartável são **praticamente idênticos** nos dois arquivos. ⚠️ *"Endurecer um deixa o outro para trás — **foi exatamente o que aconteceu aqui**, em que a decisão de descartar o registro precisaria ser revista nos dois lugares."*

- Evidência: os quatro acessórios duplicados entre `apps/worker/test/emissao-em-lote.spec.ts:677,439` e `conferencia-bancaria.spec.ts:711,412` — T16
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_assertion_shape] Retrato da instância efêmera antes do primeiro caso

**Regra que isto sugere:** a conferência de que a instância efêmera **não é a da operação** (ADR-0006) é um **acessório único** invocado no arranjo, e não três asserções copiadas por suíte.

**O que ela faria (simples):** o mesmo trio de asserções sobre a porta da fila efêmera aparece copiado no `beforeAll` das suítes que sobem fila. ⚠️ *"É uma **garantia de ADR replicada por cópia**: se a faixa mudar, algumas suítes acompanham e outras não."*

- Evidência: `not.toBe(PORTA_PADRAO_DA_FILA)` + `toBeGreaterThanOrEqual(...primeira)` + `toBeLessThanOrEqual(...ultima)` repetido em `emissao-em-lote.spec.ts:222` e `conferencia-bancaria.spec.ts:185` — T16
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_fixture] Acessórios de arranjo E2E replicados por suíte

**Regra que isto sugere:** os acessórios de arranjo das suítes E2E de `apps/api/test/` (cliente HTTP `pedir`, entrada `entrar`, `criarPor`, `corpoDeImovel`, `corpoDePessoa`, `proximo`) vivem numa casa compartilhada, e não em cópia por arquivo.

**O que ela faria (simples):** o arquivo criado na T17 nasceu com a quinta cópia do mesmo bloco de acessórios que outras quatro suítes já carregam quase palavra por palavra; endurecer um deles — acrescentar um cabeçalho ao cliente HTTP, corrigir a extração do cookie — deixa os outros quatro para trás, e a divergência não aparece em teste nenhum. Uma regra apontando a casa compartilhada faria a próxima suíte importar em vez de copiar.

- Evidência: `pedir`, `entrar`, `criarPor`, `corpoDeImovel`, `corpoDePessoa` e `proximo` replicados quase literalmente em 4 suítes de `apps/api/test/`, e a T17 acrescentou a mais recente (`apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:1027`, `recusa-indistinguivel.e2e.spec.ts:1091`, `autorizacao-do-dominio.e2e.spec.ts:3213`, `contrato-publicado.e2e.spec.ts:1560`). O `DÉBITO COM GATILHO — D63 · F4/fechamento` já mede o eixo do acessório de arranjo (`pedir` em 24 de 24 suítes), mas o gatilho dele nomeia só a próxima suíte E2E, não a convenção — T17 / fecho da fatia `emissao-e-conciliacao`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [repeated_assertion_shape] Âncora de tabela não truncada antes de percorrer

**Regra que isto sugere:** todo caso que percorre uma tabela de rotas ou de canais afirma o tamanho dela por igualdade contra uma constante nomeada **antes** do laço.

**O que ela faria (simples):** quatro casos da T17 abrem com a mesma forma — afirmar que a tabela tem exatamente N entradas antes de iterar — e cada um reescreve a justificativa por extenso no comentário, porque a convenção não está escrita em lugar nenhum. Uma regra a nomearia de uma vez, e o próximo caso que esquecer a âncora ficaria visível na revisão em vez de passar sobre uma tabela truncada.

- Evidência: a forma `expect(<tabela>.length).toBe(<CONSTANTE>)` imediatamente antes do laço, com comentário justificando o modo de falha da lista truncada, repetida em 4 casos de 4 arquivos distintos do diff (`cobertura-de-autorizacao.e2e.spec.ts:4892`, `autorizacao-do-dominio.e2e.spec.ts:1761`, `recusa-indistinguivel.e2e.spec.ts:849`, `vocabulario-na-saida-real.e2e.spec.ts:578`) — T17 / CT-937, CT-941, CT-926 e CT-934
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-18T00:00:00Z

---

## [convention_drift] Marcador de débito deferido pelo dono nomeado

**Regra que isto sugere:** task que se torna o dono nomeado no `QUANDO FECHA` de um `DÉBITO COM GATILHO` e opta por deferir precisa re-baselinar o marcador — fatos e novo dono — no mesmo diff.

**O que ela faria (simples):** a §3-B da `nao-regressao.md` diz o que fazer quando o débito é FECHADO (o marcador sai junto), mas não diz nada sobre o caso oposto e mais comum: o gatilho dispara, a task vira a dona nomeada, e ela decide deferir. Sem a regra, o marcador continua declarando fatos que a própria task acabou de tornar falsos — aqui, "esta é a TERCEIRA cópia" depois de a quarta nascer —, e o próximo agente lê um estado que não existe mais. A regra garantiria que deferir custa uma correção de duas linhas no marcador, em vez de custar uma rodada de diagnóstico três fatias adiante.

- Evidência: o marcador `DÉBITO COM GATILHO — D57 · F3/T12` declarava "a TERCEIRA cópia literal" e nomeava como dono "quem abrir a PRÓXIMA suíte instrumentada"; a T17 abriu essa suíte, criou a quarta cópia e não atualizou nem a contagem nem o dono (`apps/api/test/autorizacao-do-dominio.e2e.spec.ts:767` e `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:82`) — T17 / fecho da fatia `emissao-e-conciliacao`, montagem instrumentada de suíte e2e
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-18T00:00:00Z

---
