# Tech Alignment — Contratos de locação

## 1. Metadados

- **Feature**: `contratos-de-locacao` · **Versão**: `v1` · **Framework**: SDD · **Variante**: `backend`
- **Documento de definição**: `docs/prds/features/contratos-de-locacao/v1/prd.md`
- **Discovery lido**: `docs/specs/features/contratos-de-locacao/v1/pre-refinement.md` ·
  `docs/plano-backend-novo/briefings/f2-fatia2-contratos-de-locacao.md`
- **ADRs consultadas (texto integral, não a linha-resumo)**: **0006**, **0008**, **0011**, **0013**,
  **0014**, **0015**, **0016**, **0017**, **0018**, **0019**
- **Molde herdado**: `docs/specs/features/cadastro-de-imoveis-e-pessoas/v1/` (fatia 1, concluída) —
  schema `negocio`, portas de dados em `packages/db`, unidade de trabalho na borda,
  `@sysloc/contracts` como fonte única, catálogo fechado de permissões
- **Data**: 2026-08-08 · **Status**: decidido

---

## 2. Contexto técnico

A fatia acrescenta ao schema de negócio a primeira entidade com **ciclo de vida governado** e a
primeira com **série declarada** — duas propriedades que nenhuma das seis entidades da fatia 1 tem, e
para as quais, portanto, não existe molde a imitar. Tudo o mais é incremento sobre o que já está de
pé: isolamento pelo banco (`empresa_id`, RLS forçada, chave estrangeira composta), exigência
declarada por rota, esquema como fonte única do contrato publicado.

Três invariantes novos nascem aqui e precisam de mecanismo, não de disciplina:

1. **Um imóvel não tem dois contratos vigentes** — a propriedade que a RN-09 enuncia, e que hoje não
   tem onde ser recusada;
2. **O número da série nunca é reusado, e criações concorrentes não esperam umas pelas outras** —
   as duas metades da ADR-0015, que se excluem sob o mecanismo mais óbvio;
3. **O estado tem fonte única, decidida pelo servidor** — a ADR-0019 já fixou a *forma* (transição é
   rota própria governada por ação sensível); resta a representação e o que cada transição escreve.

A fatia carrega ainda uma dependência externa que nenhuma anterior tinha em execução: as duas regras
portadas só são verificáveis contra o sistema antigo, que existe até a fase de virada. Isso torna a
**arquitetura da prova** — como o oráculo é capturado e por onde ele entra na suíte — decisão
técnica desta fatia, e não detalhe de teste.

---

## 3. Soluções técnicas decididas

### D1 — Emissão do número da série

**Por que decidir**: a ADR-0015 exige, ao mesmo tempo, que criações concorrentes **não esperem umas
pelas outras** e que o número **nunca seja reusado, nem por criação abortada**. As duas cláusulas
juntas eliminam o mecanismo mais natural, e nada equivalente existe no repositório hoje.

**Solução escolhida: A2 — contador do próprio banco, com escopo (empresa, ano), consumido fora da
semântica transacional da criação.**

Caminhos avaliados:

- **A1 — linha de contador em tabela de negócio, incrementada e lida na mesma transação da criação.**
  - _Exemplo:_ o contrato nasce lendo e somando um na linha do par (empresa, ano), tudo dentro do
    mesmo commit que grava o contrato e os fiadores.
  - _Prós:_ é o mais simples de todos; reusa integralmente o molde da fatia 1 (tabela de negócio com
    isolamento, guarda de cobertura, valor inicial trivialmente parametrizável); nenhum privilégio
    novo; nenhuma criação de objeto em tempo de execução.
  - _Contras:_ **viola as duas cláusulas da ADR-0015 de uma vez**. A linha fica travada até o commit,
    de modo que a segunda criação concorrente espera pela primeira — que é literalmente a alternativa
    *"sequência densa, sem furo"* rejeitada por escrito naquela ADR. E, sobretudo, o desfazimento da
    transação **devolve o número**, que o contrato seguinte reusa: some a estabilidade da referência
    citada fora do sistema, que é a razão inteira de o código legível existir.
  - _Viabilidade:_ conflita com ADR ativa em cláusula explícita. Só seria adotável emendando ou
    substituindo a ADR-0015 — nunca em silêncio.
- **A2 — contador do banco por escopo, cujo avanço não participa do desfazimento (recomendada).**
  - _Exemplo:_ duas criações simultâneas na mesma empresa obtêm números distintos sem que nenhuma
    espere; a que aborta deixa o número consumido para sempre, exatamente como os 19 furos que o
    sistema antigo já tem.
  - _Prós:_ cumpre a `Decision` da ADR-0015 ao pé da letra, nas duas metades; o furo passa a ser
    consequência do mecanismo, e não uma promessa que alguém precisa manter; o valor inicial continua
    parametrizável, o que é o que a fase de virada exige para poder continuar a série do sistema
    antigo sem renumerar nada.
  - _Contras:_ o objeto de contador é **por (empresa, ano)**, e portanto nasce em tempo de execução —
    o que exige um ponto de criação idempotente e um privilégio que o papel da aplicação **não tem
    hoje** (ele só alcança leitura e escrita de tabela). Resolver isso alargando o privilégio do papel
    da aplicação é inaceitável: ele passaria a poder criar tabela no schema de negócio, contornando a
    guarda de cobertura que reprova tabela sem isolamento. A saída é concentrar a criação num ponto
    de banco com privilégio próprio e auditável, que a tech spec desenha.
  - _Viabilidade:_ requer duas coisas novas na infraestrutura de dados — a concessão de uso do
    contador ao papel da aplicação e o ponto único de criação idempotente. Ambas cabem no molde de
    migração vigente (gerada + parceira autoral de segurança).
- **A3 — um contador por empresa, sem reinício anual, com o ano apenas no texto do código.**
  - _Exemplo:_ o último contrato de 2026 sai `…-00020` e o primeiro de 2027 sai `…-00021`.
  - _Prós:_ um único objeto por empresa, criado quando a empresa é admitida; nenhuma criação em tempo
    de execução; some o problema de privilégio.
  - _Contras:_ contraria o escopo que a ADR-0015 declara para esta série (*"o contrato inclui o ano no
    escopo"*) e o comportamento medido no sistema antigo, onde a numeração reinicia a cada ano. O
    usuário reconhece o primeiro contrato do ano pelo número baixo.
  - _Viabilidade:_ mais barata, e descartada por divergir do dado medido e do texto da ADR.

**Trade-off aceito**: paga-se complexidade de infraestrutura (um privilégio a conceder e um ponto de
criação idempotente) para comprar a estabilidade da referência e a ausência de contenção. O volume
real — o sistema antigo emitiu 20 contratos num ano — **não** foi usado como argumento a favor da
serialização, porque a cláusula que A1 quebra de forma irreparável é a do não-reuso, e essa independe
de volume.

---

### D2 — Como um imóvel passa a ter contrato vigente, e como o segundo é recusado

**Por que decidir**: a RN-09 e a RN-17 exigem duas coisas relacionadas — recusar a segunda ativação
sobre o mesmo imóvel, e apresentar nas consultas de imóvel qual contrato o ocupa. O sistema antigo
resolve as duas com um campo denormalizado no imóvel, que a fatia 1 deliberadamente **não** criou.

**Solução escolhida: B2 — a vigência é propriedade do contrato, e a recusa da segunda é uma restrição
de unicidade condicionada ao estado ativo; a apresentação no imóvel é derivada por leitura.**

Caminhos avaliados:

- **B1 — campo no imóvel apontando para o contrato vigente, como no sistema antigo.**
  - _Exemplo:_ ativar grava o apontamento no imóvel; cancelar o apaga; a consulta do imóvel lê o
    apontamento sem tocar o contrato.
  - _Prós:_ leitura barata na consulta de imóvel; é a forma que o sistema antigo já tem, o que reduz
    surpresa na virada.
  - _Contras:_ cria **duas fontes** do mesmo fato — o estado do contrato e o apontamento do imóvel —,
    que divergem no primeiro caminho de escrita que esquecer uma delas. É exatamente a classe de
    defeito que a ADR-0017 fecha ao exigir estado calculado pelo servidor, e que o PRD nomeia como a
    dor de origem. E a recusa da segunda ativação continuaria dependendo de uma leitura condicional
    escrita na aplicação, que é janela de corrida disfarçada de validação — desenho que este
    repositório já recusou por escrito na unicidade do identificador municipal.
  - _Viabilidade:_ tecnicamente possível; conflita com a doutrina de fonte única estabelecida.
- **B2 — unicidade condicionada ao estado, com a vigência derivada (recomendada).**
  - _Exemplo:_ a tentativa de ativar um segundo contrato sobre o imóvel ocupado é recusada **pelo
    banco**, e não por um `if` que leu antes; a consulta do imóvel obtém o contrato vigente por
    leitura em lote, no mesmo molde com que a carteira de imóveis já monta cômodos e imóveis sem
    consulta por linha.
  - _Prós:_ torna a dupla locação **irrepresentável**, que é a mesma escolha estrutural do isolamento
    entre empresas (recusa do banco, não conferência da aplicação); nenhum estado a reconciliar;
    a recusa é imune a concorrência sem serializar nada.
  - _Contras:_ a apresentação do contrato vigente custa uma leitura a mais nas consultas de imóvel, e
    o cuidado com a consulta por linha passa a valer também aqui. O molde de leitura em lote da fatia
    1 já resolve isso e é reusável sem invenção.
  - _Viabilidade:_ reusa integralmente o que existe. A situação de locação do imóvel continua sendo
    escrita pelos atos de ativação e cancelamento, no campo que a fatia 1 entregou com entrada
    assimétrica deliberada — **essa assimetria não se unifica** (ver §5).
- **B3 — guarda por leitura seguida de gravação condicional na aplicação.**
  - _Exemplo:_ ativar lê se há contrato ativo para o imóvel e, não havendo, grava.
  - _Prós:_ nenhum objeto novo no banco.
  - _Contras:_ entre a leitura e a gravação, outra transação ativa o segundo contrato e as duas
    passam. É o defeito que o cabeçalho da porta de imóveis descreve com todas as letras.
  - _Viabilidade:_ descartada — contraria desenho já fixado e provado neste repositório.

**Trade-off aceito**: uma leitura a mais nas consultas de imóvel, em troca de um invariante que não
depende de ninguém lembrar de mantê-lo.

---

### D3 — Qual identificador o contrato expõe na superfície

**Decisão direta** — determinada pela ADR-0017, cuja `Decision` é literal: *"a chave exposta é o
código textual legível quando a entidade tem uma série declarada para ela — hoje contrato e
cobrança"*, com o UUID permanecendo chave interna que não trafega. Não há leque a abrir: o contrato é
identificado, na superfície, pelo código legível; as entidades que ele referencia continuam expondo
UUID, porque nenhuma delas tem série.

Duas consequências que a tech spec herda, e não redecide: o esquema de identificador do contrato é
**próprio** — o esquema de UUID compartilhado não serve, e copiá-lo com outra forma criaria a segunda
definição que a ADR-0016 fecha; e a canonização de caixa acontece num ponto único, pela mesma razão
medida que produziu a canonização do UUID na fatia anterior.

---

### D4 — Onde mora o núcleo local das regras portadas, e por onde o oráculo entra

**Por que decidir**: as duas regras portadas são o item de maior risco da fatia, e o PRD as sujeita a
uma prova de equivalência contra o sistema antigo. Onde a regra mora decide se essa prova é barata e
falsificável ou cara e frouxa.

**Solução escolhida: C2 — as derivações como funções puras, provadas diretamente contra o oráculo; as
validações e os efeitos no serviço, provados pela rota; captura por extensão do roteiro existente.**

Caminhos avaliados:

- **C1 — tudo no serviço de aplicação, provado só pela rota.**
  - _Exemplo:_ a aritmética da data de fim é exercitada subindo banco efêmero, criando empresa,
    imóvel, pessoas e contrato, e ativando por HTTP.
  - _Prós:_ um caminho só; nenhuma camada nova.
  - _Contras:_ cada cenário do oráculo passa a custar uma montagem inteira de mundo. Com dezenas de
    cenários de virada de mês, a suíte fica lenta e — pior — a prova de falsificação obrigatória
    (reintroduzir o defeito e ver o caso reprovar) fica cara o bastante para ser feita por amostragem.
  - _Viabilidade:_ funciona; encarece exatamente a prova que a fatia existe para produzir.
- **C2 — derivações puras + efeitos no serviço (recomendada).**
  - _Exemplo:_ a data de fim e o valor total são funções sem dependência de banco, exercitadas caso a
    caso contra o oráculo capturado; a recusa por imóvel ocupado, a mudança de estado e o efeito no
    imóvel continuam provados pela rota, com banco real.
  - _Prós:_ o eixo que o oráculo discrimina — aritmética — é provado onde é barato provar e barato
    falsificar; o eixo que exige mundo real continua com mundo real. Segue o precedente medido da
    soma de metragens, que é função pura publicada com nome justamente para que a afirmação *"há um
    ponto único"* seja verificável.
  - _Contras:_ um módulo a mais, e a disciplina de não deixar a regra vazar de volta para o serviço.
  - _Viabilidade:_ nenhuma tecnologia nova; é o desenho que o repositório já usa.
- **C3 — reimplementar a regra e conferir por leitura do código antigo, sem oráculo.**
  - _Contras:_ o comportamento de virada de mês **não está** no arquivo que se leria — mora na
    biblioteca do sistema antigo. É a razão registrada no pré-refinamento para capturar o oráculo, e
    não se reabre aqui.
  - _Viabilidade:_ descartada no discovery.

**Sobre a captura**: ela **estende o roteiro existente** — o script de captura, o preparo de site
efêmero e o verificador de golden já existem, já produzem manifesto de procedência com máscaras
verificadas por bijeção, e o script já monta contrato hospedeiro. Escrever um segundo caminho de
captura criaria duas convenções de golden no mesmo repositório. Consequência a tratar com cuidado: os
artefatos são de uma fatia **fechada**, então a extensão é acréscimo sob o Protocolo Antirregressão —
nenhum cenário existente muda de forma, e a bijeção manifesto ↔ golden continua verificável.

---

### D5 — A aritmética da data de fim

**Por que decidir**: a derivação depende do comportamento de virada de mês para início em 29, 30 ou
31 — que o PRD nomeia explicitamente no critério de aceite e que decide a data de fim de uma fração
não desprezível dos contratos reais.

**Solução escolhida: E1 — calcular na aplicação, com o ajuste de fim de mês explícito no código.**

Caminhos avaliados:

- **E1 — cálculo na aplicação (recomendada).**
  - _Exemplo:_ início em 31 de janeiro com prazo de um mês produz a data que o oráculo registrar, e o
    caso que a prova reprova quando o ajuste é removido.
  - _Prós:_ o comportamento fica **escrito e legível** no ponto onde a regra vive; a falsificação é
    trivial (remover o ajuste faz o caso reprovar); a função é pura, o que a D4 já exige.
  - _Contras:_ reimplementa uma aritmética que o banco também sabe fazer.
  - _Viabilidade:_ sem dependência nova — a operação é elementar e não justifica biblioteca de datas.
- **E2 — delegar ao banco, usando a aritmética de intervalo do servidor.**
  - _Exemplo:_ a data de fim sai calculada dentro da própria instrução que grava a ativação.
  - _Prós:_ menos código; o servidor já ajusta o fim de mês.
  - _Contras:_ a equivalência com o sistema antigo passaria a depender de **duas** bibliotecas de
    terceiros coincidirem — a do sistema antigo e a do banco —, e a coincidência é conveniência, não
    contrato. Além disso a regra deixaria de ser exercitável sem banco, encarecendo justamente a
    prova de D4.
  - _Viabilidade:_ funciona hoje; amarra a corretude a um detalhe que ninguém declarou.
- **E3 — biblioteca de datas de terceiros.**
  - _Contras:_ dependência nova para uma operação de poucas linhas; e o comportamento de ajuste
    continuaria vindo de fora, com o mesmo problema de E2.
  - _Viabilidade:_ descartada por excesso.

**Trade-off aceito**: escrever uma aritmética que já existe pronta em dois lugares, para que o
comportamento seja **declarado por nós** e provado contra o oráculo, em vez de herdado por acaso.

---

### D6 — Representação do dinheiro e derivação do valor total

**Por que decidir**: é a primeira fatia com dinheiro de verdade, e o invariante 4 do projeto fixa a
representação persistida. O que resta decidir é a representação **no contrato da API** e a forma da
multiplicação que produz o valor total — e é a multiplicação que traz risco, porque acumulação em
ponto flutuante já produziu defeito medido neste repositório.

**Solução escolhida: F1 — o mesmo desenho já validado para a metragem: número com escala declarada na
entrada e teto derivado da capacidade da coluna, com a derivação feita em unidades inteiras de
centavo.**

Caminhos avaliados:

- **F1 — número com escala e teto declarados; derivação em centavos inteiros (recomendada).**
  - _Exemplo:_ um valor com três casas decimais é recusado na entrada em vez de ser silenciosamente
    arredondado ao ser gravado; e o valor total de um contrato longo sai exato, sem resíduo binário
    viajando na resposta.
  - _Prós:_ reusa integralmente a doutrina já medida e documentada da metragem — inclusive a razão de
    a escala valer na **entrada** e não na saída; um só vocabulário numérico na superfície; nenhuma
    conversão nova do lado do consumidor.
  - _Contras:_ exige lembrar que toda aritmética de dinheiro passa por unidade inteira — disciplina
    que só é segura se a derivação tiver ponto único, como a soma de metragens tem.
  - _Viabilidade:_ zero tecnologia nova; o precedente está escrito, com os números que o motivaram.
- **F2 — dinheiro como texto decimal na superfície.**
  - _Exemplo:_ o valor mensal trafega como cadeia de caracteres, exatamente como o driver do banco o
    entrega.
  - _Prós:_ elimina o ponto flutuante da superfície por construção.
  - _Contras:_ rompe com a forma que a fatia 1 fixou para a outra grandeza decimal do produto; empurra
    a conversão para o consumidor, que é o frontend que a migração existe para preservar; e a
    comparação com o oráculo passaria a exigir normalização de texto.
  - _Viabilidade:_ defensável isoladamente; incoerente com o que já está publicado.
- **F3 — inteiro de centavos na superfície.**
  - _Contras:_ obriga o consumidor a dividir por cem em toda exibição, e é forma que nenhum artefato
    do projeto usa hoje.
  - _Viabilidade:_ descartada por divergir do modelo de domínio que o frontend já fala.

---

### D7 — Como os fiadores são informados e alterados

**Por que decidir**: o repositório tem um precedente de coleção filha — o cômodo, que ganhou
sub-recurso com rotas próprias. A pergunta é se ele se aplica, e o PRD exige que o contrato nasça
**num único envio** com os fiadores indicados.

**Solução escolhida: G1 — os fiadores são coleção do corpo do contrato, com substituição integral.**

Caminhos avaliados:

- **G1 — coleção no corpo, substituída por inteiro (recomendada).**
  - _Exemplo:_ criar um contrato com dois fiadores é um envio; trocar um deles enquanto rascunho é
    reenviar a lista completa, no mesmo molde do corpo completo que a fatia 1 fixou para alteração.
  - _Prós:_ atende diretamente o critério do envio único; a imutabilidade após a ativação cai da
    regra do **pai** (contrato só se altera enquanto rascunho), sem precisar de regra própria em
    cada rota de sub-recurso; e o vínculo é puro — sem atributos e sem histórico —, então não há nada
    que só um sub-recurso saberia expressar.
  - _Contras:_ um contrato com muitos fiadores reescreve a coleção inteira a cada correção. Sem teto
    declarado, é custo teórico: o sistema antigo não impõe limite e o contrato real tem zero.
  - _Viabilidade:_ reusa o desenho de corpo completo já publicado.
- **G2 — sub-recurso próprio, no molde do cômodo.**
  - _Exemplo:_ acrescentar e remover fiador seriam operações próprias sobre o contrato.
  - _Prós:_ granularidade de escrita; alinhamento superficial com um precedente do repositório.
  - _Contras:_ **o precedente não se aplica**, e a diferença é de natureza: o cômodo é editável
    durante todo o ciclo do imóvel e tem atributos próprios (metragem, posição atribuída pelo
    servidor); o fiador é vínculo sem atributo algum, cuja janela de edição é o estado do pai.
    Rotas próprias multiplicariam superfície e obrigariam cada uma a reimplementar a mesma guarda de
    estado.
  - _Viabilidade:_ possível, mais cara, sem ganho identificável.

---

### D8 — Onde a referência a cadastro fora de circulação é recusada

**Por que decidir**: a chave estrangeira composta impede referência **entre empresas**, e não
referência a registro **retirado de circulação** — são propriedades diferentes. E as portas de leitura
por identificador da fatia 1 alcançam o retirado **de propósito**, para que a recirculação seja
possível; logo a conferência não acontece por acidente.

**Solução escolhida: H1 — conferência explícita na borda, por leitura sob a política com o predicado
de circulação, tanto ao montar quanto ao fazer valer; a recusa toma a forma de erro de campo, e não
de recurso inalcançável.**

Caminhos avaliados:

- **H1 — conferência na borda, com predicado explícito (recomendada).**
  - _Exemplo:_ montar um contrato apontando para um locatário retirado é recusado nomeando qual
    cadastro está fora de circulação — que é o que o critério de aceite pede.
  - _Prós:_ reusa a porta de leitura com predicado que a fatia 1 já entregou; a recusa carrega a
    informação que decide o que o usuário faz em seguida, no mesmo molde do discriminador de conflito
    já publicado; e o sentido inverso permanece livre, como a ADR-0014 exige.
  - _Contras:_ é conferência de aplicação, e portanto tem de estar em **todos** os caminhos que
    referenciam — montagem e ativação. O ponto único de conferência é o que fecha a classe.
  - _Viabilidade:_ nenhum mecanismo novo; atenção ao fato de que as portas por identificador não
    filtram circulação, o que torna a conferência deliberada e visível.
- **H2 — impor no banco, por restrição.**
  - _Exemplo:_ o banco recusaria a linha que apontasse para cadastro retirado.
  - _Prós:_ irrepresentável, como o isolamento.
  - _Contras:_ chave estrangeira não sabe condicionar-se ao estado do pai, e a alternativa (gatilho)
    introduziria um segundo lugar onde regra de negócio vive, contra o desenho vigente. Pior: a
    restrição valeria **para sempre**, e retirar de circulação um cadastro já referenciado por
    contrato passaria a ser recusado — exatamente a recusa por vínculo que a ADR-0014 elimina.
  - _Viabilidade:_ conflita com ADR ativa; descartada.
- **H3 — recusar tratando o cadastro retirado como inexistente.**
  - _Contras:_ mentiria sobre o estado — o registro existe, é alcançável e pode ser devolvido à
    circulação —, e o usuário ficaria sem a informação que resolve a situação.
  - _Viabilidade:_ descartada por degradar a recusa.

---

### D9 — Como a ativação declara o que **não** efetivou

**Por que decidir**: o critério de aceite exige que a resposta da ativação diga explicitamente que as
cobranças não foram geradas, em vez de sugerir sucesso completo. Isso é forma de contrato, e a F3
herda o que for decidido aqui.

**Solução escolhida: I2 — a resposta da ativação é o recurso no root acrescido de uma declaração de
efeito fechada, cujo valor é hoje constante e passa a variar na fase que gerar cobrança.**

Caminhos avaliados:

- **I1 — nada na resposta; a documentação declara.**
  - _Prós:_ nenhum campo a manter.
  - _Contras:_ não satisfaz o critério, que fala da **resposta**; e documentação não chega a quem
    consome o corpo.
  - _Viabilidade:_ descartada.
- **I2 — declaração de efeito no corpo da ativação (recomendada).**
  - _Exemplo:_ a ativação responde o contrato como ele ficou e, junto, a afirmação de que nenhuma
    cobrança foi gerada nesta etapa.
  - _Prós:_ mantém a resposta de sucesso no root, como a ADR-0017 exige; a declaração fica **no
    esquema**, e portanto no documento derivado, sem prosa escrita à mão; e, sendo o valor fechado
    nesta fatia, a fase que passar a gerar cobrança é **obrigada** a tocar o contrato para afrouxá-lo —
    a mudança aparece no diff em vez de acontecer por omissão.
  - _Contras:_ é campo que só existe nesta transição, o que torna a resposta da ativação levemente
    diferente da leitura do contrato.
  - _Viabilidade:_ reusa a composição de esquemas do pacote de contratos; nada novo.
- **I3 — campo permanente no recurso do contrato.**
  - _Prós:_ uma forma só em toda leitura.
  - _Contras:_ afirma sobre o contrato algo que é da **operação**, e obrigaria toda consulta a
    responder por um fato que ainda não tem produtor. Inventa atributo de domínio para resolver
    problema de resposta.
  - _Viabilidade:_ descartada por confundir as camadas.

---

## 4. Candidatas a ADR

- **Mecanismo de emissão de número de série (D1)** — candidata **confirmada**: é transversal (a
  cobrança da F3 tem série própria e herdará o mecanismo), cai em `data`/`architecture`, tem custo de
  reversão alto (trocar o mecanismo depois exige renumerar ou conviver com duas séries), é
  surpreendente sem contexto (um leitor futuro perguntará por que não se usou a tabela óbvia) e tem
  trade-off real e registrado. A ADR-0015 decide a **política** — escopo, furo, não-reuso — e não o
  mecanismo; é essa lacuna que a candidata preenche.

  ```bash
  /agent-spec-adr-create "mecanismo de emissão do número de série por empresa e ano"
  ```

- **Vigência única por imóvel (D2)** — candidata **parcial**: transversal e de custo de reversão alto,
  mas é aplicação direta de um princípio que o projeto já tem canonizado (recusa estrutural em vez de
  conferência de aplicação, ADR-0008) a um caso novo. Registrar ADR para ela é churn enquanto não
  houver um segundo caso que a generalize.

Nenhuma outra decisão deste documento é transversal — as demais são feature-scoped ou corolário de
ADR já aceita.

---

## 5. Restrições e invariantes técnicas

Herdadas, e vinculantes para qualquer implementação:

1. **Isolamento é do banco** — `empresa_id`, RLS forçada e chave estrangeira composta em toda tabela
   nova, sob a guarda de cobertura existente; **nenhum filtro por empresa escrito na aplicação**
   (ADR-0008). A referência do contrato a imóvel e pessoas é composta, e é ela que torna o cruzamento
   entre empresas impossível.
2. **Migração gerada e migração autoral nunca convivem no mesmo arquivo** — tabela nova em `negocio`
   leva parceira autoral própria com `FORCE` e políticas, nunca acréscimo às existentes.
3. **A unidade de trabalho abre na borda**; serviços recebem o executor e não abrem unidade própria; o
   marcador que recusa aninhamento não é tocado.
4. **Toda instrução SQL vive na porta de dados da entidade**, publicada como função de domínio — não
   no serviço de aplicação.
5. **Toda rota governada declara exigência, e a declaração no método substitui a da classe** — logo a
   rota que exige ação sensível declara a **conjunção inteira** (área e ação), nesta ordem
   (ADR-0011, ADR-0018). O catálogo é fechado e **já contém** as três chaves desta fatia; nenhuma
   permissão nova é criada.
6. **O esquema é a fonte única do contrato**, e o documento publicado é derivado dele (ADR-0016).
   Nenhum esquema compartilhado é redigitado — importa-se.
7. **Transição de estado é rota própria governada**, nunca campo em atualização parcial (ADR-0019).
   Retirada de circulação é ortogonal ao estado: não transita nada e não libera o imóvel.
8. **Dinheiro em `numeric(15,2)`**, nunca ponto flutuante na persistência (invariante 4).
9. **A assimetria da situação de locação do imóvel não se unifica.** A entrada da API aceita duas
   situações e o domínio tem três, porque a terceira é produzida **só** pelos atos desta fatia. É
   decisão fechada da fatia 1, com prova dedicada; "simplificar" isso é regressão de decisão.
10. **A suíte nunca executa contra o ambiente que atende a operação** (ADR-0006). A captura do
    oráculo lê o sistema antigo por cópia e trabalha em ambiente efêmero; nada é alterado lá.
11. **O formato do código legível tem cinco dígitos**, contra os quatro que o plano de execução e as
    instruções do repositório escrevem. A divergência é conhecida, o cinco é o medido, e convém que o
    ponto do código que fixa o formato carregue a razão — para que uma revisão futura não o
    "corrija".
12. **Nada de frontend** — fronteira do repositório, gatilho de parada.

---

## 6. Pontos em aberto

**Técnicos — a critério do arquiteto do TECH_SPEC:**

- O ponto exato de criação do contador de D1 e o desenho do privilégio que a torna possível sem
  alargar o papel da aplicação; e o comportamento quando duas criações concorrem na **primeira**
  emissão de um escopo ainda inexistente.
- A forma do esquema de identificador do contrato (D3) e onde a canonização de caixa acontece.
- Quantas consultas a apresentação do contrato vigente acrescenta às consultas de imóvel (D2), e se a
  leitura em lote cobre também a consulta agregada da carteira.
- Se a extensão do roteiro de captura (D4) exige tocar o verificador de golden existente, e como a
  bijeção entre manifesto e artefatos permanece verificável com os cenários novos.
- O teto de valor aceito na entrada de dinheiro (D6): derivá-lo da capacidade da coluna, como a
  metragem faz, ou declarar teto de domínio menor — que seria requisito novo, e portanto precisa de
  fonte.

**Dependências de produto — não decididas aqui:**

- **Retenção de dado.** O contrato acrescenta dado financeiro ao conjunto retido indefinidamente, e o
  projeto não tem política de retenção declarada. É a dívida já registrada na ADR-0014, agora ampliada
  em classe de dado; fechá-la é decisão de produto, não desta fatia.
- **Continuidade da numeração na virada.** O mecanismo aceita valor inicial; **se** a série do sistema
  antigo será continuada, e a partir de qual valor, é decisão da fase de virada.
- **Correção do formato de quatro dígitos** no plano de execução e nas instruções do repositório —
  divergência conhecida, dono não atribuído.
