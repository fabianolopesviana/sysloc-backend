#!/usr/bin/env bash
#
# Verificação do provisionamento dos serviços de base — T2 da fatia
# `fundacao-stack-nativa`.
#
# Casos cobertos: CT-001, CT-002, CT-003, CT-004, CT-005, CT-030, CT-647 e
# CT-1045.
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
#           de nenhum processo filho nem em linha alguma de log; e o arquivo de
#           ambiente que a carrega é lido, montado e migrado pelo código REAL do
#           provisionamento — inclusive a FORMA da cadeia de conexão, conferida
#           contra o cliente que a aplicação de fato usa;
#   CT-004  uma tarefa gravada na fila sobrevive à parada e ao retorno do
#           servidor de fila;
#   CT-005  o provisionamento não alterou o ambiente legado nem colidiu com
#           suas portas;
#   CT-030  no cluster real, os quatro papéis — o da aplicação, o de migração, o
#           de resolução e o de roteamento — existem, nenhum deles tem privilégio
#           capaz de contornar a política de linha, o da aplicação não pertence a
#           nenhum dos outros três, a membership do migrador nos dois papéis de
#           travessia nominal é `INHERIT FALSE`, e os schemas pertencem ao papel
#           de migração com uso concedido ao papel da aplicação;
#   CT-1045 a pré-condição de ambiente da CONVERSÃO do material do certificado
#           (ADR-0036) é afirmada — o binário de criptografia do host E o
#           provider legado —, e a ausência de qualquer uma das duas metades
#           REPROVA nomeando o recurso que falta, em vez de deixar a descoberta
#           para a renovação que o Admin faz pela tela.
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
# Acrescentados pela T5 da fatia `fundacao-multitenancy-identidade`, junto com os
# passos P15 e P16 do provisionamento. Ver o CT-030.
readonly PAPEL_MIGRACAO="sysloc_migracao"
# Acrescentado pela T3 da sub-fatia `documentos-e-confirmacao`, junto com o
# terceiro papel do P15. Ele é `NOLOGIN` e de propósito único: carrega a
# propriedade de UMA função `SECURITY DEFINER` e nada mais. Ver o CT-030.
readonly PAPEL_RESOLUCAO="sysloc_resolucao"
# Acrescentado pela T3 da fatia `webhook-e-carne`, junto do QUARTO papel do P15.
# Gêmeo do de resolução em propriedades — `NOLOGIN`, sem credencial, dono de UMA
# função `SECURITY DEFINER` (a que roteia a notícia bancária, migração `0020`) —
# e papel PRÓPRIO, e não o reuso do terceiro: reusá-lo o faria alcançar DUAS
# tabelas, diluindo o `GRANT` mínimo que a emenda da ADR-0024 exige. Ver o CT-030.
readonly PAPEL_ROTEAMENTO="sysloc_roteamento"
readonly SCHEMA_IDENTIDADE="identidade"
readonly SCHEMA_NEGOCIO="negocio"
# Acrescentado pela T4 da fatia `fundacao-bancaria`, junto do terceiro schema do
# P16. Ele é o schema da ADR-0031 — o que não é dado de empresa nenhuma —, e as
# três asserções do laço do CT-030 valem para ele sem exceção: dono
# '${PAPEL_MIGRACAO}', `USAGE` concedido a '${PAPEL_DB}' e `CREATE` negado.
readonly SCHEMA_PLATAFORMA="plataforma"
readonly PORTA_FILA=6380
readonly ARQ_FILA_CONF="/etc/redis/redis-sysloc.conf"
readonly DIR_FILA_DADOS="/var/lib/redis/sysloc"
readonly UNIDADE_FILA="redis-server@sysloc.service"
readonly PORTA_SMTP_CAPTURADOR=1025
readonly PORTA_HTTP_CAPTURADOR=8025
readonly DIR_SOCKET_PG="/var/run/postgresql"
readonly HOSPEDEIRO_DB="127.0.0.1"

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
# Degradação declarada: asserção que o host não permitiu medir. Não é falha —
# não altera o código de saída —, mas o resumo final a repete, para que um
# `AVISO` no meio de uma bateria longa não passe despercebido e vire verde
# silencioso. Mesma conduta do irmão `verificar-preparacao-do-material.sh`.
avisos_totais=0

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

aviso() {
	avisos_totais=$((avisos_totais + 1))
	printf '    AVISO %s\n' "$*" >&2
}

nota() { printf '    ..   %s\n' "$*"; }

# DÉBITO COM GATILHO — D9 · F0/T2 · registrado 2026-08-19
# (NÃO é uma `DECISÃO FECHADA`: agenda uma mudança, não protege o esqueleto abaixo.)
# O QUÊ: o esqueleto de asserções deste arquivo — `caso`, `fechar_caso`, `falhar`, `limpar`,
#        `afirmar_igual`, `afirmar_diferente` — está COPIADO nos verificadores do repositório, e o
#        débito pede promovê-lo a `deploy/scripts/lib/assercoes.sh`. Junto vem a segunda metade:
#        `ct_003` acumula seis responsabilidades num corpo único e deve virar uma função por bloco.
# ⚠️ MEDIÇÃO DE 2026-08-19 — o número envelheceu DUAS vezes, e o problema não é o que o
#        enunciado diz. São **10** verificadores, não 4 (registro) nem 7 (higienização de
#        2026-08-08): borda/notificacao-bancaria, caracterizacao/{captura,golden},
#        cobranca-bancaria/guarda-de-boletos, documentos/isolamento-de-verificacao,
#        instalacao/{apuracao-versao,fundacao,migracao,provisionamento,workspace}.
#        E o achado que MUDA A NATUREZA do débito: as 10 cópias do núcleo são **10 formas
#        DISTINTAS entre si** — de 35 a 63 linhas, nenhum md5 repetido. Não é "o mesmo esqueleto
#        copiado 10 vezes"; são DEZ DIALETOS do mesmo esqueleto. O núcleo comum aos 10 é de 6
#        funções (as listadas acima); `aviso` está em 7, `afirmar_contem` em 3, e as demais
#        (`afirmar_desfecho_dos_caminhos`, `afirmar_copia_enxerga_migracoes`,
#        `afirmar_forma_e_procedencia`, `afirmar_sem_bloqueio`, `afirmar_forma_do_fonte_do_pdf`)
#        são de domínio e NÃO pertencem à casa comum.
# QUANDO FECHA: **a próxima fatia que escrever um `verificar-*.sh`** — é o gatilho literal do
#        débito (*"fixar o formato ANTES da próxima fatia escrever seu verificar-*.sh"*), e ele
#        vale porque cada verificador novo nasce copiando um vizinho e vira o 11º dialeto.
#        ⚠️ Quem fechar precisa de BASELINE, e ela é o obstáculo real: apenas 2 dos 10
#        (`verificar-workspace.sh` e `verificar-golden.sh`) rodam sem privilégio — os outros 8
#        exigem `sudo`/execução assistida, e converter sem poder executar viola o P1 e o P5 da
#        `.claude/rules/nao-regressao.md`. Feche COM a janela de execução assistida agendada, não
#        antes dela.
# POR QUE NÃO AGORA: o débito diz literalmente *"não refatorar agora — o arquivo está provado por
#        cinco execuções assistidas"*, e a intervenção dirigida de 2026-08-19 confirmou a razão
#        por medição: sem baseline para 8 dos 10, a conversão trocaria duplicação conhecida por
#        regressão invisível em scripts que provam a infraestrutura que opera.
# ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D9
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
	# A âncora tolera INDENTAÇÃO, como a de `extrair_credencial_db` no
	# provisionamento — endurecida junto com ela na intervenção dirigida de
	# 2026-08-23 (`D10 · F0/T2`). Esta é a segunda cópia do caminho de leitura
	# que o `D9 · F0/T2` nomeia, e é justamente o caso dele: corrigir só uma
	# deixaria a tabela (k) reprovando no leitor deste arquivo com o
	# provisionamento já correto.
	if printf '%s\n' "$(grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "${arquivo}" 2>/dev/null |
		tr -d ' \t' | sort | uniq -d)" | grep -q .; then
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
	local -a funcoes=(
		credencial_manuseavel
		extrair_credencial_db
		montar_url_do_banco
		destino_esperado_do_banco
		destino_anterior_por_socket
		conferir_coordenadas_do_ambiente
		migrar_database_url_de_socket
	)

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
# Generalizada na fatia `fundacao-multitenancy-identidade` (F1). A versão anterior
# exigia EXATAMENTE UM `ALTER ROLE` executável e o ancorava no corpo de
# `passo_p09_credencial_valida`, por NOME. A F1/T5 acrescentou o segundo sítio —
# `passo_p16_banco_preparado`, que ressincroniza a senha do papel de MIGRAÇÃO —,
# igualmente guardado, e a bateria reprovou por contagem enquanto o invariante
# seguia intacto.
#
# A correção não é subir o número para 2: isso adia o mesmo defeito para o
# terceiro sítio. A auditoria passa a percorrer TODAS as ocorrências e a cobrar,
# em cada uma, que o guarda seja sobre a MESMA credencial que aquele comando
# escreve — o que a versão anterior não fazia nem para o sítio único. Ganhos:
# sítio novo nasce auditado, e "guardar ${senha_a} e escrever ${senha_b}" passa a
# reprovar.
auditar_guarda_do_alter_role() {
	local script="$1"
	local -a linhas_alter=() auditados=()
	local linha var fn corpo linha_alter linha_guarda

	mapfile -t linhas_alter < <(grep -nF 'ALTER ROLE \"%s\" WITH PASSWORD' "${script}" | cut -d: -f1)

	# Zero ocorrências é reprovação, e não aprovação por vacuidade: um script que
	# tenha perdido o comando não é um script guardado.
	if [[ "${#linhas_alter[@]}" -eq 0 ]]; then
		printf 'não encontrei comando ALTER ROLE executável no script'
		return 1
	fi

	for linha in "${linhas_alter[@]}"; do
		# A credencial que ESTE comando escreve: o último `${...}` da linha de
		# argumentos, logo abaixo do `printf`. É o que amarra guarda e escrita à
		# mesma variável.
		var="$(sed -n "$((linha + 1))p" "${script}" |
			grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*\}' | tail -1 | tr -d '${}')"
		if [[ -z "${var}" ]]; then
			printf 'na linha %s não identifiquei a credencial que o ALTER ROLE escreve' "${linha}"
			return 1
		fi

		# A função que contém a linha: a última definição em coluna 0 antes dela.
		fn="$(awk -v alvo="${linha}" \
			'NR < alvo && /^[A-Za-z_][A-Za-z0-9_]*\(\) \{/ { f = $1 } END { sub(/\(\).*/, "", f); print f }' \
			"${script}")"
		if [[ -z "${fn}" ]]; then
			printf 'o ALTER ROLE da linha %s não está dentro de função nenhuma' "${linha}"
			return 1
		fi

		corpo="$(sed -n "/^${fn}() {/,/^}/p" "${script}")"
		linha_alter="$(printf '%s\n' "${corpo}" |
			grep -nF 'ALTER ROLE \"%s\" WITH PASSWORD' | head -1 | cut -d: -f1)"
		if [[ -z "${linha_alter}" ]]; then
			printf 'o ALTER ROLE da linha %s não caiu no corpo de %s — a apuração da função falhou' \
				"${linha}" "${fn}"
			return 1
		fi

		linha_guarda="$(printf '%s\n' "${corpo}" |
			grep -nF "! credencial_manuseavel \"\${${var}}\"" | head -1 | cut -d: -f1)"
		if [[ -z "${linha_guarda}" ]]; then
			printf '%s NÃO afirma credencial_manuseavel sobre ${%s} antes de reescrever a senha' \
				"${fn}" "${var}"
			return 1
		fi

		if [[ "${linha_guarda}" -ge "${linha_alter}" ]]; then
			printf 'em %s, a afirmação sobre ${%s} (linha %s do corpo) não precede o ALTER ROLE (linha %s)' \
				"${fn}" "${var}" "${linha_guarda}" "${linha_alter}"
			return 1
		fi

		auditados+=("${fn}(\${${var}})")
	done

	printf '%s sítio(s) de ALTER ROLE auditado(s), todos guardados: %s' \
		"${#linhas_alter[@]}" "${auditados[*]}"
	return 0
}

# --------------------------------------------------------------------------- #
# Auditoria da FORMA da cadeia de conexão que o provisionamento grava.
#
# CAUSA-RAIZ de existir: nenhuma asserção desta bateria olhava a forma. Ela
# conferia a credencial e as coordenadas — papel, diretório, portas — e passava
# verde sobre uma cadeia que NENHUM consumidor consegue interpretar. Foi por essa
# fresta que a forma de socket (`@/BANCO?host=DIRETORIO&port=PORTA`) atravessou as
# cinco rodadas de gate desta task e os dois gates da task do serviço de
# aplicação, e só apareceu quando alguém executou o `ExecStart` real: o cliente
# `postgres.js` constrói as opções de conexão com `new URL()` e lança
# `Invalid URL` antes de qualquer tentativa de conexão.
#
# São DUAS asserções, e o defeito exige as duas:
#
#   estrutural     o destino declarado é `HOSPEDEIRO:PORTA/BANCO`, sem `?host=`;
#   comportamental o CLIENTE REAL da aplicação aceita a cadeia e resolve dela o
#                  hospedeiro, a porta e o banco esperados.
#
# Provar só a estrutural repetiria o defeito de provar o que é fácil provar: a
# forma com codificação percentual (`@%2Fvar%2Frun%2Fpostgresql:5432/BANCO`) passa
# na estrutural e o cliente a resolve como NOME DE MÁQUINA, sem decodificar. E
# provar só a comportamental deixaria a bateria muda no host em que o runtime não
# estiver alcançável.
#
# Recebe o caminho do script por parâmetro para poder ser apontada a uma cópia com
# o defeito de volta — é assim que se prova que ela reprova.
#
# Imprime o diagnóstico e devolve 0 (forma consumível) ou 1.
# --------------------------------------------------------------------------- #

# O runtime que a aplicação usa. Sob `sudo` o PATH é o do superusuário e não
# alcança o gerenciador de versões, que vive no diretório pessoal do usuário de
# trabalho — daí o segundo caminho, derivado da versão fixada em `.mise.toml`.
localizar_runtime_node() {
	local caminho
	if caminho="$(command -v node 2>/dev/null)"; then
		printf '%s' "${caminho}"
		return 0
	fi

	local versao dono lar
	versao="$(sed -n 's|^node = "\(.*\)"$|\1|p' "${RAIZ_REPO}/.mise.toml" 2>/dev/null | head -1)"
	dono="$(stat -c '%U' "${RAIZ_REPO}" 2>/dev/null || true)"
	lar="$(getent passwd "${dono}" 2>/dev/null | cut -d: -f6)"
	[[ -n "${versao}" && -n "${lar}" ]] || return 1

	caminho="${lar}/.local/share/mise/installs/node/${versao}/bin/node"
	[[ -x "${caminho}" ]] || return 1
	printf '%s' "${caminho}"
}

auditar_forma_da_url_do_banco() {
	local script="$1"
	local url destino

	# A cadeia é montada pela função REAL do script auditado, num processo novo —
	# nem o `readonly` das constantes deste arquivo nem as funções já carregadas
	# aqui interferem. A credencial é SINTÉTICA e autodescritiva: esta auditoria
	# nunca toca o segredo vivo.
	url="$(bash -c '
		PAPEL_DB="$2"; BANCO_DB="$3"; HOSPEDEIRO_DB="$4"; DIR_SOCKET_PG="$5"
		eval "$(sed -n "/^montar_url_do_banco() {/,/^}/p" "$1")"
		[[ "$(type -t montar_url_do_banco)" == "function" ]] || exit 1
		montar_url_do_banco "CREDENCIALSINTETICADAAUDITORIA" 5432
	' _ "${script}" "${PAPEL_DB}" "${BANCO_DB}" "${HOSPEDEIRO_DB}" "${DIR_SOCKET_PG}" 2>/dev/null)" || {
		printf 'o script não declara montar_url_do_banco, de onde ler a forma da cadeia'
		return 1
	}

	# A forma auditada precisa ser a forma GRAVADA. Sem isto, alguém poderia manter
	# a função impecável e voltar a escrever o literal antigo no passo do arquivo de
	# ambiente — e a auditoria aprovaria uma função que ninguém chama.
	local escritas fora_da_funcao
	escritas="$(grep -cE "printf 'DATABASE_URL=" "${script}" || true)"
	fora_da_funcao="$(grep -E "printf 'DATABASE_URL=" "${script}" | grep -cv 'montar_url_do_banco' || true)"
	if [[ "${escritas}" -lt 1 ]]; then
		printf 'o script não grava linha DATABASE_URL alguma'
		return 1
	fi
	if [[ "${fora_da_funcao}" -ne 0 ]]; then
		printf '%s escrita(s) de DATABASE_URL não passam por montar_url_do_banco' "${fora_da_funcao}"
		return 1
	fi

	# --- estrutural: a FORMA, antes de qualquer valor ------------------------ #
	if [[ "${url}" != postgresql://* ]]; then
		printf 'a cadeia montada não começa com postgresql:// [%s]' "${url}"
		return 1
	fi
	destino="${url##*@}"
	# `HOSPEDEIRO:PORTA/BANCO`, e nada de parâmetro de consulta: é a forma de
	# socket (`/BANCO?host=...`) que este predicado recusa. Deliberadamente GENÉRICO
	# — o valor de cada campo é conferido adiante, e prender esta linha aos valores
	# faria a asserção comportamental nunca ser alcançada por defeito algum.
	if [[ ! "${destino}" =~ ^[^/?]+:[0-9]+/[^/?]+$ ]]; then
		printf 'o destino declarado é [%s], que não tem a forma HOSPEDEIRO:PORTA/BANCO — nenhum consumidor da cadeia interpreta isso' \
			"${destino}"
		return 1
	fi

	# --- comportamental, contra o cliente REAL da aplicação ------------------ #
	#
	# Vem ANTES da comparação literal do destino de propósito: é a asserção mais
	# forte das duas, e é ela que precisa reprovar primeiro quando as duas
	# reprovariam. A forma com codificação percentual, por exemplo, atravessa o
	# predicado de forma acima e só é pega aqui — o cliente não decodifica nada e
	# trata `%2Fvar%2Frun%2Fpostgresql` como nome de máquina.
	local runtime resolvido consultou=0
	if runtime="$(localizar_runtime_node)"; then
		consultou=1
		local codigo=0
		resolvido="$(printf '%s' "${url}" | (cd "${RAIZ_REPO}/apps/api" && "${runtime}" --input-type=module -e '
			import postgres from "postgres";
			let entrada = "";
			for await (const parte of process.stdin) entrada += parte;
			const conexao = postgres(entrada.trim(), { max: 1, connect_timeout: 1 });
			process.stdout.write(`${conexao.options.host}|${conexao.options.port}|${conexao.options.database}`);
			process.exit(0);
		') 2>/dev/null)" || codigo=$?

		if [[ "${codigo}" -ne 0 ]]; then
			printf 'o cliente real da aplicação RECUSOU a cadeia montada (código %s) — é a forma que derruba a partida do serviço' "${codigo}"
			return 1
		fi
		if [[ "${resolvido}" != "${HOSPEDEIRO_DB}|5432|${BANCO_DB}" ]]; then
			printf 'o cliente real aceitou a cadeia mas resolveu [%s], e o esperado é [%s|5432|%s]' \
				"${resolvido}" "${HOSPEDEIRO_DB}" "${BANCO_DB}"
			return 1
		fi
	fi

	# --- os valores, comparados literalmente --------------------------------- #
	#
	# Segunda linha de defesa, e a ÚNICA quando o runtime não está alcançável:
	# sem ela, uma máquina sem o runtime aprovaria uma cadeia apontando para
	# qualquer hospedeiro.
	if [[ "${destino}" != "${HOSPEDEIRO_DB}:5432/${BANCO_DB}" ]]; then
		printf 'o destino declarado é [%s] e deveria ser [%s:5432/%s]' \
			"${destino}" "${HOSPEDEIRO_DB}" "${BANCO_DB}"
		return 1
	fi

	if [[ "${consultou}" -eq 0 ]]; then
		printf 'forma e destino corretos [%s]; o cliente real NÃO foi consultado — runtime não localizado' "${destino}"
		return 2
	fi

	printf 'destino [%s]; o cliente real resolve [%s]' "${destino}" "${resolvido}"
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
	# — `(--password|PGPASSWORD[=]|--dbpassword)[= ]` — ele se aplicava ao grupo
	# inteiro, de modo que o ramo da variável de ambiente só casaria com um sinal
	# de igual DOBRADO, ou seguido de espaço, e nunca com o uso real
	# `PGPASSWORD[=]<valor> psql …`, que é justamente a forma mais provável de
	# vazamento. O ramo estava morto. O card do CT-003 (§5.6 da task) foi
	# atualizado junto, para a asserção e o teste continuarem literalmente iguais.
	#
	# O `[=]` é classe de caractere de UM elemento: casa exatamente o mesmo que o
	# sinal solto casaria, sem perder poder de detecção. Ele existe para quebrar a
	# AUTO-REFERÊNCIA — escrito solto, o texto deste padrão (e o dos comentários
	# que o explicam) é ele próprio uma instância do padrão, e a auditoria da
	# ADR-0005 declarada em `.claude/rules/testing-stack.md`, que exige 0
	# ocorrências em `deploy/scripts/**/*.sh`, nunca fecharia no repositório.
	# Mesma forma já adotada em `verificar-apuracao-versao.sh`.
	afirmar_igual "(e) o script não passa segredo por argumento de linha de comando nem por variável de ambiente" "0" \
		"$(grep -cE -- '(--password[= ]|--dbpassword[= ]|PGPASSWORD[=])' "${SCRIPT_PROVISIONAR}" || true)"

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
		ok "funções do provisionamento carregadas de ${SCRIPT_PROVISIONAR##*/} (leitura da credencial, montagem da cadeia, conferência de coordenadas e migração)"
	else
		falhar "não consegui carregar as funções de leitura, montagem, conferência e migração de ${SCRIPT_PROVISIONAR} — sem elas as tabelas (i)/(j)/(k)/(l)/(n) não teriam SUT e passariam vazias"
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

	# O mesmo companheiro positivo na forma que o provisionamento GRAVA hoje. As
	# duas formas precisam ser lidas: a antiga porque é a que está no arquivo já
	# posicionado, no instante ANTES de o P06 migrá-lo — se o leitor não a
	# entendesse, a migração não teria de onde tirar a credencial a preservar —, e
	# a nova porque é a que vale de lá em diante.
	printf 'DATABASE_URL=postgresql://%s:%s@%s:5432/%s\nREDIS_URL=redis://127.0.0.1:%s\nSMTP_URL=smtp://127.0.0.1:%s\n' \
		"${PAPEL_DB}" "${valor_ok}" "${HOSPEDEIRO_DB}" "${BANCO_DB}" "${PORTA_FILA}" "${PORTA_SMTP_CAPTURADOR}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(j) credencial alfanumérica na forma GRAVADA hoje é devolvida ÍNTEGRA" \
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

	# A duplicata INDENTADA — fechada na intervenção dirigida de 2026-08-23
	# (`D10 · F0/T2`). O `EnvironmentFile=` do systemd tolera espaço à esquerda e
	# lê `  DATABASE_URL=…` como atribuição; o guarda ancorava em `^[A-Za-z_]` e
	# não a via. A ambiguidade que ele existe para recusar ficava exatamente no
	# formato invisível a ele, e o script seguia com um valor enquanto os
	# serviços subiam com outro. Este é o caso que discrimina: o de cima, sem
	# indentação, já era recusado antes.
	printf 'DATABASE_URL=postgresql://%s:SENHASINTETICAVELHA111@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\n  DATABASE_URL=postgresql://%s:SENHASINTETICANOVA999@/%s?host=/var/run/postgresql&port=5432\n' \
		"${PAPEL_DB}" "${BANCO_DB}" "${PORTA_FILA}" "${PAPEL_DB}" "${BANCO_DB}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(k) segunda DATABASE_URL INDENTADA também é recusada (o systemd a lê)" \
		"${arq_sonda}" "RECUSA"

	# Controle negativo: UMA linha indentada não é ambiguidade — não há duas
	# atribuições. Sem esta asserção, um guarda que recusasse toda indentação
	# passaria pela de cima e ninguém notaria a recusa indevida.
	printf '  DATABASE_URL=postgresql://%s:%s@/%s?host=/var/run/postgresql&port=5432\nREDIS_URL=redis://127.0.0.1:%s\n' \
		"${PAPEL_DB}" "${valor_ok}" "${BANCO_DB}" "${PORTA_FILA}" >"${arq_sonda}"
	sondar_os_dois_leitores \
		"(k) UMA DATABASE_URL indentada NÃO é ambiguidade (controle negativo)" \
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
	# O destino esperado é escrito LITERALMENTE aqui, e não obtido da função do
	# provisionamento: montar o esperado com o mesmo código que produz o obtido
	# faria a asserção concordar consigo mesma. É a mesma doutrina das constantes
	# espelhadas no topo deste arquivo.
	local destino_ok="${HOSPEDEIRO_DB}:${porta_pg_sonda}/${BANCO_DB}"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) arquivo com as três chaves nas coordenadas provisionadas é aceito sem alteração" \
		"COERENTE" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	# A forma ANTERIOR, de socket de domínio Unix. Ela é reprovada como
	# divergência — e é essa reprovação que faz o P06 migrar o arquivo em vez de
	# aceitá-lo. Sem esta linha, voltar a gravar a forma de socket deixaria a
	# conferência de coordenadas muda.
	ambiente_completo "/${BANCO_DB}?host=${DIR_SOCKET_PG}&port=${porta_pg_sonda}" \
		"redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) DATABASE_URL na forma anterior (socket) é RECUSADA como divergente" \
		"DIVERGE:DATABASE_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	ambiente_completo "${destino_ok}" "redis://127.0.0.1:6379" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	afirmar_igual "(l) REDIS_URL apontando para a instância do ambiente legado (6379) é RECUSADO" \
		"DIVERGE:REDIS_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	# Porta divergente da porta VIVA do cluster, na forma correta — o que isola a
	# porta como a única coisa que diverge. Escrita na forma antiga, esta entrada
	# passaria a reprovar pela FORMA e deixaria de discriminar a porta.
	ambiente_completo "${HOSPEDEIRO_DB}:5433/${BANCO_DB}" "redis://127.0.0.1:${PORTA_FILA}" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
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

	# A chave PRESENTE e VAZIA — fechada na intervenção dirigida de 2026-08-23
	# (`D39 · F3/T8`). O critério de ausência era o VALOR, de modo que um
	# `REDIS_URL=` esvaziado pelo operador entrava em `CHAVES_AUSENTES`; o P06
	# acrescentava uma SEGUNDA atribuição da mesma chave, e a execução seguinte
	# abortava por ambiguidade no bloco (k) acima — o provisionador criando,
	# sozinho, a condição que ele existe para recusar. O critério passou a ser a
	# EXISTÊNCIA DA LINHA, alinhado ao que `garantir_chaves_de_conteudo` já
	# adotava, e a linha vazia é DIVERGÊNCIA: o valor não é o provisionado.
	#
	# O par com a asserção de `FALTA:REDIS_URL` acima é o que discrimina — uma
	# sozinha não separa "linha ausente" de "linha presente e vazia", que é
	# justamente a distinção que o defeito apagava.
	ambiente_completo "${destino_ok}" "" "smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}"
	printf 'REDIS_URL=\n' >>"${arq_sonda}"
	afirmar_igual "(l) REDIS_URL presente e VAZIA é DIVERGÊNCIA, nunca chave a acrescentar" \
		"DIVERGE:REDIS_URL" "$(sonda_coordenadas_do_provisionador "${arq_sonda}" "${porta_pg_sonda}")"

	unset -f ambiente_completo

	# (m) a FORMA da cadeia gravada, contra o cliente REAL da aplicação ------- #
	#
	# É a asserção que faltava quando o bloqueador apareceu: a bateria conferia o
	# papel, o diretório e as portas de uma cadeia que nenhum consumidor consegue
	# interpretar. Ver o cabeçalho de `auditar_forma_da_url_do_banco` para as duas
	# pontas — a estrutural e a comportamental — e por que uma sozinha não basta.
	local diagnostico_forma codigo_forma=0
	diagnostico_forma="$(auditar_forma_da_url_do_banco "${SCRIPT_PROVISIONAR}")" || codigo_forma=$?
	case "${codigo_forma}" in
	0) ok "(m) a cadeia que o provisionamento grava é consumível — ${diagnostico_forma}" ;;
	2) aviso "(m) ponta comportamental PULADA — ${diagnostico_forma}; execute a bateria numa máquina com o runtime instalado ('mise install' como o usuário de trabalho) para exercitá-la" ;;
	*) falhar "(m) a cadeia que o provisionamento grava NÃO é consumível — ${diagnostico_forma}" ;;
	esac

	# Prova de falsificação da asserção acima: uma cópia do provisionamento com a
	# forma anterior de volta precisa REPROVAR. Sem ela, `auditar_forma_da_url_do_banco`
	# poderia estar aprovando por não saber reprovar — que é o defeito que três das
	# cinco rodadas desta task cometeram.
	# São DOIS falsificadores, um por ponta da auditoria — um só provaria metade:
	#
	#   socket        troca a cadeia de formato E os argumentos pela forma anterior.
	#                 Reprova na ponta ESTRUTURAL, e é o defeito literal que esta
	#                 fatia veio fechar;
	#   percentual    troca só o hospedeiro pelo caminho do socket com codificação
	#                 percentual. Atravessa a ponta estrutural — `%2F...:5432/sysloc`
	#                 TEM a forma `HOSPEDEIRO:PORTA/BANCO` — e só é pega pelo cliente
	#                 real, que não decodifica nada e tenta resolver aquilo como nome
	#                 de máquina. É o falsificador da ponta COMPORTAMENTAL.
	auditar_falsificador() { # $1 rótulo · $2 arquivo mutilado
		local diagnostico codigo=0
		diagnostico="$(auditar_forma_da_url_do_banco "$2")" || codigo=$?
		if [[ "${codigo}" -eq 1 ]]; then
			ok "(m) sobre a cópia [$1], a auditoria REPROVA — ${diagnostico}"
		else
			falhar "(m) a auditoria NÃO reprova a cópia [$1] (código ${codigo}: ${diagnostico}) — ela não sabe pegar o defeito que persegue"
		fi
		# Controle de integridade: se a substituição não tiver casado nada, a cópia
		# seria idêntica ao original e a asserção acima compararia o script consigo
		# mesmo, aprovando por acidente.
		afirmar_diferente "(m) a cópia [$1] difere do script original" \
			"$(sha256sum "${SCRIPT_PROVISIONAR}" | cut -d' ' -f1)" \
			"$(sha256sum "$2" | cut -d' ' -f1)"
	}

	local copia_com_socket="${dir_sonda}/provisionar-com-forma-de-socket.sh"
	sed -e 's|postgresql://%s:%s@%s:%s/%s|postgresql://%s:%s@/%s?host=%s\&port=%s|' \
		-e 's|"${PAPEL_DB}" "$1" "${HOSPEDEIRO_DB}" "$2" "${BANCO_DB}"|"${PAPEL_DB}" "$1" "${BANCO_DB}" "${DIR_SOCKET_PG}" "$2"|' \
		"${SCRIPT_PROVISIONAR}" >"${copia_com_socket}"
	auditar_falsificador "forma de socket de volta" "${copia_com_socket}"

	local copia_percentual="${dir_sonda}/provisionar-com-codificacao-percentual.sh"
	sed 's|"${HOSPEDEIRO_DB}" "$2" "${BANCO_DB}"|"%2Fvar%2Frun%2Fpostgresql" "$2" "${BANCO_DB}"|' \
		"${SCRIPT_PROVISIONAR}" >"${copia_percentual}"
	auditar_falsificador "socket com codificação percentual" "${copia_percentual}"

	# Terceiro falsificador, para a asserção de que toda escrita passa pela função:
	# a cópia mantém `montar_url_do_banco` impecável e acrescenta um ponto de
	# escrita que a contorna. Sem ele, a auditoria estaria conferindo a forma de uma
	# função que o script poderia ter deixado de usar.
	local copia_com_escrita_solta="${dir_sonda}/provisionar-com-escrita-fora-da-funcao.sh"
	cp "${SCRIPT_PROVISIONAR}" "${copia_com_escrita_solta}"
	printf '\t\tprintf %s "${PAPEL_DB}" "${senha_db}" "${BANCO_DB}" "${DIR_SOCKET_PG}" "${porta_banco}"\n' \
		"'DATABASE_URL=postgresql://%s:%s@/%s?host=%s&port=%s\\n'" >>"${copia_com_escrita_solta}"
	auditar_falsificador "escrita de DATABASE_URL fora da função" "${copia_com_escrita_solta}"

	unset -f auditar_falsificador
	rm -f "${copia_com_socket}" "${copia_percentual}" "${copia_com_escrita_solta}"

	# (n) a MIGRAÇÃO do arquivo já posicionado ------------------------------- #
	#
	# O arquivo de ambiente da instalação existente carrega a forma anterior e a
	# credencial que o BANCO conhece. A migração troca a forma e preserva o
	# segredo; regerá-lo aqui quebraria o acesso de tudo que já o consome. As
	# quatro pontas abaixo são o que separa migrar de estragar.
	#
	# A função REAL é exercitada num subshell que fornece o `abortar` que ela
	# espera — nenhum símbolo é acrescentado ao provisionamento por causa do teste.
	local arq_migracao="${dir_sonda}/ambiente-a-migrar"
	local credencial_sintetica="CREDENCIALSINTETICADAMIGRACAO789"
	printf '# comentário preservado\nDATABASE_URL=postgresql://%s:%s@/%s?host=%s&port=%s\nREDIS_URL=redis://127.0.0.1:%s\nSMTP_URL=smtp://127.0.0.1:%s\n' \
		"${PAPEL_DB}" "${credencial_sintetica}" "${BANCO_DB}" "${DIR_SOCKET_PG}" "${porta_pg_sonda}" \
		"${PORTA_FILA}" "${PORTA_SMTP_CAPTURADOR}" >"${arq_migracao}"

	# Processo NOVO (`bash -c`), e NÃO subshell `( )` — a mesma escolha, e pelo
	# mesmo motivo, de `executar_guarda_isolado` no CT-005.
	#
	# CAUSA-RAIZ de não ser `( )`: a sonda precisa apontar `DONO_ARQ_AMBIENTE` para
	# o dono do arquivo do sandbox, e essa constante é `readonly` no escopo deste
	# arquivo. O atributo é HERDADO por subshell, e o bash recusa a atribuição
	# mesmo quando o valor é idêntico ao declarado: `set -e` derruba o subshell
	# ANTES de a migração acontecer, e quem reprova são as quatro asserções sobre o
	# resultado — que passam a acusar a migração por um defeito da sonda. Foi
	# exatamente o que aconteceu na execução privilegiada. Um processo novo não
	# herda o atributo.
	#
	# A sonda devolve, na saída padrão, o dono que EFETIVAMENTE usou. É o que
	# permite à primeira asserção do bloco NOMEAR a colisão se alguém reintroduzir
	# a forma `( )`, em vez de deixar o diagnóstico por conta das asserções de
	# resultado. As funções vêm do arquivo REAL, como nas outras sondas isoladas
	# deste verificador — nenhum símbolo é acrescentado ao provisionamento por
	# causa do teste.
	#
	# A credencial chega ao processo novo pela ENTRADA PADRÃO, nunca em `argv`: é o
	# canal que a ADR-0005 fixa, e a sonda não abre exceção por o valor ser
	# sintético — o caminho que ela exercita é o que reescreve a senha do banco, e
	# uma sonda que modele o canal errado ensina o canal errado.
	migrar_isolado() { # $1 arquivo · $2 porta · $3 credencial em mãos
		printf '%s\n' "$3" | bash -c '
			set -Eeuo pipefail
			IFS= read -r senha_db
			DONO_ARQ_AMBIENTE="$(stat -c "%U" "$1")"
			PAPEL_DB="$4"; BANCO_DB="$5"; HOSPEDEIRO_DB="$6"; DIR_SOCKET_PG="$7"
			abortar() {
				printf "ABORTOU: %s\n" "$1" >&2
				exit 9
			}
			for fn in credencial_manuseavel montar_url_do_banco \
				destino_anterior_por_socket migrar_database_url_de_socket; do
				eval "$(sed -n "/^${fn}() {/,/^}/p" "$3")"
				[[ "$(type -t "${fn}")" == "function" ]] || exit 8
			done
			codigo=0
			migrar_database_url_de_socket "$1" "$2" || codigo=$?
			printf "%s" "${DONO_ARQ_AMBIENTE}"
			exit "${codigo}"
		' _ "$1" "$2" "${SCRIPT_PROVISIONAR}" \
			"${PAPEL_DB}" "${BANCO_DB}" "${HOSPEDEIRO_DB}" "${DIR_SOCKET_PG}"
	}

	local dono_esperado dono_efetivo codigo_migracao=0
	dono_esperado="$(stat -c '%U' "${arq_migracao}")"
	dono_efetivo="$(migrar_isolado "${arq_migracao}" "${porta_pg_sonda}" "${credencial_sintetica}")" ||
		codigo_migracao=$?
	# PRIMEIRA do bloco de propósito: é a rede do defeito que fez esta sonda
	# reprovar com diagnóstico enganoso. Se a sonda voltar a rodar num contexto que
	# herda o `readonly` das constantes, ela morre na atribuição e não devolve dono
	# nenhum — e a reprovação nomeia a colisão em vez de acusar a migração.
	afirmar_igual "(n) a sonda sobrescreveu DONO_ARQ_AMBIENTE — sem isso a migração aborta e as asserções seguintes reprovam pelo motivo errado" \
		"${dono_esperado}" "${dono_efetivo}"
	afirmar_igual "(n) a migração reporta que houve mudança" "0" "${codigo_migracao}"
	afirmar_igual "(n) a cadeia migrada é a forma gravada hoje, com a credencial PRESERVADA" \
		"DATABASE_URL=postgresql://${PAPEL_DB}:${credencial_sintetica}@${HOSPEDEIRO_DB}:${porta_pg_sonda}/${BANCO_DB}" \
		"$(grep '^DATABASE_URL=' "${arq_migracao}")"
	afirmar_igual "(n) as demais linhas do arquivo sobrevivem à migração" \
		"# comentário preservado|REDIS_URL=redis://127.0.0.1:${PORTA_FILA}|SMTP_URL=smtp://127.0.0.1:${PORTA_SMTP_CAPTURADOR}" \
		"$(grep -v '^DATABASE_URL=' "${arq_migracao}" | paste -sd '|' -)"
	afirmar_igual "(n) o arquivo migrado continua 0600" "600" "$(stat -c '%a' "${arq_migracao}")"
	afirmar_igual "(n) nenhum intermediário sobra ao lado do arquivo" "0" \
		"$(find "${dir_sonda}" -maxdepth 1 -name '*.migrando' | wc -l)"

	# A segunda execução não tem o que fazer — é o que torna a migração idempotente
	# em vez de uma reescrita a cada provisionamento.
	local codigo_segunda=0
	migrar_isolado "${arq_migracao}" "${porta_pg_sonda}" "${credencial_sintetica}" >/dev/null ||
		codigo_segunda=$?
	afirmar_igual "(n) a segunda migração não tem o que fazer" "1" "${codigo_segunda}"

	# O companheiro negativo, e a razão de a migração ser reconhecida por igualdade
	# LITERAL: um destino de socket com OUTRA porta NÃO é o arquivo que este script
	# deixou, e migrá-lo silenciosamente apagaria a divergência que a conferência de
	# coordenadas existe para denunciar.
	local arq_nao_migravel="${dir_sonda}/ambiente-nao-migravel"
	printf 'DATABASE_URL=postgresql://%s:%s@/%s?host=%s&port=9999\n' \
		"${PAPEL_DB}" "${credencial_sintetica}" "${BANCO_DB}" "${DIR_SOCKET_PG}" >"${arq_nao_migravel}"
	local antes_nao_migravel
	antes_nao_migravel="$(sha256sum "${arq_nao_migravel}" | cut -d' ' -f1)"
	local codigo_nao_migravel=0
	migrar_isolado "${arq_nao_migravel}" "${porta_pg_sonda}" "${credencial_sintetica}" >/dev/null ||
		codigo_nao_migravel=$?
	afirmar_igual "(n) socket com porta divergente da viva NÃO é migrado" "1" "${codigo_nao_migravel}"
	afirmar_igual "(n) e o arquivo não migrável fica byte a byte intacto" \
		"${antes_nao_migravel}" "$(sha256sum "${arq_nao_migravel}" | cut -d' ' -f1)"

	unset -f migrar_isolado

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
#
# As pontas (a) a (e) medem o EFEITO do provisionamento sobre o legado, depois de
# ele ter acontecido. A (g) mede a DECISÃO que impede a colisão de acontecer — o
# guarda de porta —, carregando-a do arquivo real e exercitando-a com dublês, sem
# banco e sem privilégio.
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

	# --- (g) o guarda de colisão decide a posse da porta pelo ESTADO REAL ---- #
	#
	# CAUSA-RAIZ de existir: `conferir_colisao_de_porta` decidia a posse em dois
	# passos — há alguém escutando? a nossa unidade está ativa? — e o segundo
	# tratava "unidade ativa" como PROVA de que a porta é nossa. Isso é verdade
	# para 6380/1025/8025, cujas unidades vinculam a porta ao subir, e é FALSO
	# para o cluster do banco na execução de transição, que é a única que
	# importa: ele fica `active` servindo só pelo socket de domínio Unix enquanto
	# `listen_addresses` estiver vazio. Nesse estado — unidade ativa, porta TCP
	# sem dono — um terceiro na porta do cluster passava como "nossa instância",
	# o P03 reescrevia o sobreposto e o `systemctl restart` falhava ao VINCULAR:
	# um aborto limpo de pré-condição virava um aborto de meio de execução com o
	# cluster desligado, dentro da janela.
	#
	# O cenário é exercitável SEM privilégio e sem banco: o guarda e a prova de
	# posse são carregados do arquivo real (mesma técnica de
	# `carregar_funcoes_do_provisionador`) e as três coisas que eles consultam —
	# a escuta da máquina, o estado da unidade e o cluster em execução — entram
	# como dublês. O que se mede é a DECISÃO, e ela é literal: `ABORTA`,
	# `ACEITA`, ou `ABORTAACEITA` para um guarda que anuncia a recusa e segue
	# assim mesmo.
	#
	# O processo de sonda roda sem `-e` de propósito: com ele, o `head -1` do
	# ramo de aborto fecharia o cano e derrubaria a sonda por SIGPIPE antes de o
	# desfecho ser impresso — medindo a opção do shell em vez do guarda.
	#
	# As variáveis da sonda são MAIÚSCULAS por necessidade, não por estilo: o
	# escopo de `local` no shell é DINÂMICO, então um `local escuta` dentro do SUT
	# sombreia a `escuta` da sonda e o dublê passa a ler o vazio do próprio SUT —
	# um teste que falha sem que haja defeito. Nomes disjuntos evitam a colisão.
	#
	# DECISÃO FECHADA — T7 / 3ª bateria privilegiada · 2026-08-01
	# O QUÊ: o contrato desta sonda é a SAÍDA PADRÃO — `ABORTA`, `ACEITA`,
	#        `ABORTAACEITA` ou `SEM-SUT`. O código de saída dela é ruído e vale
	#        SEMPRE 0, em qualquer desfecho, inclusive quando o processo interno
	#        morre. Desfecho fora dos quatro vira o rótulo `SONDA-QUEBRADA[...]`,
	#        que carrega o código e a saída bruta.
	# POR QUÊ: enquanto o código do guarda vazava para fora, um sítio de chamada
	#        em ATRIBUIÇÃO SIMPLES — `desfecho="$(sondar_guarda_de_porta ...)"` —
	#        herdava o 1 do `abortar` do dublê, e o `set -Eeuo pipefail` do topo
	#        deste arquivo matava o verificador EM SILÊNCIO no meio do CT-005: sem
	#        as asserções (g), sem resumo, com a bateria agregadora reportando
	#        apenas "saiu 1". Foi a TERCEIRA manifestação da mesma classe — as
	#        opções e o escopo do próprio verificador interferindo na sonda que
	#        carrega o SUT; antes foram o escopo dinâmico do `local` e o
	#        `readonly` herdado por subshell. As duas anteriores foram fechadas
	#        POR SÍTIO; esta é fechada no contrato, que é o que impede a quarta:
	#        nenhum sítio de chamada, presente ou futuro, precisa lembrar de
	#        `|| true` nem de `|| codigo=$?`, em posição sintática nenhuma.
	# REVERTER EXIGE: provar que TODO sítio de chamada — inclusive os que ainda
	#        não existem — está em posição onde o código de saída não alcança o
	#        `set -e` (argumento de comando, condição de `if`, lado esquerdo de
	#        `||`), e que nenhuma asserção observa o desfecho pelo código.
	sondar_guarda_de_porta() { # $1 unidade ativa (1/0) · $2 listen_addresses · $3 porta viva · $4 prova de posse (ou vazio)
		local desfecho_bruto="" codigo_bruto=0
		desfecho_bruto="$(bash -c '
			set -uo pipefail
			SUT="$1" SONDA_UNIDADE_ATIVA="$2" SONDA_ESCUTA="$3" SONDA_PORTA_VIVA="$4" SONDA_PROVA="$5"
			SONDA_PORTA=5432

			eval "$(sed -n "/^conferir_colisao_de_porta() {/,/^}/p" "${SUT}")"
			eval "$(sed -n "/^cluster_escuta_na_porta() {/,/^}/p" "${SUT}")"
			if [[ "$(type -t conferir_colisao_de_porta)" != function ||
				"$(type -t cluster_escuta_na_porta)" != function ]]; then
				printf "SEM-SUT"
				exit 0
			fi

			# A escuta da máquina: um TERCEIRO ocupa a porta guardada.
			ss() {
				case " $* " in
				*"sport = :${SONDA_PORTA}"*)
					printf "LISTEN 0 511 0.0.0.0:%s 0.0.0.0:* users:((\"processo-terceiro\",pid=99999,fd=6))\n" \
						"${SONDA_PORTA}" ;;
				*) return 0 ;;
				esac
			}
			unidade_ativa() { [[ "${SONDA_UNIDADE_ATIVA}" == "1" ]]; }
			# O cluster em execução, respondendo o que a sonda mandar.
			runuser() {
				case " $* " in
				*"SHOW listen_addresses"*) printf "%s\n" "${SONDA_ESCUTA}" ;;
				*"SHOW port"*) printf "%s\n" "${SONDA_PORTA_VIVA}" ;;
				*) return 1 ;;
				esac
			}
			info() { :; }
			# Devolve != 0 em vez de encerrar, para que um guarda que anunciasse a
			# recusa e SEGUISSE adiante apareça como ABORTAACEITA, e não como ABORTA.
			abortar() { printf "ABORTA"; return 1; }

			if [[ -n "${SONDA_PROVA}" ]]; then
				conferir_colisao_de_porta "${SONDA_PORTA}" "postgresql@18-main.service" "remedio" "${SONDA_PROVA}" &&
					printf "ACEITA"
			else
				conferir_colisao_de_porta "${SONDA_PORTA}" "postgresql@18-main.service" "remedio" &&
					printf "ACEITA"
			fi
		' _ "${SCRIPT_PROVISIONAR}" "$1" "$2" "$3" "$4")" || codigo_bruto=$?

		# Desfecho fora dos quatro conhecidos NÃO segue adiante como se fosse um
		# deles: vira um rótulo que NOMEIA a causa. Sem isto, a sonda que morre
		# antes de imprimir devolve cadeia vazia, e a asserção reprova comparando
		# `[]` contra `[ABORTA]` — diagnóstico que não distingue "o guarda decidiu
		# errado" de "a sonda nem chegou a rodar".
		case "${desfecho_bruto}" in
		ABORTA | ACEITA | ABORTAACEITA | SEM-SUT) printf '%s' "${desfecho_bruto}" ;;
		*) printf 'SONDA-QUEBRADA[codigo=%s saida=%s]' "${codigo_bruto}" "${desfecho_bruto:-<vazia>}" ;;
		esac
		return 0
	}

	# A PRIMEIRA chamada usa unidade inativa de propósito: é a que confirma que o
	# SUT foi carregado, e o desfecho dela decide se a tabela abaixo tem objeto.
	local desfecho
	desfecho="$(sondar_guarda_de_porta 0 "" "" cluster_escuta_na_porta)"
	case "${desfecho}" in
	SEM-SUT)
		falhar "(g) não consegui carregar 'conferir_colisao_de_porta' e 'cluster_escuta_na_porta' de ${SCRIPT_PROVISIONAR} — sem elas a tabela ficaria sem SUT e passaria vazia"
		;;
	SONDA-QUEBRADA*)
		# O ramo que existe para que o modo de falha SILENCIOSO nunca volte. Ele é
		# alcançado quando a sonda não devolve nenhum dos quatro desfechos — foi
		# exatamente o estado em que o `set -e` derrubava o verificador sem dizer
		# por quê, deixando as pontas (g) sem imprimir e o resumo sem sair.
		falhar "(g) a sonda do guarda de colisão não devolveu nenhum dos quatro desfechos conhecidos (ABORTA/ACEITA/ABORTAACEITA/SEM-SUT) — obtive ${desfecho}. O processo da sonda terminou antes de imprimir: releia o cabeçalho de 'sondar_guarda_de_porta' e o erro-padrão acima antes de mexer nas asserções abaixo"
		;;
	*)
		ok "(g) guarda de colisão e prova de posse do cluster carregados de ${SCRIPT_PROVISIONAR##*/}"

		# O ESTADO DA TRANSIÇÃO, e a razão de a ponta existir: unidade ativa e
		# `listen_addresses` vazio — o cluster não escuta em TCP em lugar nenhum,
		# logo nenhum ouvinte de porta TCP pode ser nosso.
		afirmar_igual "(g) unidade ativa mas cluster SEM escuta em TCP: a porta ocupada NÃO é nossa e o guarda aborta" \
			"ABORTA" "$(sondar_guarda_de_porta 1 "" "" cluster_escuta_na_porta)"

		# Companheiro positivo. Sem ele, a asserção acima passaria com um guarda
		# que abortasse sempre — e a segunda execução do provisionamento, que a
		# ADR-0005 exige idempotente, abortaria contra o próprio cluster.
		afirmar_igual "(g) unidade ativa e cluster escutando na porta guardada: é nossa instância, o guarda segue" \
			"ACEITA" "$(sondar_guarda_de_porta 1 "127.0.0.1" "5432" cluster_escuta_na_porta)"

		# Escuta em TCP, mas noutra porta: o 'port' de postgresql.conf mudou sem
		# reinício, e a porta sob guarda não é a que o cluster de fato abriu.
		afirmar_igual "(g) cluster escutando em OUTRA porta: a porta guardada não é nossa e o guarda aborta" \
			"ABORTA" "$(sondar_guarda_de_porta 1 "127.0.0.1" "5433" cluster_escuta_na_porta)"

		# `localhost` e `*` são escuta em TCP tanto quanto o endereço literal —
		# recusá-las transformaria uma reexecução legítima em aborto.
		afirmar_igual "(g) cluster escutando por 'localhost' na porta guardada: continua sendo nossa instância" \
			"ACEITA" "$(sondar_guarda_de_porta 1 "localhost" "5432" cluster_escuta_na_porta)"

		# Unidade inativa segue abortando, com prova ou sem ela.
		afirmar_igual "(g) unidade do cluster inativa: a porta ocupada é de terceiro e o guarda aborta" \
			"ABORTA" "$(sondar_guarda_de_porta 0 "127.0.0.1" "5432" cluster_escuta_na_porta)"

		# As três portas fixas NÃO ganharam a prova extra: as unidades delas
		# vinculam a porta ao subir, e exigir prova ali quebraria a 2ª execução.
		afirmar_igual "(g) porta fixa, sem prova extra: unidade ativa continua bastando" \
			"ACEITA" "$(sondar_guarda_de_porta 1 "" "" "")"
		afirmar_igual "(g) porta fixa, sem prova extra: unidade inativa continua abortando" \
			"ABORTA" "$(sondar_guarda_de_porta 0 "" "" "")"
		;;
	esac

	unset -f sondar_guarda_de_porta

	fechar_caso "CT-005"
}

# =========================================================================== #
# CT-030 — No cluster real, os quatro papéis existem e nenhum deles tem
#          privilégio capaz de contornar o isolamento.
#
# O CT-001 da suíte de `packages/db` cobre a mesma classe de invariante contra uma
# instância EFÊMERA (`embedded-postgres` em versão beta). Os dois são necessários,
# e a duplicação está justificada na §20 da tech spec: o comportamento de uma
# versão beta pode divergir do cluster real, e é no cluster real que a operação
# acontece. Aqui, além disso, existe algo que não existe lá — o estado deixado
# pelos passos P15 e P16 do provisionamento.
#
# A asserção é por ATRIBUTO e por PAPEL, e não por presença do papel. Não é a
# existência que interessa: é a AUSÊNCIA de cada capacidade que faria a política
# de linha deixar de valer — `rolsuper` (ignora sempre), `rolbypassrls` (ignora
# sempre), `rolcreaterole` (concede a si mesmo o que quiser) e o pertencimento do
# papel da aplicação ao papel dono (herdaria a propriedade das tabelas, e com ela
# a isenção que só `FORCE` fecharia).
#
# Os schemas entram no mesmo caso porque nascem do MESMO par de passos e porque
# a propriedade que interessa neles é a mesma: dono errado no schema faz as
# tabelas nascerem do papel errado, e o isolamento volta a depender de com qual
# papel alguém conectou.
#
# --------------------------------------------------------------------------- #
# Os papéis de TRAVESSIA NOMINAL, e por que são os mais sensíveis de todos
# --------------------------------------------------------------------------- #
#
# A T3 da sub-fatia `documentos-e-confirmacao` acrescentou ao P15 o papel
# `sysloc_resolucao`: `NOLOGIN`, sem credencial, dono de UMA função
# `SECURITY DEFINER` — a que resolve o portador de confirmação. Ele é o único
# papel do produto para o qual a política de linha da tabela do portador é
# NOMINALMENTE atravessável, e por isso a lista de papéis conferidos aqui deixou
# de ser literal-de-dois: um papel de fora da enumeração não fica vermelho, ele
# fica INVISÍVEL.
#
# Três propriedades entram, e cada uma fecha um cenário que a bateria não
# detectaria de outro jeito:
#
#   1. os atributos dele, mais o `rolcanlogin` — o P15 só cria o papel quando
#      ele está AUSENTE, e o bloco `DO` da migração `0014` confere apenas o
#      NOME. Um `sysloc_resolucao` preexistente com `LOGIN` ou `BYPASSRLS`
#      viraria dono da função `DEFINER` sem que nada acusasse;
#   2. `sysloc_app` NÃO é membro dele — é a única concessão que, sozinha, daria
#      ao papel que atende requisição leitura irrestrita daquela tabela pela
#      política nominal, e ela não produziria erro nenhum;
#   3. a membership do migrador nele é `INHERIT FALSE` — é o que mantém a
#      leitura irrestrita atrás de um `SET ROLE` deliberado em vez de acontecer
#      por herança em consulta comum.
#
# O `CT-735` de `packages/db` afirma a propriedade 1 por igualdade, mas contra o
# provisionamento EFÊMERO de `banco-efemero.ts` — outro caminho de código, que
# por construção não detecta deriva de `provisionar-base.sh`. É a mesma divisão
# de trabalho que o parágrafo acima declara para o CT-001: os dois são
# necessários, e é este que olha para o cluster onde a operação acontece.
#
# --------------------------------------------------------------------------- #
# O QUARTO papel — e por que a advertência acima teve de ser cobrada de fato
# --------------------------------------------------------------------------- #
#
# A T3 da fatia `webhook-e-carne` acrescentou ao P15 o papel `sysloc_roteamento`:
# gêmeo do de resolução em tudo — `NOLOGIN`, sem credencial, dono de UMA função
# `SECURITY DEFINER`, a que roteia a notícia bancária recebida do provedor
# (migração `0020`) — e papel PRÓPRIO, e não o reuso do terceiro, porque reusá-lo
# faria um mesmo papel alcançar DUAS tabelas e diluiria o `GRANT` mínimo que a
# emenda de 2026-08-13 da ADR-0024 exige.
#
# Ele nasceu FORA da enumeração deste caso, que é exatamente o modo de falha
# descrito acima: a bateria não ficou vermelha, ficou cega. As três propriedades
# do papel de resolução valem para ele **uma a uma**, e a segunda com raio MAIOR:
# a política nominal da `0020` alcança `negocio.cobranca`, de modo que um
# `GRANT sysloc_roteamento TO sysloc_app` daria ao papel que atende TODA
# requisição HTTP a leitura da cobrança de TODAS as empresas — e, como no irmão,
# sem produzir erro algum. Por isso as asserções abaixo passam a percorrer os
# quatro papéis, e a não-pertinência e a forma `INHERIT FALSE` são escritas para
# os DOIS papéis de travessia nominal.
#
# O `CT-973` de `packages/db` afirma os ATRIBUTOS e os PRIVILÉGIOS do papel novo
# por igualdade, e é ele que mede *"a única tabela alcançada"*; o que ele não
# afirma — e não teria como, por correr contra o provisionamento efêmero — é a
# membership de TERCEIROS nele no agrupamento durável. É a divisão de trabalho
# do parágrafo anterior, e é esta metade que mora aqui.
# =========================================================================== #
ct_030() {
	caso "CT-030" "No cluster real, os quatro papéis existem e nenhum deles tem privilégio capaz de contornar o isolamento"

	if ! command -v psql >/dev/null 2>&1 || ! getent passwd postgres >/dev/null 2>&1; then
		falhar "o cliente do banco ou o usuário 'postgres' não existem nesta máquina — depois do provisionamento os dois têm de existir, e sem eles este caso não tem como consultar o catálogo"
		fechar_caso "CT-030"
		return
	fi

	# `-A -t` rende booleano como `t`/`f`. Nenhuma consulta aqui carrega segredo:
	# são todas leituras do catálogo do sistema.
	consulta_cluster() { runuser -u postgres -- psql -X -q -A -t -c "$1" 2>/dev/null || printf 'INDISPONIVEL'; }
	consulta_banco() { runuser -u postgres -- psql -X -q -A -t -d "${BANCO_DB}" -c "$1" 2>/dev/null || printf 'INDISPONIVEL'; }

	# (a) os quatro papéis existem -------------------------------------------- #
	afirmar_igual "(a) contagem de papéis encontrados entre '${PAPEL_DB}', '${PAPEL_MIGRACAO}', '${PAPEL_RESOLUCAO}' e '${PAPEL_ROTEAMENTO}'" "4" \
		"$(consulta_cluster "SELECT count(*) FROM pg_roles WHERE rolname IN ('${PAPEL_DB}', '${PAPEL_MIGRACAO}', '${PAPEL_RESOLUCAO}', '${PAPEL_ROTEAMENTO}')")"

	# (b) nenhum atributo capaz de contornar a política ----------------------- #
	#
	# Uma asserção por PAPEL e por ATRIBUTO, e não uma linha inteira comparada de
	# uma vez: com a comparação agregada, a reprovação diria "esperado f|f|f,
	# obtido f|t|f" e o operador teria de contar colunas para saber o que está
	# ligado. Assim o resumo em stderr já nomeia o papel e o atributo.
	local papel atributo valor
	for papel in "${PAPEL_DB}" "${PAPEL_MIGRACAO}" "${PAPEL_RESOLUCAO}" "${PAPEL_ROTEAMENTO}"; do
		for atributo in rolsuper rolbypassrls rolcreaterole; do
			valor="$(consulta_cluster "SELECT ${atributo} FROM pg_roles WHERE rolname = '${papel}'")"
			afirmar_igual "(b) ${papel}: ${atributo} desligado" "f" "${valor}"
		done
	done

	# `rolcanlogin` só é afirmado para os DOIS papéis de travessia nominal: eles
	# são os únicos `NOLOGIN` dos quatro, e os outros dois existem justamente para
	# atender conexão. É a diferença que mais importa — um `sysloc_resolucao` ou um
	# `sysloc_roteamento` capaz de logar seria um caminho de conexão com travessia
	# nominal da política.
	afirmar_igual "(b) ${PAPEL_RESOLUCAO}: rolcanlogin desligado" "f" \
		"$(consulta_cluster "SELECT rolcanlogin FROM pg_roles WHERE rolname = '${PAPEL_RESOLUCAO}'")"
	afirmar_igual "(b) ${PAPEL_ROTEAMENTO}: rolcanlogin desligado" "f" \
		"$(consulta_cluster "SELECT rolcanlogin FROM pg_roles WHERE rolname = '${PAPEL_ROTEAMENTO}'")"

	# (c) o papel da aplicação não pertence a nenhum dos outros três ---------- #
	#
	# Entre o papel da aplicação e o papel dono, os dois sentidos são afirmados.
	# O que importa de verdade é o primeiro — o papel que atende requisição
	# herdando a propriedade das tabelas —, mas o inverso também quebraria a
	# separação: o dono passaria a alcançar o que quer que seja concedido ao
	# papel da aplicação, e a topologia de papéis separados viraria um papel com
	# dois nomes.
	afirmar_igual "(c) '${PAPEL_DB}' NÃO é membro de '${PAPEL_MIGRACAO}'" "f" \
		"$(consulta_cluster "SELECT pg_has_role('${PAPEL_DB}', '${PAPEL_MIGRACAO}', 'MEMBER')")"
	afirmar_igual "(c) '${PAPEL_MIGRACAO}' NÃO é membro de '${PAPEL_DB}'" "f" \
		"$(consulta_cluster "SELECT pg_has_role('${PAPEL_MIGRACAO}', '${PAPEL_DB}', 'MEMBER')")"

	# O papel que atende requisição também não pertence aos papéis de travessia
	# nominal, e estas são as asserções mais importantes de todas: `pg_has_role` é
	# TRANSITIVO, de modo que cada uma recusa tanto a concessão direta quanto a que
	# chegasse por um papel intermediário. Uma concessão futura aqui daria a
	# `sysloc_app` leitura irrestrita da tabela alcançada pela política nominal — a
	# empresa inteira, sem contexto —, e não produziria erro algum.
	afirmar_igual "(c) '${PAPEL_DB}' NÃO é membro de '${PAPEL_RESOLUCAO}'" "f" \
		"$(consulta_cluster "SELECT pg_has_role('${PAPEL_DB}', '${PAPEL_RESOLUCAO}', 'MEMBER')")"

	# A mesma asserção para o papel de roteamento, e aqui o raio é MAIOR: a tabela
	# que a política nominal da `0020` alcança é `negocio.cobranca`, e não o
	# portador de confirmação. `GRANT sysloc_roteamento TO sysloc_app` daria ao
	# papel que atende TODA requisição HTTP, via `SET ROLE` e `USING (true)`, a
	# leitura da cobrança de TODAS as empresas.
	afirmar_igual "(c) '${PAPEL_DB}' NÃO é membro de '${PAPEL_ROTEAMENTO}'" "f" \
		"$(consulta_cluster "SELECT pg_has_role('${PAPEL_DB}', '${PAPEL_ROTEAMENTO}', 'MEMBER')")"

	# A membership que EXISTE de propósito — a do migrador — é conferida na
	# forma, e não só na presença. `INHERIT FALSE` é o que a torna mínima: o
	# migrador pode ASSUMIR o papel para executar o `ALTER … OWNER TO` da `0014`,
	# mas não herda os privilégios dele em consulta comum. Concedida com o
	# `INHERIT` do banco (`t`), a leitura irrestrita passaria a acontecer por
	# herança, sem `SET ROLE` e sem nenhuma linha nova em lugar nenhum.
	#
	# `pg_auth_members` é a concessão DIRETA, e por isso o sentinela `AUSENTE`:
	# sem ele, a membership sumida devolveria vazio e a asserção compararia ""
	# com "f", reprovando por motivo ilegível. `CASE` em vez de `::text` porque
	# `-A -t` rende booleano como `t`/`f`, e o cast renderia `true`/`false`.
	afirmar_igual "(c) a membership de '${PAPEL_MIGRACAO}' em '${PAPEL_RESOLUCAO}' existe e é INHERIT FALSE" "f" \
		"$(consulta_cluster "SELECT coalesce((SELECT CASE WHEN m.inherit_option THEN 't' ELSE 'f' END FROM pg_auth_members m JOIN pg_roles concedido ON concedido.oid = m.roleid JOIN pg_roles membro ON membro.oid = m.member WHERE concedido.rolname = '${PAPEL_RESOLUCAO}' AND membro.rolname = '${PAPEL_MIGRACAO}'), 'AUSENTE')")"

	# A mesma forma, pela mesma razão, na membership que a `0020` exige para trocar
	# o dono da função de roteamento. Concedida com o `INHERIT` do banco (`t`), a
	# leitura irrestrita de `negocio.cobranca` passaria a acontecer por herança em
	# consulta comum do migrador, sem `SET ROLE` e sem nenhuma linha nova.
	afirmar_igual "(c) a membership de '${PAPEL_MIGRACAO}' em '${PAPEL_ROTEAMENTO}' existe e é INHERIT FALSE" "f" \
		"$(consulta_cluster "SELECT coalesce((SELECT CASE WHEN m.inherit_option THEN 't' ELSE 'f' END FROM pg_auth_members m JOIN pg_roles concedido ON concedido.oid = m.roleid JOIN pg_roles membro ON membro.oid = m.member WHERE concedido.rolname = '${PAPEL_ROTEAMENTO}' AND membro.rolname = '${PAPEL_MIGRACAO}'), 'AUSENTE')")"

	# (d) os três schemas, com dono e uso -------------------------------------- #
	#
	# O laço percorre a lista literal, e não o que o catálogo devolver: derivá-la de
	# `pg_namespace` faria o esperado vir da mesma fonte que o obtido, e um schema
	# que nunca tivesse sido criado sairia da varredura junto com a asserção que o
	# cobraria. É o mesmo motivo pelo qual `TABELAS_DE_NEGOCIO_ESPERADAS` de
	# `verificar-migracao.sh` é escrita à mão.
	local schema
	for schema in "${SCHEMA_IDENTIDADE}" "${SCHEMA_NEGOCIO}" "${SCHEMA_PLATAFORMA}"; do
		afirmar_igual "(d) o schema '${schema}' pertence a '${PAPEL_MIGRACAO}'" "${PAPEL_MIGRACAO}" \
			"$(consulta_banco "SELECT coalesce((SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner WHERE n.nspname = '${schema}'), 'AUSENTE')")"
		afirmar_igual "(d) '${PAPEL_DB}' alcança o schema '${schema}'" "t" \
			"$(consulta_banco "SELECT has_schema_privilege('${PAPEL_DB}', '${schema}', 'USAGE')")"
		afirmar_igual "(d) '${PAPEL_DB}' NÃO cria objeto no schema '${schema}'" "f" \
			"$(consulta_banco "SELECT has_schema_privilege('${PAPEL_DB}', '${schema}', 'CREATE')")"
	done

	# (e) o papel de migração alcança o banco --------------------------------- #
	afirmar_igual "(e) '${PAPEL_MIGRACAO}' pode conectar em '${BANCO_DB}'" "t" \
		"$(consulta_cluster "SELECT has_database_privilege('${PAPEL_MIGRACAO}', '${BANCO_DB}', 'CONNECT')")"

	unset -f consulta_cluster consulta_banco

	fechar_caso "CT-030"
}

# =========================================================================== #
# --------------------------------------------------------------------------- #
# CT-647 — o acréscimo de chave nasce em linha própria, mesmo sem quebra final
#
# A rede do D40 (F3/T8), fechada pela intervenção dirigida de 2026-08-12. Ela não
# exige privilégio nenhum de si: `acrescentar_linha_ao_ambiente` e
# `garantir_chaves_de_conteudo` só fazem `grep` e `printf` sobre um caminho recebido
# por parâmetro. O `sudo` vem do `main` deste verificador, não deste caso.
#
# As duas funções são carregadas do provisionador pelo mesmo idioma que os casos
# vizinhos usam (`eval` do corpo extraído por `sed`) — o provisionador termina em
# `main "$@"` e não pode ser lido por `source`.
# --------------------------------------------------------------------------- #
ct_647() {
	caso "CT-647" "Chave acrescentada nasce em linha própria mesmo sem quebra final, e não corrompe a anterior"

	local arq="${DIR_TEMPORARIO}/ambiente-sem-quebra.env"

	# O ARRANJO que discrimina: última linha SEM `\n` final, que é o arquivo editado
	# à mão por editor que não a acrescenta. Com `printf … >>` cru, o acréscimo cola.
	printf 'DATABASE_URL=postgresql://a:b@127.0.0.1:5432/c\nSMTP_URL=smtp://127.0.0.1:1025' >"${arq}"

	# ⚠️ As constantes de valor padrão são declaradas AQUI, uma por chave que
	# `garantir_chaves_de_conteudo` semeia, e a lista cresce com ela: sob `set -u`,
	# uma constante que ficasse para trás derrubaria o subshell e o `|| falhar`
	# abaixo nomearia o desfecho. Foram duas na T9 de `documentos-e-confirmacao`,
	# três desde a T11 de `fundacao-bancaria` (o endereço do provedor) e são quatro
	# desde a T9 de `emissao-e-conciliacao` (o diretório dos boletos).
	(
		REMETENTE_PADRAO_DO_AVISO="avisos@sysloc.invalid"
		URL_BASE_PADRAO_DA_CONFIRMACAO="https://sysloc.invalid"
		ENDERECO_PADRAO_DO_PROVEDOR_BANCARIO="https://provedor.sysloc.invalid"
		DIR_BOLETOS="/var/lib/sysloc-boletos"
		eval "$(sed -n '/^acrescentar_linha_ao_ambiente() {/,/^}/p' "${SCRIPT_PROVISIONAR}")"
		eval "$(sed -n '/^garantir_chaves_de_conteudo() {/,/^}/p' "${SCRIPT_PROVISIONAR}")"
		[[ "$(type -t acrescentar_linha_ao_ambiente)" == "function" ]] || exit 8
		[[ "$(type -t garantir_chaves_de_conteudo)" == "function" ]] || exit 8
		garantir_chaves_de_conteudo "${arq}"
	) || falhar "a semeadura abortou sobre o arquivo sem quebra final"

	# A ASSERÇÃO que pega o defeito: a chave semeada tem de existir em linha PRÓPRIA.
	afirmar_igual "a chave semeada nasce em linha própria" \
		"1" "$(grep -c '^EMAIL_REMETENTE=avisos@sysloc.invalid$' "${arq}")"

	# A SEGUNDA chave de conteúdo (T9): o acréscimo em sequência é o caso em que o
	# defeito do D40 reapareceria — a primeira linha acrescentada passa a ser a
	# "última linha" da segunda, e é ela que a colagem corromperia.
	afirmar_igual "a segunda chave semeada nasce em linha própria" \
		"1" "$(grep -c '^URL_BASE_DA_CONFIRMACAO=https://sysloc.invalid$' "${arq}")"

	# A OUTRA metade do dano, e ela é independente: colada, a linha anterior deixaria
	# de casar consigo mesma e a execução seguinte abortaria acusando divergência de
	# `SMTP_URL` — mandando o operador corrigir uma linha que a execução anterior quebrou.
	afirmar_igual "a linha anterior sobrevive intacta" \
		"1" "$(grep -c '^SMTP_URL=smtp://127.0.0.1:1025$' "${arq}")"

	# O CONTROLE: sobre arquivo que JÁ termina em quebra, nada de quebra em dobro —
	# senão a correção trocaria um defeito por outro (linha vazia acumulando a cada
	# execução idempotente).
	local arq_ok="${DIR_TEMPORARIO}/ambiente-com-quebra.env"
	printf 'SMTP_URL=smtp://127.0.0.1:1025\n' >"${arq_ok}"
	(
		REMETENTE_PADRAO_DO_AVISO="avisos@sysloc.invalid"
		URL_BASE_PADRAO_DA_CONFIRMACAO="https://sysloc.invalid"
		ENDERECO_PADRAO_DO_PROVEDOR_BANCARIO="https://provedor.sysloc.invalid"
		DIR_BOLETOS="/var/lib/sysloc-boletos"
		eval "$(sed -n '/^acrescentar_linha_ao_ambiente() {/,/^}/p' "${SCRIPT_PROVISIONAR}")"
		eval "$(sed -n '/^garantir_chaves_de_conteudo() {/,/^}/p' "${SCRIPT_PROVISIONAR}")"
		garantir_chaves_de_conteudo "${arq_ok}"
	) || falhar "a semeadura abortou sobre o arquivo com quebra final"

	# O esperado é a linha preexistente MAIS uma por chave de conteúdo semeada, e
	# nada além: linha vazia entre elas apareceria aqui como contagem a mais. O
	# valor é função de quantas `garantir_chaves_de_conteudo` semeia, e não uma
	# constante do arranjo: 2 → 3 na T9 de `documentos-e-confirmacao` (a segunda
	# chave), 3 → 4 na T11 de `fundacao-bancaria` (o endereço do provedor) e 4 → 5
	# na T9 de `emissao-e-conciliacao` (o diretório dos boletos).
	afirmar_igual "arquivo já terminado em quebra não ganha linha vazia" \
		"5" "$(grep -c . "${arq_ok}")"

	fechar_caso "CT-647"
}

# --------------------------------------------------------------------------- #
# Pré-condição de ambiente da CONVERSÃO DO MATERIAL DO CERTIFICADO (ADR-0036).
#
# CAUSA-RAIZ de existir: a Autoridade Certificadora entrega o `.pfx` embalado em
# cifra legada, e o produto passou a convertê-lo na borda de registro invocando
# o binário de criptografia do HOST. A ADR-0036 registra a consequência entre os
# `Cons`: *"o produto passa a depender de binário do host: presença, versão e
# caminho viram pré-condição de operação, e precisam ser afirmados pelo
# provisionamento"*. Sem esta afirmação, um host provisionado sem o recurso sai
# VERDE, e a falta só aparece quando o Admin renova o certificado pela tela —
# tarde, remoto, e com a mesma cara do defeito que o `D64` já tinha.
#
# POR QUE AS DUAS METADES, e não só a presença do binário: o modo de falha real
# é o binário PRESENTE com o provider legado indisponível. Ele responde a tudo,
# a instalação parece completa, e a conversão falha exatamente como falhava
# antes. Um guarda que se contentasse com `command -v openssl` ficaria verde
# justamente no host que quebra.
#
# POR QUE ELA É FUNÇÃO NOMEADA, AUTOCONTIDA E SEM ESTADO DA BATERIA: é o que
# permite exercitá-la SEM privilégio, extraindo o corpo por `sed`+`eval` num
# processo novo — o mesmo mecanismo do `ct_647` e do `executar_guarda_isolado`
# do CT-005. Função que dependesse de variável montada pelo `main` só se provaria
# como root, e o caso ficaria sem prova. Ela não chama `ok`, `falhar` nem `nota`
# pela mesma razão: quem a extrai não carrega o esqueleto de asserções junto.
#
# POR QUE SÓ BUILTIN ALÉM DO PRÓPRIO `openssl`: `command -v`, `[[ =~ ]]` e
# `printf` sobrevivem ao PATH recortado do mutante A, onde não há `grep` algum.
# Depender de `grep` faria o caso reprovar por ferramenta ausente e não pelo
# recurso ausente — a asserção passaria pelo motivo errado.
#
# NENHUM SEGREDO E NENHUM CAMINHO DE MATERIAL saem daqui: o que se imprime é o
# nome do recurso que falta e a versão do binário, nada mais.
#
# Devolve 0 quando o host converte, 1 quando não converte — e a linha impressa
# NOMEIA o recurso ausente, porque quem lê o vermelho precisa saber o que
# instalar.
# --------------------------------------------------------------------------- #
criptografia_do_host_apta() {
	local listagem="" versao=""

	if ! command -v openssl >/dev/null 2>&1; then
		printf 'FALTA o binario openssl no PATH deste host — a conversao do material do certificado (ADR-0036) o invoca; instale o pacote openssl do sistema\n'
		return 1
	fi

	# A listagem é pedida COM o provider nomeado: no OpenSSL 3 o legado não
	# aparece na listagem padrão nem quando está instalado — só quando carregado
	# sob demanda, que é como a conversão o usa (`openssl pkcs12 -legacy`).
	# Medir a listagem padrão reprovaria todo host apto.
	#
	# As DUAS pernas contam: o comando pode falhar (provider inexistente) ou
	# suceder devolvendo apenas o padrão. O casamento exige a palavra delimitada
	# por espaço em branco, de modo que o "Legacy" do nome descritivo — que sai
	# com maiúscula — não sirva de verde por engano.
	if ! listagem="$(openssl list -providers -provider legacy 2>/dev/null)" ||
		[[ ! "${listagem}" =~ (^|[[:space:]])legacy([[:space:]]|$) ]]; then
		printf 'FALTA o provider legacy no openssl deste host — sem ele o material que a AC entrega nao abre; instale o componente legacy do openssl\n'
		return 1
	fi

	versao="$(openssl version 2>/dev/null)"
	printf 'openssl apto: %s, com o provider legacy disponivel\n' "${versao}"
	return 0
}

# --------------------------------------------------------------------------- #
# CT-1045 — a pré-condição acima é afirmada, e a ausência REPROVA nomeando o
# recurso. Controle e mutantes com desfechos OPOSTOS.
#
# Um verificador que nunca reprovasse aprovaria um host sem o binário; um que
# reprovasse sempre reprovaria o host apto. Nenhum dos dois passa nos três
# ambientes deste caso, e é o PAR que detecta — não a asserção isolada.
#
# O mutante é AMBIENTE, nunca código: `PATH` recortado e um stub executável
# escrito na caixa de areia, removida pelo `trap limpar`. Nada é instalado,
# desinstalado ou alterado no sistema operacional, e a árvore versionada não é
# tocada. Por isso o caso roda SEM privilégio, ainda que a bateria exija root
# para os outros.
#
# ⚠️ O caso NÃO deve virar asserção sobre o texto do script (`grep` no fonte
# procurando a chamada a `openssl`): isso provaria a presença da linha, não que
# a ausência do recurso reprova.
# --------------------------------------------------------------------------- #
ct_1045() {
	caso "CT-1045" "a pré-condição de criptografia do host é afirmada, e a ausência REPROVA nomeando o recurso"

	local caixa="${DIR_TEMPORARIO}/pre-condicao"
	local vazio="${caixa}/vazio"
	local stub="${caixa}/stub"
	local saida="${caixa}/saida.txt"
	local corpo=""

	# A EXTRAÇÃO acontece AQUI FORA, antes de qualquer recorte de PATH: dentro do
	# ambiente do mutante A não há `sed` para extrair coisa alguma. E extrair é o
	# ponto — reimplementar o guarda dentro do verificador é o defeito nº 2
	# registrado na `.claude/rules/testing-stack.md`, que aprovou 5/5 um SUT com
	# o defeito de volta.
	corpo="$(sed -n '/^criptografia_do_host_apta() {/,/^}/p' "${BASH_SOURCE[0]}")"
	if [[ -z "${corpo}" ]]; then
		falhar "a função sob prova não foi encontrada neste arquivo — nada pôde ser medido"
		fechar_caso "CT-1045"
		return
	fi

	install -d -m 0700 "${caixa}" "${vazio}" "${stub}"

	# UMA função de invocação para os três ambientes. Duas funções parecidas
	# provariam que duas invocações concordam, não que ESTA discrimina.
	#
	# Processo NOVO (`bash -c`), e não subshell `( )`, pelo motivo do
	# `executar_guarda_isolado` do CT-005 mais um que é próprio daqui: o bash
	# guarda em tabela o caminho já resolvido de cada comando executado, e o
	# subshell a herda — `command -v openssl` responderia pelo cache mesmo com o
	# PATH recortado, e o mutante A passaria pelo motivo errado. Processo novo
	# nasce com a tabela vazia, e o PATH aplicado dentro dele não escapa para a
	# variante seguinte.
	desfecho_da_pre_condicao() { # $1 = PATH a aplicar
		local codigo=0
		bash -c '
			PATH="$1"
			export PATH
			eval "$2"
			[ "$(type -t criptografia_do_host_apta)" = "function" ] || exit 8
			criptografia_do_host_apta
		' _ "$1" "${corpo}" >"${saida}" 2>&1 || codigo=$?
		printf '%s' "${codigo}"
	}

	# --- CONTROLE, e ele vem primeiro ------------------------------------- #
	# Sem esta perna, uma pré-condição que reprovasse SEMPRE passaria nas duas
	# seguintes — e o provisionamento reprovaria todo host, inclusive o apto.
	local codigo_controle=""
	codigo_controle="$(desfecho_da_pre_condicao "${PATH}")"
	afirmar_igual "a pré-condição aprova o host provisionado" "0" "${codigo_controle}"
	if [[ "${codigo_controle}" != "0" ]]; then
		nota "$(cat "${saida}")"
	fi
	# Ancoradas na linha de APROVAÇÃO, pela mesma razão das do mutante A: os
	# literais `openssl` e `legacy` aparecem também nas linhas de reprovação, e
	# um `grep` solto ficaria verde sobre uma pré-condição que RECUSOU o host
	# apto. Medido sobre o mutante que lê a listagem padrão de providers.
	afirmar_igual "a linha de aprovação nomeia o binário conferido" "1" \
		"$(grep -c '^openssl apto:' "${saida}" || true)"
	afirmar_igual "a linha de aprovação nomeia o provider conferido" "1" \
		"$(grep -c 'provider legacy disponivel' "${saida}" || true)"

	# --- MUTANTE A — binário ausente -------------------------------------- #
	local codigo_sem_binario=""
	codigo_sem_binario="$(desfecho_da_pre_condicao "${vazio}")"
	afirmar_igual "binário de criptografia ausente REPROVA" "1" "${codigo_sem_binario}"
	# O padrão casa a linha de REPROVAÇÃO inteira, e não só o literal `openssl`:
	# a linha de aprovação também nomeia o binário, de modo que um `grep` pelo
	# literal solto ficaria verde sobre uma pré-condição que APROVOU — a asserção
	# passaria sem poder falhar (AP-29). Medido: é o que acontecia sob o mutante
	# que afirma só a presença do binário.
	afirmar_igual "a reprovação nomeia o binário openssl" "1" \
		"$(grep -c 'FALTA o binario openssl' "${saida}" || true)"
	# A asserção que SEPARA as duas pernas: sem ela, uma mensagem única citando
	# os dois recursos passaria em ambas, e o operador não saberia qual metade
	# instalar.
	afirmar_igual "a reprovação do binário não fala do provider" "0" \
		"$(grep -c 'legacy' "${saida}" || true)"

	# --- MUTANTE B — binário presente, provider legado ausente ------------- #
	# É a perna que discrimina o modo de falha REAL: um caso que só medisse
	# `command -v openssl` ficaria verde exatamente aqui.
	cat >"${stub}/openssl" <<-'STUB'
		#!/bin/bash
		# Stub do MUTANTE B do CT-1045: o binário existe e responde, mas o
		# provider legado NÃO está disponível.
		if [ "${1:-}" = "version" ]; then
		  printf 'OpenSSL 3.5.7 1 Jul 2025 (Library: OpenSSL 3.5.7 1 Jul 2025)\n'
		  exit 0
		fi
		if [ "${1:-}" = "list" ]; then
		  for argumento in "$@"; do
		    if [ "${argumento}" = "legacy" ]; then
		      printf 'openssl: Unknown provider "legacy"\n' >&2
		      exit 1
		    fi
		  done
		  printf 'Providers:\n  default\n    name: OpenSSL Default Provider\n    version: 3.5.7\n    status: active\n'
		  exit 0
		fi
		exit 1
	STUB
	chmod +x "${stub}/openssl"

	# Degradação DECLARADA, nunca silenciosa: caixa de areia montada `noexec`
	# impediria o stub de rodar, e o caso diria que o mutante passou quando ele
	# nem foi medido.
	if ! "${stub}/openssl" version >/dev/null 2>&1; then
		aviso "a caixa de areia não executa o stub — o mutante do provider legado NÃO foi medido"
	else
		local codigo_sem_provider=""
		codigo_sem_provider="$(desfecho_da_pre_condicao "${stub}:${PATH}")"
		afirmar_igual "provider legado ausente REPROVA" "1" "${codigo_sem_provider}"
		# Mesma âncora do mutante A, e aqui ela é indispensável: a linha de
		# aprovação nomeia o provider `legacy` com todas as letras.
		afirmar_igual "a reprovação nomeia o provider legacy" "1" \
			"$(grep -c 'FALTA o provider legacy' "${saida}" || true)"
	fi

	unset -f desfecho_da_pre_condicao

	fechar_caso "CT-1045"
}

main() {
	exigir_privilegio

	local faltando=() ferramenta
	# `node` NÃO entra nesta lista: ele não está instalado no sistema, e sim sob o
	# diretório pessoal do usuário de trabalho, pelo gerenciador de versões — sob
	# `sudo` o PATH não o alcança. A ponta comportamental da asserção (m) o procura
	# por `localizar_runtime_node` e, sem ele, emite AVISO nomeando o que ficou por
	# exercitar, em vez de passar em silêncio.
	for ferramenta in git ss dpkg-query systemctl stat sha256sum install runuser mount umount mountpoint find awk comm paste; do
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
	ct_030
	ct_647
	ct_1045

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-provisionamento: %d/%d casos aprovados (CT-001 a CT-005, CT-030, CT-647 e CT-1045)\n' \
			"${casos_aprovados}" "${casos_executados}"
		if [[ "${avisos_totais}" -gt 0 ]]; then
			printf 'verificar-provisionamento: %d degradação(ões) — há asserção NÃO MEDIDA neste host (ver as linhas AVISO acima)\n' \
				"${avisos_totais}" >&2
		fi
		exit 0
	fi
	printf 'verificar-provisionamento: %d falha(s) em %d caso(s) — REPROVADO\n' \
		"${falhas_totais}" "$((casos_executados - casos_aprovados))" >&2
	exit 1
}

main "$@"
