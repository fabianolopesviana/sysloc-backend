#!/usr/bin/env bash
#
# 07-bisseccao-do-bloqueio.sh — LEITURA APENAS.
#
# O `06` mediu que a troca de usuário é bloqueada dentro do contexto da unidade
# de backup, e que NÃO é o PAM (`setpriv`, que não o usa, falha igual). Este
# script descobre QUAL das diretivas de segurança a bloqueia, removendo uma por
# vez e observando o efeito.
#
# ⚠️ POR QUE BISSECÇÃO, e não relaxar o hardening no escuro: o Protocolo
# Antirregressão proíbe remover guarda que não se introduziu. Para relaxar UMA
# diretiva é preciso saber qual, e provar que é ela — e não desligar cinco
# porque uma delas devia ser a culpada.
#
# Não altera nada: cada teste roda `id -un` numa unidade efêmera e some.
#
# Uso:  sudo bash /opt/sysloc-backend/deploy/scripts/virada/07-bisseccao-do-bloqueio.sh
set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }

# As 14 restrições da unidade, uma por elemento — a ordem é a do `systemctl cat`.
readonly DIRETIVAS=(
	"NoNewPrivileges=yes"
	"PrivateTmp=yes"
	"PrivateDevices=yes"
	"ProtectSystem=full"
	"ProtectHome=read-only"
	"ProtectKernelTunables=yes"
	"ProtectKernelModules=yes"
	"ProtectControlGroups=yes"
	"RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK"
	"RestrictNamespaces=yes"
	"RestrictRealtime=yes"
	"RestrictSUIDSGID=yes"
	"SystemCallArchitectures=native"
)

# Roda `setpriv` sob um conjunto de diretivas; devolve 0 se a troca atravessou.
troca_atravessa() {
	local -a argumentos=(--quiet --wait --pipe --collect -p User=root -p Group=root)
	local d
	for d in "$@"; do
		argumentos+=(-p "${d}")
	done
	systemd-run "${argumentos[@]}" -- \
		setpriv --reuid=postgres --regid=postgres --clear-groups id -un >/dev/null 2>&1
}

printf '\033[1;34m=== Controles ===\033[0m\n'
if troca_atravessa; then
	printf '\033[1;32m[ ok  ]\033[0m SEM restrição alguma: a troca ATRAVESSA (controle positivo)\n'
else
	printf '\033[1;31m[FALHA]\033[0m SEM restrição alguma a troca já falha — o problema NÃO é da unidade.\n'
	printf '        Investigue antes de seguir: pode ser AppArmor, SELinux ou o próprio usuário postgres.\n'
	exit 1
fi

if troca_atravessa "${DIRETIVAS[@]}"; then
	printf '\033[1;31m[FALHA]\033[0m COM as 14 a troca atravessou — o contexto não reproduz o defeito.\n'
	exit 1
else
	printf '\033[1;32m[ ok  ]\033[0m COM as 14: BLOQUEADA (controle negativo — o defeito reproduz)\n'
fi

printf '\n\033[1;34m=== Bissecção: as 14 MENOS uma, a cada vez ===\033[0m\n'
printf '    (a que, ao SAIR, faz a troca voltar a atravessar é a culpada)\n\n'
CULPADAS=()
for i in "${!DIRETIVAS[@]}"; do
	subconjunto=()
	for j in "${!DIRETIVAS[@]}"; do
		[ "${i}" != "${j}" ] && subconjunto+=("${DIRETIVAS[$j]}")
	done
	if troca_atravessa "${subconjunto[@]}"; then
		printf '\033[1;33m[CULPADA]\033[0m sem %-58s -> a troca ATRAVESSA\n' "${DIRETIVAS[$i]}"
		CULPADAS+=("${DIRETIVAS[$i]}")
	else
		printf '           sem %-58s -> segue bloqueada\n' "${DIRETIVAS[$i]}"
	fi
done

echo
if [ "${#CULPADAS[@]}" -eq 0 ]; then
	printf '\033[1;33m[aviso]\033[0m NENHUMA diretiva isolada explica o bloqueio.\n'
	printf '        São DUAS ou mais agindo juntas — o conserto não é relaxar uma.\n'
	printf '        Caminho então: o pg_dump vira unidade PRÓPRIA com User=postgres.\n'
	exit 2
fi

printf '\033[1;32m[ ok  ]\033[0m Culpada(s) isolada(s): %s\n' "${CULPADAS[*]}"
printf '        Só ESSA precisa ser reavaliada. As outras %s ficam intactas.\n' "$((${#DIRETIVAS[@]} - ${#CULPADAS[@]}))"
