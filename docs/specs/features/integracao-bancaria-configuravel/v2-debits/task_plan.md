# TASK PLAN — Cleanup de Débitos · integracao-bancaria-configuravel · v2-debits

## 1. Identificação

- **Feature**: integracao-bancaria-configuravel
- **Versão**: v2-debits
- **Versão pai**: v1
- **Variante**: backend
- **Intent**: `docs/specs/features/integracao-bancaria-configuravel/v2-debits/intent.md`
- **Scope**: `docs/specs/features/integracao-bancaria-configuravel/v2-debits/scope.md`
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-21
- **Agente especialista (classificação)**: `__default__` (orquestrador genérico)
- **Status**: A Fazer

---

## 2. Objetivo Técnico

Resolver os **9 débitos técnicos** da `v1` (cleanup completo), cada task tocando exatamente 1 débito. A suíte existente (114 testes) é o oráculo de regressão. Nenhuma task adiciona funcionalidade nem cria testes novos.

---

## 3. Macro-Fases

As fases agrupam por **arquivo compartilhado**, não por dependência lógica (os débitos são independentes entre si). O agrupamento existe porque múltiplas tasks tocam o mesmo arquivo e precisam ser serializadas.

- **Fase 1 — Cleanups isolados** (paralelizáveis)
  - Objetivo: débitos cujos arquivos são disjuntos de todos os demais.
  - Tasks: **T3** (`patches/`), **T6** (`tests/`)
- **Fase 2 — Núcleo canônico** (sequencial — colidem em `modelo.py` / `mapeamento.py`)
  - Objetivo: débitos no modelo canônico e no adaptador.
  - Tasks: **T1** → **T2** → **T5** → **T4** (T4 por último: é o de maior escopo e toca os arquivos das anteriores)
- **Fase 3 — Apuração de boletos** (sequencial — colidem em `boletos_abertos.py`)
  - Objetivo: débitos do módulo de boletos em aberto.
  - Tasks: **T7** → **T9** → **T8** (T8 por último: é o único que também toca `rotina_pagamentos.py`, código de produção)

> As fases podem rodar em qualquer ordem entre si — não há dependência técnica entre elas. A ordem 1→2→3 é sugerida por ir do menor para o maior risco.

---

## 4. Lista de Tasks

| ID  | Nome | Arquivo da task | Débito original | Classificação | Custo (min) | model | risk | gates | Paralelo? (derivado) | Status |
|-----|------|-----------------|-----------------|---------------|-------------|-------|------|-------|----------------------|--------|
| T3 | Estreitar `except` na leitura da senha (Patch 1) | [T3](tasks/T3.md) | D-003 (error_handling) | recomendado | ~3 | sonnet | medium | [qa, tech_review] | **Sim** (arquivo disjunto) | Concluído |
| T6 | Remover teste que assere código-fonte | [T6](tasks/T6.md) | D-006 (testability) | recomendado | ~2 | sonnet | low | [qa] | **Sim** (arquivo disjunto) | Concluído |
| T1 | Sentinela único em `situacao_cru` | [T1](tasks/T1.md) | D-001 (code_quality) | recomendado | ~2 | sonnet | low | [qa, tech_review] | Não (colide em `modelo.py`) | Concluído |
| T2 | Corrigir docstring de `montar_payload_emissao` | [T2](tasks/T2.md) | D-002 (code_quality) | recomendado | ~5 | sonnet | low | [qa, tech_review] | Não (colide em `mapeamento.py`) | Concluído |
| T5 | Ampliar normalização de `mapear_situacao_boleto` | [T5](tasks/T5.md) | D-005 (technical_requirement) | perfumaria | ~10 | sonnet | medium | [qa, tech_review] | Não (colide em `modelo.py`) | Concluído |
| T4 | `codigo_erro` canônico em `ResultadoConsulta` | [T4](tasks/T4.md) | D-004 (architecture) | perfumaria | ~20 | sonnet | medium | [qa, tech_review] | Não (colide em `modelo.py`/`mapeamento.py`) | Concluído |
| T7 | Enxugar retorno de `listar_boletos_abertos` | [T7](tasks/T7.md) | D-007 (speculative_complexity) | recomendado | ~3 | sonnet | low | [qa, tech_review] | Não (colide em `boletos_abertos.py`) | Concluído |
| T9 | Bufferizar páginas no PDF consolidado | [T9](tasks/T9.md) | D-009 (error_handling) | perfumaria | ~12 | sonnet | medium | [qa, tech_review] | Não (colide em `boletos_abertos.py`) | Concluído |
| T8 | Filtro RN-02 em fonte única | [T8](tasks/T8.md) | D-008 (project_pattern) | perfumaria | ~15 | sonnet | medium | [qa, tech_review] | Não (colide em `boletos_abertos.py`) | Concluído |

**Total estimado: ~72 min** de execução (sem gates).

> **Por que 8 de 9 têm `tech_review`**: a rule `agent-spec-workflow-rules.md` (Critical Paths) força `[qa, tech_review]` quando o path do débito cai em categoria sensível. `cobranca_bancaria/`, `adaptadores/sicoob/`, `cobranca_sicoob/` e `integracao_bancaria_api/` são domínio de cobrança bancária (**payments/billing**); `patches/` é **db_migrations**. Só T6 (arquivo de teste) fica com `[qa]`.
>
> **Por que `risk: medium` em 5 tasks**: são as que o especialista classificou com `risco_regressao: baixo` (não "nenhum") **e** tocam código de produção no fluxo de dinheiro. Isso faz os gates escalarem o modelo adequadamente.

---

## 5. Ordem de Execução

```
Fase 1 — isolados (lote paralelo real, MAX_PARALLEL=4):
  T3 ─┐  patches/v1_0/migrar_configuracao_integracao_bancaria.py
  T6 ─┘  tests/test_emissao_sequencial.py
         (executores em paralelo; QAs SERIALIZADOS — suíte completa no mesmo site)

Fase 2 — núcleo canônico (SEQUENCIAL — colisão de arquivo):
  T1 → T2 → T5 → T4
  modelo.py ──── T1, T5, T4
  mapeamento.py ─ T2, T4
  (T4 por último: também toca adapter.py, consulta.py e confirmacao_baixa.py)

Fase 3 — apuração de boletos (SEQUENCIAL — colisão de arquivo):
  T7 → T9 → T8
  boletos_abertos.py ── T7, T9, T8
  (T8 por último: também toca rotina_pagamentos.py, produção)
```

### Grafo de Dependências

Nenhuma dependência **lógica** entre tasks. A serialização vem exclusivamente de **colisão de arquivo** (guard de paths disjuntos).

| Task | Depende de | Pode Rodar em Paralelo? | Motivo |
|------|------------|-------------------------|--------|
| T3 | — | **Sim** | `patches/` disjunto de todos |
| T6 | — | **Sim** | `tests/` disjunto de todos |
| T1 | — | Não | `modelo.py` compartilhado com T4, T5 |
| T2 | — | Não | `mapeamento.py` compartilhado com T4 |
| T5 | — | Não | `modelo.py` compartilhado com T1, T4 |
| T4 | — | Não | `modelo.py` + `mapeamento.py` compartilhados com T1, T2, T5 |
| T7 | — | Não | `boletos_abertos.py` compartilhado com T8, T9 |
| T9 | — | Não | `boletos_abertos.py` compartilhado com T7, T8 |
| T8 | — | Não | `boletos_abertos.py` compartilhado com T7, T9 |

> ⚠️ **Guard de recursos de teste (esperado disparar mesmo na Fase 1)**: o QA de TODA task roda a **suíte completa de integração** contra o site `frontend` (produção). Suítes concorrentes no mesmo DB geram flake. O orquestrador deve manter os **executores paralelos** mas **serializar os QAs** (ordem de ID).

---

## 6. Arquivos / Áreas Impactadas (consolidado)

| Arquivo | Tasks que tocam | Categorias |
|---------|-----------------|------------|
| `cobranca_bancaria/modelo.py` | **T1, T5, T4** | code_quality, technical_requirement, architecture |
| `cobranca_bancaria/adaptadores/sicoob/mapeamento.py` | **T2, T4** | code_quality, architecture |
| `cobranca_bancaria/adaptadores/sicoob/adapter.py` | T4 | architecture |
| `cobranca_sicoob/consulta.py` | T4 | architecture |
| `cobranca_sicoob/confirmacao_baixa.py` | T4 | architecture |
| `cobranca_sicoob/rotina_pagamentos.py` | T8 | project_pattern |
| `patches/v1_0/migrar_configuracao_integracao_bancaria.py` | T3 | error_handling |
| `integracao_bancaria_api/boletos_abertos.py` | **T7, T9, T8** | speculative_complexity, error_handling, project_pattern |
| `tests/test_emissao_sequencial.py` | T6 | testability |

> **Atenção do orquestrador**: 3 arquivos são tocados por múltiplas tasks (`modelo.py`, `boletos_abertos.py`, `mapeamento.py`). O guard "paths disjuntos" da rule `Execução Paralela de Tasks` deve forçar sequencial nessas — já refletido na coluna `Paralelo?` da §4.

---

## 7. Critérios de Conclusão Geral

- [ ] Todas as 9 tasks com Status `Concluído`.
- [ ] Suíte de testes da feature passa sem regressão (114 antes; **113 após T6**, que remove um teste redundante por design).
- [ ] Nenhum diff em arquivos fora da seção 6 acima.
- [ ] §2 do `_run/run-report.md` da `v1` marca os 9 débitos em cleanup; `_run/workflow-report.md` registra a execução.
- [ ] `_run/minispec_state.yaml` desta versão marca `execution: completed`.

---

## 8. Notas para a LLM Executora

### Ambiente (crítico — não há `bench` no host)

O app roda em container Docker (bind-mount `/opt/frappe/app-sync/locacao_automation` → `/home/frappe/frappe-bench/apps/locacao_automation`). Comando de teste canônico, a partir de `/opt/frappe`:

```
docker compose exec -T backend bash -lc 'cd /home/frappe/frappe-bench && bench --site frontend run-tests --app locacao_automation'
```

O site `frontend` é **produção** (dados reais). `FrappeTestCase` usa rollback transacional — não commite dados de teste.

### Convenções desta versão

- **NÃO** criar testes novos. Tasks são cleanup.
- **NÃO** refatorar fora do escopo do débito específico.
- **NÃO** "aproveitar a oportunidade" para corrigir outro débito que viva no mesmo arquivo — cada débito tem a sua task. Ex.: ao mexer em `modelo.py` na T1, **não** toque no `mapear_situacao_boleto` (é a T5) nem adicione `codigo_erro` (é a T4).
- **SIM**: aplicar exatamente a `correcao_sugerida` da task — escopo cirúrgico.
- **SIM**: rodar a suíte completa após a modificação e confirmar zero regressão antes de retornar a task.

### Atenção especial (tasks de perfumaria, incluídas por decisão do usuário)

- **T4** é a de maior escopo: o débito original citava `consulta.py`, mas `confirmacao_baixa.py` ramifica pelo mesmo literal e `ResultadoConsulta` é construído em 6 pontos (`mapeamento.py` ×2, `adapter.py` ×4). Trate os dois consumidores de forma consistente — senão o cleanup cria a inconsistência que pretendia remover.
- **T8** toca `rotina_pagamentos.py`, código de produção fora do módulo da feature. O CT-019 compara a apuração com o dry_run dessa rotina — se ele quebrar, a extração da constante mudou semântica.
- **T5** altera função canônica consumida por consulta/baixa/sincronização. Amplie a normalização **sem** alterar o conjunto de 6 valores do enum nem a preservação do texto cru.

### Frontmatter de cada task

```markdown
- model: sonnet
- risk: low | medium
- gates: [qa] | [qa, tech_review]
- source: agent-spec-debt-resolution
- debito_origem: D-XXX
- task_origem_parent: T{N}
```

### Saída esperada do executor

```
✅ T{N} — Resolver D-XXX: <título curto> /
  Arquivos: <N> modificado(s) /
  Testes: <N> passando, 0 regressões /
  Pendências: nenhuma
```
