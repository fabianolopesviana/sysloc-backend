# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: `emissao-e-conciliacao` — fatia (ii) da F4 (integração bancária)
- **Responsável/Autor**: sysloc (usuário) · PRD conduzido por `/agent-spec-sdd-generate-prd`
- **Data**: 2026-08-16
- **Versão**: v1
- **Status**: Aprovado (pelo usuário em 2026-08-16)
- **Relacionados**:
  - `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md` — o discovery desta fase,
    **incluindo a emenda §13-A de 2026-08-16**, que é vinculante sobre a §13 onde as duas divergirem
  - `docs/prds/features/fundacao-bancaria/v1/prd.md` — a fatia (i), pré-requisito integral desta
  - `.claude/plans/plano-saas-decisoes.md` — decisões 19, 20, 21, 23 e 24
  - `docs/adr/` — 0001, 0011, 0016, 0017, 0018, 0020, 0021, 0022, 0028, 0029, 0030, 0031, 0032, 0033
  - `docs/plano-backend-novo/plano-execucao.md` §F4 e §F5

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** A cobrança bancária inteira vive no sistema antigo, que será
  desinstalado. Emitir boleto é ato **unitário**: quem cobra 47 aluguéis aciona a emissão 47 vezes.
  Descobrir que alguém pagou depende de **varredura repetida** — e a medição do próprio sistema
  mostra a distorção: **1.837 consultas de boleto para 16 cobranças**, quase sete por dia por título.
  Projetada para 300 empresas, essa varredura chega a centenas de milhares de chamadas diárias.
  E há seis informações que a cobrança já reserva e **nunca são preenchidas por ninguém**: o
  identificador que o provedor atribui, a linha digitável, o código de barras, a data de crédito, o
  valor creditado e o arquivo do boleto. Elas nascem vazias porque **o produtor delas não existe**.

- **Como funciona atualmente?** A imobiliária emite um boleto por vez; uma rotina consulta o provedor
  repetidamente sobre tudo que está em aberto; quando o provedor responde que o título foi liquidado,
  a cobrança passa a paga. Quando o provedor responde que o boleto foi **retirado de circulação**, o
  sistema antigo **cancela a cobrança** — apaga um valor a receber por decisão de terceiro. Não há
  emissão em lote, não há trilha consultável do que o provedor disse, e o estorno de um pagamento já
  confirmado não é descoberto por caminho nenhum.

- **Por que isso precisa ser resolvido agora?** Esta é a fatia que **gera dinheiro**: sem ela o
  produto novo não emite nem recebe. A fatia anterior entregou a identidade da empresa perante o
  provedor e o identificador único de cada cobrança, e não há mais nada entre ela e a emissão. A
  fatia seguinte — a notificação vinda do provedor e o carnê — só faz sentido com boleto existindo.
  Há ainda um **prazo real**: o certificado em uso vence em **2026-08-22**, seis dias após a redação
  deste documento (§9).

- **Quem sofre o impacto do problema?** O **Admin Empresa**, que emite e concilia à mão; o **Usuário
  Empresa** da operação e do financeiro, que não consegue explicar por que uma cobrança virou paga; o
  **Locatário**, que depende de receber o boleto para pagar; e o operador da plataforma, que responde
  pela conta de chamadas ao provedor.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o produto novo **emita, entregue, confira e liquide** cobranças
  junto ao provedor: a emissão do mês num comando só, a reemissão pontual sem deixar dois boletos
  pagáveis, o boleto obtenível por quem tem acesso à cobrança, o pagamento chegando sozinho com data
  e valor, o estorno devolvendo a cobrança ao estado anterior, e tudo que o provedor disse sobre uma
  cobrança consultável em ordem.

- **Qual mudança de comportamento esta feature deve gerar?** Emitir deixa de ser repetição manual e
  passa a ser um ato sobre um conjunto. Conferir deixa de ser varredura sem fim e passa a ser uma
  passada diária sobre o que ainda importa. E o provedor deixa de poder **apagar** um valor a
  receber: o que ele retira é o boleto, nunca a dívida.

- **Qual o resultado final esperado do ponto de vista do usuário?** O Admin informa a competência, os
  boletos saem, ele entrega cada um ao locatário, e os pagamentos aparecem sozinhos. Quando algo
  destoa, ele abre a cobrança e **lê o que aconteceu** — em vez de descobrir consultando o provedor
  por fora.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Emissão em lote por competência** — o Admin informa o mês e o sistema reúne sozinho as
      cobranças em aberto daquela competência que ainda não têm boleto, emitindo todas.
- [ ] **Prestação de contas do lote** — ao final, quantas saíram e quais não saíram, nomeando cada
      cobrança e a razão de cada falha.
- [ ] **Distinção entre falha da cobrança e falha da empresa** — a primeira marca aquela cobrança e o
      lote segue; a segunda interrompe o lote no ponto em que ocorreu.
- [ ] **Emissão unitária e reemissão** — sobre uma cobrança específica, com resposta imediata; a
      reemissão retira o boleto anterior de circulação junto ao provedor antes de emitir o novo.
- [ ] **Retirada de boleto de circulação junto ao provedor** — operação que a fatia ganha por efeito
      da decisão de reemissão (§9).
- [ ] **Entrega do boleto** — o arquivo do boleto de uma cobrança, obtenível por quem tem acesso a
      ela; arquivo indisponível localmente é obtido de novo do provedor.
- [ ] **Liquidação a partir do provedor** — o que ele responde quando consultado marca a cobrança
      como paga, com a data e o valor que ele informou.
- [ ] **Estorno** — apaga o fato do pagamento, registra o estorno, e o estado volta a ser derivado.
- [ ] **Trilha bancária por cobrança** — o que o produto soube do provedor sobre uma cobrança,
      na ordem em que aconteceu, isolada por empresa e consultável por rota.
- [ ] **Regra de reconciliação diária** — o conjunto que ela confere e o que ela faz com cada
      desfecho, mais um **disparo sob comando** que não inicia uma segunda execução concorrente.
- [ ] **Produção das seis informações hoje órfãs** — identificador atribuído pelo provedor, linha
      digitável, código de barras, data de crédito, valor creditado e arquivo do boleto.

### 4.2 O que está explicitamente fora do escopo

- [ ] **Qualquer código de frontend** — o fonte vive na máquina local do usuário e será implementado
      lá, a partir do handoff que este backend produz. Task que peça isso é **gatilho de parada**.
- [ ] **A notificação vinda do provedor (webhook)** e tudo que ela exige — borda pública, roteamento
      da notificação, registro do que não casa com cobrança nenhuma. É a fatia (iii).
- [ ] **O carnê** — reunir vários boletos num documento só. É a fatia (iii).
- [ ] **O agendamento por horário** da reconciliação — esta fatia entrega a **regra** e o disparo sob
      comando; o gatilho automático é da F5.
- [ ] **A cobrança por Pix** — o meio de recebimento está previsto no modelo desde a fatia (i) e
      continua sem operação (decisão 18).
- [ ] **Visão das notificações recusadas** — adiada com gatilho pelo discovery (§C-2).
- [ ] **Reescrever o que a F3 fechou** — a cobrança, a mora, a régua e a derivação de estado são
      **consumidas** como estão.
- [ ] **Estado intermediário de pagamento** — decidido não criar (decisão 19).

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Admin Empresa** — quem emite o mês, reemite quando corrige,
  entrega o boleto ao locatário e confere quando desconfia.
- **Qual é seu objetivo ao usar essa feature?** Cobrar o mês inteiro sem repetição manual, e saber
  quem pagou sem perguntar ao banco por fora.
- **Quais dores/dificuldades essa feature resolve pra ele?** A emissão uma a uma; a impossibilidade
  de explicar por que uma cobrança mudou de estado; o boleto que existe no provedor e que ele não
  consegue entregar; e a cobrança que o sistema antigo cancelava sozinho.

Personas secundárias:

- **Usuário Empresa** (operação e financeiro) — precisa entender *por que* uma cobrança virou paga,
  e é o leitor natural da trilha bancária.
- **Locatário** — recebe o boleto e paga; não tem sessão no produto.
- **Provedor** — ator **externo**. Responde consultas e executa o que se pede; não é usuário, e nesta
  fatia nunca inicia uma conversa (isso é da fatia (iii)).
- **Operador da plataforma** — não opera dado de empresa nenhuma; responde pelo volume de chamadas ao
  provedor e pela integridade do vocabulário próprio do produto.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Admin Empresa**, quero emitir de uma vez os boletos de todas as cobranças de uma
  competência, para não acionar a emissão uma vez por cobrança.
- **US-02**: Como **Admin Empresa**, quero que o lote me preste contas do que saiu e do que não saiu,
  nomeando cada cobrança e a razão, para tratar as exceções sabendo quais são.
- **US-03**: Como **Admin Empresa**, quero que uma falha que é da minha empresa interrompa o lote na
  hora, para não acumular a mesma falha repetida em todas as cobranças.
- **US-04**: Como **Admin Empresa**, quero reemitir o boleto de uma cobrança que corrigi e ter
  certeza de que o anterior deixou de ser pagável, para o locatário não pagar o valor errado.
- **US-05**: Como **Admin Empresa**, quero obter o boleto de uma cobrança para entregá-lo ao
  locatário, mesmo que o arquivo não esteja mais guardado aqui.
- **US-06**: Como **Admin Empresa**, quero que o pagamento feito pelo locatário apareça no produto
  sem eu fazer nada, com a data e o valor que o provedor informou.
- **US-07**: Como **Admin Empresa**, quero que o estorno de um pagamento devolva a cobrança ao estado
  em que ela estaria, respeitando o vencimento, para não cobrar quem pagou nem deixar de cobrar quem
  não pagou.
- **US-08**: Como **Usuário Empresa**, quero ver o histórico bancário de uma cobrança para entender
  por que ela virou paga — ou por que deixou de ter boleto.
- **US-09**: Como **Admin Empresa**, quero disparar a conferência quando eu desconfiar de alguma
  divergência, sem esperar a passada do dia.
- **US-10**: Como **Admin Empresa**, quero que um boleto retirado de circulação no provedor **não
  apague** a dívida, para que nenhum valor a receber suma por decisão de terceiro.
- **US-11**: Como **Admin Empresa**, quero que o produto confira diariamente contra o provedor o que
  ainda importa, tratando o que ele responde como a verdade.
- **US-12**: Como **Usuário Empresa**, quero ver na cobrança o identificador do provedor, a linha
  digitável, o código de barras e — uma vez creditada — a data e o valor do crédito, hoje sempre
  vazios.
- **US-13**: Como **operador da plataforma**, quero que nenhum termo, código ou desfecho do provedor
  vire regra ou estado do produto, para que trocar de provedor não obrigue a reescrever o domínio.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — A emissão em lote reúne, por **competência**, as cobranças **em aberto** da empresa que
  ainda não têm boleto. A seleção é do sistema: o Admin informa a competência, e nada mais.
- **RN-02** — Falha que é **da cobrança** (cadastro incompleto, recusa pontual do provedor) marca
  aquela cobrança e o lote segue. Falha que é **da empresa** (certificado inservível, provedor
  indisponível) interrompe o lote no ponto em que ocorreu, porque toda cobrança seguinte falharia
  pela mesma razão. O que já foi emitido **nunca** é desfeito.
- **RN-03** — Emitir a mesma competência de novo tenta **apenas** o que ainda não tem boleto. Nenhuma
  cobrança chega a ter dois boletos pagáveis ao mesmo tempo.
- **RN-04** — Reemitir é **um ato só**: o boleto vivo é retirado de circulação junto ao provedor e o
  novo é emitido em seguida. Se a retirada for aceita e a emissão falhar, a cobrança fica **sem
  boleto** e o produto declara isso nomeando-a — nunca deixa os dois vivos.
- **RN-05** — O produto entrega o boleto de uma cobrança a quem tem acesso a ela. Arquivo
  indisponível localmente é obtido de novo do provedor; boleto **nunca emitido** é recusa nomeada, e
  jamais documento em branco.
- **RN-06** — O pagamento só é registrado a partir do que o provedor responde **quando consultado**.
  A mera notícia de que houve pagamento não move nada.
- **RN-07** — Na baixa vinda do provedor, a **data** e o **valor pagos** são os que ele informou; a
  **multa** e os **juros** carimbados são derivados da política de mora vigente no instante da baixa
  — a **mesma regra** da baixa manual, sem exceção por caminho de entrada. Divergência entre o valor
  pago e o valor que o produto esperava **não impede** a baixa: fica registrada na trilha.
- **RN-08** — O estorno **apaga o fato** do pagamento e registra o estorno. O estado volta a ser
  derivado: *vencida* se o vencimento já passou, *pendente* se não passou.
- **RN-09** — Boleto retirado de circulação no provedor **não cancela** a cobrança. Ela permanece em
  aberto, passa a não ter boleto, e pode ser emitida de novo como se fosse a primeira vez.
- **RN-10** — Cancelar uma cobrança continua sendo **ato de quem opera**, com data própria. Nenhum
  desfecho do provedor cancela cobrança.
- **RN-11** — A conferência diária alcança **toda cobrança em aberto com boleto emitido** e **toda
  cobrança paga há 30 dias ou menos com boleto emitido** — estas últimas para que um estorno seja
  descoberto sem depender da notificação do provedor, que é da fatia seguinte.
- **RN-12** — A conferência pode ser disparada sob comando pelo Admin, **para a empresa dele**.
  Disparar de novo enquanto uma execução da mesma empresa está em curso não inicia uma segunda.
- **RN-13** — Tudo que o produto soube do provedor sobre uma cobrança fica registrado como trilha, na
  ordem em que aconteceu, pertence a uma empresa e é consultável por cobrança.
- **RN-14** — O estado de uma cobrança **nunca** é uma marca gravada: continua derivado dos fatos
  registrados, como a fase anterior fixou.
- **RN-15** — Nenhum termo, código ou desfecho do provedor vira regra ou estado do produto. O que ele
  informou é preservado **apenas como diagnóstico** na trilha — inclusive quando o produto não
  reconhece o que ele disse.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Admin abre a cobrança bancária da empresa dele e informa a **competência** que quer emitir.
2. O sistema reúne as cobranças em aberto daquela competência que ainda não têm boleto e começa a
   emitir. O Admin **não fica esperando**: o andamento é acompanhável. `[DELEGAR_TECH_SPEC]`
3. Ao final, o sistema informa quantos boletos saíram e quais cobranças não saíram, nomeando cada uma
   e a razão.
4. O Admin abre uma cobrança emitida e **obtém o boleto** — o arquivo, a linha digitável e o código
   de barras — para entregá-lo ao locatário.
5. O locatário paga. Na conferência seguinte, o produto pergunta ao provedor o estado daquele boleto,
   recebe que foi liquidado com data e valor, e a cobrança passa a **publicar-se paga**, com a mora
   carimbada pela política vigente.
6. Quem precisar entender o que aconteceu abre o **histórico bancário** da cobrança e lê, em ordem, a
   emissão, as conferências, a liquidação e qualquer divergência registrada.

### 7.2 Fluxos Alternativos

- **Uma cobrança do lote falha por causa própria** → é marcada com a razão, o lote **segue**, e ela
  aparece na prestação de contas do final.
- **A falha é da empresa** (certificado inservível, provedor fora do ar) → o lote é **interrompido no
  ponto em que ocorreu**; o que já saiu permanece emitido e as não tentadas permanecem sem boleto.
  Corrigida a causa, emitir a mesma competência retoma o que faltou.
- **O Admin manda emitir a mesma competência de novo** → só as cobranças ainda sem boleto são
  tentadas; ninguém recebe um segundo boleto.
- **Reemissão** → o boleto anterior é retirado de circulação junto ao provedor e o novo é emitido; ao
  final, apenas o novo é pagável.
- **A retirada é aceita e a emissão do novo falha** → o produto informa que a cobrança ficou **sem
  boleto**, nomeando-a; o estado dela permanece em aberto e ela pode ser emitida de novo.
- **O arquivo do boleto não está mais disponível aqui** → é obtido de novo do provedor e entregue,
  sem que quem pediu perceba diferença.
- **Pediram o boleto de uma cobrança que nunca foi emitida** → recusa nomeando a cobrança e a
  ausência; nunca um documento em branco.
- **O valor pago informado pelo provedor não corresponde ao esperado** → a cobrança é marcada como
  paga assim mesmo, e a divergência fica registrada no histórico bancário dela.
- **O provedor informa que o pagamento foi estornado** → a cobrança deixa de publicar-se paga e volta
  a *vencida* ou *pendente* conforme o vencimento; o estorno fica no histórico. A partir daí ela
  volta a ser uma cobrança em aberto para todos os efeitos, **inclusive para os avisos** (§9).
- **O provedor informa que o boleto foi retirado de circulação**, por motivo reconhecido ou não → a
  cobrança **permanece em aberto**, passa a não ter boleto, e o ocorrido — com o motivo tal como o
  provedor o informou — fica registrado. Cancelar a cobrança continua dependendo de quem opera.
- **O Admin dispara a conferência com uma já em curso na empresa dele** → nenhuma segunda execução é
  iniciada, e ele é informado de que já há uma acontecendo.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO cobranças em aberto de uma competência, sem boleto QUANDO o Admin manda emitir
      o lote daquela competência ENTÃO todas elas recebem boleto, e nenhuma cobrança de outra
      competência, já paga, já cancelada ou que já tinha boleto é incluída.
- [ ] **CA-02**: DADO um lote em que algumas cobranças falham por causa própria QUANDO o lote termina
      ENTÃO ele informa quantas saíram e quais não saíram, nomeando cada cobrança e a razão de cada
      falha.
- [ ] **CA-03**: DADO um lote em andamento QUANDO ocorre uma falha que é da empresa ENTÃO o lote é
      interrompido naquele ponto, as cobranças ainda não tentadas permanecem sem boleto, e todas as
      já emitidas permanecem emitidas.
- [ ] **CA-04**: DADO um lote já executado para uma competência QUANDO o Admin manda emitir a mesma
      competência de novo ENTÃO apenas as cobranças ainda sem boleto são tentadas, e nenhuma cobrança
      passa a ter dois boletos pagáveis.
- [ ] **CA-05**: DADO uma cobrança com boleto vivo QUANDO o Admin a reemite ENTÃO o boleto anterior é
      retirado de circulação junto ao provedor antes de o novo ser emitido, e ao final apenas o novo
      é pagável.
- [ ] **CA-06**: DADO uma reemissão em que a retirada do anterior foi aceita e a emissão do novo
      falhou QUANDO o ato termina ENTÃO o produto informa que a cobrança ficou sem boleto, nomeando-a,
      o estado dela permanece em aberto, e nenhum boleto pagável restou.
- [ ] **CA-07**: DADO uma cobrança com boleto emitido QUANDO quem tem acesso a ela pede o boleto
      ENTÃO recebe o arquivo do boleto, e a cobrança publica a linha digitável e o código de barras.
- [ ] **CA-08**: DADO uma cobrança cujo arquivo de boleto não está mais disponível localmente QUANDO
      alguém pede o boleto ENTÃO o produto o obtém de novo do provedor e o entrega, sem falhar e sem
      exigir nada de quem pediu.
- [ ] **CA-09**: DADO uma cobrança sem boleto emitido QUANDO alguém pede o boleto ENTÃO o produto
      recusa nomeando a cobrança e a ausência, e não entrega documento algum.
- [ ] **CA-10**: DADO um boleto que o provedor informa liquidado, com data e valor QUANDO a
      conferência o encontra ENTÃO a cobrança passa a publicar-se paga, com a data e o valor
      informados pelo provedor, e com multa e juros derivados da política de mora vigente no instante
      da baixa.
- [ ] **CA-11**: DADO uma baixa vinda do provedor cujo valor pago não corresponde ao que o produto
      esperava QUANDO a baixa é aplicada ENTÃO a cobrança é marcada como paga assim mesmo, e a
      divergência fica registrada no histórico bancário dela.
- [ ] **CA-12**: DADO uma cobrança paga QUANDO o provedor informa que o pagamento foi estornado
      ENTÃO ela deixa de publicar-se paga e volta a publicar-se *vencida* se o vencimento já passou
      ou *pendente* se não passou, e o estorno fica registrado no histórico.
- [ ] **CA-13**: DADO uma cobrança com eventos bancários QUANDO o usuário consulta o histórico
      bancário dela ENTÃO vê, na ordem em que aconteceram, o que se passou com o boleto — emissão,
      retirada, conferência, liquidação, estorno e divergência — com data e desfecho de cada um.
- [ ] **CA-14**: DADO um usuário de uma empresa QUANDO ele consulta o histórico bancário de uma
      cobrança de outra empresa ENTÃO o produto responde como se ela não existisse.
- [ ] **CA-15**: DADO o Admin querendo conferir agora QUANDO ele dispara a conferência ENTÃO ela
      alcança apenas cobranças da empresa dele; e QUANDO ele dispara de novo com uma execução da
      mesma empresa ainda em curso ENTÃO nenhuma segunda é iniciada e ele é informado disso.
- [ ] **CA-16**: DADO a conferência diária QUANDO ela seleciona o que conferir ENTÃO o conjunto é
      exatamente toda cobrança em aberto com boleto emitido mais toda cobrança paga há 30 dias ou
      menos com boleto emitido — nenhuma a mais, nenhuma a menos.
- [ ] **CA-17**: DADO um boleto que o provedor informa retirado de circulação, seja por motivo
      reconhecido ou por motivo que o produto não reconhece QUANDO a conferência o encontra ENTÃO a
      cobrança permanece em aberto, passa a não ter boleto, não é cancelada, e o ocorrido — com o
      motivo tal como o provedor o informou — fica registrado no histórico bancário.
- [ ] **CA-18**: DADO uma cobrança que teve o boleto retirado de circulação QUANDO o Admin manda
      emitir de novo ENTÃO a emissão ocorre normalmente, como se fosse a primeira.
- [ ] **CA-19**: DADO uma cobrança com boleto emitido QUANDO alguém a consulta ENTÃO ela publica o
      identificador atribuído pelo provedor, a linha digitável e o código de barras; e DADO que ela
      já foi creditada ENTÃO publica também a data e o valor do crédito.
- [ ] **CA-20**: DADO tudo que o produto publica e registra nesta fatia QUANDO se examina esse
      vocabulário ENTÃO nenhum nome de campo, código ou desfecho do provedor aparece como regra ou
      como estado do produto, e o que ele informou consta apenas como diagnóstico.

---

## 9. Restrições & Considerações

- ⚠️ **Risco datado — o certificado em uso vence em 2026-08-22**, seis dias após a redação deste PRD,
  e a medição de 2026-08-16 (§13-A.2 do discovery) o comprovou por leitura do próprio material. **Sem
  certificado válido nada desta fatia opera contra o provedor.** Decisão do usuário na mesma data:
  **assumir a renovação** e seguir o plano, inclusive com chamada real ao provedor onde ela for a
  única prova possível.
- ⚠️ **A integração está desligada em produção desde 2026-07-21** e o arquivo do certificado foi
  renomeado (§13-A.3). Nada disso foi alterado pela medição, e nada deve ser alterado por esta fatia:
  o sistema antigo **continua atendendo a operação** até a F7.
- **A superfície publicada cresce, e acima do que o discovery estimou.** A estimativa era de **5
  ações** para esta fatia; as decisões tomadas aqui acrescentam **duas**: retirar boleto de
  circulação junto ao provedor (efeito da forma escolhida para a reemissão) e entregar o boleto de
  uma cobrança. A contagem exata é da etapa técnica, por dupla medição independente.
  `[DELEGAR_TECH_SPEC]`
- **A regra de mora é uma só, e a exposição que ela carrega é anterior a esta fatia.** O boleto sai
  carregando as cláusulas de mora vigentes **na emissão**, e o carimbo do produto usa as vigentes
  **no pagamento**. Mudar a política entre um momento e outro faz o provedor cobrar por uma e o
  produto carimbar por outra. Isto **não é criado aqui** — a baixa manual já tem a mesma exposição —,
  e o que esta fatia acrescenta é o lugar onde a divergência fica visível (RN-07, CA-11). Fechar a
  diferença mudaria a regra de carimbo do produto inteiro e **não pertence a esta fatia**.
- **O estorno devolve a cobrança ao alcance dos avisos.** Como o estado é derivado, uma cobrança
  estornada volta a ser cobrança em aberto — e a régua de cobrança volta a considerá-la. É
  consequência da derivação, não decisão nova; fica registrada para que ninguém a leia como defeito.
- **A prova de que o identificador perante o provedor volta íntegro alcança só a consulta.** A sonda
  de 2026-08-16 (§13-A.1) mediu 3 de 3 com igualdade exata **no caminho de consulta**, que é o desta
  fatia. Ela **não** prova o payload da notificação, que é da fatia (iii) e permanece sem tráfego
  algum medido. Não escreva essa prova mais larga do que ela é.
- **A credencial de acesso ao provedor tem validade muito curta** (medida em minutos), o que pesa na
  forma de obtê-la e reaproveitá-la. `[DELEGAR_TECH_SPEC]`
- **Isolamento entre empresas** — nenhum dado bancário de uma empresa alcança outra, e isso é
  garantido pela plataforma, não por checagem de tela. `[DELEGAR_TECH_SPEC]`
- **Autorização** — emitir, reemitir, retirar de circulação, obter o boleto e disparar a conferência
  são atos do **Admin Empresa**; consultar o histórico bancário é ato de quem já alcança a cobrança.
  Nenhum deles é público e nenhum deles é do operador da plataforma. `[DELEGAR_TECH_SPEC]`
- **Nada do que a fase anterior fechou é reescrito** — a cobrança, a mora, a régua e a derivação do
  estado são consumidas exatamente como estão.
- **Dependência integral da fatia (i)** — a identidade da empresa perante o provedor e o
  identificador único de cada cobrança vêm de lá, prontos.
- **Fronteira do projeto** — nenhum código de frontend. As telas serão implementadas fora deste
  repositório, a partir do handoff que este backend produz.
- ⚠️ **Duas ambiguidades de vocabulário a canonizar** — não são deste PRD, e sim da etapa de
  challenge, que é a dona do glossário:
  1. **"Baixa" tem dois sentidos** e o sistema antigo usa o oposto do discovery: lá, *solicitar
     baixa* é **pedir ao provedor que retire o boleto de circulação**; no discovery, "baixa" aparece
     como **liquidação**. Este PRD evita a palavra e nomeia as duas operações por extenso.
  2. **Falta termo canônico para o identificador que o provedor atribui ao boleto.** O glossário
     define *Identificador perante o provedor* como a cadeia de 18 posições que **o produto** gera, e
     lista "nosso número" entre os termos a evitar — mas o identificador **atribuído pelo provedor** é
     conceito distinto, existe como informação própria da cobrança e não tem nome canônico.

---

## 10. Métricas de Sucesso

- **Nenhuma cobrança com dois boletos pagáveis ao mesmo tempo**, em nenhum momento — incluindo o
  caminho da reemissão e o da reexecução de um lote.
- **Nenhuma cobrança cancelada sem ato de quem opera** — a medida direta de que o produto deixou de
  reproduzir o comportamento do sistema antigo.
- **Consultas ao provedor por cobrança caem de duas ordens de grandeza**: hoje são 1.837 para 16
  cobranças (≈115 por cobrança); a conferência diária faz no máximo uma por dia por cobrança
  alcançada, e a fatia seguinte reduz ainda mais ao trocar a passada pela notificação.
- **A emissão do mês passa a ser um comando** — o número de acionamentos por competência cai de um
  por cobrança para um por empresa.
- **As seis informações deixam de nascer órfãs**: toda cobrança com boleto emitido publica
  identificador do provedor, linha digitável e código de barras; toda cobrança creditada publica data
  e valor do crédito.
- **Toda mudança de estado de origem bancária é explicável sem sair do produto** — para qualquer
  cobrança que mudou de estado, o histórico responde por quê.

---

## 11. Roadmap / Fases

As três fases abaixo são as **três fatias** da integração bancária, na ordem de dependência decidida
no discovery. Cada uma tem ciclo de especificação e execução próprio.

- **Fase 1 — `fundacao-bancaria` (concluída em 2026-08-15):** identidade da empresa perante o
  provedor, guarda protegida do material, estado derivado da validade, teste sob comando, fim do
  caminho de reserva e o identificador único do SaaS.
- **Fase 2 — `emissao-e-conciliacao` (esta):** emitir em lote e pontualmente, retirar de circulação,
  entregar o boleto, liquidar a partir do provedor, estornar, conferir diariamente e expor o
  histórico bancário de uma cobrança.
- **Fase 3 — `webhook-e-carne`:** receber do provedor a notificação de baixa e entregar o carnê
  montado no servidor. Depende das duas anteriores.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Emitir de uma vez os boletos de uma competência | CA-01, CA-04 |
| US-02 | O lote presta contas do que saiu e do que não saiu | CA-02 |
| US-03 | Falha da empresa interrompe o lote na hora | CA-03 |
| US-04 | Reemitir sem deixar dois boletos pagáveis | CA-05, CA-06 |
| US-05 | Obter o boleto para entregar ao locatário | CA-07, CA-08, CA-09 |
| US-06 | O pagamento aparece sozinho, com data e valor | CA-10, CA-11 |
| US-07 | O estorno devolve a cobrança ao estado anterior | CA-12 |
| US-08 | Histórico bancário explica por que a cobrança mudou | CA-13, CA-14 |
| US-09 | Disparar a conferência sob comando, sem duplicar | CA-15 |
| US-10 | Boleto retirado não apaga a dívida | CA-17, CA-18 |
| US-11 | Conferência diária alcança o que ainda importa | CA-16 |
| US-12 | A cobrança publica as informações hoje órfãs | CA-19 |
| US-13 | Vocabulário do provedor não vira regra nem estado | CA-20 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-13)
- [x] Critérios de aceite claros (CA-01 a CA-20)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão
- [x] Pronto para criar o TECH_SPEC (COMO)
