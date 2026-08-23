# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Automações agendadas — F5, fatia (ii): o que roda sozinho
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-22
- **Status**: Rascunho
- **TECH_SPEC**: `docs/specs/features/automacoes-agendadas/v1/tech_spec.md`
- **PRD**: `docs/prds/features/automacoes-agendadas/v1/prd.md`
- **Variante**: `backend` (a Fronteira do `CLAUDE.md` exclui frontend deste repositório)

> ⚠️ **Documento de REFERÊNCIA/ÍNDICE.** O corpo detalhado de cada task vive **exclusivamente** em
> `tasks/T{n}.md`. Nada aqui substitui a leitura da task.

> ⚠️ **Decisões auto-resolvidas pela regra A1** de `.claude/rules/autonomia-do-run.md` (escopo
> universal): onde esta skill mandaria `AskUserQuestion`, a alternativa recomendada foi **formulada,
> adotada e registrada** em vez de pausar. São quatro — ver §6.1.

---

## 2. Objetivo do Task Plan

Dar ao produto **o gatilho que ele nunca teve**. Hoje há seis filas, um processo de trabalho
supervisionado e **nenhum produtor periódico**: o trabalho existe e ninguém o provoca.

Ao fim das 11 tasks o produto terá (i) **seis rotinas agendadas** por systemd timer, com fuso
declarado e recuperação de disparo perdido nas diárias; (ii) o **único trabalho de domínio que nunca
existiu** — o encerramento de contrato vencido com liberação do imóvel no mesmo ato; (iii) o
**registro de execução por empresa**, expurgado por idade; e (iv) a **última rota que este repositório
publica** antes do congelamento da superfície, `GET /v1/automacao-de-cobranca/rotinas`.

Dois débitos com gatilho **fecham** no percurso (`D26 · F4/T9` e `D13 · F4/T6`), ambos com o gatilho
literal *"a **F5**, que traz o agendamento"*.

---

## 3. Macro-Fases (alto nível)

> **Origem**: o PRD §11 propõe três fases **de produto** (o que dispara · o que faltava acontecer ·
> quem observa). As cinco fases abaixo são a **reordenação técnica** delas por dependência: contrato e
> banco antes do domínio, domínio antes do processo de trabalho, processo antes do relógio e da borda.
> O mapeamento está na §5.

- **Fase 1 – Fundação publicada** *(PRD: transversal às três)*
  - Objetivo: publicar a declaração única (roster, cadência, limiar, impedimentos), o contrato das duas
    filas novas e a tabela `negocio.execucao_de_rotina` com RLS `FORCE` e política nominal.
  - Tasks: **T1, T2, T3** — as três **em paralelo**.
- **Fase 2 – Domínio no banco** *(PRD: Fase 2 e Fase 3)*
  - Objetivo: a gravação do registro sob contexto, a leitura com derivação **no banco**, o expurgo por
    idade, e a transição pareada contrato→imóvel numa unidade de trabalho.
  - Tasks: **T4, T5** (sequenciais — T5 consome T4).
- **Fase 3 – O processo de trabalho** *(PRD: Fase 2)*
  - Objetivo: o consumidor único das quatro rotinas por empresa, o consumidor sem tenant da manutenção,
    e o **despachante efêmero** com as duas leituras sem contexto.
  - Tasks: **T6, T7, T8** (sequenciais — compartilham a composição raiz do worker).
- **Fase 4 – O relógio e a borda** *(PRD: Fase 1 e Fase 3)*
  - Objetivo: as 13 unidades systemd com o instalador idempotente, e a rota de leitura do Admin com a
    âncora de superfície subindo no mesmo diff.
  - Tasks: **T9, T10** — as duas **em paralelo**.
- **Fase 5 – Rede antirregressão e escrituração** *(PRD: transversal)*
  - Objetivo: fechar o risco R3 de probabilidade ALTA (as duas rotinas mortas por desenho) e conferir as
    **duas pontas** do índice de débito.
  - Tasks: **T11**.

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Roster publicado das rotinas em `@sysloc/contracts` | [T1](tasks/T1.md) | 1 | — | **Sim** (derivado) | Concluído |
| T2 | As duas filas novas e as duas cargas em `@sysloc/shared` | [T2](tasks/T2.md) | 1 | — | **Sim** (derivado) | Concluído |
| T3 | Tabela `negocio.execucao_de_rotina`: esquema, migrações 0026/0027 e as guardas | [T3](tasks/T3.md) | 1 | — | **Sim** (derivado) | Concluído |
| T4 | `execucao-de-rotina.ts`: gravação, leitura derivada e expurgo | [T4](tasks/T4.md) | 2 | T1, T3 | Não (derivado) | Concluído |
| T5 | `encerrarContratosVencidos`: transição pareada numa unidade | [T5](tasks/T5.md) | 2 | T3, T4 | Não (derivado) | Concluído |
| T6 | Consumidor único das quatro rotinas por empresa | [T6](tasks/T6.md) | 3 | T1, T2, T4, T5 | Não (derivado) | Concluído |
| T7 | Manutenção sem tenant e expurgo dos boletos (fecha `D26 · F4/T9`) | [T7](tasks/T7.md) | 3 | T2, T6 | Não (derivado) | Concluído |
| T8 | Despachante efêmero e as leituras sem contexto (fecha `D13 · F4/T6`) | [T8](tasks/T8.md) | 3 | T1, T2, T6, T7 | Não (derivado) | Concluído |
| T9 | As 13 unidades systemd, o instalador e a asserção estática | [T9](tasks/T9.md) | 4 | T1, T8 | **Sim** (derivado) | Concluído |
| T10 | `GET …/rotinas` e a âncora de superfície | [T10](tasks/T10.md) | 4 | T1, T4 | **Sim** (derivado) | Concluído |
| T11 | Rede antirregressão da RN-14 e escrituração das duas pontas | [T11](tasks/T11.md) | 5 | T5, T6, T7, T8, T9, T10 | Não (derivado) | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1 ─┬─────────────► T4 ──► T5 ──► T6 ──► T7 ──► T8 ─┬──► T9 ──┐
    │               ▲              ▲       ▲        │         ├──► T11
T3 ─┴───────────────┘              │       │        │         │
                                   │       │        └──► ... ─┘
T2 ────────────────────────────────┴───────┘
                                                    T10 ◄── T1, T4
                                                    T10 ──────────► T11
```

Ordem topológica linearizada (a que o run executa quando o lote paralelo não se forma):

```
T1, T2, T3  →  T4  →  T5  →  T6  →  T7  →  T8  →  T9, T10  →  T11
```

### 4.2 Derivação do flag de paralelismo (Regra 10d — computado, não autorado)

O flag é **derivado** pelo "Invariante de Paralelismo" de `.claude/rules/agent-spec-workflow-rules.md`.
Registro da derivação, par a par, dentro de cada fase:

| Fase | Par | (1) DAG | (2) Símbolos disjuntos | (3) Paths disjuntos | (4) Alta contenção em comum | Veredito |
|---|---|---|---|---|---|---|
| 1 | T1 × T2 | ✅ ambas sem deps | ✅ | ✅ `packages/contracts/**` × `packages/shared/**` | ✅ barris **diferentes** (`contracts/index.ts` × `shared/index.ts`) | **Sim** |
| 1 | T1 × T3 | ✅ | ✅ | ✅ `packages/contracts/**` × `packages/db/**` | ✅ T3 toca o ledger de migrações; T1 não | **Sim** |
| 1 | T2 × T3 | ✅ | ✅ | ✅ `packages/shared/**` × `packages/db/**` | ✅ | **Sim** |
| 2 | T4 × T5 | ❌ **T5 depende de T4** | ❌ `registrarExecucaoDeRotina` | ❌ ambas tocam `packages/db/src/index.ts` | ❌ mesmo barril | **Não** (ambas) |
| 3 | T6 × T7 | ❌ T7 depende de T6 | — | ❌ `apps/worker/src/{fila,main}.ts` | ❌ composição raiz | **Não** |
| 3 | T6 × T8, T7 × T8 | ❌ T8 depende das duas | ❌ consumidores | ❌ `apps/worker/src/fila.ts` | ❌ | **Não** |
| 4 | T9 × T10 | ✅ nenhuma é ancestral da outra | ✅ T9 consome T1+T8; T10 consome T1+T4 — sem interseção entre si | ✅ `deploy/**`+`packages/shared/test/**` × `apps/api/**` | ✅ T9 toca `packages/shared/package.json`; T10 não toca manifest | **Sim** |
| 5 | — | task única | — | — | — | **Não** |

> ⚠️ **Guard de recursos de teste no lote T9 × T10**: T10 tem E2E com servidor HTTP real e banco
> efêmero. Se o orquestrador não puder **provar** o isolamento (porta dinâmica + instância efêmera por
> suíte), **serialize a etapa de QA do lote** — executores em paralelo, QAs um por vez, em ordem de ID.
> T9 é asserção **estática** sobre o sistema de arquivos e não disputa recurso.

> ⚠️ **`CLAUDE.md` é tocado por T7, T8, T10 e T11.** As quatro estão em fases ou posições sequenciais
> entre si — nenhuma delas divide lote paralelo com outra que o toque.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|---|---|---|---|
| US-01 — Ver quando cada rotina executou e o que fez | `negocio.execucao_de_rotina` + `lerEstadoDasRotinas` + `esquemaDoEstadoDasRotinas` (§17) | T1, T3, T4, T10 | A Fazer |
| US-02 — Saber por que um Aviso não saiu | União fechada `CODIGOS_DE_IMPEDIMENTO` e a derivação de cada um sobre fato já gravado (§17) | T1, T4, T10 | A Fazer |
| US-03 — Ser avisado quando uma rotina para | `OnFailure=` + unidade-modelo **e** `VIGILANCIA_DAS_ROTINAS` com limiar por cadência (§17) | T1, T4, T6, T9 | A Fazer |
| US-04 — Receber Aviso dentro da Janela de horário | Timer de minuto + o produtor que faltava para `FILA_DA_REGUA` (§17) | T8, T9 | A Fazer |
| US-05 — Não receber Aviso retroativo após reativação | Nenhum código novo — a não retroatividade é propriedade do predicado existente, **preservada** (§17) | T5, T8 | A Fazer |
| US-06 — Imóvel liberado quando o contrato vence | `encerrarContratosVencidos` — seleção, transição sob predicado e porta estreita, uma unidade (§17) | T5, T6 | A Fazer |
| US-07 — Liquidações descobertas todo dia junto ao Provedor | Timer diário + `abrirConferencia(tx, { solicitadaPor: null })` na tarefa agendada (§17) | T6, T9 | A Fazer |
| US-08 — Indisponibilidade atrasa, não perde a execução | `Persistent=true` nas diárias, ausente na de minuto (§17) | T1, T9 | A Fazer |
| US-09 — Erro de uma empresa não impede as demais | Uma tarefa por empresa + política padrão de repetição (§17) | T2, T8 | A Fazer |
| US-10 — Instalar quantas vezes for preciso sem duplicar | Laço idempotente do instalador, com `CRIADO`/`JA-OK` por passo (§17) | T9 | A Fazer |
| US-11 — Ser avisado quando os Avisos param por limite do provedor | Impedimento `AVISOS_RECUSADOS_PELO_PROVEDOR` derivado das tentativas recentes (§17) | T1, T4, T10 | A Fazer |
| US-12 — Notícia retida é processada depois | `listarNaoTratadas` + reenfileiramento na fila existente (§17) | T2, T8 | A Fazer |
| US-13 — Espaço em disco não cresce sem teto | Três expurgos: histórico (tenantizado), recebido cru (reusado), boletos (novo na guarda) (§17) | T2, T3, T4, T6, T7 | A Fazer |
| US-14 — Suspensão congela; reativação põe em dia | `listarEmpresasAtivas` com `suspensa_em IS NULL` — o filtro é da enumeração (§17) | T8 | A Fazer |

**Verificação mecânica**: as **14 US** têm ao menos uma task. Nenhuma US aparece em mais de 5 tasks, e
a média é 2,6 — dentro da regra operacional de ~3 tasks por US.

### 5.1 Cobertura dos casos de teste

Os **41 casos** do `_run/test-cases.json` (CT-1057 a CT-1097) foram **redistribuídos** entre as tasks
**sem reinvocar** o `agent-spec-qa-test-generator` — o JSON é lossless e traz o mapeamento CA por caso,
que é a pré-condição da FASE 4 da skill. Nenhuma task ficou sem match.

| Task | CTs | Total |
|---|---|---|
| T1 | CT-1090 | 1 |
| T2 | CT-1089 | 1 |
| T3 | CT-1073 | 1 |
| T4 | CT-1070, CT-1071, CT-1072, CT-1074 | 4 |
| T5 | CT-1061, CT-1063, CT-1064, CT-1065, CT-1066, CT-1067, CT-1068, CT-1069, CT-1097 | 9 |
| T6 | CT-1082, CT-1083, CT-1084, CT-1085, CT-1086 | 5 |
| T7 | CT-1087, CT-1088 | 2 |
| T8 | CT-1062, CT-1075, CT-1076, CT-1077, CT-1078, CT-1079, CT-1080, CT-1081 | 8 |
| T9 | CT-1057, CT-1058, CT-1059, CT-1060 | 4 |
| T10 | CT-1091, CT-1092, CT-1093, CT-1094, CT-1095 | 5 |
| T11 | CT-1096 | 1 |
| **Total** | | **41** |

**24/24 CAs cobertos**, nenhum CT órfão, nenhum CT em duas tasks.

---

## 6. Dependências Gerais

**Entre tasks** — a fonte única é a seção 1 de cada `tasks/T{n}.md`; a tabela da §4 é a cópia.

**Externas** — nenhuma. A fatia **não introduz dependência de pacote alguma** (§18 do tech spec).
O systemd do host é o **255.4**, medido, e o fuso em `OnCalendar=` exige ≥ 252.

**Pré-requisitos do ambiente** — `pnpm build` produz `apps/worker/dist/despachante.js`, barrado pelo
`.gitignore` como os dois `dist/main.js`; quem confere a presença dele é o **instalador**, uma vez,
com um humano olhando.

**Bloqueios conhecidos** — nenhum. Os dois pontos que exigiriam janela assistida com `sudo` (`reboot`
real e a segunda execução do instalador) estão **declarados fora de suíte** na §19.5 do tech spec, com
a razão.

### 6.1 Decisões auto-resolvidas pela regra A1 na geração deste plano

| # | Decisão | Alternativas | Adotada (recomendada) | Razão |
|---|---|---|---|---|
| A1-1 | Confirmação do nome da feature e das macro-fases | perguntar ao usuário × derivar do tech spec §1 e do PRD §11 | **derivar** | `.claude/rules/autonomia-do-run.md` §A1 é de escopo universal: não invocar `AskUserQuestion`, adotar a recomendada e registrar |
| A1-2 | Estrutura de fases | espelhar as 3 fases de produto do PRD §11 × reordenar por dependência técnica | **reordenar em 5 fases**, com o mapeamento explícito na §3 e na §5 | as fases do PRD são de produto; executá-las na ordem literal poria o consumidor antes do contrato e da tabela, e o grafo de símbolos (Regra 10a) força a reordenação |
| A1-3 | Onde mora a validação Zod da carga (CT-1089) | trazer `zod` para `@sysloc/shared` × manter o módulo sem dependência e pôr as pernas de `safeParse` onde o esquema nasce | **manter sem dependência** (registrado em `tasks/T2.md` §3) | o docblock de `fila.ts` declara a ausência de dependência como **parte da decisão**, e `packages/shared` não pode importar `apps/worker`; o custo é o CT-1089 ter pernas em dois pacotes, declarado nas três tasks |
| A1-4 | Reinvocar o `agent-spec-qa-test-generator` | reinvocar por camada × **redistribuir** o JSON lossless | **redistribuir** | a FASE 4 da skill manda redistribuir quando `shared.test_cases.path` existe com mapeamento CA; o JSON tem os 41 casos, com `arquivo_alvo` e `criterios_aceitacao_validados` por caso |

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:

- [ ] **As 11 tasks** estiverem `Concluído`, aprovadas nos dois gates
- [ ] **`pnpm --filter @sysloc/<pacote> test` verde em todos os 9 pacotes**, com a contagem comparada à
      baseline (P1/P5 do Protocolo Antirregressão) — ⚠️ medir **por pacote**: `turbo run test` aborta os
      irmãos e a saída agregada não é confiável
- [ ] **Os 41 CTs implementados**, com prova de falsificação em toda asserção **estática** (CT-1057 a
      CT-1060, CT-1061, CT-1062 e as pernas estáticas de CT-1078, CT-1088, CT-1089 e CT-1096)
- [ ] **24/24 CAs verificados**, sem CT órfão
- [ ] **Superfície: 106 rotas / 91 manipuladores**, `publicas` inalterado em **20** — medido do zero
      pelas duas medições independentes, com a âncora e a prosa do `CLAUDE.md` no **mesmo diff**
- [ ] **`D26 · F4/T9` e `D13 · F4/T6` fechados**: marcador **e** linha do índice removidos no commit da
      correção
- [ ] **Índice de débito íntegro nas duas pontas** (`.claude/rules/nao-regressao.md` §3-B): marcador →
      registro, e índice → marcador
- [ ] **Nenhuma ADR nova criada** — o veredito da §21.5 do tech spec, reconfirmado depois do challenge
- [ ] **Nenhuma dependência de pacote nova** nos manifests (o `@sysloc/contracts` de T9 entra em
      `devDependencies` de `@sysloc/shared`, não em `dependencies`)
- [ ] **`instalar-unidades.sh` roda duas vezes** imprimindo `CRIADO` na primeira e `JA-OK` na segunda —
      passo de **rollout**, com janela assistida, não caso de suíte (§19.5)

---

## 8. Riscos & Mitigações

> Espelham a §20 do tech spec, com o apontamento da task que os endereça.

| Risco | Prob. | Impacto | Mitigação | Task |
|---|---|---|---|---|
| **Duas fontes de tempo** — o timer usa o fuso do sistema; o domínio usa o banco; hoje acerta **por acidente** | **Alta** | Alto | As duas metades: fuso **declarado** em todo `OnCalendar=` (CT-1057) e nenhuma rotina derivando "hoje" do relógio do processo (CT-1061, CT-1062) | T9, T5, T8 |
| **Regressão R3** — as duas rotinas mortas por desenho são convite permanente a "corrigir a lacuna" | **Alta** | Alto | Marcador `DECISÃO FECHADA` com `REVERTER EXIGE` citando a **ADR-0022**, mais o CT que afirma a RN-14 pela outra ponta | **T11** |
| **Superfície irreversível** — publicar uma leitura insuficiente na última janela antes do congelamento | Média | **Alto** | Saída em **contrato aberto** (`z.object`), o que permite ampliar em vez de acrescentar rota; horizonte curto limitado pela retenção de 90 dias | T1, T10 |
| **`jobId` determinístico como trava** — a forma intuitiva de satisfazer RN-13 | Média | **Alto** | Declarado em §9.2 por que **não** se usa; a trava de cada rotina é a que já a governa. CT-1078 é a rede | T2, T8 |
| **`D44 · F2/T10` agravado** — terceiro escritor do par contrato-vigente / situação-do-imóvel | **Certa** | Médio | **Não fecha aqui** (o gatilho literal não disparou); nasce com a disciplina certa — as duas pontas na mesma unidade —, o CT-1069 é a rede possível, e o agravamento é **anotado** na §2 do run-report | T5, T11 |
| **Pico na volta de indisponibilidade longa** | Média | Médio | O systemd dispara **uma** vez por timer, não N; a fila absorve por concorrência controlada; a régua **não retroage** (CT-1081) | T8, T9 |
| **A vigilância não se vigia** | Baixa | Médio | **Trade-off declarado** (D5): fechar a recursão exige observação **de fora**, que é da F7. Não é lacuna de teste | T6 |
| **11ª cópia do esqueleto de `verificar-*.sh`** | Baixa | Baixo | Evitada por decisão (A1, §16.1): a prova é asserção estática em Vitest, e o `D9 · F0/T2` **não dispara** | T9 |

---

## 9. Checklist Final

- [x] Task Plan completo (documento de referência — sem corpo de task)
- [x] 11 tasks mapeadas, cada uma em `tasks/T{n}.md`
- [x] Dependências validadas e reconciliadas (a seção 1 de cada `T{n}.md` é autoritativa)
- [x] `Símbolos públicos criados` / `Símbolos consumidos de outras tasks` preenchidos nas 11 tasks
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + alta contenção (§4.2)
- [x] Invariante satisfeito: nenhuma task `Sim` depende, direta ou transitivamente, de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida (14/14 US cobertas)
- [x] Critérios de conclusão da feature definidos
- [x] Seção 6 preenchida nas 11 tasks (6.0 a 6.6), por **redistribuição** do JSON lossless
- [x] `_run/test-cases.json` atualizado com `task_id` em cada um dos 41 casos
- [x] `model`, `risk`, `gates` preenchidos no frontmatter das 11 tasks
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Pronto para execução
