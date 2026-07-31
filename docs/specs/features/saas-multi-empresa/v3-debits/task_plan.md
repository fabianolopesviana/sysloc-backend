# TASK PLAN — Cleanup de Débitos · saas-multi-empresa · v3-debits

## 1. Identificação

- **Feature**: saas-multi-empresa
- **Versão**: v3-debits
- **Versão pai**: v2-debits
- **Variante**: backend
- **Intent**: `docs/specs/features/saas-multi-empresa/v3-debits/intent.md`
- **Scope**: `docs/specs/features/saas-multi-empresa/v3-debits/scope.md`
- **Origem**: gerado por `/agent-spec-debt-resolution` em 2026-07-30
- **Agente especialista (classificação)**: `__default__`
- **Status**: Concluído

---

## 2. Objetivo Técnico

Fechar **2 débitos de `error_handling`** da `v2-debits`, ambos no bloco `except`/`finally` de `main()` em `deploy/scripts/portao_orfaos.py`.

Dos 6 débitos coletados, 2 foram selecionados. O critério foi **código vs prosa** — ver `intent.md` §3 e `scope.md` §2 para o registro dos 4 que ficaram fora.

O oráculo de regressão é duplo:
1. **Os 4 estados do portão inalterados** + **2 casos novos** que falsificam os débitos (`scope.md` §3.4).
2. **Nenhuma linha de prosa alterada** — provado por comparação, não afirmado (§4.4 da task).

---

## 3. Macro-Fases

- **Fase 1 — Cleanup**
  - Objetivo: corrigir o tratamento de erro do bloco `except`/`finally`.
  - Tasks: T1 (única).

---

## 4. Lista de Tasks

| ID | Nome | Arquivo da task | Débitos | Arquivo alvo | Custo (min) | model | risk | gates | Paralelo? (derivado) | Status |
|----|------|-----------------|---------|--------------|-------------|-------|------|-------|----------------------|--------|
| T1 | Fechar o exit 1 do teardown e localizar o diagnóstico do corpo | [T1](tasks/T1.md) | D-003, D-006 | `deploy/scripts/portao_orfaos.py` | ~40 | sonnet | medium | [qa, tech_review] | **N/A** (task única) | **Concluído** |

### 4.1 Derivação do paralelismo

**Não se aplica** — a versão tem uma única task. O flag é `N/A`, não `Sim`: não há par a avaliar.

### 4.2 Por que os dois débitos foram agrupados

Decisão explícita do usuário, sobre recomendação do especialista. Os dois vivem nas **mesmas linhas** (383-389) e o gate revisa o **diff do arquivo inteiro** de uma vez — não débito por débito. Duas tasks separadas pagariam dois ciclos de gate pelo mesmo diff, sem ganho de auditabilidade.

### 4.3 Por que `gates: [qa, tech_review]` e não o `[qa]` padrão de cleanup

Desvio deliberado, registrado em `scope.md` §3.3. Três razões:

- o arquivo é o gate que **bloqueia `bench migrate` em produção**, onde o código de saída tem significado contratual;
- a mudança é no **caminho de erro** desse gate;
- na `v2-debits`, o Tech Review sobre este e o arquivo vizinho produziu achados **reais** nas duas tasks em que rodou — `architecture` na T2 (racional duplicado em 3 fontes num arquivo cujo cabeçalho nomeia isso como a causa dos débitos) e `best_practices` na T3 (inventário de acoplamento desatualizado). Não foi desperdício.

---

## 5. Ordem de Execução

```
Fase 1:
  T1 — deploy/scripts/portao_orfaos.py (exige stack nova de pé)
```

### Grafo de Dependências

| Task | Depende de | Pode Rodar em Paralelo? |
|------|------------|-------------------------|
| T1 | — | N/A (task única, Concluído) |

---

## 6. Arquivos / Áreas Impactadas (consolidado)

| Arquivo | Tasks que tocam | Débitos | Categorias |
|---------|-----------------|---------|------------|
| `deploy/scripts/portao_orfaos.py` | T1 | D-003, D-006 | `error_handling` |

> **Atenção do orquestrador**: um único arquivo, uma única task. Qualquer diff fora dele é desvio de escopo e deve ser revertido. Em especial, `deploy/scripts/veredito_suite.sh` e os arquivos de task das versões anteriores estão **fechados e staged** — não são desta versão.

---

## 7. Critérios de Conclusão Geral

- [x] T1 com Status `Concluído`.
- [x] Nenhum caminho de exceção do arquivo produz **exit 1 sem `PORTAO_VEREDITO`** (o alvo do D-003) — provado nos 6 casos + no vetor de `sys.tracebacklimit` 0/-1. Ressalva registrada como débito: dois pontos latentes (o `!r` da guarda e o `str(e)` do teardown) ainda podem escapar sob `__repr__`/`__str__` quebrados — ver §2 do `_run/run-report.md`.
- [x] O diagnóstico do `except` do corpo nomeia **onde** a exceção ocorreu (o alvo do D-006) — inclusive quando a exceção nasce no framework, reportando a linha do corpo + a origem.
- [x] `portao_orfaos.py` provado nos **6 casos** de `scope.md` §3.4, com saída colada — refeitos pelo Gate 1 nas 3 rodadas.
- [~] Suíte **não executada** — não-execução justificada e aceita pelo Gate 1 nas 3 rodadas (o diff não toca uma linha de código do app; toca só `deploy/scripts/`). O oráculo de 6 casos foi a validação funcional real.
- [x] **Nenhuma linha de prosa do docstring alterada** — hash `fd8874e9433063970f161cce45a0f332`, 195 linhas, idêntico nas 3 rodadas.
- [x] Nenhum diff em arquivos fora da seção 6.
- [x] Ambiente devolvido limpo — portão VERDE, 739 alvos, resíduo zero (o único plantio foi do Gate 1 na rodada 1, removido pela receita com varredura como última ação).
- [x] §2 do `_run/run-report.md` da `v2-debits` marca D-003 e D-006 em cleanup; `_run/workflow-report.md` registra a execução.
- [x] `_run/minispec_state.yaml` desta versão marca `execution: completed`.

---

## 8. Notas para a LLM Executora

### Convenções desta versão

- **NÃO** criar testes novos. É cleanup.
- **NÃO** refatorar fora do escopo dos dois débitos.
- **NÃO** tocar prosa. Nenhuma linha de docstring. Os 4 débitos de prosa foram **deliberadamente excluídos** (`scope.md` §2) — dois deles no mesmo arquivo, num bloco vizinho.
- **NÃO** editar `deploy/scripts/veredito_suite.sh` nem arquivos de task das versões anteriores.
- **SIM**: provar a falsificabilidade após a alteração e colar a saída.

### O contexto que importa para calibrar

Esta é a **terceira** versão de cleanup em cadeia (v1 → v2-debits → v3-debits) da mesma feature. O padrão de defeito dominante nas duas anteriores, em **8 ocorrências**, foi *corrigi num lugar e não varri os vizinhos*.

Três dessas ocorrências foram originadas em **instruções do orquestrador**, não do executor — inclusive uma em que uma exigência de rigor (ancorar afirmações em `file:linha`) criou por si mesma um acoplamento novo que o inventário do arquivo não cobria.

**A defesa que funcionou não foi mais cuidado — foi trocar o método de medição.** Três técnicas fecharam achados que rodadas de oráculo não fechavam:

- **diferencial contra a versão do index** (`git show :arquivo`) — revelou perda de cobertura **fora** do contrato dos casos de teste;
- **injeção seletiva de falha** — provar que cada caminho de erro falha **fechado**, individualmente, em vez de "o script sobrevive";
- **prova por hash** em vez de reauditoria — permitiu de-escalar gates com segurança.

Use as três. Elas estão detalhadas na §4.4 da task.

### Comando de teste canônico da stack

```
docker compose -f deploy/compose/docker-compose.stack-nova.yaml -p frappe-stack-nova \
  exec -T backend bench --site verificacao run-tests --app locacao_automation
```

O `bench run-tests` **sai 0 mesmo com falha** — o veredito é o placar textual. Use `deploy/scripts/veredito_suite.sh` (endurecido e aprovado pelos dois gates na `v2-debits`) quando quiser exit code confiável; o `2>&1` é obrigatório e a forma está no cabeçalho dele.

### Saída esperada do executor

```
✅ T1 — <nome curto> /
  Arquivos: 1 modificado /
  Testes: 6 casos provados + placar idêntico (169/9/161/1) /
  Pendências: <ou "nenhuma">
```
