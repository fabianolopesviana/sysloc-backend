#!/usr/bin/env bash
#
# A BORDA PÚBLICA DO APLICATIVO DO CLIENTE — CT-1180 a CT-1190, T9 da fatia
# `publicacao-e-backup`.
#
# Casos cobertos:
#
#   CT-1180  o caminho da API é atendido, e não engolido pelo fallback da página
#            única — medido por rede, com o TIPO DO CONTEÚDO afirmado, mais a
#            sonda que registra o sombreamento deliberado de `/v1/*.map`;
#   CT-1181  o fallback continua servindo as telas, e a precedência instalada
#            NÃO transformou a borda num repasse universal;
#   CT-1182  o contrato morre NA BORDA, nos três endereços, por TLS e em claro,
#            sem repasse ao serviço e sem `3xx`;
#   CT-1183  a aplicação não perdeu nada além do marcador do `D24` — o elenco de
#            rotas fora do prefixo continua com quatro entradas;
#   CT-1184  o cabeçalho de sessão atravessa intacto, e os DOIS `Set-Cookie`
#            chegam separados;
#   CT-1185  a resposta de sessão não é servida de cache;
#   CT-1186  o salto real é declarado — os três cabeçalhos, por igualdade;
#   CT-1187  cabeçalho de origem FORJADO não move o balde do limitador;
#   CT-1188  a instalação recusa gabarito com marcador não substituído, o
#            rendido declara `/v1/` como prefixo LITERAL e nenhuma regex dele
#            sombreia caminho de API, e os artefatos versionados não fixam
#            hostname nem guardam segredo;
#   CT-1188 (b)  a instalação é IDEMPOTENTE — segunda execução não escreve,
#            modo e conteúdo divergentes são corrigidos — e o desfazimento repõe
#            o estado anterior, conteúdo e permissão;
#   CT-1189  o destino do e-mail instalado é igual ao declarado;
#   CT-1190  a conferência do destino do e-mail PODE falhar.
#
# ===========================================================================
# INVARIANTES
# ===========================================================================
#
#   I1  O QUE FAZ A API NÃO CAIR NO FALLBACK É O COMPRIMENTO DO PREFIXO, e não
#       a ordem no arquivo: entre `location` de prefixo o nginx escolhe o MAIS
#       LONGO que casa, e `/v1/` é mais longo que `/`. A ordem foi medida e é
#       INERTE — o que reabre o defeito é (a) estreitar ou remover o bloco
#       `location /v1/`, ou (b) declarar `location` REGEX que case caminho sob
#       `/v1/`, porque regex vence prefixo não-ancorado. É (a) e (b) que o
#       CT-1188 tranca, e é o efeito delas que o CT-1180 mede por rede.
#   I2  TODA asserção de resposta afirma o TIPO DO CONTEÚDO, jamais só o código.
#       O modo de falhar MEDIDO antes desta task é `200` com o corpo errado — um
#       teste de status o aprovaria.
#   I3  A recusa do contrato é DA BORDA, sem repasse. Um `404` do serviço e um
#       `404` da borda são indistinguíveis pelo status; o que os separa é a
#       trilha do lado de dentro, e é ela que esta bateria conta.
#   I4  O eixo de origem é APENSADO, nunca repassado: `X-Real-IP` é sobrescrito
#       pelo endereço observado e `X-Forwarded-For` recebe o observado à
#       direita do que veio. É o que sustenta a metade de aplicação da ADR-0037.
#   I5  O hostname NUNCA é literal no gabarito nem no instalador: ele é decisão
#       operacional do usuário, e continua aberta.
#   I6  O destino do e-mail é AFIRMADO, nunca herdado do provisionamento.
#
# ===========================================================================
# ONDE ISTO EXECUTA — e por que NÃO é a borda que atende a operação
# ===========================================================================
#
# A ADR-0006 é literal: *"a suíte de verificação nunca executa contra o ambiente
# que atende a operação"*. Por isso os casos de rede medem contra uma BORDA
# EFÊMERA E ISOLADA — um nginx próprio, em prefixo descartável, portas altas
# próprias, certificado gerado no arranjo e um serviço de verificação em
# `127.0.0.1`. É medição de rede DE VERDADE, com o binário de verdade e o vhost
# versionado renderizado pelo renderizador REAL do instalador; o que não é de
# verdade é apenas *onde* ela acontece.
#
# ⚠️ ELA NÃO DEPENDE DO TLS PÚBLICO, e isso é desenho. O certificado é gerado no
# arranjo e o `--resolve` aponta para o laço local, de modo que a bateria
# distingue *"o salto da frente ainda não está pronto"* de *"a borda está
# quebrada"*: a segunda reprova aqui, a primeira nem aparece.
#
# ⚠️ A instalação na borda REAL é ato do operador, com privilégio, e NÃO é
# entrega desta bateria — ver o resumo final.
#
# ===========================================================================
# COMO ELA RODA SEM PRIVILÉGIO — e onde o privilégio ainda falta
# ===========================================================================
#
# Tudo o que os dez primeiros casos medem é processo próprio em porta alta,
# diretório descartável e leitura de arquivo versionado. Ela NÃO declara
# exigência de privilégio, e isso é deliberado:
# `deploy/scripts/verificacao/rodar-baterias.sh` classifica a identidade de
# execução por esse padrão no fonte, e uma bateria que o declarasse seria
# executada como superusuário — onde o `mise` não está no caminho e `node`, de
# que a borda efêmera depende, deixa de existir.
#
# O que ela NÃO alcança sem privilégio é UMA frente, e ela degrada com `aviso`
# NOMEADO, sem contar a asserção como aprovada:
#
#   [ambiente-instalado]  `/etc/sysloc/backend.env` é `0600 root:root` e não é
#                         legível por quem executa; `sudo -n` também falha neste
#                         host. É o CT-1189. O PODER daquela asserção não fica
#                         refém do privilégio: o CT-1190 o prova sem privilégio
#                         nenhum, com quatro sondas em diretório descartável.
#
# ⚠️ É PROIBIDO — e é a tentação real — acrescentar em produção qualquer leitor,
# rota, variável ou modo que exponha o destino do e-mail para esta bateria ler
# sem privilégio. O arquivo é `0600` por decisão (ADR-0005, ADR-0032), e
# afrouxá-lo para medir seria trocar a asserção pelo defeito que ela persegue.
#
# ===========================================================================
# O VOCABULÁRIO DE ASSERÇÃO NÃO MORA AQUI
# ===========================================================================
#
# Ele vem de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, carregado por
# `source`. Escrevê-lo como a décima quarta cópia reabriria o `D9 · F0/T2`, que a
# T5 desta fatia acabou de fechar — o `CT-1125` de `verificar-backup.sh` é a rede
# permanente disso, e ele reprova bateria que redeclare qualquer um dos oito
# símbolos ou que não carregue a casa comum.
#
# ===========================================================================
# PROVA DE FALSIFICAÇÃO — permanente, e só onde a asserção é ESTÁTICA
# ===========================================================================
#
# TRÊS asserções desta bateria inspecionam TEXTO, e as três trazem o mutante
# junto, na mesma execução:
#
#   · CT-1183 — dois mutantes da composição raiz (a constante retirada do
#     elenco, e o marcador do `D24` de volta). Sem os dois, uma auditoria que
#     nunca achasse nada aprovaria uma aplicação que perdeu as rotas do
#     contrato — que é exatamente a regressão que esta task existe para NÃO
#     causar;
#   · CT-1188 — a varredura de hostname e de segredo sobre uma cópia do gabarito
#     com as agulhas PLANTADAS. As agulhas são COMPOSTAS em tempo de execução, a
#     partir de fragmentos que não casam sozinhos: escritas por extenso, este
#     arquivo acusaria a si mesmo;
#   · CT-1188 — a auditoria da SELEÇÃO DE `location` sobre o arquivo rendido,
#     com TRÊS mutantes: o prefixo virando igualdade exata, uma `location` regex
#     nova que casa caminho de API, e a regex do mapa REMOVIDA (o antivácuo).
#     Ela substituiu, em 2026-08-26, a asserção de ORDEM TEXTUAL entre os dois
#     blocos — premissa refutada por medição no Gate 2 da T9, e inerte: o nginx
#     escolhe o prefixo MAIS LONGO, não o primeiro escrito.
#
# As demais asserções são COMPORTAMENTAIS (exercitam funções reais e medem rede
# real) e por decisão registrada não se demonstram por reintrodução de defeito.
#
# ⚠️ A varredura de hostname alcança o GABARITO e o INSTALADOR, e NÃO este
# arquivo: é aqui que o destino declarado do e-mail está escrito, e ele é um
# nome de servidor por DECISÃO registrada — não um `server_name` de vhost. O
# complemento exato da varredura é a asserção de que todo `server_name` do
# gabarito é o marcador de substituição, e que não há um segundo.
#
# ===========================================================================
# Contrato de saída
# ===========================================================================
#
#   0  zero falhas E zero degradações — e nenhum outro caminho produz verde.
#   1  reprovou o que esta bateria existe para provar.
#   2  nada reprovou, e HÁ asserção declarada que este host não permitiu medir.
#
# Ferramenta ou estado ausente NUNCA faz o caso passar em silêncio: cada
# degradação sai como `aviso` nomeando o que não foi verificado e o comando que
# o mediria, e o RESUMO FINAL as conta e diz que houve asserção não medida.
#
# ⚠️ O CÓDIGO 2 É O QUE IMPEDE A DEGRADAÇÃO DE SUMIR NO AGREGADOR. Ele decide
# pelo ESTADO (`avisos_totais`), e não por qual frente degradou, de modo que
# toda degradação futura já nasce coberta. Com desfecho `0`,
# `deploy/scripts/verificacao/rodar-baterias.sh` classifica a execução como
# `APROVADA` e o operador lê "tudo provado" onde havia asserção por medir — que
# é justamente o que esta bateria existe para não deixar acontecer. As duas
# baterias irmãs (`verificar-backup.sh` e `verificar-unidades-agendadas.sh`)
# saem `2` na mesma condição, e o agregador o lê como `SAUDE-DA-SUITE`.
#
# Uso: bash deploy/scripts/borda/verificar-borda-do-app.sh
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

# --------------------------------------------------------------------------- #
# Os artefatos sob prova.
# --------------------------------------------------------------------------- #
readonly GABARITO="${RAIZ_REPO}/deploy/nginx/sysloc-app.conf"
readonly INSTALADOR="${RAIZ_REPO}/deploy/scripts/borda/instalar-borda-do-app.sh"

# A composição raiz, de onde saem os caminhos do contrato, o elenco de rotas
# fora do prefixo e o teto de corpo. Os três são LIDOS para conferir coerência:
# medir a borda contra caminhos redigitados aqui seria medi-la contra uma ficção,
# e um endereço novo publicado pelo arcabouço passaria despercebido.
readonly COMPOSICAO_RAIZ="${RAIZ_REPO}/apps/api/src/main.ts"

# De onde sai o prefixo de versão que a borda repassa.
readonly AMBIENTE_DA_API="${RAIZ_REPO}/apps/api/src/configuracao/ambiente.ts"

# --------------------------------------------------------------------------- #
# O que a borda tem de fazer.
# --------------------------------------------------------------------------- #

# O cabeçalho com que o serviço de verificação se identifica. É ele que separa
# "a resposta veio de dentro" de "a resposta veio da borda".
readonly CABECALHO_DO_SERVICO="x-origem-do-servico"
readonly ORIGEM_DO_SERVICO="borda-do-app-de-verificacao"

# O prefixo de versão que a borda repassa. Escrito por extenso: é a TERCEIRA
# declaração dele (a aplicação o publica, o gabarito o repassa, e aqui se
# afirma). Derivá-lo do gabarito poria o artefato sob prova nos dois lados da
# comparação; a COERÊNCIA com a aplicação é asserção à parte, no CT-1188.
readonly PREFIXO_DE_VERSAO_DECLARADO="v1"

# O caminho de DADO que o CT-1180 mede, e o de SESSÃO que o CT-1184 e o CT-1185
# medem. Os dois existem na API; o serviço de verificação atrás da borda responde
# igual a ambos, porque o que está sob prova é o VHOST.
readonly CAMINHO_DE_DADOS="/${PREFIXO_DE_VERSAO_DECLARADO}/imoveis"
readonly CAMINHO_DE_SESSAO="/${PREFIXO_DE_VERSAO_DECLARADO}/auth/sign-in/email"

# Os caminhos de TELA. Eles não existem na API: existem no roteador da página
# única, e é o fallback que os atende. Quatro, e não um, porque um só não
# distingue "o fallback atende" de "o fallback atende ESTE caminho".
readonly CAMINHOS_DE_TELA=(
	"/"
	"/imoveis"
	"/contratos/novo"
	"/relatorios/cobrancas"
)

# Os DOIS `Set-Cookie` que o serviço emite, de valores distintos e conhecidos.
# ⚠️ Dois, e não um, de propósito: o modo de falha conhecido de uma borda é a
# iteração que JUNTA valores repetidos num cabeçalho só, e com um cookie ela
# seria indistinguível do comportamento correto.
readonly COOKIE_DE_SESSAO="sysloc.session_token=valor-de-sonda-do-token; Path=/; HttpOnly; SameSite=Lax"
readonly COOKIE_DE_DADOS="sysloc.session_data=valor-de-sonda-dos-dados; Path=/; HttpOnly; SameSite=Lax"

# A diretiva de não-armazenamento que a resposta de sessão carrega.
readonly NAO_ARMAZENAR="no-store"

# Quantas requisições idênticas o CT-1185 faz. Três, e não duas: com duas, uma
# borda que servisse a SEGUNDA de cache ainda contaria uma entrada nova para a
# primeira, e a conta fecharia por coincidência.
readonly REPETICOES_SEM_CACHE=3

# Os cabeçalhos de origem FORJADOS que o CT-1187 envia, e o que tem de chegar do
# outro lado. Os endereços vêm das faixas reservadas para documentação
# (RFC 5737), que não pertencem a ninguém.
readonly ORIGEM_FORJADA="203.0.113.9"
readonly SALTO_FORJADO="198.51.100.4"
readonly ENDERECO_OBSERVADO="127.0.0.1"

# Teto de corpo declarado no gabarito, e o mesmo valor em bytes na composição
# raiz (`MAIOR_CORPO_ACEITO`). Escritos aqui de propósito: os dois lados da
# comparação precisam de uma terceira declaração, senão a asserção não pode
# falhar.
readonly TETO_DE_CORPO_NA_BORDA="64k"
readonly TETO_DE_CORPO_NO_SERVICO="64 * 1024"

# --------------------------------------------------------------------------- #
# CT-1183 — o que a aplicação NÃO pode ter perdido.
# --------------------------------------------------------------------------- #

# Os dois caminhos do contrato, escritos por extenso: é a TERCEIRA declaração
# deles (a aplicação declara, a borda recusa, e aqui se afirma). Derivá-los do
# arquivo sob prova poria o artefato nos dois lados da comparação.
readonly CAMINHOS_DO_CONTRATO_NA_APLICACAO=(
	"docs"
	"docs/json"
)

# Quantas entradas o elenco de rotas fora do prefixo tem de ter. Quatro: as duas
# de saúde e as duas do contrato.
readonly ENTRADAS_DO_ELENCO_FORA_DO_PREFIXO=4

# O marcador do débito que esta task FECHOU. A asserção é de AUSÊNCIA: ele saiu
# do código e do índice, e um marcador de débito já resolvido é pior que nenhum
# — ele mente sobre o estado do código.
readonly MARCADOR_DO_D24="D24 · F1/T5"

# --------------------------------------------------------------------------- #
# CT-1189 / CT-1190 — o destino do e-mail.
#
# ⚠️ O DESTINO DECLARADO ABAIXO É DECISÃO OPERACIONAL DO USUÁRIO, registrada no
# relatório da fatia no mesmo diff em que esta constante nasceu. Ele não é
# derivável do código, e não se deriva do valor medido: derivá-lo faria a
# asserção CONCORDAR COM QUALQUER HOST que o ambiente viesse a declarar, que é a
# asserção tautológica.
#
# ⚠️ O achado que ela torna visível (scope §5.9): sob `NODE_ENV=production`, o
# ambiente instalado aponta hoje para um CAPTURADOR de desenvolvimento. O modo de
# falhar é silencioso — a Tentativa de envio registra desfecho `entregue` porque
# o servidor local aceitou a mensagem, e ninguém recebe nada. Esta fatia NÃO
# troca o destino: ela entrega a asserção cuja divergência reprova, e a troca
# entra no gate de desinstalação.
#
# ⚠️ CONSEQUÊNCIA DECLARADA, para quem fizer a troca: o `CT-1152` de
# `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` afirma o OUTRO lado
# da mesma chave — que o processo EM EXECUÇÃO aponta para o laço local, que é o
# que impede um envio real a partir de dados de ensaio. As duas asserções são as
# duas pontas do mesmo interruptor, e a troca move as duas NO MESMO MOVIMENTO.
# --------------------------------------------------------------------------- #
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
readonly CHAVE_DO_DESTINO_DO_EMAIL="SMTP_URL"
readonly CHAVE_DO_AMBIENTE_DE_EXECUCAO="NODE_ENV"
readonly AMBIENTE_DE_EXECUCAO_DECLARADO="production"
#
# DÉBITO COM GATILHO — D41 · F7/T9 · registrado 2026-08-26
# (NÃO é uma `DECISÃO FECHADA`: ele agenda o fecho de um ponteiro, e não protege
#  a constante abaixo — que É decisão registrada e não se rebaixa.)
# O QUÊ: o ponteiro da consequência acima é de MÃO ÚNICA. Quem abre esta bateria
#        é avisado de que o `CT-1152` afirma o OUTRO lado da mesma chave; quem
#        abre `deploy/scripts/instalacao/verificar-unidades-agendadas.sh` NÃO é —
#        e é esse o lado que reprova quando o operador trocar o destino.
# QUANDO FECHA: a troca do `SMTP_URL` para o destino real. Não existe valor que
#        satisfaça as duas asserções ao mesmo tempo, e quem fizer a troca move as
#        duas NO MESMO MOVIMENTO — aí o ponteiro recíproco entra lá e este
#        marcador sai daqui.
# POR QUE NÃO AGORA: acrescentá-lo exigiria editar aquela bateria, que está FORA
#        da lista de arquivos declarada desta task, e a asserção do `CT-1152` foi
#        aprovada antes e NÃO se altera.
# ÍNDICE: docs/specs/features/publicacao-e-backup/v1/_run/run-report.md §2, D41
readonly DESTINO_DECLARADO_DO_EMAIL="smtp.systera.com.br:587"

# A frase que TODA degradação carrega, para que o operador nunca fique sem
# saída. Sem o comando, o aviso diz que algo não foi medido e deixa o leitor sem
# saída — que é a forma mais barata de um aviso virar ruído.
readonly MARCA_DO_COMANDO_QUE_MEDIRIA="o comando que a mediria:"
readonly COMANDO_QUE_MEDIRIA_O_AMBIENTE="setfacl -m u:\$(id -un):r ${ARQ_AMBIENTE} (sob sudo, na janela assistida), rodar esta bateria e desfazer com setfacl -x"

# O que faz um token ser NOME DE DOMÍNIO, e não `main.ts` nem `index.html`: o
# último rótulo é um domínio de topo. A lista é fechada de propósito — a forma
# genérica *"dois rótulos separados por ponto"* acusa toda chamada de método e
# toda extensão de arquivo, e uma varredura que grita em tudo é desligada na
# primeira semana.
#
# ⚠️ Se o hostname escolhido pelo usuário usar um domínio de topo fora desta
# lista, ACRESCENTE-O aqui: a lista é a cobertura da varredura, e o que ela não
# nomeia ela não vê.
readonly DOMINIOS_DE_TOPO="com|br|net|org|io|dev|app|cloud|info|co|me|tech|online|xyz|biz|site|store|link|host|systems|services|digital|solutions|com\\.br|net\\.br|org\\.br"

# Limite da sondagem que espera a borda efêmera atender. Nunca `sleep` fixo: o
# que se espera é estado observável, e o limite é declarado.
readonly LIMITE_DA_SUBIDA_DECIMOS=50

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TRABALHO="$(mktemp -d)"
readonly DIR_TRABALHO
PID_DO_SERVICO=""
PREFIXO_DA_BORDA=""
HOSTNAME_EFEMERO=""
PORTA_HTTPS=""
PORTA_HTTP=""
BORDA_DE_PE="nao"

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

# Toda degradação passa por aqui, e por aqui carrega o rótulo da frente e o
# comando que a mediria. É a entrada única — instalada em cada ponto, a marca
# depende de alguém lembrar dela.
degradar() {
	aviso "[$1] $2 — ${MARCA_DO_COMANDO_QUE_MEDIRIA} $3"
}

# =========================================================================== #
# Auxiliares de leitura e contagem.
# =========================================================================== #

# Quantas ocorrências uma varredura devolveu. `grep -c` sobre saída vazia
# contaria 1 (a linha em branco), e a contagem errada apareceria justamente no
# lado em que o esperado é zero.
contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# ⚠️ `carregar_funcao_do_instalador` NÃO mora mais aqui: ela subiu para
# `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, que esta bateria já
# carrega por `source`. Eram TRÊS declarações locais em duas baterias, e elas já
# haviam divergido — a razão medida está na seção do recorte, lá.

# Uma porta livre no laço local, obtida do próprio sistema operacional.
porta_livre() {
	node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});'
}

# O valor de uma constante de cadeia da composição raiz.
valor_da_constante() {
	sed -n "s|^export const $2 = '\([^']*\)';.*|\1|p" "$1" | head -1
}

# Os três endereços do contrato, DERIVADOS da composição raiz — nunca
# redigitados. O terceiro é a versão em YAML, que o arcabouço publica como
# `<caminho>-yaml` a partir do mesmo caminho da página.
caminhos_do_contrato() {
	local arquivo="$1" pagina documento
	pagina="$(valor_da_constante "${arquivo}" CAMINHO_DO_CONTRATO)"
	documento="$(valor_da_constante "${arquivo}" CAMINHO_DO_DOCUMENTO)"
	[[ -n "${pagina}" && -n "${documento}" ]] || return 1
	printf '/%s\n/%s\n/%s-yaml\n' "${pagina}" "${documento}" "${pagina}"
}

# =========================================================================== #
# A varredura de formas proibidas — UMA função, usada pelo controle e pelo
# mutante.
#
# Imprime uma linha `classe:ocorrência` por achado e devolve status 1 quando
# encontra algum. O status é parte do contrato, e não detalhe: uma varredura que
# apenas imprimisse ficaria verde sobre o mutante.
#
#   hostname  token com forma de nome de domínio. Vale para o arquivo INTEIRO,
#             comentário incluso: o hostname é decisão aberta do usuário e não se
#             escreve aqui nem em prosa.
#   segredo   material de chave privada, ou atribuição de senha/token.
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

# =========================================================================== #
# A auditoria da SELEÇÃO DE `location` — UMA função, usada pelo controle e pelos
# mutantes.
#
# ⚠️ ELA EXISTE PORQUE A PREMISSA ANTERIOR ERA FALSA. Até 2026-08-26 esta bateria
# afirmava que o bloco `/v1/` vinha ANTES do fallback no arquivo rendido, e o
# Gate 2 da T9 REFUTOU a premissa por medição: subida uma borda efêmera com o
# fallback declarado primeiro, `GET /v1/imoveis` seguiu devolvendo
# `200 application/json`. Entre `location` de PREFIXO o nginx escolhe o MAIS
# LONGO que casa, *independentemente da ordem em que estão listados* — a ordem no arquivo é
# INERTE. A asserção de linha passava verde nos dois caminhos reais de regressão
# e reprovaria um reordenamento inócuo.
#
# O que governa são duas propriedades, e são estas que esta função audita:
#
#   modificador:<declaração>     `/v1/` declarado com `=`, `~`, `~*` ou `^~`.
#        `= /v1/` casaria só o caminho exato e toda chamada real cairia no
#        fallback; `~ ^/v1/` trocaria a regra de seleção por outra sem que nada
#        no arquivo parecesse errado.
#   sombreia:<regex>:<caminho>   uma `location` REGEX casa um caminho de API.
#        Regex vence casamento de prefixo não-ancorado — é o ÚNICO modo de
#        sombrear o bloco da API sem tocá-lo.
#   sem-regex-de-mapa            NENHUMA regex casa o mapa de fonte sob o
#        prefixo de versão. É o CONTROLE ANTIVÁCUO: sem ele, um arquivo do qual
#        as regex sumissem passaria por não haver o que confrontar. O
#        sombreamento de `/v1/*.map` pelo `~ \.map$` do gabarito é CONHECIDO e
#        deliberado — nenhum caminho de API termina em `.map`, e mapa de fonte
#        não se publica de caminho algum.
#
# Devolve 1 quando encontra algum achado; o status é parte do contrato, e não
# detalhe — uma auditoria que apenas imprimisse ficaria verde sobre o mutante.
# =========================================================================== #

# As `location` REGEX declaradas no arquivo, uma por linha, sem o modificador.
regexes_de_location() {
	sed -n 's|^[[:space:]]*location[[:space:]]\{1,\}~\*\{0,1\}[[:space:]]\{1,\}\(.*[^[:space:]]\)[[:space:]]*{[[:space:]]*$|\1|p' "$1"
}

auditar_selecao_de_location() {
	local arquivo="$1"
	shift
	local caminhos_de_api=("$@")
	local achou=0 declaracao regex caminho casou_o_mapa=0
	local -a regexes=()

	while IFS= read -r declaracao; do
		[[ -n "${declaracao}" ]] || continue
		achou=1
		printf 'modificador:%s\n' "${declaracao}"
	done < <(grep -oE "location[[:space:]]+(=|\^~|~\*?)[[:space:]]*[^[:space:]]*/${PREFIXO_DE_VERSAO_DECLARADO}/[^[:space:]]*" "${arquivo}" || true)

	mapfile -t regexes < <(regexes_de_location "${arquivo}")

	for regex in "${regexes[@]}"; do
		for caminho in "${caminhos_de_api[@]}"; do
			if [[ "${caminho}" =~ ${regex} ]]; then
				achou=1
				printf 'sombreia:%s:%s\n' "${regex}" "${caminho}"
			fi
		done
		if [[ "/${PREFIXO_DE_VERSAO_DECLARADO}/app.js.map" =~ ${regex} ]]; then
			casou_o_mapa=1
		fi
	done

	if [[ "${casou_o_mapa}" -eq 0 ]]; then
		achou=1
		printf 'sem-regex-de-mapa\n'
	fi

	[[ "${achou}" -eq 0 ]]
}

# =========================================================================== #
# A auditoria da composição raiz — CT-1183.
#
# Imprime uma linha por divergência e devolve 1 quando encontra alguma:
#
#   contagem:<medido>:<esperado>   o elenco fora do prefixo mudou de tamanho
#   ausente:<caminho>              um caminho do contrato saiu do elenco
#   marcador:<texto>:<ocorrências> o marcador do débito fechado voltou
# =========================================================================== #
entradas_do_elenco() {
	local linha
	linha="$(sed -n 's|^const ROTAS_FORA_DO_PREFIXO = \[\(.*\)\];$|\1|p' "$1" | head -1)"
	if [[ -z "${linha}" ]]; then
		printf '0'
		return 0
	fi
	printf '%s' "${linha}" | tr ',' '\n' | grep -c .
}

# Os valores do elenco, com os nomes de constante RESOLVIDOS pelo valor que a
# própria composição raiz lhes dá.
valores_do_elenco() {
	local arquivo="$1" linha item valor
	linha="$(sed -n 's|^const ROTAS_FORA_DO_PREFIXO = \[\(.*\)\];$|\1|p' "${arquivo}" | head -1)"
	[[ -n "${linha}" ]] || return 0
	while IFS= read -r item; do
		item="$(printf '%s' "${item}" | sed 's|^[[:space:]]*||; s|[[:space:]]*$||')"
		[[ -n "${item}" ]] || continue
		case "${item}" in
		"'"*"'")
			printf '%s\n' "${item//\'/}"
			;;
		*)
			valor="$(valor_da_constante "${arquivo}" "${item}")"
			if [[ -n "${valor}" ]]; then
				printf '%s\n' "${valor}"
			fi
			;;
		esac
		# ⚠️ `printf '%s\n'`, e não `printf '%s'`: sem a quebra final, o `read`
		# devolve status 1 na ÚLTIMA entrada e o laço termina ANTES do corpo —
		# a última constante do elenco some da lista, e a auditoria acusa
		# ausência onde não há.
	done < <(printf '%s\n' "${linha}" | tr ',' '\n')
}

auditar_composicao_raiz() {
	local arquivo="$1" achou=0 medido valores esperado ocorrencias

	medido="$(entradas_do_elenco "${arquivo}")"
	if [[ "${medido}" != "${ENTRADAS_DO_ELENCO_FORA_DO_PREFIXO}" ]]; then
		printf 'contagem:%s:%s\n' "${medido}" "${ENTRADAS_DO_ELENCO_FORA_DO_PREFIXO}"
		achou=1
	fi

	valores="$(valores_do_elenco "${arquivo}")"
	for esperado in "${CAMINHOS_DO_CONTRATO_NA_APLICACAO[@]}"; do
		if ! printf '%s\n' "${valores}" | grep -qxF "${esperado}"; then
			printf 'ausente:%s\n' "${esperado}"
			achou=1
		fi
	done

	ocorrencias="$(grep -cF "${MARCADOR_DO_D24}" "${arquivo}" || true)"
	if [[ "${ocorrencias}" -ne 0 ]]; then
		printf 'marcador:%s:%s\n' "${MARCADOR_DO_D24}" "${ocorrencias}"
		achou=1
	fi

	[[ "${achou}" -eq 0 ]]
}

# =========================================================================== #
# A conferência do destino do e-mail — CT-1189 e CT-1190.
#
# Imprime uma linha por divergência e devolve 1 quando encontra alguma; imprime
# NADA e devolve 0 quando o ambiente está conforme.
#
# ⚠️ O valor é REDUZIDO a `host:porta` ANTES de qualquer impressão. A cadeia
# carrega credencial — `smtp://usuário:senha@servidor:porta` é forma legítima —,
# e um diagnóstico que ecoasse o valor recusado publicaria a senha na saída da
# bateria. A sonda 4 do CT-1190 mede exatamente isso, com senha plantada.
# =========================================================================== #
destino_reduzido() {
	local valor="$1"
	valor="${valor#*://}"  # fora o esquema
	valor="${valor%%/*}"   # fora o caminho
	valor="${valor##*@}"   # fora usuário e senha
	printf '%s' "${valor}"
}

conferir_destino_do_email() {
	local arquivo="$1" achou=0 ambiente destino
	if [[ ! -r "${arquivo}" ]]; then
		printf 'ambiente ilegível: %s\n' "${arquivo}"
		return 1
	fi

	ambiente="$(tr -d '\r' <"${arquivo}" | sed -n "s|^${CHAVE_DO_AMBIENTE_DE_EXECUCAO}=||p" | head -1)"
	if [[ "${ambiente}" != "${AMBIENTE_DE_EXECUCAO_DECLARADO}" ]]; then
		printf '%s divergente: %s (declarado: %s)\n' \
			"${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${ambiente:-<ausente>}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}"
		achou=1
	fi

	destino="$(tr -d '\r' <"${arquivo}" | sed -n "s|^${CHAVE_DO_DESTINO_DO_EMAIL}=||p" | head -1)"
	if [[ -z "${destino}" ]]; then
		# Falha FECHADA: sem esta perna, uma conferência que lesse a chave errada
		# aprovaria todo host em que o arquivo não a tem.
		printf '%s ausente no ambiente\n' "${CHAVE_DO_DESTINO_DO_EMAIL}"
		return 1
	fi

	destino="$(destino_reduzido "${destino}")"
	if [[ "${destino}" != "${DESTINO_DECLARADO_DO_EMAIL}" ]]; then
		printf 'destino do e-mail divergente: %s (declarado: %s)\n' \
			"${destino}" "${DESTINO_DECLARADO_DO_EMAIL}"
		achou=1
	fi

	[[ "${achou}" -eq 0 ]]
}

# =========================================================================== #
# A borda efêmera.
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

# Faz UMA requisição pela borda efêmera e imprime `codigo|tipo|origem`.
#
#   codigo  o código de resposta; `000` quando não houve resposta HTTP
#   tipo    o PREFIXO do `content-type`, sem o conjunto de caracteres — comparar
#           a cadeia inteira produziria vermelho por razão errada no dia em que a
#           aplicação acrescentasse `; charset=utf-8`
#   origem  o cabeçalho com que o serviço se identifica; vazio significa que a
#           resposta NÃO veio de dentro
#
# Os cabeçalhos completos ficam em `${DIR_TRABALHO}/cabecalhos.txt`, para as
# asserções que precisam de mais de três campos.
requisitar() {
	local metodo="$1" url="$2"
	shift 2
	local cabecalhos="${DIR_TRABALHO}/cabecalhos.txt"
	local codigo=""
	: >"${cabecalhos}"

	local argumentos=(-sS --max-time 10 -o /dev/null -D "${cabecalhos}" -w '%{http_code}'
		--cacert "${PREFIXO_DA_BORDA}/cert.pem"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1"
		--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTP}:127.0.0.1"
		-X "${metodo}")
	if [[ "$#" -gt 0 ]]; then
		argumentos+=("$@")
	fi

	codigo="$(curl "${argumentos[@]}" "${url}" 2>>"${DIR_TRABALHO}/curl.err" || printf '000')"

	printf '%s|%s|%s' "${codigo}" \
		"$(cabecalho_recebido content-type | sed 's|;.*||; s|[[:space:]]*$||')" \
		"$(cabecalho_recebido "${CABECALHO_DO_SERVICO}")"
}

# O valor de um cabeçalho da última resposta. Vazio quando ele não veio.
cabecalho_recebido() {
	grep -i "^$1:" "${DIR_TRABALHO}/cabecalhos.txt" 2>/dev/null |
		tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' | head -1 || true
}

# Todas as linhas de um cabeçalho da última resposta, uma por linha e sem o nome.
todos_os_cabecalhos_recebidos() {
	grep -i "^$1:" "${DIR_TRABALHO}/cabecalhos.txt" 2>/dev/null |
		tr -d '\r' | sed 's|^[^:]*:[[:space:]]*||' || true
}

# O que o SERVIÇO recebeu na última requisição que chegou até ele.
cabecalhos_no_servico() {
	tail -1 "${PREFIXO_DA_BORDA}/cabecalhos-do-servico.log" 2>/dev/null || true
}

# DÉBITO COM GATILHO — D40 · F7/T9 · registrado 2026-08-26
# (NÃO é uma `DECISÃO FECHADA`: ele agenda uma extração, e não protege o que
#  está abaixo.)
# O QUÊ: o acessório de BORDA EFÊMERA — certificado gerado no arranjo, porta
#        livre, serviço de trilha atrás, guarda de isolamento do `listen` e
#        `nginx` em prefixo descartável — nasce aqui como SEGUNDA cópia; a
#        primeira é `deploy/scripts/borda/verificar-notificacao-bancaria.sh`.
#        Endurecer uma deixa a outra para trás.
# QUANDO FECHA: a TERCEIRA borda pública do produto, ou a primeira task
#        autorizada a abrir `verificar-notificacao-bancaria.sh` **para mexer no
#        acessório de borda efêmera**. Aí as duas sobem para
#        `deploy/scripts/borda/acessorios-de-borda.sh`.
#
#        ⚠️ EMENDADO em 2026-08-26 (rodada 3 do Gate 2), e o texto anterior fica
#        registrado: ele dizia "a primeira task autorizada a abrir
#        `verificar-notificacao-bancaria.sh` POR OUTRA RAZÃO". Essa redação
#        disparou LITERALMENTE nesta mesma rodada — a correção do `P2` autorizou
#        abrir aquela bateria — e disparou pela razão ERRADA: a autorização foi
#        para subir `carregar_funcao_do_instalador` à casa comum, que é outro
#        símbolo, em outro arquivo, com outro risco. Fechar o D40 de carona
#        teria significado mover a borda efêmera INTEIRA de duas baterias dentro
#        de um ciclo de correção de gate — exatamente a "correção grande com
#        regressão embutida" que a §5 de `.claude/rules/nao-regressao.md` proíbe.
#        A emenda restringe o gatilho ao que ele sempre quis dizer: autorização
#        para mexer NO ACESSÓRIO, e não para abrir o arquivo por qualquer razão.
#
#        ⚠️ EMENDADO DE NOVO em 2026-08-26 (rodada 2 do Gate 1 da T10), e os
#        DOIS textos anteriores ficam registrados. O gatilho DISPAROU, agora
#        pela razão certa: a T10 mexeu no acessório de borda efêmera da outra
#        bateria — `subir_borda_efemera` ganhou `ARQUIVO_DE_ESPERA` e
#        `ARQUIVO_DE_LIBERACAO`, e o heredoc `servico.mjs` foi reescrito com o
#        modo de espera e dois argumentos novos —, e o `servico.mjs` é item
#        NOMINAL do `O QUÊ` acima ("serviço de trilha atrás"), medido presente
#        nas DUAS baterias. Ele NÃO foi fechado, e a razão é medida: os dois
#        serviços de trilha JÁ divergiram, o modo de espera não tem contraparte
#        na borda que não tem `limit_conn`, e a extração continua sendo mover
#        ~200 linhas de arranjo de rede DENTRO de um ciclo de correção de gate —
#        o mesmo `POR QUE NÃO AGORA` abaixo, agora com uma segunda ocorrência
#        registrada. A próxima task que abrir o acessório herda o débito com
#        DOIS disparos escriturados, e não redecide do zero.
# POR QUE NÃO AGORA: extrair exige mover ~200 linhas de arranjo de rede entre
#        duas baterias — uma delas verde em 148 asserções e sem relação com o
#        que esta rodada corrige. O risco de regressão supera o da segunda
#        cópia, e o Limiar de Três do `CLAUDE.md` continua sem disparar para
#        ESTE símbolo (são duas cópias, não três). ⚠️ Não confunda com o
#        `carregar_funcao_do_instalador`, onde ele disparou de fato — eram TRÊS
#        declarações, e elas JÁ haviam divergido; aquele foi fechado nesta
#        rodada, e a casa comum é
#        `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# ÍNDICE: docs/specs/features/publicacao-e-backup/v1/_run/run-report.md §2, D40
subir_borda_efemera() {
	PREFIXO_DA_BORDA="${DIR_TRABALHO}/borda"
	mkdir -p "${PREFIXO_DA_BORDA}/logs" "${PREFIXO_DA_BORDA}/temp" \
		"${PREFIXO_DA_BORDA}/app/assets" "${PREFIXO_DA_BORDA}/acme"

	# Guarda de sanidade: esta bateria só escreve dentro de um diretório
	# descartável. Se o prefixo escorregar para fora dele, ela para.
	case "${PREFIXO_DA_BORDA}" in
	/tmp/* | /var/tmp/*) : ;;
	*)
		falhar "o prefixo da borda efêmera (${PREFIXO_DA_BORDA}) não está num diretório descartável"
		return 1
		;;
	esac

	# A página única já construída, como a borda a encontraria em produção.
	printf '<!doctype html><html lang="pt-BR"><head><title>Sysloc</title></head><body>pagina-unica-de-sonda</body></html>\n' \
		>"${PREFIXO_DA_BORDA}/app/index.html"
	printf 'console.log("pacote de sonda");\n' >"${PREFIXO_DA_BORDA}/app/assets/app-de-sonda.js"
	printf '{"version":3,"sources":[]}\n' >"${PREFIXO_DA_BORDA}/app/assets/app-de-sonda.js.map"

	HOSTNAME_EFEMERO="borda-do-app-efemera-$$"
	PORTA_HTTPS="$(porta_livre)"
	PORTA_HTTP="$(porta_livre)"

	openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
		-keyout "${PREFIXO_DA_BORDA}/chave.pem" -out "${PREFIXO_DA_BORDA}/cert.pem" \
		-subj "/CN=${HOSTNAME_EFEMERO}" \
		-addext "subjectAltName=DNS:${HOSTNAME_EFEMERO}" >/dev/null 2>&1

	# O serviço de verificação que fica ATRÁS da borda. Ele NÃO é a API: o que
	# está sob prova aqui é o vhost, e o que se precisa do lado de dentro é uma
	# trilha do que atravessou e um registro do que chegou — que é justamente o
	# que a API não daria.
	cat >"${PREFIXO_DA_BORDA}/servico.mjs" <<'SERVICO'
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const [, , porta, trilha, cabecalhosRecebidos, cabecalho, origem, cookieA, cookieB, naoArmazenar] =
  process.argv;

const cabecalhoRecebido = (requisicao, nome) => requisicao.headers[nome] ?? '';

createServer((requisicao, resposta) => {
  appendFileSync(trilha, `${requisicao.method} ${requisicao.url}\n`);
  appendFileSync(
    cabecalhosRecebidos,
    [
      cabecalhoRecebido(requisicao, 'x-real-ip'),
      cabecalhoRecebido(requisicao, 'x-forwarded-for'),
      cabecalhoRecebido(requisicao, 'x-forwarded-proto'),
      cabecalhoRecebido(requisicao, 'host'),
      cabecalhoRecebido(requisicao, 'origin'),
    ].join('|') + '\n',
  );
  resposta.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': naoArmazenar,
    [cabecalho]: origem,
    'set-cookie': [cookieA, cookieB],
  });
  resposta.end(JSON.stringify({ servico: origem }));
}).listen(Number(porta), '127.0.0.1');
SERVICO

	local porta_do_servico
	porta_do_servico="$(porta_livre)"
	: >"${PREFIXO_DA_BORDA}/trilha.log"
	: >"${PREFIXO_DA_BORDA}/cabecalhos-do-servico.log"
	node "${PREFIXO_DA_BORDA}/servico.mjs" "${porta_do_servico}" \
		"${PREFIXO_DA_BORDA}/trilha.log" "${PREFIXO_DA_BORDA}/cabecalhos-do-servico.log" \
		"${CABECALHO_DO_SERVICO}" "${ORIGEM_DO_SERVICO}" \
		"${COOKIE_DE_SESSAO}" "${COOKIE_DE_DADOS}" "${NAO_ARMAZENAR}" \
		>"${PREFIXO_DA_BORDA}/servico.log" 2>&1 &
	PID_DO_SERVICO=$!

	# O vhost sob prova é o VERSIONADO, renderizado pelo renderizador REAL do
	# instalador. Reescrevê-lo aqui mediria uma cópia.
	#
	# ⚠️ As portas vão PREFIXADAS pelo endereço de laço local. Passando só o
	# número, o gabarito rende `listen <porta> ssl;` sem endereço e o nginx liga
	# `0.0.0.0`: a bateria que a ADR-0006 obriga a rodar ISOLADA abriria
	# superfície de rede num host onde o sistema antigo opera.
	# `listen 127.0.0.1:36011 ssl;` é sintaxe válida, o `--resolve` de toda a
	# bateria já aponta para 127.0.0.1, e NADA muda no gabarito versionado nem na
	# borda de produção — lá se continua passando "443" e "80", sem endereço.
	renderizar_vhost "${GABARITO}" "${HOSTNAME_EFEMERO}" \
		"127.0.0.1:${PORTA_HTTPS}" "127.0.0.1:${PORTA_HTTP}" \
		"${PREFIXO_DA_BORDA}/cert.pem" "${PREFIXO_DA_BORDA}/chave.pem" \
		"127.0.0.1:${porta_do_servico}" \
		"${PREFIXO_DA_BORDA}/app" "${PREFIXO_DA_BORDA}/acme" \
		>"${PREFIXO_DA_BORDA}/vhost.conf" || return 1

	# Guarda de sanidade do isolamento, e ela é do ARQUIVO RENDIDO, não da
	# chamada acima: qualquer forma futura de montar a borda que volte a omitir o
	# endereço reprova aqui, e não só esta linha. Igualdade de conjunto sobre as
	# diretivas `listen`, com controle antivácuo — sem ele, um vhost sem `listen`
	# nenhum passaria por "não escuta fora do laço".
	local escutas escutas_totais
	escutas="$(grep -cE '^[[:space:]]*listen[[:space:]]+127\.0\.0\.1:[0-9]+' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	escutas_totais="$(grep -cE '^[[:space:]]*listen[[:space:]]' "${PREFIXO_DA_BORDA}/vhost.conf" || true)"
	if [[ "${escutas_totais}" -eq 0 ]]; then
		falhar "o vhost efêmero não declara 'listen' nenhum — a guarda de isolamento mediria o vácuo"
		return 1
	fi
	if [[ "${escutas}" -ne "${escutas_totais}" ]]; then
		falhar "o vhost efêmero escuta fora do laço local: ${escutas}/${escutas_totais} diretivas 'listen' em 127.0.0.1"
		return 1
	fi

	cat >"${PREFIXO_DA_BORDA}/nginx.conf" <<CONF
worker_processes 1;
pid ${PREFIXO_DA_BORDA}/nginx.pid;
error_log ${PREFIXO_DA_BORDA}/logs/error.log warn;
events { worker_connections 64; }
http {
  # ⚠️ A tabela de tipos é do ARRANJO, e não do vhost. O mime.types do servidor
  # deste host não é legível por quem executa esta bateria, e o que está sob
  # prova é o VHOST — não a tabela de tipos do sistema. Sem ela o nginx serviria
  # TODO arquivo estático como text/plain, e a asserção de tipo do CT-1181
  # mediria o arranjo em vez da borda.
  #
  # ⚠️ SEM CRASE e SEM CIFRÃO neste comentário: ele está DENTRO de um heredoc
  # NÃO citado (<<CONF), que precisa interpolar o prefixo descartável da borda.
  # Ali a crase é substituição de comando e o shell EXECUTA o que estiver entre
  # elas — foi o que produziu duas linhas de erro em stderr a cada execução e o
  # comentário mutilado no arquivo gerado. O cifrão sai pela mesma razão: sob
  # 'set -u', uma variável inexistente aqui aborta a bateria inteira.
  types {
    text/html        html htm;
    text/javascript  js;
    application/json json;
    text/plain       txt;
  }
  default_type application/octet-stream;
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
	local tentativa=0
	while [[ "${tentativa}" -lt "${LIMITE_DA_SUBIDA_DECIMOS}" ]]; do
		if [[ -s "${PREFIXO_DA_BORDA}/nginx.pid" ]] &&
			curl -sS --max-time 2 --cacert "${PREFIXO_DA_BORDA}/cert.pem" \
				--resolve "${HOSTNAME_EFEMERO}:${PORTA_HTTPS}:127.0.0.1" \
				-o /dev/null "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/" >/dev/null 2>&1; then
			# A subida consome a trilha? Não: a raiz é servida pelo fallback, e
			# ela NÃO atravessa. Zerar mesmo assim é o que torna cada contagem
			# desta bateria absoluta em vez de relativa a um arranque.
			: >"${PREFIXO_DA_BORDA}/trilha.log"
			: >"${PREFIXO_DA_BORDA}/cabecalhos-do-servico.log"
			BORDA_DE_PE="sim"
			return 0
		fi
		tentativa=$((tentativa + 1))
		sleep 0.2
	done

	return 1
}

# Pré-condição comum dos casos de rede. Quando ela não vale, o caso degrada com
# `aviso` NOMEADO — nunca passa em silêncio.
borda_disponivel() {
	[[ "${BORDA_DE_PE}" == "sim" ]]
}

# =========================================================================== #
# CT-1180 — o caminho da API é atendido, e não engolido pelo fallback.
#
# INVARIANTE: um pedido ao prefixo de versão devolve DADO, e a asserção afirma o
# TIPO DO CONTEÚDO. É o discriminador do defeito medido antes desta task:
# `200|text/html|` — o estado de então — reprova aqui e PASSARIA num teste que
# olhasse só o código de resposta.
#
# ⚠️ O caso NÃO mede ordem, e não é por ela que o repasse acontece: entre
# `location` de prefixo o nginx escolhe o MAIS LONGO que casa, e `/v1/` é mais
# longo que `/`. O que ele mede é o EFEITO, que é o que importa por rede; as
# duas propriedades que produzem esse efeito — o prefixo literal e a ausência de
# regex que sombreie a API — são trancadas por texto no CT-1188.
#
# É também o CONTROLE ANTIVÁCUO dos casos seguintes: sem ele, uma borda que
# recusasse TUDO passaria em todas as asserções de recusa.
# =========================================================================== #
ct_1180() {
	caso "CT-1180" "o caminho da API é atendido antes do fallback, e a resposta é dado — não página"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1180"
		return
	fi

	local antes depois medida
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DE_DADOS}")"
	depois="$(requisicoes_no_servico)"

	# ⚠️ A asserção do tipo do conteúdo é OBRIGATÓRIA e não substituível pelo
	# código: é ela, e só ela, que separa "veio dado" de "veio a página única".
	afirmar_igual "o caminho da API responde dado, com o cabeçalho do serviço" \
		"200|application/json|${ORIGEM_DO_SERVICO}" "${medida}"
	afirmar_igual "a resposta veio do serviço, e não da borda" "$((antes + 1))" "${depois}"
	afirmar_igual "o serviço recebeu o método e o caminho INTEIROS, sem reescrita" \
		"GET ${CAMINHO_DE_DADOS}" "$(tail -1 "${PREFIXO_DA_BORDA}/trilha.log")"

	# O SOMBREAMENTO CONHECIDO, medido por rede. `~ \.map$` é a única regex do
	# gabarito, e regex vence casamento de prefixo não-ancorado: ela passa à
	# frente de `location /v1/`. Nenhum caminho de API termina em `.map` e mapa
	# de fonte não se publica de caminho algum — o sombreamento é deliberado, e
	# esta sonda é o registro executável dele. Sem ela, o dia em que a regex for
	# alargada só se descobre em produção.
	antes="$(requisicoes_no_servico)"
	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/${PREFIXO_DE_VERSAO_DECLARADO}/app.js.map")"
	depois="$(requisicoes_no_servico)"
	afirmar_igual "sob o prefixo de versão, o mapa de fonte é recusado pela BORDA (sombreamento deliberado)" \
		"404|text/html|" "${medida}"
	afirmar_igual "e o pedido do mapa NÃO foi repassado ao serviço" "${antes}" "${depois}"

	fechar_caso "CT-1180"
}

# =========================================================================== #
# CT-1181 — o fallback continua servindo as telas.
#
# INVARIANTE: a precedência instalada NÃO transformou a borda num repasse
# universal. Sem este caso, um vhost que repassasse TUDO ao serviço passaria no
# CT-1180 e quebraria o aplicativo inteiro.
# =========================================================================== #
ct_1181() {
	caso "CT-1181" "o fallback continua servindo as telas, e nenhuma delas atravessa ao serviço"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1181"
		return
	fi

	local caminho antes depois medida
	for caminho in "${CAMINHOS_DE_TELA[@]}"; do
		antes="$(requisicoes_no_servico)"
		medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "GET ${caminho} é servido pela página única, sem cabeçalho do serviço" \
			"200|text/html|" "${medida}"
		afirmar_igual "GET ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"
	done

	# A fonte da aplicação não é publicada — e ela é servida do MESMO diretório
	# que o fallback, de modo que a recusa é decisão e não ausência de arquivo.
	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/assets/app-de-sonda.js.map")"
	afirmar_igual "o mapa da fonte é recusado, ainda que o arquivo exista" "404|text/html|" "${medida}"
	afirmar_igual "e o arquivo do mapa existe mesmo no diretório publicado" "0" \
		"$([[ -f "${PREFIXO_DA_BORDA}/app/assets/app-de-sonda.js.map" ]] && echo 0 || echo 1)"

	# O asset com hash no nome é servido, e com validade longa.
	medida="$(requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}/assets/app-de-sonda.js")"
	afirmar_igual "o asset é servido pela borda" "200|text/javascript|" "${medida}"
	afirmar_igual "e ele é declarado imutável" "public, max-age=31536000, immutable" \
		"$(cabecalho_recebido cache-control)"

	fechar_caso "CT-1181"
}

# =========================================================================== #
# CT-1182 — o contrato morre NA BORDA, nos três endereços.
#
# INVARIANTE: `/docs`, `/docs/json` e `/docs-yaml` são recusados pela PRÓPRIA
# borda, sem repasse ao serviço.
#
# ⚠️ A recusa tem de ser DA BORDA: um `404` COM o cabeçalho do serviço
# significaria que a requisição atravessou e foi a aplicação que recusou —
# estado diferente, e justamente o que a §5.8 do scope proíbe. Por isso a
# asserção afirma o TRIO inteiro, e não só o código.
#
# ⚠️ Os caminhos são EXTRAÍDOS da composição raiz, nunca redigitados: um endereço
# novo publicado pelo arcabouço passaria despercebido se fossem.
# =========================================================================== #
ct_1182() {
	caso "CT-1182" "o contrato morre na borda, nos três endereços, por TLS e em claro"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1182"
		return
	fi

	local caminhos
	caminhos="$(caminhos_do_contrato "${COMPOSICAO_RAIZ}" || true)"
	# ANTIVÁCUO: extração vazia faria o laço abaixo não rodar, e o caso ficaria
	# verde por não ter medido nada.
	afirmar_igual "a extração dos caminhos do contrato devolveu os TRÊS endereços" \
		"3" "$(contar_ocorrencias "${caminhos}")"
	if [[ "$(contar_ocorrencias "${caminhos}")" -ne 3 ]]; then
		fechar_caso "CT-1182"
		return
	fi
	nota "caminhos extraídos de ${COMPOSICAO_RAIZ##*/}: $(printf '%s' "${caminhos}" | tr '\n' ' ')"

	local caminho metodo antes depois medida
	while IFS= read -r caminho; do
		[[ -n "${caminho}" ]] || continue
		for metodo in GET POST; do
			antes="$(requisicoes_no_servico)"
			medida="$(requisitar "${metodo}" "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${caminho}")"
			depois="$(requisicoes_no_servico)"

			afirmar_igual "${metodo} ${caminho} morre na borda, sem cabeçalho do serviço" \
				"404|text/html|" "${medida}"
			afirmar_igual "${metodo} ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"
		done
	done < <(printf '%s\n' "${caminhos}")

	# Em claro os três também morrem, e sem `3xx`: um redirecionamento diria que
	# o endereço existe do outro lado.
	while IFS= read -r caminho; do
		[[ -n "${caminho}" ]] || continue
		antes="$(requisicoes_no_servico)"
		medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}${caminho}")"
		depois="$(requisicoes_no_servico)"

		afirmar_igual "em claro, GET ${caminho} morre na borda" "404|text/html|" "${medida}"
		afirmar_diferente "e a resposta em claro NÃO é 3xx" "3" "${medida:0:1}"
		afirmar_igual "e nenhum Location é emitido em ${caminho}" "" "$(cabecalho_recebido location)"
		afirmar_igual "em claro, GET ${caminho} NÃO foi repassado ao serviço" "${antes}" "${depois}"
	done < <(printf '%s\n' "${caminhos}")

	# ANTIVÁCUO do bloco em claro: ele NÃO responde 404 a tudo. Uma tela em claro
	# é redirecionada para o TLS, e é isso que faz o 404 dos três ser decisão em
	# vez de efeito colateral de um bloco que recusa qualquer coisa.
	medida="$(requisitar GET "http://${HOSTNAME_EFEMERO}:${PORTA_HTTP}/imoveis")"
	afirmar_igual "em claro, uma TELA é redirecionada para o TLS (antivácuo)" "301|text/html|" "${medida}"
	# ⚠️ Sem porta no destino, e isso é o nginx: `$host` é o nome do Host
	# recebido SEM a porta, e o destino é a porta padrão do TLS — que é
	# exatamente o que se quer em produção.
	afirmar_igual "e o destino do redirecionamento é o mesmo caminho sob TLS" \
		"https://${HOSTNAME_EFEMERO}/imoveis" "$(cabecalho_recebido location)"

	fechar_caso "CT-1182"
}

# =========================================================================== #
# CT-1183 — a aplicação não perdeu nada além do marcador do `D24`.
#
# INVARIANTE: o único delta da composição raiz é a saída do bloco do débito. O
# elenco de rotas fora do prefixo continua com QUATRO entradas, e as duas do
# contrato continuam entre elas.
#
# ⚠️ É a rede contra a tentação mais provável desta task — restringir `/docs*` na
# APLICAÇÃO em vez de na borda. Pareceria mais idiomático, DERRUBARIA as 8 rotas
# `GET /docs*` das 106 da âncora de superfície e REPROVARIA
# `deploy/scripts/instalacao/verificar-fundacao.sh`, que consulta os endereços
# literais inclusive na sub-bateria de recuperação após reinício real.
#
# Asserção ESTÁTICA: os DOIS mutantes são obrigatórios, e rodam aqui.
# =========================================================================== #
ct_1183() {
	caso "CT-1183" "a aplicação não perdeu nada além do marcador do débito fechado"

	if [[ ! -r "${COMPOSICAO_RAIZ}" ]]; then
		falhar "a composição raiz não está legível em ${COMPOSICAO_RAIZ}"
		fechar_caso "CT-1183"
		return
	fi

	# --- controle: a árvore real ----------------------------------------- #
	local codigo=0 achados
	achados="$(auditar_composicao_raiz "${COMPOSICAO_RAIZ}")" || codigo=$?

	afirmar_igual "(controle) o elenco de rotas fora do prefixo tem quatro entradas" \
		"${ENTRADAS_DO_ELENCO_FORA_DO_PREFIXO}" "$(entradas_do_elenco "${COMPOSICAO_RAIZ}")"
	afirmar_igual "(controle) a página do contrato continua declarada" \
		"${CAMINHOS_DO_CONTRATO_NA_APLICACAO[0]}" \
		"$(valor_da_constante "${COMPOSICAO_RAIZ}" CAMINHO_DO_CONTRATO)"
	afirmar_igual "(controle) o documento do contrato continua declarado" \
		"${CAMINHOS_DO_CONTRATO_NA_APLICACAO[1]}" \
		"$(valor_da_constante "${COMPOSICAO_RAIZ}" CAMINHO_DO_DOCUMENTO)"
	afirmar_igual "(controle) o marcador do débito fechado NÃO está mais no código" \
		"0" "$(grep -cF "${MARCADOR_DO_D24}" "${COMPOSICAO_RAIZ}" || true)"
	afirmar_igual "(controle) a auditoria não acusa nada na árvore real" "0" "${codigo}"
	afirmar_igual "(controle) e a lista de divergências é vazia" "" "${achados}"

	# --- mutante 1: a constante do documento sai do elenco ---------------- #
	# Sem ele, uma auditoria que nunca achasse nada aprovaria a aplicação que
	# perdeu a rota do documento — que é a regressão que esta task não pode
	# causar.
	local sandbox="${DIR_TRABALHO}/ct-1183"
	mkdir -p "${sandbox}"
	local mutante_elenco="${sandbox}/sem-documento.ts"
	sed 's|, CAMINHO_DO_DOCUMENTO\]|]|' "${COMPOSICAO_RAIZ}" >"${mutante_elenco}"

	codigo=0
	achados="$(auditar_composicao_raiz "${mutante_elenco}")" || codigo=$?
	afirmar_igual "(mutante 1) o elenco encolhido REPROVA a auditoria" "1" "${codigo}"
	afirmar_igual "(mutante 1) e a contagem medida cai para três" "3" \
		"$(entradas_do_elenco "${mutante_elenco}")"
	afirmar_igual "(mutante 1) e a auditoria NOMEIA o caminho que sumiu" "1" \
		"$(printf '%s\n' "${achados}" | grep -cxF "ausente:${CAMINHOS_DO_CONTRATO_NA_APLICACAO[1]}" || true)"

	# --- mutante 2: o marcador do débito volta ---------------------------- #
	local mutante_marcador="${sandbox}/com-marcador.ts"
	{
		cat "${COMPOSICAO_RAIZ}"
		printf '// %s\n' "${MARCADOR_DO_D24}"
	} >"${mutante_marcador}"

	codigo=0
	achados="$(auditar_composicao_raiz "${mutante_marcador}")" || codigo=$?
	afirmar_igual "(mutante 2) o marcador de volta REPROVA a auditoria" "1" "${codigo}"
	afirmar_igual "(mutante 2) e a auditoria NOMEIA o marcador" "1" \
		"$(printf '%s\n' "${achados}" | grep -cxF "marcador:${MARCADOR_DO_D24}:1" || true)"

	fechar_caso "CT-1183"
}

# =========================================================================== #
# CT-1184 — o cabeçalho de sessão atravessa intacto.
#
# INVARIANTE: os DOIS `Set-Cookie` chegam ao cliente separados e byte a byte
# iguais ao que o serviço emitiu, e a resposta não é armazenável.
#
# ⚠️ Dois cookies, e não um: o modo de falha conhecido é a borda que JUNTA
# valores repetidos num cabeçalho só. Com um cookie ela seria indistinguível do
# comportamento correto — a contagem `2` é o que discrimina, e ela reprova ANTES
# de a comparação byte a byte acontecer.
# =========================================================================== #
ct_1184() {
	caso "CT-1184" "os dois cabeçalhos de sessão atravessam intactos, e a resposta não é armazenável"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1184"
		return
	fi

	local medida cookies
	medida="$(requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DE_SESSAO}")"
	afirmar_igual "o caminho de sessão é atendido pelo serviço" \
		"200|application/json|${ORIGEM_DO_SERVICO}" "${medida}"

	cookies="$(todos_os_cabecalhos_recebidos set-cookie)"
	afirmar_igual "chegam exatamente DOIS cabeçalhos de sessão" "2" "$(contar_ocorrencias "${cookies}")"
	afirmar_igual "o primeiro é byte a byte o que o serviço emitiu" \
		"${COOKIE_DE_SESSAO}" "$(printf '%s\n' "${cookies}" | sed -n '1p')"
	afirmar_igual "o segundo é byte a byte o que o serviço emitiu" \
		"${COOKIE_DE_DADOS}" "$(printf '%s\n' "${cookies}" | sed -n '2p')"

	# A borda declara `no-store` e o serviço também. Afirmar o CONJUNTO de
	# valores distintos, e não a primeira linha, é o que discrimina: uma borda
	# que acrescentasse `max-age` teria dois valores distintos e reprovaria aqui.
	afirmar_igual "todo valor de controle de cache da resposta é '${NAO_ARMAZENAR}'" \
		"${NAO_ARMAZENAR}" \
		"$(todos_os_cabecalhos_recebidos cache-control | sort -u | tr '\n' ' ' | sed 's| *$||')"
	afirmar_igual "nenhum cabeçalho de expiração acompanha a resposta de sessão" "0" \
		"$(contar_ocorrencias "$(todos_os_cabecalhos_recebidos expires)")"
	afirmar_igual "e nenhum cabeçalho de idade de cache acompanha a resposta de sessão" "0" \
		"$(contar_ocorrencias "$(todos_os_cabecalhos_recebidos age)")"

	fechar_caso "CT-1184"
}

# =========================================================================== #
# CT-1185 — a resposta de sessão não é servida de cache.
#
# INVARIANTE: cada requisição de sessão alcança o serviço. Uma borda com cache
# devolveria a segunda e a terceira de dentro dela, e a trilha andaria de N a
# N+1 em vez de N a N+3.
# =========================================================================== #
ct_1185() {
	caso "CT-1185" "cada requisição de sessão alcança o serviço — nada é servido de cache"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1185"
		return
	fi

	local antes depois repeticao primeiros ultimos=""
	antes="$(requisicoes_no_servico)"
	for ((repeticao = 1; repeticao <= REPETICOES_SEM_CACHE; repeticao++)); do
		requisitar POST "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DE_SESSAO}" >/dev/null
		if [[ "${repeticao}" -eq 1 ]]; then
			primeiros="$(todos_os_cabecalhos_recebidos set-cookie)"
		fi
		ultimos="$(todos_os_cabecalhos_recebidos set-cookie)"
	done
	depois="$(requisicoes_no_servico)"

	afirmar_igual "as ${REPETICOES_SEM_CACHE} requisições idênticas alcançaram o serviço, uma a uma" \
		"$((antes + REPETICOES_SEM_CACHE))" "${depois}"
	afirmar_igual "e os cabeçalhos de sessão da última são idênticos aos da primeira" \
		"${primeiros}" "${ultimos}"

	fechar_caso "CT-1185"
}

# =========================================================================== #
# CT-1186 — o salto real é declarado.
#
# INVARIANTE: o serviço recebe o endereço observado e o esquema real. Sem os
# três cabeçalhos, a política da ADR-0037 continua SEM EIXO: o limitador cai num
# balde único por caminho para o produto inteiro, que é o regime que o
# `D27 · F1/T6` registrava.
# =========================================================================== #
ct_1186() {
	caso "CT-1186" "o salto real é declarado — os três cabeçalhos de origem chegam ao serviço"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1186"
		return
	fi

	requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DE_DADOS}" >/dev/null

	local recebidos
	recebidos="$(cabecalhos_no_servico)"
	afirmar_igual "o endereço observado chega como salto real" \
		"${ENDERECO_OBSERVADO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f1)"
	afirmar_igual "a cadeia de origem chega com o endereço observado" \
		"${ENDERECO_OBSERVADO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f2)"
	afirmar_igual "o esquema real chega declarado" \
		"https" "$(printf '%s' "${recebidos}" | cut -d'|' -f3)"
	afirmar_igual "e o nome do host atendido chega intacto" \
		"${HOSTNAME_EFEMERO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f4)"

	fechar_caso "CT-1186"
}

# =========================================================================== #
# CT-1187 — cabeçalho de origem FORJADO não move o balde do limitador.
#
# INVARIANTE: `X-Real-IP` é SOBRESCRITO pelo endereço observado, e
# `X-Forwarded-For` é APENSADO — o observado fica à DIREITA do que veio.
#
# ⚠️ É o fecho do `D39 · F7/T8`. Uma borda que REPASSASSE a cadeia do cliente
# faria do termo mais à direita um valor escolhido por quem chama, e o teto do
# limitador viraria evadível por rotação de cabeçalho — PIOR que o regime
# anterior ao eixo existir, em que a cadeia resolvia para nulo e todos caíam num
# balde compartilhado, mas não evadível.
# =========================================================================== #
ct_1187() {
	caso "CT-1187" "cabeçalho de origem forjado não escolhe o balde do limitador"

	if ! borda_disponivel; then
		degradar borda-efemera "a borda efêmera não está de pé — a medição de rede NÃO foi feita" \
			"bash deploy/scripts/borda/verificar-borda-do-app.sh num host com nginx, curl, openssl e node no caminho"
		fechar_caso "CT-1187"
		return
	fi

	requisitar GET "https://${HOSTNAME_EFEMERO}:${PORTA_HTTPS}${CAMINHO_DE_DADOS}" \
		-H "X-Forwarded-For: ${ORIGEM_FORJADA}" \
		-H "X-Real-IP: ${SALTO_FORJADO}" >/dev/null

	local recebidos
	recebidos="$(cabecalhos_no_servico)"
	afirmar_igual "o salto real forjado é SOBRESCRITO pelo endereço observado" \
		"${ENDERECO_OBSERVADO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f1)"
	afirmar_igual "a cadeia forjada é APENSADA, com o observado à direita" \
		"${ORIGEM_FORJADA}, ${ENDERECO_OBSERVADO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f2)"
	afirmar_diferente "e o salto real NÃO é o valor que o cliente escolheu" \
		"${SALTO_FORJADO}" "$(printf '%s' "${recebidos}" | cut -d'|' -f1)"

	fechar_caso "CT-1187"
}

# =========================================================================== #
# CT-1188 — a instalação recusa gabarito com marcador não substituído, e os
# artefatos versionados não fixam hostname nem guardam segredo.
#
# INVARIANTE: gabarito meio substituído NÃO vira configuração aceita. Ele é
# sintaticamente válido para o nginx e atende o hostname errado — falha
# silenciosa que só aparece quando o cliente não alcança o produto.
#
# As funções exercitadas são as do INSTALADOR REAL, carregadas do arquivo:
# reescrevê-las aqui mediria uma cópia, e um instalador com o defeito de volta
# passaria.
# =========================================================================== #
ct_1188() {
	caso "CT-1188" "a instalação recusa gabarito meio substituído, e os artefatos não fixam hostname nem segredo"

	local arquivo
	for arquivo in "${GABARITO}" "${INSTALADOR}"; do
		if [[ ! -r "${arquivo}" ]]; then
			falhar "artefato ilegível: ${arquivo}"
		fi
	done
	if [[ "${falhas_caso}" -ne 0 ]]; then
		fechar_caso "CT-1188"
		return
	fi

	# ÂNCORA ANTIVÁCUO: varredura sobre arquivo vazio devolve ausência, que é
	# exatamente o resultado esperado — e aprovaria por não ter olhado.
	local linhas
	linhas="$(cat "${GABARITO}" "${INSTALADOR}" | grep -c . || true)"
	if [[ "${linhas}" -lt 200 ]]; then
		falhar "os dois artefatos somam ${linhas} linha(s) de conteúdo — a varredura não teria o que examinar, e o verde abaixo seria vácuo"
		fechar_caso "CT-1188"
		return
	fi
	ok "os dois artefatos somam ${linhas} linha(s) — a varredura tem o que examinar"

	local codigo achados
	for arquivo in "${GABARITO}" "${INSTALADOR}"; do
		codigo=0
		achados="$(varrer_formas_proibidas "${arquivo}" hostname segredo)" || codigo=$?
		afirmar_igual "nem hostname nem segredo em ${arquivo##*/}" "0" "$(contar_ocorrencias "${achados}")"
		afirmar_igual "a varredura não acusa nada em ${arquivo##*/}" "0" "${codigo}"
		[[ -n "${achados}" ]] && printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	done

	# A varredura por forma tem um teto: ela só vê os domínios de topo que
	# nomeia. Esta asserção é o complemento EXATO dela — todo `server_name` do
	# gabarito é o marcador, e não existe um segundo com qualquer outro valor.
	afirmar_igual "todo server_name do gabarito é o marcador de substituição" "2" \
		"$(grep -cE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DO_APP__;$' "${GABARITO}" || true)"
	afirmar_igual "o gabarito não declara server_name de nenhuma outra forma" "0" \
		"$(grep -E '^[[:space:]]*server_name' "${GABARITO}" |
			grep -cvE '^[[:space:]]*server_name[[:space:]]+__HOSTNAME_DO_APP__;$' || true)"

	# ⚠️ Sem tradução de origem: o paliativo que existia na borda do painel foi
	# removido com o fecho do `D23 · F1/T8`, e reintroduzi-lo aqui criaria a
	# segunda cópia do que acabou de ser morto.
	afirmar_igual "o gabarito NÃO reescreve a origem do cliente" "0" \
		"$(grep -cE '^[[:space:]]*proxy_set_header[[:space:]]+(Origin|Referer)[[:space:]]' "${GABARITO}" || true)"
	afirmar_igual "e não declara mapa de tradução de origem" "0" \
		"$(grep -cE '^[[:space:]]*map[[:space:]]+\$http_(origin|referer)' "${GABARITO}" || true)"

	# ⚠️ O eixo de origem, na fonte: a cadeia é APENSADA, nunca repassada, e o
	# salto real é o endereço observado. O CT-1187 o mede por rede; aqui se fixa
	# a FORMA, que é o que a próxima borda vai copiar.
	afirmar_igual "o gabarito apensa a cadeia de origem em vez de repassá-la" "1" \
		"$(grep -cE '^[[:space:]]*proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;$' "${GABARITO}" || true)"
	afirmar_igual "e o gabarito NÃO repassa a cadeia recebida do cliente" "0" \
		"$(grep -cE '^[[:space:]]*proxy_set_header X-Forwarded-For \$http_x_forwarded_for;$' "${GABARITO}" || true)"
	afirmar_igual "o salto real é o endereço observado pelo próprio servidor" "1" \
		"$(grep -cE '^[[:space:]]*proxy_set_header X-Real-IP \$remote_addr;$' "${GABARITO}" || true)"
	afirmar_igual "e nenhuma diretiva de reescrita de origem de rede é declarada" "0" \
		"$(grep -cE '^[[:space:]]*(real_ip_header|set_real_ip_from|real_ip_recursive)[[:space:]]' "${GABARITO}" || true)"

	# ------------------------------------------------------------------- #
	# PROVA DE FALSIFICAÇÃO — a MESMA varredura, sobre uma cópia com as duas
	# agulhas plantadas, precisa achar as duas e devolver status de falha.
	#
	# As agulhas são COMPOSTAS AQUI, a partir de fragmentos que não casam
	# sozinhos: escritas por extenso, a varredura acusaria este arquivo.
	# ------------------------------------------------------------------- #
	local sandbox="${DIR_TRABALHO}/ct-1188"
	mkdir -p "${sandbox}"
	local mutante="${sandbox}/mutante.conf"
	local agulha_hostname agulha_segredo
	agulha_hostname="$(printf '%s.%s.%s.%s' 'app' 'exemplo' 'com' 'br')"
	agulha_segredo="$(printf -- '-----%s %s %s-----' 'BEGIN' 'PRIVATE' 'KEY')"

	cp "${GABARITO}" "${mutante}"
	{
		printf 'server_name %s;\n' "${agulha_hostname}"
		printf '# %s\n' "${agulha_segredo}"
	} >>"${mutante}"

	codigo=0
	achados="$(varrer_formas_proibidas "${mutante}" hostname segredo)" || codigo=$?
	afirmar_igual "o mutante REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação acusa as duas classes" "2" "$(contar_ocorrencias "${achados}")"
	# As classes são fixadas por IGUALDADE contra a agulha plantada, e não por
	# "não-vazio": a agulha é conteúdo CONHECIDO, e afirmar só a presença
	# aprovaria uma varredura que acusasse a classe certa pelo motivo errado.
	afirmar_igual "a classe hostname nomeia a agulha plantada" \
		"hostname:${agulha_hostname}" \
		"$(printf '%s\n' "${achados}" | grep '^hostname:' || true)"
	afirmar_igual "a classe segredo nomeia a agulha plantada" \
		"segredo:${agulha_segredo}" \
		"$(printf '%s\n' "${achados}" | grep '^segredo:' || true)"

	# ------------------------------------------------------------------- #
	# A RENDERIZAÇÃO — as funções REAIS do instalador.
	# ------------------------------------------------------------------- #
	local fn
	local -a funcoes_do_instalador=(renderizar_vhost hostname_bem_formado caminho_bem_formado)
	for fn in "${funcoes_do_instalador[@]}"; do
		if ! carregar_funcao_do_instalador "${fn}"; then
			falhar "não consegui carregar '${fn}' de ${INSTALADOR} — sem ela a tabela ficaria sem SUT e passaria vazia"
			fechar_caso "CT-1188"
			return
		fi
	done
	ok "as ${#funcoes_do_instalador[@]} funções de instalação carregadas de ${INSTALADOR##*/}"

	local sonda="${sandbox}/sonda"
	mkdir -p "${sonda}" "${sonda}/app" "${sonda}/acme"
	local hostname_de_sonda="borda-de-sonda"
	local rendido="${sonda}/rendido.conf"

	codigo=0
	renderizar_vhost "${GABARITO}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" >"${rendido}" || codigo=$?

	afirmar_igual "a renderização do gabarito íntegro sai 0" "0" "${codigo}"
	afirmar_igual "nenhum marcador sobra no renderizado" "0" \
		"$(grep -cE '__[A-Z0-9_]+__' "${rendido}" || true)"
	afirmar_igual "o renderizado escuta TLS na porta informada" "listen 443 ssl;" \
		"$(grep -oE 'listen 443 ssl;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado atende o hostname informado" "server_name ${hostname_de_sonda};" \
		"$(grep -oE "server_name ${hostname_de_sonda};" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado aponta para a API no laço local" "proxy_pass http://127.0.0.1:3000;" \
		"$(grep -oE 'proxy_pass http://127\.0\.0\.1:3000;' "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado serve a página única da raiz informada" "root ${sonda}/app;" \
		"$(grep -oE "root ${sonda}/app;" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado serve o desafio da raiz informada" "root ${sonda}/acme;" \
		"$(grep -oE "root ${sonda}/acme;" "${rendido}" | head -1 || true)"
	afirmar_igual "o renderizado fixa o piso de TLS" "ssl_protocols TLSv1.2 TLSv1.3;" \
		"$(grep -oE 'ssl_protocols TLSv1\.2 TLSv1\.3;' "${rendido}" | head -1 || true)"

	# ------------------------------------------------------------------- #
	# O QUE GOVERNA A SELEÇÃO DA `location` — e por que NÃO é a ordem.
	#
	# A razão medida está no docblock de `auditar_selecao_de_location`. Aqui
	# ficam o controle e os TRÊS mutantes: a auditoria é ESTÁTICA (inspeciona o
	# texto do rendido), e por isso a prova de falsificação é obrigatória e
	# permanente — `.claude/rules/testing-stack.md`.
	# ------------------------------------------------------------------- #
	local -a caminhos_de_api=(
		"${CAMINHO_DE_DADOS}"
		"${CAMINHO_DE_SESSAO}"
		"/${PREFIXO_DE_VERSAO_DECLARADO}/cobrancas/00000000-0000-4000-8000-000000000000"
	)

	afirmar_igual "o renderizado declara o bloco do prefixo de versão" "1" \
		"$(grep -c "^[[:space:]]*location /${PREFIXO_DE_VERSAO_DECLARADO}/ {" "${rendido}" || true)"
	afirmar_igual "(controle) a seleção de \`location\` do rendido não tem achado algum" "" \
		"$(auditar_selecao_de_location "${rendido}" "${caminhos_de_api[@]}" || true)"
	afirmar_igual "(controle) e a auditoria devolve 0 sobre o rendido íntegro" "0" \
		"$(auditar_selecao_de_location "${rendido}" "${caminhos_de_api[@]}" >/dev/null && echo 0 || echo 1)"
	# O conjunto das regex, por IGUALDADE: uma regex nova entra em silêncio se o
	# que se afirmar for só a ausência de sombreamento dos caminhos listados.
	afirmar_igual "o rendido declara UMA \`location\` regex, e é a do mapa de fonte" \
		'\.map$' "$(regexes_de_location "${rendido}" | tr '\n' ' ' | sed 's| $||')"

	# --- os TRÊS mutantes, em `mktemp -d`, um por caminho real de regressão -- #
	local m_igualdade="${sonda}/m-igualdade.conf"
	local m_regex_api="${sonda}/m-regex-api.conf"
	local m_sem_regex="${sonda}/m-sem-regex.conf"
	local achados_no_mutante

	# (1) o prefixo vira IGUALDADE EXATA: só `/v1/` casaria, e toda chamada real
	#     cairia no fallback da página única.
	sed "s|^\([[:space:]]*\)location /${PREFIXO_DE_VERSAO_DECLARADO}/ {|\1location = /${PREFIXO_DE_VERSAO_DECLARADO}/ {|" \
		"${rendido}" >"${m_igualdade}"
	achados_no_mutante="$(auditar_selecao_de_location "${m_igualdade}" "${caminhos_de_api[@]}" || true)"
	afirmar_igual "(mutante 1) a auditoria acusa o modificador de igualdade exata" "1" \
		"$(printf '%s\n' "${achados_no_mutante}" |
			grep -c "^modificador:location = /${PREFIXO_DE_VERSAO_DECLARADO}/" || true)"
	afirmar_igual "(mutante 1) e a auditoria devolve 1" "1" \
		"$(auditar_selecao_de_location "${m_igualdade}" "${caminhos_de_api[@]}" >/dev/null && echo 0 || echo 1)"

	# (2) uma `location` REGEX nova que casa caminho de API. É o caminho de
	#     regressão que a asserção de ORDEM não alcançava: o bloco `/v1/`
	#     continua ali, inteiro e na mesma posição, e deixa de ser escolhido.
	sed "s|^\([[:space:]]*\)location ~ |\1location ~ ^/${PREFIXO_DE_VERSAO_DECLARADO}/ {\n\1\treturn 404;\n\1}\n\n\1location ~ |" \
		"${rendido}" >"${m_regex_api}"
	achados_no_mutante="$(auditar_selecao_de_location "${m_regex_api}" "${caminhos_de_api[@]}" || true)"
	afirmar_igual "(mutante 2) a auditoria acusa o sombreamento dos TRÊS caminhos de API" \
		"${#caminhos_de_api[@]}" \
		"$(printf '%s\n' "${achados_no_mutante}" |
			grep -c "^sombreia:\^/${PREFIXO_DE_VERSAO_DECLARADO}/:" || true)"
	afirmar_igual "(mutante 2) e a auditoria devolve 1" "1" \
		"$(auditar_selecao_de_location "${m_regex_api}" "${caminhos_de_api[@]}" >/dev/null && echo 0 || echo 1)"

	# (3) ANTIVÁCUO: a regex do mapa some. Sem esta perna, um rendido sem regex
	#     alguma passaria em (2) por não haver o que confrontar.
	sed '/^[[:space:]]*location ~ /,+2d' "${rendido}" >"${m_sem_regex}"
	achados_no_mutante="$(auditar_selecao_de_location "${m_sem_regex}" "${caminhos_de_api[@]}" || true)"
	afirmar_igual "(mutante 3) sem regex alguma, a auditoria acusa o vácuo" "1" \
		"$(printf '%s\n' "${achados_no_mutante}" | grep -cxF 'sem-regex-de-mapa' || true)"
	afirmar_igual "(mutante 3) e a auditoria devolve 1" "1" \
		"$(auditar_selecao_de_location "${m_sem_regex}" "${caminhos_de_api[@]}" >/dev/null && echo 0 || echo 1)"

	# NEGATIVO: gabarito com marcador ALFABÉTICO que ninguém substitui.
	local gabarito_com_sobra="${sonda}/com-sobra.conf"
	{
		cat "${GABARITO}"
		printf '# %s\n' "__PORTA_QUE_NINGUEM_SUBSTITUI__"
	} >"${gabarito_com_sobra}"
	codigo=0
	renderizar_vhost "${gabarito_com_sobra}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" >/dev/null 2>"${sonda}/sobra.err" || codigo=$?
	afirmar_igual "gabarito com marcador remanescente é RECUSADO" "1" "${codigo}"
	afirmar_igual "e a recusa NOMEIA o marcador que sobrou" "__PORTA_QUE_NINGUEM_SUBSTITUI__" \
		"$(grep -oE '__[A-Z0-9_]+__' "${sonda}/sobra.err" | head -1 || true)"

	# NEGATIVO: marcador com DÍGITO. O par é o que discrimina — o alfabético já
	# era pego antes. Sem dígito na classe, um marcador futuro atravessa e chega
	# a /etc meio renderizado, e o defeito nasce mudo.
	local gabarito_com_digito="${sonda}/com-digito.conf"
	{
		printf '# %s\n' "__PORTA_8080__"
		cat "${GABARITO}"
	} >"${gabarito_com_digito}"
	codigo=0
	renderizar_vhost "${gabarito_com_digito}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" >/dev/null 2>"${sonda}/digito.err" || codigo=$?
	afirmar_igual "marcador com DÍGITO não substituído é RECUSADO" "1" "${codigo}"
	afirmar_igual "e a recusa NOMEIA o marcador com dígito" "__PORTA_8080__" \
		"$(grep -oE '__[A-Z0-9_]+__' "${sonda}/digito.err" | head -1 || true)"

	# NEGATIVO: valor de configuração que QUEBRA o `sed`. Sem a conferência do
	# status, o `sed` morto deixava o renderizado VAZIO, o guarda de marcador
	# remanescente passava por vacuidade e a função devolvia 0 — o vhost vazio
	# atravessa `nginx -t`, e a borda saía instalada sem atender.
	local rendido_quebrado="${sonda}/quebrado.conf"
	codigo=0
	renderizar_vhost "${GABARITO}" 'bor|da' "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" \
		>"${rendido_quebrado}" 2>"${sonda}/quebrado.err" || codigo=$?
	afirmar_igual "valor que quebra o 'sed' faz a renderização RECUSAR" "1" "${codigo}"
	afirmar_igual "e nada sai pela saída padrão quando ela recusa" "0" \
		"$(wc -c <"${rendido_quebrado}")"

	# NEGATIVO da outra metade do guarda: render que sai com status 0 e conteúdo
	# mutilado. O gabarito de sonda não tem marcador nenhum, logo o guarda de
	# marcador remanescente o aprova — o que o recusa é a PLAUSIBILIDADE.
	local gabarito_mutilado="${sonda}/mutilado.conf"
	printf '# gabarito sem servidor nenhum\n' >"${gabarito_mutilado}"
	codigo=0
	renderizar_vhost "${gabarito_mutilado}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" >/dev/null 2>"${sonda}/mutilado.err" || codigo=$?
	afirmar_igual "render sem 'server {' é RECUSADO ainda que o 'sed' tenha saído 0" "1" "${codigo}"
	afirmar_igual "e a recusa diz que o render é implausível" "vhost renderizado implausível:" \
		"$(grep -oE 'vhost renderizado implausível:' "${sonda}/mutilado.err" | head -1 || true)"

	# --- forma dos valores que viram DIRETIVA do nginx -------------------- #
	# O valor aceito com mais de um rótulo é COMPOSTO a partir de fragmentos,
	# pela mesma razão das agulhas: escrito por extenso, a varredura de hostname
	# acusaria ESTE arquivo.
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
		degradar composicao-raiz "${COMPOSICAO_RAIZ} não está legível — a coerência do teto de corpo NÃO foi verificada" \
			"execute a partir de um clone íntegro do repositório"
	fi

	# O prefixo que a borda repassa é o que a aplicação de fato publica — senão
	# esta bateria mediria a borda contra uma ficção.
	if [[ -r "${AMBIENTE_DA_API}" ]]; then
		afirmar_igual "o prefixo repassado pela borda é o que a aplicação publica" \
			"export const PREFIXO_DE_VERSAO = '${PREFIXO_DE_VERSAO_DECLARADO}';" \
			"$(grep -E "^export const PREFIXO_DE_VERSAO" "${AMBIENTE_DA_API}" | head -1 || true)"
	else
		degradar ambiente-da-api "${AMBIENTE_DA_API} não está legível — a coerência do prefixo NÃO foi verificada" \
			"execute a partir de um clone íntegro do repositório"
	fi

	fechar_caso "CT-1188"
}

# =========================================================================== #
# CT-1188 (b) — a instalação é IDEMPOTENTE, e o desfazimento repõe o estado
# anterior. Exercita as funções REAIS do instalador.
#
# INVARIANTE: instalar duas vezes tem o efeito de instalar uma; e a escrita que
# não chega a ser validada é desfeita ao estado exato de antes — conteúdo E
# permissão.
#
# POR QUE ELE EXISTE, e por que separado do CT-1188: aquele prova que gabarito
# meio substituído NÃO vira configuração aceita; este prova o que acontece
# DEPOIS que o render é aceito. São as duas metades da ADR-0005 (*"instalação
# idempotente"*), e a segunda nasceu sem asserção alguma — o instalador
# carregava três funções aqui e as outras onze nunca eram exercitadas.
#
# O RISCO NÃO É TEÓRICO, e está escrito no próprio instalador:
#
#   · `modo_igual` compara em BASE 8 e não por grafia. Com o recorte de texto
#     (`${modo#0}`), `0044` viraria `044` contra o `44` do `stat`, o arquivo
#     seria julgado divergente e REESCRITO em toda execução — idempotência
#     quebrada em SILÊNCIO, com recarga a cada corrida numa borda COMPARTILHADA
#     com o sistema que atende a operação hoje;
#   · `restaurar_destino` é o caminho que devolve o vhost anterior quando o
#     `nginx -t` global recusa. Quebrado, a borda de produção fica com
#     configuração inválida instalada, e o `reload` seguinte — inclusive o do
#     BOOT — a carrega.
#
# QUAL ASSERÇÃO DISCRIMINA CADA CLASSE (todas COMPORTAMENTAIS — exercitam o SUT
# e observam o efeito; nenhuma inspeciona texto, logo nenhuma pede mutante):
#
#   idempotência da ESCRITA  ...  "a segunda instalação NÃO escreve" == JA-OK,
#        mais o carimbo `%y %z %s` idêntico antes e depois: uma publicação
#        incondicional devolve `CRIADO` e move o carimbo. ⚠️ `%y %z` (resolução
#        do sistema de arquivos), e não `%Y %Z` (segundo inteiro) — ver a razão
#        no ponto da asserção;
#   ATOMICIDADE da publicação  ...  nenhum resto `*.novo` no diretório, nas duas
#        escritas (instalação e desfazimento), mais a contagem de arquivos do
#        diretório: um `mv` ausente deixaria o vizinho para trás;
#   idempotência do MODO     ...  `modo_igual 44 0044` verdadeiro E
#        `modo_igual 0044 644` falso: o recorte de texto reprova na primeira,
#        e uma comparação que aprovasse tudo reprova na segunda;
#   correção do MODO frouxo  ...  destino em 0600 DIVERGE e volta a 644;
#   correção do CONTEÚDO     ...  destino adulterado DIVERGE e volta a `cmp -s`;
#   desfazimento COM anterior ... o destino fica byte a byte igual ao backup, e
#        com a permissão ANTERIOR (600) — não a do produto (644);
#   desfazimento SEM anterior ... o destino é REMOVIDO: repor 0 byte deixaria um
#        vhost vazio que atravessa `nginx -t` e não atende;
#   validação isolada        ...  o par render válido (0) / diretiva inexistente
#        (1): sem o negativo, uma validação que aprovasse tudo passaria;
#   precedência              ...  o antivácuo (ninguém declara ⇒ REPROVA) mais o
#        rival que ordena ANTES;
#   porta da API             ...  o valor da unidade versionada, e a unidade sem
#        a chave REPROVANDO em vez de adivinhar;
#   estado no PROCESSO       ...  arquivo anterior aos workers (0) contra
#        recém-criado (1), e o inexistente em 2 — "não decidi" nunca é "não";
#   `include` do diretório   ...  direto (0), transitivo (0), ausente (1) e
#        ilegível (2), que é o código que separa não-decidir de decidir que não;
#   ambiente ambíguo         ...  chave repetida ACUSA nomeando-a, e o arquivo
#        limpo não acusa (antivácuo).
# =========================================================================== #
ct_1188_b() {
	caso "CT-1188 (b)" "a instalação é idempotente, corrige modo e conteúdo divergentes, e desfaz a escrita não validada (funções reais do instalador)"

	local fn
	local -a funcoes_do_instalador=(
		renderizar_vhost modo_igual vhost_diverge publicar_atomicamente
		posicionar_vhost restaurar_destino validar_vhost_isolado
		vhost_declara_hostname conferir_precedencia_do_vhost
		porta_da_api_na_unidade servidor_ja_carregou alvos_de_include
		configuracao_inclui_diretorio chaves_repetidas_no_ambiente
		valor_no_arquivo_de_ambiente
	)
	for fn in "${funcoes_do_instalador[@]}"; do
		if ! carregar_funcao_do_instalador "${fn}"; then
			falhar "(b) não consegui carregar '${fn}' de ${INSTALADOR} — sem ela a tabela ficaria sem SUT e passaria vazia"
			fechar_caso "CT-1188 (b)"
			return
		fi
	done
	ok "(b) as ${#funcoes_do_instalador[@]} funções de instalação carregadas de ${INSTALADOR##*/}"

	# ⚠️ TUDO abaixo escreve em `${DIR_TRABALHO}`, jamais em `/etc`: o destino, o
	# diretório de vhosts, a arena da disputa e a árvore de configuração são
	# descartáveis, e a bateria não instala nada em host nenhum.
	local sonda="${DIR_TRABALHO}/ct-1188-b"
	mkdir -p "${sonda}/app" "${sonda}/acme" "${sonda}/vhosts"

	local hostname_de_sonda="borda-de-sonda"
	local rendido="${sonda}/rendido.conf"
	local codigo=0

	# O material do certificado é gerado ANTES do render porque a validação
	# isolada abaixo o LÊ: o `nginx -t` recusa um vhost cujo certificado não
	# existe, e a recusa viria da ausência do arquivo em vez do que está sob
	# prova.
	local material_do_certificado="sim"
	if command -v openssl >/dev/null 2>&1; then
		openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
			-keyout "${sonda}/chave.pem" -out "${sonda}/cert.pem" \
			-subj "/CN=${hostname_de_sonda}" >/dev/null 2>&1 || material_do_certificado="nao"
	else
		material_do_certificado="nao"
	fi

	renderizar_vhost "${GABARITO}" "${hostname_de_sonda}" "443" "80" \
		"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
		"${sonda}/app" "${sonda}/acme" >"${rendido}" || codigo=$?
	afirmar_igual "(b) a origem da instalação foi renderizada" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then
		falhar "(b) sem origem renderizada o resto do caso mediria o vácuo"
		fechar_caso "CT-1188 (b)"
		return
	fi

	# ------------------------------------------------------------------- #
	# A comparação de modo — por VALOR em base 8, nunca por grafia.
	# ------------------------------------------------------------------- #
	afirmar_igual "(b) modo 0644 é igual ao 644 que o stat devolve" "0" \
		"$(modo_igual "644" "0644" && echo 0 || echo 1)"
	afirmar_igual "(b) modo 0044 é igual ao 44 que o stat devolve" "0" \
		"$(modo_igual "44" "0044" && echo 0 || echo 1)"
	afirmar_igual "(b) e 0044 NÃO é 644 (controle negativo)" "1" \
		"$(modo_igual "0044" "644" && echo 0 || echo 1)"
	afirmar_igual "(b) e 600 continua diferente de 0644 (controle negativo)" "1" \
		"$(modo_igual "600" "0644" && echo 0 || echo 1)"

	# ------------------------------------------------------------------- #
	# A idempotência em si — primeira execução escreve, segunda não toca.
	# ------------------------------------------------------------------- #
	local destino="${sonda}/vhosts/000-sysloc-app.conf"

	afirmar_igual "(b) destino ausente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "(b) a primeira instalação escreve" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "(b) o destino ficou com o conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"
	afirmar_igual "(b) o destino ficou com o modo declarado" "644" "$(stat -c '%a' "${destino}")"

	# O carimbo é o que separa "devolveu JA-OK" de "devolveu JA-OK E não
	# escreveu": uma publicação incondicional que imprimisse `JA-OK` moveria o
	# carimbo e reprovaria aqui.
	#
	# ⚠️ É `%y %z` (com a RESOLUÇÃO DO SISTEMA DE ARQUIVOS), e não `%Y %Z` (o
	# segundo inteiro), desde 2026-08-26. Com granularidade de segundo, uma
	# reescrita ocorrida dentro do MESMO segundo — que é o caso normal aqui,
	# porque as duas chamadas são consecutivas — não moveria o valor, e o
	# carimbo não discriminaria o que este comentário diz que ele discrimina.
	# Medido neste host: `ext4`, carimbo com nanossegundo. Onde o sistema de
	# arquivos NÃO guardar sub-segundo, `%y` degrada para o mesmo poder de
	# `%Y` — e o caso NÃO fica sem rede: `vhost_diverge` devolvendo 1 e
	# `posicionar_vhost` devolvendo `JA-OK`, logo acima, são a outra metade e
	# não dependem de relógio algum.
	local carimbo_antes carimbo_depois
	carimbo_antes="$(stat -c '%y %z %s' "${destino}")"
	afirmar_igual "(b) destino idêntico NÃO diverge" "1" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "(b) a segunda instalação NÃO escreve" "JA-OK" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	carimbo_depois="$(stat -c '%y %z %s' "${destino}")"
	afirmar_igual "(b) o arquivo não foi reescrito na segunda execução" \
		"${carimbo_antes}" "${carimbo_depois}"

	# --- divergência por MODO e por CONTEÚDO ------------------------------ #
	chmod 0600 "${destino}"
	afirmar_igual "(b) modo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "(b) a instalação corrige o modo" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "(b) o modo voltou ao declarado" "644" "$(stat -c '%a' "${destino}")"

	printf '# alteração feita na cópia instalada\n' >>"${destino}"
	afirmar_igual "(b) conteúdo divergente DIVERGE" "0" \
		"$(vhost_diverge "${rendido}" "${destino}" 0644 && echo 0 || echo 1)"
	afirmar_igual "(b) a instalação restaura o conteúdo versionado" "CRIADO" \
		"$(posicionar_vhost "${rendido}" "${destino}" 0644)"
	afirmar_igual "(b) o destino voltou ao conteúdo renderizado" "0" \
		"$(cmp -s "${rendido}" "${destino}" && echo 0 || echo 1)"

	# A publicação é ATÔMICA — `install` no vizinho `.novo`, depois `mv -f`, que
	# dentro do mesmo sistema de arquivos é `rename(2)`. O EFEITO já é afirmado
	# pelas asserções acima (conteúdo, modo e o veredito `CRIADO`/`JA-OK`, todos
	# preservados pela troca de forma); o que falta afirmar é o RESTO. Um `mv`
	# que não acontecesse, ou um vizinho publicado fora do diretório do destino,
	# deixaria o `.novo` para trás — lixo no diretório de vhosts,
	# indistinguível de uma instalação interrompida, e um segundo arquivo que o
	# operador teria de decidir se apaga. Três publicações já rodaram acima; o
	# diretório tem de ter exatamente UM arquivo.
	afirmar_igual "(b) nenhum resto '.novo' sobra no diretório de vhosts" "0" \
		"$(find "${sonda}/vhosts" -maxdepth 1 -name '*.novo' | grep -c . || true)"
	afirmar_igual "(b) e o diretório tem exatamente o vhost publicado" "1" \
		"$(find "${sonda}/vhosts" -maxdepth 1 -type f | grep -c . || true)"

	# ------------------------------------------------------------------- #
	# O DESFAZIMENTO — o que devolve a borda ao estado anterior quando o
	# `nginx -t` global recusa o conjunto. As variáveis do instalador são
	# fixadas num SUBSHELL: a bateria não pode herdar `DIR_DOS_VHOSTS` nem
	# `ESCRITA_PENDENTE` para dentro do processo dela.
	# ------------------------------------------------------------------- #
	local dir_restauro="${sonda}/restauro"
	local nome_do_vhost_de_sonda="000-sysloc-app.conf"
	local backup_anterior="${sonda}/backup-anterior.conf"
	mkdir -p "${dir_restauro}"
	printf 'conteudo anterior de terceiro\n' >"${backup_anterior}"

	(
		erro() { :; }
		DIR_DOS_VHOSTS="${dir_restauro}"
		NOME_DO_VHOST="${nome_do_vhost_de_sonda}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO="${backup_anterior}"
		MODO_ANTERIOR_DO_DESTINO="600"
		DESTINO_TINHA_ARQUIVO="sim"
		printf 'vhost novo que sera desfeito\n' >"${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
		restaurar_destino
	) >/dev/null 2>&1 || true

	afirmar_igual "(b) a restauração repõe o conteúdo anterior, byte a byte" "0" \
		"$(cmp -s "${backup_anterior}" "${dir_restauro}/${nome_do_vhost_de_sonda}" && echo 0 || echo 1)"
	afirmar_igual "(b) e repõe a PERMISSÃO anterior, não a do produto" "600" \
		"$(stat -c '%a' "${dir_restauro}/${nome_do_vhost_de_sonda}")"
	afirmar_igual "(b) e o desfazimento também não deixa resto '.novo'" "0" \
		"$(find "${dir_restauro}" -maxdepth 1 -name '*.novo' | grep -c . || true)"

	# O par que discrimina: quando NÃO havia arquivo antes, desfazer é REMOVER.
	# Uma restauração que repusesse sempre deixaria aqui um vhost vazio — que
	# atravessa `nginx -t` sem reclamar e não atende ninguém.
	(
		erro() { :; }
		DIR_DOS_VHOSTS="${dir_restauro}"
		NOME_DO_VHOST="${nome_do_vhost_de_sonda}"
		MODO_DO_VHOST="0644"
		BACKUP_DO_DESTINO=""
		MODO_ANTERIOR_DO_DESTINO=""
		DESTINO_TINHA_ARQUIVO="nao"
		printf 'vhost escrito onde NAO havia nada\n' >"${DIR_DOS_VHOSTS}/${NOME_DO_VHOST}"
		restaurar_destino
	) >/dev/null 2>&1 || true

	afirmar_igual "(b) sem arquivo anterior, o desfazimento REMOVE o que foi escrito" "1" \
		"$([[ -f "${dir_restauro}/${nome_do_vhost_de_sonda}" ]] && echo 0 || echo 1)"

	# ------------------------------------------------------------------- #
	# A validação isolada — o `nginx -t` em prefixo efêmero, que é o que
	# apanha erro de sintaxe ANTES de qualquer escrita em /etc.
	# ------------------------------------------------------------------- #
	if command -v nginx >/dev/null 2>&1 && command -v node >/dev/null 2>&1 &&
		[[ "${material_do_certificado}" == "sim" ]]; then
		# ⚠️ O render validado aqui escuta em PORTA ALTA e no LAÇO LOCAL, e a
		# razão é medida: `nginx -t` não confere só a sintaxe — ele faz o `bind`
		# das portas declaradas. Sem privilégio, `listen 443` reprova com
		# `Permission denied` e a asserção mediria o privilégio de quem executa
		# em vez do vhost. O endereço explícito é a mesma guarda de isolamento
		# de `subir_borda_efemera`: sem ele, a validação abriria porta em TODAS
		# as interfaces de um host onde o sistema antigo opera. O que está sob
		# prova — as diretivas do gabarito — é idêntico nos dois renders.
		local rendido_em_porta_alta="${sonda}/rendido-porta-alta.conf"
		codigo=0
		renderizar_vhost "${GABARITO}" "${hostname_de_sonda}" \
			"127.0.0.1:$(porta_livre)" "127.0.0.1:$(porta_livre)" \
			"${sonda}/cert.pem" "${sonda}/chave.pem" "127.0.0.1:3000" \
			"${sonda}/app" "${sonda}/acme" >"${rendido_em_porta_alta}" || codigo=$?
		afirmar_igual "(b) o render para a validação isolada saiu 0" "0" "${codigo}"

		codigo=0
		validar_vhost_isolado "${rendido_em_porta_alta}" "${sonda}/validacao" \
			>/dev/null 2>"${sonda}/validacao.err" || codigo=$?
		afirmar_igual "(b) o vhost renderizado passa na validação isolada do nginx" "0" "${codigo}"
		[[ "${codigo}" -ne 0 ]] && sed 's/^/          /' "${sonda}/validacao.err" >&2

		# O negativo, sem o qual uma validação que aprovasse tudo passaria.
		local vhost_invalido="${sonda}/invalido.conf"
		printf 'server {\n\tdiretiva_que_nao_existe sim;\n}\n' >"${vhost_invalido}"
		codigo=0
		validar_vhost_isolado "${vhost_invalido}" "${sonda}/validacao-invalida" >/dev/null 2>&1 || codigo=$?
		afirmar_igual "(b) vhost com diretiva inexistente é RECUSADO pela validação" "1" "${codigo}"
	else
		degradar validacao-isolada "nginx, node ou openssl ausente — a validação isolada do vhost NÃO foi exercitada" \
			"instale nginx, node e openssl e rode 'bash deploy/scripts/borda/verificar-borda-do-app.sh'"
	fi

	# ------------------------------------------------------------------- #
	# A DISPUTA de `server_name` — perder é invisível: o `nginx -t` passa, o
	# servidor sobe, e o aplicativo do cliente deixa de ser atendido.
	# ------------------------------------------------------------------- #
	local arena="${sonda}/arena"
	local alvo_da_disputa="borda-em-disputa"
	mkdir -p "${arena}"

	# ANTIVÁCUO primeiro: sem NENHUM declarante a conferência precisa REPROVAR,
	# senão ela aprovaria justamente o caso em que o vhost não foi escrito.
	printf 'server {\n\tserver_name outro-nome-qualquer;\n}\n' >"${arena}/500-alheio.conf"
	afirmar_igual "(b) sem NENHUM declarante, a precedência REPROVA (antivácuo)" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"

	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/${nome_do_vhost_de_sonda}"
	afirmar_igual "(b) sozinho no diretório, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"

	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/zz-rival.conf"
	afirmar_igual "(b) com rival que ordena DEPOIS, o nosso vhost VENCE" "0" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "(b) e a lista nomeia os dois, na ordem de carga" "${nome_do_vhost_de_sonda} zz-rival.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" | tr '\n' ' ' | sed 's| $||' || true)"

	printf 'server {\n\tserver_name %s;\n}\n' "${alvo_da_disputa}" >"${arena}/000-antes.conf"
	afirmar_igual "(b) com rival que ordena ANTES, a precedência REPROVA" "1" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "(b) e o primeiro da lista é o rival, não o nosso" "000-antes.conf" \
		"$(conferir_precedencia_do_vhost "${arena}" "${nome_do_vhost_de_sonda}" "${alvo_da_disputa}" | head -1 || true)"

	# A declaração é por TOKEN: `server_name sub.X` NÃO declara X.
	printf 'server {\n\tserver_name sub.%s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token.conf"
	afirmar_igual "(b) 'server_name sub.X' NÃO declara X (comparação por token)" "1" \
		"$(vhost_declara_hostname "${sonda}/token.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"
	printf 'server {\n\tserver_name outro %s;\n}\n' "${alvo_da_disputa}" >"${sonda}/token2.conf"
	afirmar_igual "(b) 'server_name outro X' DECLARA X (lista de nomes)" "0" \
		"$(vhost_declara_hostname "${sonda}/token2.conf" "${alvo_da_disputa}" && echo 0 || echo 1)"

	# ------------------------------------------------------------------- #
	# A porta da API é DERIVADA da unidade versionada — não adivinhada.
	# ------------------------------------------------------------------- #
	local unidade="${RAIZ_REPO}/deploy/systemd/sysloc-api.service"
	if [[ -r "${unidade}" ]]; then
		afirmar_igual "(b) a porta da API é derivada da unidade versionada" \
			"$(sed -n 's|^Environment=PORT=\([0-9]\{1,\}\)$|\1|p' "${unidade}" | head -1)" \
			"$(porta_da_api_na_unidade "${unidade}")"
	else
		degradar unidade-da-api "${unidade} não está legível — a derivação da porta NÃO foi verificada" \
			"execute a partir de um clone íntegro do repositório"
	fi
	# Sem esta perna, uma unidade sem a linha faria a instalação adivinhar a
	# porta e a borda apontaria para lugar nenhum.
	printf '[Service]\nEnvironment=NODE_ENV=production\n' >"${sonda}/sem-porta.service"
	afirmar_igual "(b) unidade SEM a porta REPROVA em vez de adivinhar" "1" \
		"$(porta_da_api_na_unidade "${sonda}/sem-porta.service" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "(b) e não imprime porta nenhuma" "" \
		"$(porta_da_api_na_unidade "${sonda}/sem-porta.service" || true)"

	# ------------------------------------------------------------------- #
	# Estado convergente no DISCO não é estado convergente no PROCESSO.
	# ------------------------------------------------------------------- #
	local antigo="${sonda}/antigo.conf" recente="${sonda}/recente.conf"
	printf 'x\n' >"${antigo}"
	touch -d '2020-01-01' "${antigo}"
	printf 'x\n' >"${recente}"
	if ps -C nginx -o args= 2>/dev/null | grep -q 'worker process'; then
		afirmar_igual "(b) arquivo ANTERIOR aos workers: o servidor já o carregou" "0" \
			"$(servidor_ja_carregou "${antigo}" && echo 0 || echo $?)"
		afirmar_igual "(b) arquivo POSTERIOR aos workers: NÃO carregado — recarregar" "1" \
			"$(servidor_ja_carregou "${recente}" && echo 0 || echo $?)"
	else
		degradar servidor-em-execucao "não há worker de nginx neste host — o segundo sinal do P05 NÃO foi exercitado" \
			"suba um nginx neste host e rode 'bash deploy/scripts/borda/verificar-borda-do-app.sh'"
	fi
	afirmar_igual "(b) arquivo inexistente: NÃO se decide (2), nunca 'recarregue'" "2" \
		"$(servidor_ja_carregou "${sonda}/nao-existe.conf" && echo 0 || echo $?)"

	# ------------------------------------------------------------------- #
	# O `include` do diretório de vhosts — o vhost instalado onde o servidor
	# não lê é o modo de falha mais caro de diagnosticar: ele existe e não
	# atende.
	# ------------------------------------------------------------------- #
	local arv="${sonda}/nginx"
	mkdir -p "${arv}/vhosts" "${arv}/confd"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/vhosts" >"${arv}/direto.conf"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/vhosts" >"${arv}/confd/painel.conf"
	printf 'http {\n  include %s/*.conf;\n}\n' "${arv}/confd" >"${arv}/transitivo.conf"
	printf 'http {\n  include %s/outro/*.conf;\n}\n' "${arv}" >"${arv}/ausente.conf"
	afirmar_igual "(b) include DIRETO do diretório de vhosts é reconhecido" "0" \
		"$(configuracao_inclui_diretorio "${arv}/direto.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "(b) include TRANSITIVO (um nível) também é reconhecido" "0" \
		"$(configuracao_inclui_diretorio "${arv}/transitivo.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "(b) configuração que NÃO inclui o diretório reprova com 1" "1" \
		"$(configuracao_inclui_diretorio "${arv}/ausente.conf" "${arv}/vhosts" && echo 0 || echo $?)"
	afirmar_igual "(b) configuração ILEGÍVEL devolve 2 — não decidir não é decidir que não" "2" \
		"$(configuracao_inclui_diretorio "${arv}/nao-existe.conf" "${arv}/vhosts" && echo 0 || echo $?)"

	# ------------------------------------------------------------------- #
	# O arquivo de ambiente — atribuição repetida é AMBIGUIDADE, e se recusa.
	# O systemd resolve pela ÚLTIMA e um leitor ingênuo pela PRIMEIRA: a borda
	# seria instalada apontando para um certificado e o serviço subiria com
	# outro, sem nada acusar.
	# ------------------------------------------------------------------- #
	local ambiente_limpo="${sonda}/limpo.env" ambiente_duplo="${sonda}/duplo.env"
	printf 'HOSTNAME_DO_APP=a.exemplo\nRAIZ_DO_APLICATIVO=/var/www/app\n' >"${ambiente_limpo}"
	printf 'HOSTNAME_DO_APP=primeiro\nRAIZ_DO_APLICATIVO=/var/www/app\nHOSTNAME_DO_APP=ultimo\n' >"${ambiente_duplo}"
	afirmar_igual "(b) ambiente sem repetição NÃO acusa (antivácuo)" "1" \
		"$(chaves_repetidas_no_ambiente "${ambiente_limpo}" >/dev/null && echo 0 || echo 1)"
	afirmar_igual "(b) ambiente com chave repetida ACUSA, nomeando a chave" "HOSTNAME_DO_APP" \
		"$(chaves_repetidas_no_ambiente "${ambiente_duplo}" || true)"

	# Fim de linha do Windows e espaço à direita não entram no valor — ele vira
	# caminho de certificado e diretiva do vhost.
	local ambiente_crlf="${sonda}/crlf.env"
	printf 'HOSTNAME_DO_APP=crlf.exemplo\r\nRAIZ_DO_APLICATIVO=/var/www/app   \r\n' >"${ambiente_crlf}"
	afirmar_igual "(b) o valor lido não carrega CR" "crlf.exemplo" \
		"$(valor_no_arquivo_de_ambiente "${ambiente_crlf}" HOSTNAME_DO_APP)"
	afirmar_igual "(b) nem espaço à direita" "/var/www/app" \
		"$(valor_no_arquivo_de_ambiente "${ambiente_crlf}" RAIZ_DO_APLICATIVO)"
	afirmar_igual "(b) chave ausente REPROVA em vez de devolver vazio aprovado" "1" \
		"$(valor_no_arquivo_de_ambiente "${ambiente_crlf}" CHAVE_QUE_NAO_EXISTE >/dev/null && echo 0 || echo 1)"

	fechar_caso "CT-1188 (b)"
}

# =========================================================================== #
# CT-1189 — o destino do e-mail instalado é igual ao declarado.
#
# INVARIANTE: sob `NODE_ENV=production`, o destino que o ambiente instalado
# declara é IGUAL ao destino declarado nesta bateria. Divergência REPROVA
# nomeando os dois valores — o endereço do capturador de desenvolvimento é
# reprovação explícita, nunca degradação.
#
# ⚠️ O valor é lido do ARQUIVO DE AMBIENTE, que descreve a PRÓXIMA partida. É
# objeto diferente do `environ` do processo em execução, que o `CT-1152` de
# `verificar-unidades-agendadas.sh` lê: o arquivo diz para onde o produto VAI
# enviar depois do próximo reinício, e o processo diz para onde ele envia agora.
#
# ⚠️ Ele é `0600 root:root`, e neste host `sudo -n` também falha. Sem privilégio
# a asserção DEGRADA com `aviso` nomeado — jamais passa em silêncio —, e o PODER
# dela não fica refém disso: o CT-1190 o prova sem privilégio nenhum.
# =========================================================================== #
ct_1189() {
	caso "CT-1189" "o destino do e-mail do ambiente instalado é igual ao declarado"

	nota "destino declarado para o produto publicado: ${DESTINO_DECLARADO_DO_EMAIL} (decisão operacional registrada no relatório da fatia)"

	if [[ ! -r "${ARQ_AMBIENTE}" ]]; then
		degradar ambiente-instalado \
			"${ARQ_AMBIENTE} não é legível por quem executa — o destino do e-mail do ambiente instalado NÃO foi medido" \
			"${COMANDO_QUE_MEDIRIA_O_AMBIENTE}"
		fechar_caso "CT-1189"
		return
	fi

	local diagnostico
	diagnostico="$(conferir_destino_do_email "${ARQ_AMBIENTE}" || true)"
	afirmar_igual "o ambiente instalado declara produção e o destino declarado" "" "${diagnostico}"

	fechar_caso "CT-1189"
}

# =========================================================================== #
# CT-1190 — a conferência do destino do e-mail PODE falhar.
#
# INVARIANTE: a conferência aprova o ambiente correto, reprova o do capturador
# NOMEANDO os dois valores, não aprova por vacuidade quando a chave está
# ausente, e NUNCA imprime a cadeia crua — que carrega credencial.
#
# ⚠️ É a prova de falsificação obrigatória, e o que dá valor ao CT-1189: sem ela,
# num host sem privilégio o CT-1189 emitiria `aviso` e ninguém saberia se a
# asserção É CAPAZ de reprovar. Ela roda SEM privilégio, de propósito.
# =========================================================================== #
ct_1190() {
	caso "CT-1190" "a conferência do destino do e-mail pode falhar, e não vaza a cadeia crua"

	local sondas="${DIR_TRABALHO}/ct-1190"
	mkdir -p "${sondas}"

	local codigo diagnostico

	# --- sonda 1: o ambiente conforme ------------------------------------ #
	printf '%s=%s\n%s=smtp://%s\n' \
		"${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}" \
		"${CHAVE_DO_DESTINO_DO_EMAIL}" "${DESTINO_DECLARADO_DO_EMAIL}" >"${sondas}/conforme.env"
	codigo=0
	diagnostico="$(conferir_destino_do_email "${sondas}/conforme.env")" || codigo=$?
	afirmar_igual "(sonda 1) o ambiente conforme é APROVADO" "0" "${codigo}"
	afirmar_igual "(sonda 1) e não produz diagnóstico algum" "" "${diagnostico}"

	# --- sonda 2: o capturador de desenvolvimento ------------------------ #
	# É o estado medido em produção hoje (scope §5.9). Ele REPROVA, nomeando os
	# dois valores — o medido e o declarado.
	local destino_do_capturador
	destino_do_capturador="$(printf '%s:%s' '127.0.0.1' '1025')"
	printf '%s=%s\n%s=smtp://%s\n' \
		"${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}" \
		"${CHAVE_DO_DESTINO_DO_EMAIL}" "${destino_do_capturador}" >"${sondas}/capturador.env"
	codigo=0
	diagnostico="$(conferir_destino_do_email "${sondas}/capturador.env")" || codigo=$?
	afirmar_igual "(sonda 2) o destino do capturador REPROVA" "1" "${codigo}"
	afirmar_igual "(sonda 2) e a reprovação nomeia os DOIS valores" \
		"destino do e-mail divergente: ${destino_do_capturador} (declarado: ${DESTINO_DECLARADO_DO_EMAIL})" \
		"${diagnostico}"

	# --- sonda 3: a chave ausente ---------------------------------------- #
	# Sem esta perna, uma conferência que lesse a chave errada aprovaria todo
	# host em que o arquivo não a tem — falha ABERTA, e silenciosa.
	printf '%s=%s\n' "${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}" \
		>"${sondas}/sem-chave.env"
	codigo=0
	diagnostico="$(conferir_destino_do_email "${sondas}/sem-chave.env")" || codigo=$?
	afirmar_igual "(sonda 3) a chave ausente REPROVA — falha fechada" "1" "${codigo}"
	afirmar_igual "(sonda 3) e a reprovação diz que a chave não está no ambiente" \
		"${CHAVE_DO_DESTINO_DO_EMAIL} ausente no ambiente" "${diagnostico}"

	# --- sonda 4: credencial na cadeia ----------------------------------- #
	# Controle positivo de não-vazamento, como a ADR-0032 manda: a ausência se
	# prova por MEDIÇÃO DA SAÍDA REAL, e não por leitura do código.
	local senha_plantada
	senha_plantada="$(printf '%s-%s-%s' 'segredo' 'plantado' 'de-controle')"
	printf '%s=%s\n%s=smtp://%s:%s@%s\n' \
		"${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}" \
		"${CHAVE_DO_DESTINO_DO_EMAIL}" 'usuario' "${senha_plantada}" \
		"${DESTINO_DECLARADO_DO_EMAIL}" >"${sondas}/com-credencial.env"
	codigo=0
	diagnostico="$(conferir_destino_do_email "${sondas}/com-credencial.env" 2>&1)" || codigo=$?
	afirmar_igual "(sonda 4) a cadeia com credencial, no destino declarado, é APROVADA" "0" "${codigo}"
	afirmar_igual "(sonda 4) e a senha plantada NÃO aparece na saída completa" "0" \
		"$(printf '%s' "${diagnostico}" | grep -cF "${senha_plantada}" || true)"

	# E a mesma cadeia com credencial, apontando para o capturador, REPROVA sem
	# ecoar a senha: é o par que discrimina "não vaza porque aprovou" de "não
	# vaza porque reduz antes de imprimir".
	printf '%s=%s\n%s=smtp://%s:%s@%s\n' \
		"${CHAVE_DO_AMBIENTE_DE_EXECUCAO}" "${AMBIENTE_DE_EXECUCAO_DECLARADO}" \
		"${CHAVE_DO_DESTINO_DO_EMAIL}" 'usuario' "${senha_plantada}" \
		"${destino_do_capturador}" >"${sondas}/credencial-divergente.env"
	codigo=0
	diagnostico="$(conferir_destino_do_email "${sondas}/credencial-divergente.env" 2>&1)" || codigo=$?
	afirmar_igual "(sonda 4-b) a cadeia com credencial e destino divergente REPROVA" "1" "${codigo}"
	afirmar_igual "(sonda 4-b) e a senha plantada continua fora da saída" "0" \
		"$(printf '%s' "${diagnostico}" | grep -cF "${senha_plantada}" || true)"

	fechar_caso "CT-1190"
}

main() {
	printf 'Borda pública do aplicativo do cliente — %s\n' "${RAIZ_REPO}"
	nota "a medição de rede acontece contra uma borda EFÊMERA e isolada (ADR-0006); a instalação na borda real é ato do operador, com privilégio"
	nota "esta bateria NÃO depende do TLS público: o certificado é gerado no arranjo, e o que ela mede é o vhost — não o salto da frente"

	# Os casos estáticos primeiro: eles não dependem de rede, e reprovar neles é
	# diagnóstico mais barato que reprovar por medição.
	ct_1188
	ct_1188_b
	ct_1183

	# A borda efêmera, para os casos de rede.
	local ferramenta faltando=()
	for ferramenta in nginx curl openssl node; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		aviso "ferramenta ausente no host: ${faltando[*]} — a MEDIÇÃO DE REDE não foi feita (é a asserção central desta bateria)"
	elif ! carregar_funcao_do_instalador renderizar_vhost; then
		falhar "não consegui carregar 'renderizar_vhost' — a borda efêmera mediria uma cópia do vhost, não o versionado"
	elif ! subir_borda_efemera; then
		falhar "a borda efêmera não subiu — ver ${PREFIXO_DA_BORDA}/logs/error.log"
		[[ -f "${PREFIXO_DA_BORDA}/logs/error.log" ]] && tail -5 "${PREFIXO_DA_BORDA}/logs/error.log" >&2
	else
		nota "borda efêmera de pé: TLS em ${PORTA_HTTPS}, claro em ${PORTA_HTTP}, serviço em 127.0.0.1"
	fi

	ct_1180
	ct_1181
	ct_1182
	ct_1184
	ct_1185
	ct_1186
	ct_1187

	# O destino do e-mail: a falsificação ANTES da asserção real, para que o
	# poder dela esteja provado mesmo quando o host não permitir medi-la.
	ct_1190
	ct_1189

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -eq 0 ]]; then
			printf 'verificar-borda-do-app: %d/%d casos aprovados (CT-1180 a CT-1190)\n' \
				"${casos_aprovados}" "${casos_executados}"
		else
			# Pela SAÍDA DE ERRO, como nas três baterias irmãs: é o canal que o
			# agregador reencaminha, e o resumo de uma execução com asserção por
			# medir precisa chegar junto das linhas AVISO que o explicam.
			printf 'verificar-borda-do-app: %d/%d casos sem falha, com %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${casos_aprovados}" "${casos_executados}" "${avisos_totais}" >&2
			# Desfecho 2, e não 0 — ver o contrato de saída no cabeçalho.
			exit 2
		fi
		exit 0
	fi

	printf 'verificar-borda-do-app: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
