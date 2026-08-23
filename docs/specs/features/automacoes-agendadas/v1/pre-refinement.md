# Pré-Refinamento — Brainstorm de Produto

> Artefato **intermediário** (anterior ao PRD / INTENT / TaskCard), produto de um brainstorm em **Tree of Thought**: divergir os rumos possíveis, podar com o usuário e convergir.
>
> **Legenda:**
> - Linhas sem marcação = **FATO** (afirmado pelo usuário, ou **medido** nesta sessão).
> - `[HIPÓTESE]` = inferência da skill que precisa ser validada.
> - `[DÚVIDA]` = ponto em aberto, detalhado na seção 13.
> - `[fora do escopo do projeto]` = rumo que extrapola o que este projeto se propõe a ser.
>
> ⚠️ **As decisões deste brainstorm foram auto-resolvidas pela regra A1** de
> `.claude/rules/autonomia-do-run.md` (escopo universal): onde a skill mandaria `AskUserQuestion`, a
> alternativa recomendada foi **formulada, adotada e registrada** em vez de pausar. Cada ponto assim
> resolvido traz a marca `(A1)`. **Todos são reversíveis** — ajuste qualquer um e o artefato se
> corrige.

---

## 1. Metadados

- **Nome da Ideia / Feature**: `automacoes-agendadas` — F5, fatia (ii)
- **Fonte da ideia**: `docs/specs/features/automacoes-agendadas/v1/insumo-do-pre-refinamento.md`
- **Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-22
- **Versão**: v1
- **Status**: Refinado — pronto para a próxima etapa
- **Relacionados**: `plano-execucao.md` §F5(ii) · decisões 25–31, 34, 37 · ADR-0021, ADR-0022,
  ADR-0024, ADR-0026, ADR-0029, ADR-0031 · fatias `regua-de-cobranca`, `contratos-de-locacao`,
  `emissao-e-conciliacao`, `webhook-e-carne`, `integracao-bancaria-autonoma`

---

## 2. Ideia Resumida (uma frase)

**Dar ao backend novo o gatilho que ele nunca teve** — o que hoje roda sozinho no Frappe por cron do
root passa a rodar por systemd timer com `Persistent=true`, um job por empresa com falha isolada,
histórico gravado só quando houve trabalho, e vigilância que avisa quando uma rotina para.

---

## 3. Esqueleto do Tema (Fase 1 — ramos da árvore)

| # | Ramo | Status (Fase 1) |
|---|------|-----------------|
| A | **Que rotinas existem de fato** — o inventário medido, não o herdado | explorar |
| B | **O gatilho no sistema operacional** — quantos timers, e com que garantia | explorar |
| C | **A cadência do minuto** — o despachante, contra a janela que é intervalo | explorar |
| D | **Quem observa** — saúde, alerta e histórico; a última rota antes do congelamento | explorar |
| E | **Suspensão e reativação** — o que congela, o que se põe em dia, o que nunca volta | explorar |

> O **Ramo A** foi o que o usuário provavelmente não esperava, e ele mudou o escopo da fatia: o
> inventário medido **não é** o inventário herdado. Ver a seção 4.

---

## 4. Árvore de Rumos (Fase 2 — Tree of Thought)

### Ramo A — Que rotinas existem de fato

#### O que a medição encontrou (base factual deste ramo)

**A dúvida da §0 do insumo está RESOLVIDA, e o `1 0 * * *` estava errado.** O `sudo crontab -l` exige
senha nesta sessão, então a coleta foi feita pelo caminho mais forte: o **diário do agendador**
(`journalctl -t CRON`), que registra a execução real em vez da documentação à mão. Janela disponível:
**Ago 17 22:35 → Ago 22 19:19**.

| Script | Horário **medido** | Cadência | Execuções na janela |
|---|---|---|---|
| `run-encerrar-contratos-vencidos.sh` | **00:02** | diária | 5/5 dias, sem falha |
| `run-cobrancas-vencidas.sh` | **00:10** | diária | 5/5 dias, sem falha |
| `run-atualizar-atrasos-cobrancas.sh` | **02:05** | diária | 5/5 dias, sem falha |
| `run-locacao-automation.sh` | **a cada minuto** | `* * * * *` | contínua |

⚠️ **O `10 0 * * *` é o correto** — o outro levantamento estava errado. E os quatro horários são
**estáveis**: nenhum dia pulado na janela observada.

**Medição colateral:** `/opt/frappe/run-locacao-automation.log` está em **12 MB**, não 10 MB. O
insumo (§2) e a decisão 25 citam 10 MB; o valor cresceu desde a medição original — o defeito é o
mesmo, a grandeza é maior.

#### A descoberta que muda o escopo: duas das quatro rotinas **não se portam**

**Direções candidatas:**

- **A1 — Portar as quatro rotinas como estão** (fidelidade ao oráculo).
  - _Exemplo:_ criar uma tarefa `marcar-cobrancas-vencidas` que roda 00:10 e faz
    `UPDATE negocio.cobranca SET status = 'VENCIDA' WHERE vencimento < hoje`.
  - _Viabilidade:_ **contraria ADR ativa.** A **ADR-0022** decide que *"o estado publicado de um
    fato financeiro é derivado dos fatos gravados, nunca uma coluna movida por rotina"*, e o
    contrato publicado a materializa (`packages/contracts/src/cobranca.ts`): *"`CANCELADA` se há
    cancelamento, senão `PAGA` se há pagamento, senão `VENCIDA` se o vencimento já passou, senão
    `A_VENCER`. A avaliação corre num lugar só — a view"*. O mesmo vale para a mora: a view
    `negocio.cobranca_derivada` publica `valor_multa`, `valor_juros`, `dias_atraso` e `valor_total`
    **derivados enquanto o fato está aberto**. **Descartada.**
- **A2 — Portar só o que a derivação não absorveu, e declarar por escrito o que morreu** *(escolhida)*.
  - _Exemplo:_ o inventário da fatia passa a ter **quatro** rotinas — régua, encerramento de
    contratos, conferência bancária e reconferência da entrega —, e a spec **declara** que
    `marcar_cobrancas_vencidas` e `atualizar_atrasos_cobrancas` não têm sucessora porque a ADR-0022 as
    eliminou por construção.
  - _Viabilidade:_ reusa tudo. **Sem a declaração explícita, a fatia seguinte reabre o assunto** — é
    exatamente a regressão R3 do Protocolo Antirregressão (decisão desfeita por quem não sabia que
    houve debate).
- **A3 — Portar as duas mortas como rotina de *conferência de consistência***.
  - _Exemplo:_ rotina diária que compara o que a view deriva com o que uma segunda implementação
    calcularia, e alerta na divergência.
  - _Viabilidade:_ possível, mas cria **a segunda fonte do mesmo fato** que a ADR-0016 e a ADR-0022
    eliminam — e é monitoramento dentro do produto, a mesma objeção que o insumo §5.4 faz à tela do
    operador. **Descartada.**

**Direção escolhida (A1 da autonomia)**: **A2** — porte seletivo com declaração explícita do que
morreu. Razão: A1 contraria ADR ativa (gatilho de parada), e A3 reintroduz a duplicação de derivação
que a F3 pagou para eliminar.

#### O caso que **não** é agendamento: o encerramento de contrato

⚠️ **O §4 do insumo afirma que *"a fatia é agendamento, não processamento"*. Isso é verdadeiro para
três das quatro rotinas, e FALSO para o encerramento.**

Medido em `packages/contracts/src/contrato.ts`, no docblock de `ESTADOS_DO_CONTRATO`:

> *"`ENCERRADO` fica no enum **sem produtor nesta fatia** (a rotina agendada é da F5), no mesmo padrão
> com que a fatia anterior reservou `LOCADO`."*

Confirmado por busca: não existe `encerrarContrato` em `packages/db/src/contrato.ts` — há
`ativarContrato` e `cancelarContrato`, e mais nada. **O trabalho de domínio não existe; só o enum foi
reservado.**

E ele **não é trivial**. O golden `encerrar-contratos-vencidos.json` (caracterização versionada)
mostra que a rotina do legado faz **duas escritas pareadas** e tem **uma regra não óbvia**:

| Contrato | `data_fim` | Imóvel | Estado final | Por quê |
|---|---|---|---|---|
| `CTR-…-01` | −5 dias | `IMOVEL-…-01` | **Encerrado** + imóvel liberado | caso normal |
| `CTR-…-02` | −9 dias | **(vazio)** | **permanece Ativo** | ⚠️ contrato **sem imóvel não é encerrado** |
| `CTR-…-03` | +20 dias | `IMOVEL-…-03` | permanece Ativo | ainda vigente |
| `CTR-…-04` | −30 dias | `IMOVEL-…-04` | já Encerrado | idempotente |

O caso `CTR-…-02` é regra do oráculo que ninguém adivinharia, e o golden a captura.

**Consequência de escopo:** esta fatia constrói **o produtor de `ENCERRADO`** — transição de estado
com efeito no imóvel —, e não apenas o gatilho que o chama. `[HIPÓTESE]` Isso torna a fatia
maior do que o insumo dimensiona, e é o principal argumento da recomendação de framework (seção 15).

#### O sub-ramo que o usuário levantou durante a sessão: **e os Server Scripts do Frappe?**

> *"E os server scripts que eram executados automaticamente pelo Frappe e fazem toda diferença na
> aplicação? Um bom exemplo é o que é disparado quando o contrato é salvo e atribui o imóvel como
> locado."*

**Resposta medida: já foram implementados em fases anteriores, e o backend novo os resolveu por outro
mecanismo — não como hook de salvamento. Sobra exatamente UM, e ele é o encerramento acima.**

Medição no legado (`SELECT … FROM \`tabServer Script\`` + `hooks.py` do app versionado):

- **25 Server Scripts** cadastrados, dos quais **apenas 6 ativos** (`disabled = 0`); 19 desligados.
- Os que faziam o par contrato↔imóvel **via Server Script** — `Ativação do contrato e ativação do
  imóvel`, `Liberação do Imóvel ao Encerrar/Rescindir Contrato`, `Cancelamento em cascata do
  Contrato` — estão **todos desabilitados**: a lógica migrou para o app versionado
  `locacao_automation`.
- O `hooks.py` do app declara **exatamente dois** `doc_events`:
  ```python
  doc_events = {
      "Contrato":  {"on_submit":   "locacao_automation.contrato_ativacao.service.on_submit_contrato"},
      "Locatario": {"before_save": "locacao_automation.locatario_email_confirmacao.service…"},
  }
  ```
  E **nenhum `scheduler_events`** — o que confirma a decisão 26 por medição: o agendador do Frappe já
  foi abandonado em favor do cron do SO.

**Cobertura no backend novo — 5 de 6 entregues:**

| Efeito automático do legado | Fase que entregou | Como o backend novo resolveu |
|---|---|---|
| `Contrato on_submit` → ativa contrato **e marca o imóvel `LOCADO`** | **F2** `contratos-de-locacao` | ✅ **Não é hook**: é **rota própria de transição** (ADR-0021). `ContratoService.ativar` corre **dez etapas na mesma unidade de trabalho** — a etapa 7 é *"marcar o imóvel `LOCADO` pela porta estreita `definirSituacaoDeLocacaoDoImovel`"* e as 8–10 derivam e gravam as N parcelas. Golden `contrato-ativacao.json` |
| Cancelamento em cascata do contrato | **F2** | ✅ `cancelarContrato` + `cancelarCobrancasDoContrato`, mesma transação. Golden `contrato-cancelamento.json` |
| `Locatario before_save` → preparar confirmação de e-mail | **F3** `documentos-e-confirmacao` | ✅ Fila `confirmacao-de-email`, com a confirmação como fato gravado |
| `PDF contrato` (After Save) | **F3** `cobranca-mora-e-documentos` | ✅ `@react-pdf/renderer`, **composto sob demanda e nunca armazenado** (ADR-0030). Goldens `contrato-pdf.txt`, `contrato-pdf-fonte.py` |
| `Cálculo metragem imóvel` (Before Save) | **F2** `cadastro-de-imoveis-e-pessoas` | ✅ **Derivada na leitura**, não gravada por hook: `metragemTotal` é a soma dos cômodos num ponto único. Golden `metragem.json` |
| **Liberação do imóvel ao ENCERRAR** | ❌ **nenhuma** | **É esta fatia** — `ENCERRADO` sem produtor (acima) |

**A diferença de mecanismo é o ponto, e ela é favorável em três sentidos concretos:**

1. **Atomicidade real.** No Frappe, marcar o imóvel era efeito colateral de um `on_submit`; se ele
   falhasse, o contrato ficava submetido e o imóvel não. No backend novo as três escritas
   independentes (estado, imóvel, parcelas) correm no **mesmo `tx`** — o docblock diz por extenso:
   *"qualquer falha depois da etapa 6 desfaz também o `ATIVO`"*.
2. **Salvar deixou de ter efeito colateral.** A ADR-0021 fixa que transição de estado é rota própria;
   `esquemaDeContratoNovo` **não tem campo `status`**, e o `strictObject` recusa quem tentar mandá-lo.
   Editar um contrato não dispara mais nada.
3. **O que era calculado por hook virou derivação.** Metragem, estado da cobrança e mora deixaram de
   ser coluna escrita por gatilho e passaram a ser derivadas na leitura (ADR-0022) — e é por isso que
   **duas rotinas de cron desapareceram sem sucessora**.

---

### Ramo B — O gatilho no sistema operacional

> **Fora de negociação:** o gatilho é **systemd timer com `Persistent=true`**. A decisão 30 original
> dizia *"manter o cron do SO"* e foi **refinada** — o registro está em `plano-execucao.md` §F5(ii):
> *"Gatilho no SO, por systemd timer (decisão 30 refinada)"*. **Não reabrir.**

**Estado medido:** `deploy/systemd/` tem **duas** unidades (`sysloc-api.service`,
`sysloc-worker.service`) e **nenhum timer**.

**Direções candidatas:**

- **B1 — Um timer por rotina, `Persistent=true` só onde ele significa algo** *(escolhida)*.
  - _Exemplo:_ `sysloc-encerramento.timer` (00:02) · `sysloc-conferencia-bancaria.timer` (diário) ·
    `sysloc-regua.timer` (`OnCalendar=*:0/1`). Os diários levam `Persistent=true`; o de minuto **não**
    — "disparar ao voltar" para um minuto perdido não recupera nada, e a régua é idempotente por
    predicado de qualquer forma.
  - _Viabilidade:_ reusa `deploy/systemd/` e o molde dos dois `.service` existentes. Cada rotina ganha
    `OnFailure=` próprio, que é o que a decisão 31 pede — **o alerta sabe qual rotina falhou**.
- **B2 — Um timer único de 1 minuto ("relógio") que despacha tudo**.
  - _Exemplo:_ `sysloc-relogio.timer` chama um despachante que conhece todas as cadências e decide o
    que enfileirar naquele minuto.
  - _Viabilidade:_ menos unidades, mas **perde a garantia que motivou o refinamento**: um timer de 1
    minuto com `Persistent=true` não recupera o disparo diário perdido, e a rotina diária deixaria de
    ter a propriedade pela qual se trocou o cron. Além disso, um `OnFailure=` único não discrimina
    qual rotina quebrou. **Descartada — ela desfaz a razão do refinamento da decisão 30.**
- **B3 — Um timer por rotina, `Persistent=true` em todas**.
  - _Exemplo:_ igual a B1, com `Persistent=true` também no de 1 minuto.
  - _Viabilidade:_ inofensivo (o systemd dispara **uma** vez ao voltar, não N), mas é ruído semântico:
    declara uma garantia que não compra nada. **Adiada** — se o teste de reboot mostrar que a
    uniformidade simplifica o verificador, adota-se.

**Direção escolhida (A1)**: **B1**. Razão: preserva a garantia por rotina (que é o motivo do
refinamento) e dá ao `OnFailure=` a granularidade que o alerta exige.

**Restrição herdada que morde aqui:** ⚠️ **nenhuma das duas unidades systemd declara `TZ`** — está
documentado em `packages/regua/src/janela.ts` e no cabeçalho da tarefa da régua: hoje o fuso acerta
**por acidente** (o host está em `America/Sao_Paulo`). Um timer com `OnCalendar=` usa o fuso do
**sistema**, e a hora do domínio vem do **banco** (ADR-0026). São duas fontes de tempo, e a fatia
precisa declarar qual governa o quê. **`[DÚVIDA 3]`**

---

### Ramo C — A cadência do minuto (o despachante)

**Estado medido, e ele é melhor do que o insumo supõe:**

- A `FILA_DA_REGUA` **não tem produtor nenhum**. As outras cinco filas são criadas e alimentadas por
  `apps/api/src/comum/produtor-de-fila.ts` (ato humano por rota); a régua tem **só o consumidor**
  (`apps/worker/src/tarefas/regua.ts`). **O despachante desta fatia é o produtor que falta** — não é
  otimização, é a peça ausente.
- O desperdício do legado **já não existe** no backend novo: a régua seleciona candidatas por
  predicado no banco (índice parcial `cobranca_aberta_idx`), não varrendo tudo; e a idempotência vem
  do predicado — *"na repetição, as já avisadas caem fora do conjunto porque cada uma tem tentativa
  `ENVIADA` dentro do intervalo mínimo"*.

⚠️ **A premissa da decisão 25 precisa de ajuste, e é o achado deste ramo.** Ela fala em *"quais
empresas têm **horário** configurado para agora"*. Mas o que existe em `negocio.politica_de_aviso` é
uma **janela**: `janela_inicio` / `janela_fim`, com **padrão `00:00`–`23:59`**. Uma empresa no padrão
está "dentro da janela" **1.440 minutos por dia** — o despachante por janela, sozinho, **não reduz
nada**.

**Direções candidatas:**

- **C1 — Enfileirar por minuto para toda empresa dentro da janela** (leitura literal da decisão 25).
  - _Exemplo:_ 1 job/minuto/empresa; com o padrão `00:00`–`23:59` e 10 empresas, **14.400 jobs/dia**,
    quase todos terminando em "nada a fazer".
  - _Viabilidade:_ correto e seguro (a régua é idempotente), mas **reproduz o defeito do legado com
    outro nome** — trabalho inútil a cada disparo. **Descartada.**
- **C2 — Consulta única que já filtra por trabalho existente** *(escolhida)*.
  - _Exemplo:_ o despachante roda **uma** consulta por minuto que devolve as empresas que, ao mesmo
    tempo, (a) estão dentro da janela, (b) têm política ativa e (c) **têm ao menos uma candidata a
    aviso** — e enfileira só essas. Empresa sem candidata não gera job, e o dia silencioso custa uma
    consulta indexada por minuto, não N jobs.
  - _Viabilidade:_ reusa o predicado que a régua já tem; o que muda é **onde** ele corre — no
    despachante, para decidir se vale enfileirar. `[HIPÓTESE]` A consulta é barata porque alcança o
    índice parcial já existente.
- **C3 — Uma passagem por empresa por dia, no início da janela**.
  - _Exemplo:_ às `janela_inicio` de cada empresa, um job só, que percorre todas as candidatas.
  - _Viabilidade:_ o mais econômico, mas **perde a semântica da janela**: quem configura
    `08:00`–`18:00` quer que o aviso saia *dentro* do horário comercial, e a cobrança que se torna
    avisável às 14:00 esperaria o dia seguinte. **Adiada** — vira alternativa se C2 medir caro.

**Direção escolhida (A1)**: **C2**. Razão: é a única que cumpre a **intenção** da decisão 25
(*"corrige o desperdício já existente e escala"*) dado que o campo real é intervalo, não horário
pontual — e preserva a semântica da janela, que C3 sacrifica.

---

### Ramo D — Quem observa: saúde, alerta e histórico

> **Recomendação do insumo (§5.4), acatada:** a tela é **por tenant, no app de locação**; **nenhuma
> tela nova no painel do operador**. O argumento que decide é o **isolamento** — o histórico de
> execução é tenantizado (decisão 28), tem dono-empresa e vive sob RLS; o operador do SaaS não o
> alcança por invariante. Uma tela dele **violaria o isolamento** ou mostraria agregado anônimo que
> não diz a ninguém o que fazer. **O argumento não foi derrubado, e não se diverge dele.**

⚠️ **Colisão de nome a evitar:** já existe `apps/api/src/saude/` com `@Controller('saude')`,
`@Get()` e `@Get('pronto')`, **`@RotaPublica()`** — é liveness/readiness de **infraestrutura**, sem
sessão. A saúde **das rotinas** é dado de negócio, por empresa, **com sessão**. Mesma palavra,
naturezas opostas: a rota nova **não** entra sob `/saude`. `[HIPÓTESE]` Ela pertence à área de
automação (`CAMINHO_DA_AUTOMACAO_DE_COBRANCA`) ou a uma área própria de rotinas.

**Direções candidatas — a rota:**

- **D1 — Uma rota de leitura: estado atual das rotinas da empresa + histórico recente** *(escolhida)*.
  - _Exemplo:_ `GET …/rotinas` devolvendo, por rotina, a última execução, o desfecho, a próxima
    esperada e as falhas recentes.
  - _Viabilidade:_ leitura tenantizada, cabe no isolamento sem exceção; segue o molde de leitura das
    áreas existentes. **⚠️ É a última janela para publicá-la** (ver o risco de escopo, seção 12).
- **D2 — Duas rotas (estado corrente e histórico paginado, separados)**.
  - _Exemplo:_ `GET …/rotinas` + `GET …/rotinas/{rotina}/execucoes`.
  - _Viabilidade:_ mais limpo para paginar, mas **duas rotas a congelar** onde uma resolve a tela que
    a decisão 31 descreve (*"última execução, próxima esperada, falhas recentes"*). **Adiada para a
    tech spec** — se a tela precisar de paginação real, D2 é o caminho, e a decisão precisa ser
    tomada **antes** do congelamento, não depois.
- **D3 — Nenhuma rota; só journal e `OnFailure=`**.
  - _Viabilidade:_ **contraria a decisão 31** e deixa o Admin sem resposta para *"o aviso saiu?"*.
    Descartada.

**Direções candidatas — o canal do alerta:**

- **D4 — Dois canais por natureza do problema** *(escolhida)*.
  - _Exemplo:_ **timer parado / processo caído / falha de execução** → `OnFailure=` e journal, para o
    **operador** (é infraestrutura, e a §5.4 já decide que não vira tela). **Certificado vencido /
    identidade ausente / webhook desabilitado / e-mail rejeitado** → **estado na tela do Admin**, que
    é quem age.
  - _Viabilidade:_ reusa o `OnFailure=` que o systemd dá de graça e a rota de D1. **Fecha o furo que o
    insumo §5.7 aponta**: alerta de rotina parada por e-mail depende do e-mail funcionar — e o
    e-mail pode ser justamente o que quebrou. O journal não tem essa dependência.
- **D5 — E-mail ao Admin para tudo**.
  - _Viabilidade:_ tem o furo circular acima, e transforma problema de infraestrutura em ruído para
    quem não pode agir sobre ele. Descartada.

**Direções candidatas — o histórico:**

- **D6 — Registrar só quando houve trabalho, com expurgo por idade** *(escolhida — decisão 28)*.
  - _Exemplo:_ passagem que não avisou ninguém **não gera linha**; passagem que enviou 3 avisos gera
    uma linha com o desfecho. Expurgo automático por idade.
  - _Viabilidade:_ há precedente direto — `envio_de_cobranca` já registra desfecho por tentativa
    (`ENVIADA` / `FALHOU` / `SEM_DESTINATARIO`), e os índices `*_historico_idx` do esquema seguem o
    molde `(empresa_id, criado_em DESC)`. ⚠️ **Vocabulário do produto**, não de operação: quem lê é
    o Admin (respondendo ao insumo §5.6).
  - ⚠️ **A tabela é tenantizada** — nasce com `empresa_id`, RLS e FK composta (invariante 1). **Não é
    caso da ADR-0031** (schema `plataforma` sem dono-empresa): esta tem dono.

**Direções candidatas — "rotina atrasada":**

- **D7 — Limiar por rotina, derivado da própria cadência** *(escolhida)*.
  - _Exemplo:_ a diária das 00:02 está atrasada se não executou em ~26h; a de minuto, se não executou
    em ~15 min. Uma régua só (ex.: "24h para tudo") **não pega** a régua parada — ela roda 1.440×/dia,
    e 24h de silêncio já é catástrofe.
  - _Viabilidade:_ o limiar sai da declaração do timer, não de um número mágico à parte.

---

### Ramo E — Suspensão e reativação

> **Fora de negociação (decisões 27, 29, 37):** suspensão **congela tudo**; reativação **põe em dia**
> sem disparar retroativo; a régua **não** reenvia avisos antigos; notícia bancária recebida durante
> a suspensão é **registrada e aplicada na reativação**.

**Estado medido:** o substrato existe. `packages/db/src/esquema/plataforma.ts` já declara a partição
com o motivo *"a empresa da cobrança está suspensa; PENDENTE até a reativação — não é definitivo"*, e
`empresa.service.ts:541` já reenfileira as notícias retidas na reativação. **A F4 entregou a metade
bancária da decisão 37.**

**Direções candidatas:**

- **E1 — "Pôr em dia" = rodar uma vez as rotinas de estado idempotentes** *(escolhida — decisão 27)*.
  - _Exemplo:_ ao reativar, dispara-se **uma** passagem do encerramento de contratos e **uma** da
    conferência bancária. Não se reprocessa dia a dia o período suspenso.
  - _Viabilidade:_ a decisão 27 registra que isso é *"mais barato do que se supôs"* porque as rotinas
    de estado são idempotentes por natureza. ⚠️ **Metade da premissa mudou**: das três rotinas de
    estado que a decisão 27 citava, **duas deixaram de existir** (ADR-0022) — a derivação está sempre
    em dia sozinha, suspensão ou não. Sobra **uma**: o encerramento. A decisão continua correta e
    ficou **mais barata ainda**.
- **E2 — Não rodar nada; só retomar o ciclo**.
  - _Exemplo:_ contratos vencidos durante a suspensão só encerram no próximo 00:02.
  - _Viabilidade:_ atraso de até 24h no encerramento e na liberação do imóvel — o imóvel fica `LOCADO`
    sem contrato vigente por um dia. **Descartada**, mas é o *fallback* se E1 medir caro.
- **E3 — Reprocessar dia a dia o período suspenso**.
  - _Viabilidade:_ **descartada pela decisão 27**, e sem ganho: as rotinas são idempotentes, então N
    passagens têm o mesmo efeito de uma.

**Direção escolhida (A1)**: **E1**, com a premissa corrigida (uma rotina de estado, não três).

---

## 5. Problema

O backend novo tem **todo o trabalho de fundo pronto e nenhum gatilho automático**. Medido: existem
seis filas e um processo de trabalho com unidade systemd, mas **zero timers** — cinco das seis filas
só são alimentadas por ato humano em rota, e a sexta (a régua) **não tem produtor nenhum**.

Enquanto isso, o que roda sozinho roda no Frappe, com três defeitos medidos:

1. **Pula o dia em silêncio** quando a máquina está fora do ar na hora marcada (o cron não recupera).
2. **Varre trabalho que não existe** — a rotina de 1 minuto percorre todas as cobranças abertas em
   1.438 dos 1.440 minutos do dia, e grava na configuração a cada execução: **12 MB de log**.
3. **Não avisa quando para.** A descoberta é pelo efeito — alguém repara que o e-mail não saiu.

E há um quarto, que só a medição desta sessão revelou: **uma das rotinas não tem sucessora no backend
novo.** O `ENCERRADO` do contrato está reservado no enum **sem produtor**, o que significa que hoje,
no backend novo, **contrato vencido não encerra e imóvel não é liberado**.

---

## 6. Objetivo Principal

Que **todo trabalho automático do produto dispare sozinho, por empresa, com falha isolada, e que
alguém saiba quando ele para** — de modo que o Frappe possa ser desligado sem que nada deixe de
acontecer, e sem que a máquina fora do ar às 00:02 custe um dia de encerramentos.

---

## 7. Público / Usuário Envolvido

| Persona | O que ela ganha | Onde |
|---|---|---|
| **Admin da imobiliária** | ver se as rotinas da empresa dela rodaram, quando, e com que desfecho; configurar a janela de aviso | tela nova (rota nova desta fatia) |
| **Operador do SaaS** | ser avisado quando um timer para ou um processo cai | `OnFailure=` + journal — **sem tela nova** |
| **Locatário** | continuar recebendo o aviso de cobrança no horário que a imobiliária escolheu — e **não** receber enxurrada retroativa após uma suspensão | e-mail |
| **Locador** | ter o imóvel liberado quando o contrato vence, sem intervenção | efeito do encerramento |

---

## 8. Escopo Inicial (resultado da convergência)

- [ ] **Timers versionados em `deploy/systemd/`**, um por rotina, com `Persistent=true` nas diárias e
      `OnFailure=` próprio; instalados por script **idempotente** (B1)
- [ ] **Despachante da régua** — o produtor ausente da `FILA_DA_REGUA`: uma consulta por minuto que
      filtra janela **e** existência de trabalho, e enfileira só quem tem o que fazer (C2)
- [ ] **Encerramento de contratos vencidos** — ⚠️ **trabalho de domínio novo**: o produtor de
      `ENCERRADO`, com liberação do imóvel na mesma unidade de trabalho, portando as regras do golden
      (inclusive o caso do contrato sem imóvel) (A2)
- [ ] **Conferência bancária diária agendada** — a tarefa existe e é *"a rotina diária mais
      importante da F5"*; falta o timer que a dispara por empresa ativa
- [ ] **Um job por empresa ativa, falha isolada, lock por (empresa, rotina)**
- [ ] **Registro de execução tenantizado**, gravado **só quando houve trabalho**, com expurgo por
      idade e vocabulário do produto (D6)
- [ ] **Rota de estado e histórico das rotinas da empresa** — ⚠️ **última janela antes do
      congelamento** (D1)
- [ ] **Vigilância em dois canais**: infraestrutura pelo `OnFailure=`/journal, configuração pela tela
      do Admin; limiar de "atrasada" derivado da cadência de cada rotina (D4, D7)
- [ ] **Alerta de falha de envio de e-mail** por limite do provedor (decisão 34) — substrato pronto:
      `DESFECHOS_DO_AVISO` já tem `FALHOU`
- [ ] **Reativação põe em dia**: uma passagem das rotinas de estado idempotentes; régua **sem**
      retroativo (E1)
- [ ] **Declaração explícita** de que `marcar_cobrancas_vencidas` e `atualizar_atrasos_cobrancas`
      **não têm sucessora** — absorvidas pela derivação da ADR-0022 (A2)
- [ ] **Timer novo entra na prova de reboot** (invariante 7)

---

## 9. Fora do Escopo (podado / adiado)

- **Portar `marcar_cobrancas_vencidas` e `atualizar_atrasos_cobrancas`** — _contrariam a ADR-0022; o
  estado e a mora são derivados na view `negocio.cobranca_derivada`_
- **Rotina de conferência de consistência da derivação** (A3) — _cria a segunda fonte do mesmo fato
  que a ADR-0016 elimina; é monitoramento dentro do produto_
- **Tela de saúde no Painel Master** — _o histórico é tenantizado; o operador não o alcança por
  invariante (insumo §5.4, não derrubado)_
- **Timer único "relógio"** (B2) — _desfaz a garantia por rotina que motivou o refinamento da
  decisão 30_
- **Alerta por e-mail para falha de infraestrutura** (D5) — _dependência circular: o e-mail pode ser
  o que quebrou_
- **Reprocessar dia a dia o período suspenso** (E3) — _descartado pela decisão 27; sem ganho, pois as
  rotinas são idempotentes_
- **Qualquer tela React** — _`[fora do escopo do projeto]`: a Fronteira do `CLAUDE.md` é gatilho de
  parada. A fatia entrega a **rota**; a tela é F6, na máquina local_
- **Adiado:** `Persistent=true` uniforme em todos os timers (B3) · rota de histórico separada e
  paginada (D2) — ⚠️ **se D2 for necessária, decida ANTES do congelamento** · passagem única diária
  no início da janela (C3), se C2 medir caro · expurgo dos boletos guardados (débito **D26 · F4/T9**,
  cujo gatilho é "a F5, que traz o agendamento")

---

## 10. Ancoramento no Projeto (guarda de escopo)

- **O que o projeto É** (`CLAUDE.md`): SaaS multiempresa de gestão de locação, backend
  Node/NestJS/PostgreSQL nativo, substituindo o Frappe de `/opt/frappe`. **Backend apenas** — nenhum
  código React. Multi-tenancy imposta pelo banco (RLS + FK composta), contexto nunca lido do request.

- **Specs consultadas** (`/docs/specs/**` + `/docs/prds/**`):
  - `caracterizacao-regras-legadas/v1` — **10 goldens versionados**; três interessam diretamente:
    `encerrar-contratos-vencidos.json` (a regra a portar), `marcar-cobrancas-vencidas.json` e
    `atualizar-atrasos-cobrancas.json` (**as duas absorvidas pela derivação**)
  - `contratos-de-locacao` (F2) — entregou `ativarContrato`/`cancelarContrato` e o par contrato↔imóvel
  - `regua-de-cobranca` (F3) — entregou a régua **e o consumidor**; o produtor é esta fatia
  - `emissao-e-conciliacao` / `webhook-e-carne` (F4) — conferência bancária e notícia bancária
  - `integracao-bancaria-autonoma/v1` (F5-i) — **`completed`, 10/10 tasks**; pré-condição atendida
  - **Nenhuma feature existente duplica esta.** `automacoes-agendadas/v1` continha só o insumo

- **Capacidades reutilizáveis** (para viabilidade, não desenho):
  - **Filas**: 6 filas em `@sysloc/shared` + `apps/worker/` com unidade systemd; contexto de empresa
    pela carga (ADR-0024)
  - **Persistência**: Drizzle + RLS; molde de índice `(empresa_id, criado_em DESC)` já usado por
    cinco tabelas de histórico
  - **Tempo**: hora e data da operação vêm **do banco** (ADR-0026), nunca do relógio do processo
  - **Régua**: janela por empresa em `politica_de_aviso`; desfechos `ENVIADA`/`FALHOU`/`SEM_DESTINATARIO`
  - **Suspensão**: partição de retidas e reenfileiramento na reativação já entregues (F4)
  - **systemd**: dois `.service` como molde; **nenhum `.timer`**

- **Conflitos / sobreposições detectados**:
  1. ⚠️ **ADR-0022 × duas rotinas do legado** — resolvido: elas não se portam (Ramo A)
  2. ⚠️ **Colisão de nome `saude`** — `@Controller('saude')` existe e é **público**, de
     infraestrutura; a saúde das rotinas é de negócio e com sessão (Ramo D)
  3. ✅ **ADR-0021 × transição sem ator humano** — **RESOLVIDO em 2026-08-22 por emenda à ADR-0021**
     (`[DÚVIDA 1]`). Não havia contradição com a `Decision`; havia lacuna de registro. A emenda
     declara o alcance de cada metade e nomeia a terceira classe de ato, com o encerramento como
     instância declarada. **Leia a emenda antes de citar a `Decision`**
  4. ⚠️ **Débito `D44 · F2/T10`** — o gatilho dele é *"a fatia que criar no banco a restrição pareando
     `contrato.status='ATIVO'` com `imovel.status_locacao`"*. Esta fatia cria o **terceiro** escritor
     desse par; **`[DÚVIDA 2]`**
  5. ⚠️ **Débito `D26 · F4/T9`** — gatilho literal *"a F5, que traz o agendamento"*: expurgo dos
     boletos guardados (~1,4 GB/mês). **Disparou.** Adiado no escopo, mas precisa de decisão
  6. ⚠️ **Débito `D13 · F4/T6` (`webhook-e-carne`)** — gatilho *"a F5, que traz o agendamento"*:
     notícia parada em `RECEBIDO` não tem quem a reprocesse. **Disparou**
  7. **Roadmap desatualizado** — o bloco `<!-- ESTADO:F5 -->` diz *"não iniciada"* e marca a (i) como
     `⬜`, mas o `*state.yaml` dela diz `completed` 10/10. É o gancho gerador, não escopo desta
     fatia — registrado como nota

---

## 11. Premissas e Decisões já tomadas

**Premissas:**

- `[HIPÓTESE]` A consulta do despachante (C2) alcança o índice parcial `cobranca_aberta_idx` e é
  barata o bastante para rodar a cada minuto — **medir antes de fixar a cadência**
- ~~`[HIPÓTESE]` O encerramento automático cabe no molde da conferência bancária~~ — ✅ **verificada e
  parcialmente REFUTADA em 2026-08-22.** A conclusão (o encerramento é conforme) confirmou-se, mas
  **pelo molde errado**: a conferência bancária grava **fato**, e o estado da cobrança é derivado
  (ADR-0022) — ela não transita estado. O molde correto é a **porta estreita** da F2. Ver a `[DÚVIDA
  1]` resolvida e a emenda de 2026-08-22 à ADR-0021
- `[HIPÓTESE]` A rota nova pertence à área de automação, e não a `/saude` nem a uma área própria
- `[HIPÓTESE]` Uma rota só (D1) atende a tela da decisão 31; se a tela exigir paginação real,
  D2 vira necessária **e precisa entrar antes do congelamento**
- `[HIPÓTESE]` O expurgo do histórico é por **idade**, e o prazo é decisão de produto ainda não tomada

**Decisões já tomadas (fora de negociação):**

- **O gatilho é systemd timer com `Persistent=true`** — decisão 30 **refinada**, registrada em
  `plano-execucao.md` §F5(ii). *"Não reabra 'cron ou timer': está decidido, e a razão é medida."*
- **Timers versionados no repositório, instalados por script idempotente** — rodar duas vezes não
  duplica entrada
- **Despachante por horário** — uma consulta barata por minuto substitui a varredura geral (decisão 25)
- **Um job por empresa ativa, com falha isolada e lock por (empresa, rotina)** (decisão 27/28)
- **Histórico gravado só quando houve trabalho, com expurgo automático** (decisão 28)
- **Suspensão congela tudo; reativação põe em dia — sem disparar nada retroativo** (decisão 27)
- **Régua não reenvia retroativo na reativação** (decisão 29)
- **`OnFailure=` alimenta o alerta** (decisão 31)
- **A tela de saúde é por tenant, no app de locação; nenhuma tela nova no painel do operador** —
  insumo §5.4, sustentado pelo argumento do isolamento
- **Esta é a última fatia que publica rota** — o congelamento da superfície é logo depois da F5
- **Este projeto roda exclusivamente em Opus**, e tudo é em português brasileiro
- **Nenhum código de frontend** — a Fronteira do `CLAUDE.md` é gatilho de parada

---

## 12. Riscos e Pontos de Atenção

- **Risco de escopo — o maior desta fatia**: o insumo dimensiona *"agendamento, não processamento"*, e
  a medição mostra que **o encerramento de contratos é domínio novo** (produtor de `ENCERRADO` +
  liberação do imóvel + regras do golden). → _mitigação:_ dimensionar a fatia com esse trabalho
  **dentro**, e escolher o framework por essa amplitude (seção 15) — não pelo rótulo "porte".

- **Risco de superfície — irreversível**: a rota da tela de saúde é **a última janela antes do
  congelamento** (item 2 do marco de entrega). Publicar uma rota insuficiente é dívida que o handoff
  do frontend carrega **sem chance de correção**. → _mitigação:_ decidir D1 vs D2 **na tech spec**,
  contra a tela que a decisão 31 descreve, e declarar a §5.2 conforme
  `.claude/rules/ancoras-de-superficie.md` — a superfície medida hoje é **105 rotas / 90
  manipuladores**, e as três constantes executáveis sobem no mesmo diff.

- **Risco técnico — duas fontes de tempo**: o timer usa o fuso do **sistema** (`OnCalendar=`); o
  domínio usa o **banco** (ADR-0026); e **nenhuma unidade systemd declara `TZ`** — hoje acerta por
  acidente. Uma rotina disparada às 00:02 do sistema que consulta "hoje" do banco pode divergir na
  virada do dia. → _mitigação:_ declarar qual fonte governa o quê, e cobrir por asserção estática, no
  molde do `CT-612`.

- **Risco de regressão (R3)**: as duas rotinas que morreram por design são convite permanente a
  "corrigir a lacuna". → _mitigação:_ marcador **`DECISÃO FECHADA`** no ponto do código, com
  `REVERTER EXIGE` referenciando a ADR-0022 — é a única rede que sobrevive ao fim da fatia.

- **Risco operacional — `Persistent=true` na volta**: a máquina fora do ar por dias dispara os timers
  acumulados **ao voltar, todos de uma vez**. Com `n` empresas × `m` rotinas, é um pico. → _mitigação:_
  a fila absorve por natureza (concorrência controlada), mas o **lock por (empresa, rotina)** precisa
  cobrir também esse caso, e a régua **não** pode enviar retroativo (decisão 29).

- **Risco de privacidade/segurança**: o histórico de execução pode carregar diagnóstico de terceiro
  (provedor bancário). → _mitigação:_ vale a ADR-0034 (diagnóstico do provedor é registrado como tal)
  e a redação de segredo de `@sysloc/shared`; a tela do Admin fala **vocabulário do produto**.

- **Risco de produto**: uma tela de saúde que ninguém abre não previne nada. → _mitigação:_ o alerta
  é o mecanismo ativo; a tela é a resposta ao *"por que o aviso não saiu?"*. **A tela não substitui o
  alerta**, e o alerta não substitui a tela.

---

## 13. Dúvidas em Aberto

1. ~~**A ADR-0021 alcança transição de estado sem ator humano?**~~ ✅ **RESOLVIDA em 2026-08-22, por
   emenda à ADR-0021.**

   **Veredito: não há contradição com a `Decision`** — há lacuna de registro, e ela foi fechada.
   Lida no texto literal, a `Decision` tem duas metades com alcances diferentes:
   - a **categórica** (*"rota própria, nunca um campo gravado por atualização parcial do recurso"*)
     **vale sem exceção**, e o encerramento a cumpre **por construção**: não há recurso sendo
     editado, e `status` não existe nos esquemas de entrada do contrato — o `strictObject` o recusa;
   - a da **governança** (*"exige a chave, ou exige apenas a área"*) **pressupõe uma sessão a
     autorizar**. Sem requisição a pergunta não fica sem resposta: fica **sem antecedente**. O que
     governa a transição sem ator é a **procedência da carga** (ADR-0024).

   **O precedente decisivo é da própria F2**, e não da conferência bancária como eu supus: o docblock
   de `definirSituacaoDeLocacaoDoImovel` enumera os chamadores como *"a ativação e o cancelamento de
   contrato … e a rota de situação de locação"* — a transição `DISPONIVEL → LOCADO` **já ocorre sem
   passar pela rota própria dela**, como efeito interno na mesma unidade de trabalho, e assim passou
   pelos dois gates. ⚠️ **A conferência bancária NÃO é precedente**: pela ADR-0022 o estado da cobrança
   é derivado, então ela grava **fato**, não transição. Todos os demais casos de escrita sem ator
   (`concluirLote`, `concluirConferencia`) são de **registro de processo**. O encerramento é o
   **primeiro caso do repositório** de transição de estado de **entidade de negócio** sem ator.

   **Registro:** emenda de 2026-08-22 à ADR-0021, texto original preservado byte a byte (39
   inserções, 0 remoções, provado por diff). Ela declara o alcance por metade e nomeia a **terceira
   classe** de ato — a que não tem governança a exigir porque não tem ator —, com o encerramento como
   instância declarada. ⚠️ **A emenda alcança só o ato AUTOMÁTICO**: um encerramento **manual pela
   tela** transferiria direito, seria de primeira classe, e não tem chave no catálogo fechado da
   ADR-0011 — o mesmo dilema que a 0021 nasceu para resolver. **Essa decisão não está tomada.**

2. **`[DÚVIDA]` O débito `D44 · F2/T10` fecha aqui?** Ele agenda a restrição de banco pareando
   `contrato.status='ATIVO'` com `imovel.status_locacao`, e o gatilho é *"a fatia que criar no banco a
   restrição"*. Esta fatia cria o **terceiro** escritor do par (ativação, cancelamento, encerramento)
   — o momento em que a guarda de aplicação fica mais frágil. Fecha nesta fatia, ou registra-se o
   agravamento e adia? _Recomendação: avaliar na tech spec, com a medição do custo da restrição._

3. **`[DÚVIDA]` Qual fonte de tempo governa o disparo?** O `OnCalendar=` do systemd usa o fuso do
   sistema; o domínio usa o banco (ADR-0026); nenhuma unidade declara `TZ`. Declara-se `TZ` nas
   unidades, ou o timer dispara "cedo o suficiente" e a rotina decide pela data do banco?

4. **`[DÚVIDA]` Por quanto tempo o histórico de execução é retido?** A decisão 28 diz "expurgo
   automático" sem prazo. É decisão de produto (o Admin quer ver quanto para trás?).

5. **`[DÚVIDA]` A emissão em lote é agendada?** (insumo §5.1) Hoje é ato do Admin
   (`POST …/emissoes`). Vira rotina mensal por empresa, ou permanece sob controle humano? _Leitura:
   permanece humana — emitir boleto é uma das 7 ações sensíveis (decisão 38), e automatizá-la muda a
   natureza do ato. Confirmar._

6. **`[DÚVIDA]` A reconferência da entrega entra no agendamento?** Ela tem fila e é disparada hoje
   por rota (`certificado.controller.ts:400`). Uma reconferência periódica pegaria a entrega que o
   provedor desabilitou por conta própria — mas ninguém pediu.

7. **`[DÚVIDA]` Os débitos `D26 · F4/T9` e `D13 · F4/T6` (`webhook-e-carne`) entram nesta fatia?**
   Os dois têm como gatilho literal *"a F5, que traz o agendamento"*, e **ambos dispararam**. O
   primeiro é expurgo dos boletos guardados (~1,4 GB/mês, sem expurgo hoje); o segundo é notícia
   parada em `RECEBIDO` sem quem a reprocesse — e o segundo é **exatamente uma rotina agendada**.

> ⚠️ **A dúvida 1 era a bloqueante, e foi resolvida em 2026-08-22** — o conflito com ADR ativa não
> existia na `Decision` literal; o que faltava era registro, e a emenda o fez. **Resta a 2** (fecho de
> débito com gatilho disparado), decidível dentro do pipeline com a medição do custo da restrição. As
> demais são resolvíveis na tech spec. A dúvida **7** amplia escopo se a resposta for "sim".

---

## 14. Síntese do Brainstorm

- **Absorvido no escopo inicial (seção 8)**: A2 (porte seletivo + declaração do que morreu, e o
  encerramento como domínio novo) · B1 (um timer por rotina, `Persistent=true` nas diárias) · C2
  (despachante que filtra janela **e** trabalho existente) · D1 + D4 + D6 + D7 (uma rota de leitura,
  dois canais de alerta por natureza, histórico só com trabalho, limiar derivado da cadência) · E1
  (reativação roda uma passagem das idempotentes).

- **Descartado com justificativa**: A1 (contraria ADR-0022) · A3 (segunda fonte do mesmo fato) · B2
  (timer único desfaz a garantia do refinamento da decisão 30) · D3 (contraria a decisão 31) · D5
  (alerta por e-mail tem dependência circular) · E3 (descartado pela decisão 27, e sem ganho) · tela
  de saúde no Painel Master (isolamento) · qualquer código React (Fronteira).

- **Adiado**: B3 (`Persistent` uniforme) · D2 (rota de histórico separada — ⚠️ **decidir antes do
  congelamento**) · C3 (passagem única no início da janela, se C2 medir caro) · expurgo dos boletos
  (`D26 · F4/T9`).

- **Provocações que mudaram o rumo:**
  1. *"Não confie no crontab documentado — leia o agendador."* O `journalctl` provou **00:10**, e o
     `1 0 * * *` de um dos levantamentos estava errado. Resolveu uma dúvida aberta desde o
     pré-refinamento original, marcada *"necessário antes da F5"*.
  2. *"Quantas das quatro rotinas ainda têm razão de existir?"* — **duas morreram por design**
     (ADR-0022). O inventário herdado não é o inventário real, e sem essa checagem a fatia teria
     construído código que contraria ADR ativa.
  3. *"Se o trabalho já existe, quem o enfileira?"* — a `FILA_DA_REGUA` **não tem produtor**. O
     despachante deixou de ser otimização e virou a peça ausente.
  4. *"A janela é um horário ou um intervalo?"* — é intervalo, com padrão `00:00`–`23:59`. A premissa
     literal da decisão 25 **não reduz nada**, e C2 nasceu daí.
  5. **A pergunta do usuário durante a sessão** — *"e os Server Scripts do Frappe?"* — forçou a
     medição dos 25 Server Scripts e do `hooks.py`. Resultado: **cinco dos seis efeitos automáticos já
     foram entregues** (F2/F3), por mecanismo melhor (rota própria com transação única, e derivação na
     leitura em lugar de hook), e o **único que falta é justamente o encerramento** — o que **confirmou
     por um segundo caminho independente** o achado do Ramo A e transformou a fatia de "só
     agendamento" em "agendamento + um pedaço de domínio".

---

## 15. Recomendação de Framework

### 15.1 Complexidade Observada

| Dimensão | Valor detectado | Confirmação |
|---|---|---|
| Amplitude — # rumos/US que sobreviveram | **4+** (11 itens no escopo inicial, em 5 ramos) | inferido |
| Personas | **múltiplas** — Admin da imobiliária, operador do SaaS, locatário, locador | inferido |
| Novidade | **incremento com um núcleo greenfield** — o produtor de `ENCERRADO` não existe | **confirmado por medição** |
| Decisão arquitetural transversal nova? | **sim — 1, já registrada**: o alcance da ADR-0021 sobre transição sem ator humano, fechado por **emenda de 2026-08-22** | **confirmado** |

### 15.2 Framework Recomendado

**Escolhido**: `SDD`

**Justificativa:** as duas dimensões decisivas são **amplitude** e **personas**. Onze itens de escopo
distribuídos em cinco ramos ortogonais (gatilho, cadência, domínio, observabilidade, ciclo de vida do
tenant) passam de `4+`, e a feature tem **quatro** públicos com necessidades distintas — o Admin que
consulta, o operador que é alertado, o locatário que recebe (ou deixa de receber) o aviso, e o locador
cujo imóvel é liberado. Somam-se dois sinais SDD independentes: o **núcleo greenfield** (o produtor de
`ENCERRADO`, com liberação do imóvel e as regras do golden, que não existe em nenhuma forma) e a
**candidata a ADR** da `[DÚVIDA 1]`. Pela tabela de decisão, qualquer um desses sozinho já venceria o
desempate.

⚠️ **Isto DIVERGE do `plano-execucao.md` §F5(ii)**, que indica miniSpec sob o argumento *"porte com
CA claros; o gatilho já está decidido"*. O insumo §7 autoriza divergir **com razão**, e a razão é
medida: **a premissa do porte é falsa em dois pontos**. Duas das quatro rotinas não se portam
(ADR-0022 as eliminou), e uma delas **não tem o que portar** — `ENCERRADO` está reservado no enum sem
produtor, e a regra a construir vem do golden, não de código existente. *"O gatilho está decidido" é
verdade e continua sendo* — o que não estava dimensionado é **o que o gatilho dispara**.

**Precedente do projeto (ancoramento):** as **12 fatias de construção deste backend rodaram todas em
SDD** — `docs/prds/features/` tem 12 PRDs, e toda fatia em `docs/specs/features/*/v1/` tem
`tech_spec.md` + `task_plan.md` + `tasks/`. O miniSpec só aparece em variantes `-debits` e no
repositório Frappe antigo. Recomendar SDD **mantém a fatia no molde da casa**; recomendar miniSpec
seria a exceção que precisaria de justificativa.

### 15.3 Alternativas Consideradas

**Por que NÃO miniSpec** (vizinho mais próximo, e o que o plano indicava): ele comporta `2-3` rumos
sem decisão arquitetural transversal nova — e aqui há **cinco ramos**, **quatro personas** e uma
`[DÚVIDA]` que pode virar emenda de ADR. O ponto decisivo, porém, é outro: o miniSpec não tem PRD, e
sem PRD **não há onde a divergência do inventário ficar registrada**. As duas rotinas que morreram por
design precisam de um artefato que declare *por que* não se portam; sem ele, a próxima fatia lê o
`plano-execucao.md`, conta quatro rotinas, encontra duas e "corrige a lacuna" — que é a regressão R3
que o Protocolo Antirregressão nomeia como a mais cara. Além disso, a **rota irreversível** (última
antes do congelamento) merece a passagem de PRD → tech spec, e não uma spec de escopo.

**Por que NÃO TaskCard** (vizinho mais distante): sub-dimensionado por larga margem. O escopo
atravessa `deploy/systemd/`, `apps/worker/`, `apps/api/`, `packages/db/`, `packages/contracts/` e
`packages/regua/` — seis pacotes —, publica rota nova e constrói domínio novo. TaskCard é para ajuste
pontual sem decisão arquitetural, o oposto disto.

### 15.4 Próximo Passo

✅ **Passo 1 concluído em 2026-08-22** — a `[DÚVIDA 1]` foi resolvida e registrada por **emenda à
ADR-0021** (não por ADR nova: a decisão é a mesma, e ADR nova com decisão igual é churn). O caminho
está livre.

```bash
/agent-spec-sdd-generate-prd "automacoes agendadas: gatilho por systemd timer, despachante por empresa, encerramento de contratos vencidos, e vigilancia das rotinas"
```

⚠️ **O PRD e a tech spec devem citar a ADR-0021 pela EMENDA de 2026-08-22**, nunca só pela
`Decision` — e a terceira classe de ato que ela declara é o fundamento do encerramento automático.

### 15.5 Quando Reconsiderar a Recomendação

- **Upgrade** — não há acima de SDD. Se emergirem **duas ou mais** ADRs novas, ou se a `[DÚVIDA 7]`
  trouxer os dois débitos da F4 para dentro, considere **partir a fatia em duas** (o agendamento e o
  encerramento de contratos), como a F5 já foi partida.
- **Downgrade para miniSpec** — ⚠️ **a condição (a) já se cumpriu**: a `[DÚVIDA 1]` resolveu-se por
  emenda, sem ADR nova, o que **retira um dos quatro sinais SDD**. Restam três (`4+` rumos, múltiplas
  personas, núcleo greenfield), e **qualquer um sozinho já decide** — o downgrade continua exigindo a
  condição (b): que o encerramento de contratos saia desta fatia para uma própria, reduzindo esta a
  agendamento puro, que é o que o `plano-execucao.md` supunha. **Enquanto o encerramento estiver
  dentro, SDD.**
- **Downgrade para TaskCard**: não se aplica em nenhuma leitura.
