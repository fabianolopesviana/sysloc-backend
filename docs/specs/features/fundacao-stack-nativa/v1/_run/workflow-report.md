# Workflow Report — fundacao-stack-nativa/v1

> Telemetria de pipeline (append-only). Relatório humano em `_run/run-report.md`.

## Run — execução das tasks (miniSpec)

- `[run] executor resolvido: __default__ (origem: descoberta interativa — `.claude/agents/` contém apenas os 3 agentes reservados aos gates; nenhum executor especialista disponível)`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] modelo: CLAUDE.md fixa Opus para sessão principal e todo subagente. Onde a heurística do framework mandaria sonnet, lê-se opus. Gates rodam em opus em todas as 7 tasks.`
- `[run] git: repositório verificado. base do run = 540c6d998e63f83b90a49fcd392b78d77840833a`
- `[run] cleanup idempotente: _run/tmp/ inexistente, nada a limpar. Padrão `docs/specs/**/_run/tmp/` já presente no .gitignore.`
- `[run] resume: nenhum sinal de execução interrompida (7 tasks em `A Fazer`, sem memória lazy, sem diff em paths declarados da feature).`
- `[run] qa_context.md: válido (mtime 08:32 > scope.md 08:29).`

### Fase 1 — decisão de paralelismo

- `[Fase 1] candidatos ao lote: T1, T2 (ambos flag=Sim, sem dependências)`
- `[Fase 1] guards re-verificados: DAG independente ✓ · símbolos disjuntos ✓ (T1 cria workspace/tsconfig, T2 cria procedimento shell; consumos N/A dos dois lados) · paths disjuntos ✓ (T1 = raiz do repositório; T2 = deploy/scripts/instalacao/provisionar-base.sh) · alta contenção ✓ (só T1 toca manifests; o guard exige que AMBAS toquem) · MAX_PARALLEL ✓`
- `[Fase 1] guard de recursos de teste: DISPARADO — T1 e T2 têm testes de integração/E2E não-vazios sobre recurso real (T1: clone efêmero + ciclo pnpm; T2: apt/systemctl/reinício de serviço). QAs seriam serializados por ordem de ID.`
- `[Fase 1] lote paralelo DESCARTADO por decisão do usuário: `sudo` neste host exige senha e o subagente executor não consegue respondê-la. T2 passa a **execução manual assistida** — o executor escreve os artefatos versionados (não requer privilégio) e a execução/prova do provisionamento é conduzida pelo usuário em sessão SSH própria, um comando por vez com validação. T1 roda sozinha agora.`
- `[Fase 1] fallback: sequencial T1 → T2`

### T1 — pré-execução

- `[T1] base_sha=540c6d998e63f83b90a49fcd392b78d77840833a`
- `[T1] executor: opus (declarado no frontmatter) · gates: [qa, tech_review] (declarado) · risk: medium`
- `[T1] diff_touches_critical_path: true (.env.example → categoria secrets/config) → qa_model=opus, tech_model=opus`
- `[T1] ADRs injetadas no executor: nenhuma (fonte: task §6 — "Nenhuma"; as três ADRs da feature governam áreas que T1 não toca)`

### T1 — tentativa 1

- `[T1] executor: opus · retorno: 11 criados, 2 modificados, 4/4 CTs implementados (shell)`
- `[T1] observação: o executor fez `git add` real dos próprios arquivos antes dos gates (o stage deveria ocorrer só na aprovação, 4.5/FASE 5). Não destrutivo — HEAD intacto, nada commitado — e o stage aconteceria de qualquer forma ao aprovar. Registrado como desvio de processo, não de código.`
- `[T1] arquivos tocados NÃO declarados: apps/.gitkeep, packages/.gitkeep, pnpm-lock.yaml (git add -N aplicado; encaminhados aos dois gates como candidatos a scope_deviation)`
- `[T1] QA (opus): REJEITADO — 0 críticos, 0 altos, 1 médio (MED-001, categoria tests), 1 baixo (BAIXO-001, categoria tests). Bateria executada de fato: SUITE_COMPLETA, saída 0, 4/4 CTs verdes. criterios 4/4, criterios_falhos vazio, rastreabilidade_cts sem_teste vazio, security_flags vazio, adr_compliance sem violação.`
- `[T1] QA — MED-001: CT-004 chama `falhar` (e portanto reprova a bateria inteira) quando já existe `.env` na árvore de trabalho — exatamente o estado que o `.env.example:10` manda criar. Falha por razão que não é a violação da invariante do caso; determinismo dependente de estado de ambiente não declarado.`
- `[T1] QA — stack_discovery.discovery_needed: true (3 lacunas; não afeta veredito). Recomendação ao usuário: `/agent-spec-testing-stack-bootstrap`.`
- `[T1] política débito-controlado: 1 médio bloqueia → loop de correção. BAIXO-001 vai como observação opcional.`
- `[T1] memória lazy criada: _run/tmp/T1.md (attempt_count=1, last_severity=MEDIO)`
- `[T1] auto-escalate: NÃO aplicado (attempt_count=1 < 2 e last_severity=MEDIO ∉ {ALTO, CRITICO}). effective_model permanece opus (declarado no frontmatter).`
- `[T1] rule_candidates: 1 sinal do QA persistido (repeated_assertion_shape)`

### T1 — tentativa 2 (correção)

- `[T1] executor (opus, sem escalonamento): 0 criados, 2 modificados (verificar-workspace.sh 610→730 linhas, T1.md §6)`
- `[T1] QA (opus, re-validação): APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 0 médios, 4 baixos. criterios 4/4, criterios_falhos vazio, rastreabilidade_cts sem_teste vazio, security_flags vazio, adr_compliance sem violação. escopo SUITE_COMPLETA, determinismo_observado passou de "suspeito" para "ok".`
- `[T1] QA — MED-001 corrigido e provado empiricamente nos dois estados de ambiente: com .env/.env.local/.env.producah reais na raiz, a bateria sai 0 com o CT-004 EXERCIDO (não pulado) e os três arquivos voltam com SHA-256 idêntico; sem resguardo órfão e sem clone órfão.`
- `[T1] QA — AP-24 (weakening test to pass) NÃO detectado: as +120 linhas se explicam integralmente pelas funções de resguardo, pelos traps de sinal, pela asserção de registro do CT-002 e pela asserção de restauração do CT-004. Nenhum caso virou condicional, nenhum grep afrouxou, nenhum teto de tempo subiu.`
- `[T1] baixos remanescentes (4) acumulados para a §2 do run-report.md: BAIXO-001 (janela entre mv e registro do resguardo), BAIXO-002 (§6 declara ADR-0006 sem objeto, mas .gitignore e .env.example a citam), BAIXO-003 (pré-condição do card CT-004 ainda descreve o aborto substituído), BAIXO-004 (código de saída de pnpm -r list capturado e não asserido).`
- `[T1] rule_candidates: +1 sinal do QA persistido (repeated_assertion_shape — contagem de membros do workspace)`
- `[T1] retry classification: N/A — rejeição foi do QA (Gate 1), que sempre re-passa pelo próprio gate. Algoritmo requires_qa_revalidation não se aplica.`

### T1 — Gate 2 (tentativa 2)

- `[T1] Tech Review (opus): PARCIAL — 1 ALTO (P1 architecture), 2 MEDIO (P2 best_practices, P3 architecture), 1 BAIXO (P4 adr_compliance), 0 CRITICO.`
- `[T1] TR consultou: ADR-0005, ADR-0006, ADR-0007`
- `[T1] TR — anti-gaming da correção do MED-001: LIMPO. Nenhuma asserção removida, enfraquecida ou tornada condicional; uma foi endurecida (contagem por caminho exato com grep -cxF). Sem CRITICO/testability.`
- `[T1] TR — scope_deviation: NENHUM. Os 3 arquivos fora das §3.1/§3.2 foram julgados legítimos; o pnpm-lock.yaml é exigido pelo scope §3.10 e T1 é o lugar certo para criá-lo.`
- `[T1] TR — riscos delegados resolvidos: typescript 7.0.2 APROVADO (emit de design:paramtypes verificado); decomposição verificar-workspace.sh vs verificar-fundacao.sh CORRETA; concorrência do CT-004 absorvida no P2.`
- `[T1] TR — rule_candidates_emitidos: vazio (o TR registrou nas observações que a ausência de .claude/rules/testing-stack.md é sinal plausível, mas sem problema-âncora citável não emitiu — a curadoria avalia fora do gate).`

### T1 — retry classification

- attempt: 2
- problemas_por_categoria: { architecture: 2, best_practices: 1, adr_compliance: 1 (baixo, não entra no cálculo) }
- overrides_ativos: [tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: provável]
- requires_qa_revalidation: **true**
- decisao: PASSAR PELO QA (próxima rodada vai Gate 1 → Gate 2)
- justificativa: "P1 e P3 são `architecture` (revalidation_required); além disso o override `tocou_area_critica: true` força `true` por si só"
- `[T1] auto-escalate: não aplicável — resolved_model já é opus (declarado no frontmatter); a regra escala sonnet→opus[xhigh]. CLAUDE.md proíbe sonnet/haiku no projeto. Tentativa 3 é a ÚLTIMA (limite de 3 totais).`

### T1 — tentativa 3 (correção do Gate 2)

- `[T1] executor (opus): 0 criados, 3 modificados (turbo.json 20→61 linhas, verificar-workspace.sh 730→702, T1.md §3.1/§5.5/§5.6/§6). .env.example intocado — a decisão do P1 foi passthrough explícito, não bloqueio.`
- `[T1] QA (opus, re-validação obrigatória por requires_qa_revalidation=true): APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 0 médios, 2 baixos. criterios 7/7, escopo SUITE_COMPLETA, 62 asserções verdes, determinismo "ok".`
- `[T1] QA — cenário D (a asserção que fecha o P1) provado honesto POR MUTAÇÃO, não por leitura: removendo globalEnv, NODE_ENV passa a <ausente>; removendo test.env, as quatro de conexão passam a <ausente>. As declarações do turbo.json são a causa real do verde. Par declarada/não-declarada presente nas duas pontas.`
- `[T1] QA — Iron Law #6 (seam) respeitada: turbo.json não ganhou tarefa/script/variável só para o teste (grep -c SONDA turbo.json = 0); o cenário D sonda a tarefa `test`, que já era declarada; a variável de controle está deliberadamente FORA do turbo.json.`
- `[T1] QA — AP-24 limpo apesar do encolhimento de 28 linhas: as 5 asserções do CT-004 seguem literais, o grep -cxF por caminho exato NÃO regrediu para substring, e a remoção autorizada tem SUT_IS_CORRECT_BECAUSE com motivo verdadeiro (grep por resguard/SOMA_RESGUARDO/CT004_ARMADO devolve só 3 ocorrências, todas em prosa do bloco CAUSA-RAIZ — zero código vivo).`
- `[T1] QA — mover o CT-004 para o clone FORTALECEU o caso: git clone não copia .git/info/exclude, então o caso passa a medir exclusivamente o .gitignore VERSIONADO, sem risco de um exclude local mascarar um .gitignore quebrado.`
- `[T1] QA — JSONC no turbo.json confirmado empiricamente nos dois consumidores COM controle negativo (injetou `,,`: ambos apontaram o erro de sintaxe e nenhum reclamou do comentário). O turbo.json está no escopo do files.includes do Biome, logo o pnpm lint do CT-001 exercita o caminho de verdade.`
- `[T1] QA — prova central: com .env/.env.local/.env.producao reais na raiz, inode, mtime, atime, ctime, tamanho e SHA-256 dos três INALTERADOS. Nem o atime mudou — nenhum caso sequer os leu.`
- `[T1] débitos da tentativa 2 reconciliados (o QA declarou não ter o próprio JSON da tent.2 em contexto): BAIXO-001 (janela mv/registro do resguardo) RESOLVIDO por remoção da maquinaria via P2; BAIXO-002 (§6 e ADR-0006) RESOLVIDO via P4; BAIXO-003 (card do CT-004 defasado) RESOLVIDO na reescrita da §5.6; BAIXO-004 (código de saída de pnpm -r list não asserido) RESOLVIDO — verificar-workspace.sh:285 agora assere "pnpm -r list --depth -1 sai 0".`
- `[T1] rule_candidates: sinal do QA deduplicado (mesmo tema `repeated_assertion_shape` já persistido nas rodadas 1 e 2 — não anexado de novo).`
- `[T1] observação do QA fora do escopo da task, encaminhada ao usuário: o CLAUDE.md afirma que a ADR-0006 "morreu com o Frappe", mas o docs/adr/INDEX.md a registra como `accepted`, e ambos os gates a trataram como viva. Os dois documentos precisam ser reconciliados.`

### T1 — Gate 2 (tentativa 3) e fechamento

- `[T1] Tech Review (opus): APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 0 médios, 2 baixos (P1 project_pattern, P2 code_quality). Os quatro problemas da tentativa 2 RESOLVIDOS.`
- `[T1] TR consultou: ADR-0005, ADR-0006, ADR-0007`
- `[T1] TR verificou P1 e P3 por MEDIÇÃO PRÓPRIA, não pelo relato do executor: `turbo run build --dry=json` devolve globalCacheInputs.environmentVariables.specified.env = ["NODE_ENV"] e globalCacheInputs.files = [".mise.toml", "biome.json", "tsconfig.base.json"].`
- `[T1] TR — decisão do P1 julgada correta como ficou: build sem variáveis de conexão procede (acoplar cache de compilação a DATABASE_URL faria trocar de banco invalidar artefato byte a byte idêntico); NODE_ENV em globalEnv custa um cache miss de Biome desprezível e é a colocação mais defensável (NODE_ENV muda o que é produzido); lint com dependsOn:[] correto para Biome (ressalva: se um dia entrar linter type-aware, passa a precisar de ^build).`
- `[T1] TR — arquivos inalterados sem regressão: git diff --stat nos 10 paths devolve exatamente os mesmos números da tentativa 2 (591 inserções).`
- `[T1] TR — segurança: mover o CT-004 para o clone REDUZ superfície (some a criação de 3 arquivos com credencial fictícia na raiz real e some a janela em que o .env do operador ficava renomeado sem aviso sob SIGKILL).`
- `[T1] TR — decisão pedida, não-bloqueante: **a ADR-0006 está VIVA**; o CLAUDE.md é que erra ao listá-la entre as mortas. Critério: a 0002 e a 0003 nomeiam primitivas do Frappe (DocType, fixture, DocPerm) e morrem com elas; a 0006 não nomeia mecanismo — a Decision é "a suíte de verificação nunca executa contra o ambiente que atende a operação", escrita para sobreviver à troca de substrato, e uma das alternativas rejeitadas antecipa literalmente esta migração. Recomendação: corrigir o CLAUDE.md, NÃO superseder (produziria ADR nova com a mesma decisão — churn puro).`
- `[T1] TR — risco carry-forward para T4: declarar DATABASE_URL/REDIS_URL em test.env remove um guarda estrutural acidental (o Strict Environment Mode impedia a suíte de enxergar a conexão operacional). O helper de embedded-postgres deve ignorar process.env.DATABASE_URL POR CONSTRUÇÃO, com asserção própria — um caso que exporte DATABASE_URL para destino impossível e prove que a suíte subiu a instância efêmera assim mesmo.`
- `[T1] TR — risco carry-forward para T7: o CT-004 passou a depender do CT-001 (precisa de DIR_CLONE). verificar-fundacao.sh deve preservar a ordem de invocação e NÃO paralelizar os casos dentro deste script.`
- `[T1] TR — rule_candidates_emitidos: 1 (convention_drift — narrativa de revisão em arquivo de produção). Persistido.`
- `[T1] TR — higiene: o órfão /tmp/tmp.ENuz24wPTg (40K, andaime do experimento do P1/P3 da rodada anterior) foi inspecionado e removido pelo próprio TR.`
- `[T1] staged: .mise.toml, package.json, pnpm-workspace.yaml, turbo.json, biome.json, tsconfig.base.json, .env.example, .gitignore, pnpm-lock.yaml, apps/.gitkeep, packages/.gitkeep, deploy/scripts/instalacao/verificar-workspace.sh, tasks/T1.md — 12 arquivos, 1354 inserções. NÃO commitado (decisão do usuário).`
- `[T1] memória lazy _run/tmp/T1.md deletada (cleanup_on_approval).`
- `[T1] CONCLUÍDA em 3 tentativas (limite: 3). Gate 1 rejeitou 1x (MED-001), Gate 2 rejeitou 1x (P1 ALTO + 2 MEDIO).`

### T2 — pré-execução

- `[T2] base_sha=540c6d998e63f83b90a49fcd392b78d77840833a (HEAD inalterado — T1 ficou staged, sem commit; o isolamento de T2 vem do filtro por paths)`
- `[T2] executor: opus (declarado no frontmatter) · gates: [qa, tech_review] (declarado) · risk: high`
- `[T2] diff_touches_critical_path: true (secrets/config — o script gera e grava credencial de banco) → qa_model=opus, tech_model=opus`
- `[T2] ADRs injetadas no executor: ADR-0005 (fonte: task §6)`
- `[T2] MODO ADAPTADO — execução manual assistida. Motivo: `sudo` neste host exige senha e nenhum subagente consegue respondê-la; T2 é a única task da fatia que altera o sistema operacional do servidor que atende a operação. Divisão acordada com o usuário: (a) o executor subagente ESCREVE os artefatos versionados (`provisionar-base.sh` e `verificar-provisionamento.sh`) sem executar nada privilegiado; (b) o orquestrador conduz a execução com o usuário em sessão SSH própria, um comando por vez com validação; (c) as saídas capturadas viram a evidência de execução entregue ao Gate 1, que auditará os scripts e as saídas SEM re-executar. Esta adaptação será declarada explicitamente no run-report — o QA reportará `executou_testes: false`, e isso NÃO deve ser lido como suíte pulada.`

### T2 — execução assistida (conduzida pelo orquestrador com o usuário)

- `[T2] executor: 2 criados (provisionar-base.sh 1073 linhas, verificar-provisionamento.sh 876 linhas), 1 modificado (T2.md checkboxes). 5/5 CTs implementados, NÃO executados pelo executor (exigem privilégio).`
- `[T2] revisão prévia do orquestrador ANTES de autorizar sudo em produção: bash -n limpo nos dois; nenhum stop/disable/mask/purge/DROP; único rm -rf é do diretório temporário próprio; os 3 restarts são de instâncias novas (postgresql@18-main, redis-server@sysloc, sysloc-mailpit). P10 pula se redis-server já instalado; P02 roda `apt-get install -s` e ABORTA se a operação pretender remover pacote.`
- `[T2] estado real do host levantado: Redis 7.0.15 (legado) ativo na 6379; nenhum PostgreSQL; memcached, docker, postfix ativos; portas 6380/1025/8025 livres; 5,2 GiB livres (82%).`
- `[T2] Passo 0 (conferência, sem sudo): OK — 5270 MiB livres, 3 portas livres.`
- `[T2] Passo 1: diretório de evidência /var/tmp/sysloc-provisionamento criado.`
- `[T2] Passo 2: retrato PRÉ capturado em /var/tmp/sysloc-provisionamento/retrato-pre (modo somente-leitura confirmado por inspeção antes da autorização).`
- `[T2] Passo 3 — 1ª execução: código de saída **0**. 11 passos alterados, 3 já corretos. P01-P03 CRIADO, P04 JA-OK (o apt já habilitou postgresql.service), P05-P08 CRIADO, P09 JA-OK, **P10 JA-OK — pacote redis-server do legado NÃO tocado**, P11-P14 CRIADO. apt: "0 upgraded, 7 newly installed, 0 to remove" — nenhum pacote pré-existente alterado. Consumo de disco 155 MiB (5270 → 5115 MiB), bem abaixo dos 382 MiB estimados.`
- `[T2] Passo 3 — aviso na saída NÃO atribuível ao provisionamento: `/sbin/ldconfig.real: /lib/libvarnishapi.so.3 is not a symbolic link`. Defeito pré-existente da instalação do Varnish, exposto pelo gatilho do libc-bin. O CT-005 confirmará objetivamente.`
- `[T2] Passo 4/6: retratos pos1 e pos2 capturados.`
- `[T2] Passo 5 — 2ª execução: código de saída **0**, `0 passo(s) alterado(s), 14 passo(s) já corretos`, ZERO linhas CRIADO. P06 reportou "já presente e íntegro (credencial preservada)" — o script NÃO regera o segredo, que era o modo de falha caçado pelo CT-001. A verificação de portas distingue instância própria de colisão real ("já em uso por redis-server@sysloc.service (nossa instância)"), sem o que a 2ª execução abortaria contra si mesma.`
- `[T2] Passo 7: strace instalado (1 newly installed, 0 to remove) DEPOIS do retrato-pos2 — não contamina as comparações pre×pos2 nem pos1×pos2.`
- `[T2] Passo 8 — bateria: **5/5 casos aprovados**. CT-002 (10 asserções), CT-001 (30), CT-003 (11, com a (g) do strace exercida e a (h) provando que a varredura reprova), CT-004 (11, com reinício real de redis-server@sysloc e sondagem em 0s), CT-005 (11 — 39 unidades em execução preservadas, 24 portas pré-existentes com o mesmo dono, nenhum arquivo de unidade legado alterado, interseção vazia entre portas novas e pré-existentes).`
- `[T2] medição independente do ORQUESTRADOR (sem privilégio, pós-bateria): postgresql@18-main, redis-server@sysloc e sysloc-mailpit ACTIVE e ENABLED; redis-server (6379) do legado SEGUE ACTIVE; portas novas 1025/8025/6380 todas presas a 127.0.0.1; NENHUMA porta 5432 (PostgreSQL só em socket unix, como exigido).`
- `[T2] evidência preservada em scratchpad/t2-evidencia/ (bateria.txt, execucao-1-resumo.txt, execucao-2.txt, estado-observado-pelo-orquestrador.txt) — /var/tmp/sysloc-provisionamento é 0700 root e NÃO é legível pelo QA. Varredura confirmou ausência de credencial nas evidências.`

### T2 — Gate 1 (tentativa 1)

- `[T2] QA (opus): REJEITADO — 0 críticos, **1 ALTO** (ALTO-001, categoria security), 0 médios, 3 baixos. criterios 7/7, criterios_falhos vazio, rastreabilidade_cts sem_teste vazio, adr_compliance sem violação.`
- `[T2] QA — executou_testes: false / escopo NAO_EXECUTADO — reflete apenas o papel do QA (sudo indisponível a subagentes). A bateria FOI executada de forma assistida (5/5, exit 0) e o QA auditou as 4 evidências preservadas. NÃO é suíte pulada.`
- `[T2] QA — ALTO-001 (security): a regex `[A-Za-z0-9]*` de leitura da credencial ESTREITA em vez de falhar; senha com caractere não alfanumérico é truncada no prefixo, o guarda de formato não dispara (só checa captura vazia), e o P09 executa ALTER ROLE ... PASSWORD '<prefixo>' rebaixando silenciosamente a senha do banco enquanto o arquivo de ambiente mantém o valor completo. Latente hoje (a senha gerada é alfanumérica); o gatilho é o próprio arquivo instruir a troca manual. Regex replicada no verificador, enfraquecendo 4 asserções do CT-003.`
- `[T2] QA — security_flags: ["credential_parsing_truncation", "queue_without_authentication"] → tech_model=opus (já era, por CLAUDE.md e critical_path).`
- `[T2] QA — Iron Law #6 APROVADA: SYSLOC_MINIMO_DISCO_MIB e SYSLOC_DESTINO_DISCO julgados parâmetros legítimos de operação, não seam de teste (padrão = valor de produção; CT-002 altera só o destino; sem bandeira de desvio).`
- `[T2] QA — investigou e descartou falso positivo: postgresql@18-main como `enabled-runtime` é o estado CORRETO no empacotamento Debian/Ubuntu (gerador postgresql-generator + start.conf=auto; persistência via postgresql.service com symlink permanente).`
- `[T2] política débito-controlado: 1 ALTO bloqueia → loop de correção. Os 3 baixos vão como observação (mas BAIXO-003 tem valor de segurança real e será recomendado).`
- `[T2] memória lazy criada: _run/tmp/T2.md (attempt_count=1, last_severity=ALTO)`
- `[T2] auto-escalate: resolved_model já é opus (declarado); a regra escala sonnet→opus[xhigh]. Mantido opus.`
- `[T2] CONSEQUÊNCIA DO MODO ADAPTADO: a correção altera os dois scripts, então a bateria precisa ser RE-EXECUTADA de forma assistida antes do re-QA. Sem execução nova não há evidência nova.`

### T2 — tentativa 2 (correção do ALTO-001)

- `[T2] executor (opus): 0 criados, 3 modificados (provisionar-base.sh, verificar-provisionamento.sh, T2.md §5.6). CT-003 passou de 8 para 10 asserções — (i) e (j) são o guarda de regressão do ALTO-001.`
- `[T2] correção FOI ALÉM da sugestão do QA, com razão: o `[^@]*` proposto pelo gate AINDA truncaria senha contendo `@`. O executor usou captura gulosa até o ÚLTIMO `@`, de modo que a senha vem íntegra e é RECUSADA em vez de cortada. Extração e validação viraram passos separados (`credencial_manuseavel` como teste explícito que pode falhar), e o guarda foi replicado IMEDIATAMENTE ANTES do `ALTER ROLE` do P09 — o ponto onde um refactor futuro do P06 faria estrago.`
- `[T2] racional do alfabeto restrito (registrado pelo executor): a credencial viaja dentro de `DATABASE_URL`, onde `:`/`@`/`?`/`&`/`/` são delimitadores; sem codificação percentual correta nas duas pontas o formato não carrega valor arbitrário. Optou por EXIGIR o invariante em vez de ampliar o alfabeto. Dois diagnósticos distintos: "não consegui interpretar o arquivo" × "interpretei, e o valor tem caractere que não sei manusear" — este último abortando com `NADA foi alterado`.`
- `[T2] evidência do executor SEM privilégio (harness que extrai as funções REAIS dos arquivos entregues, não reescritas à mão): 9 senhas com caractere fora do alfabeto → todas ABORTAM (a antiga capturava `Ab3` de `Ab3@Xy9` — não-vazio, driblando o guarda); 2 alfanuméricas → devolvidas ÍNTEGRAS; arquivo sem DATABASE_URL → diagnóstico DISTINTO; a credencial real de 32 chars do servidor → passa íntegra. Bloco (i)/(j) extraído do verificador e rodado: 7/7 recusas, devolução íntegra de 36 chars.`
- `[T2] os 3 baixos também corrigidos: BAIXO-003 (varredura passou de `git ls-files` para `--cached --others --exclude-standard` — de 332 para 349 arquivos varridos, cobrindo os untracked que são justamente os entregues pela task); BAIXO-001 (a asserção (g) agora exige que a execução rastreada saia 0 e registre ≥20 execve); BAIXO-002 (expressão corrigida para `(--password[= ]|--dbpassword[= ]|PGPASSWORD=)`, com o card do CT-003 na §5.6 atualizado para manter rastreabilidade literal).`
- `[T2] EFEITO COLATERAL DECLARADO pelo executor: com (g) exigindo sucesso da execução rastreada, a bateria passa a DEPENDER de rede alcançável ao apt.postgresql.org (antes ela passava vazia sem rede). É o comportamento correto, não regressão.`
- `[T2] DECISÃO DE EVIDÊNCIA na re-execução: o `retrato-pre` original (estado da máquina ANTES de qualquer instalação) NÃO será recapturado — é a única peça irrepetível, e é contra ela que o CT-005 prova a não-degradação do legado. Serão refeitos apenas `retrato-pos1`, `retrato-pos2`, `execucao-1.log/.codigo` e `execucao-2.log/.codigo`, com o script corrigido. Assim o CT-005 mantém a força total (pre genuíno × pos2 atual) e passa a cobrir também as novas execuções.`
- `[T2] execução assistida RODADA 2 (5 comandos): duas execuções com exit 0 e `0 alterados, 14 já corretos`; P06 JA-OK "credencial preservada" e P09 JA-OK SEM "senha ressincronizada" — prova direta de que a correção do ALTO-001 não quebrou o caminho feliz contra o /etc/sysloc/backend.env real. Bateria: **5/5 aprovados**, CT-003 de 11 para 18 asserções, 85 execve registradas em (g).`
- `[T2] retrato-pre preservado (não recapturado) — o CT-005 seguiu comparando o estado pré-instalação genuíno (5270 MiB) com o atual (5141 MiB): 39 unidades preservadas, 24 portas com o mesmo dono, nenhum arquivo de unidade legado alterado, interseção vazia.`

### T2 — Gate 1 (tentativa 2)

- `[T2] QA (opus): REJEITADO — 0 críticos, **3 ALTOS** (ALTO-001 tests/tautological_assertion, ALTO-002 tests/mock_of_own_repository, ALTO-003 security), 0 médios, 1 baixo. criterios 7/7, rastreabilidade_cts sem_teste vazio, adr_compliance sem violação.`
- `[T2] QA CONFIRMOU que a correção do CÓDIGO DE PRODUÇÃO ataca a causa: extraiu credencial_manuseavel e ler_credencial_db dos arquivos reais e rodou 10 casos de fronteira, todos corretos; endossou a decisão de exigir alfabeto restrito em vez de codificação percentual; confirmou gerar_segredo com 200/200 amostras dentro do alfabeto. O que reprovou foram os TESTES que deveriam guardar a correção, mais um defeito novo.`
- `[T2] ALTO-001: a asserção "afirma o invariante antes do ALTER ROLE" é DECORATIVA — casa comentários e mensagens que contêm o texto. Provado em 3 cenários de remoção sobre cópias do arquivo real, incluindo um script SEM guarda algum: devolveu 1 nos três.`
- `[T2] ALTO-002: as asserções (i)/(j) exercitam o leitor do VERIFICADOR, não o do provisionador. O QA restaurou a extração truncante numa cópia e TODAS as asserções commitadas seguiram verdes — a bateria aprovaria 5/5 um provisionador com o ALTO-001 de volta. O harness certo existe mas foi rodado à mão e não commitado.`
- `[T2] ALTO-003 (NOVO, security): com duas linhas DATABASE_URL, `head -1` pega a PRIMEIRA enquanto EnvironmentFile= do systemd e leitores de .env do Node resolvem pela ÚLTIMA. Exercitado com os dois leitores reais: devolveram SENHAVELHA111 contra o efetivo SENHANOVA999. O valor obsoleto é alfanumérico, atravessa o guarda, e o P09 reescreve a senha do banco para a antiga reportando sucesso.`
- `[T2] QA aprovou e NÃO deve ser mexido: AP-24 não houve (crescimento 11→18 é aditivo, (e) e (g) ficaram estritamente mais fortes); a decisão de preservar o retrato-pre é metodologicamente CORRETA (recapturá-lo faria a asserção (d) do CT-005 reprovar por artefato de método); BAIXO-003 da rodada 1 corrigido e medido (332→349, sem --exclude-standard saltaria para 934).`
- `[T2] security_flags: ["credential_file_ambiguous_assignment", "queue_without_authentication"]`
- `[T2] memória lazy atualizada: attempt_count=2, last_severity=ALTO. **TENTATIVA 3 É A ÚLTIMA** (limite de 3 totais).`
- `[T2] rule_candidates do QA: 2 sinais (repeated_assertion_shape — auditoria estática sem prova de falsificação; repeated_fixture — arquivo de ambiente sintético duplicado). Persistidos.`

### T2 — tentativa 3 (última; correção dos 3 ALTOS)

- `[T2] executor (opus): 0 criados, 3 modificados. O bloco de leitura do CT-003 passou de 4 para 25 asserções, agora sobre DOIS SUTs (leitor do provisionador + leitor do verificador).`
- `[T2] MUDANÇA ESTRUTURAL em vez de remendo no teste: o caminho de leitura saiu de dentro de `passo_p06_arquivo_ambiente` (que escreve em /etc, consulta o cluster e exige root — logo intestável) para `extrair_credencial_db`, função SEM EFEITO COLATERAL que o verificador carrega do arquivo real. Quem valida e quem executa passaram a ser o mesmo código; a duplicação que gerou o ALTO-002 deixou de ter razão de existir.`
- `[T2] TESTE DE MUTAÇÃO executado pelo executor (4 mutantes + controle, todos com bash -n limpo, asserções COMMITADAS extraídas do verificador via sed e aplicadas a cada cópia):`
  - `controle → 0 reprovações (correto)`
  - `sem-guarda-p09 (a regressão-alvo) → REPROVA ALTO-001 com diagnóstico "passo_p09_credencial_valida NÃO afirma credencial_manuseavel antes de reescrever a senha"`
  - `sem-guarda-nenhum (o cenário que enganava o awk) → REPROVA ALTO-001`
  - `extracao-truncante → REPROVA (i) com "esperado[RECUSA] obtido[DEVOLVE:VALORSINTETICO]" — o prefixo truncado de VALORSINTETICO@DOCT003`
  - `head-1-de-volta → REPROVA (k) com "obtido[DEVOLVE:SENHASINTETICAVELHA111]" — o valor obsoleto que o systemd NÃO usaria`
- `[T2] prova direta do ALTO-002: em CADA mutante do provisionador, a linha `[verificador] simbolo @ -> RECUSA | duplicada -> RECUSA` manteve-se VERDE — sem a asserção do lado do provisionador, a tabela inteira teria passado.`
- `[T2] os mutantes falham em UMA asserção cada, não em bloco — a tabela discrimina.`
- `[T2] simulação byte a byte do arquivo real do servidor (1 DATABASE_URL, 32 alfanuméricos): provisionador e verificador saem 0 com credencial íntegra → a 3ª execução deve seguir reportando 14 passos já corretos.`
- `[T2] BAIXO-001 corrigido com ressalva declarada: o cabeçalho melhorado só aparece em arquivo GERADO DO ZERO; o /etc/sysloc/backend.env existente mantém o antigo, porque reescrevê-lo mudaria seu SHA-256 e quebraria a asserção do CT-001. Decisão correta — a integridade da asserção de idempotência vale mais que a linha de documentação, e o operador pode colá-la à mão sem risco.`
- `[T2] execução assistida RODADA 3: duas execuções exit 0 com `0 alterados, 14 já corretos`; P06 JA-OK "credencial preservada" e P09 JA-OK — o guarda de repetição do ALTO-003 e a refatoração para `extrair_credencial_db` NÃO quebraram o caminho feliz contra o arquivo real.`
- `[T2] bateria RODADA 3: **5/5 aprovados**. CT-003 passou de 18 para 41 asserções, TODAS aditivas. Presentes: a linha de carregamento do SUT real (`leitor do provisionamento carregado de provisionar-base.sh`), cada cenário (i)/(j) duplicado para os DOIS leitores, e o bloco (k) inteiro (DATABASE_URL duplicada, REDIS_URL duplicada e arquivo sem DATABASE_URL × 2 leitores). A asserção estrutural do guarda do P09 foi reescrita e reporta diagnóstico posicional ("guarda na linha 17 do corpo, ALTER ROLE na linha 23"). (g) com 89 execve.`

### T2 — Gate 1 (tentativa 3) — APROVADO

- `[T2] QA (opus): APROVADO_COM_OBSERVACOES — 0 críticos, 0 altos, 0 médios, 4 baixos. criterios 5/5, rastreabilidade_cts sem_teste vazio, adr_compliance sem violação, determinismo "ok", stack_discovery.discovery_needed passou para FALSE.`
- `[T2] QA REPRODUZIU a prova de falsificação do zero, sem aceitar o relatório: 9 mutantes (4 do executor + 4 próprios: guarda-sem-negação, função-renomeada, ALTER-ROLE-em-função-auxiliar, guarda-inerte), asserções COMMITADAS extraídas por sed, aplicadas em diretório temporário. **8 de 9 detectados.** Fidelidade do harness confirmada: o controle reproduziu o diagnóstico posicional literal da bateria real.`
- `[T2] QA — os 3 critérios de aceitação que ele mesmo fixou na rodada 2 estão ATENDIDOS: guarda do P09 removido → REPROVA; extração truncante restaurada → REPROVA 7× com obtido[DEVOLVE:VALORSINTETICO]; head -1 de volta → REPROVA com obtido[DEVOLVE:SENHASINTETICAVELHA111].`
- `[T2] QA — ALTO-003 resolvido na causa, e RECUSAR a ambiguidade foi julgado melhor que o tail -1 que o próprio gate havia sugerido: recusar não escolhe um lado, e a discordância entre systemd e leitor ingênuo deixa de existir por construção. O guarda é genérico sobre `^[A-Za-z_][A-Za-z0-9_]*=`, alcançando REDIS_URL e SMTP_URL pela mesma causa. Nenhum head -1 sobrou no caminho de leitura de variável.`
- `[T2] QA — refatoração para extrair_credencial_db validada: função sem efeito colateral (só lê, grepa, seda, escreve em 2 globais; não escreve em disco, não consulta cluster, não exige root). O carregamento por sed falha ALTO e ENCERRA o caso — provado com o mutante função-renomeada. O cenário sutil (extrair_credencial_db passar a chamar helper não carregado) é pego pela asserção (j), o companheiro positivo.`
- `[T2] QA — AP-24 não houve: (a)-(h) preservadas literalmente; (i) virou 7 símbolos × 2 SUTs; (j) colapsou em comparação de igualdade literal do valor, que é MAIS estrita que as duas asserções separadas; (k) inteiramente nova. A substituição da estrutural é legítima e justificada no comentário de causa-raiz (verificar-provisionamento.sh:342-355).`
- `[T2] BAIXO-001 (security, PRÉ-EXISTENTE, o QA admite ter deixado passar 2 rodadas): a asserção (h) faz `grep -cF "${credencial}"`, pondo a credencial real no argv de processo filho — dentro do caso que afirma que isso não acontece. Os helpers irmãos (varrer_arvore_versionada:403, contar_ocorrencias:432) já recebem a agulha por stdin por essa razão. Exposição estreita (atacante local sondando /proc numa janela sub-milissegundo, execução manual e rara). Sinalizado em security_flags PARA O GATE 2 examinar em profundidade.`
- `[T2] BAIXO-002: 1 mutante sobrevivente — manter o `if ! credencial_manuseavel` e trocar o corpo `abortar` por `info`. A auditoria confere presença e POSIÇÃO do guarda, não que ele aborte. Baixo porque é sabotagem deliberada (todas as formas acidentais são pegas) e o valor perigoso não chega ao P09 (o P06 aborta com código 3 antes).`
- `[T2] BAIXO-003: a asserção estrutural reprova em reformatações benignas — `"$senha_db"` sem chaves e reflow do printf partindo o literal. Mitigação forte: falha ALTO com diagnóstico acionável, nunca verde em silêncio. O QA NÃO a classificou como AP-02 porque o invariante em si É estrutural (o guarda do P09 é defesa em profundidade sobre ramo inalcançável; não há comportamento observável para asserir).`
- `[T2] BAIXO-004: o QA CORRIGIU uma justificativa factualmente errada do executor — não reescrever o arquivo de ambiente NÃO se justifica pelo SHA-256 do CT-001 (a asserção compara pos1×pos2; uma reescrita idempotente passaria). A decisão está certa pela razão declarada no cabeçalho do próprio script: o arquivo que guarda a credencial viva é dali em diante apenas LIDO.`
- `[T2] security_flags: ["credential_in_child_process_argv"] → tech_model=opus (já era, por CLAUDE.md e critical_path).`
- `[T2] rule_candidates do QA: 2 sinais (repeated_assertion_shape — auditoria estática por contagem de grep; repeated_fixture — retrato de estado como fixture compartilhada). Persistidos.`

### T2 — Gate 2 — PARCIAL, limite de tentativas atingido

- `[T2] Tech Review (opus): PARCIAL — 0 críticos, **1 ALTO** (P1 security), **5 MEDIOS** (P2 architecture, P3 adr_compliance, P4 security, P5 architecture, P6 architecture), 2 BAIXOS (P7 architecture, P8 project_pattern).`
- `[T2] TR consultou: ADR-0005, ADR-0006`
- `[T2] TR NÃO re-executou a suíte (impossível sem sudo) e aceitou a evidência preservada como fonte de verdade. Declarou que nenhum finding depende de execução.`
- `[T2] TR — P1 (ALTO): DIVERGIU do QA em dois pontos, com razão. (a) "pré-existente" não se aplica — nada deste arquivo está em main, é código novo entrando no repositório; a tentativa 2 não é linha de base. (b) o critério não é a largura da janela, e sim que é requisito técnico DECLARADO da própria task, não atendido, com o idioma correto já estabelecido duas vezes no mesmo arquivo. Acrescentou exposição que o QA não viu: a linha 793 materializa a credencial em disco em texto claro duas vezes (arquivo de trabalho + blob do índice git do clone), e o rm -rf da 805 não sobrevive a SIGKILL (os traps cobrem INT/TERM/HUP).`
- `[T2] TR — P1 correção proposta é melhor que a do QA: usar AGULHA SINTÉTICA na asserção (h). A propriedade que (h) prova é do MECANISMO (a varredura acha o que existe e omite o valor), não do segredo — então a credencial real nunca precisa sair de ${ARQ_AMBIENTE}. Resolve as duas exposições de uma vez.`
- `[T2] TR — P2 (MEDIO): o P06 é tudo-ou-nada; não sabe acrescentar chave ausente nem conferir coordenada de arquivo existente. Três consequências verificáveis: (1) `extrair_credencial_db:387` exige só `^REDIS_URL=redis://` sem conferir a porta — um arquivo com `redis://127.0.0.1:6379` atravessa a validação e a partir de T6 o backend novo enfileiraria trabalho de negócio DENTRO DA INSTÂNCIA REDIS DO LEGADO; (2) SMTP_URL não é exigido em lugar nenhum; (3) `porta_do_cluster` descobre a porta VIVA e o P09 valida com ela, enquanto o `port=` gravado em DATABASE_URL é o do instante da criação — se divergirem, P09 imprime JA-OK e as unidades de T7 apontam para socket inexistente.`
- `[T2] TR — P3 (MEDIO, adr_compliance): a bateria reinicia a instância provisionada e reexecuta o provisionador no host real, sem guarda que a impeça de rodar depois que essa instância passar a atender a operação. HOJE não contradiz a ADR-0006 (quem atende é o /opt/frappe), mas a partir da F7 `redis-server@sysloc` VIRA produção e o mesmo script versionado continuará disponível. O cabeçalho argumenta a conformidade falando da suíte Vitest de T4 — que é outro artefato.`
- `[T2] TR — P4 (MEDIO, security): fila sem requirepass. Julgou "aceitável adiar, NÃO aceitável deixar sem dono". Aceitável porque a T2 não DEGRADA a postura do host (o redis do legado na 6379 já roda sem autenticação) e porque na F0 a fila está vazia. Deixa de ser aceitável em T6 (trabalho de negócio) e T7 (carga real). Razão técnica para não corrigir agora: ligar requirepass exige gravar o segredo em REDIS_URL de um arquivo que já existe, e o P06 não sabe acrescentar chave — **fechar o P2 é pré-requisito de fechar o P4**.`
- `[T2] TR — P5 (MEDIO): o caminho de leitura existe duas vezes e a duplicação é POLICIADA por sed+eval em vez de ELIMINADA. Reconheceu o mérito (foi o que consertou o ALTO-002), mas objetou ao desenho: "quem valida e quem executa são o mesmo código" deveria ser propriedade ESTRUTURAL (um arquivo, um source), não REDERIVADA por extração textual a cada execução. Sobre o contágio: risco menor que parece (da T3 em diante é Node/Vitest com import), mas deploy/scripts/ cresce em F5 e F7.`
- `[T2] TR — P6 (MEDIO): DUAS divergências com o .env.example de T1, não uma. Esquema (`postgres://` × `postgresql://`) e forma (TCP × socket). A do esquema é a mais afiada: `extrair_credencial_db:387` ancora em `^DATABASE_URL=postgresql://`, então um arquivo escrito seguindo literalmente o exemplo de T1 é REJEITADO pelo leitor. Endereço da reconciliação: **T5**, que é quem lê a configuração e passa a ter os dois lados do contrato na mão.`
- `[T2] TR — P7 (BAIXO): 7 asserções de texto-fonte moram dentro da bateria privilegiada. Respondeu à pergunta encaminhada: lint de fonte É mecanismo legítimo para invariante sem comportamento observável — o errado é o ENDEREÇO, não o mecanismo. Propôs um terceiro modo `lint` ao lado do `retrato`, sem privilégio, que a bateria completa invoca.`
- `[T2] TR — P8 (BAIXO): o único item desmarcado da §4 é justamente a idempotência, que o CT-001 prova 5/5.`
- `[T2] TR — ajuste ao prompt do orquestrador, procedente: a instrução "identificadores de código em inglês" NÃO é a convenção do shell neste repositório. Conferiu os 3 precedentes aprovados (preparar-site-efemero.sh, verificar-golden.sh, verificar-workspace.sh de T1) — todos usam identificadores em pt-BR. T2 segue o precedente com exatidão. Recusou-se a emitir finding que seria "inventar convenção contra a base instalada".`
- `[T2] TR — acertos registrados: guarda de disco antes de qualquer alteração; simulação apt-get -s que aborta se pretender REMOVER pacote; portas derivadas de ss -ltn em vez de lista fixa; impressão digital da chave PGDG conferida após download HTTPS; SHA-256 fixada do artefato do capturador; `listen_addresses = ''` tornando colisão com o legado estruturalmente impossível; papel sem SUPERUSER/CREATEDB/CREATEROLE/REPLICATION com pg_hba restrito; `SET log_statement = 'none'` na sessão que cria e ressincroniza a senha; unidade do capturador endurecida. "Bem acima da média do que se vê em script de provisionamento."`
- `[T2] LIMITE DE 3 TENTATIVAS ATINGIDO (execução inicial + 2 correções; attempt_count=3). Task marcada **Bloqueado**. Dependentes propagadas: T4, T5, T6 e T7 → `Bloqueado (dependência T2)`. Escalado ao usuário conforme 4.6.`
- `[T2] DECISÃO DO USUÁRIO: limite de tentativas estendido para uma 4ª rodada, com **escopo restrito a P1 + P2 + P3**. P4, P5, P6, P7 e P8 viram débito registrado na §2 do run-report. Bloqueio revertido; T4-T7 desbloqueadas.`
- `[T2] retry classification (tentativa 3 → 4): requires_qa_revalidation=**true** (P1 é security; P2/P3 tocam comportamento; overrides tocou_area_critica=true e task_risk=high forçariam true por si sós). Rodada passa por Gate 1 → Gate 2, e exige NOVA execução assistida antes do re-QA.`

### T2 — tentativa 4 (autorizada pelo usuário; escopo P1+P2+P3)

- `[T2] executor (opus): 0 criados, 3 modificados. Entram 6 asserções (l) de coordenadas no CT-003 e 4 asserções (f) de ADR-0006 no CT-005. Débito registrado (P4-P8) NÃO tocado, conforme a decisão.`
- `[T2] P2 — nota de desenho: `extrair_credencial_db` deixou de exigir REDIS_URL; presença e coordenada dessa chave passaram para `conferir_coordenadas_do_ambiente`, que sabe ACRESCENTÁ-LA em vez de só reprovar. **Divergência tem precedência sobre ausência** — acrescentar chave a um arquivo que já aponta para o lugar errado consertaria o detalhe e manteria o dano.`
- `[T2] P3 — escolheu o MARCADOR `/etc/sysloc/producao`, não `SYSLOC_FASE=implantacao`. Argumento: o sujeito do guarda é a INSTALAÇÃO, não a INVOCAÇÃO — propriedade da máquina deve estar registrada na máquina, e é o que a própria ADR-0006 diz ao falar que "qual ambiente concreto cumpre o papel varia ao longo do tempo". Exigir variável tornaria toda execução legítima uma cerimônia, e cerimônia repetida vira `export` no perfil do operador, evaporando a proteção por ser usada. Custo aceito (o guarda só vale quando o marcador existir) escrito no cabeçalho da função e na mensagem de recusa, como obrigação explícita da fatia de implantação.`
- `[T2] CONSEQUÊNCIA: nenhuma mudança no roteiro de execução assistida — nenhuma variável nova, Passos 0-9 idênticos.`
- `[T2] prova de falsificação (4 mutantes + 2 controles, asserções COMMITADAS extraídas por sed):`
  - `prov-controle → 6/6 PASSA · veri-controle → 4/4 PASSA`
  - `prov-sem-conferencia-redis → REPROVA 2× (REDIS_URL na 6379 volta a ser COERENTE — exatamente o dano do P2, agora com asserção que o pega; e REDIS_URL ausente volta a COERENTE)`
  - `prov-sem-conferencia-destino → REPROVA (DATABASE_URL com porta divergente volta a COERENTE)`
  - `veri-guarda-sempre-libera → REPROVA · veri-guarda-depois → REPROVA (main consulta o guarda antes dos casos)`
- `[T2] P1 — prova de EXPOSIÇÃO (não de mutação): bloco (h) extraído em duas versões e executado sob strace. Versão ANTIGA: 1 argv de filho com a credencial, 1 arquivo do clone com a credencial, 1 objeto versionado com a credencial. Versão ATUAL: **0, 0 e 0**, com agulha sintética plantada. As três transições de agulha restantes (799, 820, 851) são todas `printf | ...` — nenhuma por argv.`
- `[T2] simulação do arquivo REAL do servidor (3 chaves, socket com port=5432, REDIS_URL 6380, SMTP_URL 1025, 32 alfanuméricos): `conferir_coordenadas` devolve 0 (COERENTE), SHA-256 inalterado (673ff19f713f antes e depois), P06 reportaria JA-OK com mudancas=0 → a asserção de idempotência do CT-001 continua verde.`

### T2 — Gate 1 (tentativa 4) — REJEITADO por lacuna de falsificação

- `[T2] QA (opus): REJEITADO — 0 críticos, 0 altos, **3 MEDIOS** (MED-001 tests/happy_path_only, MED-002 tests/testing_internal_structure, MED-003 adr_compliance), 1 baixo. criterios 5/5.`
- `[T2] QA registrou EM FAVOR do executor: "o CÓDIGO ENTREGUE está CORRETO nos três pontos — a precedência funciona, a recusa aborta, e as coordenadas são conferidas; o que falta é a asserção que impede cada um de regredir".`
- `[T2] QA reproduziu a falsificação com 9 mutantes: os 4 do executor DETECTADOS; 2 dos 5 dele SOBREVIVERAM → MED-001 (precedência trocada) e MED-002 (recusa sem aborto).`
- `[T2] P1 CONFIRMADO RESOLVIDO: ${credencial} expande em 3 pontos executáveis, os três por stdin; a única ocorrência de `grep -cF "${credencial}"` está em COMENTÁRIO documentando o defeito; nenhum redirect grava a credencial em arquivo.`
- `[T2] MED-002 é a MESMA FORMA de defeito que o Gate 2 reprovou como ALTO-001 na rodada 2: a asserção fica AO LADO da operação perigosa, não SOBRE ela. Mutante com `return 0` no lugar do `exit 1`: bateria aprova 5/5, e o mutante imprime a mensagem e PROSSEGUE, reiniciando a fila logo depois de anunciar que não faria isso.`
- `[T2] MED-003: o guarda NASCE INERTE. `/etc/sysloc/producao` só existe no próprio verificador, no card do CT-005 e na telemetria. A §F7 do plano-execucao.md tem "Gate de desinstalação — todos obrigatórios" com 4 caixas, nenhuma mencionando o marcador. Registrado em adr_compliance.violacoes_grep_detectaveis.`
- `[T2] DECISÃO DO USUÁRIO: **5ª rodada autorizada, a última**. Escopo: MED-001, MED-002, MED-003. BAIXO-001 (espaço antes do `=`) vira débito registrado.`

### T2 — Gate 1 (tentativa 5) — APROVADO

- `[T2] QA (opus): **APROVADO** — 0 críticos, 0 altos, 0 médios, 0 baixos. criterios 15/15, adr_compliance sem violação, security_flags vazio, determinismo "ok". executou_testes: true / escopo PARCIAL (executou os blocos (l) e (f) extraídos do arquivo commitado contra controle + 7 mutantes, em repo falso temporário).`
- `[T2] QA reproduziu os DOIS critérios de aceitação que ele mesmo escreveu na rodada 4: MED-001 → só a (l)7 reprova o mutante de precedência trocada (as 6 anteriores marcam 0 falhas); MED-002 → só a (f)5 reprova o mutante com exit 1 → return 0 (as 4 anteriores marcam 0 falhas).`
- `[T2] QA instrumentou o `bash -c` de `executar_guarda_isolado` com sondas internas e confirmou: (a) `readonly ARQ_MARCADOR_PRODUCAO` NÃO é herdado pelo processo novo; (b) `SHELLOPTS`/`errexit` também não, então o `&& return 0` funciona lá dentro; (c) `type -t instalacao_liberada_para_bateria` = function; (d) o marcador sintético está em vigor; (e) com marcador imprime a recusa citando a ADR-0006 e sai 1, sem marcador sai 0. **A asserção mede o exit do guarda, não erro de atribuição.**`
- `[T2] QA acrescentou 5 mutantes próprios. O mais relevante: `bash -c` que NÃO carrega a função — o guarda morre com 127 e devolve != 0 sem decidir nada; a (f)5 passa por motivo alheio, **mas o companheiro positivo (f)6 REPROVA**. O par (f)5+(f)6 é robusto à classe de defeito que o executor tinha acabado de corrigir.`
- `[T2] QA — AP-24 verificado por TRÊS vias independentes: os 23 rótulos da rodada 4 continuam literalmente presentes; a contagem estática de chamadas por caso bate com 47→48 e 15→17; e sob mutantes as asserções PRÉ-EXISTENTES continuam reprovando (2 falhas nas (l) antigas, 1 na (f)2), provando que não viraram decorativas.`
- `[T2] QA — MED-003 FECHADO: o item entrou em plano-execucao.md:385, quinto marcador do "Gate de desinstalação — todos obrigatórios" da §F7, na mesma forma das 4 caixas anteriores, e a linha de Aceitação foi ajustada de 4 para 5 itens. O path bate literalmente com `readonly ARQ_MARCADOR_PRODUCAO`. Texto julgado acionável sem contexto da conversa.`
- `[T2] QA — nota de robustez não-bloqueante: a detecção de "a (f)5 falhou por motivo alheio" depende inteiramente do companheiro (f)6. Se alguém removê-lo num run futuro, a (f)5 sozinha volta a ser enganável.`

### T2 — Gate 2 (tentativa 5) e fechamento

- `[T2] Tech Review (opus): PARCIAL — 0 críticos, 0 altos, **1 MEDIO** (P9 project_pattern), 4 BAIXOS (P10 testability, P11 adr_compliance, P12 adr_compliance, P13 code_quality). adrs_consultadas: ADR-0005, ADR-0006.`
- `[T2] TR CONFIRMOU P1, P2 e P3 resolvidos. P1 verificado de forma independente: `printf` é builtin do bash, então não há execve nem argv; a agulha vai por `IFS= read -r` da stdin e chega ao grep via `-f -`; a saída passa por `cut -d: -f1,2`, então nem o conteúdo da linha casada escapa. P2: a separação é COESA, não fragmentada — são duas perguntas com modos de falha e ações de operador diferentes; a prova de que o corte está certo é `extrair_credencial_db` ter deixado de exigir REDIS_URL. P3: endossou o marcador, com argumento adicional — variável de ambiente não sobrevive a `sudo` sem `-E`/`env_keep`, então a proteção dependeria de detalhe do sudoers.`
- `[T2] P9 (MEDIO): as constantes espelhadas não têm asserção — só 2 de 6. Era inofensivo até a rodada 3 (elas nomeavam alvos do sistema real); a rodada 4 mudou a natureza delas, porque `carregar_funcoes_do_provisionador` faz eval só do CORPO das funções, nunca das constantes. A tabela (l) ficou hermética nos dois lados. Consequência mais cara: `PORTAS_NOVAS=(6380 1025 8025)` alimenta o CT-005 — a 6380 tem espelho, 1025 e 8025 são literais soltos.`
- `[T2] DECISÃO DO USUÁRIO: **aceitar P9 como débito e fechar T2.** Débito consolidado na §2 do run-report com gatilho explícito. T4-T7 desbloqueadas.`
- `[T2] TR — anti-gaming: contra base_sha os dois scripts são arquivos NOVOS, diff puramente aditivo, sem teste pré-existente a remover (NO_SUITE_FOUND legítimo). 69 asserções, nenhum skip/only, nenhum return precoce em função-caso, `falhas_totais` só cresce em `falhar`. As 20 ocorrências de `|| true` inspecionadas uma a uma — todas em grep -c/wc -l/limpeza; nenhuma neutraliza asserção.`
- `[T2] TR — riscos residuais: (a) **T4** sobe instâncias efêmeras e precisa de porta FORA de PORTAS_NOVAS — nada nesta task reserva faixa, e uma efêmera em 6380 sequestraria a fila provisionada; fixar a faixa na T4. (b) **T6/T7** vão acrescentar chave ao backend.env — é quando o P10 deixa de ser dormente e deve ser fechado ANTES do merge. (c) **F7** herda o P11 (momento de armar o marcador).`
- `[T2] staged: provisionar-base.sh (1325 linhas), verificar-provisionamento.sh (1388), T2.md, plano-execucao.md. NÃO commitado. HEAD intacto.`
- `[T2] memória lazy deletada. **CONCLUÍDA em 5 tentativas** (limite de 3 estendido duas vezes por decisão do usuário). Gate 1 rejeitou 3x, Gate 2 rejeitou 2x.`
- `[run] rule_candidates: 9 sinais persistidos em _run/rule-candidates.md (qa=6, staff=3, orquestrador=0).`

### Pós-T2 — correções de rastreabilidade de ADR (a pedido do usuário)

- `[run] D5 do run-report RESOLVIDO: T2.md §6 passou a listar a ADR-0006 (decisão concreta + os dois pontos em que alcança a task + path); o Applied in da ADR-0006 ganhou duas entradas de fundacao-stack-nativa (v1) — T2 (guarda recusar_bateria_em_producao + marcador /etc/sysloc/producao) e T4 (materialização: instâncias efêmeras próprias). Reciprocidade Feature→ADR e ADR→Feature fechada nos dois sentidos.`
- `[run] CLAUDE.md corrigido: a linha 41 listava a ADR-0006 entre as mortas com o Frappe. Passou a listá-la ao lado da 0001 entre as que sobrevivem inteiras, e ganhou o critério que separa as duas categorias (o substrato: a 0002 e a 0003 nomeiam primitivas do Frappe; a 0006 não nomeia mecanismo).`
- `[run] ACHADO DE PROCESSO: o CLAUDE.md contradizia o `docs/plano-backend-novo/decisao-e-stack.md` §6.1 (linha 237, "0006 — SOBREVIVE em espírito"), que é o **item 1 da lista de leitura obrigatória definida pelo próprio CLAUDE.md**. Como o CLAUDE.md é carregado automaticamente em toda sessão e o decisao-e-stack.md só sob demanda, a versão ERRADA era a que chegava a todo subagente — foi assim que a divergência sobreviveu sem ser notada. Vale reler a tabela de leitura obrigatória procurando outras divergências do mesmo tipo.`
- `[run] divergência sutil resolvida a favor da leitura do Gate 2: o decisao-e-stack.md diz "sobrevive EM ESPÍRITO", o que sugeriria reescrita; a Decision da ADR não menciona mecanismo algum, logo sobrevive INTEIRA. Registrado "não superseder" no CLAUDE.md.`
- `[run] staged: CLAUDE.md, docs/adr/0006-*.md, tasks/T2.md. NÃO commitado. HEAD segue em 540c6d9.`

### Pós-T2 — `.claude/rules/testing-stack.md` criada (a pedido do usuário)

- `[run] /agent-spec-testing-stack-bootstrap executado em modo BOOTSTRAP (rule ausente). Gravada em .claude/rules/testing-stack.md (147 linhas), matcher `paths` opção A: apps/**, packages/**, deploy/scripts/** + 5 globs das skills de QA. Staged, não commitado.`
- `[run] discovery derivou 4 dos 5 eixos do código: base de execução (.mise.toml, package.json), frameworks por camada (CLAUDE.md + decisao-e-stack.md §4 + os 4 verificadores versionados), comando & convenções (package.json + specs de T4/T5/T6 + precedentes em deploy/scripts/), fronteira de execução real (ADR-0006 + scope §3.6). Só o eixo 5 (política de qualidade) foi ao usuário.`
- `[run] decisões do usuário: cobertura NÃO usada (o gate julga por rastreabilidade CA→CT e qualidade de asserção); prova de falsificação OBRIGATÓRIA para asserção estática; flaky SEM retry, correção imediata; mutação sem ferramenta, método manual preservado.`
- `[run] a rule resolve a causa das 6 sinalizações de `discovery_needed` deste run: registra que `pnpm test` não resolver hoje é ESPERADO até T4 (apps/ e packages/ vazios), não lacuna de stack.`
- `[run] a rule põe em contrato escrito, ANTES de T4 começar, a recomendação carry-forward do Gate 2 de T1: o helper de embedded-postgres deve ignorar process.env.DATABASE_URL POR CONSTRUÇÃO, com a prova positiva descrita (caso que exporta DATABASE_URL para destino impossível e prova que a suíte subiu a efêmera assim mesmo).`
- `[run] a seção de falsificação carrega os TRÊS casos concretos que derrubaram T2, com o padrão nomeado — "provou-se o que era fácil provar (predicado, posição, texto) e deixou-se sem asserção o que era difícil (a combinação que discrimina, e o efeito terminal)".`
