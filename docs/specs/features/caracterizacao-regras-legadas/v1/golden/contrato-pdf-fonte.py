# CAPTURADO DO SISTEMA LEGADO — NÃO EDITAR À MÃO
# Origem: Server Script `PDF contrato` — script_type=DocType Event · reference_doctype=Contrato
# Campo: `script` da tabela `tabServer Script`, lido por SELECT no banco do site que atende a operação
# Última alteração no legado (modified): 2026-03-10 14:24:24.623970
# Comando: bash deploy/scripts/caracterizacao/extrair-fonte-do-pdf.sh
# Procedência: docs/specs/features/caracterizacao-regras-legadas/v1/golden/PROCEDENCIA.md §5
# ----- fonte capturado abaixo, byte a byte: nada acrescentado, removido ou reordenado -----
# Server Script
# Script Type: Document Event
# Reference Doctype: Contrato
# Event: After Save

docstatus_val = 0
try:
    docstatus_val = int(doc.docstatus or 0)
except Exception:
    docstatus_val = 0

if docstatus_val != 2:
    etapa = "inicio"
    try:
        etapa = "utils"
        escape_html = frappe.utils.escape_html

        etapa = "carregar_docs"
        locador = frappe.db.get_value(
            "Locador",
            doc.locador,
            ["locador_nome", "tipo_locador", "documento_principal", "rg", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "cep"],
            as_dict=1
        ) or {}

        locatario = frappe.db.get_value(
            "Locatario",
            doc.locatario,
            ["locatario_nome", "tipo_locatario", "documento_principal", "rg", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "cep"],
            as_dict=1
        ) or {}

        imovel = frappe.db.get_value(
            "Imovel",
            doc.imovel,
            ["nome_imovel", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "cep"],
            as_dict=1
        ) or {}

        # ------------------------------------------------------------
        # LOCADOR (qualificação + endereço + doc)
        # ------------------------------------------------------------
        etapa = "locador"
        locador_nome = str(locador.get("locador_nome") or "").strip()
        locador_tipo = str(locador.get("tipo_locador") or "").strip().lower()
        locador_rg = str(locador.get("rg") or "").strip()
        locador_doc_raw = str(locador.get("documento_principal") or "").strip()

        locador_doc_digits = ""
        for ch in locador_doc_raw:
            if ch.isdigit():
                locador_doc_digits = locador_doc_digits + ch

        locador_pj = False
        if "jur" in locador_tipo:
            locador_pj = True
        elif "fís" in locador_tipo or "fis" in locador_tipo:
            locador_pj = False
        elif len(locador_doc_digits) == 14:
            locador_pj = True

        locador_doc_label = "CPF"
        locador_doc_fmt = locador_doc_raw
        if locador_pj:
            locador_doc_label = "CNPJ"
            if len(locador_doc_digits) == 14:
                locador_doc_fmt = (
                    locador_doc_digits[0:2] + "." + locador_doc_digits[2:5] + "." + locador_doc_digits[5:8] + "/" +
                    locador_doc_digits[8:12] + "-" + locador_doc_digits[12:14]
                )
        else:
            if len(locador_doc_digits) == 11:
                locador_doc_fmt = (
                    locador_doc_digits[0:3] + "." + locador_doc_digits[3:6] + "." + locador_doc_digits[6:9] + "-" +
                    locador_doc_digits[9:11]
                )

        locador_logradouro = str(locador.get("logradouro") or "").strip()
        locador_numero = str(locador.get("numero") or "").strip()
        locador_complemento = str(locador.get("complemento") or "").strip()
        locador_bairro = str(locador.get("bairro") or "").strip()
        locador_cidade = str(locador.get("cidade") or "").strip()
        locador_estado = str(locador.get("estado") or "").strip()
        locador_cep_raw = str(locador.get("cep") or "").strip()

        locador_cep_digits = ""
        for ch in locador_cep_raw:
            if ch.isdigit():
                locador_cep_digits = locador_cep_digits + ch

        locador_cep_fmt = locador_cep_raw
        if len(locador_cep_digits) == 8:
            locador_cep_fmt = locador_cep_digits[0:5] + "-" + locador_cep_digits[5:8]

        locador_end_parts = []
        if locador_logradouro and locador_numero:
            locador_end_parts.append(locador_logradouro + ", " + locador_numero)
        elif locador_logradouro:
            locador_end_parts.append(locador_logradouro)
        elif locador_numero:
            locador_end_parts.append(locador_numero)

        if locador_complemento:
            locador_end_parts.append(locador_complemento)
        if locador_bairro:
            locador_end_parts.append(locador_bairro)

        if locador_cidade and locador_estado:
            locador_end_parts.append(locador_cidade + " - " + locador_estado)
        elif locador_cidade:
            locador_end_parts.append(locador_cidade)
        elif locador_estado:
            locador_end_parts.append(locador_estado)

        if locador_cep_fmt:
            locador_end_parts.append("CEP " + locador_cep_fmt)

        locador_endereco = ", ".join(locador_end_parts)

        linha_locador = "<b>LOCADOR (A):</b> " + escape_html(locador_nome if locador_nome else "-")
        if locador_rg:
            linha_locador = linha_locador + ", portador(a) da cédula de identidade civil número " + escape_html(locador_rg)
            linha_locador = linha_locador + ", e do " + escape_html(locador_doc_label) + " número " + escape_html(locador_doc_fmt)
        else:
            if locador_doc_fmt:
                linha_locador = linha_locador + ", portador(a) do " + escape_html(locador_doc_label) + " número " + escape_html(locador_doc_fmt)

        if locador_endereco:
            linha_locador = linha_locador + ", residente e domiciliado em " + escape_html(locador_endereco)
        else:
            linha_locador = linha_locador + ", residente e domiciliado em -"

        linha_locador = linha_locador + "."

        # ------------------------------------------------------------
        # LOCATÁRIO (qualificação + endereço + doc)
        # ------------------------------------------------------------
        etapa = "locatario"
        locatario_nome = str(locatario.get("locatario_nome") or "").strip()
        locatario_tipo = str(locatario.get("tipo_locatario") or "").strip().lower()
        locatario_rg = str(locatario.get("rg") or "").strip()
        locatario_doc_raw = str(locatario.get("documento_principal") or "").strip()

        locatario_doc_digits = ""
        for ch in locatario_doc_raw:
            if ch.isdigit():
                locatario_doc_digits = locatario_doc_digits + ch

        locatario_pj = False
        if "jur" in locatario_tipo:
            locatario_pj = True
        elif "fís" in locatario_tipo or "fis" in locatario_tipo:
            locatario_pj = False
        elif len(locatario_doc_digits) == 14:
            locatario_pj = True

        locatario_doc_label = "CPF"
        locatario_doc_fmt = locatario_doc_raw
        if locatario_pj:
            locatario_doc_label = "CNPJ"
            if len(locatario_doc_digits) == 14:
                locatario_doc_fmt = (
                    locatario_doc_digits[0:2] + "." + locatario_doc_digits[2:5] + "." + locatario_doc_digits[5:8] + "/" +
                    locatario_doc_digits[8:12] + "-" + locatario_doc_digits[12:14]
                )
        else:
            if len(locatario_doc_digits) == 11:
                locatario_doc_fmt = (
                    locatario_doc_digits[0:3] + "." + locatario_doc_digits[3:6] + "." + locatario_doc_digits[6:9] + "-" +
                    locatario_doc_digits[9:11]
                )

        locatario_logradouro = str(locatario.get("logradouro") or "").strip()
        locatario_numero = str(locatario.get("numero") or "").strip()
        locatario_complemento = str(locatario.get("complemento") or "").strip()
        locatario_bairro = str(locatario.get("bairro") or "").strip()
        locatario_cidade = str(locatario.get("cidade") or "").strip()
        locatario_estado = str(locatario.get("estado") or "").strip()
        locatario_cep_raw = str(locatario.get("cep") or "").strip()

        locatario_cep_digits = ""
        for ch in locatario_cep_raw:
            if ch.isdigit():
                locatario_cep_digits = locatario_cep_digits + ch

        locatario_cep_fmt = locatario_cep_raw
        if len(locatario_cep_digits) == 8:
            locatario_cep_fmt = locatario_cep_digits[0:5] + "-" + locatario_cep_digits[5:8]

        locatario_end_parts = []
        if locatario_logradouro and locatario_numero:
            locatario_end_parts.append(locatario_logradouro + ", " + locatario_numero)
        elif locatario_logradouro:
            locatario_end_parts.append(locatario_logradouro)
        elif locatario_numero:
            locatario_end_parts.append(locatario_numero)

        if locatario_complemento:
            locatario_end_parts.append(locatario_complemento)
        if locatario_bairro:
            locatario_end_parts.append(locatario_bairro)

        if locatario_cidade and locatario_estado:
            locatario_end_parts.append(locatario_cidade + " - " + locatario_estado)
        elif locatario_cidade:
            locatario_end_parts.append(locatario_cidade)
        elif locatario_estado:
            locatario_end_parts.append(locatario_estado)

        if locatario_cep_fmt:
            locatario_end_parts.append("CEP " + locatario_cep_fmt)

        locatario_endereco = ", ".join(locatario_end_parts)

        linha_locatario = "<b>LOCATÁRIO (A) (S):</b> " + escape_html(locatario_nome if locatario_nome else "-")
        if locatario_rg:
            linha_locatario = linha_locatario + ", portador(a) da cédula de identidade civil número " + escape_html(locatario_rg)
            linha_locatario = linha_locatario + ", e do " + escape_html(locatario_doc_label) + " número " + escape_html(locatario_doc_fmt)
        else: 
            if locatario_doc_fmt:
                linha_locatario = linha_locatario + ", portador(a) do " + escape_html(locatario_doc_label) + " número " + escape_html(locatario_doc_fmt)

        if locatario_endereco:
            linha_locatario = linha_locatario + ", residente e domiciliado em " + escape_html(locatario_endereco)
        else:
            linha_locatario = linha_locatario + ", residente e domiciliado em -"

        linha_locatario = linha_locatario + "."

        # ------------------------------------------------------------
        # FIADORES
        # ------------------------------------------------------------
        etapa = "fiadores"
        fiadores_docs = []
        for item in (doc.fiadores or []):
            fiador_id = ""
            try:
                fiador_id = str(item.get("fiador") or "").strip()
            except Exception:
                try:
                    fiador_id = str(item.fiador or "").strip()
                except Exception:
                    fiador_id = ""

            if fiador_id:
                fdoc = frappe.db.get_value(
                    "Fiador",
                    fiador_id,
                    ["nome_fiador", "tipo_fiador", "documento_principal", "rg", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "cep"],
                    as_dict=1
                ) or {}
                if fdoc:
                    fiadores_docs.append(fdoc)

        bloco_fiadores_html = ""
        assinatura_fiadores_html = ""

        if fiadores_docs:
            fiador_chunks = []
            for fdoc in fiadores_docs:
                f_nome = str(fdoc.get("nome_fiador") or "").strip()
                f_tipo = str(fdoc.get("tipo_fiador") or "").strip().lower()
                f_rg = str(fdoc.get("rg") or "").strip()
                f_doc_raw = str(fdoc.get("documento_principal") or "").strip()

                f_doc_digits = ""
                for ch in f_doc_raw:
                    if ch.isdigit():
                        f_doc_digits = f_doc_digits + ch

                f_pj = False
                if "jur" in f_tipo:
                    f_pj = True
                elif "fís" in f_tipo or "fis" in f_tipo:
                    f_pj = False
                elif len(f_doc_digits) == 14:
                    f_pj = True

                f_doc_label = "CPF"
                f_doc_fmt = f_doc_raw
                if f_pj:
                    f_doc_label = "CNPJ"
                    if len(f_doc_digits) == 14:
                        f_doc_fmt = (
                            f_doc_digits[0:2] + "." + f_doc_digits[2:5] + "." + f_doc_digits[5:8] + "/" +
                            f_doc_digits[8:12] + "-" + f_doc_digits[12:14]
                        )
                else:
                    if len(f_doc_digits) == 11:
                        f_doc_fmt = (
                            f_doc_digits[0:3] + "." + f_doc_digits[3:6] + "." + f_doc_digits[6:9] + "-" +
                            f_doc_digits[9:11]
                        )

                f_logradouro = str(fdoc.get("logradouro") or "").strip()
                f_numero = str(fdoc.get("numero") or "").strip()
                f_complemento = str(fdoc.get("complemento") or "").strip()
                f_bairro = str(fdoc.get("bairro") or "").strip()
                f_cidade = str(fdoc.get("cidade") or "").strip()
                f_estado = str(fdoc.get("estado") or "").strip()
                f_cep_raw = str(fdoc.get("cep") or "").strip()

                f_cep_digits = ""
                for ch in f_cep_raw:
                    if ch.isdigit():
                        f_cep_digits = f_cep_digits + ch

                f_cep_fmt = f_cep_raw
                if len(f_cep_digits) == 8:
                    f_cep_fmt = f_cep_digits[0:5] + "-" + f_cep_digits[5:8]

                f_end_parts = []
                if f_logradouro and f_numero:
                    f_end_parts.append(f_logradouro + ", " + f_numero)
                elif f_logradouro:
                    f_end_parts.append(f_logradouro)
                elif f_numero:
                    f_end_parts.append(f_numero)

                if f_complemento:
                    f_end_parts.append(f_complemento)
                if f_bairro:
                    f_end_parts.append(f_bairro)

                if f_cidade and f_estado:
                    f_end_parts.append(f_cidade + " - " + f_estado)
                elif f_cidade:
                    f_end_parts.append(f_cidade)
                elif f_estado:
                    f_end_parts.append(f_estado)

                if f_cep_fmt:
                    f_end_parts.append("CEP " + f_cep_fmt)

                f_endereco = ", ".join(f_end_parts)

                trecho = escape_html(f_nome if f_nome else "-")
                if f_rg:
                    trecho = trecho + ", portador(a) da cédula de identidade civil número " + escape_html(f_rg)
                    trecho = trecho + ", e do " + escape_html(f_doc_label) + " número " + escape_html(f_doc_fmt)
                else:
                    if f_doc_fmt:
                        trecho = trecho + ", portador(a) " + escape_html(f_doc_label) + " número " + escape_html(f_doc_fmt)

                if f_endereco:
                    trecho = trecho + ", residente e domiciliado em " + escape_html(f_endereco)
                else:
                    trecho = trecho + ", residente e domiciliado em -"

                fiador_chunks.append(trecho)

            texto_lista_fiadores = "; ".join(fiador_chunks)

            bloco_fiadores_html = (
                "<p><b>FIADOR (A) (S):</b> Como fiador(es) e principal(ais) pagador(es) das mensalidades do aluguel e demais obrigações constantes deste contrato, "
                + texto_lista_fiadores +
                ", até final satisfação das obrigações locacionais, vincendas tal como consumo de luz, água, IPTU e devolução das chaves ao(à) LOCADOR(A), renunciando expressamente ao benefício de ordem de que tratam os artigos 1.491, 1.500 e 1.503 do Código Civil Brasileiro.</p>"
            )

            sign_parts = []
            for fdoc in fiadores_docs:
                sign_parts.append("<center><div class='assinatura-linha'></div></center>")
                sign_parts.append("<center><p class='assinatura-nome'>" + escape_html(str(fdoc.get("nome_fiador") or "").strip()) + "</p></center>")
                sign_parts.append("<center><p class='assinatura-papel'>Fiador(a)</p></center>")
                sign_parts.append("<center><div class='assinatura-gap'></div></center>")
            assinatura_fiadores_html = "".join(sign_parts)

        # ------------------------------------------------------------
        # IMÓVEL + PRAZO + VALORES
        # ------------------------------------------------------------
        etapa = "imovel_valores"
        imovel_nome = str(imovel.get("nome_imovel") or "").strip()
        imovel_logradouro = str(imovel.get("logradouro") or "").strip()
        imovel_numero = str(imovel.get("numero") or "").strip()
        imovel_complemento = str(imovel.get("complemento") or "").strip()
        imovel_bairro = str(imovel.get("bairro") or "").strip()
        imovel_cidade = str(imovel.get("cidade") or "").strip()
        imovel_estado = str(imovel.get("estado") or "").strip()
        imovel_cep_raw = str(imovel.get("cep") or "").strip()

        imovel_cep_digits = ""
        for ch in imovel_cep_raw:
            if ch.isdigit():
                imovel_cep_digits = imovel_cep_digits + ch

        imovel_cep_fmt = imovel_cep_raw
        if len(imovel_cep_digits) == 8:
            imovel_cep_fmt = imovel_cep_digits[0:5] + "-" + imovel_cep_digits[5:8]

        imovel_end_parts = []
        if imovel_logradouro and imovel_numero:
            imovel_end_parts.append(imovel_logradouro + ", " + imovel_numero)
        elif imovel_logradouro:
            imovel_end_parts.append(imovel_logradouro)
        elif imovel_numero:
            imovel_end_parts.append(imovel_numero)

        if imovel_complemento:
            imovel_end_parts.append(imovel_complemento)
        if imovel_bairro:
            imovel_end_parts.append(imovel_bairro)

        if imovel_cidade and imovel_estado:
            imovel_end_parts.append(imovel_cidade + " - " + imovel_estado)
        elif imovel_cidade:
            imovel_end_parts.append(imovel_cidade)
        elif imovel_estado:
            imovel_end_parts.append(imovel_estado)

        if imovel_cep_fmt:
            imovel_end_parts.append("CEP " + imovel_cep_fmt)

        imovel_endereco = ", ".join(imovel_end_parts)

        valor_mensal = 0.0
        valor_total = 0.0
        prazo_meses = 0
        dia_vencimento = 0

        try:
            valor_mensal = float(doc.valor_mensal or 0)
        except Exception:
            valor_mensal = 0.0

        try:
            valor_total = float(doc.valor_total_contrato or 0)
        except Exception:
            valor_total = 0.0

        try:
            prazo_meses = int(doc.prazo_meses or 0)
        except Exception:
            prazo_meses = 0

        try:
            dia_vencimento = int(doc.dia_vencimento or 0)
        except Exception:
            dia_vencimento = 0

        if valor_total <= 0 and valor_mensal > 0 and prazo_meses > 0:
            valor_total = valor_mensal * prazo_meses

        valor_mensal_fmt = frappe.utils.fmt_money(valor_mensal, currency="BRL")
        valor_total_fmt = frappe.utils.fmt_money(valor_total, currency="BRL")

                # Extenso valor mensal (sem BRL/apenas, em minúsculas, com real/reais e centavo/centavos)
        valor_mensal_abs = valor_mensal
        if valor_mensal_abs < 0:
            valor_mensal_abs = 0 - valor_mensal_abs

        vm_int = int(valor_mensal_abs)
        vm_cent = int(round((valor_mensal_abs - vm_int) * 100))
        if vm_cent == 100:
            vm_int = vm_int + 1
            vm_cent = 0

        vm_int_words = str(frappe.utils.money_in_words(vm_int, "BRL") or "").strip().lower()
        vm_int_words = vm_int_words.replace("brl ", "")
        vm_int_words = vm_int_words.replace(" apenas.", "")
        vm_int_words = vm_int_words.replace(" apenas", "")
        vm_int_words = vm_int_words.replace("apenas.", "")
        vm_int_words = vm_int_words.replace("apenas", "")
        vm_int_words = vm_int_words.replace("  ", " ")
        vm_int_words = vm_int_words.strip(" .,;:")
        if not vm_int_words:
            vm_int_words = "zero"

        valor_mensal_ext = vm_int_words + (" real" if vm_int == 1 else " reais")

        if vm_cent > 0:
            vm_cent_words = str(frappe.utils.money_in_words(vm_cent, "BRL") or "").strip().lower()
            vm_cent_words = vm_cent_words.replace("brl ", "")
            vm_cent_words = vm_cent_words.replace(" apenas.", "")
            vm_cent_words = vm_cent_words.replace(" apenas", "")
            vm_cent_words = vm_cent_words.replace("apenas.", "")
            vm_cent_words = vm_cent_words.replace("apenas", "")
            vm_cent_words = vm_cent_words.replace("  ", " ")
            vm_cent_words = vm_cent_words.strip(" .,;:")
            if not vm_cent_words:
                vm_cent_words = "zero"
            valor_mensal_ext = valor_mensal_ext + " e " + vm_cent_words + (" centavo" if vm_cent == 1 else " centavos")

        # Extenso valor total (mesma regra)
        valor_total_abs = valor_total
        if valor_total_abs < 0:
            valor_total_abs = 0 - valor_total_abs

        vt_int = int(valor_total_abs)
        vt_cent = int(round((valor_total_abs - vt_int) * 100))
        if vt_cent == 100:
            vt_int = vt_int + 1
            vt_cent = 0

        vt_int_words = str(frappe.utils.money_in_words(vt_int, "BRL") or "").strip().lower()
        vt_int_words = vt_int_words.replace("brl ", "")
        vt_int_words = vt_int_words.replace(" apenas.", "")
        vt_int_words = vt_int_words.replace(" apenas", "")
        vt_int_words = vt_int_words.replace("apenas.", "")
        vt_int_words = vt_int_words.replace("apenas", "")
        vt_int_words = vt_int_words.replace("  ", " ")
        vt_int_words = vt_int_words.strip(" .,;:")
        if not vt_int_words:
            vt_int_words = "zero"

        valor_total_ext = vt_int_words + (" real" if vt_int == 1 else " reais")

        if vt_cent > 0:
            vt_cent_words = str(frappe.utils.money_in_words(vt_cent, "BRL") or "").strip().lower()
            vt_cent_words = vt_cent_words.replace("brl ", "")
            vt_cent_words = vt_cent_words.replace(" apenas.", "")
            vt_cent_words = vt_cent_words.replace(" apenas", "")
            vt_cent_words = vt_cent_words.replace("apenas.", "")
            vt_cent_words = vt_cent_words.replace("apenas", "")
            vt_cent_words = vt_cent_words.replace("  ", " ")
            vt_cent_words = vt_cent_words.strip(" .,;:")
            if not vt_cent_words:
                vt_cent_words = "zero"
            valor_total_ext = valor_total_ext + " e " + vt_cent_words + (" centavo" if vt_cent == 1 else " centavos")



        # ------------------------------------------------------------
        # CIDADE/DATA FINAL = CIDADE DO IMÓVEL + HOJE
        # ------------------------------------------------------------
        etapa = "cidade_data_final"
        cidade_final = str(imovel.get("cidade") or "").strip()
        estado_final = str(imovel.get("estado") or "").strip()

        hoje = str(frappe.utils.nowdate() or "").strip()
        ano = ""
        mes = ""
        dia = ""
        if len(hoje) >= 10 and hoje[4] == "-" and hoje[7] == "-":
            ano = hoje[0:4]
            mes = hoje[5:7]
            dia = hoje[8:10]

        mes_nome = ""
        if mes == "01":
            mes_nome = "JANEIRO"
        elif mes == "02":
            mes_nome = "FEVEREIRO"
        elif mes == "03":
            mes_nome = "MARÇO"
        elif mes == "04":
            mes_nome = "ABRIL"
        elif mes == "05":
            mes_nome = "MAIO"
        elif mes == "06":
            mes_nome = "JUNHO"
        elif mes == "07":
            mes_nome = "JULHO"
        elif mes == "08":
            mes_nome = "AGOSTO"
        elif mes == "09":
            mes_nome = "SETEMBRO"
        elif mes == "10":
            mes_nome = "OUTUBRO"
        elif mes == "11":
            mes_nome = "NOVEMBRO"
        elif mes == "12":
            mes_nome = "DEZEMBRO"

        cidade_data_final = escape_html(cidade_final if cidade_final else "")
        if estado_final:
            cidade_data_final = cidade_data_final + " - " + escape_html(estado_final)
        if dia and mes_nome and ano:
            cidade_data_final = cidade_data_final + ", " + escape_html(dia) + " de " + escape_html(mes_nome) + " de " + escape_html(ano)

        # ------------------------------------------------------------
        # HTML DO CONTRATO
        # ------------------------------------------------------------
        etapa = "html"
        html_parts = []
        html_parts.append("<html><head><meta charset='utf-8'>")
        html_parts.append("<style>")
        html_parts.append("@page { size: A4; margin: 18mm 16mm 18mm 16mm; }")
        html_parts.append(".pagina { font-family: 'Times New Roman', serif; font-size: 10pt; color: #111; line-height: 1.55; }")
        html_parts.append("p { margin: 0 0 8px 0; text-align: justify; }")
        html_parts.append(".clausula { margin-top: 6px; }")
        html_parts.append(".assinatura-wrap { margin-top: 28px; }")
        html_parts.append(".assinatura-linha { margin-top: 26px; border-top: 1px solid #222; width: 60%; }")
        html_parts.append(".assinatura-nome { margin-top: 4px; margin-bottom: 0; font-weight: 700; text-align: center; }")
        html_parts.append(".assinatura-papel { margin-top: 2px; margin-bottom: 0; text-align: center; }")
        html_parts.append(".assinatura-gap { height: 14px; }")
        html_parts.append("</style></head><body><div class='pagina'>")

        html_parts.append("<center><h3>CONTRATO DE LOCAÇÃO RESIDENCIAL</h3></center>")

        html_parts.append("<p>" + linha_locador + "</p>")
        html_parts.append("<p>" + linha_locatario + "</p>")
        if bloco_fiadores_html:
            html_parts.append(bloco_fiadores_html)

        html_parts.append("<center><h4>OBJETO</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA PRIMEIRA:</b> O objeto do presente contrato é o imóvel residencial identificado como <b>" + escape_html(imovel_nome if imovel_nome else "-") + "</b>, localizado em <b>" + escape_html(imovel_endereco if imovel_endereco else "-") + "</b>.</p>")

        html_parts.append("<center><h4>DESTINAÇÃO</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA SEGUNDA:</b> O(A) LOCATÁRIO(A) utilizará o imóvel exclusivamente para fins seus e de seus familiares, destino que não poderá ser alterado sem o prévio consentimento escrito do(a) LOCADOR(A), sendo vedada qualquer cessão, transferência ou sublocação, ainda quando parcial e temporária, gratuita ou onerosa.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA TERCEIRA:</b> Será equiparada à violação da cláusula anterior qualquer situação de fato pela qual o(a) LOCATÁRIO(A) deixe de ocupar direta e integralmente o imóvel locado, em seu nome e conta própria.</p>")

        html_parts.append("<center><h4>PRAZO</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA QUARTA:</b> A locação será pelo prazo determinado de <b>" + escape_html(str(prazo_meses if prazo_meses > 0 else 0)) + "</b> meses, podendo ser prorrogado por igual período de comum acordo entre as partes interessadas, contados a partir da assinatura deste contrato, respeitando a data de assinatura do laudo de vistoria, data em que o (a) locatário (a) obriga-se a restituir o imóvel completamente desocupado, em conformidade com a LEI Nº 8.245 (Lei do Inquilinato) e Medida Provisória nº 482 de 30/03/94.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA QUINTA:</b> Se o(a) LOCATÁRIO(A) devolver o imóvel antes de transcorrido o prazo estabelecido na cláusula anterior, ou se a rescisão ocorrer por inadimplemento de obrigação aqui ajustada, pagará multa contratual correspondente a 01 (um) mês de aluguel, sem prejuízo das demais sanções legais e contratuais. (Código Civil) Art. 1193 – Parágrafo Único.</p>")
        html_parts.append("<p class='clausula'><b>PARÁGRAFO 1º:</b> O(A) LOCATÁRIO(A) ficará dispensado(a) da multa contratual se a devolução do imóvel decorrer de transferência pela empregadora para prestar serviços em localidade diversa daquela do início do contrato, ou se notificar por escrito o(a) LOCADOR(A), após decorridos <b>" + escape_html(str(prazo_meses if prazo_meses > 0 else 0)) + "</b> meses de aluguel, com antecedência mínima de 30 (trinta) dias.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA SEXTA:</b> Findo o prazo de locação estipulado na Cláusula Quarta, se não ocorrer a hipótese de rescisão ou a da renuncia ,o que neste último caso deverá ocorrer mediante aviso por escrito de qualquer dos contratantes ao outro até 30 (trinta) dias antes de se vencer cada período contratual, prorrogar-se-á a locação, consoante a assinatura de um novo contrato, com garantia consoante deste contrato.</p>")

        html_parts.append("<center><h4>VALOR</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA SÉTIMA:</b> O aluguel mensal é de <b>" + escape_html(valor_mensal_fmt) + "</b> (<b>" + escape_html(valor_mensal_ext) + "</b>), com reajuste anual pelo índice IGPM-FGV, no período acumulativamente ou outro índice oficial determinado pelo governo que venha a substituí-lo. Daí por diante, caso ocorra a hipótese prevista na cláusula Sexta, ficará sujeito a reajustamentos periódicos estabelecidos na legislação pertinente que estiver em vigor.</p>")
        html_parts.append("<p class='clausula'><b>a) VALOR TOTAL DO CONTRATO:</b> <b>" + escape_html(valor_total_fmt) + "</b> (<b>" + escape_html(valor_total_ext) + "</b>).</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA OITAVA:</b> O aluguel será pré-pago, (ou seja o inquilino paga no dia que entrar no imóvel ou no ato da assinatura do contrato respeitando o termo de vistoria) pontualmente até o dia <b>" + escape_html(str(dia_vencimento if dia_vencimento > 0 else 0)) + "</b> de cada mês de locação ajustada na cláusula quarta deste instrumento, independente de cobrança,  ou onde o (a) LOCADOR (A) determinar, estendendo-se esse prazo para o primeiro dia útil seguinte, caso coincida com sábado, domingo ou feriado. Ultrapassando os dias acima estipulados o aluguel será acrescido de multa de 2% (dois por cento) ao mês a partir do primeiro dia útil do vencimento e mais 1% (um por cento) de juros de mora, ao dia.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA NONA:</b> Se o LOCADOR (A), ou seu representante legal, recusar recebimento sem justa causa ou o LOCATÁRIO (A) tiver dificuldade em efetuar o pagamento das obrigações contratuais, deverá este (a) promover o respectivo depósito judicial até o 5º (quinto) dia útil do mês subseqüente ao vencido. Não o fazendo, entende-se á que ficou constituído em mora, para todos os efeitos legais, especialmente para a incidência das obrigações adiante convencionadas.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA:</b> O aluguel será inteiramente liquido ao (à) LOCADOR (A) respeitada a legislação sobre a renda, ocorrendo por conta exclusiva do (a) LOCATÀRIO (A):</p>")
        html_parts.append("<p class='clausula'>a) Despesas de luz, água e serviços semelhantes, os comprovantes dos pagamentos deverão ser entregues ao (à) LOCADOR (A), ou seu representante legal, junto com o pagamento do aluguel vencido, no prazo da locação estipulado neste instrumento ou provável prorrogação;</p>")
        html_parts.append("<p class='clausula'>b) Pagamento de Imposto Predial e Territorial Urbano (IPTU), além das taxas municipais relativas ao imóvel locado. Os comprovantes de pagamentos deverão ser entregues ao (à) LOCADOR (A) ou seu representante legal. Junto com o pagamento do aluguel vencido, no prazo da locação estipulado neste instrumento ou provável prorrogação;</p>")
        html_parts.append("<p class='clausula'>c) Satisfação de todas as exigências do poder público, relativa ao imóvel locado.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA PRIMEIRA:</b> Além das obrigações mencionadas, qualquer outra que caiba ao (à) LOCATARIO (A) e for pago pelo LOCADOR (A), poderá este (a) também cobra-lo junto e indissoluvelmente com qualquer aluguel sub-seqüente, aplicando-se à demora ou recusa de ressarcimento, as mesmas sanções que decorreriam do atraso no pagamento dos aluguéis.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA SEGUNDA:</b> Obriga-se o (a) LOCATARIO (A) a remeter ao (à) LOCADOR (A), ou seu representante legal, dentro das 24 (vinte e quatro) horas de seu recebimento, qualquer correspondência, intimação ou notificação que lhe for dirigida pelo imóvel locado, e, caso não o faça, assume integralmente todas as responsabilidades pelas exigidas em tais intervenções e suas conseqüências.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA TERCEIRA:</b> No ato da entrega das chaves o (a) LOCATARIO (A) liquidará os aluguéis até àquela data e apresentará os comprovantes quitados das despesas de que trata a Cláusula Décima, e depositará mediante recibo a importância correspondente ao consumo de energia, água e taxa de condomínio e demais despesa dos dias que excederem o ultima talão quitado, calculado á base do valor médio dos 03 (Três) meses anteriores.</p>")

        html_parts.append("<center><h4>CONSERVAÇÃO</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA QUARTA:</b> Obriga-se o (a) LOCATARIO (A) a devolver o imóvel no estado em que o recebe, de acordo com o Laudo de Vistoria em anexo, que passa a ser parte integrante deste contrato.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA QUINTA:</b> O (A) LOCATÁRIO (A) satisfará à própria custa, com solidez e perfeição, todo o reparo e conserto de que necessite ou venha a necessitar o imóvel locado, satisfazendo, nesse sentido todas exigências das autoridades públicas.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA SEXTA:</b> O (A) LOCATARIO (A) será responsável pelos danos causados ao imóvel pelo mau trato ou por aqueles que resultarem para os vizinhos do mau uso do imóvel locado, não se prejudicando, durante os respectivos reparos, a continuidade deste contrato, em todos os seus efeitos.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA SÉTIMA:</b> O (A) LOCATARIO (A) ou seu representante legal, poderá inspecionar o imóvel, pessoalmente ou através de representantes, sendo tal vistoria imprescindível antes da restituição, a fim de verificar a fiel observância das obrigações assumidas pelo (a) LOCATARIO(A) neste contrato, o(a) qual não poderá, sob pretexto algum fazer oposição a esse direito.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA OITAVA:</b> As benfeitorias ou acessões que vierem a ser introduzidas, de qualquer natureza, aderirão automaticamente ao imóvel locado, integralmente a plena propriedade do (a) LOCADORA (A). O consentimento escrito do LOCADOR (A), ou seu representante legal, todavia, será imprescindível. O LOCATÁRIO (A) renuncia desde logo, irrevogável, a todo direito de indenização, compensação ou retenção aos valores despedidos.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA DÉCIMA NONA:</b> As adaptações que se fizerem necessárias à instalação de aparelhos eletrodomésticos, inclusive ar-condicionado, e que prescindam de mutilar o imóvel, poderão ser efetuados mediante aviso prévio e consentimento do (a) LOCADOR (A), ou seu representante legal sempre por escrito.</p>")

        html_parts.append("<center><h4>SANÇÕES</h4></center>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA VIGÉSIMA:</b> Ao inadimplemento total ou parcial de qualquer das obrigações deste contrato serão aplicadas cumulativamente ou alternativamente, a juízo do (a) LOCADOR (A) ou seu representante legal, as seguintes sanções:</p>")
        html_parts.append("<p class='clausula'>a) Rescisão contratual automática, independente de interpelação judicial ou extrajudicial, não significa a tolerância de qualquer infração como renuncia deste direito, caso a mesma se repita ou se prolongue, com exigências das obrigações financeiras totais previstas neste contrato, por antecipação.</p>")
        html_parts.append("<p class='clausula'>b) Multa penal igual ao valor do dano, em se tratando de desconservação do imóvel e suas benfeitorias.</p>")
        html_parts.append("<p class='clausula'>c) Perdas e danos que se apurarem, incluindo custos processuais.</p>")
        html_parts.append("<p class='clausula'>d) Pagamentos dos honorários dos advogados e peritos do LOCADOR (A), ou seu representante legal, desde já fixado em 20% (vinte por cento) se for litigioso e 10% (dez por cento) se for amigável.</p>")
        html_parts.append("<p class='clausula'><b>CLÁUSULA VIGÉSIMA PRIMEIRA:</b> As partes contratantes elegem o foro da Comarca de Caratinga – MG para dirimir quaisquer duvidas oriundas deste Contrato, renunciando a qualquer outro, por mais privilegio que seja.</p>")

        html_parts.append("<p>E por estarem justos e contratados, assim o presente contrato em 02 (Duas) vias de igual teor e forma, na presença de 02(duas) testemunhas que também assinam, elegendo o Foro da Comarca de Caratinga - MG para quaisquer ações oriundas deste contrato.</p>")
        html_parts.append("<center><p><b>" + cidade_data_final + "</b></p></center>")

        html_parts.append("<center><div class='assinatura-wrap'></center>")
        html_parts.append("<center><div class='assinatura-gap'></div></center>")
        html_parts.append("<center><div class='assinatura-linha'></div></center>")
        html_parts.append("<center><p class='assinatura-nome'>" + escape_html(locatario_nome if locatario_nome else "-") + "</p></center>")
        html_parts.append("<center><p class='assinatura-papel'>Locatário(a)</p></center>")

        html_parts.append("<center><div class='assinatura-gap'></div></center>")
        html_parts.append("<center><div class='assinatura-linha'></div></center>")
        html_parts.append("<center><p class='assinatura-nome'>" + escape_html(locador_nome if locador_nome else "-") + "</p></center>")
        html_parts.append("<center><p class='assinatura-papel'>Locador(a)</p></center>")

        if assinatura_fiadores_html:
            html_parts.append("<center><div class='assinatura-gap'></div></center>")
            html_parts.append(assinatura_fiadores_html)
            
        html_parts.append("<center><div class='assinatura-gap'></div></center>")
        html_parts.append("<center><div class='assinatura-linha'></div></center>")
        html_parts.append("<center><p class='assinatura-papel'>Testemunha</p></center>")
        
        html_parts.append("<center><div class='assinatura-gap'></div></center>")
        html_parts.append("<center><div class='assinatura-linha'></div></center>")
        html_parts.append("<center><p class='assinatura-papel'>Testemunha</p></center>")

        html_parts.append("</div>")
        html_parts.append("</div></body></html>")
        html_pdf = "".join(html_parts)

        # ------------------------------------------------------------
        # GERA PDF
        # ------------------------------------------------------------
        etapa = "gerar_pdf"
        pdf_bytes = None
        try:
            pdf_bytes = frappe.utils.pdf.get_pdf(html_pdf)
        except Exception:
            pdf_bytes = None

        if not pdf_bytes:
            try:
                resultado = frappe.attach_print(
                    doctype="Contrato",
                    name=doc.name,
                    file_name="Contrato_" + str(doc.name),
                    html=html_pdf,
                    print_letterhead=False
                )
                if resultado:
                    conteudo = resultado.get("fcontent")
                    nome_saida = str(resultado.get("fname") or "").strip().lower()
                    if conteudo and (not isinstance(conteudo, str)) and (not nome_saida.endswith(".html")):
                        pdf_bytes = conteudo
            except Exception:
                pdf_bytes = None

        if not pdf_bytes:
            frappe.throw("Nao foi possivel gerar o PDF.")
        if isinstance(pdf_bytes, str):
            frappe.throw("A geracao retornou texto e nao PDF binario.")

        # ------------------------------------------------------------
        # BASE64 MANUAL E SALVA NO CAMPO
        # ------------------------------------------------------------
        etapa = "base64"
        base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        out = []
        i = 0
        total_bytes = len(pdf_bytes)

        while i < total_bytes:
            b0 = pdf_bytes[i]
            i = i + 1

            has_b1 = i < total_bytes
            b1 = 0
            if has_b1:
                b1 = pdf_bytes[i]
                i = i + 1

            has_b2 = i < total_bytes
            b2 = 0
            if has_b2:
                b2 = pdf_bytes[i]
                i = i + 1

            n0 = b0 >> 2
            n1 = ((b0 & 3) << 4) | (b1 >> 4)
            n2 = ((b1 & 15) << 2) | (b2 >> 6)
            n3 = b2 & 63

            out.append(base64_chars[n0])
            out.append(base64_chars[n1])

            if has_b1:
                out.append(base64_chars[n2])
            else:
                out.append("=")

            if has_b2:
                out.append(base64_chars[n3])
            else:
                out.append("=")

        pdf_base64 = "".join(out)
        if not pdf_base64:
            frappe.throw("Nao foi possivel converter o PDF para base64.")

        etapa = "salvar_campo"
        doc.db_set("pdf_contrato", pdf_base64, update_modified=False)

    except Exception:
        msg = "Contrato " + str(doc.name) + " - falha na etapa: " + str(etapa)
        frappe.log_error(msg, "Erro ao gerar PDF base64")
        frappe.throw(msg)
