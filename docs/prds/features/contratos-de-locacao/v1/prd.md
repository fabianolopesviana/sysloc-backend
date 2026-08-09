# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Contratos de locação — montagem, ativação e cancelamento
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-08
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Pré-refinamento: `docs/specs/features/contratos-de-locacao/v1/pre-refinement.md`
  - Briefing da fatia: `docs/plano-backend-novo/briefings/f2-fatia2-contratos-de-locacao.md`
  - Plano de execução: `docs/plano-backend-novo/plano-execucao.md` §F2
  - Fatia irmã, anterior: `docs/prds/features/cadastro-de-imoveis-e-pessoas/v1/prd.md` (concluída)
  - Registro do comportamento do sistema antigo: `docs/specs/features/caracterizacao-regras-legadas/v1/`
  - ADRs vinculantes: **0006**, **0008**, **0011**, **0013**, **0014**, **0015**, **0016**, **0017**,
    **0018** e **0019**
  - Glossário de domínio: `docs/specs/domain-glossary.md`

> Esta é a **segunda e última fatia** da fase de domínio de locação. A primeira entregou os cadastros
> que o contrato aponta — imóveis e pessoas; esta entrega o contrato em si, e com ela a fase fecha.

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**
  O contrato de locação — o documento central do negócio — só existe dentro do sistema antigo, que
  será desligado. Enquanto ele viver lá, o produto novo conhece imóveis e pessoas mas não sabe
  representar a locação que os liga, e nada do que vem depois (cobrança, integração bancária,
  automações) tem sobre o que se apoiar.

- **Como funciona atualmente?**
  Montar um contrato custa **três idas ao sistema antigo**: grava-se um rascunho, lê-se o documento
  inteiro de volta e só então ele é efetivado. O fluxo pode falhar no meio e deixar rascunho órfão.
  Pior: o estado que a tela mostra é **decidido pelo consumidor**, a partir de um indicador interno do
  sistema antigo, enquanto existe um segundo campo de estado em paralelo. As duas fontes podem
  divergir, e a tela mostra o que quiser. Há ainda um estado no cadastro que **nunca é gravado por
  caminho nenhum** e mesmo assim aparece para quem lê o dado cru.

- **Por que isso precisa ser resolvido agora?**
  É a fatia que **fecha a fase**. Com ela, três das cinco fases exigidas pelo marco de entrega do
  backend estão concluídas. E há uma janela que se fecha: as duas regras mais complexas do negócio —
  ativação e cancelamento — só podem ser conferidas contra o sistema antigo enquanto ele estiver de
  pé, o que vale até a fase de virada. Regra não conferida agora vira risco que só aparece na
  troca, quando não há mais com o que comparar.

- **Quem sofre o impacto do problema?**
  Quem monta e faz valer contratos na imobiliária, hoje sujeito a um fluxo de três passos que pode
  falhar no meio; e o projeto inteiro, que não pode desligar o sistema antigo enquanto o contrato
  viver lá.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**
  Que a imobiliária monte, faça valer e cancele contratos de locação no produto novo, com estado
  decidido pelo sistema, código próprio e legível, e com as regras de ativação e cancelamento
  reproduzindo comprovadamente o que o sistema antigo faz hoje.

- **Qual mudança de comportamento esta feature deve gerar?**
  Montar um contrato passa a ser **um único envio**, e fazê-lo valer passa a ser um segundo envio,
  intencional e sujeito a concessão própria. O estado deixa de ser interpretado pelo consumidor e
  passa a ser um só, decidido pelo sistema. Ativar passa a marcar o imóvel como locado, e cancelar
  passa a devolvê-lo à disponibilidade — sem que ninguém precise lembrar de fazer isso à mão.

- **Qual o resultado final esperado do ponto de vista do usuário?**
  Preparar um contrato com calma, conferi-lo, fazê-lo valer com um ato deliberado, e ver a carteira
  refletir a realidade: quais contratos valem, quais imóveis estão ocupados e por quem.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Registro do comportamento do sistema antigo** para ativação e cancelamento, capturado das
      regras **inteiras** — inclusive das partes que só uma fase posterior implementará — para servir
      de oráculo de equivalência
- [ ] Cadastro de **contrato de locação**, ligando imóvel, locador e locatário, com prazo, valores e
      datas, criado **num único envio** e nascendo como rascunho
- [ ] Indicação de **zero ou mais fiadores** por contrato
- [ ] **Código legível próprio** por contrato, no formato `CTR-{ano}-{cinco dígitos}`, com contador
      por empresa cujo valor inicial é definido no provisionamento
- [ ] **Quatro estados** — rascunho, ativo, cancelado e encerrado (este último reservado, escrito por
      fase posterior) — com **fonte única** decidida pelo sistema
- [ ] **Alteração do contrato enquanto rascunho**, preservando o código já atribuído
- [ ] **Ativação como ato próprio**, sujeito à ação sensível de ativar contrato: as condições de
      entrada, as derivações de data de fim e valor total, a recusa de imóvel já ocupado, o efeito
      sobre o imóvel e a mudança de estado
- [ ] **Cancelamento como ato próprio**, sujeito à ação sensível de cancelar contrato: a liberação do
      imóvel e a mudança de estado
- [ ] **Retirada de circulação do contrato**, sujeita à ação sensível de excluir cadastro, alcançando
      qualquer estado e sendo puramente de visibilidade
- [ ] **Recusa de cadastro fora de circulação** ao montar e ao ativar contrato; retirada livre no
      sentido inverso
- [ ] **Consulta da carteira de contratos**, com estado, partes e termos de cada um
- [ ] **Apresentação do contrato vigente na consulta de imóveis** — na consulta individual e na
      consulta agregada da carteira de imóveis
- [ ] Registro da **escolha de gerar cobranças automaticamente** e do **local do documento do
      contrato**, ambos apenas persistidos aqui e lidos por fase posterior
- [ ] **Isolamento por empresa** do contrato e de tudo que ele referencia, garantido sem depender de
      conferência da aplicação · `[DELEGAR_TECH_SPEC]`
- [ ] **Exigência de permissão declarada** em toda operação nova, dentro do catálogo fechado existente
- [ ] Crescimento do **contrato de tipos** que o frontend importará depois — interno nesta fase, não
      publicado · `[DELEGAR_TECH_SPEC]`

### 4.2 O que está explicitamente fora do escopo

- [ ] **Geração das cobranças na ativação** — fase posterior. Ativar sem gerar cobrança é estado que o
      sistema antigo já admite, pelo próprio interruptor que ele oferece
- [ ] **Emissão de boletos, enfileiramento e novas tentativas** — fase posterior
- [ ] **Cancelamento das cobranças e pedido de baixa ao provedor** — fases posteriores
- [ ] **Documento do contrato em arquivo e a marcação de cancelado nele** — fase posterior. A
      exigência do sistema antigo de *"sem o documento, não cancela"* **não é reproduzida aqui**
- [ ] **Encerramento automático de contrato vencido** — fase posterior; o estado encerrado existe na
      lista fechada mas não tem quem o escreva nesta fatia
- [ ] **O quinto estado do sistema antigo** (rescindido) — podado, por não ter nenhum caminho de
      escrita no sistema antigo
- [ ] **Alteração de contrato ativo, cancelado ou encerrado** — o contrato é imutável depois de valer
- [ ] **Troca de fiador em contrato vigente e histórico de quem garantiu** — a lista congela na
      ativação
- [ ] **Migração dos contratos existentes e definição do valor inicial do contador** — pertencem à
      virada; aqui apenas se garante que o valor inicial seja parametrizável
- [ ] **Publicação do contrato de tipos** para consumo externo — acontece no marco de entrega
- [ ] **Painel do operador do SaaS** — feature própria, posterior
- [ ] **Qualquer código de frontend** — fronteira do repositório; é gatilho de parada

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**
  O **Usuário Empresa** — quem monta o contrato e consulta a carteira no dia a dia da imobiliária.

- **Qual é seu objetivo ao usar essa feature?**
  Transformar um acordo de locação em registro fiel no sistema, e saber a qualquer momento o que está
  valendo e qual imóvel está ocupado por quem.

- **Quais dores/dificuldades essa feature resolve pra ele?**
  Um fluxo de três passos que pode falhar no meio; um estado de contrato que a tela e o sistema podem
  discordar; e a necessidade de lembrar, à mão, de marcar o imóvel como locado ou devolvê-lo à
  disponibilidade.

**Persona secundária** — o **Admin Empresa**: é quem, na configuração padrão do produto, alcança as
ações sensíveis de **ativar** e **cancelar** contrato, e a de **excluir cadastro**. A separação entre
quem monta e quem faz valer é deliberada, e qualquer uma dessas ações pode ser concedida
individualmente a um Usuário Empresa.

**Fora desta feature** — o **Sysloc Master** não alcança dado de negócio de nenhuma empresa, e
portanto não alcança contrato.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como Usuário Empresa, quero montar um contrato como rascunho, escolhendo imóvel, locador,
  locatário e os termos, para preparar a locação sem que ela passe a valer antes da hora.
- **US-02**: Como Usuário Empresa, quero corrigir um rascunho antes de fazê-lo valer, para acertar um
  dado errado sem começar do zero nem gastar outro número de contrato.
- **US-03**: Como Usuário Empresa, quero indicar zero ou mais fiadores no rascunho, para registrar
  quem garante a locação.
- **US-04**: Como Usuário Empresa, quero que cada contrato tenha um código próprio e legível no
  formato que já conheço, para reconhecê-lo como título nas telas e como rótulo nas escolhas do
  Financeiro.
- **US-05**: Como Admin Empresa, quero fazer valer um contrato já conferido, para que ele passe a
  vigorar e o imóvel dele conste como locado.
- **US-06**: Como Admin Empresa, quero que a ativação me diga o que efetivou e o que ainda não faz,
  para eu não supor que as cobranças foram geradas.
- **US-07**: Como Admin Empresa, quero ser impedido de fazer valer um contrato sobre imóvel que já tem
  contrato vigente, para não locar o mesmo imóvel duas vezes.
- **US-08**: Como Admin Empresa, quero cancelar um contrato, para que ele deixe de valer e o imóvel
  volte a ficar disponível para nova locação.
- **US-09**: Como Usuário Empresa, quero que só me sejam oferecidos e aceitos imóveis e pessoas em
  circulação ao montar o contrato, para não contratar sobre cadastro que a empresa aposentou.
- **US-10**: Como Usuário Empresa, quero consultar a carteira de contratos com o estado de cada um,
  para saber o que está valendo sem abrir contrato por contrato.
- **US-11**: Como Usuário Empresa, quero ver, ao consultar um imóvel, qual contrato o ocupa e quem é o
  locatário, para não juntar informação de dois lugares.
- **US-12**: Como Admin Empresa, quero retirar um contrato de circulação, para tirar da frente um
  rascunho abandonado ou um contrato antigo sem perder o registro dele.
- **US-13**: Como Admin Empresa, quero que montar, fazer valer e cancelar dependam de concessões
  distintas, para separar quem prepara o contrato de quem o efetiva.
- **US-14**: Como Admin Empresa, quero certeza de que nenhum contrato da minha empresa é alcançável
  por outra empresa do produto.
- **US-15**: Como Usuário Empresa, quero que o estado do contrato venha decidido pelo sistema, para a
  tela nunca mostrar um estado enquanto o sistema entende outro.
- **US-16**: Como Usuário Empresa, quero que a data de fim e o valor total sejam calculados pelo
  sistema a partir do início, do prazo e do valor mensal, para não errar a conta nem a virada de mês.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — Todo contrato pertence a exatamente uma Empresa, e o imóvel, o locador, o locatário e os
  fiadores dele pertencem à mesma Empresa. Contrato que junte cadastros de empresas diferentes não
  existe.
- **RN-02** — O contrato tem quatro estados possíveis: **rascunho**, **ativo**, **cancelado** e
  **encerrado**. Nasce rascunho; ativo e cancelado são alcançados por atos próprios; encerrado é
  reservado para a fase que o escreverá e **não tem quem o produza nesta fatia**.
- **RN-03** — O estado é **decidido pelo sistema e é fonte única**. Nenhum indicador interno do
  sistema antigo sobrevive, e nenhum consumidor deriva estado por conta própria.
- **RN-04** — Todo contrato recebe, **ao nascer**, um código legível próprio no formato
  `CTR-{ano}-{cinco dígitos}`, único dentro da Empresa. O contador é por Empresa, admite valor
  inicial definido no provisionamento, **nunca reusa** um número e **admite furo** — rascunho
  abandonado deixa o número consumido para sempre.
- **RN-05** — O contrato é alterável **apenas enquanto rascunho**. Ativo, cancelado e encerrado são
  imutáveis. Alterar um rascunho **não muda** o código já atribuído a ele.
- **RN-06** — Um contrato tem **zero ou mais fiadores**, sem teto. A ligação com o fiador não guarda
  atributo próprio nem histórico: a lista muda enquanto rascunho e **congela na ativação**.
- **RN-07** — Alcançar a área de Contratos é pré-condição de tudo. Além dela: **fazer valer** exige a
  ação sensível de ativar contrato; **cancelar** exige a de cancelar contrato; **retirar de
  circulação** exige a de excluir cadastro. Montar e alterar rascunho exigem apenas a área.
- **RN-08** — A ativação só ocorre se as condições de entrada do contrato forem satisfeitas. O
  conjunto dessas condições e o comportamento exato de cada uma **reproduzem o do sistema antigo**,
  cujo registro é capturado previamente e serve de oráculo.
- **RN-09** — Não se faz valer um contrato sobre imóvel que **já tem contrato vigente**.
- **RN-10** — Na ativação, a **data de fim** e o **valor total** são derivados do início, do prazo em
  meses e do valor mensal — nunca informados pelo usuário —, e o resultado reproduz o do sistema
  antigo inclusive quando o dia de início não existe no mês final.
- **RN-11** — Fazer valer marca o imóvel como **locado** e o liga ao contrato; cancelar devolve o
  imóvel a **disponível** e desfaz a ligação.
- **RN-12** — Nesta fatia, a ativação **não gera cobranças** e o cancelamento **não cancela cobrança
  nem pede baixa ao provedor**. A resposta da ativação declara isso explicitamente, em vez de sugerir
  sucesso completo.
- **RN-13** — A exigência do sistema antigo de possuir o documento do contrato em arquivo para poder
  cancelar **não vale aqui**: ela tornaria o cancelamento impossível enquanto o documento não
  existir.
- **RN-14** — Cadastro **fora de circulação** não é oferecido nem aceito ao montar ou fazer valer um
  contrato. O caminho inverso é livre: retirar de circulação um cadastro já referenciado por contrato
  é aceito, não é recusado por vínculo, e não altera o contrato nem a situação do imóvel.
- **RN-15** — Retirar um contrato de circulação é operação **de visibilidade**: alcança qualquer
  estado, **não muda o estado**, **não libera o imóvel**, é reversível, e nada é apagado. Contrato
  cancelado permanece na carteira, porque é o histórico que se preserva.
- **RN-16** — A escolha de **gerar cobranças automaticamente** é do usuário ao montar o contrato,
  nasce ligada por padrão e é apenas registrada nesta fatia. O mesmo vale para o **local do documento
  do contrato**: guarda-se onde ele está, e quem o produz é fase posterior.
- **RN-17** — Um imóvel ocupado apresenta, nas consultas, o **contrato vigente que o ocupa** e o
  locatário dele. Imóvel sem contrato vigente não apresenta contrato nenhum.
- **RN-18** — O Sysloc Master não alcança contrato de empresa nenhuma.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Usuário Empresa entra na área de Contratos e **monta um contrato**: escolhe o imóvel, o locador e
   o locatário entre os cadastros em circulação, informa data de início, prazo, valor mensal e dia de
   vencimento, e indica os fiadores, se houver.
2. O sistema cria o contrato como **rascunho**, num único envio, e já lhe atribui o **código legível**
   pelo qual ele será conhecido daí em diante.
3. O usuário **confere o rascunho** e corrige o que estiver errado — quantas vezes precisar, sempre
   sob o mesmo código.
4. Quem tem a concessão de **fazer valer** ativa o contrato. O sistema confere as condições de
   entrada, calcula a data de fim e o valor total, marca o imóvel como **locado** e o liga ao
   contrato, e o contrato passa a **ativo**. A resposta informa o que foi efetivado e diz
   explicitamente que as cobranças não foram geradas nesta etapa.
5. A carteira passa a mostrar o contrato como vigente, e a consulta do imóvel passa a apresentar qual
   contrato o ocupa e quem é o locatário.
6. Quando a locação termina por decisão, quem tem a concessão de **cancelar** cancela o contrato: ele
   passa a **cancelado**, o imóvel volta a **disponível** e a ligação entre eles se desfaz. O contrato
   permanece na carteira como registro.

### 7.2 Fluxos Alternativos

- Se o rascunho **não satisfaz as condições de entrada**, a ativação é recusada, o contrato continua
  rascunho e o imóvel permanece exatamente como estava.
- Se o **imóvel já tem contrato vigente**, a ativação do segundo é recusada, e ele continua rascunho.
- Se algum cadastro escolhido **foi retirado de circulação**, montar ou fazer valer é recusado, com
  indicação de qual cadastro está fora de circulação.
- Se alguém tenta **alterar um contrato que já vale**, a alteração é recusada; a mudança de termos
  exige cancelar e montar outro contrato.
- Se alguém tenta **cancelar um contrato que não vale** — um rascunho, ou um já cancelado —, a
  operação é recusada.
- Se um rascunho é **abandonado**, ele pode ser retirado de circulação; o número que ele consumiu não
  volta a ser usado.
- Se a pessoa **não alcança a área** ou **não tem a ação sensível** correspondente, a operação é
  recusada, e a recusa informa o que faltou.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO um Usuário Empresa que alcança a área de Contratos QUANDO ele monta um contrato
      com imóvel, locador, locatário, data de início, prazo, valor mensal e dia de vencimento ENTÃO o
      contrato passa a existir como **rascunho** num único envio, e ainda não vale.
- [ ] **CA-02**: DADO um contrato em rascunho QUANDO o usuário corrige um dado dele ENTÃO a correção é
      aceita e o código do contrato permanece o mesmo; e DADO um contrato ativo ou cancelado QUANDO se
      tenta alterá-lo ENTÃO a alteração é recusada e nada muda.
- [ ] **CA-03**: DADO um contrato em rascunho QUANDO o usuário indica nenhum, um ou vários fiadores
      ENTÃO todos são aceitos; e DADO um contrato já ativo QUANDO se tenta acrescentar ou remover
      fiador ENTÃO a operação é recusada e a lista permanece a que foi congelada na ativação.
- [ ] **CA-04**: DADO um contrato recém-criado QUANDO o usuário o consulta ENTÃO ele exibe um código
      no formato `CTR-{ano}-{cinco dígitos}`, único dentro da empresa; e DADO um contrato cujo
      rascunho foi abandonado ENTÃO o número que ele consumiu **não é atribuído** a nenhum contrato
      posterior.
- [ ] **CA-05**: DADO um rascunho conferido e uma pessoa com a ação sensível de ativar contrato QUANDO
      ela o faz valer ENTÃO o contrato passa a **ativo** e o imóvel dele passa a constar como
      **locado**, ligado a esse contrato.
- [ ] **CA-06**: DADO uma ativação bem-sucedida QUANDO o sistema responde ENTÃO a resposta declara o
      que foi efetivado e informa explicitamente que **as cobranças não foram geradas** nesta etapa.
- [ ] **CA-07**: DADO um imóvel com contrato vigente QUANDO alguém tenta fazer valer um segundo
      contrato sobre o mesmo imóvel ENTÃO a ativação é recusada, o segundo permanece rascunho e o
      contrato vigente não é afetado.
- [ ] **CA-08**: DADO um rascunho que não satisfaz as condições de entrada da ativação QUANDO se tenta
      fazê-lo valer ENTÃO a ativação é recusada, o contrato permanece rascunho, o imóvel permanece
      como estava, e a recusa corresponde à que o sistema antigo produz no mesmo caso.
- [ ] **CA-09**: DADO um contrato vigente e uma pessoa com a ação sensível de cancelar contrato QUANDO
      ela o cancela ENTÃO o contrato passa a **cancelado**, o imóvel volta a **disponível** e a
      ligação entre eles deixa de existir.
- [ ] **CA-10**: DADO um contrato cancelado QUANDO o usuário consulta a carteira ENTÃO ele continua
      listado, marcado como cancelado; e QUANDO se tenta cancelá-lo de novo ou fazê-lo valer ENTÃO a
      operação é recusada.
- [ ] **CA-11**: DADO um imóvel, locador, locatário ou fiador retirado de circulação QUANDO o usuário
      monta ou faz valer um contrato que o referencia ENTÃO a operação é recusada indicando o cadastro
      fora de circulação; e QUANDO ele consulta as escolhas de montagem ENTÃO o cadastro retirado não
      é oferecido.
- [ ] **CA-12**: DADO um imóvel ocupado por contrato vigente QUANDO alguém retira esse imóvel de
      circulação ENTÃO a retirada é **aceita** sem recusa por vínculo, o contrato permanece legível e
      o imóvel permanece **locado**.
- [ ] **CA-13**: DADO contratos em estados diversos QUANDO o usuário consulta a carteira ENTÃO recebe
      cada contrato com seu código, as partes, os termos e o estado, sem precisar juntar informação de
      várias consultas.
- [ ] **CA-14**: DADO um imóvel ocupado por contrato vigente QUANDO o usuário o consulta —
      isoladamente ou pela consulta agregada da carteira de imóveis — ENTÃO vê o código do contrato
      que o ocupa e o locatário dele; e DADO um imóvel sem contrato vigente ENTÃO nenhum contrato é
      apresentado.
- [ ] **CA-15**: DADO um contrato em qualquer estado e uma pessoa com a ação sensível de excluir
      cadastro QUANDO ela o retira de circulação ENTÃO ele deixa de aparecer na listagem padrão **sem
      ser apagado**, o estado dele não muda e o imóvel dele **não é liberado**; e QUANDO ela o devolve
      à circulação ENTÃO ele volta a aparecer.
- [ ] **CA-16**: DADO uma pessoa que alcança a área de Contratos mas **não tem** a ação sensível de
      ativar contrato QUANDO ela monta um contrato ENTÃO o rascunho é criado normalmente; e QUANDO ela
      tenta fazê-lo valer ENTÃO a operação é recusada e a recusa informa o que faltou.
- [ ] **CA-17**: DADO uma pessoa sem a ação sensível de cancelar contrato QUANDO ela tenta cancelar um
      contrato vigente ENTÃO a operação é recusada e o contrato permanece vigente.
- [ ] **CA-18**: DADO um contrato existente na empresa A QUANDO uma pessoa da empresa B tenta
      consultá-lo, alterá-lo, fazê-lo valer, cancelá-lo ou referenciá-lo ENTÃO ele não é alcançável, e
      a garantia não depende de conferência da aplicação; e QUANDO se tenta montar um contrato
      juntando imóvel de uma empresa e pessoa de outra ENTÃO a operação é recusada.
- [ ] **CA-19**: DADO qualquer consulta a contrato QUANDO o consumidor recebe a resposta ENTÃO o
      estado vem num **único campo**, decidido pelo sistema, com valor de uma lista fechada de quatro
      — rascunho, ativo, cancelado, encerrado —, sem nenhum indicador do sistema antigo a interpretar
      e sem o quinto valor podado.
- [ ] **CA-20**: DADO um contrato com data de início, prazo em meses e valor mensal QUANDO ele é feito
      valer ENTÃO a data de fim e o valor total são calculados pelo sistema, nunca informados, e
      reproduzem o resultado do sistema antigo — **inclusive** quando o dia de início não existe no
      mês final, como um início em 29, 30 ou 31.

---

## 9. Restrições & Considerações

- **Decisões arquiteturais vinculantes**: **ADR-0019** (toda transição de estado de negócio é ato
  próprio, governado por ação sensível — nunca campo gravado em atualização do recurso),
  **ADR-0014** (nenhum cadastro é apagado; retirada de circulação não recusa por vínculo),
  **ADR-0015** (contador por empresa, escopo declarado, furo aceito, número nunca reusado),
  **ADR-0016** (o esquema é a fonte única do contrato de tipos), **ADR-0017** (a chave exposta é o
  código legível quando há série declarada; estado calculado pelo sistema; forma fechada da recusa),
  **ADR-0018**, **ADR-0011** (toda operação governada declara a exigência dela, e o padrão é negar),
  **ADR-0008** (isolamento garantido sem conferência redundante da aplicação) e **ADR-0013** (alcance
  do operador do SaaS).
- **Prova de equivalência das regras portadas**: a captura do comportamento do sistema antigo é
  **pré-requisito**, não opcional, e cobre as regras **inteiras** — inclusive as partes que só fases
  posteriores implementarão. A parte excedente é **insumo arquivado**, não trabalho desta fatia.
- **Ambiente de verificação separado** (ADR-0006): a captura nunca é executada contra o ambiente que
  atende a operação real; o sistema em produção só é lido, nada nele é alterado.
- **Janela de disponibilidade**: a captura depende de o sistema antigo estar de pé e responsivo. Ele
  só existe até a fase de virada.
- **Catálogo de permissões fechado**: a fatia não cria concessão nova — as três ações sensíveis que
  ela usa já existem desde a fase de autorização. Precisar de concessão nova seria sinal de escopo mal
  delimitado.
- **Dependência de sequência**: esta fatia depende da anterior (imóveis e pessoas), já concluída.
  Nada nela depende desta.
- **Formato do código legível**: o formato correto é o de **cinco dígitos**, medido no sistema antigo.
  O plano de execução e as instruções do repositório escrevem quatro; a divergência é conhecida e a
  correção desses textos **não pertence** a esta fatia. Convém marcar a decisão no ponto do código
  para que uma revisão futura não a "corrija" para quatro.
- **Compatibilidade com a fatia anterior**: a situação de locação do imóvel passa a ser escrita pelos
  atos de ativação e cancelamento, num campo que a fatia anterior entregou com entrada assimétrica
  deliberada. Unificar as duas listas de valores desfaria uma decisão já fechada.
- **Terminologia**: o glossário de domínio do projeto é canônico. Esta feature introduz termos que
  ainda não estão nele — *contrato*, *rascunho*, *ativação*, *cancelamento* —, que ficam registrados
  para canonização na etapa de validação da especificação técnica.
- **Retenção de dado**: como nada é apagado, o contrato acrescenta **dado financeiro** (valor mensal e
  valor total) ao conjunto retido indefinidamente. Não há política de retenção declarada no projeto —
  é a mesma dívida já registrada na ADR-0014, agora ampliada em classe de dado.
- **Fronteira do repositório**: nenhum código de frontend, em nenhuma hipótese.

---

## 10. Métricas de Sucesso

- **Equivalência das regras portadas**: todo cenário do núcleo local capturado do sistema antigo é
  reproduzido pela implementação nova, **incluindo** o caso de início em dia que não existe no mês
  final. Alvo: **todos os cenários capturados do núcleo local, sem exceção**.
- **Custo de montar um contrato**: de **três** idas ao sistema para **uma**; fazer valer passa a ser
  uma segunda ida, intencional. A leitura do documento inteiro deixa de existir. Alvo: **3 → 2, com a
  leitura intermediária eliminada**.
- **Fonte única de estado**: nenhum consumidor precisa interpretar indicador do sistema antigo para
  saber o estado de um contrato. Alvo: **zero**.
- **Isolamento provado**: as entidades novas passam pela verificação de cobertura existente, e nenhuma
  tentativa de alcançar contrato de outra empresa é bem-sucedida. Alvo: **nenhuma entidade fora do
  padrão, nenhuma tentativa cruzada bem-sucedida**.
- **Cobertura dos critérios de aceite**: todo critério tem caso de teste rastreado, e a suíte passa
  íntegra antes e depois da fatia, sem queda na contagem de casos. Alvo: **20 de 20 rastreados**.
- **Fechamento da fase**: com esta fatia, três das cinco fases exigidas pelo marco de entrega do
  backend ficam concluídas. Alvo: **fase encerrada**.

---

## 11. Roadmap / Fases

> Fases **internas desta fatia** — ordem de construção, não entregas separadas.

- **Fase 1 — Oráculo**: captura do comportamento do sistema antigo para ativação e cancelamento,
  cobrindo as regras inteiras, com prova de que o ambiente que atende a operação não foi alterado.
- **Fase 2 — Contrato e fiadores**: o cadastro do contrato com seus fiadores, o código legível com
  contador parametrizável por empresa, a montagem do rascunho num único envio, a alteração enquanto
  rascunho, a recusa de cadastro fora de circulação, a retirada de circulação do contrato e a consulta
  da carteira.
- **Fase 3 — Ciclo de vida**: ativação e cancelamento como atos próprios, com as derivações, a recusa
  de imóvel já ocupado, os efeitos sobre o imóvel, e a apresentação do contrato vigente nas consultas
  de imóveis.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Montar contrato como rascunho, num único envio | CA-01 |
| US-02 | Corrigir o rascunho antes de fazê-lo valer | CA-02 |
| US-03 | Indicar zero ou mais fiadores | CA-03 |
| US-04 | Código legível próprio por contrato | CA-04 |
| US-05 | Fazer valer o contrato e marcar o imóvel como locado | CA-05, CA-08 |
| US-06 | Ativação declara o que fez e o que não fez | CA-06 |
| US-07 | Impedir dois contratos vigentes sobre o mesmo imóvel | CA-07 |
| US-08 | Cancelar e devolver o imóvel à disponibilidade | CA-09, CA-10 |
| US-09 | Só cadastros em circulação ao montar e ao ativar | CA-11, CA-12 |
| US-10 | Consultar a carteira de contratos com o estado | CA-13 |
| US-11 | Ver, no imóvel, qual contrato o ocupa | CA-14 |
| US-12 | Retirar contrato de circulação | CA-15 |
| US-13 | Concessões distintas para montar, ativar e cancelar | CA-16, CA-17 |
| US-14 | Isolamento entre empresas | CA-18 |
| US-15 | Estado decidido pelo sistema, fonte única | CA-19 |
| US-16 | Data de fim e valor total calculados pelo sistema | CA-20 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado (incluído e excluído definidos)
- [x] User Stories definidas e numeradas (US-01 a US-16)
- [x] Critérios de aceite claros (CA-01 a CA-20, em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum ID pulado
- [x] Nenhuma informação inventada ou deduzida: as quatro decisões que o pré-refinamento deixou em
      aberto foram confirmadas com o usuário
- [x] Pronto para criar o TECH_SPEC (COMO)
