# Prompt do Gate 1 — agent-spec-qa-validator (FASE 3.3)

> **⚠️ ANTIDRIFT — seção espelhada entre frameworks**: o conteúdo de gates/loops deste arquivo é ESPELHO do equivalente em `agent-spec-sdd-run-tasks/SKILL.md` (Gate 1/Passos 1-5) e `agent-spec-taskcard-run/SKILL.md` (Passo 4 + Passo 6) — difere apenas em paths e numeração de seções. **Toda alteração DEVE ser replicada nos espelhos no mesmo PR.** Histórico: a divergência entre os 3 frameworks já produziu políticas contraditórias (zero-débito vs débito-controlado) — auditoria de jun/2026.

> Referência consumida por `SKILL.md` da skill `agent-spec-minispec-run-tasks`.
> Leia este arquivo **antes de invocar o Gate 1** (FASE 3.3).
> Contém o prompt completo do `agent-spec-qa-validator` e os passos de preparação (3.1, 3.2, 3.3, 3.4, 3.5).
> Use exatamente o texto da seção "Disparar o QA" como `prompt` no `Agent({...})`.
>
> **Pré-requisito de leitura**: [`config.md`](config.md) — necessário para resolver `qa_model` (regras de escalação `agent-spec-qa-validator`) e os campos de `qa_summary_fields`. Leia `config.md` **antes** deste arquivo se ainda não o fez.

---

## FASE 3 — Gate 1 — QA (agent-spec-qa-validator)

> **Único gate que executa testes.**
>
> **Pré-verificação**: se `gates: none` → não invoque QA. Se `gates: [qa]` ou `[qa, tech_review]` → siga.

### 3.1 Preparar arquivos para o QA (lista enxuta)

Inclua:
- **Task implementada** (path via `minispec.tasks.dir` + `minispec.tasks.pattern`)
- **Arquivos REALMENTE tocados** pelo executor: rode VOCÊ (orquestrador) `git diff --name-only <base_sha>` e use essa lista como autoritativa — o QA é proibido de rodar git. NÃO monte a lista apenas das seções declaradas da task (isso tornaria a Camada 0 circular). Em `instrucoes`, declare: "A lista `arquivos` reflete o `git diff --name-only` real da task — use-a como fonte de 'tocados' na Camada 0."
  - **Filtro de resíduo de tasks anteriores**: o stage das tasks aprovadas NÃO move o HEAD — se uma task anterior foi staged sem commit do usuário, os arquivos dela aparecem no diff desta. **Subtraia da lista** os paths staged por tasks anteriores no mesmo run (registrados nos logs de stage), EXCETO os que esta task também declara nas suas seções de arquivos (overlap legítimo). Sem o filtro, a lista "tocados pela task" mente para a Camada 0 e o QA gasta leitura em arquivos de outra task.
  - **Pré-requisito (FASE 2.4)**: o `git add -N -- <task_paths>` JÁ deve ter rodado após o executor. Sem ele, arquivos **novos** (untracked) não aparecem no `git diff --name-only` e a Camada 0 reportaria `arquivos_a_criar_faltantes` falsamente. Se a lista vier sem nenhum dos arquivos declarados em "a Criar", suspeite de `git add -N` faltante ANTES de despachar o QA — rode-o e refaça o diff.
- **Arquivos de teste** criados/modificados (padrão da stack)
- **`design.md` da feature** (via `design.feature.path`) — **apenas** se a task é de camada UI e o referencia como arquivo de referência: é o contrato visual que o QA usa na Camada 4 (Completude) para validar os estados visuais implementados. Junto com o `design.md`, inclua também o `design-system.md` global (via `design_system.global.path`) **se existir** — padrões canônicos do produto que o design da feature pode referenciar sem repetir (precedência de leitura: global → feature).

> `base_sha` e `executor_summary` viajam **inline em `instrucoes`** (3.2), não em `arquivos[]`.

**NÃO inclua** (evita duplicar contexto e tokens):
- `CLAUDE.md` e `.claude/rules/*.md` (já no contexto do subagente)
- SCOPE e INTENT completos — passe apenas os **paths** em `instrucoes` como referência opcional (o QA consulta sob demanda se precisar)

### 3.2 Preparar `instrucoes` para o QA

1. **ID e nome** da task (contexto)
2. **Contexto da execução** (inline — substitui o execution-summary):
   ```
   - base_sha: <SHA capturado em 2.1>
   - Sumário do executor:
     <output enxuto de 4-6 linhas retornado pelo executor>
   ```
3. **Critérios de conclusão** da task — o QA valida CADA critério
4. **Testes definidos** na task — o QA executa e verifica
5. **Rastreabilidade de testes (BLOQUEANTE)**: lista de IDs (CT-01, CT-02, ...) da seção de Testes. Instrução literal:
   > "Cada CT DEVE ter teste correspondente implementado no código. Testes ausentes/vazios/skip/todo para CTs exigidos = REJEITADO na camada COMPLETUDE."
6. **Comando de teste**: o QA resolve pela precedência de descoberta de stack — (1) rule `.claude/rules/testing-stack.md` se existir; (2) CLAUDE.md/rules; (3) manifest do projeto (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `pubspec.yaml`, `pom.xml`, `build.gradle`, etc.), scripts e CI — e executa o canônico.
7. **Caminhos de referência opcionais**: `minispec.scope.path` e `minispec.intent.path` — consulta sob demanda. Se a task referencia o `design.md`, instrua: "Estados visuais (loading/erro/vazio/sucesso) devem corresponder ao especificado no design.md — divergência é problema de COMPLETUDE."
8. **Economia de Leitura**: "Não leia arquivos desnecessários ao escopo desta task."

### 3.3 Disparar o QA

Resolva `qa_model` (ver `references/config.md` §4 da Lógica de Seleção de Modelo):

```
Agent(
  subagent_type = "agent-spec-qa-validator",
  model         = qa_model,             # sonnet | opus
  description   = "QA validar task TN",
  prompt        = <prompt abaixo>
)
```

Prompt:

```
Você foi invocado com os seguintes parâmetros:

1. **arquivos**: [lista de caminhos preparada em 3.1]
2. **instrucoes**: [conteúdo preparado em 3.2]

## Escopo da varredura (APENAS em retry — omita o bloco inteiro na rodada 1)
- `scan_scope`: DELTA
- `delta_arquivos`: [saída de `git diff --name-only <attempt_sha_anterior>`]
- `delta_simbolos`: [símbolos alterados extraídos do diff textual — OMITA o campo se não conseguir extrair]
- Memória lazy (contém o **Ledger de Achados**): [path resolvido via `shared.temp_memory.dir` + `shared.temp_memory.pattern`]

Em `scan_scope: DELTA`, restrinja a varredura à união de (a) `delta_arquivos`, (b) arquivos dos achados com status `aberto` no Ledger e (c) o **raio de impacto** — quem importa/consome o que mudou em (a). Aplique as dispensas por camada da seção "ESCOPO DA VARREDURA" do seu contrato. **A ausência de `delta_simbolos` NÃO justifica cair para `FULL`**: use o raio de impacto por arquivo. Se o raio de impacto não puder ser determinado com confiança, **caia para `FULL`** e registre o motivo em `observacoes`. A **Camada 7 (execução da suíte) roda integralmente de qualquer forma**.

Quando este bloco estiver ausente, `scan_scope` é `FULL` — comportamento integral.

OBRIGATÓRIO: Antes de produzir o JSON final:

1. Leia (Read) a doutrina de testes — `.claude/skills/agent-spec-testing-best-practices/SKILL.md` e `.claude/skills/agent-spec-testing-best-practices/references/antipadroes.md` — e aplique a Camada 5 (Qualidade dos Testes) usando o checklist de antipadrões. Cada antipadrão detectado em arquivos de teste tocados pela task vira um item em `problemas.*` com o campo `smell` preenchido (nome canônico). Severidade **e categoria** determinam o veredito conforme a política de bloqueio seletivo (críticos e altos sempre bloqueiam; médio em `categoria: tests` bloqueia ou anota conforme o campo `smell`; baixos viram observações). Popule também `testing_smells.red_flags_detectadas[]`, `mock_budget_violado` e `determinismo_observado`.

   **Sweep mecânico obrigatório (Camada 5 — cobertura por arquivo, não amostragem)**: percorra o checklist de antipadrões **integralmente, em CADA arquivo de teste** criado ou modificado. Cobertura parcial de arquivos NÃO satisfaz a camada. Declare o resultado em `antipadroes_verificados[]` — **um item por arquivo de teste tocado**, com `aps_verificados`, `aps_nao_aplicaveis`, `detectados` e `herdado_da_rodada`. O que não for declarado como verificado considera-se **não verificado**; array vazio APENAS quando nenhum arquivo de teste foi tocado.

2. **Aplique a Camada 6 (ADR Compliance Light)** — leia [path resolvido via `adr.index_file` — default `docs/adr/INDEX.md`] (ou liste o diretório `adr.dir`), identifique ADRs ativas grep-detectáveis e cruze com os arquivos tocados pela task. Violações claras viram `problemas.*` com `categoria: "adr_compliance"`. Popule `adr_compliance.violacoes_grep_detectaveis[]`.

3. **Detecte duplicatas semânticas (AP-26)** — para cada par de testes nos arquivos tocados, compare tupla `(test_name_normalizado, alvo_chamado, parametros_chave, resultado_esperado)`. Coincidência em ≥ 3 dos 4 campos sem justificativa → reporte como `MÉDIO` em `problemas.medios[]` com `categoria: "code_quality"`. Não confundir com table-driven (UM teste parametrizado é OK).

4. **Categoria obrigatória** em cada item de `problemas.*` — usar valores canônicos da rule `.claude/rules/agent-spec-workflow-rules.md` (`architecture`, `security`, `tests`, `logic`, `data_handling`, `error_handling`, `performance`, `concurrency`, `code_quality`, `naming`, `style`, `documentation`, `dead_code`, `imports`, `adr_compliance`). Default conservador → `revalidation_required` quando incerto.

5. **Campo `smell` obrigatório em todo problema com `categoria: "tests"`** (nome canônico snake_case). É por ele que a partição de bloqueio seletivo decide se um médio de teste bloqueia ou vira débito anotado — `smell` vazio força o default conservador (bloqueante). Ver `.claude/rules/agent-spec-workflow-rules.md` → "Bloqueio Seletivo de Severidade MÉDIA por Categoria".
```

**IMPORTANTE**: preserve o JSON completo retornado pelo QA. Será usado:
- Sumário mínimo → input do Tech Review (4.2)
- Em rejeição → memória lazy (3.5)

### 3.4 Interpretar o resultado do QA

> **Política débito-controlado com bloqueio seletivo por categoria**: bloqueia o que é risco real — **críticos e altos sempre**, mais os **médios de categoria bloqueante**. Anota como débito os **baixos** e os **médios de categoria anotável**, na §2 do `_run/run-report.md` para cleanup futuro. A partição canônica está em [`agent-spec-workflow-rules.md`](.claude/rules/agent-spec-workflow-rules.md) → **"Bloqueio Seletivo de Severidade MÉDIA por Categoria"** — **consulte-a; não a reproduza aqui** (o orquestrador roda no contexto principal, com a rule carregada; a regra de propagação assimétrica reserva o espelho aos contratos de agente).
>
> Lembrete operacional: em `categoria: tests`, quem decide é o campo `smell` — **vazio ou ausente ⇒ bloqueante** (default conservador); **categoria ausente ou desconhecida ⇒ bloqueante**.

| Veredito | Bloqueantes | Anotáveis (baixos + médios anotáveis) | Ação |
|---|---|---|---|
| `APROVADO` | 0 | 0 | QA aprovado → avançar para Gate 2 |
| `APROVADO_COM_OBSERVACOES` | 0 | ≥ 1 | QA aprovado com débito anotado → avançar para Gate 2; **acumular os anotáveis** para a **§2 do snapshot `_run/run-report.md`** (um bloco `### D{n} · {severidade} · {categoria} · T[N] · QA` com `Onde`=`[arquivo]:[linha]`, `Problema`=`titulo`, `Impacto`=`descricao`, `O que fazer`=`correcao_sugerida` — formato em `agent-spec-workflow-rules.md`) |
| `REJEITADO` | ≥ 1 | qualquer | Enviar os bloqueantes ao executor (3.5); os anotáveis como observações opcionais |

> **Cláusula de divergência de veredito (OBRIGATÓRIA)**: se o QA devolver `REJEITADO` mas **nenhum** dos problemas for bloqueante pela partição, **NÃO dispare rodada de correção** — seria queimar uma das 3 tentativas por achado que a política manda anotar. **Reclassifique** para `APROVADO_COM_OBSERVACOES`, siga para o Gate 2, trate os anotáveis como débito e logue em `shared.workflow_report.path`:
>
> ```
> [T{N}] veredito reclassificado: QA devolveu REJEITADO sem bloqueante pela partição → APROVADO_COM_OBSERVACOES (médios anotáveis: <categorias>)
> ```

#### 3.4.0 Convergência do laço: o MÉDIO a partir da rodada 3 (aplica-se aos DOIS gates)

> **Regra canônica**: [`agent-spec-workflow-rules.md`](.claude/rules/agent-spec-workflow-rules.md) → **"Convergência do laço de correção — o MÉDIO a partir da rodada 3"**. **Consulte-a; o que segue é o procedimento.**
>
> **É SEU, nunca do gate.** Os gates reportam com honestidade em qualquer rodada — os contratos deles proíbem rebaixar ou omitir por causa da rodada. Quem converte é o orquestrador, porque o estado que a regra lê (número da rodada e `fingerprint` no Ledger) só existe aqui.

Aplique **antes** de montar o conjunto de bloqueantes (3.5), na interpretação do veredito de **cada** gate. `rodada` = `attempt_count + 1`.

1. **Rodada 1 ou 2** → nada a fazer; a partição de categoria vale integralmente.
2. **Rodada ≥ 3** → considere **apenas** os `MEDIO`/`medio` **de categoria convergível**:

   ```
   architecture · performance · testability · speculative_complexity
   ```

   **Categoria fora desta lista NÃO converge, nunca** — `logic`, `data_handling`, `error_handling`, `concurrency`, `security`, `adr_compliance`, `technical_requirement`, `scope_deviation` e `tests` seguem bloqueando como `CRITICO`/`ALTO`. Categoria ausente ou desconhecida também não converge (lista positiva e fechada — ver a rule). Para cada item que sobrar, calcule o `fingerprint`:
   - **C1 — `fingerprint` INÉDITO no Ledger** ⇒ não bloqueia; entra como `status: aceito_como_debito`, `rodada_origem` = corrente.
   - **C2 — já no Ledger, `aberto`, tendo bloqueado DUAS rodadas** ⇒ não bloqueia mais; vira `aceito_como_debito` **preservando a `rodada_origem` original**.
   - Caso contrário ⇒ segue bloqueante.
3. **`CRITICO`/`ALTO` ficam FORA**, em rodada nenhuma: bloqueiam sempre, sem limite. **Também ficam fora**: teste falhando, CT exigido sem teste e critério de aceite `FALHOU`/`PARCIAL` — os dois primeiros são `CRITICO` por contrato, o terceiro vive em `criterios_falhos[]`, que não é item de severidade. **É por isso que a convergência não pode fechar uma task com a aplicação quebrada.**
4. **Escriture cada convertido** na §2 do `_run/run-report.md`, com `arquivo`/`linha`/`correcao_sugerida` preservados. Convertido e não escriturado é achado **perdido**.
5. **Logue** uma linha por item: `[T{N}] convergência (rodada {k}): {C1|C2} · {finding_id} {severidade}/{categoria} → aceito_como_debito · {fingerprint}`.
6. Se não sobrar bloqueante ⇒ aplique a **Cláusula de divergência** acima e siga o fluxo normal.

> **Por que da 3, e não da 2**: a rodada 2 revisa a primeira correção, e médio novo ali ainda pode ser varredura incompleta da rodada 1 — o que o sweep mecânico e o Ledger existem para pegar. Da terceira em diante o achado novo é, quase sempre, superfície que a **própria correção** criou, e nessa direção a fonte não se esgota.

#### 3.4.1 Conferir a declaração do sweep (`antipadroes_verificados[]`)

> **Executa em TODOS os vereditos** — `APROVADO`, `APROVADO_COM_OBSERVACOES` e `REJEITADO`. NÃO pode viver no loop de correção (3.5): o loop só roda em rejeição, e a **rodada 1 aprovada** é o caminho dominante que esta conferência existe para auditar.

1. Monte o conjunto dos **arquivos de teste** presentes na lista `arquivos` enviada ao QA.
2. Compare com os `arquivo` declarados em `antipadroes_verificados[]` do JSON.
3. Ausente, vazio com arquivos de teste na lista, ou cobertura parcial → observação em `shared.workflow_report.path`:
   ```
   [T{N}] antipadroes_verificados incompleto: {n}/{m} arquivos de teste declarados (faltando: <paths>)
   ```
4. **NÃO rejeite a task por isso** — é sinal de instrumentação, não defeito do código (retrocompatibilidade: gate de contrato antigo não emite o campo).

#### 3.4.2 Manter o Ledger de Achados

> **Também executa em TODOS os vereditos, inclusive no que aprova.** Mantido só antes do executor de correção, a rodada que aprova nunca registraria seus `corrigido`/`aceito_como_debito` — e é esse ledger que a métrica de 3.4.3 lê.

Formato e regras completas: [`agent-spec-workflow-rules.md`](.claude/rules/agent-spec-workflow-rules.md) → **"Ledger de Achados"**. Operacionalmente:

1. **Memória lazy ainda inexistente** (rodada 1 que já aprova, sem rejeição alguma): **não crie nada.** Sem rejeição não há achado bloqueante a rastrear, e os anotáveis já vão para a §2. Caso legítimo, não lacuna.
2. **Memória lazy existente**, para cada problema do JSON: calcule o `fingerprint` (`{arquivo}::{simbolo_ou_ancora}::{categoria}::{smell_ou_titulo_normalizado}` — **nunca com número de linha**); `fingerprint` já presente → atualize `status` e `rodada_ultima_verificacao` (**jamais** segunda linha, **jamais** reescreva `rodada_origem`); `fingerprint` novo → insira com `rodada_origem` = rodada corrente, `status: aberto` se bloqueante, `aceito_como_debito` se anotável.
3. Achados `aberto` que **não** reaparecem neste JSON → `status: corrigido`, `rodada_ultima_verificacao` = rodada corrente.
4. **`reaberto` é do orquestrador**: achado `aceito_como_debito` que reaparece com severidade **maior** → `status: reaberto`, **preservando a `rodada_origem` original**.

#### 3.4.3 Métrica do ledger (ao fechar a task, ANTES do cleanup)

Antes de deletar a memória lazy, registre em `shared.workflow_report.path`:

```
[T{N}] ledger: {A} achados totais | {B} originados em rodada >1 | {C} suspeitos de incompletude da rodada 1
```

`{C}` = os de `{B}` cujo `fingerprint` aponta para arquivo/símbolo que **não** estava no delta da correção anterior. Se a memória lazy nunca nasceu, **não logue esta linha**.

> **Sinal `stack_discovery.discovery_needed: true`** (não afeta veredito): o QA não resolveu um detalhe **não-derivável do código** (ex.: framework E2E não padronizado, política de cobertura). Recomende ao usuário rodar **`/agent-spec-testing-stack-bootstrap`** — ele descobre a stack do código, pergunta só o não-derivável e gera `.claude/rules/testing-stack.md`. A partir daí o QA resolve a stack automaticamente. Não bloqueie o pipeline por esse sinal.

### 3.5 Loop de correção QA (memória lazy)

Se rejeitado:

1. **Monte/atualize a memória lazy** no path via `shared.temp_memory.dir` + `shared.temp_memory.pattern` (ex.: `docs/specs/features/{feature}/{version}/_run/tmp/T1.md`):

   ```markdown
   # Memória temporária — T[N]
   > Criada em [timestamp]. Deletada ao aprovar; expira em 24h.

   ## attempt_count
   [N — número de rejeições até agora; 1ª rejeição grava 1. Ver "Semântica de tentativas" em config.md]

   ## base_sha
   [SHA capturado em 2.1 — permite retomar gates após interrupção sem recapturar HEAD]

   ## attempt_sha
   [uma linha por rodada: `rodada {k}: <sha|indisponivel>` — marcador do estado da árvore
    imediatamente ANTES do executor de correção daquela rodada. Ver 3.5, item 5]

   ## last_severity
   [BAIXO|MEDIO|ALTO|CRITICO — do último JSON. Normalização do array do QA: criticos→CRITICO, altos→ALTO, medios→MEDIO, baixos→BAIXO]

   ## Contagem de casos por unidade (rodada anterior)
   [uma linha por unidade de execução: `<unidade>: <N> casos`, do campo
    `testes_executados.contagem_por_unidade` do último JSON do QA. Ausente na rodada 1.
    É o insumo da comparação que detecta teste DELETADO — que não falha, desaparece.]

   ## Sumário do executor
   [output enxuto de 4-6 linhas que o executor produziu]

   ## Ledger de Achados
   [tabela canônica — ver `agent-spec-workflow-rules.md` → "Ledger de Achados"]

   | finding_id | fingerprint | gate | severidade | categoria | smell | status | rodada_origem | rodada_ultima_verificacao |
   |---|---|---|---|---|---|---|---|---|

   ## JSON QA Validator
   ```json
   [JSON completo do 3.3]
   ```

   ## Arquivos tocados (`git diff --stat`)
   [saída de `git diff <base_sha> --stat`]

   ## Paths
   - Criados: [lista]
   - Modificados: [lista]
   - Testes: [lista]
   ```

   > **POPULE A TABELA DO LEDGER AGORA, nesta criação — não deixe apenas o cabeçalho.** Insira uma
   > linha por problema deste JSON: `rodada_origem` = rodada corrente, `status: aberto` para os
   > bloqueantes e `aceito_como_debito` para os anotáveis, `fingerprint` calculado **sem número de
   > linha**.
   >
   > **Por que isto é imperativo**: a manutenção do ledger (3.4.2) é guardada por *"se a memória lazy
   > existir"* — e na rodada 1 ela ainda **não** existe, porque nasce aqui. Um ledger que nasce vazio
   > produz dois defeitos, o segundo pior que o primeiro: (a) a componente (b) do `DELTA` ("arquivos
   > dos achados `aberto`") fica vazia justamente na transição 1→2, a mais comum; (b) na rodada 2
   > esses mesmos achados são reinseridos como **novos**, com `rodada_origem: 2`, **corrompendo a
   > métrica** `{B}`/`{C}` de 3.4.3 — que é exatamente o instrumento que o ledger existe para produzir.

2. **Extraia os problemas do JSON do QA — política débito-controlado com bloqueio seletivo por categoria**:
   - **Bloqueantes**: `problemas.criticos[]` + `problemas.altos[]` + os `problemas.medios[]` de **categoria bloqueante** (titulo, descricao, arquivo, linha, correcao_sugerida), **menos os médios convertidos pela convergência (3.4.0)** em rodada ≥ 3. A partição está em `.claude/rules/agent-spec-workflow-rules.md` → "Bloqueio Seletivo de Severidade MÉDIA por Categoria"; em `categoria: tests`, quem decide é o campo `smell`; categoria ausente/desconhecida ⇒ bloqueante
   - **Débito anotado**: `problemas.baixos[]` **+ os `problemas.medios[]` de categoria anotável** — entram no prompt como "Observações" (corrigir é opcional); os que não forem corrigidos DEVEM ser acumulados para a §2 do snapshot `_run/run-report.md` ao fechar o loop, preservando `arquivo`/`linha`/`correcao_sugerida`
   - `observacoes[]`
   - `testes_executados.detalhes_falhas[]`
   - `criterios_falhos[]` (CAs com `status` `FALHOU` ou `PARCIAL`)

   > **Débito-controlado com bloqueio seletivo** (mesma política da interpretação do veredito): críticos e altos sempre bloqueiam, e os médios de **categoria bloqueante** também — todos DEVEM ser corrigidos. Baixos e médios de **categoria anotável** são débito anotado e não impedem a aprovação.

3. **Aplique auto-escalonamento de modelo** (ver `references/config.md` §3 da Lógica de Seleção). Logue se escalou.

4. **Monte o prompt de correção** para o executor:

   ```
   A task [ID] foi REJEITADA pelo QA. Leia a memória lazy em [path do arquivo] antes de corrigir.

   ## Problemas Bloqueantes (DEVEM ser corrigidos — política débito-controlado)
   [Para cada problema de problemas.criticos[], problemas.altos[] e os problemas.medios[] de categoria BLOQUEANTE pela partição da rule (em `categoria: tests`, conforme o `smell`; categoria ausente/desconhecida ⇒ bloqueante):]
   - **[Pn]** ([critico|alto|medio]): [titulo]
     - Arquivo: [arquivo]:[linha]
     - Descrição: [descricao]
     - Correção sugerida: [correcao_sugerida]

   ## Testes que Falharam
   [lista de detalhes_falhas]

   ## Critérios de Aceite não Atendidos
   [lista com status FALHOU ou PARCIAL]

   ## Observações (anotáveis — débito anotado, opcional corrigir agora)
   [Para cada problema de problemas.baixos[] e cada problemas.medios[] de categoria ANOTÁVEL — listagem compacta:]
   - **[Pn]** ([baixo|medio]): [titulo] — [correcao_sugerida]

   Corrija OBRIGATORIAMENTE os bloqueantes (críticos, altos e os médios de categoria bloqueante), os testes que falharam e os critérios não atendidos. Os itens da seção "Observações" são débito anotado: corrija se for trivial no mesmo escopo; caso contrário, deixe para cleanup futuro (serão anotados na §2 do _run/run-report.md). Não expanda escopo.

   Para CADA problema bloqueante, antes de editar escreva uma linha `CAUSA-RAIZ: <por que o teste ou o código estava errado>`. Correção que apenas faz o gate passar sem atacar a causa — inverter uma flag, enfraquecer a asserção, renomear — será RE-REPROVADA. Se o problema é asserção fraca, mock-driven ou teste oco: reescreva a asserção para validar o comportamento observável real (não ajuste o valor do mock nem inverta booleanos). Se algum problema já havia sido reprovado na tentativa anterior, a correção anterior foi insuficiente — ataque a origem, não o sintoma.

   Após corrigir, execute os testes para garantir que passam.

   Arquivos a corrigir:
   [lista de arquivos dos problemas]
   ```

5. **Capture o `attempt_sha` — IMEDIATAMENTE ANTES de despachar o executor de correção (OBRIGATÓRIO)**. Ver [`agent-spec-workflow-rules.md`](.claude/rules/agent-spec-workflow-rules.md) → **"Escopo Incremental em Retry"**.

   É o marcador do estado da árvore **anterior** à correção — o que torna o diff da próxima rodada o **delta da correção**, e não a task inteira outra vez (`base_sha` não muda entre tentativas).

   ```bash
   TMP_IDX=$(mktemp)                                     # FORA do repositório — nunca dentro do worktree
   cp "$(git rev-parse --git-path index)" "$TMP_IDX"     # resolve repo comum, subdiretório E worktree vinculado
   GIT_INDEX_FILE="$TMP_IDX" git add -A -- <task_paths>  # popula SÓ o índice temporário
   tree=$(GIT_INDEX_FILE="$TMP_IDX" git write-tree)
   attempt_sha=$(git commit-tree "$tree" -p HEAD -m "attempt snapshot")
   rm -f "$TMP_IDX"
   ```

   - **NÃO use `git stash create`**: com entradas *intent-to-add* no índice — e o `git add -N` da FASE 2.4 as cria em toda task que gera arquivo novo — ele aborta com exit 1 e stdout vazio (`Entry '<path>' not uptodate. Cannot merge.`). A degradação seria silenciosa: `attempt_sha` viraria `<indisponivel>`, toda rodada cairia em `FULL`, e o escopo incremental ficaria inerte sem nada acusar erro.
   - **NÃO use `cp .git/index`**: em worktree vinculado `.git` é **arquivo**, não diretório (falha com `Not a directory`), e de subdiretório também falha, ali com `No such file or directory`. `git rev-parse --git-path index` resolve os três casos.
   - **Fallback**: se **QUALQUER** passo falhar (`mktemp`, `cp`, `git add`, `git write-tree`, `git commit-tree`) → `attempt_sha = <indisponivel>` → a próxima rodada roda em **`FULL`**.
   - A sequência **não altera o working tree nem o índice do usuário**.
   - Grave na memória lazy (seção `## attempt_sha`) **e** logue em `shared.workflow_report.path`:
     ```
     [T{N}] attempt_sha (rodada {k})=<sha|indisponivel>
     ```
     `<indisponivel>` recorrente neste log significa que `DELTA` nunca está acontecendo — o escopo incremental está inerte.

6. **Dispare o executor** com `effective_model` (escalado se aplicável).
7. **Re-valide com o QA** (volte ao 3.3), **passando o escopo incremental**. Atualize `attempt_count` e `last_severity` na memória lazy. **Em retry, anexe às `instrucoes` do QA**:
   - **`scan_scope`**: `DELTA` quando o `attempt_sha` da rodada anterior existir; **`FULL`** quando for `<indisponivel>`;
   - **`delta_arquivos[]`**: saída de `git diff --name-only <attempt_sha_anterior>`;
   - **`delta_simbolos[]`**: símbolos alterados extraídos do diff textual — **best-effort**. Se não conseguir extraí-los, **omita o campo e NÃO caia para `FULL`**: o QA resolve o raio de impacto pela granularidade por arquivo;
   - o **path da memória lazy** (`shared.temp_memory.dir` + `pattern`) — contém o **Ledger de Achados**, que o QA consome em retry;
   - resumo da tentativa anterior — testes que falharam + asserções/smells citados nos problemas;
   - instrução literal ao QA: "Compare contra a tentativa anterior: teste que existia e sumiu, ou asserção que ficou mais frouxa sem justificativa `SUT_IS_CORRECT_BECAUSE:`, é AP-24 (weakening test to pass) → CRÍTICO. **Compare também a contagem de casos POR UNIDADE** contra o bloco `## Contagem de casos por unidade (rodada anterior)` da memória lazy: queda não explicada em qualquer unidade é o mesmo AP-24 → CRÍTICO, `categoria: tests`, `smell: weakening_test_to_pass`. Só o total esconde compensação entre unidades. Contagem anterior ausente → registre em `observacoes` e siga; não é achado."
8. **Limite máximo: 3 tentativas TOTAIS** por task (compartilhado com Tech Review — 4.4).

**Ao fechar o loop com aprovação**: acumule para a §2 do snapshot `_run/run-report.md` os **anotáveis remanescentes** (baixos + médios de categoria anotável) do último JSON do QA que NÃO foram corrigidos (um bloco `### D{n} · {severidade} · {categoria} · T[N] · QA` por problema, com `Onde`=`[arquivo]:[linha]`, `Problema`=`titulo`, `Impacto`=`descricao`, `O que fazer`=`correcao_sugerida`; `arquivo`/`linha`/`correcao_sugerida` vêm do próprio problema no JSON — não os descarte: alimentam as tasks de cleanup da `/agent-spec-debt-resolution`) — o caminho "REJEITADO → corrigido → aprovado" não passa pelo registro automático do veredito `APROVADO_COM_OBSERVACOES`. Isso agora inclui os **médios de categoria anotável**, que sob a política de bloqueio seletivo chegam até aqui como débito — antes, quando todo médio bloqueava, eles eram sempre corrigidos dentro do loop.

**Ao aprovar os gates APLICÁVEIS** (só QA quando `gates: [qa]`): delete a memória lazy `T{N}.md` (se foi criada por rejeição) — `cleanup_on_approval: true`. **ANTES de deletar**, registre a métrica do ledger em `shared.workflow_report.path` (`[T{N}] ledger: {A} achados totais | {B} originados em rodada >1 | {C} suspeitos de incompletude da rodada 1`) — a ordem importa, porque a métrica lê o ledger que o cleanup apaga. **Não há mais execution-summary em disco** (substituído por inline no prompt — ver 2.4 da SKILL.md).
