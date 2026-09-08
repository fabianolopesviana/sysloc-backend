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

# Os dois regimes, e é o par de nomes que a poda usa para não se enganar.
readonly SUBDIR_DO_ACERVO="acervo"
readonly SUBDIR_DOS_BOLETOS="boletos"

readonly CHAVE_DO_DIR_DOS_BOLETOS="DIRETORIO_DOS_BOLETOS"

# Limites de transporte. Herdados do script do legado, onde foram exercitados
# por mais de um ano contra este mesmo destino.
readonly TRANSFERENCIAS_SIMULTANEAS=2
readonly CONFERENTES_SIMULTANEOS=4
readonly LIMITE_DE_CONEXAO="60s"
readonly LIMITE_DE_TRANSPORTE="600s"
readonly REPETICOES=3
readonly REPETICOES_DE_BAIXO_NIVEL=5

ENSAIO=0
FALHAS=0

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

info "início — destino ${BASE_REMOTA}"
[ "${ENSAIO}" -eq 1 ] && nota "MODO ENSAIO: nada será escrito no destino"

# --------------------------------------------------------------------------- #
# 1. O acervo — `copy`, que nunca apaga no destino
# --------------------------------------------------------------------------- #

info "enviando o acervo: ${RAIZ_DO_BACKUP} -> ${DESTINO_DO_ACERVO}"
if executar_rclone copy "${RAIZ_DO_BACKUP}" "${DESTINO_DO_ACERVO}"; then
	ok "acervo enviado"
else
	erro "o envio do acervo terminou com código não-zero — o acervo LOCAL segue íntegro em ${RAIZ_DO_BACKUP}"
fi

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
	if executar_rclone copy "${DIR_DOS_BOLETOS}" "${DESTINO_DOS_BOLETOS}"; then
		if [ "${QUANTOS_BOLETOS}" -eq 0 ]; then
			# ⚠️ A origem vazia NÃO autoriza concluir que nada foi emitido: o
			# espelho é acumulativo, e o destino pode guardar PDFs que a origem
			# já não tem. A linha diz o que foi medido — a contagem da origem —
			# e nada além disso.
			nota "a origem não tem arquivo algum hoje; nada a enviar, e isto NÃO é falha (o que já subiu permanece no destino)"
		else
			ok "boletos espelhados"
		fi
	else
		erro "o espelho dos boletos terminou com código não-zero — os PDFs seguem em ${DIR_DOS_BOLETOS}"
	fi
fi

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
	if executar_rclone check "${RAIZ_DO_BACKUP}" "${DESTINO_DO_ACERVO}" --one-way; then
		ok "acervo conferido — todo arquivo da origem está no destino, com o mesmo conteúdo"
	else
		erro "a conferência do acervo REPROVOU: há arquivo da origem ausente ou diferente no destino"
	fi

	if [ -d "${DIR_DOS_BOLETOS}" ]; then
		if executar_rclone check "${DIR_DOS_BOLETOS}" "${DESTINO_DOS_BOLETOS}" --one-way; then
			ok "boletos conferidos"
		else
			erro "a conferência dos boletos REPROVOU: há PDF da origem ausente ou diferente no destino"
		fi
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
	if executar_rclone delete "${DESTINO_DO_ACERVO}" --min-age "${PRAZO}d" --drive-use-trash=false; then
		ok "poda concluída"
	else
		nota "a poda remota falhou — o que importava já subiu e já foi conferido; ela se repete amanhã"
	fi
	"${RCLONE_BIN}" --config "${CONFIG_DO_RCLONE}" rmdirs "${DESTINO_DO_ACERVO}" --leave-root >/dev/null 2>&1 || true
fi

# --------------------------------------------------------------------------- #
# Fecho
# --------------------------------------------------------------------------- #

if [ "${FALHAS}" -eq 0 ]; then
	info "fim — ${BASE_REMOTA} está em dia (acervo com guarda de ${PRAZO} dia(s); boletos sem poda)"
	exit 0
fi

printf '%s FIM COM %d FALHA(S) — o acervo LOCAL em %s NÃO foi tocado por esta rotina\n' \
	"${PREFIXO}" "${FALHAS}" "${RAIZ_DO_BACKUP}" >&2
exit 1
