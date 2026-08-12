# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Régua de cobrança por empresa — o aviso ao inadimplente, configurável, auditado e sem cobrar dívida que não existe (sub-fatia **2a** de 2 da F3)
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-11
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/regua-de-cobranca/v1/tech_spec.md`
- **PRD**: `docs/prds/features/regua-de-cobranca/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/regua-de-cobranca/v1/tech-alignment.md` (D1..D6)
- **Pré-refinamento**: `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` (entrada dos **dois** runs; a 2b vem depois)
- **Variante**: `backend` — sem `design.md`, por decisão registrada no `CLAUDE.md` (este repositório não produz interface)

---

## 2. Objetivo do Task Plan

Entregar a **régua de cobrança como pacote de domínio próprio**, consumido pelos **dois** caminhos — o trabalho enfileirado e o disparo manual —, de modo que a decisão de quem é avisado exista **num lugar só**. É essa unicidade, e não uma guarda escrita na régua, que fecha o defeito medido no legado: `core.py` e `emailer.py` decidem o mesmo fato e discordam, e o caminho manual cobra dívida **cancelada** (REG-08).

Ao fim das 12 tasks: **duas tabelas novas** em `negocio` sob RLS forçada, o **predicado de elegibilidade no banco** sobre `cobranca_derivada`, o pacote **`@sysloc/regua`** (pacotes 4 → 5), o **contrato da fila em `@sysloc/shared`** fechando o **D32 (F0/T6)**, **4 rotas novas** levando a superfície de **82/67 para 86/71**, e a **equivalência com o oráculo** provada cenário a cenário — com **uma** divergência declarada, por vitória.

---

## 3. Macro-Fases (alto nível)

As seis fases da **§11 do PRD** (Roadmap) são a proposta de origem. Duas foram reordenadas por dependência técnica — *"o registro de envios"* e *"a decisão de quem avisar"* convergem numa camada só (as portas de dados), e o **substrato declarado** precisa vir antes de tudo — e o resultado são as seis abaixo, na ordem em que o prazo e as dependências as impõem.

- **Fase 1 – A regra do documento do contrato (PRAZO)**
  - Objetivo: extrair do sistema antigo o fonte do Server Script `PDF contrato` — 752 linhas que existem **só no banco** — antes de o `/opt/frappe` ser desligado. Primeira por **prazo**, não por dependência.
  - Tasks: **T1**
- **Fase 2 – O substrato declarado**
  - Objetivo: o contrato de tipos, o banco isolado por construção, e o pacote de domínio com as portas que ele declara.
  - Tasks: **T2, T3, T4**
- **Fase 3 – As portas de dados**
  - Objetivo: a política, o **predicado de elegibilidade no banco** com a junção obrigatória, a hora corrente da operação, o registro e o histórico.
  - Tasks: **T5**
- **Fase 4 – O trabalho que age**
  - Objetivo: a execução da régua com a barreira de envio que falha fechado, o contrato da fila descendo para o pacote compartilhado (fecha o **D32**), e a borda do job com o contexto vindo da carga.
  - Tasks: **T6, T7, T8**
- **Fase 5 – A superfície HTTP**
  - Objetivo: as quatro rotas — a política, o histórico e o disparo manual com concessão própria.
  - Tasks: **T9, T10**
- **Fase 6 – As provas de fecho**
  - Objetivo: a equivalência com o oráculo, com os dez vereditos escritos antes da execução; e a fronteira de autorização com a superfície fechando em 86/71 por dupla medição independente.
  - Tasks: **T11, T12**

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Extrair do sistema antigo o fonte do Server Script `PDF contrato` e provar o determinismo | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | O contrato da automação de cobrança em `@sysloc/contracts` | [T2](tasks/T2.md) | 2 | — | Não | Concluído |
| T3 | Schema e migrações da régua — 3 enums, 2 tabelas, RLS forçada e FK composta | [T3](tasks/T3.md) | 2 | T2 | Não | Concluído |
| T4 | O pacote `@sysloc/regua` — o domínio declara as portas, a janela e a mensagem | [T4](tasks/T4.md) | 2 | — | Não | Concluído |
| T5 | As portas de dados — a política, o predicado no banco, o registro e o histórico | [T5](tasks/T5.md) | 3 | T3, T4 | Não | Concluído |
| T6 | A execução da régua e o adaptador de produção — a barreira que falha fechado | [T6](tasks/T6.md) | 4 | T5 | Não | Concluído |
| T7 | O contrato da fila desce para `@sysloc/shared` — fecha o **D32 (F0/T6)** | [T7](tasks/T7.md) | 4 | — | Não | Concluído |
| T8 | A borda do job no `worker` — o contexto vem da carga, e a partida falha fechado | [T8](tasks/T8.md) | 4 | T6, T7 | Não | Concluído |
| T9 | As duas rotas da política de aviso — `GET` e `PUT /v1/automacao-de-cobranca` | [T9](tasks/T9.md) | 5 | T2, T5 | Não | Concluído |
| T10 | O disparo manual e o histórico — a conjunção de exigências e a barreira na `api` | [T10](tasks/T10.md) | 5 | T6, T9 | Não | Concluído |
| T11 | A equivalência com o oráculo — dez vereditos escritos antes da execução | [T11](tasks/T11.md) | 6 | T10 | Não | Concluído |
| T12 | A fronteira de autorização e o fecho da superfície em **86/71** | [T12](tasks/T12.md) | 6 | T9, T10 | Não | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1  (independente — primeira por PRAZO, não por dependência)

T2 ──► T3 ──┐
            ├──► T5 ──► T6 ──┬──► T8
T4 ─────────┘                │
                             └──► T10 ──► T11
T7 ──────────────────────────► T8
T2 ──┐
     ├──► T9 ──► T10 ──► T12
T5 ──┘             │
                   └──► T12
```

Topologia em uma linha:
`T2 → T3 → T5 ; T4 → T5 ; T5 → T6 → {T8, T10} ; T7 → T8 ; {T2, T5} → T9 → T10 → {T11, T12} ; T9 → T12`

### 4.2 Por que a coluna de paralelismo é toda `Não` — a derivação, não uma escolha

O flag foi **computado** pelo Invariante de Paralelismo (Regra 10d), par a par, dentro de cada fase. Nenhum par sobrevive às cinco condições:

| Fase | Par | Condição que falha |
|---|---|---|
| 1 | — | T1 é a única task da fase |
| 2 | T2 × T3 | T3 **depende** de T2 (mesma fase) — o invariante proíbe marcar `Sim` |
| 2 | T2 × T4 | **alta contenção**: T2 toca o barrel `packages/contracts/src/index.ts`; T4 cria pacote e toca `pnpm-lock.yaml` (manifesto/lockfile) |
| 2 | T3 × T4 | **alta contenção**: T3 toca o **diretório de migrações** (a ordem é estado compartilhado); T4 toca o lockfile |
| 3 | — | T5 é a única task da fase |
| 4 | T6 × T7 | **alta contenção**: T6 toca o barrel `packages/regua/src/index.ts`; T7 toca o barrel `packages/shared/src/index.ts` |
| 4 | T6 × T8, T7 × T8 | T8 **depende** das duas |
| 5 | T9 × T10 | T10 **depende** de T9 |
| 6 | T11 × T12 | ver o parágrafo abaixo — é o único par que passa nas cinco condições formais |

> **T11 × T12 é o par honesto desta fatia, e ele fica `Não` por uma razão MEDIDA.** Formalmente ele passa: são independentes no DAG (ambos descendem de T10, nenhum do outro), os símbolos são disjuntos (nenhuma das duas cria símbolo público), os caminhos são disjuntos (T11 cria um arquivo de teste; T12 modifica dois outros) e nenhuma toca arquivo de alta contenção. **O que o derruba é o recurso**: as duas rodam suíte E2E do `apps/api` com `embedded-postgres`, e **duas instâncias efêmeras simultâneas num host com disco em ~93%** produzem `No space left on device` — que **se disfarça de teste vermelho** e queima tentativa do limite de 3. O guard de recursos de teste do orquestrador serializaria a etapa de QA de qualquer forma; marcar `Não` torna a razão explícita em vez de deixá-la para o runtime descobrir.

**Alta contenção reforça o veredito e sobreviveria a uma mudança de fase**: `packages/contracts/src/index.ts` (T2) · o diretório de migrações (T3) · `pnpm-lock.yaml` (T4, T5, T8, T10) · `packages/db/src/index.ts` (T5) · `packages/shared/src/index.ts` (T7) · `apps/api/src/app.module.ts` (T9) · `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` (T9, T10, T12).

> **T1, T2, T4 e T7 são as quatro tasks genuinamente independentes desta fatia** — nenhuma tem dependência alguma. O executor pode batê-las junto com o que estiver pronto, porque os guards dele operam sobre **deps satisfeitas**, não sobre a fase. O flag permanece `Não` porque **falso-paralelo corrompe a ordem e falso-sequencial custa minutos**.

### 4.3 Cinco achados da derivação que mudaram a decomposição — leia antes de executar

#### 1. O ciclo do Turborepo — **medido neste repositório**, e ele move três arquivos de teste

A §3.3.3 do tech spec (hoje **ADR-0025**) manda `@sysloc/db` depender de `@sysloc/regua`. Os casos **CT-615..CT-620**, **CT-626**, **CT-636** e **CT-637**, porém, precisam de **banco migrado e das portas reais**, e o tech spec os coloca em `packages/regua/test/`. Isso exigiria `@sysloc/db` como `devDependency` do pacote de domínio — o que **fecha um ciclo**.

**Não é hipótese.** Foi verificado com um par equivalente (`@sysloc/contracts` recebendo `@sysloc/db` em `devDependencies`):

```
pnpm  [WARN] There are cyclic workspace dependencies: packages/contracts, packages/db
turbo  x Cyclic dependency detected:
       | 	@sysloc/db#build, @sysloc/contracts#build
```

O `turbo` **aborta antes de compilar qualquer coisa** — não é aviso. A árvore foi restaurada depois da medição.

**Decisão**: `packages/regua/` **jamais** declara `@sysloc/db`, e os casos que precisam de banco moram onde o encontro já é legítimo:

| Casos | Tech spec §3.4 dizia | Onde ficam | Por quê |
|---|---|---|---|
| CT-613, CT-614 | `packages/regua/test/` | **permanecem** ali | funções puras, sem fronteira real |
| CT-615..CT-620 | `packages/regua/test/regua.spec.ts` | `packages/db/test/execucao-da-regua.spec.ts` | `@sysloc/db` já depende de `@sysloc/regua`; `banco-efemero.ts` vive ali |
| CT-626 | `packages/regua/test/barreira-de-envio.spec.ts` | `packages/db/test/barreira-de-envio.spec.ts` | a metade comportamental precisa da régua rodando contra banco |
| CT-636, CT-637 | `packages/regua/test/` | `apps/api/test/equivalencia-com-o-oraculo.spec.ts` | o CT-636 alcança PAGA e CANCELADA **pelas rotas reais** |

⚠️ **Consequência que não pode ser esquecida**: a varredura do **CT-626** passa a alcançar **quatro** diretórios — aos três da §19.4 soma-se **`packages/db/test/**`**, justamente porque é para lá que estes casos vieram.

#### 2. `catalogo.spec.ts` não está na §3.6 do tech spec, e precisa estar

A guarda de cobertura de `packages/db/src/catalogo.ts` audita `TABELAS_LEGITIMAS` **por igualdade** (13 entradas hoje). Tabela nova sem entrada **reprova ao fechar a T3** — e caso que estava verde e ficou vermelho é regressão (P5). É o mesmo achado que a fatia anterior registrou na §4.3 do task plan dela. Está em **T3**.

#### 3. `0011` e `0012` não podem virar tasks separadas

A mesma guarda reprova toda tabela de negócio que exista **sem `FORCE RLS` e sem política**. Entregar só a migração de domínio deixaria a suíte vermelha ao fechar a task. As duas vão juntas, no arranjo que `0009`/`0010` e `0007`/`0008` já usaram.

#### 4. A âncora de superfície sobe em **duas** tasks, e é conferida numa terceira

`ROTAS_PUBLICADAS_EM_PRODUCAO` acumula uma linha `SUT_IS_CORRECT_BECAUSE:` por task que publica par: **T9 leva 82 → 84** e **T10 leva 84 → 86** (manipuladores `67 → 69 → 71`); **T12 confere** por dupla medição independente. Deixar a âncora para o fim faria a suíte reprovar ao fechar T9 e T10. ⚠️ **A base é `82`, não `77`** — o `77` vinha da premissa refutada do `HEAD` em dobro, e `cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado.

#### 5. As duas rotas de T10 **não criam controlador novo**

O disparo manual precisa viver sob a classe que declara `TELA:automacao_de_cobranca`: se morasse em `CobrancaController` (que declara `TELA:financeiro`), a declaração de método **substituiria** a de classe por `getAllAndOverride`, e o `CT-355` acusaria um manipulador exigindo coisa diferente da classe dele. É a Regra 3 (proximidade de arquivo) lida na direção que ela de fato aponta — o mesmo arranjo da T7 da fatia anterior.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|------------------|--------------------------|--------------------|--------|
| US-01 — Extrair a regra do documento do contrato antes do desligamento | §5.1-E · captura em shell, artefato versionado, determinismo por recaptura | T1 | A Fazer |
| US-02 — Política de aviso da própria imobiliária | §4.1 (2 rotas) · §6.1 · §7.2 (régua desligada por padrão) · §7.3 (RLS) | T2, T3, T5, T9 | A Fazer |
| US-03 — O inadimplente avisado automaticamente | §5.1-B · §6.3 RD-01/04/06 · §9.1 (fila) · §12.2 (um predicado) | T4, T5, T6, T7, T8 | A Fazer |
| US-04 — Disparo manual na hora, com concessão própria | §4.1 (rota `POST`) · §11.2 (conjunção) · §6.3 RD-07 | T6, T10, T12 | A Fazer |
| US-05 — Saber o que já saiu para uma cobrança | §4.1 (`GET .../avisos`) · §7.2 (`envio_de_cobranca`) | T2, T3, T5, T10 | A Fazer |
| US-06 — Nenhum aviso para cobrança paga ou cancelada | §6.3 RD-02 · §5.1-B passo 5 e C passo 4 — **um** teste de admissão | T5, T6, T10, T11 | A Fazer |
| US-07 — Falha de envio não contamina o financeiro | §6.3 RD-09 · §7.4 (unidade por tentativa) | T5, T6, T8 | A Fazer |
| US-08 — A régua da empresa alcança só os locatários dela | §7.3 (políticas RLS) · §11.1 (contexto do job) · ADR-0024 | T3, T5, T8 | A Fazer |
| US-09 — Nenhuma verificação alcança destinatário real | §8 (porta + dois adaptadores, barreira que falha fechado) | T4, T6, T8, T10 | A Fazer |

> **Nenhuma US órfã.** A com mais tasks é a **US-03, com cinco** — acima do teto operacional de três, e a razão é **estrutural**, não decomposição frouxa: avisar automaticamente atravessa **domínio puro → predicado no banco → execução com efeito externo → contrato da fila → borda do job**, e cada uma dessas camadas é um artefato arquitetural completo com prova própria. Fundi-las produziria uma task com efeito externo irreversível e diff enorme, que é exatamente o risco **crítico** que a §20 do tech spec nomeia.
>
> **T11 e T12 não têm US própria** e aparecem sob as US que provam (US-06 e US-04/US-02): as duas são trabalho de **invariante transversal**, não de escopo novo — nenhuma delas acrescenta uma linha de código de produção.

---

## 6. Dependências Gerais

**Externas — e uma delas expira:**

- **T1 depende do `/opt/frappe` estar de pé e responsivo.** É a única dependência externa da fatia, e ela **expira na virada** (F7). Regra não capturada agora vira risco que só aparece quando não há mais oráculo a consultar.
- ⚠️ **T1 NÃO exige `sudo`, e a premissa contrária é falsa.** `grep -n sudo` nos quatro arquivos de `deploy/scripts/caracterizacao/` devolve **vazio**; o acesso é por `docker compose exec -T` e o usuário do host está no grupo `docker`. A exigência de `sudo` da `.claude/rules/testing-stack.md` vale para `deploy/scripts/instalacao/`, que toca o SO — **a distinção é por FRENTE, não por host**. A T1 da fatia anterior herdou a frase e trocou o sujeito, e o custo foi a task de prazo ficar parada.
- **Nada mais na fatia depende de T1.** Se ela travar por indisponibilidade do legado, T2 em diante seguem sem bloqueio.

**Internas — as que mais custam se invertidas:**

- **T3 → T2** (os rótulos dos enums do banco derivam do contrato, na direção que a ADR-0016 fixa e que mantém `@sysloc/contracts` folha).
- **T5 → T4** (`@sysloc/db` importa `CandidataAoAviso` do domínio — ADR-0025; a seta é `db → regua` e **não se corrige**).
- **T6 → T5** (a execução consome as portas reais).
- **T8 → T7** (a borda do job importa `FILA_DA_REGUA` e `CargaDaRegua` do pacote compartilhado).
- **T10 → T9** (as duas rotas novas entram no controlador que T9 criou; um segundo controlador quebraria a declaração de classe).
- **T11 → T10** (o CT-636 executa o manual **pela rota real**).
- **T12 → T9, T10** (a âncora de 86/71 só bate quando as quatro rotas existem).

**Artefatos já disponíveis, que não são recapturados:**

- `golden/regua-de-cobranca.json` foi capturado pela **T1 da fatia anterior**, em 2026-08-10, e é **consumido do disco** por T11.
- O catálogo fechado já tem `TELA:automacao_de_cobranca` e `ACAO:enviar_cobranca_manual` — **nenhuma chave nasce nesta fatia**, e `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado por task alguma**.
- As **ADR-0024, 0025 e 0026** já estão `accepted` (2026-08-11). A **0024** é pré-requisito para o Gate 2 julgar T8.

**Débitos com gatilho — o que dispara e o que não:**

| Débito | Dispara? | Onde |
|---|---|---|
| **D32** (F0/T6) — contrato da fila duplicado | **SIM** | **fecha em T7**, com marcador e linha do índice saindo no mesmo commit |
| **D1** (F3/T2) — constantes monetárias | **NÃO** | conferido em **T2**: nenhum esquema novo tem campo monetário — o marcador **fica** |
| **D26** (F3/T8) — aritmética de calendário | **NÃO** | conferido em **T4**/**T5**: o calendário corre no banco e a janela compara `HH:MM` — o marcador **fica** |
| **D20** (F3/T7) — a janela da `0010` | **NÃO** | a fatia cria migrações **novas**; a `0010` não é tocada — o marcador **fica** |
| **D36** (F2/T8) — o carimbo do PDF | **NÃO aqui** | fecha na sub-fatia **2b**, e por construção |

---

## 7. Critérios de Conclusão da Feature

- [x] As **12 tasks** concluídas e aprovadas nos dois gates
- [x] `pnpm build`, `pnpm lint` e `pnpm test` verdes, com a contagem comparada contra a baseline de **835 casos**, medida **POR PACOTE** — crescimento monotônico, nenhum pacote encolhendo em nenhuma rodada; **queda inexplicada é regressão de prova**
- [x] Os **17 critérios de aceite** do PRD com ao menos um caso rastreado — **39 CTs (CT-601..CT-639)**, cada um em **exatamente uma** task
- [x] Superfície publicada em **86 rotas / 71 manipuladores**, `semDeclaracao` vazio, contagens **refeitas por varredura** e concordantes nas **duas** medições independentes (CT-635)
- [x] As duas tabelas novas com **RLS habilitada e forçada**, política única `FOR ALL` com `USING` = `WITH CHECK`, e FK **composta** (CT-607, CT-608)
- [x] `verificarCoberturaDeIsolamento` sem exceções, com as duas tabelas novas em `TABELAS_LEGITIMAS` (15 entradas, comparadas por igualdade)
- [x] `verificar-golden.sh` afirma **11** artefatos e os CT-601/CT-602 passam; os **10 anteriores byte a byte intocados**. ⚠️ O **`CT-013` segue reprovando por causa PRÉ-EXISTENTE** (colisão provável de agulha, provada idêntica em `fb93915`) — **não é regressão desta fatia**, e a comparação que vale é **caso a caso**, não o código de saída
- [x] **O débito D32 (F0/T6) está fechado**: definição única em `@sysloc/shared`, o marcador removido do código **e** a linha removida do índice do `CLAUDE.md`, no mesmo commit — as **duas pontas** conferidas pelo CT-638
- [x] Os marcadores do **D1**, do **D26** e do **D20 permanecem**, reafirmados e não removidos
- [x] O marcador `DECISÃO FECHADA` da **emenda da RD-05** existe no ponto do predicado, com os **quatro** campos e o `REVERTER EXIGE` apontando o oráculo
- [x] As **duas `DECISÃO FECHADA`** de `apps/worker/src/fila.ts` permanecem **byte a byte** idênticas
- [x] A equivalência com o oráculo fecha com **uma única** divergência — `('REG-08', 'manual')` —, com os dez vereditos escritos **antes** da execução e o lado do oráculo **lido do golden** (CT-636, CT-637)
- [x] `pnpm build` **sem `Cyclic dependency detected`** — `packages/regua` não declara `@sysloc/db` em lugar nenhum
- [x] **Zero** leituras de relógio de processo em `packages/regua/src/**` e `apps/worker/src/tarefas/**` (CT-612)
- [x] O escritor de contexto de tenant continua **único por borda** — exatamente **dois** chamadores de produção (CT-624)
- [x] `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado** por task alguma
- [x] Nenhuma asserção de igualdade de corpo trocada por asserção de presença nas suítes das fatias anteriores — varredura mecânica do diff; toda alteração de asserção de fatia fechada carrega `SUT_IS_CORRECT_BECAUSE:`
- [x] A **relocação dos oito casos** (§4.3, item 1) e a **emenda da RD-05** registradas na §2 do `_run/run-report.md`, para que uma rodada de correção posterior não as leia como defeito

---

## 8. Riscos & Mitigações

| Risco | Task | Mitigação |
|---|---|---|
| **Um envio real escapar durante a verificação** (CA-17/RN-15) — mensagem indevida na caixa de uma pessoa | T6, T8, T10 | Barreira **estrutural**, não configuração, e em **dois processos**: `overrideProvider` na `api`, parâmetro da borda no `worker`, e o adaptador de produção recusando a partida sem transporte (CT-625, CT-639). O CT-626 varre **quatro** diretórios |
| **A janela de prazo da CA-01 fechar** — o fonte do PDF vive só no banco legado | T1 | É a **primeira** task, por prazo. ⚠️ A premissa *"exige `sudo` interativo"* é **falsa** para `deploy/scripts/caracterizacao/` |
| **A trava contar a tentativa falha** (leitura literal da RN-06) reabrir numa rodada de correção | T5 | **Alta probabilidade.** `DECISÃO FECHADA` no predicado com o `REVERTER EXIGE` apontando o oráculo; CT-611 com companheiro negativo; o REG-01 do CT-636 a defende pela segunda vez; e o registro na §2 do `run-report.md` |
| **O ciclo `db ↔ regua` derrubar o build inteiro** | T4, T5, T6 | Medido e registrado na §4.3; a proibição está no aceite técnico de T4 e a relocação dos casos, em T6 e T11 |
| **A repetição do job duplicar aviso** | T8 | A idempotência é derivada do **predicado** (§9.2), e a prova dela é **caso obrigatório** (CT-622) |
| **Substituir a exigência de classe por só a ação** no disparo manual | T10 | A conjunção inteira é declarada no método, com `@ExigeChaves` (plural); o mutante (a) do CT-635 a defende |
| **Editar a `0010` por engano** ao mexer na view | T3, T5 | A fatia cria migrações **novas**; a `0010` está listada como referência somente leitura, com `DECISÃO FECHADA` e o `DÉBITO COM GATILHO — D20` |
| **O relógio do processo entrar em silêncio** — acerta pela `TZ` do host e falha sob UTC | T5, T8 | ⚠️ **Nenhum caso comportamental pega este defeito.** A **única** rede é o mutante do relógio no CT-612 |
| **Âncora de superfície derivada de si mesma** | T9, T10, T12 | Contagem **refeita do zero por varredura** em cada task que publica rota; conferência final por **duas medições independentes** com a igualdade afirmada |
| **T6 e T8 são as tasks mais densas** (7 e 6 casos) | T6, T8 | A densidade vem da **simetria** — os casos de T6 compartilham arranjo, capturador e banco; os de T8, a fila real. Separá-los multiplicaria o custo de subida das instâncias efêmeras |
| **`CT-907` flaky pré-existente** confundir o diagnóstico | todas | Falha por **timeout** (5000 ms sob disputa de CPU) é o flake conhecido; falha por **asserção** é achado. Rode isolado para discriminar |
| **Disco do host em ~93%** produzir `No space left on device` disfarçado de teste vermelho | todas | `rm -rf /tmp/sysloc-banco-*` entre execuções; e é a razão medida de T11 × T12 ficarem sequenciais |
| **Mutante avaliado com `vitest run` avulso** conclui o oposto do verdadeiro | T1, T3, T6, T7, T8, T12 | Mutante **sempre** pelo script do pacote (`pnpm --filter @sysloc/<pacote> test`) — os pacotes resolvem `"."` para `dist/` |
| **Colisão de identificador `Dnn`** ao registrar débitos desta fatia | todas | A sequência corre dentro da §2 do `run-report.md` **desta** fatia (§3-B da `nao-regressao.md`); o par `Dnn · F3/Tn` é o identificador |

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas — 12 arquivos em `tasks/`
- [x] Dependências validadas — DAG acíclico, conferido nos dois sentidos
- [x] `Símbolos públicos criados` / `consumidos de outras tasks` preenchidos em cada `TN.md` (Regra 10a)
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + contenção (Regra 10d), com a derivação registrada em §4.2
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — 9/9 cobertas, nenhuma órfã
- [x] Seção 6 preenchida em todas as tasks, com 6.0, 6.5 e 6.6
- [x] `_run/test-cases.json` atualizado com `task_id` por caso — **39 casos**, cada CT em exatamente 1 task
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Comentários internos de template removidos dos arquivos finais
- [x] Pronto para execução

---

## 10. Notas de Geração

**Origem dos casos de teste.** Os **39 CTs vieram integralmente de redistribuição**, sem reinvocar o gerador: **38** estavam em `_run/test-cases.json` com `criterios_aceitacao_validados` preenchidos, e o **CT-639** — nascido no `/agent-spec-challenge-spec` de 2026-08-11 e presente só no markdown da §19.1 — foi **reconstruído como caso completo e anexado ao JSON** na distribuição. O match componente↔task saiu de `existing_suite` + `camada` + `owning_layer`. **Nenhum subagente de QA foi disparado**, e nenhuma task ficou sem CT.

**IDs de CT são globais da feature**, começando em `CT-601` (a faixa `6xx` foi medida como **integralmente livre**: `grep -rhoP "CT-6\d{2}"` sobre `apps`, `packages` e `deploy` devolve vazio) e indo a `CT-639`.

**Oito realocações de arquivo contra o que o tech spec §3.4 desenha**, todas pela mesma causa medida (o ciclo do Turborepo) e registradas na §4.3: CT-615..CT-620 e CT-626 para `packages/db/test/`, CT-636 e CT-637 para `apps/api/test/`. **A decisão é de placement de teste, não de arquitetura** — a ADR-0025 continua valendo palavra por palavra, e é justamente ela que torna a relocação possível sem ciclo.

**`gates: [qa, tech_review]` nas 12 tasks**, e não é conservadorismo preguiçoso: cada uma toca ao menos uma categoria crítica — `db_migrations` e `security` (T3), `api_contracts` (T2, T9, T10), `auth`/`security` (T9, T10, T12), `secrets/config` (T8, T10), `service_complexo` (T5, T6), `padrao_novo`/`candidato_adr` (T1, T4, T11), `refactor_cross_module` (T7). **`model: opus` em todas** por decisão do projeto registrada no `CLAUDE.md`, que vence a heurística do framework.

**`risk: high` em cinco tasks** — T3 (migrações e RLS forçada), T5 (o predicado sob RLS, com a emenda da RD-05), T6 (efeito externo irreversível), T8 (contexto de tenant sem requisição, mais as variáveis de transporte) e T12 (a fronteira de autorização inteira da fatia).

**Duas tasks não acrescentam código de produção** — T11 e T12 são **só prova**. Isso é deliberado: se qualquer uma reprovar, a correção é na task de origem, **nunca** na asserção.
