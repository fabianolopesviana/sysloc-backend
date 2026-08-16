# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário, ou **medido** neste repositório/no legado com o comando registrado).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `integracao-bancaria-sicoob` — a F4 do plano de execução
- **Fonte da ideia**: `docs/plano-backend-novo/briefings/f4-integracao-bancaria-sicoob.md`
- **Autor**: sysloc (usuário) · brainstorm conduzido por `/agent-spec-pre-refinement`
- **Data**: 2026-08-14
- **Versão**: v1
- **Status**: Refinado — pronto para próxima etapa
- **Relacionados**:
  - `docs/specs/features/integracao-bancaria-configuravel/` (v1 a v6-debits) — **insumo de leitura**, é a integração **no Frappe**. ⚠️ Não é esta feature e não se sobrescreve.
  - `docs/plano-backend-novo/plano-execucao.md` §F4 e §F5
  - `.claude/plans/plano-saas-decisoes.md` — rodadas 5, 5b, 6 e 7 (decisões 9, 17-24, 33, 37)
  - `docs/adr/0001`, `0011`, `0016`, `0017`, `0018`, `0020`, `0022`, `0027`, `0028`, `0029`, `0030`

---

## 2. Ideia Resumida (uma frase)

Portar a integração bancária Sicoob para o backend nativo — emitir, consultar, baixar e conciliar
boletos sob mTLS por empresa —, acrescentando as três peças que não existem em lugar nenhum hoje: o
**webhook de baixa**, o **contador de `seu_numero` único do SaaS** e o **carnê montado no servidor**.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | Partição da fase e a janela do oráculo legado | explorar |
| B | A entrada do terceiro — webhook e a borda pública | explorar |
| C | O que se grava e o que se deriva do banco | explorar |
| D | A unidade do ato de emissão e a fronteira com a F5 | explorar |
| E | As chaves e os segredos do SaaS — certificado e contador | explorar |

Os quatro rumos que sairiam do escopo do projeto já estavam declarados fora pelo briefing §6 e **não
foram levados à árvore**: código de frontend do carnê `[fora do escopo do projeto]`, a API Pix
(decisão 18), a execução da virada, e reescrever o que a F3 fechou.

---

## 3-B. Medições feitas durante o brainstorm (2026-08-14)

> Seis fatos obtidos por leitura no `/opt/frappe` (produção; nada destrutivo) e no repositório.
> **Dois refutam o briefing de entrada** e mudam o peso de um dos eixos de corte. Registrados aqui
> porque o método do projeto é medir antes de registrar — e porque quem ler esta spec depois precisa
> saber de onde os números vieram.

| # | Medido | Como | Consequência |
|---|---|---|---|
| M1 | O app legado **não** está em git dentro do container, mas **está** em `/opt/frappe/app-sync`, com remoto `git@github.com:fabianolopesviana/frappe-locacao.git`; `mapeamento.py` com as mesmas **455** linhas e os mesmos **15** arquivos de teste | `git rev-parse` / `git remote -v` / `wc -l` nos dois lados | ⚠️ **Refuta a §8.4 do briefing**: o fonte e a suíte legados **não têm prazo**. Diferente do Server Script `PDF contrato`, que existia só no banco. **Não há task de captura de oráculo nesta fase.** |
| M2 | Os 4 maiores testes mockam HTTP (35, 33, 33 e 23 ocorrências de `mock`/`patch`); **nenhum** exercita a API real | `grep -c` por arquivo | O oráculo legado é **estático**: fixa mapeamento e regra de decisão, **não** comportamento do Sicoob |
| M3 | `tabCobranca Integracao Sicoob` = **1.864** registros para **16** cobranças — 1.837 `boleto_consultado`, 22 `boleto_criado`, 5 `boleto_baixa_solicitada` | `SELECT count(*) … group by tipo_evento` | O polling 7×/dia é **99%** do volume de eventos — a decisão 17 confirmada com dado do próprio sistema |
| M4 | `origem_evento` = `api` em **100%** dos 1.864 | `group by origem_evento` | Confirma o briefing: o valor `webhook` do DocType **nunca foi usado** |
| M5 | **A resposta crua do Sicoob não é gravada.** `payload_processado` de consulta tem **52 bytes** (`{"situacao": "EMITIDO", "situacao_cru": "Em Aberto"}`); `payload_recebido` guarda o canônico de **entrada** (`aceite`, `data_emissao`, `pagador`…) | amostra dos dois campos | ⚠️ **A §8.1 do briefing não tem resposta no banco.** Se o `seuNumero` de 18 volta íntegro, **só uma consulta real à API responde** — ver `[DÚVIDA] 1` |
| M6 | `seu_numero` reais: `202605000000000031` — **18** caracteres; e `sequencial.py` mostra que **o sequencial é global e nunca reinicia** (o `AAAAMM` vem da data de emissão e é decorativo) | leitura de `gerar_seu_numero` e amostra do banco | A ADR-0020 já cobre o mecanismo: *"contador do próprio banco, um por **escopo declarado da série**, cujo avanço **não participa do desfazimento**"*. O `seu_numero` é a **mesma regra com escopo SaaS** — e a contenção do `FOR UPDATE` que a decisão 23 aceitou como custo **desaparece** |

**O que M1 e M2 fazem com o eixo (a) do briefing** ("por natureza da prova"): ele **perde a urgência**.
Não existe janela fechando — o eixo separa por *esforço de especificação*, não por *prazo*. Foi o que
levou a convergência para o eixo de dependência.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Partição da fase e a janela do oráculo

**Direções candidatas:**

- **A1 — Fatia única.** Tudo em `integracao-bancaria-sicoob/v1`, um run só.
  - _Exemplo:_ ~25-30 tasks para 5.514 LOC de fonte legado.
  - _Viabilidade:_ **sem precedente** — a régua tinha 837 LOC medidas e deu 12 tasks; o maior run do projeto até hoje teve 12.
- **A2 — Duas fatias, por natureza da prova.** `emissao-e-conciliacao` (tem referência legada) × `webhook-e-carne` (0 ocorrências no fonte legado).
  - _Exemplo:_ a 1 fecha com boletos emitidos e conciliados por polling diário; a 2 acrescenta a entrada do banco e o carnê.
  - _Viabilidade:_ ~2.700 LOC por fatia, ainda 3× a régua. **Enfraquecida por M1** — o eixo perdeu a urgência que o briefing lhe atribuía.
- **A3 — Três fatias, por dependência.**
  1. `fundacao-bancaria` — porta `AdaptadorCobrancaBancaria` (ADR-0001), mTLS com `undici`, certificado por empresa, contador `seu_numero`;
  2. `emissao-e-conciliacao` — emitir, consultar, dar baixa, reconciliar;
  3. `webhook-e-carne` — a entrada de terceiro e a saída em PDF.
  - _Exemplo:_ a (i) fecha provando "empresa sem certificado próprio falha explicitamente" e duas empresas emitindo no mesmo mês sem colisão de `seu_numero`; a (iii) só pode começar com boleto existindo.
  - _Viabilidade:_ ~1.840 LOC por fatia ≈ 12-15 tasks — a escala que este projeto já executou duas vezes. Reusa `@sysloc/shared` (contrato de fila) e `@sysloc/contracts`.

**Direção escolhida**: **A3** — três fatias, na ordem (i) → (ii) → (iii).
Dois motivos, e o segundo é o decisivo: (a) o dimensionamento por fatia cai na faixa já executada duas
vezes; (b) **isola o risco de borda** — o webhook é o único item bloqueado por infraestrutura que este
repositório não controla, e numa fatia própria ele não trava a emissão, que é o que gera dinheiro. A
ordem de dependência é declarada pelo próprio `plano-execucao.md` (item 6 depende de 1 a 4).

**Podadas / adiadas**: A1 (sem precedente de escala; risco de run que não fecha), A2 (o eixo perdeu a
urgência com M1, e 2.700 LOC por fatia continua acima do que o projeto executou).

---

### Ramo B — A entrada do terceiro

#### B-1 · Como o webhook entra sem contrariar a ADR-0027

**FATO.** A `Decision` da ADR-0027 condiciona a rota sem sessão a **o ato ser exercido pelo titular do
dado**, com portador de segredo de uso único. **Três** de suas cláusulas não se aplicam ao Sicoob: ele
não é titular de nada, a notificação é **repetível**, e o segredo proposto (token opaco por empresa na
URL) **não expira nem é de uso único** — e pela decisão 21 a URL é **única**, não por empresa.

**Direções candidatas:**

- **B1 — ADR nova, irmã da 0027**, para **rota de entrada de fato de terceiro**.
  - _Exemplo:_ "rota sem sessão para terceiro exige (i) segredo opaco no caminho, (ii) o fato nunca decide — reconfere-se na fonte autenticada, (iii) o que não casa é registrado e descartado sem chamar a API".
  - _Viabilidade:_ a 0027 fica intacta; as decisões 20 e 21 viram as cláusulas (ii) e (iii). Nenhum conflito com ADR ativa.
- **B2 — Emendar a ADR-0027.** Precedente: a ADR-0024 foi **emendada, não superseded**, na T11 da 2b.
  - _Viabilidade:_ ⚠️ o precedente da 0024 foi para corrigir cláusula que ficara **falsa**; aqui a 0027 está **correta** e o caso é outro. Emendar a torna ambígua sobre três cláusulas que não se aplicam.
- **B3 — Não é rota de negócio**; porta de entrada separada, fora do inventário.
  - _Viabilidade:_ **não escapa** — o briefing §5.2 fixa que `semDeclaracao` continua vazio e a rota entra na contagem. Muda o rótulo, não o problema.

**Direção escolhida**: **B1** — ADR nova. É decisão nova, não caso limítrofe da existente.
⚠️ Esta skill **sinaliza o candidato a ADR; não a cria.** Ver seção 15.4.

**Podadas / adiadas**: B2 (torna a 0027 ambígua), B3 (renomeia o problema sem resolvê-lo).

#### B-2 · A borda pública HTTPS/443

**FATO.** O Sicoob só entrega em URL HTTPS na 443, **sem redirect**, e a notificação de validação de
URL é **síncrona no cadastro** — sem ela o `POST /webhooks` falha. O CloudPanel é dono de 80/443 e o
`/opt/frappe` segue de pé atendendo a operação até a F7. Três débitos com gatilho — **D23**, **D24** e
**D27** (F1) — têm por gatilho declarado *"a publicação atrás do servidor de borda na F7"*.

**Direções candidatas:**

- **C1 — Antecipar só o caminho do webhook.** Vhost dedicado HTTPS/443 sem redirect, apontando **apenas** o caminho da notificação para a API nova; o resto segue no Frappe.
  - _Exemplo:_ desfazer é remover a entrada do vhost; o vhost do Frappe não se toca.
  - _Viabilidade:_ dispara D23, D24 e D27 aqui em vez da F7. Custo operacional real, mas **aditivo e reversível**.
- **C2 — Entregar provado por outra via.** Rota, idempotência e processamento provados por e2e local; cadastro no Sicoob e validação de URL ficam para a virada.
  - _Viabilidade:_ barata, mas entrega rota que **ninguém exercitou de fora** — e, como a validação é síncrona no cadastro, **não entrega o item, entrega metade dele**.
- **C3 — Cadastrar apontando para a URL futura**, validando na virada.
  - _Viabilidade:_ **inviável como medida** — o `POST /webhooks` falha na hora se a URL não responde.

**Direção escolhida**: **C1, restrita ao caminho da notificação, executada dentro da fatia (iii)** —
decisão **delegada pelo usuário à skill** ("decida da melhor forma por mim") e fundamentada assim:

1. **C2 entrega prova mais frouxa exatamente onde a doutrina do projeto proíbe.** A `.claude/rules/nao-regressao.md` §4.4 nomeia "substituir prova comportamental por prova mais frouxa" como proibição absoluta, e os três achados de segurança da 2b vieram de **medição, nenhum de leitura**. Rota de entrada de terceiro que move dinheiro, provada só localmente, é precisamente essa classe.
2. **O custo de C1 é aditivo e reversível** — um vhost novo para um caminho novo, sem tocar o que atende a operação.
3. **Os débitos são ganho, não custo** — três gatilhos declarados passam a estar satisfeitos antes da F7.

⚠️ `[HIPÓTESE]` a confirmar na fatia (iii): com **só** o caminho do webhook atrás da borda, o disparo é
**parcial** — o **D23** (origem confiável) e o **D27** (eixo de origem do limitador) ganham eixo para
essa rota, mas o **D24** (`/docs*` sem sessão) só fecha quando a API inteira for publicada. Os três
entram na fatia (iii) como *disparados, possivelmente não fecháveis por inteiro aqui*.

**Podadas / adiadas**: C2 (prova mais frouxa em rota que move dinheiro; não entrega o item inteiro),
C3 (falha na hora do cadastro).

---

### Ramo C — O que se grava e o que se deriva do banco

#### C-1 · Onde mora a trilha do que o banco disse

**FATO.** Não existe coluna de status em `negocio.cobranca`: o estado é derivado na view
`cobranca_derivada` (`packages/db/migracoes/0010_seguranca_cobranca.sql` §4) por precedência de fatos
gravados. A ADR-0022 proíbe a saída fácil — *"o estado publicado de um fato financeiro é derivado dos
fatos gravados, nunca uma coluna movida por rotina"*.

**Achado do brainstorm** (leitura conjunta das decisões 21 e 24): a decisão 21 manda **registrar e
descartar** a notificação que não casa com nenhuma cobrança; a decisão 24 diz que **a empresa é
derivada do documento encontrado**. Logo, **notificação que não casa não tem empresa derivável** — e a
tabela que a registra **não pode** ter `empresa_id NOT NULL`.

**Direções candidatas:**

- **D1 — Duas tabelas, fronteira no roteamento.** `integracao.notificacao_bancaria` (crua, **sem** `empresa_id`, fora do schema `negocio`, guarda o payload e o `numeroIdentificadorBaixa` para idempotência) e `negocio.evento_bancario` (roteada, com `empresa_id`, RLS forçada e FK composta, ligada à cobrança).
  - _Exemplo:_ 1.000 notificações forjadas → 1.000 linhas na crua, **0** em `evento_bancario`, **0** chamadas à API do Sicoob.
  - _Viabilidade:_ único desenho em que a RLS forçada continua **verdadeira sem exceção** dentro de `negocio`.
- **D2 — Uma tabela em `negocio` com `empresa_id` nulo até rotear.**
  - _Viabilidade:_ quebra a RLS forçada — linha sem tenant é invisível a todos ou visível a todos.
- **D3 — Trilha mínima na própria cobrança**, sem tabela de eventos.
  - _Viabilidade:_ não tem onde pendurar a notificação **descartada**, que é o que a decisão 21 exige registrar.

**Direção escolhida**: **D1**. E o estado continua derivado: a cobrança recebe `pago_em`/`valor_pago`
(fatos), a `cobranca_derivada` publica o estado, e o estorno **apaga** `pago_em` gravando um evento de
estorno — a trilha do que o banco disse mora no evento, nunca numa coluna de status. É o que a
ADR-0022 exige, e é o que preserva a decisão 19 (marcar `Paga` na hora, reverter em estorno) sem
inventar estado intermediário.

**Podadas / adiadas**: D2 (quebra a RLS forçada), D3 (não comporta o descarte da decisão 21).

#### C-2 · Quanto da trilha o produto expõe, e para quem

Decisão **delegada pelo usuário à skill**. Escolhido: **histórico bancário por cobrança, sim;
visão de notificações recusadas, não.**

- **A favor de expor o histórico por cobrança:** o congelamento da superfície vem *depois* da F5, e na prática "depois" é "não sem reabrir o marco". A operação vai perguntar *por que esta cobrança virou paga* na primeira divergência. A rota cabe na autorização existente sem decisão nova — o evento tem `empresa_id`, a RLS forçada faz o resto. Errar para menos é irreversível; errar para mais custa uma rota.
- **Contra expor as notificações recusadas:** pelo desenho D1, a notificação crua **não tem empresa** — a rota seria do Master e publicaria **payload cru de terceiro**, que é a superfície onde a 2b encontrou segredo vazando. Diagnosticar forja e divergência de `nossoNumero` se faz por registro estruturado e consulta na operação.
- **Adiado com gatilho:** o primeiro caso real de forja ou divergência que a operação **não conseguir diagnosticar sem rota**.

#### C-3 · Os bytes do boleto e o carnê

**FATO.** `negocio.cobranca` já tem as colunas de conciliação nascendo nulas e **sem produtor**:
`nosso_numero`, `linha_digitavel`, `codigo_barras`, `data_credito`, `valor_creditado` e
`boleto_arquivo`. O docblock de `boleto_arquivo` (`packages/db/src/esquema/negocio.ts:942`) já antecipa
esta fase por escrito: *"Não confundir os dois na F4: o carnê é derivado e se compõe sob demanda; o
boleto é fato e se guarda."* **A F4 é o produtor que faltava.**

**Direções candidatas:**

- **E1 — Bytes em disco, caminho em `boleto_arquivo`, expurgo por idade.**
  - _Viabilidade:_ arquivo some ⇒ a linha mente e o carnê quebra sem recurso.
- **E2 — Não guardar; rebuscar do Sicoob sempre.**
  - _Viabilidade:_ contraria o que o próprio código já escreveu (*"o boleto é fato e se guarda"*), e a ADR-0030 **exclui** o boleto do alcance dela por nome.
- **E3 — Bytes em disco, com re-obtenção automática quando o arquivo falta.** A linha é a verdade; o arquivo é cache recuperável.
  - _Exemplo:_ carnê pedido, 3 dos 12 boletos sumiram do disco → rebusca os 3 e monta; boleto **nunca emitido** → falha explícita nomeando a cobrança, nunca página em branco.
  - _Viabilidade:_ concilia a cláusula de exclusão da ADR-0030 (boleto não é derivado) com o carnê, que **é** derivado e se compõe sob demanda.

**Direção escolhida**: **E3**.
**Podadas / adiadas**: E1 (arquivo ausente sem recurso), E2 (contraria a ADR-0030 e o docblock).

---

### Ramo D — A unidade do ato de emissão e a fronteira com a F5

**FATO.** A ADR-0029 já resolve o caso simples, por escrito: chamada síncrona cujo retorno o
solicitante espera **permanece em linha e não é exceção**. A tensão real é que a emissão do produto é
**mensal e em lote** — a decisão 23 aceita a contenção do contador justamente por isso —, e um lote de
N boletos não tem "a resposta" que o solicitante espera.

**Direções candidatas:**

- **F1 — Ato unitário só.** `POST` por cobrança, síncrono, em linha; o lote é o cliente chamando N vezes.
  - _Viabilidade:_ repete no servidor o antipadrão de N chamadas que o carnê veio corrigir.
- **F2 — Ato de lote só.** Uma emissão do mês, assíncrona por fila, com rota de acompanhamento.
  - _Viabilidade:_ reemitir **um** boleto vira lote de um.
- **F3 — Os dois, com papéis distintos.** Unitário **em linha** (reemissão, correção pontual) + lote **por fila** (a emissão mensal).
  - _Exemplo:_ três rotas — emitir o boleto de uma cobrança, criar o lote do mês, consultar o lote.
  - _Viabilidade:_ reusa `FILA_DA_REGUA`/`OPCOES_PADRAO_DA_TAREFA` de `@sysloc/shared`. Cada ato cai no lado certo da ADR-0029 **por natureza, não por exceção**.

**Direção escolhida**: **F3**. A M3 mostra o formato real da operação: 22 `boleto_criado` para 16
cobranças — emissão é rara e em lote, mas reemissão existe.

**Podadas / adiadas**: F1 (antipadrão de N chamadas), F2 (reemissão vira lote de um).

**Fronteira com a F5** (declarada aqui para que nenhuma das duas invada a outra):

| Pertence à **F4** | Pertence à **F5** |
|---|---|
| A **regra** de reconciliação diária (o que reconcilia, contra a API como fonte da verdade) | O **gatilho**: systemd timer com `Persistent=true` |
| Uma rota de disparo **idempotente** da reconciliação — é o que torna a fatia verificável sem depender da F5 | O despachante por horário, o lock por (empresa, rotina), o alerta de rotina atrasada |

---

### Ramo E — As chaves e os segredos do SaaS

#### E-1 · Quem opera o certificado

⚠️ **A lição da 2b incide aqui inteira**: o achado **CRÍTICO** da T9 foi segredo em claro alcançando o
journal por `err.command.args` — o `bullmq` empurra `job.data` como argumento de comando Redis, o
`ioredis` o anexa ao erro, e a redação **não alcança**. A F4 põe senha de `.pfx` perto exatamente
dessa maquinaria. **Foi pego por medição, não por leitura.**

**Direções candidatas:**

- **H1 — Admin da empresa sobe por tela.** Upload do `.pfx` + senha, cifrados em repouso (AES-256-GCM); o valor **nunca volta pela API** — só titular, validade e impressão digital. Expiração: alerta antecipado + falha explícita na emissão.
  - _Exemplo:_ a spec legada trilhou "operar por tela em vez de deploy"; a empresa renova sem depender do operador do SaaS.
- **H2 — Só o Master sobe**, e a empresa consulta a validade.
- **H3 — Arquivo no servidor** em diretório 0600, com referência na configuração.
- **H4 — Como H1, mas bloqueando a emissão ANTES do vencimento.**

**Direção escolhida**: **H1** — o Admin da empresa opera por tela, com o material cifrado em repouso,
o valor nunca retornando pela API, alerta antecipado de expiração e **falha explícita** na emissão
quando o certificado não serve. Alinha com a decisão 9 (*cada empresa com sua própria integração*) e
com o **fallback global removido** que o `plano-execucao.md` §F4 item 2 exige.

**Podadas / adiadas**: H2 (depende do operador do SaaS a cada renovação), H3 (exige acesso ao host a
cada renovação), H4 (recusa emissão que talvez funcionasse — o alerta antecipado já cobre o caso).

**Restrição que atravessa a fatia inteira** — `[HIPÓTESE]` a provar por medição, não por leitura:
nenhum material de certificado nem senha de `.pfx` pode alcançar `job.data`, argumento de comando
Redis, ou qualquer caminho que a redação não cubra. A prova é a mesma classe da que a T9 da 2b usou.

#### E-2 · O contador `seu_numero` e a exceção ao invariante 1

**M6 muda o quadro:** o mecanismo **não é exceção arquitetural**. A ADR-0020 já decide *"contador do
próprio banco, um por **escopo declarado da série**, cujo avanço **não participa do desfazimento** da
transação que o consome"* — o `seu_numero` é a **mesma regra com escopo SaaS**, ao lado de
`CTR-{ano}-{5}` e `COB-{ano}-{7}`, que a instanciam com escopo `(empresa, ano)`.

O que **sobra** de exceção é só a **tabela sem `empresa_id`** contra o invariante 1 — e agora são
**duas**: o contador e a `integracao.notificacao_bancaria` do D1. Duas ocorrências na mesma fase é
**regra, não caso isolado**.

**Direções candidatas:**

- **I1 — ADR nova** declarando o critério: tabela que não é dado de negócio de nenhuma empresa vive **fora do schema `negocio`** e não carrega `empresa_id`.
- **I2 — Só `DECISÃO FECHADA`** nos dois pontos do código, sem ADR.
  - _Viabilidade:_ protege os dois pontos, mas não dá critério para a terceira tabela que aparecer.
- **I3 — ADR + `DECISÃO FECHADA`.**

**Direção escolhida**: **I1 — ADR nova.** É o que impede alguém de "corrigir" depois em nome do
invariante 1. ⚠️ Esta skill **sinaliza o candidato; não cria a ADR.**

**Podadas / adiadas**: I2 (sem critério para a terceira ocorrência), I3 (o `CLAUDE.md` adverte que
marcador em coisa já coberta por ADR ensina a ignorar os marcadores que importam — mas a fatia pode
decidir por marcador em um ponto específico, se a tentação for local).

---

## 5. Problema

- **Qual é a dor real hoje?** A cobrança bancária inteira vive no Frappe, que será desinstalado. O polling atual **não escala** (medido no plano: ~420 mil chamadas/dia projetadas a 300 empresas), o contador de `seu_numero` quebra no primeiro dia multi-empresa (`_obter_configuracao_ativa_for_update()` exige exatamente uma configuração ativa), e o carnê é montado **no browser**, que baixa N boletos.
- **Como o problema aparece no dia a dia?** A operação emite boletos mensalmente e concilia pagamentos; hoje descobre o pagamento por varredura, não por notificação. M3 mostra a distorção com dado do próprio sistema: **1.837 consultas** de boleto para **16 cobranças**.
- **Quem sente o impacto?** A imobiliária (Admin da empresa), que emite e concilia; o financeiro/operação, que precisa saber por que uma cobrança virou paga; o locatário, que recebe boleto e carnê; e o operador do SaaS, que responde por certificado e disponibilidade.
- **Por que resolver agora?** É a penúltima fase antes do marco de entrega do backend, e a única que **fala com um terceiro em produção**. A superfície da API só congela depois dela e da F5.

---

## 6. Objetivo Principal

- **Resultado esperado:** o backend nativo emite, consulta, dá baixa e concilia boletos Sicoob por empresa, sob mTLS com certificado próprio, recebe a baixa por webhook (com a API como fonte da verdade) e entrega o carnê montado no servidor — sem que nenhum campo ou vocabulário de provedor cruze a porta `AdaptadorCobrancaBancaria` (ADR-0001).
- **Mudança de estado:** a baixa deixa de depender de varredura e passa a ser dirigida por evento; o `seu_numero` passa a ser único no SaaS inteiro; o carnê sai do browser.

---

## 7. Público / Usuário Envolvido

- **Persona primária**: **Admin da empresa** (imobiliária) — emite o lote do mês, reemite pontualmente, sobe e renova o certificado, consulta o histórico bancário de uma cobrança.
- **Personas secundárias**:
  - **Operação/financeiro** — precisa entender *por que* uma cobrança virou paga (o histórico bancário por cobrança).
  - **Master (operador do SaaS)** — responde pelo contador único, pela borda pública e pelo bloqueio lógico de empresa suspensa (decisão 37).
  - **Locatário** — recebe o boleto e o carnê; não tem sessão.
  - **Sicoob** — ator **externo** que notifica; não é usuário e **não é titular do dado** (é o que motiva a ADR nova do ramo B).
- **Contexto de uso**: emissão mensal e em lote; conciliação diária; notificação a qualquer hora, sem sessão, sobre HTTPS/443.

---

## 8. Escopo Inicial (resultado da convergência)

Organizado pelas **três fatias** da direção A3. Cada fatia terá seu próprio ciclo de spec e run.

### Fatia (i) — `fundacao-bancaria`

- [ ] Pacote `@sysloc/banking` com a porta `AdaptadorCobrancaBancaria` e o modelo canônico **generalizado para meio de recebimento** (`boleto` | `pix`) — prepara o Pix sem implementá-lo (decisão 18). Pacotes 6 → 7.
- [ ] mTLS com `undici` (`Agent` com `pfx`/`passphrase`), **pool por empresa**.
- [ ] Certificado **por empresa**, cifrado em repouso (AES-256-GCM), operado pelo Admin da empresa por tela; **fallback global removido** — ausência falha explicitamente. Alerta antecipado de expiração.
- [ ] Contador `seu_numero` único do SaaS — `AAAAMM` + 12 dígitos, em linha própria **fora do schema `negocio`**, instanciando a ADR-0020 com escopo SaaS.
- [ ] Nenhum material de certificado ou senha de `.pfx` alcança `job.data` ou caminho que a redação não cubra — **provado por medição**.

### Fatia (ii) — `emissao-e-conciliacao`

- [ ] Emissão **unitária em linha** (reemissão/correção) e **lote por fila** (a emissão mensal), reusando o contrato de fila de `@sysloc/shared`.
- [ ] Consulta de boleto e baixa: marca `Paga` na hora gravando `pago_em`/`valor_pago`; estorno **apaga** o fato e grava evento de estorno (decisão 19), com o estado seguindo derivado da `cobranca_derivada`.
- [ ] `negocio.evento_bancario` — trilha roteada, com `empresa_id`, RLS forçada e FK composta.
- [ ] **Histórico bancário por cobrança** exposto por rota.
- [ ] **Regra** de reconciliação diária (a API é a fonte da verdade — decisão 20) com **rota de disparo idempotente**. O timer é da F5.
- [ ] Produção dos campos hoje órfãos: `nosso_numero`, `linha_digitavel`, `codigo_barras`, `data_credito`, `valor_creditado`, `boleto_arquivo` (caminho, nunca bytes).

### Fatia (iii) — `webhook-e-carne`

- [ ] `integracao.notificacao_bancaria` — payload cru, **sem `empresa_id`**, fora do schema `negocio`; idempotência por `numeroIdentificadorBaixa`.
- [ ] Rota de webhook: **URL única**, `persistir cru → responder 200 → processar assíncrono`; responde **apenas 200/201/204**, sem redirect e **sem `202`**. Trata a notificação de validação de URL. Datas UTC → America/Sao_Paulo.
- [ ] Roteamento **por `seu_numero`**; a **empresa é derivada do documento encontrado, nunca do payload**; `nossoNumero` e `numeroCliente` são **conferência** — divergência registra e recusa (decisão 24). O que não casa é descartado **sem chamar a API** (decisão 21). Empresa suspensa → bloqueio **lógico**, aplica na reativação (decisão 37).
- [ ] **Carnê** montado no servidor com `pdf-lib`, composto **sob demanda** (ADR-0030), publicando mídia e nome de arquivo pela ADR-0028; boleto ausente do disco é **rebuscado**; boleto nunca emitido **falha nomeando a cobrança**.
- [ ] **Borda pública** para o caminho da notificação (direção C1), com o cadastro do webhook no Sicoob e a validação de URL respondida de verdade como critério de aceitação.

### Superfície da API

`[HIPÓTESE]` — estimativa de **~9 rotas novas**, levando de **89/74** a **~98**: 2 na fatia (i)
(certificado: subir e consultar metadados), 5 na (ii) (emitir unitário, criar lote, consultar lote,
histórico bancário, disparar reconciliação) e 2 na (iii) (webhook, carnê). A contagem exata é da
tech-spec de cada fatia, por **dupla medição independente** com a igualdade entre os eixos afirmada —
o precedente são os CT-533, CT-635 e CT-732.

---

## 9. Fora do Escopo (podado / adiado)

- **Qualquer código de frontend** `[fora do escopo do projeto]` — o fonte React vive na máquina local; task que peça isso é **gatilho de parada**. O que o carnê e o boleto exigem do frontend vira **handoff**.
- **A API Pix** (`cob`/`cobv`/`lotecobv`/`pix`) — decisão 18: generaliza-se o modelo, não se implementa. ⚠️ O sistema **já recebe via Pix hoje**, porque o boleto nasce com QR vinculado (`codigoCadastrarPIX: 1`); o que não existe é a API.
- **A execução da virada e a desinstalação do Frappe** — sessão operacional futura, pós-marco.
- **Reescrever o que a F3 fechou** — a régua, a mora, a `cobranca_derivada` e os documentos estão fechados; a F4 os **consome**.
- **Visão de notificações recusadas por rota** — adiada com gatilho (ver C-2): o primeiro caso real que a operação não conseguir diagnosticar sem rota.
- **Task de captura de oráculo no `/opt/frappe`** — **podada por medição (M1)**: o fonte e a suíte legados estão em git com remoto e não expiram. O briefing a admitia como possível task de prazo; não é.
- **Estado intermediário de pagamento** (`Pagamento em confirmação`) — decidido **não** criar (decisão 19); a API como fonte da verdade (decisão 20) já elimina o risco que o motivaria.
- **Timer/agendamento da reconciliação** — é da F5.
- **Publicação da API inteira atrás da borda** — só o caminho da notificação é antecipado; o resto é F7.

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multi-empresa de gestão de locação de imóveis; backend Node/NestJS/PostgreSQL **nativo, sem Docker**, substituindo integralmente o Frappe/ERPNext de `/opt/frappe`. Idioma pt-BR em tudo; modelo Opus, inclusive em subagente. **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição. **Fronteira: aqui só se faz backend.**
- **Specs e PRDs consultados** (`/docs/specs/**/*.md` + `/docs/prds/**/*.md`):
  - `integracao-bancaria-configuravel/` (v1, v2-debits, v3, v4-debits, v5, v6-debits) — **adjacente, é insumo**: a mesma integração **no Frappe**. ⚠️ Nome distinto de propósito; reusá-lo sobrescreveria história de outro produto.
  - `cobranca-e-mora/v1` — **conflita se ignorada**: entrega `negocio.cobranca`, `cobranca_derivada` e a série `COB-{ano}-{7}`. A F4 **consome**, não reescreve.
  - `regua-de-cobranca/v1` e `documentos-e-confirmacao/v1` — precedentes diretos: a fila em `@sysloc/shared`, a ADR-0029, a ADR-0030 e o **primeiro `202` do produto** (que aqui é **proibido**).
  - `contratos-de-locacao/v1` — a primeira série declarada e a ADR-0020, que o contador `seu_numero` instancia.
  - `caracterizacao-regras-legadas/v1` — os artefatos golden; **nenhum novo é necessário** (M1).
- **Capacidades reutilizáveis** (só para viabilidade):
  - **Persistência**: `@sysloc/db` — Drizzle + `postgres.js`, RLS forçada, FK composta, funções `SECURITY DEFINER` para série, `negocio.data_corrente_da_operacao()`.
  - **Autenticação / autorização**: `@sysloc/auth` (better-auth), cobertura de autorização por rota com default que nega (ADR-0011/0018), `@RotaPublica()` (usado uma vez, na F3).
  - **Outros módulos internos**: `@sysloc/contracts` (fonte única do contrato, ADR-0016/0017), `@sysloc/shared` (contrato de fila: `FILA_DA_REGUA`, `FILA_DA_CONFIRMACAO`, `OPCOES_PADRAO_DA_TAREFA`), `@sysloc/documentos` (composição de PDF sob demanda + porta de renderização), `@sysloc/regua`, `apps/worker` (BullMQ).
- **Conflitos / sobreposições detectados**:
  1. **ADR-0027 × webhook** — resolvido pela direção B1 (ADR nova). Enquanto ela não existir, **não** presuma que a 0027 cobre o caso.
  2. **Invariante 1 × duas tabelas sem `empresa_id`** — resolvido pela direção I1 (ADR nova).
  3. **Nome da feature** — `integracao-bancaria-sicoob` ≠ `integracao-bancaria-configuravel`. Registrado para que nenhuma skill posterior reuse o diretório errado.

---

## 11. Premissas e Decisões já tomadas

**Premissas** — suposições assumidas para que a ideia faça sentido:

- `[HIPÓTESE]` **A F4 não cabe num run só** — leitura sustentada pelo dimensionamento (5.514 LOC de fonte legado contra 837 LOC da régua, que virou 12 tasks). Resolvida pela partição A3.
- `[HIPÓTESE]` **O disparo dos débitos D23/D24/D27 pela direção C1 é parcial** — o D24 provavelmente só fecha com a API inteira publicada. A confirmar na fatia (iii).
- `[HIPÓTESE]` **A superfície cresce ~9 rotas** (89 → ~98). A contagem exata é da tech-spec, por dupla medição independente.
- `[HIPÓTESE]` **O contador `seu_numero` é a ADR-0020 com escopo SaaS**, não mecanismo novo — apoiada em M6 (sequencial global que nunca reinicia). A confirmar contra o texto integral da `Decision` na tech-spec.
- `[HIPÓTESE]` **A homologação com o Sicoob segue válida** — o briefing a declara feita; confirmar **por data**, não por memória.
- `[HIPÓTESE]` **Nenhum material de certificado alcança caminho não redigido** — é premissa a **provar por medição**, no molde do achado CRÍTICO da T9 da 2b, nunca por leitura.

**Decisões já tomadas (fora de negociação)**:

- A F4 se parte em **três fatias, por dependência**: `fundacao-bancaria` → `emissao-e-conciliacao` → `webhook-e-carne`.
- O webhook entra por **ADR nova, irmã da ADR-0027** — a 0027 não se emenda nem se supersede.
- A borda pública é **antecipada apenas para o caminho da notificação**, dentro da fatia (iii).
- A trilha bancária mora em **duas tabelas**: `integracao.notificacao_bancaria` (crua, sem `empresa_id`) e `negocio.evento_bancario` (roteada, RLS forçada).
- O produto **expõe o histórico bancário por cobrança** e **não expõe** as notificações recusadas.
- Os bytes do boleto ficam em disco com **re-obtenção automática** quando o arquivo falta; o carnê é composto sob demanda.
- A emissão tem **dois atos**: unitário em linha e lote por fila.
- A F4 entrega a **regra** de reconciliação e a rota de disparo idempotente; o **timer** é da F5.
- O **Admin da empresa** opera o certificado por tela; o valor nunca retorna pela API; expiração dá alerta antecipado e **falha explícita** na emissão.
- As duas tabelas sem `empresa_id` são registradas por **ADR nova**, não apenas por marcador.
- Nenhum código de frontend, em nenhuma hipótese.

---

## 12. Riscos e Pontos de Atenção

- **Risco de produto / aceitação**: o webhook é o caminho normal de baixa, mas o Sicoob **não autentica** a notificação (rodada 5b, LACUNA 1). → **Mitigação**: decisão 20 (a API é a verdade) + decisão 21 (descartar sem chamar a API o que não casa) + segredo opaco no caminho — as três cláusulas da ADR candidata do ramo B.
- **Risco de escopo**: a fase é 6,6× a régua e tem três peças que não existem em lugar nenhum. → **Mitigação**: partição A3, com a fatia mais arriscada (iii) por último e dependente das duas anteriores.
- **Risco técnico**: a **§8.1 continua em aberto** — se o `seuNumero` de 18 caracteres truncar na API, **a decisão 24 precisa ser revista antes da fase**, porque ele é a chave de roteamento. M5 mostra que o banco **não responde** isso. → **Mitigação**: consultar um boleto real pela API antes de a fatia (ii) começar (`[DÚVIDA] 1`).
  - ⚠️ **SUPERADO em 2026-08-16 — não cite o item acima sem ler a §13-A.1.** A mitigação foi executada: o `seuNumero` retorna **íntegro** (3/3, igualdade exata), a decisão 24 **se sustenta** e este risco **não se materializou**. O item fica preservado como registro do que se sabia em 2026-08-14. ⚠️ **O risco datado que ocupa o lugar dele é outro** — o **certificado A1 vence em 2026-08-22** (§13-A.2), e esse tem prazo.
- **Risco operacional**: a borda pública toca 80/443, hoje do CloudPanel, com o Frappe atendendo a operação. → **Mitigação**: vhost aditivo só para o caminho da notificação; reverter é remover a entrada.
- **Risco de privacidade / segurança**: primeiro segredo de **terceiro** que o produto guarda, colocado perto da maquinaria que já vazou segredo por `err.command.args` na 2b. E o `payload_recebido` carrega **dado pessoal do pagador** (nome, documento, endereço). → **Mitigação**: prova por **medição** de que nada alcança caminho não redigido; a não-exposição das notificações recusadas por rota (C-2); e RLS forçada em tudo que é roteado.
- **Risco de método**: prescrição de gate **é hipótese, não ordem** — precedente da 2b, onde o executor divergiu declarando e medindo por três vezes e nas três o gate lhe deu razão.
- **Atenção operacional**: meça a suíte **por pacote** (`pnpm --filter @sysloc/<pacote> test`); `rm -rf /tmp/sysloc-banco-*` entre execuções — o disco está em ~96% e `No space left on device` **se disfarça de teste vermelho**.

---

## 13. Dúvidas em Aberto

1. `[DÚVIDA]` **O `seuNumero` de 18 caracteres retorna íntegro da API do Sicoob?** É a pré-condição não resolvida da fase. M5 provou que **o banco não responde** — a resposta crua não é gravada. Resolve-se consultando **um boleto real** pela API, com o certificado de uma das 2 configurações existentes. ⚠️ **Bloqueante para a fatia (ii)**: se truncar, a decisão 24 (roteamento por `seu_numero`) precisa ser revista antes.
2. `[DÚVIDA]` **`codigoMotivoCancelamento: 2`** aparece no payload de exemplo e **não consta** na lista documentada (que começa em 11). Pendência **do usuário** com o Sicoob (decisão 22). Não bloqueia o plano, mas define o que o produto faz com **motivo desconhecido** — recusar, registrar e ignorar, ou aplicar como estorno?
3. `[DÚVIDA]` **A homologação segue válida por data?** Confirmar a validade do certificado e das credenciais por data de expiração, não por memória.
4. `[DÚVIDA]` **A borda pública: qual vhost e qual caminho?** Decisão operacional a fechar no início da fatia (iii) — qual hostname atende, e se o D24 fecha ou apenas dispara.
5. `[DÚVIDA]` **Onde os bytes do boleto moram no filesystem**, com que política de expurgo, e o que a instalação do zero precisa provisionar (o D39, da F1, já sinaliza que o provisionamento tem lacuna).

---

## 13-A. EMENDA de 2026-08-16 — desfecho medido das dúvidas 1 e 3

> **O texto da §13 acima está preservado byte a byte**, no molde das emendas das ADRs 0001, 0017,
> 0021 e 0024. Esta seção **não o corrige** — ela registra o que a medição respondeu, e é vinculante
> sobre a §13 onde as duas divergirem. Autorizada pelo usuário em 2026-08-16, antes da abertura do
> PRD da fatia (ii).
>
> **Por que a emenda mora aqui, e não só no PRD da fatia (ii):** este arquivo é o discovery que as
> fatias (ii) **e (iii)** abrem, e a §12 declara a `[DÚVIDA] 1` bloqueante. Registrada só no PRD da
> (ii), a fatia (iii) leria a dúvida ainda em aberto — que é o mecanismo de *premissa herdada por
> citação* documentado na §6.3 do `run-report.md` da `fundacao-bancaria`, e que ali custou duas fases.

### 13-A.1 · `[DÚVIDA] 1` — **RESOLVIDA. O `seuNumero` de 18 caracteres retorna ÍNTEGRO.**

Sonda de **leitura pura** contra a API de produção do Sicoob (`GET /cobranca-bancaria/v3/boletos`),
sob mTLS com o certificado da configuração existente, token `client_credentials` — **sem escrita**
no Frappe (o caminho `consultar_boleto_sicoob` foi **evitado** justamente porque faz `db_set` +
evento + `commit`) e sem alteração no provedor.

| Cobrança | `seu_numero` gravado | `seuNumero` retornado | len | Íntegro |
|---|---|---|---|---|
| COB-2026-0000054 | `202605000000000031` | `202605000000000031` | 18 | ✅ |
| COB-2026-0000047 | `202605000000000024` | `202605000000000024` | 18 | ✅ |
| COB-2026-0000057 | `202607000000000037` | `202607000000000037` | 18 | ✅ |

`HTTP 200` nos três; igualdade **exata**, sem truncamento, sem preenchimento, sem reordenação. Os
**14** boletos já emitidos no legado têm `seu_numero` de largura **18** — a distribuição medida é
`[(18, 14)]`, sem nenhuma outra largura.

**Consequência:** a **decisão 24** (roteamento por `seu_numero`) **se sustenta**, e o gatilho de
*upgrade* da §15.5 que dependia de truncamento **não disparou**. A fatia (ii) abre sem redesenho.

⚠️ **Alcance da prova — não a escreva mais larga do que ela é.** Isto prova o **caminho de
consulta**. **Não** prova o payload do **webhook**, que é a superfície onde a decisão 24 de fato
roteia, é da fatia (iii), e permanece inauditável: a **M4** mediu `origem_evento = api` em 100% dos
1.864 eventos — o webhook nunca recebeu tráfego. A fatia (iii) trata isso como pergunta ainda aberta.

### 13-A.2 · `[DÚVIDA] 3` — **RESPONDIDA, e o desfecho é ADVERSO.**

O certificado A1 em uso **vence em 2026-08-22 19:17 UTC** — **6 dias** após esta medição.

| Atributo | Valor medido |
|---|---|
| Titular | `CN=TECHTEL TECNOLOGIA EM TELECOMUNICACOES LTDA:07719758000123` |
| Emissor | `CN=AC DIGITAL MULTIPLA G1, OU=AC DIGITAL MAIS, O=ICP-Brasil, C=BR` |
| Vigência | 2025-08-22 → **2026-08-22** |
| Senha da configuração abre o arquivo | sim |
| Token `client_credentials` | `HTTP 200`, scope concedido = scope pedido |

⚠️ **Isto refuta a premissa em vigor.** O `plano-execucao.md` §F4 e a §F4 do `roadmap.md` afirmam que
*"certificado e credenciais seguem válidos"* — verdadeiro na data em que foi escrito, e com **prazo**.
**Decisão do usuário em 2026-08-16:** assumir a renovação do A1 e tratar o vencimento como **risco
datado** no PRD da fatia (ii), que segue o plano — inclusive com chamada real ao provedor onde ela
for a única prova possível.

### 13-A.3 · Duas premissas colaterais que a medição refutou

1. **Existe UMA configuração, não duas.** A §13.1 fala em *"uma das 2 configurações existentes"*;
   `tabConfiguracao Integracao Sicoob` tem **1** registro (`2dd758f872`).
2. **A integração está DESLIGADA em produção desde 2026-07-21.** O registro está com `ativo = 0`, e o
   certificado foi renomeado para `certificado.bak` — o `pfx_path` gravado aponta para
   `certificado.pfx`, **que não existe**. A sonda só funcionou apontando para o `.bak` explicitamente.
   Nenhuma das duas coisas foi alterada por esta medição.

### 13-A.4 · Dados de desenho para a fatia (ii), colhidos de brinde

- **O token expira em 300 s** (5 min). Pesa diretamente no pool por empresa e na estratégia de cache.
- **A resposta vem envelopada em `resultado`** — o corpo útil não está na raiz.
- **`nossoNumero` retorna como INTEIRO** no JSON, não como texto. O contrato Zod da fatia (ii) precisa
  coagir na fronteira em vez de supor `string`.
- **Existe um campo `identificacaoBoletoEmpresa`**, que retornou **25 espaços** em todos os três. É
  vizinho semântico do `seuNumero` e **não deve ser confundido com ele** no mapeamento — é ele, e não
  o `seuNumero`, o candidato natural a truncar.

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: A3 (três fatias por dependência) · B1 (ADR nova para entrada de terceiro) · C1 restrita (borda só para o caminho da notificação) · D1 (duas tabelas, fronteira no roteamento) · histórico bancário por cobrança exposto · E3 (bytes em disco com re-obtenção) · F3 (unitário em linha + lote por fila) · H1 (Admin da empresa opera o certificado por tela) · I1 (ADR nova para tabela sem `empresa_id`) · fronteira F4/F5 declarada.
- **Descartado com justificativa**: A1 e A2 (escala sem precedente; eixo (a) perdeu urgência com M1) · B2 (emendar a 0027 a tornaria ambígua) · B3 (renomeia o problema) · C2 e C3 (prova frouxa; cadastro falha na hora) · D2 e D3 (quebram a RLS forçada; não comportam o descarte da decisão 21) · E1 e E2 (arquivo ausente sem recurso; contraria a ADR-0030) · F1 e F2 (antipadrão de N chamadas; reemissão vira lote de um) · H2, H3 e H4 · I2 e I3 · **task de captura de oráculo** (podada por medição).
- **Adiado para v2/v3**: visão das notificações recusadas por rota, com gatilho — o primeiro caso real que a operação não conseguir diagnosticar sem ela.
- **Provocações que mudaram o rumo**:
  1. **"O oráculo tem prazo?"** — a medição M1 respondeu **não**, e isso **enfraqueceu o eixo (a)** que o briefing favorecia, levando a convergência para o eixo de dependência.
  2. **"Onde mora a notificação que não casa com cobrança nenhuma?"** — a leitura conjunta das decisões 21 e 24 mostrou que **ela não tem empresa derivável**, o que forçou o desenho de duas tabelas e revelou a **segunda** ocorrência da exceção ao invariante 1 — que é o que transformou o registro dela de marcador em ADR.
  3. **"O contador é exceção mesmo?"** — M6 mostrou que o sequencial legado é **global e nunca reinicia**, o que faz o `seu_numero` ser a ADR-0020 com outro escopo, e não mecanismo novo. De quebra, a contenção do `FOR UPDATE` que a decisão 23 aceitou como custo **desaparece**.

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** — os 5 ramos sobreviveram com direção escolhida, distribuídos em 3 fatias | confirmado |
| Personas | **múltiplas personas** — Admin da empresa, operação/financeiro, Master, locatário, e o Sicoob como ator externo | confirmado |
| Novidade | **greenfield** — pacote `@sysloc/banking` novo, webhook e carnê sem nenhum precedente no legado (0 ocorrências) | confirmado |
| Decisão arquitetural transversal nova? | **sim, duas** — rota de entrada de fato de terceiro (ramo B) e tabela sem `empresa_id` fora de `negocio` (ramo E) | confirmado |

### 15.2 Framework Recomendado

**Escolhido**: `SDD` — **um ciclo por fatia**, na ordem `fundacao-bancaria` → `emissao-e-conciliacao` → `webhook-e-carne`.

**Justificativa**: as duas dimensões decisivas são **múltiplas personas** e **decisão arquitetural nova**
— qualquer uma delas sozinha já leva a SDD pela tabela de decisão, e aqui as duas coexistem com
amplitude `4+` e novidade `greenfield`. Some-se que **duas ADRs** nascem desta fase, e ADR é o artefato
que só o SDD comporta no fluxo. O precedente do projeto é o mesmo: F2 e F3 rodaram SDD **por fatia**,
com PRD, tech-spec, task-plan e os dois gates em cada uma.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo): miniSpec cobre `2-3` rumos, `dev+1` persona e
incremento **sem decisão arquitetural transversal nova**. Esta fase falha nos três critérios de uma
vez — e falha por larga margem no que mais importa: ela **produz duas ADRs**, e o `scope.md` do
miniSpec não tem onde ancorá-las nem gate que audite conformidade com elas. Rodar miniSpec aqui
significaria decidir a governança da entrada de terceiro e a exceção ao invariante 1 **dentro de uma
task**, que é exatamente o caminho pelo qual uma R3 (regressão de decisão) entra.

**Por que NÃO TaskCard** (mais distante): TaskCard pressupõe `0-1` rumo, só dev, ajuste pontual e
nenhuma decisão arquitetural. A fase tem 5.514 LOC de fonte legado a portar, três peças construídas do
zero, ~9 rotas novas e um pacote novo no monorepo — está duas categorias acima do que o TaskCard
dimensiona.

### 15.4 Próximo Passo

```bash
# 1) Registre a ADR da exceção ao invariante 1 ANTES da fatia (i) — o contador nasce lá:
/agent-spec-adr-create "tabela que não é dado de negócio de empresa vive fora do schema negocio e não carrega empresa_id"

# 2) Abra o SDD da PRIMEIRA fatia:
/agent-spec-sdd-generate-prd "fundacao-bancaria — porta AdaptadorCobrancaBancaria, mTLS por empresa, certificado cifrado e contador seu_numero único do SaaS"

# 3) Antes da fatia (iii), e só então, registre a segunda ADR:
# /agent-spec-adr-create "critério para rota de entrada de fato de terceiro sem sessão"
```

> As duas ADRs **não** se criam juntas agora: a do invariante 1 é pré-requisito da fatia (i); a da
> entrada de terceiro é pré-requisito da fatia (iii), e escrevê-la antes de a fatia (ii) definir a
> forma do evento bancário arriscaria uma `Decision` que já nasce desatualizada. O precedente é a
> sub-fatia 2b da F3, que nasceu com quatro ADRs criadas **na abertura dela**, não da fase.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** (partir mais, ou abrir fatia extra) se: a `[DÚVIDA] 1` retornar **truncamento** do `seuNumero` (a decisão 24 cai e o roteamento inteiro precisa ser redesenhado); a borda pública se mostrar inviável sem publicar a API inteira (a fatia (iii) vira duas); ou a fatia (i) passar de ~15 tasks no task-plan.
- **Downgrade** (para miniSpec) apenas para a fatia (i), **e só se** ela não produzir ADR — o que hoje **não é o caso**, já que a exceção ao invariante 1 nasce nela. Se a ADR for registrada antes e a fatia ficar restrita a porta + `undici` + cifra, a amplitude cai para `2-3` e o miniSpec passa a caber.

---

## 16. Checklist Final

- [x] Ideia resumida em uma frase clara
- [x] **Esqueleto (seção 3)** com 5 ramos, validado com o usuário na Fase 1
- [x] **Árvore de rumos (seção 4)**: cada ramo com direções candidatas + exemplo concreto + viabilidade + direção escolhida/podada
- [x] Rumos fora do escopo do projeto marcados como `[fora do escopo do projeto]`
- [x] Problema, público, escopo inicial e fora de escopo delimitados
- [x] **Ancoramento (seção 10)** preenchido com specs/PRDs e capacidades concretos
- [x] Toda inferência marcada `[HIPÓTESE]`; dúvidas listadas como perguntas objetivas
- [x] **Síntese (seção 14)** registra absorvido / descartado / adiado
- [x] **Complexidade (15.1)** preenchida
- [x] **Framework recomendado (15.2)** justificado com 2 dimensões decisivas
- [x] **Alternativas (15.3)** explicam por que NÃO o vizinho mais próximo
- [x] **Comando exato (15.4)** escrito, com as duas ADRs posicionadas por fatia
- [x] **Gatilhos (15.5)** de reclassificação listados
- [x] Pronto para alimentar PRD / INTENT / TaskCard
