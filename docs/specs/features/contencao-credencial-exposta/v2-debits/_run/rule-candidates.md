# Rule candidates — contencao-credencial-exposta/v2-debits

> Append-only. Cada tópico abaixo é um candidato a regra detectado durante um run.
> Consumido por `/agent-spec-mine-rule-candidates` (agrupa por tema) e `/agent-spec-curate-project-rules` (decide se vira regra).

## [repeated_fixture] Builder único de User de teste

**Regra que isto sugere:** centralizar a criação de `User` de teste (delete-if-exists, insert, `add_roles`, `clear_cache`) num builder compartilhado da suíte.

**O que ela faria (simples):** quatro helpers quase idênticos criam um `User` de teste no mesmo arquivo, variando só o email e o papel atribuído. Uma regra apontando um builder único evita que a próxima variação do setup (ex.: um campo novo obrigatório em `User`) precise ser replicada em quatro lugares e divirja em silêncio.

- Evidência: helpers `_criar_usuario_sem_papeis`, `_criar_usuario_servico_app`, `_criar_system_manager` e `_criar_usuario_com_papel_de_servico` repetem o mesmo bloco — `tests/test_patch_criar_papel_servico_app.py:215`, `:305`, `:412`, `:607` — T1 / patch de permissão `Servico App`
- Sinal: `repeated_fixture` · Origem: `agent-spec-qa-validator` · 2026-07-28T11:00:00Z

> **Reincidência**: o mesmo tema já foi emitido no run da `v1` (ver `../v1/_run/rule-candidates.md`), então com 8 pontos na suíte inteira. Dois runs independentes convergindo no mesmo sinal reforça o candidato — é o débito D-007, deliberadamente adiado para tratamento sistemático via `/agent-spec-curate-project-rules`.

---

## [repeated_assertion_shape] Asserção de contagem exata dos DocPerm

**Regra que isto sugere:** expressar a contagem canônica de `Custom DocPerm` do papel por uma constante ou helper de asserção único, em vez do literal `9` repetido.

**O que ela faria (simples):** a mesma forma de asserção sobre o tamanho do conjunto aparece em três testes com o literal `9` embutido. Se o contrato do conjunto mudar, é preciso caçar cada ocorrência — e o teste que escapar passa a mentir sem falhar.

- Evidência: `assertEqual(len(...docperms...), 9)` repetido em CT-049, CT-061 e CT-063 — `tests/test_patch_criar_papel_servico_app.py:161`, `:521`, `:604` — T1 / testes do patch `Servico App`
- Sinal: `repeated_assertion_shape` · Origem: `agent-spec-qa-validator` · 2026-07-28T13:00:00Z

---
