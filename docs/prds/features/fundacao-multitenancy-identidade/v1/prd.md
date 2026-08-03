# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados

- **Nome da Feature/Projeto**: `fundacao-multitenancy-identidade` — fatia 1 da Fase 1 do programa `backend-nativo-sysloc`
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-01
- **Versão**: v1
- **Status**: Aprovado
- **Relacionados**:
  - `docs/specs/features/fundacao-multitenancy-identidade/v1/pre-refinement.md` — discovery que originou este PRD (recomendação: SDD)
  - `docs/adr/0008-isolamento-multi-tenant-garantido-pelo-banco.md` — **ADR aceita e vinculante para esta fatia**
  - `docs/adr/0006-ambiente-de-verificacao-separado-do-que-atende-a-operacao.md` — ADR ativa consumida pelas provas de isolamento
  - `docs/adr/0007-forma-canonica-do-contrato-da-api.md` — ADR ativa que rege a forma da resposta de erro
  - `.claude/plans/plano-saas-decisoes.md` — decisões 2, 8, 11, 13, 14, 15, 16, 38, 39
  - `docs/plano-backend-novo/plano-execucao.md` § "F1 — Fundação SaaS: multi-tenancy e identidade"
  - `docs/specs/features/fundacao-stack-nativa/v1/` — Fase 0, concluída e provada; pré-requisito desta fatia
  - _fatia seguinte (fora deste PRD): `autorizacao-e-ciclo-de-acesso` — autorização e ciclo de vida do acesso_

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**
  O sistema em operação **não tem o conceito de empresa** e **não sabe qual pessoa está agindo**. Toda escrita chega com uma única credencial de serviço, compartilhada, e não existe modelo de perfis nem qualquer limite de alcance de dado por pessoa. Em consequência, atender uma segunda imobiliária significaria expor a ela os dados da primeira.

- **Como funciona atualmente?**
  A proteção existente vive no cliente: a área de usuários se defende reconfirmando a senha e guardando-a no próprio navegador. Recusa de acesso vinda do servidor acontece em um único caso, e é convertida em rótulo visual. Não há registro de quem entrou, quando, ou de tentativas malsucedidas.

- **Por que isso precisa ser resolvido agora?**
  Porque é fundação: toda informação de negócio das fatias seguintes — imóveis, contratos, cobranças, boletos — nasce dentro desta garantia. Introduzir isolamento depois que essas informações existirem custa ordens de grandeza mais, e é exatamente o retrofit que o projeto proíbe. Enquanto esta fatia não existir, nenhuma outra pode começar.

- **Quem sofre o impacto do problema?**
  O operador do SaaS, que não consegue vender para o segundo cliente; o administrador da imobiliária, que não consegue delegar trabalho sem entregar acesso a tudo; e o dono do dado, que hoje não tem nenhuma garantia de que sua informação não alcança um concorrente.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**
  Que uma empresa jamais alcance a informação de outra, **mesmo que a camada de aplicação esteja desligada ou tenha defeito**, e que toda ação passe a ter um autor identificado por sessão própria.

- **Qual mudança de comportamento esta feature deve gerar?**
  A confidencialidade entre empresas deixa de ser uma convenção que cada trecho de código precisa lembrar de respeitar e passa a ser uma propriedade estrutural do sistema — quem esquecer de aplicá-la obtém resultado vazio, nunca dado alheio. Em paralelo, a identidade compartilhada dá lugar à identidade pessoal.

- **Qual o resultado final esperado do ponto de vista do usuário?**
  Ao fim desta fatia é possível **entrar no sistema com identificação própria**, e o isolamento entre empresas está **provado**, não afirmado. O que cada perfil pode fazer depois de entrar é a fatia seguinte; aqui os perfis existem apenas como rótulo de identidade.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] Cadastro de **empresa**, **pessoa usuária** e do vínculo de acesso de cada pessoa à empresa, incluindo os estados de **empresa suspensa** e **pessoa desativada**
- [ ] Isolamento entre empresas garantido de forma estrutural, valendo tanto para leitura quanto para gravação
- [ ] Impossibilidade estrutural de vincular uma informação de uma empresa a uma informação de outra
- [ ] A empresa a que a operação pertence é determinada pela sessão de quem age, **nunca por valor informado no pedido**
- [ ] Verificação automática que **reprova** se alguma informação de negócio nova nascer sem o isolamento habilitado
- [ ] Conjunto de provas de isolamento executado em ambiente próprio e descartável, incluindo prova de que essas provas de fato reprovam quando o isolamento é removido
- [ ] Entrada no sistema por identificação e senha, com **senha mínima de 10 caracteres com verificação de força**, **bloqueio após 5 tentativas malsucedidas** e **sessão de 8 horas renovada por atividade**
- [ ] **Segunda verificação obrigatória para o Sysloc Master** e opcional para o Admin Empresa
- [ ] **Troca obrigatória de senha no primeiro acesso** quando a senha é provisória
- [ ] **Encerramento de sessão** pela própria pessoa usuária
- [ ] **Recusa de entrada** a pessoa desativada ou pertencente a empresa suspensa, mesmo com credencial correta
- [ ] **Registro de toda tentativa de entrada** — sucesso, falha e bloqueio — sem superfície de consulta nesta fatia
- [ ] Nenhum segredo de autenticação legível nos registros internos de operação, inclusive quando trafega dentro de um endereço de acesso
- [ ] Os três perfis existindo como **rótulo de identidade**: Sysloc Master, Admin Empresa e Usuário Empresa
- [ ] Prova de que o **Sysloc Master enxerga vazio** em toda informação de negócio
- [ ] Empresas e pessoas usuárias de teste criadas por carga inicial, até que as rotas de administração cheguem na fatia seguinte

### 4.2 O que está explicitamente fora do escopo

- [ ] **O que cada perfil pode fazer** — a lista de 10 áreas de tela e 7 ações sensíveis, e o ajuste por pessoa (decisões 8, 15 e 38) — _fatia seguinte_
- [ ] **Contagem de versão das permissões** e a recusa de sessão com permissões obsoletas — _fatia seguinte_
- [ ] **Encerramento imediato de sessões já abertas** ao suspender empresa ou desativar pessoa (decisão 11) — _fatia seguinte; aqui a suspensão já barra a entrada, mas não derruba quem já entrou_
- [ ] **Rotas de administração do operador do SaaS** — criar empresa, criar o administrador inicial, suspender, reativar, listar — _fatia seguinte_
- [ ] **Emissão da senha provisória** por quem cria a conta — _fatia seguinte; aqui existe apenas a obrigação de trocá-la_
- [ ] **Recuperação de senha esquecida por autoatendimento** — _depende de canal de e-mail, que nasce na Fase 3_
- [ ] **Troca voluntária de senha** por pessoa já autenticada — _nenhuma decisão fechada a exige agora_
- [ ] **Envio de qualquer mensagem por e-mail** — _Fase 3_
- [ ] **Consulta ao registro de tentativas de entrada**, telas de acompanhamento e histórico — _é o painel do operador do SaaS, especificado depois da Fase 7_
- [ ] **Confidencialidade contra acesso administrativo ao servidor** — _decisão 16: limite declarado e aceito, ver seção 9_
- [ ] **Qualquer código de frontend** — _fronteira do repositório: aqui só se faz backend_

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**
  O **Admin Empresa** — quem administra a imobiliária no dia a dia. Nesta fatia ele é quem entra no sistema com identidade própria e cuja confidencialidade de dados está sendo garantida.

- **Personas secundárias:**
  - **Sysloc Master** — o operador do SaaS. Existe aqui como identidade de maior alcance operacional e, ao mesmo tempo, como uma **proibição verificável**: ele não alcança dado de negócio de nenhuma empresa por caminho nenhum.
  - **Usuário Empresa** — a pessoa que opera o dia a dia da imobiliária. Nesta fatia, entra no sistema e é identificada; o que ela alcança depois de entrar é a fatia seguinte.

- **Qual é seu objetivo ao usar essa feature?**
  Entrar no sistema sendo reconhecido individualmente, com a certeza de que o que ele registra pertence apenas à sua empresa.

- **Quais dores/dificuldades essa feature resolve pra ele?**
  Acaba com a credencial compartilhada e com a ausência de qualquer garantia de confidencialidade entre empresas concorrentes que usam o mesmo produto.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como **Sysloc Master**, quero que cada imobiliária alcance somente os próprios dados, para poder atender várias empresas no mesmo produto sem que uma veja a outra.
- **US-02**: Como **Admin Empresa**, preciso que meus dados permaneçam inalcançáveis por outra empresa **mesmo diante de defeito ou ausência de verificação na aplicação**, para confiar o cadastro da minha imobiliária ao produto.
- **US-03**: Como **Admin Empresa**, preciso que uma informação da minha empresa nunca possa ser vinculada a uma informação de outra empresa, para que nenhum documento ou relatório futuro misture dado alheio ao meu.
- **US-04**: Como **Admin Empresa**, quero que nem o operador do SaaS alcance o conteúdo da minha imobiliária, para que manter o serviço no ar não signifique ler os meus dados.
- **US-05**: Como **Usuário Empresa**, quero entrar no sistema com identificação individual, para que as ações sejam atribuídas a mim e não a uma credencial compartilhada por todos.
- **US-06**: Como **Admin Empresa**, quero que a senha exigida seja forte e que tentativas repetidas bloqueiem a conta, para reduzir o risco de alguém adivinhar o acesso da minha equipe.
- **US-07**: Como **Sysloc Master**, preciso de uma segunda verificação obrigatória ao entrar, para que a identidade de maior alcance do produto não dependa apenas de uma senha.
- **US-08**: Como **Admin Empresa**, quero que quem recebe uma senha provisória seja obrigado a trocá-la antes de fazer qualquer outra coisa, para que uma senha conhecida por terceiros deixe de valer no primeiro uso.
- **US-09**: Como **Usuário Empresa**, quero encerrar minha sessão quando quiser e que ela expire sozinha depois de um tempo, para que um computador esquecido aberto não fique acessível indefinidamente.
- **US-10**: Como **Sysloc Master**, quero que ninguém de empresa suspensa e nenhuma pessoa desativada consiga entrar, para que a interrupção de acesso tenha efeito real e não apenas registro.
- **US-11**: Como **Sysloc Master**, quero que toda tentativa de entrada fique registrada, para poder apurar depois quem entrou, quando, de onde e o que falhou.
- **US-12**: Como **Admin Empresa**, preciso que nenhum segredo de autenticação apareça legível nos registros internos de operação, para que a rotina de diagnóstico do sistema não vire uma coleta de credenciais.
- **US-13**: Como **Admin Empresa**, quero que toda informação de negócio criada daqui em diante nasça isolada **sem depender de alguém lembrar disso**, para que a garantia não se degrade à medida que o produto cresce.

---

## 6. Regras de Negócio (alto nível)

- RN-01 — Toda informação de negócio pertence a **exatamente uma** empresa, e essa vinculação nasce junto com o registro. Não existe informação de negócio sem empresa dona.
- RN-02 — Uma informação de uma empresa **nunca** pode referenciar informação de outra empresa. A tentativa é recusada, não corrigida silenciosamente.
- RN-03 — A empresa a que uma operação pertence é determinada pela **sessão de quem age**. Valor de empresa informado no pedido é ignorado — não existe caminho pelo qual quem faz o pedido escolha a empresa que quer enxergar.
- RN-04 — O **Sysloc Master não alcança informação de negócio** de nenhuma empresa, por caminho nenhum. Isso é comportamento verificável, não convenção.
- RN-05 — Senha válida tem **no mínimo 10 caracteres** e passa por verificação de força; senha fraca é recusada com indicação do motivo.
- RN-06 — **Cinco tentativas malsucedidas consecutivas** bloqueiam o acesso à conta.
- RN-07 — A sessão vale por **8 horas**, renovadas por atividade; passado o período sem atividade, exige-se nova entrada.
- RN-08 — A **segunda verificação é obrigatória** para o perfil Sysloc Master e **opcional** para o Admin Empresa.
- RN-09 — Senha provisória obriga à **troca no primeiro acesso**, antes de qualquer outra ação; concluída a troca, a provisória deixa de valer.
- RN-10 — Pessoa **desativada**, ou pertencente a **empresa suspensa**, não obtém acesso — ainda que a credencial esteja correta e ainda que a suspensão tenha sido registrada por carga inicial.
- RN-11 — **Toda tentativa de entrada é registrada** — bem-sucedida, malsucedida ou bloqueada — com autor, momento, origem e desfecho. O registro **não é consultável** nesta fatia.
- RN-12 — Nenhum segredo de autenticação (senha, código de verificação, identificador de sessão) aparece legível em registro interno de operação, **inclusive quando trafega dentro de um endereço de acesso**.
- RN-13 — Os três perfis — Sysloc Master, Admin Empresa e Usuário Empresa — existem nesta fatia como **rótulo de identidade**. O que cada um pode fazer é regra da fatia seguinte; a única regra de alcance já valendo aqui é a RN-04.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. A pessoa informa sua identificação e sua senha.
2. O sistema confere a credencial e o estado da pessoa e da empresa dela.
3. Se o perfil exigir segunda verificação, o sistema a solicita e só conclui a entrada quando ela for satisfeita.
4. Se a senha em uso for provisória, o sistema exige a definição de uma nova senha antes de liberar qualquer outra ação.
5. O sistema estabelece a sessão, que passa a identificar a pessoa e a empresa dela por 8 horas renováveis por atividade.
6. A partir daí, toda informação que a pessoa consulta ou grava pertence à empresa da sessão — e nada além dela é alcançável.
7. A pessoa encerra a sessão quando quiser, e o acesso deixa de valer imediatamente.

### 7.2 Fluxos Alternativos

- **Credencial incorreta**: o sistema recusa a entrada sem revelar se o erro foi na identificação ou na senha, e contabiliza a tentativa.
- **Cinco tentativas malsucedidas consecutivas**: a conta fica bloqueada e as tentativas seguintes são recusadas mesmo com a senha correta.
- **Segunda verificação não satisfeita**: a entrada não se conclui; a sessão não chega a existir.
- **Pessoa desativada ou empresa suspensa**: a entrada é recusada mesmo com credencial correta, com a mesma discrição — sem detalhar qual dos dois estados causou a recusa.
- **Senha nova fraca ou curta na troca obrigatória**: a troca é recusada com o motivo, e a pessoa permanece presa à exigência até definir uma senha válida.
- **Sessão expirada por inatividade**: a próxima ação é recusada e nova entrada é exigida.
- **Empresa da sessão sem dado nenhum**: o sistema responde vazio — o mesmo que responderia a uma consulta que tentasse alcançar dado de outra empresa. Ausência de dado e ausência de permissão são indistinguíveis por fora, propositalmente.
- **Sysloc Master consultando informação de negócio**: o resultado é vazio, em qualquer área, sem mensagem de erro que sugira existir algo do outro lado.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO duas empresas cadastradas, cada uma com informações próprias, QUANDO uma consulta é feita no contexto da empresa A ENTÃO somente informações da empresa A são devolvidas, e nenhuma da empresa B.
- [ ] **CA-02**: DADO que a camada de aplicação foi contornada e o acesso é feito diretamente ao armazenamento no contexto da empresa A QUANDO se tenta ler ou gravar informação da empresa B ENTÃO nada é devolvido e nada é gravado.
- [ ] **CA-03**: DADO que o isolamento é deliberadamente removido em uma cópia do sistema QUANDO o conjunto de provas de isolamento é executado ENTÃO ele **reprova** — a garantia é demonstrada capaz de detectar sua própria ausência.
- [ ] **CA-04**: DADO uma informação pertencente à empresa A QUANDO se tenta vinculá-la a uma informação pertencente à empresa B ENTÃO a gravação é recusada, e não há caminho pelo qual o vínculo cruzado seja aceito.
- [ ] **CA-05**: DADO o Sysloc Master autenticado QUANDO ele consulta qualquer informação de negócio, de qualquer empresa ENTÃO o resultado é vazio.
- [ ] **CA-06**: DADO uma pessoa cadastrada e ativa, em empresa ativa, QUANDO informa identificação e senha corretas ENTÃO obtém acesso e a sessão passa a identificá-la individualmente e a fixar a empresa dela.
- [ ] **CA-07**: DADO uma tentativa de definir senha com menos de 10 caracteres ou reprovada na verificação de força QUANDO a pessoa confirma ENTÃO a senha é recusada com indicação do motivo e não passa a valer.
- [ ] **CA-08**: DADO cinco tentativas de entrada malsucedidas consecutivas na mesma conta QUANDO uma nova tentativa é feita ENTÃO ela é recusada mesmo que a credencial esteja correta.
- [ ] **CA-09**: DADO uma pessoa de perfil Sysloc Master QUANDO ela informa a senha correta ENTÃO o acesso só se conclui após a segunda verificação, e sem ela nenhuma sessão é estabelecida.
- [ ] **CA-10**: DADO uma pessoa cuja senha em uso é provisória QUANDO ela entra pela primeira vez ENTÃO é obrigada a definir uma nova senha antes de qualquer outra ação, e a senha provisória deixa de valer após a troca.
- [ ] **CA-11**: DADO uma pessoa com sessão ativa QUANDO ela encerra a sessão ENTÃO o acesso deixa de valer imediatamente, e a ação seguinte exige nova entrada.
- [ ] **CA-12**: DADO uma sessão sem atividade por mais que o período máximo QUANDO uma nova ação é tentada ENTÃO ela é recusada e nova entrada é exigida.
- [ ] **CA-13**: DADO uma pessoa desativada, ou pertencente a empresa suspensa, QUANDO ela informa credencial correta ENTÃO o acesso é recusado e nenhuma sessão é estabelecida.
- [ ] **CA-14**: DADO qualquer tentativa de entrada — bem-sucedida, malsucedida ou recusada por bloqueio — QUANDO ela ocorre ENTÃO fica registrada com autor, momento, origem e desfecho.
- [ ] **CA-15**: DADO um evento de autenticação gravado nos registros internos de operação QUANDO esse registro é inspecionado ENTÃO nenhuma senha, código de verificação ou identificador de sessão aparece legível — inclusive quando o valor viaja dentro de um endereço de acesso.
- [ ] **CA-16**: DADO uma informação de negócio criada sem o isolamento habilitado QUANDO a verificação do projeto é executada ENTÃO ela reprova, apontando exatamente qual informação nasceu desprotegida.
- [ ] **CA-17**: DADO o conjunto de provas de isolamento QUANDO ele é executado ENTÃO ele demonstra que o acesso usado **não possui privilégio capaz de contornar o isolamento** — uma execução privilegiada não pode passar por verde.

---

## 9. Restrições & Considerações

**Decisões arquiteturais vinculantes** (o COMO está nelas — não se repete aqui):

- **ADR-0008 — Isolamento multi-tenant garantido pelo banco, não pela aplicação** (`accepted`, 2026-08-01): é **vinculante para esta fatia** e determina onde o isolamento é imposto. Ela também registra que a camada de aplicação **não** implementa filtro equivalente — não há dois caminhos para o dado. `[DELEGAR_TECH_SPEC]`
- **ADR-0006** — o conjunto de provas nunca executa contra o ambiente que atende a operação. `[DELEGAR_TECH_SPEC]`
- **ADR-0007** — forma canônica da resposta de erro, aplicável a toda recusa descrita neste PRD. `[DELEGAR_TECH_SPEC]`

**Restrições de produto travadas pelo usuário** (`.claude/plans/plano-saas-decisoes.md`):

- **Decisão 2** — escala de 20 a 300 empresas, com isolamento lógico por empresa; não haverá base separada por cliente.
- **Decisão 13** — senha mínima de 10 com verificação de força, bloqueio após 5 tentativas, sessão de 8h renovável por atividade, segunda verificação opcional para o Admin e **obrigatória para o Master**, e trilha de tentativas de entrada.
- **Decisões 14 e 39** — senha provisória com troca obrigatória no primeiro acesso, tanto para o administrador inicial quanto para as demais pessoas da empresa. **Esta fatia entrega a obrigação de trocar; a emissão fica na fatia seguinte.**
- **Decisão 11** — revogação de acesso bloqueia na hora e nada é apagado. **Esta fatia entrega a barreira na entrada; derrubar sessões já abertas é da fatia seguinte.**
- **Decisões 8, 15 e 38** — três perfis com permissões ajustáveis por pessoa, sobre 10 áreas de tela e 7 ações sensíveis. **Fora desta fatia**, onde os perfis são apenas rótulo.

**Limite declarado e aceito conscientemente:**

- **Decisão 16** — a confidencialidade é garantida **apenas dentro da aplicação**. Quem tem acesso administrativo ao servidor ou ao armazenamento lê os dados de qualquer empresa. Não há cifragem por campo nem auditoria de acesso técnico. **Isto é risco aceito e documentado, não defeito** — e precisa continuar legível assim em qualquer revisão futura, para não ser reaberto como problema.

**Dependências e considerações:**

- A Fase 0 é pré-requisito e está concluída e provada; esta fatia constrói sobre ela.
- **Não existe canal de e-mail** até a Fase 3 — nenhuma parte deste PRD pode depender de envio de mensagem.
- Enquanto não houver as rotas de administração (fatia seguinte), empresas e pessoas usadas nas provas nascem por **carga inicial**.
- Existe um **débito registrado no próprio código** cujo gatilho é a entrada da autenticação: os registros internos de operação hoje não protegem segredo que viaja dentro de um endereço de acesso. Ele é fechado nesta fatia — é o que a RN-12 e o CA-15 exigem.
- **Fronteira do repositório**: aqui só se faz backend. Nenhuma parte desta fatia produz código de interface.
- **Protocolo Antirregressão** vigente: nada que já esteja fechado e provado pode ser desfeito por trabalho desta fatia.

**Consideração de experiência:**

- As recusas de entrada não revelam **qual** condição falhou — credencial errada, conta bloqueada, pessoa desativada ou empresa suspensa produzem a mesma resposta para quem tenta. É deliberado: distinguir os casos entrega ao atacante a confirmação de que a conta existe.

---

## 10. Métricas de Sucesso

Todas verificáveis **no próprio ciclo de construção**, sem depender de tráfego real — esta fatia é fundação e não tem usuário em produção ainda.

- **Cobertura do isolamento: 100%** das informações de negócio existentes nascem protegidas, aferido por verificação automática que reprova ao encontrar a primeira exceção (CA-16).
- **Zero linha alheia** devolvida ou gravada em toda tentativa de alcance entre empresas, incluindo tentativas feitas contornando a aplicação (CA-01, CA-02, CA-04).
- **Zero informação de negócio** alcançável pelo operador do SaaS (CA-05).
- **A prova prova**: removido o isolamento de propósito, o conjunto de verificações **reprova** — e o mesmo vale para uma execução com acesso privilegiado, que não pode passar por verde (CA-03, CA-17). Esta é a métrica que impede o resultado mais perigoso da fatia: uma suíte verde que não verifica nada.
- **Cobertura das regras de entrada**: cada uma das RN-05 a RN-11 tem ao menos uma verificação que falha quando a regra é removida.
- **Zero segredo legível** nos registros internos de operação para todos os formatos de tráfego de autenticação (CA-15).

---

## 11. Roadmap / Fases

Fases lógicas deste PRD. A decomposição executável é responsabilidade do plano de tasks.

- **Fase 1 — Isolamento estrutural**: cadastro de empresa, pessoa usuária e vínculo de acesso, com os estados de suspensão e desativação; o isolamento imposto estruturalmente na leitura e na gravação; a impossibilidade de vínculo cruzado; e a determinação da empresa a partir da sessão, nunca do pedido. _Cobre US-01, US-02, US-03, US-13._
- **Fase 2 — Identidade e sessão**: entrada com identificação e senha, força de senha, bloqueio por tentativas, sessão de 8 horas, segunda verificação obrigatória para o Master, troca obrigatória de senha provisória, encerramento de sessão, recusa a pessoa desativada e a empresa suspensa, registro das tentativas de entrada, e a proteção dos segredos nos registros internos. _Cobre US-05 a US-12._
- **Fase 3 — Provas**: o conjunto de verificações de isolamento em ambiente próprio e descartável, a prova negativa do Sysloc Master, a demonstração de que as verificações reprovam quando o isolamento é removido, e a de que o acesso usado não pode contornar o isolamento. _Cobre US-04 e fecha as provas de US-02 e US-13._

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Cada empresa alcança somente os próprios dados | CA-01 |
| US-02 | Isolamento resiste a defeito ou ausência de verificação na aplicação | CA-02, CA-03, CA-17 |
| US-03 | Vínculo entre informações de empresas diferentes é impossível | CA-04 |
| US-04 | Operador do SaaS não alcança conteúdo das imobiliárias | CA-05 |
| US-05 | Entrada com identificação individual, não credencial compartilhada | CA-06 |
| US-06 | Senha forte exigida e bloqueio após tentativas repetidas | CA-07, CA-08 |
| US-07 | Segunda verificação obrigatória para o perfil de maior alcance | CA-09 |
| US-08 | Senha provisória obriga troca antes de qualquer outra ação | CA-10 |
| US-09 | Encerramento de sessão pela pessoa e expiração por inatividade | CA-11, CA-12 |
| US-10 | Suspensão e desativação barram a entrada de fato | CA-13 |
| US-11 | Toda tentativa de entrada fica registrada | CA-14 |
| US-12 | Nenhum segredo de autenticação legível nos registros internos | CA-15 |
| US-13 | Informação de negócio nova nasce isolada sem depender de lembrança | CA-16 |

---

## 13. Checklist Final

- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-13)
- [x] Critérios de aceite claros (CA-01 a CA-17, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum identificador pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
