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
