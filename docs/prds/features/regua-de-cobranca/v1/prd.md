# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Régua de cobrança por empresa — o aviso ao inadimplente, configurável, auditado e sem cobrar dívida que não existe
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-11
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Discovery: `docs/specs/features/regua-e-documentos/v1/pre-refinement.md` (**sub-fatia 2a de 2**)
  - Fase: `docs/plano-backend-novo/plano-execucao.md` §F3 · briefings em
    `docs/plano-backend-novo/briefings/f3-cobranca-mora-e-documentos.md` e
    `docs/plano-backend-novo/briefings/f3-fatia2-regua-e-documentos.md`
  - Fatia anterior (concluída): `docs/specs/features/cobranca-e-mora/v1/` — é dela que vem o estado
    de fonte única que esta feature consulta
  - Referências capturadas do sistema antigo:
    `docs/specs/features/caracterizacao-regras-legadas/v1/golden/` — em especial
    `regua-de-cobranca.json`, o oráculo executável desta entrega
  - Sub-fatia seguinte (fora deste PRD): `documentos-e-confirmacao` — o documento do contrato e a
    confirmação de e-mail do locatário
  - Decisões vinculantes: ADR-0006, ADR-0008, ADR-0011, ADR-0016, ADR-0017, ADR-0018, ADR-0021,
    ADR-0022

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** A cobrança já é um fato correto no produto novo desde a fatia
  anterior — **mas ninguém é avisado**. O locatário que atrasou não recebe nada do sistema novo,
  porque tudo o que sai para o mundo continua no sistema antigo. E o que existe lá tem três defeitos
  medidos: a cobrança é decidida a partir de um estado que **discorda de si mesmo**, a ponto de o
  caminho manual conseguir cobrar por uma dívida **cancelada**; a política de aviso é **uma só para
  todas as imobiliárias**, num produto que atende várias; e a varredura que decide quem cobrar
  **percorre a base inteira sem separar empresa**.
- **Como funciona atualmente?** No sistema antigo, uma rotina percorre todas as cobranças que não
  estão pagas nem canceladas, decide quais avisar segundo uma configuração única do site, e envia
  e-mail ao locatário. Existe também um disparo manual, que é o mesmo envio acionado por uma pessoa —
  e é ele que hoje consegue cobrar dívida cancelada, porque decide o estado por conta própria. O que
  saiu fica registrado, e é esse registro que impede o sistema de avisar duas vezes em seguida.
- **Por que isso precisa ser resolvido agora?** Por três razões, e duas têm prazo. **A primeira**: sem
  a régua, desligar o sistema antigo significa a imobiliária parar de cobrar o inadimplente — é a
  função que a operação sentiria falta no primeiro dia. **A segunda**: esta é a última entrega que
  precisa **ler código de dentro do banco do sistema antigo**. A regra que compõe o documento do
  contrato existe só ali — não está em arquivo, não está em versionamento, não está em cópia de
  segurança — e a próxima fatia depende dela. A oportunidade de extraí-la se encerra com o
  desligamento, sem reabertura. **A terceira**: o oráculo da régua já foi capturado e prova, hoje,
  quais comportamentos são regra e qual é defeito. Portar sem esse contraste seria portar o defeito
  junto.
- **Quem sofre o impacto do problema?** O **Locatário**, que deixa de ser avisado do vencimento — ou,
  pior, é cobrado por uma dívida que já foi cancelada. O **operador da imobiliária**, que perde a
  régua e o disparo manual e volta a cobrar por fora do sistema, sem saber o que já saiu. E o
  **projeto**, cujo marco de entrega exige esta fase fechada e cuja janela de leitura do sistema
  antigo não se reabre.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o produto novo **avise o inadimplente sozinho** — segundo a
  política de cada imobiliária, dentro do horário que ela definiu, sem repetir o aviso antes da hora,
  registrando cada tentativa —, e que o operador possa disparar o aviso na hora quando precisar. E que
  a regra de composição do documento do contrato fique extraída enquanto ainda é possível extraí-la.
- **Qual mudança de comportamento esta feature deve gerar?** Nenhuma cobrança paga ou cancelada gera
  aviso, **por nenhum caminho** — o defeito do sistema antigo não atravessa a passagem. Cada
  imobiliária passa a ter a própria política de aviso, sem afetar as demais. O trabalho de avisar
  passa a ser **sempre de uma empresa**, e a falha do trabalho de uma não alcança as outras. Uma falha
  de envio deixa de ser invisível e deixa de contaminar o estado financeiro: ela é fato próprio, com
  causa registrada e nova tentativa. E o operador passa a saber o que saiu, quando e por qual caminho.
- **Qual o resultado final esperado do ponto de vista do usuário?** O Admin Empresa liga a régua da
  casa e diz em que dias e horários ela avisa. A partir daí, o locatário que atrasa recebe o aviso sem
  que ninguém precise lembrar. Quando o locatário liga dizendo que não recebeu, o operador dispara na
  hora, mesmo fora do horário. E, ao abrir a cobrança, ele vê a lista do que já saiu — inclusive a
  tentativa que falhou e por quê.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Extrair do sistema antigo a regra de composição do documento do contrato**, antes que a
      oportunidade se encerre, e registrá-la como referência versionada do projeto — trabalho de
      **prazo**, cujo consumidor é a sub-fatia seguinte, não esta
- [ ] **Política de aviso por empresa**: em que dias em relação ao vencimento avisar, intervalo mínimo
      entre dois avisos da mesma cobrança, janela de horário do envio automático e canal
- [ ] **Empresa sem política definida não avisa ninguém** — a régua nasce desligada, e ligar é ato
      deliberado de quem administra a imobiliária
- [ ] **Aviso automático ao locatário** das cobranças em aberto que a política da empresa manda avisar
- [ ] **O estado que a régua consulta é o mesmo que o resto do sistema publica** — ela nunca decide
      estado por conta própria
- [ ] **Nenhuma cobrança paga ou cancelada gera aviso, por nenhum caminho** — o defeito do sistema
      antigo é fechado na passagem
- [ ] **Disparo manual de uma cobrança específica**, como operação própria que exige concessão própria,
      **preservando** o fato de ignorar a janela de horário e o intervalo mínimo
- [ ] **Registro de toda tentativa de envio** — bem-sucedida ou não —, com instante, cobrança,
      caminho (automático ou manual), destinatário e a causa quando falhou
- [ ] **Consulta do histórico de envios de uma cobrança** pelo operador
- [ ] **Falha de envio é fato próprio**: fica registrada com a causa, é repetida sem intervenção, e
      **não altera o estado da cobrança nem a mora dela**
- [ ] **O trabalho de avisar é sempre de uma empresa** — não existe varredura que atravesse empresas, e
      a falha de uma não alcança as outras
- [ ] **Equivalência declarada contra o oráculo, cenário a cenário** — os dez cenários de referência
      têm veredito escrito **antes** da execução, incluindo a única divergência pretendida
- [ ] **Recusar, na entrada, valores de canal que o produto não implementa** — os campos permanecem
      porque a tela os lê, mas o valor é rejeitado em vez de aceito em silêncio

### 4.2 O que está explicitamente fora do escopo

- [ ] **O gatilho de tempo** — esta entrega define o trabalho de avisar e o torna acionável; **quem o
      aciona por horário** é a fase de automações agendadas. A janela de horário é regra de *quando é
      permitido* enviar, não o relógio que dispara
- [ ] **O documento do contrato e a confirmação de e-mail do locatário** — sub-fatia seguinte. Aqui só
      se **extrai a regra** do documento; compô-lo é lá
- [ ] **A tela de saúde do envio e o alerta de limite do provedor de e-mail** — fase de automações.
      Aqui apenas se **grava o fato** que ela vai ler
- [ ] **Levar a política do sistema antigo para as imobiliárias** — decidido: a régua nasce desligada,
      e a configuração inicial de cada empresa é item da virada, registrado no handoff
- [ ] **Canal que não seja e-mail** — recusa declarada na entrada, não omissão
- [ ] **Política de retenção e expurgo do registro de envios** — vai junto com a do registro de
      tentativas de acesso, na fase de operação
- [ ] **Emissão de boleto, baixa bancária e o carnê** — fase seguinte
- [ ] **Qualquer tela** — este repositório entrega apenas o servidor
- [ ] **Abrir o catálogo fechado de áreas de tela e de ações que exigem concessão própria** — a área
      Automação de cobrança e a ação enviar cobrança manual **já existem**; nada a acrescentar
- [ ] **Personalizar o texto da mensagem por empresa** — o conteúdo do aviso é o do sistema antigo;
      quem varia é *quando* avisar, não *o que* dizer

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Usuário Empresa** que alcança a área de tela **Automação de
  cobrança** — quem acompanha a inadimplência da carteira de cobranças no dia a dia.
- **Qual é seu objetivo ao usar essa feature?** Que o locatário atrasado seja avisado sem depender da
  memória de ninguém, e saber, a qualquer momento, o que já saiu para cada cobrança.
- **Quais dores/dificuldades essa feature resolve pra ele?** Deixa de cobrar por fora do sistema;
  deixa de descobrir tarde que uma cobrança nunca foi avisada; deixa de constranger o locatário
  cobrando dívida que já foi cancelada; e passa a ter uma saída legítima — o disparo manual — para o
  caso do locatário que ligou dizendo que não recebeu.

Personas secundárias e terciária:

- **Admin Empresa** — define a política de aviso da própria imobiliária: em que dias, com que
  intervalo, em que horário. Objetivo: que a régua da casa siga o costume da casa, e que ligá-la seja
  decisão dele, não um padrão herdado de outra empresa.
- **Locatário** — **não usa o sistema**; é alcançado *pelo* sistema. É dele a caixa de e-mail que
  recebe o aviso. É a persona que torna esta entrega diferente de todas as anteriores: o efeito
  acontece **fora** do produto, e o erro chega a uma pessoa real. Dor resolvida: ser avisado do
  atraso, e não ser cobrado por dívida que não existe.
- **Sysloc Master** — persona terciária. Nesta entrega ele **não ganha operação alguma**: ganha
  apenas o fato gravado, que a fase de automações vai ler para alertar quando as cobranças pararem de
  sair.
- **Equipe do projeto** — persona interna, presente por causa de um prazo que não se repete: é ela
  quem precisa extrair a regra do documento do contrato antes do desligamento do sistema antigo, e
  quem precisa que nenhuma verificação alcance a caixa de uma pessoa real.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como equipe do projeto, preciso extrair do sistema antigo a regra que compõe o documento
  do contrato antes de ele ser desligado, para que a sub-fatia seguinte tenha a regra em mãos e não
  dependa de um sistema vivo para conhecê-la.
- **US-02**: Como Admin Empresa, quero definir se e quando a minha imobiliária avisa o inadimplente —
  os dias, o intervalo mínimo e o horário —, para que a régua siga a política da minha casa e não a de
  outra empresa do produto.
- **US-03**: Como operador, quero que o locatário que atrasou seja avisado automaticamente, sem que
  ninguém precise lembrar, para não perder cobrança por esquecimento.
- **US-04**: Como operador, quero disparar o aviso de uma cobrança específica na hora — mesmo fora do
  horário e mesmo que já tenha saído aviso recente —, para atender o locatário que ligou dizendo que
  não recebeu.
- **US-05**: Como operador, quero consultar o que já saiu para uma cobrança — quando, por qual caminho
  e a causa quando falhou —, para saber se preciso cobrar por outro meio.
- **US-06**: Como operador, quero que nenhuma cobrança paga ou cancelada gere aviso por nenhum
  caminho, para que nenhum locatário seja cobrado por dívida que não existe.
- **US-07**: Como Admin Empresa, quero que uma falha de envio não altere o estado nem a mora da
  cobrança, para que o histórico financeiro não seja contaminado por problema de comunicação.
- **US-08**: Como Admin Empresa, quero que a régua da minha imobiliária alcance apenas os meus
  locatários, para que nenhuma mensagem minha chegue a quem é de outra empresa — nem o contrário.
- **US-09**: Como equipe do projeto, preciso que nenhuma verificação do sistema entregue mensagem a
  destinatário real, para que construir a régua não alcance a caixa de ninguém.

---

## 6. Regras de Negócio (alto nível)

- RN-01 -- A régua atua sobre **cobranças em aberto** de uma empresa. O estado que ela consulta é o
  mesmo que qualquer outro caminho de leitura do sistema publica; ela **nunca** decide estado por
  conta própria.
- RN-02 -- **Cobrança paga ou cancelada nunca gera aviso**, por nenhum caminho — nem automático nem
  manual. É divergência declarada em relação ao sistema antigo, cujo caminho manual avisa uma cobrança
  cancelada e vencida.
- RN-03 -- Cada empresa tem a própria política de aviso, e a de uma nunca alcança outra. **Empresa sem
  política definida não avisa ninguém**: a ausência equivale à régua desligada, e não é falha.
- RN-04 -- A política de aviso diz: em que dias em relação ao vencimento avisar (antes e depois), o
  intervalo mínimo entre dois avisos da mesma cobrança, a janela de horário em que o aviso automático
  é permitido, e o canal.
- RN-05 -- O aviso automático só sai **dentro da janela de horário** da empresa e **somente se** o
  intervalo mínimo desde a última tentativa registrada para aquela cobrança já tiver passado.
- RN-06 -- O intervalo mínimo conta **qualquer** tentativa registrada para a cobrança — inclusive a que
  **falhou**. Uma tentativa recente que deu errado impede o aviso automático seguinte tanto quanto uma
  que deu certo.
- RN-07 -- O **disparo manual ignora** a janela de horário e o intervalo mínimo. O intervalo existe
  para impedir o automático de avisar em excesso, não para impedir um operador que agiu
  deliberadamente. O disparo manual **continua sujeito à RN-02**.
- RN-08 -- Toda tentativa de envio, bem-sucedida ou não, deixa **registro próprio**: o instante, a
  cobrança, o caminho (automático ou manual), o destinatário e a causa quando falhou. O disparo manual
  registra como qualquer outro — sem isso, o caminho que uma pessoa acionou seria o único invisível.
- RN-09 -- **Falha de envio não altera o estado da cobrança nem a mora dela.** Ela é fato próprio, com
  causa registrada e nova tentativa; o financeiro não muda por problema de comunicação.
- RN-10 -- O trabalho de avisar é **sempre delimitado a uma empresa**. Não existe varredura que
  atravesse empresas, e a falha do trabalho de uma não alcança as outras.
- RN-11 -- Cobrança cujo locatário não tem endereço de contato não gera aviso, e isso **não
  interrompe** o trabalho para as demais cobranças da empresa.
- RN-12 -- Configurar a política e consultar o histórico de envios exigem apenas o alcance da **área de
  tela Automação de cobrança**. O **disparo manual é ação sensível** e exige a concessão própria de
  enviar cobrança manual, além da área.
- RN-13 -- Valores de canal que o produto não implementa são **recusados na entrada**, com aviso, e
  nunca aceitos e ignorados.
- RN-14 -- Esta entrega **não tem gatilho de tempo próprio**. A janela de horário é regra de *quando é
  permitido* avisar; *quem aciona* o trabalho por horário pertence à fase de automações agendadas.
- RN-15 -- Nenhuma verificação do sistema entrega mensagem a destinatário real. É pré-condição, não
  recomendação.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Admin Empresa liga a régua da imobiliária e define a política: os dias em relação ao vencimento,
   o intervalo mínimo entre avisos, a janela de horário e o canal.
2. Chega o momento de avisar. O sistema toma o trabalho **daquela empresa** e percorre as cobranças em
   aberto dela.
3. Para cada cobrança, ele confere o estado publicado, o dia em relação ao vencimento, a janela de
   horário e a última tentativa registrada.
4. Nas que a política manda avisar, o sistema envia o aviso ao locatário e **registra a tentativa**.
5. O operador abre a cobrança e vê o histórico: o que saiu, quando, por qual caminho — e, se algo
   falhou, a causa.

### 7.2 Fluxos Alternativos

- **Empresa que nunca ligou a régua**: o trabalho não avisa ninguém e não registra falha alguma.
- **O locatário liga dizendo que não recebeu**: o operador que tem a concessão de enviar cobrança
  manual dispara o aviso daquela cobrança na hora — mesmo fora do horário, mesmo com aviso recente — e
  o disparo fica registrado como manual.
- **A cobrança foi paga ou cancelada**: nenhum aviso sai, nem pelo caminho automático nem pelo manual.
- **Fora da janela de horário**: o aviso automático não sai; a cobrança volta a ser considerada na
  próxima vez que o trabalho rodar dentro da janela.
- **Aviso recente**: a cobrança é pulada até o intervalo mínimo passar — inclusive quando o recente é
  uma tentativa que falhou.
- **O envio falha**: a causa fica registrada, o sistema tenta de novo sozinho, e a cobrança permanece
  exatamente como estava.
- **Locatário sem endereço de contato**: nenhum aviso sai para ele, e as demais cobranças da empresa
  seguem sendo processadas.
- **Sem alcance à área Automação de cobrança**: configurar a política ou consultar o histórico é
  recusado, sem efeito algum.
- **Sem a concessão de enviar cobrança manual**: o disparo é recusado e nenhuma mensagem sai.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] CA-01: DADO que o sistema antigo está de pé QUANDO a regra que compõe o documento do contrato é
      extraída ENTÃO ela fica registrada como referência versionada do projeto, legível sem o sistema
      antigo, E nada é alterado no sistema antigo.
- [ ] CA-02: DADO duas empresas com políticas de aviso diferentes QUANDO o trabalho de avisar é
      executado para as duas ENTÃO cada uma avisa segundo a própria política, sem interferência da
      outra.
- [ ] CA-03: DADO uma empresa que nunca definiu a política de aviso QUANDO o trabalho de avisar é
      executado para ela ENTÃO nenhuma mensagem é enviada E nenhuma falha é registrada.
- [ ] CA-04: DADO uma cobrança em aberto cujo dia em relação ao vencimento consta da política da
      empresa, dentro da janela de horário e sem tentativa registrada no intervalo mínimo QUANDO o
      trabalho de avisar é executado ENTÃO o locatário recebe o aviso E a tentativa fica registrada.
- [ ] CA-05: DADO a mesma cobrança do CA-04, porém **fora** da janela de horário QUANDO o trabalho
      automático é executado ENTÃO nenhuma mensagem é enviada.
- [ ] CA-06: DADO uma cobrança vencida com tentativa registrada dentro do intervalo mínimo QUANDO o
      trabalho automático é executado ENTÃO nenhuma mensagem nova é enviada — **inclusive** quando a
      tentativa recente é uma que falhou.
- [ ] CA-07: DADO uma cobrança vencida com aviso recente e fora da janela de horário QUANDO o operador
      que tem a concessão de enviar cobrança manual dispara o aviso ENTÃO a mensagem é enviada E fica
      registrada como manual.
- [ ] CA-08: DADO uma cobrança cancelada e vencida QUANDO o trabalho automático é executado E QUANDO o
      operador tenta o disparo manual ENTÃO nenhuma mensagem é enviada por nenhum dos dois caminhos. O
      mesmo vale para cobrança paga.
- [ ] CA-09: DADO os dez cenários de referência capturados do sistema antigo QUANDO os mesmos dados são
      processados no sistema novo ENTÃO o efeito coincide em todos, **com uma única exceção declarada**:
      no cenário de cobrança cancelada e vencida pelo caminho manual, o sistema antigo envia uma
      mensagem e o sistema novo não envia nenhuma.
- [ ] CA-10: DADO que o envio de uma mensagem falha QUANDO a régua tenta enviá-la ENTÃO a causa fica
      registrada, a cobrança permanece com o mesmo estado e a mesma mora, E a tentativa é repetida sem
      intervenção de ninguém.
- [ ] CA-11: DADO uma cobrança com avisos enviados e ao menos uma tentativa falha QUANDO o operador
      consulta o histórico dela ENTÃO vê cada tentativa com o instante, o caminho, o destinatário e a
      causa da falha.
- [ ] CA-12: DADO duas empresas com cobranças vencidas passíveis de aviso QUANDO o trabalho é executado
      para uma delas ENTÃO nenhum locatário da outra recebe mensagem E nenhum registro de envio é
      criado na outra.
- [ ] CA-13: DADO um operador que alcança a área Automação de cobrança mas não tem a concessão de
      enviar cobrança manual QUANDO ele tenta disparar o aviso ENTÃO a operação é recusada e nenhuma
      mensagem sai.
- [ ] CA-14: DADO um operador que não alcança a área Automação de cobrança QUANDO ele tenta definir a
      política de aviso ou consultar o histórico de envios ENTÃO a operação é recusada e nada muda.
- [ ] CA-15: DADO a definição da política de aviso QUANDO um canal que o produto não implementa é
      informado ENTÃO a definição é recusada com aviso, e nenhuma política é gravada pela metade.
- [ ] CA-16: DADO uma cobrança cujo locatário não tem endereço de contato, ao lado de outras cobranças
      passíveis de aviso QUANDO o trabalho é executado ENTÃO nenhuma mensagem sai para ela E as demais
      cobranças da empresa são avisadas normalmente.
- [ ] CA-17: DADO a suíte de verificação do projeto QUANDO ela exercita os cenários da régua ENTÃO
      nenhuma mensagem é entregue a destinatário real.

---

## 9. Restrições & Considerações

**Prazo irreversível (a restrição que ordena a entrega):**

- A regra que compõe o documento do contrato só pode ser lida enquanto o sistema antigo estiver de pé,
  e o desligamento dele não é reversível. Por isso ela é o **primeiro** trabalho desta entrega, e não
  o último — mesmo que quem a consome seja a sub-fatia seguinte. É o mesmo padrão que a fatia anterior
  usou para capturar o oráculo desta.
- O sistema antigo está **em produção e atendendo a operação**. Nada destrutivo pode ser feito nele.

**Restrição de privacidade (a que distingue esta entrega das anteriores):**

- Esta é a primeira entrega do produto que **age fora dele**: manda e-mail para pessoas reais. Um erro
  de destinatário, de empresa ou de estado não é um teste vermelho — é uma cobrança indevida na caixa
  de alguém. A verificação nunca executa contra o ambiente que atende a operação (ADR-0006), e nenhum
  envio real acontece em verificação (RN-15).

**Decisões do projeto que vinculam esta entrega:**

- O isolamento entre imobiliárias é **propriedade do armazenamento**, não conferência da aplicação, e o
  contexto de empresa nunca vem do pedido (ADR-0008). É o que torna a varredura do sistema antigo —
  que percorre a base inteira sem separar empresa — não portável como está, e o que faz o trabalho ser
  sempre de uma empresa (RN-10).
- Toda operação publicada declara o que exige, em perfil e em concessão do catálogo fechado, e a que
  não declara é recusada (ADR-0011); a conferência alcança o **conteúdo** da declaração, e nenhuma
  operação exige menos do que a classe dela exige (ADR-0018).
- O catálogo de áreas de tela e de concessões próprias é **fechado, e esta entrega não o abre**: a área
  Automação de cobrança e a concessão de enviar cobrança manual já existem nele.
- Transição de estado e ato de negócio são **operação própria**, e a governança segue a natureza do
  ato: quando ele é sensível, exige a concessão correspondente (ADR-0021). O disparo manual é ato
  sensível por nomeação do próprio catálogo.
- O estado publicado de um fato financeiro é **derivado dos fatos gravados**, nunca movido por rotina
  (ADR-0022) — é o que a RN-01 consome, e é a fonte única que torna impossível o caminho manual
  discordar do automático.
- A forma do que o sistema publica é derivada de uma definição única (ADR-0016, ADR-0017).

**Dependências e fronteiras:**

- Esta entrega **depende** da fatia anterior (a cobrança e o estado de fonte única) e **não depende** da
  seguinte.
- A fase de automações agendadas **depende desta**: é aqui que o trabalho de avisar passa a existir;
  lá é que ele ganha o relógio.
- A sub-fatia seguinte depende de **um** item desta: a regra do documento do contrato, extraída aqui
  por prazo.
- **Aqui só se faz servidor.** Nenhuma tela, nenhuma linha de aplicação do usuário.

**Delegado à etapa técnica** `[DELEGAR_TECH_SPEC]`:

- Quais são exatamente os campos da política de aviso e qual o formato de cada um.
- Como o trabalho de uma empresa é delimitado e enfileirado, e qual a política de nova tentativa.
- Como o intervalo mínimo é apurado a partir das tentativas registradas.
- Como o veredito de cada um dos dez cenários de referência é escrito **antes** da execução, e como a
  única divergência pretendida fica declarada em vez de descoberta no meio do trabalho.
- Se a recusa por locatário sem endereço de contato deixa registro próprio.
- Quantas operações publicadas esta entrega acrescenta à superfície do produto, medidas por dupla
  medição independente.
- Onde o conteúdo do aviso é composto, e como ele reproduz o do sistema antigo.

**Consideração de UX (a comunicar, não a implementar aqui):** a régua **nasce desligada**. No dia da
virada, a imobiliária que não a ligar não avisará ninguém — comportamento diferente do sistema antigo,
onde a política era única e sempre valia. Isso precisa entrar no handoff e no roteiro da virada, ou
será lido como falha.

---

## 10. Métricas de Sucesso

Esta entrega quase não muda o que o operador vê — o que ela muda acontece na caixa de e-mail de
terceiros. Por isso adoção não mede nada aqui. As quatro medidas abaixo são as que, se falharem,
invalidam a entrega:

1. **Equivalência com o oráculo**: os dez cenários de referência coincidem em efeito, com **uma única
   divergência** — a declarada por vitória, em que o sistema novo deixa de avisar uma cobrança
   cancelada. Qualquer divergência não declarada é reprovação.
2. **Nenhuma mensagem indevida**: zero mensagens para locatário de outra empresa, zero para cobrança
   paga ou cancelada, zero para destinatário real durante a verificação.
3. **Nada se perde**: toda tentativa de envio tem registro — a proporção de tentativas sem registro é
   zero, incluindo as que falharam e as disparadas manualmente.
4. **A regra do documento sobreviveu ao prazo**: a regra de composição do documento do contrato está
   registrada no projeto e é legível sem o sistema antigo de pé.

---

## 11. Roadmap / Fases

Fases **dentro desta entrega**, na ordem em que o prazo e as dependências as impõem:

- **Fase 1 — Extrair a regra do documento do contrato.** Primeira por prazo, não por dependência: nada
  mais nesta entrega depende dela, mas é a única coisa que deixa de ser possível se demorar.
- **Fase 2 — A política de aviso por empresa.** A configuração, a régua desligada por padrão, a recusa
  do canal não implementado, e o alcance exigido para defini-la.
- **Fase 3 — O registro de envios.** O que saiu, para quem, por qual caminho e com que resultado — é o
  que sustenta o intervalo mínimo, a auditoria e a consulta do operador.
- **Fase 4 — A decisão de quem avisar.** O estado consultado da fonte única, os dias, a janela de
  horário, o intervalo mínimo, e o veredito escrito para cada cenário de referência.
- **Fase 5 — O trabalho por empresa e a falha como fato próprio.** O aviso saindo de fato, delimitado a
  uma empresa, com nova tentativa e sem tocar o financeiro.
- **Fase 6 — O disparo manual e a consulta do histórico.** A saída legítima do operador, com concessão
  própria, e o que ele precisa ver para decidir.

A sub-fatia seguinte (fora deste PRD) compõe o documento do contrato e a confirmação de e-mail do
locatário.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Extrair a regra do documento do contrato antes do desligamento | CA-01 |
| US-02 | Política de aviso da própria imobiliária | CA-02, CA-03, CA-14, CA-15 |
| US-03 | O inadimplente avisado automaticamente | CA-04, CA-05, CA-06, CA-16 |
| US-04 | Disparo manual na hora, com concessão própria | CA-07, CA-13 |
| US-05 | Saber o que já saiu para uma cobrança | CA-11 |
| US-06 | Nenhum aviso para cobrança paga ou cancelada | CA-08, CA-09 |
| US-07 | Falha de envio não contamina o financeiro | CA-10 |
| US-08 | A régua da empresa alcança só os locatários dela | CA-12 |
| US-09 | Nenhuma verificação alcança destinatário real | CA-17 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-09)
- [x] Critérios de aceite claros (CA-01 a CA-17, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum ID pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
