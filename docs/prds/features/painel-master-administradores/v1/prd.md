# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Painel Master — ciclo de vida de Empresas e Admin Empresa
- **Responsável/Autor**: sysloc
- **Data**: 2026-09-01
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Discovery: `docs/specs/features/painel-master-administradores/v1/pre-refinement.md`
  - Glossário de domínio: `docs/specs/domain-glossary.md`
  - Feature adjacente: `autorizacao-e-ciclo-de-acesso (v1)` — entregou as operações atuais do Painel Master e **adiou esta feature por nome**

> **Nota de vocabulário.** Este PRD usa os termos canônicos do glossário: **Empresa** (nunca "tenant"/"inquilino"), **Sysloc Master**, **Admin Empresa** (nunca "administrador" solto), **Usuário Empresa**, **Senha provisória**, **Vínculo de acesso**.
>
> ⚠️ **Um termo é NOVO e precisa de canonização.** O glossário lista *"exclusão"* e *"excluir"* como aliases **a evitar** de **Retirada de circulação** — que é o oposto do que esta feature faz (*"sem apagá-lo… pode voltar à circulação"*). A operação desta feature **apaga**, e é irreversível. Chamamos de **Exclusão definitiva**, e ela é conceito distinto, sem parentesco com a retirada de circulação. O glossário sustenta a distinção por caminho independente: ele já resolveu que *"cadastro é entidade de negócio; quem entra no sistema é pessoa"* — logo a retirada de circulação, sendo operação sobre **cadastro**, nunca alcançou pessoa nem **Empresa**. Registrado para canonização na etapa de challenge.

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** O Painel Master é uma superfície de **mão única**: o Sysloc Master cria uma Empresa e o Admin Empresa dela, e depois **nunca mais os enxerga nem os corrige**. Ele não consegue listar quem administra cada Empresa, não consegue corrigir um dado digitado errado, não consegue retirar o acesso de uma pessoa, e não consegue remover um cadastro criado por engano.

- **Como funciona atualmente?** O Sysloc Master dispõe de cinco operações: criar Empresa, listar Empresas, admitir o Admin Empresa, suspender e reativar a Empresa, e reemitir a Senha provisória de um Admin Empresa. A reemissão exige o **identificador** da pessoa, e **não existe nenhuma forma de descobri-lo pelo sistema** — ele aparece uma única vez, na resposta da admissão. A documentação de entrega do painel instrui, em três lugares distintos, a *"guardar o identificador da admissão"*, sob pena de a reemissão ficar sem alvo.

- **Como a dor aparece no dia a dia?**
  - O Sysloc Master admite o Admin Empresa da "Imobiliária X" e **perde a tela**. Meses depois a pessoa esquece a senha, e ele precisa ter anotado um identificador à mão para conseguir reemiti-la.
  - Ele digita o endereço de e-mail errado na admissão: a pessoa não entra, o endereço fica ocupado permanentemente, e **não há como corrigir nem como remover**.
  - Ele cria "Teste 1", "Teste 2" e "Teste 3" para conferir o cadastro: as três ficam na listagem **para sempre**.
  - Um Admin Empresa deixa a imobiliária: o Sysloc Master **não tem como retirar o acesso dele**. O único instrumento disponível é suspender a Empresa inteira, que derruba todo mundo.

- **Por que isso precisa ser resolvido agora?** É o momento previsto. A feature `autorizacao-e-ciclo-de-acesso` adiou esta feature **nominalmente**, registrando-a como *"o painel master, com persona e domínio próprios"*, a ser especificada depois da fase de publicação — que fechou em 2026-08-27. Além disso, o Painel Master é a **única aplicação cuja entrega de backend está completa**, e a interface dele será construída contra esta superfície: entregar agora evita que ela nasça sem as operações.

- **Quem sofre o impacto?** O **Sysloc Master**. Ele perde tempo, guarda identificadores fora do sistema e convive com uma listagem que só cresce.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Dar ao Sysloc Master o **ciclo de vida completo** das duas entidades que ele governa — a Empresa e o Admin Empresa —, cobrindo enxergar, corrigir, retirar e devolver acesso, e remover em definitivo o que foi criado por engano.

- **Qual mudança de comportamento esta feature deve gerar?** O Sysloc Master deixa de guardar identificadores fora do sistema, e passa a operar cada Admin Empresa **a partir da lista em que ele aparece** — sem depender de ter anotado nada em nenhum momento anterior.

- **Qual o resultado final esperado do ponto de vista do usuário?** Ao abrir uma Empresa, o Sysloc Master vê quem a administra e, em cada linha, dispõe das ações que pode executar sobre aquela pessoa — com as impossíveis desabilitadas **e explicadas**.

---

## 4. Escopo

### 4.1 O que está incluído

- [ ] Listar os **Admin Empresa** de uma Empresa, com identificação, endereço de e-mail, estado de acesso e data de admissão
- [ ] Reemitir a **Senha provisória** de um Admin Empresa **a partir da própria listagem**, sem que o Sysloc Master precise informar o identificador
- [ ] **Suspender** um Admin Empresa, encerrando o acesso dele imediatamente
- [ ] **Reativar** um Admin Empresa suspenso, devolvendo a ele a capacidade de entrar
- [ ] **Editar** os dados cadastrais de uma Empresa
- [ ] **Editar** os dados cadastrais de um Admin Empresa, inclusive o endereço de e-mail
- [ ] **Excluir em definitivo** uma Empresa, quando ela não tiver nenhum registro no sistema
- [ ] **Excluir em definitivo** um Admin Empresa, quando ele não tiver nenhum registro no sistema
- [ ] Informar, **antes da tentativa**, se a exclusão definitiva é possível; e, quando não for, informar **a classe do que a impede** e **qual alternativa existe**

### 4.2 O que está explicitamente fora do escopo

- [ ] **Qualquer trabalho de interface.** A construção das telas, a movimentação do botão de reemissão para a linha, o estado desabilitado do botão de exclusão e a redação exibida ao Sysloc Master pertencem à aplicação do Painel Master, que **não é construída neste repositório**. Esta feature entrega **o que a tela precisa** para fazê-lo
- [ ] **Listar Usuário Empresa.** O Sysloc Master vê apenas os Admin Empresa; a equipe interna da imobiliária permanece fora da vista dele
- [ ] **Histórico de suspensões e trilha de auditoria consultável** pelo Sysloc Master — feature própria, com valor próprio, já adiada pela feature anterior e que segue adiada
- [ ] **Ajustar o que um Admin Empresa alcança.** O Sysloc Master admite a pessoa e para aí; o Efetivo de permissão dela é administrado dentro da Empresa
- [ ] **Um estado de suspensão que a Empresa não possa desfazer** — avaliado e adiado (ver RN-14)
- [ ] **Detalhar o que impede a exclusão** nomeando entidades ou quantidades — a recusa informa a **classe**, nunca o volume
- [ ] **Qualquer alteração no que a aplicação da imobiliária oferece** — nada nesta feature a alcança

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Sysloc Master** — persona **única** desta feature.
- **Qual é seu objetivo ao usar essa feature?** Administrar o cadastro das Empresas atendidas e de quem as administra, sem depender de anotações fora do sistema e sem acumular registros que nunca poderão sair.
- **Quais dores essa feature resolve pra ele?** A perda do identificador da pessoa; o erro de digitação que não tem conserto; o acesso que não pode ser retirado sem derrubar a Empresa inteira; e a listagem que só cresce.

> **O Admin Empresa é ALVO das operações, nunca ator.** Nenhuma operação desta feature é executável por ele. A única superfície em que ele participa está declarada na RN-14.

### 5.1 Histórias de Usuário

- **US-01**: Como Sysloc Master, quero ver quem administra cada Empresa para saber sobre quem posso agir sem consultar anotações externas.
- **US-02**: Como Sysloc Master, quero reemitir a Senha provisória direto da linha da pessoa para não precisar ter guardado o identificador dela.
- **US-03**: Como Sysloc Master, quero suspender um Admin Empresa para retirar o acesso de quem não deve mais entrar, sem derrubar a Empresa inteira.
- **US-04**: Como Sysloc Master, quero reativar um Admin Empresa suspenso para devolver o acesso quando a suspensão deixar de fazer sentido.
- **US-05**: Como Sysloc Master, quero corrigir os dados de uma Empresa para consertar o que foi digitado errado no cadastro.
- **US-06**: Como Sysloc Master, quero corrigir os dados de um Admin Empresa, inclusive o e-mail, para que uma pessoa cadastrada com endereço errado consiga entrar.
- **US-07**: Como Sysloc Master, quero saber de antemão se posso excluir em definitivo um registro para não descobrir a impossibilidade só ao tentar.
- **US-08**: Como Sysloc Master, quero excluir em definitivo um Admin Empresa criado por engano para liberar o endereço de e-mail que ele ocupa.
- **US-09**: Como Sysloc Master, quero excluir em definitivo uma Empresa criada por engano para que a listagem reflita só as Empresas reais.
- **US-10**: Como Sysloc Master, quero entender por que uma exclusão foi recusada e o que posso fazer em vez dela, para não interpretar a recusa como defeito do sistema.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — A listagem de administradores de uma Empresa devolve **apenas Admin Empresa**. Usuário Empresa nunca aparece nela.
- **RN-02** — A listagem devolve identificação, estado e data de admissão, e **nenhum dado de negócio** da Empresa.
- **RN-03** — Suspender um Admin Empresa **encerra imediatamente** os acessos abertos dele, e o sistema informa **quantos** foram encerrados.
- **RN-04** — Reativar devolve a **capacidade de entrar**, e **não** os acessos que a suspensão encerrou: a pessoa precisa entrar de novo.
- **RN-05** — Suspender é **idempotente**: repetir sobre quem já está suspenso não é erro, e informa que nenhum acesso foi encerrado.
- **RN-06** — Suspender, reativar, editar, excluir e reemitir Senha provisória alcançam **somente Admin Empresa**. Sobre qualquer outro perfil, a operação é recusada nomeando o perfil exigido e o perfil de quem foi apontado.
- **RN-07** — A edição alcança **dados cadastrais**, nunca o **estado** de acesso. Uma Empresa suspensa continua suspensa depois de editada; um Admin Empresa suspenso, idem.
- **RN-08** — Corrigir o endereço de e-mail de um Admin Empresa **não invalida a credencial dele**: quem já recebeu a Senha provisória continua entrando com ela.
- **RN-09** — Documento da Empresa e endereço de e-mail da pessoa são **únicos**. A edição que colidir com um valor já em uso é recusada nomeando o campo, e **nada é gravado**.
- **RN-10** — A **Exclusão definitiva** de uma Empresa só é possível quando ela **não tiver nenhum registro no sistema**.
- **RN-11** — A **Exclusão definitiva** de um Admin Empresa só é possível enquanto ele **nunca tiver tentado entrar** e não tiver nenhum registro associado ao nome dele.
- **RN-12** — Excluir uma Empresa **remove junto os Admin Empresa dela**, na mesma operação. Cada um permanece sujeito ao **seu próprio** critério da RN-11: se um só deles não for elegível, **a operação inteira é recusada** e nada é removido.
- **RN-13** — A resposta sobre **se é possível excluir** e a **exclusão em si** obedecem ao **mesmo critério**, apurado no instante do ato. Não existe uma segunda verificação, escrita à parte, que possa divergir da primeira. `[DELEGAR_TECH_SPEC]` — o mecanismo que garante a inseparabilidade.
- **RN-14** — Suspender pelo Painel Master e retirar o acesso dentro da Empresa são **o mesmo fato**. Consequência aceita: um Admin Empresa colega **pode reativar**, pela aplicação da imobiliária, quem o Sysloc Master suspendeu. Quando for preciso conter de verdade, o instrumento é **suspender a Empresa**.
- **RN-15** — A recusa da exclusão informa **a classe do que impede** e **qual alternativa existe** — nunca o nome das entidades envolvidas nem a quantidade delas.
- **RN-16** — Uma operação de exclusão **nunca destrói registro de auditoria**: a existência de trilha sobre uma pessoa é, ela própria, um dos impedimentos da RN-11.

---

## 7. Fluxo Comportamental

### 7.1 Fluxo Principal

1. O Sysloc Master abre uma Empresa e pede a lista de quem a administra.
2. O sistema apresenta os Admin Empresa daquela Empresa, cada um com nome, endereço de e-mail, estado de acesso, data de admissão e **se pode ser excluído em definitivo**.
3. O Sysloc Master escolhe uma pessoa e uma ação: reemitir a Senha provisória, suspender, reativar, corrigir os dados, ou excluir em definitivo.
4. O sistema executa a ação e confirma o resultado — informando, na suspensão, **quantos acessos foram encerrados**.

### 7.2 Fluxos Alternativos

- **A pessoa apontada não é um Admin Empresa** → o sistema recusa, nomeando o perfil exigido e o perfil de quem foi apontado. Nada é alterado.
- **A exclusão definitiva não é possível** → a ação vem **indisponível já na lista**, e o sistema informa a classe do impedimento e diz que a alternativa é **suspender**.
- **A situação muda entre a consulta e a ação** — o registro estava elegível quando a lista foi montada, e deixou de estar quando o Sysloc Master clicou → o sistema **recusa**, informando a classe do impedimento. Nada é removido, e a informação exibida é a do instante do ato.
- **A correção colide com um valor já em uso** (documento ou e-mail) → o sistema recusa nomeando o campo, e **nada é gravado**.
- **A Empresa a excluir tem mais de um Admin Empresa, e um deles não é elegível** → a operação inteira é recusada, e nem a Empresa nem os demais são removidos.
- **Suspender alguém já suspenso** → o sistema confirma normalmente, informando que nenhum acesso foi encerrado.

---

## 8. Critérios de Aceite

- [ ] **CA-01**: DADO uma Empresa com dois Admin Empresa, um Usuário Empresa, e um Admin Empresa de **outra** Empresa QUANDO o Sysloc Master pede a lista de administradores dela ENTÃO o sistema apresenta **exatamente os dois** Admin Empresa daquela Empresa.
- [ ] **CA-02**: DADO uma lista de administradores QUANDO o Sysloc Master a consulta ENTÃO cada linha traz nome, endereço de e-mail, estado de acesso, data de admissão e a possibilidade de exclusão definitiva — e **nenhum** dado de negócio da Empresa.
- [ ] **CA-03**: DADO um Admin Empresa que aparece na lista QUANDO o Sysloc Master pede a reemissão da Senha provisória dele pela própria linha ENTÃO o sistema emite a nova senha **sem que ele tenha informado o identificador da pessoa**.
- [ ] **CA-04**: DADO um Admin Empresa com dois acessos abertos QUANDO o Sysloc Master o suspende ENTÃO o sistema encerra os dois no ato, informa **2** como quantidade encerrada, e o acesso seguinte dessa pessoa é recusado.
- [ ] **CA-05**: DADO um Admin Empresa recém-suspenso e uma colega dele **ativa** na mesma Empresa QUANDO a suspensão acontece ENTÃO a colega **continua operando normalmente** no mesmo instante.
- [ ] **CA-06**: DADO um Admin Empresa já suspenso QUANDO o Sysloc Master o suspende de novo ENTÃO o sistema confirma sem erro e informa **0** como quantidade encerrada.
- [ ] **CA-07**: DADO um Admin Empresa suspenso QUANDO o Sysloc Master o reativa ENTÃO ele volta a conseguir entrar, e os acessos encerrados pela suspensão **não** são restaurados.
- [ ] **CA-08**: DADO um Usuário Empresa QUANDO o Sysloc Master tenta suspendê-lo, reativá-lo, editá-lo ou excluí-lo ENTÃO o sistema recusa nomeando o perfil exigido e o perfil apontado, e **a pessoa permanece inalterada**.
- [ ] **CA-09**: DADO uma Empresa suspensa QUANDO o Sysloc Master corrige o nome dela ENTÃO o nome muda e ela **continua suspensa**.
- [ ] **CA-10**: DADO um Admin Empresa cadastrado com o e-mail errado, que nunca conseguiu entrar QUANDO o Sysloc Master corrige o endereço ENTÃO ele passa a entrar **com a Senha provisória que já havia recebido**.
- [ ] **CA-11**: DADO duas Empresas cadastradas QUANDO o Sysloc Master edita uma delas atribuindo o documento da outra ENTÃO o sistema recusa nomeando o campo, e **nenhuma das duas** é alterada.
- [ ] **CA-12**: DADO uma Empresa **com um contrato registrado** QUANDO o Sysloc Master consulta a listagem ENTÃO a exclusão definitiva aparece **indisponível**, com a classe do impedimento e a alternativa informadas.
- [ ] **CA-13**: DADO essa mesma Empresa QUANDO o Sysloc Master tenta excluí-la mesmo assim ENTÃO o sistema recusa informando a classe do impedimento, e a Empresa **continua existindo e ativa**.
- [ ] **CA-14**: DADO essa mesma recusa QUANDO o Sysloc Master executa a alternativa que ela anuncia ENTÃO a suspensão da Empresa é aceita.
- [ ] **CA-15**: DADO uma Empresa sem nenhum registro, com um Admin Empresa que nunca tentou entrar QUANDO o Sysloc Master a exclui em definitivo ENTÃO a Empresa e a pessoa **deixam de existir**, e a Empresa não aparece mais na listagem.
- [ ] **CA-16**: DADO uma Empresa sem registros, com **dois** Admin Empresa, um dos quais **já tentou entrar** QUANDO o Sysloc Master tenta excluí-la ENTÃO o sistema recusa, e **nem a Empresa nem nenhum dos dois** é removido.
- [ ] **CA-17**: DADO um Admin Empresa que **já tentou entrar** QUANDO o Sysloc Master tenta excluí-lo em definitivo ENTÃO o sistema recusa informando essa classe de impedimento, e a pessoa permanece.
- [ ] **CA-18**: DADO um Admin Empresa que **nunca tentou entrar** QUANDO o Sysloc Master o exclui em definitivo ENTÃO ele deixa de existir e some da listagem.
- [ ] **CA-19**: DADO uma Empresa listada como elegível à exclusão QUANDO um registro passa a existir nela **entre a consulta e a ação**, e o Sysloc Master confirma a exclusão ENTÃO o sistema recusa informando a classe do impedimento, e **nada é removido**.
- [ ] **CA-20**: DADO qualquer recusa de exclusão QUANDO o Sysloc Master a recebe ENTÃO ela informa a classe do impedimento e a alternativa, e **não** nomeia entidades nem informa quantidades.

---

## 9. Restrições & Considerações

- **Decisão de escopo do produto — persona única.** Nenhuma operação desta feature é alcançável por Admin Empresa ou Usuário Empresa. A garantia registrada de que o Sysloc Master não alcança dado de negócio de nenhuma Empresa **permanece integralmente válida** — e é ela que motiva a RN-02 e a RN-15.
- **Decisão registrada em contrário, a ser emendada.** Existe decisão arquitetural aceita afirmando que entidade referenciável **nunca** é removida em definitivo. Ela foi escrita para os cadastros do domínio de locação, e o alcance dela precisou ser declarado explicitamente para que esta feature seja conforme, e não violação. A declaração e a emenda são **entrega obrigatória** desta feature. `[DELEGAR_TECH_SPEC]`
- **Registro de estado do produto desatualizado.** As instruções gerais do repositório afirmam, sem qualificar o público, que nenhuma operação nova seria publicada. A qualificação existe registrada em outro documento — o congelamento alcança a aplicação da imobiliária, **não** o Painel Master. Emendar esse registro é **entrega obrigatória**, sob pena de a implementação parar por conflito aparente. `[DELEGAR_TECH_SPEC]`
- **A informação da RN-15 é de classe, nunca de volume.** Restrição derivada da garantia de isolamento: informar quantidades daria ao Sysloc Master um retrato do tamanho da operação da Empresa.
- **A janela de exclusão é curta por natureza.** Um único registro, ou uma única tentativa de entrada, a fecha. O valor da feature está concentrado no engano recente, não em limpeza retroativa de base — e isso é aceito, não é limitação a contornar.
- **Efeito favorável em privacidade.** A Exclusão definitiva é o **único** mecanismo de eliminação de dado pessoal que o produto passa a ter; a decisão registrada sobre retirada de circulação já anota a retenção indefinida como dívida em aberto.
- **Termo novo pendente de canonização**: **Exclusão definitiva** (ver a nota de vocabulário da seção 1).

---

## 10. Métricas de Sucesso

> As três primeiras são observáveis pelo próprio uso; a quarta é qualitativa e depende de relato.

- **Reemissão sem identificador externo** — proporção de reemissões de Senha provisória originadas da listagem. **Alvo: 100%.** É a métrica que declara resolvida a dor central; qualquer reemissão que ainda exija um identificador anotado à mão indica que a listagem não cobriu o caso.
- **Higiene da listagem de Empresas** — número de Empresas de teste ou criadas por engano que permanecem na listagem. **Alvo: zero** ao fim de cada sessão de trabalho do Sysloc Master.
- **Recusas compreendidas** — proporção de recusas de exclusão que informam classe **e** alternativa. **Alvo: 100%.** Recusa sem uma das duas é defeito, não caso de borda.
- **Correção sem recriação** — o Sysloc Master deixa de precisar remover e recriar um cadastro para corrigir um dado. **Alvo: nenhuma ocorrência** de remoção seguida de recriação equivalente.

---

## 11. Roadmap / Fases

- **Fase 1 — Enxergar**: a listagem dos Admin Empresa de uma Empresa (US-01, US-02). É a fase que sozinha já resolve a dor central: entrega o identificador que hoje se anota em papel e habilita a reemissão pela linha, sem mudar nenhuma operação existente.
- **Fase 2 — Corrigir e controlar acesso**: suspensão, reativação e edição das duas entidades (US-03 a US-06). Depende da Fase 1 apenas para ter onde as ações vivem.
- **Fase 3 — Remover em definitivo**: a Exclusão definitiva das duas entidades, a informação prévia de elegibilidade e a recusa explicada (US-07 a US-10). É a fase que carrega a decisão arquitetural e as duas emendas de registro, e a única que pode ser removida do escopo sem inviabilizar as anteriores.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Ver quem administra cada Empresa | CA-01, CA-02 |
| US-02 | Reemitir Senha provisória pela linha | CA-03 |
| US-03 | Suspender um Admin Empresa | CA-04, CA-05, CA-06, CA-08 |
| US-04 | Reativar um Admin Empresa suspenso | CA-07, CA-08 |
| US-05 | Corrigir dados da Empresa | CA-09, CA-11 |
| US-06 | Corrigir dados do Admin Empresa | CA-10, CA-08 |
| US-07 | Saber de antemão se pode excluir | CA-12, CA-19 |
| US-08 | Excluir em definitivo um Admin Empresa | CA-17, CA-18, CA-08 |
| US-09 | Excluir em definitivo uma Empresa | CA-13, CA-15, CA-16 |
| US-10 | Entender a recusa e a alternativa | CA-14, CA-20 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-10)
- [x] Critérios de aceite claros (CA-01 a CA-20, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida, sem US órfã e sem CA órfão
- [x] Pronto para criar o TECH_SPEC (COMO)
