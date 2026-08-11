#!/usr/bin/env bash
#
# Verificação OFFLINE dos artefatos golden da caracterização (TC-001).
#
# Casos cobertos: CT-010, CT-011, CT-013 (metade estática), CT-014, CT-433,
# CT-501, CT-503.
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

# Os seis artefatos que a captura original produziu, sem o manifesto. O CT-433 usa
# a lista para afirmar que a extensão é ACRÉSCIMO: nenhum deles pode ter sido
# substituído pelos dois novos.
GOLDEN_DA_CAPTURA_ORIGINAL=(
	"atualizar-atrasos-cobrancas.json"
	"calcular-mora.json"
	"contrato-pdf.txt"
	"encerrar-contratos-vencidos.json"
	"marcar-cobrancas-vencidas.json"
	"metragem.json"
)

GOLDEN_DE_CONTRATO=(
	"contrato-ativacao.json"
	"contrato-cancelamento.json"
)

# Sublista da fatia `cobranca-e-mora`. Entra na composição abaixo em vez de subir a
# contagem à mão: é a mesma razão registrada no bloco seguinte — número literal e
# conjunto literal divergem, e o esquecimento não é detectável.
GOLDEN_DA_REGUA=(
	"regua-de-cobranca.json"
)

# Fonte única do conjunto esperado E da contagem. A contagem sai do tamanho desta
# lista de propósito: enquanto o número era literal, acrescentar um artefato exigia
# lembrar de dois lugares, e esquecer o segundo deixava a asserção de número
# passando com o conjunto errado.
#
# COMPOSTA das duas sublistas acima, e não transcrita: a identidade
# `manifesto + captura original + contrato` passa a ser mantida pelo interpretador.
# Enquanto era escrita à mão, "fonte única" valia para a contagem e era FALSO para o
# conjunto, e um artefato novo continuava exigindo lembrar de três lugares — o atrito
# que o parágrafo acima diz eliminar. A ordem muda com a composição e não é
# observável: o único consumo do conjunto compara sob `sort`, e os outros dois usam
# apenas a cardinalidade.
GOLDEN_ESPERADOS=(
	"PROCEDENCIA.md"
	"${GOLDEN_DA_CAPTURA_ORIGINAL[@]}"
	"${GOLDEN_DE_CONTRATO[@]}"
	"${GOLDEN_DA_REGUA[@]}"
)

# Marcadores introduzidos pela fase de cancelamento. Nomeá-los aqui é o que separa
# o CT-433 do CT-014: a bijeção daquele caso é genérica e continuaria verde se as
# duas máscaras sumissem do manifesto E dos artefatos ao mesmo tempo.
MASCARAS_DE_CONTRATO=(
	"<PDF_CONTRATO_CODIFICADO>"
	"<ARQUIVO_PDF_PRIVADO>"
)

ARQ_REGUA="regua-de-cobranca.json"
MODULO_DA_REGUA="locacao_automation.cobranca_automation"

# Contagem ESPERADA de cada bloco de cenários da régua, escrita aqui e não lida de
# um campo do próprio artefato. Contagem que o produtor declara e o verificador
# confere contra o que o produtor gravou é tautologia: as duas saem do mesmo
# `len()`, no mesmo instante, e um golden truncado sairia com a contagem truncada
# junto. Escrita no verificador, ela reprova o truncamento — que é o negativo do
# CT-501.
CENARIOS_REGUA_COBRANCAS=10
CENARIOS_REGUA_NORMALIZE_HHMM=8
CENARIOS_REGUA_HORA_EXECUCAO=3
CENARIOS_REGUA_INTERVALO=6
CENARIOS_REGUA_TEMPLATE=10
CENARIOS_REGUA_DIVERGENCIA=10
CENARIOS_REGUA_MANUAL=10

# O cenário que cruza cancelamento com vencimento passado, e os quatro fatos que a
# fatia seguinte NÃO deve portar. Constantes nomeadas porque as mesmas cadeias
# aparecem no CT-503 e no manifesto — três literais soltos divergiriam.
CENARIO_DA_DIVERGENCIA="cobranca_cancelada_e_vencida"
TEMPLATE_AUTOMATICO_DA_DIVERGENCIA="Fechada"
TEMPLATE_MANUAL_DA_DIVERGENCIA="Vencida"

medidas_da_regua=""

# Uma única leitura dos dois artefatos, consumida por CT-501 e CT-503. Cada caso a
# invoca por conta própria: o card do CT-503 exige caso auto-contido, que reprove
# sozinho quando executado fora de sequência.
medir_regua() {
	medidas_da_regua="$(python3 - "${DIR_GOLDEN}" "${ARQ_REGUA}" "${CENARIO_DA_DIVERGENCIA}" <<'PY'
import json
import re
import sys
from pathlib import Path

golden, nome_artefato, cenario_alvo = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
caminho = golden / nome_artefato

if not caminho.is_file():
    print("artefato_ausente=1")
    raise SystemExit(0)

print("artefato_ausente=0")
try:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    print("json_invalido=1")
    print(f"json_erro={exc}")
    raise SystemExit(0)
print("json_invalido=0")

FORMA_CANONICA = ("modulo", "regra", "funcoes", "entrada", "retorno", "estado_resultante")
for chave in FORMA_CANONICA:
    print(f"chave_{chave}={'presente' if chave in dados else 'ausente'}")
print("modulo=" + str(dados.get("modulo") or ""))

entrada = dados.get("entrada") or {}
retorno = dados.get("retorno") or {}
for rotulo, colecao in (
    ("cobrancas", entrada.get("cobrancas")),
    ("normalize_hhmm", retorno.get("normalize_hhmm")),
    ("is_hora_execucao", retorno.get("is_hora_execucao")),
    ("intervalo", retorno.get("intervalo")),
    ("template", retorno.get("template")),
    ("divergencia_de_estado", retorno.get("divergencia_de_estado")),
    ("manual", retorno.get("manual")),
):
    print(f"cenarios_{rotulo}={len(colecao) if isinstance(colecao, list) else -1}")

texto = caminho.read_text(encoding="utf-8")
mascaras = sorted(set(re.findall(r"<[A-Z_]+>", texto)))
print("mascaras_no_artefato=" + " ".join(mascaras))

# Marcador nomeado com algarismo escapa de `<[A-Z_]+>` — a varredura da bijeção
# não o enxerga, e ele vira máscara órfã invisível justamente no verificador que
# existe para achar máscara órfã. A busca aqui é DELIBERADAMENTE mais larga.
com_algarismo = sorted(
    set(m for m in re.findall(r"<[A-Z_0-9]+>", texto) if any(c.isdigit() for c in m))
)
print("mascaras_com_algarismo=" + " ".join(com_algarismo))

manifesto = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
secao = re.search(r"\n## 2\. Máscaras aplicadas\n(.*?)(?=\n## )", manifesto, re.DOTALL)
declaradas = set()
if secao:
    for linha in secao.group(1).splitlines():
        if not linha.strip().startswith("|"):
            continue
        colunas = [c.strip() for c in linha.strip().strip("|").split("|")]
        if len(colunas) < 4:
            continue
        artefatos = re.findall(r"`([^`]+\.(?:json|txt|md))`", colunas[1])
        if nome_artefato in artefatos:
            declaradas |= set(re.findall(r"<[A-Z_]+>", colunas[0]))
print("mascaras_no_manifesto=" + " ".join(sorted(declaradas)))

alvo = next(
    (
        item
        for item in (retorno.get("divergencia_de_estado") or [])
        if item.get("id") == cenario_alvo
    ),
    None,
)
if alvo is None:
    print("divergencia_presente=0")
else:
    print("divergencia_presente=1")
    print("divergencia_template_automatico=" + str(alvo.get("template_automatico")))
    print("divergencia_template_manual=" + str(alvo.get("template_manual")))
    print("divergencia_mensagens_automatico=" + str(alvo.get("mensagens_automatico")))
    print("divergencia_mensagens_manual=" + str(alvo.get("mensagens_manual")))
PY
	)"
}

medida() { printf '%s\n' "${medidas_da_regua}" | sed -n "s/^$1=//p" | head -1; }

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

afirmar_diferente() {
	if [[ "$2" != "$3" ]]; then
		ok "$1"
	else
		falhar "$1 — obtido [$3], que não deveria ser [$2]"
	fi
}

fechar_caso() {
	if [[ "${falhas_caso}" -eq 0 ]]; then
		printf '    -> %s aprovado\n' "$1"
	else
		printf '    -> %s REPROVADO (%d falha(s))\n' "$1" "${falhas_caso}" >&2
	fi
}

# Caminhos de `golden/` conhecidos pelo git, um por linha e em ordem estável.
# Extraída para função porque CT-010 e CT-433 afirmam propriedades diferentes do
# MESMO conjunto, e duas invocações literais divergiriam sem que nada acusasse.
caminhos_versionados_do_golden() {
	git -C "${RAIZ_REPO}" ls-files "${REL_GOLDEN}/" | sort
}

# --------------------------------------------------------------------------- #
# CT-010 — Documento de contrato: texto extraído, zero bytes de PDF versionados,
#          campos voláteis mascarados.
# --------------------------------------------------------------------------- #
ct_010() {
	caso "CT-010" "Documento de contrato — texto extraído e mascarado, sem bytes de PDF"

	local versionados
	versionados="$(caminhos_versionados_do_golden)"
	afirmar_igual "git ls-files sobre golden/ retorna ${#GOLDEN_ESPERADOS[@]} caminhos" \
		"${#GOLDEN_ESPERADOS[@]}" "$(printf '%s\n' "${versionados}" | grep -c . || true)"

	local esperados_completos=()
	local nome
	for nome in "${GOLDEN_ESPERADOS[@]}"; do
		esperados_completos+=("${REL_GOLDEN}/${nome}")
	done
	afirmar_igual "o conjunto versionado é exatamente o dos ${#GOLDEN_ESPERADOS[@]} artefatos" \
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
# ATENÇÃO: a `saas-multi-empresa` (plano Frappe abandonado) foi excluída da árvore em
# 2026-08-01, e com ela as duas ocorrências da credencial em texto claro que este bloco
# tolerava (`v1/tasks/T9.md:677` e `:932`). A exposição sai da árvore versionada, mas
# **permanece no histórico do git** — a exclusão foi por commit, sem reescrita de
# histórico. Rotacionar a credencial continua sendo a única correção real; segue como
# pendência aberta no `CLAUDE.md`.
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
		ok "manifesto completo e em bijeção com os marcadores dos artefatos de caracterização"
	else
		falhar "PROCEDENCIA.md incompleto ou fora de bijeção (ver acima)"
	fi

	fechar_caso "CT-014"
}

# --------------------------------------------------------------------------- #
# CT-433 — os dois artefatos golden de contrato existem, têm forma, cobrem a
#          virada de mês, e a bijeção manifesto <-> golden segue verificável.
#
# INVARIANTE: a extensão do roteiro de captura é ACRÉSCIMO — os seis artefatos
# anteriores continuam íntegros, os dois novos declaram os cenários de ativação e
# de cancelamento, e toda máscara declarada no manifesto tem marcador presente no
# artefato que ela nomeia, e todo marcador presente tem máscara declarada para
# aquele artefato.
#
# O QUE ESTE CASO NÃO FAZ, e por quê: ele não recalcula `data_fim_locacao` nem
# `valor_total_contrato`. O golden É o oráculo; um verificador que reimplementasse
# a derivação estaria conferindo o golden contra a própria suposição de quem o
# escreveu, e aprovaria um golden errado desde que errasse igual. O que se afere
# aqui é COBERTURA e FORMA — que os cenários de virada existem e que os campos
# estão lá. A conferência dos valores é da T4, contra as funções puras novas.
# --------------------------------------------------------------------------- #
ct_433() {
	caso "CT-433" "dois artefatos novos, forma e bijeção"

	local versionados
	versionados="$(caminhos_versionados_do_golden)"

	afirmar_igual "git ls-files sobre golden/ retorna ${#GOLDEN_ESPERADOS[@]} caminhos (eram 7)" \
		"${#GOLDEN_ESPERADOS[@]}" "$(printf '%s\n' "${versionados}" | grep -c . || true)"

	# Contagem sozinha não distingue acréscimo de substituição: trocar um artefato
	# antigo pelos dois novos mudaria o conjunto e manteria o número.
	local nome ausentes_originais=0 ausentes_novos=0
	for nome in "${GOLDEN_DA_CAPTURA_ORIGINAL[@]}"; do
		printf '%s\n' "${versionados}" | grep -qxF "${REL_GOLDEN}/${nome}" ||
			ausentes_originais=$((ausentes_originais + 1))
	done
	afirmar_igual "os ${#GOLDEN_DA_CAPTURA_ORIGINAL[@]} artefatos da captura original continuam versionados" \
		"0" "${ausentes_originais}"

	for nome in "${GOLDEN_DE_CONTRATO[@]}"; do
		printf '%s\n' "${versionados}" | grep -qxF "${REL_GOLDEN}/${nome}" ||
			ausentes_novos=$((ausentes_novos + 1))
	done
	afirmar_igual "os ${#GOLDEN_DE_CONTRATO[@]} artefatos de contrato estão versionados" \
		"0" "${ausentes_novos}"

	if python3 - "${DIR_GOLDEN}" "${MASCARAS_DE_CONTRATO[@]}" <<'PY'
import calendar
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

golden = Path(sys.argv[1])
mascaras_de_contrato = list(sys.argv[2:])
erros = []

FORMA_CANONICA = ("entrada", "retorno", "estado_resultante")
DIAS_DE_VIRADA_EXIGIDOS = {29, 30, 31}

# As SEIS condições de entrada que a regra legada recusa, cada uma pela mensagem literal que ela
# emite. A lista existe para que a cobertura seja afirmada por IDENTIDADE, e não por contagem:
# `len(recusadas) >= 6` é satisfeito por seis cópias da mesma condição, e era.
CONDICOES_DE_RECUSA = (
    "Data de início da locação é obrigatória.",
    "Prazo da locação deve ser maior que zero.",
    "Valor mensal inválido.",
    "Dia de vencimento deve estar entre 1 e 28.",
    "Contrato sem imóvel vinculado.",
    "Contrato sem locatário vinculado.",
)


def carregar(nome):
    caminho = golden / nome
    if not caminho.is_file():
        erros.append(
            f"{nome}: ausente de golden/ — a captura contra o site efêmero ainda não rodou"
        )
        return None
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        erros.append(f"{nome}: não é JSON válido ({exc})")
        return None


ARQ_ATIVACAO = "contrato-ativacao.json"
ARQ_CANCELAMENTO = "contrato-cancelamento.json"

ativacao = carregar(ARQ_ATIVACAO)
cancelamento = carregar(ARQ_CANCELAMENTO)

MODULO_ESPERADO = {
    ARQ_ATIVACAO: "locacao_automation.contrato_ativacao.service",
    ARQ_CANCELAMENTO: "locacao_automation.contrato_cancelamento.service",
}

for nome, dados in ((ARQ_ATIVACAO, ativacao), (ARQ_CANCELAMENTO, cancelamento)):
    if dados is None:
        continue
    faltando = [chave for chave in FORMA_CANONICA if chave not in dados]
    if faltando:
        erros.append(f"{nome}: seções da forma canônica ausentes {faltando}")
    if dados.get("modulo") != MODULO_ESPERADO[nome]:
        erros.append(
            f"{nome}: módulo de origem {dados.get('modulo')!r}, "
            f"esperado {MODULO_ESPERADO[nome]!r}"
        )

# ---- ativação: as quatro frentes da regra, e a cobertura da virada de mês ----
FRENTES_DA_ATIVACAO = ("validacao", "derivacao", "cobrancas", "fluxo")

if ativacao is not None:
    for secao in ("entrada", "retorno"):
        faltando = [f for f in FRENTES_DA_ATIVACAO if f not in ativacao.get(secao, {})]
        if faltando:
            erros.append(f"{ARQ_ATIVACAO}: {secao} não cobre as frentes {faltando}")

    if "fluxo" not in ativacao.get("estado_resultante", {}):
        erros.append(
            f"{ARQ_ATIVACAO}: estado_resultante sem a frente 'fluxo' — é a única que escreve"
        )

    validacao = ativacao.get("retorno", {}).get("validacao", [])
    recusadas = [
        item for item in validacao if not item.get("resultado", {}).get("aceito", True)
    ]
    # A cobertura das recusas é afirmada por IDENTIDADE da condição, não por contagem. A forma
    # anterior (`len(recusadas) < 6`) é satisfeita por seis cenários da MESMA condição — medido: seis
    # cópias de `sem_locatario` saíam `exit 0`, embora a mensagem de erro prometesse "um cada".
    mensagens_recusadas = [
        str(item.get("resultado", {}).get("mensagem") or "") for item in recusadas
    ]
    condicoes_ausentes = [
        condicao
        for condicao in CONDICOES_DE_RECUSA
        if not any(condicao in mensagem for mensagem in mensagens_recusadas)
    ]
    if condicoes_ausentes:
        erros.append(
            f"{ARQ_ATIVACAO}: as condições de entrada {condicoes_ausentes} não aparecem entre "
            f"os {len(recusadas)} cenários de recusa capturados; a regra recusa por SEIS razões "
            "distintas e o oráculo precisa de ao menos uma de cada"
        )
    for item in recusadas:
        if not str(item["resultado"].get("mensagem") or "").strip():
            erros.append(
                f"{ARQ_ATIVACAO}: cenário de recusa {item.get('id')!r} sem a mensagem da regra"
            )

    entrada_por_id = {
        item["id"]: item.get("contrato", {})
        for item in ativacao.get("entrada", {}).get("derivacao", [])
    }
    dias_de_inicio = set()
    anos_de_fevereiro = set()
    # O PAR, e não os dois conjuntos ao lado: `(dia de início, ano de destino)` acumulado só quando o
    # destino cai em fevereiro. É a conjunção que a §4-2 exige, e ela não é derivável dos dois
    # conjuntos separados — medido: um golden em que a virada nunca encosta em fevereiro satisfazia
    # as três asserções abaixo e saía `exit 0`.
    viradas_em_fevereiro = set()
    derivacao = ativacao.get("retorno", {}).get("derivacao", [])
    if not derivacao:
        erros.append(f"{ARQ_ATIVACAO}: nenhum cenário de derivação capturado")

    for item in derivacao:
        chave = item.get("id")
        resultado = item.get("resultado", {})
        if not resultado.get("aceito"):
            erros.append(f"{ARQ_ATIVACAO}: cenário de derivação {chave!r} foi recusado")
            continue
        corpo = resultado.get("retorno", {})
        for campo in ("data_fim_locacao", "valor_total_contrato"):
            if corpo.get(campo) in (None, ""):
                erros.append(f"{ARQ_ATIVACAO}: derivação {chave!r} sem {campo}")

        inicio_texto = str(entrada_por_id.get(chave, {}).get("data_inicio_locacao") or "")
        fim_texto = str(corpo.get("data_fim_locacao") or "")
        try:
            inicio = date.fromisoformat(inicio_texto[:10])
            fim = date.fromisoformat(fim_texto[:10])
        except ValueError:
            erros.append(
                f"{ARQ_ATIVACAO}: derivação {chave!r} com datas ilegíveis "
                f"(início {inicio_texto!r}, fim {fim_texto!r})"
            )
            continue
        dias_de_inicio.add(inicio.day)
        # `data_fim` é o dia anterior ao destino de `add_months`; o destino é o que
        # revela em que mês a virada caiu.
        destino = fim + timedelta(days=1)
        if destino.month == 2:
            anos_de_fevereiro.add(destino.year)
            if inicio.day in DIAS_DE_VIRADA_EXIGIDOS:
                viradas_em_fevereiro.add((inicio.day, calendar.isleap(destino.year)))

    faltantes = sorted(DIAS_DE_VIRADA_EXIGIDOS - dias_de_inicio)
    if faltantes:
        erros.append(
            f"{ARQ_ATIVACAO}: sem cenário de derivação com início nos dias {faltantes} — "
            "a virada de mês é a razão de capturar em vez de ler"
        )
    if not any(calendar.isleap(ano) for ano in anos_de_fevereiro):
        erros.append(
            f"{ARQ_ATIVACAO}: nenhuma derivação cai em fevereiro de ano bissexto "
            f"(fevereiros cobertos: {sorted(anos_de_fevereiro)})"
        )
    if not any(not calendar.isleap(ano) for ano in anos_de_fevereiro):
        erros.append(
            f"{ARQ_ATIVACAO}: nenhuma derivação cai em fevereiro de ano não-bissexto "
            f"(fevereiros cobertos: {sorted(anos_de_fevereiro)})"
        )

    # O PRODUTO CARTESIANO, que é a exigência real da §4-2 e o que as três asserções acima NÃO
    # alcançam: cada um dos três dias de virada tem de encostar em fevereiro nos DOIS tipos de ano.
    # Sem esta asserção, um golden que cobrisse 29/30/31 em meses quaisquer e, à parte, fevereiro por
    # um cenário de dia 15, satisfazia tudo — e é exatamente o caso que a task chama de "a razão
    # inteira de capturar em vez de ler". Este verificador é a única rede do oráculo depois da F7,
    # quando não houver mais como recapturar; é por isso que a asserção é do par, e não da margem.
    pares_exigidos = {
        (dia, bissexto) for dia in DIAS_DE_VIRADA_EXIGIDOS for bissexto in (True, False)
    }
    pares_faltantes = sorted(pares_exigidos - viradas_em_fevereiro)
    if pares_faltantes:
        legiveis = [
            f"dia {dia} × fevereiro {'bissexto' if bissexto else 'não-bissexto'}"
            for dia, bissexto in pares_faltantes
        ]
        erros.append(
            f"{ARQ_ATIVACAO}: a virada de mês não cobre {legiveis} — os seis pares "
            "(29/30/31 × bissexto/não-bissexto) são o que discrimina a saturação de fevereiro, "
            f"e o golden só traz {sorted(viradas_em_fevereiro)}"
        )

# ---- cancelamento: cascata, liberação do imóvel, transição e as recusas ----
if cancelamento is not None:
    for secao, exigidas in (
        ("entrada", ("contratos", "imoveis", "cobrancas")),
        ("estado_resultante", ("contratos", "imoveis", "cobrancas")),
    ):
        faltando = [c for c in exigidas if c not in cancelamento.get(secao, {})]
        if faltando:
            erros.append(f"{ARQ_CANCELAMENTO}: {secao} sem as coleções {faltando}")

    recusas = {item.get("id") for item in cancelamento.get("recusas", [])}
    exigidas = {"parametro_vazio", "contrato_sem_pdf", "contrato_sem_imovel"}
    if not exigidas.issubset(recusas):
        erros.append(
            f"{ARQ_CANCELAMENTO}: guardas sem oráculo {sorted(exigidas - recusas)}"
        )
    for item in cancelamento.get("recusas", []):
        resultado = item.get("resultado", {})
        if resultado.get("aceito"):
            erros.append(
                f"{ARQ_CANCELAMENTO}: a guarda {item.get('id')!r} não recusou"
            )
        elif not str(resultado.get("mensagem") or "").strip():
            erros.append(
                f"{ARQ_CANCELAMENTO}: a guarda {item.get('id')!r} recusou sem mensagem"
            )

    retorno = cancelamento.get("retorno", {})
    if not retorno.get("aceito"):
        erros.append(
            f"{ARQ_CANCELAMENTO}: o cenário de cancelamento completo não foi aceito — "
            f"{retorno.get('mensagem')!r}"
        )
    else:
        corpo = retorno.get("retorno", {})
        faltando = [
            c for c in ("ok", "contrato", "imovel", "cobrancas_canceladas",
                        "baixas_sicoob", "status_contrato")
            if c not in corpo
        ]
        if faltando:
            erros.append(f"{ARQ_CANCELAMENTO}: retorno sem as chaves {faltando}")

    estados = {
        item.get("status_cobranca")
        for item in cancelamento.get("estado_resultante", {}).get("cobrancas", [])
    }
    if "Cancelada" not in estados:
        erros.append(f"{ARQ_CANCELAMENTO}: nenhuma cobrança terminou 'Cancelada'")
    # O negativo que discrimina: sem cobrança fora da cascata, "cancelou as
    # canceláveis" é indistinguível de "cancelou tudo".
    if not estados - {"Cancelada"}:
        erros.append(
            f"{ARQ_CANCELAMENTO}: todas as cobranças terminaram 'Cancelada' — o filtro "
            "de status ficou sem contraprova"
        )

# ---- bijeção máscara <-> marcador, por ARTEFATO e nos dois sentidos ----
# Mais forte que a do CT-014, que é global: aqui uma máscara declarada para
# `contrato-cancelamento.json` e presente apenas em `contrato-pdf.txt` reprova.
manifesto_arquivo = golden / "PROCEDENCIA.md"
if not manifesto_arquivo.is_file():
    erros.append("PROCEDENCIA.md: manifesto ausente de golden/")
else:
    manifesto = manifesto_arquivo.read_text(encoding="utf-8")
    secao = re.search(r"\n## 2\. Máscaras aplicadas\n(.*?)(?=\n## )", manifesto, re.DOTALL)
    if not secao:
        erros.append("PROCEDENCIA.md: seção '## 2. Máscaras aplicadas' ausente")
    else:
        declarado = {}
        for linha in secao.group(1).splitlines():
            if not linha.strip().startswith("|"):
                continue
            colunas = [c.strip() for c in linha.strip().strip("|").split("|")]
            if len(colunas) < 4:
                continue
            marcadores = re.findall(r"<[A-Z_]+>", colunas[0])
            if not marcadores:
                continue
            artefatos = re.findall(r"`([^`]+\.(?:json|txt|md))`", colunas[1])
            if not artefatos:
                erros.append(
                    f"PROCEDENCIA.md: a máscara {marcadores} não nomeia artefato algum"
                )
            for marcador in marcadores:
                declarado.setdefault(marcador, set()).update(artefatos)

        presente = {}
        for arquivo in sorted(golden.iterdir()):
            if arquivo.name == "PROCEDENCIA.md":
                continue
            for marcador in set(re.findall(r"<[A-Z_]+>", arquivo.read_text(encoding="utf-8"))):
                presente.setdefault(marcador, set()).add(arquivo.name)

        for marcador, artefatos in sorted(declarado.items()):
            faltando = sorted(artefatos - presente.get(marcador, set()))
            if faltando:
                erros.append(
                    f"máscara órfã: {marcador} é declarada para {faltando} e não aparece lá"
                )
        for marcador, artefatos in sorted(presente.items()):
            faltando = sorted(artefatos - declarado.get(marcador, set()))
            if faltando:
                erros.append(
                    f"marcador sem máscara: {marcador} aparece em {faltando} sem declaração "
                    "correspondente no manifesto"
                )

        for marcador in mascaras_de_contrato:
            if marcador not in declarado:
                erros.append(f"a máscara nova {marcador} não está declarada no manifesto")
            if marcador not in presente:
                erros.append(f"a máscara nova {marcador} não aparece em artefato nenhum")

    # Procedência da captura que produziu os nove artefatos. Sobrepõe de propósito
    # o CT-014: o card do CT-433 exige um caso auto-contido, que reprove sozinho.
    for campo, padrao in (
        ("Dump de origem", r"sites/[^/|]+/private/backups/\S+\.sql\.gz"),
        ("Data e hora da captura", r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"),
        ("Versão do app (commit)", r"[0-9a-f]{40}"),
    ):
        casamento = re.search(
            r"^\|\s*" + re.escape(campo) + r"\s*\|\s*(.+?)\s*\|\s*$", manifesto, re.MULTILINE
        )
        if not casamento or not re.fullmatch(padrao, casamento.group(1).strip()):
            erros.append(
                f"PROCEDENCIA.md: campo {campo!r} ausente ou fora da forma esperada"
            )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "forma, cobertura da virada de mês, guardas do cancelamento e bijeção por artefato"
	else
		falhar "os artefatos de contrato estão ausentes, sem forma ou fora de bijeção (ver acima)"
	fi

	fechar_caso "CT-433"
}

# --------------------------------------------------------------------------- #
# CT-501 — o golden da régua existe, tem a forma canônica, a contagem de cenários
#          declarada, e está em bijeção com o `PROCEDENCIA.md`.
#
# INVARIANTE: a captura da régua produz artefato golden versionado cujas chaves de
# topo existem, cujos cenários somam a contagem esperada bloco a bloco, e cujo
# conjunto de máscaras `<[A-Z_]+>` presentes no arquivo é IGUAL ao conjunto que a
# §2 do manifesto declara PARA ELE — sem órfã em nenhuma das duas direções.
#
# O QUE ESTE CASO NÃO FAZ: ele não reexecuta a régua nem rederiva template algum.
# O golden É o oráculo; um verificador que reimplementasse `get_status_template`
# aprovaria um golden errado desde que errasse igual. O que se afere aqui é FORMA e
# COBERTURA. O conteúdo que discrimina é do CT-503.
# --------------------------------------------------------------------------- #
ct_501() {
	caso "CT-501" "regua-de-cobranca.json — forma, contagem de cenários e bijeção com o manifesto"

	local versionados
	versionados="$(caminhos_versionados_do_golden)"
	afirmar_igual "git ls-files sobre golden/ retorna ${#GOLDEN_ESPERADOS[@]} caminhos" \
		"${#GOLDEN_ESPERADOS[@]}" "$(printf '%s\n' "${versionados}" | grep -c . || true)"

	local nome ausentes=0
	for nome in "${GOLDEN_DA_REGUA[@]}"; do
		printf '%s\n' "${versionados}" | grep -qxF "${REL_GOLDEN}/${nome}" ||
			ausentes=$((ausentes + 1))
	done
	afirmar_igual "o artefato da régua está versionado" "0" "${ausentes}"

	medir_regua
	afirmar_igual "${ARQ_REGUA} presente em golden/" "0" "$(medida artefato_ausente)"
	if [[ "$(medida artefato_ausente)" != "0" ]]; then
		fechar_caso "CT-501"
		return
	fi
	afirmar_igual "${ARQ_REGUA} é JSON válido" "0" "$(medida json_invalido)"

	local chave
	for chave in modulo regra funcoes entrada retorno estado_resultante; do
		afirmar_igual "chave de topo '${chave}'" "presente" "$(medida "chave_${chave}")"
	done
	afirmar_igual "módulo de origem" "${MODULO_DA_REGUA}" "$(medida modulo)"

	afirmar_igual "cenários de cobrança" \
		"${CENARIOS_REGUA_COBRANCAS}" "$(medida cenarios_cobrancas)"
	afirmar_igual "cenários de normalize_hhmm" \
		"${CENARIOS_REGUA_NORMALIZE_HHMM}" "$(medida cenarios_normalize_hhmm)"
	afirmar_igual "cenários de is_hora_execucao" \
		"${CENARIOS_REGUA_HORA_EXECUCAO}" "$(medida cenarios_is_hora_execucao)"
	afirmar_igual "cenários da trava de intervalo" \
		"${CENARIOS_REGUA_INTERVALO}" "$(medida cenarios_intervalo)"
	afirmar_igual "cenários de template resolvido e corpo montado" \
		"${CENARIOS_REGUA_TEMPLATE}" "$(medida cenarios_template)"
	afirmar_igual "cenários de divergência de estado" \
		"${CENARIOS_REGUA_DIVERGENCIA}" "$(medida cenarios_divergencia_de_estado)"
	afirmar_igual "cenários de envio manual" \
		"${CENARIOS_REGUA_MANUAL}" "$(medida cenarios_manual)"

	afirmar_igual "conjunto de máscaras do artefato igual ao declarado na §2 do manifesto" \
		"$(medida mascaras_no_manifesto)" "$(medida mascaras_no_artefato)"
	afirmar_igual "nenhuma máscara nomeada com algarismo" "" "$(medida mascaras_com_algarismo)"

	fechar_caso "CT-501"
}

# --------------------------------------------------------------------------- #
# CT-503 — o golden registra a divergência entre o caminho automático e o manual.
#
# INVARIANTE: para uma cobrança CANCELADA e com vencimento passado,
# `get_status_template` (`core.py`) resolve `Fechada` e `get_status_template_manual`
# (`emailer.py`) resolve `Vencida` — valores DIFERENTES para o mesmo fato —, e o
# caminho manual produziu mensagem onde o automático não produziu nenhuma.
#
# Nomear a divergência é o que impede uma recaptura futura de apagá-la em silêncio.
# Sem este caso, o golden capturaria o mecanismo da régua e perderia justamente o
# defeito que motiva substituí-la: `is_cobranca_paga` conhece `Paga` e não conhece
# `Cancelada`, e o envio manual cobra por uma dívida cancelada.
# --------------------------------------------------------------------------- #
ct_503() {
	caso "CT-503" "o golden registra a divergência automático × manual da régua"

	medir_regua
	afirmar_igual "o cenário ${CENARIO_DA_DIVERGENCIA} está no golden" \
		"1" "$(medida divergencia_presente)"
	if [[ "$(medida divergencia_presente)" != "1" ]]; then
		fechar_caso "CT-503"
		return
	fi

	local automatico manual
	automatico="$(medida divergencia_template_automatico)"
	manual="$(medida divergencia_template_manual)"

	afirmar_igual "core.get_status_template resolve o template do estado fechado" \
		"${TEMPLATE_AUTOMATICO_DA_DIVERGENCIA}" "${automatico}"
	afirmar_igual "emailer.get_status_template_manual resolve pelo vencimento" \
		"${TEMPLATE_MANUAL_DA_DIVERGENCIA}" "${manual}"
	# A desigualdade é o fato capturado, e não uma consequência das duas asserções
	# acima: se um dia as duas constantes forem editadas para o mesmo valor, esta
	# linha reprova e denuncia a edição.
	afirmar_diferente "os dois resolvedores discordam sobre o mesmo fato" \
		"${automatico}" "${manual}"

	afirmar_igual "o caminho automático não produziu mensagem para a cobrança cancelada" \
		"0" "$(medida divergencia_mensagens_automatico)"
	afirmar_igual "o caminho manual produziu exatamente uma mensagem" \
		"1" "$(medida divergencia_mensagens_manual)"

	fechar_caso "CT-503"
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
	ct_433
	ct_501
	ct_503

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-golden: 7/7 casos aprovados (CT-010, CT-011, CT-013, CT-014, CT-433, CT-501, CT-503)\n'
		exit 0
	fi
	printf 'verificar-golden: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
