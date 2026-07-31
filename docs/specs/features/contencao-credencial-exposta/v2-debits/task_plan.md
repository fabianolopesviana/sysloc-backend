# TASK PLAN — Cleanup de Débitos · contencao-credencial-exposta · v2-debits

## 1. Identificação

- **Feature**: contencao-credencial-exposta
- **Versão**: v2-debits
- **Versão pai**: v1 (TaskCard TC-001)
- **Variante**: backend
- **Intent**: `docs/specs/features/contencao-credencial-exposta/v2-debits/intent.md`
- **Scope**: `docs/specs/features/contencao-credencial-exposta/v2-debits/scope.md`
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-28
- **Agente especialista (classificação)**: `__default__`
- **Status**: Concluído

---

## 2. Objetivo Técnico

Resolver 2 débitos técnicos atômicos. T2 é `gates: [qa]` (cleanup puro); **T1 é `gates: [qa, tech_review]`** porque toca `patches/v1_0/` — path em Critical Path (`security` + `db_migrations`). A suíte existente é o oráculo de regressão; T1 acrescenta 1 caso de teste, exigido pela própria correção do gate.

---

## 3. Macro-Fases

- **Fase 1 — Cleanup**
  - Objetivo: aplicar correção pontual de cada débito.
  - Tasks: T1, T2 — **sequenciais**, por colisão de arquivo (ver §4).

> Por que 1 fase só: os débitos são independentes em lógica. A sequencialidade vem da colisão de path, não de dependência técnica.

---

## 4. Lista de Tasks

| ID | Nome | Arquivo da task | Débito original | Custo (min) | model | risk | gates | Paralelo? | Status |
|----|------|-----------------|-----------------|-------------|-------|------|-------|-----------|--------|
| T1 | Convergência do conjunto de Custom DocPerm | [T1](tasks/T1.md) | D-003 (security) | ~25 | sonnet | medium | [qa, tech_review] | **Não** — colide com T2 em `test_patch_criar_papel_servico_app.py` | Concluído |
| T2 | Remover asserção infalível em CT-060 | [T2](tasks/T2.md) | D-005 (tests) | ~10 | sonnet | low | [qa] | **Não** — colide com T1 no mesmo arquivo | Concluído |

**Derivação do flag `Paralelo?` (Regra 10d — nunca autorado):**

- T1 modifica `patches/v1_0/criar_papel_servico_app.py` **e** `tests/test_patch_criar_papel_servico_app.py` (o CT que cobre a correção).
- T2 modifica `tests/test_patch_criar_papel_servico_app.py`.
- Interseção de paths ≠ ∅ → o guard "paths disjuntos" falha → **`Não` para ambas**. O orquestrador faria fallback para sequencial de qualquer forma; declarar `Sim` seria autoria indevida.

---

## 5. Ordem de Execução

```
Fase 1 (sequencial — colisão de paths):

  T1 ──→ T2

  T1 acrescenta o CT de remoção de resíduo ao arquivo de teste.
  T2 remove a asserção infalível do mesmo arquivo.

  A ordem inversa também é válida logicamente, mas T1 primeiro evita
  que T2 seja re-verificada após o arquivo mudar.
```

### Grafo de Dependências

Nenhuma dependência técnica entre as tasks — a ordem vem da colisão de arquivo.

| Task | Depende de | Pode Rodar em Paralelo? |
|------|------------|-------------------------|
| T1 | — | Não (colisão de path com T2) |
| T2 | — | Não (colisão de path com T1) |

---

## 6. Arquivos / Áreas Impactadas (consolidado)

| Arquivo | Tasks que tocam | Categorias |
|---------|-----------------|------------|
| `app-sync/locacao_automation/locacao_automation/patches/v1_0/criar_papel_servico_app.py` | T1 | `security`, `db_migrations` (Critical Path) |
| `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` | T1, T2 | — |

> **Atenção do orquestrador**: as duas tasks tocam `test_patch_criar_papel_servico_app.py`. O guard "paths disjuntos" da rule `Execução Paralela de Tasks` força sequencial — já refletido na coluna `Paralelo?`.

---

## 7. Critérios de Conclusão Geral

- [x] Ambas as tasks com Status `Concluído`.
- [x] Suíte de testes da feature passa sem regressão — **168 testes** verdes.
- [x] Nenhum diff em arquivos fora da §6 (exceto `hooks.py` e `docs/adr/0003`, ampliação autorizada na attempt 2 de T1). **Em especial: zero alteração em `deploy/nginx/`, em `/opt/react/sysloc/` ou em artefatos da `v1`.**
- [x] §2 do `_run/run-report.md` da `v1` marca D-003 e D-005 em cleanup; `_run/workflow-report.md` registra a execução.
- [x] `_run/minispec_state.yaml` desta versão marca `execution: completed`.

---

## 8. Notas para a LLM Executora

### Convenções desta versão

- **NÃO** refatorar fora do escopo do débito específico.
- **NÃO** "aproveitar a oportunidade" para corrigir débitos não listados — em particular, os 5 débitos de `scope.md §2` estão **explicitamente fora**, com endereço declarado (F2, F3 ou curadoria de regra).
- **NÃO** tocar em `deploy/nginx/react-default.conf`, em `/opt/react/sysloc/**` ou em qualquer artefato da `v1`. A Fase B da TC-001 está retida e depende de produção intacta.
- **NÃO** criar testes novos — **exceto em T1**, onde a `correcao_sugerida` do gate exige explicitamente um CT que semeie `permlevel=1`. Sem ele a correção não é verificável.
- **SIM**: aplicar exatamente a `correcao_sugerida` da task — escopo cirúrgico.
- **SIM**: rodar `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation` (a partir de `/opt/frappe`) após cada modificação, confirmando zero regressão antes de retornar a task.

### Contexto que não pode ser perdido

O papel `Servico App`, alvo de T1, é aquele **cuja credencial de API está publicada no bundle JavaScript por desenho** (contenção da TC-001). Qualquer permissão a mais nele é alcançável a partir da internet. É por isso que D-003 — remover `Custom DocPerm` estranho ao conjunto declarado — tem valor real apesar de classificado `BAIXO`. A decisão arquitetural que rege esses DocPerm está na **ADR-0003**.

### Frontmatter de cada task

```markdown
- model: sonnet
- risk: low | medium
- gates: [qa] | [qa, tech_review]
- source: agent-spec-debt-resolution
- debito_origem: D-XXX
- task_origem_parent: TC-001
```

### Saída esperada do executor

```
✅ T{N} — Resolver D-XXX: <título curto> /
  Arquivos: N modificado(s) /
  Testes: <N de N passando, zero regressão> /
  Pendências: nenhuma
```
