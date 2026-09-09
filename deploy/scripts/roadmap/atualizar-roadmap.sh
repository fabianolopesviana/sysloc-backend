#!/usr/bin/env bash
#
# Atualiza o painel de estado do roadmap a partir do que existe no repositório.
#
# ## O que este script faz, e o que ele deliberadamente NÃO faz
#
# Ele reescreve **apenas** os blocos delimitados por marcadores no `roadmap.md`: o painel de
# progresso, a linha de estado de cada fase e o bloco do que está **fora** das oito fases. Toda a prosa — o que cada fase é, o que entrega, por
# que foi fatiada assim — fica fora dos marcadores e **nunca** é tocada. A separação é o que permite
# rodar isto quantas vezes for preciso sem risco de perder texto escrito à mão.
#
# A fonte do estado é o `_run/*state.yaml` de cada feature, que é escrito pelo próprio pipeline do
# agent-spec ao fechar uma task. Não há segunda fonte a divergir: se o pipeline não marcou, o
# roadmap não inventa.
#
# ## Por que bash e não um gerador em TypeScript
#
# O roadmap precisa estar correto mesmo quando a árvore não compila — inclusive no meio de uma fatia
# quebrada, que é justamente quando alguém abre o roadmap para se situar. Um gerador que dependa de
# `pnpm build` seria inútil na hora em que mais importa.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROADMAP="$RAIZ/docs/plano-backend-novo/roadmap.md"
FEATURES="$RAIZ/docs/specs/features"

# Fase → fatias que a compõem, na ordem de execução. Uma fase pode ter mais de uma fatia: a F1 tem
# duas, e o plano prevê que outras se desdobrem — o pré-refinamento de cada fase pode partir uma
# fatia em duas quando a amplitude não couber num run só.
#
# O separador entre fatias é `;` e o formato de cada uma é `<feature>/<versao>`. Fatia ainda não
# especificada entra como `<feature>/v1` mesmo assim: o script a reporta como "não iniciada", que é
# a informação correta.
#
# ⚠️ Só entra aqui **fatia executável**. O pré-refinamento de uma fase partida tem diretório próprio
# em `docs/specs/features/` — `dominio-locacao/v1` para a F2, `cobranca-mora-e-documentos/v1` para a
# F3, `regua-e-documentos/v1` para a sub-partição da fatia 2 da F3, e `integracao-bancaria-sicoob/v1`
# para a F4 — e ele NÃO é fatia: não tem `_run/`, não tem task, e listá-lo faz o painel reportar uma
# fatia "especificada" que ninguém vai executar, escondendo o estado real das que existem.
#
# O nome do diretório de pré-refinamento **não avisa** que ele é pré-refinamento: `dominio-locacao` e
# `integracao-bancaria-sicoob` parecem fatia. O que distingue é a ausência de `_run/`, e é por isso
# que a lista acima se mantém por extenso: cada vez que uma fase se parte, a entrada dela aqui deixa
# de valer, e a única barreira contra reintroduzi-la é esta enumeração.
declare -A FATIAS_DA_FASE=(
  [F0]='fundacao-stack-nativa/v1'
  [F1]='fundacao-multitenancy-identidade/v1;autorizacao-e-ciclo-de-acesso/v1'
  [F2]='cadastro-de-imoveis-e-pessoas/v1;contratos-de-locacao/v1'
  [F3]='cobranca-e-mora/v1;regua-de-cobranca/v1;documentos-e-confirmacao/v1'
  [F4]='fundacao-bancaria/v1;emissao-e-conciliacao/v1;webhook-e-carne/v1'
  [F5]='integracao-bancaria-autonoma/v1;automacoes-agendadas/v1'
  [F6]='frontend-religado/v1'
  [F7]='publicacao-e-backup/v1;virada-e-desinstalacao/v1'
)

FASES=(F0 F1 F2 F3 F4 F5 F6 F7)

# --------------------------------------------------------------------------- #
# TRILHAS — trabalho declarado que NÃO pertence às oito fases
# --------------------------------------------------------------------------- #
#
# As oito fases são o plano de migração, e ele fechou: o marco de entrega está 7/7. O que se
# constrói depois disso não tem fase, e por isso ganha **trilha** — mesma mecânica, nome próprio.
#
# ⚠️ **Isto NÃO é a segunda lista que `fatias_fora_das_fases` recusa.** A distinção é o que cada
# uma resolve, e elas são problemas opostos:
#
#   · a descoberta por diferença resolve *"o que EXISTE não pode ficar invisível"*;
#   · a declaração resolve *"o que foi DECIDIDO e ainda não existe precisa aparecer"*.
#
# Descoberta não alcança o segundo — não há diretório para achar. É a mesma razão pela qual
# `frontend-religado/v1` mora no mapa da F6 sem existir no disco: o gerador a reporta como não
# iniciada, que é a informação correta. Fatia declarada aqui sai do bloco de descoberta por
# construção (`fatias_enumeradas` varre os dois), de modo que não há dupla contagem.
declare -A TRILHAS=(
  [PIX]='Cobrança pagável por Pix — boleto híbrido, Pix autônomo e comprovante'
)

FATIAS_DA_FASE[PIX]='boleto-hibrido-e-comprovante/v1;cobranca-pix/v1'

NOMES_DAS_TRILHAS=(PIX)

# ---------------------------------------------------------------------------- #
# Leitura de estado — uma fatia
# ---------------------------------------------------------------------------- #

# Ecoa `<estado>|<concluidas>|<total>` para uma fatia.
#
# `<estado>` é um de: concluida, em_andamento, especificada, nao_iniciada.
#
# A distinção entre `especificada` e `nao_iniciada` importa mais do que parece: uma fatia com spec
# pronta e execução pendente é trabalho que já consumiu decisão e pode ser executado agora; uma sem
# spec ainda precisa de pré-refinamento. Confundir as duas faz o roadmap prometer prazo que não tem.
ler_fatia() {
  local caminho="$FEATURES/$1"
  local arquivo_de_estado

  if [[ ! -d "$caminho" ]]; then
    echo 'nao_iniciada|0|0'
    return 0
  fi

  arquivo_de_estado="$(find "$caminho/_run" -maxdepth 1 -name '*state.yaml' 2>/dev/null | head -1)"

  if [[ -z "$arquivo_de_estado" ]]; then
    echo 'especificada|0|0'
    return 0
  fi

  local bloco status total concluidas
  bloco="$(sed -n '/^  execution:/,/^  [a-z]/p' "$arquivo_de_estado")"
  status="$(sed -n 's/^ *status: *//p' <<<"$bloco" | head -1)"
  total="$(sed -n 's/^ *tasks_total: *//p' <<<"$bloco" | head -1)"
  concluidas="$(sed -n 's/^ *tasks_completed: *//p' <<<"$bloco" | head -1)"

  total="${total:-0}"
  concluidas="${concluidas:-0}"

  case "$status" in
    completed) echo "concluida|$concluidas|$total" ;;
    in_progress) echo "em_andamento|$concluidas|$total" ;;
    *) echo "especificada|$concluidas|$total" ;;
  esac
}

# Verdadeiro quando a fatia tem estado de pipeline no disco — isto é, quando ela chegou a ser
# executada. É o que separa **fatia** de **material de refinamento**, e a distinção não pode sair do
# nome: `dominio-locacao` e `integracao-bancaria-sicoob` parecem fatia e são pré-refinamento de fase
# partida. O disco responde; o nome, não.
tem_estado_de_pipeline() {
  local caminho="$FEATURES/$1"
  [[ -n "$(find "$caminho/_run" -maxdepth 1 -name '*state.yaml' 2>/dev/null | head -1)" ]]
}

# Ecoa, uma por linha, toda fatia enumerada em FATIAS_DA_FASE.
fatias_enumeradas() {
  local grupo lista
  for grupo in "${FASES[@]}" "${NOMES_DAS_TRILHAS[@]}"; do
    IFS=';' read -r -a lista <<<"${FATIAS_DA_FASE[$grupo]}"
    printf '%s\n' "${lista[@]}"
  done
}

# Ecoa, uma por linha e em ordem, toda fatia que existe no disco e **não** está na enumeração.
#
# ## Por que por DIFERENÇA, e não por uma segunda lista
#
# A enumeração acima cobre as oito fases do plano de migração, e ela é mantida à mão por uma razão
# escrita no docblock dela — diretório de pré-refinamento parece fatia e não é. O que ela não cobre é
# **tudo o mais**: a fatia do backend Frappe antigo, e agora a construção posterior ao marco de
# entrega, que está 7/7. Fatia nessa condição era invisível **em silêncio**: o gancho disparava, este
# script saía com sucesso, e o painel simplesmente não a mencionava.
#
# A história do repositório mede o custo disso — três commits de correção (`inclui a fatia
# publicacao-e-backup`, `ensina o gerador a ver as sub-fatias da F3`, `parte a F5 em duas`), cada um
# porque uma fatia ficou fora do painel até alguém reparar. Medido em 2026-09-09, a fatia
# `painel-master-administradores/v1` estava **concluída** e nunca havia aparecido.
#
# Uma segunda lista à mão repetiria o defeito com outro nome. O complemento não: fatia nova entra
# sozinha, e esquecer de enumerá-la numa fase deixa de escondê-la — passa a exibi-la aqui, que é o
# sintoma visível de que o mapa da fase precisa de uma entrada.
fatias_fora_das_fases() {
  local enumeradas caminho fatia
  enumeradas="$(fatias_enumeradas | sort -u)"

  for caminho in "$FEATURES"/*/*/; do
    [[ -d "$caminho" ]] || continue
    fatia="$(basename "$(dirname "$caminho")")/$(basename "$caminho")"
    if grep -qxF "$fatia" <<<"$enumeradas"; then
      continue
    fi
    printf '%s\n' "$fatia"
  done | sort
}

# ---------------------------------------------------------------------------- #
# Agregação — uma fase
# ---------------------------------------------------------------------------- #

# Ecoa `<simbolo>|<rotulo>|<detalhe>` para a fase inteira.
estado_da_fase() {
  local fase="$1"
  local fatias total_de_fatias=0 concluidas_de_fatias=0 alguma_em_andamento=0 alguma_especificada=0
  local soma_tasks=0 soma_concluidas=0 detalhe=''

  IFS=';' read -r -a fatias <<<"${FATIAS_DA_FASE[$fase]}"

  for fatia in "${fatias[@]}"; do
    local linha estado concluidas total
    linha="$(ler_fatia "$fatia")"
    IFS='|' read -r estado concluidas total <<<"$linha"

    total_de_fatias=$((total_de_fatias + 1))
    soma_tasks=$((soma_tasks + total))
    soma_concluidas=$((soma_concluidas + concluidas))

    case "$estado" in
      concluida) concluidas_de_fatias=$((concluidas_de_fatias + 1)) ;;
      em_andamento) alguma_em_andamento=1 ;;
      especificada) alguma_especificada=1 ;;
      *) ;;
    esac
  done

  if [[ "$soma_tasks" -gt 0 ]]; then
    detalhe="$soma_concluidas/$soma_tasks tasks"
  fi

  if [[ "$concluidas_de_fatias" -eq "$total_de_fatias" ]]; then
    echo "✅|concluída|$detalhe"
  elif [[ "$alguma_em_andamento" -eq 1 ]]; then
    echo "🔄|em andamento|$concluidas_de_fatias de $total_de_fatias fatias · $detalhe"
  elif [[ "$concluidas_de_fatias" -gt 0 ]]; then
    echo "🔄|em andamento|$concluidas_de_fatias de $total_de_fatias fatias · $detalhe"
  elif [[ "$alguma_especificada" -eq 1 ]]; then
    echo "📋|especificada, execução pendente|$detalhe"
  else
    echo "⬜|não iniciada|"
  fi
}

# ---------------------------------------------------------------------------- #
# Geração dos blocos
# ---------------------------------------------------------------------------- #

painel() {
  echo '| Fase | O quê | Estado | Progresso |'
  echo '|---|---|---|---|'

  local -A resumo=(
    [F0]='Stack instalada e provada'
    [F1]='Fundação SaaS — isolamento, identidade e autorização'
    [F2]='Domínio de locação'
    [F3]='Cobrança, mora e documentos'
    [F4]='Integração bancária (Sicoob)'
    [F5]='Integração bancária autônoma e automações'
    [F6]='Frontend religado — só o handoff sai daqui'
    [F7]='Virada e desinstalação — partida em duas'
  )

  for fase in "${FASES[@]}"; do
    local simbolo rotulo detalhe
    IFS='|' read -r simbolo rotulo detalhe <<<"$(estado_da_fase "$fase")"
    printf '| **%s** | %s | %s %s | %s |\n' \
      "$fase" "${resumo[$fase]}" "$simbolo" "$rotulo" "${detalhe:-—}"
  done

  # As trilhas entram na mesma tabela e com a coluna de fase marcada como *trilha*, não como
  # número de fase: numerá-las como F8 diria que o plano de migração cresceu, e ele não cresceu.
  local trilha
  for trilha in "${NOMES_DAS_TRILHAS[@]}"; do
    local simbolo rotulo detalhe
    IFS='|' read -r simbolo rotulo detalhe <<<"$(estado_da_fase "$trilha")"
    printf '| _trilha_ | %s | %s %s | %s |\n' \
      "${TRILHAS[$trilha]}" "$simbolo" "$rotulo" "${detalhe:-—}"
  done
}

linha_de_estado() {
  local fase="$1"
  local simbolo rotulo detalhe
  IFS='|' read -r simbolo rotulo detalhe <<<"$(estado_da_fase "$fase")"

  local fatias
  IFS=';' read -r -a fatias <<<"${FATIAS_DA_FASE[$fase]}"

  printf '> %s **%s**' "$simbolo" "$rotulo"
  [[ -n "$detalhe" ]] && printf ' — %s' "$detalhe"
  printf '\n>\n'

  for fatia in "${fatias[@]}"; do
    local linha estado concluidas total marca
    linha="$(ler_fatia "$fatia")"
    IFS='|' read -r estado concluidas total <<<"$linha"

    case "$estado" in
      concluida) marca='✅' ;;
      em_andamento) marca='🔄' ;;
      especificada) marca='📋' ;;
      *) marca='⬜' ;;
    esac

    printf '> %s `%s`' "$marca" "$fatia"
    [[ "$total" -gt 0 ]] && printf ' — %s/%s tasks' "$concluidas" "$total"
    printf '\n'
  done
}

# Bloco do que existe no disco e está fora das oito fases.
#
# O eixo aqui é **estado**, não procedência — e a escolha é deliberada. Dizer *o que uma fatia é*
# (do plano novo, do Frappe antigo, posterior ao marco) é trabalho da prosa, que fica fora dos
# marcadores e é escrita por gente. Dizer *em que estado ela está* é trabalho deste script. Agrupar
# por procedência exigiria uma segunda enumeração à mão — exatamente o defeito que esta seção existe
# para fechar.
bloco_fora_das_fases() {
  local fatia linha estado concluidas total
  local pendentes=() concluidas_lista=() refinamento=()

  while IFS= read -r fatia; do
    [[ -n "$fatia" ]] || continue

    if ! tem_estado_de_pipeline "$fatia"; then
      refinamento+=("$fatia")
      continue
    fi

    linha="$(ler_fatia "$fatia")"
    IFS='|' read -r estado concluidas total <<<"$linha"

    if [[ "$estado" == 'concluida' ]]; then
      concluidas_lista+=("$fatia")
    else
      local marca='📋'
      [[ "$estado" == 'em_andamento' ]] && marca='🔄'
      if [[ "$total" -gt 0 ]]; then
        pendentes+=("$marca \`$fatia\` — $concluidas/$total tasks")
      else
        pendentes+=("$marca \`$fatia\`")
      fi
    fi
  done < <(fatias_fora_das_fases)

  local com_execucao=$(( ${#concluidas_lista[@]} + ${#pendentes[@]} ))
  printf '> **%s fatias com execução registrada · %s diretórios em refinamento**\n>\n' \
    "$com_execucao" "${#refinamento[@]}"

  # As pendentes vêm primeiro e uma por linha: são as únicas que pedem ação.
  if [[ "${#pendentes[@]}" -gt 0 ]]; then
    printf '> **Em andamento ou pendentes**\n>\n'
    printf '> %s\n' "${pendentes[@]}"
  else
    printf '> **Em andamento ou pendentes** — nenhuma\n'
  fi
  printf '>\n'

  # Concluídas e refinamento vão adensadas: são registro, não pauta.
  if [[ "${#concluidas_lista[@]}" -gt 0 ]]; then
    printf '> ✅ **concluídas (%s):** ' "${#concluidas_lista[@]}"
    printf '`%s` · ' "${concluidas_lista[@]::${#concluidas_lista[@]}-1}"
    printf '`%s`\n' "${concluidas_lista[-1]}"
  fi

  if [[ "${#refinamento[@]}" -gt 0 ]]; then
    printf '> 📄 **refinamento, sem execução (%s):** ' "${#refinamento[@]}"
    printf '`%s` · ' "${refinamento[@]::${#refinamento[@]}-1}"
    printf '`%s`\n' "${refinamento[-1]}"
  fi
}

# Substitui o conteúdo entre `<!-- MARCA:INICIO -->` e `<!-- MARCA:FIM -->` pelo stdin.
substituir_bloco() {
  local marca="$1" conteudo="$2" temporario
  temporario="$(mktemp)"

  awk -v marca="$marca" -v arquivo="$conteudo" '
    $0 ~ "<!-- " marca ":INICIO -->" { print; dentro = 1; while ((getline linha < arquivo) > 0) print linha; next }
    $0 ~ "<!-- " marca ":FIM -->" { dentro = 0 }
    !dentro { print }
  ' "$ROADMAP" >"$temporario"

  mv "$temporario" "$ROADMAP"
}

main() {
  if [[ ! -f "$ROADMAP" ]]; then
    echo "roadmap não encontrado em $ROADMAP" >&2
    exit 1
  fi

  local temporario
  temporario="$(mktemp)"

  painel >"$temporario"
  substituir_bloco 'PAINEL' "$temporario"

  for fase in "${FASES[@]}"; do
    linha_de_estado "$fase" >"$temporario"
    substituir_bloco "ESTADO:$fase" "$temporario"
  done

  local trilha
  for trilha in "${NOMES_DAS_TRILHAS[@]}"; do
    linha_de_estado "$trilha" >"$temporario"
    substituir_bloco "ESTADO:$trilha" "$temporario"
  done

  bloco_fora_das_fases >"$temporario"
  substituir_bloco 'FORA-DAS-FASES' "$temporario"

  printf '_Painel gerado por `deploy/scripts/roadmap/atualizar-roadmap.sh` — não edite à mão._\n' \
    >"$temporario"
  substituir_bloco 'RODAPE' "$temporario"

  rm -f "$temporario"
  echo "roadmap atualizado: $ROADMAP"
}

main "$@"
