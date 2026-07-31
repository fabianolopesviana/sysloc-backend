# Task Plan — v4-debits: cleanup dos débitos da v3

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v4-debits
- **Variante**: backend
- **Intent**: [intent.md](intent.md)
- **Scope**: [scope.md](scope.md)
- **Status**: Concluído
- **Source**: agent-spec-debt-resolution
- **Parent**: v3

---

## 2. Resumo

4 tasks, uma por débito. Todas no mesmo arquivo (`integracao_bancaria_api/service.py`), portanto **sequenciais**. Ordem por risco crescente: as três de risco nulo primeiro, a que altera runtime por último.

Todas com `gates: [qa, tech_review]` — o path bate em duas categorias de Critical Path (`security` e `payments`), o que sobrepõe o default `[qa]` de tasks de cleanup.

---

## 3. Tabela de Tasks

| ID | Nome | Arquivo | Débito | Classe | Custo | Modelo | Risco | Gates | Paralelo? | Origem | Status |
|----|------|---------|--------|--------|-------|--------|-------|-------|-----------|--------|--------|
| T1 | Ajustar garantia documentada + extrair constante | [T1](tasks/T1.md) | D-001 (architecture) | recomendado | ~20min | sonnet | low | [qa, tech_review] | Não (colide em `service.py`) | T1 (v3) | Concluído |
| T2 | Declarar premissa da preservação do binário | [T2](tasks/T2.md) | D-002 (error_handling) | recomendado | ~10min | sonnet | low | [qa, tech_review] | Não (colide em `service.py`) | T1 (v3) | Concluído |
| T3 | Renomear `_obter_pendente` → `_preparar_pendente` | [T3](tasks/T3.md) | D-004 (code_quality) | recomendado | ~10min | sonnet | low | [qa, tech_review] | Não (colide em `service.py`) | T1 (v3) | Concluído |
| T4 | Pré-validar `url_alvo` antes de apagar vínculos | [T4](tasks/T4.md) | D-003 (error_handling) | **perfumaria** | ~60min | sonnet | **medium** | [qa, tech_review] | Não (colide em `service.py`) | T1 (v3) | Concluído |

---

## 4. Ordem de Execução

Fase 1, sequencial: **T1 → T2 → T3 → T4**.

Sem paralelismo a derivar — os 4 débitos compartilham `integracao_bancaria_api/service.py`.

T4 vai por último de propósito: é a única que altera lógica de runtime, na mesma função que causou o incidente da v3. Deixá-la ao fim garante que uma eventual rejeição dela não bloqueie os três cleanups de risco nulo.

---

## 5. Grafo de Dependências

| Task | Depende de | Pode Rodar em Paralelo? | Motivo |
|------|-----------|-------------------------|--------|
| T1 | — | Não | `service.py` compartilhado com T2, T3, T4 |
| T2 | — | Não | idem |
| T3 | — | Não | idem |
| T4 | — | Não | idem |

Nenhuma dependência lógica entre elas; a serialização é só por colisão de arquivo.

---

## 6. Arquivos Impactados (consolidado)

- `app-sync/locacao_automation/locacao_automation/integracao_bancaria_api/service.py` (T1, T2, T3, T4)
- `app-sync/locacao_automation/locacao_automation/tests/test_certificado_api.py` (**apenas T4** — ver `scope.md` §5)

---

## 7. Critérios de Conclusão Geral

- [x] As 4 tasks com Status `Concluído`.
- [x] Suíte passa sem regressão — baseline **120 testes** (T4 pode adicionar).
- [x] A correção de segurança da v3 permanece íntegra: os 4 pontos de disparo fechados e o poder de detecção por mutação preservado.
- [x] Nenhum diff fora dos arquivos da §6.
- [x] §2 do `../v3/_run/run-report.md` marca os 4 débitos como em cleanup.
- [x] `_run/minispec_state.yaml` marca `execution: completed`.

---

## 8. Como executar

```
/agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v4-debits/task_plan.md
```
