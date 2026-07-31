# INTENT — Cleanup de Débitos Técnicos · contencao-credencial-exposta · v2-debits

> **Tipo**: Versão de débitos (gerada por `/agent-spec-debt-resolution`).
> **Origem**: `docs/specs/features/contencao-credencial-exposta/v1/_run/run-report.md`
> **Variante**: backend
> **Data**: 2026-07-28

## 1. Identificação

- **Feature**: contencao-credencial-exposta
- **Versão**: v2-debits
- **Versão pai**: v1 (feature original — TaskCard TC-001)
- **Variante**: backend (herdada do campo `Variante` da §1 de `tasks/task-01-contencao-credencial-exposta.md`)
- **Origem dos débitos**: `docs/specs/features/contencao-credencial-exposta/v1/_run/run-report.md`
- **Tipo de operação**: cleanup técnico (zero feature nova)

---

## 2. Objetivo

Resolver **2 débitos técnicos** acumulados na execução de `v1`, classificados como aceitáveis para passar pelos gates (severidade `BAIXO`, categorias `code_review_only`) mas que prejudicam manutenibilidade ou deixam aberto um caminho residual de escalonamento de privilégio.

A versão é gerada via skill `/agent-spec-debt-resolution` que:

1. Coletou **7 débitos** elegíveis de `_run/run-report.md` da `v1`.
2. Submeteu ao agente especialista (`__default__` — não há agente de stack registrado em `.claude/agents/`) para classificação binária (`recomendado_corrigir` / `perfumaria`).
3. Apresentou a classificação ao usuário, que selecionou **2** para cleanup nesta rodada.
4. Os demais **5** débitos ficam registrados em `scope.md §2 (Fora do escopo)` para auditoria — podem ser revisitados em uma futura `v3-debits/`, ou naturalmente absorvidos por F2/F3 do refactory `saas-multi-empresa`, como os gates recomendaram.

---

## 3. Resultado esperado

Após execução desta versão via `/agent-spec-minispec-run-tasks`:

- Cada débito selecionado vira **1 task atômica** em `tasks/T{n}.md`.
- Suíte de testes da feature continua passando (167 testes verdes hoje; T1 acrescenta 1 caso, então o alvo passa a 168).
- §2 do `_run/run-report.md` da `v1` marca os débitos em cleanup; `_run/workflow-report.md` registra a execução.
- Diff esperado: pequeno — um bloco de remoção de resíduo no patch (com o CT que o cobre) e a deleção de uma linha de asserção decorativa.

---

## 4. Critérios de sucesso

- [ ] As 2 tasks aprovadas pelos gates aplicáveis (T1 tem `[qa, tech_review]` por tocar área crítica; T2 tem `[qa]`).
- [ ] Suíte de testes da feature inteira passa sem regressão.
- [ ] Nenhum arquivo fora do escopo de cada débito modificado.
- [ ] §2 do `_run/run-report.md` da `v1` marca os débitos em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Premissas

- A `v1` está concluída: TC-001 (Fase A) foi aprovada por QA e Tech Review, com 167 testes verdes.
- Os débitos coletados refletem o estado real após a segunda rodada de gates da `v1`.
- **A Fase B da TC-001 continua RETIDA** (revogação das chaves do `Administrator` e do `api@dominio.com`, remoção dos `.map`, `developer_mode: 0`, remoção dos dumps). Nenhuma task desta versão a executa, nem depende dela, nem a atrapalha — foi critério explícito na seleção dos débitos.
- As 2 tasks **não** são paralelizáveis entre si: ambas tocam `tests/test_patch_criar_papel_servico_app.py` (T1 acrescenta um caso, T2 remove uma linha). Ver `task_plan.md §4`.

---

## 6. Fora do escopo

- **Funcionalidade nova**: zero. Esta versão é cleanup puro.
- **Fase B da TC-001**: não é débito, é escopo retido da v1 aguardando confirmação humana. Não entra aqui.
- **Qualquer alteração em `/opt/react/sysloc/nginx/default.conf` ou em `deploy/nginx/react-default.conf`**: os 3 débitos de nginx (D-001, D-002, D-004) foram deliberadamente excluídos — alterá-los exige `docker restart sysloc-react-1` e revalidação do AC-13, o que concorreria com a sequência da Fase B.
- **Alteração de artefatos da `v1`**: proibida pelo guardrail 2 da skill. Isso torna o débito D-004 **parcialmente inexecutável** por aqui (ele exige corrigir a §6.1/§7.2 da TaskCard v1) — motivo adicional para tê-lo deixado fora.
- **Refactor arquitetural**: nenhum. Se durante a execução algum débito revelar padrão a registrar, sinalize `/agent-spec-adr-create` separadamente.

---

## 7. Próximo passo

```
/agent-spec-minispec-run-tasks docs/specs/features/contencao-credencial-exposta/v2-debits/task_plan.md
```

Tempo estimado total: ~35 minutos (25 min de T1 + 10 min de T2).
