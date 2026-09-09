#!/usr/bin/env bash
#
# Bateria do gerador do roadmap — a rede do P4 do Protocolo Antirregressão para o defeito
# fechado em 2026-09-09: **fatia fora das oito fases era omitida do painel em silêncio.**
#
# ===========================================================================
# INVARIANTES
# ===========================================================================
#
# | Critério | CT      | Invariante |
# |----------|---------|------------|
# | CA-01    | CT-1292 | Fatia com estado de pipeline que NÃO está em `FATIAS_DA_FASE` aparece no
# |          |         | bloco `FORA-DAS-FASES`, com o progresso lido do `_run/*state.yaml`. É o
# |          |         | defeito medido: `painel-master-administradores/v1` estava concluída, com
# |          |         | 7 tasks, e nunca havia aparecido no painel. |
# | CA-01    | CT-1293 | Fatia ENUMERADA numa fase **não** aparece no bloco — e aparece no bloco da
# |          |         | fase dela. As duas pernas convivem: sem a segunda, um gerador que não
# |          |         | escrevesse nada em lugar nenhum passaria na primeira. |
# | CA-02    | CT-1294 | Diretório **sem** `_run/*state.yaml` entra como *refinamento* e **nunca**
# |          |         | como fatia executável. É a armadilha que o docblock de `FATIAS_DA_FASE`
# |          |         | nomeia: `dominio-locacao` e `integracao-bancaria-sicoob` parecem fatia e
# |          |         | são pré-refinamento de fase partida. O disco decide, o nome não. |
# | CA-03    | CT-1295 | O bloco distingue **vazio** de **ausente**: sem nenhuma fatia fora das
# |          |         | fases, ele é escrito assim mesmo, dizendo `nenhuma`. Bloco em branco é
# |          |         | indistinguível da omissão silenciosa que esta bateria existe para pegar. |
# | CA-06    | CT-1298 | Fatia DECLARADA numa trilha aparece no bloco da trilha mesmo sem existir
# |          |         | no disco (⬜ não iniciada) — descoberta por diferença não a alcança, porque
# |          |         | não há o que descobrir. E ao existir, ela **não** aparece também no bloco
# |          |         | `FORA-DAS-FASES`: as duas pernas convivem, e é a segunda que prova a
# |          |         | ausência de dupla contagem. |
# | CA-04    | CT-1296 | O painel e os oito blocos de fase saem **byte a byte** iguais com e sem o
# |          |         | bloco novo — a mudança de 2026-09-09 é aditiva, e nada regride. |
# | CA-05    | CT-1297 | O gerador é idempotente: rodar duas vezes não altera um byte. É o que
# |          |         | permite o gancho `PostToolUse` dispará-lo a cada escrita sem risco. |
#
# Rastreabilidade: `CA-01 → CT-1292, CT-1293` · `CA-02 → CT-1294` · `CA-03 → CT-1295` ·
# `CA-04 → CT-1296` · `CA-05 → CT-1297` · `CA-06 → CT-1298`
#
# ---------------------------------------------------------------------------
# Fronteira real, sem privilégio e sem rede
# ---------------------------------------------------------------------------
#
# Roda contra uma **raiz sintética descartável**: o gerador deriva `RAIZ` de `BASH_SOURCE`, de modo
# que copiá-lo para `$SANDBOX/deploy/scripts/roadmap/` o faz operar sobre um `docs/` inventado. O
# alvo é o script REAL — quem valida e quem executa são o mesmo código —, e a árvore de trabalho
# **não é tocada**. `trap` remove a sandbox em `EXIT INT TERM HUP`.
#
# Códigos de saída: `0` zero falhas · `1` reprovou o que a bateria existe para provar.

set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

readonly GERADOR_REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/atualizar-roadmap.sh"

SANDBOX=''
limpar() { [[ -n "${SANDBOX}" && -d "${SANDBOX}" ]] && rm -rf "${SANDBOX}"; }
trap limpar EXIT INT TERM HUP

# --------------------------------------------------------------------------- #
# Arranjo
# --------------------------------------------------------------------------- #

# Monta uma raiz sintética com o gerador real dentro dela.
montar_raiz() {
	SANDBOX="$(mktemp -d)"
	mkdir -p "${SANDBOX}/deploy/scripts/roadmap" "${SANDBOX}/docs/plano-backend-novo"
	cp "${GERADOR_REAL}" "${SANDBOX}/deploy/scripts/roadmap/atualizar-roadmap.sh"

	{
		printf 'prosa antes do painel\n\n'
		printf '<!-- PAINEL:INICIO -->\n<!-- PAINEL:FIM -->\n\n'
		printf '<!-- RODAPE:INICIO -->\n<!-- RODAPE:FIM -->\n\n'
		local fase
		for fase in F0 F1 F2 F3 F4 F5 F6 F7; do
			printf 'prosa da %s\n\n<!-- ESTADO:%s:INICIO -->\n<!-- ESTADO:%s:FIM -->\n\n' \
				"${fase}" "${fase}" "${fase}"
		done
		printf 'prosa da trilha\n\n<!-- ESTADO:PIX:INICIO -->\n<!-- ESTADO:PIX:FIM -->\n\n'
		printf 'prosa antes do bloco\n\n'
		printf '<!-- FORA-DAS-FASES:INICIO -->\n<!-- FORA-DAS-FASES:FIM -->\n\n'
		printf 'prosa depois\n'
	} >"${SANDBOX}/docs/plano-backend-novo/roadmap.md"
}

# Semeia uma fatia. `$2` vazio ⇒ diretório SEM `_run/`, isto é, material de refinamento.
semear_fatia() {
	local fatia="$1" status="${2:-}" concluidas="${3:-0}" total="${4:-0}"
	local caminho="${SANDBOX}/docs/specs/features/${fatia}"
	mkdir -p "${caminho}"
	printf '# pré-refinamento sintético\n' >"${caminho}/pre-refinement.md"

	[[ -z "${status}" ]] && return 0

	mkdir -p "${caminho}/_run"
	{
		printf 'feature: %s\n' "${fatia%%/*}"
		printf '  execution:\n'
		printf '    status: %s\n' "${status}"
		printf '    tasks_total: %s\n' "${total}"
		printf '    tasks_completed: %s\n' "${concluidas}"
		printf '  outro:\n'
	} >"${caminho}/_run/sdd_state.yaml"
}

gerar() { bash "${SANDBOX}/deploy/scripts/roadmap/atualizar-roadmap.sh" >/dev/null 2>&1; }

bloco() {
	sed -n '/FORA-DAS-FASES:INICIO/,/FORA-DAS-FASES:FIM/p' \
		"${SANDBOX}/docs/plano-backend-novo/roadmap.md"
}

# --------------------------------------------------------------------------- #
# CT-1292 — a fatia executável fora das fases APARECE, com o progresso certo
# --------------------------------------------------------------------------- #
caso 'CT-1292' 'fatia executável fora das oito fases aparece no painel'
montar_raiz
semear_fatia 'fundacao-stack-nativa/v1' 'completed' 4 4
semear_fatia 'fatia-pos-marco/v1' 'in_progress' 3 7
gerar

afirmar_igual 'a fatia fora das fases é nomeada' '1' \
	"$(bloco | grep -c 'fatia-pos-marco/v1')"
afirmar_igual 'o progresso dela vem do _run/, não de um literal' '1' \
	"$(bloco | grep -c '3/7 tasks')"
afirmar_igual 'ela é classificada como pendente, não como concluída' '1' \
	"$(bloco | grep -c 'Em andamento ou pendentes')"
afirmar_diferente 'ela NÃO cai na lista de concluídas' '1' \
	"$(bloco | grep 'concluídas' | grep -c 'fatia-pos-marco' || true)"
fechar_caso 'CT-1292'

# --------------------------------------------------------------------------- #
# CT-1293 — a fatia enumerada não aparece aqui, e aparece na fase dela
# --------------------------------------------------------------------------- #
caso 'CT-1293' 'fatia enumerada numa fase não é contada duas vezes'
afirmar_igual 'a fatia da F0 NÃO aparece no bloco fora-das-fases' '0' \
	"$(bloco | grep -c 'fundacao-stack-nativa' || true)"
# Controle positivo: sem esta perna, um gerador que não escrevesse NADA passaria na de cima.
afirmar_igual 'e ela aparece no bloco da F0' '1' \
	"$(sed -n '/ESTADO:F0:INICIO/,/ESTADO:F0:FIM/p' \
		"${SANDBOX}/docs/plano-backend-novo/roadmap.md" | grep -c 'fundacao-stack-nativa/v1')"
fechar_caso 'CT-1293'

# --------------------------------------------------------------------------- #
# CT-1294 — diretório sem `_run/` é refinamento, NUNCA fatia executável
# --------------------------------------------------------------------------- #
caso 'CT-1294' 'diretório sem estado de pipeline não é reportado como fatia'
montar_raiz
semear_fatia 'so-refinamento/v1' ''
gerar

afirmar_igual 'ele é nomeado como refinamento' '1' \
	"$(bloco | grep -c 'refinamento, sem execução')"
afirmar_igual 'e é ele que está lá' '1' \
	"$(bloco | grep -c 'so-refinamento/v1')"
afirmar_igual 'zero fatias com execução registrada' '1' \
	"$(bloco | grep -c '^> \*\*0 fatias com execução registrada')"
afirmar_igual 'ele NÃO entra em "em andamento ou pendentes"' '1' \
	"$(bloco | grep -c '\*\*Em andamento ou pendentes\*\* — nenhuma')"
fechar_caso 'CT-1294'

# --------------------------------------------------------------------------- #
# CT-1295 — o bloco distingue VAZIO de AUSENTE (controle antivácuo)
# --------------------------------------------------------------------------- #
caso 'CT-1295' 'sem fatia fora das fases, o bloco é escrito e diz nenhuma'
montar_raiz
semear_fatia 'fundacao-stack-nativa/v1' 'completed' 4 4
gerar

linhas_do_bloco="$(bloco | grep -vc 'FORA-DAS-FASES')"
afirmar_diferente 'o bloco NÃO sai em branco' '0' "${linhas_do_bloco}"
afirmar_igual 'ele declara o zero por extenso' '1' \
	"$(bloco | grep -c '0 fatias com execução registrada · 0 diretórios em refinamento')"
afirmar_igual 'e declara a ausência de pendentes' '1' \
	"$(bloco | grep -c '\*\*Em andamento ou pendentes\*\* — nenhuma')"
fechar_caso 'CT-1295'

# --------------------------------------------------------------------------- #
# CT-1296 — o painel e os oito blocos de fase não regridem
# --------------------------------------------------------------------------- #
caso 'CT-1296' 'o bloco novo é aditivo — painel e fases saem idênticos'
montar_raiz
semear_fatia 'fundacao-stack-nativa/v1' 'completed' 4 4
semear_fatia 'fatia-pos-marco/v1' 'in_progress' 3 7
gerar
antes_painel="$(sed -n '/PAINEL:INICIO/,/PAINEL:FIM/p' "${SANDBOX}/docs/plano-backend-novo/roadmap.md")"
antes_fases="$(for f in F0 F1 F2 F3 F4 F5 F6 F7; do
	sed -n "/ESTADO:${f}:INICIO/,/ESTADO:${f}:FIM/p" "${SANDBOX}/docs/plano-backend-novo/roadmap.md"
done)"

# A segunda passada acrescenta uma fatia fora das fases: se o bloco novo tivesse
# efeito colateral sobre os outros, é aqui que ele apareceria.
semear_fatia 'outra-fora/v1' 'completed' 2 2
gerar
depois_painel="$(sed -n '/PAINEL:INICIO/,/PAINEL:FIM/p' "${SANDBOX}/docs/plano-backend-novo/roadmap.md")"
depois_fases="$(for f in F0 F1 F2 F3 F4 F5 F6 F7; do
	sed -n "/ESTADO:${f}:INICIO/,/ESTADO:${f}:FIM/p" "${SANDBOX}/docs/plano-backend-novo/roadmap.md"
done)"

afirmar_igual 'o painel não muda quando nasce fatia fora das fases' "${antes_painel}" "${depois_painel}"
afirmar_igual 'os oito blocos de fase não mudam' "${antes_fases}" "${depois_fases}"
afirmar_igual 'e a fatia nova entrou no bloco dela' '1' "$(bloco | grep -c 'outra-fora/v1')"
fechar_caso 'CT-1296'

# --------------------------------------------------------------------------- #
# CT-1297 — idempotência
# --------------------------------------------------------------------------- #
caso 'CT-1297' 'rodar duas vezes não altera um byte'
primeira="$(md5sum <"${SANDBOX}/docs/plano-backend-novo/roadmap.md")"
gerar
segunda="$(md5sum <"${SANDBOX}/docs/plano-backend-novo/roadmap.md")"
afirmar_igual 'o arquivo é idêntico após a segunda passada' "${primeira}" "${segunda}"
afirmar_igual 'a prosa fora dos marcadores sobreviveu' '1' \
	"$(grep -c '^prosa depois$' "${SANDBOX}/docs/plano-backend-novo/roadmap.md")"
fechar_caso 'CT-1297'

# --------------------------------------------------------------------------- #
# CT-1298 — fatia declarada numa trilha: visível antes de existir, e sem dupla contagem
# --------------------------------------------------------------------------- #
caso 'CT-1298' 'fatia declarada numa trilha aparece antes de existir no disco'
montar_raiz
gerar
trilha() {
	sed -n '/ESTADO:PIX:INICIO/,/ESTADO:PIX:FIM/p' \
		"${SANDBOX}/docs/plano-backend-novo/roadmap.md"
}

afirmar_igual 'a fatia declarada é nomeada mesmo sem diretório' '1' \
	"$(trilha | grep -c 'boleto-hibrido-e-comprovante/v1')"
afirmar_igual 'e é reportada como não iniciada' '1' \
	"$(trilha | grep -c '⬜ \*\*não iniciada\*\*')"

# A segunda perna é o discriminador: sem ela, um gerador que listasse a fatia nos DOIS
# blocos passaria na de cima e contaria o mesmo trabalho duas vezes.
semear_fatia 'boleto-hibrido-e-comprovante/v1' 'in_progress' 2 7
gerar
# SUT_IS_CORRECT_BECAUSE: `linha_de_estado` emite a linha AGREGADA do grupo e uma linha por
# fatia — é a forma dos oito blocos de fase, e com uma fatia só as duas leem `2/7`. A agulha
# anterior contava o bloco inteiro e não distinguia as duas; ancorá-las separadamente é mais
# forte, não mais frouxo.
afirmar_igual 'a linha da fatia mostra o progresso dela' '1' \
	"$(trilha | grep 'boleto-hibrido-e-comprovante/v1' | grep -c '2/7 tasks')"
afirmar_igual 'e a linha agregada da trilha o acompanha' '1' \
	"$(trilha | grep '\*\*em andamento\*\*' | grep -c '2/7 tasks')"
afirmar_igual 'e NÃO aparece também no bloco de descoberta' '0' \
	"$(bloco | grep -c 'boleto-hibrido-e-comprovante' || true)"
fechar_caso 'CT-1298'

# =========================================================================== #
printf '\n===========================================================\n'
printf 'casos: %d executados, %d aprovados\n' "${casos_executados}" "${casos_aprovados}"
printf 'falhas: %d · degradações: %d\n' "${falhas_totais}" "${avisos_totais}"

if [[ "${falhas_totais}" -gt 0 ]]; then
	printf '\nREPROVADO\n' >&2
	exit 1
fi

printf '\nAPROVADO\n'
