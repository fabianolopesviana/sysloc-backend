#!/usr/bin/env bash
#
# Instalação das unidades de serviço do backend Sysloc — T7 da fatia
# `fundacao-stack-nativa`.
#
# Posiciona no sistema, habilita no arranque e coloca no ar as unidades
# versionadas em `deploy/systemd/`:
#
#   sysloc-api.service                  serviço de aplicação
#   sysloc-worker.service               processador de trabalho em segundo plano
#   sysloc-rotina-<r>.timer     (6)     o relógio de cada rotina agendada
#   sysloc-rotina-<r>.service   (6)     o despacho `oneshot` que o relógio dispara
#   sysloc-alerta-de-rotina@.service    a unidade-modelo do alerta de falha
#   sysloc-backup-da-base.timer         o relógio da cópia diária da base
#   sysloc-backup-da-base.service       a cópia e a preservação dos segredos
#
# ---------------------------------------------------------------------------
# O relógio: HABILITA-SE O `.timer`, NUNCA O `.service` (T9 · `automacoes-agendadas`)
# ---------------------------------------------------------------------------
#
# É a única diferença de tratamento frente às duas unidades permanentes, e ela é
# EXPLÍCITA no dado, não no fluxo: `UNIDADES` é o que se posiciona (tudo), e
# `UNIDADES_DO_ARRANQUE` é o que se ativa e habilita — e nenhum
# `sysloc-rotina-*.service` consta da segunda. Habilitar o `Type=oneshot` o faria
# correr NO BOOT, fora do horário declarado: uma passagem a mais, na hora errada,
# toda vez que a máquina subisse. A segunda barreira está na própria unidade —
# os seis despachos e a unidade-modelo NÃO têm seção `[Install]`, e sem ela
# `systemctl enable` recusa em vez de passar em silêncio.
#
# ⚠️ A regra vale para TODA unidade disparada por relógio, e não só para as de
# prefixo `sysloc-rotina-`: `${UNIDADE_DE_BACKUP}` (T4 · `publicacao-e-backup`)
# obedece às duas barreiras pela mesma razão — habilitada, ela correria no boot,
# fora da janela noturna, com a cópia da base concorrendo com o arranque do
# servidor. O predicado que a suíte usa para detectar a violação foi corrigido na
# mesma task: ele filtrava por PREFIXO, e por isso era cego a esta unidade.
#
# A conformidade das unidades (fuso declarado no `OnCalendar=`, `Persistent=`
# apenas nas diárias, `OnFailure=` que nomeia quem falhou, ausência de `Restart=`
# no `oneshot`) é provada por `packages/shared/test/unidades-agendadas.spec.ts`,
# que também afirma por IGUALDADE DE CONJUNTO que o array `UNIDADES` abaixo cobre
# o diretório versionado inteiro. Acrescentar unidade sem a acrescentar aqui
# reprova a suíte — e é assim que a lista não fica para trás.
#
# ADR-0005 — rotina operacional versionada no repositório e posicionada por
# procedimento de instalação IDEMPOTENTE. Executar este script duas vezes
# seguidas termina com sucesso nas duas e não produz efeito adicional: unidade
# já idêntica não é reescrita, unidade já habilitada não é habilitada de novo, e
# — o modo de falha que mais dói em produção — SERVIÇO SAUDÁVEL NÃO É
# REINICIADO. Um instalador que "funciona" reiniciando tudo a cada execução
# transforma cada implantação numa micro-indisponibilidade. Cada passo imprime
# `CRIADO` (mudou algo) ou `JA-OK` (já estava correto), para que a segunda
# execução seja auditável linha a linha.
#
# ADR-0005, condição de entrada — NENHUMA credencial passa por aqui. Este script
# não lê, não grava e não transporta segredo: as unidades apontam para
# ${ARQ_AMBIENTE}, gravado por `provisionar-base.sh` (T2) com modo 0600 e dono
# root, fora da árvore versionada por construção. Este procedimento apenas
# CONFERE que aquele arquivo existe e está com a permissão certa — e falha se não
# estiver, em vez de subir serviços que não conseguiriam ler a própria
# configuração. Por isso o rastreio verboso de comandos do shell jamais é ligado
# aqui.
#
# ---------------------------------------------------------------------------
# Por que tanta pré-condição antes do primeiro passo
# ---------------------------------------------------------------------------
#
# Esta é a task que define o arranque do servidor, e o servidor é COMPARTILHADO
# com o ambiente que atende a operação hoje. Uma unidade mal formada, um
# `ExecStart` apontando para artefato inexistente ou uma porta tomada de outro
# processo não produzem um erro local: produzem um servidor que não converge no
# boot seguinte, e a janela em que isso se descobre não é repetível. Todas as
# conferências abaixo rodam ANTES de qualquer escrita em /etc:
#
#   * as duas unidades passam em `systemd-analyze verify` sem código de erro E
#     sem emitir aviso — aviso de diretiva não reconhecida é a forma silenciosa
#     de uma propriedade deixar de valer;
#   * o artefato construído (`dist/main.js`) existe para os dois processos.
#     A construção NÃO é feita aqui nem por `ExecStartPre`: com
#     `Restart=always`, compilar a cada reinício custaria dezenas de segundos no
#     caminho de recuperação (que a CA-8 exige em 60 s) e uma falha de
#     compilação viraria laço de reinício. Fica com o operador, uma vez,
#     conscientemente;
#   * o runtime apontado pelo `ExecStart` existe, é executável e reporta a MESMA
#     versão que o `.mise.toml` declara — a divergência é apanhada aqui, com um
#     humano olhando, e não no boot;
#   * o arquivo de ambiente existe com modo 0600;
#   * a porta que a unidade da aplicação declara está livre, ou já pertence a
#     ela. Este script não toma porta de ninguém.
#
# ---------------------------------------------------------------------------
# Uso
# ---------------------------------------------------------------------------
#
#   pnpm build                                                # uma vez, sem privilégio
#   sudo bash deploy/scripts/instalacao/instalar-unidades.sh
#
# Verificação correspondente (bateria da fatia inteira):
#
#   sudo bash deploy/scripts/instalacao/verificar-fundacao.sh
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

readonly PREFIXO="[instalar-unidades]"

# --------------------------------------------------------------------------- #
# Constantes. A bateria de verificação confere que estes valores continuam
# declarados aqui nesta forma literal — mudá-los sem atualizar o verificador
# reprova a bateria, que é exatamente a proteção contra divergência silenciosa.
# --------------------------------------------------------------------------- #
readonly DIR_FONTE_UNIDADES="deploy/systemd"
readonly DIR_UNIDADES_INSTALADAS="/etc/systemd/system"
readonly ALVO_DE_ARRANQUE="multi-user.target"

readonly UNIDADE_API="sysloc-api.service"
readonly UNIDADE_WORKER="sysloc-worker.service"
readonly UNIDADE_DE_ALERTA="sysloc-alerta-de-rotina@.service"
readonly UNIDADE_DE_BACKUP="sysloc-backup-da-base.service"

# Tudo o que é POSICIONADO em ${DIR_UNIDADES_INSTALADAS} — o roster completo do
# diretório versionado, e a fonte única deste procedimento.
#
# ⚠️ Ele é afirmado por IGUALDADE DE CONJUNTO contra `deploy/systemd/` pelo
# CT-1060: um arquivo de unidade que exista no repositório e falte aqui reprova a
# suíte nomeando-o, e o contrário também. Sem essa amarra, uma unidade nova nasce
# versionada e nunca instalada — o modo de falha mais silencioso desta classe.
readonly UNIDADES=(
	"${UNIDADE_API}"
	"${UNIDADE_WORKER}"
	"${UNIDADE_DE_ALERTA}"
	"sysloc-rotina-aviso-de-cobranca.service"
	"sysloc-rotina-aviso-de-cobranca.timer"
	"sysloc-rotina-conferencia-de-liquidacao.service"
	"sysloc-rotina-conferencia-de-liquidacao.timer"
	"sysloc-rotina-encerramento-de-contratos.service"
	"sysloc-rotina-encerramento-de-contratos.timer"
	"sysloc-rotina-manutencao.service"
	"sysloc-rotina-manutencao.timer"
	"sysloc-rotina-retomada-de-noticias.service"
	"sysloc-rotina-retomada-de-noticias.timer"
	"sysloc-rotina-vigilancia-das-rotinas.service"
	"sysloc-rotina-vigilancia-das-rotinas.timer"
	# A cópia diária da base — fatia `publicacao-e-backup`. Ela não despacha
	# rotina de negócio: executa os dois scripts de `deploy/scripts/backup/`.
	"${UNIDADE_DE_BACKUP}"
	"sysloc-backup-da-base.timer"
)

# O que é ATIVADO e HABILITADO no arranque — subconjunto declarado de ${UNIDADES}.
#
# ⚠️ NENHUM `sysloc-rotina-*.service` entra aqui, e a ausência É o mecanismo:
# habilitar o `Type=oneshot` o faria correr no boot, fora do horário marcado.
# Quem sobe no arranque é o RELÓGIO; o despacho é iniciado por ele, na hora
# declarada, pelo `Unit=` do timer.
#
# A unidade-modelo do alerta também não entra: unidade-modelo não tem instância
# própria e não se habilita — quem a instancia é o `OnFailure=` de cada despacho,
# no momento da falha.
#
# ⚠️ Os SEIS timers entram, e a cobertura é afirmada nos dois sentidos pelo
# CT-1060: um `.timer` versionado que não constasse desta lista seria um relógio
# instalado e nunca ligado — a rotina simplesmente não correria, sem que nada
# falhasse.
readonly UNIDADES_DO_ARRANQUE=(
	"${UNIDADE_API}"
	"${UNIDADE_WORKER}"
	"sysloc-rotina-aviso-de-cobranca.timer"
	"sysloc-rotina-conferencia-de-liquidacao.timer"
	"sysloc-rotina-encerramento-de-contratos.timer"
	"sysloc-rotina-manutencao.timer"
	"sysloc-rotina-retomada-de-noticias.timer"
	"sysloc-rotina-vigilancia-das-rotinas.timer"
	# O relógio da cópia diária — e SÓ ele. `${UNIDADE_DE_BACKUP}` fica de fora
	# pela mesma razão dos seis despachos acima.
	"sysloc-backup-da-base.timer"
)

# O artefato construído que o `ExecStart` de cada unidade invoca, relativo à raiz
# do repositório. A lista é derivada do próprio `ExecStart` em tempo de execução
# (ver `caminho_do_artefato_na_unidade`); estes valores existem só para a
# mensagem de erro poder dizer o que fazer.
readonly COMANDO_DE_CONSTRUCAO="pnpm build"

# Arquivo de ambiente posicionado por `provisionar-base.sh` (T2). Espelhado aqui
# de propósito: este procedimento precisa saber o valor esperado sem herdá-lo do
# outro script, senão os dois erram juntos.
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
readonly MODO_ARQ_AMBIENTE="600"
readonly DONO_ARQ_AMBIENTE="root"

# Fonte única das versões de ferramenta. O `ExecStart` das unidades fixa o
# runtime por caminho absoluto, e é contra este arquivo que a versão é conferida.
readonly ARQ_MISE="${RAIZ_REPO}/.mise.toml"

# Quanto se espera, sondando o estado observável, pela confirmação de que uma
# unidade recém-iniciada permaneceu ativa. `Type=simple` devolve sucesso assim
# que o processo é criado; uma falha de configuração acontece um instante depois.
readonly LIMITE_CONFIRMACAO_PARTIDA_S=30

# --------------------------------------------------------------------------- #
# Estado interno.
# --------------------------------------------------------------------------- #
DIR_TEMPORARIO=""
total_criado=0
total_ja_ok=0
# O rótulo de cada passo, atribuído na ordem de execução. Ele passou a ser
# CONTADO em vez de escrito à mão quando o roster cresceu de 2 para 15 unidades:
# rótulo literal por passo obrigaria a renumerar todo o `main` a cada unidade
# nova, e a renumeração esquecida é a forma como duas linhas do registro de
# instalação passam a dizer o mesmo número.
passo_corrente=0
# Onde `proximo_passo` PUBLICA o rótulo. A publicação é por variável, e não por
# stdout — ver o cabeçalho da função, que explica por que a forma importa.
PASSO=""
# Unidades cujo arquivo mudou nesta execução. Só elas são reiniciadas — é o que
# separa idempotência real de um instalador que derruba serviço saudável.
declare -A UNIDADE_MUDOU=()

# --------------------------------------------------------------------------- #
# Saída legível. Duas marcações estáveis, e só duas — a mesma convenção de
# `provisionar-base.sh`.
# --------------------------------------------------------------------------- #
info() { printf '%s ..     %s\n' "${PREFIXO}" "$*"; }

# Avança o contador e publica o rótulo do passo em ${PASSO}.
#
# DECISÃO FECHADA — T9 / Gate 2 · 2026-08-23
# O QUÊ: `proximo_passo` publica o rótulo POR VARIÁVEL (${PASSO}), nunca por stdout, e nenhum
#        ponto de chamada a envolve em substituição de comando, cano ou lista com `|`.
# POR QUÊ: a forma idiomática — ecoar o rótulo e consumi-lo em `f "$(proximo_passo)"` — foi
#          MEDIDA e está errada: substituição de comando roda em subshell, o incremento morre
#          com ele, e as 32 linhas do registro de instalação saíam todas como `P01`. O defeito é
#          invisível à suíte inteira da fatia (o instalador exige `sudo`, que a decisão A1 da
#          §16.1 deixou fora), e só o Gate 2 o pegou.
# REVERTER EXIGE: provar que nenhum ponto de chamada executa esta função num subshell — e a
#                 prova roda no CT-1060, passo 4, que extrai daqui o fragmento real, o executa
#                 sob `bash` repetindo cada ponto, e exige rótulos distintos e crescentes.
#
# É o mesmo "duas linhas dizendo o mesmo número" que o bloco de estado acima diz
# querer evitar — e que o mecanismo anterior produzia em TODAS elas. Escrevendo
# em ${PASSO}, a atribuição acontece no shell corrente por construção, e não
# sobra motivo para envolver a chamada em `$( )`: envolvê-la passaria a capturar
# string vazia, e o rótulo sumiria da linha em vez de se repetir em silêncio.
#
# A propriedade é provada por `packages/shared/test/unidades-agendadas.spec.ts`
# (CT-1060, passo 4): a suíte extrai daqui esta função, a inicialização do
# contador e os pontos de chamada, executa o fragmento sob `bash` repetindo cada
# ponto, e exige rótulos DISTINTOS E CRESCENTES. Mecanismo que perca o incremento
# entre chamadas reprova, qualquer que seja a forma escolhida.
proximo_passo() {
	passo_corrente=$((passo_corrente + 1))
	printf -v PASSO 'P%02d' "${passo_corrente}"
}

criado() {
	total_criado=$((total_criado + 1))
	printf '%s CRIADO %s %s\n' "${PREFIXO}" "$1" "$2"
}

ja_ok() {
	total_ja_ok=$((total_ja_ok + 1))
	printf '%s JA-OK  %s %s\n' "${PREFIXO}" "$1" "$2"
}

erro() { printf '%s ERRO: %s\n' "${PREFIXO}" "$*" >&2; }

# $1 = o que falhou (e por quê) · $2 = o que fazer · $3 = código de saída (opc.)
abortar() {
	erro "$1"
	printf '%s O QUE FAZER: %s\n' "${PREFIXO}" "$2" >&2
	exit "${3:-1}"
}

limpar() {
	local codigo=$?
	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi
	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Cada sinal
# chama `exit` com o código convencional (128 + número do sinal), o que dispara
# o trap de EXIT uma única vez e faz a limpeza acontecer.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

trap 'erro "falha inesperada na linha ${LINENO} — comando: ${BASH_COMMAND}"; erro "O QUE FAZER: releia as últimas linhas acima, corrija a causa e execute o script de novo — ele é idempotente e retoma do ponto correto"' ERR

# =========================================================================== #
# Funções PURAS — sem efeito colateral, sem privilégio, exercitáveis
# diretamente pela bateria de verificação.
#
# Elas estão extraídas de propósito. A decisão de idempotência deste
# procedimento — "escrever só quando o destino diverge da fonte" — é a
# propriedade que a CA-11 cobra, e enquanto ela vivesse embutida num passo que
# escreve em /etc e exige root, seria intestável: a bateria acabaria testando uma
# REIMPLEMENTAÇÃO dela, e um instalador com o defeito de volta passaria. A
# bateria carrega ESTAS funções do arquivo real e as exercita; quem valida e
# quem executa são o mesmo código.
# =========================================================================== #

# Decide se o destino precisa ser (re)escrito a partir da origem.
#
# Devolve 0 quando DIVERGE (conteúdo, modo ou dono) e 1 quando já está correto.
# Nunca escreve nada — a escrita é de `posicionar_unidade`, que a consulta.
#
# O modo e o dono entram na comparação junto com o conteúdo, e não como um
# segundo passo: um arquivo de unidade com conteúdo certo e permissão frouxa é
# tão divergente quanto um com conteúdo errado, e tratá-los em passos separados
# faria a segunda execução reportar `JA-OK` sobre um estado que ainda precisava
# de conserto.
unidade_diverge() {
	local origem="$1" destino="$2" modo="$3" dono="$4" grupo="$5"

	[[ -f "${destino}" ]] || return 0
	cmp -s "${origem}" "${destino}" || return 0
	[[ "$(stat -c '%a %U %G' "${destino}")" == "${modo#0} ${dono} ${grupo}" ]] || return 0
	return 1
}

# Extrai o caminho do artefato construído que o `ExecStart` da unidade invoca —
# o SEGUNDO argumento da linha, sendo o primeiro o runtime.
#
# Devolve vazio (e código 1) quando a unidade não declara `ExecStart=` numa forma
# reconhecível, o que reprova a conferência em vez de passar em silêncio.
caminho_do_artefato_na_unidade() {
	local unidade="$1" valor
	valor="$(sed -n 's|^ExecStart=[^[:space:]]\{1,\}[[:space:]]\{1,\}\([^[:space:]]\{1,\}\).*$|\1|p' "${unidade}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Extrai o caminho do runtime que o `ExecStart` da unidade invoca — o primeiro
# argumento da linha.
caminho_do_runtime_na_unidade() {
	local unidade="$1" valor
	valor="$(sed -n 's|^ExecStart=\([^[:space:]]\{1,\}\).*$|\1|p' "${unidade}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Extrai o valor de uma variável declarada por `Environment=` na unidade.
# Devolve vazio (e código 1) quando a unidade não a declara.
valor_de_ambiente_na_unidade() {
	local unidade="$1" chave="$2" valor
	valor="$(sed -n "s|^Environment=${chave}=\\(.*\\)$|\\1|p" "${unidade}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# Decide se a unidade EXECUTA o runtime do repositório — e portanto se ela entra
# nas conferências de versão do runtime e de artefato construído.
#
# Derivado por EXCLUSÃO NOMEADA, e não por lista paralela: é todo `.service`
# MENOS as duas que invocam outra coisa. O sentido da regra é fail-closed — um
# `.service` novo entra na conferência sozinho, e esquecê-lo deixa de ser
# possível. O `.timer` cai fora porque não tem `ExecStart=` nenhum.
#
# As duas exceções, e por que cada uma é nomeada:
#
#   · ${UNIDADE_DE_ALERTA} invoca uma ferramenta do sistema (`/usr/bin/echo`);
#   · ${UNIDADE_DE_BACKUP} invoca os SCRIPTS VERSIONADOS de
#     `deploy/scripts/backup/`, e não `node` com artefato de `dist/`. As duas
#     conferências que esta função governa não teriam o que afirmar sobre ela:
#     `verificar_artefatos_construidos` leria o segundo campo de um `ExecStart=`
#     que só tem um, e `verificar_runtime` compararia a versão do `bash` contra
#     a que o `.mise.toml` declara para o Node — o procedimento abortaria em
#     TODA execução, sem defeito algum no sistema.
#
# ⚠️ A exceção não deixa o alvo sem prova: que os dois scripts existam e sejam
# executáveis é afirmado pelo CT-1118 de
# `packages/shared/test/unidades-agendadas.spec.ts`, que roda na suíte, sem
# privilégio — e a diferença de fundo é que eles são VERSIONADOS, de modo que
# chegam junto com a árvore, enquanto o artefato de `dist/` depende de
# `${COMANDO_DE_CONSTRUCAO}` ter rodado.
unidade_executa_o_runtime() {
	[[ "$1" == *.service && "$1" != "${UNIDADE_DE_ALERTA}" && "$1" != "${UNIDADE_DE_BACKUP}" ]]
}

# O alvo sob o qual a unidade é habilitada, LIDO da própria unidade.
#
# Os dois serviços permanentes declaram `multi-user.target`; os seis relógios
# declaram `timers.target`. Uma constante única na mensagem diria `multi-user`
# sobre a habilitação de um timer — texto falso no registro de instalação, que é
# o artefato que o operador lê para conferir o que aconteceu.
alvo_de_arranque_da_unidade() {
	local valor
	valor="$(sed -n 's|^WantedBy=\(.*\)$|\1|p' "${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/$1" | head -1)"
	printf '%s' "${valor:-${ALVO_DE_ARRANQUE}}"
}

# Versão do runtime que o `.mise.toml` declara como fonte única.
versao_do_runtime_declarada() {
	local arquivo="$1" valor
	valor="$(sed -n 's|^node = "\(.*\)"$|\1|p' "${arquivo}" | head -1)"
	[[ -n "${valor}" ]] || return 1
	printf '%s' "${valor}"
}

# --------------------------------------------------------------------------- #
# Utilitários que tocam o sistema.
# --------------------------------------------------------------------------- #
unidade_habilitada() {
	[[ "$(systemctl is-enabled "$1" 2>/dev/null || true)" == "enabled" ]]
}

unidade_ativa() {
	[[ "$(systemctl is-active "$1" 2>/dev/null || true)" == "active" ]]
}

# =========================================================================== #
# Pré-condições. NENHUMA delas altera coisa alguma no sistema.
# =========================================================================== #
verificar_precondicoes() {
	if [[ "${EUID}" -ne 0 ]]; then
		abortar "este script precisa de privilégio administrativo — ele escreve em ${DIR_UNIDADES_INSTALADAS} e comanda o supervisor do sistema" \
			"execute como 'sudo bash deploy/scripts/instalacao/instalar-unidades.sh'"
	fi

	local faltando=() ferramenta
	for ferramenta in systemctl systemd-analyze journalctl install stat cmp sed ss getent id; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "ferramenta obrigatória ausente do PATH: ${faltando[*]}" \
			"instale os pacotes correspondentes (systemd, coreutils, diffutils, iproute2) e execute de novo"
	fi

	local unidade
	for unidade in "${UNIDADES[@]}"; do
		if [[ ! -f "${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}" ]]; then
			abortar "a unidade versionada ${DIR_FONTE_UNIDADES}/${unidade} não existe em ${RAIZ_REPO}" \
				"confirme que você está executando o script de dentro do repositório e que a árvore está completa"
		fi
	done

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-instalar-unidades-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"
}

# As unidades precisam ser VÁLIDAS antes de entrarem no sistema. Aviso conta como
# reprovação: uma diretiva escrita errado é ignorada em silêncio pelo supervisor,
# e a propriedade que ela deveria garantir — reinício, prazo de desligamento,
# restrição de execução — simplesmente deixa de valer.
verificar_unidades_validas() {
	local unidade origem saida codigo
	for unidade in "${UNIDADES[@]}"; do
		origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}"
		saida="${DIR_TEMPORARIO}/verify-${unidade}.txt"
		codigo=0
		systemd-analyze verify "${origem}" >"${saida}" 2>&1 || codigo=$?

		if [[ "${codigo}" -ne 0 ]]; then
			erro "a unidade versionada ${unidade} é inválida — nada foi instalado"
			sed 's/^/         /' "${saida}" >&2 || true
			abortar "instalar uma unidade inválida é o caminho mais curto para um servidor que não converge no arranque seguinte" \
				"corrija ${DIR_FONTE_UNIDADES}/${unidade} e execute de novo; 'systemd-analyze verify ${origem}' reproduz o diagnóstico acima"
		fi

		if [[ -s "${saida}" ]]; then
			erro "a unidade versionada ${unidade} passou na validação, mas com AVISO — nada foi instalado"
			sed 's/^/         /' "${saida}" >&2 || true
			abortar "aviso de validação quase sempre significa diretiva não reconhecida, que o supervisor IGNORA: a propriedade que ela declara deixa de valer sem que nada falhe" \
				"corrija ${DIR_FONTE_UNIDADES}/${unidade} até a validação sair silenciosa e execute de novo"
		fi
	done
	info "as ${#UNIDADES[@]} unidades versionadas passam em 'systemd-analyze verify' sem código de erro e sem aviso"
}

# O `ExecStart` aponta para artefato construído, que o `.gitignore` barra. Sem
# esta conferência a unidade seria habilitada e falharia na partida — e, com
# `Restart=always`, falharia em laço até o limite de tentativas.
verificar_artefatos_construidos() {
	local unidade origem artefato faltando=() examinadas=0
	for unidade in "${UNIDADES[@]}"; do
		unidade_executa_o_runtime "${unidade}" || continue
		examinadas=$((examinadas + 1))
		origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}"
		if ! artefato="$(caminho_do_artefato_na_unidade "${origem}")"; then
			abortar "não consegui interpretar o 'ExecStart=' de ${unidade}: esperava '<runtime> <artefato>'" \
				"confira a linha ExecStart= de ${DIR_FONTE_UNIDADES}/${unidade}"
		fi
		[[ -f "${artefato}" ]] || faltando+=("${artefato}")
	done

	if [[ "${#faltando[@]}" -gt 0 ]]; then
		abortar "o artefato construído que as unidades invocam não existe: ${faltando[*]}" \
			"execute '${COMANDO_DE_CONSTRUCAO}' na raiz do repositório (SEM privilégio, como o usuário de trabalho) e rode este script de novo. A construção não é feita aqui de propósito — ver o cabeçalho"
	fi
	info "artefatos construídos presentes para as ${examinadas} unidades que executam o runtime"
}

# O runtime é fixado por caminho absoluto nas unidades. A divergência entre ele e
# o que o `.mise.toml` declara é apanhada AQUI, com um humano olhando, e não no
# boot seguinte.
verificar_runtime() {
	local esperada
	if ! esperada="$(versao_do_runtime_declarada "${ARQ_MISE}")"; then
		abortar "não consegui ler a versão do runtime declarada em ${ARQ_MISE}" \
			"confira a linha 'node = \"...\"' na seção [tools] de .mise.toml"
	fi

	local unidade origem runtime obtida
	for unidade in "${UNIDADES[@]}"; do
		unidade_executa_o_runtime "${unidade}" || continue
		origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}"
		if ! runtime="$(caminho_do_runtime_na_unidade "${origem}")"; then
			abortar "não consegui interpretar o runtime do 'ExecStart=' de ${unidade}" \
				"confira a linha ExecStart= de ${DIR_FONTE_UNIDADES}/${unidade}"
		fi

		if [[ ! -x "${runtime}" ]]; then
			abortar "o runtime que ${unidade} invoca não existe ou não é executável: ${runtime}" \
				"instale-o com 'mise install' na raiz do repositório (como o usuário de trabalho) ou corrija o ExecStart= de ${DIR_FONTE_UNIDADES}/${unidade}"
		fi

		obtida="$("${runtime}" --version 2>/dev/null | tr -d 'v[:space:]')"
		if [[ "${obtida}" != "${esperada}" ]]; then
			abortar "${unidade} invoca um runtime na versão '${obtida}', e o .mise.toml declara '${esperada}' — instalar assim faria o serviço rodar numa versão que o repositório não fixou" \
				"execute 'mise install' e atualize a linha ExecStart= de ${DIR_FONTE_UNIDADES}/${unidade} para o caminho da versão ${esperada}"
		fi
	done
	info "runtime conferido: versão ${esperada}, a mesma que ${ARQ_MISE##*/} declara"
}

# O arquivo de ambiente é de T2. Este procedimento não o cria, não o lê e não o
# corrige — apenas se recusa a subir serviços que não conseguiriam ler a própria
# configuração.
verificar_arquivo_de_ambiente() {
	if [[ ! -f "${ARQ_AMBIENTE}" ]]; then
		abortar "o arquivo de ambiente ${ARQ_AMBIENTE} não existe — as unidades o declaram em 'EnvironmentFile=' e não subiriam sem ele" \
			"execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh' antes deste script; é ele quem cria o arquivo, com a credencial gerada em tempo de execução"
	fi

	local observado esperado="${MODO_ARQ_AMBIENTE} ${DONO_ARQ_AMBIENTE}"
	observado="$(stat -c '%a %U' "${ARQ_AMBIENTE}")"
	if [[ "${observado}" != "${esperado}" ]]; then
		abortar "${ARQ_AMBIENTE} está com modo e dono '${observado}', e o exigido é '${esperado}' — ele carrega a credencial do banco" \
			"execute 'sudo bash deploy/scripts/instalacao/provisionar-base.sh', que corrige a permissão, e rode este script de novo"
	fi
	info "arquivo de ambiente ${ARQ_AMBIENTE} presente (${esperado}), fora da árvore versionada"
}

# Este script não toma porta de ninguém — mesma disciplina de
# `provisionar-base.sh`. A porta é DERIVADA da unidade, nunca de lista fixa.
verificar_porta_da_aplicacao() {
	local origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${UNIDADE_API}"
	local porta
	if ! porta="$(valor_de_ambiente_na_unidade "${origem}" PORT)"; then
		abortar "${UNIDADE_API} não declara 'Environment=PORT=' — a unidade não diz em que porta o serviço escuta" \
			"acrescente a linha Environment=PORT=<porta> em ${DIR_FONTE_UNIDADES}/${UNIDADE_API}"
	fi

	if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
		info "porta ${porta}, declarada por ${UNIDADE_API}, está livre"
		return
	fi

	if unidade_ativa "${UNIDADE_API}"; then
		info "porta ${porta} já em uso por ${UNIDADE_API} (nossa instância)"
		return
	fi

	local dono
	dono="$(ss -ltnpH "sport = :${porta}" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -1)"
	abortar "a porta ${porta}, destinada a ${UNIDADE_API}, já está ocupada pelo processo '${dono:-desconhecido}' — este script não toma porta de ninguém" \
		"libere a porta ${porta}, ou altere 'Environment=PORT=' em ${DIR_FONTE_UNIDADES}/${UNIDADE_API} para uma porta livre desta máquina"
}

# O usuário e o grupo sob os quais os serviços rodam precisam existir: com
# `User=` apontando para nome inexistente, a unidade falha na partida com uma
# mensagem que não menciona o usuário, e o diagnóstico custa caro.
verificar_usuario_dos_servicos() {
	local unidade origem usuario grupo
	for unidade in "${UNIDADES[@]}"; do
		origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}"
		usuario="$(sed -n 's|^User=\(.*\)$|\1|p' "${origem}" | head -1)"
		grupo="$(sed -n 's|^Group=\(.*\)$|\1|p' "${origem}" | head -1)"

		if [[ -n "${usuario}" ]] && ! getent passwd "${usuario}" >/dev/null 2>&1; then
			abortar "${unidade} declara 'User=${usuario}', e esse usuário não existe nesta máquina" \
				"crie o usuário ou corrija a linha User= em ${DIR_FONTE_UNIDADES}/${unidade}"
		fi
		if [[ -n "${grupo}" ]] && ! getent group "${grupo}" >/dev/null 2>&1; then
			abortar "${unidade} declara 'Group=${grupo}', e esse grupo não existe nesta máquina" \
				"crie o grupo ou corrija a linha Group= em ${DIR_FONTE_UNIDADES}/${unidade}"
		fi
	done
}

# =========================================================================== #
# As unidades posicionadas em ${DIR_UNIDADES_INSTALADAS} — uma por rótulo de passo.
# =========================================================================== #
posicionar_unidade() {
	local passo="$1" unidade="$2"
	local origem="${RAIZ_REPO}/${DIR_FONTE_UNIDADES}/${unidade}"
	local destino="${DIR_UNIDADES_INSTALADAS}/${unidade}"

	UNIDADE_MUDOU["${unidade}"]=0

	if ! unidade_diverge "${origem}" "${destino}" 0644 root root; then
		ja_ok "${passo}" "${unidade} já posicionada e idêntica à fonte versionada"
		return
	fi

	install -m 0644 -o root -g root "${origem}" "${destino}"
	UNIDADE_MUDOU["${unidade}"]=1
	criado "${passo}" "${unidade} posicionada em ${destino} (0644 root:root)"
}

# =========================================================================== #
# O supervisor relê as unidades. Só quando alguma mudou: `daemon-reload`
# incondicional é barato, mas mascara a diferença entre "instalei" e "não havia o
# que instalar", que é justamente o que a segunda execução precisa mostrar.
# =========================================================================== #
recarregar_definicoes() {
	local passo="$1" unidade mudou=0
	for unidade in "${UNIDADES[@]}"; do
		[[ "${UNIDADE_MUDOU[${unidade}]}" -eq 0 ]] || mudou=1
	done

	if [[ "${mudou}" -eq 0 ]]; then
		ja_ok "${passo}" "nenhuma unidade mudou — o supervisor não precisou reler as definições"
		return
	fi

	systemctl daemon-reload
	criado "${passo}" "definições relidas pelo supervisor (daemon-reload)"
}

# =========================================================================== #
# Os serviços e os relógios no ar.
#
# ---------------------------------------------------------------------------
# Por que ATIVAR vem ANTES de HABILITAR
# ---------------------------------------------------------------------------
#
# A ordem é deliberada e é uma proteção do arranque do servidor. `enable` é o que
# faz a unidade subir sozinha no boot; se ela fosse habilitada antes de se provar
# capaz de subir, uma falha de partida deixaria o sistema com uma unidade
# quebrada MARCADA PARA SUBIR — e o efeito só apareceria no boot seguinte, como
# `systemctl is-system-running` respondendo `degraded` num servidor compartilhado
# com o ambiente que atende a operação. Ativando primeiro, uma falha de partida
# aborta a instalação sem nada ter sido marcado para o arranque.
#
# ---------------------------------------------------------------------------
# A regra de idempotência
# ---------------------------------------------------------------------------
#
# Serviço INATIVO é iniciado; serviço ATIVO só é reiniciado se o arquivo de
# unidade mudou nesta execução. Reiniciar um serviço saudável porque "o
# instalador rodou" é o modo de falha clássico — a bateria de verificação o caça
# comparando `NRestarts` antes e depois da segunda execução.
# =========================================================================== #

# `systemctl start` sobre `Type=simple` devolve sucesso assim que o processo é
# CRIADO — uma falha de configuração acontece um instante depois e não aparece no
# código de saída do comando. Sem esta confirmação, o instalador reportaria
# "iniciada" sobre um serviço que já morreu, e seguiria adiante habilitando-o.
confirmar_partida() {
	local unidade="$1" decorrido=0

	while [[ "${decorrido}" -lt "${LIMITE_CONFIRMACAO_PARTIDA_S}" ]]; do
		case "$(systemctl is-active "${unidade}" 2>/dev/null || true)" in
		active) return 0 ;;
		failed) break ;;
		esac
		sleep 1
		decorrido=$((decorrido + 1))
	done

	[[ "$(systemctl is-active "${unidade}" 2>/dev/null || true)" == "active" ]]
}

# Uma unidade que não sobe NÃO pode ficar marcada para o arranque. Se ela já
# estava habilitada de uma instalação anterior, é desabilitada aqui — deixá-la
# habilitada transformaria um erro de configuração corrigível numa surpresa no
# próximo boot.
abortar_por_partida_falha() {
	local unidade="$1"

	erro "${unidade} não permaneceu ativa após a partida (estado: $(systemctl is-active "${unidade}" 2>/dev/null || true), resultado: $(systemctl show -p Result --value "${unidade}" 2>/dev/null || true))"
	erro "últimas linhas do journal desta unidade:"
	journalctl -u "${unidade}" -n 20 --no-pager -o cat 2>/dev/null | sed 's/^/         /' >&2 || true

	if unidade_habilitada "${unidade}"; then
		systemctl disable "${unidade}" >/dev/null 2>&1 || true
		erro "${unidade} foi DESABILITADA do arranque: uma unidade que não sobe não pode ficar marcada para subir no boot"
	fi

	abortar "a instalação foi interrompida antes de marcar ${unidade} para o arranque" \
		"corrija a causa apontada no journal acima e execute este script de novo — ele é idempotente e retoma do ponto correto"
}

ativar_unidade() {
	local passo="$1" unidade="$2"

	if ! unidade_ativa "${unidade}"; then
		systemctl start "${unidade}" || true
		confirmar_partida "${unidade}" || abortar_por_partida_falha "${unidade}"
		criado "${passo}" "${unidade} iniciada e confirmada ativa"
		return
	fi

	if [[ "${UNIDADE_MUDOU[${unidade}]}" -eq 1 ]]; then
		info "reiniciando ${unidade} para carregar a definição nova"
		systemctl restart "${unidade}" || true
		confirmar_partida "${unidade}" || abortar_por_partida_falha "${unidade}"
		criado "${passo}" "${unidade} reiniciada (a definição mudou nesta execução)"
		return
	fi

	ja_ok "${passo}" "${unidade} já ativa e com a definição já correta (não foi reiniciada)"
}

# =========================================================================== #
# Habilitação no arranque.
#
# `systemctl enable` cria o link simbólico sob ${ALVO_DE_ARRANQUE}.wants/, e é
# ele que faz o serviço subir sozinho no boot (CA-9). Chamá-lo quando a unidade
# já está habilitada é inócuo para o systemd, mas a conferência prévia é o que
# torna a segunda execução AUDITÁVEL: sem ela, as duas execuções ficariam
# indistinguíveis na saída.
# =========================================================================== #
habilitar_unidade() {
	local passo="$1" unidade="$2"
	local alvo
	alvo="$(alvo_de_arranque_da_unidade "${unidade}")"

	if unidade_habilitada "${unidade}"; then
		ja_ok "${passo}" "${unidade} já habilitada no arranque (${alvo})"
		return
	fi

	systemctl enable "${unidade}" >/dev/null
	criado "${passo}" "${unidade} habilitada no arranque (${alvo})"
}

# =========================================================================== #
# Encerramento.
# =========================================================================== #
resumir() {
	printf '\n'
	info "resumo: ${total_criado} passo(s) alterado(s), ${total_ja_ok} passo(s) já corretos"

	local unidade
	for unidade in "${UNIDADES_DO_ARRANQUE[@]}"; do
		printf '%s        %-42s ativa=%-8s habilitada=%s\n' "${PREFIXO}" "${unidade}" \
			"$(systemctl is-active "${unidade}" 2>/dev/null || true)" \
			"$(systemctl is-enabled "${unidade}" 2>/dev/null || true)"
	done

	# As demais são POSICIONADAS e não habilitadas — os seis despachos `oneshot`,
	# que o relógio inicia na hora marcada, e a unidade-modelo do alerta, que o
	# `OnFailure=` instancia. Dizer isso por extenso é o que impede a leitura
	# errada do resumo: "não está habilitada" aqui é conformidade, não pendência.
	info "posicionadas e NÃO habilitadas (por decisão): $((${#UNIDADES[@]} - ${#UNIDADES_DO_ARRANQUE[@]})) unidades — os despachos 'oneshot' e a unidade-modelo do alerta"

	info "segredos em ${ARQ_AMBIENTE} (${MODO_ARQ_AMBIENTE} ${DONO_ARQ_AMBIENTE}) — nenhuma credencial nas unidades"
	info "instalação concluída"
}

main() {
	printf '%s instalação das unidades de serviço do backend Sysloc\n' "${PREFIXO}"

	verificar_precondicoes
	verificar_unidades_validas
	verificar_usuario_dos_servicos
	verificar_runtime
	verificar_artefatos_construidos
	verificar_arquivo_de_ambiente
	verificar_porta_da_aplicacao

	local unidade

	# Posicionar TUDO — inclusive o que não é habilitado. O despacho `oneshot`
	# precisa estar no sistema para o relógio poder iniciá-lo, e a unidade-modelo
	# do alerta para o `OnFailure=` poder instanciá-la.
	for unidade in "${UNIDADES[@]}"; do
		proximo_passo
		posicionar_unidade "${PASSO}" "${unidade}"
	done

	proximo_passo
	recarregar_definicoes "${PASSO}"

	# Ativar ANTES de habilitar: uma unidade que não sobe nunca chega a ser
	# marcada para o arranque. Ver o cabeçalho de `ativar_unidade`.
	#
	# ⚠️ Os dois laços correm sobre ${UNIDADES_DO_ARRANQUE}, e é ELE que exclui os
	# seis `sysloc-rotina-*.service`: nenhum despacho `oneshot` é iniciado nem
	# habilitado aqui — quem o inicia é o relógio, na hora declarada.
	for unidade in "${UNIDADES_DO_ARRANQUE[@]}"; do
		proximo_passo
		ativar_unidade "${PASSO}" "${unidade}"
	done

	for unidade in "${UNIDADES_DO_ARRANQUE[@]}"; do
		proximo_passo
		habilitar_unidade "${PASSO}" "${unidade}"
	done

	resumir
}

main "$@"
