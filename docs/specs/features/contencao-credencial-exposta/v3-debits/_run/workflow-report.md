# Workflow report — contencao-credencial-exposta/v3-debits

[run] executor resolvido: __default__ (origem: descoberta interativa — só os 3 agentes de gates em .claude/agents/)
[run] executor_discipline injetado (fonte: references/executor-discipline.md)
[run] baseline contaminado detectado: v2-debits staged sem commit, com overlap de paths em T1/T2 → usuário autorizou commit; baseline resetado
[run] commit de reset: 7a53158 (v2-debits)
[T1] base_sha=7a53158e0cc381890a6109d5f75e7ccf855cf1f0
[T2] base_sha=7a53158e0cc381890a6109d5f75e7ccf855cf1f0
[Fase 1] lote paralelo: T1, T2 — guards provados (DAG independente; símbolos N/A nas duas; paths disjuntos: tests/test_patch_*.py vs docs/adr/0003-*.md; nenhum de alta contenção; 2 ≤ MAX_PARALLEL=4)
[Fase 1] guard de recursos de teste: QAs SERIALIZADOS por decisão do orquestrador. A letra do guard exige ≥2 tasks com testes não-vazios e só T1 tem, mas o QA de T2 também executa a suíte completa, e a suíte roda contra o site de PRODUÇÃO. O QA da v2-debits registrou um Custom DocPerm residual causado por sessão concorrente — evidência empírica de que suítes simultâneas neste projeto produzem artefato. Executores em paralelo; QAs um por vez, ordem de ID.
[T1] gates: [qa] (declarado) model: sonnet risk: low
[T2] gates: [qa] (declarado) model: sonnet risk: low
[T1] ADRs injetadas no executor: ADR-0003 (fonte: task §3.3, leitura)
[T2] ADRs injetadas no executor: ADR-0003 (edita Consequences), ADR-0002 (premissa tensionada — leitura)
[Fase 1] dispatch: paralelismo PERDIDO por falha do orquestrador — anunciei lote paralelo mas emiti apenas o Agent de T1; T2 despachada em seguida. Guards estavam satisfeitos; a serialização não foi decisão técnica.
[T1] executor OK: 169/169 testes, diff puramente aditivo (77 linhas)
[T2] executor OK: 169/169 testes, frase acrescentada ao 2o bullet de 'Veiculo de imposicao'
[T1] Gate 1 QA (sonnet) → APROVADO · 6/6 critérios · 169 testes · zero problemas
[T1] QA fez mutation testing manual dos 3 modos de falsificabilidade (backup + restauração byte-a-byte, diff vazio confirmado)
[T1] QA observou: modo 3 (função renomeada) é detectado por ImportError na coleção do módulo — o import direto no topo do arquivo (linha 98-102) serve os outros 14 CTs. Blast radius maior que o descrito no CT-064, mas a Iron Law #1 permanece satisfeita. Propriedade estrutural pré-existente, fora do escopo de T1.
[T1] rule_candidates: 1 sinal (repeated_fixture) persistido
[T2] Gate 1 QA (sonnet) → APROVADO · 5/5 critérios · 169 testes · zero problemas
[T2] QA verificou a precisão factual da frase direto na fonte do Frappe (installer.py:498-504, patch_handler.py:54-76)
[T1] staged · [T2] staged
[T1] Status: Concluído (1 tentativa) · [T2] Status: Concluído (1 tentativa)
[run] rule_candidates: 1 sinal persistido em _run/rule-candidates.md (qa=1, staff=0, orquestrador=0)
[run] execução concluída: 2/2 tasks, zero débito novo
