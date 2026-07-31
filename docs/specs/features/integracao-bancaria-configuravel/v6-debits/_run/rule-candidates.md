# Rule candidates — integracao-bancaria-configuravel/v6-debits

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_assertion_shape] Consulta global escopada com delta antes/depois

**Regra que isto sugere:** em suíte que roda contra o site de produção, toda asserção sobre coleção global compara o CONJUNTO antes/depois escopado por filtro, nunca uma contagem absoluta.

**O que ela faria (simples):** a suíte roda contra o site `frontend`, que é produção e já tem dados; um teste que assertasse "existe 1 Error Log" ou "total de configs == 2" quebraria por causa de dados alheios ao teste. O padrão do delta escopado já foi reinventado três vezes no mesmo arquivo — uma regra escrita evita que o próximo teste use contagem absoluta e vire flaky.

- Evidência: mesma forma (`frappe.get_all` com filtro estreito + comparação de conjunto/delta antes vs. depois) reimplementada em 3 helpers — `tests/test_integracao_bancaria_api.py:545`, `:553`, `:722` — v6-debits/T1 / observabilidade do catch-all de `salvar_configuracao`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-22T05:10:00Z

---

## [repeated_fixture] Isolamento de `frappe.local.response` em teste

**Regra que isto sugere:** todo teste que asserta sobre `frappe.local.response` inicializa e restaura o canal no próprio setUp, via helper compartilhado.

**O que ela faria (simples):** o mesmo bloco de zerar `frappe.local.response` e restaurar por `addCleanup` já existe em dois arquivos de teste, copiado à mão. Sem uma regra (e um helper), o terceiro teste que ler esse canal global vai esquecer o setup e passar por sorte, dependendo da higiene de outro arquivo — que foi exatamente o débito D-002 que esta versão corrigiu.

- Evidência: bloco `frappe.local.response = frappe._dict()` + `addCleanup(setattr(...))` duplicado entre `tests/test_boletos_abertos.py:272` e `tests/test_integracao_bancaria_api.py:524` — v6-debits/T2 / isolamento de estado global em testes de configuração bancária
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-22T05:45:00Z

---
