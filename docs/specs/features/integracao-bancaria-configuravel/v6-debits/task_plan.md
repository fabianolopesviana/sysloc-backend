# Task Plan — v6-debits: cleanup dos débitos da v5

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v6-debits
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Scope**: [scope.md](scope.md)
- **Status**: Concluído
- **Source**: agent-spec-debt-resolution
- **Parent**: v5

---

## 2. Resumo

2 tasks, uma por débito. Independentes entre si; o único ponto de atenção é que **ambas tocam o mesmo arquivo de teste**.

---

## 3. Tabela de Tasks

| ID | Nome | Arquivo | Débito | Classe | Custo | Modelo | Risco | Gates | Paralelo? (derivado) | Origem | Status |
|----|------|---------|--------|--------|-------|--------|-------|-------|----------------------|--------|--------|
| T1 | Tornar observáveis as chaves ignoradas do payload | [T1](tasks/T1.md) | D-001 (best_practices) | recomendado | ~20min | sonnet | low | [qa, tech_review] | Não (colide em `test_integracao_bancaria_api.py`) | T2 (v5) | Concluído |
| T2 | Tornar o CT-039 auto-contido quanto a `frappe.local.response` | [T2](tasks/T2.md) | D-002 (tests) | **perfumaria** | ~10min | sonnet | low | **[qa]** | Não (colide em `test_integracao_bancaria_api.py`) | T2 (v5) | Concluído |

**Gates assimétricos, de propósito**: T1 toca `salvar_configuracao` — código de produção do fluxo de cobrança, Critical Path `payments` — e por isso leva Tech Review. T2 altera **apenas** arquivo de teste, que é o caso em que o default de cleanup (`code_review_only`) se aplica literalmente.

---

## 4. Ordem de Execução

Fase 1, sequencial: **T1 → T2**.

Os débitos são independentes e os arquivos de *produção* são disjuntos, mas as duas tasks escrevem em `tests/test_integracao_bancaria_api.py` — T1 acrescenta casos, T2 mexe no `setUp` da base. Rodar em paralelo geraria conflito de edição no mesmo arquivo, então o flag derivado é **Não**.

T1 primeiro por ser a de maior valor: se T2 travar, o débito que ataca a causa de um incidente real já estará resolvido.

---

## 5. Grafo de Dependências

| Task | Depende de | Pode Rodar em Paralelo? | Status | Motivo |
|------|-----------|-------------------------|--------|--------|
| T1 | — | Não | Concluído | `tests/test_integracao_bancaria_api.py` compartilhado com T2 |
| T2 | — | Não | Concluído | idem |

Nenhuma dependência lógica; a serialização é só por colisão de arquivo de teste.

---

## 6. Arquivos Impactados (consolidado)

- `app-sync/locacao_automation/locacao_automation/integracao_bancaria_api/service.py` (T1)
- `app-sync/locacao_automation/locacao_automation/tests/test_integracao_bancaria_api.py` (T1 e T2)

---

## 7. Critérios de Conclusão Geral

- [x] T1 e T2 com Status `Concluído`.
- [x] Chave desconhecida no payload deixa rastro em log; **chamada legítima não gera log** (provado por CT-042).
- [x] Nenhum valor de payload no log (RN-06) — provado por CT-043 com teste de mutação (dump `nome=valor` → vermelho).
- [x] `**_ignorados` mantido; contrato de `salvar_configuracao` inalterado.
- [x] CT-039 imune a `frappe.local.response` sujo — provado pelo probe do QA (sem o fix quebra, com o fix passa).
- [x] Suíte passa sem regressão: **139 testes, OK** (136 baseline + 3 de T1).
- [x] Nenhum diff fora dos arquivos da §6 (verificado com `git status --porcelain` sem filtro de path).

---

## 8. Como executar

```
/agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v6-debits/task_plan.md
```
