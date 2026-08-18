# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: `emissao-e-conciliacao` — fatia (ii) da F4 (integração bancária)
- **Responsável (Tech Lead)**: sysloc (usuário) · Task Plan conduzido por `/agent-spec-sdd-generate-task-plan`
- **Data**: 2026-08-16
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/emissao-e-conciliacao/v1/tech_spec.md`
- **PRD**: `docs/prds/features/emissao-e-conciliacao/v1/prd.md`
- **Variante**: `backend` · **Executor padrão**: `sysloc-backend-implementer` · **Modelo**: `opus` em **todas** as tasks (decisão do usuário no `CLAUDE.md`; Sonnet e Haiku estão proibidos neste repositório)

---

## 2. Objetivo do Task Plan

Entregar a fatia que **gera dinheiro**: emitir boletos em lote por competência e pontualmente, revogar e reemitir sem nunca deixar dois boletos pagáveis, entregar o arquivo do boleto, liquidar e estornar a partir do que o provedor responde, conferir diariamente sob comando, e publicar por rota a trilha bancária de cada cobrança. Ao final, as **seis informações hoje órfãs** da cobrança passam a ter produtor, e nenhum termo do provedor vira regra ou estado do produto.

São **17 tasks em 5 fases**, decompostas **por camada**, seguindo a direção de dependência que a ADR-0025 impõe: contrato → banco → domínio → borda → fecho.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Contrato e esquema**
  - Objetivo: publicar o vocabulário da fatia em `@sysloc/contracts` e fazer nascer no banco as quatro tabelas, os três enums **derivados** dele, a coluna interna do identificador e os dois índices únicos parciais.
  - Tasks: T1, T2
- **Fase 2 – Camada de dados**
  - Objetivo: toda instrução SQL da fatia, publicada como função de domínio — a trilha, o lote, a conferência e o fato bancário da cobrança.
  - Tasks: T3, T4, T5, T6
- **Fase 3 – Domínio e adaptador**
  - Objetivo: a porta que a ADR-0001 reserva, o adaptador que a satisfaz, a guarda dos bytes e os três atos compostos do domínio (lote, reemissão, conferência).
  - Tasks: T7, T8, T9, T10, T11, T12
- **Fase 4 – Borda HTTP e processo de trabalho**
  - Objetivo: as sete rotas, os serviços de aplicação, as duas filas e as duas bordas de tarefa.
  - Tasks: T13, T14, T15, T16
- **Fase 5 – Fecho**
  - Objetivo: as âncoras que só são medíveis com tudo publicado — superfície por dupla medição, vocabulário na saída real, autorização das sete rotas, contrato publicado — e a reconciliação do `CLAUDE.md`.
  - Tasks: T17

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Contratos publicados da cobrança bancária (esquemas, enums, 23 campos; fecha **D1**) | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | Esquema Drizzle e migrações `0017`/`0018` (4 tabelas, RLS forçada, 2 índices parciais) | [T2](tasks/T2.md) | 1 | T1 | Não | Concluído |
| T3 | Trilha bancária na camada de dados | [T3](tasks/T3.md) | 2 | T2 | Não | Concluído |
| T4 | Dados da emissão em lote (predicado do conjunto, lote concorrente) | [T4](tasks/T4.md) | 2 | T2 | Não | Concluído |
| T5 | Dados da conferência bancária (conjunto a conferir, conferência concorrente) | [T5](tasks/T5.md) | 2 | T2 | Não | Concluído |
| T6 | Dados do boleto: emissão, liquidação, estorno, revogação, 5 campos publicados | [T6](tasks/T6.md) | 2 | T2, T3 | Não | Concluído |
| T7 | A porta `AdaptadorCobrancaBancaria` e o modelo canônico (fecha **D27**) | [T7](tasks/T7.md) | 3 | T1 | Não | Concluído |
| T8 | Adaptador Sicoob: 4 operações e cache de credencial (⚠️ **D36 NÃO fecha** — emendado; sem origem para `client_id`/`scope`) | [T8](tasks/T8.md) | 3 | T7 | Não | Concluído |
| T9 | Guarda de boletos, provisionamento e verificador de infraestrutura | [T9](tasks/T9.md) | 3 | T7 | Não | Concluído |
| T10 | `executarEmissaoEmLote` — percurso, RN-02 e prestação de contas | [T10](tasks/T10.md) | 3 | T4, T6, T7, T9 | Não | Concluído |
| T11 | `reemitirBoleto` — revogar, sondar, emitir num ato só | [T11](tasks/T11.md) | 3 | T6, T7, T9 | Não | Concluído |
| T12 | `conferirCobrancas` — liquidar, estornar e revogar sem cancelar | [T12](tasks/T12.md) | 3 | T5, T6, T7 | Não | Concluído |
| T13 | `BoletoService`, rotas de emissão e revogação, composição raiz da API | [T13](tasks/T13.md) | 4 | T6, T8, T9, T11 | Não | Concluído |
| T14 | Entrega do boleto (bytes, ADR-0028) e histórico bancário | [T14](tasks/T14.md) | 4 | T13 | Não | Concluído |
| T15 | Lote e conferência na borda: 3 rotas, 2 filas (fecha **D58**) | [T15](tasks/T15.md) | 4 | T4, T5, T13 | Não | Concluído |
| T16 | Processo de trabalho: 2 bordas de tarefa e 9 variáveis de ambiente | [T16](tasks/T16.md) | 4 | T10, T12, T15 | Não | Concluído |
| T17 | Fecho: superfície 99/84, vocabulário, autorização, `CLAUDE.md` | [T17](tasks/T17.md) | 5 | T13, T14, T15, T16 | Não | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1 ─┬─> T2 ─┬─> T3 ──> T6 ─┬─> T10 ──┐
    │       ├─> T4 ────────┼─> T11 ──┼─> T13 ─┬─> T14 ──────────┐
    │       ├─> T5 ────────┴─> T12 ──┘        ├─> T15 ─> T16 ───┼─> T17
    │       └─> T6                             └──────────────────┘
    └─> T7 ─┬─> T8 ──────────────────────────> T13
            └─> T9 ─┬─> T10
                    ├─> T11
                    └─> T13

Arestas completas (fonte: seção 1 de cada TN.md):
T2←T1 · T3←T2 · T4←T2 · T5←T2 · T6←T2,T3 · T7←T1 · T8←T7 · T9←T7
T10←T4,T6,T7,T9 · T11←T6,T7,T9 · T12←T5,T6,T7
T13←T6,T8,T9,T11 · T14←T13 · T15←T4,T5,T13 · T16←T10,T12,T15
T17←T13,T14,T15,T16
```

### 4.2 Por que a coluna de paralelismo é `Não` em todas — derivação, não intuição

Aplicado o **Invariante de Paralelismo** de `.claude/rules/agent-spec-workflow-rules.md` (Regra 10d) a cada par da mesma fase. Nenhum par satisfaz as cinco condições, e o motivo é **estrutural**, não conservadorismo genérico:

| Fase | Par | Condição que falha |
|---|---|---|
| 1 | T1 × T2 | **DAG**: T2 é descendente de T1 (consome os três enums) |
| 2 | T3 × T4 × T5 × T6 | **Alta contenção**: as quatro publicam em `packages/db/src/index.ts` (barrel) e fazem crescer a mesma âncora `packages/db/test/unidade-de-trabalho.spec.ts` (CT-012, que audita **por igualdade**). Além disso T6 é descendente de T3 |
| 3 | T7 × {T8…T12} | **DAG**: as cinco são descendentes de T7 |
| 3 | T8 × T9 × T10 × T11 × T12 | **Alta contenção**: as cinco publicam em `packages/cobranca-bancaria/src/index.ts` (barrel) e tocam `test/vocabulario-canonico.spec.ts`; T10/T11 dependem de T9 |
| 4 | T13 × T14 × T15 × T16 | **DAG** (T14←T13, T15←T13, T16←T15) e **paths**: T13/T14 tocam `boleto.service.ts` e `cobranca.controller.ts`; T13/T14/T15 tocam `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`; T15 toca `apps/api/src/app.module.ts` (alta contenção) |
| 5 | — | task única |

**Invariante satisfeito**: nenhuma task marcada `Sim` depende de outra da mesma fase — porque nenhuma está marcada `Sim`. Falso-sequencial custa minutos; falso-paralelo corrompe a ordem.

> **Guard de recursos de teste, para o orquestrador**: mesmo em execução sequencial, várias tasks trazem suítes de integração/E2E com banco e fila reais no mesmo working tree. Rode QA de uma por vez (é o default aqui, já que não há lote paralelo).

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| US-01 — emitir de uma vez os boletos de uma competência | §7.2 `emissao_em_lote` + índice único parcial; §9.1 fila `emissao-em-lote`; predicado `selecionarCobrancasSemBoleto` | T4, T10, T15, T16 | A Fazer |
| US-02 — o lote presta contas do que saiu e do que não saiu | §7.2 `item_da_emissao_em_lote`; §4.2 `esquemaDaEmissaoEmLote` com `itens[]`, `emitidas`, `recusadas` | T1, T4, T10, T15 | A Fazer |
| US-03 — falha da empresa interrompe o lote na hora | §6.3 `ClasseDaFalha`; `interrompido_em` + `motivo_da_interrupcao` com CHECK bicondicional | T10, T16 | A Fazer |
| US-04 — reemitir sem deixar dois boletos pagáveis | §5.2 A–C `reemitirBoleto` com sondagem de limite nomeado; três das quatro operações da porta | T7, T11, T13 | A Fazer |
| US-05 — obter o boleto para entregar ao locatário | §4.1 rota de bytes (ADR-0028); `guarda-de-boletos.ts`; `consultarSituacao({ incluirDocumento: true })` | T9, T14 | A Fazer |
| US-06 — o pagamento aparece sozinho, com data e valor | §5.1 `acusarPagamentoDeCobranca` **reusada sem alteração** + `data_credito`/`valor_creditado` | T6, T12 | A Fazer |
| US-07 — o estorno devolve a cobrança ao estado anterior | §5.2 H `estornarLiquidacao` — oito campos numa instrução; estado volta a derivar da view | T6, T12 | A Fazer |
| US-08 — o histórico explica por que a cobrança mudou | §7.2 `evento_bancario` (6 tipos × 2 origens); índice `(empresa_id, cobranca_id, ocorrido_em DESC)` | T1, T3, T14 | A Fazer |
| US-09 — disparar a conferência sob comando, sem duplicar | §7.2 `conferencia_bancaria` + índice único parcial; `iniciadaAgora` no corpo | T5, T15 | A Fazer |
| US-10 — boleto retirado não apaga a dívida | §6.3 RN-09/RN-10: `revogarBoleto` **não nomeia `cancelado_em` no `SET`** | T6, T12 | A Fazer |
| US-11 — conferência diária alcança o que ainda importa | §5.1 `selecionarCobrancasAConferir` — predicado único, janela de 30 dias contra `data_corrente_da_operacao()` | T5, T12, T16 | A Fazer |
| US-12 — a cobrança publica as informações hoje órfãs | §4.2 `esquemaDaCobranca` 18 → 23 campos; `LinhaDeCobranca` estendida | T1, T2, T6, T13 | A Fazer |
| US-13 — vocabulário do provedor não vira regra nem estado | §11.4, §19, §21.1 — modelo canônico, tradução que morre no adaptador, varredura com controle positivo | T7, T8, T17 | A Fazer |

> **Nenhuma US órfã.** Três delas (US-01, US-02, US-12) aparecem em **4** tasks, acima da regra operacional de ~3. A decomposição foi revisada e mantida: as três atravessam **contrato → dados → domínio → borda → worker** por natureza — é o percurso completo da emissão —, e o corte é pela fronteira arquitetural que a ADR-0025 impõe, não fragmentação. Consolidá-las produziria tasks cross-camada que os gates reprovariam por escopo.

---

## 6. Dependências Gerais

**Entre tasks**: a seção 4.1 é a fonte. A seção 1 de cada `TN.md` é **autoritativa** em divergência com a tabela (regra de reconciliação do orquestrador: em conflito, vale a **união**).

**Externas / pré-requisitos**:

- **A fatia (i) `fundacao-bancaria` é pré-requisito integral** — a identidade da empresa perante o provedor, a guarda do material cifrado e `proximoIdentificadorBancario` vêm de lá, prontos. Ela fechou em 2026-08-15 (14/14 tasks).
- ⚠️ **O certificado A1 em uso vence em 2026-08-22.** Decisão do usuário em 2026-08-16: **assumir a renovação**. Nenhuma task deste plano exige chamada real ao provedor — a ADR-0006 a proíbe na suíte, e `ENDERECO_DO_PROVEDOR_BANCARIO` aponta para domínio `.invalid` na verificação —, então **o vencimento não bloqueia a execução**; ele bloqueia a operação real depois dela.
- **Nada da F3 é reescrito**: cobrança, mora, régua e derivação de estado são **consumidas como estão**.
- **Nenhuma dependência externa nova** é introduzida. O pacote `cobranca-bancaria` segue com **zero dependência externa**.

**Débitos com gatilho que este plano fecha**: **D1 · F3/T2** (T1), **D27 · F4/T8** (T7), **D36 · F4/T10** (T8), **D58 · F4/T13** (T15), e a lacuna do **D39 · F1** no que toca ao diretório dos boletos (T9). Cada marcador sai **no mesmo commit** da correção, junto com a linha do índice do `CLAUDE.md`.

**Débitos que este plano abre**: expurgo do diretório dos boletos (T9), coerência entre os campos de conciliação sem restrição no banco (T6) e `nosso_numero` como vocabulário do provedor em coluna (T6). A numeração `Dnn` sai da **§2 do `run-report.md` desta fatia** na execução — não deste plano, e não da sucessão dos marcadores existentes (§3-B da `.claude/rules/nao-regressao.md`).

**Débitos a conferir contra o diff** (podem disparar, e a medição é de quem executa): **D5 · F3/T7** (T14), **D25 · F4/T7** (T5), **D26 · F3/T8** (T6), **D49 · F3/T10** (T16), **D57 · F3/T12** (T15, T17), **D61 · F4/T14** (T17), **D63 · F4/fechamento** (T13, T14, T15).

---

## 7. Critérios de Conclusão da Feature

- [ ] As 17 tasks concluídas, aprovadas nos dois gates
- [ ] Os **38** casos `CT-911`…`CT-948` implementados, com a suíte verde **medida por pacote** (`pnpm --filter @sysloc/<pacote> test` — o `turbo run test` aborta os irmãos)
- [ ] As três asserções estáticas (CT-933, CT-936, CT-946) com **prova de falsificação** registrada
- [ ] Toda varredura de não-vazamento e de vocabulário com **controle positivo** afirmado por igualdade
- [ ] Os 20 critérios de aceite do PRD verificados; nenhuma US órfã
- [ ] Superfície publicada fechada por **dupla medição independente** (99/84 é estimativa — **se a medição divergir, vale a medição**), `semDeclaracao` vazio e catálogo em 17 chaves
- [ ] Os cinco débitos fechados tiveram marcador **e** linha de índice removidos; os três abertos têm marcador, linha e entrada na §2 do `run-report.md`
- [ ] `pnpm lint` (Biome + `lint:shell`) limpo
- [ ] `CLAUDE.md` reconciliado: superfície, contagem de casos e as **duas pontas** do índice de débitos
- [ ] Nenhuma migração de `0000` a `0016` alterada — `sha256sum` inalterado

---

## 8. Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| **Regressão na fatia (i)** ao estender `modelo-canonico.ts` e `adaptador-sicoob.ts` — arquivos com `DECISÃO FECHADA` e dois `DÉBITO COM GATILHO` | Baseline **por pacote** antes e depois (P1/P5); os marcadores são lidos antes de cada edição; alterar código sob `DECISÃO FECHADA` sem escalar é violação crítica |
| **A contagem 92→99 / 77→84 é estimativa** | A T17 roda a dupla medição. **Se divergir, vale a medição** — precedente confirmado cinco vezes nesta base; corrige-se a prosa, nunca o código |
| Dois lotes concorrentes emitindo dois boletos para a mesma cobrança | **Índice único parcial no banco** (T2), não checagem de aplicação; CT-916 mede as duas pontas (recusa e reaceitação após conclusão) |
| Revogação aceita e emissão falha deixa a cobrança sem boleto | Desfecho **declarado** da CA-06, não falha; o **lote seguinte** a recolhe pelo predicado (⚠️ **não** a conferência — a §5.2 da tech spec corrige o D3 do tech-alignment nesse ponto) |
| `nossoNumero` retorna **inteiro** e o contrato supõe cadeia | Coerção **na fronteira** do adaptador (T8), com caso que a exercita |
| A chave de cifra passa a ser declarada em **dois** processos | Trade-off aceito e declarado (D1 do tech-alignment): o material **não trafega pela fila**, e a superfície `fila` entra na enumeração da ADR-0032 medida com controle positivo (T15, fecha o D58) |
| O diretório dos boletos cresce sem expurgo (~1,4 GB/mês projetado) | Débito com gatilho declarado (T9); o arquivo é **cache recuperável** e a re-obtenção da CA-08 torna a perda inofensiva |
| Colisão de identificadores de caso de teste | A faixa `CT-911`…`CT-948` foi **medida** contra a base (`grep -rhoE "CT-[0-9]{3}" apps packages`), não estimada — os `CT-901`…`CT-910` já pertencem à barreira do Protocolo Antirregressão |

---

## 9. Observações de geração

1. **Distribuição dos casos: via JSON, sem reinvocar o gerador de QA.** O `_run/test-cases.json` já trazia os 37 casos lossless da fase de tech spec, com `criterios_aceitacao_validados` preenchidos — o caminho primário previsto em `qa-delegation-tasks.md`. O `task_id` foi gravado em cada caso; o `_run/qa_context.md` foi extraído para auditoria e para eventual fallback.
2. **`CT-948` é acréscimo declarado**, por decisão do usuário em 2026-08-16. A árvore §3.4 da tech spec lista `apps/worker/test/conferencia-bancaria.spec.ts` como suíte nova e a §19 **não lhe alocou caso algum**: a borda da conferência ficaria sem prova de que recusa a carga antes de abrir o contexto — o modo de falha que o docblock de `regua.ts` nomeia como o pior possível. Ele é **espelho do CT-944**. A fatia passa de **37 para 38** casos, e a **T17** reconcilia toda contagem escrita em prosa.
3. **`CT-929` mora em `packages/db/test/conferencia-bancaria.spec.ts`**, e não no arquivo que a §19 indicou. O `owning_layer` do caso é dados, a árvore §3.4 lista essa suíte como nova, e a observação do próprio caso no JSON admite os dois arquivos. Sem isso, a T5 ficaria sem prova própria e a suíte da árvore ficaria órfã.
4. **Cada CT aparece na seção 6 de exatamente uma task** — conferido por varredura; nenhum duplicado, nenhum órfão.
5. **Toda task roda em `opus`** e com `gates: [qa, tech_review]`. A heurística de `gates` do framework permitiria `[qa]` em algumas, mas **nenhuma** desta fatia se qualifica: todas tocam migração, segredo, contrato publicado, padrão novo ou serviço com efeito externo.

---

## 10. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas (17, em 5 fases)
- [x] Dependências validadas e reconciliadas com a seção 1 de cada `TN.md`
- [x] Flag de paralelismo **derivado** (Regra 10d), com a razão de cada `Não` registrada na §4.2
- [x] Rastreabilidade User Stories → Tasks preenchida (13/13 cobertas)
- [x] Seção 6 preenchida em cada task, com 6.0, 6.5 e 6.6 (1 card por CT)
- [x] `_run/test-cases.json` atualizado com `task_id` em todos os 38 casos
- [x] Pronto para execução — **executado e concluído em 2026-08-18: 17/17 tasks, os dois gates em todas**
