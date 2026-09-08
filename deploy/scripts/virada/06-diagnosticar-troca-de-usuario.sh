#!/usr/bin/env bash
#
# 06-diagnosticar-troca-de-usuario.sh — LEITURA APENAS.
#
# `copiar-base.sh` precisa executar o `pg_dump` como o superusuário do banco, e
# dentro da unidade systemd a troca de usuário falhou com
# `runuser: cannot set user id: Operation not permitted`.
#
# MEDIDO: o `CapabilityBoundingSet` da unidade INCLUI `cap_setuid` e `cap_setgid`
# — não é falta de capability. Sobram duas hipóteses, e este script as separa
# reproduzindo as MESMAS restrições da unidade real, via `systemd-run`:
#
#   H1  o PAM. `runuser` abre sessão PAM, e o diário mostra `pam_keyinit:
#       Unable to change UID to 116 temporarily` ANTES do erro. Se for isto,
#       `setpriv` — que NÃO usa PAM — atravessa.
#   H2  um filtro de chamada de sistema. Se for isto, as DUAS formas falham, e a
#       correção tem de ser outra (não trocar de usuário).
#
# Não altera nada: só executa `id -un` sob cada forma.
#
# Uso:  sudo bash /opt/sysloc-backend/deploy/scripts/virada/06-diagnosticar-troca-de-usuario.sh
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }

# As restrições COPIADAS da unidade — a lista veio de `systemctl cat`. Reproduzir
# o contexto é o ponto: um teste fora dele mediria outro ambiente.
readonly RESTRICOES=(
	-p User=root -p Group=root
	-p NoNewPrivileges=yes -p PrivateTmp=yes -p PrivateDevices=yes
	-p ProtectSystem=full -p ProtectHome=read-only
	-p ProtectKernelTunables=yes -p ProtectKernelModules=yes
	-p ProtectControlGroups=yes
	-p "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK"
	-p RestrictNamespaces=yes -p RestrictRealtime=yes -p RestrictSUIDSGID=yes
	-p SystemCallArchitectures=native
)

testar() {
	local rotulo="$1"; shift
	printf '\n\033[1;34m--- %s ---\033[0m\n' "${rotulo}"
	# `--wait --pipe` devolve a saída e o código; `--collect` não deixa unidade
	# efêmera para trás em caso de falha.
	if systemd-run --quiet --wait --pipe --collect "${RESTRICOES[@]}" -- "$@" 2>&1; then
		printf '\033[1;32m[ ok  ]\033[0m ATRAVESSOU\n'
	else
		printf '\033[1;31m[falha]\033[0m BLOQUEADO\n'
	fi
}

echo "Contexto reproduzido: as mesmas 14 restrições da unidade de backup."
testar "CONTROLE — sem troca de usuário (tem de atravessar)" id -un
testar "H1/H2 — runuser (usa PAM)" runuser -u postgres -- id -un
testar "H1 — setpriv (NÃO usa PAM)" setpriv --reuid=postgres --regid=postgres --clear-groups id -un

cat <<'FIM'

--------------------------------------------------------------------------
COMO LER:
  · controle atravessa, runuser bloqueia, setpriv ATRAVESSA  -> H1 (é o PAM).
    Conserto: trocar `runuser` por `setpriv` em copiar-base.sh. Nenhuma
    diretiva de segurança da unidade é tocada.
  · controle atravessa e as DUAS bloqueiam                   -> H2.
    Conserto: não trocar de usuário — o pg_dump passa a ser um ExecStart
    próprio com User=postgres, e o script de root só confere e publica.
  · o controle NÃO atravessa -> o teste não reproduziu o contexto; me diga.
--------------------------------------------------------------------------
FIM
