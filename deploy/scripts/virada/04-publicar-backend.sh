#!/usr/bin/env bash
#
# 04-publicar-backend.sh — Virada F7, etapa 4: o que a ÁRVORE ganhou chega ao
# PROCESSO que atende.
#
# ---------------------------------------------------------------------------
# ⚠️ PUBLICAR NÃO É CONSTRUIR — e o incidente `PROD-2026-09-03-01` mediu o custo
# ---------------------------------------------------------------------------
#
# Em 2026-09-03 as 7 rotas do Painel Master responderam `404` em produção estando
# na árvore, compiladas no `dist/` e VERDES na suíte: o processo em memória subira
# em 2026-08-27 e nunca fora substituído. A suíte prova a ÁRVORE; o defeito era do
# PROCESSO. Este script existe para que a mesma classe não se repita com a coluna
# `email_contato` e com a identificação da empresa no aviso.
#
# Ele faz QUATRO coisas, nesta ordem, e a ordem importa:
#
#   1. COMPILA a árvore (`pnpm build`);
#   2. APLICA as migrações pendentes ao banco durável, pelo aplicador oficial;
#   3. REINICIA os dois processos;
#   4. CONFERE que a rota publicada responde e que a coluna nova existe.
#
# ⚠️ **A migração vem DEPOIS do build e ANTES do reinício, e não é indiferente.**
# Reiniciar antes de migrar poria no ar um código que consulta `email_contato`
# contra um banco que ainda não a tem — toda leitura de empresa falharia com
# `42703 column does not exist`, e a régua pararia de avisar. Migrar antes de
# compilar não quebra nada, mas deixa a janela maior sem necessidade.
#
# ⚠️ A migração `0028` **acrescenta coluna ANULÁVEL**, e por isso é compatível com
# o código ANTIGO: o processo que ainda não conhece a coluna simplesmente não a
# lê. É o que torna esta janela segura em vez de um corte.
#
# Uso:
#   sudo bash /opt/sysloc-backend/deploy/scripts/virada/04-publicar-backend.sh
set -uo pipefail

RAIZ="/opt/sysloc-backend"
MIGRADOR="${RAIZ}/deploy/scripts/instalacao/migrar-banco.sh"
VERIFICADOR_DE_ROTAS="${RAIZ}/deploy/scripts/publicacao/verificar-rotas-publicadas.sh"

ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[etapa]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
falha() { printf '\033[1;31m[FALHA]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "Rode com sudo."
[ -f "${MIGRADOR}" ] || falha "Aplicador de migrações ausente: ${MIGRADOR}"

# ---------------------------------------------------------------------------
# ONDE MORAM `pnpm` E `node` — e por que `bash -lc` NÃO os encontra
# ---------------------------------------------------------------------------
#
# Este produto NÃO instala Node no sistema. MEDIDO em 2026-09-08: `/usr/bin/node`
# e `/usr/local/bin/node` não existem, e o `ExecStart` das unidades systemd
# aponta para o caminho absoluto do binário do gerenciador de versões
# (`~/.local/share/mise/installs/node/<versão>/bin/node`).
#
# `sudo` não herda o PATH do usuário, e `bash -lc` TAMBÉM NÃO RESOLVE: o
# `mise activate` mora no `.bashrc`, que sessão não-interativa não lê. Foi
# exatamente assim que este script falhou na primeira execução, com
# `bash: line 1: pnpm: command not found`.
#
# Os SHIMS são a saída estável: diretório de caminho fixo, um executável por
# ferramenta, independente de ativação de shell.
#
# ⚠️ E a compilação roda como o DONO, nunca como root: compilar com privilégio
# deixaria `dist/` e `node_modules/` com dono errado, e o próximo build sem
# privilégio falharia por permissão — trocando um problema por outro, pior de
# diagnosticar.
DONO_DA_ARVORE="$(stat -c '%U' "${RAIZ}")"
HOME_DO_DONO="$(getent passwd "${DONO_DA_ARVORE}" | cut -d: -f6)"
SHIMS_DO_MISE="${HOME_DO_DONO}/.local/share/mise/shims"

[ -x "${SHIMS_DO_MISE}/pnpm" ] || falha "Não achei o pnpm em ${SHIMS_DO_MISE}.
       Este host resolve as ferramentas pelo mise do usuário ${DONO_DA_ARVORE}.
       Confira com: sudo -u ${DONO_DA_ARVORE} ls ${SHIMS_DO_MISE}"
ok "Ferramentas do mise localizadas em ${SHIMS_DO_MISE}"

info "Passo 1: compilar a árvore (como ${DONO_DA_ARVORE}, não como root)"
if runuser -u "${DONO_DA_ARVORE}" -- \
	env PATH="${SHIMS_DO_MISE}:/usr/local/bin:/usr/bin:/bin" HOME="${HOME_DO_DONO}" \
	bash -c "cd '${RAIZ}' && pnpm build" >/tmp/virada-build.log 2>&1; then
	ok "CRIADO: build concluído. (diário em /tmp/virada-build.log)"
else
	tail -20 /tmp/virada-build.log >&2
	falha "O build falhou. NADA foi migrado e nenhum processo foi reiniciado."
fi

info "Passo 2: aplicar migrações pendentes ao banco durável"
# Idempotente: o registro do que já foi aplicado mora NO BANCO, e cada arquivo é
# conferido por `sha256sum` — divergência ABORTA em vez de aplicar por cima.
if bash "${MIGRADOR}"; then
	ok "CRIADO: migrações em dia."
else
	falha "A migração falhou. Os processos NÃO foram reiniciados — o código antigo segue no ar,
       e ele é compatível com o banco atual porque a 0028 só acrescenta coluna anulável."
fi

info "Passo 3: reiniciar os processos"
for servico in sysloc-api sysloc-worker; do
	systemctl restart "${servico}" || falha "${servico} não reiniciou. Veja: journalctl -u ${servico} -n 40"
done

# Espera por CONDIÇÃO OBSERVADA — nunca por `sleep` de valor suposto. O incidente
# de 2026-09-03 registrou 6,3 s até a aplicação atender, contra um `sleep 5` que
# produziu três `502` lidos como "o reinício não pegou".
i=0
while [ "${i}" -lt 120 ]; do
	[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3000/v1/sessao)" = "401" ] && break
	i=$((i + 1)); sleep 0.5
done
[ "${i}" -lt 120 ] || falha "A API reiniciou mas não atendeu em 60s."
ok "sysloc-api atendendo (após $((i / 2))s)."
[ "$(systemctl is-active sysloc-worker)" = "active" ] && ok "sysloc-worker ativo." \
	|| falha "sysloc-worker não ficou ativo."

info "Passo 4: conferir que o PROCESSO tem o que a árvore tem"
FALHAS=0

# A coluna nova, lida do CATÁLOGO do banco — e não da suposição de que a migração
# rodou porque o script saiu 0.
# O nome do banco é DERIVADO do `EnvironmentFile`, e não literal: supô-lo faria a
# conferência consultar um banco que talvez não seja o que a aplicação atende — e
# um `count(*)` de 0 ali seria lido como "a migração não pegou", que é o
# diagnóstico errado com aparência de medição.
BANCO="$(sed -nE 's#^DATABASE_URL=.*/([^/?]+)(\?.*)?$#\1#p' /etc/sysloc/backend.env | head -n1)"
[ -n "${BANCO}" ] || falha "Não consegui derivar o nome do banco de DATABASE_URL."
ok "Banco alvo da conferência: ${BANCO}"

COLUNA="$(runuser -u postgres -- psql -X -A -t -d "${BANCO}" \
	-c "SELECT count(*) FROM information_schema.columns
	     WHERE table_schema='identidade' AND table_name='empresa' AND column_name='email_contato'" 2>/dev/null || echo erro)"
if [ "${COLUNA}" = "1" ]; then
	ok "A coluna identidade.empresa.email_contato existe no banco durável."
else
	printf '\033[1;31m[FALHA]\033[0m A coluna email_contato NÃO foi encontrada (obtido: %s).\n' "${COLUNA}"
	FALHAS=$((FALHAS + 1))
fi

# ⚠️ O DISCRIMINADOR do incidente: o documento que o PROCESSO serve, e não o que o
# fonte diz. Se o campo novo não estiver aqui, o `dist/` no disco está à frente do
# processo em memória — que é exatamente o defeito de 2026-09-03.
if curl -s --max-time 15 http://127.0.0.1:3000/docs/json | grep -q 'emailContato'; then
	ok 'O documento SERVIDO pelo processo já declara emailContato.'
else
	printf '\033[1;31m[FALHA]\033[0m O processo em memória NÃO declara emailContato — ele está atrás do dist/.\n'
	FALHAS=$((FALHAS + 1))
fi

if [ -x "${VERIFICADOR_DE_ROTAS}" ]; then
	if bash "${VERIFICADOR_DE_ROTAS}"; then
		ok "A bateria de rotas publicadas saiu verde."
	else
		printf '\033[1;31m[FALHA]\033[0m verificar-rotas-publicadas.sh reprovou.\n'
		FALHAS=$((FALHAS + 1))
	fi
else
	aviso "verificar-rotas-publicadas.sh não encontrado ou não executável — conferência pulada."
fi

echo
[ "${FALHAS}" -eq 0 ] && ok "BACKEND PUBLICADO — o processo tem o que a árvore tem." \
	|| falha "A publicação terminou com ${FALHAS} problema(s)."
