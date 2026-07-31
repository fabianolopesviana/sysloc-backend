# SCOPE — Cleanup de Débitos Técnicos · contencao-credencial-exposta · v2-debits

> **Variante**: backend (herdada de v1)
> **Versão**: v2-debits
> **Padrão**: 1 task por débito. `gates: [qa]` por default; **T1 força `[qa, tech_review]`** por tocar Critical Path.

---

## 1. O que está incluído

Os 2 débitos abaixo serão resolvidos nesta versão. Cada um vira 1 task em `tasks/T{n}.md`.

- [x] **D-003 (security, BAIXO)** — Convergência não remove `Custom DocPerm` estranho ao conjunto declarado
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/patches/v1_0/criar_papel_servico_app.py:126`
  - **Também toca**: `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` (o CT que cobre a correção)
  - **Origem**: TaskCard `TC-001` de `v1` — Tech Review (P8) + QA (BAIXO-002), reportado independentemente pelos dois gates
  - **Correção**: ao final de `execute()`, apagar todo `Custom DocPerm` do papel `Servico App` fora do conjunto declarado (`frappe.db.delete("Custom DocPerm", {"role": NOME_PAPEL, "name": ["not in", nomes_declarados]})`) + `frappe.clear_cache(doctype=...)` nos DocTypes afetados; acrescentar CT que semeie uma linha em `permlevel=1` antes do 2º `execute()` e verifique a contagem de volta a 9; atualizar o docstring para descrever convergência **do conjunto**, não só dos flags da linha declarada
  - **Custo estimado**: ~25min
  - **Classificação LLM**: `recomendado_corrigir` — fix isolado em Python de patch, sem tocar nginx nem exigir restart de produção, testável pela suíte já verde. Fecha um caminho residual de escalonamento de privilégio justamente no papel cuja credencial é pública por desenho, e não concorre com a sequência da Fase B.

- [x] **D-005 (tests, BAIXO)** — Asserção infalível de precondição em `_criar_system_manager` (CT-060)
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py:422`
  - **Origem**: TaskCard `TC-001` de `v1` — QA (BAIXO-001)
  - **Correção**: remover `self.assertNotEqual(user.name, "Administrator")` e manter apenas `self.assertIn("System Manager", frappe.get_roles(user.name))`, que é falsificável; ou trocar por `self.assertNotEqual(frappe.session.user, "Administrator")` no ponto da medição
  - **Custo estimado**: ~10min
  - **Classificação LLM**: `recomendado_corrigir` — remoção de uma linha de asserção decorativa e infalível em arquivo de teste, sem impacto em produção; é um padrão que o gate já mandou remover uma vez antes (BAIXO-002 da attempt 1) e o custo é trivial.

---

## 2. O que está fora do escopo (débitos NÃO selecionados nesta rodada)

Os 5 débitos abaixo foram coletados mas **não** entram nesta versão. Ficam registrados para auditoria.

- [ ] **D-001 (security, BAIXO)** — Endpoints `allow_guest` da allowlist sem `limit_req`
  - **Arquivo**: `deploy/nginx/react-default.conf:44`
  - **Classificação LLM**: `perfumaria` — toca o único arquivo de barreira de rede entre a internet e a API, exigindo `docker restart` do proxy e revalidação do AC-13; a própria TaskCard remete sessão real (rate limiting/lockout) a F3, e o Tech Review já classificou como fora de escopo. Fazer isso agora concorre com a sequência de revogação da Fase B, que ainda não rodou. (~40min, risco médio)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. **Endereço natural: F3** (`saas-multi-empresa/v2` — sessão real).

- [ ] **D-002 (code_quality, BAIXO)** — Regex da allowlist em linha única de ~890 caracteres
  - **Arquivo**: `deploy/nginx/react-default.conf:44`
  - **Classificação LLM**: `perfumaria` — puramente cosmético; duas auditorias confirmaram que os 22 vetores de bypass continuam bloqueados no formato atual. Reescrever a única barreira de segurança de rede para ganhar legibilidade, com restart de produção e revalidação do AC-13, não se justifica antes da Fase B. (~60min, risco médio)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. **Endereço natural: F3**, junto com a revisão da allowlist.

- [ ] **D-004 (code_quality, BAIXO)** — Comentário declara "15 entradas em `method/`", número que não bate com o regex
  - **Arquivo**: `deploy/nginx/react-default.conf:26` **e** §6.1/§7.2 da TaskCard de `v1`
  - **Classificação LLM**: `perfumaria` — correção de comentário sem efeito funcional, mas qualquer edição no `.conf` implica `docker restart` do proxy e `diff` do AC-13; custo desproporcional para um benefício de auditoria futura. (~20min, risco baixo)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. **Ressalva importante**: este débito é **parcialmente inexecutável nesta skill** — metade dele exige corrigir a §6.1/§7.2 da TaskCard de `v1`, e o guardrail 2 de `/agent-spec-debt-resolution` proíbe alterar artefatos da versão original. A correção da TaskCard precisa ser feita por edição direta ou por uma revisão da spec, fora deste fluxo.

- [ ] **D-006 (tests, BAIXO)** — `setUp` remove estrutura de permissão viva do site de produção
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py:98`
  - **Classificação LLM**: `perfumaria` — o QA foi explícito ao recomendar não alterar agora e registrar como débito para F2 (site de teste dedicado). A correção real exige infraestrutura que ainda não existe, e o risco atual é apenas residual, protegido por rollback transacional já verificado. (~0min agora, risco nenhum)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. **Endereço natural: F2** (`saas-multi-empresa/v1` — infraestrutura), quando existir site de teste dedicado.

- [ ] **D-007 (tests, BAIXO)** — Helper de criação de `User` de teste replicado em 8 pontos da suíte
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py:203` (+ 7 outros pontos em 3 arquivos)
  - **Classificação LLM**: `perfumaria` — refatorar 8 pontos em 4 arquivos com assinaturas já divergentes (booleano vs tupla) é esforço não trivial que arrisca os 167 testes hoje verdes, para ganho puramente de manutenibilidade. (~90min, risco médio)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. Já registrado como candidato a regra de projeto em `v1/_run/rule-candidates.md` (sinal `repeated_fixture`) — merece solução sistemática via `/agent-spec-curate-project-rules`, não fix ad-hoc.

---

## 3. Definições Técnicas

### 3.1 Arquivos Impactados (consolidado)

| Arquivo | Débitos que tocam | Ação esperada |
|---------|-------------------|---------------|
| `app-sync/locacao_automation/locacao_automation/patches/v1_0/criar_papel_servico_app.py` | D-003 (T1) | Acrescentar remoção de `Custom DocPerm` fora do conjunto declarado ao final de `execute()`; atualizar docstring para convergência do conjunto |
| `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` | D-003 (T1), D-005 (T2) | T1: acrescentar CT que semeia `permlevel=1` e verifica remoção. T2: remover a asserção infalível da linha 422 |

> **Colisão declarada**: os dois débitos tocam `test_patch_criar_papel_servico_app.py`. É por isso que ambas as tasks têm `Paralelo? = Não` — ver §3.4.

### 3.2 Frontmatter padrão de cada task

```markdown
- model: sonnet
- risk: low
- gates: [qa]
- source: agent-spec-debt-resolution
```

> **Exceção aplicada em T1**: `patches/v1_0/criar_papel_servico_app.py` bate com as categorias `security` (cria e reconverge permissões) e `db_migrations` (patch aplicado por `bench migrate`) dos Critical Paths da rule `agent-spec-workflow-rules.md`. Logo **T1 força `gates: [qa, tech_review]`** e `risk: medium`. T2 mantém o default.

### 3.3 Estratégia de testes

- **D-005 (T2)** não cria teste novo — remove uma asserção decorativa.
- **D-003 (T1) é a exceção declarada à regra "tasks de débito não criam testes"**: a própria `correcao_sugerida` do gate exige um CT que semeie `Custom DocPerm` em `permlevel=1` antes do 2º `execute()` e verifique a contagem de volta a 9. Sem ele, a correção não seria verificável e reproduziria o furo que originou o débito (CT-049/CT-050 só rodam sobre estado semeado pelo próprio `execute()`).
- A suíte existente **DEVE continuar passando**: 167 testes verdes hoje; alvo após T1 é 168.
- O Gate 1 (QA) executa a suíte completa após cada task.
- Se algum teste regredir após o cleanup, é sinal de que o débito carregava lógica relevante — **task rejeitada**, débito investigado individualmente.
- **Comando**: `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation` (a partir de `/opt/frappe`). Não existe bench local.

### 3.4 Paralelização

Tasks de débito costumam ser independentes, mas **aqui não são**: T1 e T2 modificam o mesmo arquivo (`tests/test_patch_criar_papel_servico_app.py`). O flag `Pode Rodar em Paralelo?` é **derivado** (Regra 10d) e resultou em **`Não` para ambas** — o guard "paths disjuntos" da rule `Execução Paralela de Tasks` falharia de qualquer forma, e declarar `Sim` seria autoria indevida.

Ordem sugerida: **T1 → T2**. T1 é o débito substantivo e acrescenta um caso ao arquivo; T2 remove uma linha. A ordem inversa também funciona, mas exigiria que T2 fosse re-verificada após T1 tocar o mesmo arquivo.

---

## 4. Critérios de Aceite

- [ ] 2 tasks `Concluído` no `task_plan.md` desta versão.
- [ ] Suíte de testes da feature inteira passa após cada task (Gate 1 valida) — alvo de 168 testes ao final.
- [ ] Nenhum diff em arquivos fora dos listados em §3.1. **Em particular: zero alteração em `deploy/nginx/react-default.conf`, em `/opt/react/sysloc/`, ou em qualquer artefato da `v1`.**
- [ ] §2 do `_run/run-report.md` da `v1` marca D-003 e D-005 em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Observações

- **Origem**: gerada pela skill `/agent-spec-debt-resolution` em 2026-07-28.
- **Agente especialista usado**: `__default__` (subagente genérico — não há agente de stack registrado em `.claude/agents/`; os três presentes são reservados aos gates).
- **Decisão do usuário**: 2 de 7 débitos coletados foram aprovados para cleanup nesta rodada. Os 5 restantes têm endereço natural declarado em §2 (F2, F3, ou curadoria de regra).
- **Estado de produção durante esta versão**: a Fase B da TC-001 continua retida. A credencial `bc237221b65b5ed` do `Administrator` segue válida, os 3 `.map` seguem publicados, `developer_mode` segue em 1 e os 6 dumps seguem na raiz. **Nenhuma task desta versão altera isso** — o cleanup é restrito a código Python versionado.
- **Não é candidato a ADR**: cleanup técnico não dispara ADR. A decisão arquitetural relevante já foi registrada na **ADR-0003** durante a `v1`.
