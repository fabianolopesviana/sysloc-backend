# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Cobrança e mora por empresa, com estado de fonte única no servidor
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-09
- **Versão**: v1
- **Status**: Draft
- **Relacionados**:
  - Discovery: `docs/specs/features/cobranca-mora-e-documentos/v1/pre-refinement.md` (fatia 1 de 2)
  - Fase: `docs/plano-backend-novo/plano-execucao.md` §F3 · briefing em `docs/plano-backend-novo/briefings/f3-cobranca-mora-e-documentos.md`
  - Referências capturadas do sistema antigo: `docs/specs/features/caracterizacao-regras-legadas/v1/golden/`
  - Decisões vinculantes: ADR-0008, ADR-0011, ADR-0014, ADR-0015, ADR-0016, ADR-0017, ADR-0018, ADR-0020, ADR-0021, ADR-0022
  - Fatia irmã (posterior): régua de cobrança e documentos do contrato

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** O produto novo já administra imóveis, pessoas e contratos de
  locação, mas **não cobra**. Toda a operação financeira da imobiliária continua no sistema antigo,
  que precisa ser desligado. Além disso, o estado de uma cobrança **não tem dono**: ele é decidido em
  três lugares diferentes que discordam entre si, a ponto de o sistema antigo conseguir cobrar por uma
  dívida que já foi cancelada. E a multa e os juros são **um só para todas as imobiliárias**, o que é
  incompatível com um produto que atende várias.
- **Como funciona atualmente?** A cobrança existe no sistema antigo. O estado dela é montado pela tela
  a cada leitura; uma rotina noturna escreve "vencida" nos registros; a multa e os juros são uma
  configuração global; e o valor da mora é gravado no momento em que incide. Uma cobrança de aluguel e
  uma conta de água se distinguem apenas pelo texto que alguém escreveu no campo de referência.
- **Por que isso precisa ser resolvido agora?** Por duas razões com prazo. **A primeira**: a fase
  seguinte (emissão de boleto) e a subsequente (automações agendadas) dependem de a cobrança existir —
  não há boleto sem cobrança. **A segunda, e mais urgente**: a maior peça da fase seguinte a esta —
  a régua que aciona o inadimplente — **não tem referência capturada do sistema antigo**, e a
  oportunidade de capturá-la se encerra quando o sistema antigo for desligado, sem possibilidade de
  reabertura.
- **Quem sofre o impacto do problema?** O **locatário**, que pode receber cobrança indevida; o
  **operador da imobiliária**, que não confia no estado que a tela mostra; a **imobiliária**, que não
  consegue ter política de mora própria; e o **projeto**, que perde o oráculo se demorar.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que a cobrança exista no produto novo como fato financeiro de uma
  empresa, com estado calculado pelo servidor a partir dos fatos registrados nela, mora apurada
  segundo a política da própria imobiliária, e nascendo automaticamente quando um contrato é ativado.
  E que a referência da régua fique capturada enquanto ainda é possível capturá-la.
- **Qual mudança de comportamento esta feature deve gerar?** Duas leituras do sistema nunca mais
  discordam sobre o estado de uma cobrança. Cada imobiliária define a própria multa e os próprios
  juros sem afetar as demais e sem alterar o que já foi quitado. Ativar um contrato deixa de exigir o
  lançamento manual de cada parcela. Nenhuma cobrança cancelada volta a ser tratada como devida.
- **Qual o resultado final esperado do ponto de vista do usuário?** O operador ativa um contrato e as
  parcelas do período inteiro aparecem prontas. Ele abre a carteira de cobranças e vê o mesmo estado
  que veria em qualquer outro lugar do sistema. Quando o locatário atrasa, o valor com mora já está
  calculado. Quando ele paga, o que foi cobrado fica registrado como foi cobrado.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] Capturar a referência executável da régua de cobrança do sistema antigo **sem enviar mensagem a
      ninguém**, antes que a oportunidade se encerre — inclusive a divergência de estado descrita na §2
- [ ] A cobrança como registro de uma empresa, **sempre vinculada a um contrato de locação**, com
      código legível próprio de série declarada por ano
- [ ] **Natureza** da cobrança em lista fechada (aluguel, água, condomínio, energia, outro) e
      **referência** descritiva livre, separadas
- [ ] Estado da cobrança **derivado dos fatos registrados** e idêntico em qualquer caminho de leitura
- [ ] Acusar pagamento e cancelar cobrança, cada um como operação própria
- [ ] Cobrança substituta após cancelamento
- [ ] **Multa e juros por empresa**, configuráveis por quem administra a imobiliária
- [ ] Mora apurada pelo servidor enquanto a cobrança está em aberto e **congelada no instante do
      pagamento**, junto da configuração vigente
- [ ] **Geração automática das parcelas de aluguel quando um contrato é ativado**, na mesma operação
- [ ] Cancelar um contrato cancela as cobranças dele que ainda podem ser canceladas
- [ ] Recusar, na entrada, valores de canal que o produto não implementa — os campos permanecem porque
      a tela os lê, mas o valor é rejeitado em vez de aceito em silêncio

### 4.2 O que está explicitamente fora do escopo

- [ ] **Emissão de boleto e baixa bancária** — fase seguinte. A cobrança nasce sem meio de recebimento,
      e a operação de emitir não existe nesta entrega
- [ ] **O anexo do boleto** — o único campo adicional que pertence à cobrança no sistema antigo é o
      arquivo do boleto, e ele acompanha a emissão, não esta fatia
- [ ] **A régua de cobrança em si** — esta fatia apenas **captura a referência** dela; portá-la é a
      fatia seguinte
- [ ] **O contrato em documento e o carnê** — fatia seguinte e fase seguinte, respectivamente
- [ ] **Envio de qualquer mensagem ao locatário** — nada nesta fatia sai para fora do sistema
- [ ] **Disparo por horário** — nenhuma rotina agendada pertence a esta entrega
- [ ] **Qualquer tela** — este repositório entrega apenas o servidor
- [ ] **Abrir o catálogo fechado de ações que exigem concessão própria** — decidido: nenhuma operação
      desta fatia é ação sensível

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **Usuário Empresa** que alcança a área de tela Financeiro — quem
  lança, acompanha, cancela e baixa as cobranças no dia a dia.
- **Qual é seu objetivo ao usar essa feature?** Saber, sem ambiguidade, quanto cada locatário deve
  hoje, e registrar o que foi recebido sem recalcular nada à mão.
- **Quais dores/dificuldades essa feature resolve pra ele?** Deixa de precisar conferir se a tela e o
  relatório concordam; deixa de lançar parcela por parcela ao ativar um contrato; deixa de calcular
  multa e juros por fora.

Personas secundárias:

- **Admin Empresa** — define a multa e os juros da própria imobiliária. Objetivo: que a política de
  mora da casa valha, e que mudá-la não bagunce o que já foi recebido.
- **Locatário** — não usa o sistema, mas **recebe o efeito**: é dele a dívida cujo valor esta feature
  calcula. Dor resolvida: não ser cobrado por algo já cancelado, e não receber conta com valor errado.
- **Equipe do projeto** — persona interna, presente por causa de um prazo que não se repete: é ela quem
  precisa da referência da régua antes do desligamento do sistema antigo.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como equipe do projeto, preciso capturar a referência executável da régua de cobrança do
  sistema antigo antes de ele ser desligado, para que o porte dela na fatia seguinte tenha oráculo.
- **US-02**: Como operador, quero que ativar um contrato gere as parcelas de aluguel de todo o período,
  para não lançar cada uma à mão nem esquecer nenhuma.
- **US-03**: Como operador, quero que o estado de uma cobrança signifique a mesma coisa em todo lugar
  do sistema, para que duas consultas nunca me digam coisas diferentes.
- **US-04**: Como operador, quero registrar cobranças que não são aluguel — água, condomínio, energia —,
  para cobrar tudo do locatário no mesmo lugar e saber depois quanto foi de cada coisa.
- **US-05**: Como operador, quero acusar o pagamento de uma cobrança, para que ela deixe de constar
  como devida e o que foi recebido fique registrado como foi.
- **US-06**: Como operador, quero cancelar uma cobrança lançada por engano e emitir uma substituta,
  para corrigir o lançamento sem apagar o histórico.
- **US-07**: Como Admin Empresa, quero definir a multa e os juros da minha imobiliária, para que a mora
  siga a minha política e não a de outra empresa do produto.
- **US-08**: Como operador, quero que o sistema calcule a mora de uma cobrança vencida, para não errar
  a conta nem precisar refazê-la a cada dia que passa.
- **US-09**: Como Admin Empresa, quero que mudar a multa alcance apenas o que ainda está em aberto,
  para que recibo já emitido continue valendo.
- **US-10**: Como operador, quero que cancelar um contrato cancele as cobranças dele que ainda podem
  ser canceladas, para não seguir cobrando por uma locação que acabou.

---

## 6. Regras de Negócio (alto nível)

- RN-01 -- Toda cobrança pertence a exatamente um contrato de locação, e o locatário dela é o do
  contrato. Não existe cobrança sem contrato, e não existe cobrança cujo locatário divirja do contrato.
- RN-02 -- Toda cobrança recebe, ao nascer, um código legível da série declarada dela, cujo escopo
  inclui o ano. O número nunca é reusado, e a sequência admite furo.
- RN-03 -- Toda cobrança tem uma **natureza**, escolhida de uma lista fechada, e uma **referência**
  descritiva livre. A natureza é do domínio e permite somar por tipo; a referência é rótulo.
- RN-04 -- O estado de uma cobrança é **derivado** dos fatos registrados nela — vencimento, pagamento e
  cancelamento — e é o mesmo em qualquer caminho de leitura do sistema. Nenhuma rotina agendada escreve
  o estado de uma cobrança.
- RN-05 -- Os estados possíveis são: a vencer, vencida, paga e cancelada. Uma cobrança está vencida
  quando a data de vencimento passou sem que ela tenha sido paga nem cancelada.
- RN-06 -- A ativação de um contrato gera, **na mesma operação**, as parcelas de aluguel de todo o
  período contratado. Se a ativação for recusada por qualquer motivo, nenhuma parcela passa a existir.
- RN-07 -- O dia de vencimento das parcelas é o declarado no contrato, e ele nunca ultrapassa o dia 28.
- RN-08 -- A mora de uma cobrança em aberto é apurada a cada leitura, a partir do vencimento, da data
  corrente e da configuração da empresa. Os juros são simples e proporcionais aos dias de atraso, e não
  incidem sobre a multa.
- RN-09 -- No instante em que o pagamento é acusado, a multa, os juros e a configuração vigente ficam
  registrados na cobrança e não mudam mais.
- RN-10 -- Alterar a multa ou os juros de uma empresa alcança apenas as cobranças **em aberto** dela.
  Não altera nenhuma cobrança paga nem cancelada.
- RN-11 -- Cada empresa tem a própria configuração de multa e juros, e a de uma nunca alcança outra.
- RN-12 -- Uma cobrança **nunca é apagada**. Cancelar é transição de estado e preserva o registro
  legível.
- RN-13 -- Cancelar um contrato cancela as cobranças dele que estejam a vencer ou vencidas, e não
  altera as pagas nem as já canceladas.
- RN-14 -- Acusar pagamento e cancelar cobrança exigem apenas o alcance da área de tela Financeiro.
  Nenhuma das duas é ação que exija concessão própria.
- RN-15 -- Acusar o pagamento de uma cobrança **não apaga** nenhuma informação de conciliação bancária
  já registrada nela. É divergência declarada em relação ao sistema antigo, que apaga.
- RN-16 -- O valor cobrado do locatário nunca difere em centavos do valor devido, em nenhuma
  composição de original, multa e juros.
- RN-17 -- Valores de canal de comunicação que o produto não implementa são **recusados na entrada**,
  com aviso, e nunca aceitos e ignorados.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

1. O Admin Empresa define a multa e os juros da imobiliária.
2. O operador ativa um contrato de locação já montado.
3. O sistema confere as condições de ativação e, aprovando, cria de uma vez as parcelas de aluguel de
   todo o período contratado — cada uma com a competência, o vencimento e o valor do contrato.
4. O operador abre a carteira de cobranças e vê cada uma com seu estado e, quando vencida, com a mora
   já calculada pela política da empresa.
5. O locatário paga. O operador acusa o pagamento, informando o que foi recebido.
6. O sistema registra o pagamento e congela ali a multa, os juros e a configuração que valia naquele
   instante.

### 7.2 Fluxos Alternativos

- **Cobrança que não é aluguel**: o operador registra uma cobrança avulsa para o mesmo contrato,
  escolhendo a natureza (água, condomínio, energia, outro) e descrevendo a referência.
- **Lançamento errado**: o operador cancela a cobrança e cria uma substituta. A cancelada permanece
  legível no histórico.
- **Ativação recusada**: se o contrato não atende às condições de entrada, o sistema recusa com o
  motivo e nenhuma parcela é criada.
- **Mudança de política**: se a multa da empresa muda, as cobranças em aberto passam a mostrar a mora
  nova; as pagas continuam exatamente como estavam.
- **Contrato cancelado**: as cobranças dele que estavam a vencer ou vencidas passam a canceladas; as
  pagas e as já canceladas ficam como estão.
- **Sem alcance à área Financeiro**: a operação é recusada, sem efeito algum.
- **Vencimento sem ação de ninguém**: passada a data, a cobrança consta como vencida na consulta
  seguinte, sem que nenhuma rotina precise ter sido executada.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] CA-01: DADO que o sistema antigo está de pé QUANDO a captura da régua de cobrança é executada
      ENTÃO os artefatos de referência dela ficam registrados, incluindo a divergência de estado entre
      os caminhos automático e manual, E nenhuma mensagem é enviada a qualquer destinatário.
- [ ] CA-02: DADO um contrato pronto para ativação, com prazo de N meses e dia de vencimento válido
      QUANDO ele é ativado ENTÃO passam a existir N parcelas de aluguel com as mesmas competências,
      vencimentos e valores que o sistema antigo produz para o mesmo contrato.
- [ ] CA-03: DADO um contrato que não atende às condições de ativação QUANDO a ativação é tentada
      ENTÃO ela é recusada com o motivo E nenhuma parcela passa a existir.
- [ ] CA-04: DADO uma cobrança qualquer QUANDO seu estado é obtido por qualquer caminho de leitura do
      sistema ENTÃO o valor é o mesmo em todos eles.
- [ ] CA-05: DADO uma cobrança cuja data de vencimento passou sem pagamento nem cancelamento QUANDO ela
      é consultada ENTÃO consta como vencida, sem que nenhuma rotina agendada tenha sido executada.
- [ ] CA-06: DADO um contrato vigente QUANDO o operador registra uma cobrança de natureza água com
      referência própria ENTÃO ela passa a existir vinculada àquele contrato E é distinguível das
      parcelas de aluguel pela natureza, sem depender de interpretar texto.
- [ ] CA-07: DADO uma cobrança vencida com mora apurada QUANDO o operador acusa o pagamento informando
      o valor recebido ENTÃO ela passa a constar como paga, com o valor e a data registrados.
- [ ] CA-08: DADO uma cobrança já paga QUANDO a multa da empresa é alterada ENTÃO a multa e os juros
      registrados nela permanecem exatamente os mesmos.
- [ ] CA-09: DADO uma cobrança a vencer QUANDO o operador a cancela ENTÃO ela passa a constar como
      cancelada, segue legível no histórico, E uma cobrança substituta pode ser criada para o mesmo
      contrato.
- [ ] CA-10: DADO uma cobrança QUANDO qualquer operação prevista é executada sobre ela ENTÃO ela nunca
      deixa de existir no sistema.
- [ ] CA-11: DADO duas empresas com multas diferentes QUANDO cobranças equivalentes vencem nas duas
      ENTÃO cada uma apura a mora pela configuração da própria empresa, sem interferência da outra.
- [ ] CA-12: DADO os casos de mora registrados como referência do sistema antigo QUANDO os mesmos dados
      são apurados no sistema novo ENTÃO a multa, os juros e o total coincidem centavo a centavo.
- [ ] CA-13: DADO uma cobrança vencida há 60 dias QUANDO a mora é apurada ENTÃO os juros são o dobro
      dos de 30 dias E a multa é a mesma dos 30 dias.
- [ ] CA-14: DADO uma cobrança em aberto QUANDO a multa da empresa é alterada ENTÃO a mora apresentada
      para ela passa a refletir a configuração nova.
- [ ] CA-15: DADO um contrato vigente com cobranças a vencer, vencidas, pagas e canceladas QUANDO o
      contrato é cancelado ENTÃO as a vencer e as vencidas passam a canceladas E as pagas e as já
      canceladas permanecem como estavam.
- [ ] CA-16: DADO uma cobrança com informação de conciliação bancária registrada QUANDO o pagamento é
      acusado ENTÃO nenhuma dessas informações é apagada.
- [ ] CA-17: DADO um operador que não alcança a área de tela Financeiro QUANDO ele tenta cancelar uma
      cobrança ou acusar pagamento ENTÃO a operação é recusada e nada muda.

---

## 9. Restrições & Considerações

**Prazo irreversível (a restrição que ordena a entrega):**

- A captura da referência da régua só é possível enquanto o sistema antigo estiver de pé, e o
  desligamento dele não é reversível. Por isso ela é o **primeiro** trabalho desta fatia, e não o
  último — mesmo que a régua só seja portada na fatia seguinte.
- O sistema antigo está **em produção e atendendo a operação**. Nada destrutivo pode ser feito nele; a
  captura acontece contra uma cópia descartável.
- A captura **não pode enviar mensagem a ninguém**. É pré-condição, não recomendação.

**Decisões do projeto que vinculam esta entrega:**

- O isolamento entre imobiliárias é garantido pelo armazenamento, não por conferência da aplicação —
  toda informação de negócio pertence a exatamente uma empresa (ADR-0008).
- O catálogo de áreas de tela e de ações que exigem concessão própria é **fechado**, e esta entrega
  **não o abre** (ADR-0011) — decisão tomada no discovery.
- Uma cobrança **nunca é apagada**, e a ADR-0014 vale para ela — a decisão dela nomeia a cobrança
  junto do contrato e dos cadastros. O que a ADR exige é que o registro não desapareça e continue
  legível para quem já o referencia, e é o que esta entrega faz: não existe operação de excluir
  cobrança, e cancelar é transição de estado (ADR-0021). Por não haver exclusão, também não há
  "retirada de circulação" a criar — a própria ADR deixa a cargo de cada entrega se essa marca
  existe e se aparece na API.
- O código legível vem de contador por empresa, com furo aceito e sem reuso (ADR-0015, ADR-0017,
  ADR-0020).
- O que se grava e o que se deriva num fato financeiro está decidido (ADR-0022): deriva-se enquanto
  aberto, grava-se no ato que liquida, junto da configuração vigente.
- Toda operação publicada declara o que exige, e a conferência é sobre o conteúdo da declaração
  (ADR-0018).
- A forma do que o sistema publica é derivada de uma definição única (ADR-0016).

**Dependências e fronteiras:**

- A fase seguinte (emissão de boleto) **depende desta**; esta **não depende dela**. A cobrança nasce
  sem meio de recebimento, e a operação de emitir não é publicada aqui.
- A fase de automações agendadas dá o gatilho de tempo; esta entrega não tem nenhum.
- Esta fatia **fecha uma pendência herdada**: hoje a ativação de contrato declara explicitamente que
  não gera cobranças, e essa declaração é fixa. Ela passa a gerar.

**Delegado à etapa técnica** `[DELEGAR_TECH_SPEC]`:

- Como o estado derivado é apresentado junto do registro sem que a apresentação vire fonte alternativa.
- Como o código legível da série é emitido sem colisão entre empresas.
- Como a captura registra o envio sem efetivá-lo.
- Como a apuração de mora evita perda de centavos em qualquer composição (RN-16).
- Se a marca de pagamento confirmado do sistema antigo sobrevive, dado que a data de pagamento já
  responde à mesma pergunta.

**Consideração de UX (a comunicar, não a implementar aqui):** mudar a multa passa a alterar o valor
apresentado de todas as cobranças em aberto. É comportamento novo, e sem aviso o operador pode lê-lo
como erro.

---

## 10. Métricas de Sucesso

Esta fatia cria o dado e não muda nada que o usuário final veja de imediato — por isso adoção não mede
nada aqui. As três medidas abaixo são as que, se falharem, invalidam a entrega:

1. **Equivalência de mora**: os casos de mora registrados como referência do sistema antigo reproduzem
   centavo a centavo no sistema novo — sem exceção e sem arredondamento tolerado.
2. **Equivalência de geração**: ativar um contrato produz exatamente as mesmas parcelas que o sistema
   antigo produz para o mesmo contrato, incluindo o comportamento do dia de vencimento no limite de 28.
3. **Oráculo garantido**: a referência da régua de cobrança existe, foi capturada antes do prazo, e
   **nenhuma mensagem foi enviada** durante a captura.

---

## 11. Roadmap / Fases

Fases **dentro desta fatia**, na ordem em que o prazo e as dependências as impõem:

- **Fase 1 — Capturar a referência da régua.** Primeira por prazo, não por dependência: nada mais nesta
  fatia depende dela, mas ela é a única coisa que deixa de ser possível se demorar.
- **Fase 2 — A cobrança e o estado.** O registro, o vínculo com o contrato, o código legível, a natureza
  e a referência, e o estado derivado com significado único.
- **Fase 3 — Mora por empresa.** A configuração por imobiliária, a apuração enquanto em aberto e o
  congelamento no pagamento.
- **Fase 4 — Nascer da ativação.** A geração das parcelas na mesma operação da ativação do contrato, e
  o cancelamento em cadeia quando o contrato é cancelado.

A fatia seguinte (fora deste PRD) porta a régua e o contrato em documento.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Capturar a referência da régua antes do desligamento | CA-01 |
| US-02 | Ativar contrato gera as parcelas do período | CA-02, CA-03 |
| US-03 | Estado da cobrança com significado único | CA-04, CA-05 |
| US-04 | Cobranças que não são aluguel, distinguíveis por natureza | CA-06 |
| US-05 | Acusar pagamento e registrar o recebido | CA-07, CA-16, CA-17 |
| US-06 | Cancelar lançamento errado e emitir substituta | CA-09, CA-10, CA-17 |
| US-07 | Multa e juros da própria imobiliária | CA-11 |
| US-08 | Mora calculada pelo sistema | CA-12, CA-13 |
| US-09 | Mudar a multa não altera o que já foi pago | CA-08, CA-14 |
| US-10 | Cancelar contrato cancela as cobranças canceláveis | CA-15 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-10)
- [x] Critérios de aceite claros (CA-01 a CA-17, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum ID pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
