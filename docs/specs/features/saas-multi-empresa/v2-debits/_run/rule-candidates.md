# Rule candidates — saas-multi-empresa/v2-debits

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Oráculo do predicado de veredito como script versionado

**Regra que isto sugere:** o oráculo de um predicado de gate vive num script executável versionado ao lado dele, não como fixtures reescritas dentro de cada task que o altera.

**O que ela faria (simples):** as mesmas fixtures de placar (`Ran N tests` + `OK`/`FAILED (`) são reescritas à mão em cada bloco da §5.1 e, pelo guardrail §4.4, precisam ser espelhadas ainda numa segunda task — foi esse padrão de duplicação em três lugares que gerou o D-005 e os dois falsos-verdes da v1. Uma regra apontando um script de oráculo único faria a prova rodar por comando em vez de por colagem, e impediria que uma task provasse 8 casos enquanto a outra fala de 10.

- Evidência: fixtures de placar reescritas inline em 3 blocos da §5.1, com a asserção conferida a olho — `docs/specs/features/saas-multi-empresa/v2-debits/tasks/T2.md:138`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-29T23:10:00Z

---

## [repeated_assertion_shape] Asserção de exit code conferida a olho no oráculo

**Regra que isto sugere:** prova de exit code em oráculo de shell usa um helper que compara com o esperado e falha sozinho, não `echo "exit=$?"` lido por humano.

**O que ela faria (simples):** o mesmo `; echo "exit=$?"` aparece em todos os blocos da §5.1 e a verificação depende de alguém comparar 10 números impressos com 10 números da tabela — um caso desalinhado passa batido, que é como o oráculo de fixtures pequenas deixou o bug de SIGPIPE atravessar a rodada 1. Um `assert_exit <esperado>` faria o próprio oráculo ficar vermelho no caso errado.

- Evidência: `; echo "exit=$?"` como asserção manual em 3 blocos da §5.1 — `docs/specs/features/saas-multi-empresa/v2-debits/tasks/T2.md:138`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-29T23:10:00Z

---

## [repeated_assertion_shape] Prova de predicado de shell por saída colada

**Regra que isto sugere:** provas de predicado/gate em shell vivem num harness executável versionado em `deploy/scripts/`, não como saída colada na task.

**O que ela faria (simples):** a mesma forma de asserção — `<payload> | bash deploy/scripts/veredito_suite.sh; echo "exit=$?"` — se repete caso a caso na task, e o resultado só existe como texto colado; ninguém reexecuta. Uma regra apontando o harness versionado faria a prova rodar na CI e impediria que uma edição futura reabrisse um caso já fechado sem ninguém notar — foi por não haver harness que o vetor do ALTO-001 da 3ª rodada (fora dos 10 casos do oráculo) atravessou três rodadas invisível.

- Evidência: forma `... | bash deploy/scripts/veredito_suite.sh; echo "exit=$?"` repetida em 3 pontos do bloco da §5.1 — `docs/specs/features/saas-multi-empresa/v2-debits/tasks/T2.md:141`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-30T00:05:00Z

---
