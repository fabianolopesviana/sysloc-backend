# Workflow report — caracterizacao-regras-legadas/v1

[run] executor resolvido: __default__ (origem: descoberta interativa — os 3 agentes de .claude/agents/ sao reservados aos gates; zero candidatos apos o filtro)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[TC-001] base_sha=540c6d998e63f83b90a49fcd392b78d77840833a
[TC-001] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)
[TC-001] qa_model=opus tech_model=opus (override CLAUDE.md; heuristica resolveria sonnet: diff_touches_critical_path=false, task_risk=medium)
[TC-001] confirmacao do usuario obtida para executar contra o Frappe de producao (bench backup/new-site/restore/drop-site)

### TC-001 — Gate 1 (QA) tentativa 1
- veredito: REJEITADO · criterios 7/8 (AC-5 PARCIAL) · rastreabilidade 14/14
- problemas_por_categoria: { tests: 4 } (3 ALTO bloqueantes + 1 BAIXO débito)
- escopo_testes: PARCIAL (verificar-golden.sh executado 4/4; verificar-captura.sh avaliado por leitura — site efêmero já destruído por exigência do AC-8)
- tocou_area_critica: true · security_flags: []
- requires_qa_revalidation: true (rejeição do QA — algoritmo de skip não se aplica)
- rule_candidates: 2 sinais do QA persistidos (repeated_fixture, repeated_assertion_shape)

### TC-001 — Gate 1 (QA) tentativa 2
- veredito: APROVADO_COM_OBSERVACOES · criterios 8/8 · rastreabilidade 14/14
- problemas_por_categoria: { tests: 1 } (0 bloqueantes, 1 BAIXO)
- ALTO-001/002/003 corrigidos e auditados por evidencia propria do QA (logs run-*.log, fusos host/container/db, git diff dos golden vazio)
- escopo_testes: PARCIAL (verificar-golden.sh 4/4 executado; verificar-captura.sh por leitura — site destruido por exigencia do AC-8)
- tocou_area_critica: true
- security_flags: 3 (credencial preexistente versionada; leitura em producao como root do MariaDB; identificadores de producao no stdout da verificacao)
- rule_candidates: +1 sinal (repeated_assertion_shape); RC-001/RC-003 deduplicados contra a tentativa 1
- proximo: Gate 2 (Tech Review), tech_model=opus (security_flags nao vazio + override CLAUDE.md)

### TC-001 — Gate 2 (Tech Review) tentativa 2
- status: REJEITADO · tech_model=opus
- problemas_por_categoria: { security: 3 (1 CRITICO + 1 MEDIO + 1 BAIXO), architecture: 1 ALTO, code_quality: 2 (1 MEDIO + 1 BAIXO), best_practices: 1 MEDIO, project_pattern: 1 MEDIO }
- adrs_consultadas: ADR-0005, ADR-0006
- overrides_ativos: [tocou_area_critica: true, qa_security_flags: 3, task_risk: medium]
- requires_qa_revalidation: true
- decisao: tentativa 3 (ULTIMA) — executor corrige, depois QA, depois Tech Review
- verificacao de dano do P1 pelo orquestrador: NEGATIVA (near-miss; nenhuma escrita, nenhum e-mail)

### TC-001 — Gate 1 (QA) tentativa 3
- veredito: REJEITADO · criterios 7/8 (AC-5 PARCIAL) · rastreabilidade 14/14
- P1 (CRITICO, ADR-0006) RESOLVIDO — shim em /tmp inerte + PYTHONPATH so na invocacao da captura;
  docker homonimo auditado nos 3 eixos (lexico, temporal, estrutural); 3 assercoes anti-regressao reais
- P2 (ALTO, architecture) RESOLVIDO — dependencia do compose degradavel; provado com ARQ_COMPOSE inexistente (4/4, exit 0)
- scope_deviation: nenhum — os 4 MEDIOS rebaixados nao foram tocados (confirmado por grep e mtime)
- NOVO ALTO-001 (tests, tautological_assertion) · verificar-captura.sh:1256 · regressao introduzida nesta rodada:
  janela = [abertura, max(fechamento, abertura+cadencia)] com cadencia=60s = periodo da rotina
  -> janelas ladrilham o tempo sem intervalo -> nao_atribuidas nunca fica nao-vazio -> asercao infalivel
- 3 TENTATIVAS ESGOTADAS -> Passo 6.1, escalacao ao usuario. Status: Bloqueado.

### TC-001 — contador de tentativas REABERTO
- origem: decisao explicita do usuario apos escalacao do Passo 6.1
- justificativa: P1 (CRITICO) e P2 (ALTO) ja resolvidos; o bloqueio remanescente e
  correcao local de ~6 linhas com receita exata fornecida pelo QA
- escopo travado: apenas a folga de drenagem do CT-012 + assercao de sanidade + docstring
- Status revertido de Bloqueado para Em Progresso

### TC-001 — Gate 1 (QA) tentativa 4 (contador reaberto)
- veredito: APROVADO_COM_OBSERVACOES · criterios 8/8 · rastreabilidade 14/14
- ALTO-001 CORRIGIDO: dreno=min(30, cadencia/2); com cadencia=60s -> dreno=30s; trecho mordente
  [HH:MM:31, HH:MM+1:01) confirmado por evidencia propria do QA (4 run-*.log, periodos [86400,86400,86400,60])
- assercao de sanidade `dreno >= cadencia`: tripwire de runtime, inalcancavel sob a formula atual (intencional)
- scope_deviation: nenhum — D1-D6 confirmados intocados por grep
- AC-7: 6 golden byte-identicos; PROCEDENCIA.md com 3 linhas volateis (data, dump, timestamp)
- determinismo_observado: suspeito (CT-012 depende do relogio e dos run-*.log; margem de 8s do BAIXO-001)
- security_flags: 2 · rule_candidates: 0 (deduplicados contra rodadas anteriores)
- proximo: Gate 2 (Tech Review), tech_model=opus

### TC-001 — Gate 2 (Tech Review) rodada 2
- status: APROVADO_COM_OBSERVACOES · tech_model=opus
- P1 (CRITICO, ADR-0006) RESOLVIDO NA RAIZ — shim opt-in por processo em vez de opt-out global
- P2 (ALTO) ENTREGUE — TR executou verificar-golden.sh (4/4, exit 0) por estar no contrato (PARCIAL + area critica, read-only)
- docker homonimo JULGADO ACEITAVEL — a alternativa "simples" violaria Iron Law #6 (simbolo de producao so para teste)
- CT-012 JULGADO ROBUSTO — atribuicao temporal e 1 de 5 tabuas; as 4 determinísticas carregam o peso
- CORRECAO DO TR AO SUMARIO DO QA: a direcao de falha do CT-012 NAO e "nunca falso-verde" —
  com 30s cobertos em 60s, escrita indevida isolada tem ~50% de chance de cair em slot coberto
- P3-P8 nao reanalisados (override do usuario) · 1 BAIXO novo (P9), que reafirma o D6
- adrs_consultadas: ADR-0005, ADR-0006
- TC-001 — staged: deploy/scripts/caracterizacao/ (4), golden/ (7)
- memoria lazy TC-001.md deletada (cleanup_on_approval)
- [run] rule_candidates: 3 sinais persistidos (qa=3, staff=0, orquestrador=12 pre_refinement_decision)
