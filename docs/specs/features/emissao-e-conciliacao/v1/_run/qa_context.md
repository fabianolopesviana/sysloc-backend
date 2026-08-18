# QA Context — `emissao-e-conciliacao` / v1

> Extrato condensado do `tech_spec.md` (1.659 linhas) para consumo por subagente de QA, conforme o
> Passo 0 de `agent-spec-sdd-generate-task-plan/references/qa-delegation-tasks.md`.
> **Variante**: `backend` · **Gerado em**: 2026-08-16.
>
> ⚠️ Nesta feature os casos **não foram gerados por invocação nova**: o `_run/test-cases.json` já
> trazia os 37 casos lossless produzidos na fase de tech spec, e o task plan fez **redistribuição via
> JSON**. Este arquivo existe para a eventual invocação de fallback e para auditoria. O único caso
> autorado fora daquele JSON é o **CT-948** (borda da tarefa de conferência), acréscimo declarado por
> decisão do usuário em 2026-08-16 — total **38**, faixa `CT-911`…`CT-948`.

---

## 1. Mapa CA → CT

| CA | CT |
|---|---|
| CA-01 | CT-911, CT-944 |
| CA-02 | CT-912, CT-913 |
| CA-03 | CT-914, CT-944 |
| CA-04 | CT-915, CT-916 |
| CA-05 | CT-917 |
| CA-06 | CT-918 |
| CA-07 | CT-919, CT-945 |
| CA-08 | CT-920, CT-947 |
| CA-09 | CT-921, CT-945 |
| CA-10 | CT-922 |
| CA-11 | CT-923 |
| CA-12 | CT-924 |
| CA-13 | CT-925, CT-938, CT-939 |
| CA-14 | CT-926, CT-940, CT-946 |
| CA-15 | CT-927, CT-928, CT-941, CT-942, **CT-948** |
| CA-16 | CT-929 |
| CA-17 | CT-930 |
| CA-18 | CT-931 |
| CA-19 | CT-919, CT-922, CT-932 |
| CA-20 | CT-930, CT-933, CT-934, CT-935, CT-936, CT-937, CT-939, CT-943 |

---

## 2. Critérios de aceitação (uma linha cada)

- **CA-01** — o lote alcança só as cobranças em aberto da competência, sem boleto; nenhuma intrusa.
- **CA-02** — prestação de contas nomeando cada cobrança e a razão de cada falha.
- **CA-03** — falha da empresa interrompe o lote no ponto; o já emitido permanece.
- **CA-04** — reexecutar tenta só quem ainda não tem boleto; ninguém fica com dois pagáveis.
- **CA-05** — a reemissão revoga o boleto anterior junto ao provedor **antes** de emitir o novo.
- **CA-06** — revogação aceita + emissão falha ⇒ sem boleto, declarado, cobrança em aberto.
- **CA-07** — o boleto é entregue, e a cobrança publica linha digitável e código de barras.
- **CA-08** — arquivo ausente é rebuscado do provedor, sem quem pediu perceber diferença.
- **CA-09** — boleto nunca emitido é recusa nomeada; **jamais** documento em branco.
- **CA-10** — liquidação com data e valor do provedor, e mora derivada da política vigente.
- **CA-11** — valor divergente **não impede** a baixa; a divergência fica registrada.
- **CA-12** — o estorno devolve a cobrança ao estado **derivado** conforme o vencimento.
- **CA-13** — o histórico publica na ordem em que ocorreu, com data e desfecho.
- **CA-14** — cobrança de outra empresa responde como inexistente.
- **CA-15** — a conferência alcança só a empresa de quem disparou; disparo concorrente não duplica.
- **CA-16** — o conjunto da conferência é exato: em aberto com boleto + paga há ≤ 30 dias com boleto.
- **CA-17** — boleto revogado pelo provedor **não** cancela a cobrança.
- **CA-18** — emitir de novo após a revogação ocorre como a primeira vez.
- **CA-19** — os seis campos deixam de nascer órfãos; cinco deles são publicados.
- **CA-20** — nenhum termo, código ou desfecho do provedor vira regra ou estado do produto.

---

## 3. Componentes (nome · camada · responsabilidade)

| Componente | Camada | Responsabilidade |
|---|---|---|
| `AdaptadorCobrancaBancaria` (porta) | Domínio | as **quatro** operações contra o provedor; nenhum vocabulário dele a atravessa |
| `modelo-canonico.ts` | Domínio | `PedidoDeEmissao`, `BoletoEmitido`, `ConsultaDeSituacao`, `SituacaoConsultada`, `DesfechoDaOperacao<T>`, `ClasseDaFalha` |
| `executarEmissaoEmLote` | Domínio | percorre em sequência; distingue falha da cobrança de falha da empresa (RN-02) |
| `reemitirBoleto` | Domínio | revogar → sondar → emitir, num ato só; nunca dois boletos pagáveis |
| `conferirCobrancas` | Domínio | aplica o desfecho consultado e devolve os efeitos |
| `adaptador-sicoob.ts` | Infraestrutura | satisfaz a porta; traduz o dialeto; credencial em cache interno (300 s) |
| `guarda-de-boletos.ts` | Infraestrutura | grava/lê/apaga bytes sob diretório-base conferido; a coluna guarda **caminho** |
| `BoletoService` | Aplicação | emissão unitária/reemissão, entrega do boleto e histórico — em linha |
| `EmissaoEmLoteService` / `ConferenciaBancariaService` | Aplicação | abrem o registro, recusam o concorrente, enfileiram |
| `CobrancaController` (+4) / `CobrancaBancariaController` (+3) | Apresentação | as sete rotas |
| `packages/db/src/{evento-bancario,emissao-em-lote,conferencia-bancaria,boleto-da-cobranca}.ts` | Dados | toda instrução SQL |
| `apps/worker/src/tarefas/{emissao-em-lote,conferencia-bancaria}.ts` | Borda de tarefa | o contexto de tenant nasce da carga (ADR-0024) |

---

## 4. Fluxos técnicos críticos

1. **Emissão em lote** — `POST /emissoes` abre o lote (índice único parcial recusa o concorrente no banco) → **commit** → enfileira → o worker recusa carga inválida antes do contexto → unidade 1 lê certificado e conjunto → percurso em sequência, **uma unidade de trabalho por cobrança** → item + evento por cobrança → `concluirLote` ou `interromperLote`.
2. **Liquidação pela conferência** — `POST /conferencias` (200 com `iniciadaAgora: false` se já houver uma em curso) → predicado único com janela de 30 dias contra `data_corrente_da_operacao()` → `consultarSituacao` por cobrança → `acusarPagamentoDeCobranca` **reusada sem alteração** + `data_credito`/`valor_creditado` + evento.
3. **Reemissão** — `solicitarRevogacaoDeBoleto` → sondagem com limite nomeado (espera **injetada pela assinatura**) → `emitir`. Falha após confirmação ⇒ sem boleto, declarado.
4. **Entrega do boleto** — arquivo presente ⇒ bytes; ausente ⇒ `consultarSituacao({ incluirDocumento: true })` **fora** da unidade de trabalho, regrava e entrega; nunca emitido ⇒ `404` com envelope JSON e **sem** `%PDF-`.

---

## 5. Estratégia de testes (condensada — 38 casos)

- **Padrão**: Vitest 4.1.10 · `embedded-postgres` (instância efêmera própria) · HTTP real em porta dinâmica · fila real efêmera.
- **Mock evitado por decisão**: o dublê é **implementação da porta**, nunca `vi.mock`/`vi.fn`/`vi.spyOn`/`vi.useFakeTimers`.
- **Comando**: `pnpm --filter @sysloc/<pacote> test` — **nunca** `vitest run` avulso (sete dos nove pacotes resolvem `.` por `exports` para `dist/`, e o defeito reintroduzido não executaria).
- **Três asserções estáticas, e só três** — CT-933, CT-936 e CT-946: as três exigem **prova de falsificação** registrada. As outras 35 são comportamentais e a dispensam.
- **Controle positivo obrigatório em toda varredura** de não-vazamento e de vocabulário — CT-933, CT-934, CT-935, CT-939 e CT-946 —, com a lista de achados afirmada **por igualdade, canal a canal**.
- **Superfície publicada** se afirma por **igualdade de conjunto** com controle antivácuo, nunca por contenção.
- **32 dos 38 casos atravessam fronteira real**, e a distribuição **não segue a pirâmide 60/30/10** — deliberado: as invariantes centrais são restrição de banco, contrato HTTP e ordem de composição contra terceiro.

Distribuição por tipo: **UNITARIO 5 · INTEGRACAO 22 · E2E 4 · SEGURANCA 7**.

---

## 6. Cenários deliberadamente **não** cobertos

| Cenário | Motivo |
|---|---|
| Chamada real ao provedor em produção | ADR-0006 + `ENDERECO_DO_PROVEDOR_BANCARIO` aponta para domínio `.invalid` (RFC 6761) |
| Carga e desempenho | fora da doutrina de testes — vira `recomendacao`, não caso |
| Corrida real entre dois processos | o índice único parcial fecha a classe **no banco** (CT-916) |
| Provisionamento e expurgo do diretório | frente **shell**, não Vitest — `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh` |
| Agendamento por horário da conferência | fora do escopo pelo PRD §4.2 — o timer é da F5 |

---

## 7. Paths relevantes

**Produção (novos)**: `packages/cobranca-bancaria/src/{porta-de-cobranca,credencial-de-acesso,emissao-em-lote,reemissao,conferencia,guarda-de-boletos}.ts` · `packages/contracts/src/cobranca-bancaria.ts` · `packages/db/src/{evento-bancario,emissao-em-lote,conferencia-bancaria,boleto-da-cobranca}.ts` · `packages/db/migracoes/{0017_dominio_emissao_e_conciliacao,0018_seguranca_emissao_e_conciliacao}.sql` · `apps/api/src/cobrancas/boleto.service.ts` · `apps/api/src/cobranca-bancaria/*` · `apps/worker/src/tarefas/{emissao-em-lote,conferencia-bancaria}.ts` · `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`

**Suítes novas (12)**: `packages/db/test/{emissao-em-lote,conferencia-bancaria,boleto-da-cobranca,evento-bancario,isolamento-bancario}.spec.ts` · `packages/cobranca-bancaria/test/{emissao-em-lote,reemissao,conferencia,guarda-de-boletos}.spec.ts` · `apps/api/test/{boleto-da-cobranca,cobranca-bancaria,historico-bancario}.e2e.spec.ts` · `apps/worker/test/{emissao-em-lote,conferencia-bancaria}.spec.ts`

**Suítes estendidas (10)**: `packages/contracts/test/esquemas.spec.ts` · `packages/db/test/{coerencia-de-migracoes,catalogo,unidade-de-trabalho}.spec.ts` · `packages/cobranca-bancaria/test/{vocabulario-canonico,adaptador-sicoob}.spec.ts` · `packages/shared/test/{superficie-publica,fila}.spec.ts` · `apps/worker/test/ambiente.spec.ts` · `apps/api/test/{cobertura-de-autorizacao,autorizacao-do-dominio,recusa-indistinguivel,contrato-publicado,segredo-nao-escapa}.e2e.spec.ts`
