# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: `webhook-e-carne` — fatia (iii) e última da F4 (integração bancária)
- **Responsável/Autor**: sysloc (usuário) · PRD conduzido por `/agent-spec-sdd-generate-prd`
- **Data**: 2026-08-18
- **Versão**: v1
- **Status**: Aprovado (pelo usuário em 2026-08-18)
- **Relacionados**:
  - `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md` — o discovery desta fase,
    **incluindo a emenda §13-A de 2026-08-16**, vinculante sobre a §13 onde as duas divergirem.
    ⚠️ A §13-A.1 adverte que a prova do identificador íntegro alcança **só o caminho de consulta** —
    não o da notificação, que é justamente o desta fatia (§9)
  - `docs/prds/features/fundacao-bancaria/v1/prd.md` — fatia (i), pré-requisito
  - `docs/prds/features/emissao-e-conciliacao/v1/prd.md` — fatia (ii), pré-requisito integral desta
  - `.claude/plans/plano-saas-decisoes.md` — decisões 11, 17, 19, 20, 21, 22, 23, 24, 33 e 37
  - `docs/adr/` — 0011, 0016, 0017, 0018, 0022, 0024, 0027, 0028, 0029, 0030, 0031, 0034 e **0035**
    (a que nasceu para esta fatia, registrada em 2026-08-18)
  - `docs/plano-backend-novo/plano-execucao.md` §F4 itens 4, 5 e 6

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** O produto só descobre que alguém pagou **perguntando**. A
  fatia anterior reduziu a pergunta de sete vezes ao dia para uma, mas a natureza continua a mesma:
  o volume de conversa com o provedor é proporcional ao que está **em aberto**, não ao que
  **aconteceu**. O provedor sabe do pagamento na hora e tem como avisar — e o sistema antigo nunca
  usou esse aviso: em **1.864** registros de conversa com ele, **100%** entraram por pergunta nossa,
  nenhum por aviso dele. E o locatário que tem doze parcelas a pagar recebe **doze arquivos
  separados**, porque a reunião deles num documento só é hoje montada no navegador, baixando um
  boleto por vez.

- **Como funciona atualmente?** Ninguém avisa nada: uma rotina pergunta ao provedor, boleto por
  boleto, o que houve. Quem quer entregar um carnê ao locatário depende de o navegador buscar cada
  boleto e juntá-los na máquina de quem está olhando — o que só funciona com a tela aberta, é lento
  na proporção do número de parcelas, e produz um documento que ninguém consegue reproduzir depois.

- **Por que isso precisa ser resolvido agora?** É a última das três fatias da integração bancária, e
  a única que **abre o produto ao mundo**: até aqui, tudo que entra vem de alguém com sessão. Ela só
  podia vir por último — o aviso do provedor precisa de boleto emitido para ter sobre o que avisar, e
  o carnê precisa de boleto emitido para ter o que reunir. Depois dela, resta a F5, e a superfície da
  API congela.

- **Quem sofre o impacto do problema?** O **Admin Empresa**, que descobre o pagamento com atraso de
  até um dia e monta carnê aos pedaços; o **Usuário Empresa** do financeiro, que concilia sobre
  informação velha; o **Locatário**, que recebe um arquivo por parcela; e o operador da plataforma,
  que paga com cota de integração cada pergunta que poderia ter sido um aviso.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o produto **receba** do provedor a notícia do recebimento em vez
  de sair perguntando, sem que essa entrada se torne uma porta pela qual um estranho mova dinheiro; e
  que o conjunto de boletos de um contrato saia do produto como **um documento só**, montado aqui,
  reproduzível e sempre coerente com o que foi emitido.

- **Qual mudança de comportamento esta feature deve gerar?** A liquidação deixa de depender do
  relógio da conferência e passa a acontecer minutos depois do pagamento. O que chega de fora deixa
  de ser tratado como verdade e passa a ser tratado como **aviso a conferir**: ele diz *onde olhar*,
  nunca *o que gravar*. E o carnê deixa de ser um trabalho do navegador de quem pediu.

- **Qual o resultado final esperado do ponto de vista do usuário?** O locatário paga; minutos depois
  a cobrança já se publica paga, com data e valor, e o histórico bancário dela mostra que foi um
  aviso do provedor que originou a conferência. E o Admin escolhe um contrato e um intervalo de
  meses, e recebe um único documento com os boletos daquele período, na ordem de vencimento.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Entrada única para a notícia do provedor** — um endereço só, para todas as empresas, que
      guarda o recebido **como veio** antes de interpretá-lo, confirma o recebimento de imediato e
      trata o assunto depois. Quem avisa não espera pelo desfecho.
- [ ] **Resposta ao pedido de validação do endereço** que o provedor faz ao cadastrar a notificação,
      ao trocar o endereço e ao reativá-la — sem ela o cadastro da notificação não se conclui.
- [ ] **Roteamento pelo identificador perante o provedor** — a chave que **o próprio produto** emitiu
      e que fez o trajeto de ida e volta; a **empresa é derivada da cobrança encontrada**, nunca do
      que o remetente diz.
- [ ] **Conferência do resto do recebido** — o número do título no provedor e o identificador do
      cliente são conferidos contra o que está gravado; qualquer divergência é **registrada e
      recusada**, nunca aplicada.
- [ ] **Descarte sem consultar o provedor** do que não corresponde a cobrança alguma.
- [ ] **Efeito único por aviso** — a mesma notícia entregue mais de uma vez produz um efeito só,
      reconhecida pelo identificador que o provedor atribui à liquidação.
- [ ] **A conferência decide, o aviso não** — recebido o aviso e casada a cobrança, o produto
      pergunta ao provedor sobre aquele boleto e grava **apenas** o que a resposta disser, pela mesma
      regra de liquidação, estorno e revogação que a fatia anterior fixou.
- [ ] **Empresa suspensa retém, e a reativação aplica** — a notícia chegada durante a suspensão é
      guardada e produz efeito quando a empresa volta, sem nada se perder.
- [ ] **Prazo de guarda do recebido cru** — ele é descartado depois de um prazo declarado, por
      carregar dado pessoal do pagador.
- [ ] **Carnê por contrato e intervalo de competências** — um documento só, com os boletos das
      cobranças daquele contrato cujas competências caem no intervalo pedido, na ordem de vencimento,
      composto no instante do pedido e nunca guardado.
- [ ] **Carnê resiliente à ausência do arquivo** — boleto cujo arquivo não está mais disponível aqui
      é obtido de novo do provedor e entra no documento sem que quem pediu perceba diferença.
- [ ] **Carnê que recusa em vez de mentir** — cobrança do intervalo sem boleto emitido faz o pedido
      falhar nomeando a cobrança e a ausência; nunca sai página em branco nem documento incompleto.
- [ ] **Alcance externo do caminho da notícia** — o produto passa a ser alcançável de fora **apenas**
      nesse caminho, com o cadastro feito de verdade junto ao provedor e a validação do endereço
      respondida de verdade como critério de pronto.

### 4.2 O que está explicitamente fora do escopo

- [ ] **Qualquer código de frontend** — o fonte vive na máquina local do usuário e será implementado
      lá, a partir do handoff que este backend produz. Task que peça isso é **gatilho de parada**.
- [ ] **Entrega do carnê ao locatário sem sessão** — decidido em 2026-08-18: o carnê é obtido por
      quem alcança o contrato e entregue por fora, como o boleto avulso da fatia (ii) já é.
- [ ] **Alcance externo do resto do produto** — só o caminho da notícia é antecipado; publicar a API
      inteira permanece da F7.
- [ ] **O agendamento por horário** da conferência diária — a regra e o disparo sob comando são da
      fatia (ii); o gatilho automático é da F5.
- [ ] **Descarte dos boletos guardados** — dívida já registrada com dono e gatilho declarados na F5
      (D26 · F4/T9), fora desta fatia por decisão de 2026-08-18.
- [ ] **Visão das notificações recusadas por rota** — adiada com gatilho pelo discovery (§C-2): o
      primeiro caso real que a operação não conseguir diagnosticar sem ela.
- [ ] **Autenticação da notícia pelo próprio provedor** — ele não oferece nenhuma, e isso não é
      escolha do produto; o que o produto faz a respeito está nas regras desta fatia.
- [ ] **A cobrança por Pix** — meio de recebimento previsto no modelo desde a fatia (i), segue sem
      operação (decisão 18).
- [ ] **Reescrever o que as fatias (i) e (ii) fecharam** — identidade perante o provedor,
      identificador único, emissão, revogação, liquidação, estorno, conferência diária e trilha
      bancária são **consumidos** como estão.

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Admin Empresa** — quem precisa saber do recebimento no dia em
  que ele acontece, e quem entrega o carnê ao locatário.
- **Qual é seu objetivo ao usar essa feature?** Conciliar sobre informação do mesmo dia, e entregar
  um documento só em vez de uma dúzia.
- **Quais dores/dificuldades essa feature resolve pra ele?** O atraso de até um dia entre o pagamento
  e o produto saber dele; a montagem manual do carnê no navegador; e o risco, que ele não tem como
  avaliar sozinho, de uma entrada aberta ao mundo ser usada para forjar recebimento.

Personas secundárias:

- **Usuário Empresa** (operação e financeiro) — lê o histórico bancário e precisa distinguir o que
  foi conferência de rotina do que foi aviso do provedor.
- **Locatário** — paga e recebe o carnê das mãos da imobiliária; **não tem sessão** no produto e não
  interage com nada desta fatia.
- **Sysloc Master** — suspende e reativa empresas, e responde por não perder recebimento durante a
  suspensão. Não alcança dado de negócio de empresa alguma.
- **Provedor** — ator **externo**. Nesta fatia, e só nela, é ele quem **inicia** a conversa. Não é
  usuário do produto, não é titular de dado nenhum e nunca terá sessão.
- **Operador da plataforma** — responde pelo alcance externo do produto, pela cota de integração e
  pelo dado pessoal de terceiro que passa a ser guardado aqui.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Admin Empresa**, quero que o recebimento apareça no produto minutos depois de o
  locatário pagar, sem esperar a conferência do dia, para conciliar sobre informação do mesmo dia.
- **US-02**: Como **operador da plataforma**, quero que o produto confirme o recebimento do aviso de
  imediato e trate o assunto depois, para que o provedor não desista por demora e reenvie.
- **US-03**: Como **operador da plataforma**, quero que o aviso seja guardado exatamente como chegou
  antes de qualquer interpretação, para que nada se perca quando o produto não entender o que
  recebeu.
- **US-04**: Como **Admin Empresa**, quero que um aviso forjado por quem descobriu o endereço não
  produza efeito nenhum, para que ninguém liquide uma cobrança minha inventando um recebimento.
- **US-05**: Como **operador da plataforma**, quero que aviso que não corresponde a cobrança alguma
  seja registrado e descartado **sem** o produto perguntar nada ao provedor, para que um envio
  forjado em massa não consuma a cota da integração.
- **US-06**: Como **Admin Empresa** de uma imobiliária que divide a conta bancária com outra do mesmo
  dono, quero que cada aviso chegue à cobrança certa, para que a conta compartilhada não misture as
  duas carteiras.
- **US-07**: Como **operador da plataforma**, quero que a empresa de um aviso seja sempre derivada da
  cobrança encontrada e nunca do que o remetente declara, para que uma origem externa jamais escolha
  o isolamento.
- **US-08**: Como **Usuário Empresa**, quero que divergência entre o que o aviso traz e o que está
  gravado seja registrada e recusada, para que eu descubra a inconsistência em vez de ela ser
  aplicada silenciosamente.
- **US-09**: Como **Admin Empresa**, quero que o mesmo aviso entregue mais de uma vez produza efeito
  uma vez só, para que um recebimento não seja contado em dobro.
- **US-10**: Como **Sysloc Master**, quero que o aviso chegado enquanto uma empresa está suspensa seja
  guardado e aplicado quando ela voltar, para que nenhum recebimento suma durante a suspensão.
- **US-11**: Como **operador da plataforma**, quero que o produto responda ao pedido de validação do
  endereço que o provedor faz ao cadastrar a notificação, para que o cadastro possa ser concluído.
- **US-12**: Como **operador da plataforma**, quero que o recebido cru seja descartado depois de um
  prazo declarado, para que dado pessoal de pagador não se acumule aqui sem prazo.
- **US-13**: Como **Usuário Empresa**, quero distinguir no histórico bancário o que veio de aviso do
  provedor do que veio da conferência de rotina, para saber por que uma cobrança mudou quando mudou.
- **US-14**: Como **Admin Empresa**, quero reunir num documento só os boletos de um contrato num
  intervalo de meses, para entregar ao locatário de uma vez em vez de um arquivo por parcela.
- **US-15**: Como **Admin Empresa**, quero que o carnê saia mesmo quando o arquivo de algum boleto não
  está mais guardado aqui, para não depender de há quanto tempo cada um foi emitido.
- **US-16**: Como **Admin Empresa**, quero que o carnê recuse nomeando a cobrança quando falta boleto
  no intervalo, para nunca entregar ao locatário um documento com parcela faltando.
- **US-17**: Como **Admin Empresa**, quero pedir o mesmo recorte duas vezes e receber o mesmo
  documento, para reimprimir o que já entreguei.
- **US-18**: Como **operador da plataforma**, quero que nenhum termo, código ou desfecho do provedor
  vire regra ou estado do produto, para que trocar de provedor não obrigue a reescrever o domínio.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — A notícia do provedor chega por **um endereço único**, o mesmo para todas as empresas.
  Não existe endereço por empresa, e a empresa **nunca** é determinada pelo endereço.
- **RN-02** — O recebido é guardado **como chegou**, antes de qualquer interpretação, e o
  recebimento é confirmado de imediato. O que o produto decide fazer com ele acontece **depois** e
  não compõe a resposta a quem avisou.
- **RN-03** — O aviso é roteado pelo **identificador perante o provedor** — a chave de 18 posições
  que o produto emitiu e enviou, e que voltou no aviso. Nenhum outro campo do recebido roteia.
- **RN-04** — A **empresa do ato é a da cobrança encontrada**, nunca a declarada no recebido. Não
  existe caminho pelo qual uma origem externa escolha empresa.
- **RN-05** — O número do título no provedor e o identificador do cliente presentes no aviso são
  **conferência**, não roteamento. Divergência entre qualquer um deles e o que está gravado faz o
  aviso ser **registrado e recusado** — o efeito não se aplica.
- **RN-06** — Aviso que não casa com cobrança alguma é **registrado e descartado sem que o produto
  pergunte nada ao provedor**. Nenhuma consulta é gastada com o que não se reconhece.
- **RN-07** — O aviso **não decide nada**. Casada a cobrança, é a resposta do provedor à consulta do
  produto que determina o que se grava — pela **mesma** regra de liquidação, estorno e revogação da
  fatia anterior, sem exceção por caminho de entrada.
- **RN-08** — Cada aviso produz **efeito único**, reconhecido pelo identificador que o provedor
  atribui à liquidação. Reentrega do mesmo aviso é recebida e registrada normalmente, e não repete o
  efeito.
- **RN-09** — Aviso de cobrança de **empresa suspensa** é guardado e **não** produz efeito enquanto a
  suspensão durar. A reativação da empresa aplica o que ficou retido, na ordem em que chegou.
- **RN-10** — O produto responde ao pedido de validação do endereço que o provedor faz ao cadastrar,
  ao trocar o endereço e ao reativar a notificação — esse pedido não é aviso de recebimento, não
  roteia e não produz efeito sobre cobrança alguma.
- **RN-11** — O recebido cru é guardado por **90 dias** e descartado depois disso. O que sobrevive ao
  descarte é o efeito registrado na trilha bancária da cobrança, que não tem prazo.
- **RN-12** — A trilha bancária publicada registra **efeito**, não tentativa: entra o que mudou o
  estado da cobrança e o desfecho anômalo — divergência, recusa, aviso órfão —, e a origem do que
  entrou fica distinguível entre aviso do provedor e conferência de rotina.
- **RN-13** — O carnê é definido por **um contrato de locação e um intervalo de competências**. Ele
  reúne os boletos vigentes das cobranças daquele contrato cujas competências caem no intervalo, na
  ordem crescente de vencimento.
- **RN-14** — O carnê é **composto no instante do pedido e nunca guardado**. O mesmo recorte, pedido
  duas vezes sem que nenhum boleto tenha sido reemitido no meio, produz o mesmo documento.
- **RN-15** — Boleto cujo arquivo não está mais disponível aqui é **obtido de novo do provedor** e
  entra no carnê normalmente.
- **RN-16** — Cobrança do recorte **sem boleto emitido** faz o pedido do carnê **falhar nomeando** a
  cobrança e a ausência. Não existe carnê parcial, com página em branco ou com parcela omitida em
  silêncio.
- **RN-17** — O carnê é obtido por quem **alcança o contrato** dentro da empresa dele. Não há
  caminho sem sessão para o carnê.
- **RN-18** — Nenhum termo, código ou desfecho do provedor vira regra ou estado do produto. O que ele
  informou é preservado **apenas como diagnóstico** — inclusive quando o produto não reconhece o que
  ele disse.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. A imobiliária cadastra junto ao provedor o endereço pelo qual quer ser avisada. O provedor pede a
   validação desse endereço, e o produto responde — sem isso o cadastro não se conclui.
2. Um locatário paga um boleto.
3. O provedor avisa. O produto **guarda o aviso como veio** e confirma o recebimento na hora; quem
   avisou não fica esperando.
4. Em seguida, o produto procura a cobrança pelo identificador que ele mesmo emitiu e que voltou no
   aviso. Achada a cobrança, a **empresa é a dela**.
5. O produto confere o restante do aviso contra o que está gravado. Batendo tudo, ele **pergunta ao
   provedor** o estado daquele boleto e grava o que a resposta disser — liquidação com a data e o
   valor informados, mora carimbada pela política vigente.
6. Minutos depois do pagamento, a cobrança se publica **paga**, e o histórico bancário dela mostra
   que o que originou a conferência foi um aviso do provedor.
7. Em outro momento, o Admin escolhe um contrato e um intervalo de meses e pede o carnê. O produto
   reúne os boletos daquelas cobranças, na ordem de vencimento, e devolve **um documento só**.

### 7.2 Fluxos Alternativos

- **O aviso não corresponde a cobrança alguma** (forjado, de outro sistema, ou de uma cobrança que
  não existe aqui) → é registrado e descartado, e o produto **não pergunta nada ao provedor**.
- **O aviso casa a cobrança, mas algum dado de conferência diverge** → é registrado e **recusado**; a
  cobrança não muda, e a divergência fica visível para quem investiga.
- **O mesmo aviso chega de novo** → é recebido e registrado normalmente, e nada acontece pela segunda
  vez: o efeito já foi produzido.
- **O aviso chega para uma cobrança de empresa suspensa** → fica retido, sem efeito; quando a empresa
  é reativada, o que ficou retido é aplicado na ordem em que chegou.
- **O aviso chega e a consulta ao provedor contradiz o que ele avisou** → vale a consulta. O aviso
  serve apenas para dizer *onde olhar*.
- **O que chega é o pedido de validação do endereço**, e não um aviso de recebimento → é respondido, e
  nenhuma cobrança é procurada nem alterada.
- **O prazo de guarda de um recebido cru vence** → ele é descartado; o efeito que ele produziu
  permanece na trilha bancária da cobrança, que não tem prazo.
- **Falta boleto em alguma cobrança do recorte do carnê** → o pedido falha nomeando a cobrança e a
  ausência; nada parcial é entregue.
- **O arquivo de um dos boletos do recorte não está mais guardado aqui** → é obtido de novo do
  provedor e entra no documento; quem pediu não percebe diferença.
- **O recorte pedido não tem cobrança nenhuma** → o produto recusa dizendo que não há o que reunir,
  em vez de devolver documento vazio.
- **Alguém pede o carnê de um contrato de outra empresa** → o produto responde como se ele não
  existisse.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO um boleto pago QUANDO o provedor avisa o produto ENTÃO a cobrança
      correspondente passa a publicar-se paga, com a data e o valor que a consulta ao provedor
      informou, sem depender da conferência diária.
- [ ] **CA-02**: DADO um aviso recebido QUANDO o produto o recebe ENTÃO ele confirma o recebimento
      sem esperar por nenhuma consulta ao provedor nem pelo desfecho do tratamento, e o desfecho não
      compõe a resposta.
- [ ] **CA-03**: DADO um aviso cujo conteúdo o produto não consegue interpretar QUANDO ele chega
      ENTÃO o recebido está guardado exatamente como veio e o recebimento foi confirmado do mesmo
      jeito.
- [ ] **CA-04**: DADO um aviso forjado por quem descobriu o endereço, apontando para uma cobrança
      real e afirmando um recebimento que não houve QUANDO ele chega ENTÃO a cobrança **não** é
      liquidada, porque só a resposta da consulta ao provedor decide.
- [ ] **CA-05**: DADO uma remessa de avisos que não correspondem a cobrança alguma QUANDO eles chegam
      ENTÃO todos ficam registrados, nenhum produz efeito e **nenhuma consulta ao provedor é feita**.
- [ ] **CA-06**: DADO duas empresas que recebem na mesma conta do provedor QUANDO chega um aviso de
      cada uma ENTÃO cada um alcança a cobrança da empresa dona dela, e nenhum dado de uma aparece
      para a outra.
- [ ] **CA-07**: DADO um aviso que declara uma empresa diferente da dona da cobrança encontrada
      QUANDO ele é tratado ENTÃO a empresa do ato é a **da cobrança**, e a declaração do remetente
      não tem efeito algum.
- [ ] **CA-08**: DADO um aviso que casa a cobrança mas traz número do título ou identificador do
      cliente divergente do gravado QUANDO ele é tratado ENTÃO o aviso é registrado e recusado, a
      cobrança permanece como estava, e a divergência fica consultável.
- [ ] **CA-09**: DADO um aviso já tratado QUANDO ele chega de novo ENTÃO nada muda na cobrança e
      nenhum efeito é repetido, ainda que a reentrega seja registrada.
- [ ] **CA-10**: DADO uma empresa suspensa QUANDO chega um aviso de uma cobrança dela ENTÃO ele fica
      retido sem efeito; e QUANDO a empresa é reativada ENTÃO o que ficou retido é aplicado, na ordem
      em que chegou, e nada se perde.
- [ ] **CA-11**: DADO o pedido de validação do endereço que o provedor faz ao cadastrar a notificação
      QUANDO ele chega ENTÃO o produto responde de modo que o cadastro se conclua, e nenhuma cobrança
      é procurada ou alterada.
- [ ] **CA-12**: DADO um recebido cru guardado há mais de 90 dias QUANDO o descarte acontece ENTÃO
      ele deixa de existir, e o efeito que ele produziu permanece na trilha bancária da cobrança.
- [ ] **CA-13**: DADO uma cobrança liquidada a partir de aviso do provedor QUANDO alguém consulta o
      histórico bancário dela ENTÃO consegue distinguir que a origem foi o aviso, e não a conferência
      de rotina.
- [ ] **CA-14**: DADO um contrato com cobranças com boleto emitido QUANDO o Admin pede o carnê dele
      para um intervalo de competências ENTÃO recebe **um único documento** com exatamente os boletos
      das cobranças daquele contrato cujas competências caem no intervalo, na ordem crescente de
      vencimento — nenhum a mais, nenhum a menos.
- [ ] **CA-15**: DADO um recorte em que o arquivo de algum boleto não está mais disponível localmente
      QUANDO o carnê é pedido ENTÃO ele é obtido de novo do provedor e entra no documento, sem falhar
      e sem exigir nada de quem pediu.
- [ ] **CA-16**: DADO um recorte em que alguma cobrança não tem boleto emitido QUANDO o carnê é
      pedido ENTÃO o produto recusa nomeando a cobrança e a ausência, e não entrega documento algum.
- [ ] **CA-17**: DADO um mesmo contrato e intervalo QUANDO o carnê é pedido duas vezes sem que
      nenhum boleto tenha sido reemitido no meio ENTÃO os dois documentos têm o mesmo conteúdo, na
      mesma ordem.
- [ ] **CA-18**: DADO um recorte que não alcança cobrança nenhuma QUANDO o carnê é pedido ENTÃO o
      produto recusa dizendo que não há o que reunir, e não devolve documento vazio.
- [ ] **CA-19**: DADO um usuário de uma empresa QUANDO ele pede o carnê de um contrato de outra
      empresa ENTÃO o produto responde como se ele não existisse.
- [ ] **CA-20**: DADO o alcance externo do produto depois desta fatia QUANDO se examina o que responde
      de fora ENTÃO apenas o caminho da notícia do provedor atende, e o cadastro junto ao provedor foi
      concluído com a validação do endereço respondida de verdade.
- [ ] **CA-21**: DADO tudo que esta fatia publica e registra QUANDO se examina esse vocabulário ENTÃO
      nenhum nome de campo, código ou desfecho do provedor aparece como regra ou como estado do
      produto, e o que ele informou consta apenas como diagnóstico.

---

## 9. Restrições & Considerações

- ⚠️ **Risco datado, e o prazo é de quatro dias.** O certificado em uso **vence em 2026-08-22**,
  medido em 2026-08-16 por leitura do próprio material (§13-A.2 do discovery). Sem ele o produto não
  fala com o provedor, e **CA-01, CA-04, CA-15 e CA-20 dependem dessa conversa**. A decisão do
  usuário em 2026-08-16 — assumir a renovação e seguir o plano — vale aqui, e esta fatia é a que mais
  a consome, porque só ela cadastra a notificação de verdade.
- ⚠️ **A prova de que o identificador volta íntegro alcança só o caminho de consulta.** A sonda de
  2026-08-16 mediu 3 de 3 com igualdade exata **consultando** o provedor. O caminho da **notícia**
  nunca recebeu tráfego algum — 100% dos 1.864 registros do sistema antigo entraram por pergunta
  nossa. Como o roteamento inteiro desta fatia depende de esse identificador voltar íntegro **no
  aviso**, a premissa é **desta fatia** e precisa ser medida aqui, não herdada por citação.
- ⚠️ **A integração está desligada em produção desde 2026-07-21**, e o arquivo do certificado foi
  renomeado (§13-A.3). Nada disso foi alterado pelas medições anteriores, e nada deve ser alterado
  por esta fatia: o sistema antigo **continua atendendo a operação** até a F7.
- **O produto passa a ser alcançável de fora, e isso é novo.** Até aqui tudo que entra vem de alguém
  com sessão. O alcance externo é **restrito ao caminho da notícia**, aditivo e reversível, e não
  toca o que atende a operação hoje. `[DELEGAR_TECH_SPEC]`
- **O provedor não autentica o que envia** — sem segredo compartilhado, sem assinatura, sem faixa de
  origem declarada. Isso não é escolha do produto; a compensação é a própria forma desta fatia: a
  chave de roteamento é nossa, a empresa vem do registro encontrado, o resto é conferência, o que não
  casa morre antes de qualquer consulta, e nada se grava sem perguntar ao provedor.
- **O provedor impõe a forma da confirmação de recebimento** — aceita apenas certas respostas e
  **reprova redirecionamento**; o encaminhamento interno não pode aparecer para ele. `[DELEGAR_TECH_SPEC]`
- **As datas do recebido vêm em fuso universal** e precisam ser lidas no fuso da operação.
  `[DELEGAR_TECH_SPEC]`
- **O prazo de guarda de 90 dias foi escolhido, não herdado.** Razão: uma divergência de conciliação
  se descobre no fechamento do mês seguinte, e 90 dias cobre esse ciclo com folga sem transformar o
  produto em arquivo de dado pessoal de terceiro. O número é do produto e pode ser revisto.
- ⚠️ **Um código de motivo continua sem resposta do provedor** — a pendência aberta na rodada 5b
  (decisão 22) segue com o usuário. Ela **não bloqueia** esta fatia: pela RN-07 o aviso não decide, e
  pela RN-18 motivo que o produto não reconhece é preservado como diagnóstico, exatamente como a
  fatia (ii) já fixou para a revogação por motivo desconhecido.
- ⚠️ **Os três débitos da F1 NÃO são disparados aqui — corrigido por medição em 2026-08-18.** O
  discovery (§C-1) previa como `[HIPÓTESE]` que D23, D24 e D27 ganhariam eixo com o alcance externo, e
  a primeira redação desta seção repetiu a previsão como se fosse fato. A leitura dos três marcadores
  a refuta, e cada um por razão própria: **D23** é a conferência de origem do arcabouço de sessão, que
  só corre quando a requisição traz os cabeçalhos que um navegador sempre envia — a notícia do
  provedor é chamada entre servidores, sem cookie e sem esses cabeçalhos; **D27** dimensiona o
  limitador das rotas de **autenticação**, que permanecem inalcançáveis de fora; **D24** exige a **API
  inteira** publicada. Publicar um caminho que não é de navegador nem de sessão não dá eixo de origem
  a nenhum dos três: eles seguem com gatilho na F7, intactos. O registro do mecanismo de cada um vive
  no D1 do `tech-alignment.md`; a confirmação por medição é da etapa técnica. `[DELEGAR_TECH_SPEC]`
- **Isolamento entre empresas** — nenhum dado bancário de uma empresa alcança outra, e isso é
  garantido pela plataforma, não por checagem de tela. Vale inclusive para o recebido cru, que **não
  tem empresa** enquanto não for roteado. `[DELEGAR_TECH_SPEC]`
- **Autorização** — pedir o carnê é ato de quem alcança o contrato dentro da empresa dele; receber a
  notícia do provedor é a única entrada sem sessão do produto, e é declarada como tal.
  `[DELEGAR_TECH_SPEC]`
- **Dependência integral das fatias (i) e (ii)** — a identidade perante o provedor, o identificador
  único, a emissão, a consulta, a liquidação, o estorno e a trilha bancária vêm prontos de lá. Esta
  fatia acrescenta **de onde o gatilho vem** e **como os boletos se reúnem**, não regra nova de
  liquidação.
- **A superfície publicada cresce, e é a última vez.** O discovery estimou duas ações para esta
  fatia. Depois dela e da F5, a superfície congela — é o que torna o handoff confiável. A contagem
  exata é da etapa técnica, por dupla medição independente. `[DELEGAR_TECH_SPEC]`
- **Fronteira do projeto** — nenhum código de frontend. As telas serão implementadas fora deste
  repositório, a partir do handoff que este backend produz.
- **Termos sem canonização** — "carnê", "aviso do provedor", "recebido cru" e "identificador da
  liquidação" são conceitos desta fatia que o glossário ainda não define. A canonização é da etapa de
  challenge, que é dona do glossário.

---

## 10. Métricas de Sucesso

- **O recebimento deixa de esperar pelo relógio**: o intervalo entre o pagamento e a cobrança se
  publicar paga cai de até um dia para minutos.
- **A conversa com o provedor passa a ser proporcional ao que aconteceu**, não ao que está em aberto:
  a conferência diária deixa de ser o único caminho de descoberta e passa a ser rede de segurança.
- **Nenhuma cobrança liquidada sem o provedor confirmar quando perguntado** — a medida direta de que
  a entrada aberta ao mundo não virou autoridade.
- **Nenhuma consulta ao provedor gasta com aviso que não casa** — o que não se reconhece morre antes.
- **Nenhum recebimento perdido durante suspensão de empresa** — tudo que chegou retido é aplicado na
  reativação.
- **O carnê deixa de ser trabalho do navegador**: um pedido por carnê, em vez de um por parcela.
- **Nenhum carnê entregue com parcela faltando** — ou sai completo, ou recusa nomeando o que falta.
- **Nenhum dado pessoal de pagador guardado sem prazo** — o recebido cru tem prazo declarado e é
  descartado.

---

## 11. Roadmap / Fases

As três fases abaixo são as **três fatias** da integração bancária, na ordem de dependência decidida
no discovery. Cada uma tem ciclo de especificação e execução próprio.

- **Fase 1 — `fundacao-bancaria` (concluída em 2026-08-15):** identidade da empresa perante o
  provedor, guarda protegida do material, estado derivado da validade, teste sob comando, fim do
  caminho de reserva e o identificador único do SaaS.
- **Fase 2 — `emissao-e-conciliacao` (concluída em 2026-08-18):** emitir em lote e pontualmente,
  revogar, entregar o boleto, liquidar a partir do provedor, estornar, conferir diariamente e expor o
  histórico bancário de uma cobrança.
- **Fase 3 — `webhook-e-carne` (esta):** receber do provedor a notícia do recebimento, sem que a
  entrada vire autoridade, e entregar o carnê montado aqui. Depende integralmente das duas
  anteriores; é a última fatia antes da F5 e do congelamento da superfície.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | O recebimento aparece minutos depois do pagamento | CA-01 |
| US-02 | O aviso é confirmado de imediato, sem esperar tratamento | CA-02 |
| US-03 | O recebido é guardado como chegou, antes de interpretar | CA-03 |
| US-04 | Aviso forjado não liquida cobrança | CA-04 |
| US-05 | Aviso órfão é descartado sem consultar o provedor | CA-05 |
| US-06 | Conta compartilhada não mistura carteiras | CA-06 |
| US-07 | A empresa vem da cobrança, nunca do recebido | CA-07 |
| US-08 | Divergência de conferência é registrada e recusada | CA-08 |
| US-09 | Reentrega do mesmo aviso não repete o efeito | CA-09 |
| US-10 | Empresa suspensa retém, e a reativação aplica | CA-10 |
| US-11 | O pedido de validação do endereço é respondido, e o cadastro se conclui | CA-11, CA-20 |
| US-12 | O recebido cru é descartado depois de 90 dias | CA-12 |
| US-13 | Aviso e conferência de rotina se distinguem na trilha | CA-13 |
| US-14 | Carnê por contrato e intervalo de competências | CA-14, CA-18, CA-19 |
| US-15 | Carnê sai mesmo sem o arquivo guardado aqui | CA-15 |
| US-16 | Carnê recusa nomeando a cobrança sem boleto | CA-16 |
| US-17 | O mesmo recorte produz o mesmo documento | CA-17 |
| US-18 | Vocabulário do provedor não vira regra nem estado | CA-21 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-18)
- [x] Critérios de aceite claros (CA-01 a CA-21)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão
- [x] Pronto para criar o TECH_SPEC (COMO)
