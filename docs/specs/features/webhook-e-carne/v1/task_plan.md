# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: `webhook-e-carne` — fatia (iii) e última da F4 (integração bancária)
- **Responsável (Tech Lead)**: sysloc (usuário)
- **Data**: 2026-08-18
- **Status**: Concluído
- **Variante**: backend
- **TECH_SPEC**: `docs/specs/features/webhook-e-carne/v1/tech_spec.md`
- **PRD**: `docs/prds/features/webhook-e-carne/v1/prd.md`

---

## 2. Objetivo do Task Plan

A fatia acrescenta **uma entrada** e **uma saída**, e nenhuma regra de liquidação nova.

A **entrada** é uma rota pública única (`POST /v1/notificacoes-bancarias`) que persiste o recebido cru
numa tabela sem `empresa_id`, responde `204` e enfileira. Quem trata é uma tarefa do processo de
trabalho: ela roteia **apenas** pelo identificador que o produto emitiu, descobre a empresa por uma
função `SECURITY DEFINER` **sem parâmetro de empresa**, confere o resto, e deixa que **a consulta ao
provedor decida** o efeito.

A **saída** é o carnê: `GET /v1/contratos/:codigo/carne`, que reúne os boletos de um contrato num
intervalo de competências, **em linha**, compondo sobre `BoletoService.entregar` e mesclando por uma
porta nova satisfeita por `pdf-lib` — que **copia páginas**, sem re-renderizar.

Ao fim das 12 tasks: superfície publicada em **101 pares / 86 manipuladores**, `publicas` em **20**,
`semDeclaracao` **vazio** — e é a **última vez que ela cresce antes da F5**.

---

## 3. Macro-Fases (alto nível)

> A §11 do PRD descreve as **três fatias** da integração bancária (esta é a terceira), e **não**
> decompõe esta fatia em fases internas. As quatro fases abaixo foram propostas a partir do tech spec
> e adotadas pela **Autonomia do Run (A1)** — ver §10.

- **Fase 1 – Fundação e pré-condições**
  - **Objetivo**: destravar a ADR que a spec declara como pré-condição, instalar o substrato de dados
    e a travessia nominal, isolar a lógica pura, e **medir a hipótese do `pdf-lib` antes de fixar a
    dependência** (risco R4).
  - **Tasks**: T1, T2, T3, T4, T5
- **Fase 2 – A entrada da notícia**
  - **Objetivo**: publicar a rota que confirma antes de tratar, e entregar a tarefa que roteia,
    confere, decide, não repete, não acumula, não vaza e retém o que pertence a empresa suspensa.
  - **Tasks**: T6, T7, T8, T9
- **Fase 3 – O carnê**
  - **Objetivo**: entregar o documento único, composto sob demanda e nunca armazenado, e fechar a
    superfície publicada em 101/86.
  - **Tasks**: T10
- **Fase 4 – Borda externa e fecho**
  - **Objetivo**: publicar **um** caminho para fora e prová-lo por medição; fechar o vocabulário nas
    duas direções, o D38 e o índice de débitos nas duas pontas.
  - **Tasks**: T11, T12

---

## 4. Lista de Tasks (visão macro)

| ID  | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
| --- | ------------ | ------- | ---- | ------------ | ---------------------------------- | ------ |
| T1  | Terceira emenda à ADR-0024 — a carga da fila da entrada de terceiro não carrega empresa | [T1](tasks/T1.md) | 1 | — | **Sim** (derivado) | Concluído |
| T2  | Migração 0019 — schema `plataforma`, o recebido cru, os enums da trilha e o renome do D14 | [T2](tasks/T2.md) | 1 | — | **Sim** (derivado) | Concluído |
| T3  | Migração 0020 — papel, política, função de roteamento e o módulo de acesso ao cru | [T3](tasks/T3.md) | 1 | T2 | Não (derivado) | Concluído |
| T4  | Domínio puro — classificação da notícia recebida e predicado de reentrega | [T4](tasks/T4.md) | 1 | — | **Sim** (derivado) | Concluído |
| T5  | Porta de mesclagem e adaptador `pdf-lib` — a hipótese medida antes da dependência | [T5](tasks/T5.md) | 1 | — | **Sim** (derivado) | Concluído |
| T6  | Contrato de fila, produtor e a rota pública da notícia — confirmar antes de tratar | [T6](tasks/T6.md) | 2 | T1, T2, T3 | Não (derivado) | Concluído |
| T7  | A tarefa — da carga ao desfecho, com a consulta ao provedor decidindo | [T7](tasks/T7.md) | 2 | T3, T4, T6 | Não (derivado) | Concluído |
| T8  | Idempotência, expurgo dos 90 dias e a prova de que nada vaza | [T8](tasks/T8.md) | 2 | T7 | Não (derivado) | Concluído |
| T9  | Retenção por suspensão e retomada na reativação — e a emenda do docblock de `reativar` | [T9](tasks/T9.md) | 2 | T7, T8 | Não (derivado) | Concluído |
| T10 | O carnê — contrato do recorte, `CarneService`, rota e entrega | [T10](tasks/T10.md) | 3 | T2, T5, T6 | Não (derivado) | Concluído |
| T11 | A borda externa — vhost dedicado, instalador idempotente e verificador por medição | [T11](tasks/T11.md) | 4 | T6 | Não (derivado) | Concluído |
| T12 | Fecho — vocabulário canônico, o D38 e a reconciliação do índice de débitos | [T12](tasks/T12.md) | 4 | T2, T3, T4, T7, T8, T10 | Não (derivado) | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1 ─────────────────────────────┐
T2 ──┬── T3 ──┐                 │
     │        ├───────────────► T6 ──┬── T7 ──┬── T8 ── T9
     │        │                      │        │
T4 ──┼────────┴──────────────────────┘        │
     │                                        │
T5 ──┴──┐                                     │
        └──────────────────► T10 ◄────────────┘   (T10 ← T2, T5, T6)
                                
T6 ──► T11

T2, T3, T4, T7, T8, T10 ──► T12
```

### 4.2 Derivação do flag de paralelismo (Regra 10d — não autorado por intuição)

**Lote paralelizável da Fase 1: `{T1, T2, T4, T5}`** — exatamente `MAX_PARALLEL = 4`. As cinco
condições do *Invariante de Paralelismo* foram verificadas par a par:

| Condição | Verificação |
|---|---|
| Mesma fase | as quatro são Fase 1 |
| Independência no DAG | nenhuma depende de outra, direta ou transitivamente |
| Disjunção de símbolo | `consumidos(ti) ∩ criados(tj) = ∅` nos dois sentidos — T1 e T4 e T5 não consomem nada; T2 não consome nada |
| Paths disjuntos | T1 `docs/adr/**` + `CLAUDE.md` · T2 `packages/db/**` + `packages/contracts/src/cobranca-bancaria.ts` + `CLAUDE.md` · T4 `packages/cobranca-bancaria/**` · T5 `packages/documentos/**` |
| Alta contenção compartilhada | cada barril tocado pertence a **um** pacote distinto; nenhum é compartilhado entre duas do lote |

⚠️ **Interseção residual conhecida: `CLAUDE.md` entre T1 e T2.** T1 acrescenta a menção à terceira
emenda da 0024 (tabela de leitura obrigatória); T2 remove a linha do D14 (bloco de débitos). São
**blocos distintos** do arquivo, e o orquestrador deve tratar isso pela **ordem determinística de
stage** (ID ascendente). Se o guard de paths do executor for estrito, ele removerá a T1 do lote e
rodará `T1 → {T2, T4, T5}` — **fallback aceitável e conservador**, previsto pela rule.

**T3 é `Não`** por depender da T2 **e** por tocar `packages/db/migracoes/`, cujo diretório é
**migrations ledger** — estado compartilhado pela ordem/numeração, sequencial sempre.

**Fases 2, 3 e 4 são integralmente sequenciais.** Cada task consome símbolo criado pela anterior
(T7←T6, T8←T7, T9←T8) ou toca o mesmo arquivo (T8 e T9 editam
`apps/worker/src/tarefas/notificacao-bancaria.ts`; T11 e T12 editam `CLAUDE.md`). Nenhum par satisfaz
a disjunção — **default na incerteza: `Não`**.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
| ---------------- | ------------------------ | ------------------ | ------ |
| US-01 | Efeito derivado da consulta, gravado pelas funções da fatia (ii), disparado por fila | T7 | A Fazer |
| US-02 | `@HttpCode(204)` e ausência de corpo: não existe lugar em que o desfecho pudesse viajar | T6 | A Fazer |
| US-03 | Coluna `recebido jsonb` gravada **antes** de qualquer interpretação | T2, T6 | A Fazer |
| US-04 | Nenhum caminho de escrita a partir do recebido; o único produtor de efeito é `SituacaoConsultada` | T7 | A Fazer |
| US-05 | Desfecho `SEM_CORRESPONDENCIA` **antes** do ramo que fala com o provedor | T7 | A Fazer |
| US-06 | Roteamento por chave única no SaaS (ADR-0033) + RLS na escrita subsequente | T3, T7 | A Fazer |
| US-07 | A função de roteamento **não tem** parâmetro de empresa; a carga **não** carrega empresa | T1, T3, T6 | A Fazer |
| US-08 | Comparação do número do título recebido × gravado, com evento `NOTICIA_RECUSADA` | T7 | A Fazer |
| US-09 | Idempotência em três camadas, sendo a estrutural o `WHERE` do `UPDATE` | T4, T8 | A Fazer |
| US-10 | Desfecho `RETIDO` + índice parcial + reenfileiramento na reativação | T3, T9 | A Fazer |
| US-11 | Ramo de interpretação que reconhece o pedido de validação **antes** de qualquer roteamento | T4, T7, T11 | A Fazer |
| US-12 | `DELETE` oportunista por `recebido_em`, com índice próprio | T3, T8 | A Fazer |
| US-13 | Terceiro valor de `ORIGENS_DO_EVENTO_BANCARIO`, publicado na trilha | T2, T7 | A Fazer |
| US-14 | Seleção por `(contrato, competência ∈ recorte)` ordenada por vencimento + mesclagem sob demanda | T5, T10 | A Fazer |
| US-15 | Reuso integral de `BoletoService.entregar`, que já distingue ausência de falha real | T10 | A Fazer |
| US-16 | Recusa **antes** de compor, nomeando a primeira cobrança sem título | T10 | A Fazer |
| US-17 | Composição pura sobre os bytes vigentes — nenhum estado guardado entre pedidos | T5, T10 | A Fazer |
| US-18 | Tradução do dialeto num ponto só, provada por varredura da **saída real** | T4, T12 | A Fazer |

**Nenhuma US órfã.** Máximo de tasks por US: **3** (US-07 e US-11) — dentro da regra operacional de
*~3 tasks por user story*.

### 5.1 Rastreabilidade: Critérios de Aceite → Tasks

| CA | Tasks | CA | Tasks |
|---|---|---|---|
| CA-01 | T7, T8 | CA-12 | T3, T8 |
| CA-02 | T4, T6 | CA-13 | T2, T7 |
| CA-03 | T4, T7 | CA-14 | T5, T10 |
| CA-04 | T7, T8 | CA-15 | T10 |
| CA-05 | T7 | CA-16 | T10 |
| CA-06 | T3, T7 | CA-17 | T5, T10 |
| CA-07 | T3, T7 | CA-18 | T10 |
| CA-08 | T7 | CA-19 | T10 |
| CA-09 | T4, T8 | CA-20 | T6, T10, T11 |
| CA-10 | T9 | CA-21 | T7, T12 |
| CA-11 | T4, T7 | | |

### 5.2 Distribuição dos 40 casos de teste (CT-967 a CT-1006)

Cada CT aparece em **exatamente uma** task. Persistido em `_run/test-cases.json`.

| Task | CTs | Qtd |
|---|---|---|
| T1 | — (docs) | 0 |
| T2 | CT-994 | 1 |
| T3 | CT-969, CT-973 | 2 |
| T4 | CT-970, CT-982 | 2 |
| T5 | CT-1002 | 1 |
| T6 | CT-967, CT-971, CT-972 | 3 |
| T7 | CT-968, CT-974, CT-975, CT-976, CT-977, CT-978, CT-979, CT-983, CT-987, CT-993, CT-1006 | 11 |
| T8 | CT-980, CT-981, CT-988, CT-989, CT-990 | 5 |
| T9 | CT-984, CT-985, CT-986 | 3 |
| T10 | CT-995, CT-996, CT-997, CT-998, CT-999, CT-1000, CT-1001, CT-1003, CT-1004 | 9 |
| T11 | CT-1005 | 1 |
| T12 | CT-991, CT-992 | 2 |
| **Total** | | **40** |

---

## 6. Dependências Gerais

### Pré-condição declarada pela tech spec
⚠️ **A T1 é pré-condição da execução, e não uma preliminar opcional.** A §21.5 do tech spec declara um
**conflito spec × ADR-0024** com conduta fechada: sem a terceira emenda, o Gate 2 de toda task que
tocar a carga da fila abre a `Decision`, lê `{ notificacaoId }` e reprova por `adr_compliance` —
achado de severidade **mínima `ALTO`**, que bloqueia **sem convergência**.

### Débitos que a fatia FECHA (marcador sai no mesmo commit, linha sai do `CLAUDE.md`)
| Débito | Task | Gatilho |
|---|---|---|
| **D14 · F4/T6** | T2 | *"a fatia (iii) ao consumir a coluna"* — ela é consumida na conferência |
| **D63 · F4/fechamento** | T6 | *"a próxima suíte E2E que precisar destes acessórios"* — esta fatia traz duas |
| **D5 · F3/T7** | T10 | *"o terceiro consumidor de extração de texto de PDF — o carnê da F4"* |
| **D38 · F4/T10** | T12 | ⚠️ **GATILHO VENCIDO**; o marcador declara a fatia (iii) como dono natural |

### Débitos que a fatia ANOTA (marcador atualizado, não removido)
| Débito | Task | Conduta |
|---|---|---|
| **D58 · F4/T16** | T8 | Terceiro consumidor do discriminador de reentrância. Fechar exige tocar arquivo já aprovado da fatia (ii) — recomendação: intervenção dirigida com os três consumidores no mesmo diff |
| **D52 · F4/T16** | T8 | Terceiro consumidor do molde de varredura. A casa continua em `apps/worker/test/` — o Limiar de Três **não** manda subir de pacote |

### Débitos que NASCEM
| Onde | Task | Dispara quando |
|---|---|---|
| `notificacao-bancaria.service.ts`, junto do `catch` do enfileiramento | T6 | a **F5** (agendamento), ou o primeiro caso real de fila indisponível na recepção |
| `tarefas/notificacao-bancaria.ts`, junto da conferência | T7 | quando o produto modelar a identidade da empresa perante o provedor — **o mesmo gatilho do D36 · F4/T10** |
| `deploy/nginx/sysloc-notificacao-bancaria.conf` | T11 | a **publicação da API inteira na F7** |

### Débitos que NÃO disparam (medido, registrado para que a próxima fatia não redescubra)
- **D34 · F4/T11** — a notícia **não** fornece a chave de correlação; o gatilho precisa ser emendado (recomendação registrada na T12)
- **D26 · F4/T9** — expurgo dos boletos em disco: fora do escopo por decisão de 2026-08-18; gatilho continua na F5
- **D12 · F3/T10** — esta fatia não envia e-mail algum
- **D23, D24, D27 (F1)** — confirmado **por medição nesta spec**: o vhost publica **um** caminho, a notícia é chamada entre servidores sem cabeçalhos de navegador, e o D24 exige a API inteira publicada

### Dependências externas
- **`pdf-lib`** — dependência nova, introduzida na T5 e **medida antes de ser fixada** (risco R4)
- **O provedor (Sicoob)** — o passo 3 do rollout (cadastrar o webhook, CA-20) é **ato operacional do
  usuário** no portal do provedor, e depende do risco R1

### Bloqueios e pré-requisitos do time
- ⚠️ **Risco R1** — o certificado em uso **vence em 2026-08-22** (medido em 2026-08-16). CA-01, CA-04,
  CA-15 e CA-20 dependem de conversa com o provedor. Decisão do usuário de 2026-08-16: **assumir a
  renovação e seguir o plano**. As tasks que **não** dependem do provedor (T1 a T6, T9, T11, T12, e a
  parte do carnê com arquivos em disco) avançam mesmo com o risco aberto.
- ⚠️ **`[DÚVIDA] 4` do discovery** — qual hostname atende a borda — continua **aberta**, é decisão
  operacional do usuário, e por isso o vhost e o verificador da T11 leem o hostname de **configuração**.

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:
- [x] Todas as 12 tasks estiverem `Concluído`, aprovadas nos gates declarados
- [x] As **18 User Stories** cobertas (tabela §5) e os **21 Critérios de Aceite** verificados (§5.1)
- [x] Os **40 casos de teste** (CT-967 a CT-1006) implementados, sem lacuna e sem reuso de número — mais **CT-1007** (T9), **CT-1008** e **CT-1009** (T12, fecho do D38), numerados sem colisão (varredura do Gate 1 da T12: o último alocado era o CT-1007)
- [x] Suíte verde, medida **pacote a pacote** nos nove pacotes — **1710 casos** (contracts 398 · api 349 · shared 249 · db 225 · documentos 158 · worker 122 · auth 89 · cobranca-bancaria 90 · regua 30)
- [x] Superfície publicada em **101 pares / 86 manipuladores**, `publicas` **20**, `semDeclaracao` **vazio**, com as duas medições concordando — afirmado no CT-1004 (T10), com prova de falsificação registrada
- [x] `verificar-migracao.sh` e `verificar-notificacao-bancaria.sh` **verdes**. O primeiro foi confirmado em **2026-08-19, após o fecho do run**, e exigiu um passo operacional que nenhum agente podia executar: o `provisionar-base.sh` (passo **P15**, que esta fatia ampliou para criar o papel `sysloc_roteamento`) não havia sido reexecutado no cluster, de modo que a `0020` abortava — **limpa, dentro da transação, com `HINT` nomeando o script e o passo**. Sequência que fechou: provisionar → `pnpm build` → migrar → reiniciar serviços → verificar. Produção passou de `0018` para `0020`, e `plataforma.notificacao_bancaria` passou a existir
- [x] **Provas de falsificação executadas** para as três asserções estáticas: CT-991 (reproduzida **pelo próprio Gate 1**, não aceita por declaração), CT-1004 (controle 17/17 → mutante `expected 100 to be 101` → reversão) e o isolamento do `pdf-lib` (T5)
- [x] Índice de débitos reconciliado **nas duas pontas** — 29 pares distintos de marcador ↔ 29 linhas, prosa dizendo *"São 29"*, conferido **com multiplicidade** (os dois `D13 · F4/T6`) e descontando o `D99 · F7/T3`, que é fixture da barreira
- [x] ADR-0024 emendada (terceira emenda, 2026-08-18, texto original preservado) e `Applied in` da 0024 e da 0035 citando `webhook-e-carne (v1)`
- [x] Nenhum `DECISÃO FECHADA` alterado, movido ou removido — varrido pelos gates em todas as tasks; docblocks de `reativar` e de `fila.ts` emendados com texto original preservado

---

## 8. Riscos & Mitigações

| # | Risco | Mitigação | Tasks expostas |
|---|---|---|---|
| R1 | ⚠️ **O certificado vence em 2026-08-22** | Decisão do usuário: assumir a renovação. As tasks independentes do provedor avançam | T7, T8, T10 (rebusca), T11 (passo 3) |
| R2 | A prova de que o identificador volta íntegro alcança só o caminho de **consulta** | **Medir aqui, não herdar por citação**: a primeira notícia real recebida é a medição. Até ela, `ILEGIVEL` preserva o recebido íntegro — é a razão de o cru ser gravado **antes** de interpretar | T6, T7 |
| R4 | `pdf-lib` pode re-renderizar ou perder conteúdo | Hipótese **medida antes** de fixar a dependência (CT-1002). Falhando, a fatia **para e escala** — não há plano B na stack | T5 |
| R8 | `ALTER TYPE … ADD VALUE` fora de bloco transacional | O valor novo entra na `0019` (domínio), separado das concessões da `0020`; conferir num banco efêmero antes do durável | T2 |
| R9 | Publicar um caminho para fora muda a postura de segurança | O verificador afirma **por medição** que nenhum outro caminho responde, e que o vhost da operação não foi tocado | T11 |
| R10 | O renome do D14 alcança `cobranca_derivada`, que expandiu `c.*` | Renome e recriação da visão na **mesma** migração; as **três** cópias de `COLUNAS_DA_COBRANCA` no mesmo diff (medido — o marcador diz "duas") | T2 |
| R11 | ⚠️ **`drizzle-kit generate` VAI propor `CREATE SCHEMA "plataforma"`** — esta é a **primeira** fatia a declarar tabela lá | Suprimir **e declarar a supressão em comentário de cabeçalho** da `0019`; a asserção **(e)** do `verificar-migracao.sh` é o detector | T2 |
| — | **Laço de gate longo** na task grande da tarefa | A tarefa foi **partida em T7 e T8** — o precedente medido é a T4 da fatia (ii), fechada em **5 rodadas / 9 invocações de gate**, com `MEDIO/architecture` inédito nas rodadas 3 e 4 | T7, T8 |
| — | **Divergências declaradas do tech spec** (alocação do CT-990 e da suíte do CT-983) | Registradas na §7 das tasks T8 e T7, com a razão, para que o Gate 2 não as leia como `scope_deviation` | T7, T8 |

---

## 9. Heurística de modelo, risk e gates

| Task | model | risk | gates | Justificativa |
|---|---|---|---|---|
| T1 | opus | medium | `none` | `tipo=docs` — ADR + índice; nenhum código executável |
| T2 | opus | high | `[qa, tech_review]` | `tipo=db_migrations` |
| T3 | opus | high | `[qa, tech_review]` | `db_migrations` + `security` (papel, política, `SECURITY DEFINER`) |
| T4 | opus | low | `[qa]` | `service_simples` — duas funções puras, sem I/O |
| T5 | opus | medium | `[qa, tech_review]` | `padrao_novo` — porta+adaptador novos e dependência externa nova |
| T6 | opus | high | `[qa, tech_review]` | path em `auth`/`security` — rota pública, superfície publicada |
| T7 | opus | high | `[qa, tech_review]` | `service_complexo` — ≥2 sentinelas, side-effect externo |
| T8 | opus | high | `[qa, tech_review]` | `security` (varredura de segredo) + retenção de dado pessoal |
| T9 | opus | medium | `[qa, tech_review]` | toca `EmpresaService` (ciclo de acesso) e emenda docblock sob risco de R3 |
| T10 | opus | medium | `[qa, tech_review]` | `service_complexo` + publica rota e cresce a superfície |
| T11 | opus | high | `[qa, tech_review]` | `security` — primeira publicação do produto para fora |
| T12 | opus | low | `[qa]` | testes + escrituração; nenhum código de domínio novo |

⚠️ **`model: opus` em TODAS as tasks, sem exceção.** É decisão do usuário registrada no `CLAUDE.md`,
sem negociação: *"este projeto roda exclusivamente em Opus… Sonnet e Haiku estão proibidos, mesmo
quando a skill os recomenda no próprio `SKILL.md` ou quando a heurística de `gates`/`model` do
`agent-spec-workflow-rules.md` os sugeriria. Onde a regra do framework mandar `sonnet`, leia `opus`"*.
Vale para o executor **e** para os dois gates.

---

## 10. Decisões auto-resolvidas pela Autonomia do Run (A1)

`.claude/rules/autonomia-do-run.md` é autorização **permanente** e manda **decidir pela recomendada e
registrar**. Nenhuma pergunta bloqueou a geração deste plano.

| # | Decisão | Alternativas | Adotada | Razão |
|---|---|---|---|---|
| 1 | Estrutura de fases | 3 fases (fundação · entrada · saída) · **4 fases** · 5 fases | **4 fases** | A borda externa e o fecho não pertencem nem à entrada nem ao carnê: a primeira é infraestrutura com verificador próprio, o segundo só pode rodar depois que **tudo** existe |
| 2 | A emenda da ADR-0024 é task ou pré-passo absorvido? | absorver na T2 · **task própria (T1)** | **task própria** | A spec a declara *"pré-condição da T1"*, e ela destrava o Gate 2 de **todas** as tasks da Fase 2. Absorvida, o gate avaliaria a ADR e o código que dela depende no mesmo veredito |
| 3 | A tarefa do worker é uma task ou duas? | uma task (16 CTs) · **duas (T7 e T8)** | **duas** | Precedente medido: a T4 da fatia (ii) fechou em **5 rodadas / 9 invocações de gate**, com bloqueante inédito nas rodadas 3 e 4. A partição produz duas entregas completas e reviewáveis |
| 4 | O carnê é uma task ou duas? | **uma (T10)** · duas (contrato+serviço / rota+E2E) | **uma** | Regra 9: **1** arquivo de contrato + 1 handler → OK em uma task. Partir fragmentaria a suíte do Fluxo B entre duas tasks, sem ganho |
| 5 | Onde vive o CT-991 (varredura estática de vocabulário) | na T4, com as funções puras · **na T12, com a irmã CT-992** | **T12** | Ela varre o texto-fonte de módulos criados em **três** tasks distintas. Alocá-la na T4 criaria dependência artificial em T2 e T3 e **derrubaria o lote paralelo da Fase 1** |
| 6 | Onde vive o CT-990 (varredura de segredo) | `apps/api/test/segredo-nao-escapa.e2e.spec.ts` (§19.3 do tech spec) · **`apps/worker/test/notificacao-bancaria.spec.ts`** (§11.6) | **suíte do worker** | A §11.6 é a seção **operativa**: nomeia os quatro canais (**argumentos, carga, log, mensagem de falha**) e declara o D52. A suíte da API **não tem acesso** à carga da fila nem ao diário do processo — dois dos quatro canais. Divergência registrada na §7 da T8 |
| 7 | Como a âncora da superfície cresce | um salto de 99/84 → 101/86 na última task · **dois saltos: 100/85 (T6) e 101/86 (T10)** | **dois saltos** | `.claude/rules/ancoras-de-superficie.md` manda a âncora **no mesmo diff da publicação**, e as duas rotas nascem em tasks distintas |
| 8 | Escopo da migração dos acessórios de borda (D63) | converter as ~30 suítes · **criar a casa e usá-la nas suítes novas** | **criar a casa** | Converter tudo num diff é refatoração cross-module que ninguém pediu (§4.5 do Protocolo Antirregressão). O D63 fecha porque a **casa passa a existir**; a adoção segue pelo caminho normal |
| 9 | Geração da §6 das tasks | invocar o `agent-spec-qa-test-generator` · **redistribuir da §19 do tech spec** | **redistribuir** | O tech spec traz **40 CTs detalhados** (≥ 10), o que aciona a heurística de redistribuição sem reinvocação. Nenhuma task ficou sem CT correspondente, exceto a T1 (docs, `N/A` declarado) |
| 10 | Apresentação das fases ao usuário antes de escrever | perguntar e aguardar · **decidir, apresentar e seguir** | **decidir e seguir** | A A1 proíbe pausar aguardando resposta. A estrutura foi apresentada ao usuário na resposta do terminal, com o convite explícito a alterá-la |

---

## 11. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas (12 tasks, 4 fases)
- [x] Dependências validadas e reconciliadas (a §1 de cada `TN.md` é autoritativa)
- [x] `Símbolos públicos criados` / `Símbolos consumidos de outras tasks` preenchidos em cada `TN.md` (Regra 10a)
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + alta contenção (Regra 10d)
- [x] Invariante satisfeito: nenhuma task `Sim` depende (direta ou transitivamente) de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida (18/18, sem órfã)
- [x] Rastreabilidade Critérios de Aceite → Tasks preenchida (21/21)
- [x] 40 CTs distribuídos, cada um em **exatamente uma** task
- [x] `_run/test-cases.json` persistido com `task_id` por caso
- [x] Seção 6 preenchida em cada task (6.0, tabelas-índice, 6.5 e 6.6 com um card por CT)
- [x] Arquivos impactados listados em cada task (5.1, 5.2, 5.3), com **blast radius declarado** onde há estado compartilhado
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] ADRs aplicáveis propagadas por task (subconjunto por intersecção com §5.1/§5.2)
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Comentários `<!-- LLM-ONLY: ... -->` removidos dos arquivos finais
- [x] Nenhuma informação inventada — divergências entre a spec e a medição estão **declaradas**, não silenciadas
- [x] Pronto para execução
