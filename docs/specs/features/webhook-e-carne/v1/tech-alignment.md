# Tech Alignment — `webhook-e-carne`

- **Feature**: `webhook-e-carne` — fatia (iii) e última da F4
- **Versão**: v1 · **Framework**: SDD · **Variante**: backend
- **Documento de definição**: `docs/prds/features/webhook-e-carne/v1/prd.md` (aprovado 2026-08-18)
- **Discovery lido**: `docs/specs/features/integracao-bancaria-sicoob/v1/pre-refinement.md`, incluindo
  a emenda §13-A. Nenhum `handoff*.md` existe para esta feature.
- **ADRs consultadas**: 0001 (e as duas emendas), 0011, 0016, 0017, 0022, 0024, 0025, 0028, 0029,
  0030, 0031, 0034, 0035
- **Data**: 2026-08-18 · **Status**: Decidido

---

## Contexto técnico

A fatia inverte, pela primeira vez no produto, a **direção da iniciativa**: até aqui todo dado entra
por ator com sessão e contexto de tenant resolvido na barreira de admissão. Aqui o iniciador é um
terceiro sem sessão, sem titularidade e sem autenticação oferecida pelo provedor — de modo que o
recebido **não é fonte de autoridade**, e sim índice para uma releitura na fonte autenticada. A
ADR-0035 já canonizou o critério; o que resta é a **forma**: onde o cru repousa sem violar o
invariante 1, como o processamento sai do caminho de resposta, e como o efeito se torna idempotente
sem que o tenant venha do recebido.

O segundo eixo é a **composição** do carnê. Ele é artefato derivado (ADR-0030) cujas páginas são
fatos recebidos de terceiro — a cláusula de exclusão da mesma ADR. A operação é **mesclagem de
documentos prontos**, categoricamente distinta da renderização de layout que a F3 resolveu, e o
motor instalado hoje não a faz.

Invariantes que atravessam tudo o que se decidir abaixo: o cru **não carrega tenant** e é conferido
por catálogo do sistema; o roteamento usa exclusivamente chave emitida pelo produto; nenhum efeito
sobre fato financeiro nasce do recebido, apenas da resposta do provedor a uma pergunta nossa.

---

## Soluções técnicas decididas

### D1 — Alcance externo do caminho da notícia

**Por que decidir**: `deploy/nginx/` **não existe** e a API escuta em `127.0.0.1` (medido em
`apps/api/src/main.ts`). O provedor exige endereço público seguro, sem redirecionamento, e valida o
endereço de forma síncrona no cadastro — sem alcance externo real, o item não se entrega.

**Escolhida — B2: vhost dedicado, versionado no repositório, restrito a um único caminho.** A
configuração nasce em `deploy/`, ao lado das unidades e dos scripts de instalação, com verificador em
shell no molde dos `verificar-*.sh` já existentes — que é como toda infraestrutura deste projeto é
provada. O vhost que atende a operação **não é tocado**; desfazer é remover a entrada.

Caminhos avaliados:

- **B1 — acrescentar um local no vhost existente do sistema antigo.**
  - _Exemplo:_ uma entrada dentro da configuração que hoje serve a operação.
  - _Prós:_ nenhuma configuração nova. _Contras:_ edita o arquivo que sustenta a operação até a F7;
    desfazer exige editar de novo o mesmo arquivo, sob risco.
  - _Viabilidade:_ conflita com a postura do discovery (§C1) de que a antecipação seja **aditiva e
    reversível**.
- **B2 — vhost dedicado versionado, restrito a um caminho** (escolhida).
  - _Exemplo:_ hostname próprio atendendo só o caminho da notícia; tudo o mais continua inalcançável.
  - _Prós:_ aditivo, reversível, e a superfície exposta é exatamente uma. Cabe no verificador de
    infraestrutura, que é a forma de prova que o projeto já usa. _Contras:_ um hostname novo a
    provisionar e a manter.
  - _Viabilidade:_ reusa `deploy/scripts/instalacao/` e o padrão `verificar-*.sh`; requer o diretório
    de configuração de borda, hoje inexistente.
- **B3 — segundo processo dedicado a receber a notícia.**
  - _Exemplo:_ um serviço só para a entrada, publicado, repassando ao produto.
  - _Prós:_ isola por processo. _Contras:_ duplica composição raiz, ambiente e segredo por um único
    caminho — over-engineering pelo critério da própria skill.
  - _Viabilidade:_ requer unidade nova e ambiente novo; nada no projeto pede esse isolamento.

**Trade-off aceito**: um hostname a mais sob operação, em troca de reversibilidade e de prova real da
validação do endereço — que a alternativa de provar só localmente não entrega (o discovery podou C2
por isso).

> ⚠️ **Correção medida ao discovery §C-1 — os três débitos NÃO disparam.** A `[HIPÓTESE]` de lá
> previa que D23, D24 e D27 ganhariam eixo com o alcance externo, e a primeira redação do PRD §9
> repetiu a previsão como fato — **o PRD foi corrigido em 2026-08-18**, e as duas pontas agora dizem o
> mesmo. Leitura dos três marcadores refuta: **D23** é a conferência de origem do `better-auth`, que corre
> quando há cabeçalhos `Sec-Fetch-*` — um POST servidor-a-servidor não os envia, e a rota não carrega
> cookie; **D27** dimensiona o limitador das rotas de **autenticação**, que continuam inalcançáveis;
> **D24** exige a API inteira publicada. Publicar um caminho que não é de navegador nem de sessão não
> dá eixo de origem a nada. Os três permanecem com gatilho na F7, intactos. É o precedente do projeto
> aplicado — *prescrição de discovery é hipótese, não ordem* —, e a confirmação por medição é da
> tech spec.

### D2 — Forma da entrada: persistir, confirmar, processar

**Por que decidir**: a ADR-0035 exige responder de imediato sem que o processamento componha a
resposta, e a ADR-0029 manda efeito externo cujo resultado não compõe a resposta sair por fila. O que
resta é **qual** mecanismo carrega o depois.

**Escolhida — E1: fila própria, no contrato de fila de `@sysloc/shared`.** A borda persiste o cru,
confirma o recebimento e enfileira; a tarefa roteia, confere, pergunta ao provedor e grava. É o
mesmo desenho que a fatia (ii) instanciou **duas vezes** (emissão em lote e conferência bancária),
com produtor na borda fora de transação e carga carregando apenas identificadores.

Caminhos avaliados:

- **E1 — fila própria** (escolhida).
  - _Exemplo:_ a borda devolve a confirmação sem ter falado com o provedor; a tarefa faz o resto.
  - _Prós:_ reusa produtor, opções padrão, molde de carga e a disciplina de redação de segredo do
    processo do worker; o reprocessamento ganha retentativa de graça. _Contras:_ mais uma fila a
    operar e a observar.
  - _Viabilidade:_ reusa `@sysloc/shared` e `apps/worker`; nada novo além do nome da fila.
- **E2 — processar no próprio processo da API depois de responder.**
  - _Exemplo:_ responder e seguir tratando em segundo plano na mesma instância.
  - _Prós:_ nenhuma fila nova. _Contras:_ perde o trabalho num reinício, não tem retentativa, e põe
    conversa com terceiro dentro do processo que atende a operação — exatamente o que a ADR-0029
    existe para evitar.
  - _Viabilidade:_ contraria ADR-0029.
- **E3 — não processar: deixar a conferência diária tratar o que chegou.**
  - _Exemplo:_ o cru se acumula e a passada do dia o consome.
  - _Prós:_ zero mecanismo novo. _Contras:_ anula o objetivo da fatia — a liquidação voltaria a
    depender do relógio, e o PRD mede sucesso justamente pela queda desse intervalo.
  - _Viabilidade:_ conflita com o objetivo do PRD §3.

**Trade-off aceito**: uma fila a mais em troca de retentativa, durabilidade e da fronteira que a
ADR-0029 pede.

### D3 — Mecanismo do descarte dos 90 dias

**Por que decidir**: a RN-11 obriga o descarte, e **não existe agendador algum hoje** — medido:
`deploy/systemd/` tem duas unidades e **nenhum timer**, e não há job repetível no worker. O
agendamento é da F5, e o usuário declarou não querer um segundo agendador nascendo aqui.

**Escolhida — X1: expurgo oportunista dentro da tarefa de processamento.** Toda vez que a tarefa
trata uma notícia, ela também descarta o cru vencido. O descarte é consequência do próprio fluxo que
produz o dado a descartar.

Caminhos avaliados:

- **X1 — expurgo oportunista na tarefa** (escolhida).
  - _Exemplo:_ chega notícia hoje; ao tratá-la, o que passou de 90 dias sai.
  - _Prós:_ nenhuma rota nova numa fase em que a superfície está prestes a congelar; nenhum
    agendador; corre fora do caminho de resposta, então não paga latência na borda; testável
    diretamente pela tarefa. _Contras:_ numa parada longa de notícias, o cru vencido sobrevive até a
    próxima chegar — mitigado pelo fato de que só há cru porque houve notícia.
  - _Viabilidade:_ reusa a tarefa de D2; nada novo.
- **X2 — rota de disparo idempotente, no molde da conferência da fatia (ii).**
  - _Exemplo:_ a F5 pendura o timer nessa rota depois.
  - _Prós:_ precedente literal na fatia anterior; disparo sob comando e visibilidade operacional.
    _Contras:_ +1 na superfície publicada às vésperas do congelamento, +1 autorização, para uma
    operação de manutenção que ninguém aciona.
  - _Viabilidade:_ reusa o padrão da (ii); custa superfície.
- **X3 — job repetível do mecanismo de fila.**
  - _Exemplo:_ recorrência declarada no worker.
  - _Prós:_ roda sozinho. _Contras:_ é o segundo agendador que o usuário recusou, e antecipa decisão
    da F5 sobre onde a recorrência mora.
  - _Viabilidade:_ conflita com a fronteira F4/F5 declarada no discovery.

**Trade-off aceito**: o descarte é eventualmente consistente com o prazo, e não pontual no dia 91.
A RN-11 fixa o prazo de guarda, não a hora do apagamento.

### D4 — Onde vive o "retido" da empresa suspensa

**Por que decidir**: a decisão 37 manda registrar sempre e aplicar na reativação. Mas a guarda de
admissão do schema da plataforma (`packages/db/src/catalogo-de-plataforma.ts`) **reprova qualquer
tabela ali que carregue coluna de empresa** — motivo `CARREGA_COLUNA_DE_EMPRESA`, cobrado antes do
roster justamente para que a correção certa seja tirar a tabela de lá. Logo, **o retido não pode ser
marcado por empresa no cru**, que é onde ele naturalmente estaria.

**Escolhida — R2: desfecho de roteamento sem tenant no próprio cru, com re-roteamento idempotente na
reativação.** O cru guarda apenas o desfecho da tentativa de roteamento — sem nomear empresa —, e a
reativação reenfileira o que ficou pendente. O re-roteamento **redescobre** a empresa pela chave, e é
idempotente pela mesma regra da RN-08: o que já produziu efeito não o repete, e o que continuar
pertencendo a empresa suspensa é retido de novo.

Caminhos avaliados:

- **R1 — marcar o retido na trilha roteada, que tem tenant e RLS.**
  - _Exemplo:_ um efeito "notícia retida" pendurado na cobrança encontrada.
  - _Prós:_ tenantizado por construção. _Contras:_ para gravar ali é preciso ter roteado — e rotear
    exige alcançar a cobrança de uma empresa suspensa, que é precisamente o que o bloqueio lógico
    impede. Além disso, "chegou e não produziu efeito" é tentativa, e a ADR-0034 reserva a trilha
    publicada para **efeito**.
  - _Viabilidade:_ tensiona ADR-0034.
- **R2 — desfecho sem tenant no cru + re-roteamento na reativação** (escolhida).
  - _Exemplo:_ reativada a empresa, o pendente é reprocessado; o que é dela produz efeito, o que é de
    outra empresa suspensa continua pendente.
  - _Prós:_ o cru permanece sem tenant e passa na guarda da ADR-0031; nenhuma tabela nova; o
    re-roteamento reusa exatamente o caminho de tratamento normal, sem segunda implementação.
    _Contras:_ a reativação de uma empresa varre pendentes que podem ser de outras — benigno, porque
    o roteamento é idempotente, mas é trabalho a mais.
  - _Viabilidade:_ reusa D2 inteiro; requer apenas o desfecho registrado no cru.
- **R3 — não reprocessar: deixar a conferência diária alcançar depois da reativação.**
  - _Exemplo:_ a passada do dia seguinte encontra a liquidação.
  - _Prós:_ nada a construir. _Contras:_ a decisão 37 existe porque um boleto pago durante a
    suspensão sumiria; depender da conferência reintroduz a janela que ela fecha, e a CA-10 exige que
    a reativação aplique.
  - _Viabilidade:_ conflita com CA-10.

**Trade-off aceito**: a reativação faz trabalho proporcional ao pendente global, não ao da empresa
reativada. É o preço de manter o cru livre de tenant, que é invariante e não preferência.

### D5 — Ferramenta de composição do carnê

**Por que decidir**: o carnê **mescla documentos prontos** vindos do provedor. O motor instalado,
`@react-pdf/renderer` 4.6.0 (`packages/documentos`), **renderiza layout** e não importa páginas de
documento externo. O `plano-execucao.md` §F4 item 6 e o discovery mandam `pdf-lib`, que o `CLAUDE.md`
registra como **planejado e não instalado**.

**Escolhida — M1: introduzir `pdf-lib`, e a introdução não é inércia.** A tech-alignment da fatia
`documentos-e-confirmacao` **escreveu, ao rejeitá-lo para o documento do contrato**, que *"`pdf-lib`
permanece candidato natural para a **F4** (manipular boleto já emitido), que é outro problema"*. A
rejeição de lá foi contextual — composição de layout com quebra de linha — e reservou explicitamente
este caso. É a distinção que separa `pdf-lib` do `undici`, que foi **avaliado e recusado** com razão
registrada no docblock do adaptador: aquele tem substituto nativo equivalente; este não tem substituto
algum no monorepo.

Caminhos avaliados:

- **M1 — `pdf-lib`** (escolhida).
  - _Exemplo:_ páginas de N documentos existentes copiadas para um documento novo.
  - _Prós:_ é a operação exata, em JavaScript puro, sem binário nativo nem dependência de host —
    compatível com "nativo, sem Docker"; precedente escrito reservando-o para esta fase.
    _Contras:_ dependência nova no monorepo, com a superfície de manutenção que isso carrega.
  - _Viabilidade:_ dependência nova, prevista pelo `plano-execucao.md` §F4 e pela F3; `[HIPÓTESE]` a
    validar na tech spec — que ele mescla preservando o conteúdo dos boletos do provedor sem
    re-renderizar.
- **M2 — `@react-pdf/renderer`, o que já está instalado.**
  - _Exemplo:_ compor um documento novo e tentar embutir cada boleto.
  - _Prós:_ zero dependência nova. _Contras:_ ele não importa páginas de PDF externo; a única saída
    seria rasterizar ou reconstruir o boleto, o que **altera o fato recebido de terceiro** e contraria
    a cláusula de exclusão da ADR-0030.
  - _Viabilidade:_ tecnicamente não atende.
- **M3 — ferramenta do sistema operacional invocada como processo externo.**
  - _Exemplo:_ um utilitário de linha de comando que concatena documentos.
  - _Prós:_ nenhuma dependência no manifesto. _Contras:_ dependência de **host**, que o
    provisionamento passaria a ter de garantir e o verificador de infraestrutura a conferir; troca
    dependência declarada por dependência implícita, que é a pior das duas.
  - _Viabilidade:_ requer provisionamento novo; contraria a disciplina de instalação do projeto.

**Trade-off aceito**: uma dependência nova em troca de preservar intactos os bytes que vieram do
provedor — que é o que a ADR-0030 exige ao excluir o fato de terceiro do alcance dela.

### D6 — Sincronismo da composição e o pior caso da rebusca

**Por que decidir**: os bytes **são** a resposta, o que pela ADR-0029 mantém o ato em linha por
natureza. Mas o pior caso é real: um recorte de doze parcelas com todos os arquivos ausentes vira
doze conversas com o provedor dentro de um pedido só.

**Escolhida — C1: em linha, reusando o caminho de entrega que a fatia (ii) já provou.**
`BoletoService.entregar` já resolve, por boleto, exatamente o problema: lê do cache, distingue
ausência de qualquer outra falha do sistema de arquivos, rebusca do provedor pedindo o documento,
regrava o cache sem deixar a regravação derrubar o desfecho, e recusa nomeando quando não há o que
entregar. O carnê **compõe** sobre esse caminho em vez de reimplementá-lo — o que também herda a
disciplina de decifra do segredo, que é a superfície mais sensível da fase.

Caminhos avaliados:

- **C1 — em linha sobre o caminho de entrega existente** (escolhida).
  - _Exemplo:_ recorte de doze com três ausentes → três rebuscas, e o documento sai no mesmo pedido.
  - _Prós:_ um só lugar decide o que é ausência e o que é falha real; a recusa por boleto nunca
    emitido cai naturalmente na RN-16. _Contras:_ o pior caso é lento e proporcional ao recorte.
  - _Viabilidade:_ reuso direto de `apps/api/src/cobrancas/boleto.service.ts`; nada novo.
- **C2 — por fila, com acompanhamento, no molde da emissão em lote.**
  - _Exemplo:_ pedir o carnê devolve um acompanhamento; o documento vem depois.
  - _Prós:_ imune ao pior caso. _Contras:_ o resultado **compõe** a resposta, então a ADR-0029 o
    mantém em linha; e obrigaria a guardar o carnê em algum lugar entre o preparo e a entrega, que é
    exatamente o armazenamento que a ADR-0030 proíbe.
  - _Viabilidade:_ conflita com ADR-0029 e ADR-0030.
- **C3 — em linha, mas recusando o recorte quando faltam muitos arquivos.**
  - _Exemplo:_ acima de um limiar de ausências, o pedido falha pedindo que se tente menor.
  - _Prós:_ limita o pior caso. _Contras:_ transforma um detalhe de cache — quantos arquivos
    sobreviveram no disco — em comportamento visível ao usuário, que é o oposto do que a RN-15 e a
    CA-15 pedem ("sem que quem pediu perceba diferença").
  - _Viabilidade:_ conflita com CA-15.

**Trade-off aceito**: o pior caso é lento. Mitiga-se dimensionando o recorte e a espera na tech spec,
não mudando a natureza do ato.

---

## Decisões diretas (determinadas pelo projeto — sem leque)

- **O cru mora no schema da plataforma, e não num schema novo.** O discovery propôs um schema
  `integracao` próprio. O projeto já resolveu: a ADR-0031 tem guarda executável em
  `packages/db/src/catalogo-de-plataforma.ts`, apontada para o schema da plataforma, com roster
  congelado em vazio — e o docblock dela **nomeia** a tabela crua da notificação bancária como a
  primeira a entrar no roster, "que a fatia seguinte trará". Um schema terceiro nasceria **sem guarda
  alguma**, que é o defeito que a ADR-0031 existe para impedir. A entrada no roster é a *alteração
  explícita e revisada* que ela pede, e é ela que dá conteúdo próprio à segunda direção da igualdade
  descrita no cabeçalho daquele módulo.
- **A rota da notícia é declarada `publicas`.** ADR-0035 e ADR-0011: o conjunto sem declaração
  permanece vazio, e a marca de rota pública já existe no arcabouço, usada uma vez na F3.
- **O efeito nasce da resposta do provedor, nunca do recebido.** ADR-0035 e RN-07 do PRD; a regra de
  liquidação, estorno e revogação é a que a fatia (ii) já fixou, sem exceção por caminho de entrada.
- **A entrega do carnê declara mídia e nome de arquivo.** ADR-0028, como a rota do documento do
  contrato e a do boleto já fazem.

---

## Candidatas a ADR

**Nenhuma.** As três decisões transversais desta fase já estão canonizadas — **0031** (tabela sem
dono-empresa fora do schema de negócio), **0034** (trilha registra efeito, não tentativa) e **0035**
(critério da rota de entrada de fato de terceiro). Os seis pontos acima são **instanciações** delas,
de alcance restrito à fatia. Registrar ADR para qualquer um seria churn — e a ADR-0035 declara
explicitamente que "o código de resposta concreto, a forma da tabela do cru e o nome da chave são da
tech spec da fatia".

---

## Restrições e invariantes técnicas

Qualquer implementação desta fatia respeita:

1. **O cru não carrega tenant.** A guarda de admissão reprova por `CARREGA_COLUNA_DE_EMPRESA` antes
   de reprovar por roster, e a ordem é normativa.
2. **A chave de roteamento é a que o produto emitiu** e que fez o trajeto de ida e volta — nunca
   identificador escolhido pelo terceiro (ADR-0024, ADR-0035).
3. **O que não casa morre antes de qualquer consulta ao provedor** (ADR-0035, decisão 21).
4. **A trilha publicada registra efeito, não tentativa** (ADR-0034). Rebusca de cache não é efeito —
   o caminho de entrega da fatia (ii) já registra essa leitura por extenso.
5. **Nenhum material de certificado ou senha alcança carga de fila, argumento de comando do
   mecanismo de fila, ou caminho que a redação não cubra** — provado por **medição**, no molde do
   achado crítico da 2b. A carga da tarefa leva identificadores, não segredo.
6. **A resposta ao provedor é direta e síncrona**, sem redirecionamento, e o processamento não a
   compõe (ADR-0029, ADR-0035).
7. **O carnê nunca é armazenado** (ADR-0030); os bytes do boleto **são** guardados, pela cláusula de
   exclusão da mesma ADR.
8. **Nenhum vocabulário do provedor cruza a porta** (ADR-0001, e as duas emendas: a porta tem quatro
   operações, e a obtenção de credencial vive dentro do adaptador). O sinalizador que pede o documento
   na consulta **já existe** e foi criado justamente para evitar uma quinta operação — o carnê o reusa
   e **não** acrescenta operação à porta.
9. **Isolamento por RLS forçada** em tudo que é roteado; o cru vive fora do alcance dela por decisão
   registrada, e é por isso que ele não pode ter tenant.
10. **A superfície publicada cresce e depois congela.** Contagem exata por dupla medição independente,
    com igualdade entre os eixos afirmada — precedente dos CT-533, CT-635, CT-732 e CT-937.

---

## Pontos em aberto

**A critério do arquiteto do TECH_SPEC:**

- A forma do desfecho de roteamento registrado no cru — conjunto fechado de desfechos, e como o
  pendente é encontrado sem varredura ampla.
- Como a validação de endereço e a notícia de recebimento se distinguem na mesma entrada.
- Dimensionamento do pior caso do carnê: espera tolerada, e se as rebuscas de um mesmo recorte
  compartilham a leitura da identidade da empresa em vez de repeti-la por boleto.
- Granularidade do expurgo dentro da tarefa (a cada notícia tratada, ou amostrado).
- Se `pdf-lib` preserva os bytes das páginas de origem sem re-renderizar — `[HIPÓTESE]` a validar por
  medição antes de fixar a dependência.

**Dependência operacional (não de produto), a fechar antes da borda:**

- Qual hostname atende o caminho da notícia e como ele é provisionado no servidor de borda — a
  `[DÚVIDA] 4` do discovery, que permanece aberta e é decisão do usuário.
- ⚠️ **O certificado em uso vence em 2026-08-22.** D1, D6 e a validação real do endereço dependem de
  conversa com o provedor. Risco datado, assumido pelo usuário em 2026-08-16.

**Observação fora do escopo** (não vira proposta): não há expurgo dos boletos guardados — débito D26
· F4/T9, com gatilho declarado na F5, deixado lá de propósito pela decisão de escopo de 2026-08-18.
