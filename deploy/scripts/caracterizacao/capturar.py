#!/usr/bin/env python3
"""Captura a caracterização das regras de negócio legadas (TC-001, F2/T1 e F3/T1).

Nove artefatos golden: os seis da captura original (TC-001), os dois de ativação
e cancelamento de contrato acrescentados pela T1 da fatia `contratos-de-locacao`,
e o da régua de cobrança acrescentado pela T1 da fatia `cobranca-e-mora`.

A captura roda **dentro do container `backend`** do Frappe, contra o site efêmero
`caracterizacao.localhost` criado por `preparar-site-efemero.sh` (ADR-0006 — o
site que atende a operação nunca é usado como ambiente de verificação). Este
arquivo é o único ponto de entrada: ele transporta o programa de captura para
dentro do container, recebe de volta um envelope JSON e grava os artefatos
golden no repositório, que é onde eles precisam sobreviver ao desligamento do
Frappe.

Ordem de execução obrigatória do fluxo completo:

    preparar-site-efemero.sh criar
    capturar.py
    verificar-captura.sh          (exige o site efêmero de pé)
    verificar-golden.sh           (offline)
    preparar-site-efemero.sh destruir

Códigos de saída:
    0  captura concluída, nove artefatos golden + manifesto gravados
    1  falha de ambiente ou de execução
    2  gate de sanidade reprovado — nenhum arquivo de `golden/` é tocado
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

DIR_FRAPPE = "/opt/frappe"
ARQ_COMPOSE = f"{DIR_FRAPPE}/docker-compose.yaml"
ARQ_COMPOSE_OVERRIDE = f"{DIR_FRAPPE}/docker-compose.override.yml"
SERVICO = "backend"
DIR_SITES = "/home/frappe/frappe-bench/sites"
PYTHON_BENCH = "../env/bin/python"

RAIZ_REPO = Path(__file__).resolve().parents[3]
DIR_GOLDEN = (
    RAIZ_REPO
    / "docs/specs/features/caracterizacao-regras-legadas/v1/golden"
)

SENTINELA_INICIO = "-----CARACTERIZACAO-ENVELOPE-INICIO-----"
SENTINELA_FIM = "-----CARACTERIZACAO-ENVELOPE-FIM-----"

TIMEOUT_CAPTURA_S = 1800

EXIT_ERRO = 1
EXIT_GATE = 2


# --------------------------------------------------------------------------- #
# Casos canônicos de `_calcular_mora` — PORTADOS, não re-executados (§6.7).
#
# Fonte: locacao_automation/tests/test_cobranca_atraso.py::TestCalcularMora.
# São 6 casos de teste que, somados, fazem 7 invocações com tuplas de entrada
# distintas. A estrutura preserva as duas coisas: os 6 casos (a unidade de
# intenção do teste original) e as 7 tuplas (a evidência de linearidade e de
# independência entre multa e juros, que se perderia ao deduplicar por caso).
# --------------------------------------------------------------------------- #
def _mora(valor_original, dias_atraso, multa_percentual, juros_percentual,
          valor_multa, valor_juros, valor_total):
    return {
        "entrada": {
            "valor_original": valor_original,
            "dias_atraso": dias_atraso,
            "multa_percentual": multa_percentual,
            "juros_percentual": juros_percentual,
        },
        "saida": {
            "valor_multa": valor_multa,
            "valor_juros": valor_juros,
            "valor_total": valor_total,
        },
    }


CASOS_CALCULAR_MORA = [
    {
        "id": "exemplo_canonico_2074_67",
        "teste_fonte": "TestCalcularMora.test_exemplo_canonico_2074_67",
        "descricao": "2000, multa 2%, juros 1%/mês, 52 dias -> 2.074,67.",
        "invocacoes": [_mora(2000.0, 52, 2, 1, 40.00, 34.67, 2074.67)],
    },
    {
        "id": "juros_um_mes_e_exatamente_a_taxa_mensal",
        "teste_fonte": "TestCalcularMora.test_juros_um_mes_e_exatamente_a_taxa_mensal",
        "descricao": "30 dias a 1%/mês = 1% do valor original; 60 dias = o dobro.",
        "invocacoes": [
            _mora(2000.0, 30, 2, 1, 40.00, 20.00, 2060.00),
            _mora(2000.0, 60, 2, 1, 40.00, 40.00, 2080.00),
        ],
    },
    {
        "id": "juros_lineares_sem_composicao",
        "teste_fonte": "TestCalcularMora.test_juros_lineares_sem_composicao",
        "descricao": "Dobrar os dias dobra o juros — regime simples, sem juros sobre juros.",
        "invocacoes": [
            _mora(2000.0, 30, 2, 1, 40.00, 20.00, 2060.00),
            _mora(2000.0, 60, 2, 1, 40.00, 40.00, 2080.00),
        ],
    },
    {
        "id": "juros_nao_incidem_sobre_a_multa",
        "teste_fonte": "TestCalcularMora.test_juros_nao_incidem_sobre_a_multa",
        "descricao": "Multa de 2% ou de 50% produz o mesmo juros — a base é o valor original.",
        "invocacoes": [
            _mora(2000.0, 52, 2, 1, 40.00, 34.67, 2074.67),
            _mora(2000.0, 52, 50, 1, 1000.00, 34.67, 3034.67),
        ],
    },
    {
        "id": "multa_unica_independe_dos_dias",
        "teste_fonte": "TestCalcularMora.test_multa_unica_independe_dos_dias",
        "descricao": "A multa é aplicada uma vez: a mesma para 5 ou para 500 dias.",
        "invocacoes": [
            _mora(2000.0, 5, 2, 1, 40.00, 3.33, 2043.33),
            _mora(2000.0, 500, 2, 1, 40.00, 333.33, 2373.33),
        ],
    },
    {
        "id": "total_e_soma_das_partes",
        "teste_fonte": "TestCalcularMora.test_total_e_soma_das_partes",
        "descricao": "O total é a soma do valor original com multa e juros, arredondada.",
        "invocacoes": [_mora(1234.56, 17, 2, 1, 24.69, 7.00, 1266.25)],
    },
]


# --------------------------------------------------------------------------- #
# Programa executado DENTRO do container, com o interpretador do bench.
# --------------------------------------------------------------------------- #
PROGRAMA_NO_CONTAINER = r'''
import base64
import io
import json
import os
import re
import smtplib
import sys

import frappe
from frappe.utils import add_days, getdate, nowdate

sys.stderr.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

SITE = "caracterizacao.localhost"
SENTINELA_INICIO = "@@SENTINELA_INICIO@@"
SENTINELA_FIM = "@@SENTINELA_FIM@@"
MARCADOR_DATA_EXECUCAO = "<DATA_EXECUCAO>"
MARCADOR_DATA_PDF = "<DATA_GERACAO_EXTENSO>"

# Marcadores da fase de cancelamento. Os dois nomes são escritos SEM dígito de
# propósito: a bijeção máscara <-> marcador do CT-014 varre `<[A-Z_]+>`, que não
# casa algarismo. Um marcador como `<PDF_CONTRATO_BASE64>` escaparia da varredura
# e viraria máscara órfã silenciosa — o defeito exato que aquela bijeção existe
# para pegar.
MARCADOR_PDF_CONTRATO = "<PDF_CONTRATO_CODIFICADO>"
MARCADOR_ARQUIVO_PDF = "<ARQUIVO_PDF_PRIVADO>"

# Marcadores da fase da régua de cobrança. Mesma regra dos dois de cima, e pela
# mesma razão: nenhum algarismo no nome, ou o marcador escapa de `<[A-Z_]+>` e
# vira máscara órfã invisível para a bijeção.
MARCADOR_HORA_EXECUCAO = "<HORA_EXECUCAO>"
MARCADOR_DATA_VENCIMENTO = "<DATA_VENCIMENTO_FORMATADA>"
MARCADOR_REQUISICAO = "<IDENTIFICADOR_DE_REQUISICAO>"

# Sentinela gravada no campo agregado ANTES do save. Se o Server Script de
# metragem não executar, o valor sobrevive e denuncia a regra inativa.
SENTINELA_METRAGEM = -1.0

SERVER_SCRIPTS_EXIGIDOS = ("Cálculo metragem imóvel", "PDF contrato")

TABELAS_PURGAVEIS = (
    "Cobranca", "Contrato", "Comodo", "Fiadores",
    "Imovel", "Fiador", "Locatario", "Locador", "Conjunto",
)

MESES_EXTENSO = (
    "JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|"
    "JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO"
)
RE_DATA_EXTENSO = re.compile(r"\b\d{1,2} de (?:" + MESES_EXTENSO + r") de \d{4}\b")


def gate_de_sanidade():
    """Regra ativa é precondição, não detalhe: golden de regra desligada parece sucesso."""
    violacoes = []

    if int(frappe.conf.get("server_script_enabled") or 0) != 1:
        violacoes.append(
            "server_script_enabled: desligado no site_config de " + SITE
        )

    for nome in SERVER_SCRIPTS_EXIGIDOS:
        linha = frappe.db.get_value(
            "Server Script", nome,
            ["name", "disabled", "reference_doctype", "doctype_event"],
            as_dict=True,
        )
        if not linha:
            violacoes.append("Server Script '" + nome + "': ausente no site " + SITE)
        elif int(linha.disabled or 0) != 0:
            violacoes.append(
                "Server Script '" + nome + "': disabled=" + str(int(linha.disabled))
            )

    return violacoes


def purgar_dados_de_negocio():
    """Site restaurado do dump traz dados reais; a captura precisa de conjunto fechado.

    Sem isto as rotinas varreriam centenas de documentos de produção — o golden
    ficaria enorme, carregaria dado real e mudaria a cada dump. Purgar também é o
    que torna `capturar.py` re-executável no MESMO site sem duplicar candidatos.
    """
    for tabela in TABELAS_PURGAVEIS:
        frappe.db.sql("DELETE FROM `tab{0}`".format(tabela))
    frappe.db.commit()


def inserir(doc_dict, ignorar_obrigatorios=False):
    doc = frappe.get_doc(doc_dict)
    if ignorar_obrigatorios:
        doc.flags.ignore_mandatory = True
    doc.insert(ignore_permissions=True)
    return doc


def offset(dias):
    return add_days(nowdate(), dias)


def offset_de(valor, hoje):
    if not valor:
        return None
    return (getdate(valor) - hoje).days


def normalizar_data(valor, hoje):
    """Data absoluta vira marcador (hoje) ou offset inteiro (qualquer outro dia)."""
    if not valor:
        return None
    dias = (getdate(valor) - hoje).days
    return MARCADOR_DATA_EXECUCAO if dias == 0 else dias


def criar_base_cadastral():
    inserir({
        "doctype": "Conjunto",
        "name": "CONJ-CARACT",
        "nome_conjunto": "Conjunto Caracterizacao",
    })
    inserir({
        "doctype": "Locador",
        "name": "LOCADOR-CARACT",
        "locador_nome": "Maria Locadora",
        "tipo_locador": "Pessoa Física",
        "documento_principal": "11122233344",
        "rg": "MG-1234567",
        "email": "locador@caracterizacao.invalid",
        "telefone": "33999990001",
        "logradouro": "Avenida Central",
        "numero": "1000",
        "complemento": "",
        "bairro": "Centro",
        "cidade": "Caratinga",
        "estado": "MG",
        "cep": "35300-001",
        "ativo": 1,
    })
    inserir({
        "doctype": "Locatario",
        "name": "LOCATARIO-CARACT",
        "locatario_nome": "Joao Locatario",
        "tipo_locatario": "Pessoa Física",
        "documento_principal": "55566677788",
        "rg": "MG-7654321",
        "email": "locatario@caracterizacao.invalid",
        "telefone": "33999990002",
        "logradouro": "Rua B",
        "numero": "55",
        "complemento": "",
        "bairro": "Bela Vista",
        "cidade": "Caratinga",
        "estado": "MG",
        "cep": "35300-002",
        "ativo": 1,
    })


def imovel_dict(name, identificador, comodos, status="Disponível"):
    return {
        "doctype": "Imovel",
        "name": name,
        "conjunto": "CONJ-CARACT",
        "nome_imovel": "Imovel " + identificador,
        "identificador_municipal": identificador,
        "tipo_imovel": "Residencial",
        "logradouro": "Rua das Flores",
        "numero": "120",
        "complemento": "Fundos",
        "bairro": "Centro",
        "cidade": "Caratinga",
        "estado": "MG",
        "cep": "35300-000",
        "metragem_total": SENTINELA_METRAGEM,
        "status_locacao": status,
        "contrato_ativo": "",
        "comodos": comodos,
    }


# --------------------------------------------------------------------------- #
# Fase A — regra de agregação de metragem (Server Script, Imovel / Before Save)
# --------------------------------------------------------------------------- #
CENARIOS_METRAGEM = (
    ("sem_comodo", "IMOVEL-CARACT-MET-SEM-COMODO", "MET-001", []),
    ("um_comodo", "IMOVEL-CARACT-MET-UM-COMODO", "MET-002",
     [{"nome_comodo": "Sala", "metragem": 25.5}]),
    ("varios_comodos", "IMOVEL-CARACT-MET-VARIOS-COMODOS", "MET-003",
     [{"nome_comodo": "Sala", "metragem": 25.5},
      {"nome_comodo": "Quarto", "metragem": 30.25},
      {"nome_comodo": "Cozinha", "metragem": 12.0}]),
    ("varios_comodos_com_metragem_nula",
     "IMOVEL-CARACT-MET-VARIOS-COMODOS-METRAGEM-NULA", "MET-004",
     [{"nome_comodo": "Sala", "metragem": 40.0},
      {"nome_comodo": "Deposito", "metragem": None},
      {"nome_comodo": "Quarto", "metragem": 18.5}]),
)


def capturar_metragem():
    cenarios = {}
    for chave, name, identificador, comodos in CENARIOS_METRAGEM:
        inserir(imovel_dict(name, identificador, comodos), ignorar_obrigatorios=True)
        persistidos = frappe.get_all(
            "Comodo",
            filters={"parent": name, "parenttype": "Imovel"},
            fields=["idx", "nome_comodo", "metragem"],
            order_by="idx asc",
        )
        cenarios[chave] = {
            "imovel_ref": name,
            "comodos_entrada": [
                {"nome_comodo": c["nome_comodo"], "metragem": c["metragem"]}
                for c in comodos
            ],
            "comodos_persistidos": [
                {"idx": p["idx"], "nome_comodo": p["nome_comodo"], "metragem": p["metragem"]}
                for p in persistidos
            ],
            "valor_agregado": frappe.db.get_value("Imovel", name, "metragem_total"),
        }
    frappe.db.commit()
    return {
        "regra": "Cálculo metragem imóvel",
        "tipo": "Server Script (DocType Event)",
        "doctype": "Imovel",
        "evento": "Before Save",
        "campo_agregado": "metragem_total",
        "valor_sentinela_de_entrada": SENTINELA_METRAGEM,
        "cenarios": cenarios,
    }


# --------------------------------------------------------------------------- #
# Fase B — documento de contrato (Server Script, Contrato / After Save)
# --------------------------------------------------------------------------- #
def capturar_contrato_pdf():
    inserir(
        imovel_dict("IMOVEL-CARACT-PDF", "PDF-001",
                    [{"nome_comodo": "Sala", "metragem": 25.5}]),
        ignorar_obrigatorios=True,
    )
    # Datas ABSOLUTAS e fixas de propósito: o texto do contrato renderiza as datas
    # do próprio contrato; datas relativas fariam o golden mudar todo dia.
    contrato = inserir({
        "doctype": "Contrato",
        "name": "CTR-CARACT-PDF-01",
        "imovel": "IMOVEL-CARACT-PDF",
        "locador": "LOCADOR-CARACT",
        "locatario": "LOCATARIO-CARACT",
        "data_inicio_locacao": "2026-01-15",
        "prazo_meses": 12,
        "data_fim_locacao": "2027-01-14",
        "valor_mensal": 2500.0,
        "valor_total_contrato": 30000.0,
        # Rascunho: mantém o contrato do PDF fora do conjunto de candidatos de
        # `encerrar_contratos_vencidos`, hoje e em qualquer data futura.
        "status_contrato": "Rascunho",
        "dia_vencimento": 10,
        "gerar_cobrancas_automaticamente": 0,
    })

    pdf_base64 = frappe.db.get_value("Contrato", contrato.name, "pdf_contrato")
    if not pdf_base64:
        raise RuntimeError(
            "Contrato " + contrato.name + " salvo sem PDF — o Server Script "
            "'PDF contrato' não produziu o documento."
        )

    pdf_bytes = base64.b64decode(pdf_base64)
    if pdf_bytes[:5] != b"%PDF-":
        raise RuntimeError("O conteúdo anexado ao contrato não é um PDF.")

    from pypdf import PdfReader

    leitor = PdfReader(io.BytesIO(pdf_bytes))
    texto = "\n".join((pagina.extract_text() or "") for pagina in leitor.pages)

    # Único campo volátil do documento: o "cidade, DD de MES de AAAA" do fecho,
    # que o Server Script monta com `nowdate()`.
    texto_mascarado, mascaras = RE_DATA_EXTENSO.subn(MARCADOR_DATA_PDF, texto)
    if mascaras == 0:
        raise RuntimeError(
            "Nenhuma data por extenso encontrada no texto do contrato — a máscara "
            "de campo volátil não foi aplicada e o golden seria instável."
        )

    frappe.db.commit()
    return {
        "contrato_ref": contrato.name,
        "paginas": len(leitor.pages),
        "mascaras_aplicadas": mascaras,
        "texto": texto_mascarado,
    }


# --------------------------------------------------------------------------- #
# Fase C — marcar_cobrancas_vencidas()
# --------------------------------------------------------------------------- #
def cobranca_dict(name, offset_vencimento, valor_original, status,
                  pagamento_confirmado=0, valor_multa=0.0, valor_juros=0.0,
                  contrato="CTR-CARACT-COBRANCAS"):
    return {
        "doctype": "Cobranca",
        "name": name,
        "contrato": contrato,
        "locatario": "LOCATARIO-CARACT",
        "valor_original": valor_original,
        "valor_multa": valor_multa,
        "valor_juros": valor_juros,
        "valor_total": valor_original + valor_multa + valor_juros,
        "data_vencimento": offset(offset_vencimento),
        "status_cobranca": status,
        "referencia": name,
        "competencia": offset(offset_vencimento),
        "pagamento_confirmado": pagamento_confirmado,
        "boleto_gerado": 0,
        "valor_pago": 0.0,
    }


def criar_contrato_hospedeiro():
    inserir(
        imovel_dict("IMOVEL-CARACT-COBRANCAS", "COB-001",
                    [{"nome_comodo": "Sala", "metragem": 20.0}]),
        ignorar_obrigatorios=True,
    )
    inserir({
        "doctype": "Contrato",
        "name": "CTR-CARACT-COBRANCAS",
        "imovel": "IMOVEL-CARACT-COBRANCAS",
        "locador": "LOCADOR-CARACT",
        "locatario": "LOCATARIO-CARACT",
        "data_inicio_locacao": "2026-01-15",
        "prazo_meses": 12,
        "data_fim_locacao": "2027-01-14",
        "valor_mensal": 1500.0,
        "valor_total_contrato": 18000.0,
        "status_contrato": "Rascunho",
        "dia_vencimento": 10,
        "gerar_cobrancas_automaticamente": 0,
    })


# `pagamento_confirmado = 1` é deliberado e inócuo para ESTA rotina, que só olha
# `status_cobranca` e `data_vencimento`. Ele isola estas cobranças do conjunto de
# candidatas de `atualizar_atrasos_cobrancas`, capturada depois no mesmo site.
ENTRADA_MARCAR = (
    ("COB-CARACT-MCV-01", -12, 1500.00, "Pendente", 1),
    ("COB-CARACT-MCV-02", -3, 980.50, "Pendente", 1),
    ("COB-CARACT-MCV-03", 15, 1200.00, "Pendente", 1),
    ("COB-CARACT-MCV-04", -40, 700.00, "Paga", 1),
)

CAMPOS_ESTADO_COBRANCA_MARCAR = ("status_cobranca", "data_vencimento", "valor_original")


def capturar_marcar_cobrancas_vencidas(hoje):
    from locacao_automation.cobranca_vencimento.service import marcar_cobrancas_vencidas

    entrada = []
    for name, off_venc, valor, status, pago in ENTRADA_MARCAR:
        inserir(cobranca_dict(name, off_venc, valor, status, pagamento_confirmado=pago))
        entrada.append({
            "name": name,
            "status_cobranca": status,
            "vencimento_offset_dias": off_venc,
            "valor_original": valor,
            "pagamento_confirmado": pago,
        })

    retorno = marcar_cobrancas_vencidas()
    frappe.db.commit()

    estado = []
    for item in entrada:
        valores = frappe.db.get_value(
            "Cobranca", item["name"], list(CAMPOS_ESTADO_COBRANCA_MARCAR), as_dict=True
        )
        estado.append({
            "name": item["name"],
            "status_cobranca": valores["status_cobranca"],
            "vencimento_offset_dias": offset_de(valores["data_vencimento"], hoje),
            "valor_original": valores["valor_original"],
        })

    retorno = dict(retorno)
    retorno["data_execucao"] = MARCADOR_DATA_EXECUCAO
    return {
        "rotina": "marcar_cobrancas_vencidas",
        "modulo": "locacao_automation.cobranca_vencimento.service",
        "entrada": {"cobrancas": entrada},
        "retorno": retorno,
        "estado_resultante": {"cobrancas": estado},
    }


# --------------------------------------------------------------------------- #
# Fase D — encerrar_contratos_vencidos()
# --------------------------------------------------------------------------- #
ENTRADA_ENCERRAR = (
    # (contrato, imovel, offset data_fim, status_contrato)
    ("CTR-CARACT-ECV-01", "IMOVEL-CARACT-ECV-01", -5, "Ativo"),
    ("CTR-CARACT-ECV-02", "", -9, "Ativo"),
    ("CTR-CARACT-ECV-03", "IMOVEL-CARACT-ECV-03", 20, "Ativo"),
    ("CTR-CARACT-ECV-04", "IMOVEL-CARACT-ECV-04", -30, "Encerrado"),
)


def capturar_encerrar_contratos_vencidos(hoje):
    from locacao_automation.contrato_encerramento.service import encerrar_contratos_vencidos

    imoveis = [imovel for _, imovel, _, _ in ENTRADA_ENCERRAR if imovel]
    for indice, imovel in enumerate(imoveis, start=1):
        inserir(
            imovel_dict(imovel, "ECV-00" + str(indice),
                        [{"nome_comodo": "Sala", "metragem": 30.0}],
                        status="Locado"),
            ignorar_obrigatorios=True,
        )

    entrada_contratos = []
    for contrato, imovel, off_fim, status in ENTRADA_ENCERRAR:
        inserir({
            "doctype": "Contrato",
            "name": contrato,
            "imovel": imovel,
            "locador": "LOCADOR-CARACT",
            "locatario": "LOCATARIO-CARACT",
            "data_inicio_locacao": "2025-01-15",
            "prazo_meses": 12,
            "data_fim_locacao": offset(off_fim),
            "valor_mensal": 1800.0,
            "valor_total_contrato": 21600.0,
            "status_contrato": status,
            "dia_vencimento": 5,
            "gerar_cobrancas_automaticamente": 0,
        }, ignorar_obrigatorios=True)
        if imovel:
            # Escrita direta: o vínculo imóvel->contrato só pode existir depois que
            # o contrato existe, e reabrir o `Imovel` reexecutaria a regra de
            # metragem, que não é o objeto desta fase.
            frappe.db.set_value("Imovel", imovel, "contrato_ativo", contrato,
                                update_modified=False)
        entrada_contratos.append({
            "name": contrato,
            "imovel": imovel,
            "status_contrato": status,
            "data_fim_locacao_offset_dias": off_fim,
        })
    frappe.db.commit()

    entrada_imoveis = [
        dict(
            frappe.db.get_value(
                "Imovel", imovel, ["status_locacao", "contrato_ativo"], as_dict=True
            ),
            name=imovel,
        )
        for imovel in imoveis
    ]

    retorno = encerrar_contratos_vencidos()
    frappe.db.commit()

    estado_contratos = []
    for contrato, _imovel, off_fim, _status in ENTRADA_ENCERRAR:
        valores = frappe.db.get_value(
            "Contrato", contrato, ["status_contrato", "imovel", "data_fim_locacao"],
            as_dict=True,
        )
        estado_contratos.append({
            "name": contrato,
            "status_contrato": valores["status_contrato"],
            "imovel": valores["imovel"],
            "data_fim_locacao_offset_dias": offset_de(valores["data_fim_locacao"], hoje),
        })

    estado_imoveis = []
    for imovel in imoveis:
        valores = frappe.db.get_value(
            "Imovel", imovel, ["status_locacao", "contrato_ativo"], as_dict=True
        )
        estado_imoveis.append({
            "name": imovel,
            "status_locacao": valores["status_locacao"],
            "contrato_ativo": valores["contrato_ativo"],
        })

    retorno = dict(retorno)
    retorno["data_execucao"] = MARCADOR_DATA_EXECUCAO
    return {
        "rotina": "encerrar_contratos_vencidos",
        "modulo": "locacao_automation.contrato_encerramento.service",
        "entrada": {"contratos": entrada_contratos, "imoveis": entrada_imoveis},
        "retorno": retorno,
        "estado_resultante": {"contratos": estado_contratos, "imoveis": estado_imoveis},
    }


# --------------------------------------------------------------------------- #
# Fase E — atualizar_atrasos_cobrancas()
# --------------------------------------------------------------------------- #
ENTRADA_ATRASOS = (
    # (name, offset vencimento, valor_original, status, pagamento_confirmado,
    #  valor_multa, valor_juros)
    ("COB-CARACT-AAC-01", -52, 2000.00, "Vencida", 0, 0.0, 0.0),
    ("COB-CARACT-AAC-02", -5, 1234.56, "Vencida", 0, 0.0, 0.0),
    # Mora não-zero de propósito: prova que a rotina não escreveu nada nesta
    # cobrança, em vez de apenas confirmar que ela continua zerada.
    ("COB-CARACT-AAC-03", 7, 1500.00, "Vencida", 0, 7.77, 3.33),
    ("COB-CARACT-AAC-04", -20, 900.00, "Vencida", 1, 0.0, 0.0),
    ("COB-CARACT-AAC-05", -30, 800.00, "Pendente", 0, 0.0, 0.0),
)

CAMPOS_ESTADO_COBRANCA_ATRASO = (
    "status_cobranca", "data_vencimento", "valor_original", "valor_multa",
    "valor_juros", "valor_total", "data_inicio_atraso",
    "data_ultima_atualizacao_atraso", "pagamento_confirmado",
)


def capturar_atualizar_atrasos_cobrancas(hoje):
    from locacao_automation.cobranca_atraso.service import atualizar_atrasos_cobrancas

    entrada = []
    for name, off_venc, valor, status, pago, multa, juros in ENTRADA_ATRASOS:
        inserir(cobranca_dict(name, off_venc, valor, status,
                              pagamento_confirmado=pago,
                              valor_multa=multa, valor_juros=juros))
        entrada.append({
            "name": name,
            "status_cobranca": status,
            "vencimento_offset_dias": off_venc,
            "valor_original": valor,
            "pagamento_confirmado": pago,
            "valor_multa": multa,
            "valor_juros": juros,
        })
    frappe.db.commit()

    configuracao = {
        "multa_percentual": frappe.db.get_single_value("Atraso", "multa"),
        "juros_percentual": frappe.db.get_single_value("Atraso", "juros"),
    }

    retorno = atualizar_atrasos_cobrancas()
    frappe.db.commit()

    estado = []
    for item in entrada:
        valores = frappe.db.get_value(
            "Cobranca", item["name"], list(CAMPOS_ESTADO_COBRANCA_ATRASO), as_dict=True
        )
        estado.append({
            "name": item["name"],
            "status_cobranca": valores["status_cobranca"],
            "vencimento_offset_dias": offset_de(valores["data_vencimento"], hoje),
            "valor_original": valores["valor_original"],
            "valor_multa": valores["valor_multa"],
            "valor_juros": valores["valor_juros"],
            "valor_total": valores["valor_total"],
            "pagamento_confirmado": valores["pagamento_confirmado"],
            "data_inicio_atraso": normalizar_data(valores["data_inicio_atraso"], hoje),
            "data_ultima_atualizacao_atraso": normalizar_data(
                valores["data_ultima_atualizacao_atraso"], hoje
            ),
        })

    retorno = dict(retorno)
    retorno["data_execucao"] = MARCADOR_DATA_EXECUCAO
    return {
        "rotina": "atualizar_atrasos_cobrancas",
        "modulo": "locacao_automation.cobranca_atraso.service",
        "configuracao_atraso": configuracao,
        "entrada": {"cobrancas": entrada},
        "retorno": retorno,
        "estado_resultante": {"cobrancas": estado},
    }


# --------------------------------------------------------------------------- #
# Fases F e G — ativação e cancelamento de contrato
#
# ORDEM É DECISÃO, não arrumação: as duas fases rodam DEPOIS das três rotinas de
# estado. `ativar_contrato` grava `status_contrato = "Ativo"` e a fase de
# cancelamento cria cobranças `Pendente`/`Vencida` — que são exatamente os
# conjuntos que `encerrar_contratos_vencidos`, `marcar_cobrancas_vencidas` e
# `atualizar_atrasos_cobrancas` varrem. Antecipá-las mudaria o golden das três, e
# esses seis artefatos são de fatia FECHADA.
# --------------------------------------------------------------------------- #
def mascarar_se_presente(valor, marcador):
    """Campo volátil por construção: marcador quando há valor, `None` quando não há.

    O que interessa ao oráculo é a PRESENÇA (o PDF continua anexado? foi trocado
    pelo arquivo privado?), não o conteúdo — que é base64 de megabytes num caso e
    caminho com identificador sorteado no outro, e faria o golden mudar a cada
    captura.
    """
    return marcador if str(valor or "").strip() else None


def executar_capturando_recusa(funcao, *args):
    """Executa a regra e devolve a recusa como DADO, em vez de deixá-la escapar.

    Metade do valor destes dois oráculos são os caminhos de recusa: a F3 precisa
    reproduzir a condição, a mensagem e a ORDEM em que as guardas disparam. Uma
    exceção que sobe abortaria a captura e não deixaria registro nenhum.
    """
    try:
        return {"aceito": True, "retorno": funcao(*args)}
    except Exception as excecao:
        # `frappe.throw` empilha a mensagem no log de mensagens da sessão; sem a
        # limpeza, a mensagem de um cenário reaparece no seguinte.
        frappe.clear_messages()
        return {
            "aceito": False,
            "excecao": type(excecao).__name__,
            "mensagem": str(excecao),
        }


BASE_CONTRATO_ATIVACAO = {
    "doctype": "Contrato",
    "locador": "LOCADOR-CARACT",
    "locatario": "LOCATARIO-CARACT",
    "imovel": "IMOVEL-CARACT-ATV-01",
    "data_inicio_locacao": "2027-01-15",
    "prazo_meses": 12,
    "valor_mensal": 1500.0,
    "dia_vencimento": 10,
    "status_contrato": "Rascunho",
    "gerar_cobrancas_automaticamente": 0,
}

CAMPOS_LIDOS_NA_VALIDACAO = (
    "data_inicio_locacao",
    "prazo_meses",
    "valor_mensal",
    "dia_vencimento",
    "imovel",
    "locatario",
)

# As seis condições de entrada, uma a uma, mais os dois limites aceitos do dia de
# vencimento e um cenário com DUAS violações — este último é o que revela a ORDEM
# das guardas, que nenhum cenário de violação isolada consegue mostrar.
CENARIOS_ATIVACAO_VALIDACAO = (
    ("completo_valido", {}),
    ("sem_data_inicio", {"data_inicio_locacao": None}),
    ("prazo_zero", {"prazo_meses": 0}),
    ("prazo_negativo", {"prazo_meses": -3}),
    ("valor_mensal_zero", {"valor_mensal": 0.0}),
    ("valor_mensal_negativo", {"valor_mensal": -100.0}),
    ("dia_vencimento_zero", {"dia_vencimento": 0}),
    ("dia_vencimento_limite_inferior", {"dia_vencimento": 1}),
    ("dia_vencimento_limite_superior", {"dia_vencimento": 28}),
    ("dia_vencimento_acima_do_teto", {"dia_vencimento": 29}),
    ("sem_imovel", {"imovel": ""}),
    ("sem_locatario", {"locatario": ""}),
    ("prazo_zero_e_valor_zero", {"prazo_meses": 0, "valor_mensal": 0.0}),
)

# Cobertura da virada de mês — a RAZÃO INTEIRA de capturar em vez de ler.
# `data_fim_locacao = add_days(add_months(inicio, prazo), -1)`, e `add_months`
# mora na biblioteca do arcabouço, não no arquivo portado. Início em 29, 30 e 31
# caindo em mês mais curto, com fevereiro bissexto (2028) e não-bissexto (2027);
# os cenários de 2 e 3 meses discriminam "ajusta a cada mês" de "ajusta uma vez
# só, no destino"; e o valor fracionário captura a multiplicação em ponto
# flutuante do legado, que não arredonda.
# (id, data_inicio_locacao, prazo_meses, valor_mensal)
CENARIOS_ATIVACAO_DERIVACAO = (
    ("controle_dia_seguro_doze_meses", "2027-01-15", 12, 1500.0),
    ("dia_vinte_e_nove_para_fevereiro_nao_bissexto", "2027-01-29", 1, 1500.0),
    ("dia_vinte_e_nove_para_fevereiro_bissexto", "2028-01-29", 1, 1500.0),
    ("dia_trinta_para_fevereiro_nao_bissexto", "2027-01-30", 1, 1500.0),
    ("dia_trinta_para_fevereiro_bissexto", "2028-01-30", 1, 1500.0),
    ("dia_trinta_e_um_para_fevereiro_nao_bissexto", "2027-01-31", 1, 1500.0),
    ("dia_trinta_e_um_para_fevereiro_bissexto", "2028-01-31", 1, 1500.0),
    ("dia_trinta_e_um_dois_meses_atravessando_fevereiro", "2027-01-31", 2, 1500.0),
    ("dia_vinte_e_nove_tres_meses_para_mes_de_trinta_dias", "2027-01-29", 3, 1500.0),
    ("dia_trinta_tres_meses_para_mes_de_trinta_dias", "2027-01-30", 3, 1500.0),
    ("dia_trinta_e_um_tres_meses_para_mes_de_trinta_dias", "2027-01-31", 3, 1500.0),
    ("dia_trinta_e_um_um_mes_para_mes_de_trinta_dias", "2027-03-31", 1, 1500.0),
    ("dia_trinta_e_um_doze_meses_sem_ajuste", "2027-01-31", 12, 1500.0),
    ("dia_trinta_e_um_treze_meses_para_fevereiro_bissexto", "2027-01-31", 13, 1500.0),
    ("dia_trinta_e_um_seis_meses_para_fevereiro_bissexto", "2027-08-31", 6, 1500.0),
    ("dia_trinta_e_um_seis_meses_para_fevereiro_nao_bissexto", "2026-08-31", 6, 1500.0),
    ("vinte_e_nove_de_fevereiro_bissexto_mais_doze_meses", "2028-02-29", 12, 1500.0),
    ("valor_mensal_fracionario_tres_meses", "2027-01-15", 3, 1333.33),
)

# `montar_dados_cobrancas_contrato` avança o mês com `add_months(data_atual, 1)`
# EM CADA VOLTA, e não `add_months(inicio, n)`. Começar no dia 31 mostra o ajuste
# ACUMULANDO — insumo arquivado para a F3, que é quem implementa a montagem.
# (id, data_inicio_locacao, prazo_meses, dia_vencimento, valor_mensal)
CENARIOS_ATIVACAO_COBRANCAS = (
    ("dia_seguro_tres_meses", "2027-01-15", 3, 10, 1500.0),
    ("inicio_no_dia_trinta_e_um_quatro_meses", "2027-01-31", 4, 28, 1500.0),
    ("inicio_no_dia_trinta_e_um_treze_meses", "2027-01-31", 13, 5, 1000.0),
)

# (id, imovel, contrato, contrato_ativo_previo, status_locacao_previo)
CENARIOS_ATIVACAO_IMOVEL = (
    ("imovel_livre", "IMOVEL-CARACT-ATV-01", "CTR-CARACT-ATV-01", "", "Disponível"),
    (
        "imovel_com_o_mesmo_contrato",
        "IMOVEL-CARACT-ATV-02",
        "CTR-CARACT-ATV-02",
        "CTR-CARACT-ATV-02",
        "Locado",
    ),
    (
        "imovel_com_outro_contrato",
        "IMOVEL-CARACT-ATV-03",
        "CTR-CARACT-ATV-03",
        "CTR-CARACT-ATV-OUTRO",
        "Locado",
    ),
)


def documento_de_ativacao(nome, sobrescritas):
    """Documento EM MEMÓRIA, deliberadamente não inserido.

    `validar_contrato_para_ativacao` e `montar_dados_cobrancas_contrato` só leem o
    documento (`contrato.get(...)`, `contrato.name`) e não tocam o banco. Inserir
    trinta contratos degenerados — sem data de início, sem locatário — só para
    tornar a leitura possível acrescentaria o Server Script de PDF ao caminho e
    poria estado sintético inválido no site sem que a regra capturada ganhasse
    nada.
    """
    dados = dict(BASE_CONTRATO_ATIVACAO)
    dados["name"] = nome
    dados.update(sobrescritas)
    return frappe.get_doc(dados)


def capturar_ativacao_validacao():
    from locacao_automation.contrato_ativacao.service import validar_contrato_para_ativacao

    cenarios = []
    for chave, sobrescritas in CENARIOS_ATIVACAO_VALIDACAO:
        documento = documento_de_ativacao("CTR-CARACT-ATV-VALIDACAO", sobrescritas)
        cenarios.append({
            "id": chave,
            "entrada": {campo: documento.get(campo) for campo in CAMPOS_LIDOS_NA_VALIDACAO},
            "resultado": executar_capturando_recusa(
                validar_contrato_para_ativacao, documento
            ),
        })
    return cenarios


def capturar_ativacao_derivacao():
    from locacao_automation.contrato_ativacao.service import validar_contrato_para_ativacao

    cenarios = []
    for chave, inicio, prazo, valor_mensal in CENARIOS_ATIVACAO_DERIVACAO:
        documento = documento_de_ativacao("CTR-CARACT-ATV-DERIVACAO", {
            "data_inicio_locacao": inicio,
            "prazo_meses": prazo,
            "valor_mensal": valor_mensal,
        })
        cenarios.append({
            "id": chave,
            "entrada": {
                "data_inicio_locacao": inicio,
                "prazo_meses": prazo,
                "valor_mensal": valor_mensal,
            },
            "resultado": executar_capturando_recusa(
                validar_contrato_para_ativacao, documento
            ),
        })
    return cenarios


def capturar_ativacao_cobrancas():
    from locacao_automation.contrato_ativacao.service import montar_dados_cobrancas_contrato

    cenarios = []
    for chave, inicio, prazo, dia_vencimento, valor_mensal in CENARIOS_ATIVACAO_COBRANCAS:
        documento = documento_de_ativacao("CTR-CARACT-ATV-COBRANCAS", {
            "data_inicio_locacao": inicio,
            "prazo_meses": prazo,
            "dia_vencimento": dia_vencimento,
            "valor_mensal": valor_mensal,
        })
        cenarios.append({
            "id": chave,
            "entrada": {
                "data_inicio_locacao": inicio,
                "prazo_meses": prazo,
                "dia_vencimento": dia_vencimento,
                "valor_mensal": valor_mensal,
            },
            "resultado": executar_capturando_recusa(
                montar_dados_cobrancas_contrato, documento
            ),
        })
    return cenarios


def capturar_ativacao_fluxo():
    """`ativar_imovel_contrato` + `ativar_contrato` sobre documentos PERSISTIDOS.

    Estes dois escrevem no banco (`db_set`), então aqui o documento em memória não
    serve: o que se captura é justamente o efeito no imóvel e no contrato.
    """
    from locacao_automation.contrato_ativacao.service import (
        ativar_contrato,
        ativar_imovel_contrato,
        validar_contrato_para_ativacao,
    )

    campos_imovel = ["status_locacao", "contrato_ativo"]
    campos_contrato = [
        "status_contrato", "data_inicio_locacao", "prazo_meses",
        "valor_mensal", "data_fim_locacao", "valor_total_contrato",
    ]

    for indice, (_chave, imovel, contrato, ativo_previo, status_previo) in enumerate(
        CENARIOS_ATIVACAO_IMOVEL, start=1
    ):
        inserir(
            imovel_dict(imovel, "ATV-00" + str(indice),
                        [{"nome_comodo": "Sala", "metragem": 28.0}],
                        status=status_previo),
            ignorar_obrigatorios=True,
        )
        inserir({
            "doctype": "Contrato",
            "name": contrato,
            "imovel": imovel,
            "locador": "LOCADOR-CARACT",
            "locatario": "LOCATARIO-CARACT",
            # Dia 31 de propósito: o fluxo persistido também exibe a virada de mês,
            # e não só os cenários em memória.
            "data_inicio_locacao": "2027-01-31",
            "prazo_meses": 13,
            "valor_mensal": 1750.0,
            "dia_vencimento": 12,
            "status_contrato": "Rascunho",
            "gerar_cobrancas_automaticamente": 0,
        }, ignorar_obrigatorios=True)
        if ativo_previo:
            # Escrita direta pela mesma razão da fase D: reabrir o `Imovel`
            # reexecutaria a regra de metragem, que não é o objeto desta fase.
            frappe.db.set_value("Imovel", imovel, "contrato_ativo", ativo_previo,
                                update_modified=False)
    frappe.db.commit()

    cenarios = []
    for chave, imovel, contrato, ativo_previo, status_previo in CENARIOS_ATIVACAO_IMOVEL:
        documento = frappe.get_doc("Contrato", contrato)
        resultado_imovel = executar_capturando_recusa(ativar_imovel_contrato, documento)

        resultado_contrato = None
        if resultado_imovel["aceito"]:
            resultado_contrato = executar_capturando_recusa(
                ativar_contrato, documento, validar_contrato_para_ativacao(documento)
            )
        frappe.db.commit()

        cenarios.append({
            "id": chave,
            "entrada": {
                "contrato": contrato,
                "imovel": imovel,
                "imovel_status_locacao": status_previo,
                "imovel_contrato_ativo": ativo_previo,
            },
            "resultado_ativar_imovel_contrato": resultado_imovel,
            "resultado_ativar_contrato": resultado_contrato,
            "estado_resultante": {
                "imovel": dict(
                    frappe.db.get_value("Imovel", imovel, campos_imovel, as_dict=True),
                    name=imovel,
                ),
                "contrato": dict(
                    frappe.db.get_value("Contrato", contrato, campos_contrato, as_dict=True),
                    name=contrato,
                ),
            },
        })
    return cenarios


def capturar_contrato_ativacao():
    """Agrega as quatro frentes da regra de ativação num artefato só.

    A forma canônica dos golden — `entrada` / `retorno` / `estado_resultante` — é
    preservada: `entrada` reúne os cenários de cada frente, `retorno` reúne o que
    cada função devolveu (aceite ou recusa) e `estado_resultante` só existe para a
    frente que de fato escreve no banco. As três primeiras frentes são funções
    puras sobre o documento e não têm estado a registrar; dizer isso
    explicitamente é o que impede a leitura de que o registro ficou faltando.
    """
    validacao = capturar_ativacao_validacao()
    derivacao = capturar_ativacao_derivacao()
    cobrancas = capturar_ativacao_cobrancas()
    fluxo = capturar_ativacao_fluxo()

    return {
        "regra": "ativação de contrato",
        "modulo": "locacao_automation.contrato_ativacao.service",
        "funcoes": [
            "validar_contrato_para_ativacao",
            "ativar_imovel_contrato",
            "ativar_contrato",
            "montar_dados_cobrancas_contrato",
        ],
        "entrada": {
            "validacao": [
                {"id": item["id"], "contrato": item["entrada"]} for item in validacao
            ],
            "derivacao": [
                {"id": item["id"], "contrato": item["entrada"]} for item in derivacao
            ],
            "cobrancas": [
                {"id": item["id"], "contrato": item["entrada"]} for item in cobrancas
            ],
            "fluxo": [
                {"id": item["id"], "contrato": item["entrada"]} for item in fluxo
            ],
        },
        "retorno": {
            "validacao": [
                {"id": item["id"], "resultado": item["resultado"]} for item in validacao
            ],
            "derivacao": [
                {"id": item["id"], "resultado": item["resultado"]} for item in derivacao
            ],
            "cobrancas": [
                {"id": item["id"], "resultado": item["resultado"]} for item in cobrancas
            ],
            "fluxo": [
                {
                    "id": item["id"],
                    "ativar_imovel_contrato": item["resultado_ativar_imovel_contrato"],
                    "ativar_contrato": item["resultado_ativar_contrato"],
                }
                for item in fluxo
            ],
        },
        "estado_resultante": {
            "sem_efeito_no_banco": ["validacao", "derivacao", "cobrancas"],
            "fluxo": [
                {"id": item["id"], **item["estado_resultante"]} for item in fluxo
            ],
        },
    }


# --------------------------------------------------------------------------- #
# Fase G — cancelar_contrato()
# --------------------------------------------------------------------------- #
# (name, offset de vencimento, valor original, status inicial)
#
# `Paga` e `Cancelada` estão aqui para provar o filtro nos DOIS sentidos: sem
# elas, "cancelou as duas canceláveis" seria indistinguível de "cancelou tudo".
ENTRADA_CANCELAMENTO_COBRANCAS = (
    ("COB-CARACT-CAN-01", -20, 1200.00, "Pendente"),
    ("COB-CARACT-CAN-02", -50, 1300.00, "Vencida"),
    ("COB-CARACT-CAN-03", 10, 1400.00, "Paga"),
    ("COB-CARACT-CAN-04", 40, 1500.00, "Cancelada"),
)

CONTRATO_CANCELAMENTO = "CTR-CARACT-CAN-01"
CONTRATO_CANCELAMENTO_SEM_PDF = "CTR-CARACT-CAN-SEM-PDF"
CONTRATO_CANCELAMENTO_SEM_IMOVEL = "CTR-CARACT-CAN-SEM-IMOVEL"

# (contrato, imóvel, identificador municipal). O identificador é escrito por
# extenso em vez de derivado da posição na tupla: com índice, reordenar a lista
# renomearia documentos sintéticos e o golden mudaria sem que regra alguma tivesse
# mudado.
ENTRADA_CANCELAMENTO_CONTRATOS = (
    (CONTRATO_CANCELAMENTO, "IMOVEL-CARACT-CAN-01", "CAN-001"),
    (CONTRATO_CANCELAMENTO_SEM_IMOVEL, "", ""),
    (CONTRATO_CANCELAMENTO_SEM_PDF, "IMOVEL-CARACT-CAN-02", "CAN-002"),
)

CAMPOS_COBRANCA_CANCELAMENTO = ("status_cobranca", "data_vencimento",
                                "valor_original", "boleto_gerado", "nosso_numero")

CAMPOS_CONTRATO_CANCELAMENTO = ("status_contrato", "imovel", "pdf_contrato",
                                "pdf_contrato_arquivo")


def contrato_de_cancelamento(nome, imovel):
    return {
        "doctype": "Contrato",
        "name": nome,
        "imovel": imovel,
        "locador": "LOCADOR-CARACT",
        "locatario": "LOCATARIO-CARACT",
        "data_inicio_locacao": "2027-01-15",
        "prazo_meses": 12,
        "data_fim_locacao": "2028-01-14",
        "valor_mensal": 1200.0,
        "valor_total_contrato": 14400.0,
        "status_contrato": "Ativo",
        "dia_vencimento": 10,
        "gerar_cobrancas_automaticamente": 0,
    }


def estado_do_contrato_cancelamento(nome):
    valores = frappe.db.get_value(
        "Contrato", nome, list(CAMPOS_CONTRATO_CANCELAMENTO), as_dict=True
    )
    return {
        "name": nome,
        "status_contrato": valores["status_contrato"],
        "imovel": valores["imovel"],
        "pdf_contrato": mascarar_se_presente(valores["pdf_contrato"],
                                             MARCADOR_PDF_CONTRATO),
        "pdf_contrato_arquivo": mascarar_se_presente(valores["pdf_contrato_arquivo"],
                                                     MARCADOR_ARQUIVO_PDF),
    }


def estado_do_imovel_cancelamento(nome):
    return dict(
        frappe.db.get_value("Imovel", nome, ["status_locacao", "contrato_ativo"],
                            as_dict=True),
        name=nome,
    )


def estado_da_cobranca_cancelamento(nome, hoje):
    valores = frappe.db.get_value(
        "Cobranca", nome, list(CAMPOS_COBRANCA_CANCELAMENTO), as_dict=True
    )
    return {
        "name": nome,
        "status_cobranca": valores["status_cobranca"],
        "vencimento_offset_dias": offset_de(valores["data_vencimento"], hoje),
        "valor_original": valores["valor_original"],
        "boleto_gerado": valores["boleto_gerado"],
        "nosso_numero": valores["nosso_numero"],
    }


def capturar_contrato_cancelamento(hoje):
    from locacao_automation.contrato_cancelamento.service import cancelar_contrato

    contratos = [contrato for contrato, _, _ in ENTRADA_CANCELAMENTO_CONTRATOS]
    imoveis = [imovel for _, imovel, _ in ENTRADA_CANCELAMENTO_CONTRATOS if imovel]

    for contrato, imovel, identificador in ENTRADA_CANCELAMENTO_CONTRATOS:
        if imovel:
            inserir(
                imovel_dict(imovel, identificador,
                            [{"nome_comodo": "Sala", "metragem": 22.0}],
                            status="Locado"),
                ignorar_obrigatorios=True,
            )
        inserir(contrato_de_cancelamento(contrato, imovel), ignorar_obrigatorios=True)
        if imovel:
            frappe.db.set_value("Imovel", imovel, "contrato_ativo", contrato,
                                update_modified=False)

    # Precondição do cenário `sem_pdf`: o Server Script "PDF contrato" anexa o
    # documento no After Save de TODO contrato, então a ausência de PDF só existe
    # se for produzida. Zerar os dois campos é montar a precondição pelo estado
    # real do banco — nenhum parâmetro de simulação entra na regra.
    frappe.db.set_value(
        "Contrato", CONTRATO_CANCELAMENTO_SEM_PDF,
        {"pdf_contrato": None, "pdf_contrato_arquivo": None},
        update_modified=False,
    )

    # Precondição do cenário `sem_imovel`: a guarda de imóvel vem DEPOIS da guarda
    # de PDF. Sem garantir o PDF, o cenário recusaria pela primeira guarda e a
    # segunda ficaria sem oráculo — o defeito clássico de provar o que é fácil.
    pdf_de_referencia = frappe.db.get_value("Contrato", CONTRATO_CANCELAMENTO,
                                            "pdf_contrato")
    if not pdf_de_referencia:
        raise RuntimeError(
            "Contrato " + CONTRATO_CANCELAMENTO + " salvo sem PDF — o Server "
            "Script 'PDF contrato' não produziu o documento e os cenários de "
            "cancelamento não teriam precondição."
        )
    frappe.db.set_value("Contrato", CONTRATO_CANCELAMENTO_SEM_IMOVEL,
                        "pdf_contrato", pdf_de_referencia, update_modified=False)

    for name, off_venc, valor, status in ENTRADA_CANCELAMENTO_COBRANCAS:
        inserir(cobranca_dict(name, off_venc, valor, status,
                              contrato=CONTRATO_CANCELAMENTO))
    frappe.db.commit()

    # A entrada é LIDA do banco, e não repetida a partir do que se pretendeu
    # gravar: `boleto_gerado` e `nosso_numero` decidem se a baixa Sicoob é
    # solicitada ou ignorada, e afirmá-los sem ler seria registrar a intenção no
    # lugar do fato.
    entrada_cobrancas = [
        estado_da_cobranca_cancelamento(name, hoje)
        for name, _, _, _ in ENTRADA_CANCELAMENTO_COBRANCAS
    ]
    entrada_contratos = [estado_do_contrato_cancelamento(nome) for nome in contratos]
    entrada_imoveis = [estado_do_imovel_cancelamento(imovel) for imovel in imoveis]

    # Recusas primeiro: cada uma é conferida com o estado ainda intacto, e a ordem
    # das guardas fica registrada pelas mensagens.
    recusas = [
        {"id": "parametro_vazio", "argumento": "",
         "resultado": executar_capturando_recusa(cancelar_contrato, "")},
        {"id": "contrato_sem_pdf", "argumento": CONTRATO_CANCELAMENTO_SEM_PDF,
         "resultado": executar_capturando_recusa(
             cancelar_contrato, CONTRATO_CANCELAMENTO_SEM_PDF)},
        {"id": "contrato_sem_imovel", "argumento": CONTRATO_CANCELAMENTO_SEM_IMOVEL,
         "resultado": executar_capturando_recusa(
             cancelar_contrato, CONTRATO_CANCELAMENTO_SEM_IMOVEL)},
    ]
    frappe.db.commit()

    resultado = executar_capturando_recusa(cancelar_contrato, CONTRATO_CANCELAMENTO)
    frappe.db.commit()

    retorno = dict(resultado)
    if retorno.get("aceito"):
        corpo = dict(retorno["retorno"])
        corpo["pdf_contrato_arquivo"] = mascarar_se_presente(
            corpo.get("pdf_contrato_arquivo"), MARCADOR_ARQUIVO_PDF
        )
        corpo["pdf_contrato"] = mascarar_se_presente(
            corpo.get("pdf_contrato"), MARCADOR_PDF_CONTRATO
        )
        retorno["retorno"] = corpo

    return {
        "regra": "cancelar_contrato",
        "modulo": "locacao_automation.contrato_cancelamento.service",
        "entrada": {
            "contratos": entrada_contratos,
            "imoveis": entrada_imoveis,
            "cobrancas": entrada_cobrancas,
        },
        "recusas": recusas,
        "retorno": retorno,
        "estado_resultante": {
            "contratos": [estado_do_contrato_cancelamento(nome) for nome in contratos],
            "imoveis": [estado_do_imovel_cancelamento(imovel) for imovel in imoveis],
            "cobrancas": [
                estado_da_cobranca_cancelamento(name, hoje)
                for name, _, _, _ in ENTRADA_CANCELAMENTO_COBRANCAS
            ],
        },
    }


# --------------------------------------------------------------------------- #
# Fase H — régua de cobrança (`cobranca_automation`)
#
# ORDEM É DECISÃO, e é a mesma das fases F e G, por uma razão nova: o `SELECT` do
# `runner.py` NÃO filtra por contrato — ele varre toda cobrança em aberto do site.
# Rodar a régua antes poria as cobranças dela dentro do conjunto que
# `marcar_cobrancas_vencidas`, `encerrar_contratos_vencidos` e
# `atualizar_atrasos_cobrancas` varrem, e os seis artefatos daquelas fases são de
# fatia FECHADA.
#
# A contrapartida é declarada, não escondida: ao chegar aqui o site já tem
# cobranças das fases anteriores, e parte delas continua em aberto. Elas ENTRAM no
# `SELECT` da régua — é assim que a régua se comporta contra uma carteira real —, e
# o golden as registra em `entrada.carteira_herdada`, separadas dos cenários
# próprios. Inventar isolamento aqui exigiria apagar ou adulterar cobrança de fase
# anterior, e o `verificar-captura.sh` confere o estado daquelas cobranças no site
# depois da captura.
# --------------------------------------------------------------------------- #
DOCTYPE_CFG_REGUA = "Automacao Cobranca Config"
DOCTYPE_LOG_REGUA = "Log Envio Cobranca"

# Nível efetivamente alcançado da ordem de queda do D5 (tech alignment):
#   1 = despachante substituído dentro do processo, percurso completo executando
#   2 = servidor de recebimento local que aceita e descarta
#   3 = piso — só as frentes que não produzem envio
NIVEL_DA_ORDEM_DE_QUEDA = 1

# Os DOIS call sites do despachante do arcabouço dentro da régua legada, nomeados
# um a um. A substituição é uma atribuição só — ela cobre os dois de uma vez —, e é
# exatamente por isso que os pontos precisam ser DECLARADOS: sem a lista, "cobre os
# dois" seria indistinguível de "cobre um", e o CT-502 não teria o que falsificar.
# O que fecha o par é o registrador ler a origem do QUADRO CHAMADOR: a lista abaixo
# é a expectativa, e `despacho.pontos_substituidos` do golden é o que foi observado.
PONTOS_DE_DESPACHO_ESPERADOS = (
    "emailer.py:203",
    "emailer.py:251",
)

# Configuração da régua imposta pela captura. Os dois horários são "00:00:00" por
# DETERMINISMO, não por conveniência: `is_hora_execucao` compara o relógio da
# execução com o horário configurado, e com "09:00" uma captura das 03h não entraria
# em bloco nenhum — o golden mudaria conforme a hora do dia em que a captura rodasse.
# A janela de horário não fica sem oráculo por isso: ela é capturada à parte, como
# função pura, com o "agora" passado explicitamente.
CONFIGURACAO_DA_REGUA = (
    ("ativo", 1),
    ("nao_enviar_a_vencer", 0),
    ("dias_antes_vencimento", 10),
    ("intervalo_dias_a_vencer", 3),
    ("horario_a_vencer", "00:00:00"),
    ("canal_a_vencer", "ambos"),
    ("intervalo_dias_vencida", 2),
    ("horario_vencida", "00:00:00"),
    ("canal_vencida", "ambos"),
)

CAMPOS_CFG_REGUA = tuple(campo for campo, _ in CONFIGURACAO_DA_REGUA)

# (id, name, offset de vencimento, valor original, status, pagamento_confirmado)
#
# Os quatro últimos existem para DISCRIMINAR, não para somar: `pagamento_confirmado`
# e `cobranca_paga` são os dois eixos do filtro do `SELECT`, `cancelada_e_vencida` é
# o cenário que separa os dois resolvedores de estado, e `sem_locatario` é o único
# ramo de recusa de `enviar_email_automacao` alcançável sem mexer no vencimento.
CENARIOS_REGUA_COBRANCAS = (
    ("a_vencer_dentro_da_janela", "COB-CARACT-REG-01", 5, 1100.00, "Pendente", 0),
    ("a_vencer_fora_da_janela", "COB-CARACT-REG-02", 40, 1200.00, "Pendente", 0),
    ("vencida_sem_envio_previo", "COB-CARACT-REG-03", -12, 1300.00, "Vencida", 0),
    ("vencida_com_envio_recente", "COB-CARACT-REG-04", -20, 1400.00, "Vencida", 0),
    ("vencida_com_envio_antigo", "COB-CARACT-REG-05", -30, 1500.00, "Vencida", 0),
    ("cobranca_com_pagamento_confirmado", "COB-CARACT-REG-06", -8, 1600.00, "Pendente", 1),
    ("cobranca_paga", "COB-CARACT-REG-07", -15, 1700.00, "Paga", 0),
    ("cobranca_cancelada_e_vencida", "COB-CARACT-REG-08", -25, 1800.00, "Cancelada", 0),
    ("cobranca_sem_locatario", "COB-CARACT-REG-09", 3, 1900.00, "Pendente", 0),
    ("vencida_com_envio_de_prefixo_legado", "COB-CARACT-REG-10", -18, 2000.00, "Vencida", 0),
)

COBRANCA_SEM_LOCATARIO = "COB-CARACT-REG-09"

PREFIXO_REQUISICAO_VENCIDA = "REQ-AUTO-VC-"
PREFIXO_REQUISICAO_A_VENCER = "REQ-AUTO-AV-"
PREFIXO_REQUISICAO_LEGADO = "REQ-AUTO-EMAIL-"

# (name, fatura, prefixo do request_id, offset de dias do envio, status)
#
# O log de status `Erro` não é enfeite: `get_ultimo_envio_sucesso` filtra por
# `status = "Sucesso"`, e sem uma linha de erro recente "a trava olha só o sucesso"
# ficaria sem contraprova — um filtro de status removido continuaria passando.
CENARIOS_REGUA_HISTORICO = (
    ("LOG-CARACT-REG-01", "COB-CARACT-REG-04", PREFIXO_REQUISICAO_VENCIDA, -1, "Sucesso"),
    ("LOG-CARACT-REG-02", "COB-CARACT-REG-05", PREFIXO_REQUISICAO_VENCIDA, -10, "Sucesso"),
    ("LOG-CARACT-REG-03", "COB-CARACT-REG-10", PREFIXO_REQUISICAO_LEGADO, -1, "Sucesso"),
    ("LOG-CARACT-REG-04", "COB-CARACT-REG-01", PREFIXO_REQUISICAO_A_VENCER, -1, "Erro"),
)

# (id, valor recebido, fallback) — `normalize_hhmm`
CENARIOS_REGUA_NORMALIZE_HHMM = (
    ("vazio_cai_no_fallback", "", "09:00"),
    ("hora_e_minuto_com_um_digito", "7:5", "09:00"),
    ("datetime_com_espaco", "2026-01-15 14:30:00", "09:00"),
    ("datetime_com_t", "2026-01-15T14:30:00", "09:00"),
    ("sem_separador_cai_no_fallback", "0930", "09:00"),
    ("hora_acima_do_limite", "25:00", "09:00"),
    ("minuto_acima_do_limite", "10:75", "09:00"),
    ("limite_superior_aceito", "23:59", "09:00"),
)

# (id, agora, horário configurado) — `is_hora_execucao`
CENARIOS_REGUA_HORA_EXECUCAO = (
    ("antes_do_horario", "08:59", "09:00"),
    ("no_minuto_do_horario", "09:00", "09:00"),
    ("depois_do_horario", "23:59", "09:00"),
)

# (id, fatura, intervalo em dias, tipo) — `pode_enviar_por_intervalo`
CENARIOS_REGUA_INTERVALO = (
    ("sem_historico_libera", "COB-CARACT-REG-03", 2, "Vencida"),
    ("envio_recente_bloqueia", "COB-CARACT-REG-04", 2, "Vencida"),
    ("envio_antigo_libera", "COB-CARACT-REG-05", 2, "Vencida"),
    ("prefixo_legado_conta_para_vencida", "COB-CARACT-REG-10", 2, "Vencida"),
    ("prefixo_legado_nao_conta_para_a_vencer", "COB-CARACT-REG-10", 2, "A vencer"),
    ("envio_com_erro_nao_bloqueia", "COB-CARACT-REG-01", 3, "A vencer"),
)

CAMPOS_ESTADO_COBRANCA_REGUA = ("status_cobranca", "data_vencimento", "valor_original",
                                "valor_total", "pagamento_confirmado", "locatario")

RE_DATA_VENCIMENTO_BR = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")
RE_RESUMO_AGORA = re.compile(r"agora=\d{1,2}:\d{2}")
RE_RESUMO_HOJE = re.compile(r"hoje=\d{4}-\d{2}-\d{2}")
RE_PREFIXO_REQUISICAO = re.compile(r"^(REQ-[A-Z]+(?:-[A-Z]+)*-)")


def mascarar_corpo_da_mensagem(texto):
    """A data de vencimento entra no corpo já formatada em `dd/MM/yyyy`.

    Ela é ABSOLUTA e deriva de `nowdate()` pelo offset do cenário: sem a máscara o
    corpo mudaria todo dia, e o golden da régua expiraria em 24 horas. O offset
    continua registrado em `entrada.cobrancas[].vencimento_offset_dias`, que é o
    que a F5 usa para reconstruir o cenário.
    """
    return RE_DATA_VENCIMENTO_BR.sub(MARCADOR_DATA_VENCIMENTO, texto)


def mascarar_resumo_da_execucao(texto):
    """Mascara SÓ os dois campos voláteis do resumo do `runner.py`.

    `agora=` é o relógio e `hoje=` é a data — os dois derivam da execução. Os
    demais `HH:MM` do resumo (`horario_a_vencer=`, `horario_vencida=`) são
    CONFIGURAÇÃO e fazem parte do oráculo: uma máscara larga sobre `\\d{2}:\\d{2}`
    os apagaria e o golden deixaria de registrar com que janela a régua rodou.
    """
    texto = RE_RESUMO_AGORA.sub("agora=" + MARCADOR_HORA_EXECUCAO, texto)
    return RE_RESUMO_HOJE.sub("hoje=" + MARCADOR_DATA_EXECUCAO, texto)


def prefixo_de_requisicao(request_id):
    casamento = RE_PREFIXO_REQUISICAO.match(str(request_id or ""))
    return casamento.group(1) if casamento else str(request_id or "")


class RegistradorDeDespacho(object):
    """Substitui o despachante do arcabouço: registra em memória e NÃO despacha.

    É o nível 1 da ordem de queda do D5. O percurso inteiro da régua executa — a
    seleção, a janela, a trava de intervalo, a resolução do template e a montagem
    do corpo —, e o único elo que não acontece é a saída da mensagem.

    A ORIGEM de cada mensagem sai do quadro chamador (`arquivo:linha`), e não de um
    parâmetro que a captura passasse: é isso que faz de "os dois pontos de despacho
    foram exercitados" um fato OBSERVADO. O mesmo quadro entrega a cobrança em curso
    (`cobranca` é o nome do parâmetro nos dois pontos), que é o que permite atribuir
    cada mensagem ao cenário que a produziu — sem essa atribuição, `1 mensagem no
    manual e 0 no automático` seria incontável.
    """

    def __init__(self):
        self.mensagens = []

    def __call__(self, recipients=None, subject=None, message=None, **_ignorados):
        quadro = sys._getframe(1)
        alvo = recipients[0] if isinstance(recipients, (list, tuple)) and recipients else recipients
        cobranca = quadro.f_locals.get("cobranca")
        self.mensagens.append({
            "origem": os.path.basename(quadro.f_code.co_filename) + ":" + str(quadro.f_lineno),
            "funcao": quadro.f_code.co_name,
            "cobranca": str(getattr(cobranca, "name", "") or ""),
            "destinatario": str(alvo or ""),
            "assunto": str(subject or ""),
            "corpo": mascarar_corpo_da_mensagem(str(message or "")),
        })
        return None

    def mensagens_de(self, cobranca, funcao):
        return [
            mensagem for mensagem in self.mensagens
            if mensagem["cobranca"] == cobranca and mensagem["funcao"] == funcao
        ]


class SentinelaDeDespachoReal(object):
    """Conta — e aborta — qualquer tentativa de despacho REAL durante a captura.

    O contador não observa a função substituída: quem foi substituído não é mais
    alcançável pelo nome, e contá-lo seria tautologia. Ele observa o EFEITO que o
    despachante produziria, no gargalo por onde todo envio do arcabouço passa
    obrigatoriamente — a abertura da conexão SMTP. Se a substituição não pegasse,
    a fila de e-mail do arcabouço seria processada e a conexão apareceria aqui.
    """

    def __init__(self):
        self.invocacoes = 0

    def __call__(self, *_args, **_ignorados):
        self.invocacoes += 1
        raise RuntimeError(
            "tentativa de despacho real interceptada durante a captura — a "
            "substituição do despachante não alcançou algum caminho de envio"
        )


# ---- SUBSTITUICAO-DO-DESPACHANTE: INICIO ----
# Único ponto do arquivo em que o despachante do arcabouço é nomeado em posição
# executável. O CT-502 audita esta fronteira estaticamente: fora daqui e fora de
# comentário, a contagem do nome tem de ser zero — senão haveria um segundo caminho
# capaz de despachar, e a substituição deixaria de ser uma barreira única.
def instalar_substituicao_do_despacho(registrador, sentinela):
    frappe_sendmail_original = frappe.sendmail
    frappe.sendmail = registrador
    smtp_original, smtp_ssl_original = smtplib.SMTP, smtplib.SMTP_SSL
    smtplib.SMTP = sentinela
    smtplib.SMTP_SSL = sentinela
    return (frappe_sendmail_original, smtp_original, smtp_ssl_original)


def desfazer_substituicao_do_despacho(originais):
    frappe.sendmail, smtplib.SMTP, smtplib.SMTP_SSL = originais
# ---- SUBSTITUICAO-DO-DESPACHANTE: FIM ----


def purgar_estado_de_envio():
    """Fecha o conjunto de histórico e de fila ANTES de semear os cenários.

    O site efêmero é restaurado do dump, e o dump traz dezenas de `Log Envio
    Cobranca` e de `Email Queue` reais. Sem a purga, `pode_enviar_por_intervalo`
    ficaria sujeito a log de produção e a contagem final da fila do arcabouço não
    poderia afirmar coisa alguma sobre ESTA execução. Nenhuma fase anterior lê
    essas duas tabelas, então a purga é acréscimo puro.
    """
    for tabela in (DOCTYPE_LOG_REGUA, "Email Queue Recipient", "Email Queue"):
        if frappe.db.exists("DocType", tabela):
            frappe.db.sql("DELETE FROM `tab{0}`".format(tabela))
    frappe.db.commit()


def configurar_regua():
    doc_cfg = frappe.get_doc(DOCTYPE_CFG_REGUA, DOCTYPE_CFG_REGUA)
    for campo, valor in CONFIGURACAO_DA_REGUA:
        doc_cfg.set(campo, valor)
    # Zerado para que o carimbo lido no `estado_resultante` seja o desta execução,
    # e não o que sobrou do dump de produção.
    doc_cfg.ultima_execucao_em = None
    doc_cfg.ultimo_status_execucao = None
    doc_cfg.ultimo_erro_execucao = None
    doc_cfg.save(ignore_permissions=True)
    frappe.db.commit()


def ler_configuracao_da_regua():
    """Lê do banco o que a régua vai enxergar — o fato, não a intenção da captura."""
    doc_cfg = frappe.get_doc(DOCTYPE_CFG_REGUA, DOCTYPE_CFG_REGUA)
    return {campo: str(doc_cfg.get(campo)) for campo in CAMPOS_CFG_REGUA}


def log_de_envio_dict(name, fatura, prefixo, offset_dias, status):
    return {
        "doctype": DOCTYPE_LOG_REGUA,
        "name": name,
        "fatura_id": fatura,
        "locatario": "LOCATARIO-CARACT",
        "locatario_nome": "Joao Locatario",
        "canal": "email",
        "tipo_envio": "automacao",
        "status": status,
        "erro": None,
        # Sem carimbo de relógio no identificador: o do legado embute
        # `now()` e duas capturas nunca coincidiriam. O que a trava de intervalo
        # observa é o PREFIXO, e ele é preservado inteiro.
        "request_id": prefixo + "CARACT",
        "data_envio": add_days(nowdate(), offset_dias) + " 09:00:00",
    }


def semear_cenarios_da_regua():
    for _id, name, off_venc, valor, status, pago in CENARIOS_REGUA_COBRANCAS:
        inserir(cobranca_dict(name, off_venc, valor, status, pagamento_confirmado=pago))
    # Escrita direta pela mesma razão das fases D e F: o campo é obrigatório na
    # interface, e o caminho que a régua precisa exibir é justamente o do vínculo
    # ausente. Nenhuma bandeira de simulação entra na regra.
    frappe.db.set_value("Cobranca", COBRANCA_SEM_LOCATARIO, "locatario", None,
                        update_modified=False)
    for name, fatura, prefixo, offset_dias, status in CENARIOS_REGUA_HISTORICO:
        inserir(log_de_envio_dict(name, fatura, prefixo, offset_dias, status))
    frappe.db.commit()


def estado_da_cobranca_regua(name, hoje):
    valores = frappe.db.get_value(
        "Cobranca", name, list(CAMPOS_ESTADO_COBRANCA_REGUA), as_dict=True
    )
    return {
        "name": name,
        "status_cobranca": valores["status_cobranca"],
        "vencimento_offset_dias": offset_de(valores["data_vencimento"], hoje),
        "valor_original": valores["valor_original"],
        "valor_total": valores["valor_total"],
        "pagamento_confirmado": valores["pagamento_confirmado"],
        "locatario": valores["locatario"],
    }


def carteira_herdada_das_fases_anteriores(hoje):
    """As cobranças que já estavam no site quando a régua rodou.

    Registradas com os DOIS campos que o filtro do `runner.py` observa. Sem esta
    lista, `rows_abertas=N` no resumo seria um número sem referente e o golden não
    permitiria reconstruir por que a régua escolheu quem escolheu.
    """
    nomes_da_regua = {name for _id, name, _o, _v, _s, _p in CENARIOS_REGUA_COBRANCAS}
    herdadas = []
    for linha in frappe.get_all("Cobranca", fields=["name"], order_by="name asc"):
        if linha["name"] in nomes_da_regua:
            continue
        herdadas.append(estado_da_cobranca_regua(linha["name"], hoje))
    return herdadas


def historico_de_envio_registrado(hoje):
    linhas = frappe.get_all(
        DOCTYPE_LOG_REGUA,
        fields=["fatura_id", "tipo_envio", "canal", "status", "erro", "request_id",
                "data_envio"],
    )
    registros = [
        {
            "fatura_id": linha["fatura_id"],
            "tipo_envio": linha["tipo_envio"],
            "canal": linha["canal"],
            "status": linha["status"],
            "erro": linha["erro"],
            "prefixo_request_id": prefixo_de_requisicao(linha["request_id"]),
            "envio_offset_dias": offset_de(linha["data_envio"], hoje),
        }
        for linha in linhas
    ]
    # Ordem estável por CONTEÚDO: o `name` destes documentos é sorteado pelo
    # arcabouço quando quem os cria é a própria régua, e ordenar por ele faria duas
    # capturas idênticas produzirem golden diferentes.
    registros.sort(key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True))
    return registros


def capturar_regua_janela_e_intervalo():
    from locacao_automation.cobranca_automation.core import pode_enviar_por_intervalo
    from locacao_automation.cobranca_automation.helpers import (
        is_hora_execucao,
        normalize_hhmm,
    )

    normalizacoes = [
        {"id": chave, "saida": normalize_hhmm(valor, fallback)}
        for chave, valor, fallback in CENARIOS_REGUA_NORMALIZE_HHMM
    ]
    horas = [
        {"id": chave, "saida": is_hora_execucao(agora, configurado)}
        for chave, agora, configurado in CENARIOS_REGUA_HORA_EXECUCAO
    ]
    intervalos = [
        {"id": chave, "saida": pode_enviar_por_intervalo(fatura, dias, tipo)}
        for chave, fatura, dias, tipo in CENARIOS_REGUA_INTERVALO
    ]
    return normalizacoes, horas, intervalos


def capturar_regua_templates(hoje):
    """`get_status_template` e o corpo montado, cenário a cenário.

    As duas frentes são puras e não tocam o banco além da leitura — por isso rodam
    ANTES da execução da régua, com o histórico ainda igual ao semeado.
    """
    from locacao_automation.cobranca_automation.core import get_status_template
    from locacao_automation.cobranca_automation.emailer import template_email

    cenarios = []
    for chave, name, _off, _valor, _status, _pago in CENARIOS_REGUA_COBRANCAS:
        documento = frappe.get_doc("Cobranca", name)
        tipo = get_status_template(documento, hoje)
        montado = template_email(documento, "Joao Locatario", tipo)
        cenarios.append({
            "id": chave,
            "name": name,
            "status_template": tipo,
            "assunto": montado["assunto"],
            "corpo": mascarar_corpo_da_mensagem(montado["mensagem"]),
        })
    return cenarios


def capturar_regua_divergencia(hoje, registrador):
    """O defeito de origem da fatia: dois resolvedores discordam sobre o mesmo fato.

    `get_status_template` (`core.py`) tem o ramo `Fechada`, que sai de
    `STATUS_FECHADA`; `get_status_template_manual` (`emailer.py`) não tem esse ramo
    e testa o vencimento antes de qualquer estado. A consequência medida é o
    cenário `cobranca_cancelada_e_vencida`: o caminho automático nunca a alcança
    (o `SELECT` do `runner.py` exclui `Cancelada`), e o manual monta o template
    `Vencida` e cobra por uma dívida cancelada — porque `is_cobranca_paga` conhece
    `Paga` e NÃO conhece `Cancelada`.

    O contraste que discrimina está ao lado, em `cobranca_paga`: ali o manual É
    barrado. Sem os dois cenários juntos, "o manual não filtra estado fechado"
    seria indistinguível de "o manual não filtra nada".
    """
    from locacao_automation.cobranca_automation.core import get_status_template
    from locacao_automation.cobranca_automation.emailer import (
        get_status_template_manual,
        is_cobranca_paga,
    )

    cenarios = []
    for chave, name, _off, _valor, _status, _pago in CENARIOS_REGUA_COBRANCAS:
        documento = frappe.get_doc("Cobranca", name)
        cenarios.append({
            "id": chave,
            "name": name,
            "template_automatico": get_status_template(documento, hoje),
            "template_manual": get_status_template_manual(documento),
            "is_cobranca_paga": is_cobranca_paga(documento),
            "mensagens_automatico": len(
                registrador.mensagens_de(name, "enviar_email_automacao")
            ),
            "mensagens_manual": len(
                registrador.mensagens_de(name, "enviar_email_manual")
            ),
        })
    return cenarios


def capturar_regua_automatico(registrador):
    from locacao_automation.cobranca_automation.runner import run_automation_real

    marca = len(registrador.mensagens)
    resultado = executar_capturando_recusa(run_automation_real)
    frappe.db.commit()

    doc_cfg = frappe.get_doc(DOCTYPE_CFG_REGUA, DOCTYPE_CFG_REGUA)
    return {
        "resultado": resultado,
        "ultimo_status_execucao": doc_cfg.get("ultimo_status_execucao"),
        # O resumo é o registro AUTORITATIVO da seleção: ele sai do próprio
        # `runner.py` e nomeia `rows_abertas`, cada cobrança que entrou em cada
        # bloco e o veredito da trava de intervalo. Reexecutar o `SELECT` aqui para
        # "listar as candidatas" seria reimplementar o leitor dentro do capturador.
        "resumo": mascarar_resumo_da_execucao(str(doc_cfg.get("ultimo_erro_execucao") or "")),
        "mensagens": registrador.mensagens[marca:],
    }


def capturar_regua_manual(registrador):
    from locacao_automation.cobranca_automation.emailer import enviar_email_manual

    cenarios = []
    for chave, name, _off, _valor, _status, _pago in CENARIOS_REGUA_COBRANCAS:
        documento = frappe.get_doc("Cobranca", name)
        marca = len(registrador.mensagens)
        resultado = executar_capturando_recusa(enviar_email_manual, documento)
        if resultado.get("aceito"):
            corpo = dict(resultado["retorno"])
            corpo["request_id"] = MARCADOR_REQUISICAO
            resultado = dict(resultado, retorno=corpo)
        frappe.db.commit()
        cenarios.append({
            "id": chave,
            "name": name,
            "resultado": resultado,
            "mensagens": registrador.mensagens[marca:],
        })
    return cenarios


def capturar_regua_de_cobranca(hoje):
    """Agrega as cinco frentes da régua num artefato só.

    A ORDEM interna é decisão: as frentes puras (janela, trava de intervalo,
    template e divergência) rodam ANTES da execução da régua, porque
    `enviar_email_automacao` grava `Log Envio Cobranca` e a trava de intervalo lê
    exatamente essa tabela — invertê-la faria a frente do intervalo observar o
    histórico que a própria captura acabou de escrever. O envio manual vem por
    último, e a divergência é recontada depois dos dois para poder afirmar quantas
    mensagens cada caminho produziu por cenário.
    """
    purgar_estado_de_envio()
    configurar_regua()
    semear_cenarios_da_regua()

    entrada_cobrancas = [
        dict(estado_da_cobranca_regua(name, hoje), id=chave)
        for chave, name, _off, _valor, _status, _pago in CENARIOS_REGUA_COBRANCAS
    ]
    entrada_carteira = carteira_herdada_das_fases_anteriores(hoje)
    entrada_historico = historico_de_envio_registrado(hoje)
    configuracao = ler_configuracao_da_regua()

    registrador = RegistradorDeDespacho()
    sentinela = SentinelaDeDespachoReal()
    originais = instalar_substituicao_do_despacho(registrador, sentinela)
    try:
        normalizacoes, horas, intervalos = capturar_regua_janela_e_intervalo()
        templates = capturar_regua_templates(hoje)
        automatico = capturar_regua_automatico(registrador)
        manual = capturar_regua_manual(registrador)
        divergencia = capturar_regua_divergencia(hoje, registrador)
    finally:
        desfazer_substituicao_do_despacho(originais)

    origens = sorted({mensagem["origem"] for mensagem in registrador.mensagens})
    emails_na_fila = frappe.db.count("Email Queue") if frappe.db.exists(
        "DocType", "Email Queue"
    ) else 0

    return {
        "regra": "régua de cobrança",
        "modulo": "locacao_automation.cobranca_automation",
        "funcoes": [
            "helpers.normalize_hhmm",
            "helpers.is_hora_execucao",
            "core.get_status_template",
            "core.pode_enviar_por_intervalo",
            "emailer.get_status_template_manual",
            "emailer.is_cobranca_paga",
            "emailer.template_email",
            "emailer.enviar_email_automacao",
            "emailer.enviar_email_manual",
            "runner.run_automation_real",
        ],
        "despacho": {
            "nivel_da_ordem_de_queda": NIVEL_DA_ORDEM_DE_QUEDA,
            "pontos_esperados": list(PONTOS_DE_DESPACHO_ESPERADOS),
            "pontos_substituidos": origens,
            "invocacoes_do_despachante_real": sentinela.invocacoes,
            "emails_na_fila_do_arcabouco": emails_na_fila,
        },
        "entrada": {
            "configuracao_da_regua": configuracao,
            "cobrancas": entrada_cobrancas,
            "carteira_herdada": entrada_carteira,
            "historico_de_envio": entrada_historico,
            "normalize_hhmm": [
                {"id": chave, "valor": valor, "fallback": fallback}
                for chave, valor, fallback in CENARIOS_REGUA_NORMALIZE_HHMM
            ],
            "is_hora_execucao": [
                {"id": chave, "agora": agora, "horario_configurado": configurado}
                for chave, agora, configurado in CENARIOS_REGUA_HORA_EXECUCAO
            ],
            "intervalo": [
                {"id": chave, "fatura_id": fatura, "intervalo_dias": dias, "tipo": tipo}
                for chave, fatura, dias, tipo in CENARIOS_REGUA_INTERVALO
            ],
        },
        "retorno": {
            "normalize_hhmm": normalizacoes,
            "is_hora_execucao": horas,
            "intervalo": intervalos,
            "template": templates,
            "divergencia_de_estado": divergencia,
            "automatico": automatico,
            "manual": manual,
        },
        "estado_resultante": {
            "cobrancas": [
                estado_da_cobranca_regua(name, hoje)
                for _chave, name, _off, _valor, _status, _pago in CENARIOS_REGUA_COBRANCAS
            ],
            "log_envio_cobranca": historico_de_envio_registrado(hoje),
            "configuracao_da_regua": {
                "ultimo_status_execucao": automatico["ultimo_status_execucao"],
                "ultima_execucao_em": normalizar_data(
                    frappe.db.get_single_value(DOCTYPE_CFG_REGUA, "ultima_execucao_em"), hoje
                ),
            },
        },
    }


def main():
    frappe.init(site=SITE)
    frappe.connect()
    frappe.set_user("Administrator")

    violacoes = gate_de_sanidade()
    if violacoes:
        sys.stderr.write(
            "gate de sanidade reprovado — captura abortada sem gravar golden:\n"
        )
        for violacao in violacoes:
            sys.stderr.write("  - " + violacao + "\n")
        frappe.destroy()
        return 2

    # `in_import` preserva o `name` que atribuímos: sem ele o Frappe sorteia hash
    # (Imovel/Locador/Locatario) ou consome a série (Contrato/Cobranca), e dois
    # runs jamais produziriam o mesmo golden.
    frappe.flags.in_import = True

    hoje = getdate(nowdate())
    purgar_dados_de_negocio()
    criar_base_cadastral()

    with open(frappe.get_site_path("caracterizacao-origem.json")) as arq_origem:
        origem = json.load(arq_origem)

    envelope = {
        "site": SITE,
        "data_execucao": str(hoje),
        "capturado_em": frappe.utils.now(),
        "origem": origem,
        "metragem": capturar_metragem(),
        "contrato_pdf": capturar_contrato_pdf(),
    }

    criar_contrato_hospedeiro()
    envelope["marcar_cobrancas_vencidas"] = capturar_marcar_cobrancas_vencidas(hoje)
    envelope["encerrar_contratos_vencidos"] = capturar_encerrar_contratos_vencidos(hoje)
    envelope["atualizar_atrasos_cobrancas"] = capturar_atualizar_atrasos_cobrancas(hoje)

    # Depois das três rotinas de estado, e não antes — ver o cabeçalho das fases F
    # e G. Inverter a ordem regride os seis artefatos da captura original.
    envelope["contrato_ativacao"] = capturar_contrato_ativacao()
    envelope["contrato_cancelamento"] = capturar_contrato_cancelamento(hoje)

    # Por último, e não por arrumação: o `SELECT` da régua varre toda cobrança em
    # aberto do site. Ver o cabeçalho da fase H.
    envelope["regua_de_cobranca"] = capturar_regua_de_cobranca(hoje)

    frappe.db.commit()
    frappe.destroy()

    sys.stdout.write(SENTINELA_INICIO + "\n")
    sys.stdout.write(json.dumps(envelope, ensure_ascii=False, default=str))
    sys.stdout.write("\n" + SENTINELA_FIM + "\n")
    return 0


sys.exit(main())
'''


def _comando_container() -> list[str]:
    return [
        "docker", "compose",
        "--project-directory", DIR_FRAPPE,
        "-f", ARQ_COMPOSE,
        "-f", ARQ_COMPOSE_OVERRIDE,
        "exec", "-T", SERVICO,
        "bash", "-c", f"cd '{DIR_SITES}' && exec {PYTHON_BENCH} -",
    ]


def executar_captura_no_container() -> dict:
    programa = (
        PROGRAMA_NO_CONTAINER
        .replace("@@SENTINELA_INICIO@@", SENTINELA_INICIO)
        .replace("@@SENTINELA_FIM@@", SENTINELA_FIM)
    )
    try:
        processo = subprocess.run(
            _comando_container(),
            input=programa,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=TIMEOUT_CAPTURA_S,
            check=False,
        )
    except FileNotFoundError:
        print("ERRO: docker não encontrado no PATH.", file=sys.stderr)
        raise SystemExit(EXIT_ERRO)
    except subprocess.TimeoutExpired:
        print(
            f"ERRO: a captura excedeu {TIMEOUT_CAPTURA_S}s e foi interrompida.",
            file=sys.stderr,
        )
        raise SystemExit(EXIT_ERRO)

    if processo.stderr:
        sys.stderr.write(processo.stderr)

    if processo.returncode != 0:
        # O código 2 do programa interno é o gate de sanidade e precisa chegar
        # intacto a quem chamou — é o que distingue "regra inativa" de "quebrou".
        raise SystemExit(EXIT_GATE if processo.returncode == EXIT_GATE else EXIT_ERRO)

    saida = processo.stdout
    inicio = saida.find(SENTINELA_INICIO)
    fim = saida.find(SENTINELA_FIM)
    if inicio < 0 or fim < 0:
        print(
            "ERRO: envelope da captura não encontrado na saída do container.",
            file=sys.stderr,
        )
        raise SystemExit(EXIT_ERRO)

    bruto = saida[inicio + len(SENTINELA_INICIO):fim]
    try:
        return json.loads(bruto)
    except json.JSONDecodeError as exc:
        print(f"ERRO: envelope da captura não é JSON válido: {exc}", file=sys.stderr)
        raise SystemExit(EXIT_ERRO)


def gravar_json(nome: str, conteudo) -> None:
    destino = DIR_GOLDEN / nome
    destino.write_text(
        json.dumps(conteudo, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def gravar_texto(nome: str, conteudo: str) -> None:
    destino = DIR_GOLDEN / nome
    if not conteudo.endswith("\n"):
        conteudo += "\n"
    destino.write_text(conteudo, encoding="utf-8")


# --------------------------------------------------------------------------- #
# O manifesto tem DOIS autores, e esta é a fronteira entre eles.
#
# DECISÃO FECHADA — T1 / Gate 2 · 2026-08-11
# O QUÊ: `PROCEDENCIA.md` é escrito por um ponto ÚNICO (`gravar_procedencia`), e
#        a fronteira de autoria é a seção 5: as seções 1 a 4 saem de
#        `montar_procedencia`, aqui; da 5 em diante o dono é
#        `deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh`, e o que ele
#        escreveu é RECORTADO e REANEXADO a cada captura, sem ser interpretado.
# POR QUÊ: até esta correção a gravação era `write_text(montar_procedencia(...))`
#        — reescrita inteira do arquivo. Como `verificar-captura.sh` executa
#        `capturar.py` dentro do próprio `main` (CT-001, CT-004 e CT-005), toda
#        execução daquele verificador apagava a §5 EM SILÊNCIO: o CT-004 exclui
#        `PROCEDENCIA.md` do diff de determinismo por contrato, e o CT-603 só
#        observa a janela do extrator. O CT-601 passava a reprovar sem que nada
#        acusasse a causa, e a §5 só voltava por um caminho preso a três
#        pré-condições do `/opt/frappe` — que desaparece na virada (F7).
# REVERTER EXIGE: provar que `PROCEDENCIA.md` voltou a ter UM autor, isto é, que
#        nenhuma seção do arquivo é produzida fora de `montar_procedencia`.
# --------------------------------------------------------------------------- #
ARQ_PROCEDENCIA = "PROCEDENCIA.md"

# O corte é por PREFIXO, e não pelo título inteiro, de propósito: preservar demais
# é inócuo (o texto volta como veio), preservar de menos é o defeito que esta
# fronteira fecha. `extrair-fonte-do-pdf.sh` recorta pelo mesmo prefixo, do mesmo
# lado — as duas pontas têm de casar, senão uma duplica o que a outra apaga.
PREFIXO_DA_PRIMEIRA_SECAO_ALHEIA = "## 5. "


def compor_manifesto(corpo: str, anterior: str) -> str:
    """Junta as seções desta captura ao que já existia da §5 em diante.

    `corpo` é o que `montar_procedencia` produziu (seções 1 a 4). `anterior` é o
    conteúdo do manifesto no disco. Sem §5 no anterior, o corpo vale sozinho —
    esta função não inventa seção que não existe.
    """
    posicao = anterior.find("\n" + PREFIXO_DA_PRIMEIRA_SECAO_ALHEIA)
    if posicao == -1:
        return corpo
    return corpo.rstrip("\n") + "\n\n" + anterior[posicao + 1:]


def gravar_procedencia(caminho: Path, corpo: str) -> None:
    """Ponto único de escrita do manifesto — ver a DECISÃO FECHADA acima."""
    anterior = caminho.read_text(encoding="utf-8") if caminho.is_file() else ""
    caminho.write_text(compor_manifesto(corpo, anterior), encoding="utf-8")


def _timestamp_iso(epoch: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(epoch, tz=timezone.utc).astimezone().strftime(
        "%Y-%m-%dT%H:%M:%S"
    )


# Marca estável da observação de divergência aritmética. Deliberadamente SEM
# `<...>`: a bijeção de máscaras do CT-014 varre `<[A-Z_]+>`, e um marcador com
# ângulos aqui entraria naquele conjunto sem existir em golden nenhum.
TAG_DIVERGENCIA_METRAGEM = "DIVERGENCIA-METRAGEM"


def divergencias_de_metragem(metragem: dict) -> list[tuple[str, object, float]]:
    """Cenários em que o agregado da regra difere da soma dos cômodos não nulos.

    É o achado de maior valor que esta caracterização pode produzir — a regra
    legada deixando de ser a soma aritmética. Hoje a lista sai vazia; se um dia
    sair preenchida, o manifesto precisa dizer qual cenário e quais números, e o
    valor da regra continua gravado como veio (§7.2: não corrigir defeito).
    """
    achados = []
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
            achados.append((chave, agregado, soma))
    return achados


# Os três níveis da ordem de queda do D5, fixados ANTES da captura. O manifesto
# declara qual foi ALCANÇADO — cair para o 2 ou para o 3 é resultado registrado, e
# o que a task recusa é cair em silêncio.
DESCRICAO_DA_ORDEM_DE_QUEDA = {
    1: "despachante substituído dentro do processo de captura, com o percurso "
       "completo da régua executando",
    2: "servidor de recebimento local que aceita e descarta",
    3: "piso — apenas as frentes que não produzem envio",
}


def montar_procedencia(envelope: dict) -> str:
    origem = envelope["origem"]
    versoes = origem.get("versoes_bench") or {}
    versoes_txt = " · ".join(f"{app} {ver}" for app, ver in sorted(versoes.items()))
    capturado_em = str(envelope["capturado_em"]).replace(" ", "T").split(".")[0]

    achados = divergencias_de_metragem(envelope["metragem"])
    bloco_divergencias = "".join(
        f"- `{TAG_DIVERGENCIA_METRAGEM}` · cenário `{chave}` · agregado devolvido pela"
        f" regra: `{agregado}` · soma aritmética dos cômodos não nulos: `{soma}`."
        " Gravado como veio, sem correção.\n"
        for chave, agregado, soma in achados
    )

    despacho = envelope["regua_de_cobranca"]["despacho"]
    nivel = int(despacho["nivel_da_ordem_de_queda"])
    descricao_do_nivel = DESCRICAO_DA_ORDEM_DE_QUEDA.get(nivel, "nível desconhecido")
    nivel_txt = f"{nivel} — {descricao_do_nivel}"
    pontos_txt = ", ".join(f"`{ponto}`" for ponto in despacho["pontos_substituidos"])
    despachos_reais = despacho["invocacoes_do_despachante_real"]
    fila_do_arcabouco = despacho["emails_na_fila_do_arcabouco"]

    return f"""# Procedência dos golden — caracterização das regras legadas

> Gerado por `deploy/scripts/caracterizacao/capturar.py`. Não editar à mão: o
> manifesto é reescrito a cada captura e a bijeção entre as máscaras aqui
> declaradas e os marcadores presentes nos golden é verificada por
> `verificar-golden.sh` (CT-014).

## 1. Identificação da captura

| Campo | Valor |
|---|---|
| Data e hora da captura | {capturado_em} |
| Site de captura | {envelope["site"]} |
| Dump de origem | {origem["dump_origem"]} |
| Timestamp do dump | {_timestamp_iso(float(origem["dump_timestamp"]))} |
| Versão do app (commit) | {origem["commit_repositorio_frappe"]} |
| Versões do bench | {versoes_txt} |
| Nível da ordem de queda alcançado (régua) | {nivel_txt} |

O dump de origem é o único vínculo com o ambiente que atende a operação, e ele
recebeu exclusivamente `bench backup` — comando que produz arquivo e não altera
dado (ADR-0006). Toda a captura executou no site efêmero acima, destruído ao fim
do fluxo.

## 2. Máscaras aplicadas

| Marcador | Artefato | Campo mascarado | Motivo |
|---|---|---|---|
| `<DATA_EXECUCAO>` | `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json`, `atualizar-atrasos-cobrancas.json`, `regua-de-cobranca.json` | `retorno.data_execucao`; `estado_resultante.*.data_inicio_atraso`; `estado_resultante.*.data_ultima_atualizacao_atraso`; na régua, o `hoje=` do resumo do `runner.py` e `estado_resultante.configuracao_da_regua.ultima_execucao_em` | As três rotinas derivam de `nowdate()`, e a régua também. Gravar a data absoluta faria o golden expirar no dia seguinte; o marcador representa o offset zero — o próprio dia da execução. |
| `<DATA_GERACAO_EXTENSO>` | `contrato-pdf.txt` | Data por extenso do fecho do contrato (`DD de MÊS de AAAA`), montada pelo Server Script com `nowdate()` | É o único campo do documento que muda a cada geração. Sem a máscara, a comparação textual acusaria diferença todo dia, onde não há diferença de comportamento. |
| `<PDF_CONTRATO_CODIFICADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato`; `estado_resultante.contratos[].pdf_contrato`; `retorno.retorno.pdf_contrato` | O campo guarda o documento inteiro codificado, com megabytes que mudam a cada geração. O que a regra observa é a PRESENÇA — é ela que libera ou bloqueia o cancelamento —, e é a presença que o marcador preserva; ausência continua gravada como `null`. |
| `<ARQUIVO_PDF_PRIVADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato_arquivo`; `estado_resultante.contratos[].pdf_contrato_arquivo`; `retorno.retorno.pdf_contrato_arquivo` | O caminho do anexo privado carrega identificador sorteado pelo arcabouço a cada gravação, e duas capturas nunca coincidiriam. A troca de `pdf_contrato` por `pdf_contrato_arquivo` é o efeito observável do cancelamento, e o par marcador/`null` a preserva. |
| `<HORA_EXECUCAO>` | `regua-de-cobranca.json` | O `agora=` do resumo que o `runner.py` grava em `Automacao Cobranca Config.ultimo_erro_execucao` | A régua compara o relógio da execução com o horário configurado, e grava os dois no resumo. O `agora=` muda a cada minuto; os demais `HH:MM` do resumo são CONFIGURAÇÃO e ficam sem máscara de propósito — apagá-los tiraria do oráculo a janela com que a régua rodou. |
| `<DATA_VENCIMENTO_FORMATADA>` | `regua-de-cobranca.json` | A data de vencimento renderizada em `dd/MM/yyyy` dentro do corpo de cada mensagem (`retorno.template[].corpo`, `retorno.automatico.mensagens[].corpo`, `retorno.manual[].mensagens[].corpo`) | O corpo é parte do oráculo — a régua decide a quem cobrar **e com que texto** —, mas a data que ele imprime deriva de `nowdate()` pelo offset do cenário. Sem a máscara o corpo mudaria todo dia; o offset continua gravado em `entrada.cobrancas[].vencimento_offset_dias`. |
| `<IDENTIFICADOR_DE_REQUISICAO>` | `regua-de-cobranca.json` | `retorno.manual[].resultado.retorno.request_id` | O identificador de requisição do envio manual embute `now()` com precisão de microssegundo, e duas capturas nunca coincidiriam. O que a trava de intervalo observa é o PREFIXO, e ele fica preservado por extenso em `estado_resultante.log_envio_cobranca[].prefixo_request_id`. |

Os cinco marcadores acrescentados são nomeados **sem algarismo** de propósito: a
bijeção do `verificar-golden.sh` varre `<[A-Z_]+>`, que não casa dígito, e um nome
como `<PDF_CONTRATO_BASE64>` escaparia da varredura — viraria máscara órfã
justamente no verificador que existe para achar máscara órfã.

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia. O mesmo vale para
`contrato-cancelamento.json` e para `regua-de-cobranca.json`, que não gravam data
absoluta nenhuma — na régua, o vencimento de cada cobrança e a data de cada linha
do histórico de envio são offsets (`vencimento_offset_dias`, `envio_offset_dias`).

**`contrato-ativacao.json` é a exceção declarada, e ela é o próprio objeto da
captura.** Ali as datas são absolutas porque a derivação
`data_fim_locacao = add_days(add_months(inicio, prazo), -1)` é função pura da data
de início ESCOLHIDA no cenário, e não do relógio: gravar `2027-01-31 + 1 mês` como
offset destruiria exatamente o fato capturado — o ajuste de `add_months` quando o
dia de origem não existe no mês de destino. Nenhuma das datas daquele artefato
deriva de `nowdate()`, então o relógio não o alcança e ele não expira.

O texto do contrato é capturado como **texto extraído** do PDF, nunca como bytes:
o binário carrega metadados de geração que variam a cada execução, e a comparação
byte a byte acusaria diferença onde não há. Nenhum byte de PDF é versionado.

## 3. Convenções dos dados sintéticos

- **Nomes fixos.** Todo documento sintético nasce com `name` explícito
  (`IMOVEL-CARACT-*`, `CTR-CARACT-*`, `COB-CARACT-*`). Sem isso o Frappe sortearia
  hash ou consumiria a série de numeração, e duas capturas nunca coincidiriam.
- **Sentinela de metragem.** Cada `Imovel` é salvo com `metragem_total = -1.0`. O
  valor é sobrescrito pelo Server Script no `Before Save`; se a regra não rodasse,
  a sentinela sobreviveria e denunciaria o golden vazio.
- **Metragem nula.** No cenário `varios_comodos_com_metragem_nula` um cômodo é
  informado com `metragem` nula. A coluna é `NOT NULL` no banco e o valor é
  persistido como `0.0` — o golden registra as duas coisas (`comodos_entrada` com
  `null`, `comodos_persistidos` com `0.0`), sem corrigir nenhuma delas.
- **Obrigatoriedade ignorada nos cenários degenerados.** `Imovel` sem cômodo e
  `Contrato` sem imóvel violam campos marcados como obrigatórios na interface.
  Eles são inseridos com `ignore_mandatory` porque são exatamente os caminhos que
  a regra precisa exibir — a validação da tela não faz parte da regra capturada.
- **Isolamento entre as duas rotinas de cobrança.** As cobranças de
  `marcar_cobrancas_vencidas` nascem com `pagamento_confirmado = 1` — campo que
  essa rotina ignora por completo — para que, depois de marcadas `Vencida`, não
  entrem no conjunto de candidatas de `atualizar_atrasos_cobrancas`, capturada em
  seguida no mesmo site.
- **Mora não-zerada no caminho ignorado.** `COB-CARACT-AAC-03` nasce com
  `valor_multa = 7,77` e `valor_juros = 3,33` para que "a rotina não escreveu
  nada" seja uma afirmação verificável, e não a constatação de que os campos
  continuam zerados.
- **Documento em memória nas frentes puras da ativação.**
  `validar_contrato_para_ativacao` e `montar_dados_cobrancas_contrato` apenas leem
  o documento e não tocam o banco. Os cenários dessas duas frentes usam um
  `Contrato` montado em memória e **não inserido**: inserir trinta contratos
  degenerados — sem data de início, sem locatário — acrescentaria o Server Script
  de PDF ao caminho e deixaria estado inválido no site, sem que a regra capturada
  ganhasse nada. As frentes que escrevem (`ativar_imovel_contrato`,
  `ativar_contrato`, `cancelar_contrato`) usam documentos persistidos, e é delas
  que sai o `estado_resultante`.
- **Precondições do cancelamento montadas pelo estado, nunca por parâmetro.** O
  Server Script "PDF contrato" anexa o documento no `After Save` de todo contrato,
  de modo que a ausência de PDF só existe se for produzida: o cenário
  `contrato_sem_pdf` tem os dois campos de PDF zerados por escrita direta. E como
  a guarda de PDF vem ANTES da guarda de imóvel, o cenário `contrato_sem_imovel`
  recebe o PDF do contrato completo — sem isso ele recusaria pela primeira guarda
  e a segunda ficaria sem oráculo. Nenhuma bandeira de simulação foi acrescentada
  à regra.
- **Filtro de cobranças provado nos dois sentidos.** O contrato cancelado tem uma
  cobrança `Pendente`, uma `Vencida`, uma `Paga` e uma já `Cancelada`. Sem as duas
  últimas, "cancelou as canceláveis" seria indistinguível de "cancelou tudo".
- **Horário da régua fixado em `00:00`.** `is_hora_execucao` compara o relógio da
  execução com o horário configurado; com o `09:00` de produção, uma captura das
  03h não entraria em bloco nenhum e o golden dependeria da hora do dia. A janela
  de horário não fica sem oráculo por isso — ela é capturada à parte, como função
  pura (`normalize_hhmm`, `is_hora_execucao`), com o "agora" passado explicitamente.
- **A régua roda por último, e a carteira que ela enxerga é maior que os cenários
  dela.** O `SELECT` do `runner.py` não filtra por contrato: ele varre toda
  cobrança em aberto do site. Antecipar a fase poria as cobranças da régua dentro
  do conjunto que as três rotinas de estado varrem, e aqueles seis artefatos são de
  fatia fechada. A contrapartida está registrada, não escondida: as cobranças que
  sobraram das fases anteriores entram no `SELECT` e aparecem em
  `entrada.carteira_herdada`, separadas dos cenários próprios.
- **Histórico e fila zerados antes de semear.** O site restaurado traz `Log Envio
  Cobranca` e `Email Queue` reais do dump. Sem a purga, a trava de intervalo ficaria
  sujeita a log de produção e a contagem final da fila do arcabouço não poderia
  afirmar nada sobre esta execução. Nenhuma fase anterior lê essas duas tabelas.
- **Trava de intervalo provada com o negativo que discrimina.** Além dos envios
  recente e antigo, o histórico traz uma linha de status `Erro` recente. Sem ela,
  "a trava só conta envio bem-sucedido" seria indistinguível de "a trava conta
  qualquer linha" — e o filtro de status poderia sumir sem que nada acusasse.

## 4. Observações sobre o comportamento capturado

A referência reflete o comportamento atual do sistema legado, **inclusive
defeitos**. Nenhum resultado foi corrigido, arredondado ou completado.

{bloco_divergencias}- **Cenário deliberadamente não coberto:** o caminho
  `ignorado / contrato_sem_name` de `encerrar_contratos_vencidos()` não está no
  golden. `frappe.get_all` sempre devolve `name` preenchido para documento
  existente, então o ramo é inalcançável pelo caminho real; forjá-lo exigiria
  manipular o retorno da consulta e produziria a referência de um comportamento
  que a produção nunca exibe. O caminho irmão,
  `ignorado / contrato_sem_imovel`, está capturado.
- **`_calcular_mora()` foi portado, não re-executado.** Os casos de
  `calcular-mora.json` vêm de
  `locacao_automation/tests/test_cobranca_atraso.py::TestCalcularMora`, que já
  prova a função pura. O golden preserva os 6 casos do teste e as 7 tuplas de
  entrada distintas que eles exercitam — deduplicar por caso perderia a evidência
  de linearidade dos juros e de independência entre juros e multa.
- **A régua de cobrança (`cobranca_automation`) FOI caracterizada, no nível
  {nivel} da ordem de queda:** {descricao_do_nivel}. Os dois pontos de despacho do
  arcabouço — `emailer.py:203`, em `enviar_email_automacao`, e `emailer.py:251`, em
  `enviar_email_manual` — foram cobertos por um registrador em memória, e os pontos
  que o registrador efetivamente observou durante a captura foram {pontos_txt}. O
  contador de despacho real vale `{despachos_reais}` e a fila de e-mail do
  arcabouço terminou com `{fila_do_arcabouco}` documento(s). Nenhuma mensagem saiu;
  o percurso inteiro executou.
- **Os dois resolvedores de estado da régua discordam, e a divergência é o achado
  desta captura.** `get_status_template` (`core.py`) tem o ramo `Fechada`, que sai
  de `STATUS_FECHADA = ("paga","pago","cancelada","cancelado")`;
  `get_status_template_manual` (`emailer.py`) **não tem esse ramo** e testa o
  vencimento antes de qualquer estado. O cenário `cobranca_cancelada_e_vencida`
  registra o efeito: o caminho automático nunca alcança a cobrança, porque o
  `SELECT` do `runner.py` exclui `["Paga","Cancelada"]`, enquanto o envio manual
  monta o template `Vencida` e cobra por uma dívida cancelada — `is_cobranca_paga`
  conhece `Paga` e não conhece `Cancelada`. O contraste que discrimina está no
  cenário `cobranca_paga`, ao lado, em que o manual É barrado. Gravado como veio,
  sem correção: é o defeito que motiva a unicidade estrutural do estado.
- **`min(dia_vencimento, 28)` é inalcançável pelo caminho real.**
  `montar_dados_cobrancas_contrato` chama `validar_contrato_para_ativacao` na
  primeira linha, e essa validação recusa `dia_vencimento` fora de 1..28. O teto
  do `min` nunca chega a agir sobre valor maior que 28. O golden registra os dois
  fatos lado a lado — a recusa em `dia_vencimento_acima_do_teto` e a montagem com
  `dia_vencimento = 28` — sem corrigir nem remover o `min`, que fica onde está.
- **A ordem das guardas é dado, não detalhe.** Na ativação, o cenário
  `prazo_zero_e_valor_zero` viola duas condições ao mesmo tempo e mostra qual
  mensagem sai; no cancelamento, `contrato_sem_pdf` e `contrato_sem_imovel` são
  capturados separadamente porque a guarda de PDF precede a de imóvel. Cenário com
  violação isolada não consegue exibir precedência nenhuma.
- **Cenário deliberadamente não coberto no cancelamento:** o ramo em que a baixa
  Sicoob é `solicitada` ou devolve `erro`. Ele exige boleto emitido de verdade
  (`boleto_gerado = 1` com `nosso_numero`), e alcançá-lo faria a captura abrir
  conexão mTLS contra a instituição financeira a partir de um site sintético —
  efeito externo e irreversível, fora do que a ADR-0006 admite. Todas as cobranças
  do cenário nascem sem boleto, e o ramo capturado é o `ignoradas /
  sem_boleto_sicoob`, que é o único alcançável sem tocar a rede.
"""


def main() -> int:
    if not DIR_GOLDEN.is_dir():
        print(f"ERRO: diretório de golden não encontrado: {DIR_GOLDEN}", file=sys.stderr)
        return EXIT_ERRO

    envelope = executar_captura_no_container()

    # A gravação só acontece depois que a captura inteira deu certo: um gate
    # reprovado não pode deixar meio golden no disco.
    gravar_json("metragem.json", envelope["metragem"])
    gravar_texto("contrato-pdf.txt", envelope["contrato_pdf"]["texto"])
    gravar_json("marcar-cobrancas-vencidas.json", envelope["marcar_cobrancas_vencidas"])
    gravar_json("encerrar-contratos-vencidos.json", envelope["encerrar_contratos_vencidos"])
    gravar_json("atualizar-atrasos-cobrancas.json", envelope["atualizar_atrasos_cobrancas"])
    gravar_json("contrato-ativacao.json", envelope["contrato_ativacao"])
    gravar_json("contrato-cancelamento.json", envelope["contrato_cancelamento"])
    gravar_json("regua-de-cobranca.json", envelope["regua_de_cobranca"])
    gravar_json("calcular-mora.json", {
        "funcao": "_calcular_mora",
        "modulo": "locacao_automation.cobranca_atraso.service",
        "origem": "locacao_automation/tests/test_cobranca_atraso.py::TestCalcularMora",
        "portado_sem_reexecucao": True,
        "formula": {
            "multa": "arredondar(valor_original * multa_percentual / 100)",
            "juros": "arredondar(valor_original * (juros_percentual / 100) / 30 * dias_atraso)",
            "total": "arredondar(valor_original + multa + juros)",
            "arredondamento": "Decimal ROUND_HALF_UP, 2 casas",
            "base_mes_comercial_dias": 30,
        },
        "casos": CASOS_CALCULAR_MORA,
    })
    gravar_procedencia(DIR_GOLDEN / ARQ_PROCEDENCIA, montar_procedencia(envelope))

    print(f"[capturar] site: {envelope['site']}")
    print(f"[capturar] data de execução no site: {envelope['data_execucao']}")
    print(f"[capturar] artefatos gravados em: {DIR_GOLDEN}")
    for arquivo in sorted(os.listdir(DIR_GOLDEN)):
        print(f"[capturar]   - {arquivo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
