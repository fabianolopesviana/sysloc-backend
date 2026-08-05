# Workflow Report — autorizacao-e-ciclo-de-acesso/v1

> Telemetria de pipeline, append-only. O relatório humano do run vive em `_run/run-report.md` e ainda não existe — a execução não começou.

## Challenge Session — 2026-08-04 (artifact: tech_spec.md)

- Questões processadas: 4
- Ajustes inline aplicados: 4
  - §4.1 + §11.2 — limite da garantia do Sysloc Master declarado; alvo da reemissão de Senha provisória restrito a `ADMIN_EMPRESA` (novo `422`)
  - §5.1 + §19.4 (CT-213) + §3.6 — regra de rotas públicas na verificação de cobertura; removida a modificação inócua em `saude.controller.ts`, que a guarda nunca alcançaria
  - §4.2 — alcance de `/v1/usuarios` canonizado (todas as pessoas da empresa, qualquer perfil)
  - §4.2 — matriz do perfil `SYSLOC_MASTER` declarada vazia, com a razão estrutural
- Conflitos de terminologia resolvidos: 1 (`/v1/usuarios` × "usuário", ambiguidade que o glossário global já resolvera em outro sentido)
- Decisões implícitas explicitadas: 2 (matriz do Master; rota pública não recebe marca de exigência)
- Contradições com código real: 1 (a modificação pedida em `saude.controller.ts` era inócua — a guarda retorna antes para rota pública)
- Termos canonizados no glossário: 6
  - GLOBAL (4): Área de tela · Ação sensível · Efetivo de permissão · Ajuste individual — mais 3 relacionamentos e 1 ambiguidade resolvida
  - FEATURE (2): Área de tela "Usuários" · Intenção declarada — glossário-feature **criado** nesta sessão
- Candidatos a ADR sinalizados: 1
- ADRs sugeridos para criação: 1 — "o alcance da garantia do operador do SaaS vale para a sessão dele, não para credencial que ele emite" (5/5 critérios; usuário optou por registrar)
- Violações de ADR encontradas: 0 — o inventário literal da FASE 4A do tech spec já havia detectado e resolvido a única (ADR-0007 → ADR-0012) antes desta sessão

---

## Run de execução — início 2026-08-04

- `[run] executor resolvido: __default__ (origem: descoberta interativa — `.claude/agents/` só contém os 3 agentes reservados aos gates; nenhum executor especialista disponível)`
- `[run] modelo fixado em opus para executor e gates — CLAUDE.md, decisão do usuário sem negociação; a heurística de sonnet do framework não se aplica neste projeto`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] autorização do usuário registrada (2026-08-04): (a) nenhuma pausa por AskUserQuestion — toda decisão assume a opção recomendada e o run segue; (b) o limite de 3 tentativas está suspenso — tasks correm até não restar bloqueante`
- `[run] baseline P1 (Protocolo Antirregressão): 274 casos verdes / 27 arquivos — auth 52, worker 16, db 30, api 50, shared 126`
- `[run] reconciliação de dependências: nenhuma divergência entre a tabela do task_plan.md e a seção 1 das 9 tasks`

### Fase 1 — decisão de paralelismo

`[Fase 1] paralelismo descartado: T1 e T2 removidas do lote — fallback determinístico para sequencial T1 → T2`

Motivos específicos, nesta ordem:

1. **Guard de alta contenção (literal)**: as duas tocam arquivo da lista canônica — T1 o diretório
   `packages/db/migracoes/**` mais `meta/_journal.json` (ledger de migrações + manifest), T2 o barrel
   `packages/auth/src/index.ts`. A regra manda remover **ambas** quando as duas tocam alta contenção.
2. **Recurso de execução compartilhado, não declarado nos paths**: T1 modifica
   `packages/auth/test/auditoria.spec.ts` — dentro do pacote cuja suíte T2 executa por
   `pnpm --filter @sysloc/auth test`, que roda o pacote inteiro. Executores concorrentes fariam T2
   rodar a suíte com o arquivo de T1 pela metade, produzindo falha espúria e queimando tentativa.
3. **Dependência de build**: `pnpm --filter @sysloc/auth test` encadeia `tsc --build`, que compila
   `@sysloc/db` — exatamente o pacote cujo esquema T1 está reescrevendo.

Os paths declarados são de fato disjuntos e o task_plan derivou `Sim` legitimamente a partir deles;
o que o derivador não enxergava era (2) e (3), que só aparecem no comando de teste do pacote. Default
conservador aplicado: falso-sequencial custa minutos, falso-paralelo corrompe a ordem.

### Ordem de execução

`T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9` (topológica; satisfaz as 9 declarações de dependência)

### T1 — Migrações 0003/0004 e o schema da autorização

- `[T1] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10`
- `[T1] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T1] critical_path=true (db_migrations + auth/security) → qa_model=opus, tech_model=opus`
- `[T1] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0012, ADR-0006 (fonte: task §7)`
- `[T1] arquivos tocados fora da §5.1/§5.2 (4, todos declarados pelo executor como arrasto do símbolo novo): packages/auth/src/autenticacao.ts · packages/auth/test/admissao.spec.ts · apps/api/test/recusa-indistinguivel.e2e.spec.ts · packages/db/test/unidade-de-trabalho.spec.ts — encaminhados ao Tech Review como candidatos a scope_deviation`
- `[T1] observação não-bloqueante: o diff contra base_sha inclui 8 arquivos de documentação (CLAUDE.md, docs/adr/*, docs/plano-backend-novo/*, docs/specs/domain-glossary.md) modificados ANTES do run — não são da task e foram subtraídos da lista enviada aos gates`
- `[T1] executor concluiu (rodada 1): 5 criados, 9 modificados; suíte 274 → 279`
- `[T1] Gate 1 rodada 1: REJEITADO — 1 ALTO (tests/tautological_assertion, CT-208 em auditoria.spec.ts). Suíte verde em 279; o achado é de qualidade de prova, não de comportamento.`
- `[T1] attempt_sha (rodada 1)=23174e420b7e99b86e3c720c93c1db461ab8003c`
- `[T1] correção rodada 2: saída (a) — asserção infalível e comentário falso removidos; linhas 276/281 intactas. 1 arquivo modificado.`
- `[T1] Gate 1 rodada 2 (scan_scope=DELTA, delta_arquivos=[packages/auth/test/auditoria.spec.ts]): APROVADO_COM_OBSERVACOES — QA-ALTO-001 sanado; 1 MÉDIO anotável (tests/eternal_beforeAll), miss declarado da rodada 1.`
- `[T1] o QA REFEZ a prova de falsificação por conta própria em vez de aceitar a declaração do executor — mutante em autenticacao.ts:758 reprovou a linha 281, fonte restaurado com hash conferido.`
- `[T1] rule_candidates: 2 sinais persistidos na rodada 1 (qa=2); rodada 2 dispensou a Camada 6.5 por ser retry.`
- `[T1] Gate 2 (scan_scope=FULL — primeira revisão do TR): APROVADO_COM_OBSERVACOES — 2 BAIXOS anotáveis (code_quality, scope_deviation). Nenhum bloqueante.`
- `[T1] TR consultou: ADR-0006, ADR-0008, ADR-0009, ADR-0012`
- `[T1] TR — observações relevantes: confronto item a item da §7.2 sem omissão; ADR-0009 verificada no snapshot (isRLSEnabled: false, sem policies); vetor cross-tenant fechado nas duas direções (MATCH SIMPLE com colunas NOT NULL + ON UPDATE no action); 23 contagens de marcador DECISÃO FECHADA idênticas antes e depois; encadeamento prevId dos snapshots impede a próxima geração de reemitir o ADD VALUE.`
- `[T1] TR — nota para a task que implementar a comparação de versão: sessão anterior à migração herda telas={}, acoes={} e versao_permissoes=0; decidir explicitamente o que fazer com ela.`
- `[T1] ledger: 4 achados totais | 3 originados em rodada >1 | 1 suspeito de incompletude da rodada 1 (QA-MED-001, declarado miss pelo próprio gate; os 2 do TR não contam — o TR não rodara antes)`
- `[T1] staged: 12 arquivos`
- `[T1] CONCLUÍDA — QA APROVADO_COM_OBSERVACOES (rodada 2) · Tech Review APROVADO_COM_OBSERVACOES (rodada 1) · 2 rodadas de executor`

### T2 — Catálogo, matriz por perfil e cálculo do efetivo

- `[T2] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — a T1 está staged, não commitada; o filtro de resíduo por paths isola a T2)`
- `[T2] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: medium`
- `[T2] critical_path=true (packages/auth/** → categoria auth) → qa_model=opus, tech_model=opus`
- `[T2] ADRs injetadas no executor: ADR-0010, ADR-0011, ADR-0012 (fonte: task §7)`
- `[T2] executor rodada 1: 4 criados, 5 modificados; suíte 279 → 299 (+20 casos: CT-201 a CT-205)`
- `[T2] arquivos tocados fora da §5.1/§5.2 (4): packages/auth/package.json · packages/auth/tsconfig.json · pnpm-lock.yaml (dependência @sysloc/shared, exigida pelo ErroDeAplicacao/CAMPO_INVALIDO) · packages/auth/test/admissao.spec.ts (inventário de superfície do CT-026, 23 → 30) — encaminhar ao Tech Review como candidatos a scope_deviation`
- `[T2] Gate 1 rodada 1: REJEITADO — 1 ALTO (tests/tautological_assertion, CT-201). Causa-raiz na SPEC, não no executor: o card §6.6 exigia a asserção antes de a derivação CHAVES_DE_ACAO ← MAPA_ACAO_TELA existir.`
- `[T2] attempt_sha (rodada 1)=35b71512bb3f72856488c7ff250ffb6793140464`
- `[T2] correção rodada 2: asserção tautológica → duas asserções de prefixo (uma por eixo); card do CT-201 na T2.md corrigido junto, para a spec não reintroduzir a linha.`
- `[T2] o executor DIVERGIU do mutante prescrito pelo QA e mediu por quê: 'ACOA:emitir_boleto' aborta em tsc --build (17 erros TS2345/TS2820) antes do Vitest, o que é prova inconclusiva. Usou 'ACOA:enviar_cobranca_manual', que não tem referência fora do mapa. O QA reproduziu e deu razão ao executor.`
- `[T2] Gate 1 rodada 2 (scan_scope=DELTA, delta_arquivos=[packages/auth/test/autorizacao.spec.ts]): APROVADO_COM_OBSERVACOES — QA-ALTO-001 sanado com mutação executada nos DOIS eixos (o QA cobriu o eixo das telas por conta própria); 1 BAIXO anotável (documentation).`

---

## ⏸️ PAUSA CONTROLADA — 2026-08-04, autorizada pelo usuário

**Motivo**: o usuário precisa sair da sessão e retornar em seguida. A pausa foi pedida
explicitamente para o instante em que o validador retornasse, e é isso que este ponto marca.

**As duas autorizações do run permanecem válidas na retomada**, por declaração do usuário:
(a) nenhuma pausa por `AskUserQuestion` — toda decisão assume a opção recomendada;
(b) o limite de 3 tentativas por task segue **suspenso**.

### Estado no momento da pausa

| | |
|---|---|
| Tasks concluídas | **1/9** — T1 (staged, não commitada) |
| Task em andamento | **T2** — os dois executores rodaram, **Gate 1 APROVADO_COM_OBSERVACOES**; **falta o Gate 2** |
| Suíte | **299 casos verdes** (baseline de entrada do run: 274) |
| `base_sha` de T1 e T2 | `bfe234be162df453c5eaf709df2b3e938c5d7e10` (HEAD não moveu — nada foi commitado) |
| Memória lazy viva | `_run/tmp/T2.md` (a de T1 foi apagada no fechamento dela) |

### O PRÓXIMO PASSO EXATO na retomada

**Despachar o Gate 2 (`agent-spec-staff-architecture-review`, modelo `opus`) para a T2**, com:

- `base_sha` = `bfe234be162df453c5eaf709df2b3e938c5d7e10`
- `scan_scope` = **FULL** — é a primeira revisão do Tech Review nesta task (ele não viu este código; as duas rodadas foram do QA)
- **Sumário mínimo do QA** (só estes campos): `veredito: APROVADO_COM_OBSERVACOES`, `security_flags: []`,
  `executou_testes: true`, `escopo_testes: SUITE_COMPLETA`, `tocou_area_critica: true`,
  `escopo_declarado` com as três listas vazias
- **Arquivos NOVOS**: `packages/auth/src/catalogo-de-permissoes.ts`, `matriz-de-perfil.ts`, `efetivo.ts`, `packages/auth/test/autorizacao.spec.ts`
- **Arquivos MODIFICADOS**: `packages/auth/src/index.ts`, `packages/auth/test/admissao.spec.ts`
- **Bloco "Arquivos tocados NÃO declarados"** (candidatos a `scope_deviation`): `packages/auth/package.json`,
  `packages/auth/tsconfig.json`, `pnpm-lock.yaml`, `packages/auth/test/admissao.spec.ts`
- **Aviso obrigatório ao TR**: o `git diff` contra este `base_sha` traz **também** os 14 arquivos da **T1**
  (staged, não commitada) e 8 de documentação modificados antes do run. **Nada disso é da T2.**
  `packages/auth/test/admissao.spec.ts` foi tocado pelas duas — a T1 trocou um rótulo de enum, a T2
  acrescentou 7 entradas ao inventário.
- **ADRs a consultar**: ADR-0010, ADR-0011, ADR-0012
- **Decisões do executor que o TR deve julgar**: `@sysloc/shared` como dependência nova de `@sysloc/auth`;
  o padrão `['TELA:resumo']` para `USUARIO_EMPRESA`, escolhido pelo executor porque nenhum artefato o fixa;
  `MAPA_ACAO_TELA` como declaração do eixo das ações; `AjusteDePermissao` sem o campo `tipo` que o DTO da §4.2 mostra.

Depois disso: interpretar o veredito, manter o Ledger, `git add` da T2, marcar `Concluído` em
`tasks/T2.md` e no `task_plan.md`, `tasks_completed: 2` no `sdd_state.yaml`, regenerar o
`run-report.md` com os débitos acumulados, registrar a métrica do ledger e apagar `_run/tmp/T2.md`.
Em seguida, **T3** (deps T1+T2, ambas satisfeitas na ordem `T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9`).

## ▶️ RETOMADA — 2026-08-04

- `[run] resume pós-pausa: estado conferido e íntegro — HEAD em bfe234be (não moveu), memória lazy _run/tmp/T2.md viva, T1 staged, T2 Em Progresso com Gate 1 aprovado. Nenhuma divergência com o registrado na pausa.`
- `[run] resume: opção (a) Retomar nos gates assumida sem perguntar, por autorização permanente do usuário (a resposta é sempre a recomendada). Não houve reexecução — o código da T2 está íntegro e já validado pelo Gate 1.`
- `[run] autorizações reafirmadas pelo usuário na retomada: (a) nenhuma pausa por AskUserQuestion; (b) limite de 3 tentativas suspenso.`
- `[T2] Gate 2 despachado (scan_scope=FULL — primeira revisão do TR nesta task), tech_model=opus`
- `[T2] Gate 2 (scan_scope=FULL): APROVADO_COM_OBSERVACOES — 2 MÉDIOS anotáveis (best_practices, project_pattern) + 4 BAIXOS. Nenhum bloqueante pela partição.`
- `[T2] TR consultou: ADR-0010, ADR-0011, ADR-0012 — todas CONFORMES`
- `[T2] TR — aresta @sysloc/auth → @sysloc/shared JULGADA LEGÍTIMA, não é scope_deviation: conforma à §3.3 do tech spec, sem ciclo, e só em dependencies. Nenhum sinal scope_deviation emitido.`
- `[T2] TR — anti-gaming (AP-24) limpo; nenhum marcador DECISÃO FECHADA ou DÉBITO COM GATILHO alterado no diff de packages/auth.`
- `[T2] TR — verificou o P1 POR EXECUÇÃO: compilou a forma proposta com tsc --strict antes de sugeri-la (mapa íntegro compila; entrada malformada recusada com TS2353).`
- `[T2] TR — comportamento positivo a preservar: MATRIZ_POR_PERFIL[perfil] com perfil fora do enum degrada FECHADO (Set vazio). Uma "melhoria" futura com ?? TODAS_AS_CHAVES inverteria isso em silêncio.`
- `[T2] ⚠️ TR — RISCO PROPAGADO PARA A T3: calcularEfetivo acrescenta ajuste.chave sem conferir pertinência ao catálogo (por design — a conferência é da borda). A T3 lê os ajustes do banco, onde chave é text: se a LEITURA não passar por ehChaveDoCatalogo, uma chave órfã de catálogo anterior entra no efetivo e vaza em GET /v1/sessao. Recomendação: aplicar o predicado na leitura, não só na escrita.`
- `[T2] ledger: 8 achados totais | 7 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1 (o BAIXO do QA é sobre o delta da rodada 2; os 6 do TR vêm de gate que não rodara antes)`
- `[T2] staged: 11 arquivos`
- `[T2] CONCLUÍDA — QA APROVADO_COM_OBSERVACOES (rodada 2) · Tech Review APROVADO_COM_OBSERVACOES (rodada 1) · 2 rodadas de executor`

### T3 — Ajustes de permissão sob contexto de tenant, com incremento do contador

- `[T3] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — T1 e T2 staged, não commitadas; o filtro de resíduo por paths isola a T3)`
- `[T3] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T3] critical_path=true (security — o módulo escopa permissão sob RLS) → qa_model=opus, tech_model=opus`
- `[T3] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0010, ADR-0006 (fonte: task §7)`
- `[T3] risco do TR da T2 propagado ao executor: aplicar ehChaveDoCatalogo na LEITURA dos ajustes, não só na escrita — chave órfã de catálogo anterior entraria no efetivo e vazaria em GET /v1/sessao`
- `[T3] executor rodada 1: 1 criado, 4 modificados; suíte 299 → 305 (+6 casos). Delta EXATAMENTE nos 4 arquivos declarados — nenhum desvio de escopo.`
- `[T3] Gate 1 rodada 1: REJEITADO — 1 ALTO (tests/happy_path_only) + 1 BAIXO. security_flags: [untested_tenant_scope_guard_on_cross_schema_write]. Critério AT-05 PARCIAL.`
- `[T3] ⚠️ o QA CONSTRUIU um mutante que sobrevivia à suíte inteira: removido o join ao vínculo de incrementarVersaoPermissoes (forma WHERE u.id = $1, que o próprio docblock proíbe) → 39/39 VERDE. A asserção estática do CT-209 não pega a classe: ela procura PRESENÇA de filtro por empresa, e o defeito é AUSÊNCIA do join.`
- `[T3] attempt_sha (rodada 1)=819b3117611f8882c27a4d9f89ca4e9cc0857fa8`
- `[T3] correção rodada 2: companheiro negativo de tenant do lado da ESCRITA — 6 células (3 operações × 2 alcances), duas pernas por célula, estado bit a bit lido sob o contexto de A, estado de partida NÃO vazio e companheiro positivo. 1 arquivo modificado.`
- `[T3] Gate 1 rodada 2 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES — QA-ALTO-001 sanado com o mutante REFEITO por execução (1 failed | 39 passed, só o caso novo, nomeando as duas células). AT-05 fechado. security_flags volta VAZIA. 1 BAIXO novo (documentation, no comentário homólogo do CT-005).`
- `[T3] Gate 2 despachado (scan_scope=FULL — primeira revisão do TR nesta task), tech_model=opus`
- `[T3] Gate 2 (scan_scope=FULL): APROVADO_COM_OBSERVACOES — 4 BAIXOS anotáveis. Nenhum bloqueante.`
- `[T3] TR consultou: ADR-0008, ADR-0009, ADR-0010, ADR-0011`
- `[T3] ✅ QUESTÃO DEFERIDA RESOLVIDA — o uso do tx da unidade de trabalho para escrever em identidade CONFORMA à ADR-0009 (não é desvio justificado; é a leitura correta). Cinco fundamentos no texto literal: (1) o Decision versa sobre ONDE as tabelas moram, não institui caminho de acesso; (2) o Cons prevê e aceita a consulta cross-schema, exigindo apenas a qualificação de schema que o módulo cumpre; (3) a alternativa "bancos separados" foi rejeitada JUSTAMENTE por perder a transação única — abrir abrirAcessoAIdentidade reproduziria essa perda; (4) a alternativa "regime único com via privilegiada" caiu por criar o segundo caminho para o dado — o tx é o caminho único; (5) o cabeçalho de acesso-identidade.ts já declara a verdade simétrica. Precedente aprovado no mesmo run: a criarPessoa do CT-207 (T1).`
- `[T3] TR — as 4 brechas hipotéticas de escopo estão fechadas pelo SCHEMA, não por disciplina: múltiplos vínculos (impossível pela unicidade + FK composta), Master com empresa nula (nenhum vínculo visível), escalada a SYSLOC_MASTER (barrada pelo CHECK), vínculo inativo (a tabela não tem coluna de estado — fora de T3).`
- `[T3] TR — propriedade emergente registrada: o incremento final funciona como PÓS-CONDIÇÃO; se o vínculo desaparecer no meio da transação, o UPDATE afeta zero linhas e a unidade inteira cai. Fail-closed sem ramo condicional.`
- `[T3] TR — riscos propagados para T4/T8: (a) PUT parcial que envie só o ajuste alterado APAGA os demais (escreverAjustes substitui o conjunto) — a rota precisa exigir o conjunto completo no contrato; (b) mapear ErroDePessoaForaDoContexto para o envelope da ADR-0012, não deixar cair como 500; (c) desestruturar e REGISTRAR chavesDesconhecidas; (d) provar que a rota recusa chave fora do catálogo com 422 CAMPO_INVALIDO.`
- `[T3] ledger: 7 achados totais | 5 originados em rodada >1 | 1 suspeito de incompletude da rodada 1 (QA-BAIXO-002 — o comentário do CT-005 já existia e não estava no delta da correção)`
- `[T3] staged: 4 arquivos`
- `[T3] CONCLUÍDA — QA APROVADO_COM_OBSERVACOES (rodada 2) · Tech Review APROVADO_COM_OBSERVACOES (rodada 1) · 2 rodadas de executor`

### T4 — Ponto de aplicação: decisão, exigência, guarda com revalidação e sessão

- `[T4] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — T1/T2/T3 staged, não commitadas)`
- `[T4] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high — a task de MAIOR risco da fatia (modifica a guarda que toda requisição atravessa)`
- `[T4] critical_path=true (auth + security) → qa_model=opus, tech_model=opus`
- `[T4] ADRs injetadas no executor: ADR-0010, ADR-0011, ADR-0012, ADR-0008, ADR-0009 (fonte: task §7)`

#### ⚠️ Decisão do orquestrador — CTs da T4 pressupõem rotas que não existem

Inventário de `apps/api/src` no início da task: **três controladores apenas** — `saude.controller.ts`
(`/saude`, `/saude/pronto`), `sessao.controller.ts` (`GET /v1/sessao`) e `autenticacao.controller.ts`
(o encaminhador `@All('*')` de `/v1/auth`). **Nenhuma rota de negócio existe.**

Os cards de CT-211, CT-214, CT-215, CT-217 e CT-218 pressupõem rotas que **não existem e não nascem
nesta fatia**: as 17 chaves são áreas e ações do app da imobiliária (imóveis, contratos, financeiro,
cobrança), entregues nas fases **F2 a F5**. O `POST /v1/master/empresas` do CT-215 nasce na **T7** e
o `GET /v1/usuarios` na **T8** — nenhum dos dois está disponível quando a T4 roda.

**Decisão, assumida como a recomendada por autorização permanente do usuário** (nenhuma pausa por
`AskUserQuestion`; a resposta é sempre a recomendada):

> Os CTs exercitam a guarda **real**, o decorator **real** e a decisão **real** contra **rotas
> sintéticas montadas dentro do próprio arquivo de teste**, em `apps/api/test/`.

Razões, na ordem em que pesam:

1. **Preserva integralmente o invariante.** O que o CT-211 existe para provar é *"para cada uma das
   17 chaves, quem a tem alcança e quem não a tem é recusado nomeando-a"* — propriedade da **guarda**,
   não das rotas de negócio. Rota sintética com o decorator real exercita exatamente isso, com
   fronteira HTTP real.
2. **Criar 17 rotas de produção seria violação séria.** A superfície da API **congela no marco de
   entrega** (decisão do pré-refinamento) e é o que o `@sysloc/contracts` publica ao React. Rotas de
   negócio vazias criadas na F1 poluiriam o contrato publicado e seriam reprovadas como
   `speculative_complexity`.
3. **Não viola a Lei do seam** (Iron Law #6): nenhum símbolo de produção nasce para teste — o módulo
   sintético vive em `apps/api/test/`, fora de `apps/api/src/`.
4. **Não contamina o CT-216.** A varredura do ponto de aplicação único varre `apps/api/src`; rota de
   teste não entra nesse conjunto, e a cardinalidade 1 continua significando o que deve significar.

Alternativa rejeitada: adiar os cinco CTs para a T7/T8. Quebraria a rastreabilidade CA→CT da task,
deixaria a **T5** (verificação de cobertura) dependente de uma T4 parcial — e a §6 do task_plan é
explícita ao exigir que a T5 só rode com a T4 **completa**, não parcial.
- `[T4] executor rodada 1: 4 criados, 9 modificados; suíte 306 → 315 (+9 casos)`
- `[T4] ⚠️ DEFEITO REAL DE PROJETO achado e fechado pelo executor: a linha de identidade.sessao nasce com versao_permissoes=0 e a pessoa também — a comparação daria 0===0 para TODA sessão recém-criada, e um Admin entraria alcançando NADA, para sempre, sem que divergência alguma aparecesse. Fechado pelo predicado 'montado' + escrita idempotente. Resíduo declarado: o Master relê ajustes a cada requisição, sem escrita. Fecho limpo (DEFAULT -1 na coluna) exigiria editar a migração 0003 da T1 — fora do escopo.`
- `[T4] executor divergiu da leitura literal do §3 da task e seguiu a §5.1 da tech spec (metadado como passo 1, ANTES da sessão). O QA julgou: resolvido do lado certo, com a consequência asserida no CT-216(b).`
- `[T4] Gate 1 rodada 1: REJEITADO — 1 ALTO (tests/tautological_assertion) + 1 BAIXO. 11/11 critérios atendidos; o problema era exclusivamente de FORÇA DE PROVA.`
- `[T4] ⚠️ o QA construiu 5 mutantes; 4 foram DETECTADOS (metadado ausente que passa; guarda que não compara versão; exigido genérico; e o par do CT-216). O 5º SOBREVIVEU: reescrita em toda requisição — porque as asserções observavam o VALOR das colunas, e reescrita idempotente não muda valor.`
- `[T4] attempt_sha (rodada 1)=9cced0259455889906561aaa077eb4ae0c560cd4`
- `[T4] correção rodada 2: o executor MEDIU antes de escolher a via — xmin deu 4 versões de tupla para 3 leituras autenticadas (RENOVACAO_DA_SESSAO_EM_SEGUNDOS=0 faz toda leitura reescrever a linha), o que descarta por medição observar o marcador na camada de rota. Prova desceu uma camada: packages/auth/test/reescrita-do-efetivo.spec.ts, com o par (i)/(ii) sobre xmin.`
- `[T4] Gate 1 rodada 2 (scan_scope=DELTA): APROVADO — ZERO problemas. O QA refez o mutante duplo (1 failed | 74 passed no auth; 59 passed no api sob o MESMO mutante, confirmando a necessidade da descida) e REPRODUZIU a medição do xmin em vez de aceitá-la.`
- `[T4] Gate 2 despachado (scan_scope=FULL — primeira revisão do TR nesta task), tech_model=opus`
- `[T4] Gate 2 (scan_scope=FULL): APROVADO_COM_OBSERVACOES — 6 BAIXOS. Nenhum bloqueante.`
- `[T4] TR consultou: ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012`
- `[T4] TR — verificações estruturais: nenhum marcador DECISÃO FECHADA existe em contexto.guard.ts (o prompt supunha que sim; os vivos estão em filtro-excecao.ts e autenticacao.ts, e o diff não toca nenhum); invariante "nenhum ramo por perfil" confirmado por grep (zero ocorrências de perfil=== ou SYSLOC_MASTER fora de prosa); cobertura de declaração conferida por inventário de decoradores nos 4 pontos de rota de produção; a reescrita do registro de sessão NÃO abre janela de corrida (UPDATE único das três colunas; o estado é auto-corretivo).`
- `[T4] TR — apontou que packages/auth/test/reescrita-do-efetivo.spec.ts estava untracked e pediu conferência do git add. FEITO: o arquivo entrou no stage da task.`

#### ⚠️ Achado P1 do Tech Review REJEITADO pelo orquestrador — premissa factualmente incorreta

O P1 afirmava: *"O único ponto do repositório que incrementa `identidade.usuario.versao_permissoes`
é `escreverAjustes`"*, e concluía que o docblock da guarda (*"alguém ajustou permissão **ou trocou o
perfil dela**"*) é falso, propondo um `DÉBITO COM GATILHO` para a T8.

**A premissa é falsa, e a evidência é direta**: `packages/db/src/permissao.ts:397` — a última linha de
`trocarPerfilDaPessoa` é `return await incrementarVersaoPermissoes(tx, entrada.usuarioId)`. As duas
escritas chamam a mesma primitiva (linhas 357 e 397). O TR parece ter grepado o `versao_permissoes + 1`
literal e parado no corpo de `incrementarVersaoPermissoes`, sem seguir os dois chamadores.

Isso **já estava provado** antes desta task: o **CT-210 da T3** exercita a troca de perfil como passo 3
e assere o contador em `2` depois dela (`unidade-de-trabalho.spec.ts:1169-1172`), e o QA da T3
verificou os valores exatos `0 → 1 → 2`.

**Conclusão**: o docblock da guarda está **correto**; não há débito, não há marcador a emitir, e o D16
que este achado geraria **não entra na §2 do run-report**. Os outros cinco achados do TR seguem
válidos e foram registrados. Registro aqui porque débito falso no relatório engana a próxima sessão
tanto quanto débito omitido.
- `[T4] ledger: 8 achados totais | 6 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1 (os 6 do TR vêm de gate que não rodara antes; 1 dos 6 foi rejeitado por premissa falsa)`
- `[T4] staged: 14 arquivos`
- `[T4] CONCLUÍDA — QA APROVADO (rodada 2, zero problemas) · Tech Review APROVADO_COM_OBSERVACOES (rodada 1) · 2 rodadas de executor`

### T5 — Verificação de cobertura de autorização sobre a superfície publicada

- `[T5] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — T1..T4 staged)`
- `[T5] executor: opus (declarado)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T5] critical_path=true (security) → qa_model=opus, tech_model=opus`
- `[T5] ADRs injetadas no executor: ADR-0011, ADR-0012 (fonte: task §7)`
- `[T5] risco do TR da T4 propagado (D16): o CT-216 prova cardinalidade do SÍMBOLO, não ausência de segunda avaliação — um manipulador pode ler sessao.telas diretamente e escapar. A T5 verifica que toda rota DECLARA, não que nenhum manipulador REAVALIA; a lacuna permanece e vale ser considerada aqui.`
- `[T5] executor rodada 1: 2 criados, 0 modificados — a task era aditiva por especificação e o delta confirmou. Suíte 316 → 319.`
- `[T5] Gate 1 rodada 1: APROVADO — ZERO problemas. É a PRIMEIRA task do run aprovada na rodada 1.`
- `[T5] o QA refez as DUAS provas de falsificação por execução, com mutantes no fonte de PRODUÇÃO: (i) marca @NaoExigePermissao removida de SessaoController → 14 failed, com semDeclaracao povoado; (ii) @RotaPublica aplicada a SessaoController → 14 failed, com excedentes=['/v1/sessao'] na asserção (b). Mais uma prova extra da contagem exata (descarte de /LICENSE → 'expected 12 to be 13').`
- `[T5] o QA confirmou que NÃO há reimplementação do leitor — o verificador obtém a instância de Reflector da própria aplicação e faz a MESMA chamada, com a MESMA chave e a MESMA precedência da guarda. Era o risco nº 1 da task.`
- `[T5] resultado da verificação sobre a produção: semDeclaracao=[] · comExigencia=['/v1/sessao'] · publicas=12 · rotasEnumeradas=13. Nenhuma rota de produção ficou sem declaração — o inventário da T4 se confirmou por estrutura.`
- `[T5] ⚠️ fato de segurança tornado visível pela T5 (herdado, não introduzido): as 9 rotas do contrato ts-rest NÃO têm manipulador do arcabouço, logo o global guard NÃO corre nelas — incluindo o documento OpenAPI e a página de contrato, servidos sem sessão. Já inventariado pela fatia anterior por comportamento (CT-020 d); a T5 o torna visível por ESTRUTURA. Encaminhado ao Gate 2.`
- `[T5] Gate 2 despachado (scan_scope=FULL), tech_model=opus`
- `[T5] Gate 2 rodada 1: PARCIAL — 1 ALTO bloqueante (architecture) + 2 MÉDIOS anotáveis (code_quality) + 3 BAIXOS.`
- `[T5] ⚠️ ACHADO ALTO do TR, verificado EMPIRICAMENTE por ele contra o dist/ compilado: a cobertura chaveia por CAMINHO, não por método+caminho. Dois manipuladores no mesmo caminho — o desenho REST padrão @Get() de lista + @Post() de criação no mesmo @Controller — fazem a função LANÇAR e a verificação inteira ABORTA. Não é risco hipotético: a §5.3 da tech spec declara POST e GET /v1/master/empresas na US-01, que a T7 vai publicar. A falha é barulhenta (nada shipa aberto), mas quebraria a T7 numa mensagem que apresenta desenho REST legítimo como ambiguidade da aplicação.`

### T5 — retry classification
- attempt: 1
- problemas_por_categoria: { architecture: 2 (1 ALTO + 1 BAIXO), code_quality: 2 (MÉDIO), security: 1 (BAIXO), project_pattern: 1 (BAIXO) }
- overrides_ativos: [tocou_area_critica: true, task_risk: high, qa_security_flags: [], diff_stat_changed: previsto]
- requires_qa_revalidation: true
- decisao: RE-QA (a correção volta ao Gate 1 antes do Gate 2)
- justificativa: "o único bloqueante é ALTO em `architecture`, categoria revalidation_required; e os overrides tocou_area_critica e task_risk=high forçariam true de qualquer forma"
- `[T5] correção rodada 2: granularidade alinhada em TODOS os pontos — chaveDaRota(metodo, caminho) sob marcador DECISÃO FECHADA; metodosPorCaminho suprime o HEAD derivado POR PRESENÇA DO GET (não por posição — o executor mediu que a árvore imprime ora (GET, HEAD), ora (HEAD, GET)); metodosDoManipulador traduz METHOD_METADATA pelo enum do arcabouço; @All reivindica os 7 verbos que o roteador publica. Cardinalidade 13 caminhos → 19 pares.`
- `[T5] Gate 1 rodada 2 (scan_scope=DELTA): APROVADO_COM_OBSERVACOES — TR-P1 SANADO com o mutante M6 refeito pelo QA (3 failed, reproduzindo literalmente o achado do TR). 1 BAIXO novo (logic): @Head() EXPLÍCITO convivendo com @Get() no mesmo caminho aborta — mesma FORMA do TR-P1, em construto muito mais raro, e o QA MONTOU o caso para medir.`
- `[T5] o QA verificou por montagem própria que @Head() SOZINHO continua produzindo entrada e que o GET não se perde na supressão — não há perda silenciosa. Refez também o mutante da contagem exata (expected 18 to be 19).`
- `[T5] Gate 2 re-despachado (scan_scope=DELTA, attempt_sha_anterior=eeaa2fb75eebb7c8a90acd8b7b000b191ad25225), tech_model=opus`
- `[T5] Gate 2 rodada 2 (scan_scope=DELTA): APROVADO — ZERO problemas. TR-P1 fechado; o TR conferiu o alinhamento de granularidade ponto a ponto e concordou com BAIXO para o achado do @Head().`
- `[T5] TR consultou: ADR-0011 (realizada, não deslocada — sem a correção a verificação se autodesligaria na primeira montagem da T7)`
- `[T5] TR — ressalva precisa registrada: sobra resíduo de granularidade por caminho no eixo da ENUMERAÇÃO (metodosPorCaminho decide o HEAD olhando o caminho inteiro). Mesma FORMA do TR-P1, mecanismo e função diferentes. É o D26.`
- `[T5] TR — "duas guardas novas" se sustenta pela METADE: a colisão por par é ESTREITAMENTO da guarda que já existia (e o estreitamento é o ganho); guarda genuinamente nova há uma, e o primeiro caso conhecido a alcançá-la é legítimo. Mantê-la é certo — sem ela, declaração pendurada em chave não consultada faria o par publicado cair no conjunto PÚBLICO: troca de aborto barulhento por liberação silenciosa.`
- `[T5] TR — riscos herdados por T7/T8: (a) rota nova custa DOIS arquivos com FORMATOS diferentes (par × caminho, mesma constante ROTAS_PUBLICAS_ACEITAS); (b) rota pública sob @All custa N linhas; (c) METODOS_DO_ENCAMINHADOR fixa os 7 verbos — bump do adaptador reprova a contagem, por desenho; (d) a contagem exata (19) reprova a cada rota nova até alguém olhar.`
- `[T5] ledger: 7 achados totais | 1 originado em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T5] staged: 2 arquivos`
- `[T5] CONCLUÍDA — QA APROVADO (r1) → Gate 2 PARCIAL (r1) → QA APROVADO_COM_OBSERVACOES (r2) → Tech Review APROVADO (r2) · 2 rodadas de executor`

### T6 — Campos com escrita fechada, onboarding e limitador (fecha D7 e o P-T6-2 parcial)

- `[T6] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — T1..T5 staged)`
- `[T6] executor: opus (declarado)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T6] critical_path=true (auth + security) → qa_model=opus, tech_model=opus`
- `[T6] ADRs injetadas no executor: ADR-0008, ADR-0009, ADR-0013, ADR-0012 (fonte: task §7)`
- `[T6] coordenação de marcador: o D7 e o D21 vivem no MESMO arquivo (packages/auth/src/autenticacao.ts). A T9 (que fecha o D21) ainda NÃO rodou — instrução ao executor: remover SÓ o marcador do D7 e a linha correspondente do CLAUDE.md, deixando o do D21 intacto.`
- `[T6] Gate 1 rodada 1: REJEITADO — 1 ALTO (security, weakened_rate_limit) + 1 BAIXO. security_flags não vazia.`
- `[T6] ⚠️ o executor JÁ TINHA achado sozinho que a 1ª versão do CT-235 não discriminava: sobre pessoa COM vínculo, quem barra a troca de empresa é a FK composta da T1, no banco, ANTES da defesa de aplicação. Reescreveu para pessoa recém-criada sem vínculo. O QA confirmou com precisão a mais: quem discrimina é a perna (c) ({empresaId} sozinho), não a (b).`
- `[T6] attempt_sha (rodada 1)=9fa20c7fa4a7cdba039c0e4265d1633047418fb3`
- `[T6] Gate 1 rodada 2 (DELTA): APROVADO_COM_OBSERVACOES — flag sanada; 1 BAIXO (tests/tautological_assertion). O QA MEDIU no pacote publicado o wildcardMatch, a ordem de resolução de customRules e o accountLockout, em vez de ler.`
- `[T6] Gate 2 rodada 1 (FULL): PARCIAL — 1 ALTO + 1 MÉDIO, ambos security e ambos BLOQUEANTES, + 3 BAIXOS.`
- `[T6] ⚠️⚠️ ACHADO ALTO DO TR — o limitador foi ligado SEM EIXO DE IDENTIDADE CONFIÁVEL. Medido no pacote publicado: sem advanced.ipAddress declarado, (a) getIPFromHeader aceita x-forwarded-for COMO O CLIENTE ENVIA (sem trustedProxies) — rotacionar o cabeçalho dá balde novo a custo zero; (b) sem cabeçalho algum, que é o estado de HOJE (a borda só chega na F7 — D23), getIp devolve null em produção e a chave vira 'no-trusted-ip|<caminho>': UM BALDE ÚNICO POR CAMINHO PARA O PRODUTO INTEIRO. 31 pedidos/min de qualquer lugar recusariam a ENTRADA de todos. As duas pernas do CT-236 só provam partição por origem porque INJETAM o cabeçalho sob NODE_ENV=test — a suíte exercita configuração diferente da que atende a operação.`
- `[T6] TR — P2 MÉDIO security (bloqueante): /two-factor/* teve a única proteção explícita substituída por PADRÃO IMPLÍCITO de biblioteca. accountLockout não aparece na configuração do plugin e nenhuma asserção o ancora — é o mesmo raciocínio que o bloco recusa duas vezes para os outros caminhos.`
- `[T6] TR — confirmou por conta própria que input:false fecha a CLASSE: todo caminho que converte corpo em dado de user passa por parseUserInput/parseInputData; disableSignUp ligado, sem provedor social, e o plugin de 2º fator não escreve campo de user a partir de corpo.`

### T6 — retry classification
- attempt: 2
- problemas_por_categoria: { security: 2 (1 ALTO + 1 MEDIO), project_pattern: 1 (BAIXO), error_handling: 1 (BAIXO), code_quality: 1 (BAIXO) }
- overrides_ativos: [tocou_area_critica: true, task_risk: high]
- requires_qa_revalidation: true
- decisao: RE-QA (a correção volta ao Gate 1 antes do Gate 2)
- justificativa: "os dois bloqueantes são `security`, categoria revalidation_required; e os overrides forçariam true de qualquer forma"
- `[T6] correção rodada 3: P1 resolvido pela SAÍDA 2 (débito com gatilho D27) — o executor VERIFICOU que a saída 1 era impossível (ENDERECO_DE_ESCUTA fixado em 127.0.0.1, deploy/nginx/ VAZIO, nenhum trustedProxies/ipAddressHeaders/proxy_pass em lugar algum). Declarar trustedProxies para topologia suposta transformaria cabeçalho forjado em origem aceita — a própria falha com aparência de correção. P2 resolvido declarando accountLockout com âncora que lê a configuração da INSTÂNCIA.`
- `[T6] Gate 1 rodada 3 (DELTA): APROVADO_COM_OBSERVACOES — os dois bloqueantes sanados. O QA provou o CT-236 (c) discriminante nos DOIS sentidos por execução (M1: apagar /change-password; M2: ipAddressHeaders vazio, colapsando as origens).`
- `[T6] Gate 2 rodada 2 (DELTA): APROVADO_COM_OBSERVACOES — 3 BAIXOS. O TR CONFIRMOU POR DIFF que a alteração sob marcador em filtro-excecao.ts se limitou ao aposto (5 linhas, todas em comentário, dentro do POR QUÊ; O QUÊ e REVERTER EXIGE byte a byte íntegros) — verificação que o Gate 1 pediu e não podia fazer.`
- `[T6] TR — veredito sobre o D27: ele DOCUMENTA e AGENDA a classe, não a fecha, e NADA a fecha hoje. O que o eleva acima de documentação pura é o CT-236 (c), que fixa o estado corrente POR COMPORTAMENTO — no dia em que alguém declarar advanced.ipAddress, a perna 1 reprova e obriga a revisão. As três alternativas são piores.`
- `[T6] TR — homonímia do D27 verificada: existe um D27 · F1/T8 na fatia anterior (error_handling, RESOLVIDO). A §3-B admite homônimos com o par Dnn · F{n}/{origem} mais o ÍNDICE — e os dois separam. O marcador nomeia a fatia explicitamente, mais do que a regra exige.`
- `[T6] ⚠️ TR — risco herdado pela F7: o D27 dispara no INSTANTE da publicação. Se alguém puser a borda na frente SEM declarar advanced.ipAddress no mesmo passo, getIp segue nulo e 31 pedidos/min derrubam a ENTRADA do produto inteiro. É débito de DISPONIBILIDADE no momento da publicação, não só de proteção parcial.`
- `[T6] ledger: 10 achados totais | 5 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T6] staged: 9 arquivos`
- `[T6] CONCLUÍDA — QA REJEITADO(r1) → APROVADO_COM_OBS(r2) → APROVADO_COM_OBS(r3) · TR PARCIAL(r1) → APROVADO_COM_OBS(r2) · 3 rodadas de executor`

### T7 — Rotas do Master: ciclo de vida da empresa e admissão de administradores

- `[T7] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10 (HEAD não moveu — T1..T6 staged)`
- `[T7] executor: opus (declarado)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T7] critical_path=true (auth + security) → qa_model=opus, tech_model=opus`
- `[T7] ADRs injetadas no executor: ADR-0013, ADR-0011, ADR-0012, ADR-0008 (fonte: task §7)`

#### ⚠️ Decisão do orquestrador — dependência CIRCULAR entre os testes da T7 e da T8

O grafo de dependências do task_plan (T7 ← T4,T6 · T8 ← T3,T4,T6) permite qualquer ordem entre as
duas. Os **casos de teste**, porém, se cruzam:

- **T7 / CT-227** (socorro por Admin adicional) exige `POST /v1/usuarios` — rota que nasce na **T8**;
- **T8 / CT-222** (senha exibida uma única vez) exige `GET /v1/master/empresas` — rota que nasce na **T7**.

**Nenhuma ordem de execução resolve as duas.** Inverter apenas troca qual fica bloqueada.

**Decisão, assumida como a recomendada por autorização permanente do usuário**: manter a ordem do
task_plan (**T7 → T8**) e **fatiar o CT-227**:

- a **T7** implementa o CT-227 até onde as rotas existentes permitem — o Admin desativado que não
  entra, a admissão do Admin adicional com Senha provisória, a entrada com sessão restrita e a troca
  obrigatória. Ela **declara explicitamente** o passo que falta;
- a **T8** **completa o CT-227** com o passo de `POST /v1/usuarios` + listagem, e usa
  `GET /v1/master/empresas` no CT-222 normalmente, porque a T7 já a terá publicado.

Alternativa rejeitada: montar rota sintética na T7 para o passo faltante. A T8 chega em seguida e
cria a rota **real**; provar contra sintética o que a rota real vai fazer dois passos depois seria
prova mais fraca sem ganho algum.
- `[T7] Gate 1 rodada 1: REJEITADO — 1 ALTO (tests/happy_path_only: janela de paginação sem prova, teto de 200 como literal órfão) + 1 BAIXO.`
- `[T7] attempt_sha (rodada 1)=4aabc21ba7a3cd94694c3bc6197825ae16ce5a2b`
- `[T7] correção rodada 2: as três pernas + o teto exato. Detalhe sofisticado do executor: o valor pedido acima do teto é LITERAL DECLARADO, não derivado da constante — derivá-lo faria alargar a constante alargar junto o pedido. O QA MEDIU e refinou: a premissa está certa, mas quem mata o mutante é a asserção-âncora; o literal é defesa em profundidade legítima.`
- `[T7] Gate 1 rodada 2 (DELTA): APROVADO_COM_OBSERVACOES — ALTO sanado com 3 mutantes refeitos. 1 BAIXO novo (tests/test_order_dependency: o CT-224 é o único caso que não arranja o próprio estado).`
- `[T7] Gate 2 rodada 1 (FULL): PARCIAL — 1 ALTO + 1 MÉDIO bloqueantes, + 5 BAIXOS.`
- `[T7] ⚠️⚠️ ACHADO ALTO DO TR (architecture) — SQL CRU sobre identidade.* dentro de apps/api. O serviço emite NOVE comandos nomeando tabelas e colunas FÍSICAS (identidade.empresa, identidade.usuario, identidade.sessao, suspensa_em, criada_em, empresa_id). É o ÚNICO arquivo de apps/api/src com SQL, e no base_sha a árvore tinha ZERO — as T1..T6 mantiveram todo acesso a dado nos pacotes. A contenção da §11.2 foi cumprida NA LETRA (nenhum import de esquemaIdentidade nem drizzle-orm) mas o PROPÓSITO cai: o acesso restrito existe para que o alcance às 7 tabelas seja enumerável, e acesso-identidade.ts declara no item 3 do cabeçalho que a restrição de tipo NÃO alcança texto de SQL. O serviço alcança identidade pela unidade de trabalho de NEGÓCIO, onde nada limita o conjunto de tabelas.`
- `[T7] TR — P2 MÉDIO scope_deviation (bloqueante): autenticacao.module.ts reverteu prescrição registrada da fatia anterior ("TOKEN_ACESSO_A_IDENTIDADE continua FORA daqui: publicar o executor criaria um segundo caminho para as tabelas de identidade") com justificativa que cita a revisão agendada de OUTRO token. O mérito técnico da exportação é sólido; o defeito é o REGISTRO — R3 canônica.`
- `[T7] ✅ TR RESOLVEU A DECISÃO DEFERIDA sobre o vínculo: o executor está CERTO e a T7 não muda. Onde o vínculo DEVE nascer (decisão que a T8 herda): em @sysloc/db, idempotente, sob o contexto que a guarda publica A PARTIR DA SESSÃO — cadeia sessão → identidade.sessao → identidade.usuario.empresa_id. Dois pontos fecham o espaço: (i) toda pessoa criada por POST /v1/usuarios ganha o vínculo na mesma transação, sob o contexto do Admin que age; (ii) o vínculo da própria pessoa que age é garantido, idempotente, no ponto em que o contexto é estabelecido — o que fecha o caso do PRIMEIRO Admin. REJEITADAS: gatilho/SECURITY DEFINER no banco (via privilegiada que a ADR-0009 rejeitou) e gravar em criarPessoa a partir do argumento (só relocaliza a origem-request).`
- `[T7] TR — ADR-0013 MATERIALIZADA, não tangenciada: as três consequências da §11.2 estão no código (contenção por constante única nos dois lados; autoria saindo da SESSÃO resolvida pela guarda, nunca do corpo; entrada subsequente registrada).`
- `[T7] TR — encerramento EFETIVO verificado: sem cookieCache e sem secondaryStorage, a guarda resolve contra identidade.sessao a cada requisição. O DELETE alcança pela PESSOA, cobrindo todas da empresa e nenhuma de fora.`

### T7 — retry classification
- attempt: 2
- problemas_por_categoria: { architecture: 2 (1 ALTO + 1 BAIXO), scope_deviation: 1 (MEDIO), technical_requirement: 1, code_quality: 2, error_handling: 1 }
- overrides_ativos: [tocou_area_critica: true, task_risk: high]
- requires_qa_revalidation: true
- decisao: RE-QA (a correção volta ao Gate 1 antes do Gate 2)
- justificativa: "os dois bloqueantes são `architecture` e `scope_deviation`, ambas revalidation_required; e os overrides forçariam true de qualquer forma"

#### Autorização do orquestrador — expansão de escopo para a correção do P1

O P1 exige mover as operações para `@sysloc/db`, e `packages/db/` **não está na §5.1/§5.2 da T7**. O próprio
Tech Review antecipou o impasse: *"Se o obstáculo foi o escopo, este é o caso que a Disciplina do Executor
manda **escalar** em vez de resolver criando camada nova"*.

**Autorizo a expansão**, pela autorização permanente do usuário para este run: o executor pode **criar
`packages/db/src/empresa.ts`** e publicá-lo no barrel, no molde literal de `packages/db/src/permissao.ts`.
A razão é de custo assimétrico e está medida pelo próprio TR: a **T8 publica sete rotas sobre a mesma
superfície e herda a forma que esta task instalar** — corrigir agora custa uma rodada; corrigir depois
custa duas tasks reescritas.
- `[T7] correção rodada 3: criado packages/db/src/empresa.ts (escopo expandido com autorização) — 8 funções que RECEBEM tx, no molde literal de permissao.ts. grep de SQL em apps/api/src → ZERO. P2 reescrito como decisão NOVA, citando a prescrição substituída literalmente e declarando por que ela pôde cair (a propriedade que ela protegia é hoje sustentada pelo P1, e isso é conferível por grep).`
- `[T7] Gate 1 rodada 3 (DELTA): APROVADO_COM_OBSERVACOES — o QA refez o M1 NO ALVO NOVO e as duas falhas continuam NA CONTAGEM: a movimentação entre pacotes PRESERVOU o discriminante do CA-04. Baseline 338 idêntica INCLUSIVE na distribuição por pacote.`
- `[T7] Gate 2 rodada 2 (DELTA): APROVADO_COM_OBSERVACOES — os dois bloqueantes fechados; 3 BAIXOS novos, todos apontando para a T8. O TR conferiu a citação do P2 contra o base_sha com git show: é FIEL, não parafraseada.`
- `[T7] TR — "o P1 fechou a CLASSE, não o caso": grep próprio por identidade.(empresa|usuario|sessao|...) em apps/api/src fora de comentário → ZERO. O nome físico de tabela e coluna existe só em packages/db, que é onde a migração que os renomeia mora.`
- `[T7] TR — a movimentação não perdeu nada onde mais podia perder: suspender continua abrindo UMA unidade e chamando marcação + encerramento dentro dela (um commit só, RN-04/D5); coalesce intacto; a contagem devolvida continua sendo linhas efetivamente apagadas.`
- `[T7] TR — ON CONFLICT: o alvo foi VERIFICADO, não só a forma — empresa_documento_unique casa com a CONSTRAINT de 0000_fundacao.sql:43.`
- `[T7] observação do TR ao orquestrador: a memória lazy _run/tmp/T7.md estava DESATUALIZADA (attempt_count: 1, ledger só com os achados do Gate 1). Ele revisou assim mesmo porque o prompt trouxe tudo por extenso, mas registrou que numa rodada 3 a lacuna morderia. Falha de instrumentação do orquestrador, não do gate.`
- `[T7] ledger: 12 achados totais | 10 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`
- `[T7] staged: 13 arquivos`
- `[T7] CONCLUÍDA — QA REJEITADO(r1) → APROVADO_COM_OBS(r2) → APROVADO_COM_OBS(r3) · TR PARCIAL(r1) → APROVADO_COM_OBS(r2) · 3 rodadas de executor`

### T8 — rodada 2 (correção do Gate 1)
- `[T8] attempt_sha (rodada 2)=c507d3747ceb2d41af0ab500666970b966195901`
- `scan_scope=DELTA` (attempt_sha_anterior=c1481d8c500acbfa1f0f02b9ce426bae50bb667a); 6 arquivos de código no delta, `delta_simbolos` preenchido — o QA confirmou raio de impacto por símbolo, sem queda para FULL.
- Gate 1: **APROVADO** · 9/9 critérios · 8/8 CTs · zero problemas em todas as severidades · `security_flags: []` (a flag `revogacao_de_acesso_inalcancavel` da rodada 1 está fechada).
- Suíte: **345 verdes** antes e depois das mutações (auth 82 · worker 16 · db 40 · api 81 · shared 126) — baseline preservada.
- Mutantes reproduzidos **por execução** pelo próprio gate: M6, M7, M8 e M9, os quatro reprovando exatamente como o executor declarou; fontes revertidos byte a byte conferidos por diff.
- **Nota de método registrada pelo gate**: o M8 na forma literal do inventário não compila (TS6133 em `usuario.service.ts:693`); o gate usou variante equivalente que preserva o defeito e satisfaz `noUnusedParameters`.
- **Reancoragem do M6/M7 julgada legítima, e não AP-24**: nenhuma asserção removida ou afrouxada; única remoção do diff de teste é a extração do arranjo inline para `rotasDeId()`, com conteúdo idêntico; contagem de `@sysloc/api` estável em 81 nas duas rodadas.
- Ledger: QA-ALTO-001, QA-MED-001, QA-BAIXO-001 e QA-BAIXO-002 → `corrigido` (os dois baixos eram `aceito_como_debito` e foram fechados nesta rodada, saindo da §2 do run-report).

### T8 — Gate 2 (primeira revisão de Tech Review) e retry classification
- `scan_scope=FULL` (primeira revisão do TR na T8) · modelo `opus` (critical path + `tocou_area_critica`).
- Veredito: **PARCIAL** · 1 bloqueante (P1 · ALTO · `security`) + 3 baixos (P2, P3, P4) → débitos.
- **As três decisões deferidas pelo Gate 1 foram julgadas e passaram, com razão registrada por escrito**: D1 (escrita idempotente no caminho de requisição) — estrutura correta, o que não se sustenta é o argumento do docblock; D2 (leitura de `identidade.usuario` recortada em aplicação) — **conforme**, porque a rejeição da ADR-0008 pressupõe *dois* caminhos e a ADR-0009 decide que `identidade` não tem política, logo existe um só; D3 (garantias subsumidas) — as duas antigas **ficam**, a subsunção foi da consequência observável, não da propriedade, e a reancoragem é prova **mais forte** que a anterior.
- **Achado novo, invisível aos dois gates anteriores**: as cinco rotas de `:id` não distinguem o **alvo** de **quem age**. Com `@ExigeChave('TELA:usuarios')` na classe, quem receba a concessão individual de **uma** das 17 chaves alcança `POST /v1/usuarios/<próprio id>/perfil` e se promove a `ADMIN_EMPRESA` — do piso `['TELA:resumo']` para o catálogo inteiro, com a ADR-0010 fazendo a escalada valer na requisição seguinte. Depois disso a concessão deixa de ser retirável pelo Admin que a concedeu.
- **Decisão do orquestrador — a correção fecha a CLASSE, não o caminho apontado**: o TR nomeou `POST /:id/perfil`, mas `POST /:id/permissoes` produz a **mesma escalada** por caminho diferente (a pessoa concede a si mesma as outras 16 chaves), e o §5 do Protocolo Antirregressão manda atacar a topologia. A recusa do auto-alvo vai ao **ponto único** `sobreAPessoa`, valendo para as cinco rotas de `:id` — que é também o que faz a sexta rota nascer com a propriedade. Fecha P1 e P2 no mesmo ato.
- `requires_qa_revalidation`: **true** (`category: security` ∈ revalidation_required; overrides `tocou_area_critica: true` e `task_risk: ALTO` forçariam de qualquer forma).
- `attempt_count: 2` → auto-escalate do executor para `opus[xhigh]`.

### T8 — rodada 3 (correção do Gate 2) → Gate 1
- `[T8] attempt_sha (rodada 3)=eec9ca72b62deca134fbef0d169c478bcc9f257a` · `scan_scope=DELTA` (anterior `f0b664a587086177e0a4b8c1e68ab4d18e0a38b2`).
- **A correção fechou o bloqueante e a classe**: a recusa do auto-alvo entrou no ponto único `sobreAPessoa`, disparando **antes de a unidade de trabalho abrir**; `emUnidadeDeTrabalho` tem uma única ocorrência no serviço e as cinco rotas de `:id` abrem por ali. `422 CAMPO_INVALIDO` + `campo: 'id'` + `detalhes.motivo: 'ALVO_E_QUEM_AGE'` — forma conferida no fonte contra a rota irmã do Master. TR-P1 a TR-P4 → `corrigido`.
- **A reancoragem do passo 3 do CT-227 NÃO é AP-24**: o gate reproduziu o **M6** e ele reprova em `expected +0 to be 1` na contagem direta do passo 1-b; o `SUT_IS_CORRECT_BECAUSE` é verdadeiro na forma que o P5 exige. Suíte em **346** (api 81 → 82, o `+1` é o CT-237), nenhum `it(` removido, nenhum `skip`.
- Gate 1: **REJEITADO** por **um único ALTO**, e não por defeito de comportamento — `ALTO-001 · tests · tautological_assertion`: `administracao-de-pessoas.e2e.spec.ts:1195` compara `efetivoDepois.telas.length` (teto **10**) contra `MATRIZ_POR_PERFIL.ADMIN_EMPRESA.length` (**17** = 10 telas + 7 ações). O gate **executou o cálculo contra o `dist/`**: sob escalada **total** a asserção ainda passa. A linha não pode reprovar em estado algum, e o comentário acima dela a apresenta como a que fecha exatamente esse desfecho.
- `MED-001 · documentation` (a tabela de INVARIANTES do CT-227 ainda declara o vetor fechado como alcançável) é **médio anotável** pela partição por categoria — **não** bloqueia. Vai junto na rodada 4 porque é correção de texto no mesmo arquivo, e deixá-la como débito faria o oráculo declarado do arquivo mentir sobre o que o caso prova.
- `attempt_count: 3` (o usuário autorizou explicitamente exceder o teto de 3 tentativas neste run).

### T8 — rodada 4 (correção da asserção infalível) → Gate 1
- `[T8] attempt_sha (rodada 4)=73cd6425d988ef27f0669d1583194704a7b3f751` · `scan_scope=DELTA` (anterior `bfa9a0a274f1c2ad077c7850ee31bdab3028d46c`).
- Delta de **teste puro** — `+36/-2` e `+14/-9` em dois `*.e2e.spec.ts`, **nenhum `src/`**, confirmado pelo gate por `git diff --stat`.
- Gate 1: **APROVADO** · zero problemas em todas as severidades · `security_flags: []` · suíte **346 verdes**, contagem idêntica.
- A saída escolhida foi a **igualdade de conjunto**, não o limiar: o gate confirmou que `toBeLessThan(CHAVES_DE_TELA.length)` **toleraria escalada parcial de 9 das 10 telas**.
- **A falsificação exigiu arnês, e o gate a corroborou por medida independente** — refez a aritmética a partir do `dist/` e apontou que as 10 telas ordenadas começam por `TELA:automacao_de_cobranca`, exatamente o primeiro elemento da mensagem de erro citada no M13: *"esse detalhe de ordenação não é adivinhável; é evidência forte de que a medição foi feita, e não narrada"*. Arnês conferido ausente por três vias.
- **Ressalva registrada para o Gate 2**: passadas as duas asserções acima dela, a linha nova não reprova *naquela execução* (o Vitest aborta antes). O valor dela é defesa em profundidade contra afrouxamento futuro da relativa — propósito legítimo pelo §4.2 do Protocolo Antirregressão, não detecção marginal.
- **Nota de rastreabilidade que o gate deliberadamente NÃO transformou em achado**, e defere ao Gate 2: `RN-12` é definida no `tech_spec.md` §6.3 como *"Admin alcança apenas a própria empresa → RECURSO_NAO_ENCONTRADO (via RLS)"*, e o passo 3 assere `422 CAMPO_INVALIDO`. O par idêntico `CA-16 → CT-237 (RN-12)` já foi aprovado na rodada 3 no arquivo irmão; não existe RN dedicada ao auto-alvo, que nasceu de achado do Gate 2 depois de a tabela de RN congelar.
- Ledger: QA-ALTO-002 e QA-MED-002 → `corrigido`.

### T8 — Gate 2 (segunda revisão) e retry classification
- `scan_scope=DELTA` (`c507d374..73cd6425`), sem queda para FULL — o raio foi determinado por símbolo, e **foi justamente ele que produziu o achado**.
- Veredito: **REJEITADO** · 1 **CRÍTICO** (`security`) + 1 médio anotável (`project_pattern`).
- **CRÍTICO — a recusa do auto-alvo é contornável por caixa do UUID.** `usuario.service.ts:823` compara por `===` de string, e os dois lados têm formas diferentes: `sessao.usuarioId` vem de coluna `uuid` (o Postgres sempre renderiza em minúsculas) e o `:id` do caminho passa por `z.uuid()`, que **aceita maiúsculas e devolve verbatim**. O gate **verificou os três elos empiricamente**, incluindo sonda em instância efêmera própria pelo driver real: a comparação dá `false` e a consulta **acha** a pessoa (`uuid_in` parseia hexadecimal sem distinguir caixa). `POST /v1/usuarios/<próprio id em MAIÚSCULAS>/perfil` consuma a escalada que a rodada 3 fechou. O CT-237 não alcança o caminho porque usa o id como o banco o devolveu.
- É o **§5 do Protocolo Antirregressão na forma literal** — o mesmo defeito voltando por caminho novo que nenhuma asserção cobre. A correção vai à **borda** (`ESQUEMA_DO_IDENTIFICADOR`), que já é ponto único das cinco rotas e segue o precedente que o próprio arquivo criou para o e-mail; ela mora **fora** do marcador `DECISÃO FECHADA`, então não há gatilho de parada.
- **Os três pontos deferidos foram julgados**: **R1** — o alargamento do orquestrador para as cinco rotas está **certo**, e o único caso discutível (auto-redução sob a US-09) não é pedido e custaria regra assimétrica sobre um payload de substituição total; numa superfície que congela, abrir depois é aditivo e fechar depois é quebra. **R2** — concorda com o Gate 1: a linha é **sombreada**, não infalível, e o M13 já a falseou; redundância barata e honestamente documentada é o que o §4.2 quer preservar. **R3** — **discorda do deferimento** e abriu o P2: o parêntese do §10.4 anota o CA e não o RN, e o par já aprovado no arquivo irmão é precedente do mesmo desvio, não sua justificativa.
- `requires_qa_revalidation`: **true** (`security` ∈ revalidation_required; overrides forçariam de qualquer forma).
- `attempt_count: 4` · `last_severity: CRITICO` (o usuário autorizou exceder o teto de tentativas neste run).

### T8 — rodada 5 (correção do CRÍTICO) → Gate 1
- `[T8] attempt_sha (rodada 5)=20b421eef687bfca8a58036858a7de8f35d219fb` · `scan_scope=DELTA` (anterior `6b644b92b731768b6e65d34023801ca14ee71eb7`).
- Gate 1: **APROVADO_COM_OBSERVACOES** · zero crítico/alto/baixo · 1 médio **anotável** (`documentation`) · suíte **346 verdes**, contagem inalterada.
- **TR2-P1 sanado, e a prova é empírica**: o gate reproduziu o **M14 na forma literal** (`ESQUEMA_DO_IDENTIFICADOR` volta a `z.uuid()`) → `1 failed | 81 passed`, CT-237, `expected 200 to be 422` sobre identificador em MAIÚSCULAS. Fonte revertido e conferido byte a byte.
- **A rede é ÚNICA, medido**: sob o M14, das 82 asserções da api **só o CT-237 reprova** — inclusive o CT-227, que exercita o mesmo auto-alvo, passa verde, porque usa o identificador na grafia que o banco devolve. *"Apagar a perna de MAIÚSCULAS do CT-237 devolve o repositório ao estado exato em que o Gate 2 achou a escalada, sem que nada mais acuse."*
- **A premissa de grafia alternativa foi julgada NÃO determinística por sorte, com aritmética auditável**: `gen_random_uuid()` (UUIDv4) — P(premissa falsa) = `0,5 × (5/8)^30 ≈ 3,8e-7` por asserção, ~1 em 1,3 milhão de execuções, ordens de grandeza abaixo do ruído da própria suíte; e o modo de falha é **alto e nomeado**, nunca verde falso. Não é AP-07/08/09.
- **`sobreAPessoa` é byte a byte o mesmo**: `usuario.service.ts` tem **6 inserções e zero deleções**, todas dentro do campo `POR QUÊ` do marcador. A canonicidade passou a ser *estabelecida*, não pressuposta.
- Ledger: TR2-P1 e TR2-P2 → `corrigido`.
- **Decisão do orquestrador sobre o médio anotável (QA-MED-003)**: a §6.1 do `tech_spec.md` afirma a canonicalização para *"todas as rotas de `:id`"*, e ela vive só nas cinco de `/v1/usuarios` — o `:id` do Master **não** canoniza, e **está certo não canonizar** (o gate verificou: uma única comparação de identidade em todo o repositório, no caminho já canonizado). A política manda anotar como débito, e não abrir rodada; abro assim mesmo, porque (i) é **uma frase de escopo** com a redação já dada pelo gate, (ii) o artefato **congela** no marco de entrega, e (iii) o Gate 2 roda de qualquer forma — o custo marginal é nulo e o débito evitado incide sobre a spec entregue ao frontend.

### T8 — rodada 6 (escopo da §6.1) → Gate 2 (terceira revisão) → CONCLUÍDA
- `[T8] attempt_sha (rodada 6)=e40bd2bca57477e9a70e14c7efd1c21d245c19f2`.
- **O executor divergiu da redação sugerida em dois pontos, com medição, e o Gate 2 lhe deu razão nos dois**: (1) as rotas do Master que não canonizam são **quatro**, e uma delas — `POST /v1/master/usuarios/:id/senha-provisoria` — **não é de `/v1/master/empresas`**; o prefixo sugerido teria escrito uma falsidade e quebrado a soma `5 + 4 = 9`; (2) *"o log e o eco preservam a grafia enviada"* é **falso para metade delas** — `suspender` e `reativar` ecoam o `RETURNING id`, isto é, o valor canônico do Postgres.
- Gate 2: **APROVADO_COM_OBSERVACOES** · 1 achado BAIXO (`project_pattern`) → débito **D37**.
- **A flag `identificador_de_rota_canonizado_apenas_em_uma_das_duas_superficies` foi julgada ACEITÁVEL**, com as três medições refeitas pelo gate: a comparação de identidade é única em todo o repositório e está do lado canonizado; as colunas de identidade são `uuid`, logo o valor não canonizado é normalizado pelo `uuid_in` antes de virar linha; e a RLS compara **com cast**, não texto. *"Canonizar o Master por simetria seria mudança de comportamento em superfície que congela, fora do escopo da T8 e sem defeito que a motive."*
- **Sinal de rule mining emitido** (`RC-001 · convention_drift`), com sweep de cobertura confirmando que não existe regra escrita: *canonicalização de entrada na borda*. O projeto já a pratica sem ter escrito — o e-mail é normalizado na borda —, e a falta no identificador de rota **virou escalada de privilégio**.
- `[T8] ledger: 10 achados totais | 9 originados em rodada >1 | 1 suspeito de incompletude da rodada 1`
  - O único suspeito é **TR-P1** (auto-alvo): a escalada existia desde a rodada 1 e o QA não a viu em duas varreduras. Os demais `rodada_origem > 1` são **consequência legítima** da correção anterior — o TR2-P1 (caixa do UUID) só pôde existir depois de a recusa nascer na rodada 3, e o QA-ALTO-002/QA-MED-002/QA-MED-003 nasceram do texto que cada correção escreveu.
- **T8 CONCLUÍDA** — 6 rodadas, 4 vereditos de rejeição, 3 defeitos estruturais fechados (alcance → auto-alvo → forma do identificador), todos por **ponto único**.

### T9 — pré-execução
- `[T9] base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10` · executor `opus` (declarado no frontmatter; a task cruza `auth`/`security`) · `gates: [qa, tech_review]` (declarado).
- Dependência `T4` satisfeita. Sem lote paralelo — é a última task da fase 3.
- **Colisão de ID de caso de teste detectada e resolvida pelo orquestrador.** O `_run/test-cases.json` atribui `CT-232` e `CT-233` à **T9** (alcance da sessão restrita e troca que libera a sessão), e a **T8 se apropriou dos dois** para outra semântica — recusa de chave fora do catálogo e paginação. Nenhum dos gates pegou, nas seis rodadas.
  - **Resolução: renumerar os da T9**, não os da T8. A T8 está **fechada e aprovada nos dois gates**, e os IDs dela já estão citados no código, no `run-report.md`, neste arquivo e na memória lazy — renumerá-los seria reabrir trabalho fechado por uma propriedade de rastreabilidade, contra o Protocolo Antirregressão. O card da T9 é editável (a task markdown é canônica após o destrinchamento).
  - **Mapa**: `CT-232` → **`CT-238`** · `CT-233` → **`CT-239`** · `CT-234` **permanece** (estava livre). Os IDs `CT-238`/`CT-239` foram conferidos livres em toda a árvore.
  - Consequência a registrar: o `_run/test-cases.json` e a §10.4 do `tech_spec.md` ficam apontando `CT-232`/`CT-233` para a semântica da T9 enquanto o código os usa para a da T8. **A fonte canônica é o card da task**, e o desalinho fica anotado na §4 do relatório humano.

### T9 — execução inicial concluída (aguardando Gate 1)
- Executor `opus` retornou. **1 arquivo criado, 13 modificados**; 3 casos novos (CT-234, CT-238, CT-239); suíte em **349** (baseline 346; `api` 82 → 85). `pnpm lint` limpo.
- **A hipótese do cartão sobre desligar a capacidade na configuração foi MEDIDA e recusada com razão.** `disabledPaths` existe em `better-auth@1.6.25`, mas (i) **não faz a rota deixar de existir** — `getEndpoints` monta `api.changePassword` incondicionalmente, e é por `auth.api.changePassword` que a própria rota do produto grava a credencial; e (ii) o `404` sai **antes do limitador e antes do manipulador**, o que apagaria duas provas vivas de `packages/auth`: a *segunda rota emissora de sessão* do caso da barreira de admissão — que sustenta o `REVERTER EXIGE` de uma `DECISÃO FECHADA` — e a única perna alcançável do grupo de tetos do `CT-236`. Recusado no encaminhador, que é o **único** ponto por onde `/v1/auth` é publicado.
- **Divergência de ordem interna declarada e medida**: entre "senha atual" e "força da senha nova", a ordem é a do arcabouço, inversa à listada no cartão. As quatro conferências **precedem `updateAccount`**, que é o que a §3 exige.
- **Decisão de projeto que preserva prova existente**: o encerramento das demais sessões usa `auth.api.revokeOtherSessions`, **não** o campo `revokeOtherSessions` do corpo — o campo apaga todas as sessões e reemite cookie, o que reabriria o `CT-021` (*"a restrição cai com o MESMO cookie"*).
- **4 mutantes declarados**: admissão conferida depois do repasse (o defeito literal do D21) → CT-234; encaminhador volta a publicar → CT-234 `expected 200 to be 404`; a rota sai de `ROTAS_DA_SESSAO_RESTRITA` → **9 casos**; `revokeOtherSessions` removido → CT-239 `expected 200 to be 401`.
- **D21 fechado**: marcador removido de `packages/auth/src/autenticacao.ts` (só ele; o do D27 intacto), linha removida do `CLAUDE.md`, índice conferido nas duas pontas — marcadores vivos `{D23, D27, D28, D32, D37, D39}` == linhas do índice.
- **Cinco pontos que o Gate 1 e o Gate 2 precisam julgar** (ver a pausa registrada abaixo): a expansão de escopo de 5 arquivos, a aritmética `6 → 5` contra a constante que vai de 5 para 4, a renumeração aplicada, a terceira cópia de `validar()` e as duas divergências do CT-234 (suspensão por escrita direta + controle positivo).
- `[T9] attempt_sha (rodada 1)` capturado; **os gates ainda NÃO rodaram** — o run está pausado a pedido do usuário exatamente aqui.

### T9 — retomada após pausa controlada
- Resume pós-interrupção: sinal presente (T9 `Em Progresso`, executor concluído, gates não rodados). Escolha **(a) Retomar nos gates**, assumida pela autorização permanente do usuário — reafirmada na retomada, junto com a suspensão do teto de 3 tentativas.
- `base_sha=bfe234be162df453c5eaf709df2b3e938c5d7e10` (o HEAD não se moveu; nada foi commitado no run).
- `git add -N` conferido sobre `senha.controller.ts` — o arquivo novo entra no diff dos gates.

### T9 — Gate 1 (rodada 1, `scan_scope=FULL`)
- Veredito: **APROVADO_COM_OBSERVACOES** · zero crítico/alto/médio · 2 baixos (`documentation`) → débitos.
- Suíte: **349 verdes** (auth 82 · worker 16 · db 40 · api 85 · shared 126). O `+3` é exatamente CT-234, CT-238 e CT-239; nenhum caso sumiu nem virou `skip`.
- **O mutante decisivo foi reproduzido por execução e reprova pela asserção certa**: `exigirAdmissao` movida para **depois** do repasse — o defeito literal do D21 — faz o CT-234 reprovar em `expected '953d0a0d…' to be '2daa8fb7…'`, isto é, **`senha_derivada` mudou apesar da recusa**. *"Não foi o status que pegou — foi a credencial."*
- **A aritmética do inventário fecha, e a redução NÃO é cobertura disfarçada.** O gate conferiu no fonte: a §4.1 da fatia anterior tem 7 linhas, 6 sob `/v1/auth`, e **duas delas são literalmente a mesma rota** (`POST /v1/auth/two-factor/verify-totp`) — daí a constante ter nascido com 5. Removida a troca nativa: 5 linhas e 4 entradas, redução de **exatamente uma**. E o mutante que esvazia `CAMINHOS_NAO_PUBLICADOS` faz a rota **reaparecer como excedente** no CT-018 (d).
- **A linha `SUT_IS_CORRECT_BECAUSE:` está literal**, palavra por palavra. Nenhuma asserção foi afrouxada em lugar algum do diff; onde uma existente mudou de valor, cada mudança carrega a própria linha e segue sendo igualdade exata.
- **A via de configuração foi conferida e a recusa procede, com a distinção que salva o argumento**: as duas provas vivas moram em `packages/auth/test/`, onde exercitam a **instância** do arcabouço sem passar pelo encaminhador — `disabledPaths` é opção da instância e as mataria; a recusa no encaminhador não as alcança.
- **A ordem interna satisfaz a §3**: a divergência declarada é real, mas as **quatro conferências precedem `updateAccount`**, e o mutante 1 prova que a ordem é a entrega, não decoração.
- **A expansão de escopo de 5 arquivos foi julgada necessária nos cinco**, com razão por arquivo. Sobre o `export` de `cabecalhosDe`: a alternativa teria como modo de falha *"a rota do produto enxergar uma sessão diferente da que a guarda resolveu no MESMO pedido"*.
- **A guarda de cobertura da T5 não afrouxou** — o arquivo não foi tocado, a `DECISÃO FECHADA` está intacta, e as âncoras cresceram **um par cada** porque a superfície cresceu; a rota entrou no conjunto **positivo**, não no de dispensa.
- **Antirregressão reconcilia nas duas pontas**: marcador do D21 removido, do D27 intacto, marcadores vivos `{D23, D27, D28, D32, D37, D39}` == as seis linhas do `CLAUDE.md`; **20 marcadores `DECISÃO FECHADA` intactos**.
- **As duas divergências do CT-234 foram julgadas acertos**: a suspensão pela rota do Master encerraria as sessões e tornaria a asserção de contagem `0 → 0` — *"verdadeira por vacuidade, sem dizer nada sobre a ordem DENTRO da rota"*; e sem o controle positivo, as três asserções de "credencial inalterada" seriam satisfeitas por uma rota que nunca escreve.
- Sinal de rule mining emitido pelo QA: `repeated_fixture` — caminho de rota composto da constante do controlador dono, repetido em 6 arquivos de teste. *"Foi isso que fez o desligamento se propagar sem que nenhum literal ficasse para trás."*

### T9 — Gate 2 (primeira revisão) e retry classification
- `scan_scope=FULL` · modelo `opus` (critical path + `tocou_area_critica`).
- Veredito: **PARCIAL** · **2 bloqueantes** (P1 · ALTO · `security`; P2 · MEDIO · `testability`) + 2 médios anotáveis (`code_quality`) → débitos.
- **⚠️ P1 — a troca de senha do produto PERDEU o limitador de taxa que a T6 instalou na mesma fatia, dois dias antes.** O gate mediu no pacote instalado: `onRequestRateLimit` é invocado num **único** ponto (`better-auth@1.6.25`, `dist/api/index.mjs:168`), dentro do `onRequest` do **roteador**, alcançado só por `auth.handler(request)`. A rota nova chama `auth.api.changePassword`, que é **chamada de servidor** e não passa por ali; e `apps/api` não tem limitador próprio. Antes da T9, `/change-password` tinha `TETO_DE_CREDENCIAL_POR_JANELA = 10` por 60 s — **o teto mais apertado de toda a configuração, 12× abaixo do geral**. Depois, a conferência de `senhaAtual` **não tem teto nenhum**.
  - **A T6 escreveu à mão por que aquele número existia** (`packages/auth/src/autenticacao.ts:519`): *"o pior caso era `/change-password`: 6,7 vezes mais folgado, num caminho que confere `currentPassword` e onde o contador por conta da RN-06 não existe"*. É o §4.3 do Protocolo Antirregressão, e a guarda removida foi instalada pela **task anterior desta mesma fatia**. A linha `O QUE ESTA MUDANÇA REMOVE` do executor **não a nomeia**.
  - **Causa estrutural, na frase do gate**: *"`auth.api.*` é uma porta LATERAL ao roteador — entrega os manipuladores e deixa para trás tudo que vive no `onRequest`: o limitador de taxa e o `originCheckMiddleware`. Correto o reuso; incompleto o transplante."*
  - Contenção hoje: a API escuta em `127.0.0.1` — que é o que o **D27** registra. Mas o gatilho do D27 é a publicação atrás do servidor de borda na F7, **e a superfície congela antes disso**.
- **P2** — a regra `'/change-password'` do limitador virou **configuração morta** (o `404` sai antes do repasse), o CT-236 segue verde sobre caminho que o produto não tem, e duas afirmações no fonte ficaram falsas: *"é alcançável hoje"* e *"a única perna alcançável"*.
- **P3 — o achado que SÓ a fatia inteira revela**, e o pedido de revisão o antecipou: a guarda (T4) afirma que os tokens de acesso estão **fora** do `exports`; o módulo (T7) **exporta os dois**. A T7 documentou bem a própria decisão e nomeou a prescrição que substituía — só não apagou a afirmação recíproca no arquivo que todo mundo abre primeiro. R3 em formação.
- **O gate foi além do que lhe foi pedido em dois pontos**: testou o **contorno do `404` por normalização de caminho** (não há brecha — mesma fórmula de derivação do roteador, sem decodificar percent-encoding) e reconciliou o antirregressão **por comando**, não por leitura.
- `requires_qa_revalidation`: **true** (`security` + `testability`).
- `attempt_count: 1` → executor segue em `opus` com auto-escalate por `last_severity: ALTO`.

### T9 — rodada 2 (correção do Gate 2) → Gate 1
- `[T9] attempt_sha (rodada 2)=7061c0d5321a31d2717153288244d1ec01987cea` · `scan_scope=DELTA` (anterior `2c4f5db5928cb5231349013d92754c153740d0d7`), raio determinado **por símbolo**.
- Gate 1: **APROVADO_COM_OBSERVACOES** · zero crítico/alto/médio · 2 baixos (`documentation`). Suíte **350** em **5 execuções completas**, todas verdes (api 85 → 86; o `+1` é o `CT-236 (d)`).
- **TR-P1 e TR-P2 sanados.** O executor escolheu o **repasse pelo `handler`** e mediu por que: `onRequestRateLimit` **não consta da lista de `export`** de `dist/api/index.mjs` e não há subpath `./api/rate-limiter` — **só `auth.handler(request)` o alcança**. O gate conferiu as três alegações no `node_modules` instalado.
- **A "pendência de flake" tinha outra explicação, e o gate a fechou**: os três mutantes que ele rodou imprimem **literalmente** `Tests 1 failed | 85 passed (86)` — a mesma linha que o executor viu e não reproduziu. *"É assinatura de execução com mutante aplicado, não de instabilidade."*
- **O mutante do D21 foi reproduzido e a prova sobreviveu à refatoração**: o CT-234 continua reprovando **pela credencial** (`senha_derivada` mudou apesar da recusa), e `exigirAdmissao` corre antes de montar o pedido — **a pessoa não admitida nem consome teto**.
- **A escolha do arquivo do caso novo foi PROVADA por cruzamento de mutantes**: o M2 (voltar à porta lateral) reprova **só** o `(d)` em `apps/api` e deixa `bloqueio.spec.ts` **verde**; o M3 (remover a regra) reprova os dois. *"Só a superfície publicada discrimina o defeito do P1 — `bloqueio.spec.ts` seria o arquivo errado."*
- **A armadilha do `originCheckMiddleware` é real e invisível para a suíte**: `skipOriginCheck = isTest() ? true : false` existe no pacote; em produção o `403 INVALID_ORIGIN` recusaria toda requisição com cookie e sem `Origin` confiável. O pedido interno declara `origin` = origem da própria instância.
- **Efeito colateral que a próxima fatia precisa saber**: a rota do produto passou a consumir o balde de `/change-password`. Caso futuro que troque senha **mais de dez vezes da mesma origem** receberá `429`. Os dois arquivos afetados hoje fazem 3 trocas cada, e um deles **já antecipava isso por escrito**.
- **Achado novo — o diagnóstico do executor sobre o flake era FALSIFICÁVEL, e o gate o falsificou**: a janela do limitador **desliza por requisição** (`decideConsume` só reinicia com intervalo maior que a janela entre requisições **consecutivas**; `expiresAt` é renovado a cada permitida). Ela não poderia virar durante o caso. A decisão de baratear o aquecimento segue certa **por outro eixo**, mas o comentário que a justifica descreve mecanismo inexistente e diz *"medido"*.
- Ledger: TR-P1, TR-P2, TR-P3, TR-P4, QA-BAIXO-001 e QA-BAIXO-002 → `corrigido` (o executor fechou os quatro anotáveis também). Dois baixos novos abertos.
- **Decisão do orquestrador**: os dois baixos vão a uma rodada de texto **antes** do Gate 2 — o mesmo critério da T8. Um deles é um comentário assertivo que **afirma ter medido** um mecanismo que não existe; deixá-lo como débito o entrega ao próximo agente como fato verificado.

### T9 — Gate 2 (segunda revisão) e retry classification
- `scan_scope=DELTA` (`da065d8f..b912696b`), raio determinado por símbolo, sem queda para FULL.
- Veredito: **PARCIAL** · 1 bloqueante (P1 · MEDIO · `technical_requirement`) + 1 baixo (`architecture`) → débito.
- **P1 — o contrato publicado anuncia um cabeçalho que a rota nunca emite.** O decorador `@ApiTooManyRequestsResponse` (`senha.controller.ts:268`) e a emenda do `tech_spec.md:263` afirmam que o `429` carrega `x-retry-after`. O gate rastreou o caminho no fonte: `comoRecusa()` reduz a resposta interna a `{ statusCode, body }` — **os cabeçalhos são descartados** —, o tradutor levanta `HttpException` e o filtro global responde `send(erro.corpo)` **sem escrever cabeçalho nenhum**. `x-retry-after` aparece em exatamente **dois** pontos do repositório: o texto do decorador e `bloqueio.spec.ts:336`, que o observa na **instância**, nunca pela superfície publicada. **Nada prova a afirmação e nada a falsificaria.**
- **Por que é `technical_requirement` e não comentário**: o decorador alimenta o documento OpenAPI que vira `@sysloc/contracts` e o `handoff-frontend.md`, e a superfície **congela**. *"A fatia aplicou exatamente este critério na direção oposta ao declarar o `429` — declarar um cabeçalho inexistente é o mesmo defeito com o sinal trocado."*
- **Os cinco pontos submetidos foram julgados, e os cinco a favor**: **[A]** o repasse é a topologia certa e não um túnel — o endereço sai do **mesmo par** que o roteador usa para casar as próprias rotas, *"não há segunda composição para divergir"*, e não há recursão; **[B]** o `origin` declarado **é verdadeiro** — o pedido não vem de navegador, e a postura de CSRF resultante é a do resto da superfície, com cookie `httpOnly`/`secure`/`sameSite: lax` e `senhaAtual` exigida; quando o D27 fechar, **nada quebra**, porque `getIp` apura por cabeçalho e o `origin` fixado não participa; **[C]** compartilhar o balde é a modelagem certa agora que só uma rota existe — balde próprio seria *"um segundo número de política fora de `packages/auth`"*; **[D]** a divergência do comentário está fechada e **não há outra ocorrência** (varredura por cinco termos devolveu três pontos, todos concordantes); **[E]** a enumeração nominal está correta e não é "aproveitar que estou aqui".
- **Achado operacional do gate, para o orquestrador**: `git diff da065d8 --stat` acusa a **remoção de 20 arquivos** de spec/ADR que existem no disco como `??` — foram comitados no snapshot temporário e depois desindexados. **Nenhuma perda real**, mas o índice precisa ser corrigido antes do commit da fatia *"para que o diff da entrega não nasça mentindo"*.
- `requires_qa_revalidation`: **true** (`technical_requirement` ∈ revalidation_required; override `task_risk: high` forçaria de qualquer forma).
- `attempt_count: 2`.

### T9 — rodada 3 (correção do contrato do 429) → Gate 1
- `[T9] attempt_sha (rodada 4)=2e53b0c82ba2f2df2987bcde776100b6cf9de1e9` · `scan_scope=DELTA` (anterior `38d4092c2fa0c3dfd4c211642249bfc4e8fbbf1d`), raio por arquivo.
- Gate 1: **APROVADO_COM_OBSERVACOES** · zero crítico/alto/médio · 1 baixo (`tests`) → débito. Suíte **350** em **três execuções**, duas delas com `--force` anulando o cache do Turborepo.
- **TR2-P1 sanado, e o gate mediu a razão nova em vez de aceitá-la**: `comoRecusa()` devolve `{ statusCode, body }` e descarta os cabeçalhos; `filtro-excecao.ts` tem **uma única** escrita de resposta e **zero** ocorrências de `header`/`setHeader`/`headers`. Confirmou também que a **ADR-0012 não menciona cabeçalho algum**. Das seis ocorrências restantes de `x-retry-after`, **nenhuma o afirma** como parte da resposta publicada.
- **TR2-P2 sanado com o marcador íntegro**: o acréscimo entrou **dentro do `QUANDO FECHA`**, que é o campo legítimo de editar num marcador que **agenda** em vez de proteger; os quatro campos e o `ÍNDICE` seguem, e o parêntese que separa o D27 do `D7 · F1/T6` homônimo foi preservado.
- **A correção é mesmo só texto**, conferida linha a linha: em `senha.controller.ts` mudaram **duas** coisas — um bloco de comentário e a `description` do decorador; `schema`, corpo de `trocar()` e `comoRecusa()` intactos.
- **Julgamento do `CT-001` da saúde** (a falha de temporização que o executor relatou na baseline): **é pré-existente** — o arquivo nasceu com o serviço de saúde na F0/F1, não está no delta, no Ledger nem no raio de impacto; o executor agiu conforme o P1 ao registrá-la sem incluí-la no conserto. **Não reapareceu em três execuções.** O gate a classificou como **BAIXO com justificativa explícita de rebaixamento** (o catálogo daria ALTO ao AP-09): está fora do escopo, não se reproduziu, e **não mascara regressão** — o eixo da fila já é provado estruturalmente pelo espião do `CT-001 (b)`, de modo que o teto temporal é **reforço redundante, não a única prova**. `determinismo_observado: suspeito`.
- **⚠️ Instrução do gate que vai junto com o débito**: o teto **não deve ser afrouxado** — o cabeçalho do arquivo o declara como o **segundo discriminador** do eixo da fila, com medição (dez consultas à fila derrubada levam ~1 s). Elevá-lo sem justificativa seria AP-24.
- Ledger: TR2-P1 e TR2-P2 → `corrigido`; um baixo novo `aceito_como_debito`.

### T9 — Gate 2 (terceira revisão) — APROVADA
- `scan_scope=DELTA` (`38d4092c..2e53b0c8`), raio **vazio por construção** — `delta_simbolos` nulo e só comentário/decorador alterados.
- Veredito: **APROVADO_COM_OBSERVACOES** · zero crítico, zero alto · **3 achados, todos `project_pattern` (anotável)** → débitos. **T9 aprovada nos dois gates.**
- **[A] julgado a favor quanto à substância**: a razão que substituiu a afirmação falsa é verdadeira, medida e **estrutural** — *"nomeia a topologia, não a ocorrência"*, que é o oposto das duas afirmações que a precederam. O gate reverificou no fonte em vez de aceitar o sumário: a escrita de cabeçalho existe em **exatamente dois pontos** de `apps/api/src`, ambos dentro de `responderCom`, alcançada **só** no ramo de aceitação.
- **[B] o rebaixamento do `CT-001` PROCEDE**, e o gate acrescentou uma razão que ninguém tinha: *"o mutante que o teto persegue faz a rasa consultar a fila UMA vez, o que pela mesma aritmética custaria ~100 ms, folgadamente abaixo dos 500 ms declarados — o teto discrimina MENOS do que o cabeçalho afirma"*. Isso **reforça** o rebaixamento (a prova real do eixo é o espião do `(b)`) e **fecha a saída fácil**: elevar o número afrouxaria a única coisa que o teto ainda faz.
- **[C] varredura de fatia executada em CINCO eixos**, com dois achados e três eixos limpos: a **ADR-0013** (nascida durante o run) está consumida com precisão em 12 pontos, sem contradição entre T7 e T8; a **terminologia canônica** está correta na superfície publicada — *"Senha provisória"* em todo o código de produção; **tags e caminhos** dos quatro controladores são coerentes.
- **Os dois achados de fatia**:
  - **P1** — `sessao.controller.ts:137` publica *"Corpo no envelope de erro da ADR-0007"*, e o `tech_spec.md` **desta fatia** declara literalmente que a 0007 *"não é mais fonte"*. O diff prova que **não é herança passiva**: o hunk reescreveu a `description` do `@ApiOperation` **imediatamente acima** e deixou a linha de baixo intacta. O documento publicado sairia com **duas rotas apontando para a ADR aposentada e três para a vigente**.
  - **P2** — `esquemaDoErro` existe **byte a byte idêntica** em três controladores criados por **três tasks distintas** (T7, T8, T9), mais duas constantes de mesmo papel: **cinco expressões** do envelope que a ADR-0012 declara canônico. *"É a mesma classe de defeito que a ADR-0012 existe para fechar, só que na definição em vez de na forma."*
  - **P3** — o bloco do `429` foi corrigido por **dois vereditos de gate consecutivos** e não recebeu o `DECISÃO FECHADA` que a §3 torna obrigatório nesse caso. *"O bloco já demonstrou ser um ímã de afirmação não medida três rodadas seguidas, e sem o marcador a quarta tentativa não encontra nada que a barre."*
- **Decisão do orquestrador**: **P1 e P3 entram na passada de fechamento** — o P1 porque alcança o documento que congela e o handoff é gerado dele (correção de uma linha), o P3 porque é a rule mais forte do repositório. **P2 fica como débito**, seguindo a própria alternativa que o gate ofereceu: é refatoração de cinco arquivos, sem defeito hoje.
- **Dois sinais de rule mining emitidos** (`convention_drift`): ADR superseded citada na superfície publicada; esquema do envelope duplicado por controlador.

### T9 — passada de fechamento e encerramento
- **Achado do executor que nenhum gate tinha visto**: além dos dois pontos apontados, `apps/api/src/main.ts:94` — o `setDescription` da **raiz** do documento OpenAPI — citava a ADR-0007 literalmente. *"É a citação mais visível de todas; sem ela o handoff sairia com a ADR aposentada no cabeçalho do contrato."*
- **16 das 20 citações de ADR-0007 corrigidas em `apps/api/src`**: as 3 da superfície publicada e 13 de comentário interno, **todas verificadas contra o texto da ADR-0012** (que preserva os quatro campos, o status HTTP semântico e o `codigo` de enum fechado) — nenhuma afirmação deixou de ser verdadeira e nenhuma exigiu reescrever raciocínio.
- **Deixadas com razão**: as 4 de `filtro-excecao.ts` (sob `DECISÃO FECHADA`, proibido tocar — *"o que torna o resto verificável por `grep`"*) e as de `packages/`, testes e manifestos, que não alcançam o documento publicado. *"Ampliar o diff para 15+ arquivos antes do congelamento é o que o §4.5 barra."* → débito.
- **Marcador `DECISÃO FECHADA` emitido** sobre o bloco do `429` (`senha.controller.ts:261`), com o `POR QUÊ` citando as três rodadas em uma linha cada e o cabeçalho **contrastando-se explicitamente** com o `DÉBITO COM GATILHO — D38` do mesmo arquivo — *"ele PROTEGE, ao contrário do que AGENDA"*, como a §3-B exige quando os dois convivem.

### `[T9] ledger: 12 achados totais | 8 originados em rodada >1 | 1 suspeito de incompletude da rodada 1`
- O único suspeito é **TR-P1** (o limitador perdido): ele existia desde a execução inicial e o **Gate 1 não o viu**, embora tenha rodado a suíte completa — a perda não era detectável por teste, só por leitura do caminho de entrada do arcabouço.
- Os demais `rodada_origem > 1` são **consequência legítima**: o `x-retry-after` e o mecanismo da janela só puderam existir depois de a correção do limitador escrever aqueles textos.

### Encerramento do run
- **Critérios de conclusão geral verificados**: `pnpm build` (exit 0), `pnpm lint` (exit 0), `pnpm test` (exit 0) — **350 casos verdes**: worker 16 · auth 82 · db 40 · shared 126 · api 86, em 37 arquivos de teste.
- **9/9 tasks concluídas.** Nenhuma bloqueada. Suíte de **274** (entrada do run) para **350** — **+76 casos**.
- `[run] rule_candidates: 4 sinais persistidos em _run/rule-candidates.md nesta fase de execução (qa=1, staff=3, orquestrador=0)`, somados aos 12 do pré-refinamento.
- `T9 — staged` · e o **índice foi corrigido**: o achado operacional do Gate 2 (20 arquivos comitados num snapshot temporário e depois desindexados, que faziam `git diff` lê-los como apagados) está resolvido — `git add -A` sobre `apps`, `packages`, `docs`, `deploy`, `CLAUDE.md` e `.claude` deixou **57 adições e 38 modificações**, com **zero untracked**. O diff da entrega não nasce mentindo.
- **Memória lazy deletada** (`_run/tmp/T8.md` e `_run/tmp/T9.md`), após o registro das métricas de ledger. O diretório está no `.gitignore` (linha 45).
- **O pipeline NÃO commitou** — o `git add` é o limite, e o commit é decisão do usuário.

### Fecho — escrituração do D40 e reconciliação final
- Marcador do **D40** emitido em `apps/api/src/usuarios/usuario.controller.ts`, e a escolha do arquivo foi **argumentada pelo critério da §3-B** (*"mora onde a tentação acontece"*): é o único arquétipo de **CRUD de negócio da empresa, sob sessão e `@ExigeChave`**, que é exatamente a forma dos controladores da F2 (imóveis, proprietários, locatários, contratos). Os concorrentes são formas raras — Master fora do tenant, ação única de autenticação, leitura sem parametrização, rota pública de infraestrutura.
- O marcador **declara na primeira linha o que alcança e que AGENDA em vez de proteger**, contrastando-se com a `DECISÃO FECHADA — T8 / Gate 2` do mesmo arquivo, e registra **que é deliberadamente único** — *"senão quem partisse de outra cópia leria a ausência como inexistência do débito"*.
- **Reconciliação final nas duas pontas**: marcadores vivos `{D23·F1/T8, D27·F1/T6, D28·F0/T5, D32·F0/T6, D37·F1/T8, D38·F1/T9, D39·F1/fechamento, D40·F1/T9}` — **oito**, iguais às oito linhas da tabela do `CLAUDE.md`. Nenhum órfão em nenhuma direção.
- **`CLAUDE.md` atualizado**: bloco "Estado atual" com a **F1 concluída** (as duas fatias fechadas), e a linha do marco de entrega refletindo que faltam F2 a F5.
