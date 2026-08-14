# TASK PLAN – Plano de Execução das Tasks

> ## ▶️ RUN RETOMADO EM 2026-08-13 — A T9 E A T10 FECHARAM NOS DOIS GATES
>
> A pausa foi desfeita pela segunda vez, pelo caminho **(a) Retomar nos gates**, e o ponto sujo foi
> resolvido. A **T9** fechou em duas rodadas (`APROVADO_COM_OBSERVACOES` nos dois gates) e a **T10**
> também em duas, esta com **`APROVADO` limpo nos dois** — zero problemas de qualquer severidade na
> rodada final, e os **8 anotáveis das duas rodadas todos fechados**, nenhum sobrando para a §2.
>
> **T1..T10 concluídas e staged (sem commit).** Suíte em **1239** casos; superfície em **88/73**.
> Faltam **T11 e T12**.
>
> ⚠️ **O que a T10 deixa para a T11 — e o que ela deixa para a T12, que é mais importante ainda:**
> o **contrato do fragmento**. O link é `<base>/confirmar-email#<segredo>`, com o segredo no
> **fragmento** e não na consulta, porque o fragmento **não é transmitido ao servidor** — não entra na
> trilha do servidor de borda da F7, não viaja no `Referer` e não é gravado no registro de acesso.
> **A consequência atravessa a fronteira deste repositório**: a página da F6 lerá `location.hash` e
> apresentará o segredo no **corpo** de `POST /v1/confirmacoes-de-email`. Isso é **insumo obrigatório
> do handoff da T12**, e está registrado na §4 do `_run/run-report.md` justamente porque
> `packages/documentos/src/` **não é entrada de gerador de handoff**.
>
> ⚠️ **A quarta ocorrência do D6 CORRIGIU a delimitação que as três anteriores registravam**: o gatilho
> do subdimensionamento da §5.2 **não é publicar rota** — a T10 não publica nenhuma e caiu no padrão
> mesmo assim. É **criar aresta nova entre pacotes, ou borda nova sob inventário estático**. A **T11
> faz as duas**: espere `cobertura-de-autorizacao.e2e.spec.ts`, `contexto.e2e.spec.ts` e a fiação, e
> **não leia isso como desvio de escopo do executor**.
>
> ⚠️ **Precedente que a T9 estabeleceu e a T10 confirmou**: prescrição de gate é **hipótese, não
> ordem**. Nas duas tasks o executor **mediu em vez de confiar na forma**, e nas duas a medição mudou o
> desenho — na T10 ela mostrou que `URL.parse` aceita `mailto:`, `javascript:` e `file:` como
> absolutas, e que um ramo para servidor vazio seria **asserção incapaz de falhar**. Divergir em
> silêncio continua sendo desvio; divergir **declarando e medindo** é o caminho certo.

---

> ## ▶️ Estado das tasks já fechadas — 9/12 CONCLUÍDAS
>
> A **T7** concluiu em duas rodadas (o `COALESCE` roda **no banco**, o `Buffer` vai **direto** ao
> `reply.send`, e o **D36 fechou nas duas pontas**); a **T8** em três, entregando a camada de dados
> inteira da confirmação e fechando o **D13 (F3/T5)**, também nas duas pontas; e a **T9** em duas,
> fechando o **CRÍTICO de segurança** do segredo vazando para o journal por `err.command.args` —
> saneamento na **fronteira única**, sob `DECISÃO FECHADA`, provado com servidor Redis real em `OOM`.
>
> **Baseline da suíte: 1217 casos**, por pacote — contracts 297 · auth 89 · **db 167** · regua 30 ·
> worker 48 · **api 218** · shared 222 · documentos 146. Nenhum pacote pode encolher.
> **Superfície da API: 88 rotas / 73 manipuladores** — a última que falta chega em **T11** (→89/74).
>
> ⚠️ **O que a T8 deixou para a T11, e que é a coisa mais importante desta lista**: a §3.2 da `T11.md`
> **foi emendada** (RN-15) porque o `undefined` do consumo passou a ter **três** causas, não uma — o
> Gate 2 achou que `consumirPortador` não reconferia validade, e a correção acrescentou
> `AND invalidado_em IS NULL AND expira_em > pg_catalog.now()` ao `WHERE`. **As três causas continuam
> no mesmo `200 { confirmado: true }`, e a emenda proíbe escrever ramo para qualquer uma.** Isso **não**
> autoriza `consumido_em` na função `SECURITY DEFINER` — a `DECISÃO FECHADA — T3` da `0014` governa a
> **resolução** e permanece intocada.
>
> ⚠️ **Duas autorizações do usuário valem para TODO este run**, repetidas no comando de retomada:
> (a) **não pausar** aguardando resposta — toda pergunta assume a opção recomendada; (b) **sem teto
> de 3 tentativas** — a correção prossegue até não haver bloqueante.
>
> ⚠️ **O que a T7 deixou como aviso para as T8..T12**: a §5.2 das tasks que publicam rota está
> **subdimensionada por construção** — ela não conta as âncoras de inventário
> (`cobertura-de-autorizacao.e2e.spec.ts`, `contexto.e2e.spec.ts`) nem a fiação de
> manifesto/`tsconfig` que uma aresta nova entre pacotes obriga a tocar. O docblock de
> `contexto.e2e.spec.ts` registra a mesma divergência pela **décima** task consecutiva (é o débito
> D26 · F2/T6). **A T9 e a T11 publicam rota** — espere o mesmo, e não o leia como desvio de escopo
> do executor.
>
> **Não se toca**: as `DECISÃO FECHADA` de `packages/documentos/src/normalizacao.ts:80` (T4), de
> `packages/documentos/src/contrato/qualificacao.ts:233` (T5), a da migração `0014` (T3) e a **nova**
> de `apps/api/src/contratos/contrato.controller.ts:496` (T7 — a extensão da unidade de trabalho do
> manipulador do documento).
>
> ⚠️ **Disco do host em 96% (~1,3 GB livres)** — `rm -rf /tmp/sysloc-banco-*` entre execuções.

## 1. Identificação
- **Feature/Projeto**: Documentos e confirmação — o contrato em PDF derivado do dado no instante do pedido, e a confirmação do endereço de e-mail do locatário por portador que não se forja (sub-fatia **2b** de 2 da F3, e a que **fecha a Fase 3**)
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-12
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/documentos-e-confirmacao/v1/tech_spec.md`
- **PRD**: `docs/prds/features/documentos-e-confirmacao/v1/prd.md`
- **Tech Alignment**: `docs/specs/features/documentos-e-confirmacao/v1/tech-alignment.md` (D1..D8)
- **Pré-refinamento**: `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md` (especializa o partilhado de `regua-e-documentos/v1`, que permanece intacto)
- **Variante**: `backend` — sem `design.md`, por decisão registrada no `CLAUDE.md` (este repositório não produz interface)

---

## 2. Objetivo do Task Plan

Entregar **duas frentes que não compartilham um único símbolo**, sob o mesmo artefato, e o corte
técnico é o mesmo do produto.

**O documento** troca *artefato armazenado* por *função pura do estado gravado*: nasce o pacote
**`@sysloc/documentos`** (pacotes 5 → 6), no molde de `@sysloc/regua`, que compõe o contrato a partir
de dados já resolvidos e **declara a porta de renderização** que a infraestrutura satisfaz. A borda
orquestra e devolve bytes. A marca de cancelamento vira **parâmetro da composição**, o que fecha o
**D36 (F2/T8) por construção** — sem documento armazenado não existe arquivo preexistente de que o
cancelamento possa depender.

**A confirmação** instala o **primeiro ato de negócio sem sessão** do produto: portador aleatório de
256 bits, guardado só como SHA-256, resolvido por uma função `SECURITY DEFINER` de superfície mínima
que **não aceita empresa por parâmetro**, com o contexto de tenant vindo do registro que ela resolve.

Ao fim das 12 tasks: **uma tabela nova** e **uma coluna a menos** em `negocio`, **3 rotas novas**
levando a superfície de **86/71 a 89/74** por dupla medição independente, a **igualdade com o golden**
provada com os **sete vereditos escritos antes da execução**, e o **D36 fechado nas duas pontas**.

---

## 3. Macro-Fases (alto nível)

As quatro fases da **§11 do PRD** (Roadmap) são a proposta de origem. Uma foi **acrescentada por
dependência técnica** — o substrato precisa vir antes das duas frentes, porque o `drizzle-kit` gera
**uma** migração a partir do diff do esquema e ela **atravessa as duas** (o `DROP COLUMN` é do
documento; a coluna e a tabela são da confirmação). É o mesmo movimento que a sub-fatia irmã fez.

- **Fase 1 – A janela que fecha (PRAZO)**
  - Objetivo: capturar do `/opt/frappe` os três caminhos do documento ainda sem oráculo — ou registrar
    a **ausência medida**. Primeira por **prazo**, não por dependência.
  - Tasks: **T1**
- **Fase 2 – O substrato declarado**
  - Objetivo: o contrato publicado da confirmação e do locatário, o esquema com as três mudanças e o
    raio inteiro do `DROP COLUMN`, e o pacote de domínio novo com a porta e a normalização fechada.
  - Tasks: **T2, T3, T4**
- **Fase 3 – O documento**
  - Objetivo: a composição pura provada contra o golden, a renderização real provada por extração de
    volta, e a rota de bytes — que **fecha o D36**.
  - Tasks: **T5, T6, T7**
- **Fase 4 – A confirmação**
  - Objetivo: as portas de dados do portador, o disparo único dos dois gatilhos por fila, a entrega no
    `worker`, e o ato do titular sem sessão.
  - Tasks: **T8, T9, T10, T11**
- **Fase 5 – As provas de fecho**
  - Objetivo: a superfície em 89/74 por dupla medição independente, e o isolamento da verificação com a
    monotonia por pacote.
  - Tasks: **T12**

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Capturar do sistema antigo os três caminhos ainda sem oráculo — ou registrar a ausência **medida** | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | O contrato publicado da confirmação e do locatário | [T2](tasks/T2.md) | 2 | — | Não | Concluído |
| T3 | Esquema e migrações `0013`/`0014` — o fim do arquivo e o raio do `DROP COLUMN` | [T3](tasks/T3.md) | 2 | — | Não | Concluído |
| T4 | O pacote `@sysloc/documentos` nasce — a porta e a normalização **falsificável** | [T4](tasks/T4.md) | 2 | — | Não | Concluído |
| T5 | A composição do documento — qualificação, cláusulas, extenso e a **igualdade com o golden** | [T5](tasks/T5.md) | 3 | T4 | Não | Concluído |
| T6 | O renderizador de PDF — a segunda ponta do **D3** | [T6](tasks/T6.md) | 3 | T4, T5 | Não | Concluído |
| T7 | A rota do documento — o agregado numa consulta e o **D36 fecha** | [T7](tasks/T7.md) | 3 | T3, T5, T6 | Não | Concluído |
| T8 | As portas de dados da confirmação — o portador e a projeção do locatário | [T8](tasks/T8.md) | 4 | T2, T3 | Não | Concluído |
| T9 | O disparo — contrato da fila, produtor, caminho único e a rota de reenvio | [T9](tasks/T9.md) | 4 | T8 | Não | Concluído |
| T10 | A entrega — a mensagem no domínio e o processador no `worker` | [T10](tasks/T10.md) | 4 | T4, T9 | Não | Concluído |
| T11 | O ato do titular — a **única** rota de negócio sem sessão | [T11](tasks/T11.md) | 4 | T8, T10 | Não | Concluído |
| T12 | O fecho — superfície **89/74** por dupla medição e o isolamento da verificação | [T12](tasks/T12.md) | 5 | T7, T9, T11 | Não | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1  (independente — primeira por PRAZO, não por dependência)

T2 ──┬──────────────► T8 ──► T9 ──► T10 ──► T11 ──┐
T3 ──┤                                    │        ├──► T12
     └──► T7 ◄── T6 ◄── T5 ◄── T4 ────────┘        │
          │                    │                    │
          └────────────────────┴────────────────────┘
T9 ──────────────────────────────────────────────► T12
T7 ──────────────────────────────────────────────► T12
```

Topologia em uma linha:
`T4 → T5 → T6 → T7 ; T3 → T7 ; {T2, T3} → T8 → T9 → T10 → T11 ; T4 → T10 ; T8 → T11 ; {T7, T9, T11} → T12`

### 4.2 Por que a coluna de paralelismo é toda `Não` — a derivação, não uma escolha

O flag foi **computado** pelo Invariante de Paralelismo (Regra 10d), par a par, dentro de cada fase.
Nenhum par sobrevive às cinco condições:

| Fase | Par | Condição que falha |
|---|---|---|
| 1 | — | T1 é a única task da fase |
| 2 | T2 × T3 | **paths não disjuntos**: as duas tocam `packages/contracts/test/esquemas.spec.ts` (T2 leva o CT-731; T3, o CT-713). E **alta contenção** nas duas pontas: T2 no barrel `contracts/src/index.ts`, T3 no **diretório de migrações** |
| 2 | T2 × T4 | **alta contenção**: T2 toca o barrel de `@sysloc/contracts`; T4 cria pacote e toca `pnpm-lock.yaml` (manifesto/lockfile) |
| 2 | T3 × T4 | **alta contenção**: T3 toca o diretório de migrações (a ordem é estado compartilhado); T4 toca o lockfile |
| 3 | T5 × T6 | T6 **depende** de T5 (mesma fase) — o invariante proíbe marcar `Sim` |
| 3 | T5 × T7, T6 × T7 | T7 **depende** das duas |
| 4 | T8 × T9, T9 × T10, T10 × T11 | dependência direta |
| 4 | T8 × T10, T8 × T11, T9 × T11 | dependência **transitiva** no DAG |
| 5 | — | T12 é a única task da fase |

**Alta contenção que reforça o veredito e sobreviveria a uma mudança de fase**:
`packages/contracts/src/index.ts` (T2) · o diretório de migrações (T3) · `pnpm-lock.yaml` (T4, T6, T7,
T9, T10) · `packages/db/src/index.ts` (T3, T7, T8) · `packages/shared/src/index.ts` (T9) ·
`apps/api/src/app.module.ts` (T11) · `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` (T7, T9,
T11, T12) · `CLAUDE.md` (T7 remove o D36, T8 pode remover o D13, T10 acrescenta o débito novo).

> **T1, T2, T3 e T4 são as quatro tasks genuinamente independentes desta fatia** — nenhuma tem
> dependência alguma. O executor pode batê-las junto com o que estiver pronto, porque os guards dele
> operam sobre **deps satisfeitas**, não sobre a fase. O flag permanece `Não` porque **falso-paralelo
> corrompe a ordem e falso-sequencial custa minutos**.
>
> **E há uma razão MEDIDA que valeria mesmo sem as acima**: o disco do host já esteve em ~93%, e duas
> instâncias de `embedded-postgres` simultâneas produzem `No space left on device`, que **se disfarça
> de teste vermelho** e queima tentativa do limite de 3. É a mesma razão que a fatia irmã registrou.

### 4.3 Sete achados da derivação que mudaram a decomposição — leia antes de executar

#### 1. A migração `0013` atravessa as duas frentes, e é por isso que o substrato virou fase própria

O `drizzle-kit` gera **uma** migração a partir do diff do esquema, e o tech spec (§3.5, §7.3) fixa
`0013` (gerada: `DROP COLUMN` + coluna + tabela) e `0014` (autoral: `FORCE RLS` + `SECURITY DEFINER`).
Não há como pôr a `0013` "dentro da fase do documento" sem que ela crie a tabela do portador, que é da
outra frente. **Partir em três migrações foi considerado e rejeitado**: contraria a nomeação explícita
da spec e não resolve o problema real, que é o item 2 abaixo.

E as duas **não podem virar tasks separadas** — a guarda de cobertura de `packages/db/src/catalogo.ts`
reprova toda tabela de negócio que exista **sem `FORCE RLS` e sem política**. É o mesmo arranjo de
`0009`/`0010`, `0011`/`0012` e `0007`/`0008`.

#### 2. O `DROP COLUMN` alcança 22 arquivos editáveis, e a medição foi refeita nesta derivação

`grep -rl "pdfContratoArquivo\|pdf_contrato_arquivo" --exclude-dir=dist apps packages` retorna **27**
caminhos. **Cinco** são migração já aplicada e snapshots do `drizzle-kit`
(`0007_dominio_contrato.sql`, `meta/0007|0008|0009|0011_snapshot.json`) e **não se tocam** — são
registro histórico. Restam os **22** que a §3.6.1 do tech spec declara.

Sob TypeScript strict, tirar o campo dos tipos faz **cada fixture que o carrega parar de compilar**,
em quatro pacotes. **Partir isso criaria janela de build vermelho entre tasks** — e o P5 do Protocolo
trata caso que estava verde e ficou vermelho como regressão. Por isso a **T3 é a task de maior raio da
fatia**, e o raio está declarado arquivo a arquivo na §5.2 dela.

#### 3. Um dos 22 não é fixture: `apps/api/src/contratos/contrato.service.ts:1196`

Ele **mapeia o campo na resposta**. Sai na **T3** (a linha do mapeamento), e o **mesmo arquivo** é
tocado de novo pela **T7** (que acrescenta `documento()` e remove o marcador do D36). Duas tasks, um
arquivo — e é por isso que T7 depende de T3 e o par jamais poderia ser paralelo.

#### 4. Em `contratos.e2e.spec.ts`, três das nove ocorrências são de DESENHO, não mecânicas

- **`:1447` e `:1468`** — é o **único** caso que **envia** `pdfContratoArquivo` no corpo e o afirma de
  volta. Ele **não se deleta**: o campo sai do corpo e da asserção, e o caso segue provando que a
  alteração de rascunho persiste. Deletar reduziria a contagem de casos, que é **regressão de prova**.
- **`:2742`** — o comentário registra que *"`pdfContratoArquivo` nulo, com o cancelamento respondendo
  `200`, é a forma de a não-portabilidade ficar provada"*. Com a coluna fora, a razão muda de lugar:
  **reescreva o texto**, não o apague. Apagar a razão é R3.
- **`:4369`** — um tipo local do próprio arquivo de teste perde o campo.

Toda alteração de asserção em suíte de fatia fechada carrega a linha `SUT_IS_CORRECT_BECAUSE:`.

#### 5. `packages/shared/test/fila.spec.ts` NÃO existe — a §3.4 do tech spec o marca `[M]`

A varredura do diretório confirma: `packages/shared/test/` tem 14 arquivos e **nenhum** deles é
`fila.spec.ts` (o contrato da fila é hoje provado pelo `CT-638`, dentro de
`protocolo-antirregressao.spec.ts`). Na **T9** ele entra como **arquivo novo**, e a task o declara
assim.

#### 6. Quatro realocações de placement de teste contra o `existing_suite` do JSON

**Decisão de placement, não de arquitetura** — o mesmo tipo de ajuste que a fatia irmã registrou:

| Casos | O JSON dizia | Onde ficam | Por quê |
|---|---|---|---|
| CT-727, CT-728 | `packages/db/test/contrato.spec.ts` | `packages/db/test/portador-de-confirmacao.spec.ts` | eles provam a função do **portador**; o arquivo de contrato foi o palpite do gerador na ausência de suíte |
| CT-709 | agrupado com a normalização (§19.1) | `packages/documentos/test/composicao.spec.ts` | ele precisa da **composição**, que nasce em T5; `normalizacao.spec.ts` nasce em T4 |
| CT-714, CT-715 | `apps/api/test/contratos.e2e.spec.ts` | `apps/api/test/documento-do-contrato.e2e.spec.ts` | a §3.4 do tech spec já prevê o arquivo novo; o CT-710 (cancelamento) **fica** em `contratos.e2e.spec.ts`, ao lado do `CT-415` |

#### 7. A âncora de superfície sobe em TRÊS tasks, e é conferida numa quarta

`ROTAS_PUBLICADAS_EM_PRODUCAO` acumula uma linha `SUT_IS_CORRECT_BECAUSE:` por task que publica par:
**T7 leva 86 → 87**, **T9 leva 87 → 88** e **T11 leva 88 → 89** (manipuladores `71 → 72 → 73 → 74`);
**T12 confere** por dupla medição independente. Deixar a âncora para o fim faria a suíte reprovar ao
fechar cada uma das três. ⚠️ **A base é `86`, não `77`** — o `77` vinha da premissa refutada do `HEAD`
em dobro, e `cobertura-de-autorizacao.ts` **suprime** o `HEAD` derivado.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|------------------|--------------------------|--------------------|--------|
| US-01 — Capturar os caminhos do documento sem oráculo antes do desligamento | §17 · captura no site efêmero; ausência **medida** vira registro | T1 | ✅ Concluído |
| US-02 — Documento que reflete o cadastro no instante do pedido | §5.1-A · composição pura + porta de renderização + rota de bytes | T4, T5, T6, T7 | ✅ Concluído |
| US-03 — Contrato cancelado sai visivelmente marcado | §5.1-A passo 4 · `cancelado` como **parâmetro**, nunca mesclagem sobre bytes | T5, T7 | ✅ Concluído |
| US-04 — Cancelar sem depender de documento | §21.6 · remoção do marcador `D36`; o cancelamento perde a pré-condição | T7 | ✅ Concluído |
| US-05 — Produto sem referência a arquivo do sistema antigo | §7.2, §7.3, §15.2 · `DROP COLUMN` + as três superfícies | T3 | ✅ Concluído |
| US-06 — Documento só para a empresa dona e para quem alcança Contratos | §11.2 · `@ExigeChave` herdada + RLS de `negocio.contrato` | T7 | ✅ Concluído |
| US-07 — Locatário confirma por link que só ele recebeu | §5.1-B.3 · portador de 256 bits, `SECURITY DEFINER`, rota `@RotaPublica()` | T2, T8, T11 | ✅ Concluído |
| US-08 — Confirmação disparada sozinha no cadastro do endereço | §5.1-B.1 · disparo dentro da unidade de trabalho, por fila | T9, T10 | ✅ Concluído |
| US-09 — Reenvio manual quando a mensagem não chega | §4.1 · `POST /v1/locatarios/:id/confirmacao-de-email`, `202` | T2, T9 | ✅ Concluído |
| US-10 — Estado de confirmação visível e informativo | §4.2 · `esquemaDoLocatario` + coluna + projeção condicional | T2, T8, T9 | ✅ Concluído |
| US-11 — Crescimento da superfície e da suíte medido | §11.2, §19 · dupla medição + suíte monotônica por pacote | T12 | ✅ Concluído |

> **Nenhuma US órfã, e nenhum CA sem task.** A US com mais tasks é a **US-02, com quatro** — acima do
> teto operacional de três, e a razão é **estrutural**, não decomposição frouxa: *"documento que
> reflete o cadastro"* atravessa **pacote de domínio → composição pura → renderização real → borda
> HTTP**, e cada uma dessas camadas é artefato arquitetural completo com prova própria. Fundi-las
> produziria uma task com dependência nova pesada (`@react-pdf/renderer`), diff enorme e a prova mais
> cara da fatia (a igualdade com o golden) enterrada no meio.
>
> **T12 não tem US própria de escopo** — ela é trabalho de **invariante transversal** e não acrescenta
> uma linha de código de produção.

---

## 6. Dependências Gerais

**Externas — e uma delas expira:**

- **T1 depende do `/opt/frappe` estar de pé e responsivo.** É a única dependência externa da fatia, e
  ela **expira na virada** (F7).
- ⚠️ **T1 NÃO exige `sudo`, e a premissa contrária é falsa.** `grep -n sudo` nos arquivos de
  `deploy/scripts/caracterizacao/` devolve **vazio**; o acesso é por `docker compose exec -T` e o
  usuário do host está no grupo `docker`. A exigência de `sudo` da `.claude/rules/testing-stack.md`
  vale para `deploy/scripts/instalacao/`, que toca o SO — **a distinção é por FRENTE, não por host**.
- **Nada mais na fatia depende de T1.** Se ela travar por indisponibilidade do legado, T2 em diante
  seguem sem bloqueio, e os três eixos seguem provados **por composição** (CT-704).

**Internas — as que mais custam se invertidas:**

- **T7 → T3** (o agregado e a resposta já sem a coluna; **e os dois tocam `contrato.service.ts`**).
- **T5 → T4** (a composição usa a fiação e o barrel do pacote novo).
- **T6 → T5** (o CT-708 compõe **e** renderiza).
- **T8 → T3** (a tabela, a coluna e a função existem a partir dali) e **T8 → T2** (o campo publicado).
- **T9 → T8** (o serviço de disparo consome as portas do portador).
- **T10 → T9** (o consumidor precisa do contrato da fila) e **T10 → T4** (a mensagem mora no pacote).
- **T11 → T10** (⚠️ o CT-721 **extrai o segredo do capturador**, o que exige o `worker` real
  processando — sem T10 não há de onde tirar o segredo em claro).
- **T12 → T7, T9, T11** (a âncora de 89/74 só bate quando as três rotas existem).

**Artefatos já disponíveis, que não são recapturados:**

- Os **11 goldens** existentes, em especial `contrato-pdf.txt` (o oráculo, **lido do disco** por T5),
  `contrato-pdf-fonte.py` (a regra legada) e `contrato-cancelamento.json` (os dois cenários de
  cancelamento com veredito escrito antes).
- O adaptador SMTP de produção e o capturador, em `@sysloc/regua` — ⚠️ **não se duplicam**.
- As **quatro ADRs desta fatia** já estão registradas (0027, 0028, 0029, 0030), todas de 2026-08-12.
  A **0030** é pré-requisito do Gate 2 para julgar T5, T6 e T7.
- O catálogo 10×7 permanece fechado: **nenhuma chave nasce nesta fatia**, e
  `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado por task alguma**.

**Débitos com gatilho — o que dispara e o que não:**

| Débito | Dispara? | Onde |
|---|---|---|
| **D36** (F2/T8) — a pré-condição do PDF no cancelamento | **SIM** | **fecha em T7**, por construção, com o marcador e a linha do índice saindo no mesmo commit |
| **D13** (F3/T5) — `semearPoliticaDeAviso` sem consumidor | **PROVÁVEL** | **conferir em T8**: o CT-730 é literalmente o gatilho escrito no marcador. Fechar nas duas pontas ou registrar a conferência |
| **D1** (F3/T2) — constantes monetárias | **VIGIAR** | **T5**: `extenso.ts` consome valor monetário. Se importar `MAIOR_VALOR_MONETARIO`/`ESCALA_MONETARIA`, o terceiro consumidor chegou |
| **D3** (F3/T1) — leitura autenticada do legado | **NÃO** | **T1** estende `capturar.py`, que roda **dentro** do site efêmero e não tem caminho de autenticação próprio. ⚠️ **Não escreva um quarto script com bloco de conexão** |
| **D14** (F3/T5) — fuso com duas declarações | **NÃO** | `expira_em` é `timestamptz` comparado com `pg_catalog.now()`; nenhum literal de fuso novo nasce |
| **D20** (F3/T7) — a janela da `0010` | **NÃO** | a fatia cria migrações **novas**; a `0010` não é tocada |
| **D12** (F3/T4) — `ESTADOS_AVISAVEIS` como tupla | **NÃO** | nenhuma task abre `packages/contracts/src/cobranca.ts` |
| **D49** (F3/T10) — detector de exigência de ambiente | **NÃO** | **T10** não é um terceiro processo — o `worker` já é um dos dois. Conferir e registrar |
| **D57** (F3/T12) — montagem instrumentada | **CONFERIR** | **T12**: as suítes novas usam `overrideProvider`; verificar se a terceira suíte chegou |
| **D23 · D24 · D27** — publicação atrás do servidor de borda | **NÃO** | ⚠️ **não crie um quarto marcador** para o limitador de taxa ausente (§11.5) |
| **DÉBITO NOVO** — `MensagemDeEmail` como 2ª declaração | **EMITIDO em T10** | com marcador em `mensagem-de-confirmacao.ts` **e** linha no índice do `CLAUDE.md`. O `{n}` sai da §2 do `run-report.md` **desta** fatia |

---

## 7. Critérios de Conclusão da Feature

A feature será considerada concluída quando:

- [x] As **12 tasks** concluídas e aprovadas nos dois gates
- [x] `pnpm build`, `pnpm lint` e as suítes verdes, com a contagem comparada contra a baseline de
      **1004 casos**, medida **POR PACOTE** — crescimento monotônico, nenhum pacote encolhendo em
      nenhuma rodada; **queda inexplicada é regressão de prova**
- [x] Os **18 critérios de aceite** do PRD com ao menos um caso rastreado — **33 CTs** (`CT-701`..`CT-715`,
      `CT-717`..`CT-734`), cada um em **exatamente uma** task
- [x] Superfície publicada em **89 rotas / 74 manipuladores**, `semDeclaracao` vazio, contagens refeitas
      por varredura e concordantes nas **duas** medições independentes, **com a igualdade entre os eixos
      afirmada explicitamente** (CT-732)
- [x] `negocio.portador_de_confirmacao` com **RLS habilitada e forçada**, política única `FOR ALL` com
      `USING` = `WITH CHECK`, FK **composta** e `UNIQUE` global sobre o derivado
- [x] `verificarCoberturaDeIsolamento` sem exceções, com a tabela nova em `TABELAS_LEGITIMAS`
      (comparada por igualdade)
- [x] `pdf_contrato_arquivo` **ausente do catálogo** (CT-712, com controle contra a `0012`), ausente da
      **entrada** e da **saída** publicadas (CT-713) e ausente da resposta real (CT-714)
- [x] ⚠️ **Nenhum `it` removido** em nenhum dos 22 arquivos alcançados pelo `DROP COLUMN`; toda asserção
      alterada em suíte de fatia fechada carrega `SUT_IS_CORRECT_BECAUSE:`
- [x] A **igualdade com o golden** fecha com **toda** divergência casando exatamente um dos **sete
      vereditos escritos antes** (DV-01 a DV-07) — divergência nova **reprova**, e a saída é emendar o
      artefato e escalar, nunca ajustar o teste
- [x] As **três provas de falsificação obrigatórias** executadas e revertidas, **pelo script do
      pacote**: **CT-707** (a normalização, 5 mutantes + controle), **CT-712** (a ausência da coluna) e
      **CT-729** (o segredo nunca gravado em claro)
- [x] A função `SECURITY DEFINER` **sem** `AND p.consumido_em IS NULL` no `WHERE`, com parâmetros
      **exatamente** `['p_derivado']` e colunas **exatamente** `(empresa_id, locatario_id, consumido_em)`
- [x] As **três recusas** (inválido, vencido, consumido-fora-da-validade) idênticas por `toStrictEqual`,
      e o **registro** também não as distingue (`motivo: 'nao-resolvido'` constante)
- [x] **O D36 (F2/T8) está fechado**: o marcador removido de `contrato.service.ts` **e** a linha
      removida do índice do `CLAUDE.md`, no mesmo commit — as **duas pontas**
- [x] O **débito novo** de T10 emitido com marcador **e** linha de índice, e o `ÍNDICE` apontando para a
      §2 do `_run/run-report.md` desta fatia
- [x] Os marcadores do **D1**, **D3**, **D12**, **D14**, **D20**, **D23**, **D24**, **D27**, **D49** e
      **D57** conferidos — mantidos ou fechados, com o desfecho registrado
- [x] `packages/documentos` **não declara `@sysloc/db`** em lugar nenhum; `pnpm build` **sem**
      `Cyclic dependency detected`
- [x] **Nenhuma verificação alcança destinatário real e nenhuma escreve no legado** (CT-733, com os
      dois mutantes)
- [x] `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado** por task alguma
- [x] `packages/db/src/envio-de-cobranca.ts` **não foi tocado** — a régua não se altera (CA-16, CT-730)
- [x] `packages/db/src/unidade-de-trabalho.ts` e as duas `DECISÃO FECHADA` de `apps/worker/src/fila.ts`
      permanecem **byte a byte** idênticos
- [x] O registro de que **a página que recebe o link não existe neste repositório** está na §4 do
      `_run/run-report.md`, como insumo do handoff
- [x] **Nenhuma linha de frontend** foi escrita — a Fronteira do projeto

---

## 8. Riscos & Mitigações

| Risco | Task | Mitigação |
|---|---|---|
| **A normalização do D3 nascer frouxa e a prova virar carimbo** — o risco **central** da fatia | T4, T5 | A regra é **fechada em 3 operações** e provada por falsificação com **5 mutantes** que precisam ficar vermelhos, mais o controle pela outra ponta; e nasce sob `DECISÃO FECHADA`, porque a tentação chega na rodada em que a comparação reprovar |
| **Divergência descoberta durante a execução** — o PRD a declara *falha de método*, não resultado | T5 | Os **sete vereditos** (DV-01..DV-07) estão escritos **na especificação, antes**. Divergência nova exige **emenda ao artefato e escalada**, nunca ajuste de teste |
| **A janela do legado fechar antes da captura** (CA-01) | T1 | É a **primeira** task, por prazo. ⚠️ E a premissa que a condiciona é **medida antes de ser registrada** — foi o erro que parou a T1 da fatia de contratos |
| **O `DROP COLUMN` quebrar a compilação em quatro pacotes no meio da task** | T3 | Os **22** arquivos estão declarados arquivo a arquivo na §5.2 de T3, separados em **classe mecânica** e **classe de desenho**. Não declará-los faria o executor bater no gatilho *"arquivo fora de escopo"* ou desviar em silêncio |
| **A contagem de casos cair ao remover a linha da fixture** | T3 | ⚠️ Só a *linha* sai; **nenhum `it`**. O caso que **enviava** o campo é **convertido**, nunca deletado, com `SUT_IS_CORRECT_BECAUSE:` |
| **Acrescentar `AND p.consumido_em IS NULL` à função**, achando que endurece | T3, T11 | **Quebraria a RN-10** e reabriria o defeito que o CT-724 fecha. A leitura conjunta está registrada na §21.3 (2) do tech spec e repetida nas duas tasks |
| **A `0013` é destrutiva e não tem volta** enquanto a F7 não entregar backup | T3 | §16.6. A ordem migrar → construir → reiniciar é obrigatória, e a assimetria está escrita. A suíte roda em instância efêmera — o risco é **operacional**, não do run |
| **`react` num manifesto deste backend ser lido como violação da Fronteira** | T6 | Risco de **leitura**, não de comportamento, e por isso se mitiga **por escrito**: no cabeçalho do `package.json`, no docblock do adaptador e na §3.3 do tech spec |
| **O segredo em claro vazar para registro** | T8, T9, T10 | Ele **nunca** é gravado no banco; entra na lista de chaves **redigidas** do despacho único que a F1 instalou; e vive em Redis só pelo tempo da tarefa. A exposição residual (1.000 tarefas retidas) está **declarada** em §11.3 |
| **O disparo alcançar os três papéis** — a superfície é compartilhada | T9 | O gancho é **5º parâmetro opcional** do construtor, suprido **só** pelo `LocatarioController`. ⚠️ Nenhum ramo `this.papel === 'locatario'` dentro da classe, e o aceite técnico o exige por `grep` |
| **Disparar a QUALQUER `PUT`** — o `PUT` é substituição integral e carrega `email` sempre | T8, T9 | A condição desceu para o `UPDATE` (`IS DISTINCT FROM` + `RETURNING OLD./NEW.`, PG 18). O **CT-718** é o companheiro negativo que pega o defeito |
| **Um envio real escapar durante a verificação** (RN-16) | T10, T11, T12 | Barreira **estrutural**: `overrideProvider(TOKEN_PORTA_DE_EMAIL)`, e o adaptador de produção **proíbe por escrito** o ramo de ambiente. O **CT-733** varre e o mutante prova que a varredura reprova |
| **Fabricar o segredo no teste** em vez de capturá-lo | T11 | O caminho legítimo está escrito em cada card: criar pelo caminho real → worker real → capturador → extrair da mensagem. **Nunca inserir no banco nem fabricar hash** — isso provaria o teste, não o produto |
| **Âncora de superfície derivada de si mesma** | T7, T9, T11, T12 | Contagem refeita **do zero por varredura** em cada task que publica rota; conferência final por **duas medições independentes** com a igualdade **afirmada** |
| **`CT-907` flaky pré-existente** confundir o diagnóstico | todas | Falha por **timeout** (5000 ms sob disputa de CPU) é o flake conhecido; falha por **asserção** é achado. Rode isolado para discriminar |
| **Disco do host em ~93%** produzir `No space left on device` disfarçado de teste vermelho | todas | `rm -rf /tmp/sysloc-banco-*` entre execuções; é também uma das razões de o paralelismo ser todo `Não` |
| **Mutante avaliado com `vitest run` avulso** concluir o oposto do verdadeiro | T3, T4, T6, T8, T12 | Mutante **sempre** pelo script do pacote (`pnpm --filter @sysloc/<pacote> test`) — os pacotes resolvem `"."` para `dist/` |
| **Colisão de identificador `Dnn`** ao registrar o débito novo | T10 | A sequência corre dentro da §2 do `run-report.md` **desta** fatia (§3-B da `nao-regressao.md`); o identificador é o par `Dnn · F3/Tn` mais o `ÍNDICE` |

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas — 12 arquivos em `tasks/`
- [x] Dependências validadas — DAG acíclico, conferido nos dois sentidos
- [x] `Símbolos públicos criados` / `consumidos de outras tasks` preenchidos em cada `TN.md` (Regra 10a)
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + paths + contenção (Regra 10d), com a derivação registrada em §4.2
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — 11/11 cobertas, nenhuma órfã
- [x] Seção 6 preenchida em todas as tasks, com 6.0, 6.5 e 6.6
- [x] `_run/test-cases.json` atualizado com `task_id` por caso — **33 casos**, cada CT em exatamente 1 task
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Comentários internos de template removidos dos arquivos finais
- [x] Pronto para execução

---

## 10. Notas de Geração

**Origem dos casos de teste.** Os **33 CTs vieram integralmente de redistribuição** a partir de
`_run/test-cases.json`, **sem reinvocar o gerador**: todos os 33 já traziam
`criterios_aceitacao_validados` preenchidos e os campos ricos (`invariant`, `pre_condicoes`, `passos`,
`negative_companion`, `precondicao_privilegiada`), o que torna o Detalhamento §6.6 **lossless**. O
match componente↔task saiu de `existing_suite` + `camada` + `owning_layer`, com as **quatro
realocações** de §4.3, item 6. **Nenhum subagente de QA foi disparado**, e nenhuma task ficou sem CT.

**Por isso o `_run/qa_context.md` não foi gerado**: ele existe para evitar que N subagentes releiam o
tech spec inteiro, e aqui **N = 0**. Gerá-lo produziria artefato sem consumidor. É o mesmo desfecho da
sub-fatia irmã.

**IDs de CT são globais da feature**, de `CT-701` a `CT-735`. ⚠️ O **CT-735** nasceu na **rodada 3 da T3**, para fechar o achado `testability` do Gate 2 (a função `SECURITY DEFINER` entregue sem caso comportamental) — ele é o **34º** caso da fatia e não estava no `_run/test-cases.json`. ⚠️ **O vão do `CT-716` é intencional e
foi preservado** (§19 do tech spec): renumerar dessincronizaria as tabelas do tech spec e o
`_run/test-cases.json`. Casos de apoio sem CA próprio — os do `extenso.spec.ts` (T5), do agregado
(T7), da projeção (T8), do contrato da fila (T9) e da mensagem (T10) — **não recebem ID novo**, pela
mesma razão; eles aparecem nas tabelas 6.1-6.2 marcados como *apoio*.

**`gates: [qa, tech_review]` nas 12 tasks**, e não é conservadorismo preguiçoso: cada uma toca ao menos
uma categoria crítica — `db_migrations` e `security` (T3), `crypto` (T8), `auth` (T11),
`api_contracts` (T2, T7, T9), `secrets/config` (T9, T10), `padrao_novo`/`candidato_adr` (T1, T4, T5,
T6), `service_complexo` (T10), `security` de fronteira (T12). **`model: opus` em todas** por decisão
do projeto registrada no `CLAUDE.md`, que vence a heurística do framework — **Sonnet e Haiku estão
proibidos**, inclusive nos subagentes de gate.

**`risk: high` em seis tasks** — T3 (migração destrutiva, RLS forçada e `SECURITY DEFINER`), T7 (rota
de bytes sob RLS e o fecho de um débito), T8 (geração e guarda de segredo), T9 (efeito externo,
variável de ambiente e rota nova), T10 (efeito externo irreversível: SMTP) e T11 (a única rota de
negócio sem sessão do produto).

**Duas tasks não acrescentam código de produção** — a **T1** produz artefatos de caracterização, e a
**T12** é **só prova**. Isso é deliberado: se qualquer prova da T12 reprovar, a correção é na task de
origem, **nunca** na asserção.

**A fatia emite UM débito com gatilho (T10) e fecha ao menos UM (D36, em T7), possivelmente dois**
(D13, em T8). As duas pontas — marcador no código e linha no índice do `CLAUDE.md` — são obrigatórias
nos dois sentidos, e o bloco de débitos do `CLAUDE.md` **não** é apagado: restam marcadores vivos.
