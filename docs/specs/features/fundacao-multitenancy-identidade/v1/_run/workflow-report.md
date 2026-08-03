# Workflow report — fundacao-multitenancy-identidade/v1

> Telemetria de pipeline, append-only. O relatório humano do run é o `_run/run-report.md`.

## Challenge Session — 2026-08-01 (artifact: tech_spec.md)

- Questões processadas: 7 (6 achados técnicos + 1 de classificação de glossário)
- Achados de alta prioridade: 3
  - **Regressão evitada (categoria B — contradição com código real)**: prefixo global `/v1` moveria `/saude` e `/saude/pronto`, consultadas em 16 asserções de `deploy/scripts/instalacao/verificar-fundacao.sh` (inclusive no caso de recuperação após reinício real, CA da F0) e em `apps/api/test/saude.e2e.spec.ts`. Resolvido: exceção explícita de `saude` e do caminho do contrato, registrada em §15.1 e §3.6.
  - **Contradição interna (categoria B)**: §3.3 declarava que `@sysloc/db` não exporta executor cru, mas `drizzleAdapter(db, config)` exige a instância — a autenticação não seria montável. Resolvido: fronteira reescrita para "nada com alcance ao schema `negocio`", com acesso tipado restrito a `identidade` exportado por necessidade verificada.
  - **Erro de migração (categoria B)**: `ALTER ... OWNER TO sysloc_migracao` era redundante (a migração roda como o migrador) e exigiria pertencimento ao papel de destino; além disso o migrador não tinha permissão para criar schema em banco de outro dono. Resolvido: os schemas passam a ser criados pelo provisionamento, com dono `sysloc_migracao`; §7.3 e §3.6 atualizadas.
- Achados de média prioridade: 3
  - `citext` (extensão + tipo customizado no Drizzle, nunca usada no projeto) trocada por texto normalizado para minúsculas na borda; nova linha em §6.1.
  - Guarda global sem critério declarado de rota pública → default fechado com exceções explícitas no controlador e caso de teste que enumera as públicas; §11.1.
  - Ausência de RLS no schema `identidade` não estava declarada como limite → registrada em §11.2, com o alcance transferido explicitamente à autorização da fatia seguinte.
- Conflitos de terminologia resolvidos: 3 (usuário × Usuário Empresa; empresa × tenant; sessão pendente × sessão restrita)
- Termos canonizados: 7 — global (6): Empresa, Sysloc Master, Admin Empresa, Usuário Empresa, senha provisória, vínculo de acesso · feature (1): sessão restrita
- Conflitos spec × ADR: 0 · Inconsistências ADR × ADR: 0
- Candidatos a ADR sinalizados: 1 novo, parcial (guarda global com default fechado — 4/5, falha em C4)
- ADRs sugeridas para criação: 0
- Ajustes inline aplicados no `tech_spec.md`: 9

---

## Execução das tasks — run iniciado 2026-08-01

- `[run] executor resolvido: __default__ (general-purpose) — origem: descoberta interativa sem candidatos; .claude/agents/ contém apenas os 3 agentes reservados aos gates (agent-spec-qa-validator, agent-spec-staff-architecture-review, agent-spec-qa-test-generator). Nenhum especialista de stack disponível.`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] modelo: opus em executor e nos DOIS gates, em todas as tasks — CLAUDE.md proíbe sonnet e haiku sem negociação; a heurística de escalação do SKILL.md fica subordinada a essa regra.`
- `[run] baseline P1 (Protocolo Antirregressão): pnpm test verde — 115 casos (shared 79 · api 20 · worker 16), 8 arquivos de teste.`
- `[run] cleanup idempotente: _run/tmp/ inexistente (nenhuma memória lazy stale). .gitignore já cobre docs/specs/**/_run/tmp/.`
- `[run] resume pós-interrupção: nenhum sinal (0 tasks Em Progresso, 0 memória lazy, 0 diff em paths declarados).`

### Fase 1 — detecção do lote paralelo

- `[Fase 1] prontas: T1, T2 (sem dependências). T3, T4, T5 aguardam T2.`
- `[Fase 1] reconciliação: nenhuma divergência entre a tabela do task_plan.md e a seção 1 dos TN.md (T1: — / — · T2: — / —).`
- `[Fase 1] lote paralelo: T1, T2 — DAG independente (ambas sem dependências, nenhuma ancestral da outra); disjunção de símbolo (T1 consome N/A e cria símbolo interno a log.ts; T2 consome N/A); paths disjuntos (packages/shared + CLAUDE.md × packages/db + pnpm-workspace.yaml); alta contenção não compartilhada — só T2 toca manifesto/barrel (pnpm-workspace.yaml, packages/db/package.json, packages/db/src/index.ts), T1 não toca nenhum. Lote = 2 ≤ MAX_PARALLEL=4.`
- `[Fase 1] guard de recursos de teste: ATIVO — T1 e T2 atravessam fronteira real (T1 filesystem em log.spec.ts; T2 banco efêmero em papel-de-conexao.spec.ts). Executores em paralelo; QAs SERIALIZADOS em ordem de ID (T1 → T2). Motivo: .claude/rules/testing-stack.md declara flaky como defeito sem retry — suíte concorrente no mesmo working tree não vale o risco de queimar tentativa do limite de 3.`
- `[Fase 1] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc` (comum ao lote)
- `[T1] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc`
- `[T2] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc`
- `[T1] executor: opus (declarado no frontmatter)   gates: [qa, tech_review] (declarado)   risk: high`
- `[T2] executor: opus (declarado no frontmatter)   gates: [qa, tech_review] (declarado)   risk: high`
- `[T1] ADRs injetadas no executor: nenhuma (fonte: task §7 — "Nenhuma ADR aplicável a esta task")`
- `[T2] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0006 (fonte: task §7)`
- `[Fase 1] dispatch_parallel: 2 executores em paralelo (T1, T2)`
- `[run] AUTORIZAÇÃO DO USUÁRIO (2026-08-02, meio do run)`: (a) toda pausa por `AskUserQuestion` fica pré-respondida com **a opção recomendada** — o run não para para perguntar; (b) o **limite de 3 tentativas por task está suspenso** neste run, por autorização explícita: pode exceder o quanto for necessário até não haver bloqueio.
- `[Fase 1] executores retornaram: T1 (0 criados, 4 modificados) · T2 (17 criados, 3 modificados). Suíte conferida pelo orquestrador: 146 verdes (shared 108 · api 20 · worker 16 · db 2) contra baseline 115. Zero regressão.`
- `[Fase 1] bloqueio transitório resolvido: a T1 relatou pnpm-workspace.yaml com placeholder ERR_PNPM_IGNORED_BUILDS; era estado intermediário — a T2 fechou a decisão (esbuild: false) depois. Nenhuma ação necessária.`
- `[T1] arquivos tocados NÃO declarados: nenhum.`
- `[T2] arquivos tocados NÃO declarados: packages/db/migracoes/meta/{_journal.json,0000_snapshot.json,0001_snapshot.json} (saída obrigatória do drizzle-kit) e pnpm-lock.yaml (consequência das dependências novas). Ambos levados ao Tech Review como candidatos a scope_deviation.`

### T1 — Gate 1 (QA), tentativa 1: REJEITADO

- problemas: 1 CRITICO (tests), 2 ALTO (architecture, tests), 1 MEDIO (tests), 0 baixos
- `security_flags`: escopo_de_redacao_de_query_nao_resolvido_callbackurl · delimitacao_de_radical_code_sem_asserçao_protetora
- `executou_testes: true` · `escopo: SUITE_COMPLETA` · `tocou_area_critica: true`

**CRIT-001 resolvido pelo orquestrador, não pelo executor.** O QA identificou conflito irredutível de spec e mandou PARAR E ESCALAR (`.claude/rules/nao-regressao.md` §3.3/§4.6). Sob a autorização do usuário ("sempre o recomendado"), assumida a **saída (1) recomendada pelo próprio QA**: `callbackURL` **não** é credencial, e o card do CT-027 é que estava errado.

Evidência que sustenta a decisão (três fontes independentes, todas verificadas):
1. **Contradição interna do card**: a Obs do CT-028, na mesma §6.6, cita `callbackURL=` como o exemplo de URL legítima que um padrão mal delimitado **já mutilou em silêncio** neste mesmo arquivo.
2. **Caso verde preexistente da F0**: `CT-008 — não mutila URL legítima sem credencial` (`packages/shared/test/log.spec.ts:702-723`) exige desde a F0 que `https://app.exemplo.com:8443?callbackURL=x#a@b` atravesse byte a byte idêntico. O QA reproduziu o mutante M3 e mediu: acrescentar `callback` à lista **reprova esse caso verde** — seria regressão R1.
3. **Texto do marcador D25 removido**: o campo `POR QUE NÃO AGORA` tratava `callbackURL=` como diagnóstico a preservar; a citação no `QUANDO FECHA` era descrição do que o `better-auth` trafega, não designação de alvo. O §3/§4 da task delimita por "cujo nome **case** os radicais sensíveis", e `callbackurl` não casa nenhum.

Ação: o orquestrador corrigiu o **card** (T1 §6.2 e §6.6 — Invariant e Resultado esperado), com a razão registrada inline no próprio arquivo. **Nenhuma asserção de teste foi afrouxada e nenhum comportamento mudou** — o que mudou é a spec que continha exigência contraditória com um invariante já provado da F0. Restam ao executor: ALTO-001, ALTO-002 e MED-001.

### T2 — Gate 1 (QA), tentativa 1: REJEITADO

- problemas: 0 CRITICO, 0 ALTO, 3 MEDIO (tests, documentation ×2), 1 BAIXO (tests)
- `security_flags`: **[]** · `red_flags_detectadas`: **[]** · `determinismo_observado: ok`
- `executou_testes: true` · `escopo: SUITE_COMPLETA` · `tocou_area_critica: true`
- QA reproduziu as duas provas de falsificação do executor (**ambas conferem**) e rodou mais duas próprias. Critério 6 verificado objetivamente: `git diff -- packages/shared/test/postgres-efemero.ts` = 0 linhas.
- **Mutantes vivos declarados, não escondidos**: M3 (FK composta) → CT-006/T3 · M5 (política sem `nullif`/`true`) → CT-005/T3 · M6 (`FORCE` só de `acesso_usuario_permissao`) → CT-008/CT-009/T4. Deferidos porque cada um tem CT atribuído adiante **na mesma fatia** — exigi-los na T2 seria mandar a T2 implementar a T4.

### Fase 1 — ciclo de correção 1 (T1 e T2 em paralelo)

- `[Fase 1] guard executor×QA respeitado: ambos os QAs drenados antes de despachar qualquer executor de correção.`
- `[Fase 1] correções em paralelo autorizadas por disjunção de path: T1 → packages/shared/{src,test} · T2 → CLAUDE.md + packages/db/{drizzle.config.ts,test} + card. Sem interseção.`
- `[T1] CLAUDE.md: propriedade atribuída à T1 na tentativa 1 (remoção do D25) e à T2 na correção (linha do D28), serializadas no tempo — a T1 já havia fechado a edição quando a T2 abriu o arquivo.`
- `[T1] attempt_count=1 → executor mantido em opus (CLAUDE.md proíbe sonnet; a regra de auto-escalate sonnet→opus[xhigh] não se aplica).`
- `[T2] attempt_count=1 → idem.`
- `[Fase 1] suíte após as duas correções: 147 verdes (shared 109 · api 20 · worker 16 · db 2). Baseline do run: 115. Zero regressão, contagem só subiu.`

### T1 — Gate 1 (QA), tentativa 2: APROVADO

- 0 críticos, 0 altos, 0 médios, 0 baixos. `security_flags: []` · `red_flags_detectadas: []`
- Anti-gaming confirmado por evidência direta: `git diff <base_sha> -- packages/shared/test/log.spec.ts` = **315 inserções / 0 remoções**. Nenhuma asserção dos 45 casos da F0 tocada. AP-24 descartado sem depender de leitura.
- Contagem de `log.spec.ts`: 45 (base) → 74 (tent. 1) → **75**. O +1 é o companheiro negativo do ALTO-002.
- **ALTO-002 fechado com prova**: o mutante M4 — que na tentativa 1 deixava 74/74 verdes — agora **reprova**. M4b também. Controle limpo (75/75).
- Marcador `DECISÃO FECHADA` reescrito com os 4 campos canônicos e gatilho legítimo (veredito de Gate 1 + decisão do usuário); `REVERTER EXIGE` operacional.
- QA rodou 5 mutantes ao todo e restaurou a árvore conferindo por `sha256sum`.

### T1 — Gate 2 (Tech Review): APROVADO_COM_OBSERVACOES

- `adrs_consultadas`: ADR-0006, ADR-0007 (o julgamento "nenhuma ADR governa `log.ts`" foi **verificado**, não aceito)
- **Pergunta central respondida a favor**: o terceiro eixo é **propriedade da entrada única**, não remendo. Composto por dentro de `mascararCredencial`, que alcança cadeia em qualquer profundidade, `erro.message`, `erro.stack`, a mensagem promovida pelo serializador e `URL.href`. **Nenhuma chamada nova em `apps/api/src/comum/filtro-excecao.ts`** — o ponto que o marcador D25 proibia por nome.
- Padrão extraído e exercitado isoladamente contra 30+ entradas, incluindo os **quatro caminhos por onde o defeito reapareceu na F0**. Fecha: parâmetro repetido, percent-encoding, fragmento, consulta+fragmento, preenchimento base64, JWT, caixa/hífen/sublinhado, e a composição com o eixo de cadeia de conexão. A propriedade estrutural que fecha a classe: **o valor nunca engole o delimitador do par seguinte**.
- **Sem ReDoS**: classes negadas e disjuntas do terminador ⇒ sem retrocesso. Medido linear — 120k caracteres patológicos em 2ms. Custo por linha de log: ~6µs, irrelevante ante a escrita síncrona.
- `contemRadicalSensivel` julgado **coesão legítima**, não acoplamento: recebe a lista por parâmetro e não conhece nenhuma das duas; o que compartilha é a **normalização**, que precisa ser idêntica para os eixos não divergirem. A derivação por espalhamento garante por construção que radical novo entre nos dois lados.
- 2 problemas, ambos **BAIXO** e ambos documentais → §2 do run-report.

### T2 — Gate 1 (QA), tentativa 2: APROVADO

- 0 críticos, 0 altos, 0 médios, 0 baixos. `security_flags: []`
- Os três MÉDIOS fechados e **verificados de forma independente** — o QA reproduziu o experimento do `schemaFilter` em diretório descartável e obteve saída byte a byte idêntica com e sem o campo, confirmando o comentário novo.
- **BAIXO-001 RETIRADO — o QA reconheceu erro próprio.** O executor falsificou a classificação com evidência: esvaziando `ACESSOS_DA_EMPRESA_B`, as duas igualdades exatas **passam** e só o `toBeGreaterThan(lidosPeloDono.length)` reprova. Logo a asserção é falsificável e é a **guarda de conjunto vazio** do eixo "o superusuário enxerga o que o papel da aplicação não enxerga" — irmã da contagem de tabelas do CT-001. Palavras do QA: *"Minha classificação de AP-29 na tentativa 1 estava errada: o gate question do AP-29 pergunta se existe ALGUM estado em que a asserção falha, e existe."* Remover seria remover guarda (§4.3 do protocolo).
- Escopo da correção confirmado objetivamente por `mtime`: `packages/db/src/**` e `migracoes/**` anteriores à rodada de correção — código de produção intocado.
- `packages/shared/test/postgres-efemero.ts`: `git diff` = **0 linhas** (critério 6 do §4 e tech spec §3.7 honrados).

- `[T1] staged: packages/shared/src/log.ts, packages/shared/test/log.spec.ts, CLAUDE.md, docs/specs/features/fundacao-multitenancy-identidade/v1/tasks/T1.md`
- `[T1] NOTA de overlap: o CLAUDE.md carrega mudanças das DUAS tasks (D25 removida pela T1, linha do D28 reescrita pela T2). O stage da T1 leva as duas juntas — overlap real de path, registrado. Sem efeito prático: o usuário commita a fase inteira.`
- `[T1] memória lazy T1.md deletada (cleanup_on_approval).`

### T2 — Gate 2 (Tech Review): APROVADO_COM_OBSERVACOES

- `adrs_consultadas`: ADR-0006, ADR-0008, ADR-0009 — conferidas contra o texto literal do `Decision`, **não por grep**. Nenhuma contradição.
- 3 problemas, todos **BAIXO** → §2 do run-report. Nenhum toca código de produção de forma bloqueante.
- **Os dois pontos que o Gate 1 pediu para o Staff julgar, ambos decididos a favor da implementação**:
  1. `conexaoSuperusuaria` (dois acessórios, não um) — *"arquitetonicamente **correto**, e eu o manteria"*. Com `FORCE` ativo, a conexão de migração **não consegue** demonstrar leitura cross-tenant; sem a cadeia superusuária o CT-002 perderia um eixo. O errado é só o texto do critério 5 (→ P1).
  2. 2 casos para 7 critérios — *"cobertura adequada **porque a §6.5 declara honestamente o que não prova**"*.
- **Segurança verificada a fundo, passou limpo**: o `WeakMap` de `banco-efemero.ts` é módulo-privado e não exportado — nenhuma navegação a partir de `BancoMigrado` alcança cadeia privilegiada. Os `sql.unsafe` de `CREATE ROLE` compõem só nomes constantes e senha `base64url` — sem caractere de escape possível, sem injeção. `USING` e `WITH CHECK` são a mesma expressão, `FOR ALL` cobre os quatro verbos, política sem cláusula `TO` (vale para todo papel). Contexto ausente e vazio ⇒ nulo, não casam nada; **contexto malformado faz o `::uuid` levantar erro — falha fechada**. `sysloc_app` recebe só `USAGE` no schema, os quatro verbos DML e `USAGE` nos enums; sem `CREATE`/`TRUNCATE`/`REFERENCES`; `ALTER DEFAULT PRIVILEGES` fecha a janela das tabelas futuras.
- **Antirregressão**: o Staff investigou a remoção da linha do D25 no `CLAUDE.md` como suspeita de regressão e concluiu **falso positivo** — foi a T1, legitimamente. Grep canônico devolve 3 marcadores para 2 débitos indexados: coerente.

#### ⚠️ Riscos herdados que o Staff repassa para a T5 (registrar no escopo dela)
1. Os `GRANT`/`REVOKE` são auto-verificados **por ausência** (sem eles a suíte quebra), mas **um `GRANT` excessivo futuro não seria acusado por nada** — o CT-031 da T5 inspeciona RLS, política, `empresa_id`, unicidade e propriedade, **nunca privilégio concedido**. Sugestão do Staff: acrescentar ao escopo da **T5**, não da T2.
2. O `package.json` só expõe `gerar-migracao` (`generate`, offline). Se alguém acrescentar `drizzle-kit push`, ele introspectaria o banco, veria as políticas do `0001` ausentes do schema declarado e **proporia `DROP POLICY`**. Vale a **T5** barrar isso no `verificar-migracao.sh`.

- `[T2] staged: packages/db/** (18 arquivos), pnpm-workspace.yaml, pnpm-lock.yaml, docs/.../tasks/T2.md, CLAUDE.md`
- `[T2] memória lazy T2.md deletada (cleanup_on_approval).`
- `[Fase 1] T1 e T2 CONCLUÍDAS. Prontas agora: T3 (dep T2), T4 (dep T2), T5 (dep T2).`

### Fase 1 — T3 (sequencial)

- `[T3] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc` (HEAD não moveu — o pipeline não commita)
- `[T3] DECISÃO DE BASELINE DO DIFF`: T1 e T2 estão **staged** (o stage não move o HEAD), e a T3 **modifica `packages/db/src/index.ts`, criado pela T2**. Um `git diff <base_sha> -- index.ts` devolveria o arquivo inteiro como novo, misturando as duas tasks. Por isso os gates da T3 usam **`git diff` sem sha** (árvore de trabalho × índice), que isola exatamente o que a T3 mudou sobre o estado já aprovado. Para arquivos novos da T3, `git add -N` antes.
- `[T3] executor: opus (declarado no frontmatter)   gates: [qa, tech_review] (declarado)   risk: high   tipo: padrao_novo em área security`
- `[T3] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0006 (fonte: task §7)`
- `[T3] sequencial por guard de alta contenção: colide com T4 em packages/db/src/index.ts (barrel). Confirmado — não entra em lote.`

### T3 — Gate 1 (QA) tentativa 2: APROVADO_COM_OBSERVACOES · Gate 2 (Tech Review) rodada 2: APROVADO_COM_OBSERVACOES

- **Rodada 1**: QA `APROVADO_COM_OBSERVACOES` (2 baixos) → Tech Review **`PARCIAL`** (5 MÉDIOS + 2 BAIXOS). `requires_qa_revalidation = true` (categorias `security`, `architecture`, `testability`; overrides `tocou_area_critica` e `task_risk: high`).
- **Rodada 2**: os 5 bloqueantes fechados **na topologia, não na ocorrência** (palavras do Staff). O QA reproduziu os 5 mutantes — todos mortos — e o Staff confirmou. `adrs_consultadas`: ADR-0008, ADR-0009.
- Achados fortes do Gate 2 que o Gate 1 não alcançava, e que valeram a rodada:
  - **P1** — contexto ausente **não emitia fixação alguma**; a garantia dependia de propriedade externa ao módulo. Um `SET` sem `LOCAL` deixado por qualquer `trabalho` de qualquer fatia futura converteria "sem contexto" em **leitura de outro tenant**, sem erro e sem que a suíte acusasse. Fechado: fixação emitida em **todos** os caminhos.
  - **P2** — `emUnidadeDeTrabalho` aninhada abria **segunda transação independente** (o `COMMIT` interno sobrevive ao `ROLLBACK` externo). Fechado com `ErroDeUnidadeAninhada`, recusando **antes de reservar conexão**.
  - **P3** — o escritor do contexto era público e irrestrito: `contextoDeTenant.executarCom({ empresaId: pedido.headers['x-empresa'] })` derrubaria o **invariante 2 do `CLAUDE.md`** sem quebrar compilação. Fechado pelo **CT-014**, que hoje afirma `CHAMADORES_LEGITIMOS = []`.
  - **P5** — o detector do CT-005 **reprovaria a implementação correta da T6/T9** (`perfil === 'SYSLOC_MASTER' ? null : …`). Estreitado **com o par completo de falsificação**, e o QA verificou que **não é AP-24**.
- 5 baixos novos do Gate 2 (P8–P12) + 2 do Gate 1 → §2 do run-report.
- `[T3] .gitignore: acrescentada a linha packages/db/*-falsificad*.mjs (P12) — artefatos efêmeros das falsificações do CT-012 ficam inalcançáveis por git add acidental.`
- `[T3] staged: packages/db/**, docs/.../tasks/T3.md` · `[T3] memória lazy deletada.`

#### ⚠️ Recado executável para o Gate 2 da T9
`CHAMADORES_LEGITIMOS = []` (`packages/db/test/unidade-de-trabalho.spec.ts:380`) **vai reprovar** no instante em que a guarda da T9 chamar `executarCom`. O modo de falha a vigiar é o **oposto**: a T9 satisfazer o CT-014 **esvaziando a asserção** em vez de acrescentar o caminho da guarda — isso é regressão de prova (R2).

### Fase 1 — lote paralelo T4 ‖ T5

- `[Fase 1] lote paralelo: T4, T5 — ambas dependem só da T2 (concluída), nenhuma da outra; símbolos disjuntos (T4 cria verificarCoberturaDeIsolamento; T5 consome as migrações como ARQUIVO, não como símbolo); paths disjuntos (packages/db × deploy/scripts + .env.example); alta contenção **não compartilhada** — só a T4 toca o barrel packages/db/src/index.ts. Lote = 2 ≤ MAX_PARALLEL=4.`
- `[Fase 1] guard de recursos de teste: NÃO dispara. A T4 é a única com suíte Vitest; a T5 é frente shell e os verificadores dela exigem sudo interativo, que nenhum subagente executa. Sem concorrência de banco efêmero — QAs podem correr em paralelo. Prova registrada.`
- `[T4] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   ADRs injetadas: ADR-0009, ADR-0008`
- `[T5] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   ADRs injetadas: ADR-0005, ADR-0008, ADR-0009, ADR-0006`
- `[T4] INCONSISTÊNCIA DO CARD detectada pelo orquestrador: o §3 e o §4 nomeiam o motivo SEM_UNICA_COMPOSTA; o Resultado esperado do CT-009 (§6.6) diz SEM_CHAVE_COMPOSTA. Repassada ao executor com recomendação (SEM_UNICA_COMPOSTA, que aparece nas duas seções normativas) e instrução de alinhar o card no mesmo commit.`
- `[T5] riscos herdados do Gate 2 da T2 repassados ao executor: (1) GRANT excessivo não é acusado por nada — acrescentar eixo de privilégio concedido ao verificar-migracao.sh; (2) drizzle-kit push proporia DROP POLICY — barrar no verificador.`

### T4 — CONCLUÍDA (Gate 1: 3 rodadas · Gate 2: 2 rodadas)

- Gate 1 tent.1 REJEITADO (1 MÉD) → tent.2 APROVADO → Gate 2 rodada 1 **PARCIAL** (1 MÉD `architecture` + 2 BAIXOS) → tent.3 Gate 1 APROVADO → **Gate 2 rodada 2 APROVADO_COM_OBSERVACOES** (2 BAIXOS).
- `adrs_consultadas`: ADR-0009, ADR-0008, ADR-0006.
- **O achado que valeu as rodadas**: `relkind IN ('r','p')` aprovava em silêncio **visão materializada** em `negocio` — objeto que **armazena fisicamente** as linhas e sobre o qual o PostgreSQL **não suporta RLS**. A ADR-0009 promete que *"não há terceiro estado"*; era o terceiro estado.
- **O executor foi além da correção sugerida e o Staff endossou**: em vez de acrescentar `'m'`/`'f'` à inclusão, **inverteu a forma** — conjunto por **exclusão** e a precondição virou a **entrada 0 de `PROPRIEDADES`**. Palavras do Staff: *"a enumeração não sumiu, **mudou de posto**: saiu do filtro de visibilidade, onde esquecer uma espécie significava sumir com o objeto, e virou o predicado de aprovação, onde esquecer significa **reprovar**. O custo do esquecimento passou de silêncio para ruído. É melhor do que a saída que eu havia sugerido, que teria fechado o caminho apontado e deixado a classe aberta."*
- 9 mutantes reproduzidos pelo QA na última rodada, **todos mortos**, incluindo o M-A (o defeito original) e os D1/D2/E (núcleo da ADR-0009).
- `[T4] staged: packages/db/**, docs/.../tasks/T4.md, CLAUDE.md` · `[T4] memória lazy deletada.`

### 🔴 ACHADO DE INFRAESTRUTURA — TOCTOU em `reservarPorta()` (fora de qualquer task)

O Gate 2 da T4 investigou um sinal de instabilidade que o Gate 1 havia levantado (numa de 11 execuções, o CT-007 de `isolamento.spec.ts` reprovou em **~3 s** contra ~12 s do normal, sob um mutante causalmente irrelevante, sem reproduzir em 10 execuções seguintes) e **rejeitou a hipótese de contenção genérica**, oferecendo diagnóstico concreto e verificável:

> `reservarPorta()` (`packages/shared/test/efemero-comum.ts:161-180`) é **TOCTOU**. `portaLivre` (`:131-150`) sonda a porta abrindo e **fechando** o soquete; o PostgreSQL só a amarra **segundos depois**, ao fim de `initialise()`+`start()`. Nessa janela outro worker sonda a mesma porta, encontra-a livre e a escolhe — e uma das instâncias morre com *"address already in use"*, **rápido**, que é exatamente o sintoma. Contenção de CPU produziria falha **lenta**, não rápida. O CT-007 sobe a instância **dentro do corpo do caso**, tarde na execução, quando todos os workers já estão sondando — por isso foi ele. Faixa de 999 portas × ~8-10 instâncias ≈ **1 em 20 por execução**, mesma ordem do 1 em 11 observado. O comentário de `:153-158` **admite a corrida** e a mitiga por sorteio do ponto de partida — reduz a probabilidade, **não elimina**.

**Recomendação do Staff, aplicando literalmente a `.claude/rules/testing-stack.md`** (*"flaky é defeito: para a fila até ser corrigido"*): **parar a fila antes que T5/T6 acrescentem mais spec com instância efêmera** e **particionar a faixa 24001-24999 por identificador de worker** (`VITEST_WORKER_ID`/PID), tornando a colisão **estruturalmente impossível** — não por retry, que é proibido e aqui nem seria o instrumento certo.

`[run] DECISÃO DO ORQUESTRADOR: seguir a recomendação, sob a autorização do usuário ("sempre o recomendado"). A correção entra como intervenção dirigida de infraestrutura de teste ANTES da T6, com prova de falsificação própria. A T4 não é bloqueada por isso — o caso instável não está no diff dela e o arquivo está fora do escopo dela.`

### T5 — CONCLUÍDA (Gate 1: 4 rodadas · Gate 2: 2 rodadas)

- Gate 1 tent.1 REJEITADO (3 ALTOS) → tent.2 APROVADO 7/7 → Gate 2 r1 **PARCIAL** (1 MÉD `security`) → tent.3 Gate 1 REJEITADO (1 ALTO novo) → tent.4 Gate 1 APROVADO → **Gate 2 r2 APROVADO_COM_OBSERVACOES** (2 BAIXOS).
- `adrs_consultadas`: ADR-0005, ADR-0006, ADR-0008, ADR-0009.
- **Quatro achados que só apareceram por rodada**, e todos da mesma família (asserção que não pode falhar pelo defeito que persegue):
  1. **`strace` sem `-s`** truncando a cadeia em 32 caracteres — a credencial tem exatamente 32 e o prefixo `postgresql://sysloc_migracao:` tem 29, então **o vazamento acontecia e a varredura devolvia 0**. Medido pelo QA com o strace real.
  2. **A guarda de recusa em produção sem nenhuma asserção de que aborta** — o terceiro defeito catalogado na `testing-stack.md`, *verbatim*, numa bateria que executa `DROP DATABASE ... WITH (FORCE)`.
  3. **A asserção de cirurgia do mutante comparando `sha256(f(x))` com o arquivo produzido por `f(x)`** — auto-referência sobre `sed` determinístico, **dentro do bloco cuja razão de existir era ser a prova de falsificação do bloqueante de segurança**.
  4. **`ALTER DEFAULT PRIVILEGES` reabrindo a classe do bloqueante por outro caminho** — a tabela de registro **nascia** com os quatro verbos.
- **O bloqueante de segurança e sua topologia**: o Staff confirmou o fechamento e retirou a própria caracterização da rodada 1 — *"a caracterização 'propriedade instalada por ponto' NÃO se aplica ao estado atual. Ali havia UM ponto de retirada para DOIS de concessão, e o único existia fora de qualquer transação. Hoje há paridade 1:1 em transação."* Ele **enumerou exaustivamente** os caminhos e **não encontrou terceiro**. Registrou ainda um efeito colateral positivo não declarado: com o `REVOKE` dentro do `psql -c` da criação, um banco em que `sysloc_app` tenha sido dropado **falha antes de aplicar qualquer arquivo, com rollback limpo**.
- **Sobre "dois pontos não é o mesmo que instalada por ponto"**: *"a propriedade sob prova é ATOMICIDADE entre concessão e retirada, e atomicidade não se centraliza — ela se **pareia**. Um despachante único é estruturalmente impossível: as duas concessões acontecem em transações necessariamente distintas. Qualquer terceiro lugar único voltaria a ser compensação, que é o defeito original."*
- `[T5] staged: deploy/**, .env.example, .gitignore, docs/.../tasks/T5.md` · `[T5] memória lazy deletada.`

#### Riscos herdados que o Staff registrou na T5
- **A entrada única genuína está fora desta task**: `0001_seguranca.sql:97` e `:107-110` concedem **por varredura** (`ON ALL TABLES IN SCHEMA` + `ALTER DEFAULT PRIVILEGES` por schema) em vez de por enumeração. *"Enquanto essa forma existir, toda tabela futura criada por `sysloc_migracao` em `identidade` que NÃO seja dado de aplicação — outro livro-razão, tabela de auditoria, outbox — nascerá com os quatro verbos, e a defesa terá de ser escrita ad hoc por tabela."* Hoje há exatamente uma nessa condição e ela está coberta; **a classe fica aberta**. É design herdado da T2 (aprovada), **pré-condição da primeira fatia que acrescentar tabela não-de-negócio a `identidade`**.
- **F7**: acrescentar ao runbook que `migrar-banco.sh` **aborta** num banco cujo registro de migração esteja vazio mas cujo schema já exista (restauração parcial) — comportamento correto e deliberado, agora asserção viva em (h-bis), *"mas quem restaurar cópia de segurança sob pressão precisa saber que o livro-razão faz parte do que se restaura"*.

### ✅ FASE 1 CONCLUÍDA — T1, T2, T3, T4, T5

Suíte: **169 verdes** (baseline do run: 115). Zero regressão em todas as 5 tasks.
Próximo: **intervenção dirigida no TOCTOU de `reservarPorta()`** (decisão registrada acima), depois a Fase 2 (T6 → T7).

### Intervenção dirigida — TOCTOU de `reservarPorta()` (fora do pipeline SDD)

**Concluída.** Suíte **171 verdes** (era 169), `packages/shared/test/postgres-efemero.ts` com `git diff` **vazio** (somente-leitura preservado).

- **O executor confirmou o diagnóstico do Gate 2 e o REFINOU num ponto decisivo**: a partição por `VITEST_WORKER_ID` que o Staff recomendou **não fecharia a classe** — `turbo run test` roda os 4 pacotes em paralelo, cada um com seu processo Vitest numerando trabalhadores **a partir de 1**, então dois "worker 1" concorrentes cairiam na mesma sub-faixa. *"Nenhum esquema de hash/partição dá exclusão entre processos que não se conhecem; só um árbitro atômico dá."*
- **Correção**: a porta passa a ser reservada por **trava no núcleo** — um nome por porta no espaço abstrato de soquetes de domínio Unix (`\0sysloc-porta-efemera-<porta>`). Amarrar o nome é **atômico e vale para a máquina inteira**; o segundo pretendente recebe `EADDRINUSE` **sem janela alguma**. A trava é tomada **antes** da sonda e mantida enquanto o processo viver — o núcleo a recolhe na morte do processo, então não há estado velho nem limpeza. Falha da trava por motivo diferente de `EADDRINUSE` **estoura** em vez de degradar em silêncio.
- **A corrida foi demonstrada no código antigo, duas vezes**: (a) a **própria baseline P1 do executor reprovou** — `CT-001 … porta 24381: could not bind IPv4 address "127.0.0.1": Address already in use`; (b) exercício dirigido com o sorteio intacto (8 processos × 5 reservas) repetiu porta em **4 de 6 rodadas**. Com a correção: **6/6 rodadas, 40 reservas distintas**. E a falsificação sobre o arquivo real: defeito reintroduzido → `CT-101` reprova com `[24001, 24002]`; restaurado e conferido byte a byte.
- **Prova versionada**: `packages/shared/test/reserva-de-porta.spec.ts` (CT-101/CT-102) + `cenario-reserva-de-porta.ts` (ator em subprocesso). Não é prova executada e descartada — a próxima fatia não reintroduz a corrida sem ficar vermelha.
- O sorteio do ponto de partida **permanece**, rebaixado de mitigação a otimização de varredura, com o comentário reescrito para **não mentir sobre o seu papel**. `DECISÃO FECHADA` em `efemero-comum.ts:223`, gatilho legítimo (veredito de gate), com `REVERTER EXIGE` nomeando **o que não satisfaz**: faixa maior, sorteio melhor, partição por trabalhador e nova tentativa.
- 5 execuções completas da suíte, todas verdes, sem processo órfão nem diretório residual.

`[run] Observação escalada pelo executor, NÃO resolvida (exige editar arquivo somente-leitura)`: durante `initialise()`, `pidAtual` ainda é 0, então o gancho de encerramento remove o diretório mas **não mata o `initdb` em curso`. O próprio `postgres-efemero.ts:117` já registra que o CT-004 cobre término **depois** da subida, não **durante**. → §2 do run-report.

---

## FASE 2 (continuação) — T7

- `[run] retomada de sessão: T1–T6 concluídas e staged; HEAD imóvel em 9a22e5e (o pipeline nunca commita). Sem task Em Progresso, sem memória lazy em _run/tmp/, diff staged apenas de tasks concluídas → fluxo de resume pós-interrupção NÃO disparado (instrução explícita do usuário).`
- `[run] baseline P1 do Protocolo Antirregressão: pnpm test --force VERDE, 7/7 tarefas, 202 casos (@sysloc/shared 111 · @sysloc/api 20 · @sysloc/worker 16 · @sysloc/db 27 · @sysloc/auth 28).`
- `[run] executor resolvido: general-purpose com model=opus (não há agente especialista em .claude/agents/; o CLAUDE.md proíbe sonnet/haiku sem negociação — vale também para os dois gates).`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] estratégia de diff desta fase: HEAD imóvel com T1–T6 no índice torna `git diff <base_sha>` inútil para isolar a task. Os gates usam `git diff -- <path>` (árvore × índice), precedido de `git add -N` nos arquivos novos. O `git add` definitivo só no Passo 8.5.`
- `[run] PATH: `export PATH="$HOME/.local/share/mise/shims:$PATH"` injetado no prompt de todo subagente — o pnpm não está no PATH padrão.`
- `[T7] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   critical_path: auth (packages/auth/**) → gates em opus`
- `[T7] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc (registrado para o resume; NÃO usado como base de diff — ver estratégia acima)`
- `[T7] ADRs injetadas no executor: ADR-0009, ADR-0007 (fonte: task §7)`
- `[T7] INCONSISTÊNCIA DO CARD detectada pelo orquestrador: a §5.1 declara UM arquivo de teste (packages/auth/test/admissao.spec.ts); a Obs do CT-026 (§6.6) propõe DOIS OUTROS (packages/auth/test/superficie-publica.spec.ts e apps/api/test/autenticacao.e2e.spec.ts). Verificado no terreno: apps/api NÃO tem nenhum wiring de auth — `grep -rn "sysloc/auth" apps/api` devolve vazio, e o AutenticacaoModule nasce só na T8. Criar apps/api/test/autenticacao.e2e.spec.ts exigiria montar o módulo, que é escopo da T8. Recomendação repassada ao executor: manter os dois eixos dentro de packages/auth/test/admissao.spec.ts, subindo servidor HTTP real sobre `autenticacao.handler` DENTRO do arquivo de teste — fronteira real sem invadir a T8.`
- `[T7] pendência herdada repassada ao executor como CONTEXTO, não como escopo: P-T6-1 (T8.md §7) — a T7 é quem passa a gravar ACESSO_RECUSADO para pessoa desativada e empresa suspensa, o volume normal da coluna. O enum e a migração 0003 estão FORA da §5 da T7; o dono é a T8.`

### T7 — rodadas dos gates

- `[T7] Gate 1 rodada 1: REJEITADO (1 CRÍTICO tests + 1 BAIXO). CRIT-001: a prova de indistinguibilidade (RN-10) era tautológica por dependência de ordem — o primeiro caso do describe desativava PESSOA_ADMITIDA e nunca restaurava, então a "referência do arcabouço" do terceiro caso era a recusa da própria barreira. Provado por mutante que SOBREVIVEU à suíte inteira.`
- `[T7] correção rodada 1: o executor encontrou uma SEGUNDA via da mesma causa que o gate não nomeou — o /change-password do primeiro caso persiste a senha nova antes de a barreira recusar (updateAccount precede createSession). O sujeito estava corrompido em duas dimensões, não uma.`
- `[T7] Gate 1 rodada 2: APROVADO_COM_OBSERVACOES (6/6 critérios, 217 casos, 1 BAIXO). O QA reproduziu o mutante E testou a PROPRIEDADE da correção com arranjo hostil numa dimensão não restaurada — o caso reprovou alto e no ponto certo em vez de degradar. security_flags: credencial_persistida_apesar_da_recusa_de_sessao.`
- `[T7] Gate 2 rodada 1: PARCIAL (1 MÉDIO project_pattern + 1 BAIXO error_handling). adrs_consultadas: ADR-0006, ADR-0007, ADR-0008, ADR-0009.`
- `[T7] TR consultou: ADR-0006, ADR-0007, ADR-0008, ADR-0009`
- `[T7] o Staff verificou a topologia NO PACOTE INSTALADO, não na alegação do executor: createSession → createWithHooks → hooks.session.create.before, e a varredura do dist/ inteiro por escrita direta com model:"session" fora desse caminho deu ZERO. A obrigação de prova da decisão D6 está satisfeita.`

### T7 — retry classification (Gate 2, rodada 1)

- attempt: 2
- problemas_por_categoria: `{ project_pattern: 1 (MEDIO), error_handling: 1 (BAIXO) }`
- overrides_ativos: `[tocou_area_critica: true, task_risk: high, qa_security_flags: ["credencial_persistida_apesar_da_recusa_de_sessao"], diff_stat_changed: n/a]`
- requires_qa_revalidation: **true**
- decisao: **re-QA (escopado) antes do Gate 2**
- justificativa: "o único bloqueante (P1) está em `project_pattern`, que é `code_review_only` — mas três overrides estão ativos, e qualquer um força `true`. A rule é conservadora por desenho em área crítica."

- `[T7] ⚠️ CORREÇÃO DO ORQUESTRADOR SOBRE O TECH REVIEW: o Staff sugeriu numerar o débito novo como D8 · F1/T7, raciocinando que "o próximo livre após o D7 é o D8" — ele viu apenas os débitos COM MARCADOR (D6, D7). A §2 do run-report desta fatia vai até D20; o próximo livre é D21. É o mesmo erro que a §4 do run-report já registra como cometido e corrigido nesta fatia. Repassado ao executor como D21 · F1/T7.`

### T7 — CONCLUÍDA (Gate 1: 3 rodadas · Gate 2: 2 rodadas)

- Gate 1 r1 **REJEITADO** (1 CRÍTICO `tests`) → correção → Gate 1 r2 **APROVADO_COM_OBSERVACOES** (6/6, 1 BAIXO) → Gate 2 r1 **PARCIAL** (1 MÉDIO `project_pattern` + 1 BAIXO `error_handling`) → correção só de comentário e índice → Gate 1 r3 **APROVADO** (escopado) → **Gate 2 r2 APROVADO_COM_OBSERVACOES** (2 BAIXOS, ambos em artefato do orquestrador).
- `adrs_consultadas`: r1 ADR-0006/0007/0008/0009 · r2 ADR-0008/0009.
- **O achado que valeu as rodadas**: a prova de indistinguibilidade (RN-10) era **tautológica por dependência de ordem** — o primeiro caso do `describe` desativava `PESSOA_ADMITIDA` e nunca restaurava, e o terceiro comparava a constante consigo mesma. O mutante `message: 'Credenciais invalidas'` **sobrevivia à suíte inteira**. É a família de defeito que a `testing-stack.md` cataloga: *"provou-se o que era fácil provar e deixou-se sem asserção o que era difícil"* — aqui o difícil era a **procedência** da referência, não a asserção.
- **O executor refinou o diagnóstico do gate**: a causa tinha **duas** vias, não uma. Além do `ativo: false`, o `/change-password` do primeiro caso **persiste a senha nova antes de a barreira recusar** (`updateAccount` precede `createSession`, sem transação). O sujeito estava corrompido em duas dimensões.
- **O QA não se contentou em conferir a correção — testou a PROPRIEDADE dela**: injetou um arranjo hostil numa terceira dimensão que o caso **não** restaura (bloqueio por cinco falhas) e verificou que o caso **reprova alto e no ponto certo** (`expected 401 to be 200`) em vez de degradar em silêncio. É a diferença entre fechar o caminho e fechar a classe.
- **Os dois gates verificaram no PACOTE INSTALADO, não na alegação do executor**: `createSession` → `createWithHooks` → `hooks.session.create.before`, com varredura do `dist/` inteiro por escrita direta com `model: "session"` fora desse caminho devolvendo **zero**. A obrigação de prova da decisão D6 do tech-alignment está satisfeita.
- **Prova byte-a-byte da rodada de comentário**: o QA usou o `dist/` que o cache do Turborepo preservava do estado aprovado na r2 e, como o `tsc` deste projeto não remove comentários, comparou o emitido — 2 blocos acrescentados, 100% linhas `//`, zero removidas, zero alteradas, e os outros 6 módulos byte-idênticos.
- **Um erro de gate corrigido pelo orquestrador**: o Staff sugeriu numerar o débito novo como `D8`, por sucessão sobre os débitos **com marcador** (D6, D7). O universo é a §2 do run-report, que ia até **D20** — o número certo é `D21`. O gate registrou e aceitou a correção. Mesma classe do erro que a §4 já registra como cometido antes nesta fatia.
- Suíte final: **217 verdes**, contagem idêntica à baseline da task. `pnpm lint` limpo, `pnpm build` verde.
- `[T7] staged: packages/auth/src/{admissao,autenticacao,index}.ts, packages/auth/test/admissao.spec.ts, CLAUDE.md, docs/.../tasks/T7.md` · `[T7] memória lazy deletada.`
- `[run] rule_candidates: 3 sinais persistidos (qa=3, staff=0, orquestrador=0) — 2 do Gate 1 da T7, 1 já deduplicado.`

---

## FASE 3 — T8

- `[T8] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   critical_path: auth + api_contracts → gates em opus`
- `[T8] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc (HEAD segue imóvel; diff isolado por `git diff -- <path>`)`
- `[T8] ADRs injetadas no executor: ADR-0007, ADR-0008 (fonte: task §7)`

### T8 — três decisões de escopo tomadas pelo orquestrador (nenhuma devolvida ao usuário)

**D-E1 · `GET /v1/sessao` NÃO é da T8, e os CTs dela dependem dessa rota.** Os três CTs da §6 da T8
(CT-018, CT-023, CT-024) asseveram contra `GET /v1/sessao`. Essa rota é da **T9**:
`apps/api/src/autenticacao/sessao.controller.ts` está na **§5.1 da T9**, e a §5 da T8 publica só
`/v1/auth/*`. Criá-la na T8 seria colisão direta com o escopo declarado da T9 — `scope_deviation`
certo no Gate 2, e depois uma segunda criação do mesmo arquivo na T9.
**Decisão**: a T8 exercita a sonda autenticada pela superfície que **ela própria** publica — o
`GET /v1/auth/get-session` do arcabouço, montado sob `/v1/auth` pela própria T8 —, mais consulta ao
banco efêmero para o estado persistido. Isso cobre **integralmente** CA-11 (CT-023) e CA-12
(CT-024). O eixo do **envelope de domínio** (`{ usuarioId, perfil, empresaId, empresaNome,
senhaProvisoria, segundoFatorPendente }`) migra para a T9, que é dona da rota — com dono explícito
registrado na §7 do card da T9, no mesmo formato que o Gate 2 da T6 usou para o P-T6-1/P-T6-2.

**D-E2 · A "leitura de negócio" do CT-018 NÃO existe nesta fatia.** Os passos 4 e 5 do CT-018 pedem
"executar a leitura de negócio disponível". A tabela de rotas da tech spec (§4.1) tem **sete** rotas
— seis sob `/v1/auth` e o `GET /v1/sessao` — e **nenhuma de negócio**. Nenhuma task de T8 a T11 cria
uma. O eixo que ela serviria — *"a sessão GOVERNA o alcance do dado, não apenas o carrega"* — já está
provado **no nível do banco** pela suíte de isolamento da T3 (CT-002 a CT-007, com a aplicação
retirada do caminho) e pela guarda de catálogo da T4.
**Decisão**: não inventar rota de negócio para satisfazer o card. O eixo fica registrado como
pendência da **fatia `autorizacao-e-ciclo-de-acesso`**, que é quem publica as primeiras rotas de
negócio; a prova por HTTP nasce junto com elas. Inventar uma rota aqui seria criar superfície de
produto para satisfazer teste — a forma mais cara da Iron Law #6.

**D-E3 · O `P-T6-1` dispara o gatilho de escopo, e a resposta é NÃO fechá-lo na T8.** O card da T8
declara que fechar o `ACESSO_RECUSADO` sobrecarregado exige `packages/db/src/esquema/identidade.ts`
e uma migração `0003` — **fora da §5 da T8** — e que *"se a decisão for que não cabe aqui, ela
precisa migrar para a task que a comporte"*. Três razões para não ser aqui:
  1. **O argumento da urgência não se sustenta contra o terreno.** O card teme que, depois da T7
     gerar volume, separar exija *"migração sobre dados"*. Mas **não existe dado de produção**: o
     backend que opera é o `/opt/frappe`, e este banco só recebe carga na virada da F7. Até lá a
     mudança de enum é migração sobre banco vazio.
  2. **O blast radius é maior do que o card supõe.** Acrescentar valor ao enum obriga a mexer no
     `DESFECHO_POR_MOTIVO` de `packages/auth/src/autenticacao.ts` — arquivo recém-fechado pela T7,
     com **quatro** `DECISÃO FECHADA` e **dois** `DÉBITO COM GATILHO`.
  3. **A T8 já é o ponto de maior risco de regressão da fatia** (o prefixo global move todas as
     rotas e a exclusão de `saude` sustenta a prova de reinício da F0). Somar migração de schema ao
     diff mais perigoso da fatia é exatamente o *"correção grande é correção com regressão
     embutida"* da §5 do Protocolo Antirregressão.
**Decisão**: dono do `P-T6-1` passa a ser a **task de fechamento da F1**, que já carrega o D6 e o
D16. Registrado como débito na §2 com gatilho concreto — **não fica sem dono**, que é a única coisa
que o card proíbe.

**D-E4 · O `P-T6-2` (limitador de taxa e retenção) segue o mesmo destino, pela mesma razão.** Ele é
declarado *"material a partir desta task, que é justamente quem monta as rotas"* — mas rota montada
não é rota **alcançável**: nada publica esta API na rede antes da virada da F7. Vai para a task de
fechamento da F1, junto do `P-T6-1`.

- `[T8] ARQUIVOS TOCADOS FORA DA §5 detectados pelo orquestrador (Passo 3.4.1) — 7, repassados aos DOIS gates como candidatos a scope_deviation, com a caracterização preliminar do orquestrador (o veredito é do gate, não meu):`
  - `apps/api/src/comum/filtro-excecao.ts` — está na §5.3 (**De Referência**), não na §5.2. **Arrasto provável e legítimo** (Regra 3): o `Record<CodigoErro, string>` deixa de compilar quando o enum ganha valor, e o executor declara ter exportado `MENSAGEM_POR_CODIGO` para evitar segunda cópia da cadeia. **Exportar símbolo novo é a parte que merece escrutínio.**
  - `apps/api/package.json`, `apps/api/tsconfig.json`, `pnpm-lock.yaml` — ligação de workspace para `@sysloc/auth` virar dependência de `apps/api`. Arrasto mecânico; `package.json`/lockfile/`tsconfig` são **arquivos de alta contenção** pela rule de paralelismo.
  - `apps/api/vitest.config.ts` — o executor declara ter posto `BETTER_AUTH_SECRET` aqui **em vez de** no arranjo de `saude.e2e.spec.ts`, para não tocar um arquivo que o card marca como **intocável**. Se procede, é a escolha certa; **é preciso conferir que `saude.e2e.spec.ts` de fato não foi tocado.**
  - `.env.example` e `CLAUDE.md` — índice/documentação. O `CLAUDE.md` é o índice de débito da §3-B (o executor declara ter emitido marcador D28 novo, o **quinto consumidor**).
- `[T8] suíte após o executor: 236 verdes (baseline 217). shared 111→123, api 20→27, sem queda em pacote nenhum.`

### [run] Duas mudanças de política autorizadas pelo usuário no meio da T8 (2026-08-02)

O usuário questionou por que os débitos estão sendo escritos no `CLAUDE.md` e se isso estava custando
rodadas. Medi antes de responder:

- bloco de débitos = **5.794 de 20.607 caracteres do `CLAUDE.md` (28%)**, com linhas de tabela de
  **965, 994 e 1.185 caracteres** — contra a §3-B, que na linha 202 manda o registro ser *"ponteiro
  curto"* e adverte que *"marcador que copia o relatório inteiro apodrece"*. O `CLAUDE.md` entra no
  contexto da sessão principal **e de todo subagente**, em toda task: cada parágrafo ali é imposto
  permanente.
- **Numeração não custou rodada nesta sessão** — os dois erros foram dos gates (Staff sugeriu `D8` em
  vez de `D21` na T7; depois afirmou que o D21 não tinha linha no `CLAUDE.md`, e tinha) e os dois
  foram corrigidos por mim **antes** de despachar. Custo: verificação, não rodada.
- **O que custou rodada foi escrituração como bloqueante**: das 5 reprovações do Gate 2 da T8, **duas
  eram registro** (marcador do D21 vencido, pendência em prosa em vez de marcador) — metade de uma
  rodada de correção gasta em contabilidade.

**Decisões do usuário:**

1. **Comprimir a tabela do `CLAUDE.md` para ponteiros de uma linha**, com o detalhe só na §2 do
   `run-report.md`. É **cumprimento** da §3-B, não mudança de regra. **Aplicada no fechamento da
   T8** — não durante, para o Gate 2 não ler um índice diferente do que o executor acabou de escrever.
2. **Escrituração de débito passa a ser reportada como `BAIXO` pelos gates**, para ser anotada em vez
   de disparar rodada de correção. Vale mesmo quando o débito subjacente é de segurança — o que se
   classifica é o **registro**, não o defeito; se o defeito em si é bloqueante por mérito próprio,
   entra como achado separado com a severidade que merece. **Aplicada a partir do Gate 2 rodada 2 da
   T8.** Persistida em memória para valer nas sessões seguintes.

### T8 — CONCLUÍDA (Gate 1: 3 rodadas · Gate 2: 2 rodadas)

- Gate 1 r1 **REJEITADO** (1 MÉD `dead_code`) → correção → Gate 1 r2 **APROVADO_COM_OBSERVACOES** (8/8) → Gate 2 r1 **PARCIAL** (2 ALTOS `security` + 3 MÉDIOS) → correção → Gate 1 r3 **APROVADO_COM_OBSERVACOES** → **Gate 2 r2 APROVADO_COM_OBSERVACOES** (4 BAIXOS).
- `adrs_consultadas`: r1 ADR-0005/0006/0007/0008/0009 · r2 ADR-0006/0007.
- Suíte final: **241 verdes** (baseline da task: 217). `lint` limpo, `build` 5/5.
- **O achado que valeu as rodadas — e a suíte não podia pegá-lo por construção**: o limitador de taxa nativo do arcabouço sobe **sozinho em produção** (`enabled: options.rateLimit?.enabled ?? isProduction`) e emite `429`; o filtro derivava `CODIGO_POR_STATUS[status] ?? ERRO_INTERNO` sobre uma tabela de quatro entradas, então **toda recusa de cliente com status fora da tabela virava `500 ERRO_INTERNO`** e era registrada em `logger.error` como *"falha do serviço"* — **o journal afirmando falha do servidor no exato momento em que o limitador dispara, isto é, durante um ataque**. O e2e roda com `NODE_ENV='test'`, onde o limitador está desligado: nenhum caso poderia tê-lo pego.
- **A correção atacou a topologia, não a ocorrência**: classificação **por faixa** (`[400,500)` = recusa com status de origem preservado; `>=500` = falha do serviço), o `?? ERRO_INTERNO` removido, e `CODIGO_POR_STATUS` rebaixada de via única a via do status *nomeado*. Palavras do Staff: *"não existe status de recusa fora de `[400,500)`, então nenhum status futuro do arcabouço tem para onde cair"*. `DECISÃO FECHADA — T8 / Gate 2 (P1)` registrada, com `REVERTER EXIGE` que o Staff julgou *"verificável e caro na medida certa"*.
- **O Staff mediu o que ninguém tinha medido**: o curinga `@All('*')` publica **~30 rotas** onde a §4.1 declara seis, e a §11.1 da tech spec **já exigia** um caso que enumerasse a superfície efetiva. Decidi implementar o inventário **na T8** (o Staff sugeriu delegar à T9) — a task que **cria** a exposição é a que deve inventariá-la, e o padrão já estava pronto no CT-018 (b). Resultado: 40 pares `MÉTODO /caminho` obtidos do registro de pontas da instância, com falsificação reproduzida pelo QA **mutando o produtor**, não a constante do teste.
- **O QA reproduziu as duas falsificações por conta própria**, restaurando por `md5sum` conferido — não aceitou nenhuma de relato.
- **Um erro de gate corrigido**: o Staff afirmou que o D21 não tinha linha no `CLAUDE.md` (*"ela lista D28, D32, D6 e D7 — 'Quatro débitos'"*). Falso: eu a escrevera no fechamento da T7, e a prosa já dizia "Cinco". Provavelmente leu o índice em vez da árvore. **O núcleo do achado procedia** — o texto do marcador afirmava alcançabilidade zero e a T8 acabara de montar `/change-password`.
- `[T8] staged: apps/api/**, packages/{shared,auth}/**, CLAUDE.md, .env.example, pnpm-lock.yaml, docs/.../tasks/T8.md` · `[T8] memória lazy deletada.`
- `[run] flake pré-existente encontrado pelo QA, FORA do escopo da T8: apps/worker/test/eco.spec.ts > CT-005 reprovou numa execução da suíte completa e passou isolado e nas duas seguintes. git diff -- apps/worker/ VAZIO. O caso é da F0/T6 e o próprio arquivo admite que "o travamento acontece em cerca de metade das execuções"; sob a concorrência do Turbo o timing muda e o caso reprova por NÃO observar o defeito que existe para cortar. → §4 do run-report, com dono.`

---

## FASE 3 — T9

- `[T9] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   critical_path: security/auth → gates em opus`
- `[T9] base_sha=9a22e5e61cab9376697d3299d4dff6a4d05cbadc (HEAD imóvel; diff por `git diff -- <path>`)`
- `[T9] ADRs injetadas no executor: ADR-0008, ADR-0007, ADR-0009 (fonte: task §7)`
- `[T9] política de severidade nova aplicada nos dois gates desde o primeiro despacho: escrituração de débito é BAIXO.`

### T9 — quatro decisões de escopo do orquestrador

**D-E5 · A "leitura de negócio" do CT-020 continua não existindo** — mesma causa da D-E2 da T8: a §4.1 tem sete rotas e nenhuma de negócio, e nenhuma task de T9 a T11 cria uma. O passo *"consultar cada rota de leitura de negócio"* e o `Resultado esperado` *"`200` com corpo `[]` em todas"* são **inexequíveis nesta fatia**.
**Decisão**: o CT-020 prova o que **é** observável aqui — o contexto do Master publicado **sem empresa**, e `GET /v1/sessao` do Master devolvendo `empresaId: null` e `empresaNome: null`, contra a sessão de um Admin de empresa que devolve os dois preenchidos. O eixo *"todo dado de negócio vem vazio para o Master"* **já está provado no nível do banco** pela suíte de isolamento da T3 (o CT-005 exercita exatamente essa política, com a aplicação fora do caminho) e migra por HTTP para a fatia `autorizacao-e-ciclo-de-acesso`, junto com as primeiras rotas de negócio. **Não inventar rota de negócio para servir teste.**

**D-E6 · O envelope de domínio que saiu da T8 ATERRISSA aqui.** A decisão D-E1 da T8 migrou para a T9 o eixo do `GET /v1/sessao` — `{ usuarioId, nome, email, perfil, empresaId, empresaNome, senhaProvisoria, segundoFatorPendente }`, exatamente essas chaves, em camelCase. A T9 é dona da rota (`sessao.controller.ts` está na §5.1 dela), então o eixo é **obrigação desta task**, não opcional.

**D-E7 · O inventário da §11.1 já foi entregue na T8 — o desta task é OUTRO conjunto.** O `CT-018 (d)` da T8 enumera **toda** a superfície sob `/v1/auth` (40 pares). O critério 3 da §4 da T9 pede a lista de **rotas públicas efetivas** — as que a guarda **libera**, que é um subconjunto muito menor e de natureza diferente (exceção de segurança, não superfície de biblioteca). **Os dois são necessários e não se substituem**; o da T9 deve reusar a forma do da T8 (igualdade de conjunto com excedentes e ausentes nomeados) sem duplicar o alvo.

**D-E8 · A §10.1 cobra desta task o que a T8 não podia entregar.** Os dois gates da T8 registraram: a mensagem fixa `'acesso negado para esta sessão'` em `MENSAGEM_POR_CODIGO` é o **default do filtro**, e o **produtor real** de `ACESSO_NEGADO` é a guarda desta task, que levanta `ErroDeAplicacao` com mensagem própria. A §10.1 da tech spec descreve essa mensagem como *"nomeia a exigência pendente"* — **se a guarda não nomear, aí sim há divergência**, e o produtor é o real.

**Nota de ordenação repassada ao executor**: o card manda *"imitar o CT-019 para chegar à sessão plena de Master"*, e o CT-019 é da **T10**. As rotas de segundo fator já estão montadas sob `/v1/auth` desde a T8, então a sessão plena é obtenível pelo caminho real — mas o padrão a imitar ainda não existe.

---

## FASE 3 — T10

- `[T10] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   critical_path: auth → gates em opus`
- `[T10] base_sha=9a22e5e… (HEAD imóvel; diff por `git diff -- <path>`)`
- `[T10] ADRs injetadas no executor: ADR-0007, ADR-0009 (fonte: task §7)`

### T10 — três decisões de escopo do orquestrador

**D-E9 · A semente NÃO cria pessoa com `senha_provisoria = true`.** A "Precondição privilegiada" do CT-021 afirma que *"a carga inicial `packages/db/src/semente.ts` cria a pessoa já com `senha_provisoria = true`"*. **Falso contra o terreno**: `grep -n "senhaProvisoria" packages/db/src/semente.ts` devolve **vazio**, e a coluna tem padrão `false`. Tornar a afirmação verdadeira exigiria editar `packages/db/src/semente.ts`, **fora da §5 da T10** — e é carga **compartilhada por cinco pacotes**, com risco de ondulação em suítes já verdes.
**Decisão**: arranjar o estado **no próprio caso**, pelo padrão **já aprovado nos dois gates nesta fatia** — a T7 faz `await banco.update(usuario).set({ ativo: false })` no arranjo do caso, e ambos os gates trataram isso como **observação/arranjo de estado persistido**, não instrumentação do SUT. É o mesmo tipo de estado de domínio sem rota. **Não** editar `semente.ts`; **não** criar rota, bandeira ou símbolo de produção para "marcar como provisória" (o card proíbe explicitamente, e seria antecipar a fatia 2).

**D-E10 · A "rota de negócio" dos CT-019 e CT-021 continua não existindo** — terceira ocorrência da mesma lacuna (D-E2 na T8, D-E5 na T9). **Decisão**: reusar o padrão que a T9 estabeleceu e os dois gates aprovaram — **controlador-fixture declarado no próprio arquivo de teste**, montado só na aplicação instrumentada, sem `@Param`/`@Query`/`@Body`/`@Headers`, com grep provando que nada dele existe em `apps/api/src`. A T9 chamou o dela de `ControladorDeVinculos` (`contexto.e2e.spec.ts:872`).

**D-E11 · A §10.1 que a T9 adiou é COBRÁVEL AQUI.** Os dois gates da T8 e da T9 registraram: a mensagem de `ACESSO_NEGADO` em `MENSAGEM_POR_CODIGO` é o **default do filtro**, e o **produtor real** é esta task. A §10.1 da tech spec exige que a mensagem *"nomeie a exigência pendente"*, e o §4 da T10 é explícito: *"a mensagem **nomeia a exigência pendente** — recusar sem dizer o que falta deixaria a pessoa presa sem saber por quê"*. **É obrigação desta task**, não opcional.

- `[T10] ⚠️ FALSO POSITIVO DO GATE 1 (rodada 3), falsificado pelo orquestrador com evidência.` O QA emitiu `MED-001` (`code_quality`) alegando que `packages/auth/src/autenticacao.ts` — arquivo **proibido** naquela rodada — foi escrito na janela do executor, com base em (a) mtime `18:09:35`, posterior aos artefatos da rodada 2 e anterior aos da rodada 3, e (b) reemit incremental do `tsc` mantendo o `.d.ts` intocado (*"a assinatura de: o conteúdo mudou; as declarações, não"*). Ele próprio declarou não conseguir eliminar a incerteza sem o snapshot da rodada 2 e classificou como **auditabilidade, não defeito**.
  **O escritor foi o QA DA RODADA 2, e ele mesmo registrou isso**: aquele gate aplicou o mutante do Staff (`if (ctx.path !== '/change-password') return;` no topo de `recusarSenhaNovaFraca`, `:831`) para reproduzir a falsificação do P1, e reportou literalmente *"Restaurei do backup (SHA-256 `16f8f751…` idêntico ao íntegro) e reconfirmei 49/49 verdes"*. A janela `18:09:35` cai **exatamente** entre o executor da rodada 2 (`17:56`) e o da rodada 3 (`18:18`) — que é a janela em que aquele QA rodou. O `tsc` reemitiu por **mtime**, não por conteúdo, e por isso o `.d.ts` ficou intocado.
  **Verificação independente que fiz**: o mutante está **ausente** (`grep "ctx.path !== '/change-password'"` → vazio); o arquivo contém exatamente o que a **rodada 1** entregou (`CAMPO_DA_SENHA_NOVA`, `CAMINHOS_QUE_DEFINEM_SENHA`, `RECUSA_DE_CAMPO_INVALIDO`); e as quatro linhas de prosa sobre "índice"/"vocabulário" que o QA leu como sinal de edição da rodada 3 **citam `RECUSA_DE_CAMPO_INVALIDO`**, símbolo que a **própria rodada 1** declarou ter criado (*"entrou no índice e em `SUPERFICIE_DO_PACOTE`"*).
  **Decisão**: `MED-001` **descartado**, sem ciclo de correção — mandar executor mexer num arquivo íntegro seria criar a regressão que o achado teme. O `BAIXO-001` do mesmo JSON (o inventário do CT-026 é cego a `type` exports) é **procedente** e vai para a §2 como débito. Segue para o Gate 2.
  **Lição para o pipeline**: o QA que aplica mutante em arquivo de outro escopo deve **declarar a restauração no JSON**, para o gate seguinte não ler o mtime como edição indevida. É a terceira vez nesta fatia que um gate erra por ler estado sem o contexto da rodada anterior.

### T10 — CONCLUÍDA (Gate 1: 4 rodadas · Gate 2: 3 rodadas)

- Gate 1 r1 **APROVADO_COM_OBSERVACOES** (6/6) → Gate 2 r1 **PARCIAL** (1 MÉD `security`) → correção → Gate 1 r2 **REJEITADO** (1 MÉD `dead_code`) → correção → Gate 1 r3 **REJEITADO** (achado depois falsificado) → Gate 2 r2 **PARCIAL** (2 MÉD) → correção → Gate 1 r4 **APROVADO** (limpo) → **Gate 2 r3 APROVADO_COM_OBSERVACOES** (1 BAIXO).
- `adrs_consultadas`: ADR-0006, ADR-0007, ADR-0008, ADR-0009.
- Suíte final: **258 verdes** (baseline da task: 246). `lint` limpo, `build` verde.
- **O achado que valeu o ciclo, e a correção que superou o gate.** O Staff reprovou a política de força por estar ligada ao **caminho literal** `/change-password` e não à **classe** *"toda definição de senha"* — *"propriedade instalada por ponto"*, a forma que a §5/§7 da `nao-regressao.md` condenam e que o próprio arquivo rejeita por escrito. Ele sugeriu mover para o `hooks.before` com um conjunto de caminhos. **O executor foi além**: percebeu que o disparo não é o caminho, é o **campo `newPassword`** — *"como o arcabouço declara 'defina esta senha'"* —, o que alcança `setPassword`, que é **`serverOnly` e não tem caminho**. Palavras do Staff: *"a saída escolhida foi MELHOR que a que sugeri… por margem larga"*.
- **E então o Staff achou uma falha ABERTA na barreira recém-instalada**, lendo o manipulador lado a lado com o resolvedor: `??` (nulidade) contra `||` (veracidade). `POST /reset-password?token=<válido>` com corpo `{ token: '' }` fazia o gancho **sair sem validar** e o manipulador **gravar a credencial fraca**. Fechado com helper nomeado **pela regra** e `DECISÃO FECHADA` cujo `REVERTER EXIGE` **proíbe nominalmente aceitar igualdade de ordem como prova**.
- **A âncora era cega à própria classe que protegia** — filtrava por `newPassword`, o mesmo discriminador da política. Alargada para `/password/iu` com partição DEFINIDORES × CONFERIDORES; **o executor achou dois conferidores a mais** do que o Staff enumerou (`getTOTPURI`, `generateBackupCodes`).
- **Um falso positivo do Gate 1 falsificado pelo orquestrador** (ver entrada anterior): o escritor de `autenticacao.ts` na janela suspeita era **o QA da rodada 2**, aplicando e revertendo o próprio mutante.
- **Desvio de processo meu, registrado**: não criei memória lazy em `_run/tmp/T10.md` nas rejeições — passei o contexto completo inline nos prompts de correção. Funcionou, mas contraria o Passo 5 da skill, e um resume pós-interrupção teria ficado sem o arquivo.
- `[T10] staged: apps/api/**, packages/auth/**, docs/.../tasks/T10.md` · `[T10] sem memória lazy a deletar.`

---

## FASE 3 — T11 (última da fatia)

- `[T11] executor: opus (declarado)   gates: [qa, tech_review]   risk: high   critical_path: security → gates em opus`
- `[T11] ADRs injetadas no executor: ADR-0007, ADR-0009 (fonte: task §7)`

### T11 — uma decisão de escopo

**D-E12 · A semente NÃO tem pessoa desativada nem empresa suspensa** — `grep -n "ativo\|suspensaEm" packages/db/src/semente.ts` devolve **vazio**. A "Precondição privilegiada" do CT-017 afirma que *"os dois estados são valores de domínio da semente"*; é **falso contra o terreno**, e é a **terceira** ocorrência do mesmo padrão nesta fatia (a T10 teve a mesma com `senha_provisoria`).
**Decisão**: idêntica à D-E9 da T10 — arranjar o estado **no próprio caso**, pelo padrão que a **T7** estabeleceu e que os dois gates aprovaram (`banco.update(usuario).set({ ativo: false })` no arranjo, tratado como observação/arranjo de estado persistido). **Não** editar `semente.ts` (carga compartilhada por cinco pacotes, risco de ondulação); **não** criar rota, bandeira ou símbolo de produção para desativar pessoa ou suspender empresa — o card proíbe explicitamente e seria antecipar a fatia 2.

> **Observação para o fechamento da fatia**: as três lacunas (D-E9, D-E12 e a `senha_provisoria`) têm a mesma causa — o gerador de casos assumiu que a semente carregaria estados de domínio que ela não carrega. Vale como candidato a regra e como nota de revisão humana.

### T11 — CONCLUÍDA (Gate 1: 1 rodada · Gate 2: 1 rodada) — **a única task da fatia aprovada de primeira nos dois gates**

- Gate 1 **APROVADO** (6/6, zero problemas de qualquer severidade) → **Gate 2 APROVADO_COM_OBSERVACOES** (4 BAIXOS, **nenhum no código entregue**).
- `adrs_consultadas`: ADR-0006, ADR-0007, ADR-0008.
- Suíte final: **260 verdes** (baseline da task: 258). `lint` limpo (103 arquivos), `build` FULL TURBO.
- `packages/auth/src/admissao.ts` **não foi tocado** — a §5.2 só o admitia *"se a prova revelar divergência"*, e a comparação cruzada **passou de primeira**. A T11 entregou **exatamente um arquivo de código**.
- **O achado mais interessante do run inteiro, e o executor o reportou em vez de esconder**: dos dois mutantes, o segundo (mensagem **própria por predicado**) **deixou a suíte VERDE**. Ele **mediu a causa** em vez de supor — o filtro da ADR-0007 monta o corpo com `MENSAGEM_POR_CODIGO` e a exceção de origem viaja **apenas como `causa`** —, escreveu a fronteira no cabeçalho e apontou quem prova a outra metade (`CT-018 (c)` da T8). Os **dois gates** reproduziram e confirmaram. O Staff foi além: *"não é que a mensagem seja descartada por acaso — **não existe caminho** pelo qual ela alcance a resposta"*, porque o controlador **lança** antes de `responderCom`.
- **Um problema de MÉTODO que o QA descobriu e vale para a base inteira** → **D34**: prova de mutante contra `dist/` obsoleto é **falso negativo silencioso**. A primeira execução do mutante 1 passou verde porque `vitest run` avulso não recompila. *"O modo de falha inverte a conclusão."*
- **O Staff usou a última oportunidade barata para o fechamento da F1** → **D35**: a fatia termina na T11 e **três artefatos delegam a uma "task de fechamento" que não existe no plano** (o D6, as seis rotas fora do `/docs`, e o marco de entrega).

### ✅ FATIA CONCLUÍDA — 11/11 tasks

- Suíte: **260 verdes** (baseline do run: **115**). `pnpm build` e `pnpm lint` verdes.
- **Zero regressão em todas as 11 tasks.** Nenhuma task bloqueada. Nenhuma tentativa esgotada (o limite de 3 estava suspenso por autorização do usuário; a T10 usou 4 rodadas de QA e 3 de Tech Review).
- `[run] rule_candidates: 9 sinais persistidos em _run/rule-candidates.md (qa=5, staff=4, orquestrador=0).`
