#!/usr/bin/env bash
#
# Verificação da apuração de versão do banco — T4 da fatia `fundacao-stack-nativa`.
#
# Casos cobertos: CT-007, CT-008, CT-009.
#
# O que este script prova, em uma frase por caso:
#
#   CT-007  uma execução bem-sucedida grava no registro a versão dos DOIS lados e UMA conclusão
#           explícita sobre haver ou não divergência; executá-lo duas vezes seguidas termina com
#           sucesso e mantém uma única seção de apuração; a procedência do lado da operação é
#           DERIVADA do arquivo de ambiente lido, e não afirmada por literal; as DUAS formas de
#           cadeia de conexão aceitas — endereço e porta, que é a de `/etc/sysloc/backend.env`, e
#           socket — são exercitadas de ponta a ponta contra instância própria, sem privilégio; e
#           o lado da verificação usa a credencial no alfabeto do helper de instância efêmera
#           (base64url, com '-' e '_'), que é a que o caminho privilegiado de fato carrega, e uma
#           credencial com ':' e '\' — os dois caracteres especiais do arquivo de senha do cliente
#           — atravessa escapada;
#   CT-008  quando a versão do lado da operação não é obtenível, o procedimento termina com
#           código diferente de zero NOMEANDO a fonte que faltou e não substitui o registro
#           existente por dado parcial;
#   CT-009  o script versionado não carrega credencial — e a varredura que afirma isso REPROVA
#           uma cópia do script com o defeito reintroduzido.
#
# ---------------------------------------------------------------------------
# Como esta bateria consegue rodar sem privilégio
# ---------------------------------------------------------------------------
#
# Ela levanta as suas PRÓPRIAS instâncias de banco, a partir dos binários provisionados, em
# diretório temporário e porta própria — exatamente a disciplina que a ADR-0006 fixa para a
# suíte automatizada. Nenhum caso toca o cluster que atende a operação, nenhum caso pede
# privilégio, e o `trap` derruba tudo o que a bateria subiu, inclusive quando ela falha.
#
# A faixa de portas usada aqui (25001-25999) é deliberadamente diferente da faixa das instâncias
# da suíte de TypeScript (24001-24999, declarada em `packages/shared/test/efemero-comum.ts`):
# as duas podem estar rodando ao mesmo tempo, e disputar porta produziria falha intermitente que
# não tem nada a ver com o que se quer provar. Nenhuma das duas faixas encosta nas portas do
# provisionamento (6380, 1025, 8025) nem nas portas padrão dos serviços (5432, 6379).
#
# ---------------------------------------------------------------------------
# Prova de falsificação (CT-009)
# ---------------------------------------------------------------------------
#
# A asserção do CT-009 é ESTÁTICA: ela inspeciona o texto do script em vez de exercitá-lo. Toda
# asserção estática deste projeto exige prova de que ela REPROVA o defeito que persegue — três
# das cinco rodadas de T2 caíram por asserção que não podia falhar. Por isso o caso gera cópias
# do script com o defeito reintroduzido (credencial em variável de ambiente, cadeia de conexão
# com segredo embutido, rastreio verboso ligado), aplica a MESMA função de varredura a elas e
# exige reprovação em cada uma — com o script real como controle limpo no mesmo arreio.
#
# Uso: bash deploy/scripts/instalacao/verificar-apuracao-versao.sh

set -Eeuo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly RAIZ_REPO
readonly SCRIPT_APURAR="${RAIZ_REPO}/deploy/scripts/instalacao/apurar-versao-banco.sh"
readonly REGISTRO_VERSIONADO="${RAIZ_REPO}/docs/specs/features/fundacao-stack-nativa/v1/VERSAO-BANCO.md"

# Faixa de portas desta bateria — ver o cabeçalho para a razão de ela não ser a da suíte.
readonly PORTA_INICIAL=25001
readonly PORTA_FINAL=25999

# Portas que uma instância desta bateria não pode ocupar em hipótese alguma: as três que o
# provisionamento abre (1025, 6380, 8025) e as duas padrão do banco e da fila (5432, 6379).
# A faixa acima já as exclui — este guarda existe para o dia em que alguém alargar a faixa, e é o
# mesmo que `packages/shared/test/efemero-comum.ts` aplica do lado do TypeScript. As duas frentes
# implementam a mesma disciplina; deixar a redundância em só uma delas é convite a divergirem.
readonly PORTAS_INTOCAVEIS=(1025 5432 6379 6380 8025)

# Limite de espera pelo estado observável "o cluster aceita conexão", em segundos. Sondagem com
# limite, nunca espera fixa.
readonly LIMITE_SUBIDA_S=30

# Rótulo do lado da verificação e do lado da operação, como o registro os escreve. São PREFIXOS:
# o rótulo do lado da operação carrega, depois da palavra, a procedência derivada pelo
# procedimento — e é justamente ela que as asserções de procedência conferem.
readonly ROTULO_VERIFICACAO="Verificação"
readonly ROTULO_OPERACAO="Operação"

# O arquivo de ambiente do lado da operação: o mesmo `EnvironmentFile=` 0600 que as unidades de
# serviço consomem. É o ÚNICO caminho que autoriza o registro a afirmar ter falado com a
# instância provisionada. O literal está repetido aqui de propósito — a bateria precisa saber o
# valor esperado sem herdá-lo do próprio código sob teste, senão os dois erram juntos.
readonly ARQ_AMBIENTE_DA_OPERACAO="/etc/sysloc/backend.env"

# As duas procedências que o rótulo do lado da operação pode declarar.
readonly MARCA_PROVISIONADA="instância provisionada"
readonly MARCA_SUBSTITUTO="SUBSTITUTO"

# O comando que fecha a CA-14 — o único caminho que faz o rótulo do lado da operação sair como
# `instância provisionada`. O literal aparece em DOIS lugares desta bateria (o aviso do CT-007 e o
# resumo final) e por isso vive aqui: quem lê `3/3 casos aprovados` precisa encontrar, na mesma
# tela, o que ainda falta e como fazê-lo.
readonly COMANDO_QUE_FECHA_CA14='SYSLOC_ARQ_AMBIENTE_VERIFICACAO=<arquivo-da-instancia-efemera> sudo -E bash deploy/scripts/instalacao/apurar-versao-banco.sh'

DIR_TRABALHO=""
DIR_BIN_PG=""
INSTANCIAS_ATIVAS=()

# Ligado pelo CT-007 quando o registro versionado ainda está carimbado com ${MARCA_SUBSTITUTO}.
# Não é falha — é o que qualifica o resumo final para que ele pare de afirmar, por omissão, que o
# critério de saída da fatia está fechado.
CA14_EM_ABERTO=0

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# Fora do esqueleto compartilhado — ver a razão medida no cabeçalho de
# `deploy/scripts/verificacao/esqueleto-de-assercao.sh`. ⚠️ **Esta cópia É o mesmo
# símbolo das outras duas de comparação de STRING**, e a unificação está ADIADA,
# não descartada: o que a impede é o quarto homônimo, o de `verificar-captura.sh`,
# que recebe um ARQUIVO e grepa. Conte as cópias ao abrir este ponto — são quatro,
# três idênticas e uma divergente. Ler "não são o mesmo símbolo" e parar de contar
# é exatamente o mecanismo que produziu o `D9 · F0/T2`.
afirmar_contem() {
	if [[ "$3" == *"$2"* ]]; then
		ok "$1"
	else
		falhar "$1 — não encontrei [$2] em: $3"
	fi
}

limpar() {
	local codigo=$?
	local instancia
	for instancia in "${INSTANCIAS_ATIVAS[@]:-}"; do
		[[ -n "${instancia}" ]] || continue
		if [[ -n "${DIR_BIN_PG}" && -d "${instancia}" ]]; then
			"${DIR_BIN_PG}/pg_ctl" -D "${instancia}" -m immediate stop >/dev/null 2>&1 || true
		fi
	done
	if [[ -n "${DIR_TRABALHO}" && -d "${DIR_TRABALHO}" ]]; then
		rm -rf "${DIR_TRABALHO}"
	fi
	return "${codigo}"
}
trap limpar EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

# --------------------------------------------------------------------------- #
# Infraestrutura da bateria: instâncias próprias de banco, sem privilégio.
# --------------------------------------------------------------------------- #

localizar_binarios_do_banco() {
	local candidato
	if candidato="$(pg_config --bindir 2>/dev/null)" && [[ -x "${candidato}/initdb" ]]; then
		DIR_BIN_PG="${candidato}"
		return 0
	fi
	# O empacotamento da distribuição não põe `initdb` e `pg_ctl` no PATH — eles vivem no
	# diretório da versão. A ordem reversa pega a versão mais nova quando houver mais de uma.
	for candidato in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -Vr); do
		if [[ -x "${candidato}/initdb" && -x "${candidato}/pg_ctl" ]]; then
			DIR_BIN_PG="${candidato}"
			return 0
		fi
	done
	if candidato="$(command -v initdb 2>/dev/null)"; then
		DIR_BIN_PG="$(dirname "${candidato}")"
		return 0
	fi
	return 1
}

porta_livre() {
	local porta intocavel proibida
	for ((porta = PORTA_INICIAL; porta <= PORTA_FINAL; porta++)); do
		proibida=0
		for intocavel in "${PORTAS_INTOCAVEIS[@]}"; do
			if [[ "${porta}" -eq "${intocavel}" ]]; then
				proibida=1
				break
			fi
		done
		if [[ "${proibida}" -eq 1 ]]; then
			continue
		fi
		if ! ss -ltnH "sport = :${porta}" 2>/dev/null | grep -q .; then
			printf '%s' "${porta}"
			return 0
		fi
	done
	return 1
}

# Gera a credencial de uma instância desta bateria NO ALFABETO DE QUEM A GERARIA DE VERDADE.
#
# Os dois lados da apuração têm origens distintas, e é isso que esta função preserva:
#
#   base64url     — o lado da VERIFICAÇÃO. A instância é levantada pelo helper da suíte
#                   (`packages/shared/test/postgres-efemero.ts`), que faz
#                   `randomBytes(24).toString('base64url')`; o alfabeto inclui '-' e '_'.
#   alfanumerica  — o lado da OPERAÇÃO. A credencial vem de `provisionar-base.sh`, que a restringe
#                   a letras e números porque LÁ ela viaja dentro de uma URL, onde ':', '@', '?',
#                   '&' e '/' são delimitadores.
#   com_especiais — nenhum dos dois a gera: são os DOIS caracteres que o arquivo de senha do
#                   cliente trata como especiais — o ':' que separa os campos e a '\' que escapa.
#                   Existe para dar falsificador às duas substituições do escape do procedimento.
#
# Os caracteres especiais entram de forma DETERMINÍSTICA, e não por sorteio: um base64url de 24
# caracteres tem cerca de um terço de chance de não conter nem '-' nem '_', e um caso que só
# exercita a classe em parte das execuções não é asserção — é loteria.
gerar_credencial() {
	local bruta
	bruta="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-22)"
	case "$1" in
	base64url) printf '%s-%s_%s' "${bruta:0:8}" "${bruta:8:8}" "${bruta:16}" ;;
	com_especiais) printf '%s-%s_%s:%s\\%s' "${bruta:0:5}" "${bruta:5:5}" "${bruta:10:5}" "${bruta:15:4}" "${bruta:19}" ;;
	*) printf '%s' "${bruta}" ;;
	esac
}

# Sobe uma instância própria e devolve a porta escolhida em ${PORTA_DA_INSTANCIA}.
#
# O resultado sai por variável, e não pela saída padrão, porque substituição de comando roda em
# subshell: o registro da instância em ${INSTANCIAS_ATIVAS} se perderia com ele, e o `trap`
# deixaria um cluster de pé depois da bateria.
#
# $1 = nome (compõe o diretório) · $2 = alfabeto da credencial (ver `gerar_credencial`) · o arquivo
# de ambiente correspondente fica em ${DIR_TRABALHO}/<nome>.env, com modo 0600 e a credencial
# gerada em tempo de execução.
PORTA_DA_INSTANCIA=""
subir_instancia() {
	local nome="$1" alfabeto="${2:-alfanumerica}"
	local base="${DIR_TRABALHO}/${nome}"
	local dados="${base}/dados"
	local porta
	PORTA_DA_INSTANCIA=""
	porta="$(porta_livre)" || return 1

	mkdir -p "${base}"
	# A credencial nasce aleatória a cada execução e vive apenas dentro do diretório temporário
	# que o `trap` apaga. Nada aqui é literal, e nada sobrevive à bateria.
	local arq_credencial="${base}/credencial"
	install -m 0600 /dev/null "${arq_credencial}"
	gerar_credencial "${alfabeto}" >"${arq_credencial}"

	"${DIR_BIN_PG}/initdb" -D "${dados}" -U verificacao -A scram-sha-256 \
		--pwfile="${arq_credencial}" --no-sync -E UTF8 >"${base}/initdb.log" 2>&1 || return 1

	"${DIR_BIN_PG}/pg_ctl" -D "${dados}" \
		-o "-p ${porta} -h 127.0.0.1 -k ${base}" -l "${base}/servidor.log" -w start \
		>"${base}/pg_ctl.log" 2>&1 || return 1

	INSTANCIAS_ATIVAS+=("${dados}")

	# Sondagem por estado observável, com limite declarado.
	local decorrido=0
	until "${DIR_BIN_PG}/pg_isready" -h 127.0.0.1 -p "${porta}" -q >/dev/null 2>&1; do
		if [[ "${decorrido}" -ge "${LIMITE_SUBIDA_S}" ]]; then
			return 1
		fi
		sleep 1
		decorrido=$((decorrido + 1))
	done

	install -m 0600 /dev/null "${DIR_TRABALHO}/${nome}.env"
	printf 'DATABASE_URL=postgresql://verificacao:%s@127.0.0.1:%s/postgres\n' \
		"$(cat "${arq_credencial}")" "${porta}" >"${DIR_TRABALHO}/${nome}.env"

	PORTA_DA_INSTANCIA="${porta}"
}

# Lê `SHOW server_version` direto da instância — é o valor esperado das asserções do CT-007, e
# ele vem da própria instância, não de literal escrito pela bateria.
versao_da_instancia() {
	local nome="$1" porta="$2"
	local base="${DIR_TRABALHO}/${nome}"
	local arq_pgpass="${base}/pgpass"
	install -m 0600 /dev/null "${arq_pgpass}"
	printf '127.0.0.1:%s:postgres:verificacao:%s\n' "${porta}" "$(cat "${base}/credencial")" \
		>"${arq_pgpass}"
	PGPASSFILE="${arq_pgpass}" psql -X -q -A -t -w \
		-h 127.0.0.1 -p "${porta}" -U verificacao -d postgres -c 'SHOW server_version' |
		head -1 | tr -d '\r'
	rm -f "${arq_pgpass}"
}

# Extrai uma célula da linha da tabela de apuração cujo rótulo começa por ${rotulo}. As colunas,
# em campos separados por '|', são: 2 = Lado · 3 = Configuração lida · 4 = Destino consultado ·
# 5 = versão reportada. Devolve string vazia quando a linha não existe — o que reprova a asserção
# que a consome, em vez de passar em silêncio.
celula_no_registro() {
	local registro="$1" rotulo="$2" coluna="$3"
	awk -F'|' -v alvo="${rotulo}" -v col="${coluna}" '
		$0 ~ "^\\| " alvo {
			valor = $col
			gsub(/^[ \t`]+/, "", valor)
			gsub(/[ \t`]+$/, "", valor)
			print valor
			exit
		}
	' "${registro}"
}

# Extrai do registro a versão gravada para um lado.
versao_no_registro() {
	celula_no_registro "$1" "$2" 5
}

# --------------------------------------------------------------------------- #
# Asserção de FORMA e de PROCEDÊNCIA do registro.
#
# Conferir que a célula de versão é "não-vazia" passa com `n/a`, com `pendente` e com um número
# inventado — e passa, sobretudo, com um registro que afirme ter lido a instância provisionada
# sem ter lido. É exatamente essa a dimensão que a CA-14 protege: o registro é lido pela fatia
# seguinte como apuração concluída, e um rótulo que não derive do que foi de fato lido a
# converteria em suposição.
#
# Duas coisas, portanto:
#
#   (1) FORMA — a célula de versão de cada lado tem de casar `^[0-9]+\.[0-9]+`;
#   (2) PROCEDÊNCIA — quando o rótulo da linha da operação afirma `instância provisionada`, a
#       coluna "Configuração lida" tem de ser EXATAMENTE ${ARQ_AMBIENTE_DA_OPERACAO}; quando não
#       for esse arquivo, o rótulo tem de marcar o substituto. Um rótulo que não declare nem uma
#       coisa nem outra reprova: quem lê a tabela lê o rótulo, e rótulo vence prosa.
# --------------------------------------------------------------------------- #
afirmar_forma_e_procedencia() {
	local contexto="$1" registro="$2"

	local lado versao
	for lado in "${ROTULO_VERIFICACAO}" "${ROTULO_OPERACAO}"; do
		versao="$(versao_no_registro "${registro}" "${lado}")"
		if [[ "${versao}" =~ ^[0-9]+\.[0-9]+ ]]; then
			ok "${contexto}: a célula de versão do lado da ${lado} tem forma de número de versão [${versao}]"
		else
			falhar "${contexto}: a célula de versão do lado da ${lado} não é um número de versão — obtido [${versao}]"
		fi
	done

	local rotulo_operacao configuracao_operacao
	rotulo_operacao="$(celula_no_registro "${registro}" "${ROTULO_OPERACAO}" 2)"
	configuracao_operacao="$(celula_no_registro "${registro}" "${ROTULO_OPERACAO}" 3)"

	if [[ "${rotulo_operacao}" == *"${MARCA_PROVISIONADA}"* ]]; then
		afirmar_igual "${contexto}: o rótulo afirma '${MARCA_PROVISIONADA}', então a configuração lida é o arquivo da operação" \
			"${ARQ_AMBIENTE_DA_OPERACAO}" "${configuracao_operacao}"
	elif [[ "${rotulo_operacao}" == *"${MARCA_SUBSTITUTO}"* ]]; then
		afirmar_diferente "${contexto}: o rótulo marca '${MARCA_SUBSTITUTO}', então a configuração lida NÃO é o arquivo da operação" \
			"${ARQ_AMBIENTE_DA_OPERACAO}" "${configuracao_operacao}"
		afirmar_contem "${contexto}: o rótulo de substituto nomeia a configuração de onde a leitura veio" \
			"${configuracao_operacao}" "${rotulo_operacao}"
	else
		falhar "${contexto}: o rótulo da linha da operação [${rotulo_operacao}] não afirma '${MARCA_PROVISIONADA}' nem marca '${MARCA_SUBSTITUTO}' — sem uma das duas, a procedência do dado é indeterminável por quem lê a tabela"
	fi
}

# --------------------------------------------------------------------------- #
# O sinal que faltava: a CA-14 EM ABERTO precisa FALAR.
#
# `afirmar_forma_e_procedencia` confere COERÊNCIA — que o rótulo corresponda à configuração que foi
# de fato lida — e um registro carimbado com `SUBSTITUTO` é perfeitamente coerente. Por isso os
# DOIS estados saem verdes por lá, e a bateria encerrava com `3/3 casos aprovados` e `registro
# versionado conferido` tendo o critério de saída da fatia em aberto. Coerência não é completude, e
# quem lê `3/3` lê completude.
#
# A rule de teste do projeto fixa que degradação nunca passa em silêncio: o lado da operação da
# CA-14 exige privilégio que este host não concede a agente algum, e é exatamente isso que ficou
# por fazer. `aviso` NÃO conta como falha — a bateria continua saindo 0 e as asserções seguem
# intactas. O que muda é que ela para de afirmar, por omissão, que está tudo fechado. Importa
# sobretudo para T7, que vai agregar este verificador numa bateria de fatia que só sai 0 quando
# tudo passa: sem este aviso, a fatia inteira sairia verde com o próprio critério de saída aberto.
#
# Devolve 0 quando emitiu o aviso (CA-14 em aberto) e 1 quando não havia o que avisar.
# --------------------------------------------------------------------------- #
avisar_se_ca14_em_aberto() {
	local registro="$1"
	local rotulo_operacao
	rotulo_operacao="$(celula_no_registro "${registro}" "${ROTULO_OPERACAO}" 2)"

	if [[ "${rotulo_operacao}" != *"${MARCA_SUBSTITUTO}"* ]]; then
		return 1
	fi

	aviso "CA-14 EM ABERTO — o registro versionado ainda não foi carimbado com privilégio: o lado da operação está rotulado [${rotulo_operacao}], e não '${MARCA_PROVISIONADA}'"
	aviso "CA-14 EM ABERTO — as asserções acima provam que o PROCEDIMENTO funciona; elas não fecham o critério. Execute: ${COMANDO_QUE_FECHA_CA14}"
	return 0
}

# Monta um registro com a MESMA forma que `apurar-versao-banco.sh` grava, variando só as duas
# colunas que decidem o aviso. Existe porque o estado "CA-14 fechada" depende de privilégio que
# esta bateria não tem: sem construí-lo, o ramo negativo do aviso ficaria sem asserção, e um aviso
# que saísse incondicionalmente passaria despercebido — aviso que sempre sai é ruído, e ruído se
# aprende a ignorar.
#
# $1 = destino · $2 = rótulo do lado da operação · $3 = configuração lida daquele lado
escrever_registro_sintetico() {
	local destino="$1" rotulo="$2" configuracao="$3"
	{
		printf '## Apuração\n\n'
		printf '| Lado | Configuração lida | Destino consultado | `SHOW server_version` |\n'
		printf '|---|---|---|---|\n'
		printf '| Verificação (instância efêmera da suíte) | `%s` | `%s` | `%s` |\n' \
			"${DIR_TRABALHO}/verificacao.env" "127.0.0.1:${PORTA_INICIAL}" "18.4"
		printf '| %s | `%s` | `%s` | `%s` |\n' \
			"${rotulo}" "${configuracao}" "/var/run/postgresql:5432" "18.4"
	} >"${destino}"
}

# Carrega, do arquivo indicado, a função REAL que decide a conclusão da apuração. Recebe o
# caminho por parâmetro para poder ser apontada a uma cópia mutilada — é assim que se prova que
# a asserção reprova.
carregar_funcoes_da_apuracao() {
	local script="$1" fn trecho
	local -a funcoes=(versao_numerica concluir_divergencia decompor_url)

	for fn in "${funcoes[@]}"; do
		trecho="$(sed -n "/^${fn}() {/,/^}/p" "${script}")"
		[[ -n "${trecho}" ]] || return 1
		eval "${trecho}"
		[[ "$(type -t "${fn}")" == "function" ]] || return 1
	done
}

# --------------------------------------------------------------------------- #
# A varredura de credencial do CT-009, como FUNÇÃO com o caminho por parâmetro.
#
# Ela é o SUT das asserções de falsificação: a mesma função que aprova o script real precisa
# reprovar cada cópia com o defeito de volta. Devolve 0 (limpo) ou 1 (reprovado) e descreve cada
# ocorrência na saída de erro.
#
# O padrão de cadeia de conexão ignora os marcadores de documentação (SEGREDO, SENHA, ...): o
# cabeçalho do procedimento precisa mostrar o FORMATO aceito, e um formato escrito com marcador
# não é credencial. Marcador é a lista explícita abaixo — qualquer outro valor reprova.
# --------------------------------------------------------------------------- #
readonly MARCADORES_DE_DOCUMENTACAO='SEGREDO|SENHA|PASSWORD|CREDENCIAL|xxx'

varrer_credencial() {
	local script="$1"
	local reprovacoes=0 ocorrencias=""

	# (a) literal de senha atribuído a uma variável.
	ocorrencias="$(grep -nE "(PASSWORD|password|senha|Senha)[[:space:]]*=[[:space:]]*[\"'][^\"']+" \
		"${script}" || true)"
	if [[ -n "${ocorrencias}" ]]; then
		printf 'literal de senha atribuído:\n%s\n' "${ocorrencias}" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (b) cadeia de conexão com segredo embutido.
	ocorrencias="$(grep -nE "postgres(ql)?://[^[:space:]\"']*:[^[:space:]\"'@/]+@" "${script}" |
		grep -vE ":(${MARCADORES_DE_DOCUMENTACAO})@" || true)"
	if [[ -n "${ocorrencias}" ]]; then
		printf 'cadeia de conexão com segredo embutido:\n%s\n' "${ocorrencias}" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (c) segredo viajando por argumento de linha de comando ou variável de ambiente exportada.
	# O padrão é escrito com classe de caractere para que esta própria linha não case com ele.
	ocorrencias="$(grep -nE '(--password[= ]|--dbpassword[= ]|PGPASSWORD[=])' "${script}" || true)"
	if [[ -n "${ocorrencias}" ]]; then
		printf 'segredo em argumento ou variável exportada:\n%s\n' "${ocorrencias}" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (d) rastreio verboso de comandos ligado — ele ecoaria o segredo no log da operação.
	ocorrencias="$(grep -nE 'set[[:space:]]+-x' "${script}" || true)"
	if [[ -n "${ocorrencias}" ]]; then
		printf 'rastreio verboso de comandos ligado:\n%s\n' "${ocorrencias}" >&2
		reprovacoes=$((reprovacoes + 1))
	fi

	# (e) o segredo PRECISA vir de fonte externa: sem estas duas referências, o script não estaria
	# lendo credencial de arquivo de ambiente nem entregando-a por arquivo de senha.
	local exigidos=("SYSLOC_ARQ_AMBIENTE" "PGPASSFILE")
	local exigido
	for exigido in "${exigidos[@]}"; do
		if ! grep -qF "${exigido}" "${script}"; then
			printf 'referência obrigatória ausente: %s\n' "${exigido}" >&2
			reprovacoes=$((reprovacoes + 1))
		fi
	done

	[[ "${reprovacoes}" -eq 0 ]]
}

# =========================================================================== #
# CT-007 — a apuração grava os dois lados e a conclusão, e é idempotente.
#
# O caso reúne seis pontas que só provam o que precisam provar quando estão juntas, e por isso
# elas vivem em funções próprias abaixo: o invólucro `ct_007` as chama na ordem causal. `caso` e
# `fechar_caso` ficam no invólucro — o ID literal e a contagem de falhas do caso não mudam por
# causa da divisão, e a rastreabilidade `CA-14 → CT-007` continua sendo a de UM caso.
# =========================================================================== #

# --- a forma de socket, a SEGUNDA das duas que este procedimento aceita ---
#
# `/etc/sysloc/backend.env` passou a expressar a conexão por endereço e porta — o cluster
# provisionado escuta em `127.0.0.1` porque socket de domínio Unix não cabe numa URL e o cliente
# que a aplicação usa recusa a cadeia antes de conectar (ver o cabeçalho de `provisionar-base.sh`).
# Essa forma é a que o restante desta bateria já exercita, no lado da verificação e no da operação.
#
# A forma de SOCKET continua aceita, e continua exercitada aqui, porque `psql` a alcança sem
# tradução e ela segue sendo destino legítimo: instância efêmera que só escute em socket, ou
# qualquer cluster apontado por `SYSLOC_ARQ_AMBIENTE` que não abra porta. Se ela deixasse de ser
# aceita, o procedimento perderia um caminho de leitura que o cabeçalho dele promete — e a
# descoberta viria de quem apontasse o procedimento para um cluster assim. Aqui ela é exercitada
# de ponta a ponta contra a instância própria da bateria, pelo socket dela, sem privilégio nenhum.
#
# $1 = porta da instância do lado da operação · $2 = versão que aquela instância reporta
ct_007_forma_de_socket() {
	local porta_operacao="$1" versao_direta_operacao="$2"

	local dir_socket="${DIR_TRABALHO}/operacao"
	local env_socket="${DIR_TRABALHO}/operacao-socket.env"
	install -m 0600 /dev/null "${env_socket}"
	printf 'DATABASE_URL=postgresql://verificacao:%s@/postgres?host=%s&port=%s\n' \
		"$(cat "${dir_socket}/credencial")" "${dir_socket}" "${porta_operacao}" >"${env_socket}"

	local registro_socket="${DIR_TRABALHO}/REGISTRO-POR-SOCKET.md"
	local codigo=0
	SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/verificacao.env" \
		SYSLOC_ARQ_AMBIENTE="${env_socket}" \
		SYSLOC_REGISTRO_VERSAO="${registro_socket}" \
		bash "${SCRIPT_APURAR}" >"${DIR_TRABALHO}/apuracao-socket.log" 2>&1 || codigo=$?
	afirmar_igual "forma de socket: a apuração termina com código 0" "0" "${codigo}"
	if [[ ! -f "${registro_socket}" ]]; then
		falhar "forma de socket: a apuração não gravou o registro em ${registro_socket} — o caminho de parsing que a execução privilegiada exige não está exercitado"
		return
	fi

	afirmar_igual "forma de socket: o registro traz a versão que a instância reporta pelo socket" \
		"${versao_direta_operacao}" "$(versao_no_registro "${registro_socket}" "${ROTULO_OPERACAO}")"
	local destino_socket
	destino_socket="$(celula_no_registro "${registro_socket}" "${ROTULO_OPERACAO}" 4)"
	if [[ "${destino_socket}" == /* ]]; then
		ok "forma de socket: o destino registrado é o diretório do socket [${destino_socket}], não um endereço TCP"
	else
		falhar "forma de socket: o destino registrado [${destino_socket}] não é um caminho de socket — a leitura não percorreu o caminho que a execução privilegiada vai percorrer"
	fi
	afirmar_forma_e_procedencia "forma de socket" "${registro_socket}"
}

# --- a decomposição da cadeia precisa RECUSAR o que não sabe ler ---
#
# Fechada na intervenção dirigida de 2026-08-23 (`D24 · F0/T4`). Até a rodada 3 da T4 o `%` era
# barrado por efeito colateral do guarda de alfabeto; removido ele, a codificação percentual —
# forma CANÔNICA de URI, e o que `postgres.js` e a libpq decodificam — atravessava como literal, o
# servidor recusava a autenticação e o `abortar` da consulta mandava conferir se a instância estava
# de pé. Diagnóstico que culpa o servidor por defeito de configuração, que é o que o cabeçalho do
# procedimento declara existir para não produzir.
#
# O par que discrimina são as duas primeiras linhas contra a terceira: o `%` recusa com código
# PRÓPRIO (2), e a credencial crua segue aceita. As linhas de ':' e '@' crus são o controle de
# não-regressão — eles atravessam inertes até o arquivo de senha, que o procedimento escapa, e
# recusá-los seria fechar a porta certa no lugar errado.
ct_007_tabela_de_decomposicao() {
	if ! carregar_funcoes_da_apuracao "${SCRIPT_APURAR}"; then
		falhar "não consegui carregar decompor_url de ${SCRIPT_APURAR} — sem ela a tabela de decomposição ficaria sem SUT"
		return
	fi

	ok "função de decomposição carregada de ${SCRIPT_APURAR##*/}"
	local url esperado codigo
	while IFS='|' read -r url esperado rotulo; do
		[[ -n "${url}" ]] || continue
		URL_PAPEL=""
		URL_SEGREDO=""
		URL_HOSPEDEIRO=""
		URL_PORTA=""
		URL_BANCO=""
		codigo=0
		decompor_url "${url}" || codigo=$?
		afirmar_igual "decomposição: ${rotulo}" "${esperado}" "${codigo}"
	done <<-'TABELA'
		postgresql://papel:p%3Ass@127.0.0.1:5432/sysloc|2|credencial percent-encoded (TCP) é RECUSADA com código próprio
		postgresql://papel:p%3Ass@/sysloc?host=/tmp&port=5432|2|credencial percent-encoded (socket) é RECUSADA
		postgresql://papel:segredo123@127.0.0.1:5432/sysloc|0|credencial crua é ACEITA (controle positivo)
		postgresql://papel:se:gredo@127.0.0.1:5432/sysloc|0|':' cru na senha segue aceito (não-regressão)
		postgresql://papel:se@gredo@127.0.0.1:5432/sysloc|0|'@' cru na senha segue aceito (não-regressão)
		mysql://papel:x@127.0.0.1:3306/x|1|esquema alheio segue recusado com 1, não com 2
		postgresql://semdoispontos@127.0.0.1:5432/x|1|cadeia sem credencial segue recusada com 1
	TABELA
}

# --- a conclusão precisa DISCRIMINAR ---
#
# Com duas instâncias dos mesmos binários, a execução real só percorre o ramo "sem divergência" —
# a tabela abaixo exercita a função REAL, carregada do script, com os dois desfechos. Sem ela, uma
# conclusão fixa em "Sem divergência" passaria.
ct_007_tabela_de_conclusao() {
	if ! carregar_funcoes_da_apuracao "${SCRIPT_APURAR}"; then
		falhar "não consegui carregar concluir_divergencia de ${SCRIPT_APURAR} — sem ela a tabela de conclusão ficaria sem SUT"
		return
	fi

	ok "função de conclusão carregada de ${SCRIPT_APURAR##*/}"
	local esperado obtido
	while IFS='|' read -r verificacao operacao esperado; do
		[[ -n "${verificacao}" ]] || continue
		obtido="$(concluir_divergencia "${verificacao}" "${operacao}" || true)"
		afirmar_igual "conclusão para (verificação=${verificacao}, operação=${operacao})" \
			"${esperado}" "${obtido%%:*}"
	done <<-'TABELA'
		18.4|18.4|Sem divergência
		18.4 (Ubuntu 18.4-1.pgdg24.04+1)|18.4|Sem divergência
		18.4|17.10|Divergência
		18.4|18.5|Divergência
		17.10|18.4|Divergência
	TABELA
}

# --- o registro VERSIONADO, que é o que a fatia seguinte vai ler ---
#
# O que a CA-14 exige é o artefato commitado, não a cópia de trabalho. As asserções abaixo
# conferem que ele tem a mesma forma que a execução acabou de produzir — um registro versionado
# desatualizado na FORMA seria sinal de que ele foi editado à mão em vez de gerado.
ct_007_registro_versionado() {
	if [[ ! -f "${REGISTRO_VERSIONADO}" ]]; then
		falhar "o registro versionado não existe: ${REGISTRO_VERSIONADO} — a CA-14 exige a apuração registrada em arquivo versionado"
		return
	fi

	afirmar_igual "o registro versionado tem exatamente UMA seção de apuração" \
		"1" "$(grep -c '^## Apuração$' "${REGISTRO_VERSIONADO}" || true)"
	afirmar_igual "o registro versionado tem exatamente UMA linha de conclusão" \
		"1" "$(grep -cE '^(Sem divergência|Divergência)' "${REGISTRO_VERSIONADO}" || true)"
	# Forma e procedência, e não mera presença: uma célula não-vazia passa com `n/a`, com
	# `pendente` e com um número inventado, e a procedência não era conferida de modo algum —
	# era por essa fresta que um registro afirmando ter lido a instância provisionada sem tê-la
	# lido chegou a ser commitado.
	afirmar_forma_e_procedencia "registro versionado" "${REGISTRO_VERSIONADO}"

	# Coerência conferida acima; COMPLETUDE, agora. Se o carimbo ainda for o do substituto, a
	# CA-14 está aberta e a bateria diz isso em voz alta — aqui e no resumo final.
	if avisar_se_ca14_em_aberto "${REGISTRO_VERSIONADO}"; then
		CA14_EM_ABERTO=1
	fi
}

# --- a credencial que o lado da VERIFICAÇÃO realmente tem ---
#
# O lado da verificação NÃO passa por `provisionar-base.sh`. Ele é a instância efêmera que a suíte
# levanta, e `packages/shared/test/postgres-efemero.ts` gera a credencial dela com
# `randomBytes(24).toString('base64url')` — alfabeto que inclui '-' e '_'. Esta bateria fabricava a
# credencial das suas instâncias só com letras e números, e por isso NÃO percorria a classe que a
# única execução documentada da CA-14 percorre: o caminho privilegiado lê os dois lados, e o da
# verificação chega com esses dois caracteres na maioria das execuções.
#
# Duas asserções, portanto, e não uma:
#
#   (1) a FIXTURE — a credencial do lado da verificação contém mesmo '-' e '_'. Sem isso, alguém
#       volta a gerá-la só com letras e números e a classe some sem ninguém perceber;
#   (2) o COMPORTAMENTO — o procedimento apura os dois lados com ela e termina em 0.
#
# A mesma execução fecha a segunda ponta do aviso de CA-14, a que o PROCEDIMENTO emite (a primeira
# ponta, a da bateria, tem falsificador em `ct_007_aviso_falsificavel`): o rótulo aqui sai como
# substituto, então o aviso tem de sair — e tem de sair pela saída de ERRO, que é o canal que um
# agregador reencaminha.
#
# $1 = versão que a instância do lado da verificação reporta
ct_007_credencial_do_helper() {
	local versao_direta_verificacao="$1"

	local credencial
	credencial="$(cat "${DIR_TRABALHO}/verificacao/credencial")"
	if [[ "${credencial}" == *-* && "${credencial}" == *_* ]]; then
		ok "a credencial do lado da verificação contém '-' e '_', como a que o helper de instância efêmera gera"
	else
		falhar "a credencial do lado da verificação não contém '-' e '_' — a classe de credencial que o caminho privilegiado percorre deixou de ser exercitada"
	fi

	local registro="${DIR_TRABALHO}/REGISTRO-CREDENCIAL-DO-HELPER.md"
	local saida_padrao="${DIR_TRABALHO}/apuracao-credencial.out"
	local saida_erro="${DIR_TRABALHO}/apuracao-credencial.err"
	local codigo=0
	SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/verificacao.env" \
		SYSLOC_ARQ_AMBIENTE="${DIR_TRABALHO}/operacao.env" \
		SYSLOC_REGISTRO_VERSAO="${registro}" \
		bash "${SCRIPT_APURAR}" >"${saida_padrao}" 2>"${saida_erro}" || codigo=$?

	afirmar_igual "credencial com '-' e '_': a apuração termina com código 0" "0" "${codigo}"
	afirmar_igual "credencial com '-' e '_': o registro traz a versão que a instância da verificação reporta" \
		"${versao_direta_verificacao}" "$(versao_no_registro "${registro}" "${ROTULO_VERIFICACAO}")"

	# Segunda ponta do aviso: esta execução leu a configuração da operação de um arquivo temporário,
	# então o procedimento tem de dizer, em voz alta, que a CA-14 continua aberta.
	afirmar_contem "o PROCEDIMENTO avisa que a CA-14 segue em aberto quando o rótulo sai como substituto" \
		"CA-14 EM ABERTO" "$(cat "${saida_erro}")"
	afirmar_igual "o aviso do procedimento sai pela saída de ERRO, e não misturado ao relato de sucesso" \
		"0" "$(grep -c 'CA-14 EM ABERTO' "${saida_padrao}" || true)"
}

# --- os caracteres que o formato REALMENTE não carrega crus ---
#
# '-' e '_' são inertes no arquivo de senha do cliente; ':' e '\' não são — o formato separa os
# campos por ':' e escapa com barra invertida, e prevê escape para exatamente esses dois. O
# procedimento escapa em vez de recusar, e é este bloco que dá falsificador ao escape: uma
# instância cuja credencial carrega os dois caracteres ao mesmo tempo.
#
# Os dois juntos, e não um de cada vez, porque as duas substituições do escape se falsificam
# mutuamente: quem dobra a barra sem escapar o ':' quebra a linha em um campo a mais, e quem escapa
# o ':' sem dobrar a barra faz o cliente consumir a barra como escape do caractere seguinte. Uma
# credencial com um só dos dois deixaria metade do escape sem asserção.
#
# Não é o que `provisionar-base.sh` gera nem o que o helper de instância efêmera gera. É o que o
# arquivo de ambiente pode conter no dia em que alguém o regravar à mão — e é o tratamento errado
# desses dois que produz exatamente o diagnóstico enganoso que o procedimento existe para não
# produzir: a autenticação é recusada e a mensagem culpa o servidor.
#
# O que se asserta é o código de saída e a forma do registro, não o número da versão: sem o escape
# correto, a senha que chega ao servidor não é a do papel, a autenticação falha e nada é gravado.
ct_007_credencial_com_especiais() {
	if ! subir_instancia especiais com_especiais; then
		falhar "não consegui subir a instância de credencial com ':' e '\\' (ver ${DIR_TRABALHO}/especiais/)"
		return
	fi

	local credencial
	credencial="$(cat "${DIR_TRABALHO}/especiais/credencial")"
	if [[ "${credencial}" == *:* && "${credencial}" == *\\* ]]; then
		ok "a credencial da instância de escape contém ':' e '\\', os dois caracteres especiais do arquivo de senha"
	else
		falhar "a credencial da instância de escape não contém ':' e '\\' — o escape do procedimento ficaria sem falsificador"
	fi

	local registro="${DIR_TRABALHO}/REGISTRO-CREDENCIAL-COM-ESPECIAIS.md"
	local codigo=0
	SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/especiais.env" \
		SYSLOC_ARQ_AMBIENTE="${DIR_TRABALHO}/operacao.env" \
		SYSLOC_REGISTRO_VERSAO="${registro}" \
		bash "${SCRIPT_APURAR}" >"${DIR_TRABALHO}/apuracao-especiais.log" 2>&1 || codigo=$?
	afirmar_igual "credencial com ':' e '\\': a apuração autentica e termina com código 0" "0" "${codigo}"
	if [[ -f "${registro}" ]]; then
		afirmar_forma_e_procedencia "credencial com ':' e '\\'" "${registro}"
	else
		falhar "credencial com ':' e '\\': a apuração não gravou o registro em ${registro} — os caracteres especiais não estão sendo escapados antes de entrar no arquivo de senha"
	fi
}

# --- o aviso da CA-14 é ele próprio falsificável: os DOIS estados são exercitados ---
#
# Emitir o aviso não basta. Sem prova de que ele SAI com o carimbo de substituto e NÃO sai com o da
# instância provisionada, o silêncio volta na primeira regeneração — e um aviso incondicional é tão
# inútil quanto nenhum. Os dois registros abaixo são sintéticos de propósito: o estado "CA-14
# fechada" exige privilégio que esta bateria não tem, e é justamente por isso que ele precisa ser
# construído para ter asserção.
#
# O CANAL também é asserido, e não só o texto. `aviso` escreve na saída de erro porque degradação
# e diagnóstico não podem sair indistinguíveis — T7 agrega esta bateria, e um agregador que separe
# os canais precisa achar a degradação em algum deles. Uma asserção que só olhasse o texto passaria
# com o aviso de volta na saída padrão, que é exatamente o defeito.
ct_007_aviso_falsificavel() {
	local reg_ca14_aberto="${DIR_TRABALHO}/ca14-em-aberto.md"
	local reg_ca14_fechado="${DIR_TRABALHO}/ca14-fechada.md"
	escrever_registro_sintetico "${reg_ca14_aberto}" \
		"Operação (${MARCA_SUBSTITUTO} — configuração em ${DIR_TRABALHO}/operacao.env)" \
		"${DIR_TRABALHO}/operacao.env"
	escrever_registro_sintetico "${reg_ca14_fechado}" \
		"Operação (${MARCA_PROVISIONADA})" \
		"${ARQ_AMBIENTE_DA_OPERACAO}"

	local saida_do_aviso
	saida_do_aviso="$(avisar_se_ca14_em_aberto "${reg_ca14_aberto}" 2>&1 >/dev/null || true)"
	afirmar_contem "registro carimbado com '${MARCA_SUBSTITUTO}': a bateria emite o aviso de CA-14 em aberto" \
		"CA-14 EM ABERTO" "${saida_do_aviso}"
	afirmar_contem "o aviso de CA-14 em aberto nomeia o comando privilegiado que fecha o critério" \
		"${COMANDO_QUE_FECHA_CA14}" "${saida_do_aviso}"

	# O canal: o aviso é degradação declarada, e degradação não se mistura ao diagnóstico da saída
	# padrão. Devolver `aviso` para a saída padrão reprova esta linha.
	local saida_padrao_do_aviso
	saida_padrao_do_aviso="$(avisar_se_ca14_em_aberto "${reg_ca14_aberto}" 2>/dev/null || true)"
	afirmar_igual "o aviso de CA-14 em aberto sai pela saída de ERRO, e NADA dele sai pela saída padrão" \
		"" "${saida_padrao_do_aviso}"

	saida_do_aviso="$(avisar_se_ca14_em_aberto "${reg_ca14_fechado}" 2>&1 || true)"
	afirmar_igual "registro carimbado com '${MARCA_PROVISIONADA}' lendo ${ARQ_AMBIENTE_DA_OPERACAO}: NENHUM aviso de CA-14 em aberto" \
		"" "${saida_do_aviso}"

	# E o par sintético atravessa a MESMA asserção de forma e procedência que o registro versionado
	# atravessa — o que demonstra, dentro da própria bateria, por que ela não bastava: os dois
	# estados passam por ali identicamente, e só o aviso os distingue.
	afirmar_forma_e_procedencia "registro sintético com a CA-14 em aberto" "${reg_ca14_aberto}"
	afirmar_forma_e_procedencia "registro sintético com a CA-14 fechada" "${reg_ca14_fechado}"
}

ct_007() {
	caso "CT-007" "Apuração grava os dois lados e a conclusão de divergência, e é idempotente"

	# O alfabeto de cada lado é o de quem geraria aquela credencial de verdade: o helper de
	# instância efêmera do lado da verificação, `provisionar-base.sh` do lado da operação.
	local porta_verificacao porta_operacao
	if ! subir_instancia verificacao base64url; then
		falhar "não consegui subir a instância do lado da verificação (ver ${DIR_TRABALHO}/verificacao/)"
		fechar_caso "CT-007"
		return
	fi
	porta_verificacao="${PORTA_DA_INSTANCIA}"
	if ! subir_instancia operacao alfanumerica; then
		falhar "não consegui subir a instância do lado da operação (ver ${DIR_TRABALHO}/operacao/)"
		fechar_caso "CT-007"
		return
	fi
	porta_operacao="${PORTA_DA_INSTANCIA}"

	local versao_direta_verificacao versao_direta_operacao
	versao_direta_verificacao="$(versao_da_instancia verificacao "${porta_verificacao}")"
	versao_direta_operacao="$(versao_da_instancia operacao "${porta_operacao}")"
	nota "versão reportada pelas instâncias: verificação=[${versao_direta_verificacao}] operação=[${versao_direta_operacao}]"

	# Vem PRIMEIRO de propósito. Tudo o que segue depende de o procedimento ter conseguido apurar
	# os dois lados, e o bloco abaixo desiste do caso quando ele não consegue — se a asserção da
	# credencial viesse depois, um defeito que impedisse a apuração a impediria de rodar, e a
	# reprovação diria "não gravou o registro" em vez de nomear a classe que quebrou.
	ct_007_credencial_do_helper "${versao_direta_verificacao}"
	ct_007_credencial_com_especiais

	local registro="${DIR_TRABALHO}/REGISTRO-DE-TRABALHO.md"
	local codigo=0
	SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/verificacao.env" \
		SYSLOC_ARQ_AMBIENTE="${DIR_TRABALHO}/operacao.env" \
		SYSLOC_REGISTRO_VERSAO="${registro}" \
		bash "${SCRIPT_APURAR}" >"${DIR_TRABALHO}/apuracao-1.log" 2>&1 || codigo=$?
	afirmar_igual "1ª execução termina com código 0" "0" "${codigo}"

	if [[ ! -f "${registro}" ]]; then
		falhar "a 1ª execução não gravou o registro em ${registro} — ver ${DIR_TRABALHO}/apuracao-1.log"
		fechar_caso "CT-007"
		return
	fi

	# O valor esperado é o que a PRÓPRIA instância reporta — não um literal escrito aqui.
	afirmar_igual "o registro traz a versão do lado da verificação, idêntica à que a instância reporta" \
		"${versao_direta_verificacao}" "$(versao_no_registro "${registro}" "${ROTULO_VERIFICACAO}")"
	afirmar_igual "o registro traz a versão do lado da operação, idêntica à que a instância reporta" \
		"${versao_direta_operacao}" "$(versao_no_registro "${registro}" "${ROTULO_OPERACAO}")"

	afirmar_igual "o registro traz exatamente UMA linha de conclusão" \
		"1" "$(grep -cE '^(Sem divergência|Divergência)' "${registro}" || true)"
	afirmar_igual "o registro traz a data da apuração em formato ISO" \
		"1" "$(grep -cE '^Data da apuração: [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' "${registro}" || true)"
	afirmar_igual "o registro diz o que quem escrever a primeira migração precisa saber" \
		"1" "$(grep -c '^## O que quem escrever a primeira migração precisa saber$' "${registro}" || true)"

	# Procedência na cópia de trabalho: esta execução leu a configuração de um arquivo temporário,
	# então o rótulo TEM de marcar o substituto. É asserção comportamental — ela exercita a
	# derivação do rótulo dentro do procedimento real, e um rótulo literal fixo a reprova.
	afirmar_forma_e_procedencia "cópia de trabalho" "${registro}"

	# Idempotência (CA-11): a segunda execução sai 0 e o registro continua com UMA seção.
	codigo=0
	SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/verificacao.env" \
		SYSLOC_ARQ_AMBIENTE="${DIR_TRABALHO}/operacao.env" \
		SYSLOC_REGISTRO_VERSAO="${registro}" \
		bash "${SCRIPT_APURAR}" >"${DIR_TRABALHO}/apuracao-2.log" 2>&1 || codigo=$?
	afirmar_igual "2ª execução termina com código 0" "0" "${codigo}"
	afirmar_igual "o registro continua com exatamente UMA seção de apuração" \
		"1" "$(grep -c '^## Apuração$' "${registro}" || true)"
	afirmar_igual "o registro continua com exatamente UMA linha de conclusão" \
		"1" "$(grep -cE '^(Sem divergência|Divergência)' "${registro}" || true)"

	ct_007_forma_de_socket "${porta_operacao}" "${versao_direta_operacao}"
	ct_007_tabela_de_decomposicao
	ct_007_tabela_de_conclusao
	ct_007_registro_versionado
	ct_007_aviso_falsificavel

	fechar_caso "CT-007"
}

# =========================================================================== #
# CT-008 — apuração indisponível falha nomeando a fonte e preserva o registro.
# =========================================================================== #
ct_008() {
	caso "CT-008" "Apuração indisponível falha nomeando a fonte e preserva o registro anterior"

	local registro="${DIR_TRABALHO}/REGISTRO-DE-TRABALHO.md"
	if [[ ! -f "${registro}" ]]; then
		falhar "o registro produzido pelo CT-007 não existe — este caso precisa de um registro preexistente"
		fechar_caso "CT-008"
		return
	fi

	# Porta comprovadamente fechada: obtida da mesma faixa e deixada LIVRE de propósito. Nenhuma
	# instância provisionada é derrubada, parada ou bloqueada para produzir a condição.
	local porta_fechada
	porta_fechada="$(porta_livre)"
	local env_fechado="${DIR_TRABALHO}/operacao-fechada.env"
	install -m 0600 /dev/null "${env_fechado}"
	printf 'DATABASE_URL=postgresql://verificacao:naoimporta@127.0.0.1:%s/postgres\n' \
		"${porta_fechada}" >"${env_fechado}"

	local sha_antes sha_depois codigo saida
	sha_antes="$(sha256sum "${registro}" | cut -d' ' -f1)"

	# --- linha 1: endereço da operação em porta fechada ---
	codigo=0
	saida="$(
		SYSLOC_ARQ_AMBIENTE_VERIFICACAO="${DIR_TRABALHO}/verificacao.env" \
			SYSLOC_ARQ_AMBIENTE="${env_fechado}" \
			SYSLOC_REGISTRO_VERSAO="${registro}" \
			bash "${SCRIPT_APURAR}" 2>&1 >/dev/null
	)" || codigo=$?
	afirmar_igual "porta fechada: termina com código 1" "1" "${codigo}"
	afirmar_contem "porta fechada: a saída de erro nomeia o endereço" "127.0.0.1" "${saida}"
	afirmar_contem "porta fechada: a saída de erro nomeia a porta" "${porta_fechada}" "${saida}"
	afirmar_diferente "porta fechada: a saída de erro não é vazia" "" "${saida}"

	sha_depois="$(sha256sum "${registro}" | cut -d' ' -f1)"
	afirmar_igual "porta fechada: o registro não foi tocado (sha256 idêntico)" "${sha_antes}" "${sha_depois}"

	# --- linha 2: variável de configuração obrigatória ausente ---
	codigo=0
	saida="$(
		env -u SYSLOC_ARQ_AMBIENTE_VERIFICACAO \
			SYSLOC_ARQ_AMBIENTE="${DIR_TRABALHO}/operacao.env" \
			SYSLOC_REGISTRO_VERSAO="${registro}" \
			bash "${SCRIPT_APURAR}" 2>&1 >/dev/null
	)" || codigo=$?
	afirmar_igual "variável ausente: termina com código 1" "1" "${codigo}"
	afirmar_contem "variável ausente: a saída de erro nomeia a variável" \
		"SYSLOC_ARQ_AMBIENTE_VERIFICACAO" "${saida}"

	sha_depois="$(sha256sum "${registro}" | cut -d' ' -f1)"
	afirmar_igual "variável ausente: o registro não foi tocado (sha256 idêntico)" "${sha_antes}" "${sha_depois}"

	# --- o que a falha NÃO pode ter produzido ---
	afirmar_igual "nenhum arquivo temporário remanescente ao lado do registro" \
		"0" "$(find "$(dirname "${registro}")" -maxdepth 1 \( -name '*.tmp' -o -name '*.part' \) |
			grep -c . || true)"
	afirmar_igual "o registro não passou a conter a palavra 'indisponível'" \
		"0" "$(grep -ci 'indispon' "${registro}" || true)"
	afirmar_igual "o registro não passou a conter célula de versão vazia" \
		"0" "$(grep -cE '\| *`` *\|' "${registro}" || true)"

	fechar_caso "CT-008"
}

# =========================================================================== #
# CT-009 — o script versionado não carrega credencial (com prova de falsificação).
# =========================================================================== #
ct_009() {
	caso "CT-009" "Script versionado de apuração não carrega credencial e lê o segredo de fonte externa"

	# --- controle: o script real passa limpo ---
	if varrer_credencial "${SCRIPT_APURAR}" 2>"${DIR_TRABALHO}/varredura-controle.log"; then
		ok "o script versionado passa limpo na varredura (controle)"
	else
		falhar "o script versionado REPROVOU na varredura de credencial — ver ${DIR_TRABALHO}/varredura-controle.log"
		sed 's/^/         /' "${DIR_TRABALHO}/varredura-controle.log" >&2 || true
	fi

	# --- prova de falsificação: cada defeito reintroduzido precisa REPROVAR ---
	# As linhas defeituosas são montadas em pedaços de propósito: escritas inteiras, o texto
	# deste verificador casaria com os próprios padrões que ele procura.
	local mutante
	local -a defeitos=(
		"credencial em variável de ambiente exportada"
		"cadeia de conexão com segredo embutido"
		"rastreio verboso de comandos ligado"
		"referência à fonte externa do segredo removida"
	)
	local indice=0
	for indice in "${!defeitos[@]}"; do
		mutante="${DIR_TRABALHO}/mutante-${indice}.sh"
		cp "${SCRIPT_APURAR}" "${mutante}"
		case "${indice}" in
		0) printf 'export PGPASS%s"s3nh4RealDoBanco"\n' 'WORD=' >>"${mutante}" ;;
		1) printf '%s\n' "psql \"postgres""ql://sysloc_app:s3nh4RealDoBanco@127.0.0.1:5432/sysloc\"" >>"${mutante}" ;;
		2) printf 'set %s\n' '-x' >>"${mutante}" ;;
		3) grep -v 'PGPASSFILE' "${SCRIPT_APURAR}" >"${mutante}" ;;
		esac

		if varrer_credencial "${mutante}" 2>"${DIR_TRABALHO}/varredura-mutante-${indice}.log"; then
			falhar "a varredura APROVOU um script com o defeito de volta (${defeitos[${indice}]}) — a asserção não pode falhar"
		else
			ok "a varredura reprova o script com o defeito de volta (${defeitos[${indice}]})"
		fi
	done

	# --- higiene de segredo na árvore versionada ---
	local versionados
	versionados="$(git -C "${RAIZ_REPO}" ls-files)"
	afirmar_igual "nenhum arquivo .pfx versionado" \
		"0" "$(printf '%s\n' "${versionados}" | grep -c '\.pfx$' || true)"
	afirmar_igual "nenhum arquivo sob secrets/ versionado" \
		"0" "$(printf '%s\n' "${versionados}" | grep -cE '(^|/)secrets/' || true)"
	afirmar_igual "nenhum arquivo de ambiente versionado além do exemplo" \
		"" "$(printf '%s\n' "${versionados}" | grep -E '(^|/)\.env($|\.)' |
			grep -vE '(^|/)\.env\.example$' | tr '\n' ' ' | sed 's/ $//')"

	local ignorados
	ignorados="$(cat "${RAIZ_REPO}/.gitignore")"
	afirmar_contem "o .gitignore barra .env" ".env" "${ignorados}"
	afirmar_contem "o .gitignore barra *.pfx" "*.pfx" "${ignorados}"
	afirmar_contem "o .gitignore barra secrets/" "secrets/" "${ignorados}"

	fechar_caso "CT-009"
}

# O bloco de ressalva do resumo final, numa função só, porque ele é emitido nos dois canais e
# texto duplicado diverge na primeira edição de um dos lados.
resumo_da_pendencia_ca14() {
	printf 'ATENÇÃO: a CA-14 SEGUE EM ABERTO — o lado da operação daquele registro está carimbado\n'
	printf '  com %s, e não com %s. Estes 3/3 dizem que o procedimento\n' \
		"${MARCA_SUBSTITUTO}" "${MARCA_PROVISIONADA}"
	printf '  funciona; eles NÃO dizem que o critério de saída da fatia está fechado. Quem o\n'
	printf '  fecha é o operador, com privilégio:\n'
	printf '    %s\n' "${COMANDO_QUE_FECHA_CA14}"
}

main() {
	printf 'Verificação da apuração de versão do banco — %s\n' "${SCRIPT_APURAR}"

	if [[ ! -f "${SCRIPT_APURAR}" ]]; then
		printf 'ERRO: procedimento de apuração não encontrado: %s\n' "${SCRIPT_APURAR}" >&2
		exit 1
	fi

	local ferramenta
	local -a faltando=()
	for ferramenta in psql ss git sha256sum awk sed grep find install; do
		command -v "${ferramenta}" >/dev/null 2>&1 || faltando+=("${ferramenta}")
	done
	if [[ "${#faltando[@]}" -gt 0 ]]; then
		printf 'ERRO: ferramenta obrigatória ausente do PATH: %s\n' "${faltando[*]}" >&2
		exit 1
	fi

	if ! localizar_binarios_do_banco; then
		# Degradação NÃO silenciosa: sem os binários do banco não há como levantar instância
		# própria, e uma bateria que ficasse verde sem provar nada é pior do que uma vermelha.
		printf 'ERRO: não encontrei os binários do PostgreSQL (initdb/pg_ctl) nesta máquina.\n' >&2
		printf '      Eles são instalados por deploy/scripts/instalacao/provisionar-base.sh.\n' >&2
		exit 1
	fi
	printf 'binários do banco: %s\n' "${DIR_BIN_PG}"

	DIR_TRABALHO="$(mktemp -d -t sysloc-verificar-apuracao-XXXXXXXX)"
	chmod 0700 "${DIR_TRABALHO}"

	ct_007
	ct_008
	ct_009

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-apuracao-versao: 3/3 casos aprovados (CT-007, CT-008, CT-009)\n'
		if [[ "${CA14_EM_ABERTO}" -eq 1 ]]; then
			# A ressalva se repete aqui de propósito. O aviso do CT-007 rola para fora da tela;
			# este é o texto que sobra na frente de quem — ou do que — agrega esta bateria.
			printf 'registro versionado conferido NA FORMA E NA PROCEDÊNCIA: %s\n' "${REGISTRO_VERSIONADO}"
			# E sai pelos DOIS canais, uma vez em cada. O resumo de FALHA vai para a saída de erro;
			# se o único desfecho não-verde que sobrasse na saída padrão fosse este, um agregador
			# que reencaminhe a saída de erro e arquive a padrão perderia exatamente o sinal da
			# CA-14 — e a fatia sairia verde com o próprio critério de saída aberto. Deixá-lo só na
			# saída de erro tem o defeito simétrico: a saída padrão voltaria a se ler como sucesso
			# sem ressalva, que é o silêncio que a rodada anterior fechou.
			resumo_da_pendencia_ca14
			resumo_da_pendencia_ca14 >&2
		else
			printf 'registro versionado conferido: %s (lado da operação carimbado com %s — CA-14 fechada)\n' \
				"${REGISTRO_VERSIONADO}" "${MARCA_PROVISIONADA}"
		fi
		exit 0
	fi
	printf 'verificar-apuracao-versao: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
