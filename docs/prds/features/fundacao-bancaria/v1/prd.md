# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados

- **Nome da Feature/Projeto**: Fundação bancária — cada empresa passa a falar com o provedor com a
  identidade dela, e toda cobrança que vai ao provedor nasce com um identificador que não se repete em
  lugar nenhum do SaaS
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-14
- **Versão**: v1
- **Status**: Aprovado (pelo usuário, em 2026-08-14)
- **Relacionados**:
  - Discovery da fase: `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md`
    — **fatia (i) de 3**; as outras duas são `emissao-e-conciliacao` e `webhook-e-carne`, nesta ordem
  - Fase: `docs/plano-backend-novo/plano-execucao.md` §F4 · briefing em
    `docs/plano-backend-novo/briefings/f4-integracao-bancaria-sicoob.md`
  - Integração equivalente no sistema antigo (**insumo de leitura, não se sobrescreve**):
    `docs/specs/features/integracao-bancaria-configuravel/` (v1 a v6-debits)
  - Fatia que entrega a cobrança que esta fundação vai numerar:
    `docs/specs/features/cobranca-e-mora/v1/` — a F4 **consome**, não reescreve
  - Fatia que estabeleceu a série declarada e o precedente de contador:
    `docs/specs/features/contratos-de-locacao/v1/`
  - Decisões de produto já fechadas: `.claude/plans/plano-saas-decisoes.md`, decisões **9**
    (cada empresa com a própria integração), **18** (generalizar o meio de recebimento e não
    implementar pix) e **23** (identificador perante o provedor único do SaaS, em linha própria)
  - Decisões vinculantes: **ADR-0001** (vocabulário do provedor não cruza a fronteira do produto),
    ADR-0008, ADR-0009, ADR-0011, ADR-0016, ADR-0017, ADR-0018, **ADR-0020** (contador por escopo
    declarado, cujo avanço não se desfaz) e **ADR-0031** (o que não é dado de empresa nenhuma vive
    fora do território de negócio e não carrega dono) — esta última é **pré-requisito desta fatia** e
    já está `accepted`

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** A cobrança bancária inteira vive no sistema antigo, que será
  desinstalado, e ela nasceu **de uma empresa só**. Duas consequências, e as duas quebram no primeiro
  dia de operação multi-empresa. **A primeira**: a identidade que o sistema apresenta ao provedor é
  única e compartilhada — existe um caminho de reserva que atende qualquer empresa que não tenha a
  própria, o que significa que uma cobrança pode ir ao provedor assinada por quem não é o credor dela.
  **A segunda**: o número que identifica cada cobrança perante o provedor é gerado por um mecanismo que
  exige que exista **exatamente uma** configuração ativa no sistema; com duas empresas cobrando, ele
  não tem como decidir de quem é a vez, e o primeiro mês com duas imobiliárias emitindo é o mês em
  que dois boletos disputam o mesmo número.
- **Como funciona atualmente?** O material que identifica o sistema perante o provedor é instalado no
  servidor e trocado por quem tem acesso ao servidor — não pela imobiliária que é dona dele. A
  imobiliária não vê a validade, não sabe quando vence, e descobre que venceu no dia em que a emissão
  do mês falha. O contador do identificador é global e nunca reinicia, mas está preso à configuração
  de uma empresa, e o mês que aparece nele é decorativo: quem garante a unicidade é a sequência.
- **Por que isso precisa ser resolvido agora?** Porque as outras duas fatias da fase **não podem
  começar sem isto**. Emitir, consultar, dar baixa e conciliar (fatia ii) pressupõem uma identidade
  por empresa e um identificador que não colide; o webhook (fatia iii) usa esse mesmo identificador
  como a chave para descobrir de quem é a notificação que chegou. Errar a fundação aqui não custa uma
  correção — custa reescrever as duas fatias seguintes. Some-se que esta é a primeira vez que o
  produto **guarda um segredo de terceiro**, e a fase anterior pagou caro para descobrir, por
  medição, que segredo perto da maquinaria errada vaza por caminho que ninguém lê.
- **Quem sofre o impacto do problema?** A **imobiliária (Admin da empresa)**, que hoje depende de
  alguém com acesso ao servidor para renovar o que é dela e não tem como saber se está tudo em ordem;
  o **operador da plataforma**, que responde por um número que não pode se repetir entre clientes e
  que hoje não tem como garantir isso; e, na ponta, o **locatário**, que receberia uma cobrança
  identificada errado — falha que só aparece depois, quando o dinheiro já se moveu.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que cada empresa passe a se apresentar ao provedor com a identidade
  **dela**, operada por ela mesma, sem intermediário e sem caminho de reserva; e que exista um
  identificador de cobrança bancária **único em todo o SaaS**, que nunca se repete e nunca volta
  atrás.
- **Qual mudança de comportamento esta feature deve gerar?** Deixa de existir identidade
  compartilhada: empresa sem material próprio **não emite**, e a recusa diz o nome da empresa e a
  razão, em vez de silenciosamente usar a de outro. A renovação deixa de ser tarefa de quem opera o
  servidor e passa a ser ato do Admin da empresa, em minutos. E o vencimento deixa de ser uma
  surpresa: o sistema informa quanto falta sempre que alguém pergunta.
- **Qual o resultado final esperado do ponto de vista do usuário?** O Admin da imobiliária registra o
  certificado da empresa dele, confere ali mesmo que o provedor aceitou aquela identidade, vê quanto
  tempo falta para vencer, e troca quando vencer — sem abrir chamado e sem que o segredo que ele
  entregou volte para ele, apareça num diagnóstico ou saia por qualquer resposta do sistema.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Registro do certificado por empresa** — o Admin da empresa entrega o material que identifica
      a empresa perante o provedor, mais a senha que o abre, e o sistema o aceita depois de conferir que
      ele é legível e ainda vale.
- [ ] **Guarda protegida do material** — o que foi entregue fica ilegível para quem alcance o
      armazenamento, e **nunca volta**: nenhuma consulta, resposta ou diagnóstico devolve o material
      ou a senha. `[DELEGAR_TECH_SPEC]` — a forma da proteção.
- [ ] **Consulta do que está valendo** — titular, validade, impressão digital, quem registrou e desde
      quando, mais o **estado derivado** da validade contra a data corrente: vigente, vencendo ou
      vencido.
- [ ] **Aviso antecipado como estado publicado** — certificado a menos de 30 dias do vencimento é
      apresentado como *vencendo* em toda consulta, sem que nada seja enviado e sem depender de
      rotina agendada (o agendamento por horário é da fase seguinte do plano).
- [ ] **Teste contra o provedor, sob comando do Admin** — ato explícito e sem efeito colateral, que
      responde se o provedor aceitou a identidade da empresa. É o que permite descobrir um certificado
      inservível **agora**, e não na emissão do mês.
- [ ] **Renovação por substituição** — o novo passa a valer; do anterior fica o registro do que ele
      era, e o material secreto dele é descartado no ato.
- [ ] **Fim do caminho de reserva** — empresa sem certificado próprio falha de forma explícita e
      nomeada; em nenhuma hipótese o sistema recorre a uma identidade genérica ou à de outra empresa.
- [ ] **Identificador perante o provedor único no SaaS** — 18 caracteres, sendo 6 do prefixo de
      competência e 12 do **contador sequencial**, que **não reinicia** e é o mesmo para todas as
      empresas; o número entregue nunca é reaproveitado, mesmo que a operação que o pediu seja
      desfeita.
- [ ] **Vocabulário próprio para cobrança bancária** — o produto descreve cobrança bancária com
      termos seus, prevendo o **meio de recebimento** como conceito (boleto e pix), sem que nenhum
      nome de campo ou código do provedor entre nesse vocabulário.
- [ ] **Prova, por medição, de que o segredo não escapa** — nenhum material de certificado e nenhuma
      senha alcança registro, mensagem de erro, diagnóstico ou anexo de falha.

### 4.2 O que está explicitamente fora do escopo

- [ ] **Emitir, consultar, dar baixa e conciliar cobrança** — é a fatia (ii), `emissao-e-conciliacao`.
      Esta fatia entrega a fundação de que aquela depende, e nada além.
- [ ] **Receber a notificação de baixa do provedor e montar o carnê** — é a fatia (iii),
      `webhook-e-carne`.
- [ ] **Implementar pix** — o meio de recebimento fica previsto no vocabulário; nenhuma operação de
      pix é construída (decisão 18).
- [ ] **Aviso de vencimento enviado ao Admin** — decidido em 2026-08-14: o alerta é estado publicado
      na consulta, não mensagem enviada. Enviar exigiria rotina agendada (fase seguinte) e criaria a
      terceira mensagem do produto, com efeito colateral em débito já registrado.
- [ ] **Qualquer agendamento por horário** — pertence à fase de rotinas.
- [ ] **Bloquear a operação da empresa antes de o certificado vencer** — descartado no discovery
      (direção H4): recusaria trabalho que ainda funcionaria; o estado *vencendo* já cobre o caso.
- [ ] **Remover o certificado sem substituto** — não há caso de uso: renovar é substituir, e deixar a
      empresa sem identidade só a torna inoperante. Decisão de escopo desta spec, registrada aqui
      para que não seja lida como esquecimento.
- [ ] **O operador da plataforma registrar ou consultar o certificado de uma empresa** — quem opera é
      o Admin da empresa (direção H1); as alternativas em que o operador do SaaS é intermediário
      foram podadas justamente por criar essa dependência a cada renovação.
- [ ] **Qualquer código de frontend** — fronteira do projeto. As telas que o Admin usa serão
      implementadas fora deste repositório, a partir do handoff.
- [ ] **Capturar comportamento do sistema antigo como oráculo** — podado por medição no discovery: o
      fonte e a suíte legados estão versionados e não expiram.

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Admin da empresa** — quem administra a imobiliária dentro do
  produto. É ele que possui o certificado, que recebe a renovação do provedor e que responde quando a
  cobrança do mês não sai.
- **Qual é seu objetivo ao usar essa feature?** Deixar a empresa dele apta a cobrar pelo provedor, e
  continuar apta — sem depender de terceiro, e sabendo com antecedência quando vai precisar agir.
- **Quais dores/dificuldades essa feature resolve pra ele?** Não depender mais de quem tem acesso ao
  servidor para trocar o que é dele; saber a validade sem perguntar a ninguém; e conseguir verificar
  que está tudo certo **antes** do dia da emissão.

Personas secundárias:

- **Operador da plataforma (Master)** — responde pelo identificador que não pode se repetir entre
  clientes. Nesta fatia ele não opera nada: o valor para ele é a garantia, não uma ação.
- **Operação/financeiro da imobiliária** — não age aqui, mas é quem sofre quando a emissão falha por
  identidade vencida.
- **Provedor (Sicoob)** — ator **externo**. Não é usuário, não tem sessão, e nesta fatia
  apenas responde a um teste que o Admin dispara.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Admin da empresa**, quero registrar o certificado da minha empresa informando a
  senha que o abre, para que as cobranças dela passem a ir ao provedor com a identidade dela.
- **US-02**: Como **Admin da empresa**, quero consultar o certificado que está valendo sem que o
  material ou a senha voltem para mim, para conferir o que registrei sem que isso vire uma nova
  cópia do segredo circulando.
- **US-03**: Como **Admin da empresa**, quero ver com antecedência que o certificado está perto de
  vencer, para renovar antes de a cobrança do mês parar.
- **US-04**: Como **Admin da empresa**, quero testar contra o provedor, quando eu quiser, se a
  identidade que registrei é aceita, para não descobrir que ela não serve no dia da emissão.
- **US-05**: Como **Admin da empresa**, quero renovar o certificado substituindo o anterior e
  continuar sabendo o que valia antes, para conseguir explicar uma falha ocorrida depois da troca.
- **US-06**: Como **operador da plataforma**, quero que o identificador perante o provedor seja
  único em todo o SaaS, para que duas empresas emitindo no mesmo mês nunca disputem o mesmo número.
- **US-07**: Como **Admin da empresa**, quero que a falta de certificado próprio falhe de forma
  explícita e nomeada, para que nenhuma cobrança minha vá ao provedor com identidade que não é a da
  minha empresa.
- **US-08**: Como **operador da plataforma**, quero que nenhum material de certificado ou senha
  apareça em registro, erro ou diagnóstico, para que guardar segredo de terceiro não se transforme
  em vazamento.
- **US-09**: Como **operador da plataforma**, quero que o produto descreva cobrança bancária em
  vocabulário próprio e já preveja mais de um meio de recebimento, para que acrescentar pix ou
  trocar de provedor depois não obrigue a reescrever o domínio.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — Toda empresa que cobra pelo provedor tem certificado **próprio**. Não existe identidade
  compartilhada nem de reserva: empresa sem certificado registrado não opera contra o provedor, e a
  recusa nomeia a empresa e a razão.
- **RN-02** — O material do certificado e a senha entram no sistema e **não saem**. Sobre um
  certificado, o produto publica apenas titular, validade, impressão digital, quem o registrou e
  desde quando ele vale.
- **RN-03** — Um certificado só é aceito se o que se lê dele for coerente: a senha abre o material, o
  titular é legível e a validade ainda não passou. Certificado já vencido é recusado na entrada.
- **RN-04** — O estado de um certificado é **derivado** da validade dele contra a data corrente da
  operação, nunca de uma marca gravada: *vigente*, *vencendo* (faltam 30 dias ou menos) ou *vencido*.
- **RN-05** — Registrar um certificado novo **substitui** o que valia. Do anterior preserva-se apenas
  o registro do que ele era; o material secreto dele é descartado no mesmo ato.
- **RN-06** — O teste contra o provedor é ato explícito do Admin e **não altera nada**: informa se o
  provedor aceitou a identidade da empresa e não muda qual certificado vale.
- **RN-07** — Toda cobrança que for ao provedor recebe um **identificador perante o provedor** de 18
  caracteres, composto pelo prefixo de competência (6) e pelo **contador sequencial** (12). O
  contador é **único em todo o SaaS** e não reinicia em nenhuma virada de período — o prefixo
  identifica a competência, não delimita a contagem.
- **RN-08** — O contador sequencial é consumido em definitivo: um número entregue **nunca** é
  reaproveitado, mesmo que a operação que o pediu seja desfeita.
- **RN-09** — O contador sequencial **não é dado de nenhuma empresa**: nenhuma empresa o enxerga, o
  influencia ou o alcança.
- **RN-10** — O vocabulário do produto para cobrança bancária é **próprio**: nenhum nome de campo,
  código ou termo do provedor entra no modelo que o produto usa e publica.
- **RN-11** — O modelo de cobrança bancária trata o **meio de recebimento** como conceito, cobrindo
  boleto e pix; nesta fase apenas o boleto tem operação, e pix fica declarado sem implementação.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Admin da empresa abre a área de integração bancária da empresa dele e vê que **não há
   certificado registrado** — e, com isso, que a empresa ainda não está apta a cobrar pelo provedor.
2. Ele entrega o certificado que recebeu do provedor e informa a senha que o abre.
3. O sistema confere o que consegue ler daquele material: se a senha o abre, quem é o titular e até
   quando ele vale.
4. Aceito, o sistema passa a apresentar **titular, validade, impressão digital, quem registrou e
   desde quando vale**, mais quanto tempo falta para vencer — e nunca mais devolve o que foi
   entregue.
5. O Admin dispara o **teste contra o provedor** e vê se a identidade da empresa foi aceita do outro
   lado.
6. A partir daí, toda cobrança que for ao provedor receberá um identificador que não se repete em
   nenhuma outra empresa do produto.

### 7.2 Fluxos Alternativos

- **A senha não abre o material** → o sistema recusa dizendo isso, e o que valia antes **continua
  valendo**. Uma tentativa malsucedida nunca deixa a empresa pior do que estava.
- **O certificado já está vencido** → recusado na entrada, dizendo a data em que venceu.
- **O material é ilegível** → recusado dizendo que não foi possível lê-lo, sem devolver nada do
  conteúdo.
- **O teste contra o provedor é recusado** → o sistema informa que o provedor não aceitou aquela
  identidade; o certificado registrado permanece exatamente como estava, porque testar não muda nada.
- **O Admin dispara o teste sem ter certificado registrado** → recusa **nomeando a empresa e a
  ausência**; o sistema não tenta com nenhuma outra identidade.
- **Renovação** → o Admin entrega o certificado novo; ele passa a valer na hora, e a consulta ao que
  havia antes continua respondendo o que aquele certificado era, sem que o segredo dele exista mais.
- **O certificado entra na faixa dos 30 dias** → toda consulta passa a apresentá-lo como *vencendo*,
  com o número de dias restantes, sem que nada seja enviado.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO uma empresa sem certificado registrado QUANDO o Admin entrega um certificado
      válido com a senha correta ENTÃO o sistema o aceita e passa a apresentar titular, validade e
      impressão digital daquele certificado.
- [ ] **CA-02**: DADO um certificado registrado QUANDO qualquer resposta do produto se refere a ele
      ENTÃO nem o material nem a senha aparecem nessa resposta.
- [ ] **CA-03**: DADO um certificado registrado QUANDO o Admin o consulta ENTÃO o sistema informa
      quantos dias faltam para o vencimento e em que faixa ele está, calculados da validade contra a
      data corrente da operação.
- [ ] **CA-04**: DADO um certificado cuja validade termina em 30 dias ou menos QUANDO o Admin o
      consulta ENTÃO o sistema o apresenta como *vencendo*; e DADO um cuja validade já passou ENTÃO o
      apresenta como *vencido*.
- [ ] **CA-05**: DADO um certificado cuja senha informada não o abre QUANDO o Admin tenta registrá-lo
      ENTÃO o sistema recusa nomeando a razão, e o certificado que valia antes continua valendo,
      inalterado.
- [ ] **CA-06**: DADO um certificado cuja validade já passou QUANDO o Admin tenta registrá-lo ENTÃO o
      sistema o recusa na entrada, informando a data em que venceu.
- [ ] **CA-07**: DADO um certificado registrado QUANDO o Admin dispara o teste contra o provedor ENTÃO o
      sistema informa se o provedor aceitou a identidade da empresa, e o certificado registrado
      permanece o mesmo, sem alteração de nenhum dado.
- [ ] **CA-08**: DADO uma empresa sem certificado registrado QUANDO o Admin dispara o teste contra o
      provedor ENTÃO o sistema recusa nomeando a empresa e a ausência do certificado, e em nenhum momento
      usa identidade de outra origem.
- [ ] **CA-09**: DADO uma empresa com certificado registrado QUANDO o Admin registra um novo ENTÃO o
      novo passa a valer, o registro do anterior continua consultável (titular, validade, impressão
      digital, quem o registrou e quando) e o material secreto do anterior deixa de existir.
- [ ] **CA-10**: DADO duas empresas distintas pedindo identificador perante o provedor no mesmo mês
      QUANDO os identificadores são entregues ENTÃO nenhum se repete entre elas, e o mesmo contador
      sequencial avança para as duas.
- [ ] **CA-11**: DADO uma operação que obteve um identificador perante o provedor e foi desfeita
      QUANDO a operação seguinte pede um identificador ENTÃO ela recebe um número novo, e o número da
      operação desfeita não é reaproveitado por ninguém.
- [ ] **CA-12**: DADO qualquer falha no registro, no teste ou na leitura de um certificado QUANDO o
      sistema registra o ocorrido para diagnóstico ENTÃO nem a senha nem o material do certificado
      aparecem em nenhum registro, mensagem de erro ou anexo de falha.
- [ ] **CA-13**: DADO o modelo de cobrança bancária que o produto usa QUANDO se examina o vocabulário
      que ele publica ENTÃO nenhum nome de campo, código ou termo do provedor aparece nele.
- [ ] **CA-14**: DADO o modelo de cobrança bancária QUANDO se pergunta quais meios de recebimento ele
      comporta ENTÃO boleto e pix estão previstos, e pix não tem nenhuma operação nesta fase.

---

## 9. Restrições & Considerações

- **Isolamento entre empresas**: o certificado é dado da empresa; nenhuma empresa alcança o da outra,
  e isso é garantido pela plataforma, não por checagem de tela. `[DELEGAR_TECH_SPEC]`.
- **O contador não tem dono-empresa**: decorre da ADR-0031, que é pré-requisito desta fatia e já está
  aceita. `[DELEGAR_TECH_SPEC]` — onde ele mora.
- **Nenhum segredo versionado**, e nenhum segredo de retorno: o material entregue não volta por
  nenhuma superfície do produto. `[DELEGAR_TECH_SPEC]` — a forma da proteção em repouso.
- **A garantia de não vazamento é provada por medição, não por leitura.** É restrição de método, e
  vem de um achado crítico da fase anterior: um segredo em claro alcançou o diário do sistema por um
  caminho que nenhuma revisão de código teria enxergado. `[DELEGAR_TECH_SPEC]`.
- **Agendamento por horário não pertence a esta fase** — é o que faz o alerta de vencimento ser
  estado publicado, e não mensagem enviada.
- **Fronteira do projeto**: nenhum código de frontend. As telas do Admin serão implementadas fora
  deste repositório, a partir do handoff que este backend produz.
- **Dependência externa a confirmar por data, não por memória**: a habilitação junto ao provedor
  (certificado e credenciais de homologação) precisa estar válida antes da fatia (ii) começar.
- **A superfície pública do produto cresce** — a estimativa desta fatia é de **3 ações novas**
  (registrar, consultar e testar), acima das 2 previstas no discovery, por efeito da decisão de
  separar o teste do registro. A contagem exata é da etapa técnica. `[DELEGAR_TECH_SPEC]`.
- **Autorização**: registrar, consultar e testar certificado são atos do Admin da empresa; nenhum
  deles é público e nenhum deles é do operador da plataforma. `[DELEGAR_TECH_SPEC]` — a declaração
  por rota.
- **Nada do que a fase anterior fechou é reescrito** — a cobrança, a mora e a régua são consumidas
  como estão.
- ⚠️ **Divergência de vocabulário a canonizar**: o glossário global define **Contador sequencial**
  como *"número único e contínuo mantido pela imobiliária"*. Esta feature o torna **único do SaaS
  inteiro**, e não da imobiliária — é o que a decisão 23 pede e o que a medição do sistema antigo
  confirmou (a sequência de lá já é global; o que a prendia era a configuração da empresa). A
  definição canônica precisa ser corrigida; a correção não é deste PRD, e sim da etapa de challenge,
  que é a dona do glossário.

---

## 10. Métricas de Sucesso

- **Nenhuma empresa ativa sem certificado próprio** no momento em que a fatia (ii) começar — a
  medida direta de que o caminho de reserva pôde ser removido sem deixar ninguém para trás.
- **Zero ocorrências de material de certificado ou senha** em registro, erro ou diagnóstico, aferido
  por medição e não por inspeção visual.
- **Zero colisões de identificador perante o provedor** entre empresas, incluindo o caso de duas
  empresas pedindo no mesmo instante e o caso de operação desfeita.
- **Renovação sem intermediário**: o tempo entre o Admin receber o certificado novo e ele estar
  valendo passa a ser de minutos e não depende de ninguém com acesso ao servidor — hoje esse tempo é
  a fila de um chamado.
- **Certificado inservível descoberto antes da emissão**: toda recusa do provedor observada por teste
  disparado pelo Admin, e nenhuma descoberta pela primeira vez durante a emissão do mês.

---

## 11. Roadmap / Fases

As três fases abaixo são as **três fatias** da integração bancária, na ordem de dependência decidida
no discovery. Cada uma tem ciclo de especificação e execução próprio.

- **Fase 1 — `fundacao-bancaria` (esta):** identidade por empresa, guarda protegida do material,
  estado derivado da validade, teste sob comando, fim do caminho de reserva, identificador perante o
  provedor único do SaaS e o vocabulário próprio de cobrança bancária.
- **Fase 2 — `emissao-e-conciliacao`:** emitir (pontual e em lote), consultar, dar baixa, reconciliar
  e expor o histórico bancário de uma cobrança. Depende inteiramente da Fase 1.
- **Fase 3 — `webhook-e-carne`:** receber do provedor a notificação de baixa e entregar o carnê montado
  no servidor. Depende das duas anteriores — sem cobrança emitida não há o que notificar nem o que
  reunir.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Registrar o certificado da empresa informando a senha | CA-01, CA-05, CA-06 |
| US-02 | Consultar o certificado sem que o segredo volte | CA-02 |
| US-03 | Ver com antecedência que o certificado vai vencer | CA-03, CA-04 |
| US-04 | Testar contra o provedor, sob comando, se a identidade é aceita | CA-07 |
| US-05 | Renovar substituindo, sabendo o que valia antes | CA-09 |
| US-06 | Identificador perante o provedor único em todo o SaaS | CA-10, CA-11 |
| US-07 | Falta de certificado próprio falha de forma nomeada | CA-08 |
| US-08 | Segredo não aparece em registro, erro ou diagnóstico | CA-12 |
| US-09 | Vocabulário próprio e meio de recebimento previsto | CA-13, CA-14 |

---

## 13. Checklist Final

- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-09)
- [x] Critérios de aceite claros (CA-01 a CA-14, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum identificador
      pulado nas duas sequências
- [x] Pronto para criar o TECH_SPEC (COMO)
