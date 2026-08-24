#!/usr/bin/env bash
#
# Execução agregada das baterias de verificação de shell — intervenção dirigida
# de 2026-08-23.
#
# Descobre por `find` todas as `deploy/scripts/*/verificar-*.sh`, executa cada
# uma com o privilégio que ela exige e produz um quadro comparável.
#
# ---------------------------------------------------------------------------
# POR QUE ELE EXISTE
# ---------------------------------------------------------------------------
#
# Metade das baterias deste repositório exige privilégio administrativo, e o
# `sudo` deste host pede senha interativa: nenhum agente as executa. O efeito é
# medido, e apareceu duas vezes no mesmo dia — o `CT-647` estava quebrado havia
# TRÊS fatias (morria em `unbound variable` antes de qualquer asserção) e o banco
# durável estava CINCO migrações atrás do repositório. Nenhum dos dois constava
# de débito algum. Bateria que ninguém executa não é rede: é a aparência de uma.
#
# ---------------------------------------------------------------------------
# POR QUE O NOME NÃO É `verificar-*`
# ---------------------------------------------------------------------------
#
# Porque ele varre `verificar-*.sh` e se encontraria a si mesmo — cada execução
# lançaria outra, sem fundo. O nome é a proteção, e renomeá-lo para o padrão das
# baterias reintroduz a recursão. Ele também NÃO declara o esqueleto de asserção
# (`caso`/`ok`/`falhar`/`afirmar_igual`) que o `D9 · F0/T2` já contabiliza em dez
# cópias: aqui não se afirma nada, apenas se executa e se resume.
#
# ---------------------------------------------------------------------------
# CADA BATERIA COM O PRIVILÉGIO CERTO — e por que isso não é detalhe
# ---------------------------------------------------------------------------
#
# Rodar tudo como root quebra o que sobe instância efêmera de Postgres
# (`embedded-postgres` recusa root) e o que depende do ferramental fixado pelo
# `mise`, ausente do PATH do superusuário. A troca de identidade usa o mesmo
# idioma de `executar_como_dono` em `verificar-fundacao.sh`, com HOME e PATH
# declarados em vez de herdados.
#
# ---------------------------------------------------------------------------
# CONTRATO DE SAÍDA
# ---------------------------------------------------------------------------
#
#   0  todas as baterias aprovadas
#   1  ao menos uma REPROVOU
#   2  nenhuma reprovou, e ao menos uma não rodou por PRÉ-CONDIÇÃO de ambiente
#
# O `2` é o idioma que `.claude/rules/testing-stack.md` já fixa: o que se prova
# está íntegro, e o único vermelho é a saúde do ambiente deste host. Confundir
# pré-condição com reprovação é o que faz vermelho legítimo virar ruído — e
# ruído recorrente ensina a não ler o vermelho, que é o defeito que o `CT-013`
# levou 98 ocorrências para exibir.
#
# Uso:
#   sudo bash deploy/scripts/verificacao/rodar-baterias.sh                  # todas
#   sudo bash deploy/scripts/verificacao/rodar-baterias.sh isolamento       # filtro por nome
#   sudo bash deploy/scripts/verificacao/rodar-baterias.sh --com-agregador  # inclui verificar-fundacao.sh
#
# ⚠️ Prefira `| tee` a `| tail`: o `tail` segura TODA a saída até o fim, e o
# conjunto leva ~25 minutos — a tela fica muda e parece travada.
#
# ⚠️ `verificar-captura.sh` exige o site efêmero do legado
# (`preparar-site-efemero.sh criar`). Sem ele a bateria sai como PRÉ-CONDIÇÃO,
# nunca como falha.

set -uo pipefail   # sem -e: bateria que reprova NÃO pode abortar o laço

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly SAIDA="/var/tmp/sysloc-baterias-$(date +%Y%m%d-%H%M%S)"
readonly LIMITE_POR_BATERIA=1800   # 30 min: o provisionamento roda duas vezes

if [[ "${EUID}" -ne 0 ]]; then
	printf 'ERRO: rode como root — três baterias exigem privilégio.\n' >&2
	printf '      sudo bash %s\n' "${BASH_SOURCE[0]}" >&2
	exit 1
fi

DONO_DO_REPO="$(stat -c '%U' "${RAIZ_REPO}")"
HOME_DO_DONO="$(getent passwd "${DONO_DO_REPO}" | cut -d: -f6)"
if [[ -z "${DONO_DO_REPO}" || -z "${HOME_DO_DONO}" ]]; then
	printf 'ERRO: não consegui resolver o dono de %s\n' "${RAIZ_REPO}" >&2
	exit 1
fi
readonly DONO_DO_REPO HOME_DO_DONO
mkdir -p "${SAIDA}"

# As que exigem root. Qualquer outra roda como o dono do repositório.
exige_privilegio() {
	grep -qE 'exigir_privilegio|EUID.*-ne 0' "$1"
}

executar_como_dono() {
	runuser -u "${DONO_DO_REPO}" -- env \
		HOME="${HOME_DO_DONO}" \
		PATH="${HOME_DO_DONO}/.local/bin:${HOME_DO_DONO}/.local/share/mise/shims:${PATH}" \
		"$@"
}

# Argumentos: `--com-agregador` inclui o `verificar-fundacao.sh`; qualquer outro
# é tratado como FILTRO por nome, para reexecutar uma bateria só sem pagar o
# conjunto inteiro (o `verificar-workspace` sozinho leva 7 minutos).
com_agregador=""
filtro=""
for argumento in "$@"; do
	case "${argumento}" in
	--com-agregador) com_agregador="sim" ;;
	-*) printf 'ERRO: argumento desconhecido: %s\n' "${argumento}" >&2; exit 1 ;;
	*) filtro="${filtro}${filtro:+|}${argumento}" ;;
	esac
done

mapfile -t BATERIAS < <(find "${RAIZ_REPO}/deploy/scripts" -name 'verificar-*.sh' | sort)
if [[ -z "${com_agregador}" ]]; then
	mapfile -t BATERIAS < <(printf '%s\n' "${BATERIAS[@]}" | grep -v 'verificar-fundacao\.sh$')
fi
if [[ -n "${filtro}" ]]; then
	mapfile -t BATERIAS < <(printf '%s\n' "${BATERIAS[@]}" | grep -E "${filtro}")
	if [[ "${#BATERIAS[@]}" -eq 0 ]]; then
		printf 'ERRO: nenhuma bateria casa o filtro [%s]\n' "${filtro}" >&2
		exit 1
	fi
fi

printf 'Baterias de verificação — %s\n' "$(date '+%F %T')"
printf '  repositório: %s (dono: %s)\n' "${RAIZ_REPO}" "${DONO_DO_REPO}"
printf '  logs:        %s\n' "${SAIDA}"
printf '  baterias:    %s\n\n' "${#BATERIAS[@]}"

declare -a LINHAS=()
falhas_totais=0
precondicoes=0

for bateria in "${BATERIAS[@]}"; do
	nome="$(basename "${bateria}" .sh)"
	log="${SAIDA}/${nome}.log"
	if exige_privilegio "${bateria}"; then
		identidade="root"
	else
		identidade="${DONO_DO_REPO}"
	fi

	printf '  ▶ %-42s [%s] ' "${nome}" "${identidade}"
	inicio=$(date +%s)
	# ⚠️ `< /dev/null` NÃO é zelo — é o que impede DOIS defeitos medidos em
	# 2026-08-23, ambos causados por deixar o stdin herdar o terminal:
	#
	#   (1) SIGTTIN: bateria que tenta ler do terminal a partir daqui é SUSPENSA
	#       pelo kernel (`stat=T`), não morre, e o `timeout` não a alcança até
	#       receber SIGCONT — o `verificar-captura` ficou 7 minutos parado assim.
	#   (2) Detecção de tty: o Vitest liga cores, e o `grep -E '^[[:space:]]*Tests'`
	#       do `verificar-isolamento-de-verificacao` deixa de casar com `^[[2m` na
	#       frente. As suítes passam (438/394/268) e a bateria reprova mesmo assim.
	#
	# `NO_COLOR=1` é a segunda linha de defesa da (2): fecha o caso em que alguma
	# ferramenta decida colorir por outro sinal que não o tty.
	if [[ "${identidade}" == "root" ]]; then
		env NO_COLOR=1 timeout "${LIMITE_POR_BATERIA}" bash "${bateria}" \
			>"${log}" 2>&1 </dev/null
	else
		executar_como_dono env NO_COLOR=1 timeout "${LIMITE_POR_BATERIA}" bash "${bateria}" \
			>"${log}" 2>&1 </dev/null
	fi
	codigo=$?
	fim=$(date +%s)

	# `grep -c` sozinho retorna 1 quando não acha, e sem `|| true` isso mataria a
	# contagem sob pipefail — daí o `|| true` em cada uma.
	ok=$(grep -c '^    OK ' "${log}" 2>/dev/null || true)
	falhou=$(grep -c '^    FALHA' "${log}" 2>/dev/null || true)
	avisos=$(grep -c '^    aviso' "${log}" 2>/dev/null || true)
	ultima=$(tail -1 "${log}" 2>/dev/null | cut -c1-70)

	# Pré-condição de ambiente ausente NÃO é reprovação da bateria, e confundir as
	# duas é o que faz um vermelho legítimo virar ruído. O discriminador é
	# conservador de propósito: exige ZERO asserção executada (a bateria abortou
	# antes de provar o que quer que seja) E uma frase de pré-condição. Bateria que
	# rodou e falhou tem `ok`/`falhou` > 0 e cai no ramo de reprovação.
	precondicao=""
	if [[ "${codigo}" -ne 0 && "${ok:-0}" -eq 0 && "${falhou:-0}" -eq 0 ]] &&
		grep -qiE 'precisa estar de pé|não está de pé|precisa de privilégio|ferramenta obrigatória ausente|não existe' "${log}"; then
		precondicao="sim"
	fi

	case "${codigo}" in
	0) veredito="APROVADA" ;;
	2) veredito="SAUDE-DA-SUITE (código 2)" ;;
	124) veredito="ESTOUROU O TEMPO (${LIMITE_POR_BATERIA}s)" ;;
	*) [[ -n "${precondicao}" ]] && veredito="PRE-CONDICAO ausente" || veredito="REPROVADA (código ${codigo})" ;;
	esac
	if [[ "${codigo}" -ne 0 ]]; then
		if [[ -n "${precondicao}" ]]; then
			precondicoes=$((precondicoes + 1))
		else
			falhas_totais=$((falhas_totais + 1))
		fi
	fi

	printf '%s  (%ss, %s OK, %s FALHA)\n' "${veredito}" "$((fim - inicio))" "${ok:-0}" "${falhou:-0}"
	LINHAS+=("$(printf '%-42s|%-8s|%7s|%5s|%6s|%7s|%s' \
		"${nome}" "${identidade}" "${veredito%% *}" "${ok:-0}" "${falhou:-0}" "${avisos:-0}" "${ultima}")")
done

printf '\n%s\n' "════════════════════════════════════════════════════════════════════════════"
printf 'RESUMO — %s bateria(s): %s com problema, %s com pré-condição de ambiente ausente\n' \
	"${#BATERIAS[@]}" "${falhas_totais}" "${precondicoes}"
printf '%s\n' "════════════════════════════════════════════════════════════════════════════"
printf '%-42s|%-8s|%7s|%5s|%6s|%7s|%s\n' "BATERIA" "COMO" "VEREDITO" "OK" "FALHA" "AVISOS" "ÚLTIMA LINHA"
printf '%s\n' "${LINHAS[@]}"

if [[ "${falhas_totais}" -gt 0 ]]; then
	printf '\n%s\n' "──────────── TRECHOS DE FALHA (para diagnóstico) ────────────"
	for bateria in "${BATERIAS[@]}"; do
		nome="$(basename "${bateria}" .sh)"
		log="${SAIDA}/${nome}.log"
		grep -q '^    FALHA\|REPROVAD' "${log}" 2>/dev/null || continue
		printf '\n### %s\n' "${nome}"
		grep -nE '^    FALHA|REPROVAD|unbound variable|command not found|Permission denied|No such file' "${log}" |
			head -12 | sed 's/^/    /'
	done
fi

if [[ "${precondicoes}" -gt 0 ]]; then
	printf '\n%s\n' "──────────── PRÉ-CONDIÇÕES DE AMBIENTE (não são defeito) ────────────"
	for bateria in "${BATERIAS[@]}"; do
		nome="$(basename "${bateria}" .sh)"
		log="${SAIDA}/${nome}.log"
		[[ -s "${log}" ]] || continue
		grep -qiE 'precisa estar de pé|não está de pé' "${log}" || continue
		printf '    %s: %s\n' "${nome}" "$(head -1 "${log}")"
	done
	printf '    ⚠️ `verificar-captura` mede a captura contra o site EFÊMERO do legado\n'
	printf '       (`caracterizacao.localhost`), que não é o site de produção. Para satisfazê-la:\n'
	printf '           bash deploy/scripts/caracterizacao/preparar-site-efemero.sh criar\n'
	printf '       Decisão sua: é operação no ambiente Frappe, ainda que fora de `frontend`.\n'
fi

printf '\nLogs completos por bateria em: %s\n' "${SAIDA}"
# Código 2 no idioma da `testing-stack.md`: o que as baterias provam está íntegro,
# e o único vermelho é a saúde do ambiente deste host.
if [[ "${falhas_totais}" -gt 0 ]]; then
	exit 1
elif [[ "${precondicoes}" -gt 0 ]]; then
	exit 2
fi
exit 0
