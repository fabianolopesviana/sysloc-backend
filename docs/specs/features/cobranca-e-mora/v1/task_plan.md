# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Cobrança e mora por empresa, com estado de fonte única no servidor (fatia 1 de 2 da F3)
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-09
- **Status**: Rascunho
- **TECH_SPEC**: `docs/specs/features/cobranca-e-mora/v1/tech_spec.md`
- **PRD**: `docs/prds/features/cobranca-e-mora/v1/prd.md`
- **Variante**: `backend` — sem `design.md`, por decisão registrada no `CLAUDE.md` (este repositório não produz interface)

---

## 2. Objetivo do Task Plan

Entregar a **cobrança como fato financeiro tenantizado**, sempre filha de contrato, com **estado e mora derivados numa fonte única no banco** — fechando o defeito de origem, que é o sistema antigo ter três avaliações divergentes do mesmo estado, a ponto de o envio manual cobrar por uma dívida cancelada.

Ao fim das 11 tasks: **7 rotas novas** (5 de cobrança, 2 de multa e juros), a superfície publicada em **82 rotas / 67 manipuladores**, a **mora por empresa** substituindo a configuração global do legado, a **ativação do contrato gerando as parcelas na mesma unidade de trabalho** — o que **fecha o débito D28 (F2/T7)** —, e o **oráculo da régua de cobrança capturado** antes que a janela feche.

---

## 3. Macro-Fases (alto nível)

As quatro primeiras vêm da **§11 do PRD** (Roadmap / Fases). A quinta é acréscimo deste plano: ela materializa o **item 9 da ordem sugerida na §21 do tech spec**, que não cabe em nenhuma das quatro do PRD.

- **Fase 1 – Oráculo da régua**
  - Objetivo: capturar do sistema antigo, em site efêmero, o comportamento executável da régua de cobrança **sem despachar mensagem a ninguém** — inclusive a divergência de estado entre o caminho automático e o manual. É a única coisa da fatia que deixa de ser possível se demorar.
  - Tasks: **T1**
- **Fase 2 – A cobrança e o estado**
  - Objetivo: o contrato de tipos, o substrato no banco com a view de fonte única, a porta de dados e as três rotas de lançamento e leitura da carteira.
  - Tasks: **T2, T3, T4, T5**
- **Fase 3 – Mora por empresa**
  - Objetivo: a política de multa e juros de cada imobiliária, e as duas transições que carimbam o que a mora valia no instante em que a cobrança foi liquidada.
  - Tasks: **T6, T7**
- **Fase 4 – Nascer da ativação**
  - Objetivo: as parcelas nascendo da ativação do contrato na mesma unidade de trabalho, e o cancelamento em cascata quando o contrato é cancelado.
  - Tasks: **T8, T9, T10**
- **Fase 5 – Superfície declarada**
  - Objetivo: auditar, por conteúdo e por dupla medição independente, que as sete rotas novas declaram exatamente a área devida e nenhuma chave de ação — e que, sem alcance, recusam sem alterar estado.
  - Tasks: **T11**

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Capturar o oráculo da régua de cobrança do sistema antigo, sem despachar mensagem | [T1](tasks/T1.md) | 1 | — | Não | A Fazer |
| T2 | Contrato de tipos da cobrança em `@sysloc/contracts` | [T2](tasks/T2.md) | 2 | — | Não | A Fazer |
| T3 | Schema e migrações da cobrança — tabelas isoladas, a view de fonte única e o contador da série | [T3](tasks/T3.md) | 2 | T2 | Não | A Fazer |
| T4 | Porta de dados da cobrança — leitura pela view, emissão da série e a prova da mora contra o golden | [T4](tasks/T4.md) | 2 | T2, T3 | Não | A Fazer |
| T5 | As três rotas de lançamento e leitura da carteira de cobranças | [T5](tasks/T5.md) | 2 | T2, T4 | Não | A Fazer |
| T6 | Configuração de mora por empresa — contrato, porta e as duas rotas de `/v1/multa-e-juros` | [T6](tasks/T6.md) | 3 | T3, T5 | Não | A Fazer |
| T7 | As duas transições da cobrança — acusar pagamento com carimbo e cancelar preservando o histórico | [T7](tasks/T7.md) | 3 | T5, T6 | Não | A Fazer |
| T8 | `derivarParcelasDoContrato` — a função pura das parcelas, provada contra o oráculo | [T8](tasks/T8.md) | 4 | T2 | Não | A Fazer |
| T9 | A ativação do contrato gera as parcelas na mesma unidade de trabalho — fecha o D28 | [T9](tasks/T9.md) | 4 | T4, T8 | Não | A Fazer |
| T10 | O cancelamento do contrato cancela as cobranças em cascata, na mesma unidade | [T10](tasks/T10.md) | 4 | T7, T9 | Não | A Fazer |
| T11 | Cobertura de autorização das sete rotas novas e as âncoras finais da superfície | [T11](tasks/T11.md) | 5 | T5, T6, T7 | Não | A Fazer |

### 4.1 Ordem de Execução (grafo)

```
T1  (independente — primeira por PRAZO, não por dependência)

T2 ──┬──► T3 ──► T4 ──► T5 ──► T6 ──► T7 ──┬──► T11
     │                                      │
     │                             T9 ──────┴──► T10
     └──► T8 ──► T9
                 ▲
     T4 ─────────┘
```

Topologia em uma linha: `T2 → T3 → T4 → T5 → T6 → T7 → {T10, T11} ; T2 → T8 → T9 → T10 ; T4 → T9`

### 4.2 Por que a coluna de paralelismo é toda `Não` — a derivação, não uma escolha

O flag foi **computado** pelo Invariante de Paralelismo (Regra 10d), não autorado. Nenhum par de tasks da **mesma fase** sobrevive às cinco condições:

| Fase | Par | Condição que falha |
|---|---|---|
| 1 | — | T1 é a única task da fase |
| 2 | T2 × T3 | T3 **depende** de T2 (mesma fase) — o invariante proíbe marcar `Sim` |
| 2 | T2 × T4, T3 × T4 | T4 depende das duas |
| 2 | T5 | depende de T2 e T4, ambas da mesma fase |
| 3 | T6 × T7 | T7 **depende** de T6 (mesma fase) |
| 4 | T8 × T9 | T9 depende de T8 |
| 4 | T8 × T10 | T10 é **descendente transitiva** de T8 (via T9) |
| 4 | T9 × T10 | T10 depende de T9 |
| 5 | — | T11 é a única task da fase |

**Alta contenção reforça o mesmo veredito**, e vale registrar porque ela sobreviveria a uma eventual mudança de fase: **T3 toca o diretório de migrações** (a ordem é estado compartilhado, mesmo com arquivos distintos); **T2 e T6 tocam `packages/contracts/src/index.ts`**; **T4, T6, T8, T9 e T10 tocam `packages/db/src/index.ts`**; **T5 e T6 tocam `apps/api/src/app.module.ts`**; e **T5, T6, T7 e T11 tocam `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`**.

> **T1 e T8 são as duas tasks genuinamente independentes desta fatia** — T1 não tem dependência alguma, e T8 depende apenas de T2. O executor pode batê-las junto com o que estiver pronto, porque os guards dele operam sobre **deps satisfeitas**, não sobre a fase. O flag permanece `Não` porque **falso-paralelo corrompe a ordem e falso-sequencial custa minutos** — e porque as duas tocam barrels compartilhados.

### 4.3 Três achados da derivação que mudaram a decomposição

1. **`0009` e `0010` não podem virar tasks separadas.** A guarda de cobertura de `packages/db/src/catalogo.ts` reprova toda tabela de negócio que exista sem `FORCE RLS` e sem política. Entregar só a migração gerada deixaria `catalogo.spec.ts` **vermelho ao fechar a task** — e caso que estava verde e ficou vermelho é regressão (P5). É o mesmo arranjo da T3 da fatia anterior, que trouxe `0007` e `0008` juntas.
2. **`packages/contracts/src/contrato.ts` só pode ser tocado em T9.** Afrouxar `efeitos.cobrancasGeradas` de `z.literal(false)` para `z.number()` antes de o serviço gerar as parcelas faria `contrato.service.ts` — que ainda escreve `false` — não compilar; e mudá-lo para `0` numa task e para `N` noutra custaria **duas** alterações de asserção no `contratos.e2e.spec.ts`. Uma alteração só, no commit que fecha o D28.
3. **A âncora de superfície sobe em três tasks, não numa.** O docblock de `ROTAS_PUBLICADAS_EM_PRODUCAO` acumula uma linha `SUT_IS_CORRECT_BECAUSE:` por task que publicou par — foi assim na fatia anterior (`73 → 74 → 75`). Aqui: **T5 leva 75 → 78, T6 leva 78 → 80, T7 leva 80 → 82** (manipuladores `60 → 63 → 65 → 67`), e **T11 confere** por dupla medição. Deixar a âncora para o fim faria a suíte reprovar ao fechar T5, T6 e T7.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|------------------|--------------------------|--------------------|--------|
| US-01 — Capturar a referência da régua antes do desligamento | §17 US-01 · captura com despachante substituído, fora da API | T1 | A Fazer |
| US-02 — Ativar contrato gera as parcelas do período | §6.3 RD-05, RD-18, RD-19, RD-20 · §5.1 fluxo B | T2, T3, T4, T8, T9 | A Fazer |
| US-03 — Estado da cobrança com significado único | §6.3 RD-04 · view `cobranca_derivada` · §3.3 (proibição em TypeScript) | T2, T3, T4, T5 | A Fazer |
| US-04 — Cobranças que não são aluguel, distinguíveis por natureza | §6.3 RD-03 · enum `natureza_cobranca` | T2, T5 | A Fazer |
| US-05 — Acusar pagamento e registrar o recebido | §6.3 RD-09, RD-15 · §5.1 fluxo D | T2, T7, T11 | A Fazer |
| US-06 — Cancelar lançamento errado e emitir substituta | §6.3 RD-12, RD-02 · §5.1 fluxos E e F | T4, T7, T11 | A Fazer |
| US-07 — Multa e juros da própria imobiliária | §6.3 RD-11, RD-21 · `negocio.configuracao_de_mora` sob RLS | T3, T6 | A Fazer |
| US-08 — Mora calculada pelo sistema | §6.3 RD-07, RD-08, RD-16 · expressões em `numeric` | T3, T4 | A Fazer |
| US-09 — Mudar a multa não altera o que já foi pago | §6.3 RD-09, RD-10 · o carimbo com a configuração vigente | T6, T7 | A Fazer |
| US-10 — Cancelar contrato cancela as cobranças canceláveis | §6.3 RD-13 · cascata na mesma unidade | T10 | A Fazer |

> **Nenhuma US órfã.** A US com mais tasks é a **US-02, com cinco** — acima do teto operacional de três, e a razão é estrutural, não de decomposição frouxa: gerar parcelas na ativação atravessa **contrato de tipos → schema e série → porta de dados → função pura de datas → serviço de ativação**, e cada uma dessas camadas é um artefato arquitetural completo com prova própria. Fundi-las produziria uma task de diff enorme sobre `contrato.service.ts`, que é exatamente o risco de média probabilidade e alto impacto que a §20 do tech spec nomeia. A US-03 aparece em quatro pela mesma razão (a fonte única atravessa contrato, banco, porta e borda).
>
> **T11 não tem US própria** e aparece sob US-05 e US-06: ela prova o **CA-17**, que a §12 do PRD atribui às duas. É trabalho de invariante transversal, não de escopo novo.

---

## 6. Dependências Gerais

**Externas — e uma delas expira:**

- **T1 depende do `/opt/frappe` estar de pé e responsivo.** É a única dependência externa da fatia, e ela **expira na fase de virada**. Regra não capturada agora vira risco que só aparece na troca, quando não há mais oráculo a consultar.
- **T1 exige `sudo` e o site efêmero de pé** — nenhum subagente a executa. A execução é conduzida junto ao operador; o gate audita a saída preservada e reporta `executou_testes: false`, o que reflete o papel dele, **não** suíte pulada.
- **Nada mais na fatia depende de T1.** Ela é a primeira por **prazo**, não por dependência: se travar por indisponibilidade do sistema antigo, T2 em diante seguem sem bloqueio.

**Internas — as que mais custam se invertidas:**

- **T3 → T2** (o schema do banco deriva os enums de `@sysloc/contracts`), pela direção que a ADR-0016 fixa e que mantém o pacote de contratos folha.
- **T9 → T8** (a ativação **chama** a função pura; ela não recalcula nada).
- **T7 → T6** (os CT-518 e CT-529 alteram a política pela rota `PUT /v1/multa-e-juros`, que nasce em T6).
- **T10 → T9** (a cascata alcança as cobranças que a ativação gerou; e o CT-521 precisa das três operações destrutivas existindo).
- **T11 → T5, T6, T7** (a âncora de 82/67 só bate quando as sete rotas existem).

**Artefatos já disponíveis, que não são recapturados:**

- `golden/contrato-ativacao.json` (bloco `cobrancas`) e `golden/calcular-mora.json` foram capturados nas fatias anteriores e são **consumidos do disco** por T8 e T4.
- O catálogo fechado de permissões já tem `TELA:financeiro` e `TELA:multa_e_juros` — **nenhuma chave nasce nesta fatia**, e `packages/auth/src/catalogo-de-permissoes.ts` não é tocado por task alguma.

**Nada é enfileirado nesta fatia** — o débito **D32 · F0/T6** (`apps/worker/src/fila.ts`) **não dispara**. O gatilho dele é a fatia 2, quando a régua for portada.

---

## 7. Critérios de Conclusão da Feature

- [ ] As 11 tasks concluídas e aprovadas nos dois gates
- [ ] `pnpm build`, `pnpm lint` e `pnpm test` verdes, com a contagem comparada contra a baseline de **665 casos** — crescimento monotônico, nenhum pacote encolhendo em nenhuma rodada; **queda inexplicada é regressão de prova**
- [ ] Os 17 critérios de aceite do PRD com ao menos um caso rastreado — **45 CTs distribuídos, cada um em exatamente 1 task**
- [ ] Superfície publicada em **82 rotas / 67 manipuladores**, `semDeclaracao` vazio, contagens **refeitas por varredura** e concordantes nas duas medições independentes
- [ ] `verificarCoberturaDeIsolamento` sem exceções, com as duas tabelas novas **e a view** em `tabelasExaminadas`
- [ ] `verificar-golden.sh` afirma **10** artefatos e os CT-501/CT-503 passam; os seis anteriores inalterados
- [ ] A captura da régua declara no `PROCEDENCIA.md` **qual nível da ordem de queda foi alcançado**, e o contador de despacho real vale `0`
- [ ] **O débito D28 (F2/T7) está fechado**: o literal afrouxado, a ativação gerando as parcelas, o marcador removido do código **e** a linha removida do bloco do `CLAUDE.md`, no mesmo commit
- [ ] O marcador do **D36 (F2/T8) permanece**, reafirmado e não removido
- [ ] Os três marcadores `DECISÃO FECHADA` exigidos pela §21 do tech spec estão no código: largura 7 (T2), leitura só pela view (T4) e `security_invoker` (T3) — mais o quarto, da conciliação bancária intocada (T7)
- [ ] O marcador `DÉBITO COM GATILHO` das constantes monetárias registrado com os cinco campos e o par `Dnn · F3/T2`, **com a linha correspondente no `CLAUDE.md`**
- [ ] Nenhuma asserção de igualdade de corpo trocada por asserção de presença nas suítes das fatias anteriores — varredura mecânica do diff
- [ ] As duas alterações de asserção de fatia fechada (`EFEITOS_ESPERADOS` e CT-429 → CT-537) carregam `SUT_IS_CORRECT_BECAUSE:`, e a contagem total **não cai**

---

## 8. Riscos & Mitigações

| Risco | Task | Mitigação |
|---|---|---|
| **A janela do oráculo da régua fecha** — o `/opt/frappe` só existe até a virada, e 837 LOC seriam portadas sem referência na fatia 2 | T1 | É a **primeira** task, por prazo; ordem de queda fixada **antes** de começar (substituir despachante → servidor local que descarta → piso das frentes puras), com o nível alcançado declarado no `PROCEDENCIA.md` |
| **`security_invoker` omitido ou perdido** — a view roda com os direitos da dona e devolve cobrança de outra empresa, furando a ADR-0008 por dentro do objeto que a ADR-0023 autorizou | T3 | `0010` é autoral e nunca regerado; `DECISÃO FECHADA` no ponto; CT-523 com as **duas variantes da view** e prova de falsificação; e a guarda de `catalogo.ts`, que **já cobre a espécie VIEW desde a F2** e reprova sem precisar de edição |
| **Derivação de estado reaparecer em TypeScript** — reabre o defeito de origem (três avaliações divergentes) | T5, T7 | Asserção estática com falsificação (CT-510); `DECISÃO FECHADA` no ponto da porta; §3.3 do tech spec registra a proibição |
| **Saturação implementada como não-iterativa** (RD-19) — passa em todo cenário com dia ≤ 28 e diverge do legado só nos iniciados em 29–31 | T8 | Os dois cenários de `2027-01-31` do golden são o discriminador; o terceiro período (`28/03`) é asserido nominalmente; **controle não-iterativo escrito dentro do teste** |
| **Regressão em `contrato.service.ts`** — arquivo com marcadores e literais fixados, e a fatia precisa afrouxar um `z.literal` | T9, T10 | Protocolo Antirregressão com força máxima; as três linhas do P3 obrigatórias; o marcador do D28 sai **no mesmo commit**; o do D36 **permanece**; baseline de 665 antes e depois |
| **Perda de centavo em alguma composição** (RN-16) — os juros proporcionais a dias são onde o arredondamento discrimina | T3, T4 | Aritmética inteiramente em `numeric`; igualdade **centavo a centavo** contra o golden, jamais tolerância; `1234.56` com 5 e 17 dias, mais o **mutante que arredonda antes da divisão por 30** |
| **`0009` sozinha deixando a guarda de cobertura vermelha** | T3 | As duas migrações na **mesma task** — ver §4.3, item 1 |
| **Âncora de superfície errada ou derivada de si mesma** | T5, T6, T7, T11 | Contagem **refeita do zero por varredura** em cada task que publica rota, nunca derivada; conferência final por **duas medições independentes** em T11; e o docblock que registra por que a âncora é 75 e não 77 |
| **T7 é a task mais densa da fatia** (nove casos, duas transições) | T7 | A densidade vem da **simetria** — as duas transições compartilham guarda de estado, controlador, serviço e forma de recusa. É o caso que a Regra 9 admite nominalmente; separá-las criaria um segundo controlador para o mesmo recurso |
| **Fuso do banco divergir** e a virada do dia acontecer em hora errada | T3, T4 | `data_corrente_da_operacao()` fixa a zona **no objeto**; caso de fronteira montado **pelo dado**, com a função afirmada sob dois fusos de sessão |
| **Mutante avaliado com `vitest run` avulso** conclui o oposto do verdadeiro | T1, T2, T4, T5, T8 | Mutante **sempre** pelo script do pacote (`pnpm --filter @sysloc/<pacote> test`) — os pacotes resolvem `"."` para `dist/` |
| **Colisão de identificador `Dnn`** ao registrar débitos desta fatia | todas | A sequência corre dentro da §2 do `run-report.md` **desta** fatia (§3-B da `nao-regressao.md`); o par `Dnn · F3/Tn` é o identificador |

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas — 11 arquivos em `tasks/`
- [x] Dependências validadas — DAG acíclico, conferido nos dois sentidos
- [x] `Símbolos públicos criados` / `consumidos de outras tasks` preenchidos em cada `TN.md` (Regra 10a)
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + contenção (Regra 10d), com a derivação registrada em §4.2
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — 10/10 cobertas, nenhuma órfã
- [x] Seção 6 preenchida em todas as tasks, com 6.0, 6.5 e 6.6
- [x] `_run/test-cases.json` atualizado com `task_id` por caso — **45 casos**, cada CT em exatamente 1 task
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Comentários internos de template removidos dos arquivos finais
- [x] Pronto para execução

---

## 10. Notas de Geração

**Origem dos casos de teste.** Dos 45 CTs, **39 vieram de redistribuição via JSON** (`_run/test-cases.json`), sem reinvocar o gerador: o artefato existia com os 39 casos (37 do gerador mais CT-538/CT-539, acrescentados pelo challenge de 2026-08-09), todos com `criterios_aceitacao_validados` preenchidos, e o match componente↔task foi feito por `existing_suite` + `camada`. **Seis nasceram de uma única invocação de fallback** (`CT-540` a `CT-545`), para a **T2** — a única task sem CT correspondente entre os 39, e um vão real: as seis regras de entrada de `esquemaDeCobrancaNova` declaradas na §6.1 do tech spec não tinham caso na camada de contrato puro. **Um subagente de QA disparado**, e o `_run/qa_context.md` foi extraído para alimentá-lo.

**IDs de CT são globais da feature**, começando em `CT-501` (a fatia anterior fechou em `CT-434`) e indo a `CT-545` com os seis do fallback, renumerados a partir de `CT-539` para preservar a unicidade.

**Duas realocações contra o que o JSON sugeria**, ambas registradas em `ajustes_do_arquiteto`:

- **CT-511** não ficou na task das rotas de leitura: ele monta cobranças **PAGA e CANCELADA pelas rotas**, que só existem em T7.
- **CT-521** não ficou lá tampouco: ele executa as **três** operações destrutivas em sequência, e a terceira — o cancelamento em cascata — nasce em T10.

**`gates: [qa, tech_review]` em todas as 11 tasks**, e não é conservadorismo preguiçoso: cada uma toca ao menos uma categoria crítica — `db_migrations` e `security` (T3), `api_contracts` (T2, T5, T6, T9), `auth`/`security` (T5, T6, T7, T11), `service_complexo` (T4, T7, T10), `padrao_novo` (T1, T8). **`model: opus` em todas** por decisão do projeto registrada no `CLAUDE.md`, que vence a heurística do framework.

**`risk: high` em três tasks** — T3 (migrações, RLS forçada, `SECURITY DEFINER`), T9 (mudança de contrato publicado sobre arquivo com marcadores, fechando o D28) e T11 (auditoria da fronteira de autorização inteira da fatia).

**Uma regra de decomposição foi aplicada ao contrário, e vale registrar**: T7 **não cria arquivo de produção novo**. As duas transições entram nos arquivos que T4 e T5 criaram, porque separá-las produziria um segundo controlador para o mesmo recurso — a Regra 3 (proximidade de arquivo) lida na direção que ela de fato aponta.
