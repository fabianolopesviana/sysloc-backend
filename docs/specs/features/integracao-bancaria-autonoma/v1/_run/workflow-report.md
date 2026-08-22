## Challenge Session — 2026-08-21 (artifact: tech_spec.md)

- Questões processadas: **4** (todas de alta prioridade; nenhuma de prioridade média sobreviveu à exploração do código)
- Conflitos de terminologia resolvidos: **1** — "entrega imediata" (provisório, e inconsistente com os símbolos da própria spec) → **Entrega da notícia do provedor**
- Contradições com código real resolvidas: **2** — (a) forma das recusas de pré-condição do ato externo, que a spec dava como `404` fundido onde o precedente de `boleto.service.ts` usa três recusas de campo com `detalhes` discriminante e **sem `campo`**; (b) a spec chamava de "saída aberta" a projeção do certificado, que é `z.strictObject` por razão escrita
- Decisões implícitas explicitadas: **1** — onde vive *"o material foi convertido"*: §4.4 nova, esquema próprio do desfecho do registro, com a alternativa de persistir registrada e rejeitada
- Termos canonizados no glossário GLOBAL: **2** — `Entrega da notícia do provedor`, `Motivo da recusa do provedor` (mais 2 relacionamentos e 2 ambiguidades resolvidas)
- Termos canonizados no glossário FEATURE: **0** — nenhum é específico da fatia; a notícia já é global e um segundo provedor reusaria os dois
- Candidatos a ADR sinalizados: **0** novos (os 3 parciais da §21.2 foram reavaliados e mantidos parciais)
- ADRs sugeridos para criação: **0** — a decisão transversal da fatia já é a **ADR-0036**, registrada antes do PRD
- Verificações que **não** produziram achado, e que foram feitas: 15 arquivos citados como existentes (15 presentes) · símbolos importados da casa compartilhada · colisão de rota · numeração das migrações · existência do caso que o `CT-1021` reescreve
- Conformidade ADR: as 17 classificações da §21.1 foram reconferidas contra a `Decision` aberta; **nenhum conflito spec×ADR e nenhum ADR×ADR**


---

# Execução — run de tasks (agent-spec-sdd-run-tasks)

## Inicialização — 2026-08-21

- `[run] executor resolvido: sysloc-backend-implementer (origem: argumento explícito)`
- `[run] executor_discipline injetado (fonte: references/executor-discipline.md)`
- `[run] git verificado; \_run/tmp/ inexistente (cleanup idempotente: nada a remover); .gitignore já cobre `docs/specs/**/_run/tmp/` e `.run-ativo``
- `[run] resume pós-interrupção: NENHUM sinal (nenhuma task `Em Progresso`, nenhuma memória lazy, nenhum diff em path declarado de task não-terminal)`
- `[run] guarda de continuidade ARMADA`
- `[run] sdd_state.yaml: current_step=execution, execution.status=in_progress, tasks_total=10`
- `[run] reconciliação de dependências: NENHUMA divergência entre a tabela do task_plan.md e a §1 dos 10 TN.md — grafo idêntico nas duas fontes`
- **Observação não-bloqueante (diff prévio ao run)**: a árvore já continha, antes da primeira task, `M deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh`, `M docs/adr/INDEX.md`, `M docs/specs/domain-glossary.md` e os artefatos untracked da própria fase de spec (ADR-0036, PRD, specs, `_run/`). São produto do discovery/spec desta fatia, **não** de execução de task. O filtro por paths no `git diff <base_sha> -- <paths>` isola cada task; registrado aqui para que nenhum gate os leia como escopo de task.

### Decisão auto-resolvida (A1) — forma de injeção do conteúdo da task no prompt do executor

`[run] decisão auto-resolvida (A1): colar a §2–§8 da task verbatim no prompt vs. injetar o path com leitura obrigatória + colar verbatim os blocos que a skill declara obrigatórios → adotada a recomendada: **path com leitura obrigatória como primeira ação, mais Disciplina, ADRs aplicáveis, reforço de testes, checklist e formato de output colados verbatim** · razão: as tasks desta fatia têm 24 KB–58 KB; roteá-las inteiras pelo contexto do orquestrador acrescenta risco de truncamento silencioso da §6.6 (1 card por CT) sem nenhum ganho de fidelidade, enquanto o arquivo no repositório É a fonte canônica e o executor tem `Read`. Os blocos que a skill exige verbatim continuam colados, porque esses o executor NÃO herda por system-prompt.`

### Decisão auto-resolvida (A1) — granularidade do rule mining do pre-refinement §11

`[run] decisão auto-resolvida (A1): emitir `pre_refinement_decision` para as 10 decisões da §11 vs. para as que geram regra acionável → adotada a recomendada: **6 das 10** · razão: as 4 omitidas não são candidatas a regra — "a porta nova é conforme à arquitetura" e "o comportamento da tela está definido" são fatos da fatia, não convenção reutilizável; "este repositório só faz backend" e "roda em Opus, tudo em pt-BR" JÁ SÃO regra escrita no CLAUDE.md, e emiti-las produziria cluster duplicado na mineração. Registrado para que a ausência não seja lida como lacuna.`

## Fase 1 — lote paralelo

- `[Fase 1] lote paralelo: T1, T3 (DAG independente + símbolos disjuntos + paths disjuntos + alta contenção não compartilhada)`
  - **DAG**: T1 sem dependência; T3 sem dependência; nenhuma é ancestral da outra. T2 fica fora (depende de T1, mesma fase).
  - **Símbolos**: T3 não cria nem consome símbolo (`N/A` nas duas pontas); interseção vazia por construção.
  - **Paths**: T1 ⊆ `packages/cobranca-bancaria/**` + `CLAUDE.md` (condicional) × T3 = `deploy/scripts/instalacao/verificar-provisionamento.sh`. Interseção vazia.
  - **Alta contenção**: **só T1** toca barril (`packages/cobranca-bancaria/src/index.ts`). A regra exige que **ambas** toquem para excluir do lote — não é o caso.
- `[Fase 1] base_sha=82874d01861fc77a7ad8ce6672d04c9389be5fc1`
- `[Fase 1] guard de recursos de teste: ATIVO → QAs SERIALIZADOS (T1 depois T3); executores em paralelo`
  - Razão: a §6 da T1 roda integração real com o binário de criptografia do host e **gera material de certificado em execução no filesystem**; a §6 da T3 executa um script de verificação de provisionamento que inspeciona o mesmo host. O isolamento entre as duas **não está provado**, e o guard manda serializar quando ≥ 2 tasks do lote têm suíte não-unitária sem prova de isolamento. Falso-serial custa minutos; falso-paralelo gera flake e queima tentativa.
- `[T1] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high`
- `[T3] executor: opus (declarado no frontmatter)  gates: [qa] (declarado)  risk: low`
- `[T1] base_sha=82874d01861fc77a7ad8ce6672d04c9389be5fc1`
- `[T3] base_sha=82874d01861fc77a7ad8ce6672d04c9389be5fc1`
- `[T1] ADRs injetadas no executor: ADR-0036, ADR-0032, ADR-0025, ADR-0001 (fonte: task §7)`
- `[T3] ADRs injetadas no executor: ADR-0036 (fonte: task §7)`
- `[run] rule_candidates: 6 sinais persistidos em docs/specs/features/integracao-bancaria-autonoma/v1/_run/rule-candidates.md (qa=0, staff=0, orquestrador=6)` *(parcial — reemitido ao fim do run)*

## Fase 3 — guard do lote paralelo, pré-derivado (registro antecipado; o lote só se forma quando T2, T7 e T8 fecharem)

- `[Fase 3] lote paralelo previsto: T9, T10` — os quatro guards conferidos contra a §5 real de cada task, não contra a coluna do task_plan:
  - **DAG**: nenhuma depende da outra; as duas dependem do mesmo conjunto (T2, T7, T8), o que **não** cria aresta entre elas.
  - **Símbolos**: `N/A` nas duas pontas em ambas — nenhuma cria código de produção. Interseção vazia por construção.
  - **Paths**: T9 = {`apps/api/test/segredo-nao-escapa.e2e.spec.ts`, `apps/api/test/vocabulario-na-saida-real.e2e.spec.ts`} × T10 = {`apps/api/test/percurso-do-cliente-novo.e2e.spec.ts`, `apps/worker/test/conferencia-bancaria.spec.ts`, `CLAUDE.md`, `tech_spec.md`}. **Interseção vazia** — as duas vivem em `apps/api/test/` mas em arquivos distintos.
  - **Alta contenção**: nenhuma toca barril, DI, router, manifesto ou diretório de migrações. `CLAUDE.md` **não** é arquivo de alta contenção pela lista canônica (não é barrel/manifest/registry) — é conteúdo asserido por suíte, que é outra coisa.
- `[Fase 3] guard de recursos de teste: ATIVO → QAs SERIALIZADOS (T9 depois T10); executores em paralelo`
  - Razão **medida na §5**, não presumida: as duas rodam suíte de borda `apps/api` com instância efêmera (`pnpm --filter @sysloc/api test`), e a T10 ainda arrasta `apps/worker` e `@sysloc/shared`. É exatamente o cenário que o task_plan §4.2 antecipou com o aviso de flake.

### Observação de acoplamento por CONTEÚDO (não por arquivo) — registrada para não ser descoberta tarde

`CLAUDE.md` aparece na §5.2 de **duas** tasks: na **T1** de forma **condicional** (só se ela registrar `DÉBITO COM GATILHO`, caso em que a linha entra no índice) e na **T10** de forma **certa** (contagem de ADRs 36/29 e contagem da suíte remedida). **Não é colisão de lote** — T1 é Fase 1 e T10 é Fase 3, e a T10 depende transitivamente da T1 —, mas **é ordem obrigatória**: a T10 tem de ler o índice **já com** a linha que a T1 porventura acrescentou. A ordem topológica do run garante isso; o registro existe para que nenhuma correção posterior "otimize" a ordem.

⚠️ E as duas edições de `CLAUDE.md` caem sob a barreira executável `packages/shared/test/protocolo-antirregressao.spec.ts` (CT-501 a CT-510), que afirma o índice de débito **nas duas pontas**. Marcador emitido sem linha no índice — ou linha no índice sem marcador vivo — **fica vermelho na suíte**. Vale para a T1 tanto quanto para a T10.

## Fase 2 — sequencialidade CONFIRMADA contra a §5 real (não contra a coluna do task_plan)

Paths declarados, extraídos de cada `TN.md`:

| Task | Arquivo de alta contenção que ela toca |
|---|---|
| T4 | `packages/db/src/index.ts` (barril) · `packages/db/migracoes/` (**diretório de migrações — a ordem é estado compartilhado**) · `migracoes/meta/_journal.json` |
| T5 | `packages/cobranca-bancaria/src/index.ts` (barril) |
| T6 | *(nenhum — mas depende de T5 no DAG)* |
| T7 | `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts` (**composição raiz / DI**) |
| T8 | `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts` (**o MESMO arquivo de DI da T7**) · `apps/worker/src/main.ts` · `packages/shared/src/fila.ts` |

`[Fase 2] fallback: sequencial T4 → T5 → T6 → T7 → T8` — e a derivação **fecha por dois caminhos independentes**, não por conservadorismo: T7 × T8 compartilham literalmente o mesmo arquivo de composição raiz (guard de alta contenção), **e** T8 depende de T7 no DAG. O task_plan §4.2 já dizia isso; fica agora conferido contra o arquivo, não contra a prosa.

## CORREÇÃO do registro anterior — `CLAUDE.md` está em TRÊS tasks, não duas

O bloco anterior deste relatório afirmou que `CLAUDE.md` aparece na §5.2 de **duas** tasks. **Está incompleto**, e a medição contra as §5 reais mostra **três**:

| Task | Fase | Edição de `CLAUDE.md` | Natureza |
|---|---|---|---|
| **T1** | 1 | linha no índice de débito | **condicional** — só se a task registrar `DÉBITO COM GATILHO` |
| **T7** | 2 | contagem da superfície em prosa (**103/88/20 → 105/90/20**) | **certa** — e no **mesmo diff** da constante executável que o `CT-1004` afirma |
| **T10** | 3 | contagem de ADRs (**36 / 29**) e contagem da suíte remedida por pacote | **certa** |

**As três são sequenciais por fase e a ordem topológica as encadeia** — nenhuma colisão de lote. O que a correção acrescenta é a **T7**, que é a mais mordente das três: a §5.2 dela junta `CLAUDE.md` a `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`, e a regra `.claude/rules/ancoras-de-superficie.md` exige que **a contagem em prosa suba no mesmo diff da constante que o teste afirma**. Separar as duas é o defeito que a regra nomeia.

⚠️ E as três caem sob a barreira executável `packages/shared/test/protocolo-antirregressao.spec.ts` (CT-501 a CT-510), que afirma o índice de débito **nas duas pontas**.

## Acoplamento por conteúdo dentro de `packages/cobranca-bancaria` (T1 → T5 → T6)

A **T1** refatora `test/adaptador-sicoob.spec.ts` e `test/leitura-do-material.spec.ts` para **importarem** o molde de varredura da casa compartilhada nova (Limiar de Três). A **T6** volta a `test/adaptador-sicoob.spec.ts`; a **T5** volta a `test/vocabulario-canonico.spec.ts`, que a T1 pode ter tocado. Fases distintas ⇒ sequencial garantido, mas **T5 e T6 herdam a forma que a T1 deixou** — quem as executar deve importar da casa compartilhada, **nunca** redeclarar o molde localmente (é a convenção "Acessório de suíte se importa, não se copia" do `CLAUDE.md`, e é o que faz o Limiar de Três funcionar).

## Interrupção do processo e resume — 2026-08-21

`[run] INTERRUPÇÃO: o processo anterior do Claude Code saiu com os executores de T1 e T3 em voo; nenhum dos dois deixou registro de conclusão. O monitor de espera caiu junto.`

**Medição do estado real, antes de qualquer decisão** (é o que o resume exige — não se presume nem o pior nem o melhor):

| Sinal | Medido |
|---|---|
| `packages/cobranca-bancaria/src/conversao-do-material.ts` | **ausente** |
| `packages/cobranca-bancaria/test/conversao-do-material.spec.ts` | **ausente** |
| `packages/cobranca-bancaria/test/varredura-de-agulhas.ts` | **ausente** |
| `deploy/scripts/instalacao/verificar-provisionamento.sh` | **sem diff** contra o `base_sha` |
| `git diff --stat` vs `base_sha` | só os 3 artefatos de spec **pré-existentes ao run** (`preparar-material-do-certificado.sh`, `INDEX.md`, `domain-glossary.md`) |

**Conclusão: nada landou.** Os dois executores morreram ainda na fase de leitura obrigatória (task de 49 KB / 29 KB, ADRs, doutrina de testes, baseline). Não há trabalho parcial, não há arquivo untracked a remover, não há estado inconsistente. O `git checkout` da opção (b) do resume seria **no-op**.

### Decisão auto-resolvida (A1) — forma do resume

`[run] decisão auto-resolvida (A1): (a) retomar os executores via SendMessage, preservando o transcript · (b) redespachar do zero · (c) parar e perguntar → adotada a recomendada: **(a) retomar via SendMessage** · razão: os transcripts estão salvos (T1 em 571 KB, T3 em 303 KB) e representam a leitura obrigatória JÁ CONCLUÍDA — task integral, 4 ADRs (T1) / 1 ADR (T3), doutrina de antipadrões e medição de baseline. Redespachar do zero repetiria tudo isso sem nenhum ganho. E o risco que normalmente desaconselha retomar — contexto do agente descrever um working tree que mudou — **não existe aqui, porque foi medido que nada foi escrito**: o repositório está byte a byte como os agentes o leram. A opção (c) está descartada pela §A1 da autonomia-do-run.`

`[run] resume: T1 e T3 retomados por SendMessage; base_sha INALTERADO (82874d0) — nenhuma recaptura necessária, porque HEAD não se moveu e nada foi staged.`

## Medição antecipada — a contagem de ADRs que a T10 vai escrever no `CLAUDE.md`

O critério de conclusão da feature manda o `CLAUDE.md` dizer **"36 ADRs registradas / 29 `accepted`"** (T10). Medido hoje, **antes** de a task existir, para que o executor da T10 não tenha de inferir e para que ninguém "corrija" o número de memória depois:

| Grandeza | Medido | Comando |
|---|---|---|
| Arquivos de ADR | **36** | `ls docs/adr/*.md \| grep -v INDEX \| wc -l` |
| `accepted` | **29** | ocorrências no `INDEX.md` |
| `superseded` | **4** | idem |
| `deprecated` | **3** | idem |

**Fecha por soma: 29 + 4 + 3 = 36.** O par `36 / 29` do critério de conclusão está **correto** e conferido contra o repositório, não contra a prosa do plano. (O `CLAUDE.md` hoje ainda diz **35 registradas / 28 `accepted`**, medido no fecho da `webhook-e-carne` — a diferença de 1 em cada eixo é exatamente a **ADR-0036**, criada nesta fatia e ainda não refletida no índice. É isso que a T10 remedia.)

## T3 — executor concluído

`[T3] executor retornou: 1 criado (evidência efêmera), 2 modificados · CT-1045 com 8 asserções · prova de falsificação DEMONSTRADA por execução (controle limpo + 4 mutantes, cada um reprovando por asserção distinta) · Garantias removidas: nenhuma`

**Escopo conferido pelo orquestrador contra a §5 declarada — SEM desvio:**

| Arquivo tocado | Declarado? |
|---|---|
| `deploy/scripts/instalacao/verificar-provisionamento.sh` (+231 / −4) | ✅ §5.2 — o único arquivo a modificar |
| `_run/tmp/T3-prova-de-falsificacao-ct1045.txt` | evidência efêmera, diretório **gitignored** — artefato de prova, não código. Não conta como criação fora de escopo |
| `tasks/T3.md` | o próprio arquivo da task (checklist marcado) — esperado |

`[T3] arquivos tocados NÃO declarados: NENHUM`

**Duas verificações independentes do orquestrador, porque são o coração desta task:**

- `grep -c "DÉBITO COM GATILHO" deploy/scripts/instalacao/verificar-provisionamento.sh` → **1**. O marcador do `D9 · F0/T2` está **intacto**. A task o leu e não o removeu, que é o correto: ele **agenda**, não protege, e o gatilho dele (*"a próxima fatia que escrever um `verificar-*.sh`"*) **não disparou**, porque nenhum verificador novo foi criado.
- `ls deploy/scripts/*/verificar-*.sh | wc -l` → **11**.

### Achado de fato medido contra a spec — o AT-3 da T3 está defasado

O **AT-3** da T3 afirma *"a contagem de verificadores permanece 10"*. **Medido: são 11**, e já eram **antes** desta task. O 11º é `deploy/scripts/cobranca-bancaria/verificar-preparacao-do-material.sh`, **untracked**, criado na preparação desta fatia (fase de discovery/ADR-0036), **não** por nenhuma task deste run.

- **A intenção do AT-3 está satisfeita**: a task **não criou verificador nenhum**, e o `D9` não foi agravado. O que está errado é o **número literal** escrito na spec, que envelheceu entre a redação da task e a execução.
- É o **corolário do precedente de método do repositório** operando outra vez: *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica — meça a premissa antes de registrá-la."*
- **Passado explicitamente ao Gate 1** para que ele não reprove o AT-3 por um fato que a task não causou e não podia corrigir sem alargar escopo.

### Decisão auto-resolvida (A1) — ordem do Gate 1 da T3

`[T3] decisão auto-resolvida (A1): despachar o Gate 1 da T3 agora (em paralelo com o executor da T1 ainda em voo) vs. aguardar o executor da T1 concluir → adotada a recomendada: **aguardar** · razão: é o Guard executor×QA da rule de Execução Paralela, e ele não é hipotético aqui — o próprio executor da T3 MEDIU a contaminação: "pnpm lint e pnpm test AGREGADOS estão indisponíveis por trabalho CONCORRENTE da T1 em packages/cobranca-bancaria/, com conversao-do-material.ts e index.ts gravados às 21:53/21:54, durante a minha execução". O QA executa o comando de teste canônico do projeto e apanharia o estado INTERMEDIÁRIO da T1, produzindo falha alheia à T3 que queimaria uma das 3 tentativas. O diff da T3 não tem uma linha de TypeScript — a falha seria 100% de terceiro.`

## T1 — ponto de atenção a instrumentar no Gate 1 (registrado ANTES de o executor retornar)

O diff da T1 em `packages/cobranca-bancaria/` fecha com **165 inserções contra 210 deleções** — saldo **líquido negativo**, e a maior parte das deleções está em **dois arquivos de teste** (`adaptador-sicoob.spec.ts`, ~149 linhas mexidas; `leitura-do-material.spec.ts`, ~104).

**A leitura benigna é a esperada e está declarada na §3.7 da task**: é o **Limiar de Três** operando — as duas cópias privadas do molde de varredura de agulhas foram removidas para dar lugar a uma importação da casa compartilhada nova (`test/varredura-de-agulhas.ts`, 172 linhas). Código duplicado sai, código único entra: o saldo negativo é o **objetivo**, não um efeito colateral.

⚠️ **Mas essa é, byte a byte, a mesma assinatura de diff do AP-24 (`weakening_test_to_pass`)**, que o Gate 1 classifica como **CRÍTICO**. As duas hipóteses — *"helper duplicado foi extraído"* e *"caso de teste foi apagado para o gate passar"* — produzem **o mesmo formato de diff**, e só se distinguem examinando **o que** desapareceu.

**Discriminador a exigir do Gate 1** (vai literal no prompt dele):

1. **Contagem de casos por unidade**, não só o total: a baseline do pacote é **93 casos** (`CLAUDE.md`, medida em 2026-08-20). O total pode subir por causa dos CTs novos e **esconder** a queda numa unidade — é por isso que a comparação tem de ser por arquivo.
2. **Natureza do que foi deletado**: cada bloco removido dos dois `.spec.ts` tem de ser **declaração de helper** (`function`/`const` do molde), nunca `it`/`test`/`describe`.
3. Se alguma unidade perder caso sem justificativa `SUT_IS_CORRECT_BECAUSE:`, é **AP-24 → CRÍTICO**, e a extração do molde **não** é desculpa.

> Registrado agora, **antes** do retorno do executor, para que a instrução ao gate não seja construída depois de já conhecer o resultado dele.

## T1 — conferência do `D1 · F5/T1` pelo orquestrador (as duas pontas do CT-907)

A T1 emitiu um `DÉBITO COM GATILHO` novo durante a execução. Conferido **antes** do gate, nos dois sentidos que a §3-B exige:

| Sentido | Resultado |
|---|---|
| **Marcador → registro** | `packages/cobranca-bancaria/src/conversao-do-material.ts:394` — forma canônica completa: `O QUÊ` (o estouro de `TETO_DA_CONVERSAO_MS` não tem caso que o exerça; a prova existente cobre a **consequência**, o intermediário removido no caminho de erro do `CT-1016`, não o disparo), `QUANDO FECHA`, `POR QUE NÃO AGORA` e `ÍNDICE` |
| **Índice → marcador** | linha presente na tabela do `CLAUDE.md`, com o par `D1 (F5/T1, fatia integracao-bancaria-autonoma)` e a contagem em prosa ajustada **32 → 33** |

**Verificação de conjunto, nas duas direções, feita pelo orquestrador:**

```
código (marcadores reais): 32 pares distintos
índice (linhas do CLAUDE.md): 32 pares distintos
no ÍNDICE sem marcador no código (órfão): NENHUM
no CÓDIGO sem linha no índice:            NENHUM
```

Dois esclarecimentos que a medição exigiu, e que valem para quem repetir a conferência:

1. **`D99 · F7/T3` NÃO é débito** — é **fixture** do `CT-908`, o controle de não-cegueira que prova que a expressão de detecção reconhece um marcador na forma canônica. O número é deliberadamente impossível (fase que não existe) para não colidir com débito real. Quem contar marcadores por `grep` cru **precisa excluí-lo**, ou conta 33 onde há 32.
2. **33 linhas na tabela, 32 pares distintos** — não é inconsistência: são os **dois `D13 · F4/T6`**, que repetem o par inteiro (fatias `emissao-e-conciliacao` e `webhook-e-carne`) e só se separam pelo caminho do `ÍNDICE`. O `CLAUDE.md` já documenta esse caso como o primeiro do repositório.
3. **O `grep` cru do bloco do `CLAUDE.md` retorna 96 arquivos / 123 ocorrências**, mas só **103** são marcador canônico (`DÉBITO COM GATILHO — D`) e o resto são **menções à convenção** em docblock — inclusive as que contrastam com `DECISÃO FECHADA` (*"ele PROTEGE — ao contrário de um DÉBITO COM GATILHO, que AGENDA"*). Contagem de débito exige o par, não a expressão solta.

`[T1] D1 · F5/T1 — escrituração ÍNTEGRA nas duas pontas, conferida pelo orquestrador antes do Gate 1`

## Lote da Fase 1 — separação da lista de arquivos por task (pré-computada para os dois Gates)

`base_sha` é **comum ao lote**, então `git diff --name-only <base_sha>` devolve **a união de T1 + T3 + resíduo pré-run** — 10 arquivos. Entregue cru a qualquer um dos dois QAs, ele faria a **Camada 0 julgar entregável de outra task**. Separação apurada pelo orquestrador:

| Origem | Nº | Arquivos |
|---|---|---|
| **T3** | 1 | `deploy/scripts/instalacao/verificar-provisionamento.sh` |
| **T1** | 6 (+2) | `CLAUDE.md` · `packages/cobranca-bancaria/src/index.ts` · `test/adaptador-sicoob.spec.ts` · `test/leitura-do-material.spec.ts` · `test/material-de-teste.ts` · `test/vocabulario-canonico.spec.ts` — mais `src/conversao-do-material.ts` e `test/varredura-de-agulhas.ts`, **untracked**, que só entram no diff após o `git add -N` do Passo 3.4 |
| **Resíduo pré-run** | 3 | `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` · `docs/adr/INDEX.md` · `docs/specs/domain-glossary.md` — produto do discovery/spec desta fatia, **anterior à primeira task**; não é escopo de nenhuma das duas |

`[T3] lista para o Gate 1: 1 arquivo (o declarado) — resíduo do lote e da spec SUBTRAÍDO`
`[T1] lista para o Gate 1: 8 arquivos — pendente do git add -N nos 2 untracked, que roda quando o executor retornar`

⚠️ **O `git add -N` nos untracked da T1 é pré-condição do Gate 1 dela**: sem ele, `conversao-do-material.ts` (o módulo, 576L) e `varredura-de-agulhas.ts` (a casa compartilhada, 172L) **não aparecem** no `git diff --name-only`, e a Camada 0 reportaria `arquivos_a_criar_faltantes` **falsamente** — reprovando a task por um artefato que existe e está correto no disco.

## T1 — executor concluído

`[T1] executor retornou: 4 criados, 7 modificados · build ✓ · lint ✓ · @sysloc/cobranca-bancaria 100/100 (baseline 93) · @sysloc/shared 254/254`

**Escopo conferido contra a §5 — SEM desvio.** 9 arquivos no diff, **todos** declarados:

`src/conversao-do-material.ts` (+577, novo) · `test/conversao-do-material.spec.ts` (+651, novo) · `test/varredura-de-agulhas.ts` (+172, novo) · `src/index.ts` (+36, barril) · `test/material-de-teste.ts` (+73) · `test/adaptador-sicoob.spec.ts` (158 mexidas) · `test/leitura-do-material.spec.ts` (105 mexidas) · `test/vocabulario-canonico.spec.ts` (+13) · `CLAUDE.md` (12)

`[T1] arquivos tocados NÃO declarados: NENHUM`
`[T1] git add -N aplicado aos 3 novos ANTES do Gate 1 — sem ele a Camada 0 reportaria arquivos_a_criar_faltantes falsamente`

**O ponto de atenção AP-24 que registrei antes do retorno foi respondido pelo executor, e de frente:**

- a contagem **subiu** (93 → 100), não caiu;
- ele **nomeia** o que saiu — `Agulha`, `superficiesDe`, `ocorrenciasDeAgulhas`, `controleComAsAgulhas`, `agulhasDe`, `espolioDe`, `ocorrenciasDe` e dois imports órfãos de `inspect` — tudo **declaração de helper**, nenhuma asserção;
- e afirma que a casa compartilhada é **igual ou mais forte** em três eixos (profundidade `10 → ilimitada`, casamento `sensível → insensível à caixa`, rótulo opcional), com as listas de rótulos do adaptador subindo de **3 para 4 agulhas**.

⚠️ **A afirmação não é aceita de palavra**: o prompt do Gate 1 manda **verificar** os três eixos, e declara que *"se a casa compartilhada for mais FRACA em qualquer eixo, isso é AP-24 e a extração não é desculpa"*. A contagem **por unidade** também foi exigida, porque só o total esconde compensação entre unidades.

### Duas divergências declaradas pelo executor, ambas legítimas

1. **`CT-1022` acrescentado** além dos cards da §6.6, com card próprio na §6.6 e linha na §6.5 — fecha o **risco R2** (o sinal do conversor, radical `mac verify` medido nas duas pontas). Acréscimo de prova, não subtração.
2. **Atrito A2 NÃO se materializou** — o `CT-1017` rodou **determinístico em 5 execuções** (2 na suíte completa, 3 isoladas). Portanto **nenhum débito A2 foi registrado** e a asserção ficou no **valor exato `0o600`**, sem afrouxamento. É o desfecho certo: a conduta prescrita (`débito com gatilho`) valia **se** a instabilidade aparecesse, e ela não apareceu. Medir antes de registrar é o precedente do repositório, e aqui ele poupou um débito que teria nascido falso.

`[T1] Gate 1 despachado: agent-spec-qa-validator, model=opus (rule: diff_touches_critical_path — crypto/secrets; task_risk=high)`
`[T3] Gate 1 SEGUE represado — agora pelo QA da T1, pelo mesmo Guard de recursos de teste: os dois QAs executam suíte no mesmo working tree`

## Pré-condições da T2, verificadas enquanto o Gate 1 da T1 roda

**1. Os cinco símbolos que a T2 consome já estão publicados no barril da T1** — `packages/cobranca-bancaria/src/index.ts`, símbolo a símbolo, com docblock justificando a saída de cada constante:

```
export type { MaterialPreparado }
converterMaterialSeNecessario
ErroDeFormatoDoMaterial
MOTIVO_DO_FORMATO_NAO_SUPORTADO
RADICAL_DE_SENHA_DO_CONVERSOR
```

A dependência `T2 ← T1` da §6.1 do task_plan está **satisfeita**. O docblock do barril já nomeia o consumidor ("a borda de registro"), o que é o certo: publicação sem consumidor declarado é superfície especulativa.

**2. O `D64 · F4/fechamento` segue vivo nas DUAS pontas** — e tem de seguir, porque **quem o paga é a T2**, não a T1:

| Ponta | Onde |
|---|---|
| Marcador | `apps/api/src/integracoes-bancarias/certificado.service.ts:174` (junto de `MENSAGEM_DO_MATERIAL_RECUSADO`, declarado na linha 190) |
| Índice | `CLAUDE.md` linha 369 |

⚠️ A T2 tem de remover **as duas no MESMO commit** — é critério de conclusão da feature, e a barreira `packages/shared/test/protocolo-antirregressao.spec.ts` (CT-907) afirma o índice nos dois sentidos: marcador órfão e linha órfã reprovam igualmente.

ℹ️ A ocorrência de `D64` em `packages/cobranca-bancaria/test/material-de-teste.ts:120` é **menção em docblock** (explica por que o gerador produz `RC2-40-CBC`), **não** um segundo marcador. Quem for pagar o débito não deve tentar removê-la como se fosse — ela documenta o gerador de cifra legada que a T1 acabou de criar, e continua correta depois do fecho.

## T3 — material do Gate 1 consolidado (pronto para disparo assim que o guard liberar)

- **CT exigido: apenas `CT-1045`.** `CT-1011` e `CT-1013` aparecem na task como **molde de referência** (vindos de `verificar-preparacao-do-material.sh`), **não** como entregáveis — cobrá-los seria rejeição por leitura errada da §6.
- **Lista de arquivos: 1** — `deploy/scripts/instalacao/verificar-provisionamento.sh`. Resíduo do lote (6 arquivos da T1) e da spec (3) já subtraído.
- **Comando**: a validação da T3 é a **execução do próprio verificador** com controle e mutantes — ela **não participa de `pnpm test`** (raio de impacto declarado: nenhum; o verificador não é importado por pacote algum). Evidência bruta que o executor deixou para auditoria sem reexecução: `_run/tmp/T3-prova-de-falsificacao-ct1045.txt`.

**Dois critérios que precisam chegar ao gate COM a razão, sob pena de rejeição indevida:**

| Critério | Situação | Por quê |
|---|---|---|
| **AT-3** — *"a contagem de verificadores permanece 10"* | **número defasado: são 11** | O 11º (`verificar-preparacao-do-material.sh`, untracked) existe **desde antes** desta task, criado na preparação da fatia. A **intenção** do AT-3 está satisfeita: nenhum verificador novo, `D9 · F0/T2` não agravado, marcador intacto (conferido pelo orquestrador: `grep -c` = 1). O que envelheceu foi o literal na spec |
| **AT-6** — registrar divergência **se** a extração se mostrasse inviável | **não se aplicou** | A extração por `sed`+`eval` **funcionou** e o `CT-1045` rodou sem privilégio. Critério vacuamente satisfeito; o executor o marcou com comentário explicando em vez de fingir cumprimento — que é a conduta correta |

⚠️ Nenhum dos dois é defeito da task. O primeiro é **fato medido contra spec defasada**; o segundo é **condicional cuja hipótese não ocorreu**.

## T1 — Gate 1 (QA): APROVADO

`[T1] QA veredito=APROVADO · critérios 12/12 · CTs 7/7 · problemas: 0 críticos, 0 altos, 0 médios, 0 baixos · security_flags: [] · adr_compliance: 0 violações · escopo_testes=SUITE_COMPLETA · tocou_area_critica=true`
`[T1] contagem por unidade: cobranca-bancaria 93 → 100 (soma das 8 unidades PRÉ-EXISTENTES = 93, idêntica à baseline ⇒ compensação entre unidades é IMPOSSÍVEL) · shared 254 → 254`
`[T1] antipadroes_verificados: 6/6 arquivos de teste declarados — COMPLETO`
`[T1] Ledger: não criado (rodada 1 aprovada sem rejeição — sem achado bloqueante a rastrear)`
`[T1] rule_candidates do QA: 0, com razão declarada (os dois padrões repetidos JÁ SÃO regra escrita: testing-stack.md e o Limiar de Três do CLAUDE.md — emitir seria ruído na mineração)`

### O ponto de atenção AP-24 foi discriminado nos três passos, e o veredito é NÃO-AP-24

| Passo | Resultado |
|---|---|
| **1 — contagem por unidade** | medida com reporter JSON, unidade a unidade. `adaptador-sicoob` = 17, `leitura-do-material` = 4, `vocabulario-canonico` = 17. **A soma das 8 unidades pré-existentes é 93, exatamente a baseline** — logo nenhuma perdeu caso e **compensação é aritmeticamente impossível**. O crescimento vem inteiro da unidade nova (7) |
| **2 — natureza do deletado** | conferido **nominalmente**: nenhum dos símbolos (`Agulha`, `superficiesDe`, `ocorrenciasDeAgulhas`, `ocorrenciasDe`, `espolioDe`, `agulhasDe`, `controleComAsAgulhas`) sobrevive como declaração em `test/`; a única declaração de cada um está na casa compartilhada, e as três suítes a importam. **Todos os `it` continuam presentes e nomeados por CT** — inclusive a linha sob `DECISÃO FECHADA — T9 / Gate 1 · 2026-08-15`, que permanece intacta |
| **3 — força da substituição** | verificada nos três eixos: profundidade `depth: null` + `maxStringLength/maxArrayLength: null` (ilimitada, contra `depth: 10`); caixa normalizada por `toLowerCase()` (insensível, contra sensível); rótulo opcional. As listas do adaptador hoje enumeram **quatro** agulhas. **Em nenhum eixo a importada é mais fraca — a extração é corretiva** |

### ⚠️ ERRO DO ORQUESTRADOR, corrigido pelo gate — `CT-1021` NÃO é da T1

Eu passei ao Gate 1 uma lista de CTs que incluía o **`CT-1021`**. **Está errado**, e a causa é minha: extraí os CTs por `grep -oE 'CT-1[0-9]{3}' T1.md`, e o `CT-1021` aparece naquele arquivo **apenas como citação** — no card do `CT-1022`, na frase *"CT-1022 é o primeiro livre depois de CT-1021"*.

O QA fez o certo: **leu a §6 canônica**, constatou que não há card na §6.6, linha na §6.5 nem entrada na §6.2 para ele, localizou-o na **§6.5 da T2** (`T2.md:224` — *"as três causas de recusa, discrimináveis pelo código (CT-1021) — REESCRITA"*) e verificou que a §6.3 da T1 declara a borda HTTP explicitamente **fora de escopo**. Reportou a divergência em `observacoes` em vez de reprovar a task por um CT que ela nunca deveu.

**Lição operacional, aplicada já no Tech Review**: `grep` de identificador em arquivo de task **conta citação como se fosse exigência**. A lista de CTs exigidos sai da **§6.5/§6.6**, nunca de varredura do arquivo inteiro. Os CTs reais da T1 são **sete**: `CT-1014`, `CT-1015`, `CT-1016`, `CT-1017`, `CT-1018`, `CT-1019`, `CT-1022`.

### Três observações do gate que NÃO são achado, e por quê

1. **`CT-1016` planta sentinela em `/dev/shm` com nome LITERAL FIXO** — duas execuções **simultâneas** da suíte deste pacote colidiriam no sentinela e nas listagens por prefixo. O gate classificou como **risco de ambiente, não defeito de teste** (o caso passa sozinho, com filtro e em ordem alternada), e observou que randomizar só o *sufixo* fecharia a janela sem violar a exigência do card, que prescreve o prefixo literal por extenso. ⚠️ **É exatamente o cenário que o Guard de recursos de teste deste run existe para impedir** — a serialização dos QAs não foi conservadorismo ocioso.
2. **Redundância no `CT-1022`** — uma linha compara duas constantes locais do arquivo de teste e não pode falhar por estado do SUT. **Não é AP-29**: ela não substitui nem enfraquece prova alguma (a asserção discriminante é a linha anterior, medida sobre saída de erro **real** do executável); o que ela guarda é a coerência entre dois literais numa edição futura. Registrada como redundância de baixo valor.
3. **ADR-0036 e a conferência de identidade** — a ADR pede *"titular, número de série e validade"*; o módulo confere titular, validade nas duas pontas e a **impressão digital SHA-256 do certificado inteiro em DER**. Igualdade de impressão digital **implica** igualdade de série, titular, validade e chave pública, e expor `serialNumber` alargaria superfície publicada que o `CT-806` afirma por igualdade. **Estritamente mais forte que a letra da ADR, não mais fraca.**

`[T1] Gate 2 despachado: agent-spec-staff-architecture-review, model=opus (rule: diff_touches_critical_path + task_risk=high)`
`[T3] Gate 1 LIBERADO e despachado em paralelo com o Gate 2 da T1 — o Tech Review NÃO re-executa suíte (nenhuma das 3 condições do contrato dele se aplica: executou_testes=true, escopo=SUITE_COMPLETA, zero CRITICO em architecture/security) e o QA da T3 roda script shell, não vitest. Recursos disjuntos, sem colisão.`

## T2 — material de despacho consolidado (enquanto os gates da Fase 1 rodam)

**ADRs a injetar (bloco [2.1])**: ADR-0017 (+emenda de 2026-08-16 — a `Decision` remete o contador à **0033**, não à 0015) · ADR-0036 · ADR-0032 · ADR-0016 · ADR-0034 · **ADR-0030 pela CLÁUSULA DE EXCLUSÃO** (o material convertido **não** é artefato derivado que "nunca é armazenado" — fato recebido de terceiro é dado de entrada, e guardá-lo é o único caminho).

**Paths declarados**: `packages/shared/src/erros.ts` · `packages/contracts/src/integracao-bancaria.ts` · `apps/api/src/integracoes-bancarias/certificado.service.ts` · `certificado.controller.ts` · `apps/api/test/certificado-do-provedor.e2e.spec.ts` · `packages/contracts/test/esquemas.spec.ts` · `CLAUDE.md` · `docs/specs/features/fundacao-bancaria/v1/_run/run-report.md`

### ⚠️ Ponto que precisa chegar ao executor E aos gates com a razão junto

A §5.2 da T2 inclui **`docs/specs/features/fundacao-bancaria/v1/_run/run-report.md`** — o relatório de **outra fatia, já fechada**. Lida sem contexto, essa edição parece violar a regra de que *"relatório de fatia fechada é registro histórico e não se reescreve"* (§3-B da `nao-regressao.md`), e um gate rigoroso a marcaria como `scope_deviation`.

**Ela é legítima e obrigatória**, por três razões:

1. É para onde o campo **`ÍNDICE`** do marcador do `D64` aponta — o débito foi registrado na §2 **daquela** fatia, porque a sequência `Dnn` corre dentro da fatia que o registrou.
2. **Marcar o fecho de um débito não é reescrever o registro** — é completá-lo. A §3-B prevê exatamente isso ao falar da "marca de fecho", e o `CLAUDE.md` registra que **39 débitos já pagos** tiveram o fecho promovido justamente por estarem invisíveis a quem tria pelo cabeçalho.
3. O **AT-9** da T2 exige o fecho **no mesmo commit**, e o fecho tem **três pontas**: marcador fora de `certificado.service.ts`, linha fora do índice do `CLAUDE.md`, e a marca de fecho na §2 da `fundacao-bancaria`.

**O que continua proibido**: alterar o texto histórico daquele relatório fora da marca de fecho do `D64`. A edição é **cirúrgica e aditiva**.

### O AT-9 é o critério mais mordente da T2

`pnpm --filter @sysloc/shared test` **verde** é parte do critério, porque o `CT-907` de `protocolo-antirregressao.spec.ts` afirma o índice **nas duas pontas** por `fs`: marcador removido sem tirar a linha do índice — ou o inverso — **fica vermelho na suíte**. Não é questão de boa-fé, é barreira executável. E a contagem em prosa do `CLAUDE.md` terá de descer de **33 para 32** no mesmo diff.

ℹ️ Lembrete já registrado: a ocorrência de `D64` em `packages/cobranca-bancaria/test/material-de-teste.ts:120` é **menção em docblock**, não marcador. **Não se remove** — ela documenta o gerador de cifra legada que a T1 criou, e segue correta depois do fecho.

## T3 — Gate 1 (QA): APROVADO_COM_OBSERVACOES · TASK CONCLUÍDA

`[T3] QA veredito=APROVADO_COM_OBSERVACOES · critérios 6/6 · CTs 1/1 · problemas: 0 críticos, 0 altos, 0 médios, 1 baixo (documentation) · security_flags: [] · adr_compliance: 0 violações · escopo_testes=PARCIAL · tocou_area_critica=false`
`[T3] antipadroes_verificados: 1/1 arquivo — COMPLETO`
`[T3] Ledger: não criado (rodada 1 sem rejeição)`
`[T3] Gate 2: PULADO por gates=[qa] declarado no frontmatter`
`[T3] staged: deploy/scripts/instalacao/verificar-provisionamento.sh`
`[T3] Status → Concluído · tasks_completed 0 → 1`
`[T3] débito anotado: D2 · baixo · documentation → §2 do run-report`

### O que o gate fez além do exigido, e que aumenta a confiança no resultado

- **Reexecutou o SUT commitado**, sem privilégio, pelo mesmo mecanismo do caso (`sed`+`eval`), e reproduziu os três desfechos **byte a byte**. Confirmou pela versão do host (`OpenSSL 3.0.13`) que a evidência **não era replay** de estado antigo.
- **Cruzou os 5 blocos da evidência** e verificou que **cada uma das 8 asserções commitadas é falsificável** por ao menos um mutante — m4 derruba as 3 do controle, m2 as 5 dos mutantes, m1 isola as 2 do provider, m3 as 2 de nomeação. **Nenhuma asserção decorativa sobrou.**
- Registrou explicitamente que isto **não é campanha de mutantes** (proibida pela `testing-stack.md`), e sim a prova de falsificação que a `nao-regressao.md` P4 **exige** para asserção estática. A distinção estava correta.

### AP-29 fechado, e a ancoragem era NECESSÁRIA — não estética

As asserções finais ancoram em **prefixo de linha** (`^openssl apto:`, `FALTA o binario openssl`, `FALTA o provider legacy`), não em literal solto. O gate verificou **por que** isso é necessário: os literais `openssl` e `legacy` ocorrem **tanto na linha de aprovação quanto nas de reprovação**, de modo que um `grep` solto ficaria verde **sobre o desfecho oposto**. O mutante 4 (que reprova todo host apto) é precisamente quem expõe isso.

⚠️ **Este é o caso didático do run**: as asserções **nasceram tautológicas** e só a prova de falsificação as denunciou. Não foi revisão de código que pegou — foi a execução do mutante.

### Achado de qualidade: a asserção que SEPARA as duas pernas do CA-21

`grep -c 'legacy'` **== 0** na reprovação do binário. Ela impede que uma mensagem única citando os dois recursos passasse em ambas as pernas, e reprova sob o m2 — provando que discrimina. É o oposto do defeito nº 2 registrado na `testing-stack.md`.

### Endurecimento sobre o molde do `ct_647` — vale como precedente

O executor trocou o **subshell `( )`** do `ct_647` por **processo novo (`bash -c`)**. Razão: o bash **herda a tabela de caminhos já resolvidos (hash)** no subshell, então `command -v openssl` responderia pelo cache **mesmo com o `PATH` recortado** — e o mutante A **passaria pelo motivo errado**. O gate reproduziu com `bash -c` e confirmou que o mutante reprova pela causa certa. **Imitar o molde do arquivo não é copiá-lo sem pensar**; aqui a imitação foi corrigida onde o molde tinha um furo.

### As 4 deleções conferidas — P5 sustentado

`aviso()` virou bloco com contador mantendo o mesmo `printf … >&2` e **sem tocar** `falhas_caso`/`falhas_totais`; o bloco de degradações vive **dentro** do ramo `falhas_totais -eq 0`, imprime em stderr e é seguido do mesmo `exit 0`. **O contrato `exit 0 ⟺ falhas_totais == 0` está intacto.** As outras duas deleções são reescrita de comentário. Nenhuma validação, guarda, timeout, tratamento de erro ou redação de segredo removida.

### Ressalva que o gate levantou para o Tech Review julgar — e que aqui não se aplica

`tocou_area_critica: false`, porque a categorização de Critical Path é **semântica de path** e `deploy/scripts/instalacao/` não casa com `**/crypto/**`, `**/keys/**` nem `**/secrets/**`. O gate registrou a ressalva de que **o assunto é ferramental criptográfico do host**, ainda que o path não seja de área sensível. ℹ️ Como a T3 tem `gates: [qa]`, **não há Tech Review para julgá-la** — fica registrado aqui para quem revisar a fatia.

## T1 — Gate 2 (Tech Review): APROVADO_COM_OBSERVACOES · TASK CONCLUÍDA

`[T1] TR status=APROVADO_COM_OBSERVACOES · 3 problemas, TODOS BAIXO (1 security, 2 project_pattern) · 0 bloqueantes pela partição`
`[T1] TR consultou: ADR-0036, ADR-0032, ADR-0025, ADR-0001`
`[T1] TR NÃO re-executou suíte — nenhuma das 3 condições do contrato se aplicava (executou_testes=true, escopo=SUITE_COMPLETA, zero CRITICO em architecture/security)`
`[T1] staged: 9 arquivos · Status → Concluído · tasks_completed 1 → 2`
`[T1] débitos anotados: D3 (security), D4 (project_pattern), D5 (project_pattern) → §2 do run-report`
`[T1] Ledger: nunca criado (as duas rodadas aprovaram sem rejeição) ⇒ métrica do ledger NÃO se aplica e não é logada`

### Verificações do Gate 2 que fecham riscos declarados no plano

- **AP-24 sobre a migração do molde** — o TR varreu as linhas removidas dos dois arquivos e confirmou a declaração do executor **item a item**. Mais: achou um eixo que o executor **não** havia declarado — a agulha `material-hex` do adaptador era `subarray(0,32).toString('hex')` (**64 caracteres**) e virou `hex.slice(0,32)` (**32 caracteres**), isto é, agulha **mais curta**, casando um **superconjunto** do que casava antes. E `maxArrayLength: null` foi acrescentado à inspeção de propriedade própria, que o `espolioDe` não tinha. **Nenhum `skip`/`only`, nenhum valor invertido, nenhum caso de erro deletado.**
- **`DECISÃO FECHADA` — os cinco marcadores conferidos, todos intactos** (`modelo-canonico.ts:145`, `tratamento-de-notificacao.ts:253`, `adaptador-sicoob.ts:1158`, `leitura-do-material.spec.ts:419`, `adaptador-sicoob.spec.ts:1171`). O de `adaptador-sicoob.spec.ts:1171` governa a **ordem** (*"a asserção que DISTINGUE um campo vem sempre ANTES do `toEqual`"*), e as três linhas alteradas sob a jurisdição dele sofreram **apenas troca de nome de função no lugar, com a ordem preservada**. O de `leitura-do-material.spec.ts:419` continua byte a byte, e o `CT-1015` da suíte nova **cita a razão dele por extenso** em vez de reintroduzir a forma que ele proíbe.
- **Âncora de superfície na forma exigida** — `vocabulario-canonico.spec.ts:1117-1121` afirma `publicados.length === SIMBOLOS_PUBLICADOS.length` **e** `diferencasDeConjunto(...) === { excedentes: [], ausentes: [] }`, com antivácuo em 1246. Igualdade de conjunto, não contenção. A contagem em prosa (26 → 49) subiu **no mesmo diff**.
- **Guardas do artefato em claro, corretas nos pontos que costumam falhar**: modo `0o600` no **ato de criação** (não em `chmod` posterior, o que fecharia tarde a janela); bandeira `wx` (`O_CREAT|O_EXCL`) que recusa reaproveitar arquivo **e** recusa seguir symlink — defesa exata contra squat em diretório mundo-gravável com sticky como `/dev/shm`; nome por `randomUUID()` resolvendo disputa entre registros simultâneos; `finally` cobrindo os três desfechos.
- **`RADICAL_DE_SENHA_DO_CONVERSOR` no barril NÃO é violação da Iron Law #6** — a suíte importa de `../src/`, não do barril, então a publicação não serve ao teste; ela segue precedente **escrito** do pacote (`TETO_DO_APERTO_DE_MAO_MS` está publicado na mesma condição, com a régua declarada no docblock do barril), o símbolo tem uso de produção real em `classificarFalhaDoConversor`, e o `CT-1022` o fixa contra o literal **medido**. O TR registrou que *"relitigar convenção registrada do projeto não é papel do gate"* — postura correta.
- **`RADICAL_DE_SENHA_DO_CONVERSOR = 'mac verify'` não viola a cláusula de vocabulário da ADR-0001**: é vocabulário da **ferramenta de criptografia**, não do **provedor bancário**, que é o sujeito da cláusula.

### ⚠️ Insumo do Gate 2 para a T2 — teto de rota

O conversor tem teto de **30 s por invocação**, o que satisfaz a guarda da ADR-0036. Mas a conversão faz **duas** invocações mais uma leitura do material convertido: o pior caso de `converterMaterialSeNecessario` fica **acima de 60 s**. Não é achado. **É requisito de entrada da T2**: a borda de registro que chamar isto sob requisição HTTP precisa decidir o **próprio teto de rota** com esse número em mãos, em vez de herdar o padrão. Vai literal no prompt do executor da T2.

### Risco avaliado e descartado com razão escrita — não reabrir

`certificadoDeOrigem` carrega a chave privada em claro no heap do processo. O TR avaliou e concluiu que **o ganho de corrigir é nulo**: o mesmo processo já detém, na mesma chamada, o material **e** a senha que o abrem — um despejo de heap capaz de ver a chave já teria o par que a produz. Docblock honesto, alternativa (`-nokeys` numa terceira invocação) rejeitada por escrito.

## Baseline isolada para a T2 — overlap real de path resolvido sem commit

`[T2] base_sha=94752206725ee3ace2e1fd2dda93831be6d63a01` (**não** o `82874d0` do lote da Fase 1)

**Por quê**: a **T1 tocou `CLAUDE.md`** (acrescentou a linha do `D1`, contagem 32 → 33) e a **T2 vai tocar o mesmo arquivo** (remover a linha do `D64`, contagem 33 → 32). Com `base_sha` comum e sem commit intermediário, `git diff <base_sha> -- CLAUDE.md` na T2 mostraria **as duas** mudanças, e os gates dela julgariam trabalho da T1 como se fosse dela. É o "overlap real de paths entre tasks" que a skill prevê.

**Como foi resolvido, sem commitar**: o mesmo mecanismo que a rule já sanciona para o `attempt_sha` — índice temporário via `GIT_INDEX_FILE`, `git write-tree`, `git commit-tree -p HEAD`. O resultado é um commit **solto, não referenciado por branch nenhum**, que serve de baseline isolada. **HEAD não se moveu, o índice do usuário não foi tocado, e o stage de T1/T3 foi preservado** — conferido por `git status --porcelain` antes e depois.

**Verificação de que a baseline está correta**: `git diff 9475220 --name-only -- CLAUDE.md packages/cobranca-bancaria deploy/scripts/instalacao` retorna **vazio**. A T2 parte de árvore limpa.

`[T2] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high`
`[T2] ADRs injetadas no executor: ADR-0017 (+emenda), ADR-0036, ADR-0032, ADR-0016, ADR-0034, ADR-0030 (cláusula de exclusão) (fonte: task §7)`

## Lote T2 ‖ T4 — paralelismo CROSS-FASE, derivado e provado

`[T2‖T4] lote paralelo: T2 (Fase 1) + T4 (Fase 2) — DAG independente + símbolos disjuntos + paths disjuntos + alta contenção não compartilhada`

**Correção de conduta minha, apontada pela guarda de continuidade.** Eu estava processando estritamente **por fase**, e por isso deixei a T4 em `A Fazer` esperando a T2. **Está errado pela regra**: task pronta é `Status: A Fazer` **E** todas as dependências `Concluído` — e a **T4 não tem dependência alguma**, logo estava pronta desde o início do run. "A fase anterior terminou" não é condição de prontidão; o agrupamento por fase é heurística de ordenação, não trava.

Guards conferidos par a par, contra as §5 reais:

| Guard | T2 × T4 |
|---|---|
| **DAG** | ✅ T4 sem dependências; T2 depende só de T1 (concluída). Nenhuma é ancestral da outra |
| **Símbolos** | ✅ T4 não consome símbolo algum; T2 consome apenas da T1. Interseção vazia |
| **Paths** | ✅ T2 = `shared/src/erros.ts` · `contracts/src/integracao-bancaria.ts` · `api/src/integracoes-bancarias/*` · `api/test/*` · `contracts/test/esquemas.spec.ts` · `CLAUDE.md` · `fundacao-bancaria/_run/run-report.md` × T4 = `packages/db/**`. **Disjuntos** |
| **Alta contenção** | ✅ **só a T4** toca (barril `packages/db/src/index.ts` + diretório de migrações + `meta/_journal.json`). A regra exige **ambas** para excluir do lote |

`[T2‖T4] guard de recursos de teste: ATIVO → QAs SERIALIZADOS (T2 depois T4); executores em paralelo`
- Razão **medida**, não presumida: a T2 roda `pnpm --filter @sysloc/api test` (borda e2e com instância efêmera) e a T4 roda `pnpm --filter @sysloc/db test` (instância efêmera **mais aplicação de migrações**). As duas sobem Postgres embutido no mesmo host, e o isolamento entre elas **não está provado**. A T4 ainda por cima **aplica DDL** — colisão ali não gera só flake, gera estado de banco ambíguo.

`[T4] base_sha=94752206725ee3ace2e1fd2dda93831be6d63a01` — a mesma baseline isolada pós-T1/T3. Legítimo: `git diff 9475220 -- packages/db` é **vazio**, então a T4 parte de árvore limpa nos paths dela.
`[T4] executor: opus (declarado no frontmatter)  gates: [qa, tech_review] (declarado)  risk: high`
`[T4] ADRs injetadas no executor: ADR-0008, ADR-0031 (contrapositiva), ADR-0026, ADR-0017 (+emenda), ADR-0024 (+2 emendas) (fonte: task §7)`

### T5 avaliada para o lote e REMOVIDA — por dois guards independentes

`[T2‖T4] T5 removida do lote: T5.paths ∩ T2.paths = ["packages/contracts/src/integracao-bancaria.ts", "packages/contracts/test/esquemas.spec.ts"] (guard de paths disjuntos)`
`[T2‖T4] T5 removida do lote: T5 e T4 tocam alta contenção AMBAS — barril `packages/cobranca-bancaria/src/index.ts` × barril `packages/db/src/index.ts` (guard de alta contenção)`

A T5 **também não tem dependências** e, pela regra de prontidão, estava pronta como a T4. Foi avaliada e **excluída por medição**, não por ordem de fase:

1. **Colisão direta com a T2** em dois arquivos de `@sysloc/contracts` — as duas escreveriam `integracao-bancaria.ts` e `esquemas.spec.ts` ao mesmo tempo. É o caso em que falso-paralelo **corrompe**, não apenas gera flake.
2. **Alta contenção com a T4** — as duas tocam barril de pacote. A regra exclui quando **ambas** tocam, e é exatamente o caso.

Ela entra assim que a **T2** fechar (a colisão é com ela; a da T4 é só de barril e some quando a T4 sair do lote).

⚠️ **Nota de método**: a §4.2 do task_plan derivou a Fase 2 como *"integralmente sequencial"*, e isso continua correto **dentro** da fase. O que a guarda de continuidade corrigiu foi outra coisa — eu estava usando a fase como **trava de prontidão**, quando ela é só heurística de ordenação. Task sem dependência está pronta no minuto zero do run, e o que decide se ela **corre junto** são os quatro guards, não o número da fase.

## Cruzamento dos débitos com gatilho contra o escopo restante — feito ANTES de despachar T6/T7/T8

Levantado enquanto os executores de T2 e T4 rodavam. **Quatro** marcadores existentes têm relação com o que falta desta fatia, e cada um precisa de uma decisão consciente **antes** do despacho, não durante.

### A. Dois gatilhos dizem literalmente "a **F5**" — e esta É a F5. **Nenhum dos dois dispara nesta fatia.**

| Débito | Onde | Gatilho literal | Dispara aqui? |
|---|---|---|---|
| **D26** (F4/T9, `emissao-e-conciliacao`) | `packages/cobranca-bancaria/src/guarda-de-boletos.ts` | *"a **F5**, que traz o agendamento, ou a primeira medição do diretório acima de 20 GB"* | **NÃO** |
| **D13** (F4/T6, `webhook-e-carne`) | `apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts` | *"a **F5**, que traz o agendamento, ou o primeiro caso real de fila indisponível na recepção"* | **NÃO** |

**Por que não**, e é uma leitura que precisa estar escrita para não ser refeita torto: os dois gatilhos dizem *"a F5, **que traz o agendamento**"* — a oração relativa **qualifica** o gatilho, não é ornamento. O agendamento é a fatia **`automacoes-agendadas/v1`**, que é a **(ii)** da F5; esta é a **(i)** (`integracao-bancaria-autonoma`). Quem traz `systemd timers` e expurgo é a irmã, não esta.

⚠️ **Ler "F5" isolado dispararia os dois débitos numa fatia que não tem como fechá-los** — o expurgo dos boletos guardados (D26) e o reprocessamento de notícia parada em `RECEBIDO` (D13) **ambos dependem de agendamento**, que esta fatia não constrói. Abri-los aqui seria alargamento de escopo com marcador de débito como desculpa.

### B. Dois marcadores estão **dentro do escopo declarado da T8** — e ela tem AT próprio para um deles

| Débito | Onde | Situação na T8 |
|---|---|---|
| **D49** (F4/T16) | `apps/worker/src/tarefas/carga-da-tarefa.ts:31` | ⚠️ **relevante**: o **AT-7 da T8** exige *"nenhuma **quarta** cópia da tradução de `ZodError` foi escrita"*. O gatilho do D49 é *"a primeira task autorizada a abrir `regua.ts` ou `confirmacao-de-email.ts`"* — a T8 **não** abre nenhum dos dois, então **o gatilho não dispara**; mas o AT-7 impede que a T8 **agrave** o débito criando a quarta cópia. A conduta é **importar** de `carga-da-tarefa.ts`, nunca redeclarar |
| **D51** (F4/T16) | `apps/worker/src/main.ts:254` | a T8 **toca `main.ts`** (registra a fila nova na lista do diário de partida — AT-8). O gatilho é *"a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts`, **ou o terceiro processo** que exigir as mesmas variáveis"*. A T8 **não** abre `ambiente.ts` e **não** acrescenta processo — **não dispara**. Editar código sob marcador de débito é normal (ele **agenda**, não protege); o que não se pode é **removê-lo** |

**Conduta registrada para o executor da T8**: os dois marcadores permanecem no arquivo. Nenhum sai nesta fatia.

### C. `CLAUDE.md` — a T7 é a **terceira** task do run a tocá-lo

Já registrei que ele aparece em T1 (feito), T7 e T10. Somando a **T2**, que está tocando agora para remover o `D64`, são **quatro** edições do mesmo arquivo neste run, todas sequenciais e todas sob a barreira executável do `CT-907`.

⚠️ **Consequência operacional**: quando a T7 for despachada, ela vai precisar de **nova baseline isolada** (`git commit-tree`), pelo mesmo motivo da T2 — senão o gate dela vê a linha que a T2 removeu e a que a T1 acrescentou. O procedimento já está provado neste run e será repetido.

⚠️ E a T7 é a task com **mais critérios de aceite da fatia (14)**, incluindo o **AT-13** (as três âncoras a `105 / 90 / 20`, por igualdade de conjunto e **duas medições independentes**) e o **AT-14** (a contagem em prosa no **mesmo diff**) — que é precisamente o que a `.claude/rules/ancoras-de-superficie.md` exige. É a task que fecha a superfície da API antes do congelamento.

## Material de despacho — TODAS as 10 tasks agora consolidado

Com a extração de T9 e T10, o run tem pré-computado, para cada task restante: **ADRs aplicáveis** (bloco `[2.1]`, obrigatório), **critérios de aceite**, **paths declarados** e os **guards de lote**. Nada disso precisará ser reconstruído no despacho.

### A T10 tem dois critérios de CONFERÊNCIA, não de execução — e isso é bom desenho

| AT | O que exige | Quem fez |
|---|---|---|
| **AT-9** | a linha do `D64` já não está no índice e o marcador já não está no código | **T2** — *"conferir, não repetir"* |
| **AT-10** | a contagem da superfície no `CLAUDE.md` já diz `105/90/20` | **T7** — *"conferir, não repetir"* |

Isso fecha o modo de falha clássico da task de fecho: **refazer o que outra já fez**, produzindo diff duplicado ou — pior — reintroduzindo o que a task anterior removeu. A spec transformou a dependência em **verificação**, que é o que uma task de fecho deve fazer.

### O AT-6 da T10 já está medido e confirmado por este run

`36 ADRs registradas / 29 accepted` — medido em 2026-08-21, no início do run, e conferido por **soma**: 29 `accepted` + 4 `superseded` + 3 `deprecated` = 36 arquivos. O executor da T10 **não precisa inferir**, e o número não deve ser "corrigido" de memória.

### O AT-7 da T10 depende das contagens finais de TODOS os pacotes

*"a contagem da suíte no `CLAUDE.md` foi **remedida por pacote** e bate, pacote a pacote, com a saída real"*. Estado das baselines neste run:

| Pacote | Baseline (2026-08-20) | Estado |
|---|---|---|
| `cobranca-bancaria` | 93 | ✅ **100** (T1, medido) — T5 e T6 ainda alteram |
| `shared` | 254 | ✅ **254** (T1, inalterado) — T2 e T8 ainda alteram |
| `db` | 233 | ⏳ T4 em execução |
| `api` | 354 | ⏳ T2, T7, T8 |
| `contracts` | 399 | ⏳ T2, T5 |
| `worker` | 126 | ⏳ T8 |
| `documentos` · `auth` · `regua` | 159 · 89 · 30 | intocados por esta fatia |

⚠️ O total do `CLAUDE.md` hoje é **1737**. A T1 já o levou a **1744** (+7). A T10 fecha com a soma real, remedida **pacote a pacote** — nunca pelo agregado, que o `turbo` aborta.

### A T9 tem um AT que a torna a task mais restritiva do run

**AT-7** — *"**nenhum código de produção foi alterado** por esta task. Se alguma varredura reprovou, o conserto foi na produção e está **declarado** com `CAUSA-RAIZ` / `POR QUE ISTO FECHA A CLASSE` / `O QUE ESTA MUDANÇA REMOVE`."*

Ou seja: a T9 é **só prova**. Se ela precisar mexer em produção, isso é sinal de que **uma varredura pegou vazamento real** — e aí o conserto é legítimo, mas tem de vir com as três linhas do Protocolo Antirregressão. É o desenho certo para uma task cuja função é *provar ausência*.

## Medição preliminar de escopo — T2 e T4 ainda em execução

⚠️ **Preliminar**: os dois executores seguem rodando; a medição definitiva é no fecho de cada um. Registrado agora porque o Passo 3.4.1 exige detectar **criação fora do escopo declarado**, e o sinal já apareceu.

### Arquivos tocados e NÃO declarados na §5 — três, todos a julgar pelo Gate 2

| Task | Arquivo | Hipótese de necessidade | Veredito |
|---|---|---|---|
| **T2** | `apps/api/src/comum/filtro-excecao.ts` | é provavelmente onde vive `STATUS_POR_CODIGO`, e o **AT-7** exige que os três códigos novos estejam mapeados lá (*"a ausência de mapeamento não compilaria"*) | **do gate** |
| **T2** | `packages/contracts/src/index.ts` (barril) | publicar `esquemaDoDesfechoDoRegistroDeCertificado` e `DesfechoDoRegistroDeCertificado` exige o barril | **do gate** |
| **T4** | `packages/db/migracoes/meta/0023_snapshot.json` | gerado pelo `drizzle-kit` junto da migração; o **AT-9** exige que a `0023` seja *"integralmente gerada"* | **do gate** |

**Conduta**: os três recebem `git add -N` (para entrarem no diff dos gates), entram na lista `arquivos` do QA e vão para o prompt do Tech Review num bloco **"Arquivos tocados NÃO declarados"**, com a instrução de avaliar cada um como candidato a `scope_deviation`. **Sem esse passo, criação fora do escopo é estruturalmente invisível aos dois gates** — o `git add -N` escopado e a categorização vinda da task só enxergam o declarado.

⚠️ **Não é acusação.** Os três têm hipótese sólida de necessidade, e a Regra 3 da Disciplina do Executor autoriza expressamente arrastar dependentes de mudança de assinatura/publicação. O que não se admite é que passem **sem serem vistos**.

### ⚠️ Ponto de atenção na T2 — o `D64` está momentaneamente ASSIMÉTRICO

Medido agora, com a T2 ainda em curso:

```
marcador em certificado.service.ts : 0   ← já removido
linha no índice do CLAUDE.md       : 1   ← ainda presente
```

**Isto é estado intermediário legítimo** — a task não terminou. Mas se ela **fechar assim**, é exatamente a falha que o `CT-907` de `@sysloc/shared` reprova: **linha de índice sem marcador vivo** é a mesma mentira do marcador órfão, na direção contrária, e a §3-B a nomeia explicitamente.

O **AT-9** da T2 exige as duas pontas **no mesmo commit**, e há uma terceira (a marca de fecho na §2 da `fundacao-bancaria`). **Conferência obrigatória no fecho da T2**, antes de qualquer gate:

```bash
grep -c "D64 · F4/fechamento" apps/api/src/integracoes-bancarias/certificado.service.ts   # esperado: 0
grep -c "D64\*\* (F4/fechamento" CLAUDE.md                                                 # esperado: 0
grep -c "São \*\*32\*\*" CLAUDE.md                                                          # contagem 33 → 32
```

ℹ️ E a menção em `packages/cobranca-bancaria/test/material-de-teste.ts:120` **permanece** — é docblock, não marcador, e o arquivo nem está no escopo da T2.

## ✅ `D64 · F4/fechamento` PAGO nas três pontas — o débito que motivou esta fatia

Conferido pelo orquestrador com a T2 ainda em execução (a assimetria registrada acima era **transitória**, como previsto):

| Ponta | Comando | Resultado |
|---|---|---|
| Marcador | `grep -c "D64 · F4/fechamento" apps/api/src/integracoes-bancarias/certificado.service.ts` | **0** ✅ |
| Índice | `grep -c 'D64\*\* (F4/fechamento' CLAUDE.md` | **0** ✅ |
| Contagem em prosa | `grep -oE 'São \*\*[0-9]+\*\*' CLAUDE.md` | **`São **32**`** ✅ (era 33) |
| Marca de fecho na fatia de origem | `grep -c "D64" docs/specs/features/fundacao-bancaria/v1/_run/run-report.md` | **1** ✅ |

**A aritmética fecha exatamente**: eram 32 débitos no início do run → **33** com o `D1` que a T1 acrescentou → **32** com o `D64` que a T2 pagou.

### Coerência do índice reconferida nas DUAS direções, pós-fecho

```
linhas na tabela do CLAUDE.md : 32
pares distintos no código     : 31
pares distintos no índice     : 31
órfãos no ÍNDICE (linha sem marcador vivo) : NENHUM
órfãos no CÓDIGO (marcador sem linha)      : NENHUM
```

A diferença 32 linhas / 31 pares continua sendo os **dois `D13 · F4/T6`** — o caso legítimo que o `CLAUDE.md` documenta como o primeiro do repositório, em que o par inteiro se repete e só o caminho do `ÍNDICE` os separa.

⚠️ **Isto é conferência do orquestrador, não substitui o `CT-907`.** A barreira executável de `packages/shared/test/protocolo-antirregressao.spec.ts` afirma o mesmo por `fs`, e o **AT-9 da T2** exige `pnpm --filter @sysloc/shared test` **verde**. A conferência acima antecipa o resultado; quem decide é a suíte.

### Significado desta linha do relatório

O `D64` é o débito que **motivou a fatia inteira**: a AC entregou o material em **cifra legada nas duas emissões**, o produto **não o aceitava**, e a renovação dependia de terminal. O `CLAUDE.md` o registrava como **"JÁ DISPAROU (2026-08-21)"**. Com a T1 (conversão por processo externo) e a T2 (borda de registro + três causas de recusa), a **Frente B do objetivo da fatia está materialmente completa** — falta apenas o fecho formal da T2 nos gates.

## ⚠️ ACHADO DE PROCESSO — as §5.2 de T2 e T4 não declararam os arquivos-âncora

Medição completa dos tocados (T2 e T4 ainda em execução): **21 arquivos**, dos quais **8 não estão declarados** em §5.1/§5.2.

| Task | Arquivo não declarado | Natureza |
|---|---|---|
| T2 | `apps/api/src/comum/filtro-excecao.ts` | onde vive `STATUS_POR_CODIGO` — o **AT-7** exige o mapeamento dos três códigos novos |
| T2 | `packages/contracts/src/index.ts` | barril — publicar `esquemaDoDesfechoDoRegistroDeCertificado` o exige |
| T2 | `packages/shared/test/erros.spec.ts` | **ÂNCORA** — afirma o enum `CodigoErro`, que ganhou três membros |
| T2 | `apps/api/test/contrato-publicado.e2e.spec.ts` | **ÂNCORA** — afirma o contrato publicado |
| T4 | `packages/db/migracoes/meta/0023_snapshot.json` | gerado pelo `drizzle-kit` junto da migração (**AT-9**: a `0023` é *"integralmente gerada"*) |
| T4 | `packages/db/test/catalogo.spec.ts` | **ÂNCORA** — afirma o catálogo de tabelas, que ganhou a quinta relação |
| T4 | `packages/db/test/papel-de-conexao.spec.ts` | **ÂNCORA** — papéis e políticas |
| T4 | `packages/db/test/unidade-de-trabalho.spec.ts` | **ÂNCORA** — relações |

### Isto é o defeito que a `.claude/rules/ancoras-de-superficie.md` NOMEIA, ocorrendo ao vivo

O terceiro bullet daquela rule diz, literalmente:

> *"**A §5.2 da task declara os arquivos-âncora que a publicação faz crescer**, derivados por busca antes de a spec fechar (…). Por quê: sem a declaração, o executor descobre esses arquivos **pela suíte vermelha**, toca-os por necessidade e os declara como pendência — e **os dois gates gastam uma passagem decidindo se foi alargamento de escopo**."*
>
> ❌ *"§5.2 listando só o controlador novo, com as três âncoras de igualdade descobertas na execução"*

**Cinco dos oito são exatamente isso.** A falha **não é do executor** — ele fez o que a Regra 3 da Disciplina autoriza (arrastar dependentes de publicação, cirurgicamente). A falha é **da geração da spec**, que não derivou as âncoras por busca antes de fechar a §5.2 de T2 e T4.

### Consequências operacionais deste run

1. **Os 8 recebem `git add -N`** e entram na lista `arquivos` do QA e num bloco **"Arquivos tocados NÃO declarados"** no prompt do Tech Review, com a instrução de avaliar cada um como candidato a `scope_deviation`.
2. **Aos gates vai também esta análise**, para que a passagem que a rule prevê (*"decidir se foi alargamento de escopo"*) seja **curta**: são âncoras previstas por regra escrita, não expansão de escopo por iniciativa do executor.
3. ⚠️ **Vale para as tasks seguintes.** A **T5** publica no barril de `cobranca-bancaria` e em `@sysloc/contracts`; a **T7** publica **duas rotas** e tem o `AT-13` das três âncoras (`105/90/20`); a **T8** publica fila nova e tem `AT-9` sobre as listas de `alcance-da-fila.spec.ts`. **Antes de despachar cada uma, derivo as âncoras por busca** e as acrescento ao prompt do executor como escopo esperado — em vez de deixá-lo descobri-las pela suíte vermelha.

### Candidato a regra? NÃO — a regra já existe e foi descumprida na geração

Não emito `rule_candidate` para isto. O padrão **já é regra escrita** (`ancoras-de-superficie.md`, terceiro bullet), com o exemplo ❌ correspondendo ao caso. Emitir candidato para regra vigente é ruído na mineração; o que cabe é **registrar o descumprimento**, que é o que esta seção faz.

## Âncoras da T5 derivadas por busca — ANTES do despacho (aplicando a lição de T2/T4)

A §5.2 da **T5 está melhor** que as de T2/T4: ela **declara** as duas âncoras principais (`packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` com os `CT-809 (b)`/`CT-991`, e `packages/contracts/test/esquemas.spec.ts`) e até **cita a rule** `.claude/rules/ancoras-de-superficie.md`. Isso é o comportamento certo.

**Falta uma peça, derivada por busca e confirmada por medição:**

| Arquivo | Por que a T5 vai precisar |
|---|---|
| `packages/contracts/src/index.ts` (barril) | ⚠️ **não declarado na §5.2 da T5** |

**Medição que o comprova**: o barril de `@sysloc/contracts` **reexporta símbolo a símbolo** de `./integracao-bancaria.js` (duas cláusulas, linhas 186 e 207) — não é `export *`. A **T2 acabou de precisar dele** por exatamente essa razão, acrescentando 2 linhas:

```
+  DesfechoDoRegistroDeCertificado,
+  esquemaDoDesfechoDoRegistroDeCertificado,
```

A T5 publica **cinco** símbolos em `@sysloc/contracts` (`esquemaDoEstadoDaEntrega`, `EstadoDaEntrega`, `esquemaDoMotivoDaRecusa`, os tetos `MAIOR_DIAGNOSTICO_*` e `ESTADOS_DA_ENTREGA`), logo **tocará o mesmo barril**.

**Conduta**: o prompt do executor da T5 declarará `packages/contracts/src/index.ts` como **escopo esperado**, com a razão — em vez de deixá-lo descobrir pela suíte vermelha e reportar como pendência, que é o ciclo que a rule condena.

ℹ️ Registro também que **`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`** é quem afirma o inventário de **rotas** (as três âncoras `105/90/20`). Ele é escopo da **T7**, que **o declara** corretamente na §5.2 — junto do `CLAUDE.md`, como a rule exige (*"a contagem escrita em prosa sobe no mesmo diff da constante que o teste afirma"*).

## T4 — executor concluído

`[T4] executor retornou: 5 criados, 8 modificados · @sysloc/db 233 → 234 · build 9/9 · Biome limpo · Garantias removidas: nenhuma`
`[T4] colaterais medidos pelo executor: @sysloc/worker 126/126, @sysloc/auth 89/89 — nenhum vermelho`

### Prova de falsificação executada, com reversão conferida por `sha256sum`

Os passos 1–3 são asserção **estática** (observam catálogo) e por isso exigiam a prova por execução. Dois mutantes, **no artefato real**, medidos com `pnpm --filter @sysloc/db test` (nunca `vitest run` avulso):

| Mutante | Resultado | Leitura |
|---|---|---|
| **MT-E1** — `FORCE ROW LEVEL SECURITY` removido da `0024` | `14 failed \| 220 passed` | passo 1 reprova com `forcada: true` contra `forcada: false`; a guarda de `catalogo.spec.ts` acusa em paralelo |
| **MT-E2** — FK composta da autoria trocada pela simples na `0023` | `1 failed \| 233 passed` | ⭐ **só o `CT-1027` reprova**, no passo 3 — e reprovar **sozinho** é exatamente o valor daquele passo: prova que a asserção discrimina a FK composta e **nada mais** |

Reversão conferida por `sha256sum` idêntico nos dois arquivos (`cf93150780c5…`, `19c9d4372c12…`), controle de volta a `234 passed`. Passos 4–9 são comportamentais: **nenhum mutante executado**, conforme a decisão de 2026-08-16 — a asserção discriminante de cada um está declarada no comentário do próprio passo. **A distinção entre os dois grupos foi respeitada.**

### Escopo medido — 12 arquivos, 7 declarados e 5 NÃO

| Arquivo | Declarado? | Natureza |
|---|---|---|
| `migracoes/0023_*.sql` · `0024_*.sql` · `src/entrega-da-noticia.ts` · `test/entrega-da-noticia.spec.ts` · `src/esquema/negocio.ts` · `src/index.ts` · `migracoes/meta/_journal.json` | ✅ (7) | — |
| `migracoes/meta/0023_snapshot.json` | ❌ | gerado pelo `drizzle-kit` junto da migração |
| `test/catalogo.spec.ts` | ❌ | **âncora** — catálogo de tabelas |
| `test/papel-de-conexao.spec.ts` | ❌ | **âncora** — papéis e políticas |
| `test/unidade-de-trabalho.spec.ts` | ❌ | **âncora** — relações |
| `deploy/scripts/instalacao/verificar-migracao.sh` | ❌ | **âncora de instalação** (+2/−1) |

`[T4] arquivos tocados NÃO declarados: 5 — todos com razão declarada pelo executor (A1), todos a julgar pelo Gate 2`

**A razão do executor é sólida e nomeia a fonte**: as **quatro listas-espelho que o próprio docblock de `esquema/negocio.ts` enumera** reprovam com a relação nova, e três delas estavam fora da §5.2. Sobre o verificador shell: *"deixar o verificador defasado tornaria falsa uma garantia de instalação existente"*. É o padrão de âncora da `ancoras-de-superficie.md` — e mais uma confirmação do **achado de processo** já registrado: as §5.2 desta fatia não derivaram as âncoras por busca.

### Duas correções de texto alheio, ambas declaradas e ambas com razão de necessidade

1. O docblock de `esquema/negocio.ts` **omitia a `0022_seguranca_identidade_no_provedor.sql`** na lista de migrações de segurança (defasagem da **fatia anterior**), e as contagens narrativas *"São seis"*/*"São oito"* já não batiam. O executor acrescentou a entrada faltante junto da `0024` e acertou as contagens — **sem isso, a edição dele tornaria o parágrafo contraditório**.
2. A contagem narrativa de `catalogo.spec.ts` estava **defasada em 1 desde a `0021`** (*"vinte e um"* para 22 entradas); subiu para *"vinte e três"*, que é o valor medido.

⚠️ As duas são **correção de defasagem preexistente que a própria edição tornaria incoerente** — não "aproveitar que estou aqui". O executor declarou expressamente: *"nenhuma outra correção de texto alheio foi feita."* Vai ao Gate 2 com esta análise.

### Decisão auto-resolvida (A1) — o Gate 1 da T4 AGUARDA a T2

`[T4] decisão auto-resolvida (A1): despachar o Gate 1 da T4 agora vs. aguardar o executor da T2 → adotada a recomendada: **aguardar** · razão: NÃO é conservadorismo — é dependência de compilação medida. `pnpm --filter @sysloc/db test` roda `tsc --build`, que compila as dependências do pacote, e `@sysloc/db` depende de `@sysloc/shared` — que a T2 está editando neste momento (os três códigos novos em `erros.ts`). O QA da T4 apanharia `shared` em estado INTERMEDIÁRIO e produziria vermelho não atribuível à T4, queimando uma das 3 tentativas. O próprio executor da T4 registrou a mesma medição: "apps/api, packages/contracts e packages/shared não foram executados: estão sendo alterados pela T2 em paralelo, e um vermelho ali não seria atribuível a esta task."`

ℹ️ Isto **confirma** o Guard de recursos de teste aplicado ao lote — e mostra que ele é mais amplo do que "colisão de porta de banco": em monorepo com `tsc --build`, a dependência de **compilação** entre pacotes já basta para exigir serialização.

## T2 — executor concluído

`[T2] executor retornou: 0 criados, 13 modificados (14 com o próprio T2.md) · api 354→357 · contracts 399→407 · shared 254→263`
`[T2] Garantias removidas: a INDISTINGUIBILIDADE das duas causas de recusa — DELIBERADA, é o objetivo da task`

### O risco R1 do plano foi tratado exatamente como a §3.2 prescrevia

O executor **declarou** a remoção com precisão cirúrgica, nomeando as duas pontas:

1. **No código** — mensagem e código únicos para senha errada e material ilegível passaram a **um código e uma mensagem por causa**; a constante `MENSAGEM_DO_MATERIAL_RECUSADO` **deixou de existir**.
2. **Na prova** — a asserção `expect(comSenhaErrada.texto).toBe(comMaterialRuim.texto)` do antigo `CT-824 (b)`, com o bloco **REESCRITO no lugar** como `CT-1021` e substituto declarado mais forte (Set de tamanho 3 + os três envelopes inteiros).

⚠️ **O gate foi instruído a NÃO tratar isso como AP-24** — e a **verificar** as três exigências da receita: caso reescrito (não apagado), substituto mais forte (não mais fraco) e docblock **substituído** (AT-10: nem apagado, nem mantido).

### Escopo — 13 arquivos, 8 declarados e 5 NÃO

Não declarados: `apps/api/src/comum/filtro-excecao.ts` · `packages/contracts/src/index.ts` · `packages/shared/test/erros.spec.ts` · `apps/api/test/contrato-publicado.e2e.spec.ts` · `apps/api/test/segredo-nao-escapa.e2e.spec.ts`

**Três dos cinco são âncoras** — mesma classe já registrada no achado de processo. Os cinco vão ao Gate 1 e ao Gate 2 com a análise anexada, para que a passagem seja curta.

### Duas decisões auto-resolvidas (A1) do executor, ambas com razão sólida

1. **Motivo interno da causa de FORMATO** — o card da §6.3 escreve `MATERIAL_ILEGIVEL`, o real é `FORMATO_NAO_SUPORTADO`. Adotou o que a exceção da T1 carrega, porque *"com a borda passando por `converterMaterialSeNecessario`, `ErroDeMaterialIlegivel` não escapa mais daquele módulo, e traduzir de volta criaria um segundo vocabulário para o mesmo fato"*. **Correto** — é a consequência natural de a T1 ter interposto a conversão.
2. **Teto de rota** — **não** acrescentou um segundo teto: *"os 75 s de pior caso (5+30+5+30+5) já são impostos por teto próprio de quem os gasta, e um teto na borda abortaria a requisição sem cancelar o subprocesso"*. ⭐ **Este era o insumo que o Tech Review da T1 deixou** (pior caso > 60 s), e o executor o endereçou com razão escrita em vez de herdar o padrão em silêncio. O número real (75 s) é mais preciso que a estimativa do TR.

### Duas decisões de desenho declaradas pelo executor

- **O desfecho é `esquemaDoCertificado.extend({ materialConvertido })`, não envelope aninhado** — a forma que `esquemaDaAtivacaoDeContrato` já usa para *"o recurso mais o efeito do ato"*. É o que **dá bite ao AT-6**: o `CT-1023` compara as chaves do `GET` contra `esquemaDoCertificado` e afirma que a chave da conversão **não está lá** — mover o campo para a projeção compartilhada faz o `GET` carregá-lo e o caso reprova.
- **As três mensagens vivem em `MENSAGEM_POR_CODIGO`, não no serviço.** A razão que mantinha literais locais está escrita no arquivo — *"aquela tabela publica 'requisição inválida' para toda recusa de campo"* — e **morreu quando cada causa ganhou código próprio**. A `DECISÃO FECHADA — T9` que protege a tabela foi **preservada byte a byte** (conferido: `grep -c` = 1).

## ⚠️ D6 — colisão de identificador de caso de teste, detectada no mesmo run

Existem **dois `CT-1022`** nesta fatia, ambos implementados e verdes:

| Onde | O quê | Origem |
|---|---|---|
| `packages/cobranca-bancaria/test/conversao-do-material.spec.ts:607` | *"o radical do conversor é o do executável"* | **acrescentado** pelo executor da T1 |
| `apps/api/test/certificado-do-provedor.e2e.spec.ts:1041` | *"senha errada sobre material legado nomeia a senha"* | **card da §6.6 da T2** — alocação original |

O **legítimo é o da T2**. O executor da T1 inferiu *"CT-1022 é o primeiro livre depois de CT-1021"* — premissa falsa: a T2 já detinha `CT-1020`–`CT-1023`.

**Primeiro ID realmente livre, medido**: os alocados no plano vão de `CT-1011` a `CT-1047`, sem furo depois de `CT-1013` ⇒ **`CT-1048`**. Escriturado como **D6** (`baixo`/`documentation`), com a correção a entrar na **T10**.

### Lição do run — a mesma causa em dois agentes diferentes

**Este é o segundo erro de ID por proximidade neste run.** O primeiro foi **meu**: passei `CT-1021` ao Gate 1 da T1 como entregável dela (é da T2), por ter extraído os CTs com `grep -oE 'CT-1[0-9]{3}' T1.md` — e o número aparecia lá **apenas como citação**. O QA me corrigiu.

Nos dois casos a causa é idêntica: **inferir numeração por proximidade em vez de consultar a alocação global**. A regra que fecha os dois: **o ID de CT sai da §6.5/§6.6 da task e do conjunto alocado no plano — nunca de "o próximo depois do que eu vi"**, e nunca de varredura do arquivo inteiro. Já aplicada nos prompts dos gates seguintes.

`[T2] Gate 1 despachado: agent-spec-qa-validator, model=opus (rule: diff_touches_critical_path — crypto/secrets; task_risk=high)`
`[T4] Gate 1 na fila — serializado após o da T2 (guard de recursos de teste; os dois rodam suíte com instância efêmera)`

## ⭐ Validação empírica da lição dos IDs — medida na T4, antes de despachar o gate dela

Apliquei os dois métodos à `T4.md` e comparei:

| Método | CTs obtidos | Nº |
|---|---|---|
| **CORRETO** — §6.5 (rastreabilidade) + cards `#### CT-` da §6.6 | `CT-1027` | **1** |
| **ERRADO** — `grep -oE 'CT-1[0-9]{3}' T4.md` (arquivo inteiro) | `CT-1026`, `CT-1027`, `CT-1028`, `CT-1030`, `CT-1031`, `CT-1033` | **6** |

**O método errado inflaria a exigência em 6×.** Os outros cinco aparecem no `T4.md` como **referência cruzada** — citações de casos de tasks vizinhas em prosa de contexto, não entregáveis. Cobrá-los faria o Gate 1 reprovar a T4 por "CTs sem teste" numa task que entregou **exatamente** o que devia: o executor reportou `Testes: 1/1 implementados`, que bate com o método correto.

⚠️ **Este é o terceiro dado da mesma classe neste run**, e agora com medição direta:

1. **Orquestrador** (eu): passei `CT-1021` ao Gate 1 da T1 — o número aparecia no `T1.md` só na frase *"CT-1022 é o primeiro livre depois de CT-1021"*. **O QA corrigiu.**
2. **Executor da T1**: acrescentou um `CT-1022` inferindo ser *"o primeiro livre"*, sem saber que a T2 detinha `CT-1020`–`CT-1023`. **Virou o débito D6.**
3. **Medição de controle (esta)**: o `grep` inflaria a lista da T4 de **1 para 6**.

**Regra consolidada, com evidência de três pontos**: o conjunto de CTs exigidos de uma task sai **exclusivamente** da §6.5 e dos cards `#### CT-` da §6.6. Varredura do arquivo inteiro **conta citação como exigência**; inferência por proximidade **colide com alocação alheia**. Nenhum dos dois é aceitável.

`[T4] CTs exigidos (método correto): CT-1027 — 1 caso, conferido contra os cards da §6.6`

## Âncoras da T6 derivadas por busca — ANTES do despacho (terceira ocorrência do mesmo padrão)

A §5 da **T6** declara **três** arquivos: `credencial-de-acesso.ts`, `adaptador-sicoob.ts` e `adaptador-sicoob.spec.ts`. Mas a §1 dela declara **`FamiliaDeEscopo`** entre os *"Símbolos públicos criados"* — vocabulário do produto.

**Derivado por busca, e não declarado:**

| Arquivo | Por quê |
|---|---|
| `packages/cobranca-bancaria/src/index.ts` (barril) | símbolo **publicado** precisa sair pelo barril |
| `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` | **medido**: é o único arquivo que afirma `SIMBOLOS_PUBLICADOS` do pacote, **por igualdade de conjunto** — símbolo novo no barril sem a entrada correspondente **reprova** |

⚠️ **Terceira ocorrência do mesmo defeito de geração nesta fatia** (T2, T4 e agora T6), e a segunda que consigo antecipar antes do despacho (a primeira foi a T5). O padrão é sempre igual: a §1 declara o símbolo publicado, a §5 esquece a âncora que a publicação faz crescer, e a `.claude/rules/ancoras-de-superficie.md` **já manda** derivá-las por busca antes de a spec fechar.

**Conduta**: os dois entram no prompt do executor da T6 como **escopo esperado**, com a razão — igual ao que foi feito na T5 com `packages/contracts/src/index.ts`.

ℹ️ **Nota de sequência, sem conflito**: a **T5 também toca** `vocabulario-canonico.spec.ts` (ela o declara), e a **T1 já tocou** `adaptador-sicoob.spec.ts` (migração do molde de varredura). Como **T6 depende de T5** no DAG e a T1 está fechada, a ordem é sequencial e não há colisão de lote — mas a T6 **herda a forma que as duas deixaram**: deve importar o molde da casa compartilhada (`test/varredura-de-agulhas.ts`) e acrescentar à lista de símbolos, nunca redeclarar nem reescrever.

## ⚠️ CORREÇÃO do achado de processo — o defeito das âncoras é PONTUAL, não sistemático

Registrei antes que *"as §5.2 desta fatia não derivaram as âncoras por busca"*. Medido task a task, **a generalização estava larga demais**:

| Task | Derivação das âncoras na §5 | Avaliação |
|---|---|---|
| **T2** | ❌ não derivou — 3 âncoras descobertas na execução | defeito |
| **T4** | ❌ não derivou — 4 âncoras descobertas na execução | defeito |
| **T6** | ❌ não derivou — barril + `vocabulario-canonico.spec.ts` (antecipado por mim) | defeito |
| **T5** | ⚠️ **parcial** — declarou as duas principais (`vocabulario-canonico.spec.ts` com os `CT-809 (b)`/`CT-991`, e `esquemas.spec.ts`) e **citou a rule**; faltou só o barril de `@sysloc/contracts` | quase |
| **T7** | ✅ **derivou, e com critério** | **correto** |

**A T7 é o contraexemplo positivo, e vale como modelo**: a §5.2 dela lista `contrato-publicado.e2e.spec.ts`, `campos-fechados.e2e.spec.ts` e `autorizacao.e2e.spec.ts` com a condição escrita — *"**Só se** enumerarem rotas ou manipuladores por igualdade de conjunto"*. Isso é **melhor** que listar por precaução: declara o arquivo **e o discriminador que decide se ele entra**, o que evita tanto a descoberta pela suíte vermelha quanto o diff inflado por arquivo que não precisava mudar.

Ela também declara `cobertura-de-autorizacao.e2e.spec.ts` **junto do `CLAUDE.md`**, que é o que a rule exige (*"a contagem escrita em prosa sobe no mesmo diff da constante que o teste afirma"*).

**Medição de apoio**: `ROTAS_DESCRITAS = 46` hoje em `contrato-publicado.e2e.spec.ts` (a T2 tocou o arquivo, mas só nos **códigos de erro** — `CODIGOS_DO_ENUM_FECHADO` 8→11 —, não nas rotas). As duas rotas da T7 o levam a **48**.

⚠️ **Por que a correção importa**: um achado de processo que acusa "a geração inteira" convida a mudar o gerador; um que acusa **três tasks específicas** convida a corrigir as três e a usar a T7 como referência. A segunda leitura é a verdadeira, e é a acionável.

## T4 — Gate 2 (Tech Review): APROVADO_COM_OBSERVACOES · TASK CONCLUÍDA

`[T4] TR status=APROVADO_COM_OBSERVACOES · 3 problemas, TODOS BAIXO (1 project_pattern, 2 code_quality) · 0 bloqueantes`
`[T4] TR consultou: ADR-0008, ADR-0009, ADR-0014, ADR-0017, ADR-0020, ADR-0024, ADR-0026, ADR-0031, ADR-0035`
`[T4] staged: 13 arquivos · Status → Concluído · tasks_completed 3 → 4`
`[T4] débitos anotados: D12 (project_pattern), D13 (code_quality), D14 (code_quality)`
`[T4] Ledger: nunca criado (as duas rodadas aprovaram sem rejeição) ⇒ métrica não se aplica`

### Os dois pontos deixados ao Gate 2 foram julgados, não deferidos

**1. Granularidade do `CT-1027` — NÃO é achado**, com três razões verificáveis: é a convenção da casa com precedente nominal (`CT-940` de `isolamento-bancario.spec.ts`); a §6.6 a prescreve passo a passo; e os passos **partilham estado mutável por desenho** (a linha do passo 4 é apagada sob o contexto de B no passo 7; `LINHA_CRUZADA` do passo 8 é alvo do 9), de modo que fatiar em nove `it` exigiria rearranjo que a task não pediu. ⭐ **O argumento decisivo é medido**: o registro do `MT-E2` mostra que, trocada a FK composta pela simples, **só o passo 3 reprova, nomeando** `colunas: ['verificada_por']` — a Iron Law #2 pede que a falha diga a razão, e a saída diz. **O custo foi reconhecido, não varrido**: no `MT-E1` o passo 1 **mascarou** os passos 2-9.

**2. Fronteira da Regra 3 — RESPEITADA em substância, com a declaração incompleta em um item.** O gate confirmou que as duas correções declaradas são **forçadas** (sem elas a própria edição criaria contradição) e conferiu a aritmética: 10 migrações de segurança pareando uma a uma com 10 geradoras de tabela. ⚠️ **E achou uma TERCEIRA que o executor não declarou**: a cadeia narrativa de `papel-de-conexao.spec.ts`, emendada para incluir a `0021`. Julgou-a **legítima** — sem o elo, a soma não alcança 22, que é o valor que o `toHaveLength` passa a afirmar — e **não abriu achado**, registrando que *"o que falhou foi a completude da declaração, não o critério"*.

> **A distinção é boa e vale como precedente**: a Regra 3 governa **o que se pode tocar**; o campo `Garantias removidas` governa **o que se deve declarar**. Falhar no segundo com acerto no primeiro é ruído de registro, não desvio de escopo.

### Análise de segurança que o gate fez sem que ninguém pedisse

Verificou que o `ON CONFLICT ON CONSTRAINT entrega_da_noticia_empresa_key DO UPDATE` **não abre janela cruzada**: a chave em conflito é `empresa_id`, o valor proposto vem da própria política, logo a linha conflitante é **sempre visível e sempre da mesma empresa**. Também percorreu a álgebra do `CHECK` nos três estados legítimos e nas três combinações meio preenchidas, confirmando que **não há passagem por vacuidade**.

E registrou a divergência declarada do executor como **legítima**: a §6.4 prescrevia **duas** combinações incoerentes para a `CHECK`; ele implementou **três**, acrescentando `habilitada SEM verificação` — a única que exercita a cláusula (a) da restrição. *"Não é complexidade especulativa, é fechamento de uma cláusula que a prescrição deixara sem prova."* É o precedente de método do repositório aplicado corretamente.

## ⚠️ NEAR-MISS de estado, detectado e corrigido — a T6 constava `Em Progresso` sem nunca ter sido despachada

Ao conferir se havia task pronta após o fecho da T4, a varredura acusou **T6: Em Progresso**. Medido:

| Fonte | Dizia | Verdade |
|---|---|---|
| `task_plan.md:63` | `Em Progresso` | ❌ **errado** |
| `tasks/T6.md:10` | `A Fazer` | ✅ |
| `credencial-de-acesso.ts`, `adaptador-sicoob.ts` | **intocados** | ✅ |
| Executor da T6 | **nunca despachado** | ✅ |

**Corrigido** para `A Fazer` no `task_plan.md`, e **todas as linhas reconferidas** cruzando `task_plan.md` × `TN.md` — as seis não-concluídas agora concordam.

⚠️ **Por que este near-miss importava**: a guarda de continuidade lê o `task_plan.md`. Uma task fantasma em `Em Progresso` faria o gancho mandar *"retomar a T6"* — e a conduta prescrita para retomada é *"se o executor já rodou, siga para o Gate 1"*. Um orquestrador menos cuidadoso despacharia **um gate sobre trabalho que não existe**, e o gate reprovaria por ausência de entregáveis, queimando tentativa numa task que sequer começou.

**Lição operacional**: ao fechar cada task, conferir a consistência **das duas fontes de estado** (`task_plan.md` e `TN.md`), não só escrever nas duas. A escrita pode falhar de um lado; só a **leitura cruzada** detecta.

`[run] estado reconferido: T5 Em Progresso · T6..T10 A Fazer · T1..T4 Concluído · nenhuma task PRONTA (todas as pendentes dependem da T5, direta ou transitivamente)`

## ✅ A derivação de âncora da T5 se confirmou na execução

Antes do despacho, derivei por busca que a T5 precisaria de `packages/contracts/src/index.ts`, **apesar de a §5 dela não o declarar**, com a medição que o comprovava: o barril de `@sysloc/contracts` reexporta **símbolo a símbolo** de `./integracao-bancaria.js` (duas cláusulas, linhas 186 e 207), **não** é `export *` — e a T5 publica **cinco** símbolos novos ali.

**Medido agora, com a T5 ainda em execução**: o arquivo **foi tocado**.

⭐ **O ciclo que a `.claude/rules/ancoras-de-superficie.md` condena não aconteceu.** O executor recebeu o arquivo como **escopo esperado, com a razão**, em vez de:

1. escrever o código,
2. rodar a suíte,
3. ver vermelho,
4. tocar o arquivo por necessidade,
5. reportá-lo como **pendência**,
6. e os dois gates gastarem uma passagem decidindo se foi alargamento de escopo.

**Este é o valor concreto de derivar a âncora antes do despacho** — e a diferença contra o que aconteceu em T2 e T4, onde os cinco e os quatro arquivos-âncora foram descobertos na execução e precisaram de análise anexada aos prompts dos gates para não virarem `scope_deviation`.

A mesma antecipação já está feita para a **T6** (barril de `cobranca-bancaria` + `vocabulario-canonico.spec.ts`), e a **T7** não precisa — a §5.2 dela **já deriva as âncoras com critério**, e serve de modelo.

## Material da T8 derivado — o `D49` e o `AT-7` (não criar a quarta cópia)

O **AT-7 da T8** exige *"nenhuma **quarta** cópia da tradução de `ZodError` foi escrita"*. Derivado por busca, para o executor não ter de descobrir:

| Fato | Medição |
|---|---|
| As **três** cópias existentes | `apps/worker/src/tarefas/carga-da-tarefa.ts` · `regua.ts` · `confirmacao-de-email.ts` |
| O símbolo a **importar** | `cargaConferida<T>`, **já exportado** em `carga-da-tarefa.ts:58` |
| Gatilho do `D49 · F4/T16` | *"a primeira task autorizada a abrir `./regua.ts` ou `./confirmacao-de-email.ts`"* — a T8 **não abre nenhum dos dois** ⇒ **NÃO dispara**; o marcador permanece |

**Conduta para o prompt da T8**: importar `cargaConferida` de `carga-da-tarefa.ts`; **jamais** redeclarar a tradução. Editar código sob o marcador é normal (ele **agenda**, não protege) — o que não se pode é **removê-lo**, porque o débito segue aberto.

### ⭐ O marcador do `D49` é exemplar, e vale como modelo de redação

Ele **declara a própria natureza** na segunda linha:

```
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
```

É exatamente o que a §3-B da `nao-regressao.md` adverte ao dizer que *"misturar os dois arruína os dois — débito lido como decisão fechada **congela o que deveria mudar**; decisão fechada lida como débito **convida a rodada seguinte a reabrir o que custou rodadas para fechar**"*. Um marcador que se autodeclara fecha essa ambiguidade **no ponto onde a tentação acontece**, sem depender de o leitor lembrar a distinção.

Vale registrar como boa prática de redação de marcador — sobretudo em arquivo que **também** contém `DECISÃO FECHADA`, onde os dois convivem e a §3-B manda que "o texto de cada um deixe óbvio o que ele alcança".

## QUADRO FINAL — derivação de âncoras por task (investigação encerrada)

Conferido task a task, contra as §5 reais e por busca no código:

| Task | Publica superfície? | Âncoras derivadas na §5? | Avaliação |
|---|---|---|---|
| **T1** | sim (5 símbolos no barril) | ✅ declarou `vocabulario-canonico.spec.ts` **condicionalmente** e o `CLAUDE.md` | **correta** |
| **T2** | sim (3 códigos no enum) | ❌ **não** — 3 âncoras descobertas na execução | **defeito** |
| **T3** | não | — (n/a) | — |
| **T4** | sim (tabela + 3 símbolos) | ❌ **não** — 4 âncoras descobertas na execução | **defeito** |
| **T5** | sim (5 símbolos em `contracts`) | ⚠️ **parcial** — declarou as 2 principais e **citou a rule**; faltou o barril de `contracts` (**antecipado pelo orquestrador**) | quase |
| **T6** | sim (`FamiliaDeEscopo`) | ❌ **não** — barril + `vocabulario-canonico.spec.ts` (**antecipados pelo orquestrador**) | **defeito** |
| **T7** | sim (2 rotas) | ✅ declarou 3 âncoras **com o discriminador** (*"só se enumerarem rotas ou manipuladores por igualdade de conjunto"*) + `cobertura-de-autorizacao.e2e.spec.ts` junto do `CLAUDE.md` | **correta, modelo** |
| **T8** | sim (fila nova) | ✅ declarou `alcance-da-fila.spec.ts` e `produtor-de-fila.spec.ts`; o `AT-8` é coberto por caso **comportamental** (`CT-1039 (a)`), não por âncora de inventário — nada faltou | **correta** |
| **T9 / T10** | não criam produção | — (n/a) | — |

**Resultado: 3 defeitos (T2, T4, T6) em 7 tasks que publicam superfície; 1 parcial (T5); 3 corretas (T1, T7, T8).**

⚠️ **A generalização inicial — *"as §5.2 desta fatia não derivaram as âncoras"* — estava errada, e a correção importa**: o defeito é **minoritário e pontual**, não sistemático na geração. Isso muda a ação recomendada de *"revisar o gerador de tasks"* para *"corrigir três §5 específicas, usando a T7 como referência de forma"*.

**Saldo operacional deste run**: das três com defeito, **duas foram antecipadas** pelo orquestrador antes do despacho (T5 parcial e T6), e a antecipação da T5 **já se confirmou na execução** — o executor tocou `contracts/src/index.ts` sem passar pelo ciclo de descoberta-por-suíte-vermelha. Só T2 e T4 pagaram o custo integral, e nas duas a análise foi anexada aos prompts dos gates para que a passagem fosse curta — o que funcionou: nenhum dos quatro gates abriu `scope_deviation`.

## T5 — executor concluído

`[T5] executor retornou: 1 criado, 7 modificados · contracts 407→423 (+16) · cobranca-bancaria 100→104 (+4) · build ✅ · lint ✅ · os 9 pacotes verdes sem regressão`
`[T5] Garantias removidas: nenhuma — as 9 linhas removidas são reflow de docblock e a âncora QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA 17→18`

**AT-9 conferido pelo orquestrador de forma independente**: `git diff -U0 -- packages/contracts/src/integracao-bancaria.ts | grep '^-'` devolve **zero** linhas removidas ⇒ `esquemaDoCertificado` **intocado**, exatamente como o critério exige.

### Os dois avisos que injetei no prompt funcionaram

1. **Baselines defasadas do AT-10** — o executor mediu contra os **reais** (`contracts` 407, `cobranca-bancaria` 100), não contra os da spec (399/93), **e corrigiu o `T5.md` registrando a razão**. Sem o aviso, ele veria "+8" e "+7" inexplicados e diagnosticaria regressão inexistente.
2. **Âncora `packages/contracts/src/index.ts`** — tocada naturalmente e **declarada na §5.2 do `T5.md`**, fechando a lacuna que a geração deixou.

### ⚠️ TENSÃO DECLARADA com o `D23` — e o corolário é mais forte do que o executor disse

A T5 criou `esquemaDaAtivacaoDaEntrega = z.strictObject({})` em `@sysloc/contracts`. Essa é a **mesma forma** de `ESQUEMA_DO_CORPO_VAZIO` (`apps/api/src/comum/esquema-de-corpo-vazio.ts`), que é o **fecho do `D23`** — o *"ponto único da borda"* criado depois de a definição ter chegado a **quatro cópias byte a byte**.

**O argumento do executor de que NÃO é reabertura, e ele se sustenta nos três eixos:**

| Eixo | Razão |
|---|---|
| **Fatos distintos** | forma **anônima** da borda × elemento **nomeado** do contrato, de onde o OpenAPI deriva |
| **Direção da dependência** | ⭐ `@sysloc/contracts` é **pacote folha**; importar de `apps/api/src/comum/` **inverteria a dependência** — a alternativa é arquiteturalmente proibida, não apenas indesejada |
| **Ausência de risco** | o próprio docblock do `D23` registra que objeto estrito vazio *"não tem variação de comportamento possível"* |

⚠️ **COROLÁRIO QUE O ORQUESTRADOR MEDIU E QUE VAI PARA O PROMPT DA T7**: a rede que protege o `D23` é o **`CT-357`** de `apps/api/test/validacao.spec.ts`, que afirma **por igualdade de conjunto** que há *"**uma** definição e **quatro** importadores"*.

> **Se a T7 importar `ESQUEMA_DO_CORPO_VAZIO` para a rota de ativação, vira o QUINTO importador e o `CT-357` REPROVA.**

O aviso do executor da T5 — *"a T7 deve importar ESTE esquema para esta rota, nunca a constante da borda"* — **não é preferência de desenho: é a diferença entre suíte verde e vermelha**. Vai literal no prompt da T7, com a medição.

### Outras decisões auto-resolvidas (A1), todas com razão escrita

- **`MODULOS_DA_ENTREGA` em vez de estender `MODULOS_DA_FATIA`** — aquela constante é declarada por escrito como *"os três módulos da fatia `webhook-e-carne`"*; estendê-la faria o docblock **mentir** (R3) e duplicaria o laço do `CT-1032` sobre os mesmos módulos (AP-26). Toda a maquinaria foi reusada.
- **Passo 9 do `CT-1044` não reasserido em `contracts`** — o pacote é **folha** e não declara `@sysloc/shared` (`CT-339`); a asserção de superconjunto com os três códigos novos **já existe** em `packages/shared/test/erros.spec.ts:332`, posta pela T2.
- **Três símbolos além da §1** — `esquemaDaAtivacaoDaEntrega`, `AtivacaoDaEntrega` e `MotivoDaRecusa`, exigidos pelo **AT-4**/§3.4 e pelo molde do arquivo.

### Débito abaixo do Limiar de Três, declarado

Duas cópias de `ocorrenciasDeTermos` e da lista de termos do dialeto (`vocabulario-canonico.spec.ts` e `esquemas.spec.ts`). A casa compartilhada **não existe** e criá-la **cruzaria a fronteira do pacote folha**. Razão no docblock; candidato a `DÉBITO COM GATILHO` na terceira cópia.

## ⚠️ AUTOCORREÇÃO — o alerta que eu preparava para a T7 estava com a RAZÃO ERRADA

Registrei antes que *"se a T7 importar `ESQUEMA_DO_CORPO_VAZIO`, vira o quinto importador e o `CT-357` reprova"*. **Medido: está errado.**

| O que eu li | Onde | Real (medido) |
|---|---|---|
| *"quatro importadores"* | docblock de `esquema-de-corpo-vazio.ts` | **9** |
| *"seis importadores"* | texto do `it` do `CT-357` | **9** |
| — | `IMPORTADORES_DO_CORPO_VAZIO_ESPERADOS` | **9 entradas**, e `grep` no fonte dá **9** |

**A âncora executável está correta e sincronizada.** Importar `ESQUEMA_DO_CORPO_VAZIO` **não quebra** o `CT-357` — apenas exige **acrescentar à lista no mesmo diff**, que é o comportamento normal de toda âncora de superfície.

### A razão CERTA para a T7 usar `esquemaDaAtivacaoDaEntrega`

Não é risco de quebra — é **conformidade com a ADR-0016**: *"o esquema do pacote de contratos é a fonte única; a conferência de entrada e o documento derivam dele"*. A rota de ativação tem esquema **nomeado** publicado em `@sysloc/contracts`, de onde o OpenAPI deriva; usar a constante anônima da borda faria o documento perder o nome do elemento.

O aviso do executor da T5 (*"a T7 deve importar ESTE esquema, nunca a constante da borda"*) **continua correto** — o que estava errado era a **minha** justificativa para ele.

### Por que isto vale registro, e não só correção silenciosa

⭐ **O engano foi CAUSADO pela prosa defasada** (escriturada agora como **D15**). Eu li *"quatro importadores"* num docblock e construí um alerta sobre um número que estava errado desde antes desta fatia. É a materialização exata do que a `ancoras-de-superficie.md` adverte: *"número narrativo que fica para trás convida a próxima task a 'corrigir' a âncora executável para o valor errado"*.

**A regra operacional que fica**: ao preparar alerta baseado em contagem, **medir a constante executável**, nunca citar o número da prosa — mesmo quando a prosa está ao lado do código que ela descreve.

## Material da T6 consolidado — três correções derivadas antes do despacho

### 1. CT exigido: apenas `CT-1043`

A §6.5 referencia quatro (`CT-1024`, `CT-1030`, `CT-1032`, `CT-1043`), mas **só o `CT-1043` tem card** na §6.6. Medido onde cada um tem card:

| CT | Card em | Papel na T6 |
|---|---|---|
| `CT-1043` | **T6** | **entregável** |
| `CT-1030` | T7 | referência cruzada |
| `CT-1032` | T5 | referência cruzada (**já implementado**) |
| `CT-1024` | T9 | referência cruzada |

⭐ **A §6.5 da T6 é EXEMPLAR no ponto que mais confunde**: ela nomeia cada referência cruzada **com a task de origem entre parênteses** — *"CT-1030 (**T7**, integridade profunda na borda)"*, *"CT-1032 (**T5**, varredura estática)"*, *"CT-1024 (**T9**, saída real)"*. Não há como confundir entregável com referência.

ℹ️ Contraste útil: neste run o `grep` ingênuo do `T4.md` devolveria **6 CTs** onde há **1**, e o do `T6.md` devolveria **4** onde há **1**. A diferença é que a T6 **declara a origem**; a T4 não. **A forma da T6 deveria ser a convenção.**

### 2. ⚠️ Baseline do AT-9 DEFASADA — mesmo defeito da T5

| | AT-9 da T6 diz | **REAL** | Quem mudou |
|---|---|---|---|
| `@sysloc/cobranca-bancaria` | **93** | **104** | T1 (+7, suíte da conversão) e T5 (+4, `CT-1032`) |

Aparece em **três lugares** do `T6.md`: o AT-9 (linha 110), o comando da §6 (linha 154) e a linha 9 da §6.5 (linha 205). **Medir contra 93 faria o executor ver "+11" inexplicados e diagnosticar regressão inexistente** — exatamente o que o aviso preventivo evitou na T5.

### 3. Âncoras não declaradas (já registradas antes)

`packages/cobranca-bancaria/src/index.ts` (barril) e `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts` — a T6 publica `FamiliaDeEscopo` como símbolo público, e a §5 lista só três arquivos.

⚠️ **E há herança a respeitar**: a T6 volta a `adaptador-sicoob.spec.ts`, que a **T1 refatorou** para importar o molde de varredura da casa compartilhada (`test/varredura-de-agulhas.ts`), e a **T5** acabou de acrescentar `MODULOS_DA_ENTREGA` ao `vocabulario-canonico.spec.ts`. A T6 deve **importar e acrescentar**, nunca redeclarar nem reescrever — senão desfaz o Limiar de Três que a T1 estabeleceu e duplica o que a T5 acabou de organizar.

## T5 — Gate 2 (Tech Review): PARCIAL · PRIMEIRA RODADA DE CORREÇÃO DO RUN

`[T5] TR status=PARCIAL · 3 problemas: 2 ALTO (security, architecture) + 1 MEDIO (project_pattern, anotável) · 0 CRITICO`
`[T5] TR consultou: ADR-0001, ADR-0008, ADR-0009, ADR-0016, ADR-0017, ADR-0025, ADR-0034`
`[T5] bloqueantes pela partição: 2 (P1 ALTO/security, P2 ALTO/architecture) — ALTO sempre bloqueia`
`[T5] anotável: P3 MEDIO/project_pattern → D19`
`[T5] attempt_sha (rodada 1)=046c3a46fd31ca78f54f47a8bf1bb53f0f25147b`
`[T5] memória lazy criada com Ledger POPULADO (6 achados: 3 do QA + 3 do TR)`

### T5 — retry classification

- attempt: 1
- problemas_por_categoria (bloqueantes): `{ security: 1, architecture: 1 }`
- overrides_ativos: `[tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: false]`
- **requires_qa_revalidation: true**
- decisão: **re-QA obrigatório** — `security` e `architecture` estão em `revalidation_required`, e o override `tocou_area_critica: true` forçaria `true` de qualquer modo
- justificativa: correção de teto anti-abuso e de nulidade de campo publicado **muda comportamento**; pular o QA seria contrariar o default conservador da rule

### ⭐ Os dois bloqueantes são achados de COSTURA — só aparecem cruzando tasks

**P1 — os tetos anti-abuso não existem em produção.** O gate **mediu**, não inferiu:

| Medição | Resultado |
|---|---|
| Único `parse` em `apps/api/src` | `comum/validacao.ts:51` — confere **entrada** |
| As 68 ocorrências de `'output'` | passam por `esquemaPublicado(..., 'output')` → só `z.toJSONSchema` |
| JSON Schema derivado do `dist/` | `diagnostico` sai `{"type":"object","propertyNames":{"type":"string"},"additionalProperties":{}}` — **sem `maxProperties`, sem `maxLength`** |
| `packages/db/migracoes/0023_*.sql:30` | `motivo_diagnostico jsonb` **sem teto** |

⚠️ **O agravante é a declaração**: o docblock de `MotivoDaRecusaDoProvedor` afirma que *"o teto é do contrato publicado e o número mora num lugar só"*, e o **AT-8 está marcado como atendido** porque o `CT-1044` chama `safeParse` **direto** — o único contexto do produto em que os refines executam. *"Pior que a ausência do teto é a **crença** nele"*: quem escrever T6 e T7 lê o docblock e **não clampa**.

**P2 — três declarações do mesmo fato, uma discorda das outras duas.**

| Fonte | Diz |
|---|---|
| `packages/db/src/entrega-da-noticia.ts:70` | `Record<string, unknown> \| null` — docblock: *"anulável **mesmo com motivo presente**"* |
| `migracoes/0023_*.sql:37` | a `CHECK` permite **código sem diagnóstico** por construção |
| `modelo-canonico.ts:504` + `integracao-bancaria.ts:651` (T5) | **não anulável e obrigatório** — JSON Schema publica `required: [...,"diagnostico"]` |

⭐ **Nenhuma task violou a própria spec**: a T5 seguiu a §4.2 do tech spec à letra (que não marca `diagnostico` como anulável) e a T4 seguiu a §7 à letra. **A divergência é da costura — e é exatamente o que o Gate 2 existe para pegar.**

**Hoje não há defeito vivo** (nenhum escritor produz o nulo), mas: nada detecta a violação em runtime (P1 mostrou que saída não é parseada), **esta é a última janela antes do congelamento**, e a saída óbvia da T7 (`?? {}`) converteria *"o provedor não mandou campo nenhum"* em *"mandou objeto vazio"* — a mesma mentira sobre a origem que o docblock vizinho proíbe.

### O gate decidiu NÃO re-executar a suíte completa, e converteu o argumento em medição

A condição (2) estava acionada (`escopo: PARCIAL` + `tocou_area_critica: true`), e ele **registrou a razão**, como exigido:

- `git diff -U0 | grep '^-'` nos **quatro fontes de produção**: **zero** linhas removidas — mudança 100% aditiva;
- a única forma de adição em pacote folha quebrar consumidor é **colisão de nome em reexportação**, que é **erro de tipo** — e `pnpm build` (`tsc --build` nos 9 pacotes) está **verde** sobre esta árvore;
- `pnpm lint` verde, 393 arquivos.

> *"O que converte 'aditivo em folha não quebra consumidor' de asserção em medição."*

### Confirmações que o gate fez sob demanda

- **Tensão com o `D23`**: confirmou o veredito do Gate 1 nos três eixos, e apontou que **o eixo 2 é o único verificável sem julgamento** — `packages/contracts` é folha e `apps/api` importa dele; a aresta inversa é **proibida pela topologia**.
- **Minha autocorreção**: confirmou que a razão para a T7 usar `esquemaDaAtivacaoDaEntrega` é a **ADR-0016**, não risco de quebrar o `CT-357`.
- **Decisão A1 nº 4**, com razão **mais forte** que a minha e que a do Gate 1: importar de `packages/cobranca-bancaria/test/` para `packages/contracts/test/` não é só cruzar fronteira de folha — **é criar CICLO**, porque `@sysloc/cobranca-bancaria` importa `@sysloc/contracts` (o próprio `vocabulario-canonico.spec.ts:155` o faz).
- **`ESTADOS_DA_ENTREGA` não tem consumidor de produção** — registrado por transparência, não como achado: consta da §1 como símbolo exigido, o AT-6 o cobra congelado, e o glossário o canoniza. É superfície que congela sem ninguém a consumir.

## T5 — correção rodada 1 em curso: o escopo EXPANDIU para `packages/db`, e isso é o desejado

Medido contra o `attempt_sha` da rodada 1 (`046c3a4`), com a correção ainda em execução:

| Arquivo | Δ | Endereça |
|---|---|---|
| `packages/db/src/entrega-da-noticia.ts` | **+78** | ⭐ **P1 — o teto aplicado na ESCRITA** |
| `packages/contracts/src/integracao-bancaria.ts` | +63 | P1 (declaração) + P2 (nulidade) |
| `packages/cobranca-bancaria/src/modelo-canonico.ts` | +28 | P2 (tipo do domínio) |
| `packages/db/migracoes/**` | **0** | ✅ **intocadas** |

**O executor escolheu clampar em `gravarDesfechoDaEntrega`** — a opção que o prompt autorizou e que o Gate 2 recomendou (*"aplicar o teto onde ele morde"*). Isso ataca a **causa** (o teto não vigorava em produção), não o sintoma (o `.refine()` estar no arquivo errado). Era exatamente a distinção que o prompt advertia: *"mover o `.refine()` de lugar sem que ele passe a executar em produção não resolve"*.

✅ **As migrações `0023`/`0024` estão intocadas** — a imutabilidade foi respeitada, e o caminho alternativo (apertar a `CHECK`) foi corretamente evitado.

### ⚠️ Consequência para os gates da rodada 2

`packages/db` **entrou no escopo da correção**, o que muda o conjunto de suítes a medir:

| Pacote | Contagem antes da correção |
|---|---|
| `@sysloc/contracts` | **423** |
| `@sysloc/cobranca-bancaria` | **104** |
| **`@sysloc/db`** | **234** ← **novo no escopo** |

O Gate 1 da rodada 2 receberá os três, e a comparação por unidade tem de cobrir `db` também — sem isso, uma queda ali passaria despercebida.

ℹ️ **Nota sobre o `attempt_sha`**: ele foi capturado com `git add -A -- packages/cobranca-bancaria packages/contracts`, ou seja, só os paths que a T5 declarava. O diff contra ele mostra `packages/db/src/entrega-da-noticia.ts` como diferença **inteira** (+78 sobre um arquivo que não estava no tree), e traz também o resíduo pré-existente de spec (`docs/adr/INDEX.md`, `domain-glossary.md`). **Não é desvio** — é artefato da captura escopada. O `delta_arquivos` que vai ao gate será filtrado para os três arquivos de código realmente alterados pela correção.

## T5 — rodada 2: QA APROVOU · Gate 2 PARCIAL (achado novo) · rodada 3 autorizada

`[T5] QA rodada 2: APROVADO_COM_OBSERVACOES · 10/10 critérios · 2/2 CTs · 0 bloqueantes · 2 baixos novos (D20, D21)`
`[T5] TR rodada 2: PARCIAL · 1 problema MEDIO/security · os DOIS ALTO da rodada 1 CONFIRMADOS SANADOS pelo próprio gate que os abriu`
`[T5] attempt_sha (rodada 2)=828efaaab5d2620a5251b4ef37947e18aee7ce68`
`[T5] Ledger: TR-P1 → corrigido · TR-P2 → corrigido · TR-P1-r2 → aberto (rodada_origem 2)`

### Convergência do laço — avaliada e NÃO aplicável

```
rodada para decisão : 3 (attempt_count 2 + 1)
achado              : MEDIO / security
categoria convergível: architecture · performance · testability · speculative_complexity
security está na lista? NÃO
⇒ NÃO converge. Bloqueante. Rodada 3 autorizada.
```

⚠️ A lista de categoria convergível é **positiva e fechada**, e `security` está deliberadamente fora dela — a rule declara que `logic`, `data_handling`, `error_handling`, `concurrency`, `security`, `adr_compliance`, `technical_requirement`, `scope_deviation` e `tests` **seguem bloqueando como `CRITICO`/`ALTO`, por quantas rodadas forem**. Aplicar convergência aqui seria anotar defeito funcional como débito.

### T5 — retry classification (rodada 2 → 3)

- attempt: 2
- problemas_por_categoria (bloqueantes): `{ security: 1 }`
- overrides_ativos: `[tocou_area_critica: true, task_risk: medium, qa_security_flags: [], diff_stat_changed: false]`
- **requires_qa_revalidation: true** — `security` está em `revalidation_required`, e o override de área crítica forçaria `true` de qualquer modo

### ⭐ O achado novo é real, e foi VERIFICADO POR EXECUÇÃO

`limitarDiagnostico` **mede com uma semântica e grava com outra**:

| Operação | Código | Semântica |
|---|---|---|
| **medir** | `const candidato = { ...limitado, [chave]: diagnostico[chave] }` | propriedade computada ⇒ **DefineProperty** (cria propriedade própria) |
| **gravar** | `limitado[chave] = diagnostico[chave]` | atribuição por índice ⇒ **Set** (invoca setter herdado) |

Para `chave === '__proto__'` as duas divergem, e o gate mediu em Node sobre objeto vindo de `JSON.parse` — que é exatamente como a resposta do provedor entra:

```
entrada  : {"a":1,"__proto__":{"poluido":true},"b":2}
recebido : Object.keys → ['a','__proto__','b']
limitado : Object.keys → ['a','b']        ← chave que CABIA nos dois eixos, descartada
gravado  : {"a":1,"b":2}
```

**Três consequências**, e a primeira é a que importa:

1. **Falsifica o docblock** de `limitarDiagnostico`: *"o que sobrevive sobrevive verbatim, e é isso que mantém verdadeira a promessa dos três campos"*.
2. O objeto **medido** deixa de ser o **gravado**, quebrando a identidade de que a aferição do eixo de tamanho depende (aqui a divergência é **conservadora** — o gravado é menor —, então o teto **não é furado**, mas a propriedade que o torna auditável deixa de valer).
3. O `[[Prototype]]` de `limitado` fica trocado durante o restante do laço.

⚠️ **Não é `ALTO` porque não há poluição de `Object.prototype`** — `limitado` é local e descartado após a serialização, logo o achado **não é explorável**.

⚠️ **E o `CT-1049` não alcança a classe**: todos os seus passos usam `campoN`, `pequena`, `imensa` — nenhuma chave especial. **A rede do P4 não cobre o defeito**, que é justamente por que ele voltaria na primeira refatoração do laço.

### Confirmações do Gate 2 sobre a rodada 1 — os dois ALTO sanados, verificados por ele mesmo

- **TR-P1**: `limitarDiagnostico` chamada em `:291`, imediatamente antes da serialização (`:292`) e do `INSERT` (`:297`/`:306`); grep sobre a coluna em **toda a árvore** devolve como escrita **apenas** essas duas linhas; constantes importadas de `@sysloc/contracts:77`, **nenhum literal `32` ou `8192` em `packages/db`**. *"O ponto escolhido é o certo, e a razão está escrita: é o único ponto que grava, logo é o único que pode esquecer."*
- **TR-P2**: `.nullable()` aplicado **depois** dos dois `.refine()` (`:703-711`), de modo que o nulo **curto-circuita e não os atravessa**; as três pontas casam com a coluna `jsonb` anulável e com a `CHECK` da `0023`.

### Quatro análises do Gate 2 que valem além desta task

1. **ADR-0034 — razão INDEPENDENTE da do Gate 1**: ele abriu a `Decision` (não a paráfrase do INDEX) e achou que ela declara literalmente *"a decisão não alcança o registro operacional de diagnóstico"*. **A trilha que a ADR governa é `negocio.evento_bancario`**, não `negocio.entrega_da_noticia`, que é estado de configuração — **o delta nem toca a superfície que ela governa**.
2. **Por que o Limiar de Três NÃO dispara** nas três formas de `MotivoDaRecusa`: *"não é duplicação acidental, é a topologia que a **ADR-0025** prescreve — o pacote de domínio declara o tipo que a porta troca, a camada de dados declara o tipo da sua própria porta, e o contrato publica a projeção derivada do esquema. São três papéis em três camadas; colapsá-los criaria a aresta de acoplamento que a ADR proíbe."* Com precedente farto (`comodo.ts`, `politica-de-aviso.ts`, `identificador-bancario.ts`).
3. **`MAIOR_DIAGNOSTICO_EM_CARACTERES` mede UTF-16, não bytes** — 8192 unidades podem custar ~24 KB em UTF-8. **Não é furo** (o nome diz `EM_CARACTERES`, o fator é ≤3, o teto segue contendo abuso), mas fica registrado *"para que uma leitura futura não o 'corrija' achando que mede bytes"*.
4. **Terceira via para o truncamento silencioso, que ninguém avaliou**: emitir **uma linha no log estruturado (Pino)** quando `limitarDiagnostico` descarta ao menos uma chave. *"Dá a observabilidade que falta, não publica nada, e cabe no mesmo ponto."* — sem tocar superfície na janela do congelamento.

### Nota do Gate 2 sobre a declaração do executor

`modelo-canonico.ts:530` passou de `Record<string, unknown>` para `| null`, o que **em tese afrouxa** a garantia de quem lê `.diagnostico`. O gate **não abriu achado**, por três razões cumulativas: a mudança foi **exigida** pelo escopo da correção (é o próprio P2 dele), alinha o tipo ao que a coluna sempre admitiu, e o raio de impacto prova **zero consumidores** hoje. Registrou como *"alargamento de tipo exigido pela task"* em vez de contestar o `Garantias removidas: nenhuma`.

## T5 — rodada 3: Gate 1 APROVADO_COM_OBSERVACOES · Gate 2 **APROVADO** · TASK CONCLUÍDA

`[T5] QA rodada 3: APROVADO_COM_OBSERVACOES · 4/4 critérios revalidados · 0 bloqueantes · 1 baixo novo (D22) · escopo=SUITE_COMPLETA`
`[T5] TR rodada 3: APROVADO · problems: [] · TR-P1-r2 SANADO NA CAUSA`
`[T5] TR consultou: ADR-0016`
`[T5] ledger: 10 achados totais | 4 originados em rodada >1 | 0 suspeitos de incompletude da rodada 1`

⭐ **`{C} = 0` é o dado mais importante desta métrica**: **todos** os quatro achados de rodada > 1 nasceram das **próprias correções** — `TR-P1-r2` da correção da rodada 1, `D20`/`D21` do mesmo delta, `D22` da renumeração da rodada 2. **Nenhum** existia desde a rodada 1 sem ter sido visto. As varreduras foram completas; o laço não foi alongado por incompletude de gate.

### O fecho do `TR-P1-r2` — prova de construção, não de inspeção

> *"Na última iteração ACEITA, `aceitas` final **É** exatamente o array `[...aceitas, entrada]` que foi medido — logo o objeto retornado é estruturalmente idêntico ao último candidato medido, **para TODA chave**. `Object.fromEntries` cria por `CreateDataPropertyOrThrow` (DefineOwnProperty), que **jamais consulta a cadeia de protótipo**."*

E o gate nomeou por que a classe fecha, não só a ocorrência: *"a atribuição indexada divergia em `__proto__` porque ele é o único ACESSOR em `Object.prototype`, mas **o consumo da mesma primitiva nas duas pontas dispensa saber quais chaves são acessores**."*

### A segurança ficou MAIS FORTE, e o furo era de fidelidade

> *"Antes, o medido (`candidato`, por spread) continha `__proto__` e o gravado (`limitado`, por atribuição) não: o objeto que ia para `JSON.stringify` era um objeto que **nunca fora medido**. Agora `:306` serializa exatamente o objeto medido, de modo que `JSON.stringify(retorno).length <= MAIOR_DIAGNOSTICO_EM_CARACTERES` é **garantia de construção**."*

### ⚠️ Correção fina do Gate 2 sobre o Gate 1 — o gatilho da `DECISÃO FECHADA`

O Gate 1 citou *"um gate rejeitou o mesmo item"* como gatilho da §3. **O gatilho (b) exige DUAS ou mais rejeições**, e o `TR-P1-r2` teve **uma**. Os que valem de fato:

- **(d)** — *"decisão tomada por veredito explícito de um gate"*
- **(c)** — *"a forma escolhida é menos óbvia que a alternativa idiomática, e você só a escolheu depois de descartar a óbvia por razão concreta"* — aqui **literal**: o acumulador mutável **é** a forma idiomática, e foi **medida e refutada**

*"São dois gatilhos, e a conclusão do Gate 1 está certa; só o rótulo de um deles estava frouxo. Não é achado — a §3 exige que ALGUM gatilho valha, não que se nomeie qual."*

### O `REVERTER EXIGE` como precedente do repositório

O Gate 2 subscreveu a leitura e explicou a razão operacional:

> *"O campo **não** pede 'provar que `__proto__` funciona' (o que a rodada seguinte satisfaria com um `if`); pede **'provar que medição e escrita continuam usando a MESMA primitiva de criação de propriedade, para toda chave que o provedor possa devolver'**, e então FECHA NOMINALMENTE a saída fácil. É a diferença entre um marcador que protege o **SINTOMA** e um que protege a **CLASSE**."*

ℹ️ E registrou que **`DECISÃO FECHADA` não entra no índice do `CLAUDE.md`** — aquele bloco é exclusivo de `DÉBITO COM GATILHO`. Não há obrigação de índice pendente.

### `D20` não corrigido — os TRÊS níveis concordaram, por razões independentes

Executor (A1, menor delta) → Gate 1 (BAIXO nunca bloqueia; sem evidência nova; §5 do ciclo curto) → Gate 2: *"corrigi-lo teria sido **violação da §5** — 'um bloqueante, uma mudança' é regra explícita, e ampliar o diff de uma rodada de correção para pagar um BAIXO é **superfície de regressão de graça** (proibição 5 da §4)."*

## T6 — executor concluído · ⚠️ AUTOCORREÇÃO: a derivação de âncora que fiz para esta task estava ERRADA

`[T6] executor retornou: 0 criados, 3 modificados (+ o card T6.md) · cobranca-bancaria 104→105 · build ✅ · lint ✅ · Garantias removidas: nenhuma`
`[T6] baselines medidas: cobranca-bancaria 105 · api 357 · worker 126 · contracts 424 · shared 263 · db 235 · documentos 159 · auth 89 · regua 30 — nenhuma caiu`

### A derivação que eu registrei — e por que ela estava errada

Registrei, antes do despacho, que a T6 precisaria de **duas âncoras não declaradas**: `packages/cobranca-bancaria/src/index.ts` (barril) e `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`, porque a §1 declara **`FamiliaDeEscopo`** entre os *"Símbolos públicos criados"*.

**O executor mediu e refutou.** A prova é literal, no cabeçalho do módulo:

```
packages/cobranca-bancaria/src/credencial-de-acesso.ts:6
* ELE NÃO SAI NO BARRIL, e a ausência é o mecanismo (D5 do tech-alignment)
```

E `grep CacheDeCredenciais packages/cobranca-bancaria/src/index.ts` devolve **vazio** — confirmado pelo orquestrador.

**O raciocínio dele procede integralmente**: a §1 da T6 nomeia `FamiliaDeEscopo` **na mesma linha** de `CacheDeCredenciais.credencialDaEmpresa`, e como aquele módulo é **declaradamente não-publicável**, *"símbolos públicos criados"* ali significa **superfície de MÓDULO**, não de pacote. Consequências: o barril **não** cresceu, `SIMBOLOS_PUBLICADOS` segue em **53**, e `vocabulario-canonico.spec.ts` **não precisou de edição**.

### ⭐ A premissa errada da minha derivação, nomeada para não se repetir

Assumi que **"símbolo público criado" ⇒ "sai no barril"**. **Não implica** quando o módulo é declaradamente não-publicável — e este repositório tem pelo menos um caso assim, com a não-publicação registrada como **mecanismo de política** (*"publicá-lo ofereceria um segundo caminho, mais fraco, para a mesma política"*).

**Contraste com a T5, onde a mesma derivação estava CERTA**: lá os símbolos eram esquemas de `@sysloc/contracts`, cujo barril reexporta símbolo a símbolo e cuja publicação é o propósito do pacote. A diferença não é de forma — é de **natureza do módulo**.

**Regra corrigida para as tasks restantes**: antes de derivar âncora de barril, **verificar se o módulo de origem é publicável** — lendo o docblock dele e conferindo se símbolos irmãos já saem no barril. A derivação por busca continua valendo; o que estava frouxo era a premissa.

ℹ️ **Custo real do meu erro: zero.** O executor tinha o material para medir e mediu; a antecipação errada não o levou a tocar arquivo que não devia — ele **verificou antes de agir**, que é exatamente a conduta que o `CLAUDE.md` exige (*"incerteza → leia o arquivo ou rode grep, nunca chute"*).

### Duas decisões auto-resolvidas (A1) do executor, ambas com razão medida

**1. O desfecho da entrega NÃO carrega `classe`.** A §6.4 e o passo 10 da §6.6 escrevem `{ aceito: false, classe: 'DA_EMPRESA', motivo }`, mas **`ResultadoDaOperacaoDeEntrega` (T5, aprovada) declara `{ aceito: false; motivo: MotivoDaRecusaDoProvedor | null }`**. Acrescentar `classe` faria o adaptador **não satisfazer a porta**, que é o **AT-3**. Adotou o tipo publicado; a intenção do critério ficou afirmada por `resolves.toEqual(...)` no passo 10.

⚠️ **Isto é divergência entre a spec da T6 e a T5 já aprovada** — mais uma da mesma classe do `P2` da T5 (§4.2 × §7 do tech spec). O executor escolheu o **contrato publicado** sobre o **texto da task**, que é a ordem certa.

**2. `FamiliaDeEscopo` não sai no barril** — ver acima.

### ⚠️ Insumo do executor para a T7 — vai literal no prompt dela

> `ConfiguracaoDoProvedorBancario.enderecoDaEntregaDaNoticia` é **OPCIONAL** (precedente de `enderecoDeAutorizacao`; obrigatório arrastaria **4 construtores** fora do escopo). **A composição raiz da área e a conferência de partida precisam informá-lo — sem ele as duas operações resolvem negativas SEM CHAMAR o provedor.**

Isso é um modo de falha silencioso de primeira ordem: a rota responderia "desabilitada" sem nunca ter falado com o provedor, e nada acusaria.

### Três limites declarados pelo executor, todos legítimos

- **Não medido contra a conta real**: o caminho do recurso da entrega e a forma da consulta. **Medidos** são os escopos, os dois códigos de movimento e os verbos. A composição vive em **um ponto por operação**.
- **Endereço de contato do cadastro não é enviado** — o produto não o modela; declarado no docblock de `comporCadastroDaEntrega`.
- **Baseline defasada do AT-9** (93 contra 104 real) — registrado no card; correção entra na T10.

## ⚠️ Derivação para a T7 — ela provavelmente ABRE `ambiente.ts`, e isso DISPARA o `D51`

**Fundamentada em leitura do docblock**, não em premissa — a lição da T6 aplicada.

O executor da T6 deixou o insumo: `ConfiguracaoDoProvedorBancario.enderecoDaEntregaDaNoticia` é **opcional**, e *"sem ele as duas operações resolvem negativas **SEM CHAMAR** o provedor"*. Perguntei de onde ele vem, e o docblock do campo (`adaptador-sicoob.ts:640-651`) responde:

> *"A URL é **UMA SÓ para todos os clientes** — o roteamento da notícia recebida é pelo identificador que o próprio produto emitiu (…). Por isso ele é **configuração do processo**, e não dado por empresa."*
> *"Declarado, a forma é conferida na construção e **a recusa nomeia a variável**."*

**"Configuração do processo" + "nomeia a variável" ⇒ variável de ambiente.**

E o precedente confirma o caminho: `enderecoDeAutorizacao` chega ao módulo como `ambiente.enderecoDeAutorizacaoBancaria` (`integracoes-bancarias.module.ts:88`), e é declarado em **três** lugares:

| Onde | A §5 da T7 declara? |
|---|---|
| `apps/api/src/integracoes-bancarias/integracoes-bancarias.module.ts` | ✅ **sim** |
| `apps/api/src/cobrancas/cobrancas.module.ts` | ❌ não |
| **`apps/api/src/configuracao/ambiente.ts`** | ❌ **não** — e tem o `D51` |

### O que isso significa para o despacho da T7

1. **`ambiente.ts` entra no escopo esperado**, com a razão medida. Vai ao prompt como escopo derivado, igual ao que fiz na T5.
2. ⚠️ **O `D51 · F4/T16` DISPARA.** O gatilho dele é literalmente *"a **primeira task autorizada a abrir** `apps/api/src/configuracao/ambiente.ts`, ou o terceiro processo que exigir as mesmas variáveis"*. A T7 será essa task.
   - Isso **muda** o que registrei antes (na análise de débitos com gatilho, concluí que o `D51` não dispararia porque a **T8** não abre `ambiente.ts`). A conclusão valia para a T8 — **não vale para a T7**.
   - O executor da T7 precisará **fechar o débito** (unificar as duas conferências de forma que hoje têm duas definições) **ou** registrar por que não o faz. Fechá-lo exige remover o marcador de `apps/worker/src/main.ts` **e** a linha do índice do `CLAUDE.md`, no mesmo commit — as duas pontas do `CT-907`.
3. **`cobrancas.module.ts` provavelmente NÃO entra**: ele informa `enderecoDeAutorizacao` porque compõe o adaptador para a área de cobrança, que **não cadastra entrega alguma** — é exatamente a assimetria que o docblock declara ao justificar o campo opcional.

⚠️ **Grau de confiança declarado**: alto para `ambiente.ts` (o docblock diz "variável" e o precedente é direto); **médio** para o disparo do `D51` — depende de o executor de fato precisar tocar o arquivo, e não de haver caminho alternativo que eu não tenha visto. **O prompt da T7 apresentará os dois como derivação a confirmar, não como fato** — que é a conduta que a refutação da T6 ensinou.

## T6 — Gate 1 APROVADO_COM_OBSERVACOES · Gate 2 **PARCIAL** · rodada de correção 2 do run

`[T6] QA: APROVADO_COM_OBSERVACOES · 9/9 critérios · 1/1 CT · 0 bloqueantes · 1 medio anotável + 5 baixos · security_flags: ["missing_secret_redaction_echo_axis"]`
`[T6] TR: PARCIAL · 1 ALTO/security (bloqueante) + 1 BAIXO/architecture (→ D29)`
`[T6] TR consultou: ADR-0001 (+2 emendas), ADR-0025, ADR-0032, ADR-0034`
`[T6] attempt_sha (rodada 1)=67a418af6876e1c152259d18d80ffeeef4709c0d`
`[T6] Ledger criado POPULADO com 8 achados`

### T6 — retry classification

- attempt: 1
- problemas_por_categoria (bloqueantes): `{ security: 1 }`
- overrides_ativos: `[tocou_area_critica: true, task_risk: high, qa_security_flags: NÃO VAZIA, diff_stat_changed: false]`
- **requires_qa_revalidation: true** — `security` está em `revalidation_required`, e **dois** overrides o forçariam de qualquer modo

### ⭐ O Gate 2 DISCORDOU da classificação do Gate 1, com fundamento — e a distinção é o achado

O QA classificou o eixo de eco como **`baixo`/`tests`** (`D26`), endereçado à T9. O Gate 2 elevou para **`ALTO`/`security`**:

> *"A lacuna do companheiro negativo é real e é `tests`, mas ela é **sintoma**. O fato de produção é que o único ponto de redação do arquivo (`semACredencialDoAto`) **não é chamado neste caminho para o segredo que este caminho de fato carrega** — isso é **ausência de garantia em código de produção**, e não cobertura de teste faltando."*

**Caminho de vazamento, mapeado ponta a ponta:**

```
obterCredencial:1690  (motivoDoTexto + lerMotivoDaRecusa, SEM redator)
  → ConcessaoTentada.recusa
  → AtoAutenticado.recusaDaConcessao:1761
  → executarEntrega:1860
  → ResultadoDaOperacaoDeEntrega.motivo
  → gravado em negocio.entrega_da_noticia.motivo_{codigo,mensagem,diagnostico}
  → publicado ao Admin
```

**O `identificadorDaAplicacao` é segredo operável pelo próprio modelo do produto**: `identidade.service.ts:60` o guarda por `cifrarValorOperavel` na coluna `identificador_da_aplicacao_cifrado`, e `identidade-no-provedor.ts:205` o reabre por `decifrarValorOperavel` — o mecanismo que a ADR-0032 reserva para segredo operável. E `comporPedidoDeCredencial:1352` põe `client_id: identificadorDaAplicacao` no corpo enviado.

⚠️ **`lerMotivoDaRecusa` é portador MAIS LARGO que `motivoDoTexto`**: varre `Object.entries(recusa)` e leva **todos os campos restantes** para `diagnostico`, sem aparar nem clampar. *"Nem sequer é preciso que o provedor ecoe dentro de uma mensagem — basta que devolva `client_id` como chave própria."*

### ⭐⭐ O golpe decisivo: a T6 declara a invariante que o código não cumpre

O bloco INVARIANTES do `CT-1043` (`adaptador-sicoob.spec.ts:2340`) escreve:

> *"nem a senha, nem os bytes do material, **nem o identificador da aplicação**, nem credencial alguma aparecem em desfecho, erro ou diagnóstico"*

E o passo 11 inclui a agulha e afirma `toEqual([])`. **Mas o `RECUSA_DA_CONCESSAO` do caso é `{error, error_description, scope}` e NÃO ecoa o identificador**:

> *"A asserção passa porque a fixture não o devolve, **não porque haja mecanismo**. O controle positivo é legítimo e prova que o detector enxerga a agulha — o que ele não prova é que o SUT a bloqueie, porque **o SUT nunca é exposto a ela**."*

⚠️ Isso torna a asserção **AP-29 para este eixo** — ela não pode falhar.

### E o comentário do código explica por que a omissão aconteceu

`adaptador-sicoob.ts:1686-1687` justifica a ausência de redator dizendo *"Não há credencial a redigir aqui: este é o ato que a produziria, e o pedido saiu **sem** cabeçalho de autorização"* — **verdadeiro para a credencial, falso para o segundo segredo que o mesmo pedido carrega no corpo**. O gate observou que o docblock de `semACredencialDoAto` já contém o raciocínio correto, aplicável com mais força: *"Provedor que ecoe o cabeçalho recebido — hábito comum em diagnóstico de erro — poria credencial viva numa superfície persistida e apresentada"*. E o `client_id` **não é cabeçalho recebido por acaso: é campo que nós enviamos**, e ecoar o parâmetro recusado é o comportamento mais comum de um endpoint OAuth de erro.

### Por que ALTO e não CRITICO — as três razões que o gate registrou para auditoria

1. **nenhuma medição contra a conta real** mostra que este provedor de fato ecoa o `client_id` — o risco é **condicional**, não exposição demonstrada;
2. a mesma omissão **já existe** em `motivoDoTexto` e é **anterior à T6** (nasceu no fecho do `D36`, quando o `client_id` entrou no corpo) — *"a T6 não criou o eixo, ela o **alargou**, acrescentando um portador irrestrito e uma superfície publicada nova"*;
3. o conserto é **um argumento em um ponto só**, com o mecanismo já construído e no lugar certo.

### O Gate 2 re-executou a suíte, e a contabilidade fecha

Condição (2) acionada. Ele rodou **os 6 pacotes que o QA não rodou** — *"o delta exato entre o que ele mediu e a suíte completa"* — e registrou a razão: *"o contrato do Gate 2 não abre exceção por qualidade da justificativa; a condição é **combinatória, não discricionária**"*.

**Resultado: `contracts` 424 · `shared` 263 · `db` 235 · `documentos` 159 · `auth` 89 · `regua` 30 = 1200 verdes.** Somados aos 3 do QA: **suíte completa em 1788 casos nos 9 pacotes**.

⚠️ **Nota de baseline para o fecho da fatia**: o `CLAUDE.md` registra **1737** (medido em 2026-08-20); a diferença de **51** vem das T1–T5 desta fatia, **não** da T6 (que move `cobranca-bancaria` de 104 para 105).

### Duas confirmações do Gate 2 sobre a migração do esquecimento

O prompt pediu atenção redobrada às 82 deleções, por causa da mudança de assinatura. O gate confirmou `Garantias removidas: nenhuma` e destacou o ponto exato:

> *"O esquecimento por credencial morta **migrou** de dentro do ramo `codigo >= MENOR_CODIGO_DE_RECUSA` de `executar` para `falarAutenticado`, e a migração é **equivalente** — `MENOR_CODIGO_DE_RECUSA` é 400 e `CODIGOS_DE_CREDENCIAL_MORTA` são 401/403, **todos ≥ 400** —; o que mudou é que ele passou a alcançar também as operações de entrega, **que é ganho, não perda**."*

### Confirmação da minha derivação sobre a T7 — com a precisão que faltava

O gate **confirmou** que a raiz de composição é o ponto certo, e **refinou**: o docblock diz que a recusa *"nomeia a variável"*, mas `CAMPO_DO_ENDERECO_DA_ENTREGA = 'enderecoDaEntregaDaNoticia'` nomeia deliberadamente **o campo**, não uma variável de ambiente — *"porque este pacote não sabe sob que nome a partida guarda o valor"*. Isso é **conforme**; o que ele **não** garante é que alguém, na partida, **exija** o valor.

E sobre o `D51`: *"confirmo a derivação do orquestrador quanto ao arquivo; **o disparo depende de a T7 de fato o abrir, o que ainda não é fato medido**"* — exatamente o grau de confiança que eu havia declarado.

## T6 — rodada 2: Gate 1 **APROVADO** (zero problemas) · `security_flags` limpo

`[T6] QA rodada 2: APROVADO · 9/9 critérios · 1/1 CT · 0 problemas em TODAS as severidades · security_flags: []`
`[T6] Ledger: QA-BAIXO-003 → corrigido (mesmo fato do TR-P1) · TR-P1 aguarda o gate que o abriu`

### A correção fechou a CLASSE, e o gate verificou cada elo

| Elo | Verificação |
|---|---|
| Ponto único obrigatório | `semOsSegredosDoAto(texto, segredosDoAto: readonly string[])` em `:1215`, **posicional e obrigatório** |
| Únicos chamadores | `motivoDoTexto` (`:1230`) e `lerMotivoDaRecusa` (`:1320`) — **toda** leitura de texto recusado passa por ela |
| As quatro composições | `obterCredencial` nas **duas** do ramo de recusa (`:1740` motivo, `:1742` recusa), `executar` (`:1878`), `executarEntrega` (`:1929`) |
| A lista cobre os dois segredos | `falarAutenticado:1840` → `[credencial.valor, ato.identidade.identificadorDaAplicacao]`; `obterCredencial:1717` → `[identificadorDaAplicacao]`, **correto porque ali ainda não existe credencial** |
| Caso especial de `client_id` | **zero** — as duas menções ao literal são a composição do formulário (`:1395`) e o texto da `DECISÃO FECHADA` (`:1208`) |

### ⭐ AP-29 confirmado sanado — a rede AGORA PODE FALHAR

`RECUSA_DA_CONCESSAO` (`spec:499-504`) ecoa o identificador nos **dois** portadores: interpolado em `error_description` (→ `mensagem`, eixo estreito) **e** como **chave própria** `client_id` (→ `diagnostico`, o portador mais largo, apontado pelo Gate 2 como o mais perigoso).

> *"Com o código antigo o passo 11 sairia `['recusado/identificador-da-aplicacao']` em vez de `[]`, e o passo 12 reprovaria nos dois campos **nomeando por qual portador o segredo saiu**."*

**E o passo 12 é âncora antivácuo real**: afirma **positivamente** a sentinela nos dois campos — *"se o eco não chegasse à fixture, o esperado divergiria do observado e o caso reprovaria"*. É o que fecha a armadilha de o passo 11 passar por vacuidade. A sentinela é escrita **literal do lado do teste** e nunca importada do artefato, preservando a disciplina que o `CT-844` já pratica.

### AP-24 verificado passo a passo, não presumido

Contagem 105 → 105 com passo novo **dentro** do `CT-1043`. O gate conferiu os **11 passos anteriores** um a um — `toBe(1)`, `toBe(2)`, `toEqual` de escopos em ordem, listas por igualdade mais interseção vazia, âncora de `chamadas.length`, `toEqual` do motivo canônico, distinção de tipo. *"Nenhuma asserção foi trocada por forma mais frouxa; o passo 12 **ACRESCENTA** duas asserções ao `toEqual` que já existia, o que **fortalece** a prova."*

### A decisão da sentinela — mérito aprovado, com um argumento que eu não tinha

> *"A sentinela **NÃO vaza por diferenciação**: ela é **UMA SÓ** para todos os segredos (o `reduce` aplica a mesma cadeia a cada item da lista), de modo que o leitor do motivo **não consegue inferir QUAL segredo** ocupava aquele campo — inferência que uma sentinela por tipo daria **de graça**."*

E preservar o valor foi o menor delta: ele é asserido por extenso pelo `CT-844` (`spec:2104`), e trocá-lo obrigaria a editar caso verde alheio ao bloqueante, o que o P5 desaconselha.

### ADR-0032 — as DUAS metades cumpridas

- **A superfície**: `motivo` (erro) e `diagnostico` (diagnóstico) — as palavras que a `Decision` nomeia — passaram a ser redigidos no ramo que escapava, e a redação corre **antes do desmonte** (`lerMotivoDaRecusa:1320`) e **antes do recorte** (`motivoDoTexto:1230`) — ordem que impede *"tanto o eco cair dentro de um campo do diagnóstico quanto o prefixo do segredo sobreviver ao `slice`"*.
- **O método**: *"afirmada por medição da saída real, nunca por leitura do código"* — `ocorrenciasDeAgulhas` sobre o objeto **realmente devolvido pela porta**, com controle positivo por igualdade de lista incluindo `controle/identificador-da-aplicacao`.

**ADR-0034 sem regressão**: a redação **não interpreta nem recorta** o que não é segredo — `split`/`join` substitui apenas a ocorrência literal, e o passo 12 prova por igualdade que `scope` atravessa íntegro e `codigo` sai verbatim.

### Nota sem severidade que o gate deixou para o futuro

No passo 11, as agulhas `credencial-da-entrega[*]` vêm do par `provedor` mas são varridas sobre `recusado`, que é desfecho do par `negado` — **ato cuja concessão foi recusada e que portanto nunca teve credencial**. Aquele componente específico **não discrimina naquele alvo**.

⚠️ **Não é AP-29** — a asserção **como um todo** é falsificável por três dos seis rótulos (senha, material em três serializações, e o identificador). *"Registro apenas para que uma fatia futura não leia aquele rótulo como prova de não-cruzamento de credencial no ato negado."*

---

## T6 — Gate 2 (Tech Review) rodada 2 · veredito

- **Agente**: `agent-spec-staff-architecture-review` · `opus` · agentId `a4fdef3a6f68ad5cf` · 568,8 s · 44 tool_uses · 151.267 tokens
- **Veredito**: `APROVADO_COM_OBSERVACOES` — **1 problema, BAIXO/`code_quality`**, não bloqueante pela partição de severidade.
- **Escopo de scan**: `DELTA` mantido — o raio de impacto foi determinado com confiança (nenhum símbolo do delta é exportado; `grep` fora do arquivo devolve zero em `apps` e `packages`; os dois consumidores do pacote medidos verdes). **Sem fallback para FULL.**
- **Re-execução de testes**: **SIM**, condição (2) acionada (`escopo_testes: PARCIAL` + `tocou_area_critica: true`). Suíte **completa**, pacote a pacote como o `CLAUDE.md` exige — **1788 casos verdes nos 9 pacotes**, exatamente a contagem da rodada 1. **P5 fecha nas duas pontas**: nenhum caso vermelho, nenhum caso sumido.
- **Anti-gaming (AP-24)**: verificado sobre o diff contra `attempt_sha_anterior`. Nenhum `skip`/`only`, nenhum caso removido (105 → 105), nenhuma asserção afrouxada. O `toEqual` do passo 12 **ganhou** superfície (`diagnostico` de `{scope}` para `{scope, client_id}`), e a fixture `RECUSA_DA_CONCESSAO` foi **endurecida**.

### O bloqueante TR-P1 está SANADO — e fechou a CAUSA, verificada por medição

| Prova | Medição |
|---|---|
| ponto único obrigatório | `semOsSegredosDoAto:1215` recebe `segredosDoAto: readonly string[]` **posicional e obrigatório** — *"a omissão não compila"*, e o `tsc --build` verde **é** a prova do argumento |
| portador desce pelo tipo | `AtoAutenticado.segredosDoAto` obrigatório no ramo `FALOU` (`:610`) — não por convenção |
| chamadores | os únicos são `motivoDoTexto:1229` e `lerMotivoDaRecusa:1312`, e as **quatro** composições passam a lista (`obterCredencial:1740` e `:1742`, `executar:1878`, `executarEntrega:1929`) |
| nenhum caminho escapa | `grep` por `.texto` devolve 7 ocorrências; as 4 de caminho recusado passam pela redação, as 3 restantes são do desfecho **ACEITO**, onde não há texto de recusa a preservar |

**A premissa foi reconferida na fonte, não no relato**: `identificadorDaAplicacao` é segredo operável de fato — `negocio.ts:2042` grava `identificador_da_aplicacao_cifrado`, `identidade.service.ts:60` o cifra com `cifrarValorOperavel`. **ADR-0032 satisfeita nas duas metades**; **ADR-0034 sem regressão** (o passo 12 prova o não-recorte por igualdade).

### Achado novo — TR-P3 · BAIXO · `code_quality` → escriturado como **D30**

A redação passou a alcançar **valor de origem externa** cujo contrato admite **um caractere** (`min(1)`), sem piso de comprimento. Falha na **direção segura** (redige demais), mas atrita com a passagem verbatim da ADR-0034 — e o **próprio docblock declara o critério que o código não impõe**.

### Verificações que o gate fez e não viraram achado

- A `DECISÃO FECHADA — T6 / Gate 2 · 2026-08-22` (`:1204`) é **legítima e bem formada** pelo crivo da §3: gatilho explícito (*"veredito de um gate"*), quatro campos presentes, `REVERTER EXIGE` **concreto e mensurável**. Posicionamento entre docblock e função é o padrão medido em **6 outros pontos** do repositório.
- A ordem das asserções **respeita** a `DECISÃO FECHADA — T10 / Gate 1 · 2026-08-15` (`spec:1337`): a varredura (`:2553`) vem **antes** do `toEqual` (`:2561`). *"Posta depois, ela só executaria com a igualdade já aprovada — que é exatamente o AP-29 que aquele marcador existe para barrar. O deslocamento é conformidade, não conveniência."*
- **Garantia removida: nenhuma.** A guarda `credencialDoAto === ''` está preservada dentro do `reduce`, o que também barra o `split('')` que estilhaçaria o texto. *"O que a mudança removeu foi a OPCIONALIDADE do parâmetro, que era o defeito."*
- **Concordou com a decisão auto-resolvida (A1)** de preservar `«credencial omitida»` byte a byte: *"sentinela única para todos os segredos não deixa o leitor inferir QUAL segredo ocupava o campo, inferência que uma sentinela por tipo daria de graça"*.
- **Registro sem achado, para uma fatia futura não ler errado**: as agulhas `credencial-da-entrega[*]` do passo 11 varrem um ato cuja concessão foi recusada e que **nunca teve credencial** — aquele componente não tem estado em que possa reprovar. **Não é AP-29** (a lista é falsificável pelos outros componentes, e o controle positivo em `:2545` prova que o varredor enxerga cada rótulo), mas *"a prova de não-cruzamento de credencial no ato negado está no CT-844, não aqui"*.
- **Ruído no diff conferido na genealogia**, e não é desvio de escopo: os três arquivos da intervenção dirigida de 2026-08-21 (ADR-0036 / D64) são anteriores à rodada 1 e não foram tocados.
- **Pré-existente, sem achado**: a redação casa por **cadeia literal**; eco codificado pelo provedor (percent-encoding, escape JSON) não seria alcançado. Mesma exposição que a credencial já tinha; não é regressão desta rodada.

### Métrica do Ledger de Achados — T6 (registrada ANTES da deleção de `tmp/T6.md`)

| | |
|---|---|
| Achados no Ledger | **8** (6 do Gate 1, 2 do Gate 2) |
| `aceito_como_debito` | **7** → `D23`…`D29` |
| `corrigido` | **1** (QA-BAIXO-003, o passo 11 — reaberto pelo TR como TR-P1 e fechado na rodada 2) |
| Reincidência entre rodadas | **zero** — nenhum achado da rodada 1 reapareceu; nenhum item foi rejeitado duas vezes |
| Elevação de severidade entre gates | **1** (QA-BAIXO-003 `baixo/tests` → TR-P1 `ALTO/security`) — **o único do run até aqui** |
| Achado novo na rodada 2 | **1**, BAIXO (`D30`) |

**Ledger encerrado**: TR-P1 `sanado`; TR-P2 e os 5 do Gate 1 `aceito_como_debito`; QA-BAIXO-003 `corrigido`.

### Fecho da T6

- `git add` dos paths da task · `task_plan.md` e `T6.md` → `Concluído` · `tasks_completed: 5 → 6` · snapshot regenerado · `tmp/T6.md` deletado.
- **Débitos da fatia: 29 → 30.** Candidatos a regra: 12 → **13**.

---

## T7 — despacho do executor (tentativa 1)

- **Agente**: `sysloc-backend-implementer` · **`opus`** (CLAUDE.md: Sonnet/Haiku proibidos, sem negociação) · `gates: [qa, tech_review]`
- **`base_sha`**: `f5bdb296b9aec2ded6e46d7e284c93cbd7f2a3fd` — baseline isolada por `git commit-tree` sobre `git write-tree` do índice, com pai `82874d0`. **Sem branch, sem mover `HEAD`, sem tocar o índice.** Conferido: o diff contra `82874d0` traz **38 paths, todos da fatia**, e o ruído da intervenção dirigida (`preparar-material-do-certificado.sh`, `docs/adr/INDEX.md`, `docs/specs/domain-glossary.md`) está **ausente** — verificado por `grep` sobre o `--name-only`, não por inspeção visual.
- **Paralelismo**: nenhum. A Fase 2 é **integralmente sequencial** por alta contenção (composição raiz, barril, diretório de migrações), e a T7 depende de T4+T5+T6, todas fechadas.
- **CTs exigidos** (extraídos da **§6.5 e dos cards `#### CT-` da §6.6**, nunca por varredura do arquivo — a lição do erro do `CT-1021` na T1): **12** — CT-1025, CT-1026, CT-1028, CT-1029, CT-1030, CT-1031, CT-1034, CT-1035, CT-1036, CT-1037, CT-1038 e **CT-1047** (o acrescentado, com divergência declarada na §7).
- **Herdado do fecho da T6**: o `D29` vai ao prompt como **correção endereçada à T7 por veredito do Gate 2**, e a derivação sobre `ambiente.ts`/`D51 · F4/T16` vai como **hipótese a confirmar, não como fato** — o próprio Gate 2 registrou que *"o disparo depende de a T7 de fato o abrir, o que ainda não é fato medido"*.

---

## Derivação antecipada da T8 — feita enquanto o executor da T7 corre, por leitura pura (nenhum arquivo tocado)

> Trabalho útil sem contenção: a T7 escreve em `apps/api/src/integracoes-bancarias/` e nas âncoras de superfície; esta derivação **só lê**. Registrada aqui para não ser redescoberta no despacho.

**T8 — Reconferência da entrega enfileirada após o registro do certificado.** `risk: medium`, `gates: [qa, tech_review]`, depende de T4+T5+**T7**. **3 CTs**: CT-1039, CT-1040, CT-1041 (extraídos da §6.5/§6.6).

### A fila nova é a **sétima**, e a cadeia tem cinco pontos

Medido: `packages/shared/src/fila.ts` declara **6** filas hoje (`FILA_DA_REGUA`, `FILA_DA_CONFIRMACAO`, `FILA_DO_ECO`, `FILA_DA_EMISSAO_EM_LOTE`, `FILA_DA_CONFERENCIA_BANCARIA`, `FILA_DA_NOTIFICACAO_BANCARIA`) e `apps/worker/src/fila.ts` tem os 6 membros correspondentes. O card já enumera a cadeia (`shared/fila.ts` → `worker/fila.ts` → `worker/main.ts` → `produtor-de-fila.ts` → `integracoes-bancarias.module.ts`) e adverte: *"uma fila nova não é um arquivo … omitir qualquer um deixa o processador de pé sem consumir nada."*

### ⚠️ Correção material ao card, medida em `apps/api/test/alcance-da-fila.spec.ts`

A §3.6 do card diz que a task *"acrescenta `integracoes-bancarias.module.ts` ao primeiro conjunto e `certificado.service.ts` ao segundo"*, e que **"as duas listas sobem no mesmo diff"**. A medição confirma o efeito e **corrige o alvo**:

| O que o card nomeia | O que se edita de fato |
|---|---|
| `ARQUIVOS_QUE_NOMEIAM_O_MODULO` (`:216`) | ⚠️ **`IMPORTADORES_DO_MODULO_DA_FILA` (`:208`)** — a lista do card é **derivada** dela por espalhamento (`[...IMPORTADORES_DO_MODULO_DA_FILA, MODULO_DA_FILA].sort()`) |
| `ARQUIVOS_QUE_NOMEIAM_O_TOKEN` (`:242`) | ✅ igual — é lista literal |

**Por que isto importa e não é preciosismo**: um executor que procure `ARQUIVOS_QUE_NOMEIAM_O_MODULO` para editar encontra um *spread* e pode acrescentar o arquivo **nas duas**, produzindo duplicata e reprovando a igualdade — com mensagem que aponta o sintoma, não a causa. Vai ao prompt da T8 **como medição, não como palpite**.

### Dois números narrativos que a T8 tem de subir no mesmo diff

Exatamente a classe do **candidato a regra nº 12** (*número narrativo ao lado de constante asserida*), e desta vez detectados **antes** de virarem débito:

- `alcance-da-fila.spec.ts:222` — *"o dono que o provê e os **cinco** serviços que enfileiram"*. Com `certificado.service.ts`, passam a ser **seis**.
- `alcance-da-fila.spec.ts:205` — *"o **quinto** importador continua reprovando nominalmente"*. Hoje há **4** importadores; a T8 faz o quinto **real**, e a prosa (que fala do controle antivácuo, um importador não declarado) fica ambígua sem releitura.

### A ADR-0024 é o ponto onde a T8 pode errar com aparência de acerto

A carga desta fila **leva `empresaId`, e isso é conformidade** — a emenda de **2026-08-18** cobre exatamente o caso (*"quem enfileirou já detinha direito a ele"*: a sessão do Admin que registrou o certificado). ⚠️ **Não confundir com a entrada de fato de terceiro** (ADR-0035, a notícia bancária), onde a empresa é o **resultado** da travessia nominal e o campo **não existe** na carga. *"Pôr `empresaId` lá seria violação; pô-lo aqui é conformidade."* As duas convivem no mesmo processo de trabalho — e o card já antecipa a confusão, o que é sinal de spec madura.

### `D49 · F4/T16` — a T8 é a task que o gatilho aponta, e o card já sabe

O card manda **importar `cargaConferida`** de `apps/worker/src/tarefas/carga-da-tarefa.ts`, chamada como **primeira** instrução da borda, **antes** de `contextoDeTenant.executarCom` — *"é essa ordem que impede o trabalho de correr sem contexto e devolver vazio como se fosse sucesso"* — e adverte explicitamente: *"não escreva uma quarta cópia da tradução de `ZodError` em nome de campo"*. O `D49` registra as três existentes; **a T8 é a ocasião de avaliar o fecho**, e o prompt dela vai dizer isso.

---

## Derivação antecipada do lote T9 ‖ T10 — leitura pura, nenhum arquivo tocado

### T9 — Varreduras da saída real · `risk: high` · `gates: [qa, tech_review]` · **2 CTs** (CT-1024, CT-1033)

**Não escreve código de produção.** O card fixa a disciplina que decide a task, e ela é a mesma que já custou rodadas nas duas fatias anteriores:

> *"Todo caso de varredura tem **CONTROLE POSITIVO obrigatório** — o **mesmo objeto de função** aplicado ao alvo **e** a um controle com as agulhas plantadas **canal a canal**, com a lista afirmada por **igualdade**."*

E a cláusula que fecha a saída de emergência: *"Se uma varredura reprovar, o conserto é na produção — **nunca na asserção**."* É o P5 do Protocolo escrito dentro do card.

- **CT-1024** — os **seis** desfechos das rotas tocadas, em **quatro canais** (corpo, cabeçalho, diário e documento publicado). Nenhum carrega material de certificado ou senha.
- **CT-1033** — o dialeto do provedor varrido **com e sem** o portador: ele aparece **exclusivamente dentro** de `diagnostico`, e em lugar nenhum mais.

⚠️ A T9 depende de **T2 + T7 + T8** por razão material, não formal: *"os seis desfechos das rotas tocadas precisam **existir** para serem varridos"*.

### T10 — Degradação, percurso e fecho do índice · `risk: low` · **`gates: [qa]` apenas** · **2 CTs** (CT-1042, CT-1046)

- **CT-1042** — com a entrega **desabilitada**, a conferência periódica liquida e estorna **igual**: as duas execuções comparadas **por igualdade**, não por *"ambas funcionaram"*. É a prova de **ausência de acoplamento**.
- **CT-1046** — o percurso do cliente novo se conclui **inteiramente pela tela**, sem etapa que exija o servidor. É o CA-20, e a razão de ser da fatia.

#### O fecho do índice — medido antecipadamente, e a prescrição do card **confere**

| O que | De | Para | Conferência de agora |
|---|---|---|---|
| ADRs registradas / `accepted` | 35 / 28 | **36 / 29** | ✅ **medido**: 36 arquivos em `docs/adr/`, e a distribuição fecha — **29 `accepted`**, 3 `deprecated`, 4 `superseded-by`. A `0036` está `accepted`, datada de 2026-08-21 |
| Contagem da suíte | 1737 casos | remedida por pacote | pré-T7 já em **1788**; a T7, a T8 e a T9 ainda acrescentam |

**O que a T10 NÃO refaz**, e o card é explícito: ❌ a linha do `D64` no índice (saiu na **T2**) · ❌ a contagem da superfície 105/90/20 (sobe na **T7**, no mesmo diff da constante). *"Refazer qualquer uma seria mexer no que já está fechado."*

#### As duas correções do `tech_spec.md` que a T10 carrega

Ambas nasceram **depois** de o tech spec fechar e estão declaradas por escrito no `task_plan.md` — escrituração de fecho, **não** reabertura de spec (a §21.4 do próprio tech spec já registra o precedente):

1. §19/§19.5 — *"33 casos, CT-1014 a CT-1046"* → **34 casos, CT-1014 a CT-1047**. A cobertura CA→CT **permanece 21/21**: o `CT-1047` ancora-se em **CA-01** e não cria CA novo.
2. §19.7 linha **A1** — a afirmação de que o `CT-1045` exige privilégio foi **refutada por medição** em 2026-08-21; o caso roda sem privilégio pelo mecanismo de extração do `ct_647`, e a bateria completa está barrada pela **ADR-0006**, não pela senha.

⚠️ A T10 é também onde entra a **renumeração do `CT-1022` colidido** (`D6`) para o primeiro número realmente livre.

### Paralelismo do lote

T9 e T10 são **as duas marcadas paralelizáveis** na Fase 3, e as dependências são idênticas (T2, T7, T8). O guard que se aplica é o **de recursos de teste**: os dois QAs **serializam**, porque ambos rodam suíte de `apps/api` e a T9 varre a saída real das mesmas rotas. A execução dos executores pode correr junta — a T9 não escreve produção e a T10 toca sobretudo documentação e um E2E de percurso.

---

## Conferência das duas pontas do índice de débito — feita agora, e não no fecho da fatia

> A `.claude/rules/nao-regressao.md` §3-B manda conferir **no fecho de fatia**. Antecipei porque o custo é uma medição e o benefício é não descobrir um índice torto quando já não houver task para corrigi-lo — foi assim que a F1 pegou um par `Dnn · F{n}/T{n}` errado.

**Sentido 1 — marcador → registro.** Esta fatia emitiu **um** `DÉBITO COM GATILHO`: `D1 · F5/T1`, em `packages/cobranca-bancaria/src/conversao-do-material.ts` (junto de `executarOConversor`). O campo `ÍNDICE` aponta para `…/_run/run-report.md §2, D1`, e lá existe `### D1 · baixo · tests · T1 · executor` — **a origem do cabeçalho bate com a linha do `CLAUDE.md`** (`F5/T1`). ✅

**Sentido 2 — índice → marcador.** A linha do `D64` **saiu** do bloco do `CLAUDE.md` junto com o marcador que a T2 removeu ao pagar o débito. ✅

**O saldo é 32 → 32, e o número declarado continua correto** — mas **por compensação, não por acaso feliz**: a T2 removeu uma linha (`D64`, pago) e a T1 acrescentou outra (`D1`, novo). Medido por `diff` do bloco contra `82874d0`: exatamente **uma** linha trocada. O parágrafo *"São **32**"* segue verdadeiro, e a tabela — que a própria rule declara ser a fonte — tem 32 linhas.

**Menção conferida e absolvida**: `packages/cobranca-bancaria/test/material-de-teste.ts:120` cita `D64 · F4/fechamento` em prosa de docblock, explicando por que a AC entrega em `RC2-40-CBC`. **Não é falso órfão** — a forma que a checagem do sentido 2 varre é `**Dnn** (F{n}/T{n})`, e esta não é ela. O `CT-907` de `packages/shared/test/protocolo-antirregressao.spec.ts`, que afirma as duas pontas **por `fs`**, está verde nos 263 casos de `@sysloc/shared`.

⚠️ **Nota para o fecho (T10)**: 95 arquivos carregam marcador vivo contra 32 débitos no índice, e **isso não é contradição** — um débito pode ter marcador em vários arquivos, e o `D28 · F0/T5` declara isso por escrito (*"a contagem sai do comando, que não envelhece"*). Não "corrigir" o número do bloco para 95.

---

## Medição independente das âncoras da T7 — feita contra a BASELINE, não contra o working tree

> ⚠️ **Por que contra `f5bdb296` e não contra o disco**: o executor está escrevendo agora. Medir o working tree devolveria estado intermediário e eu concluiria sobre um alvo em movimento. A baseline é imóvel por construção — é a mesma razão por que ela existe.

Esta medição é **cruzamento**, não substituição: a §5.2 manda o executor conferir por busca e declarar o que encontrou; eu meço em paralelo para poder confrontar a declaração dele com um número que não veio dele.

### O que confirma o que eu já havia passado no prompt

| Constante | Arquivo:linha | Hoje | Esperado |
|---|---|---|---|
| `ROTAS_PUBLICADAS_EM_PRODUCAO` | `cobertura-de-autorizacao.e2e.spec.ts:2319` | **103** | 105 |
| `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` | `:2666` | **88** | 90 |
| `PARES_PUBLICOS_DA_SUPERFICIE` | `:3009` | **20** | 20 (as duas rotas exigem sessão) |
| `ROTAS_DESCRITAS` | `contrato-publicado.e2e.spec.ts:311` | **46** | 48 ✅ *o `:311` que passei ao executor confere exatamente* |

### ⚠️ O que eu **não** havia visto, e que muda o trabalho da T7

**1. `ROTAS_DESCRITAS` não é um número solto — é uma soma de partições nomeadas, e o padrão obriga uma sexta.**

O docblock declara `46 = 33 + 8 + 1 + 1 + 3`, e a quinta partição (`ROTAS_DA_FUNDACAO_BANCARIA = 3`) nasceu com um `SUT_IS_CORRECT_BECAUSE` explicando por que a fatia anterior a acrescentou em vez de mexer no total. **A T7 deve seguir o mesmo molde**: uma partição própria com valor 2, o total indo a 48, e a subtração continuando a provar que nenhuma linha das partições anteriores saiu. Trocar só o `46` por `48` seria a forma frouxa do mesmo acerto.

**2. `ROTAS_DE_ESCRITA = 12` NÃO cresce — e o repositório já antecipou por escrito quem tentaria "corrigi-la".**

O docblock (`:336-345`) diz, textualmente:

> *"A fatia é **nomeada**, e o número não cresce com as rotas de contrato: quem ele ancora é a tabela `rotasDeEscrita`, montada sobre o cenário daquelas seis entidades. **Sem o nome da fatia, o `12` pareceria descrever a superfície inteira e convidaria a próxima task a 'corrigi-lo' para cima, afrouxando a âncora em vez de acrescentar a tabela que falta.**"*

A rota de ativação da T7 **é** uma escrita (`POST`), de modo que a constante parece dever crescer — e não deve. **Se o diff da T7 tocar `ROTAS_DE_ESCRITA`, é regressão de âncora (R2)**, e eu a pego no cruzamento antes de despachar o Gate 1. Registro aqui para que a verificação não dependa de eu lembrar.

> **Nota de método**: este é o segundo caso na fatia em que uma constante se defende sozinha pelo docblock — o primeiro foi o `ESQUEMA_DO_CORPO_VAZIO`, que me fez construir um alerta errado. A diferença é que ali o docblock estava **defasado** (dizia "quatro" onde havia nove) e aqui está **certo e profético**. A lição não é "confie no docblock" nem "desconfie": é **meça a constante, leia o docblock para saber o que ela significa**.

---

## ⚠️ Medição que muda a natureza do `D29` — a variável que a correção pressupõe **não existe**

Medido contra a baseline `f5bdb296`, com `git grep` sobre a árvore imóvel:

```
enderecoDaEntregaDaNoticia  →  packages/cobranca-bancaria/src/adaptador-sicoob.ts:337, :658, :1689
                                packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts:1169
                                (e MAIS NADA em apps/ ou packages/)
ENDERECO_DA_ENTREGA_*       →  ZERO ocorrências em apps, packages e deploy
```

**O campo existe só como opção da config do adaptador.** Não há variável de ambiente correspondente — nem em `apps/api/src/configuracao/ambiente.ts`, nem em `apps/worker/src/main.ts`, nem no `apps/api/vitest.config.ts`.

### O que isso faz com a prescrição do Gate 2

O veredito da T6 endereçou à T7: *"exigir `enderecoDaEntregaDaNoticia` na **conferência de partida** (`apps/api/src/configuracao/ambiente.ts`) sempre que o serviço de entrega for registrado"*. A prescrição **pressupõe uma variável que ainda não nasceu**. Fechar o `D29` de verdade custa uma cadeia, não uma linha:

| # | Ponto | Por quê |
|---|---|---|
| 1 | esquema de `ambiente.ts` (`:319`, junto de `ENDERECO_DE_AUTORIZACAO_BANCARIA`) | é onde a exigência se declara |
| 2 | o tipo publicado (`:410`) e o mapeamento (`:659`) | senão o valor não chega a quem compõe |
| 3 | ⚠️ **`apps/api/vitest.config.ts` (`:128-132`)** | **toda a suíte de `api` sobe pela conferência de partida** — variável nova e obrigatória sem entrada aqui reprova os 357 casos de uma vez |
| 4 | `apps/worker/src/main.ts` (`:441-444`) | **se** o worker compuser o adaptador para a entrega — a **T8** é quem o fará |
| 5 | o `EnvironmentFile` em `deploy/` | senão o processo real recusa subir, que é exatamente o comportamento pedido, mas na hora errada |

### Decisão auto-resolvida (A1) — não interromper o executor em voo

**A pergunta**: mando esta medição ao executor por `SendMessage` agora, ou registro e uso no cruzamento?

**Alternativas**: (a) enviar agora, para ele decidir informado; (b) registrar e confrontar depois.

**Adotada: (b), a recomendada.** Razão: o ponto 3 é **autofalsificante** — se ele criar a variável obrigatória sem tocar o `vitest.config.ts`, os 357 casos de `api` reprovam ruidosamente e ele corrige sozinho; a rede já existe e não depende de aviso meu. E interromper um executor com 1 MB de transcrito por uma medição que ele mesmo fará arrisca mais do que ganha.

**O que fica combinado comigo mesmo**: se o relatório dele **adiar** o `D29`, a razão tem de ser esta cadeia — e não *"não deu tempo"*. Se **fechar**, confiro os cinco pontos um a um. Nos dois casos o número que eu comparo já está escrito aqui, antes de eu ler o relatório dele — que é o que impede a medição de se acomodar à resposta.

### E o `D51 · F4/T16` fica confirmado como disparado — se o arquivo for aberto

O texto literal do marcador (`apps/worker/src/main.ts:254`) é mais específico do que eu havia registrado: *"**QUANDO FECHA**: a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts` **por outra razão**, ou o TERCEIRO processo que exigir qualquer uma das duas variáveis."* A T7 abrindo o arquivo pelo `D29` **é** essa task, por outra razão. O que o débito manda subir para `packages/shared/src/ambiente.ts` são `ehChaveDeCifraAceitavel` e `ehDiretorioGravavel` com as três constantes que as acompanham — e o marcador **autodeclara não ser uma `DECISÃO FECHADA`**, o que autoriza mexer no código sob ele.

### Verificação de progresso da T7 — por metadados, com o executor ainda em voo

Medido sem ler conteúdo (`git status --porcelain` e `git diff --stat`), enquanto ele trabalha:

- **Produção nova existe**: `entrega-da-noticia.controller.ts` (16,7 KB) e `entrega-da-noticia.service.ts` (20,4 KB).
- **`apps/api/src/configuracao/ambiente.ts` FOI aberto** (+67 linhas) — o `D29` está sendo fechado, e o **`D51 · F4/T16` disparou de fato**. A derivação que o Gate 2 da T6 marcou como *"hipótese, não fato medido"* **virou fato**.
- ✅ **`apps/api/vitest.config.ts` também foi tocado** (+12 linhas). **É o ponto 3 da cadeia** que eu havia identificado como o que reprovaria os 357 casos de `api` de uma vez — e ele o achou **sozinho**, sem aviso meu.
- `apps/api/test/ambiente.spec.ts` tocado — indício da asserção *"onde ela possa falhar"* que o Gate 2 cobrou nominalmente.
- ⚠️ `apps/worker/src/main.ts` e `packages/shared/src/ambiente.ts` **intocados** — sinal de que o `D51` **disparou mas não foi fechado**. Isso pode ser legítimo (fechá-lo alargaria o escopo para dois processos e o pacote compartilhado), mas **a razão tem de estar no relatório**, e é o que vou cobrar no cruzamento.
- A suíte `apps/api/test/entrega-da-noticia.e2e.spec.ts` **ainda não existe** — ele está no meio do trabalho.

> **A decisão A1 de não interromper fica validada por medição, e não por opinião.** O argumento que a sustentou era que o ponto 3 é autofalsificante e que a rede já existia sem aviso meu. O executor tocou exatamente aquele arquivo. Registro porque o inverso — ter interrompido e depois atribuir o acerto ao aviso — seria indistinguível daqui a uma semana.

---

## T7 — relatório do executor e CRUZAMENTO contra as verificações pré-registradas

- **Duração**: 4818 s · 170 tool_uses · 541.722 tokens · **4 criados, 12 modificados**
- **`attempt_sha`**: `4db8ef27d10d4ffcffd5c168ab9bd36b052509c9` (índice temporário via `GIT_INDEX_FILE` + `git write-tree` + `git commit-tree`; o índice real do repositório **não foi tocado**)
- **Suíte**: `api` **357 → 370** (+13); os outros 8 pacotes inalterados. **Total 1788 → 1801.** `pnpm build` e `pnpm lint` verdes.

### As cinco verificações que eu registrei ANTES de ler o relatório — todas medidas por mim, não aceitas do relato

| # | Verificação | Resultado |
|---|---|---|
| **V1** | `ROTAS_DE_ESCRITA = 12` intocada | ✅ **nenhuma linha do diff a toca**; segue em `12`. Ele **não caiu** na armadilha que o próprio docblock previu — e a rota de ativação **é** um `POST` |
| **V2** | `ROTAS_DESCRITAS` pelo molde da partição nomeada | ✅ **exato**: `46 → 48`, sexta partição `ROTAS_DA_ENTREGA_DA_NOTICIA = 2`, `SUT_IS_CORRECT_BECAUSE` presente, e — o que eu **não** havia previsto — ele **preservou** `ROTAS_DA_FUNDACAO_BANCARIA = 3` excluindo as rotas novas do filtro por prefixo, com a razão escrita: *"ampliar de três para cinco apagaria o retrato"* |
| **V3** | as três âncoras | ✅ `105` / `90` / `20`, mais `ROTAS_PUBLICADAS_NO_MUTANTE` `97 → 99` |
| **V4** | `D29` — se fechado, os cinco pontos da cadeia | ✅ **FECHADO, e a cadeia dele é MAIOR que a minha derivação**: `ambiente.ts` (esquema + tipo + mapeamento) · `vitest.config.ts` · **`.env.example`** · **`deploy/scripts/instalacao/provisionar-base.sh`** — os dois últimos eu não havia listado |
| **V5** | `D51` — se adiado, a razão tem de ser a cadeia | ✅ **adiado com razão medida**, e verifiquei o essencial: o diff **não toca** `ehChaveDeCifraAceitavel`, `ehDiretorioGravavel` nem as três constantes; o marcador segue vivo e íntegro em `apps/worker/src/main.ts` |

> **O que a V4 revela sobre a asserção**: ele **não criou CT novo** para o `D29`, e a razão se sustenta e é **executável** — o `CT-007` de `ambiente.spec.ts` é `it.each(VARIAVEIS_EXIGIDAS)`, de modo que a variável nova passou a ser cobrada **automaticamente** por ausência e por cadeia em branco. A prova de que isso não é conveniência é a contagem: **1 dos +13 casos é exatamente esse `it.each` crescendo**. A asserção onde ela pode falhar existe, e o número a demonstra.

### ⚠️ Defeito de escrituração que o cruzamento pegou — e corrigi

O executor numerou os dois débitos novos como **`D1 · F5/T7`** e **`D2 · F5/T7`**, reiniciando a sequência dentro da task. A §3-B é explícita em contrário: *"o número seguinte sai da **§2 da fatia corrente**"*, e o precedente é literal (*"o débito descoberto no fecho da F1 é o D38 porque o último do run daquela fatia era o D37"*).

**E aqui não era questão de estilo — o ponteiro estava quebrado.** O campo `ÍNDICE` do novo `D1 · F5/T7` apontava para `run-report.md §2, D1`, onde o `### D1` já é o débito da conversão do material (T1). Dois cabeçalhos `### D1` no mesmo arquivo tornam o ponteiro **irresolvível**, e é diferente dos `Dnn` homônimos que o repositório tolera — aqueles vivem em fatias **diferentes**, com `ÍNDICE` apontando para arquivos diferentes.

Renumerados para **`D31`** e **`D32`** nas três pontas, no mesmo passo: marcador (2 arquivos), índice do `CLAUDE.md` (2 linhas) e §2 (escriturada agora). Verificado: **zero resíduos** de `D1 · F5/T7` / `D2 · F5/T7` em `apps`, `packages` e `CLAUDE.md`.

### ⚠️ Erro MEU que o executor corrigiu, e que precisa ficar registrado

A decisão auto-resolvida nº 5 dele contraria uma instrução minha explícita: eu havia escrito no prompt *"não edite o índice do `CLAUDE.md` você mesmo para débito"*. **Ele editou, e estava certo.**

A razão que ele mediu: o `CT-907` de `packages/shared/test/protocolo-antirregressao.spec.ts` — a **barreira executável** do Protocolo — ficou **vermelho** com o marcador emitido e a linha do índice ausente. Minha instrução criava uma janela em que o marcador existe sem a linha, que é **exatamente** o estado que a §3-B chama de mentira e que o `CT-907` afirma por `fs`.

**A instrução estava errada, não o executor.** O que eu queria proteger — a §2 do `run-report`, que é minha — não exigia proibir o índice; são coisas diferentes, e ele preservou a distinção certa (*"a §2 continua sendo do orquestrador"*). Fica a correção de método: **marcador e linha de índice são um par atômico e saem juntos, por quem emite o marcador**; o que o orquestrador escritura é a §2.

### Decisões auto-resolvidas do executor que os gates precisam avaliar

1. ⚠️ **`CT-1026` reancorado** — como escrito no card, ele só se distinguiria do `CT-1035` lendo o **código** da recusa do cadastro, e *"o modelo canônico da porta proíbe por escrito qualquer ramo que compare `codigo`"* (ADR-0001). Ele reancorou no eixo *"o provedor não respondeu"* (motivo nulo), preservando a invariante do caso (`consulta: 0` contra `1`) e deixando a RN-05 inteira no `CT-1035`. **É divergência de spec com razão arquitetural — vai ao prompt dos dois gates nominalmente.**
2. **Casa compartilhada nova** `apps/api/test/par-do-provedor.ts` (391 linhas) em vez de importar de um `.spec.ts` — porque importar de suíte **executa o módulo dela e registra os casos dentro da importadora**. Razão mecânica, não preferência.
3. `CT-1029` pede *"uma terceira empresa da carga"* que não existe (a carga tem duas) → criadas pelas rotas reais do Master, em vez de apagar linha existente (*"reproduziria estado que a produção não alcança"*).
4. Autoridade certificadora **única** por caso — medido: com duas, **8 casos ficaram vermelhos pelo motivo errado** (aperto de mão caindo por cadeia divergente).

### Achados colaterais do executor

- **Limiar de Três aplicado onde disparou, adiado onde não**: `MENSAGEM_SEM_CERTIFICADO` e `DISCRIMINADOR_DA_VALIDADE` **subiram** para `certificado.service.ts` (terceira cópia impedida de nascer); as outras seis ficaram no `D31` com gatilho. É a leitura certa da regra.
- **Décima quarta anotação consecutiva do `D26 · F2/T6`**: três âncoras fora da §5.2 (`contexto.e2e.spec.ts`, `validacao.spec.ts`, `ambiente.spec.ts`) **descobertas por execução**, não por busca textual. O executor registrou que a execução é mais confiável que o `grep` para este fim — e os dois candidatos da §5.2 que ele **descartou** (`campos-fechados`, `autorizacao`) foram descartados com razão medida, não por omissão.

---

## T7 — Gate 1 (QA) rodada 1 · veredito **REJEITADO**

- **Agente**: `agent-spec-qa-validator` · `opus` · 743,9 s · 39 tool_uses · 307.312 tokens
- **`scan_scope`**: FULL (rodada 1) · **suíte completa verde nos 9 pacotes**, medidos um a um: **1801 casos**
- **Critérios**: 14/16 · **1 ALTO** (bloqueia) · 4 BAIXOS · 0 CRÍTICOS · 0 MÉDIOS · `security_flags` **vazio**

### As cinco verificações que eu havia medido — o QA CONFIRMOU as cinco, independentemente

E em duas delas foi **mais fundo do que eu**:

- **V2**: auditou o filtro `daFundacaoBancaria` linha a linha e concluiu que a alteração **endurece**, não afrouxa: a partição nova é afirmada por si **antes** de qualquer subtração; o `&& !caminho.includes('/entrega-da-noticia')` **preserva** o `3` — retrato de fatia fechada — em vez de inflá-lo para 5; e a soma final continua comparada por igualdade. *"Nenhum valor caiu, nenhum `toEqual` virou `toContain`, nenhum literal exato virou faixa."*
- **V4**: o argumento do executor sobre não criar CT para o `D29` era **falsificável, e foi falsificado a favor dele** — o `it.each` gerou exatamente o caso a mais que fecha a decomposição do +13. E achou o que eu não tinha visto: `EXIGIDAS_SEM_PROVISIONAMENTO` só continua `[]` **porque** o `provisionar-base.sh` ganhou a semeadura, *"o que torna as duas pontas do `D29` mutuamente verificáveis"*.

### O bloqueante — `ALTO-001` · `tests` · `happy_path_only`

**A combinação `cadastro ACEITO + consulta NEGATIVA` não é exercitada por caso algum.** O QA mapeou as cinco combinações do ciclo e mostrou que os 11 casos cobrem quatro.

Duas consequências medidas, e **nenhuma implica a outra**:

1. *"Um SUT mutado para `habilitada = cadastro.aceito || confirmacao.aceito` passa os 370 casos de `api` verdes"* — a suíte **não pode falhar** por essa regressão. É teste decorativo pela Iron Law #1.
2. O ramo `motivo: (cadastro.aceito ? null : cadastro.motivo) ?? confirmacao.motivo` (`entrega-da-noticia.service.ts:342`) **nunca é executado** — de modo que a publicação do motivo da **confirmação**, o único caminho pelo qual ele chega ao Admin, não tem rede alguma.

**O impacto operacional é o risco R6 do tech spec com o sinal invertido**: o produto declararia a entrega habilitada com base só no cadastro, o Admin fecharia a tela acreditando que o banco avisa o produto, **e a notícia nunca chegaria**.

⚠️ **O QA fechou por antecipação a defesa óbvia**: *"isto NÃO é consequência necessária da divergência declarada do AT-3 — o cenário é montável no par que a suíte já sobe, sem comparar `codigo`"*, e deu a receita executável.

> **A lição da T6 foi aplicada, e aplicada com o corolário certo.** O QA perguntou o que o caso ausente provaria: a resposta foi *"uma regra que existe no código, está correta, e não tem quem a prenda"* — garantia **presente**, prova ausente. Por isso classificou `tests`/`happy_path_only` e **não** elevou a `security`. É exatamente a distinção que o candidato a regra nº 13 pede, exercida nas duas direções.

### O AT-3 NÃO foi tratado como defeito — e a razão importa

O QA verificou ponto a ponto a divergência declarada do executor e a **manteve**: distinguir *"recusa por vaga ocupada"* de *"recusa por outra razão"* exigiria comparar `motivo.codigo`, e `modelo-canonico.ts:481` **proíbe por escrito** *"qualquer ramo que compare `codigo`, case `mensagem` ou alcance uma chave de `diagnostico`"*. Verificou que (i) a invariante do `CT-1026` sobrevive e discrimina, (ii) a **RN-05** segue inteira no `CT-1035`, (iii) o caso não pode aprovar por outra razão. Conclusão dele: *"pendência de spec, não de código"* — a §4 e a §6.5 do card prescrevem um eixo que a arquitetura fecha.

### Os 4 BAIXOS — todos `documentation`, todos nascidos NESTE diff

| # | O quê |
|---|---|
| **BAIXO-001** | o `describe` diz *"as 46 rotas"* com `ROTAS_DESCRITAS` já em **48** — ⚠️ **é o candidato a regra nº 12 acontecendo ao vivo**, e o QA citou a rule pelo nome |
| **BAIXO-002** | ponteiro falso: `validacao.spec.ts` diz que a recusa da chave desconhecida é provada em `entrega-da-noticia.e2e.spec.ts`; a prova real está em `esquemas.spec.ts:5039` (CT-1044, da T5) |
| **BAIXO-003** | o cabeçalho ainda rastreia `CA-04` ao `CT-1026`, que após a reancoragem não prova mais integridade de motivo |
| **BAIXO-004** | ⚠️ **o marcador `D32` diz "DUAS vezes cada"; `entrarComSegundoFatorCumprido` tem SEIS cópias** — medido pelo QA. O gatilho do Limiar de Três **já havia disparado** antes desta task |

### Decisão auto-resolvida (A1) — os 4 BAIXOS vão JUNTO na correção

**A pergunta**: corrijo só o bloqueante (regra do ciclo curto, *"um bloqueante, uma mudança"*) e escrituro os 4 BAIXOS como débito, ou levo tudo na mesma rodada?

**Alternativas**: (a) só o ALTO, 4 débitos novos; (b) ALTO + os 4 BAIXOS.

**Adotada: (b), a recomendada.** Razão: a regra do ciclo curto mira **superfície de regressão** — *"cada linha do diff que não serve à correção é superfície de graça"* —, e os quatro são **uma linha de prosa cada, criados neste mesmo diff**, sem alcance sobre comportamento. Somam-se duas razões concretas: o `BAIXO-003` toca **o mesmo cabeçalho** que a correção do `ALTO-001` vai editar (o próprio QA sugeriu juntá-los), e o `BAIXO-001` é a classe de defeito que **nove dos trinta e dois débitos desta fatia** já representam — escriturá-lo como débito seria criar o trigésimo terceiro exemplar de um padrão que a fatia já documentou à exaustão.

⚠️ **O `BAIXO-004` tem uma ponta que é minha**: o texto do marcador é do executor, mas o bloco `### D32` da §2 foi escriturado por mim com o mesmo número errado. **Corrijo a §2 na mesma passagem** em que ele corrige o marcador — as duas pontas ou nenhuma.

### Candidato a regra novo — **RC-001**, o 14º da fatia

`repeated_fixture`: *"acessório de arranjo de sessão nasce em `apps/api/test/acessorios-de-borda.ts`, e nunca como função privada de um arquivo `.spec.ts`"*. Evidência medida: `entrarComSegundoFatorCumprido` em **seis** suítes. E o QA nomeou a causa estrutural, que é a mesma que o `CLAUDE.md` já registra: *"quem duplica copia de UMA vizinha, para ele é sempre a segunda cópia, e o gatilho nunca dispara"*.

---

## T7 — correção rodada 2 · aplicada e verificada por mim antes do gate

- **Agente**: `sysloc-backend-implementer` · `opus` · 1054,5 s · 55 tool_uses · 232.251 tokens
- **`attempt_sha` rodada 2**: `f712a58b189ddb03a29ef48d327660fa0ac19e59`
- **Delta contra a rodada 1**: **3 arquivos**, +107/−28 — `entrega-da-noticia.e2e.spec.ts`, `contrato-publicado.e2e.spec.ts`, `CLAUDE.md`
- ✅ **Zero produção no delta**, medido por `git diff --name-only … -- apps/api/src packages/*/src` (saída **vazia**), e confirmado por `sha256sum`: o controlador e o serviço estão **byte a byte** iguais aos da rodada 1. Era a exigência central — *"a garantia existe e está correta; o que falta é o caso que a prende"*.

### O cenário faltante, verificado por leitura do código e não do relato

O trecho (b) entrou no **próprio `CT-1026`** (número herdado, nenhum CT inventado). A asserção discriminante é o `toEqual` do corpo inteiro:

```ts
expect(publicado).toEqual({
  habilitada: false,
  verificadaEm: publicado.verificadaEm,
  motivo: { ...motivoDaConfirmacao, diagnostico: null },
});
```

E o comentário ao lado declara **por que ela pode falhar**, que é a prova de raciocínio que o P4 pede para asserção comportamental: *"trocar `habilitada = confirmacao.aceito` por `cadastro.aceito || confirmacao.aceito` deixaria TODOS os outros casos deste arquivo verdes e só este sairia `habilitada: true`"*. Mais `par.chamadas.consulta` em **1**, contra o **0** do trecho (a) — o eixo que separa os dois.

### ⚠️ O executor DIVERGIU da prescrição do gate, e melhorou-a

O Gate 1 prescreveu `par.responderAConsulta({ …, corpo: corpoDeCadastroNaoEncontrado() })`. O executor mediu que **com a lista vazia o adaptador devolve `motivo: null`** (`adaptador-sicoob.ts:2058`) — de modo que a igualdade profunda sobre *"o motivo que a CONSULTA emitiu"*, **exigida pelo próprio achado**, viraria `null ?? null` e seria inexprimível. Trocou por recusa com motivo (`422` + corpo), **sem nenhum ramo comparar `codigo`** — só o status.

> É a **sexta confirmação** do precedente de método já registrado no `CLAUDE.md`: *prescrição de gate é hipótese, não ordem* — e o executor que divergiu **declarando e medindo** teve razão outra vez. Aqui a prescrição literal teria produzido uma asserção que **não prova o que o achado pedia**.

### Os 4 BAIXOS

| # | Desfecho |
|---|---|
| **BAIXO-001** | corrigido, e **alcançando as seis** menções que este diff tornou falsas — não só o `describe`. Razão dele: *"corrigir uma e deixar cinco não fecha a classe que a `ancoras-de-superficie.md` nomeia"* |
| **BAIXO-002** | corrigido — ⚠️ **e o gate errara a localização**: o texto vivia em `contrato-publicado.e2e.spec.ts:1065`, não em `validacao.spec.ts:473`. Verifiquei: `validacao.spec.ts` **não menciona** a suíte nova. A citação literal do gate estava certa, o arquivo não |
| **BAIXO-003** | resolvido pela via que o próprio achado autorizava: o `CA-04` **fica**, agora com a origem explicitada no trecho (b) |
| **BAIXO-004** | corrigido com número medido, **débito não fechado** — abrir cinco suítes alheias num diff de correção é a superfície que a §4.5 proíbe |

**E ele recusou uma correção, com razão que confere**: `"hoje são 41"` no registro do mutante MT11-2 **já estava defasado antes deste diff**, é registro datado de 2026-08-06 e é **auto-desarmante** (a própria frase diz que quem carrega o número é a âncora). Tocá-lo seria o *"aproveitar que estou aqui"* da §4.5. ✅ **Concordo** — é a distinção entre corrigir o que se quebrou e varrer o que se encontrou.

### A ponta que era minha — o bloco `### D32` da §2

Corrigido agora, e a correção **inclui a confissão do erro**: eu escriturei *"duas vezes cada"* copiando o marcador **antes** de o Gate 1 medi-lo. As três pontas (marcador, índice do `CLAUDE.md`, §2) concordam em **seis**.

### ⚠️ A contagem de `api` NÃO subiu — e isso é conforme

`370 → 370`, 41 arquivos, **11 `it`** no arquivo novo. O cenário entrou como **segundo trecho** de um caso existente, que é o que o achado prescreve e o que o card exige (*"não invente número de CT novo"*). O que cresceu foi o **conjunto de asserções**, não o de casos. O executor mediu apenas `api` e `shared` — e a escolha de `shared` é correta e não óbvia: o `CLAUDE.md` está no delta, e é `packages/shared/test/protocolo-antirregressao.spec.ts` (CT-501 a CT-510) que o afirma por `fs`.

---

## T7 — Gate 1 (QA) rodada 2 · veredito **APROVADO_COM_OBSERVACOES**

- **Agente**: `agent-spec-qa-validator` · `opus` · 392,1 s · 25 tool_uses · 135.879 tokens
- **Critérios: 21/21** · **0 CRÍTICOS, 0 ALTOS** · 1 MÉDIO **anotável** · 2 BAIXOS · `security_flags` vazio
- **`scan_scope` DELTA** mantido, com o raio determinado por razão **mecânica**, não por economia: *"os dois arquivos tocados são `.spec.ts`, e arquivo `.spec.ts` não é importável nesta base — importá-lo executaria o módulo e registraria os casos da suíte dentro da importadora, que é a razão pela qual o próprio `D32` existe. Ninguém os consome."*
- **P5**: `api` **370/370** · `shared` **263/263**, medidos por pacote. E ele registrou o que torna a medição confiável: *"a tarefa `test` do `turbo.json` declara `cache: false`, de modo que a execução é real e a comparação não é replay de cache."*

### O bloqueante está SANADO, e o gate provou os dois mutantes

| Mutante | Por que reprova agora |
|---|---|
| `habilitada = cadastro.aceito \|\| confirmacao.aceito` | este cenário sairia `habilitada: true`, e o `toEqual` do corpo reprova. **Nenhum outro caso do arquivo reprova com essa mutação** — era exatamente a lacuna |
| remover o `?? confirmacao.motivo` | publicaria `motivo: null` e a igualdade profunda reprova |

E confirmou a **observabilidade da origem** do motivo lendo o serviço: como o cadastro foi aceito, `(cadastro.aceito ? null : cadastro.motivo)` resolve em `null`, *"logo o `{ codigo: '10404', … }` que aparece no corpo só pode ter atravessado o segundo lado do `??`"*. **É o único caso da suíte que prende esse lado** — o `CT-1030` prende só o primeiro.

### A divergência do executor foi APROVADA no mérito, com o adaptador lido na fonte

> *"`consultarEntrega` devolve literalmente `corpoUtil(texto) === null ? { aceito: false, motivo: null } : { aceito: true }`. Com lista vazia o motivo é `null` por construção, de modo que a igualdade profunda sobre 'o motivo que a CONSULTA emitiu' — **exigida pelo meu próprio achado** — seria `null` comparado a `null` e não discriminaria nada. **A prescrição era, portanto, inexequível como escrita.**"*

### Anti-gaming conferido POR LEITURA, como pedi

A contagem não subiu, então a contagem não servia de prova. O gate filtrou o diff por `^-.*(expect|it\(|describe\()` e achou **uma única linha removida**: a renomeação de prosa do `describe`. Zero `skip`/`only`/`todo` nas duas rodadas; 11 `it(` nas duas; as 28 remoções são integralmente reescrita de tabela, marcador, docblock e índice.

### Os dois erros de gate, ambos reconhecidos por quem os cometeu

- **O QA reconheceu o dele**: *"reconheço o meu erro de localização da rodada 1: apontei `validacao.spec.ts:473` e o texto vivia em `contrato-publicado.e2e.spec.ts:1065`"* — e conferiu que o ponteiro novo é **verdadeiro**, achando o `CT-1044` em `esquemas.spec.ts:4947`.
- **E apanhou o meu, na outra ponta**: a §2 do `D32` teve o **corpo** atualizado por mim, mas os campos `Gatilho` e `Por que não agora` ficaram na redação antiga — *"contradizendo o corpo do mesmo bloco, que declara o Limiar já disparado"*. **Corrigido agora**, e a correção aproveitou para escrever o que a medição realmente implica: **o gatilho é diferente por função**, porque a contagem é diferente. Só `entrarComSegundoFatorCumprido` já disparou.

### Achados novos — escriturados, nenhum bloqueia

- **`D33`** (MÉDIO anotável, `vague_existence_assertion` / AP-05): o carimbo do trecho novo é preso só por `typeof`, enquanto o `CT-1025` do mesmo arquivo usa o par completo com `Date.parse`. ⚠️ **O gate separou explicitamente afrouxamento de insuficiência**: *"não é afrouxamento de asserção existente — é asserção nova aquém da convenção que o próprio arquivo já pratica duas linhas antes"*. Verifiquei que `vague_existence_assertion` está no **conjunto de manutenibilidade** (`agent-spec-workflow-rules.md:628`) — anotável **por contrato**, não por conveniência.
- **`D34`** (baixo): o `"hoje são 41"` do mutante MT11-2, que o executor recusou corrigir e o QA **concordou** em adiar.

### Decisão auto-resolvida (A1) — o `D33` vira débito em vez de rodada 3

**A pergunta**: corrijo a linha do `Date.parse` antes do Gate 2, ou escrituro?

**Alternativas**: (a) escriturar como `D33` e despachar o Gate 2 sobre o `attempt_sha` aprovado; (b) editar a linha agora.

**Adotada: (a), a recomendada.** Razão: **o Gate 1 já aprovou este `attempt_sha`, e é ele que o Gate 2 revisa.** Editar entre os dois gates invalidaria a revisão em curso e obrigaria a revalidar o Gate 1 — uma rodada inteira de QA por uma asserção de parseabilidade cujo risco medido **já está preso no desfecho irmão** pelo `CT-1025`. O gatilho registrado é concreto e próximo: **a T8 abre esse arquivo**.

---

## T7 — Gate 2 (Tech Review) rodada 2 · veredito **PARCIAL** → rodada 3 aplicada

- **Gate 2**: `opus` · 502,1 s · 28 tool_uses · 186.500 tokens · **1 MÉDIO/`architecture` (bloqueante)** + 3 BAIXOS
- **Classificação verificada por mim antes de decidir**: `architecture` é **MÉDIO bloqueante** no Gate 2 (`agent-spec-workflow-rules.md:613`), e a **convergência C1 não o alcança** — ela vale para `MEDIO` convergível **inédito em rodada ≥ 3**, e o TR-P1 nasceu na rodada 2. Rodada 3 devida, sem margem de interpretação.
- **Correção rodada 3**: `opus` · 697,7 s · 48 tool_uses · 160.334 tokens · **0 criados, 5 modificados**
- **`attempt_sha` rodada 3**: `1c6b40af6bfec1e323c367e8782d3cba63b68512`

### O achado, e por que a correção certa NÃO era de lógica

O discriminador da presença era aplicado **só ao cadastro**. Cadastro aceito + consulta que não responde gravava `habilitada: false, motivo: null`, **apagando o estado de uma entrega de pé no provedor** — o mesmo dano que o próprio código argumenta evitar no ramo de cima, e contra a decisão **literal** de `modelo-canonico.ts:578-580`, cuja frase **não é qualificada por operação**.

⚠️ **O gate mediu no adaptador antes de prescrever**, e foi isso que salvou a correção: `motivo: null` na consulta está **sobrecarregado** — `adaptador-sicoob.ts:2058` o devolve também quando a consulta **respondeu e não encontrou cadastro**, que é o **caminho principal de desabilitação**. *"Tratar a confirmação sem motivo como 'não gravar' quebraria o caminho principal."* A informação que separa os dois casos **não existe na borda**.

> **O gate nomeou o custo real como o SILÊNCIO**: *"o cabeçalho do service é assertivo e extenso sobre o discriminador, e a próxima task o lerá como questão fechada — que é a regressão de decisão (R3) que o protocolo existe para prevenir."* É um achado `architecture` cuja correção correta é **registrar o limite**, não mudar o código — e é a leitura mais fina que um gate produziu neste run.

### Verificação independente da correção — a exigência central era "não tocar a lógica"

| Prova | Medição |
|---|---|
| linhas executáveis alteradas no serviço | **ZERO** — `diff` filtrado por linhas fora de comentário devolve vazio |
| `apurarDesfecho` | **idêntico** por `sha256sum` da função, ignorando comentários |
| parágrafo original do discriminador | **preservado byte a byte**; o título ganhou a qualificação *"— no CADASTRO, e só nele"* |

⚠️ **Meu primeiro filtro falhou e eu o refiz**: `git diff <commit> -- <path>` não vê arquivo **untracked** no working tree, e devolveu o arquivo inteiro como removido. Extraí o blob do `attempt_sha` anterior e comparei com `diff` — só então a medição virou prova.

### Os 3 BAIXOS

- **TR-P2** — a marca `⚠️ **JÁ DISPAROU (F5/T7)**` entrou na linha do `D51`, texto original preservado, no molde do `D28` e do `D20`. O gate nomeou o risco: *"sem a marca, a próxima task lerá o mesmo gatilho futuro, chegará à mesma conclusão de adiar, e o débito se torna indefinidamente adiável"*.
- **TR-P3** — docblock desalojado corrigido: o bloco novo fora inserido **entre** um docblock e a função que ele documenta, deixando `esquemasDoCertificadoDoProvedor` **sem docblock** e anexando o texto do certificado à função da entrega. Invisível ao compilador e à suíte.
- **TR-P4** — divergência anotada nos dois pontos, no molde do `D26`. O gate julgou a extensão **defensável no mérito** e cobrou só o registro.

### Achado do executor que virou o `D36` — e que eu confirmei e reforcei

Ao escrever a linha do índice, ele formulou a decisão (A1) *"encurto para os ~150 caracteres que o aviso pede?"* e **mediu antes de decidir**. Minha medição independente confirma e vai além do que ele relatou: **35 de 35 linhas** violam o critério; a **menor** tem **175** caracteres (ele estimou "acima de 300" para a região), a maior 356, a média 276. **Nenhuma linha jamais o observou.**

O custo é preciso: um critério que ninguém observa **não disciplina — apenas cria uma decisão a re-tomar toda vez que alguém escreve uma linha**. A recomendação escriturada é trocar o critério de **comprimento** por um de **conteúdo** (*"a linha aponta, não explica"*), que é o que o aviso de fato quer dizer e que a §3-B já formula melhor.

### As duas pontas do índice, conferidas no fecho da rodada

**35 marcadores distintos vivos · 35 linhas no índice · o parágrafo diz "São 35"**. Fecha nos dois sentidos, e o `CT-907` — que o afirma por `fs` — está verde nos 263 de `shared`.

---

## T7 — Gate 1 (QA) rodada 3 · veredito **APROVADO**

- **Agente**: `agent-spec-qa-validator` · `opus` · 445,5 s · 15 tool_uses · 112.168 tokens
- **21/21 critérios · ZERO problemas** em todas as severidades · `security_flags` vazio
- **P5**: `api` **370/370** · `shared` **263/263**, medidos por pacote

### A confirmação independente, e o método que ele usou é melhor que o meu

Eu havia provado "zero linhas executáveis" por `diff` filtrado. Ele foi além, e o instrumento vale registrar:

- **Scanner de estados** para remover comentários — *"trata string, template literal e regex literal"* —, depois normalização de espaços: **149 linhas executáveis nas duas rodadas**, `diff` vazio e **sha256 idêntico**. Um filtro por `grep` (o meu) confundiria `//` dentro de string com comentário; o dele não.
- **Estendeu a mesma prova** a `ambiente.ts` (sha256 idêntico) e `provisionar-base.sh`, mostrando que as linhas de código que **aparecem** no diff são **contexto de hunk**, não mudança. Era a armadilha oposta à do untracked, e ele a viu.

### A movimentação do item 3, provada por multiconjunto

O arquivo onde uma mudança de asserção poderia se esconder numa movimentação de 36 linhas foi provado **movimentação pura**, por duas medições independentes:

1. o multiconjunto de linhas brutas **ordenado** é idêntico entre as rodadas;
2. o multiconjunto de linhas **executáveis** ordenado é idêntico — **876 linhas nas duas pontas**.

E ele explicitou o que **valida** o método: *"o sha256 não ordenado difere, e é exatamente o que a movimentação prevê"*. Prova positiva e controle negativo na mesma medição.

### Ele verificou a justificativa do débito no fonte, em vez de aceitá-la

> *"em `adaptador-sicoob.ts`, `consultarEntrega` devolve `corpoUtil(texto) === null ? { aceito: false, motivo: null } : { aceito: true }` … o comentário do próprio adaptador o diz por extenso. Logo, aplicar em `apurarDesfecho` o `return undefined` do cadastro quebraria a desabilitação pelo caminho por onde ela de fato acontece: a prescrição do Gate 2 está tecnicamente correta, e o `POR QUE NÃO AGORA` do marcador é **verificável, não retórico**."*

### ⚠️ Achado de contagem que ele documentou e que a próxima fatia precisa saber

Ao conferir as duas pontas, ele registrou que os **35 pares distintos** de marcador vivo incluem **duas anomalias que se cancelam**:

- **`D99 · F7/T3`** é **fixture de controle positivo** em `packages/shared/test/protocolo-antirregressao.spec.ts:536` — não é débito real, mas casa com o `grep`;
- **`D13 · F4/T6`** conta **uma vez** no `grep` e vale **dois** débitos, por ser o par repetido legítimo em duas fatias.

**Um a menos e um a mais: o total fecha em 35 por compensação.** ⚠️ Isto é frágil de um jeito não óbvio: **fechar o `D13` de uma das duas fatias quebra a contagem sem que nada no `grep` mude**. Registrado aqui porque é a segunda contagem desta fatia que fecha por compensação — a outra foi o `32 → 32` do bloco do `CLAUDE.md` na T1/T2.

### Sobre o P4 nesta rodada

Ele foi preciso ao declarar por que **não** há rede a exigir: *"o achado do Gate 2 era `MEDIO`/`architecture` sobre **legibilidade do registro**, não sobre comportamento: não existe caso de teste que possa falhar com o texto antigo e passar com o novo, porque nada executável mudou. A rede possível para um defeito não testável na stack é o marcador no ponto do código, que é precisamente o que a correção instalou (P4, segunda alínea)."*

---

## T7 — Gate 2 (Tech Review) rodada 3 · veredito **APROVADO** · TASK FECHADA

- **Agente**: `opus` · 281,9 s · 34 tool_uses · 127.467 tokens · **`problems: []`**
- **`scan_scope` DELTA**, com o raio determinado com confiança e **resultando VAZIO** — *"nenhum símbolo executável foi alterado no delta"*. Sem fallback para FULL.
- **Não re-executou a suíte**, e declarou por quê: nenhuma condição do contrato acionada, e a prova do Gate 1 *"é auditável e bate com a minha leitura direta do diff, em que todas as linhas `+` do serviço começam com ` *` ou `    //`"*. **Auditou o método do outro gate em vez de confiar nele.**

### O TR-P1 fechado nas duas pontas, verificado por ele mesmo

> *"O risco de R3 que eu havia nomeado — a próxima task lerá como questão fechada — está fechado **nas duas pontas**: o cabeçalho **deixou de afirmar propriedade do arquivo inteiro**, e o ponto da edição carrega o que falta."*

E, como o Gate 1 antes dele, **foi ao fonte conferir a própria justificativa** (`adaptador-sicoob.ts:2046-2058`), confirmando que o `POR QUE NÃO AGORA` é *"verificável, não retórico"*. **Dois gates independentes fizeram a mesma verificação de fonte** sem que nenhum soubesse do outro.

### Verificações de forma que ele fez e que ninguém pedira

- **Extensão do marcador aferida contra a convenção do host**: mediu **11, 11, 19 e 33 linhas** nos marcadores de `carga-da-tarefa.ts`, `conversao-do-material.ts`, `main.ts` e `log.ts`, e concluiu que as 21 do `D35` *"não destoam"*. Comparar com a base em vez de aplicar um número arbitrário.
- **Levantou e descartou um achado por si**: o marcador vive em `entrega-da-noticia.service.ts` mas o gatilho dispara ao abrir **outros dois** arquivos — *"quem dispara não vê o marcador"*. **Não abriu achado**, porque é a convenção praticada por `D51`, `D49` e `D3 · F2/T1`, e a rede compensatória é o índice do `CLAUDE.md`, *"que toda sessão lê antes de qualquer arquivo"*.
- **Checou o encaminhamento do débito contra a ADR-0025**: o `D35` propõe o terceiro estado **na porta**, e a `Decision` diz que *"o pacote de domínio declara o tipo do dado que atravessa e a interface da porta"*. **Conforme, não contrário** — verificou que o débito aponta para o lugar certo.
- **Fez a checagem de presença** que o sumário do QA desta rodada não trouxe, confrontando a §5.1/§5.2 contra a árvore e reconferindo as três âncoras em **105 / 90 / 20**.

### Fecho da T7

| | |
|---|---|
| Rodadas | **3** — a mais longa da fatia |
| Gates | 6 invocações (QA ×3, TR ×2, mais o TR da r2) |
| Arquivos | **4 criados, 16 modificados** |
| Suíte | `api` **357 → 370**; total **1788 → 1801** |
| Débitos gerados | `D31`, `D32`, `D33`, `D34`, `D35`, `D36` |
| Rotas publicadas | **2** — as últimas do produto antes do congelamento |

⚠️ **As duas correções vieram de gates diferentes atacando eixos diferentes**, e nenhuma tocou o mesmo ponto duas vezes: o QA pegou **um caso ausente** (a combinação que separa a regra de uma disjunção), o TR pegou **uma decisão generalizada demais no docblock**. É o oposto do laço longo que a §5 do Protocolo descreve — ali o mesmo defeito reaparece por caminhos novos; aqui foram dois defeitos distintos, cada um fechado de uma vez.

---

## T8 — despacho do executor (tentativa 1)

- **Agente**: `sysloc-backend-implementer` · `opus` · `gates: [qa, tech_review]`
- **`base_sha`**: `ffb8beeffcd8fe6b8ecd64230912b6c9d97581b0` — baseline isolada, **51 paths**, ruído da intervenção dirigida **ausente** (verificado por `grep` sobre o `--name-only`)
- **CTs exigidos** (§6.5 e cards `#### CT-` da §6.6): **3** — CT-1039, CT-1040, CT-1041
- **Material derivado antecipadamente** e que vai ao prompt: a correção do alvo da lista em `alcance-da-fila.spec.ts`, os dois números narrativos a subir no mesmo diff, a conformidade da ADR-0024 quanto ao `empresaId` na carga, e o `D49 · F4/T16` como débito que a task pode fechar.

### ⚠️ Derivação da T8 — o `AT-11` do card nasce defasado, e é preciso dizê-lo aos gates

O **AT-11** exige *"baselines medidas antes e depois: `worker` **126**, `api` **354**, `shared` **254**"*. Os três números são da medição de **2026-08-20**, anterior a esta fatia. Medido hoje:

| Pacote | AT-11 do card | Real |
|---|---|---|
| `worker` | 126 | **126** ✅ |
| `api` | 354 | **370** ⚠️ (+16, das T7 e das anteriores) |
| `shared` | 254 | **263** ⚠️ (+9) |

**É a terceira vez nesta fatia que um número narrativo defasado ameaça induzir erro**, e a primeira em que ele mora **dentro de um critério de aceite** — o que o torna mais perigoso que os anteriores: um gate que aplique o `AT-11` literalmente reprovaria uma task correta, ou pior, aceitaria uma queda de 16 casos em `api` como conformidade.

⚠️ **Vai ao prompt dos dois gates**: a baseline real é **370 / 263 / 126**, e a divergência é **débito de prosa do card**, não defeito da task. A correção do card pertence à **T10**, que já carrega as correções do `tech_spec.md` — e esta se soma a elas.

> Reforça o **candidato a regra nº 12** por um ângulo novo: até aqui os exemplares eram docblock, nome de caso e comentário. Este é um **critério de aceite executável na cabeça de quem lê** — a classe alcança a spec, não só o código.

---

## T8 — relatório do executor e cruzamento

- **Duração**: 4102,6 s · 156 tool_uses · 486.513 tokens · **2 criados, 20 modificados**
- **`attempt_sha`**: `134eedbb2d129f74dedd49eb7823939aa7a1790c` · **22 paths**
- **Suíte**: `api` **370 → 371** · `worker` **126 → 132** · demais inalterados · **total 1801 → 1808**

⚠️ **Erro meu, corrigido antes de o gate ver**: o primeiro `git commit-tree` usou `git add -A deploy` e arrastou o **ruído da intervenção dirigida** (`preparar-material-do-certificado.sh` +117 e `verificar-preparacao-do-material.sh` +340). Refeito com `deploy/systemd` apenas — **457 linhas alheias** que o Gate 2 teria revisado como se fossem da task. É a terceira vez que esse ruído tenta entrar; nas duas anteriores a exclusão foi por construção da baseline, aqui foi por `git add` largo demais.

### Marcadores `DECISÃO FECHADA` — a verificação que mais importava nesta task

A T8 tocou `certificado.controller.ts`, que carrega a **`DECISÃO FECHADA — T12`**. Medido:

| Arquivo | Marcadores | Resultado |
|---|---|---|
| `certificado.controller.ts` | T12 | ✅ **idêntico byte a byte** |
| `apps/worker/src/fila.ts` | 2 | ✅ intactos |
| `apps/worker/src/main.ts` | 2 | ✅ intactos |
| `apps/api/src/comum/produtor-de-fila.ts` | 92 linhas de bloco | ✅ **idêntico** |

⚠️ **Meu primeiro teste deu falso positivo em dois arquivos.** Eu comparava `grep -A 8` a partir do marcador — 8 linhas **fixas** —, o que captura texto **depois** do bloco, que legitimamente mudou. Refeito com `awk` extraindo **os comentários consecutivos do próprio bloco**: todos idênticos. **A medição errada acusava violação crítica onde não havia** — e teria custado uma rodada de escalada.

A mudança em `certificado.controller.ts` é a extração do resultado da transação (`const { desfecho, empresaId } = await sobContextoDaSessao(...)`) para que o enfileiramento aconteça **depois do `COMMIT`** — que é o **AT-3**, e é inatingível sem tocar o controlador.

### O alvo da lista — a correção que eu havia medido foi seguida

✅ Editadas **`IMPORTADORES_DO_MODULO_DA_FILA`** (a de cima) e **`ARQUIVOS_QUE_NOMEIAM_O_TOKEN`** (literal). `ARQUIVOS_QUE_NOMEIAM_O_MODULO` **continua derivada por espalhamento**, sem duplicata — verificado no fonte. Era o defeito que o card induziria.

### O executor achou um número narrativo que eu NÃO tinha visto

Além dos dois que eu havia medido (*"cinco serviços"* → seis; *"o quinto importador"* → sexto), ele achou o título de um caso dizendo **"TRÊS módulos"** onde já eram **cinco** — ⚠️ **defasado em 4, e anterior a esta fatia**. Corrigiu junto, e ainda ajustou o texto da T9 (*"o importador seguinte"*, forma que não envelhece).

Isso eleva o **candidato a regra nº 12** de novo: a classe já apareceu em docblock, nome de caso, comentário, critério de aceite (`AT-11`) e agora **título de caso defasado em quatro unidades**.

### Prova de falsificação — observada, não simulada

**Cinco âncoras estáticas reprovaram em execução real** antes de ele as atualizar, cada uma nomeando o excedente. A única que atualizou antes de rodar (`alcance-da-fila`) recebeu **prova dirigida pelo script do pacote**: revertidas as duas entradas com o fonte íntegro → `2 failed | 369 passed`, nomeando os dois arquivos; restaurado → `371 passed`. É a forma que a `testing-stack.md` exige, e ele usou `pnpm --filter`, nunca `vitest run` avulso.

### `D49`, `D51`, `D33` — os três medidos e nenhum disparado

- **`D49`**: não abre `regua.ts` nem `confirmacao-de-email.ts`. `cargaConferida` **importado**, nenhuma quarta cópia (AT-7).
- **`D51`**: o gatilho é abrir `apps/api/src/configuracao/ambiente.ts` — ele **não o abre** (a variável nova entra só no `lerAmbiente` do **worker**). ⚠️ Distinção fina e correta: são **dois leitores de ambiente diferentes**, e o gatilho nomeia um deles.
- **`D33`**: o `CT-1039` vive em `certificado-do-provedor.e2e.spec.ts`; ele **não abre** `entrega-da-noticia.e2e.spec.ts`.
- **`D35`** (da T7): leu antes de decidir, e o `return` **não foi tocado**. ⚠️ **A ambiguidade que o `D35` nomeia virou a razão declarada** de a tarefa **levantar** em vez de gravar quando `{aceito:false, motivo:null}` — o débito da T7 informou a decisão da T8, que é exatamente o que um marcador serve para fazer.

### Achado do executor que a §5.2 não previa, e que era um defeito real

> *"Medido: `executarEntrega` do adaptador retorna `{aceito:false, motivo:null}` quando `enderecoDaEntrega === undefined`, e o worker construía o adaptador **sem** ele. **A fila nova subiria consumindo tarefa que nunca reconfere.**"*

É o mesmo eixo do `D29` (fechado na T7 para o processo da API), agora no **processo de trabalho**. Sem essa medição, a T8 entregaria uma fila que consome e não faz nada — verde na suíte, inerte em produção.

### Novo débito `D37 · F5/T8`, e um par homônimo

Escriturado na §2. ⚠️ Nasceu o **oitavo par homônimo** do repositório: `D37 · F1/T8` (fatia `autorizacao-e-ciclo-de-acesso`) e `D37 · F5/T8` (esta). Ambos legítimos — o que os separa é a **fase**, não a task. Acrescentei `dois D37` à lista do `CLAUDE.md`, que é justamente a prosa que envelhece se ninguém a atualiza.

**Índice: 36 marcadores, 36 linhas, "São 36".** Fecha nas duas pontas.

---

## T8 — Gate 1 (QA) rodada 1 · veredito **REJEITADO**

- **Agente**: `opus` · 739 s · 38 tool_uses · 268.618 tokens
- **Critérios 11/11** · **1 ALTO** (bloqueia) · 0 MÉDIOS · 0 BAIXOS · `security_flags` vazio
- **Suíte completa verde**, medida por pacote: **1808 casos**, com a decomposição do executor **conferida por contagem, não aceita por declaração**

### O bloqueante — `ALTO-001` · `tests` · **`tautological_assertion` (AP-29)**

⚠️ **Este smell NUNCA é anotável**: está na lista dos que **mascaram regressão** (`agent-spec-workflow-rules.md:632`), ao lado de `mock_driven_confidence`, `weakening_test_to_pass` e `snapshot_as_test`. Bloqueia por contrato, não por severidade.

**O defeito**: nos cenários 1 e 2 do `CT-1040 (c)`, a asserção `toContain('empresaId')` é **infalível** — o literal já está na **mensagem base** da falha, independentemente do que a apuração do campo produziu, porque a `EXIGENCIA_DA_CARGA` da borda diz textualmente *"exige o campo 'empresaId'…"*.

**E ele mediu, não inferiu:**

> *"simulando `camposRecusados` completamente quebrado (devolvendo cadeia vazia), a razão resultante ainda contém 'empresaId' → `toContain('empresaId')` **PASSA** nos dois cenários; `toContain('segredo')` reprova apenas no cenário 3."*

**A consequência exata**: uma regressão no ramo `problema.path.length > 0` de `camposRecusados` — **o único ramo que os cenários 1 e 2 exercitam** — não é detectada por caso algum da suíte, porque o cenário 3 exercita o **outro** ramo (`unrecognized_keys`). E o cabeçalho INVARIANTES declara por escrito que os três provam *"razão contendo literalmente o nome do campo recusado"*; **dois dos três não provam**.

A correção é de **uma linha**: asserir o trecho **discriminante** (`(recusado: ${nomeado})`) em vez do nome solto. E ele acrescentou a disciplina que impede a correção de nascer torta: *"declarar o prefixo como constante **escrita à mão** e NÃO importada de `carga-da-tarefa.ts` — importá-la faria a asserção **concordar consigo mesma**"*.

### As verificações que eu havia medido — todas confirmadas, e o método corrigido foi adotado

- **`DECISÃO FECHADA — T12` íntegra**, por **hash do bloco de comentários** (md5 idêntico, 21 linhas). ⚠️ E ele nomeou o método pelo motivo certo: *"extração dos comentários **consecutivos do próprio bloco**, e não `grep -A N` com janela fixa — que é o que produz falso positivo ao capturar texto depois do bloco"*. **O aviso que passei virou método declarado no relatório dele.**
- **`AT-8` conferido NO CONTEÚDO, não só na presença** — os cinco elos, **incluindo o do diário de partida**: `fila.reconferenciaDaEntrega.name` na lista *"processador de trabalho no ar"*. Era o modo de falha silencioso desta task.
- **`AT-7`**: só quatro arquivos do produto nomeiam `ZodError` — a entrada única mais as duas cópias que o `D49` já registra, mais a validação da API. **Nenhuma quarta cópia.**
- **ADR-0024**: a fronteira com a ADR-0035 **preservada** — *"o cabeçalho de `packages/shared/src/fila.ts` mantém a advertência apontando na direção certa (as **cinco cargas com empresa** contra a **única sem**)"*.

### ⚠️ Uma lacuna que o Gate 1 DECLAROU e RECUSOU classificar — e a recusa é bem fundamentada

> *"a metade que PASSA a variável ao adaptador — `criarAdaptadorSicoob({ …, enderecoDaEntregaDaNoticia })` em `apps/worker/src/main.ts` — **não tem asserção alguma**. `enderecoDaEntregaDaNoticia` é **OPCIONAL** na assinatura, logo **remover essa linha compila e deixa a suíte verde**."*

As três razões medidas para não classificar: (i) **a garantia EXISTE** no código de produção — o discriminador das T6/T7 a mantém fora de `security`/`architecture`; (ii) **nenhum antipadrão do catálogo a descreve**, e *"forçar um `smell` errado seria pior que a anotação"*; (iii) **a API está no mesmo nível** — o `ambiente.spec.ts` dela também prende a variável pela lista de campos, não pela fiação —, e `apps/worker/src/main.ts` **não tem suíte em ponto algum da base**.

**Concordo com a recusa**, e ela é exemplar: o gate preferiu **declarar sem rótulo** a inventar uma categoria para caber. Vai ao Gate 2 **nominalmente**, a quem cabe julgar a composição raiz.

### Duas divergências do card, declaradas pelo executor e ACEITAS pelo gate

1. **A porta é satisfeita por implementação local** em vez do par TLS mútuo — importar `apps/api/test/par-do-provedor.ts` seria a **primeira travessia `apps/<app>/test → apps/<app>/test`** da base. Mockar a **porta** é mock na fronteira correta; a fronteira real atravessada continua sendo **banco + fila (Redis efêmero real)**, e o par TLS segue exercitado pelo `CT-1039` na API.
2. **O "vaso de efeito +1"** do controle antivácuo não existe porque **o `D7` da fatia rejeitou a tabela de tentativas por escrito**. O substituto é *"mais forte do que parece"*: o mapa é afirmado com valores **não nulos** antes de qualquer execução, *"o que impede as cinco igualdades de passarem comparando zero com zero"*.

### Dois candidatos a regra novos — o 15º e o 16º

- **`repeated_fixture`**: a semeadura *certificado + identidade* está em **4 suítes** do worker; a desta task é a quarta.
- **`repeated_assertion_shape`**: o predicado de estado terminal (`completed | failed`) está escrito à mão em **9 suítes** dos dois aplicativos. ⚠️ É a forma **mais silenciosa** desta classe: quando os estados terminais mudarem, as suítes que ficarem para trás **não falham — elas expiram**.

---

## T8 — correção rodada 2 · aplicada e verificada

- **Agente**: `sysloc-backend-implementer` · `opus` · 298,9 s · 19 tool_uses · 94.022 tokens
- **`attempt_sha` rodada 2**: `acf687e83eba22ac0dcd7db08ffa899192c952a2`
- **Delta**: **1 arquivo**, +24/−4 — só `apps/worker/test/reconferencia-da-entrega.spec.ts`. Nenhum fonte de produção tocado; `worker` **132 → 132**.

### Ele foi ALÉM da prescrição, e a extensão é boa

O gate prescreveu asserir o **prefixo** `(recusado: `. Ele acrescentou também o **fecho** `)`, em duas constantes nomeadas, com a razão declarada (A1): *"nos três cenários há exatamente um campo recusado, e o fecho transforma **'contém o nome em algum lugar da lista'** em **'é o único recusado'**, sem custo e sem fragilidade"*.

E o docblock da constante registra por escrito a armadilha que a própria correção poderia recriar:

> *"**Escrita à mão de propósito, e NUNCA importada de `carga-da-tarefa.ts`.** … Importar o molde do próprio módulo sob prova traria o defeito de volta por outro caminho: a asserção passaria a **concordar consigo mesma**."*

### A prova do P4 — de raciocínio, e ele cobriu DOIS mutantes

1. **`camposRecusados` devolvendo cadeia vazia**: a razão vira `… (recusado: )`, e `(recusado: empresaId)` / `(recusado: segredo)` deixam de ser substrings — **os três reprovam**, contra apenas o terceiro antes.
2. **A regressão mais provável do ramo `problema.path.length > 0`** — devolver `problema.code` em vez do caminho: a razão traria `(recusado: invalid_type)`, que **reprova nos cenários 1 e 2**, o ramo que nenhum caso discriminava.

O segundo mutante não estava na prescrição do gate. Ele o derivou.

### ⚠️ A medição sobre a lacuna deferida — e ela muda o enquadramento

O gate declarou a lacuna da fiação e a deferiu ao Gate 2. O executor **mediu sem agir**, e trouxe duas informações que o Gate 1 não tinha:

1. **A API está no mesmo estado, e a razão está ESCRITA lá**: `integracoes-bancarias.module.ts:123-125` **documenta a opcionalidade** e afirma que *"aqui ele **não** pode faltar"* — mas a linha `:150` **também não tem asserção**. O texto sabe do risco; a prova não existe.
2. **A única suíte que hoje passa o campo por fiação a um adaptador** é `entrega-da-noticia.e2e.spec.ts:312`, e ali ele é **arranjo**, não asserção da composição raiz.

**Conclusão dele, que não tomou**: *"fechar a lacuna só no worker deixaria a API para trás — é caso do **Limiar de Três em potencial**, e a decisão pertence ao Gate 2."*

Isto reenquadra o achado: **não é uma lacuna do worker, é uma lacuna simétrica dos dois processos**, com um docblock na API declarando a exigência que ninguém prova. Vai ao Gate 2 nominalmente.

---

## T8 — Gate 1 (QA) rodada 2 · veredito **APROVADO**

- **Agente**: `opus` · 594,7 s · 12 tool_uses · 119.044 tokens · **zero problemas em todas as severidades**
- **Suíte COMPLETA re-executada** nos 9 pacotes, um a um: **1808**, batendo a rodada 1 **casa a casa**

### Ele decidiu re-executar tudo, contra a justificativa razoável do executor — e disse por quê

> *"decidi RE-EXECUTAR os nove pacotes, apesar de a justificativa do executor ser razoável. Razão: a Camada 7 do meu contrato manda executar a suíte integralmente em TODA rodada, inclusive em DELTA — **é onde regressão introduzida pela correção se manifesta**."*

E registrou o que torna a medição confiável: *"a tarefa `test` do `turbo.json` declara `cache: false` … logo a comparação é sobre **execução real, não replay**"*.

### ⚠️ O gate derivou um TERCEIRO mutante que nem o executor havia declarado

O executor cobriu dois. O gate abriu `camposRecusados` e contou os ramos:

> *"`camposRecusados` tem exatamente **três** ramos. Cadeia vazia → reprova os três cenários; `problema.code` no ramo `path.length > 0` → reprova os cenários 1 e 2; `problema.code` no ramo `unrecognized_keys` → reprova o cenário 3. **A rede do P4 cobre os TRÊS ramos da função**, e não apenas os dois mutantes declarados pelo executor."*

A correção é mais forte do que quem a escreveu sabia — e só se soube disso porque o gate foi contar os ramos em vez de aceitar a prova apresentada.

### E conferiu a premissa do fecho `)` no fonte, em vez de aceitá-la

> *"`ESQUEMA_DA_CARGA` é um `z.strictObject` com um **único** campo, logo cada um dos três cenários produz **exatamente uma** issue … o `join(', ')` nunca tem segundo elemento nesses arranjos, e o `)` é o último caractere da razão."*

O executor **afirmou** que há um só campo recusado nos três cenários; o gate **provou** que o esquema não permite outra coisa.

### Uma fragilidade futura registrada SEM abrir achado — e a distinção é precisa

> *"se `ESQUEMA_DA_CARGA` ganhar um segundo campo obrigatório, o cenário `{}` passará a produzir dois nomes e `(recusado: empresaId)` deixará de casar. Isso é **falha HONESTA** — o teste reprova e obriga a atualizar o invariante —, não fragilidade que mascare regressão. **Não é AP-01 nem motivo de anotação.**"*

É a distinção que separa teste frágil de teste que **avisa**: um reprova por ruído, o outro reprova porque a verdade mudou.

### A lacuna deferida — a medição nova reforça o deferimento

> *"não é lacuna do worker, é **simétrica nos dois processos**, com um docblock declarando na API uma exigência que nenhuma prova sustenta — Limiar de Três em potencial. **Fechá-la é decisão de topologia (onde mora a asserção da composição raiz), que é escopo do Tech Review, não meu.**"*

Os dois gates e o executor convergiram para o mesmo lugar sem combinar: o achado existe, é real, e a decisão de **onde** a prova deve morar é arquitetural.

---

## Lote T9 ‖ T10 — guards verificados ANTES do despacho, e a medição do paralelismo

| Guard | Verificação |
|---|---|
| DAG independente | ✅ nem T9 depende de T10 nem o inverso; ambas dependem de T2+T7+T8, todas fechadas |
| Disjunção de símbolo | ✅ **nenhuma das duas cria símbolo público** (as duas declaram `N/A` na §1) |
| **Paths disjuntos** | ✅ **medido, zero interseção de arquivo**: T9 → `segredo-nao-escapa.e2e.spec.ts` + `vocabulario-na-saida-real.e2e.spec.ts`; T10 → `percurso-do-cliente-novo.e2e.spec.ts` (novo) + `apps/worker/test/conferencia-bancaria.spec.ts` + `CLAUDE.md` + `tech_spec.md` |
| Alta contenção não compartilhada | ✅ só a T10 toca `CLAUDE.md` |
| `MAX_PARALLEL` | ✅ 2 de 4 |
| **Recursos de teste** | ⚠️ **interseção de PACOTE** (`apps/api`), sem interseção de arquivo — tratado, ver abaixo |

### A decisão sobre o guard de recursos (A1), e a medição que a justificou

**A pergunta**: paralelizar os executores, sabendo que ambos rodam `pnpm --filter @sysloc/api test`?

**Alternativas**: (a) paralelizar, com instrução de repetir a medição diante de falha por recurso; (b) serializar os executores e paralelizar nada.

**Adotada: (a), a recomendada.** Razão medida: **um único `pnpm --filter @sysloc/api test` desta base já roda ~15 processos vitest concorrentes** com instâncias efêmeras próprias — observado nas T7 e T8. O risco, portanto, **não é colisão lógica** (a base já suporta concorrência de instâncias), e sim **saturação do host**. Contra saturação, a mitigação certa não é serializar: é instruir cada executor a **repetir a medição antes de concluir regressão** diante de falha sem causa lógica — porta ocupada, instância que não sobe, tempo esgotado. A instrução é barata e fecha o modo de falha mais provável.

**Os QAs serializam**, como nas fatias anteriores.

> **Medição em voo**: com os dois executores rodando, o host chegou a **21 processos vitest simultâneos** e as duas suítes seguiram progredindo. A premissa da decisão está sendo exercitada de verdade, não presumida.

### Advertência simétrica passada aos dois gates

A baseline do lote é **compartilhada** (`1114d945`), de modo que o diff de cada task pode trazer arquivo da irmã. Passei aos dois: **arquivo da task irmã no diff é contaminação da baseline compartilhada, não desvio de escopo** — reportar, nunca classificar como violação. É o modo de falha típico de lote paralelo com baseline única.

---

## Consolidação do run — medida no despacho do lote final

| | |
|---|---|
| Tasks concluídas | **8/10** |
| Invocações de gate | **37** |
| Rodadas de correção | **8** (T5 ×2, T6 ×1, T7 ×2, T8 ×1, mais as revalidações) |
| Débitos escriturados | **39** — 34 `baixo`, 5 `MEDIO` (todos anotáveis por partição) |
| Candidatos a regra | **16** |
| Marcadores vivos / linhas no índice | **37 / 37** — fecha nas duas pontas |
| Suíte | **1808** casos verdes nos 9 pacotes |
| Tasks bloqueadas | **nenhuma** |

### A distribuição dos débitos por categoria — e ela confirma o padrão dominante da fatia

```
documentation  13  ┃ project_pattern  5  ┃ tests         7
code_quality    6  ┃ performance      2  ┃ testability   1
security        1  ┃ data_handling    1  ┃ architecture  1
```

⚠️ **`documentation` + `project_pattern` = 18 de 39, ou 46% do total.** Quase metade dos débitos desta fatia é **registro que ficou para trás do fato**, não defeito de código. É a medição que sustenta o **candidato a regra nº 12**, e ela cresceu ao longo do run: começou com nove exemplares na T6, e a classe já apareceu em **docblock, nome de caso, comentário, critério de aceite, título de caso e ponteiro de arquivo** — inclusive uma vez **induzindo o orquestrador a construir um alerta errado**.

Do outro lado, as categorias que doem — `security`, `data_handling`, `architecture` — somam **3 de 39**, e as três foram **encontradas pelos gates e corrigidas na mesma fatia**, nenhuma escapando para débito por omissão.

---

## T9 — relatório do executor e cruzamento

- **Duração**: 1804,8 s · 81 tool_uses · 340.877 tokens · **0 criados, 2 modificados**
- **`attempt_sha`**: `995ee6e110bfeced22568192b25fc0e0f098f082` — capturado **filtrando pelos 2 paths da T9**, porque a T10 ainda escrevia na árvore. Verificado: **zero contaminação**, o diff traz só os dois arquivos dela (+882/−8).
- **`api` 371 → 374.** ⚠️ **Ele decompôs o delta em vez de reivindicá-lo**: *"o delta é +3, e apenas **+2 são meus**. O terceiro vem de `percurso-do-cliente-novo.e2e.spec.ts` — arquivo **untracked, da T10** —, que explica também o 42º arquivo."* **Nenhuma varredura reprovou; nenhum arquivo de produção entrou no escopo.**

### O guard de disjunção segurou, e ele o respeitou por decisão consciente

> *"Os demais pacotes **não foram medidos de novo, e a omissão é deliberada**: zero edições minhas fora de `apps/api/test/`, e a T10 está alterando `apps/worker/test/conferencia-bancaria.spec.ts` … neste mesmo lote — **medi-los agora atribuiria o delta dela a mim**."*

É a leitura certa de baseline compartilhada: medir o que não é seu não é rigor, é ruído atribuído a quem não o causou.

### Os controles positivos — a disciplina que decide esta task foi cumprida

- **CT-1024**: passo 3, `ocorrenciasDe(controleComAsAgulhas(agulhas), agulhas)` por igualdade contra os rótulos — **a mesma função**, canal a canal, **antes** de qualquer afirmação de ausência. Mais um segundo controle no passo 11, sobre a coleta do documento.
- **CT-1033**: controle no passo 1 com **eixo negativo** — `objetoDeControle('valor de enum', [])` → `[]`, *"que pega o varredor invertido"*. ⚠️ **Isso vai além do que a rule pede**: o controle antivácuo padrão prova que o varredor **acha**; este prova também que ele **não acha o que não está lá**.

### Duas decisões de arranjo que evitam prova circular

1. **`CT-1033` usa o par TLS real com o adaptador de produção**, não um dublê da porta: *"o dialeto precisa atravessar a fronteira de tradução real, senão a asserção teria origem no que o próprio teste plantou"*. É o Gate 6 (No Self-Set Mock Assertion) aplicado sem que ninguém o citasse.
2. **`CT-1024` usa destino inerte** em vez de porta instrumentada: *"o claro é aberto **antes** de qualquer decisão de rede, de modo que o cofre atravessa o caminho de falha da biblioteca — **que é onde o achado crítico da fase anterior nasceu**"*.

### A âncora do AT-3, que ele derivou sem que o card a explicitasse

> *"o segundo motivo é `SENHA_NAO_ABRE` sobre cofre em cifra **legada**, par só produzível **dentro** da conversão — sem o subprocesso o motivo seria `FORMATO_NAO_SUPORTADO`."*

Somada a `materialConvertido === true`, ela **prova que o processo externo correu** — sem inspecionar o processo, só o desfecho que só ele produz.

### Uma exclusão deliberada, com razão medida

`codigoTipoMovimento` **ficou de fora** de `TERMOS_DO_PROVEDOR`: *"a varredura casa por **contenção** e `tipoMovimento` já o alcança; incluí-lo faria o controle positivo **achar dois termos no canal em que planta um**, e a igualdade por canal viraria lista escrita para bater com o efeito colateral."*

É o tipo de decisão que, tomada errada, produz uma âncora que passa a ser mantida para concordar consigo mesma.

### Decisão auto-resolvida do ORQUESTRADOR (A1) — o gatilho do `D33` é por EDIÇÃO, não por leitura

O executor leu `entrega-da-noticia.e2e.spec.ts` como **arqueologia (P2)** e perguntou se isso dispara o `D33`.

**Alternativas**: (a) o gatilho é por **edição**; (b) por **leitura**.

**Adotada: (a), a recomendada.** Razão: **o P2 do Protocolo OBRIGA a arqueologia** antes de editar região preexistente. Se ler disparasse gatilho, **todo débito dispararia em toda task** que fizesse o que o Protocolo manda — e o instrumento perderia o sentido, porque "quando fecha" deixaria de discriminar. O `D33` segue **aberto**, e o gatilho é a primeira task autorizada a **modificar** aquele arquivo.

> ⚠️ Vale como esclarecimento permanente da §3-B: *"a primeira task autorizada a abrir X"* significa **autorizada a editar X**, não *"que leu X"*. A distinção nunca precisou ser feita nesta base até agora.

### Débitos: nenhum novo. E três medições de débito existente

- **`D52 · F4/T16` — NÃO disparou**, com a medição escrita no cabeçalho da suíte: o `CT-1024` *"não exigiu canal novo de busca — a saída do conversor é lida para classificar e descartada, e se atravessasse chegaria por corpo, cabeçalho ou diário, os três já canais da suíte"*.
- **`D32 · F5/T7`** — nenhuma **sétima** cópia de `entrarComSegundoFatorCumprido`; usou sessões dos `beforeAll`.
- **`D37 · F5/T8`** — intocado: *"nenhum ramo do **produto** passou a ler dentro do `diagnostico`; quem o lê é o teste"*. ⚠️ Distinção correta — o gatilho do `D37` é o produto ler, não o teste varrer.

### ⚠️ Ponto a verificar no fecho do lote

`packages/cobranca-bancaria/test/conversao-do-material.spec.ts` aparece como `AM` (staged pela T1, com modificação nova não-staged). **Está fora da §5.2 da T10.** A verificar quando ela fechar — pode ser correção legítima ou alargamento.

---

## T9 — Gate 1 (QA) · veredito **APROVADO** · 9/9 · zero problemas

- **Agente**: `opus` · 555,6 s · 37 tool_uses · 183.617 tokens · `api` **374/374** verdes

### Ele verificou cada afirmação do executor no fonte, e nenhuma caiu

| Afirmação | Verificação independente |
|---|---|
| "mesmo objeto de função" | ✅ **por definição única, não por homonímia**: `ocorrenciasDe` tem **UMA** definição, e é a mesma aplicada ao controle e aos seis desfechos; `termosEncontradosEm` idem. *"Nenhum varredor foi reimplementado dentro do caso."* |
| eixo negativo do `CT-1033` | ✅ **real, e ele explicou o mecanismo**: `objetoDeControle('valor de enum', [])` faz `[].join('|')` = **cadeia vazia**, e *"um varredor escrito na direção invertida (`agulha.includes(texto)`) casaria a cadeia vazia com os quinze termos e satisfaria todas as igualdades de baixo; a asserção `toEqual([])` o reprova"* |
| âncora do AT-3 | ✅ **conferida contra o código de produção**, nos dois ramos: com cifra **moderna** o motivo nasce **fora** da conversão; com **legada** o runtime falha antes da etiqueta e só então `classificarFalhaDoConversor` casa `RADICAL_DE_SENHA_DO_CONVERSOR = 'mac verify'` — constante **declaradamente distinta** da irmã de `leitura-do-material.ts`. *"O par é produzível EXCLUSIVAMENTE dentro da conversão."* |
| exclusão de `codigoTipoMovimento` | ✅ **premissa verificada no varredor**: ele casa por `includes`, e `tipoMovimento` **está contido** em `codigoTipoMovimento`. E foi além: conferiu que os **dois termos novos são mutuamente não-substring** dos outros treze |

### ⚠️ Ele achou uma âncora que o executor NÃO reivindicou

> *"`ativar` lê as duas pré-condições numa primeira transação e SÓ então chama `apurarDesfecho`, onde `decifrarSegredo` corre. Certificado ou identidade ausentes levantam antes, e a rota responderia `422` — não `200`. **A igualdade `[201,422,422,422,200,200]` é, portanto, ela própria a prova de que o claro do cofre atravessou o caminho de falha da biblioteca** no desfecho da ativação."*

A lista de status, que parecia só ordenação, **é** o antivácuo do desfecho mais difícil de provar.

### Duas coisas que ele registrou SEM abrir achado — e as distinções são finas

- As âncoras de contagem sobre literal *"são infalíveis no instante em que foram escritas, mas **NÃO são AP-29**: elas não mascaram regressão alguma (quem discrimina é a igualdade de status na ordem) e existem para reprovar a **edição futura** que truncar a lista"*.
- A divergência aparente entre `git status` e o `attempt_sha` *"vem de `base_sha` não ser `HEAD`, e **não** de contaminação da T10"* — ele mediu antes de suspeitar.

### Candidato a regra nº 17

`repeated_fixture`: *"o dublê da porta de entrega é sempre o **adaptador de produção** apontado ao par TLS do caso, e o molde mora em `par-do-provedor.ts`"*. Duas cópias, e a segunda nasceu **porque importar um `.spec.ts` registraria os casos dele na importadora** — a mesma causa mecânica do `D32`.

---

## T10 — relatório do executor

- **Duração**: 2398,9 s · 140 tool_uses · 362.050 tokens · **1 criado, 8 modificados**
- **`attempt_sha`**: `3e41e35359d77797f7a16198b298f7986a49800c` — capturado filtrando pelos paths dela; **zero contaminação da T9**
- **Suíte**: `api` **374** (inclui os 2 da T9) · `worker` **132 → 133** · **total 1812**

### ⚠️ Ele DIVERGIU de uma prescrição MINHA, mediu, e estava certo

Eu escrevi no prompt dele que a §19.7 A1 deveria dizer *"a bateria está barrada pela **ADR-0006**, não pela senha"*. **Isso inverte a medição registrada.** O `sdd_state.yaml` desta fatia diz, textualmente:

> *"a bateria completa **NÃO** está barrada pela ADR-0006 (medido com privilégio: `/etc/sysloc/producao` **NÃO** existe e o guarda **libera**) — o que a torna inútil para a task é que ela reprova por **5 falhas pré-existentes ALHEIAS** à fatia."*

Ele escreveu a versão **medida**, e justificou: *"gravar numa spec uma premissa já refutada **neste repositório** é o vetor exato da **R3**"*, invocando o precedente do `CLAUDE.md` — *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito que ela justifica"*.

> **É a sétima confirmação do precedente, e a primeira contra o orquestrador.** Até aqui as divergências corretas foram sempre contra prescrição de **gate**; esta foi contra a minha, e pelo mesmo mecanismo: **eu parafraseei em vez de medir**. A regra vale para quem escreve o prompt tanto quanto para quem o recebe.

### O `CT-1042` prova ausência de acoplamento pela forma certa

Três cenários **equivalentes por construção**, diferindo **só** no estado da entrega — habilitada · desabilitada com motivo · **sem linha alguma** —, com o desfecho comparado como **objeto inteiro** (`toEqual`), não como *"as três concluíram"*. E o **controle discriminante** vem depois: empresa sem certificado, cujo desfecho difere em **todos** os componentes, afirmado por `not.toEqual`.

> *"Um consumidor que passasse a ler `negocio.entrega_da_noticia` e degradasse em silêncio — deixando de estornar quando a entrega está desabilitada — **fica verde** sob 'todas funcionaram' e **reprova aqui**, nomeando o componente que divergiu."*

Mais a metade que a igualdade entre cenários não pega: o estado da entrega é lido **antes e depois**, provando que a conferência **não escreve** nele.

### O `CT-1046` e a asserção que reprovaria com o `D64` aberto

`expect([registro, identidade, ativacao, estadoFinal].map(status)).toEqual([201, 201, 200, 200])` — *"é ela que reprovaria com o `D64` aberto, porque o primeiro ato voltaria `422`"*. O percurso parte do ponto zero **afirmado por leitura** (`404` do certificado; entrega com o discriminador de *"nunca houve tentativa"*), e a tripla de identidade é lida **pelo `openssl`**, caminho independente do SUT.

### O `D6` fechado com medição NOVA, não com a antiga

Varredura de `CT-1[0-9]{3}` em 2026-08-22: o maior em uso é **`CT-1049`** (a **T5** o criou **depois** da medição original do `D6`), e **`CT-1048` é o furo**. A prescrição se confirmou **por medição nova**, não por herança — e ele deixou nos dois arquivos **a nota da premissa falsa de origem**, *"sem ela a próxima leitura 'corrige' o número de volta"*.

### Uma decisão que evitou disparar dois débitos

O `CT-1046` usa o Admin da carga com **as três ausências afirmadas por leitura**, em vez de criar empresa pelas rotas do Master: montá-la assim custaria *"a **terceira** escrita de `montarEmpresaComAdmin` e a **sétima** de `entrarComSegundoFatorCumprido`, disparando o `D32`, cujo fecho exige abrir **cinco suítes alheias** — uma delas declarada somente leitura"*.

### O alargamento que eu havia anotado para verificar — é legítimo

`packages/cobranca-bancaria/test/conversao-do-material.spec.ts` foi tocado **pelo `D6`**, que **eu mesmo** mandei fechar: é a renumeração `CT-1022 → CT-1048`. Verificado: as 3 ocorrências restantes de `CT-1022` naquele arquivo são **a nota explicativa**, não casos. Os demais arquivos fora da §5.2 (`T1.md`, `T7.md`, `T8.md`, `run-report.md`) são **as correções de prosa que os gates endereçaram à T10**.

---

## T9 — Gate 2 (Tech Review) · veredito **APROVADO_COM_OBSERVACOES** · TASK FECHADA

- **Agente**: `opus` · 427,6 s · 30 tool_uses · 152.368 tokens · **1 BAIXO**, nenhum bloqueante
- **Não re-executou a suíte**, com razão declarada: *"o diff é 100% de teste, zero linhas de produção, e os dois arquivos vivem no mesmo pacote que o Gate 1 mediu integralmente e verde. Re-executar mediria exatamente o mesmo conjunto a um custo de montagem alto (240s por suíte e2e), e **nenhum outro pacote pode regredir por um diff sem produção**."*

### A leitura arquitetural mais fina do run — a tensão ADR-0001 × ADR-0034

> *"O dialeto **existe** na saída em execução, dentro de `motivo.diagnostico`; a ADR-0034 registra o desfecho anômalo com o que o terceiro informou, e o `diagnostico` é portador **opaco** no contrato — **não declara chave alguma**, o que é por que abri-lo em execução **não abre a superfície publicada**. A cláusula da ADR-0001 alcança o vocabulário que vira **estrutura** do modelo canônico — `codigo`, `mensagem`, cabeçalho e chave publicada —, e é exatamente esse recorte que o eixo SEM o portador afirma vazio. **O par COM/SEM é o que separa 'o dialeto morreu na fronteira' de 'o varredor está cego'.**"*

Duas ADRs que parecem colidir, reconciliadas por **compartimentação** — e o `CT-1033` é a medição que prova a fronteira, não um teste que a contorna.

### Ele julgou a escolha do destino inerte como SUPERIOR à alternativa

> *"O segredo é decifrado e entregue ao cliente mTLS **antes** de qualquer decisão de rede: com destino `.invalid` o claro está em mão no exato caminho de falha da biblioteca, **que é onde o achado crítico da fase anterior nasceu**. Uma porta instrumentada mediria o desfecho feliz e deixaria de fora justamente a classe que motivou a ADR-0032."*

### E confirmou que a ADR-0032 é satisfeita LITERALMENTE

A `Decision` exige que o segredo não retorne por *"consulta, erro **ou diagnóstico**"*. O `CT-1024` mede **as três**: corpo de consulta (desfechos 5 e 6), corpos de erro (os três `422`) e o **diagnóstico** — mais cabeçalho, diário e documento publicado. E as âncoras antivácuo cobrem *"as três formas de verde falso: **contagem, posição e vacuidade**"*.

### Um achado que ele levantou e descartou — e a razão é o próprio Protocolo

O `adaptadorDaEntregaDoCaso()` constrói o adaptador **a cada operação**, enquanto em produção ele é único por processo. **Não abriu achado**: *"é cópia **fiel** do molde da T7, onde a escolha está justificada por escrito e **já passou por revisão**; reabri-la aqui seria a **R3** que o Protocolo combate"*. Um gate recusando reabrir o que outro gate já fechou.

### ⚠️ E ele achou um defeito NA MINHA escrituração

> *"o bloco `### D32` do `run-report.md` tem a linha `**O que fazer quando disparar:**` **duplicada**, a segunda ocorrência sem a referência ao candidato RC-001."*

**Corrigido.** A causa foi minha: na rodada 3 da T7 eu **reescrevi** os campos `Gatilho` e `Por que não agora` do `D32` e **acrescentei** um `O que fazer` sem remover o antigo. Mantida a versão completa, como o gate recomendou.

> É a **terceira vez neste run** que um gate encontra defeito na escrituração do orquestrador — as anteriores foram os campos de fecho do `D32` desalinhados e a numeração `D1/D2 · F5/T7`. O padrão é consistente: **eu erro ao reescrever bloco existente, não ao criar bloco novo.**

### O `D40` — e por que ele NÃO está coberto pelo `D32`

O gate **mediu** antes de afirmar: o `D32` nomeia três funções de sessão, e *"esta suíte **não é uma das sete** que as copiam"*. A família é a mesma; o gatilho, não. Escriturado nas três pontas, com o índice indo de 37 a **38**.

---

## T10 — Gate 1 (QA, ÚNICO gate) · veredito **APROVADO_COM_OBSERVACOES** · TASK FECHADA · **RUN FECHADO**

- **Agente**: `opus` · 658,6 s · 31 tool_uses · 236.776 tokens · **13/13 critérios** · 1 BAIXO
- **Suíte COMPLETA**: 9/9 pacotes verdes, um a um — **1812**, exatamente o que o `CLAUDE.md` passou a declarar

### Ele pesou a conformidade de forma como o único gate deve pesar

> *"Este é o único gate desta task. **Nada foi deferido a Tech Review**: conformidade de forma foi pesada aqui, e o que caberia ao Gate 2 e é grep-detectável — marcador `DECISÃO FECHADA` intocado, ausência de símbolo test-only em `src`, integridade do `CLAUDE.md` — foi verificado; **o último por execução da barreira, não por leitura**."*

### O `CT-1042` prova ausência de acoplamento, e ele conferiu componente a componente

> *"Conferi que **TODOS** são forma e nenhum é identificador … **Se algum fosse identificador a igualdade seria impossível entre cenários**, porque a série é única por empresa e ano."*

O raciocínio é o inverso do usual e é mais forte: em vez de verificar que os componentes são forma, ele mostrou que a **própria existência** da igualdade entre cenários prova que são. E confirmou o terceiro eixo — a linha **ausente** é retirada por `DELETE` e a ausência afirmada por `toBeUndefined()` **antes** da execução.

### O `CT-1046` e a prova de que o `D64` está fechado

A asserção discriminante é a sequência `[201,201,200,200]` comparada de uma vez: *"confirmei que ela reprovaria com o `D64` aberto: o primeiro ato voltaria `422`"*. E o **AT-4** foi verificado no ponto exato: *"a única ocorrência de `preparar-material-do-certificado.sh` no arquivo é o comentário que declara que ele **NÃO** é invocado; `material-de-teste.ts` chama apenas `openssl` — **a ferramenta que gera o insumo do cliente, não etapa de operação**"*.

### A divergência contra a MINHA prescrição foi confirmada palavra a palavra

> *"O texto final da §19.7 A1 diz o **oposto** da prescrição … e é a versão **MEDIDA**: bate palavra a palavra com o `summary` do `_run/sdd_state.yaml`. **O AT-13 do card carregava a paráfrase; o executor escreveu o fato.** Precedente do repositório aplicado corretamente: prescrição de gate é hipótese, não ordem — e quem divergiu declarando e medindo teve razão."*

### O `D41` — e a ironia que ele não deixou passar

A §5.2 da T10 declara 3 arquivos; o diff tocou 7. Os quatro a mais são escrituração **prescrita**. ⚠️ **A T10 corrigiu a §5.2 da T8 por este mesmo defeito, e repetiu-o na própria** — a classe do candidato nº 12 acontecendo na task cujo trabalho **era** corrigir registros defasados.

### Candidato a regra nº 18 — o maior número desta classe já medido

`VARIAVEIS_MONTADAS` + montagem/restauração de `process.env` replicado em **TRINTA** suítes de `apps/api/test/`, e a nova nasceu como a **30ª**. O custo concreto: as cópias **divergirem no conjunto de variáveis restauradas**, produzindo vazamento de ambiente entre suítes **sem que nada acuse**.

---

# ✅ RUN FECHADO — `integracao-bancaria-autonoma/v1`

| | |
|---|---|
| **Tasks** | **10/10 concluídas**, nenhuma bloqueada |
| **Gates** | **41 invocações** (QA ×22, Tech Review ×19) |
| **Rodadas de correção** | **9** — T5 ×2, T6 ×1, T7 ×2, T8 ×1, mais revalidações |
| **Débitos escriturados** | **41** — 36 `baixo`, 5 `MEDIO` (todos anotáveis por partição), **2 fechados dentro da própria fatia** |
| **Candidatos a regra** | **18** |
| **Marcadores / índice** | **38 / 38**, `São **38**` — fecha nas duas pontas, validado pelo `CT-907` |
| **Suíte** | **1812** casos verdes nos 9 pacotes (de 1788 no início do run) |
| **Superfície** | **105 rotas / 90 manipuladores / 20 públicas** — ⚠️ **as duas últimas rotas do produto** |
| **Arquivos staged** | **93**, +29.804/−616 |

### O que a fatia entregou

**Frente A — autonomia do Admin na entrega da notícia**: estado no banco com RLS forçada (T4), contrato publicado e porta declarada (T5), credencial por família de escopo (T6), **as duas rotas** (T7) e a reconferência por fila (T8).

**Frente B — o `D64` pago nas três pontas**: o produto aceita o material como a AC o entrega, convertendo na borda por processo externo, com três causas de recusa distinguíveis (T1–T3).

**Fecho**: as duas propriedades de contenção provadas por medição da saída real (T9), e a degradação, o percurso ponta a ponta e o índice (T10).

### As duas coisas que saíram do terminal

O Admin agora **habilita a entrega da notícia** e **renova o certificado** pela tela. Eram as duas operações da integração bancária que ainda exigiam acesso ao servidor.
