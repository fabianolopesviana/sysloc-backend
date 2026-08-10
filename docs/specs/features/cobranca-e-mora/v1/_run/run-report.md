# Relatório do Run — cobranca-e-mora/v1

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, paralelismo, rule mining) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **4/11 tasks concluídas** · suíte **687 → 801** casos, verde · `pnpm build` e `pnpm lint` verdes.

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T2 | Contrato de tipos da cobrança em `@sysloc/contracts` | opus | 2 criados, 3 mod | ✅ APROVADO_COM_OBSERVACOES | ✅ APROVADO_COM_OBSERVACOES |
| T3 | Schema e migrações da cobrança — tabelas isoladas, a view de fonte única e o contador da série | opus | 3 criados, 9 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T4 | Porta de dados da cobrança — leitura pela view, emissão da série e a prova da mora contra o golden | opus | 2 criados, 6 mod | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |
| T5 | As três rotas de lançamento e leitura da carteira de cobranças | opus | 5 criados, 11 mod | ✅ APROVADO (3 rodadas) | ✅ APROVADO_COM_OBSERVACOES (2 rodadas) |

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

> ### ⏸️ O RUN ESTÁ PAUSADO — leia isto antes de qualquer coisa
>
> **Parado em 2026-08-10, a pedido do usuário.** O ponto exato: o **executor da T6 concluiu** e os
> **dois gates dela ainda não rodaram**. A T6 está `Em Progresso`, com o código no working tree e
> `git add -N` feito — **nada foi perdido**.
>
> **Para retomar**, reinvoque a mesma skill com os mesmos argumentos:
>
> ```
> /agent-spec-sdd-run-tasks docs/specs/features/cobranca-e-mora/v1/task_plan.md sysloc-backend-implementer
> ```
>
> O Passo 4.0.1 vai detectar a T6 em `Em Progresso` e oferecer três caminhos. **O correto é
> (a) "Retomar nos gates"** — reexecutar do zero descartaria trabalho íntegro. O `base_sha` da T6 é
> `fb9391532190d4fa90a452849e213ede32404605`.
>
> **O sumário do executor da T6**, que os gates precisam receber inline, e as **seis notas
> operacionais** que não estão em nenhum artefato de spec (o flake do `CT-907`, o disco em 93%, o
> próximo `Dnn` livre, os avisos vivos para T7 em diante) estão no bloco **"⏸️ PAUSA DO RUN"** ao fim
> do `_run/workflow-report.md`.
>
> **Nada foi commitado.** T2 a T5 estão `staged`; a T6 não, porque os gates dela não aprovaram.

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
