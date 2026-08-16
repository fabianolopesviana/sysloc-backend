# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: `fundacao-bancaria` — identidade por empresa perante o provedor bancário e
  identificador de cobrança único em todo o SaaS. Fatia **(i) de 3** da F4
  (`integracao-bancaria-sicoob`)
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-14
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/fundacao-bancaria/v1/tech_spec.md`
- **PRD**: `docs/prds/features/fundacao-bancaria/v1/prd.md`
- **Variante**: `backend` — **sem `design.md`**, e a ausência é a Fronteira do projeto: nenhum código
  de frontend nasce aqui

---

## 2. Objetivo do Task Plan

Entregar **três coisas que a fase inteira consome e nenhuma emissão**:

1. **Identidade por empresa** — `negocio.certificado_do_provedor`, dado da empresa com RLS forçada e
   chave estrangeira composta, guardando material PKCS#12 e senha num **envelope único** cifrado com
   AES-256-GCM, cuja chave vive fora da árvore versionada (ADR-0032).
2. **Fundação numérica** — o schema **`plataforma`** (ADR-0031), com a sequência do identificador
   bancário e a função `SECURITY DEFINER` **sem parâmetro** que a consome. A ausência de parâmetro
   **é** a declaração de escopo (ADR-0033).
3. **Pacote `@sysloc/cobranca-bancaria`** (pacotes 6 → 7) — modelo canônico com meio de recebimento
   (`BOLETO` | `PIX`, o pix sem operação) e a porta `PortaDeIdentidadeBancaria` com **uma** operação.

Duas propriedades atravessam tudo: **o segredo não retorna por superfície nenhuma**, e a garantia é
**medida sobre a saída real** — nunca lida no código. **Não há identidade de reserva.**

Ao fim: **3 rotas novas**, superfície **89/74 → 92/77** por dupla medição independente, **zero
dependências externas novas**.

---

## 3. Macro-Fases (alto nível)

- **Fase 1 – Fundação transversal**
  - Objetivo: o contrato (fonte única) e as **duas barreiras** da ADR-0032 — a contenção estrutural
    do segredo e a redação do registrador.
  - Tasks: T1, T2, T3
- **Fase 2 – O banco**
  - Objetivo: estrutura, segurança, o schema `plataforma` e a camada de dados. O banco impõe o que a
    aplicação **não confere**.
  - Tasks: T4, T5, T6, T7
- **Fase 3 – Domínio bancário**
  - Objetivo: o sétimo pacote do monorepo — vocabulário próprio, porta declarada pelo domínio e os
    dois adaptadores que a satisfazem.
  - Tasks: T8, T9, T10
- **Fase 4 – A borda**
  - Objetivo: as três rotas do Admin da empresa, com exigência declarada e contenção imediata do
    segredo.
  - Tasks: T11, T12
- **Fase 5 – Medição e fecho**
  - Objetivo: a prova que a ADR-0032 exige (medição sobre a saída real) e o fecho auditável —
    superfície 92/77, índice de débito e escrituração.
  - Tasks: T13, T14

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | Contrato da integração bancária em `@sysloc/contracts` | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | Segredo operável — cifra AES-256-GCM e invólucro opaco | [T2](tasks/T2.md) | 1 | — | Não | Concluído |
| T3 | Radicais novos do registrador — `pfx`, `passphrase`, `material` | [T3](tasks/T3.md) | 1 | — | Não | Concluído |
| T4 | Migrações `0015`/`0016`, schema `plataforma` e raio de impacto | [T4](tasks/T4.md) | 2 | — | Não | Concluído |
| T5 | Guarda de admissão do schema `plataforma` | [T5](tasks/T5.md) | 2 | T4 | Não | Concluído |
| T6 | Contador e composição do identificador perante o provedor | [T6](tasks/T6.md) | 2 | T1, T4 | Não | Concluído |
| T7 | Camada de dados do certificado — substituição atômica | [T7](tasks/T7.md) | 2 | T1, T4 | Não | Concluído |
| T8 | Pacote `@sysloc/cobranca-bancaria` — manifesto, modelo e porta | [T8](tasks/T8.md) | 3 | T1 | Não | Concluído |
| T9 | Leitura do material por aperto de mão em laço local | [T9](tasks/T9.md) | 3 | T2, T8 | Não | Concluído |
| T10 | Adaptador mTLS contra o provedor — cliente por chamada | [T10](tasks/T10.md) | 3 | T2, T8, T9 | Não | Concluído |
| T11 | Ambiente, módulo e as rotas de registro e consulta | [T11](tasks/T11.md) | 4 | T1, T2, T7, T9 | Não | Concluído |
| T12 | Rota de verificação da identidade contra o provedor | [T12](tasks/T12.md) | 4 | T10, T11 | Não | Concluído |
| T13 | A medição da ADR-0032 sobre a saída real | [T13](tasks/T13.md) | 5 | T11, T12 | Não | Concluído |
| T14 | Superfície 92/77, autorização e fecho da fatia | [T14](tasks/T14.md) | 5 | T12, T13 | Não | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1 ─┬─────────────────────────────────────────────┐
    ├──▶ T6                                       │
    ├──▶ T7 ───────────────────┐                  │
    └──▶ T8 ─┬──▶ T9 ─┬──▶ T10 │                  │
             │        │        │                  │
T2 ─┬────────┘        │        │                  │
    ├─────────────────┘        │                  │
    └──────────────────────────┼──────────────────┤
                               │                  │
T3   (sem dependente)          │                  │
                               ▼                  ▼
T4 ─┬──▶ T5                   T12 ◀────────────── T11
    ├──▶ T6                    │
    └──▶ T7                    ├──▶ T13 ──▶ T14
                               └──────────────▲
```

Ordem topológica executável (fase a fase):

```
Fase 1:  T1 → T2 → T3
Fase 2:  T4 → T5 → T6 → T7
Fase 3:  T8 → T9 → T10
Fase 4:  T11 → T12
Fase 5:  T13 → T14
```

### 4.2 Derivação do flag de paralelismo (Regra 10d — **computado, não autorado**)

**Resultado: nenhuma task é paralelizável.** A derivação, par a par, aplicando o *Invariante de
Paralelismo* de `.claude/rules/agent-spec-workflow-rules.md`:

| Fase | Par | Condição que falha | Veredito |
|---|---|---|---|
| 1 | T1 ∧ T2 | **Ambas tocam arquivo de alta contenção** — `packages/contracts/src/index.ts` e `packages/shared/src/index.ts` são barris | `Não` |
| 1 | T1 ∧ T3, T2 ∧ T3 | Nenhuma condição falha, mas com T1 e T2 fora o lote fica com **uma** task — não é paralelismo | `Não` (default conservador) |
| 2 | T5, T6, T7 vs T4 | **Dependência direta no DAG** | `Não` |
| 2 | T5 ∧ T6, T5 ∧ T7, T6 ∧ T7 | **Paths não disjuntos** — as três tocam `packages/db/src/index.ts` (barril) | `Não` |
| 3 | T9 vs T8, T10 vs T9 | **Dependência direta**; e as três tocam `packages/cobranca-bancaria/src/index.ts` | `Não` |
| 4 | T12 vs T11 | **Dependência direta**; e T11 toca `apps/api/src/app.module.ts` (registro/DI) | `Não` |
| 5 | T14 vs T13 | **Dependência direta** — a T14 escritura o índice de débito, que precisa refletir **todo** marcador instalado, inclusive o que a T13 possa emitir | `Não` |

> **Isto é falso-sequencial deliberado.** A rule fixa que *"falso-sequencial custa minutos;
> falso-paralelo corrompe a ordem"*, e o histórico deste repositório é de execução sequencial —
> `fallback: sequencial` aparece nos runs das fatias anteriores. Um lote paralelo aqui teria de
> quebrar a convenção de **barril único por pacote**, que é decisão registrada nos docblocks de
> `@sysloc/contracts`, `@sysloc/regua` e `@sysloc/documentos`.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
| --- | --- | --- | --- |
| US-01 — registrar o certificado | Tabela `negocio.certificado_do_provedor` (§7.2), `esquemaDoCertificadoNovo` (§4.2), `SegredoOperavel` (§11.3), `lerMaterial` (§6.2) | **T7, T9, T11** (entregam) · T1, T2, T4 (habilitam) | Concluído |
| US-02 — consultar sem que o segredo volte | Projeção publicada `strictObject` (§4.2), contenção estrutural (§10.3), radicais do registrador (§10.3) | **T11, T13** · T1, T2, T3 (habilitam) | Concluído |
| US-03 — ver a antecedência do vencimento | Derivação na aplicação a partir de `data_corrente_da_operacao()` (§6.2), `LIMIAR_DE_VENCIMENTO_EM_DIAS` com definição única | **T11** · T1 (habilita) | Concluído |
| US-04 — testar contra o provedor | `PortaDeIdentidadeBancaria` (§3.2), adaptador mTLS por chamada (§8) | **T8, T10, T12** | Concluído |
| US-05 — renovar preservando o registro | Substituição atômica + `CHECK` que torna "substituído com segredo" irrepresentável (§7.2/§7.4) | **T7** · T4, T11 (habilitam) | Concluído |
| US-06 — identificador único no SaaS | Schema `plataforma`, sequência e função sem parâmetro (§7.2), composição das 18 posições (§6.2) | **T4, T5, T6** | Concluído |
| US-07 — ausência falha de forma nomeada | `404` nomeando empresa e ausência (§10.1); **nenhum caminho de reserva existe no código** | **T12** · T11 (habilita) | Concluído |
| US-08 — segredo não aparece em lugar nenhum | Contenção estrutural + redação como segunda barreira + **medição sobre a saída real** (§10.3, §19) | **T2, T3, T13** | Concluído |
| US-09 — vocabulário próprio com meio de recebimento | Modelo canônico agnóstico (§3.2), `MEIOS_DE_RECEBIMENTO` (§4.2), asserção de vocabulário | **T8** · T1 (habilita) | Concluído |

> **Coluna `Status` conferida na T14 (2026-08-16).** As nove passam a `Concluído`, e a marcação **não
> antecipa gate nenhum**: a coluna `Tasks Relacionadas` mostra que **nenhuma US é entregue ou
> habilitada pela T14** — ela fecha o número da superfície, a autorização das três rotas e a
> escrituração, sem entregar comportamento de US. As tasks que entregam as nove (T1 a T13) estão
> todas aprovadas nos dois gates, de modo que a verdade material da coluna independe do veredito da
> T14. Antes desta conferência oito das nove diziam `A Fazer` com o run inteiro entregue, o que
> impedia o critério **C3** de ser marcado com verdade.
>
> **Nenhuma US órfã, nenhuma task órfã.** As colunas separam **quem entrega** de **quem habilita**
> porque a Regra 5 sinaliza revisão quando uma US aparece em 4+ tasks: aqui isso acontece na US-01 e
> na US-02, e a revisão foi feita — a causa é **estratificação** (contrato → cifra → banco →
> adaptador → borda), não fragmentação. Nenhuma das tasks habilitadoras existiria só para aquela US:
> **T1** serve a seis, **T2** a três, **T4** a três.
>
> **Cobertura dos CAs**: os 14 CAs do PRD estão cobertos pela §19 do tech spec e distribuídos na §6
> de cada task. **Nenhum CA órfão.**

---

## 6. Dependências Gerais

### 6.1 Entre tasks

Ver §4 e §4.1. Duas arestas merecem nota, porque não são óbvias pelos nomes:

- **T6 depende de T1** — a largura e o formato do identificador saem de `@sysloc/contracts`, com
  **definição única**. Duas declarações do mesmo formato é a forma exata do débito **D14**.
- **T14 depende de T13** — a T14 escritura o índice de débito, e ele precisa refletir **todo**
  marcador instalado pela fatia.

### 6.2 Externas e pré-requisitos

| Item | Estado |
|---|---|
| **ADR-0031** (tabela sem dono-empresa) | ✅ `accepted` desde 2026-08-14 — **pré-requisito**, já satisfeito |
| **ADR-0032** (segredo operável cifrado) | ✅ `accepted` desde 2026-08-14 — **pré-requisito**, já satisfeito |
| **ADR-0033** (série declara o próprio escopo) | ✅ `accepted` desde 2026-08-14; **supersede a 0015**, e é o que desbloqueia a T4/T6 |
| **Habilitação junto ao provedor** (certificado e credenciais de homologação) | ⏳ **Não é pré-requisito desta fatia** — nenhum caso toca o provedor real (ADR-0006). É pré-condição da fatia **(ii)**, a confirmar **por data** |
| **Dependências externas novas** | ✅ **Zero.** `undici` fica para a fatia (ii); biblioteca de PKCS#12 rejeitada (D2-c) |
| `provisionar-base.sh` e `verificar-provisionamento.sh` | ⚠️ Exigem **`sudo` com senha interativa** — **nenhum subagente os executa**. A execução é conduzida pelo orquestrador **junto ao operador**, com saída preservada, e o gate reporta `executou_testes: false` |

### 6.3 Fatos operacionais que mordem quem rodar a suíte

- **Meça a suíte POR PACOTE** (`pnpm --filter @sysloc/<pacote> test`). `turbo run test` **aborta os
  pacotes irmãos** quando um falha, e a saída agregada não carrega contagem confiável.
- **Rode `rm -rf /tmp/sysloc-banco-*` entre execuções.** O disco do host está em **~96%**, e
  `No space left on device` **se disfarça de teste vermelho**.
- ⚠️ **`vitest run` avulso é INVÁLIDO para trabalho de mutante** — os pacotes resolvem `"."` para
  `dist/`, e o mutante fica no fonte sem alcançar o que executa: verde lido como *"o mutante
  sobreviveu"* quando ele nunca foi executado.
- **Baseline da suíte hoje: 1248 casos.** É o número do P1/P5 do Protocolo Antirregressão.

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:

- [x] **1.** As **14 tasks** aprovadas nos **dois gates**, nenhuma bloqueada.
- [x] **2.** Os **14 Critérios de Aceite** do PRD (CA-01 a CA-14) verificados, um a um, contra os CTs
      da §19 do tech spec e da §6 de cada task.
      ⚠️ **Marcado com a ressalva que o Gate 2 exigiu, e ela é sobre a DIREÇÃO do erro**: as linhas de
      **CA-07** e **CA-13** da §6.5 da T10 (e as do §19) **omitem o CT-863** — isto é, **subestimam** a
      cobertura. *"Subestimação não pode fazer um CA descoberto parecer coberto, logo não falsifica «os
      14 CA verificados, um a um»."* O que fica em débito é a **atualidade do mapa**, não a verificação —
      é o **D42**, que já traz as quatro edições de uma linha. E a incompletude do §19 é **declarada**,
      não silenciosa: a T10 registra a saída de faixa do CT-863 e a §9 abaixo foi emendada no fecho do D35.
- [x] **3.** As **9 User Stories** cobertas (tabela §5), sem US órfã.
- [x] **4.** Suíte verde **por pacote** e **monotônica** — nenhum pacote encolhe em nenhuma rodada.
      Baseline `1248` → o total final registrado no `run-report.md`.
- [x] **5.** `pnpm build` e `pnpm lint` verdes.
- [x] **6.** Superfície publicada em **92 rotas / 77 manipuladores**, por **dupla medição independente
      com a igualdade entre os dois eixos afirmada** (CT-836), `publicas` com **19** entradas e
      `semDeclaracao` **vazio**.
- [x] **7.** **Zero dependências externas novas**; o monorepo passa de **6 para 7** pacotes.
- [x] **8.** As **provas de falsificação** demonstradas e revertidas nos casos de asserção estática:
      **CT-809, CT-829 (duas), CT-832, CT-834, CT-835, CT-836 (três), CT-850 (duas)**.
- [x] **9.** A **medição da ADR-0032** feita sobre **quatro superfícies reais** (corpos, corpo de
      erro, documento publicado, arquivo de diário) mais o **estado em repouso** — cada varredura com
      **controle positivo**.
- [x] **10.** O par **CT-818/CT-822** entregue **inteiro** — quem cortar um tem de cortar os dois.
- [x] **11.** O **CT-828** com a **segunda asserção** (zero conexões ao provedor) — sem ela, o fim do
      caminho de reserva não está provado.
- [x] **12.** Guarda de admissão de `plataforma` afirmando as **duas pontas** e devolvendo o
      **conjunto examinado** (CT-812).
- [x] **13.** `plataforma.proximo_identificador_bancario()` com **zero parâmetros** e `sysloc_app`
      **sem nenhum** privilégio sobre a sequência (CT-814, CT-815).
- [x] **14.** Raio de impacto da tabela nova fechado nas **quatro** âncoras de contagem exata
      (`papel-de-conexao`, `catalogo`, `isolamento`, `verificar-migracao.sh`), **por igualdade** —
      nunca por `toContain`.
- [x] **15.** Raio de impacto das variáveis novas fechado nas **três** âncoras de `ambiente.spec.ts`
      (`CT-007`, `CT-008`, `CT-639`), com `SUT_IS_CORRECT_BECAUSE:` onde exigido.
- [x] **16.** Escrituração completa: `CLAUDE.md` atualizado, índice de débito conferido **nas duas
      pontas**, **D39 atualizado e não fechado**, e as duas cláusulas de runbook da F7 registradas.
- [x] **17.** `/opt/frappe` **intacto e de pé** — nada destrutivo contra o legado.

> **Não é critério de conclusão desta fatia**: o congelamento da superfície da API (é o *depois* da
> F4 e da F5 — a fatia (ii) traz ~5 rotas e a (iii), ~2) nem a resolução de débito em massa (o
> parecer do projeto é **NÃO** rodar `/agent-spec-debt-resolution`, reafirmado três vezes com razões
> medidas).

---

## 8. Riscos & Mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | **O segredo escapa por caminho que ninguém lê** — foi o achado crítico da fase anterior, e a fatia põe um segredo maior perto de mais superfícies | Média | **Crítico** | Contenção estrutural (T2) + radicais no registrador (T3) + **medição sobre a saída real** de quatro superfícies (T13). Os vetores estão nomeados na §21.1, e a medição tem **alvo** em vez de ser varredura de boa vontade |
| 2 | ⚠️ **A §3.6 do tech spec SUBDECLARA o raio de impacto da tabela nova** — `papel-de-conexao.spec.ts` (`toHaveLength(15)` + 15 nomes) e `catalogo.spec.ts` (`TABELAS_LEGITIMAS`, 16 objetos) ficam vermelhos assim que a `0015` roda, e **nenhum dos dois está declarado** | **Alta** | Médio | **Achado desta decomposição, medido contra o código.** Os dois estão em §5.2 da **T4**, com a nota de escopo da Regra 10b. Crescimento **por igualdade**; `toContain` é regressão de prova |
| 3 | ⚠️ **O `CT-639` existente compara `EXIGIDAS_SEM_PROVISIONAMENTO` por IGUALDADE** contra `['BETTER_AUTH_SECRET']`, e as duas variáveis novas o farão reprovar | **Alta** | Médio | **Achado desta decomposição.** Está em §3.7/§7 da **T11**, com a correção legítima escrita: declarar no `.env.example` e atualizar o valor esperado **com a testemunha medida** (o crescimento do D39). **Afrouxar para `toContain` está proibido** |
| 4 | **A guarda do schema `plataforma` aprova vazia** — o roster desta fatia é vazio, e consulta que não acha nada parece consulta que aprovou | Média | Alto | A guarda devolve o **conjunto examinado** junto do veredito, e o CT-812 afirma as duas direções (T5) |
| 5 | **O `provisionar-base.sh` não é executável por subagente** (`sudo` interativo), e o schema novo nasce nele | **Alta** | Médio | A instância efêmera **reproduz o provisionamento** (`banco-efemero.ts`), de modo que a suíte cobre o **efeito**; o script é conduzido pelo orquestrador junto ao operador, com saída preservada e auditada (T4) |
| 6 | **A chave de cifra não é provisionada** — o débito D39 cresce para duas variáveis | **Alta** | Alto | Partida **falha fechado** nomeando a variável (T11); `.env.example` documenta; o marcador do D39 e a §2 da fatia de origem são atualizados (T14). Fechá-lo de vez exige tocar script com privilégio, **fora do que esta fatia pede** |
| 7 | **O dump passa a conter material cifrado**, e alguém guarda dump e chave juntos | Média | **Crítico** | Cláusula escrita no item de resguardo da F7 (T14). É risco de **operação**, e a mitigação é documental por natureza — a ADR-0032 diz isso nos Cons |
| 8 | **O vocabulário do provedor vaza para o modelo canônico** ao escrever o adaptador | Média | Médio | Asserção de vocabulário com **controle positivo** e prova de falsificação (CT-834, T8; CT-840, T10) |
| 9 | **O aperto de mão em laço local se comporta diferente sob disputa de CPU** | Baixa | Médio | Porta dinâmica, teto declarado e o par positivo/negativo. O precedente do `CT-907` mostra que o modo de falha é **tempo esgotado**, não resultado errado |
| 10 | **A faixa de CT foi estendida** de CT-838 para CT-853 — o tech spec §19 declara "38 casos, sem lacuna" | Média | Baixo | Registrado em §9. A faixa continua **contígua e sem sufixo**; a §19 descreve o estado **anterior** à decomposição |
| 11 | **AP-29 (`tautological_assertion`)** — foi a **única** causa de rejeição repetida da fatia anterior, e esta fatia tem 8 varreduras por sentinela | Média | Alto | **Controle positivo obrigatório em cada varredura** (T8, T9, T10, T13), com a asserção de que ela encontra o que existe |

---

## 9. Nota de reconciliação — a faixa de CT desta fatia

A §19 do tech spec declara **38 casos, CT-801 a CT-838, "sem lacuna e sem sufixo"**. A decomposição
encontrou **três arquivos de teste declarados na §3.5/§3.6 sem CT correspondente**, e os fechou pelo
procedimento da própria skill (*"só dispare QA para tasks sem match — a geração do tech_spec antecede
a decomposição"*):

| Arquivo | Situação na §19 | CTs gerados | Task |
|---|---|---|---|
| `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` | Declarado na §3.5, **sem CT** | **CT-839 a CT-844** (6) | T10 |
| `packages/contracts/test/esquemas.spec.ts` | Declarado na §3.6 (*"casos do esquema novo"*), **sem CT** | **CT-845 a CT-850** (6) | T1 |
| `apps/api/test/ambiente.spec.ts` | Declarado na §3.6 (*"casos das variáveis novas"*), **sem CT** | **CT-851 a CT-853** (3) | T11 |

**Total da fatia: 53 casos _de card_, CT-801 a CT-853, contíguos e sem sufixo.** Nenhum identificador
de CT-801 a CT-838 foi renumerado, movido ou alterado.

⚠️ **Casos nascidos como _rede de correção de gate_ correm FORA da faixa, a partir de CT-860** —
CT-860/CT-861 na **T7**, CT-862 na **T9**, CT-863 na **T10** e CT-864/CT-865 na **T11** —, porque
`CT-801` a `CT-853` estão **integralmente reservados** pelos cards das T1 a T14: reusar um deles
produziria duas coisas com o mesmo identificador, e sufixar contrariaria o *"sem sufixo"* desta mesma
seção. **O vão `CT-854..CT-859` nunca será preenchido.** Os seis declararam a saída da faixa por
escrito, com a razão, no arquivo em que vivem. (Emenda da **T14**, fechando o débito **D35** da §2 do
`_run/run-report.md`: a afirmação de contiguidade era verdadeira sobre os casos de card e falsa sobre
o conjunto real, e quem conferisse a faixa no fecho gastaria uma rodada decidindo se era defeito ou
registro vencido.)

⚠️ **`_run/test-cases.json` estava DEFASADO** em relação ao tech spec final: registrava 37 casos,
apontava a cifra para `packages/cobranca-bancaria/src/cifra.ts` e supunha **duas colunas cifradas** —
três colocações que a §19.0 do tech spec **reverteu** no challenge de 2026-08-14. A redistribuição
saiu da **§19**, que é a canônica, e o JSON foi reescrito.

### Duas reconciliações de colocação (invariantes preservados na íntegra)

| A §19 agrupa em | Esta decomposição coloca em | Por quê |
|---|---|---|
| CT-814, CT-815, CT-816, CT-817 sob `certificado-do-provedor.spec.ts` | **`identificador-bancario.spec.ts`** (T6) | Os quatro são **do contador**, e a §3.5 declara literalmente que esse arquivo cobre *"Não-reuso, avanço fora do desfazimento, **ausência de escopo por empresa**, forma das 18 posições"*. **A §3.5 é a autoridade sobre em que arquivo cada invariante mora** |
| CT-834 no grupo (a) de §19.4, cujo cabeçalho nomeia três outros arquivos | **`vocabulario-canonico.spec.ts`** (T8) | A §3.5 declara que esse arquivo cobre *"nenhum termo do provedor no vocabulário publicado (RN-10)"*, que é o invariante literal do CT-834 |

---

## 10. Checklist Final

- [x] Task Plan completo
- [x] Tasks mapeadas — 14 tasks em 5 fases, cada uma em `tasks/TN.md`
- [x] Dependências validadas e coerentes (Regra 10a — nenhuma task referencia símbolo nascido em task
      posterior)
- [x] `Símbolos públicos criados` / `Símbolos consumidos de outras tasks` preenchidos em cada `TN.md`
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + alta contenção
      (Regra 10d) — não autorado por intuição
- [x] Invariante satisfeito: nenhuma task `Sim` depende (direta ou transitivamente) de outra da mesma
      fase
- [x] Rastreabilidade User Stories → Tasks preenchida (§5), sem US órfã
- [x] Critérios de conclusão da feature definidos (§7)
- [x] Seção 6 (Testes) preenchida em cada task, com **6.0**, **6.5** e **6.6** (1 card por CT)
- [x] `_run/test-cases.json` reescrito com os 53 casos e o `task_id` de cada um
- [x] Arquivos impactados listados em cada task (5.1, 5.2, 5.3), incluindo o **raio de impacto** que
      o tech spec subdeclarava
- [x] `model`, `risk` e `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas
- [x] **Pronto para execução** — aprovado e **EXECUTADO**: as 14 tasks concluídas em 2026-08-16, todas
      aprovadas nos dois gates, nenhuma bloqueada
