#!/usr/bin/env python3
"""Captura a caracterização das regras de negócio legadas (TC-001 e F2/T1).

Oito artefatos golden: os seis da captura original (TC-001) mais os dois de
ativação e cancelamento de contrato, acrescentados pela T1 da fatia
`contratos-de-locacao`.

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
    0  captura concluída, oito artefatos golden + manifesto gravados
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

# Marcadores da fase de cancelamento. Os dois nomes são escritos SEM dígito de
# propósito: a bijeção máscara <-> marcador do CT-014 varre `<[A-Z_]+>`, que não
# casa algarismo. Um marcador como `<PDF_CONTRATO_BASE64>` escaparia da varredura
# e viraria máscara órfã silenciosa — o defeito exato que aquela bijeção existe
# para pegar.
MARCADOR_PDF_CONTRATO = "<PDF_CONTRATO_CODIFICADO>"
MARCADOR_ARQUIVO_PDF = "<ARQUIVO_PDF_PRIVADO>"

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
| `<PDF_CONTRATO_CODIFICADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato`; `estado_resultante.contratos[].pdf_contrato`; `retorno.retorno.pdf_contrato` | O campo guarda o documento inteiro codificado, com megabytes que mudam a cada geração. O que a regra observa é a PRESENÇA — é ela que libera ou bloqueia o cancelamento —, e é a presença que o marcador preserva; ausência continua gravada como `null`. |
| `<ARQUIVO_PDF_PRIVADO>` | `contrato-cancelamento.json` | `entrada.contratos[].pdf_contrato_arquivo`; `estado_resultante.contratos[].pdf_contrato_arquivo`; `retorno.retorno.pdf_contrato_arquivo` | O caminho do anexo privado carrega identificador sorteado pelo arcabouço a cada gravação, e duas capturas nunca coincidiriam. A troca de `pdf_contrato` por `pdf_contrato_arquivo` é o efeito observável do cancelamento, e o par marcador/`null` a preserva. |

Os dois marcadores acima são nomeados **sem algarismo** de propósito: a bijeção do
`verificar-golden.sh` varre `<[A-Z_]+>`, que não casa dígito, e um nome como
`<PDF_CONTRATO_BASE64>` escaparia da varredura — viraria máscara órfã justamente
no verificador que existe para achar máscara órfã.

Todas as demais datas dos golden das rotinas são gravadas como **offset inteiro
de dias** relativo à data de captura (`vencimento_offset_dias`,
`data_fim_locacao_offset_dias`), nunca como data absoluta. É o que permite à F5
reconstruir o mesmo cenário em qualquer dia. O mesmo vale para
`contrato-cancelamento.json`, que não grava data absoluta nenhuma.

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
