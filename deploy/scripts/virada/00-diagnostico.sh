#!/usr/bin/env bash
#
# 00-diagnostico.sh — Virada F7, etapa 0: LEITURA APENAS.
#
# Não altera, não move e não remove nada. Existe para revelar o que só o root
# enxerga e sobre o que as etapas seguintes decidem: para onde o CloudPanel
# encaminha os dois hostnames, o que a cron do root dispara, e quais chaves o
# arquivo de ambiente já declara.
#
# Segredos são MASCARADOS: as chaves são listadas por NOME, e os valores das
# sensíveis nunca são impressos.
#
# Uso:  sudo bash /opt/sysloc-backend/deploy/scripts/virada/00-diagnostico.sh
set -uo pipefail

secao() { printf '\n\033[1;34m=== %s ===\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }

secao "1. Vhosts do CloudPanel — para onde cada hostname encaminha"
CONF_NGINX="/home/clp/services/nginx/nginx.conf"
echo "--- nginx.conf principal (includes) ---"
grep -nE 'include|listen' "${CONF_NGINX}" 2>/dev/null | head -20
for d in /etc/nginx/sites-enabled /home/clp/services/nginx/conf.d /home/clp/services/nginx/sites-enabled; do
	[ -d "${d}" ] && { echo "--- ${d} ---"; ls -la "${d}"; }
done
echo
echo "--- arquivos que nomeiam os dois hostnames ---"
grep -rls 'sysloc\.systera\.com\.br\|syslocadmin\.systera\.com\.br' /etc/nginx /home/clp 2>/dev/null | head -20

secao "2. O bloco de encaminhamento de cada um (proxy_pass / root)"
for f in $(grep -rls 'sysloc\.systera\.com\.br' /etc/nginx /home/clp 2>/dev/null | head -6); do
	echo "----- ${f} -----"
	grep -nE 'server_name|proxy_pass|root |listen |ssl_certificate |include ' "${f}" 2>/dev/null | head -30
done

secao "3. Cron do root — o que ainda dispara pelo legado"
crontab -l -u root 2>/dev/null || echo "(sem crontab para root)"
echo "--- /etc/cron.d ---"
ls -la /etc/cron.d/ 2>/dev/null
grep -rn 'frappe\|bench\|docker' /etc/cron.d/ /etc/crontab 2>/dev/null | head -20

secao "4. Arquivo de ambiente do backend novo — CHAVES (valores mascarados)"
ARQ="/etc/sysloc/backend.env"
if [ -f "${ARQ}" ]; then
	ls -l "${ARQ}"
	echo "--- chaves declaradas ---"
	grep -oE '^[A-Z_]+=' "${ARQ}" | tr -d '=' | sort
	echo "--- valores das NÃO-sensíveis ---"
	grep -E '^(SMTP_URL|EMAIL_REMETENTE|ORIGENS_PUBLICAS|URL_BASE_DA_CONFIRMACAO|LOG_LEVEL|NODE_ENV|PORT)=' "${ARQ}" \
		| sed -E 's#(://[^:@/]*:)[^@]*@#\1***SENHA***@#g'
else
	echo "(${ARQ} não existe)"
fi

secao "5. Estado do legado e do produto novo"
echo "--- containers ---"
docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "--- serviços novos ---"
systemctl is-active sysloc-api sysloc-worker sysloc-mailpit 2>&1 | paste -sd' '
echo "--- porta 8300 / 8400 / 3000 ---"
ss -lntp | grep -E ':8300|:8400|:3000'

secao "6. Postfix atual (não será mantido como está)"
postconf -n 2>/dev/null | grep -E 'myhostname|mydestination|relayhost|inet_interfaces|virtual' || echo "(postconf indisponível)"
echo "--- pacotes de e-mail instalados ---"
dpkg -l 2>/dev/null | grep -E '^ii\s+(postfix|dovecot|opendkim)' | awk '{print $2, $3}'

secao "7. Disco e memória (a instalação do MTA precisa de espaço)"
df -h / | tail -1
free -h | head -2

printf '\n\033[1;32mDiagnóstico concluído. NADA foi alterado.\033[0m\n'
