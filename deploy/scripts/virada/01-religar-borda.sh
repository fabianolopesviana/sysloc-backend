#!/usr/bin/env bash
#
# 01-religar-borda.sh — Virada F7, etapa 1: o aplicativo do cliente passa a
# alcançar o backend NOVO.
#
# Faz DUAS coisas, nesta ordem, e a ordem é a do runbook (`deploy/scripts/virada.md` §3.1 → §3.2):
#
#   1. PARA as rotinas do Frappe (scheduler, queue-short, queue-long). Primeiro
#      porque, enquanto o scheduler viver, ele pode disparar cobrança, e-mail ou
#      boleto a partir da base ANTIGA — e apontar a borda antes de calá-lo abre
#      uma janela em que os DOIS sistemas agem sobre o mesmo cliente.
#   2. RELIGA a borda: posiciona `deploy/nginx/sysloc-app-interno.conf` como
#      /opt/react/sysloc/nginx/default.conf e recria o container `sysloc-react-1`
#      em `--network host`, escutando 127.0.0.1:8300.
#
# ⚠️ POR QUE RECRIAR O CONTAINER, e não apenas trocar a config: MEDIDO em
# 2026-09-08, a API escuta só em `127.0.0.1:3000`. Um container em rede `bridge`
# — que é como `sysloc-react-1` roda hoje — não a alcança por caminho nenhum.
# Trocar só a config deixaria o `location /v1/` apontando para o vazio, e o
# sintoma passaria de `200 text/html` para `502 Bad Gateway`: pior, porque
# parece defeito da API.
#
# ⚠️ O QUE ESTE SCRIPT **NÃO** FAZ: não para o `syslocadmin-painel` (é o Painel
# Master, do produto NOVO, e ele sobrevive à virada), não remove volume, não
# remove imagem, não apaga base. Desativar não é desinstalar.
#
# ADR-0005 — idempotente. Rodar duas vezes termina com sucesso nas duas. Cada
# passo imprime CRIADO (mudou algo) ou JA-OK (já estava correto).
#
# Uso:
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/01-religar-borda.sh
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/01-religar-borda.sh --desfazer
set -uo pipefail

RAIZ="/opt/sysloc-backend"
GABARITO="${RAIZ}/deploy/nginx/sysloc-app-interno.conf"
CONF_VIVA="/opt/react/sysloc/nginx/default.conf"
RAIZ_DO_APP="/opt/react/sysloc/html"
CONTAINER="sysloc-react-1"
IMAGEM="nginx:1.27-alpine"
PORTA_DA_BORDA="8300"
ENDERECO_DA_API="127.0.0.1:3000"
HOSTNAME_PUBLICO="sysloc.systera.com.br"
CARIMBO="$(date +%Y%m%d-%H%M%S)"

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."

# ---------------------------------------------------------------------------
# Desfazimento: volta o container ao estado bridge com a config anterior.
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--desfazer" ]; then
	ANTERIOR="$(ls -1t "${CONF_VIVA}".antes-da-virada-* 2>/dev/null | head -n1)"
	[ -n "${ANTERIOR}" ] || falha "Nenhum backup ${CONF_VIVA}.antes-da-virada-* encontrado."
	info "Restaurando ${ANTERIOR}"
	cp -a "${ANTERIOR}" "${CONF_VIVA}"
	docker rm -f "${CONTAINER}" >/dev/null 2>&1
	docker run -d --name "${CONTAINER}" --restart unless-stopped \
		--add-host host.docker.internal:host-gateway \
		-p "${PORTA_DA_BORDA}:80" \
		-v "${CONF_VIVA}":/etc/nginx/conf.d/default.conf:ro \
		-v "${RAIZ_DO_APP}":/usr/share/nginx/html:ro \
		"${IMAGEM}" >/dev/null || falha "Não consegui recriar o container em bridge."
	ok "Estado anterior restaurado (bridge, porta ${PORTA_DA_BORDA} publicada)."
	aviso "As rotinas do Frappe NÃO são religadas por este desfazimento — se precisar,"
	aviso "rode: cd /opt/frappe && docker compose start scheduler queue-short queue-long"
	exit 0
fi

# ===========================================================================
# GUARDAS — tudo é conferido ANTES de qualquer escrita.
# ===========================================================================
info "Guardas de pré-condição"

[ -f "${GABARITO}" ] || falha "Gabarito ausente: ${GABARITO}"
[ -f "${RAIZ_DO_APP}/index.html" ] || falha "Build do app ausente: ${RAIZ_DO_APP}/index.html"
ok "Gabarito e build presentes."

# A API tem de estar de pé ANTES de a borda passar a depender dela.
RESP_API="$(curl -s -o /dev/null -w '%{http_code}|%{content_type}' --max-time 10 "http://${ENDERECO_DA_API}/v1/sessao")"
case "${RESP_API}" in
	401\|application/json*) ok "A API responde em ${ENDERECO_DA_API}: 401 JSON (sem sessão)." ;;
	*) falha "A API não respondeu como esperado em ${ENDERECO_DA_API} (obtido: ${RESP_API}).
       Esperado 401 + application/json. Confira: systemctl status sysloc-api" ;;
esac

# O alvo do CloudPanel PRECISA ser o laço local nesta porta. Se ele encaminhar
# para o IP público ou para outra porta, mover o container para `host` quebra o
# hostname — e o script aborta antes de causar isso.
ALVO_DO_PAINEL="$(grep -rhoE 'proxy_pass[[:space:]]+https?://[^;]+' /etc/nginx /home/clp 2>/dev/null \
	| grep -E "${PORTA_DA_BORDA}" | head -n1)"
if [ -z "${ALVO_DO_PAINEL}" ]; then
	aviso "Não localizei, na configuração do CloudPanel, um proxy_pass para a porta ${PORTA_DA_BORDA}."
	aviso "Isso pode ser só falta de permissão de leitura. CONFIRA com a etapa 0 antes de seguir."
	printf '\033[1;33m[aviso]\033[0m Prosseguir mesmo assim? [s/N] '
	read -r resposta
	case "${resposta}" in s|S|y|Y) ;; *) falha "Interrompido pelo operador." ;; esac
else
	case "${ALVO_DO_PAINEL}" in
		*127.0.0.1:${PORTA_DA_BORDA}*|*localhost:${PORTA_DA_BORDA}*)
			ok "O CloudPanel encaminha para o laço local: ${ALVO_DO_PAINEL}" ;;
		*)
			falha "O CloudPanel encaminha para '${ALVO_DO_PAINEL}', que NÃO é o laço local.
       Mover o container para --network host o faria escutar em 127.0.0.1:${PORTA_DA_BORDA} e
       esse encaminhamento deixaria de alcançá-lo. Ajuste o alvo no CloudPanel primeiro." ;;
	esac
fi

# ===========================================================================
# PASSO 1 — calar as rotinas do legado (runbook §3.1)
# ===========================================================================
info "Passo 1: parar as rotinas do Frappe"
if [ -d /opt/frappe ]; then
	PARADOS=0
	for servico in scheduler queue-short queue-long; do
		ESTADO="$(docker inspect -f '{{.State.Status}}' "frappe-${servico}-1" 2>/dev/null || echo ausente)"
		case "${ESTADO}" in
			running)
				(cd /opt/frappe && docker compose stop "${servico}" >/dev/null 2>&1) \
					&& { ok "CRIADO: frappe-${servico}-1 parado."; PARADOS=$((PARADOS + 1)); } \
					|| aviso "Não consegui parar frappe-${servico}-1."
				;;
			ausente) aviso "JA-OK: frappe-${servico}-1 não existe." ;;
			*)       ok "JA-OK: frappe-${servico}-1 já está '${ESTADO}'." ;;
		esac
	done
	[ "${PARADOS}" -eq 0 ] && ok "Nenhuma rotina do legado estava ativa."
else
	ok "JA-OK: /opt/frappe não existe."
fi

# ===========================================================================
# PASSO 2 — posicionar a configuração
# ===========================================================================
info "Passo 2: posicionar a configuração da borda"
if cmp -s "${GABARITO}" "${CONF_VIVA}" 2>/dev/null; then
	ok "JA-OK: ${CONF_VIVA} já é idêntica ao gabarito."
else
	if [ -f "${CONF_VIVA}" ]; then
		cp -a "${CONF_VIVA}" "${CONF_VIVA}.antes-da-virada-${CARIMBO}" \
			|| falha "Não consegui preservar a configuração anterior."
		ok "Configuração anterior preservada em ${CONF_VIVA}.antes-da-virada-${CARIMBO}"
	fi

	# A sintaxe é conferida num container EFÊMERO, antes de a cópia viva mudar:
	# um `nginx -t` que reprovasse depois da escrita deixaria a borda com um
	# arquivo que o servidor recusa carregar.
	docker run --rm -v "${GABARITO}":/etc/nginx/conf.d/default.conf:ro "${IMAGEM}" nginx -t >/dev/null 2>&1 \
		|| falha "O gabarito NÃO passa no 'nginx -t'. Nada foi alterado."
	ok "Sintaxe do gabarito conferida em container efêmero."

	cp -a "${GABARITO}" "${CONF_VIVA}" || falha "Não consegui escrever ${CONF_VIVA}."
	ok "CRIADO: ${CONF_VIVA} atualizada."
fi

# ===========================================================================
# PASSO 3 — recriar o container em --network host
# ===========================================================================
info "Passo 3: recriar o container em --network host"
REDE_ATUAL="$(docker inspect -f '{{.HostConfig.NetworkMode}}' "${CONTAINER}" 2>/dev/null || echo ausente)"
if [ "${REDE_ATUAL}" = "host" ]; then
	ok "JA-OK: ${CONTAINER} já roda em --network host. Reiniciando para recarregar a config."
	docker restart "${CONTAINER}" >/dev/null || falha "Não consegui reiniciar ${CONTAINER}."
else
	# `restart=no` antes de remover: sem isso, um supervisor pode trazer de volta
	# a instância antiga durante a janela e disputar a porta com a nova.
	docker update --restart=no "${CONTAINER}" >/dev/null 2>&1 || true
	docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
	docker run -d --name "${CONTAINER}" --network host --restart unless-stopped \
		-v "${CONF_VIVA}":/etc/nginx/conf.d/default.conf:ro \
		-v "${RAIZ_DO_APP}":/usr/share/nginx/html:ro \
		"${IMAGEM}" >/dev/null \
		|| falha "Não consegui subir ${CONTAINER} em --network host."
	ok "CRIADO: ${CONTAINER} recriado em --network host."
fi

# ===========================================================================
# PASSO 4 — verificação. Aguarda por CONDIÇÃO OBSERVADA, nunca por `sleep` fixo.
# ===========================================================================
info "Passo 4: verificação"
LIMITE=50
i=0
while [ "${i}" -lt "${LIMITE}" ]; do
	[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${PORTA_DA_BORDA}/_borda/saude")" = "200" ] && break
	i=$((i + 1)); sleep 0.2
done
[ "${i}" -lt "${LIMITE}" ] || falha "A borda não atendeu em 127.0.0.1:${PORTA_DA_BORDA} após $((LIMITE / 5))s."
ok "A borda atende em 127.0.0.1:${PORTA_DA_BORDA} (sonda /_borda/saude)."

FALHAS=0
conferir() {
	local rotulo="$1" url="$2" esperado="$3"
	local obtido
	obtido="$(curl -s -o /dev/null -w '%{http_code}|%{content_type}' --max-time 15 "${url}")"
	case "${obtido}" in
		${esperado}) ok "${rotulo}: ${obtido}" ;;
		*) printf '\033[1;31m[FALHA]\033[0m %s: obtido %s, esperado %s\n' "${rotulo}" "${obtido}" "${esperado}"; FALHAS=$((FALHAS + 1)) ;;
	esac
}

# Pelo laço local — isola o container do salto do CloudPanel.
conferir "local  /v1/sessao  -> 401 JSON"  "http://127.0.0.1:${PORTA_DA_BORDA}/v1/sessao" '401|application/json*'
conferir "local  /           -> 200 HTML"  "http://127.0.0.1:${PORTA_DA_BORDA}/"          '200|text/html*'
conferir "local  /docs       -> 404"       "http://127.0.0.1:${PORTA_DA_BORDA}/docs"      '404|*'

# Pelo hostname público — a travessia inteira, que é o que o cliente vê.
# ⚠️ Afirma o TIPO do conteúdo, nunca só o código: o modo de falhar medido
# nesta base é `200` com o corpo errado, e um teste de status sozinho o aprova.
conferir "público /v1/sessao -> 401 JSON"  "https://${HOSTNAME_PUBLICO}/v1/sessao"        '401|application/json*'
conferir "público /          -> 200 HTML"  "https://${HOSTNAME_PUBLICO}/"                 '200|text/html*'
conferir "público /contratos -> 200 HTML"  "https://${HOSTNAME_PUBLICO}/contratos"        '200|text/html*'
conferir "público /docs      -> 404"       "https://${HOSTNAME_PUBLICO}/docs"             '404|*'

echo
if [ "${FALHAS}" -eq 0 ]; then
	ok "RELIGAÇÃO CONCLUÍDA — ${FALHAS} falhas."
	printf '   O aplicativo em https://%s fala com o backend novo.\n' "${HOSTNAME_PUBLICO}"
else
	aviso "A religação terminou com ${FALHAS} conferência(s) reprovada(s)."
	aviso "Para voltar ao estado anterior: sudo bash $0 --desfazer"
	exit 1
fi
