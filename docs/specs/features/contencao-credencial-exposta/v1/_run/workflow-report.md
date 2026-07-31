[TC-001] base_sha=d758f3588da64696abf2685146c1b5f4ec764e06
[run] executor resolvido: __default__ (origem: descoberta interativa — nenhum agente de stack em .claude/agents/)
[run] execução em 2 fases por decisão do usuário: Fase A reversível automática; passos destrutivos (revogação, remoção de .map/dumps, developer_mode) exigem confirmação explícita
[TC-001] FASE A concluída — 164 testes OK; produção alterada (nginx allowlist + bundle com credencial de serviço)
[TC-001] RUN PAUSADO pelo usuário antes dos gates — retomar com (a) Retomar nos gates
[TC-001] gates pendentes: qa (opus), tech_review (opus)
[TC-001] Fase B (destrutiva) NÃO executada: revogação, .map, dumps, developer_mode
[TC-001] resume: usuário escolheu (a) Retomar nos gates — base_sha herdado, nova linha NÃO persistida (Passo 5.0.2 exceção)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[TC-001] git add -N aplicado nos 5 task_paths — diff --name-only confirma os 5
[TC-001] Gate 1 QA (opus) → APROVADO_COM_OBSERVACOES · 8/8 critérios Fase A · 11/11 CTs · 164 testes OK · 3 baixos
[TC-001] QA rule_candidates: 2 sinais (repeated_fixture, repeated_assertion_shape) persistidos em _run/rule-candidates.md
[TC-001] Gate 2 Tech Review (opus) → PARCIAL · 1 ALTO (P1 architecture) · 2 MEDIO (P2 security, P3 architecture) · 4 BAIXO
[TC-001] TR consultou: ADR-0001 (N/A), ADR-0002 (cumprida)

### TC-001 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 2, security: 2, code_quality: 2, project_pattern: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: high, qa_security_flags: 3 flags, diff_stat_changed: false]
- requires_qa_revalidation: true
- decisao: RE-QA obrigatório na próxima rodada (P1/P3 architecture + P2 security estão em revalidation_required)
[TC-001] P1 exige DECISÃO HUMANA (Caminho A: ADR + AC novo | Caminho B: reabrir Fase A) — escalado ao usuário antes de relançar o executor
[TC-001] retry 1 — Gate 1 QA (opus) → APROVADO_COM_OBSERVACOES · 9/9 critérios (AC-15 incluído) · 24 CTs · 167 testes OK · 2 baixos
[TC-001] QA validou P2 por TESTE DE MUTAÇÃO: db.set_value no lugar de papel.save() → test_ct062 falha ('Website User' != 'System User'); patch restaurado, md5 conferido
[TC-001] rule_candidates: RC-001 deduplicado (tema equivalente já persistido); RC-002 novo anexado
[TC-001] retry 1 — Gate 2 Tech Review (opus) → APROVADO_COM_OBSERVACOES · 0 bloqueantes · 4 BAIXOS (P4, P5, P8, P9)
[TC-001] TR consultou: ADR-0002, ADR-0003
[TC-001] staged: patches.txt, patches/v1_0/criar_papel_servico_app.py, tests/test_patch_criar_papel_servico_app.py, tests/test_integracao_bancaria_api.py, deploy/nginx/react-default.conf, docs/adr/0003-*.md, docs/adr/INDEX.md, docs/specs/features/contencao-credencial-exposta/**
[TC-001] memória lazy _run/tmp/TC-001.md deletada (cleanup_on_approval)
[run] rule_candidates: 3 sinais persistidos em _run/rule-candidates.md (qa=3, staff=0, orquestrador=0)
[TC-001] Status: Concluído (Fase A) — Fase B retida aguardando confirmação humana

## agent-spec-debt-resolution — 2026-07-28

- Executor (classificação): `__default__` (origem: nenhum agente de stack em `.claude/agents/`; reutilizada a escolha da sessão)
- Débitos coletados: 7 (todos BAIXO)
- Recomendados pela LLM: 2 (D-003, D-005)
- Perfumaria: 5 (D-001, D-002, D-004, D-006, D-007)
- Selecionados pelo usuário: 2
- Paralelismo derivado: T1 e T2 = `Não` — colisão de path em `tests/test_patch_criar_papel_servico_app.py` (T1 acrescenta CT, T2 remove asserção)
- T1 forçada a `gates: [qa, tech_review]`: `patches/v1_0/` bate com Critical Path (`security` + `db_migrations`)
- Output: docs/specs/features/contencao-credencial-exposta/v2-debits/
- Comando para executar: /agent-spec-minispec-run-tasks docs/specs/features/contencao-credencial-exposta/v2-debits/task_plan.md

### Observações levantadas na geração (não bloqueantes)

- **D-004 é parcialmente inexecutável por esta skill**: exige corrigir a §6.1/§7.2 da TaskCard de `v1` (o número "15 métodos" não bate com o regex — são 14 entradas / 22 endpoints), e o guardrail 2 proíbe alterar artefatos da versão original. A correção da spec precisa ser feita fora deste fluxo.
- **Raiz de D-005 está na spec**: o card CT-022 da §10 da TaskCard `v1` pede literalmente o passo que gerou a asserção infalível. Corrigir só o teste resolve o sintoma; o card deve ser ajustado numa revisão futura da spec.

## v2-debits/T2 — 2026-07-28

- **D-005 resolvido**: removida `self.assertNotEqual(user.name, "Administrator")` do helper `_criar_system_manager` (`tests/test_patch_criar_papel_servico_app.py`), infalível por construção (o `name` do `User` inserido é sempre o literal `tc001-system-manager@example.com`). Mantida `self.assertIn("System Manager", frappe.get_roles(user.name))`, que é falsificável. Forma A do §4.2 de T2.md. Suíte completa: 168/168 testes OK, sem regressão.
- **Observação para revisão futura da spec (raiz do débito)**: o card **CT-022** (§10 da TaskCard `task-01-contencao-credencial-exposta.md` de `v1`) pede literalmente o passo "afirmar que ele não é o Administrator", que foi o que gerou a asserção infalível corrigida acima — o mesmo padrão que já havia sido removido uma vez em `test_ct054` (`BAIXO-002` da attempt 1 do QA). Se a TaskCard `v1` for regenerada ou o CT-022 for reaproveitado como referência para um novo CT, **o passo deve ser reformulado** para não pedir uma asserção sobre uma precondição garantida por construção do teste (ex.: documentar a precondição em comentário/docstring, como ficou no código após esta correção, em vez de pedir uma asserção `assertNotEqual` sobre ela). Esta task (T2) não alterou a TaskCard `v1` — guardrail respeitado.
