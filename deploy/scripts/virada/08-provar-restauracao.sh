#!/usr/bin/env bash
#
# 08-provar-restauracao.sh — a restauração funciona contra o esquema REAL?
#
# ---------------------------------------------------------------------------
# POR QUE ESTA PROVA FALTAVA
# ---------------------------------------------------------------------------
#
# O `CT-1107` de `verificar-backup.sh` prova a restauração contra uma instância
# efêmera criada com `initdb -U verificacao` — onde o papel do teste é
# SUPERUSUÁRIO — e sobre tabelas `CREATE TABLE alfa(i int)`, sem RLS, sem os
# schemas `identidade`/`negocio` e sem política alguma.
#
# Ele prova a MECÂNICA (o arquivo é legível, o conteúdo reproduz). Não prova — e
# não poderia — que o restaurador funciona contra o esquema real do produto, em
# que `negocio.*` tem `FORCE ROW LEVEL SECURITY` e o papel do `DATABASE_URL`
# nasce `NOBYPASSRLS`. É a mesma lacuna que deixou o BACKUP falhar doze dias
# seguidos com a suíte verde.
#
# ⚠️ ESTA BATERIA NÃO TOCA A BASE DE PRODUÇÃO. Ela cria uma base descartável,
# restaura nela e a remove. Três guardas impedem o acidente, e a terceira é a
# que importa: o nome do destino é GERADO aqui, e a remoção só acontece sobre um
# nome que case o padrão descartável.
#
# Uso:  sudo bash /opt/sysloc-backend/deploy/scripts/virada/08-provar-restauracao.sh
set -uo pipefail

ARQ_AMBIENTE="/etc/sysloc/backend.env"
RESTAURADOR="/opt/sysloc-backend/deploy/scripts/backup/restaurar-base.sh"
PRODUTOR="/opt/sysloc-backend/deploy/scripts/backup/copiar-base.sh"
SUPERUSUARIO="postgres"
# O prefixo é fixo e improvável de colidir: ele é o que autoriza a remoção.
readonly PREFIXO_DESCARTAVEL="sysloc_prova_de_restauracao_"

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."
[ -r "${RESTAURADOR}" ] || falha "Restaurador ausente: ${RESTAURADOR}"

comoSuper() { runuser -u "${SUPERUSUARIO}" -- psql -X -A -t -q -d "$1" -c "$2" 2>&1; }

BANCO_DE_ORIGEM="$(sed -nE 's#^DATABASE_URL=.*/([^/?]+)(\?.*)?$#\1#p' "${ARQ_AMBIENTE}" | head -n1)"
[ -n "${BANCO_DE_ORIGEM}" ] || falha "Não consegui derivar o banco de DATABASE_URL."

DESTINO="${PREFIXO_DESCARTAVEL}$(date +%Y%m%d%H%M%S)"

# GUARDA 1 — o destino jamais pode ser a origem. Ele é gerado, não recebido;
# esta conferência existe para o caso de alguém passar a recebê-lo um dia.
[ "${DESTINO}" != "${BANCO_DE_ORIGEM}" ] || falha "O destino coincide com a base de produção. Abortado."
# GUARDA 2 — e tem de casar o padrão descartável, que é o que autoriza o DROP.
case "${DESTINO}" in
	"${PREFIXO_DESCARTAVEL}"*) ;;
	*) falha "O destino '${DESTINO}' não casa o padrão descartável. Abortado." ;;
esac
ok "Origem: ${BANCO_DE_ORIGEM} · destino descartável: ${DESTINO}"

# GUARDA 3 — a limpeza só age sobre um nome que casa o padrão, e roda em toda
# saída, inclusive interrupção: uma base descartável esquecida no agrupamento é
# lixo que ninguém sabe de onde veio.
limpar() {
	case "${DESTINO}" in
		"${PREFIXO_DESCARTAVEL}"*)
			comoSuper postgres "DROP DATABASE IF EXISTS \"${DESTINO}\";" >/dev/null 2>&1 || true
			;;
	esac
}
trap limpar EXIT INT TERM HUP

info "Passo 1: a cópia mais recente do acervo"
RAIZ="$(sed -nE 's/^readonly RAIZ_DO_BACKUP_PADRAO="?([^"]*)"?$/\1/p' "${PRODUTOR}" | head -n1)"
SUB="$(sed -nE 's/^readonly SUBDIRETORIO_DAS_COPIAS="?([^"]*)"?$/\1/p' "${PRODUTOR}" | head -n1)"
[ -n "${RAIZ}" ] && [ -n "${SUB}" ] || falha "Não consegui extrair o destino das cópias de ${PRODUTOR}."
COPIA="$(find "${RAIZ}/${SUB}" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null \
	| sort -rn | head -n1 | cut -d' ' -f2-)"
[ -n "${COPIA}" ] || falha "Nenhuma cópia em ${RAIZ}/${SUB}. Rode antes o 05."
ok "Cópia escolhida: ${COPIA}"

info "Passo 2: criar a base descartável, VAZIA"
CRIACAO="$(comoSuper postgres "CREATE DATABASE \"${DESTINO}\";")"
[ -z "${CRIACAO}" ] || falha "Não consegui criar a base descartável: ${CRIACAO}"
RELACOES_ANTES="$(comoSuper "${DESTINO}" \
	"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
	  WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema');")"
# ⚠️ ANTIVÁCUO do destino: sem esta asserção, uma base que já tivesse o conteúdo
# faria a comparação final passar sem que a restauração tivesse feito nada.
[ "${RELACOES_ANTES}" = "0" ] || falha "A base descartável nasceu com ${RELACOES_ANTES} relação(ões). Abortado."
ok "Destino criado e medido em ZERO relações — a comparação final não pode passar por acaso."

info "Passo 3: restaurar pelo RESTAURADOR REAL, contra o esquema do produto"
SAIDA_DA_RESTAURACAO=""
CODIGO=0
# A forma é a do cabeçalho do restaurador: a base de destino vem por variável de
# ambiente (informá-la é ato deliberado, e por isso não tem padrão), o arquivo é
# argumento posicional, e o modo padrão EXIGE o token literal na entrada padrão.
#
# ⚠️ O token é lido do PRÓPRIO restaurador, e não redigitado: se ele mudar lá,
# esta bateria acompanha em vez de passar a falhar por um motivo que não é o dela.
TOKEN="$(sed -nE 's/^readonly TOKEN_DE_CONFIRMACAO="?([^"]*)"?$/\1/p' "${RESTAURADOR}" | head -n1)"
[ -n "${TOKEN}" ] || falha "Não consegui extrair TOKEN_DE_CONFIRMACAO de ${RESTAURADOR}."

SAIDA_DA_RESTAURACAO="$(printf '%s\n' "${TOKEN}" \
	| SYSLOC_BANCO_DE_DESTINO="${DESTINO}" bash "${RESTAURADOR}" "${COPIA}" 2>&1)" || CODIGO=$?
printf '%s\n' "${SAIDA_DA_RESTAURACAO}" | sed 's/^/       /' \
	| sed -E 's#(://[^:@]*:)[^@]*@#\1***#g'

if [ "${CODIGO}" -ne 0 ]; then
	aviso "O restaurador terminou com código ${CODIGO}."
	aviso "⚠️ Se a recusa cita permissão, papel ou política, é o MESMO defeito do backup:"
	aviso "   o papel do DATABASE_URL não pode escrever sob FORCE ROW LEVEL SECURITY."
	aviso "⚠️ Se cita a forma dos argumentos, é só a chamada acima — confira o --help dele."
	falha "A restauração NÃO reproduziu a origem. Nada de produção foi tocado."
fi

info "Passo 4: o destino REPRODUZ a origem?"
FALHAS=0
for tabela in "identidade.empresa" "negocio.imovel" "negocio.contrato"; do
	na_origem="$(comoSuper "${BANCO_DE_ORIGEM}" "SELECT count(*) FROM ${tabela};")"
	no_destino="$(comoSuper "${DESTINO}" "SELECT count(*) FROM ${tabela};")"
	if [ "${na_origem}" = "${no_destino}" ]; then
		ok "${tabela}: ${no_destino} linha(s) — confere"
	else
		printf '\033[1;31m[FALHA]\033[0m %s: origem=%s destino=%s\n' "${tabela}" "${na_origem}" "${no_destino}"
		FALHAS=$((FALHAS + 1))
	fi
done

RELACOES_DEPOIS="$(comoSuper "${DESTINO}" \
	"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
	  WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema');")"
if [ "${RELACOES_DEPOIS}" -gt 0 ] 2>/dev/null; then
	ok "O destino tem ${RELACOES_DEPOIS} relação(ões) — a restauração criou estrutura."
else
	printf '\033[1;31m[FALHA]\033[0m O destino continua sem relação alguma.\n'
	FALHAS=$((FALHAS + 1))
fi

echo
[ "${FALHAS}" -eq 0 ] && ok "RESTAURAÇÃO PROVADA contra o esquema real. A base descartável será removida." \
	|| falha "A restauração terminou com ${FALHAS} divergência(s). Produção intocada."
