# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Automações agendadas
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-22
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - `docs/specs/features/automacoes-agendadas/v1/pre-refinement.md` (discovery — recomendou SDD)
  - `docs/plano-backend-novo/plano-execucao.md` §F5(ii) — fatia (ii) da F5
  - `.claude/plans/plano-saas-decisoes.md` — decisões 25, 26, 27, 28, 29, 30, 31, 34, 37
  - `docs/specs/domain-glossary.md` — vocabulário canônico
  - ADR-0021 **(citar pela emenda de 2026-08-22)**, ADR-0022, ADR-0024, ADR-0026
  - Golden versionado `encerrar-contratos-vencidos.json` (`caracterizacao-regras-legadas/v1`)

> ⚠️ **Decisões auto-resolvidas pela regra A1** de `.claude/rules/autonomia-do-run.md` (escopo
> universal): onde esta skill mandaria `AskUserQuestion`, a alternativa recomendada foi **formulada,
> adotada e registrada** em vez de pausar. Os quatro pontos assim decididos trazem a marca **`(A1)`**
> e são reversíveis.

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**

  O produto novo tem **todo o trabalho automático pronto e nada que o dispare**. Nenhuma rotina roda
  sozinha nele: o que acontece sem intervenção humana ainda acontece no sistema antigo, que será
  desligado. Enquanto isso, quatro defeitos convivem — três medidos no sistema antigo e um descoberto
  no discovery:

  1. **O dia é pulado em silêncio.** Se a máquina está fora do ar na hora marcada, aquela execução
     simplesmente não acontece, e nada acusa.
  2. **Trabalho é feito à toa.** A rotina que roda a cada minuto percorre todas as cobranças em aberto
     da base em 1.438 dos 1.440 minutos do dia, e escreve na própria configuração a cada passagem —
     o registro dela está hoje em **12 MB**.
  3. **Ninguém é avisado quando uma rotina para.** A descoberta é pelo efeito: alguém repara que o
     **Aviso** não saiu.
  4. **Contrato de locação vencido não encerra, e o imóvel não é liberado.** No produto novo esse
     efeito **não existe em forma alguma** — é o único dos efeitos automáticos do sistema antigo que
     ainda não foi entregue.

- **Como funciona atualmente?**

  No sistema antigo, quatro rotinas disparam por relógio do sistema operacional. O discovery as mediu
  no registro do próprio agendador (não na documentação, que estava errada em uma delas). Duas dessas
  quatro **deixaram de existir como conceito** no produto novo, porque o estado da **Cobrança** e a
  **Mora** passaram a ser apurados no momento da leitura, a partir dos fatos gravados — em vez de
  serem marcados por uma rotina que passa e os reescreve. Elas **não têm sucessora, e isso é desenho,
  não lacuna** (ver RN-14).

- **Por que isso precisa ser resolvido agora?**

  É a última entrega que separa o produto novo de operar sozinho. Sem ela o sistema antigo **não pode
  ser desligado**, porque desligá-lo pararia tudo que hoje roda sem ninguém mandar.

- **Quem sofre o impacto do problema?**

  O **Locatário**, que deixa de ser avisado; o **Locador**, cujo imóvel fica ocupado por contrato que
  já venceu; o **Admin Empresa**, que descobre a falha tarde e pelo efeito; e o **Sysloc Master**, que
  não tem como saber que uma rotina parou.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**

  Que todo trabalho automático do produto **dispare sozinho, por empresa, sem que a falha de uma
  alcance as outras** — e que, quando parar, alguém saiba.

- **Qual mudança de comportamento esta feature deve gerar?**

  Três mudanças observáveis: (a) a indisponibilidade da máquina **atrasa** uma execução em vez de
  **perdê-la**; (b) o **Contrato de locação** vencido passa a encerrar sozinho, liberando o imóvel;
  (c) a pergunta *"o Aviso saiu?"* passa a ter resposta no produto, em vez de investigação.

- **Qual o resultado final esperado do ponto de vista do usuário?**

  O **Admin Empresa** abre o produto e vê, por rotina, quando ela executou pela última vez, o que ela
  fez e se algo a impede de funcionar. O **Sysloc Master** é avisado quando uma rotina para, sem
  precisar olhar. E ninguém precisa se lembrar de encerrar contrato vencido.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Execução automática das rotinas, por empresa**, sem intervenção humana
- [ ] **Recuperação do disparo perdido**: máquina indisponível na hora marcada não custa a execução —
      ela acontece assim que a máquina volta `[DELEGAR_TECH_SPEC]` (o mecanismo já está decidido fora
      deste PRD)
- [ ] **Encerramento automático do Contrato de locação vencido**, com liberação do imóvel no mesmo
      ato — comportamento **novo**, portado do sistema antigo pelo golden versionado
- [ ] **Entrega de Avisos respeitando a Janela de horário** de cada empresa
- [ ] **Conferência diária junto ao Provedor**, por empresa, para descobrir Liquidação
- [ ] **Falha isolada por empresa**: erro em uma não impede as outras
- [ ] **Uma execução por vez** da mesma rotina para a mesma empresa
- [ ] **Registro de execução por empresa, gravado só quando houve trabalho**, com descarte automático
      do que envelheceu
- [ ] **Consulta do estado e do histórico recente das rotinas**, disponível ao Admin Empresa
- [ ] **Aviso ao Sysloc Master quando uma rotina para de executar**, com limiar próprio por rotina
- [ ] **Aviso quando os Avisos deixam de sair** por limite do provedor de e-mail (decisão 34)
- [ ] **Suspensão congela tudo; reativação põe em dia** sem disparar nada retroativo
- [ ] **Reprocessamento da Notícia do provedor que ficou retida** por indisponibilidade momentânea **(A1)**
- [ ] **Descarte automático dos boletos guardados que envelheceram**, para o espaço em disco não
      crescer sem teto **(A1)**
- [ ] **Instalação repetível**: instalar duas vezes produz o mesmo estado, sem duplicar
- [ ] **As rotinas voltam sozinhas após reinício da máquina**

### 4.2 O que está explicitamente fora do escopo

- [ ] **Rotina que marque Cobrança como vencida, ou que recalcule Mora** — não existem como conceito
      no produto novo (RN-14). Não são lacuna: são desenho
- [ ] **Rotina que confira se a apuração automática está correta** — seria uma segunda fonte do mesmo
      fato, e é o que o produto eliminou de propósito
- [ ] **Emissão de boletos em lote de forma automática** — permanece **ato deliberado** do Admin
      Empresa, por ser uma das ações sensíveis do produto **(A1)**
- [ ] **Reconsulta periódica da Entrega da notícia do provedor** — ninguém pediu, e a entrega
      desabilitada já degrada para a conferência diária **(A1)**
- [ ] **Qualquer tela** — este repositório entrega apenas o comportamento e a informação; a tela é de
      outra etapa e de outro repositório
- [ ] **Painel de saúde para o Sysloc Master** — o histórico pertence a cada empresa, e o Sysloc
      Master não alcança dado de negócio de nenhuma delas
- [ ] **Aviso ao Admin Empresa sobre problema de infraestrutura** — ele não pode agir sobre isso
- [ ] **Encerramento manual de Contrato de locação pela tela** — transferiria direito e exigiria
      concessão própria, que o catálogo fechado de ações sensíveis não tem. **Decisão não tomada**

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**

  O **Admin Empresa** — quem administra a imobiliária no dia a dia. É a única persona que **consulta**
  algo nesta feature, e a única que pode agir sobre a maior parte do que pode dar errado (contato do
  Locatário ausente, integração bancária mal configurada, Janela de horário mal declarada).

- **Quais outras personas são afetadas?**

  | Persona | Relação com a feature |
  |---|---|
  | **Sysloc Master** | É **avisado** quando uma rotina para. Não consulta nada — não alcança dado de negócio de empresa alguma |
  | **Locatário** | **Recebe** o efeito: o Aviso chega dentro da Janela de horário, e nunca em enxurrada retroativa |
  | **Locador** | **Recebe** o efeito: o imóvel é liberado quando o Contrato de locação vence |

- **Qual é o objetivo do Admin Empresa ao usar essa feature?**

  Confiar que o trabalho automático aconteceu — e, quando não aconteceu, descobrir **por quê** sem
  precisar de ninguém.

- **Quais dores essa feature resolve pra ele?**

  Hoje ele descobre a falha pelo efeito e depende de quem opera o servidor para investigar. Passa a
  ver o estado no próprio produto, em vocabulário de negócio.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Admin Empresa**, quero ver quando cada rotina da minha empresa executou pela
  última vez e o que ela fez, para confiar que o trabalho automático está acontecendo.
- **US-02**: Como **Admin Empresa**, quero saber **por que** um Aviso não saiu, para corrigir o que
  depende de mim em vez de abrir chamado.
- **US-03**: Como **Sysloc Master**, quero ser avisado quando uma rotina para de executar, para agir
  antes de o cliente perceber.
- **US-04**: Como **Locatário**, quero receber o Aviso dentro do horário que a imobiliária permite,
  para não ser incomodado de madrugada.
- **US-05**: Como **Locatário**, não quero receber uma enxurrada de Avisos antigos quando a empresa
  volta de uma suspensão, para não ter a impressão de cobrança indevida.
- **US-06**: Como **Locador**, quero que meu imóvel seja liberado quando o Contrato de locação vence,
  para poder alugá-lo de novo sem depender de alguém lembrar.
- **US-07**: Como **Admin Empresa**, quero que as Liquidações sejam descobertas todo dia junto ao
  Provedor, para que a carteira reflita o que foi pago mesmo quando a notícia imediata não chega.
- **US-08**: Como **Sysloc Master**, quero que a indisponibilidade da máquina **atrase** uma execução
  em vez de perdê-la, para que um reinício não custe um dia de trabalho.
- **US-09**: Como **Sysloc Master**, quero que o erro de uma empresa não impeça as demais de rodar,
  para que um cliente com problema não pare o SaaS inteiro.
- **US-10**: Como **Sysloc Master**, quero instalar a automação quantas vezes for preciso sem
  duplicar nada, para provisionar e reprovisionar com segurança.
- **US-11**: Como **Admin Empresa**, quero ser avisado quando os Avisos deixarem de sair por limite do
  provedor de e-mail, para não descobrir pela inadimplência.
- **US-12**: Como **Admin Empresa**, quero que uma Notícia do provedor recebida durante uma
  indisponibilidade momentânea seja processada depois, para não perder o registro de um pagamento.
- **US-13**: Como **Sysloc Master**, quero que o espaço ocupado pelos boletos guardados e pelo
  histórico não cresça sem teto, para não ficar sem disco.
- **US-14**: Como **Admin Empresa**, quero que a suspensão da minha empresa congele o trabalho
  automático e a reativação o coloque em dia, para não haver efeito acontecendo enquanto estou fora.

---

## 6. Regras de Negócio (alto nível)

**Encerramento do Contrato de locação** — portadas do golden versionado, medidas contra o sistema antigo:

- **RN-01** — É candidato a encerramento todo **Contrato de locação** que esteja valendo e cuja data
  de fim já tenha passado. Contrato cuja data de fim ainda não chegou **não** é candidato.
- **RN-02** — **Contrato de locação sem imóvel associado é ignorado**, mesmo vencido, e o motivo do
  descarte fica registrado. Ele **permanece valendo**.
- **RN-03** — Encerrar um Contrato de locação e liberar o imóvel dele são **um único ato**: ou os dois
  acontecem, ou nenhum acontece.
- **RN-04** — Contrato de locação já encerrado **não** é candidato, e o imóvel de um contrato já
  encerrado **não** é liberado retroativamente. A rotina não corrige o passado.
- **RN-05** — Executar a rotina duas vezes no mesmo dia produz o mesmo resultado que executá-la uma vez.

**Entrega de Avisos:**

- **RN-06** — A **Janela de horário** diz **quando é permitido** entregar Aviso, nunca **quando
  acontece**. Fora dela, nenhum Aviso é entregue.
- **RN-07** — Uma Cobrança já avisada não recebe Aviso de novo dentro do intervalo mínimo declarado
  pela empresa, ainda que a rotina passe muitas vezes.
- **RN-08** — Uma Cobrança paga ou cancelada **nunca** origina Aviso, por caminho nenhum.

**Suspensão e reativação:**

- **RN-09** — Empresa suspensa **não executa rotina alguma**.
- **RN-10** — Na reativação, as rotinas que apenas acertam estado executam **uma vez**, para pôr em
  dia. A entrega de Avisos **não** retroage: nenhum Aviso do período suspenso é enviado.
- **RN-11** — Notícia do provedor recebida durante a suspensão é **registrada** e aplicada na
  reativação.

**Execução e registro:**

- **RN-12** — Falha no processamento de uma empresa **não impede** o das demais na mesma passagem.
- **RN-13** — A mesma rotina **não corre duas vezes ao mesmo tempo** para a mesma empresa.
- **RN-14** — ⚠️ **O estado da Cobrança e a Mora nunca são movidos por rotina.** Os dois são apurados
  a partir dos fatos gravados, no momento da leitura, num único lugar. Uma Cobrança fica vencida
  porque a data passou, não porque alguém a marcou. **Isto é decisão registrada do produto, e é a
  razão de duas rotinas do sistema antigo não terem sucessora.** Qualquer proposta futura de "rotina
  que marca vencidas" ou "rotina que recalcula mora" está reabrindo esta decisão.
- **RN-15** — Passagem que **não encontrou trabalho não gera registro**. Só a que produziu efeito é
  registrada, com o que ela fez.
- **RN-16** — O histórico de execução pertence à **Empresa** e é descartado automaticamente depois de
  **90 dias** **(A1)**.
- **RN-17** — Uma rotina é considerada **parada** por um limiar **próprio dela**, derivado da própria
  frequência: o que é silêncio normal para uma rotina diária é silêncio alarmante para uma que roda a
  cada minuto.
- **RN-18** — O aviso segue a **natureza do problema**: o que é **infraestrutura** (rotina que não
  executa, processo caído) vai ao **Sysloc Master** pelo canal de operação; o que é **configuração da
  empresa** (contato ausente, integração bancária pendente, e-mail recusado) fica visível ao **Admin
  Empresa**. Aviso de rotina parada **não** depende do e-mail funcionar, porque o e-mail pode ser
  justamente o que quebrou.
- **RN-19** — O histórico é escrito em **vocabulário do produto** — quem o lê é o Admin Empresa, não
  quem opera o servidor.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

**a) O trabalho acontece sozinho** (ninguém inicia):

1. Chega a hora declarada para uma rotina.
2. O sistema identifica **quais empresas** têm trabalho para aquela rotina naquele momento.
3. Para cada uma delas, o trabalho é feito **de forma isolada** — o que acontece com uma não alcança
   as outras.
4. A empresa em que houve efeito ganha um **registro do que foi feito**; a empresa em que não havia
   nada a fazer não gera registro algum.
5. Se a rotina não conseguir executar, o **Sysloc Master** é avisado, com a identificação de **qual**
   rotina falhou.

**b) O Admin Empresa consulta:**

1. O Admin Empresa procura o estado das automações da empresa dele.
2. O sistema apresenta, por rotina: quando executou pela última vez, o que fez, quando deve executar
   de novo, e o que está impedindo — se algo estiver.
3. Se o impedimento é da alçada dele (contato ausente, integração pendente), a informação diz o que é.

### 7.2 Fluxos Alternativos

- **A máquina esteve fora do ar na hora marcada** → a execução **não é perdida**: acontece assim que a
  máquina volta. O dia não é pulado.
- **Contrato de locação vencido não tem imóvel** → é ignorado e **permanece valendo**, com o motivo
  registrado (RN-02).
- **A empresa está suspensa** → nada executa. Na reativação, o que apenas acerta estado roda uma vez;
  Avisos do período **não** são enviados (RN-10).
- **O provedor de e-mail recusa os envios por limite** → o Admin Empresa é avisado de que os Avisos
  pararam de sair, antes de a inadimplência denunciar.
- **A Entrega da notícia do provedor está desabilitada** → o produto **opera normalmente**: a
  conferência diária continua descobrindo Liquidação. É mais devagar, não é incorreto.
- **Uma execução da mesma rotina para a mesma empresa ainda está em curso** → a nova não começa
  (RN-13).
- **A máquina volta depois de dias fora** → as execuções recuperadas acontecem sem atropelo, e a
  entrega de Avisos **continua sem retroagir**.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO duas empresas com **Janelas de horário** distintas QUANDO chega o horário de cada
      uma ENTÃO cada empresa tem seus Avisos entregues **dentro da própria janela**, e nenhuma tem
      Aviso entregue fora dela.
- [ ] **CA-02**: DADO que o processamento de uma empresa falha QUANDO a passagem da rotina corre
      ENTÃO as demais empresas são processadas normalmente, e a falha fica registrada apontando a
      empresa afetada.
- [ ] **CA-03**: DADO que uma rotina deixou de executar por mais tempo que o limiar próprio dela
      QUANDO esse limiar é ultrapassado ENTÃO o Sysloc Master é avisado, e o aviso identifica **qual**
      rotina parou.
- [ ] **CA-04**: DADO que a instalação da automação já foi feita QUANDO ela é executada uma segunda
      vez ENTÃO o estado final é o mesmo da primeira, sem entrada duplicada.
- [ ] **CA-05**: DADO um **Contrato de locação** valendo, com imóvel, cuja data de fim já passou
      QUANDO a rotina de encerramento executa ENTÃO o contrato passa a encerrado **e** o imóvel fica
      disponível — os dois no mesmo ato.
- [ ] **CA-06**: DADO um Contrato de locação vencido **sem imóvel** QUANDO a rotina de encerramento
      executa ENTÃO ele **permanece valendo**, e o descarte é registrado com o motivo.
- [ ] **CA-07**: DADO um Contrato de locação cuja data de fim **ainda não chegou** QUANDO a rotina de
      encerramento executa ENTÃO ele permanece valendo e o imóvel permanece ocupado.
- [ ] **CA-08**: DADO um Contrato de locação **já encerrado** QUANDO a rotina de encerramento executa
      ENTÃO nada muda nele nem no imóvel dele.
- [ ] **CA-09**: DADO que a rotina de encerramento já executou hoje QUANDO ela executa de novo no
      mesmo dia ENTÃO o resultado é idêntico ao da primeira passagem.
- [ ] **CA-10**: DADO que a máquina esteve indisponível no horário marcado de uma rotina diária
      QUANDO ela volta ENTÃO aquela execução acontece, em vez de o dia ser pulado.
- [ ] **CA-11**: DADO uma passagem de rotina em que **nenhuma empresa tinha trabalho** QUANDO ela
      termina ENTÃO **nenhum registro de execução é gravado**.
- [ ] **CA-12**: DADO uma passagem em que houve efeito para uma empresa QUANDO ela termina ENTÃO
      existe **um** registro para aquela empresa, descrevendo o que foi feito em vocabulário do produto.
- [ ] **CA-13**: DADO um registro de execução com mais de 90 dias QUANDO o descarte automático corre
      ENTÃO ele deixa de existir, e os mais recentes permanecem.
- [ ] **CA-14**: DADO um Admin Empresa autenticado QUANDO ele consulta o estado das automações ENTÃO
      recebe, por rotina, a última execução, o que ela fez, a próxima esperada e o impedimento, se
      houver — **e nada de outra empresa**.
- [ ] **CA-15**: DADO um Admin Empresa de outra empresa QUANDO ele consulta o estado das automações
      ENTÃO não alcança nenhum registro da primeira.
- [ ] **CA-16**: DADO que a Entrega da notícia do provedor está **desabilitada** para uma empresa
      QUANDO a conferência diária executa ENTÃO as Liquidações do dia continuam sendo descobertas.
- [ ] **CA-17**: DADO uma empresa **suspensa** QUANDO chega o horário de qualquer rotina ENTÃO nada é
      executado para ela.
- [ ] **CA-18**: DADO uma empresa que ficou suspensa com Cobranças que se tornaram avisáveis no período
      QUANDO ela é reativada ENTÃO **nenhum Aviso retroativo** é entregue, e as rotinas que acertam
      estado executam **uma vez**.
- [ ] **CA-19**: DADO que o provedor de e-mail passou a recusar os envios por limite QUANDO isso é
      detectado ENTÃO o Admin Empresa fica sabendo que os Avisos pararam de sair.
- [ ] **CA-20**: DADO uma Notícia do provedor que ficou retida por indisponibilidade momentânea QUANDO
      a rotina de reprocessamento executa ENTÃO ela é processada e o efeito dela é registrado.
- [ ] **CA-21**: DADO boletos guardados mais antigos que o prazo de retenção QUANDO o descarte
      automático corre ENTÃO eles deixam de ocupar espaço, e os que ainda estão no prazo permanecem.
- [ ] **CA-22**: DADO que uma execução de uma rotina para uma empresa está em curso QUANDO uma nova
      passagem tenta iniciar a mesma rotina para a mesma empresa ENTÃO a segunda não começa.
- [ ] **CA-23**: DADO o produto instalado QUANDO a máquina é reiniciada ENTÃO todas as rotinas voltam
      a executar sozinhas, sem intervenção.
- [ ] **CA-24**: DADO uma Cobrança cuja data de vencimento passou QUANDO ela é consultada ENTÃO ela
      aparece como vencida **sem que rotina alguma tenha passado por ela** (RN-14).

---

## 9. Restrições & Considerações

- **O mecanismo do gatilho já está decidido fora deste PRD** — `plano-execucao.md` §F5(ii) (decisão 30
  refinada). O PRD registra a **propriedade exigida** (recuperar o disparo perdido, identificar qual
  rotina falhou, instalação repetível); o mecanismo é `[DELEGAR_TECH_SPEC]` e **não se reabre**.
- **Toda informação de negócio pertence a exatamente uma Empresa**, e o isolamento é garantido pela
  camada de dados, não por conferência da aplicação. O histórico de execução herda isso — e é a razão
  de o Sysloc Master **não** ter painel dele.
- **O Sysloc Master não alcança dado de negócio de empresa alguma.** Restrição de perfil, não escolha
  de produto.
- **Esta é a última entrega que acrescenta superfície consultável** antes do congelamento que
  antecede a entrega ao frontend. O que não nascer aqui **não entra depois** sem custo de contrato.
- **A transição de estado disparada por rotina, sem ator humano, é conforme** — registrada pela
  **emenda de 2026-08-22 à ADR-0021**, que declara a classe de ato sem governança a exigir por não
  haver quem autorizar. ⚠️ **Citar a ADR-0021 pela emenda, nunca só pela decisão original.**
- **O encerramento manual pela tela permanece uma decisão não tomada** — transferiria direito e
  exigiria concessão própria, que o catálogo fechado de ações sensíveis não possui.
- **Duas fontes de tempo convivem** — a que dispara a rotina e a que o domínio usa para saber que dia
  é hoje. Qual governa o quê é `[DELEGAR_TECH_SPEC]`, mas o comportamento exigido é: **a rotina de
  00:02 não pode encerrar contrato de ontem por divergência de fuso.**
- **O produto usa remetente único de e-mail para todas as empresas** — por isso o Aviso retroativo é
  proibido (RN-10): a reação de spam de um Locatário atinge todos os clientes.
- **O golden versionado do encerramento é o oráculo** das RN-01 a RN-05; divergir dele exige decisão
  explícita.

---

## 10. Métricas de Sucesso

- **Execuções perdidas por indisponibilidade: zero.** Hoje, toda indisponibilidade na hora marcada
  custa uma execução inteira.
- **Contratos de locação vencidos com imóvel ainda ocupado após 24h: zero.** Hoje, no produto novo,
  são **todos** — o efeito não existe.
- **Tempo entre uma rotina parar e alguém saber**: de *"até alguém reparar que o Aviso não saiu"*
  para dentro do limiar declarado da rotina.
- **Registro gerado em passagem sem trabalho: zero linhas.** É a métrica que substitui o crescimento
  do registro de 12 MB do sistema antigo.
- **Rotinas do sistema antigo sem equivalente resolvido: zero** — contando como resolvidas tanto as
  portadas quanto as **absorvidas pela apuração na leitura** (RN-14). É o que autoriza desligar o
  sistema antigo.
- **Chamados do Admin Empresa perguntando "o Aviso saiu?"**: redução — a resposta passa a estar no
  produto.

---

## 11. Roadmap / Fases

- **Fase 1 — O que dispara**: execução automática por empresa, com recuperação do disparo perdido,
  falha isolada, uma execução por vez, instalação repetível e retorno após reinício.
  *(US-04, US-08, US-09, US-10)*
- **Fase 2 — O que faltava acontecer**: encerramento do Contrato de locação vencido com liberação do
  imóvel; conferência diária junto ao Provedor; reprocessamento da Notícia retida; suspensão e
  reativação. *(US-06, US-07, US-12, US-14, US-05)*
- **Fase 3 — Quem observa**: registro de execução por empresa com descarte automático, consulta do
  estado e do histórico, aviso de rotina parada e aviso de Avisos que pararam de sair.
  *(US-01, US-02, US-03, US-11, US-13)*

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Ver quando cada rotina executou e o que fez | CA-12, CA-14 |
| US-02 | Saber por que um Aviso não saiu | CA-14, CA-19 |
| US-03 | Ser avisado quando uma rotina para | CA-03 |
| US-04 | Receber Aviso dentro da Janela de horário | CA-01 |
| US-05 | Não receber Aviso retroativo após reativação | CA-18 |
| US-06 | Imóvel liberado quando o contrato vence | CA-05, CA-06, CA-07, CA-08, CA-09 |
| US-07 | Liquidações descobertas todo dia junto ao Provedor | CA-16 |
| US-08 | Indisponibilidade atrasa, não perde a execução | CA-10 |
| US-09 | Erro de uma empresa não impede as demais | CA-02 |
| US-10 | Instalar quantas vezes for preciso sem duplicar | CA-04 |
| US-11 | Ser avisado quando os Avisos param por limite do provedor | CA-19 |
| US-12 | Notícia retida é processada depois | CA-20 |
| US-13 | Espaço em disco não cresce sem teto | CA-13, CA-21 |
| US-14 | Suspensão congela; reativação põe em dia | CA-17, CA-18 |

**Critérios de aceite sem User Story própria** — são **invariantes do produto**, verificáveis e
deliberadamente presentes; cada um sustenta uma regra de negócio, não uma história:

| Critério | Invariante que sustenta |
|---|---|
| CA-11 | RN-15 — passagem sem trabalho não gera registro |
| CA-15 | Isolamento entre empresas na consulta (US-01 pela ótica de quem **não** deve ver) |
| CA-22 | RN-13 — uma execução por vez por (empresa, rotina) |
| CA-23 | As rotinas voltam sozinhas após reinício |
| CA-24 | RN-14 — estado da Cobrança é apurado na leitura, nunca movido por rotina |

**Verificação mecânica executada antes de salvar:**
- US órfã (sem CA): **nenhuma** — as 14 US têm ao menos um CA.
- CA órfão: **cinco** (CA-11, CA-15, CA-22, CA-23, CA-24) — **justificados acima** como invariantes,
  não removidos.
- IDs pulados: **nenhum** — US-01 a US-14 e CA-01 a CA-24, sequências contínuas.

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-14)
- [x] Critérios de aceite claros (CA-01 a CA-24, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida, com os CA sem US justificados
- [x] Pronto para criar o TECH_SPEC (COMO)
