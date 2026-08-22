# Relatório do Run — emissao-e-conciliacao/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: ✅ **RUN CONCLUÍDO — 17/17 tasks**, todas aprovadas nos dois gates · suíte **1596 casos verdes** medidos pacote a pacote, os nove um a um · `pnpm build` (9/9), `pnpm lint` e `pnpm lint:shell` limpos

> ✅ **O `CLAUDE.md` foi reconciliado pela T17** e já declara os **1596**, com o detalhamento por pacote junto:
> `contracts` 398 · `api` **317** · `shared` 236 · `db` 215 · `documentos` 151 · `worker` 99 · `auth` 89 ·
> `cobranca-bancaria` 61 · `regua` 30. A superfície também: **99 rotas / 84 manipuladores**, com as duas somas
> escritas na prosa para que a divergência seguinte seja detectável **sem re-medir**.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Contratos publicados da cobrança bancária | opus | 1 criado, 8 mod | ✅ APROVADO (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T2 | Esquema Drizzle e migrações `0017`/`0018` | opus | 4 criados, 9 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Trilha bancária na camada de dados | opus | 3 criados, 5 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 2) | ✅ **APROVADO** (rodada 2, `problems: []`) |
| T4 | Dados da emissão em lote | opus | 2 criados, 4 mod | ✅ **APROVADO** (rodada 5) | ✅ APROVADO_COM_OBSERVACOES (rodada 5) |
| T5 | Dados da conferência bancária | opus | 2 criados, 2 mod | ✅ **APROVADO** (rodada 1) | ✅ APROVADO_COM_OBSERVACOES (rodada 1) |
| T6 | Dados do boleto: emissão, liquidação, estorno, revogação | opus | 2 criados, 7 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 3) | ✅ APROVADO_COM_OBSERVACOES (rodada 3) |
| T7 | A porta `AdaptadorCobrancaBancaria` e o modelo canônico | opus | 1 criado, 9 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 3) | ✅ APROVADO_COM_OBSERVACOES (rodada 3) |
| T8 | Adaptador Sicoob: 4 operações e cache de credencial | opus | 1 criado, 5 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T9 | Guarda de boletos, provisionamento e verificador de infraestrutura | opus | 3 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T10 | `executarEmissaoEmLote` — percurso, RN-02 e prestação de contas | opus | 3 criados, 8 mod | ✅ **APROVADO** (rodada 3) | ✅ **APROVADO** (rodada 3, `problems: []`) |
| T11 | `reemitirBoleto` — revogar, sondar, emitir num ato só | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T12 | `conferirCobrancas` — liquidar, estornar e revogar sem cancelar | opus | 2 criados, 5 mod | ✅ **APROVADO** (rodada 2) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T13 | `BoletoService`, rotas de emissão e revogação, composição raiz | opus | 2 criados, 10 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 3) | ✅ APROVADO_COM_OBSERVACOES (rodada 3) |
| T14 | Entrega do boleto (bytes, ADR-0028) e histórico bancário | opus | 1 criado, 9 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 4) | ✅ APROVADO_COM_OBSERVACOES (rodada 4) |
| T15 | Lote e conferência na borda: 3 rotas, 2 filas | opus | 4 criados, 11 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 3) | ✅ APROVADO_COM_OBSERVACOES (rodada 3) |
| T16 | Processo de trabalho: 2 bordas de tarefa e 9 variáveis de ambiente | opus | 4 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES (rodada 3) | ✅ APROVADO_COM_OBSERVACOES (rodada 2) |
| T17 | Fecho: superfície por dupla medição, vocabulário, autorização, `CLAUDE.md` | opus | 1 criado, 9 mod | ✅ **APROVADO** (rodada 2, zero problemas) | ✅ APROVADO_COM_OBSERVACOES (rodada 1) |

Contagem por pacote ao fim da T5: `@sysloc/contracts` **389** (era 356) · `@sysloc/api` **281** (era 280) · `@sysloc/shared` 233 · `@sysloc/db` **206** (era 192) · `@sysloc/documentos` 151 · `@sysloc/auth` 89 · `@sysloc/worker` 65 · `@sysloc/regua` 30 · `@sysloc/cobranca-bancaria` 22.

**Fase 1 (contrato e esquema) fechada. Fase 2 (camada de dados) em curso: T3, T4 e T5 prontas, falta a T6.**

> **A T5 é a irmã estrutural da T4 e passou nos dois gates na PRIMEIRA rodada, contra cinco da irmã.**
> A diferença é medível e não é sorte: as **três** lições que a T4 pagou — conferir a linha alcançada,
> **medir a premissa antes de escrevê-la**, e ancorar o controle antivácuo num **literal** — foram
> injetadas no prompt do executor, e as três nasceram certas. O investimento em carregar o aprendizado
> de uma task para a seguinte **poupou quatro rodadas**.

> **A T4 custou cinco rodadas e treze achados, e vale saber por quê** — nenhuma delas foi retrabalho
> cego. A rodada 1 caiu por uma asserção que **não podia falhar**. A rodada 2 caiu por duas escritas
> que **não conferiam a linha alcançada**. A rodada 3 caiu por um efeito **da própria correção da
> rodada 2** — a premissa que a justificava era falsa contra a spec da fatia. A rodada 4 caiu por um
> **erro do orquestrador** no artefato que ele escreveu para fechar a rodada 3. Cada rodada fechou o
> que a anterior abriu, e o Gate 2 encerrou dizendo, sobre a decisão de aprovar: *"não é cansaço: é
> medição"*.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado com bloqueio seletivo por categoria: baixos de qualquer categoria e médios de categoria anotável não bloqueiam. Resolva tudo de uma vez com `/agent-spec-debt-resolution docs/specs/features/emissao-e-conciliacao/v1/`.
>
> ⚠️ **O `D1` abaixo é de outra natureza**: ele é um **`DÉBITO COM GATILHO`** com marcador vivo no código (§3-B da `.claude/rules/nao-regressao.md`) e linha no índice do `CLAUDE.md`. Os demais são achados anotáveis dos gates. A numeração `Dnn` é a mesma sequência desta §2, sem faixa reservada.

### D1 · baixo · project_pattern · T1 · executor

> ✅ **FECHADO NA T6** (2026-08-17). `LinhaDeCobranca` passou a carregar os cinco campos e a
> selecioná-los em `listarCobrancas`/`localizarCobranca`; `CobrancaService.publicar` saiu inteiro, o
> marcador saiu do código e a linha saiu do índice do `CLAUDE.md`, tudo no mesmo diff. O `CT-514 (d)`
> saiu junto, **por desenho** — ele auditava a ordem de um método que deixou de existir, e o extrator
> dele levanta quando a assinatura some. O que ficou no lugar é comportamental e mais forte: o
> `CT-922` afirma que a cobrança liquidada **publica** `dataDoCredito` e `valorCreditado` vindos do
> banco, e que a linha publicada tem exatamente as 23 chaves — sem `identificadorNoProvedor`.

- **Onde:** `apps/api/src/cobrancas/cobranca.service.ts` (`publicar`)
- **Problema:** os cinco campos de conciliação bancária (`numeroDoTituloNoProvedor`, `linhaDigitavel`,
  `codigoDeBarras`, `dataDoCredito`, `valorCreditado`) são compostos na borda como `null` **fixo**, e
  não lidos da linha do banco. A T1 estendeu `esquemaDaCobranca` de 18 para 23 campos (§4.2 da tech
  spec), enquanto `LinhaDeCobranca` — **símbolo declarado da T6** — segue com dezoito. Sem a
  composição, `apps/api` não compila: medido, `tsc --build` reprova em três pontos do serviço
  (`criar`, `listar`, `exigir`).
- **Impacto:** hoje **nenhum**, e a razão é factual: nenhuma rota emite boleto ainda, e as cinco
  colunas estão nulas em toda linha — o valor publicado é o verdadeiro. O impacto aparece no instante
  em que a emissão existir e a leitura não trouxer as colunas: a API publicaria `null` sobre dado
  gravado, sem que nada acusasse.
- **O que fazer:** na **T6**, ao estender `LinhaDeCobranca` com os cinco campos e fazer
  `listarCobrancas` e `localizarCobranca` os selecionarem, **remover `publicar` inteiro** e voltar a
  devolver a linha como ela vem do banco — os três pontos de chamada voltam à forma anterior. O
  marcador `DÉBITO COM GATILHO — D1 · F4/T1` sai no mesmo commit, junto com a linha do índice do
  `CLAUDE.md`, **e o `CT-514 (d)` sai junto** (ele levanta `assinatura da projeção não encontrada no
  fonte` quando o método deixa de existir — falha ruidosa e nomeada, por desenho).
- **Prova exigida:** a suíte de `apps/api` já cobre os três caminhos (criação, listagem e leitura por
  código) com igualdade de corpo inteiro; ao fechar, o conjunto de 23 chaves precisa continuar
  idêntico, com os valores vindo do banco em vez da constante.
- **Nota da rodada 2:** por veredito do Gate 2, a **ordem** da composição foi invertida — os cinco
  valores padrão vêm **antes** do `...linha`, de modo que a construção se torna inerte por si só
  quando a T6 estender a linha. A ordem é **deliberada** e está declarada no `QUANDO FECHA`; o
  `CT-514 (d)` é a rede executável que reprova se ela for revertida.

### D2 · MEDIO · project_pattern · T1 · Tech Review

- **Onde:** `docs/specs/features/emissao-e-conciliacao/v1/tasks/T1.md` (§5.2)
- **Problema:** a §5.2 declarou cinco arquivos a modificar e a task precisou tocar **três** outros —
  `apps/api/test/cobrancas.e2e.spec.ts` (arquivo-âncora, `CHAVES_PUBLICADAS` 18 → 23),
  `apps/api/src/cobrancas/cobranca.service.ts` e `packages/contracts/src/contrato.ts`. O Gate 2
  julgou os três como **consequência mecânica, e não alargamento de escopo**: `contrato.ts` é a
  metade-origem obrigatória do Aceite Técnico #5, e os dois de `apps/api` são forçados pelo
  `tsc --build`. O defeito está na **declaração**, não na execução.
- **Impacto:** custo de gate, não de produto — uma passagem dos dois gates gasta decidindo escopo.
  Nenhum efeito em runtime. Agrava-o o fato de a `.claude/rules/ancoras-de-superficie.md` nomear
  literalmente este cenário e antecipar exatamente o custo observado.
- **O que fazer:** ao abrir a **T2** e a **T6**, derivar a §5.2 **por busca** sobre as âncoras de
  igualdade que a publicação faz crescer, antes de a spec fechar. Para a T6 isso significa declarar
  de saída `apps/api/src/cobrancas/cobranca.service.ts` (remoção de `publicar`),
  `apps/api/test/cobrancas.e2e.spec.ts` e `packages/contracts/test/esquemas.spec.ts`. **Nada a
  corrigir no código da T1.**

### D3 · BAIXO · testability · T1 · Tech Review

- **Onde:** `packages/contracts/src/cobranca-bancaria.ts` (os cinco esquemas publicados)
- **Problema:** os ~26 nomes de campo dos cinco esquemas novos ficam **fora do alcance de qualquer
  varredura de vocabulário do provedor**. A varredura canônica
  (`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`) lê apenas o próprio pacote, e o
  caso do CT-544 varre apenas `esquemaDaCobranca.shape` contra quatro termos escritos por extenso.
  O Gate 2 conferiu um a um: **estão limpos hoje**.
- **Impacto:** nenhum hoje. O risco é de fatia futura — um `nossoNumero` ou `pagador` acrescentado a
  qualquer dos cinco esquemas atravessaria toda a suíte sem uma recusa, e chegaria ao pacote que o
  frontend importa. A emenda de 2026-08-15 da ADR-0001 declara a cláusula de vocabulário como
  **exigível por medição**, e esta superfície não é medida.
- **O que fazer:** iterar a tabela `SAIDAS_DA_FATIA` (já existe em `esquemas.spec.ts`) mais
  `esquemaDaCompetencia`, afirmando **por igualdade** que a interseção entre as chaves publicadas e a
  lista de termos do provedor é vazia — **com controle positivo** (objeto com as agulhas plantadas,
  lista de achados afirmada por igualdade), sob pena de AP-29. Lista de termos escrita por extenso,
  sem importar do outro pacote. A **T2** e a **T6** acrescentam campos ao mesmo módulo: são os
  momentos naturais de fechá-lo.
- **Por que não foi feito na rodada 2:** recusa fundamentada do executor e aceita pelos dois gates —
  a varredura exige controle positivo próprio, o que é caso novo inteiro fora do bloqueante daquela
  rodada (§4.5 do Protocolo Antirregressão: não *"aproveitar que estou aqui"*).

### D4 · BAIXO · project_pattern · T1 · Tech Review

- **Onde:** `apps/api/src/cobrancas/cobranca.service.ts:478-486`
- **Problema:** a proteção da **ordem** da composição vive como prosa dentro do campo `QUANDO FECHA`
  do `DÉBITO COM GATILHO — D1 · F4/T1`, sem `REVERTER EXIGE`. A decisão satisfaz **dois** dos quatro
  gatilhos de registro da §3 da `.claude/rules/nao-regressao.md` (forma menos óbvia que a idiomática,
  escolhida por razão concreta; e veredito explícito de um gate), e a §3 manda registrar quando
  qualquer um deles se encaixa.
- **Impacto:** três consequências, todas pequenas e todas reais. (1) Sem `REVERTER EXIGE` não há
  condição declarada sob a qual reordenar volta a ser legítimo — é advertência, não contrato. (2) A
  proteção fica **invisível à varredura por marcador**: o Gate 2 varre o diff pelo literal
  `DECISÃO FECHADA`, e prosa dentro de um marcador de débito não é alcançada — a rodada futura que
  reordenar não dispara o CRÍTICO automático. (3) A §3-B declara que o `DÉBITO COM GATILHO`
  **não protege nada** e que editar o código sob ele é normal: quem ler a *natureza* do marcador
  antes da prosa recebe o sinal oposto ao pretendido. O risco residual é baixo **porque o
  `CT-514 (d)` existe** e é instrumento estritamente mais forte que qualquer comentário.
- **O que fazer:** acrescentar um `DECISÃO FECHADA` **adjacente** (sem remover nem alterar o
  `DÉBITO COM GATILHO`), escopado à **ordem** e não à composição, com
  `REVERTER EXIGE: a remoção INTEGRAL desta composição pela T6, com LinhaDeCobranca já estendida com
  os cinco campos — reordenar sem removê-la não satisfaz este campo.` Esse `REVERTER EXIGE` é
  exatamente o `QUANDO FECHA` do débito, o que dissolve a contradição aparente entre os dois
  marcadores: a T6 removendo tudo satisfaz o contrato e está livre; a rodada que apenas "normaliza" a
  ordem não satisfaz, e passa a ser CRÍTICO detectável por varredura. O parágrafo de 478-486 pode
  então encolher para uma linha remetendo ao marcador irmão.
- **Alavanca de custo zero:** a **T6** é quem abre exatamente este trecho. O orquestrador já registrou
  o item para injetá-lo no prompt dela.

### D5 · baixo · documentation · T2 · QA

- **Onde:** `docs/specs/features/emissao-e-conciliacao/v1/tasks/T2.md` (§5.2)
- **Problema:** mesma classe do **D2**, agora na T2. A §5.2 declarou quatro arquivos a modificar; o
  crescimento do schema obrigou a mover **cinco** âncoras não declaradas — `papel-de-conexao.spec.ts`
  (contagem 16 → 20 e três listas), `unidade-de-trabalho.spec.ts` (`SIMBOLOS_ESPERADOS`, +7),
  `cobranca.spec.ts` e `fonte-unica-do-estado.spec.ts` (as duas cópias homônimas de
  `COLUNAS_DA_COBRANCA`) e `deploy/scripts/instalacao/verificar-migracao.sh` (a frente **shell** da
  mesma lista). Mais o `meta/0017_snapshot.json`, saída obrigatória do `drizzle-kit generate`, ausente
  da §5.1.
- **Impacto:** de escrituração, não de código. **Nenhuma asserção foi enfraquecida** — os dois gates
  verificaram que todas cresceram por igualdade. O Gate 2 julgou explicitamente que **nenhum** dos
  cinco é alargamento de escopo: são âncoras que a `ancoras-de-superficie.md` obriga a mover no mesmo
  diff, e sem tocá-las a suíte fica vermelha por construção.
- **O que fazer:** ao redigir a §5.2 de tasks futuras que criem tabela em `negocio`, derivar as
  âncoras **por busca** antes de fechar a spec. O comando já está registrado no cabeçalho de
  `packages/db/src/esquema/negocio.ts` (`grep -rln --exclude-dir=dist "COLUNAS_DA_COBRANCA" packages`),
  e o mesmo movimento vale para `TABELAS_DE_NEGOCIO_ESPERADAS` e `SIMBOLOS_ESPERADOS`. **O
  orquestrador já faz isso desde a T2** — foi assim que o `papel-de-conexao.spec.ts` entrou
  pré-autorizado no prompt.

### D6 · BAIXO · project_pattern · T2 · Tech Review

- **Onde:** `packages/db/src/esquema/negocio.ts:215,303,386,475`
- **Problema:** as quatro tabelas nascidas no mesmo diff **divergem entre si** no desenho da
  referência à empresa. `evento_bancario`, `emissao_em_lote` e `conferencia_bancaria` declaram
  `.references(() => empresa.id)` além da composta; `item_da_emissao_em_lote` não. Os dois docblocks
  justificam por **precedente**, e os precedentes **se contradizem** quando aplicados às irmãs. O
  critério real existe e é preciso — `conferencia_bancaria` **precisa** da FK simples porque
  `solicitada_por` é anulável e `MATCH SIMPLE` desliga a composta quando ela é nula; nas outras três a
  composta é incondicional e a simples é redundante —, mas **não está escrito em lugar nenhum**
  (sweep confirmado em `.claude/rules/*` e `docs/adr/*`).
- **Impacto:** nenhum. Não há buraco de integridade nem de isolamento: `empresa_id` é `NOT NULL` nas
  quatro, as compostas recusam o apontamento cruzado, e a RLS forçada é a garantia efetiva. O custo é
  de manutenção — a próxima tabela de negócio (T3–T6, fatia (iii), F5) não tem regra a seguir e vai
  redecidir por imitação da vizinha mais próxima, que é como a divergência se perpetua.
- **O que fazer:** **NÃO alterar a `0017` nem a `0018`** — a migração é imutável por contrato e a
  redundância é inofensiva. A correção é **textual**: registrar no docblock de `conferencia_bancaria`
  que a FK simples ali é **necessária**, e nos de `evento_bancario`/`emissao_em_lote` que é
  **redundante e mantida por precedente**. Para fechar de vez, o critério cabe numa linha de rule de
  esquema — o candidato já está em `_run/rule-candidates.md` (`convention_drift`).

### D7 · baixo · project_pattern · T3 · executor (rodada 2) — ✅ **RESOLVIDO** na intervenção dirigida de 2026-08-18

- **Onde:** `packages/db/src/cobranca.ts` (junto de `FORMATO_ISO_DA_DATA`) — marcador
  `DÉBITO COM GATILHO — D7 · F4/T3`
- **Problema:** `FORMATO_ISO_DA_DATA` tem **três** declarações executáveis do mesmo literal
  (`cobranca.ts`, `envio-de-cobranca.ts` e `contrato.ts`, esta exportada para
  `documento-de-contrato.ts`). O limiar de três do `CLAUDE.md` já foi ultrapassado e nada amarra as
  três entre si.
- **Impacto:** nenhum hoje — as três grafias são idênticas, medido. O custo aparece na primeira
  alteração do molde: endurecer uma deixa duas para trás, e a divergência sai como **data deslocada**
  em campos que o oráculo compara contra o legado, sem que nada acuse por leitura.
- **O que fazer:** descer as três para `packages/db/src/moldes-de-formatacao.ts` — que já existe, e
  já é a casa do molde do instante desde esta task — removendo as declarações locais no mesmo diff.
  Ele **não** entra no barril: é detalhe da camada de dados, e o `CT-012` o acusaria como excedente.
- **Prova exigida:** as projeções que consomem o molde (contrato, cobrança, envio, documento) já são
  comparadas campo a campo contra o oráculo; ao fechar, a suíte dos pacotes `@sysloc/db` e
  `@sysloc/api` precisa manter a contagem e a igualdade dos corpos.
- **Por que não agora:** as três cópias são dívida **pré-existente**, que a T3 não criou nem agravou.
  A T3 subiu `FORMATO_ISO_DO_INSTANTE` porque **ela** foi o terceiro consumidor dele; arrastar junto
  o molde da data seria "aproveitar que estou aqui" (§4.5 do Protocolo Antirregressão), com três
  projeções a mais de superfície de regressão no diff.

### D8 · baixo · documentation · T4 · QA

- **Onde:** `packages/db/src/evento-bancario.ts:87` e `:297`
- **Problema:** as duas linhas afirmam *"nenhum símbolo publicado deste pacote entrega o UUID interno
  de uma cobrança"*. Desde a T4, `CobrancaSemBoleto` — publicado pelo barril — expõe `id`, que é
  precisamente esse UUID. A afirmação ficou **literalmente falsa**.
- **Impacto:** de prosa, não de comportamento. O alcance **pretendido** da frase (a leitura publicada
  que chega à borda) continua verdadeiro, e o `CobrancaSemBoleto` é passo interno do percurso do
  worker. O risco é de leitura: quem abrir aquele cabeçalho numa fatia futura lê uma exclusividade que
  o pacote já não tem — e este repositório registra essa classe de defeito como tendo custado fases.
- **O que fazer:** quando uma task tocar `evento-bancario.ts` **por outra razão**, qualificar a frase
  para o alcance que ela de fato tem: *"nenhum símbolo publicado deste pacote entrega o UUID interno de
  uma cobrança **numa leitura que chega à borda**; a exceção declarada é `CobrancaSemBoleto`, do
  percurso do worker, cujo `id` é a chave estrangeira composta que o item e o evento guardam"*.
- **Por que não foi feito na T4:** arquivo **alheio** à task. **Os dois gates concordaram** em mantê-lo
  como débito, e o cabeçalho da T4 já faz a ressalva por escrito — que é a mitigação disponível sob o
  menor-delta.

### D9 · BAIXO · code_quality · T4 · Tech Review

- **Onde:** `packages/db/src/emissao-em-lote.ts:277` (docblock de `RECUSA_POR_DESFECHO`)
- **Problema:** o docblock afirma que *"as chaves são os dois desfechos do lote, e são elas que dão o
  tipo do discriminante do construtor"*. **O código não deriva nada das chaves**: a união
  `'CONCLUSAO' | 'INTERRUPCAO'` é escrita à mão **duas** vezes (na propriedade e no parâmetro), e o
  mapa apenas **restringe** o uso numa direção — uma chave acrescentada a ele **não** passa a ser
  construível. O mesmo vocabulário está declarado em **três** lugares.
- **Impacto:** nenhum em runtime — suíte, tipo e mensagens corretos. O risco é de leitura, e é o mesmo
  motivo do **limiar de três**: endurecer o vocabulário num dos três pontos deixa os outros dois para
  trás; e quem acrescentar um terceiro desfecho confiando na frase descobre no compilador, não no
  docblock.
- **O que fazer:** declarar `type DesfechoDoLote = keyof typeof RECUSA_POR_DESFECHO;` logo abaixo do
  mapa e usá-lo nos dois pontos — a frase passa a ser **exata sem reescrita**, e as três declarações
  colapsam em uma. Alternativa aceita pelo gate: manter o código e trocar a frase por *"as chaves
  cobrem os dois desfechos, e a união do construtor é conferida contra elas na indexação"*.

### D10 · BAIXO · project_pattern · T5 · Tech Review

- **Onde:** `packages/db/src/emissao-em-lote.ts:549` × `packages/db/src/conferencia-bancaria.ts:406`
- **Problema:** o pacote passa a ter **duas formas** para o mesmo problema estrutural — o índice único
  parcial recusando a segunda escrita da empresa. A T4 usa `tx.savepoint` + captura de `23505`
  discriminada por `constraint_name`; a T5 usa `ON CONFLICT <arbiter> DO NOTHING`. **A divergência é
  justificada** (aqui a recusa não é erro, logo não há transação abortada e o `SAVEPOINT` seria
  maquinaria sem função), mas o critério de escolha está escrito **num lado só**.
- **Impacto:** risco de divergência futura, não defeito presente. Quem escrever a terceira porta
  abrindo primeiro a irmã — que é a mais antiga e a que a tech spec lista primeiro — **copia a forma
  pesada** sem saber que há caminho mais barato quando a recusa é desfecho legítimo.
- **O que fazer:** ⚠️ **NÃO alterar `emissao-em-lote.ts`** — está fora da §5 da T5 e já foi aprovado
  nos dois gates; seria o *"aproveitar que estou aqui"* que a proibição 5 do protocolo veda. Quando
  uma task legítima abrir aquele arquivo, acrescentar uma linha de contra-referência ao cabeçalho de
  `conferencia-bancaria.ts`. **Gatilho:** a **terceira porta** que abrir escrita governada por índice
  único parcial.

### D11 · BAIXO · code_quality · T5 · Tech Review

- **Onde:** `packages/db/src/conferencia-bancaria.ts:279`, `:395` e `:397`
- **Problema:** três textos afirmam **mais do que a instrução apura**. (a) o docblock diz que a
  ausência de linha *"é estado impossível"* — ela é inalcançável **por entrada externa**, mas
  **alcançável por concorrência**: a unidade abre em `READ COMMITTED`, e se o `INSERT` conflita e
  outra unidade grava `concluida_em` antes do `SELECT` seguinte, o `Error` genérico sobe (`500` onde a
  resposta certa seria abrir uma nova). Janela de **duas instruções**, probabilidade desprezível — o
  que se corrige é o **texto**. (b) *"ela levanta com nome"* não corresponde ao que a linha 417 faz
  (`Error` de texto, sem nome) — estruturalmente **certo** levantar genérico ali, é a redação que
  diverge. (c) a mensagem *"a conferência foi concluída e não foi alcançada"* **afirma uma causa** que
  o próprio docblock declara que esta camada **não separa**; a forma é herdada da irmã, onde
  `'concluído'`/`'interrompido'` nomeia a **porta** e por isso discrimina — com **uma** porta só, o
  discriminante é vestigial.
- **Impacto:** nenhum em runtime. O custo é de leitura: a premissa forte demais **convida o próximo
  agente a tratar o ramo como morto e removê-lo** (remoção de guarda), e a mensagem de (c) manda ao
  operador **a causa errada** nos casos de alvo errado ou contexto de tenant montado de outro modo.
- **O que fazer:** ajustar os três textos. ⚠️ **Não** alterar comportamento nem `emissao-em-lote.ts`.
  ⚠️ **Nota importante:** a frase de (a) **já existe na irmã aprovada**, logo **não é regressão da
  T5** — é precisão de premissa, exatamente a dimensão que custou uma rodada na T4.

### D12 · BAIXO · architecture · T5 · Tech Review

> ⚠️ **Este é o único da lista que carrega risco operacional real, e ele pede decisão de projeto.**

- **Onde:** `packages/db/src/conferencia-bancaria.ts` (`concluirConferencia`) e `negocio.conferencia_bancaria`
- **Problema:** a tabela tem `concluida_em` e **nenhuma coluna de interrupção**, e a T5 publica quatro
  portas **sem contraparte de `interromperLote`**. Consequência: toda conferência que não alcança o
  passo 7 do fluxo fica em `concluida_em IS NULL` **para sempre**, e o índice único parcial faz cada
  disparo seguinte da empresa **reencontrá-la** em vez de iniciar uma nova — o Admin recebe
  `iniciadaAgora: false` **indefinidamente**, sem caminho pela interface para fechar o que ficou preso.
  A irmã **não** tem o problema, porque tem `interromperLote` e a coluna que ele grava.
  O módulo documenta esse modo de falha, **mas só para o percurso do alvo errado**. O percurso **mais
  alcançável não está escrito**: o processo de trabalho que **queima as tentativas** (provedor fora do
  ar, certificado vencido no meio do laço) também nunca chama `concluirConferencia`.
- **Impacto:** **uma conferência presa nega a conciliação inteira daquele tenant** até intervenção
  manual em banco. É recuperável, mas **por fora do produto**.
- **A T5 está fiel à spec** — a ausência da coluna e da porta é decisão da `tech_spec.md`, e inventar
  aqui uma quinta porta violaria a regra 2 do `CLAUDE.md` e a §5.2 da task. **O que faltava era o
  registro**, e é este.
- **O que fazer:** **decisão de projeto pendente** — *a conferência precisa de desfecho de interrupção,
  ou de expiração por tempo?* **Gatilho:** a **T16** definir o que acontece quando o percurso da
  conferência falha antes do passo 7; ou a **F5** disparar a conferência pelo relógio, **quando não há
  Admin para reclamar** — que é quando o estado preso deixa de ter quem o denuncie.

### D13 · baixo · project_pattern · T6 · executor

- **Onde:** `packages/db/src/boleto-da-cobranca.ts` (junto de `ErroDeCobrancaNaoAlcancada`) — marcador
  `DÉBITO COM GATILHO — D13 · F4/T6`
- **Problema:** **nada no banco pareia os campos de conciliação entre si**. `linha_digitavel` sem
  `nosso_numero`, `codigo_barras` sem os outros dois, e qualquer outra combinação meio preenchida são
  representáveis; o que as impede hoje é apenas estas quatro escritas nomearem os campos **em bloco**.
- **Impacto:** nenhum enquanto a porta for o único caminho de escrita — medido: as quatro instruções
  são as únicas do produto que tocam as cinco colunas. O custo aparece na primeira escrita que não
  passe por aqui (uma correção manual em banco, uma migração de virada), e ela sairia como boleto
  meio publicado, com linha digitável sem título — sem que nada acuse por leitura.
- **O que fazer:** criar no banco a restrição pareando `linha_digitavel` com `nosso_numero`, na
  migração da fatia que alterar `negocio.cobranca` a seguir. ⚠️ **A bicondicional dos CINCO campos
  está descartada por medição, e não por esquecimento**: `data_credito` e `valor_creditado` nascem
  **depois** dos três de emissão, de modo que ela recusaria o estado legítimo *emitido e ainda não
  pago* — é o que a §7.2 da tech spec registra por escrito.
- **Prova exigida:** um caso que tente gravar `linha_digitavel` com `nosso_numero` nulo por instrução
  crua, sob o contexto da empresa, e afirme o `23514` do `check` nomeado — no molde do `CT-515 (b)`.
- **Por que não agora:** a `0017` já foi gerada, e a restrição exigiria migração própria sobre tabela
  com dado, fora dos arquivos declarados na §5.2 da T6. Mesma classe do **D44 · F2/T10**, que agenda
  restrições de coerência para a fatia que as criar no banco.

### D14 · baixo · project_pattern · T6 · executor

- **Onde:** `packages/db/src/esquema/negocio.ts` (a coluna `nossoNumero`) — marcador
  `DÉBITO COM GATILHO — D14 · F4/T6`
- **Problema:** `nosso_numero` é **vocabulário do provedor** numa coluna do produto, e a ADR-0001 fixa
  que nada dele cruza o que o produto publica. O nome **publicado** já é do produto desde a T1
  (`numeroDoTituloNoProvedor`), e a tradução tem lar único em `colunasDaCobranca` — a dívida é, por
  isso, de **esquema físico**, e não de contrato.
- **Impacto:** nenhum na superfície publicada, medido: a varredura de vocabulário canônico não alcança
  nome de coluna, e nenhum esquema de `@sysloc/contracts` traz o termo. O risco é de leitura — quem
  abrir o esquema encontra o vocabulário que a fatia declara ter eliminado.
- **O que fazer:** `RENAME COLUMN` na primeira migração que alterar `negocio.cobranca` depois da
  `0017`, com **três** consequências no mesmo diff: recriar `negocio.cobranca_derivada` (ela expande
  `c.*` no instante da criação, e a coluna renomeada não a alcança sozinha), atualizar as **duas**
  cópias homônimas de `COLUNAS_DA_COBRANCA` (`test/cobranca.spec.ts` e
  `test/fonte-unica-do-estado.spec.ts`) e trocar os apelidos das quatro instruções de
  `src/boleto-da-cobranca.ts` mais o de `src/conferencia-bancaria.ts`.
- **Prova exigida:** as duas listas de colunas comparadas por igualdade contra o catálogo já cobrem o
  renome; ao fechar, a suíte de `@sysloc/db` precisa manter a contagem.
- **Por que não agora:** renomeá-la exigiria migração própria sobre tabela já com dado, fora do escopo
  declarado da T6 — e a coluna não é publicada com este nome em lugar nenhum.

### D15 · baixo · documentation · T6 · QA

- **Onde:** `packages/db/test/boleto-da-cobranca.spec.ts:346`
- **Problema:** o docblock de `DATA_DA_REPETICAO`/`VALOR_DA_REPETICAO` declara alcance de **um caso só**
  (*"o que o provedor informa na repetição do `CT-922 (b)`"*), e hoje há **três** consumidores: o
  `CT-922 (b)`, o `CT-924 (d)` (desde a rodada 2) e o `CT-922 (d)` (rodada 3). No `CT-922 (d)` não há
  repetição alguma — a cobrança cancelada nunca foi paga, não existe "primeira baixa" com que coincidir,
  e a razão declarada não se aplica.
- **Impacto:** nenhum no comportamento. Induz o leitor a crer que o par é exclusivo daquele caso — e é
  exatamente o tipo de frase que a **T12** lerá. É a classe *alcance declarado vencido* (a mesma do
  `BAIXO-002` desta task), **não** a de premissa falsificada por medição.
- **O que fazer:** generalizar para *"o que o provedor informa quando a liquidação NÃO deve produzir
  efeito"*, preservando o parágrafo do mecanismo como razão **específica** do `CT-922 (b)`, nomeadamente
  marcada como tal. Alternativa equivalente: manter o nome e acrescentar uma linha declarando os três
  consumidores.

### D16 · MEDIO · project_pattern · T6 · Tech Review

- **Onde:** `packages/db/src/` — seis pontos: `cobranca.ts:492` (`predicadoDaCarteira`),
  `conferencia-bancaria.ts:460`, `emissao-em-lote.ts:614`, `envio-de-cobranca.ts:422`,
  `esquema/negocio.ts:1097` (índice parcial, pareado com `migracoes/0009_dominio_cobranca.sql:148`) e
  `boleto-da-cobranca.ts:512-514`
- **Problema:** a definição executável de *em aberto* (`pago_em IS NULL AND cancelado_em IS NULL`) tem
  **seis cópias livres**. O **limiar de três** do `CLAUDE.md` está estourado, e a razão que a convenção
  dá — *"com duas cópias, endurecer uma deixa a outra para trás"* — é **literalmente o que produziu o
  `TR-P1` desta task**: `selecionarCobrancasAConferir` tinha as duas condições, `liquidarPeloProvedor`
  tinha uma.
- **Impacto:** **nulo hoje** — a união `DesfechoDaLiquidacao` está fechada nesta versão, e o fecho foi
  verificado pelo Gate 2 saída a saída. O risco é de **reincidência da mesma classe**, com custo
  multiplicado por seis: uma terceira condição de estado no futuro reabre o problema em seis lugares de
  uma vez.
  > ⚠️ **A T6 REDUZIU a divergência, não a criou** — ela completou a cópia parcial. O que ficou aberto é
  > a **topologia**, que a §5 do Protocolo Antirregressão manda atacar no lugar da ocorrência.
- **O que fazer:** extrair um fragmento `predicadoDeCobrancaEmAberto` e consumi-lo nos seis pontos,
  mantendo o índice parcial do `0009` pareado por comentário (a migração é **imutável**).
  `cobranca.ts:492` já expressa a definição como fragmento `tx` tagueado, então a forma é exequível.
- **Por que não agora:** corrigir dentro da T6 tocaria **cinco arquivos não declarados**, violando a
  proibição #5 do Protocolo Antirregressão e a regra 3 do `CLAUDE.md`.
- **Gatilho:** a **sétima cópia**, ou a **primeira alteração da definição de *em aberto***.

### D17 · BAIXO · project_pattern · T6 · Tech Review

- **Onde:** `packages/db/src/index.ts:446` e `packages/db/test/unidade-de-trabalho.spec.ts:1366`
- **Problema:** os dois docblocks descrevem a guarda de `liquidarPeloProvedor` como *"cobrança já paga
  não é repaga"* — metade da definição, agora que o predicado tem duas condições. **Nada do que está
  escrito é falso**: a frase descreve corretamente a metade `pago_em IS NULL`. O que venceu é o
  **alcance**.
- **Impacto:** baixo e diferido, mas pesa mais que a média porque `index.ts` é o **barril** — é o
  docblock que a **T12** lê primeiro ao importar a porta. O leitor que não abrir `boleto-da-cobranca.ts`
  conclui que a cobrança cancelada não é alcançada pela guarda, que é justamente a leitura que produziu
  o `TR-P1`.
- **O que fazer:** trocar por formulação que nomeie as duas metades (ex.: *"cobrança que não está em
  aberto — paga ou cancelada — não é liquidada"*), remetendo à definição de
  `selecionarCobrancasAConferir`. Dois arquivos, **prosa apenas**, sem tocar asserção nem cláusula SQL.
  **Pode ser absorvido na T12**, que abre os dois por outra razão.

### D18 · baixo · project_pattern · T6 · QA (achado sistêmico, rodada 2)

- **Onde:** `packages/db/test/` — dez suítes (`permissao`, `isolamento-bancario`, `contrato`,
  `emissao-em-lote`, `identificador-bancario`, `evento-bancario`, `cadastro-de-pessoa`, `cobranca`,
  `isolamento`, `conferencia-bancaria`)
- **Problema:** o acessório `tentar`/`Resultado<T>` tem **dez declarações idênticas**, medido por
  `grep -rln 'async function tentar<T>' packages/db/test/ | wc -l`. O limiar de três disparou há muito.
- **Impacto:** nenhum no comportamento; endurecer uma cópia deixa nove para trás.
  > **A T6 não é a causa e não a agravou** — esta rodada **evitou** a décima-primeira cópia, optando pelo
  > acessório local `recusaDe`, decisão que **os dois gates endossaram**.
- **O que fazer:** subir `tentar`/`Resultado<T>` para casa compartilhada em `packages/db/test/`.
- **Por que não agora:** o fecho tocaria **dez suítes já aprovadas**, todas fora da lista de arquivos da
  task — o *"aproveitar que estou aqui"* que a §4.5 do Protocolo Antirregressão proíbe. É **intervenção
  dirigida**, não escopo de task.

### D19 · BAIXO · project_pattern · T7 · Tech Review

- **Onde:** `packages/contracts/src/integracao-bancaria.ts:399-403`
- **Problema:** `esquemaDoResultadoDaVerificacao` é projeção de **saída** e usa `z.strictObject`, onde a
  `.claude/rules/contrato-publicado.md` prescreve `z.object` — *"a escolha é da direção, nunca do autor
  do esquema"*.
- **Impacto:** baixo hoje e **crescente depois do congelamento da superfície**: acrescentar campo a este
  desfecho passa a ser mudança quebradora para qualquer consumidor que valide a resposta pelo esquema
  publicado — e este pacote é o que o **frontend importa**.
  > ⚠️ **Preexistente ao `base_sha`.** A T7 alterou **apenas** a linha `detalhe`
  > (`z.string().nullable()` → `z.enum(...).nullable()`), que é endurecimento e é o fecho do D27 no lado
  > publicado. **Não é defeito da T7**, e corrigi-lo nela seria o *"aproveitar que estou aqui"* que a
  > proibição 5 do Protocolo barra.
- **O que fazer:** intervenção dirigida — e ao fechá-lo, **varrer as demais projeções de saída de
  `packages/contracts/src/` pela mesma régua**, em vez de trocar esta isoladamente.
  ⚠️ **Não** por `/agent-spec-debt-resolution`: o default `gates: [qa]` dela desliga justamente o Gate 2,
  que é quem enxerga esta classe.

### D20 · baixo · documentation · T7 · QA

- **Onde:** `CLAUDE.md:150` (a tabela de leitura obrigatória, item 6)
- **Problema:** abre com *"33 registradas, 26 `accepted`"*, e `grep -c "^| 00" docs/adr/INDEX.md`
  devolve **34**. A divergência nasceu da inclusão da **ADR-0034** — feita **fora da T7**.
- **Impacto:** o `CLAUDE.md` entra no contexto de **todo** agente: uma contagem vencida pode fazer uma
  fatia futura **não abrir a ADR-0034**, que é justamente a que governa a trilha bancária desta fatia.
- **O que fazer:** sincronizar *"33 registradas"* e a enumeração de `accepted` com o `INDEX.md`.
  ⚠️ **A T17 já reconcilia contagem em prosa** — este débito pode ser absorvido por ela.

### D21 · BAIXO · project_pattern · T7 · Tech Review

- **Onde:** `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:128-132` (e o cabeçalho de
  `packages/cobranca-bancaria/src/porta-de-cobranca.ts`, fora do delta)
- **Problema:** o docblock de `OPERACOES_DA_PORTA_DE_COBRANCA` remete a divergência das quatro operações
  **só à §21.1(1) do tech spec**, e não à **emenda de 2026-08-17** que passou a registrá-la na própria
  ADR-0001. **Nada do que está escrito é falso** — o que mudou foi o mundo ao redor da frase.
- **Impacto:** rastreabilidade. Um agente futuro que abrir o docblock para julgar conformidade vai ao
  tech spec, não à ADR, e pode concluir que a divergência **segue sem registro na fonte canônica** — que
  é precisamente o defeito que esta rodada corrigiu.
- **O que fazer:** numa passagem futura por estes arquivos (**não abrir rodada só para isto**),
  acrescentar a menção à emenda de 2026-08-17, mantendo a remissão à §21.1(1).

### D22 · BAIXO · error_handling · T8 · Tech Review · ✅ **FECHADO na intervenção dirigida de 2026-08-22**

> **Como fechou:** `MOTIVO_DE_VALOR_ILEGIVEL` declarado junto de
> `MOTIVO_DE_LIQUIDACAO_INCOMPLETA`, e os dois ramos separados em `lerSituacao`. A separação é
> feita pela **origem do nulo** — se alguma das chaves declaradas chegou com conteúdo —, e não
> pelo nulo: como data e valor são lidos pelo mesmo par (chaves declaradas + molde), o mesmo
> predicado cobre os dois, e molde novo herda a separação sem código novo. Sob marcador
> `DECISÃO FECHADA`. ⚠️ **A grafia ofensora NÃO entrou no texto**, como o bloco exigia.
>
> **Rede (P4):** o `CT-950` ganhou a linha do **campo ausente** — que é o que torna os dois
> motivos distinguíveis — e a asserção de desigualdade entre eles. As cinco grafias ambíguas
> passaram a esperar o motivo novo, com a linha `SUT_IS_CORRECT_BECAUSE` declarada no ponto:
> elas afirmavam o comportamento que este bloco registrou como defeito. **Nenhum caso removido,
> nenhuma asserção afrouxada** — a tabela ganhou uma linha (`@sysloc/cobranca-bancaria` segue em
> **106**, porque a tabela roda dentro de um `it` só).

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:1238`
- **Problema:** `MOTIVO_DE_LIQUIDACAO_INCOMPLETA` (*"a instituição informou o pagamento sem a data ou sem
  o valor"*) é devolvido **tanto** quando o campo falta **quanto** quando ele veio em grafia recusada
  pelo molde novo. Quando o provedor informa `valorPago: "1.234"`, o valor **foi** informado — o produto
  é que não o lê.
- **Impacto:** baixo hoje (a §13-A.4 mediu o campo como número). Se o provedor mudar a grafia, **toda**
  liquidação recusa com mensagem que aponta o operador para a **direção errada** — ele abrirá a resposta,
  verá o valor lá, e o diagnóstico será longo. É *"a classe do defeito que o P2 fechou, meio aberta"*.
  O próprio arquivo pratica o oposto em toda parte: `MOTIVO_DE_SITUACAO_DESCONHECIDA` e
  `MOTIVO_DE_RESPOSTA_INESPERADA` existem separados **para não colapsar causas**.
- **O que fazer:** declarar `MOTIVO_DE_VALOR_ILEGIVEL` junto de `MOTIVO_DE_LIQUIDACAO_INCOMPLETA`
  (`:822`) e separar os dois ramos em `:1236-1238`. ⚠️ **A grafia ofensora NÃO deve entrar no texto** —
  é dado de terceiro num campo persistido. Uma linha em `GRAFIAS_DO_VALOR_PAGO` do CT-950 cobre a rede.

### D23 · BAIXO · code_quality · T8 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/credencial-de-acesso.ts:84`
- **Problema:** o docblock de `MARGEM_DE_RENOVACAO_S` afirma que *"o custo de tê-la é **uma obtenção a
  mais** na fronteira do prazo"*. Medido: se o provedor declarar `expires_in <= 30`, a condição de
  reaproveitamento **nunca** é verdadeira e o custo passa a ser **uma obtenção por chamada** — o cache
  deixa de funcionar como cache.
- **Impacto:** **nenhum sobre o comportamento** — que é o correto e conservador (credencial a menos de
  30 s do fim não deve ser apresentada a uma chamada com teto de 10 s), e o regime **não é alcançado**
  no prazo medido de 300 s. O custo é de **leitura**: quem diagnosticar um lote obtendo credencial a
  cada boleto lerá *"uma obtenção a mais"* e **descartará a hipótese certa**.
- **O que fazer:** acrescentar ao docblock a frase que declara o regime completo. **Nenhuma mudança de
  código** — a alternativa (cair no padrão de 300 s com prazo curto) seria **pior**, pois apresentaria
  credencial já morta.

### D24 · baixo · documentation · T8 · QA

- **Onde:** `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:1090`
- **Problema:** o docblock de `controleComAsAgulhas` promete distribuir as agulhas *"de propósito entre
  mensagem, pilha e objeto aninhado"*, e o `CT-951` o invoca com **uma** agulha — só a mensagem a
  recebe.
- **Impacto:** **não compromete a prova** (a inspeção profunda é a primeira superfície do espólio e capta
  tanto o controle quanto o alvo). O próximo leitor que reutilizar o helper com 1 ou 2 agulhas **inferirá
  do docblock uma cobertura de três superfícies que a invocação não entrega**.
- **O que fazer:** declarar no docblock que a distribuição em três superfícies vale **quando há três
  agulhas**. Alternativa: fazer o helper repetir a agulha disponível nas três quando a lista for menor.

### D25 · baixo · project_pattern · T8 · QA (PREEXISTENTE — fatia (i))

- **Onde:** `packages/cobranca-bancaria/src/adaptador-sicoob.ts:242` e
  `packages/cobranca-bancaria/src/leitura-do-material.ts:109`
- **Problema:** **`TETO_DO_APERTO_DE_MAO_MS` existe duas vezes no mesmo pacote, com valores DIFERENTES**
  — `10_000` publicado no adaptador, `5_000` **privado** na leitura do material.
- **Impacto:** nenhum hoje (um é publicado, o outro privado). É **exatamente a forma que o limiar de
  três existe para evitar**: dois nomes iguais para tetos distintos, e quem endurecer um deixa o outro
  para trás — ou, pior, presume que são o mesmo.
  > ⚠️ **Nasceu na fatia (i)** e **não está no delta da T8**. Não é regressão desta task.
- **O que fazer:** renomear um dos dois para o que ele de fato mede (o da leitura do material é o teto
  da **abertura do `.pfx`**, não de uma ida ao provedor). **Intervenção dirigida.**

### D26 · baixo · project_pattern · T9 · executor

- **Onde:** `packages/cobranca-bancaria/src/guarda-de-boletos.ts` (cabeçalho, junto do docblock do
  módulo) — marcador `DÉBITO COM GATILHO — D26 · F4/T9`
- **Problema:** **não há expurgo do diretório dos boletos.** Nada no produto remove o arquivo de uma
  cobrança encerrada: `apagar` só é chamado no ato da revogação, e o acervo cresce monotonicamente.
- **Impacto:** projeção de **~1,4 GB/mês** (300 empresas × ~47 boletos/mês × ~100 KB). O disco deste
  host já esteve em ~96%, e `No space left on device` **se disfarça de teste vermelho** — é o modo de
  falha que o cabeçalho de `deploy/scripts/documentos/verificar-isolamento-de-verificacao.sh`
  registra. O dano é de host, não de dado: o arquivo é **cache recuperável**, e a re-obtenção da
  CA-08 torna a perda de qualquer boleto inofensiva.
- **O que fazer:** rotina de expurgo por idade, agendada por `systemd timer`, com o critério ligado ao
  estado da cobrança (liquidada ou cancelada há mais de N meses) e nunca ao arquivo isolado.
- **Prova exigida:** um verificador de shell que meça o diretório antes e depois do expurgo e afirme
  que boleto de cobrança **em aberto** sobrevive — o companheiro negativo sem o qual "apagou" e
  "apagou o que não devia" ficam indistinguíveis.
- **Por que não agora:** expurgo é **rotina agendada**, e rotina agendada é da **F5** pela fronteira
  F4/F5 declarada no discovery. Antecipá-la aqui criaria a primeira unidade de tempo desta fatia sem a
  maquinaria que a F5 traz, e o gatilho — a F5, ou a primeira medição do diretório acima de 20 GB — é
  reconhecível quando chegar.

### D27 · medio · code_quality · T9 · QA (rodada 1)

- **Onde:** `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` — o caso *"a leitura hostil não
  devolve os bytes do vizinho"*
- **Problema:** **duplicata semântica (AP-26)** — o caso está semanticamente contido no de *"nenhum byte
  nasce fora da base"*, que já chama `guarda.ler('../fora')` **e** já afirma
  `readFile(vizinho) === BYTES_DO_VIZINHO`. **3 de 4 campos da tupla coincidem.**
- **Impacto:** nenhum sobre detecção — removê-lo **não reduz** o poder da suíte. É custo de manutenção:
  endurecer um dos dois deixa o outro para trás.
- **O que fazer:** remover o caso, **ou** diferenciá-lo por uma asserção que o outro não faça.
  ⚠️ **Não em rodada de correção**: o executor recusou removê-lo então, e os dois gates concordaram —
  retirar caso verde durante correção é a direção que o **P5** do Protocolo Antirregressão trata como
  suspeita (*"se o total de casos diminuiu, algum teste sumiu"*), e o ganho seria nulo.

### D28 · baixo · documentation · T9 · QA (rodada 2)

- **Onde:** `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts:72` — a seção *"Qual asserção
  DISCRIMINA o defeito"*
- **Problema:** a frase de fecho (*"Nenhuma ordem que consulte o disco antes satisfaz as duas ao mesmo
  tempo"*) **é forte demais para o que o caso (g) sozinho mede**. Existe uma ordem que satisfaz as duas
  metades: gravar/ler **primeiro**, capturar o erro, conferir o caminho **depois** e relançar o erro cru
  do `fs` quando o caminho é válido.
- **Impacto:** **nenhum sobre a rede** — essa ordem é reprovada pelo caso **(d)**, porque com a base
  **presente** ela sobrescreveria `${pai}/fora.pdf` antes de recusar. A rede do CT-947 está **completa**;
  o defeito é de **precisão da prosa**, que credita ao caso (g) uma cobertura que é do par **(d)+(g)**.
- **O que fazer:** trocar a frase absoluta por uma que nomeie a divisão real de trabalho entre os dois
  casos. Custo: uma frase.
  > ⚠️ Registrado apesar de trivial porque o bloqueante da rodada 1 foi, **nesta mesma seção**,
  > *"o docblock afirma que a prova existe"*. O precedente da fatia manda **medir a afirmação, não só a
  > asserção**.

### ~~D29~~ · MEDIO · project_pattern · T9 · Tech Review — ✅ **FECHADO NA T10**

> **Fechado em 2026-08-17, pela T10.** `diferencasDeConjunto` subiu para
> `packages/cobranca-bancaria/test/conjuntos.ts` — casa **local ao diretório**, pelo mesmo caminho que
> `packages/auth/test/conjuntos.ts` percorreu —, e os **três** arquivos do diretório passaram a importá-la
> por `./conjuntos.ts`. O Gate 2 conferiu: **uma** declaração, **três** importadores, corpos idênticos
> linha a linha, e docblock declarando o alcance local e citando o `D28`. **Não havia marcador
> `DÉBITO COM GATILHO` nem linha no índice do `CLAUDE.md`** — era débito anotado, e esta é a única ponta.
> O bloco fica registrado abaixo como histórico.



- **Onde:** `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts:184` (a quarta declaração manual);
  irmãs em `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts:545`,
  `packages/db/test/conferencia-bancaria.spec.ts:538` e `packages/db/test/emissao-em-lote.spec.ts:600`
- **Problema:** **`diferencasDeConjunto` tem 4 declarações manuais**, mais a casa compartilhada
  `packages/auth/test/conjuntos.ts:35` com 3 importadores — **7 consumidores**, contra o limiar de três.
  ⚠️ **A leitura simples ("a casa já existe, basta importar") NÃO procede**: o docblock de
  `conjuntos.ts` declara que ela é **deliberadamente local** ao diretório de `auth`, e alcançá-la de
  `cobranca-bancaria` **contrairia o `D28 · F0/T5`** (importar `test/` de outro pacote por caminho
  relativo profundo).
- **Impacto:** função de **asserção** duplicada. Endurecer uma cópia (ordenação, repetidos,
  normalização) deixa as outras comparando outra coisa, e a divergência aparece como **discordância
  entre casos** — o diagnóstico mais enganoso possível. Já **começou**: as 4 cópias divergem em dois
  dialetos de nomeação (`observado`/`item` × `observados`/`nome`).
- **O que fazer:** criar `packages/cobranca-bancaria/test/conjuntos.ts` e importá-la por `./conjuntos.ts`
  nos **dois** `.spec.ts` do diretório — exatamente o caminho que `auth` percorreu, **sem** fronteira de
  pacote e **sem** tocar o `D28`. As duas cópias de `packages/db/test/` merecem o mesmo tratamento local.
  Promover para `@sysloc/shared` só faz sentido junto com o fecho do `D28`.
  **Intervenção dirigida** — não rodada de correção.

### D30 · MEDIO · code_quality · T9 · Tech Review

- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh` (`garantir_chaves_de_conteudo`),
  `.env.example` e `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`
  (`DIR_BOLETOS_ESPERADO`)
- **Problema:** **dois artefatos da mesma task se contradizem sobre o mesmo cenário.** O provisionador
  justifica manter `DIRETORIO_DOS_BOLETOS` fora da conferência de coordenadas porque ela *"abortaria na
  edição mais legítima que existe — o operador que move o acervo de boletos para um volume próprio"*, e
  promete que *"o verificador confere o resultado"*; o `.env.example` repete a promessa. **O verificador
  fixa `DIR_BOLETOS_ESPERADO="/var/lib/sysloc-boletos"` por extenso e reprova o acervo movido em três
  asserções**, saindo `exit 1`.
- **Impacto:** o operador que executa a ação **sancionada** recebe falha do verificador que os dois
  documentos mandaram rodar, e lê isso como *"a mudança quebrou algo"*. **Prosa operacional falsa em
  procedimento de infraestrutura.**
- **O que fazer:** a correção barata **preserva** o motivo real de o valor ser escrito à mão (não pôr o
  artefato sob prova nos dois lados da comparação): declarar no cabeçalho do verificador que ele mede a
  instalação **padrão**, e que acervo relocado exige ajustar `DIR_BOLETOS_ESPERADO`/`DONO_ESPERADO`/
  `MODO_ESPERADO` no topo — e corrigir a frase do provisionador e do `.env.example` para dizer isso, em
  vez de prometer conferência automática.

### D31 · BAIXO · security · T9 · Tech Review — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19. O bloco *"O NOME É DERIVADO…"* de `guarda-de-boletos.ts` passou a declarar as quatro coisas que faltavam: que a conferência é **léxica** e que `resolve` não resolve vínculos simbólicos; que `ler` (`readFile`) seguiria um vínculo plantado sob a base, enquanto `gravar` (`rename`) e `apagar` (`unlink`) não têm a exposição; que o que fecha esse caminho **não é este módulo**, e sim o **modo `0750` com dono do serviço** já declarado acima — razão pela qual o achado é de declaração ausente, não de vulnerabilidade explorável; e que **`realpath` foi DESCARTADO porque `gravar` opera sobre alvo inexistente**. Esta última é a frase que o débito pedia com nome próprio: sem ela, a rodada seguinte gasta tempo "endurecendo" com `realpath` e quebra `gravar`. O texto ainda nomeia o caminho certo se a exposição deixar de ser teórica (conferir o vínculo **em `ler`**, com `lstat`/`O_NOFOLLOW`). `@sysloc/cobranca-bancaria` **90 verdes**.

- **Onde:** `packages/cobranca-bancaria/src/guarda-de-boletos.ts` — `resolverBoleto` e o bloco *"O NOME É
  DERIVADO, e a conferência do caminho é o SEGUNDO degrau"*
- **Problema:** a conferência é **puramente léxica**. `resolve` normaliza `.`/`..`/separadores mas **não
  resolve links simbólicos**: uma entrada `COB-2026-0000054.pdf` que seja symlink **dentro** da base
  passa nos dois degraus, e `ler` (`readFile`, que segue links) devolveria os bytes do alvo. `gravar`
  (`rename`) e `apagar` (`unlink`) **não** têm a exposição — substituem ou removem o link.
- **Impacto:** ⚠️ **não é vulnerabilidade explorável neste produto** — plantar a entrada exige escrita no
  diretório `0750` do usuário do serviço, que é o próprio processo, e nenhum outro código escreve ali.
  O achado é sobre a **declaração ausente**: o docblock enumera com precisão todas as demais fronteiras
  e omite exatamente esta. A **T14** e a fatia **(iii)** consomem `ler`.
- **O que fazer:** declarar no bloco citado que a conferência é léxica, que `ler` seguiria um link
  plantado sob a base, que o que fecha esse caminho é o **modo `0750` com dono do serviço** (já
  declarado logo acima), e que **`realpath` foi descartado porque `gravar` opera sobre alvo
  inexistente** — sem essa última frase, a rodada seguinte gasta tempo "endurecendo" com `realpath` e
  quebra `gravar`.

### D32 · BAIXO · project_pattern · T9 · Tech Review (escrituração de débito)

- **Onde:** `packages/cobranca-bancaria/src/guarda-de-boletos.ts` — campo `O QUÊ` do marcador
  `DÉBITO COM GATILHO — D26 · F4/T9`, e a §2/D26 acima
- **Problema:** o `O QUÊ` descreve **só** a classe *"boleto de cobrança encerrada"*. Há uma **segunda**
  classe de resíduo no mesmo diretório, criada pela mesma função: o intermediário
  `${caminho}.${randomUUID()}.parcial`. O comentário de `gravar` afirma *"o intermediário não sobrevive
  à falha"* — exato para exceção **capturada**, falso para morte do processo entre `writeFile` e
  `rename` (SIGKILL, OOM, reboot). O órfão fica com **nome sorteado**, invisível a `ler`/`apagar` (que
  só compõem `<codigo>.pdf`).
- **Impacto:** a **F5**, ao implementar o expurgo pelo gatilho do `D26`, lê o `O QUÊ` e escreve uma
  rotina que varre `COB-*.pdf` — deixando os `.parcial` órfãos acumulando **sem que nada acuse**.
- **O que fazer:** acrescentar uma oração ao `O QUÊ` do marcador **e** ao `D26` acima (as **duas
  pontas**, §3-B): o expurgo precisa alcançar também `*.parcial` órfão. Ajustar de passagem o comentário
  de `gravar` para *"não sobrevive à falha CAPTURADA"*.

### D33 · BAIXO · code_quality · T9 · Tech Review

- **Onde:** `deploy/scripts/instalacao/provisionar-base.sh` — `passo_p17_diretorio_dos_boletos()`
- **Problema:** o passo foi inserido **imediatamente após o banner `# ===== # Encerramento. # ===== #`**
  e antes de `resumir()`, criando um segundo banner aninhado sob o primeiro. **A execução está correta**
  — `main()` chama o P17 antes de `resumir` —, mas num script de ~2500 linhas os banners são o
  dispositivo de navegação.
- **Impacto:** legibilidade. O próximo passo (P18) nasce repetindo a inserção errada, ou obrigando a
  mover o P17 primeiro.
- **O que fazer:** mover o bloco para logo depois de `passo_p16_banco_preparado()`, **antes** do banner
  de encerramento — sem alterar a ordem de chamada em `main()`, que já está correta.

### D34 · BAIXO · architecture · T11 · Tech Review — ⚠️ **SISTÊMICO, e o mais grave da §2**

- **Onde:** `packages/cobranca-bancaria/src/emissao-em-lote.ts` (a **origem**, T10) e
  `packages/cobranca-bancaria/src/reemissao.ts` (T11) — a sequência
  `adaptador.emitir` → `guarda.gravar` → `trabalho.gravarEmissao`
- **Problema:** **janela não-transacional PÓS-`emitir`**. Morrendo o processo entre a primeira e a
  terceira chamada, **o provedor tem título vivo e o banco tem as colunas nulas**. O
  `identificadorNoProvedor` do título novo veio de `trabalho.identificador()` e **nunca foi
  persistido**; o preservado pela revogação é o do título **anterior** — **não há chave de correlação
  para o órfão**.
- **Impacto:** ⚠️ **é a métrica nº 1 do PRD que cai.** O cabeçalho do próprio SUT declara que a cobrança
  sem boleto *"é recolhida pelo **LOTE** seguinte, nunca pela conferência"*, porque a conferência **só
  seleciona cobranças COM boleto**. **O lote emite então um segundo título, e passam a existir dois
  pagáveis** — cobrança em duplicidade contra o locatário. Baixa probabilidade (exige morte de processo
  numa janela de milissegundos), **alto impacto**, e **hoje nada no produto detecta o estado**.
  > ⚠️ **NÃO é defeito da T11.** A ordem de `reemissao.ts` está **certa** e não se altera. A mesma
  > sequência existe em `emissao-em-lote.ts` (T10, aprovada pelos dois gates) — é **propriedade
  > sistêmica da fatia**, e por isso a severidade é de **escrituração**, não de bloqueio.
- **O que fazer:** o risco de janela contra terceiro é **inevitável** (não há como tornar *"emitir no
  provedor"* e *"gravar no banco"* atômicos), e a mitigação canônica é **reconciliação** — que está
  planejada (CA-08 / conferência), mas cujo **predicado de seleção exclui justamente a classe que a
  janela produz**. O que falta **não é código**, é o **registro do gatilho**.
- **Gatilho:** **a T12**, ao definir o predicado de seleção da conferência — **ou** ela passa a alcançar
  cobrança em aberto **sem** boleto cujo identificador foi consumido, **ou** o produto aceita por escrito
  o órfão.
  > 🔁 **DECISÃO AUTO-RESOLVIDA (A1) DO ORQUESTRADOR**: em vez de emitir marcador agora, a **T12 é a
  > próxima task** e é **exatamente o gatilho** — este débito vai **injetado no prompt dela**. Se a T12
  > decidir **não** fechá-lo, o executor de lá emite o `DÉBITO COM GATILHO` no ponto do código e a linha
  > no índice do `CLAUDE.md`. **Razão**: marcador que a próxima task vai remover em seguida é churn;
  > injetar no prompt alcança quem decide, na hora em que decide.

### D35 · BAIXO · project_pattern · T11 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/reemissao.ts` (cabeçalho do módulo, junto de
  `sondarAConfirmacao`) e `tech_spec.md` §21.3
- **Problema:** o **candidato parcial a ADR** (4 de 5 critérios; falha o **C3**, custo de reversão) —
  *"o ato composto contra terceiro assíncrono **sonda a confirmação antes de prosseguir**"* — declara o
  gatilho *"se a fatia (iii) repetir a forma, o C3 muda de resposta"*, mas o registro mora **só** no
  docblock e na tech spec. ⚠️ **A fatia (iii) implementa o carnê e a notificação recebida, e não tem
  razão para abrir `reemissao.ts`.**
- **Impacto:** a fatia (iii) **decide do zero** se registra ADR, **sem saber que houve decisão** e que o
  C3 estava **condicionado à repetição dela**. É a **R3** — a regressão de decisão que a
  `nao-regressao.md` declara ser a mais cara justamente por **não ser pega por compilador, suíte nem
  gate**.
  > ✅ **NÃO é falha do executor**: a `agent-spec-adr-workflow-rules.md` manda documentar em tech
  > spec/scope quando um critério falha, **e ele documentou**. O que falta é o **veículo da §3-B** para
  > atravessar a fronteira de fatia. Virou `rule_candidate` (`convention_drift`).
- **O que fazer:** `DÉBITO COM GATILHO` em `reemissao.ts` junto de `sondarAConfirmacao`, com
  `QUANDO FECHA:` = *a fatia (iii) adotar a mesma forma para a notificação recebida*, mais a linha no
  índice do `CLAUDE.md`. ⚠️ **NÃO promover a ADR agora** — o gate foi explícito: *"o C3 falha
  honestamente (um consumidor, reverter é trocar o corpo de uma função), e ADR prematura é o 'cemitério
  de decisões triviais' que a própria rule adverte"*.

### D36 · baixo · documentation · T11 · QA (rodada 2)

- **Onde:** `packages/cobranca-bancaria/test/reemissao.spec.ts:93` — a seção *"Qual asserção DISCRIMINA
  cada defeito"* do cabeçalho
- **Problema:** o contrafactual do `CT-917 (f)` diz que trocar o `return` por `continue` faria a lista
  passar a **nove** confirmações. Traçado contra o SUT, são **dez**: a sondagem recusada, sob `continue`,
  **pula a conferência do teto e a espera**, de modo que aquela iteração **não consome intervalo**.
- **Impacto:** **a discriminação NÃO é afetada** — `2 ≠ 10` reprova exatamente como `2 ≠ 9`, e o `motivo`
  nulo reprova em paralelo. O que está impreciso é **o número escrito num arquivo cujo valor declarado é
  justamente creditar a prova com exatidão**.
- **O que fazer:** trocar *"nove confirmações"* por *"dez"*, **ou** reescrever para *"a lista correria até
  o teto"* sem fixar o número. **Nada muda no código executável.**

### D37 · MEDIO · project_pattern · T12 · Tech Review — ⚠️ **as cópias JÁ divergiram, e no SINAL**

- **Onde:** `packages/cobranca-bancaria/test/conferencia.spec.ts:431` (a **6ª** cópia) e as cinco irmãs em
  `packages/db/test/{conferencia-bancaria,cobranca,envio-de-cobranca,barreira-de-envio,execucao-da-regua}.spec.ts`
  e `apps/worker/test/regua.spec.ts` — **três pacotes**
- **Problema:** `dataDeslocada` chega à **sexta** cópia, muito além do limiar de três. E a divergência que
  a convenção existe para prever **já aconteceu**: cinco cópias compõem com **`+`** (recebendo `dias`
  negativo) e a de `conferencia-bancaria.spec.ts:678` compõe com **`−`** (recebendo `dias` positivo).
  ⚠️ **O docblock da cópia nova declara *"mesma forma"* das duas — e uma delas é o oposto.** A afirmação
  falsa **já existia em cadeia**, e esta task **a propagou em vez de interrompê-la**.
- **Impacto:** ⚠️ **as duas suítes com sinais opostos provam OS DOIS LADOS DO MESMO PREDICADO** (a janela
  de 30 dias) — *"exatamente o par entre o qual alguém moveria uma constante de deslocamento"*. O cenário
  concreto: **mover `DESLOCAMENTO_DO_PAGAMENTO = -5` para a outra suíte produz uma data cinco dias no
  FUTURO, o teste compila, e a janela passa a ser medida do lado errado sem que nada acuse.** Some-se o
  custo estrutural: endurecer uma (fuso, `to_char`, tratamento de `undefined`) deixa **cinco** para trás.
- **O que fazer:** **(a)** corrigir a citação do docblock (`:426-427`) para declarar que a forma casa com
  `envio-de-cobranca.spec.ts` e que `conferencia-bancaria.spec.ts` **compõe com o sinal invertido** — é a
  informação que impede o transplante silencioso; **(b)** escriturar `DÉBITO COM GATILHO` junto de
  `dataDeslocada`, com `QUANDO FECHA` = *o sétimo consumidor, ou a primeira alteração das opções de
  composição da data*, e a linha correspondente no `CLAUDE.md` (27 → 28).
  > ⚠️ **A topologia é DIFERENTE da do D29** (`diferencasDeConjunto`, T10): lá a casa de `auth` era
  > deliberadamente local e **casa irmã resolvia**; aqui as seis cópias **atravessam três pacotes**, de
  > modo que **casa irmã não alcança**, e a promoção depende da fronteira que o **`D28 · F0/T5`** agenda.

### D38 · BAIXO · project_pattern · T12 · Tech Review — ⚠️ **o marcador do D34 lê a emenda AO CONTRÁRIO**

- **Onde:** `packages/cobranca-bancaria/src/emissao-em-lote.ts:381-397` — o `QUANDO FECHA` e o
  `POR QUE NÃO AGORA` do `DÉBITO COM GATILHO — D34`; e o eco na §2 deste relatório
- **Problema:** ✅ **o desfecho do D34 está CERTO** — o Gate 2 abriu a `Decision` da ADR-0001 e as duas
  emendas e confirmou que *"na janela nada foi persistido e o banco não tem chave de correlação alguma"*;
  **a opção (b) é a correta e o débito é legítimo**. ❌ O que está errado é o **texto da perna (2)**, que
  alega ser *"uma quinta operação na porta, que a emenda de 2026-08-17 fixa em quatro"*. **Isso é o
  argumento de contagem que a própria emenda NOMEIA E REJEITA**: *"o roster de cinco NÃO encolheu… ler
  'quatro' como redução do alcance **inverte** a emenda de 2026-08-15, que declara a exclusividade 'de
  critério, e não de contagem'"*. E **não seria capacidade nova**: *consultar* já é uma das cinco;
  perguntar por outra chave é **alargar `ConsultaDeSituacao`** — mudança de **modelo canônico**, não
  contradição de ADR.
- **Impacto:** o gatilho do D34 é *"a fatia que trouxer a notícia recebida do provedor"* — **uma fatia
  futura vai abrir este marcador para decidir**. Lendo *"contra ADR ativa"*, ela pode **descartar de saída
  o caminho que é apenas caro**, e **escalar ao usuário um conflito de ADR inexistente**. É o corolário
  medido do `CLAUDE.md`: *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o
  débito que ela justifica"*.
- **O que fazer:** reescrever a perna (2) para o que **foi medido** — *o órfão não tem chave de
  correlação de espécie alguma; perguntar pelo identificador enviado exigiria alargar
  `ConsultaDeSituacao`, hoje `extends AtoSobreBoleto`, para uma união discriminada, o que é mudança de
  modelo canônico e **não** contradição de ADR* — e **remover do `POR QUE NÃO AGORA` a cláusula "uma delas
  contra ADR ativa"**, deixando as duas barreiras reais (migração sobre `negocio.cobranca` depois da
  `0017`, e o predicado da T5, fechada).

### D39 · BAIXO · code_quality · T12 · Tech Review

- **Onde:** `packages/cobranca-bancaria/src/index.ts:224` (o `export type`) e `src/conferencia.ts:272`
- **Problema:** `EfeitoDaConferencia` é publicado e **não tem consumidor algum** — medido: nada em `apps/`
  ou `packages/` o importa, e a única citação externa é o **inventário da âncora**. Dentro do próprio
  arquivo, **três dos quatro membros nunca são lidos** (o laço só compara `!== EFEITO_QUE_NAO_CONTA`).
- **Impacto:** baixo e contido hoje. ⚠️ **O custo real chega na F5**, quando a superfície for **congelada**
  — símbolo publicado sem consumidor **entra no congelamento** e passa a custar uma decisão para sair.
  > ✅ **NÃO é `speculative_complexity`**: *"a §1 da task nomeia o símbolo entre os públicos, então está
  > dentro do escopo declarado, e o executor escolheu a opção conservadora em vez de divergir por um
  > tipo"*. O barril **já antecipa o desfecho** por escrito.
- **O que fazer:** ao integrar a borda da **T16**, medir se ela nomeia `EfeitoDaConferencia`. **Não
  nomeando**, remover o `export type` do barril e a entrada de `SIMBOLOS_PUBLICADOS` (**41 → 40**),
  mantendo o tipo `export`ado no módulo para uso interno.

### D40 · BAIXO · security · T13 · Tech Review + QA — ⚠️ **os DOIS gates acharam, independentemente**

- **Onde:** `apps/api/src/cobrancas/boleto.service.ts:531` e `:720` — os dois pontos de chamada de
  `semDerrubarODesfecho`
- **Problema:** o argumento passado ao parâmetro `contexto` é o **`preparo` inteiro**
  (`PreparoDoAtoSobreBoleto`), que carrega **`envelopeCifrado`**. O parâmetro **estreita** para
  `{ empresaId, codigo }` e o corpo **lê campo a campo** — ✅ **não há vazamento hoje, medido pelos dois
  gates**.
- **Impacto:** **nulo hoje**; **superfície latente**. ⚠️ *"Por tipagem estrutural do TypeScript, o objeto
  real continua sendo o `preparo`, e um espalhamento futuro (`...contexto`) copiaria as propriedades
  **REAIS**, levando `envelopeCifrado` ao journal **sem que o tipo estreitado avisasse**."* O próprio
  arquivo pratica o critério oposto em `emitir()`, com a razão escrita: *"a ADR-0032 é sobre **não haver o
  que redigir**"*.
- **O que fazer:** trocar `preparo,` por `{ empresaId: preparo.empresaId, codigo: preparo.codigo },` nos
  dois pontos. **Diff de duas linhas, custo zero**, e *"converte a garantia de disciplina escrita em
  garantia de forma"*.
  > ⚠️ **O Gate 2 separou este caso do `TR-P2` explicitamente**, contra a hipótese do orquestrador:
  > *"lá o vínculo é **inevitável** por razão medida — o `ato` atravessa o laço de sondagem e remontá-lo
  > **decifraria por volta**; aqui é um **literal de dois campos**, sem laço nem decifra. **Um se fecha por
  > documentação, o outro por forma.**"*

### D41 · baixo · tests · T13 · QA (rodada 3)

- **Onde:** `apps/api/src/cobrancas/boleto.service.ts:709` — o **segundo** ocupante da entrada única
  (`traduzirEmissaoIncompleta`)
- **Problema:** ele tem rede **apenas do religamento** (o `CT-918` afirma que o evento `EMISSAO_RECUSADA`
  é gravado), **não do engolimento**. ⚠️ *"Um retrocesso que devolvesse só aquele ponto ao
  `await abrirUnidade(...)` cru **atravessaria a suíte inteira**."*
- **Impacto:** baixo. ⚠️ **A classificação foi justificada por três medições, e a terceira é a que
  decide**: *"o único desfecho descoberto exige **derrubar o banco no meio do pedido**, que só se produz
  **dublando `abrirUnidade`** — e a `testing-stack.md` **recusa o dublê por decisão**. **Cobrar rodada por
  isto seria cobrar exatamente a campanha que a rule recusa.**"* **O Gate 2 concordou** e não duplicou o
  achado.
- **O que fazer:** *"registre a impossibilidade **onde a tentação acontece**"* — uma linha no docblock de
  `semDerrubarODesfecho` nomeando que o segundo ocupante é coberto **no religamento e não no
  engolimento**, e por que a stack não o alcança; **ou** `DÉBITO COM GATILHO` cujo gatilho seja **a
  primeira suíte que ganhar abertura de unidade instrumentada**. ⚠️ **É a rede possível que o P4 prevê
  para o defeito não testável na stack.**

### D42 · BAIXO · code_quality · T13 · Tech Review

- **Onde:** `apps/api/src/cobrancas/boleto.service.ts:691-693` — o docblock de `traduzirEmissaoIncompleta`
- **Problema:** ele afirma que *"o estado que o `detalhes` declara é o que as unidades de `reemitirBoleto`
  **já commitaram**"*. O guard é satisfeito por **dois** conjuntos: em `DETALHES_DA_COBRANCA_SEM_BOLETO` a
  frase é **verdadeira**; em `DETALHES_DA_EMISSAO_QUE_NAO_SAIU` — o caminho em que `numeroDoTituloVivo ===
  null` e **nenhuma unidade commitou coisa alguma** — ela é **falsa**. *"No segundo, o `detalhes` é
  verdadeiro por o estado **não ter mudado**, não por ter sido gravado."*
- **Impacto:** nenhum em comportamento. ⚠️ *"Um leitor futuro que confie na premissa para decidir se um
  terceiro efeito acessório entra na entrada única aplicará um critério — **'já commitou'** — que **não é
  o critério real**, que é **'o estado publicado já está decidido, tenha ele sido gravado agora ou
  não'**."*
- **O que fazer:** ajustar a frase para o critério que de fato governa. **Uma linha, sem tocar código.**

### D43 · BAIXO · testability · T14 · Tech Review (rodada 1) — ⚠️ **o defeito que a T14 fechou continua VIVO no molde de que ela nasceu**

- **Onde:** `apps/api/test/documento-do-contrato.e2e.spec.ts`, o acessório `pedirDocumento`
- **Problema:** ali a desserialização do corpo é **gateada pelo `content-type`**. Isso faz `corpo` virar função do
  cabeçalho de mídia, de modo que **toda asserção sobre bytes escrita depois de uma igualdade de `corpo` vira
  consequência lógica dela**, incapaz de reprovar em estado alcançável. É exatamente o **AP-29** que o Gate 1
  apanhou na rodada 1 da T14 — e `pedirBoleto` **nasceu desse molde**.
- **Impacto:** nenhum sobre a T14, que corrigiu a sua cópia e **declarou a divergência por escrito** no docblock.
  O risco é de **memória (R3)**: fechada a fatia, o `_run/` dela deixa de ser lido, e a próxima task que abrir
  aquele arquivo reencontra o defeito do zero.
- **O que fazer:** desacoplar a desserialização do `content-type` em `pedirDocumento`, como a T14 fez em
  `pedirBoleto`, e **reordenar** qualquer asserção de bytes para **antes** da igualdade de `corpo` — a rodada 2 da
  T14 mediu que **desacoplar sozinho não basta**: a implicação sobrevive pelos bytes.
- **Gatilho:** a **próxima task que abrir `documento-do-contrato.e2e.spec.ts` por qualquer razão.**
- ⚠️ **Sem marcador, deliberadamente.** O arquivo está **fora do escopo** da T14 e a regra 3 do `CLAUDE.md` proíbe
  tocá-lo; e replicar lá o docblock de `pedirBoleto` daria **duas cópias livres para divergir** — a mesma razão
  pela qual o `D63 · F4/fechamento` foi corretamente adiado sem um segundo marcador. **Não entra no índice do
  `CLAUDE.md`**, que é derivado dos marcadores vivos.

### D44 · BAIXO · project_pattern · T14 · Tech Review (rodada 2)

- **Onde:** `packages/contracts/test/esquemas.spec.ts:497` (contra a `:88` do mesmo docblock)
- **Problema:** a tabela executável `SAIDAS_DA_FATIA` (`:4335`) passou de **cinco para seis** entradas com o
  `esquemaDaTrilhaDaCobranca`. A prosa subiu **numa ponta** — a `:88` diz *"os SEIS esquemas de SAÍDA"* — e **ficou
  para trás na outra**: a `:497` ainda diz *"aceito e descartado pelos **cinco** esquemas de saída da fatia"*. As
  duas frases descrevem o mesmo conjunto e agora **discordam dentro do mesmo arquivo**.
- **Impacto:** ⚠️ o risco é a **direção inversa**, e a `.claude/rules/ancoras-de-superficie.md` já a nomeia:
  *"número narrativo que fica para trás convida a próxima task a **corrigir a âncora executável para o valor
  errado**"*. Alguém pode reconciliar a **tabela** com o cinco em vez de reconciliar o **texto** com o seis, e a
  entrada do envelope sairia da cobertura do `CT-942` **sem que nada acusasse** — a asserção itera sobre a tabela,
  não sobre a prosa.
- **O que fazer:** reconciliar a `:497` na forma já usada na `:88`. Se a intenção era distinguir *"os esquemas da
  fatia"* (cinco) de *"a tabela inteira"* (seis), **é a distinção que precisa aparecer no texto** — hoje as duas
  frases usam a **mesma redação para números diferentes**.
- **Encaminhado à T17**, que já reconcilia contagem narrativa por definição.


### D45 · baixo · tests · T15 · QA (rodada 2) — ⚠️ **a MESMA forma que a T15 condenou, num caso PRÉ-EXISTENTE do mesmo arquivo**

- **Onde:** `packages/shared/test/fila.spec.ts:381`, no caso da **T9**
- **Problema:** `expect(Object.keys(carga).sort()).toEqual([...])` corre sobre **literal tipado escrito quatro linhas
  acima**. Pela pergunta-gate do AP-29 é infalível: campo obrigatório não compila (quem reprova é o `tsc`), e **campo
  OPCIONAL compila, não entra no literal e a mantém verde**. É a forma que o `QA-ALTO-001` da T15 condenou, e agora
  **convive, 300 linhas abaixo, com o docblock que declara essa forma incapaz de reprovar**.
- **Impacto:** ⚠️ **NÃO mascara nada, e isto foi MEDIDO** — a forma real daquela carga é afirmada sobre a **carga
  realmente enfileirada** em `confirmacao-de-email.e2e.spec.ts:472` e `:640`, **nos dois gatilhos**. *"O AP-29 é ALTO
  no catálogo porque **mascara regressão**; aqui a rede existe, falsificável, **fora deste arquivo**."* E **não há
  crédito errado**: a prosa vizinha credita ao **compilador**, e é verdadeira. Resta **incoerência de molde**.
- **O que fazer:** trocar por `camposDeclaradosEm(fonteDoContrato, 'CargaDaConfirmacao')` contra
  `ReadonlyArray<keyof CargaDaConfirmacao>`. ⚠️ **A maquinaria já existe e já foi falsificada no mesmo arquivo.**
  Delta estimado: **~8 linhas**.
- **Gatilho:** a próxima task que abrir `packages/shared/test/fila.spec.ts`, ou intervenção dirigida.
- **Preservar foi julgado CORRETO pelos dois gates** — é contrato de **outra fatia** (`documentos-e-confirmacao`) e
  pré-existente em `HEAD`; corrigi-lo aqui seria a refatoração alheia que a §4.5 proíbe.

### D46 · BAIXO · project_pattern · T15 · Tech Review (rodada 1) — ⚠️ **ESCALADA DE `DECISÃO FECHADA`, resolvida sem espera**

- **Onde:** `apps/api/src/comum/produtor-de-fila.ts:173`, campo `O QUÊ` do marcador `DECISÃO FECHADA — T9 / Gate 2`
- **Problema:** o aposto diz *"rejeição de `enfileirarConfirmacao` e linha dos **dois** ouvintes de `error`"*. Depois
  da T15 são **três** métodos de enfileiramento e **quatro** ouvintes. ⚠️ **A frase-invariante (*"tudo que sai
  daqui"*) continua literalmente verdadeira e alcança os três** — o que envelheceu é **o aposto que a ilustra**.
- **Impacto:** *"um agente que use o aposto como definição do alcance pode concluir que os dois métodos novos **não
  estão sob a decisão** — que é a **R3 chegando pela leitura do próprio marcador**"*. Mantido **baixo** porque o
  `despachar` único e o `criarFila` único tornam a divergência **estruturalmente difícil**, e os `CT-738`/`CT-739`
  do `REVERTER EXIGE` **seguem medindo o caminho por onde as três rotas passam**.
- **O que fazer:** ⚠️ **NÃO editar o marcador.** A escalada foi conduzida na §3 da `.claude/rules/autonomia-do-run.md`
  — texto literal apresentado contra o estado medido, alternativas formuladas, e **adotada a conservadora**, porque
  *"marcador `DECISÃO FECHADA` **não se altera, não se move e não se remove** sob esta autorização; a autorização é
  para **não esperar**, nunca para **contrariar**"*. Atualizar o aposto exige **decisão explícita do usuário**.
- **Gatilho:** decisão do usuário sobre o texto do marcador. **Registro em `_run/workflow-report.md`, seção
  `[T15] ⚠️ ESCALADA DE DECISÃO FECHADA`.**
- **Sem marcador de débito**, deliberadamente: um `DÉBITO COM GATILHO` ao lado de um `DECISÃO FECHADA` sobre o mesmo
  código é a **mistura de naturezas** que a §3-B proíbe por nome.

### D47 · MEDIO · code_quality · T15 · Tech Review (rodada 2) + QA (rodada 3) — ⚠️ **os DOIS gates acharam, independentemente**

- **Onde:** `apps/api/test/alcance-da-fila.spec.ts:2` e `apps/api/src/comum/fila.module.ts:35-41`
- **Problema:** a prosa declara o objeto como *"quem consegue **pôr trabalho na fila** desta aplicação"*, e o módulo
  **credita à âncora a veracidade da própria frase dele**. As três asserções fixam quem nomeia **três símbolos** —
  há um **quarto caminho**: `import { Queue } from 'bullmq'` num módulo de área, **abrindo fila própria sobre conexão
  própria**, que *"põe trabalho na fila sem tocar nenhum dos três"*.
- **Impacto:** ⚠️ contorna **duas** garantias vivas ao mesmo tempo: *"(i) o fecho incondicional das três filas, cujo
  modo de falha declarado é **o processo que não termina no desligamento**; e (ii) a entrada única
  `semRastroDeComando`, protegida pela `DECISÃO FECHADA`, cujo vetor é `err.command.args` **com a carga
  serializada**"*. ⚠️ **Medido**: `bullmq` é importado em **UM** arquivo de `apps/api/src`, e a única restrição
  existente sobre a biblioteca alcança **o manifesto de `@sysloc/shared`, não `apps/api/src`**.
- **O que fazer — duas saídas equivalentes, e o gate recusou a terceira** (*"a divergência **não pode ficar como
  está**"*): **(a)** a prosa passa a declarar **o alcance real**, nomeando o caminho `bullmq` como o que fica de fora
  e por quê — e então ele merece `DÉBITO COM GATILHO` com gatilho concreto (**a segunda importação de `bullmq` em
  `apps/api/src`**); ou **(b)** um quarto eixo na varredura, ⚠️ *"a forma já está instalada (`varrerPor` sobre um
  identificador), e o cabeçalho de `produtor-de-fila.ts` **já afirma por escrito ser a fronteira única com a
  biblioteca** — o eixo apenas tornaria executável o que ele afirma"*.
- ⚠️ **É a MESMA classe que custou SEIS AP-29 a esta fatia**: *"crédito escrito acima do que a linha prova é o que
  autoriza a rodada seguinte a confiar nele"* — e **aqui o crédito está ENCADEADO** (o módulo cita a âncora, a âncora
  afirma alcance total).
- **Encaminhado à T17**, que reconcilia prosa e contagem por definição. **Anotável pela partição** (`code_quality`),
  e o Gate 2 **aprovou** — não bloqueia.

### D48 · BAIXO · testability · T15 · Tech Review (rodada 2)

- **Onde:** `apps/api/test/produtor-de-fila.spec.ts`, o comentário do `CT-739 (b)`
- **Problema:** a razão escrita diz que a asserção rejeita *"um registro que mantivesse a chamada saneada e
  acrescentasse a causa crua **ao lado**"* — mas `VALOR_DA_CHAVE_DE_ERRO` casa a **primeira** ocorrência e nada
  afirma sobre as demais chaves: `{ erro: semRastroDeComando(…), causa: fecho.reason }` **passa verde**. *"A
  alternativa rejeitada e a escolhida têm o mesmo furo, e a razão dada não as separa."*
- **Impacto:** **baixo por medição** — o Gate 1 verificou **no fonte do `bullmq@5.81.3`** que `close()` sobre conexão
  **compartilhada** não emite comando algum, *"de modo que `fecho.reason` praticamente não existe"*. A forma
  dominante do defeito está fechada, e **o mutante G a prova**.
- **O que fazer:** alinhar o comentário ao que a asserção discrimina, **ou** estender a asserção ao objeto registrado
  inteiro. ⚠️ *"O `CT-739 (a)`, no mesmo arquivo, **já aplica a lição oposta e a escreve por extenso**"* —
  `toEqual([])`, *"fechar só a chave conhecida deixaria passar a próxima"*. **O par já está instalado ao lado.**
- **Encaminhado à T17.**

### D49 · BAIXO · code_quality · T16 · executor (rodada 1)

- **Onde:** `apps/worker/src/tarefas/carga-da-tarefa.ts` (marcador no cabeçalho)
- **Problema:** a tradução de `ZodError` em **nome de campo recusado** existe em **3 cópias**. Esta entrada é a casa
  nova, criada pelo **limiar de três** do `CLAUDE.md` — *"sem ela, a tradução ganharia a 3ª e a 4ª cópia no mesmo
  processo"*. ⚠️ A entrada única **nomeia a chave excedente**, o que **as cópias antigas não fazem**.
- **Impacto:** as cópias remanescentes (`regua.ts`, `confirmacao-de-email.ts`) **não nomeiam a chave excedente** —
  endurecer a casa nova deixa as duas para trás.
- **O que fazer:** migrar as duas cópias para `cargaConferida`.
- **Gatilho:** a **primeira task autorizada a abrir `regua.ts` ou `confirmacao-de-email.ts`** — ⚠️ **ambas marcadas
  `[R]` na §3.4**, portanto fora do alcance da T16.

### D50 · BAIXO · code_quality · T16 · executor (rodada 1)

- **Onde:** `apps/worker/src/tarefas/emissao-em-lote.ts`, junto de `dadosDaEmissao`
- **Problema:** a **projeção do pedido de emissão** está duplicada com `BoletoService.lerDadosDaEmissao`
  (`apps/api/src/cobrancas/boleto.service.ts`). Duas definições da **mesma lista de campos enviados ao provedor**,
  em processos diferentes.
- **Impacto:** alterar os campos de um lado **não reprova nada** do outro; o lote e a emissão avulsa passariam a
  enviar pedidos diferentes ao mesmo provedor **sem que a suíte acusasse**.
- **O que fazer:** subir a projeção para casa compartilhada (`@sysloc/db` ou `@sysloc/cobranca-bancaria`), com
  âncora de igualdade de conjunto sobre os campos.
- **Gatilho:** o **3º consumidor**, ou a **1ª alteração dos campos enviados**.

### D51 · BAIXO · project_pattern · T16 · executor (rodada 1)

- **Onde:** `apps/worker/src/main.ts`, junto de `ehChaveDeCifraAceitavel`
- **Problema:** `ehChaveDeCifraAceitavel` e `ehDiretorioGravavel` têm **duas definições** — a do worker e as gêmeas
  de `apps/api/src/configuracao/ambiente.ts:101` e `:139` —, e **os dois processos sobem do MESMO `EnvironmentFile`**.
  ⚠️ O Gate 2 mediu que são **cópias exatas**, e que as conferências *"são cobradas **nominalmente** pela tech spec"*
  (`:530` e `:859`) — **não são complexidade especulativa**.
- **Impacto:** endurecer a forma aceita de um lado deixa o outro aceitando o que o primeiro passou a recusar, **sobre
  o mesmo arquivo de ambiente**.
- **O que fazer:** subir as duas para `@sysloc/shared/ambiente.ts`, casa canônica das conferências de partida.
- **Gatilho:** a **primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`** — ⚠️ **área crítica
  (`secrets/config`), fora da §5 da T16**, que foi a razão declarada de não fazê-lo agora.

### D53 · BAIXO · security · T16 · Tech Review (rodada 1) — ⚠️ **risco ESTRUTURAL medido, e os DOIS gates o refinaram** — ✅ **RESOLVIDO** (intervenção dirigida de 2026-08-19)
- **Status:** ✅ **RESOLVIDO** — intervenção dirigida de 2026-08-19, nas **duas** pontas que o débito pedia, e o desenho de `log.ts` segue **inalterado**. (1) A **nota de fronteira** entrou na ADR-0032, sem tocar a `Decision`: uma tabela que separa os dois eixos da redação — a **forma do valor** (`ArrayBuffer.isView`, alcança o material, não depende do nome) e o **nome da chave** (`ehChaveSensivel`, alcança a senha) —, a consequência para quem abrir a próxima superfície, e o que ela obriga: medir a saída **por valor, não por nome de campo**. Ela preserva o estreitamento que o Gate 2 fez sobre o Gate 1, e adverte por escrito para não repetir a formulação larga. (2) O **marcador nasceu** junto de `redigirErro`. Ele faltava *"deliberadamente, porque o alvo estava fora do escopo da T16"* — e este é o registro de que **essa é a única razão que caiu**: a intervenção abriu `log.ts` por outra razão (o `D23 · F0/T3`) e deu ao débito a morada que a §3-B exige. `@sysloc/shared` **249 verdes**.

- **Onde:** `packages/shared/src/log.ts` → `redigirErro` (`:588-618`) e `redigirValor` (`:555-558`)
- **Problema:** `redigirErro` **copia as propriedades próprias enumeráveis** da exceção e decide o mascaramento por
  `ehChaveSensivel(chave)` — **pelo NOME DA CHAVE**. Uma exceção que carregasse segredo sob **nome neutro**
  (`argumentos`, `contexto`, `opcoes`) **escaparia desse eixo**. ⚠️ *"É a **forma exata do achado da fase
  anterior**."*
- **Impacto — e aqui o Gate 2 CORRIGIU o Gate 1, medindo no fonte:** o Gate 1 escreveu que *"material `.pfx` em
  base64 e senha chegariam legíveis"*. **O Gate 2 estreitou**: *"`redigirValor` **intercepta
  `ArrayBuffer.isView(valor)`** e emite **forma e tamanho, NUNCA os bytes** — de modo que **o MATERIAL, que viaja
  como `Buffer`, é redigido pelo TIPO e independe do nome da chave**. O que resta dependendo do eixo por nome é a
  **SENHA** (cadeia), e um material que alguém convertesse a base64 antes de anexar."* ⚠️ **A afirmação vale para a
  senha, não para o material em sua forma real.**
- **Nenhum vazamento hoje** — a saída real medida sai limpa (`CT-944 (e)`, `CT-948 (e)`).
- **A rede existente e o que ela NÃO alcança:** `ocorrenciasDe` busca os **valores** das agulhas em **todas as
  chaves de toda linha**, sem olhar nome de chave — *"se amanhã uma exceção carregar o claro sob nome neutro, os
  dois casos **REPROVAM**"*. ⚠️ **Mas ela pega o defeito só nas DUAS bordas medidas**; *"não alcança uma exceção
  nova em **OUTRA** superfície que use o mesmo registrador"*.
- **O que fazer:** ⚠️ **NÃO corrigir `log.ts` por esta task** — as três razões do Gate 1 **procedem** e o Gate 2 as
  ratificou: *"o alvo está fora do delta e fora da §5, o desenho dele é **decisão registrada**, e alterá-lo seria o
  'aproveitar que estou aqui' que a §4.5 proíbe"*. O que se faz é **registrar onde alcance quem abrir a próxima
  superfície** — esta entrada, e a nota na própria **ADR-0032**, *"que é o documento que a fatia seguinte abre ao
  cobrar a medição nova"*.
- **Gatilho:** a **próxima superfície que decifre o segredo operável**, ou a **primeira exceção do produto que anexe
  campo próprio não coberto por `RADICAIS_SENSIVEIS`**.
- **Sem marcador**, deliberadamente: o alvo (`log.ts`) está **fora do escopo desta task**, e a §3-B manda o marcador
  morar **onde a tentação acontece** — escrevê-lo num arquivo que a T16 não pode tocar seria contrariar a regra 3 do
  `CLAUDE.md`. Mesma conduta do `D43`.

### D52 · BAIXO · project_pattern · T16 · executor (rodada 2)

- **Onde:** `apps/worker/test/varredura-de-segredo.ts` (cabeçalho, junto do marcador) e
  `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (`ocorrenciasDe`, `controleComAsAgulhas`,
  `rotulosDoControle`, `canalDeControle`, `recorteEmHexadecimalDe`).
- **Problema:** o molde da varredura de segredo com controle positivo passou a existir **duas** vezes — o
  acessório novo do processo de trabalho e a cópia privada da suíte da borda HTTP. O acessório nasceu porque a
  correção do `ALTO-002` teria criado a **terceira** cópia (as duas suítes do worker), e o limiar de três do
  `CLAUDE.md` manda o símbolo subir em vez de ganhar a terceira.
- **Impacto:** endurecer a busca de um lado — uma normalização nova, um canal de controle novo — deixa o outro
  para trás, e a divergência sai como medição que **aprova num processo o que reprovaria no outro**, numa fatia
  cujo eixo é segurança.
- **O que fazer:** subir a metade comum para `packages/shared/test/`, deixando em cada consumidor só o que é
  próprio dele (as superfícies de uma resposta HTTP, as agulhas do ato vencido e a operação de controle do
  documento publicado, em `apps/api`).
- **Gatilho:** o terceiro consumidor fora de `apps/worker/test/` (a fatia (iii), do carnê, é a candidata), ou a
  primeira alteração das formas buscadas por `ocorrenciasDe`.

### D54 · medio · tests · T16 · QA (rodada 2) — `vague_existence_assertion`

- **Onde:** `apps/worker/test/emissao-em-lote.spec.ts` (`CT-944 (e)`, a metade *"REGISTROU"*).
- **Problema:** a asserção que prova o registro do desfecho **não discrimina qual caso registrou** — ela pergunta
  se o diário tem linha, não se tem *aquela* linha.
- **Impacto:** ⚠️ **Ela não é tautológica, e a distinção importa**: com o diário vazio a asserção reprova, então
  ela prova alguma coisa. O que ela não prova é a **atribuição** — um registro emitido por outro percurso do mesmo
  arquivo a satisfaria, e a prosa credita à linha uma discriminação que ela não tem.
- **O que fazer:** recortar o diário a partir do ponto de partida do caso (`linhas.slice(linhasAntes)`), ou afirmar
  o `loteId` como discriminante dentro da linha encontrada.

### D55 · medio · tests · T16 · QA (rodada 2) — `vague_existence_assertion` · **espelho exato do D54**

- **Onde:** `apps/worker/test/conferencia-bancaria.spec.ts` (`CT-948 (e)`, a metade *"REGISTROU"*).
- **Problema:** o mesmo do `D54`, na borda irmã — as duas suítes nasceram do mesmo molde e herdaram a mesma
  imprecisão.
- **Impacto:** idem. ⚠️ **Corrija as duas na mesma passada**: fechar uma só reinstala, entre bordas espelhadas, a
  assimetria que a rodada 3 desta task gastou uma correção inteira para eliminar no código de produção.
- **O que fazer:** `linhas.slice(linhasAntes)`, ou o `conferenciaId` como discriminante.

### D56 · baixo · tests · T16 · QA (rodada 2) — `cleanup_in_afterEach`

- **Onde:** `apps/worker/test/conferencia-bancaria.spec.ts` (`CT-948 (c)`).
- **Problema:** a limpeza da conferência aberta está **no fim do corpo do caso**, não num gancho de encerramento.
- **Impacto:** se qualquer asserção acima dela reprovar, a limpeza não roda — e **a conferência aberta segura o
  índice único parcial `(empresa_id) WHERE concluida_em IS NULL`**, de modo que o caso seguinte falha **por
  precondição**. O sintoma aponta para o caso errado e esconde a reprovação verdadeira.
- **O que fazer:** mover para `onTestFinished`, **que o arquivo já importa** — o diff é de duas linhas.

### D57 · baixo · documentation · T16 · QA (rodada 3) — a MESMA classe do `QA-BAIXO-001` desta task

- **Onde:** `apps/worker/test/emissao-em-lote.spec.ts:677` (comentário do `CT-944 (f)`).
- **Problema:** o comentário diz *"as **três** asserções seguintes"* onde seguem **quatro**.
- **Impacto:** ⚠️ **É a terceira ocorrência do mesmo padrão nesta única task** (o nome do `CT-936` dizia "nove"
  onde eram quinze; a §5.2 dizia "cinco campos" onde são quatro): **numeral em prosa divergindo do código que ele
  nomeia, no texto que o próximo agente lê primeiro**. Numeral que envelhece convida a "corrigir" o código para
  caber nele.
- **O que fazer:** o Gate 1 preferiu **nomear explicitamente o recorte de cada metade** a acertar o numeral — é a
  disciplina já praticada no `CT-936` deste mesmo run, e ela não pode envelhecer.

### D58 · BAIXO · code_quality · T16 · Tech Review (rodada 2)

- **Onde:** `apps/worker/src/tarefas/emissao-em-lote.ts` (`comReentranciaBenigna`, junto da assinatura).
- **Problema:** o parâmetro de tipo é **irrestrito** (`<T>`), enquanto o contrato da função reserva `undefined`
  como sinal **exclusivo** de reenvio benigno — reserva que hoje vive só no docblock e no `@returns`.
- **Impacto:** ⚠️ **Hoje inexistente, e o gate verificou os dois consumidores um a um**: no percurso do domínio `T`
  infere `DesfechoDoLote`, que é `interface` e nunca `undefined`; no da interrupção infere o literal `true`. O
  custo é do **terceiro** consumidor: um `percurso` que devolva `X | undefined` faz `T | undefined` **colapsar em
  `T`**, o `=== undefined` de quem chama deixa de discriminar, e **o caso GRAVE — o lote que não existe — passaria
  a ser lido como reenvio benigno**. É o modo de falha que o `CT-944 (d)` e o `CT-944 (f)` acabam de fixar,
  reaberto por um caminho que a suíte não alcança porque ele ainda não tem consumidor — *"sem erro de compilação e
  sem caso vermelho, exatamente a assinatura da R2/R3"*.
- **O que fazer:** restringir para `<T extends NonNullable<unknown>>`. Os dois consumidores atuais satisfazem a
  restrição **sem qualquer outra alteração**, de modo que o diff é de uma linha e o corpo continua byte a byte o
  mesmo. ⚠️ **Prefira `NonNullable<unknown>` a `{}`** — o Biome deste repositório baniria a segunda forma. Uma
  frase no `@returns` ligando a restrição ao sentinela dispensa o leitor de deduzi-la.
- **Gatilho:** o **terceiro consumidor** de `comReentranciaBenigna`, ou a primeira alteração do contrato do
  sentinela.

### D59 · medio · tests · T17 · QA (rodada 1) — `vague_existence_assertion` · ⚠️ **o caso irmão do MESMO diff resolve melhor**

- **Onde:** `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:619`.
- **Problema:** o piso antivácuo das chaves do documento publicado é `expect(chaves.length).toBeGreaterThan(0)`.
- **Impacto:** `chavesDoDocumento()` desce em profundidade e produz **milhares** de chaves, de modo que um
  documento degenerado — `{ openapi: '3.0.0' }`, ou um que perdesse a seção `paths` inteira — **satisfaz o piso** e
  faz a varredura de baixo devolver `[]` **por vacuidade sobre uma superfície que não é mais a superfície**. ⚠️ O
  `CT-945`, **desta mesma task**, resolve o mesmo problema com `toBeGreaterThanOrEqual(ROTAS_DESCRITAS)` e registra
  a razão por escrito (*"o piso é a superfície que o `CT-327` já percorre, e não um `> 0`"*) — a divergência é do
  mesmo diff.
- **O que fazer:** ancorar o piso numa grandeza da superfície — afirmar que os **caminhos** do documento
  (`Object.keys(documento.paths)`) alcançam ao menos a cardinalidade que o `CT-945` já usa — e só então varrer as
  chaves em profundidade.

### D60 · MEDIO · project_pattern · T17 · Tech Review — ⚠️ **a 4ª cópia nasceu na task que o marcador nomeava como dona do fecho**

- **Onde:** `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts:400-411` (a 4ª cópia); as outras três em
  `automacao-de-cobranca.e2e.spec.ts`, `autorizacao-do-dominio.e2e.spec.ts` e `equivalencia-com-o-oraculo.spec.ts`.
- **Problema:** a montagem instrumentada (`Test.createTestingModule → overrideProvider → createNestApplication →
  setGlobalPrefix → listen`) ganhou a **quarta** cópia literal. O `QUANDO FECHA` do `D57 · F3/T12` nomeia como dono
  *"quem abrir a PRÓXIMA suíte que precisar da montagem instrumentada"* — e a T17 é exatamente quem abriu.
- **Impacto:** ⚠️ **A abstenção do executor conflata duas coisas distintas.** O argumento da Proibição 5 *"procede
  para o **fecho integral**, mas não para a decisão de **acrescentar a quarta cópia**: existia caminho intermediário
  que não toca arquivo algum fora do escopo"*. As quatro montagens já divergem de `criarAplicacao()` em cinco pontos
  (`logger: false`, `abortOnError: false`, o `exclude` do prefixo, `publicarContrato()`, `enableShutdownHooks()`), e
  **nenhuma asserção acusa a divergência** — uma correção futura passa a exigir **quatro** edições coordenadas, e a
  que ficar para trás **falha em silêncio**.
- **O que fazer:** extrair a montagem para um acessório único de `apps/api/test/` (por exemplo
  `aplicacao-instrumentada.ts`, parametrizado pelo par token/dublê e devolvendo `{ aplicacao, base }`) e consumi-lo
  **apenas** do arquivo novo. **Nenhum dos três anteriores é tocado**, de modo que a Proibição 5 não é contrariada;
  os anteriores migram quando forem abertos por outra razão.
- **Nota de escrituração:** o `P2` que acompanhava este achado **foi resolvido nesta passada** — o marcador do `D57`
  em `autorizacao-do-dominio.e2e.spec.ts` foi re-baselinado (quatro cópias nomeadas, o dono re-designado e o caminho
  intermediário escrito no `QUANDO FECHA`), e a linha do índice do `CLAUDE.md` acompanhou. O detalhe **não** foi
  levado à §2 do `run-report.md` da fatia `regua-de-cobranca`: relatório de fatia fechada é registro histórico e
  **não se reescreve** (§3-B).

### D61 · BAIXO · testability · T17 · Tech Review — ⚠️ **disparo CERTO, não provável**

- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts` (as 10 chamadas a
  `pessoaOperandoComSenhaTrocada`); o marcador que governa o fecho é o `DÉBITO COM GATILHO — D27 · F1/T6`, em
  `packages/auth/src/autenticacao.ts`.
- **Problema:** o `CT-941` consumiu a **décima** vaga do limitador de `/change-password`, cuja chave é
  `no-trusted-ip|/change-password`. O arquivo fica **saturado em 10/10 por minuto**.
- **Impacto:** ⚠️ **a próxima pessoa criada nesse arquivo recebe `429` no arranjo.** A falha é **ruidosa** (o
  acessório levanta com o status), então **não há risco de teste verde mentindo** — o custo é uma rodada de
  diagnóstico, *"porque o sintoma não sugere o teto por minuto de um limitador cuja chave ignora a origem"*. O
  `CT-941` já faz a única mitigação disponível no escopo: reusa a sessão do `CT-319` para o sujeito sem a área
  (lendo o efetivo, sem escrever ajuste) e documenta a saturação no docblock.
- **O que fazer:** acrescentar ao `QUANDO FECHA` do marcador do `D27 · F1/T6` o segundo gatilho já materializado —
  *"ou a próxima pessoa criada em `apps/api/test/autorizacao-do-dominio.e2e.spec.ts`, que já gasta 10 das 10 trocas
  por minuto"*. ⚠️ **Não foi feito nesta passada de propósito**: o alvo é `packages/auth/src/autenticacao.ts`,
  arquivo de produção **fora** do escopo da T17, e escrever nele contrariaria a regra 3 do `CLAUDE.md`. **Mesma
  conduta do `D53` e do `D43`.** O fecho definitivo permanece com o `D27` (a publicação atrás do servidor de borda
  na F7, que dá ao limitador um eixo de origem) e está fora do alcance desta fatia.

### D62 · BAIXO · code_quality · T17 · Tech Review — a MESMA classe que a rodada 1 desta task pagou

- **Onde:** (a) `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`, comentário do `CT-937`; (b)
  `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts`, comentário do eixo negativo do `CT-934`.
- **Problema:** dois comentários creditam às asserções um modo de falha que elas não têm. Em **(a)**, o texto diz
  que um caminho mudado no fonte *"reprova como excedente"*, mas a asserção filtra por
  `PARES_DA_FATIA_DE_EMISSAO.includes(par)` — o filtro produz **por construção** um subconjunto do esperado, de modo
  que **excedente é impossível**; ele reprovaria como **ausente**. Em **(b)**, o exemplo concreto escolhido (a
  varredura invertida, `agulha.includes(texto)`) **não** satisfaz as quatro igualdades: `'codigobeneficiario'`
  contém `'codigo'`, e o primeiro canal já reprovaria.
- **Impacto:** ⚠️ **nenhum sobre a detecção** — as duas asserções são sólidas, e em (a) o excedente é coberto pela
  igualdade da superfície total no mesmo caso; em (b) **a classe abstrata existe e a decisão de mover está
  correta**. O custo é de leitura: *"um agente futuro que confie no crédito literal conclui que a igualdade filtrada
  já cobre o excedente… ou que o varredor invertido é o alvo do eixo negativo (e o removeria ao 'provar' que a
  direção invertida reprova antes)"*. É a **mesma classe** que rejeitou a rodada 1 desta task e que custou nove
  AP-29 à fatia — desta vez sem consequência sobre a prova, mas com a mesma origem.
- **O que fazer:** (a) trocar *"reprova como excedente"* por *"reprova como ausente, e o excedente é coberto pela
  igualdade da superfície total mais abaixo neste caso"*; (b) substituir o exemplo pelo predicado que **de fato**
  discrimina — `texto === '' || texto.includes(agulha)`, o varredor que trata cadeia vazia como casamento.


## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

- **O achado que mais valeu a rodada extra da T1 é do tipo que a suíte não pega.** Em `publicar()`, os
  cinco `null` estavam **depois** do `...linha` e venciam por precedência de propriedade. Hoje inócuo
  (a `LinhaDeCobranca` tem dezoito campos). Mas a **T6** é justamente quem estende `LinhaDeCobranca`
  com esses cinco campos: se ela estendesse e esquecesse de remover `publicar`, a API passaria a
  **descartar em silêncio** o dado de boleto vindo do banco — cobrança emitida aparecendo como não
  emitida, cobrança creditada como não creditada — **com a suíte inteira verde**, porque a âncora do
  e2e afirma o *conjunto de chaves*, não os valores. A correção (inverter a ordem) faz a construção
  temporária se auto-neutralizar, e a rede nova (`CT-514 (d)`) reprova se alguém a reverter.
- **A T1 precisou tocar três arquivos fora da §5.2 dela**, e a razão é medida, não preferência —
  ver o **D2**. Os dois gates concordaram que não é alargamento de escopo.
- **O plano de tasks não previu o crescimento das âncoras de `apps/api/test/`** ao publicar os cinco
  campos: nem a T6 nem a T13 declaram `cobrancas.e2e.spec.ts` na §5.2. Vale conferir ao abrir a T6,
  para que ela não descubra o arquivo pela suíte vermelha.
- **Duas verificações independentes convergiram no ponto mais delicado da task.** O executor
  substituiu metade do **CT-545** (âncora preexistente), o que é território clássico de AP-24
  (*weakening test to pass*). QA e Tech Review examinaram o código antigo contra o novo, em separado,
  e ambos concluíram que a forma nova é **estritamente mais forte** no eixo que o caso existe para
  provar — varre dois consumidores contra um, mantém a igualdade e preserva a propriedade de nomear o
  arquivo culpado. A perda colateral (`ESQUEMA_DO_CODIGO_DE_CONTRATO` deixa de ter a origem amarrada)
  está **fora** do invariante declarado daquele caso, e o docblock foi corrigido para descrevê-la.
- **Contador do limiar de três, para vigiar:** o recorte do corpo de um símbolo por âncoras textuais
  tem hoje **duas** implementações — `recorteEntreAncoras` (`apps/api/test/documento-do-contrato.e2e.spec.ts`)
  e o fatiamento embutido em `ordemDaProjecaoPublicada` (`apps/api/test/cobrancas.e2e.spec.ts`). O
  limiar do `CLAUDE.md` age na **terceira**, e a T2 e a T6 são candidatas naturais a produzi-la.
- **⚠️ `apps/api` tem flake de teardown, e ele vai morder a T15/T16.** Na primeira execução de
  `pnpm --filter @sysloc/api test` durante a T2, os 281 casos passaram mas o processo saiu com código
  **não-zero** por rejeição não tratada no encerramento: `Error: Stream isn't writeable and
  enableOfflineQueue options is false`, em `ioredis`/`bullmq` (`RedisConnection.init` →
  `getRedisVersionAndType`), originada em `apps/api/test/segredo-nao-escapa.e2e.spec.ts` após o
  CT-833. A reexecução pelo mesmo script saiu verde e com código zero. **Não é regressão da T2** — ela
  não toca Redis, fila nem `apps/api/src`. É corrida de teardown intermitente e dívida latente de
  `apps/api`; como a **T15 e a T16 publicam duas filas novas**, ela tende a queimar tentativa lá se
  não for fechada antes. O projeto não tem política formal de flaky (decisão de 2026-08-16): o
  tratamento é caso a caso por quem encontra, e este registro é o "encontrar".
- **Cobrança do Gate 2 para as tasks de dados (T3–T6):** os dois índices únicos parciais são o
  **mecanismo** de recusa do disparo concorrente, e a T3/T5 vão receber `23505` sobre
  `emissao_em_lote_em_andamento_uidx` e `conferencia_bancaria_em_andamento_uidx` como **caminho normal
  de execução**, não como defeito. Elas precisam traduzir esse SQLSTATE em erro de domínio nomeado, no
  molde do `ErroDeUnicidade` que a T4 da fatia `cobranca-e-mora` já publicou — capturá-lo genericamente
  devolveria **500 ao Admin que clicou duas vezes**.
- **Nota de segurança da T2, registrada para a fatia (iii) não a ler como defeito:**
  `cobranca_identificador_no_provedor_key` é unicidade **global** sobre tabela com RLS forçada, de modo
  que um `23505` pode, em tese, sinalizar a existência de valor pertencente a outra empresa. **Não é
  achado**: a globalidade é a `Decision` literal da ADR-0033 (parear com `empresa_id` é o erro que
  matou a ADR-0015); o valor é cunhado por sequência e nunca é entrada de usuário, logo não há canal
  de sondagem; e `portador_de_confirmacao_derivado_key` já tem a mesma forma, sendo o precedente vivo.
- **As duas pendências que a T3 declarou como candidatas a débito NÃO viraram débito, porque a
  rodada 2 as fechou.** Ficam registradas aqui para que ninguém as procure como marcador órfão:
  **(a)** a tradução código → UUID desapareceu com a correção do TR-P1 — `lerTrilhaDaCobranca` passou
  a receber o **código** e a traduzir por junção, no molde de `lerEnviosDaCobranca`, de modo que não
  há mais lacuna para T6/T14 resolverem sob pressão (nem alargando `LinhaDeCobranca` com `id`, nem
  inventando consulta de tradução avulsa); **(b)** `LinhaDeEventoBancario.valorInformado` deixou de
  ser cadeia — a conversão de `numeric` passou ao ponto único da tradução (`eventoPublicado`), no
  molde de `cobrancaPublicada`, e o tipo de linha voltou a ser **exatamente** `EventoBancario`. A
  convenção que **T4 a T6 devem seguir** está escrita no cabeçalho de `evento-bancario.ts`: cadeia na
  escrita, número na projeção publicada, convertido em função nomeada que copia campo a campo.
- **O precedente de dinheiro em cadeia que a T3 citava era o errado, e isso vale para as leituras
  seguintes.** `CandidataAoAviso.valorTotal` é tipo de **porta de domínio**, sem contraparte publicada
  em esquema Zod — ali não há assimetria a resolver. O análogo de um tipo de linha publicado é
  `cobrancaPublicada`, e ele converte.
- **A T3 fechou os cinco achados do Gate 2 numa rodada, e três deles com prova que reprova se voltarem** —
  `MT-T3-C` mata a chave antiga em runtime **nomeando a causa** (`invalid input syntax for type uuid`),
  `MT-T3-D` mata a perda do nulo com diferença visível em quatro das seis linhas, e `MT-T3-E` mata a
  conversão ausente **no compilador**, antes da suíte. O bloqueante era do tipo que só a segunda leitura
  pega: `lerTrilhaDaCobranca` era chaveada pelo **UUID interno**, e **nenhum símbolo publicado de
  `@sysloc/db` produz esse UUID** — a borda não conseguiria sequer chamar a função que o docblock dizia
  que ela chamaria.
- **A verificação mais fina do run até aqui, e vale como método.** Ao confirmar que a junção nova não
  reintroduziu comparação de empresa em código, o Gate 2 não parou no predicado único: verificou **três**
  pré-condições no fonte — `FORCE RLS` e política nas **duas** tabelas, e a unicidade
  `cobranca_empresa_codigo_key` sobre `(empresa_id, codigo)`. A terceira é a que quase ninguém checaria, e
  é a que sustenta tudo: pela **ADR-0033** o escopo da série da cobrança é `(empresa, ano)`, **não** o
  SaaS — duas empresas *podem* legitimamente ter o mesmo `COB-2026-9390002`. É só a política que torna o
  predicado `c.codigo` suficiente; sem `FORCE` na `cobranca`, a mesma instrução vazaria.
- **Convenção fixada para T4–T6, derivada e não escolhida:** *cadeia na escrita, número na projeção
  publicada*. Ela não é preferência — sai de `esquemaDoEventoBancario.valorInformado` ser `z.number()`
  somado à **ADR-0016**, que faz do esquema a fonte única. Está escrita no cabeçalho de
  `packages/db/src/evento-bancario.ts`, e o orquestrador passou a apontar esse arquivo como referência na
  §5.3 das três tasks restantes da fase — por sugestão do próprio Gate 2, que observou que quem abrir
  T4–T6 sem passar pelo cabeçalho não a encontra.
- ~~**Os artefatos de spec desta fatia seguem sem versionar**~~ — **RESOLVIDO na T9**: os 28 arquivos de
  `docs/specs/features/emissao-e-conciliacao/`, o `docs/prds/features/emissao-e-conciliacao/` e a
  `docs/adr/0034-*.md` foram staged. ⚠️ **O padrão que os causou continua vivo**: o stage automático só
  alcança o que a §5.1/§5.2 declara, e **artefato de spec e ADR nova nunca estão declarados ali**. No
  fechamento da fatia, confira `git status --porcelain` **inteiro**, não só os `task_paths`. O pipeline
  faz apenas `git add` — **nunca commita**.
- **A T9 fechou em 2 rodadas, e a rodada extra comprou uma prova que não existia.** O bloqueante era o
  **AP-29 dentro do caso escrito para fechar um AP-29** — o acessório `recusaDe` filtrava por tipo, o
  que tornava `toBeInstanceOf` **infalível**, e a "segunda discriminante" declarada pelo executor
  (`'code' in recusa`) também era implicada. **O SUT estava correto o tempo todo**; o que faltava era a
  rede. A correção moveu o filtro do **arranjo** para a **asserção** e acrescentou o caso da **base
  apagada**, que o orquestrador promoveu de opcional a obrigatório por ser a única prova **independente
  da ordem**. O Gate 1 validou enumerando três classes de mutante, e o Gate 2 refez o julgamento por
  conta própria — os dois concordam **por mecanismo**, não por deferência.
- **O `diferencasDeConjunto` (D29) tem uma leitura errada que já circulou dois gates, e ela precisa
  morrer aqui**: *"a casa compartilhada já existe em `packages/auth/test/conjuntos.ts`, basta importar"*.
  **Não basta** — o docblock daquele arquivo declara que ele é **deliberadamente local** ao diretório de
  `auth`, e importá-lo de outro pacote **contrairia o `D28 · F0/T5`**. O caminho certo é uma casa **irmã**
  em `packages/cobranca-bancaria/test/`, que é o que `auth` fez quando enfrentou o mesmo problema.
- **A T10 fechou em 3 rodadas e NÃO deixou débito nenhum** — os três achados do Gate 2 (um bloqueante,
  dois anotáveis) e o do Gate 1 foram **todos corrigidos**, os dois anotáveis **voluntariamente**. Ela
  ainda **fechou o D29** que a T9 tinha aberto. É a primeira task da fatia a terminar com a §2 intocada.
- **O bloqueante do Gate 2 na T10 é o achado mais instrutivo do run até aqui.** A `devDependency` de
  `@sysloc/db` **removeu uma barreira estrutural sem repor a rede** — e o gate não julgou por leitura:
  plantou a sonda `import ... from '@sysloc/db'` em `cobranca-bancaria/src/` (passou, `exit 0`) e a mesma
  sonda em `regua/src/`, que **não** declara a dependência (reprovou, `TS2307`). **O pnpm não distingue
  `dependencies` de `devDependencies` na resolução de módulo**, e a exclusão de `../db` das `references`
  do `tsconfig` — que o executor apresentava como o que segurava a propriedade — **não bloqueia**. O
  `src/` estava limpo; o que sumiu foi **quem pegava**. Classe **R2**.
  > ⚠️ **Registro para a T11 e a T12**, que abrem os mesmos arquivos: **a `devDependency` é aceitável** —
  > o Gate 2 mediu que não há ciclo e julgou, contra o texto da `Decision` da ADR-0025, que ela governa
  > **a direção da aresta na fronteira**, e a aresta de **teste** não é essa. O que ela custa é a
  > barreira de resolução, hoje reposta pelo **`CT-809 (d)`** de `vocabulario-canonico.spec.ts`.
- **Duas lições de asserção, e as duas custaram rodada nesta fatia.** Na **T9**, acessório de teste que
  filtra por tipo torna a asserção de tipo **infalível**. Na **T10**, `diferencasDeConjunto(x, [...new
  Set(x)])` compara um conjunto **consigo mesmo** — verde para qualquer entrada, inclusive a que reusa
  identificador. ⚠️ **O padrão comum é o que importa: nas duas, a PROSA creditava a prova à asserção
  errada**, e é isso que torna o defeito perigoso — quem lê o comentário e remove a asserção "redundante"
  apaga a única que pega o defeito. A correção da T10 deixou a armadilha **documentada no ponto onde foi
  cometida**, e os dois gates julgaram isso craft, independentemente.
- **O D30 é o achado mais acionável da T9 e não é de código**: `provisionar-base.sh` e `.env.example`
  prometem que o verificador confere um acervo **movido para volume próprio** — que o próprio
  provisionador chama de *"a edição mais legítima que existe"* —, e o verificador **reprova** essa exata
  configuração com `exit 1`. Dois artefatos da **mesma task** se contradizendo sobre o mesmo cenário, em
  procedimento que um operador executa a sério.
