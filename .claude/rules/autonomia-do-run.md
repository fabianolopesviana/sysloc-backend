---
description: Autonomia do run — autorização permanente do usuário. Nenhum agente pausa aguardando resposta (a resposta é SEMPRE a opção recomendada) e o limite de tentativas por task não bloqueia o run. Vale para a sessão principal e para TODO subagente, em TODO run, independente do tamanho do contexto.
paths:
  - "**"
---

# Autonomia do Run — autorização permanente do usuário

> **Escopo universal, igual ao do Protocolo Antirregressão.** Vale para a sessão principal **e** para
> todo subagente sem exceção: orquestrador de `*-run-tasks`, executor de task, executor de correção,
> agente de resolução de débito, Gate 1 (QA) e Gate 2 (Tech Review).
>
> **Não é autorização de um run.** É decisão permanente do usuário, dada em 2026-08-16, reafirmada em
> 2026-08-17 e tornada rule em 2026-08-17 porque a forma anterior — declará-la no prompt do run —
> **falhava quando o contexto crescia**: a autorização ficava a centenas de milhares de tokens do
> ponto em que ela era necessária, e o agente voltava ao default do framework. Rule carrega no
> system-prompt, no topo, em toda sessão e em todo subagente. É a única forma que o tamanho do
> contexto não corrói.

---

## 1. Texto literal da autorização

> "Durante TODO esse run (até a finalização de todas as tasks), deixo EXPLICITAMENTE AUTORIZADO que
> qualquer pausa que aconteça esperando minha resposta eu já estou deixando claro que minha resposta
> SEMPRE será o recomendado, então não pause esperando minha resposta pois ele será o que for
> recomendado, NÃO PAUSE O RUN aguardando minha resposta, já assuma como respondido e a resposta é
> sempre o recomendado. E jé deixo EXPLICITAMENTE AUTORIZADO também que PODE exceder o quanto for
> necessário o limite de 3 tentativas, nesse run assuma que não existe esse limite pois estou
> AUTORIZANDO exceder o numero de tentativas o quanto for necessário até não ter mais bloqueios caso
> aconteça."

---

## 2. As três regras operacionais

### A1 · Nenhuma pergunta bloqueia — a resposta é a opção recomendada

Onde o framework mandar `AskUserQuestion`, **não invoque a ferramenta e não pare**. Em vez disso:

1. **Formule a decisão como se fosse perguntar**: as alternativas concorrentes, e **qual você
   recomenda, com a razão**.
2. **Adote a recomendada** e siga.
3. **Registre** em `shared.workflow_report.path` (ou, fora de pipeline, na resposta ao usuário):
   ```
   [<escopo>] decisão auto-resolvida (A1): <pergunta> → adotada a recomendada: <opção> · razão: <1 linha>
   ```

Alcança, nomeadamente: a descoberta interativa do executor, o *resume* pós-interrupção da FASE 0, o
Passo 10 (task bloqueada), os gatilhos de parada do executor e a Iron Rule #1 da Disciplina do
Executor. **Onde essas seções disserem "pergunte ao usuário", leia "decida pela recomendada e
registre".**

> **Isto não é licença para decidir mal.** A obrigação de **formular a recomendação com razão
> explícita** é o que substitui a pergunta — pular a formulação e "seguir em frente" é violação
> desta regra, não cumprimento dela.

### A2 · O limite de 3 tentativas não bloqueia o run

`attempt_count >= 3` **não** marca a task como `Bloqueado` e **não** para o run. Itera-se até não
restar problema bloqueante.

> ⚠️ **Esta autorização removia a única condição de parada do laço — e desde 2026-08-17 ela não remove mais.** O limite de 3 tentativas não era burocracia: era a **garantia de terminação**. Sem ele, *"bloqueia e escala"* virava *"itera até o revisor por acaso não achar nada"* — e a T4 da fatia `emissao-e-conciliacao` fechou em **5 rodadas / 9 invocações de gate** exatamente assim. O que substitui a garantia é a **"Convergência do laço de correção — o MÉDIO a partir da rodada 3"** de
> [`agent-spec-workflow-rules.md`](.claude/rules/agent-spec-workflow-rules.md): da rodada 3 em diante, `MEDIO` inédito e `MEDIO` reincidente por duas rodadas viram débito anotado em vez de rodada nova. **As duas regras se leem juntas** — esta abre o teto para o defeito real (`CRITICO`/`ALTO`, sem limite), aquela fecha a torneira do nitpick médio. Uma sem a outra volta ao laço longo.

O que **permanece** valendo, e não é negociável:

- **O auto-escalonamento de modelo** (`opus[xhigh]` a partir da 3ª tentativa) segue ativo.
- **A regra do ciclo curto** (`nao-regressao.md` §5) segue valendo com força: segunda rejeição do
  mesmo item significa que a leitura do problema está errada — ataque a topologia, não a ocorrência.
- **Cada rodada é registrada** no `workflow-report.md` com o veredito e o motivo, como sempre.
- **Regressão continua sendo regressão**: rodada extra não é licença para afrouxar teste, e o P5 do
  Protocolo Antirregressão prevalece.

### A3 · O run não para entre tasks

**O relatório de fecho de uma task NÃO é o fim do run.** Emitido o fecho da task `Tn`, o passo
seguinte, na **mesma resposta**, é o despacho do executor da próxima task pronta — sem pedir
confirmação, sem aguardar, sem "quer que eu continue?".

O run só termina em **um** de dois estados:

1. **todas** as tasks do `task_plan.md` em estado terminal (`Concluído`); ou
2. interrupção explícita do usuário.

Qualquer outra parada é defeito. O sinal de que ela está prestes a acontecer é reconhecível: você
acabou de regenerar o `_run/run-report.md` e a próxima coisa que leu foi a seção "Relatório Final"
do SKILL — **essa seção só se aplica quando `tasks_completed == tasks_total`.**

---

## 3. Conflito com o Protocolo Antirregressão — como se resolve, sem exceção

`nao-regressao.md` §3.3 manda **PARAR e escalar** diante de marcador `DECISÃO FECHADA` cujo
`REVERTER EXIGE` não se consegue demonstrar, e o mesmo vale para conflito com ADR ativa. **Essa
obrigação NÃO é revogada por esta rule** — o protocolo prevalece sobre qualquer outra instrução do
repositório, e esta rule não é exceção.

O que muda é **só a espera**, não o rigor:

| | Antes | Sob esta rule |
|---|---|---|
| Reconhecer o conflito | obrigatório | **obrigatório** (inalterado) |
| Apresentar o texto literal do marcador contra o que se precisa fazer | obrigatório | **obrigatório** (inalterado) |
| Nomear a opção recomendada e a razão | obrigatório | **obrigatório** (inalterado) |
| **Aguardar a resposta do usuário** | sim | **não** — adota a recomendada e registra |

**E a opção recomendada, nesse caso, é sempre a conservadora**: preservar o marcador, preservar o
código sob ele, e resolver o problema por outro caminho. Marcador `DECISÃO FECHADA` não se altera,
não se move e não se remove sob esta autorização — a autorização é para **não esperar**, nunca para
**contrariar**. Alterar ou remover marcador continua sendo violação crítica.

---

## 4. Como reconhecer que você acabou de violar esta rule

Quatro frases. Se qualquer uma aparecer na sua saída, você violou:

- *"Aguardo sua confirmação para prosseguir."*
- *"Quer que eu continue com a T{n+1}?"*
- *"A task esgotou as 3 tentativas — como deseja proceder?"*
- *"Preciso que você escolha entre (a) e (b)."*

Em todas as quatro, a conduta correta é a mesma: **escolher a recomendada, registrar a escolha e
continuar na mesma resposta.**
