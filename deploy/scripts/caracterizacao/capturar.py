#!/usr/bin/env python3
"""Captura a caracterização das seis regras de negócio legadas (TC-001).

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
    0  captura concluída, seis artefatos golden + manifesto gravados
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
import re
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

O dump de origem é o único vínculo com o ambiente que atende a operação, e ele
recebeu exclusivamente `bench backup` — comando que produz arquivo e não altera
dado (ADR-0006). Toda a captura executou no site efêmero acima, destruído ao fim
do fluxo.

## 2. Máscaras aplicadas

| Marcador | Artefato | Campo mascarado | Motivo |
|---|---|---|---|
| `<DATA_EXECUCAO>` | `marcar-cobrancas-vencidas.json`, `encerrar-contratos-vencidos.json`, `atualizar-atrasos-cobrancas.json` | `retorno.data_execucao`; `estado_resultante.*.data_inicio_atraso`; `estado_resultante.*.data_ultima_atualizacao_atraso` | As três rotinas derivam de `nowdate()`. Gravar a data absoluta faria o golden expirar no dia seguinte; o marcador representa o offset zero — o próprio dia da execução. |
| `<DATA_GERACAO_EXTENSO>` | `contrato-pdf.txt` | Data por extenso do fecho do contrato (`DD de MÊS de AAAA`), montada pelo Server Script com `nowdate()` | É o único campo do documento que muda a cada geração. Sem a máscara, a comparação textual acusaria diferença todo dia, onde não há diferença de comportamento. |

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia.

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
- **A régua de cobrança (`cobranca_automation`) não foi caracterizada.** Ela tem
  efeito colateral de envio de e-mail e ficou fora do escopo desta captura.
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
    (DIR_GOLDEN / "PROCEDENCIA.md").write_text(
        montar_procedencia(envelope), encoding="utf-8"
    )

    print(f"[capturar] site: {envelope['site']}")
    print(f"[capturar] data de execução no site: {envelope['data_execucao']}")
    print(f"[capturar] artefatos gravados em: {DIR_GOLDEN}")
    for arquivo in sorted(os.listdir(DIR_GOLDEN)):
        print(f"[capturar]   - {arquivo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
