# Workflow report — contencao-credencial-exposta/v2-debits

[run] executor resolvido: __default__ (origem: nenhum agente de stack em .claude/agents/)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[run] baseline contaminado detectado: TC-001 staged sem commit, com overlap de paths em T1/T2 → usuário autorizou commit; baseline resetado
[run] commits de reset: ac7c788 (TC-001), 4dc6c83 (specs + relatórios)
[run] lote paralelo: nenhum — T1 e T2 colidem em tests/test_patch_criar_papel_servico_app.py (guard "paths disjuntos") → fallback sequencial T1 → T2
[T1] base_sha=4dc6c832b5b0e212142a7c666e8d816f0b3b88dc
[T1] executor: sonnet (declarado) gates: [qa, tech_review] (declarado) risk: medium
[T1] ADRs injetadas no executor: ADR-0003 (fonte: task §3.3)
[T1] Gate 1 QA (opus) → APROVADO_COM_OBSERVACOES · 10/10 critérios · 168 testes (execução independente do gate) · 1 baixo (style: acento fora do padrão)
[T1] QA julgou o flake de deadlock: pré-existente em test_boletos_abertos.py, NÃO induzido pelo DELETE novo (runner sequencial, tabelas disjuntas)
[T1] QA verificou caso-limite nomes_declarados==[] em frappe/database/query.py:191-192 → NOT IN ('') , semanticamente correto
[T1] rule_candidates: 1 sinal (repeated_fixture) persistido — reincidente do run da v1
[T1] Gate 2 Tech Review (opus) → PARCIAL · 1 ALTO (P1 architecture) · 1 BAIXO (P2 code_quality)
[T1] TR consultou: ADR-0002, ADR-0003

### T1 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 1, code_quality: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: previsto]
- requires_qa_revalidation: true
- decisao: RE-QA obrigatório na próxima rodada (P1 é architecture)
[T1] P1 exige DECISÃO HUMANA + arquivo FORA do escopo declarado (§3.2 lista 2 arquivos; a correção precisa de hooks.py ou patches/v1_1/) — escalado ao usuário antes de relançar o executor

### T1 — escalonamento automático
- Tentativa 1: sonnet, Tech Review PARCIAL (P1 ALTO architecture: patch one-shot no Patch Log)
- Tentativa 2: escalado para opus[xhigh] (rule: last_severity == ALTO)
[T1] escopo AMPLIADO na attempt 2 por decisão do usuário: +hooks.py (after_migrate) +docs/adr/0003 (nota em Consequences). §3.2 da task atualizada para refletir.
[T1] decisão P1: after_migrate no hooks.py (opção preferida do TR) · decisão P2: corrigir junto (consulta única fail-safe)
[T1] retry 1 — Gate 1 QA (opus) → APROVADO_COM_OBSERVACOES · 14/14 critérios · 168 testes · 2 baixos
[T1] QA replicou a prova do P1 com versão mais forte (2 residuais + export=1, commit, migrate): 9 name idênticos ao baseline, Patch Log inalterado → só compatível com 'after_migrate rodou'
[T1] QA investigou e DESCARTOU residual não-reproduzível (0269b5321f) — artefato de sessão concorrente no site de produção; reforça prioridade de D-006
[T1] QA julgou defensável a falha ruidosa no after_migrate: post_schema_updates é @atomic, run_schema_updates já commitou; site não fica irrecuperável
[T1] rule_candidates: RC-001 deduplicado; RC-002 (repeated_assertion_shape) anexado
[T1] retry 1 — Gate 2 Tech Review (opus) → PARCIAL · 1 MEDIO (P1 adr_compliance) · 2 BAIXOS (P2, P3)
[T1] TR consultou: ADR-0002, ADR-0003
[T1] TR achado central: install_app chama set_all_patches_as_completed (installer.py:307-308) → patch NÃO roda nem em site novo; 'bootstrap' é falso e está gravado na ADR-0003

### T1 — retry classification
- attempt: 2
- problemas_por_categoria: { adr_compliance: 1, code_quality: 1, architecture: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium]
- requires_qa_revalidation: true (adr_compliance + override de área crítica)
- decisao: RE-QA na próxima rodada — porém a correção é de PROSA apenas (3 comentários), zero mudança de código
### T1 — escalonamento automático
- Tentativa 3 (última): opus (rule: attempt_count >= 2)
[T1] retry 2 — Gate 1 QA (opus) → APROVADO_COM_OBSERVACOES · 18/18 · 168 testes · 1 baixo
[T1] retry 2 — Gate 2 Tech Review (opus) → APROVADO_COM_OBSERVACOES · 0 bloqueantes · 2 BAIXOS (P3 carregado, P4 novo)
[T1] TR consultou: ADR-0002, ADR-0003
[T1] staged: criar_papel_servico_app.py, test_patch_criar_papel_servico_app.py, hooks.py, docs/adr/0003-*.md
[T1] memória lazy deletada (cleanup_on_approval) · Status: Concluído · 3 tentativas totais
[T2] base_sha=4dc6c832b5b0e212142a7c666e8d816f0b3b88dc
[T2] executor: sonnet (declarado) gates: [qa] (declarado) risk: low
[T2] ADRs injetadas no executor: nenhuma (task de cleanup em arquivo de teste)
[T2] Gate 1 QA (sonnet) → APROVADO · 6/6 critérios · 168 testes · zero problemas
[T2] Tech Review PULADO (gates: [qa])
[T2] staged: tests/test_patch_criar_papel_servico_app.py, docs/specs/features/contencao-credencial-exposta/**
[T2] Status: Concluído — 1 tentativa
[run] rule_candidates: 2 sinais persistidos em _run/rule-candidates.md (qa=2, staff=0, orquestrador=0)
[run] execução concluída: 2/2 tasks

## agent-spec-debt-resolution — 2026-07-28

- Executor (classificação): `__default__` (nenhum agente de stack em `.claude/agents/`)
- Débitos coletados: 3 (todos BAIXO, todos originados da T1 desta versão)
- Recomendados pela LLM: 2 (D-001, D-003)
- Perfumaria: 1 (D-002)
- Selecionados pelo usuário: 2
- Paralelismo derivado: T1 e T2 = `Sim` — paths disjuntos (`tests/test_patch_*.py` vs `docs/adr/0003-*.md`), nenhum de alta contenção
- Ambas as tasks com `gates: [qa]` — nenhum Critical Path tocado
- Output: docs/specs/features/contencao-credencial-exposta/v3-debits/
- Comando para executar: /agent-spec-minispec-run-tasks docs/specs/features/contencao-credencial-exposta/v3-debits/task_plan.md

### Observação sobre o encadeamento

Esta é a **segunda versão de cleanup consecutiva** (`v1` → `v2-debits` → `v3-debits`). Os débitos desta rodada nasceram da própria correção anterior. Registrado em `v3-debits/intent.md §7`: se surgir uma `v4-debits`, vale parar e absorver o restante em F2/F3 do refactory `saas-multi-empresa`, onde os cinco débitos remanescentes da `v1` já esperam.

### Nota sobre D-002 (não selecionado)

O especialista classificou como `perfumaria` com um argumento que vale registrar: extrair o módulo de `patches/v1_0/` para local permanente mudaria o path que o `after_migrate` resolve — errar quebra o `frappe.get_attr` em silêncio. Como o teste de D-001 resolve o hook **dinamicamente** (`get_hooks` + `get_attr`, não hardcoded), ele fica desacoplado dessa mudança futura e não cria dívida cruzada.
