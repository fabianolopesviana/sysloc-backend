# Briefing de pré-refinamento — F3 · Cobrança, mora e documentos

> **Entrada para `/agent-spec-pre-refinement`.** Este documento não é a spec: é o material de
> ancoragem para o brainstorm de produto. Ele reúne o que a fase é, o terreno que encontra pronto, o
> que as fases anteriores **já fecharam e não se reabre**, e — o que mais importa — **as tensões
> reais que o pré-refinamento precisa explorar e convergir com o usuário**.
>
> Feature prevista: `cobranca-mora-e-documentos` · versão `v1` · variante `backend` · fase **F3** do
> `docs/plano-backend-novo/plano-execucao.md`. ⚠️ **A feature pode se partir** — ver a §4.1, que é a
> primeira tensão a resolver e condiciona todas as outras.
>
> **Precedentes de método, na ordem de leitura:**
> `docs/plano-backend-novo/briefings/f2-dominio-locacao.md` (briefing de fase partida) e
> `docs/plano-backend-novo/briefings/f2-fatia2-contratos-de-locacao.md` (briefing de fatia). A F3
> herda deles o formato e a disciplina de tensões, não o conteúdo.

---

## 1. O que esta fase é

**É o dinheiro.** A F2 fechou o domínio de locação — imóveis, pessoas e contratos com ciclo de vida
governado —, mas nada nele cobra. A F3 traz `Cobranca`, o cálculo de mora, a régua que aciona o
inadimplente e os dois documentos que o cliente recebe: o contrato em PDF e o carnê.

É também a **primeira fase que porta volume real do legado**. As fases anteriores portaram regras
pequenas e bem delimitadas; aqui são quatro peças de porte, somando **~1.800 linhas** de Python:

| Peça | Origem no legado | Tamanho |
|---|---|---|
| Régua de cobrança | `cobranca_automation` — core, emailer, runner | **~700 LOC** |
| PDF de contrato | o gerador de contrato | **752 linhas** |
| E-mail de confirmação ao locatário | `locatario_email_confirmacao` | **222 LOC** |
| Mora | `cobranca_atraso` | **151 LOC** |

O escopo declarado está na **§F3 do `plano-execucao.md`**, em sete itens. Leia-o na íntegra — o
resumo abaixo é ponteiro, não substituto:

1. `Cobranca` com ciclo completo, e **`status` com fonte única no servidor** (hoje é derivado no
   cliente por `normalizeStatus`, o que permite duas telas discordarem);
2. **mora por empresa** — `Atraso` deixa de ser Single global; `_calcular_mora()` é pura e idempotente;
3. **régua de cobrança** — core, emailer, runner;
4. **PDF de contrato** em `@react-pdf/renderer`, validado contra a caracterização textual;
5. **carnê** montado com `pdf-lib` **no servidor** — sai do browser, que hoje baixa N boletos;
6. `locatario_email_confirmacao` portado;
7. **WhatsApp** — os campos permanecem no modelo porque o frontend os lê, mas o canal **não é
   implementado**: `whatsapp`/`ambos` são **recusados na validação Zod**, nunca aceitos em silêncio.

**Decisões consumidas: 10 e 34** (`.claude/plans/plano-saas-decisoes.md`).

**Aceitação declarada:** o texto extraído do PDF gerado bate com a referência · o e-mail sai com o
remetente e o `reply_to` da empresa certa.

---

## 2. O terreno que a F3 encontra pronto — não reabrir

### 2.1 O que as fases anteriores entregaram

- **Isolamento por banco** (F1): toda tabela de negócio nasce com `empresa_id`, RLS **forçada** e FK
  composta `(id, empresa_id)`. Referência cross-tenant é impossível **pelo banco**. O contexto vem de
  `AsyncLocalStorage` + `SET LOCAL`, **nunca** do request.
- **Autorização declarada por rota** (F1): matriz 10 telas × 7 ações sensíveis, com default que nega
  e guarda de cobertura sobre a superfície publicada. `TELA:financeiro`, `TELA:recebiveis` e as ações
  de cobrança **já existem no catálogo fechado** — confira quais antes de propor rota nova.
- **Domínio de locação** (F2): as 7 entidades, o contrato com ciclo de vida governado, a série
  declarada `CTR-{ano}-{5 dígitos}` e o pacote **`@sysloc/contracts`** como fonte única do contrato.
- **Superfície publicada**: **75 rotas**, 60 manipuladores, `semDeclaracao` vazio. Suíte em **665
  casos** verdes.

### 2.2 As ADRs que vinculam esta fase — abra a `Decision`, não a linha-resumo

⚠️ **Citar ADR exige abrir o texto.** As linhas abaixo são ponteiros, e paráfrases já divergiram do
original nesta base.

| ADR | Por que vincula a F3 |
|---|---|
| **0001** | modelo canônico de cobrança bancária com adaptador por provedor — **sobrevive ao Frappe** e é o que a F4 vai instanciar; a F3 precisa não contrariá-la |
| **0008** | isolamento pelo banco — `Cobranca` e a configuração de mora nascem tenantizadas |
| **0014** | entidade de cadastro nunca é apagada — vale para cobrança? é tensão, ver §4.6 |
| **0015** | contador sequencial por empresa, furo aceito, número nunca reusado |
| **0016** | o esquema é a fonte única do contrato — validação e documento derivam dele |
| **0017** | três classes de chave exposta — **cobrança tem série declarada**, logo código legível |
| **0018** | uma rota compõe exigências; a cobertura confere conteúdo, não só existência |
| **0020** | número de série é emitido por contador do banco, **fora do desfazimento** |
| **0021** | transição de estado é rota própria, governada **conforme a natureza do ato** — recém-nascida (supersede a 0019), e a F3 é a **primeira fase a aplicá-la sem tê-la escrito** |

**A 0019 está `superseded-by:0021` e não se cita.** A 0007 e a 0012 idem (cadeia 0007 → 0012 → 0017).

### 2.3 O molde que a fatia de contratos deixou pronto

A F3 não inventa forma: ela **repete** a que a `contratos-de-locacao` provou — schema com RLS e FK
composta, porta de dados em `packages/db`, serviço em `apps/api`, contrato em `@sysloc/contracts`,
teste contra fronteira real. **Divergir do molde é decisão que precisa de razão escrita.**

---

## 3. Restrições que não se negociam

Estas vêm do `CLAUDE.md` e das rules; não são material de brainstorm, são o contorno dele.

1. **Dinheiro em `numeric(15,2)`**, nunca float. A F2 mediu o resíduo binário do produto ingênuo
   (`500.03 × 13 = 6500.389999999999`) e resolveu multiplicando centavos inteiros. **A F3 herda o
   problema em escala maior** — mora, juros e totais de carnê.
2. **Multi-tenancy é fundação**, não retrofit: `empresa_id`, RLS forçada, FK composta.
3. **Nenhum segredo versionado.** Credencial de e-mail e afins vivem fora do repositório.
4. **A API fala o modelo de domínio camelCase**, não o formato do Frappe.
5. **Aqui só se faz backend.** Nenhuma linha de React. O carnê sai do browser **para o servidor** —
   isso é trabalho daqui; a tela que o consome, não.
6. **Protocolo Antirregressão** (`.claude/rules/nao-regressao.md`) é pré-condição de toda edição.
7. **Só Opus**, em toda a sessão e em todo subagente.

---

## 4. As tensões a explorar — o coração deste briefing

Cada uma abaixo é uma pergunta **de produto** genuinamente em aberto. Não são pedidos de solução
técnica: são as bifurcações em que o pré-refinamento precisa gerar direções, avaliá-las e convergir
com o usuário. A ordem importa — a §4.1 condiciona as demais.

### 4.1 Esta fase cabe num run? Se não, onde ela corta?

**É a primeira pergunta, e ela é de produto, não de logística.** A F1 e a F2 foram partidas em duas,
e **nenhuma das duas partições estava prevista no plano** — as duas se decidiram no pré-refinamento
da fase. A F1 cortou *depois da autenticação*; a F2, *por agregado*.

A F3 tem **sete itens** e ~1.800 LOC de porte, contra as ~1.000 da F2 inteira, que já precisou de
duas fatias e 21 tasks. Os cortes plausíveis, para servir de ponto de partida — **não são as únicas
opções, e podar é parte do trabalho**:

- **por objeto**: `Cobranca` + mora (o dado e o cálculo) · depois régua + documentos (o que age);
- **por natureza do efeito**: o que só escreve no banco · depois o que **sai para fora** (e-mail, PDF);
- **por dependência de oráculo**: o que tem golden · depois o que não tem (§4.2);
- **fase única**, se a convergência mostrar que os sete itens são menores do que a soma das linhas
  sugere.

Perguntas a levar ao usuário: qual metade entrega valor sozinha? Uma cobrança que existe, calcula
mora e é lida pela tela — sem régua e sem PDF — é entrega útil ou é meia ponte?

### 4.2 A maior peça da fase **não tem oráculo**, e a janela para capturá-lo fecha na F7

**Este é o achado mais importante deste briefing.** O `PROCEDENCIA.md` §4 dos goldens registra, por
escrito:

> *"A régua de cobrança (`cobranca_automation`) **não foi caracterizada**. Ela tem efeito colateral
> de envio de e-mail e ficou fora do escopo desta captura."*

São **~700 LOC** — a maior peça da F3 — a serem portadas **sem referência executável**. E o registro
do mesmo arquivo mostra que o problema tem irmão:

> *"**`_calcular_mora()` foi portado, não re-executado.**"* Os 6 casos de `calcular-mora.json` vêm do
> teste unitário Python (`TestCalcularMora`), não de execução contra o sistema. É prova — mas de
> **outra natureza** que os demais goldens, e a diferença precisa estar declarada.

O `/opt/frappe` **ainda está de pé** e só é desligado na F7. Depois disso, não há como recapturar.
A fatia de contratos enfrentou exatamente esta tensão e a resolveu **capturando antes de implementar**
(a T1 dela existiu para isso, e foi a primeira task por uma razão que expirava).

Direções a explorar: capturar a régua agora, aceitando o efeito de e-mail sob controle (destinatário
sintético? SMTP de captura? o site efêmero da ADR-0006 já isola)? Aceitar porte por leitura, com a
consequência declarada? Capturar só as partes puras e declarar as impuras? **O que não é opção é
descobrir na F5 que o oráculo não existe mais.**

### 4.3 Onde a F3 termina e a F4 começa — cobrança sem boleto é cobrança?

A **F4** é a integração bancária (Sicoob), e ela é uma fase inteira depois desta. Mas o ciclo de
cobrança do legado **emite boleto** — o levantamento do frontend registra `emitir_boleto_sicoob`,
`solicitar_baixa_boleto_sicoob` e `abrir_boleto` como caminhos vivos que a tela chama.

A pergunta: o que a F3 entrega de uma cobrança cujo meio de recebimento ainda não existe? Ela nasce
com o campo e sem o efeito, no molde do `cobrancasGeradas: false` que a F2 usou? Nasce sem o campo? O
adaptador da **ADR-0001** é declarado aqui e implementado lá?

**Precedente que vale ouro**: a F2 resolveu a mesma classe de problema publicando o literal
`efeitos: { cobrancasGeradas: false }`, que **obriga quem for gerar cobrança a tocar o contrato
publicado** em vez de mudar o significado da resposta por omissão. O débito **D28 (F2/T7)** existe
exatamente para isso.

### 4.4 Onde a F3 termina e a F5 começa — a régua roda quando?

A **F5** é a das automações agendadas (systemd timers, despachante por horário, um job por empresa).
A régua de cobrança é justamente uma automação: ela **decide a quem cobrar e envia**.

A tensão: a F3 entrega a régua **acionável por rota** e a F5 lhe dá o gatilho de tempo? Ou a régua só
existe agendada, e então parte da F5 vem para cá? O que se prova nesta fase, se o disparo é de outra?

⚠️ **O débito D32 (F0/T6) dispara aqui**: o marcador em `apps/worker/src/fila.ts` diz que ele fecha
na *"primeira fatia que enfileirar tarefa de negócio"*. A régua é forte candidata a ser essa fatia.

### 4.5 Dois documentos, duas naturezas de prova

O **PDF de contrato** tem golden: `contrato-pdf.txt`, o texto extraído das 752 linhas, e o critério de
aceitação é *"o texto extraído do PDF gerado bate com a referência"*. A biblioteca muda
(`@react-pdf/renderer`), então a comparação é **de texto extraído**, não de bytes.

O **carnê** não tem golden — ele hoje é montado **no browser**, que baixa N boletos, e a F3 o traz
para o servidor com `pdf-lib`. É funcionalidade que **muda de lugar**, não que se porta.

Perguntas: o que é "bate com a referência" — igualdade literal, normalizada, por campo? Um PDF novo
com quebra de linha diferente reprova? E o carnê, que não tem referência: qual é o critério de pronto?

### 4.6 A cobrança é entidade de cadastro para efeito da ADR-0014?

A **ADR-0014** diz que entidade de cadastro do domínio **nunca é apagada** — a exclusão é lógica. A
F2 a aplicou a tudo menos cômodo, que é detalhe de composição.

Cobrança é outra coisa: ela é **cancelada** (o frontend faz `PUT status_cobranca:'Cancelada'`), tem
substituta (`POST` de cobrança nova), e o pagamento **zera 6 campos de conciliação bancária**. Isso é
exclusão lógica? É transição de estado governada pela **ADR-0021**? São as duas, em eixos diferentes?

E o mais delicado: *"acusar pagamento"* zerar seis campos é comportamento do legado que o levantamento
registra. **Porta-se ou corrige-se?** A convenção de caracterização manda preservar o defeito e
registrá-lo — mas isto é fase de porte, não de caracterização.

### 4.7 Mora por empresa — o que acontece com o que já foi calculado?

`Atraso` deixa de ser Single global e passa a ser **por empresa**. A pergunta de produto: mudar a
multa hoje afeta a mora de uma cobrança vencida ontem? A mora é **calculada na leitura** (derivada,
como a metragem da F2) ou **gravada** no momento em que incide?

A F2 tem precedente para os dois lados — metragem é derivada na leitura; `valorTotalContrato` é
gravado na ativação. **A escolha aqui tem consequência contábil**, não só técnica.

### 4.8 O status da cobrança muda de dono

Hoje o `status` é derivado **no cliente** por `normalizeStatus`, e a §F3 manda trazê-lo para o
servidor com fonte única. Isso é a mesma classe do que a ADR-0017 resolveu para o contrato.

A tensão: quais são os estados, e quais transições são **atos sensíveis** (rota própria com chave de
ação, pela ADR-0021) contra **atributos operacionais** (rota própria, só a área)? *Cancelar* uma
cobrança é ato sensível; *marcar como vencida* pela rotina não tem ator humano. **A 0021 é nova — a F3
é a primeira a aplicá-la sem tê-la escrito, e é o teste real do critério dela.**

### 4.9 E-mail: as decisões 10 e 34 se encontram aqui

- **Decisão 10** — remetente **único do SaaS** com o nome da empresa: `sender_full_name` = nome
  fantasia, `reply_to` = e-mail da empresa. ⇒ **exige SPF/DKIM no domínio**.
- **Decisão 34** — **manter o Gmail atual**, com o acréscimo pedido pelo usuário: **alerta quando as
  cobranças não estiverem sendo enviadas por limite do provedor**.

As duas são decisões fechadas. O que o pré-refinamento precisa convergir é o **comportamento de
produto** que elas implicam: o que acontece com a cobrança cujo e-mail não saiu? Fica pendente,
falha, entra em fila? O alerta da decisão 34 é da F3 ou da tela de saúde da F5? E o SPF/DKIM — é
pré-condição de aceitação desta fase ou item de operação?

---

## 5. Fora do escopo desta fase — e por quê

- **Emissão de boleto e baixa bancária** — é F4 inteira, com mTLS, certificado por empresa e webhook.
- **Agendamento por timer** — é F5 (mas ver a tensão §4.4, que decide a fronteira).
- **Canal WhatsApp** — decisão fechada: os campos ficam no modelo porque o frontend os lê, e os
  valores `whatsapp`/`ambos` são **recusados na validação**. Não é omissão, é recusa declarada.
- **Qualquer linha de React** — inclusive a tela que baixa o carnê. O carnê **é gerado aqui**; quem o
  exibe é implementado fora.
- **Publicar o `@sysloc/contracts`** — é item do marco de entrega, não desta fase.

---

## 6. Débitos com gatilho que esta fase dispara

Três marcadores vivos no código apontam para cá. Eles **não são sugestões**: são trabalho agendado,
e o marcador sai no mesmo commit em que o débito fecha (§3-B da `nao-regressao.md`).

| Débito | Onde | O que exige |
|---|---|---|
| **D28** (F2/T7) | `apps/api/src/contratos/contrato.service.ts` | a ativação **não gera cobranças**, e o literal `cobrancasGeradas: false` está fixado por `z.literal(false)`. A F3 afrouxa o esquema, gera as parcelas **na mesma unidade de trabalho** da ativação, e remove o marcador. **O golden já capturou os três cenários** (`entrada.cobrancas` de `contrato-ativacao.json`), incluindo a saturação do dia de vencimento em 28 e o texto da referência |
| **D36** (F2/T8) | `contrato.service.ts` (`cancelar`) | a pré-condição legada *"sem PDF, não cancela"* não foi portada. A F3 decide se o carimbo "CANCELADO" no PDF é **pré-condição** do ato ou **efeito** dele. O golden tem a recusa `contrato_sem_pdf` capturada |
| **D32** (F0/T6) | `apps/worker/src/fila.ts` | dispara na primeira fatia que **enfileirar tarefa de negócio** — ver §4.4 |

---

## 7. Fatos a confirmar durante o pré-refinamento

Nenhum destes deve ser assumido. Cada um é verificável, e a verificação é barata:

1. **Quais chaves de autorização já existem** no catálogo fechado para cobrança e financeiro — a
   ADR-0011 fecha o catálogo, e criar chave nova exige supersedê-la (foi o que o D43 custou à F2).
2. **Quantas rotas a F3 acrescenta** e o que isso faz com as 75 atuais — a superfície congela depois
   da F5, e cada fase precisa saber o que publicou.
3. **O que exatamente `normalizeStatus` faz hoje no cliente** — o `levantamento-frontend.md` §6 tem o
   modelo de domínio que a API deve falar.
4. **Se `min(dia_vencimento, 28)` continua inalcançável** no caminho novo — o golden registra os dois
   fatos lado a lado, sem corrigir o `min`.
5. **O terceiro `Custom Field` de negócio**, que pertence à `Cobranca` e é desta fase (a F2 portou os
   dois de `Contrato`).
6. **Se a régua ainda pode ser capturada** contra o `/opt/frappe` — §4.2, e é a mais urgente.

---

## 8. Critérios de saída deste pré-refinamento

O `pre-refinement.md` está pronto quando responder, com o usuário no loop:

- [ ] **A fase se parte?** Se sim, onde corta, por que ali, e o que cada fatia entrega sozinha.
- [ ] **O que fazer com o oráculo ausente da régua** — capturar agora, portar por leitura com a
      consequência declarada, ou recortar o escopo. Com prazo, se a decisão for capturar.
- [ ] **As três fronteiras** — F3×F4 (boleto), F3×F5 (agendamento), F3×F2 (os débitos D28 e D36).
- [ ] **A natureza da cobrança** — estados, quais transições são atos sensíveis pela ADR-0021, e como
      a ADR-0014 se aplica (ou não) a ela.
- [ ] **Mora derivada ou gravada**, e o efeito de mudar a configuração.
- [ ] **O critério de pronto dos dois documentos** — o que é "bate com a referência" para o PDF, e o
      que substitui a referência ausente no carnê.
- [ ] **Riscos e dúvidas em aberto**, separando **FATO** de `[HIPÓTESE]` e `[DÚVIDA]`.
- [ ] **Recomendação de framework** — a F1 e a F2 usaram SDD; divergir exige razão.

---

## 9. Observações de método

- **Este briefing é ancoragem, não roteiro.** Se o brainstorm encontrar uma tensão que não está aqui,
  ela é bem-vinda — e vale mais que as listadas, porque ninguém a antecipou.
- **Não proponha solução técnica fina.** Sem endpoint, sem schema, sem nome de tabela. A pergunta é
  sempre *o que o produto faz e por quê*, nunca *como se implementa*.
- **Pode-se, e deve-se, podar.** Ramo que não sobrevive à avaliação sai registrado como podado, com o
  motivo — é o registro que impede a fatia seguinte de reabri-lo.
- **Tudo em português brasileiro**, inclusive raciocínio exibido e perguntas de `AskUserQuestion`.
- **Consultar o `/opt/frappe` é legítimo e encorajado** (`docker compose exec -T backend bench --site
  frontend ...`), mas o site `frontend` é **produção**: nada destrutivo.
