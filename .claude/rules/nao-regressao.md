---
description: Protocolo Antirregressão — obrigatório para TODO agente e subagente que edite arquivo já existente, com força máxima em ciclo de correção de gate e em resolução de débito. Define as três formas de regressão, o protocolo de 5 passos, o marcador de DECISÃO FECHADA, as proibições absolutas e a regra do ciclo curto. Regra de projeto, não do framework agent-spec — vale para qualquer trabalho neste repositório.
paths:
  - "**"
---

# Protocolo Antirregressão

> **Vale para todo agente e subagente**, sem exceção: sessão principal, executor de task, executor de
> correção, agente de resolução de débito, gates de QA e Tech Review. Aplica-se a **toda edição de
> arquivo que já existia**. Em ciclo de correção de gate e em resolução de débito, aplica-se com
> **força máxima** — é ali que a regressão acontece.
>
> Em conflito com qualquer outra instrução deste repositório, **este protocolo prevalece**, com uma
> única exceção: uma ADR ativa. Se este protocolo e uma ADR se contradisserem, **PARE e escale**.

---

## 1. As três regressões — reconheça qual você está prestes a causar

| # | Forma | Como se manifesta | Quem pega |
|---|---|---|---|
| **R1** | **Regressão de comportamento** | algo que funcionava parou de funcionar | a suíte, se houver teste |
| **R2** | **Regressão de prova** | o teste que pegava o defeito sumiu, afrouxou, virou `skip`, ou o defeito voltou **por caminho novo** que nenhuma asserção cobre | ninguém, até o defeito reaparecer em produção |
| **R3** | **Regressão de decisão** | uma escolha **já debatida e fechada** foi desfeita porque quem editou não sabia que houve debate | **ninguém** — nem compilador, nem suíte, nem gate |

**A R3 é a mais cara e é a razão deste arquivo existir.** Ela não quebra nada hoje: o código volta a
parecer "mais idiomático", o gate não tem como saber que aquela forma esquisita era deliberada, e o
custo só aparece rodadas depois — quando o defeito que a decisão prevenia volta, e o ciclo recomeça
do zero. **Um ciclo de correção longo é quase sempre uma sequência de R3 não detectadas.**

---

## 2. Protocolo obrigatório — 5 passos, nesta ordem

### P1 · Baseline **antes** de tocar em qualquer coisa

Rode a verificação do projeto e **registre o número exato** de casos verdes, antes da sua primeira
edição. Sem baseline você não consegue distinguir *"já estava vermelho"* de *"eu quebrei"* — e essa
confusão é o que faz um agente "consertar" um teste alheio que estava certo.

Se a baseline já estiver vermelha, **isso é informação, não obstáculo**: registre quais casos falham
e por quê, e não os inclua no seu conserto a menos que sejam a sua causa-raiz.

### P2 · Arqueologia do trecho — **antes** de editar, descubra por que ele é assim

Nenhuma linha que você vai alterar nasceu por acaso. Antes de tocar numa região de código já
existente, gaste o pouco tempo que custa descobrir a intenção dela:

1. **Procure o marcador `DECISÃO FECHADA`** no arquivo e ao redor do trecho (seção 3). Se houver, ele
   é vinculante e você não o altera sem escalar.
2. **Histórico do trecho**: `git log -L <inicio>,<fim>:<arquivo>` ou `git blame` na região, e leia as
   **mensagens de commit** — este projeto usa Conventional Commits em pt-BR e elas descrevem intenção.
3. **Memória do pipeline**, quando existir a pasta `_run/` da fatia: grepe o seu tema em
   `_run/run-report.md` (débitos e notas de revisão humana), `_run/workflow-report.md` (vereditos dos
   gates rodada a rodada) e `_run/tmp/T{N}.md` (memória da task em correção). É lá que moram os
   debates já resolvidos.
4. **ADRs**: se o trecho toca decisão arquitetural, leia o texto integral da ADR, não a linha-resumo.

> **Custo/benefício**: isso leva minutos. Reabrir um debate fechado custa rodadas de gate.

### P3 · Declaração **antes** da edição — três linhas por mudança

Para **cada** problema que você for corrigir, escreva, antes de editar:

```
CAUSA-RAIZ: <por que o código estava errado — o defeito, não o sintoma>
POR QUE ISTO FECHA A CLASSE: <por que o defeito não pode voltar por outro caminho>
O QUE ESTA MUDANÇA REMOVE: <todo comportamento, garantia, validação ou prova que deixa de existir>
```

As três são obrigatórias, e cada uma barra um erro diferente:

- **`CAUSA-RAIZ`** barra o conserto do sintoma.
- **`POR QUE ISTO FECHA A CLASSE`** barra o conserto pontual. **Se você não conseguir escrever esta
  linha com convicção, não edite ainda** — o seu diagnóstico ainda não está pronto, e a correção vai
  fechar um caminho enquanto deixa os outros abertos. Este é o passo que encurta o ciclo.
- **`O QUE ESTA MUDANÇA REMOVE`** barra a R3. Quase toda regressão de decisão é escrita por alguém que
  nunca se perguntou o que estava apagando. Se a resposta honesta for *"remove uma verificação /
  um caso de teste / um ramo de tratamento de erro / uma restrição"*, **pare e confirme na seção 4 se
  você tem permissão para removê-lo**.

### P4 · Rede **antes** de declarar o conserto pronto

**Todo defeito corrigido deixa para trás uma prova que reprova se ele voltar.** Corrigir sem deixar a
rede é consertar uma vez e reabrir o ciclo depois.

- Se a stack tem suíte automatizada: o defeito ganha um caso que **falha com o código antigo e passa
  com o novo**. Demonstre isso — reintroduza o defeito numa cópia, veja o caso reprovar, reverta.
  (Neste projeto isso é a **prova de falsificação**, já obrigatória para asserção estática em
  `.claude/rules/testing-stack.md`; aqui ela se estende a **todo defeito corrigido**.)
- Se o defeito não é testável na stack: registre-o com o marcador `DECISÃO FECHADA` (seção 3) no ponto
  do código, que é a rede possível.

### P5 · Baseline **depois** e comparação caso a caso

Rode a verificação de novo e compare com o P1.

> **Qualquer caso que estava verde e ficou vermelho é regressão sua. Reverta a sua mudança e ataque a
> causa por outro caminho — NUNCA ajuste o teste para ele voltar ao verde.**

A única exceção é o teste comprovadamente errado, e ela tem preço: a linha
`SUT_IS_CORRECT_BECAUSE: <por que o código de produção está certo e o teste estava errado>` junto da
alteração. Sem essa linha, alterar um teste que reprovou a sua mudança é **fraude de gate**, e os
gates a tratam como violação crítica.

Compare também **a contagem**: se o total de casos diminuiu, algum teste sumiu. Descubra qual e por quê.

---

## 3. Marcador `DECISÃO FECHADA` — como uma decisão sobrevive a quem não estava na conversa

O relatório da fatia é lido por humanos, uma vez. O código é lido por todo agente que passa por ali.
**A decisão precisa morar onde a tentação acontece** — na linha, não no relatório.

### Forma canônica

Em TypeScript, JavaScript e afins:

```ts
// DECISÃO FECHADA — T3 / Gate 2 · 2026-07-31
// O QUÊ: a redação de credencial tem uma entrada única de despacho.
// POR QUÊ: instalada por ponto de escrita, o vazamento sobreviveu a 4 correções, cada uma
//          fechando um caminho enquanto o defeito reaparecia por outro.
// REVERTER EXIGE: provar que nenhum caminho de escrita alcança o registrador sem passar por aqui.
```

Em shell, Python e afins, o mesmo conteúdo com o comentário da linguagem (`# DECISÃO FECHADA — …`).

Os quatro campos são obrigatórios. O **`REVERTER EXIGE`** é o que transforma o marcador de recado em
contrato: ele diz exatamente o que teria de ser verdade para a decisão deixar de valer.

### Quando registrar (obrigatório)

Escreva o marcador quando fechar algo que se encaixe em **qualquer** destes casos:

- o defeito **já tinha voltado** ao menos uma vez, por caminho diferente;
- um gate **rejeitou o mesmo item duas ou mais vezes**;
- a forma escolhida é **menos óbvia** que a alternativa idiomática, e você só a escolheu depois de
  descartar a óbvia por razão concreta;
- a decisão foi tomada **em debate com o usuário** ou por veredito explícito de um gate.

Fora desses casos, **não** registre — marcador em decisão trivial vira ruído e ensina todo mundo a
ignorar os marcadores que importam.

### Como tratar um marcador existente (regra rígida)

1. **Leia-o antes de editar** o trecho que ele cobre.
2. **Não altere, não mova, não reescreva e não remova** o código sob o marcador, nem o próprio
   marcador, sem que o `REVERTER EXIGE` esteja **demonstravelmente** satisfeito.
3. Se a sua correção **exigir** contrariar um marcador: **PARE e escale ao usuário** via
   `AskUserQuestion`, apresentando o texto literal do marcador contra o que você precisa fazer. Não
   escolha um lado para adiantar.
4. **Remover ou esvaziar um marcador é violação crítica**, e os gates a tratam como tal — mesmo que o
   código ao redor esteja correto.

> Este é um **quarto gatilho de parada**, somado aos três da Disciplina do Executor (requisito
> ambíguo / arquivo fora de escopo / conflito com ADR).

---

## 3-B. Marcador `DÉBITO COM GATILHO` — como um débito sobrevive ao fim da fatia

> **Por que `3-B` e não `4`**: as seções 4 a 7 já são citadas pelo número em relatórios de run
> fechados (`_run/run-report.md`, `_run/workflow-report.md`), que são registro histórico e não se
> reescrevem. Esta seção entra aqui porque é o complemento de §3, sem renumerar o resto.

O débito de uma fatia é registrado na §2 do `run-report.md` dela. Isso basta enquanto a fatia está
aberta, e **deixa de bastar no instante em que ela fecha**: uma sessão nova não carrega o relatório
da fatia anterior — carrega o `CLAUDE.md` e as rules de `.claude/rules/`, e o **P2** acima manda
grepar o `_run/` *da fatia corrente*. O débito que vai morder daqui a três fatias fica, portanto,
escrito num arquivo que ninguém vai abrir na hora em que ele morde. Vale para o débito o mesmo que
a §3 diz da decisão: **ele precisa morar onde a tentação acontece.**

### Ele é o oposto de `DECISÃO FECHADA` — não os misture

| | `DECISÃO FECHADA` (§3) | `DÉBITO COM GATILHO` |
|---|---|---|
| **Diz** | *isto está resolvido; não mexa* | *isto está aberto de propósito, e eis quando fecha* |
| **Função** | **protege** — o código sob ele é intocável | **agenda** — o código sob ele vai mudar |
| **Sai quando** | o `REVERTER EXIGE` for demonstrado | o gatilho chegar e o débito for fechado |

Misturar os dois arruína os dois. Débito lido como decisão fechada **congela o que deveria mudar**;
decisão fechada lida como débito **convida a rodada seguinte a reabrir o que custou rodadas para
fechar**. A §3 já adverte que marcador em coisa trivial "ensina todo mundo a ignorar os marcadores
que importam" — marcador de **natureza trocada** faz pior: ensina a ler errado os que estão certos.
Por isso os dois nunca se substituem, e quando convivem no mesmo arquivo o texto de cada um tem de
deixar óbvio o que ele alcança.

### Forma canônica

```ts
// DÉBITO COM GATILHO — D25 · F0/T5 · registrado 2026-08-01
// O QUÊ: <o que está incompleto, em uma frase>
// QUANDO FECHA: <a condição concreta que obriga a agir — não "algum dia">
// POR QUE NÃO AGORA: <por que adiar é a decisão certa hoje>
// ÍNDICE: docs/specs/features/<fatia>/<versão>/_run/run-report.md §2, D25
```

Em shell, Python e afins, o mesmo conteúdo com o comentário da linguagem
(`# DÉBITO COM GATILHO — …`). Os quatro campos são obrigatórios, mais o `ÍNDICE`: o marcador é um
**ponteiro curto**, e o detalhe (impacto medido, o que fazer, prova de falsificação exigida) fica
no relatório, que é onde ele já está escrito por extenso. Marcador que copia o relatório inteiro
apodrece — o relatório é corrigido e a cópia não.

### Quando emitir (e quando não)

- **Só para débito com gatilho concreto** — uma condição que se possa *reconhecer quando chegar*
  ("quando a fatia de autenticação entrar", "quando o terceiro consumidor importar X"). Débito sem
  gatilho fica **só no relatório**: marcador para ele é ruído, e ruído desarma os que importam.
- **Mora onde a tentação acontece** — no arquivo, e junto do símbolo, que a fatia futura vai abrir
  para fazer exatamente a coisa que o débito condiciona. Não no relatório, não num índice avulso.
- **Ao fechar o débito, o marcador sai junto**, no mesmo commit da correção. Marcador de débito já
  resolvido é **pior que nenhum**: ele mente sobre o estado do código, e o próximo agente gasta uma
  rodada reabrindo o que já estava fechado.
- Ele **não protege nada**. Diferente de §3, editar o código sob um `DÉBITO COM GATILHO` é normal —
  o que não se pode é editá-lo **sem ler o marcador**, porque ele diz o que ainda falta ali.

### Como um débito é identificado — o número sozinho não basta

> Esta regra morava no bloco "Débitos com gatilho ativo" do `CLAUDE.md`. Ela **não podia** ficar
> lá: aquele bloco é declarado derivado e transitório logo abaixo, e o ciclo de vida manda
> **apagá-lo inteiro** quando o último marcador sair — a regra iria junto, e a colisão voltaria a
> ser descoberta do zero pela primeira fatia que registrasse um `Dnn` repetido.

**O identificador de um débito é o par `Dnn · F{n}/{origem}` mais o caminho do `ÍNDICE` — nunca o
número sozinho.** A sequência `Dnn` corre **dentro da §2 do `run-report.md` da fatia que a
registrou**, e não globalmente. Três consequências, todas verificadas neste repositório:

- `D6` da F1 e `D6` da F0 são débitos **diferentes**, e ambos legítimos. O mesmo vale para `D7`,
  `D28` e `D32`, que hoje existem em duas fatias cada.
- Ao registrar um débito novo, o número seguinte sai da **§2 da fatia corrente** — não da sucessão
  dos marcadores existentes. Confundir o conjunto dos marcadores com o conjunto dos débitos foi a
  causa das três colisões de numeração da F1, uma delas vinda de um gate.
- A `{origem}` é **`T{n}`** quando o débito nasce numa task, e **`fechamento`** quando nasce fora do
  pipeline — numa intervenção dirigida, numa revisão de fecho de fatia. As duas formas são
  canônicas; o que não se admite é origem ausente, porque é ela que separa dois `Dnn` homônimos. A
  numeração é a mesma sequência da §2 da fatia, sem faixa reservada: o débito descoberto no fecho da
  F1 é o `D38` porque o último do run daquela fatia era o `D37`.

### Ciclo de vida do índice no `CLAUDE.md`

O bloco de débitos com gatilho do `CLAUDE.md` é **derivado destes marcadores**, nunca uma lista
paralela — ele existe apenas porque uma sessão nova lê o `CLAUDE.md` antes de abrir qualquer
arquivo, e precisa saber que os marcadores existem para procurá-los.

- **Emitiu um marcador?** Acrescente a linha correspondente ao bloco.
- **Fechou o débito e removeu o marcador?** Remova a linha.
- **Removeu o último marcador?** **Apague o bloco inteiro do `CLAUDE.md`** — cabeçalho, aviso e
  tabela. Um índice vazio, ou que aponte para marcador que não existe mais, é a mesma mentira do
  marcador órfão, e chega a **todo** agente antes de qualquer arquivo do repositório.

A condição é verificável numa linha, e ela tem de estar escrita **tanto aqui quanto no bloco**:

```bash
# vazio ⇒ o bloco do CLAUDE.md não deve mais existir
grep -rl --exclude-dir=dist "DÉBITO COM GATILHO" apps packages deploy
```

**No fecho de fatia, confira as DUAS pontas** — é a checagem que pegou um par `Dnn · F{n}/T{n}`
errado na F1, e ela roda nos dois sentidos:

1. **Marcador → registro**: para cada marcador no código, existe `### D{n}` na §2 do `run-report.md`
   que o `ÍNDICE` nomeia, e a **origem** do cabeçalho bate com a linha do `CLAUDE.md`. A origem é
   `F{n}/T{n}` para débito nascido numa task, e `F{n}/fechamento` para o que nasceu numa
   intervenção dirigida fora do pipeline — quem confere aceita as duas formas.
2. **Índice → marcador**: para cada linha do bloco do `CLAUDE.md`, existe marcador vivo no código.
   Linha sem marcador é **débito já fechado que ficou no índice** — a mesma mentira do marcador
   órfão, na direção contrária.

> **Cuidado com a forma do cabeçalho na §2.** A F0 numera `### D28 · … · T5 · …`, sem o prefixo
> `F0/`, porque é anterior à convenção do par. Relatório de fatia fechada é registro histórico e
> **não se reescreve** — quem confere é que tolera as duas formas.
>
> **E não escreva `**Dnn** (F{n}/T{n})` fora da tabela**, nem para dizer que um débito foi fechado:
> a checagem do sentido 2 varre essa forma, e a menção vira falso órfão. Débito fechado sai do
> índice; se o fecho merecer nota, ela vai em prosa, sem a forma do índice.

O `--exclude-dir=dist` não é ornamento: o `dist/` é saída de build (ignorada pelo git) e espelha o
comentário do fonte, de modo que sem ele o mesmo marcador é contado duas vezes e o índice parece
maior do que é.

---

## 4. Proibições absolutas — sem julgamento, sem exceção contextual

1. **Nunca enfraquecer, remover, pular (`skip`/`only`/`todo`) ou comentar um teste para fazer um gate
   passar.** Teste vermelho é informação sobre o código, não obstáculo administrativo.
2. **Nunca afrouxar uma asserção** — trocar valor exato por "existe", tipo específico por genérico,
   contagem exata por "foi chamado", objeto inteiro por presença de campo. Toda troca nessa direção
   é regressão de prova (R2), ainda que o teste continue verde.
3. **Nunca remover validação, guarda, timeout, tratamento de erro, liberação de recurso ou redação de
   segredo que você não introduziu.** Se ela parece desnecessária, ela provavelmente resolveu um
   defeito que você não viu — vá para o P2.
4. **Nunca substituir prova comportamental por prova mais frouxa** (estática, por presença, por
   snapshot aceito sem leitura).
5. **Nunca "aproveitar que estou aqui"** para refatorar o que não é a sua causa-raiz. Cada linha do
   diff que não serve à correção é superfície de regressão de graça.
6. **Nunca resolver por conta própria** um conflito com marcador `DECISÃO FECHADA`, ADR ativa ou
   decisão registrada no `_run/` da fatia. Escale.
7. **Nunca declarar concluído** sem o P5 (baseline comparada).

---

## 5. Regra do ciclo curto — como não entrar no laço longo de correções

O laço longo tem uma assinatura reconhecível: **o mesmo defeito reaparece por um caminho novo a cada
rodada**, e cada correção fecha exatamente o caminho apontado.

Quando isso acontecer:

- **Pare de consertar caminhos.** O defeito é **estrutural** — a propriedade está instalada em pontos
  quando deveria ter uma entrada única. Ataque a topologia, não a ocorrência.
- **Segunda rejeição do mesmo item significa que a sua leitura do problema está errada**, não que a
  correção foi tímida. Releia o enunciado do problema e o código ao redor **antes** de escrever
  qualquer linha nova.
- **Um bloqueante, uma mudança.** Correção grande é correção com regressão embutida: quanto maior o
  diff do conserto, maior a chance de você quebrar algo que ninguém pediu para você tocar.
- **Ao fechar um defeito que já tinha voltado, registre o marcador `DECISÃO FECHADA`.** É o que
  impede a rodada seguinte de reabrir o que você acabou de fechar.

---

## 6. Obrigações dos gates e do orquestrador

**Gate 1 — QA**
- Comparar contra a tentativa anterior: teste que existia e sumiu, ou asserção afrouxada sem a linha
  `SUT_IS_CORRECT_BECAUSE:`, é **CRÍTICO** (AP-24, *weakening test to pass*).
- Conferir a contagem de casos entre rodadas. Queda inexplicada é regressão de prova.
- Verificar a rede do P4: defeito corrigido sem prova que o pegue de volta é problema de
  `categoria: tests`.

**Gate 2 — Tech Review**
- Alteração, movimentação ou remoção de código sob marcador `DECISÃO FECHADA` sem escalada é
  **CRÍTICO**, `category: architecture`. Remoção do próprio marcador, idem.
- Verificar no diff se a correção removeu garantia (validação, guarda, tratamento de erro) —
  cruzando com a linha `O QUE ESTA MUDANÇA REMOVE` que o executor deve ter declarado.

**Orquestrador de execução**
- Injetar o ponteiro para este protocolo no prompt de **todo** executor, e com destaque no prompt de
  **correção**.
- No ciclo de correção, passar ao executor o **histórico das rodadas anteriores** — não só o veredito
  da última. Executor que só vê a rejeição atual reabre o que a rodada anterior fechou.

---

## 7. Por que este protocolo existe — a evidência é deste repositório

Não é doutrina importada. Os dois padrões abaixo foram observados e documentados nesta base de código:

- **"Corrigir o caso apontado não é corrigir a classe."** Um vazamento de credencial no registro
  estruturado sobreviveu a **quatro** correções, cada uma fechando com precisão o caminho apontado,
  enquanto o defeito reaparecia por outro — objeto com serialização própria, herança da propriedade na
  cópia redigida, promoção da mensagem para a chave de topo, posição na raiz do evento. Só fechou na
  quinta rodada, quando o executor foi obrigado a escrever **por que aquilo fechava a classe** antes de
  editar. Daí vem a linha obrigatória do P3.
- **"Provou-se o que era fácil provar."** Três de cinco rodadas de outra task caíram por asserção que
  **não podia falhar** pelo defeito que perseguia — provava o predicado, a posição e o texto, e deixava
  sem asserção a combinação de entradas que discrimina e o efeito terminal. Daí vem a prova de
  falsificação do P4.

Em ambos os casos **o código estava certo em quase todas as rodadas**. O que faltava era a prova, e a
memória de que aquilo já tinha sido resolvido. É exatamente isso que este protocolo instala.
