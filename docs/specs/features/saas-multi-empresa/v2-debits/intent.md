# INTENT — Cleanup de Débitos Técnicos · saas-multi-empresa · v2-debits

> **Tipo**: Versão de débitos (gerada por `/agent-spec-debt-resolution`).
> **Origem**: `docs/specs/features/saas-multi-empresa/v1/_run/run-report.md`
> **Variante**: backend
> **Data**: 2026-07-29

## 1. Identificação

- **Feature**: saas-multi-empresa
- **Versão**: v2-debits
- **Versão pai**: v1 (feature original)
- **Variante**: backend (herdada de v1)
- **Origem dos débitos**: `docs/specs/features/saas-multi-empresa/v1/_run/run-report.md`
- **Tipo de operação**: cleanup técnico (zero feature nova)

---

## 2. Objetivo

Resolver **12 débitos técnicos** acumulados na execução de `v1`, classificados como aceitáveis para passar pelos gates (severidade `MEDIO`/`BAIXO`) mas que prejudicam manutenibilidade, precisão da evidência ou propagam anti-padrões se deixados sem ação.

A versão é gerada via skill `/agent-spec-debt-resolution` que:

1. Coletou **12** débitos elegíveis de `_run/run-report.md` da `v1` (3 `MEDIO`, 9 `BAIXO`).
2. Submeteu ao agente especialista (`__default__` — `.claude/agents/` contém apenas os 3 agentes reservados aos gates, sem candidato executor) para classificação binária.
3. Apresentou a classificação ao usuário, que selecionou **os 12** para cleanup nesta rodada.
4. Nenhum débito ficou fora do escopo.

### Granularidade: agrupamento por arquivo, a pedido explícito do usuário

O padrão da skill é 1 task por débito. Aqui os 12 débitos se concentram em **4 arquivos** — sete deles no mesmo `tasks/T9.md` da v1 —, o que tornaria as 12 tasks **integralmente sequenciais** e faria sete delas disputar o mesmo arquivo a cada rodada de gate.

O usuário optou explicitamente por **agrupar por arquivo**, gerando **4 tasks com arquivos disjuntos** e portanto paralelizáveis. A rastreabilidade débito → task é preservada: cada task lista os débitos que resolve, e o `scope.md` mantém o mapa completo.

---

## 3. Resultado esperado

Após execução desta versão via `/agent-spec-minispec-run-tasks`:

- Os 12 débitos resolvidos em 4 tasks agrupadas por arquivo.
- Suíte de testes da feature continua passando (cleanup não muda comportamento observável).
- §2 do `_run/run-report.md` da `v1` marca os débitos em cleanup; `_run/workflow-report.md` registra a execução.
- Diff esperado: correções de prosa em dois arquivos de task, e dois ajustes pontuais em scripts de gate (`-a` num grep; `except Exception` num bloco).

---

## 4. Critérios de sucesso

- [ ] Todas as 4 tasks aprovadas pelos gates aplicáveis.
- [ ] Suíte de testes da feature inteira passa sem regressão.
- [ ] Nenhum arquivo fora do escopo de cada task modificado.
- [ ] Os dois scripts de gate (`portao_orfaos.py`, `veredito_suite.sh`) continuam **falsificáveis** — provados nos três estados após a alteração.
- [ ] §2 do `_run/run-report.md` da `v1` marca os débitos em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Premissas

- A `v1` está encerrada: T8 concluída, T9 concluída **parcial** (aceita por decisão do usuário sem aprovação de gate), T1 bloqueada.
- Os débitos coletados refletem o estado real após a 8ª rodada da T9.
- As 4 tasks tocam arquivos disjuntos, logo são paralelizáveis — o orquestrador re-verifica os guards.

### Premissa que exige atenção

**Dois débitos (D-005 e D-007) têm a mesma correção textual em dois arquivos diferentes** — o script e o `T9.md`. Como o agrupamento por arquivo separa esses lados em tasks distintas (T2 e T4), a redação final precisa ser coerente entre elas. Isso está registrado como guardrail cruzado nas duas tasks.

Isto não é detalhe de forma: o padrão dominante de defeito da `v1` — oito ocorrências — foi exatamente *corrigir num lugar e não varrer o vizinho*. O agrupamento por arquivo, que resolve o problema de paralelismo, reintroduz esse risco. As tasks T2 e T4 apontam uma para a outra por isso.

---

## 6. Fora do escopo

- **Funcionalidade nova**: zero. Esta versão é cleanup puro.
- **Refactor arquitetural**: nenhum débito exige ADR.
- **Os AC pendentes da T9** (AC-1, AC-2, AC-5) e os `CT-028`/`CT-029` **não** entram aqui — dependem da T2 da `v1`, não são débito.
- **A T1 bloqueada** não é tratada nesta versão.
- **As pendências operacionais registradas na §4 do run-report da v1** (`allow_tests: true` no `frontend`; `developer_mode: 0` em ambos os ambientes; T10 fora do alcance da stack nova; emenda da ADR-0002) **não** são débito de código — são decisões suas, e continuam registradas lá.

---

## 7. Próximo passo

```
/agent-spec-minispec-run-tasks docs/specs/features/saas-multi-empresa/v2-debits/task_plan.md
```

Tempo estimado total: ~90 minutos (soma dos custos individuais dos 12 débitos).
