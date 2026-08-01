#!/usr/bin/env bash
#
# Verificação da fundação do monorepo (T1 da fatia `fundacao-stack-nativa`).
#
# Casos cobertos: CT-001, CT-002, CT-003, CT-004.
#
# O que este script prova, em uma frase por caso:
#
#   CT-001  o repositório instala e constrói a partir de um clone limpo, sem
#           passo manual e sem prompt, com o conjunto EXATO de membros de
#           workspace que a fatia entrega;
#   CT-002  as portas de qualidade REPROVAM de fato — o `strict` do
#           `tsconfig.base.json` chega ao pacote por herança e o `biome.json`
#           está ligado ao script `lint`;
#   CT-003  o `.env.example` versionado documenta as variáveis sem carregar
#           nenhum valor real;
#   CT-004  um arquivo de ambiente com credencial é barrado pelo Git e recusado
#           por `git add`, e o `.env.example` continua rastreável.
#
# Por que o clone efêmero (CT-001/CT-002) não é luxo: rodar na árvore de trabalho
# passaria mesmo com `pnpm-workspace.yaml` quebrado, porque o `node_modules/` já
# resolvido mascara o defeito. O clone é removido ao fim — inclusive em falha,
# via trap — porque o servidor opera acima de 75% de ocupação.
#
# Este script é escrito para ser invocado por `verificar-fundacao.sh` (T7), que
# agrega a bateria da fatia inteira. Ele não altera nada fora do diretório
# temporário do sistema; os arquivos que o CT-004 cria na raiz do repositório são
# removidos pelo mesmo trap, e o caso confere que `git status` voltou ao estado
# de partida.
#
# Uso: bash deploy/scripts/instalacao/verificar-workspace.sh

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Limites de tempo, em segundos. Todo comando roda sob `timeout` com a entrada
# padrão fechada: prompt interativo vira falha por estouro de limite em vez de
# travar a bateria indefinidamente. O teto do ciclo do CT-001 é 600 s.
LIMITE_MISE_INSTALL=300
LIMITE_PNPM_INSTALL=300
LIMITE_PNPM_LIST=120
LIMITE_PNPM_BUILD=180
LIMITE_PNPM_LINT=120
LIMITE_PNPM_TEST=120
LIMITE_CICLO_CT001=600

# --------------------------------------------------------------------------- #
# Membros do workspace, com o caminho de cada um relativo à raiz.
#
# CAUSA-RAIZ de esta lista existir (T7): as asserções deste caso congelavam o
# estado de T1 — "`apps/` e `packages/` sem nenhum `package.json`" e "o workspace
# lista exatamente 1 pacote". O invariante que elas guardavam era a tolerância do
# ciclo a membro de workspace VAZIO, e esse invariante perdeu o objeto quando T4,
# T5 e T6 criaram os três pacotes: o clone efêmero é do HEAD, e o HEAD da F0
# fechada tem `packages/shared`, `apps/api` e `apps/worker`.
#
# POR QUE ISTO FECHA A CLASSE: a lista é ESPELHO, não piso. A contagem exigida é
# a de membros declarados aqui, e cada um é conferido pelo nome E pelo caminho —
# de modo que perder um pacote reprova, ganhar um pacote não declarado reprova, e
# um pacote registrado no lugar errado reprova. Uma asserção que só contasse
# `>= 1` envelheceria em silêncio na próxima fatia, que é exatamente o defeito
# que esta correção fecha.
#
# O QUE ESTA MUDANÇA REMOVE: a prova de que o ciclo instala e constrói com
# `apps/` e `packages/` vazios. É remoção de asserção SEM ALVO — os dois
# diretórios não voltam a ficar vazios —, substituída por uma prova estritamente
# mais forte sobre o conjunto real de membros.
# --------------------------------------------------------------------------- #
MEMBROS_DO_WORKSPACE=(
	"@sysloc/monorepo:"
	"@sysloc/shared:/packages/shared"
	"@sysloc/api:/apps/api"
	"@sysloc/worker:/apps/worker"
)

# Quantos pacotes cada diretório de membro hospeda. Contagem EXATA, pelo mesmo
# motivo da lista acima.
declare -A PACOTES_POR_DIRETORIO=(
	[apps]=2
	[packages]=1
)

# Variáveis obrigatórias no `.env.example`, com o papel que cada uma cumpre.
VARIAVEIS_EXIGIDAS=(
	"NODE_ENV"
	"PORT"
	"LOG_LEVEL"
	"DATABASE_URL"
	"REDIS_URL"
)

# Nomes de arquivo de ambiente que o CT-004 exercita. Eles são criados DENTRO do
# clone efêmero, nunca na árvore de trabalho do operador — ver o cabeçalho do
# CT-004 para a razão.
ARQUIVOS_ENV_CT004=(".env" ".env.local" ".env.producao")

DIR_CLONE=""
DIR_SAIDAS=""
STATUS_INICIAL=""

falhas_totais=0
falhas_caso=0

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
		falhar "$1 — obtido [$3], que deveria ser diferente de [$2]"
	fi
}

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# --------------------------------------------------------------------------- #
# Limpeza — armada ANTES de qualquer criação de arquivo ou diretório.
# --------------------------------------------------------------------------- #
limpar() {
	local codigo=$?
	# Nenhum caso escreve fora destes dois diretórios temporários — removê-los é a
	# limpeza inteira. Ver o cabeçalho do CT-004: é dessa propriedade que ela vem.
	if [[ -n "${DIR_CLONE}" && -d "${DIR_CLONE}" ]]; then rm -rf "${DIR_CLONE}"; fi
	if [[ -n "${DIR_SAIDAS}" && -d "${DIR_SAIDAS}" ]]; then rm -rf "${DIR_SAIDAS}"; fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho NÃO roda quando o shell morre por sinal: um Ctrl-C no
# meio da bateria deixaria o clone efêmero (e o seu `node_modules/`) em disco, num
# servidor que opera acima de 75% de ocupação. Cada sinal chama `exit` com o código
# convencional (128 + número do sinal), o que dispara o trap de EXIT uma única vez
# e faz a limpeza acontecer.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# --------------------------------------------------------------------------- #
# Execução instrumentada dentro do clone.
#
# Devolve o código de saída do comando e grava a saída combinada no arquivo
# indicado. Nunca herda a entrada padrão do chamador: qualquer comando que
# resolva perguntar algo recebe EOF e falha, em vez de travar.
# --------------------------------------------------------------------------- #
executar_no_clone() {
	local limite="$1" saida="$2"
	shift 2
	local codigo=0
	(
		cd "${DIR_CLONE}" || exit 127
		timeout --kill-after=15s "${limite}" "$@"
	) </dev/null >"${saida}" 2>&1 || codigo=$?
	return "${codigo}"
}

# Traduz o código do `timeout` (124 = estourou o limite) em asserção legível.
afirmar_sem_bloqueio() {
	local rotulo="$1" codigo="$2"
	if [[ "${codigo}" -eq 124 || "${codigo}" -eq 137 ]]; then
		falhar "${rotulo} estourou o limite de tempo — comando bloqueou à espera de entrada"
	else
		ok "${rotulo} não bloqueou à espera de entrada"
	fi
}

resumir_saida() {
	local arquivo="$1"
	printf '         --- últimas linhas de %s ---\n' "$(basename "${arquivo}")" >&2
	tail -n 15 "${arquivo}" >&2 || true
}

# --------------------------------------------------------------------------- #
# Pré-condições do ambiente. Ausência de ferramenta é REPROVAÇÃO, nunca um caso
# silenciosamente pulado — a bateria existe para provar que o ciclo roda.
# --------------------------------------------------------------------------- #
preparar_ambiente() {
	# O `mise` em modo de usuário instala em ~/.local/bin, que não está no PATH
	# de shell não interativo. Acrescentá-lo é conveniência de invocação, não
	# relaxamento: se o binário não existir, o script reprova logo abaixo.
	if [[ -d "${HOME}/.local/bin" ]]; then
		PATH="${HOME}/.local/bin:${PATH}"
		export PATH
	fi

	local faltando=()
	local ferramenta
	for ferramenta in git mise; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done

	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: pré-condição ausente — não encontrado no PATH: %s\n' "${faltando[*]}" >&2
		printf '      O CT-001 exige `mise` disponível e rede alcançável ao registro de pacotes.\n' >&2
		exit 1
	fi

	DIR_SAIDAS="$(mktemp -d -t sysloc-verificar-workspace-saidas-XXXXXXXX)"
}

# --------------------------------------------------------------------------- #
# Clone efêmero do commit sob teste.
#
# `git clone` traz o que está commitado; a sobreposição seguinte traz o que está
# no índice e o que ainda é não rastreado mas rastreável (`--cached --others
# --exclude-standard`). O resultado é exatamente a árvore que o commit sob teste
# carregaria — e, por construção, sem `node_modules/`, `.turbo/` ou `dist/`, que
# o `.gitignore` exclui.
# --------------------------------------------------------------------------- #
criar_clone_efemero() {
	DIR_CLONE="$(mktemp -d -t sysloc-verificar-workspace-XXXXXXXX)"
	rmdir "${DIR_CLONE}"

	git clone --no-hardlinks --quiet "${RAIZ_REPO}" "${DIR_CLONE}"

	local relativo
	while IFS= read -r -d '' relativo; do
		mkdir -p "${DIR_CLONE}/$(dirname "${relativo}")"
		cp -p "${RAIZ_REPO}/${relativo}" "${DIR_CLONE}/${relativo}"
	done < <(git -C "${RAIZ_REPO}" ls-files -z --cached --others --exclude-standard)
}

# --------------------------------------------------------------------------- #
# CT-001 — Ciclo de instalação e construção a partir de clone limpo, com membros
#          de workspace vazios.
# --------------------------------------------------------------------------- #
ct_001() {
	caso "CT-001" "Ciclo mise install -> pnpm install -> pnpm build -> pnpm lint em clone limpo"

	local sha
	sha="$(git -C "${RAIZ_REPO}" rev-parse HEAD)"
	printf '    ..   commit sob teste: %s\n' "${sha}"

	criar_clone_efemero
	printf '    ..   clone efêmero: %s\n' "${DIR_CLONE}"

	# Pré-condição do caso: os dois diretórios de membro existem e hospedam
	# exatamente os pacotes que a fatia entrega. Ver `MEMBROS_DO_WORKSPACE`.
	local dir
	for dir in apps packages; do
		if [[ -d "${DIR_CLONE}/${dir}" ]]; then
			ok "${dir}/ presente no clone"
		else
			falhar "${dir}/ ausente no clone — o caso não tem sobre o que construir"
		fi
		afirmar_igual "${dir}/ hospeda exatamente ${PACOTES_POR_DIRETORIO[${dir}]} pacote(s)" \
			"${PACOTES_POR_DIRETORIO[${dir}]}" \
			"$(find "${DIR_CLONE}/${dir}" -mindepth 2 -maxdepth 2 -name package.json 2>/dev/null | grep -c . || true)"
	done

	afirmar_igual "clone sem node_modules/ herdado da árvore de trabalho" "0" \
		"$([[ -e "${DIR_CLONE}/node_modules" ]] && echo 1 || echo 0)"
	afirmar_igual "clone sem .turbo/ herdado da árvore de trabalho" "0" \
		"$([[ -e "${DIR_CLONE}/.turbo" ]] && echo 1 || echo 0)"

	local inicio fim decorrido
	inicio="$(date +%s)"

	# --- passo 1: mise install ---------------------------------------------- #
	local codigo_mise=0
	executar_no_clone "${LIMITE_MISE_INSTALL}" "${DIR_SAIDAS}/mise-install.log" \
		mise install || codigo_mise=$?
	afirmar_igual "mise install sai 0" "0" "${codigo_mise}"
	afirmar_sem_bloqueio "mise install" "${codigo_mise}"
	if [[ "${codigo_mise}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/mise-install.log"; fi

	# A partir daqui os comandos precisam ver as versões que o `.mise.toml`
	# declara. Os shims resolvem a versão pelo diretório de trabalho — é o
	# caminho não interativo documentado, sem ativar o mise no shell do usuário.
	local dir_shims="${MISE_DATA_DIR:-${HOME}/.local/share/mise}/shims"
	if [[ -d "${dir_shims}" ]]; then
		PATH="${dir_shims}:${PATH}"
		export PATH
		ok "shims do mise disponíveis em ${dir_shims}"
	else
		falhar "mise install não produziu o diretório de shims em ${dir_shims}"
	fi

	afirmar_igual "node resolvido pelo mise é o do .mise.toml" \
		"v$(sed -n 's/^node = "\(.*\)"$/\1/p' "${DIR_CLONE}/.mise.toml")" \
		"$(cd "${DIR_CLONE}" && node --version 2>/dev/null || echo AUSENTE)"

	# --- passo 2: pnpm install ---------------------------------------------- #
	local codigo_install=0
	executar_no_clone "${LIMITE_PNPM_INSTALL}" "${DIR_SAIDAS}/pnpm-install.log" \
		pnpm install || codigo_install=$?
	afirmar_igual "pnpm install sai 0" "0" "${codigo_install}"
	afirmar_sem_bloqueio "pnpm install" "${codigo_install}"
	if [[ "${codigo_install}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/pnpm-install.log"; fi

	afirmar_igual "pnpm install não reclama de membro de workspace inexistente" "0" \
		"$(grep -ciE 'no projects matched|workspace.*not found|ENOENT.*(apps|packages)' \
			"${DIR_SAIDAS}/pnpm-install.log" || true)"

	# --- passo 3: pnpm -r list --depth -1 ------------------------------------ #
	local codigo_list=0
	executar_no_clone "${LIMITE_PNPM_LIST}" "${DIR_SAIDAS}/pnpm-list.log" \
		pnpm -r list --depth -1 || codigo_list=$?
	afirmar_igual "pnpm -r list --depth -1 sai 0" "0" "${codigo_list}"

	# Uma entrada = uma linha `nome@versao /caminho`. A contagem é EXATA e cada
	# membro é conferido pelo nome E pelo caminho: perder um pacote reprova,
	# ganhar um pacote não declarado reprova, e um pacote registrado no lugar
	# errado reprova.
	local entradas
	entradas="$(grep -cE '^[^[:space:]]+@[^[:space:]]+[[:space:]]+/' \
		"${DIR_SAIDAS}/pnpm-list.log" || true)"
	afirmar_igual "o workspace lista exatamente ${#MEMBROS_DO_WORKSPACE[@]} pacotes" \
		"${#MEMBROS_DO_WORKSPACE[@]}" "${entradas}"

	local membro nome sufixo
	for membro in "${MEMBROS_DO_WORKSPACE[@]}"; do
		nome="${membro%%:*}"
		sufixo="${membro#*:}"
		afirmar_igual "o membro ${nome} está registrado exatamente uma vez, em ${sufixo:-a raiz}" "1" \
			"$(grep -cE "^${nome}@[^[:space:]]+[[:space:]]+${DIR_CLONE}${sufixo}[[:space:]]+\(PRIVATE\)" \
				"${DIR_SAIDAS}/pnpm-list.log" || true)"
	done

	# --- passo 4: pnpm build ------------------------------------------------- #
	local codigo_build=0
	executar_no_clone "${LIMITE_PNPM_BUILD}" "${DIR_SAIDAS}/pnpm-build.log" \
		pnpm build || codigo_build=$?
	afirmar_igual "pnpm build sai 0" "0" "${codigo_build}"
	afirmar_sem_bloqueio "pnpm build" "${codigo_build}"
	if [[ "${codigo_build}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/pnpm-build.log"; fi

	# --- passo 5: pnpm lint -------------------------------------------------- #
	local codigo_lint=0
	executar_no_clone "${LIMITE_PNPM_LINT}" "${DIR_SAIDAS}/pnpm-lint.log" \
		pnpm lint || codigo_lint=$?
	afirmar_igual "pnpm lint sai 0" "0" "${codigo_lint}"
	afirmar_sem_bloqueio "pnpm lint" "${codigo_lint}"
	if [[ "${codigo_lint}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/pnpm-lint.log"; fi

	# O Biome só imprime `Found N ...` quando há diagnóstico. Zero linhas dessas
	# é a forma literal de "0 diagnósticos".
	afirmar_igual "pnpm lint reporta 0 diagnósticos" "0" \
		"$(grep -cE '^Found [0-9]+ (error|warning|info)' "${DIR_SAIDAS}/pnpm-lint.log" || true)"

	fim="$(date +%s)"
	decorrido=$((fim - inicio))
	printf '    ..   ciclo completo em %ds (teto declarado: %ds)\n' \
		"${decorrido}" "${LIMITE_CICLO_CT001}"
	if [[ "${decorrido}" -le "${LIMITE_CICLO_CT001}" ]]; then
		ok "ciclo completo dentro do limite de ${LIMITE_CICLO_CT001}s"
	else
		falhar "ciclo completo levou ${decorrido}s, acima do limite de ${LIMITE_CICLO_CT001}s"
	fi

	fechar_caso "CT-001"
}

# --------------------------------------------------------------------------- #
# CT-002 — A configuração da raiz não é declarativa: ela tem efeito observável no
#          pacote membro (cenários A e B, o controle C e o contrato de ambiente D).
#
# O pacote de sonda vive APENAS dentro do clone efêmero e é descartado com ele.
# Nenhuma regra do `biome.json` ou do `tsconfig.base.json` é relaxada, nenhum
# arquivo de exceção é criado e o pacote não é excluído do workspace — qualquer
# uma dessas concessões desligaria em produção justamente a porta que o caso
# existe para provar.
#
# O cenário D fecha a lacuna de verificação do contrato de ambiente do
# `turbo.json`: o Turborepo 2.x roda em Strict Environment Mode e REMOVE do
# ambiente da tarefa toda variável não declarada. Sem esta prova, uma regressão na
# declaração (alguém apagar `globalEnv`/`env` num refactor) só apareceria em T4,
# T5 ou T6, como variável ausente onde o operador jurava tê-la exportado. O
# cenário usa a tarefa `test` — que já é declarada e é onde a consequência dói —,
# nunca uma tarefa criada só para o teste enxergar (Iron Law #6).
# --------------------------------------------------------------------------- #
ct_002() {
	caso "CT-002" "A configuração da raiz não é declarativa — TypeScript estrito, formatador e contrato de ambiente"

	local rel_pacote="packages/pacote-violador"
	local dir_pacote="${DIR_CLONE}/${rel_pacote}"
	local rel_ts="${rel_pacote}/src/violacao.ts"
	local rel_formato="${rel_pacote}/src/formato-ruim.ts"

	mkdir -p "${dir_pacote}/src"

	cat >"${dir_pacote}/package.json" <<'JSON'
{
  "name": "@sysloc/pacote-violador",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "tsc --noEmit -p tsconfig.json",
    "test": "node --eval \"for (const k of ['NODE_ENV','DATABASE_URL','REDIS_URL','PORT','LOG_LEVEL','SYSLOC_SONDA_NAO_DECLARADA']) console.log('SONDA ' + k + '=' + (process.env[k] === undefined ? '<ausente>' : JSON.stringify(process.env[k])))\""
  }
}
JSON

	# Estende o base sem redefinir opção alguma — é justamente a herança que está
	# sob teste. Se `strict` não chegasse por herança, o cenário A passaria verde.
	cat >"${dir_pacote}/tsconfig.json" <<'JSON'
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
JSON

	# --- Cenário A: parâmetro implicitamente `any` --------------------------- #
	# Escrito já no formato do Biome, para que o cenário A isole a porta do
	# TypeScript e não seja reprovado de carona pelo formatador.
	cat >"${DIR_CLONE}/${rel_ts}" <<'TS'
export function f(x) {
  return x;
}
TS

	local codigo=0
	executar_no_clone "${LIMITE_PNPM_INSTALL}" "${DIR_SAIDAS}/ct002-install.log" \
		pnpm install || codigo=$?
	afirmar_igual "pnpm install sai 0 com o pacote violador presente" "0" "${codigo}"

	# O rótulo acima só afirma o código de saída; o REGISTRO no workspace é outra
	# coisa e precisa da sua própria asserção — sem ela, um glob quebrado deixaria
	# o pacote de fora e o `pnpm install` sairia 0 do mesmo jeito.
	codigo=0
	executar_no_clone "${LIMITE_PNPM_LIST}" "${DIR_SAIDAS}/ct002-list.log" \
		pnpm -r list --depth -1 || codigo=$?
	afirmar_igual "o pacote violador foi de fato registrado no workspace" "1" \
		"$(grep -cE '^@sysloc/pacote-violador@[^[:space:]]+[[:space:]]+/' \
			"${DIR_SAIDAS}/ct002-list.log" || true)"

	codigo=0
	executar_no_clone "${LIMITE_PNPM_BUILD}" "${DIR_SAIDAS}/ct002-build-a.log" \
		pnpm build || codigo=$?
	afirmar_diferente "cenário A: pnpm build sai != 0" "0" "${codigo}"
	afirmar_igual "cenário A: a saída traz o diagnóstico TS7006" "1" \
		"$(grep -qE 'TS7006' "${DIR_SAIDAS}/ct002-build-a.log" && echo 1 || echo 0)"
	afirmar_igual "cenário A: o diagnóstico nomeia o parâmetro 'x'" "1" \
		"$(grep -qE "TS7006.*Parameter 'x'" "${DIR_SAIDAS}/ct002-build-a.log" && echo 1 || echo 0)"

	# --- Cenário B: arquivo fora do formato do Biome ------------------------- #
	# Aspas duplas onde o `biome.json` fixa aspas simples, indentação de 4 espaços
	# onde ele fixa 2, e ponto e vírgula ausente.
	printf 'export const mensagem = "fora de formato";\nexport function g() {\n    return mensagem\n}\n' \
		>"${DIR_CLONE}/${rel_formato}"

	# Corrige a violação do TypeScript para que o cenário B isole a porta do
	# formatador — sem isso, o `pnpm lint` poderia sair != 0 por outra razão.
	cat >"${DIR_CLONE}/${rel_ts}" <<'TS'
export function f(x: string) {
  return x;
}
TS

	codigo=0
	executar_no_clone "${LIMITE_PNPM_LINT}" "${DIR_SAIDAS}/ct002-lint-b.log" \
		pnpm lint || codigo=$?
	afirmar_diferente "cenário B: pnpm lint sai != 0" "0" "${codigo}"
	afirmar_igual "cenário B: a saída nomeia o arquivo violador" "1" \
		"$(grep -qF "${rel_formato}" "${DIR_SAIDAS}/ct002-lint-b.log" && echo 1 || echo 0)"

	# --- Cenário C (controle): violações corrigidas -------------------------- #
	# A transição != 0 -> 0 é o que distingue uma porta de qualidade real de um
	# comando que falharia por qualquer motivo (AP-29, asserção tautológica).
	printf "export const mensagem = 'em formato';\nexport function g() {\n  return mensagem;\n}\n" \
		>"${DIR_CLONE}/${rel_formato}"

	codigo=0
	executar_no_clone "${LIMITE_PNPM_BUILD}" "${DIR_SAIDAS}/ct002-build-c.log" \
		pnpm build || codigo=$?
	afirmar_igual "cenário C: com as violações corrigidas, pnpm build volta a sair 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/ct002-build-c.log"; fi

	codigo=0
	executar_no_clone "${LIMITE_PNPM_LINT}" "${DIR_SAIDAS}/ct002-lint-c.log" \
		pnpm lint || codigo=$?
	afirmar_igual "cenário C: com as violações corrigidas, pnpm lint volta a sair 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/ct002-lint-c.log"; fi

	# --- Cenário D: contrato de ambiente do `turbo.json` --------------------- #
	# O par é o que dá valor à asserção: as variáveis DECLARADAS chegam à tarefa
	# com o valor exato, e a de controle — deliberadamente não declarada — NÃO
	# chega. Sem o segundo lado, "chegou" não distinguiria declaração efetiva de
	# repasse acidental, e a asserção seria tautológica (AP-29).
	codigo=0
	executar_no_clone "${LIMITE_PNPM_TEST}" "${DIR_SAIDAS}/ct002-test-d.log" \
		env NODE_ENV=cenario-d \
		DATABASE_URL=postgres://sonda-d/banco \
		REDIS_URL=redis://sonda-d/fila \
		PORT=porta-d \
		LOG_LEVEL=nivel-d \
		SYSLOC_SONDA_NAO_DECLARADA=valor-de-controle \
		pnpm test || codigo=$?
	afirmar_igual "cenário D: pnpm test sai 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then resumir_saida "${DIR_SAIDAS}/ct002-test-d.log"; fi

	local declarada
	for declarada in \
		'NODE_ENV="cenario-d"' \
		'DATABASE_URL="postgres://sonda-d/banco"' \
		'REDIS_URL="redis://sonda-d/fila"' \
		'PORT="porta-d"' \
		'LOG_LEVEL="nivel-d"'; do
		afirmar_igual "cenário D: ${declarada%%=*} declarada no turbo.json chega à tarefa com o valor exato" "1" \
			"$(grep -cF "SONDA ${declarada}" "${DIR_SAIDAS}/ct002-test-d.log" || true)"
	done

	afirmar_igual "cenário D: variável NÃO declarada no turbo.json não chega à tarefa" "1" \
		"$(grep -cF 'SONDA SYSLOC_SONDA_NAO_DECLARADA=<ausente>' \
			"${DIR_SAIDAS}/ct002-test-d.log" || true)"

	# --- Descarte e retorno ao estado do CT-001 ------------------------------ #
	rm -rf "${dir_pacote}"
	codigo=0
	executar_no_clone "${LIMITE_PNPM_INSTALL}" "${DIR_SAIDAS}/ct002-install-final.log" \
		pnpm install || codigo=$?
	afirmar_igual "após remover o pacote violador, pnpm install sai 0" "0" "${codigo}"

	codigo=0
	executar_no_clone "${LIMITE_PNPM_LIST}" "${DIR_SAIDAS}/ct002-list-final.log" \
		pnpm -r list --depth -1 || codigo=$?
	afirmar_igual "o clone volta ao estado do CT-001: ${#MEMBROS_DO_WORKSPACE[@]} pacotes no workspace" \
		"${#MEMBROS_DO_WORKSPACE[@]}" \
		"$(grep -cE '^[^[:space:]]+@[^[:space:]]+[[:space:]]+/' \
			"${DIR_SAIDAS}/ct002-list-final.log" || true)"

	fechar_caso "CT-002"
}

# --------------------------------------------------------------------------- #
# CT-003 — `.env.example` versionado documenta as variáveis sem carregar nenhum
#          valor real.
#
# A asserção é sobre a ÁRVORE VERSIONADA (`git ls-files`), não sobre o disco:
# arquivo não rastreado não é o que interessa aqui — o risco é a credencial que
# entra num arquivo que É versionado por definição.
# --------------------------------------------------------------------------- #
ct_003() {
	caso "CT-003" ".env.example versionado documenta sem carregar valor real"

	local versionados
	versionados="$(git -C "${RAIZ_REPO}" ls-files .env.example)"
	afirmar_igual "git ls-files .env.example retorna exatamente 1 caminho" "1" \
		"$(printf '%s\n' "${versionados}" | grep -c . || true)"

	if [[ -z "${versionados}" ]]; then
		falhar ".env.example não está na árvore versionada — asserções seguintes sem objeto"
		fechar_caso "CT-003"
		return
	fi

	local arquivo="${RAIZ_REPO}/.env.example"

	# Linha de variável: NOME= no início da linha. Valor concreto: qualquer coisa
	# à direita do `=` que não seja espaço em branco.
	afirmar_igual "nenhuma linha de variável carrega valor concreto" "0" \
		"$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=[[:space:]]*[^[:space:]]' "${arquivo}" || true)"

	afirmar_igual "nenhuma linha de segredo (SENHA|PASSWORD|SECRET|TOKEN|KEY|CREDENCIAL) com valor" "0" \
		"$(grep -cEi '^[A-Za-z_][A-Za-z0-9_]*(SENHA|PASSWORD|SECRET|TOKEN|KEY|CREDENCIAL)[A-Za-z0-9_]*=[[:space:]]*[^[:space:]]' \
			"${arquivo}" || true)"

	# Host, IP ou porta do ambiente legado. O backend antigo vive em /opt/frappe,
	# expõe as portas 8000 e 8300 e atende os sites `frontend`/`*.localhost`.
	afirmar_igual "nenhum endereço IPv4 literal" "0" \
		"$(grep -cE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' "${arquivo}" || true)"
	afirmar_igual "nenhuma referência ao ambiente legado (frappe/erpnext/bench)" "0" \
		"$(grep -ciE 'frappe|erpnext|bench' "${arquivo}" || true)"
	afirmar_igual "nenhuma porta do ambiente legado (8000/8300/3306/9000)" "0" \
		"$(grep -cE '(^|[^0-9])(8000|8300|3306|9000)([^0-9]|$)' "${arquivo}" || true)"

	# Cada variável exigida está declarada E tem comentário de propósito nas três
	# linhas imediatamente acima — o que impede uma lista de nomes sem explicação.
	local variavel numero_linha comentarios
	for variavel in "${VARIAVEIS_EXIGIDAS[@]}"; do
		numero_linha="$(grep -nE "^${variavel}=" "${arquivo}" | head -1 | cut -d: -f1)"
		if [[ -z "${numero_linha}" ]]; then
			falhar "variável exigida ausente do .env.example: ${variavel}"
			continue
		fi
		comentarios="$(sed -n "$((numero_linha > 3 ? numero_linha - 3 : 1)),$((numero_linha - 1))p" \
			"${arquivo}" | grep -cE '^#[[:space:]]*[^[:space:]#-]' || true)"
		if [[ "${comentarios}" -ge 1 ]]; then
			ok "${variavel} declarada com comentário de propósito"
		else
			falhar "${variavel} declarada sem comentário de propósito nas 3 linhas acima"
		fi
	done

	fechar_caso "CT-003"
}

# --------------------------------------------------------------------------- #
# CT-004 — Arquivo de ambiente com valor real é barrado pelo Git e recusado por
#          `git add`.
#
# CAUSA-RAIZ: a versão anterior deste caso operava sobre `RAIZ_REPO` — criava
# `.env`, `.env.local` e `.env.producao` na ÁRVORE DE TRABALHO do operador. A
# invariante fala de "raiz do repositório", e o caso leu isso como "a árvore de
# trabalho desta máquina" quando o que a invariante exige é apenas um repositório
# governado pelo `.gitignore` versionado — que é exatamente o que o clone efêmero
# é. Escrever no lugar errado obrigou a compensar: resguardo por PID, soma
# SHA-256, flag de armado, ramo de restauração no trap. Cerca de 70 linhas cuja
# única razão de existir era o acoplamento à árvore do operador — e que ainda
# assim não cobriam SIGKILL, corte de energia nem duas execuções concorrentes
# disputando os mesmos três caminhos. A correção não é blindar melhor: é não
# escrever ali.
#
# O caso passa a rodar dentro de `DIR_CLONE`, o clone efêmero criado pelo CT-001 e
# ainda vivo aqui. O SUT — o `.gitignore` versionado — está presente byte a byte
# no clone, e `git check-ignore`, `git add` e `git status` se comportam de forma
# idêntica. O poder assertivo é o mesmo; o que some é a classe inteira de risco.
#
# Isso também resolve o MED-001 de forma mais forte do que o resguardo resolvia:
# o caso deixa de depender do estado da árvore de trabalho por completo, em vez de
# depender dele e compensar. Um `.env` na raiz do repositório — o estado que o
# próprio `.env.example` recomenda — passa a ser irrelevante para a bateria.
#
# SUT_IS_CORRECT_BECAUSE: a asserção "os N arquivos pré-existentes voltaram com
# SHA-256 idêntico" foi REMOVIDA porque o seu objeto deixou de existir — não há
# mais resguardo a restaurar, já que nenhum arquivo do operador é tocado. É
# remoção de asserção sem alvo, não enfraquecimento (AP-24): as cinco asserções
# da invariante do caso continuam presentes e literais, e a comparação por caminho
# exato do `git status` segue endurecida.
#
# O valor fictício é gerado em runtime a partir de /dev/urandom, nunca é impresso
# nem versionado, e o clone inteiro é removido no encerramento — inclusive em
# falha ou por sinal, pelos traps armados no início do script.
# --------------------------------------------------------------------------- #
ct_004() {
	caso "CT-004" "Arquivo de ambiente com credencial é ignorado pelo Git e recusado por git add"

	if [[ -z "${DIR_CLONE}" || ! -d "${DIR_CLONE}/.git" ]]; then
		falhar "clone efêmero indisponível — o CT-004 depende do sandbox criado pelo CT-001"
		fechar_caso "CT-004"
		return
	fi

	local arquivo
	# O clone nasce de `git ls-files --cached --others --exclude-standard`, que
	# exclui o que o `.gitignore` barra. Nenhum arquivo de ambiente pode ter
	# chegado nele — se chegou, a construção do sandbox está furada e o caso
	# estaria medindo o arquivo errado.
	for arquivo in "${ARQUIVOS_ENV_CT004[@]}"; do
		afirmar_igual "o clone efêmero não herdou ${arquivo} da árvore de trabalho" "0" \
			"$([[ -e "${DIR_CLONE}/${arquivo}" ]] && echo 1 || echo 0)"
	done

	STATUS_INICIAL="$(git -C "${DIR_CLONE}" status --porcelain)"

	# Credencial fictícia gerada em runtime. Fica em variável de shell não
	# exportada, não é ecoada e não trafega por argv.
	local credencial_ficticia
	credencial_ficticia="$(head -c 24 /dev/urandom | base64 | tr -d '\n=/+')"

	for arquivo in "${ARQUIVOS_ENV_CT004[@]}"; do
		printf 'DATABASE_URL=postgres://sysloc:%s@localhost/sysloc\n' "${credencial_ficticia}" \
			>"${DIR_CLONE}/${arquivo}"
	done
	unset credencial_ficticia

	local codigo
	for arquivo in "${ARQUIVOS_ENV_CT004[@]}"; do
		codigo=0
		git -C "${DIR_CLONE}" check-ignore -q "${arquivo}" || codigo=$?
		afirmar_igual "git check-ignore -q ${arquivo} sai 0 (ignorado)" "0" "${codigo}"
	done

	# SUT_IS_CORRECT_BECAUSE: uma versão anterior desta asserção contava por
	# substring e acusava `.env.example` (que É rastreado, por desenho) como se
	# fosse `.env`. O defeito estava na asserção, não no `.gitignore`. A contagem é
	# por CAMINHO EXATO: o campo de caminho do `--porcelain` começa na coluna 4
	# (`XY <caminho>`), e a comparação é de linha inteira.
	local status_atual caminhos ocorrencias=0
	status_atual="$(git -C "${DIR_CLONE}" status --porcelain)"
	caminhos="$(printf '%s\n' "${status_atual}" | cut -c4-)"
	for arquivo in "${ARQUIVOS_ENV_CT004[@]}"; do
		ocorrencias=$((ocorrencias + $(printf '%s\n' "${caminhos}" |
			grep -cxF -- "${arquivo}" || true)))
	done
	afirmar_igual "git status --porcelain não lista nenhum dos três arquivos" "0" "${ocorrencias}"

	local saida_add
	codigo=0
	saida_add="$(git -C "${DIR_CLONE}" add .env 2>&1)" || codigo=$?
	afirmar_diferente "git add .env (sem --force) sai != 0" "0" "${codigo}"
	if [[ "${codigo}" -eq 0 ]]; then
		# Regressão: o arquivo entrou no índice do clone. Desfaz para que a asserção
		# final sobre o `git status` meça o `.gitignore`, e não o rastro do caso.
		git -C "${DIR_CLONE}" reset -q -- .env
	fi
	afirmar_igual "a mensagem de recusa cita o .gitignore" "1" \
		"$(printf '%s\n' "${saida_add}" | grep -cF 'ignored by one of your .gitignore files' || true)"

	# A negação `!.env.example` continua valendo. Sem esta asserção, um
	# `.gitignore` endurecido passaria em tudo acima e quebraria o CT-003 em
	# silêncio, levando junto a documentação de configuração.
	codigo=0
	git -C "${DIR_CLONE}" check-ignore -q .env.example || codigo=$?
	afirmar_diferente "git check-ignore -q .env.example sai != 0 (continua rastreável)" "0" "${codigo}"

	for arquivo in "${ARQUIVOS_ENV_CT004[@]}"; do
		rm -f "${DIR_CLONE}/${arquivo}"
	done

	afirmar_igual "git status --porcelain volta byte a byte ao estado inicial" \
		"${STATUS_INICIAL}" "$(git -C "${DIR_CLONE}" status --porcelain)"

	fechar_caso "CT-004"
}

main() {
	printf 'Verificação da fundação do monorepo — %s\n' "${RAIZ_REPO}"

	preparar_ambiente

	ct_001
	ct_002
	ct_003
	ct_004

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-workspace: 4/4 casos aprovados (CT-001, CT-002, CT-003, CT-004)\n'
		exit 0
	fi
	printf 'verificar-workspace: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
