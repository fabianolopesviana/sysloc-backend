#!/usr/bin/env bash
#
# CT-1005 — A BORDA PUBLICA EXATAMENTE UM CAMINHO.
#
# Caso coberto: CT-1005 (CA-20), da fatia `webhook-e-carne`, em quatro frentes:
#
#   CT-1005 (a)  os três artefatos versionados desta borda não carregam hostname
#                literal, o vhost não carrega segredo nem redirecionamento, e o
#                teto de corpo da borda é o mesmo do serviço;
#   CT-1005 (b)  a instalação é IDEMPOTENTE — as funções REAIS do instalador
#                decidem e executam "escrever só quando diverge", o gabarito
#                meio substituído é recusado, a renderização recusa o que o
#                `sed` não conseguiu substituir e o que saiu implausível, os
#                valores que viram diretiva do nginx são conferidos por forma, e
#                a limpeza desfaz a escrita ainda não validada;
#   CT-1005 (c)  por MEDIÇÃO DE REDE: o caminho da notícia alcança o serviço por
#                TLS, e `/docs`, `/v1/auth/*`, `/saude`, um caminho inexistente e
#                o caminho com prefixo morrem NA BORDA, sem repasse — e nada em
#                claro devolve `3xx`;
#   CT-1005 (d)  a configuração que atende a operação não foi tocada.
#
# E a PROTEÇÃO CONTRA ABUSO desta borda (ADR-0037), acrescentada pela T10 da
# fatia `publicacao-e-backup` ao fechar o débito que o gabarito registrava desde
# 2026-08-19, em quatro frentes:
#
#   CT-1191  a RAJADA LEGÍTIMA do provedor atravessa inteira — trinta
#            requisições consecutivas do MESMO endereço, todas `204`, nenhuma
#            `503` e nenhuma `429`;
#   CT-1192  o teto de TAMANHO DE CORPO barra na própria borda, e no byte certo:
#            65 536 atravessa e é gravado, 65 537 é recusado sem repasse;
#   CT-1193  a limitação declarada é por CONCORRÊNCIA, no VALOR que este
#            verificador declara à parte, e a família `limit_req` tem contagem
#            ZERO em linha ativa do gabarito;
#   CT-1194  o teto de concorrência de fato barra o SIMULTÂNEO acima dele, e as
#            MESMAS requisições em SEQUÊNCIA atravessam inteiras.
#
# ===========================================================================
# INVARIANTES
# ===========================================================================
#
#   I1  A superfície externa do produto é UMA SÓ. Publicar um caminho para fora
#       é mudança de postura de segurança (risco R9 do tech spec), e a única
#       forma de afirmar que nada mais responde é MEDIR, não ler a configuração.
#   I2  A recusa é DA BORDA, sem repasse. Um `404` do serviço e um `404` da
#       borda são indistinguíveis pelo status — o que os separa é a trilha do
#       lado de dentro, e é ela que este verificador conta.
#   I3  Nenhum `3xx`. O provedor reprova redirecionamento, e um `301` sobre um
#       `POST` perde método e corpo pelo caminho.
#   I4  O hostname NUNCA é literal no repositório: ele é decisão operacional do
#       usuário, e continua aberta.
#   I5  O que atende a operação (`/opt/frappe`) não é tocado — nem por escrita,
#       nem por recarga do servidor.
#   I6  A proteção contra abuso desta borda NÃO conta volume no tempo. Perder
#       notícia do provedor é pior que o abuso que se quis evitar (ADR-0037), e
#       o eixo de origem dele é um endereço só — de modo que o teto de taxa que
#       barraria o abuso descartaria a rajada legítima. O que limita aqui é o
#       tamanho do corpo e a CONCORRÊNCIA por origem, e a AUSÊNCIA do teto de
#       taxa é asserção, não comentário.
#
# ===========================================================================
# ONDE ISTO EXECUTA — e por que NÃO é a borda que atende a operação
# ===========================================================================
#
# A ADR-0006 é literal: *"a suíte de verificação nunca executa contra o ambiente
# que atende a operação"*. Por isso o CT-1005 (c) mede contra uma BORDA EFÊMERA
# E ISOLADA — um nginx próprio, em prefixo descartável, portas altas próprias,
# certificado gerado no arranjo e um serviço de verificação em `127.0.0.1`. É
# medição de rede DE VERDADE, com o binário de verdade e o vhost versionado
# renderizado pelo renderizador REAL do instalador; o que não é de verdade é
# apenas *onde* ela acontece.
#
# O que o CT-1005 (d) faz com a instalação de produção é LER — comparar a
# configuração do legado antes e depois, e conferir que nenhum processo do
# servidor de borda foi recarregado. Ler não é executar contra ela.
#
# ⚠️ A instalação na borda real é o **passo 1 do rollout** (§16.4 do tech spec),
# ato do operador, com ponto de parada — e NÃO é entrega deste verificador.
#
# ===========================================================================
# PROVA DE FALSIFICAÇÃO — permanente, e só onde a asserção é ESTÁTICA
# ===========================================================================
#
# O CT-1005 (a) inspeciona o TEXTO dos artefatos versionados, e afirma uma
# AUSÊNCIA — que é exatamente o que uma varredura quebrada também devolve. Por
# isso a MESMA função roda duas vezes: sobre os artefatos reais (controle) e
# sobre uma cópia com as três agulhas PLANTADAS, onde ela precisa achar as três
# e devolver status de falha. Um verificador que nunca achasse nada passaria no
# controle e reprovaria no mutante; um que achasse tudo faria o contrário.
#
# As agulhas são COMPOSTAS EM TEMPO DE EXECUÇÃO, a partir de fragmentos que não
# casam sozinhos. Escrevê-las por extenso faria este arquivo — que é varrido
# junto com os outros dois — acusar a si mesmo, e a única saída seria enfraquecer
# a varredura.
#
# ⚠️ A varredura de SEGREDO alcança o gabarito e o instalador, e NÃO este
# arquivo: é aqui que os padrões procurados estão escritos, e um arquivo que
# contém o próprio padrão sempre se acha. O que se perde é nulo — este script
# não entra em servidor nenhum.
#
# As asserções do CT-1005 (b), (c) e (d) são COMPORTAMENTAIS (exercitam funções
# reais, medem rede real, comparam estado real) e por decisão registrada não se
# demonstram por reintrodução de defeito.
#
# ⚠️ O mesmo corte vale para as quatro frentes da proteção contra abuso: o
# CT-1193 é a ÚNICA estática do conjunto — ele lê o TEXTO do gabarito — e por
# isso é a única com prova de falsificação por execução, em TRÊS mutantes. O
# CT-1191, o CT-1192 e o CT-1194 medem rede real; a asserção que discrimina cada
# um está nomeada no comentário do caso, e reintroduzir defeito neles seria
# campanha de mutantes com outro nome (mutation testing está fora da stack deste
# projeto por decisão de 2026-08-16).
#
# ===========================================================================
# Contrato de saída
# ===========================================================================
#
#   0  zero falhas — e nenhum outro caminho produz verde.
#   1  reprovou o que este verificador existe para provar.
#
# Ferramenta ou estado ausente NUNCA faz o caso passar em silêncio: cada
# degradação sai como `aviso` nomeando o que não foi verificado, e o RESUMO
# FINAL as conta e diz que houve asserção não medida.
#
# Uso: bash deploy/scripts/borda/verificar-notificacao-bancaria.sh
#
# Ele NÃO exige privilégio, e não deve receber nenhum: tudo que mede é leitura,
# processo próprio em porta alta e diretório descartável.
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

# --------------------------------------------------------------------------- #
# Os artefatos sob prova.
# --------------------------------------------------------------------------- #
readonly GABARITO="${RAIZ_REPO}/deploy/nginx/sysloc-notificacao-bancaria.conf"
readonly INSTALADOR="${RAIZ_REPO}/deploy/scripts/borda/instalar-borda-de-notificacao.sh"
readonly ESTE_SCRIPT="${RAIZ_REPO}/deploy/scripts/borda/verificar-notificacao-bancaria.sh"

# O controlador da T6, de onde sai o caminho publicado, e a composição raiz, de
# onde sai o teto de corpo. Os dois são lidos para CONFERIR coerência: medir um
# caminho que a API não publica seria medir a borda contra uma ficção.
readonly CONTROLADOR_DA_NOTICIA="${RAIZ_REPO}/apps/api/src/notificacoes-bancarias/notificacao-bancaria.controller.ts"
readonly COMPOSICAO_RAIZ="${RAIZ_REPO}/apps/api/src/main.ts"

# O caminho publicado, escrito por extenso: é o que o provedor vai chamar, e
# derivá-lo do controlador poria o artefato sob prova nos dois lados da
# comparação. A COERÊNCIA com o controlador é asserção à parte, no caso (a).
readonly CAMINHO_DA_NOTICIA="/v1/notificacoes-bancarias"

# Os caminhos que NÃO podem atravessar. `/docs` é o contrato publicado,
# `/v1/auth/*` são as rotas de sessão (é o que mantém o D27 da F1 sem eixo),
# `/saude` fica fora do prefixo de versão, e o último não existe em lugar nenhum.
readonly CAMINHOS_RECUSADOS=(
	"/docs"
	"/v1/auth/get-session"
	"/v1/auth/sign-in/email"
	"/saude"
	"/nao-existe-nesta-api"
	"/v1/notificacoes-bancarias/extra"
	"/v1/notificacoes-bancarias/"
)

# O cabeçalho com que o serviço de verificação se identifica. É ele que separa
# "a resposta veio de dentro" de "a resposta veio da borda".
readonly CABECALHO_DO_SERVICO="x-origem-do-servico"
readonly ORIGEM_DO_SERVICO="notificacao-bancaria-de-verificacao"

# Teto de corpo declarado no gabarito, e o mesmo valor em bytes na composição
# raiz (`MAIOR_CORPO_ACEITO`). Escritos aqui de propósito: os dois lados da
# comparação precisam de uma terceira declaração, senão a asserção não pode
# falhar.
readonly TETO_DE_CORPO_NA_BORDA="64k"
readonly TETO_DE_CORPO_NO_SERVICO="64 * 1024"

# O que faz um token ser NOME DE DOMÍNIO, e não `main.ts` nem `process.argv`: o
# último rótulo é um domínio de topo. A lista é fechada de propósito — a forma
# genérica *"dois rótulos separados por ponto"* acusa toda chamada de método e
# toda extensão de arquivo, e uma varredura que grita em tudo é desligada na
# primeira semana.
#
# ⚠️ Se o hostname escolhido pelo usuário usar um domínio de topo fora desta
# lista, ACRESCENTE-O aqui: a lista é a cobertura da varredura, e o que ela não
# nomeia ela não vê.
readonly DOMINIOS_DE_TOPO="com|br|net|org|io|dev|app|cloud|info|co|me|tech|online|xyz|biz|site|store|link|host|systems|services|digital|solutions|com\\.br|net\\.br|org\\.br"

# --------------------------------------------------------------------------- #
# A PROTEÇÃO CONTRA ABUSO — ADR-0037. Constantes das quatro frentes da T10.
# --------------------------------------------------------------------------- #

# O nome da zona compartilhada do teto de concorrência. É a TERCEIRA declaração
# dele: o gabarito a declara em `limit_conn_zone` e a consome em `limit_conn`, e
# o CT-1193 confere que as duas são esta. Derivá-la do próprio gabarito poria o
# artefato sob prova nos dois lados da comparação.
readonly ZONA_DE_CONCORRENCIA="notificacao_bancaria"

# Quantas conexões simultâneas por origem o gabarito autoriza em `limit_conn`.
# É a TERCEIRA declaração do teto, pela mesma razão da zona acima e do teto de
# corpo: as asserções de distribuição do CT-1194 leem o número do vhost
# RENDERIZADO — que é o artefato sob prova —, e sem um lado independente da
# comparação QUALQUER valor as satisfaz. Um teto rebaixado para `1` renderizaria
# `total=3`, e o caso afirmaria "2 recusadas, 1 atendida" e aprovaria a borda
# que descarta a rajada legítima do provedor — o dano que a ADR-0037 existe para
# não ter, e que é PIOR que o abuso. Nem o CT-1193 (que casa `limit_conn ${ZONA}
# [0-9]+;`, com qualquer inteiro) nem o CT-1191 (rajada SEQUENCIAL, que nunca põe
# duas conexões em voo) alcançam o teto baixo demais.
#
# ⚠️ O CT-1194 continua LENDO o teto do vhost renderizado, e isso está certo: o
# que ele afirma é a distribuição do teto que a borda de fato carrega. Esta
# constante é a ÂNCORA DO VALOR, afirmada por igualdade no CT-1193 contra o
# gabarito versionado.
readonly TETO_DE_CONCORRENCIA_NA_BORDA=16

# Quantas requisições consecutivas a rajada do CT-1191 dispara. É a forma do
# provedor: muitas notícias, de um endereço só, em sequência imediata. O número
# é generoso de propósito — qualquer teto de taxa plausível (`rate=5r/s` e
# vizinhos) reprova com folga, e é isso que faz o caso discriminar.
readonly REQUISICOES_DA_RAJADA=30

# Quantas requisições simultâneas o CT-1194 dispara ALÉM do teto declarado. São
# duas, e não uma: com uma só, uma corrida qualquer que perdesse a recusa
# deixaria o caso verde por vacuidade.
readonly EXCEDENTES_ALEM_DO_TETO=2

# Sondagem da rodada simultânea — limite NOMEADO, nunca espera fixa de relógio.
# Trinta sondagens de 0,1 s dão três segundos, que é folga enorme para trinta e
# duas requisições no laço local. Ele é o MAIS CURTO dos quatro prazos que se
# encaixam nesta rodada (ver a válvula do serviço, no `servico.mjs`): se o
# serviço não segurar o teto neste prazo, o caso DEGRADA declarando, em vez de
# reprovar por relógio.
readonly LIMITE_DE_SONDAGENS_DA_CONCORRENCIA=30
readonly INTERVALO_DA_SONDAGEM="0.1"

# Os três tamanhos de corpo do CT-1192, em bytes.
#
# ⚠️ O teto NÃO é redigitado aqui: ele é a expansão aritmética de
# `TETO_DE_CORPO_NO_SERVICO`, a mesma terceira declaração cuja igualdade com o
# `MAIOR_CORPO_ACEITO` da composição raiz E com o `client_max_body_size` do
# gabarito o CT-1005 (a) já afirma. Escrever `65536` aqui criaria uma quarta
# declaração, livre para divergir das outras três — e a asserção do byte exato
# passaria a medir a si mesma.
readonly CORPO_NO_TETO=$((TETO_DE_CORPO_NO_SERVICO))
readonly CORPO_ACIMA_DO_TETO=$((TETO_DE_CORPO_NO_SERVICO + 1))
readonly CORPO_PEQUENO=64

# Configuração do legado, LIDA para afirmar que não mudou. São os arquivos de
# configuração de servidor do `/opt/frappe` legíveis sem privilégio.
readonly DIR_DO_LEGADO="/opt/frappe"

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TRABALHO="$(mktemp -d)"
readonly DIR_TRABALHO
PID_DO_SERVICO=""
PREFIXO_DA_BORDA=""
RAIZ_DO_DESAFIO_EFEMERA=""
TOKEN_DO_DESAFIO=""
CONTEUDO_DO_DESAFIO=""

# Os dois arquivos de controle da rodada simultânea do CT-1194. O serviço segura
# a resposta enquanto o primeiro existir e o segundo não — nunca por relógio.
ARQUIVO_DE_ESPERA=""
ARQUIVO_DE_LIBERACAO=""

# Solta o que o serviço estiver segurando.
#
# Chamada no fim do CT-1194 E na limpeza: uma reprovação no meio da rodada
# simultânea não pode deixar trinta e duas requisições penduradas até o teto de
# sondagens do próprio serviço. Ela é idempotente e nunca falha — a limpeza roda
# sob `trap`, e um erro aqui trocaria o código de saída da bateria.
liberar_requisicoes_seguras() {
	if [[ -n "${ARQUIVO_DE_LIBERACAO}" ]]; then
		: >"${ARQUIVO_DE_LIBERACAO}" 2>/dev/null || true
	fi
	if [[ -n "${ARQUIVO_DE_ESPERA}" ]]; then
		rm -f "${ARQUIVO_DE_ESPERA}" 2>/dev/null || true
	fi
}

encerrar_borda_efemera() {
	if [[ -n "${PREFIXO_DA_BORDA}" && -f "${PREFIXO_DA_BORDA}/nginx.pid" ]]; then
		local pid
		pid="$(cat "${PREFIXO_DA_BORDA}/nginx.pid" 2>/dev/null || true)"
		[[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
	fi
	if [[ -n "${PID_DO_SERVICO}" ]]; then
		kill "${PID_DO_SERVICO}" 2>/dev/null || true
	fi
}

limpar() {
	local codigo=$?
	liberar_requisicoes_seguras
	encerrar_borda_efemera
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# =========================================================================== #
# A varredura de formas proibidas — UMA função, usada pelo controle e pelo
# mutante.
#
# Imprime uma linha `classe:ocorrência` por achado e devolve status 1 quando
# encontra algum. O status é parte do contrato, e não detalhe: uma varredura que
# apenas imprimisse ficaria verde sobre o mutante.
#
# As três classes:
#
#   hostname          token com forma de nome de domínio (dois ou mais rótulos,
#                     último em minúsculas), fora da lista de extensões de
#                     arquivo. Vale para o arquivo INTEIRO, comentário incluso:
#                     o hostname é decisão aberta do usuário e não se escreve
#                     aqui nem em prosa.
#   segredo           material de chave privada, ou atribuição de senha/token.
#   redirecionamento  `return 3xx` ou `rewrite ... permanent|redirect` em linha
#                     ATIVA (comentário que os cita para PROIBI-LOS é conteúdo
#                     legítimo, e é justamente o que o gabarito faz).
#
# A classe procurada é parâmetro para que a mesma função sirva ao gabarito
# (as três) e a este arquivo (só hostname). Ver o cabeçalho para por que a de
# segredo não alcança este script.
# =========================================================================== #
varrer_formas_proibidas() {
	local arquivo="$1"
	shift
	local classes=("$@")
	local achou=0 classe achados

	for classe in "${classes[@]}"; do
		case "${classe}" in
		hostname)
			achados="$(grep -oiE "[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.(${DOMINIOS_DE_TOPO})([^A-Za-z0-9_-]|$)" "${arquivo}" |
				sed 's|[^A-Za-z0-9_.-]*$||' | sort -u || true)"
			;;
		segredo)
			achados="$(grep -oiE -- "-----BEGIN[[:space:]A-Z]*KEY-----|(senha|password|secret|token)[[:space:]]*=" "${arquivo}" | sort -u || true)"
			;;
		redirecionamento)
			achados="$(grep -vE '^[[:space:]]*#' "${arquivo}" |
				grep -oE 'return[[:space:]]+3[0-9]{2}|rewrite[^;]*(permanent|redirect)' | sort -u || true)"
			;;
		*)
			printf 'classe desconhecida: %s\n' "${classe}" >&2
			return 2
			;;
		esac

		if [[ -n "${achados}" ]]; then
			achou=1
			printf '%s:%s\n' "${classe}" "$(printf '%s' "${achados}" | tr '\n' ' ' | sed 's| *$||')"
		fi
	done

	[[ "${achou}" -eq 0 ]]
}

# Quantas ocorrências a varredura devolveu. `grep -c` sobre saída vazia contaria
# 1 (a linha em branco), e a contagem errada apareceria justamente no lado em
# que o esperado é zero.
contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# ⚠️ `carregar_funcao_do_instalador` e `carregar_funcao_do_instalador_como` NÃO
# moram mais aqui: as duas subiram para
# `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, que esta bateria já
# carrega por `source`.
#
# O recorte de lá pula o corpo de cada heredoc, e a diferença NÃO é cosmética
# aqui: `instalar-borda-de-notificacao.sh` tem uma `validar_vhost_isolado` que
# escreve um `nginx.conf` por heredoc cuja chave de fecho do bloco `http {`
# começa na COLUNA ZERO. O `sed -n "/^nome() {/,/^}/p"` que morava nestas linhas
# a cortaria ao meio — a armadilha estava ARMADA e não disparada, porque aquela
# função está fora do elenco que esta bateria carrega.

# Uma porta livre no laço local, obtida do próprio sistema operacional.
porta_livre() {
	node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});'
}

# =========================================================================== #
# CT-1005 (a) — os artefatos versionados não carregam hostname, segredo nem
# redirecionamento, e o teto de corpo é o mesmo dos dois lados.
# =========================================================================== #
ct_1005_a() {
	caso "CT-1005 (a)" "os artefatos versionados desta borda não fixam hostname, não guardam segredo e não redirecionam"

	local arquivo
	for arquivo in "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}"; do
		if [[ ! -r "${arquivo}" ]]; then
			falhar "artefato ilegível: ${arquivo}"
			continue
		fi
	done
	if [[ "${falhas_caso}" -ne 0 ]]; then
		fechar_caso "CT-1005 (a)"
		return
	fi

	# ÂNCORA ANTIVÁCUO: varredura sobre arquivo vazio devolve ausência, que é
	# exatamente o resultado esperado — e aprovaria por não ter olhado.
	local linhas
	linhas="$(cat "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}" | grep -c . || true)"
	if [[ "${linhas}" -lt 200 ]]; then
		falhar "os três artefatos somam ${linhas} linha(s) de conteúdo — a varredura não teria o que examinar, e o verde abaixo seria vácuo"
		fechar_caso "CT-1005 (a)"
		return
	fi
	ok "os três artefatos somam ${linhas} linha(s) — a varredura tem o que examinar"

	local codigo achados
	for arquivo in "${GABARITO}" "${INSTALADOR}" "${ESTE_SCRIPT}"; do
		codigo=0
		achados="$(varrer_formas_proibidas "${arquivo}" hostname)" || codigo=$?
		afirmar_igual "nenhum hostname literal em ${arquivo##*/}" "0" "$(contar_ocorrencias "${achados}")"
		afirmar_igual "a varredura de hostname não acusa nada em ${arquivo##*/}" "0" "${codigo}"
		[[ -n "${achados}" ]] && printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	done

	for arquivo in "${GABARITO}" "${INSTALADOR}"; do
		codigo=0
		achados="$(varrer_formas_proibidas "${arquivo}" segredo)" || codigo=$?
		afirmar_igual "nenhum segredo em ${arquivo##*/}" "0" "$(contar_ocorrencias "${achados}")"
		afirmar_igual "a varredura de segredo não acusa nada em ${arquivo##*/}" "0" "${codigo}"
		[[ -n "${achados}" ]] && printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	done

	# A varredura por forma tem um teto: ela só vê os domínios de topo que
	# nomeia. Esta asserção é o complemento EXATO dela — todo `server_name` do
	# gabarito é o marcador, e não existe um segundo `server_name` com qualquer
	# outro valor. Um hostname literal escapa da primeira; desta ele não escapa.
	afirmar_igual "todo server_name do gabarito é o marcador de substituição" "2" \
		"$(grep -cE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DA_NOTIFICACAO__;$' "${GABARITO}" || true)"
	afirmar_igual "o gabarito não declara server_name de nenhuma outra forma" "0" \
		"$(grep -E '^[[:space:]]*server_name' "${GABARITO}" |
			grep -cvE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DA_NOTIFICACAO__;$' || true)"

	codigo=0
	achados="$(varrer_formas_proibidas "${GABARITO}" redirecionamento)" || codigo=$?
	afirmar_igual "nenhum redirecionamento ativo no gabarito" "0" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a varredura de redirecionamento não acusa nada no gabarito" "0" "${codigo}"

	# ------------------------------------------------------------------- #
	# PROVA DE FALSIFICAÇÃO — a MESMA varredura, sobre uma cópia com as três
	# agulhas plantadas, precisa achar as três e devolver status de falha.
	#
	# As agulhas são COMPOSTAS AQUI, a partir de fragmentos que não casam
	# sozinhos: escritas por extenso, este arquivo acusaria a si mesmo.
	# ------------------------------------------------------------------- #
	local mutante="${DIR_TRABALHO}/mutante.conf"
	local agulha_hostname agulha_segredo agulha_redirecionamento
	agulha_hostname="$(printf '%s.%s.%s.%s' 'webhook' 'exemplo' 'com' 'br')"
	agulha_segredo="$(printf -- '-----%s %s %s-----' 'BEGIN' 'PRIVATE' 'KEY')"
	agulha_redirecionamento="$(printf '%s %s' 'return' '301')"

	cp "${GABARITO}" "${mutante}"
	{
		printf 'server_name %s;\n' "${agulha_hostname}"
		printf '# %s\n' "${agulha_segredo}"
		printf '%s https://destino;\n' "${agulha_redirecionamento}"
	} >>"${mutante}"

	codigo=0
	achados="$(varrer_formas_proibidas "${mutante}" hostname segredo redirecionamento)" || codigo=$?

	afirmar_igual "o mutante REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação acusa as três classes" "3" "$(contar_ocorrencias "${achados}")"
	afirmar_igual "a classe hostname nomeia a agulha plantada" \
		"hostname:${agulha_hostname}" \
		"$(printf '%s\n' "${achados}" | grep '^hostname:' || true)"
	# As três classes são fixadas por IGUALDADE contra a agulha plantada, e não
	# por "não-vazio": a agulha é conteúdo CONHECIDO, e afirmar só a presença
	# aprovaria uma varredura que acusasse a classe certa pelo motivo errado.
	afirmar_igual "a classe segredo nomeia a agulha plantada" \
		"segredo:${agulha_segredo}" \
		"$(printf '%s\n' "${achados}" | grep '^segredo:' || true)"
	afirmar_igual "a classe redirecionamento nomeia a agulha plantada" \
		"redirecionamento:${agulha_redirecionamento}" \
		"$(printf '%s\n' "${achados}" | grep '^redirecionamento:' || true)"

	# ------------------------------------------------------------------- #
	# Coerência entre a borda e o serviço. Sem ela, os dois tetos divergem em
	# silêncio: uma borda mais apertada vira gargalo que o serviço não conhece,
	# e uma mais larga entrega um corpo que ele já vai recusar.
	# ------------------------------------------------------------------- #
	if [[ -r "${COMPOSICAO_RAIZ}" ]]; then
		afirmar_igual "o gabarito declara o teto de corpo da borda" \
			"client_max_body_size ${TETO_DE_CORPO_NA_BORDA};" \
			"$(grep -oE "client_max_body_size [0-9a-z]+;" "${GABARITO}" | head -1 || true)"
		afirmar_igual "a composição raiz declara o mesmo teto, em bytes" \
			"export const MAIOR_CORPO_ACEITO = ${TETO_DE_CORPO_NO_SERVICO};" \
			"$(grep -E '^export const MAIOR_CORPO_ACEITO' "${COMPOSICAO_RAIZ}" | head -1 || true)"
	else
		aviso "${COMPOSICAO_RAIZ} não está legível — a coerência do teto de corpo NÃO foi verificada"
	fi

	# O caminho medido é o que a API de fato publica (T6) — senão esta bateria
	# mediria a borda contra uma ficção.
	if [[ -r "${CONTROLADOR_DA_NOTICIA}" ]]; then
		afirmar_igual "o controlador da T6 publica o caminho que esta bateria mede" \
			"export const CAMINHO_DAS_NOTIFICACOES_BANCARIAS = '${CAMINHO_DA_NOTICIA#/v1/}';" \
			"$(grep -E "^export const CAMINHO_DAS_NOTIFICACOES_BANCARIAS" "${CONTROLADOR_DA_NOTICIA}" | head -1 || true)"
	else
		aviso "${CONTROLADOR_DA_NOTICIA} não está legível — a coerência do caminho NÃO foi verificada"
	fi

	fechar_caso "CT-1005 (a)"
}

# =========================================================================== #
# CT-1005 (b) — a instalação é idempotente, e o gabarito meio substituído é
# recusado. Exercita as funções REAIS do instalador.
# =========================================================================== #
ct_1005_b() {
	caso "CT-1005 (b)" "a instalação é idempotente, recusa render quebrado ou implausível, confere a forma dos valores e desfaz a escrita não validada (funções reais do instalador)"

	local fn
	local -a funcoes_do_instalador=(
		renderizar_vhost vhost_diverge posicionar_vhost porta_da_api_na_unidade
		hostname_bem_formado caminho_bem_formado restaurar_destino
		vhost_declara_hostname conferir_precedencia_do_vhost
		chaves_repetidas_no_ambiente valor_no_arquivo_de_ambiente
		configuracao_inclui_diretorio servidor_ja_carregou modo_igual
	)
	for fn in "${funcoes_do_instalador[@]}"; do
		if ! carregar_funcao_do_instalador "${fn}"; then
			falhar "(b) não consegui carregar '${fn}' de ${INSTALADOR} — sem ela a tabela ficaria sem SUT e passaria vazia"
			fechar_caso "CT-1005 (b)"
			return
		fi
	done
	if ! carregar_funcao_do_instalador_como limpar limpar_do_instalador; then
		falhar "(b) não consegui carregar 'limpar' de ${INSTALADOR} — sem ela o desfazimento na janela ficaria sem SUT"
		fechar_caso "CT-1005 (b)"
		return
	fi
	ok "(b) as $((${#funcoes_do_instalador[@]} + 1)) funções de instalação carregadas de ${INSTALADOR##*/}"

	local sonda="${DIR_TRABALHO}/sonda"
	mkdir -p "${sonda}" "${sonda}/acme"

	# --- renderização ---------------------------------------------------- #
	local hostname_de_sonda="borda-de-sonda"
	local rendido="${sonda}/rendido.conf"
	local codigo=0
	renderizar_vhost "${GABARITO}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" >"${rendido}" || codigo=$?

	afirmar_igual "a renderização do gabarito íntegro sai 0" "0" "${codigo}"
	afirmar_igual "nenhum marcador sobra no renderizado" "0" \
		"$(grep -cE '__[A-Z_]+__' "${rendido}" || true)"
	afirmar_igual "o renderizado escuta TLS na porta informada" "listen 443 ssl;" \
		"$(grep -oE 'listen 443 ssl;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado atende o hostname informado" "server_name ${hostname_de_sonda};" \
		"$(grep -oE "server_name ${hostname_de_sonda};" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado aponta para a API no laço local" "proxy_pass http://127.0.0.1:3000;" \
		"$(grep -oE 'proxy_pass http://127\.0\.0\.1:3000;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado casa o caminho por igualdade exata" "location = ${CAMINHO_DA_NOTICIA} {" \
		"$(grep -oE "location = ${CAMINHO_DA_NOTICIA} \{" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado fixa o piso de TLS" "ssl_protocols TLSv1.2 TLSv1.3;" \
		"$(grep -oE 'ssl_protocols TLSv1\.2 TLSv1\.3;' "${rendido}" | head -1 || true)"
	# Sem esta linha, um render que perdesse a raiz do desafio passaria: o vhost
	# continua válido para o nginx, e a RENOVAÇÃO do certificado é que morre —
	# meses depois, sem sintoma. A forma é a diretiva inteira, não a presença.
	afirmar_igual "o renderizado serve o desafio da raiz informada" "root ${sonda}/acme;" \
		"$(grep -oE "root ${sonda}/acme;" "${rendido}" | head -1 || true)"
	afirmar_igual "e o desafio NÃO é repassado ao serviço no render" "0" \
		"$(awk '/location \^~ /,/^\t\}/' "${rendido}" | grep -c 'proxy_pass' || true)"

	# NEGATIVO: gabarito com marcador que ninguém substitui é RECUSADO. Sem
	# isso, um marcador novo entraria em produção pela metade e o vhost
	# atenderia um hostname que ninguém escolheu.
	local gabarito_com_sobra="${sonda}/com-sobra.conf"
	{
		cat "${GABARITO}"
		printf '# %s\n' "__PORTA_QUE_NINGUEM_SUBSTITUI__"
	} >"${gabarito_com_sobra}"
	codigo=0
	renderizar_vhost "${gabarito_com_sobra}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" >/dev/null 2>"${sonda}/sobra.err" || codigo=$?
	afirmar_igual "gabarito com marcador remanescente é RECUSADO" "1" "${codigo}"
	afirmar_igual "a recusa nomeia o marcador que sobrou" "__PORTA_QUE_NINGUEM_SUBSTITUI__" \
		"$(grep -oE '__[A-Z_]+__' "${sonda}/sobra.err" | head -1 || true)"

	# NEGATIVO: valor de configuração que QUEBRA o `sed`. A renderização é
	# chamada em `… || abortar`, e o `||` suprime `errexit` e `trap ERR` na
	# extensão inteira dela — sem a conferência do status, o `sed` morto deixava
	# o renderizado VAZIO, o guarda de marcador remanescente passava por vacuidade
	# e a função devolvia 0. O vhost vazio atravessa `nginx -t`, e a borda saía
	# instalada sem atender. É o código 1 abaixo que discrimina: com o defeito de
	# volta ele é 0, e a saída tem o byte da quebra de linha em vez de nada.
	local rendido_quebrado="${sonda}/quebrado.conf"
	codigo=0
	renderizar_vhost "${GABARITO}" 'bor|da' "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" \
		>"${rendido_quebrado}" 2>"${sonda}/quebrado.err" || codigo=$?
	afirmar_igual "valor que quebra o 'sed' faz a renderização RECUSAR" "1" "${codigo}"
	afirmar_igual "e nada sai pela saída padrão quando ela recusa" "0" \
		"$(wc -c <"${rendido_quebrado}")"

	# NEGATIVO da outra metade do guarda: render que sai com status 0 e conteúdo
	# mutilado. O gabarito de sonda não tem marcador nenhum, logo o guarda de
	# marcador remanescente o aprova — o que o recusa é a PLAUSIBILIDADE, e é ela
	# que impede a classe de reabrir por uma falha futura que não se anuncie pelo
	# status.
	local gabarito_mutilado="${sonda}/mutilado.conf"
	printf '# gabarito sem servidor nenhum\n' >"${gabarito_mutilado}"
	codigo=0
	renderizar_vhost "${gabarito_mutilado}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" "${sonda}/acme" \
		>/dev/null 2>"${sonda}/mutilado.err" || codigo=$?
	afirmar_igual "render sem 'server {' é RECUSADO ainda que o 'sed' tenha saído 0" "1" "${codigo}"
	afirmar_igual "a recusa diz que o render é implausível" "vhost renderizado implausível:" \
		"$(grep -oE 'vhost renderizado implausível:' "${sonda}/mutilado.err" | head -1 || true)"

	# --- forma dos valores que viram DIRETIVA do nginx -------------------- #
	# O hostname e os caminhos do certificado são interpolados no gabarito e
	# viram configuração. Um `;` publica duas diretivas onde deveria haver uma;
	# um espaço faz o vhost atender um nome que ninguém escolheu.
	# O valor aceito com mais de um rótulo é COMPOSTO a partir de fragmentos,
	# pela mesma razão das agulhas da prova de falsificação: escrito por extenso,
	# o CT-1005 (a) acusaria ESTE arquivo de fixar um hostname — e acusou, na
	# primeira escrita deste bloco. A âncora do (a) funcionando é o que garante
	# que o I4 não depende de ninguém lembrar dele.
	local valor multirrotulo
	multirrotulo="$(printf '%s.%s.%s' 'borda' 'exemplo' 'br')"
	for valor in "${multirrotulo}" 'borda-de-sonda' 'a1'; do
		afirmar_igual "hostname bem formado é ACEITO: [${valor}]" "0" \
			"$(hostname_bem_formado "${valor}" && echo 0 || echo 1)"
	done
	for valor in 'x; add_header X-Injetado 1' 'a b' 'bor|da' '-comeca-com-hifen' '' 'aspas"'; do
		afirmar_igual "hostname malformado é RECUSADO: [${valor}]" "1" \
			"$(hostname_bem_formado "${valor}" && echo 0 || echo 1)"
	done
	afirmar_igual "caminho absoluto de certificado é ACEITO" "0" \
		"$(caminho_bem_formado '/etc/nginx/ssl-certificates/borda.crt' && echo 0 || echo 1)"
	for valor in '/etc/a b.crt' '/etc/a;x.crt' '/etc/a|b.crt' 'relativo.crt' ''; do
		afirmar_igual "caminho malformado é RECUSADO: [${valor}]" "1" \
			"$(caminho_bem_formado "${valor}" && echo 0 || echo 1)"
	done

	# --- desfazimento na janela entre a escrita e a validação global ------ #
	# O P03 escreve o vhost e o P04 é quem o confronta com os demais. Enquanto a
	# limpeza apenas apagava o temporário, um término nessa janela (INT, TERM,
	# HUP, erro inesperado) deixava o vhost novo instalado E o backup destruído:
	# o `reload` seguinte — o do operador do legado, ou o do boot — carregaria
	# configuração cujo conflito global nunca foi testado.
	local vhosts_janela="${sonda}/vhosts-janela"
	local temporario_janela="${sonda}/temporario-janela"
	local destino_janela="${vhosts_janela}/${GABARITO##*/}"
	local anterior='vhost anterior, o que a borda ja carregava'
	mkdir -p "${vhosts_janela}" "${temporario_janela}"
	printf '%s\n' "${anterior}" >"${destino_janela}"
	cp -p "${destino_janela}" "${temporario_janela}/anterior.conf"
	printf 'vhost novo, ainda NAO confrontado com os demais vhosts\n' >"${destino_janela}"

	(
		erro() { :; }
		DIR_TEMPORARIO="${temporario_janela}"
		DIR_DOS_VHOSTS="${vhosts_janela}"
		NOME_DO_VHOST="${GABARITO##*/}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${temporario_janela}/anterior.conf"
		DESTINO_TINHA_ARQUIVO="sim"
		ESCRITA_PENDENTE="sim"
		limpar_do_instalador
	) >/dev/null 2>&1 || true

	afirmar_igual "com a janela ABERTA, a limpeza restaura o vhost anterior" \
		"${anterior}" "$(cat "${destino_janela}")"
	afirmar_igual "e só então remove o temporário que guardava o backup" "1" \
		"$([[ -d "${temporario_janela}" ]] && echo 0 || echo 1)"

	# COMPANHEIRO que discrimina: janela FECHADA (o P04 aprovou) é saída normal,
	# e a limpeza não pode desfazer o que acabou de ser validado. Sem este caso,
	# uma limpeza que restaurasse SEMPRE passaria no positivo acima.
	mkdir -p "${temporario_janela}"
	printf 'conteudo antigo que NAO deve voltar\n' >"${temporario_janela}/anterior.conf"
	printf 'vhost novo, ja aprovado pelo P04\n' >"${destino_janela}"
	(
		erro() { :; }
		DIR_TEMPORARIO="${temporario_janela}"
		DIR_DOS_VHOSTS="${vhosts_janela}"
		NOME_DO_VHOST="${GABARITO##*/}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${temporario_janela}/anterior.conf"
		DESTINO_TINHA_ARQUIVO="sim"
		ESCRITA_PENDENTE="nao"
		limpar_do_instalador
	) >/dev/null 2>&1 || true

	afirmar_igual "com a janela FECHADA, a limpeza NÃO toca o vhost instalado" \
		"vhost novo, ja aprovado pelo P04" "$(cat "${destino_janela}")"

	# --- decisão de idempotência ----------------------------------------- #
	local destino="${sonda}/vhosts/sysloc-notificacao-bancaria.conf"
	mkdir -p "${sonda}/vhosts"

	afirmar_igual "destino ausente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"

	# --- efeito: primeira execução escreve, segunda não toca -------------- #
	afirmar_igual "a primeira instalação escreve" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o destino ficou com o conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"
	afirmar_igual "o destino ficou com o modo declarado" "644" "$(stat -c '%a' "${destino}")"

	local carimbo_antes carimbo_depois
	carimbo_antes="$(stat -c '%Y %Z %s' "${destino}")"
	afirmar_igual "destino idêntico NÃO diverge" "1" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a segunda instalação NÃO escreve" "JA-OK" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	carimbo_depois="$(stat -c '%Y %Z %s' "${destino}")"
	afirmar_igual "o arquivo não foi reescrito na segunda execução" "${carimbo_antes}" "${carimbo_depois}"

	# --- divergência por modo e por conteúdo ------------------------------ #
	chmod 0600 "${destino}"
	afirmar_igual "modo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a instalação corrige o modo" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o modo voltou ao declarado" "644" "$(stat -c '%a' "${destino}")"

	printf '# alteração feita na cópia instalada\n' >>"${destino}"
	afirmar_igual "conteúdo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "a instalação restaura o conteúdo versionado" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "o destino voltou ao conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"

	# --- a porta da API é derivada da unidade versionada ------------------ #
	local unidade="${RAIZ_REPO}/deploy/systemd/sysloc-api.service"
	if [[ -r "${unidade}" ]]; then
		afirmar_igual "a porta da API é derivada da unidade versionada" \
			"$(sed -n 's|^Environment=PORT=\([0-9]\{1,\}\)$|\1|p' "${unidade}" | head -1)" \
			"$(porta_da_api_na_unidade "${unidade}")"
	else
		aviso "${unidade} não está legível — a derivação da porta NÃO foi verificada"
	fi

	# ------------------------------------------------------------------- #
	# A DISPUTA DE `server_name` — perder é invisível, e é o que esta tabela
	# impede. O servidor fica com o primeiro vhost que carrega (ordem
	# lexicográfica do `include`) e ignora o outro com um aviso que ninguém lê:
	# o `nginx -t` passa, o serviço sobe, e o provedor deixa de ser atendido.
	# ------------------------------------------------------------------- #
	local arena="${sonda}/arena"
	local alvo_da_disputa="borda-em-disputa"
	local nosso="000-sysloc-notificacao-bancaria.conf"
	mkdir -p "${arena}"

	# ANTIVÁCUO primeiro: diretório onde NINGUÉM declara o hostname precisa
	# REPROVAR. Sem esta asserção, a conferência que nunca acha nada aprovaria o
	# caso em que o vhost sequer foi escrito.
	printf 'server {\n\tserver_name outro-nome-qualquer;\n}\n' >"${arena}/500-alheio.conf"
	afirmar_igual "sem NENHUM declarante, a precedência REPROVA (antivácuo)" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"

	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/${nosso}"
	afirmar_igual "sozinho no diretório, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e a lista devolvida é exatamente ele" "${nosso}" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" || true)"

	# Rival que ordena DEPOIS: vencemos, e ele aparece na lista — é o que faz o
	# instalador poder NOMEAR quem está sendo ignorado.
	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/zz-rival.conf"
	afirmar_igual "com rival que ordena DEPOIS, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e a lista nomeia os dois, na ordem de carga" "${nosso} zz-rival.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" | tr '\n' ' ' | sed 's/ $//' || true)"

	# Rival que ordena ANTES: é o defeito que esta conferência existe para pegar.
	# Sem ela, a instalação seguiria e a borda seria ignorada em silêncio.
	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/000-antes.conf"
	afirmar_igual "com rival que ordena ANTES, a precedência REPROVA" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "e o primeiro da lista é o rival, não o nosso" "000-antes.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nosso}" "${alvo_da_disputa}" | head -1 || true)"

	# A declaração é por TOKEN. Sem isto, `server_name a.borda-em-disputa;` seria
	# lido como declaração de `borda-em-disputa` e a conferência acusaria rival
	# onde não há — ou pior, deixaria de acusar onde há.
	printf 'server {\n\tserver_name sub.%s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token.conf"
	afirmar_igual "'server_name sub.X' NÃO declara X (comparação por token)" "1" \
		"$(vhost_declara_hostname "${sonda}/token.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"
	printf 'server {\n\tserver_name outro %s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token2.conf"
	afirmar_igual "'server_name outro X' DECLARA X (lista de nomes)" "0" \
		"$(vhost_declara_hostname "${sonda}/token2.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"

	# ------------------------------------------------------------------- #
	# As cinco propriedades fechadas na intervenção dirigida de 2026-08-23
	# (débitos D34 a D38 da §2 desta fatia). Cada uma tinha modo de falha
	# OPERACIONAL medido e NENHUMA tinha asserção — `restaurar_destino` era
	# carregada aqui e nunca exercitada.
	# ------------------------------------------------------------------- #

	# D36 (a) — o guarda de marcador residual reconhece a FORMA, não o alfabeto.
	# Sem dígito na classe, um marcador futuro atravessa e chega a /etc meio
	# renderizado. O par é o que discrimina: o alfabético já era pego antes.
	# O marcador com dígito é ACRESCENTADO ao gabarito, não trocado por um real:
	# assim todos os marcadores legítimos continuam sendo substituídos e a recusa
	# só pode vir do guarda de residual — que é o que se quer provar. O controle é
	# o gabarito íntegro, renderizado com sucesso nas asserções acima.
	local gabarito_com_digito="${sonda}/gabarito-com-digito.conf"
	{
		printf '# __PORTA_8080__\n'
		cat "${GABARITO}"
	} >"${gabarito_com_digito}"
	afirmar_igual "marcador com DÍGITO não substituído é RECUSADO" "1" \
		"$(renderizar_vhost "${gabarito_com_digito}" "${hostname_de_sonda}" "443" "80" \
			"/etc/ssl/s.crt" "/etc/ssl/s.key" "127.0.0.1:3000" "${sonda}/acme" \
			>/dev/null 2>&1 && echo 0 || echo 1)"

	# D36 (b) — a comparação de modo é por VALOR em base 8, não por grafia.
	# `0044` contra `44` do `stat` fazia o arquivo ser julgado divergente e
	# reescrito em TODA execução, quebrando a idempotência em silêncio.
	# `0044` é o par que discrimina, e o `44` é o que o `stat` devolve para ele.
	# Com o recorte de texto anterior a comparação dava `044` != `44` e o arquivo
	# era reescrito em toda execução. O último par é o controle negativo: modos
	# realmente diferentes têm de continuar diferentes.
	afirmar_igual "modo 0044 é igual ao 44 que o stat devolve" "0" \
		"$(modo_igual "44" "0044" && echo 0 || echo 1)"
	afirmar_igual "modo 0644 é igual ao 644 que o stat devolve" "0" \
		"$(modo_igual "644" "0644" && echo 0 || echo 1)"
	afirmar_igual "e 600 continua DIFERENTE de 0644 (controle negativo)" "1" \
		"$(modo_igual "600" "0644" && echo 0 || echo 1)"

	# D38 — atribuição repetida é AMBIGUIDADE e se recusa; o systemd resolve pela
	# ÚLTIMA e um leitor ingênuo pela PRIMEIRA. O antivácuo vem primeiro: um
	# detector que nunca acha nada aprovaria qualquer arquivo.
	local ambiente_limpo="${sonda}/limpo.env" ambiente_duplo="${sonda}/duplo.env"
	printf 'HOSTNAME_DA_NOTIFICACAO_BANCARIA=a.exemplo\nCERTIFICADO_DA_BORDA=/x.crt\n' >"${ambiente_limpo}"
	printf 'HOSTNAME_DA_NOTIFICACAO_BANCARIA=primeiro\nCERTIFICADO_DA_BORDA=/x.crt\nHOSTNAME_DA_NOTIFICACAO_BANCARIA=ultimo\n' >"${ambiente_duplo}"
	afirmar_igual "ambiente sem repetição NÃO acusa (antivácuo)" "1" \
		"$(chaves_repetidas_no_ambiente "${ambiente_limpo}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "ambiente com chave repetida ACUSA, nomeando a chave" "HOSTNAME_DA_NOTIFICACAO_BANCARIA" \
		"$(chaves_repetidas_no_ambiente "${ambiente_duplo}" || true)"

	# D38, segunda perna — fim de linha do Windows e espaço à direita não entram
	# no valor, que vira caminho de certificado e diretiva do vhost.
	local ambiente_crlf="${sonda}/crlf.env"
	printf 'HOSTNAME_DA_NOTIFICACAO_BANCARIA=crlf.exemplo\r\nCERTIFICADO_DA_BORDA=/x.crt   \r\n' >"${ambiente_crlf}"
	afirmar_igual "o valor lido não carrega CR" "crlf.exemplo" \
		"$(valor_no_arquivo_de_ambiente "${ambiente_crlf}" HOSTNAME_DA_NOTIFICACAO_BANCARIA)"
	afirmar_igual "nem espaço à direita" "/x.crt" \
		"$(valor_no_arquivo_de_ambiente "${ambiente_crlf}" CERTIFICADO_DA_BORDA)"

	# D35 — a restauração repõe CONTEÚDO e PERMISSÃO. Fixar 0644 devolvia um
	# arquivo alheio que estava em 0600 com permissão frouxa, numa borda
	# compartilhada com quem atende a operação hoje.
	local dir_restauro="${sonda}/restauro"
	mkdir -p "${dir_restauro}"
	printf 'conteudo anterior de terceiro\n' >"${dir_restauro}/000-sysloc-notificacao-bancaria.conf"
	chmod 0600 "${dir_restauro}/000-sysloc-notificacao-bancaria.conf"
	(
		DIR_DOS_VHOSTS="${dir_restauro}"
		NOME_DO_VHOST="000-sysloc-notificacao-bancaria.conf"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${sonda}/backup-anterior.conf"
		MODO_ANTERIOR_DO_DESTINO="600"
		DESTINO_TINHA_ARQUIVO="sim"
		printf 'conteudo anterior de terceiro\n' >"${BACKUP_DO_DESTINO}"
		printf 'vhost novo que sera desfeito\n' >"${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
		restaurar_destino
	) >/dev/null 2>&1 || true
	afirmar_igual "a restauração repõe o conteúdo anterior" "conteudo anterior de terceiro" \
		"$(cat "${dir_restauro}/000-sysloc-notificacao-bancaria.conf")"
	afirmar_igual "e repõe a PERMISSÃO anterior, não a do produto" "600" \
		"$(stat -c '%a' "${dir_restauro}/000-sysloc-notificacao-bancaria.conf")"

	# D37 — a conferência de `include` resolve um nível. O caso transitivo é o
	# padrão do painel que administra a borda deste host, e sem ele o instalador
	# abortava dizendo que o diretório não é incluído justamente onde ele é.
	local arv="${sonda}/nginx"
	mkdir -p "${arv}/vhosts" "${arv}/confd"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/vhosts" >"${arv}/direto.conf"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/vhosts" >"${arv}/confd/painel.conf"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/confd" >"${arv}/transitivo.conf"
	printf 'http {\n  include %s/outro/*.conf;\n}\n' "${arv}" >"${arv}/ausente.conf"
	afirmar_igual "include DIRETO do diretório de vhosts é reconhecido" "0" \
		"$(configuracao_inclui_diretorio "${arv}/direto.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "include TRANSITIVO (um nível) também é reconhecido" "0" \
		"$(configuracao_inclui_diretorio "${arv}/transitivo.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "configuração que NÃO inclui o diretório reprova com 1" "1" \
		"$(configuracao_inclui_diretorio "${arv}/ausente.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "configuração ILEGÍVEL devolve 2 — não decidir não é decidir que não" "2" \
		"$(configuracao_inclui_diretorio "${arv}/nao-existe.conf" "${arv}/vhosts" && echo 0 || echo $?)"

	# D34 — estado convergente no DISCO não é estado convergente no PROCESSO.
	# O par discrimina: o arquivo antigo é anterior aos workers, o recém-criado
	# não. Sem o segundo sinal, uma execução interrompida entre a escrita e a
	# recarga deixava a borda sem atender e o script saía 0 dizendo `JA-OK`.
	local antigo="${sonda}/antigo.conf" recente="${sonda}/recente.conf"
	printf 'x\n' >"${antigo}"
	touch -d '2020-01-01' "${antigo}"
	printf 'x\n' >"${recente}"
	if ps -C nginx -o args= 2>/dev/null | grep -q 'worker process'; then
		afirmar_igual "arquivo ANTERIOR aos workers: o servidor já o carregou" "0" \
			"$(servidor_ja_carregou "${antigo}" && echo 0 || echo $?)"
		afirmar_igual "arquivo POSTERIOR aos workers: NÃO carregado — recarregar" "1" \
			"$(servidor_ja_carregou "${recente}" && echo 0 || echo $?)"
	else
		aviso "não há worker de nginx neste host — as duas asserções do segundo sinal do P05 (D34) NÃO foram feitas"
	fi
	afirmar_igual "arquivo inexistente: NÃO se decide (2), nunca 'recarregue'" "2" \
		"$(servidor_ja_carregou "${sonda}/nao-existe.conf" && echo 0 || echo $?)"

	fechar_caso "CT-1005 (b)"
}

# =========================================================================== #
# CT-1005 (c) — a medição de rede contra a borda EFÊMERA.
# =========================================================================== #
requisicoes_no_servico() {
	local trilha="${PREFIXO_DA_BORDA}/trilha.log"
	[[ -f "${trilha}" ]] || {
		printf '0'
		return 0
	}
	# `grep -c` imprime `0` E devolve status 1 quando não acha nada: um
	# `|| printf '0'` aqui imprimiria DOIS zeros, e a contagem viraria texto
	# inaritmético logo na primeira comparação.
	local contagem
	contagem="$(grep -c . "${trilha}" 2>/dev/null || true)"
	printf '%s' "${contagem:-0}"
}

# Faz UMA requisição pela borda efêmera e imprime `codigo|origem|location`.
# `000` é o que o curl reporta quando não houve resposta HTTP.
#
# O terceiro argumento é o CORPO, no idioma do próprio `curl`: um `@caminho` lê
# do disco, e qualquer outra coisa vai literal. Ausente, vale o corpo mínimo de
# sempre — as chamadas anteriores a esta parametrização seguem byte a byte iguais.
#
# ⚠️ O arquivo de cabeçalhos leva `BASHPID` no nome, e isso NÃO é zelo: a rodada
# simultânea do CT-1194 chama esta função em trinta e duas subcamadas ao mesmo
# tempo, e um nome fixo faria cada uma sobrescrever a leitura das outras — a
# origem do serviço apareceria na resposta errada, e a distribuição medida seria
# ficção. `$$` não serve: em subcamada ele continua sendo o do processo principal.
requisitar() {
	local metodo="$1" url="$2" corpo="${3:-}"
	local cabecalhos="${DIR_TRABALHO}/cabecalhos-${BASHPID}.txt"
	local codigo=""
	: >"${cabecalhos}"
	[[ -n "${corpo}" ]] || corpo='{"idempotencia":"verificacao"}'

	local argumentos=(-sS --max-time 10 -o /dev/null -D "${cabecalhos}" -w '%{http_code}'
		--cacert "${PREFIXO_DA_BORDA}/cert.pem"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTP}:127.0.0.1"
		-X "${metodo}")
	if [[ "${metodo}" == "POST" ]]; then
		argumentos+=(-H 'Content-Type: application/json' --data-binary "${corpo}")
	fi

	codigo="$(curl "${argumentos[@]}" "${url}" 2>>"${DIR_TRABALHO}/curl.err" || printf '000')"

	printf '%s|%s|%s' "${codigo}" \
		"$(grep -i "^${CABECALHO_DO_SERVICO}:" "${cabecalhos}" | tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' | head -1)" \
		"$(grep -i '^location:' "${cabecalhos}" | tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' | head -1)"
}

subir_borda_efemera() {
	PREFIXO_DA_BORDA="${DIR_TRABALHO}/borda"
	mkdir -p "${PREFIXO_DA_BORDA}/logs" "${PREFIXO_DA_BORDA}/temp"

	# O desafio de posse do domínio, plantado como o emissor do certificado o
	# planta: um arquivo de conteúdo conhecido sob `.well-known/acme-challenge/`
	# do webroot. O conteúdo é AFIRMADO POR IGUALDADE na medição — servir o
	# arquivo errado, ou servir vazio, reprova.
	RAIZ_DO_DESAFIO_EFEMERA="${PREFIXO_DA_BORDA}/acme"
	TOKEN_DO_DESAFIO="token-de-sonda-$$"
	CONTEUDO_DO_DESAFIO="prova-de-posse-${$}-$(date +%s 2>/dev/null || printf 'sem-relogio')"
	mkdir -p "${RAIZ_DO_DESAFIO_EFEMERA}/.well-known/acme-challenge"
	printf '%s' "${CONTEUDO_DO_DESAFIO}" \
		>"${RAIZ_DO_DESAFIO_EFEMERA}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}"

	# Guarda de sanidade: esta bateria só escreve dentro de um diretório
	# descartável. Se o prefixo escorregar para fora dele, ela para.
	case "${PREFIXO_DA_BORDA}" in
	/tmp/* | /var/tmp/*) : ;;
	*)
		falhar "(c) o prefixo da borda efêmera (${PREFIXO_DA_BORDA}) não está num diretório descartável"
		return 1
		;;
	esac

	HOSTNAME_EFEMERO="borda-efemera-$$"
	PORTA_HTTPS="$(porta_livre)"
	PORTA_HTTP="$(porta_livre)"

	openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
		-keyout "${PREFIXO_DA_BORDA}/chave.pem" -out "${PREFIXO_DA_BORDA}/cert.pem" \
		-subj "/CN=${HOSTNAME_EFEMERO}" \
		-addext "subjectAltName=DNS:${HOSTNAME_EFEMERO}" >/dev/null 2>&1

	# O serviço de verificação que fica ATRÁS da borda. Ele não é a API: o que
	# está sob prova aqui é o vhost, e o que se precisa do lado de dentro é uma
	# trilha do que atravessou — que é justamente o que a API não daria.
	ARQUIVO_DE_ESPERA="${PREFIXO_DA_BORDA}/segurar-a-resposta"
	ARQUIVO_DE_LIBERACAO="${PREFIXO_DA_BORDA}/liberar-a-resposta"
	rm -f "${ARQUIVO_DE_ESPERA}" "${ARQUIVO_DE_LIBERACAO}"

	cat >"${PREFIXO_DA_BORDA}/servico.mjs" <<'SERVICO'
import { createServer } from 'node:http';
import { appendFileSync, existsSync } from 'node:fs';

const [, , porta, trilha, cabecalho, origem, arquivoDeEspera, arquivoDeLiberacao] = process.argv;

// O modo de ESPERA existe para a rodada simultânea do CT-1194, e ele nunca é
// governado por relógio: a resposta fica presa enquanto o arquivo de espera
// existir e o de liberação não. Teste de concorrência que espera um tempo fixo é
// instável por construção — ora mede, ora não, e o vermelho que ele produz não
// diz nada sobre o código.
//
// O teto de sondagens é a VÁLVULA: ele impede que uma reprovação no meio da
// rodada deixe requisição pendurada. Os quatro prazos se ENCAIXAM, do mais curto
// ao mais longo, e a ordem é o que torna o desfecho previsível quando algo dá
// errado: a sondagem da bateria (3 s) < esta válvula (5 s) < o teto do cliente
// (`--max-time 10`) < o `proxy_read_timeout` da borda (15 s). Assim o desfecho
// degradado é um `204` tardio — nunca um `504` nem um `000`, que confundiriam o
// eixo do que se está medindo.
const INTERVALO_DA_SONDAGEM_MS = 100;
const LIMITE_DE_SONDAGENS = 50;

createServer((requisicao, resposta) => {
  appendFileSync(trilha, `${requisicao.method} ${requisicao.url}\n`);

  const responder = () => {
    resposta.writeHead(204, { [cabecalho]: origem });
    resposta.end();
  };

  if (!existsSync(arquivoDeEspera)) {
    responder();
    return;
  }

  let sondagens = 0;
  const relogio = setInterval(() => {
    sondagens += 1;
    if (existsSync(arquivoDeLiberacao) || sondagens >= LIMITE_DE_SONDAGENS) {
      clearInterval(relogio);
      responder();
    }
  }, INTERVALO_DA_SONDAGEM_MS);
}).listen(Number(porta), '127.0.0.1');
SERVICO

	local porta_do_servico
	porta_do_servico="$(porta_livre)"
	: >"${PREFIXO_DA_BORDA}/trilha.log"
	node "${PREFIXO_DA_BORDA}/servico.mjs" "${porta_do_servico}" \
		"${PREFIXO_DA_BORDA}/trilha.log" "${CABECALHO_DO_SERVICO}" "${ORIGEM_DO_SERVICO}" \
		"${ARQUIVO_DE_ESPERA}" "${ARQUIVO_DE_LIBERACAO}" \
		>"${PREFIXO_DA_BORDA}/servico.log" 2>&1 &
	PID_DO_SERVICO=$!

	# O vhost sob prova é o VERSIONADO, renderizado pelo renderizador REAL do
	# instalador. Reescrevê-lo aqui mediria uma cópia.
	#
	# ⚠️ As portas vão PREFIXADAS pelo endereço de laço local — fecho do
	# `D29 · F4/T11` (fatia `webhook-e-carne`), em 2026-08-19. Passando só o
	# número, o gabarito rende `listen <porta> ssl;` sem endereço e o nginx liga
	# `0.0.0.0`: a bateria que a ADR-0006 obriga a rodar ISOLADA abria superfície
	# de rede num host onde `/opt/frappe` opera. `listen 127.0.0.1:36011 ssl;` é
	# sintaxe válida, o `--resolve` de toda a bateria já aponta para 127.0.0.1, e
	# NADA muda no gabarito versionado nem na borda de produção — lá se continua
	# passando "443" e "80", sem endereço.
	renderizar_vhost "${GABARITO}" "${HOSTNAME_EFEMERO}" "127.0.0.1:${PORTA_HTTPS}" "127.0.0.1:${PORTA_HTTP}" \
		"${PREFIXO_DA_BORDA}/cert.pem" "${PREFIXO_DA_BORDA}/chave.pem" \
		"127.0.0.1:${porta_do_servico}" "${RAIZ_DO_DESAFIO_EFEMERA}" >"${PREFIXO_DA_BORDA}/vhost.conf" || return 1

	# Guarda de sanidade do isolamento, e ela é do ARQUIVO RENDIDO, não da
	# chamada acima: qualquer forma futura de montar a borda que volte a omitir o
	# endereço reprova aqui, e não só esta linha. Igualdade de conjunto sobre as
	# diretivas `listen`, com controle antivácuo — sem ele, um vhost sem `listen`
	# nenhum passaria por "não escuta fora do laço".
	local escutas
	escutas="$(grep -cE '^[[:space:]]*listen[[:space:]]+127\.0\.0\.1:[0-9]+' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	local escutas_totais
	escutas_totais="$(grep -cE '^[[:space:]]*listen[[:space:]]' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	if [[ "${escutas_totais}" -eq 0 ]]; then
		falhar "(c) o vhost efêmero não declara 'listen' nenhum — a guarda de isolamento mediria o vácuo"
		return 1
	fi
	if [[ "${escutas}" -ne "${escutas_totais}" ]]; then
		falhar "(c) o vhost efêmero escuta fora do laço local: ${escutas}/${escutas_totais} diretivas 'listen' em 127.0.0.1"
		return 1
	fi

	cat >"${PREFIXO_DA_BORDA}/nginx.conf" <<CONF
worker_processes 1;
pid ${PREFIXO_DA_BORDA}/nginx.pid;
error_log ${PREFIXO_DA_BORDA}/logs/error.log warn;
events { worker_connections 64; }
http {
  access_log ${PREFIXO_DA_BORDA}/logs/access.log;
  client_body_temp_path ${PREFIXO_DA_BORDA}/temp/client;
  proxy_temp_path ${PREFIXO_DA_BORDA}/temp/proxy;
  fastcgi_temp_path ${PREFIXO_DA_BORDA}/temp/fastcgi;
  uwsgi_temp_path ${PREFIXO_DA_BORDA}/temp/uwsgi;
  scgi_temp_path ${PREFIXO_DA_BORDA}/temp/scgi;
  include ${PREFIXO_DA_BORDA}/vhost.conf;
}
CONF

	nginx -c "${PREFIXO_DA_BORDA}/nginx.conf" -p "${PREFIXO_DA_BORDA}" \
		-e "${PREFIXO_DA_BORDA}/logs/error.log" >"${PREFIXO_DA_BORDA}/nginx.out" 2>&1 &

	# Sondagem com limite nomeado — nunca espera fixa.
	local limite=50 tentativa=0
	while [[ "${tentativa}" -lt "${limite}" ]]; do
		if [[ -s "${PREFIXO_DA_BORDA}/nginx.pid" ]] &&
			curl -sS --max-time 2 --cacert "${PREFIXO_DA_BORDA}/cert.pem" \
				--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
				-o /dev/null "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/" >/dev/null 2>&1; then
			return 0
		fi
		tentativa=$((tentativa + 1))
		sleep 0.2
	done

	return 1
}

ct_1005_c() {
	caso "CT-1005 (c)" "a borda publica exatamente um caminho, e a recusa é dela — medido por rede"

	local ferramenta faltando=()
	for ferramenta in nginx curl openssl node; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		aviso "ferramenta ausente no host: ${faltando[*]} — a MEDIÇÃO DE REDE não foi feita (é a asserção central do CT-1005)"
		fechar_caso "CT-1005 (c)"
		return
	fi

	if ! carregar_funcao_do_instalador renderizar_vhost; then
		falhar "(c) não consegui carregar 'renderizar_vhost' — a borda efêmera mediria uma cópia do vhost, não o versionado"
		fechar_caso "CT-1005 (c)"
		return
	fi

	if ! subir_borda_efemera; then
		falhar "(c) a borda efêmera não subiu — ver ${PREFIXO_DA_BORDA}/logs/error.log"
		[[ -f "${PREFIXO_DA_BORDA}/logs/error.log" ]] && tail -5 "${PREFIXO_DA_BORDA}/logs/error.log" >&2
		fechar_caso "CT-1005 (c)"
		return
	fi
	ok "(c) borda efêmera de pé: TLS em ${PORTA_HTTPS}, claro em ${PORTA_HTTP}, serviço em 127.0.0.1"

	# --- passo 1: o caminho da notícia alcança o serviço ------------------ #
	# É também o CONTROLE ANTIVÁCUO dos passos seguintes: sem ele, uma borda que
	# recusasse TUDO passaria em todas as outras asserções deste caso.
	local antes depois medida
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}")"
	depois="$(requisicoes_no_servico)"

	afirmar_igual "o caminho da notícia responde por TLS" "204|${ORIGEM_DO_SERVICO}|" "${medida}"
	afirmar_igual "a resposta veio do serviço, e não da borda" "$((antes + 1))" "${depois}"
	afirmar_igual "o serviço recebeu o método e o caminho inteiros" "POST ${CAMINHO_DA_NOTICIA}" \
		"$(tail -1 "${PREFIXO_DA_BORDA}/trilha.log")"

	# --- passo 2: nenhum outro caminho atravessa -------------------------- #
	local caminho
	for caminho in "${CAMINHOS_RECUSADOS[@]}"; do
		antes="$(requisicoes_no_servico)"
		medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "POST ${caminho} é recusado com 404, sem cabeçalho do serviço" "404||" "${medida}"
		afirmar_igual "POST ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"

		antes="$(requisicoes_no_servico)"
		medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "GET ${caminho} é recusado com 404, sem cabeçalho do serviço" "404||" "${medida}"
		afirmar_igual "GET ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"
	done

	# --- passo 3: em claro não há 3xx ------------------------------------- #
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}${CAMINHO_DA_NOTICIA}")"
	depois="$(requisicoes_no_servico)"

	afirmar_igual "em claro, o caminho da notícia é recusado SEM redirecionamento e sem Location" "404||" "${medida}"
	afirmar_diferente "a resposta em claro não é 3xx" "3" "${medida:0:1}"
	afirmar_igual "a requisição em claro NÃO foi repassada ao serviço" "${antes}" "${depois}"

	antes="$(requisicoes_no_servico)"
	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/docs")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "em claro, /docs também morre na borda" "404||" "${medida}"
	afirmar_igual "GET /docs em claro NÃO foi repassado ao serviço" "${antes}" "${depois}"

	# --- passo 3-B: o desafio de posse do domínio, e o contorno dele ------ #
	# A ÚNICA exceção ao 404 do bloco em claro. Ela existe porque esta borda
	# vence a disputa de `server_name` da porta 80 do hostname que atende — sem
	# ela o desafio morre no 404 e a RENOVAÇÃO do certificado falha, em silêncio,
	# meses depois de instalada. As cinco asserções medem a exceção E o contorno:
	# servir o desafio não pode ter aberto nada além do desafio.
	local corpo_do_desafio
	antes="$(requisicoes_no_servico)"
	corpo_do_desafio="$(curl -sS --max-time 10 \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTP}:127.0.0.1" \
		"http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}" \
		2>/dev/null || printf 'NAO-RESPONDEU')"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "o desafio em claro é SERVIDO, com o conteúdo exato do arquivo plantado" \
		"${CONTEUDO_DO_DESAFIO}" "${corpo_do_desafio}"
	afirmar_igual "e o desafio NÃO foi repassado ao serviço" "${antes}" "${depois}"

	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/acme-challenge/nao-plantado")"
	afirmar_igual "desafio inexistente continua 404 — a exceção serve arquivo, não árvore" "404||" "${medida}"

	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/.well-known/acme-challenge/${TOKEN_DO_DESAFIO}")"
	afirmar_igual "sob TLS o MESMO desafio é 404 — a exceção é só do bloco em claro" "404||" "${medida}"

	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/.well-known/outra-coisa")"
	afirmar_igual "em claro, /.well-known de OUTRA coisa continua 404 — o prefixo é ancorado" "404||" "${medida}"

	# --- piso de TLS ------------------------------------------------------ #
	local codigo_tls
	codigo_tls="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' --tlsv1.2 --tls-max 1.2 \
		--cacert "${PREFIXO_DA_BORDA}/cert.pem" \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
		-X POST -H 'Content-Type: application/json' --data-binary '{}' \
		"https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" 2>/dev/null || printf '000')"
	afirmar_igual "TLS 1.2 é aceito no caminho da notícia" "204" "${codigo_tls}"

	codigo_tls="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' --tlsv1.3 \
		--cacert "${PREFIXO_DA_BORDA}/cert.pem" \
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
		-X POST -H 'Content-Type: application/json' --data-binary '{}' \
		"https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" 2>/dev/null || printf '000')"
	afirmar_igual "TLS 1.3 é aceito no caminho da notícia" "204" "${codigo_tls}"
	nota "a RECUSA de TLS 1.0/1.1 não é medida aqui de propósito: o cliente deste host não os fala, e uma asserção que não pode falhar pelo defeito que persegue é vácuo. O piso vem do 'ssl_protocols' renderizado, conferido no CT-1005 (b)"

	# --- o total do que atravessou --------------------------------------- #
	# A conta fecha o caso: 3 requisições legítimas (a do passo 1 e as duas do
	# piso de TLS), e nenhuma outra.
	afirmar_igual "ao todo, só o caminho da notícia atravessou a borda" "3" "$(requisicoes_no_servico)"
	afirmar_igual "e tudo que atravessou foi para o caminho da notícia" "3" \
		"$(grep -c " ${CAMINHO_DA_NOTICIA}\$" "${PREFIXO_DA_BORDA}/trilha.log" || true)"

	fechar_caso "CT-1005 (c)"
}

# =========================================================================== #
# A PROTEÇÃO CONTRA ABUSO DA BORDA — ADR-0037, T10 da fatia
# `publicacao-e-backup`, fechando o débito que este gabarito registrava desde
# 2026-08-19.
#
# As quatro frentes medem os DOIS sentidos da decisão, e é o par que as torna
# verdadeiras — uma metade sozinha aprova a proteção errada:
#
#   · o que TEM de passar — a rajada legítima (CT-1191) e o corpo no byte exato
#     do teto (CT-1192);
#   · o que TEM de ser barrado — o corpo acima do teto (CT-1192) e a
#     concorrência acima do teto (CT-1194);
#   · e a DECLARAÇÃO que sustenta as duas (CT-1193).
#
# Todas as três frentes de rede REAPROVEITAM a borda efêmera que o CT-1005 (c)
# deixou de pé: remontá-la mediria outra borda, e pagaria de novo o certificado,
# o servidor e o serviço de trilha.
# =========================================================================== #

# A borda efêmera do CT-1005 (c) segue de pé? Sem ela, as frentes de rede
# DEGRADAM declarando — nunca passam em silêncio, que é o que uma medição contra
# uma borda ausente faria.
borda_efemera_disponivel() {
	[[ -n "${PREFIXO_DA_BORDA}" && -s "${PREFIXO_DA_BORDA}/nginx.pid" ]] || return 1
	[[ -n "${PID_DO_SERVICO}" ]] || return 1
	kill -0 "${PID_DO_SERVICO}" 2>/dev/null
}

# Quantas das medidas recebidas carregam determinado código. A medida é
# `codigo|origem|location`, e o que se conta é o primeiro campo.
contar_com_codigo() {
	local alvo="$1"
	shift
	local total=0 medida
	for medida in "$@"; do
		if [[ "${medida%%|*}" == "${alvo}" ]]; then
			total=$((total + 1))
		fi
	done
	printf '%s' "${total}"
}

# Os códigos DISTINTOS das medidas recebidas, em ordem e separados por espaço.
codigos_distintos() {
	local medida
	for medida in "$@"; do
		printf '%s\n' "${medida%%|*}"
	done | LC_ALL=C sort -u | tr '\n' ' ' | sed 's| *$||'
}

# Um corpo de exatamente N bytes, gerado no diretório descartável. `/dev/zero`
# dá o tamanho exato sem depender do que o sistema tenha de aleatório, e o `tr`
# o torna legível num despejo de diagnóstico.
gerar_corpo_de_bytes() {
	local bytes="$1" destino="$2"
	head -c "${bytes}" /dev/zero | tr '\0' 'a' >"${destino}"
}

# =========================================================================== #
# CT-1191 — a RAJADA LEGÍTIMA do provedor atravessa inteira.
#
# ⚠️ É O CASO QUE DISCRIMINA A TASK INTEIRA. Sem ele, instalar um
# `limit_req_zone` por origem deixaria esta bateria verde e a notícia se
# perderia em produção — o dano que a fatia `webhook-e-carne` existe para não
# ter, e a alternativa que a ADR-0037 rejeita NOMINALMENTE.
#
# A asserção que discrimina é o CONJUNTO dos códigos distintos: com um teto de
# taxa de volta, ele deixa de ser `204` sozinho e passa a conter o `503` (ou o
# `429`, conforme o `limit_req_status`) da recusa. Contar só o total de `204`
# não bastaria — trinta requisições das quais vinte passassem ainda dariam
# "houve 204".
#
# ⚠️ NÃO o colapse no CT-1194: rajada SEQUENCIAL nunca exercita concorrência, e
# é justamente por ser sequencial que ela prova que o eixo do teto não é volume.
# =========================================================================== #
ct_1191() {
	caso "CT-1191" "a rajada legítima do provedor atravessa a borda inteira, sem teto de taxa"

	if ! borda_efemera_disponivel; then
		aviso "a borda efêmera não está de pé — a TRAVESSIA DA RAJADA não foi medida (é a asserção central do CT-1191)"
		fechar_caso "CT-1191"
		return
	fi

	local antes depois indice
	local -a medidas=()
	antes="$(requisicoes_no_servico)"
	for ((indice = 1; indice <= REQUISICOES_DA_RAJADA; indice++)); do
		medidas+=("$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
			"{\"idempotencia\":\"rajada-${indice}\"}")")
	done
	depois="$(requisicoes_no_servico)"

	# ANTIVÁCUO: uma rajada de zero requisições teria conjunto de códigos vazio,
	# nenhum `503` e nenhum `429` — e passaria em tudo o que vem abaixo.
	afirmar_igual "a rajada disparou as ${REQUISICOES_DA_RAJADA} requisições" \
		"${REQUISICOES_DA_RAJADA}" "${#medidas[@]}"

	afirmar_igual "a rajada inteira tem UM único código distinto, e ele é o do serviço" \
		"204" "$(codigos_distintos "${medidas[@]}")"
	afirmar_igual "todas as ${REQUISICOES_DA_RAJADA} respostas vieram do serviço" \
		"${REQUISICOES_DA_RAJADA}" "$(contar_com_codigo "204" "${medidas[@]}")"
	afirmar_igual "nenhuma resposta foi recusada por concorrência (503)" \
		"0" "$(contar_com_codigo "503" "${medidas[@]}")"
	afirmar_igual "nenhuma resposta foi recusada por taxa (429)" \
		"0" "$(contar_com_codigo "429" "${medidas[@]}")"
	afirmar_igual "a trilha do serviço cresceu exatamente a rajada" \
		"$((antes + REQUISICOES_DA_RAJADA))" "${depois}"

	fechar_caso "CT-1191"
}

# =========================================================================== #
# CT-1192 — o teto de TAMANHO DE CORPO barra na borda, e no byte certo.
#
# A perna de ${CORPO_NO_TETO} bytes é o que separa *"há um teto"* de *"há o teto
# CERTO"*: o padrão histórico de reprovação que a `testing-stack.md` nomeia é
# *"provou-se o que era fácil provar"*, e aqui o fácil é o `413` — o difícil é o
# byte exato em que ele começa.
#
# A asserção que discrimina é o PAR de fronteira: um teto errado por um byte
# para menos reprova a perna do teto (que viria `413`), e um teto errado para
# mais reprova a perna de cima (que atravessaria e chegaria à trilha). Nenhuma
# das duas sozinha pega os dois defeitos.
# =========================================================================== #
ct_1192() {
	caso "CT-1192" "o teto de tamanho de corpo barra na própria borda, e no byte exato"

	if ! borda_efemera_disponivel; then
		aviso "a borda efêmera não está de pé — a FRONTEIRA DO CORPO não foi medida (é a asserção central do CT-1192)"
		fechar_caso "CT-1192"
		return
	fi

	local corpos="${DIR_TRABALHO}/corpos"
	mkdir -p "${corpos}"

	local antes depois medida bytes arquivo
	for bytes in "${CORPO_PEQUENO}" "${CORPO_NO_TETO}" "${CORPO_ACIMA_DO_TETO}"; do
		arquivo="${corpos}/corpo-${bytes}.json"
		gerar_corpo_de_bytes "${bytes}" "${arquivo}"
		# Sem esta conferência, um gerador que produzisse menos bytes faria a
		# perna de cima do teto atravessar — e o caso aprovaria a borda errada.
		afirmar_igual "o corpo de sonda tem exatamente ${bytes} byte(s)" \
			"${bytes}" "$(wc -c <"${arquivo}")"
	done

	# --- controle: a borda de fato aceita alguma coisa ------------------- #
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
		"@${corpos}/corpo-${CORPO_PEQUENO}.json")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "corpo de ${CORPO_PEQUENO} bytes atravessa (controle antivácuo)" \
		"204|${ORIGEM_DO_SERVICO}|" "${medida}"
	afirmar_igual "e o corpo de ${CORPO_PEQUENO} bytes chegou ao serviço" "$((antes + 1))" "${depois}"

	# --- no teto: atravessa ---------------------------------------------- #
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
		"@${corpos}/corpo-${CORPO_NO_TETO}.json")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "corpo de ${CORPO_NO_TETO} bytes — exatamente o teto — atravessa" \
		"204|${ORIGEM_DO_SERVICO}|" "${medida}"
	afirmar_igual "e o corpo no teto chegou ao serviço" "$((antes + 1))" "${depois}"

	# --- um byte acima: recusado NA BORDA, sem repasse -------------------- #
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
		"@${corpos}/corpo-${CORPO_ACIMA_DO_TETO}.json")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "corpo de ${CORPO_ACIMA_DO_TETO} bytes é recusado com 413, sem cabeçalho do serviço" \
		"413||" "${medida}"
	afirmar_igual "e o corpo acima do teto NÃO foi repassado ao serviço" "${antes}" "${depois}"

	fechar_caso "CT-1192"
}

# =========================================================================== #
# A varredura da LIMITAÇÃO DECLARADA — UMA função, usada pelo controle e pelos
# dois mutantes (CT-1193).
#
# Imprime SEMPRE a medição, e uma linha por problema:
#
#   medida:<zonas>|<conexoes>|<taxa>
#   problema:<o que está errado>
#
# Devolve 1 quando há problema. O status é parte do contrato, e não detalhe: uma
# varredura que apenas imprimisse ficaria verde sobre os dois mutantes.
#
# ⚠️ Ela ignora LINHA DE COMENTÁRIO, e isso é o caso inteiro: o cabeçalho do
# gabarito EXPLICA por que não há teto de taxa, e citar `limit_req` para
# PROIBI-LO é conteúdo legítimo — a mesma distinção que a classe
# `redirecionamento` de `varrer_formas_proibidas` já faz. Sem ela, a única saída
# para ficar verde seria apagar a explicação, que é o que impede a próxima
# rodada de reabrir a decisão por desconhecê-la.
# =========================================================================== #
varrer_limitacao_declarada() {
	local arquivo="$1"
	local ativas zonas conexoes taxa achados_de_taxa
	local problemas=0

	ativas="$(grep -vE '^[[:space:]]*#' "${arquivo}" || true)"

	zonas="$(printf '%s\n' "${ativas}" |
		grep -cE "^[[:space:]]*limit_conn_zone[[:space:]].*zone=${ZONA_DE_CONCORRENCIA}:" || true)"
	conexoes="$(printf '%s\n' "${ativas}" |
		awk -v caminho="${CAMINHO_DA_NOTICIA}" '
			index($0, "location = " caminho " {") { dentro = 1; next }
			dentro && $0 ~ /^[[:space:]]*\}/ { dentro = 0 }
			dentro { print }
		' |
		grep -cE "^[[:space:]]*limit_conn[[:space:]]+${ZONA_DE_CONCORRENCIA}[[:space:]]+[0-9]+;" || true)"
	taxa="$(printf '%s\n' "${ativas}" | grep -cE 'limit_req' || true)"
	achados_de_taxa="$(printf '%s\n' "${ativas}" | grep -oE 'limit_req[a-z_]*' |
		LC_ALL=C sort -u | tr '\n' ' ' | sed 's| *$||' || true)"

	printf 'medida:%s|%s|%s\n' "${zonas}" "${conexoes}" "${taxa}"

	if [[ "${zonas}" -ne 1 ]]; then
		printf 'problema:zona de concorrencia declarada %s vez(es), e o esperado é uma\n' "${zonas}"
		problemas=$((problemas + 1))
	fi
	if [[ "${conexoes}" -ne 1 ]]; then
		printf 'problema:limit_conn ausente no location da notícia\n'
		problemas=$((problemas + 1))
	fi
	if [[ "${taxa}" -ne 0 ]]; then
		printf 'problema:teto de taxa declarado, o que a ADR-0037 proíbe nesta rota: %s\n' "${achados_de_taxa}"
		problemas=$((problemas + 1))
	fi

	[[ "${problemas}" -eq 0 ]]
}

# Quantas linhas `problema:` a varredura devolveu.
contar_problemas() {
	printf '%s\n' "$1" | grep -c '^problema:' || true
}

# O teto de concorrência declarado em linha ATIVA de um arquivo de vhost — o
# número do `limit_conn` da zona desta borda, ou vazio quando não há.
#
# Ela existe para a ÂNCORA DO VALOR do CT-1193, e é deliberadamente separada da
# `varrer_limitacao_declarada`: aquela afirma que a limitação é da NATUREZA
# certa (concorrência, e nunca taxa), esta afirma que ela está no VALOR certo.
# São defeitos diferentes — um vhost com `limit_conn ... 1;` passa inteiro na
# primeira e é justamente o que descarta a rajada legítima do provedor.
#
# O `exit` do `awk` é o que impede o SIGPIPE que um `head -1` traria sob
# `pipefail`.
ler_teto_de_concorrencia() {
	local arquivo="$1"
	grep -vE '^[[:space:]]*#' "${arquivo}" |
		awk -v zona="${ZONA_DE_CONCORRENCIA}" '
			$1 == "limit_conn" && $2 == zona {
				valor = $3
				sub(/;$/, "", valor)
				print valor
				exit
			}
		' || true
}

# =========================================================================== #
# CT-1193 — a limitação declarada é por CONCORRÊNCIA, e não existe teto de taxa.
#
# ⚠️ É a ÚNICA asserção ESTÁTICA das quatro frentes — ela inspeciona o TEXTO do
# gabarito —, e por isso a única que exige PROVA DE FALSIFICAÇÃO por execução: a
# mesma varredura roda sobre dois mutantes, cada um com um defeito diferente
# plantado, e precisa reprovar NOMEANDO a agulha. As duas pernas são
# obrigatórias: sem a segunda, uma varredura que só procurasse `limit_req`
# aprovaria um vhost sem proteção nenhuma.
#
# Ele carrega também a ÂNCORA DO VALOR do teto de concorrência, com a terceira
# perna de falsificação: a natureza certa no valor errado — `limit_conn ... 1;` —
# passa em tudo o que a bateria mede por rede (o CT-1194 deriva as expectativas
# do próprio renderizado, e o CT-1191 é sequencial) e descarta a rajada legítima
# do provedor em produção, que é o dano PIOR que o abuso.
#
# Os mutantes vivem no diretório descartável desta bateria, JAMAIS na árvore de
# trabalho.
# =========================================================================== #
ct_1193() {
	caso "CT-1193" "a limitação declarada no gabarito é por concorrência, e não há teto de taxa"

	if [[ ! -r "${GABARITO}" ]]; then
		falhar "gabarito ilegível: ${GABARITO}"
		fechar_caso "CT-1193"
		return
	fi

	local mutantes="${DIR_TRABALHO}/limitacao"
	mkdir -p "${mutantes}"

	# --- controle: o gabarito real ---------------------------------------- #
	local codigo=0 saida
	saida="$(varrer_limitacao_declarada "${GABARITO}")" || codigo=$?
	afirmar_igual "o gabarito declara uma zona, um teto de concorrência e ZERO tetos de taxa" \
		"medida:1|1|0" "$(printf '%s\n' "${saida}" | grep '^medida:' || true)"
	afirmar_igual "a varredura APROVA o gabarito real" "0" "${codigo}"
	afirmar_igual "e não acusa problema algum nele" "0" "$(contar_problemas "${saida}")"

	# O cabeçalho do gabarito CITA a família proibida para proibi-la, e essa é a
	# razão de a varredura ignorar comentário. Sem esta asserção, alguém poderia
	# "consertar" o verde apagando a explicação — e a decisão voltaria a existir
	# só na ADR, longe de quem edita o arquivo.
	afirmar_diferente "o gabarito EXPLICA em comentário por que não há teto de taxa" \
		"0" "$(grep -cE '^[[:space:]]*#.*limit_req' "${GABARITO}" || true)"

	# ÂNCORA DO VALOR do teto de concorrência. Sem ela, o número não é afirmado
	# em lugar NENHUM da bateria: o CT-1194 o lê do vhost renderizado (o próprio
	# artefato sob prova) e deriva dele as expectativas, a varredura acima casa
	# qualquer inteiro, e o CT-1191 é sequencial. A comparação por IGUALDADE com
	# a terceira declaração é o único lado independente que existe.
	afirmar_igual "o gabarito declara o teto de concorrência que este verificador conhece" \
		"${TETO_DE_CONCORRENCIA_NA_BORDA}" "$(ler_teto_de_concorrencia "${GABARITO}")"

	# --- falsificação 1: teto de TAXA plantado em linha ativa -------------- #
	local mutante_com_taxa="${mutantes}/com-teto-de-taxa.conf"
	{
		cat "${GABARITO}"
		printf 'limit_req_zone $binary_remote_addr zone=abuso:1m rate=5r/s;\n'
	} >"${mutante_com_taxa}"

	codigo=0
	saida="$(varrer_limitacao_declarada "${mutante_com_taxa}")" || codigo=$?
	afirmar_igual "o mutante COM teto de taxa REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a medição do mutante 1 acusa a diretiva de taxa" \
		"medida:1|1|1" "$(printf '%s\n' "${saida}" | grep '^medida:' || true)"
	# A reprovação é fixada por IGUALDADE contra a agulha plantada, e não por
	# "não-vazio": a agulha é conteúdo CONHECIDO, e afirmar só a presença
	# aprovaria uma varredura que reprovasse pelo motivo errado.
	afirmar_igual "e a reprovação NOMEIA a família proibida" \
		"problema:teto de taxa declarado, o que a ADR-0037 proíbe nesta rota: limit_req_zone" \
		"$(printf '%s\n' "${saida}" | grep '^problema:' || true)"

	# --- falsificação 2: teto de CONCORRÊNCIA removido --------------------- #
	local mutante_sem_conexao="${mutantes}/sem-teto-de-concorrencia.conf"
	grep -vE "^[[:space:]]*limit_conn[[:space:]]+${ZONA_DE_CONCORRENCIA}[[:space:]]" \
		"${GABARITO}" >"${mutante_sem_conexao}" || true
	afirmar_igual "o mutante 2 perdeu exatamente uma linha do gabarito" "1" \
		"$(($(grep -c '' "${GABARITO}") - $(grep -c '' "${mutante_sem_conexao}")))"

	codigo=0
	saida="$(varrer_limitacao_declarada "${mutante_sem_conexao}")" || codigo=$?
	afirmar_igual "o mutante SEM teto de concorrência REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a medição do mutante 2 acusa a ausência do teto" \
		"medida:1|0|0" "$(printf '%s\n' "${saida}" | grep '^medida:' || true)"
	afirmar_igual "e a reprovação NOMEIA o que faltou" \
		"problema:limit_conn ausente no location da notícia" \
		"$(printf '%s\n' "${saida}" | grep '^problema:' || true)"

	# --- falsificação 3: o teto de concorrência TROCADO -------------------- #
	#
	# É a prova da âncora do valor, e ela é obrigatória pela mesma razão das
	# duas acima: a asserção é ESTÁTICA. Sem esta perna, uma âncora escrita como
	# "há um teto declarado" ficaria verde sobre um gabarito rebaixado para `1`
	# — que é precisamente o defeito que ela existe para pegar, e o único que a
	# medição de rede não alcança.
	local mutante_com_outro_teto="${mutantes}/com-outro-teto.conf"
	local teto_plantado=$((TETO_DE_CONCORRENCIA_NA_BORDA + 1))
	sed -E "s|^([[:space:]]*limit_conn[[:space:]]+${ZONA_DE_CONCORRENCIA}[[:space:]]+)[0-9]+;|\\1${teto_plantado};|" \
		"${GABARITO}" >"${mutante_com_outro_teto}"
	afirmar_igual "o mutante 3 trocou UMA linha do gabarito, e nada mais" "1" \
		"$(diff "${GABARITO}" "${mutante_com_outro_teto}" | grep -c '^>' || true)"
	afirmar_igual "a leitura do mutante 3 devolve o teto PLANTADO" \
		"${teto_plantado}" "$(ler_teto_de_concorrencia "${mutante_com_outro_teto}")"
	afirmar_diferente "e por isso a ÂNCORA DO VALOR reprova sobre ele" \
		"${TETO_DE_CONCORRENCIA_NA_BORDA}" "$(ler_teto_de_concorrencia "${mutante_com_outro_teto}")"
	# A varredura de NATUREZA continua aprovando o mutante 3 — é o que prova que
	# os dois defeitos são de classes diferentes, e que a âncora não é redundante
	# com o que já existia.
	codigo=0
	saida="$(varrer_limitacao_declarada "${mutante_com_outro_teto}")" || codigo=$?
	afirmar_igual "e o teto TROCADO passaria pela varredura de natureza — a âncora não é redundante" \
		"0" "${codigo}"

	fechar_caso "CT-1193"
}

# =========================================================================== #
# CT-1194 — a concorrência acima do teto é recusada, e as MESMAS requisições em
# sequência passam.
#
# É o par sequencial/simultâneo que prova que o eixo do teto é a CONCORRÊNCIA, e
# não o volume: a rodada 2 dispara exatamente a mesma quantidade da rodada 1 e
# atravessa inteira. A asserção que discrimina é a distribuição da rodada 1
# contra a da rodada 2 — um teto de volume daria recusa nas duas, e nenhum teto
# daria travessia nas duas.
#
# ⚠️ Ponto de flakiness declarado, e é por isso que NADA aqui espera relógio: as
# respostas ficam presas por ARQUIVO DE CONTROLE, a sondagem tem limite nomeado,
# e a liberação acontece também no `trap`, para que uma reprovação no meio da
# rodada jamais deixe requisição pendurada. Se o serviço não segurar o teto no
# prazo, o caso DEGRADA declarando a asserção não medida — jamais espera fixa,
# jamais repetição, e jamais colapso no CT-1193, que é estático e não prova que
# o teto declarado de fato barra.
# =========================================================================== #
ct_1194() {
	caso "CT-1194" "a concorrência acima do teto é recusada, e as mesmas requisições em sequência passam"

	if ! borda_efemera_disponivel; then
		aviso "a borda efêmera não está de pé — o TETO DE CONCORRÊNCIA não foi medido (é a asserção central do CT-1194)"
		fechar_caso "CT-1194"
		return
	fi

	# O teto é LIDO do vhost renderizado, e não redigitado: o que se mede tem de
	# ser o teto que a borda sob prova de fato carrega.
	local aceitas
	aceitas="$(grep -oE "^[[:space:]]*limit_conn[[:space:]]+${ZONA_DE_CONCORRENCIA}[[:space:]]+[0-9]+;" \
		"${PREFIXO_DA_BORDA}/vhost.conf" | grep -oE '[0-9]+' | head -1 || true)"
	if [[ -z "${aceitas}" || "${aceitas}" -lt 1 ]]; then
		falhar "(CT-1194) não consegui ler o teto de concorrência do vhost renderizado — sem ele a rodada mediria um número inventado"
		fechar_caso "CT-1194"
		return
	fi
	ok "o teto de concorrência lido do vhost renderizado é ${aceitas}"

	local total=$((aceitas + EXCEDENTES_ALEM_DO_TETO))
	local respostas="${DIR_TRABALHO}/concorrencia"
	rm -rf "${respostas}"
	mkdir -p "${respostas}"

	# --- rodada 1: SIMULTÂNEAS -------------------------------------------- #
	rm -f "${ARQUIVO_DE_LIBERACAO}"
	: >"${ARQUIVO_DE_ESPERA}"

	local antes depois indice
	local -a disparadas=()
	antes="$(requisicoes_no_servico)"
	for ((indice = 1; indice <= total; indice++)); do
		requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
			"{\"idempotencia\":\"simultanea-${indice}\"}" >"${respostas}/${indice}" 2>/dev/null &
		disparadas+=("$!")
	done

	# Sondagem com limite NOMEADO até o serviço registrar que segura o teto.
	local tentativa=0 chegadas=0
	while [[ "${tentativa}" -lt "${LIMITE_DE_SONDAGENS_DA_CONCORRENCIA}" ]]; do
		chegadas=$(($(requisicoes_no_servico) - antes))
		if [[ "${chegadas}" -ge "${aceitas}" ]]; then
			break
		fi
		tentativa=$((tentativa + 1))
		sleep "${INTERVALO_DA_SONDAGEM}"
	done

	# A liberação vem ANTES da espera, senão a bateria espera pelo que ela mesma
	# está segurando.
	#
	# ⚠️ A espera é pelos PIDs DISPARADOS AQUI, e nunca `wait` sem argumento: o
	# servidor efêmero e o serviço de trilha também são trabalhos em segundo
	# plano DESTA camada, e os dois só terminam na limpeza — um `wait` nu espera
	# por eles e a bateria trava para sempre, depois de já ter medido tudo.
	# Medido nesta task, e é o modo de falha mais caro que ela encontrou: o
	# travamento acontece DEPOIS das asserções, então nada fica vermelho.
	#
	# O `|| true` é do mesmo tecido: `wait` devolve o status do último trabalho,
	# e uma requisição que o `curl` não conseguiu fazer abortaria a bateria sob
	# `set -e` em vez de virar a medida `000` que as asserções abaixo reprovam
	# nomeando o desfecho.
	liberar_requisicoes_seguras
	wait "${disparadas[@]}" || true

	local -a medidas=()
	for ((indice = 1; indice <= total; indice++)); do
		medidas+=("$(cat "${respostas}/${indice}" 2>/dev/null || printf '000||')")
	done
	depois="$(requisicoes_no_servico)"

	# ⚠️ Os dois desfechos em que a sondagem NÃO bate com o teto têm naturezas
	# OPOSTAS, e fundi-los num único ramo de degradação silenciava exatamente o
	# defeito que este caso existe para pegar:
	#
	#   chegadas < aceitas   o serviço não conseguiu segurar o teto no prazo. É
	#                        lentidão de ambiente, DEGRADA declarando — e é o
	#                        único desfecho que a mensagem do aviso descreve.
	#   chegadas > aceitas   com o teto FUNCIONANDO isto é impossível: o
	#                        excedente recebe `503` da própria borda e nunca
	#                        alcança o serviço de trilha. O único caminho que o
	#                        produz é o teto NÃO ter barrado, e ele REPROVA.
	#
	# É o ramo `-gt` que discrimina o teto que não barra: elevar o `limit_conn`
	# acima de ${total} numa afinação futura faria as simultâneas serem todas
	# admitidas, a sondagem sairia do laço com mais chegadas que o teto, e as
	# quatro asserções da distribuição ficariam SEM EXECUTAR — o caso fechava
	# verde, com desfecho 0, sobre a borda desprotegida. Esta é a única prova
	# comportamental do teto (o CT-1193 é estático e não prova que o teto
	# declarado de fato barra), e ela não pode ser silenciada pelo próprio
	# defeito que persegue.
	if [[ "${chegadas}" -gt "${aceitas}" ]]; then
		falhar "(CT-1194) o teto de concorrência NÃO barrou: ${chegadas} das ${total} requisições simultâneas alcançaram o serviço, e o teto declarado é ${aceitas}"
	elif [[ "${chegadas}" -lt "${aceitas}" ]]; then
		aviso "o serviço registrou ${chegadas} requisição(ões) presa(s) de ${aceitas} em ${LIMITE_DE_SONDAGENS_DA_CONCORRENCIA} sondagem(ns) — a DISTRIBUIÇÃO da rodada simultânea do CT-1194 NÃO foi medida"
	else
		afirmar_igual "exatamente ${EXCEDENTES_ALEM_DO_TETO} das ${total} simultâneas são recusadas pela borda, com 503" \
			"${EXCEDENTES_ALEM_DO_TETO}" "$(contar_com_codigo "503" "${medidas[@]}")"
		afirmar_igual "e exatamente ${aceitas} — o teto — são atendidas pelo serviço" \
			"${aceitas}" "$(contar_com_codigo "204" "${medidas[@]}")"
		afirmar_igual "a rodada simultânea tem só esses dois desfechos" \
			"204 503" "$(codigos_distintos "${medidas[@]}")"
		afirmar_igual "a trilha cresceu apenas o teto — o excedente NÃO foi repassado" \
			"$((antes + aceitas))" "${depois}"
	fi

	# --- rodada 2: as MESMAS requisições, em SEQUÊNCIA --------------------- #
	medidas=()
	antes="$(requisicoes_no_servico)"
	for ((indice = 1; indice <= total; indice++)); do
		medidas+=("$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DA_NOTICIA}" \
			"{\"idempotencia\":\"sequencial-${indice}\"}")")
	done
	depois="$(requisicoes_no_servico)"

	afirmar_igual "as MESMAS ${total} requisições, em sequência, têm um único desfecho" \
		"204" "$(codigos_distintos "${medidas[@]}")"
	afirmar_igual "nenhuma das ${total} sequenciais é recusada por concorrência" \
		"0" "$(contar_com_codigo "503" "${medidas[@]}")"
	afirmar_igual "e a trilha cresceu as ${total} — o eixo do teto é concorrência, nunca volume" \
		"$((antes + total))" "${depois}"

	fechar_caso "CT-1194"
}

# =========================================================================== #
# CT-1005 (d) — a configuração que atende a operação não foi tocada.
# =========================================================================== #
retrato_do_legado() {
	local destino="$1"
	find "${DIR_DO_LEGADO}" -maxdepth 3 -type f \
		\( -name '*.conf' -o -name 'docker-compose*.y*ml' \) -readable \
		-exec sha256sum {} + 2>/dev/null | sort >"${destino}" || true
}

retrato_dos_processos_da_borda() {
	local destino="$1"
	pgrep -a nginx 2>/dev/null | sort >"${destino}" || true
}

ct_1005_d() {
	caso "CT-1005 (d)" "a configuração que atende a operação não foi tocada, nem o servidor de borda recarregado"

	if [[ ! -d "${DIR_DO_LEGADO}" ]]; then
		aviso "${DIR_DO_LEGADO} não existe neste host — a intocabilidade do legado NÃO foi verificada"
		fechar_caso "CT-1005 (d)"
		return
	fi

	local pos="${DIR_TRABALHO}/legado-depois.txt"
	retrato_do_legado "${pos}"

	# ÂNCORA ANTIVÁCUO: dois retratos VAZIOS são idênticos, e a comparação
	# aprovaria por não ter olhado para nada.
	local medidos
	medidos="$(grep -c . "${DIR_TRABALHO}/legado-antes.txt" || true)"
	if [[ "${medidos}" -eq 0 ]]; then
		falhar "o retrato do legado não mediu arquivo nenhum — a comparação abaixo seria vácuo"
		fechar_caso "CT-1005 (d)"
		return
	fi
	ok "o retrato do legado mediu ${medidos} arquivo(s) de configuração"

	afirmar_igual "a configuração do legado continua byte a byte igual" "" \
		"$(diff "${DIR_TRABALHO}/legado-antes.txt" "${pos}" || true)"

	# Recarregar o servidor de borda troca os processos de trabalho. Comparar a
	# lista inteira é o que separa "não escrevi nada" de "não mexi em nada".
	if command -v pgrep >/dev/null 2>&1; then
		local processos_depois="${DIR_TRABALHO}/processos-depois.txt"
		# A borda efêmera desta bateria é derrubada ANTES da comparação: ela é
		# nginx também, e apareceria como diferença legítima.
		encerrar_borda_efemera
		local limite=25 tentativa=0
		while [[ "${tentativa}" -lt "${limite}" ]] && pgrep -f "${DIR_TRABALHO}" >/dev/null 2>&1; do
			tentativa=$((tentativa + 1))
			sleep 0.2
		done
		retrato_dos_processos_da_borda "${processos_depois}"

		local processos_medidos
		processos_medidos="$(grep -c . "${DIR_TRABALHO}/processos-antes.txt" || true)"
		if [[ "${processos_medidos}" -eq 0 ]]; then
			aviso "nenhum processo de servidor de borda visível a este usuário — a não-recarga NÃO foi verificada"
		else
			ok "o retrato viu ${processos_medidos} processo(s) do servidor de borda"
			afirmar_igual "nenhum processo do servidor de borda foi trocado (sem recarga)" "" \
				"$(diff "${DIR_TRABALHO}/processos-antes.txt" "${processos_depois}" || true)"
		fi
	else
		aviso "pgrep ausente no host — a não-recarga do servidor de borda NÃO foi verificada"
	fi

	# O instalador não nomeia caminho nenhum do legado: ele escreve UM arquivo
	# com nome próprio, e nada mais.
	# Em COMENTÁRIO ele é nomeado de propósito, e isso é conteúdo: o cabeçalho do
	# instalador declara que o legado segue de pé e que nada dele é tocado. O que
	# não pode existir é linha ATIVA que o alcance.
	afirmar_igual "o instalador não nomeia o diretório do legado em linha ativa" "0" \
		"$(grep -vE '^[[:space:]]*#' "${INSTALADOR}" | grep -c "${DIR_DO_LEGADO}" || true)"

	fechar_caso "CT-1005 (d)"
}

main() {
	printf 'Borda externa da notícia bancária — %s\n' "${RAIZ_REPO}"
	nota "a medição de rede acontece contra uma borda EFÊMERA e isolada (ADR-0006); a instalação na borda real é o passo 1 do rollout, ato do operador"

	# Os retratos do que atende a operação são tirados ANTES de qualquer coisa
	# que este script faça — é o único instante em que eles significam algo.
	retrato_do_legado "${DIR_TRABALHO}/legado-antes.txt"
	retrato_dos_processos_da_borda "${DIR_TRABALHO}/processos-antes.txt"

	ct_1005_a
	ct_1005_b
	ct_1005_c
	# As quatro frentes de abuso REAPROVEITAM a borda que o (c) deixou de pé, e
	# por isso vêm antes do (d) — que é quem a derruba para comparar processos.
	ct_1191
	ct_1192
	ct_1193
	ct_1194
	ct_1005_d

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-notificacao-bancaria: 8/8 frentes aprovadas (CT-1005 a, b, c, d e CT-1191 a CT-1194)\n'
		else
			printf 'verificar-notificacao-bancaria: 8/8 frentes sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${avisos_totais}"
		fi
		exit 0
	fi

	printf 'verificar-notificacao-bancaria: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
