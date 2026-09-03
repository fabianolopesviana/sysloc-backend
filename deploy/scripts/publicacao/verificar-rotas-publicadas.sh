#!/usr/bin/env bash
#
# Sonda de PUBLICAÇÃO das rotas — o artefato em execução tem as rotas que a
# árvore tem?
#
# Nasceu do incidente `PROD-2026-09-03-01`, em 2026-09-03: as 7 rotas do ciclo
# de vida do Painel Master estavam na árvore, compiladas no `dist/` e verdes na
# suíte, e mesmo assim respondiam `404` em produção. O processo em memória havia
# subido em 2026-08-27 e nunca fora substituído — o `dist/` no disco era de
# 2026-09-02. Nada na suíte podia pegar isso: ela prova a ÁRVORE, e o defeito
# era do PROCESSO.
#
# ===========================================================================
# O DISCRIMINADOR — `401` × `404`, e por que ele é conclusivo
# ===========================================================================
#
# Todas as sondas correm SEM cookie de sessão, e é isso que separa as duas
# causas possíveis de um `404`:
#
#   · rota REGISTRADA, sem cookie  -> a guarda de contexto recusa primeiro, e
#     responde `401`. Ela precede a busca do recurso, e isso não é suposto: o
#     controle positivo abaixo pede `POST /v1/master/usuarios/{uuid}/senha-provisoria`
#     com um identificador que NÃO existe no banco, e a resposta é `401`. Se o
#     recurso fosse consultado antes da guarda, viria `404`;
#   · rota NÃO registrada -> o roteador responde antes de qualquer guarda.
#
# Nenhuma sonda atravessa a guarda, de modo que a bateria é segura contra a
# instalação de operação: ela não lê, não cria, não altera e não remove nada. O
# identificador usado é sintaticamente válido e não corresponde a registro
# algum.
#
# ===========================================================================
# O QUE ELA NÃO É
# ===========================================================================
#
# Não é suíte de contrato — o que cada rota RESPONDE é provado por
# `apps/api/test/`, contra instância efêmera (ADR-0006), e não contra a
# operação. Esta bateria responde uma pergunta só, que a suíte não pode
# responder: **o processo que atende hoje conhece estas rotas?**
#
# Uso:
#   bash deploy/scripts/publicacao/verificar-rotas-publicadas.sh
#   bash deploy/scripts/publicacao/verificar-rotas-publicadas.sh http://127.0.0.1:3000
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

readonly BASE="${1:-https://syslocadmin.systera.com.br}"

# UUID sintaticamente válido que não corresponde a registro algum — é o de
# exemplo do `handoff-frontend.md` §4.8, e o relatório do incidente o usou.
readonly UUID='3c9e6f10-8a2b-4d51-9e7c-0f1a2b3c4d5e'

readonly SEGUNDOS_DE_ESPERA=20

# Teto da espera pela prontidão: 30 tentativas a cada 2 s ≈ 60 s.
#
# É teto de DESISTÊNCIA, e não teto asserido — a bateria não afirma que a API sobe em 60 s, e
# nenhum caso reprova por tempo. Relógio de parede virando asserção é o defeito que o `CT-001` de
# `apps/api/test/saude.e2e.spec.ts` já pagou uma vez, e o docblock de lá o narra por extenso.
readonly TENTATIVAS_DE_PRONTIDAO=30
readonly INTERVALO_DE_PRONTIDAO=2

# --------------------------------------------------------------------------- #
# As rotas, declaradas em tabela.
#
# `metodo|caminho|rótulo` — a tabela é a fonte, e acrescentar rota é
# acrescentar linha. Elas são as MESMAS que
# `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` fixa no `CT-1241`, e as
# duas listas precisam concordar: aquela prova que a árvore as tem, esta prova
# que o processo as tem.
# --------------------------------------------------------------------------- #

# As 6 anteriores à fatia, mais `GET /v1/sessao`. Elas são o CONTROLE: se uma
# delas cair, a publicação regrediu — tirou do ar o que já estava no ar.
readonly ROTAS_DE_CONTROLE=(
	"GET|/v1/sessao|sessão corrente"
	"GET|/v1/master/empresas|carteira de empresas"
	"POST|/v1/master/empresas|admissão de empresa"
	"POST|/v1/master/empresas/${UUID}/admin|admissão de administrador"
	"POST|/v1/master/empresas/${UUID}/suspensao|suspensão de empresa"
	"POST|/v1/master/empresas/${UUID}/reativacao|reativação de empresa"
	"POST|/v1/master/usuarios/${UUID}/senha-provisoria|reemissão de senha"
)

# As 7 da fatia `painel-master-administradores` (R1 a R7 do relatório).
readonly ROTAS_DA_FATIA=(
	"GET|/v1/master/empresas/${UUID}/administradores?limite=25&deslocamento=0|R1 · listagem de administradores"
	"POST|/v1/master/usuarios/${UUID}/suspensao|R2 · suspensão de administrador"
	"POST|/v1/master/usuarios/${UUID}/reativacao|R3 · reativação de administrador"
	"PUT|/v1/master/usuarios/${UUID}|R4 · correção de administrador"
	"DELETE|/v1/master/usuarios/${UUID}|R5 · remoção de administrador"
	"PUT|/v1/master/empresas/${UUID}|R6 · correção de empresa"
	"DELETE|/v1/master/empresas/${UUID}|R7 · remoção de empresa"
)

# --------------------------------------------------------------------------- #

# Ecoa o status HTTP da sonda, ou `erro-de-transporte` quando o `curl` falha.
#
# A distinção importa: um host inalcançável produziria `000`, que comparado a
# `401` reprovaria com a mensagem errada — "esperado 401, obtido 000" convida a
# procurar rota ausente onde o que houve foi rede.
sondar() {
	local metodo="$1" caminho="$2" status
	status="$(curl -sS -o /dev/null -w '%{http_code}' \
		-X "${metodo}" "${BASE}${caminho}" --max-time "${SEGUNDOS_DE_ESPERA}" 2>/dev/null)" ||
		{
			printf 'erro-de-transporte\n'
			return
		}
	printf '%s\n' "${status}"
}

# A APLICAÇÃO NÃO RESPONDEU — categoria própria, e ela não é "rota ausente".
#
# ⚠️ Esta distinção nasceu de um diagnóstico errado, em 2026-09-03, e por isso está aqui e não
# diluída no ponto de uso. Logo após o reinício que publicou a fatia, as **3 primeiras** sondas
# desta bateria receberam `502` e ela as reportou como *"esperado [401], obtido [502]"*, sob um
# caso cuja nota diz *"⇒ o processo em execução é anterior ao merge"*. As duas coisas juntas
# sustentaram a leitura de que o reinício não pegara — e a leitura era falsa: o `NRestarts` do
# serviço era **0**, o `Result` era **success**, e o journal mostra a aplicação anunciando-se no ar
# **6,3 s** depois do arranque, contra o `sleep 5` do roteiro. As sondas seguintes, todas, deram
# `401`.
#
# `502` diz que a **borda** não conseguiu falar com a aplicação. Ele não é evidência sobre rota
# alguma, porque nenhum roteador chegou a ser consultado — e tratá-lo como se fosse manda procurar
# defeito no artefato quando o que houve foi janela de arranque.
sem_resposta_da_aplicacao() {
	case "$1" in
	erro-de-transporte | 000 | 502 | 503 | 504) return 0 ;;
	*) return 1 ;;
	esac
}

# Espera a borda conseguir falar com a aplicação, antes da primeira asserção.
#
# ⚠️ É espera por **condição observada**, e não por tempo suposto — o `sleep 5` do roteiro era a
# suposição, e ela errou por 1,3 s. O teto existe só para desistir; nenhum caso reprova por tempo,
# e a bateria não afirma em quanto tempo a aplicação sobe.
aguardar_prontidao() {
	local tentativa status
	for ((tentativa = 1; tentativa <= TENTATIVAS_DE_PRONTIDAO; tentativa++)); do
		# `GET /v1/sessao` é a sonda certa: rota viva, sem efeito colateral, e a resposta dela
		# sem cookie (`401`) é justamente o que o resto da bateria mede.
		status="$(sondar GET '/v1/sessao')"
		if ! sem_resposta_da_aplicacao "${status}"; then
			nota "borda conversando com a aplicação na tentativa ${tentativa} (status ${status})"
			return 0
		fi
		sleep "${INTERVALO_DE_PRONTIDAO}"
	done
	printf '\nA aplicação não respondeu em %d tentativas (último status: %s).\n' \
		"${TENTATIVAS_DE_PRONTIDAO}" "${status}" >&2
	printf 'Isto NÃO é rota ausente — é a borda sem conseguir falar com a API.\n' >&2
	printf 'Confira: systemctl status sysloc-api; journalctl -u sysloc-api -n 50\n' >&2
	return 1
}

# Afirma que a rota está REGISTRADA — isto é, que a guarda respondeu primeiro.
#
# A ausência de resposta da aplicação é reportada com mensagem PRÓPRIA, e essa é a rede que
# sobrevive mesmo que a espera acima falhe por razão futura: a bateria nunca mais acusa "rota
# ausente" sobre um status que não veio de roteador nenhum.
afirmar_registrada() {
	local metodo="$1" caminho="$2" rotulo="$3" status
	status="$(sondar "${metodo}" "${caminho}")"

	if sem_resposta_da_aplicacao "${status}"; then
		falhar "${rotulo} (${metodo}) — a aplicação não respondeu [${status}]; isto NÃO é rota ausente"
		return
	fi

	afirmar_igual "${rotulo} (${metodo})" '401' "${status}"
}

printf 'Sonda de publicação das rotas — %s\n' "${BASE}"

printf '\n[prontidão] aguardando a borda conversar com a aplicação\n'
if ! aguardar_prontidao; then
	exit 1
fi

# =========================================================================== #
caso 'CT-1251' 'a premissa do discriminador — a guarda precede a busca do recurso'
# =========================================================================== #
#
# Controle POSITIVO, e ele vem primeiro de propósito: sem ele, todo `401` abaixo
# seria compatível com "a rota existe" E com "a guarda roda antes de tudo, mas o
# recurso é consultado depois" — e a bateria não distinguiria. O identificador
# desta sonda não existe no banco; se a busca precedesse a guarda, viria `404`.
afirmar_igual 'identificador inexistente em rota viva responde 401, não 404' \
	'401' "$(sondar POST "/v1/master/usuarios/${UUID}/senha-provisoria")"
fechar_caso 'CT-1251'

# =========================================================================== #
caso 'CT-1252' 'as 7 rotas do ciclo de vida do Master estão no artefato em execução'
# =========================================================================== #
for linha in "${ROTAS_DA_FATIA[@]}"; do
	IFS='|' read -r metodo caminho rotulo <<<"${linha}"
	afirmar_registrada "${metodo}" "${caminho}" "${rotulo}"
done
# ⚠️ As notas saem SÓ quando há falha, e a condição não é cosmética. Elas saíam sempre, inclusive
# sob um caso aprovado, e num caso REPROVADO por `502` a linha "obtido [404] ⇒ processo anterior ao
# merge" foi lida como se descrevesse o que acabara de acontecer — quando o obtido não era `404`.
# Explicação que aparece ao lado do desfecho errado não é ajuda: é a fonte do diagnóstico errado.
if [[ "${falhas_caso}" -gt 0 ]]; then
	nota 'FALHA com obtido [404] ⇒ o processo em execução é anterior ao merge da fatia.'
	nota 'O conserto é publicar o artefato, nunca reimplementar a rota.'
	nota 'FALHA com obtido [502] ⇒ outra coisa: a borda não falou com a API. Ver o journal.'
fi
fechar_caso 'CT-1252'

# =========================================================================== #
caso 'CT-1253' 'nenhuma regressão — as 7 rotas que já estavam no ar continuam'
# =========================================================================== #
#
# O par com o caso acima é o que dá sentido aos dois. Sem este, uma publicação
# que trocasse um artefato por outro — acrescentando as 7 e derrubando as
# antigas — passaria por conclusão da bateria.
for linha in "${ROTAS_DE_CONTROLE[@]}"; do
	IFS='|' read -r metodo caminho rotulo <<<"${linha}"
	afirmar_registrada "${metodo}" "${caminho}" "${rotulo}"
done
fechar_caso 'CT-1253'

# =========================================================================== #
caso 'CT-1254' 'o caminho não roteado continua respondendo 404 — controle negativo'
# =========================================================================== #
#
# Antivácuo: sem ele, um servidor que respondesse `401` a QUALQUER caminho
# aprovaria os dois casos acima sem ter rota alguma. O `404` aqui é o que prova
# que o `401` de lá diz algo.
afirmar_igual 'caminho que ninguém publica' \
	'404' "$(sondar GET "/v1/master/empresas/${UUID}/rota-que-nao-existe")"
afirmar_igual 'prefixo de versão sem recurso' \
	'404' "$(sondar GET '/v1/caminho-que-ninguem-publica')"
fechar_caso 'CT-1254'

# =========================================================================== #
caso 'CT-1255' 'o 404 do roteador NÃO fala o vocabulário de negócio'
# =========================================================================== #
#
# A correção A3 do incidente, medida na borda. Antes dela, o caminho não roteado
# respondia `RECURSO_NAO_ENCONTRADO` — o mesmo código que afirma, no contrato,
# que a empresa pedida não existe. Foi por isso que um erro de IMPLANTAÇÃO
# chegou à tela do operador como "Esta empresa não existe mais".
#
# A rede da árvore é o `CT-1250` (`apps/api/test/saude.e2e.spec.ts`); esta é a
# mesma propriedade afirmada contra o processo que atende.
corpo_do_nao_roteado="$(curl -sS -X GET \
	"${BASE}/v1/caminho-que-ninguem-publica" --max-time "${SEGUNDOS_DE_ESPERA}" 2>/dev/null)"

if [[ "${corpo_do_nao_roteado}" == *'"codigo"'* ]]; then
	afirmar_diferente 'o corpo não afirma RECURSO_NAO_ENCONTRADO' \
		'RECURSO_NAO_ENCONTRADO' \
		"$(sed -n 's/.*"codigo":"\([A-Z_]*\)".*/\1/p' <<<"${corpo_do_nao_roteado}")"
	afirmar_igual 'o corpo afirma REQUISICAO_RECUSADA' \
		'REQUISICAO_RECUSADA' \
		"$(sed -n 's/.*"codigo":"\([A-Z_]*\)".*/\1/p' <<<"${corpo_do_nao_roteado}")"
else
	aviso 'o corpo do 404 não roteado não trouxe a chave `codigo` — A3 ainda não publicada, ou borda intercedeu'
fi
fechar_caso 'CT-1255'

# =========================================================================== #
printf '\n===========================================================\n'
printf 'casos: %d executados, %d aprovados\n' "${casos_executados}" "${casos_aprovados}"
printf 'falhas: %d · degradações: %d\n' "${falhas_totais}" "${avisos_totais}"

if [[ "${avisos_totais}" -gt 0 ]]; then
	printf '\ndegradações declaradas:\n'
	for degradacao in "${DEGRADACOES_OBSERVADAS[@]}"; do
		printf '  · %s\n' "${degradacao}"
	done
fi

if [[ "${falhas_totais}" -gt 0 ]]; then
	printf '\nREPROVADO\n' >&2
	exit 1
fi

printf '\nAPROVADO\n'
