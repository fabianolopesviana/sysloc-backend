# Relatório do Run — cobranca-e-mora/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **5/11 tasks concluídas** · suíte **687 → 805** casos, verde · `pnpm build` e `pnpm lint` verdes.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T2 | Contrato de tipos da cobrança em `@sysloc/contracts` | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Schema e migrações da cobrança — tabelas isoladas, a view de fonte única e o contador da série | opus | 3 criados, 9 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T4 | Porta de dados da cobrança — leitura pela view, emissão da série e a prova da mora contra o golden | opus | 2 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T5 | As três rotas de lançamento e leitura da carteira de cobranças | opus | 5 criados, 11 mod | ✅ APROVADO (3 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T6 | Configuração de mora por empresa — contrato, porta e as duas rotas de `/v1/multa-e-juros` | opus | 6 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

> **T1 não está nesta tabela por decisão de ordenação, não por bloqueio.** Ela exige `sudo` com senha
> interativa e o site efêmero do `/opt/frappe` de pé — nenhum subagente a executa. Fica para o fim do
> run, como execução conduzida pelo operador. Nada nas outras dez tasks depende dela: `Dependências`
> de T2..T11 nunca a citam, ela não cria símbolo de código, e os arquivos que ela toca
> (`deploy/scripts/caracterizacao/` e a pasta golden da fatia `caracterizacao-regras-legadas`) não
> intersectam os de nenhuma outra task.

## 2. Débitos Técnicos Não Resolvidos

> A sequência `Dnn` desta fatia corre **dentro desta seção**, e não globalmente (§3-B da
> `.claude/rules/nao-regressao.md`). O identificador de um débito é o par `Dnn · F{n}/{origem}` mais
> o caminho deste arquivo.

### D1 · baixo · project_pattern · T2 · executor

- **Onde:** `packages/contracts/src/cobranca.ts`, no ponto do `import … from './contrato.js'`
- **Problema:** `MAIOR_VALOR_MONETARIO` e `ESCALA_MONETARIA` são vocabulário monetário de **todo o
  produto**, mas moram em `contrato.ts` porque foi lá que nasceram, na F2. Com a T2, `cobranca.ts`
  passa a ser o **segundo** consumidor e as importa de um módulo irmão em vez de do comum. Nenhuma
  definição é duplicada — o CT-545 prova que continuam tendo declaração única —, e o que está
  registrado aqui é a **topologia do import**, não uma divergência.
- **Impacto:** baixo e não funcional hoje. Ele cresce quando o terceiro consumidor chegar: três
  módulos importando lateralmente de `contrato.ts` transformam um módulo de entidade em módulo comum
  de fato, e o próximo implementador que não achar as constantes em `comum.ts` — que é onde ele
  procura primeiro — escreve a segunda definição. É exatamente a forma do **D3 (F2/T1)** já aberta no
  projeto, e seria pior aqui: duas escalas que divergem passam a recusar valores diferentes na mesma
  superfície.
- **Gatilho:** o **terceiro** consumidor monetário do pacote — a emissão de boleto da F4 é a
  candidata óbvia.
- **O que fazer:** promover as duas para `packages/contracts/src/comum.ts` e ajustar os **três** call
  sites no mesmo commit, mantendo o `index.ts` publicando-as símbolo a símbolo. O marcador
  `DÉBITO COM GATILHO` sai de `cobranca.ts` e a linha correspondente sai do bloco do `CLAUDE.md`, na
  mesma passagem (§3-B, ciclo de vida do índice).
- **Prova exigida:** o CT-545 já é a rede — ele afirma declaração **única** de cada constante e o
  arquivo dono. Depois da promoção, o dono passa a ser `src/comum.ts` e os três consumidores a
  importarem de lá; a asserção sobe junto, sem afrouxar.
- **Por que não agora:** promover exigiria editar superfície publicada de um módulo estável, com
  marcador, dentro de uma fatia que não pede isso; e com dois consumidores o import lateral ainda é a
  forma mais barata que **não** duplica a definição.

### D2 · baixo · documentation · T2 · QA

- **Onde:** `CLAUDE.md:410`
- **Problema:** a linha do débito D1 no bloco "Débitos com gatilho ativo" tem **217 caracteres**, acima
  do teto de ~150 que o próprio bloco declara para ponteiro curto.
- **Impacto:** nenhum funcional. A substância do critério está atendida — a linha existe, é ponteiro,
  e o detalhe vive só na §2 daqui. O excesso é o estilo já instalado: as demais linhas da tabela vão
  de 175 a 267 caracteres, de modo que isto é dívida de higiene coletiva da tabela, não desvio novo.
- **O que fazer:** encurtar a coluna "Dispara quando" para algo como *"o **terceiro consumidor
  monetário do pacote** (F4) — as duas constantes sobem para `comum.ts`"*, deixando o restante na §2.
  Cabe numa passagem de cleanup junto das outras linhas da tabela.

### D3 · BAIXO · scope_deviation · T2 · Tech Review

- **Onde:** `docs/specs/features/cobranca-e-mora/v1/_run/run-report.md:1` e
  `docs/specs/features/cobranca-e-mora/v1/tasks/T2.md` §5.1
- **Problema:** este arquivo foi criado **pelo executor**, fora da §5.1/§5.2 da T2. A razão procede e
  foi verificada nos dois gates: o CT-907 exige que o `ÍNDICE` de todo marcador vivo aponte para
  arquivo existente, e o `DÉBITO COM GATILHO — D1` que a §3 da task **manda** emitir aponta para cá.
  O desvio é do artefato de spec (a §5.1 é que está incompleta), não do executor.
- **Impacto:** baixo e não funcional, mas com um modo de falha silencioso: se uma regeração futura do
  snapshot montar a §2 **apenas** a partir dos JSONs dos gates, o bloco `### D1` some — ele não veio de
  gate, veio do mandato da task. O marcador de `cobranca.ts` ficaria apontando para uma seção
  inexistente **e a suíte seguiria verde**, porque o CT-907 confere só a existência do arquivo, nunca
  o cabeçalho `### D{n}` lá dentro. Essa metade da §3-B não tem dentes hoje.
- **O que fazer:** (a) acrescentar `_run/run-report.md` à §5.1 da task que emitir o **primeiro**
  marcador de uma fatia nova, fechando o vão da spec; (b) considerar endurecer o CT-907 para conferir
  que o `### D{n}` existe no alvo do `ÍNDICE`, e não só que o arquivo existe.

### D4 · baixo · tests · T2 · orquestrador (baseline do run)

- **Onde:** `packages/shared/test/protocolo-antirregressao.spec.ts` — `CT-907 — o índice de débito
  fecha nas duas pontas` > `todo marcador vivo no código tem linha no índice`
- **Problema:** o caso expira no teto de 5000ms quando roda dentro do `pnpm test` completo, e passa
  **3/3** quando isolado por `pnpm --filter @sysloc/shared test`. A varredura do repositório inteiro
  por `readdirSync` recursivo não cabe no teto sob disputa de CPU/IO com as instâncias efêmeras de
  banco dos outros pacotes. **Pré-existente a esta fatia** — medido na baseline, antes da primeira
  edição.
- **Impacto:** operacional, não funcional. Um caso vermelho intermitente na baseline corrompe a
  comparação P1/P5 de **toda** task do run e pode fazer um gate atribuir ao diff uma falha que não é
  dele. O risco cresce com a suíte: esta fatia acrescenta ~45 casos e mais instâncias de banco
  concorrentes.
- **O que fazer:** o docblock do arquivo registra que a memoização já foi o conserto de uma rodada
  anterior do mesmo sintoma — ela reduziu de 4 varreduras para 1, e 1 ainda não cabe. O caminho que
  resta é tirar a varredura do orçamento de tempo do caso (movê-la para um `beforeAll` com teto
  próprio, que é setup e não asserção) ou baratear a caminhada. **Não** alargar o teto do caso: o
  próprio docblock pré-rejeita isso como conserto do sintoma.
- **Por que não agora:** o arquivo é a barreira executável do Protocolo Antirregressão, está fora do
  escopo desta fatia (que não toca `packages/shared`), e editá-lo aqui seria a Proibição 5 do
  protocolo (*"nunca aproveitar que estou aqui"*).

### D5 · baixo · documentation · T3 · QA

- **Onde:** `packages/db/migracoes/0009_dominio_cobranca.sql:56` e o parágrafo gêmeo na §7 de
  `docs/specs/features/cobranca-e-mora/v1/tasks/T3.md`
- **Problema:** o comentário do índice `cobranca_aberta_idx` declara o cenário da medição de `EXPLAIN`
  como *"carteira de 60.000 cobranças com 2.000 em aberto e vencidas"* e apresenta quatro cifras a
  partir dele. O QA reproduziu o cenário **literalmente** e mediu que **duas das quatro não decorrem
  dele**: o *"descarta 58.000 linhas"* (mediu `1305` — com `LIMIT 50` o Index Scan termina cedo, e só
  descarta tudo se as liquidadas ordenarem antes das vencidas por `data_vencimento`) e o
  `Buffers: shared hit=4` da leitura direta (mediu `52` — depende de as 2.000 em aberto serem
  contíguas no heap). As duas dependem da **distribuição** de `data_vencimento` e da ordem de
  inserção, que o cenário escrito não fixa.
- **Impacto:** nenhum sobre a decisão. **A conclusão estrutural reproduz por inteiro** — inclusive o
  passo que discrimina (com `enable_seqscan = off` o plano não muda, o que separa inalcançabilidade
  de preterição por custo). O que se perde é a reprodutibilidade de duas cifras apresentadas como
  medidas, o que enfraquece a mesma classe de guarda que o D-anterior desta task já corrigiu.
- **O que fazer:** acrescentar ao cenário as duas condições que faltam — que as liquidadas têm
  `data_vencimento` **anterior** às em aberto, e que as em aberto foram gravadas em bloco —, ou trocar
  as duas cifras sensíveis à distribuição pela grandeza que **não** é: o plano escolhido e o operador
  (`Index Scan using cobranca_empresa_vencimento_idx` com o `CASE` como `Filter`, contra
  `Bitmap Index Scan on cobranca_aberta_idx`). Replicar na §7 da `tasks/T3.md`.

### D6 · BAIXO · project_pattern · T3 · Tech Review

- **Onde:** `docs/specs/features/cobranca-e-mora/v1/tasks/T4.md` (§3 ou §6) e
  `docs/specs/features/cobranca-e-mora/v1/tech_spec.md:698`
- **Problema:** a instrução que o P2 gerou — *toda consulta da carteira em aberto sobre
  `cobranca_derivada` acompanha o filtro por `status` de `AND pago_em IS NULL AND cancelado_em IS NULL`*
  — ficou escrita nos dois pontos pedidos (`0009` e `negocio.ts`), mas **nenhum deles é arquivo que a
  T4 precise abrir**: ela escreve a porta de dados, não migração. A `T4.md` não menciona
  `cobranca_aberta_idx` nem o filtro, e o invariante de `T4.md:225` fixa justamente uma leitura por
  `status = 'VENCIDA'`. O `tech_spec.md:698` ainda descreve o índice como quem *"serve o filtro por
  estado em aberto"* — a formulação ambígua que a medição desta rodada acabou de precisar.
- **Impacto:** baixo e não funcional. A T4 pode escrever `WHERE status = 'VENCIDA'` sem os dois
  `IS NULL`, e a leitura mais frequente do produto varre também o histórico liquidado — exatamente o
  ganho pelo qual o índice foi escolhido parcial.
- **O que fazer:** uma linha na §3 ou §6 de `tasks/T4.md`, como ponteiro curto para o comentário de
  `cobranca_aberta_idx` na `0009`, sem recopiar a medição; e desfazer a ambiguidade do
  `tech_spec.md:698` na mesma passada.
- **Mitigação já aplicada neste run:** o orquestrador **não editou o artefato de spec** (a skill
  proíbe alterar spec sem pedido do usuário) e injetou a instrução literal no prompt do executor da
  T4, que é o destinatário real. O débito permanece aberto porque a mitigação vale para **este** run
  e não para quem reabrir a T4 depois.

### D8 · baixo · documentation · T4 · QA

- **Onde:** `packages/db/src/cobranca.ts:386` (docblock de `predicadoDaCarteira`)
- **Problema:** o docblock aponta a rede da implicação *"estado em aberto ⇒ os dois carimbos são
  nulos"* para *"o passo 6 do `CT-524`"* — que é **justamente a asserção vácua que o Gate 2 reprovou**.
  Quem exercita a implicação é o **`CT-524 (b)`**, em cenário próprio. O comentário do teste já diz
  isso corretamente; o docblock de produção ficou contraditório com ele.
- **Impacto:** nenhum em execução. O ponteiro errado mora no lugar exato onde a rodada seguinte
  procuraria a rede — que é o modo de falha que o achado do Gate 2 existiu para fechar. Contido pelo
  próprio comentário do passo 6, que agora declara textualmente que ele **não** prova o par e nomeia
  o `CT-524 (b)` como quem fecha: as duas pontas se corrigem mutuamente.
- **O que fazer:** trocar *"tem rede no passo 6 do `CT-524`"* por *"tem rede no `CT-524 (b)`"*.
  Nenhuma asserção muda — é só o ponteiro.

### D10 · BAIXO · scope_deviation · T5 · Tech Review

- **Onde:** `docs/specs/features/cobranca-e-mora/v1/tasks/T5.md` §5.2
- **Problema:** a §5.2 declara **dois** arquivos a modificar e o diff tocou **sete a mais**, dois deles
  código de produção. O Gate 2 julgou cada um e **não pediu nada desfeito**: `lerAnoDaSerieDeCobranca`
  é *"craft necessário, não função que devia ter esperado"*, e fechar o D7 é *"limpar a própria
  bagunça"*, porque o `QUANDO FECHA` do marcador nomeava literalmente esta task.
- **Impacto:** baixo e não funcional. Custa **revisão**: dois arquivos de `packages/db/src` chegam ao
  Gate 2 sem que a §5.2 os anunciasse. É a **terceira ocorrência da mesma forma nesta fatia**, e
  `apps/api/test/contexto.e2e.spec.ts` fica fora de uma §5.2 **pela sexta vez** — o que é o **D26
  (F2/T6)**, herdado.
- **O que fazer:** para as tasks seguintes, a §5.2 deve incluir **(a)** os arquivos que um marcador
  `DÉBITO COM GATILHO` disparado pela task obriga a tocar, e **(b)** as âncoras por igualdade exata que
  a publicação de rota faz reprovar — hoje `contexto.e2e.spec.ts`, `validacao.spec.ts` e
  `cobertura-de-autorizacao.e2e.spec.ts`.

### D11 · BAIXO · testability · T5 · Tech Review

- **Onde:** `apps/api/test/cobrancas.e2e.spec.ts` (`ateSerExclusivo`, ~linhas 1019-1057)
- **Problema:** o teto fixo `MAXIMO_DE_MONTAGENS_ATE_O_CODIGO_EXCLUSIVO = 12` acopla o `CT-515 (c)` à
  **ordem e à quantidade** de cadastros que os casos anteriores criam na empresa A. O número de voltas
  não é propriedade do caso: é a distância entre a série de A e a de B no instante em que o laço
  começa. Medido: converge em **5 voltas** contra o teto de 12 — folga de **sete** casos novos que
  criem contrato ou cobrança em A **antes** do `CT-515 (c)`.
- **Impacto:** baixo e contido — o modo de falha é **ruidoso** (o laço levanta nomeando a coleção e o
  número de tentativas), nunca falso-verde. O custo é uma rodada de gate perdida numa task futura
  diagnosticando um erro cuja causa está a 350 linhas de distância. ⚠️ **T6 e T7 são da mesma fatia e
  `cobrancas.e2e.spec.ts` é o arquivo natural delas.**
- **O que fazer:** declarar a ordem no docblock do `CT-515 (c)` — *caso novo que crie contrato ou
  cobrança na empresa A entra **depois** do `CT-515 (c)`* —, ou derivar o teto da distância observada
  em vez de fixá-lo. **Não alterar as asserções do caso.**

### D12 · baixo · tests · T6 · QA

- **Onde:** `apps/api/test/mora.e2e.spec.ts:314`
- **Problema:** o `CT-538` depende de ser o primeiro `it` do arquivo — a ordem invertida o reprovaria.
- **Impacto:** o `CT-538` mede a RD-21 nos passos 1-2 (`GET` de empresa sem linha devolve zeros e **não
  cria linha**, com contagem `0` em A e B), e o `CT-539` grava a política de A como precondição
  própria. Na ordem alternada, a contagem do passo 2 valeria `1` e o corpo do passo 1 viria `{2,1}` em
  vez de zeros. Cada caso passa isolado; só a ordem invertida quebra. O QA rebaixou de `ALTO`
  (catálogo AP-08) para `BAIXO` por três razões medidas: (a) a precondição *"nenhuma das duas chamou
  `PUT` ainda"* é exigência **literal** da §6.6 da task, não descuido; (b) a ordem interna de um
  arquivo é determinística no Vitest e nenhuma embaralhadura está configurada — não há flakiness hoje;
  (c) a violação reprovaria **ruidosamente**, porque a asserção de contagem `0` é ela mesma a
  afirmação da precondição. O que sustenta a decisão do executor é a irreconstituibilidade: **não
  existe rota que apague a política**, por decisão de produto, então o invariante *"a primeira leitura
  não escreve"* só é mensurável de primeira mão.
- **O que fazer:** se um terceiro caso vier a ser acrescentado ao arquivo, mantê-lo **depois** do
  `CT-538`. A correção estrutural, se algum dia valer o custo, é uma das duas: dar ao `CT-538` uma
  empresa própria (uma terceira na carga), ou um acessório que zere `negocio.configuracao_de_mora` da
  empresa em `beforeEach`, sob o contexto de tenant — que tornaria os dois casos independentes de
  ordem sem publicar rota de exclusão.

### D13 · baixo · tests · T6 · QA

- **Onde:** `apps/api/test/mora.e2e.spec.ts:499`
- **Problema:** a escala `0.01` tem negativo, mas **nenhum positivo com duas casas decimais**.
- **Impacto:** o `CT-539` prova a recusa fora de escala (`0.005` → `422`, passo 3), mas nenhum corpo
  **aceito** da suíte tem duas casas: os positivos são `0`, `0.5`, `1`, `2`, `5`, `10` e `100`, e o de
  maior precisão tem uma casa. A classe de valor que a escala `0.01` existe para **permitir** é a única
  não exercitada. O QA sondou `packages/contracts/dist/index.js` diretamente: `2.55`, `12.34`, `33.33`,
  `99.99`, `8.29`, `0.07` e `0.03` são todos **aceitos** e `0.005` recusado com `not_multiple_of` —
  logo **não há defeito hoje**, o `multipleOf` do Zod 4 usa resto decimal-seguro. O que falta é a rede:
  uma troca de versão do Zod, ou uma reescrita da conferência com resto de ponto flutuante ingênuo
  (`v % 0.01`, que devolve `0.00999…` para `2.55`), passaria a recusar **toda política de duas casas**
  com `422` — o valor mais natural do domínio — e a suíte continuaria verde.
- **O que fazer:** acrescentar um par de duas casas ao laço de bordas que já existe no passo 7 do
  `CT-539` — por exemplo `{ multaPercentual: 2.55, jurosPercentual: 0.07 }` —, afirmando `200`, o eco
  do corpo e a releitura exata. Custo de uma linha, e passa a prender o lado que **aceita** da mesma
  dimensão cujo lado que recusa já está preso.

### D14 · MEDIO · project_pattern · T6 · Tech Review

- **Onde:** `packages/db/src/configuracao-de-mora.ts:119`
- **Problema:** `POLITICA_AUSENTE` é constante de módulo compartilhada por toda leitura e **não está
  congelada**, contra a convenção de 4 precedentes do mesmo pacote.
- **Impacto:** a constante é devolvida **por referência** em `lerConfiguracaoDeMora` (linha 171), sem
  `Object.freeze`. O pacote tem a convenção estabelecida e explícita para exatamente este papel —
  constante de módulo devolvida como o valor da ausência por uma porta de leitura —, e nos quatro casos
  ela é congelada, com o docblock literal *"Congelado — é compartilhado por toda leitura"*:
  `packages/db/src/contrato.ts:485` (`SEM_FIADORES`), `packages/db/src/imovel.ts:372` (`SEM_COMODOS`),
  `packages/db/src/conjunto.ts:143` (`SEM_IMOVEIS`) e
  `apps/api/src/contratos/contrato.service.ts:431` (`EFEITOS_DA_ATIVACAO`). O `readonly` da interface
  (linha 93) protege dentro do pacote, mas **a proteção se perde na fronteira do serviço**:
  `MoraService.ler` devolve `Promise<ConfiguracaoDeMora>`, cujo tipo vem de `z.infer` de `z.number()` e
  **não tem `readonly`** — o consumidor recebe um alias mutável do objeto de módulo. Hoje ninguém a
  muta, então não há defeito ativo; o risco é o que a convenção existe para fechar: um consumidor
  futuro que faça `const p = await mora.ler(tx); p.multaPercentual = x` altera o objeto de módulo **do
  processo**, e toda leitura seguinte de **qualquer** empresa que nunca configurou passa a devolver o
  valor injetado — a política de uma empresa vazando para outra pelo estado compartilhado, exatamente
  a classe de falha que a RD-21 e a ADR-0008 fecham no banco. O compilador não acusa (o tipo já foi
  alargado na borda) e teste algum acusa (nenhum caso escreve no valor devolvido).
- **O que fazer:** envolver o literal em `Object.freeze`, no molde de `SEM_FIADORES`
  (`packages/db/src/contrato.ts:485`), com o mesmo docblock de congelamento. Uma palavra, sem mudança
  de comportamento e sem tocar teste.

### D15 · MEDIO · project_pattern · T6 · Tech Review

- **Onde:** `packages/contracts/src/configuracao-de-mora.ts:117`
- **Problema:** `esquemaDaConfiguracaoDeMora` é o **único esquema de saída** do pacote declarado como
  `strictObject` — todos os 6 anteriores são `z.object`, e a diferença **entra no documento publicado**.
- **Impacto:** o inventário do pacote mostra a convenção sem exceção — entrada é `strictObject`, saída é
  `z.object`: entradas `esquemaDePessoaNova`, `esquemaDeComodoNovo`, `esquemaDeImovelNovo`,
  `esquemaDeConjuntoNovo`, `esquemaDoPagamentoDeCobranca`, `esquemaDaSituacaoDeLocacao`,
  `esquemaDaJanela`; saídas `esquemaDaPessoa:75`, `esquemaDoComodo:74`, `esquemaDoImovel:241`,
  `esquemaDaCobranca:353`, `esquemaDoConjunto:48`, `esquemaDoContrato:322`, **todas** `z.object`. A
  consequência é observável e não é interna: `esquemaPublicado(…, 'output')` roda `z.toJSONSchema`, e um
  `strictObject` emite `additionalProperties: false` — as duas respostas de `/v1/multa-e-juros` passam a
  ser os únicos objetos **fechados** do documento OpenAPI, num contrato em que as outras 78 rotas
  publicam objeto aberto. A **ADR-0016** é justamente o que propaga isso: o documento **deriva** do
  esquema, então a escolha não fica no pacote. Um cliente gerado ou um `ts-rest` que confira a resposta
  contra o esquema **recusa qualquer campo acrescentado no futuro nessas duas rotas** — enquanto tolera
  o mesmo acréscimo em todo o resto da API; crescimento aditivo deixa de ser aditivo aqui. Não é
  violação de marcador: o `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM` (`packages/contracts/src/comum.ts`)
  alcança a restrição de **escala**, e nem o código nem o texto dele foram tocados — é a convenção
  irmã, aplicada ao contrário. Nenhuma asserção da suíte cobre abertura de esquema de **saída** (a
  varredura de `esquemas.spec.ts` só percorre entradas), e por isso isto passa verde e só aparece no diff.
- **O que fazer:** trocar `z.strictObject` por `z.object` na linha 117 e ajustar o docblock, que hoje
  explica a assimetria de faixa/escala mas não menciona a de fechamento. Se o fechamento na saída for
  deliberado, precisa de justificativa própria escrita ali — e então é decisão de contrato que vale para
  as 80 rotas, não para duas.

### D16 · BAIXO · project_pattern · T6 · Tech Review

- **Onde:** `packages/db/src/configuracao-de-mora.ts:192`
- **Problema:** `gravarConfiguracaoDeMora` reusa o tipo de **saída** (`ConfiguracaoDeMoraPersistida`)
  como tipo do parâmetro de escrita, onde as 7 portas anteriores declaram um `DadosDeX` próprio.
- **Impacto:** o parâmetro se chama `dados`, seguindo a convenção, mas o tipo é o de leitura. Toda porta
  de escrita do pacote separa os dois: `criarCobranca` (`DadosDaCobranca`, `cobranca.ts:567`),
  `criarContrato`/`alterarContrato` (`DadosDoContrato`), `criarImovel` (`DadosDoImovel`),
  `alterarImovel` (`DadosDaAlteracaoDoImovel`), `criarConjunto`/`alterarConjunto`,
  `criarComodo`/`alterarComodo`. Nenhum efeito hoje — as duas formas coincidem. O acoplamento é o
  custo: o primeiro campo somente-de-leitura que a política publicar (um `definidoEm`, um
  `definidoPor`, um carimbo de auditoria) passa a ser exigido no corpo da escrita, ou obriga a partir o
  tipo naquele momento, no arquivo que estiver sendo alterado por outra razão. É o mesmo acoplamento
  que `DadosDaAlteracaoDoImovel` existe para desfazer, e a lição está registrada: em `alterarImovel`,
  entrada e saída partilhadas foram a origem do furo do `status_locacao`.
- **O que fazer:** declarar `interface DadosDaConfiguracaoDeMora` com os dois campos `readonly` e usá-la
  no parâmetro, mantendo `ConfiguracaoDeMoraPersistida` como retorno das duas funções. Não altera o
  índice publicado do pacote nem o `CT-012`, que observa símbolos de tempo de execução.

### D7 · F3/T4 — **FECHADO na T5**

Nasceu `lerAnoDaSerieDeCobranca` em `packages/db/src/cobranca.ts`, derivada de
`negocio.data_corrente_da_operacao()` — o mesmo eixo da view. As três pontas saíram juntas.
**O número está queimado**: a sequência `Dnn` desta fatia corre nesta seção, e reemitir `D7` tornaria
ambíguo o único identificador que a §3-B da `nao-regressao.md` reconhece.

### D9 · F3/T4 — **FECHADO na T5**

`CT-540 (b)` em `packages/contracts/test/esquemas.spec.ts` — as duas asserções de congelamento de
`ESTADOS_EM_ABERTO`. **O número está queimado**, pela mesma razão do D7.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

> ### ▶️ O RUN FOI RETOMADO em 2026-08-10 — a pausa está encerrada
>
> A pausa parou o run com o **executor da T6 concluído e os dois gates dela sem rodar**. A retomada
> escolheu **(a) "Retomar nos gates"** — o código estava íntegro, e reexecutar do zero descartaria
> trabalho bom. Os dois gates rodaram sobre ele e **aprovaram**: QA `APROVADO_COM_OBSERVACOES` (13/13
> critérios, 2/2 CTs) e Tech Review `APROVADO_COM_OBSERVACOES` (0 bloqueantes). **T6 está concluída e
> staged.** O histórico da pausa segue no `_run/workflow-report.md` como registro; o que ele diz sobre
> "como retomar" já foi cumprido e não se aplica mais.
>
> **Nada foi commitado.** T2 a T6 estão `staged`, aguardando a decisão do usuário sobre o agrupamento.
> As notas operacionais que continuam valendo para T7 em diante (flake do `CT-907`, disco em ~93%,
> próximo `Dnn` livre — hoje **D17** —, a folga do `cobrancas.e2e.spec.ts` do D11) estão no
> `_run/workflow-report.md`.

- **Uma consequência do `t5_sha` que vale reusar até o usuário commitar.** Com T2–T6 `staged` e sem
  commit, o HEAD não se move, então `git diff <base_sha>` devolve as tasks **somadas** nos arquivos que
  elas compartilham — e o Gate 2 rerrevisaria código já aprovado. Na T6 isso foi resolvido com um
  marcador sintético do estado do índice (`t5_sha`), passado ao Tech Review como diff primário: ele
  revisou 12 arquivos de delta em vez dos 22 cumulativos. O mecanismo está descrito no
  `_run/workflow-report.md` e deve ser refeito a cada task enquanto o commit não acontecer.

- **⚠️ O D15 merece decisão do usuário AGORA, e não no cleanup — é o único débito desta fatia que
  alcança um artefato de entrega.** Ele diz que `esquemaDaConfiguracaoDeMora` nasceu `strictObject`
  onde os outros seis esquemas de saída do pacote são `z.object`, e a ADR-0016 propaga a diferença para
  o **documento OpenAPI publicado**: duas das 80 rotas passam a publicar objeto **fechado**
  (`additionalProperties: false`). O `@sysloc/contracts` publicado é um dos sete itens do marco de
  entrega do backend, e a superfície da API será **congelada** depois da F5 — corrigir depois do
  handoff custa uma versão do pacote; corrigir agora custa **trocar uma palavra**. A política de
  bloqueio seletivo o classifica como `MEDIO` de categoria anotável, então o pipeline **não pode**
  abrir rodada de correção por ele; a decisão de fechá-lo fora do pipeline é do usuário.

- **A T4 herdou da T3 uma instrução que o Gate 2 mandou atravessar tasks, e ela mudou o código.** O
  P4 da revisão da T3 apontou que a medição de `EXPLAIN` sobre `cobranca_aberta_idx` morava em
  migração e docblock, mas não no artefato que a T4 abre. O orquestrador **não editou o artefato de
  spec** (a skill proíbe alterar spec sem pedido do usuário) e injetou a instrução literal no prompt
  do executor da T4 — que a aplicou em `listarCobrancas`. O Gate 2 da T4 depois julgou o predicado
  *"otimização legítima"*, mas reprovou o **veículo** da classificação, e daí nasceu o achado mais
  valioso do run: `ESTADOS_EM_ABERTO` colidiria, por construção, com o **CT-510** que a T5 ainda vai
  escrever, esvaziando a rede do `DECISÃO FECHADA` da própria T4 antes de ela ser usada uma vez.
- **A T3 refutou por medição uma premissa do próprio card de teste, e os dois gates confirmaram.** O
  passo 7 do CT-523 mandava provar que o **CT-522 reprova** quando o `security_invoker` sai da
  migração. Ele não reprova: a visão pertence a `sysloc_migracao`, que está sob o
  `FORCE ROW LEVEL SECURITY` declarado no bloco 1 da própria `0010`, de modo que a política continua
  sendo avaliada e o conjunto devolvido não muda. O que a ausência do atributo produz são **13 casos
  vermelhos** — o CT-523 mais 12 da guarda de catálogo —, medido pelo executor e **reproduzido
  independentemente pelo QA**, com `sha256sum` da reversão conferido. A rede existe; o card errava
  sobre *qual* caso detecta. O registro correto do mecanismo entrou no `POR QUÊ` do marcador, depois
  de o Gate 2 apontar que a primeira redação descrevia justamente o mecanismo refutado.
- **A T2 mediu, e a medição trocou dois números do card do CT-544.** Os valores de resíduo que o card
  sugeria (`valorJuros: 6.2399999999999995`, `valorTotal: 193.66999999999996`) são **aprovados** por
  `multipleOf(0.01)` — medido com o zod deste pacote —, de modo que um caso construído sobre eles
  seguiria verde mesmo com a escala replicada na saída, provando nada sobre a assimetria
  entrada × saída. Os dois que ficaram (`1.0300000000000002` e `263.67999999999995`) saem da
  aritmética da RD-07 sobre uma cobrança de `R$ 257,50` com 12 dias de atraso, e são **recusados** —
  há um caso irmão que o afirma, e é o par que dá poder de detecção ao conjunto.
- **A prova de falsificação do CT-545 exigiu corrigir o mutante 1 do card.** Acrescentar
  `export const ESCALA_MONETARIA` a `src/cobranca.ts`, como o card pede à letra, colide com o
  `import` do mesmo nome e reprova no `tsc --build` **antes** de qualquer asserção correr — seria
  "reprovou sem provar nada". O mutante fiel põe a segunda definição num **terceiro** arquivo
  (`src/comum.ts`), que é a forma que a própria Obs do card nomeia. Os dois mutantes e os números
  medidos estão no cabeçalho de INVARIANTES de `packages/contracts/test/esquemas.spec.ts`.
- **Este arquivo nasceu na T2, e não no fecho da task.** O marcador `DÉBITO COM GATILHO` emitido em
  `cobranca.ts` aponta para a §2 daqui, e `packages/shared/test/protocolo-antirregressao.spec.ts`
  (CT-907) reprova quando o campo `ÍNDICE` aponta para caminho inexistente. ⚠️ Ao regerar este
  snapshot, **preserve a entrada D1** — apagá-la deixa o marcador órfão e a suíte vermelha. O Gate 2
  transformou esta advertência no **D3**, porque aviso em prosa não é barreira.
- **A baseline do run entrou vermelha por um caso alheio à fatia, e a decisão foi registrar em vez de
  consertar.** `CT-907` (`packages/shared/test/protocolo-antirregressao.spec.ts`) expira no teto de
  5000ms quando roda dentro do `pnpm test` completo, sob disputa de CPU/IO com as instâncias efêmeras
  de banco; isolado passa **3/3**. Caracterizado pelo orquestrador **antes** da primeira edição e
  confirmado depois pelo QA. Não foi corrigido porque o arquivo é a barreira executável do próprio
  Protocolo Antirregressão, está fora do escopo desta fatia, o docblock dele **pré-rejeita por escrito**
  o conserto óbvio (*"alargar o teto seria conserto do sintoma"*), e tocá-lo seria a Proibição 5. Ver
  o **D4** da §2. Todo executor e todo gate deste run recebem o aviso de que a expiração dele não é
  regressão da task.
