#!/usr/bin/env bash
#
# CT-947 (infra) — a guarda de boletos, pelo lado do SISTEMA OPERACIONAL.
#
# Caso coberto: CT-947 (CA-08, RN-08), da fatia `emissao-e-conciliacao`, nas três
# frentes que só existem fora do processo Node.
#
# ---------------------------------------------------------------------------
# Por que este script existe, sendo que o CT-947 já roda em Vitest
# ---------------------------------------------------------------------------
#
# Ele NÃO substitui o caso de Vitest, e os dois provam coisas diferentes. O
# `packages/cobranca-bancaria/test/guarda-de-boletos.spec.ts` mede a GUARDA —
# nenhum byte nasce fora do diretório-base — contra um diretório descartável que o
# próprio caso monta. Nada ali diz que, na máquina que atende a operação, o
# diretório existe, que ele pertence a quem o serviço roda, que ninguém além do
# dono o enxerga, ou que nenhum boleto foi parar na árvore versionada.
#
# São invariantes do SO e do git, e é o critério de placement da
# `.claude/rules/testing-stack.md`: *"se o invariante só é observável
# inspecionando o sistema operacional, o git ou o filesystem, é shell"*.
#
# ---------------------------------------------------------------------------
# A varredura da árvore versionada carrega PROVA DE FALSIFICAÇÃO permanente
# ---------------------------------------------------------------------------
#
# A frente (c) afirma uma AUSÊNCIA — nenhum boleto versionado —, e ausência é
# exatamente o que uma varredura quebrada também devolve. Por isso a MESMA função
# roda duas vezes: sobre a árvore real (controle) e sobre uma caixa de areia com
# um boleto PLANTADO, onde ela precisa achar e devolver status de falha. Um
# verificador que nunca achasse nada passaria no controle e reprovaria no
# mutante; um que achasse tudo faria o contrário. Nenhum dos dois passa nos dois.
#
# A caixa de areia é sempre `mktemp -d`. NUNCA a árvore de trabalho: plantar o
# arquivo aqui deixaria lixo versionável se o script morresse no meio.
#
# ---------------------------------------------------------------------------
# Contrato de saída
# ---------------------------------------------------------------------------
#
#   0  zero falhas — e nenhum outro caminho produz verde.
#   1  reprovou o que este verificador existe para provar.
#
# Ferramenta ou estado ausente NUNCA faz o caso passar em silêncio: cada
# degradação sai como `aviso` nomeando o que não foi verificado, e as asserções
# que dependiam dela não são contabilizadas como aprovadas. O RESUMO FINAL conta
# as degradações e diz que houve asserção não medida — sem isso o operador lia
# "3/3 frentes aprovadas" numa execução em que uma delas não chegou a ser medida.
#
# ⚠️ O diretório é criado por `deploy/scripts/instalacao/provisionar-base.sh`
# (passo P17), e este script NÃO o cria: verificador que conserta o que ele
# deveria medir sai sempre verde. Diretório ausente é REPROVAÇÃO, com a linha que
# diz ao operador qual comando o produz.
#
# Uso: bash deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh
#
# Ele NÃO exige privilégio: tudo que mede é leitura de metadado e de índice do
# git. A leitura do arquivo de ambiente é a única parte que pode faltar (ele é
# 0600, dono root), e a falta sai como aviso nomeado, nunca como aprovação.

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Caixa de areia do mutante da frente (c). Ver o cabeçalho.
DIR_TRABALHO="$(mktemp -d)"

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

# --------------------------------------------------------------------------- #
# O que se espera do diretório — DECLARADO aqui, e conferido contra o script que
# o provisiona.
#
# Os três valores são escritos por extenso e NÃO derivados de
# `provisionar-base.sh`: derivá-los poria o artefato sob prova nos dois lados da
# comparação, e a asserção não poderia falhar. O que se compara com o
# provisionador é a COERÊNCIA entre os dois (frente (a)), que é outra asserção.
# --------------------------------------------------------------------------- #
DIR_BOLETOS_ESPERADO="/var/lib/sysloc-boletos"
DONO_ESPERADO="sysloc"
MODO_ESPERADO="750"

# O provisionador, de onde saem as linhas que a frente (a) confere.
PROVISIONADOR="${RAIZ_REPO}/deploy/scripts/instalacao/provisionar-base.sh"

# O arquivo de ambiente das unidades de serviço — onde a variável é semeada.
ARQ_AMBIENTE="/etc/sysloc/backend.env"

# A chave que nomeia o diretório para a composição raiz.
CHAVE_DO_DIRETORIO="DIRETORIO_DOS_BOLETOS"

# A forma do nome de um boleto guardado: o código da cobrança mais `.pdf`. É o
# que a guarda deriva (`COB-{4 dígitos}-{7 dígitos}.pdf`), e é o que não pode
# existir na árvore versionada.
PADRAO_DO_BOLETO='COB-[0-9]{4}-[0-9]{7}\.pdf'

# O boleto que o mutante da frente (c) planta na caixa de areia — um nome que
# satisfaz o padrão acima, e que portanto a varredura tem de achar.
BOLETO_DO_MUTANTE="COB-2026-0000054.pdf"

falhas_totais=0
falhas_caso=0

# Degradações declaradas. NÃO governam o código de saída — quem o governa é
# `falhas_totais`, e só ele. O contador existe porque o RESUMO é a linha que o
# operador lê: anunciar "3/3 frentes aprovadas" quando uma delas não pôde ser
# medida transforma medição parcial em aprovação lida como completa.
avisos_totais=0

caso() {
	printf '\n[%s] %s\n' "$1" "$2"
	falhas_caso=0
}

ok() { printf '    OK   %s\n' "$*"; }

falhar() {
	falhas_caso=$((falhas_caso + 1))
	falhas_totais=$((falhas_totais + 1))
	printf '    FALHA %s\n' "$*" >&2
}

afirmar_igual() {
	if [[ "$2" == "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — esperado [$2], obtido [$3]"
	fi
}

afirmar_diferente() {
	if [[ "$2" != "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — obtido [$3], que não deveria ser [$2]"
	fi
}

# A entrada ÚNICA de degradação — é por ela contar aqui, e não em cada chamador,
# que o resumo final não depende de ninguém lembrar de somar o aviso novo.
aviso() {
	avisos_totais=$((avisos_totais + 1))
	printf '    AVISO %s\n' "$*"
}

nota() { printf '    nota  %s\n' "$*"; }

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# --------------------------------------------------------------------------- #
# A varredura de boletos versionados — UMA função, usada pelo controle e pelo
# mutante.
#
# Ela lista os arquivos RASTREADOS pelo git cujo nome tem a forma de um boleto,
# um por linha, e **devolve status 1 quando encontra algum**. O status é parte do
# contrato, e não detalhe: um verificador que apenas imprimisse ocorrências
# ficaria verde sobre o mutante.
#
# A raiz é parâmetro para que a MESMA função rode sobre a árvore real e sobre a
# caixa de areia. Duas funções parecidas provariam que duas implementações
# concordam, não que esta discrimina.
# --------------------------------------------------------------------------- #
varrer_boletos_versionados() {
	local raiz="$1"

	local achados
	achados="$(git -C "${raiz}" ls-files 2>/dev/null | grep -E "${PADRAO_DO_BOLETO}" || true)"

	if [[ -z "${achados}" ]]; then
		return 0
	fi

	printf '%s\n' "${achados}"
	return 1
}

# Quantas ocorrências a varredura devolveu. `grep -c` sobre saída vazia contaria
# 1 (a linha em branco), e a contagem errada apareceria justamente no lado em que
# o esperado é zero.
contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# --------------------------------------------------------------------------- #
# CT-947 (infra-a) — o diretório existe, com o dono e o modo declarados
# --------------------------------------------------------------------------- #
ct_947_infra_a() {
	caso "CT-947 (infra-a)" "o diretório dos boletos existe, com dono e modo declarados"

	# Coerência entre o que este verificador espera e o que o provisionamento
	# grava. Sem ela, mudar a constante de um lado deixaria o outro medindo um
	# caminho que ninguém provisiona — e o verificador reprovaria por um motivo que
	# não é o dele.
	if [[ -r "${PROVISIONADOR}" ]]; then
		afirmar_igual "provisionar-base.sh declara o mesmo diretório" \
			"readonly DIR_BOLETOS=\"${DIR_BOLETOS_ESPERADO}\"" \
			"$(grep -E '^readonly DIR_BOLETOS=' "${PROVISIONADOR}" || true)"
		afirmar_igual "provisionar-base.sh declara o mesmo dono" \
			"readonly DONO_DIR_BOLETOS=\"${DONO_ESPERADO}\"" \
			"$(grep -E '^readonly DONO_DIR_BOLETOS=' "${PROVISIONADOR}" || true)"
		afirmar_igual "provisionar-base.sh declara o mesmo modo" \
			"readonly MODO_DIR_BOLETOS=\"0${MODO_ESPERADO}\"" \
			"$(grep -E '^readonly MODO_DIR_BOLETOS=' "${PROVISIONADOR}" || true)"
	else
		aviso "provisionar-base.sh não está legível em ${PROVISIONADOR} — a coerência das constantes NÃO foi verificada"
	fi

	if [[ ! -d "${DIR_BOLETOS_ESPERADO}" ]]; then
		falhar "o diretório ${DIR_BOLETOS_ESPERADO} não existe — execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh' (passo P17); este verificador NÃO o cria, de propósito"
		fechar_caso "CT-947 (infra-a)"
		return
	fi

	ok "o diretório ${DIR_BOLETOS_ESPERADO} existe"

	afirmar_igual "dono e grupo do diretório" \
		"${DONO_ESPERADO} ${DONO_ESPERADO}" \
		"$(stat -c '%U %G' "${DIR_BOLETOS_ESPERADO}")"

	afirmar_igual "modo do diretório" \
		"${MODO_ESPERADO}" \
		"$(stat -c '%a' "${DIR_BOLETOS_ESPERADO}")"

	fechar_caso "CT-947 (infra-a)"
}

# --------------------------------------------------------------------------- #
# CT-947 (infra-b) — a variável está semeada, e aponta para o diretório conferido
# --------------------------------------------------------------------------- #
ct_947_infra_b() {
	caso "CT-947 (infra-b)" "o arquivo de ambiente declara ${CHAVE_DO_DIRETORIO} apontando para o diretório conferido"

	if [[ ! -r "${ARQ_AMBIENTE}" ]]; then
		# Degradação DECLARADA, e não aprovação: o arquivo é 0600 com dono root, e
		# quem roda sem privilégio simplesmente não o lê. O que fica sem verificação
		# é nomeado, e a semeadura em si tem a prova do lado do provisionador.
		aviso "${ARQ_AMBIENTE} não está legível por este usuário — a semeadura de ${CHAVE_DO_DIRETORIO} NÃO foi verificada (rode com sudo para incluí-la)"
		nota "a existência da linha é semeada por 'garantir_chaves_de_conteudo' em provisionar-base.sh"
		fechar_caso "CT-947 (infra-b)"
		return
	fi

	local declaradas
	declaradas="$(grep -c "^${CHAVE_DO_DIRETORIO}=" "${ARQ_AMBIENTE}" || true)"

	# EXATAMENTE uma atribuição: o systemd usa a última e um leitor ingênuo usaria a
	# primeira, de modo que duas linhas fazem o serviço e a ferramenta divergirem.
	afirmar_igual "${CHAVE_DO_DIRETORIO} é atribuída exatamente uma vez" "1" "${declaradas}"

	local valor
	valor="$(sed -n "s|^${CHAVE_DO_DIRETORIO}=||p" "${ARQ_AMBIENTE}" | head -1)"

	afirmar_diferente "${CHAVE_DO_DIRETORIO} não está vazia" "" "${valor}"
	afirmar_igual "${CHAVE_DO_DIRETORIO} aponta para o diretório conferido" \
		"${DIR_BOLETOS_ESPERADO}" "${valor}"

	fechar_caso "CT-947 (infra-b)"
}

# --------------------------------------------------------------------------- #
# CT-947 (infra-c) — nenhum boleto na árvore versionada
# --------------------------------------------------------------------------- #
ct_947_infra_c() {
	caso "CT-947 (infra-c)" "nenhum boleto na árvore versionada, e a varredura que o afirma sabe achar um"

	if ! command -v git >/dev/null 2>&1; then
		aviso "git ausente no host — a árvore versionada NÃO foi verificada"
		fechar_caso "CT-947 (infra-c)"
		return
	fi

	# ÂNCORA ANTIVÁCUO, e ela nasceu de uma medição: `git ls-files` sobre um diretório
	# que não é repositório imprime `fatal:` em stderr, devolve saída VAZIA e faz a
	# varredura abaixo aprovar por não ter olhado — a forma clássica do AP-29. A
	# contagem de arquivos rastreados é o que separa "não há boleto versionado" de
	# "não há árvore versionada nenhuma".
	local rastreados
	rastreados="$(git -C "${RAIZ_REPO}" ls-files 2>/dev/null | grep -c . || true)"
	if [[ "${rastreados}" -eq 0 ]]; then
		falhar "nenhum arquivo rastreado em ${RAIZ_REPO} — a varredura não teria o que examinar, e o verde abaixo seria vácuo"
		fechar_caso "CT-947 (infra-c)"
		return
	fi
	ok "a árvore real tem ${rastreados} arquivo(s) rastreado(s) — a varredura tem o que examinar"

	local codigo=0 achados ocorrencias
	achados="$(varrer_boletos_versionados "${RAIZ_REPO}")" || codigo=$?
	ocorrencias="$(contar_ocorrencias "${achados}")"

	afirmar_igual "nenhum boleto rastreado pelo git na árvore real" "0" "${ocorrencias}"
	afirmar_igual "a varredura não acusa nada na árvore real" "0" "${codigo}"
	if [[ "${ocorrencias}" -ne 0 ]]; then
		printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	fi

	# O diretório dos boletos vive FORA da árvore, por construção e não por regra de
	# ignore — que é a condição de entrada da ADR-0005. Um caminho sob o repositório
	# passaria na varredura acima enquanto ninguém o adicionasse ao índice, e
	# reprovaria no primeiro `git add -A`.
	case "${DIR_BOLETOS_ESPERADO}/" in
	"${RAIZ_REPO}"/*)
		falhar "o diretório dos boletos (${DIR_BOLETOS_ESPERADO}) fica DENTRO da árvore versionada (${RAIZ_REPO})"
		;;
	*)
		ok "o diretório dos boletos fica fora da árvore versionada"
		;;
	esac

	# PROVA DE FALSIFICAÇÃO — a MESMA varredura, sobre uma caixa de areia com um
	# boleto plantado, precisa achar e devolver status de falha.
	local caixa="${DIR_TRABALHO}/mutante-arvore"
	mkdir -p "${caixa}"
	git -C "${caixa}" init -q
	printf 'controle\n' >"${caixa}/leia-me.txt"
	git -C "${caixa}" add leia-me.txt

	codigo=0
	achados="$(varrer_boletos_versionados "${caixa}")" || codigo=$?
	afirmar_igual "a caixa íntegra passa limpa no mesmo harness" "0" "${codigo}"

	printf '%%PDF-1.4\n' >"${caixa}/${BOLETO_DO_MUTANTE}"
	git -C "${caixa}" add "${BOLETO_DO_MUTANTE}"

	codigo=0
	achados="$(varrer_boletos_versionados "${caixa}")" || codigo=$?
	afirmar_igual "o boleto versionado REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação nomeia o arquivo" "${BOLETO_DO_MUTANTE}" "${achados}"

	fechar_caso "CT-947 (infra-c)"
}

main() {
	printf 'Guarda de boletos — %s\n' "${RAIZ_REPO}"
	nota "o diretório é provisionado por deploy/scripts/instalacao/provisionar-base.sh (P17); aqui ele só é medido"

	ct_947_infra_a
	ct_947_infra_b
	ct_947_infra_c

	printf '\n'
	# O `exit 0` continua governado SÓ por `falhas_totais` — o aviso muda o rótulo,
	# nunca o contrato de saída declarado no cabeçalho.
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-guarda-de-boletos: 3/3 frentes aprovadas (CT-947 infra a, b, c)\n'
		else
			printf 'verificar-guarda-de-boletos: 3/3 frentes sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${avisos_totais}"
		fi
		exit 0
	fi

	printf 'verificar-guarda-de-boletos: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
