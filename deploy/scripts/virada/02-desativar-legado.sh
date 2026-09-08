#!/usr/bin/env bash
#
# 02-desativar-legado.sh — Virada F7, etapa 2: o Frappe/ERPNext é DESATIVADO
# por completo.
#
# ⚠️ DESATIVAR NÃO É DESINSTALAR, e a diferença é deliberada. Este script:
#
#   · PARA os contêineres do legado e os impede de voltar no reboot;
#   · DESARMA as entradas de cron do root que disparam o legado;
#   · PRESERVA um dump completo da base antiga antes de calá-la.
#
# E NÃO faz nada disto: não remove contêiner, não remove volume, não remove
# imagem, não apaga /opt/frappe, não apaga /usr/local/bin/*frappe*. Tudo
# continua no disco e a reativação é `docker compose start`. A remoção
# definitiva é a §5 de `deploy/scripts/virada.md`, e depende do gate de 5 itens.
#
# ⚠️ O `syslocadmin-painel` e o `sysloc-react-1` SOBREVIVEM — são o Painel Master
# e o aplicativo do cliente, do produto NOVO. Por isso este script nomeia os
# contêineres do legado um a um e NUNCA usa a forma varrida
# `docker stop $(docker ps -q)`, que derrubaria os dois junto.
#
# ADR-0005 — idempotente. Cada passo imprime CRIADO ou JA-OK.
#
# Uso:
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/02-desativar-legado.sh
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/02-desativar-legado.sh --sem-dump
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/02-desativar-legado.sh --reativar
set -uo pipefail

DIR_LEGADO="/opt/frappe"
SITE_LEGADO="frontend"
DESTINO_DO_DUMP="/opt/backups/legado-frappe"
CARIMBO="$(date +%Y%m%d-%H%M%S)"
# Os contêineres do produto NOVO. Nomeados aqui para que a varredura do legado
# os exclua explicitamente, em vez de depender de o prefixo `frappe-` bastar.
readonly SOBREVIVENTES="syslocadmin-painel sysloc-react-1"

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."

containers_do_legado() {
	docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E '^frappe-' || true
}

# ---------------------------------------------------------------------------
# Reativação — existe porque desativar tem de ser reversível enquanto nada foi
# removido. Ela NÃO restaura a cron (isso é decisão do operador, e religar as
# rotinas do legado é o que faria os dois sistemas agirem sobre o mesmo cliente).
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--reativar" ]; then
	info "Reativando os contêineres do legado"
	for c in $(containers_do_legado); do
		docker update --restart=unless-stopped "${c}" >/dev/null 2>&1 || true
	done
	(cd "${DIR_LEGADO}" && docker compose start >/dev/null 2>&1) \
		&& ok "Contêineres do legado reativados." \
		|| falha "Não consegui reativar. Confira: cd ${DIR_LEGADO} && docker compose ps"
	aviso "A cron do root NÃO foi restaurada — reveja /var/backups/crontab-root-*.antes-da-virada"
	exit 0
fi

# ===========================================================================
# PASSO 1 — preservar a base antiga ENQUANTO ela ainda sobe
# ===========================================================================
info "Passo 1: preservar a base do legado"
if [ "${1:-}" = "--sem-dump" ]; then
	aviso "PULADO por --sem-dump. A base fica nos volumes, intacta, mas sem cópia fora do Docker."
elif [ ! -d "${DIR_LEGADO}" ]; then
	ok "JA-OK: ${DIR_LEGADO} não existe — nada a preservar."
else
	ESTADO_DB="$(docker inspect -f '{{.State.Status}}' frappe-db-1 2>/dev/null || echo ausente)"
	if [ "${ESTADO_DB}" != "running" ]; then
		aviso "frappe-db-1 está '${ESTADO_DB}'. Sem base de pé não há dump; seguindo sem ele."
	else
		mkdir -p "${DESTINO_DO_DUMP}" && chmod 700 "${DESTINO_DO_DUMP}"
		info "Gerando dump pelo próprio bench (não precisa da credencial do banco)..."
		# `bench backup` é o caminho nativo: ele lê a credencial do site_config e
		# escreve no volume `sites`. Fazer `mysqldump` por fora exigiria a senha
		# do MariaDB, que não está neste script por decisão (ADR-0005).
		if (cd "${DIR_LEGADO}" && docker compose exec -T backend \
			bench --site "${SITE_LEGADO}" backup --with-files >/dev/null 2>&1); then
			ok "Dump gerado dentro do contêiner."
			# Copia para FORA do Docker: o gate de desinstalação exige a cópia
			# preservada fora, porque `compose down --volumes` leva o volume junto.
			ORIGEM_NO_CONTAINER="/home/frappe/frappe-bench/sites/${SITE_LEGADO}/private/backups"
			ALVO="${DESTINO_DO_DUMP}/${CARIMBO}"
			mkdir -p "${ALVO}"
			if docker cp "frappe-backend-1:${ORIGEM_NO_CONTAINER}/." "${ALVO}/" 2>/dev/null; then
				chmod -R go-rwx "${ALVO}"
				QUANTOS="$(find "${ALVO}" -type f | wc -l)"
				TAMANHO="$(du -sh "${ALVO}" | cut -f1)"
				if [ "${QUANTOS}" -eq 0 ]; then
					falha "A cópia terminou VAZIA (${ALVO}). Não desative o legado sem investigar."
				fi
				ok "CRIADO: ${QUANTOS} arquivo(s), ${TAMANHO}, em ${ALVO}"
			else
				falha "Não consegui copiar o dump para fora do contêiner. Nada foi desativado."
			fi
		else
			falha "O 'bench backup' falhou. Nada foi desativado — investigue antes de seguir."
		fi
	fi
fi

# ===========================================================================
# PASSO 2 — desarmar a cron do root
# ===========================================================================
info "Passo 2: desarmar as entradas de cron do legado"
CRON_ATUAL="$(crontab -l -u root 2>/dev/null || true)"
if [ -z "${CRON_ATUAL}" ]; then
	ok "JA-OK: root não tem crontab."
else
	# A varredura tem DUAS pernas, e a segunda nasceu de um defeito medido em 2026-09-08.
	#
	# ⚠️ A primeira perna casa o texto da LINHA, e ela SOZINHA deixou passar
	# `/usr/local/bin/sincronizar-pagamentos-sicoob.sh` — uma entrada que roda 7×/dia e cujo corpo é
	# `docker exec -i frappe-backend-1 … bench --site frontend execute …`. O nome do script não
	# menciona o legado; o que ele FAZ, sim. Uma varredura por nome é uma varredura por convenção de
	# nomenclatura, e ninguém prometeu essa convenção.
	#
	# A segunda perna abre o EXECUTÁVEL de cada linha ativa e procura a invocação lá dentro. As duas
	# se somam por união: nenhuma substitui a outra, porque a primeira alcança o comando escrito
	# direto na crontab e a segunda alcança o que se esconde atrás de um nome.
	ALVOS_POR_LINHA="$(printf '%s\n' "${CRON_ATUAL}" | grep -nE '^[^#].*(frappe|bench|/opt/frappe)' || true)"

	ALVOS_POR_CORPO=""
	while IFS= read -r numero_e_linha; do
		[ -n "${numero_e_linha}" ] || continue
		local_linha="${numero_e_linha#*:}"
		# O executável é o primeiro caminho absoluto da linha — depois dos cinco campos de tempo.
		executavel="$(printf '%s' "${local_linha}" | grep -oE '/[^[:space:]]+' | head -n1 || true)"
		[ -n "${executavel}" ] && [ -r "${executavel}" ] || continue
		if grep -qE 'frappe|bench|/opt/frappe' "${executavel}" 2>/dev/null; then
			ALVOS_POR_CORPO="${ALVOS_POR_CORPO}${numero_e_linha}"$'\n'
		fi
	done <<< "$(printf '%s\n' "${CRON_ATUAL}" | grep -nE '^[^#]' | grep -vE '(frappe|bench|/opt/frappe)' || true)"

	ALVOS="$(printf '%s\n%s' "${ALVOS_POR_LINHA}" "${ALVOS_POR_CORPO}" | grep -vE '^$' || true)"
	if [ -z "${ALVOS}" ]; then
		ok "JA-OK: nenhuma entrada ativa do legado na crontab do root."
	else
		aviso "Entradas do legado encontradas:"
		printf '%s\n' "${ALVOS}" | sed 's/^/       /'
		mkdir -p /var/backups
		printf '%s\n' "${CRON_ATUAL}" > "/var/backups/crontab-root-${CARIMBO}.antes-da-virada"
		chmod 600 "/var/backups/crontab-root-${CARIMBO}.antes-da-virada"
		ok "Crontab preservada em /var/backups/crontab-root-${CARIMBO}.antes-da-virada"
		# COMENTA, não apaga: a linha continua legível para quem for desinstalar,
		# e restaurá-la é remover um `#`. Apagar perderia o registro do que o
		# legado disparava e em que horário — que é o dado do achado A9.
		# A reescrita é POR NÚMERO DE LINHA, e não por casamento de texto: as linhas achadas pela
		# segunda perna não contêm agulha nenhuma, e um `sed` por padrão não as alcançaria.
		NUMEROS="$(printf '%s\n' "${ALVOS}" | cut -d: -f1 | sort -n -u | tr '\n' ' ')"
		printf '%s\n' "${CRON_ATUAL}" \
			| awk -v numeros="${NUMEROS}" -v carimbo="${CARIMBO}" '
				BEGIN { split(numeros, lista, " "); for (i in lista) if (lista[i] != "") alvo[lista[i]] = 1 }
				{ if (NR in alvo) { print "# DESATIVADO NA VIRADA F7 " carimbo; print "#" $0 } else print }
			' \
			| crontab -u root - \
			&& ok "CRIADO: entradas do legado comentadas na crontab do root." \
			|| falha "Não consegui reescrever a crontab do root."
	fi
fi

# ===========================================================================
# PASSO 3 — parar os contêineres do legado e impedir que voltem no reboot
# ===========================================================================
info "Passo 3: parar o legado"
LISTA="$(containers_do_legado)"
if [ -z "${LISTA}" ]; then
	ok "JA-OK: nenhum contêiner do legado no host."
else
	# `restart=no` ANTES de parar: com `unless-stopped`, o supervisor do Docker
	# os traria de volta no próximo reboot, e a virada se desfaria sozinha numa
	# manutenção qualquer. É a armadilha nomeada na §1 do runbook.
	for c in ${LISTA}; do
		POLITICA="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "${c}" 2>/dev/null)"
		if [ "${POLITICA}" = "no" ]; then
			ok "JA-OK: ${c} já está com restart=no."
		else
			docker update --restart=no "${c}" >/dev/null 2>&1 \
				&& ok "CRIADO: ${c} não voltará no reboot (restart=no)." \
				|| aviso "Não consegui alterar a política de ${c}."
		fi
	done

	for c in ${LISTA}; do
		ESTADO="$(docker inspect -f '{{.State.Status}}' "${c}" 2>/dev/null)"
		if [ "${ESTADO}" = "running" ]; then
			docker stop "${c}" >/dev/null 2>&1 \
				&& ok "CRIADO: ${c} parado." \
				|| aviso "Não consegui parar ${c}."
		else
			ok "JA-OK: ${c} já está '${ESTADO}'."
		fi
	done
fi

# ===========================================================================
# PASSO 4 — verificação: o legado calado, o produto novo de pé
# ===========================================================================
info "Passo 4: verificação"
FALHAS=0

VIVOS="$(docker ps --format '{{.Names}}' | grep -E '^frappe-' || true)"
if [ -z "${VIVOS}" ]; then
	ok "Nenhum contêiner do legado em execução."
else
	printf '\033[1;31m[FALHA]\033[0m Ainda em execução: %s\n' "$(echo ${VIVOS} | tr '\n' ' ')"
	FALHAS=$((FALHAS + 1))
fi

# A porta 8200 é a do Frappe. Silêncio nela é a prova de que o legado não atende.
if ss -lnt 2>/dev/null | grep -q ':8200 '; then
	printf '\033[1;31m[FALHA]\033[0m A porta 8200 (Frappe) ainda está escutando.\n'
	FALHAS=$((FALHAS + 1))
else
	ok "A porta 8200 (Frappe) não escuta mais."
fi

# ⚠️ O CONTROLE POSITIVO da desativação: os dois contêineres do produto novo
# têm de continuar de pé. Sem esta asserção, um script que derrubasse tudo
# passaria na conferência acima — que só mede a ausência do legado.
for c in ${SOBREVIVENTES}; do
	if [ "$(docker inspect -f '{{.State.Status}}' "${c}" 2>/dev/null)" = "running" ]; then
		ok "SOBREVIVEU: ${c} continua em execução."
	else
		printf '\033[1;31m[FALHA]\033[0m %s NÃO está em execução — o produto novo foi afetado.\n' "${c}"
		FALHAS=$((FALHAS + 1))
	fi
done

for s in sysloc-api sysloc-worker; do
	if [ "$(systemctl is-active "${s}")" = "active" ]; then
		ok "SOBREVIVEU: ${s} ativo."
	else
		printf '\033[1;31m[FALHA]\033[0m %s não está ativo.\n' "${s}"
		FALHAS=$((FALHAS + 1))
	fi
done

for alvo in "https://sysloc.systera.com.br/v1/sessao" "https://syslocadmin.systera.com.br/v1/sessao"; do
	OBTIDO="$(curl -s -o /dev/null -w '%{http_code}|%{content_type}' --max-time 15 "${alvo}")"
	case "${OBTIDO}" in
		401\|application/json*) ok "TRAVESSIA: ${alvo} -> ${OBTIDO}" ;;
		*) printf '\033[1;31m[FALHA]\033[0m TRAVESSIA: %s -> %s (esperado 401|application/json)\n' "${alvo}" "${OBTIDO}"
		   FALHAS=$((FALHAS + 1)) ;;
	esac
done

echo
if [ "${FALHAS}" -eq 0 ]; then
	ok "LEGADO DESATIVADO — 0 falhas. Nada foi removido; a reativação é --reativar."
else
	falha "A desativação terminou com ${FALHAS} problema(s). Reativação: sudo bash $0 --reativar"
fi
