#!/usr/bin/env bash
#
# Verificação OFFLINE dos artefatos golden da caracterização (TC-001).
#
# Casos cobertos: CT-010, CT-011, CT-013 (metade estática), CT-014, CT-433,
# CT-501, CT-503, CT-601, CT-602, CT-640, CT-701.
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

# Sublista da fatia `regua-de-cobranca`. O artefato é o FONTE do Server Script que
# compõe o documento do contrato — a REGRA. O `contrato-pdf.txt` da captura
# original, logo acima, é a SAÍDA de rodá-la; os dois convivem e não se
# substituem, e nomeá-los em sublistas separadas é o que impede uma fatia futura de
# trocar um pelo outro achando que são o mesmo artefato.
GOLDEN_DO_FONTE_DO_PDF=(
	"contrato-pdf-fonte.py"
)

# Sublista da sub-fatia `documentos-e-confirmacao` (F3/2b, T1): o documento de
# contrato REAL nos ramos que o contrato sintético da captura não exercita. A lista
# tem UM nome porque um eixo terminou capturado e o outro compartilha o mesmo
# artefato — o terceiro é ausência medida, e ausência não gera arquivo. Ela é
# DECLARADA, e não derivada do diretório: derivá-la faria um artefato apagado sair
# dos dois lados da comparação sem que nada reprovasse.
GOLDEN_DOS_CAMINHOS_SEM_ORACULO=(
	"contrato-pdf-pessoa-juridica.txt"
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
	"${GOLDEN_DO_FONTE_DO_PDF[@]}"
	"${GOLDEN_DOS_CAMINHOS_SEM_ORACULO[@]}"
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

# --------------------------------------------------------------------------- #
# Forma esperada do fonte do Server Script `PDF contrato` (CT-601 / CT-602).
#
# Os números e as cadeias abaixo são escritos AQUI, e não lidos do artefato: um
# verificador que tirasse a contagem do próprio arquivo que confere aprovaria um
# artefato truncado com a contagem truncada junto — é a mesma razão registrada nas
# contagens de cenário da régua, e é o que o mutante M1 do CT-602 exercita.
# --------------------------------------------------------------------------- #
ARQ_FONTE_DO_PDF="contrato-pdf-fonte.py"
LINHAS_DO_FONTE_DO_PDF=752
LINHAS_DO_CABECALHO_DO_PDF=7
CABECALHO_DO_FONTE_DO_PDF="# CAPTURADO DO SISTEMA LEGADO — NÃO EDITAR À MÃO"
DELIMITADOR_DO_FONTE_DO_PDF="# ----- fonte capturado abaixo, byte a byte: nada acrescentado, removido ou reordenado -----"

# A versão DA REGRA no sistema legado, e não o instante da extração. Fixá-la aqui é
# o que faz uma alteração da regra no legado — depois desta captura e antes da
# virada — reprovar em vez de entrar em silêncio na próxima recaptura.
MODIFICADO_NO_LEGADO_DO_PDF="2026-03-10 14:24:24.623970"

# --------------------------------------------------------------------------- #
# Forma esperada do desfecho dos caminhos sem oráculo (CT-701).
#
# A lista de eixos é DECLARADA aqui, e não lida do produtor (`capturar.py`). Ela
# foi lida dele até a rodada 1 desta task, e a consequência é medida: apagar um
# eixo de `ARTEFATO_POR_EIXO` E a seção correspondente da §4.1 o removia dos DOIS
# lados da comparação ao mesmo tempo, de modo que a bijeção aprovava o
# desaparecimento e o caso seguia verde com dois eixos — ou com um. É a mesma razão
# já registrada em `GOLDEN_ESPERADOS` e em `GOLDEN_DOS_CAMINHOS_SEM_ORACULO` acima;
# só esta lista escapava dela. Declarada, a garantia passa a ser "os TRÊS eixos do
# CA-01 têm desfecho", e não "os eixos que o produtor declarar têm desfecho".
#
# O que se escreve aqui, portanto, é o ORÁCULO em três peças: quais eixos existem,
# qual é a marca do ramo de cada um (no corpo do medidor) e qual é o contraste que
# discrimina — nenhuma delas derivável do artefato que elas conferem.
# --------------------------------------------------------------------------- #
ARQ_CAPTURAR="capturar.py"
TITULO_DOS_CAMINHOS="## 4.1 Caminhos do documento sem oráculo"

# Os três eixos do CA-01. A comparação com o produtor é feita nos dois sentidos,
# então a ordem aqui não é observável.
EIXOS_SEM_ORACULO=(
	"contrato_com_fiador"
	"locatario_pessoa_juridica"
	"parte_sem_documento_identidade"
)

# O documento que o mutante M3 do CT-701 devolve ao artefato, no lugar do marcador
# que a captura pôs ali. É o MESMO valor sintético que `capturar.py` grava no
# locador da caracterização (`11122233344`, linha 314) e que o golden
# `contrato-pdf.txt` já publica formatado — nada de novo entra na árvore versionada.
#
# Ele é REPROVADO no primeiro dígito verificador (o algoritmo do CPF exige 9 para
# `111.222.333`, e o valor traz 4), e essa propriedade é deliberada: a asserção que
# o mutante exercita é a forma `\d{3}\.\d{3}\.\d{3}-\d{2}` de `RESIDUOS_PESSOAIS`,
# que casa a FORMA e nunca a validade. Um número que não pode ser de ninguém
# discrimina exatamente igual, e não deixa na árvore um literal indistinguível de
# dado pessoal — que é o que esta captura inteira existe para evitar (Invariante 3).
CPF_SINTETICO_DO_MUTANTE="111.222.333-44"
MARCADOR_DO_DOCUMENTO_DO_LOCADOR="<DOCUMENTO_DO_LOCADOR>"

# A forma que a regra usa quando a parte TEM identidade civil. Ela está no golden
# sintético e é o contraste que discrimina: sem ela, "o artefato capturado exercita
# o ramo sem RG" seria indistinguível de "o artefato capturado é o mesmo texto".
TRECHO_COM_IDENTIDADE_CIVIL="portador(a) da cédula de identidade civil número"
ARQ_PDF_SINTETICO="contrato-pdf.txt"

medidas_da_regua=""

# Sandbox descartável dos mutantes do CT-602. Nunca a árvore de trabalho: o caso
# aplica defeito de propósito, e aplicá-lo no repositório deixaria o artefato
# mutilado se o script morresse no meio.
DIR_TRABALHO="$(mktemp -d)"

limpar() {
	local codigo=$?
	rm -rf "${DIR_TRABALHO}"
	exit "${codigo}"
}
trap limpar EXIT INT TERM HUP

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

# SEGUNDO discriminador — o CONTEXTO, acrescentado na intervenção dirigida de
# 2026-08-23 (`D4 · F2/T1`).
#
# CAUSA-RAIZ de ele existir: o token isolado não separa vazamento de PROSA. A
# agulha é uma palavra de dicionário de 5 caracteres, e frases legítimas de
# documentação a contêm ("exige permissão de X no repo", "o papel X do painel").
# Cada uma delas reprovava, entrava na lista nominal, e a seguinte reprovava de
# novo — a lista chegou a 11 entradas e a bateria ficou VERMELHA de forma
# permanente. Verificador sempre vermelho tem poder de detecção ZERO: ninguém
# distingue "o vermelho de sempre" de um vazamento novo, que é exatamente o modo
# de falha que `.claude/rules/testing-stack.md` descreve ao justificar o código
# de saída 2.
#
# O que caracteriza vazamento não é a palavra aparecer — é ela aparecer ONDE UMA
# CREDENCIAL SERIA USADA. Isso independe de o valor ser comum ou raro, que é o
# motivo de este discriminador não envelhecer junto com a agulha.
#
# ⚠️ A mudança endurece e afrouxa em direções DIFERENTES, e as duas são
# deliberadas:
#   - AFROUXA: ocorrência nova em prosa passa a AVISAR em vez de reprovar.
#   - ENDURECE: ocorrência em contexto de credencial passa a REPROVAR mesmo se
#     estiver catalogada em PREEXISTENTES. Antes, editar uma das 11 linhas
#     catalogadas para `password: <agulha>` seguiria sendo tolerada — a lista é
#     por posição, não por natureza.
CONTEXTO_DE_CREDENCIAL = re.compile(
    r"(?:"
    # (a) valor de uma chave cujo nome anuncia segredo: `password: X`, `senha=X`
    r"(?:pass(?:wd|word)?|senha|secret|segredo|credencial|pwd)"
    r"[\"']?\s*[:=]\s*[\"']?" + re.escape(agulha) + r"\b"
    r"|"
    # (b) credencial de uma URL de conexão: `esquema://usuario:X@hospedeiro`
    r"://[^\s:/@]+:" + re.escape(agulha) + r"@"
    r"|"
    # (c) argumento de linha de comando: `-p X`, `--password X`, `--password=X`
    r"(?:^|\s)-{1,2}(?:p|pass(?:word)?)(?:[=\s]+|)" + re.escape(agulha) + r"\b"
    r")",
    re.IGNORECASE,
)

versionados = subprocess.run(
    ["git", "-C", str(raiz), "ls-files", "-z"],
    capture_output=True, check=True, text=True,
).stdout.split("\0")

reprovacoes, avisos, em_prosa = [], [], []
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
        if CONTEXTO_DE_CREDENCIAL.search(linha):
            # Contexto de credencial reprova SEMPRE — catalogada ou não. A lista
            # nominal cataloga posição, e posição não diz nada sobre natureza.
            reprovacoes.append(ocorrencia)
        elif ocorrencia in PREEXISTENTES:
            avisos.append(ocorrencia)
        else:
            em_prosa.append(ocorrencia)

for aviso in sorted(avisos):
    print(f"AVISO: ocorrência pré-existente e catalogada em {aviso}", file=sys.stderr)
if em_prosa:
    # RESUMO, e não uma linha por ocorrência: são dezenas, e listá-las uma a uma
    # reintroduz por ruído o problema que o vermelho permanente causava — saída
    # que ninguém lê deixa de proteger tanto quanto verificador que não reprova.
    # O que precisa ser auditável é a CONTAGEM (se ela saltar, alguém acrescentou
    # a palavra em massa) e os ARQUIVOS, que cabem na tela.
    arquivos = sorted({ocorrencia.rsplit(":", 1)[0] for ocorrencia in em_prosa})
    print(
        f"AVISO: {len(em_prosa)} ocorrência(s) da agulha FORA de contexto de"
        f" credencial, em {len(arquivos)} arquivo(s) — a agulha é palavra comum de"
        " 5 caracteres e não se distingue de prosa legítima. Não é vazamento; o"
        " que reprova é a agulha em posição de credencial.",
        file=sys.stderr,
    )
    for arquivo in arquivos:
        print(f"       fora de contexto: {arquivo}", file=sys.stderr)
for reprovacao in sorted(reprovacoes):
    print(f"credencial encontrada EM CONTEXTO DE CREDENCIAL em {reprovacao}", file=sys.stderr)

nao_encontradas = sorted(PREEXISTENTES - set(avisos) - set(reprovacoes))
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

# --------------------------------------------------------------------------- #
# CT-601 / CT-602 — o FONTE do Server Script `PDF contrato`.
#
# INVARIANTE: o fonte da regra que compõe o documento do contrato existe como
# artefato versionado em `golden/`, é legível sem o sistema antigo de pé, abre com
# o cabeçalho canônico de procedência, traz exatamente LINHAS_DO_FONTE_DO_PDF
# linhas com o terminador do legado preservado, e a lista ordenada de artefatos do
# diretório é idêntica à declarada no `PROCEDENCIA.md` — bijeção nas duas direções.
#
# O QUE ESTE CASO NÃO FAZ, e por quê: ele não interpreta, não executa e não
# reformata o fonte. O artefato É o oráculo da regra, e um verificador que
# rederivasse qualquer coisa a partir dele estaria conferindo o oráculo contra a
# suposição de quem o escreveu. O que se afere é FORMA e PROCEDÊNCIA — as duas
# propriedades que ainda podem ser perdidas depois da virada, quando não houver
# mais como recapturar. Portar a regra é da sub-fatia 2b.
#
# A medição é uma função separada porque o CT-602 aplica a MESMA asserção a cópias
# defeituosas: asserção reescrita no caso negativo prova o verificador contra si
# mesmo, e já aprovou 5/5 um SUT com o defeito de volta neste repositório.
# --------------------------------------------------------------------------- #
medidas_do_fonte=""

medir_fonte_do_pdf() { # medir_fonte_do_pdf <dir_golden>
	medidas_do_fonte="$(python3 - "$1" "${ARQ_FONTE_DO_PDF}" \
		"${CABECALHO_DO_FONTE_DO_PDF}" "${DELIMITADOR_DO_FONTE_DO_PDF}" <<'PY'
import re
import sys
from pathlib import Path

golden, nome, cabecalho, delimitador = (
    Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
)
caminho = golden / nome

if not caminho.is_file():
    print("artefato_ausente=1")
    raise SystemExit(0)
print("artefato_ausente=0")

bruto = caminho.read_bytes()
print(f"bytes_nul={bruto.count(chr(0).encode())}")
try:
    texto = bruto.decode("utf-8")
except UnicodeDecodeError:
    print("utf8_invalido=1")
    raise SystemExit(0)
print("utf8_invalido=0")


def sem_retorno(linha):
    return linha[:-1] if linha.endswith("\r") else linha


linhas = texto.split("\n")
if linhas and linhas[-1] == "":
    linhas.pop()

print("primeira_linha=" + (sem_retorno(linhas[0]) if linhas else ""))
print("cabecalho_canonico=" + cabecalho)

indice = next(
    (i for i, linha in enumerate(linhas) if sem_retorno(linha) == delimitador), -1
)
print(f"delimitador_presente={0 if indice < 0 else 1}")
print(f"linhas_do_cabecalho={indice + 1 if indice >= 0 else -1}")

CAMPOS = (
    "# Origem:",
    "# Campo:",
    "# Última alteração no legado (modified):",
    "# Comando:",
    "# Procedência:",
)
do_cabecalho = [sem_retorno(linha) for linha in linhas[:indice]] if indice > 0 else []
print(
    "campos_ausentes_do_cabecalho="
    + " ".join(
        campo
        for campo in CAMPOS
        if not any(linha.startswith(campo) for linha in do_cabecalho)
    )
)

PREFIXO_MODIFICADO = "# Última alteração no legado (modified):"
print(
    "modificado_no_cabecalho="
    + next(
        (
            linha[len(PREFIXO_MODIFICADO):].strip()
            for linha in do_cabecalho
            if linha.startswith(PREFIXO_MODIFICADO)
        ),
        "",
    )
)

# O corpo é o que vem DEPOIS do delimitador: contar o arquivo inteiro somaria o
# cabeçalho de procedência ao fonte, e a contagem deixaria de dizer quantas linhas
# de regra o legado tem.
corpo = linhas[indice + 1:] if indice >= 0 else []
print(f"linhas_do_fonte={len(corpo)}")
print(
    "linhas_do_fonte_sem_crlf="
    + str(sum(1 for linha in corpo if not linha.endswith("\r")))
)

manifesto_arquivo = golden / "PROCEDENCIA.md"
if not manifesto_arquivo.is_file():
    print("manifesto_ausente=1")
    raise SystemExit(0)
print("manifesto_ausente=0")
manifesto = manifesto_arquivo.read_text(encoding="utf-8")

casamento = re.search(
    r"Última alteração da regra no legado \(`modified`\): `([^`]+)`", manifesto
)
print("modificado_no_manifesto=" + (casamento.group(1) if casamento else ""))

secao = re.search(
    r"\n## 5\. Inventário dos artefatos\n(.*?)(?=\n## |\Z)", manifesto, re.DOTALL
)
print(f"inventario_ausente={0 if secao else 1}")

declarados = []
if secao:
    for linha in secao.group(1).splitlines():
        if not linha.strip().startswith("|"):
            continue
        colunas = [c.strip() for c in linha.strip().strip("|").split("|")]
        if len(colunas) < 3:
            continue
        # O cabeçalho da tabela e a linha de separação não trazem nome em crase, e
        # é assim que saem da varredura sem precisar de contagem de linha.
        declarados.extend(re.findall(r"`([^`]+)`", colunas[0]))

no_diretorio = sorted(item.name for item in golden.iterdir() if item.is_file())
print("artefatos_no_diretorio=" + " ".join(no_diretorio))
print("artefatos_no_manifesto=" + " ".join(sorted(declarados)))
print("artefatos_orfaos=" + " ".join(sorted(set(no_diretorio) - set(declarados))))
print("entradas_orfas=" + " ".join(sorted(set(declarados) - set(no_diretorio))))
print(
    "entradas_repetidas="
    + " ".join(sorted(n for n in set(declarados) if declarados.count(n) > 1))
)
PY
	)"
}

medida_do_fonte() { printf '%s\n' "${medidas_do_fonte}" | sed -n "s/^$1=//p" | head -1; }

# A asserção do CT-601, isolada para que o CT-602 a aplique LITERALMENTE às cópias
# defeituosas. Recebe o diretório porque o mutante mora em sandbox descartável.
afirmar_forma_do_fonte_do_pdf() { # afirmar_forma_do_fonte_do_pdf <dir_golden>
	medir_fonte_do_pdf "$1"

	afirmar_igual "${ARQ_FONTE_DO_PDF} presente em golden/" \
		"0" "$(medida_do_fonte artefato_ausente)"
	if [[ "$(medida_do_fonte artefato_ausente)" != "0" ]]; then
		return
	fi
	afirmar_igual "o artefato decodifica em UTF-8 estrito" \
		"0" "$(medida_do_fonte utf8_invalido)"
	afirmar_igual "o artefato não tem byte NUL" "0" "$(medida_do_fonte bytes_nul)"

	afirmar_igual "a primeira linha é o cabeçalho canônico de procedência" \
		"${CABECALHO_DO_FONTE_DO_PDF}" "$(medida_do_fonte primeira_linha)"
	afirmar_igual "o delimitador que separa procedência de fonte está presente" \
		"1" "$(medida_do_fonte delimitador_presente)"
	afirmar_igual "o cabeçalho de procedência tem ${LINHAS_DO_CABECALHO_DO_PDF} linhas" \
		"${LINHAS_DO_CABECALHO_DO_PDF}" "$(medida_do_fonte linhas_do_cabecalho)"
	afirmar_igual "o cabeçalho declara origem, campo, versão da regra, comando e procedência" \
		"" "$(medida_do_fonte campos_ausentes_do_cabecalho)"

	afirmar_igual "o fonte capturado tem ${LINHAS_DO_FONTE_DO_PDF} linhas" \
		"${LINHAS_DO_FONTE_DO_PDF}" "$(medida_do_fonte linhas_do_fonte)"
	afirmar_igual "toda linha do fonte preserva o terminador CRLF do legado" \
		"0" "$(medida_do_fonte linhas_do_fonte_sem_crlf)"

	afirmar_igual "a versão da regra no legado é a auditada" \
		"${MODIFICADO_NO_LEGADO_DO_PDF}" "$(medida_do_fonte modificado_no_cabecalho)"
	afirmar_igual "o manifesto declara a mesma versão da regra que o artefato" \
		"$(medida_do_fonte modificado_no_cabecalho)" "$(medida_do_fonte modificado_no_manifesto)"

	afirmar_igual "o manifesto existe em golden/" "0" "$(medida_do_fonte manifesto_ausente)"
	afirmar_igual "a §5 do manifesto declara o inventário" \
		"0" "$(medida_do_fonte inventario_ausente)"
	afirmar_igual "nenhum artefato de golden/ está fora do inventário do manifesto" \
		"" "$(medida_do_fonte artefatos_orfaos)"
	afirmar_igual "nenhuma entrada do inventário está sem artefato em golden/" \
		"" "$(medida_do_fonte entradas_orfas)"
	afirmar_igual "nenhuma entrada repetida no inventário" \
		"" "$(medida_do_fonte entradas_repetidas)"
	afirmar_igual "a lista de artefatos do diretório é idêntica à do manifesto" \
		"$(medida_do_fonte artefatos_no_diretorio)" "$(medida_do_fonte artefatos_no_manifesto)"
}

ct_601() {
	caso "CT-601" "contrato-pdf-fonte.py — o FONTE da regra do documento, com forma e bijeção"

	afirmar_forma_do_fonte_do_pdf "${DIR_GOLDEN}"

	local versionados
	versionados="$(caminhos_versionados_do_golden)"
	afirmar_igual "git ls-files sobre golden/ retorna ${#GOLDEN_ESPERADOS[@]} caminhos" \
		"${#GOLDEN_ESPERADOS[@]}" "$(printf '%s\n' "${versionados}" | grep -c . || true)"

	local nome ausentes=0
	for nome in "${GOLDEN_DO_FONTE_DO_PDF[@]}"; do
		printf '%s\n' "${versionados}" | grep -qxF "${REL_GOLDEN}/${nome}" ||
			ausentes=$((ausentes + 1))
	done
	afirmar_igual "o fonte do Server Script está versionado" "0" "${ausentes}"

	# Sem esta declaração o "byte a byte" é falso fora desta máquina: o host tem
	# `core.autocrlf=input`, o git normalizaria o CRLF do legado no índice, e o
	# artefato de um clone novo divergiria do que a recaptura produz — o CT-603
	# reprovaria por infraestrutura, não por defeito.
	afirmar_igual "o git não normaliza o terminador de linha do artefato" \
		"${REL_GOLDEN}/${ARQ_FONTE_DO_PDF}: text: unset" \
		"$(git -C "${RAIZ_REPO}" check-attr text -- "${REL_GOLDEN}/${ARQ_FONTE_DO_PDF}")"

	fechar_caso "CT-601"
}

# Executa a asserção do CT-601 sobre um diretório qualquer SEM contaminar a
# contagem do script: o subshell isola `falhas_totais`, o `stdout` vai para o vazio
# e as linhas de FALHA ficam no arquivo, que é o que o CT-602 inspeciona.
#
# O subshell isola TAMBÉM o global `medidas_do_fonte` — a atribuição feita aqui
# dentro não atravessa a fronteira. Quem chamar esta função não precisa remedir o
# artefato real depois, e uma remedição "por precaução" seria linha morta com
# comentário descrevendo um mecanismo que não existe.
avaliar_forma_em_sandbox() { # avaliar_forma_em_sandbox <dir_golden> <arquivo_de_falhas>
	(
		falhas_totais=0
		falhas_caso=0
		afirmar_forma_do_fonte_do_pdf "$1" >/dev/null 2>"$2"
		printf '%d' "${falhas_totais}"
	)
}

ct_602() {
	caso "CT-602" "prova de falsificação — artefato truncado e inventário sem a entrada REPROVAM"

	local caixa="${DIR_TRABALHO}/ct602"
	local m1="${caixa}/m1" m2="${caixa}/m2" controle="${caixa}/controle"
	rm -rf "${caixa}"
	mkdir -p "${m1}" "${m2}" "${controle}"
	cp -a "${DIR_GOLDEN}/." "${m1}/"
	cp -a "${DIR_GOLDEN}/." "${m2}/"
	cp -a "${DIR_GOLDEN}/." "${controle}/"

	# M1 — o fonte truncado a 100 linhas. `head -n` corta por quebra de linha e
	# preserva o CRLF das que sobram: o único desvio é a contagem, e é ela que a
	# asserção precisa pegar.
	head -n "$((LINHAS_DO_CABECALHO_DO_PDF + 100))" "${m1}/${ARQ_FONTE_DO_PDF}" \
		>"${caixa}/truncado" && mv "${caixa}/truncado" "${m1}/${ARQ_FONTE_DO_PDF}"

	# M2 — o inventário do manifesto sem a entrada do artefato novo.
	grep -v "^| \`${ARQ_FONTE_DO_PDF}\` |" "${m2}/PROCEDENCIA.md" \
		>"${caixa}/manifesto" && mv "${caixa}/manifesto" "${m2}/PROCEDENCIA.md"

	local falhas_m1 falhas_m2 falhas_controle
	falhas_m1="$(avaliar_forma_em_sandbox "${m1}" "${caixa}/m1.err")"
	falhas_m2="$(avaliar_forma_em_sandbox "${m2}" "${caixa}/m2.err")"
	falhas_controle="$(avaliar_forma_em_sandbox "${controle}" "${caixa}/controle.err")"

	afirmar_igual "M1 (fonte truncado a 100 linhas) reprova com exatamente uma falha" \
		"1" "${falhas_m1}"
	afirmar_igual "a falha de M1 nomeia ${LINHAS_DO_FONTE_DO_PDF} esperado contra 100 obtido" \
		"1" "$(grep -cF "esperado [${LINHAS_DO_FONTE_DO_PDF}], obtido [100]" "${caixa}/m1.err" || true)"

	# Duas falhas, e as duas são o mesmo defeito visto pelas duas asserções da
	# bijeção: o artefato órfão nomeado, e a igualdade das listas ordenadas.
	afirmar_igual "M2 (inventário sem a entrada) reprova com exatamente duas falhas" \
		"2" "${falhas_m2}"
	afirmar_igual "a falha de M2 nomeia o artefato órfão" \
		"1" "$(grep -cF "fora do inventário do manifesto — esperado [], obtido [${ARQ_FONTE_DO_PDF}]" \
			"${caixa}/m2.err" || true)"

	afirmar_igual "o controle íntegro passa sem nenhuma falha" "0" "${falhas_controle}"
	afirmar_igual "o controle íntegro não emite linha de falha" \
		"0" "$(grep -c . "${caixa}/controle.err" || true)"

	fechar_caso "CT-602"
}

# --------------------------------------------------------------------------- #
# CT-640 — o manifesto tem DOIS autores, e nenhum apaga a seção do outro.
#
# INVARIANTE: a §5 do `PROCEDENCIA.md` — o inventário que a bijeção do CT-601
# confere — sobrevive a uma gravação de `capturar.py` e é regravável SEM o sistema
# legado de pé. As duas metades são exercitadas contra os scripts reais: a
# gravação, chamando o ponto único de escrita de `capturar.py`; o reparo, rodando
# `extrair-fonte-do-pdf.sh --so-manifesto` numa árvore de sandbox com o `docker`
# mudo no PATH.
#
# POR QUE ESTE CASO EXISTE: `capturar.py` reescrevia o manifesto INTEIRO, e
# `montar_procedencia` não conhece a §5. Como `verificar-captura.sh` executa
# `capturar.py` dentro do próprio `main` (CT-001, CT-004 e CT-005), rodar aquele
# verificador apagava a §5 e deixava o CT-601 vermelho — em silêncio, porque o
# CT-004 exclui `PROCEDENCIA.md` do diff de determinismo por contrato e o CT-603 só
# observa a janela do extrator. Nenhum caso cobria a INTERAÇÃO entre os dois
# geradores, e foi essa lacuna que tornou o defeito invisível.
#
# POR QUE O REPARO ENTRA AQUI, E NÃO NO `verificar-captura.sh`: o caminho que
# regrava a §5 tem de continuar existindo depois da virada, e este é o verificador
# cujo cabeçalho declara sobreviver a ela. Um caso de reparo que só rodasse com o
# legado de pé provaria exatamente o que não interessa.
#
# O NEGATIVO QUE DISCRIMINA está nas duas pontas: a gravação afirma que as seções
# 1 a 4 FORAM substituídas (senão "preservou tudo" seria indistinguível de "não
# escreveu nada"), e o reparo afirma que o golden mutilado REPROVA na asserção do
# CT-601 antes de ser reparado (senão "passou depois" seria indistinguível de
# "nunca esteve quebrado").
# --------------------------------------------------------------------------- #
ARQ_CAPTURAR="capturar.py"
FALHAS_DO_MANIFESTO_SEM_INVENTARIO=4

medidas_da_autoria=""

medir_autoria_do_manifesto() { # medir_autoria_do_manifesto <dir_golden> <capturar.py>
	medidas_da_autoria="$(python3 - "$1" "$2" <<'PY'
import importlib.util
import re
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

golden, arq_capturar = Path(sys.argv[1]), Path(sys.argv[2])

# D4 (F3/T1) fechado — a linha abaixo vem ANTES de qualquer `exec_module`, e é a
# origem, não a limpeza depois. O `SourceFileLoader` grava o bytecode AO LADO do
# fonte por padrão, de modo que toda execução deste verificador criava
# `deploy/scripts/caracterizacao/__pycache__/capturar.cpython-3NN.pyc` (105 KB,
# binário) DENTRO do diretório versionado que ele existe para conferir — e o
# cabeçalho deste arquivo declara que ele "lê apenas o que está versionado".
# Medido em 2026-08-12: o resíduo chegou a ser commitado e derrubou a âncora
# `CT-626 (d)` do `packages/db`, que audita as classes de arquivo da árvore por
# igualdade. Apagar no `trap` fecharia a ponta e deixaria a escrita acontecendo.
sys.dont_write_bytecode = True

# O módulo é carregado do CAMINHO, e não do nome: o que se prova é o comportamento
# do arquivo versionado, e um `import capturar` qualquer poderia resolver para
# outro lugar do `sys.path`.
especificacao = importlib.util.spec_from_file_location("capturar_sob_teste", arq_capturar)
capturar = importlib.util.module_from_spec(especificacao)
especificacao.loader.exec_module(capturar)

original = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
posicao = original.find("\n## 5. ")
print(f"secao_alheia_presente={0 if posicao < 0 else 1}")
if posicao < 0:
    raise SystemExit(0)
secao_alheia = original[posicao + 1:]

# Corpo sintético no lugar do que `montar_procedencia` produziria: o que se afere é
# a JUNÇÃO, e montar o corpo de verdade exigiria o envelope de uma captura.
CORPO = "# Procedência dos golden\n\n## 1. Identificação da captura\n\ncorpo desta captura\n"

with TemporaryDirectory() as caixa:
    alvo = Path(caixa) / "PROCEDENCIA.md"
    alvo.write_text(original, encoding="utf-8")
    capturar.gravar_procedencia(alvo, CORPO)
    depois = alvo.read_text(encoding="utf-8")

    print(f"secao_alheia_sobreviveu={1 if depois.endswith(secao_alheia) else 0}")
    print(f"corpo_novo_aplicado={1 if depois.startswith(CORPO.rstrip(chr(10))) else 0}")
    print(f"juncao_exata={1 if depois == CORPO.rstrip(chr(10)) + 2 * chr(10) + secao_alheia else 0}")
    # O corpo antigo tinha as seções 2 a 4; se sobrou alguma, a gravação não
    # aconteceu e a preservação seria vacuidade.
    print(f"corpo_antigo_removido={1 if '## 4. ' not in depois else 0}")

    virgem = Path(caixa) / "sem-secao-alheia.md"
    capturar.gravar_procedencia(virgem, CORPO)
    print(
        "sem_anterior_grava_o_corpo="
        + str(1 if virgem.read_text(encoding="utf-8") == CORPO else 0)
    )

# Entrada única de escrita: qualquer outro caminho que gravasse o manifesto teria
# de nomeá-lo, e nomeá-lo é o que estas duas contagens tornam visível.
fonte = arq_capturar.read_text(encoding="utf-8")

# D5 (F3/T1) fechado — a classe alcança as DUAS formas de aspa. A expressão anterior
# usava `chr(34)` nas duas pontas e enxergava só a aspa dupla: um segundo autor
# escrito com aspa simples — `(DIR_GOLDEN / 'PROCEDENCIA.md').write_text(...)` —
# deixava as NOVE asserções do CT-640 verdes, porque as seis comportamentais chamam
# `gravar_procedencia` diretamente e ela continua correta. O manifesto voltava a ter
# dois autores com o caso inteiro aprovado. O que se perdia não era a detecção do
# efeito (o CT-601 acusaria na execução seguinte), era a ATRIBUIÇÃO — que é
# precisamente o que tornava o defeito original silencioso.
# O estilo `chr()` é preservado de propósito: o heredoc é `<<'PY'` e não expande,
# mas escrever aspas cruas aqui convida a próxima edição a quebrá-lo.
ASPAS = chr(34) + chr(39)
MOLDE_DO_MANIFESTO = "[" + ASPAS + "]PROCEDENCIA[.]md[" + ASPAS + "]"
print(f"literal_do_manifesto={len(re.findall(MOLDE_DO_MANIFESTO, fonte))}")
usos = [
    linha
    for linha in fonte.splitlines()
    if "ARQ_PROCEDENCIA" in linha and not linha.startswith("ARQ_PROCEDENCIA =")
]
print(f"usos_da_constante={len(usos)}")
print(
    "uso_fora_do_ponto_unico="
    + " ".join(linha.strip() for linha in usos if "gravar_procedencia(" not in linha)
)
PY
	)"
}

medida_da_autoria() { printf '%s\n' "${medidas_da_autoria}" | sed -n "s/^$1=//p" | head -1; }

ct_604() {
	caso "CT-640" "a §5 do manifesto sobrevive à captura e é regravável sem o legado"

	# ---- metade 1: `capturar.py` grava sem apagar a seção que não é dele ----
	medir_autoria_do_manifesto "${DIR_GOLDEN}" "${DIR_SCRIPTS}/${ARQ_CAPTURAR}"

	afirmar_igual "o manifesto versionado tem a seção do extrator" \
		"1" "$(medida_da_autoria secao_alheia_presente)"
	afirmar_igual "a seção do extrator sobrevive byte a byte a uma gravação de ${ARQ_CAPTURAR}" \
		"1" "$(medida_da_autoria secao_alheia_sobreviveu)"
	afirmar_igual "as seções da captura são substituídas pelo corpo novo" \
		"1" "$(medida_da_autoria corpo_novo_aplicado)"
	afirmar_igual "nenhuma seção do corpo antigo sobra no manifesto gravado" \
		"1" "$(medida_da_autoria corpo_antigo_removido)"
	afirmar_igual "o manifesto gravado é exatamente corpo novo + seção preservada" \
		"1" "$(medida_da_autoria juncao_exata)"
	afirmar_igual "sem seção alheia no disco, a gravação não inventa seção" \
		"1" "$(medida_da_autoria sem_anterior_grava_o_corpo)"

	afirmar_igual "${ARQ_CAPTURAR} nomeia o manifesto em um único ponto" \
		"1" "$(medida_da_autoria literal_do_manifesto)"
	afirmar_igual "a constante do manifesto é consumida uma única vez" \
		"1" "$(medida_da_autoria usos_da_constante)"
	afirmar_igual "nenhum uso do manifesto fora do ponto único de escrita" \
		"" "$(medida_da_autoria uso_fora_do_ponto_unico)"

	# ---- metade 2: a seção é reparável sem o sistema legado de pé ----
	# Árvore de sandbox com a mesma forma do repositório: o extrator deriva a raiz
	# do próprio caminho, então rodá-lo de dentro do sandbox faz `DIR_GOLDEN`
	# apontar para a cópia. Nunca a árvore de trabalho — o caso mutila o manifesto
	# de propósito, e mutilá-lo no repositório deixaria o oráculo pela metade se o
	# script morresse no meio.
	local caixa="${DIR_TRABALHO}/ct604"
	local golden_sandbox="${caixa}/${REL_GOLDEN}"
	rm -rf "${caixa}"
	mkdir -p "${golden_sandbox}" "${caixa}/${REL_SCRIPTS}" "${caixa}/bin-mudo"
	cp -a "${DIR_GOLDEN}/." "${golden_sandbox}/"
	cp -a "${DIR_SCRIPTS}/extrair-fonte-do-pdf.sh" "${caixa}/${REL_SCRIPTS}/"

	# O defeito exato que uma execução de `capturar.py` produzia antes da correção.
	python3 - "${golden_sandbox}/PROCEDENCIA.md" <<'PY'
import sys
from pathlib import Path

caminho = Path(sys.argv[1])
texto = caminho.read_text(encoding="utf-8")
posicao = texto.find("\n## 5. ")
caminho.write_text(texto if posicao < 0 else texto[: posicao + 1], encoding="utf-8")
PY

	afirmar_igual "o manifesto mutilado reprova na asserção do CT-601" \
		"${FALHAS_DO_MANIFESTO_SEM_INVENTARIO}" \
		"$(avaliar_forma_em_sandbox "${golden_sandbox}" "${caixa}/antes.err")"
	afirmar_igual "a falha nomeia o inventário ausente" \
		"1" "$(grep -cF "a §5 do manifesto declara o inventário — esperado [0], obtido [1]" \
			"${caixa}/antes.err" || true)"

	# `docker` que responde erro a tudo, antes no PATH: se o modo offline tocasse
	# qualquer pré-condição do legado, o script sairia com o código de
	# indisponibilidade em vez de zero. É a mesma fronteira que o CT-603 usa.
	printf '#!/usr/bin/env bash\nexit 1\n' >"${caixa}/bin-mudo/docker"
	chmod +x "${caixa}/bin-mudo/docker"

	local codigo=0
	set +e
	PATH="${caixa}/bin-mudo:${PATH}" bash "${caixa}/${REL_SCRIPTS}/extrair-fonte-do-pdf.sh" \
		--so-manifesto >"${caixa}/reparo.out" 2>"${caixa}/reparo.err"
	codigo=$?
	set -e

	afirmar_igual "o reparo da §5 termina com sucesso sem o legado disponível" "0" "${codigo}"
	afirmar_igual "o reparo não emite AVISO de indisponibilidade do legado" \
		"0" "$(grep -c 'AVISO' "${caixa}/reparo.err" || true)"
	afirmar_igual "o manifesto reparado é byte a byte o versionado" \
		"$(sha256sum "${DIR_GOLDEN}/PROCEDENCIA.md" | cut -d' ' -f1)" \
		"$(sha256sum "${golden_sandbox}/PROCEDENCIA.md" | cut -d' ' -f1)"
	afirmar_igual "o golden reparado volta a passar na asserção do CT-601" \
		"0" "$(avaliar_forma_em_sandbox "${golden_sandbox}" "${caixa}/depois.err")"

	# O reparo é do MANIFESTO, e só dele: o modo offline não recapta o fonte, e um
	# artefato tocado ali denunciaria que ele fala com o legado por outro caminho.
	afirmar_igual "o reparo não altera o fonte do Server Script" \
		"$(sha256sum "${DIR_GOLDEN}/${ARQ_FONTE_DO_PDF}" | cut -d' ' -f1)" \
		"$(sha256sum "${golden_sandbox}/${ARQ_FONTE_DO_PDF}" | cut -d' ' -f1)"

	fechar_caso "CT-640"
}

# --------------------------------------------------------------------------- #
# CT-701 — os caminhos do documento sem oráculo: um desfecho por eixo, e nada
#          além dos dois admitidos.
#
# INVARIANTE: para cada um dos três eixos ainda sem golden (contrato com fiador,
# locatário pessoa jurídica, parte sem documento de identidade), OU existe contrato
# real que o exercite e ele está capturado como artefato versionado, OU a ausência
# está registrada como ausência MEDIDA — com a consulta que executou e não retornou
# linha — e nunca inferida. Nunca um terceiro estado, nunca os dois.
#
# O QUE ESTE CASO NÃO FAZ, e por quê: ele não fala com o sistema legado e não
# reexecuta consulta nenhuma. A metade que exige o legado de pé é a própria captura;
# esta aqui é a metade que SOBREVIVE à virada, e o que ela confere é que o
# resultado registrado é internamente consistente — eixo declarado pelo produtor
# com desfecho no manifesto, desfecho capturado com artefato presente, desfecho de
# ausência sem artefato, e o artefato exercitando de fato o ramo que ele declara.
#
# A lista de eixos é DECLARADA no topo (`EIXOS_SEM_ORACULO`), nunca lida do
# produtor: enquanto era lida, um eixo removido de `capturar.py` sumia do manifesto
# E da expectativa ao mesmo tempo, e a bijeção aprovava o desaparecimento. O caso
# confere, portanto, TRÊS eixos e não "os que houver" — é o que o mutante M5
# exercita.
# --------------------------------------------------------------------------- #
medidas_dos_caminhos=""

medir_caminhos_sem_oraculo() { # medir_caminhos_sem_oraculo <dir_golden> <capturar.py>
	medidas_dos_caminhos="$(python3 - "$1" "$2" "${TITULO_DOS_CAMINHOS}" \
		"${TRECHO_COM_IDENTIDADE_CIVIL}" "${ARQ_PDF_SINTETICO}" \
		"${EIXOS_SEM_ORACULO[*]}" <<'PY'
import re
import sys
from pathlib import Path

golden, capturar = Path(sys.argv[1]), Path(sys.argv[2])
TITULO, TRECHO_COM_IDENTIDADE, ARQ_SINTETICO = sys.argv[3], sys.argv[4], sys.argv[5]
EIXOS_ESPERADOS = set(sys.argv[6].split())

DESFECHOS_ADMITIDOS = ("capturado", "ausência medida")

# A marca do ramo é o ORÁCULO, e por isso é escrita aqui e não lida do artefato:
# um verificador que tirasse a marca do próprio arquivo que confere aprovaria um
# artefato que não exercita ramo nenhum. Para o eixo sem identidade civil a marca é
# a forma CURTA da qualificação — a que a regra usa quando o RG está vazio.
MARCA_DO_RAMO = {
    "contrato_com_fiador": "FIADOR (A) (S):",
    "locatario_pessoa_juridica": "portador(a) do CNPJ número",
    "parte_sem_documento_identidade": "portador(a) do ",
}

RESIDUOS_PESSOAIS = (
    ("CPF", re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")),
    ("CNPJ", re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")),
    ("CEP", re.compile(r"\d{5}-\d{3}")),
    ("email", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
)


def normalizado(texto):
    return re.sub(r"\s+", " ", texto)


fonte_do_produtor = capturar.read_text(encoding="utf-8")
bloco = re.search(r"ARTEFATO_POR_EIXO = \{(.*?)\n\}", fonte_do_produtor, re.DOTALL)
declarados = dict(re.findall(r'"([a-z_]+)":\s*"([^"]+)"', bloco.group(1))) if bloco else {}
print("eixos_declarados=" + " ".join(sorted(declarados)))
print("artefatos_declarados=" + " ".join(sorted(set(declarados.values()))))

# Confronto do produtor com a expectativa ESCRITA no verificador, nos dois
# sentidos. É o que impede um eixo de sair do produtor e do manifesto ao mesmo
# tempo sem que nada reprove: a expectativa não se move junto.
print("eixos_esperados_ausentes_no_produtor="
      + " ".join(sorted(EIXOS_ESPERADOS - set(declarados))))
print("eixos_do_produtor_fora_do_esperado="
      + " ".join(sorted(set(declarados) - EIXOS_ESPERADOS)))

manifesto = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
secao = re.search(
    "\n" + re.escape(TITULO) + r"(.*?)(?=\n## \d)", manifesto, re.DOTALL
)
print("secao_ausente=" + ("0" if secao else "1"))
corpo = secao.group(1) if secao else ""

desfechos = {}
repetidos = []
invalidos = []
for eixo, desfecho in re.findall(r"\n### `([a-z_]+)` — (.+)", corpo):
    desfecho = desfecho.strip()
    if eixo in desfechos:
        repetidos.append(eixo)
    desfechos[eixo] = desfecho
    if desfecho not in DESFECHOS_ADMITIDOS:
        invalidos.append(eixo + "=" + desfecho)

print("eixos_no_manifesto=" + " ".join(sorted(desfechos)))
print("eixos_sem_desfecho=" + " ".join(sorted(set(declarados) - set(desfechos))))
print("eixos_nao_declarados=" + " ".join(sorted(set(desfechos) - set(declarados))))
print("eixos_com_desfecho_repetido=" + " ".join(sorted(set(repetidos))))
print("desfechos_invalidos=" + " ".join(sorted(invalidos)))

# Cada eixo é recortado do corpo para que o artefato citado, a contagem e a
# consulta pertençam ao eixo que os declara — varrer o corpo inteiro deixaria um
# eixo herdar a evidência do vizinho.
blocos = {}
for casamento in re.finditer(r"\n### `([a-z_]+)` — .+?(?=\n### |\Z)", corpo, re.DOTALL):
    blocos[casamento.group(1)] = casamento.group(0)

capturados_sem_artefato = []
ausencias_com_artefato = []
ausencias_sem_consulta = []
ausencias_com_contagem = []
ramos_nao_exercitados = []
residuo_pessoal = []
artefatos_citados = set()

for eixo, desfecho in sorted(desfechos.items()):
    trecho = blocos.get(eixo, "")
    citado = re.search(r"Artefato: `([^`]+)`", trecho)
    consulta = re.search(r"```sql\n(.*?)```", trecho, re.DOTALL)
    contagem = re.search(r"que o exercitam: \*\*(\d+)\*\*", trecho)

    if desfecho == "capturado":
        if not citado or not (golden / citado.group(1)).is_file():
            capturados_sem_artefato.append(eixo)
            continue
        artefatos_citados.add(citado.group(1))
        texto = normalizado((golden / citado.group(1)).read_text(encoding="utf-8"))
        marca = MARCA_DO_RAMO.get(eixo)
        if marca and normalizado(marca) not in texto:
            ramos_nao_exercitados.append(eixo)
        for rotulo, expressao in RESIDUOS_PESSOAIS:
            achado = expressao.search(texto)
            if achado:
                residuo_pessoal.append(citado.group(1) + ":" + rotulo)
    else:
        arquivo = declarados.get(eixo)
        if arquivo and (golden / arquivo).is_file():
            ausencias_com_artefato.append(eixo)
        if not consulta or not consulta.group(1).strip():
            ausencias_sem_consulta.append(eixo)
        if not contagem or contagem.group(1) != "0":
            ausencias_com_contagem.append(eixo)

print("capturados_sem_artefato=" + " ".join(sorted(capturados_sem_artefato)))
print("ausencias_com_artefato=" + " ".join(sorted(ausencias_com_artefato)))
print("ausencias_sem_consulta=" + " ".join(sorted(ausencias_sem_consulta)))
print("ausencias_com_contagem_nao_zero=" + " ".join(sorted(ausencias_com_contagem)))
print("ramos_nao_exercitados=" + " ".join(sorted(ramos_nao_exercitados)))
print("residuo_pessoal=" + " ".join(sorted(set(residuo_pessoal))))

# Artefato de caminho presente no diretório que eixo nenhum reivindica: o outro
# sentido da bijeção, e o que pega um golden que sobreviveu à mudança de desfecho.
orfaos = [
    nome for nome in sorted(set(declarados.values()))
    if (golden / nome).is_file() and nome not in artefatos_citados
]
print("artefatos_de_caminho_orfaos=" + " ".join(orfaos))

sintetico = golden / ARQ_SINTETICO
texto_sintetico = normalizado(sintetico.read_text(encoding="utf-8")) if sintetico.is_file() else ""
print("sintetico_com_identidade_civil="
      + ("1" if normalizado(TRECHO_COM_IDENTIDADE) in texto_sintetico else "0"))
print("sintetico_com_forma_curta="
      + ("1" if normalizado(MARCA_DO_RAMO["parte_sem_documento_identidade"]) in texto_sintetico
         else "0"))
PY
	)"
}

medida_dos_caminhos() {
	printf '%s\n' "${medidas_dos_caminhos}" | sed -n "s/^$1=//p" | head -1
}

# A asserção do CT-701, isolada para que os mutantes a apliquem LITERALMENTE às
# cópias defeituosas — mesmo mecanismo do par CT-601/CT-602.
afirmar_desfecho_dos_caminhos() { # afirmar_desfecho_dos_caminhos <dir_golden> <capturar.py>
	medir_caminhos_sem_oraculo "$1" "$2"

	afirmar_igual "a §4.1 do manifesto existe" "0" "$(medida_dos_caminhos secao_ausente)"

	# O par que amarra o produtor à expectativa DECLARADA, e não a si mesmo. A
	# asserção que estava aqui até a rodada 1 exigia apenas conjunto não-vazio, e
	# com ela o caso seguia verde depois de um eixo sumir do produtor e do manifesto
	# ao mesmo tempo — provava "os eixos que houver têm desfecho" em vez de "os três
	# eixos do CA-01 têm desfecho". Ver o bloco de `EIXOS_SEM_ORACULO` no topo.
	afirmar_igual "o produtor declara os ${#EIXOS_SEM_ORACULO[@]} eixos do CA-01" \
		"" "$(medida_dos_caminhos eixos_esperados_ausentes_no_produtor)"
	afirmar_igual "o produtor não declara eixo fora dos ${#EIXOS_SEM_ORACULO[@]} esperados" \
		"" "$(medida_dos_caminhos eixos_do_produtor_fora_do_esperado)"

	afirmar_igual "todo eixo declarado pelo produtor tem desfecho no manifesto" \
		"" "$(medida_dos_caminhos eixos_sem_desfecho)"
	afirmar_igual "nenhum desfecho no manifesto para eixo que o produtor não declara" \
		"" "$(medida_dos_caminhos eixos_nao_declarados)"
	afirmar_igual "nenhum eixo com mais de um desfecho" \
		"" "$(medida_dos_caminhos eixos_com_desfecho_repetido)"
	afirmar_igual "nenhum desfecho fora dos dois admitidos" \
		"" "$(medida_dos_caminhos desfechos_invalidos)"

	afirmar_igual "todo eixo capturado nomeia artefato presente em golden/" \
		"" "$(medida_dos_caminhos capturados_sem_artefato)"
	afirmar_igual "nenhum eixo de ausência medida tem artefato gravado" \
		"" "$(medida_dos_caminhos ausencias_com_artefato)"
	afirmar_igual "toda ausência medida traz a consulta que executou" \
		"" "$(medida_dos_caminhos ausencias_sem_consulta)"
	afirmar_igual "toda ausência medida declara zero contratos que a exercitam" \
		"" "$(medida_dos_caminhos ausencias_com_contagem_nao_zero)"
	afirmar_igual "nenhum artefato de caminho sem eixo que o reivindique" \
		"" "$(medida_dos_caminhos artefatos_de_caminho_orfaos)"

	afirmar_igual "todo artefato capturado exercita o ramo do eixo que o declara" \
		"" "$(medida_dos_caminhos ramos_nao_exercitados)"
	afirmar_igual "nenhum dado pessoal em forma reconhecível nos artefatos capturados" \
		"" "$(medida_dos_caminhos residuo_pessoal)"

	# O contraste que discrimina: o golden sintético qualifica a parte COM identidade
	# civil, e o capturado usa a forma curta. Sem este par, "o ramo novo foi
	# alcançado" seria indistinguível de "o texto capturado é o mesmo de antes".
	afirmar_igual "o golden sintético qualifica a parte com identidade civil" \
		"1" "$(medida_dos_caminhos sintetico_com_identidade_civil)"
	afirmar_igual "o golden sintético NÃO usa a forma curta da qualificação" \
		"0" "$(medida_dos_caminhos sintetico_com_forma_curta)"
}

# O terceiro parâmetro é o produtor a conferir, e existe para o M5: os quatro
# primeiros mutantes deformam a cópia do golden, e o M5 deforma o PRODUTOR. Sem
# ele, `capturar.py` seria sempre lido do original e a classe "eixo removido dos
# dois lados" ficaria sem mutante que a exercitasse.
avaliar_caminhos_em_sandbox() { # avaliar_caminhos_em_sandbox <dir_golden> <falhas> [capturar.py]
	(
		falhas_totais=0
		falhas_caso=0
		afirmar_desfecho_dos_caminhos "$1" "${3:-${DIR_SCRIPTS}/${ARQ_CAPTURAR}}" \
			>/dev/null 2>"$2"
		printf '%d' "${falhas_totais}"
	)
}

# Remoção da seção de um eixo do manifesto, usada por DOIS mutantes: o M1, que a
# aplica sozinha, e o M5, que a aplica junto com a remoção do eixo no produtor. As
# duas classes são distintas e se separam justamente pelo que MAIS muda — a mutação
# comum é uma função para que as duas não divirjam em silêncio.
mutar_manifesto_sem_o_eixo() { # mutar_manifesto_sem_o_eixo <PROCEDENCIA.md> <eixo>
	python3 - "$1" "$2" <<'PY'
import re
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
texto = alvo.read_text(encoding="utf-8")
mutado = re.sub(r"\n### `" + re.escape(sys.argv[2]) + r"` — .*?(?=\n### |\n## )", "\n",
                texto, flags=re.DOTALL)
if mutado == texto:
    raise SystemExit("mutante: a seção de `" + sys.argv[2] + "` não foi encontrada no manifesto")
alvo.write_text(mutado, encoding="utf-8")
PY
}

# Acréscimo de uma seção de eixo BEM-FORMADA ao manifesto, usada pelo M6. Ela
# precisa ser bem-formada de propósito: o mutante existe para exercitar UMA
# asserção — a segunda direção da bijeção produtor↔expectativa —, e uma seção
# malformada faria o caso reprovar por outras (desfecho ausente, consulta vazia,
# contagem não-zero), o que deixaria a asserção sob prova sem evidência de que foi
# ELA que pegou o defeito.
acrescentar_secao_de_ausencia() { # acrescentar_secao_de_ausencia <PROCEDENCIA.md> <eixo> <título>
	python3 - "$1" "$2" "$3" <<'PY'
import re
import sys
from pathlib import Path

alvo, eixo, titulo = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
texto = alvo.read_text(encoding="utf-8")
secao = re.search("\n" + re.escape(titulo) + r"(.*?)(?=\n## \d)", texto, re.DOTALL)
if not secao:
    raise SystemExit("mutante M6: a seção `" + titulo + "` não foi encontrada no manifesto")
bloco = (
    "\n### `" + eixo + "` — ausência medida\n\n"
    "- Artefato: nenhum\n"
    "- Consulta:\n\n"
    "```sql\nSELECT 1 WHERE false;\n```\n\n"
    "- Contratos que o exercitam: **0**\n"
)
fim = secao.end(1)
alvo.write_text(texto[:fim] + bloco + texto[fim:], encoding="utf-8")
PY
}

ct_701() {
	caso "CT-701" "caminhos do documento sem oráculo — um desfecho por eixo, capturado ou ausência medida"

	afirmar_desfecho_dos_caminhos "${DIR_GOLDEN}" "${DIR_SCRIPTS}/${ARQ_CAPTURAR}"

	local versionados
	versionados="$(caminhos_versionados_do_golden)"
	local nome ausentes=0
	for nome in "${GOLDEN_DOS_CAMINHOS_SEM_ORACULO[@]}"; do
		printf '%s\n' "${versionados}" | grep -qxF "${REL_GOLDEN}/${nome}" ||
			ausentes=$((ausentes + 1))
	done
	afirmar_igual "todo artefato capturado está versionado (${#GOLDEN_DOS_CAMINHOS_SEM_ORACULO[@]})" \
		"0" "${ausentes}"

	# ---- prova de falsificação: seis defeitos reintroduzidos, e o controle ----
	local caixa="${DIR_TRABALHO}/ct701"
	local m1="${caixa}/m1" m2="${caixa}/m2" m3="${caixa}/m3" m4="${caixa}/m4"
	local m5="${caixa}/m5" m6="${caixa}/m6" controle="${caixa}/controle"
	rm -rf "${caixa}"
	mkdir -p "${m1}" "${m2}" "${m3}" "${m4}" "${m5}" "${m6}" "${controle}"
	local caixa_de_mutante
	for caixa_de_mutante in "${m1}" "${m2}" "${m3}" "${m4}" "${m5}" "${m6}" "${controle}"; do
		cp -a "${DIR_GOLDEN}/." "${caixa_de_mutante}/"
	done

	local eixo_capturado="locatario_pessoa_juridica"
	local eixo_ausente="contrato_com_fiador"
	local artefato_capturado="${GOLDEN_DOS_CAMINHOS_SEM_ORACULO[0]}"

	# M1 — a seção de um eixo desaparece do manifesto: o eixo fica sem desfecho.
	mutar_manifesto_sem_o_eixo "${m1}/PROCEDENCIA.md" "${eixo_ausente}"

	# M2 — o desfecho de um eixo capturado vira ausência medida, e o artefato fica.
	python3 - "${m2}/PROCEDENCIA.md" "${eixo_capturado}" <<'PY'
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
alvo.write_text(
    alvo.read_text(encoding="utf-8").replace(
        "### `" + sys.argv[2] + "` — capturado",
        "### `" + sys.argv[2] + "` — ausência medida",
    ),
    encoding="utf-8",
)
PY

	# M3 — o dado pessoal volta ao artefato, na forma que a máscara tirou. O valor
	# entra por argumento, e não como literal no corpo do mutante: ele é a constante
	# `CPF_SINTETICO_DO_MUTANTE`, cuja razão de ser sintética e inválida está escrita
	# junto da declaração, no topo.
	python3 - "${m3}/${artefato_capturado}" "${MARCADOR_DO_DOCUMENTO_DO_LOCADOR}" \
		"${CPF_SINTETICO_DO_MUTANTE}" <<'PY'
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
alvo.write_text(
    alvo.read_text(encoding="utf-8").replace(sys.argv[2], sys.argv[3], 1),
    encoding="utf-8",
)
PY

	# M4 — a marca do ramo some do artefato: ele deixa de exercitar o eixo que
	# declara, e continuaria versionado como se exercitasse.
	python3 - "${m4}/${artefato_capturado}" <<'PY'
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
alvo.write_text(
    alvo.read_text(encoding="utf-8").replace("do CNPJ", "do CPF"),
    encoding="utf-8",
)
PY

	# M5 — o eixo some do PRODUTOR e do manifesto ao mesmo tempo. É a classe que a
	# lista lida do produtor não podia pegar: o eixo saía dos dois lados da bijeção
	# e o caso seguia verde com dois eixos. Só a expectativa DECLARADA o reprova, e
	# é por isso que este mutante deforma `capturar.py` — nenhum dos outros quatro o
	# toca.
	local capturar_m5="${caixa}/capturar-m5.py"
	cp -a "${DIR_SCRIPTS}/${ARQ_CAPTURAR}" "${capturar_m5}"
	mutar_manifesto_sem_o_eixo "${m5}/PROCEDENCIA.md" "${eixo_ausente}"
	python3 - "${capturar_m5}" "${eixo_ausente}" <<'PY'
import re
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
texto = alvo.read_text(encoding="utf-8")
mutado = re.sub(r'\n *"' + re.escape(sys.argv[2]) + r'": "[^"]+",', "", texto, count=1)
if mutado == texto:
    raise SystemExit("mutante M5: `" + sys.argv[2] + "` não está em ARTEFATO_POR_EIXO")
alvo.write_text(mutado, encoding="utf-8")
PY

	# M6 — a direção CONTRÁRIA do M5, e a que estava sem mutante. O M5 REMOVE um
	# eixo do produtor; nenhum mutante ACRESCENTAVA um. As duas direções da bijeção
	# são asserções distintas (`eixos_esperados_ausentes_no_produtor` e
	# `eixos_do_produtor_fora_do_esperado`), e a segunda nasceu sem prova de
	# falsificação — a `.claude/rules/testing-stack.md` a torna obrigatória para
	# asserção estática, e sem ela nada garantia que aquela linha pudesse reprovar.
	# O defeito que ela pega é concreto: um eixo entra em `capturar.py` e passa a
	# produzir artefato sem que o CA-01 o tenha declarado — captura que ninguém
	# pediu, num script que lê o site de PRODUÇÃO.
	local eixo_inventado='eixo_inventado'
	local capturar_m6="${caixa}/capturar-m6.py"
	cp -a "${DIR_SCRIPTS}/${ARQ_CAPTURAR}" "${capturar_m6}"
	acrescentar_secao_de_ausencia "${m6}/PROCEDENCIA.md" "${eixo_inventado}" \
		"${TITULO_DOS_CAMINHOS}"
	python3 - "${capturar_m6}" "${eixo_inventado}" <<'PY'
import re
import sys
from pathlib import Path

alvo = Path(sys.argv[1])
texto = alvo.read_text(encoding="utf-8")
mutado, trocas = re.subn(
    r"(ARTEFATO_POR_EIXO = \{\n)",
    r'\1    "' + sys.argv[2] + '": "contrato-pdf-inventado.txt",\n',
    texto,
    count=1,
)
if trocas == 0:
    raise SystemExit("mutante M6: `ARTEFATO_POR_EIXO` não foi encontrado no produtor")
alvo.write_text(mutado, encoding="utf-8")
PY

	local falhas_m1 falhas_m2 falhas_m3 falhas_m4 falhas_m5 falhas_m6 falhas_controle
	falhas_m1="$(avaliar_caminhos_em_sandbox "${m1}" "${caixa}/m1.err")"
	falhas_m2="$(avaliar_caminhos_em_sandbox "${m2}" "${caixa}/m2.err")"
	falhas_m3="$(avaliar_caminhos_em_sandbox "${m3}" "${caixa}/m3.err")"
	falhas_m4="$(avaliar_caminhos_em_sandbox "${m4}" "${caixa}/m4.err")"
	falhas_m5="$(avaliar_caminhos_em_sandbox "${m5}" "${caixa}/m5.err" "${capturar_m5}")"
	falhas_m6="$(avaliar_caminhos_em_sandbox "${m6}" "${caixa}/m6.err" "${capturar_m6}")"
	falhas_controle="$(avaliar_caminhos_em_sandbox "${controle}" "${caixa}/controle.err")"

	afirmar_diferente "M1 (eixo sem seção no manifesto) reprova" "0" "${falhas_m1}"
	afirmar_igual "a falha de M1 nomeia o eixo que ficou sem desfecho" \
		"1" "$(grep -cF "obtido [${eixo_ausente}]" "${caixa}/m1.err" || true)"

	afirmar_diferente "M2 (capturado rebaixado a ausência medida) reprova" "0" "${falhas_m2}"
	afirmar_igual "a falha de M2 nomeia o eixo cuja ausência tem artefato gravado" \
		"1" "$(grep -cF "ausência medida tem artefato gravado — esperado [], obtido [${eixo_capturado}]" \
			"${caixa}/m2.err" || true)"

	afirmar_diferente "M3 (documento pessoal de volta ao artefato) reprova" "0" "${falhas_m3}"
	afirmar_igual "a falha de M3 nomeia o artefato e a classe do dado" \
		"1" "$(grep -cF "obtido [${artefato_capturado}:CPF]" "${caixa}/m3.err" || true)"

	afirmar_diferente "M4 (marca do ramo apagada do artefato) reprova" "0" "${falhas_m4}"
	afirmar_igual "a falha de M4 nomeia o eixo cujo ramo deixou de ser exercitado" \
		"1" "$(grep -cF "obtido [${eixo_capturado}]" "${caixa}/m4.err" || true)"

	afirmar_diferente "M5 (eixo removido do produtor E do manifesto) reprova" "0" "${falhas_m5}"
	afirmar_igual "a falha de M5 nomeia o eixo que sumiu dos dois lados" \
		"1" "$(grep -cF "declara os ${#EIXOS_SEM_ORACULO[@]} eixos do CA-01 — esperado [], obtido [${eixo_ausente}]" \
			"${caixa}/m5.err" || true)"

	afirmar_diferente "M6 (eixo acrescentado ao produtor fora do CA-01) reprova" "0" "${falhas_m6}"
	afirmar_igual "a falha de M6 nomeia o eixo que o produtor declarou sem a expectativa" \
		"1" "$(grep -cF "não declara eixo fora dos ${#EIXOS_SEM_ORACULO[@]} esperados — esperado [], obtido [${eixo_inventado}]" \
			"${caixa}/m6.err" || true)"

	afirmar_igual "o controle íntegro passa sem nenhuma falha" "0" "${falhas_controle}"
	afirmar_igual "o controle íntegro não emite linha de falha" \
		"0" "$(grep -c . "${caixa}/controle.err" || true)"

	fechar_caso "CT-701"
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
	ct_601
	ct_602
	ct_604
	ct_701

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-golden: 11/11 casos aprovados (CT-010, CT-011, CT-013, CT-014, CT-433, CT-501, CT-503, CT-601, CT-602, CT-640, CT-701)\n'
		exit 0
	fi
	printf 'verificar-golden: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

main "$@"
