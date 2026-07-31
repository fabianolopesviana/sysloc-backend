#!/usr/bin/env bash
#
# Verificação do provisionamento dos serviços de base — T2 da fatia
# `fundacao-stack-nativa`.
#
# Casos cobertos: CT-001, CT-002, CT-003, CT-004, CT-005.
#
# O que este script prova, em uma frase por caso:
#
#   CT-001  o provisionamento executado duas vezes seguidas sai 0 nas duas e a
#           segunda execução não altera nenhum estado observável — em especial,
#           a credencial NÃO é regerada;
#   CT-002  com espaço em disco insuficiente no destino, o provisionamento
#           aborta ANTES de instalar qualquer coisa, com requerido, disponível e
#           déficit em números;
#   CT-003  a credencial gerada não aparece na árvore versionada, no argumento
#           de nenhum processo filho nem em linha alguma de log;
#   CT-004  uma tarefa gravada na fila sobrevive à parada e ao retorno do
#           servidor de fila;
#   CT-005  o provisionamento não alterou o ambiente legado nem colidiu com
#           suas portas.
#
# ---------------------------------------------------------------------------
# Como esta bateria é executada
# ---------------------------------------------------------------------------
#
# CT-001 e CT-005 comparam RETRATOS do sistema tirados em três momentos: antes
# da 1ª execução do provisionamento, depois dela e depois da 2ª. Retrato tirado
# depois não pode ser reconstruído, então quem executa o provisionamento captura
# os retratos no caminho. Este script oferece o subcomando `retrato` justamente
# para isso — a captura é a mesma nos três momentos, e uma diferença de forma
# entre eles produziria diferença de conteúdo que não veio do provisionamento.
#
#   sudo bash verificar-provisionamento.sh retrato <diretório>
#
# A sequência completa está no roteiro de execução assistida da task. Em resumo,
# dentro de ${DIR_EVIDENCIA}:
#
#   retrato-pre/       antes da 1ª execução
#   execucao-1.log     saída combinada da 1ª execução
#   execucao-1.codigo  código de saída da 1ª execução
#   retrato-pos1/      depois da 1ª execução
#   execucao-2.log     saída combinada da 2ª execução
#   execucao-2.codigo  código de saída da 2ª execução
#   retrato-pos2/      depois da 2ª execução
#
# ---------------------------------------------------------------------------
# ADR-0006 — a bateria e o ambiente de operação
# ---------------------------------------------------------------------------
#
# ESTA BATERIA ALTERA O SISTEMA REAL, e é por isso que a ADR-0006 a alcança
# diretamente — não por causa da suíte automatizada da fatia, que é outro
# artefato e resolve o seu lado subindo instâncias efêmeras próprias. Três
# pontos alteram o sistema: o CT-004 reinicia a instância de fila, e o CT-002 e
# o CT-003 reexecutam o provisionamento (contra um sistema de arquivos pequeno e
# sob rastreio, respectivamente).
#
# Isso é legítimo ENQUANTO esta instalação não atender a operação — hoje quem
# atende é o ambiente legado, e a pilha desta fatia não serve ninguém. Como essa
# condição é temporária, ela não fica por conta da memória de quem executa:
# `recusar_bateria_em_producao` recusa a bateria quando a instalação estiver
# marcada como a que atende a operação. Ver o cabeçalho daquela função para a
# escolha do mecanismo.
#
# Conferir porta e diretório antes de reiniciar (CT-004) resolve outra coisa, e
# as duas se somam: evita atingir a instância ERRADA — o `redis-server` de
# sistema, que é do legado —, enquanto o guarda acima evita atingir uma instância
# VIVA.
#
# ---------------------------------------------------------------------------
# Parâmetros
# ---------------------------------------------------------------------------
#
#   SYSLOC_DIR_EVIDENCIA   Diretório com os retratos e as saídas preservadas.
#                          Padrão: /var/tmp/sysloc-provisionamento
#
# Uso:
#   sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh
#   sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh retrato <dir>
#

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO
readonly SCRIPT_PROVISIONAR="${RAIZ_REPO}/deploy/scripts/instalacao/provisionar-base.sh"

DIR_EVIDENCIA="${SYSLOC_DIR_EVIDENCIA:-/var/tmp/sysloc-provisionamento}"
readonly DIR_EVIDENCIA

# Constantes espelhadas de `provisionar-base.sh`. Cada caso que usa uma delas
# confere, como asserção, que o script de provisionamento continua declarando o
# mesmo valor — é o que impede a bateria de envelhecer em silêncio se alguém
# mudar uma porta lá e esquecer daqui.
readonly ARQ_AMBIENTE="/etc/sysloc/backend.env"
readonly DONO_ARQ_AMBIENTE="root"
readonly PAPEL_DB="sysloc_app"
readonly BANCO_DB="sysloc"
readonly PORTA_FILA=6380
readonly ARQ_FILA_CONF="/etc/redis/redis-sysloc.conf"
readonly DIR_FILA_DADOS="/var/lib/redis/sysloc"
readonly UNIDADE_FILA="redis-server@sysloc.service"
readonly PORTA_SMTP_CAPTURADOR=1025
readonly PORTA_HTTP_CAPTURADOR=8025
readonly DIR_SOCKET_PG="/var/run/postgresql"

# Marcador que a fatia de implantação (F7) passa a criar quando esta instalação
# assumir o atendimento da operação. Ver `instalacao_liberada_para_bateria`.
readonly ARQ_MARCADOR_PRODUCAO="/etc/sysloc/producao"

# Portas que o provisionamento abre. O CT-005 exige interseção vazia entre elas
# e as portas pré-existentes.
readonly PORTAS_NOVAS=(6380 1025 8025)

# Serviços que precisam subir no arranque do sistema.
readonly SERVICOS_ARRANQUE=(
	"postgresql.service"
	"redis-server@sysloc.service"
	"sysloc-mailpit.service"
)

# Arquivos de configuração geridos pelo provisionamento. O CT-001 exige que a
# soma SHA-256 de cada um seja idêntica entre a 1ª e a 2ª execução.
readonly ARQUIVOS_CONFIGURACAO=(
	"/etc/apt/sources.list.d/pgdg.sources"
	"/etc/postgresql/18/main/postgresql.conf"
	"/etc/postgresql/18/main/conf.d/10-sysloc.conf"
	"/etc/postgresql/18/main/pg_hba.conf"
	"/etc/redis/redis-sysloc.conf"
	"/etc/systemd/system/sysloc-mailpit.service"
)

# Portas efêmeras são atribuídas pelo núcleo (ip_local_port_range começa em
# 32768) e mudam sozinhas entre dois retratos, sem que nada tenha acontecido.
# Compará-las produziria reprovação por ruído, não por dano.
readonly PRIMEIRA_PORTA_EFEMERA=32768

readonly LIMITE_FILA_RESPONDER=60

# Piso de plausibilidade para a asserção (g) do CT-003. Uma execução completa do
# provisionamento sobre estado já correto dispara centenas de `execve` (14 passos
# × vários comandos, mais as pré-condições); uma que aborta no primeiro guarda
# dispara menos de uma dezena. O piso separa as duas situações sem depender do
# número exato, que muda a cada passo acrescentado ao provisionamento.
readonly MINIMO_EXECVE=20

DIR_TEMPORARIO=""
DIR_TMPFS=""
CHAVE_PROVA=""

# Preenchidas pelas funções que o CT-003 carrega de `provisionar-base.sh`.
# Declaradas aqui porque o script roda sob `set -u`.
CREDENCIAL_LIDA=""
CHAVES_REPETIDAS=""

falhas_totais=0
falhas_caso=0
casos_aprovados=0
casos_executados=0

# --------------------------------------------------------------------------- #
# Asserções — mesma convenção de `verificar-workspace.sh` e `verificar-golden.sh`.
# --------------------------------------------------------------------------- #
caso() {
	printf '\n[%s] %s\n' "$1" "$2"
	falhas_caso=0
	casos_executados=$((casos_executados + 1))
}

ok() { printf '    OK   %s\n' "$*"; }

falhar() {
	falhas_caso=$((falhas_caso + 1))
	falhas_totais=$((falhas_totais + 1))
	printf '    FALHA %s\n' "$*" >&2
}

aviso() { printf '    AVISO %s\n' "$*" >&2; }

nota() { printf '    ..   %s\n' "$*"; }

afirmar_igual() {
	if [[ "$2" == "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — esperado [$2], obtido [$3]"
	fi
}

afirmar_diferente() {
	if [[ "$2" != "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — obtido [$3], que deveria ser diferente de [$2]"
	fi
}

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		casos_aprovados=$((casos_aprovados + 1))
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# --------------------------------------------------------------------------- #
# Limpeza — armada ANTES de montar sistema de arquivos, criar clone ou plantar
# chave na fila.
# --------------------------------------------------------------------------- #
limpar() {
	local codigo=$?

	if [[ -n "${CHAVE_PROVA}" ]]; then
		redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" del "${CHAVE_PROVA}" >/dev/null 2>&1 || true
		CHAVE_PROVA=""
	fi

	if [[ -n "${DIR_TMPFS}" ]] && mountpoint -q "${DIR_TMPFS}" 2>/dev/null; then
		umount "${DIR_TMPFS}" || true
	fi
	if [[ -n "${DIR_TMPFS}" && -d "${DIR_TMPFS}" ]]; then
		rmdir "${DIR_TMPFS}" 2>/dev/null || true
	fi

	if [[ -n "${DIR_TEMPORARIO}" && -d "${DIR_TEMPORARIO}" ]]; then
		rm -rf "${DIR_TEMPORARIO}"
	fi

	return "${codigo}"
}
trap limpar EXIT

# O trap de EXIT sozinho não roda quando o shell morre por sinal. Sem estes, um
# Ctrl-C no meio do CT-002 deixaria um sistema de arquivos montado e, no meio do
# CT-004, uma chave de prova na instância de fila.
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# --------------------------------------------------------------------------- #
# Utilitários.
# --------------------------------------------------------------------------- #

# `git` sobre um diretório que pertence a outro usuário. A bateria roda como
# root e o repositório pertence ao usuário de trabalho; sem isto o Git recusa a
# operação por "dubious ownership" e o CT-003 falharia por motivo alheio ao que
# ele mede. O ajuste vale só para a invocação, nunca é persistido.
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

# Lê a credencial do banco de um arquivo de ambiente, em tempo de execução. O
# valor sai por stdout do subshell e é capturado numa variável local pelo
# chamador — nunca é impresso, nunca vai para argumento de comando, nunca é
# gravado. Devolve 1 (sem imprimir nada) quando não há credencial íntegra.
#
# A captura é GULOSA até o último '@' e a validação de alfabeto é um passo
# SEPARADO, pelo mesmo motivo do script de provisionamento: uma classe restrita
# dentro da expressão de extração não falha, ela trunca — e uma agulha truncada
# enfraqueceria de uma só vez as asserções (c), (f), (g) e (h) deste caso, além
# de tender a produzir falso positivo na varredura por ser curta demais.
# Recusar é a resposta certa: melhor o caso REPROVAR do que passar com agulha
# fraca. As asserções (i) e (j) exercitam este leitor diretamente.
ler_credencial_db() {
	local arquivo="$1"

	[[ -f "${arquivo}" ]] || return 1

	# Mesma recusa de ambiguidade do provisionamento, pela mesma razão: com a
	# chave atribuída duas vezes, este leitor pegaria a primeira e o systemd a
	# última, e a agulha do caso seria a credencial errada — que, sendo
	# alfanumérica, atravessaria a validação de alfabeto sem ruído nenhum.
	if printf '%s\n' "$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		sort | uniq -d)" | grep -q .; then
		return 1
	fi

	local valor
	valor="$(sed -n 's|^DATABASE_URL=postgresql://[^:/]*:\(.*\)@.*$|\1|p' "${arquivo}" 2>/dev/null)"
	if [[ ! "${valor}" =~ ^[A-Za-z0-9]+$ ]]; then
		return 1
	fi
	printf '%s' "${valor}"
}

# --------------------------------------------------------------------------- #
# Sondas do CT-003 sobre os DOIS leitores.
#
# CAUSA-RAIZ de existirem duas: a versão anterior das asserções (i)/(j)
# exercitava apenas `ler_credencial_db`, que é o leitor DESTE arquivo — uma
# reimplementação do caminho de leitura do provisionamento. O defeito perseguido
# vivia no provisionamento, e nenhuma asserção o tocava: um `provisionar-base.sh`
# com a extração truncante de volta passava na bateria inteira. Agora o leitor do
# provisionamento é CARREGADO do arquivo real e submetido à mesma tabela.
#
# São dois SUTs distintos com o mesmo invariante, e cada um precisa da sua
# asserção: o provisionamento é quem reescreve a senha do banco, e o verificador
# é quem escolhe a agulha das varreduras (c), (f) e (g).
# --------------------------------------------------------------------------- #

# Carrega, do arquivo indicado, as funções REAIS que compõem o caminho de leitura
# do provisionamento. Recebe o caminho por parâmetro para poder ser apontada a
# uma cópia mutilada — é assim que se prova que a asserção reprova.
carregar_funcoes_do_provisionador() {
	local script="$1"
	local trecho fn
	local -a funcoes=(credencial_manuseavel extrair_credencial_db conferir_coordenadas_do_ambiente)

	CREDENCIAL_LIDA=""
	CHAVES_REPETIDAS=""
	COORDENADAS_DIVERGENTES=""
	CHAVES_AUSENTES=""

	for fn in "${funcoes[@]}"; do
		trecho="$(sed -n "/^${fn}() {/,/^}/p" "${script}")"
		[[ -n "${trecho}" ]] || return 1
		eval "${trecho}"
		[[ "$(type -t "${fn}")" == "function" ]] || return 1
	done
}

# Traduzem o desfecho de cada leitor num rótulo comparável. `RECUSOU-MAS-VAZOU`
# existe para que um leitor que reprova mas ainda devolve o pedaço lido não passe
# como se tivesse recusado limpo.
sonda_leitor_do_verificador() {
	local valor codigo=0
	valor="$(ler_credencial_db "$1")" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		if [[ -n "${valor}" ]]; then printf 'RECUSOU-MAS-VAZOU:%s' "${valor}"; else printf 'RECUSA'; fi
	else
		printf 'DEVOLVE:%s' "${valor}"
	fi
}

# Traduz o desfecho de `conferir_coordenadas_do_ambiente` num rótulo comparável.
sonda_coordenadas_do_provisionador() {
	local codigo=0
	conferir_coordenadas_do_ambiente "$1" "$2" || codigo=$?
	case "${codigo}" in
	0) printf 'COERENTE' ;;
	1) printf 'DIVERGE:%s' "${COORDENADAS_DIVERGENTES%%\[*}" ;;
	2) printf 'FALTA:%s' "${CHAVES_AUSENTES}" ;;
	*) printf 'DESFECHO-INESPERADO:%s' "${codigo}" ;;
	esac
}

sonda_leitor_do_provisionador() {
	local codigo=0
	extrair_credencial_db "$1" || codigo=$?
	if [[ "${codigo}" -ne 0 ]]; then
		if [[ -n "${CREDENCIAL_LIDA}" ]]; then
			printf 'RECUSOU-MAS-VAZOU:%s' "${CREDENCIAL_LIDA}"
		else
			printf 'RECUSA'
		fi
	else
		printf 'DEVOLVE:%s' "${CREDENCIAL_LIDA}"
	fi
}

# --------------------------------------------------------------------------- #
# Auditoria do guarda que precede a única operação capaz de reescrever a senha
# do banco.
#
# CAUSA-RAIZ de ser uma função com o caminho por parâmetro: a versão anterior era
# um `awk` solto sobre o arquivo INTEIRO, casando o texto `ALTER ROLE` — que
# aparece cinco vezes, quatro delas em comentário ou mensagem — e declarando
# sucesso ao achar QUALQUER guarda antes de QUALQUER dessas ocorrências. Ela
# continuava verde num script sem guarda algum no caminho perigoso. Agora o
# casamento é ancorado no CORPO de `passo_p09_credencial_valida` e restrito ao
# `printf` que de fato monta o comando.
#
# Imprime o diagnóstico e devolve 0 (guardado) ou 1 (desguardado).
# --------------------------------------------------------------------------- #
auditar_guarda_do_alter_role() {
	local script="$1"
	local corpo linha_guarda linha_alter total_alter

	total_alter="$(grep -cF 'ALTER ROLE \"%s\" WITH PASSWORD' "${script}" || true)"
	if [[ "${total_alter}" -ne 1 ]]; then
		printf 'esperava exatamente 1 comando ALTER ROLE executável no script, e encontrei %s' "${total_alter}"
		return 1
	fi

	corpo="$(sed -n '/^passo_p09_credencial_valida() {/,/^}/p' "${script}")"
	if [[ -z "${corpo}" ]]; then
		printf 'não encontrei o corpo de passo_p09_credencial_valida'
		return 1
	fi

	linha_alter="$(printf '%s\n' "${corpo}" |
		grep -nF 'ALTER ROLE \"%s\" WITH PASSWORD' | head -1 | cut -d: -f1)"
	if [[ -z "${linha_alter}" ]]; then
		printf 'o ALTER ROLE executável está fora de passo_p09_credencial_valida'
		return 1
	fi

	linha_guarda="$(printf '%s\n' "${corpo}" |
		grep -nF '! credencial_manuseavel "${senha_db}"' | head -1 | cut -d: -f1)"
	if [[ -z "${linha_guarda}" ]]; then
		printf 'passo_p09_credencial_valida NÃO afirma credencial_manuseavel antes de reescrever a senha'
		return 1
	fi

	if [[ "${linha_guarda}" -ge "${linha_alter}" ]]; then
		printf 'a afirmação de credencial_manuseavel (linha %s do corpo) não precede o ALTER ROLE (linha %s)' \
			"${linha_guarda}" "${linha_alter}"
		return 1
	fi

	printf 'guarda na linha %s do corpo, ALTER ROLE na linha %s' "${linha_guarda}" "${linha_alter}"
	return 0
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
	# ainda não é rastreado mas é rastreável. Sem `--others` a varredura teria um
	# ponto cego exatamente no caso que mais importa: neste pipeline o `git add`
	# só acontece DEPOIS que os gates aprovam, então os arquivos novos da própria
	# entrega ficariam de fora. `--exclude-standard` mantém o `.gitignore` valendo
	# — é o que impede `node_modules/` e afins de entrarem na lista.
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

exigir_privilegio() {
	if [[ "${EUID}" -ne 0 ]]; then
		printf 'ERRO: esta bateria precisa de privilégio administrativo — ela lê %s, reinicia %s e monta sistema de arquivos temporário.\n' \
			"${ARQ_AMBIENTE}" "${UNIDADE_FILA}" >&2
		printf '      Execute como: sudo bash deploy/scripts/instalacao/verificar-provisionamento.sh\n' >&2
		exit 1
	fi
}

# --------------------------------------------------------------------------- #
# ADR-0006 — recusa de executar contra a instalação que atende a operação.
#
# CAUSA-RAIZ de existir: a conformidade desta bateria com a ADR-0006 estava
# apoiada num fato do calendário — a instalação da fatia ainda não serve
# ninguém — e num parágrafo de cabeçalho que argumentava sobre OUTRO artefato (a
# suíte automatizada, que sobe instâncias efêmeras próprias). Fato de calendário
# vence: a partir da fatia de implantação, `redis-server@sysloc` passa a ser a
# fila que atende a operação, e este mesmo script versionado, com o mesmo nome,
# continuaria disponível e reiniciaria a fila de produção em pleno uso. A
# `Decision` da ADR é a separação, e separação que não é imposta é coincidência.
#
# ESCOLHA — marcador no sistema de arquivos, e não variável de ambiente exigida:
# o sujeito do guarda é a INSTALAÇÃO, não a invocação. Uma propriedade da máquina
# deve estar registrada na máquina, não afirmada por quem digita o comando; a
# ADR diz que "qual ambiente concreto cumpre o papel varia ao longo do tempo", e
# quem sabe disso é o ambiente. Exigir `SYSLOC_FASE=implantacao` transformaria
# toda execução legítima em cerimônia, e cerimônia repetida vira `export` no
# perfil do operador — a proteção evapora justamente por ser usada. O custo
# aceito é que o guarda só passa a valer quando o marcador existir: criá-lo é
# obrigação explícita da fatia de implantação, registrada aqui e na mensagem de
# recusa abaixo.
#
# Recebe o caminho por parâmetro para ser exercitável sem privilégio.
# --------------------------------------------------------------------------- #
instalacao_liberada_para_bateria() {
	[[ ! -e "$1" ]]
}

recusar_bateria_em_producao() {
	instalacao_liberada_para_bateria "${ARQ_MARCADOR_PRODUCAO}" && return 0

	printf 'ERRO: esta instalação está marcada como a que atende a operação (%s existe).\n' \
		"${ARQ_MARCADOR_PRODUCAO}" >&2
	printf '      A ADR-0006 é literal: "a suíte de verificação nunca executa contra o ambiente\n' >&2
	printf '      que atende a operação". Esta bateria REINICIA a instância de fila (CT-004) e\n' >&2
	printf '      REEXECUTA o provisionamento (CT-002 e CT-003); contra uma instalação em produção\n' >&2
	printf '      isso é indisponibilidade, não verificação.\n' >&2
	printf '      O QUE FAZER: reconstrua a instalação num ambiente separado a partir deste\n' >&2
	printf '      repositório — `provisionar-base.sh` é idempotente e reconstrutível por desenho —\n' >&2
	printf '      e rode a bateria lá. Conferir a instalação de produção sem alterá-la é outra\n' >&2
	printf '      ferramenta, que ainda não existe.\n' >&2
	exit 1
}

# =========================================================================== #
# Subcomando `retrato` — captura o estado do sistema num diretório.
#
# A mesma função é usada nos três momentos. O que ela captura é exatamente o que
# o CT-001 e o CT-005 comparam.
# =========================================================================== #
capturar_retrato() {
	local dir="$1"
	install -d -m 0700 "${dir}"

	dpkg-query -W -f='${binary:Package} ${Version}\n' 2>/dev/null | sort >"${dir}/pacotes.txt"

	systemctl list-unit-files --no-pager --no-legend 2>/dev/null |
		awk 'NF >= 2 { print $1, $2 }' | sort >"${dir}/unidades.txt"

	# `running`, e não `active`: unidades de disparo único terminam em `exited` e
	# aparecem ou não conforme o instante da captura (o próprio `apt` dispara
	# algumas). Compará-las reprovaria por ruído, não por dano. A regressão que
	# elas poderiam esconder — passar a `failed` — é coberta pela captura abaixo.
	systemctl list-units --type=service --state=running --no-pager --no-legend --plain 2>/dev/null |
		awk 'NF >= 1 { print $1 }' | sort -u >"${dir}/unidades-ativas.txt"

	systemctl list-units --state=failed --no-pager --no-legend --plain 2>/dev/null |
		awk 'NF >= 1 { print $1 }' | sort -u >"${dir}/unidades-falhas.txt"

	ss -ltnpH 2>/dev/null |
		awk '{
			n = split($4, a, ":");
			porta = a[n];
			proc = "(sem-dono)";
			if (NF >= 6 && match($6, /"[^"]+"/)) {
				proc = substr($6, RSTART + 1, RLENGTH - 2);
			}
			print porta "\t" proc;
		}' | sort -u >"${dir}/portas.txt"

	df -BM --output=avail / | tail -n 1 | tr -dc '0-9' >"${dir}/disco-mib.txt"

	soma_ou_ausente "${ARQ_AMBIENTE}" >"${dir}/env-sha256.txt"

	local arquivo
	: >"${dir}/config-sha256.txt"
	for arquivo in "${ARQUIVOS_CONFIGURACAO[@]}"; do
		printf '%s %s\n' "${arquivo}" "$(soma_ou_ausente "${arquivo}")" >>"${dir}/config-sha256.txt"
	done

	local unidade caminho
	: >"${dir}/unidades-sha256.txt"
	while IFS= read -r unidade; do
		[[ -n "${unidade}" ]] || continue
		caminho="$(systemctl show -p FragmentPath --value "${unidade}" 2>/dev/null || true)"
		printf '%s %s\n' "${unidade}" "$(soma_ou_ausente "${caminho}")" >>"${dir}/unidades-sha256.txt"
	done <"${dir}/unidades-ativas.txt"

	: >"${dir}/habilitados.txt"
	local servico
	for servico in "${SERVICOS_ARRANQUE[@]}"; do
		printf '%s=%s\n' "${servico}" "$(systemctl is-enabled "${servico}" 2>/dev/null || printf 'AUSENTE')" \
			>>"${dir}/habilitados.txt"
	done

	if command -v psql >/dev/null 2>&1 && getent passwd postgres >/dev/null 2>&1; then
		printf 'papel=%s\n' "$(runuser -u postgres -- psql -X -q -A -t \
			-c "SELECT count(*) FROM pg_roles WHERE rolname = '${PAPEL_DB}'" 2>/dev/null || printf 'INDISPONIVEL')" \
			>"${dir}/postgres.txt"
		printf 'banco=%s\n' "$(runuser -u postgres -- psql -X -q -A -t \
			-c "SELECT count(*) FROM pg_database WHERE datname = '${BANCO_DB}'" 2>/dev/null || printf 'INDISPONIVEL')" \
			>>"${dir}/postgres.txt"
	else
		printf 'papel=INDISPONIVEL\nbanco=INDISPONIVEL\n' >"${dir}/postgres.txt"
	fi

	printf 'retrato capturado em %s\n' "${dir}"
}

exigir_retratos() {
	local faltando=() alvo
	for alvo in retrato-pre retrato-pos1 retrato-pos2; do
		[[ -d "${DIR_EVIDENCIA}/${alvo}" ]] || faltando+=("${alvo}/")
	done
	for alvo in execucao-1.log execucao-1.codigo execucao-2.log execucao-2.codigo; do
		[[ -f "${DIR_EVIDENCIA}/${alvo}" ]] || faltando+=("${alvo}")
	done

	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: evidência incompleta em %s — não encontrado: %s\n' \
			"${DIR_EVIDENCIA}" "${faltando[*]}" >&2
		printf '      Os CT-001 e CT-005 comparam o sistema ANTES e DEPOIS do provisionamento; esses\n' >&2
		printf '      retratos não podem ser reconstruídos depois. Rode o roteiro de execução assistida\n' >&2
		printf '      da task T2 (captura o retrato, executa o provisionamento duas vezes, captura de novo)\n' >&2
		printf '      e só então esta bateria. O subcomando de captura é:\n' >&2
		printf '        sudo bash %s retrato %s/retrato-pre\n' "${BASH_SOURCE[0]}" "${DIR_EVIDENCIA}" >&2
		exit 1
	fi
}

# =========================================================================== #
# CT-001 — Provisionamento executado duas vezes seguidas termina com sucesso e
#          sem efeito adicional.
#
# A asserção sobre a soma SHA-256 do arquivo de ambiente é o coração do caso: o
# modo de falha mais provável de um provisionamento "idempotente" é regerar a
# credencial a cada execução — passa nos dois códigos de saída 0 e quebra, na
# reinstalação seguinte, as unidades de serviço que a consomem.
# =========================================================================== #
ct_001() {
	caso "CT-001" "Provisionamento executado duas vezes seguidas sai 0 nas duas e não altera nada na segunda"

	local pos1="${DIR_EVIDENCIA}/retrato-pos1"
	local pos2="${DIR_EVIDENCIA}/retrato-pos2"
	local log1="${DIR_EVIDENCIA}/execucao-1.log"
	local log2="${DIR_EVIDENCIA}/execucao-2.log"

	afirmar_igual "código de saída da 1ª execução" "0" \
		"$(tr -dc '0-9' <"${DIR_EVIDENCIA}/execucao-1.codigo")"
	afirmar_igual "código de saída da 2ª execução" "0" \
		"$(tr -dc '0-9' <"${DIR_EVIDENCIA}/execucao-2.codigo")"

	# --- o arquivo de ambiente é byte a byte o mesmo ------------------------- #
	local env1 env2
	env1="$(cat "${pos1}/env-sha256.txt")"
	env2="$(cat "${pos2}/env-sha256.txt")"
	afirmar_diferente "o arquivo de ambiente existe após a 1ª execução" "AUSENTE" "${env1}"
	afirmar_igual "a credencial NÃO foi regerada (SHA-256 do arquivo de ambiente inalterado)" \
		"${env1}" "${env2}"

	# --- exatamente um papel e um banco, nos dois momentos ------------------- #
	afirmar_igual "após a 1ª execução há exatamente 1 papel '${PAPEL_DB}'" "papel=1" \
		"$(grep '^papel=' "${pos1}/postgres.txt")"
	afirmar_igual "após a 2ª execução há exatamente 1 papel '${PAPEL_DB}'" "papel=1" \
		"$(grep '^papel=' "${pos2}/postgres.txt")"
	afirmar_igual "após a 1ª execução há exatamente 1 banco '${BANCO_DB}'" "banco=1" \
		"$(grep '^banco=' "${pos1}/postgres.txt")"
	afirmar_igual "após a 2ª execução há exatamente 1 banco '${BANCO_DB}'" "banco=1" \
		"$(grep '^banco=' "${pos2}/postgres.txt")"

	# --- arquivos de configuração inalterados -------------------------------- #
	local linha arquivo soma1 soma2
	while IFS= read -r linha; do
		arquivo="${linha%% *}"
		soma1="${linha##* }"
		soma2="$(awk -v a="${arquivo}" '$1 == a { print $2 }' "${pos2}/config-sha256.txt")"
		afirmar_diferente "configuração gerida presente após a 1ª execução: ${arquivo}" "AUSENTE" "${soma1}"
		afirmar_igual "SHA-256 inalterado entre as duas execuções: ${arquivo}" "${soma1}" "${soma2}"
	done <"${pos1}/config-sha256.txt"

	# --- os três serviços habilitados no arranque, nos dois momentos --------- #
	local servico
	for servico in "${SERVICOS_ARRANQUE[@]}"; do
		afirmar_igual "após a 1ª execução, ${servico} habilitado no arranque" "${servico}=enabled" \
			"$(grep -F "${servico}=" "${pos1}/habilitados.txt")"
		afirmar_igual "após a 2ª execução, ${servico} habilitado no arranque" "${servico}=enabled" \
			"$(grep -F "${servico}=" "${pos2}/habilitados.txt")"
	done

	# --- a 2ª execução é auditável ------------------------------------------- #
	afirmar_igual "a 2ª execução não tem NENHUMA linha de criação/alteração" "0" \
		"$(grep -cE '^\[provisionar\] CRIADO ' "${log2}" || true)"

	# O conjunto de passos é DERIVADO da saída da 1ª execução, nunca de lista
	# escrita à mão — assim o caso não envelhece quando o provisionamento ganhar
	# ou perder um passo.
	local passos_1 passos_2
	passos_1="$(grep -oE '^\[provisionar\] (CRIADO|JA-OK) +P[0-9]+' "${log1}" |
		grep -oE 'P[0-9]+' | sort -u | tr '\n' ' ')"
	passos_2="$(grep -oE '^\[provisionar\] JA-OK +P[0-9]+' "${log2}" |
		grep -oE 'P[0-9]+' | sort -u | tr '\n' ' ')"

	afirmar_diferente "a 1ª execução reportou ao menos um passo identificado" "" "${passos_1// /}"
	afirmar_igual "cada passo da 1ª execução aparece como 'já correto' na 2ª" "${passos_1}" "${passos_2}"
	nota "passos observados: ${passos_1}"

	fechar_caso "CT-001"
}

# =========================================================================== #
# CT-002 — Espaço em disco insuficiente aborta o provisionamento antes de
#          instalar qualquer coisa.
#
# O destino de medição é apontado pelo MESMO parâmetro que a operação usa
# (SYSLOC_DESTINO_DISCO). Nenhuma bandeira, variável ou desvio existe no script
# de provisionamento só para este caso — o que desligaria em produção justamente
# o guarda que o caso prova.
# =========================================================================== #
ct_002() {
	caso "CT-002" "Espaço em disco insuficiente aborta o provisionamento antes de instalar qualquer coisa"

	local antes="${DIR_TEMPORARIO}/ct002-antes"
	local depois="${DIR_TEMPORARIO}/ct002-depois"
	local saida="${DIR_TEMPORARIO}/ct002-saida.txt"

	capturar_retrato "${antes}" >/dev/null

	DIR_TMPFS="$(mktemp -d -t sysloc-ct002-XXXXXXXX)"
	if ! mount -t tmpfs -o size=8M,nosuid,nodev tmpfs "${DIR_TMPFS}"; then
		falhar "não foi possível montar o sistema de arquivos pequeno em ${DIR_TMPFS} — o caso não tem como provocar a falta de espaço"
		fechar_caso "CT-002"
		return
	fi

	# Medição independente do mesmo sistema de arquivos, para confrontar com o que
	# o script reportar: prova que ele mediu o destino apontado, e não `/`.
	local disponivel_real
	disponivel_real="$(df -BM --output=avail "${DIR_TMPFS}" | tail -n 1 | tr -dc '0-9')"

	local codigo=0
	SYSLOC_DESTINO_DISCO="${DIR_TMPFS}" bash "${SCRIPT_PROVISIONAR}" >"${saida}" 2>&1 || codigo=$?

	afirmar_diferente "o provisionamento sai com código != 0" "0" "${codigo}"

	# Três números identificáveis, em MiB — "sem espaço em disco" sem
	# quantificação não permite decidir o que apagar.
	local requerido disponivel deficit
	requerido="$(grep -oE 'requerido=[0-9]+ MiB' "${saida}" | head -1 | tr -dc '0-9')"
	disponivel="$(grep -oE 'disponivel=[0-9]+ MiB' "${saida}" | head -1 | tr -dc '0-9')"
	deficit="$(grep -oE 'deficit=[0-9]+ MiB' "${saida}" | head -1 | tr -dc '0-9')"

	afirmar_diferente "a mensagem traz o valor requerido em MiB" "" "${requerido}"
	afirmar_diferente "a mensagem traz o valor disponível em MiB" "" "${disponivel}"
	afirmar_diferente "a mensagem traz o déficit em MiB" "" "${deficit}"

	if [[ -n "${requerido}" && -n "${disponivel}" && -n "${deficit}" ]]; then
		afirmar_igual "o déficit informado é requerido menos disponível" \
			"$((requerido - disponivel))" "${deficit}"
		afirmar_igual "o disponível relatado é o do sistema de arquivos apontado, medido de forma independente" \
			"${disponivel_real}" "${disponivel}"
	fi

	umount "${DIR_TMPFS}"
	rmdir "${DIR_TMPFS}"
	DIR_TMPFS=""

	capturar_retrato "${depois}" >/dev/null

	# --- nenhum efeito colateral --------------------------------------------- #
	afirmar_igual "nenhum pacote novo foi instalado" "0" \
		"$(comm -13 "${antes}/pacotes.txt" "${depois}/pacotes.txt" | grep -c . || true)"
	afirmar_igual "nenhuma unidade nova foi registrada" "0" \
		"$(comm -13 "${antes}/unidades.txt" "${depois}/unidades.txt" | grep -c . || true)"
	afirmar_igual "o arquivo de ambiente não foi tocado (SHA-256 idêntico)" \
		"$(cat "${antes}/env-sha256.txt")" "$(cat "${depois}/env-sha256.txt")"
	afirmar_igual "nenhum papel ou banco novo apareceu" \
		"$(cat "${antes}/postgres.txt")" "$(cat "${depois}/postgres.txt")"

	fechar_caso "CT-002"
}

# =========================================================================== #
# CT-003 — A credencial gerada não aparece na árvore versionada, em argumento de
#          processo nem em log.
# =========================================================================== #
ct_003() {
	caso "CT-003" "A credencial não aparece na árvore versionada, em argv de processo filho nem em log"

	# (a) modo e dono do arquivo de ambiente ---------------------------------- #
	if [[ ! -f "${ARQ_AMBIENTE}" ]]; then
		falhar "o arquivo de ambiente ${ARQ_AMBIENTE} não existe — as demais asserções ficariam sem objeto"
		fechar_caso "CT-003"
		return
	fi
	afirmar_igual "(a) modo e dono do arquivo de ambiente" "600 ${DONO_ARQ_AMBIENTE}" \
		"$(stat -c '%a %U' "${ARQ_AMBIENTE}")"

	# (b) o caminho está fora da árvore versionada POR CONSTRUÇÃO ------------- #
	afirmar_igual "(b) o caminho do arquivo de ambiente não é prefixado pela raiz do repositório" "1" \
		"$([[ "${ARQ_AMBIENTE}" != "${RAIZ_REPO}"/* ]] && echo 1 || echo 0)"
	nota "raiz do repositório: ${RAIZ_REPO}"

	local credencial
	if ! credencial="$(ler_credencial_db "${ARQ_AMBIENTE}")"; then
		falhar "não foi possível ler uma credencial íntegra de ${ARQ_AMBIENTE} — ausente, ilegível, ou com caractere fora de [A-Za-z0-9]; o caso não tem agulha confiável para procurar"
		fechar_caso "CT-003"
		return
	fi

	# (c) a árvore versionada não carrega a credencial ------------------------ #
	local achados codigo=0
	achados="$(printf '%s\n' "${credencial}" | varrer_arvore_versionada "${RAIZ_REPO}")" || codigo=$?
	afirmar_igual "(c) a varredura da árvore versionada não encontra a credencial" "0" "${codigo}"
	if [[ -n "${achados}" ]]; then
		falhar "(c) ocorrências na árvore versionada: ${achados}"
	fi

	# (d) e (e) auditoria estática do script de provisionamento --------------- #
	afirmar_igual "(d) o script não liga rastreio verboso de comandos do shell" "0" \
		"$(grep -cE 'set[[:space:]]+-x' "${SCRIPT_PROVISIONAR}" || true)"
	# O sufixo `[= ]` fica DENTRO de cada alternativa. Na forma herdada do card
	# — `(--password|PGPASSWORD=|--dbpassword)[= ]` — ele se aplicava ao grupo
	# inteiro, de modo que o ramo `PGPASSWORD=` só casaria com `PGPASSWORD==` ou
	# com `PGPASSWORD=` seguido de espaço, e nunca com o uso real
	# `PGPASSWORD=<valor> psql …`, que é justamente a forma mais provável de
	# vazamento. O ramo estava morto. O card do CT-003 (§5.6 da task) foi
	# atualizado junto, para a asserção e o teste continuarem literalmente iguais.
	afirmar_igual "(e) o script não passa segredo por argumento de linha de comando nem por variável de ambiente" "0" \
		"$(grep -cE -- '(--password[= ]|--dbpassword[= ]|PGPASSWORD=)' "${SCRIPT_PROVISIONAR}" || true)"

	# (f) a saída preservada das duas execuções não carrega a credencial ------ #
	afirmar_igual "(f) a credencial não aparece na saída preservada das duas execuções" "0" \
		"$(printf '%s\n' "${credencial}" | contar_ocorrencias \
			"${DIR_EVIDENCIA}/execucao-1.log" "${DIR_EVIDENCIA}/execucao-2.log")"

	# (g) prova dinâmica: nenhum argv de processo filho carrega a credencial --- #
	if command -v strace >/dev/null 2>&1; then
		local rastreio="${DIR_TEMPORARIO}/execve.txt"
		local saida_rastreada="${DIR_TEMPORARIO}/execucao-rastreada.log"
		local codigo_rastreado=0
		strace -f -e trace=execve -o "${rastreio}" \
			bash "${SCRIPT_PROVISIONAR}" >"${saida_rastreada}" 2>&1 || codigo_rastreado=$?

		# Sem estas duas afirmações, uma execução que abortasse cedo (guarda de
		# disco, rede fora, ferramenta ausente) registraria pouquíssimos `execve`,
		# a contagem daria 0 e a asserção passaria sem ter provado nada — e esta é
		# a ÚNICA prova dinâmica do caso.
		afirmar_igual "(g) a execução rastreada concluiu com sucesso (senão não há argv a inspecionar)" \
			"0" "${codigo_rastreado}"
		if [[ "${codigo_rastreado}" -ne 0 ]]; then
			# Só as linhas de erro do próprio script, que por desenho não carregam
			# a credencial — a asserção (f) prova essa propriedade sobre a mesma
			# classe de saída.
			nota "(g) última linha de erro da execução rastreada: $(grep -E '^\[provisionar\] (ERRO|O QUE FAZER):' "${saida_rastreada}" | tail -1)"
		fi

		local execves
		execves="$(grep -c 'execve(' "${rastreio}" || true)"
		afirmar_igual "(g) o rastreio registrou chamadas execve suficientes para a inspeção ter objeto (>= ${MINIMO_EXECVE})" "1" \
			"$([[ "${execves}" -ge "${MINIMO_EXECVE}" ]] && echo 1 || echo 0)"
		nota "(g) chamadas execve registradas: ${execves}"

		afirmar_igual "(g) nenhum argv registrado por execve contém a credencial" "0" \
			"$(printf '%s\n' "${credencial}" | contar_ocorrencias "${rastreio}")"
	else
		aviso "(g) strace ausente no PATH — asserção dinâmica de argv PULADA (degradação declarada)"
		aviso "    instale 'strace' e execute a bateria de novo para cobrir esta asserção"
	fi

	# (h) prova de que a varredura não é oca ---------------------------------- #
	# Sem isto, uma varredura com expressão errada devolveria 0 ocorrências para
	# sempre e ninguém perceberia (asserção infalível).
	# A agulha aqui é SINTÉTICA, e isso é a correção de um defeito de segurança,
	# não uma simplificação. A propriedade que (h) prova é do MECANISMO — que a
	# varredura acha o que existe e omite o valor da saída —, jamais do segredo.
	# Usar a credencial viva fazia o instrumento de prova cometer exatamente o que
	# o invariante deste caso proíbe: `grep -cF "${credencial}"` a colocava no
	# argv de um processo filho, legível em /proc/<pid>/cmdline por qualquer
	# usuário desta máquina, que é compartilhada com a pilha pública do legado. E
	# a plantava em texto claro em DOIS lugares do disco (o arquivo de trabalho e
	# o blob do índice do clone), cuja remoção não sobrevive a SIGKILL — nenhum
	# trap cobre esse sinal. Com a agulha sintética, a credencial real não sai de
	# ${ARQ_AMBIENTE}: as duas exposições somem de uma vez.
	local agulha_sintetica="AGULHASINTETICADOCT003H"
	local clone="${DIR_TEMPORARIO}/clone-com-agulha-plantada"
	git -c "safe.directory=${RAIZ_REPO}" clone --no-hardlinks --quiet "${RAIZ_REPO}" "${clone}"
	printf 'AGULHA_PLANTADA_PELO_CT_003=%s\n' "${agulha_sintetica}" >"${clone}/plantado-pelo-ct-003.txt"
	git_em "${clone}" add plantado-pelo-ct-003.txt

	local achados_plantados codigo_plantado=0
	achados_plantados="$(printf '%s\n' "${agulha_sintetica}" | varrer_arvore_versionada "${clone}")" || codigo_plantado=$?

	afirmar_diferente "(h) com a agulha plantada, a varredura sai != 0" "0" "${codigo_plantado}"
	afirmar_igual "(h) a varredura acusa a ocorrência no formato arquivo:linha" "1" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cxF 'plantado-pelo-ct-003.txt:1' || true)"
	afirmar_igual "(h) a varredura NÃO imprime o valor encontrado" "0" \
		"$(printf '%s\n' "${achados_plantados}" | grep -cF "${agulha_sintetica}" || true)"

	rm -rf "${clone}"
	unset credencial

	# (i), (j) e (k) — guarda de regressão dos defeitos de leitura da credencial #
	#
	# O defeito nunca esteve na varredura: está na LEITURA. Duas formas dele já
	# apareceram, e cada uma tem aqui a sua linha da tabela:
	#
	#   (i)  a extração validava o alfabeto dentro da própria expressão
	#        (`\([A-Za-z0-9]*\)`); classe quantificada numa substituição não
	#        falha, trunca — e o prefixo não-vazio driblava o guarda de formato e
	#        chegava ao passo que reescreve a senha do banco;
	#   (k)  a extração fechava com `head -1`, RESOLVENDO a ambiguidade de uma
	#        chave atribuída duas vezes — e resolvendo para o lado oposto ao do
	#        `EnvironmentFile=` do systemd, que usa a última atribuição.
	#
	# A tabela roda contra os DOIS leitores: o do provisionamento, carregado do
	# arquivo real (é ele quem reescreve a senha do banco), e o deste verificador
	# (é ele quem escolhe a agulha de (c), (f) e (g)). Sem o primeiro, a bateria
	# aprovava um provisionamento com o defeito de volta — foi o que aconteceu.
	local dir_sonda="${DIR_TEMPORARIO}/sonda-leitor"
	install -d -m 0700 "${dir_sonda}"
	local arq_sonda="${dir_sonda}/env"

	if carregar_funcoes_do_provisionador "${SCRIPT_PROVISIONAR}"; then
		ok "funções do provisionamento carregadas de ${SCRIPT_PROVISIONAR##*/} (credencial_manuseavel + extrair_credencial_db + conferir_coordenadas_do_ambiente)"
	else
		falhar "não consegui carregar credencial_manuseavel/extrair_credencial_db/conferir_coordenadas_do_ambiente de ${SCRIPT_PROVISIONAR} — sem elas as tabelas (i)/(j)/(k)/(l) não teriam SUT e passariam vazias"
		rm -rf "${dir_sonda}"
		fechar_caso "CT-003"
		return
	fi

	# Aplica o mesmo cenário aos dois leitores e exige o MESMO desfecho literal.
	sondar_os_dois_leitores() {
		local rotulo="$1" arquivo="$2" esperado="$3"
		afirmar_igual "${rotulo} — leitor do provisionamento" \
			"${esperado}" "$(sonda_leitor_do_provisionador "${arquivo}")"
		afirmar_igual "${rotulo} — leitor do verificador" \
			"${esperado}" "$(sonda_leitor_do_verificador "${arquivo}")"
	}

	# Os valores abaixo são rótulos autodescritivos, não segredos: nunca são
	# aplicados a banco nenhum e vivem num diretório temporário 0700 removido no
	# fim do caso.
	local simbolo
	# Um caso por caractere que a URL usa como delimitador, mais dois que
	# exigiriam codificação percentual. Cada um cortaria a extração truncante num
	# ponto diferente — inclusive o '@', que o `[^@]*` sugerido também cortaria.
	for simbolo in '@' ':' '/' '?' '&' '#' '%'; do
		printf 'DATABASE_URL=postgresql://%s:VALORSINTETICO%sDOCT003@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\n' \
			"${PAPEL_DB}" "${simbolo}" "${BANCO_DB}" "${PORTA_FILA}" >"${arq_sonda}"
		sondar_os_dois_leitores \
			"(i) credencial contendo '${simbolo}' é recusada, sem devolver prefixo" \
			"${arq_sonda}" "RECUSA"
	done

	# (j) o companheiro positivo. Sem ele, (i) passaria com um leitor que
	# recusasse tudo — e o provisionamento nunca conseguiria reaproveitar o
	# arquivo de ambiente existente.
	local valor_ok="VALORSINTETICOALFANUMERICO123DOCT003"
	printf 'DATABASE_URL=postgresql://%s:%s@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\nSMTP_URL=smtp://127.0.0.1:%s\n' \
		"${PAPEL_DB}" "${valor_ok}" "${BANCO_DB}" "${PORTA_FILA}" "${PORTA_SMTP_CAPTURADOR}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(j) credencial alfanumérica é devolvida ÍNTEGRA, sem truncar" \
		"${arq_sonda}" "DEVOLVE:${valor_ok}"

	# (k) atribuição repetida. O valor obsoleto é ALFANUMÉRICO de propósito: ele
	# atravessa o guarda de alfabeto, então só a recusa da ambiguidade o barra.
	printf 'DATABASE_URL=postgresql://%s:SENHASINTETICAVELHA111@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\nDATABASE_URL=postgresql://%s:SENHASINTETICANOVA999@/%s?host=/var/run/postgresql&port=5432\n' \
		"${PAPEL_DB}" "${BANCO_DB}" "${PORTA_FILA}" "${PAPEL_DB}" "${BANCO_DB}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(k) arquivo com DATABASE_URL atribuída duas vezes é recusado (ambiguidade)" \
		"${arq_sonda}" "RECUSA"

	# A mesma causa alcança as outras chaves do arquivo, porque o formato é o
	# mesmo — por isso a recusa é genérica e não específica de DATABASE_URL.
	printf 'DATABASE_URL=postgresql://%s:%s@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\nREDIS_URL=redis://127.0.0.1:9999\n' \
		"${PAPEL_DB}" "${valor_ok}" "${BANCO_DB}" "${PORTA_FILA}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(k) arquivo com REDIS_URL atribuída duas vezes é recusado (mesma causa)" \
		"${arq_sonda}" "RECUSA"

	printf 'REDIS_URL=redis://127.0.0.1:%s\n' "${PORTA_FILA}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(k) arquivo sem DATABASE_URL é recusado" "${arq_sonda}" "RECUSA"

	# (l) COORDENADAS. O caso de maior dano da tabela e o único que não é sobre a
	# credencial: um arquivo perfeitamente bem formado, com credencial íntegra,
	# apontando `REDIS_URL` para a porta 6379 — a instância do AMBIENTE LEGADO.
	# Ele atravessava toda a validação anterior sem ruído, e a partir da fatia que
	# enfileira trabalho de negócio colocaria a fila do backend novo dentro do
	# processo que atende a operação hoje.
	local porta_pg_sonda="5432"
	# Monta um arquivo de ambiente sintético. Argumento vazio significa "chave
	# ausente". A forma `[[ -z ... ]] || cmd` é deliberada: `[[ -n ... ]] && cmd`
	# devolveria 1 quando o argumento fosse vazio e derrubaria o script sob `set -e`.
	ambiente_completo() { # $1 destino de DATABASE_URL  $2 REDIS_URL  $3 SMTP_URL
		: >"${arq_sonda}"
		[[ -z "$1" ]] || printf 'DATABASE_URL=postgresql://%s:%s@%s\n' "${PAPEL_DB}" "${valor_ok}" "$1" >>"${arq_sonda}"
		[[ -z "$2" ]] || printf 'REDIS_URL=%s\n' "$2" >>"${arq_sonda}"
		[[ -z "$3" ]] || printf 'SMTP_URL=%s\n' "$3" >>"${arq_sonda}"
	}
	local destino_ok="/${BANCO_DB}?host=${DIR_SOCKET_PG}&port=${porta_pg_sonda}"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) arquivo com as três chaves nas coordenadas provisionadas é aceito sem alteração" \
		"COERENTE" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:6379" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) REDIS_URL apontando para a instância do ambiente legado (6379) é RECUSADO" \
		"DIVERGE:REDIS_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "/${BANCO_DB}?host=${DIR_SOCKET_PG}&port=5433" "redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) DATABASE_URL com porta de cluster divergente da viva é RECUSADO" \
		"DIVERGE:DATABASE_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:2525"
	afirmar_igual "(l) SMTP_URL em porta divergente é RECUSADO" \
		"DIVERGE:SMTP_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:${PORTA_FILA}" ""
	afirmar_igual "(l) SMTP_URL ausente é reportada como chave a acrescentar, não como divergência" \
		"FALTA:SMTP_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "${destino_ok}" "" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) REDIS_URL ausente é reportada como chave a acrescentar" \
		"FALTA:REDIS_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	# A entrada que DISCRIMINA a precedência entre os dois desfechos, e a única
	# do bloco capaz disso.
	#
	# CAUSA-RAIZ de faltar: as seis entradas acima nasceram dos RAMOS da função —
	# uma por saída possível —, e por isso cada uma ativa um ramo só: as três de
	# divergência têm as três chaves presentes, as duas de ausência têm todo o
	# resto coerente. Precedência não é um ramo, é a escolha ENTRE ramos, e só se
	# manifesta quando os dois estão ativos ao mesmo tempo. Cobrindo cada ramo
	# isoladamente eu cobria todas as saídas e nenhuma parte da regra que as
	# ordena — trocar a ordem dos dois `if` finais do provisionamento não
	# reprovava nada.
	#
	# O cenário é o de pior dano possível: `REDIS_URL` apontando para a fila do
	# AMBIENTE LEGADO e `SMTP_URL` ausente. Com a ordem correta o provisionamento
	# ABORTA; com a ordem trocada ele acrescentaria a chave que falta, reportaria
	# `CRIADO` como sucesso e deixaria a fila apontada para o legado — consertaria
	# o detalhe e manteria o dano.
	ambiente_completo "${destino_ok}" "redis://127.0.0.1:6379" ""
	afirmar_igual "(l) com divergência E ausência ao mesmo tempo, a divergência tem precedência" \
		"DIVERGE:REDIS_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	unset -f ambiente_completo

	# O guarda que precede a única operação capaz de reescrever a senha do banco.
	# Ancorado no CORPO do passo e no comando executável — ver o cabeçalho de
	# `auditar_guarda_do_alter_role` para o que a versão anterior deixava passar.
	local diagnostico_guarda codigo_guarda=0
	diagnostico_guarda="$(auditar_guarda_do_alter_role "${SCRIPT_PROVISIONAR}")" || codigo_guarda=$?
	afirmar_igual "o P09 afirma credencial_manuseavel antes do ALTER ROLE que reescreve a senha" \
		"0" "${codigo_guarda}"
	nota "auditoria do guarda: ${diagnostico_guarda}"

	afirmar_igual "o provisionamento declara o invariante de formato da credencial num lugar só" "1" \
		"$(grep -cE '^credencial_manuseavel\(\) \{' "${SCRIPT_PROVISIONAR}" || true)"

	unset -f sondar_os_dois_leitores
	rm -rf "${dir_sonda}"

	fechar_caso "CT-003"
}

# =========================================================================== #
# CT-004 — Tarefa gravada na fila sobrevive à parada e ao retorno do servidor de
#          fila.
#
# A asserção de configuração sozinha (`appendonly` = `yes`) seria insuficiente:
# ela prova o que o arquivo declara, não o que o processo faz. Daí o reinício
# real entre a escrita e a leitura.
# =========================================================================== #
ct_004() {
	caso "CT-004" "Tarefa gravada na fila sobrevive à parada e ao retorno do servidor de fila"

	if ! command -v redis-cli >/dev/null 2>&1; then
		falhar "redis-cli ausente do PATH — sem ele não há como falar com a instância de fila"
		fechar_caso "CT-004"
		return
	fi

	# --- o alvo é a instância PROVISIONADA, e não outra ---------------------- #
	# Esta conferência precede o reinício de propósito: reiniciar a instância
	# errada atingiria o `redis-server` de sistema, do ambiente legado.
	afirmar_igual "o script de provisionamento declara a porta ${PORTA_FILA} para a instância própria" "1" \
		"$(grep -cxF "readonly PORTA_FILA=${PORTA_FILA}" "${SCRIPT_PROVISIONAR}" || true)"
	afirmar_igual "o script de provisionamento declara ${DIR_FILA_DADOS} como diretório de dados" "1" \
		"$(grep -cxF "readonly DIR_FILA_DADOS=\"${DIR_FILA_DADOS}\"" "${SCRIPT_PROVISIONAR}" || true)"

	local arquivo_conf diretorio_dados
	arquivo_conf="$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" info server 2>/dev/null |
		sed -n 's/^config_file:\(.*\)$/\1/p' | tr -d '\r')"
	diretorio_dados="$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" config get dir 2>/dev/null |
		tail -n 1 | tr -d '\r')"

	afirmar_igual "a instância na porta ${PORTA_FILA} usa o arquivo de configuração provisionado" \
		"${ARQ_FILA_CONF}" "${arquivo_conf}"
	afirmar_igual "a instância na porta ${PORTA_FILA} usa o diretório de dados provisionado" \
		"${DIR_FILA_DADOS}" "${diretorio_dados}"

	if [[ "${arquivo_conf}" != "${ARQ_FILA_CONF}" || "${diretorio_dados}" != "${DIR_FILA_DADOS}" ]]; then
		falhar "o alvo na porta ${PORTA_FILA} não é a instância provisionada — o caso NÃO reinicia nada"
		fechar_caso "CT-004"
		return
	fi

	# --- persistência em disco declarada ------------------------------------- #
	afirmar_igual "a persistência em disco (append-only) está ligada" "yes" \
		"$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" config get appendonly 2>/dev/null | tail -n 1 | tr -d '\r')"

	# --- grava a chave de prova ---------------------------------------------- #
	CHAVE_PROVA="sysloc:prova-persistencia:$$"
	local valor_gravado
	valor_gravado="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"

	afirmar_igual "a chave de prova foi gravada" "OK" \
		"$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" set "${CHAVE_PROVA}" "${valor_gravado}" 2>/dev/null | tr -d '\r')"

	# --- reinicia e espera pelo estado observável ---------------------------- #
	nota "reiniciando ${UNIDADE_FILA}"
	systemctl restart "${UNIDADE_FILA}"

	local decorrido=0
	while [[ "$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" ping 2>/dev/null | tr -d '\r')" != "PONG" ]]; do
		if [[ "${decorrido}" -ge "${LIMITE_FILA_RESPONDER}" ]]; then
			falhar "a instância de fila não voltou a responder em ${LIMITE_FILA_RESPONDER}s após o reinício"
			fechar_caso "CT-004"
			return
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done
	ok "a instância de fila voltou a responder em ${decorrido}s (limite ${LIMITE_FILA_RESPONDER}s, por sondagem)"

	# --- lê de volta ---------------------------------------------------------- #
	# Ausência e divergência reprovam com mensagens distintas: são diagnósticos
	# diferentes e não podem cair na mesma linha.
	local existe valor_lido
	existe="$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" exists "${CHAVE_PROVA}" 2>/dev/null | tr -d '\r')"
	if [[ "${existe}" != "1" ]]; then
		falhar "a chave de prova DESAPARECEU no reinício — a persistência em disco está desligada ou não foi sincronizada antes do encerramento"
	else
		valor_lido="$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" get "${CHAVE_PROVA}" 2>/dev/null | tr -d '\r')"
		if [[ "${valor_lido}" != "${valor_gravado}" ]]; then
			falhar "a chave de prova sobreviveu mas com VALOR DIVERGENTE — indício de corrupção do arquivo de persistência (esperado [${valor_gravado}], obtido [${valor_lido}])"
		else
			ok "a chave de prova atravessou o reinício com o mesmo valor"
		fi
	fi

	# --- o arquivo de persistência existe em disco ---------------------------- #
	afirmar_igual "existe ao menos um arquivo de persistência (.aof) com tamanho > 0 em ${DIR_FILA_DADOS}" "1" \
		"$([[ "$(find "${DIR_FILA_DADOS}" -type f -name '*.aof' -size +0c 2>/dev/null | grep -c . || true)" -ge 1 ]] && echo 1 || echo 0)"

	# --- a chave de prova não permanece na instância -------------------------- #
	redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" del "${CHAVE_PROVA}" >/dev/null 2>&1 || true
	afirmar_igual "a chave de prova foi removida ao fim do caso" "0" \
		"$(redis-cli -h 127.0.0.1 -p "${PORTA_FILA}" exists "${CHAVE_PROVA}" 2>/dev/null | tr -d '\r')"
	CHAVE_PROVA=""

	fechar_caso "CT-004"
}

# =========================================================================== #
# CT-005 — Provisionamento não altera o ambiente legado nem colide com suas
#          portas.
#
# O conjunto de unidades legadas é DERIVADO do retrato inicial — o que estava
# ativo antes da 1ª execução —, nunca de lista escrita à mão que envelheceria em
# silêncio quando o legado mudasse.
# =========================================================================== #
ct_005() {
	caso "CT-005" "O provisionamento não altera o ambiente legado nem colide com suas portas"

	local pre="${DIR_EVIDENCIA}/retrato-pre"
	local pos="${DIR_EVIDENCIA}/retrato-pos2"

	# --- (a) toda unidade que estava ativa continua ativa --------------------- #
	local unidade caidas=0 total_unidades=0
	while IFS= read -r unidade; do
		[[ -n "${unidade}" ]] || continue
		total_unidades=$((total_unidades + 1))
		if ! grep -qxF "${unidade}" "${pos}/unidades-ativas.txt"; then
			falhar "(a) unidade legada deixou de estar ativa: ${unidade}"
			caidas=$((caidas + 1))
		fi
	done <"${pre}/unidades-ativas.txt"
	if [[ "${caidas}" -eq 0 ]]; then
		ok "(a) as ${total_unidades} unidades em execução antes do provisionamento continuam em execução"
	fi

	# Contrapartida da escolha por `running`: nenhuma unidade — de disparo único
	# inclusive — passou a `failed` por causa do provisionamento.
	local novas_falhas
	novas_falhas="$(comm -13 "${pre}/unidades-falhas.txt" "${pos}/unidades-falhas.txt" | tr '\n' ' ')"
	afirmar_igual "(a) nenhuma unidade nova entrou em estado de falha" "" "${novas_falhas% }"

	# --- (b) nenhuma porta legada troca de dono ------------------------------ #
	local porta processo processo_pos divergentes=0 total_portas=0
	while IFS=$'\t' read -r porta processo; do
		[[ -n "${porta}" ]] || continue
		# Portas efêmeras mudam sozinhas entre dois retratos — ver a constante.
		[[ "${porta}" -lt "${PRIMEIRA_PORTA_EFEMERA}" ]] || continue
		total_portas=$((total_portas + 1))
		processo_pos="$(awk -F'\t' -v p="${porta}" '$1 == p { print $2; exit }' "${pos}/portas.txt")"
		if [[ -z "${processo_pos}" ]]; then
			falhar "(b) porta legada ${porta} (dono '${processo}') deixou de estar em escuta"
			divergentes=$((divergentes + 1))
		elif [[ "${processo_pos}" != "${processo}" ]]; then
			falhar "(b) porta legada ${porta} trocou de dono: era '${processo}', agora é '${processo_pos}'"
			divergentes=$((divergentes + 1))
		fi
	done <"${pre}/portas.txt"
	if [[ "${divergentes}" -eq 0 ]]; then
		ok "(b) as ${total_portas} portas não efêmeras pré-existentes seguem com o mesmo processo dono"
	fi

	# --- (c) nenhum arquivo de unidade legado foi alterado ------------------- #
	local soma_pre soma_pos alteradas=0
	while IFS=' ' read -r unidade soma_pre; do
		[[ -n "${unidade}" ]] || continue
		soma_pos="$(awk -v u="${unidade}" '$1 == u { print $2; exit }' "${pos}/unidades-sha256.txt")"
		if [[ -n "${soma_pos}" && "${soma_pos}" != "${soma_pre}" ]]; then
			falhar "(c) o arquivo de unidade de ${unidade} mudou de conteúdo"
			alteradas=$((alteradas + 1))
		fi
	done <"${pre}/unidades-sha256.txt"
	if [[ "${alteradas}" -eq 0 ]]; then
		ok "(c) nenhum arquivo de unidade legado teve o conteúdo alterado"
	fi

	# --- (d) interseção vazia entre as portas novas e as pré-existentes ------ #
	local nova colisoes=0
	for nova in "${PORTAS_NOVAS[@]}"; do
		afirmar_igual "o script de provisionamento declara a porta ${nova}" "1" \
			"$(grep -cE "^readonly (PORTA_FILA|PORTA_SMTP_CAPTURADOR|PORTA_HTTP_CAPTURADOR)=${nova}$" \
				"${SCRIPT_PROVISIONAR}" || true)"
		if awk -F'\t' -v p="${nova}" '$1 == p { achou = 1 } END { exit !achou }' "${pre}/portas.txt"; then
			falhar "(d) a porta ${nova}, aberta pelos serviços novos, já pertencia ao ambiente pré-existente"
			colisoes=$((colisoes + 1))
		fi
	done
	afirmar_igual "(d) a interseção entre as portas novas e as pré-existentes é vazia" "0" "${colisoes}"

	# --- (e) o espaço livre continua acima do mínimo, com a queda em números - #
	local disco_pre disco_pos minimo queda
	disco_pre="$(cat "${pre}/disco-mib.txt")"
	disco_pos="$(cat "${pos}/disco-mib.txt")"
	minimo="$(grep -oE 'SYSLOC_MINIMO_DISCO_MIB:-[0-9]+' "${SCRIPT_PROVISIONAR}" | grep -oE '[0-9]+$' | head -1)"
	queda=$((disco_pre - disco_pos))

	afirmar_diferente "o mínimo de disco está declarado no script de provisionamento" "" "${minimo}"
	nota "(e) espaço livre em /: ${disco_pre} MiB antes, ${disco_pos} MiB depois — queda de ${queda} MiB"
	afirmar_igual "(e) o espaço livre em / permanece acima do mínimo exigido (${minimo} MiB)" "1" \
		"$([[ "${disco_pos}" -ge "${minimo}" ]] && echo 1 || echo 0)"

	# --- (f) a bateria se recusa a rodar contra a instalação que atende a
	#         operação (ADR-0006) ------------------------------------------- #
	#
	# Pertence a este caso porque é a mesma invariante que ele guarda — não
	# degradar o ambiente que atende a operação —, só que projetada no futuro: a
	# instalação desta fatia é inofensiva hoje e passa a ser produção na fatia de
	# implantação. O predicado recebe o caminho do marcador por parâmetro, o que
	# permite exercitar os dois lados sem criar arquivo em /etc.
	local marcador_falso="${DIR_TEMPORARIO}/marcador-de-producao-sintetico"
	rm -f "${marcador_falso}"
	afirmar_igual "(f) sem o marcador de produção, a bateria é liberada" "0" \
		"$(instalacao_liberada_para_bateria "${marcador_falso}" && echo 0 || echo 1)"
	: >"${marcador_falso}"
	afirmar_igual "(f) com o marcador de produção presente, a bateria é recusada" "1" \
		"$(instalacao_liberada_para_bateria "${marcador_falso}" && echo 0 || echo 1)"
	rm -f "${marcador_falso}"

	# O guarda precisa ser consultado ANTES dos casos, senão ele não guarda nada.
	afirmar_igual "(f) o main consulta o guarda antes de executar os casos" "1" \
		"$(awk '/^\trecusar_bateria_em_producao$/ { guarda = NR }
			/^\tct_002$/ { primeiro = NR }
			END { print (guarda > 0 && primeiro > guarda ? 1 : 0) }' "${BASH_SOURCE[0]}")"
	afirmar_igual "(f) a mensagem de recusa cita a ADR-0006" "1" \
		"$(sed -n '/^recusar_bateria_em_producao() {/,/^}/p' "${BASH_SOURCE[0]}" |
			grep -c 'ADR-0006' || true)"

	# A asserção que prende o guarda ao EFEITO, e não aos seus arredores.
	#
	# CAUSA-RAIZ de faltar: as quatro asserções acima provam o predicado (o lado
	# esquerdo da decisão), a posição da chamada no `main` (o contexto) e o texto
	# da mensagem (a aparência). Nenhuma prova a única coisa que o guarda promete:
	# TERMINAR O PROCESSO. Trocar o `exit 1` da recusa por `return 0` deixava as
	# quatro verdes, e a bateria seguiria adiante reiniciando a instância de fila
	# logo depois de anunciar que não faria isso. É a mesma forma de defeito que
	# este arquivo já cometeu uma vez — asserção AO LADO da operação perigosa em
	# vez de SOBRE ela.
	#
	# O subshell carrega as funções REAIS deste arquivo e aponta o marcador para
	# um caminho sintético, o que dispensa criar /etc/sysloc/producao e mede o
	# código de saída de verdade, em vez da ordem das linhas.
	# O processo é NOVO (`bash -c`), e não um subshell `( )`: `ARQ_MARCADOR_PRODUCAO`
	# é `readonly` neste arquivo, o atributo é herdado por subshell, e a
	# reatribuição falharia com código 1 — o que faria a asserção de "termina o
	# processo" passar pelo motivo errado, medindo o erro de atribuição em vez do
	# guarda. Um processo novo não herda o atributo, então o que se mede é o
	# `exit` da própria função.
	executar_guarda_isolado() { # $1 = marcador a enxergar
		bash -c '
			ARQ_MARCADOR_PRODUCAO="$1"
			eval "$(sed -n "/^instalacao_liberada_para_bateria() {/,/^}/p" "$2")"
			eval "$(sed -n "/^recusar_bateria_em_producao() {/,/^}/p" "$2")"
			recusar_bateria_em_producao
		' _ "$1" "${BASH_SOURCE[0]}" >/dev/null 2>&1
	}

	local codigo_recusa=0
	: >"${marcador_falso}"
	executar_guarda_isolado "${marcador_falso}" || codigo_recusa=$?
	afirmar_diferente "(f) com o marcador presente, a recusa TERMINA o processo (código != 0)" \
		"0" "${codigo_recusa}"

	# Companheiro positivo: sem ele, a asserção acima passaria com um guarda que
	# abortasse sempre — e a bateria nunca mais rodaria em lugar nenhum.
	local codigo_liberado=0
	rm -f "${marcador_falso}"
	executar_guarda_isolado "${marcador_falso}" || codigo_liberado=$?
	afirmar_igual "(f) sem o marcador, a recusa devolve o controle e a bateria segue (código 0)" \
		"0" "${codigo_liberado}"

	unset -f executar_guarda_isolado

	fechar_caso "CT-005"
}

# =========================================================================== #
main() {
	exigir_privilegio

	local faltando=() ferramenta
	for ferramenta in git ss dpkg-query systemctl stat sha256sum install runuser mount umount mountpoint find awk comm; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: ferramenta obrigatória ausente do PATH: %s\n' "${faltando[*]}" >&2
		exit 1
	fi

	if [[ "${1:-}" == "retrato" ]]; then
		if [[ -z "${2:-}" ]]; then
			printf 'ERRO: uso: %s retrato <diretório>\n' "$(basename "${BASH_SOURCE[0]}")" >&2
			exit 64
		fi
		capturar_retrato "$2"
		exit 0
	fi

	if [[ -n "${1:-}" ]]; then
		printf 'ERRO: subcomando desconhecido: %s\n' "$1" >&2
		printf '      uso: %s [retrato <diretório>]\n' "$(basename "${BASH_SOURCE[0]}")" >&2
		exit 64
	fi

	if [[ ! -f "${SCRIPT_PROVISIONAR}" ]]; then
		printf 'ERRO: script de provisionamento não encontrado em %s\n' "${SCRIPT_PROVISIONAR}" >&2
		exit 1
	fi

	# Depois do despacho de `retrato` de propósito: capturar um retrato não altera
	# nada e continua legítimo em qualquer instalação. O que se recusa é a
	# BATERIA, que reinicia serviço e reexecuta o provisionamento.
	recusar_bateria_em_producao

	exigir_retratos

	DIR_TEMPORARIO="$(mktemp -d -t sysloc-verificar-provisionamento-XXXXXXXX)"
	chmod 0700 "${DIR_TEMPORARIO}"

	printf 'Verificação do provisionamento dos serviços de base\n'
	printf '  repositório: %s\n' "${RAIZ_REPO}"
	printf '  evidência:   %s\n' "${DIR_EVIDENCIA}"

	# O CT-002 roda antes do CT-001 e sobre um destino distinto: provocar a falta
	# de espaço depois de um provisionamento bem-sucedido testaria outra coisa.
	ct_002
	ct_001
	ct_003
	ct_004
	ct_005

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-provisionamento: %d/%d casos aprovados (CT-001 a CT-005)\n' \
			"${casos_aprovados}" "${casos_executados}"
		exit 0
	fi
	printf 'verificar-provisionamento: %d falha(s) em %d caso(s) — REPROVADO\n' \
		"${falhas_totais}" "$((casos_executados - casos_aprovados))" >&2
	exit 1
}

main "$@"
