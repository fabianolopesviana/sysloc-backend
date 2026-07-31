# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Integração bancária configurável pelo frontend
- **Responsável/Autor**: neuberagil@icloud.com
- **Data**: 2026-07-20
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Pré-refinamento: `docs/specs/features/integracao-bancaria-configuravel/v1/pre-refinement.md`
  - ADR-0001 — Modelo canônico de cobrança bancária com adaptador por provedor: `docs/adr/0001-modelo-canonico-cobranca-bancaria-adaptador-por-provedor.md`

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**
  A configuração da integração bancária de boletos não é operável pelo cliente. Trocar a conta bancária, o titular ou o certificado digital exige acesso privilegiado ao servidor ou edição direta pelo painel administrativo do sistema de gestão. Não existe tela nem caminho pelo aplicativo.

- **Como funciona atualmente?**
  A emissão, baixa, consulta e conciliação de boletos operam normalmente em produção. Porém: o certificado digital está guardado num local do servidor onde a aplicação não tem permissão de escrita, e parte dos parâmetros de comunicação com o banco está fixada no código. Consequência: qualquer alteração de conta ou certificado depende de um terceiro com acesso técnico ao servidor, e mudanças no endereço de comunicação do banco exigem nova publicação do sistema.

- **Por que isso precisa ser resolvido agora?**
  A integração já está madura e funcionando; o gargalo remanescente é exclusivamente operacional. Cada troca de conta virou um incidente que bloqueia a emissão de boletos até que alguém com acesso ao servidor intervenha. O certificado digital tem validade e vai vencer — quando isso acontecer sem aviso, a emissão para.

- **Quem sofre o impacto do problema?**
  O gestor da imobiliária, que fica bloqueado e dependente de terceiro; o time técnico, interrompido para tarefas de configuração; e, indiretamente, os locatários, que deixam de receber seus boletos.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**
  Que trocar conta bancária, titular ou certificado digital seja uma operação de tela, executável pelo próprio gestor da imobiliária, com validação e teste antes de entrar em vigor.

- **Qual mudança de comportamento esta feature deve gerar?**
  Operações de configuração da cobrança bancária deixam de exigir acesso ao servidor ou ao painel administrativo. A configuração deixa de ser parcialmente código e passa a ser integralmente dado, gerenciável pelo usuário responsável.

- **Qual o resultado final esperado do ponto de vista do usuário?**
  O gestor abre uma tela, vê qual conta e qual certificado estão em uso e há quanto tempo o certificado ainda é válido, envia um certificado novo ou altera os dados da conta, testa a conexão com o banco e confirma — tudo sem sair do aplicativo e sem pedir ajuda a ninguém.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)
- [ ] Visualização da configuração bancária ativa, sem exposição de dados sensíveis
- [ ] Envio de certificado digital com informação da respectiva senha
- [ ] Extração e exibição de titular, documento, emissor e período de validade a partir do certificado enviado, antes da confirmação
- [ ] Recusa de certificado inválido ou com senha incorreta, com mensagem de negócio compreensível
- [ ] Edição dos dados da conta no provedor (identificação do cliente, conta corrente e modalidade de cobrança)
- [ ] Edição dos endereços de comunicação com o banco e do ambiente de operação, em área de configurações avançadas apartada do fluxo comum
- [ ] Teste de conexão com o banco, como condição para a configuração entrar em vigor
- [ ] Aviso de quantidade de boletos em aberto emitidos pela conta atual antes de confirmar uma troca, com três caminhos de decisão
- [ ] Geração e abertura de um documento único consolidando todos os boletos em aberto
- [ ] Indicação de quanto tempo falta para o certificado vencer
- [ ] Bloqueio da emissão, com mensagem clara, quando o certificado estiver vencido
- [ ] Remoção do certificado enviado
- [ ] Registro de auditoria das trocas de configuração
- [ ] Continuidade da operação durante a transição, sem interrupção da cobrança
- [ ] Capacidade de suportar um provedor bancário adicional no futuro sem reescrever o fluxo de cobrança `[DELEGAR_TECH_SPEC]`

### 4.2 O que está explicitamente fora do escopo
- [ ] Notificação ativa de vencimento do certificado por e-mail ou outro canal — adiado; nesta versão o aviso é apenas na tela
- [ ] Janela de rollback ou retenção do certificado anterior para desfazer uma troca — adiado
- [ ] Painel de saúde da integração (histórico de conexões, últimas emissões, taxa de erro) — pertence a uma iniciativa própria de acompanhamento operacional
- [ ] Múltiplas contas bancárias simultâneas por proprietário ou por imóvel — mantém-se uma configuração ativa por provedor
- [ ] Integração efetiva com um segundo banco — a capacidade é preparada, mas nenhum provedor adicional é entregue nesta versão
- [ ] Envio do documento consolidado de boletos por e-mail ou qualquer outro canal
- [ ] Alteração do fluxo de emissão, baixa ou conciliação do ponto de vista de quem já os utiliza — o comportamento observável permanece o mesmo

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**
  O **gestor da imobiliária** — responsável pela conta bancária que recebe os pagamentos. Perfil não-técnico. Não conhece vocabulário de integração, certificados ou protocolos.

- **Qual é seu objetivo ao usar essa feature?**
  Manter a cobrança funcionando: renovar o certificado quando vence, e apontar a cobrança para a conta correta quando a conta ou o titular mudam.

- **Quais dores/dificuldades essa feature resolve pra ele?**
  Elimina a dependência de terceiro com acesso ao servidor, o tempo de espera até a intervenção, e a insegurança de não saber se a configuração está correta antes de os boletos começarem a falhar.

- **Persona secundária: administrador técnico** — responsável pelo sistema. Usa a mesma tela, incluindo a área de configurações avançadas, e precisa de rastro de auditoria das alterações.

- **Contexto de uso**: web, dentro do aplicativo de locação. Uso pontual e de baixa frequência (renovação anual do certificado, mudança societária eventual) — o que exige que a tela seja autoexplicativa, já que o gestor nunca acumula familiaridade com ela.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como gestor da imobiliária, quero visualizar a configuração bancária em vigor para saber qual conta e qual certificado estão sendo usados na cobrança.
- **US-02**: Como gestor da imobiliária, quero enviar um novo certificado digital informando sua senha para renovar a credencial sem depender de suporte técnico.
- **US-03**: Como gestor da imobiliária, quero ver o titular, o documento e a validade extraídos do certificado antes de confirmar para ter certeza de que enviei o arquivo correto.
- **US-04**: Como gestor da imobiliária, quero alterar os dados da conta no banco para apontar a cobrança à conta correta quando ela muda.
- **US-05**: Como gestor da imobiliária, quero testar a conexão com o banco antes da configuração entrar em vigor para não descobrir um erro só quando um boleto falhar.
- **US-06**: Como gestor da imobiliária, quero ser avisado de quantos boletos em aberto foram emitidos pela conta atual antes de confirmar uma troca para entender o impacto da mudança.
- **US-07**: Como gestor da imobiliária, quero poder gerar um documento único com todos os boletos em aberto no momento da troca para preservar o acesso a eles.
- **US-08**: Como gestor da imobiliária, quero ver quanto tempo falta para o certificado vencer para renová-lo antes que a emissão pare.
- **US-09**: Como gestor da imobiliária, quero remover o certificado enviado para corrigir um envio equivocado.
- **US-10**: Como administrador técnico, quero ajustar os endereços de comunicação com o banco e o ambiente de operação sem nova publicação do sistema para acompanhar mudanças do provedor.
- **US-11**: Como administrador técnico, quero que toda troca de configuração fique registrada para auditar quem alterou o quê e quando.
- **US-12**: Como gestor da imobiliária, quero que a emissão seja recusada com uma mensagem clara quando o certificado estiver vencido para saber exatamente o que preciso fazer.
- **US-13**: Como responsável pela operação, quero que a cobrança continue funcionando sem interrupção durante a transição para o novo modelo de configuração.
- **US-14**: Como responsável pelo produto, quero que a operação de cobrança deixe de depender do formato de um banco específico para que suportar outro provedor no futuro não exija reescrever o fluxo. `[DELEGAR_TECH_SPEC]`

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — Existe no máximo uma configuração bancária ativa por provedor. Nenhuma operação de cobrança ocorre sem exatamente uma configuração ativa.
- **RN-02** — Considera-se **boleto em aberto** todo boleto emitido ou vencido que ainda não foi liquidado nem baixado.
- **RN-03** — O contador sequencial que identifica os boletos da imobiliária é único e contínuo, e **nunca reinicia** ao trocar de conta bancária. Uma troca pode pular faixa, jamais repetir um número já usado.
- **RN-04** — Uma configuração só entra em vigor após um teste de conexão bem-sucedido com o banco. Enquanto o teste não passar, a configuração anterior permanece em vigor.
- **RN-05** — Um certificado só é aceito se puder ser aberto com a senha informada. Certificado em formato inválido, senha incorreta ou tamanho fora da faixa esperada são recusados, e nada é gravado.
- **RN-06** — A senha e o conteúdo do certificado nunca são exibidos na tela, devolvidos ao aplicativo ou registrados em qualquer histórico ou diagnóstico.
- **RN-07** — Com o certificado vencido, a emissão de boletos é recusada antes de qualquer tentativa de comunicação com o banco, com mensagem de negócio explicando a causa e a ação necessária.
- **RN-08** — Quando existirem boletos em aberto emitidos pela conta atual, a troca exige confirmação explícita do gestor entre três caminhos: aceitar a troca, não aceitar a troca, ou aceitar a troca gerando o documento consolidado dos boletos em aberto.
- **RN-09** — O documento consolidado reúne os boletos em aberto cujo comprovante esteja disponível e informa explicitamente quais boletos ficaram de fora, para que o gestor possa tratá-los.
- **RN-10** — Enquanto nenhum certificado for enviado pela tela, a credencial pré-existente continua em uso e a cobrança segue operando normalmente.
- **RN-11** — O acesso à configuração da integração bancária é restrito a usuários com perfil administrativo.
- **RN-12** — Toda alteração de configuração é registrada com autor, data e identificação do certificado anterior e do novo.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O gestor acessa a tela de configuração da integração bancária.
2. O sistema apresenta a conta em uso, os dados do titular do certificado atual e há quanto tempo esse certificado ainda é válido. Dados sensíveis não são exibidos.
3. O gestor altera os dados da conta e/ou envia um novo certificado, informando a senha correspondente.
4. Ao receber o certificado, o sistema o valida e apresenta o titular, o documento, o emissor e o período de validade extraídos, pedindo confirmação de que é a credencial correta.
5. O gestor aciona o teste de conexão com o banco.
6. O sistema comunica o resultado do teste em linguagem de negócio.
7. Havendo boletos em aberto emitidos pela conta atual, o sistema informa a quantidade e apresenta os três caminhos: aceitar, não aceitar, ou aceitar gerando o documento consolidado.
8. O gestor escolhe um dos caminhos.
9. Com o teste bem-sucedido e a decisão tomada, o sistema coloca a nova configuração em vigor, registra a alteração e confirma ao gestor.

### 7.2 Fluxos Alternativos

- **Senha do certificado incorreta ou arquivo inválido**: o sistema recusa o envio com mensagem explicando a causa, nada é gravado e a configuração em vigor permanece intacta.
- **Teste de conexão falha**: o sistema informa o motivo em linguagem compreensível, a configuração não entra em vigor e a anterior continua operando.
- **Gestor escolhe não aceitar a troca**: a operação é cancelada por completo e a configuração atual permanece inalterada.
- **Gestor escolhe gerar o documento consolidado**: o sistema monta o documento único com os boletos em aberto e o apresenta ao gestor da mesma forma que já apresenta os demais documentos do aplicativo; a troca prossegue em seguida.
- **Boletos em aberto sem comprovante disponível**: o documento consolidado é gerado com os disponíveis e o sistema lista quais ficaram de fora, antes de a troca ser confirmada.
- **Nenhum boleto em aberto**: a etapa de confirmação de impacto é dispensada e a troca segue direto.
- **Certificado vencido no momento de emitir um boleto**: a emissão é recusada com mensagem de negócio, e o gestor é orientado a renovar a credencial.
- **Nenhum certificado enviado ainda pela tela**: a cobrança continua operando com a credencial pré-existente, sem qualquer interrupção.
- **Gestor remove o certificado enviado**: o sistema apaga a credencial e as informações dela derivadas, deixando a configuração sem certificado próprio.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO que existe uma configuração bancária ativa QUANDO o gestor acessa a tela de configuração ENTÃO o sistema apresenta a conta em uso, o titular do certificado e o período de validade, sem exibir a senha nem o conteúdo do certificado.
- [ ] **CA-02**: DADO que o gestor possui um certificado válido e sua senha QUANDO ele envia o certificado informando a senha correta ENTÃO o sistema aceita o envio e passa a apresentá-lo como credencial da configuração.
- [ ] **CA-03**: DADO que o gestor possui um certificado válido QUANDO ele o envia informando uma senha incorreta ENTÃO o sistema recusa o envio com mensagem de negócio explicando a causa e nenhuma informação é gravada.
- [ ] **CA-04**: DADO que o gestor enviou um certificado aceito QUANDO o sistema conclui a validação ENTÃO ele apresenta o titular, o documento, o emissor e o período de validade extraídos do próprio certificado, antes de a configuração ser confirmada.
- [ ] **CA-05**: DADO que o gestor está na tela de configuração QUANDO ele altera os dados da conta no banco e confirma ENTÃO o sistema passa a considerar a nova conta para as próximas cobranças.
- [ ] **CA-06**: DADO que existe uma configuração preenchida QUANDO o gestor aciona o teste de conexão e o banco responde com sucesso ENTÃO o sistema informa o êxito e habilita a configuração a entrar em vigor.
- [ ] **CA-07**: DADO que existe uma configuração preenchida QUANDO o gestor aciona o teste de conexão e ele falha ENTÃO o sistema informa o motivo em linguagem compreensível, a configuração não entra em vigor e a anterior permanece operando.
- [ ] **CA-08**: DADO que existem boletos em aberto emitidos pela conta atual QUANDO o gestor confirma uma troca de configuração ENTÃO o sistema informa a quantidade desses boletos e apresenta as três opções de decisão antes de prosseguir.
- [ ] **CA-09**: DADO que o gestor foi avisado sobre boletos em aberto QUANDO ele escolhe aceitar a troca gerando o documento consolidado ENTÃO o sistema monta um documento único com esses boletos e o apresenta da mesma forma que apresenta os demais documentos do aplicativo.
- [ ] **CA-10**: DADO que parte dos boletos em aberto não possui comprovante disponível QUANDO o documento consolidado é gerado ENTÃO ele reúne os disponíveis e o sistema lista explicitamente quais boletos ficaram de fora.
- [ ] **CA-11**: DADO que existe um certificado em uso QUANDO o gestor acessa a tela de configuração ENTÃO o sistema indica quantos dias faltam para o vencimento desse certificado.
- [ ] **CA-12**: DADO que existe um certificado enviado pela tela QUANDO o gestor solicita sua remoção ENTÃO o sistema apaga a credencial e as informações dela derivadas, e a configuração deixa de apresentá-la.
- [ ] **CA-13**: DADO que o administrador técnico está na área de configurações avançadas QUANDO ele altera os endereços de comunicação com o banco ou o ambiente de operação e confirma ENTÃO o sistema passa a usar os novos valores sem necessidade de nova publicação do sistema.
- [ ] **CA-14**: DADO que uma configuração foi alterada QUANDO o administrador técnico consulta o registro de alterações ENTÃO ele encontra o autor, a data e a identificação do certificado anterior e do novo.
- [ ] **CA-15**: DADO que o certificado em uso está vencido QUANDO uma emissão de boleto é solicitada ENTÃO o sistema recusa a emissão com mensagem de negócio informando o vencimento e a ação necessária, sem tentar comunicação com o banco.
- [ ] **CA-16**: DADO que nenhum certificado foi enviado pela tela QUANDO uma cobrança é emitida, baixada ou consultada ENTÃO a operação ocorre normalmente com a credencial pré-existente, sem qualquer interrupção.
- [ ] **CA-17**: DADO que a operação de cobrança está em funcionamento QUANDO as operações de emitir, baixar, consultar, confirmar e sincronizar são executadas ENTÃO seus resultados observáveis permanecem equivalentes aos anteriores à mudança, do ponto de vista de quem já as utiliza.

---

## 9. Restrições & Considerações

- **Segurança**: o certificado digital e sua senha são material sensível. A senha nunca trafega de volta ao aplicativo nem aparece em registros de diagnóstico. O acesso à configuração é restrito a perfil administrativo. `[DELEGAR_TECH_SPEC]`
- **Continuidade obrigatória**: a cobrança está em produção e não pode ser interrompida pela transição. A credencial pré-existente precisa continuar operando enquanto nenhuma nova for enviada.
- **Persona não-técnica**: toda mensagem de erro precisa ser de negócio — dizer o que aconteceu e o que fazer. Mensagens técnicas brutas do provedor não podem chegar ao gestor.
- **Área avançada apartada**: os endereços de comunicação com o banco são editáveis, mas não podem ficar no fluxo comum do gestor, sob risco de alteração acidental que interrompa a cobrança em silêncio.
- **Dependência de investigação**: o comportamento do banco ao receber baixa ou consulta de um boleto emitido sob outra conta ainda não foi confirmado. Isso não altera o fluxo definido, apenas a redação do aviso exibido ao gestor (informativo ou de advertência). Precisa ser resolvido antes da entrega da Fase 2.
- **Faixa de tamanho do certificado**: a faixa aceitável de tamanho do arquivo ainda não foi definida. `[DELEGAR_TECH_SPEC]`
- **Ambiente de homologação**: ainda não foi confirmado se existem credenciais de homologação disponíveis no provedor. Sem elas, a opção de ambiente tem valor limitado para testes.
- **Backup**: ao passar a ser gerenciado pela aplicação, o certificado entra no backup do sistema. O backup precisa manter o mesmo nível de proteção que o arquivo tinha anteriormente.

---

## 10. Métricas de Sucesso

- **Zero intervenções via acesso ao servidor para configuração** — nenhuma troca de conta, titular ou certificado exigindo acesso privilegiado ao servidor após a entrega. É a métrica direta da dor original.
- **Zero interrupções de emissão por certificado vencido** — nenhuma janela em que boletos deixaram de ser emitidos porque a credencial venceu sem que ninguém percebesse.
- **Taxa de sucesso do teste de conexão na primeira tentativa** — proporção de trocas que passam no teste já na primeira tentativa. Indicador de clareza da tela para a persona não-técnica; taxa baixa aponta problema de usabilidade, não de integração.

---

## 11. Roadmap / Fases

- **Fase 1 — Fundação e capacidades de configuração**: modelo de cobrança independente de provedor, tradução para o provedor atual, configuração persistida e editável, gestão do certificado com validação e extração de dados, teste de conexão, continuidade com a credencial pré-existente, registro de auditoria e apuração de boletos em aberto. Ao final desta fase, todas as capacidades existem, porém ainda sem tela.
- **Fase 2 — Experiência do gestor**: tela de configuração com visualização da conta em uso, envio e remoção de certificado, edição dos dados da conta, área de configurações avançadas, indicação de validade, teste de conexão e o fluxo de confirmação de troca com as três opções, incluindo a geração e apresentação do documento consolidado.

> Itens adiados (notificação ativa de vencimento, janela de rollback do certificado) não compõem o roadmap desta versão — ver seção 4.2.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Visualizar a configuração bancária em vigor | CA-01 |
| US-02 | Enviar novo certificado digital com senha | CA-02, CA-03 |
| US-03 | Ver dados extraídos do certificado antes de confirmar | CA-04 |
| US-04 | Alterar dados da conta no banco | CA-05 |
| US-05 | Testar a conexão antes da configuração entrar em vigor | CA-06, CA-07 |
| US-06 | Ser avisado de boletos em aberto antes da troca | CA-08 |
| US-07 | Gerar documento único com os boletos em aberto | CA-09, CA-10 |
| US-08 | Ver quanto falta para o certificado vencer | CA-11 |
| US-09 | Remover o certificado enviado | CA-12 |
| US-10 | Ajustar endereços de comunicação e ambiente | CA-13 |
| US-11 | Auditar as trocas de configuração | CA-14 |
| US-12 | Emissão recusada com mensagem clara se o certificado venceu | CA-15 |
| US-13 | Cobrança sem interrupção durante a transição | CA-16 |
| US-14 | Cobrança independente do formato de um banco específico | CA-17 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-14)
- [x] Critérios de aceite claros (CA-01 a CA-17, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida, sem US órfã, CA órfão ou ID pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
