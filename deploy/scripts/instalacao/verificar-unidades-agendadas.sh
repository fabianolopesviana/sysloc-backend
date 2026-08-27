#!/usr/bin/env bash
#
# Verificação da convergência do host — T6 da fatia `publicacao-e-backup`.
#
# Casos cobertos: CT-1146 a CT-1152 e CT-1154.
#
#   CT-1146  o conjunto de unidades POSICIONADO no host é igual ao roster que o
#            instalador declara, afirmado nos DOIS sentidos e com a exceção do
#            capturador de e-mail declarada nominalmente (scope §5.10);
#   CT-1147  falsificação da igualdade de conjunto — a comparação reprova nas
#            duas direções, e cada direção é acusada em separado;
#   CT-1148  todo relógio do roster está HABILITADO e tem próxima execução
#            conhecida e FUTURA — relógio instalado e desligado não dispara nada;
#   CT-1149  o relógio é habilitado, o despacho NÃO — habilitar o `oneshot` o
#            faria correr no boot, fora do horário declarado;
#   CT-1150  a unidade instalada não ficou para trás da versionada (comparação
#            byte a byte) e a do processador de trabalho declara a dependência do
#            banco pelos DOIS eixos: o texto instalado e o que o supervisor
#            carregou;
#   CT-1151  falsificação da dependência — `After=` e `Wants=` são conferidas em
#            separado, e a ausência de uma só é acusada sozinha;
#   CT-1152  o destino do e-mail é o laço local, afirmado por host E porta, sobre
#            o ambiente que o processador EFETIVAMENTE carrega — com a varredura
#            da própria saída desta bateria provando que a URL crua não escapa;
#   CT-1154  o conjunto está de pé, nenhum relógio está habilitado porém morto, e
#            nenhuma unidade do roster está em falha.
#
# ===========================================================================
# O VOCABULÁRIO DE ASSERÇÃO NÃO MORA AQUI
# ===========================================================================
#
# Ele vem de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`, carregado por
# `source`. Esta é a PRIMEIRA bateria escrita depois do fecho do `D9 · F0/T2`
# (T5), e escrevê-la como a décima terceira cópia do esqueleto reabriria o débito
# que aquela task acabou de fechar — o `CT-1125` de `verificar-backup.sh` é a
# rede permanente disso, e ele reprova bateria que redeclare qualquer um dos oito
# símbolos ou que não carregue a casa comum.
#
# ===========================================================================
# AS DUAS LISTAS SÃO EXTRAÍDAS DO INSTALADOR, NUNCA REDIGITADAS
# ===========================================================================
#
# `UNIDADES` e `UNIDADES_DO_ARRANQUE` são lidas do fonte de
# `instalar-unidades.sh` em tempo de execução (ver `array_do_instalador`).
# Redigitá-las aqui poria a REIMPLEMENTAÇÃO sob prova em vez do host: o defeito
# já é medido neste repositório — uma tabela que exercitava a reimplementação do
# leitor aprovou 5/5 um alvo com o defeito de volta. Com a extração, unidade nova
# no instalador entra nesta bateria sem que ninguém se lembre dela, e unidade
# removida some das duas pontas ao mesmo tempo.
#
# ⚠️ O antivácuo é obrigatório e está em cada caso: extração que devolvesse a
# lista VAZIA faria toda comparação de conjunto passar por vacuidade — o host
# estaria conforme um roster de zero unidades. Por isso a apuração de cada lista
# é afirmada ANTES de qualquer comparação, e o `CT-1147` exercita o comparador
# contra um instalador MUTANTE, provando que a extração lê de verdade.
#
# ===========================================================================
# COMO ELA RODA SEM PRIVILÉGIO — e onde o privilégio ainda falta (ADR-0006)
# ===========================================================================
#
# Tudo o que ela mede é legível pelo dono do repositório: `/etc/systemd/system`
# é `755` e as unidades são `644`; `systemctl is-enabled`, `is-active` e `show`
# consultam o supervisor sem privilégio; e o destino do e-mail é lido do
# `environ` do PRÓPRIO processo do processador de trabalho, que roda como o mesmo
# usuário.
#
# ⚠️ Ela NÃO declara exigência de privilégio, e isso é deliberado:
# `deploy/scripts/verificacao/rodar-baterias.sh` classifica a identidade de
# execução por esse padrão no fonte, e uma bateria que o declarasse seria
# executada como root — onde `mise` não está no caminho e o `environ` do
# processador pertence a outro usuário.
#
# O que ela NÃO alcança, e cada frente degrada com `aviso` NOMEADO, sem contar a
# asserção como aprovada:
#
#   [instalacao-em-dia]            o repositório andou à frente do host: existe
#                                  unidade versionada mais nova do que a
#                                  instalada mais nova, e posicioná-la exige
#                                  privilégio. Enquanto essa condição valer, a
#                                  unidade AUSENTE é pré-condição de janela, e
#                                  não reprovação. Quando ela NÃO valer — o
#                                  instalador correu depois da última alteração
#                                  do repositório —, ausência vira FALHA.
#   [ambiente-do-processador]      o processador de trabalho não está de pé, ou o
#                                  `environ` dele não é legível por quem executa.
#   [boot-posterior-a-instalacao]  o último arranque do servidor é ANTERIOR à
#                                  instalação das unidades: o conjunto ativo hoje
#                                  não prova que ele sobe sozinho (invariante 7).
#
# ⚠️ O discriminador de `[instalacao-em-dia]` é o único não circular disponível
# sem privilégio, e ele preserva a capacidade de reprovar: tratar TODA ausência
# como degradação faria a metade `faltando` do CT-1146 nunca poder falhar neste
# host. Com ele, um host onde o instalador correu e mesmo assim não posicionou
# uma unidade REPROVA. A capacidade de falhar do comparador em si é provada à
# parte, em caixa de areia, pelo CT-1147.
#
# ===========================================================================
# CONTRATO DE SAÍDA
# ===========================================================================
#
#   0  zero falhas, e nenhuma frente ficou por medir.
#   1  reprovou o que esta bateria existe para provar.
#   2  zero falhas, e ao menos uma frente não pôde ser medida neste host — há
#      asserção declarada e NÃO MEDIDA (ver as linhas AVISO).
#
# É o idioma que `.claude/rules/testing-stack.md` fixa e que
# `verificar-backup.sh` já pratica: o que se prova está íntegro, e o único
# vermelho é a saúde do ambiente deste host. Ferramenta ou estado ausente NUNCA
# faz caso passar em silêncio.
#
# Uso:
#   bash deploy/scripts/instalacao/verificar-unidades-agendadas.sh
#
# ADR-0005 — as unidades são versionadas e posicionadas por procedimento
# idempotente; esta bateria afirma o RESULTADO daquele procedimento no host, e
# não o executa.
# ADR-0032 — o segredo operável nunca escapa por superfície alguma, e a ausência
# de vazamento se prova POR MEDIÇÃO DA SAÍDA REAL: é o que o CT-1152 faz, com
# controle positivo de agulha plantada.
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO

# O instalador é a FONTE das duas listas. Esta bateria o LÊ e nunca o executa.
readonly INSTALADOR="${RAIZ_REPO}/deploy/scripts/instalacao/instalar-unidades.sh"

# O diretório versionado, para a comparação byte a byte do CT-1150.
readonly DIR_FONTE_UNIDADES="${RAIZ_REPO}/deploy/systemd"

# Onde o supervisor lê as unidades.
readonly DIR_UNIDADES_INSTALADAS="/etc/systemd/system"

# O molde que descreve as unidades DESTE produto dentro do diretório do
# supervisor. Sem ele, a metade `sobrando` do CT-1146 acusaria todas as unidades
# do sistema operacional.
readonly MOLDE_DAS_UNIDADES_DO_PRODUTO='sysloc-*'

# ⚠️ EXCEÇÃO CONHECIDA E DECLARADA — scope §5.10.
#
# `sysloc-mailpit.service` está instalado e NÃO consta do roster: ele é escrito
# pelo provisionamento da F0 (`provisionar-base.sh`) e não é versionado em
# `deploy/systemd/`, de modo que o `CT-1060` — que afirma a igualdade entre o
# roster e o diretório versionado — não o alcança nem deveria alcançar.
#
# Ele é descontado da metade `sobrando`, e a sua PRESENÇA é afirmada: sem essa
# asserção, a exceção viraria um buraco que aprovaria também o dia em que ele
# deixasse de existir.
readonly EXCECOES_FORA_DO_ROSTER=(
	"sysloc-mailpit.service"
)

# A unidade do processador de trabalho e a dependência que ela tem de declarar.
readonly UNIDADE_DO_PROCESSADOR="sysloc-worker.service"
readonly DEPENDENCIA_DO_BANCO="postgresql.service"

# As duas diretivas conferidas EM SEPARADO pelo CT-1150 e falsificadas uma a uma
# pelo CT-1151. `Wants=` sem `After=` sobe o processador antes do banco;
# `After=` sem `Wants=` não puxa o banco quando ele não estiver no alvo.
readonly DIRETIVAS_DA_DEPENDENCIA=(After Wants)

# O destino aceitável do e-mail — CT-1152.
#
# ⚠️ O conjunto é literal de propósito. Derivá-lo do valor medido faria a
# asserção concordar com qualquer host que o ambiente viesse a declarar, que é a
# asserção tautológica.
readonly HOSTS_DO_LACO_LOCAL=(
	"127.0.0.1"
	"localhost"
	"::1"
)
readonly PORTA_DO_CAPTURADOR="1025"
readonly NOME_DA_CHAVE_DO_DESTINO="SMTP_URL"

# As frentes que este host pode não permitir medir, com o TETO de linhas de
# degradação que cada uma pode produzir. O teto é o que impede uma frente de
# inundar a saída e o que amarra a auditoria do fecho a um número.
readonly FRENTES_PRIVILEGIADAS=(
	"instalacao-em-dia|5"
	"ambiente-do-processador|1"
	"boot-posterior-a-instalacao|1"
)

# A marca que toda degradação carrega, para que o operador nunca fique sem
# saída. É a mesma cadeia de `verificar-backup.sh` — segunda cópia, abaixo do
# Limiar de Três do `CLAUDE.md`; a terceira sobe para casa compartilhada.
readonly MARCA_DO_COMANDO_QUE_MEDIRIA="o comando que a mediria:"

# Limite da sondagem que espera o diário desta execução alcançar o que já foi
# impresso — CT-1152. Nunca `sleep` fixo: o que se espera é estado observável (a
# marca aparecer no arquivo), e o limite é declarado.
readonly LIMITE_DE_SINCRONIA_DECIMOS=50

# Limite da sondagem que espera o TRANSITÓRIO de um relógio passar — o intervalo
# em que a unidade que ele dispara está correndo. Ver o bloco do transitório,
# abaixo. Também aqui: nunca `sleep` fixo, e o limite é declarado.
#
# ⚠️ Ele NÃO reusa `LIMITE_DE_SINCRONIA_DECIMOS`, e a razão é de grandeza: aquele
# mede a drenagem de um `tee` (milissegundos), este mede a duração de um
# `oneshot` deste produto. Amarrá-los faria uma grandeza governar a outra sem
# relação alguma — e os 5 s de lá deixariam menos de um segundo de folga sobre a
# janela medida. O transitório medido neste host é de ~3 s, e o diário do Gate 2
# registrou de 3,0 a 4,5 s; 15 s dá mais de três vezes de folga e continua sendo
# limite finito e declarado, nunca espera indefinida.
readonly LIMITE_DO_TRANSITORIO_DECIMOS=150

DIR_TRABALHO=""

# O diário desta execução — a SAÍDA REAL que o CT-1152 varre. Ver a razão no
# bloco daquele caso.
DIARIO_DA_EXECUCAO=""

# As duas listas, extraídas do instalador em `carregar_roster`.
ROSTER=()
ROSTER_DO_ARRANQUE=()

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

limpar() {
	local codigo=$?
	# O espelho da saída é escrito por `tee`, que é ASSÍNCRONO: sair sem esperar
	# corta as últimas linhas na tela do operador. A espera é por estado
	# observável — a marca desta chamada aparecer no arquivo —, com o mesmo limite
	# declarado da sincronia do CT-1152, e nunca por `sleep` fixo. Só então os
	# canais originais voltam e o diretório de trabalho sai.
	if [[ -n "${DIARIO_DA_EXECUCAO}" && -f "${DIARIO_DA_EXECUCAO}" ]]; then
		sincronizar_diario || true
		exec 1>&3 2>&4
	fi
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	return "${codigo}"
}
trap limpar EXIT

# =========================================================================== #
# Extração das listas do instalador — a fonte única do roster.
# =========================================================================== #

# O TRECHO de constantes do instalador: da primeira unidade nomeada até o
# fechamento de `UNIDADES_DO_ARRANQUE`.
#
# ⚠️ Ele é recortado, e não o arquivo inteiro: avaliar o instalador todo o
# EXECUTARIA. O recorte contém apenas declarações `readonly`, e é por isso que
# avaliá-lo em subshell é seguro — e é o que resolve as referências de uma
# constante a outra (`"${UNIDADE_API}"` dentro de `UNIDADES`) sem reimplementar
# um interpretador de shell aqui, que seria a reimplementação que o cabeçalho
# recusa.
trecho_de_constantes_do_instalador() {
	awk '/^readonly UNIDADE_API=/{f=1} f{print} /^readonly UNIDADES_DO_ARRANQUE=\(/{g=1} g&&/^\)$/{exit}' "$1"
}

# Imprime, uma por linha, as entradas do array `$2` declarado no instalador `$1`.
# Devolve 1 quando não conseguiu extrair — o antivácuo desta função.
array_do_instalador() {
	local alvo="$1" nome="$2" trecho
	trecho="$(trecho_de_constantes_do_instalador "${alvo}")" || return 1
	[[ -n "${trecho}" ]] || return 1
	[[ "${trecho}" == *"readonly ${nome}=("* ]] || return 1
	(
		eval "${trecho}"
		declare -n arranjo="${nome}"
		[[ "${#arranjo[@]}" -gt 0 ]] || exit 1
		printf '%s\n' "${arranjo[@]}"
	)
}

carregar_roster() {
	mapfile -t ROSTER < <(array_do_instalador "${INSTALADOR}" UNIDADES) || true
	mapfile -t ROSTER_DO_ARRANQUE < <(array_do_instalador "${INSTALADOR}" UNIDADES_DO_ARRANQUE) || true
}

# Os subconjuntos DERIVADOS do roster — nunca redigitados.
#
#   relógios          tudo o que termina em `.timer`;
#   despachos         o que está no roster e NÃO no arranque: os `oneshot` que o
#                     relógio dispara, mais a unidade-modelo do alerta;
#   permanentes       o que está no arranque e não é relógio.
relogios_do_roster() { printf '%s\n' "${ROSTER[@]}" | grep '\.timer$' || true; }

despachos_do_roster() {
	comm -23 <(printf '%s\n' "${ROSTER[@]}" | LC_ALL=C sort) \
		<(printf '%s\n' "${ROSTER_DO_ARRANQUE[@]}" | LC_ALL=C sort)
}

permanentes_do_arranque() { printf '%s\n' "${ROSTER_DO_ARRANQUE[@]}" | grep -v '\.timer$' || true; }

# =========================================================================== #
# Leitura do host.
# =========================================================================== #

# As unidades do produto POSICIONADAS num diretório qualquer — o do supervisor,
# ou uma caixa de areia do CT-1147. Uma função, dois usos: é o que impede o
# comparador do host de ser diferente do comparador que a falsificação exercita.
unidades_do_produto_em() {
	[[ -d "$1" ]] || return 0
	find "$1" -maxdepth 1 ! -type d -name "${MOLDE_DAS_UNIDADES_DO_PRODUTO}" -printf '%f\n' 2>/dev/null |
		LC_ALL=C sort
}

eh_excecao_declarada() {
	local candidata="$1" excecao
	for excecao in "${EXCECOES_FORA_DO_ROSTER[@]}"; do
		[[ "${candidata}" == "${excecao}" ]] && return 0
	done
	return 1
}

# --------------------------------------------------------------------------- #
# O comparador de conjunto, nos DOIS sentidos.
#
# Imprime uma linha por achado e devolve 1 quando houve algum:
#
#   faltando: <unidade>   está no roster e não foi posicionada
#   sobrando: <unidade>   está posicionada, não é do roster e não é exceção
#
# As duas direções são independentes de propósito: uma comparação que só olhasse
# um sentido aprovaria um host a que faltasse metade do roster (se olhasse só
# `sobrando`) ou um host com unidade intrusa (se olhasse só `faltando`). O
# CT-1147 falsifica as duas, uma a uma.
# --------------------------------------------------------------------------- #
divergencia_do_roster_em() {
	local diretorio="$1" instaladas unidade achou=0
	instaladas="$(unidades_do_produto_em "${diretorio}")"

	for unidade in "${ROSTER[@]}"; do
		[[ -n "${unidade}" ]] || continue
		if ! printf '%s\n' "${instaladas}" | grep -qxF "${unidade}"; then
			printf 'faltando: %s\n' "${unidade}"
			achou=1
		fi
	done

	while IFS= read -r unidade; do
		[[ -n "${unidade}" ]] || continue
		printf '%s\n' "${ROSTER[@]}" | grep -qxF "${unidade}" && continue
		eh_excecao_declarada "${unidade}" && continue
		printf 'sobrando: %s\n' "${unidade}"
		achou=1
	done < <(printf '%s\n' "${instaladas}")

	return "${achou}"
}

# Conta as linhas não vazias de uma lista de achados. `grep -c .` devolve 1 e
# status 1 quando a lista está vazia, e sob `pipefail` isso mataria a contagem.
contar_achados() { printf '%s' "$1" | grep -c . || true; }

unidade_esta_posicionada() { [[ -f "${DIR_UNIDADES_INSTALADAS}/$1" ]]; }

estado_de_habilitacao() { systemctl is-enabled "$1" 2>/dev/null || true; }

estado_de_atividade() { systemctl is-active "$1" 2>/dev/null || true; }

propriedade_da_unidade() { systemctl show -p "$2" --value "$1" 2>/dev/null || true; }

# A próxima execução de um relógio, em segundos desde a época. `0` quando o
# supervisor não a conhece — que é o estado do relógio habilitado porém MORTO,
# e o modo de falha que o CT-1154 existe para acusar.
#
# ⚠️ Quem chama ESPERA O TRANSITÓRIO PASSAR antes — `aguardar_fim_do_transitorio`,
# como statement no laço do caso. A espera NÃO mora aqui de propósito: esta
# função é consumida dentro de substituição de comando (`proxima="$(…)"`), e a
# `nota` que a espera imprime seria CAPTURADA como parte do valor, corrompendo
# justamente o número que a asserção compara. Não a mova para cá.
proxima_execucao_em_segundos() {
	local bruto
	bruto="$(propriedade_da_unidade "$1" NextElapseUSecRealtime)"
	[[ -n "${bruto}" && "${bruto}" != "n/a" ]] || { printf '0'; return 0; }
	date -d "${bruto}" +%s 2>/dev/null || printf '0'
}

# --------------------------------------------------------------------------- #
# O TRANSITÓRIO DO RELÓGIO — o que separa "acabou de disparar" de "morto".
#
# DECISÃO FECHADA — T6 / Gate 2 rodada 1 · 2026-08-26
# O QUÊ: as duas leituras do estado de um relógio (`NextElapseUSecRealtime` e
#        `SubState`) esperam o fim do transitório ANTES de julgar, e o
#        discriminador é o estado da unidade que o `Unit=` do relógio nomeia.
# POR QUÊ: enquanto o `oneshot` disparado está correndo, o supervisor devolve
#          `NextElapseUSecRealtime` VAZIO e o `SubState` do relógio vai de
#          `waiting` a `running` — o estado SAUDÁVEL de quem acabou de disparar,
#          e indistinguível, por essas duas leituras sozinhas, do relógio
#          habilitado porém MORTO. Medido neste host, num relógio de cadência de
#          um minuto: ~3 s a cada 60 s (3,0 a 4,5 s no diário do Gate 2), com
#          DUAS leituras independentes por execução — 10 % a 14 % de exposição.
#          A bateria é a décima terceira de `BATERIAS_DECLARADAS`, e o falso
#          positivo marcava a suíte inteira como reprovada por defeito nenhum do
#          host, bem no meio da janela assistida do operador.
# REVERTER EXIGE: provar que nenhum relógio do roster pode estar disparando no
#                 instante da leitura — o que só vale num host sem relógio de
#                 cadência curta, e o roster hoje tem um de um minuto.
#
# ⚠️ O alvo é a LEITURA, nunca a asserção. Nenhuma das três asserções envolvidas
# (próxima execução conhecida, próxima execução FUTURA, `SubState` esperado)
# muda, afrouxa ou vira condicional: o vazio que NÃO é transitório continua
# valendo `0` e continua reprovando, nomeando a unidade.
# --------------------------------------------------------------------------- #

# Os estados em que a unidade disparada por um relógio está EM EXECUÇÃO.
#
# ⚠️ Lista POSITIVA e fechada. `inactive` (terminou) e `failed` (terminou mal)
# caem fora, e estado desconhecido também — o default é "não está correndo", que
# é o lado seguro: ele devolve a leitura ao julgamento em vez de mandar esperar.
# Definir por subtração (`≠ inactive`) faria estado novo do supervisor virar
# espera silenciosa, e um `oneshot` em falha permanente calaria a asserção.
readonly ESTADOS_DE_EXECUCAO_DA_DISPARADA=(activating active deactivating reloading)

# PURO: recebe o que o supervisor publicou — o `SubState` do relógio e o
# `ActiveState` da unidade que ele dispara — e devolve `1` quando o relógio está
# no transitório, `0` quando não.
#
# Ele é puro pela mesma razão de `diagnostico_do_destino`: é o que permite
# falsificá-lo com entradas sintéticas sem tocar o host, e é o que faz o caminho
# exercitado pelo mutante ser o MESMO que julga o estado real. O CT-1148 o
# falsifica nas duas pontas.
transitorio_do_relogio() {
	local subestado_do_relogio="$1" estado_da_disparada="$2" candidato
	if [[ "${subestado_do_relogio}" == "running" ]]; then
		printf '1'
		return 0
	fi
	for candidato in "${ESTADOS_DE_EXECUCAO_DA_DISPARADA[@]}"; do
		if [[ "${estado_da_disparada}" == "${candidato}" ]]; then
			printf '1'
			return 0
		fi
	done
	printf '0'
}

# A leitura do host que alimenta o discriminador. Devolve 0 (sucesso) quando o
# relógio está no transitório.
#
# ⚠️ Sem `Unit=` publicado a unidade NÃO é relógio, e não há transitório algum a
# esperar: um permanente do arranque tem `SubState=running` como estado NORMAL, e
# tratá-lo como transitório venceria o limite em toda execução. É por isso que o
# teste de natureza é o `Unit=` do supervisor, e não um sufixo redigitado aqui.
relogio_em_transitorio() {
	local disparada
	disparada="$(propriedade_da_unidade "$1" Unit)"
	[[ -n "${disparada}" ]] || return 1
	[[ "$(transitorio_do_relogio \
		"$(propriedade_da_unidade "$1" SubState)" \
		"$(propriedade_da_unidade "${disparada}" ActiveState)")" == "1" ]]
}

# Aguarda o transitório passar. A espera é por ESTADO OBSERVÁVEL — a unidade
# disparada deixar de correr —, com limite declarado, e nunca `sleep` fixo.
#
# Devolve 1 quando o limite venceu com o relógio ainda disparando. Nesse caso a
# leitura seguinte julga o que o supervisor publicar, e a `nota` nomeia a unidade
# e o estado para que o vermelho resultante não seja confundido com relógio
# morto. Vencido o limite com a unidade disparada INATIVA e o `NextElapse` ainda
# vazio, é o defeito genuíno — e a asserção do caso reprova, nomeando o relógio.
aguardar_fim_do_transitorio() {
	local relogio="$1" tentativa=0
	relogio_em_transitorio "${relogio}" || return 0
	nota "${relogio} acabou de disparar — aguardando a unidade disparada terminar antes de ler o estado"
	while [[ "${tentativa}" -lt "${LIMITE_DO_TRANSITORIO_DECIMOS}" ]]; do
		sleep 0.1
		tentativa=$((tentativa + 1))
		relogio_em_transitorio "${relogio}" || return 0
	done
	nota "${relogio} seguiu disparando além de ${LIMITE_DO_TRANSITORIO_DECIMOS} décimos de segundo — o estado lido a seguir é o que o supervisor publicar agora"
	return 1
}

# As unidades que o supervisor considera habilitadas, no sistema inteiro. É o
# universo com que o CT-1149 intersecta os despachos — e ele carrega o próprio
# antivácuo: um universo vazio faria a interseção ser vazia por vacuidade.
unidades_habilitadas_do_host() {
	systemctl list-unit-files --state=enabled --no-legend --no-pager 2>/dev/null |
		awk '{print $1}' | LC_ALL=C sort || true
}

# As diretivas de dependência AUSENTES no texto de uma unidade — o analisador que
# o CT-1150 aplica ao arquivo instalado e que o CT-1151 falsifica.
#
# ⚠️ Só linhas em POSIÇÃO EXECUTÁVEL contam: a unidade versionada tem mais de
# cem linhas de comentário, e uma diretiva citada num comentário não vale nada
# para o supervisor.
diretivas_de_dependencia_ausentes_em() {
	local arquivo="$1" diretiva
	for diretiva in "${DIRETIVAS_DA_DEPENDENCIA[@]}"; do
		grep -E "^${diretiva}=" "${arquivo}" 2>/dev/null |
			grep -qw -- "${DEPENDENCIA_DO_BANCO}" ||
			printf 'ausente em %s=\n' "${diretiva}"
	done
}

# =========================================================================== #
# As frentes que este host pode não permitir medir.
# =========================================================================== #

# O instante da unidade INSTALADA mais recente, e o da VERSIONADA mais recente.
# `0` quando não há nenhuma — e o `0` da instalada é justamente o host em que
# nada foi posicionado ainda.
instante_do_mais_novo_em() {
	local diretorio="$1" molde="$2" maior=0 instante
	[[ -d "${diretorio}" ]] || { printf '0'; return 0; }
	while IFS= read -r instante; do
		[[ -n "${instante}" ]] || continue
		[[ "${instante}" -gt "${maior}" ]] && maior="${instante}"
	done < <(find "${diretorio}" -maxdepth 1 ! -type d -name "${molde}" -printf '%T@\n' 2>/dev/null |
		cut -d. -f1)
	printf '%s' "${maior}"
}

precondicao_privilegiada_disponivel() {
	case "$1" in
	instalacao-em-dia)
		local instalado versionado
		instalado="$(instante_do_mais_novo_em "${DIR_UNIDADES_INSTALADAS}" "${MOLDE_DAS_UNIDADES_DO_PRODUTO}")"
		versionado="$(instante_do_mais_novo_em "${DIR_FONTE_UNIDADES}" '*')"
		[[ "${instalado}" -gt 0 && "${instalado}" -ge "${versionado}" ]]
		;;
	ambiente-do-processador)
		local pid
		pid="$(propriedade_da_unidade "${UNIDADE_DO_PROCESSADOR}" MainPID)"
		[[ -n "${pid}" && "${pid}" != "0" && -r "/proc/${pid}/environ" ]]
		;;
	boot-posterior-a-instalacao)
		local boot instalado
		boot="$(stat -c '%Y' /proc/1 2>/dev/null || printf '0')"
		instalado="$(instante_do_mais_novo_em "${DIR_UNIDADES_INSTALADAS}" "${MOLDE_DAS_UNIDADES_DO_PRODUTO}")"
		[[ "${boot}" -gt 0 && "${instalado}" -gt 0 && "${boot}" -gt "${instalado}" ]]
		;;
	*)
		printf 'ERRO: frente privilegiada desconhecida: %s\n' "$1" >&2
		exit 1
		;;
	esac
}

# O comando literal que fecharia cada frente na janela assistida. Ele vai DENTRO
# do aviso: degradação sem saída vira ruído, e ruído ensina a não ler o vermelho.
comando_que_mediria() {
	case "$1" in
	instalacao-em-dia)
		printf 'sudo bash deploy/scripts/instalacao/instalar-unidades.sh'
		;;
	ambiente-do-processador)
		printf 'sudo systemctl start %s e, se ainda assim não houver processo, sudo grep -c %s= /etc/sysloc/backend.env' \
			"${UNIDADE_DO_PROCESSADOR}" "${NOME_DA_CHAVE_DO_DESTINO}"
		;;
	boot-posterior-a-instalacao)
		printf 'sudo systemctl reboot e, depois do arranque, reexecutar esta bateria'
		;;
	esac
}

# A entrada ÚNICA de degradação desta bateria: rótulo + o que ficou por medir +
# o comando que o mediria. O `aviso` do esqueleto registra o rótulo e conta.
degradar() {
	local rotulo="$1"
	shift
	aviso "[${rotulo}] $* — ${MARCA_DO_COMANDO_QUE_MEDIRIA} $(comando_que_mediria "${rotulo}")"
}

# As unidades do roster que este host ainda não posicionou. Preenchida pelo
# CT-1146 e LIDA pelos casos seguintes: sem esse acumulador, cada caso decidiria
# sozinho o que pular, e a contabilidade do que ficou por medir se perderia entre
# eles. Ver a asserção de fecho de cada caso que a consome.
FALTANDO_NO_HOST=()

# --------------------------------------------------------------------------- #
# A sincronia do diário — CT-1152.
#
# A saída desta bateria é espelhada num arquivo por `tee`, e `tee` é assíncrono:
# varrer o arquivo logo depois de imprimir leria um arquivo ainda incompleto, e a
# varredura aprovaria por vacuidade. A espera é por ESTADO OBSERVÁVEL — a marca
# desta chamada aparecer no arquivo —, com limite declarado, nunca `sleep` fixo.
#
# Devolve 1 quando o limite venceu sem a marca aparecer; quem chama trata.
# --------------------------------------------------------------------------- #
sincronizar_diario() {
	[[ -n "${DIARIO_DA_EXECUCAO}" ]] || return 1
	local marca="marca-de-drenagem-${RANDOM}${RANDOM}"
	nota "espelho da saída: aguardando drenagem da marca ${marca}"
	local tentativa=0
	while [[ "${tentativa}" -lt "${LIMITE_DE_SINCRONIA_DECIMOS}" ]]; do
		grep -qF "${marca}" "${DIARIO_DA_EXECUCAO}" 2>/dev/null && return 0
		sleep 0.1
		tentativa=$((tentativa + 1))
	done
	return 1
}

# Quantas vezes uma agulha aparece na SAÍDA REAL já produzida por esta execução.
ocorrencias_na_saida() { grep -cF -- "$1" "${DIARIO_DA_EXECUCAO}" 2>/dev/null || true; }

# --------------------------------------------------------------------------- #
# O analisador do destino do e-mail — CT-1152.
#
# Ele é PURO: recebe a URL e devolve o diagnóstico, sem ler o host. É o que
# permite falsificá-lo com entradas sintéticas sem tocar o ambiente real, e é o
# que faz o caminho exercitado pelo mutante ser o MESMO que julga o valor real.
#
# ⚠️ Ele nunca ecoa a URL: o diagnóstico sai com host e porta, e nada mais. Uma
# mensagem que trouxesse a linha crua entregaria a credencial embutida no
# `smtp://usuario:senha@host` — que é a forma que a biblioteca aceita.
# --------------------------------------------------------------------------- #
diagnostico_do_destino() {
	local url="$1" sem_esquema host porta candidato
	if [[ -z "${url}" ]]; then
		printf '%s ausente\n' "${NOME_DA_CHAVE_DO_DESTINO}"
		return 0
	fi
	sem_esquema="${url#*://}"
	sem_esquema="${sem_esquema%%/*}"
	sem_esquema="${sem_esquema##*@}"
	host="${sem_esquema%:*}"
	porta="${sem_esquema##*:}"
	if [[ -z "${host}" || -z "${porta}" || "${host}" == "${sem_esquema}" ]]; then
		printf '%s sem host e porta discerníveis\n' "${NOME_DA_CHAVE_DO_DESTINO}"
		return 0
	fi
	local no_laco=0
	for candidato in "${HOSTS_DO_LACO_LOCAL[@]}"; do
		[[ "${host}" == "${candidato}" ]] && no_laco=1
	done
	[[ "${no_laco}" -eq 1 ]] || printf 'host fora do laço local: %s:%s\n' "${host}" "${porta}"
	[[ "${porta}" == "${PORTA_DO_CAPTURADOR}" ]] ||
		printf 'porta fora do capturador: %s:%s\n' "${host}" "${porta}"
}

# O valor de uma chave no ambiente que o processador de trabalho EFETIVAMENTE
# carrega — e não o que o arquivo de ambiente diz, que exigiria privilégio e
# descreveria a próxima partida, nunca o processo que está correndo agora.
valor_no_ambiente_do_processador() {
	local pid
	pid="$(propriedade_da_unidade "${UNIDADE_DO_PROCESSADOR}" MainPID)"
	[[ -n "${pid}" && "${pid}" != "0" && -r "/proc/${pid}/environ" ]] || return 1
	tr '\0' '\n' <"/proc/${pid}/environ" | sed -n "s/^$1=//p" | head -1
}

# As chaves cujo VALOR não pode aparecer na saída desta bateria. É lista
# nominal, e não um filtro por radical: `PATH`, `HOME` e `LANG` aparecem por
# razão legítima em diagnóstico de shell, e varrer por radical acusaria essas
# como vazamento enquanto deixaria de fora a chave que não casasse o radical.
readonly CHAVES_QUE_NAO_PODEM_ESCAPAR=(
	"${NOME_DA_CHAVE_DO_DESTINO}"
	BETTER_AUTH_SECRET
	CHAVE_DE_CIFRA_DO_CERTIFICADO
	DATABASE_URL
	REDIS_URL
)

# Abaixo deste comprimento um valor casaria por coincidência com prosa da saída,
# e a varredura viraria ruído. Nenhum segredo real deste produto é tão curto.
readonly COMPRIMENTO_MINIMO_DA_AGULHA=8

# =========================================================================== #
# CT-1146 — o conjunto POSICIONADO é igual ao roster DECLARADO, nos dois
# sentidos.
#
# INVARIANTE: toda unidade que o instalador declara existe no diretório do
# supervisor, e nenhuma unidade do produto existe ali sem estar declarada — com
# a única exceção nominal do capturador de e-mail, que o provisionamento da F0
# escreve e o repositório não versiona (scope §5.10).
#
# ⚠️ As duas metades são afirmadas SEPARADAMENTE, e não como um "conjuntos
# iguais": a mensagem de uma igualdade de conjunto violada não diz de que lado
# está o defeito, e os dois lados têm causas e correções distintas — `faltando`
# é instalador que não correu, `sobrando` é unidade intrusa ou renomeação a meio
# caminho.
# =========================================================================== #
ct_1146() {
	caso "CT-1146" "o conjunto posicionado no host é igual ao roster declarado, nos dois sentidos"

	# Antivácuo das DUAS pontas, ANTES de qualquer comparação: extração vazia
	# faria toda comparação passar por vacuidade, e o host estaria conforme um
	# roster de zero unidades.
	afirmar_diferente "o roster foi extraído do instalador, e não está vazio" "0" "${#ROSTER[@]}"
	afirmar_diferente "o subconjunto do arranque também foi extraído" "0" "${#ROSTER_DO_ARRANQUE[@]}"

	local instaladas apuracao_do_host
	instaladas="$(unidades_do_produto_em "${DIR_UNIDADES_INSTALADAS}")"
	apuracao_do_host="$(contar_achados "${instaladas}")"
	afirmar_diferente "o host tem unidades do produto posicionadas" "0" "${apuracao_do_host}"
	nota "roster declarado: ${#ROSTER[@]} unidade(s); posicionadas no host: ${apuracao_do_host}"

	local achados=""
	achados="$(divergencia_do_roster_em "${DIR_UNIDADES_INSTALADAS}")" || true

	local sobrando faltando
	sobrando="$(printf '%s\n' "${achados}" | grep '^sobrando: ' || true)"
	faltando="$(printf '%s\n' "${achados}" | grep '^faltando: ' || true)"

	# A metade `sobrando` NUNCA degrada: ela não depende de privilégio algum, e
	# unidade intrusa é falha em qualquer estado deste host.
	afirmar_igual "nenhuma unidade INTRUSA no diretório do supervisor" \
		"" "$(printf '%s' "${sobrando}" | tr '\n' ' ' | sed 's/ $//')"

	local unidade
	while IFS= read -r unidade; do
		[[ -n "${unidade}" ]] || continue
		FALTANDO_NO_HOST+=("${unidade#faltando: }")
	done < <(printf '%s\n' "${faltando}")

	# A metade `faltando` só é FALHA quando o instalador já correu depois da
	# última alteração do repositório. Enquanto o repositório está à frente, a
	# ausência é pré-condição de janela — e degrada NOMEANDO cada unidade, para
	# que a janela saiba exatamente o que espera dela.
	if precondicao_privilegiada_disponivel instalacao-em-dia; then
		afirmar_igual "nenhuma unidade do roster FALTA no host" \
			"" "$(printf '%s' "${faltando}" | tr '\n' ' ' | sed 's/ $//')"
	elif [[ "${#FALTANDO_NO_HOST[@]}" -eq 0 ]]; then
		degradar instalacao-em-dia \
			"o repositório está à frente do host e nada falta hoje — a igualdade não é definitiva até o instalador correr"
	else
		for unidade in "${FALTANDO_NO_HOST[@]}"; do
			degradar instalacao-em-dia "unidade do roster ainda não posicionada: ${unidade}"
		done
	fi

	# A exceção é AFIRMADA, e não apenas descontada. Descontá-la em silêncio
	# abriria um buraco que aprovaria também o dia em que ela deixasse de existir.
	local excecao
	for excecao in "${EXCECOES_FORA_DO_ROSTER[@]}"; do
		afirmar_igual "a exceção declarada \`${excecao}\` está PRESENTE no host" \
			"1" "$(printf '%s\n' "${instaladas}" | grep -cxF "${excecao}" || true)"
		afirmar_igual "e ela NÃO consta do roster — é exceção de verdade, não redundância" \
			"0" "$(printf '%s\n' "${ROSTER[@]}" | grep -cxF "${excecao}" || true)"
	done

	fechar_caso "CT-1146"
}

# =========================================================================== #
# CT-1147 — falsificação da igualdade de conjunto, uma direção de cada vez.
#
# INVARIANTE: o comparador reprova nos DOIS sentidos, e cada sentido é acusado
# SOZINHO. Um comparador que só olhasse `sobrando` aprovaria um host a que
# faltasse metade do roster; um que só olhasse `faltando` aprovaria um host com
# unidade intrusa. Nenhum dos dois defeitos aparece na árvore real — é por isso
# que a falsificação é obrigatória aqui.
#
# ⚠️ Os três alvos são caixas de areia de `mktemp -d`. Plantar mutante em
# `/etc/systemd/system` exigiria privilégio E deixaria lixo no supervisor se o
# script morresse no meio.
# =========================================================================== #
ct_1147() {
	caso "CT-1147" "falsificação da igualdade de conjunto — as duas direções, em separado"

	local base="${DIR_TRABALHO}/ct-1147"
	local integro="${base}/integro" sem_relogio="${base}/sem-relogio" com_intruso="${base}/com-intruso"
	mkdir -p "${integro}" "${sem_relogio}" "${com_intruso}"

	local unidade
	for unidade in "${ROSTER[@]}"; do
		: >"${integro}/${unidade}"
		: >"${sem_relogio}/${unidade}"
		: >"${com_intruso}/${unidade}"
	done

	# O relógio removido é ESCOLHIDO do roster, e não redigitado: um literal aqui
	# envelheceria calado no dia em que a rotina mudasse de nome.
	local relogio_sacrificado
	relogio_sacrificado="$(relogios_do_roster | LC_ALL=C sort | head -1)"
	afirmar_diferente "o relógio do mutante A saiu do próprio roster" "" "${relogio_sacrificado}"
	rm -f "${sem_relogio}/${relogio_sacrificado}"

	local intruso="sysloc-intruso-de-falsificacao.service"
	: >"${com_intruso}/${intruso}"

	local no_controle="" no_mutante_a="" no_mutante_b=""
	no_controle="$(divergencia_do_roster_em "${integro}")" || true
	no_mutante_a="$(divergencia_do_roster_em "${sem_relogio}")" || true
	no_mutante_b="$(divergencia_do_roster_em "${com_intruso}")" || true

	afirmar_igual "(controle) a caixa íntegra não produz achado algum" "0" \
		"$(contar_achados "${no_controle}")"
	local codigo_do_controle=0
	divergencia_do_roster_em "${integro}" >/dev/null || codigo_do_controle=$?
	afirmar_igual "(controle) e o comparador devolve 0" "0" "${codigo_do_controle}"

	afirmar_igual "(mutante A) o relógio removido é acusado, e sozinho" \
		"faltando: ${relogio_sacrificado}" "$(printf '%s' "${no_mutante_a}" | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "(mutante A) e NENHUMA linha \`sobrando:\` é produzida" \
		"0" "$(printf '%s\n' "${no_mutante_a}" | grep -c '^sobrando: ' || true)"
	local codigo_do_mutante_a=0
	divergencia_do_roster_em "${sem_relogio}" >/dev/null || codigo_do_mutante_a=$?
	afirmar_igual "(mutante A) e o comparador devolve 1" "1" "${codigo_do_mutante_a}"

	afirmar_igual "(mutante B) a unidade intrusa é acusada, e sozinha" \
		"sobrando: ${intruso}" "$(printf '%s' "${no_mutante_b}" | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "(mutante B) e NENHUMA linha \`faltando:\` é produzida" \
		"0" "$(printf '%s\n' "${no_mutante_b}" | grep -c '^faltando: ' || true)"
	local codigo_do_mutante_b=0
	divergencia_do_roster_em "${com_intruso}" >/dev/null || codigo_do_mutante_b=$?
	afirmar_igual "(mutante B) e o comparador devolve 1" "1" "${codigo_do_mutante_b}"

	# A exceção NÃO é um buraco genérico: ela vale para o nome declarado, e para
	# nenhum outro. Sem esta perna, `eh_excecao_declarada` poderia ser afrouxada
	# para um molde e o mutante B continuaria verde.
	local so_a_excecao="${base}/so-a-excecao"
	mkdir -p "${so_a_excecao}"
	for unidade in "${ROSTER[@]}"; do : >"${so_a_excecao}/${unidade}"; done
	local excecao
	for excecao in "${EXCECOES_FORA_DO_ROSTER[@]}"; do : >"${so_a_excecao}/${excecao}"; done
	local no_controle_da_excecao=""
	no_controle_da_excecao="$(divergencia_do_roster_em "${so_a_excecao}")" || true
	afirmar_igual "(controle) a exceção declarada não vira achado \`sobrando\`" \
		"0" "$(contar_achados "${no_controle_da_excecao}")"

	fechar_caso "CT-1147"
}

# =========================================================================== #
# CT-1148 — todo relógio do roster está HABILITADO e tem próxima execução
# conhecida e FUTURA.
#
# INVARIANTE: relógio instalado e desligado não dispara nada, e o modo de falha
# é silencioso — o arquivo está lá, a igualdade de conjunto do CT-1146 aprova, e
# a Rotina simplesmente nunca corre.
#
# ⚠️ A habilitação é afirmada pela cadeia LITERAL `enabled`. `enabled-runtime`
# não sobrevive ao reinício e `alias` não é habilitação nenhuma — as duas
# passariam num teste que apenas procurasse a subcadeia `enabled`.
#
# ⚠️ A leitura da próxima execução espera o TRANSITÓRIO passar antes de julgar, e
# as quatro pernas de falsificação do discriminador abrem este caso. As duas
# coisas são a mesma decisão, e ela está registrada por extenso no bloco do
# transitório, sob marcador — o `NextElapse` vazio de quem ACABOU DE DISPARAR é
# saudável, o de quem está morto não, e sem o discriminador este caso reprovava
# um host íntegro em ~1 de cada 8 execuções.
# =========================================================================== #
ct_1148() {
	caso "CT-1148" "todo relógio do roster está habilitado e tem próxima execução futura"

	local -a relogios=()
	mapfile -t relogios < <(relogios_do_roster)
	afirmar_diferente "o subconjunto dos relógios foi DERIVADO do roster" "0" "${#relogios[@]}"

	# (i) A FALSIFICAÇÃO DO DISCRIMINADOR vem PRIMEIRO, e sem depender do host —
	# o mesmo molde do CT-1152. Ela prova que o reconhecimento do transitório
	# pode dizer NÃO: sem ela, ele poderia ser afrouxado na rodada seguinte para
	# "vazio nunca reprova", e a asserção do relógio habilitado porém MORTO —
	# que é o que o CT-1154 existe para acusar — nunca mais poderia falhar.
	#
	# As entradas dos quatro casos têm `NextElapse` VAZIO, e é só o estado da
	# unidade disparada que as separa: com ela em execução, é o relógio que
	# acabou de disparar (saudável, espera-se); com ela inativa, é o morto.
	afirmar_igual "(transitório) relógio \`running\` com a unidade disparada em execução NÃO é lido como morto" \
		"1" "$(transitorio_do_relogio "running" "activating")"
	afirmar_igual "(transitório) e o eixo da unidade disparada vale SOZINHO, sem o SubState do relógio" \
		"1" "$(transitorio_do_relogio "waiting" "activating")"
	afirmar_igual "(mutante) com a unidade disparada INATIVA não há transitório — é o relógio morto" \
		"0" "$(transitorio_do_relogio "dead" "inactive")"
	afirmar_igual "(mutante) e a unidade disparada em FALHA também não é transitório" \
		"0" "$(transitorio_do_relogio "dead" "failed")"

	# E a outra ponta, que é o que impede a correção de virar afrouxamento: o
	# vazio que NÃO é transitório continua valendo `0` — exatamente o valor que a
	# asserção do laço abaixo reprova, nomeando a unidade.
	afirmar_igual "(mutante) próxima execução AUSENTE continua valendo 0 — o valor que a asserção reprova" \
		"0" "$(proxima_execucao_em_segundos "sysloc-relogio-inexistente-de-falsificacao.timer")"

	local agora
	agora="$(date +%s)"

	local relogio proxima examinados=0 nao_examinados=0
	for relogio in "${relogios[@]}"; do
		if ! unidade_esta_posicionada "${relogio}"; then
			nao_examinados=$((nao_examinados + 1))
			nota "${relogio} ainda não posicionada — já declarada por posicionar no CT-1146"
			continue
		fi
		examinados=$((examinados + 1))
		afirmar_igual "${relogio} está habilitado" "enabled" "$(estado_de_habilitacao "${relogio}")"
		# ⚠️ O transitório passa ANTES da leitura — ver o bloco do transitório. Sem
		# esta linha, o relógio que acabou de disparar é lido com `NextElapse`
		# vazio, vira `0` e reprova como se estivesse morto.
		aguardar_fim_do_transitorio "${relogio}" || true
		proxima="$(proxima_execucao_em_segundos "${relogio}")"
		afirmar_diferente "${relogio} tem próxima execução conhecida pelo supervisor" "0" "${proxima}"
		afirmar_igual "e a próxima execução de ${relogio} é FUTURA" "1" \
			"$((proxima > agora ? 1 : 0))"
	done

	# A contabilidade que impede o pulo silencioso: o que não foi examinado é
	# EXATAMENTE o que o CT-1146 já declarou por posicionar, e nada além.
	local esperados_por_posicionar=0 pendente
	for pendente in "${FALTANDO_NO_HOST[@]:-}"; do
		[[ "${pendente}" == *.timer ]] && esperados_por_posicionar=$((esperados_por_posicionar + 1))
	done
	afirmar_igual "os relógios não examinados são os que o CT-1146 declarou por posicionar" \
		"${esperados_por_posicionar}" "${nao_examinados}"
	afirmar_igual "e todos os demais relógios do roster foram examinados" \
		"$((${#relogios[@]} - esperados_por_posicionar))" "${examinados}"

	fechar_caso "CT-1148"
}

# =========================================================================== #
# CT-1149 — o relógio é habilitado, o DESPACHO não.
#
# INVARIANTE: nenhum `Type=oneshot` do roster, nem a unidade-modelo do alerta,
# está habilitado. Habilitar o despacho o faria correr NO BOOT, fora do horário
# declarado — e a Régua de cobrança correndo no arranque é efeito externo em
# horário que ninguém escolheu.
#
# ⚠️ `is-active` NÃO é consultado aqui: a unidade-modelo (`…@.service`) não tem
# instância própria, e o supervisor recusa a pergunta com erro. `is-enabled`
# responde `static` para ela, que é justamente o que este caso afirma.
# =========================================================================== #
ct_1149() {
	caso "CT-1149" "o relógio é habilitado e o despacho não — nenhum oneshot corre no boot"

	local -a despachos=()
	mapfile -t despachos < <(despachos_do_roster)
	afirmar_diferente "os despachos foram DERIVADOS da diferença roster − arranque" "0" "${#despachos[@]}"

	local habilitadas
	habilitadas="$(unidades_habilitadas_do_host)"
	# Antivácuo: um universo vazio faria a interseção abaixo ser vazia por
	# vacuidade, e o caso aprovaria um host em que nada está habilitado.
	afirmar_diferente "(antivácuo) o supervisor declara ao menos uma unidade habilitada" \
		"0" "$(contar_achados "${habilitadas}")"

	local despacho examinados=0 nao_examinados=0
	local -a posicionados=()
	for despacho in "${despachos[@]}"; do
		if ! unidade_esta_posicionada "${despacho}"; then
			nao_examinados=$((nao_examinados + 1))
			nota "${despacho} ainda não posicionada — já declarada por posicionar no CT-1146"
			continue
		fi
		examinados=$((examinados + 1))
		posicionados+=("${despacho}")
		afirmar_igual "${despacho} NÃO está habilitado — o supervisor o declara \`static\`" \
			"static" "$(estado_de_habilitacao "${despacho}")"
	done

	# ⚠️ `LC_ALL=C` no `comm`, e não só nos `sort`: `comm` compara com a colação do
	# ambiente, e sob outra colação ele recusa como "não ordenada" a lista que o
	# `sort` ordenou em C — a recusa vai para a saída de erro e a interseção sai
	# VAZIA, isto é, a asserção passaria por defeito da ferramenta.
	afirmar_igual "a interseção entre os despachos e as unidades habilitadas do host é VAZIA" "" \
		"$(LC_ALL=C comm -12 <(printf '%s\n' "${posicionados[@]:-}" | grep -v '^$' | LC_ALL=C sort) \
			<(printf '%s\n' "${habilitadas}") | tr '\n' ' ' | sed 's/ $//')"

	local esperados_por_posicionar=0 pendente
	for pendente in "${FALTANDO_NO_HOST[@]:-}"; do
		[[ -n "${pendente}" && "${pendente}" != *.timer ]] &&
			esperados_por_posicionar=$((esperados_por_posicionar + 1))
	done
	afirmar_igual "os despachos não examinados são os que o CT-1146 declarou por posicionar" \
		"${esperados_por_posicionar}" "${nao_examinados}"
	afirmar_igual "e todos os demais despachos do roster foram examinados" \
		"$((${#despachos[@]} - esperados_por_posicionar))" "${examinados}"

	fechar_caso "CT-1149"
}

# =========================================================================== #
# CT-1150 — a unidade do processador de trabalho não ficou para trás, e declara
# a dependência do banco pelos DOIS eixos.
#
# INVARIANTE: o texto instalado é byte a byte o versionado, E o que o supervisor
# carregou em memória declara `postgresql.service` em `After=` e em `Wants=`.
#
# ⚠️ Os dois eixos são independentes, e é por isso que os dois são afirmados: o
# arquivo pode estar certo e o supervisor ainda carregar a versão anterior (o
# `daemon-reload` que não correu), e o supervisor pode ter carregado o certo de
# um arquivo que alguém editou à mão depois. Um eixo só deixa metade aberta.
# =========================================================================== #
ct_1150() {
	caso "CT-1150" "a unidade do processador está em dia e declara a dependência do banco"

	local instalada="${DIR_UNIDADES_INSTALADAS}/${UNIDADE_DO_PROCESSADOR}"
	local versionada="${DIR_FONTE_UNIDADES}/${UNIDADE_DO_PROCESSADOR}"

	afirmar_igual "a unidade versionada existe no repositório" "1" \
		"$([[ -f "${versionada}" ]] && printf '1' || printf '0')"
	afirmar_igual "e ela está posicionada no host" "1" \
		"$(unidade_esta_posicionada "${UNIDADE_DO_PROCESSADOR}" && printf '1' || printf '0')"

	local codigo_do_cmp=0
	cmp -s "${instalada}" "${versionada}" || codigo_do_cmp=$?
	afirmar_igual "a instalada é byte a byte igual à versionada" "0" "${codigo_do_cmp}"

	# Eixo 1 — o TEXTO instalado, diretiva por diretiva.
	afirmar_igual "o texto instalado declara a dependência do banco nas duas diretivas" "" \
		"$(diretivas_de_dependencia_ausentes_em "${instalada}" | tr '\n' ' ' | sed 's/ $//')"

	# Eixo 2 — o que o SUPERVISOR carregou. É a metade que prova o `daemon-reload`.
	local diretiva
	for diretiva in "${DIRETIVAS_DA_DEPENDENCIA[@]}"; do
		afirmar_igual "o supervisor carregou \`${diretiva}=\` com ${DEPENDENCIA_DO_BANCO}" "1" \
			"$(propriedade_da_unidade "${UNIDADE_DO_PROCESSADOR}" "${diretiva}" |
				tr ' ' '\n' | grep -cxF "${DEPENDENCIA_DO_BANCO}" || true)"
	done

	fechar_caso "CT-1150"
}

# =========================================================================== #
# CT-1151 — falsificação da dependência, uma diretiva de cada vez.
#
# INVARIANTE: `After=` e `Wants=` são conferidas EM SEPARADO, e a ausência de uma
# só é acusada sozinha. As duas fazem coisas diferentes e nenhuma substitui a
# outra: `Wants=` sem `After=` sobe o processador antes do banco; `After=` sem
# `Wants=` não puxa o banco quando ele não estiver no alvo. Um analisador que
# aceitasse "pelo menos uma" aprovaria os dois defeitos.
#
# ⚠️ O mutante PARCIAL é o que discrimina: sem ele, um analisador que exigisse
# apenas a presença da palavra `postgresql.service` em qualquer lugar do arquivo
# continuaria verde no controle e no mutante completo.
# =========================================================================== #
ct_1151() {
	caso "CT-1151" "falsificação da dependência — as duas diretivas, uma de cada vez"

	local base="${DIR_TRABALHO}/ct-1151"
	mkdir -p "${base}"
	local integra="${base}/integra.service"
	local sem_as_duas="${base}/sem-as-duas.service"
	local sem_wants="${base}/sem-wants.service"

	cp "${DIR_FONTE_UNIDADES}/${UNIDADE_DO_PROCESSADOR}" "${integra}"
	sed -E "/^(After|Wants)=/d" "${integra}" >"${sem_as_duas}"
	sed -E "/^Wants=/d" "${integra}" >"${sem_wants}"

	# Antivácuo do arranjo: um `sed` que não casasse nada produziria três cópias
	# idênticas, e os dois mutantes concordariam com o controle.
	afirmar_diferente "(arranjo) o mutante completo difere da íntegra" \
		"$(wc -l <"${integra}")" "$(wc -l <"${sem_as_duas}")"
	afirmar_diferente "(arranjo) o mutante parcial difere da íntegra" \
		"$(wc -l <"${integra}")" "$(wc -l <"${sem_wants}")"

	afirmar_igual "(controle) a unidade íntegra não acusa ausência alguma" "" \
		"$(diretivas_de_dependencia_ausentes_em "${integra}" | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "(mutante completo) as DUAS diretivas são acusadas" \
		"ausente em After= ausente em Wants=" \
		"$(diretivas_de_dependencia_ausentes_em "${sem_as_duas}" | tr '\n' ' ' | sed 's/ $//')"
	afirmar_igual "(mutante parcial) APENAS \`Wants=\` é acusada" \
		"ausente em Wants=" \
		"$(diretivas_de_dependencia_ausentes_em "${sem_wants}" | tr '\n' ' ' | sed 's/ $//')"

	fechar_caso "CT-1151"
}

# =========================================================================== #
# CT-1154 — o conjunto está de pé, sem relógio morto e sem unidade em falha.
#
# INVARIANTE: toda unidade do arranque posicionada está `active`, com o
# `SubState` que a natureza dela impõe (`waiting` no relógio, `running` no
# permanente); nenhum relógio está `enabled` porém morto; e nenhuma unidade do
# roster consta da lista de falhas do supervisor.
#
# ⚠️ O relógio HABILITADO E MORTO é o modo de falha que este caso existe para
# acusar, e ele não é hipotético: um `OnCalendar=` que o supervisor recuse deixa
# a unidade `enabled` e `inactive/dead`, e o CT-1148 sozinho não a pega — ele
# olha a próxima execução, que nesse estado o supervisor simplesmente não
# publica.
#
# ⚠️ ESTE PARÁGRAFO JÁ LEU A AMBIGUIDADE NA DIREÇÃO ERRADA, e a correção é
# conteúdo. Ele previa o falso NEGATIVO — "a asserção confunde o defeito com
# 'ainda não calculou'" —, e num relógio de cadência de um minuto a manifestação
# medida é o falso POSITIVO: o transitório saudável de quem ACABOU DE DISPARAR
# lido como relógio habilitado-porém-morto, aqui pelo `SubState` `running` e no
# CT-1148 pela próxima execução vazia. Quem separa os dois é o estado da unidade
# que o `Unit=` do relógio nomeia — ver o bloco do transitório, e as quatro
# pernas de falsificação dele no CT-1148.
#
# ⚠️ A sobrevivência a REINÍCIO (invariante 7) não se prova sem reiniciar. Quando
# o último arranque deste servidor é anterior à instalação das unidades, o
# conjunto ativo hoje não prova nada sobre o próximo boot, e a frente degrada.
# =========================================================================== #
ct_1154() {
	caso "CT-1154" "o conjunto está de pé, sem relógio habilitado porém morto e sem unidade em falha"

	# O `SubState` esperado sai da natureza DERIVADA da unidade, e não de um teste
	# de sufixo escrito aqui: `permanentes_do_arranque` é a mesma derivação que o
	# resto da bateria usa, e um sufixo redigitado divergiria dela em silêncio.
	local permanentes
	permanentes="$(permanentes_do_arranque)"
	afirmar_diferente "os permanentes do arranque foram DERIVADOS do roster" "" "${permanentes}"

	local unidade estado subestado esperado examinados=0 nao_examinados=0
	for unidade in "${ROSTER_DO_ARRANQUE[@]}"; do
		if ! unidade_esta_posicionada "${unidade}"; then
			nao_examinados=$((nao_examinados + 1))
			nota "${unidade} ainda não posicionada — já declarada por posicionar no CT-1146"
			continue
		fi
		examinados=$((examinados + 1))
		# ⚠️ Mesma raiz da linha irmã do CT-1148: enquanto o `oneshot` disparado
		# está correndo, o `SubState` do relógio é `running`, e não `waiting`. A
		# espera é inócua para o que NÃO é relógio — sem `Unit=` publicado ela
		# devolve na hora, e é por isso que o permanente do arranque, cujo
		# `running` é o estado normal, não fica esperando por nada.
		aguardar_fim_do_transitorio "${unidade}" || true
		estado="$(estado_de_atividade "${unidade}")"
		subestado="$(propriedade_da_unidade "${unidade}" SubState)"
		afirmar_igual "${unidade} está ativa" "active" "${estado}"
		if printf '%s\n' "${permanentes}" | grep -qxF "${unidade}"; then
			esperado="running"
		else
			esperado="waiting"
		fi
		afirmar_igual "e o SubState de ${unidade} é \`${esperado}\`" "${esperado}" "${subestado}"
	done

	local esperados_por_posicionar=0 pendente
	for pendente in "${FALTANDO_NO_HOST[@]:-}"; do
		[[ -n "${pendente}" ]] || continue
		printf '%s\n' "${ROSTER_DO_ARRANQUE[@]}" | grep -qxF "${pendente}" &&
			esperados_por_posicionar=$((esperados_por_posicionar + 1))
	done
	afirmar_igual "as unidades do arranque não examinadas são as que o CT-1146 declarou por posicionar" \
		"${esperados_por_posicionar}" "${nao_examinados}"
	afirmar_igual "e todas as demais unidades do arranque foram examinadas" \
		"$((${#ROSTER_DO_ARRANQUE[@]} - esperados_por_posicionar))" "${examinados}"

	# O relógio habilitado PORÉM morto — o estado que nenhuma das duas leituras
	# anteriores acusa sozinha.
	local relogio mortos=""
	while IFS= read -r relogio; do
		[[ -n "${relogio}" ]] || continue
		unidade_esta_posicionada "${relogio}" || continue
		[[ "$(estado_de_habilitacao "${relogio}")" == "enabled" ]] || continue
		[[ "$(estado_de_atividade "${relogio}")" == "active" ]] && continue
		mortos="${mortos}${mortos:+ }${relogio}(is-enabled=enabled is-active=$(estado_de_atividade "${relogio}") sub-state=$(propriedade_da_unidade "${relogio}" SubState))"
	done < <(relogios_do_roster)
	afirmar_igual "nenhum relógio do roster está habilitado porém morto" "" "${mortos}"

	# Nenhuma unidade do roster na lista de falhas do supervisor.
	local em_falha
	em_falha="$(systemctl list-units --state=failed --no-legend --no-pager "${MOLDE_DAS_UNIDADES_DO_PRODUTO}" 2>/dev/null |
		awk '{print $1}' | LC_ALL=C sort || true)"
	afirmar_igual "nenhuma unidade do produto consta das falhas do supervisor" "" \
		"$(printf '%s' "${em_falha}" | tr '\n' ' ' | sed 's/ $//')"

	if precondicao_privilegiada_disponivel boot-posterior-a-instalacao; then
		afirmar_igual "o conjunto de pé é POSTERIOR ao último arranque — ele sobe sozinho" "1" \
			"$((examinados > 0 ? 1 : 0))"
	else
		degradar boot-posterior-a-instalacao \
			"o último arranque deste servidor é ANTERIOR à instalação das unidades: o conjunto ativo hoje não prova o invariante 7"
	fi

	fechar_caso "CT-1154"
}

# =========================================================================== #
# CT-1152 — o destino do e-mail é o laço local, afirmado por host E porta.
#
# INVARIANTE: o `SMTP_URL` que o processador de trabalho EFETIVAMENTE carrega tem
# host no laço local e porta `1025`. Sob `NODE_ENV=production` e com as Rotinas
# instaladas, um host fora do laço alcançaria a caixa de uma pessoa real na
# primeira passada da Régua de cobrança — e o modo de falhar é SILENCIOSO: a
# Tentativa de envio registra desfecho `entregue` porque o servidor aceitou a
# mensagem (scope §5.9).
#
# ⚠️ O valor é lido do `environ` do PROCESSO EM EXECUÇÃO, e não do arquivo de
# ambiente. São coisas diferentes: o arquivo descreve a PRÓXIMA partida, e o
# processo que está correndo agora pode ter sido lançado com outro valor. É
# também o único dos dois legível sem privilégio — o arquivo é `0600 root:root`,
# e a §5.6 da task proíbe afrouxá-lo, copiá-lo ou criar caminho no produto que o
# devolva (ADR-0005, ADR-0032).
#
# ⚠️ A ausência de vazamento é provada POR MEDIÇÃO DA SAÍDA REAL, como a ADR-0032
# manda — e não por leitura do código. A saída desta execução é espelhada num
# arquivo, e a varredura roda sobre ele, com CONTROLE POSITIVO de agulha plantada:
# sem o controle, uma varredura quebrada devolveria zero para tudo e a asserção
# passaria por vacuidade.
#
# ⚠️ Este é o ÚLTIMO caso da bateria de propósito: a varredura só alcança o que
# já foi impresso, e um caso posterior ficaria fora dela.
# =========================================================================== #
ct_1152() {
	caso "CT-1152" "o destino do e-mail é o laço local, por host e porta, e a URL crua não escapa"

	# (i) A falsificação vem PRIMEIRO, e sem depender do host: ela prova que o
	# analisador pode reprovar. Rodando depois da asserção real, um analisador
	# que devolvesse sempre a cadeia vazia deixaria as duas verdes.
	local sintetica_local sintetica_externa sintetica_porta
	sintetica_local="$(printf '%s://%s:%s' 'smtp' '127.0.0.1' "${PORTA_DO_CAPTURADOR}")"
	sintetica_externa="$(printf '%s://%s:%s' 'smtp' 'smtp.exemplo.invalid' "${PORTA_DO_CAPTURADOR}")"
	sintetica_porta="$(printf '%s://%s:%s' 'smtp' '127.0.0.1' '587')"

	afirmar_igual "(controle) um destino no laço local não produz diagnóstico" "" \
		"$(diagnostico_do_destino "${sintetica_local}")"
	afirmar_igual "(mutante) host externo reprova NOMEANDO host e porta" \
		"host fora do laço local: smtp.exemplo.invalid:${PORTA_DO_CAPTURADOR}" \
		"$(diagnostico_do_destino "${sintetica_externa}")"
	afirmar_igual "(mutante) porta fora do capturador reprova NOMEANDO host e porta" \
		"porta fora do capturador: 127.0.0.1:587" \
		"$(diagnostico_do_destino "${sintetica_porta}")"
	afirmar_igual "(mutante) a AUSÊNCIA falha fechado, e não cai no padrão da biblioteca" \
		"${NOME_DA_CHAVE_DO_DESTINO} ausente" "$(diagnostico_do_destino "")"

	# (ii) O valor real, quando este host permite lê-lo.
	local valor=""
	if precondicao_privilegiada_disponivel ambiente-do-processador; then
		valor="$(valor_no_ambiente_do_processador "${NOME_DA_CHAVE_DO_DESTINO}")" || valor=""
		afirmar_igual "o destino que o processador carrega está no laço local, na porta do capturador" \
			"" "$(diagnostico_do_destino "${valor}")"
		# Só host e porta saem impressos — nunca a linha crua, nunca uma vizinha.
		local sem_esquema="${valor#*://}"
		sem_esquema="${sem_esquema%%/*}"
		sem_esquema="${sem_esquema##*@}"
		nota "destino medido: host=${sem_esquema%:*} porta=${sem_esquema##*:}"
	else
		degradar ambiente-do-processador \
			"o processador de trabalho não está de pé, ou o \`environ\` dele não é legível por quem executa"
	fi

	# (iii) A varredura da SAÍDA REAL, com controle positivo.
	local agulha
	agulha="$(printf '%s://%s:%s@%s:%s' 'smtp' 'sentinela' 'segredo-plantado-de-controle' \
		'198.51.100.7' '2525')"
	nota "controle positivo da varredura (agulha sintética): ${agulha}"

	if sincronizar_diario; then
		afirmar_igual "(controle positivo) a varredura ENCONTRA a agulha plantada na saída" \
			"1" "$(ocorrencias_na_saida "${agulha}")"

		local chave valor_da_chave escaparam=0 conferidas=0
		for chave in "${CHAVES_QUE_NAO_PODEM_ESCAPAR[@]}"; do
			valor_da_chave="$(valor_no_ambiente_do_processador "${chave}")" || valor_da_chave=""
			[[ "${#valor_da_chave}" -ge "${COMPRIMENTO_MINIMO_DA_AGULHA}" ]] || continue
			conferidas=$((conferidas + 1))
			[[ "$(ocorrencias_na_saida "${valor_da_chave}")" == "0" ]] ||
				escaparam=$((escaparam + 1))
		done
		if [[ "${conferidas}" -gt 0 ]]; then
			afirmar_igual "nenhum valor sensível do ambiente do processador aparece na saída" \
				"0" "${escaparam}"
			nota "valores conferidos na varredura: ${conferidas} de ${#CHAVES_QUE_NAO_PODEM_ESCAPAR[@]} chaves declaradas"
		else
			degradar ambiente-do-processador \
				"nenhum valor sensível pôde ser lido para a varredura — ela ficaria vazia por vacuidade"
		fi
	else
		falhar "a saída desta execução não alcançou o espelho em ${LIMITE_DE_SINCRONIA_DECIMOS} décimos de segundo — a varredura ficaria sobre arquivo incompleto"
	fi

	fechar_caso "CT-1152"
}

# =========================================================================== #
# O VEREDITO DE FECHO — as leituras GLOBAIS, no único lugar em que elas têm
# sujeito.
#
# INVARIANTE: a execução inteira, feita SEM privilégio, termina sem falha; toda
# degradação pertence a uma frente declarada, traz rótulo e comando, e respeita o
# teto da frente; e o código de saída que o estado REAL desta execução produz é o
# que o contrato do cabeçalho promete para esse estado.
#
# ⚠️ ELA NÃO ABRE `caso`, e isso é conteúdo — pelas duas razões que
# `verificar-backup.sh` já registrou: (1) `falhas_totais` é acumulador de TODA a
# bateria, e afirmá-lo dentro de um caso faria esse caso reprovar por defeito
# alheio; (2) `casos_executados` é conferido contra a tabela declarada em
# `verificar-backup.sh` (CT-1126), e um caso a mais aqui reprovaria lá.
# =========================================================================== #
auditar_o_fecho_da_bateria() {
	printf '\n[fecho] o veredito global desta execução\n'

	afirmar_diferente "esta bateria não está sendo executada como superusuário" "0" "${EUID}"
	afirmar_igual "e ela abriu TODOS os casos declarados, sem abortar no meio" \
		"${CASOS_DECLARADOS_NESTA_BATERIA}" "${casos_executados}"

	# (i) Nenhuma degradação fora do universo declarado.
	local entrada rotulo teto observadas degradacao fora_do_universo=0
	for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
		[[ -n "${degradacao}" ]] || continue
		local conhecida=0
		for entrada in "${FRENTES_PRIVILEGIADAS[@]}"; do
			[[ "${degradacao}" == *"[${entrada%%|*}]"* ]] && conhecida=1
		done
		[[ "${conhecida}" -eq 1 ]] || fora_do_universo=$((fora_do_universo + 1))
	done
	afirmar_igual "toda degradação pertence a uma frente privilegiada declarada" \
		"0" "${fora_do_universo}"

	# (ii) A disjunção que impede uma frente de sumir em silêncio: pré-condição
	# ausente OBRIGA degradação; pré-condição presente PROÍBE degradação.
	for entrada in "${FRENTES_PRIVILEGIADAS[@]}"; do
		rotulo="${entrada%%|*}"
		teto="${entrada##*|}"
		observadas=0
		for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
			[[ "${degradacao}" == *"[${rotulo}]"* ]] && observadas=$((observadas + 1))
		done
		if precondicao_privilegiada_disponivel "${rotulo}"; then
			afirmar_igual "a frente [${rotulo}] está disponível neste host, e nenhuma linha degradou" \
				"0" "${observadas}"
		else
			afirmar_diferente "a frente [${rotulo}] indisponível NÃO passa em silêncio" \
				"0" "${observadas}"
			afirmar_igual "e não excede as ${teto} linha(s) que a tabela lhe dá" \
				"1" "$((observadas <= teto ? 1 : 0))"
		fi
	done

	afirmar_igual "o contador de degradações bate com o que a entrada única registrou" \
		"${#DEGRADACOES_OBSERVADAS[@]}" "${avisos_totais}"

	# (iii) Toda degradação diz o que ficou por medir E o comando que o mediria.
	# Sem o comando, o aviso deixa o operador sem saída — e aviso sem saída vira
	# ruído, que é o que ensina a não ler os avisos que importam.
	local sem_comando=0 sem_rotulo=0
	for degradacao in "${DEGRADACOES_OBSERVADAS[@]:-}"; do
		[[ -n "${degradacao}" ]] || continue
		[[ "${degradacao}" == *"${MARCA_DO_COMANDO_QUE_MEDIRIA}"* ]] || sem_comando=$((sem_comando + 1))
		[[ "${degradacao}" =~ \[[a-z-]+\] ]] || sem_rotulo=$((sem_rotulo + 1))
	done
	afirmar_igual "toda degradação nomeia o comando que a mediria" "0" "${sem_comando}"
	afirmar_igual "toda degradação carrega o rótulo da frente que a produziu" "0" "${sem_rotulo}"

	# O desfecho é medido ANTES das duas asserções finais: uma asserção daqui que
	# reprovasse somaria `falhas_totais` e mudaria o desfecho que ela mesma afirma.
	local codigo=0
	(desfecho_da_bateria) >/dev/null 2>&1 || codigo=$?
	if [[ "${falhas_totais}" -ne 0 ]]; then
		afirmar_igual "com falha registrada, o desfecho desta execução é 1 — nunca 0" "1" "${codigo}"
	elif [[ "${#DEGRADACOES_OBSERVADAS[@]}" -eq 0 ]]; then
		afirmar_igual "sem degradação alguma, o desfecho desta execução é 0" "0" "${codigo}"
	else
		afirmar_igual "com asserção por medir, o desfecho desta execução é 2 — nunca 0" "2" "${codigo}"
	fi

	afirmar_igual "nada reprovou nesta execução — a falta de privilégio não vira falha" \
		"0" "${falhas_totais}"

	nota "degradações declaradas nesta execução: ${#DEGRADACOES_OBSERVADAS[@]}"
}

# =========================================================================== #
# O DESFECHO — a única decisão do código de saída desta bateria. Ver o contrato
# de saída no cabeçalho.
#
# Ele é uma função à parte, e não código inline em `main`, para que a auditoria
# de fecho possa exercitar A MESMA função que decide o desfecho real, com o
# estado desta execução, em subshell. Uma reimplementação lá provaria a
# reimplementação, e continuaria verde com um `main` que saísse 0 tendo reprovado.
# =========================================================================== #
desfecho_da_bateria() {
	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		if [[ "${avisos_totais}" -ne 0 ]]; then
			printf 'verificar-unidades-agendadas: %d/%d casos sem falha, e há asserção declarada e NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${casos_aprovados}" "${casos_executados}" >&2
			printf '  cada linha AVISO nomeia a frente que ficou por medir e o comando que a mediria — esta bateria NÃO roda como root (ver o cabeçalho).\n' >&2
			exit 2
		fi
		printf 'verificar-unidades-agendadas: %d/%d casos aprovados (CT-1146 a CT-1152 e CT-1154)\n' \
			"${casos_aprovados}" "${casos_executados}"
		exit 0
	fi

	printf 'verificar-unidades-agendadas: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

# =========================================================================== #
# Pré-condições de execução.
# =========================================================================== #

# ⚠️ Ela RECUSA o superusuário, e não o exige. A razão é dupla: o `environ` do
# processador pertence ao dono do repositório, e o agregador
# (`deploy/scripts/verificacao/rodar-baterias.sh`) decide a identidade de
# execução por padrão no fonte — uma bateria que declarasse exigência de root
# seria lançada como root, onde o `mise` não está no caminho.
recusar_privilegio() {
	if [[ "${EUID}" -eq 0 ]]; then
		printf 'ERRO: esta bateria não roda como superusuário — ela lê o ambiente do processador de trabalho, que pertence ao dono do repositório.\n' >&2
		printf '      execute como o dono do repositório: bash %s\n' "${BASH_SOURCE[0]}" >&2
		exit 1
	fi
}

exigir_ferramentas() {
	local faltando="" ferramenta
	for ferramenta in systemctl find comm grep sed awk cmp date stat tee mktemp tr head wc; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando="${faltando} ${ferramenta}"
	done
	if [[ -n "${faltando// /}" ]]; then
		printf 'ERRO: ferramenta obrigatória ausente:%s\n' "${faltando}" >&2
		exit 1
	fi
}

# Quantos casos esta bateria declara abrir. Escrito por extenso, e não derivado
# do próprio texto: derivá-lo faria a asserção concordar com qualquer contagem —
# uma bateria que abortasse no meio teria o esperado encolhido junto.
readonly CASOS_DECLARADOS_NESTA_BATERIA=8

# =========================================================================== #
main() {
	printf 'Verificação da convergência do host — %s\n' "${RAIZ_REPO}"

	recusar_privilegio
	exigir_ferramentas

	DIR_TRABALHO="$(mktemp -d)"
	chmod 700 "${DIR_TRABALHO}"

	# O espelho da SAÍDA REAL, que o CT-1152 varre. Os canais originais ficam em
	# 3 e 4 para que `limpar` possa devolvê-los e o espelho drenar antes do fim.
	DIARIO_DA_EXECUCAO="${DIR_TRABALHO}/saida-desta-execucao.txt"
	: >"${DIARIO_DA_EXECUCAO}"
	exec 3>&1 4>&2
	exec > >(tee -a "${DIARIO_DA_EXECUCAO}") 2> >(tee -a "${DIARIO_DA_EXECUCAO}" >&2)

	carregar_roster
	if [[ "${#ROSTER[@]}" -eq 0 || "${#ROSTER_DO_ARRANQUE[@]}" -eq 0 ]]; then
		printf 'ERRO: não consegui extrair UNIDADES/UNIDADES_DO_ARRANQUE de %s.\n' "${INSTALADOR}" >&2
		printf '      esta bateria NÃO redigita as listas — sem a extração não há o que comparar.\n' >&2
		exit 1
	fi
	nota "roster extraído de ${INSTALADOR#"${RAIZ_REPO}/"}: ${#ROSTER[@]} unidade(s), ${#ROSTER_DO_ARRANQUE[@]} no arranque"

	# ⚠️ A ORDEM É CONTEÚDO. O CT-1146 é o primeiro porque preenche
	# `FALTANDO_NO_HOST`, que os três casos de estado consomem para não pular
	# unidade em silêncio. O CT-1152 é o ÚLTIMO porque varre a saída já impressa —
	# um caso depois dele ficaria fora da varredura.
	ct_1146
	ct_1147
	ct_1148
	ct_1149
	ct_1150
	ct_1151
	ct_1154
	ct_1152

	auditar_o_fecho_da_bateria

	desfecho_da_bateria
}

main "$@"
