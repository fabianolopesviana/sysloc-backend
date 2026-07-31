# Rule candidates — integracao-bancaria-configuravel/v5

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Fixture de usuário admin duplicada em test_boletos_abertos

**Regra que isto sugere:** centralizar o helper `_criar_usuario` (usuário com/sem System Manager) numa base de teste compartilhada, parametrizando `first_name`.

**O que ela faria (simples):** o mesmo helper de criação de usuário administrativo foi copiado integralmente para uma segunda classe no mesmo arquivo, mudando só o `first_name`; uma base compartilhada evita que as duas cópias divirjam quando uma for corrigida e a outra não.

- Evidência: `_criar_usuario` idêntico (exceto `first_name`) em `TestBaixarConsolidadoStreamingSeguranca` (linha 234, pré-existente) e `_BaseUsuarioAdministrativoTest` (linha 295, novo em v5/T1) — `v5/T1 / testes de boletos_abertos`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T22:30:00Z

---
## [repeated_fixture] Decisão explícita em chamadas de teste de salvar_configuracao

**Regra que isto sugere:** todo teste que grava via `salvar_configuracao` passa `decisao` explicitamente, salvo quando o próprio RN-08 é o objeto do teste.

**O que ela faria (simples):** o mesmo argumento `decisao="aceitar"` teve de ser acrescentado em 14 chamadas espalhadas por dois arquivos de teste para que os casos parassem de depender de haver boletos em aberto reais no site de produção; uma regra escrita evita que o próximo teste nasça acoplado a esse estado ambiente e volte a falhar de forma intermitente.

- Evidência: `decisao="aceitar"` replicado em 14 chamadas de `salvar_configuracao` em 2 arquivos — `T2 / v5 — RN-08 em salvar_configuracao`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-21T23:15:00Z

---
