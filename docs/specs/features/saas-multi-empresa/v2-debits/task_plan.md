# TASK PLAN — Cleanup de Débitos · saas-multi-empresa · v2-debits

## 1. Identificação

- **Feature**: saas-multi-empresa
- **Versão**: v2-debits
- **Versão pai**: v1
- **Variante**: backend
- **Intent**: `docs/specs/features/saas-multi-empresa/v2-debits/intent.md`
- **Scope**: `docs/specs/features/saas-multi-empresa/v2-debits/scope.md`
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-29
- **Agente especialista (classificação)**: `__default__`
- **Status**: Concluído

---

## 2. Objetivo Técnico

Resolver **12 débitos técnicos** da `v1` em **4 tasks agrupadas por arquivo** (granularidade solicitada explicitamente pelo usuário — ver `intent.md` §2). Cada task toca exatamente 1 arquivo; os quatro arquivos são disjuntos, logo o lote é integralmente paralelizável.

O oráculo de regressão é duplo:
1. **Suíte com placar idêntico** ao registrado (o vermelho de 169/9/161/1 é pré-existente, por dependência da T2 da v1).
2. **Falsificabilidade preservada** nos dois scripts de gate — provada, não afirmada (`scope.md` §3.4).

---

## 3. Macro-Fases

- **Fase 1 — Cleanup**
  - Objetivo: aplicar as correções pontuais de cada arquivo.
  - Tasks: T1 a T4, todas com flag de paralelismo derivado `Sim` (arquivos disjuntos, nenhum de alta contenção).

> Por que 1 fase só: os débitos são independentes e não há ordem técnica obrigatória. A única coordenação necessária é **textual** entre T2 e T4 (`scope.md` §3.6), não de ordem de execução.

---

## 4. Lista de Tasks

| ID | Nome | Arquivo da task | Débitos | Arquivo alvo | Custo (min) | model | risk | gates | Paralelo? (derivado) | Status |
|----|------|-----------------|---------|--------------|-------------|-------|------|-------|----------------------|--------|
| T1 | Cleanup de evidência da T8 | [T1](tasks/T1.md) | D-001, D-002, D-003 | `v1/tasks/T8.md` | ~10 | sonnet | low | [qa] | **Sim** (arquivo disjunto) | **Concluído** |
| T2 | Endurecer o predicado do `veredito_suite.sh` | [T2](tasks/T2.md) | D-005ᵈ, D-006, D-007 | `deploy/scripts/veredito_suite.sh` | ~23 | sonnet | medium | [qa, tech_review] | **Sim** (arquivo disjunto) | **Concluído** |
| T3 | Fechar o `exit 1` espúrio e documentar a receita no portão | [T3](tasks/T3.md) | D-010, D-012ᵈ | `deploy/scripts/portao_orfaos.py` | ~20 | sonnet | medium | [qa, tech_review] | **Sim** (arquivo disjunto) | **Concluído** |
| T4 | Cleanup de evidência e inventário da T9 | [T4](tasks/T4.md) | D-004, D-008, D-009, D-011 + partes-T9 de D-005/D-007/D-012 | `v1/tasks/T9.md` | ~37 | sonnet | low | [qa] | **Sim** (arquivo disjunto) | **Concluído** |

ᵈ **Débito dividido entre duas tasks** — D-005 e D-007 têm lado script (T2) e lado prosa (T4); D-012 tem lado docstring (T3) e lado amostras (T4). Ver o guardrail cruzado em `scope.md` §3.6 e §3.1.

### 4.1 Derivação do paralelismo

O flag é **computado**, não autorado:

| Par | DAG independente | Símbolos disjuntos | Paths disjuntos | Alta contenção | Resultado |
|-----|------------------|--------------------|-----------------|----------------|-----------|
| T1 × T2 | ✔ (nenhuma dependência) | ✔ (`N/A` em ambas) | ✔ (`T8.md` × `veredito_suite.sh`) | ✔ nenhuma | paralelo-seguras |
| T1 × T3 | ✔ | ✔ | ✔ (`T8.md` × `portao_orfaos.py`) | ✔ | paralelo-seguras |
| T1 × T4 | ✔ | ✔ | ✔ (`T8.md` × `T9.md`) | ✔ | paralelo-seguras |
| T2 × T3 | ✔ | ✔ | ✔ (`veredito_suite.sh` × `portao_orfaos.py`) | ✔ | paralelo-seguras |
| T2 × T4 | ✔ | ✔ | ✔ (`veredito_suite.sh` × `T9.md`) | ✔ | paralelo-seguras — **mas ver §4.2** |
| T3 × T4 | ✔ | ✔ | ✔ (`portao_orfaos.py` × `T9.md`) | ✔ | paralelo-seguras |

Nenhum dos quatro arquivos consta das categorias de alta contenção da rule (`container`/`router`/`barrel`/`manifests`/`migrations`).

### 4.2 Duas advertências ao orquestrador que os guards de path NÃO capturam

**(a) Acoplamento textual T2 ↔ T4.** Os guards provam independência de *arquivo*, não de *conteúdo*. D-005 e D-007 exigem a mesma redação em dois arquivos que estão em tasks distintas. Se as duas rodarem em paralelo, a coerência precisa ser conferida no Gate 1 de cada uma contra o texto da outra. **Alternativa aceitável**: rodar T2 antes de T4 e passar a redação escolhida como contexto. `scope.md` §3.6 é a fonte.

**(b) Guard de recursos de teste.** T2 e T3 verificam contra o **mesmo** site `verificacao`. A T3 **planta e remove um DocType**; a T2 só emula placares em stderr, sem tocar o banco. Se ambos os QAs forem executar a suíte, **serialize a etapa de QA** (a rule "Execução Paralela de Tasks" prevê isso). A T3 deve fazer sua varredura de limpeza **como última ação** — a v1 registrou resíduo remanescente duas vezes por confirmação intermediária.

---

## 5. Ordem de Execução

```
Fase 1 (lote paralelo de 4 — MAX_PARALLEL=4 cabe exatamente):
  T1 ─┐  T8.md            (só prosa, sem ambiente)
  T2 ─┤  veredito_suite.sh (verificação por emulação de placar)
  T3 ─┤  portao_orfaos.py  (exige stack nova de pé; planta/remove DocType)
  T4 ─┘  T9.md            (D-009 exige stack nova de pé)

  Serializar QAs de T2 e T3 se ambos rodarem a suíte (§4.2b).
  Conferir coerência textual T2 ↔ T4 no Gate 1 (§4.2a).
```

### Grafo de Dependências

Nenhuma dependência de execução entre tasks.

| Task | Depende de | Pode Rodar em Paralelo? |
|------|------------|-------------------------|
| T1 | — | Sim (Concluído) |
| T2 | — | Sim (Concluído) |
| T3 | — | Sim (Concluído) |
| T4 | — | Sim (Concluído) |

---

## 6. Arquivos / Áreas Impactadas (consolidado)

| Arquivo | Tasks que tocam | Débitos | Categorias |
|---------|-----------------|---------|------------|
| `docs/specs/features/saas-multi-empresa/v1/tasks/T8.md` | T1 | D-001, D-002, D-003 | documentation |
| `deploy/scripts/veredito_suite.sh` | T2 | D-005, D-006, D-007 | documentation, error_handling, logic |
| `deploy/scripts/portao_orfaos.py` | T3 | D-010, D-012 | error_handling, documentation |
| `docs/specs/features/saas-multi-empresa/v1/tasks/T9.md` | T4 | D-004, D-005, D-007, D-008, D-009, D-011, D-012 | documentation |

> **Atenção do orquestrador**: cada arquivo é tocado por **exatamente uma** task — o agrupamento foi feito para garantir isso. Se alguma task tentar editar arquivo de outra, é desvio de escopo e deve ser revertido.

---

## 7. Critérios de Conclusão Geral

- [x] Todas as 4 tasks com Status `Concluído`.
- [x] Suíte com placar **idêntico** ao registrado: 169 testes, 9 failures, 161 errors, 1 skipped. Desvio = regressão.
- [x] `veredito_suite.sh` provado nos **11 casos** de `scope.md` §3.4, incluindo `FAILED` com prefixo (o alvo do D-007), volume ≥ 64KB (vetor SIGPIPE), byte não-ASCII nos dois locales e `FAILED` sem parênteses (regressão de cobertura achada por diferencial contra o index).
- [x] `portao_orfaos.py` provado nos **4 estados** de `scope.md` §3.4, incluindo exceção inesperada no corpo → `exit 2` (o alvo do D-010).
- [x] Coerência textual T2 ↔ T4 conferida.
- [x] Nenhum diff em arquivos fora da seção 6.
- [x] Ambiente devolvido limpo (marcador presente; varredura por nome como última ação, sem resíduo).
- [x] §2 do `_run/run-report.md` da `v1` marca os 12 débitos em cleanup; `_run/workflow-report.md` registra a execução.
- [x] `_run/minispec_state.yaml` desta versão marca `execution: completed`.

---

## 8. Notas para a LLM Executora

### Convenções desta versão

- **NÃO** criar testes novos. As tasks são cleanup.
- **NÃO** refatorar fora do escopo dos débitos listados na task.
- **NÃO** "aproveitar a oportunidade" para corrigir o que não está listado. Se encontrar débito novo, **registre em `v1/_run/workflow-report.md`** como nota e siga.
- **NÃO** editar arquivo que pertence a outra task (§6).
- **SIM**: aplicar exatamente as correções descritas — escopo cirúrgico.
- **SIM**: para T2 e T3, **provar** a falsificabilidade após a alteração e colar a saída. Alterar um gate sem provar que ele ainda falha quando deve é o defeito que a v1 levou oito rodadas para fechar.

### O contexto que importa para calibrar

Esta versão limpa débito de uma feature cujo padrão dominante de defeito, em **oito ocorrências**, foi *corrigir num lugar e não varrer o vizinho* — sempre com a informação correta já escrita em algum artefato e a implementação ou a prosa divergente em outro.

O agrupamento por arquivo, que aqui resolve o paralelismo, **reintroduz esse risco** em D-005, D-007 e D-012, cujos lados foram separados entre tasks. É por isso que existe o guardrail cruzado (`scope.md` §3.6) e a advertência §4.2a.

### Frontmatter de cada task

```markdown
- model: sonnet
- risk: low | medium
- gates: [qa] | [qa, tech_review]
- source: agent-spec-debt-resolution
- debitos_origem: [D-XXX, ...]
- task_origem_parent: T8 | T9
```

### Comando de teste canônico da stack

```
docker compose -f deploy/compose/docker-compose.stack-nova.yaml -p frappe-stack-nova \
  exec -T backend bench --site verificacao run-tests --app locacao_automation
```

O `bench run-tests` **sai 0 mesmo com falha** — o veredito é o placar textual. O `deploy/scripts/veredito_suite.sh` existe para traduzir isso em código de saída; use-o quando quiser exit code confiável.

### Saída esperada do executor

```
✅ T{N} — <nome curto> /
  Arquivos: 1 modificado /
  Testes: placar idêntico (169/9/161/1) — sem regressão /
  Pendências: <ou "nenhuma">
```
