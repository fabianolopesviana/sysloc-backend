# PRD -- Product Requirements Document (O QUE / POR QUÊ)

## 1. Metadados
- **Nome da Feature/Projeto**: Documentos e confirmação — o contrato em PDF derivado do dado no
  instante do pedido, e a confirmação do endereço de e-mail do locatário por link que não se forja
- **Responsável/Autor**: sysloc (neuberagil@icloud.com)
- **Data**: 2026-08-12
- **Versão**: v1
- **Status**: Aprovado (pelo usuário, em 2026-08-12)
- **Relacionados**:
  - Discovery: `docs/specs/features/documentos-e-confirmacao/v1/pre-refinement.md`
    (**sub-fatia 2b de 2 — fecha a Fase 3**)
  - Discovery partilhado da fatia 2: `docs/specs/features/regua-e-documentos/v1/pre-refinement.md`
    — permanece intacto; o acima o especializa
  - Fase: `docs/plano-backend-novo/plano-execucao.md` §F3 · briefing em
    `docs/plano-backend-novo/briefings/f3-fatia2b-documentos-e-confirmacao.md`
  - Sub-fatia irmã (concluída em 2026-08-12): `docs/specs/features/regua-de-cobranca/v1/` — dela vêm
    o precedente de *automático + reenvio manual* e o método de *divergência declarada par a par*
  - Fatia dona do agregado Contrato: `docs/specs/features/contratos-de-locacao/v1/` — dona também do
    débito **D36**, que esta feature fecha
  - Referências capturadas do sistema antigo:
    `docs/specs/features/caracterizacao-regras-legadas/v1/golden/` — em especial
    `contrato-pdf.txt` e `contrato-pdf-fonte.py` (11º artefato), e `contrato-cancelamento.json`
  - Decisões vinculantes: ADR-0008, ADR-0011, ADR-0016, ADR-0017, ADR-0018, ADR-0021, ADR-0022,
    ADR-0023, ADR-0024, **ADR-0027** (quando um ato de negócio dispensa sessão) e **ADR-0028**
    (o que o contrato publica para uma resposta que não é texto estruturado)

---

## 2. Contexto & Motivação

- **Qual problema ou dor existe hoje?** Duas dores, e elas só parecem uma porque saem pelo mesmo
  lugar — o que o sistema entrega para fora. **A primeira**: o contrato em PDF do sistema antigo é um
  **arquivo guardado**. Ele nasce quando o contrato é salvo, fica anexado ao registro, e recebe a
  marca de cancelamento por mesclagem sobre os próprios bytes quando o contrato é cancelado.
  Documento guardado **envelhece em relação ao dado**: o registro muda, o arquivo não. **A segunda**:
  a confirmação do endereço de e-mail do locatário existe, mas **o segredo dela é forjável** — não é
  sorteado, não é protegido no armazenamento, e o identificador do locatário que ele deveria proteger
  viaja no próprio link.
- **Como funciona atualmente?** No sistema antigo, salvar um contrato gera o documento e o anexa ao
  registro; cancelar o contrato lê os bytes guardados, aplica a marca "CANCELADO" sobre eles e
  regrava o arquivo. Por isso **existe uma pré-condição medida**: contrato sem documento **não pode
  ser cancelado** — não porque o negócio exija, mas porque a marca precisa de bytes para marcar.
  Quanto ao e-mail, o sistema envia ao locatário um link que carrega o identificador dele e um
  segredo composto pelo próprio identificador somado ao instante do envio; a comparação é por
  igualdade com o valor guardado em claro.
- **Por que isso precisa ser resolvido agora?** Por três razões, e duas têm prazo. **A primeira**: é a
  **última sub-fatia da Fase 3**, e sem ela a fase não fecha. **A segunda**: a leitura do sistema
  antigo termina na virada, e os caminhos do documento que o oráculo atual não cobre — contrato com
  fiador, locatário pessoa jurídica, parte sem documento de identidade — só existem enquanto o
  sistema antigo estiver de pé. Janela que fecha e não reabre. **A terceira**: o modelo novo carrega
  hoje uma referência a arquivo que a virada vai apagar — quanto mais tempo ela fica, mais leitores
  arrisca ganhar.
- **Quem sofre o impacto do problema?** O **operador da imobiliária**, que não confia no documento que
  baixa e não consegue cancelar um contrato quando falta o arquivo; o **locatário**, cujo endereço é
  "confirmado" por um mecanismo que não confirma nada e cujo link, se vazar, entrega mais do que
  deveria; e o **operador da plataforma**, que carrega no produto uma referência pendurada e um
  segredo fraco com data marcada.

---

## 3. Objetivo da Feature

- **O que se deseja alcançar?** Que o contrato em PDF passe a ser **composto a partir do dado no
  instante em que é pedido**, com o estado de cancelamento aparecendo por composição do próprio
  documento; e que o endereço de e-mail do locatário passe a ser confirmado por um mecanismo que
  **não pode ser forjado**, com prazo de validade e uso único.
- **Qual mudança de comportamento esta feature deve gerar?** Deixa de existir documento armazenado —
  e, com ele, some a pré-condição *"sem documento, não cancela"*, o que fecha o **D36 por
  construção**. O que o operador baixa passa a ser, sempre, o retrato do cadastro naquele segundo. O
  link de confirmação passa a carregar um segredo sorteado, que expira, que morre ao ser consumido, e
  que o sistema não guarda de forma que permita reconstruí-lo.
- **Qual o resultado final esperado do ponto de vista do usuário?** O operador baixa o contrato e
  reconhece nele o que acabou de cadastrar, inclusive quando o contrato foi cancelado. O locatário
  recebe um e-mail, clica uma vez e vê o endereço confirmado — e, se clicar de novo por engano ou se
  o provedor dele abrir o link antes, continua vendo sucesso, não erro.

---

## 4. Escopo

### 4.1 O que está incluído (dentro do O QUE)

- [ ] **Captura, no sistema antigo, dos caminhos do documento que o oráculo atual não cobre** —
      contrato com fiador, locatário pessoa jurídica, parte sem documento de identidade. É trabalho
      **com prazo**, condicionado à existência de contratos reais que exercitem cada caminho; nada é
      escrito no sistema antigo para fabricá-los
- [ ] **Documento do contrato composto sob demanda**, a partir do dado gravado, sem arquivo
      armazenado em nenhum momento
- [ ] **Marca de cancelamento composta na geração** do documento de um contrato cancelado — nunca
      aplicada sobre documento pronto
- [ ] **Fim da pré-condição de documento no cancelamento** — fecha o **D36** por construção
- [ ] **O modelo deixa de guardar referência a arquivo de documento**, e ela some também do que o
      produto publica
- [ ] **Veredito escrito ANTES da execução** sobre os dois cenários de cancelamento capturados
      (*sem documento* e *sem imóvel*), com a divergência declarada correspondente
- [ ] **Documento acessível apenas a quem alcança a área Contratos**, na empresa dona do contrato
- [ ] **Confirmação de endereço de e-mail com o defeito fechado**: segredo sorteado, guardado de
      forma que não permita reconstruí-lo, verificado sem revelar informação pelo tempo da
      verificação, **válido por 72 horas** e **de uso único**
- [ ] **Reapresentação do mesmo link dentro da validade responde sucesso**, sem alterar nada — o que
      impede que uma pré-visualização de provedor de e-mail queime o link antes do locatário
- [ ] **Disparo automático quando o endereço é cadastrado ou alterado**, mais **reenvio manual** pelo
      operador que alcança a área Cadastros
- [ ] **A confirmação é ato sem sessão**, praticado pelo titular do dado portando o segredo
- [ ] **Estado de confirmação visível no cadastro do locatário**, e **estritamente informativo** — não
      altera quem recebe Aviso
- [ ] **Prova por igualdade sobre texto normalizado** contra o oráculo, com a normalização
      **declarada, fechada e provada por falsificação**
- [ ] **Prova por composição** de cada bloco do documento, mais ao menos um caso de documento inteiro
- [ ] **Registro explícito, no artefato**, de que o link aponta para uma página que **não existe neste
      repositório** — ela é da Fase 6, e entra no handoff
- [ ] **Superfície medida por dupla medição independente** — 3 rotas novas sobre as 86 atuais, com a
      partição sem declaração permanecendo vazia

### 4.2 O que está explicitamente fora do escopo

- [ ] **Qualquer linha de frontend, inclusive a página que recebe o link de confirmação** — a
      Fronteira do projeto; task que peça frontend é gatilho de parada
- [ ] **O carnê** — Fase 4: a fonte de cada página é o boleto emitido
- [ ] **Emissão de boleto e baixa bancária** — Fase 4
- [ ] **O gatilho de tempo da régua e a tela de saúde** — Fase 5
- [ ] **Canal WhatsApp** — recusa declarada, não omissão
- [ ] **Histórico auditável de tentativas de confirmação** — adiado: seria o terceiro registro sem
      política de retenção, e entra junto com ela
- [ ] **Retenção e expurgo de registros** — Fase 7
- [ ] **Limitador de taxa na rota sem sessão** — depende de origem confiável, que só existe depois da
      publicação atrás do servidor de borda (Fase 7); a mitigação desta entrega é uso único mais prazo
- [ ] **Entregar o documento ao locatário**, por link próprio ou anexo — adiado; o critério nasce
      largo o bastante para acomodá-lo depois sem emenda
- [ ] **Guardar cópia do documento composto para reaproveitamento** — adiado; entra sem mudar o que o
      produto promete, se a composição se mostrar cara sob carga
- [ ] **Qualquer alteração no que a sub-fatia irmã entregou** — régua, política de aviso, registro de
      envio e elegibilidade permanecem exatamente como foram provados
- [ ] **Publicação do pacote de contrato para o frontend** — item do marco de entrega

---

## 5. Usuários & Personas

- **Quem é o usuário principal?** O **operador da imobiliária** — pede o documento do contrato,
  cancela contratos, cadastra e corrige o endereço do locatário, e reenvia a confirmação quando a
  mensagem não chega.
- **Persona secundária**: o **locatário** — é alcançado **fora do sistema**, por e-mail, e age **sem
  sessão e sem nunca ter uma**. É esta persona que faz a feature atravessar a fronteira do ato sem
  sessão.
- **Persona terciária**: o **operador da plataforma** — responde pelo que sobra no produto quando o
  sistema antigo é desligado, e pelo que o handoff precisa carregar.
- **Qual é seu objetivo ao usar essa feature?** Ter um documento em que se possa confiar sem
  conferir, e um endereço de contato que valha alguma coisa quando o sistema precisar avisar.
- **Quais dores/dificuldades essa feature resolve pra ele?** Documento que discorda do cadastro;
  cancelamento travado por falta de arquivo; endereço "confirmado" por um segredo que qualquer um
  reconstrói.

### 5.1 Histórias de Usuário (User Stories)

- **US-01**: Como operador da plataforma, quero **capturar do sistema antigo os caminhos do documento
  que ainda não têm oráculo** para que a tradução tenha contra o que ser provada depois que o sistema
  antigo for desligado.
- **US-02**: Como operador da imobiliária, quero **baixar o contrato em PDF e reconhecer nele o que
  está cadastrado agora** para não precisar conferir campo a campo antes de usar o documento.
- **US-03**: Como operador da imobiliária, quero que **o documento de um contrato cancelado saia
  visivelmente marcado como cancelado** para que ninguém o use como se valesse.
- **US-04**: Como operador da imobiliária, quero **cancelar um contrato sem depender de existir
  documento** para que o cancelamento dependa só das condições do negócio.
- **US-05**: Como operador da plataforma, quero que **o produto não guarde referência a arquivo
  nenhum do sistema antigo** para que a virada não deixe ponteiros apontando para o vazio.
- **US-06**: Como operador da plataforma, quero que **o documento só alcance quem é da empresa dona do
  contrato e tem a área Contratos** para que um documento jurídico não vaze entre imobiliárias.
- **US-07**: Como locatário, quero **confirmar meu endereço de e-mail por um link que só eu recebi**
  para que ninguém confirme meu endereço no meu lugar nem descubra meus dados a partir do link.
- **US-08**: Como operador da imobiliária, quero que **a confirmação saia sozinha quando eu cadastro
  ou corrijo o endereço** para que a verificação não dependa de eu lembrar de disparar.
- **US-09**: Como operador da imobiliária, quero **reenviar a confirmação quando a mensagem não
  chega** para não ficar sem saída quando o e-mail se perde.
- **US-10**: Como operador da imobiliária, quero **ver no cadastro se o endereço está confirmado**
  para saber em quais contatos posso confiar — sem que isso mude quem recebe Aviso.
- **US-11**: Como operador da plataforma, quero que **o crescimento desta entrega seja medido** —
  rotas e verificações — para que a superfície possa ser congelada com confiança no marco de entrega.

---

## 6. Regras de Negócio (alto nível)

- RN-01 — O documento do contrato é **composto no instante do pedido**, a partir do dado gravado. O
  sistema **não guarda** documento gerado, e não existe estado em que documento e cadastro possam
  discordar.
- RN-02 — O documento de um contrato **cancelado** sai com a **marca de cancelamento**; o de um
  contrato em qualquer outro estado sai sem ela. A marca é parte da composição, nunca algo aplicado
  sobre um documento já pronto.
- RN-03 — **Cancelar um contrato não depende de existir documento.** O cancelamento confere apenas as
  condições do negócio.
- RN-04 — **Contrato sem imóvel é estado que não existe** no produto: a impossibilidade é garantida
  pelo próprio armazenamento, e não por conferência da aplicação. A recusa que o sistema antigo
  produzia nesse cenário **não é portada**, e isso é divergência declarada.
- RN-05 — O documento do contrato é acessível **apenas a quem alcança a área Contratos**, e **apenas
  na empresa dona do contrato**. Não existe caminho sem sessão para o documento.
- RN-06 — O endereço de e-mail do locatário tem **estado de confirmação** — confirmado ou não
  confirmado. O estado é **informativo**: não decide quem recebe Aviso, nem em que canal.
- RN-07 — **Cadastrar ou alterar** o endereço de e-mail do locatário deixa o estado como **não
  confirmado** e **dispara a confirmação automaticamente**.
- RN-08 — O link de confirmação é **válido por 72 horas** contadas do envio.
- RN-09 — O link é de **uso único**: consumi-lo o encerra, e **reenviar invalida todos os anteriores**
  daquele locatário.
- RN-10 — **Reapresentar o mesmo link dentro da validade responde sucesso** e não altera coisa
  alguma. Fora da validade, é recusado como qualquer link vencido.
- RN-11 — O segredo do link é **sorteado**; o que o sistema guarda **não permite reconstruí-lo**; e a
  verificação **não revela informação pelo tempo que leva**. O identificador do locatário **não
  circula como parte do segredo**. `[DELEGAR_TECH_SPEC]` — a escolha do mecanismo e da medida de
  imprevisibilidade é decisão técnica.
- RN-12 — Confirmar o endereço **dispensa sessão**: é ato do próprio titular do dado, praticado com
  portador de segredo. O contexto de empresa vem **do que já está gravado**, nunca do que chega no
  pedido.
- RN-13 — **Disparar ou reenviar** a confirmação manualmente exige alcançar a **área Cadastros**. Não
  há concessão nova: o catálogo de ações sensíveis permanece fechado.
- RN-14 — Uma **recusa** de link — inválido, vencido ou já encerrado fora da validade — **não revela
  qual dos casos ocorreu** e **não altera** o estado do endereço.
- RN-15 — Toda diferença entre o documento composto pelo produto e o oráculo capturado é
  **divergência declarada, com veredito escrito antes da execução**. Divergência descoberta durante a
  execução é falha de método, não resultado.
- RN-16 — Nenhuma verificação do produto alcança destinatário real, e nenhuma escreve no sistema
  antigo.

---

## 7. Fluxo Comportamental (não técnico)

### 7.1 Fluxo Principal

**A — O documento do contrato**

1. O operador, autenticado, abre um contrato da sua imobiliária e pede o documento.
2. O sistema compõe o documento naquele instante, a partir do que está cadastrado: as partes
   qualificadas conforme sejam pessoa física ou jurídica, com ou sem documento de identidade, com ou
   sem fiador; em seguida as cláusulas; em seguida o encerramento.
3. Se o contrato estiver cancelado, o documento sai com a marca de cancelamento visível.
4. O operador recebe o documento pronto para salvar ou imprimir.

**B — A confirmação do endereço do locatário**

1. O operador cadastra um locatário com endereço de e-mail, ou corrige o endereço de um locatário
   existente.
2. O sistema marca o endereço como não confirmado e envia ao locatário uma mensagem com um link
   próprio, válido por 72 horas.
3. O locatário abre o link, fora do sistema, sem ter conta nem sessão.
4. O sistema confirma o endereço e encerra aquele link.
5. O operador passa a ver, no cadastro do locatário, que o endereço está confirmado.

### 7.2 Fluxos Alternativos

- **A mensagem não chega ao locatário** → o operador que alcança a área Cadastros reenvia a
  confirmação. O link anterior deixa de valer no mesmo ato.
- **O locatário abre o mesmo link duas vezes, ou o provedor dele o abre antes** → dentro das 72 horas,
  o sistema responde sucesso e não altera nada.
- **O locatário abre o link depois de 72 horas** → o sistema recusa, sem dizer se o link venceu, se
  nunca existiu ou se já foi usado, e o endereço permanece não confirmado.
- **O locatário troca de endereço depois de já ter confirmado** → o endereço novo nasce não
  confirmado, e uma confirmação nova sai sozinha.
- **O contrato pedido não é da empresa de quem pede, ou quem pede não alcança a área Contratos** → o
  documento não é entregue.
- **O contrato nunca teve documento no sistema antigo e precisa ser cancelado** → o cancelamento
  acontece normalmente.
- **Não existem, no sistema antigo, contratos reais que exercitem algum dos caminhos ainda sem
  oráculo** → a ausência é **medida e registrada**, e aquele caminho segue provado por composição,
  sem oráculo externo. Nada é criado no sistema antigo para produzi-lo.

---

## 8. Critérios de Aceite (O QUE deve acontecer)

- [ ] CA-01: DADO que o sistema antigo está de pé QUANDO os caminhos do documento ainda sem oráculo
      são procurados entre os contratos reais ENTÃO cada caminho encontrado é capturado como
      referência versionada, e cada caminho **não** encontrado fica registrado como ausência medida,
      sem que nada seja criado no sistema antigo para produzi-lo.
- [ ] CA-02: DADO um contrato cujo cadastro foi alterado depois da última vez que o documento foi
      pedido QUANDO o operador pede o documento de novo ENTÃO o documento reflete a alteração, sem
      qualquer ato intermediário de regeneração.
- [ ] CA-03: DADO os contratos de referência capturados do sistema antigo QUANDO os mesmos dados são
      submetidos ao produto novo ENTÃO o texto do documento é **igual** ao da referência sob a
      normalização declarada, e toda diferença remanescente consta da lista de divergências **escrita
      antes da execução** — nenhuma descoberta durante ela.
- [ ] CA-04: DADO um contrato cancelado e outro em vigor QUANDO o documento de cada um é pedido ENTÃO
      o do contrato cancelado sai com a marca de cancelamento e o do contrato em vigor sai sem ela.
- [ ] CA-05: DADO um contrato que nunca teve documento gerado no sistema antigo QUANDO o operador o
      cancela ENTÃO o cancelamento acontece — o que **diverge** do sistema antigo, que recusava, e a
      divergência está declarada como correção deliberada.
- [ ] CA-06: DADO o cenário de referência de contrato sem imóvel QUANDO ele é confrontado com o
      produto novo ENTÃO fica registrado que o estado é **irrepresentável** no produto, e que nenhuma
      recusa equivalente é oferecida pela aplicação.
- [ ] CA-07: DADO qualquer contrato QUANDO o produto o apresenta ENTÃO não há, nem no que se publica
      nem no que se guarda, referência a arquivo de documento.
- [ ] CA-08: DADO um operador de outra imobiliária, e um operador da mesma imobiliária que não alcança
      a área Contratos, e um pedido sem sessão QUANDO cada um deles pede o documento de um contrato
      ENTÃO nenhum dos três o recebe.
- [ ] CA-09: DADO um locatário sendo cadastrado com endereço de e-mail, e outro tendo o endereço
      corrigido QUANDO o cadastro é gravado ENTÃO os dois endereços ficam como não confirmados e uma
      confirmação sai para cada um, sem que o operador precise pedir.
- [ ] CA-10: DADO um locatário com confirmação pendente QUANDO o operador que alcança a área Cadastros
      reenvia a confirmação ENTÃO um link novo é enviado e o link anterior deixa de ser aceito; e
      QUANDO quem não alcança a área tenta reenviar, o reenvio não acontece.
- [ ] CA-11: DADO um locatário com confirmação pendente e o link que ele recebeu QUANDO o link é
      apresentado dentro das 72 horas, sem sessão ENTÃO o endereço passa a constar como confirmado.
- [ ] CA-12: DADO um link já usado uma vez QUANDO ele é apresentado de novo dentro das 72 horas ENTÃO
      a resposta é de sucesso e nada no cadastro é alterado por essa segunda apresentação.
- [ ] CA-13: DADO um link enviado há mais de 72 horas QUANDO ele é apresentado ENTÃO ele é recusado, o
      endereço permanece não confirmado, e a recusa não distingue link vencido de link inexistente.
- [ ] CA-14: DADO o valor que o sistema guarda para verificar o link QUANDO ele é apresentado como se
      fosse o próprio segredo ENTÃO é recusado — e nenhum segredo válido pode ser derivado do que está
      guardado.
- [ ] CA-15: DADO dois locatários de empresas diferentes, cada um com o seu link QUANDO o link de um é
      apresentado ENTÃO só o endereço do dono daquele link é confirmado, sem que o pedido informe de
      que empresa se trata.
- [ ] CA-16: DADO um locatário com endereço confirmado e outro com endereço não confirmado, ambos com
      cobrança passível de aviso QUANDO o trabalho de avisar é executado ENTÃO **os dois** são
      avisados exatamente como antes desta entrega, e o cadastro de cada um exibe o seu estado de
      confirmação.
- [ ] CA-17: DADO a superfície publicada pelo produto QUANDO ela é medida por dois caminhos
      independentes ENTÃO os dois chegam ao mesmo total, o total é de **3 rotas novas** sobre as 86
      anteriores, e nenhuma rota fica sem declaração de quem pode alcançá-la.
- [ ] CA-18: DADO a suíte de verificação do projeto QUANDO ela é executada por pacote antes e depois
      da entrega ENTÃO nenhum pacote encolhe, nenhuma verificação alcança destinatário real e nenhuma
      escreve no sistema antigo.

---

## 9. Restrições & Considerações

- **Fronteira do projeto**: nada de frontend. A página que recebe o link de confirmação **não existe
  neste repositório** — ela é da Fase 6, será implementada fora daqui, e o que esta entrega deve
  ao frontend é o registro explícito disso no handoff. Task que peça frontend é **gatilho de parada**.
- **Janela que fecha**: a captura de referências novas só é possível enquanto o sistema antigo estiver
  de pé, e a virada o desliga. Por isso ela vai **primeiro**, e por isso a premissa que a condiciona
  — existirem contratos reais cobrindo cada caminho — precisa ser **medida antes de ser registrada**,
  não estimada.
- **Nada é escrito no sistema antigo.** Ele atende a operação real. A leitura é autenticada e não
  destrutiva; fabricar contratos para completar cobertura está fora de questão.
- **A sub-fatia irmã está fechada e provada.** Régua, política de aviso, registro de envio e
  elegibilidade não se alteram. A escolha de manter a confirmação **informativa** existe exatamente
  para que esta entrega não toque naquilo.
- **A rota sem sessão nasce sem limitador de taxa**, porque a origem confiável do pedido só existe
  depois da publicação atrás do servidor de borda (Fase 7). A mitigação desta entrega é **uso único
  mais prazo de 72 horas**, que não depende do que falta.
- **Decisões vinculantes**: as ADRs listadas nos metadados, com destaque para as duas nascidas deste
  discovery — o critério para um ato de negócio dispensar sessão, e o que o produto publica para uma
  resposta que não é texto estruturado.
- **Protocolo Antirregressão** vale para toda edição: medição antes e depois, nenhuma prova
  enfraquecida, e código sob decisão fechada é intocável.
- **Terminologia**: o glossário do projeto já usa **Carimbo** com outro sentido — o valor financeiro
  que passa a ser gravado no instante do ato. Por isso este PRD chama de **marca de cancelamento** o
  que o sistema antigo chamava de carimbo no documento. `[DELEGAR_TECH_SPEC]` — canonizar o termo é
  trabalho da etapa de challenge.
- **Remover a referência a arquivo do modelo depende de uma condição a verificar antes de planejar**:
  se o trecho de definição que a contém já foi aplicado a um banco que não pode ser recriado.
  `[DELEGAR_TECH_SPEC]` — a verificação é pré-condição, não detalhe de implementação.
- **A composição do documento é assumida barata o bastante** para dispensar reaproveitamento nesta
  versão. Se a carga mostrar o contrário, o reaproveitamento entra depois sem alterar o que o produto
  promete.
- **Canal WhatsApp permanece recusado**, e a recusa é declarada, não omissão.

---

## 10. Métricas de Sucesso

As quatro medem pontas distintas, e nenhuma exige instrumentação nova — todas saem de artefatos que a
execução já produz:

1. **Divergência zero não prevista.** Toda diferença entre o documento composto e o oráculo tem
   veredito escrito **antes** da execução. Meta: **nenhuma** divergência descoberta durante o run. É
   o método que fez a sub-fatia irmã fechar com uma única divergência, e ele mede a qualidade do
   diagnóstico, não a do código.
2. **Documento sempre coerente com o cadastro.** Nenhum pedido devolve conteúdo que discorde do dado
   gravado no instante do pedido — medido como **ausência de qualquer documento armazenado** no
   produto. É a dor nº 1, e ela ou é zero ou não foi resolvida.
3. **Segredo de confirmação não forjável.** As três falhas medidas no sistema antigo — segredo
   previsível, guardado de forma reconstruível e identificador viajando junto — ficam **todas**
   fechadas, cada uma com prova que reprova se o defeito voltar.
4. **Crescimento medido e sob controle.** As 3 rotas novas sobre as 86 anteriores confirmadas por
   **dupla medição independente**, partição sem declaração vazia, e suíte crescendo de forma
   monotônica por pacote a partir de 1004 casos.

---

## 11. Roadmap / Fases

O corte entre as fases 2 e 3 é o mesmo já nomeado como corte natural desta sub-fatia — **documento ×
confirmação de e-mail**, que não se tocam em nenhum ponto.

- **Fase 1 — A janela que fecha**: procurar e capturar, no sistema antigo, os caminhos do documento
  ainda sem oráculo; registrar como ausência medida o que não existir. Vai primeiro por ter prazo.
- **Fase 2 — O documento**: composição do contrato a partir do dado, com as partes qualificadas
  resolvidas uma única vez e as cláusulas compondo sobre o resultado; marca de cancelamento por
  composição; fim da pré-condição de documento no cancelamento; remoção da referência a arquivo;
  acesso restrito à área Contratos na empresa dona.
- **Fase 3 — A confirmação**: estado de confirmação do endereço; segredo sorteado, com prazo e uso
  único; disparo automático no cadastro e reenvio manual; o ato sem sessão do locatário.
- **Fase 4 — O fecho da Fase 3**: equivalência com o oráculo com os vereditos escritos antes;
  medição da superfície por dois caminhos independentes; registro, para o handoff, da página que não
  existe aqui.

---

## 12. Rastreabilidade de User Stories

| User Story | Descrição Resumida | Critério de Aceite Relacionado |
|------------|-------------------|-------------------------------|
| US-01 | Capturar os caminhos do documento sem oráculo antes do desligamento | CA-01 |
| US-02 | Documento que reflete o cadastro no instante do pedido | CA-02, CA-03 |
| US-03 | Contrato cancelado sai visivelmente marcado | CA-04 |
| US-04 | Cancelar sem depender de documento | CA-05, CA-06 |
| US-05 | Produto sem referência a arquivo do sistema antigo | CA-07 |
| US-06 | Documento só para a empresa dona e para quem alcança Contratos | CA-08 |
| US-07 | Locatário confirma por link que só ele recebeu | CA-11, CA-12, CA-13, CA-14, CA-15 |
| US-08 | Confirmação disparada sozinha no cadastro do endereço | CA-09 |
| US-09 | Reenvio manual quando a mensagem não chega | CA-10 |
| US-10 | Estado de confirmação visível e informativo | CA-16 |
| US-11 | Crescimento da superfície e da suíte medido | CA-17, CA-18 |

---

## 13. Checklist Final
- [x] PRD descreve apenas O QUE / POR QUÊ
- [x] Escopo fechado
- [x] User Stories definidas e numeradas (US-01 a US-11)
- [x] Critérios de aceite claros (CA-01 a CA-18, todos em DADO/QUANDO/ENTÃO)
- [x] Tabela de rastreabilidade preenchida — nenhuma US órfã, nenhum CA órfão, nenhum ID pulado
- [x] Pronto para criar o TECH_SPEC (COMO)
