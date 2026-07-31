#!/usr/bin/env bash
#
# Verificação OFFLINE dos artefatos golden da caracterização (TC-001).
#
# Casos cobertos: CT-010, CT-011, CT-013 (metade estática), CT-014.
#
# Este script não fala com o Frappe. Ele lê apenas o que está versionado no
# repositório, e por isso continua executável depois que o backend legado for
# desinstalado (F7) — é a metade da verificação que sobrevive ao oráculo.
#
# Durabilidade é requisito, não efeito colateral: a ÚNICA leitura fora do
# repositório é o `docker-compose.yaml` do stack legado, de onde o CT-013 tira a
# agulha da varredura de credencial. Essa leitura é OPCIONAL e degradável — quando
# o arquivo não existir mais, a varredura da agulha é pulada com aviso e as demais
# asserções seguem valendo. Ausência do ambiente legado nunca reprova este script.
#
# Uso: bash deploy/scripts/caracterizacao/verificar-golden.sh

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REL_GOLDEN="docs/specs/features/caracterizacao-regras-legadas/v1/golden"
DIR_GOLDEN="${RAIZ_REPO}/${REL_GOLDEN}"
REL_SCRIPTS="deploy/scripts/caracterizacao"
DIR_SCRIPTS="${RAIZ_REPO}/${REL_SCRIPTS}"
ARQ_COMPOSE="/opt/frappe/docker-compose.yaml"

GOLDEN_ESPERADOS=(
	"PROCEDENCIA.md"
	"atualizar-atrasos-cobrancas.json"
	"calcular-mora.json"
	"contrato-pdf.txt"
	"encerrar-contratos-vencidos.json"
	"marcar-cobrancas-vencidas.json"
	"metragem.json"
)

falhas_totais=0
falhas_caso=0

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

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# --------------------------------------------------------------------------- #
# CT-010 — Documento de contrato: texto extraído, zero bytes de PDF versionados,
#          campos voláteis mascarados.
# --------------------------------------------------------------------------- #
ct_010() {
	caso "CT-010" "Documento de contrato — texto extraído e mascarado, sem bytes de PDF"

	local versionados
	versionados="$(git -C "${RAIZ_REPO}" ls-files "${REL_GOLDEN}/" | sort)"
	afirmar_igual "git ls-files sobre golden/ retorna 7 caminhos" \
		"7" "$(printf '%s\n' "${versionados}" | grep -c . || true)"

	local esperados_completos=()
	local nome
	for nome in "${GOLDEN_ESPERADOS[@]}"; do
		esperados_completos+=("${REL_GOLDEN}/${nome}")
	done
	afirmar_igual "o conjunto versionado é exatamente o dos 7 artefatos" \
		"$(printf '%s\n' "${esperados_completos[@]}" | sort)" "${versionados}"

	afirmar_igual "nenhum arquivo versionado com extensão binária (.pdf/.bin/.zip)" \
		"0" "$(printf '%s\n' "${versionados}" | grep -cE '\.(pdf|bin|zip)$' || true)"

	afirmar_igual "sem timestamp de geração (HH:MM:SS) em contrato-pdf.txt" \
		"0" "$(grep -cE '[0-9]{2}:[0-9]{2}:[0-9]{2}' "${DIR_GOLDEN}/contrato-pdf.txt" || true)"

	if python3 - "${DIR_GOLDEN}" <<'PY'
import re
import sys
from pathlib import Path

golden = Path(sys.argv[1])
erros = []

# `file --mime-type` não existe neste host; a propriedade que interessa — nenhum
# artefato é binário — é verificada diretamente: sem byte NUL e decodificável em
# UTF-8 estrito. É um critério mais forte que o do utilitário.
for arquivo in sorted(golden.iterdir()):
    dados = arquivo.read_bytes()
    if b"\x00" in dados:
        erros.append(f"{arquivo.name}: contém byte NUL (conteúdo binário)")
    try:
        dados.decode("utf-8")
    except UnicodeDecodeError as exc:
        erros.append(f"{arquivo.name}: não decodifica em UTF-8 estrito ({exc})")

contrato = golden / "contrato-pdf.txt"
assinatura = contrato.read_bytes()[:5]
if assinatura == b"%PDF-":
    erros.append("contrato-pdf.txt: começa com a assinatura %PDF- — são bytes de PDF")

texto = contrato.read_text(encoding="utf-8")

manifesto = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
casamento = re.search(
    r"Data e hora da captura\s*\|\s*(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}", manifesto
)
if not casamento:
    erros.append("PROCEDENCIA.md: data/hora da captura ausente ou fora do formato ISO")
else:
    ano, mes, dia = casamento.groups()
    for formato in (f"{ano}-{mes}-{dia}", f"{dia}/{mes}/{ano}"):
        if formato in texto:
            posicao = texto.index(formato)
            erros.append(
                f"contrato-pdf.txt: a data de captura {formato} sobrevive na posição {posicao}"
            )

marcadores = re.findall(r"<[A-Z_]+>", texto)
if not marcadores:
    erros.append("contrato-pdf.txt: nenhum marcador <NOME_DO_CAMPO> — nada foi mascarado")

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "artefatos são texto UTF-8, sem bytes de PDF e com a data de captura mascarada"
	else
		falhar "verificação de conteúdo de contrato-pdf.txt reprovou (ver acima)"
	fi

	fechar_caso "CT-010"
}

# --------------------------------------------------------------------------- #
# CT-011 — calcular-mora.json porta os 6 casos canônicos com saída exata,
#          conferida contra a fórmula documentada em `_calcular_mora`.
# --------------------------------------------------------------------------- #
ct_011() {
	caso "CT-011" "calcular-mora.json — 6 casos canônicos, 7 tuplas, saída exata"

	if python3 - "${DIR_GOLDEN}/calcular-mora.json" <<'PY'
import json
import sys
from decimal import Decimal, ROUND_HALF_UP

golden = json.loads(open(sys.argv[1], encoding="utf-8").read())
erros = []

casos = golden.get("casos", [])
if len(casos) != 6:
    erros.append(f"esperado 6 casos, encontrado {len(casos)}")


def arredondar(valor):
    """Réplica literal de `_arredondar_valor` do serviço legado."""
    return float(Decimal(str(float(valor))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def formula(valor_original, dias_atraso, multa_percentual, juros_percentual):
    """Réplica literal de `_calcular_mora`: juros simples, mês comercial de 30 dias."""
    valor_original = arredondar(valor_original)
    multa = arredondar(valor_original * float(multa_percentual) / 100.0)
    juros = arredondar(valor_original * (float(juros_percentual) / 100.0) / 30 * dias_atraso)
    total = arredondar(valor_original + multa + juros)
    return {"valor_multa": multa, "valor_juros": juros, "valor_total": total}


# Valores do teste-fonte TestCalcularMora (fonte externa ao check).
ESPERADO_POR_TUPLA = {
    (2000.0, 52, 2, 1): {"valor_multa": 40.00, "valor_juros": 34.67, "valor_total": 2074.67},
    (2000.0, 30, 2, 1): {"valor_multa": 40.00, "valor_juros": 20.00, "valor_total": 2060.00},
    (2000.0, 60, 2, 1): {"valor_multa": 40.00, "valor_juros": 40.00, "valor_total": 2080.00},
    (2000.0, 52, 50, 1): {"valor_multa": 1000.00, "valor_juros": 34.67, "valor_total": 3034.67},
    (2000.0, 5, 2, 1): {"valor_multa": 40.00, "valor_juros": 3.33, "valor_total": 2043.33},
    (2000.0, 500, 2, 1): {"valor_multa": 40.00, "valor_juros": 333.33, "valor_total": 2373.33},
    (1234.56, 17, 2, 1): {"valor_multa": 24.69, "valor_juros": 7.00, "valor_total": 1266.25},
}

CHAVES_ENTRADA = ("valor_original", "dias_atraso", "multa_percentual", "juros_percentual")
CHAVES_SAIDA = ("valor_multa", "valor_juros", "valor_total")

observado = {}
for caso in casos:
    invocacoes = caso.get("invocacoes") or []
    if not invocacoes:
        erros.append(f"caso {caso.get('id')!r} sem invocações")
    for invocacao in invocacoes:
        entrada, saida = invocacao.get("entrada", {}), invocacao.get("saida", {})
        faltando = [c for c in CHAVES_ENTRADA if c not in entrada]
        faltando += [c for c in CHAVES_SAIDA if c not in saida]
        if faltando:
            erros.append(f"caso {caso.get('id')!r}: campos ausentes {faltando}")
            continue

        tupla = tuple(entrada[c] for c in CHAVES_ENTRADA)
        observado[tupla] = saida

        esperado = ESPERADO_POR_TUPLA.get(tupla)
        if esperado is None:
            erros.append(f"caso {caso.get('id')!r}: tupla inesperada {tupla}")
            continue
        for chave in CHAVES_SAIDA:
            if saida[chave] != esperado[chave]:
                erros.append(
                    f"caso {caso.get('id')!r} {tupla}: {chave} esperado "
                    f"{esperado[chave]}, encontrado {saida[chave]}"
                )

        rederivado = formula(*tupla)
        for chave in CHAVES_SAIDA:
            if saida[chave] != rederivado[chave]:
                erros.append(
                    f"caso {caso.get('id')!r} {tupla}: {chave} diverge da fórmula "
                    f"documentada — golden {saida[chave]}, fórmula {rederivado[chave]}"
                )

        if saida["valor_total"] != round(
            entrada["valor_original"] + saida["valor_multa"] + saida["valor_juros"], 2
        ):
            erros.append(
                f"caso {caso.get('id')!r} {tupla}: valor_total não é a soma das partes"
            )

faltantes = sorted(set(ESPERADO_POR_TUPLA) - set(observado))
if faltantes:
    erros.append(f"tuplas canônicas ausentes do golden: {faltantes}")

# Relações estruturais: são elas que provam o REGIME de cálculo, não só os números.
if not faltantes:
    j30 = observado[(2000.0, 30, 2, 1)]["valor_juros"]
    j60 = observado[(2000.0, 60, 2, 1)]["valor_juros"]
    if j60 != round(j30 * 2, 2) or j60 != 40.00:
        erros.append(f"linearidade dos juros violada: j30={j30}, j60={j60}")

    j_multa2 = observado[(2000.0, 52, 2, 1)]["valor_juros"]
    j_multa50 = observado[(2000.0, 52, 50, 1)]["valor_juros"]
    if j_multa2 != j_multa50 or j_multa2 != 34.67:
        erros.append(
            "juros incidindo sobre a multa: "
            f"multa 2% -> {j_multa2}, multa 50% -> {j_multa50}"
        )

    m5 = observado[(2000.0, 5, 2, 1)]["valor_multa"]
    m500 = observado[(2000.0, 500, 2, 1)]["valor_multa"]
    if m5 != m500 or m5 != 40.00:
        erros.append(f"multa deixou de ser única: 5 dias -> {m5}, 500 dias -> {m500}")

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "6 casos, 7 tuplas canônicas, valores exatos e coerentes com a fórmula"
	else
		falhar "calcular-mora.json divergiu do teste-fonte ou da fórmula (ver acima)"
	fi

	fechar_caso "CT-011"
}

# --------------------------------------------------------------------------- #
# CT-013 (metade estática) — a credencial de root do MariaDB não vaza para
#          nenhum arquivo versionado, e os scripts não a carregam em literal.
# --------------------------------------------------------------------------- #
ct_013_estatico() {
	caso "CT-013" "MYSQL_ROOT_PASSWORD não vaza para arquivo versionado (metade estática)"

	# CAUSA-RAIZ da versão anterior: o `docker-compose.yaml` do stack legado era
	# tratado como dependência obrigatória — ausência do arquivo chamava `falhar` e
	# retornava cedo. No dia da F7, que é evento PLANEJADO deste programa, o script
	# que existe justamente para revalidar os golden sem o oráculo passaria a
	# REPROVAR por falta de um artefato do ambiente que se acabou de desinstalar; e
	# o `return` ainda derrubava as três sub-asserções que nada têm a ver com o
	# compose. A dependência passa a ser opcional e degradável.
	#
	# Não versionamos hash da credencial como agulha alternativa de propósito: o
	# valor deste ambiente é uma palavra de dicionário de 5 caracteres, e publicar
	# seu hash no repositório equivale a publicar o valor.
	local credencial_db=""
	if [[ ! -f "${ARQ_COMPOSE}" ]]; then
		printf '    ..   %s não existe (ambiente legado desinstalado): varredura da agulha pulada\n' \
			"${ARQ_COMPOSE}"
	else
		# A credencial é lida em runtime e mantida em variável de shell não exportada.
		# Ela nunca é ecoada, nem passada por argv (viagem exclusiva por stdin), nem
		# gravada em arquivo temporário.
		credencial_db="$(awk '
		/^[[:space:]][[:space:]][a-zA-Z0-9_-]+:[[:space:]]*$/ { dentro_db = ($0 ~ /^[[:space:]][[:space:]]db:[[:space:]]*$/) }
		dentro_db && /MYSQL_ROOT_PASSWORD:/ {
			sub(/^[^:]*:[[:space:]]*/, "")
			gsub(/^"|"$/, "")
			gsub(/^'"'"'|'"'"'$/, "")
			print
			exit
		}
	' "${ARQ_COMPOSE}")"
		if [[ -z "${credencial_db}" ]]; then
			falhar "MYSQL_ROOT_PASSWORD não encontrado no serviço 'db' de ${ARQ_COMPOSE}"
		fi
	fi

	local varredura
	varredura="$(mktemp)"
	cat >"${varredura}" <<'PY'
"""Procura a credencial na árvore versionada. Recebe o valor por stdin; nunca o imprime."""
import re
import subprocess
import sys
from pathlib import Path

raiz = Path(sys.argv[1])
# A varredura é da árvore versionada INTEIRA e qualquer ocorrência reprova, exceto
# as que já existiam antes desta task e estão listadas nominalmente abaixo. A
# credencial deste ambiente é uma palavra de dicionário de 5 caracteres e casa
# legitimamente com prosa de documentação de outras features (nome de papel de
# usuário, exemplo de payload) — recortar por pasta deixaria vazamento novo fora
# daquelas pastas passar; a lista explícita não deixa. Ocorrência em posição
# diferente da listada também reprova:
# é sinal de que a linha mudou e a baseline precisa ser reavaliada à mão.
#
# ATENÇÃO: `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md` registra o valor
# da credencial em texto claro. É exposição real, pré-existente e de outra feature —
# fica documentada aqui, não silenciada.
PREEXISTENTES = {
    ".claude/skills/agent-spec-backend-contract-handoff/references/api-error-patterns.md:76",
    ".claude/skills/agent-spec-backend-contract-handoff/references/auth-and-permissions.md:51",
    ".claude/skills/agent-spec-backend-contract-handoff/references/auth-and-permissions.md:53",
    ".claude/skills/agent-spec-backend-contract-handoff/references/auth-and-permissions.md:95",
    ".claude/skills/agent-spec-backend-contract-handoff/references/auth-and-permissions.md:149",
    ".claude/skills/agent-spec-pre-refinement/evals/evals.json:41",
    ".claude/skills/agent-spec-testing-best-practices/references/padroes.md:114",
    ".claude/skills/agent-spec-testing-best-practices/references/padroes.md:117",
    "docs/specs/features/integracao-bancaria-configuravel/v1/handoff-frontend.md:659",
    "docs/specs/features/integracao-bancaria-configuravel/v1/handoff-frontend.md:1002",
    "docs/specs/features/integracao-bancaria-configuravel/v5/_run/rule-candidates.md:6",
    "docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:677",
    "docs/specs/features/saas-multi-empresa/v1/tasks/T9.md:932",
}

agulha = sys.stdin.readline().rstrip("\n")
if not agulha:
    print("credencial vazia — varredura inconclusiva", file=sys.stderr)
    sys.exit(2)

# Casamento por token: a credencial deste ambiente é uma palavra curta e comum,
# e busca por substring pura acusaria `--admin-password` ou `Administrator` como
# vazamento. O que caracteriza vazamento é o VALOR isolado, não a sequência de
# letras dentro de um identificador maior.
padrao = re.compile(
    r"(?:^|[^A-Za-z0-9_-])" + re.escape(agulha) + r"(?:[^A-Za-z0-9_-]|$)"
)

versionados = subprocess.run(
    ["git", "-C", str(raiz), "ls-files", "-z"],
    capture_output=True, check=True, text=True,
).stdout.split("\0")

reprovacoes, avisos = [], []
for relativo in versionados:
    if not relativo:
        continue
    caminho = raiz / relativo
    try:
        conteudo = caminho.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        continue
    for numero, linha in enumerate(conteudo.splitlines(), 1):
        if not padrao.search(linha):
            continue
        ocorrencia = f"{relativo}:{numero}"
        alvo = avisos if ocorrencia in PREEXISTENTES else reprovacoes
        alvo.append(ocorrencia)

for aviso in sorted(avisos):
    print(f"AVISO: ocorrência pré-existente e catalogada em {aviso}", file=sys.stderr)
for reprovacao in sorted(reprovacoes):
    print(f"credencial encontrada em {reprovacao}", file=sys.stderr)

nao_encontradas = sorted(PREEXISTENTES - set(avisos))
if nao_encontradas:
    # A baseline deixou de bater: ou a ocorrência sumiu (ótimo, atualizar a lista)
    # ou mudou de linha (e a nova posição já reprovou acima).
    for ausente in nao_encontradas:
        print(f"AVISO: ocorrência catalogada não encontrada em {ausente}", file=sys.stderr)

sys.exit(1 if reprovacoes else 0)
PY

	if [[ -z "${credencial_db}" ]]; then
		printf '    ..   sem agulha disponível: varredura de credencial na árvore versionada pulada\n'
	elif printf '%s\n' "${credencial_db}" | python3 "${varredura}" "${RAIZ_REPO}"; then
		ok "a credencial não aparece em nenhuma posição nova da árvore versionada"
	else
		falhar "a credencial aparece na árvore versionada (arquivo:linha acima; valor omitido)"
	fi
	rm -f "${varredura}"

	afirmar_igual "nenhum literal de senha atribuído nos scripts" "0" \
		"$(grep -rnE "(PASSWORD|password|senha)[[:space:]]*=[[:space:]]*[\"'][^\"']+" "${DIR_SCRIPTS}" | grep -c . || true)"

	# Padrão escrito com classe de caractere de propósito: um literal `set` seguido
	# de `-x` casaria com esta própria linha e a busca acusaria a si mesma.
	afirmar_igual "nenhum rastreio de shell ligado em preparar-site-efemero.sh e capturar.py" "0" \
		"$(grep -nE 'set[[:space:]]+-x' \
			"${DIR_SCRIPTS}/preparar-site-efemero.sh" "${DIR_SCRIPTS}/capturar.py" | grep -c . || true)"

	# Esta continua valendo sem o ambiente legado: é leitura do próprio repositório.
	local referencias_compose
	referencias_compose="$(grep -c 'docker-compose.yaml' "${DIR_SCRIPTS}/preparar-site-efemero.sh" || true)"
	if [[ "${referencias_compose}" -ge 1 ]]; then
		ok "preparar-site-efemero.sh lê a credencial de docker-compose.yaml em runtime"
	else
		falhar "preparar-site-efemero.sh não referencia docker-compose.yaml como fonte da credencial"
	fi

	fechar_caso "CT-013"
}

# --------------------------------------------------------------------------- #
# CT-014 — PROCEDENCIA.md completo e em bijeção com as máscaras aplicadas.
# --------------------------------------------------------------------------- #
ct_014() {
	caso "CT-014" "PROCEDENCIA.md completo e em bijeção com as máscaras dos golden"

	if python3 - "${DIR_GOLDEN}" <<'PY'
import json
import re
import sys
from pathlib import Path

golden = Path(sys.argv[1])
manifesto = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
erros = []

CAMPOS_OBRIGATORIOS = (
    "Data e hora da captura",
    "Site de captura",
    "Dump de origem",
    "Timestamp do dump",
    "Versão do app (commit)",
    "Versões do bench",
)

valores = {}
for campo in CAMPOS_OBRIGATORIOS:
    casamento = re.search(
        r"^\|\s*" + re.escape(campo) + r"\s*\|\s*(.+?)\s*\|\s*$", manifesto, re.MULTILINE
    )
    if not casamento or not casamento.group(1).strip():
        erros.append(f"campo obrigatório ausente ou vazio no manifesto: {campo}")
    else:
        valores[campo] = casamento.group(1).strip()

if "Data e hora da captura" in valores and not re.fullmatch(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", valores["Data e hora da captura"]
):
    erros.append(
        "Data e hora da captura fora do formato AAAA-MM-DDTHH:MM:SS: "
        + valores["Data e hora da captura"]
    )

if valores.get("Site de captura") != "caracterizacao.localhost":
    erros.append(f"site de captura inesperado: {valores.get('Site de captura')!r}")

dump = valores.get("Dump de origem", "")
casamento_dump = re.fullmatch(r"sites/([^/]+)/private/backups/(.+\.sql\.gz)", dump)
if not casamento_dump:
    erros.append(f"caminho do dump não aponta para private/backups: {dump!r}")
else:
    site_origem = casamento_dump.group(1)
    if site_origem == "caracterizacao.localhost":
        erros.append("o dump de origem aponta para o próprio site efêmero")
    # O site que atende a operação só pode ser citado como origem do dump.
    for numero, linha in enumerate(manifesto.splitlines(), 1):
        if site_origem in linha and "private/backups/" not in linha:
            erros.append(
                f"PROCEDENCIA.md:{numero}: o site de produção é citado fora da "
                "linha de origem do dump"
            )
    if not re.search(r"\d{8}_\d{6}", casamento_dump.group(2)):
        erros.append(f"o nome do dump não carrega timestamp: {casamento_dump.group(2)!r}")

if "Timestamp do dump" in valores and not re.fullmatch(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", valores["Timestamp do dump"]
):
    erros.append(f"timestamp do dump fora do formato ISO: {valores['Timestamp do dump']!r}")

if "Versão do app (commit)" in valores and not re.fullmatch(
    r"[0-9a-f]{40}", valores["Versão do app (commit)"]
):
    erros.append(
        f"versão do app sem identificador de commit: {valores['Versão do app (commit)']!r}"
    )

# ---- bijeção entre máscaras documentadas e marcadores presentes nos golden ----
secao = re.search(r"\n## 2\. Máscaras aplicadas\n(.*?)(?=\n## )", manifesto, re.DOTALL)
if not secao:
    erros.append("seção '## 2. Máscaras aplicadas' ausente do manifesto")
    documentados = set()
else:
    corpo = secao.group(1)
    documentados = set(re.findall(r"<[A-Z_]+>", corpo))
    for linha in corpo.splitlines():
        if not re.search(r"<[A-Z_]+>", linha):
            continue
        colunas = [c.strip() for c in linha.strip().strip("|").split("|")]
        if len(colunas) < 4:
            erros.append(f"linha de máscara com colunas faltando: {linha.strip()!r}")
            continue
        motivo = colunas[3]
        if len(motivo) < 20 or motivo.upper().startswith("TODO"):
            erros.append(f"máscara {colunas[0]} sem motivo escrito: {motivo!r}")

presentes = set()
for arquivo in sorted(golden.iterdir()):
    if arquivo.name == "PROCEDENCIA.md":
        continue
    presentes |= set(re.findall(r"<[A-Z_]+>", arquivo.read_text(encoding="utf-8")))

orfaos_no_golden = sorted(presentes - documentados)
orfaos_no_manifesto = sorted(documentados - presentes)
if orfaos_no_golden:
    erros.append(f"marcadores aplicados e não documentados: {orfaos_no_golden}")
if orfaos_no_manifesto:
    erros.append(f"marcadores documentados e ausentes dos golden: {orfaos_no_manifesto}")

# ---- observação de divergência aritmética: bijeção com metragem.json ----
# Mesma exigência do CT-007, aqui na metade OFFLINE: os dois artefatos são
# versionados, então a correlação continua verificável depois que o Frappe sumir.
# Vale nos dois sentidos — observação sem divergência reprova tanto quanto
# divergência sem observação, e é o segundo sentido que impede o produtor de
# emitir a linha incondicionalmente.
TAG_DIVERGENCIA = "DIVERGENCIA-METRAGEM"

metragem = json.loads((golden / "metragem.json").read_text(encoding="utf-8"))
divergentes = {}
for chave, cenario in sorted(metragem["cenarios"].items()):
    soma = round(
        sum(
            float(comodo["metragem"])
            for comodo in cenario["comodos_entrada"]
            if comodo.get("metragem")
        ),
        2,
    )
    agregado = cenario.get("valor_agregado")
    if agregado is None or round(float(agregado), 2) != soma:
        divergentes[chave] = (agregado, soma)

observacoes = re.search(
    r"\n## 4\. Observações sobre o comportamento capturado\n(.*?)(?=\n## |\Z)",
    manifesto,
    re.DOTALL,
)
corpo_observacoes = observacoes.group(1) if observacoes else ""
if not observacoes:
    erros.append("seção '## 4. Observações sobre o comportamento capturado' ausente do manifesto")

linhas_divergencia = [
    linha for linha in corpo_observacoes.splitlines() if TAG_DIVERGENCIA in linha
]

for chave, (agregado, soma) in divergentes.items():
    if not any(
        chave in linha and str(agregado) in linha and str(soma) in linha
        for linha in linhas_divergencia
    ):
        erros.append(
            f"cenário {chave} diverge da soma aritmética ({agregado!r} != {soma}) e o "
            "manifesto não traz a observação com o cenário e os dois números"
        )

for linha in linhas_divergencia:
    if not any(chave in linha for chave in divergentes):
        erros.append(
            "manifesto declara divergência de metragem sem divergência correspondente "
            f"em metragem.json: {linha.strip()!r}"
        )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "manifesto completo e em bijeção com os marcadores dos 6 golden"
	else
		falhar "PROCEDENCIA.md incompleto ou fora de bijeção (ver acima)"
	fi

	fechar_caso "CT-014"
}

main() {
	printf 'Verificação offline dos golden — %s\n' "${DIR_GOLDEN}"

	if [[ ! -d "${DIR_GOLDEN}" ]]; then
		printf 'ERRO: diretório de golden não encontrado: %s\n' "${DIR_GOLDEN}" >&2
		exit 1
	fi

	ct_010
	ct_011
	ct_013_estatico
	ct_014

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-golden: 4/4 casos aprovados (CT-010, CT-011, CT-013, CT-014)\n'
		exit 0
	fi
	printf 'verificar-golden: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
