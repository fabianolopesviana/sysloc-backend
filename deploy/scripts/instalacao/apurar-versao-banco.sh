#!/usr/bin/env bash
#
# Apuração da divergência de versão do banco — T4 da fatia `fundacao-stack-nativa`
# (CA-14, critério de saída da fatia).
#
# Lê `SHOW server_version` nos DOIS lados — o banco que a verificação automatizada levanta e o
# banco que atende a operação — e grava o resultado num registro versionado, com uma conclusão
# explícita sobre haver ou não divergência.
#
# ---------------------------------------------------------------------------
# Por que este procedimento existe agora, sem consumidor imediato
# ---------------------------------------------------------------------------
#
# Nenhuma migração existe nesta fatia. O registro existe porque quem escrever a PRIMEIRA — na
# fatia seguinte — precisa saber contra qual versão os testes rodam: um recurso que exista só na
# versão maior passaria verde na verificação e quebraria na operação, e a descoberta viria pelo
# pior caminho possível.
#
# ---------------------------------------------------------------------------
# ADR-0005 — nenhuma credencial neste arquivo
# ---------------------------------------------------------------------------
#
# Este script é versionado e NÃO carrega segredo. A credencial de cada lado é lida em tempo de
# execução de um arquivo de ambiente que vive fora da árvore versionada (o mesmo
# `EnvironmentFile=` 0600 que as unidades de serviço consomem), e daí vai para o cliente do
# banco por um arquivo de senha temporário com modo 0600 — nunca por argumento de linha de
# comando, onde qualquer usuário da máquina a leria em `ps`, e nunca por variável de ambiente
# exportada, que todo processo filho herdaria. Pela mesma razão, o rastreio verboso de comandos
# do shell jamais é ligado aqui: ele ecoaria o valor.
#
# ---------------------------------------------------------------------------
# ADR-0006 — os dois lados são instâncias distintas, e é esse o ponto
# ---------------------------------------------------------------------------
#
# A suíte de verificação nunca executa contra o ambiente que atende a operação. Este script é a
# única rotina do repositório que fala com os DOIS — e fala com cada um por leitura, uma única
# consulta que não escreve nada. É o que torna a divergência entre eles um dado, e não uma
# suposição.
#
# ---------------------------------------------------------------------------
# Parâmetros (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_ARQ_AMBIENTE_VERIFICACAO   OBRIGATÓRIA. Arquivo de ambiente com a linha
#                                     `DATABASE_URL=` da instância EFÊMERA que a verificação
#                                     levanta. Não tem valor padrão de propósito: instância
#                                     efêmera não tem endereço fixo, e inventar um faria o
#                                     procedimento apurar a versão de outra coisa.
#
#   SYSLOC_ARQ_AMBIENTE               Arquivo de ambiente do lado da operação.
#                                     Padrão: /etc/sysloc/backend.env (criado por
#                                     provisionar-base.sh, modo 0600).
#
#   SYSLOC_REGISTRO_VERSAO            Registro a gravar.
#                                     Padrão: docs/specs/features/fundacao-stack-nativa/v1/
#                                     VERSAO-BANCO.md
#
# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
#
#   # com a instância efêmera de pé (a suíte a levanta; ver packages/shared/test/)
#   SYSLOC_ARQ_AMBIENTE_VERIFICACAO=/caminho/verificacao.env \
#     sudo -E bash deploy/scripts/instalacao/apurar-versao-banco.sh
#
# Esta é a ÚNICA forma de fechar a CA-14: é ela que faz o rótulo do lado da operação sair como
# `Operação (instância provisionada)`. Sem privilégio, `/etc/sysloc/backend.env` é ilegível, e o
# procedimento só consegue apurar o lado da operação contra um substituto — o que ele registra
# como tal, com `SUBSTITUTO` no próprio rótulo e a pendência declarada no corpo do arquivo.
# Nenhuma outra variável precisa ser informada: `SYSLOC_ARQ_AMBIENTE` já tem aquele caminho como
# padrão.
#
# O privilégio é exigido apenas para LER /etc/sysloc/backend.env, que é 0600 do superusuário.
# NÃO é exigido para falar com o cluster: `provisionar-base.sh` o configura com
# `listen_addresses = '127.0.0.1'`, de modo que a conexão do caminho privilegiado acontece pelo
# endereço de retorno, na forma `postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO`.
#
# A forma de socket (`postgresql://PAPEL:SEGREDO@/BANCO?host=DIRETORIO&port=PORTA`) continua
# aceita aqui em pé de igualdade, e o caso CT-007 da verificação continua exercitando-a de ponta a
# ponta contra instância própria por socket: `psql` a alcança sem tradução, e uma instância
# efêmera que só escute em socket é destino legítimo do lado da VERIFICAÇÃO. O que mudou é qual
# das duas o arquivo de ambiente da operação carrega — e essa mudança tem causa: socket de domínio
# Unix não cabe numa URL, e o cliente que a aplicação usa recusa a cadeia antes de conectar. Ver
# o cabeçalho de `provisionar-base.sh`, seção "Por que o banco escuta em TCP".
#
# Executá-lo duas vezes seguidas termina com sucesso nas duas e deixa UMA seção de apuração: o
# registro é reescrito por inteiro, não acumulado (CA-11). Quando qualquer um dos dois lados não
# responde, o procedimento falha NOMEANDO a fonte e não toca no registro anterior — apuração
# pela metade não é apuração (CA-14), e um registro com "indisponível" no lugar de uma versão
# seria lido pela fatia seguinte como se fosse dado.
#
# Verificação correspondente:
#
#   bash deploy/scripts/instalacao/verificar-apuracao-versao.sh
#

set -Eeuo pipefail

# --------------------------------------------------------------------------- #
# Constantes.
# --------------------------------------------------------------------------- #
readonly PREFIXO="[apurar-versao]"

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly ARQ_AMBIENTE_PADRAO="/etc/sysloc/backend.env"
readonly REGISTRO_PADRAO="${RAIZ_REPO}/docs/specs/features/fundacao-stack-nativa/v1/VERSAO-BANCO.md"

# Cabeçalho da seção de apuração. O registro tem exatamente UM — é o que a verificação de
# idempotência conta.
readonly CABECALHO_APURACAO="## Apuração"

# Limite de espera por conexão, em segundos. Sem ele, um endereço inalcançável ficaria pendurado
# no tempo padrão do sistema e o procedimento pareceria travado em vez de falhar.
readonly LIMITE_CONEXAO_S=5

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
ARQ_VERIFICACAO="${SYSLOC_ARQ_AMBIENTE_VERIFICACAO:-}"
ARQ_OPERACAO="${SYSLOC_ARQ_AMBIENTE:-${ARQ_AMBIENTE_PADRAO}}"
REGISTRO="${SYSLOC_REGISTRO_VERSAO:-${REGISTRO_PADRAO}}"

# --------------------------------------------------------------------------- #
# Estado interno. Nenhuma destas variáveis é exportada: exportá-las colocaria o segredo no
# ambiente de todo processo filho.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
URL_LIDA=""
CHAVES_REPETIDAS=""
URL_PAPEL=""
URL_SEGREDO=""
URL_HOSPEDEIRO=""
URL_PORTA=""
URL_BANCO=""
VERSAO_VERIFICACAO=""
VERSAO_OPERACAO=""
DESTINO_VERIFICACAO=""
DESTINO_OPERACAO=""

# --------------------------------------------------------------------------- #
# Saída legível. Toda mensagem de falha diz O QUE falhou, POR QUÊ e O QUE FAZER.
# --------------------------------------------------------------------------- #
info() { printf '%s ..    %s\n' "${PREFIXO}" "$*"; }
erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }
# Aviso NÃO é falha: o procedimento fez tudo o que consegue fazer e sai 0. Ele existe para o que
# ficou por fazer e depende de algo que este processo não tem — hoje, privilégio.
aviso() { printf '%s AVISO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer
abortar() {
	# O gatilho de falha inesperada é desligado antes de sair: sem isto, o próprio `exit` abaixo
	# o dispararia e a saída ganharia uma segunda mensagem de erro, genérica, logo depois da
	# mensagem específica — quem lê acabaria investigando a genérica.
	trap - ERR
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit 1
}

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	# O registro é gravado por arquivo intermediário e renomeado. Se o procedimento morrer entre
	# as duas operações, o intermediário não pode ficar ao lado do registro — quem o encontrasse
	# depois não teria como saber que ele é lixo de uma execução interrompida.
	if [[ -n "${REGISTRO}" && -f "${REGISTRO}.tmp" ]]; then
		rm -f "${REGISTRO}.tmp"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal chama `exit` com o
# código convencional (128 + número do sinal), o que dispara o trap uma única vez.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"' ERR

# --------------------------------------------------------------------------- #
# Leitura da configuração. Sem efeito colateral: não escreve, não conecta, não pede privilégio
# além do necessário para ler o arquivo. É por isso que a bateria consegue exercitá-la
# diretamente, carregando-a do arquivo REAL — quem valida e quem executa são o mesmo código.
#
# Devolve, por código de saída:
#   0  URL íntegra em ${URL_LIDA}
#   1  arquivo inexistente ou ilegível
#   2  arquivo sem linha DATABASE_URL utilizável
#   3  atribuição repetida — ${CHAVES_REPETIDAS} nomeia as chaves ambíguas
# --------------------------------------------------------------------------- #
extrair_url_do_arquivo() {
	local arquivo="$1"
	URL_LIDA=""
	CHAVES_REPETIDAS=""

	if [[ ! -r "${arquivo}" ]]; then
		return 1
	fi

	# Atribuição repetida é AMBIGUIDADE, e ambiguidade se recusa — não se resolve escolhendo um
	# lado. O `EnvironmentFile=` do systemd usa a ÚLTIMA ocorrência e um leitor ingênuo usaria a
	# PRIMEIRA; apurar a versão de um destino e as unidades de serviço apontarem para outro é
	# exatamente o tipo de divergência que este procedimento existe para não deixar acontecer.
	local repetidas
	repetidas="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d | tr -d '=' | tr '\n' ' ' || true)"
	if [[ -n "${repetidas// /}" ]]; then
		CHAVES_REPETIDAS="${repetidas% }"
		return 3
	fi

	local valor
	valor="$(sed -n 's|^DATABASE_URL=||p' "${arquivo}")"
	if [[ -z "${valor}" ]]; then
		return 2
	fi

	URL_LIDA="${valor}"
	return 0
}

# --------------------------------------------------------------------------- #
# Decomposição da cadeia de conexão nas partes que o cliente do banco precisa receber
# separadamente — é o que permite manter o segredo fora do argumento de linha de comando.
#
# Aceita as duas formas em uso nesta base:
#   postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO
#   postgresql://PAPEL:SEGREDO@/BANCO?host=DIRETORIO_DO_SOCKET&port=PORTA
#
# A captura da credencial vai até o ÚLTIMO '@' de propósito: com uma classe restrita, um segredo
# que contivesse '@' seria cortado no primeiro deles e o pedaço seguiria adiante como se fosse a
# credencial inteira — a conexão falharia e a mensagem culparia o servidor.
#
# Devolve 0 quando decompôs, 1 quando a cadeia é irreconhecível.
# --------------------------------------------------------------------------- #
decompor_url() {
	local url="$1"
	URL_PAPEL=""
	URL_SEGREDO=""
	URL_HOSPEDEIRO=""
	URL_PORTA=""
	URL_BANCO=""

	local resto=""
	case "${url}" in
	postgresql://*) resto="${url#postgresql://}" ;;
	postgres://*) resto="${url#postgres://}" ;;
	*) return 1 ;;
	esac

	[[ "${resto}" == *@* ]] || return 1
	local credencial="${resto%@*}"
	local destino="${resto##*@}"

	[[ "${credencial}" == *:* ]] || return 1
	URL_PAPEL="${credencial%%:*}"
	URL_SEGREDO="${credencial#*:}"

	# CODIFICAÇÃO PERCENTUAL — recusada com diagnóstico PRÓPRIO (código 2).
	#
	# Este procedimento nunca decodificou `%XX`, e até 2026-08-04 o `%` era barrado
	# por efeito colateral do guarda de alfabeto que a rodada 3 removeu. Sem
	# guarda, uma senha escrita na posição do SEGREDO como `p%3Ass` — a forma
	# CANÔNICA de URI para expressar ':' numa senha, e o que `postgres.js` e a
	# libpq decodificam — atravessa como o literal `p%3Ass`, o servidor recusa a
	# autenticação, e o `abortar` da consulta manda conferir se a instância está de
	# pé. É o diagnóstico que culpa o SERVIDOR por um defeito de configuração,
	# exatamente o que o cabeçalho deste arquivo declara existir para não produzir.
	#
	# ⚠️ O exemplo acima NÃO monta uma cadeia de conexão completa, de propósito: a
	# varredura de credencial do `CT-009` reprova este arquivo se ela aparecer com
	# valor no lugar do segredo — e reprovou, na primeira redação deste bloco. O
	# formato aceito já está no cabeçalho, com marcador.
	#
	# Recusar, e não decodificar: decodificar introduziria um caminho novo de
	# manipulação de credencial num script que fala com o banco durável, para
	# atender uma forma que NENHUM produtor deste repositório emite —
	# `provisionar-base.sh` gera letras e números, `postgres-efemero.ts` gera
	# base64url. O cenário é o arquivo de ambiente regravado à mão, e para ele o
	# que falta é o diagnóstico certo, não a tolerância.
	case "${credencial}" in
	*%*) return 2 ;;
	esac

	if [[ "${destino}" == /* ]]; then
		local caminho="${destino%%\?*}"
		URL_BANCO="${caminho#/}"
		local consulta=""
		[[ "${destino}" == *\?* ]] && consulta="${destino#*\?}"
		local par
		local IFS='&'
		for par in ${consulta}; do
			case "${par}" in
			host=*) URL_HOSPEDEIRO="${par#host=}" ;;
			port=*) URL_PORTA="${par#port=}" ;;
			esac
		done
	else
		local autoridade="${destino%%/*}"
		local caminho="${destino#*/}"
		URL_BANCO="${caminho%%\?*}"
		URL_HOSPEDEIRO="${autoridade%%:*}"
		if [[ "${autoridade}" == *:* ]]; then
			URL_PORTA="${autoridade##*:}"
		fi
	fi

	[[ -n "${URL_PAPEL}" && -n "${URL_SEGREDO}" && -n "${URL_BANCO}" ]] || return 1
	[[ -n "${URL_HOSPEDEIRO}" ]] || return 1
	[[ "${URL_PORTA}" =~ ^[0-9]+$ ]] || return 1
	return 0
}

# --------------------------------------------------------------------------- #
# Escape de um campo do arquivo de senha do cliente.
#
# O formato separa os campos por ':' e prevê escape com '\' para EXATAMENTE dois caracteres: o
# próprio ':' e o próprio '\'. Nenhum outro é especial ali — '-', '_', '@', '?', '&' e '/'
# atravessam inertes.
#
# É por isso que a lista-branca `[A-Za-z0-9]` de `provisionar-base.sh` não se transporta para cá,
# ainda que os dois scripts manipulem a mesma credencial do lado da operação: lá ela viaja dentro
# de uma URL, onde ':', '@', '?', '&' e '/' são delimitadores, e restringir o alfabeto é a decisão
# registrada naquele arquivo. Aqui o destino é outro formato, com outro conjunto especial. Importar
# a restrição recusava caracteres que este formato carrega — e recusava justamente os do lado da
# VERIFICAÇÃO, que não passa por `provisionar-base.sh`: a instância efêmera é levantada pela suíte,
# que gera a credencial com `randomBytes(24).toString('base64url')`, alfabeto que inclui '-' e '_'.
# O efeito era abortar, antes de qualquer conexão, o único caminho documentado que fecha a CA-14,
# mandando o operador gravar uma credencial que não é ele quem escolhe.
#
# A ordem das duas substituições importa: a barra invertida é dobrada ANTES de a barra de escape do
# ':' ser introduzida — na ordem inversa, a barra recém-introduzida seria dobrada também e o
# cliente leria uma barra literal seguida do separador de campo.
#
# ADR-0005 continua valendo: isto é uma FUNÇÃO do shell, não um programa externo. O valor viaja
# como parâmetro posicional de um subshell do próprio processo, sem `exec` — não há linha de
# comando nova para `ps` mostrar, e nada é exportado para o ambiente de processo filho algum.
# --------------------------------------------------------------------------- #
escapar_para_arquivo_de_senha() {
	local valor="${1//\\/\\\\}"
	printf '%s' "${valor//:/\\:}"
}

# --------------------------------------------------------------------------- #
# Extrai o número de versão do que o servidor reporta.
#
# `SHOW server_version` devolve `18.4` num binário compilado do fonte e
# `18.4 (Ubuntu 18.4-1.pgdg24.04+1)` num pacote de distribuição. As duas pontas desta apuração
# vêm de origens diferentes por construção, então comparar as cadeias cruas acusaria divergência
# onde não há nenhuma. O que se compara é o número; as cadeias cruas ficam registradas inteiras.
# --------------------------------------------------------------------------- #
versao_numerica() {
	printf '%s' "$1" | sed -nE 's/^[[:space:]]*([0-9]+(\.[0-9]+)*).*/\1/p'
}

# --------------------------------------------------------------------------- #
# Conclusão da apuração: UMA linha, começando por `Sem divergência` ou por `Divergência`.
#
# A forma importa tanto quanto o conteúdo. Quem escrever a primeira migração vai ler esta linha
# — e uma conclusão que dissesse "as versões podem divergir" não decidiria nada.
#
# Devolve 0 quando não há divergência e 1 quando há.
# --------------------------------------------------------------------------- #
concluir_divergencia() {
	local numero_verificacao numero_operacao
	numero_verificacao="$(versao_numerica "$1")"
	numero_operacao="$(versao_numerica "$2")"

	if [[ "${numero_verificacao}" == "${numero_operacao}" ]]; then
		printf 'Sem divergência: os dois lados executam PostgreSQL %s.\n' "${numero_verificacao}"
		return 0
	fi

	printf 'Divergência: a verificação executa PostgreSQL %s e a operação executa PostgreSQL %s.\n' \
		"${numero_verificacao}" "${numero_operacao}"
	return 1
}

# --------------------------------------------------------------------------- #
# Consulta a versão de um lado. Aborta NOMEANDO a fonte que faltou — o endereço e a porta quando
# o destino não responde, o nome da variável quando a configuração não foi informada.
#
# $1 = rótulo do lado · $2 = caminho do arquivo de ambiente · $3 = nome da variável que o aponta
# Resultado em ${VERSAO_LIDA} e ${DESTINO_LIDO}.
# --------------------------------------------------------------------------- #
VERSAO_LIDA=""
DESTINO_LIDO=""

ler_versao_do_lado() {
	local rotulo="$1" arquivo="$2" variavel="$3"
	VERSAO_LIDA=""
	DESTINO_LIDO=""

	if [[ -z "${arquivo}" ]]; then
		abortar "a configuração do lado da ${rotulo} não foi informada: a variável de ambiente ${variavel} está ausente ou vazia" \
			"exporte ${variavel} apontando para o arquivo de ambiente daquele lado (o mesmo arquivo 0600 que as unidades de serviço consomem) e execute de novo"
	fi

	local codigo=0
	extrair_url_do_arquivo "${arquivo}" || codigo=$?
	case "${codigo}" in
	0) : ;;
	1)
		abortar "não consegui ler o arquivo de ambiente do lado da ${rotulo}: ${arquivo} não existe ou não é legível por este usuário (apontado por ${variavel})" \
			"confira o caminho e a permissão; o arquivo do lado da operação é 0600 do superusuário, então a apuração daquele lado exige privilégio"
		;;
	2)
		abortar "o arquivo de ambiente do lado da ${rotulo} (${arquivo}) não tem linha 'DATABASE_URL=' de onde ler o destino" \
			"acrescente a linha DATABASE_URL ao arquivo, ou aponte ${variavel} para o arquivo correto"
		;;
	3)
		abortar "o arquivo de ambiente do lado da ${rotulo} (${arquivo}) atribui mais de uma vez a(s) chave(s): ${CHAVES_REPETIDAS} — o arquivo é ambíguo e este procedimento se recusa a escolher por você" \
			"deixe exatamente UMA atribuição de cada chave (apague as linhas antigas em vez de acrescentar novas) e execute de novo"
		;;
	*)
		abortar "a leitura de ${arquivo} devolveu o desfecho inesperado ${codigo}" \
			"isto é defeito do próprio procedimento; reporte-o antes de prosseguir"
		;;
	esac

	local desfecho_da_decomposicao=0
	decompor_url "${URL_LIDA}" || desfecho_da_decomposicao=$?
	case "${desfecho_da_decomposicao}" in
	0) ;;
	2)
		abortar "a credencial do lado da ${rotulo}, lida de ${arquivo}, usa CODIFICAÇÃO PERCENTUAL ('%XX') — este procedimento não a decodifica" \
			"grave o valor CRU no arquivo de ambiente: ':' e '@' na senha atravessam inertes até o arquivo de senha do cliente, que este procedimento escapa. Se o valor precisa mesmo de '%', ele não pode ser apurado por aqui — e seguir adiante faria a autenticação falhar e este script culpar o servidor"
		;;
	*)
		abortar "a cadeia de conexão do lado da ${rotulo}, lida de ${arquivo}, está em formato irreconhecível" \
			"use uma das duas formas aceitas: postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO ou postgresql://PAPEL:SEGREDO@/BANCO?host=DIRETORIO&port=PORTA"
		;;
	esac

	DESTINO_LIDO="${URL_HOSPEDEIRO}:${URL_PORTA}"

	# Os campos do arquivo de senha vão ESCAPADOS — todos, não só a credencial. Sem isso, um ':' em
	# qualquer um deles produziria uma linha com um campo a mais: o cliente leria só o pedaço
	# anterior ao ':' como senha, a autenticação falharia, e o `abortar` da consulta abaixo
	# culparia o SERVIDOR, mandando conferir se a instância está de pé quando o problema é a
	# gravação desta linha. É exatamente o diagnóstico enganoso que este procedimento existe para
	# não produzir. A porta não passa por aqui porque `decompor_url` já a exigiu numérica.
	local campo_hospedeiro campo_banco campo_papel campo_segredo
	campo_hospedeiro="$(escapar_para_arquivo_de_senha "${URL_HOSPEDEIRO}")"
	campo_banco="$(escapar_para_arquivo_de_senha "${URL_BANCO}")"
	campo_papel="$(escapar_para_arquivo_de_senha "${URL_PAPEL}")"
	campo_segredo="$(escapar_para_arquivo_de_senha "${URL_SEGREDO}")"

	# O arquivo de senha nasce com 0600 ANTES de qualquer byte de segredo entrar nele: não há
	# janela em que o conteúdo exista com permissão frouxa. Ele vive no diretório temporário que
	# o trap apaga, inclusive quando o procedimento falha.
	local arq_credencial="${DIR_TEMPORARIO}/credencial-${rotulo}"
	install -m 0600 /dev/null "${arq_credencial}"
	# Na forma de socket, o cliente do banco troca o caminho do diretório por `localhost` ao
	# procurar a entrada — mas SÓ quando o diretório é o padrão de compilação dele
	# (`/var/run/postgresql` nesta distribuição, que é justamente o que o provisionamento usa).
	# Num diretório qualquer, a entrada procurada é o caminho literal. O padrão de compilação não
	# é interrogável daqui, então as duas entradas são escritas: a busca para na primeira que
	# casar, e a que sobrar é inerte. Escrever só uma faria a conexão falhar pedindo uma senha que
	# já estava no arquivo — e a mensagem culparia o servidor.
	{
		printf '%s:%s:%s:%s:%s\n' \
			"${campo_hospedeiro}" "${URL_PORTA}" "${campo_banco}" "${campo_papel}" "${campo_segredo}"
		if [[ "${URL_HOSPEDEIRO}" == /* ]]; then
			printf 'localhost:%s:%s:%s:%s\n' \
				"${URL_PORTA}" "${campo_banco}" "${campo_papel}" "${campo_segredo}"
		fi
	} >"${arq_credencial}"

	local saida="" falha=0
	saida="$(
		PGPASSFILE="${arq_credencial}" PGCONNECT_TIMEOUT="${LIMITE_CONEXAO_S}" \
			psql -X -q -A -t -w \
			--host="${URL_HOSPEDEIRO}" --port="${URL_PORTA}" \
			--username="${URL_PAPEL}" --dbname="${URL_BANCO}" \
			-c 'SHOW server_version' 2>&1
	)" || falha=$?

	# O arquivo de senha some assim que a consulta termina — ele não precisa sobreviver ao uso.
	rm -f "${arq_credencial}"

	if [[ "${falha}" -ne 0 || -z "${saida}" ]]; then
		abortar "não consegui ler a versão do lado da ${rotulo} em ${DESTINO_LIDO} (banco '${URL_BANCO}', papel '${URL_PAPEL}', configuração em ${arquivo}): ${saida}" \
			"confirme que a instância daquele endereço e porta está de pé e aceita este papel; NADA foi gravado no registro — apuração pela metade não é apuração"
	fi

	VERSAO_LIDA="$(printf '%s' "${saida}" | head -1 | tr -d '\r')"

	# Uma resposta sem número de versão reconhecível torna a comparação sem sentido, e a
	# conclusão sairia dizendo que "os dois lados executam PostgreSQL " — falha travestida de
	# apuração. Melhor recusar aqui, com a fonte nomeada.
	if [[ -z "$(versao_numerica "${VERSAO_LIDA}")" ]]; then
		abortar "o lado da ${rotulo} (${DESTINO_LIDO}) respondeu '${VERSAO_LIDA}', de onde não sai um número de versão" \
			"confirme que o endereço aponta para um servidor PostgreSQL; NADA foi gravado no registro"
	fi
}

# --------------------------------------------------------------------------- #
# Rótulo do lado da operação — DERIVADO do arquivo de ambiente que foi de fato lido.
#
# Este script não tem como perguntar a um servidor "você é o cluster provisionado?". O único fato
# que ele possui é DE ONDE leu a configuração, e é só isso que o rótulo pode afirmar. Um literal
# fixo dizendo `instância provisionada` afirmaria ter falado com o cluster provisionado qualquer
# que fosse o arquivo lido — e quem lê uma tabela lê o rótulo, não a prosa embaixo dela. O
# registro é consumido pela fatia seguinte como apuração concluída (CA-14); afirmação que o
# procedimento não sustenta vira suposição travestida de dado.
#
# Devolve 0 quando a configuração é a da operação e 1 quando a leitura veio de um substituto.
# --------------------------------------------------------------------------- #
rotulo_do_lado_da_operacao() {
	if [[ "${ARQ_OPERACAO}" == "${ARQ_AMBIENTE_PADRAO}" ]]; then
		printf 'Operação (instância provisionada)'
		return 0
	fi
	printf 'Operação (SUBSTITUTO — configuração em %s)' "${ARQ_OPERACAO}"
	return 1
}

# --------------------------------------------------------------------------- #
# Gravação do registro. Reescreve o arquivo INTEIRO, por arquivo intermediário e renomeação: o
# registro nunca existe pela metade, e uma segunda execução não acumula seção (CA-11).
# --------------------------------------------------------------------------- #
gravar_registro() {
	local conclusao="" divergiu=0
	conclusao="$(concluir_divergencia "${VERSAO_VERIFICACAO}" "${VERSAO_OPERACAO}")" || divergiu=1

	local rotulo_operacao="" operacao_substituta=0
	rotulo_operacao="$(rotulo_do_lado_da_operacao)" || operacao_substituta=1

	local diretorio
	diretorio="$(dirname "${REGISTRO}")"
	mkdir -p "${diretorio}"

	{
		printf '# Versão do banco: verificação × operação (CA-14)\n\n'
		printf '> **Arquivo gerado** por `deploy/scripts/instalacao/apurar-versao-banco.sh`.\n'
		printf '> Não edite à mão: a próxima execução reescreve o arquivo inteiro. Para atualizá-lo,\n'
		printf '> execute o procedimento de novo.\n\n'
		printf 'Este registro existe porque quem escrever a primeira migração precisa saber contra qual\n'
		printf 'versão os testes rodam. A verificação levanta instância efêmera própria (ADR-0006) e a\n'
		printf 'operação roda a instância provisionada por `provisionar-base.sh`: as duas vêm de origens\n'
		printf 'diferentes por construção, e a diferença entre elas é dado, não suposição.\n\n'

		printf '%s\n\n' "${CABECALHO_APURACAO}"
		printf '| Lado | Configuração lida | Destino consultado | `SHOW server_version` |\n'
		printf '|---|---|---|---|\n'
		printf '| Verificação (instância efêmera da suíte) | `%s` | `%s` | `%s` |\n' \
			"${ARQ_VERIFICACAO}" "${DESTINO_VERIFICACAO}" "${VERSAO_VERIFICACAO}"
		printf '| %s | `%s` | `%s` | `%s` |\n\n' \
			"${rotulo_operacao}" "${ARQ_OPERACAO}" "${DESTINO_OPERACAO}" "${VERSAO_OPERACAO}"
		printf 'Data da apuração: %s\n\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
		printf '%s\n' "${conclusao}"
		printf '\n'
		printf 'As duas leituras vieram de `SHOW server_version` executado na instância que a\n'
		printf 'configuração de cada lado aponta — nenhuma delas foi inferida de pacote instalado ou\n'
		printf 'de arquivo de configuração. O rótulo do lado da operação é **derivado** do arquivo de\n'
		printf 'ambiente que foi lido, e não escrito à mão: ele só diz `instância provisionada` quando\n'
		printf 'a configuração veio de `%s`, que é o arquivo que as unidades de\n' "${ARQ_AMBIENTE_PADRAO}"
		printf 'serviço consomem; qualquer outro caminho produz `SUBSTITUTO` no próprio rótulo.\n\n'

		if [[ "${operacao_substituta}" -eq 1 ]]; then
			printf '> **A apuração do lado da operação está PENDENTE.** A linha acima não veio da\n'
			printf '> instância provisionada: a configuração lida foi `%s`, e não\n' "${ARQ_OPERACAO}"
			printf '> `%s`. Enquanto o rótulo marcar `SUBSTITUTO`, a CA-14 **não\n' "${ARQ_AMBIENTE_PADRAO}"
			printf '> está fechada** — registro parcial não conta como apuração, e o número da direita\n'
			printf '> descreve o substituto, não o banco que atende a operação.\n'
			printf '>\n'
			printf '> O arquivo da operação é 0600 do superusuário, então carimbá-la exige privilégio.\n'
			printf '> Com a instância efêmera da verificação de pé, execute exatamente:\n'
			printf '>\n'
			printf '> ```bash\n'
			printf '> SYSLOC_ARQ_AMBIENTE_VERIFICACAO=/caminho/para/verificacao.env \\\n'
			printf '>   sudo -E bash deploy/scripts/instalacao/apurar-versao-banco.sh\n'
			printf '> ```\n'
			printf '>\n'
			printf '> Nada mais precisa ser informado: `SYSLOC_ARQ_AMBIENTE` já tem `%s`\n' "${ARQ_AMBIENTE_PADRAO}"
			printf '> como padrão, e este procedimento aceita as duas formas de cadeia de conexão em\n'
			printf '> uso nesta base — a de endereço e porta, que é a daquele arquivo, e a de socket.\n'
			printf '> A execução reescreve este arquivo inteiro e o rótulo passa a dizer `instância\n'
			printf '> provisionada` porque aí será verdade.\n\n'
		fi

		printf '## O que quem escrever a primeira migração precisa saber\n\n'
		if [[ "${operacao_substituta}" -eq 1 ]]; then
			printf -- '- **Não trate esta apuração como concluída.** O lado da operação foi lido de um\n'
			printf -- '  substituto, e a conclusão acima compara a verificação com ele — não com o banco\n'
			printf -- '  que atende a operação. Rode o comando privilegiado indicado antes de fixar\n'
			printf -- '  qualquer decisão de migração na versão do lado direito.\n'
		fi
		if [[ "${divergiu}" -eq 0 ]]; then
			if [[ "${operacao_substituta}" -eq 1 ]]; then
				printf -- '- Os dois lados AQUI APURADOS estão na mesma versão — indício favorável, não\n'
				printf -- '  garantia: o lado direito é o substituto, e não a instância provisionada. Nenhuma\n'
				printf -- '  decisão do tipo "o que a verificação aprovar vale para a operação" se apoia nesta\n'
				printf -- '  linha enquanto o rótulo disser `SUBSTITUTO`.\n'
			else
				printf -- '- Os dois lados estão na mesma versão. Nenhum recurso precisa ser evitado por causa\n'
				printf -- '  de diferença de versão, e o que a verificação aprovar vale para a operação.\n'
			fi
			printf -- '- Ausência de divergência **hoje** não é garantia permanente: ela some no dia em que\n'
			printf -- '  qualquer um dos dois lados subir de versão sozinho — a dependência de teste que\n'
			printf -- '  empacota o binário da verificação e o pacote do sistema na operação são atualizados\n'
			printf -- '  por caminhos independentes. Reexecute este procedimento a cada mudança de qualquer\n'
			printf -- '  um dos dois.\n'
		else
			printf -- '- **Escreva a migração para a MENOR das duas versões.** Recurso que só existe na maior\n'
			printf -- '  passa na verificação e quebra na operação (ou o contrário), e a descoberta viria\n'
			printf -- '  pelo pior caminho: em produção, na primeira execução da migração.\n'
			printf -- '- Enquanto a divergência existir, todo recurso de sintaxe ou de catálogo introduzido\n'
			printf -- '  entre as duas versões é território proibido. Confira na documentação da versão\n'
			printf -- '  menor antes de usar.\n'
			printf -- '- A divergência é resolvível: aproximar as duas pontas de versão vale mais do que\n'
			printf -- '  conviver com a restrição acima em toda migração futura.\n'
		fi
	} >"${REGISTRO}.tmp"

	mv "${REGISTRO}.tmp" "${REGISTRO}"

	info "registro gravado em ${REGISTRO}"
	printf '%s\n' "${conclusao}"

	# A pendência já está no corpo do arquivo, mas quem executa o procedimento pode nunca abri-lo —
	# lê a conclusão na tela e segue. Uma conclusão de "sem divergência" saindo sozinha, com o lado
	# direito lido de um substituto, é a mesma classe de silêncio que a bateria de verificação
	# fechou: a resposta parece completa porque nada disse que não era.
	if [[ "${operacao_substituta}" -eq 1 ]]; then
		aviso "CA-14 EM ABERTO — o lado da operação foi lido de ${ARQ_OPERACAO}, e não de ${ARQ_AMBIENTE_PADRAO}: o rótulo saiu marcado SUBSTITUTO e este registro NÃO fecha o critério"
		aviso "CA-14 EM ABERTO — para fechá-lo, execute com privilégio: SYSLOC_ARQ_AMBIENTE_VERIFICACAO=${ARQ_VERIFICACAO} sudo -E bash deploy/scripts/instalacao/apurar-versao-banco.sh"
	fi
}

main() {
	command -v psql >/dev/null 2>&1 ||
		abortar "o cliente de linha de comando do PostgreSQL ('psql') não está no PATH" \
			"instale o pacote postgresql-client correspondente à versão provisionada e execute de novo"

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-apurar-versao-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"

	ler_versao_do_lado "verificação" "${ARQ_VERIFICACAO}" "SYSLOC_ARQ_AMBIENTE_VERIFICACAO"
	VERSAO_VERIFICACAO="${VERSAO_LIDA}"
	DESTINO_VERIFICACAO="${DESTINO_LIDO}"
	info "verificação: ${DESTINO_VERIFICACAO} reporta ${VERSAO_VERIFICACAO}"

	ler_versao_do_lado "operação" "${ARQ_OPERACAO}" "SYSLOC_ARQ_AMBIENTE"
	VERSAO_OPERACAO="${VERSAO_LIDA}"
	DESTINO_OPERACAO="${DESTINO_LIDO}"
	info "operação: ${DESTINO_OPERACAO} reporta ${VERSAO_OPERACAO}"

	gravar_registro
}

main "$@"
