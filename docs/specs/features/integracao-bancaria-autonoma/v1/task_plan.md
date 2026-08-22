# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: `integracao-bancaria-autonoma` — F5, fatia (i): autonomia do Admin na integração bancária
- **Variante**: **backend**
- **Responsável (Tech Lead)**: sysloc
- **Data**: 2026-08-21
- **Status**: Rascunho
- **TECH_SPEC**: `docs/specs/features/integracao-bancaria-autonoma/v1/tech_spec.md`
- **PRD**: `docs/prds/features/integracao-bancaria-autonoma/v1/prd.md`

---

## 2. Objetivo do Task Plan

Tirar do terminal as **duas** operações da integração bancária que ainda exigem servidor, e entregar o
contrato delas antes do congelamento da superfície:

- **Frente B — aceitar o material como a AC o entrega.** O produto passa a converter, na borda de
  registro e por processo externo de vida curta (ADR-0036), o material que o runtime não abre;
  distingue **três** causas de recusa pelo **código** do envelope; e informa quando houve conversão.
  **Fecha o débito `D64 · F4/fechamento`.**
- **Frente A — habilitar e consultar a entrega da notícia do provedor, por empresa.** Duas rotas
  novas, o ciclo **cadastrar→confirmar**, o estado persistido com o **motivo íntegro** da última
  recusa, e a reconferência **enfileirada** disparada pelo registro do certificado.

Ao fim, a superfície publicada vai de **103 / 88 / 20** para **105 / 90 / 20** — e esta é a **última
fatia que acrescenta rota** antes do congelamento.

---

## 3. Macro-Fases (alto nível)

As três fases vêm da **§11 do PRD**, e a ordem é consequência da provocação registrada no discovery:
*sem o certificado a cobrança para; sem a entrega da notícia ela apenas fica mais lenta.*

- **Fase 1 – Aceitar o material como a AC o entrega (Frente B)**
  - Objetivo: conversão na borda de registro com identidade preservada e afirmada por medição; três
    causas de recusa com desfechos distintos; a resposta informa quando houve conversão; e a
    pré-condição de ambiente passa a ser afirmada pelo provisionamento. **Fecha o `D64`.**
  - Tasks: **T1, T2, T3** _(US-06, US-07, US-08, US-09)_
- **Fase 2 – Habilitar e consultar a entrega da notícia por empresa (Frente A)**
  - Objetivo: o estado no banco com RLS forçada; o contrato publicado e a porta irmã; a credencial por
    empresa **e família de escopo**; as duas rotas com o ciclo cadastrar→confirmar; e a reconferência
    enfileirada.
  - Tasks: **T4, T5, T6, T7, T8** _(US-01, US-02, US-03, US-04, US-10, US-11, US-12)_
- **Fase 3 – Declarar, provar e entregar ao frontend**
  - Objetivo: as varreduras da saída real; a degradação declarada e provada por igualdade; o percurso
    do cliente novo ponta a ponta; e o índice do repositório coerente com o estado medido.
  - Tasks: **T9, T10** _(US-05, US-09, US-10)_

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | model | risk | gates | Status |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Conversão do material do certificado por processo externo | [T1](tasks/T1.md) | 1 | — | **Sim** | opus | high | `[qa, tech_review]` | Concluído |
| T2 | Três causas de recusa, desfecho do registro e fecho do `D64` | [T2](tasks/T2.md) | 1 | T1 | Não | opus | high | `[qa, tech_review]` | Concluído |
| T3 | Pré-condição de ambiente da conversão, afirmada pelo provisionamento | [T3](tasks/T3.md) | 1 | — | **Sim** | opus | low | `[qa]` | Concluído |
| T4 | Estado da entrega da notícia no banco — par de migrações e camada de dados | [T4](tasks/T4.md) | 2 | — | Não | opus | high | `[qa, tech_review]` | Concluído |
| T5 | Contrato publicado e porta de entrega da notícia do provedor | [T5](tasks/T5.md) | 2 | — | Não | opus | medium | `[qa, tech_review]` | Concluído |
| T6 | Credencial por empresa e família de escopo; o adaptador satisfaz a porta nova | [T6](tasks/T6.md) | 2 | T5 | Não | opus | high | `[qa, tech_review]` | Concluído |
| T7 | Rotas de ativação e consulta da entrega da notícia | [T7](tasks/T7.md) | 2 | T4, T5, T6 | Não | opus | high | `[qa, tech_review]` | Concluído |
| T8 | Reconferência da entrega enfileirada após o registro do certificado | [T8](tasks/T8.md) | 2 | T4, T5, T7 | Não | opus | medium | `[qa, tech_review]` | Concluído |
| T9 | Varreduras da saída real — nenhum segredo, e o dialeto só dentro do portador | [T9](tasks/T9.md) | 3 | T2, T7, T8 | **Sim** | opus | high | `[qa, tech_review]` | Concluído |
| T10 | Degradação declarada, percurso ponta a ponta e fecho do índice | [T10](tasks/T10.md) | 3 | T2, T7, T8 | **Sim** | opus | low | `[qa]` | Concluído |

> **Modelo**: **todas em `opus`**, por decisão do usuário registrada no `CLAUDE.md` — este projeto roda
> exclusivamente em Opus, e a heurística de `model` do `agent-spec-workflow-rules.md` que sugeriria
> `sonnet` está **explicitamente sobrescrita**. Sonnet e Haiku estão proibidos.

### 4.1 Ordem de Execução (grafo)

```
Fase 1
  T1 ──▶ T2
  T3            (independente de T1 e T2)

Fase 2
  T4 ──┐
  T5 ──┼──▶ T7 ──▶ T8
       └──▶ T6 ──┘
  (T6 depende de T5; T7 depende de T4, T5 e T6; T8 depende de T4, T5 e T7)

Fase 3
  T2, T7, T8 ──▶ T9
  T2, T7, T8 ──▶ T10
```

### 4.2 Como o flag de paralelismo foi **derivado** (Regra 10d)

O flag **não foi autorado**: para cada par da mesma fase, aplicou-se o *Invariante de Paralelismo* de
`.claude/rules/agent-spec-workflow-rules.md`. **Default em qualquer incerteza: `Não`.**

| Par | DAG independente | Símbolos disjuntos | Paths disjuntos | Alta contenção em comum | Resultado |
|---|---|---|---|---|---|
| **T1 × T3** | ✅ | ✅ (T3 não cria nem consome símbolo) | ✅ (`packages/cobranca-bancaria/**` × `deploy/scripts/**`) | ✅ — **só T1** toca barril; a regra exige **ambas** | **Sim / Sim** |
| T1 × T2 · T2 × T3 | ❌ T2 depende de T1 (mesma fase) | — | — | — | **Não** |
| T4 × T5 · T4 × T6 · T5 × T6 … | ✅/❌ conforme o par | — | — | ❌ **as duas tocam barril** (`db/src/index.ts` e `cobranca-bancaria/src/index.ts`) ou composição raiz | **Não** (toda a Fase 2 é sequencial) |
| **T9 × T10** | ✅ (nenhuma depende da outra) | ✅ (nenhuma cria símbolo) | ✅ (`segredo-nao-escapa`/`vocabulario-na-saida-real` × `conferencia-bancaria`/`percurso-do-cliente-novo`/`CLAUDE.md`) | ✅ nenhuma toca barril, DI, router ou migrations | **Sim / Sim** |

⚠️ **Guard de recursos de teste (T9 × T10)**: as duas rodam suítes de borda com instância efêmera. Se
o isolamento por suíte não for provado, **a etapa de QA do lote serializa** (executores em paralelo,
QAs um por vez, em ordem de ID) — colisão de recursos gera flake e queima tentativas.

⚠️ **A Fase 2 é integralmente sequencial, e isso é derivação, não conservadorismo preguiçoso**: cada
uma das cinco tasks toca **um arquivo de alta contenção** — barril de pacote (T4, T5), composição raiz
(T7, T8) ou o diretório de migrações (T4), cuja **ordem é estado compartilhado** mesmo com arquivos
distintos.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| **US-01** — habilitar num único ato | §5.1, §6.3 — ciclo cadastrar→confirmar; RN-01 imposta pelo serviço | T5, T6, T7 | A Fazer |
| **US-02** — ver o estado atual | §4.2, §7 — projeção a partir das colunas | T4, T7 | A Fazer |
| **US-03** — ler o motivo íntegro | §4.2, **D5** — motivo em campo de nome do produto, valores verbatim | T5, T7 | A Fazer |
| **US-04** — tentar de novo sem estado preso | §6.3 — substituição do desfecho | T7 | A Fazer |
| **US-05** — o produto funciona sem a entrega | §9, §13 — degradação declarada e testada | T10 | A Fazer |
| **US-06** — registrar o certificado como a AC o entrega | §6.1 — conversão com identidade conferida (**D1**, **D2**) | T1, T2 | A Fazer |
| **US-07** — recusa que nomeia a causa real | §4.3, §6.2 — três códigos, discriminação por sinal (**D3**, **D4**) | T1, T2 | A Fazer |
| **US-08** — ser informado de que houve conversão | §4.4 — esquema **próprio** do desfecho do registro | T2 | A Fazer |
| **US-09** — o operador do SaaS deixa de ser acionado | §16, **CA-21** — pré-condição afirmada; percurso sem etapa de servidor | T3, T10 | A Fazer |
| **US-10** — contrato completo para o handoff | §4 inteira — contrato antes do congelamento | T5, T7, T9 | A Fazer |
| **US-11** — registrar certificado reconfere o estado | §6.4 — reconferência enfileirada (ADR-0029, ADR-0024) | T8 | A Fazer |
| **US-12** — habilitação e recusa registradas na trilha | §13, **D7** — a linha de estado é o registro do efeito | T4, T7 | A Fazer |

**Verificação mecânica**: **12/12 US cobertas**, nenhuma órfã. Máximo de **3 tasks por US** (US-01 e
US-10), dentro da regra operacional da Regra 5.

---

## 6. Dependências Gerais

### 6.1 Entre tasks

| Task | Depende de | Símbolo/artefato que a obriga |
|---|---|---|
| T2 | T1 | `converterMaterialSeNecessario`, `MaterialPreparado`, a classe do erro de formato e o motivo próprio |
| T6 | T5 | `PortaDeEntregaDaNoticia`, `EntregaParaCadastrar`, `ResultadoDaOperacaoDeEntrega`, `MotivoDaRecusaDoProvedor` |
| T7 | T4, T5, T6 | `lerEstadoDaEntrega`/`gravarDesfechoDaEntrega`; a porta e os esquemas; a implementação da porta pelo adaptador |
| T8 | T4, T5, T7 | as funções de estado; a porta; `EntregaDaNoticiaService` e o token da porta |
| T9 | T2, T7, T8 | os seis desfechos das rotas tocadas precisam **existir** para serem varridos |
| T10 | T2, T7, T8 | o percurso encadeia registro (T2/T1) e ativação (T7); o índice só fecha depois de tudo |

### 6.2 Externas

| Dependência | Estado | Observação |
|---|---|---|
| Binário de criptografia do host, com **provider legado** | presente (medido em 2026-08-21) | **passa a ser afirmado** pela T3 (CA-21) — hoje a ausência só apareceria na renovação do Admin |
| API do provedor bancário — **família de operação nova** | escopos medidos | os escopos de boleto **obtêm token mas o gateway recusa** a operação da outra família (D6) |
| Fila (BullMQ + Redis) | existe | **uma** fila nova; nenhuma fila do produto muda |
| PostgreSQL 18 | existe | **duas** migrações, na ordem domínio → segurança |
| **Nenhum pacote novo no manifesto** | — | a biblioteca de PKCS#12 em JavaScript foi **rejeitada pela ADR-0036** |

### 6.3 Bloqueios e pré-requisitos conhecidos

- ✅ **`CT-1045` (T3) NÃO exige `sudo`, e o run NÃO precisa de presença humana** — reavaliado por
  medição em **2026-08-21**, contra a premissa do atrito A1. O caso **não executa o `main`**: extrai a
  função sob prova por `sed`+`eval` num subshell, o mecanismo que o **`ct_647` já usa neste mesmo
  verificador**. ⚠️ **A bateria completa NÃO está barrada pela ADR-0006** — medido com privilégio em
  2026-08-21, `/etc/sysloc/producao` **não existe** e o guarda **libera**. O que a torna inútil para
  esta task é outro fato: ela reprova por **5 falhas pré-existentes alheias à fatia**, já escrituradas
  três vezes na `fundacao-stack-nativa` (inventário literal defasado, `LIMITE_PNPM_TEST=120` contra
  428 s, `pnpm lint` com 4 `infos`). **Nenhuma janela assistida é agendada, e nenhuma regra de
  `sudoers` é alterada.** Detalhe na §3.3 da T3.
  ⚠️ **Continua valendo: não se admite criar um 12º `verificar-*.sh`.**
- ⚠️ **`CT-1017` (T1) pode ser instável** (atrito A2) — a janela de observação é a duração do processo
  externo. Conduta: **débito com gatilho** e manter o `CT-1016`. **Proibido afrouxar a asserção.**
- ⚠️ **`DECISÃO FECHADA — T12`** em `certificado.controller.ts` proíbe apoiar a autorização das rotas
  desta área na **ADR-0021**. Alcança a **T7** por inteiro.
- ⚠️ **O Limiar de Três dispara na T1**: o molde de varredura de agulhas chega à terceira cópia e
  **sobe para casa compartilhada** (`packages/cobranca-bancaria/test/varredura-de-agulhas.ts`).

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:

- [ ] **As 10 tasks** estiverem `Concluído`, aprovadas nos gates declarados por cada uma
- [ ] **Suíte verde, medida POR PACOTE** (`pnpm --filter @sysloc/<p> test`) — o `turbo run test` aborta
      os pacotes irmãos e a saída agregada **não é confiável**. Baselines de 2026-08-20 a comparar:
      `contracts` 399 · `api` 354 · `shared` 254 · `db` 233 · `documentos` 159 · `worker` 126 ·
      `auth` 89 · `cobranca-bancaria` 93 · `regua` 30
- [ ] **Nenhuma contagem de casos caiu** — em particular, `api` **não cai de 354** apesar da reescrita
      do `CT-1021` (P5 do Protocolo Antirregressão)
- [ ] **21/21 CA verificados**, pelos 34 casos distribuídos (33 do tech spec + o `CT-1047`)
- [ ] **As três âncoras da superfície em 105 / 90 / 20**, por igualdade de conjunto e duas medições
      independentes, e a contagem em prosa do `CLAUDE.md` **no mesmo diff** (T7)
- [ ] **`D64 · F4/fechamento` pago nas DUAS pontas** — marcador fora de `certificado.service.ts` e
      linha fora do índice do `CLAUDE.md`, **no mesmo commit** (T2); `pnpm --filter @sysloc/shared test`
      verde (o `CT-907` afirma o índice nos dois sentidos)
- [ ] **`CLAUDE.md` coerente com o medido**: 36 ADRs registradas / 29 `accepted`, e a contagem da suíte
      remedida (T10)
- [ ] **Nenhum material de certificado na árvore versionada** — tudo gerado em execução e apagado
- [ ] **Nenhum pacote novo no manifesto**; `undici` continua ausente

---

## 8. Riscos & Mitigações

| # | Risco (tech spec §20) | Prob. | Mitigação | Onde |
|---|---|---|---|---|
| R1 | **Reversão da indistinguibilidade lida como regressão** | alta | verificado que **não há `DECISÃO FECHADA`** sobre o trecho; a reversão declara `O QUE ESTA MUDANÇA REMOVE`, o caso é **reescrito e não apagado**, e o docblock é **substituído** | T2 §3.2, §3.5 |
| R2 | **Sinal do conversor reusado da biblioteca** — o ramo da senha nunca dispararia | alta | o radical comum é **`mac verify`**, medido nas duas pontas; o `CT-1022` reprova se o ramo não disparar | T1 §3.3, T2 |
| R3 | **Processo externo é superfície nova** para vazamento | média | guarda completa; medição da saída **real**, incluindo o objeto de erro **cru**, com controle positivo | T1 (`CT-1019`), T9 (`CT-1024`) |
| R4 | **Credencial da família errada** apresentada ao provedor | média | chave do cache composta por **(empresa, família)**; sem ela o defeito é **intermitente e dependente de ordem** | T6 |
| R5 | **Binário do host ausente ou sem o provider legado** em outra máquina | baixa | a descoberta move-se da renovação do Admin para a **instalação** | T3 |
| R10 | **A asserção nova vive num verificador cuja bateria não roda neste host** | — | **não é risco, é o desenho**: o CA-21 fala do comportamento no **ambiente de instalação novo**, onde os três bloqueios não valem. O `CT-1045` prova que a asserção **discrimina**, extraindo-a sem privilégio | T3 §3.3 |
| R6 | **Vaga ocupada por terceiro** lida como produto quebrado | média | motivo íntegro + degradação declarada — **o cliente da vaga ocupada é o teste vivo do desenho** | T7 (`CT-1036`) |
| R7 | **Redação do binário muda entre versões** e a classificação degrada | baixa | degradação **para o desfecho genérico**, declarada — perde diagnóstico, nunca contenção | T1 §3.3 |
| R8 | **Congelamento**: contrato incompleto no handoff | média | a §4 fecha na **T5** e na **T7**; depois delas não cabe mais | T5, T7 |
| R9 | **Fase 2 integralmente sequencial** alonga o run | — | é **derivação**, não escolha: cada task toca alta contenção. Falso-sequencial custa minutos; falso-paralelo corrompe a ordem | §4.2 |

---

## 9. Observações do Plano

### 9.1 Divergência declarada — o `CT-1047`

A §19 do tech spec fixa **33 casos**; este plano distribui **34**. O acréscimo é o **`CT-1047`**, que
prova as **três recusas de pré-condição do ato externo** — comportamento que a **§5.1**, a **§5.2** e a
**§10** declaram normativo, cuja forma o **challenge Q2 de 2026-08-21 corrigiu contra o código real**
(a spec dizia `404`), e que **nenhum CT do mapa cobria**.

- A cobertura CA→CT permanece **21/21**: o `CT-1047` ancora-se em **CA-01** e não cria CA novo.
- A contagem *"33 casos"* da §19 fica **defasada em 1**; a correção entra na **escrituração de fecho
  (T10)**, junto com a contagem da suíte.
- Decisão registrada sob a rule `autonomia-do-run.md` (**A1**), com a razão escrita.

### 9.2 Decisões auto-resolvidas nesta etapa (rule `autonomia-do-run.md`, A1)

| # | Decisão | Adotada | Razão |
|---|---|---|---|
| 1 | Macro-fases | **as três do PRD §11** | o PRD já as fixou, com a razão da ordem: *sem o certificado a cobrança para* |
| 2 | Detalhamento da §6 das tasks | **delegar ao `agent-spec-qa-test-generator`** em 4 grupos por camada, detalhando os **33 CTs já fixados** | o `_run/test-cases.json` não existia; a redistribuição legada renderia cards sem pré-condições, passos nem *negative companion*, e a §19.4 registra que **varredura sem controle positivo foi a causa de rejeição repetida nas duas fatias anteriores** |
| 3 | As três recusas de pré-condição sem CT | **acrescentar o `CT-1047`** | §9.1 acima |
| 4 | `model` de todas as tasks | **`opus`**, inclusive nas de `risk: low` | decisão do usuário no `CLAUDE.md`, que sobrescreve a heurística do framework |

### 9.4 Reavaliação do atrito A1 — medida em 2026-08-21, **depois** do plano fechado

O plano nasceu carregando a prescrição do tech spec §19.7: *"o `CT-1045` exige privilégio; execução
conduzida com o operador"*. **Medida a premissa, ela não se sustenta**, e a correção está na §3.3 da
T3. O que mudou:

| | Antes (prescrição herdada) | Depois (medido) |
|---|---|---|
| O caso exige `sudo`? | sim | **não** — extrai a função por `sed`+`eval`, como o `ct_647` |
| A bateria completa é janela pendente? | sim, a agendar | **não vale a pena** — ela **roda** (o guarda libera), mas sai `1` por **5 falhas pré-existentes alheias à fatia** |
| O run depende de presença humana? | sim | **não** |
| Conceder `NOPASSWD` ajudaria? | — | **não** — a bateria reprovaria igual, por motivo alheio. Seria alterar a segurança do host **em troca de nada**. **Recusado** com o usuário |

⚠️ **Correção interna desta §9.4, de 2026-08-21.** A primeira redação afirmava que a bateria estava
**barrada pela ADR-0006**. **Estava errado, e a verificação com privilégio o mostrou**:
`/etc/sysloc/` contém apenas `backend.env`, `backend.env.bak-20260820-215114` e `migracao.env` — o
marcador **`producao` não existe**, e `recusar_bateria_em_producao` **libera**. A conclusão prática
não muda (a task segue desassistida, porque o `CT-1045` não precisa de privilégio), mas **a razão
muda**, e razão errada escrita numa spec é o vetor da regressão de decisão que este repositório
persegue por nome.

⚠️ **Achado colateral, fora do escopo desta fatia**: a ausência do marcador é **exatamente o débito**
que o `run-report.md` da `fundacao-stack-nativa` §4 registra — *"o item que arma o marcador
`/etc/sysloc/producao` entrou no gate de desinstalação (passo 4 da §F7), um passo depois do momento
em que a instalação vira produção (passo 3, a virada)"*. Hoje a ausência é **correta** (o backend
novo ainda não atende ninguém); o débito morde **na F7**, entre a virada e a desinstalação. **Esta
fatia não o fecha e não o move** — a medição de hoje apenas o confirma.

**Isto é o precedente de método do repositório sendo exercido**, não improviso: *"prescrição de gate é
hipótese, não ordem — o executor que divergiu declarando e medindo teve razão em todas"*, e o
corolário *"a frase que explica por que algo não pode ser feito envelhece mais rápido que o débito
que ela justifica"*. ⚠️ **A §19.7 do tech spec continua dizendo o contrário** — a correção dela entra
na escrituração de fecho (**T10**), junto com a contagem de casos da §9.1.

### 9.3 Convenção de IDs

Os `CT-xxxx` são **globais da feature** — a tabela CA→CT do tech spec os referencia. A numeração
começa em **1014** porque `CT-1013` era o maior em uso; o `CT-1047` continua a sequência global.
**Cada CT aparece na §6 de exatamente uma task** — verificado.

---

## 10. Checklist Final

- [x] Todas as fases definidas (as três do PRD §11)
- [x] Todas as 10 tasks criadas com o template completo
- [x] Dependências mapeadas e coerentes; nenhum símbolo referenciado antes de nascer (Regra 10a)
- [x] `Símbolos públicos criados` / `Símbolos consumidos de outras tasks` preenchidos em cada `TN.md`
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + alta contenção (§4.2)
- [x] Invariante satisfeito: nenhuma task `Sim` depende, direta ou transitivamente, de outra da mesma fase
- [x] Rastreabilidade US → Tasks preenchida — **12/12**
- [x] Critérios de conclusão definidos, com as baselines por pacote
- [x] §6 preenchida em cada task, com **6.0**, **6.5** (sem CA órfão) e **6.6** (1 card por CT)
- [x] `_run/test-cases.json` persistido com `task_id` por caso — **34 casos**
- [x] Arquivos impactados listados em cada task (5.1, 5.2, 5.3), com o **raio de impacto declarado**
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1–10 aplicadas
- [x] Comentários de instrução do template removidos dos arquivos finais
- [x] Nenhuma informação inventada — divergências declaradas na §9.1
- [ ] **Pronto para execução** (aguarda aprovação do usuário)
