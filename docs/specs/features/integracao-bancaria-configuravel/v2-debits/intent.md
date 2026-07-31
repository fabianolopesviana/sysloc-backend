# INTENT — Cleanup de Débitos Técnicos · integracao-bancaria-configuravel · v2-debits

> **Tipo**: Versão de débitos (gerada por `/agent-spec-debt-resolution`).
> **Origem**: `docs/specs/features/integracao-bancaria-configuravel/v1/_run/run-report.md`
> **Variante**: backend
> **Data**: 2026-07-21

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v2-debits
- **Versão pai**: v1 (feature original — integração bancária configurável pelo frontend)
- **Variante**: backend (herdada de v1)
- **Origem dos débitos**: `docs/specs/features/integracao-bancaria-configuravel/v1/_run/run-report.md` (§2)
- **Tipo de operação**: cleanup técnico (zero feature nova)

---

## 2. Objetivo

Resolver **os 9 débitos técnicos** acumulados na execução de `v1` — a totalidade do que a política débito-controlado deixou passar (todos `BAIXO`). Nenhum débito fica pendente após esta versão.

A versão é gerada via skill `/agent-spec-debt-resolution` que:

1. Coletou **9 débitos** elegíveis da §2 do `_run/run-report.md` da `v1` (todos `BAIXO`; nenhum crítico/alto indevido).
2. Submeteu ao agente especialista (`__default__` — orquestrador genérico, pois o projeto não tem especialista de stack Frappe em `.claude/agents/`) para classificação binária: **5 `recomendado_corrigir`** e **4 `perfumaria`**.
3. Apresentou a classificação ao usuário, que optou por **cleanup completo**: os 9 débitos entram nesta rodada, incluindo os 4 de perfumaria.
4. **Nenhum débito** fica registrado como fora do escopo — a §2 do `scope.md` está vazia por decisão consciente.

---

## 3. Resultado esperado

Após execução desta versão via `/agent-spec-minispec-run-tasks`:

- Cada débito vira **1 task atômica** em `tasks/T{n}.md` (9 tasks).
- A suíte de **114 testes** da feature continua passando (cleanup não muda comportamento observável), exceto a redução deliberada de 1 teste em T6.
- §2 do `_run/run-report.md` da `v1` marca os 9 débitos em cleanup; `_run/workflow-report.md` registra a execução.
- Diff esperado: pequeno na maioria (anotações de tipo, docstring, `except`, remoção de teste, enxugamento de retorno) e **médio em T4 e T8**, que tocam contrato canônico e código de produção.

---

## 4. Critérios de sucesso

- [ ] Todas as 9 tasks aprovadas pelos gates aplicáveis (QA em todas; Tech Review em 8 delas, por tocarem path crítico).
- [ ] Suíte de testes da feature inteira passa sem regressão (113 testes após T6 — ver §3.3 do scope).
- [ ] Nenhum arquivo fora do escopo de cada débito modificado.
- [ ] §2 do `_run/run-report.md` da `v1` marca os 9 débitos em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Premissas

- A `v1` está **concluída**: 13/13 tasks aprovadas pelos gates, 114 testes verdes, estrangulamento fechado (5 operações no canônico, corte do contador aplicado em produção).
- Os débitos coletados refletem o estado real após a última execução de `/agent-spec-sdd-run-tasks` na `v1`.
- **Tasks NÃO são todas independentes**: com os 9 débitos, há colisão de arquivo em `modelo.py` (T1/T4/T5), `mapeamento.py` (T2/T4) e `boletos_abertos.py` (T7/T8/T9). O paralelismo foi derivado conservadoramente — ver `task_plan.md §5`.
- **Ambiente**: o app roda em container Docker; a suíte só executa via `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation`. O site `frontend` é **produção**.

---

## 6. Fora do escopo

- **Funcionalidade nova**: zero. Esta versão é cleanup puro.
- **Débitos não listados**: se durante a execução surgirem novos débitos, registre em `_run/workflow-report.md` e deixe para uma `v3-debits/`. Não os resolva aqui.
- **Nenhum débito coletado ficou de fora** — diferentemente do padrão da skill, esta rodada é de cleanup completo.

---

## 7. Riscos assumidos conscientemente

Ao incluir os 4 débitos de `perfumaria`, esta versão assume riscos que o especialista havia sinalizado. Vale explicitar:

| Débito | Risco assumido |
|---|---|
| **D-004** (T4) | Escopo real **maior que o registrado**: introduzir `codigo_erro` canônico toca `modelo.py`, `adapter.py`, `mapeamento.py`, `consulta.py` e **também `confirmacao_baixa.py`** (que ramifica pelo mesmo literal). Altera contrato canônico consumido pelo fluxo de consulta/confirmação em produção. Estimativa de ~20min é provavelmente conservadora. |
| **D-005** (T5) | Altera `mapear_situacao_boleto`, função canônica **compartilhada** por consulta, baixa e sincronização. A divergência atual é fail-safe; ampliar a normalização muda o mapeamento de textos-limite. |
| **D-008** (T8) | Toca `rotina_pagamentos.py` — **código de produção** do fluxo de cobrança, fora do módulo da feature. Hoje a duplicação é mitigada por CT-019. |
| **D-009** (T9) | Reescreve a montagem do PDF consolidado (bufferização por boleto). A janela do bug é vazia no MVP (boletos de 1 página). |

Mitigação comum: a suíte de 114 testes é o oráculo; os gates rodam Tech Review em 8 das 9 tasks; e cada task proíbe expansão de escopo.

---

## 8. Próximo passo

```
/agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v2-debits/task_plan.md
```

Tempo estimado total: **~72 minutos** de execução (soma dos custos individuais; não inclui tempo de gates).
