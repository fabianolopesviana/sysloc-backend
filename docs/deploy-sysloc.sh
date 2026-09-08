#!/usr/bin/env bash
#
# deploy-sysloc.sh — Deploy do build de producao do app Sysloc (backend NOVO)
#
# Uso (rode na SUA MAQUINA LOCAL, na raiz do projeto React):
#   ./deploy-sysloc.sh                 # deploy: build -> backup -> rsync -> valida -> prune
#   ./deploy-sysloc.sh --no-build      # deploy usando o build existente (nao roda 'npm run build')
#   ./deploy-sysloc.sh --rollback      # reverte para o backup MAIS RECENTE
#   ./deploy-sysloc.sh --rollback TS   # reverte para um backup especifico (ex.: 20260825-143012)
#   ./deploy-sysloc.sh --list          # lista os backups disponiveis no servidor
#   ./deploy-sysloc.sh --prune         # remove backups antigos, mantendo os 5 mais recentes
#   ./deploy-sysloc.sh --help          # ajuda
#
# ATENCAO — esta e a versao para o BACKEND NOVO (Node/NestJS, publicado em
# https://sysloc.systera.com.br/v1/*). Ela NAO fala com o Frappe: nao ha token de
# API no bundle, a sessao e por cookie httpOnly e as chamadas sao a caminhos
# relativos /v1/*.
#
# Enquanto a religacao da borda nao acontecer no servidor (encaminhar /v1/* para
# 127.0.0.1:3000 antes do try_files do SPA), a checagem `check_api_v1` REPROVA de
# proposito. Isso e o sintoma correto, nao defeito do script.
#
set -euo pipefail

# ------------------------- Configuracao -------------------------
SSH_USER="sysloc"
SSH_HOST="177.185.117.139"
SSH_PORT="22"
REMOTE_DIR="/opt/react/sysloc/html"     # diretorio publicado (servido pelo vhost de sysloc.systera.com.br)
LOCAL_BUILD=""                          # vazio = detectar 'build' (CRA) ou 'dist' (Vite)
PUBLIC_URL="https://sysloc.systera.com.br"
BACKUP_PREFIX="html-backup-"            # backups ficam em ~/${BACKUP_PREFIX}<timestamp> no servidor
KEEP_BACKUPS="5"                        # quantos backups manter no --prune
# ----------------------------------------------------------------

# Opcoes SSH com MULTIPLEXACAO (ControlMaster): abre UMA conexao e reutiliza em
# todas as operacoes (backup, rsync, prune). Isso reduz drasticamente a chance de
# cair no "Connection closed by ... port 22" quando a porta 22 esta sob flood de
# bots (o sshd derruba conexoes novas quando o MaxStartups enche). + timeouts.
SSH_CTL="${TMPDIR:-/tmp}/deploy-cm-${SSH_USER}-${SSH_HOST}-${SSH_PORT}.sock"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=${SSH_CTL} -o ControlPersist=120 -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4"
SSH="ssh ${SSH_OPTS} -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST}"
RSYNC_RSH="ssh ${SSH_OPTS} -p ${SSH_PORT}"
SSH_RETRIES="5"                         # tentativas por operacao SSH (drops transitorios)

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

# Repete um comando ate N vezes, com espera crescente (para drops transitorios do sshd).
retry() {
  local n="$1"; shift
  local i=1
  while true; do
    "$@" && return 0
    if [ "${i}" -ge "${n}" ]; then return 1; fi
    warn "Tentativa ${i}/${n} falhou (possivel drop de conexao). Repetindo em $((i * 3))s..."
    sleep "$((i * 3))"
    i=$((i + 1))
  done
}

# Fecha a conexao mestre multiplexada ao sair do script.
cleanup_ssh() { ssh ${SSH_OPTS} -p "${SSH_PORT}" -O exit "${SSH_USER}@${SSH_HOST}" 2>/dev/null || true; }
trap cleanup_ssh EXIT

# Abre (com retry) a conexao mestre; chamadas seguintes a reutilizam. Idempotente.
ssh_connect() {
  ssh ${SSH_OPTS} -p "${SSH_PORT}" -O check "${SSH_USER}@${SSH_HOST}" 2>/dev/null && return 0
  log "Abrindo conexao SSH multiplexada com ${SSH_HOST} (porta ${SSH_PORT}). Digite a senha se solicitada (uma unica vez)..."
  retry "${SSH_RETRIES}" ${SSH} true \
    || fail "Nao consegui abrir conexao SSH apos ${SSH_RETRIES} tentativas. A porta 22 pode estar sob flood/fail2ban — aguarde alguns instantes e rode novamente."
  ok "Conexao SSH estabelecida (reutilizada nas proximas etapas)."
}

# ------------------------- Deteccao do build --------------------
# CRA gera 'build/', Vite gera 'dist/'. O levantamento do backend registra que o
# app e CRA (react-scripts 5.0.1), mas a religacao pode trocar o toolchain — e um
# LOCAL_BUILD fixo abortaria o deploy DEPOIS do rsync. Detectar remove essa armadilha.
detectar_build() {
  local d
  [ -n "${LOCAL_BUILD}" ] && return 0
  for d in build dist; do
    if [ -f "${d}/index.html" ]; then
      LOCAL_BUILD="${d}"
      log "Diretorio de build detectado: ./${LOCAL_BUILD}"
      return 0
    fi
  done
  LOCAL_BUILD="build"
}

# Extrai a referencia do bundle principal do index.html, aceitando CRA e Vite.
# Se o toolchain mudar de novo, e AQUI que se acrescenta o padrao novo.
referencia_do_bundle() {
  grep -oE '/(static/js/main\.[A-Za-z0-9]+\.js|assets/index-[A-Za-z0-9_-]+\.js)' "$1" 2>/dev/null | head -n1
}

# ------------------------- Validacao ----------------------------
check_http() {
  local path="$1" expected="$2" code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${PUBLIC_URL}${path}")" || code="000"
  if [ "${code}" = "${expected}" ]; then
    ok "GET ${path} -> HTTP ${code}"
  else
    fail "GET ${path} -> HTTP ${code} (esperado ${expected})"
  fi
}

# Prova que o que esta NO AR e o que voce acabou de buildar.
#
# Substitui a metade util do antigo `check_api_autenticada`: aquele extraia a
# credencial do bundle publicado e a usava contra o Frappe. Sem credencial no
# bundle (o backend novo usa cookie), o que sobra para provar e a INTEGRIDADE da
# publicacao — o index no ar referencia o mesmo bundle do build local, e o bundle
# responde 200. `/` e `/rotas-do-spa` retornando 200 NAO provam isso: sao o
# fallback try_files -> /index.html, que o nginx serve mesmo com o build errado.
check_bundle_publicado() {
  local tmp js_local js_remoto code
  js_local="$(referencia_do_bundle "${LOCAL_BUILD}/index.html")" || true
  tmp="$(mktemp)"
  curl -s --max-time 20 "${PUBLIC_URL}/" -o "${tmp}" || true
  js_remoto="$(referencia_do_bundle "${tmp}")" || true
  rm -f "${tmp}"

  if [ -z "${js_local}" ] || [ -z "${js_remoto}" ]; then
    warn "Nao identifiquei a referencia do bundle (nem CRA nem Vite) — conferencia de integridade pulada."
    warn "Se o toolchain mudou, acrescente o padrao novo em referencia_do_bundle()."
    return 0
  fi

  [ "${js_local}" = "${js_remoto}" ] || fail "O index.html publicado referencia '${js_remoto}',
       mas o build local gerou '${js_local}'. O que esta no ar NAO e o que voce buildou
       (rsync no diretorio errado? cache do nginx? deploy concorrente?)."

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${PUBLIC_URL}${js_remoto}")" || code="000"
  [ "${code}" = "200" ] || fail "O bundle ${js_remoto} respondeu HTTP ${code} (esperado 200)."

  ok "Bundle publicado confere com o build local (${js_remoto}) e responde 200."
}

# A checagem DECISIVA: a API responde no mesmo dominio do app.
#
# O modo de falhar aqui NAO e 404 nem 502 — e 200 com HTML, porque o try_files do
# SPA engole /v1/* e devolve o index.html. Por isso a asercao e sobre o
# CONTENT-TYPE, nao so sobre o status: checar status sozinho deixa passar.
check_api_v1() {
  local resposta code tipo
  resposta="$(curl -s -o /dev/null -w '%{http_code}|%{content_type}' --max-time 15 "${PUBLIC_URL}/v1/sessao")" || resposta="000|"
  code="${resposta%%|*}"
  tipo="${resposta#*|}"

  case "${tipo}" in
    application/json*)
      if [ "${code}" = "401" ]; then
        ok "A API responde no mesmo dominio: GET /v1/sessao -> 401 JSON (sem sessao)."
      else
        warn "GET /v1/sessao -> HTTP ${code} (JSON). Esperado 401 sem sessao — a API responde, mas confira."
      fi
      ;;
    text/html*)
      fail "GET /v1/sessao -> HTTP ${code}, tipo '${tipo}'.
       O vhost esta engolindo /v1/* no fallback do SPA: o app recebe HTML onde espera JSON,
       e toda chamada da tela vai estourar em 'Unexpected token <'.
       Corrigir e do SERVIDOR: encaminhar 'location /v1/' para 127.0.0.1:3000 ANTES do try_files.
       Enquanto a religacao da borda nao for feita, esta checagem reprova de proposito."
      ;;
    *)
      fail "GET /v1/sessao -> HTTP ${code}, tipo '${tipo:-sem resposta}'. A API nao respondeu como esperado."
      ;;
  esac
}

# Substitui o antigo `check_allowlist` da TC-001: a barreira mudou de objeto.
# Nao ha mais allowlist de /api/resource/* a conferir; o que nao pode vazar agora
# e o documento OpenAPI da API (debito D24 do backend). O vhost deve encaminhar
# APENAS /v1/ — /docs precisa cair no app. Nao bloqueia o deploy (o build nao
# influencia a config do nginx), mas avisa alto.
check_docs_fechado() {
  local tmp
  tmp="$(mktemp)"
  curl -s --max-time 10 "${PUBLIC_URL}/docs" -o "${tmp}" || true
  if grep -qi 'swagger' "${tmp}" 2>/dev/null; then
    warn "/docs esta servindo o Swagger da API para FORA — o vhost encaminha mais que /v1/."
    warn "Encaminhe apenas 'location /v1/' para a API; /docs deve cair no fallback do app."
  else
    ok "/docs nao expoe o contrato da API (cai no app)."
  fi
  rm -f "${tmp}"
}

# Source maps expoem o fonte da aplicacao.
#
# A versao anterior testava um caminho HARDCODED (main.3fb69968.js.map) e passava
# verde porque aquele arquivo nao existia — nao porque o nginx bloqueava. Falso
# verde. Esta versao so testa se o build local DE FATO gerou um .map, e testa
# aquele .map, que existe.
check_sourcemaps_publicados() {
  local mapa caminho code
  mapa="$(find "${LOCAL_BUILD}" -name '*.map' 2>/dev/null | head -n1)" || true
  if [ -z "${mapa}" ]; then
    ok "Build sem source maps — nada a expor."
    return 0
  fi
  caminho="${mapa#"${LOCAL_BUILD}"}"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${PUBLIC_URL}${caminho}")" || code="000"
  if [ "${code}" = "404" ] || [ "${code}" = "403" ]; then
    ok "Source maps bloqueados pelo servidor (${caminho} -> ${code})."
  else
    warn "${caminho} respondeu ${code} — o source map do app esta acessivel publicamente."
    warn "Defina GENERATE_SOURCEMAP=false no .env, ou bloqueie '\\.map$' no vhost."
  fi
}

validate() {
  log "Validando aplicacao em ${PUBLIC_URL} ..."
  check_http "/"          "200"   # pagina raiz
  check_http "/contratos" "200"   # rota SPA (fallback try_files -> index.html)
  check_bundle_publicado          # o que esta no ar e o que foi buildado
  check_api_v1                    # a API responde JSON no mesmo dominio
  check_docs_fechado              # a superficie interna nao vazou
  check_sourcemaps_publicados     # .map nao servido
}

# ------------------------- Guardas ------------------------------
# Impede publicar um build que ainda fala com o Frappe. Roda ANTES do rsync —
# depois dele o estrago ja esta no ar e so o rollback resolve.
#
# Substitui a guarda de REVOKED_KEYS da TC-001, que perdeu o objeto: o backend
# novo autentica por cookie httpOnly e NAO ha credencial embutida no bundle. A
# funcao da guarda continua a mesma (barrar bundle que nasce quebrado); o que
# mudou foi o sintoma que ela procura.
guard_build_local() {
  local achado

  if grep -rq 'REACT_APP_ERPNEXT' "${LOCAL_BUILD}" 2>/dev/null; then
    fail "O build carrega variaveis REACT_APP_ERPNEXT_* — ele ainda fala com o Frappe.
       O backend novo autentica por COOKIE de sessao; nao ha token de API no bundle.
       Remova essas variaveis do .env, religue as chamadas para /v1/* e rebuilde."
  fi
  ok "Build sem credencial do Frappe."

  if grep -rq -e '/api/resource/' -e '/api/method/' "${LOCAL_BUILD}" 2>/dev/null; then
    warn "O build ainda contem caminhos do ERPNext (/api/resource/ ou /api/method/)."
    warn "O backend novo nao atende esses caminhos — as telas que os usarem vao falhar em runtime."
  else
    ok "Build sem caminhos herdados do ERPNext."
  fi

  achado="$(find "${LOCAL_BUILD}" -name '*.map' 2>/dev/null | head -n1)" || true
  if [ -n "${achado}" ]; then
    warn "O build contem source maps (ex.: ${achado##*/}). Defina GENERATE_SOURCEMAP=false no .env."
  else
    ok "Build sem source maps."
  fi
}

# Mesma guarda, aplicada ao backup escolhido no rollback.
#
# Os backups anteriores a religacao sao bundles do app ANTIGO: restaurar um deles
# publica um app que chama /api/resource/* e /api/method/*, caminhos que o backend
# novo nao atende. O app abre, mas nenhuma tela carrega dado.
guard_backup_remoto() {
  local target="$1" ans_ant
  if ${SSH} "grep -rq 'REACT_APP_ERPNEXT' \"${target}\" 2>/dev/null"; then
    warn "ATENCAO: ${target##*/} e um bundle do app ANTIGO (fala com o Frappe)."
    warn "Restaura-lo publica um app cujas chamadas o backend novo NAO atende:"
    warn "o app vai abrir, mas nenhuma tela carregara dados."
    printf '\033[1;33m[aviso]\033[0m Restaurar mesmo assim? [y/N] '
    read -r ans_ant
    case "${ans_ant}" in
      y|Y|s|S) warn "Prosseguindo com o rollback para um bundle do app antigo." ;;
      *) fail "Rollback cancelado." ;;
    esac
    return 0
  fi
  ok "O backup e um bundle do app novo."
}

# ------------------------- Backups ------------------------------
list_backups() {
  ssh_connect
  log "Backups disponiveis no servidor (~/${BACKUP_PREFIX}*):"
  ${SSH} "ls -1d \"\$HOME/${BACKUP_PREFIX}\"* 2>/dev/null | sort" || true
}

# ------------------------- Prune (limpeza) ----------------------
do_prune() {
  local mode="${1:-}"   # "auto" = sem confirmacao (usado ao final do deploy)
  ssh_connect
  log "Verificando backups a remover (mantendo os ${KEEP_BACKUPS} mais recentes por data)..."
  local to_delete
  to_delete="$(${SSH} "ls -1dt \"\$HOME/${BACKUP_PREFIX}\"* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1))")" || true

  if [ -z "${to_delete}" ]; then
    ok "Nada a remover (ha ${KEEP_BACKUPS} backups ou menos)."
    return 0
  fi

  warn "Os seguintes backups serao REMOVIDOS:"
  printf '%s\n' "${to_delete}" | sed 's/^/  - /'

  if [ "${mode}" != "auto" ]; then
    printf '\033[1;33m[aviso]\033[0m Confirmar remocao? [y/N] '
    read -r ans
    case "${ans}" in
      y|Y|s|S) ;;
      *) fail "Prune cancelado pelo usuario." ;;
    esac
  fi

  retry "${SSH_RETRIES}" ${SSH} "ls -1dt \"\$HOME/${BACKUP_PREFIX}\"* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf" \
    && ok "Backups antigos removidos." || fail "Falha ao remover backups antigos."

  log "Backups restantes:"
  list_backups
}

# ------------------------- Rollback -----------------------------
do_rollback() {
  local ts="${1:-}"
  local target

  ssh_connect

  if [ -n "${ts}" ]; then
    target="\$HOME/${BACKUP_PREFIX}${ts}"
    log "Rollback para backup especifico: ${BACKUP_PREFIX}${ts}"
  else
    target="$(${SSH} "ls -1d \"\$HOME/${BACKUP_PREFIX}\"* 2>/dev/null | sort | tail -n1")" || true
    [ -n "${target}" ] || fail "Nenhum backup encontrado no servidor (~/${BACKUP_PREFIX}*)."
    log "Rollback para o backup mais recente: ${target##*/}"
  fi

  guard_backup_remoto "${target}"

  printf '\033[1;33m[aviso]\033[0m Isto vai SUBSTITUIR %s pelo backup. Continuar? [y/N] ' "${REMOTE_DIR}"
  read -r ans
  case "${ans}" in
    y|Y|s|S) ;;
    *) fail "Rollback cancelado pelo usuario." ;;
  esac

  local ts_now
  ts_now="$(date +%Y%m%d-%H%M%S)"
  log "Salvando estado atual antes do rollback em ~/${BACKUP_PREFIX}prerollback-${ts_now} ..."
  retry "${SSH_RETRIES}" ${SSH} "cp -a '${REMOTE_DIR}' \"\$HOME/${BACKUP_PREFIX}prerollback-${ts_now}\"" \
    && ok "Estado atual preservado." || warn "Nao foi possivel preservar o estado atual (seguindo mesmo assim)."

  log "Restaurando ${target##*/} -> ${REMOTE_DIR} ..."
  retry "${SSH_RETRIES}" ${SSH} "test -d \"${target}\" && rm -rf '${REMOTE_DIR}'/* && cp -a \"${target}\"/. '${REMOTE_DIR}'/" \
    && ok "Backup restaurado." || fail "Falha ao restaurar (o backup '${target##*/}' existe? use --list)."

  # No rollback o build local pode nem existir; as checagens que dependem dele sao puladas.
  log "Validando aplicacao em ${PUBLIC_URL} ..."
  check_http "/"          "200"
  check_http "/contratos" "200"
  check_api_v1
  check_docs_fechado
  echo
  ok "Rollback concluido. Restaurado: ${target##*/}"
}

# ------------------------- Deploy -------------------------------
do_deploy() {
  local no_build="${1:-}"   # "--no-build" pula a geracao do build local
  local pre ts

  # 0) Gerar build local (a menos que --no-build)
  if [ "${no_build}" = "--no-build" ]; then
    log "Flag --no-build: pulando 'npm run build', usando o build existente."
  else
    [ -f "package.json" ] || fail "'package.json' nao encontrado. Rode na raiz do projeto React."
    log "Gerando build de producao ('npm run build')..."
    npm run build || fail "'npm run build' falhou. Deploy abortado (nada foi publicado)."
    ok "Build gerado."
  fi

  # 1) Localizar e validar o build local
  detectar_build
  log "Verificando build local em './${LOCAL_BUILD}'..."
  [ -d "${LOCAL_BUILD}" ]            || fail "Pasta '${LOCAL_BUILD}' nao existe. Rode 'npm run build' antes (ou remova --no-build)."
  [ -f "${LOCAL_BUILD}/index.html" ] || fail "'${LOCAL_BUILD}/index.html' nao encontrado. Build incompleto?"
  ok "Build local encontrado em ./${LOCAL_BUILD}."

  # 1.2) Guardas — ANTES do rsync. Depois dele o estrago ja esta publicado.
  log "Conferindo o build contra as guardas..."
  guard_build_local

  # 1.3) Pre-checagem da borda: /v1/* ja e encaminhado para a API?
  # Nao bloqueia (o build nao influencia a config do nginx), mas diz ANTES de publicar
  # que a validacao final vai reprovar, e que a causa e do servidor.
  log "Conferindo se a borda ja encaminha /v1/* para a API..."
  pre="$(curl -s -o /dev/null -w '%{content_type}' --max-time 10 "${PUBLIC_URL}/v1/sessao")" || pre=""
  case "${pre}" in
    application/json*) ok "A borda encaminha /v1/* para a API." ;;
    *) warn "A borda ainda NAO encaminha /v1/* (tipo: '${pre:-sem resposta}')."
       warn "O deploy vai publicar os arquivos, mas check_api_v1 reprovara ao final."
       warn "A causa e do SERVIDOR (religacao do vhost), nao do seu build." ;;
  esac

  # 1.5) Abrir conexao SSH multiplexada (reutilizada em backup, rsync e prune)
  ssh_connect

  # 2) Backup remoto do build atual
  ts="$(date +%Y%m%d-%H%M%S)"
  log "Criando backup remoto do build atual (timestamp ${ts})..."
  retry "${SSH_RETRIES}" ${SSH} "cp -a '${REMOTE_DIR}' \"\$HOME/${BACKUP_PREFIX}${ts}\"" \
    && ok "Backup criado em ~/${BACKUP_PREFIX}${ts} (no servidor)." \
    || fail "Nao foi possivel criar o backup remoto."

  # 3) Enviar build (rsync --delete = substitui o build atual)
  # Obs.: os diretorios em ${REMOTE_DIR} sao de root; o usuario sysloc so tem permissao
  # de escrita (dir 777). Por isso NAO preservamos dono/grupo/perms (--no-owner --no-group
  # --no-perms) nem mtime de diretorios (--omit-dir-times) — senao o rsync tenta chgrp/chown
  # em inode de root e falha com "Operation not permitted" (codigo 23). So o conteudo importa.
  log "Enviando build via rsync (--delete substitui o conteudo atual)..."
  retry "${SSH_RETRIES}" rsync -rltvz --delete \
    --no-owner --no-group --no-perms --omit-dir-times \
    -e "${RSYNC_RSH}" \
    "${LOCAL_BUILD}/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/" \
    && ok "Arquivos sincronizados." \
    || fail "rsync falhou."

  # 4) Validacao
  validate

  # 5) Limpeza automatica de backups antigos (mantem os ${KEEP_BACKUPS} mais recentes)
  do_prune auto

  echo
  ok "Deploy concluido com sucesso. Backup: ~/${BACKUP_PREFIX}${ts} (servidor)."
  log "Para reverter este deploy: ./deploy-sysloc.sh --rollback ${ts} (use --list para ver os nomes)."
}

# ------------------------- Ajuda --------------------------------
show_help() {
  awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 && !/^#/ { exit }' "$0"
}

# ------------------------- Dispatch -----------------------------
case "${1:-}" in
  --rollback) do_rollback "${2:-}" ;;
  --list)     list_backups ;;
  --prune)    do_prune ;;
  --no-build) do_deploy --no-build ;;
  --help|-h)  show_help ;;
  "")         do_deploy ;;
  *)          fail "Opcao desconhecida: '$1'. Use --help." ;;
esac
