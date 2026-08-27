#!/usr/bin/env bash
#
# Restauração da base do Sysloc — T3 da fatia `publicacao-e-backup`.
#
# Recebe UMA cópia produzida por `copiar-base.sh`, escreve o conteúdo dela numa
# base VAZIA e CONFERE o que ficou lá contra o que o arquivo declarava. É a
# prova da fatia: o plano é literal — *"a prova é a restauração, não o dump"* —,
# e uma cópia que ninguém restaurou é uma promessa, não uma salvaguarda.
#
# ---------------------------------------------------------------------------
# POR QUE A CONFERÊNCIA É O PROCEDIMENTO, E NÃO UM ADORNO NO FIM DELE
# ---------------------------------------------------------------------------
#
# O restaurador terminar sem erro NÃO é a restauração ter acontecido. Ele pode
# sair bem enquanto o destino ficou com menos do que a cópia trazia, e pode ter
# saído mal com o destino inteiro no lugar. As duas coisas se descobrem olhando
# o DESTINO, e é isso que este procedimento faz: mede as relações e as linhas
# que existem na base restaurada e as compara com as que o arquivo declara.
#
# Por isso a conferência roda SEMPRE, inclusive quando o restaurador já falhou —
# a mesma decisão do irmão `copiar-base.sh`, e pela mesma razão: é ela que
# nomeia, numa frase só, o que o destino tem e o que lhe falta.
#
# ---------------------------------------------------------------------------
# ADR-0006 — O DESTINO NUNCA É A BASE QUE ATENDE A OPERAÇÃO
# ---------------------------------------------------------------------------
#
# A `Decision` da ADR-0006 é sobre separação: *"a suíte de verificação nunca
# executa contra o ambiente que atende a operação"*. Escrever uma cópia POR CIMA
# da base que está atendendo é a forma mais destrutiva possível de violá-la — e
# é um erro de uma tecla, porque o nome da base de origem e o da base de destino
# se parecem por construção.
#
# `recusar_destino_da_operacao` é a guarda, ela roda ANTES de qualquer conexão
# ao destino, e ela NÃO É CONTORNÁVEL POR BANDEIRA: não existe `--forcar` neste
# arquivo. A identidade da base que atende a operação não é digitada por quem
# executa — ela é LIDA da cadeia de conexão do arquivo de ambiente, que é a
# mesma fonte que o serviço consome. Quem opera não pode se enganar sobre ela
# porque não é ele quem a informa.
#
# ⚠️ A comparação NÃO é textual pura, e a razão é um comportamento documentado
# do cliente: o parâmetro `dbname` é EXPANDIDO quando o valor se parece com uma
# cadeia de conexão (contém `://` ou `=`). Medido neste host: `-d
# "postgresql://…/producao"` conecta em `producao` ainda que o texto não seja
# `producao`. Uma guarda que só comparasse strings deixaria essa porta aberta.
# Por isso o destino é RESOLVIDO ao nome efetivo antes de ser comparado, e a
# forma expandida é recusada mesmo quando aponta para outro lugar: aceitar uma
# grafia cujo significado quem lê o script não consegue prever é o que a guarda
# existe para impedir.
#
# ⚠️ Esta guarda NÃO é a mesma coisa que `recusar_bateria_em_producao`, das três
# baterias de `deploy/scripts/instalacao/`, e não deve ser confundida com ela. A
# de lá recusa a EXECUÇÃO INTEIRA de uma bateria de verificação quando a máquina
# traz o marcador de instalação de produção; o eixo é a MÁQUINA e o sujeito é
# uma bateria. Esta recusa UM DESTINO de um script OPERACIONAL, que existe
# justamente para rodar na máquina de produção — recusá-lo por marcador de
# máquina o tornaria inútil no único lugar onde ele serve. Eixos diferentes,
# sujeitos diferentes, desfechos diferentes: não é a terceira cópia de um mesmo
# padrão, e o Limiar de Três não a alcança.
#
# ---------------------------------------------------------------------------
# A BASE DE DESTINO PRECISA ESTAR VAZIA, E "VAZIA" SE MEDE EM OBJETOS
# ---------------------------------------------------------------------------
#
# Restaurar sobre uma base que já tem conteúdo colide no meio e deixa o destino
# em ESTADO MISTO — parte do que havia, parte do que veio, e nenhuma forma de
# saber qual é qual depois. Estado misto é pior que falha limpa: ele se parece
# com sucesso.
#
# ⚠️ A contagem olha OBJETOS DE ESQUEMA, não tabelas. Uma base com uma SEQUÊNCIA
# solta, um TIPO, uma FUNÇÃO ou um ESQUEMA já criado não é vazia: a criação
# correspondente da cópia colidiria, e um guarda que contasse apenas tabelas a
# declararia vazia e seguiria em frente. Os quatro eixos são contados e os
# quatro aparecem no diagnóstico.
#
# ---------------------------------------------------------------------------
# O QUE A CÓPIA NÃO CARREGA — o pressuposto dos papéis
# ---------------------------------------------------------------------------
#
# PAPEL DE BANCO É OBJETO DO AGRUPAMENTO, NÃO DA BASE. `sysloc_app` e
# `sysloc_migracao` são criados por `provisionar-base.sh`, vivem no agrupamento
# e NÃO viajam na cópia — assim como não viajam as concessões e as políticas que
# `0001_seguranca.sql` instala sobre eles. A consequência é operacional e está
# declarada na §3.4 do escopo da fatia:
#
#   A BASE VAZIA DE DESTINO PRECISA ESTAR NO MESMO AGRUPAMENTO DA ORIGEM,
#   onde os papéis que a cópia referencia já existem.
#
# Restaurar num agrupamento NOVO exigiria preservar os papéis junto, e isso não
# está no desenho desta fatia. É limite conhecido, não omissão: numa máquina
# nova, `provisionar-base.sh` roda ANTES desta restauração e é ele quem recria
# os papéis.
#
# ---------------------------------------------------------------------------
# ADR-0005 — NENHUMA CREDENCIAL NESTE ARQUIVO
# ---------------------------------------------------------------------------
#
# Este script é versionado e não carrega segredo. A credencial do banco é lida
# em tempo de execução do arquivo de ambiente que vive fora da árvore versionada
# e chega ao cliente por um arquivo de senha temporário de modo 0600 — nunca por
# argumento de linha de comando, que qualquer usuário da máquina leria na tabela
# de processos, e nunca por variável de ambiente exportada, que todo processo
# filho herdaria. Pela mesma razão, o rastreio verboso de comandos do shell
# jamais é ligado aqui.
#
# ---------------------------------------------------------------------------
# MAPA DE DESFECHOS — o desfecho de toda travessia é decidido, nunca herdado
# ---------------------------------------------------------------------------
#
# A herança é do irmão `preservar-segredos.sh`, e a razão é medida: `set -Eeuo
# pipefail` NÃO alcança substituição de processo (`< <(cmd)`), `|| true`,
# comando externo em condição de `if`/`&&`/`||`, comando à esquerda de um cano
# fechado cedo, nem o corpo inteiro de função chamada sob `if` ou `!`.
#
# As formas usadas aqui, e o que cada uma responde:
#
#   (a) `set -e` alcança      — comando simples fora de condição e fora de `||`;
#   (b) desfecho CAPTURADO    — `cmd … || codigo=$?` seguido de decisão explícita
#                               sobre o código. É a forma do restaurador, das
#                               três consultas ao destino, das duas leituras do
#                               conteúdo da cópia e da leitura da confirmação;
#   (c) recusa explícita      — `cmd || abortar …`.
#
# ⚠️ NENHUM descarte de desfecho sobrevive no CÓDIGO deste arquivo. As
# ocorrências textuais da forma `|| true` vivem todas em comentário — as deste
# bloco e a do parágrafo acima —, e a conferência é de uma linha:
#
#   grep -n '|| true' deploy/scripts/backup/restaurar-base.sh   # só linha de '#'
#
# A razão é medida: descartar o código para tolerar o `1` de um `grep` sem
# correspondência tolera junto o `2`, que é o arquivo que não pôde ser lido. Todo
# `grep` deste arquivo é tratado pela FAIXA do código (0 / 1 / >1), e as duas
# contagens de conjunto usam `wc -l`, que não falha sobre arquivo vazio.
#
# ---------------------------------------------------------------------------
# PARÂMETROS (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_ARQ_AMBIENTE          Arquivo de ambiente com a linha `DATABASE_URL=`.
#                                Dele saem o agrupamento, a credencial E a
#                                identidade da base que atende a operação — a
#                                que a guarda da ADR-0006 recusa como destino.
#                                Padrão: /etc/sysloc/backend.env
#
#   SYSLOC_BANCO_DE_DESTINO      Nome da base VAZIA que receberá a cópia. Sem
#                                padrão: informá-la é ato deliberado do operador.
#
# ---------------------------------------------------------------------------
# USO E CONTRATO DE SAÍDA
# ---------------------------------------------------------------------------
#
#   SYSLOC_BANCO_DE_DESTINO=sysloc_restaurado \
#     bash deploy/scripts/backup/restaurar-base.sh /opt/backups/sysloc/daily/base-2026-08-25.dump
#
#   … <arquivo> ensaio      percorre tudo e NÃO escreve nada, sem pedir confirmação
#   … <arquivo> conferir    só confere um destino já restaurado contra o arquivo
#
# O modo `ensaio` existe para o operador que precisa ver o que a cópia traz e se
# o destino está apto ANTES de decidir. O modo `conferir` existe porque a
# conferência precisa ser executável sobre um destino já restaurado: é assim que
# se reconfere, dias depois, uma restauração que ninguém está mais vendo — e é o
# único caminho pelo qual se descobre que o destino PERDEU algo depois.
#
# ⚠️ O modo padrão (`restaurar`) EXIGE CONFIRMAÇÃO EXPLÍCITA na entrada padrão:
# o token abaixo, literal, sem espaço a mais. Entrada padrão fechada NÃO
# confirma — uma restauração que acontece porque ninguém disse nada é exatamente
# o que este procedimento existe para impedir. Os modos `ensaio` e `conferir`
# não leem a entrada padrão e nunca bloqueiam.
#
#   0  o modo pedido terminou e o que ele afirma está CONFERIDO.
#   1  reprovou. Quando a reprovação é de GUARDA (destino da operação, destino
#      não vazio, confirmação recusada), NADA foi escrito no destino.
#
# Verificação correspondente:
#
#   bash deploy/scripts/backup/verificar-backup.sh
#
# ⚠️ A leitura da cadeia de conexão (`extrair_url_do_arquivo` e `decompor_url`) é
# a TERCEIRA cópia do molde de `deploy/scripts/instalacao/apurar-versao-banco.sh`
# — o Limiar de Três do `CLAUDE.md` JÁ DISPAROU. Ela não sobe para casa
# compartilhada nesta task porque a subida arrasta os dois consumidores
# existentes e as duas baterias que auditam o TEXTO deles, e nenhum dos quatro
# está na lista de arquivos desta task. A primeira task autorizada a abrir
# `copiar-base.sh` ou `apurar-versao-banco.sh` por outra razão sobe as duas
# funções e faz os TRÊS consumirem a casa.
#

set -Eeuo pipefail

readonly PREFIXO="[restaurar-base]"

# --------------------------------------------------------------------------- #
# Constantes.
#
# ⚠️ O token de confirmação é declarado UMA vez, aqui, e a bateria o LÊ deste
# ponto em vez de reescrever a palavra: um literal repetido do lado da prova
# poria o alvo sob exame nos dois lados da comparação, e a asserção não poderia
# falhar. É a mesma razão pela qual o `CT-1100` lê o prazo de guarda do irmão.
# --------------------------------------------------------------------------- #
readonly TOKEN_DE_CONFIRMACAO="RESTAURAR"

readonly ARQ_AMBIENTE_PADRAO="/etc/sysloc/backend.env"

# Os cinco primeiros bytes do formato próprio de restauração seletiva — a mesma
# assinatura que o irmão confere ao publicar a cópia.
readonly ASSINATURA_DO_FORMATO="PGDMP"

# Limite de espera por conexão, em segundos. Sem ele, um endereço inalcançável
# ficaria pendurado no tempo padrão do sistema e o operador veria um processo
# travado em vez de uma falha nomeada.
readonly LIMITE_CONEXAO_S=10

readonly MODOS_ACEITOS="restaurar ensaio conferir"

# Alfabeto do nome da base de destino. Restritivo POR DECISÃO, e não por
# preguiça: fora dele o cliente EXPANDE o valor em parâmetros de conexão (ver o
# cabeçalho), e um destino cujo significado não se pode prever lendo o script é
# exatamente o que a guarda da ADR-0006 existe para recusar.
readonly ALFABETO_DO_NOME_DA_BASE='^[A-Za-z_][A-Za-z0-9_]*$'

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
ARQ_AMBIENTE="${SYSLOC_ARQ_AMBIENTE:-${ARQ_AMBIENTE_PADRAO}}"
BANCO_DE_DESTINO="${SYSLOC_BANCO_DE_DESTINO:-}"
ARQUIVO_DA_COPIA="${1:-}"
MODO="${2:-restaurar}"

# --------------------------------------------------------------------------- #
# Estado interno. Nada aqui é exportado: exportar poria o segredo no ambiente de
# todo processo filho.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
ARQ_SENHA=""
URL_LIDA=""
CHAVES_REPETIDAS=""
URL_PAPEL=""
URL_SEGREDO=""
URL_HOSPEDEIRO=""
URL_PORTA=""
URL_BANCO=""
DESTINO_RESOLVIDO=""
ARQ_RELACOES_DA_ORIGEM=""
TOTAL_DE_RELACOES_DA_ORIGEM=0
LINHAS_DA_ORIGEM=0
ENTRADAS_DO_CONTEUDO=0

# --------------------------------------------------------------------------- #
# Saída legível. Nenhuma destas funções recebe credencial: o que se imprime é
# papel, endereço, porta e nome de base — nunca o segredo.
# --------------------------------------------------------------------------- #
info() { printf '%s ..    %s\n' "${PREFIXO}" "$*"; }
erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer
abortar() {
	# O gatilho de falha inesperada é desligado antes de sair: sem isto, o próprio
	# `exit` abaixo o dispararia e a saída ganharia uma segunda mensagem, genérica,
	# logo depois da específica — quem lê acabaria investigando a genérica.
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
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara
# o trap uma única vez.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"' ERR

# --------------------------------------------------------------------------- #
# Leitura da cadeia de conexão. Sem efeito colateral: não escreve, não conecta.
#
# Devolve, por código de saída:
#   0  cadeia íntegra em ${URL_LIDA}
#   1  arquivo inexistente ou ilegível
#   2  arquivo sem linha DATABASE_URL utilizável
#   3  atribuição repetida — ${CHAVES_REPETIDAS} nomeia as chaves ambíguas
#
# Ver a nota do Limiar de Três no fim do cabeçalho: esta é a terceira cópia do
# molde, e o CONTRATO dela — os quatro códigos de saída e o que cada um
# significa — é o do irmão, de propósito: divergir nele faria as duas rotinas
# lerem o MESMO arquivo de ambiente de formas diferentes.
#
# ⚠️ Há UMA divergência de implementação, e ela é declarada: o exame de
# atribuição repetida trata o `grep` pela FAIXA do código, enquanto o irmão o
# descarta com `|| true`. O contrato é o mesmo nos dois; o que muda é que aqui
# um arquivo que não pôde ser LIDO não é confundido com um arquivo sem chave
# repetida. Quando as três cópias subirem para casa compartilhada, é esta forma
# que sobe.
# --------------------------------------------------------------------------- #
extrair_url_do_arquivo() {
	local arquivo="$1"
	URL_LIDA=""
	CHAVES_REPETIDAS=""

	if [[ ! -r "${arquivo}" ]]; then
		return 1
	fi

	# Atribuição repetida é AMBIGUIDADE, e ambiguidade se recusa. O
	# `EnvironmentFile=` do systemd usa a ÚLTIMA ocorrência e um leitor ingênuo
	# usaria a PRIMEIRA; restaurar contra um agrupamento enquanto o serviço atende
	# outro é a divergência que este procedimento menos pode ter.
	#
	# O desfecho do `grep` é decidido pela FAIXA do código, e não descartado: 0 é
	# "achou repetida", 1 é "não achou" (normal), e qualquer outro é o arquivo que
	# não pôde ser lido — que se recusa.
	local repetidas="" codigo_do_exame=0
	repetidas="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d | tr -d '=' | tr '\n' ' ')" || codigo_do_exame=$?
	if [[ "${codigo_do_exame}" -gt 1 ]]; then
		return 1
	fi
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
# Decomposição da cadeia nas partes que o cliente precisa receber separadamente
# — é o que permite manter o segredo fora do argumento de linha de comando.
#
# Aceita as duas formas em uso nesta base: endereço com porta, e socket de
# domínio Unix declarado na consulta.
#
# A captura da credencial vai até o ÚLTIMO separador de autoridade de propósito:
# com uma classe restrita, um segredo que o contivesse seria cortado no primeiro
# deles e o pedaço seguiria adiante como se fosse a credencial inteira.
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

	# Codificação percentual é RECUSADA com diagnóstico próprio, e não
	# decodificada — a razão está registrada por extenso no molde: decodificar
	# introduziria um caminho novo de manipulação de credencial para atender uma
	# forma que nenhum produtor deste repositório emite.
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
# O formato separa os campos por ':' e prevê escape com '\' para EXATAMENTE dois
# caracteres: o próprio ':' e o próprio '\'. A ordem das substituições importa —
# a barra invertida é dobrada ANTES de a barra de escape ser introduzida; na
# ordem inversa, a barra recém-introduzida seria dobrada também.
#
# Isto é uma FUNÇÃO do shell, não um programa externo: o valor viaja como
# parâmetro posicional do próprio processo, sem linha de comando nova para a
# tabela de processos mostrar.
# --------------------------------------------------------------------------- #
escapar_para_arquivo_de_senha() {
	local valor="${1//\\/\\\\}"
	printf '%s' "${valor//:/\\:}"
}

# --------------------------------------------------------------------------- #
# Conferência dos argumentos, antes de qualquer efeito.
# --------------------------------------------------------------------------- #
conferir_invocacao() {
	case " ${MODOS_ACEITOS} " in
	*" ${MODO} "*) ;;
	*) abortar "modo desconhecido: [${MODO}]" "use um destes: ${MODOS_ACEITOS}" ;;
	esac

	if [[ -z "${ARQUIVO_DA_COPIA}" ]]; then
		abortar "nenhum arquivo de cópia foi informado — NADA foi lido nem escrito" \
			"informe o caminho da cópia: bash ${BASH_SOURCE[0]} <arquivo> [${MODOS_ACEITOS}]"
	fi

	if [[ -z "${BANCO_DE_DESTINO}" ]]; then
		abortar "SYSLOC_BANCO_DE_DESTINO não foi informada — NADA foi lido nem escrito" \
			"informe SYSLOC_BANCO_DE_DESTINO com o nome da base VAZIA que receberá a cópia; ela NÃO tem padrão de propósito"
	fi
}

# --------------------------------------------------------------------------- #
# Leitura da conexão da operação. É daqui que sai, além da credencial, a
# IDENTIDADE da base que atende a operação — a que a guarda da ADR-0006 recusa.
# --------------------------------------------------------------------------- #
ler_conexao_da_operacao() {
	local codigo=0

	extrair_url_do_arquivo "${ARQ_AMBIENTE}" || codigo=$?
	case "${codigo}" in
	0) ;;
	1) abortar "o arquivo de ambiente ${ARQ_AMBIENTE} não existe ou não é legível por este usuário" \
		"execute com privilégio, ou informe SYSLOC_ARQ_AMBIENTE apontando para um arquivo legível" ;;
	2) abortar "o arquivo de ambiente ${ARQ_AMBIENTE} não tem uma linha DATABASE_URL utilizável" \
		"acrescente a linha DATABASE_URL= ao arquivo de ambiente" ;;
	3) abortar "o arquivo de ambiente ${ARQ_AMBIENTE} tem atribuição repetida: ${CHAVES_REPETIDAS}" \
		"deixe uma única atribuição de cada chave — o serviço usa a última e um leitor ingênuo usaria a primeira" ;;
	*) abortar "não consegui ler ${ARQ_AMBIENTE}" "confira o arquivo de ambiente" ;;
	esac

	codigo=0
	decompor_url "${URL_LIDA}" || codigo=$?
	case "${codigo}" in
	0) ;;
	2) abortar "a cadeia de conexão de ${ARQ_AMBIENTE} traz codificação percentual na credencial" \
		"grave a credencial literal no arquivo de ambiente — esta rotina não decodifica" ;;
	*) abortar "a cadeia de conexão de ${ARQ_AMBIENTE} é irreconhecível" \
		"use a forma postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO" ;;
	esac
}

# --------------------------------------------------------------------------- #
# Resolve o destino ao NOME EFETIVO de base, que é o que a guarda compara.
#
# Ver o cabeçalho: o cliente expande `dbname` quando o valor contém `://` ou
# `=`, e por isso uma comparação textual pura não alcança a grafia expandida.
# Aqui a grafia expandida é decomposta para que a guarda saiba o que ela
# significa, e a resolução preenche ${DESTINO_RESOLVIDO}.
#
# Devolve, por código de saída:
#   0  ${DESTINO_RESOLVIDO} é o nome efetivo, e ele é um nome simples
#   1  o valor é uma grafia EXPANDIDA; ${DESTINO_RESOLVIDO} traz o nome efetivo
#      quando pôde ser extraído, e fica VAZIO quando nem isso foi possível
#   2  o valor não é grafia expandida e também não é um nome de base aceitável
# --------------------------------------------------------------------------- #
resolver_banco_de_destino() {
	local valor="$1"
	DESTINO_RESOLVIDO=""

	case "${valor}" in
	*://* | *=* | *[[:space:]]*)
		# Grafia expandida. As duas formas que o cliente reconhece têm o nome da
		# base extraído por leitura direta — e a extração NÃO passa por
		# `decompor_url` de propósito: aquela exige credencial na cadeia, e a forma
		# `postgresql://HOSPEDEIRO:PORTA/BASE`, sem credencial nenhuma, é
		# perfeitamente válida para o cliente. Uma guarda que não a alcançasse
		# deixaria aberta justamente a grafia mais curta de escrever.
		case "${valor}" in
		postgresql://* | postgres://*)
			local resto="${valor#*://}"
			local caminho=""
			[[ "${resto}" == */* ]] && caminho="${resto#*/}"
			DESTINO_RESOLVIDO="${caminho%%\?*}"
			;;
		*dbname=*)
			local cauda="${valor##*dbname=}"
			DESTINO_RESOLVIDO="${cauda%%[[:space:]]*}"
			;;
		esac
		return 1
		;;
	esac

	if [[ ! "${valor}" =~ ${ALFABETO_DO_NOME_DA_BASE} ]]; then
		return 2
	fi

	DESTINO_RESOLVIDO="${valor}"
	return 0
}

# --------------------------------------------------------------------------- #
# O destino como ele pode ser IMPRESSO.
#
# ⚠️ Mensagem de erro é registro permanente — ela vai para o diário do sistema e
# para a bateria de verificação. Uma grafia expandida pode trazer credencial
# dentro (`postgresql://papel:SEGREDO@…`), e ecoar o valor cru do parâmetro
# publicaria o segredo de quem se enganou ao informá-lo. Do diagnóstico sai o
# nome EFETIVO da base, nunca o texto que chegou.
#
# Depois que a guarda abaixo devolve o controle, ${BANCO_DE_DESTINO} é
# comprovadamente um nome simples — por isso as demais mensagens deste arquivo
# podem usá-lo diretamente.
# --------------------------------------------------------------------------- #
destino_para_exibicao() {
	if [[ "${BANCO_DE_DESTINO}" =~ ${ALFABETO_DO_NOME_DA_BASE} ]]; then
		printf '%s' "${BANCO_DE_DESTINO}"
	elif [[ -n "${DESTINO_RESOLVIDO}" ]]; then
		printf 'grafia expandida que resolve para a base %s' "${DESTINO_RESOLVIDO}"
	else
		printf 'grafia expandida cujo destino não pôde ser apurado'
	fi
}

# --------------------------------------------------------------------------- #
# A GUARDA DA ADR-0006. Ela roda antes de qualquer conexão ao destino, nos TRÊS
# modos, e não é contornável por bandeira — não existe `--forcar` neste arquivo.
#
# A ordem interna é conteúdo: a coincidência com a base da operação é conferida
# ANTES da recusa da grafia expandida, para que a grafia expandida que aponta
# para a operação seja recusada COM O NOME DA ADR, e não como um erro de forma.
# Quem lê o diário do sistema precisa saber que quase escreveu por cima da
# produção, e não que digitou o parâmetro errado.
# --------------------------------------------------------------------------- #
recusar_destino_da_operacao() {
	local codigo=0
	resolver_banco_de_destino "${BANCO_DE_DESTINO}" || codigo=$?

	if [[ -n "${DESTINO_RESOLVIDO}" && "${DESTINO_RESOLVIDO}" == "${URL_BANCO}" ]]; then
		abortar \
			"o destino [$(destino_para_exibicao)] é a base que ATENDE A OPERAÇÃO (${URL_BANCO} em ${URL_HOSPEDEIRO}:${URL_PORTA}, declarada em ${ARQ_AMBIENTE}) — a ADR-0006 é literal sobre a separação, e NADA foi lido nem escrito lá" \
			"informe SYSLOC_BANCO_DE_DESTINO com o nome de uma base VAZIA do mesmo agrupamento; esta guarda não tem bandeira que a desligue"
	fi

	case "${codigo}" in
	0) ;;
	1) abortar \
		"o destino [$(destino_para_exibicao)] não é um nome de base: o cliente o EXPANDIRIA em parâmetros de conexão, e este procedimento não escreve num destino cujo significado ele não pode afirmar — NADA foi lido nem escrito" \
		"informe SYSLOC_BANCO_DE_DESTINO com o nome simples da base de destino, sem cadeia de conexão" ;;
	*) abortar \
		"o destino [$(destino_para_exibicao)] não é um nome de base aceitável — NADA foi lido nem escrito" \
		"use um nome que case com ${ALFABETO_DO_NOME_DA_BASE}" ;;
	esac
}

# --------------------------------------------------------------------------- #
# Entrega da credencial ao cliente por arquivo de modo restrito. O campo da base
# vai como `*` porque este procedimento fala com DUAS bases do mesmo agrupamento
# — a de destino e, nas consultas de catálogo, ela mesma —, e uma linha por base
# multiplicaria os pontos onde o segredo é escrito.
# --------------------------------------------------------------------------- #
preparar_credencial() {
	DIR_TEMPORARIO="$(mktemp -d)"
	chmod 700 "${DIR_TEMPORARIO}"

	ARQ_SENHA="${DIR_TEMPORARIO}/senha"
	install -m 0600 /dev/null "${ARQ_SENHA}"
	printf '%s:%s:*:%s:%s\n' \
		"$(escapar_para_arquivo_de_senha "${URL_HOSPEDEIRO}")" \
		"${URL_PORTA}" \
		"$(escapar_para_arquivo_de_senha "${URL_PAPEL}")" \
		"$(escapar_para_arquivo_de_senha "${URL_SEGREDO}")" >"${ARQ_SENHA}"
}

# --------------------------------------------------------------------------- #
# Consulta de catálogo contra a base de DESTINO. Devolve o valor em
# ${RESULTADO_DA_CONSULTA} e o desfecho pelo código de saída — nunca pela saída
# padrão, que aqui carrega dado e não estado.
# --------------------------------------------------------------------------- #
RESULTADO_DA_CONSULTA=""
consultar_destino() {
	local comando="$1"
	local codigo=0
	RESULTADO_DA_CONSULTA=""
	RESULTADO_DA_CONSULTA="$(
		PGPASSFILE="${ARQ_SENHA}" PGCONNECT_TIMEOUT="${LIMITE_CONEXAO_S}" \
			psql -X -q -A -t -w --no-psqlrc \
			--host="${URL_HOSPEDEIRO}" --port="${URL_PORTA}" \
			--username="${URL_PAPEL}" --dbname="${BANCO_DE_DESTINO}" \
			--command="${comando}" 2>"${DIR_TEMPORARIO}/psql.erro"
	)" || codigo=$?
	return "${codigo}"
}

# O diagnóstico do cliente, numa linha, para compor a mensagem de recusa.
diagnostico_da_consulta() {
	if [[ -s "${DIR_TEMPORARIO}/psql.erro" ]]; then
		tr '\n' ' ' <"${DIR_TEMPORARIO}/psql.erro"
	else
		printf 'sem diagnóstico do cliente'
	fi
}

# --------------------------------------------------------------------------- #
# A GUARDA DE BASE VAZIA — ver o cabeçalho. Os QUATRO eixos, e o diagnóstico
# nomeia os quatro: contar só tabelas declararia vazia uma base com sequência,
# tipo, função ou esquema já criados, e a restauração colidiria no meio.
# --------------------------------------------------------------------------- #
readonly CONSULTA_DOS_OBJETOS="
SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema')
            AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%')::text
    || ' ' ||
       (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typtype IN ('e','d','r','m')
            AND n.nspname NOT IN ('pg_catalog','information_schema'))::text
    || ' ' ||
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema'))::text
    || ' ' ||
       (SELECT count(*) FROM pg_namespace n
          WHERE n.nspname NOT IN ('pg_catalog','information_schema','public')
            AND n.nspname NOT LIKE 'pg\\_%')::text
"

exigir_destino_vazio() {
	local codigo=0
	consultar_destino "${CONSULTA_DOS_OBJETOS}" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		abortar \
			"não consegui examinar a base de destino [${BANCO_DE_DESTINO}] em ${URL_HOSPEDEIRO}:${URL_PORTA} (o cliente terminou com código ${codigo}): $(diagnostico_da_consulta) — NADA foi escrito" \
			"confira se a base de destino existe e se o papel ${URL_PAPEL} pode conectar nela"
	fi

	local relacoes tipos rotinas esquemas
	read -r relacoes tipos rotinas esquemas <<<"${RESULTADO_DA_CONSULTA}"

	if [[ ! "${relacoes}" =~ ^[0-9]+$ || ! "${tipos}" =~ ^[0-9]+$ ||
		! "${rotinas}" =~ ^[0-9]+$ || ! "${esquemas}" =~ ^[0-9]+$ ]]; then
		abortar \
			"a contagem de objetos de [${BANCO_DE_DESTINO}] veio irreconhecível: [${RESULTADO_DA_CONSULTA}] — NADA foi escrito" \
			"confira a versão do servidor em ${URL_HOSPEDEIRO}:${URL_PORTA}"
	fi

	local total=$((relacoes + tipos + rotinas + esquemas))
	if [[ "${total}" -gt 0 ]]; then
		abortar \
			"a base de destino [${BANCO_DE_DESTINO}] NÃO está vazia: relacoes=${relacoes} tipos=${tipos} rotinas=${rotinas} esquemas=${esquemas} — restaurar por cima deixaria o destino em estado misto, e NADA foi escrito" \
			"aponte SYSLOC_BANCO_DE_DESTINO para uma base VAZIA do mesmo agrupamento (CREATE DATABASE), ou esvazie esta antes"
	fi

	info "a base de destino [${BANCO_DE_DESTINO}] está vazia nos quatro eixos (relações, tipos, rotinas, esquemas)"
}

# --------------------------------------------------------------------------- #
# O conteúdo da cópia, LIDO E EXIBIDO antes de qualquer escrita.
#
# Além de mostrar ao operador o que ele está prestes a escrever, esta etapa
# produz os dois números contra os quais o destino será conferido: o conjunto
# das relações que a cópia declara e o total de linhas de dados que ela carrega.
#
# ⚠️ A contagem de linhas ATRAVESSA o arquivo inteiro, e isso custa uma leitura a
# mais. É o preço da conferência: sem o número da origem não há com o que
# comparar o destino, e uma restauração não conferida não é uma restauração.
# --------------------------------------------------------------------------- #
listar_conteudo_da_copia() {
	if [[ ! -r "${ARQUIVO_DA_COPIA}" ]]; then
		abortar "a cópia ${ARQUIVO_DA_COPIA} não existe ou não é legível por este usuário — NADA foi escrito" \
			"confira o caminho, ou execute com um usuário que possa lê-lo"
	fi
	if [[ ! -s "${ARQUIVO_DA_COPIA}" ]]; then
		abortar "a cópia ${ARQUIVO_DA_COPIA} está vazia — NADA foi escrito" \
			"use uma cópia produzida por copiar-base.sh"
	fi

	local assinatura=""
	assinatura="$(head -c "${#ASSINATURA_DO_FORMATO}" "${ARQUIVO_DA_COPIA}")"
	if [[ "${assinatura}" != "${ASSINATURA_DO_FORMATO}" ]]; then
		abortar \
			"a assinatura de ${ARQUIVO_DA_COPIA} não é a do formato de restauração seletiva (esperada [${ASSINATURA_DO_FORMATO}]) — NADA foi escrito" \
			"use uma cópia produzida por copiar-base.sh, no formato próprio de restauração seletiva"
	fi

	local listagem="${DIR_TEMPORARIO}/conteudo"
	local codigo=0
	pg_restore -l "${ARQUIVO_DA_COPIA}" >"${listagem}" 2>"${DIR_TEMPORARIO}/pg_restore.erro" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		abortar \
			"não consegui ler o índice de ${ARQUIVO_DA_COPIA} (o restaurador terminou com código ${codigo}): $(tr '\n' ' ' <"${DIR_TEMPORARIO}/pg_restore.erro") — NADA foi escrito" \
			"a cópia pode estar corrompida; confira-a com pg_restore -l e use outra do acervo"
	fi

	local codigo_da_contagem=0
	ENTRADAS_DO_CONTEUDO="$(grep -cE '^[0-9]' "${listagem}")" || codigo_da_contagem=$?
	if [[ "${codigo_da_contagem}" -gt 1 ]]; then
		abortar "não consegui contar as entradas do índice de ${ARQUIVO_DA_COPIA} — NADA foi escrito" \
			"confira a permissão de leitura do diretório temporário"
	fi
	if [[ "${ENTRADAS_DO_CONTEUDO}" -lt 1 ]]; then
		abortar "o índice de ${ARQUIVO_DA_COPIA} não tem entrada nenhuma — NADA foi escrito" \
			"use uma cópia produzida por copiar-base.sh, com conteúdo"
	fi

	info "conteúdo de ${ARQUIVO_DA_COPIA} — ${ENTRADAS_DO_CONTEUDO} entrada(s):"
	sed 's/^/       /' "${listagem}"

	# As relações que a cópia declara: `TABLE DATA` é excluída ANTES porque ela
	# começa por `TABLE ` e a extração a leria como uma relação chamada `DATA`.
	#
	# O desfecho é decidido pela FAIXA do código: `grep` sem correspondência
	# devolve 1, que aqui significa conjunto vazio e é desfecho NORMAL; acima de 1
	# é o arquivo que não pôde ser lido, e esse se recusa.
	ARQ_RELACOES_DA_ORIGEM="${DIR_TEMPORARIO}/relacoes-da-origem"
	local codigo_da_extracao=0
	grep -vE '^[0-9]+; [0-9]+ [0-9]+ TABLE DATA ' "${listagem}" |
		sed -nE 's/^[0-9]+; [0-9]+ [0-9]+ (TABLE|SEQUENCE|VIEW|MATERIALIZED VIEW) ([^ ]+) ([^ ]+).*/\2.\3/p' |
		LC_ALL=C sort -u >"${ARQ_RELACOES_DA_ORIGEM}" || codigo_da_extracao=$?
	if [[ "${codigo_da_extracao}" -gt 1 ]]; then
		abortar \
			"não consegui extrair as relações declaradas por ${ARQUIVO_DA_COPIA} (a extração terminou com código ${codigo_da_extracao}) — NADA foi escrito" \
			"confira a permissão de escrita do diretório temporário"
	fi
	TOTAL_DE_RELACOES_DA_ORIGEM="$(wc -l <"${ARQ_RELACOES_DA_ORIGEM}")"

	# A travessia do arquivo inteiro conta as linhas de dados. O desfecho dela NÃO
	# decide nada aqui: uma cópia truncada tem índice legível e travessia
	# reprovada, e é a CONFERÊNCIA DO DESTINO que precisa acusá-la — acusar aqui
	# esconderia o estado em que o destino ficou.
	local codigo_da_travessia=0
	LINHAS_DA_ORIGEM="$(pg_restore -f - "${ARQUIVO_DA_COPIA}" 2>/dev/null |
		awk '/^COPY /{dentro=1;next} dentro && /^\\\.$/{dentro=0;next} dentro{n++} END{print n+0}')" ||
		codigo_da_travessia=$?
	if [[ "${codigo_da_travessia}" -ne 0 || ! "${LINHAS_DA_ORIGEM}" =~ ^[0-9]+$ ]]; then
		erro "a travessia de ${ARQUIVO_DA_COPIA} não completou (código ${codigo_da_travessia}) — a cópia pode estar truncada"
		LINHAS_DA_ORIGEM=""
	fi

	info "a cópia declara ${TOTAL_DE_RELACOES_DA_ORIGEM} relação(ões) e ${LINHAS_DA_ORIGEM:-?} linha(s) de dados"
}

# --------------------------------------------------------------------------- #
# A confirmação explícita. Só o modo `restaurar` chega aqui, e ele SEMPRE chega:
# não há bandeira que a pule.
#
# A comparação é LITERAL, contra a constante do topo. `sim`, `s`, `restaurar` em
# minúsculas e `RESTAURAR ` com espaço a mais NÃO confirmam — a confirmação é um
# ato deliberado, e um ato deliberado não se acerta por aproximação.
#
# ⚠️ A resposta NÃO é ecoada. Ela chega da entrada padrão, que num engano pode
# trazer qualquer coisa, inclusive a linha seguinte de um arquivo de segredo
# redirecionado por descuido.
# --------------------------------------------------------------------------- #
exigir_confirmacao() {
	printf '%s ATENÇÃO: a cópia acima será escrita em [%s] no agrupamento %s:%s.\n' \
		"${PREFIXO}" "${BANCO_DE_DESTINO}" "${URL_HOSPEDEIRO}" "${URL_PORTA}"
	printf '%s Para confirmar, digite exatamente %s e tecle ENTER: ' \
		"${PREFIXO}" "${TOKEN_DE_CONFIRMACAO}"

	# O desfecho do `read` é decidido: entrada padrão fechada devolve não-zero com
	# a variável vazia, e vazio NÃO confirma.
	local resposta=""
	IFS= read -r resposta || resposta=""
	printf '\n'

	if [[ "${resposta}" != "${TOKEN_DE_CONFIRMACAO}" ]]; then
		abortar \
			"a confirmação não conferiu — era esperado exatamente [${TOKEN_DE_CONFIRMACAO}], e NADA foi escrito em [${BANCO_DE_DESTINO}]" \
			"execute de novo e digite ${TOKEN_DE_CONFIRMACAO}, sem espaço a mais; a entrada padrão fechada nunca confirma"
	fi
}

# --------------------------------------------------------------------------- #
# A escrita. `--single-transaction` é deliberado: ou o destino recebe a cópia
# inteira, ou ele continua vazio. Sem ele, uma falha no meio deixaria o estado
# misto que a guarda de base vazia existe para evitar — e que se parece com
# sucesso.
#
# O desfecho é CAPTURADO e não decide o fim do procedimento: quem decide é a
# conferência abaixo, que mede o DESTINO. Abortar aqui esconderia em que estado
# o destino ficou, que é a única informação que interessa a quem restaura.
# --------------------------------------------------------------------------- #
restaurar() {
	info "restaurando ${ARQUIVO_DA_COPIA} em [${BANCO_DE_DESTINO}] como ${URL_PAPEL}"

	local codigo=0
	PGPASSFILE="${ARQ_SENHA}" PGCONNECT_TIMEOUT="${LIMITE_CONEXAO_S}" \
		pg_restore --no-password --single-transaction --exit-on-error \
		--host="${URL_HOSPEDEIRO}" --port="${URL_PORTA}" \
		--username="${URL_PAPEL}" --dbname="${BANCO_DE_DESTINO}" \
		-- "${ARQUIVO_DA_COPIA}" || codigo=$?

	# O código é NOMEADO na saída e morre aqui, de propósito: guardá-lo para a
	# conferência ler convidaria a decidir por ele, que é exatamente o defeito que
	# o `CT-1113` persegue.
	if [[ "${codigo}" -ne 0 ]]; then
		erro "o restaurador terminou com código ${codigo} — a conferência abaixo dirá em que estado o destino ficou"
	fi
}

# --------------------------------------------------------------------------- #
# A CONFERÊNCIA — ela mede o DESTINO, e é ela que decide o desfecho.
#
# Dois eixos, e os dois são necessários: o conjunto das relações (uma tabela que
# não nasceu) e o total de linhas (uma tabela que nasceu vazia). Conferir só o
# primeiro aprovaria um destino com as três tabelas e nenhum dado dentro.
#
# A igualdade é de CONJUNTO, nunca de contenção: contenção aprovaria um destino
# com relações a mais, que numa base que começou vazia é anomalia.
# --------------------------------------------------------------------------- #
readonly CONSULTA_DAS_RELACOES="
SELECT n.nspname || '.' || c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r','p','S','v','m')
   AND n.nspname NOT IN ('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%'
 ORDER BY 1
"

# A soma das linhas de todas as tabelas do destino, numa consulta só.
# `relispartition = false` impede a dupla contagem: a tabela particionada já
# soma as partições, e cada partição também é uma relação.
readonly CONSULTA_DAS_LINHAS="
SELECT coalesce(sum(linhas), 0)::text FROM (
  SELECT (xpath('/row/c/text()',
           query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                        false, true, '')))[1]::text::bigint AS linhas
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r','p') AND c.relispartition = false
     AND n.nspname NOT IN ('pg_catalog','information_schema')
     AND n.nspname NOT LIKE 'pg\\_toast%' AND n.nspname NOT LIKE 'pg\\_temp%'
) t
"

conferir_resultado() {
	local codigo=0
	consultar_destino "${CONSULTA_DAS_RELACOES}" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		abortar \
			"a conferência NÃO pôde ler as relações de [${BANCO_DE_DESTINO}] (o cliente terminou com código ${codigo}): $(diagnostico_da_consulta) — a restauração NÃO está conferida" \
			"confira se a base de destino existe e se o papel ${URL_PAPEL} pode conectar nela"
	fi
	# O desfecho da gravação do conjunto é decidido pela FAIXA, pela mesma razão
	# da extração acima: 1 é o conjunto vazio, e acima de 1 é falha de verdade.
	local arq_origem="${ARQ_RELACOES_DA_ORIGEM}"
	local arq_destino="${DIR_TEMPORARIO}/relacoes-do-destino"
	local codigo_da_gravacao=0
	printf '%s\n' "${RESULTADO_DA_CONSULTA}" | grep '[^[:space:]]' |
		LC_ALL=C sort -u >"${arq_destino}" || codigo_da_gravacao=$?
	if [[ "${codigo_da_gravacao}" -gt 1 ]]; then
		abortar \
			"não consegui registrar as relações lidas de [${BANCO_DE_DESTINO}] (código ${codigo_da_gravacao}) — a restauração NÃO está conferida" \
			"confira a permissão de escrita do diretório temporário"
	fi

	# `wc -l` conta sem falhar sobre arquivo vazio — é o que dispensa tratar aqui
	# o desfecho de um `grep` que não achou nada.
	local total_origem total_destino
	total_origem="$(wc -l <"${arq_origem}")"
	total_destino="$(wc -l <"${arq_destino}")"

	# `LC_ALL=C` no `comm` porque é a ordenação com que os dois arquivos foram
	# gravados: sob outra localidade ele avisa que a entrada não está ordenada e
	# passa a devolver diferença errada — silenciosamente, no lado do resultado.
	local faltando sobrando
	faltando="$(LC_ALL=C comm -23 "${arq_origem}" "${arq_destino}" | tr '\n' ' ')"
	sobrando="$(LC_ALL=C comm -13 "${arq_origem}" "${arq_destino}" | tr '\n' ' ')"

	if [[ -n "${faltando// /}" ]]; then
		abortar \
			"a restauração está INCOMPLETA: relações origem=${total_origem} destino=${total_destino} — faltando no destino: [${faltando% }]" \
			"a cópia pode estar truncada ou o destino pode ter perdido objetos; use outra cópia do acervo e restaure numa base vazia"
	fi
	if [[ -n "${sobrando// /}" ]]; then
		abortar \
			"o destino tem relações que a cópia NÃO declara: relações origem=${total_origem} destino=${total_destino} — sobrando no destino: [${sobrando% }]" \
			"o destino não estava vazio quando recebeu a cópia; restaure numa base vazia"
	fi

	codigo=0
	consultar_destino "${CONSULTA_DAS_LINHAS}" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		abortar \
			"a conferência NÃO pôde contar as linhas de [${BANCO_DE_DESTINO}] (o cliente terminou com código ${codigo}): $(diagnostico_da_consulta) — a restauração NÃO está conferida" \
			"confira se o papel ${URL_PAPEL} pode ler as tabelas restauradas"
	fi
	local linhas_do_destino="${RESULTADO_DA_CONSULTA}"

	if [[ -z "${LINHAS_DA_ORIGEM}" ]]; then
		abortar \
			"a conferência NÃO tem o total de linhas da origem: a travessia de ${ARQUIVO_DA_COPIA} não completou, e o destino tem ${linhas_do_destino} linha(s) — a restauração NÃO está conferida" \
			"use uma cópia íntegra do acervo — a cópia atual não pôde ser lida de ponta a ponta"
	fi

	if [[ "${linhas_do_destino}" != "${LINHAS_DA_ORIGEM}" ]]; then
		abortar \
			"a restauração está INCOMPLETA: linhas origem=${LINHAS_DA_ORIGEM} destino=${linhas_do_destino}, com as ${total_destino} relação(ões) presentes" \
			"a cópia pode estar truncada; use outra do acervo e restaure numa base vazia"
	fi

	info "restauração CONFERIDA em [${BANCO_DE_DESTINO}]: relacoes=${total_destino} linhas=${linhas_do_destino}"
}

main() {
	conferir_invocacao
	ler_conexao_da_operacao

	# A GUARDA DA ADR-0006, antes de qualquer conexão ao destino e nos três modos.
	# Ver o cabeçalho: ela não tem bandeira que a desligue.
	recusar_destino_da_operacao

	preparar_credencial

	# A guarda de base vazia protege a ESCRITA, e por isso não roda no modo que
	# confere um destino já restaurado — ali a base não estar vazia é a premissa.
	if [[ "${MODO}" != "conferir" ]]; then
		exigir_destino_vazio
	fi

	listar_conteudo_da_copia

	if [[ "${MODO}" == "ensaio" ]]; then
		info "ENSAIO: nada foi escrito em [${BANCO_DE_DESTINO}] — execute sem o modo 'ensaio' para restaurar de verdade"
		return 0
	fi

	if [[ "${MODO}" == "restaurar" ]]; then
		exigir_confirmacao
		restaurar
	fi

	conferir_resultado
}

main
