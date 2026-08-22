#!/usr/bin/env bash
#
# CT-1011 a CT-1013 (infra) — a preparação do material do certificado, pelo lado
# do SISTEMA OPERACIONAL.
#
# ---------------------------------------------------------------------------
# Por que este script existe
# ---------------------------------------------------------------------------
#
# O `preparar-material-do-certificado.sh` é a ferramenta que reembala o `.pfx`
# que a Autoridade Certificadora entrega em cifra legada. Ele não é chamado por
# código de aplicação nenhum — nada em `apps/` ou `packages/` o importa —, de
# modo que a suíte Vitest não o alcança por caminho algum. O que ele faz só é
# observável executando `openssl` e `node` contra arquivos reais: é o critério
# de placement da `.claude/rules/testing-stack.md`, *"se o invariante só é
# observável inspecionando o sistema operacional, o git ou o filesystem, é
# shell"*.
#
# Ele nasceu como REDE de duas correções dirigidas de 2026-08-21, e os dois
# defeitos que ele pega estavam vivos no script até aquela data:
#
#   * o caminho de GERAÇÃO nunca funcionou neste host — `openssl pkcs12
#     -export` exige entrada seekable, e o script alimentava por pipe;
#   * o caminho de REUSO aprovava o preparado da emissão ANTERIOR, porque
#     perguntava "o runtime abre?" em vez de "é o mesmo certificado?".
#
# Nenhum dos dois aparecia sem execução real: o primeiro só falha quando há de
# fato o que reembalar, e o segundo só engana quando existe um preparado velho.
#
# ---------------------------------------------------------------------------
# Os três casos carregam PROVA DE FALSIFICAÇÃO
# ---------------------------------------------------------------------------
#
# Cada caso roda a MESMA invocação sobre um controle e sobre um mutante, e exige
# desfechos OPOSTOS. Um verificador que sempre aprovasse passaria no controle e
# reprovaria no mutante; um que sempre reprovasse faria o contrário. Nenhum dos
# dois passa nos dois lados.
#
# ---------------------------------------------------------------------------
# Contrato de saída
# ---------------------------------------------------------------------------
#
#   0  zero falhas — e nenhum outro caminho produz verde.
#   1  reprovou o que este verificador existe para provar.
#
# Ferramenta ausente NUNCA faz o caso passar em silêncio: sai como `aviso`
# nomeando o que não foi medido, e o resumo final o repete.
#
# Uso: bash deploy/scripts/cobranca-bancaria/verificar-preparacao-do-material.sh
#
# Ele NÃO exige privilégio: tudo acontece numa caixa de areia `mktemp -d`, com
# certificados gerados na hora. Não toca `/home`, não toca o banco, não toca a
# árvore versionada.
#
# ⚠️ NOTA DE DÍVIDA: este é o 11º `verificar-*.sh` do repositório, e o gatilho
# do `D9 · F0/T2` (fatia `fundacao-stack-nativa`) fala da próxima fatia que
# escrever um — são cópias divergentes do mesmo esqueleto. Ele copia o esqueleto
# do irmão de diretório (`verificar-guarda-de-boletos.sh`) em vez de inventar
# uma 12ª forma, mas NÃO fecha o D9: a unificação segue pendente, e o marcador
# daquele débito permanece onde está.

set -euo pipefail

SOB_PROVA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/preparar-material-do-certificado.sh"

DIR_TRABALHO="$(mktemp -d)"

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

# A senha usada em toda a bateria. É de material descartável, gerado na hora e
# apagado no fim — não é segredo de ninguém.
readonly SENHA_DA_CAIXA="senha-da-caixa-de-areia"

falhas_totais=0
falhas_caso=0
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
# Gera um PKCS#12 em CIFRA LEGADA, como a Autoridade Certificadora entrega.
#
# O titular leva o nome pedido, de modo que dois materiais gerados por esta
# função são certificados DIFERENTES — é o que o mutante do CT-1012 exige.
# --------------------------------------------------------------------------- #
gerar_material_legado() {
	local nome="$1" destino="$2"
	local chave="${DIR_TRABALHO}/${nome}.key" cert="${DIR_TRABALHO}/${nome}.crt"

	openssl req -x509 -newkey rsa:2048 -keyout "${chave}" -out "${cert}" -days 365 -nodes \
		-subj "/CN=${nome}" >/dev/null 2>&1
	openssl pkcs12 -export -legacy -inkey "${chave}" -in "${cert}" -out "${destino}" \
		-passout "pass:${SENHA_DA_CAIXA}" >/dev/null 2>&1
}

# Gera um PKCS#12 em cifra MODERNA — o que o runtime já abre sem preparo.
gerar_material_moderno() {
	local nome="$1" destino="$2"
	local chave="${DIR_TRABALHO}/${nome}.key" cert="${DIR_TRABALHO}/${nome}.crt"

	openssl req -x509 -newkey rsa:2048 -keyout "${chave}" -out "${cert}" -days 365 -nodes \
		-subj "/CN=${nome}" >/dev/null 2>&1
	openssl pkcs12 -export -inkey "${chave}" -in "${cert}" -out "${destino}" \
		-passout "pass:${SENHA_DA_CAIXA}" >/dev/null 2>&1
}

# --------------------------------------------------------------------------- #
# A invocação sob prova — UMA função, usada por controle e por mutante.
#
# Devolve o código de saída do script e imprime a saída dele. Duas funções
# parecidas provariam que duas invocações concordam, não que esta discrimina.
# --------------------------------------------------------------------------- #
invocar() {
	local original="$1" preparado="$2"

	printf '%s' "${SENHA_DA_CAIXA}" | bash "${SOB_PROVA}" "${original}" "${preparado}" 2>&1
}

codigo_de() {
	local original="$1" preparado="$2" codigo=0

	printf '%s' "${SENHA_DA_CAIXA}" | bash "${SOB_PROVA}" "${original}" "${preparado}" >/dev/null 2>&1 ||
		codigo=$?
	printf '%s' "${codigo}"
}

# O titular gravado num PKCS#12 já em cifra moderna.
titular_de() {
	printf '%s' "${SENHA_DA_CAIXA}" |
		openssl pkcs12 -in "$1" -nokeys -passin stdin 2>/dev/null |
		openssl x509 -noout -subject 2>/dev/null
}

# --------------------------------------------------------------------------- #
# CT-1011 — o caminho de GERAÇÃO reembala de fato.
#
# Controle: material legado sem preparado — tem de PRODUZIR o arquivo.
# Mutante:  material já moderno — tem de NÃO produzir nada, dizendo que não há
#           o que preparar. É o lado que falsifica: um script que criasse
#           arquivo sempre passaria no controle e reprovaria aqui.
# --------------------------------------------------------------------------- #
ct_1011() {
	caso "CT-1011 (infra)" "o material em cifra legada é REEMBALADO, e o arquivo nasce"

	local original="${DIR_TRABALHO}/legado.pfx"
	local preparado="${DIR_TRABALHO}/legado-moderno.pfx"
	gerar_material_legado "certificado-de-prova" "${original}"

	if [[ ! -s "${original}" ]]; then
		aviso "o openssl deste host não gerou material legado — CT-1011 NÃO foi medido"
		fechar_caso "CT-1011 (infra)"
		return
	fi

	afirmar_igual "o script aprova a preparação" "0" "$(codigo_de "${original}" "${preparado}")"

	if [[ -s "${preparado}" ]]; then
		ok "o arquivo preparado existe e não está vazio"
	else
		falhar "o arquivo preparado NÃO foi criado — o caminho de geração não produziu nada"
	fi

	afirmar_igual "o preparado é o MESMO certificado" \
		"$(titular_de "${preparado}")" "subject=CN = certificado-de-prova"

	# Mutante: material que o runtime já abre não deve produzir preparado algum.
	local moderno="${DIR_TRABALHO}/moderno.pfx"
	local preparado_do_moderno="${DIR_TRABALHO}/moderno-moderno.pfx"
	gerar_material_moderno "certificado-moderno" "${moderno}"

	afirmar_igual "o material já moderno também aprova" "0" \
		"$(codigo_de "${moderno}" "${preparado_do_moderno}")"

	if [[ -e "${preparado_do_moderno}" ]]; then
		falhar "o script preparou material que o runtime JÁ abria — ele não discrimina"
	else
		ok "material já moderno não produz preparado (a asserção pode falhar)"
	fi

	fechar_caso "CT-1011 (infra)"
}

# --------------------------------------------------------------------------- #
# CT-1012 — o preparado que já existe só é aceito se for O MESMO CERTIFICADO.
#
# Controle: preparado correspondente ao original — tem de APROVAR.
# Mutante:  o original é substituído por outro certificado, com o MESMO NOME de
#           arquivo (a renovação real) — tem de REPROVAR.
#
# É o defeito do falso conforto, e sem o mutante ele é invisível: os dois lados
# abrem, e "abre" era exatamente a pergunta que o script fazia.
# --------------------------------------------------------------------------- #
ct_1012() {
	caso "CT-1012 (infra)" "preparado da emissão ANTERIOR é recusado, não aprovado"

	local original="${DIR_TRABALHO}/renovavel.pfx"
	local preparado="${DIR_TRABALHO}/renovavel-moderno.pfx"

	gerar_material_legado "certificado-emissao-1" "${original}"
	if [[ "$(codigo_de "${original}" "${preparado}")" != "0" ]]; then
		aviso "não foi possível preparar o material da 1a emissão — CT-1012 NÃO foi medido"
		fechar_caso "CT-1012 (infra)"
		return
	fi

	# Controle: rodar de novo sobre o MESMO original é idempotente.
	afirmar_igual "rodar de novo sobre o mesmo material aprova" "0" \
		"$(codigo_de "${original}" "${preparado}")"

	# Mutante: a AC entrega a 2a emissão com o mesmo nome de arquivo.
	gerar_material_legado "certificado-emissao-2" "${original}"

	afirmar_igual "o material substituído REPROVA" "1" "$(codigo_de "${original}" "${preparado}")"

	local saida
	saida="$(invocar "${original}" "${preparado}" || true)"
	if printf '%s' "${saida}" | grep -q "OUTRO CERTIFICADO"; then
		ok "a recusa diz que é outro certificado"
	else
		falhar "a recusa não nomeia a causa — o operador não saberia o que houve"
	fi

	if printf '%s' "${saida}" | grep -q "certificado-emissao-1"; then
		ok "a recusa mostra o titular do preparado obsoleto"
	else
		falhar "a recusa não mostra qual certificado está no preparado"
	fi

	fechar_caso "CT-1012 (infra)"
}

# --------------------------------------------------------------------------- #
# CT-1013 — nenhuma chave privada em claro sobrevive à execução.
#
# O intermediário vive em tmpfs e sai por `trap`. Mede-se o diretório antes e
# depois, e também no caminho de ERRO — que é onde a limpeza costuma faltar.
# --------------------------------------------------------------------------- #
ct_1013() {
	caso "CT-1013 (infra)" "o PEM intermediário não sobrevive a execução nenhuma"

	local dir_em_memoria="${SYSLOC_DIR_EM_MEMORIA:-/dev/shm}"
	if [[ ! -d "${dir_em_memoria}" || ! -w "${dir_em_memoria}" ]]; then
		aviso "${dir_em_memoria} não é gravável aqui — CT-1013 NÃO foi medido"
		fechar_caso "CT-1013 (infra)"
		return
	fi

	local original="${DIR_TRABALHO}/limpeza.pfx"
	local preparado="${DIR_TRABALHO}/limpeza-moderno.pfx"
	gerar_material_legado "certificado-limpeza" "${original}"

	codigo_de "${original}" "${preparado}" >/dev/null
	afirmar_igual "nada resta no tmpfs após o sucesso" "0" \
		"$(find "${dir_em_memoria}" -maxdepth 1 -name 'material-do-certificado-*' 2>/dev/null | grep -c . || true)"

	# Caminho de erro: senha que não abre o material. A limpeza tem de valer
	# igual — é justamente onde `rm` no fim do corpo não chega.
	printf '%s' "senha-que-nao-abre" | bash "${SOB_PROVA}" "${original}" \
		"${DIR_TRABALHO}/erro-moderno.pfx" >/dev/null 2>&1 || true

	afirmar_igual "nada resta no tmpfs após o erro" "0" \
		"$(find "${dir_em_memoria}" -maxdepth 1 -name 'material-do-certificado-*' 2>/dev/null | grep -c . || true)"

	fechar_caso "CT-1013 (infra)"
}

main() {
	printf 'Preparação do material do certificado — %s\n' "${SOB_PROVA}"
	nota "caixa de areia: ${DIR_TRABALHO} (removida na saída); nenhum material real é lido"

	if ! command -v openssl >/dev/null; then
		printf '\nopenssl ausente — nada pôde ser medido\n' >&2
		exit 1
	fi
	if ! command -v node >/dev/null; then
		printf '\nnode ausente — ele é quem decide se o material serve; nada pôde ser medido\n' >&2
		exit 1
	fi

	ct_1011
	ct_1012
	ct_1013

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-preparacao-do-material: 3/3 casos aprovados (CT-1011, CT-1012, CT-1013)\n'
		else
			printf 'verificar-preparacao-do-material: 3/3 casos sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${avisos_totais}"
		fi
		exit 0
	fi

	printf 'verificar-preparacao-do-material: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
