# TASK PLAN – Plano de Execução das Tasks

## 1. Identificação
- **Feature/Projeto**: Contratos de locação — montagem, ativação e cancelamento
- **Responsável (Tech Lead)**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-08
- **Status**: Concluído
- **TECH_SPEC**: `docs/specs/features/contratos-de-locacao/v1/tech_spec.md`
- **PRD**: `docs/prds/features/contratos-de-locacao/v1/prd.md`
- **Variante**: `backend` — sem `design.md`, por decisão registrada no `CLAUDE.md` (este repositório não produz interface)

---

## 2. Objetivo do Task Plan

Entregar o **contrato de locação** como entidade de primeira classe do backend novo: duas tabelas isoladas em `negocio`, a primeira **série declarada** do produto, o primeiro **ciclo de vida governado**, e o núcleo local das regras de ativação e cancelamento portado do sistema antigo e **provado contra golden capturado**.

Ao fim das 10 tasks: **9 rotas novas** (8 de contrato, 1 de imóvel), a superfície publicada em **77 rotas / 60 manipuladores**, a dupla locação **irrepresentável**, e a fase de domínio de locação fechada.

---

## 3. Macro-Fases (alto nível)

As três fases vêm da **§11 do PRD** (Roadmap / Fases), que as declara como ordem de construção interna, não como entregas separadas.

- **Fase 1 – Oráculo**
  - Objetivo: capturar do sistema antigo, em site efêmero, o comportamento **inteiro** das duas regras portadas — inclusive as partes que só a F3 implementa. A janela fecha na virada e não reabre.
  - Tasks: **T1**
- **Fase 2 – Contrato e fiadores**
  - Objetivo: o contrato de tipos, o schema com as duas tabelas e o mecanismo da série, as derivações puras, a porta de dados e a superfície de cadastro — montar, consultar, alterar e retirar de circulação.
  - Tasks: **T2, T3, T4, T5, T6**
- **Fase 3 – Ciclo de vida**
  - Objetivo: as duas transições governadas, a apresentação do contrato vigente nas consultas de imóvel, e o fechamento do furo de `statusLocacao` que esta fatia torna observável.
  - Tasks: **T7, T8, T9, T10**

---

## 4. Lista de Tasks (visão macro)

| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? (derivado) | Status |
|----|--------------|---------|------|--------------|------------------------------------|--------|
| T1 | Capturar o golden de ativação e cancelamento do sistema antigo | [T1](tasks/T1.md) | 1 | — | Não | Concluído |
| T2 | Contrato de tipos do contrato de locação em `@sysloc/contracts` | [T2](tasks/T2.md) | 2 | — | Não | Concluído |
| T3 | Schema e migrações do contrato — tabelas isoladas, vigência única e o contador da série | [T3](tasks/T3.md) | 2 | T2 | Não | Concluído |
| T4 | Derivações puras do contrato — término da locação e valor total, provados contra o oráculo | [T4](tasks/T4.md) | 2 | T1 | Não | Concluído |
| T5 | Porta de dados do contrato — emissão da série, escritas do ciclo de vida e traduções de unicidade | [T5](tasks/T5.md) | 2 | T2, T3 | Não | Concluído |
| T6 | Superfície de cadastro do contrato — montar, consultar, alterar e retirar de circulação | [T6](tasks/T6.md) | 2 | T2, T5 | Não | Concluído |
| T7 | Ativação do contrato — ato governado, derivações e efeito no imóvel | [T7](tasks/T7.md) | 3 | T4, T6 | Não | Concluído |
| T8 | Cancelamento do contrato — ato governado, liberação do imóvel e o histórico que permanece | [T8](tasks/T8.md) | 3 | T7 | Não | Concluído |
| T9 | Contrato vigente nas consultas de imóvel — leitura em lote, custo independente de N | [T9](tasks/T9.md) | 3 | T7 | Não | Concluído |
| T10 | A situação de locação sai do corpo do `PUT` de imóvel e ganha rota própria | [T10](tasks/T10.md) | 3 | T9 | Não | Concluído |

### 4.1 Ordem de Execução (grafo)

```
T1 ─────────────────────────────► T4 ──┐
                                        ├──► T7 ──┬──► T8
T2 ──┬──► T3 ──┬──► T5 ──► T6 ─────────┘         │
     │         │                                  └──► T9 ──► T10
     └─────────┘
```

Topologia em uma linha: `T2 → T3 → T5 → T6 → T7 → {T8, T9} ; T9 → T10 ; T1 → T4 → T7`

### 4.2 Por que a coluna de paralelismo é toda `Não` — a derivação, não uma escolha

O flag foi **computado** pelo Invariante de Paralelismo (Regra 10d), não autorado. Nenhum par de tasks da mesma fase sobrevive às cinco condições, e as razões são específicas:

| Fase | Par | Condição que falha |
|---|---|---|
| 1 | — | T1 é a única task da fase |
| 2 | T2 × T3 | T3 **depende** de T2 (mesma fase) — o invariante proíbe marcar `Sim` |
| 2 | T2 × T4 | ambas tocam **barrel** (`packages/contracts/src/index.ts` e `packages/db/src/index.ts`) — alta contenção |
| 2 | T3 × T4 | T3 toca o **diretório de migrações** (ordem é estado compartilhado); T4 toca barrel — alta contenção nos dois |
| 2 | T5, T6 | dependem de tasks da mesma fase |
| 3 | T8 × T9 | **pairwise independentes** — DAG disjunto, símbolos disjuntos, paths disjuntos. Mas **ambas dependem de T7, que é da mesma fase**, e o invariante é literal: *"uma task que depende de outra da mesma fase nunca sai `Sim`"* |
| 3 | T10 | depende de T9 (mesma fase) |

> **T8 e T9 são o único par genuinamente paralelizável desta fatia** — assim que T7 fechar, elas não colidem em nada. O executor pode batê-las no mesmo lote quando ambas estiverem `prontas`, porque os guards dele operam sobre deps **satisfeitas**, não sobre a fase. O flag aqui permanece `Não` porque **falso-paralelo corrompe a ordem e falso-sequencial custa minutos**.

### 4.3 Um achado da derivação que mudou a ordem

`packages/db/src/esquema/negocio.ts` importa `ESTADOS_DO_CONTRATO` de `@sysloc/contracts` — a direção que a ADR-0016 fixa e que mantém o pacote de contratos **folha**. Logo **o schema consome um símbolo que o contrato de tipos cria**, e T3 depende de T2, não o inverso. A numeração reflete isso.

---

## 5. Rastreabilidade: User Stories → Tasks

| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |
|------------------|--------------------------|--------------------|--------|
| US-01 — Montar contrato como rascunho, num único envio | §7.2 `negocio.contrato` · §4.2 `esquemaDeContratoNovo` · §5.1 | T2, T3, T5, T6 | A Fazer |
| US-02 — Corrigir o rascunho antes de fazê-lo valer | §6.3 RD-05 · §4.1.1 corpo completo no `PUT` | T5, T6 | A Fazer |
| US-03 — Indicar zero ou mais fiadores | §7.2 `negocio.contrato_fiador` (vínculo puro) · §6.3 RD-06 | T3, T5, T6 | A Fazer |
| US-04 — Código legível próprio por contrato | §7.4 mecanismo da série · §4.2 formato do código | T2, T3, T5, T6 | A Fazer |
| US-05 — Fazer valer e marcar o imóvel como locado | §5.1 fluxo de ativação · §6.3 RD-08, RD-10, RD-11 | T1, T4, T7, T10 | A Fazer |
| US-06 — A ativação declara o que fez e o que não fez | §4.2 `esquemaDaAtivacaoDeContrato` (`z.literal(false)`) | T2, T7 | A Fazer |
| US-07 — Impedir dois contratos vigentes sobre o mesmo imóvel | §7.2 `contrato_imovel_vigente_uidx` · §10.1 | T3, T5, T7 | A Fazer |
| US-08 — Cancelar e devolver o imóvel à disponibilidade | §5.1 fluxo de cancelamento · §6.3 RD-11 | T5, T8, T10 | A Fazer |
| US-09 — Só cadastros em circulação ao montar e ao ativar | §6.3 RD-14 · §10.1 | T6, T7 | A Fazer |
| US-10 — Consultar a carteira de contratos | §4.1 `GET /v1/contratos` · §12.2 leitura em lote | T5, T6, T8 | A Fazer |
| US-11 — Ver, no imóvel, qual contrato o ocupa | §4.2 `esquemaDoImovel.contratoVigente` · §12.2 | T9, T10 | A Fazer |
| US-12 — Retirar contrato de circulação | §6.3 RD-15 · §7.4 idempotência | T5, T6, T8 | A Fazer |
| US-13 — Concessões distintas para montar, ativar e cancelar | §11.2 declaração de exigência · ADR-0018 | T6, T7, T8 | A Fazer |
| US-14 — Isolamento entre empresas | §7.2 FK compostas e `unique(id, empresa_id)` · §7.3 política com `FORCE` | T3, T6, T8 | A Fazer |
| US-15 — Estado decidido pelo sistema, fonte única | §7.2 enum derivado do contrato · §6.3 RD-03 | T2, T3, T6 | A Fazer |
| US-16 — Data de fim e valor total calculados pelo sistema | §6.2 aritmética do término e do valor total | T1, T4, T7 | A Fazer |
| **— (sem US)** | §4.1.2 a situação de locação sai do `PUT` e ganha rota própria | T10 | A Fazer |

> **A última linha não tem US, e isso está declarado de propósito.** T10 não é funcionalidade pedida: é a correção de um furo que a fatia anterior deixou e que **esta** fatia torna observável. É trabalho de invariante, não de escopo novo — os critérios que ela protege são o CA-05 e o CA-09.

**Nenhuma US órfã.** Cada uma das 16 tem ao menos uma task; a US com mais tasks (US-04, com quatro) está dentro do teto operacional, porque a série atravessa contrato, schema, porta e borda por construção.

---

## 6. Dependências Gerais

**Externas — do caminho crítico:**

- **T1 depende do `/opt/frappe` estar de pé e responsivo.** É a única dependência externa da fatia, e ela **expira na fase de virada**. Regra não capturada agora vira risco que só aparece na troca, quando não há mais oráculo a consultar.
- **T1 e o `verificar-captura.sh` exigem `sudo` e o site efêmero de pé** — nenhum subagente os executa. A execução é conduzida junto ao operador; o gate audita a saída preservada e reporta `executou_testes: false`, o que reflete o papel dele, **não** suíte pulada.
- **T4 depende do artefato de T1**, não só da task: sem `golden/contrato-ativacao.json` no disco, CT-401 e CT-402 não têm o que comparar.

**Internas — as que mais custam se invertidas:**

- **T3 → T2** (schema depende do contrato de tipos), pela direção que a ADR-0016 fixa. Ver §4.3.
- **T7 → T4** (a ativação chama as funções puras; ela **não** recalcula nada).
- **T10 → T9** (a recusa da rota de situação usa `lerContratosVigentesDeImoveis`; sem ela, a rota nova reabriria o mesmo furo por outra porta).

**Pré-requisitos já satisfeitos:** a fatia `cadastro-de-imoveis-e-pessoas` está concluída, e com ela as seis entidades que o contrato aponta, o catálogo fechado com as três ações desta fatia, e o molde inteiro de porta, controlador e suíte.

**Nada é enfileirado nesta fatia** — o débito **D32 · F0/T6** (`apps/worker/src/fila.ts`) **não dispara**.

---

## 7. Critérios de Conclusão da Feature

- [x] As 10 tasks concluídas e aprovadas nos dois gates
- [x] `pnpm build`, `pnpm lint` e `pnpm test` verdes, com a contagem de casos comparada contra a baseline (541) — **664 casos**, crescimento monotônico, nenhum pacote encolheu em nenhuma rodada — **queda inexplicada é regressão de prova**
- [x] Os 20 critérios de aceite do PRD com ao menos um caso rastreado — **34 CTs distribuídos, cada um em exatamente 1 task**
- [~] `verificar-golden.sh` afirma **9** artefatos e o CT-433 passa; o script sai `1` por **CT-013 pré-existente e alheio** (ver **D4**); os seis anteriores inalterados
- [x] `verificarCoberturaDeIsolamento` sem exceções, com as duas tabelas novas em `tabelasExaminadas`
- [~] Superfície publicada em **75 rotas / 60 manipuladores** — os manipuladores batem exatamente; o total medido é **75**, não 77 (ver **D45**), `semDeclaracao` vazio, contagens **refeitas por varredura**
- [x] Nenhuma resposta traz `statusLocacao: 'DISPONIVEL'` junto de `contratoVigente` preenchido
- [x] Os dois débitos com gatilho registrados (mais um terceiro, o **D43**, da ADR-0019) (pré-condição de PDF, em T8; geração de cobranças, em T7), com marcador no código **e** linha no índice do `CLAUDE.md` — as duas pontas conferidas
- [x] Os marcadores `DECISÃO FECHADA` presentes: largura de 5 dígitos (T2) e a saída de `statusLocacao` do `PUT` (T10)
- [x] Nenhuma asserção de igualdade de corpo trocada por asserção de presença nas suítes da fatia anterior — **varredura mecânica do diff, confirmada pelos dois gates**

---

## 8. Riscos & Mitigações

| Risco | Task | Mitigação |
|---|---|---|
| **A janela do oráculo fecha** — o `/opt/frappe` só existe até a virada | T1 | É a **primeira** task da fatia, e captura as regras **inteiras**; o excedente é insumo arquivado, não backlog |
| **A extensão do roteiro quebra o golden existente** — os artefatos são de fatia fechada | T1 | Acréscimo puro sob o Protocolo Antirregressão; bijeção manifesto ↔ golden preservada; baseline dos seis comparada antes e depois |
| **A criação lazy do contador reusa o número `00001`** se criação e consumo ficarem na mesma transação | T5, T6 | As **duas unidades sequenciais**; o CT-404 prova o furo pelo rascunho abortado seguido de criação nova |
| **"Simplificar" o índice parcial para restrição** remove a condição e impede recontratar após cancelamento | T3 | O PostgreSQL não admite restrição parcial — escrito no comentário; caso dedicado ao fluxo cancelar → recontratar |
| **Unificar a assimetria de `statusLocacao`** desfaz decisão fechada da fatia anterior (R3) | T5, T7, T10 | Porta **estreita** própria; a porta de alteração continua em `SituacaoInformavel`; marcador `DECISÃO FECHADA` em T10 |
| **`contratoVigente` quebra asserções de corpo inteiro** em quatro suítes da fatia 1 | T9 | Crescimento de esquema, não afrouxamento: `SUT_IS_CORRECT_BECAUSE` em cada alteração, e **nenhuma igualdade trocada por presença** |
| **Reproduzir literalmente a máquina de estados do sistema antigo** contradiria o CA-10 | T7 | §6.3 declara o que o oráculo governa; comentário no ponto do código impede a "correção" contra o golden |
| **`SECURITY DEFINER` como escalada de privilégio** | T3 | `SET search_path`; **nenhuma função aceita empresa por parâmetro**; `REVOKE ALL FROM PUBLIC`; CT-431 prova o menor privilégio |
| **A ordem trocada da conjunção de exigências** é defeito silencioso — nada falha, só o `exigido` fica errado | T6, T7, T8 | Casos que afirmam `detalhes.exigido` nos dois sentidos; CT-427 audita por estrutura, com mutante |
| **Datas deslocadas por fuso** invalidariam a comparação com o oráculo | T4, T5 | `to_char(…, 'YYYY-MM-DD')` na projeção; funções puras sobre `Date.UTC`; CT-432 com três fusos |
| **Mutante avaliado com `vitest run` avulso** conclui o oposto do verdadeiro | todas | Mutante **sempre** pelo script do pacote — os quatro pacotes resolvem `"."` para `dist/` |

---

## 9. Checklist Final
- [x] Task Plan completo
- [x] Tasks mapeadas — 10 arquivos em `tasks/`
- [x] Dependências validadas — DAG acíclico, conferido nos dois sentidos
- [x] `Símbolos públicos criados` / `consumidos de outras tasks` preenchidos em cada `TN.md` (Regra 10a)
- [x] Flag `Pode Rodar em Paralelo?` **derivado** do DAG + símbolos + contenção (Regra 10d), com a derivação registrada em §4.2
- [x] Invariante satisfeito: nenhuma task `Sim` depende de outra da mesma fase
- [x] Rastreabilidade User Stories → Tasks preenchida — 16/16 cobertas, nenhuma órfã
- [x] Seção 6 preenchida em todas as tasks, com 6.0, 6.5 e 6.6
- [x] `_run/test-cases.json` atualizado com `task_id` por caso — 34 casos, cada CT em exatamente 1 task
- [x] `model`, `risk`, `gates` preenchidos no frontmatter de cada task
- [x] Regras de Decomposição 1-10 aplicadas
- [x] Comentários internos de template removidos dos arquivos finais
- [x] Pronto para execução

---

## 10. Notas de Geração

**Origem dos casos de teste.** Os 34 CTs vieram de **redistribuição via JSON** (`_run/test-cases.json`), sem reinvocar o `agent-spec-qa-test-generator`: o artefato existia com 33 casos, todos com `criterios_aceitacao_validados` preenchidos, e o match componente↔task foi feito por `existing_suite` + `camada`. O CT-434 nasceu na sessão de challenge e foi **anexado** ao JSON durante a distribuição. **Zero subagentes de QA disparados** — e, por consequência, o `_run/qa_context.md` não foi extraído, já que ele existe para alimentar subagentes que não houve.

**IDs de CT são globais da feature**, começando em `CT-401` para não colidir com os até `CT-355` já em uso no repositório.

**`gates: [qa, tech_review]` em todas as 10 tasks**, e não é conservadorismo preguiçoso: cada uma toca ao menos uma categoria crítica — `db_migrations` e `security` (T3, T5), `api_contracts` (T2, T6, T9, T10), `auth` (T6, T7, T8), `padrao_novo` (T1, T4). **`model: opus` em todas** por decisão do projeto registrada no `CLAUDE.md`, que vence a heurística do framework.
