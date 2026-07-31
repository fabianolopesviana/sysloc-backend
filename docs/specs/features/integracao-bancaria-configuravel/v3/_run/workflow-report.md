# Workflow Report — integracao-bancaria-configuravel/v3

[run] executor resolvido: __default__ (origem: lista de candidatos vazia — .claude/agents/ contém apenas os 3 agentes de gates, todos excluídos como executores; default aplicado sem pergunta de opção única)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[run] diff strategy: repo com 1 commit (cfde4b2) e todo o código da v1/v2-debits staged mas NÃO commitado → delta da task isolado por `git diff -- <paths>` (working vs INDEX), NÃO por `git diff <base_sha>`
[T1] base_sha=cfde4b20eb5a4d5b5dc7523dcab020ed6adb679e
[T1] gates: [qa, tech_review] (declarado no frontmatter)   model: opus (declarado; critical_path=security+payments, risk=high)
[T1] tentativa 1: QA REJEITADO — 2 ALTOs de `tests` (poder de detecção), 1 BAIXO (colisão de ID). Código aprovado por leitura; QA confirmou a afirmação do `content_hash` no fonte do Frappe. Mutação A e B sobreviveram → 2 dos 3 call sites invisíveis à suíte.
[T1] tentativa 2: QA REJEITADO — CRIT-001 security: `_obter_pendente` sem a chamada de reconciliação (Mutação A do executor não restaurada). Suíte 120/2 falhas, vazamento reproduzido. ALTO-001/002 e BAIXO-001 da rodada 1 fechados; ressalva "2 vermelhos" validada pelo QA.
[T1] tentativa 3: QA APROVADO — 8/8, 120 testes OK. Restauracao provada por SHA-256 do arquivo. Mutacao A (2 vermelhos) e B (1 vermelho) reconfirmadas.
[T1] Tech Review (opus): APROVADO_COM_OBSERVACOES — 4 problemas BAIXO (architecture, error_handling x2, code_quality). Politica debito-controlado: nao bloqueiam.
[T1] staged: integracao_bancaria_api/service.py + tests/test_certificado_api.py
[run] rule_candidates: 1 sinal emitido pelo QA (repeated_fixture — mock de requests_pkcs12.post repetido em 4 pontos)

## agent-spec-debt-resolution — 2026-07-21

- Executor/especialista: __default__ (lista de candidatos vazia — `.claude/agents/` só tem os 3 agentes de gates)
- Débitos coletados: 4 (todos BAIXO, todos em `integracao_bancaria_api/service.py`)
- Recomendados pelo especialista: 3 (D-001, D-002, D-004)
- Perfumaria: 1 (D-003 — risco de regressão médio)
- Selecionados pelo usuário: 4 (todos, incluindo a perfumaria)
- Nota: o especialista DISCORDOU da correção proposta pelo Tech Review em D-001 (mover garantia para `on_update` do controller — descartado: dispararia em todo save do sistema) e em D-002 (checagem de runtime — descartada como especulativa). As tasks seguem o escopo reduzido.
- Output: docs/specs/features/integracao-bancaria-configuravel/v4-debits/
- Comando: /agent-spec-minispec-run-tasks docs/specs/features/integracao-bancaria-configuravel/v4-debits/task_plan.md
