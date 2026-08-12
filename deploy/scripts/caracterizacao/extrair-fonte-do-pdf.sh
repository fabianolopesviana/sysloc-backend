#!/usr/bin/env bash
#
# Extrai do sistema legado o FONTE do Server Script `PDF contrato` e o versiona
# como artefato golden.
#
# POR QUE ESTE SCRIPT EXISTE: a regra que compõe o documento do contrato tem 752
# linhas que existem **só dentro do banco** do Frappe — Server Script não é fixture,
# não tem arquivo no app, e desaparece com o `/opt/frappe` na virada (F7). O
# `contrato-pdf.txt` que já está versionado é a SAÍDA de rodar essa regra (174
# linhas de texto extraído do PDF); este artefato é a REGRA. Os dois não se
# substituem, e quem confundir um pelo outro porta o resultado em vez do
# procedimento.
#
# POR QUE A LEITURA É POR `SELECT`, E NÃO POR `bench --site <operação>`: o site que
# atende a operação é produção, e a ADR-0006 mantém a verificação fora dele. O
# `verificar-captura.sh` (CT-012) já fixou a fronteira em asserção executável —
# toda invocação com `--site` da operação presente em `deploy/scripts/caracterizacao/`
# tem de ter `backup` como subcomando, e `execute`/`console` estão proibidos ali.
# Um `bench --site <operação> execute` reprovaria aquele caso e, pior, executaria
# código Python dentro do site que atende a operação para ler um campo de texto.
# O caminho usado aqui é o mesmo que `consultar_banco_de_producao` já emprega: um
# `SELECT` no serviço de banco, autenticado como o USUÁRIO DA BASE (nunca `root`),
# com a credencial viajando por entrada padrão — nunca por `argv`, nunca por
# variável exportada, nunca ecoada (ADR-0005).
#
# POR QUE O VALOR VIAJA EM BASE64: o cliente de linha de comando escapa `\n` e `\t`
# no modo de lote e os devolve crus com `--raw`, e o campo tem 752 quebras de linha
# CRLF. Base64 tira a codificação da conversa: o que sai do banco é o que se grava,
# e o tamanho decodificado é conferido contra o `LENGTH()` da própria coluna — um
# truncamento de transporte reprova em vez de virar artefato mutilado.
#
# POR QUE O CABEÇALHO NÃO CARIMBA O INSTANTE DA EXTRAÇÃO: o determinismo é
# verificável (CT-603) porque recapturar produz byte a byte o mesmo arquivo. A data
# e a hora da extração moram no `PROCEDENCIA.md`, que é o único arquivo autorizado
# a diferir entre duas execuções — a mesma decisão que o CT-004 já protege para os
# artefatos de `capturar.py`. O "quando" que o cabeçalho carrega é o `modified` do
# documento no legado: a versão DA REGRA, que é dado do sistema antigo e não do
# relógio de quem extraiu.
#
# POR QUE A §5 DO MANIFESTO TEM UM MODO PRÓPRIO, SEM O LEGADO: o `PROCEDENCIA.md`
# tem dois autores — `capturar.py` escreve as seções 1 a 4, este script escreve da
# §5 em diante — e a §5 precisa ser regravável depois que o `/opt/frappe` sair do
# ar. Ela não depende do legado para nada: sai do array `INVENTARIO` declarado
# abaixo e do `modified` que a extração canônica já carimbou no cabeçalho do
# artefato versionado. Deixá-la alcançável só depois de `exigir_legado_de_pe` era
# acoplamento por POSIÇÃO DE CHAMADA, e tornava irrecuperável na F7 justamente a
# metade do oráculo que o CT-601 confere.
#
# Uso:
#   bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh [destino]
#   bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh --so-manifesto
#
# Sem argumento, grava no artefato versionado e atualiza a §5 do `PROCEDENCIA.md`.
# Com `destino`, grava apenas ali e NÃO toca a árvore versionada — é como o CT-603
# recaptura para conferir o determinismo.
# Com `--so-manifesto`, regrava apenas a §5 e NÃO fala com o legado — é o caminho
# que sobrevive à virada, exercitado pelo CT-640.

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REL_GOLDEN="docs/specs/features/caracterizacao-regras-legadas/v1/golden"
DIR_GOLDEN="${RAIZ_REPO}/${REL_GOLDEN}"
ARQ_FONTE="contrato-pdf-fonte.py"
ARQ_MANIFESTO="PROCEDENCIA.md"

DIR_FRAPPE="/opt/frappe"
ARQ_COMPOSE="${DIR_FRAPPE}/docker-compose.yaml"
ARQ_COMPOSE_OVERRIDE="${DIR_FRAPPE}/docker-compose.override.yml"
SERVICO="backend"
SERVICO_BANCO="db"
DIR_BENCH="/home/frappe/frappe-bench"

DOCUMENTO="PDF contrato"
DOCTYPE_DA_TABELA="tabServer Script"

# A primeira linha do artefato, e o separador entre o cabeçalho de procedência e o
# fonte. Constantes nomeadas porque as mesmas cadeias são conferidas literalmente
# pelo CT-601 — três literais soltos divergiriam.
CABECALHO_CANONICO="# CAPTURADO DO SISTEMA LEGADO — NÃO EDITAR À MÃO"
DELIMITADOR_DO_FONTE="# ----- fonte capturado abaixo, byte a byte: nada acrescentado, removido ou reordenado -----"

# A linha do cabeçalho que carrega a versão DA REGRA no legado. É escrita pela
# extração canônica e RELIDA pelo modo `--so-manifesto`: o carimbo tem uma fonte
# só, e declará-lo por constante neste script criaria uma terceira cópia do mesmo
# fato — livre para divergir das outras duas.
PREFIXO_MODIFICADO="# Última alteração no legado (modified): "

# O título da seção deste script dentro do manifesto, e o PREFIXO por onde os dois
# autores recortam. `capturar.py` reanexa o que vem a partir do mesmo prefixo
# (`compor_manifesto`): as duas pontas precisam casar, senão uma duplica o que a
# outra apaga.
TITULO_DA_SECAO="## 5. Inventário dos artefatos"
PREFIXO_DA_SECAO="## 5. "

# Inventário DECLARADO dos artefatos de `golden/`, escrito à mão aqui e gravado na
# §5 do manifesto. NÃO é derivado de `ls`: derivá-lo faria a bijeção do CT-601
# comparar o diretório consigo mesmo, e um artefato apagado sairia dos dois lados
# sem que nada reprovasse. É a mesma razão pela qual o `verificar-golden.sh` escreve
# a contagem de cenários da régua em vez de lê-la do artefato.
INVENTARIO=(
	"PROCEDENCIA.md|capturar.py|este manifesto: identificação da captura, máscaras e convenções"
	"atualizar-atrasos-cobrancas.json|capturar.py|oráculo da rotina de atualização de atraso"
	"calcular-mora.json|capturar.py|os 6 casos canônicos de \`_calcular_mora\`, portados sem reexecução"
	"contrato-ativacao.json|capturar.py|oráculo da ativação de contrato, com a virada de mês"
	"contrato-cancelamento.json|capturar.py|oráculo do cancelamento de contrato e da cascata"
	"contrato-pdf-fonte.py|extrair-fonte-do-pdf.sh|o FONTE do Server Script \`PDF contrato\` — a regra que compõe o documento"
	"contrato-pdf.txt|capturar.py|a SAÍDA da regra do documento: texto extraído do PDF gerado"
	"encerrar-contratos-vencidos.json|capturar.py|oráculo da rotina de encerramento de contrato vencido"
	"marcar-cobrancas-vencidas.json|capturar.py|oráculo da rotina que marca cobrança vencida"
	"metragem.json|capturar.py|oráculo da metragem derivada dos cômodos"
	"regua-de-cobranca.json|capturar.py|oráculo da régua de cobrança, com a divergência automático × manual"
)

DIR_TRABALHO="$(mktemp -d)"

limpar() {
	local codigo=$?
	rm -rf "${DIR_TRABALHO}"
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

aviso() { printf '[extrair-fonte-do-pdf] AVISO: %s\n' "$*" >&2; }
nota() { printf '[extrair-fonte-do-pdf] %s\n' "$*"; }

erro() {
	printf '[extrair-fonte-do-pdf] ERRO: %s\n' "$*" >&2
	exit 1
}

compose() {
	docker compose --project-directory "${DIR_FRAPPE}" \
		-f "${ARQ_COMPOSE}" -f "${ARQ_COMPOSE_OVERRIDE}" "$@"
}

no_container() {
	compose exec -T "${SERVICO}" bash -c "cd '${DIR_BENCH}' && $1"
}

# Terceira cópia do caminho de leitura autenticada do legado, e a mais próxima de
# `consultar_banco_de_producao` do `verificar-captura.sh`: leitura ESTRITAMENTE
# somente-leitura, autenticada como o usuário da base. A credencial entra por
# `stdin` e é consumida por um `read` dentro do container — nunca aparece em
# `argv`, onde qualquer `ps` a leria (ADR-0005).
#
# A cópia NÃO é literal, e a diferença é uma só: o `--raw`. Sem ele o cliente de
# linha de comando escapa a saída no modo de lote, e o `TO_BASE64` do MariaDB
# quebra a cada 76 caracteres — a razão está registrada por extenso no cabeçalho
# deste arquivo, e é ela que faz o transporte do fonte ser byte a byte.
#
# DÉBITO COM GATILHO — D3 · F3/T1 · registrado 2026-08-11
# O QUÊ: o caminho de leitura autenticada do legado existe em três cópias — esta,
#        `consultar_banco_de_producao` do `verificar-captura.sh`, e o par
#        `compose`/`no_container` que `preparar-site-efemero.sh` também replica.
# QUANDO FECHA: o QUARTO consumidor do caminho de leitura autenticada do legado,
#        OU a primeira alteração das garantias de transporte da credencial
#        (autenticar como usuário da base e nunca `root`; credencial por `stdin` e
#        nunca em `argv`; nunca ecoada) — endurecer uma cópia deixa as outras para trás.
# POR QUE NÃO AGORA: não existe biblioteca shell compartilhada neste projeto, e criar
#        uma seria ela própria um desvio; a `.claude/rules/testing-stack.md` documenta a
#        replicação do vocabulário deste diretório como convenção aceita. Com três cópias
#        e o legado saindo do ar na F7, o custo de extrair supera o de manter.
# ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D3
consultar_o_legado() { # consultar_o_legado <sql>
	printf '%s\n' "${credencial_da_base}" |
		compose exec -T "${SERVICO_BANCO}" bash -c \
			"IFS= read -r cred; MYSQL_PWD=\"\$cred\" mysql -N -B --raw -u '${base_da_operacao}' '${base_da_operacao}' -e \"$1\""
}

# Ausência do ambiente legado NUNCA sai zero: este script existe para fechar uma
# janela que não reabre, e um verde silencioso quando o Frappe não responde faria
# a fatia seguinte descobrir a ausência do artefato depois da virada.
exigir_legado_de_pe() {
	if ! command -v docker >/dev/null 2>&1; then
		aviso "o comando 'docker' não existe neste host — a extração não pode ser feita"
		exit 3
	fi
	if [[ ! -f "${ARQ_COMPOSE}" ]]; then
		aviso "${ARQ_COMPOSE} não existe: o ambiente legado foi desinstalado ou não está neste host"
		exit 3
	fi
	local emPe
	emPe="$(compose ps --status running --format '{{.Service}}' 2>/dev/null || true)"
	local servico
	for servico in "${SERVICO}" "${SERVICO_BANCO}"; do
		if ! printf '%s\n' "${emPe}" | grep -qx "${servico}"; then
			aviso "o serviço '${servico}' do ambiente legado não está de pé — nada foi extraído"
			exit 3
		fi
	done
}

# O site que atende a operação é identificado pelo `default_site` do bench, e nunca
# por literal: é a mesma regra que o `verificar-captura.sh` segue, e é ela que
# mantém o nome do site de produção fora dos scripts versionados.
ler_identidade_da_operacao() {
	site_da_operacao="$(no_container \
		"python3 -c \"import json;print(json.load(open('sites/common_site_config.json'))['default_site'])\"" |
		tr -d '\r\n')"
	[[ -n "${site_da_operacao}" ]] || erro "default_site ausente de sites/common_site_config.json"

	base_da_operacao="$(no_container \
		"python3 -c \"import json;print(json.load(open('sites/${site_da_operacao}/site_config.json'))['db_name'])\"" |
		tr -d '\r\n')"
	[[ -n "${base_da_operacao}" ]] || erro "db_name ausente do site_config.json do site de operação"

	# Do MESMO arquivo de onde sai `db_name`, e pelo mesmo motivo: é o par que
	# autentica a leitura da base do site. Nunca ecoada.
	credencial_da_base="$(no_container \
		"python3 -c \"import json;print(json.load(open('sites/${site_da_operacao}/site_config.json'))['db_password'])\"" |
		tr -d '\r\n')"
	[[ -n "${credencial_da_base}" ]] || erro "db_password ausente do site_config.json do site de operação"
}

extrair() { # extrair <arquivo_destino>
	local destino="$1"

	local ficha
	ficha="$(consultar_o_legado \
		"SELECT script_type, reference_doctype, modified, LENGTH(script) FROM \\\`${DOCTYPE_DA_TABELA}\\\` WHERE name='${DOCUMENTO}';")"
	[[ -n "${ficha}" ]] ||
		erro "o Server Script '${DOCUMENTO}' não existe no site que atende a operação"
	[[ "$(printf '%s\n' "${ficha}" | grep -c .)" == "1" ]] ||
		erro "a consulta por '${DOCUMENTO}' devolveu mais de um documento"

	local tipo referencia modificado bytes_declarados
	IFS=$'\t' read -r tipo referencia modificado bytes_declarados <<<"${ficha}"
	[[ "${bytes_declarados}" =~ ^[0-9]+$ ]] ||
		erro "LENGTH(script) ilegível para '${DOCUMENTO}': [${bytes_declarados}]"
	[[ "${bytes_declarados}" -gt 0 ]] ||
		erro "o campo 'script' de '${DOCUMENTO}' está vazio no legado"

	# O valor viaja codificado e é decodificado aqui: nenhum escape do cliente entra
	# no artefato, e o tamanho confere contra o que a própria coluna declara.
	consultar_o_legado \
		"SELECT TO_BASE64(script) FROM \\\`${DOCTYPE_DA_TABELA}\\\` WHERE name='${DOCUMENTO}';" |
		tr -d '\r\n' | base64 -d >"${DIR_TRABALHO}/fonte.bin"

	local bytes_obtidos
	bytes_obtidos="$(wc -c <"${DIR_TRABALHO}/fonte.bin" | tr -d ' ')"
	[[ "${bytes_obtidos}" == "${bytes_declarados}" ]] ||
		erro "transporte truncado: a coluna declara ${bytes_declarados} bytes e chegaram ${bytes_obtidos}"

	if ! python3 - "${DIR_TRABALHO}/fonte.bin" <<'PY'
import sys
from pathlib import Path

dados = Path(sys.argv[1]).read_bytes()
if b"\x00" in dados:
    print("o fonte contém byte NUL — não é texto", file=sys.stderr)
    raise SystemExit(1)
try:
    dados.decode("utf-8")
except UnicodeDecodeError as exc:
    print(f"o fonte não decodifica em UTF-8 estrito: {exc}", file=sys.stderr)
    raise SystemExit(1)
PY
	then
		erro "o fonte extraído não é texto UTF-8 — o artefato golden exige texto (CT-010)"
	fi

	# O terminador de linha é o do legado, preservado como está: o campo guarda CRLF,
	# e "byte a byte" inclui a quebra de linha. O `.gitattributes` da raiz declara o
	# caminho como não-texto para o git, sem o que o `core.autocrlf=input` deste host
	# normalizaria o artefato no índice e um clone novo passaria a divergir do que
	# este script produz — o determinismo do CT-603 reprovaria por infraestrutura.
	local terminador=$'\r\n'
	grep -q $'\r$' "${DIR_TRABALHO}/fonte.bin" || terminador=$'\n'

	{
		printf '%s%s' "${CABECALHO_CANONICO}" "${terminador}"
		printf '# Origem: Server Script `%s` — script_type=%s · reference_doctype=%s%s' \
			"${DOCUMENTO}" "${tipo}" "${referencia}" "${terminador}"
		printf '# Campo: `script` da tabela `%s`, lido por SELECT no banco do site que atende a operação%s' \
			"${DOCTYPE_DA_TABELA}" "${terminador}"
		printf '%s%s%s' "${PREFIXO_MODIFICADO}" "${modificado}" "${terminador}"
		printf '# Comando: bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh%s' "${terminador}"
		printf '# Procedência: %s/%s §5%s' "${REL_GOLDEN}" "${ARQ_MANIFESTO}" "${terminador}"
		printf '%s%s' "${DELIMITADOR_DO_FONTE}" "${terminador}"
		cat "${DIR_TRABALHO}/fonte.bin"
	} >"${DIR_TRABALHO}/artefato"

	# Gravação atômica: uma falha no meio da escrita não pode deixar meio artefato
	# no lugar do inteiro.
	mv "${DIR_TRABALHO}/artefato" "${destino}"

	modified_do_documento="${modificado}"
	linhas_do_fonte="$(grep -c '' "${DIR_TRABALHO}/fonte.bin" || true)"
	nota "documento: ${DOCUMENTO} (${tipo} · ${referencia}) · modified: ${modificado}"
	nota "fonte: ${bytes_obtidos} bytes · ${linhas_do_fonte} linhas → ${destino}"
}

# O `modified` que o modo offline usa sai do CABEÇALHO do artefato versionado —
# que é onde a extração canônica o carimbou, lido do legado. Depois da virada não
# há segunda fonte, e é por isso que a §5 continua regravável sem o Frappe de pé.
ler_modificado_do_artefato() {
	local artefato="${DIR_GOLDEN}/${ARQ_FONTE}"
	[[ -f "${artefato}" ]] ||
		erro "artefato ausente: ${artefato} — é dele que --so-manifesto lê a versão da regra"

	local linha
	linha="$(grep -m1 -F "${PREFIXO_MODIFICADO}" "${artefato}" | tr -d '\r')" ||
		erro "o cabeçalho de ${ARQ_FONTE} não traz a linha da versão da regra"

	modified_do_documento="${linha#"${PREFIXO_MODIFICADO}"}"
	[[ -n "${modified_do_documento}" ]] ||
		erro "a versão da regra está vazia no cabeçalho de ${ARQ_FONTE}"
}

# A §5 é reescrita inteira a cada execução, e não emendada: bloco emendado duplica
# quando o script roda duas vezes, e o manifesto é gerado, nunca editado à mão.
atualizar_manifesto() {
	local manifesto="${DIR_GOLDEN}/${ARQ_MANIFESTO}"
	[[ -f "${manifesto}" ]] || erro "manifesto ausente: ${manifesto}"

	printf '%s\n' "${INVENTARIO[@]}" >"${DIR_TRABALHO}/inventario.txt"

	python3 - "${manifesto}" "${DIR_TRABALHO}/inventario.txt" "${modified_do_documento}" \
		"${TITULO_DA_SECAO}" "${PREFIXO_DA_SECAO}" <<'PY'
import sys
from pathlib import Path

manifesto, inventario, modificado = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
TITULO, PREFIXO = sys.argv[4], sys.argv[5]

linhas = []
for bruto in inventario.read_text(encoding="utf-8").splitlines():
    if not bruto.strip():
        continue
    nome, produtor, descricao = bruto.split("|", 2)
    linhas.append(f"| `{nome}` | `{produtor}` | {descricao} |")

secao = "\n".join(
    [
        TITULO,
        "",
        "> Seção mantida por `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh`. A",
        "> lista é DECLARADA no script, nunca derivada do diretório: derivá-la faria a",
        "> bijeção do CT-601 comparar o `ls` consigo mesmo, e um artefato apagado sairia",
        "> dos dois lados sem reprovar nada.",
        ">",
        "> **Este manifesto tem dois autores, e a fronteira é esta seção.** As seções 1 a",
        "> 4 saem de `capturar.py`, que ao reescrever o arquivo RECORTA e REANEXA tudo o",
        "> que vem daqui em diante (`compor_manifesto`). Desta seção em diante o dono é",
        "> o extrator, e ela é regravável sem o sistema legado de pé:",
        "> `bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh --so-manifesto`.",
        "",
        "| Artefato | Produzido por | O que é |",
        "|---|---|---|",
        *linhas,
        "",
        "O 11º artefato não sai de `capturar.py`: `contrato-pdf-fonte.py` é o FONTE do",
        "Server Script `PDF contrato`, que existe apenas dentro do banco do sistema",
        "legado e desaparece com ele na virada. Ele foi lido por `SELECT` no serviço de",
        "banco, autenticado como o usuário da base — nenhum `bench` foi apontado para o",
        "site que atende a operação, e nada foi escrito lá (ADR-0006). O conteúdo é",
        "byte a byte o do campo `script`, sem máscara alguma: não há dado volátil nem",
        "credencial nele, e mascarar a regra destruiria justamente o que se captura.",
        "",
        f"Última alteração da regra no legado (`modified`): `{modificado}`. É esse o",
        "carimbo que o cabeçalho do artefato repete — o instante da EXTRAÇÃO fica de",
        "fora dos dois de propósito, para que recapturar produza byte a byte o mesmo",
        "arquivo e o determinismo (CT-603) seja verificável.",
        "",
    ]
)

texto = manifesto.read_text(encoding="utf-8")
# Recorta pelo PREFIXO, e não pelo título inteiro, para casar com o lado de
# `capturar.py`: se um cortasse mais largo que o outro, um título renomeado faria
# a seção ser duplicada por este script depois de ser preservada por aquele.
posicao = texto.find("\n" + PREFIXO)
if posicao != -1:
    texto = texto[: posicao + 1]
elif not texto.endswith("\n\n"):
    texto = texto.rstrip("\n") + "\n\n"

manifesto.write_text(texto + secao, encoding="utf-8")
PY

	nota "manifesto atualizado: ${REL_GOLDEN}/${ARQ_MANIFESTO} §5 (${#INVENTARIO[@]} artefatos declarados)"
}

main() {
	# O modo offline sai ANTES de qualquer pré-condição do legado, e é essa posição
	# que o torna executável depois da virada. Ele não chama `exigir_legado_de_pe`
	# nem `ler_identidade_da_operacao` — o CT-640 o roda com o `docker` mudo no
	# PATH e exige código 0, que é a asserção de que nenhuma das duas foi alcançada.
	if [[ "${1:-}" == "--so-manifesto" ]]; then
		[[ $# -eq 1 ]] ||
			erro "--so-manifesto não aceita destino: ele regrava a §5 e não extrai nada"
		[[ -d "${DIR_GOLDEN}" ]] || erro "diretório de golden não encontrado: ${DIR_GOLDEN}"
		ler_modificado_do_artefato
		atualizar_manifesto
		return
	fi

	[[ $# -le 1 ]] ||
		erro "uso: bash ${BASH_SOURCE[0]##*/} [destino|--so-manifesto] — recebi $# argumentos"

	local destino="${1:-}"
	local canonico=0
	if [[ -z "${destino}" ]]; then
		destino="${DIR_GOLDEN}/${ARQ_FONTE}"
		canonico=1
		[[ -d "${DIR_GOLDEN}" ]] || erro "diretório de golden não encontrado: ${DIR_GOLDEN}"
	else
		# Conferido ANTES de falar com o legado: descobrir que o destino não existe
		# depois de ler o documento gastaria a consulta e morreria no `mv`, com uma
		# mensagem do utilitário em vez da deste script.
		[[ -d "$(dirname "${destino}")" ]] ||
			erro "o diretório do destino não existe: $(dirname "${destino}")"
	fi

	exigir_legado_de_pe
	ler_identidade_da_operacao
	extrair "${destino}"

	if [[ "${canonico}" -eq 1 ]]; then
		atualizar_manifesto
	else
		nota "destino fora da árvore versionada: manifesto NÃO alterado"
	fi
}

site_da_operacao=""
base_da_operacao=""
credencial_da_base=""
modified_do_documento=""
linhas_do_fonte=""
main "$@"
