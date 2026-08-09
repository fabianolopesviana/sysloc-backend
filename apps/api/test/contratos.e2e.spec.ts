/**
 * As seis rotas de cadastro de `/v1/contratos` — T6 da fatia `contratos-de-locacao` —, as **duas
 * transições de estado governadas do produto** (a ativação, T7, e o cancelamento, T8) e o invariante
 * que a T10 fecha: a situação de locação do imóvel **nunca diverge** do estado do contrato.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 tirou `statusLocacao` do corpo do `PUT` de imóvel e lhe deu rota
 * própria, e **nenhuma asserção dos dezoito casos anteriores foi alterada, afrouxada ou removida** —
 * o que mudou foi o inventário que o cabeçalho anuncia, o `describe` novo que o `CT-434` ocupa e o
 * acessório `situacaoDoImovel`, que passou a **delegar** à leitura do imóvel inteiro em vez de emitir
 * a própria requisição (a cadeia devolvida é a mesma, e nenhum ponto de chamada mudou).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o título deste arquivo que descrevia
 * uma superfície de seis rotas. A T7 publicou `POST /v1/contratos/:codigo/ativacao`, e **nenhuma
 * asserção dos oito casos da T6 foi alterada, afrouxada ou removida** — o que mudou foi o inventário
 * que o cabeçalho anuncia e o `describe` novo que os casos da T7 ocupam.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /v1/contratos/:codigo/cancelamento`, e com ela a
 * máquina de estados fecha. **Nenhuma asserção dos treze casos anteriores foi alterada, afrouxada ou
 * removida**; o que mudou foi, de novo, o inventário do cabeçalho e o `describe` novo. A **única**
 * edição em código anterior é a chave `ACAO:cancelar_contrato` acrescentada a
 * {@link CHAVES_DO_ARRANJO} e afirmada no efetivo das duas sessões — acréscimo puro, sem o qual o
 * `CT-422` não conseguiria distinguir o `404` do isolamento do `403` da guarda.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-01 | CT-408 | Montar um contrato com imóvel, locador, locatário, termos e **zero, um ou três**
 * | CA-03 |        | fiadores é um único envio: `201`, `status: 'RASCUNHO'`, `codigo` no formato
 * | CA-04 |        | `CTR-{ano}-{5 dígitos}`, `dataFimLocacao` e `valorTotalContrato` **nulos**, e a
 * |       |        | lista de fiadores **exatamente** a enviada. O corpo é afirmado INTEIRO — o UUID
 * |       |        | interno e `empresa_id` **não saem**. O imóvel referenciado permanece
 * |       |        | `DISPONIVEL`: o rascunho ainda não vale. |
 * | CA-02 | CT-409 | `PUT /v1/contratos/:codigo` é aceito **só** em `RASCUNHO` e **nunca muda o
 * |       |        | código**; sobre `ATIVO` e sobre `CANCELADO` responde `422 CAMPO_INVALIDO`,
 * |       |        | `campo: 'status'`, `detalhes: { estadoAtual, transicaoPedida }`, e a releitura
 * |       |        | dos dois é **profundamente igual** à de antes da tentativa. |
 * | CA-03 | CT-410 | O `PUT` **substitui a coleção de fiadores por inteiro** enquanto rascunho —
 * |       |        | `[F1, F2]` vira `[F2, F3]`, e F1 sai **sem sobra**. Depois de `ATIVO`, um `PUT`
 * |       |        | que só troca fiadores é recusado pela guarda do **pai** (`422 campo status`) e
 * |       |        | a lista congelada fica **intocada**. |
 * | CA-08 | CT-411 | Prazo `≤ 0`, valor mensal `≤ 0`, dia de vencimento fora de 1–28 e data de início
 * | CA-04 |        | ausente **nunca** produzem contrato: cada um responde `422 CAMPO_INVALIDO`
 * | CA-03 |        | nomeando o campo culpado, e a contagem **crua** de `negocio.contrato` não muda.
 * |       |        | O mesmo vale para `:codigo` malformado (que **não toca o banco**) e para o
 * |       |        | mesmo fiador citado duas vezes (`campo: 'fiadoresIds'`). |
 * | CA-11 | CT-411 | Imóvel, locador, locatário ou fiador **retirado de circulação** é recusado com
 * |       | (b)    | `422 CAMPO_INVALIDO` nomeando o campo, com
 * |       |        | `detalhes.circulacao: 'RETIRADO_DE_CIRCULACAO'`, na montagem **e** na alteração;
 * |       |        | nenhuma das recusas grava linha. |
 * | CA-11 | CT-411 | Com **três** fiadores, a recusa é a do **PRIMEIRO** problema na ordem em que o
 * | CA-03 | (c)    | cliente enviou a coleção: o retirado **fora da primeira posição** produz `422`
 * |       |        | `fiadoresIds` com `detalhes.circulacao`; o inalcançável fora da primeira
 * |       |        | posição produz `404`; e a **mesma dupla** `{retirado, inalcançável}` trocada
 * |       |        | de posição troca a resposta entre `422` e `404`. O controle positivo, sem o
 * |       |        | retirado, responde `201`, e nenhuma das quatro recusas grava linha. |
 * | CA-15 | CT-417 | `POST /:codigo/retirada` e `/recirculacao` alcançam `RASCUNHO`, `ATIVO` e
 * |       |        | `CANCELADO`, **não transitam estado algum** e **não liberam o imóvel** (o do
 * |       |        | contrato ativo permanece `LOCADO`). A repetição devolve corpo **profundamente
 * |       |        | igual** — idempotência —, a recirculação zera a marca, e corpo não vazio é
 * |       |        | `422` com `campo: 'corpo'` e a marca **intocada**. |
 * | CA-13 | CT-418 | `GET /v1/contratos` devolve, para cada contrato, código, partes, termos e estado
 * |       |        | num envelope `{ itens, total, limite, deslocamento }` (ADR-0017) — sem segunda
 * |       |        | consulta. O contrato **retirado não aparece** por padrão e aparece com
 * |       |        | `incluirRetirados=true`. `limite=201` **RECUSA** com `422 campo 'limite'`, em
 * |       |        | vez de truncar em silêncio. |
 * | CA-18 | CT-423 | Montar contrato apontando imóvel de A e pessoa de B é recusado com o **mesmo**
 * |       |        | `404 RECURSO_NAO_ENCONTRADO` de cadastro inexistente, corpo por corpo; a
 * |       |        | contagem crua de contratos **não muda em nenhuma das duas empresas**; e o
 * |       |        | controle positivo, com o locatário de A, responde `201`. |
 * | CA-05 | CT-413 | Ativar um rascunho conferido responde `200` com o corpo **inteiro** por
 * | CA-06 |        | igualdade: `status: 'ATIVO'`, `dataFimLocacao` e `valorTotalContrato`
 * | CA-20 |        | derivados e batendo com o golden, e `efeitos: { cobrancasGeradas: false }`. O
 * |       |        | imóvel passa a `LOCADO`, e a releitura do contrato é igual ao corpo da ativação
 * |       |        | **menos `efeitos`**. Sub-casos: o imóvel `INDISPONIVEL` **é ativável** e passa
 * |       |        | a `LOCADO`; `500.03 × 13` devolve **`6500.39` exato**, e não o produto ingênuo
 * |       |        | `6500.389999999999`; corpo não vazio é `422` `campo: 'corpo'` e o contrato
 * |       |        | segue `RASCUNHO`. |
 * | CA-05 | CT-413 | As DUAS escritas da ativação — o estado do contrato e a situação do imóvel —
 * |       | (b)    | correm na **mesma unidade de trabalho**: uma falha depois de ambas deixa o
 * |       |        | contrato `RASCUNHO` **e** o imóvel `DISPONIVEL`. Nenhuma das duas sobrevive
 * |       |        | sozinha ao desfazimento. |
 * | CA-11 | CT-412 | Imóvel, locador, locatário ou fiador retirado de circulação é recusado com
 * |       |        | `422 CAMPO_INVALIDO` nomeando o campo e `detalhes.circulacao:
 * |       |        | 'RETIRADO_DE_CIRCULACAO'` **nos dois momentos** — ao montar e ao fazer valer —,
 * |       |        | e o contrato cuja referência saiu de circulação depois da montagem permanece
 * |       |        | `RASCUNHO`, com o imóvel `DISPONIVEL`. |
 * | CA-07 | CT-414 | Ativar um segundo contrato sobre imóvel já ocupado responde `422`,
 * | CA-10 |        | `campo: 'imovelId'`, `detalhes: { conflito: 'IMOVEL_COM_CONTRATO_VIGENTE',
 * |       |        | contratoVigente: '<código do primeiro>' }`; o segundo segue `RASCUNHO`, e o
 * |       |        | vigente e o imóvel ficam **byte a byte** como estavam. Reativar o vigente é
 * |       |        | `422` `campo: 'status'` com `detalhes: { estadoAtual: 'ATIVO', transicaoPedida:
 * |       |        | 'ATIVACAO' }`. |
 * | CA-16 | CT-425 | Uma sessão com `TELA:contratos` e **sem** `ACAO:ativar_contrato` — a ausência
 * |       |        | afirmada por `GET /v1/sessao` **antes** da tentativa — monta o rascunho com
 * |       |        | `201` e recebe `403 ACESSO_NEGADO` com `detalhes.exigido:
 * |       |        | 'ACAO:ativar_contrato'` ao ativar; o contrato segue `RASCUNHO` e o imóvel
 * |       |        | `DISPONIVEL`. Concedida a ação à MESMA pessoa, a MESMA rota responde `200`. |
 *
 * | CA-09 | CT-415 | `POST /:codigo/cancelamento` só é aceito sobre contrato `ATIVO`: responde `200`
 * | CA-10 |        | com o corpo **inteiro** por igualdade — `status: 'CANCELADO'`, as duas
 * |       |        | derivações da ativação **preservadas**, `retiradoEm` nulo e **sem `efeitos`** —
 * |       |        | e devolve o imóvel a `DISPONIVEL`. As **quatro** transições inválidas —
 * |       |        | cancelar `RASCUNHO`, ativar `ATIVO`, cancelar `CANCELADO` e ativar `CANCELADO`
 * |       |        | — respondem `422 CAMPO_INVALIDO`, `campo: 'status'`, com o par
 * |       |        | `{ estadoAtual, transicaoPedida }` correto em cada uma, e nenhuma delas move o
 * |       |        | contrato nem a situação do imóvel. O cancelado **continua listado na carteira
 * |       |        | padrão**, marcado como cancelado. |
 * | CA-18 | CT-422 | O contrato `ATIVO` da empresa A é inalcançável pela sessão de B nas **cinco**
 * |       |        | operações de `:codigo` — `GET`, `PUT`, `/ativacao`, `/cancelamento` e
 * |       |        | `/retirada` —, todas com `404 RECURSO_NAO_ENCONTRADO` e corpo **profundamente
 * |       |        | igual** ao de um código inexistente. As duas sessões têm as **quatro** chaves,
 * |       |        | afirmadas antes; e o contrato de A permanece byte a byte, com o imóvel `LOCADO`.
 * | CA-17 | CT-426 | Uma sessão com `TELA:contratos` **e** `ACAO:ativar_contrato`, e **sem**
 * |       |        | `ACAO:cancelar_contrato` — a ausência afirmada por `GET /v1/sessao` antes da
 * |       |        | tentativa —, ativa com `200` e recebe `403 ACESSO_NEGADO` com
 * |       |        | `detalhes.exigido: 'ACAO:cancelar_contrato'` ao cancelar; o contrato segue
 * |       |        | `ATIVO` e o imóvel `LOCADO`. Concedida a ação à MESMA pessoa, a MESMA rota
 * |       |        | responde `200` e o imóvel volta a `DISPONIVEL`. |
 *
 * | CA-05 | CT-434 | A situação de locação de um imóvel com contrato vigente é **irrepresentável**
 * | CA-09 |        | como divergente do estado do contrato: **nenhuma** resposta traz
 * |       |        | `statusLocacao: 'DISPONIVEL'` junto de `contratoVigente` preenchido, nem o
 * |       |        | contrário. Um `PUT` que traga `statusLocacao` responde `422` nomeando `corpo`
 * |       |        | — chave **desconhecida**, recusa ruidosa — e não grava nada; o `PUT` com o
 * |       |        | corpo novo corrige o **endereço** e devolve `200` com `statusLocacao` ainda
 * |       |        | `LOCADO`; `POST /:id/situacao-de-locacao` sobre o imóvel locado é `422` com
 * |       |        | `campo: 'statusLocacao'` e `detalhes: { conflito:
 * |       |        | 'IMOVEL_COM_CONTRATO_VIGENTE' }`, para as **duas** situações informáveis;
 * |       |        | `LOCADO` informado é `422` nomeando `statusLocacao` e chave extra é `422`
 * |       |        | nomeando `corpo`; e, **cancelado o contrato**, a MESMA rota responde `200` e
 * |       |        | grava. (ADR-0016, ADR-0017, ADR-0019) |
 *
 * Rastreabilidade: `CA-01 → CT-408 (RN-01)`, `CA-03 → CT-408 (RN-06)`, `CA-04 → CT-408 (RN-04)`,
 * `CA-02 → CT-409 (RN-05)`, `CA-03 → CT-410 (RN-06)`, `CA-08 → CT-411 (RN-08)`,
 * `CA-11 → CT-411 (b) (RN-14)`, `CA-11 → CT-411 (c) (RN-14)`, `CA-15 → CT-417 (RN-15)`,
 * `CA-13 → CT-418 (RN-10)`, `CA-18 → CT-423 (RN-01)`, `CA-05 → CT-413 (RN-03)`,
 * `CA-06 → CT-413 (RN-12)`, `CA-20 → CT-413 (RN-11)`, `CA-05 → CT-413 (b) (RN-03)`,
 * `CA-11 → CT-412 (RN-14)`, `CA-07 → CT-414 (RN-09)`, `CA-10 → CT-414 (RN-02)`,
 * `CA-16 → CT-425 (RN-13)`, `CA-09 → CT-415 (RN-11)`, `CA-10 → CT-415 (RN-02)`,
 * `CA-18 → CT-422 (RN-01)`, `CA-17 → CT-426 (RN-07)`.
 * Acrescida pela T10: `CA-05 → CT-434 (RN-10)`, `CA-09 → CT-434 (RN-11)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T10 — leia antes de comparar com a §6.4 e a §6.6
 * ===========================================================================
 *
 * 1. **O `CT-434` carrega dois passos além dos quatro que a §6.6 enumera** — as duas recusas de
 *    ENTRADA da rota nova (o `LOCADO` informado e a chave desconhecida, que são os cenários 3 e o
 *    corpo fechado da §6.4) e o **eixo positivo** depois do cancelamento. O segundo não é zelo: sem
 *    ele, tudo o que o caso afirma sobre a recusa seria satisfeito por uma rota que **recusa
 *    sempre**, e a rota nova não teria prova alguma de funcionar. Ele é também o que torna a recusa
 *    atribuível ao **contrato vigente**, e a nada mais — o mesmo desenho do eixo positivo do `CT-425`
 *    e do `CT-426`.
 * 2. **A recusa da rota é medida com as DUAS situações informáveis**, e a §6.6 nomeia só
 *    `INDISPONIVEL`. `DISPONIVEL` sobre um imóvel locado divergiria do contrato exatamente do mesmo
 *    jeito, e uma implementação que recusasse só o valor "perigoso" atravessaria o caso com um só.
 * 3. **A recusa da situação de locação sem `TELA:imoveis`** (cenário 4 da §6.4) **não** é exercitada
 *    aqui: as sessões deste arquivo têm a área, e o eixo "o default nega" sobre as rotas de imóvel é
 *    do `CT-319`, em `test/autorizacao-do-dominio.e2e.spec.ts`, que varre as rotas do domínio com uma
 *    sessão sem a chave daquela área. Duplicá-lo aqui provaria a mesma coisa por um caminho pior.
 * 4. **"Sem linha `error` no journal"** vale para o caso da T10 pelo mesmo discriminante observável
 *    das divergências 4 da T6, 4 da T7 e 5 da T8.
 *
 * ===========================================================================
 * MUTANTES DA T10 (2026-08-09) — DOIS isolados, e cada um reprova numa asserção diferente
 * ===========================================================================
 *
 * A §7 da task adverte que este é *"o ponto mais fácil de provar mal: uma asserção que só olhe o
 * corpo da resposta não distingue 'o campo foi recusado' de 'o campo foi aceito e ignorado'"*. Por
 * isso a falsificação do `CT-434` exige **dois mutantes aplicados isoladamente** — um por metade do
 * defeito. Ambos aplicados ao fonte de produção e invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso. **Controle**:
 * `21 arquivos, 155 casos, 0 falhas`.
 *
 *   * **MT10-1 · o campo VOLTA ao esquema de alteração**
 *     (`esquemaDeImovelAlterado = esquemaDeImovelNovo.omit({ statusLocacao: true })` →
 *     `= esquemaDeImovelNovo`): `5 failed | 150 passed`. No **`CT-434`**, no **passo 1** —
 *     `expected 200 to be 422`, isto é, o `PUT` com `statusLocacao` voltou a ser **aceito**. As
 *     outras quatro falhas (`CT-319`, `CT-321`, `CT-322`, `CT-333 (b)`) são consequência do mutante
 *     tornar o campo **obrigatório** de novo, e não a prova: quem mede esta metade é o passo 1;
 *   * **MT10-2 · a PORTA volta a escrever a coluna** (`status_locacao = 'DISPONIVEL'` reintroduzido
 *     no `UPDATE` de `alterarImovel`, com o esquema intacto): `1 failed | 154 passed`, **só** no
 *     **`CT-434`**, no **passo 2** — `expected 'DISPONIVEL' to be 'LOCADO'` dentro da igualdade do
 *     imóvel inteiro. É **o defeito de origem, isolado**: corrigir o endereço apagou o `LOCADO`
 *     enquanto o contrato seguia `ATIVO`. **Nenhum outro caso da suíte o alcança** — nem o `CT-333
 *     (b)`, que faz três `PUT` de imóvel, porque nenhum deles é sobre imóvel locado —, e é essa
 *     medição que justifica o passo 2 existir ao lado do passo 1: um mutante só, aplicado a qualquer
 *     uma das duas metades, deixaria a outra viva;
 *   * **MT10-3 · a conjunção declarada só com a AÇÃO** (`@ExigeChaves(AREA_DOS_CONTRATOS,
 *     ACAO_DE_CANCELAMENTO)` → `@ExigeChave(ACAO_DE_CANCELAMENTO)`, o defeito literal da ADR-0018) —
 *     é a falsificação do **`CT-427`**, e a medição está registrada por extenso no docblock de
 *     `MANIPULADORES_EXAMINADOS_EM_PRODUCAO`, em `test/cobertura-de-autorizacao.e2e.spec.ts`:
 *     `2 failed | 153 passed`, no `CT-355` (nomeando `ContratoController.cancelar`) e no `CT-427`
 *     (`expected [ 'ACAO:cancelar_contrato' ] to deeply equal [ 'TELA:contratos', …(1) ]`);
 *   * **reversão** — os três fontes foram restaurados dos backups e conferidos idênticos ao original
 *     por `diff -q`, `pnpm build` refeito, e o controle voltou a `155 passed`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T6 — leia antes de comparar com a §6.4 e a §6.6
 * ===========================================================================
 *
 * 1. **O sub-caso `contratoVigente: null` do `CT-408` não é exercitado**, e a §6.6 já o declara: o
 *    campo só entra em `esquemaDoImovel` na **T9**. Até lá, a prova de que o rascunho não vale é o
 *    imóvel permanecer `DISPONIVEL` — que é o que a observação do card manda afirmar.
 * 2. **O `CT-411` carrega duas linhas além das cinco do card** — `:codigo` malformado e fiador
 *    repetido. As duas são cenários da §6.4 sem caso nomeado na §6.5, e sem elas dois mutantes
 *    sobreviveriam: uma borda que validasse o código **depois** de consultar o banco (transformando a
 *    forma do identificador em oráculo de existência) e um esquema sem a conferência de repetição
 *    (que faria a recusa chegar do banco **sem nome de campo**). A invariante é a mesma das outras
 *    cinco — *a recusa nomeia o campo e nada é gravado* —, e é por isso que elas entram na MESMA
 *    tabela em vez de num caso novo.
 * 3. **O `CT-411 (b)` não está na §6.6**, e existe porque o `CT-412` — dono da recusa por circulação
 *    na §6.5 — **é da T7**, que cobre montagem e ativação num caso só. Sem ele, o item de aceite
 *    *"cadastro fora de circulação recusado na montagem **e na alteração**, nomeando o campo, com
 *    `detalhes.circulacao`"* ficaria sem prova alguma nesta task, e um serviço que conferisse só o
 *    alcance — nunca a circulação — atravessaria a suíte inteira. A forma com letra é a que esta base
 *    já usa para sub-caso da mesma invariante (`CT-310 (b)`, `CT-333 (b)`).
 * 4. **"Sem linha `error` no journal"** (§6.4, primeira linha) é afirmado pelo **discriminante
 *    observável**: o filtro global só registra `logger.error` para o que **não** é `ErroDeAplicacao`,
 *    e o que não é `ErroDeAplicacao` sai como `500 ERRO_INTERNO`. Afirmar o corpo INTEIRO de cada
 *    recusa com `codigo: CAMPO_INVALIDO` é, portanto, a mesma afirmação por um caminho que não exige
 *    instrumentar o registrador do processo — que, sob `LOG_LEVEL=fatal`, nem emitiria a linha.
 * 5. **O `CT-411 (c)` não está na §6.6**, e nasce na **rodada 2** desta task, como rede do P4 do
 *    Protocolo Antirregressão para a correção do bloqueante `P1` da Revisão Técnica: a conferência
 *    dos fiadores deixou de ser um laço com uma leitura por item e passou a ser uma leitura **em
 *    lote** (`localizarPessoas`) seguida de iteração sobre a entrada. A forma nova tem dois modos de
 *    falha que a suíte anterior **não alcançava** — perder o identificador ausente (que não está no
 *    resultado da consulta) e perder a ordem de recusa —, e o `CT-411 (b)`, com um fiador só e na
 *    primeira posição, é verde para os dois. A razão de cada par está no docblock de
 *    {@link ordensDeFiadores}.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T7 — leia antes de comparar com a §6.4 e a §6.6
 * ===========================================================================
 *
 * 1. **O `CT-413` carrega dois sub-casos além do que a §6.6 enumera** — o **resíduo binário** e o
 *    **corpo não vazio**. O primeiro é exigência registrada do Tech Review da T4; o que ele prova,
 *    porém, **não é** o que a exigência supunha, e a diferença foi **medida nesta task** — ver a
 *    seção seguinte. O segundo é o cenário 5 da §6.4, que não tem caso próprio na §6.5.
 * 1-b. **O `CT-413 (c)` não está na §6.6** e é a rede do critério §4-5 (*"o serviço não recalcula"*).
 *    A §6.5 registra a prova dele como *"revisão de diff"*, e revisão de diff não sobrevive à rodada
 *    seguinte. Ele é **asserção estática** sobre `apps/api/src/contratos/contrato.service.ts`, com a
 *    sensibilidade embutida e permanente — ver a seção seguinte para por que nenhum caso
 *    comportamental ocupa esse lugar.
 * 2. **O `CT-413 (b)` não está na §6.6**, e é o veículo do cenário 6 da §6.4 (*"falha após a
 *    gravação do estado → contrato `RASCUNHO`, imóvel intocado"*) e do pedido nominal do Tech Review
 *    da T5 (débito D24): *"um CT que asserte os dois sentidos na mesma unidade, e um negativo que
 *    reprove se apenas uma das duas escritas ocorrer"*. A razão de ele viver **na unidade de
 *    trabalho**, e não na rota, está na seção seguinte.
 * 3. **A recusa por estado é exercitada com UM estado, e não com a tabela das quatro transições.** A
 *    tabela é o `CT-415`, da **T8**, e antecipá-la aqui duplicaria a prova que aquela task existe
 *    para dar. O que este arquivo mede é o cenário 1 da §6.4 — reativar um contrato `ATIVO` —, que é
 *    o único alcançável sem a rota de cancelamento.
 * 4. **"Sem linha `error` no journal"** vale para os casos da T7 pelo mesmo discriminante observável
 *    que a divergência 4 da T6 registra: afirmar o corpo INTEIRO com `codigo: CAMPO_INVALIDO` ou
 *    `ACESSO_NEGADO` é afirmar que a resposta veio de um `ErroDeAplicacao`, e o filtro global só
 *    registra `logger.error` para o que **não** é `ErroDeAplicacao` — o que sairia como
 *    `500 ERRO_INTERNO`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T8 — leia antes de comparar com a §6.4 e a §6.6
 * ===========================================================================
 *
 * 1. **A classe `ErroDeTransicaoInvalida` não existe, e a §1 da task diz consumi-la da T7.** Ela
 *    nunca foi criada, e a ausência está **certa**: a §10.1 da tech spec fixa a **forma** da recusa
 *    (`CAMPO_INVALIDO | 422 | campo status | { estadoAtual, transicaoPedida }`), não a classe, e a
 *    §6.3 a lista apenas como *"Erro de Domínio Associado"* conceitual. `ContratoService.exigirEstado`
 *    já é o ponto único parametrizado, e criar a classe agora faria nascer uma **segunda guarda com
 *    uma segunda forma de recusa** sobre um `detalhes` que é contrato publicado. É o débito **D29
 *    (F2/T7)**, e o critério §4-6 da task (*"a guarda de estado tem UM ponto"*) é satisfeito
 *    exatamente pelo reuso — que os quatro sub-casos do `CT-415` medem por igualdade de corpo.
 * 2. **O `CT-415` não afirma `contratoVigente: null` no imóvel**, e a §6.6 da tech spec o menciona.
 *    O campo só entra em `esquemaDoImovel` na **T9**; até lá, a prova de que o imóvel foi liberado é
 *    ele responder `statusLocacao: 'DISPONIVEL'`, que é o que o oráculo governa. É a mesma
 *    divergência, pela mesma razão, que a T6 declarou para o `CT-408`.
 * 3. **A resposta do cancelamento não leva declaração de efeito**, e isso é **escolha**, não
 *    esquecimento: o CA-06 fala só da ativação, e a RN-12 diz literalmente *"a resposta da ativação
 *    declara isso explicitamente"*. A igualdade de corpo inteiro do `CT-415` **afirma a ausência** —
 *    uma chave `efeitos` acrescentada depois reprova ali.
 * 4. **O cancelamento em cascata das cobranças não é exercitado, porque ele cancela um conjunto
 *    vazio.** `negocio.cobranca` não existe nesta fatia; o efeito que **existe** — o imóvel voltar a
 *    `DISPONIVEL` — é o que o `CT-415` mede.
 * 5. **"Sem linha `error` no journal"** vale para os casos da T8 pelo mesmo discriminante observável
 *    das divergências 4 da T6 e 4 da T7: afirmar o corpo INTEIRO com `codigo: CAMPO_INVALIDO`,
 *    `ACESSO_NEGADO` ou `RECURSO_NAO_ENCONTRADO` é afirmar que a resposta veio de um
 *    `ErroDeAplicacao` — e o filtro global só registra `logger.error` para o que **não** é.
 *
 * ===========================================================================
 * O RESÍDUO BINÁRIO — o que foi MEDIDO, e por que a prova do §4-5 é ESTÁTICA
 * ===========================================================================
 *
 * A exigência do Tech Review da T4 dizia: *"se você inlinar a aritmética no serviço, nenhum teste
 * construído sobre o golden reprova, e o resíduo chega ao cliente em `valorTotalContrato` — dê ao
 * critério um caso com resíduo atravessando a rota"*. A primeira metade é verdade; **a segunda não
 * é**, e a medição está aqui porque a diferença decide onde a rede tem de morar.
 *
 * **Mutante MT7-1, medido nesta task** (`derivarValorTotal(atual.valorMensal, atual.prazoMeses)` →
 * `atual.valorMensal * atual.prazoMeses`, aplicado ao fonte e rodado por
 * `pnpm --filter @sysloc/api test`): **`145 passed`, zero falhas — o mutante SOBREVIVEU.** Incluindo o
 * sub-caso `(500.03, 13)`.
 *
 * A causa não é fraqueza da asserção: é o **`numeric(15,2)`**. O valor publicado é o que volta do
 * `RETURNING` da porta, e não o número calculado em memória. O produto exato de um valor de duas
 * casas por um inteiro tem **sempre** duas casas — nunca cai na borda de arredondamento —, e no teto
 * do domínio que `esquemaDeContratoNovo` admite o erro máximo do ponto flutuante é
 * `2^-52 × 9 999 999 999 999,99 ≈ 0,00222`, **menos da metade** dos `0,005` de que a divergência
 * precisaria. Medido, e não estimado. O domínio inteiro é seguro **por construção**.
 *
 * Daí as duas consequências que este arquivo materializa:
 *
 *   * **o sub-caso `(500.03, 13)` fica, com o papel corrigido.** Ele não separa a função pura da
 *     multiplicação — nada comportamental separa. O que ele prende é que o valor publicado é o
 *     **lido da linha gravada**, e não um número montado em memória: um serviço que devolvesse a
 *     derivação em vez do `RETURNING` entregaria `6500.389999999999`, e a igualdade de número mais o
 *     texto cru da resposta o reprovam. **Medido como MT7-1b** (a multiplicação ingênua *mais* a
 *     publicação do valor derivado): `1 failed`, no `CT-413`, `expected 6500.389999999999 to be
 *     6500.39`;
 *   * **o critério §4-5 ganha o `CT-413 (c)`, estático.** É a única forma de rede possível para uma
 *     propriedade que hoje **não tem consequência observável** — e é exatamente o caso em que o P4 do
 *     Protocolo Antirregressão manda registrar a decisão no ponto do código, em vez de declarar a
 *     prova como "revisão de diff". A indistinguibilidade é **de hoje**: ela depende do teto da
 *     coluna e do esquema, e um teto maior a desfaz.
 *
 * ===========================================================================
 * POR QUE O CT-413 (b) MORA NA UNIDADE DE TRABALHO, e não na rota
 * ===========================================================================
 *
 * O invariante sob prova é *"as duas escritas da ativação commitam juntas ou não commitam"*. Provar o
 * segundo sentido exige uma falha **entre** a gravação do estado e o commit — e a rota **não tem
 * entrada capaz de produzi-la**: a etapa que segue a gravação é `definirSituacaoDeLocacaoDoImovel`,
 * que só levanta quando o imóvel não é alcançado, e o imóvel de um contrato é sempre alcançável (a
 * chave estrangeira composta o garante, e a retirada de circulação é lógica — ela seria recusada uma
 * etapa antes).
 *
 * Fabricar essa entrada exigiria um símbolo de produção que existisse só para o teste enxergar a
 * falha, o que a **Lei do seam** (Iron Law #6) proíbe, e com razão: um ponto de injeção de falha numa
 * transição de estado é superfície forjável. O caso, então, exercita as **duas portas publicadas** —
 * `ativarContrato` e `definirSituacaoDeLocacaoDoImovel`, as MESMAS que o serviço chama — dentro de
 * uma unidade de trabalho que levanta antes de commitar, e observa o desfecho **pela rota**. Ele
 * prova a propriedade da unidade; o que prende o serviço a ela é a ausência de
 * `emUnidadeDeTrabalho` no serviço, medida pelo `CT-413` (as duas escritas acontecem) e pelo
 * `CT-414` (a falha da gravação não deixa o imóvel tocado).
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-408 — o corpo INTEIRO, em cada sub-caso.** A asserção é `toEqual` sobre o corpo completo, e
 * não a presença de campos: é ela que impede o UUID interno de vazar (a ADR-0017 dá ao contrato o
 * **código** como chave exposta) e é ela que prende `dataFimLocacao` e `valorTotalContrato` ao nulo —
 * um serviço que os derivasse na criação, em vez de na ativação, reprova aqui. Os três sub-casos de
 * fiador vivem no mesmo caso porque o que se mede é **um envio só**: separá-los convidaria o de zero
 * fiadores a ser esquecido, e é ele que prova que a coleção vazia é caso legítimo e não ausência.
 *
 * **CT-409 — a releitura byte a byte é o que separa "recusou" de "recusou e não gravou".** Asserir
 * apenas o `422` deixaria passar uma borda que gravasse os termos novos e recusasse depois. E o `PUT`
 * aceito no rascunho é o controle sem o qual "o `PUT` recusa" seria satisfeito por um `PUT` que recusa
 * sempre.
 *
 * **CT-410 — a substituição integral é medida pela AUSÊNCIA de F1.** Uma implementação que mesclasse
 * devolveria `[F1, F2, F3]` e passaria qualquer asserção de presença; a igualdade do vetor inteiro é o
 * que a reprova. A segunda metade prende o congelamento à guarda do **pai**: o corpo do `PUT` só troca
 * fiadores, e mesmo assim é recusado por `status`.
 *
 * **CT-411 — a contagem crua antes e depois.** É ela que distingue *"respondeu 422"* de *"respondeu
 * 422 **e não gravou**"*. Sem ela o caso passaria com um controlador que gravasse antes de validar. A
 * leitura é feita pela API pública do pacote de dados, sob o contexto de tenant, e conta **todas** as
 * linhas alcançáveis naquele contexto.
 *
 * **CT-411 (c) — o que discrimina é o PAR de ordens trocadas, não a linha isolada.** Todos os
 * fiadores nomeiam o **mesmo** campo, de modo que `campo: 'fiadoresIds'` não diz nada sobre ordem: a
 * prova está em `retirado_antes_do_ausente` e `ausente_antes_do_retirado` carregarem a **mesma dupla
 * de identificadores** em posições trocadas e receberem respostas de **forma diferente** (`422` com
 * `detalhes.circulacao` contra `404` sem campo). O retirado e o inalcançável ficam **fora da primeira
 * posição** nas duas primeiras linhas, e é isso que alcança a conferência em lote que perde o
 * identificador ausente — ele não está no resultado da consulta. O controle positivo em `201` fecha a
 * saída de uma conferência que recusasse sempre.
 *
 * **CT-417 — o estado inalterado nos três, e o imóvel ainda `LOCADO`.** A retirada de circulação do
 * contrato é de **visibilidade**: se ela transitasse estado, ou liberasse o imóvel, viraria porta
 * lateral para destravar o imóvel sem cancelar o contrato — e a segunda locação passaria. A
 * idempotência é afirmada por igualdade **profunda** entre a primeira e a segunda retirada: uma
 * implementação que reescrevesse `retirado_em` a cada chamada devolveria um instante diferente e
 * reprova aqui.
 *
 * **CT-418 — o retirado ausente da lista padrão e presente com o parâmetro.** O par é o que
 * discrimina: só a primeira metade seria satisfeita por uma listagem que escondesse tudo, e só a
 * segunda, por uma que nunca aplicasse o predicado. E `limite=201` **recusando** é o que separa esta
 * superfície de uma que trunca em silêncio.
 *
 * **CT-423 — a igualdade profunda entre os dois corpos é a prova, e o controle positivo é a outra
 * metade.** Dois `404` iguais provam que a borda não distingue "existe em outra empresa" de "não
 * existe"; sozinhos, seriam satisfeitos por uma borda que respondesse `404` a tudo — e é o controle,
 * em `201`, que fecha essa saída. As contagens sob os DOIS contextos são o que separa *"recusou"* de
 * *"recusou e não gravou"*, inclusive do lado da empresa dona do cadastro alheio.
 *
 * **CT-413 — o corpo INTEIRO, e os três sub-casos.** A igualdade do corpo prende as duas derivações
 * aos valores do golden e prende `efeitos` ao literal; a leitura do imóvel prende a segunda escrita.
 * O sub-caso do **resíduo binário** prende o valor publicado ao que voltou da gravação — a asserção é
 * de **igualdade de número**, nunca aproximação, porque `toBeCloseTo` aceitaria o resíduo que ele
 * persegue —, e o que ele **não** prova está medido na seção do resíduo, acima. O sub-caso do imóvel
 * `INDISPONIVEL` é o controle da assimetria: sem ele, uma recusa inventada ali passaria despercebida.
 *
 * **CT-413 (c) — a asserção estática, com a sensibilidade dentro do próprio caso.** Ela varre o fonte
 * do serviço com os comentários fora — sem isso, a prosa que explica por que a aritmética não existe
 * faria a asserção reprovar o código correto, que é o defeito literal registrado na
 * `.claude/rules/testing-stack.md`. E ela carrega as **duas** metades que uma asserção estática exige:
 * o predicado **acusa** a linha mutante escrita por extenso, e **não acusa** a linha legítima. Sem o
 * par, um predicado que nunca casasse nada passaria em silêncio para sempre.
 *
 * **CT-413 (b) — as duas metades do desfazimento, e nenhuma sozinha basta.** Afirmar só
 * `status: 'RASCUNHO'` seria satisfeito por uma implementação que gravasse o imóvel numa unidade
 * própria; afirmar só `statusLocacao: 'DISPONIVEL'` seria satisfeito pela recíproca. É o par, depois
 * da MESMA falha, que prova que as duas escritas estavam na mesma unidade — e o controle positivo do
 * `CT-413` fecha a saída de "nada nunca é gravado".
 *
 * **CT-412 — os DOIS momentos, e o segundo é o que a T7 acrescenta.** Recusar na montagem não diz
 * nada sobre a ativação: entre montar e fazer valer podem passar semanas, e a circulação é a única
 * das seis condições capaz de mudar nesse intervalo. A releitura do contrato depois da recusa é o que
 * separa "recusou" de "recusou e não gravou", e a leitura do imóvel é o que prova que a **segunda**
 * escrita também não aconteceu — uma implementação que ocupasse o imóvel antes de conferir a
 * circulação reprova ali, e em nenhuma outra linha.
 *
 * **CT-414 — o código do vigente é a informação que decide o próximo passo.** Asserir só o `422`
 * seria satisfeito por uma recusa genérica; o que o caso prende é `detalhes.conflito` **e** o código
 * do primeiro contrato, que é o que permite ao usuário saber o que cancelar. A releitura byte a byte
 * do vigente e do imóvel é o que separa "recusou" de "recusou depois de mexer no que já valia" — e é
 * ela o **negativo do par `ATIVO ⇔ LOCADO`**: a falha da gravação do estado não pode deixar a escrita
 * do imóvel para trás. O caso é **sequencial** de propósito; a prova sob concorrência é o `CT-407`,
 * no nível do banco, e nenhum dos dois substitui o outro.
 *
 * **CT-425 — a ausência da chave é AFIRMADA antes da tentativa.** Sem essa linha, o `403` poderia vir
 * de qualquer outra causa — a área faltando, a sessão restrita, um erro de caminho — e o caso não
 * provaria nada sobre a ação. O `201` do `POST` é a outra metade: ele mostra que montar continua
 * livre com só a área, que é exatamente a separação de poderes que a ADR-0019 existe para preservar.
 * E o eixo positivo final — concedida a ação à MESMA pessoa, a MESMA rota responde `200` — é o que
 * torna a mudança de comportamento atribuível à chave, e a nada mais.
 *
 * **CT-415 — o par de ordens é o que discrimina, e a carteira é a metade que ninguém escreve.** As
 * quatro transições inválidas nomeiam o **mesmo** campo (`status`), de modo que `campo: 'status'` não
 * diz nada: a prova está em `{ estadoAtual, transicaoPedida }` — e, sobretudo, no par
 * `cancelar-cancelado` / `ativar-cancelado`, que parte do **mesmo** `estadoAtual` e recebe
 * `transicaoPedida` diferente. Uma recusa que derivasse o ato do estado exigido passaria por três das
 * quatro linhas e reprovaria só nesse par. O caminho positivo tem as **duas** escritas asseridas — o
 * corpo inteiro e a situação do imóvel —, porque nada no banco as pareia: um cancelamento que não
 * liberasse o imóvel o deixaria **inlocável pela interface**, sem erro algum. E a leitura da
 * **carteira padrão** é o que separa *cancelar* de *apagar*: `GET /:codigo` continuaria verde num
 * cancelamento que, de passagem, retirasse o contrato de circulação.
 *
 * **CT-422 — a igualdade entre os dois corpos é a prova; o controle positivo é a outra metade.** Cada
 * uma das cinco operações é executada **duas vezes** pela sessão de B — sobre o código de A e sobre um
 * código inexistente —, e o que se afirma é que as duas respostas são profundamente iguais: é isso, e
 * não o `404` isolado, que prova que a borda **não distingue** "existe em outra empresa" de "não
 * existe". Sozinhas, as dez respostas seriam satisfeitas por uma borda que responde `404` a tudo, e é
 * o controle — A relendo o contrato intacto, com o imóvel ainda `LOCADO` — que fecha essa saída. As
 * **quatro chaves em B** são pré-condição do caso, e não zelo: sem elas a guarda responderia `403`
 * antes de a política do banco entrar em jogo, e nada aqui mediria isolamento.
 *
 * **CT-434 — o que discrimina é o PAR de passos, e nenhum dos dois basta sozinho.** O defeito tem
 * duas metades — o campo aceito no corpo e a coluna escrita pela porta —, e cada passo mata **uma**.
 * O passo 1 (`PUT` **com** o campo → `422` nomeando `corpo`) morre com o esquema devolvido; o passo 2
 * (`PUT` **sem** o campo, corrigindo o endereço → `LOCADO` preservado) morre com a escrita devolvida
 * à porta. Uma asserção que só olhasse o corpo da resposta do passo 1 **não distinguiria** "o campo
 * foi recusado" de "o campo foi aceito e ignorado" — e é por isso que o passo 2 compara o imóvel
 * **inteiro**, e não o campo. As duas medições estão na seção de mutantes acima.
 *
 * O `exigirFontesConcordantes` é a forma da invariante que o caso persegue: *"nenhuma resposta traz
 * `statusLocacao: 'DISPONIVEL'` junto de `contratoVigente` preenchido"* é afirmação sobre **todos** os
 * corpos observados, e ela é conferida nos dois sentidos — o imóvel `LOCADO` sem contrato vigente é a
 * metade espelhada do mesmo defeito.
 *
 * E o **eixo positivo** depois do cancelamento é o que fecha a saída de "a rota recusa sempre": a
 * MESMA requisição que foi recusada com o imóvel locado responde `200` quando o contrato deixa de
 * valer, o que torna a recusa atribuível ao contrato vigente e a nada mais.
 *
 * **CT-426 — o eixo é a INDEPENDÊNCIA entre as duas ações, e é por isso que a sessão TEM a de
 * ativar.** Ela ativa com `200` no mesmo fluxo, o que torna o `403` do cancelamento atribuível à
 * chave que falta — e não a uma sessão que não alcança transição alguma. A asserção literal sobre
 * `detalhes.exigido` é o que acusa a rota que declarasse a ação da vizinha logo acima no controlador:
 * com `ACAO:ativar_contrato` no efetivo, uma exigência copiada responderia `200` ao cancelamento.
 *
 * ===========================================================================
 * MUTANTES DA T8 (2026-08-09) — os cinco reprovam, cada um numa asserção diferente
 * ===========================================================================
 *
 * Todos aplicados ao fonte de produção e invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth`, `@sysloc/db` e `@sysloc/contracts` pela fronteira do pacote. **Controle**:
 * `21 arquivos, 151 casos, 0 falhas`.
 *
 *   * **MT8-1 · a SEGUNDA escrita some** (`definirSituacaoDeLocacaoDoImovel` neutralizada em
 *     `cancelar`): `2 failed | 149 passed`, no **`CT-415`** e no **`CT-426`**, os dois com
 *     `expected 'LOCADO' to be 'DISPONIVEL'`. É o espelho exato do `MT7-2`, e o desfecho é pior de
 *     perceber: o imóvel ficaria `LOCADO` sem contrato vigente, isto é, **inlocável pela interface**,
 *     sem que nada acusasse. Que o `CT-426` também o pegue não é redundância — ele mede o eixo
 *     positivo depois da concessão da chave, e prova que a liberação acontece na rota, não no arranjo;
 *   * **MT8-2 · a guarda de estado some do CANCELAMENTO** (`exigirEstado` neutralizada em
 *     `cancelar`): `1 failed | 150 passed`, no **`CT-415`** — `expected 200 to be 422`, já na
 *     PRIMEIRA transição inválida, com o corpo do rascunho **cancelado** na mensagem
 *     (`status: 'CANCELADO'`, `dataFimLocacao: null`). É a prova de que a ordem do caso importa:
 *     `cancelar-rascunho` roda antes de o contrato existir em qualquer outro estado, e um rascunho
 *     cancelado é um contrato que **nunca valeu** e já está morto;
 *   * **MT8-3 · a rota exige a AÇÃO DA VIZINHA DE CIMA** (`ACAO:cancelar_contrato` →
 *     `ACAO:ativar_contrato`): `2 failed | 149 passed`, no **`CT-320 (c)`** de
 *     `test/autorizacao-do-dominio.e2e.spec.ts` — `expected 200 to be 403`, isto é, quem pode ativar
 *     passaria a **cancelar** — e no **`CT-426`**, na mesma forma, porque a sessão dele **tem** a
 *     ação de ativar. É o par que justifica o `CT-320 (c)` existir;
 *   * **MT8-4 · a rota exige a AÇÃO DA VIZINHA DE BAIXO** (`ACAO:cancelar_contrato` →
 *     `ACAO:excluir_cadastro`): `2 failed | 149 passed`, e os dois falham de formas **diferentes** —
 *     o `CT-320 (c)` com `expected 200 to be 403` (a escalada: quem administra a circulação passaria
 *     a destravar imóveis, que é o que a ADR-0019 rejeita nominalmente) e o `CT-426` na **igualdade
 *     do corpo** da recusa, porque a sessão dele não tem aquela ação e recebe `403` com o `exigido`
 *     errado. É a divisão de trabalho entre os dois casos, medida: um acusa a forma, o outro mostra
 *     a escalada;
 *   * **MT8-5 · a declaração do MÉTODO SUBSTITUI a da classe** (`@ExigeChaves(AREA, ACAO)` →
 *     `@ExigeChave(ACAO)`) — o defeito literal que a **ADR-0018** nasceu para impedir: `1 failed |
 *     150 passed`, no **`CT-355`** de `test/cobertura-de-autorizacao.e2e.spec.ts`, nomeando o
 *     manipulador: *"declaração de método que SUBSTITUI a da classe: ContratoController.cancelar"*.
 *     Note que os casos comportamentais **sobreviveriam** a ele (`MAPA_ACAO_TELA` leva
 *     `ACAO:cancelar_contrato` à própria `TELA:contratos`, de modo que a área seria exigida por
 *     acidente) — é a prova por estrutura que fecha essa direção;
 *   * **MT8-6 · a recusa por vínculo INVENTADA na retirada de imóvel** (`ImovelService
 *     .definirCirculacao` passa a recusar quando `statusLocacao === 'LOCADO'`): `1 failed | 150
 *     passed`, no **`CT-416`** de `test/circulacao-de-cadastro.e2e.spec.ts` —
 *     `a retirada do imóvel ocupado foi recusada: {"codigo":"CAMPO_INVALIDO",…}: expected 422 to be
 *     200`. É a medição que torna a asserção de **ausência** daquele caso falsificável: a forma
 *     "cuidadosa" e errada de tratar o vínculo produz exatamente este `4xx`, e é ela que a ADR-0014
 *     proíbe;
 *   * **reversão** — os três fontes foram restaurados dos backups e conferidos idênticos ao original
 *     por `diff -q`, `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * ===========================================================================
 * MUTANTES DA T7 (2026-08-09) — cinco reprovam, e DOIS sobrevivem por razão medida
 * ===========================================================================
 *
 * Todos aplicados ao fonte de produção e invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth`, `@sysloc/db` e `@sysloc/contracts` pela fronteira do pacote. **Controle**:
 * `21 arquivos, 146 casos, 0 falhas`.
 *
 *   * **MT7-1 · o serviço INLINA a multiplicação** (`derivarValorTotal(…)` →
 *     `atual.valorMensal * atual.prazoMeses`): `1 failed | 145 passed`, no **`CT-413 (c)`** —
 *     `expected [ Array(1) ] to deeply equal []`, com a linha ofensora nomeada. **Nenhum caso
 *     comportamental o alcança**, e a razão está medida na seção do resíduo, acima: é ele que
 *     justifica a asserção estática existir;
 *   * **MT7-1b · a multiplicação ingênua PUBLICADA no lugar do valor lido** (o mutante acima mais
 *     `valorTotalContrato: derivacoes.valorTotalContrato` no corpo devolvido): `2 failed | 144
 *     passed`, no **`CT-413`** — `expected 6500.389999999999 to be 6500.39` — e no `CT-413 (c)`. É
 *     este par que fixa o papel real do sub-caso do resíduo: ele prende o valor publicado ao que
 *     voltou da gravação;
 *   * **MT7-2 · a SEGUNDA escrita some** (`definirSituacaoDeLocacaoDoImovel` neutralizada em
 *     `ativar`): `3 failed | 143 passed`, no **`CT-413`**, no **`CT-414`** e no **`CT-425`**, os três
 *     com `expected 'DISPONIVEL' to be 'LOCADO'`. É o sentido *ativar ⇒ imóvel `LOCADO`* do par que o
 *     Tech Review da T5 pediu (débito D24), medido em três pontos independentes;
 *   * **MT7-3 · a escrita do imóvel corre ANTES da gravação do estado** (etapas 6 e 7 trocadas):
 *     `146 passed`, **SOBREVIVEU** — e o verde é a propriedade, não a falta dela: as duas escritas
 *     correm na **mesma unidade**, de modo que a falha da gravação desfaz também a do imóvel,
 *     qualquer que seja a ordem. Quem prende essa propriedade é o `CT-413 (b)`, e o mutante que a
 *     reprovaria — as duas escritas em unidades **separadas** — é **irrepresentável no serviço**: ele
 *     não recebe `AcessoAoBanco`, e a ausência do construtor é o mecanismo (decisão D1);
 *   * **MT7-4 · a rota exige a AÇÃO ERRADA** (`ACAO:ativar_contrato` → `ACAO:excluir_cadastro` na
 *     conjunção): `2 failed | 144 passed`, no **`CT-320 (b)`** de
 *     `test/autorizacao-do-dominio.e2e.spec.ts` — `expected 200 to be 403`, isto é, quem administra a
 *     circulação passaria a **ativar contratos** — e no **`CT-425`**, na igualdade do corpo da
 *     recusa. É o par que justifica o `CT-320 (b)` existir: o `CT-425` sozinho acusa a forma da
 *     recusa, e só o outro mostra a **escalada**;
 *   * **MT7-5 · a reconferência de circulação some da ATIVAÇÃO** (a chamada removida de `ativar`,
 *     com a da montagem intacta): `1 failed | 145 passed`, no **`CT-412`** —
 *     `imovelId (ativar): expected 200 to be 422`. É a metade que a T7 acrescenta: sem ela, o
 *     intervalo entre montar e fazer valer ficaria sem prova alguma;
 *   * **MT7-6 · a guarda de estado some da ATIVAÇÃO** (`exigirEstado` neutralizada em `ativar`):
 *     `1 failed | 145 passed`, no **`CT-414`** — `expected 200 to be 422`, no passo 4. É a máquina de
 *     estados que o sistema antigo **não tem**, e cuja divergência é deliberada;
 *   * **reversão** — os dois fontes foram restaurados dos backups e conferidos idênticos ao original
 *     por `diff -q`, `pnpm build` refeito, e o controle voltou a `146 passed`.
 *
 * ===========================================================================
 * MUTANTES DA T6 (2026-08-09) — os oito reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicados ao fonte de produção, com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso — este arquivo carrega `@sysloc/auth`, `@sysloc/db` e `@sysloc/contracts` pela fronteira do
 * pacote, e um `vitest run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `21 arquivos, 138 casos, 0 falhas`;
 *   * **MT6C-1 · a MONTAGEM deixa de conferir os cadastros** (a chamada a
 *     `exigirCadastrosAlcancaveisEEmCirculacao` removida de `ContratoService.criar`):
 *     `2 failed | 136 passed`, no **CT-423** (`expected 500 to be 404`) e no **CT-411 (b)**
 *     (`imovelId: expected 201 to be 422`). O `500` é literalmente o modo de falha que o cabeçalho do
 *     serviço nomeia: a chave estrangeira composta continua recusando a linha, e é essa a diferença
 *     entre **segurança** e **contrato** — o erro de driver diria ao cliente que o identificador
 *     existe em algum lugar;
 *   * **MT6C-2 · a conferência perde a metade da CIRCULAÇÃO** (o ramo `retiradoEm !== null`
 *     neutralizado, com o alcance intacto): `1 failed | 137 passed`, no **CT-411 (b)** —
 *     `imovelId: expected 201 to be 422`. O `CT-423` fica **verde** aqui, e é o par MT6C-1/MT6C-2 que
 *     prova que as duas metades da conferência são independentes;
 *   * **MT6C-2b · a conferência sai só da ALTERAÇÃO** (a chamada removida de
 *     `ContratoService.alterar`, com a da criação intacta): `1 failed | 137 passed`, no
 *     **CT-411 (b)**, agora em `imovelId: expected 200 to be 422` — a **metade 2** do caso. É este par
 *     que justifica a metade 2 existir: sem ela, o `PUT` seria a porta por onde entraria o vínculo que
 *     a montagem recusa, e o mutante atravessaria a suíte inteira;
 *   * **MT6C-3 · a guarda de estado da RD-05 é neutralizada** (`exigirAlteravel` retornando sempre):
 *     `2 failed | 136 passed`, no **CT-409** (`ATIVO: expected 200 to be 422`) e no **CT-410**
 *     (`expected 200 to be 422`). O segundo é o que prende o congelamento dos fiadores à guarda do
 *     **pai**, e não a uma regra de sub-recurso;
 *   * **MT6C-4 · `publicarContrato` volta a espalhar** (`...contrato` antes da cópia campo a campo):
 *     `3 failed | 135 passed`, no **CT-408**, no **CT-409** e no **CT-418**, os três com a chave
 *     `+ "id"` nomeada no diff da igualdade. É **o defeito literal que a ADR-0017 existe para
 *     impedir** — o UUID interno vazando ao lado da chave exposta —, e ele é invisível para qualquer
 *     asserção de presença: só a igualdade de corpo INTEIRO o pega;
 *   * **MT6C-5 · o predicado de circulação da listagem é invertido**
 *     (`{ incluirRetirados: !incluirRetirados }` no controlador): `1 failed | 137 passed`, no
 *     **CT-418** — `expected { codigo: 'CTR-…' } to be undefined`, isto é, o contrato retirado
 *     aparecendo na lista padrão. É o par "ausente por padrão / presente quando pedido" fazendo o
 *     trabalho: uma asserção só da primeira metade seria satisfeita por uma listagem que escondesse
 *     tudo;
 *   * **reversão** — os dois fontes foram restaurados dos backups e conferidos idênticos ao original
 *     por `diff -q`, e o controle voltou a `138 passed`.
 *
 * **Rodada 2 — os DOIS modos de falha próprios da leitura EM LOTE.** Controle da rodada:
 * `21 arquivos, 139 casos, 0 falhas`. Os dois foram aplicados ao laço final de
 * `exigirCadastrosAlcancaveisEEmCirculacao`, e **nenhum deles é alcançado pelos seis acima** nem pelo
 * `CT-411 (b)` — que tem um fiador só, e na primeira posição:
 *
 *   * **MT6C-6 · a iteração passa a correr sobre o RESULTADO da consulta**
 *     (`for (const fiador of fiadores.values())`): `1 failed | 138 passed`, no **CT-411 (c)** —
 *     `ausente_no_meio: expected 500 to be 404`. O `500` é o mesmo modo de falha do MT6C-1, e por
 *     motivo idêntico: o identificador inalcançável **não está** no resultado, a conferência não
 *     acontece, e quem recusa a linha passa a ser a chave estrangeira composta — erro de driver, que
 *     diria ao cliente que aquele identificador existe em algum lugar;
 *   * **MT6C-7 · o lote confere "todos presentes?" ANTES da circulação** (uma passada de ausência
 *     sobre a entrada inteira, e só depois a de circulação — que é o jeito natural de escrever o
 *     lote): `1 failed | 138 passed`, no **CT-411 (c)** — `retirado_antes_do_ausente: expected 404 to
 *     be 422`. É o par de ordens trocadas fazendo o trabalho: a **mesma dupla** de identificadores
 *     recebe respostas de forma diferente conforme a posição, e uma asserção só de
 *     `campo: 'fiadoresIds'` não distinguiria nada, porque todos os fiadores nomeiam o mesmo campo;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `139 passed`.
 *
 * ===========================================================================
 * O ARRANJO DE ESTADO É ESCRITO PELA PORTA, e isso é deliberado
 * ===========================================================================
 *
 * `ATIVO` e `CANCELADO` só têm rota a partir da T7 e da T8. Os contratos que os casos precisam nesses
 * estados são montados chamando `ativarContrato` e `cancelarContrato` — as portas que a **T5 já
 * publicou** — sob o contexto de tenant, dentro da unidade de trabalho. É montagem de precondição por
 * mecanismo já publicado, e não superfície privilegiada: **nada é acrescentado a `apps/api/src/**` para
 * que estas provas existam** (Iron Law #6), e nenhuma coluna é escrita por `UPDATE` avulso.
 *
 * O imóvel do contrato ativo recebe `LOCADO` pela porta estreita `definirSituacaoDeLocacaoDoImovel`,
 * pela mesma razão: é o efeito que a ativação da T7 produzirá, e o `CT-417` precisa dele para medir
 * que a retirada **não** o desfaz. As duas derivações da ativação entram como **valores literais**, e
 * não calculadas por `derivarTerminoDaLocacao`/`derivarValorTotal`: o que este arquivo mede não é a
 * derivação — ela tem prova própria em `packages/db/test/derivacao-de-contrato.spec.ts` —, e derivá-las
 * aqui acoplaria o arranjo ao SUT de outra task.
 *
 * ===========================================================================
 * Precondição privilegiada — pelo caminho REAL, sem símbolo novo e sem cookie forjado
 * ===========================================================================
 *
 * As sessões que agem são de pessoas `USUARIO_EMPRESA` **da carga** — uma em cada empresa —, abertas
 * pela rota pública de entrada. A matriz do perfil delas é o piso (`TELA:resumo`), de modo que as
 * chaves abaixo **faltam de fato** e a concessão por `escreverAjustes` — sob o contexto de tenant da
 * empresa correspondente, dentro da unidade de trabalho e com `validarCoerenciaDeAjustes` — é
 * precondição real, e não ruído:
 *
 *   * `TELA:contratos` — a área que a classe do controlador de contrato exige;
 *   * `TELA:imoveis` e `TELA:cadastros` — as áreas das rotas que **montam o arranjo** (conjunto,
 *     imóvel, locador, locatário e fiadores nascem pelas rotas reais, nunca por escrita direta);
 *   * `ACAO:excluir_cadastro` — a ação sensível que as duas rotas de circulação exigem **além** da
 *     área, e sem a qual o `CT-417` não conseguiria retirar contrato algum. `TELA:cadastros` é
 *     **obrigatória junto dela**, e não por escolha deste arquivo: a RN-02 do catálogo mapeia
 *     `ACAO:excluir_cadastro → TELA:cadastros`, e `validarCoerenciaDeAjustes` recusa o conjunto que
 *     deixasse a ação órfã.
 *
 * O efetivo é **afirmado** por `GET /v1/sessao` antes do fluxo, para as **duas** sessões: sem essa
 * linha, um `403` inesperado seria indistinguível de um defeito das rotas.
 *
 * **Nenhuma rota recebe `empresaId`** — a empresa de cada operação sai da sessão, e é exatamente isso
 * que o `CT-423` explora.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real** (`criarAplicacao`,
 * de `src/main.ts`). A porta é **reservada** (trava atômica), e não dinâmica, porque o arcabouço
 * confere a origem das requisições com cookie contra o endereço base, composto a partir da porta
 * CONFIGURADA.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  ativarContrato,
  cancelarContrato,
  contextoDeTenant,
  definirSituacaoDeLocacaoDoImovel,
  EMPRESA_A,
  EMPRESA_B,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { varrerArquivos } from '../../../packages/db/test/varredura-de-fontes.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de contratos — a superfície desta task. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A rota do Admin por onde nasce o sujeito exclusivo do `CT-425`. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/** A rota de troca de senha **do produto** — a que baixa a marca de senha provisória (RN-09). */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A senha definitiva com que a pessoa criada pelo Admin passa a operar. */
const SENHA_TROCADA = 'brisa9Verde!';

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/**
 * O arranjo concedido às duas sessões.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum. `TELA:cadastros`
 * está aqui por obrigação do catálogo, não por escolha — ver a precondição privilegiada no cabeçalho.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:contratos',
  'TELA:imoveis',
  'TELA:cadastros',
  'ACAO:excluir_cadastro',
  'ACAO:ativar_contrato',
  'ACAO:cancelar_contrato',
];

/** A área que a classe do controlador de contrato exige — afirmada no efetivo, nunca suposta. */
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';

/** A ação sensível que as duas rotas de circulação exigem — afirmada no efetivo, nunca suposta. */
const ACAO_DE_CIRCULACAO: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/**
 * A ação sensível que a rota de ativação exige **além** da área (ADR-0019) — afirmada no efetivo.
 *
 * Ela **já existia** no catálogo fechado desde a fase de autorização, e a T7 não cria chave alguma.
 * O literal é escrito aqui e não importado do controlador: derivá-lo do SUT faria a asserção
 * concordar consigo mesma, e trocar a exigência da rota deixaria de reprovar caso algum.
 */
const ACAO_DE_ATIVACAO: ChaveDoCatalogo = 'ACAO:ativar_contrato';

/**
 * A ação sensível que a rota de **cancelamento** exige além da área (ADR-0019) — afirmada no efetivo.
 *
 * Ela é **outra** que não a de ativar, e a distinção é o eixo do `CT-426`: conceder o poder de fazer
 * valer não concede o de desfazer. Como a de ativar, ela já existia no catálogo fechado, e a T8 não
 * cria chave alguma. O literal é escrito aqui e não importado do controlador, pela mesma razão de
 * sempre — derivá-lo do SUT faria a asserção concordar consigo mesma.
 */
const ACAO_DE_CANCELAMENTO: ChaveDoCatalogo = 'ACAO:cancelar_contrato';

/**
 * A forma do código legível — `CTR-{ano}-{5 dígitos}` (RN-04).
 *
 * Escrita por extenso, e **não** importada de `@sysloc/contracts`: derivá-la da mesma expressão que o
 * SUT usa para validar faria a asserção concordar consigo mesma, e a largura de cinco dígitos — que
 * carrega marcador `DECISÃO FECHADA` no pacote — deixaria de ser afirmada por este lado.
 */
const PADRAO_DO_CODIGO = /^CTR-\d{4}-\d{5}$/u;

/**
 * O endereço corrigido pelo `PUT` do `CT-434` — a alteração mais inofensiva que existe no cadastro.
 *
 * Corrigir o endereço é o vetor **do defeito de origem**: era ele que, antes da T10, apagava o
 * `LOCADO` em silêncio. Os valores são escritos por extenso e diferem dos do arranjo, porque a
 * asserção compara o imóvel inteiro e um valor repetido tornaria a mudança invisível.
 */
const LOGRADOURO_CORRIGIDO = 'Avenida Paulista';
const NUMERO_CORRIGIDO = '1578';

/**
 * O campo que a recusa da rota de situação nomeia, e o discriminador que ela carrega (§10.1).
 *
 * Literais, e **não** importados do serviço: os dois são contrato publicado, e derivá-los do SUT
 * faria a asserção concordar consigo mesma. O valor do conflito é o **mesmo** que a ativação já
 * publica ao recusar o segundo contrato sobre o mesmo imóvel — é uma classe de recusa só, com um
 * vocabulário só, e é isso que esta coincidência afirma.
 */
const CAMPO_DA_SITUACAO = 'statusLocacao';
const CONFLITO_DE_VIGENCIA = 'IMOVEL_COM_CONTRATO_VIGENTE';

/** Um código bem formado que não corresponde a contrato algum — o controle do `404`. */
const CODIGO_INEXISTENTE = 'CTR-1999-99999';

/** Um código fora do formato: quatro dígitos no sequencial, e não cinco — o controle do `422`. */
const CODIGO_MALFORMADO = 'CTR-2026-0001';

/** Um UUID bem formado que não corresponde a cadastro algum — o controle da recusa indistinguível. */
const UUID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** Os termos que todo contrato deste arquivo carrega, salvo quando o caso os varia de propósito. */
const DATA_DE_INICIO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;

/**
 * As duas derivações que a ativação grava, como **valores literais** do arranjo.
 *
 * Elas não são calculadas aqui: o que este arquivo mede não é a derivação (ela tem prova própria em
 * `packages/db/test/derivacao-de-contrato.spec.ts`), e calculá-la acoplaria o arranjo ao SUT da T7.
 * Os valores correspondem a `2026-01-15` mais doze meses e a `2500 × 12`.
 */
const DATA_DE_FIM_DA_ATIVACAO = '2027-01-14';
const VALOR_TOTAL_DA_ATIVACAO = 30_000;

/**
 * O cenário de **virada de mês** do `CT-413`, com o desfecho escrito por extenso.
 *
 * É o mesmo par do `CT-401` e o mesmo do golden: `2026-01-31` mais um mês **satura** em `2026-02-28`
 * (fevereiro não tem 31) e o passo terminal de menos um dia leva a `2026-02-27`. Os valores são
 * literais e **não** derivados de `derivarTerminoDaLocacao`: derivá-los faria a asserção concordar
 * com o SUT, e a saturação — que é justamente o que o oráculo governa — deixaria de ser afirmada por
 * este lado.
 */
const INICIO_NA_VIRADA = '2026-01-31';
const PRAZO_DE_UM_MES = 1;
const VALOR_MENSAL_REDONDO = 1500;
const FIM_DERIVADO_NA_VIRADA = '2026-02-27';
const TOTAL_DERIVADO_REDONDO = 1500;

/**
 * O cenário do **resíduo binário** — o par que separa a função pura da multiplicação ingênua.
 *
 * `500.03 * 13` em ponto flutuante dá **`6500.389999999999`**; o valor correto, obtido multiplicando
 * centavos inteiros, é **`6500.39`**. O golden **não** distingue os dois — a forma ingênua acerta os
 * 23 cenários dele —, de modo que este é o único vetor desta suíte capaz de reprovar um serviço que
 * inlinasse a conta. A asserção é de **igualdade de número**: `toBeCloseTo` aceitaria o defeito.
 *
 * O término é o mesmo mês de destino do cenário acima, treze meses adiante: `2026-01-31` mais 13
 * meses satura em `2027-02-28` (2027 não é bissexto) e menos um dia dá `2027-02-27`.
 */
const PRAZO_COM_RESIDUO = 13;
const VALOR_MENSAL_COM_RESIDUO = 500.03;
const FIM_DERIVADO_COM_RESIDUO = '2027-02-27';
const TOTAL_DERIVADO_SEM_RESIDUO = 6500.39;
const TOTAL_INGENUO_COM_RESIDUO = 6500.389999999999;

/** A declaração de efeito que a resposta da ativação carrega — o literal que a F3 terá de afrouxar. */
const EFEITOS_ESPERADOS = { cobrancasGeradas: false };

/** O fonte que o `CT-413 (c)` audita — o serviço, e só ele. Ausência levanta em `varrerArquivos`. */
const FONTE_DO_SERVICO_DE_CONTRATO = fileURLToPath(
  new URL('../src/contratos/contrato.service.ts', import.meta.url),
);

/**
 * O que caracteriza aritmética de **dinheiro ou de prazo** escrita no serviço.
 *
 * Ela casa um dos dois campos adjacente a um operador aritmético, nos dois sentidos — é a forma que
 * a multiplicação inlinada teria, qualquer que fosse a ordem dos fatores. Os operadores de
 * **comparação** ficam de fora de propósito: as condições de entrada da RD-08 comparam prazo e valor
 * com zero, e são legítimas.
 */
const ARITMETICA_DE_DINHEIRO_OU_PRAZO =
  /\b(?:valorMensal|prazoMeses)\b\s*[*+/-]|[*+/-]\s*[\w.]*\b(?:valorMensal|prazoMeses)\b/u;

/**
 * O que caracteriza aritmética de **instante** escrita no serviço.
 *
 * As três formas de construir ou deslocar um instante. `Date` **como anotação de tipo** não é casada
 * — `exigirEmCirculacao` recebe `{ retiradoEm: Date | null }`, e proibir a palavra faria a asserção
 * reprovar o código correto, que é exatamente o modo de falha que a prova de falsificação existe para
 * pegar.
 */
const CONSTRUCAO_DE_INSTANTE = /\bnew\s+Date\s*\(|\bDate\.(?:UTC|now|parse)\b/u;

/**
 * As quatro linhas da sensibilidade do `CT-413 (c)`, escritas por extenso.
 *
 * As mutantes são as formas que o defeito teria; as legítimas são as linhas que o serviço de fato
 * tem. É o **par** que prova o predicado: sozinho, o negativo seria satisfeito por um predicado que
 * nunca casa, e o positivo, por um que casa tudo.
 */
const LINHA_MUTANTE_DO_PRODUTO = 'valorTotalContrato: atual.valorMensal * atual.prazoMeses,';
const LINHA_LEGITIMA_DO_PRODUTO =
  'valorTotalContrato: derivarValorTotal(atual.valorMensal, atual.prazoMeses),';
const LINHA_MUTANTE_DA_DATA = 'const fim = new Date(Date.UTC(ano, mes - 1, dia));';
const LINHA_LEGITIMA_DA_DATA =
  'dataFimLocacao: derivarTerminoDaLocacao(atual.dataInicioLocacao, atual.prazoMeses),';

/**
 * A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:contratos`, que é o que torna a concessão do
 * arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial da de A.
 *
 * Ela é a outra ponta da prova de isolamento do `CT-423`. Nenhuma rota recebe a empresa dela: o que
 * separa uma sessão da outra é o cookie, e é a guarda que publica o contexto a partir da sessão.
 */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

/**
 * O Admin da empresa A — usado **apenas** para fazer nascer o sujeito exclusivo do `CT-425`.
 *
 * A carga tem uma única pessoa `USUARIO_EMPRESA` na empresa A, e ela é a {@link QUEM_AGE}. O sujeito
 * do `CT-425` precisa de efetivo próprio (ele altera a permissão dele no eixo positivo), e
 * compartilhá-lo faria os demais casos observarem uma chave que este concedeu. A pessoa nova nasce
 * pela **rota real** do Admin, como em `test/circulacao-de-cadastro.e2e.spec.ts`.
 */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  cookieDeB = await entrar(QUEM_AGE_EM_B.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE_EM_B.id, EMPRESA_B.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas
  // abaixo seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
    expect(sessao.acoes).toContain(ACAO_DE_CIRCULACAO);
    expect(sessao.acoes).toContain(ACAO_DE_ATIVACAO);
    expect(sessao.acoes).toContain(ACAO_DE_CANCELAMENTO);
  }
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('cadastro de contratos de locação (T6)', () => {
  it(
    'CT-408 — o POST cria o contrato como RASCUNHO num envio só, com zero, um ou três fiadores',
    async () => {
      // A tabela dos três sub-casos: o que muda entre eles é **quantos** fiadores acompanham o envio.
      for (const quantos of [0, 1, 3]) {
        const rotulo = `${String(quantos)} fiador(es)`;
        const partes = await montarPartes(cookie, quantos);

        const criacao = await pedir(COLECAO_DE_CONTRATOS, {
          metodo: 'POST',
          cookie,
          corpo: corpoDeContrato(partes),
        });

        expect(criacao.status, rotulo).toBe(201);

        const criado = criacao.corpo as ContratoPublicado;

        // Corpo INTEIRO por igualdade: um campo a mais — o UUID interno, ou a coluna `empresa_id`
        // vazando — reprova aqui, e não numa asserção de presença. `dataFimLocacao` e
        // `valorTotalContrato` são afirmados NULOS: eles nascem na ativação (RD-10), e um serviço que
        // os derivasse na criação reprova nesta linha.
        expect(criado, rotulo).toEqual({
          codigo: criado.codigo,
          status: 'RASCUNHO',
          imovelId: partes.imovelId,
          locadorId: partes.locadorId,
          locatarioId: partes.locatarioId,
          fiadores: partes.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
          dataInicioLocacao: DATA_DE_INICIO,
          prazoMeses: PRAZO_EM_MESES,
          valorMensal: VALOR_MENSAL,
          diaVencimento: DIA_DE_VENCIMENTO,
          dataFimLocacao: null,
          valorTotalContrato: null,
          gerarCobrancasAutomaticamente: true,
          pdfContratoArquivo: null,
          retiradoEm: null,
        });

        // E o código é de fato da série, e não uma cadeia qualquer que a linha acima aceitaria por
        // concordar consigo mesma. A largura de CINCO dígitos é conteúdo — ver o marcador
        // `DECISÃO FECHADA` de `packages/contracts/src/contrato.ts`.
        expect(criado.codigo, rotulo).toMatch(PADRAO_DO_CODIGO);

        // A releitura pelo CÓDIGO devolve o mesmo agregado: é o que prova que a chave exposta alcança
        // o recurso, e que a resposta da criação não é um objeto montado só para ela.
        const leitura = await pedir(`${COLECAO_DE_CONTRATOS}/${criado.codigo}`, { cookie });
        expect(leitura.status, rotulo).toBe(200);
        expect(leitura.corpo, rotulo).toEqual(criado);

        // --- O rascunho AINDA NÃO VALE ----------------------------------------------------------
        //
        // O sub-caso do card afirma `contratoVigente: null` no imóvel; o campo só entra no esquema na
        // T9. Até lá, o discriminante observável é a situação de locação: um serviço que ocupasse o
        // imóvel já na montagem — em vez de na ativação — devolveria `LOCADO` aqui.
        const imovel = await pedir(
          `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/${partes.imovelId}`,
          { cookie },
        );
        expect(imovel.status, rotulo).toBe(200);
        expect((imovel.corpo as { statusLocacao: string }).statusLocacao, rotulo).toBe(
          'DISPONIVEL',
        );
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-409 — alterar rascunho preserva o código; ATIVO e CANCELADO recusam sem gravar nada',
    async () => {
      const doRascunho = await montarPartes(cookie, 1);
      const doAtivo = await montarPartes(cookie, 1);
      const doCancelado = await montarPartes(cookie, 1);
      const destino = await montarPartes(cookie, 2);

      const rascunho = await criarContratoPor(cookie, doRascunho);
      const ativo = await criarContratoPor(cookie, doAtivo);
      const cancelado = await criarContratoPor(cookie, doCancelado);

      await ativarPelaPorta(EMPRESA_A.id, ativo.codigo, doAtivo.imovelId);
      await cancelarPelaPorta(EMPRESA_A.id, cancelado.codigo);

      // --- Passo 1: o `PUT` sobre o RASCUNHO ----------------------------------------------------
      //
      // O corpo é COMPLETO e diferente em tudo o que pode mudar — partes, termos e fiadores —, para
      // que a asserção seguinte prove que a alteração de fato persistiu.
      const alteracao = await pedir(`${COLECAO_DE_CONTRATOS}/${rascunho.codigo}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeContrato(destino, {
          dataInicioLocacao: '2026-03-01',
          prazoMeses: 24,
          valorMensal: 3100.5,
          diaVencimento: 5,
          gerarCobrancasAutomaticamente: false,
          pdfContratoArquivo: 'contratos/2026/rascunho.pdf',
        }),
      });

      expect(alteracao.status).toBe(200);
      // Corpo INTEIRO: o MESMO código (a alteração nunca o move), os termos novos, e os dois campos
      // derivados ainda nulos — alterar um rascunho não o ativa.
      expect(alteracao.corpo).toEqual({
        codigo: rascunho.codigo,
        status: 'RASCUNHO',
        imovelId: destino.imovelId,
        locadorId: destino.locadorId,
        locatarioId: destino.locatarioId,
        fiadores: destino.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
        dataInicioLocacao: '2026-03-01',
        prazoMeses: 24,
        valorMensal: 3100.5,
        diaVencimento: 5,
        dataFimLocacao: null,
        valorTotalContrato: null,
        gerarCobrancasAutomaticamente: false,
        pdfContratoArquivo: 'contratos/2026/rascunho.pdf',
        retiradoEm: null,
      });

      // --- Passos 2 e 3: os dois estados que RECUSAM --------------------------------------------
      const antesDoAtivo = await lerContrato(cookie, ativo.codigo);
      const antesDoCancelado = await lerContrato(cookie, cancelado.codigo);

      for (const alvo of [
        { rotulo: 'ATIVO', codigo: ativo.codigo, estadoAtual: 'ATIVO' },
        { rotulo: 'CANCELADO', codigo: cancelado.codigo, estadoAtual: 'CANCELADO' },
      ]) {
        const recusa = await pedir(`${COLECAO_DE_CONTRATOS}/${alvo.codigo}`, {
          metodo: 'PUT',
          cookie,
          corpo: corpoDeContrato(destino, { prazoMeses: 36 }),
        });

        expect(recusa.status, alvo.rotulo).toBe(422);
        // Corpo INTEIRO por igualdade (ADR-0017): o código, a mensagem canônica, o campo culpado e os
        // dois discriminadores — e NADA mais. É esta linha que prende `estadoAtual` e
        // `transicaoPedida` aos nomes que a §10.1 da tech spec fixou antes da implementação.
        expect(recusa.corpo, alvo.rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'status',
          detalhes: { estadoAtual: alvo.estadoAtual, transicaoPedida: 'ALTERACAO' },
        });
      }

      // --- Passo 4: a releitura BYTE A BYTE -----------------------------------------------------
      //
      // É ela que separa "respondeu 422" de "respondeu 422 e não gravou": sem esta comparação, o caso
      // passaria com uma borda que gravasse os termos novos e recusasse depois.
      expect(await lerContrato(cookie, ativo.codigo)).toEqual(antesDoAtivo);
      expect(await lerContrato(cookie, cancelado.codigo)).toEqual(antesDoCancelado);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-410 — o PUT substitui os fiadores por inteiro no rascunho, e eles congelam na ativação',
    async () => {
      const partes = await montarPartes(cookie, 3);
      const [primeiro, segundo, terceiro] = partes.fiadores;

      if (primeiro === undefined || segundo === undefined || terceiro === undefined) {
        throw new Error('o arranjo do CT-410 precisa de três fiadores');
      }

      // --- Passo 1: criar com [F1, F2] ----------------------------------------------------------
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(partes, { fiadoresIds: [primeiro.id, segundo.id] }),
      });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as ContratoPublicado;
      expect(criado.fiadores).toEqual([
        { id: primeiro.id, nome: primeiro.nome },
        { id: segundo.id, nome: segundo.nome },
      ]);

      // --- Passo 2: `PUT` com [F2, F3] enquanto RASCUNHO -----------------------------------------
      //
      // A lista fica EXATAMENTE `[F2, F3]`. Uma implementação que mesclasse devolveria
      // `[F1, F2, F3]` e passaria qualquer asserção de presença — é a igualdade do vetor inteiro que
      // a reprova, e é ela que prova que F1 saiu **sem sobra**.
      const substituicao = await pedir(`${COLECAO_DE_CONTRATOS}/${criado.codigo}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeContrato(partes, { fiadoresIds: [segundo.id, terceiro.id] }),
      });

      expect(substituicao.status).toBe(200);
      expect((substituicao.corpo as ContratoPublicado).fiadores).toEqual([
        { id: segundo.id, nome: segundo.nome },
        { id: terceiro.id, nome: terceiro.nome },
      ]);

      // --- Passo 3: o contrato passa a valer, pela porta -----------------------------------------
      await ativarPelaPorta(EMPRESA_A.id, criado.codigo, partes.imovelId);

      // --- Passo 4: o `PUT` que só troca fiadores é recusado pela guarda do PAI ------------------
      const recusa = await pedir(`${COLECAO_DE_CONTRATOS}/${criado.codigo}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeContrato(partes, { fiadoresIds: [terceiro.id] }),
      });

      expect(recusa.status).toBe(422);
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'status',
        detalhes: { estadoAtual: 'ATIVO', transicaoPedida: 'ALTERACAO' },
      });

      // --- Passo 5: a lista congelada permanece INTOCADA -----------------------------------------
      const releitura = await lerContrato(cookie, criado.codigo);
      expect(releitura.fiadores).toEqual([
        { id: segundo.id, nome: segundo.nome },
        { id: terceiro.id, nome: terceiro.nome },
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-411 — as recusas de entrada nomeiam o campo culpado e nenhuma delas grava linha',
    async () => {
      const partes = await montarPartes(cookie, 1);
      const fiador = partes.fiadores[0];

      if (fiador === undefined) {
        throw new Error('o arranjo do CT-411 precisa de um fiador');
      }

      // --- Passo 1: a contagem crua ANTES -------------------------------------------------------
      const antes = await contarContratos(EMPRESA_A.id);

      // --- Passo 2: as sete requisições, cada uma com o desfecho declarado por linha -------------
      for (const recusa of recusasDaCriacao(partes, fiador.id)) {
        const resposta = await pedir(recusa.alvo(), {
          metodo: recusa.metodo,
          cookie,
          ...(recusa.corpo === undefined ? {} : { corpo: recusa.corpo }),
        });

        expect(resposta.status, recusa.rotulo).toBe(422);
        // Corpo INTEIRO por igualdade. É esta linha que impede a recusa de ecoar o valor recusado num
        // campo novo — o vetor que a fatia anterior mediu e que `detalhes` reabriria —, e é ela que
        // afirma "sem linha `error` no journal": o filtro só registra `error` para o que NÃO é
        // `ErroDeAplicacao`, e o que não é sai como `500 ERRO_INTERNO`.
        expect(resposta.corpo, recusa.rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: recusa.campo,
        });
      }

      // --- Passo 3: a contagem crua DEPOIS ------------------------------------------------------
      //
      // É ela que separa "respondeu 422" de "respondeu 422 e não gravou". Note que ela vale mesmo com
      // a série tendo avançado: o número emitido por uma criação abortada é **queimado para sempre**
      // (ADR-0015), e nenhuma linha nasce dele.
      expect(await contarContratos(EMPRESA_A.id)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-411 (b) — cadastro fora de circulação é recusado nomeando o campo, ao montar e ao alterar',
    async () => {
      const antes = await contarContratos(EMPRESA_A.id);

      // Cada linha da tabela tem partes PRÓPRIAS: a retirada é definitiva dentro do caso, e reusar o
      // mesmo arranjo faria a segunda linha depender do que a primeira retirou (AP-08).
      const alvos: readonly { readonly campo: string; readonly retirar: (p: Partes) => string }[] =
        [
          { campo: 'imovelId', retirar: (p) => `${CAMINHO_DOS_IMOVEIS}/${p.imovelId}` },
          { campo: 'locadorId', retirar: (p) => `${CAMINHO_DOS_LOCADORES}/${p.locadorId}` },
          { campo: 'locatarioId', retirar: (p) => `${CAMINHO_DOS_LOCATARIOS}/${p.locatarioId}` },
          {
            campo: 'fiadoresIds',
            retirar: (p) => `${CAMINHO_DOS_FIADORES}/${p.fiadores[0]?.id ?? ''}`,
          },
        ];

      for (const alvo of alvos) {
        const partes = await montarPartes(cookie, 1);

        // A retirada acontece pela ROTA real, nunca por um `UPDATE` em `retirado_em`.
        const retirada = await pedir(`/${PREFIXO_DE_VERSAO}/${alvo.retirar(partes)}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });
        expect(retirada.status, alvo.campo).toBe(200);

        // --- Metade 1: a MONTAGEM recusa --------------------------------------------------------
        const montagem = await pedir(COLECAO_DE_CONTRATOS, {
          metodo: 'POST',
          cookie,
          corpo: corpoDeContrato(partes),
        });

        expect(montagem.status, alvo.campo).toBe(422);
        expect(montagem.corpo, alvo.campo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: alvo.campo,
          detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' },
        });

        // --- Metade 2: a ALTERAÇÃO recusa pela MESMA conferência --------------------------------
        //
        // Sem esta metade, um serviço que conferisse só a criação atravessaria a suíte inteira, e o
        // `PUT` seria a porta por onde entraria o vínculo que a montagem recusa. O contrato alterado
        // é montado com partes ÍNTEGRAS, e o corpo do `PUT` é que aponta para o cadastro retirado.
        const integras = await montarPartes(cookie, 1);
        const contrato = await criarContratoPor(cookie, integras);

        const alteracao = await pedir(`${COLECAO_DE_CONTRATOS}/${contrato.codigo}`, {
          metodo: 'PUT',
          cookie,
          corpo: corpoDeContrato(partes),
        });

        expect(alteracao.status, alvo.campo).toBe(422);
        expect(alteracao.corpo, alvo.campo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: alvo.campo,
          detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' },
        });

        // E o contrato alterado ficou como estava — a recusa não gravou metade da alteração.
        expect(await lerContrato(cookie, contrato.codigo)).toEqual(contrato);
      }

      // Quatro contratos nasceram (um por linha, o das partes íntegras), e nenhuma das oito recusas
      // gravou linha alguma.
      expect(await contarContratos(EMPRESA_A.id)).toBe(antes + alvos.length);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-411 (c) — com N fiadores, a recusa é a do PRIMEIRO problema na ordem em que o cliente enviou',
    async () => {
      const partes = await montarPartes(cookie, 3);
      const [primeiro, doMeio, ultimo] = partes.fiadores;

      if (primeiro === undefined || doMeio === undefined || ultimo === undefined) {
        throw new Error('o arranjo do CT-411 (c) precisa de três fiadores');
      }

      // A retirada acontece pela ROTA real, nunca por um `UPDATE` em `retirado_em`. O retirado é o do
      // MEIO de propósito: na primeira posição, uma conferência que só olhasse o primeiro item
      // passaria.
      const retirada = await pedir(
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_FIADORES}/${doMeio.id}/retirada`,
        {
          metodo: 'POST',
          cookie,
          corpo: {},
        },
      );
      expect(retirada.status).toBe(200);

      const antes = await contarContratos(EMPRESA_A.id);

      for (const linha of ordensDeFiadores(primeiro.id, doMeio.id, ultimo.id)) {
        const resposta = await pedir(COLECAO_DE_CONTRATOS, {
          metodo: 'POST',
          cookie,
          corpo: corpoDeContrato(partes, { fiadoresIds: linha.fiadoresIds }),
        });

        expect(resposta.status, linha.rotulo).toBe(linha.status);
        expect(resposta.corpo, linha.rotulo).toEqual(linha.corpo);
      }

      // --- O controle positivo: sem o retirado, a MESMA coleção de dois é aceita -----------------
      //
      // Sem ele, "recusa" seria satisfeito por uma conferência que recusasse sempre — e a conferência
      // em lote que devolvesse mapa vazio passaria em todas as quatro linhas acima.
      const aceito = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(partes, { fiadoresIds: [primeiro.id, ultimo.id] }),
      });

      expect(aceito.status).toBe(201);
      expect((aceito.corpo as ContratoPublicado).fiadores).toEqual(
        [primeiro, ultimo]
          .map((fiador) => ({ id: fiador.id, nome: fiador.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      );

      // Só o controle positivo gravou: as quatro recusas não deixaram linha.
      expect(await contarContratos(EMPRESA_A.id)).toBe(antes + 1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-417 — retirar e recircular o contrato não transita estado nem libera o imóvel',
    async () => {
      const doRascunho = await montarPartes(cookie, 1);
      const doAtivo = await montarPartes(cookie, 1);
      const doCancelado = await montarPartes(cookie, 1);

      const rascunho = await criarContratoPor(cookie, doRascunho);
      const ativo = await criarContratoPor(cookie, doAtivo);
      const cancelado = await criarContratoPor(cookie, doCancelado);

      await ativarPelaPorta(EMPRESA_A.id, ativo.codigo, doAtivo.imovelId);
      await cancelarPelaPorta(EMPRESA_A.id, cancelado.codigo);

      const alcancaveis: readonly { readonly rotulo: string; readonly codigo: string }[] = [
        { rotulo: 'RASCUNHO', codigo: rascunho.codigo },
        { rotulo: 'ATIVO', codigo: ativo.codigo },
        { rotulo: 'CANCELADO', codigo: cancelado.codigo },
      ];

      for (const alvo of alcancaveis) {
        const antes = await lerContrato(cookie, alvo.codigo);

        // --- Passo 1: a retirada ----------------------------------------------------------------
        const retirada = await pedir(`${COLECAO_DE_CONTRATOS}/${alvo.codigo}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });

        expect(retirada.status, alvo.rotulo).toBe(200);
        const retirado = retirada.corpo as ContratoPublicado;

        // O corpo INTEIRO difere do anterior **em um campo só**: a marca. É esta forma que prova que
        // a retirada não transita estado — uma implementação que a fundisse com uma transição
        // reprovaria aqui, e não numa asserção de `status` isolada.
        expect(retirado, alvo.rotulo).toEqual({ ...antes, retiradoEm: retirado.retiradoEm });
        expect(retirado.retiradoEm, alvo.rotulo).not.toBeNull();
        // E a marca é uma data-hora de verdade, e não uma cadeia qualquer que a linha acima aceitaria.
        expect(Number.isNaN(Date.parse(retirado.retiradoEm ?? '')), alvo.rotulo).toBe(false);

        // --- Passo 2: repetir é IDEMPOTENTE -----------------------------------------------------
        //
        // Corpo profundamente igual, marca inclusive: uma implementação que reescrevesse
        // `retirado_em` a cada chamada devolveria um instante diferente e reprova aqui.
        const repeticao = await pedir(`${COLECAO_DE_CONTRATOS}/${alvo.codigo}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });
        expect(repeticao.status, alvo.rotulo).toBe(200);
        expect(repeticao.corpo, alvo.rotulo).toEqual(retirado);

        // --- Passo 3: corpo NÃO VAZIO é recusado, e a marca fica intocada ------------------------
        const comCorpo = await pedir(`${COLECAO_DE_CONTRATOS}/${alvo.codigo}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: { qualquerCampo: 1 },
        });

        expect(comCorpo.status, alvo.rotulo).toBe(422);
        expect(comCorpo.corpo, alvo.rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'corpo',
        });
        expect(await lerContrato(cookie, alvo.codigo), alvo.rotulo).toEqual(retirado);

        // --- Passo 4: recircular devolve o contrato ao estado ANTERIOR, byte a byte --------------
        const recirculacao = await pedir(`${COLECAO_DE_CONTRATOS}/${alvo.codigo}/recirculacao`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });

        expect(recirculacao.status, alvo.rotulo).toBe(200);
        expect(recirculacao.corpo, alvo.rotulo).toEqual(antes);
      }

      // --- O imóvel do contrato ATIVO permanece LOCADO ------------------------------------------
      //
      // É a asserção que impede a retirada de virar porta lateral para destravar o imóvel sem
      // cancelar o contrato (RD-15). Ela é feita depois da retirada E depois da recirculação: os dois
      // sentidos deixam o imóvel como estava.
      const imovel = await pedir(
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/${doAtivo.imovelId}`,
        { cookie },
      );
      expect(imovel.status).toBe(200);
      expect((imovel.corpo as { statusLocacao: string }).statusLocacao).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-418 — a carteira vem numa consulta só, e o teto da janela RECUSA em vez de truncar',
    async () => {
      const doRascunho = await montarPartes(cookie, 1);
      const doAtivo = await montarPartes(cookie, 1);
      const doCancelado = await montarPartes(cookie, 0);
      const doRetirado = await montarPartes(cookie, 0);

      const rascunho = await criarContratoPor(cookie, doRascunho);
      const ativo = await criarContratoPor(cookie, doAtivo);
      const cancelado = await criarContratoPor(cookie, doCancelado);
      const retirado = await criarContratoPor(cookie, doRetirado);

      await ativarPelaPorta(EMPRESA_A.id, ativo.codigo, doAtivo.imovelId);
      await cancelarPelaPorta(EMPRESA_A.id, cancelado.codigo);

      const retirando = await pedir(`${COLECAO_DE_CONTRATOS}/${retirado.codigo}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(retirando.status).toBe(200);

      // --- Passo 1: a página ---------------------------------------------------------------------
      const resposta = await pedir(`${COLECAO_DE_CONTRATOS}?limite=200`, { cookie });
      expect(resposta.status).toBe(200);

      const pagina = resposta.corpo as PaginaPublicada;

      // O envelope da ADR-0017, por igualdade de CHAVES: um campo a mais, ou um a menos, reprova aqui.
      expect(Object.keys(pagina).sort()).toEqual(['deslocamento', 'itens', 'limite', 'total']);
      expect(pagina.limite).toBe(200);
      expect(pagina.deslocamento).toBe(0);
      // `total` é a contagem do conjunto inteiro; com a janela no teto e a suíte abaixo dele, os dois
      // coincidem — e é essa coincidência que torna a igualdade seguinte uma afirmação sobre a
      // carteira toda, e não sobre uma página dela.
      expect(pagina.total).toBe(pagina.itens.length);

      // --- Passo 2: cada item traz código, partes, termos e estado — sem segunda consulta ---------
      //
      // A comparação é do item INTEIRO contra o valor esperado escrito por extenso, e não contra a
      // leitura individual: uma listagem que devolvesse uma projeção reduzida — sem os fiadores, sem
      // as derivações — reprova aqui.
      expect(itemDe(pagina, rascunho.codigo)).toEqual({
        codigo: rascunho.codigo,
        status: 'RASCUNHO',
        imovelId: doRascunho.imovelId,
        locadorId: doRascunho.locadorId,
        locatarioId: doRascunho.locatarioId,
        fiadores: doRascunho.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
        dataInicioLocacao: DATA_DE_INICIO,
        prazoMeses: PRAZO_EM_MESES,
        valorMensal: VALOR_MENSAL,
        diaVencimento: DIA_DE_VENCIMENTO,
        dataFimLocacao: null,
        valorTotalContrato: null,
        gerarCobrancasAutomaticamente: true,
        pdfContratoArquivo: null,
        retiradoEm: null,
      });

      expect(itemDe(pagina, ativo.codigo)).toEqual({
        codigo: ativo.codigo,
        status: 'ATIVO',
        imovelId: doAtivo.imovelId,
        locadorId: doAtivo.locadorId,
        locatarioId: doAtivo.locatarioId,
        fiadores: doAtivo.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
        dataInicioLocacao: DATA_DE_INICIO,
        prazoMeses: PRAZO_EM_MESES,
        valorMensal: VALOR_MENSAL,
        diaVencimento: DIA_DE_VENCIMENTO,
        dataFimLocacao: DATA_DE_FIM_DA_ATIVACAO,
        valorTotalContrato: VALOR_TOTAL_DA_ATIVACAO,
        gerarCobrancasAutomaticamente: true,
        pdfContratoArquivo: null,
        retiradoEm: null,
      });

      expect(itemDe(pagina, cancelado.codigo)?.status).toBe('CANCELADO');

      // --- Passo 3: o RETIRADO não aparece por padrão, e aparece quando pedido -------------------
      //
      // O par é o que discrimina: só a primeira metade seria satisfeita por uma listagem que
      // escondesse tudo, e só a segunda, por uma que nunca aplicasse o predicado.
      expect(itemDe(pagina, retirado.codigo)).toBeUndefined();

      const comRetirados = await pedir(`${COLECAO_DE_CONTRATOS}?limite=200&incluirRetirados=true`, {
        cookie,
      });
      expect(comRetirados.status).toBe(200);
      const ampliada = comRetirados.corpo as PaginaPublicada;
      expect(itemDe(ampliada, retirado.codigo)?.codigo).toBe(retirado.codigo);
      expect(ampliada.total).toBe(pagina.total + 1);

      // --- Passo 4: o teto RECUSA, e não trunca -------------------------------------------------
      const acimaDoTeto = await pedir(`${COLECAO_DE_CONTRATOS}?limite=201`, { cookie });

      expect(acimaDoTeto.status).toBe(422);
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'limite',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-423 — cruzar imóvel de uma empresa com pessoa de outra responde o MESMO 404 de inexistente',
    async () => {
      const emA = await montarPartes(cookie, 0);
      const emB = await montarPartes(cookieDeB, 0);

      // --- Passo 1: as contagens sob os DOIS contextos -------------------------------------------
      const antesEmA = await contarContratos(EMPRESA_A.id);
      const antesEmB = await contarContratos(EMPRESA_B.id);

      // --- Passo 2: da sessão de A, o locatário de B ---------------------------------------------
      const cruzado = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(emA, { locatarioId: emB.locatarioId }),
      });

      // --- Passo 3: da sessão de A, um locatário que não existe em lugar nenhum ------------------
      const inexistente = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(emA, { locatarioId: UUID_INEXISTENTE }),
      });

      // --- Passo 4: os dois corpos são profundamente iguais --------------------------------------
      expect(cruzado.status).toBe(404);
      expect(inexistente.status).toBe(cruzado.status);
      expect(cruzado.corpo).toEqual(inexistente.corpo);
      // E o corpo é o canônico — sem esta linha, dois `500` idênticos passariam a igualdade acima.
      expect(cruzado.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // O mesmo vale para o LOCADOR alheio: o cruzamento é recusado em qualquer das partes, e não
      // apenas naquela que o card exercita.
      const comLocadorAlheio = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(emA, { locadorId: emB.locadorId }),
      });
      expect(comLocadorAlheio.status).toBe(404);
      expect(comLocadorAlheio.corpo).toEqual(cruzado.corpo);

      // E o imóvel alheio, partindo da sessão de B contra o imóvel de A — a direção inversa.
      const comImovelAlheio = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: corpoDeContrato(emB, { imovelId: emA.imovelId }),
      });
      expect(comImovelAlheio.status).toBe(404);
      expect(comImovelAlheio.corpo).toEqual(cruzado.corpo);

      // --- Passo 5: as contagens não se moveram em NENHUMA das duas empresas ---------------------
      expect(await contarContratos(EMPRESA_A.id)).toBe(antesEmA);
      expect(await contarContratos(EMPRESA_B.id)).toBe(antesEmB);

      // --- Passo 6: o controle positivo, com o locatário da PRÓPRIA empresa ----------------------
      //
      // Sem ele, "o cruzamento recusa" seria satisfeito por uma borda que respondesse `404` a toda
      // montagem.
      const proprio = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeContrato(emA),
      });

      expect(proprio.status).toBe(201);
      expect((proprio.corpo as ContratoPublicado).codigo).toMatch(PADRAO_DO_CODIGO);
      expect(await contarContratos(EMPRESA_A.id)).toBe(antesEmA + 1);
      expect(await contarContratos(EMPRESA_B.id)).toBe(antesEmB);

      // E o contrato nascido em A **não é alcançável** pela sessão de B: a chave exposta é o código, e
      // ele não vira oráculo de existência entre empresas.
      const leituraCruzada = await pedir(
        `${COLECAO_DE_CONTRATOS}/${(proprio.corpo as ContratoPublicado).codigo}`,
        { cookie: cookieDeB },
      );
      expect(leituraCruzada.status).toBe(404);
      expect(leituraCruzada.corpo).toEqual(cruzado.corpo);

      // E as duas causas da ausência são INDISTINGUÍVEIS: o contrato que existe em A e o código que
      // não existe em lugar nenhum respondem o mesmo corpo, byte a byte, para a mesma sessão. Sem
      // esta linha, "responde 404" não diria nada sobre vazamento de existência.
      const codigoInexistente = await pedir(`${COLECAO_DE_CONTRATOS}/${CODIGO_INEXISTENTE}`, {
        cookie: cookieDeB,
      });
      expect(codigoInexistente.status).toBe(404);
      expect(codigoInexistente.corpo).toEqual(leituraCruzada.corpo);
    },
    LIMITE_CASO_MS,
  );
});

describe('ativação do contrato — a primeira transição de estado governada (T7)', () => {
  it(
    'CT-413 — ativar deriva as duas grandezas, ocupa o imóvel e declara o que NÃO fez',
    async () => {
      const partes = await montarPartes(cookie, 2);
      const contrato = await criarContratoPor(cookie, partes, {
        dataInicioLocacao: INICIO_NA_VIRADA,
        prazoMeses: PRAZO_DE_UM_MES,
        valorMensal: VALOR_MENSAL_REDONDO,
      });

      // --- Passo 0: o corpo NÃO VAZIO é recusado, e nada transita ------------------------------
      //
      // O vetor é `{"status":"ATIVO"}` de propósito: sem o corpo fechado, ele responderia `200` e o
      // cliente acreditaria ter **escolhido** o estado — que é exatamente o que a ADR-0019 tira dele.
      const comCorpo = await pedir(`${COLECAO_DE_CONTRATOS}/${contrato.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: { status: 'ATIVO' },
      });

      expect(comCorpo.status).toBe(422);
      expect(comCorpo.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'corpo',
      });
      expect(await lerContrato(cookie, contrato.codigo)).toEqual(contrato);

      // --- Passo 1: a ativação ------------------------------------------------------------------
      const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${contrato.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(ativacao.status, ativacao.texto).toBe(200);

      // Corpo INTEIRO por igualdade: um campo a mais — o UUID interno vazando — reprova aqui, e não
      // numa asserção de presença. `dataFimLocacao` e `valorTotalContrato` são os valores do
      // ORÁCULO, escritos por extenso: a saturação de `2026-01-31 + 1 mês` em `2026-02-28`, seguida
      // do passo terminal de menos um dia. `efeitos` prende o literal que a F3 terá de afrouxar.
      expect(ativacao.corpo).toEqual({
        codigo: contrato.codigo,
        status: 'ATIVO',
        imovelId: partes.imovelId,
        locadorId: partes.locadorId,
        locatarioId: partes.locatarioId,
        fiadores: partes.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
        dataInicioLocacao: INICIO_NA_VIRADA,
        prazoMeses: PRAZO_DE_UM_MES,
        valorMensal: VALOR_MENSAL_REDONDO,
        diaVencimento: DIA_DE_VENCIMENTO,
        dataFimLocacao: FIM_DERIVADO_NA_VIRADA,
        valorTotalContrato: TOTAL_DERIVADO_REDONDO,
        gerarCobrancasAutomaticamente: true,
        pdfContratoArquivo: null,
        retiradoEm: null,
        efeitos: EFEITOS_ESPERADOS,
      });

      // --- Passo 2: a SEGUNDA escrita — o imóvel passa a LOCADO --------------------------------
      //
      // Nada no banco pareia as duas escritas: um imóvel que ficasse `DISPONIVEL` com contrato
      // vigente não acusaria nada até a segunda locação ser recusada. É esta linha que a pega.
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('LOCADO');

      // --- Passo 3: a releitura é o corpo da ativação MENOS `efeitos` --------------------------
      //
      // `efeitos` descreve o ATO, e não o contrato: publicá-lo também na leitura faria a declaração
      // de efeito virar estado persistido, e a F3 teria de mantê-la coerente para sempre.
      const { efeitos, ...semEfeitos } = ativacao.corpo as AtivacaoPublicada;
      expect(efeitos).toEqual(EFEITOS_ESPERADOS);
      expect(await lerContrato(cookie, contrato.codigo)).toEqual(semEfeitos);

      // --- Sub-caso A: o RESÍDUO BINÁRIO, atravessando a rota -----------------------------------
      //
      // Este par é o único desta suíte que separa "chamou a função pura" de "escreveu a
      // multiplicação": o golden é CEGO à forma ingênua, e ela acerta os 23 cenários dele. A linha
      // abaixo afirma que o vetor de fato discrimina — se as duas constantes passassem a ser o mesmo
      // número, o sub-caso perderia o poder em silêncio.
      expect(TOTAL_INGENUO_COM_RESIDUO).not.toBe(TOTAL_DERIVADO_SEM_RESIDUO);

      const doResiduo = await montarPartes(cookie, 0);
      const comResiduo = await criarContratoPor(cookie, doResiduo, {
        dataInicioLocacao: INICIO_NA_VIRADA,
        prazoMeses: PRAZO_COM_RESIDUO,
        valorMensal: VALOR_MENSAL_COM_RESIDUO,
      });

      const derivada = await pedir(`${COLECAO_DE_CONTRATOS}/${comResiduo.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(derivada.status, derivada.texto).toBe(200);
      const doProduto = derivada.corpo as AtivacaoPublicada;

      // Igualdade de NÚMERO, nunca aproximação: `toBeCloseTo` aceitaria exatamente o defeito que
      // este sub-caso persegue.
      expect(doProduto.valorTotalContrato).toBe(TOTAL_DERIVADO_SEM_RESIDUO);
      expect(doProduto.valorTotalContrato).not.toBe(TOTAL_INGENUO_COM_RESIDUO);
      expect(doProduto.dataFimLocacao).toBe(FIM_DERIVADO_COM_RESIDUO);
      // E o resíduo não chega ao cliente nem no texto cru da resposta — é ali que ele apareceria,
      // porque o número atravessa a serialização sem passar por arredondamento nenhum.
      expect(derivada.texto).not.toContain('6500.3899');

      // --- Sub-caso B: o imóvel INDISPONIVEL É ATIVÁVEL ----------------------------------------
      //
      // `INDISPONIVEL` significa "não ofereça nas buscas", e não "proibido de locar": o sistema
      // antigo confere apenas `contrato_ativo` ao ocupar o imóvel, e recusar aqui seria condição de
      // entrada nova, sem fonte no legado nem no PRD. Sem este sub-caso, a recusa inventada passaria
      // despercebida.
      const doIndisponivel = await montarPartes(cookie, 1, { statusLocacao: 'INDISPONIVEL' });
      expect(await situacaoDoImovel(cookie, doIndisponivel.imovelId)).toBe('INDISPONIVEL');

      const sobreIndisponivel = await criarContratoPor(cookie, doIndisponivel);
      const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${sobreIndisponivel.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(aceita.status, aceita.texto).toBe(200);
      expect((aceita.corpo as AtivacaoPublicada).status).toBe('ATIVO');
      expect(await situacaoDoImovel(cookie, doIndisponivel.imovelId)).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it('CT-413 (c) — o serviço NÃO recalcula: nenhuma aritmética de dinheiro, prazo ou instante', async () => {
    // --- A SENSIBILIDADE do predicado, antes de aplicá-lo ------------------------------------
    //
    // As duas metades, e nenhuma sozinha basta: um predicado que nunca casasse nada passaria a
    // varredura em silêncio para sempre, e um que casasse tudo reprovaria o código correto. As
    // linhas são escritas por extenso — a mutante é literalmente a forma ingênua que o Tech Review
    // da T4 nomeou, e a legítima é a linha que o serviço de fato tem.
    expect(ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(LINHA_MUTANTE_DO_PRODUTO)).toBe(true);
    expect(ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(LINHA_LEGITIMA_DO_PRODUTO)).toBe(false);
    expect(CONSTRUCAO_DE_INSTANTE.test(LINHA_MUTANTE_DA_DATA)).toBe(true);
    expect(CONSTRUCAO_DE_INSTANTE.test(LINHA_LEGITIMA_DA_DATA)).toBe(false);

    // --- A varredura, com os COMENTÁRIOS FORA ------------------------------------------------
    const executavel = await varrerArquivos(
      [FONTE_DO_SERVICO_DE_CONTRATO],
      (linha) => ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(linha) || CONSTRUCAO_DE_INSTANTE.test(linha),
    );

    // O alvo foi lido — zero arquivo nunca é escondido: um fonte renomeado faria a varredura provar
    // nada, e a asserção abaixo passaria por vacuidade.
    expect(executavel.arquivos).toBe(1);
    // Igualdade de array, e não "está vazio": a falha NOMEIA a linha ofensora, com número.
    expect(executavel.ocorrencias).toEqual([]);

    // --- O CONTROLE POSITIVO: as duas funções puras são de fato chamadas ---------------------
    //
    // Sem ele, "nenhuma aritmética aqui" seria satisfeito por um serviço que não derivasse nada.
    const chamadas = await varrerArquivos([FONTE_DO_SERVICO_DE_CONTRATO], (linha) =>
      /\bderiv(arTerminoDaLocacao|arValorTotal)\s*\(/u.test(linha),
    );
    expect(chamadas.ocorrencias.length).toBe(2);
  });

  it(
    'CT-413 (b) — as duas escritas da ativação commitam juntas, ou nenhuma das duas sobrevive',
    async () => {
      // --- Eixo NEGATIVO: a falha depois das DUAS escritas desfaz as DUAS ----------------------
      const doDesfazimento = await montarPartes(cookie, 1);
      const desfeito = await criarContratoPor(cookie, doDesfazimento);

      await expect(
        escreverAsDuasEscritas(desfeito.codigo, doDesfazimento.imovelId, true),
      ).rejects.toThrow(FalhaForcadaAntesDoCommit);

      // As DUAS metades, e nenhuma sozinha basta: só a primeira seria satisfeita por uma
      // implementação que gravasse o imóvel numa unidade própria; só a segunda, pela recíproca.
      expect((await lerContrato(cookie, desfeito.codigo)).status).toBe('RASCUNHO');
      expect(await situacaoDoImovel(cookie, doDesfazimento.imovelId)).toBe('DISPONIVEL');

      // --- Eixo POSITIVO: a MESMA sequência, sem a falha, deixa as DUAS ------------------------
      //
      // Sem ele, "nada foi gravado" seria satisfeito por uma sequência que nunca grava nada — e o
      // eixo negativo inteiro passaria por vacuidade.
      const doCommit = await montarPartes(cookie, 1);
      const commitado = await criarContratoPor(cookie, doCommit);

      await escreverAsDuasEscritas(commitado.codigo, doCommit.imovelId, false);

      expect((await lerContrato(cookie, commitado.codigo)).status).toBe('ATIVO');
      expect(await situacaoDoImovel(cookie, doCommit.imovelId)).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-412 — cadastro fora de circulação recusa a montagem E a ativação, nomeando o campo',
    async () => {
      // Cada linha tem partes PRÓPRIAS: a retirada é definitiva dentro do caso, e reusar o mesmo
      // arranjo faria a segunda linha depender do que a primeira retirou (AP-08).
      const alvos: readonly { readonly campo: string; readonly retirar: (p: Partes) => string }[] =
        [
          { campo: 'imovelId', retirar: (p) => `${CAMINHO_DOS_IMOVEIS}/${p.imovelId}` },
          { campo: 'locadorId', retirar: (p) => `${CAMINHO_DOS_LOCADORES}/${p.locadorId}` },
          { campo: 'locatarioId', retirar: (p) => `${CAMINHO_DOS_LOCATARIOS}/${p.locatarioId}` },
          {
            campo: 'fiadoresIds',
            retirar: (p) => `${CAMINHO_DOS_FIADORES}/${p.fiadores[0]?.id ?? ''}`,
          },
        ];

      const recusaEsperada = (campo: string): Record<string, unknown> => ({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo,
        detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' },
      });

      for (const alvo of alvos) {
        const partes = await montarPartes(cookie, 1);

        // O rascunho nasce com TUDO em circulação — é o que torna o segundo momento uma prova sobre
        // o intervalo entre montar e fazer valer, e não sobre a montagem outra vez.
        const rascunho = await criarContratoPor(cookie, partes);
        const antes = await lerContrato(cookie, rascunho.codigo);

        // A retirada acontece pela ROTA real, nunca por um `UPDATE` em `retirado_em`.
        const retirada = await pedir(`/${PREFIXO_DE_VERSAO}/${alvo.retirar(partes)}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });
        expect(retirada.status, alvo.campo).toBe(200);

        // --- Momento 1: MONTAR recusa -----------------------------------------------------------
        const montagem = await pedir(COLECAO_DE_CONTRATOS, {
          metodo: 'POST',
          cookie,
          corpo: corpoDeContrato(partes),
        });

        expect(montagem.status, `${alvo.campo} (montar)`).toBe(422);
        expect(montagem.corpo, `${alvo.campo} (montar)`).toEqual(recusaEsperada(alvo.campo));

        // --- Momento 2: FAZER VALER recusa pela MESMA conferência --------------------------------
        //
        // É a metade que a T7 acrescenta, e ela não é redundante com a de cima: entre montar e
        // ativar podem passar semanas, e a circulação é a ÚNICA das seis condições capaz de mudar
        // nesse intervalo.
        const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${rascunho.codigo}/ativacao`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });

        expect(ativacao.status, `${alvo.campo} (ativar)`).toBe(422);
        expect(ativacao.corpo, `${alvo.campo} (ativar)`).toEqual(recusaEsperada(alvo.campo));

        // O contrato ficou BYTE A BYTE como estava, e o imóvel não foi ocupado. A segunda asserção
        // é a que pega uma implementação que ocupasse o imóvel antes de conferir a circulação —
        // nenhuma outra linha desta suíte a alcança.
        expect(await lerContrato(cookie, rascunho.codigo), alvo.campo).toEqual(antes);
        expect(await situacaoDoImovel(cookie, partes.imovelId), alvo.campo).toBe('DISPONIVEL');
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-414 — o segundo contrato sobre o imóvel ocupado recusa nomeando o código do vigente',
    async () => {
      const partes = await montarPartes(cookie, 1);
      const primeiro = await criarContratoPor(cookie, partes);
      // O segundo aponta para o MESMO imóvel: montá-lo é legítimo — o que não vale é fazê-lo valer.
      const segundo = await criarContratoPor(cookie, partes);

      // --- Passo 1: o primeiro passa a valer ---------------------------------------------------
      const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${primeiro.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(ativacao.status, ativacao.texto).toBe(200);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('LOCADO');

      const vigenteAntes = await lerContrato(cookie, primeiro.codigo);
      const segundoAntes = await lerContrato(cookie, segundo.codigo);

      // --- Passo 2: a segunda ativação recusa --------------------------------------------------
      const conflito = await pedir(`${COLECAO_DE_CONTRATOS}/${segundo.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(conflito.status).toBe(422);
      // Corpo INTEIRO: o discriminador **e** o código do vigente. É essa informação que diz ao
      // usuário o que cancelar — sem ela, a recusa o mandaria procurar.
      expect(conflito.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'imovelId',
        detalhes: {
          conflito: 'IMOVEL_COM_CONTRATO_VIGENTE',
          contratoVigente: primeiro.codigo,
        },
      });

      // --- Passo 3: NENHUMA das duas escritas aconteceu ----------------------------------------
      //
      // O segundo segue `RASCUNHO` byte a byte, o vigente não foi tocado, e o imóvel continua
      // apontando para o primeiro. É o NEGATIVO do par `ATIVO ⇔ LOCADO`: a falha da gravação do
      // estado não pode deixar a escrita do imóvel para trás.
      expect(await lerContrato(cookie, segundo.codigo)).toEqual(segundoAntes);
      expect(await lerContrato(cookie, primeiro.codigo)).toEqual(vigenteAntes);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('LOCADO');

      // --- Passo 4: reativar o VIGENTE é recusado pela máquina de estados ----------------------
      //
      // Cenário 1 da §6.4. A tabela das quatro transições é o `CT-415`, da T8, e não é antecipada
      // aqui: o que este passo mede é que a máquina de estados existe — o sistema antigo ativaria
      // de novo, e a divergência é deliberada.
      const reativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${primeiro.codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(reativacao.status).toBe(422);
      expect(reativacao.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'status',
        detalhes: { estadoAtual: 'ATIVO', transicaoPedida: 'ATIVACAO' },
      });
      expect(await lerContrato(cookie, primeiro.codigo)).toEqual(vigenteAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-425 — com a ÁREA e sem a AÇÃO, monta o rascunho e a ativação recusa nomeando a ação',
    async () => {
      // Sujeito EXCLUSIVO: é o efetivo dele que o eixo positivo altera, e compartilhá-lo faria os
      // demais casos observarem uma chave que este concedeu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.monta.contrato');
      await conceder(sujeito.usuarioId, EMPRESA_A.id, [
        AREA_DOS_CONTRATOS,
        'TELA:imoveis',
        'TELA:cadastros',
      ]);

      // --- Passo 1: a AUSÊNCIA da chave é AFIRMADA, e não suposta ------------------------------
      //
      // Sem esta linha, o `403` do passo 3 poderia vir de qualquer outra causa, e o caso não
      // provaria nada sobre a ação.
      const antes = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: sujeito.cookie }))
        .corpo as SessaoPublicada;
      expect(antes.telas).toContain(AREA_DOS_CONTRATOS);
      expect(antes.acoes).not.toContain(ACAO_DE_ATIVACAO);

      // --- Passo 2: MONTAR continua livre com só a área ----------------------------------------
      //
      // É a separação de poderes que a ADR-0019 existe para preservar: exigir a ação na criação
      // impediria de cadastrar quem só não pode ativar.
      const partes = await montarPartes(sujeito.cookie, 1);
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: corpoDeContrato(partes),
      });

      expect(criacao.status, criacao.texto).toBe(201);
      const rascunho = criacao.corpo as ContratoPublicado;
      expect(rascunho.status).toBe('RASCUNHO');

      // --- Passo 3: ATIVAR recusa, nomeando a AÇÃO ---------------------------------------------
      const recusa = await pedir(`${COLECAO_DE_CONTRATOS}/${rascunho.codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(recusa.status).toBe(403);
      // A chave nomeada é a AÇÃO — e **não** a área, que a sessão possui. É a ordem declarada no
      // decorador que decide isto: a recusa nomeia a PRIMEIRA ausente.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_ATIVACAO },
      });

      // O estado depois da recusa — separa "recusou" de "recusou depois de gravar".
      expect((await lerContrato(sujeito.cookie, rascunho.codigo)).status).toBe('RASCUNHO');
      expect(await situacaoDoImovel(sujeito.cookie, partes.imovelId)).toBe('DISPONIVEL');

      // --- Passo 4: concedida a AÇÃO, a MESMA rota responde 200 --------------------------------
      //
      // É o que torna a mudança de comportamento atribuível à chave, e a nada mais. Sem ele, uma
      // rota que recusasse sempre passaria o eixo negativo inteiro.
      await conceder(sujeito.usuarioId, EMPRESA_A.id, [
        AREA_DOS_CONTRATOS,
        'TELA:imoveis',
        'TELA:cadastros',
        ACAO_DE_ATIVACAO,
      ]);

      const depois = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: sujeito.cookie }))
        .corpo as SessaoPublicada;
      expect(depois.acoes).toContain(ACAO_DE_ATIVACAO);

      const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${rascunho.codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(aceita.status, aceita.texto).toBe(200);
      expect((aceita.corpo as AtivacaoPublicada).status).toBe('ATIVO');
      expect(await situacaoDoImovel(sujeito.cookie, partes.imovelId)).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );
});

describe('cancelamento do contrato — a segunda transição governada (T8)', () => {
  it(
    'CT-415 — cancelar libera o imóvel e transita; as QUATRO transições inválidas recusam sem efeito',
    async () => {
      const partes = await montarPartes(cookie, 1);
      const contrato = await criarContratoPor(cookie, partes);

      // --- Transição inválida 1: CANCELAR um RASCUNHO ------------------------------------------
      //
      // Ela vem ANTES da ativação de propósito: é o único momento em que o contrato ainda é
      // rascunho, e é a que o card nomeia por extenso — *um rascunho abandonado se RETIRA de
      // circulação, não se cancela*, porque cancelar libera o imóvel e retirar não.
      const rascunhoAntes = await lerContrato(cookie, contrato.codigo);
      const sobreRascunho = await transitar(cookie, contrato.codigo, 'cancelamento');

      expect(sobreRascunho.status, sobreRascunho.texto).toBe(422);
      expect(sobreRascunho.corpo).toEqual(recusaDeEstado('RASCUNHO', 'CANCELAMENTO'));
      // O par que separa "recusou" de "recusou e não gravou": o contrato byte a byte, e o imóvel.
      expect(await lerContrato(cookie, contrato.codigo)).toEqual(rascunhoAntes);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('DISPONIVEL');

      // --- O caminho legítimo, passo 1: fazer valer ---------------------------------------------
      const ativacao = await transitar(cookie, contrato.codigo, 'ativacao');
      expect(ativacao.status, ativacao.texto).toBe(200);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('LOCADO');

      const vigente = await lerContrato(cookie, contrato.codigo);
      expect(vigente.status).toBe('ATIVO');

      // --- Transição inválida 2: ATIVAR um contrato que já está ATIVO ---------------------------
      const sobreAtivo = await transitar(cookie, contrato.codigo, 'ativacao');

      expect(sobreAtivo.status, sobreAtivo.texto).toBe(422);
      expect(sobreAtivo.corpo).toEqual(recusaDeEstado('ATIVO', 'ATIVACAO'));
      expect(await lerContrato(cookie, contrato.codigo)).toEqual(vigente);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('LOCADO');

      // --- O caminho legítimo, passo 2: CANCELAR ------------------------------------------------
      const cancelamento = await transitar(cookie, contrato.codigo, 'cancelamento');
      expect(cancelamento.status, cancelamento.texto).toBe(200);

      // Corpo INTEIRO por igualdade, e ele carrega TRÊS afirmações que asserção de presença não faz:
      //
      //   * **não há `efeitos`** — a resposta do cancelamento não leva declaração de efeito, e uma
      //     chave a mais reprova aqui. É escolha registrada: o CA-06 fala só da ativação;
      //   * as **duas derivações da ativação permanecem** (`dataFimLocacao`, `valorTotalContrato`) —
      //     elas descrevem o que o contrato foi enquanto valeu, e zerá-las apagaria o registro;
      //   * `retiradoEm` continua **nulo** — cancelar não retira de circulação. São operações
      //     distintas, e é isso que mantém o contrato na carteira.
      //
      // E `pdfContratoArquivo` nulo, com o cancelamento respondendo `200`, é a forma de a
      // **não-portabilidade da RN-13** ficar provada: o sistema antigo recusaria este mesmo contrato.
      expect(cancelamento.corpo).toEqual({
        codigo: contrato.codigo,
        status: 'CANCELADO',
        imovelId: partes.imovelId,
        locadorId: partes.locadorId,
        locatarioId: partes.locatarioId,
        fiadores: partes.fiadores.map((fiador) => ({ id: fiador.id, nome: fiador.nome })),
        dataInicioLocacao: DATA_DE_INICIO,
        prazoMeses: PRAZO_EM_MESES,
        valorMensal: VALOR_MENSAL,
        diaVencimento: DIA_DE_VENCIMENTO,
        dataFimLocacao: DATA_DE_FIM_DA_ATIVACAO,
        valorTotalContrato: VALOR_TOTAL_DA_ATIVACAO,
        gerarCobrancasAutomaticamente: true,
        pdfContratoArquivo: null,
        retiradoEm: null,
      });

      // A SEGUNDA escrita do ato: o imóvel volta a ficar disponível. Nada no banco pareia as duas —
      // um imóvel que ficasse `LOCADO` depois do cancelamento seria **inlocável pela interface**, e
      // nenhuma outra linha desta suíte pega isso.
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('DISPONIVEL');

      // E a releitura é o MESMO corpo: a resposta do ato não é um objeto montado só para ela.
      const cancelado = await lerContrato(cookie, contrato.codigo);
      expect(cancelado).toEqual(cancelamento.corpo);

      // --- Transição inválida 3: CANCELAR de novo -----------------------------------------------
      //
      // A transição **não é idempotente por decisão**: o segundo pedido significa que quem o fez não
      // sabia o estado, e responder `200` o deixaria acreditar que acabou de cancelar algo.
      const deNovo = await transitar(cookie, contrato.codigo, 'cancelamento');

      expect(deNovo.status, deNovo.texto).toBe(422);
      expect(deNovo.corpo).toEqual(recusaDeEstado('CANCELADO', 'CANCELAMENTO'));

      // --- Transição inválida 4: ATIVAR o CANCELADO ---------------------------------------------
      //
      // O cancelado não volta a valer. A dupla com a recusa acima é o que prova que
      // `transicaoPedida` discrimina o ATO: as duas partem do MESMO `estadoAtual`, e uma recusa que
      // derivasse o ato do estado as tornaria indistinguíveis para o cliente.
      const reativacao = await transitar(cookie, contrato.codigo, 'ativacao');

      expect(reativacao.status, reativacao.texto).toBe(422);
      expect(reativacao.corpo).toEqual(recusaDeEstado('CANCELADO', 'ATIVACAO'));

      // Nenhuma das duas recusas mexeu no contrato nem soltou o imóvel de volta para `LOCADO`.
      expect(await lerContrato(cookie, contrato.codigo)).toEqual(cancelado);
      expect(await situacaoDoImovel(cookie, partes.imovelId)).toBe('DISPONIVEL');

      // --- O HISTÓRICO permanece: o cancelado continua listado na carteira ----------------------
      //
      // É a metade que separa *cancelar* de *apagar* (ADR-0014). A listagem é a **padrão**, sem
      // `incluirRetirados`: o cancelado não foi retirado de circulação, e uma implementação que o
      // escondesse da carteira reprova aqui — enquanto qualquer asserção sobre `GET /:codigo`
      // continuaria verde.
      const carteira = await pedir(`${COLECAO_DE_CONTRATOS}?limite=200`, { cookie });
      expect(carteira.status, carteira.texto).toBe(200);

      const naCarteira = itemDe(carteira.corpo as PaginaPublicada, contrato.codigo);
      expect(naCarteira).toEqual(cancelado);
      expect(naCarteira?.status).toBe('CANCELADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-422 — o contrato de A é inalcançável por B nas CINCO operações, com o MESMO 404',
    async () => {
      // Precondição AFIRMADA nas DUAS sessões, e ela é o que dá sentido ao caso: sem as quatro
      // chaves em B, o `403` da guarda mascararia o `404` e nada aqui provaria isolamento.
      for (const credencial of [cookie, cookieDeB]) {
        const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
          .corpo as SessaoPublicada;
        expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
        expect(sessao.acoes).toContain(ACAO_DE_ATIVACAO);
        expect(sessao.acoes).toContain(ACAO_DE_CANCELAMENTO);
        expect(sessao.acoes).toContain(ACAO_DE_CIRCULACAO);
      }

      // O contrato de A nasce e passa a valer PELA SESSÃO DE A — o código que B usa é o que aquela
      // criação devolveu: o caso prova o outro lado, isto é, que conhecer o código alheio não basta.
      const partesDeA = await montarPartes(cookie, 1);
      const deA = await criarContratoPor(cookie, partesDeA);
      const ativacao = await transitar(cookie, deA.codigo, 'ativacao');
      expect(ativacao.status, ativacao.texto).toBe(200);

      const intacto = await lerContrato(cookie, deA.codigo);

      // B monta as PRÓPRIAS partes. O corpo do `PUT` precisa ser válido e alcançável por B: com os
      // identificadores de A, a recusa poderia vir da conferência de cadastros em vez do não-alcance
      // do contrato, e o caso mediria outra coisa.
      const partesDeB = await montarPartes(cookieDeB, 1);

      const operacoes: readonly {
        readonly rotulo: string;
        readonly metodo: string;
        readonly sufixo: string;
        readonly corpo?: Record<string, unknown>;
      }[] = [
        { rotulo: 'GET', metodo: 'GET', sufixo: '' },
        { rotulo: 'PUT', metodo: 'PUT', sufixo: '', corpo: corpoDeContrato(partesDeB) },
        { rotulo: 'ativacao', metodo: 'POST', sufixo: '/ativacao', corpo: {} },
        { rotulo: 'cancelamento', metodo: 'POST', sufixo: '/cancelamento', corpo: {} },
        { rotulo: 'retirada', metodo: 'POST', sufixo: '/retirada', corpo: {} },
      ];

      for (const operacao of operacoes) {
        const alvo = (codigo: string): string =>
          `${COLECAO_DE_CONTRATOS}/${codigo}${operacao.sufixo}`;
        const opcoes = {
          metodo: operacao.metodo,
          cookie: cookieDeB,
          ...(operacao.corpo === undefined ? {} : { corpo: operacao.corpo }),
        };

        const alheio = await pedir(alvo(deA.codigo), opcoes);
        const inexistente = await pedir(alvo(CODIGO_INEXISTENTE), opcoes);

        expect(alheio.status, `${operacao.rotulo}: ${alheio.texto}`).toBe(404);
        expect(alheio.corpo, operacao.rotulo).toEqual({
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        });

        // A igualdade entre as DUAS respostas é a prova de verdade: sozinho, o literal acima seria
        // satisfeito por uma borda que respondesse `404` a tudo — e é o controle positivo, no fim do
        // caso, que fecha essa saída. Aqui o que se mede é que a borda **não distingue** "existe em
        // outra empresa" de "não existe".
        expect(inexistente.status, operacao.rotulo).toBe(alheio.status);
        expect(inexistente.corpo, operacao.rotulo).toEqual(alheio.corpo);
      }

      // --- Controle POSITIVO: o contrato de A permanece intacto, e alcançável por A -------------
      //
      // Ele fecha as duas saídas de uma vez: a borda não responde `404` a tudo, e nenhuma das cinco
      // tentativas cruzadas teve efeito — nem sobre o contrato, nem sobre o imóvel dele.
      expect(await lerContrato(cookie, deA.codigo)).toEqual(intacto);
      expect(intacto.status).toBe('ATIVO');
      expect(await situacaoDoImovel(cookie, partesDeA.imovelId)).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-426 — sem ACAO:cancelar_contrato, o cancelamento recusa e o contrato permanece vigente',
    async () => {
      // Sujeito EXCLUSIVO, pela mesma razão do `CT-425`: o eixo positivo altera o efetivo dele, e
      // compartilhá-lo faria os demais casos observarem uma chave que este concedeu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.ativa.contrato');
      const semCancelar: readonly ChaveDoCatalogo[] = [
        AREA_DOS_CONTRATOS,
        'TELA:imoveis',
        'TELA:cadastros',
        ACAO_DE_ATIVACAO,
      ];
      await conceder(sujeito.usuarioId, EMPRESA_A.id, semCancelar);

      // --- Passo 1: a AUSÊNCIA da chave é AFIRMADA, e não suposta ------------------------------
      //
      // As TRÊS pontas importam, e a do meio é o eixo do caso: a sessão TEM a ação de ativar. Sem
      // ela, o `403` do passo 4 seria compatível com uma sessão que não alcança transição alguma, e
      // o caso não diria nada sobre a **independência** entre as duas ações.
      const antes = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: sujeito.cookie }))
        .corpo as SessaoPublicada;
      expect(antes.telas).toContain(AREA_DOS_CONTRATOS);
      expect(antes.acoes).toContain(ACAO_DE_ATIVACAO);
      expect(antes.acoes).not.toContain(ACAO_DE_CANCELAMENTO);

      // --- Passo 2 e 3: a MESMA sessão monta e faz valer ---------------------------------------
      const partes = await montarPartes(sujeito.cookie, 1);
      const contrato = await criarContratoPor(sujeito.cookie, partes);
      const ativacao = await transitar(sujeito.cookie, contrato.codigo, 'ativacao');

      expect(ativacao.status, ativacao.texto).toBe(200);
      expect(await situacaoDoImovel(sujeito.cookie, partes.imovelId)).toBe('LOCADO');

      const vigente = await lerContrato(sujeito.cookie, contrato.codigo);

      // --- Passo 4: CANCELAR recusa, nomeando a ação que FALTA ---------------------------------
      const recusa = await transitar(sujeito.cookie, contrato.codigo, 'cancelamento');

      expect(recusa.status, recusa.texto).toBe(403);
      // Corpo INTEIRO, e `exigido` nomeando **`ACAO:cancelar_contrato`** — nem a área, que a sessão
      // possui, nem a ação de ativar, que ela também possui. É esta linha que acusa a rota que
      // declarasse a ação errada por cópia da vizinha logo acima no controlador.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_CANCELAMENTO },
      });

      // --- Passo 5: o contrato permanece VIGENTE e o imóvel LOCADO -----------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma implementação que cancelasse e só então
      // recusasse passaria em tudo acima e reprovaria aqui. As duas metades, de novo: o contrato e o
      // imóvel — a segunda escrita do ato tem de não ter acontecido também.
      expect(await lerContrato(sujeito.cookie, contrato.codigo)).toEqual(vigente);
      expect(vigente.status).toBe('ATIVO');
      expect(await situacaoDoImovel(sujeito.cookie, partes.imovelId)).toBe('LOCADO');

      // --- Passo 6: concedida a AÇÃO, a MESMA rota responde 200 --------------------------------
      //
      // É o que torna a mudança de comportamento atribuível à chave, e a nada mais. Sem ele, uma
      // rota que recusasse sempre passaria o eixo negativo inteiro.
      await conceder(sujeito.usuarioId, EMPRESA_A.id, [...semCancelar, ACAO_DE_CANCELAMENTO]);

      const depois = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: sujeito.cookie }))
        .corpo as SessaoPublicada;
      expect(depois.acoes).toContain(ACAO_DE_CANCELAMENTO);

      const aceita = await transitar(sujeito.cookie, contrato.codigo, 'cancelamento');

      expect(aceita.status, aceita.texto).toBe(200);
      expect((aceita.corpo as ContratoPublicado).status).toBe('CANCELADO');
      expect(await situacaoDoImovel(sujeito.cookie, partes.imovelId)).toBe('DISPONIVEL');
    },
    LIMITE_CASO_MS,
  );
});

describe('a situação de locação sai do corpo do PUT e ganha rota própria (T10)', () => {
  it(
    'CT-434 — o PUT de imóvel não desfaz o LOCADO, e a rota de situação é o único caminho',
    async () => {
      const partes = await montarPartes(cookie, 1);
      const contrato = await criarContratoPor(cookie, partes);
      const itemDoImovel = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/${partes.imovelId}`;

      // --- Precondição: o imóvel LOCADO, com o contrato vigente publicado ao lado ---------------
      //
      // As duas fontes são afirmadas **juntas**, e é essa conjunção que o caso inteiro persegue: o
      // invariante sob prova não é "o campo tem tal valor", é *"as duas fontes nunca divergem no
      // mesmo corpo"*.
      expect((await transitar(cookie, contrato.codigo, 'ativacao')).status).toBe(200);

      const locado = await lerImovel(cookie, partes.imovelId);
      // O nome vem da leitura do PRÓPRIO cadastro de locatário, por rota independente: extraí-lo do
      // corpo sob teste faria a asserção concordar consigo mesma.
      const locatario = await lerCadastro(cookie, CAMINHO_DOS_LOCATARIOS, partes.locatarioId);

      expect(locado.statusLocacao).toBe('LOCADO');
      expect(locado.contratoVigente).toEqual({
        codigo: contrato.codigo,
        locatario: { id: partes.locatarioId, nome: locatario.nome },
      });
      exigirFontesConcordantes(locado, 'precondição');

      // --- Passo 1: o `PUT` COM `statusLocacao` é recusado como CHAVE DESCONHECIDA --------------
      //
      // Recusa **ruidosa**, e é isso que o `422` afirma: um esquema que apenas ignorasse o campo
      // responderia `200`, e o cliente que ainda o envia continuaria acreditando que escolhe a
      // situação de locação pelo corpo da alteração — o defeito trocado de lugar, não fechado.
      //
      // O corpo é afirmado INTEIRO: o Zod reporta chave desconhecida de um `strictObject` com
      // caminho vazio, e por isso a recusa nomeia `corpo`. Um envelope que ganhasse `detalhes` — com
      // o `ZodError` dentro, que é por onde a entrada recusada vazaria — reprova aqui.
      const comOCampo = await pedir(itemDoImovel, {
        metodo: 'PUT',
        cookie,
        corpo: { ...corpoDeImovelAlterado(locado), statusLocacao: 'DISPONIVEL' },
      });

      expect(comOCampo.status, comOCampo.texto).toBe(422);
      expect(comOCampo.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'corpo',
      });

      // E a recusa não gravou metade: o imóvel byte a byte como estava. Sem esta linha, o `422`
      // sozinho seria satisfeito por uma borda que gravasse primeiro e recusasse depois.
      expect(await lerImovel(cookie, partes.imovelId)).toEqual(locado);

      // --- Passo 2: o `PUT` com o corpo NOVO altera o endereço e PRESERVA o `LOCADO` ------------
      //
      // É a metade que discrimina, e a razão de o passo 1 não bastar: uma borda que **aceitasse** o
      // campo e o ignorasse passaria por lá se a asserção olhasse só o corpo da resposta. Aqui o
      // corpo nem carrega o campo, e o que se afirma é que a coluna **não foi escrita** — a
      // igualdade é sobre o imóvel inteiro, com o endereço trocado e todo o resto idêntico,
      // inclusive `statusLocacao` e `contratoVigente`.
      const alteracao = await pedir(itemDoImovel, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeImovelAlterado(locado, {
          logradouro: LOGRADOURO_CORRIGIDO,
          numero: NUMERO_CORRIGIDO,
        }),
      });

      expect(alteracao.status, alteracao.texto).toBe(200);
      expect(alteracao.corpo).toEqual({
        ...locado,
        logradouro: LOGRADOURO_CORRIGIDO,
        numero: NUMERO_CORRIGIDO,
      });
      exigirFontesConcordantes(alteracao.corpo as ImovelPublicado, 'PUT que corrige o endereço');

      // A releitura é o MESMO corpo: a resposta do `PUT` não é um objeto montado só para ela, e a
      // coluna no banco continua `LOCADO`.
      const depoisDoPut = await lerImovel(cookie, partes.imovelId);
      expect(depoisDoPut).toEqual(alteracao.corpo);
      exigirFontesConcordantes(depoisDoPut, 'releitura depois do PUT');

      // --- Passo 3: a rota de situação sobre o imóvel LOCADO é RECUSADA -------------------------
      //
      // Sem ela, a rota nova reabriria o mesmo furo por outra porta. O corpo é afirmado inteiro, e
      // `detalhes.conflito` é o que diz ao usuário **por que** não pode — para liberar o imóvel,
      // cancele o contrato.
      const sobreLocado = await informarSituacao(cookie, partes.imovelId, 'INDISPONIVEL');

      expect(sobreLocado.status, sobreLocado.texto).toBe(422);
      expect(sobreLocado.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DA_SITUACAO,
        detalhes: { conflito: CONFLITO_DE_VIGENCIA },
      });
      expect(await lerImovel(cookie, partes.imovelId)).toEqual(alteracao.corpo);

      // A recusa vale para as DUAS situações informáveis, e não só para a que "parece" perigosa:
      // `DISPONIVEL` sobre um imóvel locado divergiria do contrato exatamente do mesmo jeito.
      const paraDisponivel = await informarSituacao(cookie, partes.imovelId, 'DISPONIVEL');
      expect(paraDisponivel.status, paraDisponivel.texto).toBe(422);
      expect(paraDisponivel.corpo).toEqual(sobreLocado.corpo);

      // --- Passo 4: as duas recusas de ENTRADA da rota nova -------------------------------------
      //
      // `LOCADO` **não é informável** — ele é produzido pela ativação de contrato, e a assimetria da
      // fatia anterior permanece —, e o corpo é fechado num campo só. As duas recusas vêm do
      // **esquema**, antes de o serviço rodar, e nomeiam campos **diferentes**: o valor fora da união
      // tem caminho (`statusLocacao`), e a chave desconhecida de um `strictObject` não tem — cai no
      // campo padrão do ponto de chamada (`corpo`). É essa diferença que separa "o cliente mandou um
      // valor que não existe" de "o cliente mandou um campo que não existe", e afirmá-las com o mesmo
      // corpo apagaria a distinção.
      const comLocado = await informarSituacao(cookie, partes.imovelId, 'LOCADO');
      expect(comLocado.status, comLocado.texto).toBe(422);
      expect(comLocado.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DA_SITUACAO,
      });

      const comChaveExtra = await pedir(`${itemDoImovel}/situacao-de-locacao`, {
        metodo: 'POST',
        cookie,
        corpo: { statusLocacao: 'INDISPONIVEL', retiradoEm: null },
      });
      expect(comChaveExtra.status, comChaveExtra.texto).toBe(422);
      expect(comChaveExtra.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'corpo',
      });

      // E nenhuma das duas recusas de entrada tocou o imóvel: a igualdade é sobre o corpo inteiro.
      expect(await lerImovel(cookie, partes.imovelId)).toEqual(alteracao.corpo);

      // --- Passo 5: o EIXO POSITIVO — cancelado o contrato, a MESMA rota passa ------------------
      //
      // É ele que torna a recusa do passo 3 atribuível ao **contrato vigente**, e a nada mais: sem
      // esta metade, tudo acima seria satisfeito por uma rota que recusa sempre. E é ele que prova
      // que a porta existe e funciona, que é o outro lado de tirar o campo do `PUT`.
      expect((await transitar(cookie, contrato.codigo, 'cancelamento')).status).toBe(200);

      const liberado = await lerImovel(cookie, partes.imovelId);
      expect(liberado.statusLocacao).toBe('DISPONIVEL');
      expect(liberado.contratoVigente).toBeNull();

      const informada = await informarSituacao(cookie, partes.imovelId, 'INDISPONIVEL');
      expect(informada.status, informada.texto).toBe(200);
      expect(informada.corpo).toEqual({ ...liberado, statusLocacao: 'INDISPONIVEL' });

      // E a releitura confirma que a rota gravou, em vez de ecoar o corpo pedido.
      const depoisDaRota = await lerImovel(cookie, partes.imovelId);
      expect(depoisDaRota).toEqual(informada.corpo);
      exigirFontesConcordantes(depoisDaRota, 'depois da rota de situação');
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// As sete recusas de entrada — tabela declarada, com o campo culpado escrito por linha
// ---------------------------------------------------------------------------------------------

/** Uma recusa exercitada pelo `CT-411`, com o campo que a resposta tem de nomear. */
interface Recusa {
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: () => string;
  readonly corpo?: Record<string, unknown>;
  readonly campo: string;
}

/**
 * As sete recusas: as **cinco** condições de entrada da RD-08 mais as duas fronteiras da §6.4 que não
 * têm caso próprio — o `:codigo` malformado e o fiador repetido.
 *
 * A tabela é uma **função** das partes porque cada linha precisa de um corpo válido em tudo menos no
 * campo sob prova: uma tabela de literais soltos recusaria por outro motivo, e o caso passaria
 * afirmando o campo errado.
 */
function recusasDaCriacao(partes: Partes, fiadorId: string): readonly Recusa[] {
  return [
    {
      rotulo: 'prazo_zero',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: corpoDeContrato(partes, { prazoMeses: 0 }),
      campo: 'prazoMeses',
    },
    {
      rotulo: 'valor_zero',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: corpoDeContrato(partes, { valorMensal: 0 }),
      campo: 'valorMensal',
    },
    {
      rotulo: 'dia_zero',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: corpoDeContrato(partes, { diaVencimento: 0 }),
      campo: 'diaVencimento',
    },
    {
      // O 29 é a fronteira superior da RD-08, e ela é conteúdo: fevereiro não tem dia 29 em ano
      // comum, e o sistema antigo recusa o mesmo valor.
      rotulo: 'dia_29',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: corpoDeContrato(partes, { diaVencimento: 29 }),
      campo: 'diaVencimento',
    },
    {
      rotulo: 'data_ausente',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: semCampo(corpoDeContrato(partes), 'dataInicioLocacao'),
      campo: 'dataInicioLocacao',
    },
    {
      // A recusa do banco pela restrição `unique (contrato_id, fiador_id)` chegaria **sem nome de
      // campo**, e o cliente não saberia qual dos dez corrigir. Quem nomeia é o esquema.
      rotulo: 'fiador_repetido',
      metodo: 'POST',
      alvo: () => COLECAO_DE_CONTRATOS,
      corpo: corpoDeContrato(partes, { fiadoresIds: [fiadorId, fiadorId] }),
      campo: 'fiadoresIds',
    },
    {
      // O código é validado ANTES de a unidade de trabalho abrir: a forma do identificador não vira
      // oráculo de existência, e o banco não é tocado. Uma borda que consultasse primeiro devolveria
      // `404` aqui.
      rotulo: 'codigo_malformado',
      metodo: 'GET',
      alvo: () => `${COLECAO_DE_CONTRATOS}/${CODIGO_MALFORMADO}`,
      campo: 'codigo',
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// As quatro ordens de fiadores — a tabela que prende a recusa ao PRIMEIRO problema da ENTRADA
// ---------------------------------------------------------------------------------------------

/** Uma coleção de fiadores exercitada pelo `CT-411 (c)`, com o desfecho INTEIRO escrito por linha. */
interface OrdemDeFiadores {
  readonly rotulo: string;
  readonly fiadoresIds: readonly string[];
  readonly status: number;
  readonly corpo: Record<string, unknown>;
}

/**
 * As quatro ordens, e o que **cada par** delas discrimina.
 *
 * A conferência dos fiadores é uma leitura **em lote** seguida de uma iteração sobre a entrada. Essa
 * forma tem dois modos de falha que nenhuma outra linha desta suíte alcança, e cada um tem aqui o par
 * que o pega:
 *
 *   * **perder o identificador AUSENTE.** A implementação ingênua do lote percorre as linhas que o
 *     banco devolveu — e o cadastro inalcançável não está entre elas, de modo que a recusa
 *     simplesmente não acontece e o vínculo cruzado chega à gravação. `ausente_no_meio` é quem o pega:
 *     ele põe um UUID inalcançável **fora da primeira posição**, onde uma conferência que só olhasse
 *     o primeiro item também passaria;
 *   * **perder a ORDEM.** Com todos os fiadores nomeando o mesmo campo, `campo: 'fiadoresIds'` **não**
 *     discrimina ordem — é preciso que os dois problemas produzam respostas de forma diferente. Daí o
 *     par `retirado_antes_do_ausente` (`422`) e `ausente_antes_do_retirado` (`404`): a **mesma dupla
 *     de identificadores**, trocada de posição, e a resposta acompanha a posição. Uma implementação
 *     que conferisse "todos presentes?" antes de olhar a circulação — que é o jeito natural de
 *     escrever o lote — responderia `404` nas duas e reprovaria na primeira.
 *
 * O desfecho vai por extenso em cada linha, corpo INTEIRO, e não derivado do que a outra respondeu:
 * derivá-lo faria as quatro concordarem entre si sem afirmar nada sobre a forma da recusa.
 */
function ordensDeFiadores(
  primeiro: string,
  retirado: string,
  ultimo: string,
): readonly OrdemDeFiadores[] {
  const recusaPorCirculacao = {
    codigo: CodigoErro.CAMPO_INVALIDO,
    mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
    campo: 'fiadoresIds',
    detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' },
  };

  const recusaPorAusencia = {
    codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
    mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
  };

  return [
    {
      rotulo: 'retirado_no_meio',
      fiadoresIds: [primeiro, retirado, ultimo],
      status: 422,
      corpo: recusaPorCirculacao,
    },
    {
      rotulo: 'ausente_no_meio',
      fiadoresIds: [primeiro, UUID_INEXISTENTE, ultimo],
      status: 404,
      corpo: recusaPorAusencia,
    },
    {
      rotulo: 'retirado_antes_do_ausente',
      fiadoresIds: [retirado, UUID_INEXISTENTE],
      status: 422,
      corpo: recusaPorCirculacao,
    },
    {
      rotulo: 'ausente_antes_do_retirado',
      fiadoresIds: [UUID_INEXISTENTE, retirado],
      status: 404,
      corpo: recusaPorAusencia,
    },
  ];
}

/** O mesmo corpo, sem um dos campos — o vetor da recusa por campo obrigatório ausente. */
function semCampo(corpo: Record<string, unknown>, campo: string): Record<string, unknown> {
  const { [campo]: _removido, ...resto } = corpo;

  return resto;
}

// ---------------------------------------------------------------------------------------------
// Arranjo — os cadastros nascem pelas ROTAS; os estados, pelas PORTAS já publicadas
// ---------------------------------------------------------------------------------------------

/** Os cadastros que um contrato referencia, todos criados pela sessão que os vai usar. */
interface Partes {
  readonly conjuntoId: string;
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadores: readonly { readonly id: string; readonly nome: string }[];
}

/**
 * O sequencial que dá unicidade aos campos únicos do arranjo.
 *
 * Monotônico e de processo, e não sorteado: identificador municipal, documento e endereço de e-mail
 * vivem sob restrições que **alcançam os cadastros retirados** (ADR-0014), de modo que um valor
 * repetido produziria `422` de unicidade onde o caso mede outra coisa.
 */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/**
 * Monta conjunto, imóvel, locador, locatário e `quantosFiadores` fiadores **pelas rotas reais**, com a
 * sessão informada.
 *
 * Nada é gravado por conexão privilegiada: a empresa de cada cadastro sai da sessão que o cria, que é
 * exatamente o mecanismo que o `CT-423` explora. A falha levanta em vez de devolver — uma precondição
 * que falhasse em silêncio faria o caso reprovar numa asserção adiante, apontando para o lugar errado.
 *
 * Os fiadores recebem nome derivado do sequencial, e a ordem alfabética deles coincide com a ordem de
 * criação: a porta ordena o agregado por `nome, id`, e é isso que torna as asserções sobre o vetor de
 * fiadores literais em vez de dependentes de ordenação.
 */
async function montarPartes(
  credencial: string,
  quantosFiadores: number,
  ajustesDoImovel: Record<string, unknown> = {},
): Promise<Partes> {
  const conjuntoId = (
    await criarPor(credencial, CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` })
  ).id;

  const imovelId = (
    await criarPor(credencial, CAMINHO_DOS_IMOVEIS, {
      ...corpoDeImovel(conjuntoId),
      ...ajustesDoImovel,
    })
  ).id;
  const locadorId = (await criarPor(credencial, CAMINHO_DOS_LOCADORES, corpoDePessoa())).id;
  const locatarioId = (await criarPor(credencial, CAMINHO_DOS_LOCATARIOS, corpoDePessoa())).id;

  const fiadores: { id: string; nome: string }[] = [];
  for (let indice = 0; indice < quantosFiadores; indice += 1) {
    const corpo = corpoDePessoa();
    const criado = await criarPor(credencial, CAMINHO_DOS_FIADORES, corpo);

    fiadores.push({ id: criado.id, nome: corpo.nome as string });
  }

  return { conjuntoId, imovelId, locadorId, locatarioId, fiadores };
}

/** Cria um cadastro pela rota real e devolve o identificador dele. A falha levanta. */
async function criarPor(
  credencial: string,
  dono: string,
  corpo: Record<string, unknown>,
): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(alvo, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { id: string };
}

/** O corpo completo de um imóvel, com o identificador municipal único por construção. */
function corpoDeImovel(conjuntoId: string): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    conjuntoId,
    nomeImovel: `Ap ${marca}`,
    identificadorMunicipal: `IM-${marca}`,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: null,
  };
}

/** O corpo completo de um cadastro de pessoa, com documento e e-mail únicos por construção. */
function corpoDePessoa(): Record<string, unknown> {
  const numero = proximo();
  const marca = String(numero).padStart(6, '0');

  return {
    nome: `Parte ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(numero),
    rg: null,
    email: `parte.${marca}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * O corpo completo de um contrato, com as partes por parâmetro.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave. `codigo`, `status`, `dataFimLocacao` e `valorTotalContrato` também não
 * aparecem, pela mesma razão — os quatro são decididos pelo servidor.
 */
function corpoDeContrato(
  partes: Partes,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    imovelId: partes.imovelId,
    locadorId: partes.locadorId,
    locatarioId: partes.locatarioId,
    fiadoresIds: partes.fiadores.map((fiador) => fiador.id),
    dataInicioLocacao: DATA_DE_INICIO,
    prazoMeses: PRAZO_EM_MESES,
    valorMensal: VALOR_MENSAL,
    diaVencimento: DIA_DE_VENCIMENTO,
    gerarCobrancasAutomaticamente: true,
    pdfContratoArquivo: null,
    ...ajustes,
  };
}

/**
 * Monta um contrato pela rota real e devolve o corpo publicado. A falha levanta.
 *
 * Os `ajustes` são os do corpo, e existem porque o `CT-413` precisa dos termos do golden — a virada
 * de mês e o par do resíduo binário — em vez dos termos padrão deste arquivo. Nenhum ponto de chamada
 * anterior muda: o parâmetro é opcional e o valor omitido é o corpo de sempre.
 */
async function criarContratoPor(
  credencial: string,
  partes: Partes,
  ajustes: Record<string, unknown> = {},
): Promise<ContratoPublicado> {
  const resposta = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: credencial,
    corpo: corpoDeContrato(partes, ajustes),
  });

  if (resposta.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as ContratoPublicado;
}

/** Lê um contrato pela rota real e devolve o corpo publicado. A falha levanta. */
async function lerContrato(credencial: string, codigo: string): Promise<ContratoPublicado> {
  const resposta = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}`, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as ContratoPublicado;
}

/** O item da página com o código informado, ou `undefined` quando a página não o traz. */
function itemDe(pagina: PaginaPublicada, codigo: string): ContratoPublicado | undefined {
  return pagina.itens.find((item) => item.codigo === codigo);
}

/**
 * Pede uma das **duas transições governadas** pela rota real, com o corpo vazio que elas exigem.
 *
 * Ela devolve a {@link Resposta} crua, e **não** levanta em recusa: metade dos casos da T8 mede
 * justamente a recusa, e um acessório que levantasse os obrigaria a chamar `pedir` por extenso — o
 * que faria a montagem do alvo e do corpo nascer duplicada, livre para divergir da forma legítima.
 *
 * O ato entra como união fechada de dois literais: `transitar(cookie, codigo, 'ativacaoo')` não
 * compila, e o modo de falha que ele fecha é medido — um sufixo com erro de digitação viraria `404`
 * de rota inexistente, que é exatamente o que vários casos daqui **esperam** em outra circunstância.
 */
async function transitar(
  credencial: string,
  codigo: string,
  ato: 'ativacao' | 'cancelamento',
): Promise<Resposta> {
  return await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/${ato}`, {
    metodo: 'POST',
    cookie: credencial,
    corpo: {},
  });
}

/**
 * O corpo, **inteiro**, da recusa por transição inválida (§10.1 da tech spec).
 *
 * Escrito num acessório porque as **quatro** transições inválidas do `CT-415` afirmam a mesma forma
 * com dois valores diferentes, e quatro cópias do literal ficariam livres para divergir no código, na
 * mensagem e no nome dos dois discriminadores — os quatro são contrato publicado. Os parâmetros são
 * os únicos campos que mudam, e é por isso que eles são parâmetros.
 *
 * O tipo do ato é união fechada dos **três** literais que o serviço publica: um `'CANCELAMETO'`
 * escrito aqui não compila. É o mesmo fechamento que o débito D34 (F2/T7) pediu do lado do produto,
 * e ter os dois lados presos é o que impede a asserção de concordar com um erro de digitação copiado.
 */
function recusaDeEstado(
  estadoAtual: 'RASCUNHO' | 'ATIVO' | 'CANCELADO' | 'ENCERRADO',
  transicaoPedida: 'ALTERACAO' | 'ATIVACAO' | 'CANCELAMENTO',
): Record<string, unknown> {
  return {
    codigo: CodigoErro.CAMPO_INVALIDO,
    mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
    campo: 'status',
    detalhes: { estadoAtual, transicaoPedida },
  };
}

/**
 * A situação de locação do imóvel, lida pela rota real. A falha levanta.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e este acessório é que repetia a leitura
 * que {@link lerImovel} passou a fazer. Ele **delega** em vez de emitir a própria requisição: duas
 * leituras da mesma rota ficariam livres para divergir no alvo e no tratamento da falha. **Nenhuma
 * asserção mudou** — os pontos de chamada anteriores continuam recebendo a mesma cadeia, e nenhum
 * deles foi tocado.
 */
async function situacaoDoImovel(credencial: string, imovelId: string): Promise<string> {
  return (await lerImovel(credencial, imovelId)).statusLocacao;
}

/** O imóvel **inteiro**, lido pela rota real — o corpo que o `CT-434` compara. A falha levanta. */
async function lerImovel(credencial: string, imovelId: string): Promise<ImovelPublicado> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/${imovelId}`;
  const resposta = await pedir(alvo, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as ImovelPublicado;
}

/** Um cadastro de pessoa lido pela rota real, pelo papel informado. A falha levanta. */
async function lerCadastro(
  credencial: string,
  dono: string,
  id: string,
): Promise<{ readonly nome: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}/${id}`;
  const resposta = await pedir(alvo, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { nome: string };
}

/**
 * Pede a rota de **situação de locação** com o corpo de um campo que ela exige.
 *
 * Como {@link transitar}, ela devolve a {@link Resposta} crua e **não** levanta em recusa: metade do
 * `CT-434` mede justamente a recusa, e um acessório que levantasse obrigaria a chamar `pedir` por
 * extenso — o que faria a montagem do alvo e do corpo nascer duplicada, livre para divergir da forma
 * legítima.
 *
 * A situação entra como união fechada dos **três** literais do enum do domínio, e não como `string`:
 * o `LOCADO` do passo 4 é vetor legítimo (ele tem de ser recusado), e um `'INDISPONVEL'` com erro de
 * digitação — que produziria o mesmo `422` por outra razão e deixaria o caso provando nada — não
 * compila.
 */
async function informarSituacao(
  credencial: string,
  imovelId: string,
  statusLocacao: 'DISPONIVEL' | 'INDISPONIVEL' | 'LOCADO',
): Promise<Resposta> {
  return await pedir(
    `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/${imovelId}/situacao-de-locacao`,
    { metodo: 'POST', cookie: credencial, corpo: { statusLocacao } },
  );
}

/**
 * O corpo **completo** do `PUT` de imóvel, derivado do imóvel como ele está — e **sem**
 * `statusLocacao`.
 *
 * Ele é montado a partir da leitura, e não do arranjo, porque o `PUT` desta superfície é uma
 * reescrita integral: um corpo com identificador municipal novo alteraria dois fatos de uma vez, e a
 * igualdade do imóvel inteiro deixaria de dizer o que mudou. Com esta forma, o único delta é o que o
 * caso escreve em `ajustes` — e é sobre esse delta que a asserção fala.
 *
 * `statusLocacao` **não entra**, e a ausência é o ponto: o campo saiu do corpo da alteração na T10.
 * O passo 1 do `CT-434` o acrescenta de volta **de propósito**, para medir a recusa ruidosa.
 */
function corpoDeImovelAlterado(
  imovel: ImovelPublicado,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    conjuntoId: imovel.conjuntoId,
    nomeImovel: imovel.nomeImovel,
    identificadorMunicipal: imovel.identificadorMunicipal,
    tipoImovel: imovel.tipoImovel,
    logradouro: imovel.logradouro,
    numero: imovel.numero,
    complemento: imovel.complemento,
    bairro: imovel.bairro,
    cidade: imovel.cidade,
    estado: imovel.estado,
    cep: imovel.cep,
    observacoes: imovel.observacoes,
    ...ajustes,
  };
}

/**
 * Recusa o corpo em que as **duas fontes divergem** — a invariante que o `CT-434` persegue.
 *
 * *"Nenhuma resposta traz `statusLocacao: 'DISPONIVEL'` junto de `contratoVigente` preenchido"* é uma
 * afirmação sobre **todos** os corpos observados, e não sobre um campo de um deles. Escrita como
 * acessório, ela é aplicada a cada corpo que o caso vê — inclusive aos que ele já compara por
 * igualdade —, e a mensagem nomeia **onde** a divergência apareceu.
 *
 * A conferência é nos **dois sentidos**: um imóvel `LOCADO` sem contrato vigente é a metade espelhada
 * do mesmo defeito, e é a que o cancelamento produziria se a segunda escrita dele sumisse — o imóvel
 * ficaria inlocável pela interface, sem que nada acusasse.
 */
function exigirFontesConcordantes(imovel: ImovelPublicado, onde: string): void {
  const locado = imovel.statusLocacao === 'LOCADO';
  const comContratoVigente = imovel.contratoVigente !== null;

  // A igualdade afirma a EQUIVALÊNCIA — o lado esperado repete `comContratoVigente` nas duas chaves,
  // de modo que `locado ≠ comContratoVigente` reprova em qualquer um dos dois sentidos. O `onde`
  // viaja dentro do objeto para que a falha diga em que corpo a divergência apareceu.
  expect({ onde, locado, comContratoVigente }, `as duas fontes divergem em ${onde}`).toEqual({
    onde,
    locado: comContratoVigente,
    comContratoVigente,
  });
}

/**
 * A falha que o `CT-413 (b)` injeta **dentro** da unidade de trabalho, antes do commit.
 *
 * Classe própria, e não `Error` genérico: a asserção é `rejects.toThrow(FalhaForcadaAntesDoCommit)`,
 * de tipo específico. Um `Error` qualquer faria o caso aceitar **qualquer** falha da sequência —
 * inclusive uma que acontecesse antes das duas escritas, que é justamente o cenário em que ele não
 * provaria nada sobre o desfazimento.
 */
class FalhaForcadaAntesDoCommit extends Error {
  override readonly name = 'FalhaForcadaAntesDoCommit';

  constructor() {
    super('falha injetada pelo CT-413 (b) depois das duas escritas e antes do commit');
  }
}

/**
 * Emite as **duas escritas da ativação** — o estado do contrato e a situação do imóvel — dentro de
 * **uma** unidade de trabalho, e opcionalmente levanta antes do commit.
 *
 * As portas são as MESMAS que `ContratoService.ativar` chama (`ativarContrato` e
 * `definirSituacaoDeLocacaoDoImovel`), na mesma ordem. O que este acessório recria é a **unidade**,
 * porque é ela a propriedade sob prova — e a rota não tem entrada capaz de fazer a segunda escrita
 * falhar sem que se acrescentasse à produção um ponto de injeção que só o teste usaria, o que a Lei
 * do seam proíbe. A razão por extenso está no cabeçalho deste arquivo.
 *
 * As duas derivações entram como valores literais, pela mesma razão de {@link ativarPelaPorta}: o
 * que este caso mede não é a derivação.
 */
async function escreverAsDuasEscritas(
  codigo: string,
  imovelId: string,
  falharAntesDoCommit: boolean,
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const ativado = await ativarContrato(tx, codigo, {
        dataFimLocacao: DATA_DE_FIM_DA_ATIVACAO,
        valorTotalContrato: VALOR_TOTAL_DA_ATIVACAO,
      });

      if (ativado === undefined) {
        throw new Error(`o arranjo não alcançou o contrato ${codigo} para ativá-lo`);
      }

      await definirSituacaoDeLocacaoDoImovel(tx, imovelId, 'LOCADO');

      if (falharAntesDoCommit) {
        throw new FalhaForcadaAntesDoCommit();
      }
    });
  });
}

/**
 * Faz nascer uma pessoa `USUARIO_EMPRESA` da empresa A pela **rota real** do Admin, já operando com
 * senha definitiva.
 *
 * A carga tem uma única pessoa desse perfil na empresa A, e ela já age neste arquivo. O `CT-425`
 * precisa de efetivo **próprio** — ele o altera no eixo positivo —, e o caminho é o mesmo de
 * `test/circulacao-de-cadastro.e2e.spec.ts`: criação pela rota do Admin e troca da senha provisória
 * pela rota do produto. Nada é forjado e nenhum símbolo é acrescentado à produção (Iron Law #6).
 */
async function pessoaOperandoComSenhaTrocada(prefixo: string): Promise<PessoaEmOperacao> {
  const cookieDoAdmin = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);

  const criada = await pedir(CAMINHO_DAS_PESSOAS, {
    metodo: 'POST',
    cookie: cookieDoAdmin,
    corpo: {
      nome: 'Pessoa Que Só Monta Contratos',
      email: `${prefixo}.${randomUUID()}@exemplo.com.br`,
      perfil: 'USUARIO_EMPRESA',
    },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const { usuarioId, email, senhaProvisoria } = criada.corpo as {
    usuarioId: string;
    email: string;
    senhaProvisoria: string;
  };

  const restrita = await entrar(email, senhaProvisoria);
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie: restrita,
    corpo: { senhaAtual: senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
  // importa é o cookie que passa a valer, e não por qual das duas ele chegou.
  const reemitida = troca.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  return { usuarioId, cookie: reemitida?.split(';')[0] ?? restrita };
}

/** Uma pessoa da empresa já operando com sessão plena — o que o `CT-425` observa dela. */
interface PessoaEmOperacao {
  readonly usuarioId: string;
  readonly cookie: string;
}

/**
 * Faz o contrato valer **pela porta** que a T5 publicou, e ocupa o imóvel pela porta estreita.
 *
 * **A rota de ativação existe a partir da T7, e este arranjo continua pela porta de propósito.** Os
 * casos que o usam — `CT-409`, `CT-410`, `CT-417` e `CT-418` — medem o cadastro, e não a transição:
 * acoplar o arranjo deles ao SUT da T7 faria uma falha da ativação reprovar quatro casos que nada
 * têm com ela, apontando para o lugar errado. As duas derivações entram como valores literais — ver
 * o cabeçalho deste arquivo.
 */
async function ativarPelaPorta(empresaId: string, codigo: string, imovelId: string): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const ativado = await ativarContrato(tx, codigo, {
        dataFimLocacao: DATA_DE_FIM_DA_ATIVACAO,
        valorTotalContrato: VALOR_TOTAL_DA_ATIVACAO,
      });

      if (ativado === undefined) {
        throw new Error(`o arranjo não alcançou o contrato ${codigo} para ativá-lo`);
      }

      await definirSituacaoDeLocacaoDoImovel(tx, imovelId, 'LOCADO');
    });
  });
}

/** Cancela o contrato **pela porta** que a T5 publicou. A rota de cancelamento só nasce na T8. */
async function cancelarPelaPorta(empresaId: string, codigo: string): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const cancelado = await cancelarContrato(tx, codigo);

      if (cancelado === undefined) {
        throw new Error(`o arranjo não alcançou o contrato ${codigo} para cancelá-lo`);
      }
    });
  });
}

/**
 * Quantas linhas de `negocio.contrato` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte de circulação: o que os casos medem é se alguma linha nasceu, e
 * uma contagem que aplicasse o predicado esconderia justamente a linha gravada por engano e marcada
 * como retirada. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e
 * a empresa entra pelo **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarContratos(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.contrato
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Concede as chaves informadas a uma pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado na
 * mesma transação — é o mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/cadastro-de-imoveis.e2e.spec.ts`.
 */
async function conceder(
  usuarioId: string,
  empresaId: string,
  chaves: readonly ChaveDoCatalogo[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/**
 * Um contrato como a API o publica.
 *
 * Declarado aqui, e não importado de `@sysloc/contracts`: o conjunto de chaves é o que os casos
 * asserem por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma. **Não
 * há `id`**, e a ausência é a ADR-0017 — a chave exposta é o `codigo`.
 */
interface ContratoPublicado {
  readonly codigo: string;
  readonly status: string;
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadores: readonly { readonly id: string; readonly nome: string }[];
  readonly dataInicioLocacao: string;
  readonly prazoMeses: number;
  readonly valorMensal: number;
  readonly diaVencimento: number;
  readonly dataFimLocacao: string | null;
  readonly valorTotalContrato: number | null;
  readonly gerarCobrancasAutomaticamente: boolean;
  readonly pdfContratoArquivo: string | null;
  readonly retiradoEm: string | null;
}

/**
 * A resposta da ativação: o contrato no root **mais** a declaração de efeito.
 *
 * Declarada aqui, e não importada de `@sysloc/contracts`, pela razão de {@link ContratoPublicado}: o
 * conjunto de chaves é o que os casos asserem por igualdade, e derivá-lo do tipo do SUT faria a
 * asserção concordar consigo mesma.
 */
interface AtivacaoPublicada extends ContratoPublicado {
  readonly efeitos: { readonly cobrancasGeradas: boolean };
}

/** A página de contratos, no envelope que a ADR-0017 fixa. */
/**
 * Um imóvel como a API o publica — o corpo que o `CT-434` compara por igualdade.
 *
 * Declarado aqui, e não importado de `@sysloc/contracts`, pela razão de {@link ContratoPublicado}: o
 * conjunto de chaves é o que o caso afirma, e derivá-lo do tipo do SUT faria a asserção concordar
 * consigo mesma. Os campos derivados entram como `unknown` porque o que este arquivo faz com eles é
 * **carregá-los intactos** de uma comparação a outra — quem os afirma campo a campo é
 * `cadastro-de-imoveis.e2e.spec.ts`.
 *
 * `contratoVigente` é a metade nova, e é ele que faz a divergência ser observável **no mesmo corpo**.
 */
interface ImovelPublicado {
  readonly id: string;
  readonly conjuntoId: string;
  readonly nomeImovel: string;
  readonly identificadorMunicipal: string;
  readonly tipoImovel: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  readonly statusLocacao: string;
  readonly observacoes: string | null;
  readonly comodos: readonly unknown[];
  readonly metragemTotal: number;
  readonly contratoVigente: {
    readonly codigo: string;
    readonly locatario: { readonly id: string; readonly nome: string };
  } | null;
  readonly retiradoEm: string | null;
}

interface PaginaPublicada {
  readonly itens: readonly ContratoPublicado[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** A sessão do produto, no que este arquivo observa dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}
