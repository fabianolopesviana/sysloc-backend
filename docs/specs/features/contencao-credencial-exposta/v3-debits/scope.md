# SCOPE — Cleanup de Débitos Técnicos · contencao-credencial-exposta · v3-debits

> **Variante**: backend (herdada de v2-debits)
> **Versão**: v3-debits
> **Padrão**: 1 task por débito, `gates: [qa]` — nenhum débito toca Critical Path.

---

## 1. O que está incluído

Os 2 débitos abaixo serão resolvidos nesta versão.

- [x] **D-001 (tests, BAIXO)** — Registro do `after_migrate` sem rede regressiva na suíte
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` (o débito aponta para `hooks.py:16`, mas a correção é um teste)
  - **Origem**: task `T1` de `v2-debits` — QA, emitido em **duas rodadas consecutivas**
  - **Correção**: acrescentar 1 teste que resolva o dotted path pelo **mesmo mecanismo do framework** — `frappe.get_hooks("after_migrate")` + `frappe.get_attr`, como em `frappe/migrate.py:145-147` — semeie um `Custom DocPerm` residual e chame a **função resolvida** (não o import direto), verificando que o resíduo some
  - **Custo estimado**: ~15min
  - **Classificação LLM**: `recomendado_corrigir` — teste barato que fecha um gap real de detecção de regressão num hook que protege exposição de credencial via internet. Resolvendo o dotted path dinamicamente (não hardcoded), fica **desacoplado do path que D-002 mudaria no futuro**, então não cria dívida cruzada.

- [x] **D-003 (adr_compliance, BAIXO)** — ADR-0003 não delimita o que o `patches.txt` continua fazendo
  - **Arquivo**: `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md:37`
  - **Origem**: task `T1` de `v2-debits` — Tech Review (P4), achado da última rodada
  - **Correção**: uma frase no fim do segundo bullet, no mesmo parágrafo: *"O mecanismo de patch segue válido no caso para o qual existe (ADR-0002) — um patch novo, num site já existente, não está no `Patch Log` e roda no `bench migrate` seguinte; o que o `install_app` inutiliza é apenas o patch já presente no repositório no momento em que o site é criado."*
  - **Custo estimado**: ~5min
  - **Classificação LLM**: `recomendado_corrigir` — uma frase de prosa, sem tocar código, custo mínimo e risco zero. Evita um erro futuro muito mais caro (mover migração de dados não-idempotente para o `after_migrate` por má leitura da ADR-0003) e não depende do path específico que D-002 mudaria.

---

## 2. O que está fora do escopo (débito NÃO selecionado)

- [ ] **D-002 (architecture, BAIXO)** — Invariante de segurança permanente ancorada em `patches/v1_0/`
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/hooks.py:14` → `locacao_automation.patches.v1_0.criar_papel_servico_app.execute`
  - **Problema**: por convenção do framework e do projeto, um módulo sob `patches/v1_0/` é artefato de migração histórica, removível uma vez aplicado. Este módulo passou a ser também código de runtime permanente que impõe uma invariante de segurança a cada `bench migrate`. O docstring ainda se apresenta como "Patch 3". Os outros dois patches do `patches.txt` são one-shot genuínos, então o diretório não sinaliza a diferença.
  - **Classificação LLM**: `perfumaria` — reorganização arquitetural pura (criar arquivo, mover código, reapontar hook e ADR) sem defeito funcional atual; a tensão já está mitigada por docstring e ADR-0003. O próprio risco descrito (quebra silenciosa do `frappe.get_attr` se a extração errar o path) supera o benefício de fechar uma questão estética agora. (~30min, risco médio)
  - **Motivo da exclusão**: não selecionado pelo usuário nesta rodada. **Endereço natural: `saas-multi-empresa` v2**, que já vai mexer em papéis e paths nessa área — e que, pela ADR-0003, herda a exigência de prever veículo de reimposição contínua para todo papel novo.
  - **Mitigação enquanto isso**: o docstring do patch e a subseção "Veículo de imposição" da ADR-0003 registram explicitamente que o módulo é load-bearing em runtime — o que reduz a chance de alguém removê-lo numa faxina de patches.

> **Débitos herdados da `v1` que continuam abertos** (registrados em `v2-debits/scope.md §2`, não recoletados aqui): D-001 (`allow_guest` sem `limit_req`), D-002 (regex da allowlist), D-004 (contagem "15 métodos"), D-006 (`setUp` no site de produção), D-007 (helper replicado). Endereços declarados: F2, F3 ou curadoria de regra.

---

## 3. Definições Técnicas

### 3.1 Arquivos Impactados (consolidado)

| Arquivo | Débitos que tocam | Ação esperada |
|---------|-------------------|---------------|
| `app-sync/locacao_automation/locacao_automation/tests/test_patch_criar_papel_servico_app.py` | D-001 (T1) | Acrescentar 1 teste de wiring que resolve o hook dinamicamente e exercita a convergência pelo símbolo resolvido |
| `docs/adr/0003-custom-docperm-como-fonte-unica-de-permissao-dos-doctypes-de-negocio.md` | D-003 (T2) | Acrescentar 1 frase no segundo bullet da subseção "Veículo de imposição" |

> **Paths disjuntos.** É o que permite o paralelismo — ver §3.4.

### 3.2 Frontmatter padrão de cada task

```markdown
- model: sonnet
- risk: low
- gates: [qa]
- source: agent-spec-debt-resolution
```

> **Nenhuma exceção nesta versão**: nem `tests/` nem `docs/adr/` batem com qualquer categoria de Critical Paths da rule `agent-spec-workflow-rules.md`. Ambas ficam com o default `[qa]`.

### 3.3 Estratégia de testes

- **D-003 (T2)** não cria nem altera teste — é uma frase de documentação.
- **D-001 (T1) é a exceção à regra "tasks de débito não criam testes"**: o débito **é** a ausência de um teste. A `correcao_sugerida` do gate descreve exatamente o teste a escrever.
- A suíte existente **DEVE continuar passando**: 168 testes verdes hoje; alvo após T1 é **169**.
- **Ponto crítico do teste de T1**: ele precisa resolver o dotted path pelo mecanismo real (`frappe.get_hooks` + `frappe.get_attr`) e chamar a **função resolvida**, não o import direto. Um teste que faça `assertIn("...", hooks.after_migrate)` seria tautológico — apenas espelharia a configuração — e o QA reprova como `tautological_assertion`. A forma forte é falsificável contra três modos reais: hook removido, typo no dotted path, e função resolvida que deixou de convergir.
- **Comando**: `docker compose exec -T backend bench --site frontend run-tests --app locacao_automation` (a partir de `/opt/frappe`). Não existe bench local; a suíte roda contra o site de produção (débito conhecido da `v1`, adiado para F2).

### 3.4 Paralelização

Diferente da `v2-debits`, aqui as duas tasks **são paralelizáveis**. Derivação (Regra 10d):

| Condição | Resultado |
|---|---|
| Mesma fase | ✅ ambas na Fase 1 |
| Independência no DAG | ✅ nenhuma dependência declarada |
| Disjunção de símbolo | ✅ `N/A` nas duas (cleanup não cria símbolo público) |
| Paths disjuntos | ✅ `tests/test_patch_*.py` ∩ `docs/adr/0003-*.md` = ∅ |
| Arquivo de alta contenção | ✅ nenhum dos dois é |

→ **`Pode Rodar em Paralelo? = Sim`** para ambas. O orquestrador `/agent-spec-minispec-run-tasks` re-verifica com seus próprios guards.

---

## 4. Critérios de Aceite

- [ ] 2 tasks `Concluído` no `task_plan.md`.
- [ ] Suíte passa sem regressão — **169 testes** ao final.
- [ ] Nenhum diff em arquivos fora dos listados em §3.1. **Em especial: zero alteração em `hooks.py`, no patch, em `deploy/nginx/`, em `/opt/react/sysloc/` ou em artefatos da `v1`/`v2-debits`.**
- [ ] O teste de T1 é falsificável — não um `assertIn` sobre a string do hook.
- [ ] §2 do `_run/run-report.md` da `v2-debits` marca D-001 e D-003 em cleanup.

---

## 5. Observações

- **Origem**: gerada pela skill `/agent-spec-debt-resolution` em 2026-07-28.
- **Agente especialista usado**: `__default__` (subagente genérico — não há agente de stack em `.claude/agents/`).
- **Decisão do usuário**: 2 de 3 débitos coletados aprovados para cleanup.
- **Segunda versão de cleanup consecutiva**: `v1` → `v2-debits` → `v3-debits`. Ver `intent.md §7` — se surgir uma `v4-debits`, vale parar e absorver o restante em F2/F3 do refactory.
- **Estado de produção**: a Fase B da TC-001 continua retida. A credencial `bc237221b65b5ed` do `Administrator` segue válida, os 3 `.map` publicados, `developer_mode` em 1, os 6 dumps na raiz. **Nenhuma task desta versão altera isso.**
- **Não é candidato a ADR**: cleanup técnico não dispara ADR. A T2 **edita** uma ADR existente, mas apenas acrescenta uma frase em `Consequences` — não altera `Decision`, o que exigiria `/agent-spec-adr-supersede`.
