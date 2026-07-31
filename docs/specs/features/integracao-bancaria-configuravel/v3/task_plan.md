# Task Plan — v3: corrigir exposição pública do certificado

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v3
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Scope**: [scope.md](scope.md)
- **Status**: Concluído
- **Origem**: incidente de segurança em produção, 2026-07-21

---

## 2. Resumo

Uma task. O defeito é único e concentrado, mas a decisão de **como** corrigir é não-trivial (três direções com efeitos colaterais distintos — `scope.md` §5), e a correção é de segurança em código de produção de pagamentos.

---

## 3. Tabela de Tasks

| ID | Nome | Arquivo | Fase | Dependências | Modelo | Risco | Gates | Paralelo? | Status |
|----|------|---------|------|--------------|--------|-------|-------|-----------|--------|
| T1 | Impedir cópia pública do certificado no ciclo pendente/ativo | [T1](tasks/T1.md) | 1 | — | opus | high | [qa, tech_review] | Não (task única) | Concluído |

**Modelo e gates**: `opus` e ambos os gates são obrigatórios — o path bate em duas categorias de Critical Path (`security` e `payments`) e o risco é `high`.

---

## 4. Ordem de Execução

Fase 1: **T1**. Não há paralelismo a derivar.

---

## 5. Critérios de Conclusão Geral

- [x] T1 com Status `Concluído`.
- [x] CT-033 demonstradamente falha sem a correção e passa com ela.
- [x] Nenhum dos 4 pontos de disparo produz arquivo de certificado acessível sem autenticação.
- [x] Suíte passa sem regressão (baseline 113 testes + os novos).
- [x] Diff restrito a `integracao_bancaria_api/service.py` e ao arquivo de testes.
- [x] `_run/minispec_state.yaml` marca `execution: completed`.

---

## 6. Pós-merge (fora do run)

1. Reconciliar o dado de produção conforme `scope.md` §6 — `c699b0110f.certificado_arquivo` está `null` por mitigação manual.
2. Executar o procedimento de verificação do `runbook_frappe.md` ("ALERTA - copia publica do certificado") após a reconciliação.
3. Atualizar as seções "BUG CONHECIDO" / "ALERTA" nos dois arquivos de `reference/`, que hoje descrevem o bug como não resolvido. **Atenção**: esses arquivos são `root:root` e exigem `sudo`.

---

## 7. Como executar

```
/agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v3/task_plan.md
```
