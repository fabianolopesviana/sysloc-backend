# Workflow report — automacoes-agendadas/v1

> Telemetria de pipeline (append-only). O relatório humano é o `run-report.md`.

## Challenge Session — 2026-08-22 (artifact: tech_spec.md)

- Questões processadas: 8 (todas resolvidas; nenhuma pendente)
- Modo: regra A1 de `.claude/rules/autonomia-do-run.md` — cada questão formulada com recomendação,
  adotada e registrada, sem `AskUserQuestion`
- Conflitos de terminologia resolvidos: 2
  - Q1 resumo da régua: `avisadas`/`recusadas` → reuso de `ResultadoDaRegua`
    (`candidatas`/`enviadas`/`falhas`/`semDestinatario`)
  - Q2 literais inexistentes: `EM_ABERTO` → `A_VENCER`; `LIQUIDADA` → fato gravado + derivação `PAGA`;
    `PROCESSADO` → `APLICADO`
- Contradições com código real corrigidas: 2 (Q2 acima; Q6 convenção `_check` → `_chk`)
- Contradição INTERNA da spec corrigida: 1
  - Q3 CT-1057 comparava 6 unidades systemd contra `CADENCIA_DA_ROTINA`, que o CT-1090 exigia ter 3
    entradas — os dois não podiam passar juntos. Mapa passou a ter 6 entradas com `publicada: boolean`
    e `ROTINAS_PUBLICADAS` virou derivado
- Decisões implícitas explicitadas: 3
  - Q5 conferência agendada usa `solicitadaPor: null` (já previsto pela F4)
  - Q7 despachante reusa `conectarFila`, evitando a 3ª cópia do produtor (Limiar de Três)
  - Q8 `OnFailure=` alcança o despacho, nunca a execução da tarefa
- Edge cases descobertos: 1
  - Q4 imóvel `INDISPONIVEL` + contrato `ATIVO` é estado legítimo; o encerramento o converteria em
    `DISPONIVEL`, apagando decisão do Admin. Nasceu a RD-20 e o CT-1097 (41 casos, era 40)
- Achado CONFIRMADO sem alteração: 1
  - a contagem `105 → 106 / 90 → 91` sobrevive — o `HEAD` derivado do `GET` não entra na medição
- Termos canonizados no glossário: 6
  - global (`docs/specs/domain-glossary.md`): Rotina agendada, Passagem
  - feature (`docs/specs/features/automacoes-agendadas/domain-glossary.md`, CRIADO): Registro de
    execução, Limiar de atraso, Impedimento, Despachante
- Candidatos a ADR sinalizados: 2 parciais (3/5 cada) — liberação condicional RD-20;
  `CADENCIA_DA_ROTINA` como fonte única. Ambos falham C1 e C3
- ADRs sugeridos para criação: 0
- Débito de artefato: `_run/test-cases.json` defasado em Q1, Q2, Q3, Q4 e Q6 — o challenge não o
  escreve por guardrail. Regenerar ou corrigir antes do `task_plan` consumi-lo

### Correção de artefato — 2026-08-22 (pós-challenge, a pedido do usuário)

- `_run/test-cases.json` atualizado com os cinco ajustes do challenge que o alcançavam (Q1, Q2, Q3,
  Q4, Q6). O guardrail da skill impede que ela própria o escreva; a correção foi feita fora dela,
  por pedido explícito.
- Total: 40 → **41** casos (unitário 8 · integração 27 · e2e 3 · segurança 3). `CT-1097` inserido
  junto dos irmãos de encerramento, com `regras_dominio_validadas: ["RD-20"]` e
  `criterios_aceitacao_validados: []` — ele não tem CA de origem, e a ausência é declarada.
- Bloco `challenge` acrescentado ao JSON, enumerando os cinco ajustes.
- Resíduo apanhado na revisão: `execucao_de_rotina_resumo_check` sobrevivera na tabela de referência
  cruzada da §19.4 do tech_spec; corrigido para `_chk`.
- Verificação de concordância: os dois artefatos têm 41 casos e o mesmo conjunto de identificadores;
  nenhum literal inexistente sobrevive fora das seções que DESCREVEM as correções.

---

## Execução das tasks — 2026-08-22

- `[run] executor resolvido: sysloc-backend-implementer (origem: argumento explícito)`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] git verificado; _run/tmp/ coberto pelo .gitignore (linha 45: docs/specs/**/_run/tmp/)`
- `[run] resume pós-interrupção: NÃO se aplica — nenhuma task Em Progresso, nenhum _run/tmp/, working tree sem diff em path de código`
- `[run] guarda de continuidade ARMADA`
- `[run] modelo: TODAS as 11 tasks em opus por decisão do CLAUDE.md (projeto exclusivamente Opus); gates também em opus — onde a regra do framework mandar sonnet, leia opus`
- `[run] reconciliação de dependências: tabela §4 do task_plan == seção 1 das 11 tasks; nenhuma divergência, união desnecessária`

### Fase 1 — lote paralelo

- `[Fase 1] lote paralelo: T1, T2, T3 (DAG independente — as três sem deps + símbolos disjuntos + paths disjuntos)`
- `[Fase 1] guards provados: (1) T1/T2/T3 sem dependência entre si; (2) nenhum consome símbolo criado por outra; (3) packages/contracts/** × packages/shared/** × packages/db/**; (4) alta contenção — três BARRIS DIFERENTES (contracts/index.ts, shared/index.ts) e só T3 toca o ledger de migrações; (5) lote 3 <= MAX_PARALLEL=4`
- `[Fase 1] guard de recursos de teste: NÃO dispara — só T3 tem suíte de integração com instância efêmera (packages/db); T1 e T2 são unitária/estática. QAs podem correr em paralelo`
- `[Fase 1] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da` (comum às três tasks do lote)
- `[T1] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T2] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T3] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T1] ADRs injetadas no executor: ADR-0016, ADR-0017 (fonte: task §7)`
- `[T2] ADRs injetadas no executor: ADR-0024, ADR-0029, ADR-0031, ADR-0035 (fonte: task §7)`
- `[T3] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0014, ADR-0026, ADR-0031 (fonte: task §7)`
- `[Fase 1] dispatch_parallel: 3 executores em paralelo (opus)`
- `[run] entrega do CONTEÚDO DA TASK ao executor: por LEITURA DO ARQUIVO no path canônico, verbatim de disco, em vez de transcrição no prompt. Razão: transcrever ~10 KB por task através do contexto do orquestrador é superfície de paráfrase/truncamento — a leitura de disco é verbatim por construção. A ordem prescrita (disciplina e ADRs ANTES do conteúdo) é preservada: o executor recebe a disciplina e as ADRs no prompt e só então é mandado abrir a task.`

### Fase 1 — executores retornados e o achado cruzado do lote

- `[Fase 1] executores concluídos: T1, T2, T3`
- `[T1] executor_summary: 1 criado, 2 modificados · contracts 425 → 437 · garantias removidas: nenhuma`
- `[T2] executor_summary: 0 criados, 4 modificados · shared 263 → 267 · garantias removidas: nenhuma`
- `[T3] executor_summary: 3 criados, 8 modificados · db 237 → 238 · garantias removidas: nenhuma`

**Decisão auto-resolvida (A1) — a âncora `FILAS_DECLARADAS` do `CT-512 (b)`.**

Pergunta: a T2 publicou `FILA_DA_ROTINA_AGENDADA` e `FILA_DA_MANUTENCAO_DO_ACERVO` em
`packages/shared/src/fila.ts`; a âncora que afirma o conjunto das filas por igualdade vive em
`packages/db/test/cobranca.spec.ts` e ficou **vermelha**. Quem a atualiza, e quando?

Alternativas concorrentes:
- **(a)** a **T2** a atualiza agora, no mesmo diff da publicação, com a linha `SUT_IS_CORRECT_BECAUSE:`
  por fila nova, no molde literal das duas adições anteriores do arquivo (`conferencia-bancaria` pela
  T15, `reconferencia-da-entrega` pela T8 de `integracao-bancaria-autonoma`);
- **(b)** deixar vermelho até a **T11** (a task da rede antirregressão da RN-14);
- **(c)** a **T3** a atualiza, por estar no pacote dela.

**Adotada: (a).** Razão: `.claude/rules/ancoras-de-superficie.md` manda literalmente *"âncora no mesmo
diff da publicação"*, e a Iron Rule #3 declara que arrastar dependente de símbolo publicado **não é
desvio de escopo**. A (b) quebraria a baseline do pacote `db` para **T3, T4, T5 e T10**, envenenando o
P1/P5 de todas elas com um vermelho que não é delas — custo desproporcional. A (c) faria a T3
justificar contra a ADR-0022 uma publicação que não é dela. ⚠️ **A T11 NÃO cobre este arquivo**: a
§5.2 dela declara `derivacao-de-cobranca.spec.ts`, que é outro. A âncora é órfã de declaração, e é
por isso que a decisão precisa ser tomada aqui.

- `[T2] rodada de complemento de escopo despachada ao MESMO executor (contexto intacto) — NÃO conta para o limite de 3 tentativas: não há veredito de gate, e o Gate 1 da T2 ainda não rodou`

### Fase 1 — Gate 1

- `[T1] QA (opus) rodada 1: APROVADO — 9/9 critérios, CT-1090 presente, contracts 425 → 437 (delta +12 explicado), 0 problemas, 0 red flags, security_flags vazio`
- `[T1] antipadroes_verificados: 1/1 arquivo de teste declarado (packages/contracts/test/esquemas.spec.ts) — completo`
- `[T1] ledger: memória lazy NÃO criada (rodada 1 aprovada sem rejeição) — métrica não se aplica`
- `[T1] QA deferiu ao Gate 2, explicitamente e sem virar problema: a Decision da ADR-0017 fixa o envelope de lista {itens,total,limite,deslocamento}, e esta rota publica {rotinas:[...]}. O QA registrou precedente aprovado nos dois gates (esquemaDaTrilhaDaCobranca, CT-953, envelope ['itens']) e a §4.1.1 do tech spec. É análise estrutural de ADR — do Gate 2`
- `[T2] complemento de escopo concluído: packages/db/test/cobranca.spec.ts atualizado com SUT_IS_CORRECT_BECAUSE por fila nova; db 238 com 1 vermelho → 238 VERDES; asserção NÃO afrouxada (igualdade, Object.freeze e as 7 entradas anteriores intactas)`

**Correção factual trazida pelo executor da T2, e ela vale para as tasks seguintes**: o
`AVISO_DE_COBRANCA` **não é ramo** da fila `rotina-agendada`. A união `RotinaDeTrabalho` publicada tem
quatro alternativas — `ENCERRAMENTO_DE_CONTRATOS`, `CONFERENCIA_DE_LIQUIDACAO`,
`VIGILANCIA_DAS_ROTINAS`, `EXPURGO_DO_HISTORICO` — e a §4.3 do tech spec marca o aviso como
`regua-de-cobranca` (*"existente — o produtor é a novidade"*). O complemento que despachei afirmava o
contrário; a medição o refutou, e a nota ficou no docblock para não ser "corrigida" de volta.

**Aviso herdado para a T9**: no mesmo `CT-512 (b)`, a constante `UNIDADES_DECLARADAS` afirma que **não
existe `.timer` algum** no repositório. A T9 cria seis — vai encontrar a âncora vermelha e precisará da
**mesma justificativa de mérito** contra a ADR-0022, no molde que a T2 acabou de estabelecer. Não é
lacuna da T2.

- `[T2] arquivo tocado NÃO declarado: packages/db/test/cobranca.spec.ts — AUTORIZADO pelo orquestrador (decisão A1 acima), não é scope_deviation espontâneo`
- `[T2] arquivo tocado NÃO declarado: packages/shared/test/superficie-publica.spec.ts — decisão A1 do próprio executor; vai ao Gate 2 como candidato a scope_deviation`
- `[T3] arquivos tocados NÃO declarados: packages/db/test/papel-de-conexao.spec.ts, deploy/scripts/instalacao/verificar-migracao.sh, packages/db/migracoes/meta/0026_snapshot.json — vão ao Gate 2 como candidatos a scope_deviation`
- `[Fase 1] guard de recursos de teste REAVALIADO: a T2 passou a tocar packages/db/test/, logo o QA dela roda a suíte do db — DUAS tasks disputam a instância efêmera. QAs de T2 e T3 SERIALIZADOS, em ordem de ID. O Tech Review da T1 não executa suíte e corre em paralelo`

### Fase 1 — Gate 2 da T1 e Gate 1 da T2

- `[T1] Tech Review (opus) rodada 1: PARCIAL — P1 ALTO/adr_compliance (bloqueante), P2 BAIXO/project_pattern (anotável)`
- `[T1] TR consultou: ADR-0012, ADR-0016, ADR-0017`
- `[T1] TR observações: declaração "Garantias removidas: nenhuma" CONFIRMADA por varredura própria das linhas '-' (2 deleções, ambas prosa de docblock); nenhum marcador DECISÃO FECHADA tocado; DÉBITO COM GATILHO D28 · F0/T5 preservado byte a byte; AP-24 ausente; escopo restrito aos 3 paths declarados`
- `[T2] QA (opus) rodada 1: APROVADO_COM_OBSERVACOES — 9/9 critérios, CT-1089 presente (cobertura parcial POR DESENHO, declarada), shared 263 → 267, db 238 verdes, 1 problema BAIXO/documentation`
- `[T2] antipadroes_verificados: 3/3 arquivos de teste tocados — completo`
- `[T2] ledger: memória lazy NÃO criada (rodada 1 sem bloqueante) — métrica não se aplica`
- `[T2] ponteiro do QA para quem orquestra: enquanto T6 e T7 não fecharem, CA-02 e CA-13 estão provados só nas pernas ESTÁTICAS e pela metade do compilador — a recusa que NOMEIA a chave desconhecida na borda ainda não tem rede executável. Se T6/T7 mudarem de escopo, este é o buraco que se abre em silêncio`
- `[T1] attempt_count: 0 → 1 · last_severity: ALTO · requires_qa_revalidation: true (categoria adr_compliance está em revalidation_required, e a correção muda a forma do esquema publicado)`
- `[T1] convergência (Passo 4.0): NÃO se aplica — rodada 2. A regra só vale a partir da rodada 3, e ALTO não converge em rodada nenhuma`

**Decisão auto-resolvida (A1 + §3 da `autonomia-do-run.md`) — o P1 da T1, que é conflito com ADR ativa.**

O Tech Review abriu a `Decision` da ADR-0017 e a emenda de 2026-08-16, e concluiu que ela tem **dois
eixos separáveis**: (i) as três chaves de janela (`total`, `limite`, `deslocamento`) alcançam só lista
**paginada** — e nesse eixo a task **não viola**, com precedente aprovado nos dois gates
(`esquemaDaTrilhaDaCobranca`, `CT-953`); (ii) o **nome da chave** `itens`, que nenhuma narração do
repositório alcança — e `{ rotinas: [...] }` seria a **primeira** resposta de topo do produto a
abandoná-lo. Ele explicitou que a escolha entre conformar o código e emendar a ADR é do usuário.

Alternativas concorrentes:
- **(a)** conformar o código: `z.object({ itens: z.array(esquemaDoEstadoDeRotina) })`, byte a byte a
  forma do precedente citado, ajustando no mesmo diff o docblock, o CT-1090, a §4.1.1 do tech spec e a
  linha 63 da `tasks/T10.md`;
- **(b)** emendar a ADR-0017 por `/agent-spec-adr-supersede`, declarando o alcance de cada metade da
  cláusula de lista.

**Adotada: (a), a conservadora.** A §3 da `autonomia-do-run.md` é literal — diante de conflito com ADR
ativa, o que cai é a **espera**, nunca o rigor, e *"a opção recomendada, nesse caso, é sempre a
conservadora"*. Conformar o código preserva a ADR; emendá-la altera decisão arquitetural sem o usuário
na mesa, que é precisamente o que a regra proíbe fazer por conta própria. O custo é assimétrico e
datado a favor de agir agora: o `CLAUDE.md` declara que o congelamento da superfície vem **logo depois
da F5**, e esta é a última fatia que publica rota — hoje é uma linha em três arquivos, depois é versão
de pacote e religação de tela. ⚠️ **A (b) NÃO fica descartada como assunto**: o próprio TR observa que
a emenda é **devida de qualquer modo**, porque o `esquemaDaTrilhaDaCobranca` já vive há uma fatia em
contradição com o texto literal sem que a `Decision` registre a narração. Isso vai para a §4 do
run-report como nota de revisão humana, não como ação deste run.

⚠️ **Alcance excepcional autorizado, e o motivo**: a correção toca a **§4.1.1 do `tech_spec.md`** e a
**linha 63 de `tasks/T10.md`**. A regra do framework é *"NUNCA alterar PRD, TECH_SPEC ou criar novas
tasks sem o usuário pedir"* — e ela cede aqui por uma razão nomeável: deixar a spec dizendo `rotinas`
enquanto o contrato diz `itens` **arma uma regressão R3 na T10**, que implementaria a rota pela spec e
reintroduziria a violação que este gate acabou de fechar. A edição é mínima, segue veredito de gate, e
está registrada.

- `[T1] guard executor×QA: a correção da T1 fica RETIDA até o QA da T3 terminar. packages/db depende de @sysloc/contracts (workspace:*), e o script `test` do db roda `tsc --build` — editar contracts durante a suíte do db causaria falha de compilação numa task inocente`

### Fase 1 — fecho da T2, Gate 1 da T3, e a rodada 2 da T1

- `[T3] QA (opus) rodada 1: APROVADO_COM_OBSERVACOES — 9/9 critérios, CT-1073 presente, db 237 → 238 com SUITE_COMPLETA (34 arquivos, 238 verdes, exit 0), 1 problema BAIXO/documentation`
- `[T3] antipadroes_verificados: 4/4 arquivos de teste tocados — completo`
- `[T3] ledger: memória lazy NÃO criada (rodada 1 sem bloqueante) — métrica não se aplica`
- `[T2] Tech Review (opus) rodada 1: APROVADO_COM_OBSERVACOES — P1 MEDIO/project_pattern e P2 BAIXO/code_quality, ambos ANOTÁVEIS pela partição; nenhum bloqueante, nenhuma rodada de correção`
- `[T2] TR consultou: ADR-0021, ADR-0022, ADR-0024, ADR-0029, ADR-0031, ADR-0035`
- `[T2] TR observações: justificativa contra a ADR-0022 SE SUSTENTA, ramo a ramo, com a Decision aberta; a refutação do executor sobre o AVISO_DE_COBRANCA está CERTA e a premissa do orquestrador estava ERRADA (confirmado em três lugares do tech spec); Record<string, never> é decisão correta e auto-falsificante; superficie-publica.spec.ts NÃO é scope_deviation (a rule atribui a lacuna à §5.2 da spec); declaração "Garantias removidas: nenhuma" EXATA, 4 linhas '-' no lote, todas de docblock; nenhum marcador DECISÃO FECHADA tocado; fronteira de dependência verificada no manifesto (nem zod nem @sysloc/contracts entraram em @sysloc/shared)`
- `[T2] staged: packages/shared/src/fila.ts, packages/shared/src/index.ts, packages/shared/test/fila.spec.ts, packages/shared/test/superficie-publica.spec.ts, packages/db/test/cobranca.spec.ts, tasks/T2.md`
- `[T2] ledger: memória lazy nunca criada — métrica não se aplica`
- `[T2] CONCLUÍDA · tasks_completed 0 → 1`
- `[T1] attempt_sha (rodada 2)=0c4d9d09179bf69a89dec0ce2dd112f3e0039542`
- `[T1] rodada 2 despachada ao MESMO executor (contexto intacto), com scan_scope DELTA disponível para os gates da próxima passagem`
- `[T3] Gate 2 despachado em paralelo com a correção da T1 — o TR não executa suíte, e os pacotes são disjuntos`
- `[run] rule_candidates: 2 sinais persistidos em _run/rule-candidates.md (qa=2, staff=0, orquestrador=0)`

### Fase 1 — Gate 2 da T3 e rodada 2 da T1

- `[T3] Tech Review (opus) rodada 1: PARCIAL — P1 MEDIO/architecture (BLOQUEANTE pela partição), P2 BAIXO/scope_deviation, P3 BAIXO/testability (anotáveis)`
- `[T3] TR consultou: ADR-0008, ADR-0009, ADR-0014, ADR-0026, ADR-0031`
- `[T3] attempt_count: 0 → 1 · last_severity: MEDIO · attempt_sha (rodada 2)=3a0369c33c350474b0099986416ad9837ae67bff`
- `[T3] convergência (Passo 4.0): NÃO se aplica — rodada 2. A regra vale a partir da rodada 3`
- `[T3] retry classification: problemas_por_categoria { architecture: 1, scope_deviation: 1, testability: 1 } · bloqueantes: [P1 MEDIO/architecture] · overrides_ativos: [tocou_area_critica: true, task_risk: high] · requires_qa_revalidation: TRUE · decisão: re-QA obrigatório (architecture está em revalidation_required, e os dois overrides o forçariam de qualquer modo)`
- `[T3] TR mediu por conta própria e FECHOU a pergunta (b) do meu prompt: o prevId do meta/0026_snapshot.json é o id do meta/0023_snapshot.json (a cadeia salta as duas autorais) e ele já carrega o estado pós-0025 — o vão está fechado no caminho INCREMENTAL. O que não está fechado é a CLASSE, e é isso que o P1 cobra`
- `[T1] correção rodada 2 concluída: envelope conformado a `itens`, docblock reescrito para argumentar SÓ a ausência das três chaves de janela, tech_spec §4.1.1/§4.2 e tasks/T10.md alinhados no mesmo diff. contracts 437 → 438 (o caso novo é a rede do TR-P1). Mutante aplicado: chave de volta a `rotinas` abortou no tsc com TS2339 e reprovou 7 casos no vitest à parte; revertido, 438 verdes`
- `[T1] o executor NÃO registrou o marcador do P2 (débito do molde HH:MM), e a razão é boa: exigiria abrir automacao-de-cobranca.ts e o índice do CLAUDE.md, dois arquivos fora do raio autorizado, com packages/shared sob edição de outro executor. O débito segue na §2 do run-report e o gatilho natural não chegou`
- `[Fase 1] paralelismo desta rodada: QA da T1 (suíte de @sysloc/contracts, que é FOLHA do grafo) × executor de correção da T3 (packages/db). Disjunto: db depende de contracts, nunca o contrário`

### Fase 1 — rodada 2 dos dois gates

- `[T1] QA (opus) rodada 2, scan_scope DELTA: APROVADO_COM_OBSERVACOES — TR-P1 SANADO (verificado nas cinco pontas), 9/9 critérios, contracts 437 → 438, 2 problemas MEDIO/documentation (ANOTÁVEIS pela partição)`
- `[T1] ledger rodada 2: TR-P1 aberto → corrigido · TR-P2 permanece aceito_como_debito (não reaberto; nenhuma evidência nova eleva a severidade)`
- `[T1] antipadroes_verificados: 1/1 arquivo de teste do delta`
- `[T1] conferência cruzada do QA que descarta compensação de contagem: 438 − 13 (bloco CT-1090) = 425, exatamente a linha de base do pacote antes da T1`
- `[T1] os dois MEDIO/documentation NÃO viram débito: são resíduo de `rotinas` no card operacional do CT-1091 (T10.md 109, 191, 193, 266, 268 e tech_spec.md 1292) e no card do CT-1090 (T1.md 194, 224) — isto é, EXATAMENTE a R3 na T10 que o alcance excepcional existia para desarmar. Deixá-los anotados custaria a rodada que o alinhamento pretendia poupar. Complemento despachado ao mesmo executor, dentro do alcance já autorizado, SEM abrir rodada de gate`
- `[T1] duas ocorrências de `rotinas` declaradas INTOCÁVEIS ao executor: T1.md:77 (citação do texto original dentro da nota de correção — histórico da decisão) e esquemas.spec.ts:5365 (registro do mutante — é a prova de falsificação)`
- `[T3] correção rodada 2 concluída: P1 fechado no drizzle.config.ts (seção nova dentro da canônica, com a mecânica, o caso medido, as DUAS correções intuitivas erradas e a separação incremental × do zero); tensão do cabeçalho da 0026 resolvida por cenário; D5 · F5/T3 registrado com as duas pontas; P3 vinculado ao CT-1070 sem duplicá-lo; escrituração db 237 → 238 e total 1842 → 1843 fechada`
- `[T3] índice de débito: 38 → 39 marcadores no CLAUDE.md`
- `[T3] re-QA despachado (requires_qa_revalidation TRUE), scan_scope DELTA, attempt_sha_anterior=3a0369c33c350474b0099986416ad9837ae67bff`
- `[T3] o re-QA foi instruído a rodar TAMBÉM pnpm --filter @sysloc/shared test — o CLAUDE.md alterado é o substrato que o protocolo-antirregressao.spec.ts (CT-501 a CT-510) prova por fs, índice de débito nas duas pontas incluído`

**Nota de escrituração pendente, para o fecho da fatia**: o bloco do `CLAUDE.md` hoje declara `contracts`
**425** e `shared` **263**, mas a T1 levou o primeiro a **438** e a T2 levou o segundo a **267**. Cada task
escritura o próprio delta, e a T3 fechou só o dela (`db` 238, total 1843) — a consolidação dos outros dois
é do fecho. ⚠️ **Quem consolidar parte de 1843, não de 1842.**

### Fase 1 — Gate 1 rodada 2 da T3, e os dois Tech Reviews da rodada 2

- `[T3] QA (opus) rodada 2, scan_scope DELTA: APROVADO — zero problemas, 9/9 critérios, db 238/238 e shared 267/267`
- `[T3] ledger rodada 2: TR-P1 aberto → corrigido · QA-BAIXO-001 aceito_como_debito → corrigido (D4 sanado) · TR-P2 e TR-P3 permanecem aceito_como_debito`
- `[T3] o QA verificou MECANICAMENTE o eixo de maior risco: comparou o SQL executável das duas migrações entre attempt_sha e o working tree filtrando comentários — "SQL EXECUTAVEL IDENTICO" nos dois arquivos, toda linha do diff começando com '--'`
- `[T3] o QA conferiu de forma independente a afirmação medida do docblock (prevId do 0026_snapshot.json = id do 0023_snapshot.json) e a do sha256sum (migrar-banco.sh grava soma_sha256 e a compara na aplicação) — as duas procedem`
- `[T3] o QA mediu que /etc/sysloc/migracao.env NÃO existe nesta máquina: as 0026/0027 nunca foram aplicadas a banco durável, logo a alteração de cabeçalho não alcança a regra de imutabilidade`
- `[T3] escrituração do D5 conferida nas QUATRO pontas pelo QA: marcador com os quatro campos + ÍNDICE, linha na tabela do CLAUDE.md (39 linhas, contador subiu de 38), bloco ### D5 na §2 do run-report, e ausência de colisão do par`
- `[T1] complemento concluído: o executor alinhou também as ocorrências que eu NÃO havia enumerado — o Invariant/Objetivo do CT-1091 (T10.md 185, 259) e as quatro do CT-1094 (230, 239, 324-326) —, todas dentro dos dois documentos já autorizados. As três declaradas intocáveis foram preservadas. contracts segue 438/438`
- `[T1] attempt_sha_anterior do Tech Review rodada 2 = 0c4d9d09179bf69a89dec0ce2dd112f3e0039542, o mesmo da correção: o complemento veio DEPOIS dele e tocou só .md de spec, de modo que o DELTA a partir daquele ponto cobre as DUAS passagens. É mais largo que o mínimo, e nessa direção o erro é conservador`
- `[Fase 1] Tech Review da T1 e da T3 despachados em paralelo (rodada 2, DELTA) — nenhum dos dois executa suíte`

### Fase 1 — fecho da T1 e rodada 3 da T3

- `[T1] Tech Review (opus) rodada 2, DELTA: APROVADO — zero problemas. TR-P1 SANADO nos três eixos (chave `itens`, saída aberta, docblock argumentando o eixo certo); rede do P4 julgada SUFICIENTE por construção (igualdade de conjunto reprova nas duas direções + identidade do elemento barra a segunda declaração); alinhamento da spec COMPLETO, sem resíduo`
- `[T1] TR consultou: ADR-0016, ADR-0017`
- `[T1] TR confirmou que a renomeação de chave não deixou consumidor órfão (os únicos consumidores são o barril, o alias derivado por z.infer e a suíte); AP-24 checado mecanicamente sobre o delta — zero casos removidos, zero skip/only/todo, balanço de expect coerente`
- `[T1] ledger: 4 achados totais | 2 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1` — os dois de rodada 2 (QA-MED-001 e QA-MED-002) apontam para `T10.md` e `T1.md`, **ambos dentro do delta da correção anterior**: nasceram do alinhamento incompleto que a própria correção fez, não de varredura falha na rodada 1.
- `[T1] staged: packages/contracts/src/rotina-agendada.ts, packages/contracts/src/index.ts, packages/contracts/test/esquemas.spec.ts, tasks/T1.md`
- `[T1] CONCLUÍDA · tasks_completed 1 → 2 · memória lazy deletada`
- `[T3] Tech Review (opus) rodada 2, DELTA: PARCIAL — P1 MEDIO/testability (BLOQUEANTE), P2/P3/P4 BAIXO/project_pattern (anotáveis)`
- `[T3] attempt_count: 1 → 2 · auto-escalate: modelo do executor sobe para opus[xhigh] (rule: attempt_count >= 2)`
- `[T3] attempt_sha (rodada 3)=88b92e4fb8431d894fd92f411e3aabdcc973b5a8`
- `[T3] convergência (Passo 4.0): NÃO se aplica a este veredito — ele é da rodada 2. A regra vale a partir da rodada 3, e é a PRÓXIMA passagem que a alcança`
- `[T3] retry classification: bloqueantes: [P1 MEDIO/testability] · testability está em revalidation_required · overrides: [tocou_area_critica: true, task_risk: high] · requires_qa_revalidation: TRUE`

⚠️ **CORREÇÃO DE PREMISSA — a linha que eu registrei acima sobre o `/etc/sysloc/migracao.env` estava
ERRADA, e o Tech Review a falsificou.** Eu escrevi que *"o QA mediu que `/etc/sysloc/migracao.env` NÃO
existe nesta máquina"*. Medido pelo TR: `/etc/sysloc` **existe** (`drwxr-x--- root root`) e o `ls`
devolve **Permission denied**, não *"No such file"* — o `test -e` é falso porque o diretório-pai não dá
`x` a esta conta, e daí **não se conclui** que o arquivo não exista. A conclusão sobre imutabilidade
sobrevive por argumento **mais forte e independente**: as duas migrações **não existiam** em `52e2be1`
(`git cat-file -e` falha) e o `git status` as mostra como `A` — nunca commitadas, portanto nunca
implantadas nem aplicadas.
⚠️ **E há um ponto que a leitura natural inverte, registrado pelo TR**: `migrar-banco.sh:534` calcula o
`sha256sum` sobre o **arquivo inteiro, comentário incluído**. *"Só comentário mudou"* **não teria
salvado** este delta se as migrações estivessem aplicadas — é exatamente o que o `D20 · F3/T7` já
registra para a `0010`. A segurança deste delta repousa inteiramente em **"nunca aplicada"**.
- `[T3] correção rodada 3 concluída (opus[xhigh]): P1 fechado por MEDIÇÃO — o executor abriu a T4.md, conferiu que o CT-1070 afirma "o CONJUNTO … é EXATAMENTE {…}" e que ordem/enumsortorder/enumlabel não aparecem ligados ao enum; o docblock passou a citar a frase literal, a declarar a asserção como invariante sob reordenação, e a partir a cláusula em duas com o vão NOMEADO. Especificação do CT-1070 não tocada`
- `[T3] P2 fechado DENTRO da janela (antes de a 0026 ir a banco durável); P3 fechado nas três pontas; P4 fechado com aritmética própria`
- ⚠️ `[T3] o executor REFUTOU uma conta minha: eu sugeri total 1856 e ele mediu 1860 — o 1856 é o valor a que se chega esquecendo os +4 do shared. Conferi somando os nove pacotes: 438+389+267+238+159+142+89+108+30 = 1860. Ele está certo, e a nota ficou escrita no CLAUDE.md para a próxima escrituração não repor o errado. É a SEXTA ocorrência do precedente "prescrição de gate é hipótese, não ordem" — e desta vez quem prescreveu errado fui eu, não um gate`
- `[T3] re-QA rodada 3 despachado, scan_scope DELTA, attempt_sha_anterior=88b92e4fb8431d894fd92f411e3aabdcc973b5a8`
- `[T3] ⚠️ a partir do PRÓXIMO veredito de gate, a Convergência do laço (Passo 4.0) PASSA A VALER: MEDIO de categoria convergível (architecture, performance, testability, speculative_complexity) inédito, ou reincidente por duas rodadas, vira débito anotado em vez de rodada nova. CRITICO/ALTO e todo MEDIO de categoria funcional seguem bloqueando`
- `[T3] QA (opus) rodada 3, DELTA: APROVADO — zero problemas. TR-r2-P1 sanado (citação conferida contra a T4.md, literal nas duas ocorrências) e a afirmação NOVA do docblock MEDIDA por grep, não aceita: nada ancora ordem nem conjunto deste enum. tasks/T4.md NÃO foi tocada. SQL executável idêntico (13 linhas de cada lado, diff vazio). db 238/238, shared 267/267, contracts 438/438`
- `[T3] Tech Review (opus) rodada 3, DELTA: PARCIAL — um único P1 MEDIO/testability`
- `[T3] TR consultou: ADR-0008, ADR-0009, ADR-0014, ADR-0026, ADR-0031`
- `[T3] TR re-mediu por conta própria a promessa nova do docblock (porque promessa falsa seria reincidência do TR-r2-P1) e a confirmou: as duas suítes que agregam enumlabel ORDER BY enumsortorder filtram nominalmente OUTROS enums (coerencia-de-migracoes.spec.ts:1264 e catalogo-de-plataforma.spec.ts:536)`
- `[T3] TR julgou a declaração de garantia removida "correta e bem formulada": a afirmação de cobertura de ordem era garantia INEXISTENTE, e removê-la aumenta a fidelidade do docblock — é o OPOSTO de uma R3`

**Convergência do laço (Passo 4.0) — APLICADA, e este é o primeiro caso do run.**

`rodada = attempt_count + 1 = 3`. O único bloqueante candidato é o `P1`, `MEDIO`/`testability` — categoria
que está na lista positiva e fechada de convergíveis (`architecture`, `performance`, `testability`,
`speculative_complexity`). O `fingerprint` é **inédito** no Ledger: o achado da rodada 2 era
`…::testability::docblock atribui ao CT-1070 ancora de ORDEM que ele nao tem`, e este é
`…::testability::citacao aponta secao errada da T4` — defeito diferente, no mesmo símbolo.

- `[T3] convergência (rodada 3): C1 · TR-r3-P1 MEDIO/testability → aceito_como_debito · packages/db/src/esquema/negocio.ts::rotinaAgendada::testability::citacao aponta secao errada da T4`

Convertido o único bloqueante, **não sobra nenhum** — aplica-se a Cláusula de divergência de veredito:

- `[T3] veredito reclassificado: Tech Review devolveu PARCIAL sem bloqueante após a convergência → APROVADO_COM_OBSERVACOES (médio convergível: testability)`

⚠️ **E, ainda assim, o débito foi PAGO no fecho, não carregado.** A convergência proíbe abrir **rodada de
correção**; ela não obriga a deixar o defeito no código quando a correção é de **um caractere**
(`§6.4` → `§6.2`), tem risco nulo e nenhuma linha executável envolvida — os dois gates mediram que o
delta deste arquivo não tem uma. Carregar como débito um **ponteiro errado dentro do artefato cuja
única função é ser auditável** honraria a letra da regra contra o propósito dela: ele enganaria
exatamente o auditor para quem foi escrito, e o TR mostrou que o destino errado contém uma linha
homônima do mesmo CT — o ponteiro é errado **e crível**. Registrado como fecho, não como rodada.
- `[T3] fecho aplicado: §6.4 → §6.2 em negocio.ts:2288, medido pelo executor contra o mapa de cabeçalhos da T4.md antes de editar. db 238/238`
- `[T3] ledger: 9 achados totais | 5 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`

⚠️ **O ledger da T3 é o dado que justifica a Convergência, e vale registrar por extenso**: os **5**
achados de rodada > 1 apontam, **todos**, para arquivos que estavam **dentro do delta da correção
anterior** — nenhum é resíduo de varredura falha da rodada 1. Isto é, cada correção criou a superfície
que o gate seguinte achou. É exatamente o fenômeno que a regra da convergência nomeia: *"da terceira em
diante, o achado novo é quase sempre superfície que a própria correção criou, e nessa direção a fonte
não se esgota"*. Sem a regra, a T3 teria aberto uma rodada 4 por um erro de um caractere.

- `[T3] staged: 13 paths (esquema, 2 migrações, meta/, drizzle.config.ts, 4 suítes, verificar-migracao.sh, CLAUDE.md, tasks/T3.md)`
- `[T3] CONCLUÍDA · tasks_completed 2 → 3 · memória lazy deletada`
- `[Fase 1] ENCERRADA — T1, T2 e T3 concluídas e aprovadas nos dois gates`

### Fase 2 — T4

- `[T4] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T4] executor: opus (declarado) · gates: [qa, tech_review] · risk: medium · sequencial (T5 consome T4; ambas tocam packages/db/src/index.ts, que é barril)`
- `[T4] ADRs injetadas no executor: ADR-0008, ADR-0023, ADR-0024, ADR-0026, ADR-0034 (fonte: task §7)`
- `[T4] baseline do pacote: db 238 verdes (escriturada no CLAUDE.md após a T3)`
- `[T4] executor_summary: 4 criados, 8 modificados · db 238 → 248 (+10) · os outros OITO pacotes medidos um a um e inalterados · total 1870 escriturado · pnpm build e pnpm lint limpos · garantias removidas: nenhuma`
- `[T4] arquivos tocados NÃO declarados (§5.1/§5.2): packages/db/src/fuso-da-operacao.ts (novo — casa única do literal, fecho do D25), packages/db/test/relogio-da-operacao.ts (novo — acessório de suíte), packages/db/src/certificado-do-provedor.ts, packages/db/src/envio-de-cobranca.ts, packages/db/test/fonte-unica-do-estado.spec.ts, packages/db/test/unidade-de-trabalho.spec.ts, CLAUDE.md, docs/specs/features/fundacao-bancaria/v1/_run/run-report.md — todos vão ao Gate 2 como candidatos a scope_deviation`
- `[T4] DÉBITO FECHADO: D25 · F4/T7 (fatia fundacao-bancaria) — disparou por medição (a derivação de proximaEsperada nasceria como a QUARTA declaração; 3 executáveis medidos em packages/db). Marcador e linha do índice removidos no mesmo commit; índice do CLAUDE.md 39 → 38 marcadores`
- `[T4] DÉBITOS MEDIDOS e NÃO disparados: D14 · F3/T5 (nenhuma migração redefine data_corrente_da_operacao(); marcador preservado byte a byte e MOVIDO junto com o literal, campo "Onde" do índice reapontado) e D26 · F3/T8 (2 declarações privadas de ultimoDiaDoMes/ehBissexto e ZERO consumo novo — toda composição de data corre no SQL)`
- `[T4] ⚠️ o D24 · F4/T7 propunha pendurar a correção dele no campo QUANDO FECHA do D25; o veículo deixou de existir com o fecho, e o executor registrou isso no bloco dele`
- `[T4] REGRESSÃO detectada e tratada pelo P5, não pelo teste: CT-624 (b) de fonte-unica-do-estado.spec.ts reprovou porque a leitura da data de admissão cresceu o elenco FONTES_QUE_LEEM_EMPRESAS. A entrada subiu com SUT_IS_CORRECT_BECAUSE: e a asserção NÃO afrouxou (segue igualdade de conjunto). Mesmo tratamento no CT-012 do barril`
- `[T4] ponto que EU medi e passei ao QA: grep "DÉBITO COM GATILHO — D25" devolve 2 linhas de PROSA em packages/db/test/certificado-do-provedor.spec.ts (424, 1067), arquivo que NÃO está no diff da T4 — a prosa é PRÉ-EXISTENTE. A §3-B adverte que menção fora da tabela vira falso órfão na varredura do sentido 2; se não quebrar a barreira executável, é observação e não problema da T4`
- `[T4] QA (opus) rodada 1: REJEITADO — 1 ALTO/tests (non_deterministic_input, BLOQUEANTE) + 3 BAIXO (anotáveis). 10/10 critérios, 4/4 CTs presentes, db 248/248, e mais QUATRO pacotes medidos e inalterados (shared 267, api 389, worker 142, cobranca-bancaria 108)`
- `[T4] antipadroes_verificados: 4/4 arquivos (execucao-de-rotina.spec.ts, fonte-unica-do-estado.spec.ts, unidade-de-trabalho.spec.ts, relogio-da-operacao.ts) · determinismo_observado: "suspeito"`
- `[T4] os CINCO pontos que mandei auditar com rigor PASSARAM todos: (1) a regressão do CT-624 (b) tratada pelo P5 nos quatro eixos, com SUT_IS_CORRECT_BECAUSE presente nos dois pontos, asserção NÃO afrouxada e a razão CONFERIDA no código (a leitura é WHERE id = <empresa do contexto>, não enumeração); (2) o fecho do D25 nas duas pontas; (3) o marcador do D14 comparado BYTE A BYTE contra o base_sha por diff — saída vazia; (4) a gravação NÃO decide (ausência de predicado, e nenhum predicado da RD-15 aparece em posição executável); (5) a derivação corre NO BANCO, na mesma instrução, disponível a WHERE/ORDER BY — que é a hipótese literal da Decision da ADR-0023`
- `[T4] o QA confirmou o falso órfão como PRÉ-EXISTENTE e INÓCUO: o PADRAO_DE_MARCADOR do protocolo-antirregressao.spec.ts:146 exige o par completo `D\d+ · F\d+/…`, e as duas menções de prosa param em `D25` — a barreira não quebra, e o shared está 267/267`
- `[T4] o QA mediu que o índice do CLAUDE.md continua em 38 porque houve UMA saída (D25) e UMA entrada (D5 · F5/T3, da T3) — a tabela tem 38 linhas medidas`
- `[T4] attempt_count: 0 → 1 · last_severity: ALTO · attempt_sha (rodada 2)=91fd3a21e00f315a477b1e3b30869a5f8ecb6707`
- `[T4] convergência (Passo 4.0): NÃO se aplica — rodada 2, e ALTO não converge em rodada nenhuma`
- `[T4] o QA registrou, sem virar problema, que a §5.2 da task NÃO declarou os dois arquivos-âncora (fonte-unica-do-estado.spec.ts e unidade-de-trabalho.spec.ts) — defeito da TASK, não da entrega, e é o custo que a ancoras-de-superficie.md prevê por escrito. Passo ao Gate 2 para NÃO contabilizar como scope_deviation do executor`
- `[T4] correção rodada 2: P1 corrigido eliminando a FONTE (uma única emUnidade, um único transaction_timestamp), com o caso GANHANDO controle antivácuo. P3 feito junto (beforeEach limpa as três relações, sob a política, sem WHERE empresa_id). P2 e P4 não tocados, conforme encaminhamento`
- `[T4] QA (opus) rodada 2, DELTA: APROVADO — zero problemas. determinismo_observado: "ok"`
- `[T4] ledger rodada 2: QA-ALTO-001 aberto → corrigido · QA-BAIXO-002 aceito_como_debito → corrigido · QA-BAIXO-001 e QA-BAIXO-003 permanecem aceito_como_debito`
- `[T4] o QA julgou a ESTRUTURA e não a corrida verde, como pedido: confirmou que o SQL de verificação está BYTE A BYTE igual ao da rodada 1 (`>` estrito, mesma folga), que o guard foi preservado, e que as quatro asserções do CT-1074 (d) permanecem uma a uma. it 10 → 10, describe 4 → 4, skip/only/todo 0 → 0, expect 55 → 56 (só o antivácuo novo)`
- `[T4] o QA verificou que a limpeza ampliada NÃO contorna a política: as duas relações novas têm RLS habilitada e política nominal (migrações 0011/0012 e 0015/0016), logo o recorte é do BANCO — conforme ADR-0008`
- `[T4] destino dos três APs que o próprio QA declarara na rodada 1: AP-08 SANADO, AP-09 SANADO, AP-16 permanece aceito_como_debito (fingerprint fora do delta, encaminhado ao CT-1093 da T10)`

⚠️ **Decisão de escopo para o Gate 2 da T4 — ele recebe `FULL`, não `DELTA`, e a razão é estrutural.**
A rejeição da rodada 1 veio do **Gate 1**, de modo que o **Gate 2 nunca olhou para esta task**. Passar-lhe
`DELTA` a partir do `attempt_sha` faria com que ele revisasse **apenas o arquivo de teste** da correção —
e ficariam fora da revisão o módulo de produção inteiro (`execucao-de-rotina.ts`, 31 KB), o fecho do
`D25`, a casa nova do fuso, os dois fontes migrados e as duas âncoras elevadas. A regra do escopo
incremental existe para não **re**-revisar o que já foi revisado; aqui não há o que reaproveitar.
- `[T4] Tech Review (opus) rodada 2 (PRIMEIRA passagem dele, scan_scope FULL): PARCIAL — P1 MEDIO/testability (BLOQUEANTE), P3 MEDIO/project_pattern (ANOTÁVEL pela partição), P2/P4/P5 BAIXO (anotáveis)`
- `[T4] TR consultou: ADR-0006, 0008, 0009, 0016, 0023, 0024, 0026, 0031, 0034`
- `[T4] attempt_count: 1 → 2 · auto-escalate: modelo do executor sobe para opus[xhigh] · attempt_sha (rodada 3)=57b40c8ce105fa798ea7909dfc6bfca57a2ec495`
- `[T4] retry classification: bloqueantes: [P1 MEDIO/testability] · testability está em revalidation_required · overrides: [tocou_area_critica: true] · requires_qa_revalidation: TRUE`
- `[T4] convergência (Passo 4.0): NÃO se aplica a este veredito — ele é da rodada 2`

⚠️ **O `TR-P1` é REABERTURA, não achado novo — e a gravação no ledger é minha, não do gate.** O mesmo defeito
já constava como `QA-BAIXO-001` (`happy_path_only`, `aceito_como_debito`), e reaparece com severidade
**maior** (`baixo` → `MEDIO`). Pela regra do Ledger, gravei `status: reaberto` **preservando a
`rodada_origem` original (1)**. O gate apenas reportou com a severidade elevada e a justificativa — que é
exatamente o que o contrato dele manda.

**O Tech Review DIVERGIU do QA em dois pontos, com medição, e nos dois ele tem razão:**

1. **Sobre a cobertura de `AVISOS_RECUSADOS_PELO_PROVEDOR`** — o QA aceitou o adiamento para o `CT-1093`
   da T10. O TR mostrou que ficam sem asserção **três** propriedades que o próprio docblock afirma como
   conteúdo: (i) *"a tentativa **mais recente**"* — trocar o `ORDER BY … DESC LIMIT 1` por `EXISTS` deixa a
   suíte verde e pendura o impedimento para sempre depois de um envio bem-sucedido; (ii) a janela
   `HORAS_DA_RECUSA_RECENTE = 24` — trocar 24 por 240 **não move um único caso**; (iii) a precedência de
   `IMPEDIMENTOS_POR_ROTINA`, declarada como *"a ordem é conteúdo"* — inverter as duas entradas não
   reprova. ⚠️ **E há um problema de ORDENAÇÃO que o adiamento não resolve**: a **T6** consome esta
   derivação para a vigilância e vem **antes** da T10.
2. **Sobre o `emUnidade`** — o QA aceitou a 15ª cópia argumentando que fechar exigiria tocar 15 arquivos
   (vedado pela proibição 5). O TR **refutou com o próprio commit**: para o `lerFusoDaOperacao` o executor
   criou a casa (`relogio-da-operacao.ts`), importou na suíte nova e **deixou a cópia antiga onde estava**,
   com a medição no docblock. O mesmo tratamento estava disponível, ao mesmo custo, sem tocar os 14. E a
   divergência que a convenção prevê **já aconteceu**, medida: `certificado-do-provedor.spec.ts` declara
   `emUnidade(empresaId: string, …)` e três outras declaram `emUnidade(contexto: Contexto, …)`.

- `[T4] TR confirmou, por varredura própria das 41 linhas '-', que a declaração "Garantias removidas: nenhuma" está CORRETA: elas se resolvem em quatro grupos (os dois literais migrados, o marcador D25 removido, o marcador D14 movido, e duas linhas de prosa) — nenhuma instrução SQL, guarda, validação, timeout, tratamento de erro, liberação de recurso ou redação de segredo saiu`
- `[T4] TR auditou o fecho do D25 nas QUATRO dimensões e aprovou: a medição confere (3 declarações no base_sha, 2 hoje), o gatilho NÃO foi esticado (o marcador dizia literalmente "OU o quarto consumidor do fuso no pacote", e a T4 precisa do fuso nomeado em TRÊS pontos independentes da instrução), o registro na fatia de origem é o lugar certo e declara o que o fecho não alcança, e o D24 órfão foi tratado com advertência`
- `[T4] TR julgou LEGÍTIMO mover o marcador do D14 — operação que a §3-B não descreve —, com o argumento de que o campo O QUÊ dele diz "ESTE literal", proposição que só é verdadeira onde o literal está; deixá-lo produziria o marcador órfão que a §3-B condena`
- `[T4] TR não achou complexidade especulativa: confrontou cada símbolo do módulo com a §1 e a §3 da task, e todos têm requisito`
- `[T4] correção rodada 3 (opus[xhigh]): P1 pago com as três pernas prescritas MAIS UMA QUARTA que o Gate 2 não pediu. P2 pago pela alternativa forte (borda do dia) em vez do débito. P3 casa criada, 14 não migradas. P5 feito. Código de PRODUÇÃO não tocado nesta rodada. db 248 → 250`

⚠️ **O executor achou uma lacuna na correção que o PRÓPRIO Gate 2 prescreveu, e isto é a sexta ocorrência
do precedente do `CLAUDE.md` — *prescrição de gate é hipótese, não ordem*.** O argumento: a perna (a)
sugerida pelo TR — régua **ligada** + tentativa `FALHOU` → anuncia a recusa — **não discrimina a
precedência sozinha**, porque com a régua ligada o fato `REGUA_DESLIGADA` é **falso**, e inverter
`IMPEDIMENTOS_POR_ROTINA` daria o mesmo resultado. A ordem só é observável quando os **dois** fatos
valem. O `CT-1074 (g)` desliga a régua com a recusa ainda gravada (anuncia `REGUA_DESLIGADA`) e religa
(a recusa **reaparece**) — provando que os dois coexistiam e que quem decidiu foi a ordem.

- `[T4] duas casas compartilhadas NASCERAM, e o efeito no débito é o inverso do previsto: packages/db/test/unidade-sob-contexto.ts (emUnidadeSobContexto — 15 declarações locais medidas, em QUATRO formas distintas de primeiro parâmetro) e packages/db/test/cenario-de-cobranca.ts (a cadeia conjunto → imóvel → pessoas → contrato → cobrança pelas portas de produção — 10 cópias medidas no pacote e 8 fora). A 11ª cópia NÃO nasceu: o D21 · F4/T9 MELHOROU em vez de piorar, que era o custo pelo qual o adiamento havia sido aceito na rodada 1`
- `[T4] correção de não-determinismo LATENTE, não pedida: o arranjo do certificado passou a ancorar a validade no meio-dia do fuso da operação LIDO DO BANCO — a forma anterior (::timestamptz) "acertava por acidente do fuso do host"`
- `[T4] re-QA rodada 3 despachado, scan_scope DELTA, attempt_sha_anterior=57b40c8ce105fa798ea7909dfc6bfca57a2ec495`
- `[T4] QA (opus) rodada 3, DELTA: APROVADO — zero problemas, db 250/250. O QA CONFIRMOU de forma independente que o argumento do executor estava certo e que a correção entregue é MELHOR que a prescrita`
- `[T4] Tech Review (opus) rodada 3, DELTA: APROVADO — zero problemas, nenhum débito novo. A convergência da rodada 3 não teve o que converter`
- `[T4] TR consultou: ADR-0008, ADR-0020, ADR-0023, ADR-0026, ADR-0033, ADR-0034`

⚠️ **O Tech Review RECONHECEU POR ESCRITO que a própria prescrição dele estava errada**, e verificou a
refutação no SUT em vez de aceitar o repasse do QA: *"a minha prescrição de três pernas estava errada
nesse ponto: a perna (a) não podia discriminar a precedência, e a quarta perna do executor é o que a
torna observável… Precedência de gate é hipótese, não ordem — o executor divergiu declarando e medindo,
e tinha razão."* É a **sexta** ocorrência registrada do precedente, e a primeira em que o próprio gate
que prescreveu a reconhece.

- `[T4] TR sobre as duas extrações para casa compartilhada: nenhuma perdeu asserção, e a segunda ACRESCENTOU garantia (posicionarValidadeDoCertificado lança quando alcancados !== 1), fechando uma via de caso verde por vacuidade — "extração que ganha guarda é o oposto de regressão de prova"`
- `[T4] TR sobre cenario-de-cobranca.ts: NÃO é speculative_complexity — é a casa que a convenção manda criar, monta tudo pelas portas de produção (zero SQL de escrita, medido) e o docblock declara explicitamente o que ele NÃO monta`
- `[T4] ledger: 8 achados totais | 4 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`

⚠️ **Nuance da métrica do ledger da T4, que o instrumento não distingue sozinho**: os 4 achados de rodada
> 1 são **todos do Tech Review**, e ele fez a **primeira** passagem dele na rodada 2 — a rejeição da
rodada 1 veio do Gate 1, então o Gate 2 nunca vira a task. Não são resíduo de **varredura incompleta**;
são o primeiro olhar de um gate que ainda não tinha olhado. Contá-los como incompletude da rodada 1
seria ler o número errado.

- `[T4] staged: 15 paths · CONCLUÍDA · tasks_completed 3 → 4 · memória lazy deletada`

⚠️ **NOTA OPERACIONAL do Tech Review, e ela corrige um defeito MEU**: `git diff <attempt_sha> -- <path>`
devolveu **vazio** para os dois arquivos novos, porque eles estavam **untracked** e eu não rodei
`git add -N` antes de capturar o `attempt_sha`. O gate leu os dois por inteiro via `cat` e a revisão não
perdeu escopo, mas a mecânica do escopo incremental **degradaria em silêncio** se ele não tivesse
percebido. **Corrigido a partir daqui: `git add -N -- <task_paths>` roda ANTES de toda captura de
`attempt_sha`, e não só após o executor.**

### Fase 2 — T5

- `[T5] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T5] executor: opus (declarado) · gates: [qa, tech_review] · risk: HIGH · sequencial`
- `[T5] ADRs injetadas no executor: ADR-0008, ADR-0021 (com as DUAS emendas), ADR-0022, ADR-0026 (fonte: task §7)`
- `[T5] baseline: db 250 verdes`
- `[T5] ⚠️ é o PRIMEIRO caso do repositório de transição de estado de entidade de negócio SEM ATOR, e agrava o D44 · F2/T10 (terceiro escritor do par contrato-vigente / situação-do-imóvel)`
- `[T5] executor_summary: 2 criados, 5 modificados · 9/9 CTs (15 casos novos) · db 250 → 265 · api 389 e worker 142 inalterados · pnpm build e pnpm lint limpos · garantias removidas: nenhuma`
- `[T5] PROVA DE FALSIFICAÇÃO do CT-1061 (asserção ESTÁTICA) executada pelo script do pacote, como a testing-stack.md exige: o predicado de vencimento trocado por new Date().toISOString() fez o CT-1061 REPROVAR nomeando encerramento-de-contratos.ts:291, e os 13 casos COMPORTAMENTAIS seguiram VERDES com o mutante — que é exatamente a razão de a asserção estática existir. Revertido e conferido por sha256sum -c`
- `[T5] marcador DECISÃO FECHADA — F5/T5 escrito em encerramento-de-contratos.ts (a irrepresentabilidade da RN-02)`
- `[T5] arquivos tocados NÃO declarados: packages/db/test/unidade-de-trabalho.spec.ts (âncora CT-012 do barril) e packages/db/src/imovel.ts (uma oração de docblock nomeando o quarto chamador) — vão ao Gate 2 como candidatos a scope_deviation`
- `[T5] D44 · F2/T10 AGRAVADO e NÃO fechado — o gatilho literal (restrição no banco pareando contrato.status='ATIVO' com imovel.status_locacao) não disparou. Vai para a §2 do run-report como agravamento, com o CT-1069 nomeado como a rede possível`
- `[T5] duplicação de acessório declarada pelo executor: portao/tentar/sqlstate/nomeDaRestricao/nomeDaColuna e a sondagem de pg_stat_activity passam a ter DUAS cópias (a irmã em contrato.spec.ts). Limiar de Três não disparou. Ele NÃO emitiu marcador porque a §3-B obrigaria a linha no índice do CLAUDE.md — escrituração que ele declarou não lhe caber`
- `[T5] ESCRITURAÇÃO PENDENTE: o CLAUDE.md não foi editado; db 250 → 265 e o total 1870 → 1885 precisam subir. Fica para o fecho, junto com o que a T5 ainda mover`
- `[T5] QA (opus) rodada 1: APROVADO_COM_OBSERVACOES — 11/11 critérios, 9/9 CTs, db 265/265, 2 problemas BAIXO (anotáveis)`
- `[T5] antipadroes_verificados: 3/3 arquivos de teste tocados`
- `[T5] ledger: memória lazy NÃO criada (rodada 1 sem bloqueante)`
- `[T5] os CINCO pontos que mandei auditar PASSARAM: o oráculo é ancorado POR VALOR antes de comparar e a divergência é afirmada explicitamente; a RD-20 é preservação POR OMISSÃO, conferida no código, e o CT-1097 ancora o arranjo ANTES da passagem (sem o que a preservação seria verdade vazia); o CT-1064 discrimina a escrita parcial pela releitura em CONEXÃO NOVA depois do rollback; o marcador tem os quatro campos e o REVERTER EXIGE é verificável; e o determinismo foi julgado por ESTRUTURA — os offsets usados são -5,-7,-9,-30,+20,+365, nenhum 0 nem ±1, de modo que a virada de dia não muda desfecho`
- `[T5] ⚠️ o QA CORRIGIU o executor por uma ordem de grandeza: os acessórios `tentar` e `sqlstate` têm 13 e 12 cópias em packages/db/test/, não 2. O Limiar de Três disparou há muito, e o próprio repositório já o mediu por escrito em boleto-da-cobranca.spec.ts:1827. A declaração de "duas cópias" só vale para `portao` e a sondagem de pg_stat_activity`
- `[T5] o QA confirmou que a T5 IMPORTOU corretamente as quatro casas que se aplicavam (bancoEfemero, semearCobrancaDoZero e emUnidadeSobContexto — as duas últimas criadas pela T4 — e varredura-de-fontes) — nenhuma foi recopiada`
- `[T5] o QA registrou uma RESSALVA de precisão que NÃO virou achado: esperarSessaoBloqueada conta QUALQUER sessão com wait_event_type='Lock', sem escopar pelo pid — molde herdado do CT-407 de contrato.spec.ts, fora do escopo. Fica para quem escrever a terceira sondagem`
- `[T5] Tech Review (opus) rodada 1: APROVADO_COM_OBSERVACOES — P1 BAIXO/scope_deviation e P2 BAIXO/code_quality, os dois anotáveis. NENHUM bloqueante`
- `[T5] TR consultou: ADR-0021, ADR-0008, ADR-0022, ADR-0026, ADR-0011, ADR-0024, ADR-0033`
- `[T5] os SETE pontos que mandei julgar passaram, e TRÊS o TR mediu em vez de aceitar: (1) a enumeração dos escritores do par é EXAUSTIVA — só DOIS pontos escrevem imovel.status_locacao no produto inteiro, e o que fecha o caso do cancelamento é o índice único PARCIAL sobre status='ATIVO' combinado com ESTADO_CANCELAVEL='ATIVO'; (2) `type` em vez de `interface` é tecnicamente necessário — ResumoDaPassagem é z.record(z.string(), z.number()); (3) o marcador DECISÃO FECHADA é da natureza certa: PROTEGE, tem REVERTER EXIGE e não QUANDO FECHA`
- `[T5] TR julgou "preservar por omissão" a forma ROBUSTA, não a frágil: diante de um quarto valor de status_locacao o default é preservar; a alternativa (!== INDISPONIVEL e liberar) converteria o valor novo em DISPONIVEL em silêncio`
- `[T5] TR registrou, sem cobrar nesta task, uma propriedade TRANSVERSAL para a T6 dimensionar: não há statement_timeout nem lock_timeout em produção em lugar algum, e o UPDATE da porta estreita NÃO tem SKIP LOCKED — ele ESPERA. É preexistente, não introduzida aqui; a primeira passagem sobre backlog histórico é o cenário a dimensionar quando a borda existir`
- `[T5] TR registrou divergência de vocabulário na spec, sem achado: tech_spec.md:1204 escreve "ignorados" onde a RD-20 e a task escrevem "preservados". Arquivo fora do escopo — não corrigir a partir dali`
- `[T5] P2 (BAIXO/code_quality) PAGO no fecho, não anotado: o docblock declarava a atomicidade do PAR, e a real é da PASSAGEM INTEIRA. Uma oração, sem código. A razão de pagar em vez de anotar é que a T6 é a PRÓXIMA task e é exatamente ela quem seria enganada — um autor que leia só o docblock desenharia retentativa com progresso parcial que o código não entrega, e o defeito só apareceria sob falha real em produção`
- `[T5] fecho aplicado: o alcance do desfazimento (é a PASSAGEM, não o par, e por que o desfazimento total é SEGURO — a passagem seguinte reencontra os desfeitos pelo predicado) e a contagem "terceiro" → "quarto" chamador, com a distinção que impede a próxima rodada de "harmonizar" os números. db 265/265`
- `[T5] staged: 7 paths · CONCLUÍDA · tasks_completed 4 → 5 · memória lazy nunca criada`
- `[T5] escrituração do CLAUDE.md feita pelo ORQUESTRADOR: db 250 → 265 e total 1872 → 1887, com a soma dos nove pacotes conferida (438+389+267+265+159+142+89+108+30 = 1887) e a barreira executável do arquivo reconferida — pnpm --filter @sysloc/shared test 267/267 VERDE`
- `[Fase 2] ENCERRADA — T4 e T5 concluídas`

### Fase 3 — T6

- `[T6] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T6] executor: opus (declarado) · gates: [qa, tech_review] · risk: medium · sequencial (T6, T7 e T8 compartilham a composição raiz do worker)`
- `[T6] ADRs injetadas no executor: ADR-0022, ADR-0024 (com as DUAS emendas), ADR-0025, ADR-0026, ADR-0029 (fonte: task §7)`
- `[T6] baseline: worker 142 verdes`
- `[T6] executor_summary: 2 criados, 6 modificados · 5/5 CTs (6 casos) · worker 142 → 148 · pnpm build, lint e test do pacote verdes · garantias removidas: nenhuma`
- `[T6] arquivos tocados NÃO declarados: apps/worker/src/tarefas/conferencia-bancaria.ts (declarado [R] REFERÊNCIA na §5.3 — extração pura de executarConferenciaDaEmpresa), apps/worker/test/eco.spec.ts (âncora de superfície, 7 → 8 filas) e CLAUDE.md (escrituração)`
- `[T6] D49 · F4/T16 MEDIDO e NÃO disparou — regua.ts foi apenas LIDO como molde; seguem TRÊS cópias de camposRecusados e rotina-agendada.ts IMPORTA cargaConferida em vez de criar a quarta. Marcador e linha do índice preservados`
- `[T6] D21 · F4/T9 AGRAVADO, com razão ESTRUTURAL medida: a casa compartilhada packages/db/test/cenario-de-cobranca.ts (criada pela T4) foi TENTADA e é inutilizável de apps/worker/test/ — ela resolve contextoDeTenant pelo FONTE e o worker resolve @sysloc/db por DIST/, de modo que há DOIS AsyncLocalStorage e toda escrita cai em "new row violates row-level security policy". Se o QA confirmar, é fronteira estrutural do monorepo que vale registrar para as T7/T8`
- `[T6] escrituração do CLAUDE.md feita pelo EXECUTOR: worker 142 → 148 e total 1887 → 1893, com a soma conferida pelo orquestrador (438+389+267+265+159+148+89+108+30 = 1893)`
- `[T6] QA (opus) rodada 1: REJEITADO — 1 CRÍTICO/architecture (REGRESSÃO), 1 ALTO/tests (tautological_assertion), 1 BAIXO. criterios 9/11 (CA-02 e §4 item 10 PARCIAIS)`
- `[T6] antipadroes_verificados: 2/2 arquivos de teste · red_flags: ["remover_uma_assertion_deixa_o_teste_verde"] · determinismo: ok`
- `[T6] attempt_count: 0 → 1 · last_severity: CRITICO · attempt_sha (rodada 2)=7f9b69df2c7d6852af11fc4ce1788e8a04a8e5a8`

⚠️ **O CRÍTICO é REGRESSÃO PELO P5, e a causa é uma lição de método**: a T6 cria a **sétima** borda que
chama `contextoDeTenant.executarCom`, e **três âncoras de igualdade de `packages/db/test/` varrem o FONTE
de `apps/worker`** — `CT-624`, `CT-014` e `CT-326` ficaram vermelhas nomeando `rotina-agendada.ts`.
Reproduzido em **duas** execuções (`3 failed | 262 passed`). O executor mediu a baseline **só do pacote
`worker`**, e os comentários das próprias âncoras **antecipam literalmente o caso**: *"um sétimo chamador
segue reprovando nominalmente"*. É a **terceira vez nesta fatia** que a §5.2 não declarou o arquivo-âncora
que a publicação faz crescer (T4, T5 e agora T6) — o candidato a regra já está escrito.

- `[T6] o ALTO é AP-29 demonstrado POR EXECUÇÃO: a EXIGENCIA_DA_CARGA já contém as cadeias "empresaId" e "rotina" literalmente, de modo que toContain sobre a razão inteira passa mesmo com camposRecusados vazio — e mesmo nomeando o campo ERRADO. Com o mutante, 4 das 5 cargas seguem verdes. E ela OCUPA O LUGAR da prova que a T2 §3 delegou nominalmente a esta task: nenhum teste do repositório exercita esquemaDaCargaDaRotinaAgendada`
- `[T6] os QUATRO pontos substantivos PASSARAM, e as TRÊS decisões fora de escopo tiveram o mérito confirmado — a extração de executarConferenciaDaEmpresa foi conferida LINHA A LINHA contra o base_sha`
- `[T6] as DUAS medições de débito do executor foram VERIFICADAS e são verdadeiras. A do D21 é FRONTEIRA ESTRUTURAL do monorepo, e vale para T7/T8: packages/db/test/unidade-sob-contexto.ts importa ../src/contexto.ts (FONTE), enquanto packages/db/package.json publica exports para ./dist/index.js e apps/worker/vitest.config.ts não declara alias — de apps/*/test/ a casa carregaria um AsyncLocalStorage DISTINTO do que o SUT usa`

⚠️ **AVISO DE FATIA levantado pelo QA, que NÃO é da T6 e precisa de decisão até a T11**: `AVISO_DE_COBRANCA`
é `RotinaPublicada` com cadência `A_CADA_MINUTO` e limiar de 15 min, mas `apps/worker/src/tarefas/regua.ts`
**não chama** `registrarExecucaoDeRotina`, e o tech spec declara aquele arquivo *"inalterado"* na fatia. Se
nada gravar o registro dela, **a vigilância marcará `AVISO_DE_COBRANCA` como atrasada permanentemente em
produção** — que é exatamente o *"alerta que dispara para tudo"* que o docblock de `vigiarAsRotinas` existe
para evitar. A T6 implementa fielmente o que a spec manda. **Alvo: a T8 (que traz o produtor da régua) ou o
fecho da fatia.**
- `[T6] correção rodada 2: P1 (regressão) e P2 (AP-29) fechados; P3 e a nota opcional do CT-1086 feitos junto. worker 142 → 152 · db 265 VERDES · shared 267 · api 389 · cobranca-bancaria 108 · build e lint verdes`
- `[T6] ⚠️ o executor achou uma QUARTA ocorrência do elenco que o QA NÃO relatou, e só apareceu ao rodar: o controle antivácuo toHaveLength(8) em fonte-unica-do-estado.spec.ts:1086, que subiu para 9. A contagem exata continua AO LADO da igualdade de lista — não virou contenção`
- `[T6] ⚠️ o executor CORRIGIU um fato do relatório do QA: a carga {} recusa OS DOIS campos (['empresaId','rotina']), não só empresaId, porque strictObject emite um problema por chave ausente. "O esperado declarado é o medido, não o presumido"`
- `[T6] a lição do P1 foi incorporada e declarada pelo executor: medir TODO pacote cujas âncoras varrem o fonte tocado — ele mediu cinco nesta rodada`
- `[T6] QA (opus) rodada 2, DELTA: APROVADO — zero problemas, 11/11 critérios. worker 152, db 265 (os três vermelhos VERDES), shared 267`
- `[T6] ledger rodada 2: QA-CRIT-001 aberto → corrigido · QA-ALTO-001 aberto → corrigido · QA-BAIXO-001 aceito_como_debito → corrigido`
- `[T6] o QA RECONHECEU POR ESCRITO a própria lacuna da rodada 1: a quarta ocorrência escapou porque ele "inventariou as três LISTAS de bordas e não o segundo eixo interno do CT-624, que só se manifesta ao executar"`
- `[T6] o QA CONFIRMOU a correção de fato do executor e admitiu o erro: a carga {} recusa OS DOIS campos, e "o esperado declarado é o medido"`
- `[T6] o QA verificou o critério de pronto do AP-29 por MEDIÇÃO — com camposRecusados mutilado, as CINCO cargas reprovam — e julgou a escolha de comparar as cinco DE UMA VEZ mais forte que o laço, "que reprovaria na primeira e esconderia as outras quatro"`
- `[T6] o QA varreu se havia QUINTA ocorrência pendente de elenco de bordas no repositório: não há`
- `[T6] escrituração: worker 148 → 152 e total 1893 → 1897, soma dos nove pacotes conferida por mim e pelo QA. A da rodada 1 está marcada como defasada no próprio arquivo, no molde dele`
- `[T6] Gate 2 despachado com scan_scope FULL — a rejeição da rodada 1 foi do Gate 1, logo o Tech Review nunca viu esta task`
- `[T6] Tech Review (opus) rodada 2 (PRIMEIRA passagem dele, FULL): PARCIAL — P1 ALTO/architecture e P2 MEDIO/architecture (BLOQUEANTES), P3/P4 BAIXO (anotáveis)`
- `[T6] TR consultou: ADR-0024, ADR-0022, ADR-0023, ADR-0025, ADR-0026, ADR-0029`
- `[T6] attempt_count: 1 → 2 · auto-escalate: opus[xhigh] · attempt_sha (rodada 3)=3a448451a439ccbf577da04ba66976224b02b3d5`
- `[T6] retry classification: bloqueantes [P1 ALTO/architecture, P2 MEDIO/architecture] · architecture está em revalidation_required · requires_qa_revalidation: TRUE`
- `[T6] convergência: NÃO se aplica — veredito da rodada 2, e ALTO não converge em rodada nenhuma`

⚠️ **O P1 é defeito FUNCIONAL real, e NENHUM dos dois gates anteriores tinha como pegá-lo** — o QA não lê
diff nem persegue modo de falha de recuperação. `abrirConferencia` commita em unidade própria **antes** de
a passada correr; se a passada levanta, a linha fica `concluida_em IS NULL` **para sempre**, e o índice
único parcial não tem janela de obsolescência, timeout nem varredura de recolhimento. **Três caminhos
degradam em silêncio**: a repetição da tarefa lê a própria carcaça como *"outra está trabalhando"* e
termina **`completed`**; toda passagem diária seguinte faz o mesmo; e **a rota manual do Admin também não
enfileira**. Uma falha transitória mata a conferência diária daquela empresa de forma permanente e verde —
**dinheiro recebido que deixa de ser baixado, sem uma linha vermelha em lugar nenhum**. O discriminador que
falta já existe no arquivo irmão: `ehReentrada(tarefa)`.

- `[T6] a metade (b) do P1 — conferência abandonada por ESGOTAMENTO de repetições — NÃO cabe na T6 (packages/db/src/conferencia-bancaria.ts está fora do escopo). Endereçada à T11`
- `[T6] os CINCO pontos que mandei julgar foram APROVADOS, e o TR conferiu a extração POR CONTA PRÓPRIA (diferença de conjunto sobre o diff: só somem linhas estruturais, nenhuma garantia)`
- `[T6] TR verificou que o gatilho do D38 · F5/T8 NÃO disparou: o QUANDO FECHA fala em "terceiro ponto de fiação NÃO PROVADO", e o bloco da T6 não CONSTRÓI porta alguma e tem os quatro campos obrigatórios — o compilador prova a fiação`
- `[T6] TR julgou a fronteira dist/fonte LEGÍTIMA e não defeito de configuração: um alias @sysloc/db → src/ faria a suíte do worker exercitar um grafo que a produção nunca carrega E desarmaria em silêncio a guarda SIMBOLOS_ESPERADOS`

⚠️ **VEREDITO DO GATE 2 sobre o `AVISO_DE_COBRANCA`: é a T8, não a T11.** Medido: `registrarExecucaoDeRotina`
tem exatamente **dois** chamadores no repositório inteiro, os dois em `rotina-agendada.ts`, e nenhum grava o
aviso. O enquadramento que decide: o `tech_spec.md` §RD-15 **já declara** o predicado da régua por extenso e
o docblock de `execucao-de-rotina.ts:40-46` o repete — **não falta decisão, falta o chamador**.
**Ação para a T8**: acrescentar `apps/worker/src/tarefas/regua.ts` à §5.2 dela (hoje ele não está na §5.2 de
task nenhuma), chamando `registrarExecucaoDeRotina(tx, { rotina: 'AVISO_DE_COBRANCA', resumo })` sob o
predicado da RD-15, na unidade da própria régua. ⚠️ **E o `tech_spec.md` declara `regua.ts` `[R]/inalterado`
em três pontos (linhas 157, 517, 518) — é o texto do spec que está errado, não o código: a RD-15 e essa
marcação não podem ser as duas verdadeiras.** Razão de não deixar para a T11: entre T6 e T11 correm a T9
(instala os timers) e a T10 (publica a leitura do Admin), e fechar só na T11 aceitaria a T10 com um item
permanentemente vermelho na própria tela que ela publica.

- `[T6] nota do TR para o fecho: o task_plan.md linha 122 diz que o CLAUDE.md é tocado por "T7, T8, T10 e T11" — a T6 também o tocou, por obrigação da regra de escrituração. É a linha do plano que está incompleta`
- `[T6] correção rodada 3 (opus[xhigh]): P1 fechado PELO PREDICADO, não por log — conferirAsLiquidacoes discrimina as duas causas de iniciadaAgora:false pelo ESTADO DA TAREFA; na primeira ativação o no-op permanece (concorrência real), na REENTRADA a passada é refeita. ehReentrada publicado como segundo chamador de PRODUÇÃO. P2 fechado: OrigemDaConferencia ganhou `fila`, e o literal saiu de dentro da execução compartilhada. P4 fechado: casa criada com marcador D11 · F5/T6`
- `[T6] ⚠️ a rede do P1 reprova NOMEANDO A CAUSA, e o executor teve de reordenar para isso: a primeira versão reprovava na âncora antivácuo ("esperava mais de 1 consulta" — o SINTOMA); reordenada, o mutante produz `expected { total: 1, concluidas: +0 } to deeply equal { total: 1, concluidas: 1 }` — a linha aberta e nunca fechada, que é exatamente o estado que trava a empresa`
- `[T6] ⚠️ o executor DIVERGIU da prescrição do Gate 2 e declarou: o TR sugeriu `error` para a reentrada, ele implementou `warn` com SUT_IS_CORRECT_BECAUSE — "a reentrada é recuperação EM CURSO, não falha terminal; reservar `error` para a rotina PARADA é o que impede o canal de virar o alerta que dispara para tudo", citando decisão já registrada no docblock de vigiarAsRotinas`
- `[T6] ⚠️ o executor CORRIGIU a contagem do Gate 2: são SETE declarações locais de emUnidade em apps/worker/test/, não seis`
- `[T6] D11 · F5/T6 EMITIDO — as três pontas fechadas: marcador em acessorios-de-borda.ts:43, linha no índice do CLAUDE.md (38 → 39, com o contador do parágrafo acompanhando) e o bloco ### D11 na §2, escrito pelo ORQUESTRADOR (o executor declarou que a terceira ponta não lhe cabia, e estava certo)`
- `[T6] D12 e D13 escriturados na §2 e ENDEREÇADOS À T11: a metade (b) do P1 (conferência abandonada por ESGOTAMENTO segue irrecuperável — sem ativação não há reentrada) e a emenda do QUANDO FECHA do D21, cuja prescrição a medição da T6 refutou`
- `[T6] escrituração: worker 152 → 153, total 1897 → 1898, soma conferida`

⚠️ **RELATO DE HONESTIDADE do executor, passado ao QA para avaliação**: uma execução isolada divergiu
(`1 failed | 152`) logo após uma edição e **não reproduziu** — 3 execuções verdes depois, mais 2 nas
verificações finais. Hipótese dele: cache de transformação do Vite servindo o arquivo pré-edição, já que a
falha era **exatamente a asserção que ele acabara de corrigir**. Ele **não a deu por fechada com certeza**
e a registrou para que outra ocorrência não seja lida como novidade. Mandei o QA rodar a suíte e reportar
se observa instabilidade.
- `[T6] QA (opus) rodada 3, DELTA: REJEITADO — 1 ALTO/tests (happy_path_only, AP-16) INÉDITO. 11/11 critérios, e CINCO pacotes medidos: worker 153, db 265 VERDES, shared 267, api 389, cobranca-bancaria 108`
- `[T6] ledger rodada 3: TR-P1 aberto → corrigido · TR-P2 aberto → corrigido · TR-P4 aceito_como_debito → corrigido · QA-CRIT-001 e QA-ALTO-001 (rodada 1) RE-VERIFICADOS e sanados`
- `[T6] o QA confirmou as TRÊS conferências do TR-P1: o no-op segue INTACTO na primeira ativação (só a condição foi estreitada); ehReentrada publicado NÃO é seam (3 chamadas, TODAS de produção, ZERO em teste); e a rede DISCRIMINA e NOMEIA A CAUSA — "concluidas: 0 É o estado que trava a empresa pelo índice único parcial, e não um sintoma lateral". Ele elogiou a reordenação`
- `[T6] o QA VALIDOU a divergência do executor sobre warn × error: "é o precedente do CLAUDE.md aplicado com declaração e medição… igualar os dois níveis apagaria a distinção que o CT-1086 prova". E confirmou que warn continua visível ao operador — não houve rebaixamento para info`
- `[T6] o QA CONFIRMOU a contagem do executor contra a do Gate 2: são SETE declarações de emUnidade, e os dois números se conciliam — 7 existentes, das quais 6 seguem cópia privada e 1 passou a delegar`
- `[T6] as TRÊS PONTAS do D11 conferidas pelo QA: marcador vivo, linha no CLAUDE.md:461, bloco ### D11 na §2 (linha 236). O índice bate nas duas pontas: o texto diz 39 e a tabela tem 39 linhas`
- `[T6] a INSTABILIDADE relatada pelo executor NÃO REPRODUZIU: o QA rodou duas execuções completas e independentes, 153/153 nas duas. Somadas às 5 dele, são SETE verdes consecutivas contra UMA divergência isolada. A hipótese do cache do Vite é compatível e não é falsificável agora — registrada a NÃO-REPRODUÇÃO, sem achado de determinismo`
- `[T6] attempt_count: 2 → 3 · ⚠️ a §A2 da autonomia-do-run.md é literal: o limite de 3 tentativas NÃO bloqueia o run, e itera-se até não restar bloqueante. O que fecha a torneira é a Convergência — mas ela NÃO alcança ALTO, em rodada nenhuma`
- `[T6] convergência (rodada 4): o bloqueante é ALTO/tests, que NÃO converge. Segue bloqueando`

⚠️ **O ALTO desta rodada é INÉDITO e nasceu da PRÓPRIA correção** — é o fenômeno que a regra da
convergência nomeia. A condição do ramo passou de `if (!conferencia.iniciadaAgora)` para
`if (!conferencia.iniciadaAgora && !ehReentrada(origem))`: o lado da **reentrada** ganhou rede, e o outro
lado do discriminador — **primeira ativação encontrando apuração em andamento, que é a concorrência de
verdade** — ficou sem companheiro. Medido pelo QA: **apagar o ramo inteiro deixa toda a suíte verde.** É a
§7 do Protocolo Antirregressão pelo nome — *"provou-se o que era fácil provar"*, deixando sem asserção a
combinação de entradas que discrimina. ⚠️ O QA registrou que o dano de perder a guarda é **degradação, não
corrupção** (o índice único parcial impede a segunda conferência e as portas são idempotentes) — mas o ramo
é código **novo** da task, e a R2 é o modo de falha silencioso.
- `[T6] correção rodada 4: CT-1085 (c) — acréscimo puro, nenhuma linha de produção tocada. worker 142 → 154, ESTÁVEL em 3 execuções consecutivas`
- `[T6] ⚠️ o executor REFUTOU a MINHA prescrição por medição, de novo: eu mandei afirmar attemptsMade === 0 e o valor real é 1 — o teste reprovou nele. Razão escrita no ponto: o 0 do docblock de ehReentrada descreve o job ENTREGUE ao processador; o objeto relido de getJob() DEPOIS do término já contabiliza a tentativa bem-sucedida. 1 é "uma tentativa, nenhuma repetição", coerente com o (b), que mede > 0 sobre o mesmo contador porque lá a leitura acontece após duas`
- `[T6] o executor fez o esperado RELATIVO ao estado capturado, e não absoluto, porque a empresa da carga inicial é compartilhada com o CT-1085 — número fixo faria o caso depender da ordem de execução do arquivo`
- `[T6] ele acrescentou por conta própria a asserção de que a linha da REENTRADA não existe: "é ela que apareceria se o && fosse invertido, e o contador sozinho não distinguiria os dois ramos"`
- `[T6] ⚠️ o item 5 das Pendências dele é FALSO NEGATIVO: a terceira ponta do D11 (o bloco ### D11 na §2) JÁ EXISTE — eu a escrevi antes da rodada 3, e o QA a conferiu na rodada 3 (linha 236). Ele não tinha como saber`
- `[T6] QA (opus) rodada 4, DELTA: APROVADO_COM_OBSERVACOES — 1 BAIXO/tests (test_order_dependency), REBAIXADO DE PROPÓSITO de ALTO com três razões medidas. worker 154/154, shared 267/267`
- `[T6] ledger rodada 4: QA-r3-ALTO-001 aberto → corrigido. O QA mediu que apagar o ramo agora reprova em CINCO asserções independentes`
- `[T6] ⚠️ o QA ARBITROU a divergência a favor do EXECUTOR e contra a MINHA prescrição: attemptsMade vale 1, e — o que mais importa — 1 NÃO é ambíguo entre os ramos. "Uma reentrada exige que a primeira ativação tenha FALHADO (contador → 1 no failed) e que a segunda tenha rodado (→ 2 ao concluir); logo, na leitura pós-término, ativação única ⇒ exatamente 1, reentrada ⇒ ≥ 2"`
- `[T6] o QA validou o esperado RELATIVO e o controle antivácuo que o sustenta (pagasAntes.filter(...) === []), "que é o que impede a igualdade de passar por vacuidade"`
- `[T6] o QA julgou LEGÍTIMA e não redundante a asserção que o executor acrescentou por conta própria: ela "aponta o ramo errado diretamente em vez do sintoma", e é o par simétrico da asserção positiva do (b)`
- `[T6] o QA registrou que o LEDGER estava defasado em duas linhas e as re-verificou por leitura direta — "quem atualiza o ledger é o orquestrador, não o gate". Corrigido por mim nesta passagem`
- `[T6] estabilidade: 5 execuções verdes consecutivas (2 do QA + 3 do executor). A divergência isolada da rodada 3 NÃO reproduziu`
- `[T6] escrituração: worker 153 → 154, total 1898 → 1899, soma conferida por mim e pelo QA`
- `[T6] ⚠️ o QA marcou determinismo_observado: "suspeito" DELIBERADAMENTE — não por instabilidade observada (as 5 execuções foram idênticas), mas "para não deixar o achado invisível neste campo". É uso honesto do campo`
- `[T6] Tech Review (opus) rodada 4, DELTA: APROVADO — zero problemas`
- `[T6] TR consultou: ADR-0024 (com as DUAS emendas), ADR-0025, ADR-0029, ADR-0022`
- `[T6] ⚠️ o TR ACEITOU AS DUAS DIVERGÊNCIAS e reconheceu que a prescrição dele estava PIOR: sobre o warn × error — "a minha sugestão de rodada 3 estava pior que o implementado", com um efeito que ele não havia considerado (reusar error borraria os dois canais e tornaria a asserção do CT-1086 ambígua). Sobre a contagem — "a minha contagem estava errada; a correção do executor procede" (7, não 6)`
- `[T6] o TR rodou a checagem §3-B nos DOIS sentidos sobre o repositório INTEIRO e ela está limpa: nenhuma linha do índice sem marcador vivo, nenhum marcador canônico sem linha`
- `[T6] o TR concordou com o rebaixamento do AP-08 e verificou as três razões de forma INDEPENDENTE, acrescentando a nuance que torna o débito digno de pagamento: "o que o (c) deixa é um TRAVAMENTO, não sobra de dado — um caso futuro sobre EMPRESA_A cairia no ramo do no-op e poderia passar VAZIO"`
- `[T6] RESIDUAL registrado pelo TR e deliberadamente NÃO convertido em achado: na reentrada, abrirConferencia pode devolver a conferência de um pedido CONCORRENTE do Admin em vez da que a ativação anterior deixou. O desfecho continua benigno (comReentranciaBenigna absorve a conclusão dupla e conferirCobrancas é idempotente, ADR-0034), e fechar a janela exigiria mecanismo de trava novo, que a RD-13 PROÍBE por escrito. É vizinha da varredura de recolhimento já endereçada à T11 (D12)`
- `[T6] ledger: 9 achados totais | 6 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`

⚠️ **A métrica da T6 é a mais eloquente do run até aqui, e vale ler com cuidado**: dos **6** achados de
rodada > 1, **4** são a primeira passagem do Tech Review (que só olhou na rodada 2, porque a rejeição da
rodada 1 foi do Gate 1) e **2 nasceram das PRÓPRIAS correções** — o `ALTO` da rodada 3 apareceu porque a
correção estreitou uma condição e deixou o outro lado do `&&` sem rede, e o `BAIXO` da rodada 4 apareceu
porque o caso que fechou aquele deixa estado. **Nenhum é resíduo de varredura falha da rodada 1.** É
exatamente o fenômeno que a regra da convergência nomeia — *"o achado novo é quase sempre superfície que a
própria correção criou"* —, e a T6 é o caso mais claro do run.

- `[T6] staged: 11 paths · CONCLUÍDA · tasks_completed 5 → 6 · memória lazy deletada`

### Fase 3 — T7

- `[T7] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T7] executor: opus (declarado) · gates: [qa, tech_review] · risk: HIGH (remoção de arquivo com contenção de travessia de caminho e ligação simbólica) · sequencial`
- `[T7] ADRs injetadas no executor: ADR-0024 (com as DUAS emendas), ADR-0025, ADR-0030, ADR-0031 (fonte: task §7)`
- `[T7] baselines: worker 154 · cobranca-bancaria 108 · db 265 · shared 267`
- `[T7] ⚠️ esta task FECHA o D26 · F4/T9 (emissao-e-conciliacao) — marcador e linha do índice saem no MESMO commit, e o gatilho literal dele é "a F5, que traz o agendamento"`
- `[T7] executor_summary: 2 criados, 9 modificados · 10/10 CTs · worker 154 → 159 · cobranca-bancaria 108 → 113 · os outros SETE pacotes medidos e intactos · build e lint limpos`
- `[T7] ✅ DÉBITO FECHADO: D26 · F4/T9 (emissao-e-conciliacao) — o gatilho literal era "a F5, que traz o agendamento", e a F5 é esta. Marcador e linha do índice removidos no mesmo commit (índice 39 → 38, contador do parágrafo acompanhando), com o fecho registrado na §2 do run-report da fatia de origem`
- `[T7] ✅ DÉBITO FECHADO junto: D32 · F4/T9 — por depender do marcador removido; o expurgo varre por idade SEM filtro de nome e alcança o `.parcial` órfão`
- `[T7] escrituração feita pelo ORQUESTRADOR: total 1899 → 1909 (worker 159, cobranca-bancaria 113), soma dos nove pacotes conferida, e a barreira executável REconferida — pnpm --filter @sysloc/shared test 267/267 VERDE, o que prova as duas pontas do índice por fs`
- `[T7] três decisões de design declaradas para o Gate 2 não as reconstruir: (1) o corte conta DIAS INTEIROS TRUNCADOS, não instantes crus — comparar instantes poria a borda de 90d à mercê dos milissegundos, indeterminismo em operação DESTRUTIVA; (2) o expurgo reconhece TUDO antes de remover QUALQUER coisa — fase única deixaria o acervo meio expurgado; (3) a borda do cru no CT-1088 é 90d menos 5 min, não 90 exatos, porque now() é transaction_timestamp() e o arranjo carimba numa transação e a tarefa avalia noutra`
- `[T7] ⚠️ o executor MEDIU o item (3) na primeira execução e concluiu que o SUT estava correto e o ARRANJO é que escolhera uma borda inobservável — é a disciplina do P5 aplicada na direção certa (corrigir o teste com razão, não o SUT)`
- `[T7] D52 · F4/T16 MEDIDO e NÃO disparou: a perna estática nova ficou dentro de apps/worker/test/ e REUSA varrerArquivos de packages/db/test/ em vez de copiar o molde`
- `[T7] arquivos tocados NÃO declarados: packages/cobranca-bancaria/test/reemissao.spec.ts e apps/api/test/notificacao-bancaria.e2e.spec.ts (dublês arrastados pela mudança de assinatura de GuardaDeBoletos — Iron Rule #3) e packages/db/test/unidade-de-trabalho.spec.ts (âncora CT-326 estendida)`
- `[T7] QA (opus) rodada 1: APROVADO_COM_OBSERVACOES — 10/10 critérios, 3/3 CTs, CINCO pacotes medidos e verdes (cobranca-bancaria 113, worker 159, db 265, shared 267, api 389). 1 BAIXO/documentation`
- `[T7] antipadroes_verificados: 5/5 arquivos de teste tocados · determinismo: ok · zero antipadrões detectados`
- `[T7] as TRÊS pontas do D26 conferidas pelo QA e fechadas; o D32 também, e ele NUNCA teve linha no índice (o "Onde" dele era o campo O QUÊ do marcador do D26). O CT-907 do shared prova as duas pontas por fs`
- `[T7] o QA VERIFICOU no código a afirmação substantiva do fecho do D32, em vez de a aceitar: expurgarBoletosVencidos varre readdir da base SEM filtro de nome e classifica por mtime, de modo que o órfão .parcial é alcançado pela mesma passagem`
- `[T7] contenção de RISCO ALTO julgada SÓLIDA e com asserções que DISCRIMINAM: o CT-1087 (c) planta o vínculo apontando para o vizinho do diretório PAI e afirma os TRÊS lados (recusa levantada, alvo de fora intacto byte a byte, acervo INTEIRO ainda na base), com o vínculo deixado RECENTE de propósito para que a recusa não seja creditada à idade`
- `[T7] o BAIXO/documentation foi PAGO por mim no fecho: a frase dos débitos homônimos deixou de dizer "dois D26", com a nota do fecho e o "não o reponha". A barreira executável foi RECONFERIDA — 267/267`
- `[T7] ⚠️ o QA registrou que o resto daquela sentença JÁ estava defasado antes desta task (diz "dois D28" havendo um só; omite D23 e D43, que hoje têm dois cada) — é PRÉ-EXISTENTE e não é regressão da T7. Fica para o fecho da fatia`

**Duas ressalvas que o QA registrou sem converter em achado, e que o Gate 2 vai arbitrar:**
1. o poder de detecção do `CT-1087 (c)` depende da **ordem do `readdir`** — contra a implementação real o
   caso é determinístico e sempre verde; o que fica probabilístico é só a detecção do mutante;
2. a perna da **chamada** do `CT-1088 (b)` não teve mutante executado — o QA conferiu **por leitura** que
   remover a chamada leva `ocorrencias` a 0, e declarou que *"a demonstração dessa perna é de raciocínio,
   não de execução"*.
- `[T7] Tech Review (opus) rodada 1: PARCIAL — P1 MEDIO/testability (BLOQUEANTE) e P2 BAIXO/project_pattern (anotável)`
- `[T7] TR consultou: ADR-0024 (com as DUAS emendas), ADR-0025, ADR-0030, ADR-0031`
- `[T7] os SEIS pontos submetidos ao julgamento dele PASSARAM: o gatilho do D26 foi satisfeito e NÃO esticado ("que o timer só nasça na T9 não estica o gatilho: o débito era 'não há expurgo', e agora há"); as duas fases são a decomposição certa; a extração foi conferida LINHA A LINHA e nada saiu; as três decisões de design se sustentam; a composição raiz respeita a ADR-0025 e fica estendível; e a unidade abre sem empresaId com prova NOMINAL`
- `[T7] o TR foi ALÉM da conformidade na ADR-0024: "a execução está FORA DO ALCANCE da ADR, e não em exceção a ela" — porque a resposta a "quem tinha direito a este identificador" é "ninguém, nunca"`
- `[T7] o TR elogiou uma decisão que eu não havia nomeado: a LEITURA ÚNICA DO RELÓGIO antes do laço, que fecha um terceiro modo de falha (dois arquivos de idade idêntica caindo em lados diferentes do corte conforme a duração da varredura)`
- `[T7] o TR registrou que o SUT_IS_CORRECT_BECAUSE NÃO era exigível na borda de 90d menos 5 min, porque o caso NASCEU nesta task e não é teste preexistente que ficou vermelho`
- `[T7] o TR CONCORDOU com as duas ressalvas do QA e acrescentou que os TRÊS controles de não-cegueira do CT-1088 (b) "fecham as mesmas vacuidades que o mutante fecharia, e são executados SEMPRE — o que é mais forte do que uma demonstração feita uma vez e não repetida"`
- `[T7] attempt_count: 0 → 1 · attempt_sha (rodada 2)=7dadd56ddd5ab41791b40646336cc1fae226b890 · requires_qa_revalidation: TRUE (testability)`

⚠️ **O P1 é fino e importa: a propriedade que SUSTENTA o fecho do `D32` não tem caso.** O docblock eleva a
cobertura do órfão `.parcial` a propriedade declarada, e a §2 da fatia de origem fecha o débito **sobre
exatamente essa afirmação** — mas `grep` por `parcial` na suíte devolve **zero**, e todas as asserções de
conjunto usam **só nomes `.pdf`**. É **a regressão que o `D32` previu, com o caminho invertido**: o débito
temia uma varredura de `COB-*.pdf`; hoje ela não filtra, mas **o convite a "endurecê-la" está no mesmo
módulo** (`EXTENSAO_DO_BOLETO` e `SUFIXO_PARCIAL` já existem), e a suíte continuaria verde com o débito
**fechado no papel**.

- `[T7] IDIOMA PREEXISTENTE levantado pelo TR e NÃO atribuído à T7: nove pontos do repositório citam a ADR-0024 como "terceira emenda", e ela tem DUAS — SETE deles anteriores a esta task. O TR registrou que seguir o idioma da casa foi o comportamento CERTO sob a proibição 5. Se merecer correção, é intervenção dirigida repo-wide`
- `[T7] correção rodada 2: P1 fechado pelo CT-1087 (f), aditivo e sem tocar produção — o acervo passa a incluir um órfão .parcial VENCIDO e um RECENTE, e a asserção que discrimina é o PAR (contagem 2 + igualdade do conjunto remanescente). P2 fechado pela alternativa mínima: renomeação + D15 · F5/T7 nas três pontas`
- `[T7] ⚠️ o executor fechou uma CLASSE, não um filtro: "filtro por extensão derruba a contagem para 1 e deixa o órfão vencido na base; remoção indiscriminada de .parcial leva o RECENTE e quebra a igualdade de conjunto"`
- `[T7] decisão de método declarada: a forma do órfão foi escrita À MÃO, "nunca composta de EXTENSAO_DO_BOLETO + SUFIXO_PARCIAL, que são privados — derivá-la poria expectativa e artefato sob a MESMA AUTORIA"`
- `[T7] ⚠️ ele JUSTIFICOU não publicar em @sysloc/shared nesta rodada, e a razão é de método: "exige editar dois arquivos de produção fora da lista da task e rodar api e db inteiros numa rodada de correção declarada ADITIVA — superfície de regressão desproporcional a um literal, com a proibição 5 pesando contra. O que a rodada podia fazer sem alargar escopo era tornar as três cópias detectáveis por UM identificador, que é o mecanismo do Limiar de Três"`
- `[T7] D15 · F5/T7 emitido nas TRÊS pontas pelo próprio executor (marcador, índice do CLAUDE.md, §2 do run-report). Índice de volta a 39 marcadores / 39 linhas`
- `[T7] escrituração: cobranca-bancaria 113 → 114, total 1909 → 1910, soma conferida (438+389+267+265+159+159+89+114+30 = 1910)`
- `[T7] ⚠️ o executor NOTOU que a escrituração fora atualizada na árvore por OUTRO agente entre as rodadas (eu, 1899 → 1909) e somou apenas o delta dele, sem tocar a narrativa alheia — conduta certa`
- `[T7] QA (opus) rodada 2, DELTA: APROVADO_COM_OBSERVACOES — 2 BAIXO/documentation, os dois de PRECISÃO DE REDAÇÃO. cobranca-bancaria 114/114, shared 267/267`
- `[T7] ledger rodada 2: TR-P1 aberto → corrigido · TR-P2 aceito_como_debito → corrigido (fechado pela alternativa mínima)`
- `[T7] o QA ENUMEROU as decisões por nome instaláveis em reconhecerVencidos e confirmou que as QUATRO plausíveis reprovam (lista branca .pdf, exclusão de .parcial, remoção indiscriminada de .parcial, filtro por prefixo COB-) — "a classe que o D32 nomeou está fechada pelas duas pontas"`
- `[T7] o QA achou UMA decisão por nome que SOBREVIVE (lista branca de {.pdf, .parcial} + idade) e a julgou BENIGNA no universo real, porque a guarda só compõe essas duas formas — BAIXO por precisão de redação, não por lacuna de prova`
- `[T7] o QA CONFIRMOU que a renomeação é de símbolo PRIVADO por medição: grep por "export .*MILISSEGUNDOS_POR_DIA" devolve ZERO, e o barril publica símbolo a símbolo. Valor idêntico`
- `[T7] o QA ENDOSSOU a decisão de não publicar em @sysloc/shared "mesmo sem a justificativa dele": publicar revalidaria 654 casos numa rodada de correção declarada aditiva, por um literal de valor idêntico`
- `[T7] ⚠️ o QA DECLAROU um desvio da Camada 7 em vez de o esconder: não rodou a suíte integralmente (instrução minha), e registrou a razão — mudança de produção é renomeação de constante privada com raio de impacto PROVADAMENTE VAZIO, e o caso novo é aditivo. É uso honesto do campo`
- `[T7] o QA achou uma TERCEIRA cópia em teste da constante (packages/db/test/derivacao-de-contrato.spec.ts:667), que já usa o nome canônico — e é a ÚNICA que aparece no mesmo grep das três de produção, logo a única que a cláusula de exclusão, lida ao pé da letra, NÃO protege`
- `[T7] Tech Review (opus) rodada 2, DELTA: APROVADO_COM_OBSERVACOES — P3 e P4 BAIXO, os dois anotáveis e os dois declarados "pagável no fecho" pelo próprio gate`
- `[T7] o TR fechou o P1 com razão MAIS FORTE que a do executor: afirmarAcervo compara por igualdade nas DUAS direções, de modo que a perna (ii) SOZINHA já discrimina os dois sentidos — filtro cai em excedentes, remoção indiscriminada cai em ausentes. A contagem === 2 é SEGUNDA rede independente`
- `[T7] ⚠️ o TR registrou que a decisão de escrever a forma do órfão À MÃO EVITOU um achado dele: derivar exigiria exportar dois símbolos privados para servir a um teste, "que é a violação da Iron Law #6 que eu classificaria como ALTO/testability". Ele conferiu a equivalência BYTE A BYTE, incluindo o nibble de versão 4 e a variante 9 do UUID literal`
- `[T7] o TR chamou o adiamento da publicação em @sysloc/shared de "a conduta certa, não a cômoda"`
- `[T7] o TR mediu o desvio da Camada 7 de forma independente e o endossou: o raio de impacto é "PROVADAMENTE vazio, e não estimadamente vazio"`
- `[T7] ⚠️ o TR nomeou a CLASSE do P4 e o precedente do repositório: "é a mesma classe de defeito que a ADR-0015 sofreu — 'todo contador sequencial deste produto é único por empresa', falsificado pelo contador bancário e superseded pela 0033". Afirmação universalmente quantificada em texto normativo, sem medição`
- `[T7] o TR registrou, sem vestir de sinal formal, que o sweep em .claude/rules/ NÃO achou regra que cubra a classe do P4 — e que o repositório já pagou por ela uma vez. Como P4 é code_quality, ele não ancora convention_drift pelo vocabulário do agente. Fica para a mineração`
- `[T7] P3 e P4 PAGOS no fecho, não anotados — os dois gates convergiram nos mesmos dois achados e os dois disseram "pagável no fecho"; são correções de redação, sem uma linha de código`
- `[T7] fecho aplicado: a cláusula do D15 passou a ser escrita EM FUNÇÃO DO MECANISMO DO GATILHO, e não de uma contagem — as duas pontas nomeiam as três e marcam QUAL o grep devolve, com a razão de as outras duas estarem listadas (para que a ausência delas na busca não seja lida como "já foram migradas"). O quantificador universal caiu nas DUAS ocorrências do docblock`
- `[T7] correção de ofício do executor: uma frase do marcador estava TRUNCADA, e ele a reescreveu para "São as três abaixo, medidas em 2026-08-23, e QUAIS elas são importa tanto quanto quantas" — que também diz melhor o que o achado era`
- `[T7] ledger: 5 achados totais | 2 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T7] staged · CONCLUÍDA · tasks_completed 6 → 7 · memória lazy deletada`
- `[T7] ✅ DOIS DÉBITOS FECHADOS nesta task (D26 · F4/T9 e D32 · F4/T9) e UM EMITIDO (D15 · F5/T7). Índice: 39 marcadores / 39 linhas`

### Fase 3 — T8 (última da fase)

- `[T8] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da`
- `[T8] executor: opus (declarado) · gates: [qa, tech_review] · risk: HIGH (segundo ponto de entrada, falha fechado na partida, enumeração de tenants SEM contexto, leitura de variáveis que carregam credencial) · sequencial`
- `[T8] ADRs injetadas: ADR-0009, ADR-0024 (com as DUAS emendas), ADR-0025, ADR-0026, ADR-0029, ADR-0032, ADR-0035 (fonte: task §7)`
- `[T8] baselines: worker 159 · db 265 · shared 267 · api 389 · cobranca-bancaria 114`
- `[T8] ⚠️ FECHA o D13 · F4/T6 (webhook-e-carne) — gatilho literal "a F5, que traz o agendamento"`
- `[T8] ⚠️ O D51 · F4/T16 JÁ DISPAROU por ela (o despachante é o TERCEIRO processo a exigir as mesmas variáveis) — está no índice do CLAUDE.md com essa marca`
- `[T8] ⚠️ E ela carrega a AÇÃO que o Gate 2 da T6 determinou: acrescentar apps/worker/src/tarefas/regua.ts à §5.2 e chamar registrarExecucaoDeRotina para o AVISO_DE_COBRANCA, sob o predicado da RD-15 — senão a vigilância o marca atrasado PERMANENTEMENTE em produção`
- `[T8] executor_summary: 2 criados, 12 modificados · 8/8 CTs (18 casos) · worker 159 → 177 · db 265, shared 267, api 389, regua 30 INTACTOS · build e lint limpos`
- `[T8] ✅ DÉBITO FECHADO: D13 · F4/T6 (webhook-e-carne) — marcador removido de notificacao-bancaria.service.ts, linha do índice removida, fecho registrado na §2 da fatia de origem. ⚠️ O OUTRO D13 · F4/T6 (emissao-e-conciliacao, em packages/db/src/boleto-da-cobranca.ts) segue VIVO e deve seguir — é o par INTEIRO repetido, o primeiro caso do repositório`
- `[T8] ✅ AÇÃO DO GATE 2 DA T6 CUMPRIDA: regua.ts passou a chamar registrarExecucaoDeRotina para o AVISO_DE_COBRANCA sob o predicado da RD-15 — sem isso a vigilância o marcaria atrasado PERMANENTEMENTE em produção`
- `[T8] D49 · F4/T16 DISPAROU e NÃO fechou, com medição: a tradução de ZodError segue com 3 cópias e NENHUMA quarta nasceu. Razão: fechar exigiria mudar a forma da razão da falha que o CT-623 afirma e deixaria confirmacao-de-email.ts (fora do escopo) para trás. Marcador EMENDADO com a medição e o veredito`
- `[T8] D51 · F4/T16 NÃO dispara (os dois símbolos seguem com 2 declarações; o despachante não exige CHAVE_DE_CIFRA_DO_CERTIFICADO nem DIRETORIO_DOS_BOLETOS, ADR-0032) · D38 · F5/T8 NÃO dispara (zero portas bancárias compostas)`
- `[T8] DOIS débitos NOVOS emitidos nas três pontas: D16 · F5/T8 (a conferência de partida das três variáveis tem duas declarações no processo) e D17 · F5/T8 (o lançador de subprocesso tem duas cópias privadas)`
- `[T8] índice: 39 → 40 marcadores (−1 do D13 fechado, +2 dos novos), contador do parágrafo acompanhando. Escrituração: worker 159 → 177, total 1910 → 1928, soma conferida por mim`

⚠️ **O executor REFUTOU uma das minhas três correções ao `tech_spec.md`, e mediu**: eu mandei corrigir as
linhas 157, 517 e 518; ele corrigiu as duas primeiras e **recusou a terceira**, porque *"ela fala de
`packages/regua/src/regua.ts`, o pacote de DOMÍNIO, que de fato permanece inalterado — marcá-lo como
modificado poria uma afirmação FALSA no spec"*. Idem a linha 1078. É a **sétima** ocorrência do precedente
do `CLAUDE.md` neste run, e a terceira em que quem prescreveu errado fui eu.

- `[T8] duas prescrições do CARD divergidas, medidas e declaradas na §4 do run-report: o CT-1076 (o encerramento não tem falha alcançável por estado de domínio — as três instruções são inviolávies; a falha entra pela porta de dados injetada) e o CT-1081 (a leitura literal "cobranças que ficaram avisáveis na suspensão não são avisadas" é FALSA deste produto e exigiria código novo contra a §17; o mecanismo real é o INTERVALO MÍNIMO)`
- `[T8] FOLGA_DA_RETOMADA_EM_MINUTOS = 10 é decisão do executor (uma cadência inteira do timer A_CADA_10_MIN); o spec dizia apenas "a folga declarada"`
- `[T8] apps/worker/src/fila.ts e main.ts estavam na §5.2 e NÃO precisaram de mudança — T6 e T7 já haviam acrescentado produtores e consumidores. É a §5.2 que estava a mais, não a entrega a menos`
- `[T8] QA (opus) rodada 1: REJEITADO — 1 ALTO/logic (CA-02 PARCIAL) + 4 BAIXO. criterios 11/12, 8/8 CTs, SUITE_COMPLETA nos CINCO pacotes e todos verdes`
- `[T8] antipadroes_verificados: 5/5 arquivos · determinismo: ok · zero antipadrões detectados`
- `[T8] o QA fez a checagem da §3-B POR IGUALDADE DE CONJUNTO: 40 pares no índice, 40 marcadores vivos, ZERO órfãos nas duas direções — descontado o D99 · F7/T3, que é literal de fixture e não marcador`
- `[T8] o QA ENDOSSOU a emenda ao marcador alheio do D49: "sem a emenda, a próxima task leria 'QUANDO FECHA: a primeira task autorizada a abrir regua.ts' e concluiria que a T8 falhou em fechá-lo — o modo de falha que a §3-B nomeia". E confirmou que o TEXTO ORIGINAL foi preservado, com precedente (D34 e D43)`
- `[T8] sobre a suposta contradição do D51: NÃO HÁ. O "JÁ DISPAROU (F5/T7)" do índice é estado HERDADO, sobre o OUTRO eixo do gatilho; o eixo que dizia respeito a esta task foi medido e corretamente não disparou`
- `[T8] as DUAS divergências do card são PROCEDENTES, e o QA chamou o CT-1081 de "a prova mais bem construída do arquivo"`
- `[T8] ⚠️ o QA CONFIRMOU a refutação do executor contra a MINHA instrução sobre o tech_spec linha 518: "marcá-lo como modificado poria uma afirmação FALSA no spec… as duas linhas nomeiam arquivos HOMÔNIMOS em pacotes diferentes, que é exatamente onde a confusão nasce". A recusa fica mantida`
- `[T8] o QA chamou o determinismo de "o ponto mais bem executado da task": zero setSystemTime, zero sleeps fixos, ambiente montado variável a variável e nunca herdado, spawn com razão escrita, prazo com SIGKILL e clearTimeout nos dois desfechos`
- `[T8] attempt_count: 0 → 1 · attempt_sha (rodada 2)=d2e29873048fce186204700ba92644db61f605f9`

⚠️ **O ALTO é a metade que falta de um CA declarado em QUATRO lugares do card e no §4**: *"a razão
registrada contém literalmente o `empresaId` de B"*. Medido — `processarRotinaAgendada` **relança sem
registrar**, e o único registro do caminho de falha é o ouvinte genérico de `fila.ts`, com
`{ idTarefa, fila, tentativa, erro }` e **sem como obter a empresa**, porque `processar<Carga>` é genérico.
**O teste passa porque não exercita a propriedade.** Impacto no eixo desta fatia: **a T9 instala
`OnFailure=`**, e o operador lê *"tarefa em falha"* sem saber de qual empresa, numa base multi-empresa com
**uma tarefa por empresa por disparo**. ⚠️ O QA separou o que a divergência do executor confundia:
assertar a **mensagem do dublê** seria conteúdo plantado (e a recusa dele está **certa**); assertar o
**campo `empresaId` do registro da borda** **não** seria — o valor vem da carga que o despachante produziu.
- `[T8] correção rodada 2: os CINCO achados fechados. P1 pela rota (a) do QA — a borda nomeia { idTarefa, fila, empresaId, rotina, erro } em `error` e RELANÇA. worker 177 INALTERADO (a correção acrescentou ASSERÇÕES ao CT-1076, não caso novo)`
- `[T8] as TRÊS linhas do P3 para rotina-agendada.ts (arquivo da T6) foram escritas ANTES da edição e escrituradas na §4 do run-report. O POR QUE ISTO FECHA A CLASSE é forte: "o registro nasce no ÚNICO ponto por onde passa toda passagem desta fila que levanta… o despacho das quatro rotinas corre INTEIRO dentro do bloco, de modo que rotina nova nenhuma pode falhar sem passar por aqui"`
- `[T8] a asserção que discrimina: expect(falhasNoDiario.map(…)).toEqual([B, B, B]) — com o código anterior falhasNoDiario é [], porque a borda não emitia linha alguma`
- `[T8] P2 fechado transformando código morto em prova: Montagem.eventos() deixou de ser declarado-e-nunca-chamado e passou a ser o caminho da asserção nova, com o companheiro negativo (nenhuma linha de falha nomeia A nem C)`
- `[T8] P5 fechado requalificando a medição NAS DUAS PONTAS: o eixo passou a ser grep por "env: ambiente" (dois), e não spawn(process.execPath) (três) — o terceiro herda process.env e não é o lançador que o débito delimita`
- `[T8] QA (opus) rodada 2, DELTA: APROVADO — 12/12 critérios, ZERO problemas. worker 177, db 265`
- `[T8] ledger rodada 2: os CINCO achados fechados (o ALTO e os quatro BAIXO, inclusive os três que estavam aceito_como_debito)`
- `[T8] o QA percorreu o checklist de 7 pontos um a um e confirmou: o catch nasce DEPOIS do strictObject; a exceção RELANÇA intacta (throw erro, o objeto original); fila.ts NÃO foi tocado; Montagem.eventos() deixou de ser código morto; e as três linhas do P3 estão escritas`
- `[T8] o QA reforçou por que a asserção não é conteúdo plantado: "o capturador é o logger REAL do processo, não um dublê; e o valor asserido vem da carga que o despachante produziu — o dublê decide apenas QUAL passagem levanta"`
- `[T8] o QA avaliou o companheiro negativo contra AP-29 e DECIDIU NÃO reportá-lo, com razão de método: "isolado, é falsificável… o AP-29 canônico pune asserção que SUBSTITUI a prova real; aqui a prova forte existe na asserção anterior e a redundante é defesa em profundidade contra afrouxamento futuro daquela"`
- `[T8] o QA julgou as DUAS LINHAS por falha no journal "o certo, não ruído", refutando três alternativas — a decisiva: "o ouvinte genérico ler job.data.empresaId obrigaria a supor a forma da carga de TODA fila, e a primeira sem o campo publicaria undefined como identificador"`
- `[T8] o QA RODOU o comando requalificado do D17 e confirmou: devolve DOIS. O eixo antigo devolve três, e o terceiro de fato herda process.env`
- `[T8] o QA registrou um julgamento AUDITÁVEL em vez de silencioso sobre AP-19: o literal 'ENCERRAMENTO_DE_CONTRATOS' já é a convenção estabelecida do arquivo para ESSA rotina (4 ocorrências pré-existentes), e extrair constante só para a 5ª criaria assimetria`
- `[T8] Tech Review (opus) rodada 2 (PRIMEIRA passagem dele, FULL): APROVADO_COM_OBSERVACOES — P1 e P2 BAIXO, os dois anotáveis e de UMA LINHA cada`
- `[T8] TR consultou: ADR-0009, 0024 (com as DUAS emendas), 0025, 0026, 0029, 0031, 0032, 0035`
- `[T8] o TR RODOU as duas pontas da §3-B ELE MESMO, "não confiei na apuração do QA": os CINCO marcadores novos da fatia (D5, D11, D15, D16, D17) têm linha no índice E bloco na §2. Zero órfãos nos dois sentidos`
- `[T8] o TR JULGOU LEGÍTIMA a emenda ao marcador alheio e citou a §3-B literalmente: o DÉBITO COM GATILHO "não protege nada… editar o código sob ele é normal — o que não se pode é editá-lo SEM LER". E notou o acerto de NÃO mexer na linha do índice, porque o gatilho não mudou (diferente do D34, cuja emenda o alterou)`
- `[T8] o TR julgou as duas linhas por falha certas por um motivo novo: "carregam campos DISJUNTOS — a do ouvinte traz `tentativa`, que a borda não tem à mão de forma confiável; a da borda traz empresaId e rotina, que o ouvinte não pode ter sem quebrar a parametrização"`
- `[T8] ⚠️ o TR VERIFICOU DE FORMA INDEPENDENTE a recusa da linha 518 e a manteve, chamando-a de "o precedente de método do CLAUDE.md aplicado a uma INSTRUÇÃO DO USUÁRIO — e a divergência foi declarada e medida como o precedente exige"`
- `[T8] o TR investigou por conta própria DOIS riscos que ninguém levantou e os fechou: (a) process.exit() no finally NÃO trunca o diário (pino.destination com sync: true, e o padrão já está documentado em main.ts); (b) o laço da retomada é limitado POR CONSTRUÇÃO — o CHECK do banco força toda notícia tratada a sair de RECEBIDO, inclusive a que não casa com cobrança alguma`
- `[T8] o TR registrou um resíduo NÃO STAGED de 10 linhas em apps/worker/test/eco.spec.ts que é da T7, não da T8 — para eu não o atribuir errado ao compor o commit`
- `[T8] P1 e P2 PAGOS no fecho: os dois são de uma linha e os DOIS mordem a T9, que é a próxima e é quem escreve os ExecStart=`
- `[T8] fecho aplicado: P1 pela rota (b) — CT-1079 (b) amarra a folga aos minutos que o NOME da cadência declara, com prova de falsificação de TRÊS mutantes (a cadência de 15 min, a constante renomeada — que faria undefined === undefined passar calado — e a cadência que deixa de ser de intervalo). P2 pelo roster sem protótipo, com a rede como SÉTIMA linha do CT-1077`
- `[T8] ⚠️ a razão da escolha entre as duas rotas do P1, declarada pelo executor, é de método: "o DÉBITO COM GATILHO apenas AGENDA, e aqui a metade cara do impacto é SILENCIOSA — o que fecha essa classe é ficar vermelho NO INSTANTE em que a premissa cai"`
- `[T8] ledger: 7 achados totais | 2 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T8] staged · CONCLUÍDA · tasks_completed 7 → 8 · memória lazy deletada · worker 177 → 180, total 1928 → 1931`
- `[Fase 3] ENCERRADA — T6, T7 e T8 concluídas`

### Fase 4 — lote paralelo T9 × T10

- `[Fase 4] lote paralelo: T9, T10 — os cinco guards provados na §4.2 do task_plan e RE-VERIFICADOS por mim: (1) nenhuma é ancestral da outra (T9 consome T1+T8, T10 consome T1+T4, sem interseção entre si); (2) símbolos disjuntos; (3) paths disjuntos — deploy/** + packages/shared/test/** × apps/api/**; (4) alta contenção — T9 toca packages/shared/package.json, T10 não toca manifest; (5) lote 2 <= MAX_PARALLEL=4`
- `[Fase 4] ⚠️ guard de recursos de teste DISPARA: a T10 tem E2E com servidor HTTP real e banco efêmero, e a T9 é asserção ESTÁTICA sobre o sistema de arquivos. O task_plan manda serializar a etapa de QA se o isolamento não puder ser PROVADO — executores em paralelo, QAs um por vez, em ordem de ID`
- `[Fase 4] base_sha=52e2be115865c6f40fd00f208b13fab82c1289da (comum às duas)`

### Fase 4 — os dois executores retornaram (2026-08-23)

- `[T9] executor concluído` — 14 criados, 4 modificados · `shared` 267 → **271** (+4: CT-1057 a
  CT-1060) · `db` 265 → 265 · `contracts` 438 → 438 · `build`/`lint` verdes. **Três divergências A1
  declaradas pelo executor**: (1) o arquivo da vigilância é `sysloc-rotina-vigilancia-das-rotinas.*`,
  não `sysloc-rotina-vigilancia.*`, porque a chave do contrato é `VIGILANCIA_DAS_ROTINAS` e o nome
  curto exigiria tabela de tradução que o cabeçalho de `rotina-agendada.ts` proíbe; (2) `Persistent=true`
  em **3** timers, não 5 — o "5" da §6.1 é anterior ao mapa conciliado no challenge, e a suíte **deriva**
  do mapa; (3) `UNIDADES` do instalador tem **15** nomes (2 preexistentes + 13 da fatia), e a suíte
  afirma as duas contagens. Fechou o **`D3 · F5/T7`** (docblock de `UNIDADES_DECLARADAS`).
- `[T10] executor concluído` — 1 criado, 6 modificados · `api` 389 → **394** (+5: CT-1091 a CT-1095) ·
  `shared` 271 (os +4 da T9, em paralelo) · `build`/`lint`/`api test` verdes. Superfície remedida do
  zero pelas duas medições independentes: **106 rotas / 91 manipuladores / 20 públicas**. **Duas
  divergências A1**: (a) a "empresa C" do card é a `EMPRESA_B` da carga — montar a terceira exigiria a
  7ª cópia de `entrarComSegundoFatorCumprido` (`D32 · F5/T7`) e uma troca de senha contra o teto do
  `D27 · F1/T6`; (b) a borda de 24 h de `HORAS_DA_RECUSA_RECENTE` não é reafirmada na borda (já tem
  âncora no `CT-1074 (h)`; repetir seria `duplicate_cross_layer`/AP-23).
- `[T10] fora da §5.2, subiram no mesmo diff`: `apps/api/test/contexto.e2e.spec.ts` (âncora gêmea
  `ROTAS_PROTEGIDAS_ACEITAS` — **12ª** anotação consecutiva do `D26 · F2/T6`) e
  `apps/api/src/automacao/automacao.module.ts` (docblock dizia "as quatro rotas da área"). É exatamente
  a classe que a §5.2 da `ancoras-de-superficie.md` existe para declarar — candidato a débito.
- `[Fase 4] QAs serializados` conforme o guard de recursos registrado: **T9 primeiro** (asserção
  estática sobre o sistema de arquivos), **T10 depois** (E2E com servidor HTTP real e banco efêmero).
  Os dois Tech Reviews podem correr em paralelo — não executam suíte.
- `[T9] scan_scope=FULL` (rodada 1) · `[T10] scan_scope=FULL` (rodada 1) · `base_sha` comum
  `52e2be115865c6f40fd00f208b13fab82c1289da`

### Fase 4 — Gate 1 da T9: REJEITADO (1 CRÍTICO), e a premissa do meu guard foi refutada

`[T9] Gate 1 (QA, opus) → REJEITADO` · critérios 10/11 · CTs 4/4 com teste · `security_flags: []` ·
`escopo: PARCIAL` (o `api` ficou vedado por mim). Medido pelo gate: `shared` **271** verdes ·
`contracts` **438** verdes · `db` **264 verdes + 1 VERMELHO** sobre os mesmos 265.

- **CRIT-001 · `logic` · regressão R1 confirmada e reproduzida por mim**: a T9 versionou **6**
  arquivos `deploy/systemd/*.timer` — classe que **nunca existira** nesta árvore — e o `CT-626 (d)`
  de `packages/db/test/barreira-de-envio.spec.ts:1209` particiona a árvore inteira por igualdade.
  Conferido de fora da suíte: `git ls-files | grep -c '\.timer$'` → **6**; `grep -c "'\.timer'"
  packages/db/test/barreira-de-envio.spec.ts` → **0**. A âncora está certa e fez o trabalho dela; a
  correção prescrita pelo próprio docblock é **declarar a classe**, com `SUT_IS_CORRECT_BECAUSE:`.
  ⚠️ **É a terceira ocorrência da mesma classe neste run** (T6 rodada 1, T8 e agora T9): *o executor
  mede a baseline só do pacote que ele escreve, e a âncora que reprova vive noutro pacote*. Aqui foi
  pior que nas duas anteriores — a **contagem não se moveu** (265 → 265), de modo que comparar só o
  total não acusa; o P5 manda comparar **caso a caso**, e é exatamente esta a razão.
- **BAIXO-001 · `documentation`**: o docblock cita o débito fechado como `D3 · F5/T7`; o cabeçalho
  real é `### D3 · BAIXO · code_quality · **T2** · Tech Review` (`run-report.md:65`). Conferido por
  mim. **A escrituração errada é minha também** — registrei `D3 · F5/T7` no fecho da T7 e o executor
  copiou. Corrijo nas três pontas. Escrituração é `BAIXO` fixo e não bloqueia.
- **O gate julgou o mérito das divergências A1 e deu razão ao executor nas três** (nome longo da
  vigilância, `Persistent=true` em 3 e não 5, `UNIDADES` com 15 e não 13), medindo cada uma. E achou
  uma **quarta, não declarada, também com mérito**: a distinção `.timer`/`.service` na habilitação
  ficou explícita **no dado** (`UNIDADES_DO_ARRANQUE`) e não no laço — e a prescrição literal da task
  estaria **errada**, porque `sysloc-api.service` e `sysloc-worker.service` precisam ser habilitados.
  É a **oitava** confirmação do precedente *"prescrição de gate é hipótese, não ordem"*.

#### Correção de premissa minha — o guard de recursos serializava pela razão errada

Eu registrei que os QAs da Fase 4 seriam serializados porque *"duas instâncias de `embedded-postgres`
concorrentes geram flake"*. **Medi, e é falso.** `packages/shared/test/efemero-comum.ts` arbitra a
porta entre **processos**: `reservarPorta()` sorteia deslocamento sobre a faixa 24001–24999 e chama
`travarPorta()`, que toma a trava por `listen()` num **soquete de espaço abstrato** — `EADDRINUSE`
vindo de outro processo resolve `'de-outro'` e a busca continua. O diretório de dados é `mkdtemp`.
O isolamento entre suítes concorrentes está **provado**, e é a exceção que a própria
`agent-spec-workflow-rules.md` prevê (*"se o isolamento for provado … logue a prova"*).

**A serialização continua, por um risco melhor e real**: o script `test` de cada pacote é
`tsc --build && tsc -p tsconfig.test.json && vitest run`, e `tsc --build` escreve o `dist/` e o
`.tsbuildinfo` **do grafo compartilhado**. Sete dos nove pacotes resolvem `"."` para `./dist/index.js`
(`.claude/rules/testing-stack.md`), de modo que dois `tsc --build` concorrentes podem deixar um
consumidor lendo `dist/` parcial — e a falha apareceria na task **inocente**. O hazard é o **build
compartilhado**, não o banco.

`[Fase 4] guard mantido, premissa corrigida`: **QA da T10 agora, sozinho**; a correção da T9 (que roda
`db`) espera o retorno dele. Vale para o resto do run, T11 inclusive.

#### Correção de escrituração — o débito fechado pela T9 é `D3 · F5/T2`, não `D3 · F5/T7`

Este log é append-only; a linha errada fica onde está e esta a corrige. O bloco real é
`### D3 · BAIXO · code_quality · **T2** · Tech Review` (`_run/run-report.md:65`), `Onde:
packages/db/test/cobranca.spec.ts:461`, e o campo *O que fazer* dele já dizia *"na T9, ao acrescentar
os `.timer` a `UNIDADES_DECLARADAS`, substituir a frase pelo discriminador vigente"* — é o mesmo
débito, com origem **T2**.

**O erro é meu**: registrei `D3 · F5/T7` no fecho da T7 e o executor da T9 copiou o par de lá. A §3-B
da `nao-regressao.md` é explícita — *"o identificador de um débito é o par `Dnn · F{n}/{origem}` mais
o caminho do `ÍNDICE`, nunca o número sozinho"* —, e o índice do `CLAUDE.md` já carrega `D3 · F2/T1`
e `D3 · F3/T1`: um terceiro `D3` com origem inventada é exatamente a colisão que a §3-B registra ter
custado três renumerações na F1. Sai na correção da T9 (docblock) e na regeneração da §2.

### Fase 4 — Gate 1 da T10: REJEITADO (3 ALTOs), e a rodada 2 das duas em paralelo

`[T10] Gate 1 (QA, opus) → REJEITADO` · critérios **11/11** · CTs **5/5** com teste ·
`security_flags: []` · `escopo: PARCIAL` (só `api`, por vedação minha) · **suíte verde: 394/394 em 43
arquivos**, exatamente a baseline declarada pelo executor. **Nenhuma regressão de comportamento.**
Os três bloqueantes são de **qualidade de prova**, todos no arquivo novo:

- **ALTO-001 · `tautological_assertion` (AP-29)** — duas ocorrências da mesma classe: negativa
  colocada **depois** da igualdade que a implica, e portanto infalível. ⚠️ **É reincidência de classe
  no repositório**: existe `DECISÃO FECHADA — T12 / Gate 2 (P1) · 2026-08-12` em
  `apps/api/test/autorizacao-do-dominio.e2e.spec.ts:1528-1540` que diagnostica **exatamente** esta
  forma e prescreve a inversão. A regra que fecha a classe é *asserção mais fraca vem ANTES da
  igualdade que a implica, nunca depois.*
- **ALTO-002 · `non_deterministic_input`** — `proximaEsperada` comparada contra `Date.now()` lido
  **depois** da requisição; para `AVISO_DE_COBRANCA` (`A_CADA_MINUTO`) a derivação é
  `date_trunc('minute', now()) + 1 min`, e a margem é de milissegundos. O caso do laço compara contra
  um relógio lido **duas requisições HTTP mais tarde**. O gate notou a assimetria decisiva: o
  executor **fechou esta mesma armadilha no eixo `atrasada`** e não a aplicou ao eixo do relógio.
- **ALTO-003 · `test_order_dependency`** — o `CT-1091` afirma `REGUA_DESLIGADA` derivando-o da
  **ausência** de política, e o `CT-1093` (linha L4) liga a régua de A. Em ordem invertida o CT-1091
  reprova. O arquivo já pratica o princípio da correção noutro caso (*"order-independent por dentro:
  cada linha escreve todos os eixos que ela afirma"*); falta aplicá-lo aqui.
- **BAIXO-001 · débito** — `GET …/rotinas` fica fora da prova de derivação do documento publicado
  (`CT-327`, ADR-0016), porque `ROTAS_DESCRITAS = 48` é tabela curada à mão e a âncora dela é
  `toBeGreaterThanOrEqual`, **desigualdade que não reprova com rota nova**. ⚠️ Peso extra pelo
  congelamento: **esta é a última rota que o repositório publica**, então a lacuna não fecha de
  carona em fatia posterior. Escrituro na §2.
- **O gate julgou o mérito das duas divergências A1 e deu razão ao executor nas duas**, e auditou a
  âncora de superfície item a item contra a rule — conforme, com controle antivácuo na forma forte
  (`comExigencia + publicas + semDeclaracao === rotasEnumeradas`).

#### Rodada 2 — as duas correções em paralelo, com trava de build

`[T9] attempt_count=1 → rodada 2` · `last_severity=CRITICO` · `[T10] attempt_count=1 → rodada 2` ·
`last_severity=ALTO`. Memória lazy criada **populada** para as duas (`_run/tmp/T9.md`, `_run/tmp/T10.md`),
com o Ledger já contendo os achados da rodada 1 e `rodada_origem: 1` — se nascesse vazio, eles
reentrariam como novos na rodada 2 e a métrica de incompletude ficaria corrompida.
`requires_qa_revalidation` não se aplica: as duas rejeições vieram do **Gate 1**, e a rodada 2
re-passa pelo QA por definição.

**Decisão A1 — despachar as duas correções em paralelo, e não em série.** As alternativas eram (a)
serializar as duas correções inteiras, ou (b) despachá-las juntas cercando **só** a compilação com
`flock` sobre um arquivo de trava. **Adotada a (b)**, que é a recomendada · razão: o hazard medido é o
`tsc --build` sobre o grafo compartilhado, não a edição nem o raciocínio — e esses dois consomem a
maior parte do tempo dos executores. A trava dá exatamente a mesma garantia da serialização no ponto
onde ela é necessária, e devolve o paralelismo em todo o resto. Os paths de edição são disjuntos
(`packages/db/test/**` × `apps/api/test/**`) e nenhum dos dois pacotes de teste entra no `dist/` do
outro.

### Fase 4 — rodada 2: as duas correções fecharam

- `[T9] correção rodada 2` — 2 modificados, 0 criados. `db` **264+1 → 265 TODOS VERDES** (36/36
  arquivos); `shared` 271 e `contracts` 438 imóveis nos dois eixos. **Prova de falsificação executada
  como a `testing-stack.md` exige para asserção estática**: mutante removendo `'.timer',` de
  `CLASSES_NAO_CARREGAVEIS` → **1 failed**, com a mensagem nomeando a classe (*"classe versionada FORA
  do conjunto varrido e não declarada não-carregável: .timer"*); revertido do backup e reconfirmado
  verde, `diff` contra `HEAD` conferido, cópia apagada. Rodou **pelo script `test` do pacote**, nunca
  `vitest run` avulso, e sempre por `flock`. A **Âncora 1-E foi conferida por leitura** antes do fecho:
  `EXTENSOES_CARREGAVEIS` não contém `.timer`, a interseção segue vazia. Nada removido.
- `[T10] correção rodada 2` — 1 modificado. `api` **394 → 394 verdes**, contagem e casos idênticos (o
  diff não acrescenta nem remove `it`). Verificação extra que vale registro: `-t "CT-1091"` isolado →
  **1 passed | 393 skipped**, isto é, o caso agora basta a si mesmo sem o `CT-1093` — que é
  exatamente o que o ALTO-003 cobrava. **Registrou `DECISÃO FECHADA — T10 / Gate 1 (ALTO-001) ·
  2026-08-23`** no ponto (a), pela §3 da `nao-regressao.md` (*o defeito já tinha voltado por caminho
  diferente*): a classe fora fechada em `autorizacao-do-dominio.e2e.spec.ts` em 2026-08-12 e
  reapareceu num arquivo novo, escrito sem ler aquele marcador. Nenhum marcador existente tocado.
  A única linha removida foi introduzida por ele mesmo na rodada 1.
- **Defeito operacional meu, declarado**: `[T9] attempt_sha (rodada 1)=<indisponivel>` ·
  `[T10] attempt_sha (rodada 1)=<indisponivel>` — **não capturei o marcador antes de despachar os
  executores de correção**, e a cláusula de fallback da `agent-spec-workflow-rules.md` manda a rodada
  seguinte rodar em **`FULL`**. É a direção segura (falso-`FULL` custa tokens; falso-`DELTA` deixa
  passar regressão), e as duas rodadas 2 vão em `FULL`. Corrigido daqui em diante:
  `[T9+T10] attempt_sha (rodada 2)=9db7d634bced0f6066df3878ee3b202295d31369`, capturado por índice
  temporário fora do worktree, com `git status --porcelain` inalterado depois.
- `[Fase 4] QAs da rodada 2 em PARALELO`, com a mesma trava `flock` sobre a compilação — o hazard
  medido é o `tsc --build` concorrente, e a trava o cerca sem custar a serialização do resto.

### Fase 4 — rodada 2 dos gates: T9 aprovada, T10 rejeitada pela mesma classe num terceiro ponto

`[T9] Gate 1 (QA, opus, rodada 2) → APROVADO_COM_OBSERVACOES` · **11/11** critérios · CTs 4/4 ·
`security_flags: []` · `db` **265/265**, `shared` **271/271**, `contracts` **438/438**, todos verdes.
Os **dois** achados do Ledger **sanados**, e o gate conferiu o crítico por **três vias independentes**:
execução, leitura do diff, e auditoria das **três proibições** que o docblock da âncora escreve. A
Âncora 1-E foi reconferida por ele (`grep -n timer` em `varredura-de-fontes.ts` → **zero**). Único
remanescente: **BAIXO-001 · `documentation`** — a §5.2 da task não declarou as duas âncoras de
`packages/db/test/`, e **o custo já foi pago**: a segunda só apareceu pela suíte vermelha na rodada 1.
Escrituro na §2. → **Gate 2 despachado.**

`[T10] Gate 1 (QA, opus, rodada 2) → REJEITADO` · **11/11** critérios · suíte **394/394 verde** ·
`security_flags: []` · **os três ALTOs da rodada 1 sanados**, cada um conferido no fonte: a inversão
está feita; a linha removida era **estritamente implicada** e não é AP-24; a implicação do relógio é
**total** e não tolerância (`antesDoPedidoDeA` na l. 426 antes do `pedir` da 427); o `upsert` é
`ON CONFLICT … DO UPDATE` de todos os campos e `REGUA_DESLIGADA` **precede** na `.find(...)`. O
marcador `DECISÃO FECHADA` novo foi auditado campo a campo e **aprovado**, com o `REVERTER EXIGE`
julgado **falsificável**.

⚠️ **Mas a classe não fechou.** O gate achou uma **terceira ocorrência** no mesmo arquivo e no mesmo
caso (l. ~489-497): as asserções de ordem do `historicoRecente` vêm **depois** da igualdade profunda
que as fixa por extenso, e portanto não podem falhar — nem pelo defeito que dizem perseguir (ordem
crescente reprova na igualdade, nunca ali). E o gate nomeou o agravante que importa: **o arquivo
passou a desmentir o marcador que ele mesmo registrou 40 linhas abaixo** — *"marcador que o arquivo
desmente ensina a próxima rodada a ignorá-lo"*.

#### Rodada 3 — a §5 da `nao-regressao.md` foi acionada explicitamente

`[T10] attempt_count=2 → rodada 3` · **auto-escalonamento aplicado**: executor em raciocínio
estendido, pela regra `attempt_count >= 2`.

**O prompt da rodada 3 NÃO manda corrigir a linha apontada.** A §5 diz que *"o mesmo defeito reaparece
por um caminho novo a cada rodada"* é assinatura de defeito **estrutural**, e que *"segunda rejeição do
mesmo item significa que a leitura do problema está errada"*. O entregável desta rodada é a **varredura
do arquivo inteiro** atrás de toda ocorrência da classe — a linha 493 é amostra, não escopo —, com o
critério operacional escrito (*existe asserção anterior, ainda não abortada, cuja passagem torna esta
necessariamente verdadeira?*) e a exigência de que a linha `POR QUE ISTO FECHA A CLASSE:` fale de
**topologia**, não de linha. Junto vai a advertência de não "corrigir" o que está certo (§4.5).

`[T10] ledger` — o **QA-ALTO-004** entra com `rodada_origem: 2`, e ⚠️ **conta na métrica `{C}`**: a
causa **não** é a correção da rodada 1: as três asserções existem desde a rodada 1, no mesmo caso que
o gate já auditara. É **incompletude da varredura da rodada 1**, e é precisamente o que a métrica do
Ledger existe para medir. O **QA-BAIXO-002** (§5.2 sem as duas âncoras) entra como `aceito_como_debito`.

`[T9+T10] attempt_sha (rodada 2)=9db7d634bced0f6066df3878ee3b202295d31369` — a rodada 3 da T10 pode
rodar em `DELTA` sobre ele.

### T9 — Gate 2 (Tech Review, opus): PARCIAL, com um defeito que a suíte não tinha como pegar

`[T9] Gate 2 → PARCIAL` · `requires_qa_revalidation: true` ·
`adrs_consultadas: [0005, 0022, 0032]` (mais a 0006 nas observações), **todas abertas na `Decision`**.

- **P1 · `ALTO`/`technical_requirement` — defeito real de shell.** `proximo_passo()` é chamada dentro
  de `$( )` nos quatro pontos, e **substituição de comando roda em subshell**: a atribuição a
  `passo_corrente` morre com ele. O revisor **mediu na máquina** com fragmento equivalente — quatro
  iterações deram `P01 P01 P01 P01`, contador final `0`. No instalador real são **32 linhas todas
  rotuladas `P01`**, e o CA-04 exige auditabilidade **linha a linha**. ⚠️ **O comentário que o próprio
  executor escreveu declara a intenção oposta** (*"a renumeração esquecida é a forma como duas linhas
  passam a dizer o mesmo número"*) — e o mecanismo faz **todas** dizerem o mesmo. ⚠️ **Invisível a
  toda a rede da fatia**: a suíte não lê `proximo_passo`, e o instalador exige `sudo` interativo, que
  a decisão A1 da §16.1 deixou fora da suíte de propósito. **O Gate 2 foi a única defesa** — é o
  argumento empírico mais forte deste run a favor de manter o Gate 2 ligado em área de infra.
- **P2 · `MEDIO`/`testability` — bloqueante.** O argumento de rotina do `ExecStart` dos seis
  `.service` é literal escrito à mão, e **nada o amarra** a `ROTINAS_DE_DESPACHO`. O cabeçalho da
  unidade **afirma a propriedade por escrito** e ninguém a verifica. Um `retomada-de-noticia` sem o
  `s` passaria por compilador, suíte, `systemd-analyze verify` e pelos dois gates, e só apareceria no
  primeiro disparo em produção (código 2). É a **mesma classe** que o `CT-1057` existe para fechar.
- **P3 · `MEDIO`/`code_quality`** (~100 linhas de prosa idênticas em 12 arquivos) e **P4 · `BAIXO`**
  (a razão do `AccuracySec=` nos três diários fala de *"alta frequência"*, premissa que não se aplica
  — primeira evidência concreta do P3): **anotáveis**, viram débito na §2.
- **O Gate 2 confirmou as quatro divergências A1 por medição própria**, e conferiu duas premissas do
  executor na máquina: `systemd-analyze` **255.4** (acima do 252 em que o fuso no `OnCalendar=` passou
  a ser aceito) e `/usr/bin/echo` presente. **Absolveu** a unidade-modelo e o `TimeoutStartSec=120` de
  `speculative_complexity`, e **não** emitiu `scope_deviation` pelas duas âncoras de `packages/db/test/`
  — pela mesma razão que o Gate 1: a `ancoras-de-superficie.md` as **obriga**, e a lacuna é da §5.2.
- **Nota de higiene do revisor**: ele identificou que o hunk de `FILAS_DECLARADAS` em
  `cobranca.spec.ts` **não é da T9** (é da T2/T7) e aparece só porque o `git diff <base_sha>` é
  cumulativo sobre working tree compartilhado — e o excluiu do julgamento. É a leitura certa.

`[T9] attempt_count=2 → rodada 3`, executor **auto-escalado** para raciocínio estendido.
`[T9] retry classification` — `problemas_por_categoria: { technical_requirement: 1, testability: 1,
code_quality: 2 }` · `overrides_ativos: [tocou_area_critica: true]` · `requires_qa_revalidation: true`
· `decisao: NÃO pule o QA` · justificativa: os dois bloqueantes são `revalidation_required`
(`technical_requirement` e `testability`), e o override de área crítica forçaria de qualquer modo.

⚠️ **A rodada 3 abre a Convergência do laço para as duas tasks.** Da rodada 3 em diante, `MEDIO` de
categoria convergível (`architecture`, `performance`, `testability`, `speculative_complexity`) que for
**inédito** (C1), ou que já bloqueou em duas rodadas e siga aberto (C2), vira **débito anotado** em vez
de rodada nova. `CRITICO` e `ALTO` seguem bloqueando **sem limite**. As duas cláusulas são minhas de
aplicar — os gates continuam reportando com honestidade.

### T10 — rodada 3: a varredura fechou a classe (5 pontos, não 1)

`[T10] correção rodada 3` (executor auto-escalado) — 1 arquivo modificado. **A §5 funcionou.** O
executor não corrigiu a linha apontada: varreu **55 `expect(` em 4 casos** aplicando o critério
escrito, e achou **5 pontos / 11 asserções** da mesma classe — a amostra do gate era **um** deles.
**Todas movidas, nenhuma removida**: `grep -c "expect("` = **55 antes e 55 depois**, e a suíte fechou
em **394/394** sobre os bytes finais (`md5 df4f3a50cb04571071ca9282f4ee80d4`).

Os quatro pontos que o gate **não** tinha visto: a interseção com os instantes de A no `CT-1092`; a
pertinência do código à união fechada e a varredura de vocabulário no `CT-1093`; o conjunto de
códigos da linha de controle; e o não-vazamento de UUID e de `itens` nos três corpos do `CT-1094` —
este último com o raciocínio mais fino da lista, porque `corpo` é `JSON.parse(texto)` e portanto,
passada a igualdade de envelope, o texto **é** a serialização exata daquele objeto.

⚠️ **Ele também declarou as ABSOLVIÇÕES, com razão para cada uma** — é o que torna a varredura
auditável em vez de uma afirmação. Duas delas são raciocínio genuinamente fino: `deB.itens.map(...)`
antes da igualdade profunda **é** implicada, mas na direção **correta** (fraca antes da forte), e
`cookieForjado.texto === semSessao.texto` **não** é implicada, porque objetos interpretados iguais
admitem texto servido diferente (ordem de chaves, espaçamento).

**Marcador `DECISÃO FECHADA` estendido** — só o campo `O QUÊ`, com `POR QUÊ` e `REVERTER EXIGE`
intactos, como pedido. Ele agora declara a lei como do **arquivo inteiro**, **enumera os cinco pontos
sob ela com a ordem escolhida**, e encerra com *"quem acrescentar asserção a este arquivo posiciona-a
pela mesma regra"*. É o que fecha o agravante que o gate da rodada 2 nomeou.

`[T10] decisão A1 do executor` — divergiu da prescrição **ampliando** o escopo (a do gate cobria só o
ponto 1). **Nona ocorrência do precedente** *"prescrição de gate é hipótese, não ordem"* neste
repositório, e a primeira em que a divergência é por **excesso de rigor**, não por refutação de
premissa.

`[T10] scan_scope=DELTA` (rodada 3) sobre `attempt_sha=9db7d63…` · `delta_arquivos` = **um só**
(`apps/api/test/rotinas-agendadas.e2e.spec.ts`, medido por `git diff --name-only`) · raio de impacto
**vazio por construção**: nenhum símbolo de produção mudou, e `.spec.ts` de `apps/api/test/` não é
importado por ninguém. É o primeiro `DELTA` real deste run — as rodadas 2 caíram em `FULL` pelo
`attempt_sha` que eu não capturei.

### T10 — Gate 1 rodada 3: APROVADO, zero achados. A classe fechou.

`[T10] Gate 1 (QA, opus, rodada 3) → APROVADO` · **10/10** critérios · CTs 5/5 · **zero problemas em
todas as severidades** · `security_flags: []` · `api` **394/394** · `scan_scope: DELTA` **mantido**
(um arquivo, `+136/-69`, raio de impacto vazio — `.spec.ts` de `apps/api/test/` não é importado).

O que dá peso a esta aprovação: o gate **refez a varredura por conta própria** nos 55 `expect(`, caso
a caso, com o mesmo critério — e **não achou sexta ocorrência**. Auditou as **absolvições uma a uma**
e todas procedem, inclusive as duas mais finas. E confirmou o que a contagem sozinha não prova:
*"cada bloco removido tem par adicionado com **o mesmo matcher**"*, sendo as únicas mudanças de forma
o acréscimo de **rótulo de diagnóstico** em 5 pontos e a troca do laço do `CT-1094` para `[rotulo,
resposta]` — nenhuma altera matcher nem força, logo **nenhum AP-24**.

Os quatro achados do Ledger da rodada 1/2 **sobreviveram ao reposicionamento**, cada um conferido no
ponto: a `not.toBe(404)` segue antes da `toBe(200)`; as **duas** capturas de relógio não aparecem no
diff; a `escreverPolitica(…, REGUA_DESLIGADA)` segue no topo do `CT-1091`. O marcador estendido foi
auditado — só o `O QUÊ` mudou, `POR QUÊ` e `REVERTER EXIGE` byte a byte iguais, e a enumeração dos
cinco pontos **confere linha a linha com o código**. → **Gate 2 despachado.**

### T9 — rodada 3: os dois bloqueantes fechados, e a rede escolhida foi a melhor

`[T9] correção rodada 3` (executor auto-escalado) — 2 arquivos. `shared` **271** · `db` **265** ·
`contracts` **438**, todos verdes; `build` e `lint` (Biome + shellcheck) zerados, mais `shellcheck` e
`bash -n` diretos no instalador.

- **TR-P1 fechado** por publicação **por variável** (`printf -v PASSO`), com os quatro pontos virando
  `proximo_passo; f "${PASSO}" …`. Marcador `DECISÃO FECHADA — T9 / Gate 2 · 2026-08-23` instalado no
  docblock da função.
  ⚠️ **Divergência A1 sobre a FORMA DA REDE — décima ocorrência do precedente, e a mais interessante
  até aqui.** O Gate 2 prescreveu asserção **estática** (`proximo_passo` fora de `$( )` no texto). O
  executor **recusou e escolheu a comportamental**, com o argumento certo: *a estática prende a forma
  de hoje* — `| while read`, crase ou cano perdem o incremento **pelo mesmo mecanismo** e passariam
  por ela. A rede real extrai do instalador a inicialização, o corpo e os pontos de chamada
  (reconhecendo as **duas** formas), monta um programa `bash`, **repete cada ponto 3×** (três dos
  quatro correm em laço, e o defeito é *"a mesma chamada repetida dá sempre o mesmo rótulo"*) e
  executa. Discrimina por `new Set(rotulos).size === rotulos.length` — com o código antigo, conjunto
  de **1** contra 12.
- **TR-P2 fechado** com a asserção **derivando** o esperado de `emKebab` (homônima da de produção) em
  vez de comparar literal com literal, mais a **Falsificação 4** (cópia sem o `s` de
  `retomada-de-noticias`, afirmada por igualdade e nomeando a unidade ofensora).
- **TR-P3 e TR-P4 não entraram no diff**, conforme instruído — viram débito na §2.
- ⚠️ **Contagem estável por decisão declarada**: as redes entraram como **passos dentro dos
  `CT-1059`/`CT-1060` existentes** (84 asserções, de 70), não como CTs novos, para que a escrituração
  do `CLAUDE.md` (`shared` 271) não se movesse **enquanto outro executor tinha aquele arquivo aberto
  em paralelo**. É consciência de orquestração que eu não havia pedido.

`[T9] scan_scope=DELTA` (rodada 3) sobre `9db7d63…` · `delta_arquivos` = **dois** ·
`delta_simbolos` = `proximo_passo`, `PASSO`, `passo_corrente`, `recarregar_definicoes`,
`analisarDespachos`.

### T10 — Gate 2: APROVADO_COM_OBSERVACOES. **Task CONCLUÍDA (2/2 gates).**

`[T10] Gate 2 (Tech Review, opus) → APROVADO_COM_OBSERVACOES` · `requires_qa_revalidation: **false**` ·
`adrs_consultadas: [0008, 0011, 0016, 0017, 0018, 0024, 0026, 0028]`, **todas abertas na `Decision`**.

- **P1 · `MEDIO`/`project_pattern` → anotável.** `emUnidade` é a **sétima** declaração em
  `apps/api/test/`, e **três assinaturas já divergiram**. O diretório **tem** casa compartilhada e a
  suíte já importa dela. Vira débito.
- **P2 · `BAIXO`/`scope_deviation` → anotável.** Os dois arquivos fora da §5.2, **os dois corretos e
  exigidos**. ⚠️ O revisor notou o que eu não tinha visto: **esta é a ÚLTIMA ocorrência possível da
  série do `D26 · F2/T6`** — com o congelamento, nenhuma fatia posterior publica rota, e a condição
  que gera o débito **deixa de existir**.
- `problemas_corrigir` **vazio** → nenhuma rodada de correção. **T10 fecha em 3 rodadas de QA e 1 de
  Tech Review.**
- O revisor absolveu com medição própria: a **herança da exigência** é *"a única conforme"* à ADR-0018
  (declarar só a ação **apagaria a área em silêncio**, que é o que a ADR proíbe); **não há duplicação
  de domínio na borda** (o serviço faz `{ itens: await lerEstadoDasRotinas(tx) }` e nada mais);
  `SEGMENTO_DAS_ROTINAS` **não** é seam de teste (é consumido em produção pelo próprio `@Get`, e há
  **oito** outros iguais em `apps/api/src/`); e `speculative_complexity` **nada**.

#### ⚠️ Correção de premissa minha — o débito do contrato publicado estava escriturado errado

Eu repassei ao Gate 2 a leitura da `correcao_sugerida` do QA, e **o Gate 2 a refutou em dois pontos.
Conferi, e ele está certo nos dois**:

1. **`expect(caminhos.length).toBeGreaterThanOrEqual(ROTAS_DESCRITAS)` NÃO é a âncora do `CT-327`.**
   Ela vive no `CT-945` (a rota que devolve bytes, ADR-0028) e é ali um **piso antivácuo**, papel que
   cumpre corretamente — o comentário ao lado diz isso. **A âncora do `CT-327` é
   `expect(tabela.length).toBe(ROTAS_DESCRITAS)`, igualdade exata**, em `:528` e `:593`. Conferido por
   mim no fonte. Trocar a desigualdade do `CT-945` por igualdade **não fecharia lacuna alguma** e
   enfraqueceria um controle antivácuo que está certo.
2. **A rota nova NÃO é a única fora da prova.** `grep -c 'automacao-de-cobranca\|AUTOMACAO_DE_COBRANCA'
   apps/api/test/contrato-publicado.e2e.spec.ts` → **0**: as quatro rotas de automação **que já
   existiam** também estão fora. A tabela cobre **48 de 106** rotas, por desenho declarado no
   `describe`. São **58 fora**, não uma.

**A lacuna real é outra, e é estrutural**: `ESQUEMAS_POR_ROTA` é lista curada à mão **sem âncora de
completude contra a superfície publicada** — nada afirma que toda rota que devolve corpo JSON consta
dela —, e a ausência **antecede a T10 em várias fatias**. ⚠️ **Não é violação da ADR-0016 e não é
achado contra a T10**: a `Decision` cobra **derivação**, e o controlador usa
`esquemaPublicado(esquemaDoEstadoDasRotinas, 'output')`. Falta a **prova**, que a ADR não exige por
rota. O débito da §2 vai reescrito com esta medição, e com a nota de urgência do revisor: **depois
desta fatia a superfície não cresce mais, então a tabela passa a ser fechável de uma vez — hoje é
mais barato do que nunca, não mais caro.**

**Décima primeira ocorrência** do precedente *"prescrição de gate é hipótese, não ordem"*, e a segunda
deste run em que **quem errou fui eu**, ao repassar sem medir.

`[T10] ledger: 6 achados totais | 2 originados em rodada >1 | 1 suspeito de incompletude da rodada 1`
— o `{C}` é o **QA-ALTO-004**: as três asserções de ordem existiam desde a rodada 1, no mesmo caso que
o gate já auditara. O `QA-BAIXO-002` não conta (nasceu de leitura de spec, não de código).

### T9 — Gate 2, segunda passagem: APROVADO. **Task CONCLUÍDA (2/2 gates).**

`[T9] Gate 2 → APROVADO` · `problems: []` · `requires_qa_revalidation: false` ·
`adrs_consultadas: [0005, 0006, 0032]`, abertas na `Decision`.

Os dois bloqueantes **fechados**, e o revisor mediu em vez de aceitar por declaração: o grep por
`$( proximo_passo`, crase e cano no instalador devolve **três** linhas, e as três são **prosa do
próprio marcador** — nenhuma executável. Conferiu no fonte que `emKebab` da suíte é idêntica ao gêmeo
de produção e que os seis `ExecStart=` reais terminam no kebab correto. Auditou o preâmbulo que o
extrator captura: **cinco atribuições literais, nenhuma com efeito colateral**.

⚠️ **O revisor RETIROU a própria prescrição, e com um argumento que ninguém tinha visto**: a asserção
estática que ele sugerira *"seria FALSIFICADA HOJE pela própria prosa do marcador — as linhas 214 e
216 contêm a forma proibida em comentário, e a asserção teria de aprender a distinguir comentário de
código, que é exatamente o tipo de fragilidade que ela deveria evitar"*. Décima primeira ocorrência do
precedente, e a **primeira em que o próprio autor da prescrição a refuta com medição nova**.

Validou o marcador **nos cinco eixos** (quatro campos · `REVERTER EXIGE` ancorado em prova executável
· natureza correta, protege e não agenda, sem `QUANDO FECHA` nem `ÍNDICE`, e corretamente **fora** do
índice do `CLAUDE.md` · o gatilho da §3 aplicável por **dois** caminhos independentes · contagem de
marcadores nas duas pontas do delta). E endossou o `BAIXO-001` do Gate 1 **sem abri-lo em
`problems[]`**, para não gerar segunda escrituração do mesmo débito — leitura correta do meu papel.

`[T9] ledger: 7 achados totais | 5 originados em rodada >1 | 1 suspeito de incompletude da rodada 1`
— o `{C}` é o **TR-P1**: existia desde a rodada 1, mas o Gate 2 **não havia rodado ainda**, então não
é incompletude de varredura; os demais de `{B}` nasceram do Gate 2 estreando ou de leitura de spec.

### Fase 5 — T11 despachada (a última da fatia)

`[T11] executor: opus (declarado no frontmatter) · gates: [qa, tech_review] (declarado) ·
base_sha=52e2be115865c6f40fd00f208b13fab82c1289da · scan_scope=FULL`

`[Fase 4] staged sequencial: T9 → T10` — ordem de ID, conforme a mecânica de execução paralela.
**90 arquivos no índice.** Sem commit: o usuário decide quando agrupar.

**§2 do `run-report.md` escriturada por mim antes do despacho**, porque a conferência do **sentido 1**
que a T11 faz é contra ela. Seis blocos novos, levando a §2 a **23**: `D18` (a sétima cópia de
`emUnidade`), `D19` (as §5.2 das duas tasks, com a nota de que **a série do `D26 · F2/T6` encerra
aqui**), `D20` (a prosa duplicada em 12 arquivos), `D21` (a razão do `AccuracySec=` nos diários,
primeira evidência do `D20`), `D22` (o alcance por linha do extrator, **sem tocar o marcador**) e
`D23` (o contrato publicado, **com as duas premissas refutadas registradas para não voltarem**).

### T11 — executor: a rede da RN-14, e a premissa que esta fatia invalidou

`[T11] executor concluído` — 0 criados, **7 modificados**. `db` **265 → 268** (+3, o `CT-1096`) e os
outros oito pacotes imóveis; total **1940 → 1943**. `build` e `lint` verdes.

⚠️ **O achado que dá sentido à task, e que ninguém tinha visto**: o `CT-512` apoiava o *"nenhuma
rotina correu"* na premissa *"não há rotina no produto"* — e **esta própria fatia a tornou falsa**
(seis rotinas, seis `.timer`, `negocio.execucao_de_rotina`). O `CT-1096` converte a premissa em
**medição**: `count(*) FROM negocio.execucao_de_rotina === 0` **antes** da leitura, na mesma unidade.
É a R2 (regressão de prova) sendo fechada **antes** de virar defeito — o caso teria continuado verde
provando cada vez menos.

**Prova de falsificação da perna estática, e ela foi feita com rigor acima do pedido**: além da agulha
óbvia (**M1**, `UPDATE … SET status='VENCIDA'` → `3 failed`, nomeando arquivo e linha), o executor
plantou uma **segunda agulha deliberadamente fora do alcance do `CT-510`** (**M2**, `data_inicio_atraso`
→ `2 failed`), **isolando** o `CT-1096 (b)`. Sem a M2, o verde da M1 poderia ser mérito da rede
complementar, não da perna nova. Reversão conferida por `diff -q` e `git diff --stat` vazio.

**Seis divergências A1 declaradas e medidas** — as três que mais valem: (1) o `CT-1096` mora em
`cobranca.spec.ts` e não onde o card manda, porque `derivacao-de-cobranca.spec.ts` é **pura por decisão
registrada** e pôr instância efêmera ali obrigaria a **apagar a decisão** (R3); (3) `INSERT INTO
negocio.cobranca` ficou **fora** da lista de agulhas, porque a ADR-0022 proíbe **mover** o estado, não
**criar** o fato — incluí-lo faria o caso **reprovar código correto**; (4) a metade (b) do `D12` foi
**escriturada e não implementada**, porque o remédio exige fixar um **limiar de obsolescência**
(decisão de produto) e a forma prescrita **colide com o desenho registrado por extenso** no arquivo
(*"não há leitura antes da escrita"*).

**Conferência das duas pontas: íntegra**, declarada **40/40** antes e **41/41** depois, com todo
`ÍNDICE` resolvendo — inclusive o `D28 · F0/T5` na forma antiga que a §3-B tolera. O executor
reexecutou `@sysloc/shared` **depois** de editar o `CLAUDE.md`, para a barreira executável do
protocolo (CT-501 a CT-510, CT-907) — 271 verdes.

`[T11] Gate 1 despachado` · `scan_scope=FULL` · `tocou_area_critica=true`.

### T11 — Gate 1: APROVADO_COM_OBSERVACOES. O único achado é contra MIM.

`[T11] Gate 1 (QA, opus) → APROVADO_COM_OBSERVACOES` · **11/11** critérios · CT 1/1 ·
`security_flags: []` · `db` **268**, `shared` **271**, `api` **394**, os três medidos **pelo próprio
gate** e verdes.

- **BAIXO-001 · `documentation` · contra o ORQUESTRADOR**: a §1 do `run-report.md` dizia
  `6/11 tasks concluídas` e a **tabela estava malformada** — as linhas de T9 e T10 ficaram **órfãs**
  depois de um parágrafo em prosa, fora do corpo da tabela, e T7 e T8 **não apareciam**. Foi a minha
  inserção que partiu a tabela. **Corrigido**: §1 regenerada por inteiro (é snapshot, não append),
  `Status: 11/11`, tabela contínua de T1 a T11, o parágrafo movido para depois dela, mais a suíte
  final por pacote, a superfície e as rodadas por task. ⚠️ **A §2 estava íntegra** — é ela que a
  `/agent-spec-debt-resolution` consome, e o dano era só de leitura humana.
- **As SEIS divergências A1 julgadas PROCEDENTES, uma a uma, com medição própria do gate.** Ele
  refez a medição do `D26 · F3/T8` (dois consumidores, não três; `identificador-bancario.ts` só
  **menciona**; os símbolos de teste são `ultimoDiaDoMesDoControle`, outro símbolo) e a contagem das
  rotinas (**seis** entradas em `CADENCIA_DA_ROTINA`, seis `.timer`).
- **A conversão da premissa do `CT-512` foi auditada linha a linha e é real**: `contarExecucoesDeRotina`
  é a **primeira instrução** do bloco, antes da semeadura e das leituras; mesma unidade; nenhuma
  tarefa publicada. O gate notou dois reforços que o card **não** pedia: `execucoesDepois` também é
  medido em zero (**ler a cobrança não faz rotina nascer**) e `diasAtraso === 1` separa a derivação do
  vencimento de um carimbo.
- **A conferência das duas pontas foi REFEITA pelo gate, não aceita por declaração, e FECHA**:
  42 pares distintos no código, dos quais **um é o fixture `D99 · F7/T3`** que vive numa **string
  literal** do `CT-908` — o controle de não-cegueira da própria detecção —, restando **41**; a tabela
  do `CLAUDE.md` tem **41**; `diff` vazio nas duas direções. E ele cruzou com a **barreira executável**
  (`CT-907`), que afirma a mesma bijeção: *"minha conferência manual e a barreira concordam"*.
- **A `Decision` da ADR-0022 foi aberta no fonte** e o gate registrou que ela é **mais favorável ao
  marcador do que a citação sugere**: o `Context` nomeia o defeito medido (*"três derivações
  divergentes do status da mesma cobrança, ao ponto de o envio manual poder cobrar por uma dívida
  cancelada"*) e a alternativa rejeitada é **literalmente o modelo do legado com rotina noturna**.
- **Os dois marcadores de natureza oposta**: cada um **declara ativamente que não é o outro** — o
  `DECISÃO FECHADA` aponta para o `DÉBITO COM GATILHO — D26` no mesmo arquivo e delimita os alcances;
  o `D12` abre com *"(NÃO é uma DECISÃO FECHADA: ele agenda uma mudança, não protege a função
  abaixo.)"*. É exatamente o cuidado que a §3-B pede quando os dois convivem.
- **Detalhe de qualidade que o gate isolou na falsificação**: a linha esperada é apurada por um texto
  que **não é agulha nenhuma** (`UPDATE negocio.contrato`), *"de modo que a asserção mede o detector
  em vez de concordar com ele"*, e há a guarda `expect(defeituoso).not.toBe(integro)`, que impede a
  perna de "provar" o fonte íntegro caso a substituição um dia deixe de casar.
- ⚠️ O gate **sinalizou ao Gate 2** que a divergência #1 (o `CT-1096` fora do arquivo que a §5.2
  nomeia) é chamada do Tech Review quanto a `scope_deviation` — os 11 itens do Aceite Técnico são
  todos sobre **conteúdo** e nenhum nomeia arquivo.

`[T11] Gate 2 despachado` · `scan_scope=FULL`.

### T11 — Gate 2: PARCIAL. O bloqueante é uma leitura arquitetural que vale o run inteiro.

`[T11] Gate 2 (Tech Review, opus) → PARCIAL` · `adrs_consultadas: [0022, 0008, 0023, 0026, 0031]`,
com a **`Decision` da 0022 aberta no fonte**.

- **P1 · `MEDIO`/`architecture` · BLOQUEANTE** — o marcador declara alcançar *"o arquivo inteiro"*, e
  com isso **congelaria `ultimoDiaDoMes` e `ehBissexto`**, que são **exatamente** as duas funções que o
  `DÉBITO COM GATILHO — D26 · F3/T8`, **no mesmo arquivo**, agenda subir para módulo próprio. O
  revisor mediu o conteúdo: as 405 linhas derivam **parcelas de aluguel** e fazem aritmética
  gregoriana; **estado e mora não existem ali** — são derivados na visão, e o docblock logo acima do
  marcador já dizia isso por extenso. ⚠️ **O risco não é hipotético, e eu conferi o precedente**: o
  `D23 · F0/T3` está no índice do `CLAUDE.md` como *"BLOQUEADO por protocolo, não por tempo — extrair
  `redacao.ts` moveria código sob as duas `DECISÃO FECHADA` do arquivo"*. **O mesmo mecanismo já
  travou um débito neste repositório.** É a §3-B literal: *"Débito lido como decisão fechada congela o
  que deveria mudar."* O `D26` passaria a estar bloqueado **sem que ninguém tenha decidido bloqueá-lo**.
- **P2, P3, P4 · `BAIXO` → anotáveis.** Escriturados como `D25`, `D26` e `D27` na §2 (a §2 fecha em
  **27** blocos). O `D25` é premissa refutada — são **sete** fontes novos, não cinco —, **sem furo
  prático** e com a instrução explícita de **corrigir a redação, não inflar a lista**, porque inflar
  obriga a remedir a suíte sem ganho de detecção.
- **O gate absolveu com medição**: a divergência do placement do `CT-1096` **não é `scope_deviation`**
  (nenhum dos 11 itens do Aceite Técnico nomeia arquivo; o placement vive só na §5.2, *"que é o mapa e
  não o contrato"*), e ele somou um argumento que o executor não usara — o `CT-1096` é o complemento
  do `CT-512`, que **já mora** ali, *"pô-lo ao lado do caso que ele estende é coesão, não desvio"*.
  Confirmou também que existe **um segundo `DECISÃO FECHADA` sobre a mesma ADR-0022** (`cobranca.ts:889`)
  e que **não há duplicação nem contradição**: o antigo protege o **caminho de leitura**, o novo a
  **ausência de rotina que mova o estado**.
- **Refez a conferência das duas pontas de forma independente** e ela fecha em **41/41**, com o
  fixture `D99` corretamente excluído — é a **segunda** verificação independente, somada à do Gate 1 e
  à barreira executável do `CT-907`. Confirmou ainda que a forma proibida pela §3-B (`**Dnn**` fora da
  tabela) **não foi usada** nos parágrafos novos.

#### Decisão A1 — re-QA na rodada 2, divergindo do `requires_qa_revalidation: false` do gate

O gate devolveu `false`, argumentando que a correção é **comentário puro** e que abrir rodada de QA
por uma linha de docblock é o laço longo que a convergência existe para evitar. **O argumento é bom, e
ainda assim adoto o contrário** · razão: o algoritmo da `agent-spec-workflow-rules.md` tem **override
explícito** — *"independente da categoria, FORÇAR `requires_qa_revalidation = true` se QUALQUER:
`tocou_area_critica == true`"* —, e ele é `true` aqui; e a categoria `architecture` está em
`revalidation_required`. **O cálculo é meu, não do gate.** O custo é baixo (rodada em `DELTA`, um
arquivo) e o risco de pular é assimétrico. ⚠️ **E o próprio gate nomeou o cenário que justifica o
re-QA**: se a correção do `D25` inflasse a lista, `FONTES_NOVOS_DA_FATIA` e a âncora `toBe(5)`
mudariam e a suíte precisaria ser remedida — por isso instruí o executor a **não tocar** no `D25`.

`[T11] retry classification` — `attempt: 1` · `problemas_por_categoria: { architecture: 1,
testability: 2, scope_deviation: 1 }` · `overrides_ativos: [tocou_area_critica: true, task_risk:
medium]` · `requires_qa_revalidation: **true** (divergindo do gate)` · `decisao: NÃO pule o QA`.

`[T11] attempt_sha (rodada 1)=6b8e27bc414aa9b96558d4d2c3b3e8ad794d169b` — a rodada 2 roda em `DELTA`.
`[T11] correção rodada 2 despachada`: **um bloqueante, uma mudança**, e ela é só a frase de
delimitação. Os quatro campos canônicos do marcador ficam **byte a byte** — os dois gates já os
auditaram, e o Gate 2 abriu a `Decision` da ADR-0022 para conferir a citação palavra por palavra.

### T11 — Gate 2, segunda passagem: APROVADO. **RUN COMPLETO: 11/11.**

`[T11] Gate 2 → APROVADO` · `problems: []` · `requires_qa_revalidation: false` ·
`adrs_consultadas: [0022]`, aberta na `Decision` **no fonte**.

O revisor mediu o raio de impacto em vez de presumi-lo (**zero** linhas de código no delta: 5
inserções e 2 deleções, todas comentário) e respondeu à pergunta que eu havia feito sobre a frase
final: ela *"não deixa o alcance para o agente futuro INFERIR do escopo do arquivo, ela o RESOLVE por
antecipação, no caso concreto que ia acontecer"*, de modo que **o gatilho de parada continua armado
onde tem de estar, e desarmado onde era falso positivo**.

Confirmou que a restrição **não abriu buraco**: sob o alcance novo seguem vinculantes
`derivarParcelasDoContrato` e `ParcelaDerivada` — *"acrescentar `status`, mora ou `codigo` à parcela
continua violação"* —, e o que saiu foi *"o que nunca esteve protegido"*. E, sobre a composição final,
notou a simetria que só existe agora: **os dois marcadores opostos declaram a não-sobreposição pelas
DUAS pontas**, e não só por uma — *"é exatamente a simetria que a §3-B cobra quando os dois convivem
num arquivo"*.

`[T11] ledger: 8 achados totais | 4 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
— nenhum `{C}`: os quatro de `{B}` nasceram do Gate 2 estreando na task, não de varredura incompleta.

---

## Fecho do run — `automacoes-agendadas/v1`

- **11/11 tasks concluídas**, todas nos dois gates. `sdd_state.yaml` → `execution.status: completed`.
- **Suíte: 1943 casos** (eram 1842 na abertura), nove pacotes, medidos **um a um**.
- **Superfície: 106 rotas / 91 manipuladores**, `publicas` em 20, `semDeclaracao` vazio. ⚠️ **A última
  rota que este repositório publica.**
- **Índice de débito: 41 marcadores = 41 linhas**, bijeção conferida **três vezes de forma
  independente** mais a barreira executável.
- **§2 do `run-report.md`: 27 blocos.** `run-report.md` regenerado por inteiro (as 4 seções).
- **Rodadas de gate por task**: T1 2 · T2 1 · T3 3 · T4 3 · T5 1 · T6 4 · T7 2 · T8 2 · T9 3 · T10 3 ·
  T11 2. **Nenhuma task bloqueada; o limite de 3 tentativas não precisou ser excedido em nenhuma.**
- `[run] rule_candidates: 12 sinais persistidos` em `_run/rule-candidates.md`.
- **Staged, sem commit** — o usuário decide quando agrupar.
