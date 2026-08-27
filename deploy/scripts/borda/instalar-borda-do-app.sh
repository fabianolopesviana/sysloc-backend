#!/usr/bin/env bash
#
# Instalação da borda pública do aplicativo do cliente — T9 da fatia
# `publicacao-e-backup`.
#
# Posiciona no servidor de borda o vhost versionado em
# `deploy/nginx/sysloc-app.conf`, que faz o aplicativo do cliente ALCANÇAR o
# produto: o prefixo de versão é repassado à API ANTES do fallback da página
# única, o contrato morre na própria borda e o eixo de origem é declarado.
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
# O sistema antigo segue de pé até a virada, e a borda é estado COMPARTILHADO
# com ele. Este procedimento escreve UM arquivo novo, com nome próprio, num
# diretório de vhosts que ele confere estar incluído pela configuração do
# servidor — e não altera, não move e não remove configuração de mais ninguém.
#
# ⚠️ E a escrita é ATÔMICA. Não bastava escrever só o arquivo próprio: `install`
# abre o destino com `O_CREAT|O_TRUNC`, e a janela em que ele está truncado é
# legível por um `nginx -t` ou um `reload` CONCORRENTE de mais ninguém — o
# gancho de renovação do certificado, o painel, outro operador. Ver
# `publicar_atomicamente`, que é por onde passam as DUAS escritas deste script
# (a instalação e o desfazimento).
#
# ---------------------------------------------------------------------------
# O HOSTNAME VEM DE CONFIGURAÇÃO — nunca daqui
# ---------------------------------------------------------------------------
#
# Qual hostname público atende o aplicativo é decisão OPERACIONAL do usuário, e
# o repositório não a fixa. O valor vem, nesta ordem: da variável de ambiente
# `SYSLOC_HOSTNAME_DO_APP`, ou da chave `HOSTNAME_DO_APP` do arquivo de
# configuração do produto. Sem nenhuma das duas, o script ABORTA dizendo o que
# fazer — nunca adivinha.
#
# ---------------------------------------------------------------------------
# O QUE ELE VALIDA ANTES DE ESCREVER, e por que cada guarda existe
# ---------------------------------------------------------------------------
#
#   · a FORMA do hostname e dos caminhos: eles são interpolados no gabarito e
#     viram DIRETIVA do nginx. Um `;` publica duas diretivas onde deveria haver
#     uma; um espaço faz o vhost atender um nome que ninguém escolheu;
#   · o RENDER: marcador que sobrou, `sed` que morreu e saída mutilada são
#     recusados — gabarito meio substituído é vhost que o nginx aceita e que
#     atende o hostname errado;
#   · a SINTAXE, num prefixo efêmero e sem privilégio, antes de qualquer escrita;
#   · a DISPUTA de `server_name`, porque perdê-la não quebra nada visível: o
#     servidor sobe, o `nginx -t` passa, e o aplicativo simplesmente não é
#     atendido;
#   · a CONFIGURAÇÃO INTEIRA, depois da escrita e antes da recarga — com
#     desfazimento do que foi escrito se ela reprovar.
#
# Uso:
#   sudo bash deploy/scripts/borda/instalar-borda-do-app.sh
#   sudo SYSLOC_HOSTNAME_DO_APP=<hostname> bash deploy/scripts/borda/instalar-borda-do-app.sh
#
# Prove por medição depois de instalar:
#   bash deploy/scripts/borda/verificar-borda-do-app.sh
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly PREFIXO="[borda-do-app]"

# --------------------------------------------------------------------------- #
# Configuração.
# --------------------------------------------------------------------------- #
readonly GABARITO="${RAIZ_REPO}/deploy/nginx/sysloc-app.conf"

# O `000-` NÃO é enfeite. Um vhost concorrente pode declarar o MESMO
# `server_name` — é o que acontece quando o painel que administra o certificado
# deste hostname gera o próprio bloco. O nginx não funde os dois: ele fica com o
# PRIMEIRO que carrega e ignora o outro com um `[warn]` que ninguém lê. A ordem
# de carga é a do `glob` do `include`, isto é, LEXICOGRÁFICA pelo nome do
# arquivo. O prefixo torna a precedência DECLARADA, e o P03-B torna a inversão
# impossível de passar em silêncio.
readonly NOME_DO_VHOST="000-sysloc-app.conf"

readonly MODO_DO_VHOST="0644"

# Arquivo de configuração do produto no host, gravado por `provisionar-base.sh`
# com 0600 e dono root. Espelhado aqui de propósito: este procedimento precisa
# saber o valor sem herdá-lo do outro script, senão os dois erram juntos.
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"

readonly CHAVE_HOSTNAME="HOSTNAME_DO_APP"
readonly CHAVE_CERTIFICADO="CERTIFICADO_DA_BORDA_DO_APP"
readonly CHAVE_DA_CHAVE_DO_CERTIFICADO="CHAVE_DO_CERTIFICADO_DA_BORDA_DO_APP"
readonly CHAVE_RAIZ_DO_APLICATIVO="RAIZ_DO_APLICATIVO"
readonly CHAVE_RAIZ_DO_DESAFIO_ACME="RAIZ_DO_DESAFIO_ACME"

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

# O arquivo que a página única precisa ter na raiz publicada. Sem ele o
# fallback serve `404` para toda tela, e o aplicativo fica inalcançável com o
# vhost "instalado com sucesso".
readonly ARQUIVO_DE_ENTRADA_DO_APLICATIVO="index.html"

# A API não escuta fora do laço local (`ENDERECO_DE_ESCUTA` em
# `apps/api/src/configuracao/ambiente.ts`), e a porta é DERIVADA da unidade
# versionada — escrevê-la aqui de novo criaria duas verdades sobre a mesma
# coisa.
readonly ENDERECO_DE_ESCUTA_DA_API="127.0.0.1"
readonly UNIDADE_DA_API="${RAIZ_REPO}/deploy/systemd/sysloc-api.service"

# Portas da borda real. Ficam declaradas porque o gabarito é parametrizado — o
# que se instala é sempre TLS na 443 e o bloco em claro na 80.
readonly PORTA_HTTPS_PADRAO="443"
readonly PORTA_HTTP_PADRAO="80"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
BACKUP_DO_DESTINO=""
DESTINO_TINHA_ARQUIVO="nao"
# Modo do arquivo que estava no destino ANTES desta execução. Capturado junto
# com o backup, e usado para repor exatamente o que havia.
MODO_ANTERIOR_DO_DESTINO=""

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
# O backup do vhost anterior vive dentro de `DIR_TEMPORARIO`. Um término na
# janela entre a escrita (P03) e a validação da configuração inteira (P04)
# deixaria DOIS efeitos ao mesmo tempo: o vhost novo instalado, nunca
# confrontado com os demais, e o conteúdo anterior destruído junto com o
# temporário. O processo em execução não sente na hora — a recarga é o P05 —,
# mas o `reload` seguinte, inclusive o do BOOT (invariante 7 do produto),
# carregaria uma configuração cujo conflito global nunca foi testado.
#
# Desfazer AQUI, e não em cada caminho de saída, é o que fecha a classe: os
# traps de sinal mapeiam para `exit`, o `trap ERR` também termina em `exit`, e
# `abortar` é `exit` — todos convergem para esta função. A janela é definida
# pelo ESTADO (`ESCRITA_PENDENTE`), não pela forma do término, de modo que um
# caminho de saída novo entre o P03 e o P04 já nasce coberto.
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
# Elas estão extraídas de propósito: a decisão de idempotência e a substituição
# dos marcadores são as propriedades que o `CT-1188` cobra, e enquanto vivessem
# embutidas num passo que escreve em /etc e exige root, a bateria acabaria
# testando uma REIMPLEMENTAÇÃO delas — e um instalador com o defeito de volta
# passaria. O verificador carrega ESTAS funções do arquivo real e as exercita.
# =========================================================================== #

# Confere a FORMA de um hostname, por padrão POSITIVO: rótulos DNS separados por
# ponto, cada um começando e terminando em alfanumérico, com hífen só no meio.
#
# Por que positivo, e não uma lista de caracteres proibidos: o valor resolvido é
# interpolado no gabarito e vira DIRETIVA do nginx. Enumerar os caracteres
# perigosos deixaria a classe aberta ao próximo caractere; exigir a forma de um
# nome de host a fecha. A origem é root-controlada, então isto NÃO é escalada de
# privilégio: é engano de digitação numa borda COMPARTILHADA com quem atende a
# operação hoje.
hostname_bem_formado() {
	# O padrão vive numa variável porque `[[ =~ ]]` não admite `;` nem
	# `[:classe:]` escritos à mão direita — o shell reprova a expressão antes de
	# compará-la.
	local padrao='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$'
	[[ "${#1}" -le 253 ]] || return 1
	[[ "$1" =~ $padrao ]]
}

# Mesma razão, para os caminhos de certificado, de chave, da raiz do aplicativo
# e da raiz do desafio: absoluto, sem espaço, sem `;` (que encerraria a
# diretiva) e sem `|` (o delimitador do `s|||` da renderização).
caminho_bem_formado() {
	local padrao='^/[^;[:space:]|]+$'
	[[ "$1" =~ $padrao ]]
}

# Substitui os marcadores `__NOME__` do gabarito e imprime o vhost renderizado.
#
# Recusa (código 1, com a razão em stderr) quando SOBRA qualquer marcador: um
# gabarito meio substituído é sintaticamente aceitável para o nginx e atende o
# hostname errado — falha silenciosa que só aparece quando o cliente não alcança
# o produto.
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
# reclamar. O script sairia 0 anunciando que publicou o aplicativo, e a borda
# não atenderia.
#
# São DOIS guardas de propósito, e eles fecham classes diferentes:
#
#   (a) o status do `sed` — apanha QUALQUER falha da substituição (delimitador
#       no valor, expressão nova malformada, locale, memória), e não o caractere
#       de um caso;
#   (b) a PLAUSIBILIDADE do que saiu — apanha o render mutilado que ainda assim
#       devolve status 0. Um vhost sem `server {`, sem `location = ` e sem
#       `location ^~ ` é lixo qualquer que seja a causa.
#
# O (a) sozinho depende de toda falha futura se anunciar pelo status; o (b)
# sozinho depende de o lixo ser reconhecível. Juntos, o valor de retorno desta
# função é o que passa a ser conferido — não o sintoma.
renderizar_vhost() {
	local gabarito="$1" hostname="$2" porta_https="$3" porta_http="$4"
	local certificado="$5" chave="$6" endereco_api="$7"
	local raiz_do_aplicativo="$8" raiz_do_desafio="$9"

	[[ -r "${gabarito}" ]] || {
		printf 'gabarito ilegível: %s\n' "${gabarito}" >&2
		return 1
	}

	local rendido
	rendido="$(sed \
		-e "s|__HOSTNAME_DO_APP__|${hostname}|g" \
		-e "s|__PORTA_HTTPS__|${porta_https}|g" \
		-e "s|__PORTA_HTTP__|${porta_http}|g" \
		-e "s|__CERTIFICADO__|${certificado}|g" \
		-e "s|__CHAVE_DO_CERTIFICADO__|${chave}|g" \
		-e "s|__ENDERECO_DA_API__|${endereco_api}|g" \
		-e "s|__RAIZ_DO_APLICATIVO__|${raiz_do_aplicativo}|g" \
		-e "s|__RAIZ_DO_DESAFIO_ACME__|${raiz_do_desafio}|g" \
		"${gabarito}")" || {
		printf 'a substituição dos marcadores do gabarito falhou (sed) — nada foi renderizado a partir de %s\n' \
			"${gabarito}" >&2
		return 1
	}

	# (b) — plausibilidade do que saiu. O piso é RELATIVO ao gabarito, e não um
	# número escrito aqui: a substituição troca marcador por valor e não encolhe
	# o arquivo à metade, então render abaixo disso é mutilação. As três formas
	# exigidas são as que fazem este vhost ser este vhost.
	local bytes_do_gabarito bytes_do_rendido forma
	bytes_do_gabarito="$(wc -c <"${gabarito}")"
	bytes_do_rendido="$(printf '%s\n' "${rendido}" | wc -c)"
	if ((bytes_do_rendido * 2 < bytes_do_gabarito)); then
		printf 'vhost renderizado implausível: %s byte(s) contra %s do gabarito %s\n' \
			"${bytes_do_rendido}" "${bytes_do_gabarito}" "${gabarito}" >&2
		return 1
	fi
	for forma in 'server {' 'location = ' 'location ^~ '; do
		case "${rendido}" in
		*"${forma}"*) ;;
		*)
			printf 'vhost renderizado implausível: não contém %s — o gabarito %s não foi renderizado por inteiro\n' \
				"${forma}" "${gabarito}" >&2
			return 1
			;;
		esac
	done

	# A classe de caracteres inclui DÍGITO de propósito: o que define um marcador
	# do gabarito é a FORMA (par de sublinhados duplos delimitando o nome), não o
	# alfabeto do nome. Enumerar só letras deixaria um `__PORTA_8080__` futuro
	# atravessar o guarda e chegar a /etc como diretiva meio renderizada, e o
	# defeito nasceria mudo — o gabarito é quem escolhe os nomes, não este guarda.
	local restantes
	restantes="$(printf '%s\n' "${rendido}" | grep -oE '__[A-Z0-9_]+__' | sort -u || true)"
	if [[ -n "${restantes}" ]]; then
		printf 'marcador não substituído no vhost renderizado: %s\n' \
			"$(printf '%s' "${restantes}" | tr '\n' ' ')" >&2
		return 1
	fi

	printf '%s\n' "${rendido}"
}

# Compara dois modos de arquivo por VALOR em base 8, e não por grafia. O recorte
# de texto (`${modo#0}`) removeria UM zero à esquerda: certo para `0644`, errado
# para `0044`, que viraria `044` contra o `44` do `stat` e faria o arquivo ser
# julgado divergente e reescrito em TODA execução — idempotência quebrada em
# silêncio, com reload a cada corrida numa borda compartilhada.
modo_igual() {
	[[ "$(printf '%o' "$((8#$1))")" == "$(printf '%o' "$((8#$2))")" ]]
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
	modo_igual "$(stat -c '%a' "${destino}")" "${modo}" || return 0
	return 1
}

# Publica um arquivo no destino de forma ATÔMICA.
#
# ⚠️ `install` sozinho NÃO é atômico: ele abre o destino com `O_CREAT|O_TRUNC` e
# copia, de modo que existe uma janela em que o arquivo está truncado ou
# parcialmente escrito. O destino aqui é o diretório de vhosts de um servidor de
# borda COMPARTILHADO — um `nginx -t` ou um `reload` concorrente (o gancho de
# renovação do certificado, o painel que administra o host, outro operador) pode
# ler o arquivo nesse estado. Não há corrupção silenciosa (o nginx recusa e o
# reload aborta preservando a configuração anterior); o custo é um reload alheio
# falhando por uma razão que não aparece em lugar nenhum e não se reproduz.
#
# A publicação é feita NO MESMO DIRETÓRIO — `install` no vizinho `.novo`, depois
# `mv -f`. Dentro do mesmo sistema de arquivos, `mv` é `rename(2)`, que é
# atômico: todo leitor concorrente vê o arquivo anterior INTEIRO ou o novo
# INTEIRO, nunca um estado intermediário. O `install` já fixa o modo ANTES da
# troca, de modo que o arquivo nunca é visível com permissão errada.
#
# O vizinho fica no mesmo diretório de propósito: `rename(2)` entre sistemas de
# arquivos distintos falha com `EXDEV`, e o `mv` degradaria para cópia — que é
# exatamente a escrita não atômica que esta função existe para evitar.
publicar_atomicamente() {
	local origem="$1" destino="$2" modo="$3"
	local vizinho="${destino}.novo"

	install -m "${modo}" "${origem}" "${vizinho}"
	mv -f "${vizinho}" "${destino}"
}

# Escreve o vhost no destino SOMENTE quando ele diverge, e imprime o que fez —
# `CRIADO` ou `JA-OK`. É a idempotência em si, e é por ela imprimir o veredito
# (em vez de decidi-lo no chamador) que a bateria consegue exercitá-la sem
# reimplementar nada.
posicionar_vhost() {
	local origem="$1" destino="$2" modo="$3"

	if vhost_diverge "${origem}" "${destino}" "${modo}"; then
		publicar_atomicamente "${origem}" "${destino}" "${modo}"
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

# Decide se o servidor EM EXECUÇÃO já carregou o arquivo indicado.
#
#   0  já carregou   1  não carregou   2  não deu para decidir
#
# O discriminador é o WORKER mais antigo, nunca o mestre: `reload` substitui os
# workers e PRESERVA o mestre, de modo que o instante de início do mestre não
# distingue uma configuração carregada de uma que nunca foi lida. Arquivo mais
# novo que o worker mais antigo é arquivo que aquele worker não viu.
#
# Existe porque estado convergente no DISCO não é estado convergente no
# PROCESSO: uma execução anterior interrompida entre a escrita (P03) e a recarga
# (P05), ou um arquivo posto à mão, deixa o vhost correto em disco e a borda sem
# atender.
servidor_ja_carregou() {
	local arquivo="$1" mtime agora etimes args worker_mais_antigo="" inicio_do_worker
	[[ -f "${arquivo}" ]] || return 2
	command -v ps >/dev/null 2>&1 || return 2
	mtime="$(stat -c '%Y' "${arquivo}" 2>/dev/null)" || return 2

	while read -r etimes args; do
		[[ "${etimes}" =~ ^[0-9]+$ ]] || continue
		[[ "${args}" == *'worker process'* ]] || continue
		if [[ -z "${worker_mais_antigo}" || "${etimes}" -gt "${worker_mais_antigo}" ]]; then
			worker_mais_antigo="${etimes}"
		fi
	done < <(ps -C nginx -o etimes=,args= 2>/dev/null || true)

	# Sem worker identificado não se decide nada — e não decidir é diferente de
	# decidir que não carregou: o segundo mandaria recarregar às cegas.
	[[ -n "${worker_mais_antigo}" ]] || return 2

	agora="$(date +%s)"
	inicio_do_worker=$((agora - worker_mais_antigo))
	[[ "${mtime}" -le "${inicio_do_worker}" ]]
}

# Os alvos de `include` declarados num arquivo de configuração, um por linha.
# Extraí-los é o que permite a conferência abaixo comparar por TEXTO em vez de
# interpolar um caminho dentro de expressão regular.
alvos_de_include() {
	sed -n 's|^[[:space:]]*include[[:space:]]\{1,\}\([^;]*\);.*|\1|p' "$1"
}

# Decide se a configuração do servidor inclui o diretório de vhosts, direta ou
# TRANSITIVAMENTE (um nível).
#
#   0  inclui
#   1  não inclui
#   2  não deu para decidir (configuração ilegível) — que NÃO é o mesmo que 1
#
# O nível de recursão não é zelo: o padrão do painel que administra o servidor
# de borda deste host é o `nginx.conf` incluir um ARQUIVO, e ser esse arquivo a
# incluir o diretório dos vhosts. Com conferência de um nível só, o instalador
# abortaria dizendo que o diretório não é incluído justamente onde ele é.
#
# O terceiro código existe porque "não consegui ler" e "não inclui" levam a
# condutas OPOSTAS: a segunda aborta, a primeira avisa e segue.
#
# ⚠️ A comparação é por PREFIXO LITERAL, e não por expressão regular com o
# caminho interpolado. Um caminho de diretório carrega pontos
# (`/etc/nginx/sites-enabled`, `/opt/app.d`), e dentro de uma regex o `.` casa
# qualquer caractere — a conferência aprovaria um `include` de diretório apenas
# PARECIDO. O impacto prático é nulo (a origem é do root, e o `nginx -t` global
# cobre o desfecho); a forma literal custa o mesmo e não tem como errar.
configuracao_inclui_diretorio() {
	local configuracao="$1" diretorio="$2" arquivo alvo incluido
	[[ -r "${configuracao}" ]] || return 2

	# Os arquivos a examinar: a configuração e, um nível abaixo, o que ela
	# inclui.
	local -a arquivos=("${configuracao}")
	while read -r alvo; do
		[[ -n "${alvo}" ]] || continue
		# Sem aspas de propósito: o alvo do `include` costuma ser um glob
		# (`.../conf.d/*.conf`), e é o shell que o expande, como o nginx faz.
		for incluido in ${alvo}; do
			if [[ -f "${incluido}" && -r "${incluido}" ]]; then
				arquivos+=("${incluido}")
			fi
		done
	done < <(alvos_de_include "${configuracao}")

	for arquivo in "${arquivos[@]}"; do
		while read -r alvo; do
			if [[ "${alvo}" == "${diretorio}/"* ]]; then
				return 0
			fi
		done < <(alvos_de_include "${arquivo}")
	done

	return 1
}

# Nomeia as chaves atribuídas MAIS DE UMA VEZ no arquivo de ambiente. Imprime as
# repetidas (separadas por espaço) e devolve 0 quando há alguma; 1 quando não há.
#
# Atribuição repetida é AMBIGUIDADE, e ambiguidade se recusa — não se resolve
# escolhendo um lado. O `EnvironmentFile=` do systemd resolve repetição pela
# ÚLTIMA ocorrência; um leitor ingênuo pega a PRIMEIRA. Escolher qualquer uma
# das duas deixa a divergência silenciosa — a borda seria instalada apontando
# para um certificado e o serviço subiria com outro, sem nada acusar.
chaves_repetidas_no_ambiente() {
	local arquivo="$1" repetidas
	[[ -r "${arquivo}" ]] || return 1
	repetidas="$(tr -d '\r' <"${arquivo}" |
		grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' |
		sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	[[ -n "${repetidas// /}" ]] || return 1
	printf '%s' "${repetidas% }"
}

# Lê uma chave do arquivo de configuração do produto, sem `source`: o arquivo
# carrega segredo, e interpretá-lo como shell traria o conteúdo dele para dentro
# deste processo sem necessidade nenhuma.
valor_no_arquivo_de_ambiente() {
	local arquivo="$1" chave="$2" valor
	[[ -r "${arquivo}" ]] || return 1
	# O `head -1` é seguro por PRÉ-CONDIÇÃO, não por sorte: `verificar_precondicoes`
	# aborta antes daqui se alguma chave estiver repetida.
	#
	# O `\r` sai porque um arquivo salvo com fim de linha do Windows faria o
	# valor carregar um caractere invisível que vira parte do caminho do
	# certificado ou do hostname interpolado no vhost; o espaço à direita, pela
	# mesma razão.
	valor="$(tr -d '\r' <"${arquivo}" | sed -n "s|^${chave}=||p" | head -1)"
	valor="${valor%"${valor##*[![:space:]]}"}"
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
# Disputa de `server_name` — quem o servidor de borda de fato atende.
# =========================================================================== #

# Devolve 0 quando o arquivo declara o hostname em alguma diretiva `server_name`.
# A comparação é por TOKEN, e não por substring: `server_name a.b.c;` não pode
# ser lido como declaração de `b.c`, e `server_name x y;` declara os dois.
vhost_declara_hostname() {
	local arquivo="$1" alvo="$2"
	awk -v alvo="${alvo}" '
		/^[[:space:]]*server_name[[:space:]]/ {
			linha = $0
			sub(/;.*$/, "", linha)
			n = split(linha, campos, /[[:space:]]+/)
			for (i = 1; i <= n; i++) {
				if (campos[i] == alvo) { achou = 1 }
			}
		}
		END { exit(achou ? 0 : 1) }
	' "${arquivo}" 2>/dev/null
}

# Imprime, EM ORDEM DE CARGA, os vhosts do diretório que declaram o hostname.
#
# Devolve 0 somente quando o primeiro deles é o nosso. Devolve 1 quando outro
# vence — e também quando NINGUÉM declara o hostname, que é o controle
# antivácuo: uma lista vazia não pode ser lida como "vencemos", senão a
# conferência aprovaria justamente o caso em que o vhost não foi escrito.
#
# A ordem é a do `glob(3)` que o nginx usa no `include`, que ordena na
# localidade C — daí o `LC_ALL=C` explícito.
conferir_precedencia_do_vhost() {
	local dir="$1" nosso="$2" alvo="$3"
	local arquivo
	local -a declarantes=()

	for arquivo in "${dir}"/*.conf; do
		[[ -f "${arquivo}" ]] || continue
		vhost_declara_hostname "${arquivo}" "${alvo}" || continue
		declarantes+=("${arquivo##*/}")
	done

	((${#declarantes[@]} > 0)) || return 1

	mapfile -t declarantes < <(printf '%s\n' "${declarantes[@]}" | LC_ALL=C sort)
	printf '%s\n' "${declarantes[@]}"
	[[ "${declarantes[0]}" == "${nosso}" ]]
}

# Repõe no destino o que havia antes desta execução — CONTEÚDO e PERMISSÃO.
#
# O modo reposto é o CAPTURADO no P03, nunca `MODO_DO_VHOST`. A distinção não é
# cosmética: `MODO_DO_VHOST` é a permissão que ESTE produto dá ao vhost que ele
# instala; o arquivo restaurado é de quem estava aqui antes, numa borda
# compartilhada com quem atende a operação hoje.
restaurar_destino() {
	local destino="${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
	if [[ "${DESTINO_TINHA_ARQUIVO}" == "sim" && -f "${BACKUP_DO_DESTINO}" ]]; then
		# Atômica pela mesma razão da escrita: o desfazimento acontece DEPOIS de
		# o `nginx -t` global ter recusado o conjunto, isto é, com a borda já em
		# estado que alguém pode estar lendo.
		publicar_atomicamente "${BACKUP_DO_DESTINO}" "${destino}" \
			"${MODO_ANTERIOR_DO_DESTINO:-${MODO_DO_VHOST}}"
		erro "o conteúdo e a permissão anteriores de ${destino} foram restaurados"
	else
		rm -f "${destino}"
		erro "${destino} foi removido — o servidor volta ao estado anterior a esta execução"
	fi
}

# =========================================================================== #
# Origem dos valores de configuração.
# =========================================================================== #
resolver_hostname() {
	if [[ -n "${SYSLOC_HOSTNAME_DO_APP:-}" ]]; then
		printf '%s' "${SYSLOC_HOSTNAME_DO_APP}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_HOSTNAME}"
}

resolver_certificado() {
	if [[ -n "${SYSLOC_CERTIFICADO_DA_BORDA_DO_APP:-}" ]]; then
		printf '%s' "${SYSLOC_CERTIFICADO_DA_BORDA_DO_APP}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_CERTIFICADO}" && return 0
	printf '%s/%s.crt' "${DIR_DOS_CERTIFICADOS_PADRAO}" "$1"
}

resolver_chave_do_certificado() {
	if [[ -n "${SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA_DO_APP:-}" ]]; then
		printf '%s' "${SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA_DO_APP}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_DA_CHAVE_DO_CERTIFICADO}" && return 0
	printf '%s/%s.key' "${DIR_DOS_CERTIFICADOS_PADRAO}" "$1"
}

resolver_raiz_do_aplicativo() {
	if [[ -n "${SYSLOC_RAIZ_DO_APLICATIVO:-}" ]]; then
		printf '%s' "${SYSLOC_RAIZ_DO_APLICATIVO}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_RAIZ_DO_APLICATIVO}"
}

resolver_raiz_do_desafio_acme() {
	if [[ -n "${SYSLOC_RAIZ_DO_DESAFIO_ACME:-}" ]]; then
		printf '%s' "${SYSLOC_RAIZ_DO_DESAFIO_ACME}"
		return 0
	fi
	valor_no_arquivo_de_ambiente "${ARQ_AMBIENTE}" "${CHAVE_RAIZ_DO_DESAFIO_ACME}"
}

# =========================================================================== #
# Pré-condições. NENHUMA delas altera coisa alguma no sistema.
# =========================================================================== #
HOSTNAME_RESOLVIDO=""
CERTIFICADO_RESOLVIDO=""
CHAVE_RESOLVIDA=""
RAIZ_DO_APLICATIVO_RESOLVIDA=""
RAIZ_DO_DESAFIO_RESOLVIDA=""
DIR_DOS_VHOSTS=""
PORTA_DA_API=""

verificar_precondicoes() {
	if [[ "${EUID}" -ne 0 ]]; then
		abortar "este script precisa de privilégio administrativo — ele escreve em ${DIR_DOS_VHOSTS_PADRAO} e recarrega o servidor de borda" \
			"execute como 'sudo bash deploy/scripts/borda/instalar-borda-do-app.sh'"
	fi

	local faltando=() ferramenta
	for ferramenta in nginx install stat cmp sed grep awk systemctl; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale o que falta e execute de novo"
	fi

	[[ -r "${GABARITO}" ]] || abortar \
		"o gabarito do vhost não está legível em ${GABARITO}" \
		"execute a partir de um clone íntegro do repositório"

	# Antes de LER qualquer chave: o arquivo de ambiente não pode ser ambíguo.
	local repetidas_no_ambiente
	if repetidas_no_ambiente="$(chaves_repetidas_no_ambiente "${ARQ_AMBIENTE}")"; then
		abortar "${ARQ_AMBIENTE} atribui a mesma chave mais de uma vez: ${repetidas_no_ambiente}" \
			"deixe UMA atribuição por chave. O systemd resolve repetição pela ÚLTIMA e um leitor ingênuo pela PRIMEIRA, de modo que a borda seria instalada com um valor e o serviço subiria com outro, sem nada acusar"
	fi

	HOSTNAME_RESOLVIDO="$(resolver_hostname || true)"
	if [[ -z "${HOSTNAME_RESOLVIDO}" ]]; then
		abortar "não há hostname para o aplicativo do cliente — nem em SYSLOC_HOSTNAME_DO_APP nem na chave ${CHAVE_HOSTNAME} de ${ARQ_AMBIENTE}" \
			"decida qual hostname público atende o aplicativo e informe-o: 'sudo SYSLOC_HOSTNAME_DO_APP=<hostname> bash deploy/scripts/borda/instalar-borda-do-app.sh'; o repositório não fixa esse nome de propósito"
	fi

	# A FORMA dos valores resolvidos é conferida AQUI — antes de qualquer escrita
	# e no ponto único por onde as duas origens (variável de ambiente e
	# ${ARQ_AMBIENTE}) passam. Depois daqui eles viram configuração do servidor.
	if ! hostname_bem_formado "${HOSTNAME_RESOLVIDO}"; then
		abortar "o hostname resolvido não tem forma de nome de host: [${HOSTNAME_RESOLVIDO}]" \
			"corrija o valor em SYSLOC_HOSTNAME_DO_APP ou na chave ${CHAVE_HOSTNAME} de ${ARQ_AMBIENTE} — ele é interpolado no vhost e vira diretiva do nginx, de modo que espaço, ';' ou '|' publicariam configuração que ninguém escreveu"
	fi

	CERTIFICADO_RESOLVIDO="$(resolver_certificado "${HOSTNAME_RESOLVIDO}")"
	CHAVE_RESOLVIDA="$(resolver_chave_do_certificado "${HOSTNAME_RESOLVIDO}")"

	if ! caminho_bem_formado "${CERTIFICADO_RESOLVIDO}"; then
		abortar "o caminho do certificado não tem forma de caminho absoluto de arquivo: [${CERTIFICADO_RESOLVIDO}]" \
			"corrija o valor em SYSLOC_CERTIFICADO_DA_BORDA_DO_APP ou na chave ${CHAVE_CERTIFICADO} de ${ARQ_AMBIENTE} — ele vira a diretiva 'ssl_certificate' do vhost"
	fi
	if ! caminho_bem_formado "${CHAVE_RESOLVIDA}"; then
		abortar "o caminho da chave do certificado não tem forma de caminho absoluto de arquivo: [${CHAVE_RESOLVIDA}]" \
			"corrija o valor em SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA_DO_APP ou na chave ${CHAVE_DA_CHAVE_DO_CERTIFICADO} de ${ARQ_AMBIENTE} — ele vira a diretiva 'ssl_certificate_key' do vhost"
	fi

	[[ -r "${CERTIFICADO_RESOLVIDO}" ]] || abortar \
		"o certificado do hostname não está legível em ${CERTIFICADO_RESOLVIDO}" \
		"emita o certificado pelo servidor de borda antes de instalar, ou informe o caminho em SYSLOC_CERTIFICADO_DA_BORDA_DO_APP — um vhost TLS sem certificado impede o servidor INTEIRO de carregar"
	[[ -r "${CHAVE_RESOLVIDA}" ]] || abortar \
		"a chave do certificado não está legível em ${CHAVE_RESOLVIDA}" \
		"informe o caminho em SYSLOC_CHAVE_DO_CERTIFICADO_DA_BORDA_DO_APP"

	# A raiz da página única. Sem ela, ou sem o arquivo de entrada dentro dela, o
	# vhost é instalado "com sucesso" e toda tela responde 404 — o aplicativo
	# fica inalcançável e a causa não aparece em lugar nenhum da instalação.
	RAIZ_DO_APLICATIVO_RESOLVIDA="$(resolver_raiz_do_aplicativo || true)"
	if [[ -z "${RAIZ_DO_APLICATIVO_RESOLVIDA}" ]]; then
		abortar "não há raiz do aplicativo — nem em SYSLOC_RAIZ_DO_APLICATIVO nem na chave ${CHAVE_RAIZ_DO_APLICATIVO} de ${ARQ_AMBIENTE}" \
			"informe o diretório onde a página única construída está publicada: 'sudo SYSLOC_RAIZ_DO_APLICATIVO=<diretório> bash deploy/scripts/borda/instalar-borda-do-app.sh'"
	fi
	if ! caminho_bem_formado "${RAIZ_DO_APLICATIVO_RESOLVIDA}"; then
		abortar "a raiz do aplicativo não tem forma de caminho absoluto: [${RAIZ_DO_APLICATIVO_RESOLVIDA}]" \
			"corrija o valor em SYSLOC_RAIZ_DO_APLICATIVO ou na chave ${CHAVE_RAIZ_DO_APLICATIVO} de ${ARQ_AMBIENTE} — ele vira a diretiva 'root' do vhost"
	fi
	[[ -d "${RAIZ_DO_APLICATIVO_RESOLVIDA}" ]] || abortar \
		"a raiz do aplicativo não é um diretório existente: ${RAIZ_DO_APLICATIVO_RESOLVIDA}" \
		"publique a página única construída antes de instalar a borda"
	[[ -f "${RAIZ_DO_APLICATIVO_RESOLVIDA}/${ARQUIVO_DE_ENTRADA_DO_APLICATIVO}" ]] || abortar \
		"a raiz do aplicativo não contém ${ARQUIVO_DE_ENTRADA_DO_APLICATIVO}: ${RAIZ_DO_APLICATIVO_RESOLVIDA}" \
		"o fallback da página única serve esse arquivo para toda tela; sem ele o vhost é instalado e o aplicativo responde 404 em todo caminho"

	# A raiz do desafio de posse do domínio. Ela NÃO é conveniência: este vhost
	# vence a disputa de `server_name` da porta 80 do hostname que atende, e sem
	# ela o desafio em claro morre no 404 — a renovação do certificado falha, e
	# falha em silêncio, meses depois de quem instalou ter saído da frente.
	RAIZ_DO_DESAFIO_RESOLVIDA="$(resolver_raiz_do_desafio_acme || true)"
	if [[ -z "${RAIZ_DO_DESAFIO_RESOLVIDA}" ]]; then
		abortar "não há raiz do desafio de posse do domínio — nem em SYSLOC_RAIZ_DO_DESAFIO_ACME nem na chave ${CHAVE_RAIZ_DO_DESAFIO_ACME} de ${ARQ_AMBIENTE}" \
			"informe o webroot de quem administra o certificado deste hostname: 'sudo SYSLOC_RAIZ_DO_DESAFIO_ACME=<diretório> bash deploy/scripts/borda/instalar-borda-do-app.sh'. Sem ele a borda responde 404 ao desafio em claro e a RENOVAÇÃO do certificado falha em silêncio"
	fi
	if ! caminho_bem_formado "${RAIZ_DO_DESAFIO_RESOLVIDA}"; then
		abortar "a raiz do desafio não tem forma de caminho absoluto: [${RAIZ_DO_DESAFIO_RESOLVIDA}]" \
			"corrija o valor em SYSLOC_RAIZ_DO_DESAFIO_ACME ou na chave ${CHAVE_RAIZ_DO_DESAFIO_ACME} de ${ARQ_AMBIENTE} — ele vira a diretiva 'root' do bloco em claro"
	fi
	[[ -d "${RAIZ_DO_DESAFIO_RESOLVIDA}" ]] || abortar \
		"a raiz do desafio não é um diretório existente: ${RAIZ_DO_DESAFIO_RESOLVIDA}" \
		"confira o webroot de quem administra o certificado deste hostname — um 'root' inexistente faz o desafio receber 404 e a renovação falhar sem sintoma até o certificado vencer"

	DIR_DOS_VHOSTS="${SYSLOC_DIR_DOS_VHOSTS:-${DIR_DOS_VHOSTS_PADRAO}}"
	[[ -d "${DIR_DOS_VHOSTS}" ]] || abortar \
		"o diretório de vhosts ${DIR_DOS_VHOSTS} não existe" \
		"informe o diretório que este servidor de borda usa em SYSLOC_DIR_DOS_VHOSTS"

	# Vhost instalado num diretório que o servidor não lê existe e não atende —
	# e o sintoma (o cliente não alcança o produto) fica longe da causa.
	local veredito_do_include=0
	configuracao_inclui_diretorio "${CONFIGURACAO_DO_SERVIDOR}" "${DIR_DOS_VHOSTS}" ||
		veredito_do_include=$?
	case "${veredito_do_include}" in
	0) ;;
	1)
		abortar "a configuração do servidor (${CONFIGURACAO_DO_SERVIDOR}) não inclui ${DIR_DOS_VHOSTS}/, nem direta nem indiretamente" \
			"informe em SYSLOC_DIR_DOS_VHOSTS um dos diretórios que ela inclui: $(grep -E '^[[:space:]]*include[[:space:]]' "${CONFIGURACAO_DO_SERVIDOR}" | tr -s ' ' | tr '\n' ' ')"
		;;
	*)
		# Pré-condição não conferida NUNCA passa em silêncio — é a convenção de
		# `.claude/rules/testing-stack.md` para ferramenta ausente, e ela vale
		# igualmente para pré-condição de instalador: o que não foi medido tem
		# de ser dito, sob pena de o resumo verde afirmar mais do que se sabe.
		info "⚠️ não consegui ler ${CONFIGURACAO_DO_SERVIDOR} — NÃO foi conferido se ${DIR_DOS_VHOSTS}/ é incluído pelo servidor; se não for, o vhost será escrito e não atenderá. Prove com 'bash deploy/scripts/borda/verificar-borda-do-app.sh' depois desta execução"
		;;
	esac

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
		"${ENDERECO_DE_ESCUTA_DA_API}:${PORTA_DA_API}" \
		"${RAIZ_DO_APLICATIVO_RESOLVIDA}" \
		"${RAIZ_DO_DESAFIO_RESOLVIDA}" >"${rendido}" || abortar \
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
		# O MODO vai junto com o conteúdo, e no mesmo instante: é o arquivo de
		# QUEM ESTAVA AQUI, e a permissão dele não é decisão deste produto.
		MODO_ANTERIOR_DO_DESTINO="$(stat -c '%a' "${destino}")"
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

# P03-B · a disputa de `server_name`, conferida ANTES da recarga.
#
# Perder a disputa não quebra nada visível: o servidor sobe, o `nginx -t` passa,
# e a única pista é um `[warn]` no log. O que acontece é o aplicativo do cliente
# deixar de ser atendido. Por isso a conferência é ABORTIVA, e roda enquanto a
# janela de desfazimento ainda está aberta.
passo_p03b_conferir_precedencia() {
	local declarantes="" codigo=0
	declarantes="$(conferir_precedencia_do_vhost \
		"${DIR_DOS_VHOSTS}" "${NOME_DO_VHOST}" "${HOSTNAME_RESOLVIDO}")" || codigo=$?

	if [[ "${codigo}" -ne 0 && -z "${declarantes}" ]]; then
		abortar "nenhum vhost de ${DIR_DOS_VHOSTS} declara ${HOSTNAME_RESOLVIDO} — nem o que este script acabou de escrever" \
			"o vhost existe e não atende: confira ${DIR_DOS_VHOSTS}/${NOME_DO_VHOST} e o gabarito em ${GABARITO}"
	fi

	if [[ "${codigo}" -ne 0 ]]; then
		abortar "outro vhost VENCE a disputa de '${HOSTNAME_RESOLVIDO}' e esta borda seria IGNORADA: $(printf '%s' "${declarantes}" | tr '\n' ' ')" \
			"o servidor fica com o PRIMEIRO da lista acima (ordem lexicográfica do 'include') e ignora os demais com um aviso que ninguém lê. Renomeie o rival para ordenar depois de ${NOME_DO_VHOST}, ou remova-o — o aplicativo não é atendido enquanto ele vencer"
	fi

	local quantos rivais
	quantos="$(printf '%s' "${declarantes}" | grep -c . || true)"
	if [[ "${quantos}" -gt 1 ]]; then
		rivais="$(printf '%s' "${declarantes}" | grep -vxF "${NOME_DO_VHOST}" | tr '\n' ' ')"
		info "P03-B ⚠️ ${quantos} vhosts declaram ${HOSTNAME_RESOLVIDO}; esta borda VENCE e os demais são ignorados pelo servidor: ${rivais}"
	else
		info "P03-B esta borda é a única a declarar ${HOSTNAME_RESOLVIDO}"
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
		"leia a saída acima: conflito com outro vhost (mesmo hostname, mesma porta) é a causa mais comum; o servidor NÃO foi recarregado, e o arquivo de destino voltou ao conteúdo e à permissão que tinha antes desta execução"
}

passo_p05_recarregar() {
	local destino="${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"

	# Recarregar sem necessidade é micro-indisponibilidade de graça numa borda
	# compartilhada com quem atende a operação hoje. O que o `total_criado`
	# sozinho não vê é o SEGUNDO sinal: ele fala do disco, e o disco não
	# responde requisição.
	if [[ "${total_criado}" -eq 0 ]]; then
		local veredito_do_carregamento=0
		servidor_ja_carregou "${destino}" || veredito_do_carregamento=$?
		case "${veredito_do_carregamento}" in
		0)
			ja_ok "P05" "nada mudou e o servidor de borda já atende este vhost — NÃO recarregado"
			return 0
			;;
		1)
			info "⚠️ o vhost já estava correto em disco, mas o servidor em execução é ANTERIOR a ele — recarregando"
			systemctl reload nginx
			criado "P05" "servidor de borda recarregado (disco já convergente, processo não)"
			return 0
			;;
		*)
			# Não conferido nunca passa em silêncio, e na dúvida NÃO se
			# recarrega: o custo de errar para este lado é uma execução a mais
			# do verificador; para o outro, é indisponibilidade numa borda que
			# atende a operação.
			ja_ok "P05" "nada mudou — servidor de borda NÃO recarregado"
			info "⚠️ não consegui conferir se o servidor em execução já carregou ${destino}; prove com 'bash deploy/scripts/borda/verificar-borda-do-app.sh'"
			return 0
			;;
		esac
	fi

	systemctl reload nginx
	criado "P05" "servidor de borda recarregado"
}

resumir() {
	printf '%s resumo: %d passo(s) com mudança, %d já correto(s)\n' \
		"${PREFIXO}" "${total_criado}" "${total_ja_ok}"
	info "o prefixo de versão é repassado à API ANTES do fallback da página única; o contrato morre nesta borda"
	info "prove por medição com: bash deploy/scripts/borda/verificar-borda-do-app.sh"
}

main() {
	printf '%s instalação da borda pública do aplicativo do cliente\n' "${PREFIXO}"

	verificar_precondicoes
	passo_p01_renderizar
	passo_p03_posicionar
	passo_p03b_conferir_precedencia
	passo_p04_validar_configuracao_inteira
	passo_p05_recarregar

	resumir
}

main "$@"
