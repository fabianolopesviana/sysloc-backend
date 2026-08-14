# Retomada do run — `documentos-e-confirmacao` v1

> **Pausa controlada em 2026-08-13 (a segunda)**, a pedido do usuário.
>
> ⚠️ **ESTE PONTO NÃO É LIMPO, e a diferença em relação à pausa anterior importa.** Na primeira pausa
> a T6 havia fechado nos dois gates e tudo estava staged. **Agora a T9 está no MEIO de um ciclo de
> correção**: a rodada 2 foi **entregue pelo executor** e **não foi validada por gate nenhum**. Há
> código de produção na árvore de trabalho **sem aprovação**, e ele **não está staged** — de propósito,
> porque o pipeline só faz `git add` depois que os gates aprovam.
>
> 🚨 **NÃO rode `git checkout`, `git stash` nem `git restore` na árvore** — você apagaria a correção de
> um **CRÍTICO de segurança** que custou uma rodada inteira para ser diagnosticada.

---

## Como retomar

```
/agent-spec-sdd-run-tasks @docs/specs/features/documentos-e-confirmacao/v1/task_plan.md sysloc-backend-implementer
```

⚠️ **O passo "Resume pós-interrupção" VAI disparar**, e isso é o desejado — há uma task `Em Progresso`
(a T9), memória lazy recente em `_run/tmp/T9.md` e diff não-staged nos paths declarados dela.
**Escolha a opção (a) "Retomar nos gates".** A opção (b) *"Reexecutar do zero"* **destruiria a
correção do CRÍTICO**.

⚠️ **Repita as duas autorizações no primeiro comando**, senão elas não valem no run novo:

1. **não pausar** — toda pergunta assume a opção recomendada;
2. **sem teto de 3 tentativas** — a correção prossegue até não haver bloqueante.

---

## O passo exato em que a retomada começa

**Gate 1 (QA) sobre a rodada 2 da T9**, em `scan_scope: DELTA`, e depois o Gate 2. A ordem é essa
porque `requires_qa_revalidation` é **`true`** (o bloqueante de maior severidade era
`category: security`).

| | |
|---|---|
| **`base_sha`** | `700d5461ccd513527fbf4a6529a028d8c62315cc` (o HEAD **não se move** — o pipeline nunca commita) |
| **`attempt_sha` da rodada 1 da T9** | `9934f2ef4a8df6bb845a18bde0b12eb0cb2c1c04` — é o `attempt_sha_anterior` a passar aos dois gates |
| **Memória lazy** | `_run/tmp/T9.md` — **leia-a primeiro**. Traz o Ledger com os 7 achados, o JSON do Gate 2, o que a rodada 2 fez item a item, e **o que os dois gates precisam olhar com atenção** |
| **`attempt_count`** | 1 (uma rejeição até agora) |

> `_run/tmp/` está no `.gitignore`, então a memória lazy **existe no disco e não no git**. Ela
> sobrevive à troca de sessão **nesta máquina**. Se ela sumir, o `_run/workflow-report.md` tem a
> telemetria equivalente.

---

## Estado

| | |
|---|---|
| **Tasks** | **9/12 em andamento** — T1..T8 **concluídas e staged**; a **T9 está `Em Progresso`**, na rodada 2 aguardando gate. Faltam **T10, T11, T12** |
| **Suíte** | **1217** casos, por pacote: contracts 297 · auth 89 · db 167 · regua 30 · worker 48 · **api 218** · shared 222 · documentos 146 |
| **Superfície da API** | **88 rotas / 73 manipuladores** — a última rota nova chega em **T11** (→ 89/74) |
| **Git** | **101 arquivos staged** (T1..T8, sem commit) + a árvore de trabalho com a T9 **não staged** |
| **Disco** | ⚠️ **96%, ~1,2 GB livres** — `rm -rf /tmp/sysloc-banco-*` entre execuções, e **um pacote por vez** |

---

## ⚠️ O achado mais grave do run inteiro está nesta correção pendente

O Gate 2 reprovou a rodada 1 da T9 com um **CRÍTICO de segurança**, rastreado **pelo fonte das
bibliotecas** e não por suspeita: **o segredo do portador em claro alcançava o journal pelo próprio
`catch` que deveria protegê-lo.**

`bullmq` empurra `job.data` como **argumento de comando Redis**; o `ioredis` anexa
`err.command = { name, args }` em **qualquer** erro de resposta (`MISCONF`, `OOM`, `NOSCRIPT`,
`LOADING`) e no `abortError` de conexão caída; e a redação de `packages/shared/src/log.ts` **não
alcança** — a chave `command` não casa nenhum radical sensível, e cada `arg` é uma **cadeia** que só
passa por `mascararCredencial`, que trata `usuario:senha@` e `?nome=valor`. **Um JSON com o campo
`segredo` atravessa byte a byte.**

⚠️ **O caminho não é hipotético neste host**: Redis com AOF ligado (invariante 8) e disco em 96% ⇒
`MISCONF Errors writing to the AOF file` ⇒ vazamento. E a corrida do `LIMITE_DE_ENFILEIRAMENTO_MS`
**não protege**: o timeout só ganha quando o servidor não responde; a rejeição por erro de resposta é
imediata e ganha a corrida.

**A correção (não validada)**: saneamento na **fronteira única** — `semRastroDeComando` em
`produtor-de-fila.ts`, aplicada nos **três** pontos por onde erro da biblioteca sairia, com a causa
entrando como **cadeia** e nunca o objeto. Provada com **servidor real** recusando escrita (`OOM`, a
mesma classe do `MISCONF`), mais mutante que reprova.

---

## O que este run já produziu (T7, T8 e a rodada 1 da T9)

**Três defeitos pegos por MEDIÇÃO, e nenhum por leitura:**

- **T7 · Gate 2** — a renderização de **~0,5 s** (cronometrada: 784,9 / 416,7 / 501,1 / 655,8 /
  601,4 ms) corria **dentro** do `sql.begin`, segurando conexão física de um pool que é **único para o
  processo**. Corrigido partindo o método em dois, com a separação imposta pelo **tipo**.
- **T8 · Gate 1** — o ramo `undefined` de `consumirPortador` (**o mecanismo do uso único**) nunca
  executava: trocar o `WHERE` passava em **165/165**.
- **T8 · Gate 2**, depois de o Gate 1 aprovar — o consumo **não reconferia validade**, e uma
  invalidação por reenvio comitada entre resolver e consumir **não impedia** o consumo.

**Dois débitos fechados nas duas pontas**: o **D36 (F2/T8)** na T7, e o **D13 (F3/T5)** na T8.
**Um emitido**: o **D5** desta fatia (extração de texto de PDF em duas cópias; gatilho = o carnê da F4).

**Quatro artefatos de spec emendados pela RN-15**, e o que mais importa: a **§3.2 da `T11.md`** — o
pseudocódigo dela enumerava **dois** desfechos de `undefined` quando passaram a existir **três**.

**Seis rodadas de escrituração** fecharam anotáveis de **classe R3** em vez de deixá-los como débito.

---

## Duas falhas do orquestrador que os gates apontaram — repita a correção, não o erro

1. **Grave os achados do Gate 2 no Ledger.** O Passo 4.2 vale para os **dois** gates; na T8 eu o
   apliquei só ao primeiro, e o Gate 1 da rodada seguinte teve de julgar os achados pelo enunciado do
   prompt em vez do Ledger.
2. **Persista o `attempt_sha` na memória lazy, não só no `workflow-report.md`.** Na T8 isso impediu o
   Gate 1 de diffar rodada 2 → rodada 3 por git. ⚠️ **É a mesma falha que o Gate 2 da T5 já havia
   apontado, e ela voltou** — nesta pausa o `attempt_sha` está gravado nos dois lugares.

---

## Onde está cada coisa

| Arquivo | O que tem |
|---|---|
| `_run/tmp/T9.md` | ⚠️ **A memória lazy da T9** — Ledger, JSON do Gate 2, o que a rodada 2 fez e o que os gates devem olhar. **Não versionada** |
| `_run/run-report.md` | O relatório humano — o que cada task materializou, os **7 débitos** da §2, e as notas para revisão |
| `_run/workflow-report.md` | A telemetria — `base_sha` e `attempt_sha` por task e rodada, vereditos, e as decisões do orquestrador com a razão |
| `_run/rule-candidates.md` | 11 candidatos a regra minerados no run |
| `_run/sdd_state.yaml` | `execution: in_progress`, `tasks_completed: 8` |
| `task_plan.md` (topo) | O bloco de estado corrente, com o que a T11 herda da T8 |
