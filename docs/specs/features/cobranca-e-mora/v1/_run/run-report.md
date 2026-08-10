# Relatório do Run — cobranca-e-mora/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **10/11 tasks concluídas** · suíte **687 → 834** casos, verde · `pnpm build` e `pnpm lint` verdes.

**A única task restante é a T1**, diferida por decisão do usuário — ela exige `sudo` com senha
interativa e o site efêmero do `/opt/frappe` de pé, e **nenhum subagente a executa**. Nada nas outras
dez depende dela. Enquanto ela não rodar, a fatia fica em **10/11** e o Status geral do `task_plan.md`
**não** vai a `Concluído`.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T2 | Contrato de tipos da cobrança em `@sysloc/contracts` | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Schema e migrações da cobrança — tabelas isoladas, a view de fonte única e o contador da série | opus | 3 criados, 9 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T4 | Porta de dados da cobrança — leitura pela view, emissão da série e a prova da mora contra o golden | opus | 2 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T5 | As três rotas de lançamento e leitura da carteira de cobranças | opus | 5 criados, 11 mod | ✅ APROVADO (3 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T6 | Configuração de mora por empresa — contrato, porta e as duas rotas de `/v1/multa-e-juros` | opus | 6 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T7 | As duas transições da cobrança — acusar pagamento com carimbo e cancelar preservando o histórico | opus | 0 criados, 11 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T8 | `derivarParcelasDoContrato` — a função pura das parcelas, provada contra o oráculo | opus | 2 criados, 5 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T9 | A ativação do contrato gera as parcelas na mesma unidade de trabalho — **fecha o D28** | opus | 0 criados, 13 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T10 | O cancelamento do contrato cancela as cobranças em cascata, na mesma unidade | opus | 0 criados, 8 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T11 | Cobertura de autorização das sete rotas novas e as âncoras finais da superfície | opus | 0 criados, 2 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |

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

### D19 · MEDIO · project_pattern · T7 · Tech Review

- **Onde:** `packages/db/migracoes/0010_seguranca_cobranca.sql:294`
- **Problema:** duas colunas entraram na visão `cobranca_derivada` sem âncora de conjunto exato,
  enquanto a **tabela** `negocio.cobranca` tem a dela (`CT-510 b`).
- **Impacto:** a emenda da T7 acrescentou `multa_percentual_vigente` e `juros_percentual_vigente`. O
  projeto protege a superfície gêmea por igualdade de conjunto —
  `packages/db/test/fonte-unica-do-estado.spec.ts:299` afirma a lista **ordenada e inteira** das
  colunas de `negocio.cobranca` via `information_schema.columns`, e o `_run/test-cases.json` registra
  o propósito (*"impede coluna nova entrar sem decisão"*). A visão não tem equivalente: o único caso
  que a inspeciona por catálogo é o `CT-510 (c)`, que confere apenas o **tipo** da coluna `status`. As
  duas colunas novas entraram, portanto, sem nada que force revisão — e a visão é, por decisão desta
  fatia (`DECISÃO FECHADA` de `packages/db/src/cobranca.ts:630`), a **única porta de leitura de
  cobrança do produto**. Não é defeito hoje: `listarCobrancas` e `localizarCobranca` selecionam lista
  explícita (`SELECT ${colunasDaCobranca(tx)}`), então nada vaza para o contrato. Mas a **F4** (régua,
  boleto, carnê) lê essa visão, e é ela que herda a lacuna.
- **O que fazer:** estender o `CT-510` com um caso que afirme a lista ordenada e inteira das colunas de
  `negocio.cobranca_derivada`, no molde do `CT-510 (b)`, **ou** incorporar a conferência ao `CT-533`
  da **T11**, que já é a auditoria final por dupla medição. A segunda opção não custa caso novo e
  mantém o débito com dono e prazo dentro da própria fatia.

### D20 · BAIXO · scope_deviation · T7 · Tech Review

- **Onde:** `packages/db/migracoes/0010_seguranca_cobranca.sql:224`
- **Problema:** a emenda da `0010` é legítima e correta, mas a legitimidade **expira** na primeira
  aplicação a banco durável, e nada no repositório registra isso.
- **Impacto:** o Gate 2 julgou o desvio e o aprovou em todos os pontos verificáveis — a emenda é
  necessária (mutante `MT-7` reproduzido pelo QA), a alternativa `0011` com `CREATE OR REPLACE VIEW`
  seria **pior** (`blocoDaVisao()` extrai o `CREATE VIEW` do arquivo `0010` **do disco**, então a visão
  viva definida noutro arquivo faria `CT-513` e `CT-526` mutarem objeto que não é o do produto — R2,
  regressão de prova), e a `0010` de fato **nunca foi aplicada** (`A` no git, T1 é captura de golden,
  os artefatos só a citam contra instância efêmera). A regra de imutabilidade do projeto é
  **condicional** a *"já aplicada"* — o cabeçalho da própria `0010` a enuncia assim. O risco
  operacional é **fail-safe**: `deploy/scripts/instalacao/migrar-banco.sh:519` mantém
  `identidade.migracao_aplicada` com `sha256sum` por arquivo e **aborta sem alterar nada** em
  divergência, imprimindo a remediação correta. O que falta é o registro: a janela fecha **em
  silêncio**, T8–T11 e a fatia `regua-e-documentos` ainda vêm, e o precedente recém-aberto (*"emende a
  `0010`, porque `blocoDaVisao()` extrai dela"*) convida à mesma edição depois de a janela fechar.
- **O que fazer:** acrescentar o arquivo à §5.2 da T7 com a divergência declarada; emitir um
  `DÉBITO COM GATILHO` junto do bloco da visão, com
  `QUANDO FECHA: a primeira aplicação da 0010 a banco durável — a partir dela o arquivo é imutável e a
  guarda de sha256 do migrar-banco.sh aborta a instalação`, mais a linha correspondente no índice do
  `CLAUDE.md`; e registrar aqui o par emenda-vs-`0011`, para que a escolha não seja re-derivada.

### D21 · BAIXO · code_quality · T7 · Tech Review

- **Onde:** `packages/db/src/cobranca.ts` (docblock de `cancelarCobranca`)
- **Problema:** o docblock afirma uma garantia que o código não tem, e contradiz o docblock do serviço
  escrito **na mesma task**.
- **Impacto:** ele conclui que *"esta instrução nunca alcança uma linha já liquidada, e o instante
  original é preservado por não haver segunda escrita"*. Isso não decorre do código: a guarda é
  leitura-antes-de-gravar no serviço, e o `UPDATE` não tem `AND cancelado_em IS NULL`. Sob duas
  transações concorrentes as duas passam a guarda e a segunda sobrescreve `cancelado_em`, sem que o
  `cobranca_desfecho_unico_chk` dispare (só um desfecho está preenchido). O docblock de
  `CobrancaService.acusarPagamento`, escrito na mesma task, diz o certo: *"entre a leitura e o
  `UPDATE` cabe outra transação"*. **A corrida em si não é o achado** — race condition de backend em
  MVP é não-objetivo consciente dos gates. O passivo é a prosa: o próximo agente que avaliar se deve
  acrescentar o predicado lê, **no ponto exato da decisão**, que a preservação já está garantida.
- **O que fazer:** trocar a frase final por uma que separe o que a decisão entrega do que não entrega —
  a ausência do predicado é deliberada para que a segunda tentativa seja **recusada com o estado
  nomeado** em vez de silenciada; a preservação do instante vale sob a serialização das transições, e a
  janela entre a leitura e o `UPDATE` é a mesma que `acusarPagamento` já reconhece.

### D22 · BAIXO · code_quality · T7 · Tech Review

- **Onde:** `packages/db/migracoes/0010_seguranca_cobranca.sql:239-240`
- **Problema:** linha de separador `-- ---` duplicada entre o bloco novo da T7 e a seção seguinte.
- **Impacto:** cosmético. Todas as outras seções do arquivo têm **uma** régua; a seção *"Empresa sem
  configuração de mora"* passou a ter duas acima do título. Só pesa por ser um arquivo que a suíte lê
  do disco para montar mutantes, e no qual a uniformidade do texto é a convenção que separa bloco de
  bloco.
- **O que fazer:** remover uma das duas linhas.

### D23 · BAIXO · code_quality · T7 · Tech Review

- **Onde:** `apps/api/src/cobrancas/cobranca.controller.ts:195`
- **Problema:** `ESQUEMA_DO_CORPO_VAZIO` ganhou segunda definição idêntica, contra o precedente de
  unificar em `apps/api/src/comum/`.
- **Impacto:** é idêntico ao de `apps/api/src/contratos/contrato.controller.ts:241`. O repositório já
  pagou essa classe **duas** vezes e fechou nos dois casos por definição única em
  `apps/api/src/comum/`: o **D40 (F1/T9)** com `esquemaDoErro` e o **D38 (F1/T9)** com `validar()`. A
  duplicação é trivial e sem risco de divergência de comportamento — um objeto estrito vazio não tem
  variação possível —, mas com a **F4** publicando mais rotas de transição e de rotina, a terceira
  cópia é previsível.
- **O que fazer:** mover para `apps/api/src/comum/` (junto de `validacao.ts`) e importar nos dois
  controladores, **ou** registrar com gatilho no terceiro consumidor, no molde do **D1** desta fatia.

### D24 · baixo · documentation · T7 · QA

- **Onde:** `packages/db/test/cobranca.spec.ts:2015`
- **Problema:** o docblock de `registrarPolitica` afirma que a porta da política *"nasce em T6"*, e ela
  já nasceu.
- **Impacto:** o acessório escreve `negocio.configuracao_de_mora` por instrução crua, e a justificativa
  escrita para isso está **vencida** — a T6 está concluída e `gravarConfiguracaoDeMora` existe. A T7
  corrigiu o par análogo no mesmo arquivo (`carimbarPagamento`/`carimbarCancelamento` →
  `pagar`/`cancelar`, pelas portas de produção) e deixou este. **Não há confiança fabricada**: a
  política não é o objeto sob prova em `CT-527` nem em `CT-532` — o que eles afirmam é a **derivação**
  a partir dela, e a linha gravada é idêntica pelos dois caminhos. O que existe é um docblock que
  afirma um fato falso, no arquivo que a T7 tocou.
- **O que fazer:** reescrever o docblock declarando a razão **real** de a escrita seguir crua (a
  política não é o objeto sob prova nestes casos, e a suíte é da camada de dados), **ou** trocar o
  acessório por `gravarConfiguracaoDeMora`.

### D25 · BAIXO · project_pattern · T7 · Tech Review

- **Onde:** `docs/adr/0021-transicao-de-estado-governada-conforme-a-natureza-do-ato.md:43`
- **Problema:** emendar ADR `accepted` em loco é **precedente novo**, e não há convenção escrita para a
  forma do rastro.
- **Impacto:** esta é a **primeira** emenda in loco de ADR aceita do repositório
  (`grep -rn "Emenda de" docs/adr/*.md` casa só neste arquivo). O sweep por `emenda|emendar|amend` em
  `.claude/rules/` e nas skills `agent-spec-adr-*` voltou **vazio**: o domínio ADR tem `-create`,
  `-supersede`, `-deprecate` e `-reindex`, e **nenhuma** cobre *"corrigir o registro de uma decisão que
  não mudou"*; o template canônico não tem campo de emenda, e o frontmatter segue
  `status: accepted` / `date: 2026-08-09` sem sinal de que o corpo foi editado em 2026-08-10. O rastro
  escolhido (bloco datado dentro da própria `Decision`) é bom e está no lugar certo — dentro da seção
  que se lê antes de tentar a mudança —, mas é convenção de **uma ocorrência só**. A próxima emenda
  inventa a forma de novo, e a partir da terceira não há como distinguir por varredura redação original
  de redação emendada.
- **O que fazer:** registrar a forma como convenção — bloco `> **Emenda de {data}.**` ao fim da seção
  emendada, com *o que a redação original dizia* / *o que mudou* / *por que a decisão NÃO mudou* /
  *origem*, mais uma linha `amended: {data}` no frontmatter do template. Colocação natural:
  `.claude/rules/agent-spec-adr-workflow-rules.md`, junto da seção de rastreabilidade ADR ↔ Feature.

### D26 · BAIXO · code_quality · T8 · Executor

- **Onde:** `packages/db/src/derivacao-de-cobranca.ts` (`ultimoDiaDoMes`, `ehBissexto` — marcador
  `DÉBITO COM GATILHO — D26 · F3/T8` imediatamente acima das duas)
- **Problema:** a regra do calendário gregoriano — comprimento do mês e ano bissexto — passa a ter
  **duas** escritas no pacote: as duas funções novas e as homônimas de
  `packages/db/src/derivacao-de-contrato.ts`, que são internas de lá.
- **Impacto:** baixo hoje, e mensurável: as duas cópias são **idênticas em comportamento** e cada uma é
  provada contra o **mesmo** oráculo (`contrato-ativacao.json` — o bloco `derivacao` exercita a virada
  de fevereiro pelo lado do término, e o bloco `cobrancas` pelo lado das parcelas), de modo que uma
  divergência entre elas reprovaria numa das duas suítes. O que a duplicação custa é a garantia
  estrutural: nada obriga a próxima correção de calendário a acontecer nos dois lugares.
- **O que fazer:** promover `ultimoDiaDoMes` e `ehBissexto` a um módulo de calendário próprio de
  `packages/db/src/` (interno, **não** publicado no índice — o `CT-012` registra a ausência dos
  acessórios como deliberada), com os dois call sites ajustados no mesmo commit e as duas suítes
  reexecutadas. Não foi feito aqui porque exigiria alterar a superfície de um módulo estável, com
  decisões registradas, **fora dos arquivos da §5.2 da T8**.
- **Gatilho:** o **terceiro** consumidor de aritmética de calendário do pacote — a régua de vencimento
  da F5 e o carnê da fatia 2 são os candidatos óbvios.

### D27 · MEDIO · tests · T8 · QA

- **Onde:** `packages/db/test/derivacao-de-cobranca.spec.ts:713`
- **Problema:** a recusa de `diaVencimento = 29` pelo esquema é asserida em **dois pacotes**.
- **Impacto:** o `CT-507` (segundo caso) afirma, em `packages/db/test/`, que
  `esquemaDeContratoNovo.safeParse({...CORPO_DE_CONTRATO, diaVencimento: 29})` reprova nomeando o campo.
  Essa **mesma** invariante já é propriedade de `packages/contracts/test/esquemas.spec.ts:1061-1065`, na
  tabela `CAMPOS_RECUSADOS`, com o rótulo *"dia de vencimento acima de 28 (RD-08)"*, o mesmo remendo e o
  mesmo campo esperado. O *owning layer* da regra é `packages/contracts` — é lá que o esquema vive. A
  consequência concreta: quando a RD-06/RD-08 mudar o teto, **dois** pacotes reprovam; e o teste de
  `packages/db` passa a carregar uma fixture de nove campos (`CORPO_DE_CONTRATO`) que precisa continuar
  válida contra um esquema de **outro** pacote, sem que nada aqui a mantenha em dia. **O card §6.6 pediu
  esta asserção, e o executor a cumpriu** — o achado é sobre a colocação, não sobre a obediência ao card.
- **O que fazer:** substituir a asserção sobre o esquema por um ponteiro em comentário para
  `packages/contracts/test/esquemas.spec.ts` (tabela `CAMPOS_RECUSADOS`), mantendo aqui apenas a
  afirmação que é **deste** arquivo: que a função não satura o vencimento (já coberta pelos treze
  vencimentos literais em `-28`). Com isso `CORPO_DE_CONTRATO` e o import de `@sysloc/contracts` saem do
  arquivo. `smell: duplicate_cross_layer` (AP-23), anotável pela partição.

### D28 · baixo · tests · T8 · QA

- **Onde:** `packages/db/test/derivacao-de-cobranca.spec.ts:606`
- **Problema:** a data discriminadora `2027-01-31` é literal inline em **seis** pontos.
- **Impacto:** todo valor **medido** deste arquivo ganhou constante nomeada — `REFERENCIAS_DO_DISCRIMINADOR`,
  `TERCEIRO_PERIODO_DO_CONTROLE`, `COMPETENCIAS_DE_TREZE_MESES`, `INDICES_DIVERGENTES_EM_*`,
  `FUSOS_DO_CASO`. A exceção é justamente **a data que torna os casos discriminadores**: `'2027-01-31'`
  aparece inline nas linhas 590, 606, 658, 676, 691 e 700. É o **dia 31** que faz a saturação de fevereiro
  ser herdada; trocado por engano em um dos seis pontos, aquele trecho passa a exercitar um cenário de
  dia seguro e **deixa de discriminar sem que nada acuse**.
- **O que fazer:** extrair `const INICIO_DISCRIMINADOR = '2027-01-31';` junto das demais constantes
  medidas (perto de `DISCRIMINADOR`, linha 230) e usá-la nos seis pontos, inclusive dentro de
  `CORPO_DE_CONTRATO`. `smell: magic_strings`.

### D29 · BAIXO · project_pattern · T8 · Tech Review

- **Onde:** `docs/specs/features/cobranca-e-mora/v1/tasks/T8.md:94` (§5.2)
- **Problema:** a §5.2 não pré-declarou os **três** arquivos que a publicação do símbolo e a emissão do
  marcador obrigam a tocar. É a **nona** ocorrência do padrão.
- **Impacto:** nenhum no código entregue, e o Gate 2 provou que as três edições eram **mecanicamente
  obrigatórias**: o `CT-012` compara a superfície publicada por **igualdade**
  (`expect(superficie.nomes).toEqual(ordenado(SIMBOLOS_ESPERADOS))`), de modo que publicar
  `derivarParcelasDoContrato` no índice **necessariamente** reprova o caso até o inventário incluí-lo; e a
  §3-B de `.claude/rules/nao-regressao.md` **obriga** quem emite um `DÉBITO COM GATILHO` a fechar as duas
  pontas do índice (`CLAUDE.md` e a §2 daqui, que o campo `ÍNDICE` do marcador nomeia literalmente). O
  custo é de gate: a cada task o executor declara como pendência o que a spec deveria ter previsto, e os
  **dois** gates gastam uma passagem julgando se foi alargamento.
- **O que fazer:** nas tasks restantes (T9–T11), incluir na §5.2 **(a)**
  `packages/db/test/unidade-de-trabalho.spec.ts` sempre que a task publicar símbolo no índice de
  `@sysloc/db` — a **T9 publica dois** —, e **(b)** `CLAUDE.md` mais este relatório sempre que a task
  prever emissão de `DÉBITO COM GATILHO`. Nenhuma ação sobre o código da T8. É o mesmo `O que fazer` do
  **D10**, que segue sem ser seguido — e enquanto a skill proíbe o orquestrador de editar spec sem pedido
  do usuário, o caminho usado neste run é **injetar a instrução no prompt do executor da task seguinte**,
  que é o destinatário real (foi assim que o P4 da T3 alcançou a T4).

### D30 · MEDIO · code_quality · T9 · QA

- **Onde:** `packages/contracts/test/esquemas.spec.ts:1496`
- **Problema:** o `CT-537 (b)` duplica semanticamente o primeiro caso do `CT-540`, **no mesmo arquivo**.
- **Impacto:** o passo 5 do `CT-537` afirma `[...NATUREZAS_DE_COBRANCA]` e `[...ESTADOS_DA_COBRANCA]` por
  igualdade de lista ordenada; o primeiro `it` do `CT-540` (`esquemas.spec.ts:1534-1537`, duas dezenas
  de linhas abaixo) afirma **exatamente as mesmas duas igualdades**, sobre os mesmos símbolos, contra
  listas idênticas. A tupla (alvo, parâmetros, resultado esperado) coincide integralmente — só o nome
  do `it` difere. **O card manda mantê-lo** alegando ser *"a âncora que impede o enum de crescer junto
  com a mudança do contrato de ativação"*, e o QA julgou que **a razão não se sustenta**: não existe
  estado do código em que o `CT-537 (b)` reprove e o `CT-540` passe, porque o `CT-540` já afirma a
  igualdade ordenada das duas listas e vive no mesmo arquivo. O poder de detecção acrescentado é
  **zero**, e a próxima mudança de enum passa a exigir edição em dois lugares sem ganho.
- **O que fazer:** remover o `it` `CT-537 (b)` e, se a ancoragem do enum ao contrato de ativação for
  desejada, **referenciar** o `CT-540` no docblock do `CT-537` em vez de reasserir. Se a decisão for
  mantê-lo, registrar aqui a duplicação como **intencional**. `smell: semantically_duplicated_test`.

### D31 · baixo · documentation · T9 · QA

- **Onde:** `packages/contracts/test/esquemas.spec.ts:1400`
- **Problema:** a contagem declarada no `SUT_IS_CORRECT_BECAUSE:` do `CT-537` está errada — diz
  *"sobe de quatro para cinco"*; é de **quatro para nove**.
- **Impacto:** o `CT-537` tem **nove** casos executáveis (3 do laço ACEITOS + 3 do laço RECUSADOS + a
  resposta sem declaração de efeito + o efeito inventado + o `CT-537 (b)`), e a medição confirma:
  `@sysloc/contracts` foi de 222 a **227**, delta `+5 = 9−4`. A própria §4 da task escreve *"o CT-429
  tinha 4 casos; o CT-537 tem 9"*. É documentação, não defeito de prova — nenhuma asserção está
  afrouxada e a substituição é legítima. Mas o número errado está **exatamente no campo que a
  comparação de contagem do P5 usa** para julgar se a suíte encolheu, e é o campo que um gate futuro
  vai ler para decidir se a substituição foi honesta.
- **O que fazer:** trocar por *"a contagem de casos **sobe** de quatro para nove"*, alinhando com a §4
  da task e com a medição do pacote.

### D32 · baixo · documentation · T9 · QA

- **Onde:** `apps/api/test/contratos.e2e.spec.ts:1980`
- **Problema:** o comentário do `CT-413` ainda anuncia **como futuro** o afrouxamento que **esta task
  fez**.
- **Impacto:** ele diz *"`efeitos` prende o literal que a F3 terá de afrouxar"*. A T9 **é** a F3, e o
  literal já foi afrouxado — `EFEITOS_ESPERADOS` deixou de ser `{ cobrancasGeradas: false }` neste
  mesmo diff. A frase descreve como pendente algo já consumado, no arquivo que a task tocou; é o tipo
  de prosa que faz o próximo agente procurar por um afrouxamento pendente que não existe.
- **O que fazer:** reescrever no presente — *"`efeitos` prende a contagem publicada por igualdade de
  objeto; era o literal `false` até a T9, e é o que faz o efeito não ficar decorativo"* (o `MT-T9-1`
  mediu que é essa linha que reprova quando a ativação não gera parcela).
- ⚠️ **Este `D32` coexiste com o `D32 (F0/T6)`** do índice do `CLAUDE.md`, e a coexistência é legítima
  pela §3-B: a sequência corre dentro da §2 **desta** fatia, e o identificador é o par
  `Dnn · F{n}/{origem}`.

### D33 · BAIXO · project_pattern · T9 · Tech Review

- **Onde:** `apps/api/src/contratos/contrato.service.ts:174-179`
- **Problema:** um parágrafo do docblock justifica a ausência de cascata com uma premissa que **esta
  task matou**, e a janela T9 → T10 não tem marcador.
- **Impacto:** o parágrafo afirma que *"o cancelamento em cascata das cobranças cancela um conjunto
  vazio, e isso é correto: `negocio.cobranca` não existe nesta fatia (RD-12) … Quando a F3 chegar, o
  conjunto passa a ter elementos e o mesmo caminho percorre — não há nada a antecipar"*. **As três
  afirmações estão falsas hoje**: `negocio.cobranca` existe desde a `0009` (T3), a T9 fez a ativação
  gravar N parcelas, e **não existe "o mesmo caminho"** — o Gate 2 leu o `cancelar` (linhas 812-825) e
  ele faz `localizarContrato`, `cancelarContrato` e `definirSituacaoDeLocacaoDoImovel`, **sem tocar
  cobrança**. O conjunto deixou de ser vazio e nada o percorre. A janela é real: entre a T9 e a T10, um
  contrato cancelado deixa **N parcelas vivas** em `cobranca_derivada`, classificadas
  `A_VENCER`/`VENCIDA` e **acumulando mora**, sem que nada no código acuse. O risco é **R3** (regressão
  de decisão) com leitor nomeado: a **T10 abre exatamente este método**, e um parágrafo que diz *"não
  há nada a antecipar"* faz o executor procurar um percurso existente a ligar, em vez de escrever a
  cascata do zero.
- **O que fazer:** reescrever o parágrafo no tempo presente (*"a cascata **não** está implementada; a
  partir da T9 o conjunto tem elementos"*). O `suggested_fix` registra que, **sendo a T10 a próxima a
  rodar, corrigir a prosa e dispensar o `DÉBITO COM GATILHO` é aceitável** — ele nasceria e morreria na
  mesma sessão. **Não confundir** com o `DÉBITO COM GATILHO — D36 · F2/T8`, que vive no mesmo método
  (linha 799) e **permanece**. A instrução foi injetada no prompt do executor da T10.

### D34 · BAIXO · code_quality · T9 · Tech Review

- **Onde:** `apps/api/src/contratos/contrato.controller.ts:453`
- **Problema:** a descrição do `@ApiOkResponse` da ativação continua dizendo que a resposta declara **o
  que a ativação NÃO fez**.
- **Impacto:** ela contradiz duas coisas do mesmo bloco de decoradores — o `schema` da linha seguinte,
  que deriva de `esquemaDaAtivacaoDeContrato` já com `cobrancasGeradas: z.number()`, e o
  `@ApiOperation` das linhas 445-450, que **esta task reescreveu** para dizer que a ativação **gera** as
  parcelas e publica quantas nasceram. O executor atualizou a descrição da operação e passou pela da
  resposta. **Não é violação da ADR-0016** — a forma continua **derivada** do esquema, e o que está
  errado é prosa narrativa. O custo: o `handoff-frontend.md` é gerado desta superfície, e quem abrir o
  documento OpenAPI lê, na resposta `200`, a leitura **exatamente invertida** de `cobrancasGeradas: 3`.
  O nome do campo e a descrição da operação desfazem o mal-entendido, o que mantém o custo baixo.
- **O que fazer:** trocar por *"O contrato como ele ficou, mais a declaração de quantas cobranças a
  ativação gerou."* Uma linha, sem efeito comportamental.

### D35 · baixo · documentation · T10 · QA

- **Onde:** `packages/db/src/index.ts:149`
- **Problema:** o docblock ainda diz *"as **oito** operações da cobrança"* — são **onze**, e a T10 publica a
  décima primeira.
- **Impacto:** a contagem real de funções publicadas de `./cobranca.js` é onze:
  `acusarPagamentoDeCobranca`, `cancelarCobranca`, `cancelarCobrancasDoContrato`, `criarCobranca`,
  `criarCobrancasEmLote`, `emitirNumeroDeCobranca`, `emitirNumerosDeCobranca`,
  `garantirContadorDeCobranca`, `lerAnoDaSerieDeCobranca`, `listarCobrancas`, `localizarCobranca`. O
  número já estava vencido antes da T10, **mas a T10 edita esse mesmo docblock 40 linhas abaixo** (o
  parágrafo novo *"Pela T10 sai daqui `cancelarCobrancasDoContrato`"*), de modo que a justificativa de
  *"preexistente fora do escopo"* não se sustenta: a edição já estava aberta no bloco. A prosa deste
  arquivo é mecanismo de memória entre agentes, e um número errado ali é lido como fato.
- **O que fazer:** trocar por *"as onze operações"* e ajustar a enumeração aposta (*"as duas
  transições"* já não cobre a cascata). Alternativa que **não envelhece**: suprimir o numeral —
  *"as operações da cobrança — inclusive as transições, as duas da série e o leitor do ano do escopo
  dela"*.

### D36 · baixo · documentation · T10 · QA **e** Tech Review

- **Onde:** `apps/api/src/contratos/contrato.service.ts:146` (mais 13 pontos nos dois arquivos)
- **Problema:** `contrato.service.ts` e `contrato.controller.ts` citam a **ADR-0019** como vigente, e ela
  está `superseded-by:0021`. A T10 **reescreveu uma das linhas que a citam**, mantendo o ponteiro vencido.
- **Impacto:** são **14** citações vivas — `service.ts` 93, 146, 247, 424, 1003; `controller.ts` 46, 55,
  62, 142, 217, 226, 228, 434, 507. O `CLAUDE.md` é explícito: *"há duas cadeias de supersede, e nas duas
  só a última se cita"*. **Os dois gates convergiram na classificação**: é `documentation`, **não**
  `adr_compliance`, porque não há contradição com nenhuma `Decision` — ambos abriram o texto vigente da
  0021 (com a emenda de 2026-08-10) e o comportamento conforma item a item: o cancelamento de
  **CONTRATO** está nominalmente na primeira classe, exigindo `ACAO:cancelar_contrato`, que é o que a
  rota declara, e a cascata é **efeito** da rota própria. O defeito é de **ponteiro**, não de decisão
  desfeita. O agravante que o Gate 2 nomeou: a redação **original** da 0019, antes da emenda, punha o
  cancelamento de **cobrança** na primeira classe — *"e foi exatamente essa leitura ao pé da letra que
  consumiu uma rodada no Gate 2 da T7"*.
- **O que fazer:** **não** corrigir de dentro de uma task que abra os arquivos por outra razão — as duas
  gates registraram que trocar as 14 ali seria `scope_deviation` de manual. Fechar numa **passagem
  dirigida** sobre os dois arquivos, conferindo **linha a linha**, porque quatro das ocorrências
  descrevem a decisão em prosa e o texto ao redor precisa conferir com a redação vigente — em especial
  `controller.ts:62` (*"a ADR-0019 a rejeita nominalmente"*) e `controller.ts:228`, que descrevem a
  governança por chave de ação que a 0021 **recortou em duas classes**. A passagem é o lugar certo para
  acrescentar a nota de que a 0021 emendou a classificação do ato.
- ⚠️ **Este `D36` coexiste com o `D36 (F2/T8)`, que é marcador VIVO** em `contrato.service.ts:854` — o
  arquivo que esta própria task editou. É a coexistência mais confusa do run, e é **legítima** pela §3-B:
  a sequência corre dentro da §2 **desta** fatia, e o identificador é o par `Dnn · F{n}/{origem}`. Quem
  ler *"D36"* sem a origem vai errar; **cite sempre `D36 · F3/T10` para este, e `D36 · F2/T8` para o
  marcador da pré-condição de PDF**.

### D37 · baixo · documentation · T10 · QA

- **Onde:** `apps/api/src/contratos/contrato.service.ts:184`
- **Problema:** o texto **novo** do cabeçalho — o que substituiu o parágrafo obsoleto do **D33** — diz
  *"não deixou marcador nem débito"*, e o débito **existe**.
- **Impacto:** o Gate 1 verificou as **dez** afirmações substantivas do texto novo uma a uma contra o
  código e **todas conferem** — a existência da tabela desde a `0009`, as N parcelas da T9, a ausência do
  *"mesmo caminho"*, as cinco etapas, o predicado literal, a tupla intacta com `xmin` preservado (que ele
  mesmo provou pelo `MT-2`), o conjunto vazio sem ramo de erro, a contagem publicada só na trilha, o
  evento da §13.1 verbatim, e as etapas 4 e 5 no mesmo commit. **O texto não trocou uma afirmação falsa
  por outra imprecisa.** A única imprecisão é a oração final: marcador de fato não deixou; **débito
  deixou** — o `D33` está na §2 desta fatia e é exatamente aquele parágrafo. Um agente que grepe a §2
  encontra o `D33` e lê no fonte a negação de que ele exista.
- **O que fazer:** trocar por algo que preserve o fato — *"e por isso não deixou `DÉBITO COM GATILHO`: o
  débito **D33**, que o Gate 2 registrou na T9, é fechado aqui, na mesma fatia, e o marcador nasceria e
  morreria na mesma sessão (o próprio `suggested_fix` do D33 o autoriza)"*. **Não confundir** com o
  `DÉBITO COM GATILHO — D36 · F2/T8`, que segue no mesmo método e **permanece**.

### D38 · BAIXO · testability · T10 · Tech Review

- **Onde:** `packages/db/test/cobranca.spec.ts` (passo 5 do `CT-521`)
- **Problema:** o passo acopla um caso de `packages/db/test` ao **texto-fonte** de um arquivo de
  `apps/api`, com a **indentação embutida** no literal do mutante.
- **Impacto:** o passo lê `apps/api/src/cobrancas/cobranca.controller.ts` do disco e afirma três coisas
  sobre o **texto**: a declaração do segmento verbatim (com ponto e vírgula), o dono do segmento, e a
  igualdade `metodosDeclarados(dono) === ['GET','POST']`. O mutante de falsificação é uma substituição de
  literal com dois espaços de indentação embutidos. O Gate 2 verificou que o caso está **correto** — alvo
  único hoje, `trocarUmaVez` afirmando a unicidade, regex ancorada em início de linha (docblock não casa),
  `matchAll` sem vazamento de `lastIndex` — e que a falsificação **prova o predicado**. O que se reporta é
  a **fragilidade da via**: uma reformatação cosmética em `apps/api` (aspas, quebra de linha, indentação)
  fica **vermelha em `packages/db`**, com mensagem apontando para o pacote errado. **Não é vão de prova**:
  um `DELETE` novo sob `/v1/cobrancas` — inclusive de outro controlador, o único caso que esta varredura
  não alcança — reprova `cobertura-de-autorizacao.e2e.spec.ts`, que fixa **82/67** por dupla medição.
- **O que fazer:** quando uma task futura tocar o `CT-521`, mover o passo 5 para `apps/api/test/`, onde
  `CAMINHO_DAS_COBRANCAS` já é **importado** (`contratos.e2e.spec.ts:101` o faz nesta mesma T10), e manter
  em `packages/db/test` só os passos 1 a 4, que são de camada de dados. O Gate 2 **considerou bloquear e
  decidiu que não**, com razão registrada: `cobranca.spec.ts` já lê texto versionado de outros workspaces
  desde a T4 (`CAMINHO_DA_FILA` → `apps/worker/src/fila.ts`; `DIRETORIO_DE_UNIDADES` → `deploy/systemd`),
  o padrão passou por gate antes, não há `import` de `apps` (o grafo de build segue `api → db`), a
  divergência está declarada no cabeçalho da suíte e a prova de falsificação está presente — *"reabrir
  isso agora seria churn sobre padrão aceito"*.

### D17 e D18 — **NÚMEROS NÃO UTILIZADOS, queimados**

Anunciei os dois na telemetria da T7 (`_run/workflow-report.md`) para os dois `baixos` do QA daquela task,
e depois **escriturei os achados com outros números**: o primeiro (a classificação dos dois atos não
escriturada na ADR-0021) foi **fechado** pela emenda da ADR e por isso não virou bloco nenhum; o segundo
(o docblock vencido de `registrarPolitica`) foi escriturado como **`D24`**. Os números ficam **queimados**
pela mesma razão do D7 e do D9: reemiti-los tornaria ambíguo o único identificador que a §3-B da
`nao-regressao.md` reconhece. Registrado aqui para que a linha da telemetria não pareça um bloco órfão.

### D7 · F3/T4 — **FECHADO na T5**

Nasceu `lerAnoDaSerieDeCobranca` em `packages/db/src/cobranca.ts`, derivada de
`negocio.data_corrente_da_operacao()` — o mesmo eixo da view. As três pontas saíram juntas.
**O número está queimado**: a sequência `Dnn` desta fatia corre nesta seção, e reemitir `D7` tornaria
ambíguo o único identificador que a §3-B da `nao-regressao.md` reconhece.

### D9 · F3/T4 — **FECHADO na T5**

`CT-540 (b)` em `packages/contracts/test/esquemas.spec.ts` — as duas asserções de congelamento de
`ESTADOS_EM_ABERTO`. **O número está queimado**, pela mesma razão do D7.

### D39 · baixo · dead_code · T11 · QA

- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1424`
- **Problema:** `montarCenarioDeCobranca` devolve `contratoCodigo` e a interface `CenarioDeCobranca` o
  declara, mas o CT-534 nunca lê `cenario.contratoCodigo` — ele só consome `paraPagar`, `paraCancelar`
  e `corpoDeLancamento`. O código do contrato já viaja dentro de `corpoDeLancamento`, montado por
  `corpoDeCobranca(contratoCodigo)`.
- **Impacto:** campo morto na superfície do acessório, não defeito de prova: nenhuma asserção depende
  dele e nenhuma deixa de existir por causa dele.
- **O que fazer:** remover `contratoCodigo` da interface e do objeto devolvido (a variável local segue
  necessária para `corpoDeCobranca`), ou consumi-lo numa asserção se a intenção era ancorar o cenário
  ao contrato.

### D40 · baixo · code_quality · T11 · QA

- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1160`
- **Problema:** três asserções do CT-534 são logicamente implicadas por asserções anteriores do mesmo
  caso — `recusadas.length` igual a 7 (o laço percorre `tabela` sem `break`/`continue`, e o tamanho de
  `tabela` já foi afirmado), `alcancadas` igual a `recusadas` (dois laços completos sobre a MESMA
  tabela, na mesma ordem) e `conferidas.length` igual a 5 (cardinalidade já afirmada).
- **Impacto:** nenhum. O QA foi explícito ao **não** classificar como AP-29: em `tautological_assertion`
  o ramo sempre-verdadeiro **substitui** a prova e deixa a afirmação por provar; aqui as três são
  verdadeiras e garantidas por outras asserções do mesmo caso — redundância decorativa, não prova
  ausente disfarçada. As asserções que discriminam (403 por rota, envelope inteiro por igualdade, 2xx
  no controle positivo, corpo idêntico entre perfis) estão íntegras e falham de verdade, o que foi
  medido no MT11-2.
- **O que fazer:** manter apenas as duas asserções de cardinalidade sobre a tabela, que são as que de
  fato pegam um inventário truncado; ou mantê-las como guarda contra `continue`/`break` futuros,
  registrando essa intenção num comentário. Como remover asserção é ato coberto pelo Protocolo
  Antirregressão, o caminho de menor risco é anotar e não mexer agora.

### D41 · BAIXO · code_quality · T11 · Tech Review

- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:54` e `:928`
- **Problema:** as duas passagens afirmam que a área é ajustada *"pelo caminho real de administração"*,
  mas o acessório usado é `ajustar()` (linha 1952), que escreve por `escreverAjustes` sob
  `contextoDeTenant.executarCom` — o docblock do próprio `ajustar()` é mais preciso ao dizer *"pelo
  caminho REAL da camada de dados… é o mesmo caminho que a rota do Admin usa por dentro"*. A rota
  `POST /v1/usuarios/...` do Admin não é exercitada no arranjo do CT-534.
- **Impacto:** nenhum funcional — a garantia auditada (sessão não forjada, `versaoPermissoes`
  incrementada pela função de domínio, efetivo confirmado por `GET /v1/sessao`) está de fato
  construída. O custo é de leitura futura: neste repositório o comentário é o veículo da decisão, e uma
  linha que reivindica cobertura de borda HTTP mais forte que a real induz o próximo agente a acreditar
  que o caminho de escrita do Admin está sob prova aqui.
- **O que fazer:** trocar *"pelo caminho real de administração"* por *"pelo mesmo caminho de domínio
  que a rota do Admin usa por dentro"* nas duas ocorrências, preservando o restante do texto.

### D42 · BAIXO · code_quality · T11 · Tech Review

- **Onde:** `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts:2025-2039`
- **Problema:** quatro asserções do bloco *"O predicado da ADR-0011"* do CT-533 já são consequência de
  outras do mesmo arquivo — `semDeclaracao` vazio já é afirmado nas linhas 1764 e 1957, e as três
  filtragens de `PARES_DA_FATIA_DE_COBRANCA` contra `comExigencia`, `publicas` e `foraDoArcabouco` são
  implicadas pelo **CT-213**, que compara os mesmos conjuntos por **igualdade de arranjo** (mais forte
  que pertencimento filtrado).
- **Impacto:** nenhum — leituras de metadado sem I/O, e a duplicação não afrouxa nada. O custo é de
  manutenção: quatro pontos a mais para atualizar quando o inventário mudar, e o risco de um leitor
  futuro tratar o CT-533 como guardião de `semDeclaracao` e enfraquecer o CT-213 achando-o redundante.
- **O que fazer:** manter as asserções, anotando no comentário do bloco que são pré-condição local de
  diagnóstico e que a prova forte da partição é a igualdade de arranjo do CT-213 (linhas 1639-1646) —
  o mesmo tipo de nota que o arquivo já usa em *"Por que o CT-533 existe ao lado do CT-355 e do
  CT-427"*. Alternativa: removê-las e citar o CT-213 por nome.

### D43 · BAIXO · code_quality · T11 · Tech Review

- **Onde:** `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1991`
- **Problema:** o literal `nome: 'Pessoa Que Só Administra Cadastros'` ficou fixo no corpo de criação.
  Com o parâmetro de perfil que a T11 introduziu, o mesmo acessório passa a criar o sujeito
  `admin.sem.financeiro` com perfil `ADMIN_EMPRESA` — que não é uma pessoa que só administra cadastros:
  a matriz do `ADMIN_EMPRESA` é o catálogo inteiro, e é por isso que o caso precisa **retirar** a área
  dele.
- **Impacto:** nenhum funcional — o campo `nome` não participa de asserção alguma. Custo de
  legibilidade em diagnóstico: quem inspecionar a tabela de usuários numa falha do CT-534 lê um rótulo
  que contradiz o perfil da linha.
- **O que fazer:** compor o nome a partir do parâmetro (por exemplo `Pessoa de teste (${perfil})`), ou
  aceitar o nome como argumento com o literal atual como padrão.

## 3. Tasks Bloqueadas

✅ Nenhuma task bloqueada.

## 4. Notas para Revisão Humana

> ### ⚠️ Achado PRÉ-EXISTENTE que o fechamento da fatia encontrou — o `CT-013` está vermelho
>
> `bash deploy/scripts/caracterizacao/verificar-golden.sh` termina **REPROVADO** por um caso só, o
> **CT-013**: *"a credencial aparece na árvore versionada"*, apontando `packages/auth/test/senha.spec.ts`,
> `packages/db/src/pessoa.ts` e `packages/db/src/semente.ts`.
>
> **Não é regressão desta fatia, e a prova é direta**: o verificador foi executado num **worktree limpo
> no `fb93915`** — o `base_sha`, antes de qualquer trabalho do run — e reprova **idêntico**, ali com
> **mais** ocorrências (13 contra 7), justamente porque o worktree limpo não tem os arquivos que a fatia
> criou. Os três arquivos apontados são **intocados** pela fatia: `git diff fb93915` sobre cada um volta
> vazio.
>
> **Causa provável: colisão de agulha, não vazamento.** O próprio script documenta que a credencial do
> ambiente legado é *"uma palavra de dicionário de 5 caracteres"* e que o casamento é **por token** sobre
> a árvore versionada inteira — de modo que qualquer literal de teste igual àquela palavra acusa. Isso
> **não** é conclusão fechada: quem for fechar o item precisa abrir os pontos apontados e decidir se é
> colisão ou vazamento real. O que está provado é apenas que a fatia não o causou.
>
> Registrado conforme o **P1** do Protocolo Antirregressão (*"se a baseline já estiver vermelha, isso é
> informação, não obstáculo"*) e deliberadamente **não** consertado aqui — não é causa-raiz de nada
> desta fatia, e mexer nele seria a Proibição 5.
>
> ---
>
> ### ▶️ O RUN FOI RETOMADO DA SEGUNDA PAUSA — 2026-08-10, e a T11 fechou
>
> A pausa parou o run com o **executor da T11 concluído e os dois gates dela sem rodar** — o mesmo
> ponto da primeira pausa, cinco tasks adiante. A retomada escolheu **(a) "Retomar nos gates"**, e os
> dois rodaram sobre o código íntegro: QA `APROVADO_COM_OBSERVACOES` (13/13 critérios, 2/2 CTs, 0
> bloqueantes) e Tech Review `APROVADO_COM_OBSERVACOES` (0 bloqueantes). **A T11 está concluída e
> staged**, e com ela **as dez tasks executáveis da fatia**.
>
> O `t10_sha` (`469a6a03…`) sobreviveu à pausa e isolou o delta da T11 para o Gate 2 — **2 arquivos,
> +1042/−5**, em vez das T2..T11 somadas. O que os blocos de pausa diziam sobre *"como retomar"* já foi
> cumprido e não se aplica mais; eles seguem no `_run/workflow-report.md` como registro histórico.
>
> **⚠️ Duas autorizações permanentes do usuário passaram a valer na retomada, e valem até o fim do
> run**: (1) nenhuma pausa para pergunta — toda escalada que iria a `AskUserQuestion` assume a opção
> recomendada e segue; (2) o **teto de 3 tentativas por task fica suspenso** — o loop de correção
> prossegue até não restar bloqueante. Nenhuma das duas afrouxa gate: os critérios de aprovação seguem
> idênticos e o Protocolo Antirregressão continua com força máxima. Na prática **nenhuma das duas
> chegou a ser exercida na T11** — ela aprovou nos dois gates na primeira rodada, sem escalada.
>
> **A T1 segue diferida por decisão** (exige `sudo` interativo e o site efêmero do `/opt/frappe` de pé;
> nenhum subagente a executa, e nada na fatia depende dela). Enquanto ela não rodar, a fatia fica em
> **10/11** e o Status geral do `task_plan.md` **não** vai a `Concluído`.
>
> ---
>
> ### ▶️ Histórico: o run foi retomado em 2026-08-10, da primeira pausa
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

- **⚠️ A T7 produziu a única escalada ao usuário deste run, e ela mudou uma ADR aceita.** O Gate 2
  reprovou com um `ALTO` de `adr_compliance`: a `Decision` da **ADR-0021** dizia, sem qualificar, que
  *"ativação, **cancelamento** e retirada de circulação são da primeira [classe]"* — a que exige chave
  de ação — e definia a segunda classe por *"instância declarada"*, com um único membro. A T7 publicou
  `POST /v1/cobrancas/:codigo/cancelamento` exigindo só a área. **A classificação não estava em dúvida**
  (o usuário a escalou e confirmou antes da spec, e o catálogo fechado a sustenta): a ADR que a
  autoriza é que não a registrava. Os **dois gates leram o mesmo parágrafo em sentidos opostos** — o QA
  como escrituração (`BAIXO`), o TR como contradição literal (`ALTO`) —, e a correção era editar uma ADR
  aceita, o que nenhum executor pode fazer. **Nenhuma rodada de correção foi aberta**: o orquestrador
  escalou por `AskUserQuestion` apesar da autorização de "sem pausas" do run, porque emendar o registro
  arquitetural do projeto está fora do que aquela autorização cobre. O usuário escolheu **emendar a
  0021 agora**, entre três saídas (emendar / débito com gatilho no congelamento, no molde do D43 /
  superseder com ADR nova). A emenda nomeia a **entidade** na primeira classe, transforma a segunda
  classe em **roster explícito de três instâncias**, acrescenta `cobranca-e-mora (v1)` ao `Applied in`
  e registra num bloco datado que **a decisão não mudou — mudou o registro dela**. O Gate 2 da rodada 2
  confirmou os três pontos e declarou o `P1` sanado. O que faltou virou o **D25**: o repositório não tem
  convenção para emenda de ADR aceita.

- **⚠️ Um risco que a T7 não pode fechar, e que a T11 precisa conferir antes da F4.** Numa cobrança
  **PAGA com atraso**, a visão publica `diasAtraso: 0` ao lado de `valorJuros` **carimbado e positivo** —
  o `CASE` de `dias_atraso` não foi envolvido em `COALESCE` porque **não existe** coluna
  `dias_atraso_aplicado` com que envolvê-lo. E `diasAtraso` **é** campo publicado
  (`packages/contracts/src/cobranca.ts:363`), então o cliente lê zero dia de atraso com juros de mora
  positivos. Sob a leitura *"dias em atraso AGORA"*, zero é correto para uma cobrança liquidada, e
  nenhum CA da T7 pediu outra coisa — por isso não é achado. Mas a **F4** monta carnê e segunda via
  sobre esse par, e o **CT-533** (T11) e o handoff são os pontos onde a leitura tem de ficar explícita.

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
