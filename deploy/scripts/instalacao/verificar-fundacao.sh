#!/usr/bin/env bash
#
# Bateria de aceitação da fatia `fundacao-stack-nativa` — T7, a última task.
#
# Esta é a bateria da FATIA INTEIRA: ela agrega, na ordem, os verificadores das
# tasks anteriores e acrescenta os casos próprios de T7.
#
#   CT-001  o instalador das unidades executado duas vezes seguidas sai 0 nas
#           duas, não duplica link de habilitação, não reescreve arquivo de
#           unidade e NÃO derruba serviço saudável;
#   CT-002  encerrar abruptamente o processo do serviço de aplicação faz o
#           supervisor trazê-lo de volta — um reinício, não um laço;
#   CT-003  faltando variável obrigatória, a partida falha NOMEANDO a variável e
#           o supervisor desiste; o laço de reinício não acontece;
#   CT-004  o código de saída desta bateria é fiel: com o processador parado ela
#           sai != 0 nomeando o caso, e volta a sair 0 quando ele é restaurado;
#   CT-005  nenhuma credencial nas unidades, na árvore versionada, no ambiente
#           que o supervisor expõe nem no journal dos dois serviços;
#   CT-006  após reinício COMPLETO do servidor, a base nova e o ambiente legado
#           voltam sozinhos — e a tarefa enfileirada antes é consumida;
#   CT-007  a decisão de idempotência do instalador, exercitada como função pura
#           — o companheiro do CT-001 que NÃO depende do sistema real.
#
# ---------------------------------------------------------------------------
# Os subcomandos, e por que eles existem
# ---------------------------------------------------------------------------
#
#   (sem argumento)      a bateria: agrega os verificadores da fatia e executa
#                        CT-001 a CT-005 e CT-007. NÃO executa o CT-006 — ele
#                        consome uma
#                        janela de indisponibilidade e não é repetível.
#
#   servicos             a sub-bateria de SERVIÇO: as duas rotas de saúde, a
#                        publicação do contrato e o consumo de tarefa. Existe
#                        como subcomando porque o CT-004 precisa executá-la três
#                        vezes, sobre três estados do sistema, medindo o código
#                        de saída de cada uma. Se ela fosse apenas uma função
#                        interna, o CT-004 teria de reexecutar a bateria inteira
#                        de dentro dela mesma — recursão infinita. Ela NÃO é um
#                        modo que force reprovação artificial: a reprovação que o
#                        CT-004 observa vem do processador realmente parado.
#
#   reinicio-preparar    o CT-006, primeira metade: confere que a bateria sai 0,
#                        captura o retrato pré-reinício em arquivo persistente,
#                        enfileira a tarefa de eco e para o processador,
#                        deixando-a pendente.
#
#   reinicio-conferir    o CT-006, segunda metade: executada DEPOIS do boot, sem
#                        nenhum comando de partida manual.
#
# ---------------------------------------------------------------------------
# ADR-0006 — a bateria e o ambiente de operação
# ---------------------------------------------------------------------------
#
# ESTA BATERIA ALTERA O SISTEMA REAL: o CT-001 reexecuta a instalação das
# unidades, o CT-002 mata o processo do serviço de aplicação, o CT-003 instala
# unidades de prova e o CT-004 para e religa o processador. Isso é legítimo
# ENQUANTO esta instalação não atender a operação — hoje quem atende é o ambiente
# legado, e a pilha desta fatia não serve ninguém. Como a condição é temporária,
# ela não fica por conta da memória de quem executa: `recusar_bateria_em_producao`
# é consultada ANTES do primeiro caso e recusa a bateria quando a instalação
# estiver marcada como a que atende a operação. Mesmo mecanismo, mesma razão e
# mesmo marcador de `verificar-provisionamento.sh` (T2).
#
# ---------------------------------------------------------------------------
# Parâmetros
# ---------------------------------------------------------------------------
#
#   SYSLOC_DIR_REINICIO   Diretório do retrato pré-reinício do CT-006. Precisa
#                         sobreviver a um reinício, por isso NÃO fica em /tmp.
#                         Padrão: /var/lib/sysloc-verificacao/reinicio
#
# Uso:
#   sudo bash deploy/scripts/instalacao/verificar-fundacao.sh
#   sudo bash deploy/scripts/instalacao/verificar-fundacao.sh servicos
#   sudo bash deploy/scripts/instalacao/verificar-fundacao.sh reinicio-preparar
#   sudo bash deploy/scripts/instalacao/verificar-fundacao.sh reinicio-conferir
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly SCRIPT_INSTALAR="${RAIZ_REPO}/deploy/scripts/instalacao/instalar-unidades.sh"
readonly DIR_FONTE_UNIDADES="${RAIZ_REPO}/deploy/systemd"

# Script de provisionamento (T2). Esta bateria não o EXECUTA: ela carrega dele o
# caminho de leitura da credencial — ver `carregar_leitor_do_provisionador`.
readonly SCRIPT_PROVISIONAR="${RAIZ_REPO}/deploy/scripts/instalacao/provisionar-base.sh"
readonly DIR_UNIDADES_INSTALADAS="/etc/systemd/system"

# --------------------------------------------------------------------------- #
# Verificadores das fatias anteriores, NA ORDEM DE INVOCAÇÃO.
#
# A ordem não é decorativa: o CT-004 de `verificar-workspace.sh` depende do
# sandbox que o CT-001 dele cria, e os casos de `verificar-provisionamento.sh`
# comparam retratos capturados em sequência. `verificar-migracao.sh` (F1/T5) vem
# DEPOIS de `verificar-provisionamento.sh` porque cria e remove banco no cluster
# e depende do estado que os passos P15/P16 do provisionamento deixam. Nada aqui
# é paralelizado.
#
# Cada um honra o mesmo contrato de agregação, declarado no cabeçalho deles:
# invocação como subprocesso, sem argumentos, raiz do repositório derivada do
# próprio caminho, saída 0 (aprovado) ou 1 (reprovado).
#
# O segundo campo é COM QUAL IDENTIDADE cada um roda, e não é detalhe de estilo:
#
#   root     `verificar-provisionamento.sh` exige privilégio (`exigir_privilegio`)
#            — ele lê o arquivo de ambiente 0600 e reinicia a instância de fila;
#   usuario  os outros dois NÃO podem rodar como root. `verificar-workspace.sh`
#            resolve o ferramental pelo gerenciador de versões instalado no
#            diretório pessoal do usuário de trabalho, e `initdb` — que
#            `verificar-apuracao-versao.sh` invoca para levantar as instâncias
#            próprias — RECUSA executar como root, por decisão do próprio banco.
#            Agregá-los sem baixar privilégio faria os dois reprovarem por um
#            motivo que nada tem a ver com o que eles provam.
# --------------------------------------------------------------------------- #
# Este array é a ÚNICA lista de verificadores agregados que existe — bateria que
# não esteja aqui não roda por rotina, e foi assim que a bateria da F1 passou uma
# fatia inteira invocável só por quem lembrasse do caminho completo (débito D6,
# fechado no fechamento da F1). Quem acrescentar um verificador acrescenta a linha
# aqui no mesmo commit.
readonly VERIFICADORES_DA_FATIA=(
	"deploy/scripts/instalacao/verificar-workspace.sh:usuario"
	"deploy/scripts/instalacao/verificar-provisionamento.sh:root"
	"deploy/scripts/instalacao/verificar-migracao.sh:root"
	"deploy/scripts/instalacao/verificar-apuracao-versao.sh:usuario"
)

readonly UNIDADE_API="sysloc-api.service"
readonly UNIDADE_WORKER="sysloc-worker.service"
readonly UNIDADES=("${UNIDADE_API}" "${UNIDADE_WORKER}")

# Arquivo de ambiente posicionado por `provisionar-base.sh` (T2). Espelhado aqui
# de propósito: a bateria precisa saber o valor esperado sem herdá-lo do código
# sob teste, senão os dois erram juntos.
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
readonly MODO_ARQ_AMBIENTE="600"

# Marcador que a fatia de implantação (F7) passa a criar quando esta instalação
# assumir o atendimento da operação. Ver `recusar_bateria_em_producao`.
readonly ARQ_MARCADOR_PRODUCAO="/etc/sysloc/producao"

readonly ENDERECO_DA_APLICACAO="127.0.0.1"

# Módulo construído que expõe a fila. O consumo de tarefa é exercitado pelo
# MESMO código que o processador usa — não por uma reimplementação da gravação
# nas chaves do servidor de fila, que passaria mesmo com o produtor quebrado.
readonly MODULO_DA_FILA="${RAIZ_REPO}/apps/worker/dist/fila.js"

# --------------------------------------------------------------------------- #
# Limites de tempo. Todos são constantes NOMEADAS, e toda espera por estado
# observável é sondagem contra um destes limites — nunca espera fixa.
# --------------------------------------------------------------------------- #
readonly INTERVALO_DE_SONDAGEM_S=1

# CA-8: quanto o supervisor tem para trazer o serviço de volta depois da queda.
readonly LIMITE_RECUPERACAO_S=60

# Quanto se espera, com o serviço já de volta, antes de reler o contador de
# reinícios. É o que separa "recuperou" de "está oscilando": um serviço em laço
# acumula reinícios nessa janela, um recuperado não acumula nenhum.
readonly ESPERA_ANTI_LACO_S=30

# CT-003: quanto a unidade de prova tem para convergir para estado terminal.
# Cinco partidas espaçadas por `RestartSec` mais a folga do próprio limite.
readonly LIMITE_CONVERGENCIA_FALHA_S=120

# CT-004: teto para uma execução da sub-bateria de serviço. Travamento vira
# reprovação, não espera indefinida.
readonly LIMITE_BATERIA_SERVICOS_S=180

# Quanto uma tarefa de eco tem para ser consumida com o processador de pé.
readonly LIMITE_CONSUMO_TAREFA_MS=20000

# CT-006: quanto o servidor inteiro tem para convergir depois do boot.
readonly LIMITE_RETORNO_APOS_REINICIO_S=300

# CT-006, ponta (c): quanto uma unidade ATIVADA SOB DEMANDA tem para chegar a
# `active` depois de o nome D-Bus dela ser acionado. É um limite curto de
# propósito — o barramento já devolveu a resposta da ativação quando a sondagem
# começa, e o que resta é o supervisor terminar a partida.
readonly LIMITE_ATIVACAO_SOB_DEMANDA_S=30

# Teto para cada consulta HTTP às rotas de saúde e ao contrato.
readonly LIMITE_HTTP_S=10

# Faixa de portas da unidade de PROVA do CT-003. Distinta da porta de produção
# (que a unidade declara), da faixa das instâncias efêmeras da suíte de
# TypeScript (24001-24999) e da faixa de `verificar-apuracao-versao.sh`
# (25001-25999): as três podem estar de pé ao mesmo tempo, e disputar porta
# produziria falha intermitente sem relação com o que se quer provar.
readonly PORTA_PROVA_INICIAL=26001
readonly PORTA_PROVA_FINAL=26999

# Portas que nada desta bateria pode ocupar: as três do provisionamento e as duas
# padrão do banco e da fila. A faixa acima já as exclui — o guarda existe para o
# dia em que alguém alargar a faixa.
readonly PORTAS_INTOCAVEIS=(1025 5432 6379 6380 8025)

# Portas efêmeras são atribuídas pelo núcleo e mudam sozinhas entre dois
# retratos, sem que nada tenha acontecido. Compará-las reprovaria por ruído.
readonly PRIMEIRA_PORTA_EFEMERA=32768

# Diretório do retrato pré-reinício. FORA de /tmp de propósito: ele precisa
# sobreviver ao reinício que o CT-006 provoca.
DIR_REINICIO="${SYSLOC_DIR_REINICIO:-/var/lib/sysloc-verificacao/reinicio}"
readonly DIR_REINICIO

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
# Instante de início, usado para delimitar a leitura do journal nos casos que a
# consultam. Definido em `main`, antes do primeiro caso.
INICIO_DA_BATERIA=""
# Caminho absoluto do runtime, derivado da unidade versionada em
# `exigir_ferramentas`. Ver o comentário lá para a razão de não ser `command -v`.
RUNTIME=""
# Usuário dono do repositório e o seu diretório pessoal. É com essa identidade
# que os verificadores agregados marcados como `usuario` são executados.
DONO_DO_REPO=""
HOME_DO_DONO=""
# Unidades de prova instaladas pelo CT-003, removidas pelo trap mesmo em falha.
UNIDADES_DE_PROVA=()
# Ligado pelo CT-004 enquanto o processador está deliberadamente parado.
PROCESSADOR_PARADO_PELO_CASO=0

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# Fora do esqueleto compartilhado de propósito — ver a razão medida no cabeçalho
# de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`: as quatro cópias desta
# função no repositório NÃO são o mesmo símbolo (uma delas grepa um ARQUIVO).
afirmar_contem() {
	if [[ "$3" == *"$2"* ]]; then
		ok "$1"
	else
		falhar "$1 — não encontrei [$2] em: $3"
	fi
}

# --------------------------------------------------------------------------- #
# Limpeza — armada ANTES de instalar unidade de prova ou parar serviço.
#
# Ela remove o que a bateria criou e RESTAURA o que ela parou. A restauração do
# processador é incondicional: sem ela, uma interrupção no meio do CT-004
# deixaria o serviço parado e a fatia inteira aparentemente quebrada.
# --------------------------------------------------------------------------- #
limpar() {
	local codigo=$?
	local unidade

	for unidade in "${UNIDADES_DE_PROVA[@]:-}"; do
		[[ -n "${unidade}" ]] || continue
		systemctl stop "${unidade}" >/dev/null 2>&1 || true
		systemctl reset-failed "${unidade}" >/dev/null 2>&1 || true
		rm -f "${DIR_UNIDADES_INSTALADAS}/${unidade}"
		rm -rf "${DIR_UNIDADES_INSTALADAS}/${unidade}.d"
	done
	# `${#arr[@]}` sem valor padrão: a forma `${#arr[@]:-0}` é substituição
	# INVÁLIDA em bash e abortaria a própria limpeza — deixando unidade de prova
	# instalada em /etc. Sobre array vazio, `${#arr[@]}` devolve 0 normalmente,
	# inclusive sob `set -u`.
	if [[ "${#UNIDADES_DE_PROVA[@]}" -gt 0 ]]; then
		systemctl daemon-reload >/dev/null 2>&1 || true
		UNIDADES_DE_PROVA=()
	fi

	if [[ "${PROCESSADOR_PARADO_PELO_CASO}" -eq 1 ]]; then
		systemctl start "${UNIDADE_WORKER}" >/dev/null 2>&1 || true
		PROCESSADOR_PARADO_PELO_CASO=0
	fi

	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi

	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Sem estes, um
# Ctrl-C no meio do CT-003 deixaria unidade de prova instalada em /etc e, no meio
# do CT-004, o processador parado.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# =========================================================================== #
# Guardas de entrada.
# =========================================================================== #
exigir_privilegio() {
	if [[ "${EUID}" -ne 0 ]]; then
		printf 'ERRO: esta bateria precisa de privilégio administrativo — ela reexecuta a instalação\n' >&2
		printf '      das unidades, encerra o processo do serviço de aplicação, instala unidades de\n' >&2
		printf '      prova em %s e para o processador.\n' "${DIR_UNIDADES_INSTALADAS}" >&2
		printf '      Execute como: sudo bash deploy/scripts/instalacao/verificar-fundacao.sh\n' >&2
		exit 1
	fi
}

# --------------------------------------------------------------------------- #
# ADR-0006 — recusa de executar contra a instalação que atende a operação.
#
# Mesmo mecanismo e mesma justificativa de `verificar-provisionamento.sh` (T2):
# o sujeito do guarda é a INSTALAÇÃO, não a invocação, e uma propriedade da
# máquina deve estar registrada na máquina em vez de afirmada por quem digita o
# comando. Recebe o caminho por parâmetro para ser exercitável sem privilégio.
# --------------------------------------------------------------------------- #
instalacao_liberada_para_bateria() {
	[[ ! -e "$1" ]]
}

recusar_bateria_em_producao() {
	instalacao_liberada_para_bateria "${ARQ_MARCADOR_PRODUCAO}" && return 0

	printf 'ERRO: esta instalação está marcada como a que atende a operação (%s existe).\n' \
		"${ARQ_MARCADOR_PRODUCAO}" >&2
	printf '      A ADR-0006 é literal: "a suíte de verificação nunca executa contra o ambiente\n' >&2
	printf '      que atende a operação". Esta bateria ENCERRA o processo do serviço de aplicação\n' >&2
	printf '      (CT-002), instala unidades de prova (CT-003) e PARA o processador (CT-004);\n' >&2
	printf '      contra uma instalação em produção isso é indisponibilidade, não verificação.\n' >&2
	printf '      O QUE FAZER: reconstrua a instalação num ambiente separado a partir deste\n' >&2
	printf '      repositório — `provisionar-base.sh` e `instalar-unidades.sh` são idempotentes e\n' >&2
	printf '      reconstrutíveis por desenho — e rode a bateria lá.\n' >&2
	exit 1
}

exigir_ferramentas() {
	local faltando=() ferramenta
	# `node` NÃO entra nesta lista de propósito: ele não está instalado no sistema,
	# e sim sob o diretório pessoal do usuário de trabalho, pelo gerenciador de
	# versões. Sob `sudo`, o PATH é o do superusuário e não o alcança. O caminho
	# absoluto é DERIVADO da unidade versionada — a mesma fonte que o supervisor
	# usa —, em `runtime_declarado`.
	for ferramenta in systemctl systemd-analyze journalctl runuser getent curl git ss stat sha256sum install find awk sed grep comm; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: ferramenta obrigatória ausente do PATH: %s\n' "${faltando[*]}" >&2
		exit 1
	fi

	if ! RUNTIME="$(runtime_declarado)" || [[ ! -x "${RUNTIME}" ]]; then
		printf 'ERRO: o runtime declarado no ExecStart= de %s não existe ou não é executável: %s\n' \
			"${UNIDADE_API}" "${RUNTIME:-<não declarado>}" >&2
		printf '      Execute "mise install" na raiz do repositório, como o usuário de trabalho.\n' >&2
		exit 1
	fi

	DONO_DO_REPO="$(stat -c '%U' "${RAIZ_REPO}")"
	HOME_DO_DONO="$(getent passwd "${DONO_DO_REPO}" | cut -d: -f6)"
	if [[ -z "${DONO_DO_REPO}" || -z "${HOME_DO_DONO}" ]]; then
		printf 'ERRO: não consegui determinar o usuário dono de %s nem o seu diretório pessoal\n' \
			"${RAIZ_REPO}" >&2
		exit 1
	fi
}

preparar_area_temporaria() {
	DIR_TEMPORARIO="$(mktemp -d -t sysloc-verificar-fundacao-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"
}

# =========================================================================== #
# Utilitários.
# =========================================================================== #

# `git` sobre um diretório que pertence a outro usuário. A bateria roda como root
# e o repositório pertence ao usuário de trabalho; sem isto o Git recusa a
# operação por "dubious ownership". O ajuste vale só para a invocação.
git_em() {
	local dir="$1"
	shift
	git -c "safe.directory=${dir}" -C "${dir}" "$@"
}

soma_ou_ausente() {
	if [[ -f "$1" ]]; then
		sha256sum "$1" | cut -d' ' -f1
	else
		printf 'AUSENTE'
	fi
}

propriedade_da_unidade() {
	systemctl show -p "$2" --value "$1" 2>/dev/null || true
}

unidade_ativa() {
	[[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]
}

# Conta os links de habilitação que apontam para a unidade. Exatamente 1 é o
# esperado; 2 é a assinatura clássica do instalador não idempotente.
contar_links_de_habilitacao() {
	find "${DIR_UNIDADES_INSTALADAS}" -mindepth 2 -maxdepth 2 -path '*.wants/*' -name "$1" 2>/dev/null |
		grep -c . || true
}

# Valor de uma diretiva `Environment=` declarada no arquivo de unidade.
valor_de_ambiente_na_unidade() {
	local unidade="$1" chave="$2" valor
	valor="$(sed -n "s|^Environment=${chave}=\\(.*\\)$|\\1|p" "${unidade}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Porta em que o serviço de aplicação escuta — DERIVADA da unidade versionada,
# nunca fixada aqui. Fixá-la faria a bateria envelhecer em silêncio no dia em que
# a porta mudasse.
porta_da_aplicacao() {
	valor_de_ambiente_na_unidade "${DIR_FONTE_UNIDADES}/${UNIDADE_API}" PORT
}

# Caminho absoluto do runtime — o PRIMEIRO argumento do `ExecStart=` da unidade
# versionada. Derivado da mesma fonte que o supervisor lê, e não de `command -v`:
# sob `sudo`, o PATH é o do superusuário e não alcança o runtime instalado no
# diretório pessoal do usuário de trabalho.
runtime_declarado() {
	local valor
	valor="$(sed -n 's|^ExecStart=\([^[:space:]]\{1,\}\).*$|\1|p' \
		"${DIR_FONTE_UNIDADES}/${UNIDADE_API}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Executa um comando com a identidade do usuário dono do repositório. HOME e PATH
# são declarados explicitamente em vez de herdados: `sudo` os substitui pelos do
# superusuário, e é do diretório pessoal do dono que o ferramental fixado pelo
# gerenciador de versões é resolvido.
executar_como_dono() {
	runuser -u "${DONO_DO_REPO}" -- env \
		HOME="${HOME_DO_DONO}" \
		PATH="${HOME_DO_DONO}/.local/bin:${HOME_DO_DONO}/.local/share/mise/shims:${PATH}" \
		"$@"
}

porta_livre_para_prova() {
	local porta intocavel proibida
	for ((porta = PORTA_PROVA_INICIAL; porta <= PORTA_PROVA_FINAL; porta++)); do
		proibida=0
		for intocavel in "${PORTAS_INTOCAVEIS[@]}"; do
			[[ "${porta}" -ne "${intocavel}" ]] || proibida=1
		done
		[[ "${proibida}" -eq 0 ]] || continue
		if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
			printf '%s' "${porta}"
			return 0
		fi
	done
	return 1
}

# Consulta HTTP com teto de tempo. Grava o corpo no arquivo indicado e imprime o
# código de estado — `000` quando a conexão sequer aconteceu, que é distinguível
# de qualquer código real.
consultar_http() {
	local caminho="$1" corpo="$2" porta codigo
	porta="$(porta_da_aplicacao)" || porta=0
	: >"${corpo}"
	codigo="$(curl -sS --max-time "${LIMITE_HTTP_S}" -o "${corpo}" -w '%{http_code}' \
		"http://${ENDERECO_DA_APLICACAO}:${porta}${caminho}" 2>/dev/null || true)"
	printf '%s' "${codigo:-000}"
}

# --------------------------------------------------------------------------- #
# Leitura da credencial do banco — SEM leitor próprio.
#
# CAUSA-RAIZ de não haver reimplementação aqui: a versão anterior desta bateria
# trazia a própria `ler_credencial_db`, TERCEIRA cópia do mesmo caminho de
# leitura (as outras são `extrair_credencial_db` em `provisionar-base.sh` e
# `ler_credencial_db` em `verificar-provisionamento.sh`). Cópia idêntica hoje não
# é defeito hoje — é defeito amanhã, e SILENCIOSO: basta ela voltar à extração
# truncante (`\([A-Za-z0-9]*\)` dentro da própria substituição) para a agulha
# virar um PREFIXO, que ainda atravessa o guarda de alfabeto, e as varreduras (d),
# (e) e (f) do CT-005 e a (f) do CT-003 passarem a procurar o valor errado
# devolvendo 0 ocorrências para sempre. É o padrão que a `testing-stack.md`
# registra como causa de três das cinco rodadas de T2.
#
# POR QUE CARREGAR FECHA A CLASSE (e a prova (g) do CT-005 não fechava): a (g)
# usa agulha SINTÉTICA — ela prova que o varredor acha o que existe, jamais que a
# agulha derivada do arquivo real é a credencial INTEIRA. Carregando o leitor,
# passa a existir UM único caminho de leitura no repositório, e ele já é o SUT da
# tabela de falsificação (i)/(j)/(k) do CT-003 de `verificar-provisionamento.sh`,
# que aplica os dez cenários ao arquivo REAL. Como `agregar_baterias_da_fatia`
# roda ANTES do CT-003 e do CT-005 desta bateria, uma regressão para a extração
# truncante reprova a bateria antes de a agulha ser derivada. Não há mais caminho
# por onde uma agulha-prefixo entre sem asserção vermelha.
#
# É o que o próprio comentário de `extrair_credencial_db` defende: quem valida e
# quem executa são o mesmo código.
# --------------------------------------------------------------------------- #

# Resultados de `extrair_credencial_db`, carregada do provisionamento. Declarados
# aqui porque é esta bateria que hospeda a função depois do `eval`. Nenhum dos
# dois é exportado, e `CREDENCIAL_LIDA` nunca é impressa.
CREDENCIAL_LIDA=""
CHAVES_REPETIDAS=""

# Carrega, do arquivo indicado, o caminho de leitura REAL da credencial. Recebe o
# caminho por parâmetro pelo mesmo motivo de `carregar_funcoes_do_provisionador`
# em `verificar-provisionamento.sh`: apontá-la a uma cópia mutilada é como se
# prova que a asserção reprova.
carregar_leitor_do_provisionador() {
	local script="$1"
	local trecho fn
	local -a funcoes=(
		credencial_manuseavel
		extrair_credencial_db
	)

	[[ -f "${script}" ]] || return 1

	for fn in "${funcoes[@]}"; do
		trecho="$(sed -n "/^${fn}() {/,/^}/p" "${script}")"
		[[ -n "${trecho}" ]] || return 1
		eval "${trecho}"
		[[ "$(type -t "${fn}")" == "function" ]] || return 1
	done
}

# Lê a credencial do banco do arquivo de ambiente, em tempo de execução, pelo
# leitor do provisionamento. O valor sai por stdout do subshell e é capturado numa
# variável local pelo chamador — nunca é impresso, nunca vai para argumento de
# comando, nunca é gravado. Devolve != 0 (sem imprimir nada em stdout) quando não
# há credencial íntegra; a impossibilidade de CARREGAR o leitor é um desfecho
# distinto (2), e diz por que na saída de erro em vez de se confundir com
# "arquivo sem credencial".
#
# $1 = arquivo de ambiente · $2 = script de onde carregar o leitor (opcional)
ler_credencial_db() {
	local arquivo="$1" script="${2:-${SCRIPT_PROVISIONAR}}"

	if ! carregar_leitor_do_provisionador "${script}"; then
		printf 'não consegui carregar credencial_manuseavel/extrair_credencial_db de %s — sem elas esta bateria não tem leitor de credencial\n' \
			"${script}" >&2
		return 2
	fi

	extrair_credencial_db "${arquivo}" || return 1
	printf '%s' "${CREDENCIAL_LIDA}"
}

# Varre a ÁRVORE VERSIONADA de `dir` procurando a agulha recebida pela PRIMEIRA
# linha da entrada padrão. Imprime as ocorrências no formato `arquivo:linha` —
# jamais o conteúdo da linha, que carregaria o próprio valor procurado. Devolve
# 0 quando não achou nada e 1 quando achou.
varrer_arvore_versionada() {
	local dir="$1"
	local agulha
	IFS= read -r agulha

	# `--cached --others --exclude-standard` soma o que está no índice ao que
	# ainda não é rastreado mas é rastreável — sem `--others`, os arquivos novos
	# da própria entrega ficariam de fora, que é justamente o caso que mais
	# importa neste pipeline.
	local -a arquivos=()
	mapfile -d '' arquivos < <(git_em "${dir}" ls-files -z --cached --others --exclude-standard)
	if [[ "${#arquivos[@]}" -eq 0 ]]; then
		return 0
	fi

	local achados=""
	achados="$(cd "${dir}" && printf '%s\n' "${agulha}" |
		grep -nIHF -f - -- "${arquivos[@]}" 2>/dev/null | cut -d: -f1,2)" || true

	if [[ -n "${achados}" ]]; then
		printf '%s\n' "${achados}"
		return 1
	fi
	return 0
}

# Conta as ocorrências da agulha (primeira linha da entrada padrão) nos arquivos
# passados por argumento. Só a CONTAGEM sai daqui.
contar_ocorrencias() {
	local agulha
	IFS= read -r agulha
	local total=0
	total="$(printf '%s\n' "${agulha}" | grep -IF -f - -- "$@" 2>/dev/null | wc -l)" || true
	printf '%s' "${total}"
}

# Sondagem por estado observável, com limite declarado. `$1` = limite em
# segundos · `$2..` = comando cujo sucesso encerra a espera. Devolve 0 quando a
# condição foi observada e 1 quando o limite estourou.
sondar_ate() {
	local limite="$1"
	shift
	local decorrido=0
	while ! "$@" >/dev/null 2>&1; do
		if [[ "${decorrido}" -ge "${limite}" ]]; then
			return 1
		fi
		sleep "${INTERVALO_DE_SONDAGEM_S}"
		decorrido=$((decorrido + INTERVALO_DE_SONDAGEM_S))
	done
	return 0
}

# --------------------------------------------------------------------------- #
# O auxiliar de fila.
#
# Ele exercita o consumo de tarefa pelo MESMO módulo construído que o processador
# usa (`apps/worker/dist/fila.js`), em vez de escrever direto nas chaves do
# servidor de fila: uma reimplementação da gravação passaria mesmo com o produtor
# quebrado, e o que se quer provar é o caminho inteiro.
#
# A cadeia de conexão chega por arquivo de ambiente FILTRADO — só `REDIS_URL`,
# que não carrega credencial — e nunca por argumento de linha de comando.
# --------------------------------------------------------------------------- #
escrever_auxiliar_de_fila() {
	cat >"${DIR_TEMPORARIO}/fila.mjs" <<'AUXILIAR'
// Auxiliar de fila da bateria de aceitação (T7). Gerado em diretório temporário
// 0700 e descartado com ele.
//
// Modos:
//   enfileirar <valor>            enfileira e devolve o identificador (não espera)
//   conferir <id> <valor>         confere que a tarefa foi consumida e devolveu o valor
//   enfileirar-e-esperar <valor>  as duas coisas, numa execução só
const limiteMs = Number(process.env.SYSLOC_LIMITE_CONSUMO_MS);
const intervaloMs = 250;

// Registrador de nada: o módulo da fila recebe um registrador por parâmetro, e o
// que interessa aqui é o comportamento da fila, não o que ela registra.
const registro = new Proxy({}, { get: () => () => {} });

const { conectarFila } = await import(process.env.SYSLOC_MODULO_FILA);
const fila = conectarFila(process.env.REDIS_URL, registro);

let codigo = 64;
try {
  codigo = await executar();
} finally {
  await fila.encerrar();
}
process.exitCode = codigo;

async function executar() {
  const modo = process.argv[2];
  const valor = process.argv[3];

  if (modo === 'enfileirar') {
    const tarefa = await fila.eco.add('prova-de-fundacao', { valor });
    process.stdout.write(`ID=${tarefa.id}\n`);
    return 0;
  }
  if (modo === 'conferir') {
    return await esperarConclusao(valor, process.argv[4]);
  }
  if (modo === 'enfileirar-e-esperar') {
    const tarefa = await fila.eco.add('prova-de-fundacao', { valor });
    process.stdout.write(`ID=${tarefa.id}\n`);
    return await esperarConclusao(tarefa.id, valor);
  }
  process.stderr.write(`modo desconhecido: ${modo}\n`);
  return 64;
}

async function esperarConclusao(id, esperado) {
  const fim = Date.now() + limiteMs;
  for (;;) {
    const tarefa = await fila.eco.getJob(id);
    if (tarefa === undefined) {
      process.stderr.write(`ESTADO=ausente ID=${id}\n`);
      return 1;
    }
    const estado = await tarefa.getState();
    if (estado === 'completed') {
      process.stdout.write(`ESTADO=completed ID=${id}\n`);
      // Releitura DELIBERADA, em vez do `tarefa.returnvalue` que já está à mão.
      //
      // `getJob()` devolve um RETRATO do registro no instante em que foi lido, e
      // `getState()` consulta o servidor de novo: são duas leituras. A tarefa que
      // conclui ENTRE elas produz estado fresco com valor obsoleto, e o caso
      // reprova com "RETORNO divergente" enquanto o processador está correto. A
      // janela não é hipotética — quando o processador volta de uma parada ele
      // drena o acúmulo e conclui tarefas com milissegundos de diferença, que é
      // exatamente o que a sequência (b) → (d) do CT-004 fabrica.
      //
      // A correção ordena a EMISSÃO das leituras, e não a espera entre elas:
      // `completed` é terminal e o retorno é gravado na MESMA transação que
      // conclui a tarefa, então toda leitura emitida DEPOIS de `completed` ter
      // sido observado enxerga o valor final. Estado e valor passam a ser
      // atômicos em relação à decisão. Esperar mais, ou repetir a comparação,
      // mascararia a corrida em vez de fechá-la.
      const concluida = await fila.eco.getJob(id);
      if (concluida === undefined) {
        process.stderr.write(`ESTADO=descartada-apos-conclusao ID=${id}\n`);
        return 1;
      }
      if (concluida.returnvalue !== esperado) {
        // Os dois valores no diagnóstico: sem eles, este era o rótulo que apontava
        // para o processador quando o defeito estava na leitura.
        process.stderr.write(
          `RETORNO divergente para a tarefa ${id}: esperado [${esperado}], obtido [${concluida.returnvalue}]\n`,
        );
        return 1;
      }
      return 0;
    }
    if (estado === 'failed') {
      process.stderr.write(`ESTADO=failed ID=${id} RAZAO=${tarefa.failedReason}\n`);
      return 1;
    }
    if (Date.now() >= fim) {
      process.stderr.write(`ESTADO=${estado} ID=${id} — não foi consumida em ${limiteMs} ms\n`);
      return 1;
    }
    await new Promise((resolver) => setTimeout(resolver, intervaloMs));
  }
}
AUXILIAR

	# Arquivo de ambiente FILTRADO: só a cadeia de conexão da fila, que não
	# carrega credencial. O arquivo de ambiente completo nunca é entregue a este
	# processo filho.
	install -m 0600 /dev/null "${DIR_TEMPORARIO}/fila.env"
	grep -E '^REDIS_URL=' "${ARQ_AMBIENTE}" >"${DIR_TEMPORARIO}/fila.env" || return 1
}

# $1 = modo · $2.. = argumentos do modo. A saída combinada vai para o arquivo
# apontado por ${SAIDA_DA_FILA}, definido pelo chamador.
executar_auxiliar_de_fila() {
	SYSLOC_MODULO_FILA="${MODULO_DA_FILA}" \
		SYSLOC_LIMITE_CONSUMO_MS="${LIMITE_CONSUMO_TAREFA_MS}" \
		"${RUNTIME}" --env-file="${DIR_TEMPORARIO}/fila.env" \
		"${DIR_TEMPORARIO}/fila.mjs" "$@"
}

# =========================================================================== #
# Sub-bateria de SERVIÇO — o subcomando `servicos`.
#
# Prova, contra os serviços realmente de pé, as quatro propriedades que a §4 da
# task exige da bateria: as duas rotas de saúde, a publicação do contrato e o
# consumo de tarefa. É o que o CT-004 executa três vezes para provar que o código
# de saída desta bateria é FIEL.
#
# Cada rótulo de asserção nomeia a propriedade — em especial o do consumo de
# tarefa, que é o que o CT-004 procura literalmente na saída de erro. Uma
# mensagem agregada do tipo "a verificação falhou" reprovaria o CT-004, e com
# razão: ela não permite corrigir sem depurar.
# =========================================================================== #
sub_bateria_de_servicos() {
	caso "SERVICOS" "Rotas de saúde, contrato publicado e consumo de tarefa, contra os serviços de pé"

	local porta
	if ! porta="$(porta_da_aplicacao)"; then
		falhar "${UNIDADE_API} não declara 'Environment=PORT=' — sem a porta, nenhuma asserção desta sub-bateria tem objeto"
		fechar_caso "SERVICOS"
		return
	fi
	nota "serviço de aplicação em http://${ENDERECO_DA_APLICACAO}:${porta}"

	# --- (a) rota de saúde rasa ---------------------------------------------- #
	local corpo="${DIR_TEMPORARIO}/corpo.txt"
	afirmar_igual "(a) GET /saude responde 200" "200" "$(consultar_http /saude "${corpo}")"
	afirmar_igual "(a) GET /saude declara o processo disponível" "1" \
		"$(grep -cF '"estado":"disponivel"' "${corpo}" || true)"

	# --- (b) rota de saúde profunda ------------------------------------------ #
	afirmar_igual "(b) GET /saude/pronto responde 200" "200" "$(consultar_http /saude/pronto "${corpo}")"
	afirmar_igual "(b) GET /saude/pronto declara o banco alcançável" "1" \
		"$(grep -cF '"banco":"disponivel"' "${corpo}" || true)"
	afirmar_igual "(b) GET /saude/pronto declara a fila alcançável" "1" \
		"$(grep -cF '"fila":"disponivel"' "${corpo}" || true)"

	# --- (c) contrato publicado ---------------------------------------------- #
	afirmar_igual "(c) a página navegável do contrato responde 200" "200" \
		"$(consultar_http /docs "${corpo}")"
	afirmar_igual "(c) o documento de descrição do contrato responde 200" "200" \
		"$(consultar_http /docs/json "${corpo}")"
	# Presença da chave que identifica o documento: um 200 com corpo vazio ou com
	# a página de erro do arcabouço passaria só na asserção de código de estado.
	afirmar_igual "(c) o documento de descrição do contrato é um contrato, e não uma página qualquer" "1" \
		"$(grep -cF '"openapi"' "${corpo}" || true)"

	# --- (d) consumo de tarefa ----------------------------------------------- #
	#
	# O rótulo desta asserção é contrato com o CT-004: é por ele que o caso
	# encontra, na saída de erro, QUAL propriedade caiu quando o processador está
	# parado.
	local saida="${DIR_TEMPORARIO}/consumo.txt"
	local valor codigo=0
	valor="prova-de-fundacao-$(date +%s)-${RANDOM}"

	if ! escrever_auxiliar_de_fila; then
		falhar "(d) consumo de tarefa — não consegui montar o auxiliar de fila a partir de ${ARQ_AMBIENTE} (sem REDIS_URL?)"
		fechar_caso "SERVICOS"
		return
	fi

	executar_auxiliar_de_fila enfileirar-e-esperar "${valor}" >"${saida}" 2>&1 || codigo=$?
	afirmar_igual "(d) consumo de tarefa: a tarefa enfileirada é consumida e devolve o mesmo valor" \
		"0" "${codigo}"
	afirmar_igual "(d) consumo de tarefa: o servidor de fila registra a tarefa como concluída" "1" \
		"$(grep -c '^ESTADO=completed ' "${saida}" || true)"
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${saida}" >&2 || true
	fi

	fechar_caso "SERVICOS"
}

# =========================================================================== #
# CT-001 — Instalação das unidades executada duas vezes seguidas não duplica nem
#          sobrescreve.
#
# O retrato é tirado ENTRE as duas execuções e comparado item a item. A asserção
# sobre `NRestarts` inalterado é a que distingue idempotência real de um
# instalador que "funciona" reiniciando tudo a cada execução — comportamento que,
# em produção, transforma um `git pull` em micro-indisponibilidade.
# =========================================================================== #
retrato_das_unidades() {
	local destino="$1" unidade
	install -d -m 0700 "${destino}"
	: >"${destino}/retrato.txt"
	for unidade in "${UNIDADES[@]}"; do
		printf '%s sha256=%s habilitada=%s links=%s reinicios=%s\n' \
			"${unidade}" \
			"$(soma_ou_ausente "${DIR_UNIDADES_INSTALADAS}/${unidade}")" \
			"$(systemctl is-enabled "${unidade}" 2>/dev/null || printf 'AUSENTE')" \
			"$(contar_links_de_habilitacao "${unidade}")" \
			"$(propriedade_da_unidade "${unidade}" NRestarts)" \
			>>"${destino}/retrato.txt"
	done
}

campo_do_retrato() {
	awk -v u="$2" -v c="$3" '$1 == u { for (i = 2; i <= NF; i++) { split($i, kv, "="); if (kv[1] == c) { print kv[2]; exit } } }' \
		"$1/retrato.txt"
}

ct_001() {
	caso "CT-001" "Instalação das unidades executada duas vezes seguidas não duplica nem sobrescreve"

	local antes="${DIR_TEMPORARIO}/ct001-antes"
	local depois="${DIR_TEMPORARIO}/ct001-depois"
	local log1="${DIR_TEMPORARIO}/ct001-execucao-1.log"
	local log2="${DIR_TEMPORARIO}/ct001-execucao-2.log"

	# --- (a) as duas execuções consecutivas saem 0 --------------------------- #
	local codigo=0
	bash "${SCRIPT_INSTALAR}" >"${log1}" 2>&1 || codigo=$?
	afirmar_igual "(a) 1ª execução do instalador sai 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${log1}" >&2 || true
		falhar "(a) sem uma 1ª execução bem-sucedida, as asserções seguintes ficam sem objeto"
		fechar_caso "CT-001"
		return
	fi

	retrato_das_unidades "${antes}"

	codigo=0
	bash "${SCRIPT_INSTALAR}" >"${log2}" 2>&1 || codigo=$?
	afirmar_igual "(a) 2ª execução do instalador sai 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${log2}" >&2 || true
	fi

	retrato_das_unidades "${depois}"

	local unidade
	for unidade in "${UNIDADES[@]}"; do
		# --- (b) habilitadas no arranque ------------------------------------- #
		afirmar_igual "(b) ${unidade} habilitada no arranque após a 2ª execução" "enabled" \
			"$(campo_do_retrato "${depois}" "${unidade}" habilitada)"

		# --- (c) exatamente UM link de habilitação --------------------------- #
		# Dois é a assinatura clássica do instalador não idempotente.
		afirmar_igual "(c) exatamente 1 link de habilitação apontando para ${unidade}" "1" \
			"$(campo_do_retrato "${depois}" "${unidade}" links)"

		# --- (d) arquivo de unidade byte a byte o mesmo ---------------------- #
		afirmar_diferente "(d) o arquivo de unidade de ${unidade} existe após a 1ª execução" "AUSENTE" \
			"$(campo_do_retrato "${antes}" "${unidade}" sha256)"
		afirmar_igual "(d) SHA-256 do arquivo de unidade de ${unidade} inalterado entre as execuções" \
			"$(campo_do_retrato "${antes}" "${unidade}" sha256)" \
			"$(campo_do_retrato "${depois}" "${unidade}" sha256)"

		# --- (e) serviço saudável NÃO foi derrubado -------------------------- #
		afirmar_igual "(e) ${unidade} não foi reiniciada pela 2ª execução (NRestarts inalterado)" \
			"$(campo_do_retrato "${antes}" "${unidade}" reinicios)" \
			"$(campo_do_retrato "${depois}" "${unidade}" reinicios)"
		afirmar_igual "(e) ${unidade} está ativa ao fim da 2ª execução" "active" \
			"$(systemctl is-active "${unidade}" 2>/dev/null || true)"
	done

	# --- (f) a 2ª execução é auditável linha a linha ------------------------- #
	afirmar_igual "(f) a 2ª execução não tem NENHUMA linha de criação/alteração" "0" \
		"$(grep -cE '^\[instalar-unidades\] CRIADO ' "${log2}" || true)"

	# --- (g) as unidades versionadas são válidas, e sem aviso ---------------- #
	local saida_verify
	for unidade in "${UNIDADES[@]}"; do
		saida_verify="${DIR_TEMPORARIO}/ct001-verify-${unidade}.txt"
		codigo=0
		systemd-analyze verify "${DIR_FONTE_UNIDADES}/${unidade}" >"${saida_verify}" 2>&1 || codigo=$?
		afirmar_igual "(g) systemd-analyze verify sai 0 para ${unidade}" "0" "${codigo}"
		afirmar_igual "(g) systemd-analyze verify não emite aviso para ${unidade}" "" \
			"$(cat "${saida_verify}")"
	done

	# --- (h) controle de falibilidade ---------------------------------------- #
	#
	# Sem ele, um `verify` que sempre retornasse 0 e sempre calasse (binário
	# ausente, caminho errado, saída redirecionada) passaria despercebido e a
	# asserção (g) seria infalível (AP-29). São DOIS mutantes porque (g) faz DUAS
	# afirmações independentes, e cada uma precisa do seu falsificador:
	#
	#   sem ExecStart      -> `verify` sai != 0            (falsifica "sai 0")
	#   Restart inválido   -> `verify` sai 0 COM aviso     (falsifica "sem aviso")
	local mutante_codigo="${DIR_TEMPORARIO}/ct001-mutante-codigo.service"
	local mutante_aviso="${DIR_TEMPORARIO}/ct001-mutante-aviso.service"
	grep -v '^ExecStart=' "${DIR_FONTE_UNIDADES}/${UNIDADE_API}" >"${mutante_codigo}"
	sed 's|^Restart=always$|Restart=diretiva-invalida|' \
		"${DIR_FONTE_UNIDADES}/${UNIDADE_API}" >"${mutante_aviso}"

	codigo=0
	systemd-analyze verify "${mutante_codigo}" >/dev/null 2>&1 || codigo=$?
	afirmar_diferente "(h) sobre a cópia sem ExecStart, systemd-analyze verify sai != 0" "0" "${codigo}"

	saida_verify="${DIR_TEMPORARIO}/ct001-verify-mutante-aviso.txt"
	systemd-analyze verify "${mutante_aviso}" >"${saida_verify}" 2>&1 || true
	afirmar_diferente "(h) sobre a cópia com diretiva inválida, systemd-analyze verify EMITE aviso" "" \
		"$(cat "${saida_verify}")"

	rm -f "${mutante_codigo}" "${mutante_aviso}"

	fechar_caso "CT-001"
}

# =========================================================================== #
# CT-007 — A decisão de idempotência do instalador, exercitada como função pura.
#
# CAUSA-RAIZ de ser caso PRÓPRIO, e não mais uma ponta do CT-001: as asserções
# (c), (d) e (e) daquele caso provam o EFEITO da idempotência sobre o estado do
# sistema, e provam bem — mas só rodam com privilégio, contra o sistema real,
# depois de duas execuções do instalador. A DECISÃO que as produz ("escrever só
# quando o destino diverge da fonte") vive numa função pura, não toca o sistema e
# não depende de execução nenhuma ter dado certo. Enquanto ela era a nona ponta
# do CT-001, uma falha da 1ª execução do instalador levava junto, pelo `return`
# antecipado, a única prova que não precisava dela — e o caso carregava duas
# naturezas de asserção sob um rótulo só.
#
# A tabela carrega a função REAL do arquivo real e a exercita nas quatro
# situações que ela precisa discriminar — as duas últimas são o falsificador das
# duas primeiras.
# =========================================================================== #
ct_007() {
	caso "CT-007" "A decisão de idempotência do instalador, exercitada como função pura"

	local fn trecho carregou=1
	for fn in unidade_diverge; do
		trecho="$(sed -n "/^${fn}() {/,/^}/p" "${SCRIPT_INSTALAR}")"
		if [[ -z "${trecho}" ]]; then
			carregou=0
			break
		fi
		eval "${trecho}"
		[[ "$(type -t "${fn}")" == "function" ]] || carregou=0
	done

	if [[ "${carregou}" -eq 0 ]]; then
		falhar "(a) não consegui carregar 'unidade_diverge' de ${SCRIPT_INSTALAR} — sem ela a tabela ficaria sem SUT e passaria vazia"
	else
		ok "(a) função de decisão de idempotência carregada de ${SCRIPT_INSTALAR##*/}"
		local sonda="${DIR_TEMPORARIO}/ct007-sonda"
		install -d -m 0700 "${sonda}"
		local origem="${DIR_FONTE_UNIDADES}/${UNIDADE_API}"

		install -m 0644 -o root -g root "${origem}" "${sonda}/identica"
		afirmar_igual "(b) destino idêntico em conteúdo, modo e dono: NÃO diverge" "1" \
			"$(unidade_diverge "${origem}" "${sonda}/identica" 0644 root root && echo 0 || echo 1)"

		install -m 0644 -o root -g root "${origem}" "${sonda}/conteudo"
		printf '# linha acrescentada pela sonda do CT-007\n' >>"${sonda}/conteudo"
		afirmar_igual "(c) destino com conteúdo diferente: DIVERGE" "0" \
			"$(unidade_diverge "${origem}" "${sonda}/conteudo" 0644 root root && echo 0 || echo 1)"

		install -m 0600 -o root -g root "${origem}" "${sonda}/modo"
		afirmar_igual "(d) destino com conteúdo igual e MODO diferente: DIVERGE" "0" \
			"$(unidade_diverge "${origem}" "${sonda}/modo" 0644 root root && echo 0 || echo 1)"

		afirmar_igual "(e) destino inexistente: DIVERGE" "0" \
			"$(unidade_diverge "${origem}" "${sonda}/inexistente" 0644 root root && echo 0 || echo 1)"

		rm -rf "${sonda}"
	fi

	fechar_caso "CT-007"
}

# =========================================================================== #
# CT-002 — Encerrar abruptamente o processo da aplicação faz o supervisor
#          trazê-lo de volta sozinho.
#
# A asserção `NRestarts == N+1` (e não apenas `is-active == active`) é o que dá
# valor ao caso: um serviço em laço de reinício também aparece como `active` num
# instante afortunado da sondagem. A releitura ${ESPERA_ANTI_LACO_S}s depois
# separa recuperação de oscilação.
#
# O sinal é NÃO CAPTURÁVEL de propósito: um encerramento gracioso testaria o
# desligamento da aplicação, não a recuperação pelo supervisor.
# =========================================================================== #
ct_002() {
	caso "CT-002" "Encerrar abruptamente o processo da aplicação faz o supervisor trazê-lo de volta sozinho"

	local corpo="${DIR_TEMPORARIO}/ct002-corpo.txt"

	# --- pré-condição do caso ------------------------------------------------ #
	afirmar_igual "pré-condição: ${UNIDADE_API} está ativa antes do caso" "active" \
		"$(systemctl is-active "${UNIDADE_API}" 2>/dev/null || true)"
	afirmar_igual "pré-condição: GET /saude responde 200 antes do caso" "200" \
		"$(consultar_http /saude "${corpo}")"

	local p1 n
	p1="$(propriedade_da_unidade "${UNIDADE_API}" MainPID)"
	n="$(propriedade_da_unidade "${UNIDADE_API}" NRestarts)"
	if [[ ! "${p1}" =~ ^[0-9]+$ ]] || [[ "${p1}" -eq 0 ]]; then
		falhar "não consegui ler o identificador do processo principal de ${UNIDADE_API} — obtido [${p1}]"
		fechar_caso "CT-002"
		return
	fi
	nota "processo principal antes do encerramento: ${p1} · reinícios contabilizados: ${n}"

	# --- o encerramento abrupto ---------------------------------------------- #
	kill -KILL "${p1}"

	# --- (a) o supervisor traz o serviço de volta, sem comando manual -------- #
	#
	# Sondagem por estado observável contra o limite declarado, nunca espera fixa.
	if sondar_ate "${LIMITE_RECUPERACAO_S}" bash -c \
		"[[ \"\$(systemctl is-active ${UNIDADE_API} 2>/dev/null)\" == active ]]"; then
		ok "(a) ${UNIDADE_API} voltou a 'active' dentro de ${LIMITE_RECUPERACAO_S}s, sem nenhum comando de partida"
	else
		falhar "(a) ${UNIDADE_API} não voltou a 'active' em ${LIMITE_RECUPERACAO_S}s — obtido [$(systemctl is-active "${UNIDADE_API}" 2>/dev/null || true)]"
	fi

	# --- (b) e a rota de saúde volta a responder ----------------------------- #
	if sondar_ate "${LIMITE_RECUPERACAO_S}" bash -c \
		"[[ \"\$(curl -sS --max-time ${LIMITE_HTTP_S} -o /dev/null -w '%{http_code}' http://${ENDERECO_DA_APLICACAO}:$(porta_da_aplicacao)/saude 2>/dev/null)\" == 200 ]]"; then
		ok "(b) GET /saude voltou a responder 200 dentro de ${LIMITE_RECUPERACAO_S}s"
	else
		falhar "(b) GET /saude não voltou a responder 200 em ${LIMITE_RECUPERACAO_S}s"
	fi
	afirmar_igual "(b) GET /saude responde 200 com corpo não-vazio" "200" \
		"$(consultar_http /saude "${corpo}")"
	afirmar_diferente "(b) o corpo de GET /saude não é vazio" "0" \
		"$(wc -c <"${corpo}" | tr -d ' ')"

	# --- (c) é OUTRO processo, e é o processo principal da unidade ----------- #
	local p2
	p2="$(propriedade_da_unidade "${UNIDADE_API}" MainPID)"
	afirmar_diferente "(c) o processo principal é outro (P2 != P1)" "${p1}" "${p2}"
	afirmar_diferente "(c) o processo principal existe (P2 != 0)" "0" "${p2}"

	# --- (d) exatamente UM reinício ------------------------------------------ #
	# Mais de um indicaria que o serviço subiu e caiu de novo.
	afirmar_igual "(d) o supervisor contabilizou exatamente um reinício (N+1)" \
		"$((n + 1))" "$(propriedade_da_unidade "${UNIDADE_API}" NRestarts)"

	# --- (e) e não é laço ----------------------------------------------------- #
	nota "aguardando ${ESPERA_ANTI_LACO_S}s para descartar laço de reinício"
	sleep "${ESPERA_ANTI_LACO_S}"
	afirmar_igual "(e) ${ESPERA_ANTI_LACO_S}s depois, o contador de reinícios continua em N+1 — não há laço" \
		"$((n + 1))" "$(propriedade_da_unidade "${UNIDADE_API}" NRestarts)"
	afirmar_igual "(e) o processo principal continua sendo o mesmo P2" "${p2}" \
		"$(propriedade_da_unidade "${UNIDADE_API}" MainPID)"

	fechar_caso "CT-002"
}

# =========================================================================== #
# CT-003 — Configuração obrigatória ausente faz a partida falhar nomeando a
#          variável, sem laço de reinício.
#
# É o companheiro negativo do CT-002 e o caso de maior alcance de dano desta
# task: `Restart=always` combinado com erro de configuração produz laço de
# reinício que consome CPU e enche o journal — num servidor que atende a
# operação, isso é incidente, não inconveniente. A dupla leitura de `NRestarts`
# é a única asserção que distingue "falhou e parou" de "falha para sempre".
#
# ---------------------------------------------------------------------------
# Divergência DELIBERADA do card: o caso roda contra as DUAS unidades
# ---------------------------------------------------------------------------
#
# O card da §5.6 é escrito no singular e usa como dado de entrada a remoção da
# "variável de conexão com o banco". `DATABASE_URL` é justamente a variável que o
# PROCESSADOR não lê (`apps/worker/src/main.ts` valida `LOG_LEVEL` e
# `REDIS_URL`, e só): executado contra `sysloc-worker` com esse dado, o caso
# veria o processo subir normalmente e provaria o CONTRÁRIO do que afirma. Cada
# unidade é exercitada com uma variável que o seu PRÓPRIO processo exige —
# `DATABASE_URL` para a aplicação, `REDIS_URL` para o processador.
#
# ---------------------------------------------------------------------------
# O arquivo de ambiente de prova NÃO carrega credencial
# ---------------------------------------------------------------------------
#
# O card pede um arquivo "completo, exceto por uma variável obrigatória
# removida". Aqui "completo" é lido como "completo do ponto de vista do processo
# sob prova": o arquivo de prova conserva apenas as chaves que AQUELE processo
# consome, menos a removida. Para a aplicação isso deixa `REDIS_URL` (que não
# carrega segredo) e tira `DATABASE_URL`; para o processador não sobra nada,
# porque `DATABASE_URL` não é consumida por ele. O poder discriminante é
# idêntico — o processo falha nomeando exatamente a variável removida — e a
# credencial real nunca é copiada para lugar nenhum.
# =========================================================================== #

# Chaves que cada processo consome do arquivo de ambiente. Derivado da validação
# de partida de cada um; é o que define o que o arquivo de prova conserva.
chaves_consumidas_por() {
	case "$1" in
	"${UNIDADE_API}") printf 'DATABASE_URL REDIS_URL' ;;
	"${UNIDADE_WORKER}") printf 'REDIS_URL' ;;
	*) return 1 ;;
	esac
}

variavel_removida_de() {
	case "$1" in
	"${UNIDADE_API}") printf 'DATABASE_URL' ;;
	"${UNIDADE_WORKER}") printf 'REDIS_URL' ;;
	*) return 1 ;;
	esac
}

ct_003() {
	caso "CT-003" "Configuração obrigatória ausente faz a partida falhar nomeando a variável, sem laço de reinício"

	local -A estado_producao=() reinicios_producao=()
	local -A unidade_de_prova=() variavel_faltante=() reinicios_prova=()
	local unidade prova faltante env_prova porta_prova

	# --- estado da PRODUÇÃO antes do caso ------------------------------------ #
	for unidade in "${UNIDADES[@]}"; do
		estado_producao["${unidade}"]="$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		reinicios_producao["${unidade}"]="$(propriedade_da_unidade "${unidade}" NRestarts)"
	done

	# --- fase 1: instalar as unidades de prova e deixá-las convergir --------- #
	for unidade in "${UNIDADES[@]}"; do
		prova="${unidade%.service}-prova-config.service"
		faltante="$(variavel_removida_de "${unidade}")"
		unidade_de_prova["${unidade}"]="${prova}"
		variavel_faltante["${unidade}"]="${faltante}"

		env_prova="${DIR_TEMPORARIO}/${prova}.env"
		install -m 0600 -o root -g root /dev/null "${env_prova}"
		{
			printf '# Arquivo de ambiente de PROVA, gerado pelo CT-003 de verificar-fundacao.sh.\n'
			printf '# Conserva apenas as chaves que %s consome, MENOS %s.\n' "${unidade}" "${faltante}"
			local chave
			for chave in $(chaves_consumidas_por "${unidade}"); do
				[[ "${chave}" != "${faltante}" ]] || continue
				grep -E "^${chave}=" "${ARQ_AMBIENTE}" || true
			done
		} >>"${env_prova}"

		# Registrada ANTES de qualquer escrita em /etc: o trap precisa saber
		# removê-la mesmo que a instalação falhe no meio.
		UNIDADES_DE_PROVA+=("${prova}")

		# A porta é distinta da de produção para não disputar socket, ainda que o
		# processo sob prova nunca chegue a escutar.
		porta_prova="$(porta_livre_para_prova)" || porta_prova=""
		if [[ -z "${porta_prova}" ]]; then
			falhar "não encontrei porta livre em ${PORTA_PROVA_INICIAL}-${PORTA_PROVA_FINAL} para a unidade de prova"
			fechar_caso "CT-003"
			return
		fi

		sed -e "s|^EnvironmentFile=.*|EnvironmentFile=${env_prova}|" \
			-e "s|^Environment=PORT=.*|Environment=PORT=${porta_prova}|" \
			-e "s|^Description=.*|Description=PROVA do CT-003 sobre ${unidade} — instalada e removida pela bateria|" \
			"${DIR_FONTE_UNIDADES}/${unidade}" >"${DIR_TEMPORARIO}/${prova}"
		install -m 0644 -o root -g root "${DIR_TEMPORARIO}/${prova}" \
			"${DIR_UNIDADES_INSTALADAS}/${prova}"
	done

	systemctl daemon-reload

	for unidade in "${UNIDADES[@]}"; do
		prova="${unidade_de_prova[${unidade}]}"
		local codigo=0
		systemctl start "${prova}" >/dev/null 2>&1 || codigo=$?
		nota "${prova}: 'systemctl start' devolveu ${codigo} (Type=simple devolve assim que o processo é criado)"
	done

	# --- (a) convergência para estado TERMINAL ------------------------------- #
	for unidade in "${UNIDADES[@]}"; do
		prova="${unidade_de_prova[${unidade}]}"
		if sondar_ate "${LIMITE_CONVERGENCIA_FALHA_S}" bash -c \
			"[[ \"\$(systemctl show -p ActiveState --value ${prova} 2>/dev/null)\" == failed ]]"; then
			ok "(a) ${prova} convergiu para estado terminal dentro de ${LIMITE_CONVERGENCIA_FALHA_S}s"
		else
			falhar "(a) ${prova} não convergiu para 'failed' em ${LIMITE_CONVERGENCIA_FALHA_S}s — obtido [$(propriedade_da_unidade "${prova}" ActiveState)]; com Restart=always isso é laço de reinício indefinido"
		fi

		afirmar_igual "(a) ${prova} termina em 'failed'" "failed" \
			"$(propriedade_da_unidade "${prova}" ActiveState)"

		# --- (b) o desfecho é de FALHA DO PROCESSO, não outra coisa ---------- #
		local resultado
		resultado="$(propriedade_da_unidade "${prova}" Result)"
		if [[ "${resultado}" == "exit-code" || "${resultado}" == "start-limit-hit" ]]; then
			ok "(b) ${prova} termina com Result='${resultado}'"
		else
			falhar "(b) ${prova} termina com Result='${resultado}', e o esperado é 'exit-code' ou 'start-limit-hit'"
		fi
		# O código do processo é conferido como NÚMERO diferente de zero, e não por
		# desigualdade textual: uma leitura vazia (unidade sumiu, propriedade não
		# existe) também é "diferente de 0" e passaria sem ter medido nada.
		local codigo_do_processo
		codigo_do_processo="$(propriedade_da_unidade "${prova}" ExecMainStatus)"
		afirmar_igual "(b) o processo de ${prova} sai com código numérico != 0 (obtido [${codigo_do_processo}])" "1" \
			"$([[ "${codigo_do_processo}" =~ ^[0-9]+$ && "${codigo_do_processo}" -ne 0 ]] && echo 1 || echo 0)"

		# --- (c) o journal NOMEIA a variável ausente ------------------------- #
		#
		# Mensagem genérica do tipo "configuração inválida" reprova: ela não
		# permite corrigir sem depurar.
		faltante="${variavel_faltante[${unidade}]}"
		local diario="${DIR_TEMPORARIO}/journal-${prova}.txt"
		journalctl -u "${prova}" --since "${INICIO_DA_BATERIA}" --no-pager -o cat >"${diario}" 2>/dev/null || true
		afirmar_diferente "(c) o journal de ${prova} nomeia a variável ausente '${faltante}'" "0" \
			"$(grep -cF "${faltante}" "${diario}" || true)"

		reinicios_prova["${unidade}"]="$(propriedade_da_unidade "${prova}" NRestarts)"

		# --- (d) o supervisor DESISTIU dentro do limite declarado ------------ #
		local limite_declarado
		limite_declarado="$(sed -n 's|^StartLimitBurst=\(.*\)$|\1|p' "${DIR_FONTE_UNIDADES}/${unidade}" | head -1)"
		if [[ ! "${limite_declarado}" =~ ^[0-9]+$ ]]; then
			falhar "(d) ${unidade} não declara 'StartLimitBurst=' — sem ele os padrões da distribuição não fecham o laço com RestartSec=5"
		else
			afirmar_igual "(d) ${prova} parou de reiniciar dentro do limite declarado (StartLimitBurst=${limite_declarado})" "1" \
				"$([[ "${reinicios_prova[${unidade}]}" -le "${limite_declarado}" ]] && echo 1 || echo 0)"
		fi
	done

	# --- (e) e o laço NÃO acontece: a segunda leitura, uma só espera --------- #
	nota "aguardando ${ESPERA_ANTI_LACO_S}s para reler o contador de reinícios das unidades de prova"
	sleep "${ESPERA_ANTI_LACO_S}"
	for unidade in "${UNIDADES[@]}"; do
		prova="${unidade_de_prova[${unidade}]}"
		afirmar_igual "(e) ${ESPERA_ANTI_LACO_S}s depois, ${prova} não acumulou reinício — não há laço indefinido" \
			"${reinicios_prova[${unidade}]}" "$(propriedade_da_unidade "${prova}" NRestarts)"
	done

	# --- (f) falha de partida não despeja a configuração no journal ---------- #
	#
	# Está aqui porque falha de partida é exatamente quando aplicações costumam
	# despejar a configuração inteira no log.
	local credencial
	if credencial="$(ler_credencial_db "${ARQ_AMBIENTE}")"; then
		# A agulha vem do leitor do provisionamento, carregado do arquivo real —
		# ver `carregar_leitor_do_provisionador`.
		for unidade in "${UNIDADES[@]}"; do
			prova="${unidade_de_prova[${unidade}]}"
			afirmar_igual "(f) o journal de ${prova} não contém a credencial" "0" \
				"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${DIR_TEMPORARIO}/journal-${prova}.txt")"
		done
		unset credencial
	else
		falhar "(f) não foi possível ler uma credencial íntegra de ${ARQ_AMBIENTE}, ou o leitor do provisionamento não pôde ser carregado (a saída de erro acima diz qual) — o caso não tem agulha confiável para procurar no journal"
	fi

	# --- limpeza das unidades de prova --------------------------------------- #
	for unidade in "${UNIDADES[@]}"; do
		prova="${unidade_de_prova[${unidade}]}"
		systemctl stop "${prova}" >/dev/null 2>&1 || true
		systemctl reset-failed "${prova}" >/dev/null 2>&1 || true
		rm -f "${DIR_UNIDADES_INSTALADAS}/${prova}"
		rm -rf "${DIR_UNIDADES_INSTALADAS}/${prova}.d"
	done
	UNIDADES_DE_PROVA=()
	systemctl daemon-reload

	afirmar_igual "nenhum arquivo de unidade de prova permanece em ${DIR_UNIDADES_INSTALADAS}" "0" \
		"$(find "${DIR_UNIDADES_INSTALADAS}" -maxdepth 1 -name '*-prova-config.service' | grep -c . || true)"

	# --- (g) a unidade de PRODUÇÃO não foi afetada --------------------------- #
	for unidade in "${UNIDADES[@]}"; do
		afirmar_igual "(g) ${unidade} (produção) segue no mesmo estado de antes do caso" \
			"${estado_producao[${unidade}]}" "$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		afirmar_igual "(g) ${unidade} (produção) segue com o contador de reinícios inalterado" \
			"${reinicios_producao[${unidade}]}" "$(propriedade_da_unidade "${unidade}" NRestarts)"
	done

	fechar_caso "CT-003"
}

# =========================================================================== #
# CT-004 — O código de saída desta bateria é FIEL: verde só quando tudo passa.
#
# Sem este caso, `verificar-fundacao.sh` poderia retornar 0 incondicionalmente e
# a fatia inteira seria declarada aprovada por um script que não sabe reprovar —
# o cenário mais caro possível numa fatia cuja entrega É a prova. A transição
# 0 -> != 0 -> 0 é a asserção central.
#
# A dependência derrubada é o PROCESSADOR, e a escolha não é arbitrária: é o
# serviço novo cuja parada não afeta nada, ao contrário do banco (compartilhado
# com a verificação) e da fila (usada por T2 e T4).
# =========================================================================== #
executar_sub_bateria_de_servicos() {
	local saida_padrao="$1" saida_erro="$2"
	local codigo=0
	timeout --kill-after=15s "${LIMITE_BATERIA_SERVICOS_S}" \
		bash "${BASH_SOURCE[0]}" servicos >"${saida_padrao}" 2>"${saida_erro}" </dev/null || codigo=$?
	printf '%s' "${codigo}"
}

ct_004() {
	caso "CT-004" "Código de saída de verificar-fundacao.sh é fiel — verde só quando tudo passa"

	local out1="${DIR_TEMPORARIO}/ct004-1.out" err1="${DIR_TEMPORARIO}/ct004-1.err"
	local out2="${DIR_TEMPORARIO}/ct004-2.out" err2="${DIR_TEMPORARIO}/ct004-2.err"
	local out3="${DIR_TEMPORARIO}/ct004-3.out" err3="${DIR_TEMPORARIO}/ct004-3.err"

	# --- (a) estado íntegro: sai 0 e declara tudo aprovado ------------------- #
	local codigo
	codigo="$(executar_sub_bateria_de_servicos "${out1}" "${err1}")"
	afirmar_igual "(a) estado íntegro: a sub-bateria de serviço sai 0" "0" "${codigo}"
	afirmar_igual "(a) estado íntegro: a linha final declara a contagem de falhas em 0" "1" \
		"$(grep -c '0 falha(s)' "${out1}" || true)"
	afirmar_igual "(a) estado íntegro: a linha final declara todos os casos aprovados" "1" \
		"$(grep -cF '1/1 caso(s) aprovado(s)' "${out1}" || true)"
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${err1}" >&2 || true
		falhar "(a) sem um estado íntegro de partida, a transição que este caso mede não tem objeto"
		fechar_caso "CT-004"
		return
	fi

	# --- o processador parado, pelo mesmo comando que um administrador usaria - #
	# O trap já está armado (`PROCESSADOR_PARADO_PELO_CASO`) e restaura o serviço
	# mesmo se o caso for interrompido.
	PROCESSADOR_PARADO_PELO_CASO=1
	systemctl stop "${UNIDADE_WORKER}"
	afirmar_diferente "o processador está parado durante a segunda execução" "active" \
		"$(systemctl is-active "${UNIDADE_WORKER}" 2>/dev/null || true)"

	# --- (b) com a dependência derrubada: sai != 0 --------------------------- #
	codigo="$(executar_sub_bateria_de_servicos "${out2}" "${err2}")"
	afirmar_diferente "(b) com o processador parado: a sub-bateria sai != 0" "0" "${codigo}"

	# 124/137 é o código do estouro de limite: a bateria travou à espera de uma
	# tarefa que nunca seria consumida, em vez de reprovar.
	afirmar_igual "(b) a sub-bateria termina dentro do limite de ${LIMITE_BATERIA_SERVICOS_S}s, sem travar" "0" \
		"$([[ "${codigo}" -eq 124 || "${codigo}" -eq 137 ]] && echo 1 || echo 0)"

	# --- (c) a saída de erro NOMEIA o caso que caiu -------------------------- #
	# Mensagem agregada do tipo "a verificação falhou" reprova aqui, e com razão.
	afirmar_diferente "(c) a saída de erro nomeia especificamente o consumo de tarefa" "0" \
		"$(grep -c 'consumo de tarefa' "${err2}" || true)"

	local falhas_relatadas
	falhas_relatadas="$(sed -n 's|^verificar-fundacao/servicos: \([0-9]\{1,\}\) falha.*|\1|p' "${err2}" | head -1)"
	afirmar_igual "(c) a contagem de falhas relatada é maior ou igual a 1" "1" \
		"$([[ "${falhas_relatadas:-0}" -ge 1 ]] && echo 1 || echo 0)"
	nota "(c) falhas relatadas pela sub-bateria com o processador parado: ${falhas_relatadas:-<não relatada>}"

	# --- o processador de volta ---------------------------------------------- #
	systemctl start "${UNIDADE_WORKER}"
	PROCESSADOR_PARADO_PELO_CASO=0
	if sondar_ate "${LIMITE_RECUPERACAO_S}" bash -c \
		"[[ \"\$(systemctl is-active ${UNIDADE_WORKER} 2>/dev/null)\" == active ]]"; then
		ok "o processador voltou a 'active' dentro de ${LIMITE_RECUPERACAO_S}s"
	else
		falhar "o processador não voltou a 'active' em ${LIMITE_RECUPERACAO_S}s"
	fi

	# --- (d) restaurado: volta a sair 0 -------------------------------------- #
	codigo="$(executar_sub_bateria_de_servicos "${out3}" "${err3}")"
	afirmar_igual "(d) com o processador restaurado: a sub-bateria volta a sair 0" "0" "${codigo}"
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/         /' "${err3}" >&2 || true
	fi

	# --- (e) o caso não deixa o sistema pior do que encontrou ---------------- #
	afirmar_igual "(e) ${UNIDADE_WORKER} está ativa ao encerrar o caso" "active" \
		"$(systemctl is-active "${UNIDADE_WORKER}" 2>/dev/null || true)"

	fechar_caso "CT-004"
}

# =========================================================================== #
# CT-005 — Nenhuma credencial nas unidades, na árvore versionada, no ambiente
#          exposto pelo supervisor nem no journal.
#
# A credencial existe apenas em ${ARQ_AMBIENTE}, com modo 0600, referenciado por
# `EnvironmentFile=`. Em nenhuma saída deste caso ela aparece: as varreduras
# imprimem `arquivo:linha` ou contagem, nunca o valor.
#
# A asserção (g) é o que impede a asserção infalível (AP-29): uma varredura com
# expressão errada devolve 0 ocorrências para sempre e passaria despercebida.
# Ela cobre o VARREDOR; quem cobre a AGULHA é outra coisa, e de propósito: a
# agulha sai do leitor do provisionamento carregado do arquivo real, e esse leitor
# é o SUT da tabela (i)/(j)/(k) do CT-003 de `verificar-provisionamento.sh`, que a
# agregação executa antes deste caso. Ver `carregar_leitor_do_provisionador`.
# =========================================================================== #

# Varre UMA unidade por segredo embutido e pela referência externa obrigatória.
# Imprime cada ocorrência como `arquivo:linha` na saída de erro — jamais o
# conteúdo da linha. Devolve 0 (limpa) ou 1 (reprovada).
#
# É o SUT das asserções de falsificação: a mesma função que aprova as unidades
# reais precisa reprovar cada cópia com o defeito de volta.
varrer_unidade_por_segredo() {
	local unidade="$1" raiz="$2"
	local reprovacoes=0 linhas=""

	# (1) atribuição literal de segredo, em qualquer diretiva.
	linhas="$(grep -nE '(PASSWORD|SENHA|SECRET|TOKEN|CREDENCIAL)[[:space:]]*=[[:space:]]*[^$]' \
		"${unidade}" | cut -d: -f1 | tr '\n' ' ' || true)"
	if [[ -n "${linhas// /}" ]]; then
		printf 'atribuição literal de segredo em %s:%s\n' "${unidade}" "${linhas% }" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (2) `Environment=` carregando cadeia de conexão com segredo embutido. É o
	# caminho que a asserção (1) não alcança: a unidade pode não ter literal
	# nomeado de senha e ainda assim expor o segredo dentro de uma URL.
	linhas="$(grep -nE '^Environment=[A-Za-z_][A-Za-z0-9_]*=[a-z][a-z0-9+.-]*://[^[:space:]]*:[^[:space:]@/]+@' \
		"${unidade}" | cut -d: -f1 | tr '\n' ' ' || true)"
	if [[ -n "${linhas// /}" ]]; then
		printf 'cadeia de conexão com segredo embutido em %s:%s\n' "${unidade}" "${linhas% }" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (3) o segredo PRECISA vir de fonte externa: ao menos um `EnvironmentFile=`,
	# e nenhum deles apontando para dentro da árvore versionada.
	local -a arquivos=()
	mapfile -t arquivos < <(sed -n 's|^EnvironmentFile=-\{0,1\}\(.*\)$|\1|p' "${unidade}")
	if [[ "${#arquivos[@]}" -eq 0 ]]; then
		printf 'nenhum EnvironmentFile= declarado em %s — não há de onde vir o segredo\n' "${unidade}" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	local arquivo
	for arquivo in "${arquivos[@]}"; do
		if [[ "${arquivo}" == "${raiz}"/* ]]; then
			printf 'EnvironmentFile= dentro da árvore versionada em %s: %s\n' "${unidade}" "${arquivo}" >&2
			reprovacoes=$((reprovacoes + 1))
		fi
	done

	[[ "${reprovacoes}" -eq 0 ]]
}

ct_005() {
	caso "CT-005" "Nenhuma credencial nas unidades, na árvore versionada, no ambiente do supervisor nem no journal"

	local unidade

	# --- (a) e (b) as unidades versionadas, pela varredura ------------------- #
	for unidade in "${UNIDADES[@]}"; do
		if varrer_unidade_por_segredo "${DIR_FONTE_UNIDADES}/${unidade}" "${RAIZ_REPO}" \
			2>"${DIR_TEMPORARIO}/ct005-varredura-${unidade}.log"; then
			ok "(a)(b) ${unidade} passa limpa na varredura de segredo e declara fonte externa"
		else
			falhar "(a)(b) ${unidade} REPROVOU na varredura de segredo"
			sed 's/^/         /' "${DIR_TEMPORARIO}/ct005-varredura-${unidade}.log" >&2 || true
		fi
	done

	# A forma literal que o card da §5.6 fixa, aplicada ao diretório inteiro.
	#
	# `-h` não é detalhe: com mais de um arquivo, `grep -c` prefixa a contagem com
	# o nome de cada arquivo (`caminho:0`), e a comparação com "0" reprovaria
	# SEMPRE — inclusive com as unidades limpas. Contar as linhas casadas depois de
	# suprimir o prefixo é o que devolve um número único e comparável.
	afirmar_igual "(a) nenhuma atribuição literal de segredo em deploy/systemd/*.service" "0" \
		"$(grep -hE '(PASSWORD|SENHA|SECRET|TOKEN|CREDENCIAL)[[:space:]]*=[[:space:]]*[^$]' \
			"${DIR_FONTE_UNIDADES}"/*.service | grep -c . || true)"

	# --- (c) o arquivo apontado é o de permissão restrita -------------------- #
	if [[ ! -f "${ARQ_AMBIENTE}" ]]; then
		falhar "(c) ${ARQ_AMBIENTE} não existe — as asserções seguintes ficariam sem objeto"
		fechar_caso "CT-005"
		return
	fi
	afirmar_igual "(c) o arquivo de ambiente apontado por EnvironmentFile= tem modo ${MODO_ARQ_AMBIENTE}" \
		"${MODO_ARQ_AMBIENTE}" "$(stat -c '%a' "${ARQ_AMBIENTE}")"

	local credencial
	if ! credencial="$(ler_credencial_db "${ARQ_AMBIENTE}")"; then
		falhar "não foi possível ler uma credencial íntegra de ${ARQ_AMBIENTE} — ausente, ilegível, com caractere fora de [A-Za-z0-9], ou o leitor do provisionamento não pôde ser carregado (a saída de erro acima diz qual); o caso não tem agulha confiável para procurar"
		fechar_caso "CT-005"
		return
	fi

	# --- (d) a árvore versionada não carrega a credencial -------------------- #
	local achados codigo=0
	achados="$(printf '%s\n' "${credencial}" | varrer_arvore_versionada "${RAIZ_REPO}")" || codigo=$?
	afirmar_igual "(d) a varredura da árvore versionada não encontra a credencial" "0" "${codigo}"
	if [[ -n "${achados}" ]]; then
		falhar "(d) ocorrências na árvore versionada: ${achados}"
	fi

	# --- (e) o ambiente que o SUPERVISOR expõe ------------------------------- #
	#
	# Caminho distinto do (a): a unidade pode não ter literal algum e ainda assim
	# expor o segredo se alguém acrescentar `Environment=` por sobreposição
	# (drop-in), que não passa pelo arquivo versionado.
	local exposto="${DIR_TEMPORARIO}/ct005-ambiente-exposto.txt"
	: >"${exposto}"
	for unidade in "${UNIDADES[@]}"; do
		printf '%s %s\n' "${unidade}" "$(propriedade_da_unidade "${unidade}" Environment)" >>"${exposto}"
	done
	afirmar_igual "(e) o ambiente que o supervisor expõe para as duas unidades não contém a credencial" "0" \
		"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${exposto}")"

	# --- (f) o journal das duas unidades na janela do caso ------------------- #
	#
	# É a asserção que costuma pegar vazamento real: a aplicação registra a cadeia
	# de conexão inteira na partida, credencial embutida, e ninguém olha o journal.
	local diario="${DIR_TEMPORARIO}/ct005-journal.txt"
	: >"${diario}"
	for unidade in "${UNIDADES[@]}"; do
		journalctl -u "${unidade}" --since "${INICIO_DA_BATERIA}" --no-pager -o cat >>"${diario}" 2>/dev/null || true
	done
	nota "(f) janela do journal: desde ${INICIO_DA_BATERIA} · $(wc -l <"${diario}" | tr -d ' ') linha(s)"
	afirmar_igual "(f) o journal das duas unidades na janela do caso não contém a credencial" "0" \
		"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${diario}")"

	unset credencial

	# --- (g) prova de falsificação ------------------------------------------- #
	#
	# Duas frentes, porque as asserções acima medem duas coisas independentes: a
	# varredura das UNIDADES e a varredura da ÁRVORE. Cada uma precisa do seu
	# falsificador; aprovar uma e deixar a outra sem controle é o mesmo defeito
	# repetido pela metade.
	#
	# As linhas defeituosas são montadas em pedaços de propósito: escritas
	# inteiras, o texto deste verificador casaria com os próprios padrões que ele
	# procura.
	local mutante indice
	local -a defeitos=(
		"atribuição literal de segredo numa diretiva"
		"cadeia de conexão com segredo embutido em Environment="
		"nenhum EnvironmentFile= declarado"
		"EnvironmentFile= apontando para dentro da árvore versionada"
	)
	for indice in "${!defeitos[@]}"; do
		mutante="${DIR_TEMPORARIO}/ct005-mutante-${indice}.service"
		cp "${DIR_FONTE_UNIDADES}/${UNIDADE_API}" "${mutante}"
		case "${indice}" in
		0) printf 'Environment=DB_PASS%s%s\n' 'WORD=' 's3nh4Sintetica' >>"${mutante}" ;;
		1) printf 'Environment=DATABASE_URL=postgres%s://papel:%s@/banco\n' 'ql' 's3nh4Sintetica' >>"${mutante}" ;;
		2) grep -v '^EnvironmentFile=' "${DIR_FONTE_UNIDADES}/${UNIDADE_API}" >"${mutante}" ;;
		3) sed "s|^EnvironmentFile=.*|EnvironmentFile=${RAIZ_REPO}/backend.env|" \
			"${DIR_FONTE_UNIDADES}/${UNIDADE_API}" >"${mutante}" ;;
		esac

		if varrer_unidade_por_segredo "${mutante}" "${RAIZ_REPO}" 2>/dev/null; then
			falhar "(g) a varredura de unidade APROVOU uma cópia com o defeito de volta (${defeitos[${indice}]}) — a asserção não pode falhar"
		else
			ok "(g) a varredura de unidade reprova a cópia com o defeito de volta (${defeitos[${indice}]})"
		fi
	done

	# A agulha aqui é SINTÉTICA, e isso é correção de um defeito de segurança, não
	# simplificação: a propriedade que se prova é do MECANISMO — que a varredura
	# acha o que existe e omite o valor da saída —, jamais do segredo. Usar a
	# credencial viva a plantaria em texto claro no disco (arquivo de trabalho e
	# blob do índice do clone), cuja remoção não sobrevive a SIGKILL.
	local agulha_sintetica="AGULHASINTETICADOCT005G"
	local clone="${DIR_TEMPORARIO}/ct005-clone-com-agulha"
	git -c "safe.directory=${RAIZ_REPO}" clone --no-hardlinks --quiet "${RAIZ_REPO}" "${clone}"
	printf 'AGULHA_PLANTADA_PELO_CT_005=%s\n' "${agulha_sintetica}" >"${clone}/plantado-pelo-ct-005.txt"
	git_em "${clone}" add plantado-pelo-ct-005.txt

	local achados_plantados codigo_plantado=0
	achados_plantados="$(printf '%s\n' "${agulha_sintetica}" | varrer_arvore_versionada "${clone}")" || codigo_plantado=$?

	afirmar_diferente "(g) com a agulha plantada, a varredura da árvore sai != 0" "0" "${codigo_plantado}"
	afirmar_igual "(g) a varredura da árvore acusa a ocorrência no formato arquivo:linha" "1" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cxF 'plantado-pelo-ct-005.txt:1' || true)"
	afirmar_igual "(g) a varredura da árvore NÃO imprime o valor encontrado" "0" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cF "${agulha_sintetica}" || true)"

	rm -rf "${clone}"

	fechar_caso "CT-005"
}

# =========================================================================== #
# Agregação dos verificadores das tasks anteriores da fatia.
#
# Nenhum canal do filho é silenciado: as duas saídas são reemitidas com recuo.
# Isso não é cosmético — `verificar-apuracao-versao.sh` sai 0 POR DESENHO mesmo
# com a CA-14 em aberto, porque `aviso` não conta como falha lá dentro. O sinal
# de que o critério de saída da fatia segue aberto viaja no TEXTO, pelos dois
# canais, e um agregador que só olhasse o código de saída o perderia — deixando
# a fatia inteira sair verde com o próprio critério de saída em aberto.
# =========================================================================== #
agregar_baterias_da_fatia() {
	caso "AGREGACAO" "Os verificadores das tasks anteriores da fatia passam, na ordem declarada"

	local dir_saidas="${DIR_TEMPORARIO}/agregacao"
	install -d -m 0700 "${dir_saidas}"

	local entrada relativo identidade nome script saida_padrao saida_erro codigo
	for entrada in "${VERIFICADORES_DA_FATIA[@]}"; do
		relativo="${entrada%%:*}"
		identidade="${entrada##*:}"
		nome="$(basename "${relativo}" .sh)"
		script="${RAIZ_REPO}/${relativo}"

		if [[ ! -f "${script}" ]]; then
			falhar "verificador da fatia ausente: ${relativo}"
			continue
		fi

		saida_padrao="${dir_saidas}/${nome}.out"
		saida_erro="${dir_saidas}/${nome}.err"

		printf '    ..   executando %s (como %s)\n' "${relativo}" \
			"$([[ "${identidade}" == root ]] && printf 'root' || printf '%s' "${DONO_DO_REPO}")"
		codigo=0
		if [[ "${identidade}" == root ]]; then
			bash "${script}" >"${saida_padrao}" 2>"${saida_erro}" </dev/null || codigo=$?
		else
			executar_como_dono bash "${script}" \
				>"${saida_padrao}" 2>"${saida_erro}" </dev/null || codigo=$?
		fi

		# Os DOIS canais são reemitidos — ver o cabeçalho desta função.
		sed 's/^/    |  /' "${saida_padrao}" || true
		sed 's/^/    |  /' "${saida_erro}" >&2 || true

		afirmar_igual "${nome} sai 0" "0" "${codigo}"
	done

	# --- o sinal de CA-14, nos DOIS canais ----------------------------------- #
	#
	# A CA-14 é critério de aceite DA FATIA (scope §4), e esta é a bateria da
	# fatia. Uma bateria que saísse 0 com um critério de aceite em aberto estaria
	# mentindo — que é exatamente o desfecho contra o qual o próprio
	# `verificar-apuracao-versao.sh` deixou o aviso escrito.
	local pendentes
	pendentes="$(grep -hoE 'CA-14.*EM ABERTO' "${dir_saidas}"/*.out "${dir_saidas}"/*.err 2>/dev/null |
		head -1 || true)"
	if [[ -n "${pendentes}" ]]; then
		falhar "a fatia NÃO pode ser declarada fechada: um verificador agregado sinalizou [${pendentes}]. Releia a saída acima — ela nomeia o comando privilegiado que fecha o critério"
	else
		ok "nenhum verificador agregado sinalizou critério de aceite em aberto"
	fi

	fechar_caso "AGREGACAO"
}

# =========================================================================== #
# CT-006 — Após reinício COMPLETO do servidor, a base nova e o ambiente legado
#          voltam sozinhos.
#
# É a prova central da INTENT e o único caso desta fatia que consome janela de
# indisponibilidade. Por isso ele NÃO roda na bateria: é invocado em duas metades
# explícitas, `reinicio-preparar` e `reinicio-conferir`, com o reinício real
# entre elas.
#
# PROIBIDO substituir o reinício por `systemctl restart` das unidades e declarar
# o critério cumprido: reiniciar unidades não exercita ordem de arranque no boot,
# resolução de dependências a frio, nem o retorno do ambiente legado — provaria
# outra coisa com o mesmo nome. A asserção de pré-condição de
# `reinicio-conferir` compara o instante do boot com o do retrato exatamente para
# tornar essa substituição impossível de passar despercebida.
#
# O conjunto de unidades legadas é DERIVADO do retrato — o que estava ativo antes
# do reinício —, nunca de lista escrita à mão que envelheceria em silêncio.
# =========================================================================== #
capturar_retrato_de_reinicio() {
	local destino="$1"
	install -d -m 0700 "${destino}"

	date '+%s' >"${destino}/momento-epoch.txt"
	date -Iseconds >"${destino}/momento.txt"

	systemctl list-units --type=service --state=running --no-pager --no-legend --plain 2>/dev/null |
		awk 'NF >= 1 { print $1 }' | sort -u >"${destino}/unidades-ativas.txt"

	systemctl list-units --state=failed --no-pager --no-legend --plain 2>/dev/null |
		awk 'NF >= 1 { print $1 }' | sort -u >"${destino}/unidades-falhas.txt"

	ss -ltnpH 2>/dev/null |
		awk '{
			n = split($4, a, ":");
			porta = a[n];
			proc = "(sem-dono)";
			if (NF >= 6 && match($6, /"[^"]+"/)) {
				proc = substr($6, RSTART + 1, RLENGTH - 2);
			}
			print porta "\t" proc;
		}' | sort -u >"${destino}/portas.txt"

	df -BM --output=avail / | tail -n 1 | tr -dc '0-9' >"${destino}/disco-mib.txt"

	systemctl is-system-running >"${destino}/estado-do-sistema.txt" 2>/dev/null || true
}

ct_006_preparar() {
	printf 'CT-006 — preparação da janela de indisponibilidade\n'
	printf '  retrato pré-reinício: %s\n\n' "${DIR_REINICIO}"

	# --- passo 1: a bateria PRECISA sair 0 antes de a janela ser consumida --- #
	#
	# A janela é a última prova, nunca a primeira: se algo estiver errado, é nos
	# casos CT-001 a CT-005 e CT-007 que aparece, e eles não custam
	# indisponibilidade.
	printf '  [1/4] executando a bateria completa (CT-001 a CT-005, CT-007 e os verificadores da fatia)\n'
	local codigo=0
	bash "${BASH_SOURCE[0]}" </dev/null || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		printf '\nERRO: a bateria saiu com código %d. A janela NÃO deve ser consumida.\n' "${codigo}" >&2
		printf '      Corrija o que reprovou acima e execute esta preparação de novo.\n' >&2
		exit 1
	fi
	printf '  [1/4] bateria aprovada — a janela pode ser consumida\n'

	# --- passo 2: o retrato, em arquivo que sobrevive ao reinício ------------ #
	printf '  [2/4] capturando o retrato pré-reinício\n'
	capturar_retrato_de_reinicio "${DIR_REINICIO}"
	printf '        unidades em execução: %s · portas em escuta: %s · livre em /: %s MiB\n' \
		"$(wc -l <"${DIR_REINICIO}/unidades-ativas.txt" | tr -d ' ')" \
		"$(wc -l <"${DIR_REINICIO}/portas.txt" | tr -d ' ')" \
		"$(cat "${DIR_REINICIO}/disco-mib.txt")"

	# --- passo 3: a tarefa que atravessa o reinício -------------------------- #
	#
	# É o que torna a CA-10 uma prova ponta a ponta em vez de uma consulta de
	# configuração: o identificador gerado agora atravessa persistência em disco,
	# reinício de máquina, arranque do processador e consumo.
	printf '  [3/4] enfileirando a tarefa de eco e parando o processador\n'
	if ! escrever_auxiliar_de_fila; then
		printf 'ERRO: não consegui montar o auxiliar de fila a partir de %s\n' "${ARQ_AMBIENTE}" >&2
		exit 1
	fi

	local valor saida="${DIR_TEMPORARIO}/preparar-enfileirar.txt"
	valor="prova-de-reinicio-$(date +%s)-${RANDOM}"
	codigo=0
	executar_auxiliar_de_fila enfileirar "${valor}" >"${saida}" 2>&1 || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		sed 's/^/      /' "${saida}" >&2 || true
		printf 'ERRO: não consegui enfileirar a tarefa de prova — a janela não deve ser consumida sem ela.\n' >&2
		exit 1
	fi

	local identificador
	identificador="$(sed -n 's|^ID=\(.*\)$|\1|p' "${saida}" | head -1)"
	if [[ -z "${identificador}" ]]; then
		printf 'ERRO: o auxiliar de fila não devolveu o identificador da tarefa.\n' >&2
		exit 1
	fi

	install -m 0600 /dev/null "${DIR_REINICIO}/tarefa.txt"
	printf 'ID=%s\nVALOR=%s\n' "${identificador}" "${valor}" >"${DIR_REINICIO}/tarefa.txt"

	# O processador é parado DEPOIS do enfileiramento, deixando a tarefa pendente.
	# Ele continua HABILITADO — é justamente isso que o boot precisa provar.
	systemctl stop "${UNIDADE_WORKER}"
	printf '        tarefa %s pendente · %s parado (segue habilitado no arranque)\n' \
		"${identificador}" "${UNIDADE_WORKER}"

	# --- passo 4: as instruções --------------------------------------------- #
	printf '\n  [4/4] TUDO PRONTO. Dentro da janela combinada, e com acesso de console fora da\n'
	printf '        rede em mãos, execute:\n\n'
	printf '            sudo reboot\n\n'
	printf '        Depois do boot, SEM executar nenhum comando de partida, execute:\n\n'
	printf '            sudo bash deploy/scripts/instalacao/verificar-fundacao.sh reinicio-conferir\n\n'
	printf '        Se o boot NÃO convergir, o retorno é desabilitar as unidades novas pelo\n'
	printf '        console: systemctl disable --now %s %s\n' "${UNIDADE_API}" "${UNIDADE_WORKER}"
}

# Pede ao barramento do sistema que ative um nome. É o MESMO caminho que qualquer
# consumidor percorre ao falar com o serviço — e NÃO um comando de partida: quem
# resolve o nome pelo arquivo de ativação e entrega a partida ao supervisor é o
# próprio barramento. Não altera estado de unidade nenhuma além da que o nome
# mapeia, e é idempotente (nome já servido devolve "já em execução").
#
# O tempo de espera da resposta é derivado da constante nomeada, nunca fixado
# aqui: sem `--reply-timeout` a chamada herdaria o padrão da ferramenta e poderia
# ficar pendurada além do limite que este caso declara.
acionar_nome_dbus() {
	dbus-send --system --print-reply \
		--reply-timeout="$((LIMITE_ATIVACAO_SOB_DEMANDA_S * 1000))" \
		--dest=org.freedesktop.DBus /org/freedesktop/DBus \
		org.freedesktop.DBus.StartServiceByName "string:$1" uint32:0 >/dev/null 2>&1
}

# DECISÃO FECHADA — T7 / execução da janela de indisponibilidade · 2026-08-01
# O QUÊ: unidade do retrato que esteja inativa e seja `Type=dbus` NÃO é isentada
#        nem pulada — ela tem o nome D-Bus acionado, e a asserção passa a ser que
#        ela chega a `active` dentro de LIMITE_ATIVACAO_SOB_DEMANDA_S.
# POR QUÊ: a janela real de 2026-08-01 reprovou por `polkit.service`, que é
#          ativado sob demanda (`Type=dbus`, `BusName=org.freedesktop.PolicyKit1`,
#          `static`): antes do reinício ele estava de pé só porque a bateria
#          acabara de rodar dezenas de `systemctl`, que passam por ele. O sistema
#          estava correto; a asserção é que classificava toda unidade do retrato
#          como persistente. A saída óbvia — isentar unidade inativa, ou pular
#          `Type=dbus` — foi DESCARTADA: um polkit genuinamente quebrado
#          (mascarado, arquivo de ativação removido) passaria a passar, e a ponta
#          (c) perderia exatamente o poder que existe para ter. Acionar prova o
#          que a CA-9 pede — que a unidade volta — pelo ciclo de vida real dela.
# REVERTER EXIGE: provar que nenhuma unidade do retrato é ativada sob demanda, ou
#                 exibir um critério que discrimine "sob demanda" de "persistente"
#                 sem depender de acionamento — e demonstrar, com falsificação,
#                 que o critério novo ainda reprova unidade mascarada e unidade
#                 sem caminho de ativação.
#
# Veredito da ponta (c) do CT-006 para UMA unidade do retrato pré-reinício.
# O motivo/diagnóstico sai pela saída padrão; o veredito, pelo código de retorno:
#
#   0  a unidade está `active` — voltou sozinha, nada a relatar
#   2  a unidade é ativada sob demanda, estava ociosa, e VOLTOU ao ser acionada
#   1  a unidade NÃO voltou — o motivo nomeia a unidade individualmente
veredito_da_unidade_do_retrato() {
	local unidade="$1" tipo nome_dbus

	if unidade_ativa "${unidade}"; then
		return 0
	fi

	# `Type=dbus` é o critério que discrimina — não "declara BusName", não é
	# "static": `systemd-logind`, `systemd-networkd` e `systemd-resolved` casam
	# esses dois filtros largos e são persistentes.
	tipo="$(propriedade_da_unidade "${unidade}" Type)"
	if [[ "${tipo}" != "dbus" ]]; then
		printf 'unidade do retrato pré-reinício não voltou: %s — obtido [%s]' \
			"${unidade}" "$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		return 1
	fi

	nome_dbus="$(propriedade_da_unidade "${unidade}" BusName)"
	if [[ -z "${nome_dbus}" ]]; then
		printf 'unidade do retrato pré-reinício não voltou: %s — é Type=dbus e não declara BusName legível, e sem o nome não existe caminho de ativação para exercitar — obtido [%s]' \
			"${unidade}" "$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		return 1
	fi

	# Ferramenta ausente NUNCA faz o caso passar em silêncio: sem ela o retorno da
	# unidade não pode ser provado, e o que não se prova reprova.
	if ! command -v dbus-send >/dev/null 2>&1; then
		printf 'unidade do retrato pré-reinício não voltou: %s — é ativada sob demanda (Type=dbus, %s), mas `dbus-send` não está no PATH e o acionamento não pôde ser exercitado — obtido [%s]' \
			"${unidade}" "${nome_dbus}" \
			"$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		return 1
	fi

	if ! acionar_nome_dbus "${nome_dbus}"; then
		printf 'unidade do retrato pré-reinício não voltou: %s — o barramento RECUSOU ativar %s (nome sem arquivo de ativação, unidade mascarada, ou partida recusada) — obtido [%s]' \
			"${unidade}" "${nome_dbus}" \
			"$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		return 1
	fi

	if ! sondar_ate "${LIMITE_ATIVACAO_SOB_DEMANDA_S}" unidade_ativa "${unidade}"; then
		printf 'unidade do retrato pré-reinício não voltou: %s — acionar %s não a trouxe a active em %ss — obtido [%s]' \
			"${unidade}" "${nome_dbus}" "${LIMITE_ATIVACAO_SOB_DEMANDA_S}" \
			"$(systemctl is-active "${unidade}" 2>/dev/null || true)"
		return 1
	fi

	printf '%s estava ociosa por ser ativada sob demanda (Type=dbus, %s) — acionada pelo barramento, voltou a active' \
		"${unidade}" "${nome_dbus}"
	return 2
}

ct_006_conferir() {
	caso "CT-006" "Após reinício completo do servidor, a base nova e o ambiente legado voltam sozinhos"

	if [[ ! -f "${DIR_REINICIO}/momento-epoch.txt" ]]; then
		falhar "não encontrei o retrato pré-reinício em ${DIR_REINICIO} — execute 'reinicio-preparar' ANTES do reinício; ele não é reconstruível depois"
		fechar_caso "CT-006"
		return
	fi

	# --- pré-condição: o servidor foi REALMENTE reiniciado ------------------- #
	#
	# Sem esta asserção, executar `systemctl restart` das unidades e rodar a
	# conferência passaria — provando outra coisa com o mesmo nome.
	# O instante do último boot vem de `/proc/stat` (`btime`, segundos desde a
	# época), e não de uma ferramenta de linha de comando: é o dado que o próprio
	# núcleo mantém, e não depende de nada estar instalado.
	local momento_retrato momento_boot
	momento_retrato="$(cat "${DIR_REINICIO}/momento-epoch.txt")"
	momento_boot="$(awk '/^btime/ { print $2; exit }' /proc/stat)"
	if [[ "${momento_boot:-0}" -gt "${momento_retrato}" ]]; then
		ok "pré-condição: o servidor foi reiniciado depois do retrato (boot em $(date -d "@${momento_boot}" -Iseconds))"
	else
		falhar "pré-condição: o último boot ($(date -d "@${momento_boot:-0}" -Iseconds)) é ANTERIOR ao retrato ($(cat "${DIR_REINICIO}/momento.txt")) — o servidor não foi reiniciado, e este caso não pode ser declarado cumprido"
		fechar_caso "CT-006"
		return
	fi

	# --- (a) o servidor inteiro converge ------------------------------------- #
	sondar_ate "${LIMITE_RETORNO_APOS_REINICIO_S}" bash -c \
		'[[ "$(systemctl is-system-running 2>/dev/null)" != starting ]]' || true
	# `degraded` é o sinal de que algo mais no servidor não subiu — inclusive
	# coisa que não é nossa. É o apanhador de rede da fatia.
	afirmar_igual "(a) systemctl is-system-running devolve 'running' dentro de ${LIMITE_RETORNO_APOS_REINICIO_S}s" \
		"running" "$(systemctl is-system-running 2>/dev/null || true)"

	# --- (b) as duas unidades novas, sem nenhum comando de partida ----------- #
	local unidade
	for unidade in "${UNIDADES[@]}"; do
		if sondar_ate "${LIMITE_RETORNO_APOS_REINICIO_S}" bash -c \
			"[[ \"\$(systemctl is-active ${unidade} 2>/dev/null)\" == active ]]"; then
			ok "(b) ${unidade} voltou sozinha após o boot"
		else
			falhar "(b) ${unidade} não voltou a 'active' em ${LIMITE_RETORNO_APOS_REINICIO_S}s — obtido [$(systemctl is-active "${unidade}" 2>/dev/null || true)]"
		fi
	done

	# --- (c) cada unidade do retrato, NOMEADA individualmente ---------------- #
	#
	# Inclui o ambiente legado (docker, mysql, clp-nginx, clp-php-fpm, memcached,
	# containerd e o que mais estivesse de pé). Mensagem agregada reprovaria o
	# próprio propósito do caso: saber QUAL não voltou.
	#
	# O veredito por unidade está em `veredito_da_unidade_do_retrato`, junto do
	# marcador DECISÃO FECHADA que explica por que a unidade ativada sob demanda é
	# ACIONADA em vez de isentada. Aqui fica só a contabilidade.
	local caidas=0 total=0 sob_demanda=0 motivo codigo
	while IFS= read -r unidade; do
		[[ -n "${unidade}" ]] || continue
		total=$((total + 1))
		codigo=0
		motivo="$(veredito_da_unidade_do_retrato "${unidade}")" || codigo=$?
		case "${codigo}" in
		0) ;;
		2)
			sob_demanda=$((sob_demanda + 1))
			nota "(c) ${motivo}"
			;;
		*)
			falhar "(c) ${motivo}"
			caidas=$((caidas + 1))
			;;
		esac
	done <"${DIR_REINICIO}/unidades-ativas.txt"
	if [[ "${caidas}" -eq 0 ]]; then
		ok "(c) as ${total} unidades que estavam em execução antes do reinício voltaram sozinhas (${sob_demanda} delas ativadas sob demanda, acionadas e de volta)"
	fi

	# --- (d) nenhuma unidade em estado de falha ------------------------------ #
	local novas_falhas
	novas_falhas="$(systemctl list-units --state=failed --no-pager --no-legend --plain 2>/dev/null |
		awk 'NF >= 1 { print $1 }' | sort -u | tr '\n' ' ')"
	afirmar_igual "(d) o conjunto de unidades em falha é vazio" "" "${novas_falhas% }"

	# --- (e) as duas rotas de saúde ------------------------------------------ #
	local corpo="${DIR_TEMPORARIO}/ct006-corpo.txt"
	afirmar_igual "(e) GET /saude responde 200 após o boot" "200" "$(consultar_http /saude "${corpo}")"
	afirmar_igual "(e) GET /saude/pronto responde 200 após o boot" "200" \
		"$(consultar_http /saude/pronto "${corpo}")"
	afirmar_igual "(e) GET /saude/pronto declara o banco alcançável" "1" \
		"$(grep -cF '"banco":"disponivel"' "${corpo}" || true)"
	afirmar_igual "(e) GET /saude/pronto declara a fila alcançável" "1" \
		"$(grep -cF '"fila":"disponivel"' "${corpo}" || true)"

	# --- (f) a tarefa enfileirada ANTES do reinício foi consumida ------------ #
	#
	# O identificador foi gerado antes do boot e atravessou disco + reinício +
	# arranque do processador. É o que torna a CA-10 uma prova ponta a ponta.
	local identificador valor saida="${DIR_TEMPORARIO}/ct006-consumo.txt"
	identificador="$(sed -n 's|^ID=\(.*\)$|\1|p' "${DIR_REINICIO}/tarefa.txt" | head -1)"
	valor="$(sed -n 's|^VALOR=\(.*\)$|\1|p' "${DIR_REINICIO}/tarefa.txt" | head -1)"

	if [[ -z "${identificador}" || -z "${valor}" ]]; then
		falhar "(f) o retrato não registrou o identificador da tarefa pendente — sem ele a CA-10 não tem prova"
	elif ! escrever_auxiliar_de_fila; then
		falhar "(f) não consegui montar o auxiliar de fila a partir de ${ARQ_AMBIENTE}"
	else
		local codigo=0
		executar_auxiliar_de_fila conferir "${identificador}" "${valor}" >"${saida}" 2>&1 || codigo=$?
		afirmar_igual "(f) a tarefa ${identificador}, enfileirada antes do reinício, foi consumida e devolveu o mesmo valor" \
			"0" "${codigo}"
		afirmar_igual "(f) o servidor de fila registra o término da tarefa ${identificador}" "1" \
			"$(grep -c "^ESTADO=completed ID=${identificador}\$" "${saida}" || true)"
		if [[ "${codigo}" -ne 0 ]]; then
			sed 's/^/         /' "${saida}" >&2 || true
		fi
	fi

	# --- (g) a bateria completa volta a sair 0 ------------------------------- #
	local codigo_bateria=0
	printf '    ..   executando a bateria completa após o boot\n'
	bash "${BASH_SOURCE[0]}" </dev/null >"${DIR_TEMPORARIO}/ct006-bateria.out" 2>"${DIR_TEMPORARIO}/ct006-bateria.err" || codigo_bateria=$?
	sed 's/^/    |  /' "${DIR_TEMPORARIO}/ct006-bateria.out" || true
	sed 's/^/    |  /' "${DIR_TEMPORARIO}/ct006-bateria.err" >&2 || true
	afirmar_igual "(g) verificar-fundacao.sh sai 0 depois do reinício" "0" "${codigo_bateria}"

	# --- (h) as portas legadas e o disco ------------------------------------- #
	#
	# Portas efêmeras mudam sozinhas entre dois retratos, sem que nada tenha
	# acontecido — compará-las reprovaria por ruído, não por dano.
	local porta processo processo_agora divergentes=0 total_portas=0
	local portas_agora="${DIR_TEMPORARIO}/ct006-portas.txt"
	ss -ltnpH 2>/dev/null |
		awk '{
			n = split($4, a, ":");
			porta = a[n];
			proc = "(sem-dono)";
			if (NF >= 6 && match($6, /"[^"]+"/)) {
				proc = substr($6, RSTART + 1, RLENGTH - 2);
			}
			print porta "\t" proc;
		}' | sort -u >"${portas_agora}"

	while IFS=$'\t' read -r porta processo; do
		[[ -n "${porta}" ]] || continue
		[[ "${porta}" -lt "${PRIMEIRA_PORTA_EFEMERA}" ]] || continue
		total_portas=$((total_portas + 1))
		processo_agora="$(awk -F'\t' -v p="${porta}" '$1 == p { print $2; exit }' "${portas_agora}")"
		if [[ -z "${processo_agora}" ]]; then
			falhar "(h) a porta ${porta} (dono '${processo}') deixou de estar em escuta após o reinício"
			divergentes=$((divergentes + 1))
		elif [[ "${processo_agora}" != "${processo}" ]]; then
			falhar "(h) a porta ${porta} trocou de dono após o reinício: era '${processo}', agora é '${processo_agora}'"
			divergentes=$((divergentes + 1))
		fi
	done <"${DIR_REINICIO}/portas.txt"
	if [[ "${divergentes}" -eq 0 ]]; then
		ok "(h) as ${total_portas} portas não efêmeras do retrato seguem com o mesmo processo dono"
	fi

	local disco_antes disco_agora
	disco_antes="$(cat "${DIR_REINICIO}/disco-mib.txt")"
	disco_agora="$(df -BM --output=avail / | tail -n 1 | tr -dc '0-9')"
	nota "(h) espaço livre em /: ${disco_antes} MiB antes do reinício, ${disco_agora} MiB depois"
	afirmar_igual "(h) o espaço livre em / não desabou depois do reinício (ao menos metade do que havia)" "1" \
		"$([[ "${disco_agora}" -ge $((disco_antes / 2)) ]] && echo 1 || echo 0)"

	fechar_caso "CT-006"
}

# =========================================================================== #
# Encerramento e despacho.
# =========================================================================== #
resumir_e_sair() {
	local rotulo="$1" escopo="$2"

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		# A forma desta linha é CONTRATO com o CT-004, que a lê da saída padrão da
		# sub-bateria de serviço para afirmar que a contagem de falhas é 0 e que
		# todos os casos foram aprovados. Alterá-la sem atualizar o caso reprova a
		# bateria — que é exatamente a proteção contra divergência silenciosa.
		printf '%s: %d/%d caso(s) aprovado(s), 0 falha(s) (%s)\n' \
			"${rotulo}" "${casos_aprovados}" "${casos_executados}" "${escopo}"
		exit 0
	fi
	printf '%s: %d falha(s) em %d caso(s) — REPROVADO\n' \
		"${rotulo}" "${falhas_totais}" "$((casos_executados - casos_aprovados))" >&2
	exit 1
}

main() {
	local subcomando="${1:-}"

	exigir_privilegio
	exigir_ferramentas

	case "${subcomando}" in
	"" | servicos | reinicio-preparar | reinicio-conferir) : ;;
	*)
		printf 'ERRO: subcomando desconhecido: %s\n' "${subcomando}" >&2
		printf '      uso: %s [servicos|reinicio-preparar|reinicio-conferir]\n' \
			"$(basename "${BASH_SOURCE[0]}")" >&2
		exit 64
		;;
	esac

	# ADR-0006 — consultado ANTES de qualquer caso, senão não guarda nada.
	recusar_bateria_em_producao

	INICIO_DA_BATERIA="$(date '+%Y-%m-%d %H:%M:%S')"
	preparar_area_temporaria

	case "${subcomando}" in
	servicos)
		sub_bateria_de_servicos
		resumir_e_sair "verificar-fundacao/servicos" "rotas de saúde, contrato e consumo de tarefa"
		;;
	reinicio-preparar)
		ct_006_preparar
		exit 0
		;;
	reinicio-conferir)
		printf 'Verificação do retorno após reinício completo do servidor — CT-006\n'
		printf '  repositório: %s\n' "${RAIZ_REPO}"
		printf '  retrato:     %s\n' "${DIR_REINICIO}"
		ct_006_conferir
		resumir_e_sair "verificar-fundacao/reinicio" "CT-006"
		;;
	*)
		printf 'Bateria de aceitação da fatia fundacao-stack-nativa\n'
		printf '  repositório: %s\n' "${RAIZ_REPO}"
		printf '  janela do journal a partir de: %s\n' "${INICIO_DA_BATERIA}"

		agregar_baterias_da_fatia
		ct_001
		# Companheiro do CT-001: mede a DECISÃO de idempotência, não o efeito dela
		# sobre o sistema. Roda logo depois pela afinidade, e é numerado à parte
		# porque não depende de execução privilegiada nenhuma ter dado certo.
		ct_007
		ct_002
		ct_003
		ct_004
		ct_005

		printf '\nCT-006 (reinício completo do servidor) NÃO é executado por esta invocação: ele\n'
		printf 'consome uma janela de indisponibilidade combinada e não é repetível à vontade.\n'
		printf 'Quando a bateria acima estiver verde, conduza-o com:\n'
		printf '    sudo bash %s reinicio-preparar\n' "${BASH_SOURCE[0]}"
		printf '    sudo reboot\n'
		printf '    sudo bash %s reinicio-conferir\n' "${BASH_SOURCE[0]}"

		resumir_e_sair "verificar-fundacao" "AGREGACAO, CT-001 a CT-005 e CT-007"
		;;
	esac
}

main "$@"
