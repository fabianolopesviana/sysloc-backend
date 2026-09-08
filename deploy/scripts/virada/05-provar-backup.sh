#!/usr/bin/env bash
#
# 05-provar-backup.sh — Virada F7, etapa 5: a cópia da base volta a existir, E
# comprovadamente COM DADOS.
#
# ---------------------------------------------------------------------------
# POR QUE ESTA ETAPA EXISTE
# ---------------------------------------------------------------------------
#
# MEDIDO em 2026-09-08: `sysloc-backup-da-base.service` falhava TODOS OS DIAS
# desde 2026-08-28 — doze execuções, doze falhas, nenhuma cópia — sempre com
# `pg_dump: permission denied for table migracao_aplicada`. O `pg_dump` conectava
# com o papel da APLICAÇÃO, lido do `DATABASE_URL`.
#
# ⚠️ E conceder o `SELECT` que faltava teria sido a correção ERRADA. As tabelas de
# `negocio` têm `FORCE ROW LEVEL SECURITY`, o papel da aplicação nasce
# `NOBYPASSRLS` e a rotina não fixa `app.empresa_id`: o dump teria PASSADO e
# saído sem uma linha de negócio. Arquivo com tamanho, `pg_restore --list`
# funcionando, unidade em `0` — e vazio.
#
# É por isso que esta bateria não se contenta em ver o arquivo nascer. Ela
# COMPARA, tabela a tabela, quantas linhas o banco tem e quantas o dump carrega.
# Um arquivo vazio de negócio reprova aqui, que é exatamente o que a conferência
# de integridade do próprio `copiar-base.sh` NÃO consegue ver.
#
# Uso:
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/05-provar-backup.sh
set -uo pipefail

ARQ_AMBIENTE="/etc/sysloc/backend.env"
UNIDADE="sysloc-backup-da-base.service"
PAPEL_DA_COPIA="postgres"
PRODUTOR="/opt/sysloc-backend/deploy/scripts/backup/copiar-base.sh"

# As tabelas comparadas: uma de IDENTIDADE (sem RLS) e duas de NEGÓCIO (com RLS
# forçada). ⚠️ As de negócio são as que importam — são elas que sairiam vazias
# com o papel errado, e uma bateria que só olhasse `identidade.empresa` aprovaria
# o dump defeituoso.
readonly TABELAS_CONFERIDAS=(
	"identidade.empresa"
	"negocio.imovel"
	"negocio.contrato"
	"negocio.locatario"
	"negocio.cobranca"
)

# ⚠️ As de NEGÓCIO, nomeadas à parte — e a separação NÃO é organização.
#
# São só elas que estão sob `FORCE ROW LEVEL SECURITY`, e portanto só elas
# discriminam o defeito do papel: com o papel errado, `identidade.empresa`
# sairia POVOADA (aquele schema não tem política) e as de negócio sairiam
# VAZIAS. Um antivácuo que somasse as cinco daria verde com
# `identidade.empresa` sozinha — que foi exatamente o defeito desta bateria na
# primeira execução, medido em 2026-09-08 com negócio a zero.
readonly TABELAS_SOB_RLS=(
	"negocio.imovel"
	"negocio.contrato"
	"negocio.locatario"
	"negocio.cobranca"
)

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."

BANCO="$(sed -nE 's#^DATABASE_URL=.*/([^/?]+)(\?.*)?$#\1#p' "${ARQ_AMBIENTE}" | head -n1)"
[ -n "${BANCO}" ] || falha "Não consegui derivar o nome do banco de DATABASE_URL."
ok "Banco: ${BANCO}"

# ---------------------------------------------------------------------------
# ONDE A CÓPIA É PUBLICADA — EXTRAÍDO do produtor, nunca redigitado
# ---------------------------------------------------------------------------
#
# ⚠️ A primeira versão desta bateria escreveu os dois como literais, e ERROU OS
# DOIS: procurou em `/opt/backups/sysloc` (o destino é o subdiretório `daily`) e
# por `sysloc-<data>.dump` (o prefixo é `base-`). A unidade tinha concluído com
# sucesso, a cópia existia, e a bateria reprovou dizendo que não havia arquivo —
# o pior desfecho possível para uma prova de backup, porque convida quem a lê a
# procurar defeito onde não há.
#
# Extrair de `copiar-base.sh` fecha a classe: quem define o destino é ele, e uma
# mudança lá é acompanhada aqui sozinha. É a mesma disciplina das baterias que
# extraem o roster do instalador em vez de redigitá-lo.
[ -r "${PRODUTOR}" ] || falha "Não consigo ler o produtor da cópia: ${PRODUTOR}"

extrair_constante() {
	sed -nE "s/^readonly $1=\"?([^\"]*)\"?\$/\1/p" "${PRODUTOR}" | head -n1
}

RAIZ_DO_BACKUP="$(extrair_constante RAIZ_DO_BACKUP_PADRAO)"
SUBDIRETORIO="$(extrair_constante SUBDIRETORIO_DAS_COPIAS)"
PREFIXO="$(extrair_constante PREFIXO_DA_COPIA)"
SUFIXO="$(extrair_constante SUFIXO_DA_COPIA)"

# A guarda existe para que um rename no produtor vire FALHA e não silêncio: sem
# ela, uma constante que sumisse produziria caminho vazio e a busca falharia por
# uma razão que a mensagem não explicaria.
for par in "RAIZ_DO_BACKUP_PADRAO:${RAIZ_DO_BACKUP}" "SUBDIRETORIO_DAS_COPIAS:${SUBDIRETORIO}" \
	"PREFIXO_DA_COPIA:${PREFIXO}" "SUFIXO_DA_COPIA:${SUFIXO}"; do
	[ -n "${par#*:}" ] || falha "Não consegui extrair ${par%%:*} de ${PRODUTOR}.
       O produtor foi renomeado ou a constante mudou de forma — ajuste extrair_constante."
done

DIR_DAS_COPIAS="${RAIZ_DO_BACKUP}/${SUBDIRETORIO}"
ok "Destino extraído do produtor: ${DIR_DAS_COPIAS}/${PREFIXO}<data>${SUFIXO}"

info "Passo 1: contagem no BANCO, antes da cópia"
declare -A NO_BANCO
for tabela in "${TABELAS_CONFERIDAS[@]}"; do
	valor="$(runuser -u "${PAPEL_DA_COPIA}" -- psql -X -A -t -d "${BANCO}" \
		-c "SELECT count(*) FROM ${tabela}" 2>/dev/null || echo erro)"
	[[ "${valor}" =~ ^[0-9]+$ ]] || falha "Não consegui contar ${tabela} (obtido: ${valor})."
	NO_BANCO["${tabela}"]="${valor}"
	ok "${tabela}: ${valor} linha(s) no banco"
done

# ⚠️ ANTIVÁCUO, e ele conta SÓ AS DE NEGÓCIO — ver o comentário de
# TABELAS_SOB_RLS. Contar as cinco daria verde com `identidade.empresa`
# sozinha, e a prova do defeito do papel viria por vacuidade.
LINHAS_SOB_RLS=0
for tabela in "${TABELAS_SOB_RLS[@]}"; do
	LINHAS_SOB_RLS=$((LINHAS_SOB_RLS + NO_BANCO["${tabela}"]))
done

# Código 2, e não 1: a convenção deste repositório (`.claude/rules/testing-stack.md`)
# reserva o 2 para «o que o verificador prova está íntegro, e o vermelho é do
# ambiente». A cópia pode ter sido gerada corretamente; o que não se consegue
# aqui é PROVAR que ela carrega dado sob RLS, porque não há dado sob RLS.
# Chamar isso de aprovação seria pior que reprovar.
PROVA_INCONCLUSIVA=0
if [ "${LINHAS_SOB_RLS}" -eq 0 ]; then
	PROVA_INCONCLUSIVA=1
	aviso "As ${#TABELAS_SOB_RLS[@]} tabelas de NEGÓCIO estão vazias (0 linhas somadas)."
	aviso "A cópia será gerada e conferida, mas a prova de que ela carrega dado SOB RLS"
	aviso "fica INCONCLUSIVA — é justamente o defeito do papel que ela existe para pegar."
	aviso "Esta execução sairá com código 2 (ambiente), nunca 0."
fi

info "Passo 2: disparar a cópia"
DATA="$(date +%F)"
# ⚠️ NADA é removido antes de disparar. A primeira versão apagava a cópia do dia
# "para forçar a regeração", e isso é exatamente o que não se faz numa bateria de
# backup: se a unidade reprovasse depois, o dia ficaria SEM CÓPIA por causa do
# teste. O produtor publica com `mv -f` e sobrescreve por conta própria.
systemctl reset-failed "${UNIDADE}" 2>/dev/null || true
if systemctl start "${UNIDADE}"; then
	ok "A unidade concluiu sem erro."
else
	journalctl -u "${UNIDADE}" -n 20 --no-pager >&2
	falha "A unidade REPROVOU. O diário está acima."
fi

info "Passo 3: a cópia do dia existe e não está vazia"
COPIA="${DIR_DAS_COPIAS}/${PREFIXO}${DATA}${SUFIXO}"
if [ ! -f "${COPIA}" ]; then
	aviso "Conteúdo de ${DIR_DAS_COPIAS}:"
	ls -la "${DIR_DAS_COPIAS}" 2>&1 | sed 's/^/       /' >&2
	falha "A cópia do dia não existe: ${COPIA}"
fi
TAMANHO="$(stat -c '%s' "${COPIA}")"
[ "${TAMANHO}" -gt 0 ] || falha "A cópia ${COPIA} está vazia."
ok "Cópia publicada: ${COPIA} ($(numfmt --to=iec "${TAMANHO}" 2>/dev/null || echo "${TAMANHO} B"))"

info "Passo 4: o DUMP CARREGA OS DADOS — a asserção que o defeito exigia"
FALHAS=0
for tabela in "${TABELAS_CONFERIDAS[@]}"; do
	esquema="${tabela%%.*}"
	nome="${tabela##*.}"
	# `--data-only` de UMA tabela, e a contagem é das linhas do bloco COPY: o
	# `pg_restore --list` mostraria a ENTRADA da tabela mesmo com zero linhas —
	# e é justamente esse o dump defeituoso que se quer reprovar.
	#
	# ⚠️ `-f -` É OBRIGATÓRIO, e a ausência dele custou dois diagnósticos.
	# MEDIDO em 2026-09-08: sem `-f`, o `pg_restore` desta versão RECUSA executar
	# com `error: one of -d/--dbname and -f/--file must be specified`. Ele não
	# assume a saída padrão — é preciso pedi-la pelo nome.
	#
	# ⚠️ E o código de saída é CONFERIDO, com a mensagem de erro impressa. Foi
	# essa conferência que revelou a causa acima: enquanto o erro caía em
	# `/dev/null` sob um `|| true`, a recusa virava contagem ZERO — indistinguível
	# de «o dump está vazio», que é justamente o defeito que esta bateria
	# persegue. Quatro tabelas «conferiam» por vacuidade (0 = 0) e só a quinta,
	# que tem dado, denunciava. Uma prova que confunde «não consegui medir» com
	# «medi e deu zero» é pior que nenhuma prova.
	#
	# ⚠️ Roda COMO ROOT, sem trocar de usuário: `pg_restore` que escreve em
	# arquivo/saída NÃO conecta ao banco — apenas lê a cópia —, de modo que o
	# papel do banco é irrelevante aqui, e root é quem tem leitura garantida
	# sobre a cópia.
	extraido=""
	if ! extraido="$(pg_restore --data-only --schema="${esquema}" --table="${nome}" -f - "${COPIA}" 2>&1)"; then
		printf '\033[1;31m[FALHA]\033[0m %s: o pg_restore NÃO conseguiu ler a cópia:\n%s\n' \
			"${tabela}" "$(printf '%s' "${extraido}" | head -3 | sed 's/^/         /')"
		FALHAS=$((FALHAS + 1))
		continue
	fi

	linhas="$(printf '%s\n' "${extraido}" \
		| sed -n '/^COPY /,/^\\\.$/p' | grep -cvE '^(COPY |\\\.$)' || true)"
	esperado="${NO_BANCO["${tabela}"]}"
	if [ "${linhas}" = "${esperado}" ]; then
		ok "${tabela}: ${linhas} linha(s) no dump — confere com o banco"
	else
		printf '\033[1;31m[FALHA]\033[0m %s: o dump traz %s linha(s), o banco tem %s\n' \
			"${tabela}" "${linhas}" "${esperado}"
		FALHAS=$((FALHAS + 1))
	fi
done

echo
if [ "${FALHAS}" -eq 0 ] && [ "${PROVA_INCONCLUSIVA}" -eq 1 ]; then
	aviso "CÓPIA GERADA E CONFERIDA, mas a prova do dado sob RLS é INCONCLUSIVA —"
	aviso "não há linha alguma nas ${#TABELAS_SOB_RLS[@]} tabelas de negócio. Repita esta"
	aviso "bateria depois que a operação tiver cadastro, e ela passa a discriminar."
	exit 2
fi

if [ "${FALHAS}" -eq 0 ]; then
	ok "BACKUP PROVADO — a cópia existe e carrega os dados, inclusive os de negócio sob RLS."
else
	falha "A prova terminou com ${FALHAS} divergência(s).
       ⚠️ Dump com ZERO linhas de negócio e o resto certo é o defeito do papel: confira se
       copiar-base.sh está usando '${PAPEL_DA_COPIA}' e não o papel da aplicação."
fi
