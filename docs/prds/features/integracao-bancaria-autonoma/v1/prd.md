# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados

- **Nome da Feature/Projeto**: `integracao-bancaria-autonoma` — F5, fatia (i): autonomia do Admin na integração bancária
- **Responsável/Autor**: sysloc (usuário) · PRD conduzido por `/agent-spec-sdd-generate-prd`
- **Data**: 2026-08-21
- **Versão**: v1
- **Status**: Aprovado (pelo usuário em 2026-08-21) · **emendado em 2026-08-21** — um item de escopo e o CA-21, pela resolução da [DÚVIDA] 3 (ver §9)
- **Relacionados**:
  - `docs/specs/features/integracao-bancaria-autonoma/v1/pre-refinement.md` — discovery desta fatia (recomenda SDD; recomendação seguida)
  - `docs/specs/features/integracao-bancaria-autonoma/v1/insumo-do-pre-refinamento.md` — insumo original
  - `docs/plano-backend-novo/plano-execucao.md` §F5 (i) — **a fonte**: as duas frentes, as entregas e a aceitação
  - `docs/adr/0036-conversao-de-material-legado-por-processo-externo.md` — decisão arquitetural transversal, registrada **antes** deste PRD
  - `docs/specs/features/fundacao-bancaria/v1/_run/run-report.md` §2, `D64` — o débito que esta feature fecha, agravado em 2026-08-21
  - `docs/specs/features/webhook-e-carne/v1/` — a **recepção** da notícia, já entregue; esta feature cobre a **ativação**, que aquela deixou em aberto
  - `docs/specs/features/automacoes-agendadas/v1/insumo-do-pre-refinamento.md` — a fatia (ii), que recebe a reconferência automática adiada aqui
  - `docs/plano-backend-novo/levantamento-frontend.md` §8.3 — o handoff que consome o contrato desta fatia

> **Nota de vocabulário.** O glossário canônico (`docs/specs/domain-glossary.md`) nomeia **Notícia do
> provedor** a mensagem que chega do provedor por iniciativa dele, e registra que *"webhook" e
> "callback" são vocabulário de transporte*. Esta feature não trata da notícia em si — trata do
> **cadastro junto ao provedor que faz a notícia chegar na hora**. Como o glossário não nomeia esse
> terceiro conceito, este PRD o chama de **entrega imediata da notícia do provedor**, preservando
> "Habilitar webhook" apenas como o **rótulo do botão** já acordado com o usuário e já escrito nos
> gatilhos do handoff. **A canonização do termo fica para a etapa de challenge da tech spec.**

---

## 2. Contexto & Motivação

### Qual problema ou dor existe hoje?

Duas operações da integração bancária **só acontecem com alguém logado no servidor**, e as duas são
trabalho do Admin da imobiliária:

1. **Ativar a entrega imediata da notícia do provedor.** O cadastro é **por cliente**, feito com o
   certificado e o identificador daquele cliente. Cliente novo que entra fica sem entrega imediata
   até alguém com acesso à máquina cadastrá-lo.
2. **Registrar o certificado no formato em que a Autoridade Certificadora o entrega.** A AC embala o
   material numa forma que o produto não abre diretamente — e o fez nas **duas emissões
   consecutivas** medidas (julho/2025 e agosto/2026), de modo que é o padrão dela, não exceção.

### Como funciona atualmente?

- O Admin renova o certificado pela tela, recebe uma recusa que diz que **a senha está errada** — e a
  senha está certa. Medido em 2026-08-20: o operador foi caçar uma senha que não existia. O contorno
  é uma ferramenta de servidor, que o Admin não tem nem deve ter.
- Sem entrega imediata, o pagamento do locatário só é reconhecido pela conferência periódica do dia
  seguinte. O produto **opera correto**, mas devagar — e o Admin não tem como saber que está nesse
  regime, porque a ausência da entrega imediata hoje é **silêncio**, não estado declarado.

### Por que isso precisa ser resolvido agora?

Três razões, e as três têm data:

1. A AC entregou o material em formato não aceito nas **duas emissões consecutivas** — é o padrão.
2. O custo de operação **cresce com o número de clientes**: cada cliente novo e cada renovação viram
   um chamado para quem opera a máquina.
3. Esta é a **última fatia da integração bancária que acrescenta superfície** antes do congelamento,
   que é item do marco de entrega do backend. O que não for decidido aqui **não tem onde nascer
   depois**.

### Quem sofre o impacto do problema?

O **Admin da imobiliária**, que não consegue resolver o que é dele; e o **operador do SaaS**, que
vira gargalo de um trabalho que não escala.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o Admin de cada imobiliária **ative a própria entrega imediata** e
  **renove o próprio certificado pela tela**, sozinho, sem terminal e sem acesso ao servidor — e que,
  quando o provedor recusar, ele leia **o motivo completo e íntegro** e possa tentar de novo.
- **Qual mudança de comportamento esta feature deve gerar?**
  - Entrar cliente novo deixa de exigir intervenção de quem opera o servidor.
  - Renovar certificado deixa de depender do formato que a AC escolheu entregar.
  - A recusa do provedor deixa de ser exceção transitória e passa a ser **dado que a tela lê depois**.
  - A ausência de entrega imediata deixa de ser silêncio e passa a ser **estado declarado**, com o
    produto operando normalmente pela conferência.
  - A recusa do registro do certificado passa a **nomear a causa real**, em vez de culpar a senha.
- **Qual o resultado final esperado do ponto de vista do usuário?** O Admin abre a tela de integrações
  bancárias, vê em que estado está, age com um clique e entende o que aconteceu — em qualquer
  desfecho.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Habilitar a entrega imediata da notícia do provedor**, por empresa, num único ato do Admin,
      que só se declara concluído quando o cadastro **e** a confirmação junto ao provedor forem ambos
      positivos.
- [ ] **Consultar o estado da entrega imediata** da empresa: habilitada ou desabilitada e, quando
      desabilitada, o **motivo completo** devolvido pelo provedor, íntegro e sem interpretação.
- [ ] **Persistência do estado por empresa**, com o desfecho da última tentativa — a recusa sobrevive
      à requisição, para a tela mostrá-la depois.
- [ ] **Tentar novamente** depois de uma recusa, percorrendo exatamente o mesmo ciclo, sem estado
      preso.
- [ ] **As duas operações governadas pela permissão que já governa o certificado** — nenhuma permissão
      nova no catálogo.
- [ ] **Aceitar o material do certificado no formato em que a AC o entrega**, convertendo-o quando
      necessário e preservando **titular, número de série e validade**, afirmado por medição.
- [ ] **Três causas de recusa do registro, com três desfechos distintos**: formato do material não
      suportado, senha que não abre o material e validade já encerrada. **Fecha o `D64`.**
- [ ] **Informar ao Admin quando o material precisou ser convertido** — o arquivo que ele guardou não
      é idêntico ao que o produto passa a usar.
- [ ] **Reconferir o estado da entrega imediata ao registrar um certificado novo**, em melhor-esforço:
      falhar não faz o registro falhar, e o motivo fica registrado.
- [ ] **Declarar e testar a degradação**: com a entrega imediata desabilitada, a conferência continua
      liquidando e estornando. Já implementado — a fatia **declara e prova**, não constrói.
- [ ] **Trilha**: a habilitação e a recusa entram como efeito registrado; a reconsulta que nada muda,
      não.
- [ ] **Deixar por escrito o gancho da reconferência automática** para a fatia seguinte.
- [ ] **A pré-condição de ambiente que a conversão exige passa a ser afirmada na verificação de
      provisionamento** — hoje ela é presença de fato, e nenhuma fatia posterior tem como afirmá-la
      (acrescentado em 2026-08-21, ver §9).

### 4.2 O que está explicitamente fora do escopo

- [ ] **A tela em si** — `[fora do escopo do projeto]`. Este repositório só faz backend; o frontend é
      implementado fora, a partir do handoff. É gatilho de parada.
- [ ] **Desabilitar a entrega imediata pelo produto** — **impossível por medição**: o provedor não
      oferece a operação.
- [ ] **Alterar, desativar ou substituir cadastro de entrega que não seja do próprio produto** —
      decisão do usuário: o cadastro de terceiro do cliente é **intocável**.
- [ ] **Consulta ao vivo ao provedor a cada leitura de estado** — a recusa não sobreviveria à
      requisição, contrariando o requisito do motivo que a tela lê depois.
- [ ] **Reconferência automática e periódica do estado** — adiada para a fatia (ii), que traz o
      agendamento. Urgência baixa: a degradação é primeira classe.
- [ ] **Permissão nova para habilitar a entrega** — granularidade sem papel real correspondente.
- [ ] **Habilitação pelo painel do operador do SaaS** — impossível: o cadastro usa credenciais do
      cliente, que o operador não alcança.
- [ ] **Texto próprio do produto sobrepondo o motivo do provedor** — o íntegro basta na v1
      (ver §9, decisão A1-4).
- [ ] **Ativação em lote de várias empresas** — a quantidade de empresas por instalação torna o clique
      por empresa aceitável.
- [ ] **Habilitar formato criptográfico fraco no processo do produto** — rejeitado pela ADR-0036.
- [ ] **Rota de saúde agregada da integração, expurgo de arquivos guardados, limitador de abuso da
      borda, suporte a um segundo provedor bancário e rotação de chave de cifra** — nenhum é
      comportamento de tela; os que têm gatilho já o têm registrado, e a superfície congelada não se
      gasta com conveniência.
- [ ] **Reabrir a decisão de endereço único para todos os clientes** — resolvido e em produção.

---

## 5. Usuários & Personas

- **Persona primária — Admin da imobiliária (tenant).** Configura a integração bancária da própria
  empresa. **Não tem — nem deve ter — acesso ao servidor.** Objetivo: pôr a cobrança para funcionar e
  mantê-la funcionando sem depender de terceiros. Dor resolvida: deixar de ficar preso numa recusa que
  ele não entende e não pode contornar.
- **Persona secundária — operador do SaaS.** Hoje é o gargalo dos dois fluxos. Objetivo: **deixar de
  ser acionado**. O sucesso da feature é medido pela ausência dele.
- **Persona terciária — agente que implementa o frontend.** Consome o contrato desta feature pelo
  handoff e **não poderá perguntar nada depois do congelamento**. Objetivo: construir a tela com o
  contrato completo em mãos.
- **Contexto de uso**: navegador, dentro da área autenticada, na tela de integrações bancárias. Uso
  **raro e de alta consequência** — a habilitação, uma vez por cliente; a renovação, uma vez por ano.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Admin da imobiliária**, quero habilitar a entrega imediata da notícia do meu
  provedor num único ato, para que meus recebimentos sejam reconhecidos na hora sem depender de
  ninguém com acesso ao servidor.
- **US-02**: Como **Admin da imobiliária**, quero ver o estado atual da entrega imediata da minha
  empresa, para saber se preciso agir.
- **US-03**: Como **Admin da imobiliária**, quando o provedor recusa a habilitação, quero ler o motivo
  completo e íntegro que **ele** devolveu, para entender se a causa é minha ou dele.
- **US-04**: Como **Admin da imobiliária**, quero tentar habilitar de novo depois de uma recusa, para
  resolver assim que a causa deixar de existir, sem ficar preso ao desfecho anterior.
- **US-05**: Como **Admin da imobiliária**, preciso saber que o produto continua cobrando e baixando
  normalmente com a entrega imediata desabilitada, para não concluir que o produto está quebrado.
- **US-06**: Como **Admin da imobiliária**, quero registrar o certificado exatamente como a Autoridade
  Certificadora o entregou, para renovar sozinho pela tela, sem preparo prévio em ferramenta de
  servidor.
- **US-07**: Como **Admin da imobiliária**, quando o registro do certificado é recusado, quero que a
  mensagem nomeie a causa real, para não caçar um problema que não existe.
- **US-08**: Como **Admin da imobiliária**, quando meu material precisou ser convertido para ser
  aceito, quero ser informado disso, para saber que o arquivo que guardei não é idêntico ao que o
  produto usa.
- **US-09**: Como **operador do SaaS**, quero deixar de ser acionado para habilitar entrega e preparar
  material de certificado, para que o custo de operação não cresça com o número de clientes.
- **US-10**: Como **agente que implementa o frontend**, preciso do contrato completo das duas
  operações e do objeto de motivo, para construir a tela sem poder perguntar nada depois do
  congelamento.
- **US-11**: Como **Admin da imobiliária**, quero que registrar um certificado novo reconfira o estado
  da entrega imediata, para que a renovação não me deixe olhando um estado desatualizado.
- **US-12**: Como **Admin da imobiliária**, quero que a habilitação e a recusa fiquem registradas na
  trilha da minha empresa, para saber quem fez o quê e quando.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — A entrega imediata só é declarada **habilitada** quando o cadastro junto ao provedor
  **e** a confirmação por consulta a ele forem **ambos** positivos. Um positivo só não basta.
- **RN-02** — O motivo devolvido pelo provedor é preservado **íntegro** — mensagem, código e todos os
  campos que ele devolveu —, sem tradução, resumo ou interpretação do produto.
- **RN-03** — O estado da entrega imediata e o desfecho da última tentativa **pertencem a uma
  empresa** e só são visíveis a ela. Nenhuma empresa enxerga o estado ou o motivo de outra.
- **RN-04** — Recusa **não prende estado**: uma nova tentativa percorre exatamente o mesmo ciclo, e o
  desfecho novo substitui o anterior.
- **RN-05** — Habilitar quando a entrega **já está ativa** para a empresa não é erro nem duplicação: o
  que a consulta ao provedor afirma prevalece sobre o desfecho do cadastro.
- **RN-06** — Com a entrega imediata desabilitada, **o produto opera normalmente**: a conferência
  periódica continua liquidando e estornando. A ausência é **estado declarado**, nunca silêncio.
- **RN-07** — Nada no produto altera, desativa ou substitui cadastro de entrega que **não seja do
  próprio produto**. Vaga ocupada por sistema de terceiro é **recusa informada**, nunca disputa.
- **RN-08** — Habilitar e consultar a entrega imediata são **atos de configuração da integração
  bancária**, governados pela mesma permissão que já governa o certificado. **Nenhuma permissão nova.**
- **RN-09** — O material do certificado é aceito **no formato em que a AC o entrega**. Quando o produto
  não o abre diretamente, ele o converte, e a conversão preserva **titular, número de série e
  validade** — identidade **afirmada por medição**, nunca presumida pela ausência de erro.
- **RN-10** — A recusa do registro do certificado distingue **três causas**, com desfechos distintos:
  (a) formato do material não suportado, (b) senha que não abre o material, (c) validade já encerrada.
- **RN-11** — A resposta do registro **informa se o material precisou ser convertido**.
- **RN-12** — Registrar um certificado novo **dispara a reconferência** do estado da entrega imediata.
  A reconferência é **melhor-esforço**: falhar **não** faz o registro do certificado falhar, e o motivo
  da falha fica registrado.
- **RN-13** — O material e a senha do certificado **nunca retornam por nenhuma superfície do produto**,
  nem em diagnóstico, e a conversão não os deixa em armazenamento persistente.
- **RN-14** — **Não existe desabilitar** a entrega imediata pelo produto: o provedor não oferece a
  operação. O produto não simula o que não pode cumprir.
- **RN-15** — Habilitação e recusa entram na **trilha** como efeito registrado. Reconsulta que não muda
  o estado **não** gera registro novo.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal — habilitar a entrega imediata

1. O Admin abre a tela de integrações bancárias da sua empresa.
2. O produto apresenta o estado da entrega imediata: **Habilitada** ou **Desabilitada**.
3. Estando desabilitada, o Admin aciona **"Habilitar webhook"**.
4. O produto cadastra a entrega junto ao provedor e, em seguida, **confirma consultando o provedor**.
5. Com os dois positivos, o produto apresenta **Habilitada** e o estado fica registrado para a empresa.

### 7.2 Fluxo Principal — registrar/renovar o certificado

1. O Admin recebe o material da Autoridade Certificadora e o envia pela tela, com a senha.
2. O produto abre o material. Se não conseguir abri-lo diretamente, **converte-o** e confere que
   titular, número de série e validade continuam os mesmos.
3. O produto registra o certificado, substituindo o anterior.
4. A resposta confirma o registro e, quando houve conversão, **informa que houve**.
5. O produto **reconfere** o estado da entrega imediata da empresa.

### 7.3 Fluxos Alternativos

- **O provedor recusa a habilitação** (por exemplo, a vaga do cliente já está ocupada por sistema de
  terceiro): o produto apresenta **Desabilitada** com o **motivo completo do provedor**, e oferece
  **"Tentar novamente"**, que repete o mesmo ciclo do começo.
- **A empresa nunca tentou habilitar**: o produto apresenta **Desabilitada** e explicita que ainda não
  houve tentativa — não há motivo de recusa a exibir.
- **A entrega imediata está desabilitada e um pagamento acontece**: nada se perde — a conferência
  periódica reconhece o pagamento e liquida (ou estorna, quando é o caso).
- **O registro do certificado é recusado**: a mensagem nomeia **qual das três causas** ocorreu —
  formato, senha ou validade encerrada —, e nunca uma pela outra.
- **A reconferência após o registro do certificado falha**: o registro **permanece bem-sucedido**, e o
  motivo da falha fica registrado para consulta posterior.
- **Um usuário sem a permissão de configurar a integração** tenta habilitar ou consultar o estado: o
  produto recusa por falta de permissão.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO uma empresa com certificado válido e a entrega imediata desabilitada, QUANDO o
      Admin aciona "Habilitar webhook", ENTÃO o produto cadastra a entrega junto ao provedor, confirma
      por consulta a ele e apresenta o estado **Habilitada**.
- [ ] **CA-02**: DADO **duas empresas distintas**, cada uma com o próprio certificado, QUANDO cada
      Admin habilita a entrega da sua empresa, ENTÃO as duas ficam habilitadas **independentemente**, e
      nenhuma enxerga o estado nem o motivo da outra.
- [ ] **CA-03**: DADO uma empresa em qualquer estado, QUANDO o Admin consulta o estado da entrega
      imediata, ENTÃO o produto informa habilitada ou desabilitada e, quando desabilitada, o **motivo
      completo da última tentativa**.
- [ ] **CA-04**: DADO que o provedor recusou a habilitação, QUANDO o Admin consulta o estado depois,
      ENTÃO o motivo é apresentado **íntegro** — mensagem, código e todos os campos que o provedor
      devolveu —, **sem interpretação, tradução ou resumo** do produto.
- [ ] **CA-05**: DADO uma tentativa de habilitação recusada anteriormente, QUANDO o Admin aciona
      "Tentar novamente", ENTÃO o mesmo ciclo é percorrido do começo e o desfecho novo **substitui** o
      anterior, sem estado preso.
- [ ] **CA-06**: DADO uma empresa com a entrega imediata desabilitada, QUANDO o locatário paga, ENTÃO
      a conferência periódica continua liquidando (e estornando, quando é o caso), e o produto declara
      o estado como desabilitado em vez de omiti-lo.
- [ ] **CA-07**: DADO que a vaga de entrega do cliente já está ocupada por **sistema de terceiro**,
      QUANDO a habilitação é tentada, ENTÃO **nada daquele cadastro é alterado, desativado ou
      substituído**, e a recusa é informada ao Admin.
- [ ] **CA-08**: DADO um usuário **sem** a permissão de configurar a integração bancária, QUANDO ele
      tenta habilitar a entrega ou consultar o estado, ENTÃO o produto recusa por falta de permissão.
- [ ] **CA-09**: DADO o material do certificado **no formato em que a AC o entrega** — o mesmo que o
      produto hoje recusa —, QUANDO o Admin o registra pela tela com a senha correta, ENTÃO o registro
      é **aceito**, e o certificado registrado tem **titular, número de série e validade idênticos** aos
      do material enviado.
- [ ] **CA-10**: DADO material cujo formato o produto não abre nem consegue converter, QUANDO ele é
      registrado, ENTÃO a recusa nomeia **o formato do material** como causa — e **não** a senha.
- [ ] **CA-11**: DADO material acompanhado de **senha incorreta**, QUANDO ele é registrado, ENTÃO a
      recusa nomeia **a senha** como causa, com desfecho **distinto** do de formato.
- [ ] **CA-12**: DADO material de certificado cuja **validade já se encerrou**, QUANDO ele é
      registrado, ENTÃO a recusa nomeia **a validade encerrada** como causa, com desfecho **distinto**
      das outras duas.
- [ ] **CA-13**: DADO material que **precisou ser convertido** para ser aceito, QUANDO o registro é
      concluído, ENTÃO a resposta **informa ao Admin que o material foi convertido**.
- [ ] **CA-14**: DADO material que o produto **já abre diretamente**, QUANDO ele é registrado, ENTÃO
      **nenhuma conversão ocorre** e a resposta **não** informa conversão.
- [ ] **CA-15**: DADO um registro de certificado bem-sucedido, QUANDO ele é concluído, ENTÃO o estado
      da entrega imediata da empresa é **reconferido**; e DADO que essa reconferência falha, ENTÃO o
      registro do certificado **permanece bem-sucedido** e o motivo da falha fica registrado.
- [ ] **CA-16**: DADO qualquer desfecho do registro do certificado ou da habilitação, QUANDO a resposta
      e os diagnósticos do produto são inspecionados **na saída real**, ENTÃO **em nenhum deles**
      aparecem o material do certificado nem a senha.
- [ ] **CA-17**: DADO uma habilitação bem-sucedida e uma recusa, QUANDO a trilha da empresa é
      consultada, ENTÃO **cada uma consta como efeito registrado**; e DADO uma reconsulta que não muda
      o estado, ENTÃO **nenhum registro novo** é criado na trilha.
- [ ] **CA-18**: DADO o contrato publicado por esta feature, QUANDO o handoff de frontend é gerado,
      ENTÃO ele carrega as **duas operações** com corpo e resposta completos, o **objeto de motivo**, o
      comportamento do botão e do "Tentar novamente", o fato de que **o produto funciona sem a entrega
      imediata**, e que a habilitação é **por empresa**, sem nada a configurar por cliente na
      infraestrutura.
- [ ] **CA-19**: DADO uma empresa que **nunca tentou** habilitar, QUANDO o Admin consulta o estado,
      ENTÃO o produto informa **desabilitada** e explicita que **ainda não houve tentativa**, sem motivo
      de recusa.
- [ ] **CA-20**: DADO um cliente novo entrando no SaaS, QUANDO o Admin dele habilita a entrega e
      registra o certificado **pela tela**, ENTÃO **nenhuma etapa** exige acesso ao servidor por parte
      do operador do SaaS.
- [ ] **CA-21**: DADO um ambiente em que o recurso de conversão exigido **não** esteja disponível,
      QUANDO a verificação de provisionamento é executada, ENTÃO ela **reprova nomeando o recurso
      ausente** — em vez de a ausência só aparecer quando um Admin tentar registrar um certificado.

---

## 9. Restrições & Considerações

### Limitações externas (medidas, não supostas)

- **Não existe operação de desabilitar** a entrega imediata no provedor. O produto não a oferece e não
  simula o que não pode cumprir (RN-14).
- **O cadastro é por cliente**, feito com as credenciais daquele cliente — razão pela qual a
  habilitação **tem de** ser um ato do Admin de cada empresa, e não do operador do SaaS.
- **O endereço de recepção é único** para todos os clientes, e isso **já está resolvido e em
  produção**. Não há nada a configurar por cliente na infraestrutura.
- **A AC entrega o material em formato que o produto não abre diretamente** — padrão medido em duas
  emissões consecutivas.

### Dependências

- **A conversão do material depende de um recurso do ambiente do servidor.** ✅ **Medido em
  2026-08-21**: o recurso está presente e serve, e a verificação de provisionamento **não o afirma** —
  era mesmo presença de fato. A **[DÚVIDA] 3** do discovery fica resolvida **entrando no escopo**
  (§4.1, CA-21), e não sendo delegada: a ADR-0036 declara a afirmação como obrigação, e **nenhuma
  fatia posterior tem onde cumpri-la** — a seguinte é de frontend e a última é a virada.
- **A forma do envelope de recusa** — três desfechos distintos ou um com discriminante — é decisão de
  contrato. → `[DELEGAR_TECH_SPEC]` (**[DÚVIDA] 4** do discovery; resolver no `tech-alignment`).
- **A tela é implementada fora deste repositório**, a partir do handoff. Esta feature entrega
  comportamento e contrato; nenhuma linha de frontend.
- **A fatia (ii)** recebe a reconferência automática e periódica do estado, com o gancho deixado aqui
  por escrito.

### Regras obrigatórias herdadas (não negociáveis)

- **Multi-tenancy é do banco**: o estado nasce com dono-empresa e isolamento forçado. Sem exceção.
- **Nenhuma permissão nova** no catálogo fechado de permissões.
- **Segredo de terceiro é cifrado e não retorna por superfície alguma**, e a ausência de vazamento é
  provada **por medição da saída real**, nunca por leitura de código.
- **Nenhum material de certificado entra na árvore versionada.**
- **A forma da conversão** está fixada pela **ADR-0036**, registrada antes deste PRD: conversão na
  borda de registro, em processo externo de vida curta, com a tolerância ao formato fraco **confinada
  a ele**.
- **A superfície congela depois desta fatia.** O que não entrar aqui não tem onde nascer depois.

### Considerações de UX e de confiança

- **O risco de produto é o Admin concluir que o produto quebrou** quando o provedor recusa. A
  mitigação é dupla: o **motivo íntegro** do provedor, e a **declaração explícita** de que o produto
  funciona sem a entrega imediata. O cliente cuja vaga já está ocupada por terceiro é o **teste vivo**
  do desenho, não uma exceção a tratar.
- **Uso raro e de alta consequência**: a tela precisa ser autoexplicativa na primeira leitura, porque
  não haverá repetição que ensine.

### Considerações legais / de privacidade

- A conversão manipula **chave privada em claro**. A garantia é *não escrever em armazenamento
  persistente* e não devolver por superfície alguma — não impossibilidade física, conforme a própria
  ADR-0036 declara nas consequências.

### Decisões auto-resolvidas nesta etapa (rule `autonomia-do-run.md`, A1)

Nenhuma pergunta bloqueou o PRD; onde havia escolha, adotou-se a recomendada, com a razão registrada:

- **A1-1 · Versão do artefato** → `v1`. _Razão: o diretório de PRDs desta feature não existia._
- **A1-2 · Aderência ao discovery** → seguir a recomendação **SDD** da §15.2 do `pre-refinement.md`,
  sem override. _Razão: recomendação e comando invocado coincidem._
- **A1-3 · Vocabulário** → usar **"entrega imediata da notícia do provedor"** como termo de domínio e
  preservar **"Habilitar webhook"** só como rótulo do botão. _Razão: o glossário canoniza "Notícia do
  provedor" e desaconselha "webhook" para nomeá-la, mas **não nomeia** o cadastro que a faz chegar na
  hora; inventar termo canônico aqui atropelaria a etapa de challenge, e apagar "webhook" contrariaria
  o rótulo já acordado com o usuário e já escrito nos gatilhos do handoff._
- **A1-4 · Recusa de vaga ocupada** → o **motivo íntegro basta** na v1; nenhum texto próprio do produto
  sobreposto. _Razão: o requisito pede "motivo completo"; acrescentar interpretação é acréscimo, não
  substituição, e é a conduta conservadora recomendada pela [DÚVIDA] 5 do discovery._
- **A1-5 · Habilitar o que já está habilitado** → não é erro; prevalece o que a consulta ao provedor
  afirma (RN-05). _Razão: do ponto de vista do Admin o objetivo já está cumprido; tratar como falha
  produziria recusa incompreensível num estado correto, e a aceitação da fatia exige "reativar sem
  estado preso"._
- **A1-6 · Ordem das frentes** → a **frente do certificado primeiro**, a da habilitação depois
  (ver §11). _Razão: sem o certificado a cobrança **para**; sem a entrega imediata o produto opera
  degradado mas correto — é a resposta registrada à provocação "se só desse para uma frente, qual?"._

---

## 10. Métricas de Sucesso

| Métrica | Linha de base | Alvo |
|---|---|---|
| Chamados ao operador do SaaS para habilitar entrega ou preparar material de certificado | 100% dos casos hoje | **zero** |
| Renovações de certificado concluídas pela tela, sem intervenção no servidor | 0% (a renovação de 2026-08-21 exigiu servidor) | **100%** |
| Diagnósticos errados causados por recusa que não nomeia a causa | 1 medido (2026-08-20) | **zero** |
| Empresas com a entrega imediata habilitada | não medível hoje — o estado não existe | **medível**, e crescente |
| Tempo entre o pagamento do locatário e o reconhecimento pelo produto, com entrega habilitada | até o dia seguinte (conferência) | **imediato** |
| Perdas de reconhecimento de pagamento com a entrega desabilitada | zero (a conferência cobre) | **mantém-se zero** |

> A métrica que decide é a primeira: o sucesso desta feature é o **operador do SaaS deixar de ser
> acionado**. As demais explicam por quê.

---

## 11. Roadmap / Fases

Fases **dentro desta única fatia** — a ordem é consequência da provocação registrada no discovery: sem
o certificado a cobrança para; sem a entrega imediata ela apenas fica mais lenta.

- **Fase 1 — Aceitar o material como a AC o entrega.** Conversão na borda de registro com identidade
  preservada e afirmada por medição; três causas de recusa com desfechos distintos; a resposta informa
  quando houve conversão. **Fecha o `D64`.** _(US-06, US-07, US-08)_
- **Fase 2 — Habilitar e consultar a entrega imediata por empresa.** O ciclo cadastrar→confirmar, o
  estado persistido por empresa com o motivo íntegro da última recusa, a nova tentativa sem estado
  preso, a governança pela permissão existente, e a reconferência disparada pelo registro do
  certificado. _(US-01, US-02, US-03, US-04, US-11, US-12)_
- **Fase 3 — Declarar, provar e entregar ao frontend.** A degradação declarada e testada, a trilha, o
  gancho da reconferência automática deixado para a fatia (ii), e o contrato completo pronto para o
  handoff — **última chance antes do congelamento da superfície**. _(US-05, US-09, US-10)_

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Habilitar a entrega imediata num único ato | CA-01, CA-02, CA-08 |
| US-02 | Ver o estado atual da entrega imediata | CA-03, CA-19 |
| US-03 | Ler o motivo íntegro da recusa do provedor | CA-04 |
| US-04 | Tentar novamente sem estado preso | CA-05, CA-07 |
| US-05 | Saber que o produto funciona sem a entrega imediata | CA-06 |
| US-06 | Registrar o certificado como a AC o entrega | CA-09, CA-16, CA-21 |
| US-07 | Recusa que nomeia a causa real | CA-10, CA-11, CA-12 |
| US-08 | Ser informado de que o material foi convertido | CA-13, CA-14 |
| US-09 | Operador do SaaS deixa de ser acionado | CA-20 |
| US-10 | Contrato completo para o handoff do frontend | CA-18 |
| US-11 | Registrar certificado reconfere o estado da entrega | CA-15 |
| US-12 | Habilitação e recusa registradas na trilha | CA-17 |

**Verificação mecânica (reexecutada em 2026-08-21, após a emenda de escopo):** 12 US, **21 CA**.
Nenhuma US sem CA. Nenhum CA órfão — CA-01 a CA-21 aparecem todos na tabela. Nenhum ID pulado nas duas
sequências.

---

## 13. Checklist Final

- [x] PRD descreve apenas O QUE / POR QUÊ — questões de COMO delegadas com `[DELEGAR_TECH_SPEC]`
- [x] Escopo fechado — **13** itens incluídos, 12 explicitamente fora, cada exclusão com razão
- [x] User Stories definidas e numeradas (US-01 a US-12)
- [x] Critérios de aceite claros e comportamentais (CA-01 a **CA-21**, todos em DADO/QUANDO/ENTÃO)
- [x] Regras de negócio numeradas (RN-01 a RN-15)
- [x] Tabela de rastreabilidade preenchida e conferida mecanicamente
- [x] Nenhuma informação inventada — tudo ancorado no discovery, no `plano-execucao.md` §F5 (i), no
      `D64` ou na ADR-0036; escolhas registradas como decisões A1 na §9
- [x] Pronto para criar o TECH_SPEC (COMO)
