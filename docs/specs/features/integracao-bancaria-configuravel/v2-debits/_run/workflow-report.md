# Workflow report — integracao-bancaria-configuravel/v2-debits

## Execução — run 2026-07-21 (agent-spec-minispec-run-tasks)

- [run] executor resolvido: __default__ (general-purpose, sem subagent_type) — reuso da decisão da sessão (nenhum especialista de stack em .claude/agents/)
- [run] executor_discipline injetado (fonte: references/executor-discipline.md)
- [run] git: HEAD=cfde4b20eb5a4d5b5dc7523dcab020ed6adb679e (commit único do repo); TODO o trabalho da v1 está STAGED, não commitado.
- [run] ESTRATÉGIA DE DIFF (adaptação necessária): como a v1 não foi commitada, `git diff <base_sha>` traria o trabalho inteiro da v1 junto. O delta de cada task de cleanup é isolado por `git diff -- <path>` (working vs INDEX), pois o INDEX = estado final validado da v1 (114 testes verdes). Após cada task aprovar, o `git add` avança o index e isola a próxima.
- [run] alinhamento do index: staged a correção de regressão da Fase 3 da v1 que ficara unstaged (modelo.py field(repr=False), test_configuracao.py isolamento do setUp) + .gitignore (_run/tmp/). Estado validado pela suíte de 114 testes.
- [run] plano: Fase1 [T3 ∥ T6] → Fase2 T1→T2→T5→T4 → Fase3 T7→T9→T8
- [run] paralelismo: apenas T3 e T6 (arquivos disjuntos). Colisão força sequencial em modelo.py (T1/T4/T5), mapeamento.py (T2/T4), boletos_abertos.py (T7/T8/T9).
- [run] guard de recursos de teste: TODA task roda a suíte completa no site frontend → QAs SERIALIZADOS mesmo no lote paralelo.

## Fase 1 — lote paralelo T3 ∥ T6
- [Fase 1] lote paralelo: T3, T6 (DAG independente + símbolos N/A + paths disjuntos: T3=patches/, T6=tests/; sem alta contenção compartilhada)
- [Fase 1] base_sha=cfde4b20eb5a4d5b5dc7523dcab020ed6adb679e (delta real isolado por `git diff --` vs index)
- [T3] executor: sonnet (declarado) | gates: [qa, tech_review] → opus (critical_path=db_migrations, risk medium) | ADRs: Nenhuma
- [T6] executor: sonnet (declarado) | gates: [qa] → sonnet (não-critical: arquivo de teste, risk low) | ADRs: Nenhuma
- [T3] veredito: QA=APROVADO (4/4), TR=APROVADO_COM_OBSERVACOES (1 baixo pré-existente: auditoria declara certificado_senha incondicionalmente). TR consultou ADR-0002.
- [T6] veredito: QA=APROVADO (5/5). gates [qa] — sem TR. Remoção exata de 1 teste (18→17 métodos); suíte 114→113 por design.
- [Fase 1] staged (ordem determinística T3→T6): patches/v1_0/migrar_configuracao_integracao_bancaria.py, tests/test_emissao_sequencial.py
- [Fase 1] CONCLUÍDA. Novo débito descoberto (pré-existente, fora do escopo): D-010 — auditoria do Patch 1 lista certificado_senha como migrado mesmo sem senha.

## Fase 2 — núcleo canônico (sequencial: T1→T2→T5→T4)
- [T1] executor: sonnet (declarado) | gates: [qa, tech_review] → opus (critical_path=payments) | ADRs: Nenhuma | delta isolado por `git diff -- modelo.py`
- [T1] veredito: QA=APROVADO (5/5), TR=APROVADO (sem problemas). TR consultou ADR-0001. staged: cobranca_bancaria/modelo.py
- [run] correção documental: contagem esperada de testes ajustada de 114→113 nas tasks restantes (T6 removeu 1 teste por design)
- [T2] executor: sonnet (declarado) | gates: [qa, tech_review] → opus (critical_path=payments) | ADRs: Nenhuma

### T2 — Resolver D-002: docstring de `montar_payload_emissao`
- model executor: sonnet (frontmatter) · gates: [qa, tech_review] (declarado) · gates escalados p/ opus (critical_path=payments)
- diff isolado: `git diff -- .../adaptadores/sicoob/mapeamento.py` (working vs INDEX — repo com 1 commit, v1 staged)
- QA (opus): APROVADO — 5/5 critérios · suíte completa 113 testes OK · diff 8+/5- 100% dentro do bloco docstring
- Tech Review (opus): APROVADO — 0 problems · ADR-0001 consultada (nova redação mais alinhada à ADR que a antiga)
- staged: app-sync/.../adaptadores/sicoob/mapeamento.py
- tentativas: 1 (sem loop de correção)

### T5 — Resolver D-005: normalização de `mapear_situacao_boleto`
- model executor: sonnet (frontmatter) · gates: [qa, tech_review] (declarado) · escalados p/ opus (critical_path=payments)
- QA (opus): APROVADO_COM_OBSERVACOES — 8/8 critérios · 113 testes OK · paridade com o legado verificada POR EXECUÇÃO (118.044 entradas, 0 divergências, 0 redirecionamentos)
- 2 problemas BAIXO (documentation: docstring não-raw; code_quality: U+00A0 literal no `.replace`) → **corrigidos em vez de anotados** (guardrail da v2-debits: task de débito não gera débito novo). Executor re-rodou suíte: 113 OK.
- Tech Review (opus): APROVADO — 0 problems · ADR-0001 consultada (normalização agnóstica de provedor; `_MAPA_SITUACAO_CANONICA` intocado)
- staged: app-sync/.../cobranca_bancaria/modelo.py
- tentativas: 1 + 1 correção pós-QA (não-bloqueante)

### [incidente do orquestrador] truncamento acidental de 3 artefatos — recuperado
- Causa: script Python do orquestrador usou `open(p,'w').write(open(p).read()...)`; Python avalia `open(p,'w')` (que TRUNCA) antes de ler → zerou `tasks/T4.md`, `tasks/T5.md` e `_run/minispec_state.yaml`.
- Escopo: apenas artefatos de spec (untracked, sem cobertura de git). NENHUM arquivo de código-fonte afetado.
- Recuperação: T4.md extraído íntegro do transcript da sessão (`~/.claude/projects/.../*.jsonl`, tool_use Write original, 8341 bytes); T5.md e minispec_state.yaml reconstruídos do conteúdo íntegro em contexto.
- Correção de prática: leitura e escrita em passos separados (Read/Write tools), nunca inline.

### T4 — retry classification
- attempt: 1
- problemas_por_categoria: { code_quality: 2 (1 MEDIO + 1 BAIXO), architecture: 0, security: 0 }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: true (modelo.py 23→25 inserções)]
- requires_qa_revalidation: **true**
- decisao: VOLTAR AO GATE 1 (QA) antes do novo Tech Review
- justificativa: "categorias são code_review_only, mas o override `tocou_area_critica` (path em payments) força revalidação; além disso a correção MOVE a constante `BOLETO_NAO_ENCONTRADO` de posição no módulo — ordem de definição é executável em Python, não é comentário puro"

### T4 — Resolver D-004: `codigo_erro` canônico (maior escopo da versão)
- model executor: sonnet · gates: [qa, tech_review] (declarado) · escalados p/ opus (critical_path=payments)
- **Conflito de spec escalado ao usuário**: §4.3 mandava migrar "os dois consumidores" mas proibia estender o discriminador a `ResultadoBaixa` — e `confirmacao_baixa.py` consome `ResultadoBaixa`. Premissa da proibição era falsa. Usuário decidiu: **estender também a `ResultadoBaixa`** (não a `ResultadoEmissao`). Cláusula corrigida na task (tachada + justificativa).
- QA rodada 1 (opus): APROVADO — 9/9 · 113 testes OK · equivalência lógica verificada por grep exaustivo (2 pontos atribuem a mensagem; ambos migrados)
- Tech Review rodada 1 (opus): **PARCIAL** — P1 MEDIO code_quality (comentário afirmava ramo "não encontrado" em `solicitar_baixa`, onde 204 é SUCESSO — armadilha que levaria a anexar a sentinela a `sucesso=True`) + P2 BAIXO (comentário parcial e colocação da constante)
- retry classification: requires_qa_revalidation=**true** (override tocou_area_critica + relocação de constante é executável)
- QA rodada 2 (opus): APROVADO — 5/5 · 113 testes OK · contagens de pontos de construção conferidas (10 em `ResultadoBaixa`, 6 em `ResultadoConsulta`)
- Tech Review rodada 2 (opus): APROVADO — 0 problems
- staged: 5 arquivos (modelo.py, adapter.py, mapeamento.py, consulta.py, confirmacao_baixa.py)
- tentativas: 2

## Fase 2 (núcleo canônico) concluída — T1, T2, T5, T4. Iniciando Fase 3 (apuração de boletos): T7 → T9 → T8.

### T7 — Resolver D-007: enxugar retorno de `listar_boletos_abertos`
- model executor: sonnet · gates: [qa, tech_review] · escalados p/ opus (critical_path=payments)
- QA (opus): APROVADO — 7/7 · 113 testes OK · grep próprio confirmou zero consumidores da chave removida; verificou que a função NÃO é `@frappe.whitelist()` e o retorno nunca cruza fronteira HTTP (contrato externo intacto)
- Tech Review (opus): APROVADO — 0 problems · risco dinâmico (hook/Jinja/fila/cache) investigado e descartado como NULO, não apenas teórico
- staged: app-sync/.../integracao_bancaria_api/boletos_abertos.py (+2/-7)
- tentativas: 1

### T9 — Resolver D-009: bufferizar páginas no PDF consolidado
- model executor: sonnet · gates: [qa, tech_review] · escalados p/ opus (critical_path=payments)
- Orquestrador levantou risco: o merge final ficou FORA do `try` (antes a chamada equivalente era protegida). QA investigou **empiricamente** no container (pypdf 5.9.0): `add_page` faz `clone`+`_reference_clone` recursivo materializando todo IndirectObject — provou destruindo a fonte antes do merge (funcionou). Corrupção sempre estoura no 1º `add_page`, dentro do try. Mover o merge para dentro reintroduziria o D-009.
- QA (opus): APROVADO — 8/8 · 113 testes OK · CT-020 e companion negativo verdes
- Tech Review (opus): APROVADO — 0 problems
- staged: app-sync/.../integracao_bancaria_api/boletos_abertos.py
- tentativas: 1

### T8 — Resolver D-008: filtro RN-02 em fonte única (última task; toca produção fora do módulo)
- model executor: sonnet · gates: [qa, tech_review] · escalados p/ opus (critical_path=payments)
- Orquestrador levantou 2 riscos ao QA: (A) aliasing de estado global mutável, (B) efeito colateral/ciclo de import.
- QA rodada 1: **REJEITADO** — MED-001 (data_handling): retorno do dry_run devolvia o objeto global; contaminação process-wide provada empiricamente. + BAIXO-001 (docstring do módulo obsoleta). Risco (B) descartado: sem ciclo, sem efeito colateral em import.
- Correção 1: `dict(FILTROS_BOLETO_ABERTO)`. Executor testou `types.MappingProxyType` e **reverteu** — quebrava CT-019 SILENCIOSAMENTE (0 em vez de 3 matches; o construtor de filtros do Frappe não aceita mapping não-`dict` e não levanta erro).
- QA rodada 2: **REJEITADO** — MED-001 persistia: `dict()` é cópia RASA; `['status_cobranca'][1].append('Paga')` ainda contaminava os dois módulos.
- Correção 2: `copy.deepcopy(...)`.
- QA rodada 3: **APROVADO** — 4/4 · 113 testes OK · 4 ataques de mutação refeitos pelo próprio QA, todos contidos; fonte única íntegra (mesmo `id` entre módulos); cópia só na fronteira pública.
- Tech Review (opus): **APROVADO_COM_OBSERVACOES** — P1 BAIXO (assimetria deepcopy-vs-global subdocumentada) → **corrigido em vez de anotado** (guardrail da versão). TR julgou os 2 pontos deferidos pelo QA: domicílio da constante ACEITÁVEL (mover para `cobranca_bancaria` seria pior — injetaria persistência/Frappe no domínio puro da ADR-0001); teste dependendo de re-export IRRELEVANTE (import genuinamente usado, falha seria barulhenta).
- staged: rotina_pagamentos.py + boletos_abertos.py
- tentativas: 3 (limite)

## Fase 3 concluída — T7, T9, T8. **Run v2-debits COMPLETO: 9/9 tasks.**
