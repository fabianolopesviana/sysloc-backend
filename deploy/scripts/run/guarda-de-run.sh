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
