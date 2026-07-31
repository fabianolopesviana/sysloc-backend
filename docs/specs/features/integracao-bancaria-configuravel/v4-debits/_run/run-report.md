# Relatório do Run — integracao-bancaria-configuravel/v4-debits

> Relatório para revisão humana. Telemetria de pipeline (base_sha, retries, mutações) vive em `_run/workflow-report.md`.

## 1. Resumo do Run

Status: **4/4 tasks concluídas** · 124 testes verdes (120 baseline + 4 novos) · 6 tentativas no total (T1–T3 na primeira; T4 em 3)

| Task | Nome | Modelo | Arquivos | QA | Tech Review |
|------|------|--------|----------|-----|-------------|
| T1 | Ajustar garantia documentada + extrair constante (D-001) | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T2 | Declarar premissa da preservação do binário (D-002) | sonnet | 1 mod | ✅ APROVADO | ✅ APROVADO |
| T3 | Renomear `_obter_pendente` → `_preparar_pendente` (D-004) | sonnet | 2 mod | ✅ APROVADO | ✅ APROVADO |
| T4 | Pré-validar `url_alvo` antes de apagar vínculos (D-003) | sonnet | 2 mod | ✅ APROVADO_COM_OBSERVACOES (3ª rodada) | ✅ APROVADO (2ª rodada) |

Os 4 débitos anotados na v3 estão resolvidos.

## 2. Débitos Técnicos Não Resolvidos

> Anotados pela política débito-controlado (severidade baixa não bloqueia). Resolva com `/agent-spec-debt-resolution docs/specs/features/integracao-bancaria-configuravel/v4-debits/`.

### D1 · BAIXO · tests · T4 · QA — ✓ RESOLVIDO em 2026-07-21 (correção direta, fora do framework)
- **Onde:** `tests/test_certificado_api.py:912`
- **Problema:** em `test_ct036_binario_ausente_e_recusado_sem_apagar_file`, a asserção `assertIn("certificado", res["message"].lower())` não discrimina o ramo de erro que o comentário promete verificar — a palavra "certificado" aparece **nas duas** mensagens (binário ausente e prefixo público).
- **Impacto:** o teste passaria se a validação disparasse o ramo errado. Não compromete a detecção da mutação relevante (removida a checagem de existência, o `insert` levanta `IOError` e o teste quebra de qualquer forma) — é imprecisão, não mascaramento de defeito.
- **O que fazer:** ~~trocar por termo discriminante~~ — **FEITO**. Aplicado `assertIn("encontrado", ...)` + `assertNotIn("privado", ...)`, com comentário explicando por que `"certificado"` não discriminava. Verificado que os termos de fato separam os ramos: a mensagem de prefixo público contém "privado" e não "encontrado"; a de binário ausente, o inverso. Suíte: 124 testes, OK.
- **Como foi decidido:** `/agent-spec-debt-resolution` rodou sobre esta versão; o especialista classificou como **perfumaria**, notando que a mutação relevante já quebra o teste via `IOError` — o defeito era a precisão do comentário, não o poder de detecção. Gerar uma v5-debits (intent+scope+task_plan+task+state + 2 gates × 124 testes) para uma troca de palavra seria desproporcional. O usuário optou por corrigir direto, sem versão de cleanup e sem ciclo de gates.

## 3. Tasks Bloqueadas

✅ **Nenhuma task bloqueada.** T4 consumiu as 3 tentativas do ciclo, mas aprovou na última.

## 4. Notas para Revisão Humana

**T4 valeu as 3 tentativas — os dois gates encontraram defeitos reais, cada um invisível ao outro.**

O **QA** rejeitou na 1ª rodada porque o negative companion partia de um ativo *sem* certificado próprio: `url_alvo` chegava **vazio** e o teste nunca atravessava o ramo que a task tinha acabado de criar. Ele duplicava o CT-016 sem cobrir nada — apagá-lo não mudaria a cobertura.

O **Tech Review** então encontrou o defeito mais sério, que o QA **não tinha como pegar**: `_criar_pendente_de_ativa` fazia `pendente.insert()` **antes** de chamar o helper. Como a exceção nova passou a ser convertida em `_falha(...)` em vez de propagar, a request **commitava um pendente parcial** — com senha, impressão digital e validade copiadas do ativo, sem `certificado_arquivo` — enquanto a API afirmava *"nenhuma alteracao foi feita"*. Antes da task, a exceção propagava e a request abortava com rollback.

O motivo de o QA não ver: `FrappeTestCase` roda em transação com rollback, então o commit real do request nunca acontece nos testes; e os casos do CT-036 corrompiam o campo do **pendente existente**, jamais o do **ativo com pendente ausente**. Um defeito de persistência que só se manifesta fora do harness de teste.

O TR ainda achou uma travessia de diretório: `/private/files/../../site_config.json` passava pelo `startswith` + `os.path.exists` e só era barrada no `insert` — **depois** das deleções, reabrindo o modo de falha original para urls com `..`. O QA confirmou em runtime que o alvo resolvia para um arquivo real.

**Na rodada final o QA foi além do que lhe foi pedido**: auditou *todos* os pontos que persistem estado, não só o que o TR apontou, confirmando que os 4 pontos de captura não escrevem nada antes do `try`.

**Uma sugestão do QA foi rejeitada com fundamento pelo TR.** O QA notou uma janela TOCTOU (a url é validada duas vezes, com o `insert` entre elas) e sugeriu reaproveitar o valor já validado. O TR rejeitou e não registrou nem como débito: o ajuste **não fecha a janela, só a move** (o `File.insert` do Frappe re-lê o disco de qualquer forma) e exigiria um parâmetro de bypass no helper, enfraquecendo a invariante "este helper sempre valida antes de apagar" para os outros 3 chamadores — trocar um risco inalcançável por um risco estrutural real.

**Escopo reduzido por decisão do especialista, honrado pelo executor.** Em D-001 e D-002 o especialista discordou das correções que o próprio Tech Review havia sugerido na v3 — mover a garantia para o `on_update` do controller (dispararia em todo `save()` do sistema) e adicionar checagem de runtime em `_apagar_certificado_privado` (especulativa, cenário inalcançável). As tasks proibiram explicitamente ambas, e o TR não as reabriu nesta versão.

**Custo/benefício de T4, avaliado pelo TR**: o débito era *perfumaria de risco médio*, e o diff fechou em +145 em produção — mas ~100 dessas linhas são documentação, num arquivo cuja densidade de comentário já é essa. O que o diff comprou não foi perfumaria: travessia de path acessível por campo persistido e commit de estado parcial sob mensagem que afirmava o contrário. Ambos encontrados por revisão, não por teste.

**4 sinais de rule mining** emitidos pelo QA: `repeated_assertion_shape` (o trio `assertFalse(success)` + mensagem + `assertNotIn` de RN-06 repetido em 3 testes) e `repeated_fixture` (o padrão `db.set_value(update_modified=False)` para montar precondição, em 4 pontos).
