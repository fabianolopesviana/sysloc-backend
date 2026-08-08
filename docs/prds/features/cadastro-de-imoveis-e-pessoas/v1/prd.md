# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Cadastro de imóveis e pessoas do domínio de locação
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-05
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Pré-refinamento: `docs/specs/features/dominio-locacao/v1/pre-refinement.md` (cobre as duas fatias da fase)
  - Plano de execução: `docs/plano-backend-novo/plano-execucao.md` §F2
  - Fatia irmã, posterior: contratos de locação com ativação e cancelamento
  - ADRs vinculantes: **0006**, **0008**, **0011**, **0014**, **0015**, **0016**, **0017**
    (a **0017** substituiu a **0012** em 2026-08-05)
  - Glossário de domínio: `docs/specs/domain-glossary.md`

> Esta é a **primeira de duas fatias** da fase de domínio de locação. O corte é por agregado: imóveis e
> pessoas aqui, contratos na fatia seguinte — decidido no pré-refinamento porque contrato depende de
> ambos, e a dependência já dá a ordem.

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?**
  O produto novo sabe quem entra e o que cada pessoa alcança, mas **não conhece nenhum substantivo do
  negócio**. Não existe imóvel, não existe locador, não existe locatário. Nenhuma tela de operação pode
  ser servida, e as fases seguintes — cobrança, integração bancária, automação — dependem inteiramente
  destes cadastros.

- **Como funciona atualmente?**
  Toda a operação real da imobiliária segue no sistema antigo, que será desligado. Lá, os cadastros
  carregam defeitos conhecidos: metragem e valores chegam ao consumidor como texto e precisam ser
  convertidos por ele; a identificação de cada registro é um código opaco de dez caracteres; e um dado
  de identificação do imóvel é único no sistema inteiro, o que impediria duas imobiliárias de
  administrarem o mesmo imóvel.

- **Por que isso precisa ser resolvido agora?**
  É a primeira entrega que um usuário final enxergaria, e é a base sobre a qual três fases seguintes se
  apoiam — errar a forma aqui custa caro depois. Além disso, o sistema antigo ainda está de pé e pode ser
  consultado para provar equivalência de regra; essa janela se fecha ao fim do projeto.

- **Quem sofre o impacto do problema?**
  O operador e o administrador da imobiliária, que hoje dependem do sistema antigo para qualquer
  cadastro; e o projeto inteiro, que não pode avançar para cobrança sem estas entidades.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?**
  Que a imobiliária consiga manter sua carteira de imóveis e seu cadastro de pessoas no produto novo,
  com cada dado no tipo certo, isolado por empresa, e com a metragem do imóvel calculada pelo sistema.

- **Qual mudança de comportamento esta feature deve gerar?**
  O cadastro deixa de ser um formulário genérico sobre uma estrutura de dados anônima e passa a ser um
  cadastro do negócio: campos obrigatórios que fazem sentido, recusa de documento inválido ou repetido,
  metragem que se atualiza sozinha, e nada que se apague por engano.

- **Qual o resultado final esperado do ponto de vista do usuário?**
  Cadastrar um conjunto, os imóveis dele com seus cômodos, e as pessoas com quem se contrata — e
  encontrar tudo isso de volta, organizado, na hora de montar um contrato.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] Cadastro de **conjunto** — o agrupamento a que os imóveis pertencem
- [ ] Cadastro de **imóvel**, com endereço completo, tipo, identificador municipal e situação de locação
- [ ] Registro dos **cômodos** de um imóvel, com nome e metragem, alteráveis um a um
- [ ] **Metragem total do imóvel calculada pelo sistema** a partir dos cômodos, provada equivalente ao
      comportamento do sistema antigo
- [ ] Cadastro de **locador**, **locatário** e **fiador**, com documento, contato e endereço
- [ ] **Conferência do documento** da pessoa quanto à validade e à repetição dentro da mesma empresa
- [ ] **Retirada de circulação** de um cadastro (a ação sensível de excluir cadastro), com volta possível
- [ ] **Consulta que devolve a carteira** — conjuntos, seus imóveis e os cômodos de cada um, de uma vez
- [ ] **Isolamento por empresa** de todos estes cadastros, garantido sem depender de conferência da
      aplicação · `[DELEGAR_TECH_SPEC]`
- [ ] **Exigência de permissão declarada** em toda operação nova, dentro do catálogo fechado existente
- [ ] Nascimento do **contrato de tipos** que o frontend importará depois — interno nesta fase, não
      publicado · `[DELEGAR_TECH_SPEC]`

### 4.2 O que está explicitamente fora do escopo

- [ ] **Contrato de locação** e tudo que dele decorre — é a fatia seguinte desta mesma fase
- [ ] **Transição automática da situação do imóvel** (passar a locado ao ativar um contrato) — fatia seguinte
- [ ] **Cobrança, mora, documentos e carnê** — fase posterior
- [ ] **Integração bancária** — fase posterior
- [ ] **Automações e agendamento** — fase posterior
- [ ] **Máquina de verificação de e-mail e WhatsApp do locatário** (token, reenvios, registro de
      confirmação) — nasce na fase que a opera; aqui o locatário tem apenas contato simples
- [ ] **Código legível para estas entidades** — elas expõem identificador opaco; código legível existe
      apenas onde há série declarada (ADR-0017 e ADR-0015)
- [ ] **Exclusão definitiva de qualquer cadastro** — vedada pela ADR-0014
- [ ] **Publicação do contrato de tipos** para consumo externo — acontece no marco de entrega do backend
- [ ] **Qualquer código de frontend** — fronteira do repositório; é gatilho de parada
- [ ] **Painel do operador do SaaS** — feature própria, posterior

---

## 5. Usuários & Personas

- **Quem é o usuário principal?**
  O **Usuário Empresa** — quem opera as áreas de Imóveis e Cadastros no dia a dia da imobiliária.

- **Qual é seu objetivo ao usar essa feature?**
  Manter a carteira de imóveis fiel à realidade e ter à mão as pessoas com quem a imobiliária contrata,
  para montar contratos sem retrabalho.

- **Quais dores/dificuldades essa feature resolve pra ele?**
  Somar metragem à mão; descobrir tarde que cadastrou o mesmo locatário duas vezes; não conseguir tirar
  da frente um cadastro que não usa mais sem medo de perder histórico.

**Persona secundária** — o **Admin Empresa**: mesma superfície, mais a ação sensível de retirar cadastro
de circulação, que ele pode conceder ou retirar de cada pessoa da empresa.

**Fora desta feature** — o **Sysloc Master** não alcança dado de negócio de nenhuma empresa.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como Usuário Empresa, quero cadastrar um conjunto para agrupar os imóveis que administro sob
  o mesmo empreendimento.
- **US-02**: Como Usuário Empresa, quero cadastrar um imóvel com endereço, tipo e identificador municipal
  para tê-lo disponível na hora de contratar.
- **US-03**: Como Usuário Empresa, quero registrar os cômodos de um imóvel e ver a metragem total
  calculada sozinha, para não somar à mão nem errar a conta.
- **US-04**: Como Usuário Empresa, quero corrigir um cômodo isoladamente, para não ter de reenviar o
  imóvel inteiro por causa de um dado.
- **US-05**: Como Usuário Empresa, quero cadastrar locadores, locatários e fiadores com documento, contato
  e endereço, para usá-los na montagem de contratos.
- **US-06**: Como Usuário Empresa, quero ser avisado quando o documento informado é inválido ou já existe
  na minha empresa, para não criar cadastro duplicado.
- **US-07**: Como Admin Empresa, quero retirar de circulação um cadastro que não uso mais, para que ele
  pare de aparecer nas escolhas sem que eu perca o que já foi registrado com ele.
- **US-08**: Como Usuário Empresa, quero encontrar um cadastro retirado sob um filtro explícito e
  devolvê-lo à circulação, para desfazer um engano.
- **US-09**: Como Usuário Empresa, quero ver os conjuntos com seus imóveis e cômodos numa consulta só,
  para enxergar a carteira sem juntar informação de vários lugares.
- **US-10**: Como Admin Empresa, quero que quem não alcança a área correspondente não veja nem altere
  estes cadastros, e que retirar cadastro dependa de concessão própria.
- **US-11**: Como Admin Empresa, quero certeza de que nenhum cadastro da minha empresa é alcançável por
  outra empresa do produto.

---

## 6. Regras de Negócio (alto nível)

- **RN-01** — Todo cadastro pertence a exatamente uma Empresa e só é alcançável dentro dela. Referência
  entre cadastros de empresas diferentes não existe.
- **RN-02** — A metragem total de um imóvel é a soma das metragens dos seus cômodos. Cômodo sem metragem
  informada conta como zero. Imóvel sem cômodo tem metragem total zero.
- **RN-03** — O identificador municipal do imóvel é obrigatório e **não se repete dentro da mesma
  Empresa**. O mesmo identificador pode existir em empresas diferentes, porque duas imobiliárias podem
  administrar o mesmo imóvel.
- **RN-04** — O documento da pessoa (CPF ou CNPJ) é obrigatório, é conferido quanto à validade e **não se
  repete dentro da mesma Empresa**.
- **RN-05** — Nenhum cadastro é apagado. Excluir significa **retirar de circulação**, e o registro
  permanece recuperável (ADR-0014).
- **RN-06** — Cadastro retirado de circulação **nunca aparece** nas escolhas de criação de contrato;
  aparece na tela de cadastro apenas sob filtro explícito, e pode voltar à circulação.
- **RN-07** — Cômodo é detalhe do imóvel: nasce, muda e é retirado junto dele, e pode ser alterado
  individualmente. Toda alteração de cômodo reflete imediatamente na metragem total do imóvel.
- **RN-08** — Alcançar estes cadastros exige a área de tela correspondente; retirar cadastro de circulação
  exige, além disso, a ação sensível própria. Quem não tem, é recusado.
- **RN-09** — O locatário nasce com contato simples (e-mail e telefone). A verificação de e-mail e
  WhatsApp não pertence a esta fatia.
- **RN-10** — O imóvel tem situação de locação — disponível, locado ou indisponível — informada no
  cadastro. Nesta fatia ela **não muda sozinha**: a transição por contrato pertence à fatia seguinte.
- **RN-11** — Tipo de imóvel e tipo de pessoa são listas fechadas: imóvel é residencial, comercial ou
  misto; pessoa é física ou jurídica.
- **RN-12** — Todo cadastro é identificado por um identificador opaco. Estas entidades **não têm código
  legível** — ele existe apenas onde há série declarada, o que hoje é contrato e cobrança (ADR-0017).

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Usuário Empresa entra na área de Imóveis e cadastra um **conjunto**, dando-lhe um nome.
2. Cadastra um **imóvel** dentro desse conjunto: endereço completo, tipo, identificador municipal e
   situação de locação.
3. Acrescenta os **cômodos** do imóvel, cada um com nome e metragem. O sistema apresenta a **metragem
   total** já somada, sem que o usuário precise calculá-la.
4. Na área de Cadastros, registra as **pessoas** — locador, locatário, fiador — com documento, contato e
   endereço. Ao informar o documento, o sistema confere validade e repetição na empresa.
5. Consulta a carteira: os conjuntos aparecem com seus imóveis, e cada imóvel com seus cômodos e a
   metragem total.
6. Quando um cadastro deixa de ser usado, quem tem a ação sensível o **retira de circulação**: ele some
   das escolhas, sem que nada se perca.

### 7.2 Fluxos Alternativos

- Se o **identificador municipal já existe na empresa**, o sistema recusa o cadastro e indica o campo em
  conflito — sem impedir que outra empresa use o mesmo identificador.
- Se o **documento é inválido ou já existe na empresa**, o sistema recusa e indica qual dos dois problemas
  ocorreu, para o usuário saber se corrige ou se procura o cadastro que já existe.
- Se um **cômodo é informado sem metragem**, o sistema o aceita e o conta como zero na metragem total.
- Se o usuário procura um cadastro que **não encontra**, ele aciona o filtro de cadastros retirados; se o
  achar ali, pode devolvê-lo à circulação.
- Se a pessoa **não alcança a área** ou não tem a ação sensível, a operação é recusada, e a recusa informa
  o que faltou.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] **CA-01**: DADO um Usuário Empresa que alcança a área de imóveis QUANDO ele cadastra um conjunto com
      nome ENTÃO o conjunto passa a existir na empresa dele e aparece nas escolhas de imóvel.
- [ ] **CA-02**: DADO um conjunto existente QUANDO o usuário cadastra um imóvel com endereço completo,
      tipo, identificador municipal e situação de locação ENTÃO o imóvel é criado vinculado a esse
      conjunto.
- [ ] **CA-03**: DADO um imóvel já cadastrado com um identificador municipal QUANDO o usuário tenta
      cadastrar outro imóvel com o mesmo identificador **na mesma empresa** ENTÃO o cadastro é recusado
      com indicação do campo em conflito; e QUANDO a mesma tentativa parte de **outra empresa** ENTÃO o
      cadastro é aceito.
- [ ] **CA-04**: DADO um imóvel com cômodos de 25,5, 30,25 e 12 metros QUANDO o usuário consulta o imóvel
      ENTÃO a metragem total apresentada é 67,75.
- [ ] **CA-05**: DADO um imóvel cujos cômodos incluem um sem metragem informada QUANDO o usuário consulta
      o imóvel ENTÃO o cômodo consta com metragem zero e a metragem total é a soma dos demais; e DADO um
      imóvel sem nenhum cômodo ENTÃO a metragem total é zero.
- [ ] **CA-06**: DADO um imóvel com cômodos QUANDO o usuário altera a metragem de um único cômodo ENTÃO a
      alteração é aceita sem reenvio do imóvel e a metragem total passa a refletir o novo valor.
- [ ] **CA-07**: DADO um Usuário Empresa que alcança a área de cadastros QUANDO ele cadastra um locador,
      um locatário ou um fiador com documento válido, contato e endereço ENTÃO o cadastro passa a existir
      e aparece nas escolhas correspondentes.
- [ ] **CA-08**: DADO um cadastro de pessoa em preenchimento QUANDO o documento informado não é um CPF ou
      CNPJ válido ENTÃO o cadastro é recusado e a recusa indica o campo do documento.
- [ ] **CA-09**: DADO uma pessoa já cadastrada com um documento QUANDO o usuário tenta cadastrar outra
      pessoa com o mesmo documento **na mesma empresa** ENTÃO o cadastro é recusado indicando repetição;
      e QUANDO a mesma tentativa parte de **outra empresa** ENTÃO é aceito.
- [ ] **CA-10**: DADO um cadastro em circulação e um usuário com a ação sensível de excluir cadastro
      QUANDO ele retira esse cadastro de circulação ENTÃO o cadastro deixa de aparecer nas escolhas de
      criação e na listagem padrão, **sem ser apagado**.
- [ ] **CA-11**: DADO um cadastro retirado de circulação QUANDO o usuário aciona o filtro de retirados
      ENTÃO o cadastro aparece marcado como retirado; e QUANDO ele o devolve à circulação ENTÃO o cadastro
      volta a aparecer nas escolhas.
- [ ] **CA-12**: DADO uma pessoa que **não alcança** a área de imóveis ou de cadastros QUANDO ela tenta
      consultar ou alterar qualquer um destes cadastros ENTÃO a operação é recusada e a recusa informa o
      que faltou.
- [ ] **CA-13**: DADO uma pessoa que alcança a área de cadastros mas **não tem** a ação sensível de
      excluir cadastro QUANDO ela tenta retirar um cadastro de circulação ENTÃO a operação é recusada e o
      cadastro permanece em circulação.
- [ ] **CA-14**: DADO um cadastro existente na empresa A QUANDO uma pessoa da empresa B tenta consultá-lo,
      alterá-lo ou referenciá-lo ENTÃO ele não é alcançável, e a garantia não depende de conferência da
      aplicação.
- [ ] **CA-15**: DADO conjuntos, imóveis e cômodos cadastrados QUANDO o usuário consulta a carteira ENTÃO
      recebe, numa única consulta, cada conjunto com seus imóveis e cada imóvel com seus cômodos e a
      metragem total.
- [ ] **CA-16**: DADO qualquer consulta a estes cadastros QUANDO o consumidor recebe a resposta ENTÃO
      metragem chega como número, situação e tipo chegam como valores de uma lista fechada, e nenhum
      campo exige conversão de texto pelo consumidor.

---

## 9. Restrições & Considerações

- **Decisões arquiteturais vinculantes**: ADR-0008 (isolamento garantido pelo banco, sem conferência
  redundante na aplicação), ADR-0011 (toda operação governada declara sua exigência, e o padrão é negar),
  **ADR-0017** (forma do contrato da API e chave exposta em três classes — substituiu a ADR-0012),
  **ADR-0016** (o esquema é a fonte única do contrato), **ADR-0014** (cadastro nunca é apagado, com o
  cômodo fora do alcance) e **ADR-0015** (contador sequencial por empresa — nesta fatia, apenas como
  restrição de que estas entidades não têm série declarada e portanto expõem o identificador opaco).
- **Prova de equivalência da metragem**: existe um registro do comportamento do sistema antigo capturado
  previamente, e a implementação nova deve reproduzi-lo. É critério de aceitação da fase, não opcional.
- **Ambiente de verificação separado** (ADR-0006): a verificação nunca roda contra o ambiente que atende a
  operação.
- **Catálogo de permissões fechado**: a fatia não cria chave nova — usa as áreas e a ação sensível que já
  existem. Precisar de chave nova é sinal de escopo mal delimitado.
- **Terminologia**: o glossário de domínio do projeto é canônico. Termos novos desta feature (conjunto,
  imóvel, cômodo, locador, locatário, fiador, metragem total, identificador municipal, cadastro retirado
  de circulação) ficam registrados para canonização na etapa de validação da especificação técnica.
- **Retenção de dado pessoal**: como nada é apagado, documento, endereço e contato são retidos
  indefinidamente. Não há política de retenção ou anonimização declarada no projeto — dívida registrada
  na ADR-0014, a resolver quando houver política.
- **Fronteira do repositório**: nenhum código de frontend, em nenhuma hipótese.
- **Dependência de sequência**: a fatia seguinte (contratos) depende desta; nada aqui depende dela.

---

## 10. Métricas de Sucesso

- **Equivalência da metragem provada**: os 4 cenários capturados do sistema antigo — sem cômodo, um
  cômodo, vários cômodos, e vários com metragem nula — passam contra a implementação nova, incluindo o
  tratamento do valor sentinela. Alvo: **4 de 4**.
- **Isolamento provado**: as entidades novas são aprovadas pela verificação de cobertura existente, e a
  tentativa de alcançar cadastro de outra empresa é recusada sem depender de conferência da aplicação.
  Alvo: **nenhuma entidade fora do padrão, nenhuma tentativa cruzada bem-sucedida**.
- **Zero conversão de tipo no consumidor**: nenhum campo destes cadastros exige que o consumidor converta
  texto em número, data ou indicador. Alvo: **nenhum**.
- **Cobertura dos critérios de aceite**: todo critério de aceite tem caso de teste rastreado, e a suíte
  passa íntegra antes e depois da fatia, sem queda na contagem de casos. Alvo: **16 de 16 critérios
  rastreados**.

---

## 11. Roadmap / Fases

> Fases **internas desta fatia** — ordem de construção, não entregas separadas.

- **Fase 1 — Imóveis**: conjunto, imóvel e cômodos, com a metragem total calculada e provada contra o
  registro do sistema antigo. Inclui a unicidade do identificador municipal por empresa.
- **Fase 2 — Pessoas**: locador, locatário e fiador, com conferência de validade e de repetição do
  documento na empresa.
- **Fase 3 — Circulação e carteira**: retirada de circulação com volta possível, o filtro de retirados, e
  a consulta que devolve conjuntos, imóveis e cômodos de uma vez.

> A fatia seguinte da fase — contratos, com ativação e cancelamento — é PRD próprio, escrito quando esta
> fechar.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Cadastrar conjunto | CA-01 |
| US-02 | Cadastrar imóvel com identificador municipal | CA-02, CA-03 |
| US-03 | Cômodos com metragem total calculada | CA-04, CA-05 |
| US-04 | Corrigir um cômodo isoladamente | CA-06 |
| US-05 | Cadastrar locador, locatário e fiador | CA-07 |
| US-06 | Ser avisado de documento inválido ou repetido | CA-08, CA-09 |
| US-07 | Retirar cadastro de circulação | CA-10 |
| US-08 | Encontrar retirado sob filtro e devolvê-lo | CA-11 |
| US-09 | Ver a carteira numa consulta só | CA-15, CA-16 |
| US-10 | Exigir área de tela e ação sensível | CA-12, CA-13 |
| US-11 | Garantir isolamento entre empresas | CA-14 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-11)
- [x] Critérios de aceite claros (CA-01 a CA-16, em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum ID pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
