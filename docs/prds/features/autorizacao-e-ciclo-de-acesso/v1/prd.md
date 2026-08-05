# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: `autorizacao-e-ciclo-de-acesso` — segunda e última fatia da Fase 1 do backend nativo
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-04
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - `docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/pre-refinement.md` — o discovery desta fatia, que convergiu as direções aqui traduzidas em requisito
  - `docs/specs/features/fundacao-multitenancy-identidade/v1/` — a fatia irmã, concluída e provada; entrega isolamento entre empresas e a entrada por sessão
  - `docs/adr/0010-efetivo-de-permissao-do-perfil-com-overrides-na-sessao.md` — decisão arquitetural que esta feature origina e adota
  - `docs/adr/0007-forma-canonica-do-contrato-da-api.md` — forma canônica das respostas e das recusas
  - `docs/specs/domain-glossary.md` — glossário canônico; os termos **Empresa**, **Sysloc Master**, **Admin Empresa**, **Usuário Empresa**, **Senha provisória** e **Vínculo de acesso** são usados aqui na grafia canônica
  - `.claude/plans/plano-saas-decisoes.md` — decisões 8, 11, 14, 15, 38 e 39
  - `docs/plano-backend-novo/plano-execucao.md` §F1 — itens 9 a 12

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** O sistema sabe **quem** é cada pessoa, e não sabe **o que ela pode**. Os três perfis existem apenas como rótulo de identidade: nenhuma decisão de acesso é tomada a partir deles. Não há nenhuma forma de admitir uma Empresa nova, de criar uma pessoa, de suspender quem não paga ou de ajustar o que alguém alcança — nada disso existe como operação do produto.
- **Como funciona atualmente?** Uma Empresa nova só passa a existir se alguém intervier diretamente no servidor. Uma pessoa só passa a existir do mesmo modo. Suspender uma Empresa inadimplente é comportamento previsto por decisão e sem nenhuma forma de ser executado. E qualquer pessoa que consiga entrar alcança tudo que o produto expõe, porque não há o que a limite.
- **Por que isso precisa ser resolvido agora?** Três razões, e cada uma bastaria. Primeira: é o que falta para o SaaS existir de fato — vazio, mas completo. Segunda: as operações criadas aqui entram na superfície do produto que **congela** na entrega do backend, e é a partir dela que a interface será religada; o que não nascer agora não nasce mais sem custo. Terceira: toda funcionalidade das fases seguintes vai decidir acesso a partir do que se define aqui, sem participar do debate.
- **Quem sofre o impacto do problema?** O **Sysloc Master**, que não consegue operar o SaaS nem admitir o segundo cliente. O **Admin Empresa**, que não consegue delegar sem entregar tudo — exatamente a dor que o sistema antigo tem. E o **Usuário Empresa**, que hoje ou alcança tudo, ou não existe.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o SaaS seja operável de ponta a ponta pelo próprio produto — admitir uma Empresa, dar-lhe um administrador, esse administrador criar a equipe dele e definir o que cada pessoa alcança — e que toda operação seja decidida contra o que aquela pessoa pode, no momento em que ela age.
- **Qual mudança de comportamento esta feature deve gerar?** O acesso deixa de ser **rótulo** e passa a ser **decisão**. Quem não pode, não consegue — e sabe por quê. Quem perde uma permissão perde na operação seguinte, não no dia seguinte.
- **Qual o resultado final esperado do ponto de vista do usuário?** O Master admite uma imobiliária nova em minutos, sem ninguém tocar no servidor. O Admin dessa imobiliária cria a equipe e libera para cada pessoa exatamente o que ela precisa — inclusive **retirando** de alguém algo que o perfil daria. E cada pessoa vê apenas o que lhe cabe.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] Catálogo fechado de permissões: **10 áreas de tela** e **7 ações sensíveis**, e nada fora dele
- [ ] Cada perfil define um conjunto padrão de permissões, aplicado a quem o recebe
- [ ] O Admin ajusta o padrão pessoa a pessoa, tanto **concedendo** quanto **retirando**
- [ ] A pessoa conhece, ao entrar, quais telas e ações alcança
- [ ] Mudança de permissão passa a valer na operação seguinte, sem interromper quem está trabalhando
- [ ] Suspender uma Empresa ou desativar uma pessoa **corta o acesso imediatamente**
- [ ] Recusa por falta de permissão informa **qual permissão faltou**
- [ ] Ciclo de vida da Empresa pelo Master: admitir, dar administrador, suspender, reativar, listar
- [ ] Ciclo de vida das pessoas pelo Admin: criar, ajustar permissões, mudar perfil, desativar, reativar
- [ ] Onboarding por **Senha provisória** exibida uma única vez a quem cria, entregue por fora do sistema, com troca obrigatória antes de qualquer outra ação, e reemissão quando ela se perder
- [ ] Correções de fundação herdadas da fatia anterior que esta entrega torna exigíveis ou resolve

### 4.2 O que está explicitamente fora do escopo

- [ ] **Exclusão** de Empresa ou de pessoa — nada é apagado, apenas suspenso ou desativado
- [ ] Painel do operador do SaaS: métricas, histórico de suspensões e consulta à trilha de entradas — é produto próprio, posterior à virada
- [ ] Envio da Senha provisória por e-mail — o canal de mensagens só nasce numa fase seguinte
- [ ] Prazo de validade por tempo para a Senha provisória
- [ ] Permissão de escopo da Empresa inteira (plano contratado, módulo assinado) — não existe decisão de produto que a exija
- [ ] Política de retenção do histórico de tentativas de entrada — é assunto de operação, não de acesso
- [ ] Qualquer reabertura do que a fatia anterior entregou e provou: isolamento entre Empresas, entrada por sessão, bloqueio por tentativas, segundo fator, e a recusa de entrada que não distingue a causa
- [ ] Qualquer código de interface — a religação da aplicação do cliente acontece fora deste repositório

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Admin Empresa** — quem administra a imobiliária no dia a dia, cria as pessoas dela e decide o que cada uma alcança. É ele quem opera a matriz de permissões e quem lê a mensagem de recusa para saber o que liberar.
- **Qual é seu objetivo ao usar essa feature?** Delegar trabalho sem entregar o controle: dar a cada pessoa exatamente o que ela precisa, nem mais nem menos, e corrigir isso a qualquer momento.
- **Quais dores/dificuldades essa feature resolve pra ele?** Hoje ele não tem escolha entre "acesso total" e "sem acesso". Não consegue cadastrar ninguém sem ajuda técnica, nem tirar o acesso de quem saiu da equipe.

**Personas secundárias:**

- **Sysloc Master** — o operador do SaaS. Admite Empresas, dá a cada uma seu primeiro administrador, suspende quem não paga e reativa quem regularizou. **Não alcança dado de negócio de nenhuma Empresa**, e isso continua verdadeiro depois desta feature.
- **Usuário Empresa** — opera as telas que lhe foram liberadas e não administra ninguém. É quem sente a permissão nova valer na hora, e quem recebe a recusa quando tenta o que não pode.

**Contexto de uso**: navegador em computador de mesa, no expediente da imobiliária. A Senha provisória é entregue por telefone ou aplicativo de mensagens, porque o produto ainda não envia e-mail.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Sysloc Master**, quero admitir uma Empresa nova no sistema para atender um cliente sem depender de intervenção técnica no servidor.
- **US-02**: Como **Sysloc Master**, quero dar à Empresa recém-admitida seu primeiro **Admin Empresa**, recebendo a Senha provisória dele uma única vez, para entregá-la ao cliente por telefone.
- **US-03**: Como **Sysloc Master**, quero reemitir a Senha provisória quando ela se perder, para não precisar recriar a pessoa.
- **US-04**: Como **Sysloc Master**, quero suspender uma Empresa inadimplente e ter o acesso dela cortado imediatamente, para que a suspensão signifique alguma coisa.
- **US-05**: Como **Sysloc Master**, quero reativar uma Empresa que regularizou, para devolver o acesso sem recriar nada.
- **US-06**: Como **Sysloc Master**, quero listar as Empresas e seu estado, para saber o que estou operando.
- **US-07**: Como **Sysloc Master**, quero admitir um **Admin Empresa** adicional numa Empresa existente, para socorrer o cliente cujo único administrador perdeu o próprio acesso.
- **US-08**: Como **Admin Empresa**, quero criar as pessoas da minha equipe recebendo a Senha provisória de cada uma, para montar o time sem ajuda técnica.
- **US-09**: Como **Admin Empresa**, quero liberar e **retirar** telas e ações de cada pessoa individualmente, para delegar sem entregar tudo.
- **US-10**: Como **Admin Empresa**, quero mudar o perfil de uma pessoa quando o papel dela muda, sem herdar ajustes antigos que ninguém lembra por que existiam.
- **US-11**: Como **Admin Empresa**, quero desativar quem saiu da equipe e ter o acesso cortado na hora, para que a saída seja efetiva.
- **US-12**: Como **Admin Empresa**, quero reativar quem desativei por engano, para corrigir sem ajuda técnica.
- **US-13**: Como pessoa recém-criada, preciso trocar minha Senha provisória antes de qualquer outra coisa, para que a senha que veio por telefone deixe de valer.
- **US-14**: Como **Usuário Empresa**, quero saber ao entrar quais telas e ações alcanço, para que o sistema me mostre apenas o que me cabe.
- **US-15**: Como **Usuário Empresa**, quero que uma permissão concedida ou retirada valha na minha próxima operação, sem ser desconectado nem ver erro, para não ser interrompido no meio do trabalho.
- **US-16**: Como **Usuário Empresa**, quero que a recusa me diga **qual permissão faltou**, para eu pedir ao meu Admin exatamente o que preciso.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — O que uma pessoa alcança é o conjunto padrão do perfil dela, somado ao que lhe foi concedido individualmente e **subtraído do que lhe foi retirado**. Quando concessão e retirada recaem sobre a mesma permissão, **a retirada vence**.
- **RN-02** — Uma ação sensível só vale para quem alcança a área de tela correspondente. A tentativa de liberar uma ação sem a tela que a comporta é **recusada no momento de salvar**, informando a incoerência — nunca aceita e silenciosamente ignorada.
- **RN-03** — Mudança de permissão **não** interrompe quem está trabalhando: a sessão continua válida e a operação seguinte já é decidida pelo conjunto novo, sem erro visível.
- **RN-04** — Suspender uma Empresa ou desativar uma pessoa **encerra o acesso imediatamente**, e não no próximo login: quem estava dentro é recusado na operação seguinte.
- **RN-05** — Reativar uma Empresa ou uma pessoa **não devolve o acesso em curso**: todos entram de novo.
- **RN-06** — **Nada é apagado.** Não existe exclusão de Empresa nem de pessoa; existe suspensão, desativação, e o retorno de ambas.
- **RN-07** — A Senha provisória é exibida **uma única vez** a quem cria a conta, e entregue à pessoa por fora do sistema. Ela não é recuperável depois disso.
- **RN-08** — A Senha provisória **não expira por tempo**. Ela deixa de valer quando é trocada ou quando outra é emitida no lugar dela.
- **RN-09** — Reemitir a Senha provisória **invalida a anterior** no mesmo ato.
- **RN-10** — Enquanto a Senha provisória não for trocada, a pessoa **não alcança nada além da própria troca**. A troca é obrigatória e precede qualquer outra ação.
- **RN-11** — Mudar o perfil de uma pessoa **descarta todos os ajustes individuais dela**. Quando há ajustes a perder, a mudança é **recusada até que a intenção de perdê-los seja declarada**, e a recusa informa **quantos** ajustes seriam descartados.
- **RN-12** — O **Admin Empresa** administra exclusivamente as pessoas da própria Empresa. Nenhuma operação dele alcança pessoa, permissão ou dado de outra Empresa.
- **RN-13** — O **Sysloc Master** administra Empresas e admite administradores para elas. Ele **não ajusta permissões de ninguém** e **não alcança dado de negócio** de Empresa alguma.
- **RN-14** — A recusa por falta de permissão **nomeia a permissão exigida**. Ela é distinta da recusa por falta de sessão, e distinta de "não encontrado".
- **RN-15** — O catálogo de permissões é **fechado**: 10 áreas de tela e 7 ações sensíveis. Não existe permissão fora dele, e o mesmo catálogo governa a decisão do sistema e o que a pessoa vê como disponível.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

**Admissão de uma Empresa nova (Sysloc Master):**

1. O Master registra a Empresa no sistema.
2. O Master cria o primeiro **Admin Empresa** dela, informando nome e e-mail.
3. O sistema responde com a **Senha provisória** dessa pessoa, **exibida uma única vez**.
4. O Master entrega a senha ao cliente por telefone ou mensagem.
5. O Admin entra pela primeira vez e o sistema o conduz obrigatoriamente à troca de senha, sem permitir nenhuma outra ação antes disso.
6. Trocada a senha, o Admin alcança tudo o que o perfil dele comporta na própria Empresa.

**Montagem da equipe (Admin Empresa):**

1. O Admin cria uma pessoa, escolhendo o perfil dela.
2. O sistema responde com a Senha provisória, exibida uma única vez, e o Admin a entrega à pessoa.
3. O Admin ajusta o que aquela pessoa alcança: libera telas e ações que o perfil não daria, e retira as que o perfil daria e ele não quer conceder.
4. A pessoa entra, troca a senha obrigatoriamente, e passa a ver apenas o que lhe cabe.

**Operação do dia a dia (Usuário Empresa):**

1. A pessoa entra e o sistema lhe informa quais telas e ações ela alcança.
2. Ela opera normalmente dentro disso.
3. Se o Admin mudar as permissões dela nesse meio-tempo, a **operação seguinte já reflete a mudança** — sem desconexão e sem mensagem de erro.
4. Se ela tentar algo que não alcança, o sistema recusa **dizendo qual permissão faltou**.

### 7.2 Fluxos Alternativos

- **A Senha provisória se perdeu antes do primeiro acesso** → quem criou a conta reemite; a anterior deixa de valer no mesmo ato, e a nova é exibida uma única vez.
- **O Admin tenta liberar uma ação sem a tela que a comporta** → o sistema recusa e informa qual área de tela precisa ser liberada junto.
- **O Admin muda o perfil de alguém que tem ajustes individuais** → o sistema recusa, informando quantos ajustes seriam descartados; declarada a intenção, a mudança acontece e a pessoa fica com o padrão puro do perfil novo.
- **A Empresa é suspensa com pessoas trabalhando** → todas são recusadas na operação seguinte e não conseguem entrar de novo enquanto durar a suspensão.
- **A Empresa é reativada** → ninguém volta ao que estava fazendo; todos entram de novo.
- **Uma pessoa é desativada durante o expediente** → ela é recusada na operação seguinte.
- **O único Admin de uma Empresa perde o próprio acesso** → o Master admite outro Admin para aquela Empresa, e o socorro não exige que o Master alcance permissão nem dado de ninguém.
- **A pessoa tenta operar antes de trocar a Senha provisória** → o sistema recusa tudo que não seja a própria troca.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO que o Master registrou uma Empresa nova QUANDO ele consulta a lista de Empresas ENTÃO ela aparece com o estado ativo, sem que ninguém tenha intervindo no servidor.
- [ ] **CA-02**: DADO que uma Empresa foi registrada QUANDO o Master cria o primeiro Admin dela ENTÃO o sistema responde com a Senha provisória dessa pessoa **uma única vez**, e nenhuma consulta posterior a devolve.
- [ ] **CA-03**: DADO um Admin criado e ainda sem trocar a senha QUANDO o Master reemite a Senha provisória dele ENTÃO a senha anterior deixa de servir para entrar e a nova serve.
- [ ] **CA-04**: DADO que pessoas da Empresa estão operando QUANDO o Master suspende essa Empresa ENTÃO a operação seguinte de cada uma é recusada, e nenhuma consegue entrar de novo.
- [ ] **CA-05**: DADO uma Empresa suspensa com pessoas que estavam operando QUANDO o Master a reativa ENTÃO ninguém retoma o que estava fazendo, e todos conseguem entrar de novo.
- [ ] **CA-06**: DADO que existem Empresas ativas e suspensas QUANDO o Master consulta a lista ENTÃO ele vê todas com seu estado atual, e nenhum dado de negócio de nenhuma delas.
- [ ] **CA-07**: DADO uma Empresa cujo único Admin está desativado QUANDO o Master admite outro Admin para ela ENTÃO essa pessoa entra e administra a Empresa normalmente.
- [ ] **CA-08**: DADO um Admin autenticado QUANDO ele cria uma pessoa da equipe ENTÃO o sistema responde com a Senha provisória dela uma única vez, e a pessoa consegue entrar com ela.
- [ ] **CA-09**: DADO uma pessoa cujo perfil não concede determinada ação QUANDO o Admin concede essa ação a ela individualmente ENTÃO ela passa a executá-la, sem alcançar mais nada além disso.
- [ ] **CA-10**: DADO uma pessoa cujo perfil concede determinada ação QUANDO o Admin retira essa ação dela individualmente ENTÃO ela deixa de executá-la, mesmo que o perfil continue a conceder.
- [ ] **CA-11**: DADO uma ação sensível que pertence a uma área de tela QUANDO o Admin tenta concedê-la a quem não alcança essa área ENTÃO o sistema recusa e informa qual área precisa ser liberada junto.
- [ ] **CA-12**: DADO uma pessoa com ajustes individuais QUANDO o Admin muda o perfil dela sem declarar a intenção de descartá-los ENTÃO o sistema recusa e informa quantos ajustes seriam descartados.
- [ ] **CA-13**: DADO a mesma situação QUANDO o Admin declara a intenção de descartá-los ENTÃO o perfil muda e a pessoa passa a ter exatamente o padrão do perfil novo, sem nenhum ajuste remanescente.
- [ ] **CA-14**: DADO uma pessoa operando QUANDO o Admin a desativa ENTÃO a operação seguinte dela é recusada, e ela não consegue entrar de novo.
- [ ] **CA-15**: DADO uma pessoa desativada QUANDO o Admin a reativa ENTÃO ela consegue entrar de novo, com as permissões que tinha.
- [ ] **CA-16**: DADO um Admin da Empresa A QUANDO ele tenta administrar uma pessoa da Empresa B ENTÃO o sistema recusa, e nada da Empresa B é alterado nem revelado.
- [ ] **CA-17**: DADO uma pessoa que ainda não trocou a Senha provisória QUANDO ela tenta qualquer operação que não seja a própria troca ENTÃO o sistema recusa.
- [ ] **CA-18**: DADO essa mesma pessoa QUANDO ela troca a senha ENTÃO ela passa a alcançar tudo o que suas permissões comportam, e a Senha provisória deixa de servir.
- [ ] **CA-19**: DADO uma pessoa que acabou de entrar QUANDO ela consulta sua sessão ENTÃO o sistema informa quais áreas de tela e quais ações sensíveis ela alcança.
- [ ] **CA-20**: DADO uma pessoa operando QUANDO o Admin retira uma permissão dela ENTÃO a **operação seguinte** já é recusada, sem que ela seja desconectada e sem mensagem de erro em qualquer outra operação que ela ainda alcance.
- [ ] **CA-21**: DADO uma pessoa operando QUANDO o Admin concede uma permissão nova a ela ENTÃO a operação seguinte já é aceita, sem que ela precise entrar de novo.
- [ ] **CA-22**: DADO uma pessoa sem determinada permissão QUANDO ela tenta a operação correspondente ENTÃO o sistema recusa **nomeando a permissão exigida**, de forma distinta da recusa por falta de sessão.
- [ ] **CA-23**: DADO o catálogo fechado de 10 áreas de tela e 7 ações sensíveis QUANDO qualquer uma delas é verificada ENTÃO existe prova de que ela concede a quem a tem e recusa a quem não a tem.

---

## 9. Restrições & Considerações

**Restrições de produto (travadas, não negociáveis):**

- O catálogo é **fechado em 10 áreas de tela e 7 ações sensíveis**, definido por decisão anterior — esta feature o implementa, não o redefine.
- Três perfis, **com permissões ajustáveis por pessoa** — a segunda metade é tão obrigatória quanto a primeira.
- Revogação bloqueia **na hora**, com o acesso em curso encerrado e **nada apagado**.
- O primeiro administrador recebe **Senha provisória com troca obrigatória**, e as demais pessoas da Empresa são criadas **pelo administrador dela**, com a mesma mecânica.
- O **Sysloc Master não alcança dado de negócio por nenhum caminho** — garantia já provada na fatia anterior, que esta não pode enfraquecer.

**Restrições de entrega:**

- **A superfície do produto congela** na entrega do backend: as operações criadas aqui são as que a aplicação do cliente vai consumir. Acrescentar depois é possível; renomear e remover, não.
- **A Senha provisória é entregue por fora do sistema** — não há canal de mensagens até uma fase posterior, e a dependência de configuração de domínio que ele exige está fora do controle desta entrega.
- **Nada do que a fatia anterior entregou pode regredir.** Isolamento entre Empresas, entrada por sessão, bloqueio por tentativas, segundo fator e a recusa de entrada que não distingue a causa foram provados em ambiente real e continuam valendo.
- **Aqui só se produz backend** — a religação da aplicação do cliente acontece fora deste repositório, a partir do material de entrega.

**Dependências herdadas** `[DELEGAR_TECH_SPEC]`:

- Cinco correções de fundação registradas pela fatia anterior sob os identificadores **D7**, **D21**, **D5**, **P-T6-1** e **P-T6-2** têm sua condição de disparo satisfeita por esta entrega — duas delas são **pré-requisito** para criar pessoas e trocar senha com segurança, e as demais compartilham o momento barato de correção. A natureza técnica de cada uma, o plano de fechamento e a prova exigida pertencem à etapa seguinte.
- A metade do **P-T6-2** referente à retenção do histórico de tentativas de entrada fica **fora** desta entrega, endereçada à operação.

**Considerações de segurança e privacidade:**

- Duas das correções herdadas têm eixo de segurança direto: uma delas, se malfeita, permitiria alguém elevar o próprio poder; a outra permitiria alcançar dado de outra Empresa. `[DELEGAR_TECH_SPEC]`
- A regra de que **a retirada vence a concessão** (RN-01) é o que impede uma permissão retirada de continuar valendo por outro caminho; ela precisa de prova dedicada.
- Permanece válido o limite já aceito conscientemente pelo projeto: a confidencialidade entre Empresas é garantida no âmbito da aplicação; quem tem acesso administrativo ao servidor alcança os dados de qualquer uma. É risco declarado, não defeito.

**Considerações de experiência:**

- A matriz pode ser complexa demais para um administrador que hoje não administra permissão nenhuma. O perfil entrega o conjunto pronto e o ajuste é opcional: quem não mexer tem um produto tão simples quanto o de perfil puro.
- A recusa que nomeia a permissão faltante (RN-14) é o que torna a matriz diagnosticável quando alguém mexe.

---

## 10. Métricas de Sucesso

- **Latência da revogação** — uma permissão retirada deixa de valer na **operação seguinte**: zero operações atendidas com um conjunto de permissões desatualizado.
- **Admissão sem intervenção manual** — uma Empresa nova vai do zero ao primeiro usuário operando **sem ninguém tocar no servidor**: zero comandos diretos no banco de dados, zero edições de arquivo. Hoje esse número é impossível de medir, porque a operação não existe.
- **Cobertura do catálogo** — as 17 permissões (10 áreas de tela e 7 ações sensíveis) têm prova nos **dois sentidos**: concedem a quem as tem e recusam a quem não as tem. Nenhuma permissão sem verificação.
- **Ausência de escapatória** — nenhuma operação de negócio alcançável sem passar pela decisão de acesso, verificado sobre a superfície publicada e não por inspeção manual.

---

## 11. Roadmap / Fases

- **Fase 1 — O que cada pessoa pode**: catálogo fechado, padrão por perfil, ajuste individual em ambos os sentidos, a pessoa conhecendo o que alcança ao entrar, a decisão de acesso valendo em cada operação, a recusa que nomeia a permissão faltante, e a mudança valendo na operação seguinte. *(US-09, US-10, US-14, US-15, US-16)*
- **Fase 2 — Quem entra e quem sai**: ciclo de vida da Empresa pelo Master e das pessoas pelo Admin, com o acesso cortado imediatamente na suspensão e na desativação, e o caminho de socorro do administrador travado. *(US-01, US-04, US-05, US-06, US-07, US-11, US-12)*
- **Fase 3 — A primeira senha**: onboarding nos dois caminhos, Senha provisória exibida uma vez, reemissão, e a troca obrigatória antes de qualquer outra ação. *(US-02, US-03, US-08, US-13)*

> A ordem é de dependência, não de valor: a Fase 1 define o vocabulário que as outras duas atribuem às pessoas.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Master admite Empresa nova | CA-01 |
| US-02 | Master cria o primeiro Admin, com Senha provisória exibida uma vez | CA-02 |
| US-03 | Master reemite a Senha provisória | CA-03 |
| US-04 | Master suspende Empresa, com acesso cortado na hora | CA-04 |
| US-05 | Master reativa Empresa | CA-05 |
| US-06 | Master lista Empresas e seus estados | CA-06 |
| US-07 | Master admite Admin adicional (socorro) | CA-07 |
| US-08 | Admin cria pessoa da equipe | CA-08, CA-16 |
| US-09 | Admin concede e retira telas e ações por pessoa | CA-09, CA-10, CA-11, CA-16 |
| US-10 | Admin muda o perfil de uma pessoa sem herdar ajustes antigos | CA-12, CA-13, CA-16 |
| US-11 | Admin desativa pessoa, com acesso cortado na hora | CA-14, CA-16 |
| US-12 | Admin reativa pessoa | CA-15, CA-16 |
| US-13 | Pessoa troca a Senha provisória antes de qualquer outra ação | CA-17, CA-18 |
| US-14 | Pessoa conhece ao entrar o que alcança | CA-19, CA-23 |
| US-15 | Mudança de permissão vale na operação seguinte, sem interromper | CA-20, CA-21 |
| US-16 | Recusa nomeia a permissão faltante | CA-22 |

> **CA-16** aparece em cinco linhas de propósito: ele é a fronteira dentro da qual **toda** administração de pessoas acontece, e não um requisito de uma história só. Repeti-lo é o que garante que nenhuma das cinco seja implementada sem ele.

---

## 13. Checklist Final

- [x] PRD descreve apenas O QUE / POR QUÊ — nenhum endereço de operação, estrutura de dados, biblioteca ou detalhe de implementação
- [x] Escopo fechado — incluído e excluído definidos, com o que **não** se reabre da fatia anterior explicitado
- [x] User Stories definidas e numeradas (US-01 a US-16), sem lacuna na sequência
- [x] Critérios de aceite claros e comportamentais (CA-01 a CA-23), todos em DADO/QUANDO/ENTÃO
- [x] Tabela de rastreabilidade preenchida — nenhuma US sem CA, nenhum CA órfão (CA-16 documentado como transversal)
- [x] Terminologia conforme o glossário canônico do projeto — **Senha provisória**, não "senha temporária"
- [x] Nenhuma informação inventada: as quatro dúvidas em aberto do discovery foram fechadas com o usuário, duas delas por delegação explícita e com a razão registrada
- [x] Pronto para criar o TECH_SPEC (COMO)
