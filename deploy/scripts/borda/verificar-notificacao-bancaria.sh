#!/usr/bin/env bash
#
# CT-1005 — A BORDA PUBLICA EXATAMENTE UM CAMINHO.
#
# Caso coberto: CT-1005 (CA-20), da fatia `webhook-e-carne`, em quatro frentes:
#
#   CT-1005 (a)  os três artefatos versionados desta borda não carregam hostname
#                literal, o vhost não carrega segredo nem redirecionamento, e o
#                teto de corpo da borda é o mesmo do serviço;
#   CT-1005 (b)  a instalação é IDEMPOTENTE — as funções REAIS do instalador
#                decidem e executam "escrever só quando diverge", o gabarito
#                meio substituído é recusado, a renderização recusa o que o
#                `sed` não conseguiu substituir e o que saiu implausível, os
#                valores que viram diretiva do nginx são conferidos por forma, e
#                a limpeza desfaz a escrita ainda não validada;
#   CT-1005 (c)  por MEDIÇÃO DE REDE: o caminho da notícia alcança o serviço por
#                TLS, e `/docs`, `/v1/auth/*`, `/saude`, um caminho inexistente e
#                o caminho com prefixo morrem NA BORDA, sem repasse — e nada em
#                claro devolve `3xx`;
#   CT-1005 (d)  a configuração que atende a operação não foi tocada.
#
# ===========================================================================
# INVARIANTES
# ===========================================================================
#
#   I1  A superfície externa do produto é UMA SÓ. Publicar um caminho para fora
#       é mudança de postura de segurança (risco R9 do tech spec), e a única
#       forma de afirmar que nada mais responde é MEDIR, não ler a configuração.
#   I2  A recusa é DA BORDA, sem repasse. Um `404` do serviço e um `404` da
#       borda são indistinguíveis pelo status — o que os separa é a trilha do
#       lado de dentro, e é ela que este verificador conta.
#   I3  Nenhum `3xx`. O provedor reprova redirecionamento, e um `301` sobre um
#       `POST` perde método e corpo pelo caminho.
#   I4  O hostname NUNCA é literal no repositório: ele é decisão operacional do
#       usuário, e continua aberta.
#   I5  O que atende a operação (`/opt/frappe`) não é tocado — nem por escrita,
#       nem por recarga do servidor.
#
# ===========================================================================
# ONDE ISTO EXECUTA — e por que NÃO é a borda que atende a operação
# ===========================================================================
#
# A ADR-0006 é literal: *"a suíte de verificação nunca executa contra o ambiente
# que atende a operação"*. Por isso o CT-1005 (c) mede contra uma BORDA EFÊMERA
# E ISOLADA — um nginx próprio, em prefixo descartável, portas altas próprias,
# certificado gerado no arranjo e um serviço de verificação em `127.0.0.1`. É
# medição de rede DE VERDADE, com o binário de verdade e o vhost versionado
# renderizado pelo renderizador REAL do instalador; o que não é de verdade é
# apenas *onde* ela acontece.
#
# O que o CT-1005 (d) faz com a instalação de produção é LER — comparar a
# configuração do legado antes e depois, e conferir que nenhum processo do
# servidor de borda foi recarregado. Ler não é executar contra ela.
#
# ⚠️ A instalação na borda real é o **passo 1 do rollout** (§16.4 do tech spec),
# ato do operador, com ponto de parada — e NÃO é entrega deste verificador.
#
# ===========================================================================
# PROVA DE FALSIFICAÇÃO — permanente, e só onde a asserção é ESTÁTICA
# ===========================================================================
#
# O CT-1005 (a) inspeciona o TEXTO dos artefatos versionados, e afirma uma
# AUSÊNCIA — que é exatamente o que uma varredura quebrada também devolve. Por
# isso a MESMA função roda duas vezes: sobre os artefatos reais (controle) e
# sobre uma cópia com as três agulhas PLANTADAS, onde ela precisa achar as três
# e devolver status de falha. Um verificador que nunca achasse nada passaria no
# controle e reprovaria no mutante; um que achasse tudo faria o contrário.
#
# As agulhas são COMPOSTAS EM TEMPO DE EXECUÇÃO, a partir de fragmentos que não
# casam sozinhos. Escrevê-las por extenso faria este arquivo — que é varrido
# junto com os outros dois — acusar a si mesmo, e a única saída seria enfraquecer
# a varredura.
#
# ⚠️ A varredura de SEGREDO alcança o gabarito e o instalador, e NÃO este
# arquivo: é aqui que os padrões procurados estão escritos, e um arquivo que
# contém o próprio padrão sempre se acha. O que se perde é nulo — este script
# não entra em servidor nenhum.
#
# As asserções do CT-1005 (b), (c) e (d) são COMPORTAMENTAIS (exercitam funções
# reais, medem rede real, comparam estado real) e por decisão registrada não se
# demonstram por reintrodução de defeito.
#
# ===========================================================================
# Contrato de saída
# ===========================================================================
#
#   0  zero falhas — e nenhum outro caminho produz verde.
#   1  reprovou o que este verificador existe para provar.
#
# Ferramenta ou estado ausente NUNCA faz o caso passar em silêncio: cada
# degradação sai como `aviso` nomeando o que não foi verificado, e o RESUMO
# FINAL as conta e diz que houve asserção não medida.
#
# Uso: bash deploy/scripts/borda/verificar-notificacao-bancaria.sh
#
# Ele NÃO exige privilégio, e não deve receber nenhum: tudo que mede é leitura,
# processo próprio em porta alta e diretório descartável.
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

# --------------------------------------------------------------------------- #
# Os artefatos sob prova.
# --------------------------------------------------------------------------- #
readonly GABARITO="${RAIZ_REPO}/deploy/nginx/sysloc-notificacao-bancaria.conf"
readonly INSTALADOR="${RAIZ_REPO}/deploy/scripts/borda/instalar-borda-de-notificacao.sh"
readonly ESTE_SCRIPT="${RAIZ_REPO}/deploy/scripts/borda/verificar-notificacao-bancaria.sh"

# O controlador da T6, de onde sai o caminho publicado, e a composição raiz, de
# onde sai o teto de corpo. Os dois são lidos para CONFERIR coerência: medir um
# caminho que a API não publica seria medir a borda contra uma ficção.
readonly CONTROLADOR_DA_NOTICIA="${RAIZ_REPO}/apps/api/src/notificacoes-bancarias/notificacao-bancaria.controller.ts"
readonly COMPOSICAO_RAIZ="${RAIZ_REPO}/apps/api/src/main.ts"

# O caminho publicado, escrito por extenso: é o que o provedor vai chamar, e
# derivá-lo do controlador poria o artefato sob prova nos dois lados da
# comparação. A COERÊNCIA com o controlador é asserção à parte, no caso (a).
readonly CAMINHO_DA_NOTICIA="/v1/notificacoes-bancarias"

# Os caminhos que NÃO podem atravessar. `/docs` é o contrato publicado,
# `/v1/auth/*` são as rotas de sessão (é o que mantém o D27 da F1 sem eixo),
# `/saude` fica fora do prefixo de versão, e o último não existe em lugar nenhum.
readonly CAMINHOS_RECUSADOS=(
	"/docs"
	"/v1/auth/get-session"
	"/v1/auth/sign-in/email"
	"/saude"
	"/nao-existe-nesta-api"
	"/v1/notificacoes-bancarias/extra"
	"/v1/notificacoes-bancarias/"
)

# O cabeçalho com que o serviço de verificação se identifica. É ele que separa
# "a resposta veio de dentro" de "a resposta veio da borda".
readonly CABECALHO_DO_SERVICO="x-origem-do-servico"
readonly ORIGEM_DO_SERVICO="notificacao-bancaria-de-verificacao"

# Teto de corpo declarado no gabarito, e o mesmo valor em bytes na composição
# raiz (`MAIOR_CORPO_ACEITO`). Escritos aqui de propósito: os dois lados da
# comparação precisam de uma terceira declaração, senão a asserção não pode
# falhar.
readonly TETO_DE_CORPO_NA_BORDA="64k"
readonly TETO_DE_CORPO_NO_SERVICO="64 * 1024"

# O que faz um token ser NOME DE DOMÍNIO, e não `main.ts` nem `process.argv`: o
# último rótulo é um domínio de topo. A lista é fechada de propósito — a forma
# genérica *"dois rótulos separados por ponto"* acusa toda chamada de método e
# toda extensão de arquivo, e uma varredura que grita em tudo é desligada na
# primeira semana.
#
# ⚠️ Se o hostname escolhido pelo usuário usar um domínio de topo fora desta
# lista, ACRESCENTE-O aqui: a lista é a cobertura da varredura, e o que ela não
# nomeia ela não vê.
readonly DOMINIOS_DE_TOPO="com|br|net|org|io|dev|app|cloud|info|co|me|tech|online|xyz|biz|site|store|link|host|systems|services|digital|solutions|com\\.br|net\\.br|org\\.br"

# Configuração do legado, LIDA para afirmar que não mudou. São os arquivos de
# configuração de servidor do `/opt/frappe` legíveis sem privilégio.
readonly DIR_DO_LEGADO="/opt/frappe"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TRABALHO="$(mktemp -d)"
readonly DIR_TRABALHO
PID_DO_SERVICO=""
PREFIXO_DA_BORDA=""
RAIZ_DO_DESAFIO_EFEMERA=""
TOKEN_DO_DESAFIO=""
CONTEUDO_DO_DESAFIO=""

falhas_totais=0
falhas_caso=0
# Degradações declaradas. NÃO governam o código de saída — quem o governa é
# `falhas_totais`, e só ele. O contador existe porque o RESUMO é a linha que o
# operador lê: anunciar "4/4 frentes aprovadas" quando uma delas não pôde ser
# medida transforma medição parcial em aprovação lida como completa.
avisos_totais=0

encerrar_borda_efemera() {
	if [[ -n "${PREFIXO_DA_BORDA}" && -f "${PREFIXO_DA_BORDA}/nginx.pid" ]]; then
		local pid
		pid="$(cat "${PREFIXO_DA_BORDA}/nginx.pid" 2>/dev/null || true)"
		[[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
	fi
	if [[ -n "${PID_DO_SERVICO}" ]]; then
		kill "${PID_DO_SERVICO}" 2>/dev/null || true
	fi
}

limpar() {
	local codigo=$?
	encerrar_borda_efemera
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

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

# =========================================================================== #
# A varredura de formas proibidas — UMA função, usada pelo controle e pelo
# mutante.
#
# Imprime uma linha `classe:ocorrência` por achado e devolve status 1 quando
# encontra algum. O status é parte do contrato, e não detalhe: uma varredura que
# apenas imprimisse ficaria verde sobre o mutante.
#
# As três classes:
#
#   hostname          token com forma de nome de domínio (dois ou mais rótulos,
#                     último em minúsculas), fora da lista de extensões de
#                     arquivo. Vale para o arquivo INTEIRO, comentário incluso:
#                     o hostname é decisão aberta do usuário e não se escreve
#                     aqui nem em prosa.
#   segredo           material de chave privada, ou atribuição de senha/token.
#   redirecionamento  `return 3xx` ou `rewrite ... permanent|redirect` em linha
#                     ATIVA (comentário que os cita para PROIBI-LOS é conteúdo
#                     legítimo, e é justamente o que o gabarito faz).
#
# A classe procurada é parâmetro para que a mesma função sirva ao gabarito
# (as três) e a este arquivo (só hostname). Ver o cabeçalho para por que a de
# segredo não alcança este script.
# =========================================================================== #
varrer_formas_proibidas() {
	local arquivo="$1"
	shift
	local classes=("$@")
	local achou=0 classe achados

	for classe in "${classes[@]}"; do
		case "${classe}" in
		hostname)
			achados="$(grep -oiE "[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.(${DOMINIOS_DE_TOPO})([^A-Za-z0-9_-]|$)" "${arquivo}" |
				sed 's|[^A-Za-z0-9_.-]*$||' | sort -u || true)"
			;;
		segredo)
			achados="$(grep -oiE -- "-----BEGIN[[:space:]A-Z]*KEY-----|(senha|password|secret|token)[[:space:]]*=" "${arquivo}" | sort -u || true)"
			;;
		redirecionamento)
			achados="$(grep -vE '^[[:space:]]*#' "${arquivo}" |
				grep -oE 'return[[:space:]]+3[0-9]{2}|rewrite[^;]*(permanent|redirect)' | sort -u || true)"
			;;
		*)
			printf 'classe desconhecida: %s\n' "${classe}" >&2
			return 2
			;;
		esac

		if [[ -n "${achados}" ]]; then
			achou=1
			printf '%s:%s\n' "${classe}" "$(printf '%s' "${achados}" | tr '\n' ' ' | sed 's| *$||')"
		fi
	done

	[[ "${achou}" -eq 0 ]]
}

# Quantas ocorrências a varredura devolveu. `grep -c` sobre saída vazia contaria
# 1 (a linha em branco), e a contagem errada apareceria justamente no lado em
# que o esperado é zero.
contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# Carrega uma função do INSTALADOR REAL, pelo texto do arquivo. É o mesmo
# mecanismo de `verificar-fundacao.sh` com `unidade_diverge`: quem valida e quem
# executa passam a ser o mesmo código, e uma reimplementação aqui aprovaria um
# instalador com o defeito de volta.
carregar_funcao_do_instalador() {
	local nome="$1" trecho
	trecho="$(sed -n "/^${nome}() {/,/^}/p" "${INSTALADOR}")"
	[[ -n "${trecho}" ]] || return 1
	eval "${trecho}"
	declare -F "${nome}" >/dev/null
}

# Carrega uma função do instalador SOB OUTRO NOME.
#
# Existe por uma colisão concreta: a função de limpeza do instalador se chama
# `limpar`, e é esse o nome da função que ESTA bateria registra em `trap ... EXIT`.
# Carregá-la pelo nome próprio substituiria a limpeza do verificador pelo SUT —
# a bateria passaria a se limpar com o código que ela está medindo, e um defeito
# na limpeza do instalador vazaria para o teardown daqui.
#
# O corte é do cabeçalho `nome() {` para diante; o corpo inteiro, chaves e todo o
# resto, continua sendo o do arquivo real.
carregar_funcao_do_instalador_como() {
	local nome="$1" apelido="$2" trecho
	trecho="$(sed -n "/^${nome}() {/,/^}/p" "${INSTALADOR}")"
	[[ -n "${trecho}" ]] || return 1
	eval "${apelido}() {${trecho#*\{}"
	declare -F "${apelido}" >/dev/null
}

# Uma porta livre no laço local, obtida do próprio sistema operacional.
porta_livre() {
	node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});'
}

# =========================================================================== #
# CT-1005 (a) — os artefatos versionados não carregam hostname, segredo nem
# redirecionamento, e o teto de corpo é o mesmo dos dois lados.
# =========================================================================== #
ct_1005_a() {
	caso "CT-1005 (a)" "os artefatos versionados desta borda não fixam hostname, não guardam segredo e não redirecionam"

	local arquivo
	for arquivo in "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}"; do
		if [[ ! -r "${arquivo}" ]]; then
			falhar "artefato ilegível: ${arquivo}"
			continue
		fi
	done
	if [[ "${falhas_caso}" -ne 0 ]]; then
		fechar_caso "CT-1005 (a)"
		return
	fi

	# ÂNCORA ANTIVÁCUO: varredura sobre arquivo vazio devolve ausência, que é
	# exatamente o resultado esperado — e aprovaria por não ter olhado.
	local linhas
	linhas="$(cat "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}" | grep -c . || true)"
	if [[ "${linhas}" -lt 200 ]]; then
		falhar "os três artefatos somam ${linhas} linha(s) de conteúdo — a varredura não teria o que examinar, e o verde abaixo seria vácuo"
		fechar_caso "CT-1005 (a)"
		return
	fi
	ok "os três artefatos somam ${linhas} linha(s) — a varredura tem o que examinar"

	local codigo achados
	for arquivo in "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}"; do
		codigo=0
		achados="$(varrer_formas_proibidas "${arquivo}" hostname)" || codigo=$?
		afirmar_igual "nenhum hostname literal em ${arquivo##*/}" "0" "$(contar_ocorrencias "${achados}")"
		afirmar_igual "a varredura de hostname não acusa nada em ${arquivo##*/}" "0" "${codigo}"
		[[ -n "${achados}" ]] && printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	done

	for arquivo in "${GABARITO}" "${INSTALADOR}"; do
		codigo=0
		achados="$(varrer_formas_proibidas "${arquivo}" segredo)" || codigo=$?
		afirmar_igual "nenhum segredo em ${arquivo##*/}" "0" "$(contar_ocorrencias "${achados}")"
		afirmar_igual "a varredura de segredo não acusa nada em ${arquivo##*/}" "0" "${codigo}"
		[[ -n "${achados}" ]] && printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	done

	# A varredura por forma tem um teto: ela só vê os domínios de topo que
	# nomeia. Esta asserção é o complemento EXATO dela — todo `server_name` do
	# gabarito é o marcador, e não existe um segundo `server_name` com qualquer
	# outro valor. Um hostname literal escapa da primeira; desta ele não escapa.
	afirmar_igual "todo server_name do gabarito é o marcador de substituição" "2" \
		"$(grep -cE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DA_NOTIFICACAO__;$' "${GABARITO}" || true)"
	afirmar_igual "o gabarito não declara server_name de nenhuma outra forma" "0" \
		"$(grep -E '^[[:space:]]*server_name' "${GABARITO}" |
			grep -cvE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DA_NOTIFICACAO__;$' || true)"

	codigo=0
	achados="$(varrer_formas_proibidas "${GABARITO}" redirecionamento)" || codigo=$?
	afirmar_igual "nenhum redirecionamento ativo no gabarito" "0" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a varredura de redirecionamento não acusa nada no gabarito" "0" "${codigo}"

	# ------------------------------------------------------------------- #
	# PROVA DE FALSIFICAÇÃO — a MESMA varredura, sobre uma cópia com as três
	# agulhas plantadas, precisa achar as três e devolver status de falha.
	#
	# As agulhas são COMPOSTAS AQUI, a partir de fragmentos que não casam
	# sozinhos: escritas por extenso, este arquivo acusaria a si mesmo.
	# ------------------------------------------------------------------- #
	local mutante="${DIR_TRABALHO}/mutante.conf"
	local agulha_hostname agulha_segredo agulha_redirecionamento
	agulha_hostname="$(printf '%s.%s.%s.%s' 'webhook' 'exemplo' 'com' 'br')"
	agulha_segredo="$(printf -- '-----%s %s %s-----' 'BEGIN' 'PRIVATE' 'KEY')"
	agulha_redirecionamento="$(printf '%s %s' 'return' '301')"

	cp "${GABARITO}" "${mutante}"
	{
		printf 'server_name %s;\n' "${agulha_hostname}"
		printf '# %s\n' "${agulha_segredo}"
		printf '%s https://destino;\n' "${agulha_redirecionamento}"
	} >>"${mutante}"

	codigo=0
	achados="$(varrer_formas_proibidas "${mutante}" hostname segredo redirecionamento)" || codigo=$?

	afirmar_igual "o mutante REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação acusa as três classes" "3" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a classe hostname nomeia a agulha plantada" \
		"hostname:${agulha_hostname}" \
		"$(printf '%s\n' "${achados}" | grep '^hostname:' || true)"
	# As três classes são fixadas por IGUALDADE contra a agulha plantada, e não
	# por "não-vazio": a agulha é conteúdo CONHECIDO, e afirmar só a presença
	# aprovaria uma varredura que acusasse a classe certa pelo motivo errado.
	afirmar_igual "a classe segredo nomeia a agulha plantada" \
		"segredo:${agulha_segredo}" \
		"$(printf '%s\n' "${achados}" | grep '^segredo:' || true)"
	afirmar_igual "a classe redirecionamento nomeia a agulha plantada" \
		"redirecionamento:${agulha_redirecionamento}" \
		"$(printf '%s\n' "${achados}" | grep '^redirecionamento:' || true)"

	# ------------------------------------------------------------------- #
	# Coerência entre a borda e o serviço. Sem ela, os dois tetos divergem em
	# silêncio: uma borda mais apertada vira gargalo que o serviço não conhece,
	# e uma mais larga entrega um corpo que ele já vai recusar.
	# ------------------------------------------------------------------- #
	if [[ -r "${COMPOSICAO_RAIZ}" ]]; then
		afirmar_igual "o gabarito declara o teto de corpo da borda" \
			"client_max_body_size ${TETO_DE_CORPO_NA_BORDA};" \
			"$(grep -oE "client_max_body_size [0-9a-z]+;" "${GABARITO}" | head -1 || true)"
		afirmar_igual "a composição raiz declara o mesmo teto, em bytes" \
			"export const MAIOR_CORPO_ACEITO = ${TETO_DE_CORPO_NO_SERVICO};" \
			"$(grep -E '^export const MAIOR_CORPO_ACEITO' "${COMPOSICAO_RAIZ}" | head -1 || true)"
	else
		aviso "${COMPOSICAO_RAIZ} não está legível — a coerência do teto de corpo NÃO foi verificada"
	fi

	# O caminho medido é o que a API de fato publica (T6) — senão esta bateria
	# mediria a borda contra uma ficção.
	if [[ -r "${CONTROLADOR_DA_NOTICIA}" ]]; then
		afirmar_igual "o controlador da T6 publica o caminho que esta bateria mede" \
			"export const CAMINHO_DAS_NOTIFICACOES_BANCARIAS = '${CAMINHO_DA_NOTICIA#/v1/}';" \
			"$(grep -E "^export const CAMINHO_DAS_NOTIFICACOES_BANCARIAS" "${CONTROLADOR_DA_NOTICIA}" | head -1 || true)"
	else
		aviso "${CONTROLADOR_DA_NOTICIA} não está legível — a coerência do caminho NÃO foi verificada"
	fi

	fechar_caso "CT-1005 (a)"
}

# =========================================================================== #
# CT-1005 (b) — a instalação é idempotente, e o gabarito meio substituído é
# recusado. Exercita as funções REAIS do instalador.
# =========================================================================== #
ct_1005_b() {
	caso "CT-1005 (b)" "a instalação é idempotente, recusa render quebrado ou implausível, confere a forma dos valores e desfaz a escrita não validada (funções reais do instalador)"

	local fn
	local -a funcoes_do_instalador=(
		renderizar_vhost vhost_diverge posicionar_vhost porta_da_api_na_unidade
		hostname_bem_formado caminho_bem_formado restaurar_destino
		vhost_declara_hostname conferir_precedencia_do_vhost
	)
	for fn in "${funcoes_do_instalador[@]}"; do
		if ! carregar_funcao_do_instalador "${fn}"; then
			falhar "(b) não consegui carregar '${fn}' de ${INSTALADOR} — sem ela a tabela ficaria sem SUT e passaria vazia"
			fechar_caso "CT-1005 (b)"
			return
		fi
	done
	if ! carregar_funcao_do_instalador_como limpar limpar_do_instalador; then
		falhar "(b) não consegui carregar 'limpar' de ${INSTALADOR} — sem ela o desfazimento na janela ficaria sem SUT"
		fechar_caso "CT-1005 (b)"
		return
	fi
	ok "(b) as $((${#funcoes_do_instalador[@]} + 1)) funções de instalação carregadas de ${INSTALADOR##*/}"

	local sonda="${DIR_TRABALHO}/sonda"
	mkdir -p "${sonda}" "${sonda}/acme"

	# --- renderização ---------------------------------------------------- #
	local hostname_de_sonda="borda-de-sonda"
	local rendido="${sonda}/rendido.conf"
	local codigo=0
	renderizar_vhost "${GABARITO}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" >"${rendido}" || codigo=$?

	afirmar_igual "a renderização do gabarito íntegro sai 0" "0" "${codigo}"
	afirmar_igual "nenhum marcador sobra no renderizado" "0" \
		"$(grep -cE '__[A-Z_]+__' "${rendido}" || true)"
	afirmar_igual "o renderizado escuta TLS na porta informada" "listen 443 ssl;" \
		"$(grep -oE 'listen 443 ssl;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado atende o hostname informado" "server_name ${hostname_de_sonda};" \
		"$(grep -oE "server_name ${hostname_de_sonda};" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado aponta para a API no laço local" "proxy_pass http://127.0.0.1:3000;" \
		"$(grep -oE 'proxy_pass http://127\.0\.0\.1:3000;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado casa o caminho por igualdade exata" "location = ${CAMINHO_DA_NOTICIA} {" \
		"$(grep -oE "location = ${CAMINHO_DA_NOTICIA} \{" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado fixa o piso de TLS" "ssl_protocols TLSv1.2 TLSv1.3;" \
		"$(grep -oE 'ssl_protocols TLSv1\.2 TLSv1\.3;' "${rendido}" | head -1 || true)"
	# Sem esta linha, um render que perdesse a raiz do desafio passaria: o vhost
	# continua válido para o nginx, e a RENOVAÇÃO do certificado é que morre —
	# meses depois, sem sintoma. A forma é a diretiva inteira, não a presença.
	afirmar_igual "o renderizado serve o desafio da raiz informada" "root ${sonda}/acme;" \
		"$(grep -oE "root ${sonda}/acme;" "${rendido}" | head -1 || true)"
	afirmar_igual "e o desafio NÃO é repassado ao serviço no render" "0" \
		"$(awk '/location \^~ /,/^\t\}/' "${rendido}" | grep -c 'proxy_pass' || true)"

	# NEGATIVO: gabarito com marcador que ninguém substitui é RECUSADO. Sem
	# isso, um marcador novo entraria em produção pela metade e o vhost
	# atenderia um hostname que ninguém escolheu.
	local gabarito_com_sobra="${sonda}/com-sobra.conf"
	{
		cat "${GABARITO}"
		printf '# %s\n' "__PORTA_QUE_NINGUEM_SUBSTITUI__"
	} >"${gabarito_com_sobra}"
	codigo=0
	renderizar_vhost "${gabarito_com_sobra}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" >/dev/null 2>"${sonda}/sobra.err" || codigo=$?
	afirmar_igual "gabarito com marcador remanescente é RECUSADO" "1" "${codigo}"
	afirmar_igual "a recusa nomeia o marcador que sobrou" "__PORTA_QUE_NINGUEM_SUBSTITUI__" \
		"$(grep -oE '__[A-Z_]+__' "${sonda}/sobra.err" | head -1 || true)"

	# NEGATIVO: valor de configuração que QUEBRA o `sed`. A renderização é
	# chamada em `… || abortar`, e o `||` suprime `errexit` e `trap ERR` na
	# extensão inteira dela — sem a conferência do status, o `sed` morto deixava
	# o renderizado VAZIO, o guarda de marcador remanescente passava por vacuidade
	# e a função devolvia 0. O vhost vazio atravessa `nginx -t`, e a borda saía
	# instalada sem atender. É o código 1 abaixo que discrimina: com o defeito de
	# volta ele é 0, e a saída tem o byte da quebra de linha em vez de nada.
	local rendido_quebrado="${sonda}/quebrado.conf"
	codigo=0
	renderizar_vhost "${GABARITO}" 'bor|da' "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" \
		>"${rendido_quebrado}" 2>"${sonda}/quebrado.err" || codigo=$?
	afirmar_igual "valor que quebra o 'sed' faz a renderização RECUSAR" "1" "${codigo}"
	afirmar_igual "e nada sai pela saída padrão quando ela recusa" "0" \
		"$(wc -c <"${rendido_quebrado}")"

	# NEGATIVO da outra metade do guarda: render que sai com status 0 e conteúdo
	# mutilado. O gabarito de sonda não tem marcador nenhum, logo o guarda de
	# marcador remanescente o aprova — o que o recusa é a PLAUSIBILIDADE, e é ela
	# que impede a classe de reabrir por uma falha futura que não se anuncie pelo
	# status.
	local gabarito_mutilado="${sonda}/mutilado.conf"
	printf '# gabarito sem servidor nenhum\n' >"${gabarito_mutilado}"
	codigo=0
	renderizar_vhost "${gabarito_mutilado}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" \
		>/dev/null 2>"${sonda}/mutilado.err" || codigo=$?
	afirmar_igual "render sem 'server {' é RECUSADO ainda que o 'sed' tenha saído 0" "1" "${codigo}"
	afirmar_igual "a recusa diz que o render é implausível" "vhost renderizado implausível:" \
		"$(grep -oE 'vhost renderizado implausível:' "${sonda}/mutilado.err" | head -1 || true)"

	# --- forma dos valores que viram DIRETIVA do nginx -------------------- #
	# O hostname e os caminhos do certificado são interpolados no gabarito e
	# viram configuração. Um `;` publica duas diretivas onde deveria haver uma;
	# um espaço faz o vhost atender um nome que ninguém escolheu.
	# O valor aceito com mais de um rótulo é COMPOSTO a partir de fragmentos,
	# pela mesma razão das agulhas da prova de falsificação: escrito por extenso,
	# o CT-1005 (a) acusaria ESTE arquivo de fixar um hostname — e acusou, na
	# primeira escrita deste bloco. A âncora do (a) funcionando é o que garante
	# que o I4 não depende de ninguém lembrar dele.
	local valor multirrotulo
	multirrotulo="$(printf '%s.%s.%s' 'borda' 'exemplo' 'br')"
	for valor in "${multirrotulo}" 'borda-de-sonda' 'a1'; do
		afirmar_igual "hostname bem formado é ACEITO: [${valor}]" "0" \
			"$(hostname_bem_formado "${valor}" && echo 0 || echo 1)"
	done
	for valor in 'x; add_header X-Injetado 1' 'a b' 'bor|da' '-comeca-com-hifen' '' 'aspas"'; do
		afirmar_igual "hostname malformado é RECUSADO: [${valor}]" "1" \
			"$(hostname_bem_formado "${valor}" && echo 0 || echo 1)"
	done
	afirmar_igual "caminho absoluto de certificado é ACEITO" "0" \
		"$(caminho_bem_formado '/etc/nginx/ssl-certificates/borda.crt' && echo 0 || echo 1)"
	for valor in '/etc/a b.crt' '/etc/a;x.crt' '/etc/a|b.crt' 'relativo.crt' ''; do
		afirmar_igual "caminho malformado é RECUSADO: [${valor}]" "1" \
			"$(caminho_bem_formado "${valor}" && echo 0 || echo 1)"
	done

	# --- desfazimento na janela entre a escrita e a validação global ------ #
	# O P03 escreve o vhost e o P04 é quem o confronta com os demais. Enquanto a
	# limpeza apenas apagava o temporário, um término nessa janela (INT, TERM,
	# HUP, erro inesperado) deixava o vhost novo instalado E o backup destruído:
	# o `reload` seguinte — o do operador do legado, ou o do boot — carregaria
	# configuração cujo conflito global nunca foi testado.
	local vhosts_janela="${sonda}/vhosts-janela"
	local temporario_janela="${sonda}/temporario-janela"
	local destino_janela="${vhosts_janela}/${GABARITO##*/}"
	local anterior='vhost anterior, o que a borda ja carregava'
	mkdir -p "${vhosts_janela}" "${temporario_janela}"
	printf '%s\n' "${anterior}" >"${destino_janela}"
	cp -p "${destino_janela}" "${temporario_janela}/anterior.conf"
	printf 'vhost novo, ainda NAO confrontado com os demais vhosts\n' >"${destino_janela}"

	(
		erro() { :; }
		DIR_TEMPORARIO="${temporario_janela}"
		DIR_DOS_VHOSTS="${vhosts_janela}"
		NOME_DO_VHOST="${GABARITO##*/}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${temporario_janela}/anterior.conf"
		DESTINO_TINHA_ARQUIVO="sim"
		ESCRITA_PENDENTE="sim"
		limpar_do_instalador
	) >/dev/null 2>&1 || true

	afirmar_igual "com a janela ABERTA, a limpeza restaura o vhost anterior" \
		"${anterior}" "$(cat "${destino_janela}")"
	afirmar_igual "e só então remove o temporário que guardava o backup" "1" \
		"$([[ -d "${temporario_janela}" ]] && echo 0 || echo 1)"

	# COMPANHEIRO que discrimina: janela FECHADA (o P04 aprovou) é saída normal,
	# e a limpeza não pode desfazer o que acabou de ser validado. Sem este caso,
	# uma limpeza que restaurasse SEMPRE passaria no positivo acima.
	mkdir -p "${temporario_janela}"
	printf 'conteudo antigo que NAO deve voltar\n' >"${temporario_janela}/anterior.conf"
	printf 'vhost novo, ja aprovado pelo P04\n' >"${destino_janela}"
	(
		erro() { :; }
		DIR_TEMPORARIO="${temporario_janela}"
		DIR_DOS_VHOSTS="${vhosts_janela}"
		NOME_DO_VHOST="${GABARITO##*/}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${temporario_janela}/anterior.conf"
		DESTINO_TINHA_ARQUIVO="sim"
		ESCRITA_PENDENTE="nao"
		limpar_do_instalador
	) >/dev/null 2>&1 || true

	afirmar_igual "com a janela FECHADA, a limpeza NÃO toca o vhost instalado" \
		"vhost novo, ja aprovado pelo P04" "$(cat "${destino_janela}")"

	# --- decisão de idempotência ----------------------------------------- #
	local destino="${sonda}/vhosts/sysloc-notificacao-bancaria.conf"
	mkdir -p "${sonda}/vhosts"

	afirmar_igual "destino ausente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"

	# --- efeito: primeira execução escreve, segunda não toca -------------- #
	afirmar_igual "a primeira instalação escreve" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o destino ficou com o conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"
	afirmar_igual "o destino ficou com o modo declarado" "644" "$(stat -c '%a' "${destino}")"

	local carimbo_antes carimbo_depois
	carimbo_antes="$(stat -c '%Y %Z %s' "${destino}")"
	afirmar_igual "destino idêntico NÃO diverge" "1" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a segunda instalação NÃO escreve" "JA-OK" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	carimbo_depois="$(stat -c '%Y %Z %s' "${destino}")"
	afirmar_igual "o arquivo não foi reescrito na segunda execução" "${carimbo_antes}" "${carimbo_depois}"

	# --- divergência por modo e por conteúdo ------------------------------ #
	chmod 0600 "${destino}"
	afirmar_igual "modo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a instalação corrige o modo" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o modo voltou ao declarado" "644" "$(stat -c '%a' "${destino}")"

	printf '# alteração feita na cópia instalada\n' >>"${destino}"
	afirmar_igual "conteúdo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a instalação restaura o conteúdo versionado" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o destino voltou ao conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"

	# --- a porta da API é derivada da unidade versionada ------------------ #
	local unidade="${RAIZ_REPO}/deploy/systemd/sysloc-api.service"
	if [[ -r "${unidade}" ]]; then
		afirmar_igual "a porta da API é derivada da unidade versionada" \
			"$(sed -n 's|^Environment=PORT=\([0-9]\{1,\}\)$|\1|p' "${unidade}" | head -1)" \
			"$(porta_da_api_na_unidade "${unidade}")"
	else
		aviso "${unidade} não está legível — a derivação da porta NÃO foi verificada"
	fi

	# ------------------------------------------------------------------- #
	# A DISPUTA DE `server_name` — perder é invisível, e é o que esta tabela
	# impede. O servidor fica com o primeiro vhost que carrega (ordem
	# lexicográfica do `include`) e ignora o outro com um aviso que ninguém lê:
	# o `nginx -t` passa, o serviço sobe, e o provedor deixa de ser atendido.
	# ------------------------------------------------------------------- #
	local arena="${sonda}/arena"
	local alvo_da_disputa="borda-em-disputa"
	local nosso="000-sysloc-notificacao-bancaria.conf"
	mkdir -p "${arena}"

	# ANTIVÁCUO primeiro: diretório onde NINGUÉM declara o hostname precisa
	# REPROVAR. Sem esta asserção, a conferência que nunca acha nada aprovaria o
	# caso em que o vhost sequer foi escrito.
	printf 'server {\n\tserver_name outro-nome-qualquer;\n}\n' >"${arena}/500-alheio.conf"
	afirmar_igual "sem NENHUM declarante, a precedência REPROVA (antivácuo)" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"

	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/${nosso}"
	afirmar_igual "sozinho no diretório, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e a lista devolvida é exatamente ele" "${nosso}" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" || true)"

	# Rival que ordena DEPOIS: vencemos, e ele aparece na lista — é o que faz o
	# instalador poder NOMEAR quem está sendo ignorado.
	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/zz-rival.conf"
	afirmar_igual "com rival que ordena DEPOIS, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e a lista nomeia os dois, na ordem de carga" "${nosso} zz-rival.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" | tr '\n' ' ' | sed 's/ $//' || true)"

	# Rival que ordena ANTES: é o defeito que esta conferência existe para pegar.
	# Sem ela, a instalação seguiria e a borda seria ignorada em silêncio.
	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/000-antes.conf"
	afirmar_igual "com rival que ordena ANTES, a precedência REPROVA" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e o primeiro da lista é o rival, não o nosso" "000-antes.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" | head -1 || true)"

	# A declaração é por TOKEN. Sem isto, `server_name a.borda-em-disputa;` seria
	# lido como declaração de `borda-em-disputa` e a conferência acusaria rival
	# onde não há — ou pior, deixaria de acusar onde há.
	printf 'server {\n\tserver_name sub.%s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token.conf"
	afirmar_igual "'server_name sub.X' NÃO declara X (comparação por token)" "1" \
		"$(vhost_declara_hostname "${sonda}/token.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"
	printf 'server {\n\tserver_name outro %s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token2.conf"
	afirmar_igual "'server_name outro X' DECLARA X (lista de nomes)" "0" \
		"$(vhost_declara_hostname "${sonda}/token2.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"

	fechar_caso "CT-1005 (b)"
}

# =========================================================================== #
# CT-1005 (c) — a medição de rede contra a borda EFÊMERA.
# =========================================================================== #
requisicoes_no_servico() {
	local trilha="${PREFIXO_DA_BORDA}/trilha.log"
	[[ -f "${trilha}" ]] || {
		printf '0'
		return 0
	}
	# `grep -c` imprime `0` E devolve status 1 quando não acha nada: um
	# `|| printf '0'` aqui imprimiria DOIS zeros, e a contagem viraria texto
	# inaritmético logo na primeira comparação.
	local contagem
	contagem="$(grep -c . "${trilha}" 2>/dev/null || true)"
	printf '%s' "${contagem:-0}"
}

# Faz UMA requisição pela borda efêmera e imprime `codigo|origem|location`.
# `000` é o que o curl reporta quando não houve resposta HTTP.
requisitar() {
	local metodo="$1" url="$2"
	local cabecalhos="${DIR_TRABALHO}/cabecalhos.txt"
	local codigo=""
	: >"${cabecalhos}"

	local argumentos=(-sS --max-time 10 -o /dev/null -D "${cabecalhos}" -w '%{http_code}'
		--cacert "${PREFIXO_DA_BORDA}/cert.pem"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTP}:127.0.0.1"
		-X "${metodo}")
	if [[ "${metodo}" == "POST" ]]; then
		argumentos+=(-H 'Content-Type: application/json' --data-binary '{"idempotencia":"verificacao"}')
	fi

	codigo="$(curl "${argumentos[@]}" "${url}" 2>>"${DIR_TRABALHO}/curl.err" || printf '000')"

	printf '%s|%s|%s' "${codigo}" \
		"$(grep -i "^${CABECALHO_DO_SERVICO}:" "${cabecalhos}" | tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' | head -1)" \
		"$(grep -i '^location:' "${cabecalhos}" | tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' | head -1)"
}

subir_borda_efemera() {
	PREFIXO_DA_BORDA="${DIR_TRABALHO}/borda"
	mkdir -p "${PREFIXO_DA_BORDA}/logs" "${PREFIXO_DA_BORDA}/temp"

	# O desafio de posse do domínio, plantado como o emissor do certificado o
	# planta: um arquivo de conteúdo conhecido sob `.well-known/acme-challenge/`
	# do webroot. O conteúdo é AFIRMADO POR IGUALDADE na medição — servir o
	# arquivo errado, ou servir vazio, reprova.
	RAIZ_DO_DESAFIO_EFEMERA="${PREFIXO_DA_BORDA}/acme"
	TOKEN_DO_DESAFIO="token-de-sonda-$$"
	CONTEUDO_DO_DESAFIO="prova-de-posse-${$}-$(date +%s 2>/dev/null || printf 'sem-relogio')"
	mkdir -p "${RAIZ_DO_DESAFIO_EFEMERA}/.well-known/acme-challenge"
	printf '%s' "${CONTEUDO_DO_DESAFIO}" \
		>"${RAIZ_DO_DESAFIO_EFEMERA}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}"

	# Guarda de sanidade: esta bateria só escreve dentro de um diretório
	# descartável. Se o prefixo escorregar para fora dele, ela para.
	case "${PREFIXO_DA_BORDA}" in
	/tmp/* | /var/tmp/*) : ;;
	*)
		falhar "(c) o prefixo da borda efêmera (${PREFIXO_DA_BORDA}) não está num diretório descartável"
		return 1
		;;
	esac

	HOSTNAME_EFEMERO="borda-efemera-$$"
	PORTA_HTTPS="$(porta_livre)"
	PORTA_HTTP="$(porta_livre)"

	openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
		-keyout "${PREFIXO_DA_BORDA}/chave.pem" -out "${PREFIXO_DA_BORDA}/cert.pem" \
		-subj "/CN=${HOSTNAME_EFEMERO}" \
		-addext "subjectAltName=DNS:${HOSTNAME_EFEMERO}" >/dev/null 2>&1

	# O serviço de verificação que fica ATRÁS da borda. Ele não é a API: o que
	# está sob prova aqui é o vhost, e o que se precisa do lado de dentro é uma
	# trilha do que atravessou — que é justamente o que a API não daria.
	cat >"${PREFIXO_DA_BORDA}/servico.mjs" <<'SERVICO'
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const [, , porta, trilha, cabecalho, origem] = process.argv;

createServer((requisicao, resposta) => {
  appendFileSync(trilha, `${requisicao.method} ${requisicao.url}\n`);
  resposta.writeHead(204, { [cabecalho]: origem });
  resposta.end();
}).listen(Number(porta), '127.0.0.1');
SERVICO

	local porta_do_servico
	porta_do_servico="$(porta_livre)"
	: >"${PREFIXO_DA_BORDA}/trilha.log"
	node "${PREFIXO_DA_BORDA}/servico.mjs" "${porta_do_servico}" \
		"${PREFIXO_DA_BORDA}/trilha.log" "${CABECALHO_DO_SERVICO}" "${ORIGEM_DO_SERVICO}" \
		>"${PREFIXO_DA_BORDA}/servico.log" 2>&1 &
	PID_DO_SERVICO=$!

	# O vhost sob prova é o VERSIONADO, renderizado pelo renderizador REAL do
	# instalador. Reescrevê-lo aqui mediria uma cópia.
	#
	# ⚠️ As portas vão PREFIXADAS pelo endereço de laço local — fecho do
	# `D29 · F4/T11` (fatia `webhook-e-carne`), em 2026-08-19. Passando só o
	# número, o gabarito rende `listen <porta> ssl;` sem endereço e o nginx liga
	# `0.0.0.0`: a bateria que a ADR-0006 obriga a rodar ISOLADA abria superfície
	# de rede num host onde `/opt/frappe` opera. `listen 127.0.0.1:36011 ssl;` é
	# sintaxe válida, o `--resolve` de toda a bateria já aponta para 127.0.0.1, e
	# NADA muda no gabarito versionado nem na borda de produção — lá se continua
	# passando "443" e "80", sem endereço.
	renderizar_vhost "${GABARITO}" "${HOSTNAME_EFEMERO}" "127.0.0.1:${PORTA_HTTPS}" "127.0.0.1:${PORTA_HTTP}" \
		"${PREFIXO_DA_BORDA}/cert.pem" "${PREFIXO_DA_BORDA}/chave.pem" \
		"127.0.0.1:${porta_do_servico}" "${RAIZ_DO_DESAFIO_EFEMERA}" >"${PREFIXO_DA_BORDA}/vhost.conf" || return 1

	# Guarda de sanidade do isolamento, e ela é do ARQUIVO RENDIDO, não da
	# chamada acima: qualquer forma futura de montar a borda que volte a omitir o
	# endereço reprova aqui, e não só esta linha. Igualdade de conjunto sobre as
	# diretivas `listen`, com controle antivácuo — sem ele, um vhost sem `listen`
	# nenhum passaria por "não escuta fora do laço".
	local escutas
	escutas="$(grep -cE '^[[:space:]]*listen[[:space:]]+127\.0\.0\.1:[0-9]+' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	local escutas_totais
	escutas_totais="$(grep -cE '^[[:space:]]*listen[[:space:]]' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	if [[ "${escutas_totais}" -eq 0 ]]; then
		falhar "(c) o vhost efêmero não declara 'listen' nenhum — a guarda de isolamento mediria o vácuo"
		return 1
	fi
	if [[ "${escutas}" -ne "${escutas_totais}" ]]; then
		falhar "(c) o vhost efêmero escuta fora do laço local: ${escutas}/${escutas_totais} diretivas 'listen' em 127.0.0.1"
		return 1
	fi

	cat >"${PREFIXO_DA_BORDA}/nginx.conf" <<CONF
worker_processes 1;
pid ${PREFIXO_DA_BORDA}/nginx.pid;
error_log ${PREFIXO_DA_BORDA}/logs/error.log warn;
events { worker_connections 64; }
http {
  access_log ${PREFIXO_DA_BORDA}/logs/access.log;
  client_body_temp_path ${PREFIXO_DA_BORDA}/temp/client;
  proxy_temp_path ${PREFIXO_DA_BORDA}/temp/proxy;
  fastcgi_temp_path ${PREFIXO_DA_BORDA}/temp/fastcgi;
  uwsgi_temp_path ${PREFIXO_DA_BORDA}/temp/uwsgi;
  scgi_temp_path ${PREFIXO_DA_BORDA}/temp/scgi;
  include ${PREFIXO_DA_BORDA}/vhost.conf;
}
CONF

	nginx -c "${PREFIXO_DA_BORDA}/nginx.conf" -p "${PREFIXO_DA_BORDA}" \
		-e "${PREFIXO_DA_BORDA}/logs/error.log" >"${PREFIXO_DA_BORDA}/nginx.out" 2>&1 &

	# Sondagem com limite nomeado — nunca espera fixa.
	local limite=50 tentativa=0
	while [[ "${tentativa}" -lt "${limite}" ]]; do
		if [[ -s "${PREFIXO_DA_BORDA}/nginx.pid" ]] &&
			curl -sS --max-time 2 --cacert "${PREFIXO_DA_BORDA}/cert.pem" \
				--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
				-o /dev/null "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/" >/dev/null 2>&1; then
			return 0
		fi
		tentativa=$((tentativa + 1))
		sleep 0.2
	done

	return 1
}

ct_1005_c() {
	caso "CT-1005 (c)" "a borda publica exatamente um caminho, e a recusa é dela — medido por rede"

	local ferramenta faltando=()
	for ferramenta in nginx curl openssl node; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		aviso "ferramenta ausente no host: ${faltando[*]} — a MEDIÇÃO DE REDE não foi feita (é a asserção central do CT-1005)"
		fechar_caso "CT-1005 (c)"
		return
	fi

	if ! carregar_funcao_do_instalador renderizar_vhost; then
		falhar "(c) não consegui carregar 'renderizar_vhost' — a borda efêmera mediria uma cópia do vhost, não o versionado"
		fechar_caso "CT-1005 (c)"
		return
	fi

	if ! subir_borda_efemera; then
		falhar "(c) a borda efêmera não subiu — ver ${PREFIXO_DA_BORDA}/logs/error.log"
		[[ -f "${PREFIXO_DA_BORDA}/logs/error.log" ]] && tail -5 "${PREFIXO_DA_BORDA}/logs/error.log" >&2
		fechar_caso "CT-1005 (c)"
		return
	fi
	ok "(c) borda efêmera de pé: TLS em ${PORTA_HTTPS}, claro em ${PORTA_HTTP}, serviço em 127.0.0.1"

	# --- passo 1: o caminho da notícia alcança o serviço ------------------ #
	# É também o CONTROLE ANTIVÁCUO dos passos seguintes: sem ele, uma borda que
	# recusasse TUDO passaria em todas as outras asserções deste caso.
	local antes depois medida
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}")"
	depois="$(requisicoes_no_servico)"

	afirmar_igual "o caminho da notícia responde por TLS" "204|${ORIGEM_DO_SERVICO}|" "${medida}"
	afirmar_igual "a resposta veio do serviço, e não da borda" "$((antes + 1))" "${depois}"
	afirmar_igual "o serviço recebeu o método e o caminho inteiros" "POST ${CAMINHO_DA_NOTICIA}" \
		"$(tail -1 "${PREFIXO_DA_BORDA}/trilha.log")"

	# --- passo 2: nenhum outro caminho atravessa -------------------------- #
	local caminho
	for caminho in "${CAMINHOS_RECUSADOS[@]}"; do
		antes="$(requisicoes_no_servico)"
		medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "POST ${caminho} é recusado com 404, sem cabeçalho do serviço" "404||" "${medida}"
		afirmar_igual "POST ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"

		antes="$(requisicoes_no_servico)"
		medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "GET ${caminho} é recusado com 404, sem cabeçalho do serviço" "404||" "${medida}"
		afirmar_igual "GET ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"
	done

	# --- passo 3: em claro não há 3xx ------------------------------------- #
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}${CAMINHO_DA_NOTICIA}")"
	depois="$(requisicoes_no_servico)"

	afirmar_igual "em claro, o caminho da notícia é recusado SEM redirecionamento e sem Location" "404||" "${medida}"
	afirmar_diferente "a resposta em claro não é 3xx" "3" "${medida:0:1}"
	afirmar_igual "a requisição em claro NÃO foi repassada ao serviço" "${antes}" "${depois}"

	antes="$(requisicoes_no_servico)"
	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/docs")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "em claro, /docs também morre na borda" "404||" "${medida}"
	afirmar_igual "GET /docs em claro NÃO foi repassado ao serviço" "${antes}" "${depois}"

	# --- passo 3-B: o desafio de posse do domínio, e o contorno dele ------ #
	# A ÚNICA exceção ao 404 do bloco em claro. Ela existe porque esta borda
	# vence a disputa de `server_name` da porta 80 do hostname que atende — sem
	# ela o desafio morre no 404 e a RENOVAÇÃO do certificado falha, em silêncio,
	# meses depois de instalada. As cinco asserções medem a exceção E o contorno:
	# servir o desafio não pode ter aberto nada além do desafio.
	local corpo_do_desafio
	antes="$(requisicoes_no_servico)"
	corpo_do_desafio="$(curl -sS --max-time 10 \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTP}:127.0.0.1" \
		"http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}" \
		2>/dev/null || printf 'NAO-RESPONDEU')"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "o desafio em claro é SERVIDO, com o conteúdo exato do arquivo plantado" \
		"${CONTEUDO_DO_DESAFIO}" "${corpo_do_desafio}"
	afirmar_igual "e o desafio NÃO foi repassado ao serviço" "${antes}" "${depois}"

	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/acme-challenge/nao-plantado")"
	afirmar_igual "desafio inexistente continua 404 — a exceção serve arquivo, não árvore" "404||" "${medida}"

	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}")"
	afirmar_igual "sob TLS o MESMO desafio é 404 — a exceção é só do bloco em claro" "404||" "${medida}"

	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/outra-coisa")"
	afirmar_igual "em claro, /.well-known de OUTRA coisa continua 404 — o prefixo é ancorado" "404||" "${medida}"

	# --- piso de TLS ------------------------------------------------------ #
	local codigo_tls
	codigo_tls="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' --tlsv1.2 --tls-max 1.2 \
		--cacert "${PREFIXO_DA_BORDA}/cert.pem" \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
		-X POST -H 'Content-Type: application/json' --data-binary '{}' \
		"https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" 2>/dev/null || printf '000')"
	afirmar_igual "TLS 1.2 é aceito no caminho da notícia" "204" "${codigo_tls}"

	codigo_tls="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' --tlsv1.3 \
		--cacert "${PREFIXO_DA_BORDA}/cert.pem" \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
		-X POST -H 'Content-Type: application/json' --data-binary '{}' \
		"https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" 2>/dev/null || printf '000')"
	afirmar_igual "TLS 1.3 é aceito no caminho da notícia" "204" "${codigo_tls}"
	nota "a RECUSA de TLS 1.0/1.1 não é medida aqui de propósito: o cliente deste host não os fala, e uma asserção que não pode falhar pelo defeito que persegue é vácuo. O piso vem do 'ssl_protocols' renderizado, conferido no CT-1005 (b)"

	# --- o total do que atravessou --------------------------------------- #
	# A conta fecha o caso: 3 requisições legítimas (a do passo 1 e as duas do
	# piso de TLS), e nenhuma outra.
	afirmar_igual "ao todo, só o caminho da notícia atravessou a borda" "3" "$(requisicoes_no_servico)"
	afirmar_igual "e tudo que atravessou foi para o caminho da notícia" "3" \
		"$(grep -c " ${CAMINHO_DA_NOTICIA}\$" "${PREFIXO_DA_BORDA}/trilha.log" || true)"

	fechar_caso "CT-1005 (c)"
}

# =========================================================================== #
# CT-1005 (d) — a configuração que atende a operação não foi tocada.
# =========================================================================== #
retrato_do_legado() {
	local destino="$1"
	find "${DIR_DO_LEGADO}" -maxdepth 3 -type f \
		\( -name '*.conf' -o -name 'docker-compose*.y*ml' \) -readable \
		-exec sha256sum {} + 2>/dev/null | sort >"${destino}" || true
}

retrato_dos_processos_da_borda() {
	local destino="$1"
	pgrep -a nginx 2>/dev/null | sort >"${destino}" || true
}

ct_1005_d() {
	caso "CT-1005 (d)" "a configuração que atende a operação não foi tocada, nem o servidor de borda recarregado"

	if [[ ! -d "${DIR_DO_LEGADO}" ]]; then
		aviso "${DIR_DO_LEGADO} não existe neste host — a intocabilidade do legado NÃO foi verificada"
		fechar_caso "CT-1005 (d)"
		return
	fi

	local pos="${DIR_TRABALHO}/legado-depois.txt"
	retrato_do_legado "${pos}"

	# ÂNCORA ANTIVÁCUO: dois retratos VAZIOS são idênticos, e a comparação
	# aprovaria por não ter olhado para nada.
	local medidos
	medidos="$(grep -c . "${DIR_TRABALHO}/legado-antes.txt" || true)"
	if [[ "${medidos}" -eq 0 ]]; then
		falhar "o retrato do legado não mediu arquivo nenhum — a comparação abaixo seria vácuo"
		fechar_caso "CT-1005 (d)"
		return
	fi
	ok "o retrato do legado mediu ${medidos} arquivo(s) de configuração"

	afirmar_igual "a configuração do legado continua byte a byte igual" "" \
		"$(diff "${DIR_TRABALHO}/legado-antes.txt" "${pos}" || true)"

	# Recarregar o servidor de borda troca os processos de trabalho. Comparar a
	# lista inteira é o que separa "não escrevi nada" de "não mexi em nada".
	if command -v pgrep >/dev/null 2>&1; then
		local processos_depois="${DIR_TRABALHO}/processos-depois.txt"
		# A borda efêmera desta bateria é derrubada ANTES da comparação: ela é
		# nginx também, e apareceria como diferença legítima.
		encerrar_borda_efemera
		local limite=25 tentativa=0
		while [[ "${tentativa}" -lt "${limite}" ]] && pgrep -f "${DIR_TRABALHO}" >/dev/null 2>&1; do
			tentativa=$((tentativa + 1))
			sleep 0.2
		done
		retrato_dos_processos_da_borda "${processos_depois}"

		local processos_medidos
		processos_medidos="$(grep -c . "${DIR_TRABALHO}/processos-antes.txt" || true)"
		if [[ "${processos_medidos}" -eq 0 ]]; then
			aviso "nenhum processo de servidor de borda visível a este usuário — a não-recarga NÃO foi verificada"
		else
			ok "o retrato viu ${processos_medidos} processo(s) do servidor de borda"
			afirmar_igual "nenhum processo do servidor de borda foi trocado (sem recarga)" "" \
				"$(diff "${DIR_TRABALHO}/processos-antes.txt" "${processos_depois}" || true)"
		fi
	else
		aviso "pgrep ausente no host — a não-recarga do servidor de borda NÃO foi verificada"
	fi

	# O instalador não nomeia caminho nenhum do legado: ele escreve UM arquivo
	# com nome próprio, e nada mais.
	# Em COMENTÁRIO ele é nomeado de propósito, e isso é conteúdo: o cabeçalho do
	# instalador declara que o legado segue de pé e que nada dele é tocado. O que
	# não pode existir é linha ATIVA que o alcance.
	afirmar_igual "o instalador não nomeia o diretório do legado em linha ativa" "0" \
		"$(grep -vE '^[[:space:]]*#' "${INSTALADOR}" | grep -c "${DIR_DO_LEGADO}" || true)"

	fechar_caso "CT-1005 (d)"
}

main() {
	printf 'Borda externa da notícia bancária — %s\n' "${RAIZ_REPO}"
	nota "a medição de rede acontece contra uma borda EFÊMERA e isolada (ADR-0006); a instalação na borda real é o passo 1 do rollout, ato do operador"

	# Os retratos do que atende a operação são tirados ANTES de qualquer coisa
	# que este script faça — é o único instante em que eles significam algo.
	retrato_do_legado "${DIR_TRABALHO}/legado-antes.txt"
	retrato_dos_processos_da_borda "${DIR_TRABALHO}/processos-antes.txt"

	ct_1005_a
	ct_1005_b
	ct_1005_c
	ct_1005_d

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-notificacao-bancaria: 4/4 frentes aprovadas (CT-1005 a, b, c, d)\n'
		else
			printf 'verificar-notificacao-bancaria: 4/4 frentes sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${avisos_totais}"
		fi
		exit 0
	fi

	printf 'verificar-notificacao-bancaria: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
