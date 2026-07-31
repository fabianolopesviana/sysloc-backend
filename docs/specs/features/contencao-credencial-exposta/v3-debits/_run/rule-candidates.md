# Rule candidates — contencao-credencial-exposta/v3-debits

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Semeadura de Custom DocPerm residual duplicada

**Regra que isto sugere:** extrair um helper (`self._semear_docperm_residual()`) para o dict de `Custom DocPerm` residual (`permlevel=1`, `read=1`) usado para simular drift/escalonamento fora do conjunto declarado.

**O que ela faria (simples):** o mesmo literal de 9 campos foi copiado integralmente do CT-063 para o CT-064. Um helper compartilhado evita que os dois blocos divirjam silenciosamente numa futura edição — se um ganhar um campo e o outro não, os dois testes passam a simular estados diferentes sem que ninguém perceba.

- Evidência: dict `{doctype: "Custom DocPerm", parent: self.DOCTYPE_SEMEADO, ..., permlevel: 1, read: 1}` idêntico em dois testes da mesma classe — `tests/test_patch_criar_papel_servico_app.py:596` e `:658` — T1 / teste de wiring do `after_migrate`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-28T15:00:00Z

---
