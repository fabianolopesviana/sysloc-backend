# Rule candidates — contencao-credencial-exposta/v1

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Helper de usuário de teste com papéis

**Regra que isto sugere:** centralizar a criação de usuário de teste com papéis num helper único compartilhado pela suíte.

**O que ela faria (simples):** a mesma fixture de usuário (deletar se existir, inserir com `ignore_permissions`, `add_roles`, `clear_cache`, `set_user` com `addCleanup`) foi reescrita três vezes só nesta task, e a §11 da TaskCard registra que já existia replicada em outros três arquivos de teste. Uma regra apontando o helper canônico evita que cada suíte invente a sua variante e que correções de isolamento precisem ser aplicadas em N lugares.

- Evidência: três implementações quase idênticas de criação de usuário de teste com papéis — `tests/test_patch_criar_papel_servico_app.py:190`, `:280`, `tests/test_integracao_bancaria_api.py:465` — TC-001 / patch de papel e DocPerms + RN-11
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-27T17:20:00Z

---

## [repeated_assertion_shape] Asserção de permissão efetiva em matriz

**Regra que isto sugere:** padronizar a verificação de permissão efetiva como matriz `subTest(doctype, ptype)` sobre `frappe.has_permission`, reforçada por `get_role_permissions` quando o wrapper puder curto-circuitar.

**O que ela faria (simples):** o mesmo formato de asserção (`with self.subTest(...)` envolvendo `has_permission(doctype, ptype)`) aparece em quatro lugares, e em dois deles foi preciso descobrir na marra que o wrapper `has_permission` responde antes de olhar o DocPerm — uma regra escrita pouparia essa redescoberta e evitaria que um teste futuro pare no wrapper e nunca possa falhar.

- Evidência: padrão `subTest` + `has_permission` repetido em quatro pontos — `tests/test_patch_criar_papel_servico_app.py:320`, `:351`, `:359`, `tests/test_integracao_bancaria_api.py:530` — TC-001 / permissão efetiva do papel Servico App
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-27T17:20:00Z

---

## [repeated_assertion_shape] Permissão resolvida via get_role_permissions

**Regra que isto sugere:** medir permissão efetiva de papel com `get_role_permissions(frappe.get_meta(doctype), user=...)`, não com `frappe.has_permission` sozinho.

**O que ela faria (simples):** `has_permission` pode responder por caminhos que não são o DocPerm (controller do próprio DocType, DocType não submissível), então sozinho ele passa mesmo quando a permissão do papel está errada. O padrão com `get_role_permissions` foi redescoberto três vezes neste run; escrever a regra evita que o próximo teste de permissão nasça infalível.

- Evidência: mesma forma `get_role_permissions(frappe.get_meta(X), user=Y).get(<ptype>)` em `tests/test_patch_criar_papel_servico_app.py:350`, `:379`, `:428` — duas delas adicionadas justamente para tornar uma asserção falsificável — TC-001 / testes de permissão efetiva e de sombreamento
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-28T00:10:00Z

---
