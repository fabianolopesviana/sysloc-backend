#!/usr/bin/env bash
#
# Envio do acervo do Sysloc para fora do host — Google Drive por `rclone`.
#
# ===========================================================================
# POR QUE ESTE ARQUIVO EXISTE
# ===========================================================================
#
# Até 2026-09-08 o acervo do backend novo vivia **só neste host**, em
# ${RAIZ_DO_BACKUP_PADRAO}. Medido na mesma data: zero ocorrências de `rclone`,
# `rsync`, `scp` ou `aws s3` em toda a árvore de `deploy/`. Perdida a máquina,
# perdia-se o acervo junto — e o runbook de recuperação em máquina nova ficava
# sem insumo, o que o tornava um plano sem objeto.
#
# O legado fazia isso desde 2026-07-23, por `/opt/frappe/backup-offsite-upload.sh`,
# e este arquivo é o sucessor dele. Duas coisas dali foram preservadas porque
# estavam certas — `copy` (que NUNCA apaga no destino) seguido de
# `check --one-way` (que prova o que subiu por checksum), e a poda remota
# espelhando a retenção local. Três foram mudadas, e cada uma tem razão escrita
# no ponto: a casa da credencial, o alerta de falha, e os boletos.
#
# ===========================================================================
# A CREDENCIAL NÃO MORA COM OS SEGREDOS, E ISSO É DELIBERADO
# ===========================================================================
#
# O `rclone.conf` guarda um token OAuth com poder de ESCREVER e APAGAR no
# destino. Ele vive em ${CONFIG_PADRAO}, que está FORA de `/etc/sysloc` —
# a raiz que `preservar-segredos.sh` empacota por inteiro e que este script
# envia para a nuvem.
#
# Se ele morasse lá, o token de exclusão do acervo viajaria para dentro do
# próprio acervo: quem obtivesse a cópia na nuvem ganharia, junto com os dados,
# o poder de apagá-la. É a mesma cláusula que a **ADR-0032** já fixa para a
# chave de cifra — *"a chave vive fora do mesmo pacote em que o material cifrado
# é salvaguardado"* —, aplicada ao par (credencial do destino, destino).
#
# ⚠️ Consequência operacional, e ela é intencional: numa máquina nova o operador
# REAUTORIZA o Drive (`rclone config`), em vez de restaurar um token de meses
# atrás. O roteiro está em `deploy/scripts/recuperacao-em-maquina-nova.md`.
#
# ===========================================================================
# O ACERVO TEM RETENÇÃO; OS BOLETOS NÃO TÊM. NÃO "UNIFIQUE" OS DOIS.
# ===========================================================================
#
# O acervo (a cópia da base e o pacote de segredos) é regenerável: a cópia de
# amanhã substitui a de hoje, e guardar ${PRAZO_DE_GUARDA_EM_DIAS} dias é
# decisão registrada, espelhada de `copiar-base.sh`. A poda remota existe para
# que a nuvem não acumule para sempre o que o disco local já descarta.
#
# O PDF de boleto é outra natureza. Pela **ADR-0030** ele é *fato recebido de
# terceiro*, e a cláusula de exclusão dela o tira de "derivado": ele **não se
# recompõe** a partir do banco. Apagá-lo do destino por idade seria perda
# programada de um artefato que ninguém consegue reproduzir.
#
# Por isso são DOIS destinos com regimes diferentes, e a poda alcança
# ⚠️ **exclusivamente** `${SUBDIR_DO_ACERVO}`. Um `rclone delete` ou um
# `rclone sync` apontado para `${SUBDIR_DOS_BOLETOS}` apagaria boleto por
# idade ou por ter saído da origem — as duas coisas que este arquivo existe
# para impedir. A rede permanente é o `CT-1282`.
#
# ===========================================================================
# ADR-0005 — NENHUMA CREDENCIAL EM `argv`, E NENHUM RASTREIO DE SHELL
# ===========================================================================
#
# O segredo do Drive nunca aparece aqui: ele é LIDO pelo `rclone` de um arquivo
# 0600, cujo CAMINHO — não o conteúdo — viaja em `--config`. Caminho não é
# credencial.
#
# ⚠️ E o rastreio verboso de comandos do shell NÃO é ligado em lugar nenhum deste
# arquivo: ele ecoaria o ambiente inteiro no diário do supervisor. A diretiva que
# o liga não aparece nem em comentário, e a omissão é deliberada — a auditoria do
# `CT-1284` varre o fonte por TEXTO, sem abrir exceção para prosa, e escrevê-la
# aqui reprovaria o próprio arquivo pela prova do contrário. É a mesma disciplina
# que a bateria já usa ao montar seus mutantes em pedaços.
#
# ===========================================================================
# O ALERTA DE FALHA NÃO É DAQUI
# ===========================================================================
#
# O script do legado mandava e-mail por `frappe.sendmail`, o que hoje seria
# impossível — o Frappe está desativado. Aqui quem alerta é o supervisor:
# `sysloc-backup-da-base.service` declara
# `OnFailure=sysloc-alerta-de-rotina@%n.service`, e qualquer código não-zero
# desta rotina o dispara. Um caminho de alerta, e não dois.
#
# ⚠️ E o diagnóstico diz sempre o que a falha NÃO significa: o acervo LOCAL é
# produzido pelos dois `ExecStart` anteriores e não é tocado por este. Envio que
# falha deixa o acervo local íntegro, e a linha de fecho o afirma para que o
# operador não trate a nuvem indisponível como backup perdido.
#
# ---------------------------------------------------------------------------
# Variáveis de ambiente (todas opcionais)
# ---------------------------------------------------------------------------
#
#   SYSLOC_ARQ_AMBIENTE            Arquivo de ambiente de onde sai o diretório
#                                  dos boletos. Padrão: /etc/sysloc/backend.env
#
#   SYSLOC_RAIZ_DO_BACKUP          Raiz do acervo local a enviar.
#                                  Padrão: /opt/backups/sysloc
#
#   SYSLOC_DIR_DOS_BOLETOS         Sobrescreve o diretório dos boletos, em vez de
#                                  lê-lo do arquivo de ambiente. Existe para a
#                                  bateria; a operação NÃO a informa.
#
#   SYSLOC_CONFIG_DO_RCLONE        Configuração do `rclone`, 0600.
#                                  Padrão: /etc/sysloc-offsite/rclone.conf
#
#   SYSLOC_REMOTE_DA_NUVEM         Nome do remote dentro daquela configuração.
#                                  Padrão: offsite
#
#   SYSLOC_PREFIXO_NA_NUVEM        Pasta raiz no destino.
#                                  Padrão: sysloc-backups
#
#   SYSLOC_MARCA_DO_HOST           Namespace do host dentro do prefixo.
#                                  Padrão: o `hostname` desta máquina
#
#   SYSLOC_PRAZO_DE_GUARDA_EM_DIAS Prazo de guarda REMOTO do acervo, em dias
#                                  inteiros >= 1. Padrão: 14
#
# Uso:
#   sudo bash deploy/scripts/backup/enviar-para-a-nuvem.sh
#   sudo bash deploy/scripts/backup/enviar-para-a-nuvem.sh --ensaio
#
# Desfechos:
#   0  o acervo e os boletos estão na nuvem, e o que subiu foi CONFERIDO.
#   1  reprovou: algo que deveria ter subido não subiu, ou não confere.
#   2  pré-condição do host ausente (sem `rclone`, sem configuração, sem acervo).
#      ⚠️ O acervo LOCAL não é tocado por nenhum destes ramos.
#
# Bateria:
#   bash deploy/scripts/backup/verificar-backup.sh
# ---------------------------------------------------------------------------

set -Eeuo pipefail
umask 077

readonly PREFIXO="[enviar-para-a-nuvem]"

readonly ARQ_AMBIENTE_PADRAO="/etc/sysloc/backend.env"
readonly RAIZ_DO_BACKUP_PADRAO="/opt/backups/sysloc"
readonly CONFIG_PADRAO="/etc/sysloc-offsite/rclone.conf"
readonly REMOTE_PADRAO="offsite"
readonly PREFIXO_NA_NUVEM_PADRAO="sysloc-backups"
readonly PRAZO_DE_GUARDA_EM_DIAS=14
readonly DIR_DOS_BOLETOS_PADRAO="/var/lib/sysloc-boletos"

# Os regimes, e é o conjunto de nomes que a poda usa para não se enganar.
# ⚠️ SÓ `${SUBDIR_DO_ACERVO}` é podado. Os outros dois guardam artefato que não
# se regenera (o boleto) ou que precisa estar lá justamente no dia em que tudo
# mais falhou (o kit).
readonly SUBDIR_DO_ACERVO="acervo"
readonly SUBDIR_DOS_BOLETOS="boletos"
readonly SUBDIR_DO_KIT="kit-de-recuperacao"

# ---------------------------------------------------------------------------
# O KIT DE RECUPERAÇÃO — as instruções moram onde o insumo mora
# ---------------------------------------------------------------------------
#
# Uma cópia de segurança sem o roteiro de como restaurá-la é um arquivo binário
# de origem esquecida. O runbook e os scripts vivem no repositório do GitHub, o
# que basta enquanto se tem acesso a ele — e a chave SSH que dá esse acesso vive
# NESTA máquina, que é exatamente a que se supõe perdida.
#
# Por isso o kit sobe junto, em dois formatos deliberadamente diferentes:
#
#   (1) `${NOME_DO_PACOTE_DO_REPO}` — o repositório INTEIRO, com todo o
#       histórico, num arquivo só. Recupera-se com um `git clone <arquivo>`, sem
#       rede, sem GitHub e sem credencial nenhuma;
#   (2) os arquivos em claro sob `${SUBDIR_DO_KIT}/` — o runbook e os quatro
#       scripts de backup, legíveis em qualquer editor por quem não tem `git` à
#       mão, ou que precise LER o roteiro antes de conseguir restaurar qualquer
#       coisa. É a redundância que importa: o formato (1) é melhor, e o (2) é o
#       que funciona quando o (1) não abre.
#
# Nomes FIXOS, sem data: o `rclone copy` sobrescreve pelo mesmo nome, e o kit
# não acumula. E ele NÃO é podado — ver o bloco dos regimes acima.
readonly NOME_DO_PACOTE_DO_REPO="sysloc-backend.bundle"

readonly CHAVE_DO_DIR_DOS_BOLETOS="DIRETORIO_DOS_BOLETOS"

# Limites de transporte. Herdados do script do legado, onde foram exercitados
# por mais de um ano contra este mesmo destino.
readonly TRANSFERENCIAS_SIMULTANEAS=2
readonly CONFERENTES_SIMULTANEOS=4
readonly LIMITE_DE_CONEXAO="60s"
readonly LIMITE_DE_TRANSPORTE="600s"
readonly REPETICOES=3
readonly REPETICOES_DE_BAIXO_NIVEL=5

# ---------------------------------------------------------------------------
# "O PROVEDOR NÃO RESPONDEU" NÃO É "O CONTEÚDO DIVERGE"
# ---------------------------------------------------------------------------
#
# Medido em 2026-09-08, na primeira execução real: as três operações posteriores
# ao envio falharam com `RATE_LIMIT_EXCEEDED` na quota do projeto do `rclone`, e
# esta rotina relatou *"a conferência REPROVOU: há arquivo da origem ausente ou
# diferente no destino"*. A frase era **falsa** — o `rclone` sequer chegou a
# olhar o destino, e o acervo tinha subido segundos antes.
#
# ⚠️ É a mesma classe do incidente `PROD-2026-09-03-01`, onde `502` foi lido como
# `404`: *"a aplicação não respondeu; isto NÃO é rota ausente"*. Aqui o
# discriminador é o MOTIVO da saída não-zero, e ele decide duas coisas — se vale
# a pena tentar de novo, e o que se pode afirmar ao operador.
#
# O padrão enumera as recusas de TRANSPORTE e de LIMITE, e nenhuma delas fala do
# conteúdo. ⚠️ `Error 403` **não** entra: o Drive o usa tanto para limite de taxa
# quanto para permissão insuficiente, e casá-lo faria uma credencial sem
# permissão ser retentada para sempre em vez de acusada. O que entra são os
# motivos NOMEADOS pelo provedor.
readonly PADRAO_DE_FALHA_TRANSITORIA='rateLimitExceeded|userRateLimitExceeded|RATE_LIMIT_EXCEEDED|Quota exceeded|quotaExceeded|backendError|internalError|Error 429|Error 50[0-9]|i/o timeout|connection reset|connection refused|no such host|TLS handshake|context deadline exceeded|unexpected EOF'

# Quantas vezes uma operação é tentada quando o motivo é transitório, e a espera
# inicial entre elas — que DOBRA a cada tentativa.
#
# 3 tentativas com espera de 20s e 40s dão ~60s por operação no pior caso. São 6
# operações, logo ~360s de folga máxima, MUITO abaixo do `TimeoutStartSec=1800`
# declarado na unidade. A quota que produziu o achado é por MINUTO, de modo que
# esperar um minuto é exatamente o que a torna irrelevante.
readonly TENTATIVAS_POR_OPERACAO=3
readonly ESPERA_INICIAL_ENTRE_TENTATIVAS_S=20

ENSAIO=0
FALHAS=0
AREA_DO_KIT=""

# A raiz do repositório, derivada da posição DESTE arquivo — nunca de um literal,
# que divergiria no dia em que a árvore mudasse de lugar.
RAIZ_DO_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_DO_REPO

# O `git` recusa operar em árvore de outro dono desde a CVE-2022-24765, e esta
# rotina roda como root sobre um repositório do usuário `sysloc`. A exceção é
# NOMINAL e vale só para esta invocação: ela não toca a configuração global.
readonly GIT_DESTA_ARVORE=(git -c "safe.directory=${RAIZ_DO_REPO}" -C "${RAIZ_DO_REPO}")

# Os arquivos em claro do kit — o roteiro e o que ele manda executar.
readonly ARQUIVOS_DO_KIT=(
	"deploy/scripts/recuperacao-em-maquina-nova.md"
	"deploy/scripts/virada.md"
	"deploy/scripts/backup/copiar-base.sh"
	"deploy/scripts/backup/preservar-segredos.sh"
	"deploy/scripts/backup/restaurar-base.sh"
	"deploy/scripts/backup/enviar-para-a-nuvem.sh"
)

# A área de preparo do kit é temporária e some SEMPRE — inclusive quando a
# rotina aborta no meio, que é quando um resíduo passaria despercebido.
limpar() {
	[ -n "${AREA_DO_KIT}" ] && [ -d "${AREA_DO_KIT}" ] && rm -rf "${AREA_DO_KIT}"
	return 0
}
trap limpar EXIT INT TERM HUP

# --------------------------------------------------------------------------- #
# Diagnóstico
# --------------------------------------------------------------------------- #

info()  { printf '%s %s\n' "${PREFIXO}" "$*"; }
ok()    { printf '%s OK    %s\n' "${PREFIXO}" "$*"; }
nota()  { printf '%s ..    %s\n' "${PREFIXO}" "$*"; }

# Reprovação: o que deveria ter subido não subiu. Sai 1 no fecho.
erro() {
	printf '%s FALHA %s\n' "${PREFIXO}" "$*" >&2
	FALHAS=$((FALHAS + 1))
}

# Pré-condição do host. Sai 2 — e a distinção importa: um host sem `rclone`
# configurado não é um envio que reprovou, é um envio que não pôde acontecer, e
# tratá-los igual ensina o operador a ignorar o vermelho.
recusar() {
	printf '%s PRÉ-CONDIÇÃO %s\n' "${PREFIXO}" "$1" >&2
	[ $# -ge 2 ] && printf '%s              → %s\n' "${PREFIXO}" "$2" >&2
	printf '%s              o acervo LOCAL não foi tocado por esta rotina\n' "${PREFIXO}" >&2
	exit 2
}

# --------------------------------------------------------------------------- #
# Leitura do diretório dos boletos
#
# Ele sai do MESMO arquivo de ambiente que o processo do produto consome. Uma
# segunda declaração do caminho aqui poderia divergir daquela sem que nada
# acusasse — e o que ficaria para trás seria justamente o artefato que não se
# regenera.
# --------------------------------------------------------------------------- #
ler_dir_dos_boletos() {
	local arq="$1" linha
	[ -r "${arq}" ] || return 1
	linha="$(grep -aE "^${CHAVE_DO_DIR_DOS_BOLETOS}=" "${arq}" | tail -n1 || true)"
	[ -n "${linha}" ] || return 2
	printf '%s' "${linha#*=}"
}

# --------------------------------------------------------------------------- #
# Invocação do `rclone`
#
# Uma entrada única. Instalada em ponto só porque a alternativa — repetir a
# lista de limites em cada chamada — deixa uma delas para trás no dia em que um
# limite mudar, e a chamada esquecida é a que trava a rotina por horas.
# --------------------------------------------------------------------------- #
executar_rclone() {
	local operacao="$1"
	shift
	local -a comuns=(
		--config "${CONFIG_DO_RCLONE}"
		--transfers "${TRANSFERENCIAS_SIMULTANEAS}"
		--checkers "${CONFERENTES_SIMULTANEOS}"
		--contimeout "${LIMITE_DE_CONEXAO}"
		--timeout "${LIMITE_DE_TRANSPORTE}"
		--retries "${REPETICOES}"
		--low-level-retries "${REPETICOES_DE_BAIXO_NIVEL}"
	)
	[ "${ENSAIO}" -eq 1 ] && comuns+=(--dry-run)
	"${RCLONE_BIN}" "${operacao}" "${comuns[@]}" "$@"
}

# --------------------------------------------------------------------------- #
# O discriminador. Recebe a saída do `rclone` e responde se o motivo da recusa é
# transitório — limite de taxa, indisponibilidade do provedor, transporte.
#
# Ele é uma função própria, e não um `grep` inline, por duas razões: a bateria a
# CARREGA do próprio arquivo para exercitá-la (o `CT-1287`), de modo que quem
# valida e quem executa são o mesmo código; e a classificação acontece em quatro
# pontos, que divergiriam um a um se cada um tivesse a sua cópia.
# --------------------------------------------------------------------------- #
desfecho_transitorio() {
	printf '%s' "$1" | grep -qE "${PADRAO_DE_FALHA_TRANSITORIA}"
}

# --------------------------------------------------------------------------- #
# Uma operação do `rclone` com retentativa quando — e SOMENTE quando — o motivo
# é transitório.
#
# Ecoa a saída do alvo, e devolve:
#   0  a operação terminou bem
#   1  ela falhou por motivo REAL (o conteúdo, o caminho, a permissão)
#   2  ela falhou por motivo TRANSITÓRIO, esgotadas as tentativas
#
# ⚠️ Falha real NÃO é retentada: repetir uma operação que reprovou por
# divergência de conteúdo só atrasa o diagnóstico e multiplica a chamada ao
# provedor, que é justamente o recurso escasso aqui.
# --------------------------------------------------------------------------- #
operar_com_paciencia() {
	local rotulo="$1" operacao="$2"
	shift 2
	local tentativa=1 espera="${ESPERA_INICIAL_ENTRE_TENTATIVAS_S}" saida codigo

	while :; do
		codigo=0
		saida="$(executar_rclone "${operacao}" "$@" 2>&1)" || codigo=$?
		[ -n "${saida}" ] && printf '%s\n' "${saida}"

		[ "${codigo}" -eq 0 ] && return 0
		desfecho_transitorio "${saida}" || return 1

		if [ "${tentativa}" -ge "${TENTATIVAS_POR_OPERACAO}" ]; then
			return 2
		fi

		nota "${rotulo}: o provedor recusou por limite de taxa ou transporte (tentativa ${tentativa} de ${TENTATIVAS_POR_OPERACAO}) — nova tentativa em ${espera}s"
		sleep "${espera}"
		tentativa=$((tentativa + 1))
		espera=$((espera * 2))
	done
}

# --------------------------------------------------------------------------- #
# Entrada
# --------------------------------------------------------------------------- #

case "${1:-}" in
"") ;;
--ensaio) ENSAIO=1 ;;
*) recusar "argumento desconhecido: ${1}" "os únicos aceitos são nenhum e '--ensaio'" ;;
esac

ARQ_AMBIENTE="${SYSLOC_ARQ_AMBIENTE:-${ARQ_AMBIENTE_PADRAO}}"
RAIZ_DO_BACKUP="${SYSLOC_RAIZ_DO_BACKUP:-${RAIZ_DO_BACKUP_PADRAO}}"
CONFIG_DO_RCLONE="${SYSLOC_CONFIG_DO_RCLONE:-${CONFIG_PADRAO}}"
REMOTE="${SYSLOC_REMOTE_DA_NUVEM:-${REMOTE_PADRAO}}"
PREFIXO_NA_NUVEM="${SYSLOC_PREFIXO_NA_NUVEM:-${PREFIXO_NA_NUVEM_PADRAO}}"
MARCA_DO_HOST="${SYSLOC_MARCA_DO_HOST:-$(hostname)}"
PRAZO="${SYSLOC_PRAZO_DE_GUARDA_EM_DIAS:-${PRAZO_DE_GUARDA_EM_DIAS}}"
readonly ARQ_AMBIENTE RAIZ_DO_BACKUP CONFIG_DO_RCLONE REMOTE PREFIXO_NA_NUVEM MARCA_DO_HOST

[[ "${PRAZO}" =~ ^[1-9][0-9]*$ ]] ||
	recusar "prazo de guarda inválido: ${PRAZO}" \
		"informe SYSLOC_PRAZO_DE_GUARDA_EM_DIAS com um inteiro >= 1, ou deixe-a ausente para usar ${PRAZO_DE_GUARDA_EM_DIAS}"
readonly PRAZO

RCLONE_BIN="$(command -v rclone || true)"
readonly RCLONE_BIN
[ -n "${RCLONE_BIN}" ] ||
	recusar "o 'rclone' não está no CAMINHO deste host" \
		"instale-o (apt-get install rclone) e execute de novo"

[ -f "${CONFIG_DO_RCLONE}" ] ||
	recusar "a configuração do 'rclone' não existe em ${CONFIG_DO_RCLONE}" \
		"autorize o destino com: sudo rclone config --config ${CONFIG_DO_RCLONE}  (crie o remote com o nome '${REMOTE}')"

[ -r "${CONFIG_DO_RCLONE}" ] ||
	recusar "a configuração ${CONFIG_DO_RCLONE} não é legível por este usuário" \
		"execute com privilégio — o arquivo é 0600 por decisão"

# O remote precisa EXISTIR na configuração. Sem esta guarda, um nome errado
# viraria um caminho relativo do sistema de arquivos local, e o `rclone` copiaria
# o acervo para um diretório chamado 'offsite:sysloc-backups' AQUI — terminando
# com código 0, sem nada ter saído do host. É o modo de falha que a rotina do
# legado nunca fechou, e ele é silencioso.
if ! "${RCLONE_BIN}" --config "${CONFIG_DO_RCLONE}" listremotes | grep -qxF "${REMOTE}:"; then
	recusar "o remote '${REMOTE}' não está declarado em ${CONFIG_DO_RCLONE}" \
		"crie-o com: sudo rclone config --config ${CONFIG_DO_RCLONE}  (o nome tem de ser exatamente '${REMOTE}')"
fi

[ -d "${RAIZ_DO_BACKUP}" ] ||
	recusar "a raiz do acervo não existe em ${RAIZ_DO_BACKUP}" \
		"esta rotina ENVIA um acervo já produzido; rode antes copiar-base.sh e preservar-segredos.sh"

# O diretório dos boletos: do ambiente, salvo quando a bateria o informa.
if [ -n "${SYSLOC_DIR_DOS_BOLETOS:-}" ]; then
	DIR_DOS_BOLETOS="${SYSLOC_DIR_DOS_BOLETOS}"
	ORIGEM_DO_DIR_DOS_BOLETOS="informado pelo ambiente da execução"
else
	CODIGO_DA_LEITURA=0
	DIR_DOS_BOLETOS="$(ler_dir_dos_boletos "${ARQ_AMBIENTE}")" || CODIGO_DA_LEITURA=$?
	case "${CODIGO_DA_LEITURA}" in
	0) ORIGEM_DO_DIR_DOS_BOLETOS="lido de ${ARQ_AMBIENTE}" ;;
	1)
		recusar "não consigo ler ${ARQ_AMBIENTE}" \
			"execute com privilégio — é de lá que sai ${CHAVE_DO_DIR_DOS_BOLETOS}, e adivinhá-lo deixaria o artefato não regenerável para trás"
		;;
	*)
		recusar "${ARQ_AMBIENTE} não declara ${CHAVE_DO_DIR_DOS_BOLETOS}" \
			"declare-a no arquivo de ambiente; ela é a mesma chave que o processador do produto consome"
		;;
	esac
fi
readonly DIR_DOS_BOLETOS ORIGEM_DO_DIR_DOS_BOLETOS

readonly BASE_REMOTA="${REMOTE}:${PREFIXO_NA_NUVEM}/${MARCA_DO_HOST}"
readonly DESTINO_DO_ACERVO="${BASE_REMOTA}/${SUBDIR_DO_ACERVO}"
readonly DESTINO_DOS_BOLETOS="${BASE_REMOTA}/${SUBDIR_DOS_BOLETOS}"
readonly DESTINO_DO_KIT="${BASE_REMOTA}/${SUBDIR_DO_KIT}"

info "início — destino ${BASE_REMOTA}"
[ "${ENSAIO}" -eq 1 ] && nota "MODO ENSAIO: nada será escrito no destino"

# --------------------------------------------------------------------------- #
# 1. O acervo — `copy`, que nunca apaga no destino
# --------------------------------------------------------------------------- #

info "enviando o acervo: ${RAIZ_DO_BACKUP} -> ${DESTINO_DO_ACERVO}"
CODIGO_DA_ETAPA=0
operar_com_paciencia "acervo" copy "${RAIZ_DO_BACKUP}" "${DESTINO_DO_ACERVO}" || CODIGO_DA_ETAPA=$?
case "${CODIGO_DA_ETAPA}" in
0) ok "acervo enviado" ;;
2) erro "o envio do acervo NÃO ACONTECEU: o provedor recusou por limite de taxa ou transporte, esgotadas as ${TENTATIVAS_POR_OPERACAO} tentativas — o acervo LOCAL segue íntegro em ${RAIZ_DO_BACKUP}" ;;
*) erro "o envio do acervo falhou — o acervo LOCAL segue íntegro em ${RAIZ_DO_BACKUP}" ;;
esac

# --------------------------------------------------------------------------- #
# 2. Os boletos — `copy` também, e por uma razão MAIS forte
#
# Aqui `copy` não é só "não apaga por engano": é o regime. Boleto que saiu da
# origem — expurgado por manutenção, movido, perdido — PERMANECE no destino, que
# é precisamente o que se quer de um artefato que ninguém consegue reproduzir.
# --------------------------------------------------------------------------- #

if [ ! -d "${DIR_DOS_BOLETOS}" ]; then
	erro "o diretório dos boletos não existe: ${DIR_DOS_BOLETOS} (${ORIGEM_DO_DIR_DOS_BOLETOS})"
else
	QUANTOS_BOLETOS="$(find "${DIR_DOS_BOLETOS}" -type f | wc -l)"
	info "enviando os boletos: ${DIR_DOS_BOLETOS} -> ${DESTINO_DOS_BOLETOS} (${QUANTOS_BOLETOS} arquivo(s) na origem)"
	CODIGO_DA_ETAPA=0
	operar_com_paciencia "boletos" copy "${DIR_DOS_BOLETOS}" "${DESTINO_DOS_BOLETOS}" || CODIGO_DA_ETAPA=$?
	if [ "${CODIGO_DA_ETAPA}" -eq 0 ]; then
		if [ "${QUANTOS_BOLETOS}" -eq 0 ]; then
			# ⚠️ A origem vazia NÃO autoriza concluir que nada foi emitido: o
			# espelho é acumulativo, e o destino pode guardar PDFs que a origem
			# já não tem. A linha diz o que foi medido — a contagem da origem —
			# e nada além disso.
			nota "a origem não tem arquivo algum hoje; nada a enviar, e isto NÃO é falha (o que já subiu permanece no destino)"
		else
			ok "boletos espelhados"
		fi
	elif [ "${CODIGO_DA_ETAPA}" -eq 2 ]; then
		erro "o espelho dos boletos NÃO ACONTECEU: o provedor recusou por limite de taxa ou transporte, esgotadas as ${TENTATIVAS_POR_OPERACAO} tentativas — os PDFs seguem em ${DIR_DOS_BOLETOS}"
	else
		erro "o espelho dos boletos falhou — os PDFs seguem em ${DIR_DOS_BOLETOS}"
	fi
fi

# --------------------------------------------------------------------------- #
# 2b. O kit de recuperação — o roteiro viaja com o insumo
# --------------------------------------------------------------------------- #

montar_o_kit() {
	AREA_DO_KIT="$(mktemp -d)"
	chmod 700 "${AREA_DO_KIT}"

	# ⚠️ `--all` leva TODAS as referências, e não só a corrente: um bundle da
	# `HEAD` sozinha recuperaria a árvore e perderia o histórico, que é onde
	# moram as razões de cada decisão deste produto — e é o histórico que o P2 do
	# Protocolo Antirregressão manda ler antes de editar qualquer coisa.
	"${GIT_DESTA_ARVORE[@]}" bundle create "${AREA_DO_KIT}/${NOME_DO_PACOTE_DO_REPO}" --all >/dev/null 2>&1 ||
		return 1

	# E o bundle é CONFERIDO antes de subir. Um arquivo corrompido que o `rclone`
	# copia com sucesso satisfaria a conferência de integridade do transporte e
	# só revelaria o defeito no dia da recuperação, que é o pior dia possível.
	"${GIT_DESTA_ARVORE[@]}" bundle verify "${AREA_DO_KIT}/${NOME_DO_PACOTE_DO_REPO}" >/dev/null 2>&1 ||
		return 2

	local relativo
	for relativo in "${ARQUIVOS_DO_KIT[@]}"; do
		[ -f "${RAIZ_DO_REPO}/${relativo}" ] || return 3
		install -m 0644 "${RAIZ_DO_REPO}/${relativo}" "${AREA_DO_KIT}/$(basename "${relativo}")" || return 4
	done
	return 0
}

info "montando o kit de recuperação (repositório + roteiro em claro)"
CODIGO_DA_ETAPA=0
montar_o_kit || CODIGO_DA_ETAPA=$?
case "${CODIGO_DA_ETAPA}" in
0)
	info "enviando o kit: ${DESTINO_DO_KIT}"
	CODIGO_DA_ETAPA=0
	operar_com_paciencia "kit" copy "${AREA_DO_KIT}" "${DESTINO_DO_KIT}" || CODIGO_DA_ETAPA=$?
	case "${CODIGO_DA_ETAPA}" in
	0) ok "kit de recuperação enviado ($((${#ARQUIVOS_DO_KIT[@]} + 1)) arquivo(s))" ;;
	2) erro "o envio do kit NÃO ACONTECEU: o provedor recusou por limite de taxa ou transporte" ;;
	*) erro "o envio do kit falhou" ;;
	esac
	;;
1) erro "não consegui empacotar o repositório — sem o kit, a cópia sobe sem o roteiro de como restaurá-la" ;;
2) erro "o pacote do repositório saiu CORROMPIDO (git bundle verify reprovou) — nada foi enviado no lugar dele" ;;
3) erro "um dos arquivos do kit não existe na árvore — o roteiro está incompleto" ;;
*) erro "não consegui preparar a área do kit" ;;
esac

# --------------------------------------------------------------------------- #
# 3. A conferência — é ela que separa "o comando saiu 0" de "os bytes estão lá"
#
# `--one-way` porque o destino tem, por construção, MAIS do que a origem: o
# acervo remoto guarda o que a poda local já descartou, e o espelho de boletos
# guarda o que saiu da origem. Sem ele, cada arquivo a mais no destino seria
# reportado como divergência, e a conferência inteira viraria ruído ignorado.
# --------------------------------------------------------------------------- #

if [ "${ENSAIO}" -eq 1 ]; then
	nota "ensaio: a conferência de integridade não se aplica (nada foi escrito)"
else
	info "conferindo a integridade do que subiu"
	CODIGO_DA_ETAPA=0
	operar_com_paciencia "conferência do acervo" check "${RAIZ_DO_BACKUP}" "${DESTINO_DO_ACERVO}" --one-way ||
		CODIGO_DA_ETAPA=$?
	case "${CODIGO_DA_ETAPA}" in
	0) ok "acervo conferido — todo arquivo da origem está no destino, com o mesmo conteúdo" ;;
	2)
		# ⚠️ A REDAÇÃO É A CORREÇÃO. Dizer "REPROVOU: há arquivo ausente" aqui
		# seria afirmar sobre um destino que ninguém olhou — e foi exatamente o
		# que esta rotina fez em 2026-09-08, segundos depois de enviar o acervo
		# com sucesso. O que se pode afirmar é só o que se mediu.
		erro "NÃO FOI POSSÍVEL CONFERIR o acervo: o provedor recusou por limite de taxa ou transporte, esgotadas as ${TENTATIVAS_POR_OPERACAO} tentativas. ⚠️ Isto NÃO afirma que falta arquivo no destino — a conferência não chegou a olhar. O envio acima diz o que foi enviado"
		;;
	*) erro "a conferência do acervo REPROVOU: há arquivo da origem ausente ou diferente no destino" ;;
	esac

	if [ -n "${AREA_DO_KIT}" ] && [ -d "${AREA_DO_KIT}" ]; then
		CODIGO_DA_ETAPA=0
		operar_com_paciencia "conferência do kit" check "${AREA_DO_KIT}" "${DESTINO_DO_KIT}" --one-way ||
			CODIGO_DA_ETAPA=$?
		case "${CODIGO_DA_ETAPA}" in
		0) ok "kit conferido" ;;
		2) erro "NÃO FOI POSSÍVEL CONFERIR o kit: o provedor recusou por limite de taxa ou transporte. ⚠️ Isto NÃO afirma que falta arquivo no destino" ;;
		*) erro "a conferência do kit REPROVOU: há arquivo do kit ausente ou diferente no destino" ;;
		esac
	fi

	if [ -d "${DIR_DOS_BOLETOS}" ]; then
		CODIGO_DA_ETAPA=0
		operar_com_paciencia "conferência dos boletos" check "${DIR_DOS_BOLETOS}" "${DESTINO_DOS_BOLETOS}" --one-way ||
			CODIGO_DA_ETAPA=$?
		case "${CODIGO_DA_ETAPA}" in
		0) ok "boletos conferidos" ;;
		2) erro "NÃO FOI POSSÍVEL CONFERIR os boletos: o provedor recusou por limite de taxa ou transporte. ⚠️ Isto NÃO afirma que falta PDF no destino" ;;
		*) erro "a conferência dos boletos REPROVOU: há PDF da origem ausente ou diferente no destino" ;;
		esac
	fi
fi

# --------------------------------------------------------------------------- #
# 4. A poda remota — do ACERVO, e SÓ dele
#
# ⚠️ `${DESTINO_DO_ACERVO}` é literal nas duas chamadas abaixo, e nunca
# `${BASE_REMOTA}`. Podar a base alcançaria `${SUBDIR_DOS_BOLETOS}` e apagaria
# por idade o que a ADR-0030 declara não regenerável. O `CT-1282` afirma esta
# propriedade pelo EFEITO: um boleto envelhecido além do prazo continua no
# destino depois da poda.
#
# A poda é o único passo cuja falha NÃO reprova: chegar aqui significa que a
# cópia do dia já subiu e já foi conferida. Nuvem com um dia a mais de histórico
# é desperdício de espaço; rotina vermelha por causa disso ensina o operador a
# ignorar o vermelho que importa.
# --------------------------------------------------------------------------- #

if [ "${ENSAIO}" -eq 1 ]; then
	nota "ensaio: a poda remota não se aplica"
else
	info "podando no destino o acervo com mais de ${PRAZO} dia(s) — os boletos NÃO são podados"
	# A poda NÃO usa paciência: ela é o único passo cuja falha não reprova, e
	# gastar tentativas com o provedor já saturado atrasaria o fecho sem ganho.
	if executar_rclone delete "${DESTINO_DO_ACERVO}" --min-age "${PRAZO}d" --drive-use-trash=false; then
		ok "poda concluída"
	else
		nota "a poda remota falhou — o que importava já subiu; ela se repete amanhã"
	fi
	"${RCLONE_BIN}" --config "${CONFIG_DO_RCLONE}" rmdirs "${DESTINO_DO_ACERVO}" --leave-root >/dev/null 2>&1 || true
fi

# --------------------------------------------------------------------------- #
# Fecho
# --------------------------------------------------------------------------- #

if [ "${FALHAS}" -eq 0 ]; then
	info "fim — ${BASE_REMOTA} está em dia (acervo com guarda de ${PRAZO} dia(s); boletos e kit sem poda)"
	exit 0
fi

printf '%s FIM COM %d FALHA(S) — o acervo LOCAL em %s NÃO foi tocado por esta rotina\n' \
	"${PREFIXO}" "${FALHAS}" "${RAIZ_DO_BACKUP}" >&2
exit 1
