#!/usr/bin/env bash
#
# CT-733 — o isolamento da VERIFICAÇÃO, em três afirmações executáveis.
#
# Caso coberto: CT-733 (CA-18, RN-16), da sub-fatia `documentos-e-confirmacao`.
#
# ---------------------------------------------------------------------------
# Por que este script existe, sendo que a suíte Vitest já roda
# ---------------------------------------------------------------------------
#
# A RN-16 diz duas coisas que NENHUM caso de Vitest pode afirmar sobre si mesmo:
#
#   1. *"nenhuma verificação alcança destinatário real"* — um caso que abrisse SMTP
#      de verdade **passaria**, e a caixa de uma pessoa real receberia a mensagem.
#      O que discrimina não é o resultado da suíte, é a **ausência de um caminho**
#      até o transporte, e ausência se mede varrendo o fonte da suíte;
#   2. *"nenhuma verificação escreve no sistema antigo"* — o `/opt/frappe` **atende
#      a operação** enquanto a F7 não acontece (ADR-0006), e um caso que gravasse
#      lá também passaria.
#
# A terceira afirmação é do Protocolo Antirregressão: **teste que some não falha,
# desaparece**. Só a contagem POR PACOTE, comparada com a baseline, o acusa — e
# ela precisa ser por pacote porque `turbo run test` ABORTA os pacotes irmãos
# quando um falha, e a saída agregada não carrega contagem confiável dos
# interrompidos.
#
# ---------------------------------------------------------------------------
# A prova de falsificação é PERMANENTE, e é o que separa este script de um grep
# ---------------------------------------------------------------------------
#
# A `.claude/rules/testing-stack.md` exige, para asserção que inspeciona o TEXTO
# do código, que se demonstre a asserção **reprovando** com o defeito
# reintroduzido, e um controle limpo passando no mesmo harness. Aqui os dois lados
# são casos deste script, e não uma medição feita uma vez e narrada num
# comentário: cada varredura roda sobre a árvore real (controle) e sobre uma cópia
# MUTANTE em caixa de areia, pela MESMA função — o que muda entre os dois lados é
# a árvore, nunca o critério. Um verificador que não encontrasse nada em lugar
# nenhum passaria no controle e reprovaria no mutante; um que encontrasse tudo
# faria o contrário. Nenhum dos dois passa nos dois.
#
# As três armadilhas que a rule nomeia estão fechadas aqui, uma a uma:
#
#   * **casar menção em vez de uso** — cada padrão tem CONTROLE POSITIVO sobre a
#     forma real que ele persegue (o adaptador SMTP de produção, os scripts de
#     caracterização que falam com o legado). Um padrão que não casasse mais nada
#     reprovaria ali, em vez de ficar verde sobre os alvos por não achar nada;
#   * **reimplementar o leitor dentro do verificador** — a linha que o mutante
#     ocupa é calculada do ARQUIVO (`wc -l` do original + 1), e não pela mesma
#     ferramenta que a varredura usa para achá-la;
#   * **provar o predicado e não o efeito terminal** — `varrer` devolve **status
#     de falha** quando acha, e é o status que as asserções afirmam nos dois
#     lados. Um verificador que só imprimisse ocorrências passaria no mutante.
#
# ---------------------------------------------------------------------------
# Contrato de saída — TRÊS códigos, e o `2` é conteúdo
# ---------------------------------------------------------------------------
#
#   0  nada a relatar: isolamento, monotonia e a suíte deste host, tudo verde.
#   1  REPROVADO no que este script existe para provar — a monotonia por pacote,
#      a varredura (b) ou a (c). É o vermelho que exige ação sobre a árvore.
#   2  isolamento e monotonia ÍNTEGROS, e o ÚNICO vermelho é caso reprovado na
#      suíte deste host (`failed != 0`), com pacote e contagem nomeados na linha
#      de fecho e os casos ofensores despejados em stderr.
#
# A partição existe porque a asserção *"nenhum caso reprovou"* é legítima e mais
# forte que a monotonia — retirá-la seria afrouxar a prova, e ela FICA —, mas
# fundida num único código de saída ela transfere ao artefato a saúde inteira da
# suíte NAQUELE host, defeito conhecido e intermitente incluído (o `CT-907`
# expira por timeout sob disputa de CPU). Um verificador que nunca sai verde no
# host real deixa de ser lido, e no dia em que (b) ou (c) reprovar de verdade —
# envio real, escrita no `/opt/frappe` — o achado passa junto com o ruído.
#
# A alternativa descartada foi acomodar o flake por lista de exceções nomeadas:
# é a válvula que apodrece, porque a lista cresce e ninguém a poda. Aqui NADA é
# excluído — o vermelho continua contado, nomeado e não-zero; o que muda é que
# ele deixa de se disfarçar de falha de isolamento. A separação é por contagem
# derivada (`falhas_totais` menos as suítes vermelhas), e não por rol de casos,
# de modo que uma falha estrutural nova volta a produzir `1` sem que ninguém
# precise mantê-la em lista alguma.
#
# ⚠️ Nenhum código não-zero significa "aprovado": consumidor que trate `!= 0`
#    como reprovação continua correto. Quem quiser a distinção lê 1 contra 2.
#
# Uso: bash deploy/scripts/documentos/verificar-isolamento-de-verificacao.sh
#
# ⚠️ Ele EXECUTA a suíte inteira, pacote a pacote — conte minutos, não segundos.
# ⚠️ Rode `rm -rf /tmp/sysloc-banco-*` antes: o disco do host já esteve em ~96%, e
#    `No space left on device` **se disfarça de teste vermelho**.

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Caixa de areia dos mutantes. NUNCA a árvore de trabalho: os dois casos aplicam
# defeito de propósito, e aplicá-lo no repositório deixaria arquivo de teste
# mutilado se o script morresse no meio.
DIR_TRABALHO="$(mktemp -d)"

# A caixa guarda também os LOGS da suíte, e log de execução reprovada é a única
# evidência do que aconteceu — quando um pacote nem produz linha de contagem, não
# há outra. Ver `preservar_evidencia`: quem aponta a caixa numa mensagem marca esta
# bandeira, e a limpeza a consulta em vez de remover incondicionalmente.
evidencia_a_preservar=0

# ENTRADA ÚNICA da preservação. Instalada por ponto de mensagem, a decisão diverge:
# na rodada 1 deste script duas mensagens mandavam abrir
# `${DIR_TRABALHO}/suite-<pacote>.log` e o `trap` removia o diretório antes de o
# controle voltar ao operador — o ponteiro apontava para arquivo inexistente, e no
# caminho "sem contagem" a evidência apagada era a única que havia.
preservar_evidencia() { evidencia_a_preservar=1; }

limpar() {
	local codigo=$?
	if [[ "${evidencia_a_preservar}" -ne 0 ]]; then
		printf '\nlogs preservados em %s\n' "${DIR_TRABALHO}" >&2
	else
		rm -rf "${DIR_TRABALHO}"
	fi
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

# --------------------------------------------------------------------------- #
# A BASELINE, por pacote — de onde cada número sai
# --------------------------------------------------------------------------- #
#
# É o estado ao fim da sub-fatia `regua-de-cobranca` MAIS a intervenção dirigida de
# 2026-08-12, que é o `1004` que a §3.2 da T12 fixa. A decomposição não é
# estimada: o `_run/run-report.md` daquela sub-fatia registra `1002` por pacote
# (shared 218 · contracts 267 · auth 89 · db 147 · api 203 · worker 48 · regua 30),
# e os dois casos que a intervenção acrescentou têm dono medido por `grep` —
# `CT-645` em `packages/shared/test/superficie-publica.spec.ts` (218 → 219) e
# `CT-646` em `packages/db/test/envio-de-cobranca.spec.ts` (147 → 148).
#
# `documentos` entra com **zero**, e o zero é conteúdo: o pacote nasceu na T4 desta
# sub-fatia. Omiti-lo da lista faria a suíte dele poder sumir inteira sem que nada
# reprovasse; declará-lo em zero mantém o pacote sob a mesma regra dos outros a
# partir daqui.
#
# A monotonia é afirmada POR PACOTE e não pelo total: um pacote que encolhesse
# enquanto outro crescesse manteria o total e passaria — que é exatamente a forma
# de regressão de prova que o P5 do Protocolo Antirregressão existe para pegar.
#
# ⚠️ REGRA DE MANUTENÇÃO — estes números têm ciclo de vida, e ele é obrigatório:
# **toda fatia que fechar sobe cada valor abaixo para a contagem por pacote do seu
# próprio fecho, e a subida é conferida no gate.** A baseline é o **piso da fatia
# anterior**, nunca um valor histórico. A razão é aritmética: o critério é
# `verdes < baseline`, de modo que cada fatia que passa sem subir o piso amplia a
# folga em que a suíte pode ENCOLHER com o verificador verde — deixá-la em 1004
# com a suíte em 1248 permitiria 244 casos sumirem sem que nada reprovasse, e são
# justamente os casos mais novos, os que ninguém ainda releu. O precedente do
# projeto é o docblock de `ROTAS_PUBLICADAS_EM_PRODUCAO`, que registra cada
# subida da âncora de rota (86 → 87 → 88 → 89) em vez de guardar o primeiro
# número; e o CT-732 escreve que ali as âncoras são **conferidas, nunca
# acrescentadas**. Aqui vale o mesmo: o valor sobe no fecho da fatia, com a
# contagem medida por pacote, e nunca por estimativa.
#
# Valor corrente: fim da sub-fatia `regua-de-cobranca` + intervenção dirigida de
# 2026-08-12 (1004). A sub-fatia `documentos-e-confirmacao` sobe estes números no
# seu fecho, com a contagem por pacote medida ali.
PACOTES=(contracts auth db regua worker api shared documentos)

declare -A BASELINE=(
	[contracts]=267
	[auth]=89
	[db]=148
	[regua]=30
	[worker]=48
	[api]=203
	[shared]=219
	[documentos]=0
)

BASELINE_TOTAL=1004

# --------------------------------------------------------------------------- #
# Os arquivos de teste NOVOS da sub-fatia — o alvo das duas varreduras
# --------------------------------------------------------------------------- #
#
# Lista DECLARADA, e não derivada do `git diff` nem do diretório: derivá-la faria
# um arquivo novo entrar nos dois lados da comparação ao mesmo tempo, e a varredura
# passaria sobre exatamente o arquivo que ninguém revisou. Ela é a mesma dos "dados
# de entrada" do card do CT-733.
ALVOS_NOVOS=(
	"packages/documentos/test"
	"packages/db/test/portador-de-confirmacao.spec.ts"
	"apps/api/test/confirmacao-de-email.e2e.spec.ts"
	"apps/api/test/documento-do-contrato.e2e.spec.ts"
	"apps/worker/test/confirmacao-de-email.spec.ts"
)

# O caminho até o transporte real, nas três formas que ele assume nesta base: a
# fábrica do `nodemailer`, o pacote em si e a fábrica do adaptador de produção
# (`criarAdaptadorSmtp`) — construir o adaptador real num teste é a MESMA falha que
# construir o transporte à mão, e um padrão que só casasse `createTransport` a
# deixaria passar.
#
# ⚠️ Ele casa **identificador**, e não a palavra `SMTP` solta. A escolha foi
# MEDIDA, e no sentido oposto ao habitual: um padrão largo com `[Ss][Mm][Tt][Pp]`
# acusou duas ocorrências reais desta árvore que são **prosa** —
# `normalizacao.spec.ts` dizendo *"o domínio não fala com SMTP"* e o nome do
# `CT-719`, *"responde 202 sem desfecho de SMTP"*. Casar menção em vez de uso é a
# primeira armadilha da `testing-stack.md`, e aqui ela apareceria como falha
# barulhenta que ensinaria a próxima rodada a afrouxar a asserção certa.
PADRAO_SMTP='createTransport|nodemailer|criarAdaptadorSmtp'

# A ÚNICA porta de saída legítima da verificação (ADR-0025): o capturador, que é
# implementação da mesma `PortaDeEnvioDeEmail` do adaptador de produção.
PADRAO_CAPTURADOR='criarCapturadorDeEmail'

# O caminho até o sistema antigo, nas formas que os scripts de caracterização de
# fato usam. ⚠️ O literal `docker compose exec` **não** casaria o uso real, que
# quebra a linha depois de `--project-directory`: um padrão colado à letra do card
# ficaria verde por não achar a forma que existe, que é a primeira armadilha da
# `testing-stack.md`. O controle positivo abaixo é o que prova que este padrão
# casa o acesso real.
#
# ⚠️ Ele permanece LARGO, e a escolha é o oposto da do `PADRAO_SMTP` acima — o
# critério que separa as duas é o custo assimétrico do erro, e não o gosto. Ali,
# um falso-positivo sobre prosa era o desfecho provável e MEDIDO (duas ocorrências
# reais), contra um alvo que assume três formas enumeráveis de identificador. Aqui,
# o acesso ao `/opt/frappe` assume formas que nenhum padrão estreito antecipa
# (`bench`, `docker compose`, `psql` contra o banco dele, caminho montado em
# variável, `cd` seguido de comando), e o site atende à OPERAÇÃO: um falso-negativo
# deixa passar escrita real no sistema que fatura, enquanto um falso-positivo custa
# ao operador ler uma linha nomeada e decidir. Preferimos o barulho. Se um dia um
# comentário legítimo do tipo *"esta suíte não fala com o /opt/frappe"* aparecer
# num arquivo de teste novo, a saída certa é reescrever o comentário — não estreitar
# o padrão, que é o que reabre a porta que ele guarda.
PADRAO_LEGADO='docker[ -]compose|bench --site|/opt/frappe'

# O adaptador de PRODUÇÃO e os scripts que falam com o legado — os dois controles
# positivos. Eles não são alvo de varredura: são a prova de que cada padrão casa a
# forma real que persegue.
FORMA_REAL_DO_SMTP="packages/regua/src/adaptador-smtp.ts"
FORMA_REAL_DO_LEGADO="deploy/scripts/caracterizacao"

falhas_totais=0
falhas_caso=0

# Os pacotes cujo vermelho é caso reprovado na suíte DESTE HOST, com a contagem — a
# natureza que o contrato de saída do cabeçalho separa no código 2. Cada entrada
# corresponde a EXATAMENTE uma falha contabilizada em `falhas_totais` (a asserção
# `nenhum caso reprovou`, uma por pacote), e é essa correspondência que torna a
# subtração em `main` uma classificação, e não uma estimativa.
suites_vermelhas=()

caso() {
	printf '\n[%s] %s\n' "$1" "$2"
	falhas_caso=0
}

ok() { printf '    OK   %s\n' "$*"; }

falhar() {
	falhas_caso=$((falhas_caso + 1))
	falhas_totais=$((falhas_totais + 1))
	printf '    FALHA %s\n' "$*" >&2
}

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
		falhar "$1 — obtido [$3], que não deveria ser [$2]"
	fi
}

aviso() { printf '    AVISO %s\n' "$*"; }

nota() { printf '    nota  %s\n' "$*"; }

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# --------------------------------------------------------------------------- #
# A varredura — UMA função, usada pelo controle e pelo mutante
# --------------------------------------------------------------------------- #
#
# Ela imprime `caminho:linha` relativo à raiz recebida, uma ocorrência por linha, e
# **devolve status 1 quando encontra alguma**. O status é parte do contrato, e não
# detalhe: é ele que as asserções da prova de falsificação afirmam. Um verificador
# que apenas imprimisse ocorrências ficaria verde sobre o mutante — é a terceira
# armadilha da `testing-stack.md`, a da guarda que prova o texto e não o efeito.
#
# A raiz é parâmetro para que a MESMA função rode sobre a árvore de trabalho e
# sobre a cópia mutante. Duas funções parecidas provariam que duas implementações
# concordam, não que esta discrimina.
varrer() {
	local raiz="$1"
	local padrao="$2"
	shift 2

	local achados
	achados="$(cd "${raiz}" && grep -rnE "${padrao}" "$@" 2>/dev/null || true)"

	if [[ -z "${achados}" ]]; then
		return 0
	fi

	printf '%s\n' "${achados}"
	return 1
}

# Quantas ocorrências a varredura devolveu — zero quando ela não devolveu nada.
# `grep -c` sobre saída vazia contaria 1 (a linha em branco), e a contagem errada
# apareceria justamente no lado em que o esperado é zero.
contar_ocorrencias() {
	if [[ -z "$1" ]]; then
		printf '0'
	else
		printf '%s' "$1" | grep -c .
	fi
}

# A primeira ocorrência no formato `arquivo:linha`, sem o texto casado. É o que a
# asserção do mutante compara, porque é o que um humano usa para ir até o defeito.
primeira_ocorrencia() {
	printf '%s' "$1" | head -1 | cut -d: -f1,2
}

# --------------------------------------------------------------------------- #
# CT-733 (a) — a suíte cresce, e NENHUM pacote encolhe
# --------------------------------------------------------------------------- #
#
# ⚠️ **O código de saída do `pnpm` NÃO é o critério**, e o desvio é declarado: o
# script `test` de `@sysloc/api` termina com saída 1 mesmo com todos os casos
# verdes quando o `ioredis` de `saude.e2e.spec.ts` emite `Unhandled Rejection` —
# achado PRÉ-EXISTENTE, intermitente, registrado pelos dois gates. Por isso o caso
# lê a CONTAGEM da saída do Vitest, e trata saída não-zero **sem caso reprovado**
# como aviso nomeado, nunca como sucesso silencioso: quando a contagem não puder
# ser lida, ele reprova, que é o que separa "defeito conhecido" de "a suíte nem
# rodou".
#
# ⚠️ E toda reprovação desta frente LEVA O DIAGNÓSTICO PARA A TELA, como (b) e (c)
# já faziam com as ocorrências das varreduras: a contagem sozinha diz que um caso
# reprovou e não diz QUAL, e o nome do ofensor mora dentro do log. Ver
# `despejar_do_log`.

# Quantas linhas do log um pacote reprovado despeja. O teto existe porque uma suíte
# inteira vermelha imprimiria centenas de linhas e empurraria o PRIMEIRO ofensor —
# que é o que o operador procura — para fora da tela.
MAXIMO_DE_LINHAS_DO_LOG=20

# Despeja em stderr as linhas do log que NOMEIAM os casos vermelhos, indentadas na
# mesma forma que (b) e (c) usam para as ocorrências (`sed 's/^/          /'`). A
# convenção do projeto é imprimir o achado na falha, em vez de apontar um caminho
# temporário — é o que o `verificar-golden.sh` faz.
#
# O fallback para a CAUDA do log não é ornamento: quando a execução nem produz linha
# de contagem, não existe linha de caso reprovado para casar, e a evidência útil está
# no FIM da saída — o erro de montagem, o `No space left on device`, o rastro do
# processo que morreu antes de contar caso algum.
despejar_do_log() {
	local log="$1"
	local linhas

	# Quem aponta a caixa preserva a caixa: a chamada aqui dentro é o que garante que
	# o arquivo citado na mensagem ainda exista quando o controle voltar ao operador.
	preservar_evidencia

	linhas="$(grep -E '^[[:space:]]*(×|FAIL)' "${log}" 2>/dev/null | head -n "${MAXIMO_DE_LINHAS_DO_LOG}" || true)"
	if [[ -z "${linhas}" ]]; then
		linhas="$(tail -n "${MAXIMO_DE_LINHAS_DO_LOG}" "${log}" 2>/dev/null || true)"
	fi

	if [[ -n "${linhas}" ]]; then
		printf '%s\n' "${linhas}" | sed 's/^/          /' >&2
	fi
}

ct_733_a() {
	caso "CT-733 (a)" "a contagem por pacote nunca é menor que a baseline de ${BASELINE_TOTAL}"

	if ! command -v pnpm >/dev/null 2>&1; then
		aviso "pnpm ausente no host — a monotonia por pacote NÃO foi verificada"
		fechar_caso "CT-733 (a)"
		return
	fi

	local total_verdes=0
	local pacote baseline log linha verdes falhados codigo

	for pacote in "${PACOTES[@]}"; do
		baseline="${BASELINE[${pacote}]}"
		log="${DIR_TRABALHO}/suite-${pacote}.log"

		# Cada pacote roda sozinho, e os resíduos do banco efêmero saem entre as
		# execuções: o disco do host já produziu `No space left on device`, que se
		# disfarça de teste vermelho.
		rm -rf /tmp/sysloc-banco-* 2>/dev/null || true

		codigo=0
		(cd "${RAIZ_REPO}" && pnpm --filter "@sysloc/${pacote}" test) >"${log}" 2>&1 || codigo=$?

		linha="$(grep -E '^[[:space:]]*Tests[[:space:]]+' "${log}" | tail -1 || true)"

		if [[ -z "${linha}" ]]; then
			falhar "${pacote}: a execução não produziu contagem de casos (saída ${codigo}) — ver ${log}"
			despejar_do_log "${log}"
			continue
		fi

		verdes="$(printf '%s' "${linha}" | sed -n 's/.*[^0-9]\([0-9]\{1,\}\) passed.*/\1/p')"
		falhados="$(printf '%s' "${linha}" | sed -n 's/.*[^0-9]\([0-9]\{1,\}\) failed.*/\1/p')"
		falhados="${falhados:-0}"

		if [[ -z "${verdes}" ]]; then
			falhar "${pacote}: a linha de contagem não traz casos verdes — [${linha}] — ver ${log}"
			despejar_do_log "${log}"
			continue
		fi

		afirmar_igual "${pacote}: nenhum caso reprovou" "0" "${falhados}"

		# A asserção acima diz QUANTOS reprovaram, e não diz QUAIS — o nome só existe
		# dentro do log. Sem este despejo o operador recebe `esperado [0], obtido [1]`
		# e reexecuta a suíte inteira à mão para descobrir o que o script já tinha lido.
		if [[ "${falhados}" -ne 0 ]]; then
			suites_vermelhas+=("${pacote} (${falhados} caso(s), ver ${log})")
			despejar_do_log "${log}"
		fi

		if [[ "${verdes}" -lt "${baseline}" ]]; then
			falhar "${pacote}: a suíte ENCOLHEU — baseline ${baseline}, obtido ${verdes}"
		else
			ok "${pacote}: ${verdes} casos verdes (baseline ${baseline})"
		fi

		if [[ "${codigo}" -ne 0 && "${falhados}" -eq 0 ]]; then
			aviso "${pacote}: saída ${codigo} com zero casos reprovados — defeito de encerramento do processo, não da suíte; ver ${log}"
			# A mensagem aponta a caixa: preservá-la é o que faz o ponteiro valer algo.
			# Aqui não se despeja nada — o caso passou, e vinte linhas de cauda fariam
			# de um aviso de defeito conhecido o ruído que ensina a ignorar o despejo
			# das falhas de verdade.
			preservar_evidencia
		fi

		total_verdes=$((total_verdes + verdes))
	done

	if [[ "${total_verdes}" -lt "${BASELINE_TOTAL}" ]]; then
		falhar "a suíte inteira encolheu — baseline ${BASELINE_TOTAL}, obtido ${total_verdes}"
	else
		ok "a suíte inteira soma ${total_verdes} casos verdes (baseline ${BASELINE_TOTAL})"
	fi

	rm -rf /tmp/sysloc-banco-* 2>/dev/null || true
	fechar_caso "CT-733 (a)"
}

# Copia os arquivos de teste novos para uma caixa de areia, preservando o caminho
# relativo — é o que faz `arquivo:linha` do mutante ser comparável ao da árvore
# real, e o que permite a MESMA função varrer os dois.
preparar_caixa() {
	local caixa="$1"
	local alvo

	mkdir -p "${caixa}"
	for alvo in "${ALVOS_NOVOS[@]}"; do
		mkdir -p "${caixa}/$(dirname "${alvo}")"
		cp -r "${RAIZ_REPO}/${alvo}" "${caixa}/${alvo}"
	done
}

# --------------------------------------------------------------------------- #
# CT-733 (b) — nenhuma verificação alcança destinatário real
# --------------------------------------------------------------------------- #
ct_733_b() {
	caso "CT-733 (b)" "nenhum arquivo de teste novo alcança SMTP; a saída é o capturador"

	local alvo achados ocorrencias codigo

	# Os alvos EXISTEM. Sem esta afirmação, um caminho renomeado faria a varredura
	# passar sobre o vazio — o modo de falha em que a asserção não pode falhar.
	for alvo in "${ALVOS_NOVOS[@]}"; do
		if [[ -e "${RAIZ_REPO}/${alvo}" ]]; then
			ok "o alvo da varredura existe: ${alvo}"
		else
			falhar "o alvo da varredura NÃO existe: ${alvo}"
		fi
	done

	# CONTROLE POSITIVO do padrão: ele casa a forma real do transporte, no
	# adaptador de produção. Sem isto, um padrão que não casasse mais nada ficaria
	# verde sobre os alvos por não achar nada em lugar nenhum.
	codigo=0
	achados="$(varrer "${RAIZ_REPO}" "${PADRAO_SMTP}" "${FORMA_REAL_DO_SMTP}")" || codigo=$?
	afirmar_igual "o padrão de SMTP casa o adaptador de PRODUÇÃO (controle positivo)" "1" "${codigo}"
	afirmar_diferente "o controle positivo nomeia ocorrência" "0" "$(contar_ocorrencias "${achados}")"

	# A árvore REAL: nenhuma ocorrência, e a falha nomeia `arquivo:linha`.
	codigo=0
	achados="$(varrer "${RAIZ_REPO}" "${PADRAO_SMTP}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	ocorrencias="$(contar_ocorrencias "${achados}")"
	afirmar_igual "nenhum arquivo de teste novo referencia SMTP" "0" "${ocorrencias}"
	afirmar_igual "a varredura de SMTP não acusa nada na árvore real" "0" "${codigo}"
	if [[ "${ocorrencias}" -ne 0 ]]; then
		printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	fi

	# E a via legítima está lá: o capturador, a implementação da porta que o
	# domínio declara. Sem esta linha, "nenhum SMTP" seria satisfeito por uma
	# suíte que não enviasse coisa alguma.
	codigo=0
	achados="$(varrer "${RAIZ_REPO}" "${PADRAO_CAPTURADOR}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	afirmar_igual "os testes novos que enviam usam o capturador" "1" "${codigo}"
	afirmar_diferente "o capturador aparece nomeado" "0" "$(contar_ocorrencias "${achados}")"

	# PROVA DE FALSIFICAÇÃO — permanente, e pela MESMA função.
	local caixa="${DIR_TRABALHO}/mutante-smtp"
	local vitima="apps/api/test/confirmacao-de-email.e2e.spec.ts"
	local linha_do_mutante

	preparar_caixa "${caixa}"

	# O controle da caixa: a cópia ÍNTEGRA passa limpa. É o que prova que o que
	# reprova abaixo é o defeito, e não o ato de copiar.
	codigo=0
	achados="$(varrer "${caixa}" "${PADRAO_SMTP}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	afirmar_igual "a cópia íntegra passa limpa no mesmo harness" "0" "${codigo}"

	# A linha é calculada do ARQUIVO, e não pela ferramenta que a varredura usa
	# para achá-la: derivá-la do próprio `grep` faria o verificador conferir a si
	# mesmo — a segunda armadilha da `testing-stack.md`.
	linha_do_mutante=$(($(wc -l <"${caixa}/${vitima}") + 1))
	printf "const transporte = nodemailer.createTransport({ host: 'smtp.real.com' });\n" \
		>>"${caixa}/${vitima}"

	codigo=0
	achados="$(varrer "${caixa}" "${PADRAO_SMTP}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	afirmar_igual "o mutante com transporte real REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação nomeia arquivo:linha" \
		"${vitima}:${linha_do_mutante}" "$(primeira_ocorrencia "${achados}")"

	fechar_caso "CT-733 (b)"
}

# --------------------------------------------------------------------------- #
# CT-733 (c) — nenhuma verificação escreve no sistema antigo
# --------------------------------------------------------------------------- #
ct_733_c() {
	caso "CT-733 (c)" "nenhum arquivo de teste novo fala com o /opt/frappe"

	local achados ocorrencias codigo

	# CONTROLE POSITIVO: o padrão casa o acesso REAL ao legado, que mora — e só
	# mora — em `deploy/scripts/caracterizacao/`. É a asserção que impede este caso
	# de ficar verde por perseguir uma forma que não existe.
	codigo=0
	achados="$(varrer "${RAIZ_REPO}" "${PADRAO_LEGADO}" "${FORMA_REAL_DO_LEGADO}")" || codigo=$?
	afirmar_igual "o padrão do legado casa a caracterização (controle positivo)" "1" "${codigo}"
	afirmar_diferente "o controle positivo nomeia ocorrência" "0" "$(contar_ocorrencias "${achados}")"

	# A árvore REAL: nenhuma ocorrência nos arquivos de teste.
	codigo=0
	achados="$(varrer "${RAIZ_REPO}" "${PADRAO_LEGADO}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	ocorrencias="$(contar_ocorrencias "${achados}")"
	afirmar_igual "nenhum arquivo de teste novo alcança o legado" "0" "${ocorrencias}"
	afirmar_igual "a varredura do legado não acusa nada na árvore real" "0" "${codigo}"
	if [[ "${ocorrencias}" -ne 0 ]]; then
		printf '%s\n' "${achados}" | sed 's/^/          /' >&2
	fi

	# PROVA DE FALSIFICAÇÃO — o verbo de ESCRITA contra o site que atende.
	local caixa="${DIR_TRABALHO}/mutante-legado"
	local vitima="apps/worker/test/confirmacao-de-email.spec.ts"
	local linha_do_mutante

	preparar_caixa "${caixa}"

	codigo=0
	achados="$(varrer "${caixa}" "${PADRAO_LEGADO}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	afirmar_igual "a cópia íntegra passa limpa no mesmo harness" "0" "${codigo}"

	linha_do_mutante=$(($(wc -l <"${caixa}/${vitima}") + 1))
	printf "await exec('docker compose exec -T backend bench --site frontend insert');\n" \
		>>"${caixa}/${vitima}"

	codigo=0
	achados="$(varrer "${caixa}" "${PADRAO_LEGADO}" "${ALVOS_NOVOS[@]}")" || codigo=$?
	afirmar_igual "o mutante que escreve no legado REPROVA a varredura" "1" "${codigo}"
	afirmar_igual "a reprovação nomeia arquivo:linha" \
		"${vitima}:${linha_do_mutante}" "$(primeira_ocorrencia "${achados}")"

	fechar_caso "CT-733 (c)"
}

main() {
	printf 'Isolamento da verificação — %s\n' "${RAIZ_REPO}"
	nota "a frente (a) executa a suíte inteira, pacote a pacote — conte minutos"

	ct_733_a
	ct_733_b
	ct_733_c

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-isolamento-de-verificacao: 3/3 frentes aprovadas (CT-733 a, b, c)\n'
		exit 0
	fi

	# A classificação é por SUBTRAÇÃO, e não por rol de casos tolerados: cada suíte
	# vermelha contribui com exatamente uma falha, de modo que o resto é falha do que
	# este script existe para provar. Ver o contrato de saída no cabeçalho — a
	# distinção entre 1 e 2 é o achado do Gate 2 da T12, e a alternativa (a lista de
	# exceções nomeadas) foi descartada ali.
	local vermelhas=${#suites_vermelhas[@]}
	local estruturais=$((falhas_totais - vermelhas))

	if [[ "${vermelhas}" -gt 0 && "${estruturais}" -le 0 ]]; then
		local resumo='' item
		for item in "${suites_vermelhas[@]}"; do
			resumo="${resumo:+${resumo}; }${item}"
		done
		printf 'verificar-isolamento-de-verificacao: isolamento e monotonia ÍNTEGROS; a suíte deste host tem %d pacote(s) com caso reprovado — %s\n' \
			"${vermelhas}" "${resumo}" >&2
		exit 2
	fi

	printf 'verificar-isolamento-de-verificacao: %d falha(s) — REPROVADO (%d estrutural(is), %d suíte(s) vermelha(s))\n' \
		"${falhas_totais}" "${estruturais}" "${vermelhas}" >&2
	exit 1
}

main "$@"
