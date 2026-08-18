# Prompt de instalação — Guarda de Continuidade do Run

> **O que este arquivo é.** Um prompt completo e autossuficiente para um agente de codificação
> instalar, num projeto QUALQUER, o mecanismo que impede um run multi-task de encerrar o turno
> com trabalho devido. Ele carrega o diagnóstico, o desenho, a implementação de referência
> integral, os pontos de adaptação e os critérios de aceitação.
>
> **Como usar.** Entregue o arquivo inteiro ao agente do projeto de destino, ou cole a seção
> "PROMPT" abaixo. As seções seguintes são o anexo que o prompt referencia.
>
> Origem: implementado e verificado no monorepo Sysloc Backend em 2026-08-18 (13 casos de teste
> verdes, `CT-954` a `CT-966`).

---

## PROMPT

Você vai instalar neste projeto a **Guarda de Continuidade do Run**: um gancho (`hook`) de
`Stop` do Claude Code que impede o agente orquestrador de encerrar o turno enquanto houver task
devida num plano de execução multi-task.

Leia o diagnóstico e o desenho antes de escrever qualquer linha. Eles não são contexto
decorativo — quase toda tentativa ingênua de resolver este problema falha por ignorar um dos
quatro pontos da seção "Salvaguardas".

### 1. O problema, exatamente

Um pipeline de execução por tasks (SDD, miniSpec, TaskCard, ou o equivalente deste projeto)
manda o orquestrador despachar a próxima task assim que a anterior fecha, sem pedir
confirmação. Isso costuma estar escrito em dois lugares: uma *rule* carregada no system-prompt e
o próprio arquivo da skill. **As duas falham**, e a razão é estrutural, não desobediência:

- A instrução carrega no **início** do contexto, e a decisão de encerrar acontece dezenas ou
  centenas de milhares de tokens depois.
- No instante da decisão, o agente **acabou de escrever um relatório de fecho de task** — que
  tem a mesma forma de um relatório final e é, localmente, um limite natural de conclusão.
- A prosa da skill termina em "Relatório Final". Nada, no texto, manda **voltar ao laço**.

O resultado medido no projeto de origem: o orquestrador parou duas vezes no meio de um run de 17
tasks, e o usuário teve de reemitir a autorização de continuidade à mão.

**Nenhuma quantidade de prosa adicional conserta isto**, porque o defeito é de posição, não de
conteúdo. O conserto tem de agir **depois** da decisão de encerrar e **fora** do modelo.

### 2. Por que `Stop`, e por que não os outros ganchos

| Gancho | Por que não serve |
|---|---|
| `PostToolUse` | dispara na edição que marca a task como concluída — instante em que a ausência de despacho ainda é **legítima**, porque o despacho vem em seguida. Produziria falso positivo em toda task, e um alerta que sempre grita é um alerta que ninguém lê |
| `SubagentStop` | dispara quando um subagente termina, não quando o turno do orquestrador termina. Errado por um nível |
| `UserPromptSubmit` | dispara antes do turno, quando ainda não há nada a conferir |
| **`Stop`** | dispara exatamente quando o agente principal vai encerrar o turno — **o instante do defeito** |

O `Stop` também é o único que pode **impedir** o encerramento: devolvendo
`{"decision":"block","reason":"..."}` na saída padrão, o turno continua e o texto de `reason`
chega ao agente como instrução.

### 3. As quatro salvaguardas — nenhuma é opcional

Um gancho de `Stop` mal feito é **pior** que o defeito que ele conserta, porque ele pode
aprisionar a sessão. As quatro abaixo são o que separa a guarda de uma armadilha.

**S1 · Falhar para o lado aberto, sempre.** JSON malformado, plano ausente, `awk` indisponível,
permissão negada — todo erro interno sai com código 0 e sem bloquear. Um gancho de `Stop` que
falha para o lado fechado não termina o turno e não há caminho de código que o solte.
`trap 'exit 0' ERR` no topo, e nenhum caminho de erro que bloqueie.

**S2 · Escopo de sessão por marcador em disco.** Sem isso o gancho arma em **toda** sessão do
projeto, inclusive a que só veio fazer uma pergunta. A skill cria `_run/.run-ativo` ao abrir o
run e o remove ao fechá-lo; o gancho vincula o marcador à primeira sessão que **de fato deve**
alguma coisa, e ignora marcador de outra sessão.

> ⚠️ **Não use o arquivo de estado do pipeline (`*state.yaml`) como gatilho.** Ele é atualizado
> em marcos e fica defasado. No projeto de origem, o estado de uma fatia dizia `in_progress` com
> `tasks_completed: 9` enquanto as 17 tasks já estavam concluídas — o gancho teria armado contra
> um run encerrado e prendido todas as sessões futuras do projeto.

**S3 · Orçamento de reincidência por assinatura de estado.** Depois de bloquear, o `Stop`
seguinte chega com `stop_hook_active: true`. Bloquear incondicionalmente monta laço infinito com
o modelo respondendo "ok, continuando" e parando de novo. Bloquear só uma vez reduz a garantia a
um empurrão único. A saída: contar bloqueios por **assinatura do veredito**; progresso muda a
assinatura e **zera** o contador. O run inteiro tem empurrões ilimitados; um estado travado tem
no máximo três. É isto, e não `stop_hook_active` sozinho, que garante terminação.

**S4 · A interrupção do usuário continua soberana.** O Claude Code não dispara o gancho de
`Stop` quando a parada vem de interrupção do usuário — `Esc` sempre encerra. Some a isso uma
variável de desligamento (`SEM_GUARDA_DE_RUN=1`) e um TTL que faz um marcador esquecido vencer
sozinho.

### 4. O predicado — o que conta como "task devida"

Compute-o sobre a **tabela de tasks do plano**, e não sobre o arquivo de estado:

```
BLOQUEIA se:
    existe task com Status "Em Progresso"                       → execução interrompida no meio
 OU existe task "A Fazer" com TODAS as dependências "Concluído" → despacho devido
```

`Em Progresso` tem **precedência**: uma execução interrompida é o defeito mais grave, e relatar
outra task esconderia esse estado.

Três detalhes que decidem se o predicado funciona:

1. **Leia as colunas pelo CABEÇALHO, nunca por índice fixo.** Geradores diferentes emitem
   larguras diferentes de tabela; índice fixo lê a coluna errada em silêncio, e ler errado aqui
   não quebra nada visível — o predicado apenas para de bloquear, que é o defeito original de
   volta.
2. **Use só a PRIMEIRA tabela qualificada** (a que tem coluna de identificador **e** de
   dependências **e** de status). Um plano tem outras tabelas com coluna `Status` — a de
   rastreabilidade de User Stories é a mais comum, e as linhas dela ficam `A Fazer` **para
   sempre** por design. Bloquear por causa delas seria bloqueio eterno.
3. **Conservador em toda ambiguidade.** Dependência que a tabela não declara, cabeçalho ausente,
   estado fora do vocabulário canônico — tudo resolve para "não devido".

### 5. O que criar

| Arquivo | Papel |
|---|---|
| `<scripts>/run/guarda-de-run.sh` | o gancho: lê o JSON do `Stop`, decide, emite o bloqueio. Também expõe `--armar`, `--desarmar` e `--estado` |
| `<scripts>/run/prontidao.awk` | o predicado, como função pura de texto para texto |
| `.claude/settings.json` | registra o gancho no evento `Stop` |
| `<pacote>/test/guarda-de-run.spec.ts` | a barreira executável — 13 casos |
| skill(s) de run | duas linhas: `--armar` na inicialização, `--desarmar` no fecho |
| `.gitignore` | o marcador `_run/.run-ativo` é transitório |

A implementação de referência integral está nos anexos A, B e C deste arquivo. **Copie-a e
adapte os pontos da seção 6** — não a reescreva do zero: cada bloco de comentário nela registra
um defeito real que já foi pago.

### 6. Pontos de adaptação a este projeto — descubra ANTES de escrever

Não presuma nenhum destes. Meça no repositório de destino:

1. **Onde vivem os planos de execução.** No projeto de origem é
   `docs/specs/features/<fatia>/<versão>/task_plan.md`, com o marcador em `_run/` ao lado.
   Ajuste o `find` do gancho e a derivação do caminho do plano.
2. **O vocabulário de status.** A origem usa `A Fazer` / `Em Progresso` / `Concluído` /
   `Bloqueado`. Se este projeto usa outro (`TODO` / `DOING` / `DONE`), ajuste as expressões do
   `.awk` — elas são deliberadamente tolerantes a acento e a negrito, mantenha isso.
3. **Os nomes das colunas** do cabeçalho da tabela de tasks.
4. **Quais skills abrem um run.** Se houver mais de uma (na origem são duas), instale o
   `--armar`/`--desarmar` em **todas** — uma skill sem o par corre desprotegida.
5. **Onde ficam os testes** e qual o runner. O teste de referência é Vitest; a lógica é
   agnóstica e porta para qualquer runner que consiga executar um processo e ler os dois fluxos
   de saída.
6. **Se existe `python3`** para o parse do JSON. Se não, use `jq`; se não houver nenhum dos
   dois, **pare e reporte** — parse de JSON com `grep` é falso positivo esperando acontecer.
7. **A faixa de identificadores de teste livre**, se o projeto numera casos.

### 7. Critérios de aceitação — o run só termina quando todos passarem

- [ ] `bash <scripts>/run/guarda-de-run.sh --estado` roda sem run ativo e responde que a guarda
      está inerte
- [ ] Os 13 casos do anexo C passam, adaptados aos caminhos deste projeto
- [ ] A suíte completa do pacote que recebeu o teste continua verde, com a contagem **anterior +
      13** (meça antes de editar — é a baseline)
- [ ] O lint/formatador do projeto passa nos arquivos novos
- [ ] `.claude/settings.json` continua sendo JSON válido e preserva os ganchos que já existiam
- [ ] O marcador está no `.gitignore`
- [ ] Um teste manual de ponta a ponta: `--armar` num plano com task pendente, alimentar o
      gancho com `{"session_id":"x"}` na entrada padrão, ver o `decision: block`; `--desarmar`,
      repetir, ver saída vazia

### 8. Erros que já foram cometidos — não os repita

- **Usar `execFileSync` (ou equivalente) para invocar o gancho no teste.** Ele não devolve a
  saída de erro no caminho de sucesso, e a guarda comunica por ali justamente quando **não**
  bloqueia. Os casos que provam as liberações ficam cegos. Use `spawnSync` ou equivalente que
  devolva os dois fluxos.
- **Provar só o bloqueio.** Metade dos casos tem de provar o **não-bloqueio** — é o lado que
  aprisiona a sessão, e é o mais caro dos dois modos de falha.
- **Asserção sobre o TEXTO do script** (`grep` no fonte). Fica verde com o gancho quebrado.
  Execute o script de verdade.
- **Instalar o gancho e esquecer o `--armar` na skill.** O gancho fica inerte para sempre e nada
  avisa.
- **Desarmar antes de conferir que o run acabou.** Devolve exatamente a fragilidade fechada.

### 9. O que este mecanismo NÃO garante — diga isto ao usuário

A guarda garante que **o turno não termina em silêncio** com trabalho devido. Ela **não**
garante que o agente faça a coisa certa em seguida: ele ainda escolhe. O que ela elimina é a
parada silenciosa, que é o modo de falha observado.

Garantia de terminação de verdade só existe **tirando o fluxo de controle do modelo** — um
driver externo (`while restam tasks; do <cli> -p "execute a próxima" ; done`) ou um script de
orquestração determinístico. Isso é uma mudança de arquitetura do pipeline, não um patch, e vale
a pena se a parada voltar a acontecer **apesar** do empurrão: aí o problema deixou de ser
esquecimento e virou recusa, e só a inversão de controle resolve.

---

## Anexo A — `guarda-de-run.sh` (implementação de referência)

```bash
#!/usr/bin/env bash
#
# Guarda de continuidade do run — gancho de `Stop` do Claude Code.
#
# Impede que o orquestrador de um run do agent-spec encerre o turno com task devida. Recebe na
# entrada padrão o JSON que o Claude Code entrega ao gancho, decide se o run corrente deve um
# despacho e, só nesse caso, devolve `{"decision":"block"}` com a instrução do que fazer.
#
# ## O defeito que ele fecha, e por que a rule não bastou
#
# `.claude/rules/autonomia-do-run.md` §A3 proíbe o run de parar entre tasks, e o
# `agent-spec-sdd-run-tasks/SKILL.md` repete a proibição no passo 6 da "Atualização de Estado
# por Task". As duas carregam no prompt, longe do ponto de decisão, e competem com a saliência
# de um relatório de fecho recém-escrito — que é, para quem acabou de escrevê-lo, um limite
# natural de conclusão. Medição do run `emissao-e-conciliacao/v1`: o orquestrador parou DUAS
# vezes depois do relatório de fecho de uma task (`_run/workflow-report.md`, linhas 43 e 299),
# e o usuário teve de reemitir a autorização de continuidade no meio do run.
#
# Este gancho não compete com nada: ele age DEPOIS da decisão de encerrar e FORA do modelo. É o
# mesmo salto que `packages/shared/test/protocolo-antirregressao.spec.ts` deu quando transformou
# o Protocolo Antirregressão de boa-fé em barreira executável.
#
# ## Por que `Stop`, e não `PostToolUse`
#
# `PostToolUse` dispararia na edição que marca a task como `Concluído` — instante em que a
# ausência de despacho ainda é LEGÍTIMA, porque o despacho vem logo em seguida. Produziria falso
# positivo em toda task, e um alerta que sempre grita é um alerta que ninguém lê (é o mesmo
# mecanismo pelo qual `.claude/rules/nao-regressao.md` §3 adverte contra marcador em coisa
# trivial). `Stop` dispara no instante exato do defeito: o turno indo embora com trabalho devido.
#
# ## As quatro salvaguardas — leia antes de "simplificar" qualquer uma
#
#   1. FALHA PARA O LADO ABERTO, SEMPRE. Todo erro interno — JSON malformado, plano ausente,
#      `awk` indisponível, permissão negada — sai com código 0 e sem bloquear. Um gancho de
#      `Stop` que falha para o lado fechado APRISIONA a sessão: o turno não termina e não há
#      caminho de código que o solte. É o pior estrago que este arquivo pode causar, e é pior
#      que o defeito que ele conserta.
#   2. ESCOPO DE SESSÃO pelo marcador `_run/.run-ativo`. Sem ele o gancho armaria em TODA sessão
#      do projeto — inclusive a que só veio fazer uma pergunta. Pior: `_run/*state.yaml` é
#      atualizado em marcos e fica defasado (medido em 2026-08-18: a fatia
#      `emissao-e-conciliacao` dizia `in_progress` com `tasks_completed: 9` enquanto as 17 tasks
#      já estavam `Concluído`), então estado de arquivo NÃO serve de gatilho — só o marcador,
#      que a skill cria ao abrir o run e remove ao fechá-lo.
#   3. ORÇAMENTO DE REINCIDÊNCIA. Depois de bloquear, o `Stop` seguinte chega com
#      `stop_hook_active: true`; bloquear incondicionalmente monta laço infinito com o modelo
#      respondendo "ok, continuando" e parando de novo. O orçamento é contado por ASSINATURA DE
#      ESTADO: progresso muda a assinatura e zera o contador, de modo que o run inteiro tem
#      empurrões ilimitados, mas um estado travado tem no máximo três. É isto, e não
#      `stop_hook_active` sozinho, que garante terminação.
#   4. INTERRUPÇÃO DO USUÁRIO CONTINUA SOBERANA. O Claude Code não dispara o gancho de `Stop`
#      quando a parada vem de interrupção do usuário, então `Esc` sempre encerra. É a saída
#      humana, e ela é gratuita. A variável `SYSLOC_SEM_GUARDA_DE_RUN=1` desliga tudo.
#
# ## Subcomandos
#
#   (sem argumento)          modo gancho: lê o JSON do `Stop` na entrada padrão e decide
#   --armar <task_plan.md>   cria o marcador do run (chamado pela skill na Inicialização)
#   --desarmar <task_plan.md>  remove o marcador (chamado pela skill no fim do run)
#   --estado                 diagnóstico legível: marcadores vivos, vínculo e orçamento
#
# ## Por que `python3` e não `jq` para ler o JSON
#
# É a convenção já estabelecida por `deploy/scripts/roadmap/gancho-roadmap.sh`, o outro gancho
# deste repositório. O docblock de lá justifica a escolha pela ausência de `jq` no host; hoje
# `jq` existe em `/usr/bin/jq` e aquela justificativa está vencida, mas a razão que sobrevive é
# a segunda dele: `python3` é confiável com escape de aspas, e um `grep` sobre JSON não é.
# Manter os dois ganchos na mesma ferramenta é o que evita que um deles quebre sozinho quando o
# host mudar. (A frase vencida no arquivo vizinho não é corrigida aqui — está fora do escopo.)

set -uo pipefail

# Qualquer erro não previsto encerra em silêncio e SEM bloquear. Ver salvaguarda 1.
trap 'exit 0' ERR

readonly DIRETORIO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PREDICADO="$DIRETORIO/prontidao.awk"
readonly RAIZ="${CLAUDE_PROJECT_DIR:-$(cd "$DIRETORIO/../../.." && pwd)}"
readonly NOME_DO_MARCADOR=".run-ativo"

# Horas sem sinal de vida do run até o marcador ser considerado abandonado. O marcador é tocado
# a cada avaliação da sessão vinculada, então isto mede "tempo desde o último fim de turno do
# run", e não "tempo desde que o run começou" — um run legítimo de dois dias nunca vence.
readonly TTL_HORAS="${SYSLOC_GUARDA_TTL_HORAS:-12}"

# Bloqueios consecutivos permitidos por assinatura de estado. Ver salvaguarda 3.
readonly TETO_DE_BLOQUEIOS="${SYSLOC_GUARDA_TETO:-3}"

readonly DIR_ORCAMENTO="${TMPDIR:-/tmp}/sysloc-guarda-de-run-$(id -u 2>/dev/null || echo 0)"

# --------------------------------------------------------------------------------------------
# Leitura da entrada
# --------------------------------------------------------------------------------------------

# Extrai um campo escalar do JSON do gancho. Devolve vazio — nunca quebra — quando a entrada não
# é o que se espera.
campo_do_json() {
  local entrada="$1" chave="$2"
  printf '%s' "$entrada" | python3 -c '
import json, sys

chave = sys.argv[1]
try:
    dados = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(dados, dict) and not isinstance(dados.get(chave), (dict, list)):
    valor = dados.get(chave)
    if valor is not None:
        print(valor)
' "$chave" 2>/dev/null || true
}

# Serializa a razão do bloqueio em JSON, com escape correto de aspas e acentuação.
emitir_bloqueio() {
  python3 -c '
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}, ensure_ascii=False))
' "$1" 2>/dev/null || true
}

# --------------------------------------------------------------------------------------------
# Marcador do run
# --------------------------------------------------------------------------------------------

marcadores() {
  find "$RAIZ/docs/specs/features" -mindepth 3 -maxdepth 4 -name "$NOME_DO_MARCADOR" -type f 2>/dev/null || true
}

leia_campo_do_marcador() {
  local marcador="$1" chave="$2"
  sed -n "s/^${chave}:[[:space:]]*//p" "$marcador" 2>/dev/null | head -1 || true
}

# --------------------------------------------------------------------------------------------
# Orçamento de reincidência
# --------------------------------------------------------------------------------------------

# Devolve 0 (sucesso) quando ainda há orçamento, e incrementa o contador. Devolve 1 quando o
# teto foi alcançado para esta assinatura.
consumir_orcamento() {
  local sessao="$1" assinatura="$2" arquivo anterior contador
  mkdir -p "$DIR_ORCAMENTO" 2>/dev/null || return 0
  arquivo="$DIR_ORCAMENTO/${sessao//[^A-Za-z0-9_-]/_}.orcamento"

  anterior="$(sed -n '1p' "$arquivo" 2>/dev/null || true)"
  contador="$(sed -n '2p' "$arquivo" 2>/dev/null || true)"
  [[ "$contador" =~ ^[0-9]+$ ]] || contador=0

  # Assinatura diferente significa que o estado do run MUDOU desde o último bloqueio — ou seja,
  # houve progresso. O orçamento volta ao início.
  if [[ "$anterior" != "$assinatura" ]]; then
    contador=0
  fi

  if (( contador >= TETO_DE_BLOQUEIOS )); then
    return 1
  fi

  printf '%s\n%s\n' "$assinatura" "$((contador + 1))" > "$arquivo" 2>/dev/null || true
  return 0
}

# --------------------------------------------------------------------------------------------
# Subcomandos de administração do marcador
# --------------------------------------------------------------------------------------------

armar() {
  local plano="${1:-}"
  [[ -n "$plano" && -f "$plano" ]] || { echo "guarda de run: plano inexistente ($plano)" >&2; exit 0; }
  local diretorio_run
  diretorio_run="$(cd "$(dirname "$plano")" && pwd)/_run"
  mkdir -p "$diretorio_run" 2>/dev/null || exit 0
  cat > "$diretorio_run/$NOME_DO_MARCADOR" <<MARCADOR
# Marcador de run ativo — criado pela skill de execução, removido por ela ao fim do run.
# Enquanto ele existir, o gancho de Stop (deploy/scripts/run/guarda-de-run.sh) impede que a
# sessão vinculada encerre o turno com task devida. Apagá-lo à mão desarma a guarda.
criado_em: $(date -Iseconds)
task_plan: $(realpath --relative-to="$RAIZ" "$plano" 2>/dev/null || echo "$plano")
session_id:
MARCADOR
  echo "guarda de run ARMADA para $plano" >&2
  exit 0
}

desarmar() {
  local plano="${1:-}"
  [[ -n "$plano" ]] || exit 0
  local marcador
  marcador="$(cd "$(dirname "$plano")" 2>/dev/null && pwd)/_run/$NOME_DO_MARCADOR"
  if [[ -f "$marcador" ]]; then
    rm -f "$marcador" 2>/dev/null || true
    echo "guarda de run DESARMADA ($marcador removido)" >&2
  fi
  exit 0
}

estado() {
  local encontrou=0 marcador
  while IFS= read -r marcador; do
    [[ -n "$marcador" ]] || continue
    encontrou=1
    echo "marcador: $marcador"
    echo "  vinculado a: $(leia_campo_do_marcador "$marcador" session_id || true)"
    echo "  plano......: $(leia_campo_do_marcador "$marcador" task_plan || true)"
    local plano_abs
    plano_abs="$(dirname "$(dirname "$marcador")")/task_plan.md"
    echo "  veredito...: $(awk -f "$PREDICADO" "$plano_abs" 2>/dev/null || echo '<erro>')"
  done < <(marcadores)
  (( encontrou )) || echo "nenhum run armado — a guarda está inerte"
  [[ -d "$DIR_ORCAMENTO" ]] && { echo "orçamentos em $DIR_ORCAMENTO:"; ls -1 "$DIR_ORCAMENTO" 2>/dev/null || true; }
  exit 0
}

# --------------------------------------------------------------------------------------------
# Modo gancho
# --------------------------------------------------------------------------------------------

main() {
  case "${1:-}" in
    --armar)    shift; armar "${1:-}" ;;
    --desarmar) shift; desarmar "${1:-}" ;;
    --estado)   estado ;;
  esac

  [[ "${SYSLOC_SEM_GUARDA_DE_RUN:-}" == "1" ]] && exit 0
  [[ -r "$PREDICADO" ]] || exit 0

  local entrada sessao
  entrada="$(cat 2>/dev/null || true)"
  sessao="$(campo_do_json "$entrada" session_id)"
  [[ -n "$sessao" ]] || exit 0

  # Escolhe o marcador desta sessão: o já vinculado a ela; na falta, o primeiro sem vínculo,
  # que passa a ser dela. Um marcador vinculado a OUTRA sessão é ignorado — é por isso que uma
  # segunda janela no mesmo projeto não é presa pelo run da primeira.
  local marcador escolhido="" vinculado_livre=""
  while IFS= read -r marcador; do
    [[ -n "$marcador" ]] || continue
    local dono
    dono="$(leia_campo_do_marcador "$marcador" session_id)"
    if [[ "$dono" == "$sessao" ]]; then escolhido="$marcador"; break; fi
    [[ -z "$dono" && -z "$vinculado_livre" ]] && vinculado_livre="$marcador"
  done < <(marcadores)
  [[ -z "$escolhido" ]] && escolhido="$vinculado_livre"
  [[ -n "$escolhido" ]] || exit 0

  # Marcador abandonado nunca prende ninguém. Ver salvaguarda 1 e o TTL acima.
  if [[ -n "$(find "$escolhido" -mmin "+$((TTL_HORAS * 60))" 2>/dev/null)" ]]; then
    echo "guarda de run: marcador abandonado há mais de ${TTL_HORAS}h em $escolhido — ignorado. Remova-o." >&2
    exit 0
  fi

  local plano
  plano="$(dirname "$(dirname "$escolhido")")/task_plan.md"
  [[ -f "$plano" ]] || exit 0

  local veredito
  veredito="$(awk -f "$PREDICADO" "$plano" 2>/dev/null || true)"
  case "$veredito" in
    ''|SEM_TABELA) exit 0 ;;
  esac

  # Vincula o marcador a esta sessão no primeiro bloqueio real, não antes: assim uma sessão que
  # só passou por ali sem dever nada não sequestra o marcador do run.
  if [[ -z "$(leia_campo_do_marcador "$escolhido" session_id)" ]]; then
    sed -i "s|^session_id:.*|session_id: $sessao|" "$escolhido" 2>/dev/null || true
  fi
  touch "$escolhido" 2>/dev/null || true

  if ! consumir_orcamento "$sessao" "$veredito"; then
    echo "guarda de run: ${TETO_DE_BLOQUEIOS} bloqueios seguidos sem progresso em '$veredito' — liberando o encerramento. O run NÃO terminou; retome com a skill de execução." >&2
    exit 0
  fi

  local id="${veredito#* }"
  local razao
  case "$veredito" in
    EM_PROGRESSO*)
      razao="GUARDA DE CONTINUIDADE DO RUN — o turno ia encerrar com a task ${id} em \"Em Progresso\" no ${plano#$RAIZ/}. Execução interrompida no meio não é estado terminal. Retome ${id} agora: se o executor já rodou, siga para o Gate 1; se não rodou, despache-o. NÃO encerre o turno e NÃO peça confirmação — .claude/rules/autonomia-do-run.md §A3."
      ;;
    PRONTA*)
      razao="GUARDA DE CONTINUIDADE DO RUN — o turno ia encerrar com a task ${id} pronta (todas as dependências \"Concluído\") e ainda \"A Fazer\" no ${plano#$RAIZ/}. Relatório de fecho de UMA task não é o fim do run. Marque ${id} como \"Em Progresso\" e despache o executor NESTA MESMA RESPOSTA — .claude/rules/autonomia-do-run.md §A3 e o passo 6 de \"Atualização de Estado por Task\". Se a task não deve mesmo rodar, marque-a \"Bloqueado\" com o motivo; se o run acabou, rode: bash deploy/scripts/run/guarda-de-run.sh --desarmar ${plano#$RAIZ/}"
      ;;
    *) exit 0 ;;
  esac

  emitir_bloqueio "$razao"
  exit 0
}

main "$@"
```

---

## Anexo B — `prontidao.awk` (implementação de referência)

```awk
#!/usr/bin/awk -f
#
# Predicado de prontidão sobre a tabela de tasks de um `task_plan.md`.
#
# Lê o plano na entrada e escreve na saída UMA linha de veredito, ou nada. É função pura de
# texto para texto: não toca disco, não consulta git, não conhece sessão. Toda a decisão de
# bloquear vive no `guarda-de-run.sh`; aqui mora apenas a pergunta "o run deve alguma coisa?".
#
# ## Vereditos
#
#   EM_PROGRESSO T5   uma task ficou marcada `Em Progresso` — execução interrompida no meio
#   PRONTA T5         uma task `A Fazer` tem TODAS as dependências `Concluído` — despacho devido
#   SEM_TABELA        não há tabela de tasks reconhecível (o chamador trata como inerte)
#   <vazio>           nada devido
#
# `EM_PROGRESSO` tem precedência sobre `PRONTA`: uma execução interrompida é o defeito mais
# grave dos dois, e relatar o despacho devido de outra task esconderia o interrompido.
#
# ## Por que a leitura é dirigida pelo CABEÇALHO, e não por índice fixo de coluna
#
# Os planos deste repositório não têm largura única: o `agent-spec-sdd-generate-tasks` emite
# sete colunas, o `agent-spec-minispec-generate-tasks` emite outra contagem, e o
# `agent-spec-debt-resolution` emite uma terceira com `gates` e `risk` no meio. Índice fixo
# casaria com um formato e leria silenciosamente a coluna errada nos outros — e ler a coluna
# errada aqui não quebra nada visível: o predicado simplesmente para de bloquear, que é
# exatamente o defeito que esta guarda existe para impedir. O cabeçalho, esse, nomeia as
# colunas em todos os três.
#
# ## Por que só a PRIMEIRA tabela qualificada
#
# Um `task_plan.md` tem mais de uma tabela com coluna `Status` — a de rastreabilidade de User
# Stories é a mais comum, e as linhas dela ficam `A Fazer` para sempre por design (ninguém as
# marca; elas descrevem cobertura, não execução). Qualificar exige `Dependências` **e**
# `Status` **e** uma coluna de identificador, e parar na primeira que qualifica: é a tabela de
# execução, a única cujo `Status` o orquestrador mantém.
#
# ## Conservador em toda ambiguidade
#
# Dependência que não existe na tabela, cabeçalho ausente, estado que não casa com o
# vocabulário canônico — tudo resolve para "não devido". A guarda erra para o lado de deixar
# passar, nunca para o lado de prender a sessão. Ver o docblock de `guarda-de-run.sh`.

BEGIN {
  FS = "|"
  achou_cabecalho = 0
  col_id = 0
  col_dep = 0
  col_status = 0
  total = 0
}

# Tira espaço das pontas e os enfeites de markdown que os geradores põem nas células
# (`**T1**`, `` `Concluído` ``). Sem isto a comparação de estado falha por causa de negrito.
function limpar(texto) {
  gsub(/\*\*/, "", texto)
  gsub(/`/, "", texto)
  gsub(/^[ \t]+/, "", texto)
  gsub(/[ \t]+$/, "", texto)
  return texto
}

# Todas as dependências de `id` estão concluídas?
#
# Extrai os identificadores `T<n>` da célula por varredura, o que tolera as formas livres que
# os planos usam de fato: `T2, T3`, `T2 e T3`, `—`, `Nenhuma`, vazio. Célula sem nenhum `T<n>`
# significa "sem dependência", e a task está pronta.
function dependencias_fechadas(id,    resto, dep, todas) {
  resto = dependencias[id]
  todas = 1
  while (match(resto, /T[0-9]+/)) {
    dep = substr(resto, RSTART, RLENGTH)
    resto = substr(resto, RSTART + RLENGTH)
    # Dependência que a tabela não declara é ambiguidade: trate como aberta.
    if (!(dep in estado)) { todas = 0; break }
    if (estado[dep] !~ /^Conclu[ií]d/) { todas = 0; break }
  }
  return todas
}

# --- Cabeçalho: só o da PRIMEIRA tabela que qualifica ---------------------------------------
!achou_cabecalho && /\|/ {
  candidata_id = 0
  candidata_dep = 0
  candidata_status = 0
  for (i = 1; i <= NF; i++) {
    celula = limpar($i)
    if (celula == "ID" || celula == "Task" || celula == "TaskCard") candidata_id = i
    else if (celula ~ /^Depend/) candidata_dep = i
    else if (celula == "Status") candidata_status = i
  }
  if (candidata_id && candidata_dep && candidata_status) {
    achou_cabecalho = 1
    col_id = candidata_id
    col_dep = candidata_dep
    col_status = candidata_status
  }
  next
}

# --- Linhas da tabela -----------------------------------------------------------------------
achou_cabecalho && /\|/ {
  id = limpar($col_id)
  # Descarta o separador `|---|---|` e qualquer linha que não seja de task.
  if (id !~ /^T[0-9]+$/) next
  # Linha repetida (tabela reemitida): a primeira ocorrência manda.
  if (id in estado) next
  ordem[++total] = id
  estado[id] = limpar($col_status)
  dependencias[id] = limpar($col_dep)
}

END {
  if (!achou_cabecalho) { print "SEM_TABELA"; exit 0 }

  for (k = 1; k <= total; k++) {
    id = ordem[k]
    if (estado[id] ~ /^Em Progresso/) { print "EM_PROGRESSO " id; exit 0 }
  }

  for (k = 1; k <= total; k++) {
    id = ordem[k]
    if (estado[id] !~ /^A Fazer/) continue
    if (dependencias_fechadas(id)) { print "PRONTA " id; exit 0 }
  }
}
```

---

## Anexo C — a barreira executável (implementação de referência)

> Vitest. A lógica porta para qualquer runner: cada caso monta uma raiz de projeto sintética,
> executa o script de verdade e observa a saída. Nenhum caso inspeciona o texto do script.

```ts
/**
 * Barreira executável da Guarda de Continuidade do Run — CT-954 a CT-966.
 *
 * A faixa **CT-9xx é deliberada**, pela mesma razão que `protocolo-antirregressao.spec.ts`
 * documenta: estes casos não provam regra de domínio, provam o substrato do pipeline. A
 * sequência de domínio cresce fatia a fatia e alcançaria qualquer faixa baixa que se
 * escolhesse. O último 9xx alocado antes deste arquivo era o CT-953.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | CT     | Invariante |
 * |--------|------------|
 * | CT-954 | Plano sem pendência não bloqueia — a guarda é silenciosa no caso normal. |
 * | CT-955 | Task `A Fazer` com TODAS as dependências `Concluído` bloqueia, e a razão nomeia
 * |        | a task devida. É o controle POSITIVO do par com o CT-954. |
 * | CT-956 | Task `A Fazer` com dependência aberta NÃO bloqueia — despacho não é devido. |
 * | CT-957 | Task `Em Progresso` bloqueia, e tem PRECEDÊNCIA sobre a task pronta. |
 * | CT-958 | Sem marcador `_run/.run-ativo` a guarda é inerte — fora de run ela não existe. |
 * | CT-959 | Marcador vinculado a OUTRA sessão não bloqueia a sessão corrente. |
 * | CT-960 | O orçamento de reincidência tem teto: ao esgotá-lo a guarda LIBERA o encerramento. |
 * | CT-961 | Progresso muda a assinatura do estado e ZERA o orçamento. |
 * | CT-962 | Marcador abandonado (mais velho que o TTL) não prende a sessão. |
 * | CT-963 | Falha para o lado ABERTO: entrada não-JSON, sem `session_id` e plano ausente
 * |        | saem em silêncio, com código 0 e sem bloquear. |
 * | CT-964 | `SYSLOC_SEM_GUARDA_DE_RUN=1` desliga a guarda por completo. |
 * | CT-965 | `--armar` cria o marcador e `--desarmar` o remove. |
 * | CT-966 | A tabela lida é a de EXECUÇÃO, não a de rastreabilidade de User Stories — cujas
 * |        | linhas ficam `A Fazer` para sempre por design e produziriam bloqueio eterno. |
 *
 * ---------------------------------------------------------------------------
 * Por que uma barreira, e por que ELA e não outra coisa
 * ---------------------------------------------------------------------------
 *
 * A guarda é um gancho de `Stop`: ela roda fora da suíte, sem ninguém olhando, e o modo de
 * falha que mais importa é SILENCIOSO nos dois sentidos. Se ela deixar de detectar, o run volta
 * a parar no meio e ninguém percebe que a guarda parou de funcionar — o sintoma é
 * indistinguível de um run que simplesmente acabou. Se ela detectar demais, ela APRISIONA a
 * sessão: o turno não termina e não há caminho de código que o solte. Os dois lados precisam de
 * prova, e é por isso que metade dos casos abaixo prova o NÃO-bloqueio.
 *
 * ---------------------------------------------------------------------------
 * Natureza das asserções e o que isto NÃO exige
 * ---------------------------------------------------------------------------
 *
 * Toda asserção aqui é **comportamental**: cada caso executa o script de verdade, com entrada
 * sintética, e observa a saída. Pela tabela do P4 de `.claude/rules/nao-regressao.md`, asserção
 * comportamental **não se demonstra por execução de mutante** — o caso já reprova naturalmente
 * com o código antigo. A asserção que discrimina, em cada par, é a presença de `decision:
 * "block"` na saída padrão: o predicado não tem outra forma de manifestar a decisão, e nenhum
 * dos casos negativos pode produzi-la por acidente, porque o script só a emite no fim de um
 * caminho que exige marcador, vínculo de sessão, TTL válido e veredito não-vazio.
 *
 * A prova de falsificação por execução seria exigida se estes casos inspecionassem o TEXTO do
 * script (`grep` sobre o fonte). Eles não o fazem, deliberadamente: uma asserção sobre o texto
 * do gancho ficaria verde com o gancho quebrado, que é o defeito exato que a guarda existe para
 * não ter.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const GANCHO = join(RAIZ_DO_REPOSITORIO, 'deploy/scripts/run/guarda-de-run.sh');

const FEATURE = 'fixture-da-guarda';

/** Linhas de tabela no formato que os geradores do agent-spec emitem. */
interface LinhaDeTask {
  readonly id: string;
  readonly dependencias: string;
  readonly status: string;
}

/**
 * Monta um `task_plan.md` com a tabela de execução — e, opcionalmente, a de rastreabilidade
 * que existe em todo plano real e cujas linhas nunca saem de `A Fazer`.
 */
function planoCom(tasks: readonly LinhaDeTask[], comTabelaDeRastreabilidade = false): string {
  const cabecalho =
    '| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? | Status |\n' +
    '|---|---|---|---|---|---|---|\n';
  const linhas = tasks
    .map(
      (t) =>
        `| ${t.id} | nome | [${t.id}](tasks/${t.id}.md) | 1 | ${t.dependencias} | Não | ${t.status} |`,
    )
    .join('\n');
  const rastreabilidade = comTabelaDeRastreabilidade
    ? '\n\n## 6. Rastreabilidade\n\n' +
      '| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |\n' +
      '|---|---|---|---|\n' +
      '| US-01 — alguma coisa | §7.2 | T1, T2 | A Fazer |\n' +
      '| US-02 — outra coisa | §7.3 | T2 | A Fazer |\n'
    : '';
  return `# Plano\n\n## 4. Tasks\n\n${cabecalho}${linhas}\n${rastreabilidade}`;
}

/** Ambiente isolado: uma raiz de projeto sintética e um diretório de orçamento só deste caso. */
interface Ambiente {
  readonly raiz: string;
  readonly temp: string;
  readonly plano: string;
  readonly marcador: string;
}

let ambiente: Ambiente;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'guarda-de-run-'));
  const diretorioDaFatia = join(base, 'raiz', 'docs/specs/features', FEATURE, 'v1');
  mkdirSync(join(diretorioDaFatia, '_run'), { recursive: true });
  mkdirSync(join(base, 'temp'), { recursive: true });
  ambiente = {
    raiz: join(base, 'raiz'),
    temp: join(base, 'temp'),
    plano: join(diretorioDaFatia, 'task_plan.md'),
    marcador: join(diretorioDaFatia, '_run', '.run-ativo'),
  };
});

afterEach(() => {
  rmSync(join(ambiente.raiz, '..'), { recursive: true, force: true });
});

interface Resultado {
  readonly stdout: string;
  readonly stderr: string;
  readonly codigo: number;
}

/**
 * `spawnSync`, e NÃO `execFileSync`: o segundo devolve apenas a saída padrão no caminho de
 * sucesso, e a guarda comunica pela saída de erro justamente quando NÃO bloqueia (marcador
 * abandonado, orçamento esgotado). Com `execFileSync` os casos que provam essas duas liberações
 * ficariam cegos — asserção sobre um fluxo que o arranjo nunca captura.
 */
function executar(
  argumentos: readonly string[],
  entrada: string,
  extra: Record<string, string> = {},
): Resultado {
  const processo = spawnSync('bash', [GANCHO, ...argumentos], {
    input: entrada,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: ambiente.raiz,
      TMPDIR: ambiente.temp,
      ...extra,
    },
  });
  return {
    stdout: processo.stdout ?? '',
    stderr: processo.stderr ?? '',
    codigo: processo.status ?? 1,
  };
}

/** Um fim de turno da sessão informada. */
function fimDeTurno(sessao = 'sessao-corrente', extra: Record<string, string> = {}): Resultado {
  return executar([], JSON.stringify({ session_id: sessao, stop_hook_active: false }), extra);
}

function armar(): void {
  executar(['--armar', ambiente.plano], '');
}

function vincularA(sessao: string): void {
  armar();
  writeFileSync(
    ambiente.marcador,
    `criado_em: 2026-08-18T00:00:00-03:00\ntask_plan: x\nsession_id: ${sessao}\n`,
    'utf8',
  );
}

/** A asserção que discrimina: o script só emite `decision: "block"` ao decidir bloquear. */
function bloqueou(resultado: Resultado): boolean {
  if (resultado.stdout.trim() === '') return false;
  const corpo = JSON.parse(resultado.stdout) as { decision?: string; reason?: string };
  return corpo.decision === 'block';
}

function razao(resultado: Resultado): string {
  return (JSON.parse(resultado.stdout) as { reason: string }).reason;
}

describe('Guarda de Continuidade do Run — o gancho de Stop', () => {
  it('CT-954: não bloqueia quando nenhuma task é devida', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'Concluído' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(resultado.codigo).toBe(0);
    expect(resultado.stdout.trim()).toBe('');
  });

  it('CT-955: bloqueia quando há task pronta, e a razão nomeia a task devida', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(true);
    // Nomear a task é o que separa um bloqueio acionável de um alarme genérico.
    expect(razao(resultado)).toContain('T2');
    expect(razao(resultado)).toContain('autonomia-do-run.md');
  });

  it('CT-956: não bloqueia quando a dependência da task ainda está aberta', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Bloqueado' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    expect(bloqueou(fimDeTurno())).toBe(false);
  });

  it('CT-957: task Em Progresso bloqueia e tem precedência sobre a task pronta', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
        { id: 'T3', dependencias: 'T1', status: 'Em Progresso' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(true);
    // A execução interrompida é o defeito mais grave; relatar a T2 esconderia a T3.
    expect(razao(resultado)).toContain('T3');
    expect(razao(resultado)).toContain('Em Progresso');
  });

  it('CT-958: é inerte sem o marcador — fora de um run a guarda não existe', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    // Sem armar().

    const resultado = fimDeTurno();

    expect(resultado.codigo).toBe(0);
    expect(resultado.stdout.trim()).toBe('');
  });

  it('CT-959: marcador vinculado a outra sessão não prende a sessão corrente', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    vincularA('sessao-de-outro-run');

    expect(bloqueou(fimDeTurno('sessao-corrente'))).toBe(false);
    // E o run legítimo segue protegido.
    expect(bloqueou(fimDeTurno('sessao-de-outro-run'))).toBe(true);
  });

  it('CT-960: o orçamento de reincidência tem teto e libera o encerramento ao esgotar', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    const teto = { SYSLOC_GUARDA_TETO: '2' };
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);

    const liberado = fimDeTurno('s', teto);
    expect(bloqueou(liberado)).toBe(false);
    expect(liberado.stderr).toContain('bloqueios seguidos sem progresso');
  });

  it('CT-961: progresso muda a assinatura do estado e zera o orçamento', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'A Fazer' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    const teto = { SYSLOC_GUARDA_TETO: '1' };
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);
    expect(bloqueou(fimDeTurno('s', teto))).toBe(false); // teto de 1 esgotado

    // O run andou: T1 fechou e agora T2 é a devida.
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );

    const aposProgresso = fimDeTurno('s', teto);
    expect(bloqueou(aposProgresso)).toBe(true);
    expect(razao(aposProgresso)).toContain('T2');
  });

  it('CT-962: marcador abandonado não prende a sessão', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();
    const vinteHorasAtras = new Date(Date.now() - 20 * 60 * 60 * 1000);
    utimesSync(ambiente.marcador, vinteHorasAtras, vinteHorasAtras);

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(false);
    expect(resultado.stderr).toContain('abandonado');
  });

  it('CT-963: falha para o lado aberto em toda entrada degenerada', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    const naoJson = executar([], 'isto não é json {{{');
    expect(naoJson.codigo).toBe(0);
    expect(bloqueou(naoJson)).toBe(false);

    const semSessao = executar([], JSON.stringify({ stop_hook_active: false }));
    expect(semSessao.codigo).toBe(0);
    expect(bloqueou(semSessao)).toBe(false);

    rmSync(ambiente.plano);
    const semPlano = fimDeTurno();
    expect(semPlano.codigo).toBe(0);
    expect(bloqueou(semPlano)).toBe(false);
  });

  it('CT-964: a chave de desligamento desarma a guarda por completo', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    expect(bloqueou(fimDeTurno('s', { SYSLOC_SEM_GUARDA_DE_RUN: '1' }))).toBe(false);
    // E volta a valer sem a chave — o controle que separa "desligou" de "nunca funcionou".
    expect(bloqueou(fimDeTurno('s'))).toBe(true);
  });

  it('CT-965: --armar cria o marcador e --desarmar o remove', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));

    expect(existsSync(ambiente.marcador)).toBe(false);
    executar(['--armar', ambiente.plano], '');
    expect(existsSync(ambiente.marcador)).toBe(true);
    executar(['--desarmar', ambiente.plano], '');
    expect(existsSync(ambiente.marcador)).toBe(false);
  });

  it('CT-966: lê a tabela de execução, não a de rastreabilidade de User Stories', () => {
    // Todas as tasks fechadas; as linhas de US ficam `A Fazer` para sempre, por design.
    writeFileSync(
      ambiente.plano,
      planoCom([{ id: 'T1', dependencias: '—', status: 'Concluído' }], true),
    );
    armar();

    // Bloquear aqui seria bloqueio ETERNO: nada no pipeline muda o Status daquelas linhas.
    expect(bloqueou(fimDeTurno())).toBe(false);
  });
});
```

---

## Anexo D — registro no `.claude/settings.json`

Preserve os ganchos existentes; acrescente apenas a chave `Stop`.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/deploy/scripts/run/guarda-de-run.sh\"",
            "timeout": 15,
            "statusMessage": "Conferindo se o run tem despacho devido…"
          }
        ]
      }
    ]
  }
}
```

> ⚠️ **O Claude Code fotografa os ganchos na abertura da sessão.** Editar `settings.json` no meio
> de uma sessão não muda o comportamento dela — o registro passa a valer na próxima. Isso torna a
> instalação segura mesmo com um run em andamento, e significa que **você precisa reabrir a
> sessão (ou rodar `/hooks`) para ver a guarda funcionando**.

---

## Anexo E — o par de chamadas na skill de run

**Na inicialização**, logo após a skill marcar o estado da execução como em andamento:

````markdown
N.1. **Arme a guarda de continuidade do run** (gancho de `Stop`):
   ```bash
   bash deploy/scripts/run/guarda-de-run.sh --armar <task_plan_path>
   ```
   Cria `_run/.run-ativo`, que é o que autoriza o gancho a impedir o encerramento do turno com
   task devida. **Sem este passo o run corre desprotegido.** O comando é idempotente e nunca
   aborta o run; se o script não existir, siga em frente.
````

**No fecho**, na seção que só executa depois de todas as tasks atingirem estado terminal:

````markdown
N. **Desarme a guarda de continuidade** — este é o passo que declara o run encerrado:
   ```bash
   bash deploy/scripts/run/guarda-de-run.sh --desarmar <task_plan_path>
   ```
   **Só execute depois de conferir a pré-condição de entrada desta seção**: desarmar com task
   pendente devolve ao run exatamente a fragilidade que o gancho fechou.
````

E um item no checklist final do orquestrador:

```markdown
- [ ] Guarda de continuidade **armada** no início (`--armar`) e **desarmada** no fim (`--desarmar`)
```
