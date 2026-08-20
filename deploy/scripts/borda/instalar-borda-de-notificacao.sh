#!/usr/bin/env bash
#
# Instalação da borda externa da notícia bancária — T11 da fatia
# `webhook-e-carne`.
#
# Posiciona no servidor de borda o vhost versionado em
# `deploy/nginx/sysloc-notificacao-bancaria.conf`, que publica UM caminho para
# fora — `/v1/notificacoes-bancarias`, a entrada de fato de terceiro da
# ADR-0035 — e recusa todo o resto na própria borda.
#
# ADR-0005 — rotina operacional versionada no repositório e posicionada por
# procedimento IDEMPOTENTE. Executar este script duas vezes seguidas termina com
# sucesso nas duas e não produz efeito adicional: vhost já idêntico não é
# reescrito e, o que mais dói numa borda compartilhada, O SERVIDOR NÃO É
# RECARREGADO quando nada mudou. Cada passo imprime `CRIADO` (mudou algo) ou
# `JA-OK` (já estava correto), para que a segunda execução seja auditável linha
# a linha.
#
# ADR-0005, condição de entrada — NENHUMA credencial passa por aqui. Este script
# não lê, não grava e não transporta segredo: o material do certificado fica
# onde o servidor de borda o administra, e o que entra no vhost é o CAMINHO
# dele.
#
# ---------------------------------------------------------------------------
# ⚠️ ESTE SCRIPT NÃO TOCA O QUE ATENDE A OPERAÇÃO
# ---------------------------------------------------------------------------
#
# O `/opt/frappe` segue de pé até a F7, e a borda é estado COMPARTILHADO com
# ele. Este procedimento escreve UM arquivo novo, com nome próprio, num
# diretório de vhosts que ele confere estar incluído pela configuração do
# servidor — e não altera, não move e não remove configuração de mais ninguém.
# O `CT-1005 (d)` afirma isso por medição, comparando a configuração do legado
# antes e depois.
#
# ---------------------------------------------------------------------------
# O HOSTNAME VEM DE CONFIGURAÇÃO — nunca daqui
# ---------------------------------------------------------------------------
#
# Qual hostname público atende a notícia é decisão OPERACIONAL do usuário, e
# continua aberta. Fixá-la no repositório seria decidi-la por ele, e é por isso
# que nem o gabarito nem este script nem o verificador carregam nome de domínio
# literal — o `CT-1005 (a)` varre os três com controle positivo.
#
# Origem dos valores, em ordem de precedência:
#
#   1. variável de ambiente na invocação (sobreposição consciente do operador)
#   2. `/etc/sysloc/backend.env`, 0600 e dono root, fora da árvore versionada
#
#   SYSLOC_HOSTNAME_DA_NOTIFICACAO   → chave HOSTNAME_DA_NOTIFICACAO_BANCARIA
#   SYSLOC_CERTIFICADO_DA_BORDA      → chave CERTIFICADO_DA_BORDA
#   SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA → chave CHAVE_DO_CERTIFICADO_DA_BORDA
#   SYSLOC_DIR_DOS_VHOSTS            → diretório de vhosts do servidor de borda
#
# Sem hostname em nenhuma das duas origens, o script ABORTA dizendo o que fazer.
# Instalar com um hostname adivinhado publicaria o produto num nome que ninguém
# escolheu.
#
# ---------------------------------------------------------------------------
# Ordem dos passos, e por que ela é esta
# ---------------------------------------------------------------------------
#
#   1. confere pré-condições — nada escreve;
#   2. renderiza o gabarito num diretório temporário e o valida com o próprio
#      nginx, num prefixo efêmero: gabarito inválido é apanhado ANTES de
#      encostar em /etc;
#   3. guarda o conteúdo anterior do destino (se houver) e posiciona o vhost;
#   4. valida a configuração INTEIRA do servidor (`nginx -t`) — é o único ponto
#      capaz de apanhar conflito com o que já está instalado. Se ela reprovar,
#      o estado anterior é RESTAURADO e o script aborta: a borda que atende a
#      operação não pode ficar com configuração que não carrega;
#   5. recarrega o servidor SOMENTE se o passo 3 mudou alguma coisa.
#
# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
#
#   sudo SYSLOC_HOSTNAME_DA_NOTIFICACAO=<hostname> \
#     bash deploy/scripts/borda/instalar-borda-de-notificacao.sh
#
# Verificação correspondente:
#
#   bash deploy/scripts/borda/verificar-notificacao-bancaria.sh
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly PREFIXO="[instalar-borda]"

# --------------------------------------------------------------------------- #
# Constantes. O verificador confere que estes valores continuam declarados aqui
# nesta forma — mudá-los sem atualizar a bateria reprova a bateria, que é
# exatamente a proteção contra divergência silenciosa.
# --------------------------------------------------------------------------- #
readonly GABARITO="${RAIZ_REPO}/deploy/nginx/sysloc-notificacao-bancaria.conf"
readonly NOME_DO_VHOST="sysloc-notificacao-bancaria.conf"
readonly MODO_DO_VHOST="0644"

# Arquivo de configuração do produto no host, gravado por `provisionar-base.sh`
# com 0600 e dono root. Espelhado aqui de propósito: este procedimento precisa
# saber o valor sem herdá-lo do outro script, senão os dois erram juntos.
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"

readonly CHAVE_HOSTNAME="HOSTNAME_DA_NOTIFICACAO_BANCARIA"
readonly CHAVE_CERTIFICADO="CERTIFICADO_DA_BORDA"
readonly CHAVE_DA_CHAVE_DO_CERTIFICADO="CHAVE_DO_CERTIFICADO_DA_BORDA"

# Diretório de vhosts do servidor de borda. É CONFERIDO contra os `include` da
# configuração do servidor antes de qualquer escrita — instalar num diretório
# que o nginx não lê produz um vhost que existe e não atende, que é o modo de
# falha mais caro de diagnosticar.
readonly DIR_DOS_VHOSTS_PADRAO="/etc/nginx/conf.d"
readonly CONFIGURACAO_DO_SERVIDOR="/etc/nginx/nginx.conf"

# Layout em que o servidor de borda desta máquina administra o material do
# certificado. É só o PADRÃO: o caminho real vem de configuração, e a existência
# dos dois arquivos é pré-condição.
readonly DIR_DOS_CERTIFICADOS_PADRAO="/etc/nginx/ssl-certificates"

# A API não escuta fora do laço local (`ENDERECO_DE_ESCUTA` em
# `apps/api/src/configuracao/ambiente.ts`), e a porta é DERIVADA da unidade
# versionada — escrevê-la aqui de novo criaria duas verdades sobre a mesma
# coisa.
readonly ENDERECO_DE_ESCUTA_DA_API="127.0.0.1"
readonly UNIDADE_DA_API="${RAIZ_REPO}/deploy/systemd/sysloc-api.service"

# Portas da borda real. Ficam declaradas porque o gabarito é parametrizado — o
# que se instala é sempre TLS na 443 e a recusa em claro na 80.
readonly PORTA_HTTPS_PADRAO="443"
readonly PORTA_HTTP_PADRAO="80"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
BACKUP_DO_DESTINO=""
DESTINO_TINHA_ARQUIVO="nao"

# A JANELA em que o destino já foi escrito e a configuração INTEIRA ainda não
# foi validada. Ligada no P03 logo após a escrita, desligada no P04 quando o
# `nginx -t` global aprova. É o que `limpar` consulta para desfazer.
ESCRITA_PENDENTE="nao"
total_criado=0
total_ja_ok=0

# --------------------------------------------------------------------------- #
# Saída legível. Duas marcações estáveis, e só duas — a convenção de
# `instalar-unidades.sh`.
# --------------------------------------------------------------------------- #
info() { printf '%s ..     %s\n' "${PREFIXO}" "$*"; }

criado() {
	total_criado=$((total_criado + 1))
	printf '%s CRIADO %s %s\n' "${PREFIXO}" "$1" "$2"
}

ja_ok() {
	total_ja_ok=$((total_ja_ok + 1))
	printf '%s JA-OK  %s %s\n' "${PREFIXO}" "$1" "$2"
}

erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer · $3 = código de saída (opc.)
abortar() {
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit "${3:-1}"
}

# ---------------------------------------------------------------------------
# A LIMPEZA É CIENTE DA ESCRITA PENDENTE — e a ordem aqui é o mecanismo
# ---------------------------------------------------------------------------
#
# O backup do vhost anterior vive dentro de `DIR_TEMPORARIO`. Enquanto esta
# função apenas o apagava, um término na janela entre a escrita (P03) e a
# validação da configuração inteira (P04) deixava DOIS efeitos ao mesmo tempo: o
# vhost novo em ${DIR_DOS_VHOSTS}, nunca confrontado com os demais vhosts, e o
# conteúdo anterior destruído junto com o temporário. O processo em execução não
# sente na hora — a recarga é o P05 —, mas o `reload` seguinte, inclusive o do
# operador do legado e o do BOOT (invariante 7 do produto), carregaria uma
# configuração cujo conflito global nunca foi testado, numa borda compartilhada
# com quem atende a operação hoje.
#
# Desfazer AQUI, e não em cada caminho de saída, é o que fecha a classe: os
# traps de sinal mapeiam para `exit` (logo abaixo), o `trap ERR` também termina
# em `exit`, e `abortar` é `exit` — todos convergem para esta função. A janela é
# definida pelo ESTADO (`ESCRITA_PENDENTE`), não pela forma do término, de modo
# que um caminho de saída novo entre o P03 e o P04 já nasce coberto, e o
# resultado é o mesmo do caminho de reprovação do P04, que já estava correto.
#
# O desfazimento vem ANTES do `rm -rf`: é do temporário que sai o backup.
limpar() {
	local codigo=$?
	if [[ "${ESCRITA_PENDENTE}" == "sim" ]]; then
		ESCRITA_PENDENTE="nao"
		erro "término antes da validação da configuração inteira — desfazendo a escrita em ${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
		restaurar_destino || erro "NÃO consegui desfazer a escrita em ${DIR_DOS_VHOSTS}/${NOME_DO_VHOST} — confira o arquivo à mão antes do próximo 'nginx -t'"
	fi
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara
# o trap de EXIT uma única vez e faz a limpeza acontecer.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"; erro "O QUE FAZER: releia as últimas linhas acima, corrija a causa e execute o script de novo — ele é idempotente e retoma do ponto correto"' ERR

# =========================================================================== #
# Funções PURAS — sem efeito colateral fora dos caminhos que recebem, sem
# privilégio, exercitáveis diretamente pela bateria de verificação.
#
# Elas estão extraídas de propósito, pelo mesmo motivo de `unidade_diverge` em
# `instalar-unidades.sh`: a decisão de idempotência e a substituição dos
# marcadores são as propriedades que o `CT-1005` cobra, e enquanto vivessem
# embutidas num passo que escreve em /etc e exige root, a bateria acabaria
# testando uma REIMPLEMENTAÇÃO delas — e um instalador com o defeito de volta
# passaria. O verificador carrega ESTAS funções do arquivo real e as exercita.
# =========================================================================== #

# Confere a FORMA de um hostname, por padrão POSITIVO: rótulos DNS separados por
# ponto, cada um começando e terminando em alfanumérico, com hífen só no meio.
#
# Por que positivo, e não uma lista de caracteres proibidos: o valor resolvido é
# interpolado no gabarito e vira DIRETIVA do nginx. Um `;` a mais publica duas
# diretivas onde deveria haver uma — medido pelo Gate 1, que obteve
# `server_name x; add_header X-Injetado 1;` de um hostname mal digitado —, e um
# espaço faz o vhost atender um segundo nome que ninguém escolheu. A origem é
# root-controlada, então isto NÃO é escalada de privilégio: é engano de digitação
# numa borda COMPARTILHADA com quem atende a operação hoje. Enumerar os
# caracteres perigosos deixaria a classe aberta ao próximo caractere; exigir a
# forma de um nome de host a fecha.
#
# É complementar, e não alternativa, à conferência de status de `renderizar_vhost`:
# aquela fecha a classe das falhas da substituição, esta a dos valores malformados.
hostname_bem_formado() {
	# O padrão vive numa variável porque `[[ =~ ]]` não admite `;` nem `[:classe:]`
	# escritos à mão direita — o shell reprova a expressão antes de compará-la.
	local padrao='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$'
	[[ "${#1}" -le 253 ]] || return 1
	[[ "$1" =~ $padrao ]]
}

# Mesma razão, para os caminhos de certificado e de chave: absoluto, sem espaço,
# sem `;` (que encerraria a diretiva) e sem `|` (o delimitador do `s|||` da
# renderização).
caminho_bem_formado() {
	local padrao='^/[^;[:space:]|]+$'
	[[ "$1" =~ $padrao ]]
}

# Substitui os marcadores `__NOME__` do gabarito e imprime o vhost renderizado.
#
# Recusa (código 1, com a razão em stderr) quando SOBRA qualquer marcador: um
# gabarito meio substituído é sintaticamente aceitável para o nginx e atende o
# hostname errado — falha silenciosa que só aparece quando o provedor não
# alcança o produto.
#
# ---------------------------------------------------------------------------
# POR QUE O STATUS DO `sed` É CONFERIDO À MÃO, e por que há um segundo guarda
# ---------------------------------------------------------------------------
#
# Esta função é chamada na forma `renderizar_vhost … || abortar`, e o `||`
# SUPRIME o `errexit` e o `trap ERR` em toda a extensão dinâmica dela. Sem a
# conferência explícita, `rendido` fica VAZIO quando o `sed` morre, o guarda de
# marcador remanescente abaixo passa POR VACUIDADE (não há marcador no vazio) e
# a função devolve 0 — instalando um vhost vazio que atravessa `nginx -t` sem
# reclamar. O script sairia 0 anunciando que publicou um caminho, e a borda não
# atenderia. Medido pelo Gate 1 com um valor de configuração contendo `|`, que
# é o delimitador do `s|||`.
#
# São DOIS guardas de propósito, e eles fecham classes diferentes:
#
#   (a) o status do `sed` — apanha QUALQUER falha da substituição (delimitador
#       no valor, expressão nova malformada, locale, memória), e não o caractere
#       de um caso;
#   (b) a PLAUSIBILIDADE do que saiu — apanha o render mutilado que ainda assim
#       devolve status 0. Um vhost sem `server {` e sem `location =`, ou muito
#       menor que o gabarito de origem, é lixo qualquer que seja a causa.
#
# O (a) sozinho depende de toda falha futura se anunciar pelo status; o (b)
# sozinho depende de o lixo ser reconhecível. Juntos, o valor de retorno desta
# função é o que passa a ser conferido — não o sintoma.
renderizar_vhost() {
	local gabarito="$1" hostname="$2" porta_https="$3" porta_http="$4"
	local certificado="$5" chave="$6" endereco_api="$7"

	[[ -r "${gabarito}" ]] || {
		printf 'gabarito ilegível: %s\n' "${gabarito}" >&2
		return 1
	}

	local rendido
	rendido="$(sed \
		-e "s|__HOSTNAME_DA_NOTIFICACAO__|${hostname}|g" \
		-e "s|__PORTA_HTTPS__|${porta_https}|g" \
		-e "s|__PORTA_HTTP__|${porta_http}|g" \
		-e "s|__CERTIFICADO__|${certificado}|g" \
		-e "s|__CHAVE_DO_CERTIFICADO__|${chave}|g" \
		-e "s|__ENDERECO_DA_API__|${endereco_api}|g" \
		"${gabarito}")" || {
		printf 'a substituição dos marcadores do gabarito falhou (sed) — nada foi renderizado a partir de %s\n' \
			"${gabarito}" >&2
		return 1
	}

	# (b) — plausibilidade do que saiu. O piso é RELATIVO ao gabarito, e não um
	# número escrito aqui: a substituição troca marcador por valor e não encolhe
	# o arquivo à metade, então render abaixo disso é mutilação. As duas formas
	# exigidas são as que fazem um vhost ser um vhost.
	local bytes_do_gabarito bytes_do_rendido forma
	bytes_do_gabarito="$(wc -c <"${gabarito}")"
	bytes_do_rendido="$(printf '%s\n' "${rendido}" | wc -c)"
	if ((bytes_do_rendido * 2 < bytes_do_gabarito)); then
		printf 'vhost renderizado implausível: %s byte(s) contra %s do gabarito %s\n' \
			"${bytes_do_rendido}" "${bytes_do_gabarito}" "${gabarito}" >&2
		return 1
	fi
	for forma in 'server {' 'location = '; do
		case "${rendido}" in
		*"${forma}"*) ;;
		*)
			printf 'vhost renderizado implausível: não contém %s — o gabarito %s não foi renderizado por inteiro\n' \
				"${forma}" "${gabarito}" >&2
			return 1
			;;
		esac
	done

	local restantes
	restantes="$(printf '%s\n' "${rendido}" | grep -oE '__[A-Z_]+__' | sort -u || true)"
	if [[ -n "${restantes}" ]]; then
		printf 'marcador não substituído no vhost renderizado: %s\n' \
			"$(printf '%s' "${restantes}" | tr '\n' ' ')" >&2
		return 1
	fi

	printf '%s\n' "${rendido}"
}

# Decide se o destino precisa ser (re)escrito a partir da origem.
#
# Devolve 0 quando DIVERGE (ausente, conteúdo ou modo) e 1 quando já está
# correto. Nunca escreve nada — a escrita é de `posicionar_vhost`, que a
# consulta.
#
# O modo entra na comparação junto com o conteúdo, e não como um segundo passo:
# um vhost com conteúdo certo e permissão frouxa é tão divergente quanto um com
# conteúdo errado, e tratá-los separadamente faria a segunda execução reportar
# `JA-OK` sobre um estado que ainda precisava de conserto.
vhost_diverge() {
	local origem="$1" destino="$2" modo="$3"

	[[ -f "${destino}" ]] || return 0
	cmp -s "${origem}" "${destino}" || return 0
	[[ "$(stat -c '%a' "${destino}")" == "${modo#0}" ]] || return 0
	return 1
}

# Escreve o vhost no destino SOMENTE quando ele diverge, e imprime o que fez —
# `CRIADO` ou `JA-OK`. É a idempotência em si, e é por ela imprimir o veredito
# (em vez de decidi-lo no chamador) que a bateria consegue exercitá-la sem
# reimplementar nada.
posicionar_vhost() {
	local origem="$1" destino="$2" modo="$3"

	if vhost_diverge "${origem}" "${destino}" "${modo}"; then
		install -m "${modo}" "${origem}" "${destino}"
		printf 'CRIADO'
		return 0
	fi

	printf 'JA-OK'
	return 0
}

# Porta em que a API escuta, DERIVADA da unidade versionada (`Environment=PORT=`).
# Devolve vazio e código 1 quando a unidade não a declara — o que aborta a
# instalação em vez de adivinhar uma porta.
porta_da_api_na_unidade() {
	local unidade="$1" valor
	valor="$(sed -n 's|^Environment=PORT=\([0-9]\{1,\}\)$|\1|p' "${unidade}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Lê uma chave do arquivo de configuração do produto, sem `source`: o arquivo
# carrega segredo, e interpretá-lo como shell traria o conteúdo dele para dentro
# deste processo sem necessidade nenhuma.
valor_no_arquivo_de_ambiente() {
	local arquivo="$1" chave="$2" valor
	[[ -r "${arquivo}" ]] || return 1
	valor="$(sed -n "s|^${chave}=||p" "${arquivo}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Valida o vhost renderizado com o PRÓPRIO nginx, num prefixo efêmero e sem
# privilégio: é o que apanha erro de sintaxe antes de qualquer escrita em /etc.
# Devolve 0 quando válido; a saída do nginx sai em stderr quando não.
validar_vhost_isolado() {
	local vhost="$1" prefixo="$2"

	mkdir -p "${prefixo}/logs" "${prefixo}/temp"
	cat >"${prefixo}/nginx.conf" <<CONF
worker_processes 1;
pid ${prefixo}/nginx.pid;
error_log ${prefixo}/logs/error.log warn;
events { worker_connections 64; }
http {
  access_log ${prefixo}/logs/access.log;
  client_body_temp_path ${prefixo}/temp/client;
  proxy_temp_path ${prefixo}/temp/proxy;
  fastcgi_temp_path ${prefixo}/temp/fastcgi;
  uwsgi_temp_path ${prefixo}/temp/uwsgi;
  scgi_temp_path ${prefixo}/temp/scgi;
  include ${vhost};
}
CONF
	nginx -t -c "${prefixo}/nginx.conf" -p "${prefixo}" -e "${prefixo}/logs/error.log"
}

# =========================================================================== #
# Origem dos valores de configuração.
# =========================================================================== #
resolver_hostname() {
	if [[ -n "${SYSLOC_HOSTNAME_DA_NOTIFICACAO:-}" ]]; then
		printf '%s' "${SYSLOC_HOSTNAME_DA_NOTIFICACAO}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_HOSTNAME}"
}

resolver_certificado() {
	if [[ -n "${SYSLOC_CERTIFICADO_DA_BORDA:-}" ]]; then
		printf '%s' "${SYSLOC_CERTIFICADO_DA_BORDA}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_CERTIFICADO}" && return 0
	printf '%s/%s.crt' "${DIR_DOS_CERTIFICADOS_PADRAO}" "$1"
}

resolver_chave_do_certificado() {
	if [[ -n "${SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA:-}" ]]; then
		printf '%s' "${SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_DA_CHAVE_DO_CERTIFICADO}" && return 0
	printf '%s/%s.key' "${DIR_DOS_CERTIFICADOS_PADRAO}" "$1"
}

# =========================================================================== #
# Pré-condições. NENHUMA delas altera coisa alguma no sistema.
# =========================================================================== #
HOSTNAME_RESOLVIDO=""
CERTIFICADO_RESOLVIDO=""
CHAVE_RESOLVIDA=""
DIR_DOS_VHOSTS=""
PORTA_DA_API=""

verificar_precondicoes() {
	if [[ "${EUID}" -ne 0 ]]; then
		abortar "este script precisa de privilégio administrativo — ele escreve em ${DIR_DOS_VHOSTS_PADRAO} e recarrega o servidor de borda" \
			"execute como 'sudo bash deploy/scripts/borda/instalar-borda-de-notificacao.sh'"
	fi

	local faltando=() ferramenta
	for ferramenta in nginx install stat cmp sed grep systemctl; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale o que falta e execute de novo"
	fi

	[[ -r "${GABARITO}" ]] || abortar \
		"o gabarito do vhost não está legível em ${GABARITO}" \
		"execute a partir de um clone íntegro do repositório"

	HOSTNAME_RESOLVIDO="$(resolver_hostname || true)"
	if [[ -z "${HOSTNAME_RESOLVIDO}" ]]; then
		abortar "não há hostname para a notícia bancária — nem em SYSLOC_HOSTNAME_DA_NOTIFICACAO nem na chave ${CHAVE_HOSTNAME} de ${ARQ_AMBIENTE}" \
			"decida qual hostname público atende a notícia e informe-o: 'sudo SYSLOC_HOSTNAME_DA_NOTIFICACAO=<hostname> bash deploy/scripts/borda/instalar-borda-de-notificacao.sh'; o repositório não fixa esse nome de propósito"
	fi

	# A FORMA dos valores resolvidos é conferida AQUI — antes de qualquer escrita
	# e no ponto único por onde as duas origens (variável de ambiente e
	# ${ARQ_AMBIENTE}) passam. Depois daqui eles viram configuração do servidor.
	if ! hostname_bem_formado "${HOSTNAME_RESOLVIDO}"; then
		abortar "o hostname resolvido não tem forma de nome de host: [${HOSTNAME_RESOLVIDO}]" \
			"corrija o valor em SYSLOC_HOSTNAME_DA_NOTIFICACAO ou na chave ${CHAVE_HOSTNAME} de ${ARQ_AMBIENTE} — ele é interpolado no vhost e vira diretiva do nginx, de modo que espaço, ';' ou '|' publicariam configuração que ninguém escreveu"
	fi

	CERTIFICADO_RESOLVIDO="$(resolver_certificado "${HOSTNAME_RESOLVIDO}")"
	CHAVE_RESOLVIDA="$(resolver_chave_do_certificado "${HOSTNAME_RESOLVIDO}")"

	if ! caminho_bem_formado "${CERTIFICADO_RESOLVIDO}"; then
		abortar "o caminho do certificado não tem forma de caminho absoluto de arquivo: [${CERTIFICADO_RESOLVIDO}]" \
			"corrija o valor em SYSLOC_CERTIFICADO_DA_BORDA ou na chave ${CHAVE_CERTIFICADO} de ${ARQ_AMBIENTE} — ele vira a diretiva 'ssl_certificate' do vhost"
	fi
	if ! caminho_bem_formado "${CHAVE_RESOLVIDA}"; then
		abortar "o caminho da chave do certificado não tem forma de caminho absoluto de arquivo: [${CHAVE_RESOLVIDA}]" \
			"corrija o valor em SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA ou na chave ${CHAVE_DA_CHAVE_DO_CERTIFICADO} de ${ARQ_AMBIENTE} — ele vira a diretiva 'ssl_certificate_key' do vhost"
	fi

	[[ -r "${CERTIFICADO_RESOLVIDO}" ]] || abortar \
		"o certificado do hostname não está legível em ${CERTIFICADO_RESOLVIDO}" \
		"emita o certificado pelo servidor de borda antes de instalar, ou informe o caminho em SYSLOC_CERTIFICADO_DA_BORDA — um vhost TLS sem certificado impede o servidor INTEIRO de carregar"
	[[ -r "${CHAVE_RESOLVIDA}" ]] || abortar \
		"a chave do certificado não está legível em ${CHAVE_RESOLVIDA}" \
		"informe o caminho em SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA"

	DIR_DOS_VHOSTS="${SYSLOC_DIR_DOS_VHOSTS:-${DIR_DOS_VHOSTS_PADRAO}}"
	[[ -d "${DIR_DOS_VHOSTS}" ]] || abortar \
		"o diretório de vhosts ${DIR_DOS_VHOSTS} não existe" \
		"informe o diretório que este servidor de borda usa em SYSLOC_DIR_DOS_VHOSTS"

	# Vhost instalado num diretório que o servidor não lê existe e não atende —
	# e o sintoma (o provedor não alcança o produto) fica longe da causa.
	if [[ -r "${CONFIGURACAO_DO_SERVIDOR}" ]] &&
		! grep -qE "^[[:space:]]*include[[:space:]]+${DIR_DOS_VHOSTS}/" "${CONFIGURACAO_DO_SERVIDOR}"; then
		abortar "a configuração do servidor (${CONFIGURACAO_DO_SERVIDOR}) não inclui ${DIR_DOS_VHOSTS}/" \
			"informe em SYSLOC_DIR_DOS_VHOSTS um dos diretórios que ela inclui: $(grep -E '^[[:space:]]*include[[:space:]]' "${CONFIGURACAO_DO_SERVIDOR}" | tr -s ' ' | tr '\n' ' ')"
	fi

	PORTA_DA_API="$(porta_da_api_na_unidade "${UNIDADE_DA_API}" || true)"
	if [[ -z "${PORTA_DA_API}" ]]; then
		abortar "não consegui derivar a porta da API de ${UNIDADE_DA_API} (linha 'Environment=PORT=')" \
			"confira a unidade versionada — a porta é derivada dela de propósito, para não haver duas verdades sobre a mesma coisa"
	fi
}

# =========================================================================== #
# Passos.
# =========================================================================== #
passo_p01_renderizar() {
	DIR_TEMPORARIO="$(mktemp -d)"
	local rendido="${DIR_TEMPORARIO}/${NOME_DO_VHOST}"

	renderizar_vhost "${GABARITO}" "${HOSTNAME_RESOLVIDO}" \
		"${PORTA_HTTPS_PADRAO}" "${PORTA_HTTP_PADRAO}" \
		"${CERTIFICADO_RESOLVIDO}" "${CHAVE_RESOLVIDA}" \
		"${ENDERECO_DE_ESCUTA_DA_API}:${PORTA_DA_API}" >"${rendido}" || abortar \
		"a renderização do gabarito falhou (ver a linha acima)" \
		"corrija o gabarito em ${GABARITO} e execute de novo"

	info "P01 vhost renderizado para o hostname de configuração, com a API em ${ENDERECO_DE_ESCUTA_DA_API}:${PORTA_DA_API}"

	if ! validar_vhost_isolado "${rendido}" "${DIR_TEMPORARIO}/validacao" >/dev/null 2>"${DIR_TEMPORARIO}/validacao.err"; then
		cat "${DIR_TEMPORARIO}/validacao.err" >&2
		abortar "o vhost renderizado não passa na validação do nginx" \
			"corrija o gabarito em ${GABARITO}; nada foi escrito em ${DIR_DOS_VHOSTS}"
	fi
	info "P02 vhost renderizado validado pelo nginx, em prefixo efêmero — nada escrito ainda"
}

passo_p03_posicionar() {
	local rendido="${DIR_TEMPORARIO}/${NOME_DO_VHOST}"
	local destino="${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"

	# O conteúdo anterior é guardado ANTES da escrita: se a validação da
	# configuração inteira reprovar, o passo P04 restaura o que estava lá. Uma
	# borda compartilhada não pode ficar com configuração que não carrega.
	if [[ -f "${destino}" ]]; then
		DESTINO_TINHA_ARQUIVO="sim"
		BACKUP_DO_DESTINO="${DIR_TEMPORARIO}/anterior.conf"
		cp -p "${destino}" "${BACKUP_DO_DESTINO}"
	fi

	local veredito
	veredito="$(posicionar_vhost "${rendido}" "${destino}" "${MODO_DO_VHOST}")"
	if [[ "${veredito}" == "CRIADO" ]]; then
		# A janela abre AQUI e só fecha quando o P04 aprovar a configuração
		# inteira. `JA-OK` não a abre: nada foi escrito, e desfazer removeria um
		# vhost correto que já estava lá.
		ESCRITA_PENDENTE="sim"
		criado "P03" "${destino}"
	else
		ja_ok "P03" "${destino}"
	fi
}

restaurar_destino() {
	local destino="${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
	if [[ "${DESTINO_TINHA_ARQUIVO}" == "sim" && -f "${BACKUP_DO_DESTINO}" ]]; then
		install -m "${MODO_DO_VHOST}" "${BACKUP_DO_DESTINO}" "${destino}"
		erro "o conteúdo anterior de ${destino} foi restaurado"
	else
		rm -f "${destino}"
		erro "${destino} foi removido — o servidor volta ao estado anterior a esta execução"
	fi
}

passo_p04_validar_configuracao_inteira() {
	if nginx -t >"${DIR_TEMPORARIO}/nginx-t.out" 2>&1; then
		# A janela fecha aqui: o vhost escrito acabou de ser confrontado com os
		# demais, e desfazê-lo deixou de ser o certo.
		ESCRITA_PENDENTE="nao"
		info "P04 a configuração inteira do servidor de borda continua válida"
		return 0
	fi

	cat "${DIR_TEMPORARIO}/nginx-t.out" >&2
	restaurar_destino
	# Desfeito por este caminho; `limpar` não deve desfazer de novo.
	ESCRITA_PENDENTE="nao"
	abortar "a configuração do servidor de borda não passa em 'nginx -t' com o vhost instalado" \
		"leia a saída acima: conflito com outro vhost (mesmo hostname, mesma porta) é a causa mais comum; o servidor NÃO foi recarregado e o estado anterior foi restaurado"
}

passo_p05_recarregar() {
	# Recarregar sem necessidade é micro-indisponibilidade de graça numa borda
	# compartilhada com quem atende a operação hoje.
	if [[ "${total_criado}" -eq 0 ]]; then
		ja_ok "P05" "nada mudou — servidor de borda NÃO recarregado"
		return 0
	fi

	systemctl reload nginx
	criado "P05" "servidor de borda recarregado"
}

resumir() {
	printf '%s resumo: %d passo(s) com mudança, %d já correto(s)\n' \
		"${PREFIXO}" "${total_criado}" "${total_ja_ok}"
	info "publicado exatamente um caminho: /v1/notificacoes-bancarias (ADR-0035)"
	info "prove por medição com: bash deploy/scripts/borda/verificar-notificacao-bancaria.sh"
}

main() {
	printf '%s instalação da borda externa da notícia bancária\n' "${PREFIXO}"

	verificar_precondicoes
	passo_p01_renderizar
	passo_p03_posicionar
	passo_p04_validar_configuracao_inteira
	passo_p05_recarregar

	resumir
}

main "$@"
