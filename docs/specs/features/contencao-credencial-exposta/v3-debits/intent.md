# INTENT — Cleanup de Débitos Técnicos · contencao-credencial-exposta · v3-debits

> **Tipo**: Versão de débitos (gerada por `/agent-spec-debt-resolution`).
> **Origem**: `docs/specs/features/contencao-credencial-exposta/v2-debits/_run/run-report.md`
> **Variante**: backend
> **Data**: 2026-07-28

## 1. Identificação

- **Feature**: contencao-credencial-exposta
- **Versão**: v3-debits
- **Versão pai**: v2-debits (que por sua vez limpou débitos da `v1`)
- **Variante**: backend (herdada de v2-debits)
- **Origem dos débitos**: `docs/specs/features/contencao-credencial-exposta/v2-debits/_run/run-report.md`
- **Tipo de operação**: cleanup técnico (zero feature nova)

---

## 2. Objetivo

Resolver **2 débitos técnicos** acumulados na execução de `v2-debits`, ambos originados da task T1 daquela versão.

A versão é gerada via skill `/agent-spec-debt-resolution` que:

1. Coletou **3 débitos** elegíveis (todos `BAIXO`) de `_run/run-report.md` da `v2-debits`.
2. Submeteu ao agente especialista (`__default__`) para classificação binária.
3. Apresentou a classificação ao usuário, que selecionou **2** para cleanup nesta rodada.
4. O restante (**1** débito) fica registrado em `scope.md §2`, com endereço natural declarado.

### Contexto: por que estes débitos existem

A T1 da `v2-debits` corrigiu um patch Frappe que reconverge as permissões do papel `Servico App`. Durante os gates, o Tech Review descobriu que **o patch nunca reexecutava**: patches Frappe rodam uma vez e ficam no `Patch Log`; pior, `install_app` chama `set_all_patches_as_completed`, que marca todos os patches do app como concluídos **sem executá-los** — então nem em site novo o patch rodava.

A correção foi registrar `after_migrate` em `hooks.py` apontando para a mesma função `execute()`. Funciona, e foi verificado empiricamente duas vezes em produção. Os débitos desta versão são as arestas que sobraram dessa mudança.

**Contexto de risco**: o papel `Servico App` tem a credencial de API **publicada no bundle JavaScript por desenho** — é a contenção de uma credencial de `Administrator` que estava exposta. O `after_migrate` é hoje o **único** mecanismo que impede permissão residual de sobreviver nesse papel.

---

## 3. Resultado esperado

Após execução via `/agent-spec-minispec-run-tasks`:

- Cada débito selecionado vira **1 task atômica**, e as duas podem rodar **em paralelo** (arquivos disjuntos).
- Suíte cresce de 168 para **169 testes** (T1 acrescenta o teste de wiring).
- §2 do `_run/run-report.md` da `v2-debits` marca os débitos em cleanup; `_run/workflow-report.md` registra a execução.
- Diff esperado: um teste novo e uma frase numa ADR. Nenhuma linha de código de produção.

---

## 4. Critérios de sucesso

- [ ] As 2 tasks aprovadas pelo Gate 1 (QA) — ambas têm `gates: [qa]`.
- [ ] Suíte passa sem regressão — 169 testes.
- [ ] Nenhum arquivo fora do escopo de cada débito modificado.
- [ ] §2 do `_run/run-report.md` da `v2-debits` marca os débitos em cleanup.

---

## 5. Premissas

- A `v2-debits` está concluída: 2/2 tasks aprovadas pelos gates, 168 testes verdes.
- **A Fase B da TC-001 (`v1`) continua RETIDA** — revogação das chaves do `Administrator` e do `api@dominio.com`, remoção dos 3 `.map`, `developer_mode: 0`, remoção dos 6 dumps. Nenhuma task desta versão a executa nem a afeta.
- **Nenhuma task desta versão toca produção**: uma acrescenta teste, a outra acrescenta uma frase de documentação.
- As 2 tasks **são paralelizáveis**: T1 toca `tests/test_patch_criar_papel_servico_app.py`, T2 toca `docs/adr/0003-*.md`. Interseção vazia, nenhum é arquivo de alta contenção.

---

## 6. Fora do escopo

- **Funcionalidade nova**: zero.
- **Fase B da TC-001**: escopo retido da `v1`, aguardando confirmação humana. Não entra aqui.
- **Extração do módulo de `patches/v1_0/` para local permanente** (débito D-002): deliberadamente excluído — ver `scope.md §2`. Endereço natural: `saas-multi-empresa` v2.
- **Alteração de artefatos da `v1` ou da `v2-debits`**: proibida pelo guardrail 2 da skill. Só leitura.

---

## 7. Nota sobre o encadeamento de cleanups

Esta é a **segunda** versão de cleanup consecutiva desta feature (`v1` → `v2-debits` → `v3-debits`). Os débitos aqui nasceram da própria correção anterior. É um encadeamento que pode continuar indefinidamente — toda rodada de gates encontra algo.

Os dois débitos selecionados são genuinamente baratos (um teste e uma frase) e fecham o assunto do `after_migrate`. **Se uma futura rodada gerar `v4-debits`, vale parar e absorver o restante nas fases já planejadas do refactory** (`saas-multi-empresa` F2/F3), onde os cinco débitos remanescentes da `v1` já esperam.

---

## 8. Próximo passo

```
/agent-spec-minispec-run-tasks docs/specs/features/contencao-credencial-exposta/v3-debits/task_plan.md
```

Tempo estimado total: ~20 minutos (15 min de T1 + 5 min de T2).
