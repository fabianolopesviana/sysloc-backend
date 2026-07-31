# SCOPE — Cleanup de Débitos Técnicos · integracao-bancaria-configuravel · v2-debits

> **Variante**: backend (herdada de v1)
> **Versão**: v2-debits
> **Padrão**: 1 task por débito. `gates: [qa]` por default; **exceção aplicada**: débitos em path crítico (payments/db_migrations) forçam `gates: [qa, tech_review]`.

---

## 1. O que está incluído

Os **9 débitos** coletados serão resolvidos nesta versão (cleanup completo). Cada um vira 1 task em `tasks/T{n}.md`.

### Classificados como `recomendado_corrigir` (5)

- [x] **D-001 (code_quality, BAIXO)** — `situacao_cru` com sentinela ambíguo nas dataclasses de Resultado → **T1**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/cobranca_bancaria/modelo.py`
  - **Origem**: task `T1` de `v1`
  - **Correção**: padronizar para `situacao_cru: str = ""` em ResultadoEmissao/ResultadoBaixa/ResultadoConsulta
  - **Custo estimado**: ~2min · **Risco**: nenhum
  - **Classificação LLM**: recomendado_corrigir — "Custo: 2min. Risco: nenhum, campo sempre populado pelo produtor. Valor: elimina sentinela duplo e evita propagar o padrão."

- [x] **D-002 (code_quality, BAIXO)** — Docstring de `montar_payload_emissao` desatualizada → **T2**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/cobranca_bancaria/adaptadores/sicoob/mapeamento.py`
  - **Origem**: task `T5` de `v1`
  - **Correção**: ajustar para "defaults sobrescrevíveis pelo escape"; trocar o exemplo por campo sem default (ex.: `rateioCreditos`)
  - **Custo estimado**: ~5min · **Risco**: nenhum
  - **Classificação LLM**: recomendado_corrigir — "Só docstring, nenhuma linha executável. Valor: evita leitura errada do mecanismo de escape/ADR-0001."

- [x] **D-003 (error_handling, BAIXO)** — `except Exception` amplo ao ler a senha na migração → **T3**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/patches/v1_0/migrar_configuracao_integracao_bancaria.py`
  - **Origem**: task `T6` de `v1`
  - **Correção**: usar `get_password('pfx_password', raise_exception=False)`, deixando erros reais propagarem
  - **Custo estimado**: ~3min · **Risco**: baixo
  - **Classificação LLM**: recomendado_corrigir — "Troca falha silenciosa por falha explícita. Evita migrar config sem certificado registrando 'sucesso'."

- [x] **D-006 (testability, BAIXO)** — Teste assere código-fonte via `inspect.getsource` → **T6**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/tests/test_emissao_sequencial.py`
  - **Origem**: task `T10` de `v1`
  - **Correção**: remover `test_ct014_for_update_presente_no_sql` (a serialização já é provada por `test_ct014_concorrencia_real_serializa`)
  - **Custo estimado**: ~2min · **Risco**: nenhum
  - **Classificação LLM**: recomendado_corrigir — "Só arquivo de teste. Elimina teste frágil que quebraria em refactor cosmético do SQL."

- [x] **D-007 (speculative_complexity, BAIXO)** — `listar_boletos_abertos` retorna chave `boletos` sem consumidor → **T7**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/integracao_bancaria_api/boletos_abertos.py`
  - **Origem**: task `T13` de `v1`
  - **Correção**: remover a chave `boletos` e os campos `status_cobranca`/`nosso_numero` do `get_all`
  - **Custo estimado**: ~3min · **Risco**: nenhum
  - **Classificação LLM**: recomendado_corrigir — "Nenhum consumidor lê a chave/campos. Reduz superfície de query."

### Classificados como `perfumaria` — incluídos por decisão do usuário (4)

- [x] **D-004 (architecture, BAIXO)** — `ResultadoConsulta` sem discriminador estruturado de erro → **T4**
  - **Arquivos**: `cobranca_bancaria/modelo.py` + `adaptadores/sicoob/adapter.py` + `adaptadores/sicoob/mapeamento.py` + `cobranca_sicoob/consulta.py` + `cobranca_sicoob/confirmacao_baixa.py`
  - **Origem**: task `T7` de `v1`
  - **Correção**: introduzir `codigo_erro` canônico (ex.: `BOLETO_NAO_ENCONTRADO`) em `ResultadoConsulta` e ramificar por ele
  - **Custo estimado**: ~20min (provavelmente conservador) · **Risco**: baixo
  - **Classificação LLM**: perfumaria — "Toca contrato canônico e fluxo de consulta de pagamento em produção. Valor marginal agora — T7 já centralizou o literal na fonte única."
  - ⚠️ **Escopo maior que o registrado**: o débito citava só `consulta.py`, mas `confirmacao_baixa.py:148` ramifica pelo mesmo literal e `ResultadoConsulta` é construído em `mapeamento.py` (2×) e `adapter.py` (4×). Ver T4 §4.

- [x] **D-005 (technical_requirement, BAIXO)** — `mapear_situacao_boleto` com normalização mais estreita que o legado → **T5**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/cobranca_bancaria/modelo.py`
  - **Origem**: task `T9` de `v1`
  - **Correção**: estender com replace de underscore, remoção de acentos e colapso de whitespace
  - **Custo estimado**: ~10min · **Risco**: baixo
  - **Classificação LLM**: perfumaria — "Toca função canônica compartilhada por consulta/baixa/sincronização em produção. Valores reais do Sicoob não têm essas variantes; divergência já é fail-safe."

- [x] **D-008 (project_pattern, BAIXO)** — Filtro RN-02 duplicado entre dois módulos → **T8**
  - **Arquivos**: `integracao_bancaria_api/boletos_abertos.py:36` + `cobranca_sicoob/rotina_pagamentos.py:34`
  - **Origem**: task `T13` de `v1`
  - **Correção**: promover o filtro a constante compartilhada importada por ambos
  - **Custo estimado**: ~15min · **Risco**: baixo
  - **Classificação LLM**: perfumaria — "Toca `rotina_pagamentos.py`, produção do fluxo de cobrança. Mitigado hoje por CT-019 comparando com o dry_run real."

- [x] **D-009 (error_handling, BAIXO)** — Páginas parciais entram no consolidado antes do `except` → **T9**
  - **Arquivo**: `app-sync/locacao_automation/locacao_automation/integracao_bancaria_api/boletos_abertos.py`
  - **Origem**: task `T13` de `v1`
  - **Correção**: bufferizar as páginas de cada boleto e só mesclar após leitura íntegra; no `except`, descartar o parcial
  - **Custo estimado**: ~12min · **Risco**: baixo
  - **Classificação LLM**: perfumaria — "Janela hoje é vazia na prática (boletos do MVP têm 1 página). Melhor tratar junto de um refactor da montagem."

---

## 2. O que está fora do escopo (débitos NÃO selecionados nesta rodada)

_Nenhum débito ignorado — **todos os 9 coletados** foram selecionados para cleanup (decisão do usuário: cleanup completo, incluindo os 4 classificados como perfumaria)._

---

## 3. Definições Técnicas

### 3.1 Arquivos Impactados (consolidado)

| Arquivo | Débitos que tocam | Ação esperada |
|---------|-------------------|---------------|
| `cobranca_bancaria/modelo.py` | D-001 (T1), D-004 (T4), D-005 (T5) | Anotação de `situacao_cru`; novo campo `codigo_erro`; normalização em `mapear_situacao_boleto` |
| `cobranca_bancaria/adaptadores/sicoob/mapeamento.py` | D-002 (T2), D-004 (T4) | Docstring de `montar_payload_emissao`; popular `codigo_erro` em `interpretar_consulta` |
| `cobranca_bancaria/adaptadores/sicoob/adapter.py` | D-004 (T4) | Popular `codigo_erro` nos ramos que constroem `ResultadoConsulta` |
| `cobranca_sicoob/consulta.py` | D-004 (T4) | Ramificar por `codigo_erro` em vez de comparar mensagem |
| `cobranca_sicoob/confirmacao_baixa.py` | D-004 (T4) | Idem (mesmo padrão de ramificação por literal) |
| `cobranca_sicoob/rotina_pagamentos.py` | D-008 (T8) | Consumir a constante compartilhada do filtro RN-02 |
| `patches/v1_0/migrar_configuracao_integracao_bancaria.py` | D-003 (T3) | `get_password(..., raise_exception=False)` |
| `integracao_bancaria_api/boletos_abertos.py` | D-007 (T7), D-008 (T8), D-009 (T9) | Enxugar retorno; extrair filtro para fonte única; bufferizar páginas |
| `tests/test_emissao_sequencial.py` | D-006 (T6) | Remover teste de inspeção de código-fonte |

> ⚠️ **Três arquivos são tocados por múltiplas tasks** — `modelo.py` (3), `boletos_abertos.py` (3) e `mapeamento.py` (2). Isso governa o paralelismo (§3.4).

### 3.2 Frontmatter padrão de cada task

```markdown
- model: sonnet
- risk: low            # medium nas tasks cujo risco_regressao é "baixo" e tocam produção
- gates: [qa]          # [qa, tech_review] quando o path é crítico
- source: agent-spec-debt-resolution
```

> **Exceção aplicada**: pela rule `agent-spec-workflow-rules.md` (Critical Paths), débitos cujo path cai em categoria sensível forçam `gates: [qa, tech_review]`. Aqui isso vale para **8 das 9 tasks** — `cobranca_bancaria/`, `adaptadores/sicoob/`, `cobranca_sicoob/` e `integracao_bancaria_api/` são domínio de cobrança bancária (**payments/billing**) e `patches/` é **db_migrations**. Apenas **T6** fica com `gates: [qa]`, por tocar exclusivamente arquivo de teste.

### 3.3 Estratégia de testes

- Tasks de débito **NÃO criam testes novos**.
- A suíte existente (**114 testes**) **DEVE continuar passando**.
- O Gate 1 (QA) executa a suíte completa após cada task:
  ```
  docker compose exec -T backend bash -lc 'cd /home/frappe/frappe-bench && bench --site frontend run-tests --app locacao_automation'
  ```
  (executar a partir de `/opt/frappe`; **não existe `bench` no host** — só dentro do container).
- **Exceção deliberada em T6 (D-006)**: a correção **remove** um teste redundante, então a contagem cai de 114 → **113**. É o efeito esperado da própria correção, não regressão. Nenhum outro teste pode sumir ou falhar.
- **Atenção em T4 e T8**: são as únicas tasks que alteram comportamento interno de forma não-trivial (discriminador de erro; fonte única do filtro). Se algum teste regredir, é sinal de que o débito carregava semântica relevante — **task rejeitada**, débito reavaliado.

### 3.4 Paralelização

O flag `Pode Rodar em Paralelo?` foi **derivado** (Regra 10d) a partir da disjunção de arquivos da §3.1 — **não** autorado. Resultado:

- **Sim**: apenas **T3** (`patches/`) e **T6** (`tests/`) — únicos com arquivos disjuntos de todos os demais.
- **Não**: T1, T4, T5 (colidem em `modelo.py`); T2, T4 (colidem em `mapeamento.py`); T7, T8, T9 (colidem em `boletos_abertos.py`).

> **Guard de recursos de teste**: mesmo T3 e T6 fazem o QA rodar a **suíte completa de integração** contra o mesmo site `frontend`. Executores podem rodar em paralelo, mas os **QAs devem ser serializados** (suítes concorrentes no mesmo DB geram flake).

---

## 4. Critérios de Aceite

- [ ] 9 tasks `Concluído` no `task_plan.md` desta versão.
- [ ] Suíte de testes da feature passa após cada task (113 testes após T6).
- [ ] Nenhum diff em arquivos fora dos listados em §3.1.
- [ ] §2 do `_run/run-report.md` da `v1` marca os 9 débitos em cleanup; `_run/workflow-report.md` registra a execução.

---

## 5. Observações

- **Origem**: gerada pela skill `/agent-spec-debt-resolution` em 2026-07-21.
- **Agente especialista usado**: `__default__` (orquestrador genérico — o projeto não possui especialista de stack Frappe em `.claude/agents/`).
- **Decisão do usuário**: **cleanup completo** — 9 de 9 débitos coletados, incluindo os 4 que o especialista classificou como `perfumaria`. Os riscos assumidos estão explicitados em `intent.md §7`.
- **Não é candidato a ADR**: cleanup técnico não dispara ADR. Se durante a execução algum débito revelar padrão arquitetural a registrar (candidato real: o `codigo_erro` canônico de D-004), sinalize ao usuário criar `/agent-spec-adr-create` separadamente — NÃO inclua nesta versão.
- **Contexto de produção**: o site `frontend` é produção ao vivo (boletos reais). Quatro tasks (T4, T5, T8, T9) alteram código de produção no fluxo de dinheiro — daí o `risk: medium` e o Tech Review obrigatório nelas.
