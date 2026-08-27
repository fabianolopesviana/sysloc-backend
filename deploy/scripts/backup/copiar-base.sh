#!/usr/bin/env bash
#
# Cópia de segurança da base do Sysloc — T2 da fatia `publicacao-e-backup`.
#
# Produz UMA cópia do dia, em formato próprio para restauração seletiva, confere
# a integridade do arquivo que acabou de gerar e expurga do destino o que passou
# do prazo de guarda. É o que a `sysloc-backup-da-base.service` dispara pelo
# relógio do sistema (T4).
#
# ---------------------------------------------------------------------------
# POR QUE ELE EXISTE, E POR QUE ANTES DA PUBLICAÇÃO
# ---------------------------------------------------------------------------
#
# Expor o banco sem cópia preservada é a única sequência irreversível desta
# fatia: um defeito na borda se corrige, uma base perdida não volta. Por isso a
# preservação vem antes da religação, e não depois.
#
# ---------------------------------------------------------------------------
# A CÓPIA OU EXISTE ÍNTEGRA OU NÃO EXISTE — as duas etapas e a razão delas
# ---------------------------------------------------------------------------
#
# O arquivo nasce com o sufixo `.parcial`, atravessa a conferência de
# integridade e SÓ ENTÃO é renomeado para o nome do dia. A renomeação é atômica
# dentro do mesmo sistema de arquivos, de modo que ninguém encontra, com o nome
# do dia, um arquivo que não atravessou a conferência.
#
# Escrever direto sobre o nome final deixaria uma cópia pela metade caso o
# processo morresse no meio — e uma cópia truncada é pior que nenhuma: ela tem o
# nome certo, o tamanho parece plausível, e a descoberta de que ela não restaura
# acontece no dia em que ela é a única coisa que restou.
#
# A conferência é executada SEMPRE, inclusive quando a geração já falhou. É ela
# que nomeia, numa frase só, o motivo de o arquivo não ter sido publicado.
#
# ---------------------------------------------------------------------------
# O EXPURGO DECIDE POR IDADE, NUNCA POR NOME NEM POR EXTENSÃO
# ---------------------------------------------------------------------------
#
# O eixo é o tempo de modificação do próprio item do diretório, e nada mais.
# Filtro por nome ou por extensão é a forma que já falhou neste repositório: o
# resíduo `.parcial` de uma execução interrompida tem nome que nenhum filtro
# antecipa, e ele acumula indefinidamente com a bateria verde — foi exatamente
# a razão de existir do `CT-1087 (f)`, na fatia `automacoes-agendadas`.
#
# ⚠️ O expurgo é escopado em `${RAIZ_DO_BACKUP}/${SUBDIRETORIO_DAS_COPIAS}`, e o
# escopo NÃO é detalhe. Um nível acima, em `/opt/backups`, ele alcançaria
# `/opt/backups/frappe/daily` — a preservação do sistema legado, que segue de pé
# e só é desligado na F7. Apagar cópia de produção alheia por generalidade de
# caminho é o modo de falhar mais caro possível para uma rotina de salvaguarda.
#
# Subdiretório fixo fecha METADE do risco. A outra metade é a raiz, que chega
# crua do operador — e três guardas, em eixos diferentes, fecham-na:
#
#   (a) VÍNCULO NO DESTINO RECUSA. `[[ -d ]]` e `chmod` sem `-h` seguem vínculo
#       simbólico, de modo que um destino apontando para a árvore do legado faria
#       esta rotina corrigir o modo do diretório ALHEIO. A recusa roda antes da
#       canonização: depois dela o vínculo já teria sido resolvido.
#   (b) O CAMINHO É CANONIZADO (`realpath -m`), e com isso `.`, `..` e caminho
#       relativo deixam de ser formas distintas de escrever o mesmo lugar. Sem
#       isso, `SYSLOC_RAIZ_DO_BACKUP=/opt/backups/sysloc/../frappe` compunha um
#       destino que o `find` resolvia normalmente enquanto toda mensagem desta
#       rotina exibia a grafia que ninguém reconheceria.
#   (c) A RAIZ É AFIRMADA COMO NOSSA antes de QUALQUER efeito, pela entrada
#       única `afirmar_propriedade_da_raiz` — e ela roda nos DOIS modos, em
#       `main`, antes de `mkdir`, de `chmod`, de `install` e de `rm`.
#
# ⚠️ A (c) foi reescrita porque ADOTAR uma raiz e SER DONO dela são coisas
# diferentes, e confundi-las era o defeito. A sentinela era gravada a cada
# execução, incondicionalmente: a própria execução produzia a marca que a
# execução seguinte leria como prova. Bastava apontar o modo padrão para
# `/opt/backups/frappe` uma vez — a raiz alheia ganhava modo 700 nos dois níveis
# (quebrando a rotina de backup do legado, que segue de pé até a F7) e ganhava a
# sentinela; da segunda passada em diante, o expurgo por idade reconhecia as 17
# cópias de produção do legado como acervo próprio e as removia.
#
# São TRÊS as origens de propriedade, e todas antecedem o efeito:
#
#   · CRIAÇÃO   — a raiz não existia e é esta execução que a cria. Nada alheio
#                 pode estar dentro do que ainda não é.
#   · SENTINELA — a raiz já traz `.acervo-sysloc` como ARQUIVO COMUM. Vínculo
#                 simbólico não conta: `[[ -f ]]` o segue, e um vínculo para
#                 qualquer arquivo do sistema faria a árvore alheia parecer
#                 nossa.
#   · VACUIDADE — a raiz existe e não guarda acervo algum (nenhum item que não
#                 seja diretório, em nenhum nível). Não há o que destruir, e é
#                 o caso do operador que criou o destino com `mkdir` antes da
#                 primeira execução.
#
# Fora dessas três, RECUSA — antes do `chmod`, e com o mesmo diagnóstico nos
# dois modos.
#
# ⚠️ E a porta não é convenção: `preparar_destino`, `copiar` e `expurgar`
# EXIGEM o veredito (`exigir_propriedade_afirmada`) e abortam sem ele. Uma
# trilha futura — modo novo, argumento novo, chamada nova — que alcance a raiz
# sem passar pela entrada única falha em vez de adotar. É o que impede o defeito
# de voltar por um caminho que ninguém antecipou, que é exatamente como ele
# voltou desta vez.
#
# ⚠️ A (c) NÃO reintroduz decisão por nome no eixo do expurgo. O eixo das
# ENTRADAS continua sendo exclusivamente a idade — nenhum nome de cópia participa
# da decisão, e o `CT-1100` segue provando isso com o par de nomes trocados. A
# sentinela responde outra pergunta, e sobre outro objeto: "este acervo é meu?",
# nunca "esta entrada venceu?".
#
# ⚠️ E ela vive na RAIZ do backup, não dentro do diretório das cópias. Dentro
# dele seria um item do acervo listado, e as quatro asserções de IGUALDADE DE
# CONJUNTO da bateria — a rede antivácuo mais forte que este procedimento tem —
# teriam de ser afrouxadas para tolerá-la. Trocar rede existente por sentinela é
# o negócio errado.
#
# Duas propriedades herdadas do molde já provado (`guarda-de-boletos.ts`):
#
#   1. Reconhecer TUDO antes de remover QUALQUER COISA. A varredura que
#      interrompesse na primeira anomalia deixaria o destino meio expurgado.
#   2. O que não é arquivo comum não é cópia, e não se remove. Vínculo
#      simbólico e diretório são ignorados — a idade lida é a do PRÓPRIO item,
#      nunca a do alvo de um vínculo.
#
# ---------------------------------------------------------------------------
# ADR-0005 — NENHUMA CREDENCIAL NESTE ARQUIVO
# ---------------------------------------------------------------------------
#
# Este script é versionado e não carrega segredo. A credencial do banco é lida
# em tempo de execução do arquivo de ambiente que vive fora da árvore versionada
# (o mesmo `EnvironmentFile=` 0600 das unidades de serviço) e chega ao cliente
# por um arquivo de senha temporário de modo 0600 — nunca por argumento de linha
# de comando, que qualquer usuário da máquina leria na tabela de processos, e
# nunca por variável de ambiente exportada, que todo processo filho herdaria.
# Pela mesma razão, o rastreio verboso de comandos do shell jamais é ligado
# aqui: ele ecoaria o valor no diário do sistema.
#
# ---------------------------------------------------------------------------
# ADR-0032 — O QUE ESTA CÓPIA CARREGA, E O QUE ELA NÃO PODE CARREGAR JUNTO
# ---------------------------------------------------------------------------
#
# A cópia carrega o segredo operável do provedor bancário CIFRADO, porque ele é
# coluna do banco. A chave que o decifra NÃO pode ser salvaguardada junto — é
# cláusula literal da `Decision` da ADR-0032. Quem preserva a chave é
# `preservar-segredos.sh`, e ele a manda para um destino próprio, fora de
# `${RAIZ_DO_BACKUP}`. Reunir os dois aqui, por conveniência de arrumação,
# anularia a cifra para quem obtivesse o backup.
#
# ---------------------------------------------------------------------------
# O QUE A CÓPIA NÃO CARREGA — limite conhecido, não omissão
# ---------------------------------------------------------------------------
#
# Papel de banco é objeto do AGRUPAMENTO, não da base: `sysloc_app` e
# `sysloc_migracao` são criados por `provisionar-base.sh` e não viajam nesta
# cópia. A consequência está declarada na §3.4 do escopo da fatia: a restauração
# se prova numa base vazia do MESMO agrupamento, onde os papéis já existem.
#
# ---------------------------------------------------------------------------
# PARÂMETROS (variáveis de ambiente)
# ---------------------------------------------------------------------------
#
#   SYSLOC_ARQ_AMBIENTE               Arquivo de ambiente com a linha
#                                     `DATABASE_URL=` da base a copiar.
#                                     Padrão: /etc/sysloc/backend.env
#
#   SYSLOC_RAIZ_DO_BACKUP             Raiz do destino. As cópias ficam em
#                                     <raiz>/daily.
#                                     Padrão: /opt/backups/sysloc
#
#   SYSLOC_PRAZO_DE_GUARDA_EM_DIAS    Prazo de guarda, em dias inteiros
#                                     positivos. Padrão: o valor da constante
#                                     PRAZO_DE_GUARDA_EM_DIAS abaixo.
#
# ---------------------------------------------------------------------------
# USO E CONTRATO DE SAÍDA
# ---------------------------------------------------------------------------
#
#   bash deploy/scripts/backup/copiar-base.sh              # copia e expurga
#   bash deploy/scripts/backup/copiar-base.sh expurgar     # só expurga
#
# O modo `expurgar` existe para o operador que precisa recuperar espaço sem
# produzir uma cópia nova — e é o único que não fala com o banco. O relógio do
# sistema dispara o modo padrão, sem argumento.
#
#   0  a cópia do dia existe, íntegra, e o expurgo terminou.
#   1  reprovou o que este procedimento existe para garantir. Quando a reprovação
#      é da CÓPIA, NÃO há arquivo com o nome do dia e NÃO há resíduo `.parcial` —
#      a falha nunca deixa meia cópia para trás.
#
#      ⚠️ A RAIZ QUE ESTA ROTINA NÃO PODE AFIRMAR COMO SUA também sai com 1, e
#      essa recusa acontece ANTES de qualquer efeito, nos dois modos: nada é
#      criado, nenhum modo é corrigido e nada é removido.
#
#      ⚠️ O EXPURGO TAMBÉM REPROVA COM 1, e ele roda DEPOIS da publicação: um
#      destino que não pôde ser lido ou uma cópia vencida que resistiu à remoção
#      saem com 1 com a cópia do dia JÁ publicada e íntegra. A mensagem diz qual dos dois falhou, e a do expurgo
#      declara que o publicado permanece. Sair 0 ali diria ao relógio do sistema
#      que o expurgo terminou quando ele não terminou.
#
# Verificação correspondente:
#
#   bash deploy/scripts/backup/verificar-backup.sh
#
# ⚠️ A leitura da cadeia de conexão (`extrair_url_do_arquivo` e `decompor_url`)
# é a SEGUNDA cópia do molde de `deploy/scripts/instalacao/apurar-versao-banco.sh`.
# São duas, e o Limiar de Três do `CLAUDE.md` dispara na terceira: quem escrever
# a terceira sobe as duas funções para casa compartilhada em vez de copiá-las.
#

set -Eeuo pipefail

readonly PREFIXO="[copiar-base]"

# --------------------------------------------------------------------------- #
# Constantes. O prazo de guarda é declarado UMA vez, aqui, e a bateria o LÊ
# deste ponto em vez de reescrever o número: um valor repetido do lado da prova
# poria o alvo sob exame nos dois lados da comparação, e a asserção não poderia
# falhar.
# --------------------------------------------------------------------------- #
readonly PRAZO_DE_GUARDA_EM_DIAS=14

readonly RAIZ_DO_BACKUP_PADRAO="/opt/backups/sysloc"
readonly SUBDIRETORIO_DAS_COPIAS="daily"

# A sentinela que declara a raiz como acervo DESTA rotina — ver o cabeçalho. Ela
# vive na raiz, e não no diretório das cópias, e o expurgo a exige.
readonly NOME_DA_SENTINELA=".acervo-sysloc"
readonly TEXTO_DA_SENTINELA="acervo de cópias da base do Sysloc — copiar-base.sh só expurga onde este arquivo existe; não o remova"
readonly ARQ_AMBIENTE_PADRAO="/etc/sysloc/backend.env"

readonly PREFIXO_DA_COPIA="base-"
readonly SUFIXO_DA_COPIA=".dump"
# O mesmo sufixo do molde de `guarda-de-boletos.ts`: intermediário no MESMO
# diretório do destino, para que a renomeação seja atômica.
readonly SUFIXO_PARCIAL=".parcial"

# Os cinco primeiros bytes do formato próprio de restauração seletiva. É a
# primeira das três pernas da conferência de integridade.
readonly ASSINATURA_DO_FORMATO="PGDMP"

readonly SEGUNDOS_POR_DIA=86400

# Modo do destino e dos artefatos. Corrigidos a cada execução, e não apenas
# acertados na criação: um diretório preexistente frouxo é o caso comum, e ele
# não se conserta sozinho.
readonly MODO_DO_DIRETORIO="700"
readonly MODO_DO_ARQUIVO="600"

# Limite de espera por conexão, em segundos. Sem ele, um endereço inalcançável
# ficaria pendurado no tempo padrão do sistema e a rotina do relógio pareceria
# travada em vez de falhar.
readonly LIMITE_CONEXAO_S=10

# Os dois modos aceitos no argumento posicional. Ver o cabeçalho: o relógio do
# sistema dispara o padrão, sem argumento.
readonly MODOS_ACEITOS="copiar expurgar"

# --------------------------------------------------------------------------- #
# Parâmetros de operação — ver o cabeçalho.
# --------------------------------------------------------------------------- #
ARQ_AMBIENTE="${SYSLOC_ARQ_AMBIENTE:-${ARQ_AMBIENTE_PADRAO}}"
RAIZ_DO_BACKUP="${SYSLOC_RAIZ_DO_BACKUP:-${RAIZ_DO_BACKUP_PADRAO}}"
PRAZO_EFETIVO="${SYSLOC_PRAZO_DE_GUARDA_EM_DIAS:-${PRAZO_DE_GUARDA_EM_DIAS}}"
MODO="${1:-copiar}"

DIR_DAS_COPIAS="${RAIZ_DO_BACKUP}/${SUBDIRETORIO_DAS_COPIAS}"

# --------------------------------------------------------------------------- #
# Estado interno. Nada aqui é exportado: exportar poria o segredo no ambiente de
# todo processo filho.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
ARQUIVO_PARCIAL=""
URL_LIDA=""
CHAVES_REPETIDAS=""
URL_PAPEL=""
URL_SEGREDO=""
URL_HOSPEDEIRO=""
URL_PORTA=""
URL_BANCO=""
MOTIVO_DA_CONFERENCIA=""
ENTRADAS_LISTADAS=0
# O veredito da entrada única de propriedade. Vazio significa "ainda não
# afirmada", e é isso que `exigir_propriedade_afirmada` lê.
RAIZ_ADOTADA_POR=""

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
	# O intermediário NUNCA sobrevive ao processo. Deixá-lo ao lado das cópias
	# acumularia lixo que ninguém sabe interpretar — e, pior, lixo que só o
	# expurgo por idade alcançaria, dias depois.
	if [[ -n "${ARQUIVO_PARCIAL}" && -f "${ARQUIVO_PARCIAL}" ]]; then
		rm -f "${ARQUIVO_PARCIAL}"
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
	# usaria a PRIMEIRA; copiar uma base enquanto o serviço atende outra é
	# exatamente a divergência que uma rotina de salvaguarda não pode ter.
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
# Decomposição da cadeia nas partes que o cliente precisa receber separadamente
# — é o que permite manter o segredo fora do argumento de linha de comando.
#
# Aceita as duas formas em uso nesta base: endereço com porta, e socket de
# domínio Unix declarado na consulta.
#
# A captura da credencial vai até o ÚLTIMO separador de autoridade de propósito:
# com uma classe restrita, um segredo que o contivesse seria cortado no primeiro
# deles e o pedaço seguiria adiante como se fosse a credencial inteira — a
# conexão falharia e a mensagem culparia o servidor.
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
	# decodificada — a razão está registrada por extenso no molde
	# (`apurar-versao-banco.sh`): decodificar introduziria um caminho novo de
	# manipulação de credencial para atender uma forma que nenhum produtor deste
	# repositório emite.
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
# Conferência do prazo de guarda — a PRIMEIRA coisa que este procedimento faz,
# antes de o destino sequer ser lido.
#
# O expurgo é destrutivo, e um prazo inválido classificaria o destino inteiro
# como vencido. `0` em particular NÃO é "apague tudo": é ausência de prazo, e
# ausência de prazo se recusa. A mensagem nomeia a variável e o valor recebido,
# porque quem executa isto é um relógio, e o diário do sistema é a única coisa
# que sobra para diagnosticar.
# --------------------------------------------------------------------------- #
conferir_prazo() {
	if [[ ! "${PRAZO_EFETIVO}" =~ ^[0-9]+$ ]] || [[ "${PRAZO_EFETIVO}" -lt 1 ]]; then
		abortar \
			"PRAZO_DE_GUARDA_EM_DIAS recebeu [${PRAZO_EFETIVO}], que não é um número inteiro de dias maior que zero — nada foi removido" \
			"informe SYSLOC_PRAZO_DE_GUARDA_EM_DIAS com um inteiro >= 1, ou deixe-a ausente para usar o padrão de ${PRAZO_DE_GUARDA_EM_DIAS} dia(s)"
	fi
}

# --------------------------------------------------------------------------- #
# Vínculo simbólico no destino RECUSA, e nunca é seguido — guarda (a) do
# cabeçalho.
#
# Ela roda ANTES da canonização de propósito: depois dela o vínculo já teria sido
# resolvido e não haveria o que testar. O que está em jogo é o `chmod` sem `-h`
# de `preparar_destino`, que altera o modo do ALVO, e o expurgo, que agiria sobre
# o acervo dele.
# --------------------------------------------------------------------------- #
recusar_vinculo_no_destino() {
	local caminho
	for caminho in "${RAIZ_DO_BACKUP}" "${DIR_DAS_COPIAS}"; do
		if [[ -L "${caminho}" ]]; then
			abortar \
				"o destino ${caminho} é um vínculo simbólico para [$(readlink -- "${caminho}" || true)] — esta rotina não escreve nem expurga através de vínculo no destino, e NADA foi removido" \
				"informe SYSLOC_RAIZ_DO_BACKUP apontando para um diretório de verdade"
		fi
	done
}

# --------------------------------------------------------------------------- #
# Canonização do destino — guarda (b) do cabeçalho.
#
# `realpath -m` resolve `.`, `..`, caminho relativo e vínculo simbólico SEM
# exigir que o caminho já exista, que é justamente o caso da primeira execução.
# A partir daqui, `${RAIZ_DO_BACKUP}` e `${DIR_DAS_COPIAS}` são a identidade do
# lugar no sistema de arquivos, e não a grafia que alguém digitou.
# --------------------------------------------------------------------------- #
canonizar_destino() {
	local resolvida
	resolvida="$(realpath -m -- "${RAIZ_DO_BACKUP}" 2>/dev/null)" || resolvida=""
	if [[ -z "${resolvida}" ]]; then
		abortar \
			"não consegui resolver a raiz do backup [${RAIZ_DO_BACKUP}] à forma canônica — NADA foi removido" \
			"informe SYSLOC_RAIZ_DO_BACKUP com um caminho absoluto"
	fi

	if [[ "${resolvida}" != "${RAIZ_DO_BACKUP}" ]]; then
		info "a raiz do backup [${RAIZ_DO_BACKUP}] foi resolvida para ${resolvida}"
	fi

	RAIZ_DO_BACKUP="${resolvida}"
	DIR_DAS_COPIAS="${RAIZ_DO_BACKUP}/${SUBDIRETORIO_DAS_COPIAS}"
}

# --------------------------------------------------------------------------- #
# A recusa da raiz alheia — UMA frase, para os dois modos e para todos os ramos.
#
# O texto nomeia o destino RESOLVIDO, porque a canonização já rodou e a grafia
# que o operador digitou não é o lugar onde o efeito aconteceria.
#
# $1 = o que se observou, em uma frase.
# --------------------------------------------------------------------------- #
recusar_raiz_alheia() {
	abortar \
		"$1 — este destino NÃO é o acervo desta rotina, e NADA foi criado, alterado nem removido em ${DIR_DAS_COPIAS}" \
		"aponte SYSLOC_RAIZ_DO_BACKUP para a raiz do acervo desta rotina — ela é adotada quando esta rotina a cria, quando já traz ${NOME_DA_SENTINELA}, ou quando ainda não guarda arquivo nenhum"
}

# --------------------------------------------------------------------------- #
# DECISÃO FECHADA — T2 / Gate 1 rodada 3 · 2026-08-25
# O QUÊ: a propriedade da raiz é afirmada por ESTA função, uma única vez, em
#        `main`, antes de qualquer efeito — e `preparar_destino`, `copiar` e
#        `expurgar` exigem o veredito dela para agir.
# POR QUÊ: instalada em pontos, a guarda fechou a trilha `expurgar` na rodada 2
#          e deixou a trilha `copiar` aberta: `preparar_destino` fazia `chmod
#          700` e gravava a sentinela numa raiz alheia INCONDICIONALMENTE, de
#          modo que a execução seguinte reconhecia como acervo próprio a árvore
#          que ela mesma marcara e removia por idade as cópias de produção do
#          sistema legado. É o mesmo defeito da rodada 1 voltando por caminho
#          novo — a assinatura que a §5 de `.claude/rules/nao-regressao.md`
#          manda atacar pela topologia, e não pela ocorrência.
# REVERTER EXIGE: provar que nenhuma trilha deste script — modo, argumento ou
#          chamada — alcança `mkdir`, `chmod`, `install` ou `rm` sob
#          ${RAIZ_DO_BACKUP} sem ter passado por aqui antes.
# --------------------------------------------------------------------------- #
afirmar_propriedade_da_raiz() {
	local sentinela="${RAIZ_DO_BACKUP}/${NOME_DA_SENTINELA}"

	# Vínculo na raiz já foi recusado por `recusar_vinculo_no_destino`, que roda
	# antes desta: aqui a ausência é ausência de verdade.
	if [[ ! -e "${RAIZ_DO_BACKUP}" ]]; then
		RAIZ_ADOTADA_POR="criacao"
		return 0
	fi

	if [[ ! -d "${RAIZ_DO_BACKUP}" ]]; then
		recusar_raiz_alheia "a raiz ${RAIZ_DO_BACKUP} existe e NÃO é um diretório"
	fi

	# `-L` vem ANTES de `-e`/`-f` de propósito: os dois seguem o vínculo, e uma
	# sentinela apontando para qualquer arquivo comum do sistema faria a árvore
	# alheia parecer nossa. Vínculo não prova propriedade de nada.
	if [[ -L "${sentinela}" ]]; then
		recusar_raiz_alheia "a sentinela ${sentinela} é um vínculo simbólico, e vínculo não prova propriedade"
	fi
	if [[ -e "${sentinela}" ]]; then
		if [[ ! -f "${sentinela}" ]]; then
			recusar_raiz_alheia "a sentinela ${sentinela} existe e NÃO é um arquivo comum"
		fi
		RAIZ_ADOTADA_POR="sentinela"
		return 0
	fi

	# Sem sentinela: a raiz só é adotável se não guardar acervo algum. Diretório
	# vazio não é acervo; arquivo é, em qualquer nível. A varredura para no
	# primeiro achado, não segue vínculo (`! -type d` é sobre o PRÓPRIO item) e,
	# se não puder ler a árvore inteira, RECUSA — não saber é o mesmo que não
	# poder afirmar.
	local vestigio="" codigo=0
	vestigio="$(find "${RAIZ_DO_BACKUP}" -mindepth 1 ! -type d -print -quit 2>/dev/null)" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		recusar_raiz_alheia "não consegui varrer ${RAIZ_DO_BACKUP} por inteiro para saber se ela guarda acervo alheio (a varredura terminou com código ${codigo})"
	fi
	if [[ -n "${vestigio}" ]]; then
		recusar_raiz_alheia "a raiz ${RAIZ_DO_BACKUP} já existe, não tem ${NOME_DA_SENTINELA} e guarda [${vestigio}]"
	fi

	RAIZ_ADOTADA_POR="vacuidade"
	return 0
}

# --------------------------------------------------------------------------- #
# A exigência do veredito — é ela que faz da entrada única uma PORTA, e não uma
# convenção que a próxima trilha esquece.
#
# $1 = o nome da etapa que exigiu, para o diagnóstico.
# --------------------------------------------------------------------------- #
exigir_propriedade_afirmada() {
	if [[ -z "${RAIZ_ADOTADA_POR}" ]]; then
		abortar \
			"defeito interno: a etapa [$1] foi alcançada sem que a propriedade de ${RAIZ_DO_BACKUP} tivesse sido afirmada — NADA foi criado, alterado nem removido" \
			"toda trilha que toca a raiz passa antes por afirmar_propriedade_da_raiz; ver a DECISÃO FECHADA ao lado dela"
	fi
}

# --------------------------------------------------------------------------- #
# Prepara o destino: cria o que falta e CORRIGE o modo do que já existia.
#
# Corrigir, e não apenas acertar na criação, é o ponto: o caso comum é o
# diretório que já existe com modo frouxo, e uma rotina que só acerta na criação
# nunca o alcança.
# --------------------------------------------------------------------------- #
preparar_destino() {
	exigir_propriedade_afirmada "preparar_destino"

	local diretorio
	for diretorio in "${RAIZ_DO_BACKUP}" "${DIR_DAS_COPIAS}"; do
		if [[ ! -d "${diretorio}" ]]; then
			mkdir -p "${diretorio}" ||
				abortar "não consegui criar o destino ${diretorio}" \
					"confira a permissão de escrita do caminho, ou informe SYSLOC_RAIZ_DO_BACKUP"
		fi
		chmod "${MODO_DO_DIRETORIO}" "${diretorio}" ||
			abortar "não consegui corrigir o modo de ${diretorio} para ${MODO_DO_DIRETORIO}" \
				"confira o dono do caminho — a cópia guarda dado de clientes reais e não fica legível a terceiros"
	done

	# A sentinela é gravada a CADA execução, e não apenas quando a raiz é criada:
	# uma raiz legítima anterior a esta guarda nunca a ganharia de outro modo, e o
	# expurgo dela recusaria para sempre.
	#
	# ⚠️ Gravar aqui só é legítimo porque `afirmar_propriedade_da_raiz` já correu:
	# a marca passou a ser CONSEQUÊNCIA da propriedade, e não a prova dela. A
	# recusa de sentinela-vínculo que morava neste ponto subiu para lá, e com isso
	# passou a valer também no modo `expurgar`, onde faltava.
	local sentinela="${RAIZ_DO_BACKUP}/${NOME_DA_SENTINELA}"
	install -m "${MODO_DO_ARQUIVO}" /dev/null "${sentinela}" ||
		abortar "não consegui gravar a sentinela ${sentinela}" \
			"confira a permissão de escrita da raiz do backup"
	printf '%s\n' "${TEXTO_DA_SENTINELA}" >"${sentinela}"
}

# --------------------------------------------------------------------------- #
# Conferência de integridade do arquivo produzido — três pernas, e cada uma
# alcança um modo de falhar diferente:
#
#   (1) assinatura   — o arquivo é do formato de restauração seletiva, e não um
#                      texto de erro do cliente gravado no lugar dele;
#   (2) listagem     — o índice do arquivo é legível e tem ao menos uma entrada;
#   (3) travessia    — o arquivo INTEIRO é lido de ponta a ponta. É a única
#                      perna que alcança o truncamento no meio: o índice de uma
#                      cópia interrompida ainda pode ser lido, e um verificador
#                      que parasse na perna (2) aprovaria a meia cópia.
#
# Devolve 0 (íntegra) ou 1, com o motivo em ${MOTIVO_DA_CONFERENCIA}.
# --------------------------------------------------------------------------- #
conferir_integridade() {
	local arquivo="$1"
	MOTIVO_DA_CONFERENCIA=""
	ENTRADAS_LISTADAS=0

	if [[ ! -s "${arquivo}" ]]; then
		MOTIVO_DA_CONFERENCIA="o arquivo não existe ou está vazio"
		return 1
	fi

	local assinatura
	assinatura="$(head -c "${#ASSINATURA_DO_FORMATO}" "${arquivo}" 2>/dev/null || true)"
	if [[ "${assinatura}" != "${ASSINATURA_DO_FORMATO}" ]]; then
		MOTIVO_DA_CONFERENCIA="a assinatura do formato não confere — esperada [${ASSINATURA_DO_FORMATO}]"
		return 1
	fi

	local entradas
	entradas="$(pg_restore -l "${arquivo}" 2>/dev/null | grep -cE '^[0-9]' || true)"
	if [[ "${entradas}" -lt 1 ]]; then
		MOTIVO_DA_CONFERENCIA="a listagem do conteúdo não devolveu nenhuma entrada"
		return 1
	fi

	if ! pg_restore -f /dev/null "${arquivo}" >/dev/null 2>&1; then
		MOTIVO_DA_CONFERENCIA="a travessia do arquivo inteiro falhou — a cópia está truncada ou corrompida"
		return 1
	fi

	ENTRADAS_LISTADAS="${entradas}"
	return 0
}

# --------------------------------------------------------------------------- #
# Produz a cópia do dia. O intermediário nasce no MESMO diretório do destino
# para que a renomeação seja atômica, e com máscara restritiva para que ele
# jamais exista, nem por um instante, legível a terceiros.
# --------------------------------------------------------------------------- #
copiar() {
	exigir_propriedade_afirmada "copiar"

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

	DIR_TEMPORARIO="$(mktemp -d)"
	chmod 700 "${DIR_TEMPORARIO}"

	local arq_senha="${DIR_TEMPORARIO}/senha"
	install -m 0600 /dev/null "${arq_senha}"
	printf '%s:%s:%s:%s:%s\n' \
		"$(escapar_para_arquivo_de_senha "${URL_HOSPEDEIRO}")" \
		"${URL_PORTA}" \
		"$(escapar_para_arquivo_de_senha "${URL_BANCO}")" \
		"$(escapar_para_arquivo_de_senha "${URL_PAPEL}")" \
		"$(escapar_para_arquivo_de_senha "${URL_SEGREDO}")" >"${arq_senha}"

	local data
	data="$(date +%F)"
	local destino="${DIR_DAS_COPIAS}/${PREFIXO_DA_COPIA}${data}${SUFIXO_DA_COPIA}"
	ARQUIVO_PARCIAL="${destino}${SUFIXO_PARCIAL}"

	info "copiando ${URL_BANCO} de ${URL_HOSPEDEIRO}:${URL_PORTA} como ${URL_PAPEL}"

	# A geração pode falhar, e a falha NÃO aborta aqui: a conferência abaixo roda
	# de qualquer maneira, e é ela que nomeia, numa frase só, por que o arquivo
	# não foi publicado. Sem isso, uma instância derrubada no meio da cópia
	# produziria uma mensagem do cliente e nenhuma afirmação sobre a integridade.
	local codigo_da_geracao=0
	(
		umask 077
		PGPASSFILE="${arq_senha}" PGCONNECT_TIMEOUT="${LIMITE_CONEXAO_S}" \
			pg_dump --format=custom --no-password \
			--host="${URL_HOSPEDEIRO}" --port="${URL_PORTA}" \
			--username="${URL_PAPEL}" --dbname="${URL_BANCO}" \
			--file="${ARQUIVO_PARCIAL}"
	) || codigo_da_geracao=$?

	if [[ "${codigo_da_geracao}" -ne 0 ]]; then
		erro "a geração da cópia terminou com código ${codigo_da_geracao}"
	fi

	if ! conferir_integridade "${ARQUIVO_PARCIAL}"; then
		# O `trap` remove o intermediário; nada com o nome do dia chega a existir.
		abortar \
			"a conferência de integridade da cópia REPROVOU: ${MOTIVO_DA_CONFERENCIA} — nada foi publicado com o nome do dia" \
			"confira se a instância em ${URL_HOSPEDEIRO}:${URL_PORTA} está de pé e execute de novo"
	fi

	info "conferência de integridade aprovada — ${ENTRADAS_LISTADAS} entrada(s) no conteúdo"

	chmod "${MODO_DO_ARQUIVO}" "${ARQUIVO_PARCIAL}"
	mv -f "${ARQUIVO_PARCIAL}" "${destino}"
	# A partir daqui o intermediário já não existe: zerar a variável impede que a
	# limpeza remova o arquivo publicado se algo falhar adiante.
	ARQUIVO_PARCIAL=""

	info "cópia publicada: ${destino}"
}

# --------------------------------------------------------------------------- #
# Expurgo por idade. Reconhece TUDO antes de remover QUALQUER COISA.
#
# O resumo é a linha que o operador lê no diário do sistema, e ele declara os
# TRÊS lados: o que saiu, o que ficou e o que resistiu. "removidas=0" sozinho é
# ambíguo — não distingue destino limpo de destino que a varredura não conseguiu
# ler —, e a ambiguidade só deixa de existir porque os dois desfechos abaixo são
# capturados em vez de descartados:
#
#   · o CÓDIGO DE SAÍDA DA VARREDURA. Ler a listagem por substituição de processo
#     descartava-o (`set -euo pipefail` NÃO alcança substituição de processo), e
#     um destino sem permissão de leitura produzia `removidas=0 mantidas=0` com
#     saída 0 — exatamente o par de um destino legitimamente vazio, que é o caso
#     que este comentário afirmava resolver. A listagem passa por arquivo para
#     que o desfecho exista.
#   · a FALHA DE CADA REMOÇÃO. Tratada como silêncio, a cópia vencida que
#     resistiu não era contada em `removidas`, não era contada em `mantidas`, e
#     não aparecia em lugar nenhum.
#
# A ordem é deliberada: primeiro se sabe LER o destino, depois se decide se ele é
# NOSSO. Invertê-la faria um destino ilegível ser recusado como "acervo alheio",
# porque a sentinela não pôde ser vista — diagnóstico errado para quem só tem o
# diário do sistema.
# --------------------------------------------------------------------------- #
expurgar() {
	exigir_propriedade_afirmada "expurgar"

	if [[ ! -d "${DIR_DAS_COPIAS}" ]]; then
		# Destino ausente é benigno no expurgo: não há acervo a limpar. Ele NÃO é
		# criado aqui — quem o cria é `preparar_destino`, no caminho da cópia.
		info "expurgo: destino ${DIR_DAS_COPIAS} ainda não existe — nada a remover"
		return 0
	fi

	# O modo `expurgar` não passa por `copiar`, e portanto pode chegar aqui sem
	# área temporária. Quem a criar aqui não precisa removê-la: `limpar` o faz.
	if [[ -z "${DIR_TEMPORARIO}" || ! -d "${DIR_TEMPORARIO}" ]]; then
		DIR_TEMPORARIO="$(mktemp -d)"
		chmod 700 "${DIR_TEMPORARIO}"
	fi

	# `-maxdepth 1 -type f` não segue vínculo simbólico (o teste é sobre o PRÓPRIO
	# item), e `-print0` sobrevive a nome com espaço.
	local lista="${DIR_TEMPORARIO}/entradas-do-expurgo"
	local diagnostico="${lista}.erro"
	local codigo_da_varredura=0
	find "${DIR_DAS_COPIAS}" -maxdepth 1 -type f -print0 \
		>"${lista}" 2>"${diagnostico}" || codigo_da_varredura=$?
	if [[ "${codigo_da_varredura}" -ne 0 ]]; then
		abortar \
			"a varredura de ${DIR_DAS_COPIAS} terminou com código ${codigo_da_varredura} — o destino NÃO pôde ser lido por inteiro e NADA foi removido: $(tr '\n' ' ' <"${diagnostico}")" \
			"confira a permissão de leitura do destino, ou informe SYSLOC_RAIZ_DO_BACKUP"
	fi

	# ⚠️ O reconhecimento do acervo NÃO mora mais aqui: ele subiu para
	# `afirmar_propriedade_da_raiz`, que `main` chama antes de qualquer efeito nos
	# DOIS modos — ver a DECISÃO FECHADA ao lado dela. A cópia que existia neste
	# ponto usava `[[ -f ]]`, que SEGUE vínculo simbólico e aceitava um vínculo
	# como prova de propriedade; a entrada única recusa.
	#
	# A ordem que o parágrafo do cabeçalho desta função declara continua valendo,
	# e é por isso que a subida não a inverte: o destino ILEGÍVEL examinado acima
	# é o DIRETÓRIO DAS CÓPIAS, e ele segue sendo acusado pela varredura, nunca
	# como "acervo alheio".
	#
	# ⚠️ E a raiz NÃO é presumida legível — esta linha já afirmou isso e a
	# afirmação era falsa: uma árvore com subdiretório sem permissão faz a
	# varredura de `afirmar_propriedade_da_raiz` terminar em erro, e ali ela
	# RECUSA com o texto dela ("não consegui varrer …"), que também não culpa o
	# operador por acervo alheio. Não saber é o mesmo que não poder afirmar. A
	# rede é o `CT-1100 (f)`, linha `R4`, de
	# `deploy/scripts/backup/verificar-backup.sh`.

	local agora limite
	agora="$(date +%s)"
	limite=$((agora - PRAZO_EFETIVO * SEGUNDOS_POR_DIA))

	local -a vencidas=()
	local mantidas=0
	local caminho marca

	while IFS= read -r -d '' caminho; do
		marca="$(stat -c '%Y' "${caminho}" 2>/dev/null || true)"
		if [[ ! "${marca}" =~ ^[0-9]+$ ]]; then
			# A entrada sumiu entre a listagem e o exame. Não é anomalia: ela já não
			# está no acervo.
			continue
		fi
		if [[ "${marca}" -lt "${limite}" ]]; then
			vencidas+=("${caminho}")
		else
			mantidas=$((mantidas + 1))
		fi
	done <"${lista}"

	local removidas=0 nao_removidas=0
	for caminho in "${vencidas[@]+"${vencidas[@]}"}"; do
		if rm -f "${caminho}"; then
			removidas=$((removidas + 1))
		else
			nao_removidas=$((nao_removidas + 1))
			erro "não consegui remover a cópia vencida ${caminho}"
		fi
	done

	info "expurgo: removidas=${removidas} mantidas=${mantidas} nao_removidas=${nao_removidas} (prazo de guarda: ${PRAZO_EFETIVO} dia(s))"

	# Sair 0 aqui diria ao relógio do sistema que o expurgo terminou, e ele não
	# terminou. Cada caminho que resistiu já foi nomeado acima, um a um.
	if [[ "${nao_removidas}" -gt 0 ]]; then
		abortar \
			"${nao_removidas} cópia(s) vencida(s) resistiram à remoção — o expurgo NÃO terminou (o que já foi publicado nesta execução permanece)" \
			"confira a permissão de escrita de ${DIR_DAS_COPIAS} e o dono das cópias"
	fi
}

main() {
	case " ${MODOS_ACEITOS} " in
	*" ${MODO} "*) ;;
	*) abortar "modo desconhecido: [${MODO}]" "use um destes: ${MODOS_ACEITOS}" ;;
	esac

	# O prazo é conferido nos DOIS modos, e antes de qualquer efeito: o expurgo
	# roda no fim dos dois, e recusar tarde deixaria a cópia feita e o destino em
	# estado que a mensagem de erro não descreve.
	conferir_prazo

	# As duas guardas de destino, nesta ordem e nos DOIS modos: o vínculo é
	# recusado antes de a canonização o dissolver — ver o cabeçalho.
	recusar_vinculo_no_destino
	canonizar_destino

	# A ENTRADA ÚNICA da propriedade, uma vez, para os dois modos e antes de todo
	# efeito. Ver a DECISÃO FECHADA ao lado dela.
	afirmar_propriedade_da_raiz

	if [[ "${MODO}" == "copiar" ]]; then
		preparar_destino
		copiar
	fi

	expurgar
}

main
