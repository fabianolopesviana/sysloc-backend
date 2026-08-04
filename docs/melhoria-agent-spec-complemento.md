# Prompt — Complemento da Melhoria do agent-spec: achados da segunda execução

> **Pré-condição obrigatória**: este prompt **só faz sentido num projeto que já executou integralmente o `melhoria-agent-spec.md`** (escopo incremental em retry + bloqueio seletivo por categoria, soluções S1 a S5). Ele **não substitui** aquele prompt e **não repete** o trabalho dele — complementa-o com achados que só apareceram numa segunda execução, num projeto diferente.
>
> **Como usar**: cole o conteúdo integral deste arquivo (da seção "IDENTIDADE E MISSÃO" em diante) como prompt inicial de uma sessão do Claude Code aberta **na raiz do projeto**.
>
> **Origem**: segunda execução do `melhoria-agent-spec.md`, em 2026-08-03, num backend Node/NestJS/PostgreSQL. Consumiu **4 iterações** do loop adversarial até a aprovação, mais 2 confirmações focadas, e produziu **25 achados**. Os nove consolidados aqui são os que **não estavam previstos** na seção 0 daquele prompt — ou seja, o que a primeira execução não tinha como saber.
>
> **Escopo**: altera **exclusivamente** arquivos de definição do framework agent-spec (`.claude/agents/`, `.claude/rules/`, `.claude/skills/agent-spec-*`). **Não altera código de aplicação do projeto host.**

---

## IDENTIDADE E MISSÃO

Você é um **engenheiro de plataforma sênior** especializado em sistemas de agentes e pipelines de validação automatizada.

Este repositório **já recebeu** as cinco melhorias do `melhoria-agent-spec.md`. Sua missão agora é **investigar** se nove defeitos específicos — descobertos numa execução posterior, em outro projeto — também existem aqui; **corrigir apenas os que existirem**; e comprovar o resultado por meio de um **loop de validação adversarial com subagente** até aprovação.

Você **não** faz parte do framework agent-spec e **não** deve invocá-lo para realizar esta tarefa. Você o está modificando.

**Idioma**: toda a sua saída ao usuário, e todo o texto que você escrever nos arquivos do framework, é em **Português do Brasil (pt-BR)**. Apenas identificadores de código, nomes de campo JSON, comandos de terminal e nomes canônicos em `snake_case` permanecem no idioma original.

---

## 0. A REGRA QUE GOVERNA ESTE PROMPT: INVESTIGAR ANTES DE CORRIGIR

Os nove achados abaixo vieram de **outro** repositório. A instalação do agent-spec **deste** projeto pode estar em versão diferente, pode já ter alguns deles corrigidos, e pode nem ter alguns dos arquivos citados.

**Para cada achado, execute nesta ordem:**

1. **Rode o comando de verificação** que acompanha o achado.
2. **Classifique**: `CONFIRMADO` (o defeito existe aqui) · `AUSENTE` (já correto ou não aplicável) · `DIVERGENTE` (existe algo parecido, mas com outra forma — descreva).
3. **Só corrija os `CONFIRMADO`.** Não "corrija preventivamente" o que está ausente; isso é delta gratuito e superfície de regressão.
4. **Registre os três** em uma tabela no relatório final, com o resultado do comando como evidência.

> **Se a maioria vier `AUSENTE`**, isso é informação valiosa, não fracasso: significa que a instalação daqui divergiu da de lá, e o relatório deve dizer isso. **Pare e reporte** se **nenhum** dos nove for confirmado — provavelmente o `melhoria-agent-spec.md` não foi executado neste repositório, e este prompt não se aplica.

---

## 1. VERIFICAÇÃO DE PRÉ-CONDIÇÃO (primeira coisa a fazer)

Antes de investigar qualquer achado, confirme que a base existe:

```bash
# Os artefatos das cinco soluções devem estar presentes. Espere 4 linhas não-vazias.
grep -rl "Bloqueio Seletivo de Severidade MÉDIA por Categoria" .claude/rules/
grep -rl "antipadroes_verificados" .claude/agents/
grep -rl "attempt_sha" .claude/skills/ | head -3
grep -rl "Ledger de Achados" .claude/rules/
```

- **Tudo presente** → prossiga.
- **Tudo ausente** → **PARE**. Este projeto não executou o `melhoria-agent-spec.md`. Reporte ao usuário e recomende executar aquele prompt primeiro — ele já contém, na versão atual, a maior parte do que está aqui.
- **Parcialmente presente** → **PARE e reporte** o que encontrou. Uma base incompleta torna alguns achados abaixo inaplicáveis e outros perigosos.

---

## 2. OS NOVE ACHADOS

Ordenados por **valor**: os três primeiros podem tornar a melhoria S5 silenciosamente inerte.

---

### C1 — A política nova não alcança os templates de prompt de correção

**Severidade na origem: ALTO.** Foi o achado nº 1 da primeira iteração adversarial.

**O sintoma**: a partição por categoria foi instalada corretamente na rule e nos dois contratos de agente, mas os **templates de prompt de correção** — que são o **único ponto por onde a política chega ao executor** — continuaram enumerando severidade pura:

```
## Problemas Bloqueantes (DEVEM ser corrigidos)
[Para cada problema de problemas.criticos[], problemas.altos[] e problemas.medios[]:]
```

ou, na variante do Tech Review:

```
[Para cada problema com severity == CRITICO, ALTO OU MEDIO:]
```

Isso contradiz a prosa que está logo acima, no mesmo arquivo, e **anula S5 na prática**: um orquestrador que siga o template ao pé da letra manda **todo** médio para correção obrigatória — exatamente o comportamento pré-S5.

**Verificação**:

```bash
grep -rn "Para cada problema" .claude/skills/agent-spec-*run*/ | grep -iE "medios\[\]|== MEDIO|ALTO OU MEDIO"
```

**CONFIRMADO se** alguma linha enumerar médio sem qualificar por categoria. Espere encontrar em **cinco** lugares (SDD ×2, miniSpec `qa-validator-prompt` ×1 e `staff-review-prompt` ×1, TaskCard ×1).

**Correção**:

- Variante do QA → `[Para cada problema de problemas.criticos[], problemas.altos[] e os problemas.medios[] de categoria BLOQUEANTE pela partição da rule (em \`categoria: tests\`, conforme o \`smell\`; categoria ausente/desconhecida ⇒ bloqueante):]`
- Variante do TR → `[Para cada problema com severity == CRITICO, severity == ALTO, ou severity == MEDIO de categoria BLOQUEANTE pela partição da rule (categoria ausente/desconhecida ⇒ bloqueante):]`

---

### C2 — O registro de débito na §2 continua restrito a "baixos"

**Severidade na origem: ALTO.**

**O sintoma**: com S5, o **médio de categoria anotável** passa a ser débito legítimo. Mas todos os pontos que descrevem o que vai para a **§2 (Débitos Técnicos Não Resolvidos)** do `_run/run-report.md` continuam dizendo "baixos". Efeito combinado com C1 e C3: o médio anotável **aprova a task, não entra no prompt como observação, e não entra na §2 — desaparece por completo**, justamente quando a `/agent-spec-debt-resolution` foi atualizada para consumi-lo.

**Verificação**:

```bash
grep -rn -E "por baixo anotado|acumule os baixos|acumular os baixos|os baixos remanescentes|lista de débitos baixos|cada baixo anotado" .claude/
grep -n "severidade baixa não bloqueia\|médios legados quando aplicável" .claude/rules/agent-spec-workflow-rules.md
```

**CONFIRMADO se** houver ocorrências. Na origem eram **~18 pontos**, incluindo a própria rule (cabeçalho do template da §2 e a regra de geração da Seção 2).

**Correção**: trocar "baixos" por **"anotáveis"** em todos eles, definindo o termo uma vez: *anotável = baixo de qualquer categoria **ou** médio de categoria anotável*. E remover da rule a expressão "médios legados quando aplicável" — sob S5, médio anotado é débito **de primeira classe**, não resíduo de política antiga.

---

### C3 — A seção "Observações" do prompt de correção enumera só baixos

**Severidade na origem: MÉDIO.** É o outro lado da tesoura de C1.

**O sintoma**: o item 2 de cada loop de correção promete que o médio anotável "entra no prompt como Observações", mas a seção correspondente do template enumera apenas `problemas.baixos[]` / `severity == BAIXO`. A promessa não tem destino.

**Verificação**:

```bash
grep -rn -A2 "## Observações (baixos" .claude/skills/agent-spec-*run*/
```

**Correção**: renomear o cabeçalho para `## Observações (anotáveis — débito anotado, opcional corrigir agora)` e enumerar `problemas.baixos[]` **+** `problemas.medios[]` de categoria anotável (variante TR: `severity == BAIXO, ou severity == MEDIO de categoria ANOTÁVEL`). Confira também a linha de **item** logo abaixo do cabeçalho — se ela tiver a severidade fixa (`(baixo)`), troque por `([baixo|medio])`; é onde um fix parcial passa despercebido.

---

### C4 — O guardrail de operações git do TaskCard **proíbe** a captura do `attempt_sha`

**Severidade na origem: alta, porém silenciosa.** Não foi achado do validador — apareceu na leitura integral dos orquestradores, e teria tornado S3 inaplicável no TaskCard.

**O sintoma**: o `agent-spec-taskcard-run/SKILL.md` tem, nos guardrails "NÃO DEVE", um item que **enumera taxativamente** as operações git permitidas ao orquestrador:

> *"Operações git permitidas ao orquestrador: `git diff --name-only <base_sha>` e `git add -N`."*

A sequência de captura do `attempt_sha` (`mktemp`, `cp "$(git rev-parse --git-path index)"`, `GIT_INDEX_FILE=… git add -A`, `git write-tree`, `git commit-tree`) **não está nessa lista** — logo, está proibida pelo próprio arquivo que a manda executar.

**Verificação**:

```bash
grep -n -A3 "Operações git permitidas ao orquestrador" .claude/skills/agent-spec-taskcard-run/SKILL.md
```

**CONFIRMADO se** a enumeração não incluir `git write-tree`/`git commit-tree`/`git rev-parse --git-path`.

**Correção**: acrescentar à lista de permitidas (a) `git diff --name-only <attempt_sha_anterior>` — **`--name-only`, nunca conteúdo** — e (b) a sequência completa de captura do `attempt_sha`, com a nota de que ela opera sobre **índice temporário fora do repositório** e não altera o working tree nem o índice do usuário.

> **Generalize a lição**: procure, nos outros dois orquestradores, qualquer guardrail que enumere taxativamente operações permitidas. Uma melhoria que acrescenta um comando precisa passar por todas as listas que o restringem.

---

### C5 — Texto residual da política em arquivos que a lista de "~16" não previa

**Severidade na origem: ALTO (o mais provável modo de falha de S5).**

**O sintoma**: além dos arquivos já mapeados, a política de severidade vaza para três lugares que a primeira execução não listou:

1. **Os `description:` de frontmatter dos três orquestradores** — literalmente a primeira coisa que o harness lê de cada skill. Continham `débito-controlado (críticos/altos/médios bloqueiam; só baixos são anotados)`.
2. **`references/executor-discipline.md`** (existe em **três** cópias, uma por orquestrador) — traz uma linha sobre `speculative_complexity` afirmando que médio bloqueia.
3. **`references/ai-escreve-testes.md`** — afirma que *"todos os 7 gates mapeiam para antipadrões CRÍTICOS ou ALTOS, qualquer violação bloqueia"*. **É falso**: dois dos sete mapeiam para antipadrões **MÉDIO** (`vague_existence_assertion` AP-05 e `duplicate_cross_layer` AP-23), que sob S5 são **anotáveis**.

**Verificação**:

```bash
grep -rn -E "críticos/altos/médios bloqueiam|críticos, altos e médios|todo médio bloqueia|médios? sempre bloque" .claude/ | grep -v "A política anterior"
grep -n "description:" .claude/skills/agent-spec-*run*/SKILL.md | grep -i "médio\|débito-controlado"
grep -rn "todos os 7 gates" .claude/skills/agent-spec-testing-best-practices/
```

**Correção**: alinhar cada um. No `ai-escreve-testes.md`, corrija a **aritmética** (`5 dos 7 gates` mapeiam para CRÍTICO/ALTO e bloqueiam sempre) e acrescente a ressalva dos dois MÉDIO — conferindo a contagem contra a tabela do próprio arquivo antes de escrever o número.

---

### C6 — Cópia parcial da partição no `agent-spec-guide`

**Severidade na origem: MÉDIO.**

**O sintoma**: ao atualizar a explicação da política no `agent-spec-guide/SKILL.md` (a skill que os usuários consultam para entender como os gates decidem), é tentador reproduzir ali a partição. Duas coisas dão errado:

- **A regra de propagação é violada** — a rule reserva o espelho aos **dois contratos de agente**; o guide vira um terceiro espelho não autorizado e sem marcador.
- **O conteúdo sai errado.** Na origem, a redação `"TR: idem mais …"` fez o "idem" herdar a lista do QA, atribuindo ao Tech Review as categorias `logic`, `data_handling` e `concurrency`, que **não existem** no vocabulário dele — 12 categorias onde a rule tem 9.

**Verificação**:

```bash
grep -n -A3 "Médios" .claude/skills/agent-spec-guide/SKILL.md | grep -E "logic|data_handling|concurrency|project_pattern"
```

**CONFIRMADO se** o guide enumerar categorias por gate.

**Correção**: **não enumerar**. Descreva o critério em prosa (*"bloqueia o que indica mudança de comportamento ou de superfície; anota o cosmético/manutenibilidade"*) e remeta à fonte única, com uma nota explicando que a partição literal **não é reproduzida ali de propósito**, porque os vocabulários do QA e do TR são distintos e uma cópia parcial inevitavelmente atribui a um gate categoria que só existe no outro.

---

### C7 — Frases categóricas de fecho são armadilha: distinga **partição** de **vocabulário canônico**

**Severidade na origem: MÉDIO.** Este achado custou **duas** iterações, porque a primeira correção repetiu o erro da segunda forma.

**O sintoma**: ao escrever a regra de propagação, a tentação é fechar com uma frase absoluta — *"Nenhuma outra lista da partição é reproduzida por orquestrador"*. Ela é **falsa**, e por dois motivos diferentes que só aparecem se você medir:

1. Os três orquestradores **reproduzem** a lista `revalidation_required`, que é — item a item, na mesma ordem — a lista **MÉDIO bloqueante do Tech Review**.
2. Ao corrigir isso, a segunda tentativa foi *"Nenhuma lista do vocabulário do QA é reproduzida"* — **também falsa**: os prompts dos gates citam o **vocabulário canônico completo do QA** (as 15 categorias) ao exigir o campo `categoria`.

**A saída é distinguir dois artefatos que parecem o mesmo:**

| Artefato | O que é | Reprodução |
|---|---|---|
| **Partição** | como as categorias se **dividem** entre bloqueante e anotável | restrita aos espelhos autorizados |
| **Vocabulário canônico** | o **domínio de valores** do campo `categoria` | livre — tem outra finalidade |

**Correção**: escreva a exceção **nomeando** as duas listas do TR (`code_review_only` e `revalidation_required`, que são exatamente as duas classes da partição do TR), e feche com uma afirmação **verificável por script**, não categórica. Depois **prove-a**: extraia os identificadores de cada linha de todos os `.md` do `.claude/`, intersecte com o vocabulário canônico, e classifique cada ocorrência como `VOCABULÁRIO COMPLETO` ou `PARTIÇÃO`. Se aparecer `PARTIÇÃO` fora dos arquivos autorizados, a frase é falsa.

> **Lição generalizável**: uma frase de fecho absoluta num contrato de agente é dívida. Ou você a torna **verificável por comando**, ou não a escreve.

---

### C8 — Pares tautológicos em `debt-resolution` — e a armadilha do conserto errado

**Severidade na origem: BAIXO.** Mas o **conserto errado** teria sido defeito real, e é por isso que este achado está aqui.

**O sintoma**: um rename em massa anterior colapsou pares "forma pt-BR / forma inglês" num único token repetido:

```
`APROVADO_COM_OBSERVACOES` / `APROVADO_COM_OBSERVACOES`
problemas `MEDIO`/`BAIXO` (`MEDIO`/`BAIXO`)
Severidade `CRITICO` ou `ALTO` (`CRITICO`/`ALTO`)
Grep(pattern="…|APROVADO_COM_OBSERVACOES|APROVADO_COM_OBSERVACOES", …)
```

**Verificação** — `grep -E` com backreference **falha** no ambiente (`invalid escape`); use Python:

```bash
python3 - <<'PY'
import re, glob, pathlib
pat = re.compile(r"`([A-Za-z][A-Za-z_]{3,})`\s*/\s*`\1`")
for f in sorted(glob.glob(".claude/**/*.md", recursive=True)):
    for n, l in enumerate(pathlib.Path(f).read_text(encoding="utf-8").split("\n"), 1):
        for m in pat.finditer(l):
            print(f"{f}:{n} → {m.group(0)}")
PY
```

**A ARMADILHA — leia antes de corrigir.** O arquivo `references/debt-collection.md` declara uma convenção: *"Severidades em pt-BR quando a origem é o QA (`medio`/`baixo`) e em inglês quando é o Tech Review (`MEDIO`/`BAIXO`)"*. É tentador aplicá-la a **todos** os pares, minusculizando a primeira metade. **Isso está certo para severidade e ERRADO para veredito**, por uma razão verificável:

- **Severidade**: o QA de fato escreve `medio`/`baixo` minúsculo e o TR escreve `MEDIO`/`BAIXO`. A convenção se aplica → **minusculize a primeira metade**.
- **Veredito**: os **dois gates emitem o mesmo literal** `APROVADO_COM_OBSERVACOES`, em maiúsculas. Confirme nos schemas dos dois contratos. **Não existe par pt-BR/inglês para veredito.** Minusculizar criaria `aprovado_com_observacoes` — string que **nenhum gate produz** — dentro de um arquivo que é **especificação de `grep`** para o coletor de débito. Seria trocar uma redundância inofensiva por um padrão que não casa nada. → **Colapse para um token só.**

Antes de mexer no regex do `Grep(...)`, rode `git show HEAD:<arquivo>` e confirme que a alternação duplicada **já era** o mesmo literal duas vezes, e não um par legado que você estaria apagando.

**Cuidado com falso positivo**: uma linha como `` normalizar para `MEDIO`/`BAIXO` (`medio`/`MEDIO`/`MED-` → `MEDIO`; `baixo`/`BAIXO`/`BAIXO-` → `BAIXO`) `` **não** é par tautológico — é tabela de normalização, e está correta. Regex com backtick opcional casa `BAIXO` dentro de `BAIXO-` e a marca por engano.

---

### C9 — A enumeração do coletor de débito perde a forma **acentuada** (`médio`, `crítico`)

**Severidade na origem: BAIXO, mas com perda de dado comprovada.** Este é o achado que o usuário mais quer ver verificado, e ele tem evidência empírica em disco.

**O sintoma**: a skill `/agent-spec-debt-resolution` normaliza severidade por **enumeração de literais**:

```
`severidade`: normalizar para `MEDIO`/`BAIXO` (`medio`/`MEDIO`/`MED-` → `MEDIO`; `baixo`/`BAIXO`/`BAIXO-` → `BAIXO`)
```

Falta a grafia **acentuada** do português — que é exatamente como um LLM escrevendo prosa pt-BR grafa a severidade. Débito registrado como `### D5 · médio · …` **não normaliza e escapa da coleta**.

**Verificação — meça no dado real, não no texto.** Os run-reports do próprio projeto são a prova:

```bash
# formas de severidade realmente escritas nos cabeçalhos §2 deste repositório
grep -rhoE "^### D[0-9]+ · [^ ]+ ·" docs/specs/features/*/*/_run/run-report.md 2>/dev/null \
  | awk -F' · ' '{print $2}' | sort | uniq -c | sort -rn

# onde a spec do coletor enumera formas de severidade
grep -n -E "medio|MEDIO|baixo|BAIXO|MED-|medium" .claude/skills/agent-spec-debt-resolution/references/debt-collection.md
```

**CONFIRMADO se** aparecer qualquer forma acentuada (`médio`, `crítico`, `médios`) na primeira saída **e** a segunda não a cobrir. Na origem: **53 `baixo`, 50 `BAIXO`, 5 `MEDIO` e 2 `médio`** — ou seja, 2 débitos reais que a spec deixava escapar.

**Correção — instale uma REGRA, não mais literais.** Acrescentar `médio` à lista só adia o problema até `MÉDIO` ou `Médio`. Escreva, na **fonte da convenção**:

> **REGRA NORMATIVA — a comparação de severidade é insensível a CAIXA e a ACENTO.** Normalize antes de comparar: remova acentos, minusculize, e só então case contra `critico|alto|medio|baixo`. Em pt-BR o acento afeta **apenas** `crítico` e `médio`; `alto` e `baixo` não têm acento. **As enumerações literais adiante são exemplos das formas mais vistas, NÃO a lista fechada** — quem decide é esta regra.

E alinhe as enumerações derivadas a ela (mapeamento de normalização, filtro do passo de coleta, formato legado one-liner, exclusão de críticos/altos, e o `Grep(...)` de fallback). Verifique também se a skill `SKILL.md` enumera formas por conta própria — um agente pode filtrar ali antes de ler o reference.

**Prova exigida (P4)**: aplique a regra às formas reais que você contou, e demonstre **com controle negativo** que ela (a) recupera o que a enumeração perdia e (b) **não** passou a aceitar lixo (`critical`, `info`, `trivial`, `medioX`, string vazia).

---

## 3. RESTRIÇÕES INVIOLÁVEIS

1. **Não altere código de aplicação do projeto host.** Escopo: `.claude/agents/`, `.claude/rules/`, `.claude/skills/agent-spec-*`.
2. **Não invoque agentes nem skills do framework agent-spec** para realizar ou validar esta tarefa — são os artefatos sob teste, e usá-los é circularidade.
   > Se o projeto tiver convenção de que "toda alteração passa pelo agent-spec", **mencione a exceção em uma linha** e prossiga.
3. **Crie uma branch antes da primeira edição.** Não commite nem faça push sem autorização explícita do usuário.
4. **Só corrija o que a investigação confirmar.** Achado `AUSENTE` não vira edição.
5. **Respeite a nota ANTIDRIFT**: os blocos de gate são espelhados entre três frameworks, o que em arquivos significa **cinco**. Toda alteração num deles é replicada nos outros **na mesma passada**. **Propague com script**, não à mão — um `str.replace` em Python que **imprime a contagem de ocorrências substituídas por arquivo** revela na hora o espelho que ficou para trás (contagem `0` onde se esperava `1`).
6. **Menor delta possível.** Não refatore o que não é a causa-raiz de um achado confirmado. Se encontrar outro problema, **reporte separadamente** em vez de consertar — o Protocolo Antirregressão de projetos que o tenham é explícito: *"cada linha do diff que não serve à correção é superfície de regressão de graça"*.
7. **Verifique empiricamente toda afirmação factual que você escrever.** Se prescrever comando, rode-o. Se afirmar "nenhum X existe", prove por script. Duas iterações da execução de origem foram gastas exatamente em frases categóricas não medidas (ver C7).

---

## 4. LOOP DE VALIDAÇÃO ADVERSARIAL COM SUBAGENTE

Depois de aplicar as correções confirmadas, você **não** declara conclusão por conta própria.

1. Invoque um subagente com `subagent_type: "general-purpose"`. **É proibido** usar `agent-spec-qa-validator`, `agent-spec-staff-architecture-review` ou qualquer skill do framework — seriam os próprios artefatos sob teste.
2. Entregue a ele: o objetivo de cada achado, a tabela `CONFIRMADO/AUSENTE/DIVERGENTE`, a lista de arquivos alterados e os critérios da seção 5. **Não** lhe entregue a sua conclusão de que está tudo certo — isso induz complacência.
3. Instrua-o a **tentar reprovar**: texto residual contraditório, espelhos dessincronizados, campos documentados mas nunca preenchidos, regras órfãs, quebras de retrocompatibilidade.
4. **Instrua-o a caçar regressões introduzidas pelas próprias correções** a partir da segunda iteração. Na execução de origem, **duas das quatro iterações** foram consumidas por defeitos que as correções criaram — não por defeitos originais.
5. Peça **verificação empírica** de toda afirmação factual: comandos rodados de fato, contagens medidas por script, e — no caso de C9 — a prova com controle negativo.
6. Formato de retorno: `{ "veredito": "APROVADO" | "REPROVADO", "achados": [ { "achado": "C1..C9", "arquivo": "", "problema": "", "severidade": "", "correcao_sugerida": "" } ], "criterios_verificados": "N/M", "verificacao_empirica": "", "notas": "" }`.
7. Se `REPROVADO`: corrija **todos** os achados e revalide. Peça também que registre em `notas` as imperfeições que julgou não serem defeito — são baratas de fechar e evitam uma rodada extra.
8. **Se você alterar qualquer coisa DEPOIS de um `APROVADO`** (inclusive cosmético), rode uma **iteração de confirmação focada**, listando exatamente o que mudou. Sem isso, o `APROVADO` cobre uma versão que não é a entregue.
9. **Limite: 5 iterações.** Ao fim da 5ª com achados abertos, **pare e escale** com o que persiste e sua análise da causa.
10. **Conteste o validador quando ele estiver errado.** Na execução de origem, o validador sugeriu para C8 uma correção que teria inventado uma string inexistente; a divergência foi registrada, argumentada com evidência dos schemas, e ele **reconheceu o erro**. Um validador não é autoridade — é adversário. Se discordar, prove.

> **Expectativa calibrada**: 9 achados a investigar, provavelmente menos a corrigir. Se o validador aprovar de primeira, **desconfie** e mande-o verificar especificamente C1, C2 e C7, que são os que mais escapam à leitura.

---

## 5. CRITÉRIOS DE ACEITAÇÃO

- [ ] Pré-condição verificada: o `melhoria-agent-spec.md` está aplicado neste repositório.
- [ ] Os nove achados investigados **com comando rodado**, e cada um classificado `CONFIRMADO` / `AUSENTE` / `DIVERGENTE` com evidência.
- [ ] **C1** — nenhum template de prompt de correção enumera médio sem qualificar por categoria, nos cinco espelhos.
- [ ] **C2** — o destino do débito na §2 fala em **anotáveis** (baixos + médios anotáveis), inclusive na rule; sem "médios legados".
- [ ] **C3** — a seção "Observações" enumera baixos **e** médios anotáveis, e o rótulo do item não tem severidade fixa.
- [ ] **C4** — a lista de operações git permitidas ao orquestrador inclui a captura do `attempt_sha` e o `git diff --name-only <attempt_sha>`.
- [ ] **C5** — zero texto residual da política antiga em **todo** o `.claude/`, incluindo `description:` de frontmatter, `executor-discipline.md` e `ai-escreve-testes.md`; a aritmética dos "7 gates" confere com a tabela.
- [ ] **C6** — o `agent-spec-guide` não reproduz a partição por gate; descreve o critério e remete à fonte única.
- [ ] **C7** — a regra de propagação distingue **partição** de **vocabulário canônico**, nomeia a exceção das duas listas do TR, e a frase de fecho é **verificável por script** (demonstre a saída).
- [ ] **C8** — pares tautológicos zerados; veredito **colapsado** (não minusculizado); severidade minusculizada onde a convenção manda; falso positivo da tabela de normalização **não** tocado.
- [ ] **C9** — regra normativa de insensibilidade a caixa e acento instalada na fonte da convenção, enumerações derivadas alinhadas, e **prova com controle negativo** apresentada.
- [ ] Espelhos sincronizados, diferindo apenas em paths e numeração.
- [ ] Nenhum arquivo de aplicação alterado (`git status` como evidência).
- [ ] Integridade estrutural: numeração de listas contínua, cercas de código balanceadas, tabelas íntegras, sem bullet órfão nem frase truncada.
- [ ] Todo texto novo em pt-BR com acentuação correta.

---

## 6. RELATÓRIO FINAL AO USUÁRIO

1. **Tabela de investigação** — os nove achados × `CONFIRMADO`/`AUSENTE`/`DIVERGENTE`, com a evidência (saída do comando) de cada classificação.
2. **O que foi corrigido**, por achado, em quais arquivos, com uma linha de justificativa.
3. **Iterações do loop** — quantas, e o que o validador pegou em cada uma. Se não pegou nada na primeira, diga explicitamente: é sinal a interpretar com desconfiança, não motivo de comemoração.
4. **Divergências entre este prompt e o estado real** deste framework, e como as resolveu.
5. **O que ficou de fora**, e por quê.
6. **Riscos residuais** e o que observar nos próximos runs.
7. **Estado do git**: branch, arquivos alterados, confirmação de que nada foi commitado nem enviado sem autorização.

Não afirme que algo funciona sem evidência. Se não rodou uma verificação, diga que não rodou.
