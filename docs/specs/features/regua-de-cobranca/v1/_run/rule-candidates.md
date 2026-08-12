# Rule candidates — regua-de-cobranca/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Medição em bloco chave=valor antes das asserções

**Regra que isto sugere:** verificador shell que confere várias propriedades do mesmo artefato mede uma vez para um bloco `chave=valor` e afirma campo a campo, em vez de recalcular por asserção.

**O que ela faria (simples):** três casos do mesmo diretório já convergiram sozinhos para essa forma — um `medir_*` que imprime pares `chave=valor` e um extrator de campo que alimenta cada `afirmar_igual`. Uma regra apontando a forma pouparia o próximo autor de reinventá-la e, principalmente, preservaria a propriedade que a torna correta: a asserção fica isolada numa função e pode ser reaplicada **literalmente** ao mutante da prova de falsificação, em vez de reescrita — que é o defeito que já aprovou 5/5 um SUT com o defeito de volta neste repositório.

- Evidência: `medir_regua` (`deploy/scripts/caracterizacao/verificar-golden.sh:150`), `medir_producao` (`deploy/scripts/caracterizacao/verificar-captura.sh:1213`) e `medir_fonte_do_pdf` (`deploy/scripts/caracterizacao/verificar-golden.sh:1340`) repetem a mesma forma; a `testing-stack.md` documenta o vocabulário `caso`/`ok`/`afirmar_igual` mas não esta forma — T1 / régua de cobrança v1
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T12:00:00Z

---

## [repeated_assertion_shape] Recusa por chave desconhecida assere code e keys

**Regra que isto sugere:** asserção de recusa por chave desconhecida no pacote de contratos confere `issues[0].code === 'unrecognized_keys'` e a chave ofensora em `keys`, nunca em `path`.

**O que ela faria (simples):** o `path` de `unrecognized_keys` no zod 4 é a raiz do objeto (`[]`) e o nome da chave culpada viaja em `keys` — quem espera o nome no `path` escreve uma asserção que não passa. Foi exatamente esse o engano do card do CT-605 desta task, corrigido só por medição durante a execução e reconfirmado independentemente pelo QA; uma regra escrita evitaria que o próximo card o repita.

- Evidência: a mesma forma de asserção (`code === 'unrecognized_keys'` + `toMatchObject({ keys: [...] })`) aparece em 7 pontos de `packages/contracts/test/esquemas.spec.ts` (linhas 790, 808, 1125, 1573, 1873, 2463, 2640), atravessando três fatias — T2 / régua de cobrança
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T16:30:00Z

---

## [convention_drift] Assimetria entrada fechada saída aberta

**Regra que isto sugere:** esquema de **entrada** é `z.strictObject` e esquema de **saída** é `z.object`, sem exceção, e a assimetria tem barreira executável nas **duas** pontas.

**O que ela faria (simples):** a regra mais carregada do pacote de contratos — entrada fechada, saída aberta — não está escrita em nenhuma rule nem em nenhuma ADR: ela vive só em docblocks e num marcador `DECISÃO FECHADA` dentro do código. O efeito medido foi o card da T2 **inventar** uma varredura `ESQUEMAS_DE_SAIDA` que nunca existiu para provar o lado da saída, porque quem escreveu a spec presumiu simetria com a varredura de entrada, que é real. Escrita como rule, ela chegaria a todo executor e a todo gate antes de qualquer arquivo, e a lacuna de barreira do lado da saída ficaria **visível** em vez de ser presumida fechada.

- Evidência: `grep -rln 'strictObject|saída aberta|entrada fechada|additionalProperties' .claude/rules/ docs/adr/` devolve **vazio**. A convenção só existe em prosa de código — cabeçalho de `configuracao-de-mora.ts`, cabeçalho do novo `automacao-de-cobranca.ts:236` e o marcador `DECISÃO FECHADA` de `comum.ts:252`. O lado da **entrada** tem barreira universal com âncora exata (CT-336/CT-337 sobre `ESQUEMAS_DE_ENTRADA`, hoje em 15); o lado da **saída** não tem nenhuma, em nenhuma fatia — T2 / régua de cobrança
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-11T17:15:00Z

---

## [repeated_assertion_shape] Listas-espelho do conjunto de tabelas de negócio

**Regra que isto sugere:** toda task que criar tabela em `negocio` atualiza o conjunto **completo** de listas-espelho auditadas por igualdade, e a lista dessas listas mora num ponto só.

**O que ela faria (simples):** o mesmo conjunto de tabelas de `negocio` está escrito à mão em **seis** lugares diferentes — quatro em Vitest, um em shell e um como lista de símbolos — e cada um é comparado por **igualdade exata**, de modo que esquecer qualquer um deles deixa a suíte vermelha ao fechar a task. A §3.4 da T3 previu **quatro** e existem **seis**; uma regra que nomeasse as seis pouparia a descoberta por reprovação, **sem enfraquecer a igualdade**, que é justamente o que dá poder de detecção a essas asserções.

- Evidência: mesmo conjunto replicado e comparado por igualdade em `packages/db/test/catalogo.spec.ts:205`, `packages/db/test/papel-de-conexao.spec.ts:105`, `packages/db/test/unidade-de-trabalho.spec.ts:656` e `deploy/scripts/instalacao/verificar-migracao.sh:208` — T3 / régua de cobrança
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T19:00:00Z

---

## [repeated_assertion_shape] Corpo de aviso afirmado por conteúdo, elemento a elemento

**Regra que isto sugere:** o corpo de mensagem composta em código se afirma por `toContain` de literal, uma asserção por elemento exigido — nunca por igualdade de cadeia inteira nem por snapshot.

**O que ela faria (simples):** o mesmo formato de asserção (`expect(<mensagem>.corpo).toContain(<literal>)`) aparece em quatro casos distintos do arquivo, cada um prendendo um elemento diferente do molde. Escrever isso como regra pouparia a cada task nova de mensagem a decisão entre snapshot, igualdade inteira e asserção por elemento — decisão que o card do CT-614 precisou tomar à mão, proibindo snapshot em prosa.

- Evidência: `expect(<mensagem>.corpo).toContain(<literal>)` em 4 casos de `packages/regua/test/mensagem.spec.ts` (l. 87, 98, 115, 129) — `T4 / composição do aviso da régua de cobrança`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T20:10:00Z

---

## [repeated_fixture] Acessório `emUnidade` redefinido por arquivo de teste

**Regra que isto sugere:** o par `contextoDeTenant.executarCom` + `acesso.emUnidadeDeTrabalho` tem um acessório compartilhado em `packages/db/test/`, em vez de uma cópia por arquivo.

**O que ela faria (simples):** a mesma função `emUnidade`, com o mesmo corpo e o mesmo docblock, é redigida do zero em cinco arquivos de teste do pacote — os dois desta task e três anteriores. Uma regra apontando o acessório compartilhado evita que a quinta cópia divirja da primeira justamente no ponto que decide como o contexto de tenant chega ao banco.

- Evidência: `async function emUnidade` declarado em 5 specs de `packages/db/test/` (envio-de-cobranca:673, politica-de-aviso:173, cobranca, contrato, cadastro-de-pessoa) — `T5 / as portas de dados da régua`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-11T21:40:00Z

---

## [repeated_fixture] Contagem crua com sentinela `-1` no ramo impossível

**Regra que isto sugere:** toda contagem de conferência em teste é CRUA (sem `WHERE empresa_id`, que é da política) e devolve `-1` quando a linha não volta, nunca `0`.

**O que ela faria (simples):** o mesmo par aparece redigido de novo a cada arquivo — contar sem filtro de empresa, e usar `?? -1` para que uma consulta que não voltasse reprove em vez de virar o próprio zero que o caso espera. É convenção real e não escrita, e quem a esquecer escreve uma contagem que passa mascarando a falha.

- Evidência: `Number(linha?.total ?? -1)` sobre contagem sem `WHERE empresa_id`, em 4 specs de `packages/db/test/` (politica-de-aviso:196, envio-de-cobranca:979, contrato:958, isolamento:1130) — `T5 / conferência de fatos gravados`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-11T21:40:00Z

---

## [repeated_assertion_shape] Conjunto selecionado afirmado por igualdade de lista ordenada de códigos

**Regra que isto sugere:** resultado de porta que SELECIONA se afirma por `expect(lista.map(x => x.codigo)).toStrictEqual([...])` — igualdade de lista ordenada, nunca `toContain` e nunca comprimento.

**O que ela faria (simples):** o mesmo formato aparece três vezes nos casos do predicado, e é ele que faz um recorte esquecido reprovar NOMEANDO as linhas a mais, em vez de passar verde. Escrita como regra, a forma deixa de depender de cada autor lembrar por que `toContain` não serve.

- Evidência: `expect(<selecao>.map(c => c.codigo)).toStrictEqual([...])` em 3 pontos do CT-610 e do CT-611 (`packages/db/test/envio-de-cobranca.spec.ts` l. 524, 624, 643) — `T5 / predicado de elegibilidade`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T21:40:00Z

---

## [repeated_fixture] Acessórios de cenário da régua compartilhados

**Regra que isto sugere:** centralizar os acessórios de semeadura de cenário de cobrança (empresa, contrato ativo, lançamento de cobrança, data deslocada) num acessório único de `packages/db/test/`, ao lado de `banco-efemero.ts`.

**O que ela faria (simples):** o mesmo conjunto de acessórios de arranjo foi reescrito em três arquivos de teste da mesma fatia. Cada cópia é livre para divergir em silêncio, e um arranjo que divergiu faz o caso provar coisa diferente da que ele afirma provar — que é o argumento que o próprio `varredura-de-fontes.ts` registra no cabeçalho para justificar a extração dele.

- Evidência: `emUnidade`, `admitirEmpresaNova`, `semearCenario`, `pessoaDe`, `lancar` e `dataDeslocada` replicados em `packages/db/test/{execucao-da-regua:988, barreira-de-envio:471, envio-de-cobranca:116}.spec.ts` — `T6 / execução e barreira de envio`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-11T23:20:00Z

---

## [repeated_assertion_shape] Resultado da régua afirmado inteiro

**Regra que isto sugere:** o resultado de uma passagem da régua é afirmado INTEIRO por `toStrictEqual` com `satisfies ResultadoDaRegua`, nunca por asserção de campo isolado.

**O que ela faria (simples):** o mesmo formato aparece em dez pontos dos dois arquivos novos, sempre comparando as cinco contagens de uma vez. É o padrão certo — uma contagem errada passaria despercebida numa asserção de presença, e é a contagem que a borda do job consome para decidir se levanta —, e escrevê-lo como convenção evita que o próximo caso afirme só `enviadas`.

- Evidência: `expect(await passar(...)).toStrictEqual({ candidatas, enviadas, falhas, semDestinatario, houveFalha } satisfies ResultadoDaRegua)` em 4 pontos — `T6 / CT-615 a CT-620 e CT-626 (c)`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-11T23:20:00Z

---

## [convention_drift] Concatenação que evade detector da própria suíte

**Regra que isto sugere:** partir uma cadeia que um detector da suíte procura é legítimo **só em leitura estática de fonte**, nunca em **carga de módulo**.

**O que ela faria (simples):** dois arquivos já usam o truque de escrever `adaptador${'-'}smtp` para não serem acusados pela barreira que impede a verificação de construir o adaptador de e-mail real, e cada um o usa por uma razão diferente, explicada só no próprio docblock. Sem regra escrita, o próximo arquivo copia o idioma sem saber onde está o limite — e o mesmo truque, aplicado a um `import()` em vez de a um `readFile`, faz **um envio real escapar com a suíte verde**.

- Evidência: idioma usado para evadir `NOMEIA_O_SIMBOLO`/`NOMEIA_O_MODULO` do detector da CA-17, em `packages/regua/test/coordenadas-do-transporte.spec.ts:74` e `packages/db/test/barreira-de-envio.spec.ts:507`; sweep por `concatenaç`, `partir as duas cadeias` e `acusar o próprio` em `.claude/rules/*` e `docs/adr/*` retorna **vazio** — `T6 / adaptador SMTP e a barreira de envio`
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-12T02:00:00Z

---

## [repeated_assertion_shape] Asserção estática sobre a árvore versionada

**Regra que isto sugere:** um leitor único de arquivo versionado, ancorado na raiz do repositório, para toda asserção estática — em vez de cada suíte reconstruir raiz, leitor e ordenação.

**O que ela faria (simples):** três suítes de pacotes diferentes já reimplementam a mesma mecânica — resolver a raiz do monorepo, ler um fonte por caminho relativo e afirmar por igualdade ordenada sobre o que o regex extraiu. Cada cópia carrega suas próprias armadilhas (a raiz calculada por `..` empilhado, a ordenação esquecida, **o alvo que envelhece quando o arquivo muda de pacote — que foi exatamente o que a T7 teve de consertar no CT-512 b**).

- Evidência: a forma `ler(fonte) → matchAll(regex) → sort() → toEqual(literal)` em 3 pontos de 2 pacotes (`protocolo-antirregressao.spec.ts:125`, `cobranca.spec.ts:369` e `:2822`) — `T7 / contrato da fila`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-12T04:00:00Z

---

## [scope_deviation] Renome de símbolo público e lista de arquivos

**Regra que isto sugere:** task que renomeia símbolo público existente lista, na seção de arquivos a modificar, **todo consumidor do nome antigo**.

**O que ela faria (simples):** a T7 renomeou `NOME_FILA_ECO` para `FILA_DO_ECO` na seção de símbolos públicos, mas a lista de arquivos a modificar não incluiu os três consumidores nem o teste que lia o nome por padrão. O executor precisou tocar quatro arquivos fora do escopo declarado e explicar cada um, e o gate precisou reconstruir por leitura o que a lista deveria trazer. A regra garantiria que um `grep` do nome antigo — **um comando** — feche a lista antes de a task ser despachada.

- Evidência: quatro arquivos editados fora da §5.2 (`apps/worker/src/main.ts:178`, `apps/worker/src/tarefas/eco.ts:35`, `apps/worker/test/eco.spec.ts:111`, `packages/db/test/cobranca.spec.ts:369`) — `T7 / refactor_cross_module`
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-12T04:00:00Z

---

## [repeated_fixture] Maquinaria de exigência de ambiente duplicada

**Regra que isto sugere:** detector de exigência de ambiente e de caminho de provisionamento tem lar único em `packages/shared/test/`, e toda composição raiz nova o consome em vez de reescrevê-lo.

**O que ela faria (simples):** as mesmas seis funções que derivam quais variáveis um processo exige para subir existem hoje em duas implementações independentes — a privada do worker e a canônica em `packages/shared/test/` —, e endurecer uma deixa a outra para trás sem que nada acuse. Uma regra apontando o lar único evitaria que a terceira composição raiz abrisse a terceira escrita.

- Evidência: `fonteDeclarando`, `variaveisConsultadasPor`, `variaveisExigidasPor`, `chavesEmitidasPor`, `chavesDeclaradasNaUnidade` e `semCaminhoDeProvisionamento` definidas duas vezes, com o mesmo contrato — `apps/worker/test/ambiente.spec.ts:423` × `packages/shared/test/exigencia-de-ambiente.ts:59` — T10 / barreira de partida da `api` (CA-17)
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-08-12T11:00:00Z

---

## [repeated_assertion_shape] Âncoras de superfície fora da §5.2 da task

**Regra que isto sugere:** toda task que publica rota lista na §5.2 os arquivos de âncora de superfície que ela obriga a crescer, em vez de deixá-los para o executor descobrir.

**O que ela faria (simples):** o mesmo formato de asserção — lista literal comparada por igualdade exata, crescida com uma linha `SUT_IS_CORRECT_BECAUSE:` — aparece em suítes que a §5.2 não declara, e o executor precisou abri-las por conta própria em **todas** as tasks que publicam rota. Tirar o achado do caminho crítico do gate custa uma linha de planejamento.

- Evidência: décima reincidência declarada do D26 (F2/T6) — `cobertura-de-autorizacao.e2e.spec.ts:1236`, `contexto.e2e.spec.ts:493`, `validacao.spec.ts:484`, `unidade-de-trabalho.spec.ts:839` — T10 / duas rotas novas
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-12T11:00:00Z

---

## [scope_deviation] Símbolo público novo fora da declaração

**Regra que isto sugere:** toda função exportada por um barrel de pacote entra na seção `Símbolos públicos criados` da task que a cria, junto do arquivo de origem e do barrel na lista de arquivos a modificar.

**O que ela faria (simples):** a T10 publicou `localizarCandidataAoAviso` em `@sysloc/db` sem declarar o símbolo nem os dois arquivos, embora a task descrevesse o comportamento em prosa. Essa seção é o que o guard de paralelismo lê para provar disjunção de símbolo — símbolo não declarado ali pode ser criado por uma task e consumido por outra do mesmo lote sem que nada acuse.

- Evidência: `packages/db/src/envio-de-cobranca.ts:265` e `packages/db/src/index.ts:470` — T10 / disparo manual de aviso de cobrança
- Sinal: `scope_deviation` · Origem: `staff-review` · 2026-08-12T11:00:00Z

---

## [convention_drift] Acessório de teste replicado ao terceiro consumidor

**Regra que isto sugere:** acessório de teste que alcança o terceiro consumidor sobe para módulo compartilhado, ou recebe `DÉBITO COM GATILHO` no ponto da cópia.

**O que ela faria (simples):** o projeto já pagou este débito três vezes — `validar()`, `esquemaDoErro()` e `sobContextoDaSessao()` subiram para `apps/api/src/comum/` só depois de N cópias byte a byte —, e os débitos D1 e D26 agendam a promoção já ao terceiro consumidor, mas nenhuma rule escreve isso. Cada task redescobre o limiar sozinha e as cópias divergem em silêncio: a terceira de `CODIGO_NO_ASSUNTO` já saiu com flag `u` diferente das outras duas. A regra fixaria o limiar **e** a alternativa aceita quando refatorar não cabe na task.

- Evidência: terceira cópia de `CODIGO_NO_ASSUNTO` (`/COB-\d{4}-\d{7}/`) em três pacotes, já divergente na flag `u` — `apps/api/test/equivalencia-com-o-oraculo.spec.ts:574`, `packages/db/test/execucao-da-regua.spec.ts:257`, `apps/worker/test/regua.spec.ts:183` — T11 / equivalência com o oráculo
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-12T13:20:00Z

---

## [repeated_assertion_shape] Precondição de permissão afirmada pela sessão

**Regra que isto sugere:** toda precondição de permissão de um caso de autorização é afirmada por `GET /v1/sessao` antes do exercício, nunca presumida do arranjo escrito.

**O que ela faria (simples):** o mesmo formato aparece 15 vezes no arquivo — lê-se o efetivo publicado pela sessão e afirma-se o que ela alcança **antes** de exercitar a rota. Sem isso, um `403` seria indistinguível de sessão quebrada, e o caso provaria apenas que a sessão não serve para nada. Uma regra escrita pouparia cada autor futuro de redescobrir a razão.

- Evidência: afirmação do efetivo por `efetivoDe(...)` (que chama `GET /v1/sessao`) antes e depois de cada ajuste de chave — `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1411`, `:1519`, `:1590`, `:811`, `:898` — T12 / fronteira de autorização da régua
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-12T15:10:00Z

---

## [repeated_assertion_shape] Recusa 403 afirmada pelo envelope inteiro

**Regra que isto sugere:** a recusa de autorização é afirmada pelo **objeto inteiro** da ADR-0017 — código, mensagem e `detalhes.exigido` —, nunca pelo status sozinho nem por presença de campo.

**O que ela faria (simples):** o formato aparece 7 vezes no arquivo, sempre comparando o corpo completo da recusa por igualdade. Afirmar só o status deixaria passar uma recusa que mudasse de forma ou que **nomeasse a chave errada** — e é justamente a chave nomeada que diz ao cliente o que lhe falta.

- Evidência: igualdade de objeto contra `{ codigo: CodigoErro.ACESSO_NEGADO, mensagem: MENSAGEM_DE_ACESSO_NEGADO, detalhes: { exigido: <chave> } }` — `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1457`, `:1568`, `:940`, `:1034`, `:1254` — T12 / fronteira de autorização da régua
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-08-12T15:10:00Z

---

## [convention_drift] Citação de CT ou ADR dentro do código

**Regra que isto sugere:** identificador de caso de teste ou de ADR citado em comentário de código é **verificado contra o repositório antes de ser escrito** — arquivo e identificador têm de resolver no mesmo caso que carrega a afirmação.

**O que ela faria (simples):** é a **segunda vez na mesma fatia** que um ponteiro dentro de comentário aponta para o lugar errado — no **D53 (T10)** era uma cláusula de ADR que não existe na `Decision` literal, e agora um `CT-016` que existe, **mas em outro arquivo e sobre outro assunto**. Nos dois casos a afirmação substantiva estava certa e só o ponteiro estava errado — e é o ponteiro que o próximo agente segue. Pior: como o `CT-016` **colide** com um caso real de outro arquivo, a conclusão natural de quem o seguisse não seria *"há um erro de digitação"*, e sim *"o precedente invocado é falso"*. A regra faria o `grep` do identificador no arquivo citado ser parte de escrever a citação — segundos de custo.

- Evidência: `autenticacao.e2e.spec.ts (CT-016)` citado dentro de uma `DECISÃO FECHADA` — `grep -n "CT-016"` naquele arquivo devolve **vazio**, as linhas são do **CT-018 (d)**, e o `CT-016` real vive em `recusa-indistinguivel.e2e.spec.ts:337` sobre outro assunto — `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1460` e `apps/api/src/automacao/automacao.controller.ts:63` — T12 / rodada 2
- **Sweep de cobertura feito**: a `.claude/rules/testing-stack.md` fixa o **formato** `CA-xx → CT-xxx (RN-xx)` e a declaração do ID no nome do caso, mas **nada** em `.claude/rules/*` nem em `docs/adr/` governa a **referência** a esse ID a partir de outro ponto do código; o `CLAUDE.md` cobre só o caso de ADR.
- Sinal: `convention_drift` · Origem: `staff-review` · 2026-08-12T17:30:00Z

---
