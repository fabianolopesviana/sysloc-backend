#!/usr/bin/env bash
# ===========================================================================
# Cria o PRIMEIRO `SYSLOC_MASTER` — ver o cabeçalho de `criar-sysloc-master.mjs`.
#
# É IDEMPOTENTE: havendo Master, não cria outro e sai 0.
#
# ADR-0005: a cadeia de conexão e o segredo de sessão são lidos do
# `EnvironmentFile` 0600 e entregues ao processo por ENTRADA PADRÃO — nunca por
# `argv`, nunca por variável exportada. Este script NÃO ecoa nenhum dos dois.
# ===========================================================================
set -uo pipefail

readonly ARQ_AMBIENTE=/etc/sysloc/backend.env
readonly RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly PREFIXO="[criar-master]"

[ $# -eq 2 ] || { echo "uso: $0 '<nome>' '<email>'" >&2; exit 2; }
NOME="$1"; EMAIL="$2"

command -v node >/dev/null || { echo "${PREFIXO} node não está no PATH" >&2; exit 1; }

# O arquivo é 0600/root: só o `cat` precisa de privilégio, e o valor NÃO passa
# por argv nem sai daqui.
if [ -r "${ARQ_AMBIENTE}" ]; then
  AMBIENTE="$(cat "${ARQ_AMBIENTE}")"
else
  echo "${PREFIXO} lendo ${ARQ_AMBIENTE} (pede privilégio)"
  AMBIENTE="$(sudo cat "${ARQ_AMBIENTE}")" || { echo "${PREFIXO} não consegui ler ${ARQ_AMBIENTE}" >&2; exit 1; }
fi

valor_de() { printf '%s\n' "${AMBIENTE}" | sed -n "s/^$1=//p" | head -1 | sed 's/^"//; s/"$//'; }

CADEIA="$(valor_de DATABASE_URL)"
SEGREDO="$(valor_de BETTER_AUTH_SECRET)"
# `origensPublicas` é campo OBRIGATÓRIO de `criarAutenticacao` desde a T7 da fatia
# `publicacao-e-backup` — sem valor padrão, de propósito (`autenticacao.ts`, o docblock de
# `OpcoesDeAutenticacao.origensPublicas`). Ela NÃO carrega segredo, mas é lida do mesmo arquivo
# porque é lá que a instalação a declara.
ORIGENS="$(valor_de ORIGENS_PUBLICAS)"
[ -n "${CADEIA}" ] || { echo "${PREFIXO} DATABASE_URL ausente em ${ARQ_AMBIENTE}" >&2; exit 1; }
[ -n "${SEGREDO}" ] || { echo "${PREFIXO} BETTER_AUTH_SECRET ausente em ${ARQ_AMBIENTE}" >&2; exit 1; }
[ -n "${ORIGENS}" ] || { echo "${PREFIXO} ORIGENS_PUBLICAS ausente em ${ARQ_AMBIENTE}" >&2; exit 1; }

cd "${RAIZ_REPO}" || exit 1
# JSON montado com aspas escapadas pelo `json.dumps` — a cadeia e o segredo podem
# conter qualquer byte, e concatenar à mão produziria JSON inválido no melhor caso
# e injeção no pior.
# A lista sai do MESMO `json.dumps`, e a separação por vírgula é a de `apps/api/src/configuracao/
# ambiente.ts` — declarar aqui uma segunda forma de separar deixaria as duas livres para divergir.
CONFIG="$(printf '{"cadeiaDeConexao":%s,"segredoDeSessao":%s,"enderecoBase":"http://127.0.0.1:3000","prefixoDasRotas":"/v1/auth","origensPublicas":%s}' \
  "$(printf '%s' "${CADEIA}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "${SEGREDO}" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "${ORIGENS}" | python3 -c 'import json,sys; print(json.dumps([p.strip() for p in sys.stdin.read().split(",") if p.strip()]))')")"
unset AMBIENTE CADEIA SEGREDO ORIGENS

printf '%s' "${CONFIG}" | node deploy/scripts/instalacao/criar-sysloc-master.mjs "${NOME}" "${EMAIL}"
codigo=$?
unset CONFIG
exit "${codigo}"
