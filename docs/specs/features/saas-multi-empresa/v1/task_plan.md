# TASK PLAN — saas-multi-empresa v1

> **Documento de referência/índice.** O detalhamento de cada task vive exclusivamente em `tasks/TN.md`.

## 1. Identificação

- **Feature**: `saas-multi-empresa` v1 — Fundação versionável e ambiente de execução
- **Variante**: backend
- **Tech Spec**: `docs/specs/features/saas-multi-empresa/v1/tech_spec.md`
- **PRD**: `docs/prds/features/saas-multi-empresa/v1/prd.md`
- **Data**: 2026-07-29
- **Total**: 10 tasks em 2 fases

---

## 2. Fases

### Fase 1 — Fundação versionável

Leva a estrutura de dados e as regras de negócio para o repositório. Concentra todo o risco de regressão da versão: é aqui que a produção é tocada, e o ambiente destrutível ainda não existe.

### Fase 2 — Ambiente de execução

Libera disco, monta o ambiente novo isolado e versiona as rotinas agendadas. Encerra com a suíte migrada para o ambiente novo, conforme ADR-0006.

---

## 3. Tabela de Tasks

| ID | Nome | Fase | Dependências | Paralelo (derivado) | model | risk | gates | Status |
|----|------|------|--------------|---------------------|-------|------|-------|--------|
| T1 | Validar a premissa da convergência e versionar o cadastro piloto | 1 | — | **Sim** (com T4) | opus | medium | [qa, tech_review] | **Em Progresso** (reaberta 2026-07-30) |
| T2 | Versionar os 13 cadastros restantes e convergir a propriedade | 1 | T1 | Não | opus | high | [qa, tech_review] | A Fazer |
| T3 | Descartar cadastros sem uso, órfãos e Server Scripts desativados | 1 | T2 | Não | opus | high | [qa, tech_review] | A Fazer |
| T4 | Capturar as caracterizações das regras antes da migração | 1 | — | **Sim** (com T1) | opus | medium | [qa, tech_review] | A Fazer |
| T5 | Módulo de imóvel: regra de metragem e dois endpoints migrados | 1 | T4 | Não | opus | high | [qa, tech_review] | A Fazer |
| T6 | Migrar a geração do documento de contrato | 1 | T4, T5 | Não | opus | high | [qa, tech_review] | A Fazer |
| T7 | Migrar os dois endpoints restantes e encerrar os Server Scripts | 1 | T5, T6 | Não | opus | high | [qa, tech_review] | A Fazer |
| T8 | Remover o ambiente de homologação obsoleto e medir a folga de disco | 2 | — | **Sim** (com T10) | sonnet | medium | [qa] | **Concluído** |
| T9 | Subir a stack nova isolada, com banco vazio | 2 | T8, T2, T3 | Não | opus | high | [qa, tech_review] | Concluído **PARCIAL** (aceito s/ gate) |
| T10 | Versionar as rotinas agendadas com instalador idempotente | 2 | — | **Sim** (com T8) | opus | high | [qa, tech_review] | A Fazer |

### 3.1 Derivação do paralelismo

O flag é **computado** pelo Invariante de Paralelismo, não autorado:

| Par | DAG independente | Símbolos disjuntos | Paths disjuntos | Alta contenção | Resultado |
|-----|------------------|--------------------|-----------------|----------------|-----------|
| T1 × T4 | ✔ (nenhuma é ancestral da outra) | ✔ (T1 cria definição de cadastro; T4 cria referências de teste) | ✔ (`doctype/conjunto/` × `tests/`) | ✔ nenhuma toca `hooks.py` ou `patches.txt` | **paralelo-seguras** |
| T8 × T10 | ✔ | ✔ (nenhum símbolo compartilhado) | ✔ (remoção de infraestrutura × `deploy/`) | ✔ | **paralelo-seguras** |

Todas as demais recebem `Não`: cada uma depende de outra da mesma fase, direta ou transitivamente. **T5, T6 e T7 são sequenciais mesmo sem dependência de símbolo entre si** — as três tocam `hooks.py`, arquivo de alta contenção.

---

## 4. Rastreabilidade User Stories → Tasks

| User Story (PRD) | Definição Técnica (Tech Spec) | Tasks | Status |
|------------------|-------------------------------|-------|--------|
| US-01 — estrutura reconstruível a partir do repositório | §3.5, §5.1, §7.3 | T1, T2, T9 | A Fazer |
| US-02 — regras de negócio no repositório | §3.2, §5.1, §6.3 | T4, T5, T6, T7 | A Fazer |
| US-03 — descarte dos cadastros sem uso | §6.1, §7.3, §7.4 | T3 | A Fazer |
| US-04 — contrato dos endpoints preservado | §4.1, §15.1 | T5, T7 | A Fazer |
| US-05 — ambiente obsoleto removido com medição | §12.3, §16 | T8 | A Fazer |
| US-06 — ambiente novo isolado | §16.2, §16.4 | T9 | A Fazer |
| US-07 — rotinas versionadas e instaláveis | §9.2, §13, §16.3 | T10 | A Fazer |
| US-08 — operação sem regressão | §19 | T4 (rede de referência) + verificação em T5, T6, T7 | A Fazer |

**Observação sobre a Regra 5** (máx ~3 tasks por US): a **US-02** aparece em 4 tasks. A decomposição foi revisada e mantida — ela cobre **6 regras distintas em 4 módulos de destino diferentes**, e a granularidade segue o arquivo de destino, não fragmentação artificial. Consolidar T5 e T6 juntaria a regra de 10 linhas com a de 752 num único commit; consolidar T7 nas anteriores misturaria módulos sem relação de domínio.

---

## 5. Rastreabilidade CT → Task

Os 29 casos de teste do `_run/test-cases.json` foram redistribuídos sem reinvocar o gerador (a Estratégia de Testes do tech spec já os cobria). **Cada CT pertence a exatamente uma task.**

| Task | Casos de Teste |
|------|----------------|
| T2 | `CT-001`, `CT-002`, `CT-003`, `CT-004`, `CT-005`, `CT-011` |
| T3 | `CT-006`, `CT-007`, `CT-008`, `CT-009`, `CT-010` |
| T5 | `CT-012`, `CT-013`, `CT-014`, `CT-021`, `CT-024`, `CT-025` |
| T6 | `CT-015`, `CT-016`, `CT-017`, `CT-018` |
| T7 | `CT-019`, `CT-020`, `CT-022`, `CT-023`, `CT-026`, `CT-027` |
| T9 | `CT-028`, `CT-029` |
| T1, T4, T8, T10 | Sem CT próprio — ver justificativa na §6 de cada task |

**T1** é validação empírica (o artefato de código é coberto pelo `CT-001` da T2). **T4** entrega a rede de referência que os CTs de T5 e T6 consomem. **T8** e **T10** são operacionais, fora do alcance da suíte — o tech spec registra isso na §19.6.

---

## 6. Ordem de Execução e Restrições

1. **T4 precede T5, T6 e T7 obrigatoriamente.** A caracterização tem de ser capturada com a regra original ainda ativa; invertida, a RN-08 vira declaração vazia.
2. **T1 precede T2.** O escopo da T2 depende do resultado da validação: se o model sync convergir sozinho, o patch sai e a T2 encolhe.
3. **T8 precede T9** por dependência física — sem folga de disco medida, subir o segundo ambiente é aposta.
4. **T9 depende de T2 e T3** por conteúdo: o repositório precisa conter a estrutura versionada e o descarte aplicado para que a reconstrução prove o que afirma.
5. **Inversão temporal aceita**: T1, T2 e T3 tocam a estrutura do ambiente que atende a operação, porque o ambiente destrutível só nasce na T9. Cada uma exige backup verificado imediatamente antes. A ADR-0006 passa a valer plenamente a partir da T9.

---

## 7. Critérios de Conclusão da Feature

A v1 está concluída quando:

- [ ] Os 11 critérios de aceite do PRD estão satisfeitos — 7 por suíte, 4 por verificação operacional com evidência registrada (tech spec §19.6)
- [ ] Um ambiente vazio recebe a fundação completa a partir do repositório, sem intervenção manual
- [ ] Nenhuma regra de negócio ativa vive apenas no ambiente de execução
- [ ] O aplicativo publicado funciona sem ter sido alterado
- [ ] O papel de serviço permanece com 1 Role e 9 `Custom DocPerm` (ADR-0003)
- [ ] A folga de disco comporta dois ambientes, medida antes e depois
- [ ] O instalador de rotinas roda duas vezes sem duplicar entrada
- [ ] Nenhum script versionado carrega credencial (ADR-0005)
- [ ] A suíte executa no ambiente novo (ADR-0006)
- [ ] A imobiliária operou sem interrupção percebida durante toda a versão
