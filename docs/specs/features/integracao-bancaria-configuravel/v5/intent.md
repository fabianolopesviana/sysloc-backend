# Intent — Fechar RN-08 e RN-09 (lacunas da v1)

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v5
- **Variante**: backend
- **Parent**: v4-debits
- **Origem**: auditoria do handoff frontend pós-run, 2026-07-21
- **Tipo**: correção de lacuna de escopo (não é feature nova)

---

## 2. O QUE

Implementar dois requisitos que **já estão especificados no `tech_spec.md` da v1** e não foram entregues:

- **RN-08 / CA-08** — troca de configuração com boletos em aberto exige decisão explícita entre três opções.
- **RN-09 / CA-10** — a lista de boletos **ausentes** do consolidado precisa chegar ao cliente.

---

## 3. POR QUE

A auditoria do handoff backend→frontend, feita após os runs, encontrou que a tela **não tem como construir** o fluxo de troca com boletos em aberto nem avisar quais boletos ficaram de fora do consolidado — porque o backend não expõe nada disso.

### Não é escopo novo

O `tech_spec.md` da v1 especifica o contrato **literalmente**:

- Linha 285-290 — o fluxo passo a passo de `salvar_configuracao` com boletos em aberto, incluindo o retorno `{success: False, requer_decisao: True, total_abertos, opcoes: [...]}` e as três opções nomeadas (`aceitar`, `nao_aceitar`, `aceitar_com_consolidado`).
- Linha 362 — `RN-08 | Troca com boletos em aberto exige decisão explícita entre três opções | DECISAO_REQUERIDA`.
- Linha 363 — `RN-09 | Consolidado reúne os disponíveis e lista os ausentes`.
- Linha 516 — a mensagem: `"Existem {n} boletos em aberto emitidos pela conta atual."`.
- Linha 736/738 — `CA-08` e `CA-10` na matriz de critérios de aceite.

### Por que passou pelos gates

A matriz de rastreabilidade mapeia **CA-08 → CT-019**. Existe um `CT-019` implementado — mas ele testa **outra coisa**: a spec pedia `test_tres_opcoes_de_decisao_na_troca` (verificar RN-08 nos três caminhos), e o que existe é `test_ct019_tres_elegiveis_contagem_e_identificadores_batem_com_producao`, que valida a apuração do filtro RN-02.

**O identificador foi reaproveitado para outro contrato**, e a rastreabilidade passou a parecer satisfeita. Os gates validam a task que recebem; nenhuma task da v1 pediu o fluxo de decisão, então nenhum gate teve como cobrá-lo.

Lição registrada: rastreabilidade por ID só funciona se o ID for único. Já houve outra colisão nesta feature (CT-030, na v3).

### Estado atual (verificado no código)

- `salvar_configuracao` **não consulta** boletos em aberto e tem `**_ignorados` na assinatura — um cliente que enviar `decisao` recebe **sucesso normal, sem erro e sem efeito**. Falha silenciosa.
- `montar_pdf_consolidado` calcula `{total, pdf_bytes, disponiveis, ausentes}`, mas `baixar_consolidado_boletos_abertos` grava **apenas** `pdf_bytes` na resposta e termina. Não há header, envelope nem endpoint irmão.
- `listar_boletos_abertos` existe, funciona e é testada — mas é **função interna**, não whitelisted.

---

## 4. Critério de sucesso

O frontend consegue implementar o fluxo de troca com boletos em aberto e o aviso de ausentes **usando apenas contrato publicado**, sem consultar o backend e sem depender de comportamento não documentado.

---

## 5. Fora do escopo

- Alterar o filtro RN-02 (é fonte única desde a v2-debits e comparado com produção pelo CT-019 atual).
- Trocar o streaming do consolidado por JSON — decisão do usuário foi **manter** o streaming e acrescentar um irmão JSON.
- Redesenhar a tela — o handoff já descreve a UX; esta versão entrega o contrato que falta.
