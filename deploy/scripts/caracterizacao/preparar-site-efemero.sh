#!/usr/bin/env bash
#
# Ciclo de vida do site efêmero de caracterização das regras legadas (TC-001).
#
# ADR-0006 — a captura NUNCA executa contra o site `frontend`, que atende a
# operação. Este script cria um site descartável restaurado do dump de produção
# e o destrói ao final. A única interação com o site `frontend` é
# `bench --site frontend backup`, que produz arquivo e não altera dado.
#
# ADR-0005 — rotina operacional versionada e idempotente: `criar` derruba o site
# anterior antes de recriar; `destruir` sobre site inexistente é no-op com exit 0.
#
# A credencial de root do MariaDB é lida de docker-compose.yaml em tempo de
# execução e trafega apenas por stdin — nunca por argv do host, nunca ecoada,
# nunca gravada em arquivo. Por isso o rastreio verboso do shell jamais é ligado
# aqui: ele ecoaria o argumento da credencial no log da rotina.
#
# Uso:
#   preparar-site-efemero.sh criar
#   preparar-site-efemero.sh destruir

set -Eeuo pipefail

readonly DIR_FRAPPE="/opt/frappe"
readonly ARQ_COMPOSE="${DIR_FRAPPE}/docker-compose.yaml"
readonly ARQ_COMPOSE_OVERRIDE="${DIR_FRAPPE}/docker-compose.override.yml"
readonly SERVICO="backend"
readonly SITE_EFEMERO="caracterizacao.localhost"
readonly DIR_BENCH="/home/frappe/frappe-bench"
readonly PADRAO_DUMP="sites/frontend/private/backups/*-database.sql.gz"

log() { printf '[preparar] %s\n' "$*"; }
erro() { printf '[preparar] ERRO: %s\n' "$*" >&2; }

compose() {
	docker compose --project-directory "${DIR_FRAPPE}" \
		-f "${ARQ_COMPOSE}" -f "${ARQ_COMPOSE_OVERRIDE}" "$@"
}

# Executa um comando no container `backend`, com cwd no bench. Sem credencial.
no_container() {
	compose exec -T "${SERVICO}" bash -c "cd '${DIR_BENCH}' && $1"
}

# Executa um comando no container recebendo a credencial de root do MariaDB pela
# PRIMEIRA linha do stdin, exposta ao comando como a variável `cred`. Mantém o
# valor fora do argv do host (visível em `ps`) e fora de qualquer log.
no_container_com_credencial() {
	local comando="$1"
	printf '%s\n' "${credencial_db}" |
		compose exec -T "${SERVICO}" bash -c "IFS= read -r cred; cd '${DIR_BENCH}' && ${comando}"
}

# Lê MYSQL_ROOT_PASSWORD do serviço `db` em docker-compose.yaml, em runtime.
# O valor vai para stdout do subshell e é capturado numa variável local — nunca
# impresso. Mensagens de erro citam o arquivo e a chave, jamais o valor.
ler_credencial_db() {
	local valor
	valor="$(awk '
		/^[[:space:]][[:space:]][a-zA-Z0-9_-]+:[[:space:]]*$/ { dentro_db = ($0 ~ /^[[:space:]][[:space:]]db:[[:space:]]*$/) }
		dentro_db && /MYSQL_ROOT_PASSWORD:/ {
			sub(/^[^:]*:[[:space:]]*/, "")
			gsub(/^"|"$/, "")
			gsub(/^'"'"'|'"'"'$/, "")
			print
			exit
		}
	' "${ARQ_COMPOSE}")"

	if [[ -z "${valor}" ]]; then
		erro "MYSQL_ROOT_PASSWORD não encontrado no serviço 'db' de ${ARQ_COMPOSE}"
		return 1
	fi
	printf '%s' "${valor}"
}

exigir_ambiente() {
	if ! command -v docker >/dev/null 2>&1; then
		erro "docker não encontrado no PATH"
		exit 1
	fi
	if [[ ! -f "${ARQ_COMPOSE}" ]]; then
		erro "arquivo não encontrado: ${ARQ_COMPOSE}"
		exit 1
	fi
	if ! compose ps --status running --format '{{.Service}}' | grep -qx "${SERVICO}"; then
		erro "serviço '${SERVICO}' não está de pé — suba o stack do Frappe antes"
		exit 1
	fi
}

site_existe() {
	no_container "test -d 'sites/${SITE_EFEMERO}'" >/dev/null 2>&1
}

# Remove a cópia arquivada que o `drop-site` deixa para trás. Sem isso o site
# efêmero continua ocupando disco depois de "destruído" (o host está em 78%).
limpar_arquivados() {
	no_container "rm -rf 'archived_sites/${SITE_EFEMERO}'* 'archived/sites/${SITE_EFEMERO}'* 2>/dev/null || true" || true
}

destruir() {
	exigir_ambiente

	if ! site_existe; then
		log "site inexistente, nada a fazer (${SITE_EFEMERO})"
		limpar_arquivados
		return 0
	fi

	credencial_db="$(ler_credencial_db)"
	log "derrubando ${SITE_EFEMERO}"
	no_container_com_credencial \
		"bench drop-site '${SITE_EFEMERO}' --db-root-password \"\$cred\" --no-backup --force"
	limpar_arquivados

	if site_existe; then
		erro "site ${SITE_EFEMERO} ainda presente após drop-site"
		return 1
	fi
	log "site ${SITE_EFEMERO} removido"
}

criar() {
	exigir_ambiente
	credencial_db="$(ler_credencial_db)"

	# Único contato com o site de produção em todo o fluxo: gera um dump novo.
	log "gerando dump de origem"
	compose exec -T "${SERVICO}" bench --site frontend backup >/dev/null

	local dump
	dump="$(no_container "ls -1t ${PADRAO_DUMP} 2>/dev/null | head -1" | tr -d '\r\n')"
	if [[ -z "${dump}" ]]; then
		erro "nenhum dump encontrado em ${PADRAO_DUMP}"
		exit 1
	fi
	log "dump de origem: ${dump}"

	# Idempotência (ADR-0005): a execução anterior é desfeita antes de recriar.
	destruir

	# A partir daqui existe site pela metade se algo falhar, e o disco do host está
	# em 78%: qualquer erro entre `new-site` e o site pronto desfaz a criação.
	trap desfazer_criacao_parcial ERR

	# Senha de Administrator descartável: o site vive minutos, não é servido pelo
	# nginx (o default_site é outro) e morre no teardown. Gerada em runtime para
	# não existir literal de senha no repositório.
	local admin_efemero
	admin_efemero="$(head -c 24 /dev/urandom | base64 | tr -d '\n=/+' | head -c 24)"

	log "criando ${SITE_EFEMERO}"
	printf '%s\n%s\n' "${credencial_db}" "${admin_efemero}" |
		compose exec -T "${SERVICO}" bash -c "
			IFS= read -r cred
			IFS= read -r adm
			cd '${DIR_BENCH}' &&
			bench new-site '${SITE_EFEMERO}' \
				--db-root-password \"\$cred\" \
				--admin-password \"\$adm\" \
				--no-mariadb-socket \
				--force
		" >/dev/null

	log "restaurando dump no site efêmero"
	no_container_com_credencial \
		"bench --site '${SITE_EFEMERO}' restore '${dump}' --db-root-password \"\$cred\" --force" >/dev/null

	# O `apps.txt` do site é o que registra os módulos do app customizado; ele NÃO
	# vem no dump (é arquivo, não tabela) e sem ele o Frappe não resolve as
	# DocTypes de `Locacao Automation`. Cópia de leitura, o site de produção não
	# é alterado.
	log "replicando a lista de apps do site de origem"
	no_container "cp sites/frontend/apps.txt 'sites/${SITE_EFEMERO}/apps.txt'"

	# Os Server Scripts vivem no banco e só executam com a flag ligada. Ligar aqui
	# torna o site efêmero autossuficiente, sem depender do common_site_config.
	log "ligando server_script_enabled e pausando o scheduler"
	no_container "bench --site '${SITE_EFEMERO}' set-config server_script_enabled 1" >/dev/null
	# Scheduler pausado: job agendado escrevendo no site durante a captura
	# quebraria o determinismo dos golden.
	no_container "bench --site '${SITE_EFEMERO}' set-config pause_scheduler 1" >/dev/null

	# O mapa módulo→app fica em cache desde o `new-site`, quando o app customizado
	# ainda não constava do apps.txt do site. Sem limpar, o Frappe não resolve as
	# DocTypes de `Locacao Automation` e a captura morre no primeiro `get_doc`.
	log "limpando o cache do site efêmero"
	no_container "bench --site '${SITE_EFEMERO}' clear-cache" >/dev/null

	registrar_procedencia "${dump}"

	trap - ERR
	log "site ${SITE_EFEMERO} pronto"
}

# Desfaz uma criação interrompida no meio. Limpa o próprio gatilho antes de agir
# para não recursar caso o teardown também falhe.
desfazer_criacao_parcial() {
	trap - ERR
	erro "falha ao preparar o site efêmero — desfazendo o que já havia sido criado"
	destruir || erro "o teardown automático também falhou; rode 'destruir' manualmente"
}

# Grava, dentro do site efêmero, a procedência do dump e as versões em uso.
# `capturar.py` lê este arquivo para montar o PROCEDENCIA.md — assim o manifesto
# descreve o site que realmente produziu os golden.
registrar_procedencia() {
	local dump="$1"
	local commit_app
	commit_app="$(git -C "${DIR_FRAPPE}" rev-parse HEAD 2>/dev/null || printf 'desconhecido')"

	no_container "python3 - '${dump}' '${commit_app}' <<'PY'
import json, os, subprocess, sys

dump, commit_app = sys.argv[1], sys.argv[2]
versoes = {}
try:
    saida = subprocess.run(
        ['bench', 'version'], capture_output=True, text=True, timeout=120, check=False
    ).stdout
    for linha in saida.splitlines():
        partes = linha.split()
        if len(partes) == 2:
            versoes[partes[0]] = partes[1]
except Exception as exc:  # pragma: no cover - diagnóstico
    versoes['erro'] = str(exc)

with open(os.path.join('sites', '${SITE_EFEMERO}', 'caracterizacao-origem.json'), 'w') as fh:
    json.dump(
        {
            'dump_origem': dump,
            'dump_timestamp': os.path.getmtime(dump),
            'commit_repositorio_frappe': commit_app,
            'versoes_bench': versoes,
        },
        fh,
        ensure_ascii=False,
        sort_keys=True,
        indent=2,
    )
PY" >/dev/null
}

main() {
	local subcomando="${1:-}"
	case "${subcomando}" in
	criar) criar ;;
	destruir) destruir ;;
	*)
		erro "uso: $(basename "$0") {criar|destruir}"
		exit 64
		;;
	esac
}

credencial_db=""
main "$@"
