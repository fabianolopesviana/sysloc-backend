#!/usr/bin/env bash
#
# Verificação da captura da caracterização das regras legadas (TC-001).
#
# Casos cobertos: CT-001, CT-002, CT-003, CT-004, CT-005, CT-006, CT-007,
# CT-008, CT-009, CT-012, CT-502, CT-603 e a metade de logs do CT-013.
#
# EXIGE O SITE EFÊMERO DE PÉ. Rode entre `capturar.py` e
# `preparar-site-efemero.sh destruir` — dez dos catorze casos leem o site
# efêmero e se tornam inexecutáveis depois do teardown. Este script morre com a
# desinstalação do Frappe (F7), por construção; a metade que sobrevive é o
# `verificar-golden.sh`.
#
# O script derruba e recria o site efêmero ao longo dos casos e o deixa
# DESTRUÍDO ao final (CT-003).
#
# Uso: bash deploy/scripts/caracterizacao/verificar-captura.sh

set -euo pipefail

RAIZ_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
REL_GOLDEN="docs/specs/features/caracterizacao-regras-legadas/v1/golden"
DIR_GOLDEN="${RAIZ_REPO}/${REL_GOLDEN}"
REL_SCRIPTS="deploy/scripts/caracterizacao"
DIR_SCRIPTS="${RAIZ_REPO}/${REL_SCRIPTS}"
PREPARAR="${DIR_SCRIPTS}/preparar-site-efemero.sh"
CAPTURAR="${DIR_SCRIPTS}/capturar.py"

DIR_FRAPPE="/opt/frappe"
ARQ_COMPOSE="${DIR_FRAPPE}/docker-compose.yaml"
ARQ_COMPOSE_OVERRIDE="${DIR_FRAPPE}/docker-compose.override.yml"
SERVICO="backend"
SERVICO_BANCO="db"
SITE_EFEMERO="caracterizacao.localhost"
DIR_BENCH="/home/frappe/frappe-bench"
DIR_SITES="${DIR_BENCH}/sites"

DIAS_DESLOCAMENTO_RELOGIO=37

DIR_TRABALHO="$(mktemp -d)"
# Diretório temporário DENTRO do container onde vive a interposição de relógio do
# CT-005. Fica inerte enquanto ninguém o coloca em PYTHONPATH — ao contrário do
# `site-packages`, que o `site.py` importa em todo processo Python do container.
DIR_SHIM_NO_CONTAINER="/tmp/caracterizacao-shim-relogio"
shim_instalado=0

ultimo_codigo=0

limpar() {
	local codigo=$?
	# A interposição de relógio do CT-005 não pode sobreviver a uma falha do script.
	if [[ "${shim_instalado}" -eq 1 ]]; then
		compose exec -T "${SERVICO}" rm -rf "${DIR_SHIM_NO_CONTAINER}" >/dev/null 2>&1 || true
		shim_instalado=0
	fi
	rm -rf "${DIR_TRABALHO}"
	exit "${codigo}"
}
trap limpar EXIT

# --------------------------------------------------------------------------- #
# Vocabulário de asserção — a casa comum, carregada e NUNCA redeclarada aqui.
# Ver a razão em `deploy/scripts/verificacao/esqueleto-de-assercao.sh`.
# --------------------------------------------------------------------------- #
# shellcheck source=../verificacao/esqueleto-de-assercao.sh
source "$(dirname "${BASH_SOURCE[0]}")/../verificacao/esqueleto-de-assercao.sh"

# Fora do esqueleto compartilhado de propósito — ver a razão medida no cabeçalho
# de `deploy/scripts/verificacao/esqueleto-de-assercao.sh`: as quatro cópias desta
# função no repositório NÃO são o mesmo símbolo (uma delas grepa um ARQUIVO).
afirmar_contem() { # afirmar_contem <descricao> <arquivo> <agulha>
	if grep -qF -- "$3" "$2"; then
		ok "$1"
	else
		falhar "$1 — a substring [$3] não aparece em $(basename "$2")"
	fi
}

compose() {
	docker compose --project-directory "${DIR_FRAPPE}" \
		-f "${ARQ_COMPOSE}" -f "${ARQ_COMPOSE_OVERRIDE}" "$@"
}

no_container() {
	compose exec -T "${SERVICO}" bash -c "cd '${DIR_BENCH}' && $1"
}

bench_no_site_efemero() {
	no_container "bench --site '${SITE_EFEMERO}' $1"
}

python_no_container() {
	compose exec -T "${SERVICO}" bash -c "cd '${DIR_SITES}' && exec ../env/bin/python -"
}

ler_credencial_db() {
	awk '
		/^[[:space:]][[:space:]][a-zA-Z0-9_-]+:[[:space:]]*$/ { dentro_db = ($0 ~ /^[[:space:]][[:space:]]db:[[:space:]]*$/) }
		dentro_db && /MYSQL_ROOT_PASSWORD:/ {
			sub(/^[^:]*:[[:space:]]*/, "")
			gsub(/^"|"$/, "")
			gsub(/^'"'"'|'"'"'$/, "")
			print
			exit
		}
	' "${ARQ_COMPOSE}"
}

# Leitura ESTRITAMENTE somente-leitura do banco que atende a operação. Feita por
# SELECT direto no serviço de banco, e não por `bench` apontado para o site de
# produção: a ADR-0006 restringe execução de verificação naquele ambiente, e o
# CT-012 exige que os scripts versionados não carreguem esse tipo de invocação.
#
# Autentica como o USUÁRIO DA BASE, nunca como `root`. O Frappe cria o usuário do
# MariaDB com o mesmo nome do banco do site, e a senha dele mora no `site_config.json`
# de onde `base_producao` já sai — então o privilégio aqui é exatamente o que a função
# precisa: ler uma base. A credencial root segue necessária em
# `preparar-site-efemero.sh`, onde `new-site`/`restore`/`drop-site` de fato a exigem;
# o que ela não pode é atravessar até um caminho de SELECT. Com `-u root`, o raio de um
# erro de interpolação no heredoc SQL era a instância inteira — a mesma superfície que
# a ADR-0006 existe para reduzir.
consultar_banco_de_producao() { # consultar_banco_de_producao <sql>
	printf '%s\n' "${senha_producao}" |
		compose exec -T "${SERVICO_BANCO}" bash -c \
			"IFS= read -r cred; MYSQL_PWD=\"\$cred\" mysql -N -B -u '${base_producao}' '${base_producao}' -e \"$1\""
}

sha_dos_golden() {
	(cd "${DIR_GOLDEN}" && sha256sum ./* | sort)
}

# Os artefatos de caracterização, sem o manifesto. O PROCEDENCIA.md registra a
# data e a hora da captura e, por contrato, é o único arquivo autorizado a diferir
# entre duas execuções (CT-004).
#
# Fonte única do conjunto E da contagem: enquanto os nomes eram literais repetidos
# em três casos e o número era escrito à mão, acrescentar um artefato exigia
# lembrar de todos eles — e esquecer um deixava o artefato novo sem conferência
# de determinismo, que é a propriedade mais cara de recuperar depois.
GOLDEN_DE_CARACTERIZACAO=(
	"atualizar-atrasos-cobrancas.json"
	"calcular-mora.json"
	"contrato-ativacao.json"
	"contrato-cancelamento.json"
	"contrato-pdf.txt"
	"encerrar-contratos-vencidos.json"
	"marcar-cobrancas-vencidas.json"
	"metragem.json"
	"regua-de-cobranca.json"
)

sha_dos_golden_de_caracterizacao() {
	(cd "${DIR_GOLDEN}" && sha256sum "${GOLDEN_DE_CARACTERIZACAO[@]}" | sort)
}

estado_git_dos_golden() {
	git -C "${RAIZ_REPO}" status --porcelain -- "${REL_GOLDEN}/" | sort
}

executar_capturar() { # executar_capturar <rotulo>
	local rotulo="$1"
	set +e
	python3 "${CAPTURAR}" \
		>"${DIR_TRABALHO}/capturar-${rotulo}.out" \
		2>"${DIR_TRABALHO}/capturar-${rotulo}.err"
	ultimo_codigo=$?
	set -e
}

# Roda `capturar.py` com o relógio do processo de captura deslocado, e SÓ dele.
# A injeção acontece na fronteira: um `docker` de mesmo nome, antes no PATH, que
# acrescenta `-e PYTHONPATH=<shim>` ao `compose exec` disparado pela captura. O
# interpretador do container permanece intocado, e nenhum outro processo — nem o
# `docker exec` que o cron do host dispara a cada minuto contra o site de produção
# — enxerga o deslocamento.
executar_capturar_com_relogio_deslocado() { # <rotulo>
	local rotulo="$1"
	set +e
	PATH="${DIR_TRABALHO}/bin:${PATH}" python3 "${CAPTURAR}" \
		>"${DIR_TRABALHO}/capturar-${rotulo}.out" \
		2>"${DIR_TRABALHO}/capturar-${rotulo}.err"
	ultimo_codigo=$?
	set -e
}

executar_preparar() { # executar_preparar <subcomando> <rotulo>
	local subcomando="$1" rotulo="$2"
	set +e
	bash "${PREPARAR}" "${subcomando}" \
		>"${DIR_TRABALHO}/preparar-${rotulo}.out" \
		2>"${DIR_TRABALHO}/preparar-${rotulo}.err"
	ultimo_codigo=$?
	set -e
}

contar_sites_efemeros() {
	no_container "ls -1 sites/ 2>/dev/null | grep -c '^${SITE_EFEMERO}\$' || true" | tr -d '\r\n'
}

# --------------------------------------------------------------------------- #
# Estado do site efêmero: uma única leitura, consumida por CT-006 a CT-009.
# --------------------------------------------------------------------------- #
capturar_estado_do_site() {
	python_no_container >"${DIR_TRABALHO}/estado-site.json" <<'PY'
import json
import sys

import frappe

frappe.init(site="caracterizacao.localhost")
frappe.connect()

def por_nome(doctype, campos):
    linhas = frappe.get_all(
        doctype, filters={"name": ["like", "%-CARACT-%"]}, fields=["name"] + campos
    )
    return {linha["name"]: linha for linha in linhas}

estado = {
    "imoveis": por_nome("Imovel", ["metragem_total", "status_locacao", "contrato_ativo"]),
    "contratos": por_nome("Contrato", ["status_contrato", "imovel", "data_fim_locacao"]),
    "cobrancas": por_nome("Cobranca", [
        "status_cobranca", "data_vencimento", "valor_original", "valor_multa",
        "valor_juros", "valor_total", "pagamento_confirmado",
        "data_inicio_atraso", "data_ultima_atualizacao_atraso",
    ]),
}
sys.stdout.write(json.dumps(estado, ensure_ascii=False, default=str))
frappe.destroy()
PY
}

# --------------------------------------------------------------------------- #
# CT-006 / CT-007 — metragem
# --------------------------------------------------------------------------- #
ct_006() {
	caso "CT-006" "Metragem — 4 cenários, cada agregado igual ao persistido no site efêmero"

	if python3 - "${DIR_GOLDEN}/metragem.json" "${DIR_TRABALHO}/estado-site.json" <<'PY'
import json
import sys

golden = json.load(open(sys.argv[1], encoding="utf-8"))
estado = json.load(open(sys.argv[2], encoding="utf-8"))
erros = []

ESPERADAS = {"sem_comodo", "um_comodo", "varios_comodos", "varios_comodos_com_metragem_nula"}
cenarios = golden.get("cenarios", {})

if len(cenarios) != 4:
    erros.append(f"esperado 4 cenários, encontrado {len(cenarios)}")
if set(cenarios) != ESPERADAS:
    erros.append(f"chaves de cenário inesperadas: {sorted(cenarios)}")

for chave, cenario in sorted(cenarios.items()):
    if "valor_agregado" not in cenario:
        erros.append(f"cenário {chave}: campo valor_agregado ausente")
        continue
    referencia = cenario.get("imovel_ref")
    imovel = estado["imoveis"].get(referencia)
    if imovel is None:
        erros.append(f"cenário {chave}: imóvel {referencia!r} não encontrado no site efêmero")
        continue
    # O valor esperado vem do BANCO, não de literal do teste: é o que prova que o
    # agregado saiu do Server Script e não de uma soma feita pelo script de captura.
    if cenario["valor_agregado"] != imovel["metragem_total"]:
        erros.append(
            f"cenário {chave}: golden {cenario['valor_agregado']} != "
            f"banco {imovel['metragem_total']}"
        )
    if "comodos_entrada" not in cenario:
        erros.append(f"cenário {chave}: configuração de cômodos de entrada ausente")
    elif chave != "sem_comodo" and not cenario["comodos_entrada"]:
        erros.append(f"cenário {chave}: lista de cômodos de entrada vazia")
    elif chave == "sem_comodo" and cenario["comodos_entrada"]:
        erros.append("cenário sem_comodo: lista de cômodos de entrada deveria ser vazia")

um = cenarios.get("um_comodo", {})
if um.get("comodos_entrada"):
    metragem_unica = um["comodos_entrada"][0]["metragem"]
    if um.get("valor_agregado") != metragem_unica:
        erros.append(
            f"um_comodo: agregado {um.get('valor_agregado')} != metragem do único "
            f"cômodo {metragem_unica}"
        )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "4 cenários presentes e cada agregado bate com o campo persistido no banco"
	else
		falhar "metragem.json divergiu do site efêmero (ver acima)"
	fi

	fechar_caso "CT-006"
}

ct_007() {
	caso "CT-007" "Metragem — cenários distintos e degenerado registrado sem correção"

	if python3 - "${DIR_GOLDEN}/metragem.json" "${DIR_TRABALHO}/estado-site.json" \
		"${DIR_GOLDEN}/PROCEDENCIA.md" <<'PY'
import json
import re
import sys

golden = json.load(open(sys.argv[1], encoding="utf-8"))
estado = json.load(open(sys.argv[2], encoding="utf-8"))
manifesto = open(sys.argv[3], encoding="utf-8").read()
erros = []

cenarios = golden["cenarios"]
valores = [c.get("valor_agregado") for c in cenarios.values()]
if any(c.get("valor_agregado", "<ausente>") == "<ausente>" for c in cenarios.values()):
    erros.append("algum cenário está sem o campo valor_agregado")

distintos = len({json.dumps(v) for v in valores})
if distintos < 3:
    erros.append(f"apenas {distintos} valores agregados distintos entre os 4 cenários")

varios = cenarios["varios_comodos"]["valor_agregado"]
um = cenarios["um_comodo"]["valor_agregado"]
if not varios > um:
    erros.append(f"varios_comodos ({varios}) não é maior que um_comodo ({um})")

nula = cenarios["varios_comodos_com_metragem_nula"]
bruto = estado["imoveis"][nula["imovel_ref"]]["metragem_total"]
if type(nula["valor_agregado"]) is not type(bruto) or nula["valor_agregado"] != bruto:
    erros.append(
        "cenário com metragem nula: o golden não preservou o valor bruto do banco "
        f"(golden {nula['valor_agregado']!r}, banco {bruto!r})"
    )

# ---- divergência aritmética: observação específica, e nos DOIS sentidos ----
# A frase genérica não serve como prova: o manifesto descreve a convenção de
# metragem nula em toda captura, então procurá-la nunca poderia falhar. O que se
# exige aqui é a linha correlacionada — cenário + os dois números — e a AUSÊNCIA
# dela quando não há divergência. É o segundo sentido que impede o produtor de
# emitir a observação incondicionalmente e tornar o teste infalível de novo.
TAG_DIVERGENCIA = "DIVERGENCIA-METRAGEM"

secao = re.search(
    r"\n## 4\. Observações sobre o comportamento capturado\n(.*?)(?=\n## |\Z)",
    manifesto,
    re.DOTALL,
)
if not secao:
    erros.append("PROCEDENCIA.md: seção '## 4. Observações sobre o comportamento capturado' ausente")
    corpo_observacoes = ""
else:
    corpo_observacoes = secao.group(1)

linhas_divergencia = [
    linha for linha in corpo_observacoes.splitlines() if TAG_DIVERGENCIA in linha
]

divergentes = {}
for chave, cenario in sorted(cenarios.items()):
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

for chave, (agregado, soma) in divergentes.items():
    correlacionadas = [
        linha for linha in linhas_divergencia
        if chave in linha and str(agregado) in linha and str(soma) in linha
    ]
    if not correlacionadas:
        erros.append(
            f"cenário {chave} tem agregado {agregado!r} divergente da soma aritmética "
            f"dos cômodos não nulos ({soma}) e o PROCEDENCIA.md não traz observação "
            f"nomeando o cenário com os dois números"
        )

for linha in linhas_divergencia:
    if not any(chave in linha for chave in divergentes):
        erros.append(
            "PROCEDENCIA.md declara divergência de metragem sem divergência "
            f"correspondente em metragem.json: {linha.strip()!r}"
        )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "agregados distintos, ordem preservada e cenário degenerado gravado sem correção"
	else
		falhar "metragem.json não distingue os cenários ou corrigiu o degenerado (ver acima)"
	fi

	fechar_caso "CT-007"
}

# --------------------------------------------------------------------------- #
# CT-008 / CT-009 — as três rotinas de estado
# --------------------------------------------------------------------------- #
ct_008() {
	caso "CT-008" "Rotinas de estado — retorno E estado resultante, coerentes com o banco"

	if python3 - "${DIR_GOLDEN}" "${DIR_TRABALHO}/estado-site.json" <<'PY'
import json
import sys
from pathlib import Path

golden_dir = Path(sys.argv[1])
estado = json.load(open(sys.argv[2], encoding="utf-8"))
erros = []

MARCADOR = "<DATA_EXECUCAO>"

CONTRATOS_DE_RETORNO = {
    "marcar-cobrancas-vencidas.json": ["ok", "data_execucao", "total_atualizadas", "cobrancas"],
    "encerrar-contratos-vencidos.json": [
        "ok", "data_execucao", "total_candidatos", "total_encerrados",
        "total_ignorados", "resultados",
    ],
    "atualizar-atrasos-cobrancas.json": [
        "ok", "data_execucao", "multa_percentual", "juros_percentual",
        "total_candidatas", "total_atualizadas", "total_ignoradas", "resultados",
    ],
}

goldens = {}
for arquivo, chaves in CONTRATOS_DE_RETORNO.items():
    dados = json.load(open(golden_dir / arquivo, encoding="utf-8"))
    goldens[arquivo] = dados
    faltando = [c for c in chaves if c not in dados.get("retorno", {})]
    if faltando:
        erros.append(f"{arquivo}: chaves de retorno ausentes {faltando}")
    if "estado_resultante" not in dados:
        erros.append(f"{arquivo}: seção de estado resultante ausente")

# ---- marcar_cobrancas_vencidas ----
marcar = goldens["marcar-cobrancas-vencidas.json"]
retorno = marcar["retorno"]
if retorno.get("ok") is not True:
    erros.append("marcar: retorno.ok != true")
if retorno.get("total_atualizadas") != len(retorno.get("cobrancas", [])):
    erros.append(
        f"marcar: total_atualizadas {retorno.get('total_atualizadas')} != "
        f"len(cobrancas) {len(retorno.get('cobrancas', []))}"
    )
for nome in retorno.get("cobrancas", []):
    real = estado["cobrancas"].get(nome)
    if real is None:
        erros.append(f"marcar: cobrança {nome} ausente do site efêmero")
    elif real["status_cobranca"] != "Vencida":
        erros.append(f"marcar: {nome} está {real['status_cobranca']!r} no banco, esperado 'Vencida'")

fora_da_lista = [
    c for c in marcar["estado_resultante"]["cobrancas"]
    if c["name"] not in retorno.get("cobrancas", [])
]
if not any(c["status_cobranca"] == "Pendente" for c in fora_da_lista):
    erros.append(
        "marcar: nenhuma cobrança sintética fora da lista permaneceu 'Pendente' — "
        "a rotina pode ter marcado tudo"
    )
for item in marcar["estado_resultante"]["cobrancas"]:
    real = estado["cobrancas"].get(item["name"])
    if real is None:
        erros.append(f"marcar: {item['name']} ausente do banco")
    elif real["status_cobranca"] != item["status_cobranca"]:
        erros.append(
            f"marcar: {item['name']} golden {item['status_cobranca']!r} != "
            f"banco {real['status_cobranca']!r}"
        )

# ---- encerrar_contratos_vencidos ----
encerrar = goldens["encerrar-contratos-vencidos.json"]
retorno = encerrar["retorno"]
resultados = retorno.get("resultados", [])
if retorno.get("total_candidatos") != len(resultados):
    erros.append(
        f"encerrar: total_candidatos {retorno.get('total_candidatos')} != "
        f"len(resultados) {len(resultados)}"
    )
encerrados = [r for r in resultados if r.get("acao") == "encerrado"]
if retorno.get("total_encerrados") != len(encerrados):
    erros.append(
        f"encerrar: total_encerrados {retorno.get('total_encerrados')} != {len(encerrados)}"
    )
for resultado in encerrados:
    contrato = estado["contratos"].get(resultado["name"])
    imovel = estado["imoveis"].get(resultado["imovel"])
    if contrato is None or contrato["status_contrato"] != "Encerrado":
        erros.append(f"encerrar: contrato {resultado['name']} não está 'Encerrado' no banco")
    if imovel is None:
        erros.append(f"encerrar: imóvel {resultado['imovel']} ausente do banco")
    else:
        if imovel["status_locacao"] != "Disponível":
            erros.append(
                f"encerrar: imóvel {resultado['imovel']} está "
                f"{imovel['status_locacao']!r}, esperado 'Disponível'"
            )
        if imovel["contrato_ativo"] not in ("", None):
            erros.append(
                f"encerrar: imóvel {resultado['imovel']} manteve contrato_ativo "
                f"{imovel['contrato_ativo']!r}"
            )
for item in encerrar["estado_resultante"]["contratos"]:
    real = estado["contratos"].get(item["name"])
    if real is None:
        erros.append(f"encerrar: contrato {item['name']} ausente do banco")
    elif real["status_contrato"] != item["status_contrato"]:
        erros.append(
            f"encerrar: {item['name']} golden {item['status_contrato']!r} != "
            f"banco {real['status_contrato']!r}"
        )

# ---- atualizar_atrasos_cobrancas ----
atrasos = goldens["atualizar-atrasos-cobrancas.json"]
retorno = atrasos["retorno"]
resultados = retorno.get("resultados", [])
if retorno.get("total_candidatas") != len(resultados):
    erros.append(
        f"atrasos: total_candidatas {retorno.get('total_candidatas')} != {len(resultados)}"
    )
if retorno.get("total_atualizadas", 0) + retorno.get("total_ignoradas", 0) != retorno.get(
    "total_candidatas"
):
    erros.append("atrasos: atualizadas + ignoradas != candidatas")

por_nome = {c["name"]: c for c in atrasos["estado_resultante"]["cobrancas"]}
for resultado in [r for r in resultados if r.get("acao") == "atualizada"]:
    nome = resultado["name"]
    real = estado["cobrancas"].get(nome)
    if real is None:
        erros.append(f"atrasos: cobrança {nome} ausente do banco")
        continue
    for campo in ("valor_multa", "valor_juros", "valor_total"):
        if por_nome[nome][campo] != real[campo]:
            erros.append(
                f"atrasos: {nome}.{campo} golden {por_nome[nome][campo]} != banco {real[campo]}"
            )
        if resultado[campo] != real[campo]:
            erros.append(
                f"atrasos: {nome}.{campo} do retorno {resultado[campo]} != banco {real[campo]}"
            )
    if por_nome[nome]["data_ultima_atualizacao_atraso"] != MARCADOR:
        erros.append(
            f"atrasos: {nome}.data_ultima_atualizacao_atraso deveria estar normalizada "
            f"como {MARCADOR}, está {por_nome[nome]['data_ultima_atualizacao_atraso']!r}"
        )

# ---- ativação e cancelamento de contrato ----
# Entram aqui pela mesma razão dos três de cima: sem conferir o estado resultante
# contra o banco, um golden inventado — ou capturado de um caminho que não chegou
# a executar — passaria despercebido, e o oráculo da F3 seria ficção.


def data(valor):
    """Só a parte de calendário: golden e dump serializam a data por caminhos
    diferentes, e um deles pode trazer a hora zerada junto. O que se compara é o
    dia, não o formato de serialização."""
    return str(valor or "")[:10]


def conferir_imovel(rotulo, item):
    real = estado["imoveis"].get(item["name"])
    if real is None:
        erros.append(f"{rotulo}: imóvel {item['name']} ausente do banco")
        return
    if real["status_locacao"] != item["status_locacao"]:
        erros.append(
            f"{rotulo}: {item['name']}.status_locacao golden {item['status_locacao']!r} "
            f"!= banco {real['status_locacao']!r}"
        )
    if (real["contrato_ativo"] or "") != (item["contrato_ativo"] or ""):
        erros.append(
            f"{rotulo}: {item['name']}.contrato_ativo golden {item['contrato_ativo']!r} "
            f"!= banco {real['contrato_ativo']!r}"
        )


def conferir_contrato(rotulo, item, com_data_fim=False):
    real = estado["contratos"].get(item["name"])
    if real is None:
        erros.append(f"{rotulo}: contrato {item['name']} ausente do banco")
        return
    if real["status_contrato"] != item["status_contrato"]:
        erros.append(
            f"{rotulo}: {item['name']}.status_contrato golden {item['status_contrato']!r} "
            f"!= banco {real['status_contrato']!r}"
        )
    if com_data_fim and data(real["data_fim_locacao"]) != data(item.get("data_fim_locacao")):
        erros.append(
            f"{rotulo}: {item['name']}.data_fim_locacao golden "
            f"{data(item.get('data_fim_locacao'))!r} != banco {data(real['data_fim_locacao'])!r}"
        )


ativacao = json.load(open(golden_dir / "contrato-ativacao.json", encoding="utf-8"))
fluxo = ativacao["estado_resultante"]["fluxo"]
if not fluxo:
    erros.append("ativação: nenhum cenário de fluxo persistido no golden")
for item in fluxo:
    conferir_imovel("ativação", item["imovel"])
    conferir_contrato("ativação", item["contrato"], com_data_fim=True)

# A guarda de imóvel já ocupado tem de ter recusado: se ela tivesse passado, o
# imóvel apareceria apontando para o contrato novo, e o efeito seria silencioso.
por_cenario = {item["id"]: item for item in fluxo}
ocupado = por_cenario.get("imovel_com_outro_contrato")
if ocupado is None:
    erros.append("ativação: cenário 'imovel_com_outro_contrato' ausente do golden")
else:
    retorno_ocupado = next(
        (r for r in ativacao["retorno"]["fluxo"] if r["id"] == "imovel_com_outro_contrato"),
        {},
    )
    if retorno_ocupado.get("ativar_imovel_contrato", {}).get("aceito"):
        erros.append("ativação: imóvel já ocupado foi aceito por ativar_imovel_contrato")
    if ocupado["contrato"]["status_contrato"] == "Ativo":
        erros.append(
            "ativação: o contrato do imóvel ocupado ficou 'Ativo' apesar da recusa"
        )

cancelamento = json.load(open(golden_dir / "contrato-cancelamento.json", encoding="utf-8"))
for item in cancelamento["estado_resultante"]["contratos"]:
    conferir_contrato("cancelamento", item)
for item in cancelamento["estado_resultante"]["imoveis"]:
    conferir_imovel("cancelamento", item)
for item in cancelamento["estado_resultante"]["cobrancas"]:
    real = estado["cobrancas"].get(item["name"])
    if real is None:
        erros.append(f"cancelamento: cobrança {item['name']} ausente do banco")
    elif real["status_cobranca"] != item["status_cobranca"]:
        erros.append(
            f"cancelamento: {item['name']} golden {item['status_cobranca']!r} != "
            f"banco {real['status_cobranca']!r}"
        )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "as 3 rotinas e as 2 regras de contrato gravam retorno e estado, e o estado bate com o banco"
	else
		falhar "golden das rotinas ou das regras de contrato divergiu do site efêmero (ver acima)"
	fi

	fechar_caso "CT-008"
}

ct_009() {
	caso "CT-009" "Caminhos ignorados — contrato_sem_imovel e vencimento_futuro sem efeito"

	if python3 - "${DIR_GOLDEN}" "${DIR_TRABALHO}/estado-site.json" <<'PY'
import json
import sys
from pathlib import Path

golden_dir = Path(sys.argv[1])
estado = json.load(open(sys.argv[2], encoding="utf-8"))
erros = []

encerrar = json.load(open(golden_dir / "encerrar-contratos-vencidos.json", encoding="utf-8"))
retorno = encerrar["retorno"]

ignorados = [r for r in retorno["resultados"] if r.get("acao") == "ignorado"]
if retorno.get("total_ignorados", 0) < 1:
    erros.append("encerrar: total_ignorados < 1")

sem_imovel = [r for r in ignorados if r.get("motivo") == "contrato_sem_imovel"]
if not sem_imovel:
    erros.append("encerrar: nenhum resultado com motivo 'contrato_sem_imovel'")
for resultado in sem_imovel:
    if "name" not in resultado:
        erros.append("encerrar: resultado ignorado sem o campo 'name' do contrato")
        continue
    real = estado["contratos"].get(resultado["name"])
    if real is None:
        erros.append(f"encerrar: contrato {resultado['name']} ausente do banco")
    elif real["status_contrato"] != "Ativo":
        erros.append(
            f"encerrar: contrato ignorado {resultado['name']} está "
            f"{real['status_contrato']!r}, deveria seguir 'Ativo'"
        )

if retorno.get("total_encerrados", 0) < 1:
    erros.append("encerrar: o golden não cobre nenhum caminho 'encerrado'")

# Nenhum imóvel pode ter sido liberado por causa de um contrato ignorado.
imoveis_de_encerrados = {
    r["imovel"] for r in retorno["resultados"] if r.get("acao") == "encerrado"
}
for item in encerrar["estado_resultante"]["imoveis"]:
    if item["name"] in imoveis_de_encerrados:
        continue
    if item["status_locacao"] != "Locado" or not item["contrato_ativo"]:
        erros.append(
            f"encerrar: imóvel {item['name']} foi liberado sem ter contrato encerrado "
            f"(status {item['status_locacao']!r}, contrato_ativo {item['contrato_ativo']!r})"
        )

atrasos = json.load(open(golden_dir / "atualizar-atrasos-cobrancas.json", encoding="utf-8"))
futuras = [
    r for r in atrasos["retorno"]["resultados"]
    if r.get("acao") == "ignorada" and r.get("motivo") == "vencimento_futuro"
]
if not futuras:
    erros.append("atrasos: nenhum resultado com motivo 'vencimento_futuro'")

entrada = {c["name"]: c for c in atrasos["entrada"]["cobrancas"]}
resultante = {c["name"]: c for c in atrasos["estado_resultante"]["cobrancas"]}
for resultado in futuras:
    nome = resultado["name"]
    antes, depois = entrada[nome], resultante[nome]
    real = estado["cobrancas"].get(nome)
    if real is None:
        erros.append(f"atrasos: cobrança {nome} ausente do banco")
        continue
    for campo in ("valor_multa", "valor_juros"):
        if depois[campo] != antes[campo] or real[campo] != antes[campo]:
            erros.append(
                f"atrasos: {nome}.{campo} mudou no caminho ignorado — antes {antes[campo]}, "
                f"golden {depois[campo]}, banco {real[campo]}"
            )
    if depois["data_ultima_atualizacao_atraso"] is not None:
        erros.append(
            f"atrasos: {nome} recebeu data_ultima_atualizacao_atraso "
            f"({depois['data_ultima_atualizacao_atraso']!r}) mesmo tendo sido ignorada"
        )
    if real["data_ultima_atualizacao_atraso"] not in (None, "", "None"):
        erros.append(
            f"atrasos: {nome} tem data_ultima_atualizacao_atraso preenchida no banco "
            f"({real['data_ultima_atualizacao_atraso']!r})"
        )

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "contrato_sem_imovel e vencimento_futuro cobertos, com as entidades intactas"
	else
		falhar "os caminhos ignorados não estão cobertos ou tiveram efeito (ver acima)"
	fi

	fechar_caso "CT-009"
}

# --------------------------------------------------------------------------- #
# CT-004 — determinismo da re-execução no MESMO site
# --------------------------------------------------------------------------- #
ct_004() {
	caso "CT-004" "Determinismo — segunda execução no mesmo site produz golden idênticos"

	local antes depois
	antes="$(sha_dos_golden)"

	executar_capturar "ct004"
	afirmar_igual "segunda execução de capturar.py termina com exit 0" "0" "${ultimo_codigo}"

	depois="$(sha_dos_golden)"
	local diferentes
	diferentes="$(diff <(printf '%s\n' "${antes}") <(printf '%s\n' "${depois}") |
		grep -E '^[<>]' | grep -vE 'PROCEDENCIA\.md' | grep -c . || true)"
	afirmar_igual "os ${#GOLDEN_DE_CARACTERIZACAO[@]} artefatos golden têm sha256 idêntico ao da primeira execução" \
		"0" "${diferentes}"

	local sujos caminhos_versionados=()
	local nome
	for nome in "${GOLDEN_DE_CARACTERIZACAO[@]}"; do
		caminhos_versionados+=("${REL_GOLDEN}/${nome}")
	done
	sujos="$(git -C "${RAIZ_REPO}" status --porcelain -- "${caminhos_versionados[@]}" |
		grep -cE '^.[^ ]' || true)"
	afirmar_igual "nenhum dos ${#GOLDEN_DE_CARACTERIZACAO[@]} artefatos aparece modificado em relação ao índice do git" \
		"0" "${sujos}"

	fechar_caso "CT-004"
}

# --------------------------------------------------------------------------- #
# CT-005 — offsets relativos: relógio deslocado não altera os golden de rotina
# --------------------------------------------------------------------------- #
ct_005() {
	caso "CT-005" "Offsets relativos — relógio deslocado em +${DIAS_DESLOCAMENTO_RELOGIO} dias não muda os golden"

	local golden_rotinas=(
		"marcar-cobrancas-vencidas.json"
		"encerrar-contratos-vencidos.json"
		"atualizar-atrasos-cobrancas.json"
	)

	local antes
	antes="$(cd "${DIR_GOLDEN}" && sha256sum "${golden_rotinas[@]}")"
	local data_referencia
	data_referencia="$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T' "${DIR_GOLDEN}/PROCEDENCIA.md" |
		head -1 | tr -d 'T')"

	# CAUSA-RAIZ da versão anterior: o deslocamento era gravado como
	# `sitecustomize.py` no `site-packages` do interpretador do bench. Aquele
	# arquivo é importado pelo `site.py` na inicialização de QUALQUER processo
	# Python do container `backend` — que é o mesmo `frappe-backend-1` onde o cron
	# do host executa `bench --site <produção> ...` a cada minuto. O relógio
	# envenenado alcançava produção; foi ausência de dano por horário, não por
	# desenho (ADR-0006 e guardrail §7.2).
	#
	# Agora a interposição é de PROCESSO: o shim vive num diretório temporário do
	# container, inerte até alguém colocá-lo em PYTHONPATH, e o PYTHONPATH é
	# acrescentado apenas ao `compose exec` que ESTA invocação de `capturar.py`
	# dispara — por um `docker` homônimo posto à frente do PATH só aqui. Nenhum
	# outro processo do container é afetado, e `capturar.py` continua sem saber que
	# a data mudou (Iron Law #6: nenhum parâmetro de data foi acrescentado a ele).
	local site_packages listagem_antes listagem_depois
	site_packages="$(no_container "env/bin/python -c \"import site;print(site.getsitepackages()[0])\"" |
		tr -d '\r\n' || true)"
	if [[ -z "${site_packages}" ]]; then
		falhar "não foi possível localizar o site-packages do interpretador do bench"
		fechar_caso "CT-005"
		return
	fi
	listagem_antes="$(no_container "ls -1A '${site_packages}' | sort" || true)"

	local pythonpath_container="${DIR_SHIM_NO_CONTAINER}:/home/frappe/frappe-bench/apps/locacao_automation"

	compose exec -T "${SERVICO}" bash -c \
		"mkdir -p '${DIR_SHIM_NO_CONTAINER}' && cat > '${DIR_SHIM_NO_CONTAINER}/sitecustomize.py'" <<PY
import datetime as _dt

_OFFSET = _dt.timedelta(days=${DIAS_DESLOCAMENTO_RELOGIO})
_datetime_real = _dt.datetime
_date_real = _dt.date


class _MetaDatetime(type):
    def __instancecheck__(cls, obj):
        return isinstance(obj, _datetime_real)

    def __subclasscheck__(cls, sub):
        return issubclass(sub, _datetime_real)


class _DatetimeDeslocado(_datetime_real, metaclass=_MetaDatetime):
    @classmethod
    def now(cls, tz=None):
        return _datetime_real.now(tz) + _OFFSET

    @classmethod
    def utcnow(cls):
        return _datetime_real.utcnow() + _OFFSET

    @classmethod
    def today(cls):
        return _datetime_real.today() + _OFFSET


class _MetaDate(type):
    def __instancecheck__(cls, obj):
        return isinstance(obj, _date_real)

    def __subclasscheck__(cls, sub):
        return issubclass(sub, _date_real)


class _DateDeslocada(_date_real, metaclass=_MetaDate):
    @classmethod
    def today(cls):
        return _date_real.today() + _OFFSET


_dt.datetime = _DatetimeDeslocado
_dt.date = _DateDeslocada
PY
	shim_instalado=1

	mkdir -p "${DIR_TRABALHO}/bin"
	cat >"${DIR_TRABALHO}/bin/docker" <<WRAPPER
#!/usr/bin/env bash
# Interposição de fronteira do CT-005: acrescenta PYTHONPATH ao \`compose exec\`
# desta invocação da captura, e só a ela. Vive fora do repositório.
argumentos=()
injetado=0
for argumento in "\$@"; do
	argumentos+=("\${argumento}")
	if [[ "\${injetado}" -eq 0 && "\${argumento}" == "exec" ]]; then
		argumentos+=(-e "PYTHONPATH=${pythonpath_container}")
		injetado=1
	fi
done
exec /usr/bin/docker "\${argumentos[@]}"
WRAPPER
	chmod +x "${DIR_TRABALHO}/bin/docker"

	executar_capturar_com_relogio_deslocado "ct005"
	local codigo_deslocado="${ultimo_codigo}"

	compose exec -T "${SERVICO}" rm -rf "${DIR_SHIM_NO_CONTAINER}"
	shim_instalado=0
	rm -rf "${DIR_TRABALHO}/bin"

	# Guarda de regressão do achado CRÍTICO: o interpretador compartilhado tem de
	# sair do caso exatamente como entrou.
	listagem_depois="$(no_container "ls -1A '${site_packages}' | sort" || true)"
	afirmar_igual "o site-packages do interpretador do bench saiu intocado" \
		"${listagem_antes}" "${listagem_depois}"
	afirmar_igual "nenhum sitecustomize.py foi criado no site-packages do bench" "0" \
		"$(no_container "ls -1A '${site_packages}' | grep -c '^sitecustomize' || true" | tr -d '\r\n')"
	afirmar_igual "o diretório temporário do shim não sobreviveu ao caso" "1" \
		"$(no_container "test -d '${DIR_SHIM_NO_CONTAINER}'; echo \$?" | tr -d '\r\n')"

	afirmar_igual "capturar.py com o relógio deslocado termina com exit 0" "0" "${codigo_deslocado}"

	# Guarda anti-tautologia: sem esta conferência, o caso passaria de graça se o
	# deslocamento não tivesse surtido efeito algum.
	local data_deslocada esperada
	data_deslocada="$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T' "${DIR_GOLDEN}/PROCEDENCIA.md" |
		head -1 | tr -d 'T')"
	esperada="$(date -u -d "${data_referencia} +${DIAS_DESLOCAMENTO_RELOGIO} days" +%Y-%m-%d)"
	afirmar_igual "o relógio percebido pela captura de fato andou ${DIAS_DESLOCAMENTO_RELOGIO} dias" \
		"${esperada}" "${data_deslocada}"

	local nome
	if (cd "${DIR_GOLDEN}" && printf '%s\n' "${antes}" | sha256sum -c --status); then
		ok "os 3 golden de rotina têm sha256 idêntico ao da captura de referência"
	else
		falhar "os golden de rotina mudaram com o relógio deslocado — há data absoluta gravada"
	fi

	for nome in "${golden_rotinas[@]}"; do
		afirmar_igual "sem data absoluta em ${nome}" "0" \
			"$(grep -cE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "${DIR_GOLDEN}/${nome}" || true)"
	done

	if grep -q '"vencimento_offset_dias"' "${DIR_GOLDEN}/marcar-cobrancas-vencidas.json" &&
		grep -q '"data_fim_locacao_offset_dias"' "${DIR_GOLDEN}/encerrar-contratos-vencidos.json" &&
		grep -q '"data_execucao": "<DATA_EXECUCAO>"' "${DIR_GOLDEN}/atualizar-atrasos-cobrancas.json"; then
		ok "datas gravadas como offset inteiro e data de execução como marcador estável"
	else
		falhar "os golden de rotina não usam offsets inteiros / marcador de data de execução"
	fi

	fechar_caso "CT-005"
}

# --------------------------------------------------------------------------- #
# CT-001 — gate de sanidade
# --------------------------------------------------------------------------- #
alternar_server_script() { # alternar_server_script <nome> <0|1>
	bench_no_site_efemero \
		"execute frappe.client.set_value --kwargs \"{'doctype':'Server Script','name':'$1','fieldname':'disabled','value':$2}\"" \
		>/dev/null
}

renomear_server_script() { # renomear_server_script <de> <para>
	bench_no_site_efemero \
		"execute frappe.rename_doc --kwargs \"{'doctype':'Server Script','old':'$1','new':'$2','force':True}\"" \
		>/dev/null
}

ct_001() {
	caso "CT-001" "Gate de sanidade aborta a captura com os Server Scripts inativos"

	local nome_metragem="Cálculo metragem imóvel"
	local nome_pdf="PDF contrato"
	local nome_pdf_temporario="PDF contrato AUSENTE TEMP"

	# (a) estado saudável — a captura precisa passar, senão as demais linhas não
	# provam nada (uma captura que nunca funciona "aborta" sempre).
	executar_capturar "ct001-a"
	afirmar_igual "(a) estado saudável: capturar.py termina com exit 0" "0" "${ultimo_codigo}"
	# O manifesto entra na contagem; os demais são os artefatos de caracterização.
	afirmar_igual "(a) os $((${#GOLDEN_DE_CARACTERIZACAO[@]} + 1)) artefatos estão gravados" \
		"$((${#GOLDEN_DE_CARACTERIZACAO[@]} + 1))" \
		"$(ls -1 "${DIR_GOLDEN}" | grep -c . || true)"

	local sha_antes sha_caracterizacao_antes git_antes
	sha_antes="$(sha_dos_golden)"
	sha_caracterizacao_antes="$(sha_dos_golden_de_caracterizacao)"
	git_antes="$(estado_git_dos_golden)"

	verificar_linha_reprovada() { # verificar_linha_reprovada <rotulo> <agulha1> <agulha2>
		local rotulo="$1"
		afirmar_igual "(${rotulo}) capturar.py termina com exit 2" "2" "${ultimo_codigo}"
		afirmar_contem "(${rotulo}) stderr nomeia o alvo" \
			"${DIR_TRABALHO}/capturar-${rotulo}.err" "$2"
		afirmar_contem "(${rotulo}) stderr nomeia a condição violada" \
			"${DIR_TRABALHO}/capturar-${rotulo}.err" "$3"
		afirmar_igual "(${rotulo}) nenhum arquivo de golden/ foi criado ou alterado" \
			"${sha_antes}" "$(sha_dos_golden)"
		afirmar_igual "(${rotulo}) git não registra alteração nova em golden/" \
			"${git_antes}" "$(estado_git_dos_golden)"
	}

	# (b) regra de metragem desabilitada
	alternar_server_script "${nome_metragem}" 1
	executar_capturar "ct001-b"
	alternar_server_script "${nome_metragem}" 0
	verificar_linha_reprovada "ct001-b" "${nome_metragem}" "disabled=1"

	# (c) regra do documento de contrato ausente
	renomear_server_script "${nome_pdf}" "${nome_pdf_temporario}"
	executar_capturar "ct001-c"
	renomear_server_script "${nome_pdf_temporario}" "${nome_pdf}"
	verificar_linha_reprovada "ct001-c" "${nome_pdf}" "ausente"

	# (d) execução de Server Script desligada no site efêmero
	bench_no_site_efemero "set-config server_script_enabled 0" >/dev/null
	executar_capturar "ct001-d"
	bench_no_site_efemero "set-config server_script_enabled 1" >/dev/null
	verificar_linha_reprovada "ct001-d" "server_script_enabled" "desligado"

	# Estado restaurado: a captura volta a passar e deixa os golden definitivos.
	executar_capturar "ct001-final"
	afirmar_igual "estado do site restaurado: capturar.py volta a terminar com exit 0" \
		"0" "${ultimo_codigo}"
	afirmar_igual "os ${#GOLDEN_DE_CARACTERIZACAO[@]} golden definitivos são idênticos aos da linha (a)" \
		"${sha_caracterizacao_antes}" "$(sha_dos_golden_de_caracterizacao)"

	fechar_caso "CT-001"
}

# --------------------------------------------------------------------------- #
# CT-002 — idempotência de `criar`
# --------------------------------------------------------------------------- #
ct_002() {
	caso "CT-002" "preparar-site-efemero.sh criar é idempotente"

	executar_preparar destruir "ct002-precondicao"

	executar_preparar criar "ct002-1"
	afirmar_igual "primeira execução de 'criar' termina com exit 0" "0" "${ultimo_codigo}"

	executar_preparar criar "ct002-2"
	afirmar_igual "segunda execução consecutiva de 'criar' termina com exit 0" "0" "${ultimo_codigo}"

	afirmar_igual "existe exatamente um site ${SITE_EFEMERO}" "1" "$(contar_sites_efemeros)"

	afirmar_igual "nenhum diretório residual .old/.bak/.tmp em sites/" "0" \
		"$(no_container "ls -1 sites/ | grep -cE '^${SITE_EFEMERO}\\.(old|bak|tmp)\$' || true" | tr -d '\r\n')"

	set +e
	bench_no_site_efemero "execute frappe.db.get_default --kwargs \"{'key':'country'}\"" >/dev/null 2>&1
	local codigo_execute=$?
	set -e
	afirmar_igual "o site recriado responde a uma consulta pelo bench" "0" "${codigo_execute}"

	afirmar_igual "o diretório do site de produção continua presente" "1" \
		"$(no_container "ls -1 sites/ | grep -c '^${site_producao}\$' || true" | tr -d '\r\n')"

	local contratos
	contratos="$(consultar_banco_de_producao 'SELECT COUNT(*) FROM tabContrato;' | tr -d '\r\n')"
	if [[ "${contratos}" =~ ^[0-9]+$ ]]; then
		ok "o banco que atende a operação segue respondendo (${contratos} contratos)"
	else
		falhar "o banco que atende a operação não respondeu à contagem de contratos"
	fi

	fechar_caso "CT-002"
}

# --------------------------------------------------------------------------- #
# CT-003 — teardown garantido, mesmo com a captura falhando
# --------------------------------------------------------------------------- #
ct_003() {
	caso "CT-003" "Teardown garantido e idempotente, com a captura falhando no meio"

	local espaco_antes espaco_depois
	espaco_antes="$(df --output=avail -k / | tail -1 | tr -d ' ')"

	# A sequência da §8 roda como UM comando composto — do jeito que o operador a
	# executa — e o que se afere é o status DELE. Ler o status de cada invocação
	# separadamente e recombiná-los no teste não observa nada do SUT: o valor
	# recombinado é do próprio teste, e um teardown que devolvesse 0 no lugar da
	# falha da captura passaria despercebido.
	#
	# A falha é induzida pelo ESTADO REAL do banco (mesma receita do CT-001);
	# nenhuma flag de simulação existe nos scripts. O andaime abaixo vive fora do
	# repositório (diretório temporário) e não é artefato versionado.
	cat >"${DIR_TRABALHO}/desabilitar-regra.sh" <<DESABILITAR
#!/usr/bin/env bash
set -euo pipefail
docker compose --project-directory '${DIR_FRAPPE}' \
	-f '${ARQ_COMPOSE}' -f '${ARQ_COMPOSE_OVERRIDE}' \
	exec -T '${SERVICO}' bash -c "cd '${DIR_BENCH}' && bench --site '${SITE_EFEMERO}' execute frappe.client.set_value --kwargs \"{'doctype':'Server Script','name':'Cálculo metragem imóvel','fieldname':'disabled','value':1}\"" >/dev/null
DESABILITAR

	cat >"${DIR_TRABALHO}/fluxo-ct003.sh" <<'FLUXO'
#!/usr/bin/env bash
# Sequência da §8 como um único comando: criar -> capturar -> destruir. O teardown
# roda SEMPRE, e o status devolvido é o da captura.
preparar="$1"
capturar="$2"
desabilitar="$3"

bash "${preparar}" criar
codigo_criar=$?
echo "CRIAR_EXIT=${codigo_criar}"
[[ "${codigo_criar}" -eq 0 ]] || exit "${codigo_criar}"

bash "${desabilitar}"

python3 "${capturar}"
codigo_captura=$?
echo "CAPTURAR_EXIT=${codigo_captura}"

bash "${preparar}" destruir
echo "DESTRUIR_EXIT=$?"

exit "${codigo_captura}"
FLUXO

	set +e
	bash "${DIR_TRABALHO}/fluxo-ct003.sh" "${PREPARAR}" "${CAPTURAR}" \
		"${DIR_TRABALHO}/desabilitar-regra.sh" \
		>"${DIR_TRABALHO}/preparar-ct003-fluxo.out" 2>"${DIR_TRABALHO}/preparar-ct003-fluxo.err"
	local codigo_fluxo=$?
	set -e

	local saida_fluxo="${DIR_TRABALHO}/preparar-ct003-fluxo.out"
	afirmar_igual "o fluxo composto devolve o exit code do gate, não o do teardown" \
		"2" "${codigo_fluxo}"
	afirmar_contem "'criar' terminou com exit 0 dentro do fluxo" "${saida_fluxo}" "CRIAR_EXIT=0"
	afirmar_contem "a captura falhou pelo caminho real do gate" "${saida_fluxo}" "CAPTURAR_EXIT=2"
	afirmar_contem "o teardown terminou com exit 0 mesmo após a falha" \
		"${saida_fluxo}" "DESTRUIR_EXIT=0"

	afirmar_igual "o site efêmero deixou de existir" "0" "$(contar_sites_efemeros)"

	executar_preparar destruir "ct003-destruir-2"
	afirmar_igual "segunda chamada de 'destruir' termina com exit 0" "0" "${ultimo_codigo}"
	afirmar_contem "segunda chamada de 'destruir' informa que o site não existe" \
		"${DIR_TRABALHO}/preparar-ct003-destruir-2.out" "site inexistente"

	espaco_depois="$(df --output=avail -k / | tail -1 | tr -d ' ')"
	if [[ "${espaco_depois}" -ge "${espaco_antes}" ]]; then
		ok "o espaço em disco foi devolvido (${espaco_antes} kB -> ${espaco_depois} kB)"
	else
		falhar "o site efêmero deixou resíduo em disco (${espaco_antes} kB -> ${espaco_depois} kB)"
	fi

	# Só `preparar-site-efemero.sh` invoca drop-site; os demais arquivos citam o
	# subcomando em texto de verificação e poluiriam a conferência de alvo.
	local alvos_drop_site alvos_indevidos
	alvos_drop_site="$(grep -nE 'bench[[:space:]]+drop-site' "${DIR_SCRIPTS}/preparar-site-efemero.sh" | grep -c . || true)"
	if [[ "${alvos_drop_site}" -ge 1 ]]; then
		ok "o script de ciclo de vida invoca drop-site (${alvos_drop_site} ocorrência(s))"
	else
		falhar "nenhuma invocação de drop-site encontrada — a conferência de alvo seria vazia"
	fi
	alvos_indevidos="$(grep -nE 'bench[[:space:]]+drop-site' "${DIR_SCRIPTS}/preparar-site-efemero.sh" |
		grep -v 'SITE_EFEMERO' | grep -c . || true)"
	afirmar_igual "toda invocação de drop-site tem o site efêmero como alvo" "0" "${alvos_indevidos}"

	alvos_indevidos="$(grep -h 'drop-site' "${DIR_TRABALHO}"/*.out "${DIR_TRABALHO}"/*.err 2>/dev/null |
		grep -v "${SITE_EFEMERO}" | grep -c . || true)"
	afirmar_igual "nenhum drop-site sobre outro site nos logs do fluxo" "0" "${alvos_indevidos}"

	fechar_caso "CT-003"
}

# --------------------------------------------------------------------------- #
# CT-012 — ADR-0006: o site que atende a operação sai do fluxo sem escrita
# --------------------------------------------------------------------------- #
# Relógio do processo que CARIMBA `modified`. Não pode ser o `NOW()` do serviço de
# banco: aquele container roda em UTC, enquanto o Frappe grava `modified` em
# America/Sao_Paulo — a janela sairia 3h no futuro e a consulta nunca devolveria
# linha nenhuma, deixando a metade de dados deste caso vazia sem parecer vazia.
# É também o mesmo relógio que carimba os `run-*.log`, que é contra quem a
# atribuição é feita.
instante_do_ambiente() {
	compose exec -T "${SERVICO}" date '+%Y-%m-%d %H:%M:%S' | tr -d '\r\n'
}

medir_producao() { # medir_producao <rotulo>
	consultar_banco_de_producao \
		"SELECT 'Cobranca', COUNT(*), IFNULL(MAX(modified),'') FROM tabCobranca UNION ALL SELECT 'Contrato', COUNT(*), IFNULL(MAX(modified),'') FROM tabContrato UNION ALL SELECT 'Imovel', COUNT(*), IFNULL(MAX(modified),'') FROM tabImovel;" \
		>"${DIR_TRABALHO}/producao-$1.tsv"
}

ct_012() {
	caso "CT-012" "ADR-0006 — o site que atende a operação sai do fluxo sem uma escrita"

	medir_producao "depois"

	# SUT_IS_CORRECT_BECAUSE: comparar `max(modified)` de forma seca reprova este
	# fluxo por atividade de terceiro. O ambiente que atende a operação tem rotinas
	# agendadas próprias, disparadas pelo cron do sistema (`/opt/frappe/run-*.sh`,
	# registradas em `/opt/frappe/run-*.log`) — uma delas roda A CADA MINUTO — e
	# elas escrevem em `Cobranca` e `Contrato` durante toda a janela do fluxo.
	#
	# O SUT, por sua vez, escreve das TRÊS formas: `capturar.py` apaga
	# (`DELETE FROM tab...` em 9 tabelas), insere os documentos sintéticos e
	# ATUALIZA linhas existentes (`frappe.db.set_value`, e as três rotinas legadas
	# que ele dispara). UPDATE não aparece em contagem — é justamente o caminho pelo
	# qual uma escrita indireta (Server Script, hook, job) chegaria ao ambiente de
	# operação sem mudar nenhum total. Por isso a contagem sozinha não basta e
	# nenhum registro tocado pode virar aviso.
	#
	# O que substitui a comparação seca: toda linha tocada na janela [t0, t1] é
	# listada e precisa ser ATRIBUÍDA a uma execução agendada registrada em log —
	# pelo `name` que o log declara ter tocado, ou pela janela [inicio, fim] da
	# execução em que o `modified` da linha cai. Atribuição verificável, não
	# presumida. Linha tocada e não atribuída REPROVA, nomeando doctype e `name`.
	local instante_t1
	instante_t1="$(instante_do_ambiente)"

	local doctype antes_count antes_modificado depois_count depois_modificado
	while IFS=$'\t' read -r doctype antes_count antes_modificado; do
		[[ -n "${doctype}" ]] || continue
		depois_count="$(awk -F'\t' -v d="${doctype}" '$1==d{print $2}' "${DIR_TRABALHO}/producao-depois.tsv")"
		depois_modificado="$(awk -F'\t' -v d="${doctype}" '$1==d{print $3}' "${DIR_TRABALHO}/producao-depois.tsv")"
		afirmar_igual "contagem de ${doctype} inalterada no ambiente de operação" \
			"${antes_count}" "${depois_count}"
		[[ "${antes_modificado}" == "${depois_modificado}" ]] ||
			printf '    ..   %s teve max(modified) avançado (%s -> %s); atribuição abaixo\n' \
				"${doctype}" "${antes_modificado}" "${depois_modificado}"
	done <"${DIR_TRABALHO}/producao-antes.tsv"

	: >"${DIR_TRABALHO}/tocados.tsv"
	for doctype in Cobranca Contrato Imovel; do
		consultar_banco_de_producao \
			"SELECT '${doctype}', name, modified, modified_by FROM tab${doctype}
			 WHERE modified >= '${instante_t0}' AND modified <= '${instante_t1}';" \
			>>"${DIR_TRABALHO}/tocados.tsv"
	done

	cat >"${DIR_TRABALHO}/atribuir-escritas.py" <<'PY'
"""Atribui cada linha tocada na janela a uma execução agendada registrada em log.

Entradas: TSV de linhas tocadas (doctype, name, modified, modified_by), o par
[t0, t1] da janela e o diretório dos logs das rotinas do ambiente de operação.

Uma linha é atribuível quando o log de uma execução agendada da janela (a) declara
o `name` no seu payload, ou (b) tem janela de atividade contendo o `modified`.

Sobre (b): a janela de atividade vai do `inicio` até o `fim`, estendida por uma
FOLGA DE DRENO — o tempo em que o trabalho assíncrono disparado pela execução
ainda pode estar gravando. Não é folga arbitrária: a execução de 06:00:01 registra
`fim ok` em 06:00:05 e a integração bancária que ela dispara segue gravando até
06:00:23, carimbando `ultima_sincronizacao_sicoob_em` linha a linha; encerrar a
atribuição no `fim` reprovaria o fluxo por trabalho assíncrono de terceiro.

A folga é dimensionada pelo dreno observado (~22s), com teto de DRENO_MAXIMO_S e
limitada a metade da cadência do ambiente — nunca ao período da rotina. Folga
igual ao período faria as janelas ladrilharem a linha do tempo sem um único
intervalo, e a regra (b) deixaria de poder reprovar qualquer coisa. Com folga
menor que a cadência sobra, dentro de cada período, um trecho em que escrita sem
execução agendada em curso REPROVA — é ali que esta regra morde. O que ela não
cobre é UPDATE ocorrido dentro do dreno de uma execução legítima; esse é o preço
de conviver com uma rotina de produção que grava de forma assíncrona.

As demais asserções do CT-012 cobrem modos de falha DISTINTOS deste, e não o
substituem: a contagem estrita pega banco trocado e criação de documento (a
captura ABRE apagando as tabelas de negócio, então os totais colapsariam), a busca
por documento sintético pega vazamento de documento da captura, e a checagem de
banco distinto pega a configuração que tornaria a escrita possível. NENHUMA delas
enxerga UPDATE em linha pré-existente de produção — é exatamente por isso que a
folga precisa ficar abaixo da cadência.
"""
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

tocados, t0, t1, dir_logs = sys.argv[1], sys.argv[2], sys.argv[3], Path(sys.argv[4])

RE_MARCO = re.compile(r"^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+(inicio|fim)")
RE_NOME = re.compile(r'"name"\s*:\s*"([^"]+)"')
LEITURA_INICIAL = 2 * 1024 * 1024
LEITURA_MAXIMA = 64 * 1024 * 1024


def instante(texto):
    return datetime.strptime(texto.split(".")[0], "%Y-%m-%d %H:%M:%S")


inicio_janela, fim_janela = instante(t0), instante(t1)


def ler_cauda(caminho):
    """Lê da cauda para trás até cobrir o começo da janela.

    Os logs crescem sem rotação e uma cauda fixa cortaria execuções reais da
    janela — que é como uma escrita legítima vira "não atribuída".
    """
    tamanho_arquivo = caminho.stat().st_size
    limite = LEITURA_INICIAL
    while True:
        with caminho.open("rb") as fh:
            fh.seek(max(0, tamanho_arquivo - limite))
            linhas = fh.read().decode("utf-8", errors="replace").splitlines()
        primeiros = [
            instante(m.group(1))
            for m in (RE_MARCO.match(linha) for linha in linhas)
            if m and m.group(2) == "inicio"
        ]
        cobriu = bool(primeiros) and primeiros[0] <= inicio_janela
        if cobriu or limite >= tamanho_arquivo or limite >= LEITURA_MAXIMA:
            return linhas
        limite *= 4


execucoes, blocos_por_log = [], []
for log in sorted(dir_logs.glob("run-*.log")):
    linhas = ler_cauda(log)
    abertura, corpo, blocos = None, [], []
    for linha in linhas:
        marco = RE_MARCO.match(linha)
        if not marco:
            if abertura is not None:
                corpo.append(linha)
            continue
        momento, tipo = instante(marco.group(1)), marco.group(2)
        if tipo == "inicio":
            abertura, corpo = momento, []
        elif abertura is not None:
            blocos.append([abertura, momento, "\n".join(corpo)])
            abertura, corpo = None, []
    if abertura is not None and inicio_janela <= abertura <= fim_janela:
        blocos.append([abertura, fim_janela, "\n".join(corpo)])

    blocos_por_log.append((log.name, blocos))

# Cadência do ambiente: o período TÍPICO (mediana) da rotina mais frequente. A
# mediana, e não o mínimo, porque um intervalo curto isolado — um bloco cortado
# pela leitura da cauda, uma reexecução — encolheria a folga e reprovaria trabalho
# assíncrono legítimo. O teto impede que uma rotina diária alargue a atribuição.
CADENCIA_PADRAO_S = 60.0
CADENCIA_MAXIMA_S = 300.0

# Folga de dreno: quanto tempo o trabalho ASSÍNCRONO disparado por uma execução
# agendada ainda pode estar gravando depois do `fim ok`. Medido em produção: a
# execução de 06:00:01 fecha em 06:00:05 e a integração bancária segue gravando
# até 06:00:23 — ~22s. O dimensionamento é pelo DRENO OBSERVADO, nunca pelo
# período da rotina: folga igual à cadência faz as janelas ladrilharem a linha do
# tempo sem intervalo, e aí a regra (b) não pode mais falhar.
DRENO_MAXIMO_S = 30.0


def periodo_tipico(blocos):
    intervalos = sorted(
        (seguinte[0] - anterior[0]).total_seconds()
        for anterior, seguinte in zip(blocos, blocos[1:])
        if (seguinte[0] - anterior[0]).total_seconds() > 0
    )
    if not intervalos:
        return None
    return intervalos[len(intervalos) // 2]


periodos = [p for p in (periodo_tipico(b) for _n, b in blocos_por_log) if p]
cadencia = timedelta(
    seconds=min(min(periodos) if periodos else CADENCIA_PADRAO_S, CADENCIA_MAXIMA_S)
)
dreno = timedelta(seconds=min(DRENO_MAXIMO_S, cadencia.total_seconds() / 2))

# Sanidade da própria regra: com folga maior ou igual à cadência, as janelas de
# atribuição se encostam e cobrem todo instante — a asserção passaria a aprovar
# qualquer escrita, inclusive a que ela existe para pegar. Falha ruidosa em vez de
# aprovação silenciosa; é isto que impede a regressão de voltar numa mudança futura.
if dreno >= cadencia:
    print(
        f"folga de dreno ({dreno.total_seconds():.0f}s) alcançou a cadência do ambiente "
        f"({cadencia.total_seconds():.0f}s): as janelas de atribuição ladrilhariam a "
        "linha do tempo e a regra de atribuição temporal não poderia mais reprovar",
        file=sys.stderr,
    )
    sys.exit(1)

for nome_log, blocos in blocos_por_log:
    for abertura, fechamento, corpo in blocos:
        execucoes.append((nome_log, abertura, max(fechamento, abertura + dreno), corpo))

na_janela = [
    execucao for execucao in execucoes
    if execucao[1] <= fim_janela and execucao[2] >= inicio_janela
]
nomes_declarados = {}
for nome_log, abertura, fechamento, corpo in na_janela:
    for nome in RE_NOME.findall(corpo):
        nomes_declarados.setdefault(nome, nome_log)

# Guarda de não-vacuidade: uma das rotinas do ambiente roda a cada minuto, então
# qualquer janela deste fluxo (minutos) obrigatoriamente contém execução agendada.
# Zero execuções significa relógio fora de sincronia ou log ilegível — e uma janela
# assim aprovaria por não enxergar nada, que é o pior resultado possível aqui.
if not na_janela:
    print(
        f"nenhuma execução agendada encontrada na janela [{t0} .. {t1}] — a atribuição "
        "não tem contra o que ser feita (relógio fora de sincronia ou log ilegível)",
        file=sys.stderr,
    )
    sys.exit(1)

nao_atribuidas, atribuidas = [], []
with open(tocados, encoding="utf-8") as fh:
    for linha in fh:
        linha = linha.rstrip("\n")
        if not linha.strip():
            continue
        doctype, nome, modificado, autor = (linha.split("\t") + ["", "", "", ""])[:4]
        momento = instante(modificado)

        origem = nomes_declarados.get(nome)
        if origem is None:
            for nome_log, abertura, fechamento, _corpo in na_janela:
                if abertura <= momento <= fechamento:
                    origem = nome_log
                    break

        if origem is None:
            nao_atribuidas.append(f"{doctype}/{nome} modificado em {modificado} por {autor}")
        else:
            atribuidas.append(f"{doctype}/{nome} em {modificado} -> {origem}")

for item in atribuidas:
    print(f"    ..   escrita atribuída a rotina agendada: {item}")
for item in nao_atribuidas:
    print(
        "escrita NÃO atribuída a nenhuma execução agendada registrada em log: " + item,
        file=sys.stderr,
    )
print(f"    ..   linhas tocadas na janela: {len(atribuidas) + len(nao_atribuidas)}"
      f" · execuções agendadas na janela: {len(na_janela)}"
      f" · cadência observada: {int(cadencia.total_seconds())}s")
sys.exit(1 if nao_atribuidas else 0)
PY

	if python3 "${DIR_TRABALHO}/atribuir-escritas.py" "${DIR_TRABALHO}/tocados.tsv" \
		"${instante_t0}" "${instante_t1}" "${DIR_FRAPPE}"; then
		ok "toda escrita na janela é atribuível a rotina agendada do próprio ambiente"
	else
		falhar "há escrita no ambiente de operação sem execução agendada que a explique (acima)"
	fi

	local sinteticos
	sinteticos="$(consultar_banco_de_producao \
		"SELECT COUNT(*) FROM (SELECT name FROM tabCobranca WHERE name LIKE '%-CARACT-%'
		 UNION ALL SELECT name FROM tabContrato WHERE name LIKE '%-CARACT-%'
		 UNION ALL SELECT name FROM tabImovel WHERE name LIKE '%-CARACT-%') sinteticos;" |
		tr -d '\r\n')"
	afirmar_igual "nenhum documento sintético da caracterização alcançou o ambiente de operação" \
		"0" "${sinteticos}"

	# Detector direto do único modo pelo qual a captura poderia escrever no ambiente
	# de operação: o site efêmero apontar para o banco de produção. Não depende de
	# tempo, de log nem de cadência de rotina — e é justamente o cenário que a
	# contagem estrita e a busca por documento sintético cobrem no plano de dados.
	if [[ -z "${banco_efemero}" ]]; then
		falhar "não foi possível ler o banco do site efêmero na abertura do fluxo"
	elif [[ "${banco_efemero}" == "${base_producao}" ]]; then
		falhar "o site efêmero e o de produção compartilham o mesmo banco — a captura escreveria em produção"
	else
		ok "o site efêmero usa banco distinto do de produção"
	fi

	local invocacoes indevidas
	invocacoes="$(grep -rnE -- '--site[ =]+'"${site_producao}" "${DIR_SCRIPTS}" || true)"
	if [[ -z "${invocacoes}" ]]; then
		falhar "nenhuma invocação com --site apontando para a produção — o backup deveria existir"
	else
		indevidas="$(printf '%s\n' "${invocacoes}" | grep -v 'backup' | grep -c . || true)"
		afirmar_igual "toda invocação com --site de produção tem 'backup' como subcomando" \
			"0" "${indevidas}"
		indevidas="$(printf '%s\n' "${invocacoes}" |
			grep -cE '(new-site|restore|drop-site|set-config|set-value|execute|console)' || true)"
		afirmar_igual "nenhum subcomando destrutivo associado ao site de produção" "0" "${indevidas}"
	fi

	afirmar_igual "capturar.py não contém nenhum literal do site de produção" "0" \
		"$(grep -c "${site_producao}" "${CAPTURAR}" || true)"

	afirmar_contem "o log da captura registra o site efêmero como alvo" \
		"${DIR_TRABALHO}/capturar-ct001-final.out" "site: ${SITE_EFEMERO}"

	fechar_caso "CT-012"
}

# --------------------------------------------------------------------------- #
# CT-603 — a recaptura do fonte do Server Script `PDF contrato` é determinística,
#          e a extração não escreve no sistema que atende a operação.
#
# INVARIANTE: rodar `extrair-fonte-do-pdf.sh` duas vezes produz artefato byte a
# byte idêntico ao versionado — os três `sha256sum` são a mesma cadeia —, e os
# controles do legado (a contagem de `Server Script` e o `modified` do documento)
# são exatamente os mesmos antes e depois.
#
# POR QUE ESTE CASO EXISTE: o fonte da regra do documento só existe dentro do banco
# do Frappe, e a janela para trazê-lo fecha na virada (F7) sem reabrir. Determinismo
# é o que separa "o artefato foi capturado" de "o artefato pode ser reconferido
# contra a origem enquanto ela existir"; e a ausência de escrita é o que mantém a
# leitura dentro do que a ADR-0006 admite para o ambiente que atende a operação.
#
# ONDE ELE RODA, E POR QUÊ: antes do CT-012, de propósito. A janela [t0, t1] que
# aquele caso audita passa a conter a execução do extrator, de modo que uma escrita
# não atribuível vinda daqui reprova lá também. E antes do CT-013, cuja varredura
# alcança `*.out`/`*.err` do diretório de trabalho: as saídas do extrator entram no
# conjunto examinado, e o não-vazamento das credenciais passa a valer também para
# ele — que é um script que LÊ a credencial da base.
#
# O PREÇO DESSE LUGAR, declarado: este caso NÃO depende do site efêmero — ele lê o
# banco do site que atende a operação e grava em diretório temporário —, mas o
# `main` deste script exige o site efêmero de pé, então executá-lo exige
# `preparar-site-efemero.sh criar` como qualquer outro caso daqui. A dependência é
# do arquivo, não do caso, e paga-se por ela em troca de o CT-012 e o CT-013
# alcançarem o extrator. Mover o caso para o `verificar-golden.sh` sairia mais
# barato de rodar e tiraria a extração das duas varreduras — que é justamente o que
# se quer dela.
# --------------------------------------------------------------------------- #
EXTRAIR_FONTE_DO_PDF="${DIR_SCRIPTS}/extrair-fonte-do-pdf.sh"
ARQ_FONTE_DO_PDF="contrato-pdf-fonte.py"
DOCUMENTO_DO_PDF="PDF contrato"
DOCTYPE_DO_SERVER_SCRIPT="tabServer Script"

executar_extrator() { # executar_extrator <destino> <rotulo>
	local destino="$1" rotulo="$2"
	set +e
	bash "${EXTRAIR_FONTE_DO_PDF}" "${destino}" \
		>"${DIR_TRABALHO}/extrair-${rotulo}.out" \
		2>"${DIR_TRABALHO}/extrair-${rotulo}.err"
	ultimo_codigo=$?
	set -e
}

# Os dois controles numa consulta só, para que sejam lidos no mesmo instante: lidos
# em duas viagens, uma rotina agendada do próprio ambiente poderia correr entre elas
# e o par deixaria de descrever um estado único.
controles_do_legado() {
	consultar_banco_de_producao \
		"SELECT (SELECT COUNT(*) FROM \\\`${DOCTYPE_DO_SERVER_SCRIPT}\\\`), (SELECT modified FROM \\\`${DOCTYPE_DO_SERVER_SCRIPT}\\\` WHERE name='${DOCUMENTO_DO_PDF}');" |
		tr -d '\r'
}

ct_603() {
	caso "CT-603" "o fonte do Server Script recaptura idêntico e o legado sai sem uma escrita"

	local controles_antes controles_depois
	controles_antes="$(controles_do_legado)"

	local contagem_antes modificado_antes
	IFS=$'\t' read -r contagem_antes modificado_antes <<<"${controles_antes}"

	# Guarda de não-vacuidade: com o documento ausente, "idêntico antes e depois"
	# seria a comparação de dois vazios, e o caso aprovaria sem ter medido nada.
	afirmar_diferente "a contagem de Server Script do legado não é vazia" "" "${contagem_antes}"
	afirmar_diferente "o modified de '${DOCUMENTO_DO_PDF}' não é vazio" "" "${modificado_antes}"
	if [[ -z "${contagem_antes}" || -z "${modificado_antes}" ]]; then
		fechar_caso "CT-603"
		return
	fi

	local estado_git_antes estado_git_depois
	estado_git_antes="$(estado_git_dos_golden)"

	executar_extrator "${DIR_TRABALHO}/fonte-um.py" "um"
	afirmar_igual "a primeira recaptura termina com sucesso" "0" "${ultimo_codigo}"
	executar_extrator "${DIR_TRABALHO}/fonte-dois.py" "dois"
	afirmar_igual "a segunda recaptura termina com sucesso" "0" "${ultimo_codigo}"

	local sha_versionado sha_um sha_dois
	sha_versionado="$(sha256sum "${DIR_GOLDEN}/${ARQ_FONTE_DO_PDF}" | cut -d' ' -f1)"
	sha_um="$(sha256sum "${DIR_TRABALHO}/fonte-um.py" 2>/dev/null | cut -d' ' -f1)"
	sha_dois="$(sha256sum "${DIR_TRABALHO}/fonte-dois.py" 2>/dev/null | cut -d' ' -f1)"

	afirmar_igual "a primeira recaptura é byte a byte o artefato versionado" \
		"${sha_versionado}" "${sha_um}"
	afirmar_igual "a segunda recaptura é byte a byte o artefato versionado" \
		"${sha_versionado}" "${sha_dois}"
	# Esta terceira asserção não reprova sozinha — quando ela cai, ao menos uma das
	# duas acima já caiu. O que ela acrescenta é DISCRIMINAR A CAUSA: com as duas
	# primeiras vermelhas e esta verde, as recapturas concordam entre si e quem está
	# defasado é o oráculo versionado; com esta vermelha, a extração deixou de ser
	# determinística. Sem ela, os dois defeitos produziriam a mesma tela.
	afirmar_igual "as duas recapturas são idênticas entre si" "${sha_um}" "${sha_dois}"

	controles_depois="$(controles_do_legado)"
	local contagem_depois modificado_depois
	IFS=$'\t' read -r contagem_depois modificado_depois <<<"${controles_depois}"
	afirmar_igual "a contagem de Server Script do legado é a mesma depois da extração" \
		"${contagem_antes}" "${contagem_depois}"
	afirmar_igual "o modified de '${DOCUMENTO_DO_PDF}' é o mesmo depois da extração" \
		"${modificado_antes}" "${modificado_depois}"

	# Recaptura para conferência não pode reescrever o oráculo: o `mv` do extrator
	# só alcança o destino informado, e a árvore versionada tem de sair intocada.
	estado_git_depois="$(estado_git_dos_golden)"
	afirmar_igual "a recaptura em destino temporário não altera a árvore versionada" \
		"${estado_git_antes}" "${estado_git_depois}"

	# ---- legado indisponível: aviso explícito e saída não-zero, nunca verde ----
	# A indisponibilidade é produzida na FRONTEIRA, como no CT-005: um `docker` de
	# mesmo nome, antes no PATH, que não responde. Nada do ambiente legado é parado
	# — derrubar um serviço para provar uma degradação seria destrutivo no site que
	# atende a operação.
	mkdir -p "${DIR_TRABALHO}/bin-legado-mudo"
	printf '#!/usr/bin/env bash\nexit 1\n' >"${DIR_TRABALHO}/bin-legado-mudo/docker"
	chmod +x "${DIR_TRABALHO}/bin-legado-mudo/docker"

	set +e
	PATH="${DIR_TRABALHO}/bin-legado-mudo:${PATH}" bash "${EXTRAIR_FONTE_DO_PDF}" \
		"${DIR_TRABALHO}/fonte-nunca-gravado.py" \
		>"${DIR_TRABALHO}/extrair-mudo.out" \
		2>"${DIR_TRABALHO}/extrair-mudo.err"
	ultimo_codigo=$?
	set -e

	afirmar_igual "legado indisponível encerra com o código de indisponibilidade" \
		"3" "${ultimo_codigo}"
	afirmar_igual "legado indisponível emite AVISO nomeando o serviço que não respondeu" \
		"1" "$(grep -c 'AVISO: o serviço .* do ambiente legado não está de pé' \
			"${DIR_TRABALHO}/extrair-mudo.err" || true)"
	afirmar_igual "legado indisponível não grava artefato nenhum" \
		"0" "$(ls -1 "${DIR_TRABALHO}/fonte-nunca-gravado.py" 2>/dev/null | grep -c . || true)"

	fechar_caso "CT-603"
}

# --------------------------------------------------------------------------- #
# CT-013 (metade de logs) — a credencial não vaza para a saída dos scripts
# --------------------------------------------------------------------------- #
ct_013_logs() {
	caso "CT-013" "MYSQL_ROOT_PASSWORD não vaza para a saída dos scripts (metade de logs)"

	local varredura
	varredura="${DIR_TRABALHO}/varrer-logs.py"
	cat >"${varredura}" <<'PY'
"""Procura as credenciais nos logs dos scripts. Recebe UMA POR LINHA em stdin; nunca as imprime.

São duas desde que `consultar_banco_de_producao` deixou de autenticar como `root`: a do
usuário da base, que é a que o caminho de SELECT usa hoje, e a root, que segue viva em
`preparar-site-efemero.sh`. Varrer só uma delas provaria o vazamento da credencial errada —
e a que importa mais é justamente a nova, porque é a que atravessa mais pontos.
"""
import re
import sys
from pathlib import Path

diretorio = Path(sys.argv[1])
agulhas = [linha.rstrip("\n") for linha in sys.stdin]
# Vazia entre as recebidas ABORTA, e não é descartada: filtrar em silêncio faria a varredura
# rodar com as agulhas restantes e anunciar ter conferido TODAS as credenciais — aprovando a
# prova de segurança sobre uma que nunca foi lida. É a propriedade que a versão de uma agulha
# tinha, generalizada para N.
if not agulhas or any(not agulha for agulha in agulhas):
    print("credencial vazia ou ausente entre as recebidas — varredura inconclusiva", file=sys.stderr)
    sys.exit(2)

padroes = [
    re.compile(r"(?:^|[^A-Za-z0-9_-])" + re.escape(agulha) + r"(?:[^A-Za-z0-9_-]|$)")
    for agulha in agulhas
]

ocorrencias = []
examinados = 0
for arquivo in sorted(diretorio.glob("*.out")) + sorted(diretorio.glob("*.err")):
    examinados += 1
    for numero, linha in enumerate(arquivo.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if any(padrao.search(linha) for padrao in padroes):
            ocorrencias.append(f"{arquivo.name}:{numero}")

if examinados == 0:
    print("nenhum log capturado — varredura inconclusiva", file=sys.stderr)
    sys.exit(2)

for ocorrencia in ocorrencias:
    print(f"credencial ecoada em {ocorrencia}", file=sys.stderr)
print(f"logs examinados: {examinados}")
sys.exit(1 if ocorrencias else 0)
PY

	# AS DUAS credenciais, uma por linha: a do usuário da base (que `consultar_banco_de_producao`
	# usa) e a root (que `preparar-site-efemero.sh` ainda exige). Varrer só a root deixaria a
	# credencial efetivamente em uso pelo caminho de consulta sem prova de não-vazamento.
	if printf '%s\n%s\n' "${senha_producao}" "${credencial_db}" | python3 "${varredura}" "${DIR_TRABALHO}"; then
		ok "nem 'criar', nem 'destruir', nem 'capturar.py' ecoaram as credenciais"
	else
		falhar "uma credencial apareceu na saída dos scripts (arquivo:linha acima; valor omitido)"
	fi

	fechar_caso "CT-013"
}

# --------------------------------------------------------------------------- #
# CT-502 — a captura da régua registra a tripla (destinatário, assunto, corpo) e o
#          despachante real nunca é invocado.
#
# INVARIANTE: durante a captura, os DOIS pontos de despacho de `emailer.py`
# (`:203`, em `enviar_email_automacao`, e `:251`, em `enviar_email_manual`) são
# cobertos por um registrador em memória; o golden registra, por cenário, a tripla
# de cada mensagem que a régua DECIDIU enviar; e o contador de invocações do
# despachante real vale exatamente `0`.
#
# O caso tem TRÊS pernas, e nenhuma delas basta sozinha:
#   1. estática — o fonte não tem um segundo caminho capaz de despachar;
#   2. falsificação — a asserção estática REPROVA numa cópia com um dos dois
#      pontos removido, nomeando o que restou (obrigatória: a perna 1 inspeciona o
#      TEXTO do SUT, `.claude/rules/testing-stack.md`);
#   3. comportamental — o golden traz mensagens completas vindas dos dois pontos, e
#      o contador de despacho real zerado. A guarda de não-vacuidade está aqui: sem
#      ela, uma captura que não registrasse mensagem nenhuma satisfaria "nenhuma
#      mensagem incompleta" e "zero despachos reais" de graça.
# --------------------------------------------------------------------------- #
ARQ_REGUA_GOLDEN="regua-de-cobranca.json"

escrever_auditor_do_despachante() {
	cat >"${DIR_TRABALHO}/auditar-despachante.py" <<'PY'
"""Audita, no fonte de `capturar.py`, a substituição do despachante do arcabouço.

Duas propriedades, e a segunda é a que a falsificação ataca:

(a) o nome do despachante do arcabouço só aparece em posição executável DENTRO do
    bloco delimitado — fora dele, e fora de comentário, a contagem é zero. É o que
    torna a substituição uma barreira única em vez de um caminho entre vários;
(b) os dois call sites da régua estão DECLARADOS um a um na tupla de pontos
    esperados. A substituição é uma atribuição só e cobre os dois de uma vez —
    sem a declaração, "cobre os dois" seria indistinguível de "cobre um", e não
    haveria o que falsificar.

A extração de (b) é da TUPLA, e não do arquivo inteiro de propósito: os mesmos
literais aparecem no texto do manifesto que este script monta, e um `grep` sobre o
arquivo continuaria verde com a tupla mutilada.

A tupla vive DENTRO do programa que `capturar.py` transporta para o contêiner, que
no arquivo é uma cadeia crua. Por isso a leitura é em dois passos: o AST do arquivo
entrega o programa, e o AST do programa entrega a tupla. Ler a cadeia por expressão
regular voltaria a ser o `grep` que o parágrafo acima descarta.
"""
import ast
import re
import sys

NOME_DO_DESPACHANTE = "frappe.sendmail"
MARCA_INICIO = "SUBSTITUICAO-DO-DESPACHANTE: INICIO"
MARCA_FIM = "SUBSTITUICAO-DO-DESPACHANTE: FIM"
PROGRAMA_TRANSPORTADO = "PROGRAMA_NO_CONTAINER"
TUPLA_DOS_PONTOS = "PONTOS_DE_DESPACHO_ESPERADOS"
PONTOS_EXIGIDOS = ("emailer.py:203", "emailer.py:251")
SENTINELAS_DE_SMTP = ("smtplib.SMTP", "smtplib.SMTP_SSL")

caminho = sys.argv[1]
texto = open(caminho, encoding="utf-8").read()
linhas = texto.splitlines()
erros = []


def cadeia_atribuida(arvore, nome):
    for no in ast.walk(arvore):
        if not isinstance(no, ast.Assign):
            continue
        if not any(isinstance(a, ast.Name) and a.id == nome for a in no.targets):
            continue
        if isinstance(no.value, ast.Constant) and isinstance(no.value.value, str):
            return no.value.value
    return None

inicios = [n for n, linha in enumerate(linhas) if MARCA_INICIO in linha]
fins = [n for n, linha in enumerate(linhas) if MARCA_FIM in linha]
if len(inicios) != 1 or len(fins) != 1 or inicios[0] >= fins[0]:
    erros.append(
        f"bloco de substituição mal delimitado: {len(inicios)} marca(s) de início e "
        f"{len(fins)} de fim"
    )
    dentro = range(0, 0)
else:
    dentro = range(inicios[0], fins[0] + 1)

fora = 0
substituicao_declarada = False
sentinelas_instaladas = set()
for numero, linha in enumerate(linhas):
    if NOME_DO_DESPACHANTE not in linha:
        continue
    if linha.strip().startswith("#"):
        continue
    if numero not in dentro:
        fora += 1
        erros.append(
            f"{caminho}:{numero + 1}: o despachante do arcabouço é nomeado em posição "
            "executável fora do bloco de substituição — há um segundo caminho de despacho"
        )
    elif re.search(r"^\s*" + re.escape(NOME_DO_DESPACHANTE) + r"\s*(,[^=]*)?=", linha):
        substituicao_declarada = True

for numero in dentro:
    for sentinela in SENTINELAS_DE_SMTP:
        if re.search(r"^\s*" + re.escape(sentinela) + r"\s*=\s*sentinela\b", linhas[numero]):
            sentinelas_instaladas.add(sentinela)

if not substituicao_declarada:
    erros.append(
        "o bloco de substituição não atribui o registrador ao despachante do arcabouço"
    )
faltando_sentinela = sorted(set(SENTINELAS_DE_SMTP) - sentinelas_instaladas)
if faltando_sentinela:
    erros.append(
        f"a sentinela de despacho real não cobre {faltando_sentinela} — o contador de "
        "invocações do despachante real ficaria sem instrumentação"
    )

declarados = []
programa = cadeia_atribuida(ast.parse(texto), PROGRAMA_TRANSPORTADO)
if programa is None:
    erros.append(f"a cadeia {PROGRAMA_TRANSPORTADO} não foi encontrada em {caminho}")
else:
    for no in ast.walk(ast.parse(programa)):
        if not isinstance(no, ast.Assign):
            continue
        alvos = [a.id for a in no.targets if isinstance(a, ast.Name)]
        if TUPLA_DOS_PONTOS not in alvos:
            continue
        if isinstance(no.value, (ast.Tuple, ast.List)):
            declarados = [
                item.value for item in no.value.elts
                if isinstance(item, ast.Constant) and isinstance(item.value, str)
            ]

if not declarados:
    erros.append(f"a tupla {TUPLA_DOS_PONTOS} não foi encontrada ou está vazia")
for ponto in PONTOS_EXIGIDOS:
    if ponto not in declarados:
        erros.append(
            f"ponto de despacho ausente da declaração: {ponto} — declarados no arquivo: "
            f"{declarados}"
        )

print("ocorrencias_fora_do_bloco=" + str(fora))
print("pontos_declarados=" + " ".join(declarados))
for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
}

ct_502() {
	caso "CT-502" "a captura da régua registra a tripla e o despachante real nunca é invocado"

	escrever_auditor_do_despachante
	local auditor="${DIR_TRABALHO}/auditar-despachante.py"

	# ---- perna 1: prova estática sobre o arquivo íntegro ----
	set +e
	python3 "${auditor}" "${CAPTURAR}" \
		>"${DIR_TRABALHO}/auditoria-integro.out" 2>"${DIR_TRABALHO}/auditoria-integro.err"
	local codigo_integro=$?
	set -e
	afirmar_igual "a auditoria do despachante passa limpa no capturar.py íntegro" \
		"0" "${codigo_integro}"
	if [[ "${codigo_integro}" -ne 0 ]]; then
		cat "${DIR_TRABALHO}/auditoria-integro.err" >&2
	fi
	afirmar_igual "o despachante do arcabouço não é nomeado fora do bloco de substituição" \
		"0" "$(sed -n 's/^ocorrencias_fora_do_bloco=//p' "${DIR_TRABALHO}/auditoria-integro.out")"
	afirmar_igual "os dois call sites da régua estão declarados no fonte" \
		"emailer.py:203 emailer.py:251" \
		"$(sed -n 's/^pontos_declarados=//p' "${DIR_TRABALHO}/auditoria-integro.out")"

	# ---- perna 2: prova de falsificação por cópia mutada ----
	# `.claude/rules/testing-stack.md`: asserção que inspeciona o TEXTO do SUT exige
	# a demonstração de que ela pode reprovar. O mutante remove UM dos dois pontos da
	# tupla; o literal removido continua existindo no arquivo (o manifesto o cita por
	# extenso), de modo que uma auditoria por `grep` ingênuo sobreviveria ao mutante.
	local mutante="${DIR_TRABALHO}/capturar-mutante.py"
	local ponto_removido="emailer.py:203"
	local ponto_restante="emailer.py:251"
	awk -v alvo="\"${ponto_removido}\"," '
		index($0, alvo) && !removido { removido = 1; next }
		{ print }
	' "${CAPTURAR}" >"${mutante}"

	afirmar_igual "o mutante perdeu exatamente uma linha do fonte" "1" \
		"$(($(wc -l <"${CAPTURAR}") - $(wc -l <"${mutante}")))"

	set +e
	python3 "${auditor}" "${mutante}" \
		>"${DIR_TRABALHO}/auditoria-mutante.out" 2>"${DIR_TRABALHO}/auditoria-mutante.err"
	local codigo_mutante=$?
	set -e
	afirmar_diferente "a auditoria REPROVA a cópia com um dos dois pontos removido" \
		"0" "${codigo_mutante}"
	afirmar_contem "a reprovação nomeia o ponto ausente" \
		"${DIR_TRABALHO}/auditoria-mutante.err" "${ponto_removido}"
	afirmar_contem "a reprovação nomeia o ponto que restou declarado" \
		"${DIR_TRABALHO}/auditoria-mutante.err" "${ponto_restante}"

	# ---- perna 3: prova comportamental sobre o golden produzido ----
	if python3 - "${DIR_GOLDEN}" "${ARQ_REGUA_GOLDEN}" <<'PY'
import json
import re
import sys
from pathlib import Path

golden, nome = Path(sys.argv[1]), sys.argv[2]
erros = []

PONTOS_EXIGIDOS = {"emailer.py:203", "emailer.py:251"}
FUNCOES_EXIGIDAS = {"enviar_email_automacao", "enviar_email_manual"}
CHAVES_DA_TRIPLA = ("destinatario", "assunto", "corpo")

dados = json.loads((golden / nome).read_text(encoding="utf-8"))
despacho = dados.get("despacho") or {}

nivel = despacho.get("nivel_da_ordem_de_queda")
if nivel not in (1, 2, 3):
    erros.append(f"nível da ordem de queda ausente ou fora de 1..3: {nivel!r}")

manifesto = (golden / "PROCEDENCIA.md").read_text(encoding="utf-8")
casamento = re.search(
    r"^\|\s*Nível da ordem de queda alcançado \(régua\)\s*\|\s*(\d+)\s*—", manifesto,
    re.MULTILINE,
)
if not casamento:
    erros.append("PROCEDENCIA.md não declara o nível da ordem de queda alcançado")
elif int(casamento.group(1)) != nivel:
    erros.append(
        f"o nível declarado no manifesto ({casamento.group(1)}) diverge do gravado no "
        f"golden ({nivel})"
    )

if despacho.get("invocacoes_do_despachante_real") != 0:
    erros.append(
        "o contador de invocações do despachante real não vale 0: "
        f"{despacho.get('invocacoes_do_despachante_real')!r}"
    )
if despacho.get("emails_na_fila_do_arcabouco") != 0:
    erros.append(
        "a fila de e-mail do arcabouço não terminou vazia: "
        f"{despacho.get('emails_na_fila_do_arcabouco')!r}"
    )
if set(despacho.get("pontos_esperados") or []) != PONTOS_EXIGIDOS:
    erros.append(f"pontos esperados divergem: {despacho.get('pontos_esperados')!r}")
if set(despacho.get("pontos_substituidos") or []) != PONTOS_EXIGIDOS:
    erros.append(
        "os pontos efetivamente observados pelo registrador não são os dois da régua: "
        f"{despacho.get('pontos_substituidos')!r}"
    )

retorno = dados.get("retorno") or {}
mensagens = list((retorno.get("automatico") or {}).get("mensagens") or [])
for cenario in retorno.get("manual") or []:
    mensagens.extend(cenario.get("mensagens") or [])

# Guarda de NÃO-VACUIDADE: sem ela, um golden sem mensagem alguma satisfaria todas
# as asserções acima — nenhuma mensagem incompleta, nenhum despacho real. É o modo
# de falha que transforma "não despachou" em "não executou".
if not mensagens:
    erros.append(
        "nenhuma mensagem registrada: o golden não distingue 'a régua decidiu não "
        "enviar' de 'o percurso da régua não executou'"
    )

funcoes_observadas = {mensagem.get("funcao") for mensagem in mensagens}
faltando = sorted(FUNCOES_EXIGIDAS - funcoes_observadas)
if faltando:
    erros.append(f"nenhuma mensagem registrada vinda de {faltando}")

for mensagem in mensagens:
    vazias = [c for c in CHAVES_DA_TRIPLA if not str(mensagem.get(c) or "").strip()]
    if vazias:
        erros.append(
            f"mensagem de {mensagem.get('cobranca')!r} sem {vazias} — a tripla "
            "(destinatário, assunto, corpo) é o oráculo do texto que a régua cobra"
        )
    if mensagem.get("origem") not in PONTOS_EXIGIDOS:
        erros.append(
            f"mensagem registrada com origem inesperada: {mensagem.get('origem')!r}"
        )

# Cada cenário com mensagem registrada é um cenário cuja tripla o golden guarda; o
# número é impresso para que uma queda futura seja visível no log do verificador.
cenarios_com_mensagem = {
    mensagem.get("cobranca") for mensagem in mensagens if mensagem.get("cobranca")
}
print(
    f"    ..   mensagens registradas: {len(mensagens)}"
    f" · cenários com mensagem: {len(cenarios_com_mensagem)}"
    f" · despachos reais: {despacho.get('invocacoes_do_despachante_real')}"
)

for erro in erros:
    print(erro, file=sys.stderr)
sys.exit(1 if erros else 0)
PY
	then
		ok "a tripla está registrada por cenário, vinda dos dois pontos, sem despacho real"
	else
		falhar "o golden da régua não registra a tripla ou o despachante real foi invocado (acima)"
	fi

	fechar_caso "CT-502"
}

# --------------------------------------------------------------------------- #
main() {
	if [[ ! -f "${PREPARAR}" ]]; then
		printf 'ERRO: script não encontrado: %s\n' "${PREPARAR}" >&2
		exit 1
	fi
	if ! compose ps --status running --format '{{.Service}}' | grep -qx "${SERVICO}"; then
		printf 'ERRO: serviço %s não está de pé.\n' "${SERVICO}" >&2
		exit 1
	fi
	if [[ "$(contar_sites_efemeros)" != "1" ]]; then
		printf 'ERRO: o site %s precisa estar de pé. Rode "preparar-site-efemero.sh criar".\n' \
			"${SITE_EFEMERO}" >&2
		exit 1
	fi

	credencial_db="$(ler_credencial_db)"
	if [[ -z "${credencial_db}" ]]; then
		printf 'ERRO: MYSQL_ROOT_PASSWORD não encontrado em %s\n' "${ARQ_COMPOSE}" >&2
		exit 1
	fi

	# O site que atende a operação é identificado pelo default_site do bench —
	# nenhum literal dele mora nos scripts desta task.
	site_producao="$(no_container "python3 -c \"import json;print(json.load(open('sites/common_site_config.json'))['default_site'])\"" |
		tr -d '\r\n')"
	base_producao="$(no_container "python3 -c \"import json;print(json.load(open('sites/${site_producao}/site_config.json'))['db_name'])\"" |
		tr -d '\r\n')"
	# Do MESMO arquivo de onde sai `db_name`, e pela mesma razão: é o par que autentica
	# a leitura da base do site. Nunca ecoada — o CT-013 varre as duas credenciais.
	senha_producao="$(no_container "python3 -c \"import json;print(json.load(open('sites/${site_producao}/site_config.json'))['db_password'])\"" |
		tr -d '\r\n')"
	if [[ -z "${senha_producao}" ]]; then
		printf 'ERRO: db_password ausente em sites/%s/site_config.json\n' "${site_producao}" >&2
		exit 1
	fi
	# Lido enquanto o site efêmero existe: o CT-003 o destrói antes do CT-012.
	banco_efemero="$(no_container "python3 -c \"import json;print(json.load(open('sites/${SITE_EFEMERO}/site_config.json'))['db_name'])\"" |
		tr -d '\r\n' || true)"
	printf 'site de produção: %s · site efêmero: %s\n' "${site_producao}" "${SITE_EFEMERO}"

	instante_t0="$(instante_do_ambiente)"
	medir_producao "antes"
	capturar_estado_do_site

	ct_006
	ct_007
	ct_008
	ct_009
	ct_004
	ct_005
	ct_001
	ct_002
	ct_003
	ct_603
	ct_012
	ct_013_logs
	ct_502

	printf '\n'
	if [[ "${falhas_totais}" -eq 0 ]]; then
		printf 'verificar-captura: 12/12 casos aprovados (CT-001..CT-009, CT-012, CT-502, CT-603) + metade de logs do CT-013\n'
		exit 0
	fi
	printf 'verificar-captura: %d falha(s) — REPROVADO\n' "${falhas_totais}" >&2
	exit 1
}

credencial_db=""
site_producao=""
base_producao=""
senha_producao=""
banco_efemero=""
instante_t0=""
main "$@"
