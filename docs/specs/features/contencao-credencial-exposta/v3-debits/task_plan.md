# TASK PLAN — Cleanup de Débitos · contencao-credencial-exposta · v3-debits

## 1. Identificação

- **Feature**: contencao-credencial-exposta
- **Versão**: v3-debits
- **Versão pai**: v2-debits
- **Variante**: backend
- **Intent**: `docs/specs/features/contencao-credencial-exposta/v3-debits/intent.md`
- **Scope**: `docs/specs/features/contencao-credencial-exposta/v3-debits/scope.md`
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-28
- **Agente especialista (classificação)**: `__default__`
- **Status**: Concluído

---

## 2. Objetivo Técnico

Resolver 2 débitos técnicos atômicos, ambos com `gates: [qa]`. Nenhum toca Critical Path nem produção: T1 acrescenta um teste, T2 acrescenta uma frase numa ADR. A suíte existente é o oráculo de regressão.

---

## 3. Macro-Fases

- **Fase 1 — Cleanup**
  - Objetivo: aplicar correção pontual de cada débito.
  - Tasks: T1, T2 — **paralelizáveis** (paths disjuntos; ver §4).

---

## 4. Lista de Tasks

| ID | Nome | Arquivo da task | Débito original | Custo (min) | model | risk | gates | Paralelo? | Status |
|----|------|-----------------|-----------------|-------------|-------|------|-------|-----------|--------|
| T1 | Teste de wiring do `after_migrate` | [T1](tasks/T1.md) | D-001 (tests) | ~15 | sonnet | low | [qa] | **Sim** — paths disjuntos | Concluído |
| T2 | Delimitar o escopo da falha na ADR-0003 | [T2](tasks/T2.md) | D-003 (adr_compliance) | ~5 | sonnet | low | [qa] | **Sim** — paths disjuntos | Concluído |

**Derivação do flag `Paralelo?` (Regra 10d — nunca autorado):**

- T1 modifica `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py`.
- T2 modifica `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md`.
- Interseção de paths = ∅; nenhum é arquivo de alta contenção; sem dependência no DAG; símbolos `N/A` nas duas → **`Sim` para ambas**.

> Diferente da `v2-debits`, onde as duas tasks colidiam no mesmo arquivo de teste e o guard forçou sequencial.

---

## 5. Ordem de Execução

```
Fase 1 (paralelo — guards satisfeitos):

  T1 ─┐
      ├→ orquestrador detecta lote paralelizável (2 ≤ MAX_PARALLEL=4)
  T2 ─┘

  Guard de recursos de teste: T2 não tem teste de integração
  (é edição de markdown), então não há risco de suítes concorrentes.
  Apenas o QA de T1 executa a suíte.
```

### Grafo de Dependências

| Task | Depende de | Pode Rodar em Paralelo? |
|------|------------|-------------------------|
| T1 | — | Sim |
| T2 | — | Sim |

---

## 6. Arquivos / Áreas Impactadas (consolidado)

| Arquivo | Tasks que tocam | Categorias |
|---------|-----------------|------------|
| `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` | T1 | — (arquivo de teste; nenhum Critical Path) |
| `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md` | T2 | — (documentação) |

---

## 7. Critérios de Conclusão Geral

- [x] Ambas as tasks com Status `Concluído`.
- [x] Suíte passa sem regressão — **169 testes** verdes.
- [x] O teste de T1 é falsificável (resolve o hook via `frappe.get_hooks` + `frappe.get_attr`), não um `assertIn` sobre a string.
- [x] Nenhum diff em arquivos fora da §6. **Em especial: zero alteração em `hooks.py`, no patch, em `deploy/nginx/`, em `/opt/react/sysloc/` ou em artefatos da `v1`/`v2-debits`.**
- [x] §2 do `_run/run-report.md` da `v2-debits` marca D-001 e D-003 em cleanup.
- [x] `_run/minispec_state.yaml` desta versão marca `execution: completed`.

---

## 8. Notas para a LLM Executora

### Convenções desta versão

- **NÃO** refatorar fora do escopo do débito específico.
- **NÃO** corrigir o débito **D-002** (extrair o módulo de `patches/v1_0/` para local permanente) — está explicitamente fora, com endereço declarado em `saas-multi-empresa` v2. Mexer nele quebraria o `frappe.get_attr` do hook se o path errar.
- **NÃO** tocar `hooks.py`, o patch `criar_papel_servico_app.py`, `deploy/nginx/**`, `/opt/react/sysloc/**` ou qualquer artefato da `v1`/`v2-debits`.
- **NÃO** criar testes novos — **exceto em T1**, onde o débito *é* a ausência do teste.
- **SIM**: rodar `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation` (a partir de `/opt/frappe`) após cada modificação.

### Contexto que não pode ser perdido

O papel `Servico App` tem a credencial de API **publicada no bundle JavaScript por desenho** (contenção da TC-001). O `after_migrate` que T1 vai testar é hoje o **único** mecanismo que impede permissão residual de sobreviver nesse papel — o `patches.txt` não cobre, porque `install_app` marca os patches como concluídos sem executá-los. É por isso que a ausência de rede regressiva importa, apesar de classificada `BAIXO`.

A decisão arquitetural está na **ADR-0003**, que T2 vai editar (apenas acrescentando uma frase em `Consequences`; o `Decision` é intocável).

### O erro a evitar em T1

Um teste que faça `assertIn("locacao_automation...", hooks.after_migrate)` **apenas espelha a configuração** — passa sempre que a string existir, mesmo que o módulo tenha sido renomeado ou que a função tenha deixado de convergir. O QA reprova isso como `tautological_assertion`, e já reprovou duas vezes nesta feature.

A forma correta resolve o path pelo **mesmo mecanismo que o framework usa** (`frappe/migrate.py:145-147`), semeia um `Custom DocPerm` residual e chama a **função resolvida**. Assim o teste falha em três modos reais: hook removido, typo no dotted path, e regressão de convergência.

### Frontmatter de cada task

```markdown
- model: sonnet
- risk: low
- gates: [qa]
- source: agent-spec-debt-resolution
- debito_origem: D-XXX
- task_origem_parent: T1 (de v2-debits)
```

### Saída esperada do executor

```
✅ T{N} — Resolver D-XXX: <título curto> /
  Arquivos: N modificado(s) /
  Testes: <N de N passando, zero regressão> /
  Pendências: nenhuma
```
