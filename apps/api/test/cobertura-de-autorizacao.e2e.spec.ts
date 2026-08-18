/**
 * Cobertura de autorização sobre a superfície publicada. T5 da fatia
 * `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-23 | CT-212 | Uma rota publicada **sem declaração de exigência** é recusada com `403
 * |       |        | ACESSO_NEGADO` **mesmo para a sessão de maior alcance do sistema** — o Sysloc
 * |       |        | Master com o segundo fator já cumprido — e a recusa é a MESMA, corpo por
 * |       |        | corpo, para o Admin que alcança as 17 chaves. A gêmea que difere **apenas**
 * |       |        | pela marca explícita `@NaoExigePermissao()` responde `200` ao mesmo cookie: a
 * |       |        | passagem exige declaração deliberada, e a ausência dela nunca a produz.
 * |       |        | (ADR-0011) |
 * | CA-23 | CT-213 | Sobre a aplicação de PRODUÇÃO montada, o conjunto de rotas governadas pela
 * |       |        | guarda que não declaram exigência nem marca é **vazio**, e o conjunto das
 * |       |        | rotas **públicas** é **exatamente** o inventário revisado — igualdade nos dois
 * |       |        | sentidos, com excedentes e ausentes nomeados. A contagem de rotas enumeradas
 * |       |        | é afirmada em valor EXATO. (ADR-0011, §5.1) |
 * | CA-23 | CT-213 | **PROVA DE FALSIFICAÇÃO, permanente na suíte**: a MESMA conferência, aplicada
 * |       | (b)    | a uma aplicação que carrega as rotas de verificação, REPROVA nos dois eixos —
 * |       |        | nomeia `GET /v1/verificacao-sem-declaracao` no conjunto sem declaração, e
 * |       |        | acusa `GET /v1/verificacao-publica-indevida` como excedente do conjunto
 * |       |        | público. (ADR-0011) |
 * | CA-23 | CT-213 | A unidade classificada é o **manipulador**, e não o caminho: um recurso REST
 * |       | (c)    | comum — `@Get()` de lista e `@Post()` de criação no MESMO `@Controller` — é
 * |       |        | classificado par a par, cada manipulador pela própria declaração, em vez de
 * |       |        | abortar a verificação. E a disputa que continua sendo disputa — o MESMO verbo
 * |       |        | no mesmo caminho, por dois manipuladores — segue **levantando**, nomeando os
 * |       |        | dois. (ADR-0011) |
 *
 * | CA-23 | CT-355 | Sobre a aplicação de PRODUÇÃO montada, **nenhum manipulador declara menos do
 * |       |        | que a classe dele exige**: onde as duas declarações existem, o conjunto de
 * |       |        | átomos do MÉTODO contém o da CLASSE. A MESMA função, aplicada ao defeito
 * |       |        | literal (área na classe, ação no método), o **acusa nomeando o
 * |       |        | manipulador** — e não acusa a gêmea que declara a conjunção. |
 *
 * | CA-12 | CT-318 | As **33 rotas** que a fatia `cadastro-de-imoveis-e-pessoas` publica constam,
 * |       |        | uma a uma, no conjunto POSITIVO; **nenhuma** delas está entre as públicas nem
 * |       |        | fora do arcabouço; a metade do inventário ANTERIOR à fatia está intacta por
 * |       |        | igualdade de array; e a superfície cresceu de exatamente 33 — o delta é
 * |       |        | afirmado **além** do total, e medido sobre a superfície observada. (ADR-0011) |
 *
 * | CA-16 | CT-427 | As **quatro rotas governadas de contrato** — ativação, cancelamento, retirada e
 * | CA-17 |        | recirculação — declaram no MÉTODO a **conjunção inteira**, com `TELA:contratos`
 * |       |        | **seguido** da ação própria, **nesta ordem** (a recusa nomeia a PRIMEIRA
 * |       |        | ausente); a rota de **situação de locação** não declara nada no método e exige
 * |       |        | **exatamente** `TELA:imoveis`, que é a da classe; `semDeclaracao` é vazio; e a
 * |       |        | superfície publicada bate com as âncoras VIGENTES — **80** pares e **65**
 * |       |        | manipuladores, cada uma medida por varredura própria. (ADR-0011, ADR-0018,
 * |       |        | ADR-0019) |
 *
 * | CA-17 | CT-533 | As **sete rotas da fatia `cobranca-e-mora`** — cinco de `/v1/cobrancas` e duas
 * |       |        | de `/v1/multa-e-juros` — exigem, pela declaração da CLASSE, **exatamente**
 * |       |        | `TELA:financeiro` e `TELA:multa_e_juros`, afirmado por igualdade de OBJETO sobre
 * |       |        | o retrato das sete; **nenhuma** exige chave `ACAO:`, e a asserção NOMEIA a que
 * |       |        | encontrar; nenhuma declara nada no MÉTODO; `semDeclaracao` é vazio; a superfície
 * |       |        | publicada fecha em **82** pares e **67** manipuladores, por **duas medições
 * |       |        | independentes que têm de concordar** — a divergência reprova nomeando os dois
 * |       |        | números; e o catálogo fechado continua com as **mesmas 10 áreas**, com as duas
 * |       |        | ações de `TELA:financeiro` e **nenhuma** em `TELA:multa_e_juros`. (ADR-0011,
 * |       |        | ADR-0018, ADR-0021) |
 *
 * | CA-13 | CT-635 | As **quatro rotas da fatia `regua-de-cobranca`** — as duas da política e as duas
 * | CA-14 |        | de aviso — exibem o retrato devido por igualdade de OBJETO: `TELA:automacao_de_
 * |       |        | cobranca` pela declaração da **CLASSE** em três delas, e a **CONJUNÇÃO INTEIRA**
 * |       |        | `[TELA:automacao_de_cobranca, ACAO:enviar_cobranca_manual]`, nesta ORDEM, pela
 * |       |        | declaração do **MÉTODO** no disparo manual; nenhum dos quatro exige MENOS do que
 * |       |        | a classe dele, e a asserção NOMEIA o que encontrar; `semDeclaracao` é vazio; a
 * |       |        | superfície publicada fecha em **86** pares e **71** manipuladores, por **duas
 * |       |        | medições independentes cuja igualdade é afirmada explicitamente**; e o catálogo
 * |       |        | fechado continua com as **mesmas 10 áreas**, com **uma só** ação em
 * |       |        | `TELA:automacao_de_cobranca`. (ADR-0011, ADR-0018) |
 *
 * | CA-17 | CT-732 | As **três rotas da sub-fatia `documentos-e-confirmacao`** — o documento do
 * |       |        | contrato, o reenvio da confirmação e o **ato do titular sem sessão** — são
 * |       |        | afirmadas como **exatamente três** ANTES de qualquer comparação; as duas
 * |       |        | governadas exibem o retrato devido por igualdade de OBJETO, `TELA:contratos` e
 * |       |        | `TELA:cadastros` pela declaração da **CLASSE**, sem chave de ação nova; a
 * |       |        | terceira não exige chave alguma e vive no conjunto **público**, que cresceu em
 * |       |        | **exatamente 1** — com o item nomeado, e nenhuma pública anterior saiu;
 * |       |        | `semDeclaracao` é vazio; e a superfície publicada fecha em **89** pares e
 * |       |        | **74** manipuladores, por **duas medições independentes cuja igualdade entre os
 * |       |        | eixos é afirmada explicitamente**, à parte do valor esperado. (ADR-0011,
 * |       |        | ADR-0018, ADR-0027) |
 *
 * | CA-01 | CT-836 | As **três rotas da fatia `fundacao-bancaria`** — o registro, a consulta e a
 * | CA-02 |        | verificação do certificado do provedor — são afirmadas como **exatamente três**,
 * | CA-03 |        | por extenso e com `{ metodo, caminho, controlador }`, ANTES de qualquer
 * | CA-07 |        | comparação com o total; as três exibem o retrato devido por igualdade de
 * | CA-08 |        | OBJETO — `TELA:integracoes_bancarias` pela **CLASSE** na consulta e na
 * | CA-09 |        | verificação, e a **conjunção inteira** no MÉTODO do registro, com a área antes
 * |       |        | da ação —, nenhuma é pública, o conjunto público continua com **19** entradas,
 * |       |        | `semDeclaracao` é vazio, o catálogo segue com **17** chaves e nenhuma ação nova
 * |       |        | em `TELA:integracoes_bancarias`; e a superfície publicada fecha em **92** pares
 * |       |        | e **77** manipuladores, por **duas medições independentes cuja igualdade entre
 * |       |        | os eixos é afirmada explicitamente**, à parte do valor esperado. (ADR-0011,
 * |       |        | ADR-0018, ADR-0013, ADR-0016) |
 *
 * | CA-01 | CT-837 | A sessão de `USUARIO_EMPRESA`, cuja matriz **padrão** é só `TELA:resumo`, recebe
 * |       |        | `403 ACESSO_NEGADO` nas três rotas, com o envelope canônico inteiro e
 * |       |        | `detalhes.exigido` nomeando a **PRIMEIRA** exigência ausente na ordem declarada
 * |       |        | — a ÁREA, inclusive no registro —, e a contagem crua de
 * |       |        | `negocio.certificado_do_provedor` é **idêntica** antes e depois das três
 * |       |        | chamadas. (ADR-0011, ADR-0017, ADR-0018) |
 *
 * | CA-01 | CT-838 | Sem sessão, as três rotas recusam com `401 NAO_AUTENTICADO` e o envelope
 * |       |        | canônico **sem `detalhes`**; e as três respostas são **idênticas byte a byte**,
 * |       |        | de modo que nada nelas varia com o estado da empresa — sem sessão, o produto não
 * |       |        | revela se há ou não certificado registrado. (ADR-0011, ADR-0017) |
 *
 * | CA-15 | CT-918 | Os **dois atos sobre o boleto** da fatia `emissao-e-conciliacao` — a emissão e a
 * |       | (f)    | revogação — declaram no **MÉTODO** a **conjunção inteira**, com a área antes da
 * |       |        | ação, afirmada por igualdade de OBJETO **com a origem junto** e pela ordem lida
 * |       |        | do decorador; nenhum deles exige MENOS que a classe; as outras **cinco** rotas
 * |       |        | de `/v1/cobrancas` continuam valendo pela **CLASSE**, sem chave de ação; nenhum
 * |       |        | dos dois é público nem cai em `semDeclaracao`; e `TELA:financeiro` continua com
 * |       |        | exatamente as duas ações que já existiam no catálogo fechado. É o eixo que
 * |       |        | reprova a troca de `@ExigeChaves(área, ação)` por `@ExigeChave(área)` — perda
 * |       |        | invisível para toda prova de mera existência de declaração. (ADR-0011,
 * |       |        | ADR-0018, ADR-0021) |
 *
 * | CA-20 | CT-937 | A superfície publicada da F4 (ii) **FECHA** em **99** pares e **84**
 * |       |        | manipuladores, por **duas medições independentes cuja igualdade entre os eixos é
 * |       |        | afirmada explicitamente**, à parte do valor esperado; as **sete** rotas da fatia
 * |       |        | `emissao-e-conciliacao` constam nomeadas do conjunto POSITIVO, por igualdade de
 * |       |        | arranjo ordenado, e nenhuma é pública nem cai fora do arcabouço; o conjunto
 * |       |        | público continua com **19** entradas; nenhum dos sete exige MENOS que a classe,
 * |       |        | e a garantia nomeada vem **antes** do retrato; o retrato dos sete é afirmado por
 * |       |        | igualdade de OBJETO **com a origem junto**, e exatamente **três** deles declaram
 * |       |        | no MÉTODO; `semDeclaracao` é vazio; e o catálogo fechado segue com as **mesmas
 * |       |        | 10 áreas** e as **17** chaves, sem ação nova em `TELA:financeiro`. (ADR-0011,
 * |       |        | ADR-0018, ADR-0021) |
 *
 * Rastreabilidade: `CA-23 → CT-212 (RN-14)`, `CA-23 → CT-213 (RN-14)`, `CA-23 → CT-355 (RN-14)`.
 * Acrescida pela T11 da fatia `cadastro-de-imoveis-e-pessoas`: `CA-12 → CT-318 (RN-14)`.
 * Acrescida pela T10 da fatia `contratos-de-locacao`: `CA-16 → CT-427 (RN-13)`,
 * `CA-17 → CT-427 (RN-14)`.
 * Acrescida pela T11 da fatia `cobranca-e-mora`: `CA-17 → CT-533 (RN-14)`.
 * Acrescida pela T12 da fatia `regua-de-cobranca`: `CA-13 → CT-635 (RN-12)`,
 * `CA-14 → CT-635 (RN-14)`.
 * Acrescida pela T12 da sub-fatia `documentos-e-confirmacao`: `CA-17 → CT-732 (RN-13)`.
 * Acrescida pela T14 da fatia `fundacao-bancaria`: `CA-01 → CT-836 (RN-06)`,
 * `CA-02 → CT-836 (RN-06)`, `CA-03 → CT-836 (RN-06)`, `CA-01 → CT-837 (RN-06)`,
 * `CA-01 → CT-838 (RN-06)`.
 * Acrescida pela T13 da fatia `emissao-e-conciliacao`: `CA-15 → CT-918 (f) (RN-14)`.
 * Acrescida pela T17 da mesma fatia: `CA-20 → CT-937 (RN-14)`.
 *
 * ⚠️ **O sufixo `(f)` não é estilo, e sim a única forma disponível**: a faixa `CT-911`…`CT-948`
 * está inteiramente reservada pelos cards das tasks daquela fatia, e reusar um identificador
 * produziria duas coisas diferentes com o mesmo nome — que é o que a rastreabilidade existe para
 * impedir. É a mesma escolha, e a mesma razão, de `certificado-do-provedor.e2e.spec.ts`, e a família
 * `CT-918 (b)`…`(f)` já é o guarda-chuva dos companheiros daquele caso. O fecho de superfície desta
 * fatia — as âncoras `99`/`84` por dupla medição — é do `CT-937`, na T17, e **não** deste caso.
 *
 * ===========================================================================
 * Por que o CT-836 existe ao lado do CT-732, e por que ele traz DUAS provas de borda junto
 * ===========================================================================
 *
 * O `CT-732` audita **outra** superfície — as três rotas da sub-fatia `documentos-e-confirmacao` — e
 * as âncoras que ele confere são as daquele fecho (`89`/`74`). Vale aqui, palavra por palavra, o que
 * o parágrafo abaixo diz do `CT-635`: as duas constantes já valem `92` e `77`, e é o **próprio
 * `CT-732`** que reprovaria se alguém as movesse sem publicar rota. O que **só** o `CT-836` responde:
 *
 *   * **o inventário desta fatia tem exatamente três pares, por extenso**, com
 *     `{ metodo, caminho, controlador }` — e é afirmado ANTES de qualquer comparação com o total. É
 *     o que impede o caso de *"fechar a conta"* por acaso quando duas rotas mudarem em direções
 *     opostas: a soma continuaria batendo, e só a afirmação do inventário pega a compensação;
 *   * **as três são da mesma natureza, e é isso que a fatia tem de provar**: nenhuma dispensa
 *     sessão. Onde o `CT-732` afirmou o crescimento do conjunto público em **exatamente 1**, este
 *     afirma o crescimento **zero** — pelo filtro (nenhuma das três está no público) **e** pela
 *     contagem (o público continua com 19 entradas), que são direções diferentes e nenhuma implica a
 *     outra;
 *   * **a assimetria entre os três manipuladores é conteúdo**, e ela é invisível na borda: a área da
 *     classe é exatamente `MAPA_ACAO_TELA['ACAO:configurar_integracao']`, de modo que o registro
 *     declarando **só a ação** continuaria exigindo a área por acidente. Quem o acusa por estrutura é
 *     o `CT-355`; aqui ele é acusado por **conteúdo**, com a origem da declaração junto do valor.
 *
 * E as duas provas de **borda** moram neste arquivo, e não num arquivo próprio, por uma razão de
 * método: o `CT-836` afirma o que a rota **declara**, e declaração é promessa. O `CT-837` e o
 * `CT-838` afirmam o que o cliente **recebe** — `403` com a primeira chave ausente nomeada, `401`
 * sem sessão —, e são eles que transformam a promessa em comportamento observado. Lê-los ao lado da
 * declaração é o que torna a divergência entre as duas coisas evidente na mesma passagem de olhos.
 *
 * ===========================================================================
 * Por que o CT-732 existe ao lado do CT-635, que já mede a superfície por dois caminhos
 * ===========================================================================
 *
 * O `CT-635` audita **outra** superfície — as quatro rotas da fatia `regua-de-cobranca` — e as
 * âncoras que ele confere são as daquele fecho (`86`/`71`). Ele não alcança rota que não esteja no
 * mapa dele, e as âncoras que ele cita são valores, não medições vivas: hoje as duas constantes já
 * valem `89` e `74`, e é o **próprio `CT-635`** que reprovaria se alguém as movesse sem publicar
 * rota. A pergunta que **só** o `CT-732` responde é outra, e tem três metades que nenhuma outra
 * asserção deste arquivo junta:
 *
 *   * **o inventário desta sub-fatia tem exatamente três pares**, afirmado ANTES de comparar. Sem
 *     essa sanidade, uma lista truncada faria as igualdades de baixo passarem sobre menos rotas do
 *     que a sub-fatia publica — o modo de falha silencioso desta classe de prova;
 *   * **as três não são da mesma natureza**, e é a primeira vez que isso acontece numa fatia deste
 *     produto: duas declaram exigência e a terceira **dispensa sessão** (ADR-0027). Elas vivem em
 *     conjuntos diferentes da cobertura, e a asserção que serve a uma é cega para a outra — é por
 *     isso que o crescimento do conjunto **público** é afirmado por si, em **exatamente 1**, com o
 *     item nomeado e com a prova de que nenhuma pública anterior saiu;
 *   * **a igualdade entre os dois eixos de medição é afirmada por si**, e não deduzida de as duas
 *     baterem com a âncora. Duas medições que concordassem com o valor esperado por acidente e
 *     discordassem entre si passariam por uma comparação que só olhasse o esperado — e a
 *     independência entre elas é justamente o que torna cada uma verificável pela outra. Foi a
 *     ausência desta linha que a sub-fatia irmã teve de corrigir ao fechar o `CT-635`.
 *
 * ===========================================================================
 * Por que o CT-635 existe ao lado do CT-533, que já pergunta "qual é a exigência efetiva?"
 * ===========================================================================
 *
 * O `CT-533` audita **outra** superfície — as sete rotas da fatia `cobranca-e-mora` —, e o mapa dele
 * não alcança rota que não esteja lá. Fosse só isso, engordá-lo com estas quatro seria a saída curta;
 * ela é a errada pela mesma razão que fez as metades de inventário nascerem separadas (ver
 * {@link PARES_DA_FATIA_DA_REGUA}), e por uma segunda, que é de conteúdo:
 *
 *   * a fatia anterior afirma que **nenhuma** das sete exige chave de ação, e o mapa dela é uma lista
 *     de átomos por rótulo;
 *   * esta fatia tem **uma** rota que exige a conjunção, e três que não — de modo que o que precisa
 *     ser afirmado não é só o conjunto de átomos, mas **onde a declaração vive**. Um `POST` que
 *     declarasse só a ação continuaria exigindo a área por coerência de catálogo
 *     (`MAPA_ACAO_TELA['ACAO:enviar_cobranca_manual']` **é** `TELA:automacao_de_cobranca`), e o
 *     retrato por átomos ficaria idêntico ao devido.
 *
 * Daí o {@link RetratoDaExigencia}, que carrega a origem junto do conteúdo. O `CT-355` pega o mesmo
 * defeito por estrutura, e os dois convivem de propósito: aquele varre a superfície inteira sem que
 * ninguém precise lembrar de nada, e este nomeia, rota a rota, **o que cada uma das quatro deve
 * exigir** — que é o que impede a exigência de mudar por conveniência numa rodada futura.
 *
 * ===========================================================================
 * Por que o CT-533 existe ao lado do CT-355 e do CT-427
 * ===========================================================================
 *
 * Os três leem metadado da mesma superfície e respondem perguntas diferentes, e nenhuma das três
 * implica as outras:
 *
 *   * o **`CT-355`** pergunta *"algum manipulador declara MENOS do que a classe dele exige?"* — e é
 *     cego para as sete rotas desta fatia, porque nenhuma declara coisa alguma no método: não há
 *     substituição a detectar onde não há declaração de método;
 *   * o **`CT-427`** pergunta *"o que exatamente cada uma das QUATRO governadas de contrato declara no
 *     método, e em que ordem?"* — e o mapa dele não alcança rota que declara só pela classe;
 *   * o **`CT-533`** pergunta *"qual é a exigência EFETIVA de cada uma das sete rotas desta fatia, e
 *     alguma passou a exigir chave de ação?"*. É a única das três que reprovaria uma conjunção
 *     `@ExigeChaves(TELA:financeiro, ACAO:emitir_boleto)` acrescentada a uma transição de cobrança —
 *     forma que **contém** a da classe (o `CT-355` fica verde) e que não pertence ao mapa do `CT-427`.
 *
 * Essa terceira pergunta é a que fecha a ADR-0021 para esta fatia. A classificação dos sete atos como
 * **operacionais** foi escalada e confirmada antes da spec, e a emenda de 2026-08-10 da ADR-0021 a
 * registrou nominalmente; sem uma asserção sobre o conteúdo efetivo, uma rodada futura acrescentaria a
 * chave por conveniência — a forma intuitiva, e a que o Gate 2 da T7 já leu como violação — sem que
 * nada na suíte reprovasse.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T11 — MT11-1, MT11-2 e MT11-3 (2026-08-10), a falsificação do `CT-533`
 * ---------------------------------------------------------------------------
 *
 * O `CT-533` é asserção **estática** — ele inspeciona metadado em vez de exercitar a borda —, e a
 * `.claude/rules/testing-stack.md` exige que ela seja demonstrada **reprovando** com o defeito
 * reintroduzido. Os três mutantes abaixo foram invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso: este arquivo carrega
 * `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o `dist/` da
 * compilação anterior. **Controle**: `175 passed`.
 *
 *   * **MT11-1 · uma chave de ação acrescentada a uma das sete** — `@ExigeChaves(AREA_DO_FINANCEIRO,
 *     'ACAO:emitir_boleto')` no manipulador de pagamento de `cobrancas/cobranca.controller.ts`, que é
 *     a forma **conforme** à ADR-0018 (a do método CONTÉM a da classe) e por isso invisível para o
 *     `CT-355`: `9 failed | 166 passed`, e o `CT-533` reprova na igualdade de objeto do retrato das
 *     sete. O `CT-534` reprova junto, pelo **controle positivo** — *"POST /v1/cobrancas/:codigo/
 *     pagamento respondeu 403 a quem TEM a área"*, com `exigido: ACAO:emitir_boleto` no corpo —, e é
 *     a prova de que os dois casos se cobrem por eixos diferentes;
 *   * **MT11-2 · o MESMO mutante, com a expectativa "corrigida"** — MT11-1 mais
 *     `EXIGENCIA_DEVIDA_POR_MANIPULADOR` atualizada para incluir a chave nova, que é literalmente o
 *     que uma rodada futura faria para ficar verde sem escalar: a igualdade de objeto passa, e a
 *     asserção de ausência de `ACAO:` reprova **nomeando** o culpado —
 *     `+ ["CobrancaController.acusarPagamento exige ACAO:emitir_boleto"]`. É por isso que as duas
 *     asserções convivem: a segunda não é redundância, é a rede sob a primeira;
 *   * **MT11-3 · a exigência retirada da classe e declarada em UM só manipulador** —
 *     `@ExigeChave(AREA_DE_MULTA_E_JUROS)` sai de `MoraController` e vai para o `@Get()`, deixando o
 *     `@Put()` sem declaração alguma: `14 failed | 161 passed`, e o `CT-533` reprova em
 *     `semDeclaracao`, nomeando `{ metodo: 'PUT', caminho: '/v1/multa-e-juros', controlador:
 *     'MoraController', manipulador: 'definir' }`. O `CT-534` reprova no **arranjo** (*"a definição da
 *     política respondeu 403"*), porque a rota passou a recusar quem alcança a área;
 *   * **reversão** — os dois fontes foram restaurados do backup e conferidos por `diff -q` e
 *     `sha256sum` idênticos aos originais, e o controle voltou a `175 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T9 — MT9-1 e MT9-2 (2026-08-12), a falsificação das DUAS âncoras novas
 * ---------------------------------------------------------------------------
 *
 * As âncoras `84` e `69` são asserções **estáticas** — elas inspecionam a tabela do roteador e o
 * metadado dos decoradores em vez de exercitar a borda —, e a `.claude/rules/testing-stack.md` exige
 * que sejam demonstradas **reprovando** com o defeito reintroduzido. Os dois mutantes abaixo foram
 * invocados pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso: este arquivo carrega `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um
 * `vitest run` leria o `dist/` da compilação anterior. **Controle**: `178 passed`.
 *
 *   * **MT9-1 · a rota `GET` da política sai da superfície** — o `@Get()` de
 *     `automacao/automacao.controller.ts` removido (e o `Get` retirado do import, senão o mutante
 *     **para no `tsc`** e a suíte nunca roda — a primeira tentativa parou exatamente assim, com o
 *     import órfão): `8 failed | 170 passed`. As **duas** âncoras reprovam por eixos independentes —
 *     *"a superfície publicada mudou de tamanho: expected 83 to be 84"* pela enumeração do roteador,
 *     e *"o número de manipuladores da superfície publicada mudou: expected 68 to be 69"* pela
 *     varredura dos decoradores —, mais `ROTAS_PUBLICADAS_NO_MUTANTE` (*"expected 77 to be 78"*). É
 *     a prova de que as duas medições não são a mesma escrita duas vezes: elas caem juntas, cada uma
 *     com o próprio número, que é o que a dupla medição do `CT-533` exige e o que a T12 confere;
 *   * **MT9-2 · a exigência sai da CLASSE e vai para UM só manipulador** —
 *     `@ExigeChave(AREA_DA_AUTOMACAO_DE_COBRANCA)` retirado da classe e declarado no `@Get()`,
 *     deixando o `@Put()` sem declaração alguma: `7 failed | 171 passed`, e o `CT-213`, o `CT-318`, o
 *     `CT-427` e o `CT-533` reprovam em `semDeclaracao`, **nomeando** `{ metodo: 'PUT', … }`. É a
 *     falsificação do critério *"a exigência é declarada na classe, sem declaração no método"*: as
 *     âncoras de contagem **sobrevivem** a ele (nenhuma rota sumiu), e é por isso que os dois eixos
 *     precisam conviver;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `diff -q` e `sha256sum`
 *     idênticos ao original, e o controle voltou a `178 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T12 — MT12-1, MT12-2 e MT12-3 (2026-08-12), a falsificação do `CT-635`
 * ---------------------------------------------------------------------------
 *
 * O `CT-635` é asserção **estática** — ele inspeciona metadado e a tabela do roteador em vez de
 * exercitar a borda —, e a `.claude/rules/testing-stack.md` exige que seja demonstrada **reprovando**
 * com o defeito reintroduzido. Os três foram aplicados a `automacao/automacao.controller.ts` e
 * invocados pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso: este arquivo carrega `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um
 * `vitest run` leria o `dist/` da compilação anterior. **Controle**: `203 passed`.
 *
 *   * **MT12-1 · o disparo declarando SÓ a ação** — `@ExigeChaves(AREA, ACAO)` trocado por
 *     `@ExigeChave(ACAO_DE_ENVIO_MANUAL)` no manipulador `dispararAviso` (e `ExigeChaves` retirado do
 *     import, senão o mutante **para no `tsc`** por `noUnusedLocals` e a suíte nunca roda — a primeira
 *     tentativa parou exatamente assim): `3 failed | 200 passed`. O `CT-635` reprova na igualdade do
 *     retrato, **nomeando o manipulador** pela chave do objeto — `"AutomacaoDeCobrancaController.
 *     dispararAviso": { "metodo": [− "TELA:automacao_de_cobranca", "ACAO:enviar_cobranca_manual"] }`
 *     —, e o `CT-355` o acusa por estrutura, com o rótulo por extenso (*"declaração de método que
 *     SUBSTITUI a da classe: AutomacaoDeCobrancaController.dispararAviso"*). O `CT-633`, na borda,
 *     reprova junto: a recusa a quem não tem a área passou a publicar `exigido:
 *     'ACAO:enviar_cobranca_manual'` em vez da área — a prova de que a ordem da conjunção é conteúdo.
 *     As âncoras de contagem **sobrevivem** a ele: nenhuma rota sumiu;
 *   * **MT12-2 · a exigência sai da CLASSE e vai para UM só manipulador** —
 *     `@ExigeChave(AREA_DA_AUTOMACAO_DE_COBRANCA)` retirado da classe e declarado no `@Get()` da
 *     política: `16 failed | 187 passed`, e o `CT-635` reprova em `semDeclaracao`, **nomeando os
 *     dois** que ficaram descobertos — `{ metodo: 'PUT', caminho: '/v1/automacao-de-cobranca',
 *     controlador: 'AutomacaoDeCobrancaController', manipulador: 'definirPolitica' }` e o `GET` do
 *     histórico. O `CT-213`, o `CT-318`, o `CT-427` e o `CT-533` reprovam pelo mesmo eixo, e o
 *     `CT-633` e o `CT-634` reprovam na borda, porque as duas rotas passaram a atender sem decisão;
 *   * **MT12-3 · uma rota acrescentada FORA da contagem** — um `@Get('verificacao-do-mutante')` a
 *     mais no controlador: `8 failed | 195 passed`, e o `CT-635` reprova nas **DUAS** medições, cada
 *     uma com o próprio número — `peloRoteador: 87`, `pelaComposicao: 87` e `manipuladores: 72`
 *     contra `86`, `86` e `71`. ⚠️ A asserção de **igualdade entre as duas medições** continuou
 *     verde (as duas mediram `87`), e isso é o desfecho certo: elas concordam porque medem a mesma
 *     superfície por caminhos independentes, e o que está errado é a **âncora**. É a prova de que os
 *     dois eixos — a concordância entre as medições e o valor esperado — não são a mesma asserção
 *     escrita duas vezes;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `diff -q` e `sha256sum`
 *     idênticos ao original (`ab329c1e…`), e o controle voltou a `203 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T12 DA SUB-FATIA `documentos-e-confirmacao` (2026-08-13) — a falsificação do `CT-732`
 * ---------------------------------------------------------------------------
 *
 * O `CT-732` é asserção **estática** — ele inspeciona metadado e a tabela do roteador em vez de
 * exercitar a borda —, e a `.claude/rules/testing-stack.md` exige que seja demonstrada **reprovando**
 * com o defeito reintroduzido. Os três foram invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso: este arquivo carrega
 * `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o `dist/` da
 * compilação anterior. **Controle**: `227 passed`.
 *
 *   * **MT-1 · a rota sem sessão publicada SEM declaração alguma** — `@RotaPublica()` retirado do
 *     manipulador `confirmar` de `confirmacoes/confirmacao.controller.ts` (e `RotaPublica` retirado
 *     do import, senão o mutante **para no `tsc`** por `noUnusedLocals` e a suíte nunca roda):
 *     `13 failed | 214 passed`. O `CT-732` reprova em `semDeclaracao`, **nomeando a rota ofensora
 *     por extenso** — `{ metodo: 'POST', caminho: '/v1/confirmacoes-de-email', controlador:
 *     'ConfirmacaoController', manipulador: 'confirmar' }` —, e **nunca** por um comprimento
 *     genérico, que é a forma que a §3.1 da task proíbe. O `CT-213`, o `CT-213 (b)`, o `CT-318`, o
 *     `CT-427`, o `CT-533` e o `CT-635` reprovam pelo mesmo eixo, e os **seis** casos de
 *     `confirmacao-de-email.e2e.spec.ts` reprovam na borda, porque a rota passou a exigir sessão e
 *     recusa o titular com `403 ACESSO_NEGADO` — é a prova comportamental de que a marca é a
 *     autorização inteira daquela rota (ADR-0027);
 *   * **MT-2 · uma rota GOVERNADA da sub-fatia marcada `@RotaPublica()`** — a marca acrescentada ao
 *     `@Get(':codigo/documento')` de `contratos/contrato.controller.ts`: `7 failed | 220 passed`, e
 *     o `CT-732` reprova nomeando `GET /v1/contratos/:codigo/documento` como par que **sumiu do
 *     conjunto positivo**. ⚠️ `semDeclaracao` continua **vazio** neste mutante — a marca É uma
 *     declaração —, e é exatamente por isso que a igualdade do conjunto positivo não é redundante
 *     com o predicado da ADR-0011: sem ela, bastaria marcar uma rota de negócio como pública para
 *     ela sair da autorização sem que nada reprovasse. O `CT-020 (d)` reprova junto, por
 *     comportamento (a rota passou a atender sem cookie), e os dois casos de
 *     `documento-do-contrato.e2e.spec.ts` caem com ele;
 *   * **MT-3 · uma rota de OUTRA fatia marcada `@RotaPublica()`** — a marca acrescentada ao `@Get()`
 *     de `mora/mora.controller.ts`, escolhida de propósito **fora** do inventário desta sub-fatia
 *     para exercitar o eixo que os dois anteriores não alcançam: `11 failed | 216 passed`, e o
 *     `CT-732` reprova na asserção do **crescimento do conjunto público**, com a mensagem por
 *     extenso — *"o conjunto de rotas que dispensam sessão mudou"* — e nomeando o intruso:
 *     `+ "GET /v1/multa-e-juros"` ao lado de `"POST /v1/confirmacoes-de-email"`. É a falsificação do
 *     *"cresceu em exatamente 1, e o item é o ato do titular"* que a ADR-0027 torna auditável;
 *   * **reversão** — os três fontes foram restaurados do backup e conferidos por `diff -q` e
 *     `sha256sum` idênticos aos originais (`bbea7ff2…`, `22e8bfa7…` e `75c20dfe…`), e o controle
 *     voltou a `227 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T14 — MT14-1, MT14-2 e MT14-3 (2026-08-15), a falsificação do `CT-836`
 * ---------------------------------------------------------------------------
 *
 * O `CT-836` é asserção **estática** — ele inspeciona metadado e a tabela do roteador em vez de
 * exercitar a borda —, e a `.claude/rules/testing-stack.md` exige que seja demonstrada **reprovando**
 * com o defeito reintroduzido. Os três foram aplicados a
 * `integracoes-bancarias/certificado-do-provedor.controller.ts` e invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso: este arquivo carrega
 * `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o `dist/` da
 * compilação anterior. **Controle**: `280 passed`.
 *
 *   * **MT14-1 · o registro declarando SÓ a ação** — `@ExigeChaves(AREA, ACAO)` trocado por
 *     `@ExigeChave(ACAO_DE_CONFIGURACAO)` no manipulador `registrar` (e `ExigeChaves` retirado do
 *     import, senão o mutante **para no `tsc`** por `noUnusedLocals` e a suíte nunca roda):
 *     `3 failed | 277 passed`. O `CT-836` reprova **na garantia nomeada** — *"manipulador da fatia
 *     que exige MENOS que a classe: `CertificadoDoProvedorController.registrar`"* —, o `CT-355` o
 *     acusa pelo mesmo defeito **por estrutura**, e o `CT-837` reprova na **borda**, com
 *     `detalhes.exigido` virando `ACAO:configurar_integracao` em vez da área. É a prova de que a
 *     ordem da conjunção é conteúdo: o mutante é invisível para quem só olha o conjunto de átomos,
 *     porque a área da classe É `MAPA_ACAO_TELA['ACAO:configurar_integracao']`;
 *   * **MT14-2 · a `@ExigeChave` saindo da CLASSE** — a declaração retirada de
 *     `CertificadoDoProvedorController`: `20 failed | 260 passed`, e o `CT-836` reprova em
 *     `semDeclaracao` **nomeando `{ metodo, caminho, controlador }`** das duas ofensoras. O `CT-838`
 *     reprova na **identidade byte a byte**: a rota sem declaração passa a responder `403` sem
 *     sessão enquanto a que declara responde `401`, e as três deixam de coincidir — que é
 *     exatamente o que aquele caso existe para pegar;
 *   * **MT14-3 · uma rota acrescentada FORA da contagem** — um manipulador a mais no controlador:
 *     `10 failed | 270 passed`, e o `CT-836` reprova na **dupla medição**, nomeando os números lado
 *     a lado — `peloRoteador: 93, pelaComposicao: 93, manipuladores: 78` contra `92`, `92` e `77`.
 *     ⚠️ Como no MT12-3, a asserção de **igualdade entre as duas medições** continua verde (as duas
 *     mediram `93`), e esse é o desfecho certo: elas concordam porque medem a mesma superfície por
 *     caminhos independentes, e o que está errado é a **âncora**;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `diff -q` e `sha256sum`
 *     idênticos ao original, e o controle voltou a `280 passed`.
 *
 * **A divergência DELIBERADA do molde, e por que ela está aqui e não só num comentário inline**: no
 * `CT-836` a asserção da garantia nomeada (*"nenhum manipulador exige MENOS que a classe"*) vem
 * **antes** da igualdade de objeto do retrato, enquanto o `CT-533`, o `CT-635` e o `CT-732` a põem
 * depois. A razão é o **MT14-1**: com o retrato primeiro, a igualdade **aborta o caso** e a garantia
 * nomeada nunca executa — que é o AP-29 pelo qual duas tasks desta fatia foram reprovadas. Invertida,
 * o que sai primeiro é a mensagem com o **nome do ofensor**. Nenhuma asserção foi removida ou
 * afrouxada, e os casos anteriores não foram tocados na T14 — a fragilidade latente nos três irmãos
 * foi registrada como débito ali, e **fechada pela T17**: ver a seção logo abaixo.
 *
 * ---------------------------------------------------------------------------
 * MT14-4 (2026-08-16) — a falsificação das âncoras de arranjo do `CT-837` e do `CT-838`
 * ---------------------------------------------------------------------------
 *
 * A linha de fecho daqueles dois casos compara o percorrido com o **próprio** arranjo
 * (`CHAMADAS_DA_FATIA_BANCARIA`), e portanto não pode acusar um arranjo **truncado** — o comentário
 * que antes reivindicava essa propriedade dizia mais do que a linha entrega, e o Gate 2 o mediu. A
 * correção acrescentou, no topo de cada caso, duas âncoras contra fontes **independentes** do
 * arranjo: a cardinalidade contra `PARES_PUBLICADOS_PELA_FATIA_BANCARIA` e a identidade contra
 * `PARES_DA_FATIA_BANCARIA`. O mutante que a demonstra, pelo **script do pacote**:
 *
 *   * **com as âncoras** (estado atual), arranjo truncado de três para duas chamadas (a entrada da
 *     verificação removida): `2 failed | 278 passed`, e os **dois** casos reprovam na cardinalidade,
 *     com `expected 2 to be 3` — em `55 ms` e `4 ms`, isto é, **antes de exercitar rota alguma**;
 *   * **sem as âncoras** (o estado da rodada 1), o MESMO truncamento: `1 failed | 279 passed`, e o
 *     **`CT-837` fica VERDE** — ele percorre duas rotas onde a fatia publica três e nada acusa. É a
 *     medição do achado. O `CT-838` reprova assim mesmo, mas **por acidente estrutural**, não por
 *     garantia: a desestruturação `[doRegistro, daConsulta, daVerificacao]` deixa o terceiro
 *     `undefined` e a comparação byte a byte cai — com a mensagem de *"a recusa sem sessão varia
 *     entre as três rotas"*, que **nomeia o defeito errado**;
 *   * **reversão** — o arquivo foi restaurado do backup e conferido por `diff -q` e `sha256sum`
 *     idênticos ao original (`0d45152a…`), e o controle voltou a `280 passed`.
 *
 * ---------------------------------------------------------------------------
 * O DÉBITO D61 DA T14 FOI FECHADO PELA T17 — a ordem canônica vale nos QUATRO casos de fecho
 * ---------------------------------------------------------------------------
 *
 * O débito `D61` da T14 agendava a subida da **garantia nomeada** para antes da **igualdade do retrato** no
 * `CT-533`, no `CT-635` e no `CT-732`, e nomeava como dono *"o PRÓXIMO caso de fecho de superfície
 * acrescentado a este arquivo"*. Esse caso é o `CT-937`, da T17, e por isso a mudança acontece aqui:
 *
 *   * `CT-533` — `chavesDeAcaoExigidasEm(efetivas)` passou a preceder
 *     `expect(efetivas).toEqual(EXIGENCIA_DEVIDA_POR_MANIPULADOR)`;
 *   * `CT-635` e `CT-732` — o bloco de `declaracoesQueSubstituemAClasse` passou a preceder a
 *     igualdade de `retratoDasExigenciasDe`;
 *   * `CT-836`, `CT-918 (f)` e `CT-937` já nasceram na ordem canônica.
 *
 * **Nenhuma asserção foi removida, movida para outro caso, ou afrouxada** — as duas continuam
 * presentes nos três, com o mesmo esperado e a mesma mensagem. O que muda é qual delas reprova
 * primeiro, e com isso qual defeito a falha **nomeia**: com a igualdade na frente ela aborta o caso,
 * e a garantia nunca executa no estado que ela existe para pegar (o AP-29 que o `MT14-1` mediu). O
 * marcador saiu deste arquivo e a linha correspondente saiu do índice do `CLAUDE.md`, no mesmo diff,
 * como a §3-B da `.claude/rules/nao-regressao.md` manda.
 *
 * ===========================================================================
 * Por que o CT-318 existe ao lado do CT-213, que já afirma o mesmo conjunto
 * ===========================================================================
 *
 * O `CT-213` afirma `comExigencia` por igualdade contra um inventário ÚNICO e a contagem por um
 * TOTAL único. Isso pega crescimento e encolhimento, e deixa aberta uma terceira forma: a **troca**.
 * Um par da F1 que sumisse enquanto um par da fatia entrasse no lugar dele manteria o total em `66`
 * — e a igualdade do `CT-213` reprovaria, sim, mas apontando para o inventário inteiro, sem dizer de
 * que lado da fronteira o erro está.
 *
 * O `CT-318` parte o inventário em duas metades nomeadas — {@link EXIGENCIA_ANTERIOR_A_FATIA} e
 * {@link PARES_NOVOS_DA_FATIA} — e afirma cada uma por si, mais o **delta** medido sobre a superfície
 * observada (`rotasEnumeradas` menos os 33 novos, contra a âncora de antes). É o que a §6.6 da T11
 * pede por extenso: *"afirmar o delta (33) além do total é o que impede um erro de contagem de passar
 * despercebido numa atualização apressada do inventário"*.
 *
 * **A partir da T6 da fatia `contratos-de-locacao` a partição tem TRÊS metades**, e não duas:
 * {@link EXIGENCIA_ANTERIOR_A_FATIA}, {@link PARES_NOVOS_DA_FATIA} e
 * {@link PARES_DA_FATIA_DE_CONTRATOS}. Engordar a segunda com as rotas de contrato teria sido a saída
 * mais curta e a errada — o `CT-318` afirma o tamanho dela em `33` por escrito, e o delta dele
 * passaria a somar duas fatias diferentes num número só. Com a terceira metade nomeada, cada fatia
 * responde pelo próprio crescimento e a metade antiga continua sendo afirmada por igualdade de array.
 *
 * ===========================================================================
 * O CT-355 audita o CONTEÚDO da declaração — o eixo que faltava (ADR-0018)
 * ===========================================================================
 *
 * O `CT-213` audita a **existência** da declaração: nenhuma rota governada sem nada declarado. Isso
 * deixa em aberto um defeito inteiro, e ele custou o primeiro `REJEITADO` da T5 do domínio de
 * locação: `getAllAndOverride` **substitui**, de modo que declarar `@ExigeChave` num método de uma
 * classe que já declara **apaga** a exigência da classe naquela rota. A rota segue declarando
 * *alguma coisa*, o `CT-213` segue verde, e a área desaparece.
 *
 * Foi assim que `POST /v1/conjuntos/:id/retirada` passou a exigir apenas `ACAO:excluir_cadastro`.
 * A coerência do catálogo **não** cobre a lacuna — `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é
 * `TELA:cadastros`, não `TELA:imoveis` —, e quem administra locador, locatário e fiador recebia
 * `403` para listar conjuntos e `200` para retirá-los.
 *
 * **Por que a asserção é estrutural, e não um caso de comportamento por rota.** A T6, a T7 e a T9
 * publicam as MESMAS duas rotas de circulação em mais quatro controladores. Um caso por entidade
 * dependeria de cada autor futuro lembrar de escrevê-lo — e foi exatamente um esquecimento desse
 * tipo que produziu o defeito. Esta asserção varre a superfície inteira: qualquer manipulador que
 * nasça declarando menos do que a classe dele exige reprova aqui sem que ninguém precise se lembrar
 * de nada. É a topologia, e não a ocorrência — e é a segunda metade do predicado de cobertura que a
 * **ADR-0018** fixa: *"nenhum manipulador exige menos do que a classe dele exige"*, ao lado do
 * *"nenhuma rota sem declaração"* que a ADR-0011 já pedia.
 *
 * A falsificação é **permanente na suíte**, no mesmo molde do `CT-213 (b)`: `ControladorQueSubstitui`
 * carrega o defeito literal e `ControladorQueCompoe` difere dele **apenas** por declarar a
 * conjunção. A mesma função roda nas duas montagens, e o resultado esperado é oposto.
 *
 * ===========================================================================
 * A prova de falsificação é o PAR de aplicações — e ela é permanente
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` exige, para asserção que inspeciona a **estrutura** do sistema
 * em vez de exercitá-lo, que se demonstre a asserção **reprovando** com o defeito reintroduzido, e
 * um controle limpo passando no mesmo harness. Aqui os dois lados são casos da suíte, e não uma
 * medição feita uma vez e narrada num comentário:
 *
 *   * **controle** — `criarAplicacao()`, a montagem que atende em operação. Nenhuma rota de
 *     verificação nela;
 *   * **mutante** — a mesma composição raiz mais três rotas de verificação, entre elas uma
 *     publicada **sem declaração alguma** e uma rota de negócio marcada `@RotaPublica()`
 *     indevidamente.
 *
 * A **mesma função** — {@link conferir}, e não duas asserções parecidas — roda sobre as duas, e o
 * resultado esperado é oposto: `{ [], [], [] }` no controle, e os dois conjuntos POVOADOS no
 * mutante, com os valores exatos. Um verificador que classificasse tudo como declarado passaria o
 * controle e reprovaria o mutante; um que classificasse tudo como indeclarado faria o contrário.
 * Nenhum dos dois passa nos dois.
 *
 * As rotas de verificação vivem **neste arquivo** e são registradas apenas na aplicação mutante.
 * Publicar uma rota sem declaração em `apps/api/src` seria criar em produção exatamente a superfície
 * que a ADR-0011 existe para impedir.
 *
 * O `CT-213 (c)` acrescenta duas montagens **mínimas** — sem banco, sem fila, sem sessão —, porque o
 * que elas provam é a GRANULARIDADE da classificação, e não a superfície de produção: um recurso REST
 * comum e uma disputa de verbo. Elas não repetem o par acima; medem outra propriedade.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES EXECUTADOS sobre o verificador (2026-08-04) — os seis reprovaram
 * ---------------------------------------------------------------------------
 *
 * O par de aplicações acima prova que a conferência discrimina **superfícies**. Falta a outra
 * metade, que a `.claude/rules/testing-stack.md` exige e que o par sozinho não dá: que ela
 * discrimina **defeitos do próprio verificador**. Os seis mutantes abaixo foram aplicados ao fonte
 * de `src/autenticacao/cobertura-de-autorizacao.ts` e a suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o `dist/` da
 * compilação anterior.
 *
 *   * **controle** — árvore íntegra: `63 passed`;
 *   * **M1 · enumerador devolve vazio** (`rotasDaTabelaDoRoteador` → `[]`): `3 failed | 60 passed`.
 *     A junção levantou nomeando três manipuladores — entre eles `ControladorSemDeclaracao.
 *     responder` — com *"0 candidatos"*. É o modo de falha barulhento no lugar do conjunto vazio
 *     que aprovaria tudo;
 *   * **M2 · enumerador perde UMA rota** (descarta `/docs/LICENSE`): `1 failed | 62 passed`, na
 *     âncora de contagem, com a mensagem *"a superfície publicada mudou de tamanho"* — `18` contra
 *     `19`. É o caso intermediário que um `> 0` deixaria passar;
 *   * **M3 · rota sem declaração classificada como declarada**: `2 failed | 61 passed`, no caso de
 *     falsificação e no `CT-213 (c)`, os dois esperando a rota NOMEADA em `semDeclaracao` e
 *     recebendo conjunto vazio;
 *   * **M4 · marca de rota pública deixa de contar** (o ramo de `publica` neutralizado):
 *     `2 failed | 61 passed`, nos dois casos — a asserção (b) do controle e a do mutante;
 *   * **M5 · leitor ignora o metadado de CLASSE** (`getAllAndOverride(…, [alvo])` sem a classe):
 *     `2 failed | 61 passed`. É o que amarra a leitura à precedência da produção: `@RotaPublica()`
 *     mora na classe em `SaudeController` e em `AutenticacaoController`, e um leitor que só olhasse
 *     o método declararia as três rotas públicas como indeclaradas;
 *   * **M6 · a chave volta a ser o CAMINHO** (`chaveDaRota` devolvendo só o caminho, que é a forma
 *     anterior desta verificação): `3 failed | 60 passed`, e as mensagens são exatamente o defeito
 *     que o `CT-213 (c)` existe para fechar — *"/v1/verificacao-recurso é reivindicado por dois
 *     manipuladores — ControladorDeRecurso.listar e ControladorDeRecurso.criar"* e, na aplicação de
 *     produção, *"/v1/auth/* é reivindicado por dois manipuladores"*, porque o encaminhador passa a
 *     disputar consigo mesmo os sete verbos que atende. É a prova de que a granularidade do par não
 *     é verbosidade: sem ela a verificação ABORTA;
 *   * **reversão** — o fonte foi restaurado e o controle reexecutado: de novo `63 passed`.
 *
 * ---------------------------------------------------------------------------
 * Por que a contagem é EXATA, e não "maior que zero"
 * ---------------------------------------------------------------------------
 *
 * "O conjunto sem declaração é vazio" é verdade vazia sobre um enumerador quebrado. `> 0` fecha o
 * caso degenerado (nada enumerado) e deixa aberto o intermediário — o enumerador que perde metade da
 * árvore continuaria passando, com a metade perdida invisível. A contagem exata fecha os dois: ela é
 * o inventário revisado da superfície, e cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta de cada aplicação é **reservada**
 * (trava atômica), e não dinâmica, pela razão que a T8 da fatia anterior registrou: o arcabouço
 * confere a origem das requisições com cookie contra o endereço base, composto a partir da porta
 * CONFIGURADA.
 */

import { randomBytes } from 'node:crypto';
import { Controller, Get, Post, RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { CHAVES_DE_TELA, type Exigencia, MAPA_ACAO_TELA } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
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
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import {
  type CoberturaDeAutorizacao,
  type RotaSemDeclaracao,
  verificarCoberturaDeAutorizacao,
} from '../src/autenticacao/cobertura-de-autorizacao.ts';
import {
  EXIGENCIA,
  ExigeChave,
  ExigeChaves,
  NaoExigePermissao,
} from '../src/autenticacao/exigencia.decorator.ts';
import { ROTA_PUBLICA, RotaPublica } from '../src/autenticacao/rota-publica.decorator.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DA_AUTOMACAO_DE_COBRANCA } from '../src/automacao/automacao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import {
  CAMINHO_DA_COBRANCA_BANCARIA,
  SEGMENTO_DAS_CONFERENCIAS,
  SEGMENTO_DAS_EMISSOES,
} from '../src/cobranca-bancaria/cobranca-bancaria.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DAS_CONFIRMACOES } from '../src/confirmacoes/confirmacao.controller.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_COMODOS } from '../src/imoveis/comodo.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DA_VERIFICACAO,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import { CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import { CAMINHO_DE_MULTA_E_JUROS } from '../src/mora/mora.controller.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { decodificarBase32 } from './base32.ts';

/** Limite da montagem: banco migrado, semente, fila e DUAS aplicações. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Idem para a troca de senha do produto (T9), composta a partir do dono do segmento. */
const CAMINHO_DA_TROCA_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A rota de verificação publicada **sem declaração alguma** — o sujeito do CT-212. */
const CAMINHO_SEM_DECLARACAO = 'verificacao-sem-declaracao';

/** A gêmea dela: difere APENAS pela marca explícita de "não exige permissão". */
const CAMINHO_SEM_EXIGENCIA = 'verificacao-sem-exigencia';

/** A rota de negócio marcada `@RotaPublica()` indevidamente — o mutante da asserção (b). */
const CAMINHO_PUBLICO_INDEVIDO = 'verificacao-publica-indevida';

/** O recurso REST comum do CT-213 (c): um caminho, dois manipuladores, declarações diferentes. */
const CAMINHO_DO_RECURSO = 'verificacao-recurso';

/** O caminho que dois manipuladores disputam pelo MESMO verbo — a disputa que ainda levanta. */
const CAMINHO_EM_DISPUTA = 'verificacao-em-disputa';

/**
 * A mensagem da recusa por ausência de declaração.
 *
 * Literal, e **não** importada da guarda: derivá-la da mesma fonte que o SUT usa faria a asserção
 * concordar consigo mesma, e um erro de texto passaria despercebido nos dois lados.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e este literal é que descrevia o estado
 * anterior. Ele era `'acesso negado: a rota não declara exigência de autorização'` — texto de um
 * defeito interno de publicação que, pela ordem da guarda (o metadado é lido ANTES de a sessão ser
 * resolvida), chegava também a cliente ANÔNIMO e permitia separar por varredura as rotas bem
 * declaradas das mal declaradas. É o débito D17 da §2 do run-report desta fatia. Passou a ser a
 * mensagem canônica de `ACESSO_NEGADO`, indistinguível de qualquer outra recusa de autorização; a
 * distinção migrou para o `logger.warn` do ponto da recusa, que o cliente não lê. O discriminante
 * ESTRUTURAL que este caso assere — a ausência de `detalhes` — não mudou.
 */
const MENSAGEM_SEM_DECLARACAO = 'acesso negado para esta sessão';

/** Quantas chaves o catálogo tem (RN-15) — a âncora de "o Admin não é recusado por falta de chave". */
const TOTAL_DE_CHAVES = 17;

/**
 * Os **pares método+caminho** que a publicação do contrato registra **direto no adaptador HTTP**.
 *
 * São nove caminhos, todos só de leitura: o adaptador publica `GET` em cada um (e o `HEAD` que ele
 * deriva do `GET`, que não é entrada própria — ver o cabeçalho do módulo verificado). Eles não têm
 * manipulador do arcabouço, e por isso o global guard não corre neles: atendem sem passar por
 * decisão alguma. A lista é literal e escrita à mão de propósito — é a **expectativa revisada**, e
 * derivá-la da mesma fonte que a cobertura classifica faria o caso concordar consigo mesmo. Um par
 * novo que a publicação passe a registrar reprova aqui até alguém olhar para ele.
 *
 * O mesmo conjunto de caminhos é afirmado, por outro caminho e por outro critério, no `CT-020 (d)`
 * de `test/contexto.e2e.spec.ts`: lá por COMPORTAMENTO (a rota responde sem exigir sessão), aqui por
 * ESTRUTURA (a rota não tem manipulador do arcabouço). Que os dois cheguem ao mesmo conjunto é o
 * que torna cada um verificável pelo outro.
 */
const ROTAS_FORA_DO_ARCABOUCO: readonly string[] = [
  `GET /${CAMINHO_DO_CONTRATO}`,
  `GET /${CAMINHO_DO_CONTRATO}-yaml`,
  `GET /${CAMINHO_DO_CONTRATO}/`,
  `GET /${CAMINHO_DO_CONTRATO}/*`,
  `GET /${CAMINHO_DO_CONTRATO}/LICENSE`,
  `GET /${CAMINHO_DO_CONTRATO}/docs/swagger-ui-init.js`,
  `GET /${CAMINHO_DO_CONTRATO}/index.html`,
  `GET /${CAMINHO_DO_CONTRATO}/swagger-ui-init.js`,
  `GET /${CAMINHO_DO_DOCUMENTO}`,
].sort();

/**
 * Os verbos que o encaminhador de identidade atende.
 *
 * Ele é **UM** manipulador (`@All('*')`), e por isso reivindica todos os verbos que o roteador
 * publica no caminho dele — sete pares para um manipulador só. A lista é literal, como todo
 * inventário deste arquivo, e é ela que torna explícito o que a versão por caminho escondia: que
 * `POST` naquele caminho — a entrada, a troca de senha, o segundo fator — também atende sem passar
 * pela decisão da guarda.
 */
const METODOS_DO_ENCAMINHADOR: readonly string[] = [
  'DELETE',
  'GET',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'TRACE',
];

/** Os pares do encaminhador de identidade sob um prefixo já composto. */
function paresDoEncaminhador(): readonly string[] {
  return METODOS_DO_ENCAMINHADOR.map((metodo) => `${metodo} ${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*`);
}

/**
 * Os **seis pares** que as rotas do operador do SaaS publicam (T7).
 *
 * Escritos à mão, como todo inventário deste arquivo, e compostos a partir do dono do segmento
 * (`CAMINHO_DO_MASTER`) em vez de literais soltos: derivá-los da mesma fonte que a cobertura
 * classifica faria o caso concordar consigo mesmo, e escrever `/v1/master` por extenso deixaria o
 * inventário divergir na primeira mudança de segmento.
 *
 * O `HEAD` que o adaptador deriva do `GET` de `empresas` **não** entra — ele não é entrada própria,
 * e o módulo verificado já o descarta (ver o cabeçalho dele).
 */
function paresDoMaster(): readonly string[] {
  const empresas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;
  const usuarios = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/usuarios`;

  return [
    `POST ${empresas}`,
    `GET ${empresas}`,
    `POST ${empresas}/:id/admin`,
    `POST ${empresas}/:id/suspensao`,
    `POST ${empresas}/:id/reativacao`,
    `POST ${usuarios}/:id/senha-provisoria`,
  ];
}

/**
 * Os **sete pares** que as rotas de administração de pessoas publicam (T8).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_USUARIOS`), pela mesma razão
 * do inventário acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As cinco transições de estado são **sub-recursos** de `POST`, e não campos de um `PATCH` — é por
 * isso que elas aparecem aqui como pares distintos, cada um com a própria classificação.
 */
function paresDeUsuarios(): readonly string[] {
  const usuarios = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

  return [
    `POST ${usuarios}`,
    `GET ${usuarios}`,
    `POST ${usuarios}/:id/permissoes`,
    `POST ${usuarios}/:id/perfil`,
    `POST ${usuarios}/:id/desativacao`,
    `POST ${usuarios}/:id/reativacao`,
    `POST ${usuarios}/:id/senha-provisoria`,
  ];
}

/**
 * Os **seis pares** que as rotas de conjunto publicam (T5 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_CONJUNTOS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`, e não campos de um `PATCH` — é por
 * isso que elas aparecem aqui como pares distintos, cada um com a própria classificação. E elas são
 * as únicas desta superfície que declaram no MÉTODO (`ACAO:excluir_cadastro`): as outras quatro
 * herdam a declaração da classe (`TELA:imoveis`). Nos dois casos há declaração, que é o que este
 * caso mede.
 */
function paresDeConjuntos(): readonly string[] {
  const conjuntos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`;

  return [
    `POST ${conjuntos}`,
    `GET ${conjuntos}`,
    `GET ${conjuntos}/:id`,
    `PUT ${conjuntos}/:id`,
    `POST ${conjuntos}/:id/retirada`,
    `POST ${conjuntos}/:id/recirculacao`,
  ];
}

/**
 * Os **seis pares** que as rotas de imóvel publicam (T6 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_IMOVEIS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`, e não campos de um `PATCH`. Elas
 * são as únicas desta superfície que declaram no MÉTODO — e declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:imoveis, ACAO:excluir_cadastro)`), nunca só a ação: é o `CT-355` que audita
 * esse conteúdo, e é a ADR-0018 que o fixa. As outras quatro herdam a declaração da classe. Nos dois
 * casos há declaração, que é o que **este** caso mede.
 */
function paresDeImoveis(): readonly string[] {
  const imoveis = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;

  return [
    `POST ${imoveis}`,
    `GET ${imoveis}`,
    `GET ${imoveis}/:id`,
    `PUT ${imoveis}/:id`,
    `POST ${imoveis}/:id/retirada`,
    `POST ${imoveis}/:id/recirculacao`,
  ];
}

/**
 * Os **três pares** que as rotas de cômodo publicam (T7 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_COMODOS`, que por sua vez
 * deriva de `CAMINHO_DOS_IMOVEIS`), pela mesma razão dos inventários acima.
 *
 * **Não existe par de LEITURA**, e a ausência é contrato: o cômodo não tem representação própria na
 * API — ele chega e volta dentro do imóvel, que é o agregado dele (§4.1). As três escritas respondem
 * com o imóvel inteiro já recalculado.
 *
 * As três declaram pela **classe** e nenhuma declara no método — nem a de remoção. Ver a razão no
 * `SUT_IS_CORRECT_BECAUSE` de {@link ROTAS_COM_EXIGENCIA}: a ação sensível é da saída de circulação
 * de cadastro, e a ADR-0014 exclui o cômodo daquele alcance.
 */
function paresDeComodos(): readonly string[] {
  const comodos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_COMODOS}`;

  return [`POST ${comodos}`, `PUT ${comodos}/:comodoId`, `DELETE ${comodos}/:comodoId`];
}

/**
 * Os **seis pares** que UM papel de cadastro de pessoa publica (T9 da fatia
 * `cadastro-de-imoveis-e-pessoas`).
 *
 * Compostos a partir do dono do segmento, que é passado por argumento — os três papéis publicam a
 * MESMA superfície, e escrever três listas idênticas a não ser pelo caminho daria três lugares para
 * esquecer um par. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada própria, e
 * o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`. Elas são as únicas desta
 * superfície que declaram no MÉTODO — e declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:cadastros, ACAO:excluir_cadastro)`), nunca só a ação. Aqui a forma importa
 * mais do que em qualquer outra superfície da fatia: `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` **é**
 * `TELA:cadastros`, de modo que declarar só a ação produziria, por coincidência, a mesma área
 * exigida — e nenhuma prova comportamental reprovaria. Quem audita esse conteúdo é o `CT-355`, por
 * ESTRUTURA; este caso mede a **existência** da declaração.
 */
function paresDeUmPapelDeCadastro(caminhoDoPapel: string): readonly string[] {
  const papel = `/${PREFIXO_DE_VERSAO}/${caminhoDoPapel}`;

  return [
    `POST ${papel}`,
    `GET ${papel}`,
    `GET ${papel}/:id`,
    `PUT ${papel}/:id`,
    `POST ${papel}/:id/retirada`,
    `POST ${papel}/:id/recirculacao`,
  ];
}

/**
 * Os **oito pares** que a superfície de contrato publica — as seis rotas de cadastro (T6), a
 * **ativação** (T7) e o **cancelamento** (T8), da fatia `contratos-de-locacao`.
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_CONTRATOS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * **A chave da rota é o `:codigo`, e não um `:id`** — o contrato tem série declarada, e a ADR-0017 lhe
 * dá o código legível como chave exposta. O nome do parâmetro entra literalmente no par, porque é ele
 * que o roteador publica.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este inventário que descrevia uma
 * superfície sem a ativação. A T7 publicou `POST /v1/contratos/:codigo/ativacao` — rota própria por
 * decisão da ADR-0019 —, e uma tabela que a ignorasse deixaria o `CT-213` e o `CT-318` passarem sobre
 * uma superfície incompleta, que é exatamente o modo de falha silencioso que estes inventários
 * existem para fechar. **Nenhuma entrada anterior saiu**, a igualdade segue exata, e o par novo entra
 * no conjunto POSITIVO — o que prova que ele declara exigência em vez de dispensá-la.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /v1/contratos/:codigo/cancelamento` — a segunda
 * transição governada, com ação sensível **própria** (`ACAO:cancelar_contrato`) —, e vale aqui,
 * palavra por palavra, o parágrafo acima: uma tabela que a ignorasse deixaria o `CT-213` e o `CT-318`
 * passarem sobre uma superfície incompleta. **Nenhuma entrada anterior saiu**, a igualdade segue
 * exata, e o par novo entra no conjunto POSITIVO. Com ele a máquina de estados fecha, e o único par
 * ainda por vir nesta fatia é o da rota de situação de locação (T10), que vive sob `/v1/imoveis`.
 *
 * As duas de circulação, a ativação **e o cancelamento** são as únicas desta superfície que declaram
 * no MÉTODO — e as quatro declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:contratos, <ação>)`), nunca só a ação. Aqui a forma tem consequência material:
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é `TELA:cadastros`, que **não** é a área desta classe —
 * declarar só a ação daria a quem administra cadastros de pessoa o poder de retirar contratos de
 * circulação. Nas duas transições a consequência é ainda mais direta: `MAPA_ACAO_TELA` leva
 * `ACAO:ativar_contrato` e `ACAO:cancelar_contrato` **à própria** `TELA:contratos`, de modo que a
 * declaração só com a ação exigiria a área certa **por acidente** — e este caso, que mede existência,
 * não a distinguiria. Quem audita esse conteúdo é o `CT-355`.
 */
/**
 * O **único par** que a rota de situação de locação publica (T10 da fatia `contratos-de-locacao`).
 *
 * Ele é da fatia de contratos e vive sob `/v1/imoveis`, e as duas coisas são conteúdo: o que a rota
 * governa é o par `contrato ATIVO ⇔ imóvel LOCADO`, mas o recurso alterado é o **imóvel**, e um
 * caminho sob `/v1/contratos` diria que a situação do imóvel pertence ao contrato. Por isso ele entra
 * em {@link PARES_DA_FATIA_DE_CONTRATOS} — que é partição por **fatia**, não por prefixo de caminho —
 * e **não** em {@link paresDeImoveis}, cujo tamanho o `CT-318` afirma em `33` por escrito.
 *
 * **Ela é a única rota de sub-recurso de ato desta base que NÃO declara nada no método**, e a
 * ausência é a decisão registrada no cabeçalho de `imovel.controller.ts`: vale a exigência da classe,
 * `TELA:imoveis`, porque não há ação sensível para esta transição no catálogo fechado e alternar
 * entre disponível e indisponível é atributo operacional do cadastro, não ato sensível (leitura
 * declarada da ADR-0019). Para **este** caso, que mede existência de declaração, ela é uma rota como
 * as outras quatro que herdam a da classe; quem audita conteúdo é o `CT-355`, e o `CT-427` é quem
 * afirma que a ausência aqui é ausência **de declaração no método**, e não de exigência.
 */
function paresDeSituacaoDeLocacao(): readonly string[] {
  return [`POST /${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/:id/situacao-de-locacao`];
}

function paresDeContratos(): readonly string[] {
  const contratos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

  return [
    `POST ${contratos}`,
    `GET ${contratos}`,
    `GET ${contratos}/:codigo`,
    `PUT ${contratos}/:codigo`,
    `POST ${contratos}/:codigo/ativacao`,
    `POST ${contratos}/:codigo/cancelamento`,
    `POST ${contratos}/:codigo/retirada`,
    `POST ${contratos}/:codigo/recirculacao`,
  ];
}

/**
 * O **par único** que a rota do documento do contrato publica (T7 da fatia
 * `documentos-e-confirmacao`).
 *
 * Escrito à mão e composto a partir do dono do segmento (`CAMINHO_DOS_CONTRATOS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` **não** entra: ele não é entrada própria, e o
 * módulo verificado já o descarta.
 *
 * Ele mora numa função separada de {@link paresDeContratos}, e não dentro dela, porque a partição do
 * `CT-318` é por **fatia** e não por caminho: a rota é sobre `/v1/contratos`, mas nasceu em outra
 * fatia, e misturá-las tornaria o delta daquele caso uma soma de coisas diferentes. Ver o docblock de
 * {@link PARES_DA_FATIA_DE_DOCUMENTOS}.
 *
 * **Ela não declara nada no MÉTODO**, e a ausência é decisão registrada (§4.1 do tech spec): a rota
 * vale pela exigência da classe, `TELA:contratos`, porque baixar o documento é leitura do que a área
 * já dá e o catálogo fechado da ADR-0011 não tem ação sensível correspondente. Para **este** caso,
 * que mede existência de declaração, ela é uma rota como as que herdam a da classe; quem examina o
 * conteúdo da declaração é o `CT-355`, e é lá que a ausência importa — não declarar nada é o oposto
 * de declarar **menos** que a classe.
 */
function paresDoDocumentoDeContrato(): readonly string[] {
  const contratos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

  return [`GET ${contratos}/:codigo/documento`];
}

/**
 * O **par único** do reenvio da confirmação de e-mail (T9 da fatia `documentos-e-confirmacao`).
 *
 * Escrito à mão e composto a partir do dono do segmento (`CAMINHO_DOS_LOCATARIOS`), pela mesma razão
 * dos inventários acima. É **um** par e não dois: a rota é `POST`, e só um `GET` acrescentaria o
 * segundo pelo `HEAD` que o adaptador deriva — e que o módulo verificado já descarta.
 *
 * Ele mora numa função separada de {@link paresDeCadastrosDePessoa} pela mesma razão que o documento
 * do contrato mora fora de {@link paresDeContratos}: a partição do `CT-318` é por **fatia** e não por
 * caminho. A rota é sobre `/v1/locatarios`, mas nasceu nesta fatia, e misturá-las tornaria o delta
 * daquele caso uma soma de coisas diferentes.
 *
 * **Ela não declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech spec): a rota
 * vale pela exigência da classe, `TELA:cadastros`, porque reenviar a confirmação é o mesmo ato de
 * cadastro que a área já governa e o catálogo fechado da ADR-0011 não tem ação sensível
 * correspondente — `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Para **este**
 * caso, que mede existência de declaração, ela é uma rota como as que herdam a da classe; quem
 * examina o conteúdo da declaração é o `CT-355`, e lá a ausência importa pelo lado oposto — não
 * declarar nada é o contrário de declarar **menos** que a classe, e nesta superfície declarar só a
 * área seria substituição invisível por comportamento (`TELA:cadastros` é exatamente
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`).
 */
function paresDoReenvioDeConfirmacao(): readonly string[] {
  const locatarios = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`;

  return [`POST ${locatarios}/:id/confirmacao-de-email`];
}

/**
 * O **par único** do ato do titular (T11 da fatia `documentos-e-confirmacao`) — a **única** rota de
 * negócio do produto sem sessão.
 *
 * Composto a partir do dono do segmento (`CAMINHO_DAS_CONFIRMACOES`), pela mesma razão dos
 * inventários acima. É **um** par e não dois: a rota é `POST`, e só um `GET` acrescentaria o segundo
 * pelo `HEAD` que o adaptador deriva — e que o módulo verificado já descarta.
 *
 * ⚠️ **Ele mora numa função própria, e NÃO entra em {@link PARES_DA_FATIA_DE_DOCUMENTOS}.** Aquele
 * inventário é dos pares que **declaram exigência**, e é contra ele que a igualdade do conjunto
 * positivo compara; este par é declarado `@RotaPublica()` e portanto vive no conjunto **público**
 * (`PARES_PUBLICOS_ACEITOS`). Somá-lo lá faria a igualdade do `CT-318` reprovar sobre uma rota
 * legítima — e, pior, a confusão daria a impressão de que a rota tem chave a exigir, que é
 * exatamente o que a ADR-0027 substitui pelo portador de segredo.
 */
function paresDoAtoDoTitular(): readonly string[] {
  return [`POST /${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_CONFIRMACOES}`];
}

/**
 * Os **cinco pares** que a superfície de cobrança publica — três da T5 e as duas transições da T7.
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DAS_COBRANCAS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * **A chave da rota é o `:codigo`, e não um `:id`** — a cobrança tem série declarada, e a ADR-0017 lhe
 * dá o código legível como chave exposta. O nome do parâmetro entra literalmente no par, porque é ele
 * que o roteador publica.
 *
 * **Nenhuma das cinco declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech
 * spec): as cinco valem pela exigência da classe, `TELA:financeiro`, porque o catálogo fechado da
 * ADR-0011 enumera duas ações sensíveis dentro daquela área — `ACAO:emitir_boleto` e
 * `ACAO:solicitar_baixa_de_boleto` — e **nenhuma** para lançar, ler, pagar ou cancelar cobrança. Para
 * **este** caso, que mede existência de declaração, elas são rotas como as que herdam a da classe;
 * quem audita conteúdo é o `CT-355`, e a auditoria final das sete declarações é o `CT-533`, em T11.
 *
 * **As duas transições da T7 são a evidência mais forte disso nesta superfície**: elas são atos de
 * escrita que mudam o estado publicado de um fato financeiro, e ainda assim exigem **apenas a área** —
 * a classificação sai da `Decision` da ADR-0021 (acusar pagamento registra dinheiro que se moveu fora
 * do sistema, e o cancelamento tem substituta prevista) e foi escalada e confirmada antes da spec.
 *
 * **Não há par de exclusão nem de circulação**, e a ausência é contrato: a cobrança não tem ato de
 * exclusão a traduzir (ADR-0014, §21 do tech spec). O `CT-521`, em T10, afirma que os métodos sob
 * `/v1/cobrancas` são exatamente `['GET','POST']` — e as duas transições, sendo `POST`, não o mudam.
 */
function paresDeCobrancas(): readonly string[] {
  const cobrancas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

  return [
    `POST ${cobrancas}`,
    `GET ${cobrancas}`,
    `GET ${cobrancas}/:codigo`,
    `POST ${cobrancas}/:codigo/pagamento`,
    `POST ${cobrancas}/:codigo/cancelamento`,
  ];
}

/**
 * Os **dois pares** que a superfície da política de mora publica (T6 da fatia `cobranca-e-mora`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DE_MULTA_E_JUROS`), pela mesma
 * razão dos inventários acima. O `HEAD` derivado do `GET` **não** entra: ele não é entrada própria, e
 * o módulo verificado já o descarta.
 *
 * **O recurso é singular, e por isso não há `:id` nem `:codigo` em par algum**: a política é uma por
 * empresa (`configuracao_de_mora_empresa_key`), e a chave é a própria sessão. É o que faz os dois
 * pares compartilharem o mesmo caminho e diferirem só pelo verbo — a classificação por par
 * método+caminho, que é a deste arquivo, os conta separadamente, enquanto a por caminho de
 * `contexto.e2e.spec.ts` os funde em uma entrada só.
 *
 * **Nenhuma das duas declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech
 * spec): as duas valem pela exigência da classe, `TELA:multa_e_juros`, porque o catálogo fechado da
 * ADR-0011 **não enumera ação sensível alguma** dentro daquela área, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Para **este** caso, que mede
 * existência de declaração, elas são rotas como as três de cobrança; quem audita conteúdo é o
 * `CT-355`, e a auditoria final das sete declarações da fatia é o `CT-533`, em T11.
 */
function paresDeMultaEJuros(): readonly string[] {
  const multaEJuros = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DE_MULTA_E_JUROS}`;

  return [`GET ${multaEJuros}`, `PUT ${multaEJuros}`];
}

/**
 * Os **quatro pares** que a área da automação de cobrança publica (T9 e T10 da fatia
 * `regua-de-cobranca`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DA_AUTOMACAO_DE_COBRANCA`), pela
 * mesma razão dos inventários acima. O `HEAD` derivado do `GET` **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * **O recurso é singular, e por isso não há `:id` nem `:codigo` em par algum**: a política é uma por
 * empresa (`politica_de_aviso_empresa_key`), e a chave é a própria sessão. É o que faz os dois pares
 * compartilharem o mesmo caminho e diferirem só pelo verbo — exatamente como os de
 * {@link paresDeMultaEJuros}.
 *
 * **Nenhuma das duas declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech
 * spec): as duas valem pela exigência da classe, `TELA:automacao_de_cobranca`, porque a única ação
 * sensível que o catálogo fechado enumera naquela área — `ACAO:enviar_cobranca_manual` — governa o
 * **disparo** do aviso, e não a configuração da régua; `packages/auth/src/catalogo-de-permissoes.ts`
 * **não foi tocado**. Para **este** caso, que mede existência de declaração, elas são rotas como as
 * duas de mora; quem audita conteúdo é o `CT-355`, e a auditoria final das quatro declarações desta
 * fatia é o `CT-635`, em T12.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T10** publicou as duas rotas de aviso — o histórico e o disparo manual
 * —, que o parágrafo acima já anunciava (*"entram aqui conforme nascerem"*). As duas compartilham o
 * caminho `.../cobrancas/:codigo/avisos` e diferem pelo verbo, de modo que são **dois** pares e não
 * quatro; o `HEAD` derivado do `GET` continua sendo suprimido pelo módulo verificado. **Nenhuma
 * entrada anterior saiu**, e a igualdade segue exata. O `POST` é o único par desta fatia que declara
 * no MÉTODO, e declara a **conjunção inteira** (`@ExigeChaves(área, ação)`) — para **este** caso, que
 * mede existência de declaração, ele é rota como as outras três; quem audita o conteúdo dela é o
 * `CT-355`, logo abaixo, e a auditoria final das quatro é o `CT-635`, em T12.
 */
function paresDaAutomacaoDeCobranca(): readonly string[] {
  const automacao = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_AUTOMACAO_DE_COBRANCA}`;
  const avisos = `${automacao}/cobrancas/:codigo/avisos`;

  return [`GET ${automacao}`, `PUT ${automacao}`, `GET ${avisos}`, `POST ${avisos}`];
}

/** Os **dezoito pares** dos três papéis — seis por papel, na ordem em que os controladores nascem. */
function paresDeCadastrosDePessoa(): readonly string[] {
  return [
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_LOCADORES),
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_LOCATARIOS),
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_FIADORES),
  ];
}

/**
 * O INVENTÁRIO dos pares que não passam pela decisão da guarda, na aplicação de produção.
 *
 * São os nove acima mais os das três rotas marcadas `@RotaPublica()`:
 *
 *   * as **duas verificações de saúde**, consultadas pelo supervisor do sistema operacional e pela
 *     prova de aceitação do reinício — nenhum dos dois com sessão;
 *   * o **encaminhador de identidade**, que precisa ser público porque entrar acontece antes de
 *     existir sessão, e que entra com os sete pares acima.
 *
 * **É esta igualdade que impede a escapatória.** Sem ela, bastaria marcar uma rota de negócio como
 * pública para ela sair da autorização inteira, e o conjunto sem declaração continuaria vazio — a
 * guarda retorna antes para rota pública, e não haveria nada a declarar.
 *
 * ---------------------------------------------------------------------------
 * A gêmea, e por que a fusão foi ANALISADA E RECUSADA (débito D22 · F1/T5)
 * ---------------------------------------------------------------------------
 *
 * Existe um inventário irmão em `apps/api/test/contexto.e2e.spec.ts`, `CAMINHOS_PUBLICOS_ACEITOS`.
 * **Os dois não são cópias** — provam coisas diferentes: **este** classifica por **DECLARAÇÃO**,
 * recorte por **par método+caminho** (o que o catálogo diz); o gêmeo classifica por
 * **COMPORTAMENTO**, recorte por **caminho** (quem a guarda de fato recusa sem cookie).
 *
 * Até 2026-08-08 os dois se chamavam `ROTAS_PUBLICAS_ACEITAS` — nome idêntico para recortes
 * divergentes, que é o que fazia alguém atualizar o inventário errado. O rename fechou essa
 * armadilha; a **manutenção dupla ao acrescentar rota permanece**, e é deliberada.
 *
 * O D22 prescrevia fundi-los num ponto único. Fundir no recorte **por caminho** contrariaria o
 * marcador `DECISÃO FECHADA — T5 / Gate 2 · 2026-08-04` de
 * `apps/api/src/autenticacao/cobertura-de-autorizacao.ts`, que fixa o par método+caminho como
 * unidade de classificação **desta** verificação — o que a §3 do Protocolo Antirregressão manda
 * escalar, não decidir numa limpeza. Fundir **por par** mudaria o que o `CT-020 (d)` do gêmeo prova.
 * **Não tente a fusão sem escalar.**
 */
const PARES_PUBLICOS_ACEITOS: readonly string[] = [
  ...ROTAS_FORA_DO_ARCABOUCO,
  'GET /saude',
  'GET /saude/pronto',
  ...paresDoEncaminhador(),
  // SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `documentos-e-confirmacao` publicou a **única rota de
  // negócio sem sessão do produto** — `POST /v1/confirmacoes-de-email` —, e o lugar dela é este
  // conjunto, não o positivo: ela declara `@RotaPublica()`, e a marca **é** a declaração dela (§5.1
  // da tech spec da fatia da cobertura). É a primeira entrada deste inventário que não é nem
  // verificação de saúde, nem superfície do arcabouço de identidade, nem contrato publicado — e é
  // por isso que ela **precisa** aparecer aqui nomeada: a ADR-0027 autoriza a dispensa para o ato do
  // titular, e a autorização só é auditável se o inventário a registrar. **Nenhuma entrada anterior
  // saiu**, a igualdade segue exata nos dois sentidos, e `semDeclaracao` continua vazio — uma rota
  // que dispensasse sessão sem revisão apareceria aqui como excedente e reprovaria nominalmente.
  ...paresDoAtoDoTitular(),
].sort();

/**
 * As **quinze** rotas que já declaravam exigência **antes** da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * A metade nomeada existe para o `CT-318`: o total sozinho (`66`) é âncora de tamanho, e uma
 * atualização apressada que tirasse um par desta metade e acrescentasse um da outra manteria o total
 * e passaria despercebida. Com as duas metades separadas, o `CT-318` afirma que **esta** ficou
 * intacta e que a outra tem exatamente 33 pares.
 *
 * Ela reúne, sem tirar nem acrescentar nada, o que {@link ROTAS_COM_EXIGENCIA} já listava: a sessão
 * corrente, a troca de senha do produto, as seis do operador do SaaS e as sete da administração de
 * pessoas.
 */
const EXIGENCIA_ANTERIOR_A_FATIA: readonly string[] = [
  `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
  `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
  ...paresDoMaster(),
  ...paresDeUsuarios(),
].sort();

/**
 * Os **trinta e três** pares que a fatia `cadastro-de-imoveis-e-pessoas` acrescenta.
 *
 * Seis de conjunto (T5), seis de imóvel (T6), três de cômodo (T7) e dezoito dos três papéis de
 * cadastro de pessoa (T9) — `6 + 6 + 3 + 18 = 33`. É a outra metade de {@link ROTAS_COM_EXIGENCIA},
 * e é o inventário que o `CT-318` afirma **por igualdade** contra o que a superfície publica.
 */
const PARES_NOVOS_DA_FATIA: readonly string[] = [
  ...paresDeConjuntos(),
  ...paresDeImoveis(),
  ...paresDeComodos(),
  ...paresDeCadastrosDePessoa(),
].sort();

/**
 * Quantos pares a superfície publicava **antes** da fatia `cadastro-de-imoveis-e-pessoas` — o outro
 * lado do delta do `CT-318`.
 *
 * É o valor que {@link ROTAS_PUBLICADAS_EM_PRODUCAO} carregava ao fim da fatia
 * `autorizacao-e-ciclo-de-acesso`, e ele não é derivado daquele número: é a âncora contra a qual o
 * crescimento de exatamente 33 é afirmado, medido sobre a superfície observada.
 */
const ROTAS_PUBLICADAS_ANTES_DA_FATIA = 33;

/**
 * Os **nove** pares que a fatia `contratos-de-locacao` acrescenta — os seis de cadastro de contrato
 * (T6), a ativação (T7), o cancelamento (T8) e a situação de locação do imóvel (T10). Com o último, a
 * superfície da fatia está completa.
 *
 * SUT_IS_CORRECT_BECAUSE: a contagem narrativa desta linha dizia "os **seis** pares … (T6)" enquanto
 * a constante já carregava sete, depois oito, e agora nove — é o débito **D33 (F2/T7)**, fechado na
 * T7 e mantido em dia desde então. O que
 * mudou é **só a prosa**: a lista é derivada de {@link paresDeContratos}, e nenhuma asserção deriva
 * deste texto. A correção é obrigatória mesmo assim, e a razão está escrita no docblock de
 * `ROTAS_DE_ESCRITA` de `contrato-publicado.e2e.spec.ts`: número desatualizado convida a próxima task
 * a "corrigir" a âncora executável **para baixo**.
 *
 * Ele é uma **terceira metade** nomeada, e não uma extensão de {@link PARES_NOVOS_DA_FATIA}: aquele
 * inventário é a fatia anterior, o `CT-318` afirma o tamanho dele em `33` por escrito, e engordá-lo
 * com rotas de outra fatia tornaria o delta daquele caso uma soma de duas coisas diferentes. Separado,
 * cada fatia responde pelo próprio crescimento e a metade antiga continua sendo afirmada por
 * igualdade.
 *
 * As transições de estado (T7, T8) e a rota de situação de locação do imóvel (T10) entram aqui
 * conforme nascerem — a superfície cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 publicou `POST /v1/imoveis/:id/situacao-de-locacao`, e ela entra
 * **nesta** metade, e não em {@link PARES_NOVOS_DA_FATIA}: a partição é por **fatia**, e o `CT-318`
 * afirma o tamanho daquela em `33` por escrito. Somá-la lá tornaria o delta daquele caso uma soma de
 * duas coisas diferentes; é a mesma razão que fez esta terceira metade nascer na T6. **Nenhuma
 * entrada anterior saiu**, e com ela a superfície da fatia está completa em **nove** rotas.
 */
const PARES_DA_FATIA_DE_CONTRATOS: readonly string[] = [
  ...paresDeContratos(),
  ...paresDeSituacaoDeLocacao(),
].sort();

/**
 * O inventário de exigência **anterior à fatia `contratos-de-locacao`** — as duas metades da fatia de
 * cadastro somadas.
 *
 * É contra ele que o `CT-318` compara o que sobra da superfície depois de tirar os pares de contrato,
 * e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo com um inventário a mais
 * em jogo.
 */
const EXIGENCIA_ANTERIOR_AOS_CONTRATOS: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_A_FATIA,
  ...PARES_NOVOS_DA_FATIA,
].sort();

/**
 * Os pares que a fatia `cobranca-e-mora` acrescenta — hoje os **três** de `/v1/cobrancas` (T5).
 *
 * Ela é uma **quarta metade** nomeada, e não uma extensão de {@link PARES_DA_FATIA_DE_CONTRATOS}:
 * aquele inventário é da fatia anterior, e engordá-lo com rotas desta tornaria o delta do `CT-318`
 * uma soma de coisas diferentes. É a mesma razão que fez a terceira metade nascer na T6 da fatia de
 * contratos — cada fatia responde pelo próprio crescimento, e as metades antigas continuam sendo
 * afirmadas por igualdade de array.
 *
 * As rotas de mora (T6) e as duas transições de cobrança (T7) entram aqui conforme nascerem — a
 * superfície cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 publicou os **dois pares de `/v1/multa-e-juros`**, e eles entram
 * **nesta** metade, e não numa quinta: a partição é por **fatia**, e as rotas de mora são desta
 * mesma. Uma metade nova por task tornaria o delta do `CT-318` uma soma de partes arbitrárias, em
 * vez do crescimento de uma fatia. **Nenhuma entrada anterior saiu**, e a igualdade segue exata.
 */
const PARES_DA_FATIA_DE_COBRANCA: readonly string[] = [
  ...paresDeCobrancas(),
  ...paresDeMultaEJuros(),
].sort();

/**
 * O inventário de exigência **anterior à fatia `cobranca-e-mora`** — as três metades somadas.
 *
 * É contra ele que o `CT-318` compara o que sobra da superfície depois de tirar os pares desta fatia,
 * e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo com um inventário a mais
 * em jogo.
 */
const EXIGENCIA_ANTERIOR_AS_COBRANCAS: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AOS_CONTRATOS,
  ...PARES_DA_FATIA_DE_CONTRATOS,
].sort();

/**
 * Os pares que a fatia `regua-de-cobranca` acrescenta — hoje os **dois** da política de aviso (T9).
 *
 * Ela é uma **quinta metade** nomeada, e não uma extensão de {@link PARES_DA_FATIA_DE_COBRANCA}:
 * aquele inventário é da fatia anterior, o `CT-533` afirma o tamanho dele em `7` por escrito, e
 * engordá-lo com rotas desta tornaria o delta do `CT-318` uma soma de coisas diferentes. É a mesma
 * razão que fez a terceira metade nascer na T6 da fatia de contratos e a quarta na T5 da de
 * cobrança — cada fatia responde pelo próprio crescimento, e as metades antigas continuam sendo
 * afirmadas por igualdade de array.
 *
 * As duas rotas de aviso (T10) entram aqui conforme nascerem — a superfície cresce por decisão de
 * quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 publicou as duas rotas de aviso, e a contagem narrativa desta linha
 * ficou dizendo "hoje os **dois**" enquanto {@link paresDaAutomacaoDeCobranca} já devolvia quatro —
 * o mesmo débito **D33 (F2/T7)** que a fatia de contratos fechou, na mesma forma. O que muda é **só
 * a prosa**: a lista é derivada daquela função, e nenhuma asserção deriva deste texto. A correção é
 * obrigatória mesmo assim, e a razão está registrada no docblock de {@link PARES_DA_FATIA_DE_CONTRATOS}:
 * número desatualizado convida a próxima task a "corrigir" a âncora executável **para baixo** — e a
 * âncora aqui é o `4` que o `CT-635` afirma por escrito, em {@link PARES_PUBLICADOS_PELA_FATIA_DA_REGUA}.
 * **Nenhuma entrada saiu**, e com as duas de aviso a superfície da fatia está completa em **quatro**
 * rotas.
 */
const PARES_DA_FATIA_DA_REGUA: readonly string[] = [...paresDaAutomacaoDeCobranca()].sort();

/**
 * O inventário de exigência **anterior à fatia `regua-de-cobranca`** — as quatro metades somadas.
 *
 * É contra ele que a igualdade do conjunto positivo compara o que sobra da superfície depois de
 * tirar os pares desta fatia, e é ele que faz a prova "nenhuma entrada anterior saiu" continuar
 * valendo com um inventário a mais em jogo.
 */
const EXIGENCIA_ANTERIOR_A_REGUA: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AS_COBRANCAS,
  ...PARES_DA_FATIA_DE_COBRANCA,
].sort();

/**
 * O par que a fatia `documentos-e-confirmacao` acrescenta — hoje o **um** do documento do contrato
 * (T7).
 *
 * Ela é uma **sexta metade** nomeada, e não uma extensão de {@link PARES_DA_FATIA_DE_CONTRATOS}: a
 * rota é sobre `/v1/contratos`, mas a partição é por **fatia**, não por caminho. Aquele inventário é
 * o da fatia `contratos-de-locacao`, o docblock dele afirma por escrito que ela está *"completa em
 * nove rotas"*, e engordá-lo com uma rota desta tornaria o delta do `CT-318` uma soma de coisas
 * diferentes. É a mesma razão que fez a terceira metade nascer na T6 da fatia de contratos, a quarta
 * na T5 da de cobrança e a quinta na T9 da régua — cada fatia responde pelo próprio crescimento, e as
 * metades antigas continuam sendo afirmadas por igualdade de array.
 *
 * As duas rotas da confirmação de e-mail (T9 e T11) entram aqui conforme nascerem — a superfície
 * cresce por decisão de quem publica rota, nunca em silêncio. ⚠️ A da T11 é `@RotaPublica()`, e por
 * isso ela **não** entrará neste inventário: o lugar dela é o conjunto público, que o `CT-213` afirma
 * por igualdade em `PARES_PUBLICOS_ACEITOS`.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T9** publicou `POST /v1/locatarios/:id/confirmacao-de-email`, o reenvio
 * manual, e ela entra **nesta** metade — e não em {@link PARES_NOVOS_DA_FATIA}, onde moram os dezoito
 * pares dos três papéis de cadastro. A partição é por **fatia**, e o `CT-318` afirma o tamanho
 * daquela em `33` por escrito; somá-la lá tornaria o delta daquele caso uma soma de duas coisas
 * diferentes. É a mesma leitura que fez o documento do contrato ficar aqui em vez de entrar no
 * inventário de contratos. **Nenhuma entrada anterior saiu**, e a igualdade segue exata.
 */
const PARES_DA_FATIA_DE_DOCUMENTOS: readonly string[] = [
  ...paresDoDocumentoDeContrato(),
  ...paresDoReenvioDeConfirmacao(),
].sort();

/**
 * Os **dois** pares que a fatia `fundacao-bancaria` acrescenta na T11 — o certificado do provedor.
 *
 * Ela é a **sétima metade** nomeada, pela mesma razão que fez a sexta nascer: a partição do `CT-318`
 * é por **fatia**, e cada uma responde pelo próprio crescimento, com as metades antigas continuando a
 * ser afirmadas por igualdade de array.
 *
 * São **dois** e não três: `POST .../certificados` é um par, `GET .../certificado` é outro, e o `HEAD`
 * que o adaptador deriva do `GET` é suprimido pelo módulo verificado — a premissa de que *"cada `GET`
 * entra em dobro"* é falsa nesta base, e está registrada como tal no cabeçalho deste arquivo.
 *
 * As duas declaram exigência, e **por formas diferentes**, que é o que as torna interessantes para o
 * `CT-355`: a consulta vale pela classe (`@ExigeChave('TELA:integracoes_bancarias')`) e o registro
 * declara no método a **conjunção inteira**
 * (`@ExigeChaves('TELA:integracoes_bancarias', 'ACAO:configurar_integracao')`) — nunca só a ação, que
 * apagaria a área da classe em silêncio. `packages/auth/src/catalogo-de-permissoes.ts` **não foi
 * tocado**: as duas chaves já existem no catálogo fechado.
 *
 * ⚠️ **A rota de verificação (T12) entra aqui quando nascer** — a superfície cresce por decisão de
 * quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T12** da mesma fatia publicou a terceira e última rota dela,
 * `POST /v1/integracoes-bancarias/certificado/verificacao`, e o parágrafo acima é exatamente o
 * combinado: ela entra aqui **ao nascer**, nomeada. São **três** e não quatro, pela mesma razão de
 * sempre — a rota é `POST`, e só um `GET` traz o `HEAD` derivado, que o módulo verificado suprime de
 * qualquer forma. Ela declara exigência **pela classe**, e a ausência de declaração no método é a
 * decisão: a verificação não transfere direito, não move dinheiro e não altera o que outra entidade
 * pode fazer — a **RN-06** a declara sem efeito —, de modo que a ação sensível continua governando
 * **só** o registro. A norma é a **ADR-0011** com a **ADR-0018**, e não a ADR-0021: a `Decision`
 * desta tem por sujeito *"toda transição de estado de entidade de negócio"*, e a verificação não é
 * uma — ela entra por **analogia de critério** (a mesma régua de natureza do ato), nunca como
 * cláusula governante. `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Nenhum par
 * anterior saiu, a igualdade segue exata, e ela entra no conjunto POSITIVO — o conjunto **público**
 * continua inalterado, porque esta fatia não publica rota sem sessão.
 */
const PARES_DA_FATIA_BANCARIA: readonly string[] = paresDoCertificadoDoProvedor();

/**
 * Os **três** pares do certificado do provedor, compostos a partir dos donos dos segmentos.
 *
 * Escritos à mão e compostos das constantes que o controlador publica, pela mesma razão dos
 * inventários acima: derivá-los da mesma fonte que o caso classifica faria o caso concordar consigo
 * mesmo, e escrevê-los como cadeia crua deixaria três textos livres para divergir do caminho real.
 *
 * O caminho da verificação é composto **sobre o da consulta**, e não escrito de novo: ele é sufixo do
 * recurso singular (`certificado/verificacao`), e é assim que o controlador o declara.
 */
function paresDoCertificadoDoProvedor(): readonly string[] {
  const area = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}`;

  return [
    `GET ${area}/${SEGMENTO_DA_CONSULTA}`,
    `POST ${area}/${SEGMENTO_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`,
    `POST ${area}/${SEGMENTO_DO_REGISTRO}`,
  ].sort();
}

/**
 * O inventário de exigência **anterior à fatia `documentos-e-confirmacao`** — as cinco metades
 * somadas.
 *
 * É contra ele que a igualdade do conjunto positivo compara o que sobra da superfície depois de
 * tirar o par desta fatia, e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo
 * com um inventário a mais em jogo.
 */
const EXIGENCIA_ANTERIOR_AOS_DOCUMENTOS: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_A_REGUA,
  ...PARES_DA_FATIA_DA_REGUA,
].sort();

/**
 * O inventário de exigência **anterior à fatia `fundacao-bancaria`** — as seis metades somadas.
 *
 * É contra ele que a igualdade do conjunto positivo compara o que sobra da superfície depois de tirar
 * os dois pares desta fatia, e é ele que faz a prova "nenhuma entrada anterior saiu" continuar
 * valendo com um inventário a mais em jogo.
 */
const EXIGENCIA_ANTERIOR_AO_BANCARIO: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AOS_DOCUMENTOS,
  ...PARES_DA_FATIA_DE_DOCUMENTOS,
].sort();

/**
 * Os pares que a fatia `emissao-e-conciliacao` acrescenta — hoje os **dois atos sobre o boleto** (T13).
 *
 * Ela é uma **oitava metade** nomeada, e não uma extensão de {@link PARES_DA_FATIA_DE_COBRANCA}:
 * aquele inventário é da fatia `cobranca-e-mora`, o `CT-533` afirma o tamanho dele em `7` por
 * escrito, e engordá-lo com rotas desta tornaria o delta do `CT-318` uma soma de coisas diferentes.
 * É a mesma razão que fez a terceira metade nascer na T6 da fatia de contratos, a quarta na T5 da de
 * cobrança e a sétima na T11 da fundação bancária — cada fatia responde pelo próprio crescimento, e
 * as metades antigas continuam sendo afirmadas por igualdade de array.
 *
 * ⚠️ **As demais rotas desta fatia entram aqui conforme nascerem** — a entrega dos bytes e o
 * histórico bancário (T14), e as três de `/v1/cobranca-bancaria` (T15). A conferência final por
 * dupla medição, com a igualdade entre os dois eixos afirmada, é da **T17**; aqui as âncoras
 * **sobem**, e não são conferidas contra o número da fatia inteira.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T15** publicou as **três** rotas de `/v1/cobranca-bancaria`, e o
 * parágrafo acima é exatamente o combinado — elas entram aqui **ao nascerem**, nomeadas. O
 * inventário desta fatia passa de quatro para **sete** pares. Nenhum par anterior saiu, a igualdade
 * segue exata, e as três entram no conjunto POSITIVO: o conjunto **público** continua inalterado,
 * porque esta fatia não publica rota sem sessão. `packages/auth/src/catalogo-de-permissoes.ts`
 * **não foi tocado** — `ACAO:emitir_boleto` já existe no catálogo fechado, e a conferência não pede
 * ação alguma.
 *
 * As duas declaram exigência **pela forma que a ADR-0018 fixa**: a conjunção inteira no método
 * (`@ExigeChaves('TELA:financeiro', 'ACAO:…')`), nunca só a ação — que apagaria a área da classe em
 * silêncio, com a coerência do catálogo escondendo o defeito, porque `MAPA_ACAO_TELA` liga as duas
 * ações à própria área do Financeiro. Elas são a **segunda** classe da ADR-0021, e não a primeira: o
 * ato **move dinheiro** — registra um título cobrável no mundo, ou o derruba.
 * `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**: as duas chaves já existem no
 * catálogo fechado, reservadas exatamente para estas rotas.
 */
const PARES_DA_FATIA_DE_EMISSAO: readonly string[] = [
  ...paresDosAtosSobreOBoleto(),
  ...paresDasLeiturasSobreOBoleto(),
  ...paresDaCobrancaBancaria(),
].sort();

/**
 * Os **dois** pares dos atos sobre o boleto, compostos a partir do dono do segmento.
 *
 * Escritos à mão e compostos de `CAMINHO_DAS_COBRANCAS`, pela mesma razão dos inventários acima:
 * derivá-los da mesma fonte que o caso classifica faria o caso concordar consigo mesmo, e escrevê-los
 * como cadeia crua deixaria dois textos livres para divergir do caminho real.
 *
 * São **dois** e não quatro pela razão de sempre: as duas rotas são `POST`, e só um `GET` acrescenta
 * um segundo par pelo `HEAD` derivado — que o módulo verificado suprime de qualquer forma.
 */
function paresDosAtosSobreOBoleto(): readonly string[] {
  const cobrancas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

  return [
    `POST ${cobrancas}/:codigo/emissao-de-boleto`,
    `POST ${cobrancas}/:codigo/revogacao-de-boleto`,
  ].sort();
}

/**
 * Os **dois** pares das leituras sobre o boleto (T14), compostos a partir do dono do segmento.
 *
 * Escritos à mão e compostos de `CAMINHO_DAS_COBRANCAS`, pela mesma razão dos inventários acima:
 * derivá-los da mesma fonte que o caso classifica faria o caso concordar consigo mesmo, e escrevê-los
 * como cadeia crua deixaria dois textos livres para divergir do caminho real.
 *
 * São **dois** e não quatro: as duas rotas são `GET`, e o `GET` não traz o `HEAD` derivado junto — o
 * módulo verificado o suprime, e a premissa de que *"cada `GET` entra em dobro"* é falsa nesta base.
 *
 * ⚠️ **Elas são função SEPARADA de {@link paresDosAtosSobreOBoleto}, e a separação é conteúdo**: o
 * `CT-918 (f)` audita os dois grupos por retratos **diferentes** — os atos declaram a conjunção
 * `área + ação` no MÉTODO, e estas duas valem pela CLASSE, sem declarar nada. Fundir as listas faria
 * um `@ExigeChaves` indevido numa leitura, ou a perda da conjunção num ato, deixarem de ser
 * distinguíveis pelo inventário.
 */
function paresDasLeiturasSobreOBoleto(): readonly string[] {
  const cobrancas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

  return [`GET ${cobrancas}/:codigo/boleto`, `GET ${cobrancas}/:codigo/historico-bancario`].sort();
}

/**
 * Os **três** pares de `/v1/cobranca-bancaria` (T15), compostos a partir dos donos dos segmentos.
 *
 * Escritos à mão e compostos das constantes que o controlador publica, pela mesma razão dos
 * inventários acima: derivá-los da mesma fonte que o caso classifica faria o caso concordar consigo
 * mesmo, e escrevê-los como cadeia crua deixaria três textos livres para divergir do caminho real.
 *
 * São **três** e não quatro: das três rotas, duas são `POST` e uma é `GET`, e o `GET` não traz o
 * `HEAD` derivado junto — o módulo verificado o suprime, e a premissa de que *"cada `GET` entra em
 * dobro"* é falsa nesta base.
 *
 * ⚠️ **Elas são função SEPARADA das duas acima, e a separação é conteúdo**: as três valem por
 * declarações **diferentes**. O `POST /emissoes` declara no MÉTODO a conjunção `área + ação`; o `GET
 * /emissoes/:id` e o `POST /conferencias` nada declaram e valem pela CLASSE. Fundir as listas faria
 * uma exigência que sumisse de um grupo deixar de ser distinguível pelo inventário.
 */
function paresDaCobrancaBancaria(): readonly string[] {
  const area = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_COBRANCA_BANCARIA}`;

  return [
    `POST ${area}/${SEGMENTO_DAS_EMISSOES}`,
    `GET ${area}/${SEGMENTO_DAS_EMISSOES}/:id`,
    `POST ${area}/${SEGMENTO_DAS_CONFERENCIAS}`,
  ].sort();
}

/**
 * O inventário de exigência **anterior à fatia `emissao-e-conciliacao`** — as sete metades somadas.
 *
 * É contra ele que a igualdade do conjunto positivo compara o que sobra da superfície depois de tirar
 * os pares desta fatia, e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo com
 * um inventário a mais em jogo.
 */
const EXIGENCIA_ANTERIOR_A_EMISSAO: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AO_BANCARIO,
  ...PARES_DA_FATIA_BANCARIA,
].sort();

/**
 * Os pares da aplicação de produção que DECLARAM exigência — o eixo positivo da leitura.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 publicou as **seis rotas do operador do SaaS**, e as seis declaram
 * `@ExigePerfil('SYSLOC_MASTER')` na classe do controlador. O crescimento deste inventário é a
 * revisão que a ADR-0011 e o cabeçalho deste arquivo exigem de quem publica rota — *"a superfície
 * cresce por decisão de quem publica rota, nunca em silêncio"* —, e não um afrouxamento: **nenhuma
 * entrada anterior saiu** (`GET /v1/sessao` continua aqui), a igualdade segue sendo exata, e as
 * seis entram no conjunto POSITIVO, que é o que prova que elas declaram em vez de dispensar.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou as **sete rotas de administração de pessoas**, e as sete
 * declaram `@ExigeChave('TELA:usuarios')` na classe do controlador. Vale aqui, palavra por palavra,
 * o parágrafo acima: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as sete entram no
 * conjunto POSITIVO — o que prova que elas declaram exigência em vez de dispensá-la. É a revisão que
 * a ADR-0011 exige de quem publica rota, e ela é o motivo de esta lista ser escrita à mão.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 publicou `POST /v1/sessao/senha`, a troca de senha do produto, e ela
 * declara `@NaoExigePermissao()` no manipulador. Vale de novo o parágrafo acima — **nenhuma entrada
 * anterior saiu** e a igualdade segue exata —, com uma diferença que é a razão de o conjunto se
 * chamar POSITIVO e não "das que exigem chave": a marca de "não exige" **é** uma declaração, e é ela
 * que a ADR-0011 chama de *"única abertura deliberada"*. A rota entra aqui pelo mesmo motivo que
 * `GET /v1/sessao` entra: ela declara, e o que a ADR-0011 recusa é a rota que não declara nada.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` publicou as **seis rotas de
 * conjunto**, e as seis declaram exigência — quatro pela classe (`@ExigeChave('TELA:imoveis')`) e as
 * duas de circulação pelo método (`@ExigeChave('ACAO:excluir_cadastro')`, que a ADR-0011 exige que
 * seja a chave nomeada na recusa). Vale aqui, palavra por palavra, o parágrafo da T8: **nenhuma
 * entrada anterior saiu**, a igualdade segue exata, e as seis entram no conjunto POSITIVO — o que
 * prova que elas declaram exigência em vez de dispensá-la. É a revisão que a ADR-0011 exige de quem
 * publica rota, e ela é o motivo de esta lista ser escrita à mão.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia publicou as **seis rotas de imóvel**, e as seis
 * declaram exigência — quatro pela classe (`@ExigeChave('TELA:imoveis')`) e as duas de circulação
 * pelo método, com a **conjunção inteira** (`@ExigeChaves('TELA:imoveis', 'ACAO:excluir_cadastro')`),
 * que é a forma que a ADR-0018 fixa e que o `CT-355` audita por conteúdo. Vale aqui, palavra por
 * palavra, o parágrafo da T5: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as seis
 * entram no conjunto POSITIVO.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia publicou as **três rotas de cômodo**, e as três
 * declaram exigência pela classe (`@ExigeChave('TELA:imoveis')`) — nenhuma declara nada no método.
 * Vale aqui, palavra por palavra, o parágrafo da T6: **nenhuma entrada anterior saiu**, a igualdade
 * segue exata, e as três entram no conjunto POSITIVO.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da mesma fatia publicou as **dezoito rotas dos três papéis de
 * cadastro de pessoa**, e as dezoito declaram exigência — doze pela classe
 * (`@ExigeChave('TELA:cadastros')`) e as seis de circulação pelo método, com a **conjunção inteira**
 * (`@ExigeChaves('TELA:cadastros', 'ACAO:excluir_cadastro')`). Vale aqui, palavra por palavra, o
 * parágrafo da T6: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as dezoito entram no
 * conjunto POSITIVO.
 *
 * Nesta superfície a conjunção é a única coisa que separa o certo do errado **sem que o
 * comportamento mude**: a área da classe coincide com `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, de
 * modo que uma declaração só com a ação exigiria, por acidente, a mesma área. É o `CT-355` que a
 * acusa, por conteúdo — este inventário afirma que as dezoito declaram algo, e não o quê.
 *
 * A ausência de `ACAO:excluir_cadastro` no `DELETE` do cômodo **é conteúdo**, e não esquecimento: a
 * ação sensível governa a saída de circulação de um CADASTRO, e a ADR-0014 exclui o cômodo
 * nominalmente daquele alcance por ele não ser referenciável — remover um cômodo é corrigir a
 * planta, exatamente como alterá-lo. A §4.1 da tech spec registra as três rotas com `TELA:imoveis` e
 * nada mais, e é essa tabela que este inventário afirma. Se a decisão mudar, muda aqui **e** no
 * controlador, e o `CT-355` acusa a metade que ficar para trás.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` publicou as **seis rotas de cadastro
 * de contrato**, e as seis declaram exigência — quatro pela classe (`@ExigeChave('TELA:contratos')`)
 * e as duas de circulação pelo método, com a **conjunção inteira**
 * (`@ExigeChaves('TELA:contratos', 'ACAO:excluir_cadastro')`). Vale aqui, palavra por palavra, o
 * parágrafo da T6 da fatia anterior: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as
 * seis entram no conjunto POSITIVO. A diferença material desta superfície está registrada em
 * {@link paresDeContratos}: a área da classe **não** coincide com
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, de modo que uma declaração só com a ação exigiria uma
 * área **diferente** — e o `CT-355` é quem a acusa, por conteúdo.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` publicou as **três rotas de cobrança**, e
 * as três declaram exigência pela classe (`@ExigeChave('TELA:financeiro')`) — nenhuma declara nada no
 * método, e a ausência é decisão registrada na §11.2 do tech spec: o catálogo fechado não tem ação
 * sensível para lançar nem para ler cobrança, e `packages/auth/src/catalogo-de-permissoes.ts` **não
 * foi tocado**. Vale aqui, palavra por palavra, o parágrafo da T7 da fatia de cadastro, que é o caso
 * análogo (as três rotas de cômodo, todas pela classe): **nenhuma entrada anterior saiu**, a
 * igualdade segue exata, e as três entram no conjunto POSITIVO — o que prova que elas declaram
 * exigência em vez de dispensá-la.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da fatia `regua-de-cobranca` publicou as **duas rotas da política de
 * aviso**, e as duas declaram exigência pela classe (`@ExigeChave('TELA:automacao_de_cobranca')`) —
 * nenhuma declara nada no método, e a ausência é decisão registrada na §11.2 do tech spec: a única
 * ação sensível daquela área governa o **disparo** do aviso, não a configuração, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Vale aqui, palavra por palavra, o
 * parágrafo da T6 da fatia anterior, que é o caso análogo (as duas rotas de mora, também singulares e
 * também pela classe): **nenhuma entrada anterior saiu**, a igualdade segue exata, e as duas entram
 * no conjunto POSITIVO — o que prova que elas declaram exigência em vez de dispensá-la.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da fatia `documentos-e-confirmacao` publicou a **rota do documento do
 * contrato**, e ela declara exigência **pela classe** (`@ExigeChave('TELA:contratos')`) — não declara
 * nada no método, e a ausência é decisão registrada na §4.1 do tech spec: baixar o documento é
 * **leitura** do que a área já dá, e o catálogo fechado da ADR-0011 não tem ação sensível para esse
 * ato. `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Vale aqui, palavra por
 * palavra, o parágrafo da T7 da fatia de cadastro, que é o caso análogo (as três rotas de cômodo,
 * todas pela classe): **nenhuma entrada anterior saiu**, a igualdade segue exata, e ela entra no
 * conjunto POSITIVO — o que prova que ela declara exigência em vez de dispensá-la.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `fundacao-bancaria` publicou as **duas rotas do
 * certificado do provedor**, e as duas declaram exigência — a consulta pela classe
 * (`@ExigeChave('TELA:integracoes_bancarias')`) e o registro pelo método, com a **conjunção inteira**
 * (`@ExigeChaves('TELA:integracoes_bancarias', 'ACAO:configurar_integracao')`), que é a forma que a
 * ADR-0018 fixa e que o `CT-355` audita por conteúdo. A ação sensível governa **só** o registro, e a
 * assimetria é decisão: trocar a identidade com que a empresa cobra é o ato sensível desta
 * superfície — e a chave que o governa já existe no catálogo fechado da **ADR-0011**, declarada na
 * conjunção que a **ADR-0018** fixa —, enquanto ver qual certificado está valendo é leitura que a
 * área já dá; a régua de *natureza do ato* é a mesma da ADR-0021, citada por analogia, nunca como
 * cláusula governante (a `Decision` dela fala de transição de estado). Exigir a
 * ação na consulta esconderia de quem administra a integração o aviso de que o material vence em uma
 * semana. `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**: as duas chaves já
 * existem. Vale aqui, palavra por palavra, o parágrafo da T6 da fatia de contratos: **nenhuma
 * entrada anterior saiu**, a igualdade segue exata, e as duas entram no conjunto POSITIVO.
 */
const ROTAS_COM_EXIGENCIA: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_A_EMISSAO,
  ...PARES_DA_FATIA_DE_EMISSAO,
].sort();

/**
 * Quantos pares método+caminho a aplicação de produção publica hoje.
 *
 * Os nove do contrato, os dois de saúde, os **sete** do encaminhador de identidade, o da sessão
 * corrente, o da troca de senha do produto, os **seis** do operador do SaaS e os **sete** da
 * administração de pessoas. Ver o cabeçalho para por que a contagem é exata e não "maior que zero".
 *
 * SUT_IS_CORRECT_BECAUSE: mesma razão do inventário acima — a T8 acrescentou sete pares à superfície
 * publicada (25 → 32), e a âncora de contagem existe justamente para que esse acréscimo passe pela
 * revisão de quem lê este arquivo em vez de entrar sozinho.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou **um** par (32 → 33), `POST /v1/sessao/senha`. O
 * desligamento da rota nativa de troca de senha, entregue na mesma task, **não** muda esta contagem:
 * o encaminhador continua sendo um manipulador `@All('*')` sobre um caminho só, e o que mudou foi o
 * que ele repassa ao arcabouço — a recusa acontece dentro do mesmo par `POST /v1/auth/*`, que segue
 * publicado porque toda a demais superfície de identidade continua atendendo por ele.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` acrescentou **seis** pares à
 * superfície publicada (33 → 39), as seis rotas de `/v1/conjuntos`. A âncora de contagem existe
 * justamente para que esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar
 * sozinho — e a igualdade de conjunto logo acima nomeia quais são os seis.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **seis** pares à superfície publicada
 * (39 → 45), as seis rotas de `/v1/imoveis`, pela mesma razão do parágrafo acima. Nenhum par anterior
 * saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **três** pares (45 → 48), as três rotas de
 * `/v1/imoveis/:id/comodos`, pela mesma razão do parágrafo acima. Nenhum par anterior saiu. São três
 * e não quatro porque **não há rota de leitura de cômodo**: ele volta dentro do imóvel (§4.1), e o
 * `POST` da coleção, o `PUT` e o `DELETE` de `:comodoId` são a superfície inteira.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da mesma fatia acrescentou **dezoito** pares (48 → 66), as seis rotas
 * de cada um dos três papéis de cadastro de pessoa, pela mesma razão do parágrafo acima. Nenhum par
 * anterior saiu. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e não derivada das outras âncoras deste arquivo.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` acrescentou **seis** pares (66 → 72),
 * as seis rotas de cadastro de `/v1/contratos`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e não derivada das outras âncoras deste arquivo — o controlador novo tem seis
 * decoradores de rota, cada um reivindicando um par. São **seis** e não oito: as duas transições de
 * estado (`/ativacao` e `/cancelamento`) só nascem em T7 e T8, e a rota de situação de locação do
 * imóvel, em T10.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **um** par (72 → 73),
 * `POST /v1/contratos/:codigo/ativacao`, pela mesma razão dos parágrafos acima. Nenhum par anterior
 * saiu, e a igualdade de conjunto logo acima nomeia qual é o novo. A contagem foi **refeita do
 * zero**, por varredura dos decoradores de rota em `apps/api/src`. É **um** e não dois porque a rota
 * é `POST`: só um `GET` acrescenta um segundo par ao roteador, pelo `HEAD` derivado.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 da mesma fatia acrescentou **um** par (73 → 74),
 * `POST /v1/contratos/:codigo/cancelamento`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu, e a igualdade de conjunto logo acima nomeia qual é o novo. A contagem foi **refeita
 * do zero**, por varredura dos decoradores de rota em `apps/api/src`. É **um** e não dois pela mesma
 * razão do parágrafo anterior — a rota é `POST`, e só um `GET` traz o `HEAD` derivado junto.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **um** par (74 → 75),
 * `POST /v1/imoveis/:id/situacao-de-locacao`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu, e a igualdade de conjunto logo acima nomeia qual é o novo.
 *
 * ---------------------------------------------------------------------------
 * A âncora é 75, e a §11.2 do tech spec ESPERAVA 77 — a diferença foi MEDIDA
 * ---------------------------------------------------------------------------
 *
 * A §3.6 da T10 manda refazer as duas âncoras **do zero, por varredura, sem derivar uma da outra**,
 * e é isso que este número é. As duas medições independentes, feitas nesta task, concordam em **75**:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `75`;
 *   * **pela composição da superfície**, contada à parte — `60` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(60 - 1) + 7 + 9 = 75`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}, que são registrados
 *     direto no adaptador e não têm manipulador.
 *
 * O `77` da §11.2 é **aritmética da estimativa**, e não uma superfície observada: a fatia publica
 * **nove** rotas (seis de cadastro de contrato, ativação, cancelamento e a situação de locação), a
 * superfície anterior a ela tinha `66`, e `66 + 9 = 75`. A mesma §11.2 esperava `51 → 60`
 * manipuladores, e essa metade **bate exatamente** — o que confirma as nove rotas e localiza o erro
 * na soma do total, não no escopo entregue. Escrever `77` aqui exigiria publicar duas rotas que
 * ninguém especificou, ou afrouxar a âncora para uma desigualdade — as duas piores que corrigir o
 * número. É precisamente o caso que o *"não derive uma âncora da outra"* existe para pegar.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` acrescentou **três** pares (75 → 78), as
 * três rotas de `/v1/cobrancas`, e a âncora de contagem existe justamente para que esse acréscimo
 * passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de conjunto acima
 * nomeia quais são os três. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por
 * **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `78`;
 *   * **pela composição da superfície**, contada à parte — `63` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(63 - 1) + 7 + 9 = 78`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **três** e não cinco: duas das rotas novas são `GET`, e o `HEAD` que o adaptador deriva de cada
 * uma **não** é entrada própria — o módulo verificado o suprime, e é a mesma supressão que já governa
 * todo `GET` de coleção desta base. Não "corrija" para 80 **por causa dos `HEAD`** — a subida para 80
 * que veio depois tem outra origem, e está no parágrafo seguinte.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **dois** pares (78 → 80), o `GET` e o `PUT`
 * de `/v1/multa-e-juros`, e a âncora de contagem existe justamente para que esse acréscimo passe pela
 * revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de conjunto acima nomeia
 * quais são os dois. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por **duas**
 * medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `80`;
 *   * **pela composição da superfície**, contada à parte — `65` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(65 - 1) + 7 + 9 = 80`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não três: os dois manipuladores compartilham o **mesmo caminho** — o recurso é
 * singular por empresa e não tem `:id` —, de modo que o par é `GET`/`PUT` sobre a coleção, e só o
 * `GET` traria `HEAD` derivado, que o módulo verificado suprime.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **dois** pares (80 → 82), as duas transições
 * da cobrança — `POST /v1/cobrancas/:codigo/pagamento` e `POST /v1/cobrancas/:codigo/cancelamento` —, e
 * a âncora de contagem existe justamente para que esse acréscimo passe pela revisão de quem lê este
 * arquivo em vez de entrar sozinho; a igualdade de conjunto acima nomeia quais são os dois. Nenhum par
 * anterior saiu. A contagem foi **refeita do zero**, e por **duas** medições independentes que
 * concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `82`;
 *   * **pela composição da superfície**, contada à parte — `67` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(67 - 1) + 7 + 9 = 82`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois**, e nenhum `HEAD` entra: as duas rotas novas são `POST`, de modo que a supressão do
 * `HEAD` derivado não participa desta conta. Não "corrija" para 84 nem para 77 **por causa dos
 * `HEAD`** — a premissa de que cada `GET` entraria em dobro foi refutada por medição, e o módulo
 * verificado suprime o `HEAD`. A subida para 84 que veio depois tem outra origem, e está no parágrafo
 * seguinte.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da fatia `regua-de-cobranca` acrescentou **dois** pares (82 → 84), o
 * `GET` e o `PUT` de `/v1/automacao-de-cobranca`, e a âncora de contagem existe justamente para que
 * esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de
 * conjunto acima nomeia quais são os dois. Nenhum par anterior saiu. A contagem foi **refeita do
 * zero**, e por **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `84`;
 *   * **pela composição da superfície**, contada à parte — `69` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(69 - 1) + 7 + 9 = 84`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não três: os dois manipuladores compartilham o **mesmo caminho** — o recurso é
 * singular por empresa e não tem `:id` —, de modo que o par é `GET`/`PUT` sobre a coleção, e só o
 * `GET` traria `HEAD` derivado, que o módulo verificado suprime. E são **dois** e não quatro: as duas
 * rotas de aviso da §4.1 (o histórico e o disparo manual) só nascem em T10, e o `86` que a §11.2 do
 * tech spec estima é a superfície da **fatia inteira**, não a desta task.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da fatia `regua-de-cobranca` acrescentou **dois** pares (84 → 86), o
 * `GET` e o `POST` de `/v1/automacao-de-cobranca/cobrancas/:codigo/avisos`, e a âncora de contagem
 * existe justamente para que esse acréscimo passe pela revisão de quem lê este arquivo em vez de
 * entrar sozinho — a igualdade de conjunto acima nomeia quais são os dois. Nenhum par anterior saiu.
 * A contagem foi **refeita do zero**, e por **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `86`;
 *   * **pela composição da superfície**, contada à parte — `71` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(71 - 1) + 7 + 9 = 86`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não três: os dois manipuladores de aviso compartilham o **mesmo caminho** e diferem
 * pelo verbo, e só o `GET` traria `HEAD` derivado, que o módulo verificado suprime. Com eles a
 * superfície da fatia está completa em **quatro** rotas, que é o `86` da §11.2 do tech spec.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da fatia `documentos-e-confirmacao` acrescentou **um** par (86 → 87),
 * a rota `GET /v1/contratos/:codigo/documento`, e a âncora de contagem existe justamente para que
 * esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de
 * conjunto acima nomeia qual é. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por
 * **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `87`;
 *   * **pela composição da superfície**, contada à parte — `72` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(72 - 1) + 7 + 9 = 87`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * É **um** e não dois, e a razão é a mesma que já valeu para o `@Get(':codigo')` de contrato: o
 * `HEAD` que o adaptador deriva de todo `GET` **não** é entrada própria, e o módulo verificado o
 * suprime — ver o parágrafo do `82` acima, que é onde essa premissa foi medida e refutada na forma
 * ingênua. A rota nova é a **única** desta task; as duas da confirmação de e-mail chegam nas T9 e
 * T11, e o `89` que a §4.1 do tech spec estima é a superfície da **fatia inteira**, não a desta task.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T9** da mesma fatia acrescentou **um** par (87 → 88), a rota
 * `POST /v1/locatarios/:id/confirmacao-de-email`, e a âncora de contagem existe justamente para que
 * esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de
 * conjunto acima nomeia qual é. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por
 * **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `88`;
 *   * **pela composição da superfície**, contada à parte — `73` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(73 - 1) + 7 + 9 = 88`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * É **um** e não dois pela razão de sempre: a rota é `POST`, e só um `GET` traz o `HEAD` derivado
 * junto — e o módulo verificado o suprime de qualquer forma. A rota **sem sessão** desta fatia chega
 * na T11 e é a que fecha o `89` da §4.1 do tech spec.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da mesma fatia acrescentou **um** par (88 → 89), a rota
 * `POST /v1/confirmacoes-de-email` — a **única rota de negócio sem sessão do produto** —, e a âncora
 * de contagem existe justamente para que esse acréscimo passe pela revisão de quem lê este arquivo
 * em vez de entrar sozinho. Aqui a revisão vale duas vezes: o par novo entra no conjunto **público**
 * (ver {@link PARES_PUBLICOS_ACEITOS}), e é a igualdade daquele inventário — e não esta contagem —
 * que impede uma rota de escapar da autorização por `@RotaPublica()`. Nenhum par anterior saiu. A
 * contagem foi **refeita do zero**, e por **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `89`;
 *   * **pela composição da superfície**, contada à parte — `74` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(74 - 1) + 7 + 9 = 89`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * É **um** e não dois pela razão de sempre: a rota é `POST`. Com ele a superfície da **fatia inteira**
 * fecha em `89`, que é o número que a §4.1 do tech spec estimava — e a conferência final por dupla
 * medição, com a igualdade entre os dois eixos afirmada, é o `CT-732`, na T12.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `fundacao-bancaria` acrescentou **dois** pares
 * (89 → 91), as rotas `POST /v1/integracoes-bancarias/certificados` e
 * `GET /v1/integracoes-bancarias/certificado`, e a âncora de contagem existe justamente para que
 * esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de
 * conjunto acima nomeia quais são. Nenhum par anterior saiu, e o conjunto **público** continua
 * inalterado: esta fatia não publica rota sem sessão. A contagem foi **refeita do zero**, e por
 * **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `91`;
 *   * **pela composição da superfície**, contada à parte — `76` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(76 - 1) + 7 + 9 = 91`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não três: o `GET` da consulta não traz o `HEAD` derivado junto — o módulo verificado
 * o suprime —, e a premissa de que *"cada `GET` entra em dobro"* é falsa nesta base. ⚠️ A rota de
 * **verificação** chega na T12 e leva a superfície da fatia a `92/77`; a conferência final por dupla
 * medição é o `CT-836`, na T14.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T12** da fatia `fundacao-bancaria` acrescentou **um** par (91 → 92), a
 * rota `POST /v1/integracoes-bancarias/certificado/verificacao`, e a âncora de contagem existe
 * justamente para que esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar
 * sozinho — a igualdade de conjunto acima nomeia qual é. Nenhum par anterior saiu, e o conjunto
 * **público** continua inalterado. A contagem foi **refeita do zero**, e por **duas** medições
 * independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `92`;
 *   * **pela composição da superfície**, contada à parte — `77` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(77 - 1) + 7 + 9 = 92`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * É **um** e não dois pela razão de sempre: a rota é `POST`. Com ele a superfície da **fatia inteira**
 * fecha em `92`, que é o número que a §4.1 do tech spec estimava — e a conferência final por dupla
 * medição, com a igualdade entre os dois eixos afirmada, é o `CT-836`, na T14.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T13** da fatia `emissao-e-conciliacao` acrescentou **dois** pares
 * (92 → 94), as rotas `POST /v1/cobrancas/:codigo/emissao-de-boleto` e
 * `POST /v1/cobrancas/:codigo/revogacao-de-boleto`, e a âncora de contagem existe justamente para que
 * esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de
 * conjunto de {@link PARES_DA_FATIA_DE_EMISSAO} nomeia quais são. Nenhum par anterior saiu, e o
 * conjunto **público** continua inalterado: nenhuma rota desta fatia dispensa sessão. A contagem foi
 * **refeita do zero**, e por **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `94`;
 *   * **pela composição da superfície**, contada à parte — `79` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(79 - 1) + 7 + 9 = 94`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não quatro pela razão de sempre: as duas rotas são `POST`. ⚠️ **A fatia inteira
 * fecha em `99/84`**, e as rotas que faltam chegam com a T14 e a T15; a conferência final por dupla
 * medição, com a igualdade entre os dois eixos afirmada, é da **T17**. Aqui as âncoras **sobem**, e
 * não são conferidas contra o número final — é isso que impede a superfície de ser derivada de si
 * mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T14** da mesma fatia acrescentou **dois** pares (94 → 96), as rotas
 * `GET /v1/cobrancas/:codigo/boleto` e `GET /v1/cobrancas/:codigo/historico-bancario`, e a âncora de
 * contagem existe justamente para que esse acréscimo passe pela revisão de quem lê este arquivo em
 * vez de entrar sozinho — a igualdade de conjunto de {@link PARES_DA_FATIA_DE_EMISSAO} nomeia quais
 * são. Nenhum par anterior saiu, e o conjunto **público** continua inalterado: nenhuma rota desta
 * fatia dispensa sessão. A contagem foi **refeita do zero**, e por **duas** medições independentes
 * que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `96`;
 *   * **pela composição da superfície**, contada à parte — `81` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(81 - 1) + 7 + 9 = 96`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não quatro **mesmo sendo as duas `GET`**: o módulo verificado suprime o `HEAD`
 * derivado, e a premissa de que *"cada `GET` entra em dobro"* é falsa nesta base — medida na T12 da
 * fatia anterior. ⚠️ A fatia segue fechando em `99/84`, e as três rotas que faltam chegam com a T15.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T15** da mesma fatia acrescentou **três** pares (96 → 99) — as rotas
 * `POST /v1/cobranca-bancaria/emissoes`, `GET /v1/cobranca-bancaria/emissoes/:id` e
 * `POST /v1/cobranca-bancaria/conferencias`, do controlador novo `CobrancaBancariaController` —, e a
 * âncora de contagem existe justamente para que esse acréscimo passe pela revisão de quem lê este
 * arquivo em vez de entrar sozinho; a igualdade de conjunto de {@link PARES_DA_FATIA_DE_EMISSAO}
 * nomeia quais são. Nenhum par anterior saiu, e o conjunto **público** continua inalterado: nenhuma
 * rota desta fatia dispensa sessão. A contagem foi **refeita do zero**, e por **duas** medições
 * independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `99`;
 *   * **pela composição da superfície**, contada à parte — `84` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(84 - 1) + 7 + 9 = 99`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **três** e não quatro **mesmo havendo um `GET` entre elas**: o módulo verificado suprime o
 * `HEAD` derivado. ⚠️ **Este é o número em que a fatia FECHA** — a §4.1 do tech spec escreve
 * `99/84`, e a conferência final por dupla medição, com a igualdade entre os dois eixos afirmada, é
 * da **T17**. Aqui a âncora **sobe** e é medida por si; ela não é derivada daquele número.
 */
const ROTAS_PUBLICADAS_EM_PRODUCAO = 99;

/**
 * Quantos **manipuladores** de controlador a aplicação de produção monta — a âncora do `CT-355`.
 *
 * Ela conta manipuladores, e não pares método+caminho: um `@All('*')` é UM manipulador que
 * reivindica sete pares, e as rotas registradas direto no adaptador (o contrato publicado) não têm
 * manipulador algum. Por isso este número **não** é `ROTAS_PUBLICADAS_EM_PRODUCAO`, e não deve ser
 * derivado dele.
 *
 * SUT_IS_CORRECT_BECAUSE: o valor é a **expectativa revisada** da superfície que hoje existe, e a
 * soma é `2 + 1 + 1 + 1 + 6 + 7 + 6 = 24`: as **duas** de saúde, o **um** encaminhador de identidade
 * (`@All('*')`, que sozinho reivindica sete pares), a sessão corrente, a troca de senha do produto,
 * as **seis** do operador do SaaS, as **sete** da administração de pessoas e as **seis** de
 * conjunto. As nove do contrato publicado não entram: elas são registradas direto no adaptador e não
 * têm manipulador do arcabouço. Ele é exato
 * pela mesma razão das outras três âncoras deste arquivo: `> 0` fecha o caso degenerado e deixa
 * aberto o intermediário. As tasks seguintes desta fatia já tocam este arquivo para subir
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`, então mantê-lo exato custa zero incremental e compra a mesma
 * revisão forçada.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 acrescentou **seis manipuladores** (24 → 30), um por rota de
 * `/v1/imoveis`, e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 = 30`. O número **não** é
 * derivável de `ROTAS_PUBLICADAS_EM_PRODUCAO`, e a coincidência de as duas terem crescido seis aqui é
 * acidente da forma destas rotas: cada uma tem manipulador próprio e reivindica um par só. Um
 * `@All('*')` acrescentaria um manipulador e sete pares, e derivar um número do outro erraria.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 acrescentou **três manipuladores** (30 → 33) — o `@Post()`, o
 * `@Put(':comodoId')` e o `@Delete(':comodoId')` de `comodo.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 = 33`. A contagem foi **refeita do zero**, por varredura dos
 * decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as duas
 * crescerem três aqui é, de novo, acidente da forma destas rotas — cada manipulador reivindica um
 * par só. `cobertura-de-autorizacao.ts` tem dez decoradores e **não entra**, porque é o módulo de
 * verificação e não a aplicação de produção.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou **dezoito manipuladores** (33 → 51) — seis em cada um de
 * `cadastros/locador.controller.ts`, `cadastros/locatario.controller.ts` e
 * `cadastros/fiador.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 = 51`. A contagem foi **refeita do zero**, por varredura
 * dos decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as
 * duas crescerem dezoito aqui é, de novo, acidente da forma destas rotas — cada manipulador
 * reivindica um par só. `cadastros/superficie-de-cadastro.ts` **não entra**: ele carrega o
 * comportamento das seis operações e não tem decorador de rota algum, que é precisamente o que faz a
 * contagem por manipulador continuar sendo dezoito e não seis.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` acrescentou **seis manipuladores**
 * (51 → 57) — o `@Post()`, o `@Get()`, o `@Get(':codigo')`, o `@Put(':codigo')`, o
 * `@Post(':codigo/retirada')` e o `@Post(':codigo/recirculacao')` de `contratos/contrato.controller.ts`
 * —, e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 6 = 57`. A contagem foi **refeita
 * do zero**, por varredura dos decoradores de rota em `apps/api/src`, e não derivada de
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`: as duas crescerem seis aqui é, de novo, acidente da forma destas
 * rotas — cada manipulador reivindica um par só. O método privado `definirCirculacao` do controlador
 * **não entra**: ele carrega o comportamento comum das duas rotas de circulação e não tem decorador de
 * rota algum.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **um manipulador** (57 → 58) — o
 * `@Post(':codigo/ativacao')` de `contratos/contrato.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 7 = 58`. A contagem foi **refeita do zero**, por varredura
 * dos decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as
 * duas crescerem um aqui é acidente da forma desta rota — ela é `POST`, e por isso reivindica um par
 * só, sem o `HEAD` que todo `GET` acrescenta ao roteador.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 da mesma fatia acrescentou **um manipulador** (58 → 59) — o
 * `@Post(':codigo/cancelamento')` de `contratos/contrato.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 8 = 59`. A contagem foi **refeita do zero**, por
 * varredura dos decoradores de rota em `apps/api/src`, e não derivada de
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`. O manipulador novo importa duplamente para o `CT-355`: ele declara
 * no MÉTODO, e é justamente essa forma que a auditoria de conteúdo examina.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA T8 — MT8-5 (2026-08-09), a ADR-0018 sobre a rota nova
 * ---------------------------------------------------------------------------
 *
 * Aplicado ao `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)` do manipulador de
 * cancelamento, trocado por `@ExigeChave(ACAO_DE_CANCELAMENTO)` — a forma intuitiva e **errada**, em
 * que a declaração do método **substitui** a da classe. Invocado pelo script do pacote
 * (`pnpm --filter @sysloc/api test`); controle: `151 passed`.
 *
 *   * **MT8-5**: `1 failed | 150 passed`, no **`CT-355`**, nomeando o manipulador — *"declaração de
 *     método que SUBSTITUI a da classe: ContratoController.cancelar"*. Os casos **comportamentais**
 *     desta suíte sobreviveriam a ele: `MAPA_ACAO_TELA['ACAO:cancelar_contrato']` **é**
 *     `TELA:contratos`, de modo que a área seria exigida por acidente e nenhum `403` mudaria de
 *     forma. É a prova por **estrutura** que fecha essa direção — e é a razão de este caso existir
 *     ao lado dos que sondam comportamento;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **um manipulador** (59 → 60) — o
 * `@Post(':id/situacao-de-locacao')` de `imoveis/imovel.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 = 60`, com os **sete** de imóvel no lugar dos seis. A
 * contagem foi **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e não
 * derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 8 + 3 + 6 + 7 + 6 + 2 + 7 = 60`. O manipulador novo importa duplamente
 * para o `CT-355` e para o `CT-427`: ele é o único sub-recurso de ato desta base que **não** declara
 * nada no método, e a auditoria de conteúdo tem de continuar verde sobre ele — porque não declarar
 * nada no método é o oposto de declarar **menos** do que a classe.
 *
 * **Este número é o único das duas âncoras que bate com a §11.2 do tech spec** (`51 → 60`), e é ele
 * que localiza o erro do `77` esperado lá na soma do total, e não no escopo entregue — ver a seção
 * correspondente no docblock de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA T10 — MT10-3 (2026-08-09), a falsificação do `CT-427`
 * ---------------------------------------------------------------------------
 *
 * Aplicado ao `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)` do manipulador de
 * cancelamento — uma das **quatro** rotas governadas que o `CT-427` audita —, trocado por
 * `@ExigeChave(ACAO_DE_CANCELAMENTO)`: a forma intuitiva e **errada**, em que a declaração do método
 * **substitui** a da classe. Invocado pelo script do pacote (`pnpm --filter @sysloc/api test`);
 * controle: `155 passed`.
 *
 *   * **MT10-3**: `2 failed | 153 passed`, e os dois casos falham por **eixos diferentes** — o
 *     `CT-355` acusa o manipulador **pelo nome** (*"declaração de método que SUBSTITUI a da classe:
 *     ContratoController.cancelar"*, com `daClasse: ['TELA:contratos']` e
 *     `doMetodo: ['ACAO:cancelar_contrato']` no diff), e o `CT-427` reprova na igualdade de **array**
 *     da conjunção: `expected [ 'ACAO:cancelar_contrato' ] to deeply equal [ 'TELA:contratos', …(1) ]`.
 *     A divisão de trabalho entre os dois é a razão de o `CT-427` existir ao lado do `CT-355`: aquele
 *     responde *"o método declara MENOS do que a classe?"* e este responde *"o que exatamente cada uma
 *     das quatro declara, e em que ordem?"* — e a ordem, que decide qual chave a recusa nomeia, é
 *     invisível para o primeiro. Os casos **comportamentais** sobreviveriam ao mutante:
 *     `MAPA_ACAO_TELA['ACAO:cancelar_contrato']` **é** `TELA:contratos`, de modo que a área seria
 *     exigida por acidente e nenhum `403` mudaria de forma;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `155 passed`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` acrescentou **três manipuladores**
 * (60 → 63) — o `@Post()`, o `@Get()` e o `@Get(':codigo')` de `cobrancas/cobranca.controller.ts` —,
 * e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 + 3 = 63`. A contagem foi
 * **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 3 + 8 + 3 + 6 + 7 + 6 + 2 + 7 = 63`. As duas terem crescido três aqui é,
 * de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD` que o
 * adaptador deriva dos dois `GET` não é entrada própria nem manipulador. `cobrancas/cobranca.service.ts`
 * **não entra**: ele carrega a regra de aplicação das três rotas e não tem decorador de rota algum.
 *
 * Os três importam para o `CT-355` pelo lado oposto ao dos manipuladores de contrato: eles **não**
 * declaram nada no método, e a auditoria de conteúdo tem de continuar verde sobre eles — porque não
 * declarar nada no método é o oposto de declarar **menos** do que a classe.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **dois manipuladores** (63 → 65) — o
 * `@Get()` e o `@Put()` de `mora/mora.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 + 3 + 2 = 65`. A contagem foi **refeita do zero**, por
 * varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 3 + 8 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 65`. As duas terem crescido dois aqui
 * é, de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD` que
 * o adaptador deriva do `GET` não é entrada própria nem manipulador. `mora/mora.service.ts` **não
 * entra**: ele carrega a regra de aplicação das duas rotas e não tem decorador de rota algum.
 *
 * Os dois importam para o `CT-355` pelo mesmo lado dos três de cobrança: eles **não** declaram nada
 * no método, e a auditoria de conteúdo tem de continuar verde sobre eles.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **dois manipuladores** (65 → 67) — o
 * `@Post(':codigo/pagamento')` e o `@Post(':codigo/cancelamento')` de
 * `cobrancas/cobranca.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 18 + 8 + 3 + 2 = 67`. A contagem foi **refeita do zero**, por
 * varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 5 + 8 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 67`. As duas terem crescido dois aqui
 * é, de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e nenhuma das
 * duas é `GET`, de modo que `HEAD` derivado não participa.
 *
 * Os dois importam para o `CT-355` pelo mesmo lado dos três de cobrança e dos dois de mora: eles
 * **não** declaram nada no método, e a auditoria de conteúdo tem de continuar verde sobre eles — que é
 * o oposto de declarar **menos** do que a classe, e é o desfecho que a §11.2 exige das duas transições.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da fatia `regua-de-cobranca` acrescentou **dois manipuladores**
 * (67 → 69) — o `@Get()` e o `@Put()` de `automacao/automacao.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 18 + 8 + 3 + 2 + 2 = 69`. A contagem foi **refeita do zero**,
 * por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 2 + 6 + 6 + 6 + 5 + 8 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 69`. As duas terem crescido dois
 * aqui é, de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD`
 * que o adaptador deriva do `GET` não é entrada própria nem manipulador.
 * `automacao/automacao.service.ts` **não entra**: ele carrega a regra de aplicação das duas rotas e
 * não tem decorador de rota algum.
 *
 * Os dois importam para o `CT-355` pelo mesmo lado dos dois de mora: eles **não** declaram nada no
 * método, e a auditoria de conteúdo tem de continuar verde sobre eles. Quem vai declarar no método
 * nesta fatia é o disparo manual da T10, com a **conjunção inteira** — e é lá que a auditoria de
 * conteúdo passa a ter o que examinar nesta classe.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **dois manipuladores** (69 → 71) — o
 * `@Get('cobrancas/:codigo/avisos')` e o `@Post(...)` do mesmo controlador —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 18 + 8 + 3 + 2 + 4 = 71`. A contagem foi **refeita do zero**,
 * por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 4 + 6 + 6 + 6 + 5 + 8 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 71`. As duas terem crescido dois
 * aqui é, de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD`
 * que o adaptador deriva do `GET` não é entrada própria nem manipulador.
 *
 * ⚠️ **Este é o primeiro manipulador desta fatia que declara no MÉTODO**, e é por isso que ele muda o
 * que o `CT-355` tem a examinar: o `POST` do disparo declara `@ExigeChaves(área, ação)` — a conjunção
 * **inteira** —, de modo que a declaração dele **contém** a da classe em vez de substituí-la. Uma
 * declaração só com a ação faria o manipulador exigir **menos** que a classe dele, e é exatamente
 * isso que aquele caso reprova por conteúdo.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da fatia `documentos-e-confirmacao` acrescentou **um manipulador**
 * (71 → 72) — o `@Get(':codigo/documento')` de `contratos/contrato.controller.ts` —, e a soma passa a
 * ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 18 + 9 + 3 + 2 + 4 = 72`, com os **nove** de contrato no
 * lugar dos oito. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por
 * arquivo, `1 + 1 + 1 + 4 + 6 + 6 + 6 + 5 + 9 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 72`. As duas terem
 * crescido um aqui é acidente da forma desta rota — ela é um `GET` de manipulador próprio, e o `HEAD`
 * que o adaptador dela deriva não é entrada própria nem manipulador.
 *
 * ⚠️ **Ele importa para o `CT-355` pelo lado OPOSTO ao do disparo manual da T10**: o manipulador do
 * documento **não** declara nada no método, de propósito, e a auditoria de conteúdo tem de continuar
 * verde sobre ele — porque não declarar nada é o oposto de declarar **menos** do que a classe. A
 * exigência de `TELA:contratos` vem da classe, e uma `@ExigeChave` acrescentada ao método por "clareza"
 * seria substituição, não união (ADR-0018). O `CT-355` é a rede que acusa a forma errada.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T9** da mesma fatia acrescentou **um manipulador** (72 → 73) — o
 * `@Post(':id/confirmacao-de-email')` de `cadastros/locatario.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 = 73`, com os **dezenove** dos três papéis
 * de cadastro no lugar dos dezoito. A contagem foi **refeita do zero**, por varredura dos decoradores
 * de rota em `apps/api/src`, e **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura
 * devolve, por arquivo, `1 + 1 + 1 + 4 + 6 + 6 + 7 + 5 + 9 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 73`, com o
 * `7` do controlador de locatário no lugar do `6`.
 *
 * ⚠️ **Ele importa para o `CT-355` pelo mesmo lado do manipulador do documento, e não pelo do disparo
 * manual da T10**: ele **não** declara nada no método, de propósito, e a auditoria de conteúdo tem de
 * continuar verde sobre ele. Aqui a ausência é mais carregada do que lá — nesta classe, declarar
 * `@ExigeChave(AREA_DO_CADASTRO)` no método seria substituição **invisível por comportamento**,
 * porque a área da classe é exatamente `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, e nenhuma prova
 * comportamental a apanharia. O `CT-355` é a única rede que apanha, e ele apanha por estrutura.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da mesma fatia acrescentou **um manipulador** (73 → 74) — o
 * `@Post()` de `confirmacoes/confirmacao.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 + 1 = 74`, com o `1` do controlador novo no
 * fim. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e
 * **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 4 + 6 + 6 + 7 + 5 + 9 + 3 + 6 + 7 + 6 + 2 + 2 + 7 + 1 = 74`.
 *
 * ⚠️ **Ele importa para o `CT-355` por um terceiro lado, e o caso continua verde sobre ele**: o
 * manipulador não declara exigência **e a classe dele também não** — ele é `@RotaPublica()`. Não há
 * declaração de método substituindo declaração de classe, porque não há nenhuma das duas; e a rota
 * **não** cai em `semDeclaracao`, porque a marca de rota pública É a declaração dela (ADR-0011). As
 * duas propriedades são medidas por mecanismos diferentes, e as duas continuam afirmadas.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `fundacao-bancaria` acrescentou **dois manipuladores**
 * (74 → 76) — o `@Post('certificados')` e o `@Get('certificado')` de
 * `integracoes-bancarias/certificado.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 + 1 + 2 = 76`, com o `2` do controlador
 * novo no fim. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve,
 * por arquivo, `1 + 1 + 1 + 4 + 6 + 6 + 7 + 5 + 9 + 3 + 6 + 7 + 6 + 2 + 2 + 7 + 1 + 2 = 76`.
 *
 * ⚠️ **Ele importa para o `CT-355` pelos DOIS lados de uma vez, e é o primeiro manipulador desta
 * fatia a fazê-lo**: o `@Get` da consulta não declara nada no método, e o caso tem de continuar verde
 * sobre ele — não declarar nada é o oposto de declarar **menos** que a classe; o `@Post` do registro
 * declara a **conjunção inteira** no método, de modo que a declaração dele **contém** a da classe em
 * vez de substituí-la. Uma declaração só com a ação faria o manipulador mais sensível da superfície —
 * aquele cujo corpo carrega o material do certificado — exigir menos que a classe dele, e é
 * exatamente isso que aquele caso reprova por conteúdo.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T12** da mesma fatia acrescentou **um manipulador** (76 → 77) — o
 * `@Post('certificado/verificacao')` de `integracoes-bancarias/certificado.controller.ts` —, e a soma
 * passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 + 1 + 3 = 77`, com o `3` do
 * controlador daquela área no fim. A contagem foi **refeita do zero**, por varredura dos decoradores
 * de rota em `apps/api/src`, e **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura
 * devolve, por arquivo, `1 + 1 + 1 + 4 + 6 + 6 + 7 + 5 + 9 + 3 + 6 + 7 + 6 + 2 + 2 + 7 + 1 + 3 = 77`.
 *
 * ⚠️ **Ele importa para o `CT-355` pelo lado que a T11 deixou nomeado**: o manipulador **não declara
 * nada no método**, e o caso tem de continuar verde sobre ele — não declarar nada é o oposto de
 * declarar **menos** que a classe. A ausência é decisão registrada, e não esquecimento: a verificação
 * não transfere direito, não move dinheiro e não altera o que outra entidade pode fazer (RN-06), de
 * modo que a área basta e a ação sensível continua governando **só** o registro. A norma é a
 * **ADR-0011** com a **ADR-0018**, e não a ADR-0021: a `Decision` desta tem por sujeito *"toda
 * transição de estado de entidade de negócio"*, e a verificação não é uma — ela entra por **analogia
 * de critério** (a mesma régua de natureza do ato), nunca como cláusula governante.
 */
/**
 * SUT_IS_CORRECT_BECAUSE: a **T13** da fatia `emissao-e-conciliacao` acrescentou **dois
 * manipuladores** (77 → 79) — `emitirBoleto` e `revogarBoleto`, os dois em
 * `cobrancas/cobranca.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 + 1 + 3 + 2 = 79`. A contagem foi **refeita
 * do zero**, por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: o controlador de cobrança passou de cinco para sete
 * decoradores, e nenhum outro arquivo mudou.
 *
 * ⚠️ **Os dois importam para o `CT-355` pelo lado mais perigoso**: eles declaram no método, e o que
 * declaram é a **conjunção inteira** (`@ExigeChaves(AREA_DO_FINANCEIRO, ACAO_…)`), de modo que a
 * declaração deles **contém** a da classe em vez de substituí-la. Uma declaração só com a ação faria
 * as duas rotas que **movem dinheiro** exigirem menos que a classe delas — e a coerência do catálogo
 * esconderia o defeito na borda, porque `MAPA_ACAO_TELA` das duas ações é a própria
 * `TELA:financeiro`, de modo que a rota continuaria exigindo-a por acidente. É exatamente isso que
 * aquele caso reprova por conteúdo.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T14** da mesma fatia acrescentou **dois manipuladores** (79 → 81) —
 * `boleto` e `historicoBancario`, os dois no MESMO `cobrancas/cobranca.controller.ts` —, e a soma
 * passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 5 + 19 + 9 + 3 + 2 + 4 + 1 + 3 + 2 + 2 = 81`. A
 * contagem foi **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e
 * **não** derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: o controlador de cobrança passou de sete
 * para nove decoradores, e nenhum outro arquivo mudou.
 *
 * ⚠️ **Os dois importam para o `CT-355` pelo lado OPOSTO ao dos atos**: eles **nada declaram no
 * método**, e a ausência é decisão — são leitura, e a ADR-0021 governa transição de estado. Por isso
 * a exigência efetiva deles é a da classe, e uma linha "óbvia" que declarasse `TELA:financeiro` no
 * método instalaria um segundo lugar por onde a área pode sumir em silêncio. O `CT-918 (f)` afirma o
 * retrato das duas por igualdade de objeto, com a **origem** junto.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T15** da mesma fatia acrescentou **três manipuladores** (81 → 84) —
 * `abrirEmissao`, `lerEmissao` e `dispararConferencia`, os três em
 * `cobranca-bancaria/cobranca-bancaria.controller.ts`, que é arquivo **novo**. A contagem foi
 * **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 4 + 6 + 6 + 7 + 3 + 9 + 1 + 9 + 3 + 6 + 7 + 3 + 6 + 2 + 2 + 7 = 84`. As duas terem
 * crescido três aqui é acidente da forma destas rotas — cada manipulador reivindica um par só, e
 * nenhuma delas é `@All`.
 *
 * ⚠️ **Os três importam para o `CT-355` pelas DUAS formas ao mesmo tempo**, o que é raro: o
 * `abrirEmissao` declara no método a **conjunção inteira** (`@ExigeChaves(AREA_DO_FINANCEIRO,
 * ACAO_DE_EMISSAO_DE_BOLETO)`), de modo que a declaração dele **contém** a da classe em vez de
 * substituí-la; os outros dois **nada declaram**, e a ausência é decisão — o `GET` é leitura, e a
 * conferência é a segunda classe da ADR-0021, cujo único desfecho gravado é *acusar pagamento*. Uma
 * declaração só com a ação no primeiro faria a rota que **move dinheiro** exigir menos que a classe
 * dela, e a coerência do catálogo esconderia o defeito, porque `MAPA_ACAO_TELA['ACAO:emitir_boleto']`
 * **é** a própria `TELA:financeiro`.
 */
const MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 84;

/**
 * Quantos manipuladores da aplicação de produção atendem **todos** os verbos (`@All`) — hoje um só, o
 * encaminhador de identidade.
 *
 * É o fator que liga as duas medições da superfície no `CT-533`, e por isso ele é **afirmado** junto
 * com elas em vez de suposto: um manipulador `@All` novo acrescentaria **sete** pares e um só
 * manipulador, e a composição que trata todo manipulador como um par erraria o total por seis sem que
 * nada dissesse por quê.
 */
const MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS = 1;

/** Quantos pares a fatia `cobranca-e-mora` publica — cinco de cobrança e dois de mora (§3.1 da T11). */
const PARES_PUBLICADOS_PELA_FATIA_DE_COBRANCA = 7;

/** O prefixo que separa o eixo das ações sensíveis do das áreas de tela, na chave do catálogo. */
const PREFIXO_DA_CHAVE_DE_ACAO = 'ACAO:';

/**
 * As duas áreas de tela que governam a superfície da fatia `cobranca-e-mora` (§3.1 da T11).
 *
 * Literais escritos à mão, e **não** importados de `cobranca.controller.ts` nem de
 * `mora.controller.ts`: as duas constantes de lá são privadas de propósito, e derivá-las da mesma
 * fonte que o SUT usa para declarar faria a asserção do `CT-533` concordar consigo mesma — trocar a
 * área do controlador deixaria de reprovar caso algum. Elas são o valor que o cliente lê em
 * `detalhes.exigido`, e por isso a expectativa é escrita, não derivada.
 */
const AREA_DO_FINANCEIRO = 'TELA:financeiro';
const AREA_DE_MULTA_E_JUROS = 'TELA:multa_e_juros';

/**
 * A exigência **efetiva** devida por cada um dos sete manipuladores da fatia — o que o `CT-533`
 * audita por igualdade de OBJETO.
 *
 * O rótulo é `Controlador.manipulador`, o mesmo que o `CT-355` e o `CT-427` já usam, e o valor é a
 * lista de átomos que `getAllAndOverride([alvo, classe])` — a MESMA chamada da guarda — devolve. As
 * cinco de cobrança exigem exatamente `TELA:financeiro` e as duas de mora exatamente
 * `TELA:multa_e_juros`, cada uma com **um** átomo e nenhuma chave de ação.
 *
 * **A ausência de chave `ACAO:` nas sete é decisão escalada e confirmada antes da spec**, e a
 * evidência é o catálogo fechado: a `Decision` da **ADR-0021** nomeia *"acusar pagamento de cobrança"*
 * e *"cancelar cobrança"* entre as instâncias da classe que exige **apenas a área**, e
 * `MAPA_ACAO_TELA` não tem ação alguma para lançar, ler, pagar ou cancelar cobrança — nem qualquer
 * ação dentro de `TELA:multa_e_juros`. Este mapa é a rede que impede uma rodada futura de acrescentar
 * uma chave sem passar pela mesma escalada.
 *
 * Ele é **um objeto**, e não sete asserções soltas: uma exigência que sumisse de um manipulador
 * reprovaria com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente — as
 * duas direções, numa comparação só.
 */
const EXIGENCIA_DEVIDA_POR_MANIPULADOR: Readonly<Record<string, readonly string[]>> = {
  'CobrancaController.criar': [AREA_DO_FINANCEIRO],
  'CobrancaController.listar': [AREA_DO_FINANCEIRO],
  'CobrancaController.ler': [AREA_DO_FINANCEIRO],
  'CobrancaController.acusarPagamento': [AREA_DO_FINANCEIRO],
  'CobrancaController.cancelar': [AREA_DO_FINANCEIRO],
  'MoraController.ler': [AREA_DE_MULTA_E_JUROS],
  'MoraController.definir': [AREA_DE_MULTA_E_JUROS],
};

/** Os sete manipuladores auditados, derivados do mapa acima — a ordem é a de inserção dele. */
const MANIPULADORES_DA_FATIA: readonly string[] = Object.keys(EXIGENCIA_DEVIDA_POR_MANIPULADOR);

/**
 * As **10 áreas de tela** do catálogo fechado, na ordem em que ele as enumera (RN-15, ADR-0011).
 *
 * Escritas à mão pela mesma razão das duas áreas acima: a asserção do `CT-533` é *"o catálogo continua
 * com as mesmas chaves da fatia anterior"*, e derivá-la de `CHAVES_DE_TELA` a faria concordar consigo
 * mesma — uma área nova entraria nos dois lados ao mesmo tempo. É por igualdade de **arranjo**, e não
 * de conjunto: a ordem é a da decisão 38 do `plano-saas.md`, e o catálogo é congelado, não ordenado.
 */
const AREAS_DE_TELA_DO_CATALOGO: readonly string[] = [
  'TELA:resumo',
  'TELA:imoveis',
  'TELA:contratos',
  'TELA:cadastros',
  'TELA:financeiro',
  'TELA:automacao_de_cobranca',
  'TELA:integracoes_bancarias',
  'TELA:multa_e_juros',
  'TELA:relatorios',
  'TELA:usuarios',
];

/**
 * As ações sensíveis que o catálogo fechado enumera **dentro de `TELA:financeiro`** — as duas que
 * falam com o banco, e nenhuma para lançar, ler, pagar ou cancelar cobrança.
 *
 * É a evidência literal que a emenda de 2026-08-10 da **ADR-0021** cita para sustentar as duas
 * instâncias novas da segunda classe. Em ordem alfabética, que é a do acessório que as extrai.
 */
const ACOES_SENSIVEIS_DO_FINANCEIRO: readonly string[] = [
  'ACAO:emitir_boleto',
  'ACAO:solicitar_baixa_de_boleto',
];

/** Quantos pares a fatia `regua-de-cobranca` publica — as quatro da automação (§4.1 da tech spec). */
const PARES_PUBLICADOS_PELA_FATIA_DA_REGUA = 4;

/**
 * A área de tela e a ação sensível que governam a superfície da fatia `regua-de-cobranca` (§4.1,
 * §11.2 da tech spec).
 *
 * Literais escritos à mão, e **não** importados de `automacao.controller.ts`: as duas constantes de
 * lá são privadas de propósito, e derivá-las da mesma fonte que o SUT usa para declarar faria a
 * asserção do `CT-635` concordar consigo mesma — trocar a área ou a ação do controlador deixaria de
 * reprovar caso algum. Elas são o valor que o cliente lê em `detalhes.exigido`, e por isso a
 * expectativa é escrita, não derivada. É a mesma escolha, e a mesma razão, de
 * {@link AREA_DO_FINANCEIRO}.
 */
const AREA_DA_AUTOMACAO_DE_COBRANCA = 'TELA:automacao_de_cobranca';
const ACAO_DE_ENVIO_MANUAL = 'ACAO:enviar_cobranca_manual';

/**
 * As ações sensíveis que o catálogo fechado enumera **dentro de `TELA:automacao_de_cobranca`** — uma
 * só, a do disparo manual.
 *
 * É a metade executável do critério *"nenhuma chave nasceu no catálogo por esta fatia"*: uma ação
 * nova naquela área — a saída curta para uma rodada que quisesse governar o histórico ou a
 * configuração por chave própria — reprova aqui, nomeando-a.
 */
const ACOES_SENSIVEIS_DA_AUTOMACAO: readonly string[] = [ACAO_DE_ENVIO_MANUAL];

/**
 * O retrato da exigência de um manipulador: **onde** a declaração vive e **o que** ela impõe.
 *
 * As duas metades viajam juntas porque nenhuma basta. O valor é sempre a exigência **efetiva** — a
 * que `getAllAndOverride([alvo, classe])` devolve, que é a mesma chamada da guarda —, e a chave diz
 * de onde ela veio: `classe` quando o manipulador não declara nada próprio, `metodo` quando declara.
 *
 * Sem a origem, uma conjunção declarada no método com os mesmos átomos da classe seria
 * indistinguível da herança — e é justamente essa distinção que a **ADR-0018** torna conteúdo, porque
 * `getAllAndOverride` **substitui**: o dia em que a área sair da classe e passar a viver em três
 * métodos, o quarto passa a não exigir nada e nada na igualdade dos átomos diria isso.
 */
type RetratoDaExigencia =
  | { readonly classe: readonly string[] }
  | { readonly metodo: readonly string[] };

/**
 * O retrato devido por cada um dos quatro manipuladores da fatia — o que o `CT-635` audita por
 * igualdade de OBJETO.
 *
 * O rótulo é `Controlador.manipulador`, o mesmo que o `CT-355`, o `CT-427` e o `CT-533` já usam.
 *
 * **Três exigem só a área, pela declaração da CLASSE, e o quarto declara a CONJUNÇÃO INTEIRA no
 * MÉTODO** — e a assimetria é a decisão registrada na §11.2 da tech spec: ler e definir a régua da
 * própria imobiliária são atos operacionais do cadastro, consultar o histórico não é ato sensível
 * (RN-12), e o **disparo** é o único que fala com o mundo em nome da empresa. A ordem dentro da
 * conjunção é conteúdo: a recusa nomeia a **PRIMEIRA** chave ausente, e a área vem antes para que
 * quem já a tem ouça o nome do que lhe falta (ADR-0018).
 *
 * ⚠️ **Declarar só a ação no `POST` é o defeito que este mapa fecha**, e ele é invisível para uma
 * igualdade de átomos que ignorasse a origem: `MAPA_ACAO_TELA['ACAO:enviar_cobranca_manual']` **é**
 * `TELA:automacao_de_cobranca`, de modo que a área seria exigida por coerência de catálogo e
 * nenhuma recusa mudaria de forma na borda. Quem o acusa por estrutura é o `CT-355`, e este caso o
 * acusa por conteúdo, com o rótulo nomeado.
 *
 * Ele é **um objeto**, e não quatro asserções soltas: uma exigência que sumisse de um manipulador
 * reprovaria com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente — as
 * duas direções, numa comparação só.
 */
const RETRATO_DEVIDO_POR_MANIPULADOR_DA_REGUA: Readonly<Record<string, RetratoDaExigencia>> = {
  'AutomacaoDeCobrancaController.lerPolitica': { classe: [AREA_DA_AUTOMACAO_DE_COBRANCA] },
  'AutomacaoDeCobrancaController.definirPolitica': { classe: [AREA_DA_AUTOMACAO_DE_COBRANCA] },
  'AutomacaoDeCobrancaController.lerHistorico': { classe: [AREA_DA_AUTOMACAO_DE_COBRANCA] },
  'AutomacaoDeCobrancaController.dispararAviso': {
    metodo: [AREA_DA_AUTOMACAO_DE_COBRANCA, ACAO_DE_ENVIO_MANUAL],
  },
};

/** Os quatro manipuladores auditados, derivados do mapa acima — a ordem é a de inserção dele. */
const MANIPULADORES_DA_REGUA: readonly string[] = Object.keys(
  RETRATO_DEVIDO_POR_MANIPULADOR_DA_REGUA,
);

/**
 * Quantos pares a sub-fatia `documentos-e-confirmacao` publica — os **três** da §4.1 da tech spec.
 *
 * Ele é a **sanidade do inventário**, e é conferido antes de qualquer comparação com a superfície:
 * dois pares governados ({@link PARES_DA_FATIA_DE_DOCUMENTOS}) mais o do ato do titular
 * ({@link paresDoAtoDoTitular}), que vive no conjunto público. A soma é afirmada contra este número
 * porque as duas listas moram em lugares diferentes de propósito — uma no eixo positivo, outra no
 * público —, e uma delas encolher em silêncio deixaria as igualdades de baixo passando sobre menos
 * rotas do que a sub-fatia entregou.
 */
const PARES_PUBLICADOS_PELA_SUB_FATIA_DE_DOCUMENTOS = 3;

/**
 * Quantos pares dispensavam sessão **antes** da sub-fatia `documentos-e-confirmacao` — os nove do
 * contrato publicado, os dois de saúde e os sete do encaminhador de identidade.
 *
 * É a âncora que transforma *"o conjunto público cresceu"* em *"cresceu **exatamente um**"*. Sem ela,
 * uma rota nova acrescentada ao inventário escrito à mão **e** publicada como `@RotaPublica()`
 * satisfaria a igualdade do `CT-213` nos dois lados ao mesmo tempo — que é o modo de falha que a
 * ADR-0027 mais precisa fechar, porque a marca de rota pública tira a rota da autorização inteira.
 * É a mesma técnica do delta do `CT-318`: afirmar o crescimento **além** do total.
 */
const PARES_PUBLICOS_ANTES_DA_SUB_FATIA = 18;

/** Quantos pares a sub-fatia acrescenta ao conjunto público — um, o ato do titular (ADR-0027). */
const PARES_PUBLICOS_DA_SUB_FATIA = 1;

/**
 * As duas áreas de tela que governam a superfície governada da sub-fatia `documentos-e-confirmacao`
 * (§4.1 e §11.2 da tech spec).
 *
 * Literais escritos à mão, e **não** importados dos controladores: derivá-los da mesma fonte que o
 * SUT usa para declarar faria a asserção do `CT-732` concordar consigo mesma — trocar a área do
 * controlador deixaria de reprovar caso algum. É a mesma escolha, e a mesma razão, de
 * {@link AREA_DO_FINANCEIRO} e de {@link AREA_DA_AUTOMACAO_DE_COBRANCA}.
 */
const AREA_DOS_CONTRATOS = 'TELA:contratos';
const AREA_DOS_CADASTROS = 'TELA:cadastros';

/**
 * O retrato devido pelos **dois** manipuladores governados da sub-fatia — o que o `CT-732` audita por
 * igualdade de OBJETO.
 *
 * O rótulo é `Controlador.manipulador`, o mesmo que o `CT-355`, o `CT-427`, o `CT-533` e o `CT-635`
 * já usam.
 *
 * **Os dois exigem só a área, pela declaração da CLASSE**, e a assimetria com a régua é a decisão
 * registrada na §4.1 da tech spec: baixar o documento é **leitura** do que `TELA:contratos` já dá, e
 * reenviar a confirmação é o mesmo ato de cadastro que `TELA:cadastros` já governa — o catálogo 10×7
 * permanece fechado (RN-13), e `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado por
 * task alguma desta sub-fatia**.
 *
 * ⚠️ **Declarar a área no MÉTODO é o defeito que este mapa fecha**, e ele é invisível por
 * comportamento nas duas rotas: `getAllAndOverride` **substitui**, de modo que uma `@ExigeChave` no
 * método — mesmo repetindo a área da classe — trocaria a herança por uma cópia dela, e a recusa na
 * borda continuaria idêntica. No reenvio o disfarce é ainda mais completo, porque `TELA:cadastros` é
 * exatamente `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`. Quem o acusa por estrutura é o `CT-355`, e
 * este caso o acusa por conteúdo, com a **origem** da declaração junto do valor.
 */
const RETRATO_DEVIDO_POR_MANIPULADOR_DOS_DOCUMENTOS: Readonly<Record<string, RetratoDaExigencia>> =
  {
    'ContratoController.documento': { classe: [AREA_DOS_CONTRATOS] },
    'LocatarioController.reenviarConfirmacao': { classe: [AREA_DOS_CADASTROS] },
  };

/** Os dois manipuladores governados auditados, derivados do mapa acima — na ordem de inserção. */
const MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS: readonly string[] = Object.keys(
  RETRATO_DEVIDO_POR_MANIPULADOR_DOS_DOCUMENTOS,
);

/**
 * O manipulador do **ato do titular** — a única rota de negócio do produto que dispensa sessão.
 *
 * Ele não entra em {@link RETRATO_DEVIDO_POR_MANIPULADOR_DOS_DOCUMENTOS} porque não tem retrato a
 * exibir: não declara exigência no método **nem na classe**, e a autorização dele é o portador de
 * segredo que a ADR-0027 exige no lugar da sessão. O `CT-732` afirma essa ausência **pelo erro que a
 * leitura levanta**, e não por um arranjo vazio — vazio se confundiria com `@NaoExigePermissao()`,
 * que declara e não exige nada.
 */
const MANIPULADOR_DO_ATO_DO_TITULAR = 'ConfirmacaoController.confirmar';

/**
 * A mensagem que {@link exigenciaEfetivaDoManipulador} levanta para um manipulador sem exigência
 * alguma.
 *
 * Escrita por extenso e não derivada da função: é ela que discrimina *"a rota não exige chave"* de
 * *"o rótulo não existe na varredura"*, e as duas produziriam falha se a asserção olhasse apenas
 * *"levantou"*. A outra mensagem daquela função nomeia o rótulo não encontrado, e um erro de
 * digitação no rótulo passaria por um `expect(...).toThrow()` genérico.
 */
const SEM_EXIGENCIA_NEM_NO_METODO_NEM_NA_CLASSE =
  'não declara exigência alguma, nem no método nem na classe';

/**
 * As ações sensíveis que o catálogo fechado enumera dentro das duas áreas desta sub-fatia — duas em
 * `TELA:contratos` e uma em `TELA:cadastros`, todas anteriores a ela.
 *
 * É a metade executável do critério *"nenhuma chave nasceu no catálogo por esta sub-fatia"*: uma ação
 * nova em qualquer das duas áreas — a saída curta para uma rodada que quisesse governar o download do
 * documento ou o reenvio por chave própria — reprova aqui, nomeando-a. Em ordem alfabética, que é a
 * do acessório que as extrai.
 */
const ACOES_SENSIVEIS_DOS_CONTRATOS: readonly string[] = [
  'ACAO:ativar_contrato',
  'ACAO:cancelar_contrato',
];
const ACOES_SENSIVEIS_DOS_CADASTROS: readonly string[] = ['ACAO:excluir_cadastro'];

/**
 * Quantos pares a fatia `fundacao-bancaria` publica — os **três** da §4.1 do tech spec dela.
 *
 * Ele é a **sanidade do inventário**, e é conferido antes de qualquer comparação com a superfície: os
 * três moram todos no eixo POSITIVO — esta fatia não publica rota sem sessão —, e uma lista truncada
 * faria as igualdades de baixo passarem sobre menos rotas do que a fatia entregou, que é o modo de
 * falha silencioso desta classe.
 *
 * São **três** e não quatro: só um dos três pares é `GET`, e o `HEAD` que o adaptador deriva dele é
 * suprimido pelo módulo verificado. A premissa de que *"cada `GET` entra em dobro"* é falsa nesta
 * base — ver o cabeçalho.
 */
const PARES_PUBLICADOS_PELA_FATIA_BANCARIA = 3;

/**
 * Quantos pares dispensam sessão na superfície de hoje — os nove do contrato publicado, os dois de
 * saúde, os sete do encaminhador de identidade e o ato do titular da sub-fatia anterior.
 *
 * É a âncora que transforma *"nenhuma rota desta fatia é pública"* em *"o conjunto público não mudou
 * de tamanho"*. Sem ela, uma rota desta fatia marcada `@RotaPublica()` **e** retirada do inventário
 * positivo satisfaria os dois filtros ao mesmo tempo; só a contagem a pega. É a mesma técnica do
 * delta do `CT-318` e do crescimento afirmado pelo `CT-732`, aplicada a um crescimento de **zero** —
 * que é justamente o que esta fatia deve produzir aqui.
 */
const PARES_PUBLICOS_DA_SUPERFICIE = 19;

/**
 * A área de tela e a ação sensível que governam a superfície da fatia `fundacao-bancaria` (§11.2 do
 * tech spec dela).
 *
 * Literais escritos à mão, e **não** importados do controlador: derivá-los da mesma fonte que o SUT
 * usa para declarar faria a asserção do `CT-836` concordar consigo mesma — trocar a área ou a ação no
 * controlador deixaria de reprovar caso algum. É a mesma escolha, e a mesma razão, de
 * {@link AREA_DO_FINANCEIRO}, de {@link AREA_DA_AUTOMACAO_DE_COBRANCA} e de {@link AREA_DOS_CONTRATOS}.
 */
const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias';
const ACAO_DE_CONFIGURACAO_DE_INTEGRACAO = 'ACAO:configurar_integracao';

/**
 * O retrato devido pelos **três** manipuladores da fatia — o que o `CT-836` audita por igualdade de
 * OBJETO.
 *
 * O rótulo é `Controlador.manipulador`, o mesmo que o `CT-355`, o `CT-427`, o `CT-533`, o `CT-635` e
 * o `CT-732` já usam.
 *
 * **Dois exigem só a área, pela declaração da CLASSE, e o terceiro declara a CONJUNÇÃO INTEIRA no
 * MÉTODO** — e a assimetria é a decisão registrada na §11.2 do tech spec, com a **RN-06**
 * classificando o ato: consultar qual certificado está valendo é leitura que a área já dá, e a
 * verificação alcança um terceiro sem transferir direito, mover dinheiro ou alterar o que outra
 * entidade pode fazer. O **registro** troca a identidade com que a empresa cobra, e é o ato sensível
 * desta superfície. Quem governa é a **ADR-0011** com a **ADR-0018**; a ADR-0021 entra só como
 * analogia de critério, nunca como cláusula governante — a `Decision` dela tem por sujeito *"toda
 * transição de estado de entidade de negócio"*, e nenhuma das três rotas é uma.
 *
 * A ordem dentro da conjunção é conteúdo: a recusa nomeia a **PRIMEIRA** chave ausente, e a área vem
 * antes para que quem já a tem ouça o nome do que lhe falta (ADR-0018) — é o que o `CT-837` afirma na
 * borda, com `detalhes.exigido`.
 *
 * ⚠️ **Declarar só a ação no `POST` do registro é o defeito que este mapa fecha**, e ele é invisível
 * para uma igualdade de átomos que ignorasse a origem: `MAPA_ACAO_TELA['ACAO:configurar_integracao']`
 * **é** `TELA:integracoes_bancarias`, de modo que a área seria exigida por coerência de catálogo e
 * nenhuma recusa mudaria de forma na borda. Quem o acusa por estrutura é o `CT-355`, e este caso o
 * acusa por conteúdo, com o rótulo nomeado.
 *
 * Ele é **um objeto**, e não três asserções soltas: uma exigência que sumisse de um manipulador
 * reprovaria com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente — as
 * duas direções, numa comparação só.
 */
const RETRATO_DEVIDO_POR_MANIPULADOR_BANCARIO: Readonly<Record<string, RetratoDaExigencia>> = {
  'CertificadoDoProvedorController.registrar': {
    metodo: [AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO_DE_INTEGRACAO],
  },
  'CertificadoDoProvedorController.consultar': { classe: [AREA_DAS_INTEGRACOES_BANCARIAS] },
  'CertificadoDoProvedorController.verificar': { classe: [AREA_DAS_INTEGRACOES_BANCARIAS] },
};

/** Os três manipuladores auditados, derivados do mapa acima — a ordem é a de inserção dele. */
const MANIPULADORES_DA_FATIA_BANCARIA: readonly string[] = Object.keys(
  RETRATO_DEVIDO_POR_MANIPULADOR_BANCARIO,
);

/** O controlador que publica as três rotas desta fatia — o nome que a falha do `CT-836` nomeia. */
const CONTROLADOR_DA_FATIA_BANCARIA = 'CertificadoDoProvedorController';

/** Uma entrada do inventário desta fatia, na forma em que a falha a nomeia. */
interface EntradaDoInventario {
  readonly metodo: string;
  readonly caminho: string;
  readonly controlador: string;
}

/**
 * O inventário desta fatia **por extenso** — três entradas, cada uma com
 * `{ metodo, caminho, controlador }`.
 *
 * É a primeira coisa que o `CT-836` afirma, **antes** de qualquer comparação com o total, e a forma é
 * a mesma que {@link RotaSemDeclaracao} usa para nomear a ofensora: é assim que quem lê a falha
 * encontra o defeito — o caminho diz onde publicar a declaração, o método diz qual manipulador é, e o
 * controlador diz em que arquivo procurar.
 *
 * Ele é **escrito à mão**, e a redundância com {@link paresDoCertificadoDoProvedor} é a decisão:
 * aquele COMPÕE os caminhos a partir das constantes que o controlador publica, e este os declara
 * literalmente. A igualdade entre os dois é afirmada no caso, e é ela que apanha o dia em que um
 * segmento mudar sem que o inventário revisado acompanhe — derivar um do outro faria o caso concordar
 * consigo mesmo.
 *
 * A ligação do **controlador** com a aplicação montada não é literal: os três rótulos de
 * {@link MANIPULADORES_DA_FATIA_BANCARIA} são consultados por `retratoDasExigenciasDe`, que
 * **levanta** quando o rótulo não existe na varredura — de modo que um controlador renomeado reprova
 * ali, nomeando o rótulo que sumiu.
 */
const INVENTARIO_DA_FATIA_BANCARIA: readonly EntradaDoInventario[] = [
  {
    metodo: 'POST',
    caminho: '/v1/integracoes-bancarias/certificados',
    controlador: CONTROLADOR_DA_FATIA_BANCARIA,
  },
  {
    metodo: 'GET',
    caminho: '/v1/integracoes-bancarias/certificado',
    controlador: CONTROLADOR_DA_FATIA_BANCARIA,
  },
  {
    metodo: 'POST',
    caminho: '/v1/integracoes-bancarias/certificado/verificacao',
    controlador: CONTROLADOR_DA_FATIA_BANCARIA,
  },
];

/**
 * A única ação sensível que o catálogo fechado enumera dentro de `TELA:integracoes_bancarias`.
 *
 * É a metade executável do critério *"nenhuma chave nasceu no catálogo por esta fatia"*: uma ação nova
 * nesta área — a saída curta para uma rodada que quisesse governar a consulta ou a verificação por
 * chave própria — reprova aqui, nomeando-a. Abrir o catálogo exigiria supersedê-la ADR-0011.
 */
const ACOES_SENSIVEIS_DAS_INTEGRACOES_BANCARIAS: readonly string[] = [
  ACAO_DE_CONFIGURACAO_DE_INTEGRACAO,
];

/** Quantos pares a fatia `emissao-e-conciliacao` publica hoje — os dois atos sobre o boleto (T13). */
const PARES_PUBLICADOS_PELOS_ATOS_SOBRE_O_BOLETO = 2;

/**
 * Quantos pares as **leituras** sobre o boleto publicam — os dois `GET` da T14.
 *
 * SUT_IS_CORRECT_BECAUSE: a T14 publicou `GET /v1/cobrancas/:codigo/boleto` e
 * `GET /v1/cobrancas/:codigo/historico-bancario`, e o inventário desta fatia passou de **dois** para
 * **quatro** pares. A constante dos ATOS **não muda** — ela ancora
 * {@link MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO}, que continua com dois —, e esta nasce ao lado dela
 * em vez de somar-se a ela: as duas grandezas são diferentes, e fundi-las faria a sanidade do
 * `CT-918 (f)` deixar de acusar uma lista de atos truncada.
 */
const PARES_PUBLICADOS_PELAS_LEITURAS_SOBRE_O_BOLETO = 2;

/**
 * Quantos pares a superfície de `/v1/cobranca-bancaria` publica — as três rotas da T15.
 *
 * SUT_IS_CORRECT_BECAUSE: a T15 publicou `POST /v1/cobranca-bancaria/emissoes`,
 * `GET /v1/cobranca-bancaria/emissoes/:id` e `POST /v1/cobranca-bancaria/conferencias`, e o
 * inventário desta fatia passou de **quatro** para **sete** pares. As duas constantes anteriores
 * **não mudam** — elas ancoram grupos diferentes —, e esta nasce ao lado delas em vez de somar-se a
 * uma: fundi-las faria a sanidade do `CT-918 (f)` deixar de acusar uma lista de atos truncada.
 */
const PARES_PUBLICADOS_PELA_COBRANCA_BANCARIA = 3;

/** Quantos pares a fatia publica somando os três grupos — a âncora do inventário dela. */
const PARES_PUBLICADOS_PELA_FATIA_DE_EMISSAO =
  PARES_PUBLICADOS_PELOS_ATOS_SOBRE_O_BOLETO +
  PARES_PUBLICADOS_PELAS_LEITURAS_SOBRE_O_BOLETO +
  PARES_PUBLICADOS_PELA_COBRANCA_BANCARIA;

/**
 * As duas ações sensíveis que governam os atos sobre o boleto (§3.1 da T13).
 *
 * Literais escritos à mão, e **não** importados de `cobranca.controller.ts`: as constantes de lá são
 * privadas de propósito, e derivá-las da mesma fonte que o SUT usa para declarar faria a asserção
 * abaixo concordar consigo mesma — trocar a ação no controlador deixaria de reprovar caso algum. É a
 * mesma escolha, e a mesma razão, de {@link AREA_DO_FINANCEIRO} e de
 * {@link ACAO_DE_CONFIGURACAO_DE_INTEGRACAO}.
 */
const ACAO_DE_EMISSAO_DE_BOLETO = 'ACAO:emitir_boleto';
const ACAO_DE_SOLICITACAO_DE_BAIXA = 'ACAO:solicitar_baixa_de_boleto';

/**
 * O retrato devido pelos **dois** manipuladores dos atos sobre o boleto — o que o `CT-918 (f)` audita
 * por igualdade de OBJETO.
 *
 * O rótulo é `Controlador.manipulador`, o mesmo que o `CT-355`, o `CT-427`, o `CT-533`, o `CT-635`, o
 * `CT-732` e o `CT-836` já usam.
 *
 * **Os dois declaram a CONJUNÇÃO INTEIRA no MÉTODO**, e a assimetria com as outras cinco rotas de
 * `/v1/cobrancas` — que valem pela declaração da classe e exigem só a área — é a **ADR-0021** lida
 * pela natureza do ato: emitir e revogar **movem dinheiro**, porque registram no mundo um título
 * cobrável ou o derrubam, enquanto lançar, ler, pagar e cancelar são operação de cadastro. As duas
 * chaves já existiam no catálogo fechado, reservadas exatamente para estas rotas.
 *
 * A ordem dentro da conjunção é **conteúdo**: a recusa nomeia a **PRIMEIRA** chave ausente, e a área
 * vem antes para que quem já a tem ouça o nome do que lhe falta (ADR-0018) — é o que o `CT-918 (e)`
 * de `boleto-da-cobranca.e2e.spec.ts` afirma na borda, com `detalhes.exigido`.
 *
 * ⚠️ **Declarar só a ação nestes dois `POST` é o defeito que este mapa fecha**, e ele é o mais
 * perigoso desta superfície: `getAllAndOverride` faz a declaração do método **substituir** a da
 * classe, de modo que `@ExigeChave(ACAO_DE_EMISSAO_DE_BOLETO)` apagaria `TELA:financeiro` da rota — e
 * a coerência do catálogo esconderia a perda na borda, porque
 * `MAPA_ACAO_TELA['ACAO:emitir_boleto']` **é** `TELA:financeiro`, de modo que a área continuaria
 * exigida por acidente. O simétrico — `@ExigeChave(AREA_DO_FINANCEIRO)`, que apaga a **ação** — é
 * invisível para qualquer prova que meça apenas a existência da declaração, e é ele que este mapa e o
 * `CT-918 (e)` passam a reprovar.
 *
 * Ele é **um objeto**, e não asserções soltas: uma exigência que sumisse de um manipulador reprovaria
 * com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente — as duas
 * direções, numa comparação só.
 */
const RETRATO_DEVIDO_POR_MANIPULADOR_DE_EMISSAO: Readonly<Record<string, RetratoDaExigencia>> = {
  'CobrancaController.emitirBoleto': { metodo: [AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO] },
  'CobrancaController.revogarBoleto': {
    metodo: [AREA_DO_FINANCEIRO, ACAO_DE_SOLICITACAO_DE_BAIXA],
  },
};

/** Os dois manipuladores auditados, derivados do mapa acima — a ordem é a de inserção dele. */
const MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO: readonly string[] = Object.keys(
  RETRATO_DEVIDO_POR_MANIPULADOR_DE_EMISSAO,
);

/**
 * O retrato devido pelos **dois** manipuladores das LEITURAS sobre o boleto (T14) — pela CLASSE.
 *
 * **Elas nada declaram no método**, e a ausência é o mecanismo: a exigência de `TELA:financeiro` vem
 * da classe, e `getAllAndOverride` é override, não união. A régua é a ADR-0021 lida ao pé da letra —
 * ela governa **transição de estado**, e nenhuma das duas é transição: não movem dinheiro, não gravam
 * e não alteram o que outra entidade pode fazer. Quem alcança a área já lê a cobrança inteira por
 * `GET :codigo`, com `linhaDigitavel` e `codigoDeBarras` dentro.
 *
 * ⚠️ **Este mapa fecha os DOIS defeitos opostos, e nenhum deles é visível por outra prova desta
 * base.** O `CT-355` só acusa manipulador que exija **menos** que a classe, e nenhum dos dois é isso:
 *
 *   * uma linha "óbvia" `@ExigeChave(AREA_DO_FINANCEIRO)` no método — que instalaria um segundo lugar
 *     por onde a área pode sumir em silêncio — muda a **origem** do retrato de `classe` para
 *     `metodo`, e reprova aqui;
 *   * um `@ExigeChaves(AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO)` numa leitura — que negaria a
 *     segunda via a quem pode ver a cobrança — exige **mais** que a classe, não aparece em
 *     `semDeclaracao` nem no `CT-355`, e reprova só aqui.
 *
 * Ele é **um objeto**, e não asserções soltas: uma exigência que sumisse de um manipulador reprovaria
 * com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente.
 */
const RETRATO_DEVIDO_PELAS_LEITURAS_SOBRE_O_BOLETO: Readonly<Record<string, RetratoDaExigencia>> = {
  'CobrancaController.boleto': { classe: [AREA_DO_FINANCEIRO] },
  'CobrancaController.historicoBancario': { classe: [AREA_DO_FINANCEIRO] },
};

/** Os dois manipuladores de leitura auditados, derivados do mapa acima. */
const MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO: readonly string[] = Object.keys(
  RETRATO_DEVIDO_PELAS_LEITURAS_SOBRE_O_BOLETO,
);

/** O controlador que publica os dois atos — o nome que a falha do `CT-918 (f)` nomeia. */
const CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO = 'CobrancaController';

/**
 * As **cinco** rotas de `/v1/cobrancas` que **não** são ato sobre o boleto, com o retrato delas.
 *
 * Elas entram no caso porque são a vizinhança que torna a assimetria observável: sem afirmá-las, uma
 * rodada que "uniformizasse" o controlador — subindo as duas ações para a classe, ou descendo a área
 * para os cinco métodos — mudaria a exigência efetiva de sete rotas e o retrato dos dois atos
 * continuaria idêntico. É a mesma lista que {@link EXIGENCIA_DEVIDA_POR_MANIPULADOR} já declara para
 * o `CT-533`, e a igualdade é afirmada contra ela — não contra uma segunda cópia livre para divergir.
 */
const RETRATO_DEVIDO_PELAS_CINCO_DE_COBRANCA: Readonly<Record<string, RetratoDaExigencia>> =
  Object.fromEntries(
    Object.entries(EXIGENCIA_DEVIDA_POR_MANIPULADOR)
      .filter(([rotulo]) => rotulo.startsWith(`${CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO}.`))
      .map(([rotulo, atomos]) => [rotulo, { classe: atomos }]),
  );

/** Os cinco rótulos da vizinhança, derivados do retrato acima. */
const MANIPULADORES_DE_COBRANCA_SEM_ATO_SOBRE_BOLETO: readonly string[] = Object.keys(
  RETRATO_DEVIDO_PELAS_CINCO_DE_COBRANCA,
);

/** Quantas rotas de `/v1/cobrancas` são anteriores a esta fatia — as cinco da `cobranca-e-mora`. */
const ROTAS_DE_COBRANCA_ANTERIORES_A_ESTA_FATIA = 5;

/**
 * O retrato devido pelos **três** manipuladores de `/v1/cobranca-bancaria` (T15) — o que o `CT-937`
 * audita por igualdade de OBJETO.
 *
 * As três valem por declarações **diferentes**, e a assimetria é o conteúdo do mapa:
 *
 *   * `abrirEmissao` declara no MÉTODO a **conjunção inteira**, com a área antes da ação, porque
 *     abrir o lote **move dinheiro** — cada boleto que ele emite é um título cobrável no mundo, e é a
 *     segunda classe da ADR-0021;
 *   * `lerEmissao` e `dispararConferencia` **nada declaram**, e a ausência é decisão: a leitura do
 *     lote não é transição, e a conferência apenas **registra** o que o provedor informa ter
 *     acontecido — dinheiro que se moveu fora do sistema.
 *
 * ⚠️ **Declarar só a ação no `POST /emissoes` é o defeito que este mapa fecha.**
 * `getAllAndOverride` faz a declaração do método **substituir** a da classe, de modo que
 * `@ExigeChave(ACAO_DE_EMISSAO_DE_BOLETO)` apagaria `TELA:financeiro` da rota — e a coerência do
 * catálogo esconderia a perda na borda, porque `MAPA_ACAO_TELA['ACAO:emitir_boleto']` **é**
 * `TELA:financeiro`. O simétrico — a área sozinha, que apaga a **ação** — é invisível para toda prova
 * que meça apenas a existência da declaração, e reprova aqui.
 *
 * Ele é **um objeto**, e não asserções soltas: uma exigência que sumisse de um manipulador reprovaria
 * com o rótulo dele nomeado, e uma que aparecesse a mais reprovaria pelo excedente — as duas
 * direções, numa comparação só.
 */
const RETRATO_DEVIDO_PELA_COBRANCA_BANCARIA: Readonly<Record<string, RetratoDaExigencia>> = {
  'CobrancaBancariaController.abrirEmissao': {
    metodo: [AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO],
  },
  'CobrancaBancariaController.lerEmissao': { classe: [AREA_DO_FINANCEIRO] },
  'CobrancaBancariaController.dispararConferencia': { classe: [AREA_DO_FINANCEIRO] },
};

/** Os três manipuladores de `/v1/cobranca-bancaria`, derivados do mapa acima. */
const MANIPULADORES_DA_COBRANCA_BANCARIA: readonly string[] = Object.keys(
  RETRATO_DEVIDO_PELA_COBRANCA_BANCARIA,
);

/** O controlador que publica as três rotas de `/v1/cobranca-bancaria`. */
const CONTROLADOR_DA_COBRANCA_BANCARIA = 'CobrancaBancariaController';

/**
 * Os **sete** manipuladores da fatia `emissao-e-conciliacao`, na ordem dos três grupos que a compõem.
 *
 * Composta dos três inventários já declarados, e **não** escrita de novo: uma quarta lista livre para
 * divergir das três faria o `CT-937` auditar um conjunto diferente do que o `CT-918 (f)` audita, e a
 * fatia passaria a ter duas respostas para *"quais são as rotas dela?"*.
 */
const MANIPULADORES_DA_FATIA_DE_EMISSAO: readonly string[] = [
  ...MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO,
  ...MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO,
  ...MANIPULADORES_DA_COBRANCA_BANCARIA,
];

/**
 * O retrato devido pelos **sete** manipuladores da fatia, composto dos três mapas nomeados.
 *
 * Composto, e não redigitado, pela razão do bloco acima. É o esperado da igualdade de OBJETO do
 * `CT-937`: ela afirma, numa comparação só, o conteúdo **e** a origem da exigência de cada uma das
 * sete — e a origem é o que separa a herança da classe de uma declaração de método idêntica a ela.
 */
const RETRATO_DEVIDO_PELA_FATIA_DE_EMISSAO: Readonly<Record<string, RetratoDaExigencia>> = {
  ...RETRATO_DEVIDO_POR_MANIPULADOR_DE_EMISSAO,
  ...RETRATO_DEVIDO_PELAS_LEITURAS_SOBRE_O_BOLETO,
  ...RETRATO_DEVIDO_PELA_COBRANCA_BANCARIA,
};

/**
 * Quantos pares a aplicação MUTANTE publica.
 *
 * Ela não publica o contrato — quem o faz é `criarAplicacao()`, e a montagem de verificação usa o
 * arcabouço de teste. Sobram os do arcabouço, sob o prefixo de versão sem exclusão — duas de saúde,
 * a sessão corrente, a troca de senha do produto, os sete do encaminhador, os **seis** do operador
 * do SaaS e os **sete** da administração de pessoas —, mais os três das rotas de verificação.
 *
 * SUT_IS_CORRECT_BECAUSE: a aplicação mutante importa a MESMA composição raiz da produção, e a T8
 * registrou o módulo de pessoas nela — os sete pares aparecem aqui pela mesma razão que aparecem lá
 * (19 → 26). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou o par da troca de senha do produto à mesma composição
 * raiz (26 → 27), pela mesma razão do parágrafo acima.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` registrou o módulo de
 * imóveis na MESMA composição raiz, e os seis pares de conjunto aparecem aqui pela mesma razão que
 * aparecem no controle (27 → 33). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 registrou o controlador de imóveis no MESMO módulo, e os seis pares
 * de `/v1/imoveis` aparecem aqui pela mesma razão que aparecem no controle (33 → 39).
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 registrou o controlador de cômodos no MESMO módulo, e os três pares
 * de `/v1/imoveis/:id/comodos` aparecem aqui pela mesma razão que aparecem no controle (39 → 42).
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 registrou os três controladores de papel em `CadastrosModule`, que a
 * T8 já havia registrado na MESMA composição raiz — o módulo existia sem publicar rota alguma, e é
 * por isso que ele não aparecia aqui até agora. Os dezoito pares aparecem pela mesma razão que
 * aparecem no controle (42 → 60).
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` registrou `ContratosModule` na MESMA
 * composição raiz, e os seis pares de cadastro de contrato aparecem aqui pela mesma razão que
 * aparecem no controle (60 → 66).
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 acrescentou o par da ativação ao MESMO controlador, já registrado
 * naquela composição raiz, e ele aparece aqui pela mesma razão que aparece no controle (66 → 67). A
 * âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 acrescentou o par do cancelamento ao MESMO controlador, pela mesma
 * razão do parágrafo acima (67 → 68).
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 acrescentou o par da situação de locação ao controlador de imóveis,
 * já registrado naquela composição raiz, e ele aparece aqui pela mesma razão que aparece no controle
 * (68 → 69). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` registrou `CobrancasModule` na MESMA
 * composição raiz, e os três pares de `/v1/cobrancas` aparecem aqui pela mesma razão que aparecem no
 * controle (69 → 72).
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia registrou `MoraModule` na MESMA composição raiz, e os
 * dois pares de `/v1/multa-e-juros` aparecem aqui pela mesma razão que aparecem no controle
 * (72 → 74). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou as **duas transições** ao MESMO controlador,
 * já registrado naquela composição raiz, e elas aparecem aqui pela mesma razão que aparecem no controle
 * (74 → 76). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da fatia `regua-de-cobranca` registrou `AutomacaoModule` na MESMA
 * composição raiz, e os dois pares de `/v1/automacao-de-cobranca` aparecem aqui pela mesma razão que
 * aparecem no controle (76 → 78). A âncora continua sendo de contagem EXATA, e a diferença de nove
 * para a superfície de produção continua sendo a mesma: os pares do contrato publicado, que esta
 * montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou as **duas rotas de aviso** ao MESMO
 * controlador, já registrado naquela composição raiz, e elas aparecem aqui pela mesma razão que
 * aparecem no controle (78 → 80). A âncora continua sendo de contagem EXATA, e a diferença de nove
 * para a superfície de produção continua sendo a mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da fatia `documentos-e-confirmacao` acrescentou a **rota do
 * documento** ao MESMO controlador de contrato, já registrado naquela composição raiz, e ela aparece
 * aqui pela mesma razão que aparece no controle (80 → 81). A âncora continua sendo de contagem
 * EXATA, e a diferença de nove para a superfície de produção continua sendo a mesma: os pares do
 * contrato publicado, que esta montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T9** da mesma fatia acrescentou o par do **reenvio da confirmação** ao
 * MESMO controlador de locatário, já registrado naquela composição raiz, e ele aparece aqui pela
 * mesma razão que aparece no controle (81 → 82). A âncora continua sendo de contagem EXATA, e a
 * diferença de nove para a superfície de produção continua sendo a mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da mesma fatia registrou `ConfirmacoesModule` na MESMA composição
 * raiz, e o par de `/v1/confirmacoes-de-email` aparece aqui pela mesma razão que aparece no controle
 * (82 → 83). A âncora continua sendo de contagem EXATA, e a diferença de nove para a superfície de
 * produção continua sendo a mesma: os pares do contrato publicado, que esta montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `fundacao-bancaria` registrou `IntegracoesBancariasModule`
 * na MESMA composição raiz, e os **dois** pares do certificado do provedor aparecem aqui pela mesma
 * razão que aparecem no controle (83 → 85). A âncora continua sendo de contagem EXATA, e a diferença
 * de nove para a superfície de produção continua sendo a mesma: os pares do contrato publicado, que
 * esta montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T12** da mesma fatia acrescentou o par da **verificação da identidade**
 * ao MESMO controlador do certificado, já registrado naquela composição raiz, e ele aparece aqui pela
 * mesma razão que aparece no controle (85 → 86). A âncora continua sendo de contagem EXATA, e a
 * diferença de nove para a superfície de produção continua sendo a mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T13** da fatia `emissao-e-conciliacao` acrescentou os **dois atos sobre
 * o boleto** ao MESMO controlador de cobrança, já registrado naquela composição raiz, e eles aparecem
 * aqui pela mesma razão que aparecem no controle (86 → 88). A âncora continua sendo de contagem
 * EXATA, e a diferença de nove para a superfície de produção continua sendo a mesma: os pares do
 * contrato publicado, que esta montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T14** da mesma fatia acrescentou as **duas leituras sobre o boleto** ao
 * MESMO controlador de cobrança, já registrado naquela composição raiz, e elas aparecem aqui pela
 * mesma razão que aparecem no controle (88 → 90). A âncora continua sendo de contagem EXATA, e a
 * diferença de nove para a superfície de produção continua sendo a mesma: os pares do contrato
 * publicado, que esta montagem não registra.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T15** da mesma fatia registrou `CobrancaBancariaModule` na MESMA
 * composição raiz — esta montagem importa o `AppModule` inteiro —, e os **três** pares de
 * `/v1/cobranca-bancaria` aparecem aqui pela mesma razão que aparecem no controle (90 → 93). A
 * âncora continua sendo de contagem EXATA, e a diferença de nove para a superfície de produção
 * continua sendo a mesma: os pares do contrato publicado, que esta montagem não registra.
 */
const ROTAS_PUBLICADAS_NO_MUTANTE = 93;

/**
 * O que seria o inventário público da aplicação mutante **se o mutante não estivesse lá**.
 *
 * A montagem de verificação aplica o prefixo de versão sem exclusão, de modo que as rotas de saúde
 * atendem sob `/v1` nela. É contra este inventário que o excedente do mutante aparece nomeado.
 */
const PUBLICAS_LEGITIMAS_NO_MUTANTE: readonly string[] = [
  ...paresDoEncaminhador(),
  `GET /${PREFIXO_DE_VERSAO}/saude`,
  `GET /${PREFIXO_DE_VERSAO}/saude/pronto`,
  // SUT_IS_CORRECT_BECAUSE: a **T11** publicou a rota sem sessão na MESMA composição raiz, e ela é
  // legítima **também nesta montagem** — o mutante desta prova é o `ControladorPublicoIndevido`, e
  // não ela. Sem esta entrada, o excedente nomeado pelo caso passaria a ser dois, e a igualdade
  // deixaria de discriminar o defeito que ela existe para apanhar. O caminho é o MESMO da aplicação
  // real: as duas montagens aplicam o prefixo de versão a este controlador.
  ...paresDoAtoDoTitular(),
].sort();

/** Sujeito do eixo "sessão de maior alcance" — o operador do SaaS, sem restrição pendente. */
const MASTER = USUARIO_MASTER;

/** Sujeito do segundo eixo do CT-212: o Admin, cuja matriz é o catálogo inteiro. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * Sujeito do `CT-837`: a pessoa de perfil `USUARIO_EMPRESA`, cuja matriz **padrão** concede uma única
 * chave.
 *
 * A sessão vem do caminho real e a matriz é a do perfil, **sem concessão fabricada**: é isso que faz o
 * `403` medir a exigência declarada pela rota, e não um ajuste montado pelo próprio caso.
 */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A única chave da matriz padrão de `USUARIO_EMPRESA` (RN-02).
 *
 * Literal escrito à mão pela mesma razão das áreas acima, e **afirmado** no `CT-837` antes das três
 * chamadas: sem essa precondição, um `403` nas rotas da fatia seria indistinguível de um `403` vindo
 * de uma sessão que perdeu o efetivo por outro motivo.
 */
const UNICA_CHAVE_DO_USUARIO_EMPRESA = 'TELA:resumo';

/**
 * A mensagem canônica de `ACESSO_NEGADO` — a que o `CT-837` afirma nas três rotas.
 *
 * É a **mesma constante** de {@link MENSAGEM_SEM_DECLARACAO}, e não um segundo literal com o mesmo
 * texto: desde o fecho do débito D17, a recusa da rota sem declaração é indistinguível de qualquer
 * outra recusa de autorização, e dois literais iguais ficariam livres para divergir — a divergência
 * apagaria justamente a indistinguibilidade que aquela constante existe para provar. O nome novo diz
 * o papel que ela cumpre aqui.
 */
const MENSAGEM_DE_ACESSO_NEGADO = MENSAGEM_SEM_DECLARACAO;

/**
 * A mensagem canônica de `NAO_AUTENTICADO` — a que o `CT-838` afirma nas três rotas.
 *
 * Literal, e **não** importada da tabela do filtro global: derivá-la da mesma fonte que o SUT usa
 * faria a asserção concordar consigo mesma, e um erro de texto passaria despercebido nos dois lados.
 */
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';

/**
 * O material que o corpo do registro carrega no `CT-837`.
 *
 * Ele é **sintético de propósito**, e o alcance da escolha é exatamente este: a guarda decide antes
 * de o manipulador correr, de modo que a recusa acontece **antes de o corpo ser lido** — e um material
 * que abrisse de verdade custaria a emissão de um PKCS#12 sem acrescentar nada ao que o caso mede.
 * Se a guarda deixasse passar, o desfecho seria `422` e não `403`, e o caso reprovaria do mesmo jeito.
 */
const MATERIAL_QUE_A_RECUSA_NUNCA_LE = Buffer.from('a guarda recusa antes de ler').toString(
  'base64',
);

/** A senha que acompanha o material acima — pela mesma razão, ela nunca chega a ser conferida. */
const SENHA_QUE_A_RECUSA_NUNCA_LE = 'senha-que-a-recusa-nunca-le';

/** Uma das três chamadas da fatia, como o cliente a faz. */
interface ChamadaDaFatiaBancaria {
  readonly rotulo: string;
  readonly metodo: string;
  readonly caminho: string;
  readonly corpo?: Record<string, unknown>;
}

/**
 * As **três** chamadas da fatia, na ordem da §4.1 do tech spec — o arranjo que o `CT-837` e o
 * `CT-838` percorrem.
 *
 * Os caminhos são **compostos a partir das constantes que o controlador publica**, e não escritos
 * como cadeia crua: caminho escrito duas vezes é livre para divergir, e a divergência apareceria como
 * `404` num caso que deveria medir autorização. É a mesma composição de
 * {@link paresDoCertificadoDoProvedor}, e a coincidência entre as duas é o que liga a auditoria
 * estática do `CT-836` às duas provas de borda.
 *
 * Os corpos são os que a rota declara — o registro pede material e senha, a verificação pede o corpo
 * vazio e fechado, e a consulta não tem corpo. Ver {@link MATERIAL_QUE_A_RECUSA_NUNCA_LE} para por que
 * o material é sintético.
 */
const CHAMADAS_DA_FATIA_BANCARIA: readonly ChamadaDaFatiaBancaria[] = [
  {
    rotulo: 'registro',
    metodo: 'POST',
    caminho: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DO_REGISTRO}`,
    corpo: { material: MATERIAL_QUE_A_RECUSA_NUNCA_LE, senha: SENHA_QUE_A_RECUSA_NUNCA_LE },
  },
  {
    rotulo: 'consulta',
    metodo: 'GET',
    caminho: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_CONSULTA}`,
  },
  {
    rotulo: 'verificação',
    metodo: 'POST',
    caminho: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`,
    corpo: {},
  },
];

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;

let aplicacaoReal: NestFastifyApplication;

/**
 * O endereço base da aplicação de **produção** — o alvo das duas provas de borda desta fatia.
 *
 * O `CT-837` e o `CT-838` exercitam a aplicação que `criarAplicacao()` monta, e não a mutante: o que
 * eles medem é a recusa que o cliente encontra nas três rotas **publicadas**, e a mutante existe para
 * outra coisa — ela carrega rotas de verificação que a produção não tem.
 */
let baseReal: string;

/**
 * O acesso ao banco de negócio — usado **só** para a contagem crua do `CT-837`.
 *
 * Ele não monta precondição nem escreve nada: a única instrução que corre por aqui é o `count(*)` que
 * separa *"recusou"* de *"recusou depois de escrever"*.
 */
let acessoAoNegocio: AcessoAoBanco;

let aplicacaoMutante: NestFastifyApplication;
let baseMutante: string;

/** A montagem do recurso REST comum — um caminho, dois manipuladores (CT-213 c). */
let aplicacaoDeRecurso: NestFastifyApplication;

/** A montagem em que dois manipuladores disputam o MESMO verbo do mesmo caminho (CT-213 c). */
let aplicacaoEmDisputa: NestFastifyApplication;

/** As duas montagens do par de falsificação do CT-355 — o defeito literal e a gêmea que o corrige. */
let aplicacaoQueSubstitui: NestFastifyApplication;
let aplicacaoQueCompoe: NestFastifyApplication;

let ambienteAnterior: NodeJS.ProcessEnv;

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

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  // A aplicação de produção — o CONTROLE. Ela é montada por `criarAplicacao()`, e não remontada
  // aqui: um inventário obtido de uma remontagem descreveria uma aplicação que ninguém sobe.
  const portaReal = await reservarPorta();
  baseReal = `http://${ENDERECO_DE_ESCUTA}:${String(portaReal)}`;
  process.env.PORT = String(portaReal);
  aplicacaoReal = await criarAplicacao();
  // O roteador só está completo depois de o adaptador ficar pronto: as rotas dos controladores
  // entram na inicialização do arcabouço, e as do plugin de arquivos estáticos na escuta.
  await aplicacaoReal.listen({ port: portaReal, host: ENDERECO_DE_ESCUTA });

  // A aplicação MUTANTE — mesma composição raiz, mais as três rotas de verificação.
  const portaMutante = await reservarPorta();
  baseMutante = `http://${ENDERECO_DE_ESCUTA}:${String(portaMutante)}`;
  process.env.PORT = String(portaMutante);

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorSemDeclaracao, ControladorSemExigencia, ControladorPublicoIndevido],
  }).compile();

  aplicacaoMutante = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso desta aplicação toca as rotas de
  // saúde por endereço literal, e reproduzir a lista aqui criaria uma segunda cópia dela livre para
  // divergir. O inventário desta montagem já conta com isso.
  aplicacaoMutante.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacaoMutante.listen({ port: portaMutante, host: ENDERECO_DE_ESCUTA });

  // As duas montagens do CT-213 (c). Elas não sobem servidor: nenhum caso as exercita por HTTP, e
  // `init()` já deixa a tabela do roteador completa — o que exigia `listen()` na aplicação real é o
  // plugin de arquivos estáticos do contrato, que não existe aqui. Reservar porta para elas
  // consumiria recurso do host sem provar nada.
  aplicacaoDeRecurso = await montarMinima([ControladorDeRecurso]);
  aplicacaoEmDisputa = await montarMinima([ControladorQueDisputa, ControladorQueTambemDisputa]);

  // O par de falsificação PERMANENTE do CT-355 — o defeito literal e a gêmea que o corrige. Elas
  // vivem em montagens próprias, e nunca na composição raiz: publicar em `apps/api/src` um
  // manipulador que substitui a exigência da classe seria criar em produção exatamente a
  // vulnerabilidade que a asserção existe para impedir.
  aplicacaoQueSubstitui = await montarMinima([ControladorQueSubstitui]);
  aplicacaoQueCompoe = await montarMinima([ControladorQueCompoe]);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoQueCompoe?.close();
  await aplicacaoQueSubstitui?.close();
  await aplicacaoEmDisputa?.close();
  await aplicacaoDeRecurso?.close();
  await aplicacaoMutante?.close();
  await aplicacaoReal?.close();
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

describe('cobertura de autorização sobre a superfície publicada (T5)', () => {
  it(
    'CT-212 — rota sem declaração é recusada até para o Master pleno; só a marca explícita libera',
    async () => {
      // A sessão de MAIOR ALCANCE do sistema: o operador do SaaS, com o segundo fator já cumprido
      // pelo caminho público real. Sem cumpri-lo a sessão nasce restrita (RN-08), e o `403` viria da
      // restrição — não da ausência de declaração, que é o eixo do caso.
      const cookieDoMaster = await entrarComSegundoFatorCumprido(MASTER.email);

      try {
        // Precondição AFIRMADA, e não suposta: é ela que dá sentido a "maior alcance".
        const sessaoDoMaster = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoMaster });
        expect(sessaoDoMaster.status).toBe(200);
        expect(sessaoDoMaster.corpo).toMatchObject({
          perfil: 'SYSLOC_MASTER',
          senhaProvisoria: false,
          segundoFatorPendente: false,
        });

        const semDeclaracaoParaMaster = await pedir(caminho(CAMINHO_SEM_DECLARACAO), {
          cookie: cookieDoMaster,
        });

        expect(semDeclaracaoParaMaster.status).toBe(403);
        // Corpo INTEIRO por igualdade: `ACESSO_NEGADO` — a ADR-0012 proíbe código novo no enum — com
        // a mensagem que diz que o defeito é DA ROTA, e **sem** `detalhes`. Não há exigência a
        // nomear, e inventar uma diria ao cliente que existe uma chave capaz de liberá-lo.
        expect(semDeclaracaoParaMaster.corpo).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_SEM_DECLARACAO,
        });

        // O par que discrimina: a MESMA sessão alcança a gêmea, que difere apenas pela marca
        // explícita. Sem ele, uma guarda que recusasse tudo passaria a metade de cima.
        const comMarca = await pedir(caminho(CAMINHO_SEM_EXIGENCIA), { cookie: cookieDoMaster });
        expect(comMarca.status).toBe(200);
        expect(comMarca.corpo).toEqual({ alcancada: true });

        // Segundo eixo: o Admin, que alcança as 17 chaves. A recusa não pode vir de permissão que
        // lhe falte, porque não falta nenhuma — e ela é a MESMA, byte a byte.
        const cookieDoAdmin = await entrar(ADMIN_DE_A.email);
        const sessaoDoAdmin = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoAdmin });
        expect(sessaoDoAdmin.status).toBe(200);
        const efetivo = sessaoDoAdmin.corpo as { telas: string[]; acoes: string[] };
        expect(efetivo.telas.length + efetivo.acoes.length).toBe(TOTAL_DE_CHAVES);

        const semDeclaracaoParaAdmin = await pedir(caminho(CAMINHO_SEM_DECLARACAO), {
          cookie: cookieDoAdmin,
        });
        expect(semDeclaracaoParaAdmin.status).toBe(403);
        expect(semDeclaracaoParaAdmin.texto).toBe(semDeclaracaoParaMaster.texto);

        // E a gêmea libera o Admin também: o par positivo/negativo vale nas duas sessões, o que
        // separa "esta rota não atende ninguém" de "esta sessão não alcança esta rota".
        expect(
          (await pedir(caminho(CAMINHO_SEM_EXIGENCIA), { cookie: cookieDoAdmin })).status,
        ).toBe(200);
      } finally {
        // O estado do Master volta ao da carga, pela rota pública, ACONTEÇA O QUE ACONTECER acima:
        // no `finally`, e não como última instrução, porque um `expect` que reprove antes deixaria o
        // segundo fator ativo e faria outro arquivo falhar por arrasto, apontando para o lugar
        // errado.
        await desfazerSegundoFator(cookieDoMaster);
      }
    },
    LIMITE_CASO_MS,
  );

  it('CT-213 — nenhuma rota da superfície publicada existe sem declaração de exigência', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // Âncora da enumeração, em valor EXATO. Sem ela, um enumerador que devolvesse conjuntos vazios
    // — ou que perdesse metade da árvore — passaria todas as igualdades abaixo por vacuidade.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);

    // A CONFERÊNCIA — a mesma função que o caso de falsificação aplica ao mutante.
    expect(conferir(cobertura, PARES_PUBLICOS_ACEITOS)).toEqual({
      semDeclaracao: [],
      excedentes: [],
      ausentes: [],
    });

    // Eixo POSITIVO: a leitura de declaração de fato encontra declaração. Sem isto, um leitor que
    // devolvesse "declarada" para tudo passaria as igualdades acima — e a cobertura estaria provada
    // sobre nada.
    expect(cobertura.comExigencia).toEqual([...ROTAS_COM_EXIGENCIA]);

    // E a repartição do conjunto público entre "marcada" e "sem manipulador do arcabouço": é o que
    // faz a falha dizer POR QUE uma rota não passa pela decisão, e o que impede o segundo bucket de
    // virar um depósito onde tudo cabe.
    expect(cobertura.foraDoArcabouco).toEqual([...ROTAS_FORA_DO_ARCABOUCO]);
    expect(cobertura.publicas).toEqual([...PARES_PUBLICOS_ACEITOS]);
  });

  it('CT-213 (b) — a mesma conferência REPROVA a aplicação que carrega as rotas de verificação', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoMutante);

    expect(cobertura.rotasEnumeradas).toBe(ROTAS_PUBLICADAS_NO_MUTANTE);

    // A MESMA função do controle, sobre a montagem com o defeito. Os dois eixos reprovam, e cada um
    // NOMEIA o culpado: o par método+caminho da rota sem declaração, e o caminho excedente do
    // conjunto público. Igualdade de objeto inteiro, e não "não está vazio": um verificador que
    // acusasse a rota errada, ou que acusasse rotas demais, reprova aqui.
    expect(conferir(cobertura, PUBLICAS_LEGITIMAS_NO_MUTANTE)).toEqual({
      semDeclaracao: [
        {
          metodo: 'GET',
          caminho: caminho(CAMINHO_SEM_DECLARACAO),
          controlador: 'ControladorSemDeclaracao',
          manipulador: 'responder',
        },
      ],
      excedentes: [`GET ${caminho(CAMINHO_PUBLICO_INDEVIDO)}`],
      ausentes: [],
    });

    // A gêmea COM a marca explícita não é acusada — ela declara. É o que separa "a verificação
    // reprova o que não declara" de "a verificação reprova toda rota de verificação".
    //
    // SUT_IS_CORRECT_BECAUSE: os seis pares do operador do SaaS e os SETE da administração de
    // pessoas entram aqui pela MESMA razão que entram no controle — a aplicação mutante importa a
    // composição raiz da produção, onde a T7 e a T8 registraram os dois módulos. Nenhuma entrada
    // anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: o par da troca de senha do produto entra aqui pela mesma razão, agora
    // da T9 — e ele reforça a distinção que este bloco existe para fazer: a rota do produto declara
    // "não exige" como a gêmea de verificação ao lado, e por isso as duas caem no conjunto POSITIVO,
    // enquanto a que não declara nada continua sendo acusada acima.
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de conjunto entram aqui pela mesma razão que entram no
    // controle — a aplicação mutante importa a composição raiz da produção, onde a T5 registrou o
    // módulo de imóveis. Nenhuma entrada anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de imóvel entram pela mesma razão, agora da T6, que
    // registrou o controlador de imóveis no mesmo módulo. Nenhuma entrada anterior saiu.
    //
    // SUT_IS_CORRECT_BECAUSE: os TRÊS pares de cômodo entram pela mesma razão, agora da T7, que
    // registrou o controlador de cômodos no mesmo módulo. Nenhuma entrada anterior saiu.
    //
    // SUT_IS_CORRECT_BECAUSE: os DEZOITO pares dos três papéis de cadastro de pessoa entram pela
    // mesma razão, agora da T9, que registrou os três controladores em `CadastrosModule` — módulo
    // que a T8 já havia posto na composição raiz sem que ele publicasse rota alguma. Nenhuma entrada
    // anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de cadastro de contrato entram pela mesma razão, agora da
    // T6 da fatia `contratos-de-locacao`, que registrou `ContratosModule` na composição raiz. Nenhuma
    // entrada anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: o par da ATIVAÇÃO entra pela mesma razão, agora da T7 — ele nasce no
    // MESMO controlador já registrado naquela composição raiz. Nenhuma entrada anterior saiu, e a
    // igualdade segue exata; o inventário cresce por {@link paresDeContratos}, que é escrito à mão e
    // revisado, e não por derivação de outra âncora deste arquivo.
    //
    // SUT_IS_CORRECT_BECAUSE: o par do CANCELAMENTO e o da SITUAÇÃO DE LOCAÇÃO entram pela mesma
    // razão, agora da T8 e da T10 — o primeiro nasce no controlador de contrato e o segundo no de
    // imóvel, os dois já registrados naquela composição raiz. Nenhuma entrada anterior saiu, e a
    // igualdade segue exata. O par novo entra por {@link paresDeSituacaoDeLocacao}, e a rota é a única
    // desta base que não declara nada no método: ela cai no conjunto POSITIVO pela declaração da
    // CLASSE, que é exatamente o que este eixo mede — existência de declaração, não conteúdo dela.
    //
    // SUT_IS_CORRECT_BECAUSE: os TRÊS pares de cobrança entram pela mesma razão, agora da T5 da fatia
    // `cobranca-e-mora`, que registrou `CobrancasModule` na composição raiz. Nenhuma entrada anterior
    // saiu, e a igualdade segue exata. As três caem no conjunto POSITIVO pela declaração da CLASSE
    // (`TELA:financeiro`) — nenhuma declara nada no método, e é justamente isso que este eixo mede:
    // existência de declaração, não conteúdo dela.
    //
    // SUT_IS_CORRECT_BECAUSE: os DOIS pares da política de mora entram pela mesma razão, agora da T6
    // da mesma fatia, que registrou `MoraModule` na composição raiz. Nenhuma entrada anterior saiu, e
    // a igualdade segue exata. Os dois caem no conjunto POSITIVO pela declaração da CLASSE
    // (`TELA:multa_e_juros`) — nenhum declara nada no método, e é justamente isso que este eixo mede.
    //
    // SUT_IS_CORRECT_BECAUSE: os DOIS pares das transições de cobrança entram pela mesma razão, agora
    // da T7 — eles nascem no MESMO controlador já registrado naquela composição raiz, e entram por
    // {@link paresDeCobrancas}, que é escrito à mão e revisado. Nenhuma entrada anterior saiu, e a
    // igualdade segue exata; as duas caem no conjunto POSITIVO pela declaração da CLASSE.
    //
    // SUT_IS_CORRECT_BECAUSE: os DOIS pares da política de aviso entram pela mesma razão, agora da T9
    // da fatia `regua-de-cobranca`, que registrou `AutomacaoModule` na composição raiz. Nenhuma
    // entrada anterior saiu, e a igualdade segue exata. Os dois caem no conjunto POSITIVO pela
    // declaração da CLASSE (`TELA:automacao_de_cobranca`) — nenhum declara nada no método, e é
    // justamente isso que este eixo mede: existência de declaração, não conteúdo dela.
    //
    // SUT_IS_CORRECT_BECAUSE: o par da rota do documento entra pela mesma razão, agora da T7 da fatia
    // `documentos-e-confirmacao` — ele nasce no MESMO controlador de contrato já registrado naquela
    // composição raiz, e entra por {@link paresDoDocumentoDeContrato}, que é escrito à mão e
    // revisado. Nenhuma entrada anterior saiu, e a igualdade segue exata. Ele cai no conjunto
    // POSITIVO pela declaração da CLASSE (`TELA:contratos`) — não declara nada no método, e é
    // justamente isso que este eixo mede.
    //
    // SUT_IS_CORRECT_BECAUSE: o par do REENVIO DA CONFIRMAÇÃO entra pela mesma razão, agora da T9 da
    // mesma fatia — ele nasce no MESMO controlador de locatário já registrado naquela composição
    // raiz, e entra por {@link paresDoReenvioDeConfirmacao}, que é escrito à mão e revisado. Nenhuma
    // entrada anterior saiu, e a igualdade segue exata. Ele cai no conjunto POSITIVO pela declaração
    // da CLASSE (`TELA:cadastros`) — não declara nada no método, e nesta superfície a ausência é
    // mais carregada do que nas anteriores: declarar a área no método seria substituição
    // **invisível por comportamento**, porque `TELA:cadastros` é exatamente
    // `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`. Quem examina o conteúdo é o `CT-355`.
    expect(cobertura.comExigencia).toEqual(
      [
        `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
        `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
        `GET ${caminho(CAMINHO_SEM_EXIGENCIA)}`,
        ...paresDoMaster(),
        ...paresDeUsuarios(),
        ...paresDeConjuntos(),
        ...paresDeImoveis(),
        ...paresDeComodos(),
        ...paresDeCadastrosDePessoa(),
        ...paresDeContratos(),
        ...paresDeSituacaoDeLocacao(),
        ...paresDeCobrancas(),
        ...paresDeMultaEJuros(),
        ...paresDaAutomacaoDeCobranca(),
        ...paresDoDocumentoDeContrato(),
        ...paresDoReenvioDeConfirmacao(),
        // SUT_IS_CORRECT_BECAUSE: os **dois** pares do CERTIFICADO DO PROVEDOR entram pela mesma
        // razão, agora da T11 da fatia `fundacao-bancaria` — o módulo novo é registrado naquela
        // composição raiz, e eles entram por {@link paresDoCertificadoDoProvedor}, que é escrito à
        // mão e revisado. Nenhuma entrada anterior saiu, e a igualdade segue exata. Os dois caem no
        // conjunto POSITIVO por caminhos diferentes: a consulta pela declaração da CLASSE
        // (`TELA:integracoes_bancarias`, sem nada no método) e o registro pela declaração do MÉTODO,
        // que é a **conjunção inteira** e portanto contém a da classe. Este eixo mede que os dois
        // declaram; quem examina o conteúdo — e apanharia uma declaração só com a ação — é o
        // `CT-355`.
        ...paresDoCertificadoDoProvedor(),
        // SUT_IS_CORRECT_BECAUSE: os **dois** pares dos ATOS SOBRE O BOLETO entram pela mesma razão,
        // agora da T13 da fatia `emissao-e-conciliacao` — eles nascem no MESMO controlador de
        // cobrança já registrado naquela composição raiz, e entram por
        // {@link paresDosAtosSobreOBoleto}, que é escrito à mão e revisado. Nenhuma entrada anterior
        // saiu, e a igualdade segue exata. Os dois caem no conjunto POSITIVO pela declaração do
        // MÉTODO, que é a **conjunção inteira** e portanto contém a da classe. Este eixo mede que os
        // dois declaram; quem examina o **conteúdo** é o `CT-918 (f)`, por igualdade de objeto do
        // retrato — o `CT-355` sozinho não bastaria aqui, porque ele só acusa a declaração de método
        // que exige MENOS que a classe, e a perda da **chave de ação** deixa uma declaração que
        // ainda contém a da classe. Ela também é invisível por comportamento do lado da área, porque
        // `TELA:financeiro` é exatamente `MAPA_ACAO_TELA['ACAO:emitir_boleto']`; quem a apanha na
        // borda é o `CT-918 (e)` de `boleto-da-cobranca.e2e.spec.ts`.
        ...paresDosAtosSobreOBoleto(),
        // SUT_IS_CORRECT_BECAUSE: as **duas leituras sobre o boleto** entram pela mesma razão, agora
        // da T14 — elas nascem no MESMO controlador de cobrança já registrado naquela composição
        // raiz, e entram por {@link paresDasLeiturasSobreOBoleto}, que é escrito à mão e revisado.
        // Nenhuma entrada anterior saiu, e a igualdade segue exata. As duas caem no conjunto POSITIVO
        // pela declaração da CLASSE, e **não** pela do método: elas nada declaram ali, e a ausência é
        // decisão — a ADR-0021 governa transição de estado, e leitura não é uma. Quem examina o
        // **conteúdo** delas é o `CT-918 (f)`, por igualdade de objeto do retrato, com a origem
        // junto; sem ele, um `@ExigeChaves` indevido numa leitura seria indistinguível daqui.
        ...paresDasLeiturasSobreOBoleto(),
        // SUT_IS_CORRECT_BECAUSE: os **três** pares de `/v1/cobranca-bancaria` entram pela mesma
        // razão, agora da T15 — o módulo novo (`CobrancaBancariaModule`) é registrado naquela
        // composição raiz, que esta montagem importa inteira, e eles entram por
        // {@link paresDaCobrancaBancaria}, escrito à mão e revisado. Nenhuma entrada anterior saiu, e
        // a igualdade segue exata. Os três caem no conjunto POSITIVO por caminhos **diferentes**: o
        // `POST /emissoes` pela declaração do MÉTODO, que é a conjunção inteira e portanto contém a
        // da classe; o `GET /emissoes/:id` e o `POST /conferencias` pela declaração da CLASSE, sem
        // nada no método — e a ausência é decisão, porque o primeiro é leitura e o segundo é a
        // segunda classe da ADR-0021, cujo único desfecho gravado é *acusar pagamento*. Este eixo
        // mede que os três declaram; quem examina o **conteúdo** é o `CT-355`, que acusa a
        // declaração de método que exija MENOS que a classe.
        ...paresDaCobrancaBancaria(),
      ].sort(),
    );

    // E nada aqui é registrado direto no adaptador: o conjunto "fora do arcabouço" não é um depósito
    // que absorva o que a junção não soube ligar — se a junção falhasse, a rota apareceria nele.
    expect(cobertura.foraDoArcabouco).toEqual([]);
  });

  it('CT-318 — as 33 rotas novas da fatia declaram exigência, e nenhuma escapou para o conjunto público', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // O inventário desta fatia tem 33 pares — afirmado sobre o próprio inventário, antes de comparar
    // com a superfície. Sem isto, uma lista truncada faria as igualdades abaixo passarem sobre menos
    // rotas do que a fatia publica, que é o modo de falha silencioso desta classe de caso.
    expect(PARES_NOVOS_DA_FATIA.length).toBe(33);

    // Nenhuma rota da superfície publicada existe sem declaração — o predicado da ADR-0011, e o que
    // torna as igualdades seguintes afirmações sobre uma superfície inteiramente governada.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As 33 constam no conjunto POSITIVO, nomeadas: `filter` em vez de `every` porque a falha precisa
    // dizer QUAL rota escapou, e não apenas que alguma escapou.
    expect(PARES_NOVOS_DA_FATIA.filter((par) => !cobertura.comExigencia.includes(par))).toEqual([]);

    // E nenhuma delas escapou por `@RotaPublica()`, que é a escapatória que a existência da
    // declaração sozinha não fecha: a guarda retorna antes para rota pública, e o conjunto sem
    // declaração continuaria vazio.
    expect(PARES_NOVOS_DA_FATIA.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(PARES_NOVOS_DA_FATIA.filter((par) => cobertura.foraDoArcabouco.includes(par))).toEqual(
      [],
    );

    // A metade ANTERIOR à fatia está intacta, por igualdade de array: o que o conjunto positivo
    // publica menos os 33 novos — e menos os pares que fatias POSTERIORES acrescentaram — é
    // exatamente o inventário de antes. É esta asserção que pega a troca que o total não veria — um
    // par da F1 sumindo enquanto um par novo entra no lugar dele.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de duas metades. A T6 da fatia `contratos-de-locacao` publicou seis pares que não
    // são nem da F1 nem da fatia `cadastro-de-imoveis-e-pessoas`, e o filtro anterior os empurraria
    // para dentro da metade "anterior", fazendo a igualdade reprovar sobre rotas legítimas. O que a
    // asserção mede — *"a metade anterior está intacta"* — **não foi afrouxado**: continua sendo
    // igualdade de array contra um inventário escrito à mão, agora com a terceira metade nomeada e
    // subtraída explicitamente. Nenhuma entrada saiu de {@link EXIGENCIA_ANTERIOR_A_FATIA}.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de três metades. A T5 da fatia `cobranca-e-mora` publicou três pares que não são de
    // nenhuma das anteriores, e o filtro anterior os empurraria para dentro da metade "anterior",
    // fazendo a igualdade reprovar sobre rotas legítimas. O que a asserção mede **não foi
    // afrouxado**: continua sendo igualdade de array contra um inventário escrito à mão, agora com a
    // quarta metade nomeada e subtraída explicitamente.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de cinco metades. A T7 da fatia `documentos-e-confirmacao` publicou **um** par que
    // não é de nenhuma das anteriores — e que é sobre `/v1/contratos`, o que o tornaria
    // especialmente fácil de empurrar para a metade errada —, e o filtro anterior o empurraria para
    // dentro da metade "anterior", fazendo a igualdade reprovar sobre uma rota legítima. O que a
    // asserção mede **não foi afrouxado**: continua sendo igualdade de array contra um inventário
    // escrito à mão, agora com a sexta metade nomeada e subtraída explicitamente. Nenhuma entrada
    // saiu de {@link EXIGENCIA_ANTERIOR_A_FATIA}.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de sete metades. A T13 da fatia `emissao-e-conciliacao` publicou **dois** pares que
    // não são de nenhuma das anteriores — e que são sobre `/v1/cobrancas`, o que os tornaria
    // especialmente fáceis de empurrar para a metade errada, a da fatia `cobranca-e-mora` —, e o
    // filtro anterior os empurraria para dentro da metade "anterior", fazendo a igualdade reprovar
    // sobre rotas legítimas. O que a asserção mede **não foi afrouxado**: continua sendo igualdade de
    // array contra um inventário escrito à mão, agora com a oitava metade nomeada e subtraída
    // explicitamente. Nenhuma entrada saiu de {@link EXIGENCIA_ANTERIOR_A_FATIA}.
    expect(
      cobertura.comExigencia.filter(
        (par) =>
          !PARES_NOVOS_DA_FATIA.includes(par) &&
          !PARES_DA_FATIA_DE_CONTRATOS.includes(par) &&
          !PARES_DA_FATIA_DE_COBRANCA.includes(par) &&
          !PARES_DA_FATIA_DA_REGUA.includes(par) &&
          !PARES_DA_FATIA_DE_DOCUMENTOS.includes(par) &&
          !PARES_DA_FATIA_BANCARIA.includes(par) &&
          !PARES_DA_FATIA_DE_EMISSAO.includes(par),
      ),
    ).toEqual([...EXIGENCIA_ANTERIOR_A_FATIA]);

    // A oitava metade, afirmada por si — pelo mesmo motivo da sétima: sem esta linha, a subtração
    // acima esconderia um par desta fatia que sumisse, porque ele sairia do filtro sem que nada
    // afirmasse que ele está publicado e declarado.
    expect(cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_EMISSAO.includes(par))).toEqual(
      [...PARES_DA_FATIA_DE_EMISSAO],
    );

    // A sétima metade, afirmada por si — pelo mesmo motivo da sexta: sem esta linha, a subtração
    // acima esconderia um par desta fatia que sumisse, porque ele sairia do filtro sem que nada
    // afirmasse que ele está publicado e declarado.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de seis metades. A T11 da fatia `fundacao-bancaria` publicou **dois** pares que não
    // são de nenhuma das anteriores, e o filtro anterior os empurraria para dentro da metade
    // "anterior", fazendo a igualdade reprovar sobre rotas legítimas. O que a asserção mede **não
    // foi afrouxado**: continua sendo igualdade de array contra um inventário escrito à mão, agora
    // com a sétima metade nomeada e subtraída explicitamente. Nenhuma entrada saiu de
    // {@link EXIGENCIA_ANTERIOR_A_FATIA}.
    expect(cobertura.comExigencia.filter((par) => PARES_DA_FATIA_BANCARIA.includes(par))).toEqual([
      ...PARES_DA_FATIA_BANCARIA,
    ]);

    // A sexta metade, afirmada por si — pelo mesmo motivo da quinta: sem esta linha, a subtração
    // acima esconderia o par desta fatia se ele sumisse, porque ele sairia do filtro sem que nada
    // afirmasse que ele está publicado e declarado.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_DOCUMENTOS.includes(par)),
    ).toEqual([...PARES_DA_FATIA_DE_DOCUMENTOS]);

    // A quinta metade, afirmada por si: os dois pares da fatia `regua-de-cobranca` são exatamente os
    // que sobram do outro lado da mesma partição. Sem esta linha, a subtração acima esconderia um par
    // desta fatia que sumisse — ele sairia do filtro sem que nada afirmasse que ele está publicado e
    // declarado.
    //
    // SUT_IS_CORRECT_BECAUSE: vale para esta fatia o parágrafo que a de cobrança escreveu acima — a
    // T9 publicou dois pares que não são de nenhuma das anteriores, e o filtro anterior os empurraria
    // para dentro da metade "anterior", fazendo a igualdade reprovar sobre rotas legítimas. O que a
    // asserção mede **não foi afrouxado**: continua sendo igualdade de array contra um inventário
    // escrito à mão, agora com a quinta metade nomeada e subtraída explicitamente.
    expect(cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DA_REGUA.includes(par))).toEqual([
      ...PARES_DA_FATIA_DA_REGUA,
    ]);

    // E os pares da fatia de contratos são exatamente os que sobram do outro lado da mesma partição:
    // sem esta linha, a subtração acima poderia estar escondendo um par de contrato que sumiu.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_CONTRATOS.includes(par)),
    ).toEqual([...PARES_DA_FATIA_DE_CONTRATOS]);

    // O mesmo do outro lado, para a metade nova: sem esta linha, os três pares desta fatia sairiam da
    // subtração acima sem que nada afirmasse que eles de fato estão publicados e declarados.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_COBRANCA.includes(par)),
    ).toEqual([...PARES_DA_FATIA_DE_COBRANCA]);

    // Os dois conjuntos que a fatia NÃO deve ter tocado, inalterados.
    expect(cobertura.publicas).toEqual([...PARES_PUBLICOS_ACEITOS]);
    expect(cobertura.foraDoArcabouco).toEqual([...ROTAS_FORA_DO_ARCABOUCO]);

    // O TOTAL e o DELTA, os dois. O total sozinho não distingue "33 novas entraram" de "34 entraram
    // e uma antiga saiu"; o delta é medido sobre a superfície observada — quantos pares publicados
    // NÃO são da fatia —, e por isso ele não é aritmética entre duas constantes deste arquivo.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era a aritmética do delta que
    // descrevia uma superfície de duas metades. Com a fatia `contratos-de-locacao` publicando seis
    // pares, o delta desta fatia passa a ser medido descontando também os dela — o valor comparado
    // (`ROTAS_PUBLICADAS_ANTES_DA_FATIA`, 33) **não muda**, e continua sendo âncora escrita à mão e
    // não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia `cobranca-e-mora`:
    // com três pares novos, o delta desta fatia passa a ser medido descontando também os dela. O
    // valor comparado **não muda** — ele continua sendo `33`, a superfície que existia antes da fatia
    // de cadastro —, e é justamente essa imutabilidade que faz a asserção seguir pegando o par antigo
    // que sumisse enquanto um novo entrasse no lugar dele.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia `regua-de-cobranca`:
    // com dois pares novos, o delta desta fatia passa a ser medido descontando também os dela. O
    // valor comparado **não muda** — ele continua sendo `33`, a superfície que existia antes da fatia
    // de cadastro —, e é justamente essa imutabilidade que faz a asserção seguir pegando o par antigo
    // que sumisse enquanto um novo entrasse no lugar dele.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia
    // `documentos-e-confirmacao`: com **um** par novo, o delta desta fatia passa a ser medido
    // descontando também o dela. O valor comparado **não muda** — ele continua sendo `33`, a
    // superfície que existia antes da fatia de cadastro —, e é justamente essa imutabilidade que faz
    // a asserção seguir pegando o par antigo que sumisse enquanto um novo entrasse no lugar dele.
    //
    // SUT_IS_CORRECT_BECAUSE: a **T11** da fatia `documentos-e-confirmacao` publicou o par **sem
    // sessão**, que é da fatia como os outros dois e por isso precisa ser descontado aqui — mas que
    // **não** entra em {@link PARES_DA_FATIA_DE_DOCUMENTOS}, porque aquele inventário é o dos pares
    // que declaram exigência e é comparado, logo acima, contra `cobertura.comExigencia`. Somá-lo lá
    // faria aquela igualdade reprovar sobre uma rota legítima; deixá-lo fora daqui faria este delta
    // acusar `34` onde a superfície anterior é `33`. Ele é subtraído pelo seu próprio nome, que é o
    // que mantém as duas afirmações verdadeiras ao mesmo tempo. O valor comparado **não muda** —
    // continua sendo `33` —, e a asserção **não foi afrouxada**: continua sendo igualdade exata
    // medida sobre a superfície observada.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia
    // `fundacao-bancaria`: com **dois** pares novos, o delta desta fatia passa a ser medido
    // descontando também os dela. O valor comparado **não muda** — ele continua sendo `33`, a
    // superfície que existia antes da fatia de cadastro —, e é justamente essa imutabilidade que faz
    // a asserção seguir pegando o par antigo que sumisse enquanto um novo entrasse no lugar dele. A
    // asserção **não foi afrouxada**: continua sendo igualdade exata medida sobre a superfície
    // observada, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia
    // `emissao-e-conciliacao`: com **dois** pares novos, o delta desta fatia passa a ser medido
    // descontando também os dela. O valor comparado **não muda** — ele continua sendo `33` —, e é
    // justamente essa imutabilidade que faz a asserção seguir pegando o par antigo que sumisse
    // enquanto um novo entrasse no lugar dele. A asserção **não foi afrouxada**: continua sendo
    // igualdade exata medida sobre a superfície observada.
    expect(
      cobertura.rotasEnumeradas -
        PARES_NOVOS_DA_FATIA.length -
        PARES_DA_FATIA_DE_CONTRATOS.length -
        PARES_DA_FATIA_DE_COBRANCA.length -
        PARES_DA_FATIA_DA_REGUA.length -
        PARES_DA_FATIA_DE_DOCUMENTOS.length -
        PARES_DA_FATIA_BANCARIA.length -
        PARES_DA_FATIA_DE_EMISSAO.length -
        paresDoAtoDoTitular().length,
    ).toBe(ROTAS_PUBLICADAS_ANTES_DA_FATIA);
  });

  it('CT-213 (c) — o recurso REST comum é classificado par a par; a disputa do MESMO verbo levanta', () => {
    // ---------------------------------------------------------------------------------------
    // Metade 1: dois manipuladores no MESMO caminho, com declarações OPOSTAS
    // ---------------------------------------------------------------------------------------
    //
    // A asserção é o retrato INTEIRO, e ela é discriminante por construção: os dois manipuladores
    // compartilham o caminho e caem em conjuntos DIFERENTES. Nenhuma classificação por caminho
    // consegue produzir este resultado — ela teria de eleger uma das duas declarações para os dois
    // pares, ou abortar, que é o que a versão anterior fazia.
    expect(verificarCoberturaDeAutorizacao(aplicacaoDeRecurso)).toEqual({
      rotasEnumeradas: 2,
      comExigencia: [`GET ${caminho(CAMINHO_DO_RECURSO)}`],
      publicas: [],
      foraDoArcabouco: [],
      semDeclaracao: [
        {
          metodo: 'POST',
          caminho: caminho(CAMINHO_DO_RECURSO),
          controlador: 'ControladorDeRecurso',
          manipulador: 'criar',
        },
      ],
    });

    // ---------------------------------------------------------------------------------------
    // Metade 2: a disputa que CONTINUA sendo disputa
    // ---------------------------------------------------------------------------------------
    //
    // Dois manipuladores reivindicando o MESMO verbo do mesmo caminho é ambiguidade de verdade — não
    // há como dizer qual declaração vale —, e ela tem de seguir levantando. Ver
    // {@link comTabelaDoRoteador} para por que a tabela é apresentada em vez de montada.
    const disputa = capturar(() =>
      verificarCoberturaDeAutorizacao(
        comTabelaDoRoteador(aplicacaoEmDisputa, `└── ${caminho(CAMINHO_EM_DISPUTA)} (GET, HEAD)\n`),
      ),
    );

    expect(disputa?.message).toBe(
      `GET ${caminho(CAMINHO_EM_DISPUTA)} é reivindicado por dois manipuladores — ` +
        'ControladorQueDisputa.responder e ControladorQueTambemDisputa.responder: ' +
        'a cobertura não tem como dizer qual declaração vale',
    );
  });

  it('CT-355 — nenhuma declaração de MÉTODO substitui a da classe: a do método CONTÉM a da classe', () => {
    // ---------------------------------------------------------------------------------------
    // Controle: a aplicação de PRODUÇÃO inteira
    // ---------------------------------------------------------------------------------------
    const violacoes = declaracoesQueSubstituemAClasse(aplicacaoReal);

    // Âncora de não-vacuidade em valor EXATO, e ela é indispensável: "nenhuma violação" sobre zero
    // manipuladores examinados é verdade vazia, e é exatamente assim que esta asserção apodreceria
    // em silêncio. `> 0` fecharia só o caso degenerado e deixaria aberto o intermediário — uma
    // varredura que perdesse metade dos controladores continuaria passando. É o mesmo raciocínio,
    // e a mesma escolha, das outras três âncoras deste arquivo.
    expect(
      manipuladoresExaminados(aplicacaoReal),
      'o número de manipuladores da superfície publicada mudou: o inventário desta prova precisa ser revisado',
    ).toBe(MANIPULADORES_EXAMINADOS_EM_PRODUCAO);

    expect(
      violacoes,
      `declaração de método que SUBSTITUI a da classe: ${violacoes
        .map((v) => `${v.controlador}.${v.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // FALSIFICAÇÃO PERMANENTE: a MESMA função sobre o defeito literal
    // ---------------------------------------------------------------------------------------
    //
    // O controle acima, sozinho, não prova nada — uma função que devolvesse `[]` sempre passaria.
    // O par é o que detecta, e ele vive **na suíte** em vez de numa medição narrada num comentário:
    // `ControladorQueSubstitui` é o defeito exato que rejeitou a T5 na rodada 1 (área na classe,
    // ação no método), e `ControladorQueCompoe` é a gêmea que difere **apenas** por declarar a
    // conjunção. Uma implementação que acusasse as duas, ou nenhuma, reprova aqui.
    expect(declaracoesQueSubstituemAClasse(aplicacaoQueSubstitui)).toEqual([
      {
        controlador: 'ControladorQueSubstitui',
        manipulador: 'circular',
        daClasse: ['TELA:imoveis'],
        doMetodo: ['ACAO:excluir_cadastro'],
      },
    ]);
    expect(declaracoesQueSubstituemAClasse(aplicacaoQueCompoe)).toEqual([]);
  });

  it('CT-427 — a conjunção das quatro rotas governadas de contrato é auditada por ESTRUTURA, e a superfície fecha contra as âncoras vigentes', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da fatia, medidas SEPARADAMENTE
    // ---------------------------------------------------------------------------------------
    //
    // Elas vêm de dois mecanismos diferentes — a enumeração da tabela do roteador e a varredura dos
    // decoradores dos controladores — e nenhuma é derivada da outra. A razão está escrita no
    // docblock de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a coincidência aritmética entre elas não é
    // garantia, e foi justamente ela que produziu o `77` esperado pela §11.2 do tech spec.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);
    expect(
      manipuladoresExaminados(aplicacaoReal),
      'o número de manipuladores da superfície publicada mudou: o inventário desta prova precisa ser revisado',
    ).toBe(MANIPULADORES_EXAMINADOS_EM_PRODUCAO);

    // Nenhuma rota da superfície publicada existe sem declaração — inclusive a que nasceu nesta task.
    expect(cobertura.semDeclaracao).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // A ESTRUTURA das quatro governadas: a conjunção inteira, e a ORDEM é conteúdo
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de ARRAY, e não de conjunto: a recusa nomeia a **PRIMEIRA** chave ausente (RN-14), de
    // modo que a ordem é o que decide se quem tem a área e não tem a ação recebe o nome da ação — o
    // que lhe falta — ou o da área, que ele já possui. Um `expect.arrayContaining` aceitaria a ordem
    // invertida, e um `toContain` aceitaria a declaração só com a ação, que é o defeito da ADR-0018.
    const noMetodo = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(noMetodo.get('ContratoController.ativar')).toEqual([
      'TELA:contratos',
      'ACAO:ativar_contrato',
    ]);
    expect(noMetodo.get('ContratoController.cancelar')).toEqual([
      'TELA:contratos',
      'ACAO:cancelar_contrato',
    ]);
    expect(noMetodo.get('ContratoController.retirar')).toEqual([
      'TELA:contratos',
      'ACAO:excluir_cadastro',
    ]);
    expect(noMetodo.get('ContratoController.recircular')).toEqual([
      'TELA:contratos',
      'ACAO:excluir_cadastro',
    ]);

    // ---------------------------------------------------------------------------------------
    // A rota NOVA: nada no método, e a exigência EFETIVA é exatamente a da classe
    // ---------------------------------------------------------------------------------------
    //
    // As duas metades são necessárias e nenhuma basta. A primeira afirma a **forma** — não há
    // declaração de método a substituir a da classe, que é a leitura declarada da ADR-0019 no
    // cabeçalho de `imovel.controller.ts`. A segunda afirma o **efeito**: a rota exige `TELA:imoveis`
    // e nada além, lido pelo MESMO `getAllAndOverride` da guarda. Sem a segunda, um manipulador que
    // perdesse a classe inteira (um `@Controller` sem `@ExigeChave`) passaria pela primeira; sem a
    // primeira, uma conjunção declarada no método com a mesma área passaria pela segunda.
    expect(noMetodo.has('ImovelController.definirSituacaoDeLocacao')).toBe(false);
    expect(
      exigenciaEfetivaDoManipulador(aplicacaoReal, 'ImovelController.definirSituacaoDeLocacao'),
    ).toEqual(['TELA:imoveis']);

    // E o par que discrimina: as duas rotas de circulação de imóvel, da MESMA classe, declaram sim no
    // método. Sem esta linha, "não declara nada no método" seria satisfeito por uma varredura que não
    // enxergasse declaração de método alguma.
    expect(noMetodo.get('ImovelController.retirar')).toEqual([
      'TELA:imoveis',
      'ACAO:excluir_cadastro',
    ]);
  });

  it('CT-533 — as sete rotas da fatia exigem a área devida e NENHUMA chave de ação; a superfície fecha pelas duas medições', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // O inventário desta fatia tem sete pares — afirmado sobre o próprio inventário, antes de
    // comparar com a superfície. Sem isto, uma lista truncada faria as igualdades abaixo passarem
    // sobre menos rotas do que a fatia publica, que é o modo de falha silencioso desta classe.
    expect(PARES_DA_FATIA_DE_COBRANCA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DE_COBRANCA);
    expect(MANIPULADORES_DA_FATIA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DE_COBRANCA);

    // ---------------------------------------------------------------------------------------
    // O predicado da ADR-0011: `semDeclaracao` VAZIO, por igualdade de lista
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e **nunca** `toHaveLength(0)`: a falha precisa nomear o par, o controlador
    // e o manipulador que ficaram sem declaração — um comprimento diria apenas que há alguém.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As sete constam do conjunto POSITIVO, nomeadas, e nenhuma escapou por `@RotaPublica()`, que é a
    // escapatória que a existência da declaração sozinha não fecha: a guarda retorna antes para rota
    // pública, e o conjunto sem declaração continuaria vazio.
    expect(
      PARES_DA_FATIA_DE_COBRANCA.filter((par) => !cobertura.comExigencia.includes(par)),
    ).toEqual([]);
    expect(PARES_DA_FATIA_DE_COBRANCA.filter((par) => cobertura.publicas.includes(par))).toEqual(
      [],
    );
    expect(
      PARES_DA_FATIA_DE_COBRANCA.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das sete declarações, por igualdade de OBJETO
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte: é ela que o cliente encontra. O mapa inteiro numa comparação
    // só afirma as duas direções de uma vez: exigência que sumiu de um manipulador e exigência que
    // apareceu a mais aparecem nomeadas pelo rótulo.
    const efetivas = exigenciasEfetivasDe(aplicacaoReal, MANIPULADORES_DA_FATIA);

    // NENHUMA das sete exige chave de ação, e a asserção **nomeia** a que encontrar — é por isso que
    // ela não é um predicado booleano: a falha tem de dizer qual manipulador passou a exigir o quê,
    // porque acrescentar chave de ação aqui exige a mesma escalada que classificou os sete atos como
    // operacionais (ADR-0021), e não uma linha num decorador.
    //
    // ⚠️ **Ela vem ANTES da igualdade do retrato, e a ordem é conteúdo** — é o fecho do
    // débito `D61` da T14, cujo gatilho a T17 disparou ao acrescentar a este arquivo
    // o `CT-937`. Com a igualdade primeiro, ela **aborta o caso** e esta linha nunca executa no
    // estado que ela existe para pegar: o `MT11-2` mediu exatamente isso, e é o AP-29 pelo qual duas
    // tasks foram reprovadas. Nenhuma asserção foi removida nem afrouxada — só a ordem entre as duas
    // mudou, e o molde é o do `CT-836`.
    expect(chavesDeAcaoExigidasEm(efetivas)).toEqual([]);

    expect(efetivas).toEqual(EXIGENCIA_DEVIDA_POR_MANIPULADOR);

    // E a metade da FORMA: nenhuma das sete declara nada no MÉTODO — as sete valem pela declaração da
    // classe. Sem esta linha, uma conjunção declarada no método com a mesma área satisfaria a
    // igualdade acima; sem a igualdade, um manipulador que perdesse a classe inteira passaria aqui.
    const noMetodoDaFatia = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(MANIPULADORES_DA_FATIA.filter((rotulo) => noMetodoDaFatia.has(rotulo))).toEqual([]);

    // O par que discrimina: um manipulador que **declara** no método continua sendo visto como tal
    // pela mesma varredura. Sem ele, "nenhuma das sete declara no método" seria satisfeito por uma
    // varredura que não enxergasse declaração de método alguma.
    expect(noMetodoDaFatia.get('ContratoController.cancelar')).toEqual([
      'TELA:contratos',
      'ACAO:cancelar_contrato',
    ]);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da fatia, por DUAS medições independentes que têm de concordar
    // ---------------------------------------------------------------------------------------
    //
    // A primeira lê a **tabela do roteador** já montado; a segunda varre os **decoradores dos
    // controladores** e compõe: cada manipulador reivindica um par, salvo o `@All`, que reivindica os
    // sete verbos do caminho dele, mais os nove pares registrados direto no adaptador, que não têm
    // manipulador. Nenhuma é derivada da outra — é essa independência que mediu `75` onde a §11.2 da
    // fatia anterior estimava `77`, e localizou o erro na soma em vez de no escopo entregue.
    //
    // As quatro grandezas viajam numa comparação só de propósito: se as duas medições divergirem, a
    // falha **nomeia os dois números** lado a lado, e o errado é a âncora, nunca a medição. É a
    // conferência FINAL da fatia — as âncoras já foram subidas por T5, T6 e T7, e aqui elas são
    // apenas conferidas.
    const manipuladores = manipuladoresExaminados(aplicacaoReal);
    const comTodosOsVerbos = manipuladoresQueAtendemTodosOsVerbos(aplicacaoReal);
    const pelaComposicao =
      manipuladores -
      comTodosOsVerbos +
      comTodosOsVerbos * METODOS_DO_ENCAMINHADOR.length +
      ROTAS_FORA_DO_ARCABOUCO.length;

    expect(
      {
        peloRoteador: cobertura.rotasEnumeradas,
        pelaComposicao,
        manipuladores,
        comTodosOsVerbos,
      },
      'as duas medições da superfície publicada precisam concordar: se divergirem, o errado é a âncora e não a medição',
    ).toEqual({
      peloRoteador: ROTAS_PUBLICADAS_EM_PRODUCAO,
      pelaComposicao: ROTAS_PUBLICADAS_EM_PRODUCAO,
      manipuladores: MANIPULADORES_EXAMINADOS_EM_PRODUCAO,
      comTodosOsVerbos: MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS,
    });

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por esta fatia
    // ---------------------------------------------------------------------------------------
    //
    // As dez áreas de tela, por igualdade de arranjo contra a lista escrita à mão: nenhuma área nova
    // nasceu, e nenhuma saiu. É a metade executável do critério *"`catalogo-de-permissoes.ts` não foi
    // tocado pela fatia inteira"* — a outra metade é a conferência do diff, que o Gate 2 faz.
    expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO);

    // E o eixo das ações, nas duas áreas desta fatia: `TELA:financeiro` tem exatamente as duas que
    // falam com o banco, e `TELA:multa_e_juros` **nenhuma**. É a evidência literal que a emenda de
    // 2026-08-10 da ADR-0021 cita para sustentar a ausência de chave de ação nas sete — e é a
    // asserção que reprova a rodada que "resolvesse" o problema criando a chave em vez de escalar.
    expect(acoesSensiveisDaArea(AREA_DO_FINANCEIRO)).toEqual(ACOES_SENSIVEIS_DO_FINANCEIRO);
    expect(acoesSensiveisDaArea(AREA_DE_MULTA_E_JUROS)).toEqual([]);
  });

  it('CT-635 — as quatro rotas da régua declaram o retrato devido, `semDeclaracao` continua vazio, e a superfície fecha pelas duas medições', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // O inventário desta fatia tem quatro pares — afirmado sobre o próprio inventário, antes de
    // comparar com a superfície. Sem isto, uma lista truncada faria as igualdades abaixo passarem
    // sobre menos rotas do que a fatia publica, que é o modo de falha silencioso desta classe.
    expect(PARES_DA_FATIA_DA_REGUA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DA_REGUA);
    expect(MANIPULADORES_DA_REGUA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DA_REGUA);

    // ---------------------------------------------------------------------------------------
    // O predicado da ADR-0011: `semDeclaracao` VAZIO, por igualdade de lista
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e **nunca** `toHaveLength(0)`: a falha precisa nomear o par, o controlador
    // e o manipulador que ficaram sem declaração — um comprimento diria apenas que há alguém.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As quatro constam do conjunto POSITIVO, nomeadas, e nenhuma escapou por `@RotaPublica()`, que
    // é a escapatória que a existência da declaração sozinha não fecha: a guarda retorna antes para
    // rota pública, e o conjunto sem declaração continuaria vazio.
    expect(PARES_DA_FATIA_DA_REGUA.filter((par) => !cobertura.comExigencia.includes(par))).toEqual(
      [],
    );
    expect(PARES_DA_FATIA_DA_REGUA.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(
      PARES_DA_FATIA_DA_REGUA.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das quatro declarações, por igualdade de OBJETO — com a ORIGEM junto
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte: é ela que o cliente encontra. A origem viaja com ela porque
    // `getAllAndOverride` **substitui**, e sem a origem uma conjunção declarada no método seria
    // indistinguível da herança da classe (ver {@link RetratoDaExigencia}). O mapa inteiro numa
    // comparação só afirma as duas direções de uma vez: exigência que sumiu de um manipulador e
    // exigência que apareceu a mais aparecem nomeadas pelo rótulo.
    // A GARANTIA NOMEADA, na direção que mais importa nesta superfície: **nenhum** dos quatro exige
    // MENOS do que a classe dele. A asserção NOMEIA o manipulador ofensor, porque é o *onde* que
    // decide se houve descuido ou linha copiada — e porque a coerência do catálogo esconderia o
    // defeito na borda: `MAPA_ACAO_TELA['ACAO:enviar_cobranca_manual']` é a própria área, de modo que
    // um `POST` declarando só a ação continuaria exigindo-a por acidente.
    //
    // ⚠️ **Ela vem ANTES da igualdade do retrato, e a ordem é conteúdo** — é o fecho do
    // débito `D61` da T14, cujo gatilho a T17 disparou ao acrescentar a este arquivo
    // o `CT-937`. Com o retrato primeiro, a igualdade **aborta o caso** e esta linha nunca executa no
    // estado que ela existe para pegar: o `MT12-1` mediu exatamente isso. Nenhuma asserção foi
    // removida nem afrouxada — só a ordem entre as duas mudou, e o molde é o do `CT-836`.
    const substituicoesDaFatia = declaracoesQueSubstituemAClasse(aplicacaoReal).filter((violacao) =>
      MANIPULADORES_DA_REGUA.includes(`${violacao.controlador}.${violacao.manipulador}`),
    );

    expect(
      substituicoesDaFatia,
      `manipulador da fatia que exige MENOS que a classe: ${substituicoesDaFatia
        .map((violacao) => `${violacao.controlador}.${violacao.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    expect(retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DA_REGUA)).toEqual(
      RETRATO_DEVIDO_POR_MANIPULADOR_DA_REGUA,
    );

    // O par que discrimina a leitura da ORIGEM: exatamente **um** dos quatro declara no método, e
    // declara a conjunção na ORDEM em que o decorador a gravou. Sem esta linha, "três valem pela
    // classe" seria satisfeito por uma varredura que não enxergasse declaração de método alguma; sem
    // a igualdade de arranjo, a ordem invertida — que troca a chave nomeada na recusa — passaria.
    const noMetodoDaFatia = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(MANIPULADORES_DA_REGUA.filter((rotulo) => noMetodoDaFatia.has(rotulo))).toEqual([
      'AutomacaoDeCobrancaController.dispararAviso',
    ]);
    expect(noMetodoDaFatia.get('AutomacaoDeCobrancaController.dispararAviso')).toEqual([
      AREA_DA_AUTOMACAO_DE_COBRANCA,
      ACAO_DE_ENVIO_MANUAL,
    ]);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da fatia, por DUAS medições independentes que têm de concordar
    // ---------------------------------------------------------------------------------------
    //
    // A primeira lê a **tabela do roteador** já montado; a segunda varre os **decoradores dos
    // controladores** e compõe: cada manipulador reivindica um par, salvo o `@All`, que reivindica os
    // sete verbos do caminho dele, mais os nove pares registrados direto no adaptador, que não têm
    // manipulador. Nenhuma é derivada da outra — é essa independência que mediu `82` onde a §11.2 da
    // fatia anterior estimava `77`, e localizou o erro na soma em vez de no escopo entregue.
    //
    // É a conferência FINAL da fatia: as âncoras já foram subidas por T9 (82 → 84) e T10 (84 → 86), e
    // aqui elas são **conferidas**, nunca acrescentadas — é isso que impede a superfície de ser
    // derivada de si mesma.
    const manipuladores = manipuladoresExaminados(aplicacaoReal);
    const comTodosOsVerbos = manipuladoresQueAtendemTodosOsVerbos(aplicacaoReal);
    const pelaComposicao =
      manipuladores -
      comTodosOsVerbos +
      comTodosOsVerbos * METODOS_DO_ENCAMINHADOR.length +
      ROTAS_FORA_DO_ARCABOUCO.length;

    // A igualdade entre as duas medições é afirmada **explicitamente**, e não só por elas baterem no
    // mesmo número esperado: duas medições que concordassem com a âncora por acidente e discordassem
    // entre si passariam pela comparação de baixo, e é a concordância delas que torna cada uma
    // verificável pela outra.
    expect(
      pelaComposicao,
      'as duas medições independentes da superfície publicada divergiram entre si: o errado é a âncora, nunca a medição',
    ).toBe(cobertura.rotasEnumeradas);

    // As quatro grandezas viajam numa comparação só de propósito: se alguma divergir, a falha
    // **nomeia os números** lado a lado.
    expect(
      {
        peloRoteador: cobertura.rotasEnumeradas,
        pelaComposicao,
        manipuladores,
        comTodosOsVerbos,
      },
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toEqual({
      peloRoteador: ROTAS_PUBLICADAS_EM_PRODUCAO,
      pelaComposicao: ROTAS_PUBLICADAS_EM_PRODUCAO,
      manipuladores: MANIPULADORES_EXAMINADOS_EM_PRODUCAO,
      comTodosOsVerbos: MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS,
    });

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por esta fatia
    // ---------------------------------------------------------------------------------------
    //
    // As dez áreas de tela, por igualdade de arranjo contra a lista escrita à mão: nenhuma área nova
    // nasceu, e nenhuma saiu. É a metade executável do critério *"`catalogo-de-permissoes.ts` não foi
    // tocado por task alguma da fatia"* — a outra metade é a conferência do diff, que o Gate 2 faz.
    expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO);

    // E o eixo das ações, na área desta fatia: `TELA:automacao_de_cobranca` tem exatamente a do
    // disparo manual, cujo nome é **histórico** e não se "corrige". É a asserção que reprova a rodada
    // que "resolvesse" um problema de autorização criando chave nova em vez de escalar — abrir o
    // catálogo exigiria supersedê-la ADR-0011.
    expect(acoesSensiveisDaArea(AREA_DA_AUTOMACAO_DE_COBRANCA)).toEqual(
      ACOES_SENSIVEIS_DA_AUTOMACAO,
    );
  });

  it('CT-732 — as três rotas da sub-fatia de documentos são exatamente três, as duas governadas exibem o retrato devido, o conjunto público cresceu em 1, e a superfície fecha pelas duas medições, que concordam entre si', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // SANIDADE: o inventário desta sub-fatia tem TRÊS pares — afirmado ANTES de comparar
    // ---------------------------------------------------------------------------------------
    //
    // Sobre o próprio inventário, e não sobre a superfície: uma lista truncada faria as igualdades
    // abaixo passarem sobre menos rotas do que a sub-fatia publica, que é o modo de falha silencioso
    // desta classe. As duas metades são afirmadas separadamente porque moram em conjuntos diferentes
    // da cobertura — a governada no positivo, a do titular no público —, e a soma delas contra a
    // âncora é o que impede uma de crescer enquanto a outra encolhe.
    const paresDoTitular = paresDoAtoDoTitular();
    const inventarioDaSubFatia = [...PARES_DA_FATIA_DE_DOCUMENTOS, ...paresDoTitular];

    expect(inventarioDaSubFatia.length).toBe(PARES_PUBLICADOS_PELA_SUB_FATIA_DE_DOCUMENTOS);
    expect(paresDoTitular.length).toBe(PARES_PUBLICOS_DA_SUB_FATIA);
    expect(MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS.length).toBe(
      PARES_DA_FATIA_DE_DOCUMENTOS.length,
    );

    // ---------------------------------------------------------------------------------------
    // O predicado da ADR-0011: `semDeclaracao` VAZIO, por igualdade de lista
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e **nunca** `toHaveLength(0)`: a falha precisa nomear o par, o controlador
    // e o manipulador que ficaram sem declaração — um comprimento diria apenas que há alguém.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As duas governadas constam do conjunto POSITIVO, nomeadas, e nenhuma escapou por
    // `@RotaPublica()` — a escapatória que a existência da declaração sozinha não fecha: a guarda
    // retorna antes para rota pública, e o conjunto sem declaração continuaria vazio.
    expect(
      PARES_DA_FATIA_DE_DOCUMENTOS.filter((par) => !cobertura.comExigencia.includes(par)),
    ).toEqual([]);
    expect(PARES_DA_FATIA_DE_DOCUMENTOS.filter((par) => cobertura.publicas.includes(par))).toEqual(
      [],
    );
    expect(
      PARES_DA_FATIA_DE_DOCUMENTOS.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O ato do titular: no conjunto PÚBLICO, e o conjunto cresceu em EXATAMENTE 1 (ADR-0027)
    // ---------------------------------------------------------------------------------------
    //
    // As três asserções abaixo são as três direções, e nenhuma implica as outras: o par novo está no
    // público e **não** no positivo (a dispensa é declarada, não ausência); o que o público ganhou é
    // **exatamente** este par (uma segunda rota sem sessão apareceria aqui nomeada); e o tamanho
    // fecha na âncora anterior mais um (uma pública anterior que sumisse não apareceria no filtro,
    // e só a contagem a pega).
    expect(paresDoTitular.filter((par) => !cobertura.publicas.includes(par))).toEqual([]);
    expect(paresDoTitular.filter((par) => cobertura.comExigencia.includes(par))).toEqual([]);

    const publicasAnteriores = PARES_PUBLICOS_ACEITOS.filter(
      (par) => !paresDoTitular.includes(par),
    );

    expect(publicasAnteriores.length).toBe(PARES_PUBLICOS_ANTES_DA_SUB_FATIA);
    expect(
      cobertura.publicas.filter((par) => !publicasAnteriores.includes(par)),
      'o conjunto de rotas que dispensam sessão mudou: cada entrada aqui é uma rota fora da autorização',
    ).toEqual(paresDoTitular);
    expect(cobertura.publicas.length).toBe(
      PARES_PUBLICOS_ANTES_DA_SUB_FATIA + PARES_PUBLICOS_DA_SUB_FATIA,
    );

    // E a ausência que a ADR-0027 troca por portador de segredo: o manipulador do ato do titular não
    // declara exigência **nem no método nem na classe**. A asserção é sobre a mensagem exata, e não
    // sobre "levantou": a mesma função levanta também para rótulo inexistente, e um erro de digitação
    // no rótulo satisfaria um `toThrow()` genérico sem provar nada sobre a rota.
    const semExigencia = capturar(() =>
      exigenciaEfetivaDoManipulador(aplicacaoReal, MANIPULADOR_DO_ATO_DO_TITULAR),
    );

    expect(semExigencia?.message).toBe(
      `${MANIPULADOR_DO_ATO_DO_TITULAR} ${SEM_EXIGENCIA_NEM_NO_METODO_NEM_NA_CLASSE}`,
    );

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das duas declarações governadas, por igualdade de OBJETO — com a ORIGEM junto
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte. A origem viaja com ela porque `getAllAndOverride`
    // **substitui**, e sem a origem uma declaração de método com os mesmos átomos da classe seria
    // indistinguível da herança (ver {@link RetratoDaExigencia}) — que nestas duas rotas é o defeito
    // exato, e o único invisível na borda.
    // A GARANTIA NOMEADA primeiro: nenhum dos dois exige MENOS do que a classe dele, e a asserção
    // NOMEIA o ofensor — é o *onde* que decide se houve descuido ou linha copiada.
    //
    // ⚠️ **Ela vem ANTES da igualdade do retrato, e a ordem é conteúdo** — é o fecho do
    // débito `D61` da T14, cujo gatilho a T17 disparou ao acrescentar a este arquivo
    // o `CT-937`. Com o retrato primeiro, a igualdade **aborta o caso** e esta linha nunca executa no
    // estado que ela existe para pegar, que é o AP-29 medido pelo `MT14-1`. Nenhuma asserção foi
    // removida nem afrouxada — só a ordem entre elas mudou, e o molde é o do `CT-836`.
    const substituicoesDaSubFatia = declaracoesQueSubstituemAClasse(aplicacaoReal).filter(
      (violacao) =>
        MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS.includes(
          `${violacao.controlador}.${violacao.manipulador}`,
        ),
    );

    expect(
      substituicoesDaSubFatia,
      `manipulador da sub-fatia que exige MENOS que a classe: ${substituicoesDaSubFatia
        .map((violacao) => `${violacao.controlador}.${violacao.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // NENHUMA das duas exige chave de ação, e a asserção **nomeia** a que encontrar — acrescentar
    // chave de ação aqui exigiria abrir o catálogo fechado, que é decisão de ADR e não linha num
    // decorador.
    expect(
      chavesDeAcaoExigidasEm(
        exigenciasEfetivasDe(aplicacaoReal, MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS),
      ),
    ).toEqual([]);

    expect(retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS)).toEqual(
      RETRATO_DEVIDO_POR_MANIPULADOR_DOS_DOCUMENTOS,
    );

    // O par que discrimina a leitura da ORIGEM: nenhum dos dois declara no MÉTODO, e um manipulador
    // que **declara** continua sendo visto pela mesma varredura. Sem a segunda linha, "os dois valem
    // pela classe" seria satisfeito por uma varredura que não enxergasse declaração de método alguma.
    const noMetodoDaSubFatia = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(
      MANIPULADORES_GOVERNADOS_DOS_DOCUMENTOS.filter((rotulo) => noMetodoDaSubFatia.has(rotulo)),
    ).toEqual([]);
    expect(noMetodoDaSubFatia.get('ContratoController.cancelar')).toEqual([
      AREA_DOS_CONTRATOS,
      'ACAO:cancelar_contrato',
    ]);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da sub-fatia, por DUAS medições independentes que têm de concordar
    // ---------------------------------------------------------------------------------------
    //
    // A primeira lê a **tabela do roteador** já montado; a segunda varre os **decoradores dos
    // controladores** e compõe: cada manipulador reivindica um par, salvo o `@All`, que reivindica os
    // sete verbos do caminho dele, mais os nove pares registrados direto no adaptador, que não têm
    // manipulador. Nenhuma é derivada da outra — é essa independência que mediu `75` onde a §11.2 de
    // uma fatia anterior estimava `77`, e localizou o erro na soma em vez de no escopo entregue.
    //
    // É a conferência FINAL da sub-fatia: as âncoras já foram subidas por T7 (86 → 87), T9 (87 → 88)
    // e T11 (88 → 89), e aqui elas são **conferidas**, nunca acrescentadas — é isso que impede a
    // superfície de ser derivada de si mesma.
    const manipuladores = manipuladoresExaminados(aplicacaoReal);
    const comTodosOsVerbos = manipuladoresQueAtendemTodosOsVerbos(aplicacaoReal);
    const pelaComposicao =
      manipuladores -
      comTodosOsVerbos +
      comTodosOsVerbos * METODOS_DO_ENCAMINHADOR.length +
      ROTAS_FORA_DO_ARCABOUCO.length;

    // A igualdade entre os dois eixos é afirmada **explicitamente**, e ANTES da comparação com a
    // âncora: duas medições que concordassem com o valor esperado por acidente e discordassem entre
    // si passariam pela comparação de baixo, e é a concordância delas que torna cada uma verificável
    // pela outra. Foi a ausência desta linha que a sub-fatia irmã corrigiu ao fechar o `CT-635`.
    expect(
      pelaComposicao,
      'as duas medições independentes da superfície publicada divergiram entre si: o errado é a âncora, nunca a medição',
    ).toBe(cobertura.rotasEnumeradas);

    // As quatro grandezas viajam numa comparação só de propósito: se alguma divergir, a falha
    // **nomeia os números** lado a lado.
    expect(
      {
        peloRoteador: cobertura.rotasEnumeradas,
        pelaComposicao,
        manipuladores,
        comTodosOsVerbos,
      },
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toEqual({
      peloRoteador: ROTAS_PUBLICADAS_EM_PRODUCAO,
      pelaComposicao: ROTAS_PUBLICADAS_EM_PRODUCAO,
      manipuladores: MANIPULADORES_EXAMINADOS_EM_PRODUCAO,
      comTodosOsVerbos: MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS,
    });

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por esta sub-fatia
    // ---------------------------------------------------------------------------------------
    //
    // As dez áreas de tela, por igualdade de arranjo contra a lista escrita à mão: nenhuma área nova
    // nasceu, e nenhuma saiu. É a metade executável do critério *"`catalogo-de-permissoes.ts` não foi
    // tocado por task alguma da sub-fatia"* — a outra metade é a conferência do diff, que o Gate 2
    // faz.
    expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO);

    // E o eixo das ações, nas duas áreas desta sub-fatia: as duas de contrato e a única de cadastro,
    // todas anteriores a ela. É a asserção que reprova a rodada que "resolvesse" um problema de
    // autorização criando chave nova em vez de escalar — abrir o catálogo exigiria supersedê-la
    // ADR-0011.
    expect(acoesSensiveisDaArea(AREA_DOS_CONTRATOS)).toEqual(ACOES_SENSIVEIS_DOS_CONTRATOS);
    expect(acoesSensiveisDaArea(AREA_DOS_CADASTROS)).toEqual(ACOES_SENSIVEIS_DOS_CADASTROS);
  });

  it('CT-836 — as três rotas da fatia bancária são exatamente três, exibem o retrato devido, o conjunto público não cresceu, e a superfície fecha em 92 pares / 77 manipuladores pelas duas medições, que concordam entre si', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // SANIDADE: o inventário desta fatia tem TRÊS pares — por extenso, e ANTES de comparar
    // ---------------------------------------------------------------------------------------
    //
    // Sobre o próprio inventário, e não sobre a superfície. É o que impede o caso de *"fechar a
    // conta"* por acaso quando duas rotas mudarem em direções opostas: uma lista truncada faria as
    // igualdades abaixo passarem sobre menos rotas do que a fatia publica, e a soma continuaria
    // batendo com a âncora do total.
    expect(INVENTARIO_DA_FATIA_BANCARIA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_BANCARIA);
    expect(MANIPULADORES_DA_FATIA_BANCARIA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_BANCARIA);

    // O inventário escrito à mão contra o COMPOSTO das constantes que o controlador publica: um
    // segmento que mudasse no fonte sem passar pela revisão desta lista reprova aqui, nomeando o par.
    expect(
      INVENTARIO_DA_FATIA_BANCARIA.map((entrada) => `${entrada.metodo} ${entrada.caminho}`).sort(),
      'o caminho publicado divergiu do inventário revisado desta fatia',
    ).toEqual([...PARES_DA_FATIA_BANCARIA]);

    // E o controlador declarado no inventário é o mesmo que carrega os três rótulos auditados abaixo
    // — a ligação entre a coluna `controlador` e a aplicação montada, que `retratoDasExigenciasDe`
    // fecha ao levantar para rótulo inexistente.
    expect(
      MANIPULADORES_DA_FATIA_BANCARIA.map((rotulo) => rotulo.split('.')[0]),
      'o controlador dos manipuladores auditados divergiu do inventário desta fatia',
    ).toEqual(INVENTARIO_DA_FATIA_BANCARIA.map((entrada) => entrada.controlador));

    // ---------------------------------------------------------------------------------------
    // O predicado da ADR-0011: `semDeclaracao` VAZIO, por igualdade de lista
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e **nunca** `toHaveLength(0)`: a falha precisa nomear
    // `{ metodo, caminho, controlador, manipulador }` de quem ficou sem declaração — um comprimento
    // diria apenas que há alguém.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As três constam do conjunto POSITIVO, nomeadas, e nenhuma escapou por `@RotaPublica()` — a
    // escapatória que a existência da declaração sozinha não fecha: a guarda retorna antes para rota
    // pública, e o conjunto sem declaração continuaria vazio.
    expect(PARES_DA_FATIA_BANCARIA.filter((par) => !cobertura.comExigencia.includes(par))).toEqual(
      [],
    );
    expect(PARES_DA_FATIA_BANCARIA.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(
      PARES_DA_FATIA_BANCARIA.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O conjunto público NÃO cresceu — e a contagem é o que prova isso
    // ---------------------------------------------------------------------------------------
    //
    // As duas asserções são direções diferentes, e nenhuma implica a outra: o filtro acima diz que
    // **estas três** não estão no público, e a contagem diz que **nenhuma outra** entrou. Uma rota
    // desta fatia marcada `@RotaPublica()` e retirada do inventário positivo satisfaria o filtro e
    // reprovaria só aqui.
    expect(PARES_PUBLICOS_ACEITOS.length).toBe(PARES_PUBLICOS_DA_SUPERFICIE);
    expect(
      cobertura.publicas.length,
      'o conjunto de rotas que dispensam sessão mudou de tamanho: cada entrada nele é uma rota fora da autorização',
    ).toBe(PARES_PUBLICOS_DA_SUPERFICIE);

    // ---------------------------------------------------------------------------------------
    // A GARANTIA NOMEADA vem ANTES da igualdade que fixa o valor — e a ordem é conteúdo
    // ---------------------------------------------------------------------------------------
    //
    // **Nenhum** dos três exige MENOS do que a classe dele, e a asserção NOMEIA o manipulador
    // ofensor: é o *onde* que decide se houve descuido ou linha copiada — e a coerência do catálogo
    // esconderia o defeito na borda, porque `MAPA_ACAO_TELA['ACAO:configurar_integracao']` é a
    // própria área, de modo que o registro declarando só a ação continuaria exigindo-a por acidente.
    //
    // ⚠️ **Ela vem antes do retrato, e o `CT-635` e o `CT-732` a põem depois.** A divergência é
    // deliberada e foi MEDIDA: com o mutante que troca `@ExigeChaves(área, ação)` por
    // `@ExigeChave(ação)`, a igualdade de objeto do retrato aborta o caso e esta linha **nunca
    // executa** — que é o AP-29 pelo qual duas tasks desta fatia foram reprovadas. Invertida, o que
    // sai primeiro é a garantia com o nome do ofensor, e o retrato continua reprovando logo abaixo
    // quando o defeito for de outra natureza. Nenhuma asserção foi removida nem afrouxada.
    const substituicoesDaFatia = declaracoesQueSubstituemAClasse(aplicacaoReal).filter((violacao) =>
      MANIPULADORES_DA_FATIA_BANCARIA.includes(`${violacao.controlador}.${violacao.manipulador}`),
    );

    expect(
      substituicoesDaFatia,
      `manipulador da fatia que exige MENOS que a classe: ${substituicoesDaFatia
        .map((violacao) => `${violacao.controlador}.${violacao.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das três declarações, por igualdade de OBJETO — com a ORIGEM junto
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte: é ela que o cliente encontra. A origem viaja com ela porque
    // `getAllAndOverride` **substitui**, e sem a origem uma conjunção declarada no método seria
    // indistinguível da herança da classe (ver {@link RetratoDaExigencia}) — que nas duas rotas que
    // valem pela classe é o defeito exato, e o único invisível na borda.
    expect(retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DA_FATIA_BANCARIA)).toEqual(
      RETRATO_DEVIDO_POR_MANIPULADOR_BANCARIO,
    );

    // O par que discrimina a leitura da ORIGEM: exatamente **um** dos três declara no método, e
    // declara a conjunção na ORDEM em que o decorador a gravou. Sem esta linha, "dois valem pela
    // classe" seria satisfeito por uma varredura que não enxergasse declaração de método alguma; sem
    // a igualdade de arranjo, a ordem invertida — que troca a chave nomeada na recusa — passaria.
    const noMetodoDaFatia = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(MANIPULADORES_DA_FATIA_BANCARIA.filter((rotulo) => noMetodoDaFatia.has(rotulo))).toEqual(
      [`${CONTROLADOR_DA_FATIA_BANCARIA}.registrar`],
    );
    expect(noMetodoDaFatia.get(`${CONTROLADOR_DA_FATIA_BANCARIA}.registrar`)).toEqual([
      AREA_DAS_INTEGRACOES_BANCARIAS,
      ACAO_DE_CONFIGURACAO_DE_INTEGRACAO,
    ]);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da fatia, por DUAS medições independentes que têm de concordar
    // ---------------------------------------------------------------------------------------
    //
    // A primeira lê a **tabela do roteador** já montado; a segunda varre os **decoradores dos
    // controladores** e compõe: cada manipulador reivindica um par, salvo o `@All`, que reivindica os
    // sete verbos do caminho dele, mais os nove pares registrados direto no adaptador, que não têm
    // manipulador. Nenhuma é derivada da outra — é essa independência que mediu `75` onde a §11.2 de
    // uma fatia anterior estimava `77`, e localizou o erro na soma em vez de no escopo entregue.
    //
    // É a conferência FINAL da fatia, e o **fecho do número da F4**: as âncoras já foram subidas por
    // T11 (89 → 91) e T12 (91 → 92), e aqui elas são **conferidas**, nunca acrescentadas — é isso que
    // impede a superfície de ser derivada de si mesma.
    const manipuladores = manipuladoresExaminados(aplicacaoReal);
    const comTodosOsVerbos = manipuladoresQueAtendemTodosOsVerbos(aplicacaoReal);
    const pelaComposicao =
      manipuladores -
      comTodosOsVerbos +
      comTodosOsVerbos * METODOS_DO_ENCAMINHADOR.length +
      ROTAS_FORA_DO_ARCABOUCO.length;

    // A igualdade entre os dois eixos é afirmada **explicitamente**, e ANTES da comparação com a
    // âncora: duas medições que concordassem com o valor esperado por acidente e discordassem entre
    // si passariam pela comparação de baixo, e é a concordância delas que torna cada uma verificável
    // pela outra.
    expect(
      pelaComposicao,
      'as duas medições independentes da superfície publicada divergiram entre si: o errado é a âncora, nunca a medição',
    ).toBe(cobertura.rotasEnumeradas);

    // As quatro grandezas viajam numa comparação só de propósito: se alguma divergir, a falha
    // **nomeia os números** lado a lado.
    expect(
      {
        peloRoteador: cobertura.rotasEnumeradas,
        pelaComposicao,
        manipuladores,
        comTodosOsVerbos,
      },
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toEqual({
      peloRoteador: ROTAS_PUBLICADAS_EM_PRODUCAO,
      pelaComposicao: ROTAS_PUBLICADAS_EM_PRODUCAO,
      manipuladores: MANIPULADORES_EXAMINADOS_EM_PRODUCAO,
      comTodosOsVerbos: MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS,
    });

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por esta fatia
    // ---------------------------------------------------------------------------------------
    //
    // As dez áreas de tela, por igualdade de arranjo contra a lista escrita à mão: nenhuma área nova
    // nasceu, e nenhuma saiu. É a metade executável do critério *"`catalogo-de-permissoes.ts` não foi
    // tocado por task alguma da fatia"* — a outra metade é a conferência do diff, que o Gate 2 faz.
    expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO);

    // E o eixo das ações, na área desta fatia: `TELA:integracoes_bancarias` tem exatamente a da
    // configuração, anterior a ela. É a asserção que reprova a rodada que "resolvesse" um problema de
    // autorização criando chave nova em vez de escalar.
    expect(acoesSensiveisDaArea(AREA_DAS_INTEGRACOES_BANCARIAS)).toEqual(
      ACOES_SENSIVEIS_DAS_INTEGRACOES_BANCARIAS,
    );

    // E o catálogo continua com as 17 chaves das duas metades — a âncora que o `CT-212` já usa do
    // lado da sessão, afirmada aqui do lado da declaração.
    expect(CHAVES_DE_TELA.length + Object.keys(MAPA_ACAO_TELA).length).toBe(TOTAL_DE_CHAVES);
  });

  it('CT-918 (f) — os dois atos sobre o boleto declaram no MÉTODO a conjunção área+ação, nesta ordem, e as demais rotas de cobrança — as cinco anteriores e as duas leituras da T14 — continuam valendo pela CLASSE', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // SANIDADE: os inventários desta task têm DOIS e CINCO — por extenso, e ANTES de comparar
    // ---------------------------------------------------------------------------------------
    //
    // Sobre os próprios inventários, e não sobre a superfície: uma lista truncada faria as
    // igualdades abaixo passarem sobre menos rotas do que a task publica, que é o modo de falha
    // silencioso desta classe de caso.
    expect(MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO.length).toBe(
      PARES_PUBLICADOS_PELOS_ATOS_SOBRE_O_BOLETO,
    );
    // SUT_IS_CORRECT_BECAUSE: o inventário da FATIA passou de dois para quatro pares com a T14, e o
    // esperado desta linha passa a ser a constante da **fatia**, não a dos **atos** — as duas
    // grandezas são diferentes, e a dos atos continua ancorando a lista de manipuladores acima,
    // intacta em dois. O que a asserção mede — *"a lista não está truncada"* — **não foi
    // afrouxado**: continua sendo igualdade exata contra uma constante escrita à mão, agora com os
    // dois grupos somados por nome. ⚠️ O número **não se repete aqui de propósito**: cada task que
    // publica rota o move (a T15 o levou de quatro a sete), e o registro de cada salto mora ao lado
    // da constante que o produz — ver o docblock de `PARES_PUBLICADOS_PELA_COBRANCA_BANCARIA`. Um
    // número narrativo repetido nesta linha fica para trás na task seguinte sem que nada acuse.
    expect(PARES_DA_FATIA_DE_EMISSAO.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DE_EMISSAO);
    expect(MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO.length).toBe(
      PARES_PUBLICADOS_PELAS_LEITURAS_SOBRE_O_BOLETO,
    );
    expect(MANIPULADORES_DE_COBRANCA_SEM_ATO_SOBRE_BOLETO.length).toBe(
      ROTAS_DE_COBRANCA_ANTERIORES_A_ESTA_FATIA,
    );

    // Os dois manipuladores auditados vivem no controlador que publica as rotas — a ligação entre o
    // rótulo e a aplicação montada, que `retratoDasExigenciasDe` fecha ao levantar para rótulo
    // inexistente.
    expect(
      MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO.map((rotulo) => rotulo.split('.')[0]),
      'o controlador dos manipuladores auditados divergiu do declarado nesta prova',
    ).toEqual([CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO, CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO]);

    // ---------------------------------------------------------------------------------------
    // O predicado da ADR-0011: `semDeclaracao` VAZIO, e as duas no conjunto POSITIVO
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e nunca `toHaveLength(0)`: a falha precisa nomear
    // `{ metodo, caminho, controlador, manipulador }` de quem ficou sem declaração.
    expect(cobertura.semDeclaracao).toEqual([]);
    expect(
      PARES_DA_FATIA_DE_EMISSAO.filter((par) => !cobertura.comExigencia.includes(par)),
    ).toEqual([]);
    // E nenhuma escapou por `@RotaPublica()` — a escapatória que a existência da declaração sozinha
    // não fecha: a guarda retorna antes para rota pública, e `semDeclaracao` continuaria vazio.
    expect(PARES_DA_FATIA_DE_EMISSAO.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(
      PARES_DA_FATIA_DE_EMISSAO.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // A GARANTIA NOMEADA vem ANTES da igualdade que fixa o valor — o molde canônico do `CT-836`
    // ---------------------------------------------------------------------------------------
    //
    // **Nenhum** dos dois exige MENOS do que a classe, e a asserção NOMEIA o manipulador ofensor: é
    // o *onde* que decide se houve descuido ou linha copiada. Este caso nasce já na ordem que o
    // `MT14-1` mediu — garantia primeiro, retrato depois —, e por isso ele NÃO é o gatilho do
    // débito `D61` da T14: aquele agendava a subida da garantia nos três irmãos de fatias
    // fechadas (`CT-533`, `CT-635`, `CT-732`), e o caso de **fecho de superfície** desta fatia, que
    // confere as âncoras por dupla medição, é o `CT-937`, da T17. O marcador segue intocado.
    const substituicoesDosAtos = declaracoesQueSubstituemAClasse(aplicacaoReal).filter((violacao) =>
      MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO.includes(
        `${violacao.controlador}.${violacao.manipulador}`,
      ),
    );

    expect(
      substituicoesDosAtos,
      `ato sobre o boleto que exige MENOS que a classe: ${substituicoesDosAtos
        .map((violacao) => `${violacao.controlador}.${violacao.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das duas declarações, por igualdade de OBJETO — com a ORIGEM junto
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte: é ela que o cliente encontra. A origem viaja com ela porque
    // `getAllAndOverride` **substitui**, e sem a origem uma conjunção declarada no método seria
    // indistinguível da herança da classe.
    //
    // ⚠️ **É esta linha que reprova a perda da chave de ação.** Trocar
    // `@ExigeChaves(AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO)` por
    // `@ExigeChave(AREA_DO_FINANCEIRO)` no controlador — que é remover, das duas rotas que **movem
    // dinheiro**, a chave que a ADR-0021 exige justamente por isso — não muda nem `comExigencia`,
    // nem `semDeclaracao`, nem o `CT-355` (a declaração continuaria contendo a da classe), e é
    // **invisível por comportamento para a área**, porque `MAPA_ACAO_TELA['ACAO:emitir_boleto']` é a
    // própria `TELA:financeiro`. Aqui ela reprova nomeando o manipulador, e na borda o `CT-918 (e)`
    // de `boleto-da-cobranca.e2e.spec.ts` a reprova pelo `403` que deixaria de acontecer.
    expect(retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO)).toEqual(
      RETRATO_DEVIDO_POR_MANIPULADOR_DE_EMISSAO,
    );

    // A ORDEM dos átomos, lida do decorador do MÉTODO e afirmada por igualdade de arranjo: ela é
    // conteúdo, porque a recusa nomeia a **primeira** chave ausente (ADR-0018). Uma conjunção com os
    // mesmos dois átomos invertidos satisfaz a contenção da classe, muda o corpo que o cliente lê, e
    // reprova só aqui e no `CT-918 (e)`.
    const noMetodoDosAtos = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(
      MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO.filter((rotulo) => noMetodoDosAtos.has(rotulo)),
    ).toEqual([...MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO]);
    expect(noMetodoDosAtos.get(`${CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO}.emitirBoleto`)).toEqual([
      AREA_DO_FINANCEIRO,
      ACAO_DE_EMISSAO_DE_BOLETO,
    ]);
    expect(noMetodoDosAtos.get(`${CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO}.revogarBoleto`)).toEqual([
      AREA_DO_FINANCEIRO,
      ACAO_DE_SOLICITACAO_DE_BAIXA,
    ]);

    // ---------------------------------------------------------------------------------------
    // A VIZINHANÇA: as outras cinco rotas de `/v1/cobrancas` continuam valendo pela CLASSE
    // ---------------------------------------------------------------------------------------
    //
    // Sem elas, a assimetria não seria observável: uma rodada que "uniformizasse" o controlador —
    // subindo as duas ações para a classe, ou descendo a área para os cinco métodos — mudaria a
    // exigência efetiva de sete rotas, e o retrato dos dois atos continuaria idêntico. O esperado é
    // derivado de {@link EXIGENCIA_DEVIDA_POR_MANIPULADOR}, que o `CT-533` já afirma contra o SUT —
    // e não de uma segunda cópia livre para divergir dela.
    expect(
      MANIPULADORES_DE_COBRANCA_SEM_ATO_SOBRE_BOLETO.filter((rotulo) =>
        noMetodoDosAtos.has(rotulo),
      ),
      'rota de cobrança anterior a esta fatia passou a declarar exigência no MÉTODO',
    ).toEqual([]);
    expect(
      retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DE_COBRANCA_SEM_ATO_SOBRE_BOLETO),
    ).toEqual(RETRATO_DEVIDO_PELAS_CINCO_DE_COBRANCA);

    // ---------------------------------------------------------------------------------------
    // As DUAS LEITURAS da T14: exigência da CLASSE, e NADA declarado no método
    // ---------------------------------------------------------------------------------------
    //
    // A garantia nomeada vem ANTES da igualdade que fixa o valor, no molde canônico do `CT-836`:
    // nenhuma das duas declara no método, e a asserção NOMEIA a ofensora — é o *onde* que decide se
    // houve descuido ou linha copiada do vizinho de cima, que é o risco concreto num controlador em
    // que quatro rotas acima declaram a conjunção inteira.
    const noMetodoDasLeituras = MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO.filter((rotulo) =>
      noMetodoDosAtos.has(rotulo),
    );

    expect(
      noMetodoDasLeituras,
      `leitura sobre o boleto passou a declarar exigência no MÉTODO: ${noMetodoDasLeituras.join(', ')}`,
    ).toEqual([]);

    // E o CONTEÚDO, por igualdade de objeto, com a ORIGEM junto: `getAllAndOverride` **substitui**, e
    // sem a origem uma declaração de método idêntica à da classe seria indistinguível da herança —
    // que é exatamente a linha "óbvia" e perigosa que este mapa fecha. A igualdade também reprova o
    // caminho oposto: uma ação sensível exigida numa leitura, que negaria a segunda via a quem pode
    // ver a cobrança, e que nenhuma outra prova desta base acusaria.
    expect(
      retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO),
    ).toEqual(RETRATO_DEVIDO_PELAS_LEITURAS_SOBRE_O_BOLETO);

    // As duas vivem no MESMO controlador dos atos — a ligação entre o rótulo e a aplicação montada,
    // que `retratoDasExigenciasDe` fecha ao levantar para rótulo inexistente.
    expect(
      MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO.map((rotulo) => rotulo.split('.')[0]),
      'o controlador das leituras auditadas divergiu do declarado nesta prova',
    ).toEqual([CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO, CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO]);

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por esta task
    // ---------------------------------------------------------------------------------------
    //
    // As duas ações que os retratos acima citam são exatamente as que `TELA:financeiro` já
    // comportava antes desta fatia — nenhuma nasceu para governar as rotas novas. É também o que
    // liga os dois literais escritos à mão ao catálogo real: uma chave inventada aqui reprovaria
    // nesta igualdade, e não só no retrato.
    expect(acoesSensiveisDaArea(AREA_DO_FINANCEIRO)).toEqual([
      ACAO_DE_EMISSAO_DE_BOLETO,
      ACAO_DE_SOLICITACAO_DE_BAIXA,
    ]);
    expect(CHAVES_DE_TELA.length + Object.keys(MAPA_ACAO_TELA).length).toBe(TOTAL_DE_CHAVES);
  });

  it('CT-937 — a superfície publicada fecha em 99 pares e 84 manipuladores pelas DUAS medições, as sete rotas da fatia constam nomeadas, `semDeclaracao` é vazio e o catálogo segue com 17 chaves', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // SANIDADE: o inventário desta fatia tem SETE pares e SETE manipuladores, ANTES de comparar
    // ---------------------------------------------------------------------------------------
    //
    // Sobre os próprios inventários, e não sobre a superfície: uma lista truncada faria as
    // igualdades abaixo passarem sobre menos rotas do que a fatia publica, e a soma final
    // continuaria batendo com a âncora do total — o modo de falha silencioso desta classe de prova.
    expect(PARES_DA_FATIA_DE_EMISSAO.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DE_EMISSAO);
    expect(MANIPULADORES_DA_FATIA_DE_EMISSAO.length).toBe(PARES_PUBLICADOS_PELA_FATIA_DE_EMISSAO);
    expect(Object.keys(RETRATO_DEVIDO_PELA_FATIA_DE_EMISSAO).length).toBe(
      PARES_PUBLICADOS_PELA_FATIA_DE_EMISSAO,
    );

    // Os três grupos que a compõem, cada um pelo próprio tamanho: o total sozinho não distingue
    // "as três de `/v1/cobranca-bancaria` entraram" de "entraram e duas leituras saíram".
    expect(MANIPULADORES_DOS_ATOS_SOBRE_O_BOLETO.length).toBe(
      PARES_PUBLICADOS_PELOS_ATOS_SOBRE_O_BOLETO,
    );
    expect(MANIPULADORES_DAS_LEITURAS_SOBRE_O_BOLETO.length).toBe(
      PARES_PUBLICADOS_PELAS_LEITURAS_SOBRE_O_BOLETO,
    );
    expect(MANIPULADORES_DA_COBRANCA_BANCARIA.length).toBe(PARES_PUBLICADOS_PELA_COBRANCA_BANCARIA);

    // E os controladores que carregam os sete rótulos são os dois que a fatia publica — a ligação
    // entre a coluna e a aplicação montada, que `retratoDasExigenciasDe` fecha ao levantar para
    // rótulo inexistente.
    expect(
      [...new Set(MANIPULADORES_DA_FATIA_DE_EMISSAO.map((rotulo) => rotulo.split('.')[0]))].sort(),
      'o controlador dos manipuladores auditados divergiu do declarado nesta prova',
    ).toEqual([CONTROLADOR_DA_COBRANCA_BANCARIA, CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO].sort());

    // ---------------------------------------------------------------------------------------
    // AS SETE ROTAS CONSTAM NOMEADAS do inventário POSITIVO — e nenhuma escapou
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de lista, e nunca `toHaveLength(0)`: a falha precisa nomear
    // `{ metodo, caminho, controlador, manipulador }` de quem ficou sem declaração.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As sete no conjunto POSITIVO, por igualdade de ARRANJO ORDENADO contra o inventário revisado, e
    // nunca por `toContain`: um par que sumisse do conjunto que declara exigência reprova como
    // ausente, e um par cujo caminho mudasse no fonte sem passar por esta lista reprova como
    // excedente. É a forma que o `CT-836` já usa, e as duas direções vivem na mesma comparação.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_EMISSAO.includes(par)).sort(),
      'o inventário das sete rotas desta fatia divergiu do conjunto que declara exigência',
    ).toEqual([...PARES_DA_FATIA_DE_EMISSAO]);

    // E nenhuma escapou por `@RotaPublica()` nem para fora do arcabouço — as duas escapatórias que a
    // existência da declaração sozinha não fecha: a guarda retorna antes para rota pública, e
    // `semDeclaracao` continuaria vazio nas duas.
    expect(PARES_DA_FATIA_DE_EMISSAO.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(
      PARES_DA_FATIA_DE_EMISSAO.filter((par) => cobertura.foraDoArcabouco.includes(par)),
    ).toEqual([]);

    // O conjunto público NÃO cresceu, e a contagem é o que prova isso: o filtro acima diz que
    // **estas sete** não estão no público, e a contagem diz que **nenhuma outra** entrou. Uma rota
    // desta fatia marcada `@RotaPublica()` e retirada do inventário positivo satisfaria o filtro e
    // reprovaria só aqui.
    expect(PARES_PUBLICOS_ACEITOS.length).toBe(PARES_PUBLICOS_DA_SUPERFICIE);
    expect(
      cobertura.publicas.length,
      'o conjunto de rotas que dispensam sessão mudou de tamanho: cada entrada nele é uma rota fora da autorização',
    ).toBe(PARES_PUBLICOS_DA_SUPERFICIE);

    // ---------------------------------------------------------------------------------------
    // A GARANTIA NOMEADA vem ANTES da igualdade que fixa o valor — o molde canônico do `CT-836`
    // ---------------------------------------------------------------------------------------
    //
    // **Nenhum** dos sete exige MENOS do que a classe dele, e a asserção NOMEIA o manipulador
    // ofensor: é o *onde* que decide se houve descuido ou linha copiada. Ela vem antes do retrato
    // porque a igualdade de objeto **aborta o caso** ao reprovar, e com o retrato primeiro esta linha
    // nunca executaria no estado que ela existe para pegar — é o AP-29 que o `MT14-1` mediu, e é o
    // fecho do débito `D61` da T14, cujo gatilho este caso dispara.
    const substituicoesDaFatia = declaracoesQueSubstituemAClasse(aplicacaoReal).filter((violacao) =>
      MANIPULADORES_DA_FATIA_DE_EMISSAO.includes(`${violacao.controlador}.${violacao.manipulador}`),
    );

    expect(
      substituicoesDaFatia,
      `manipulador da fatia que exige MENOS que a classe: ${substituicoesDaFatia
        .map((violacao) => `${violacao.controlador}.${violacao.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // O CONTEÚDO das sete declarações, por igualdade de OBJETO — com a ORIGEM junto
    // ---------------------------------------------------------------------------------------
    //
    // A exigência é a **efetiva** — lida pelo MESMO `getAllAndOverride([alvo, classe])` da guarda —,
    // e não o que está escrito no fonte. A origem viaja com ela porque `getAllAndOverride`
    // **substitui**, e sem a origem uma declaração de método idêntica à da classe seria
    // indistinguível da herança: é ela que separa os dois atos, que declaram a conjunção, das quatro
    // rotas que valem pela classe.
    expect(retratoDasExigenciasDe(aplicacaoReal, MANIPULADORES_DA_FATIA_DE_EMISSAO)).toEqual(
      RETRATO_DEVIDO_PELA_FATIA_DE_EMISSAO,
    );

    // Exatamente **três** dos sete declaram no MÉTODO, e a lista é afirmada por igualdade de arranjo
    // — não por contagem: sem ela, "três declaram" seria satisfeito por três quaisquer.
    const noMetodoDaFatia = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(
      MANIPULADORES_DA_FATIA_DE_EMISSAO.filter((rotulo) => noMetodoDaFatia.has(rotulo)),
    ).toEqual([
      `${CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO}.emitirBoleto`,
      `${CONTROLADOR_DOS_ATOS_SOBRE_O_BOLETO}.revogarBoleto`,
      `${CONTROLADOR_DA_COBRANCA_BANCARIA}.abrirEmissao`,
    ]);

    // E a ORDEM dos átomos do lote, lida do decorador do MÉTODO: ela é conteúdo, porque a recusa
    // nomeia a **primeira** chave ausente (ADR-0018). Os dois átomos invertidos satisfazem a
    // contenção da classe, mudam o corpo que o cliente lê, e reprovam aqui.
    expect(noMetodoDaFatia.get(`${CONTROLADOR_DA_COBRANCA_BANCARIA}.abrirEmissao`)).toEqual([
      AREA_DO_FINANCEIRO,
      ACAO_DE_EMISSAO_DE_BOLETO,
    ]);

    // ---------------------------------------------------------------------------------------
    // AS DUAS ÂNCORAS FINAIS DA FATIA — e é aqui que a F4 (ii) FECHA
    // ---------------------------------------------------------------------------------------
    //
    // A primeira lê a **tabela do roteador** já montado; a segunda varre os **decoradores dos
    // controladores** e compõe: cada manipulador reivindica um par, salvo o `@All`, que reivindica os
    // sete verbos do caminho dele, mais os nove pares registrados direto no adaptador, que não têm
    // manipulador. Nenhuma é derivada da outra.
    //
    // ⚠️ É a conferência **FINAL** da fatia: as âncoras já foram subidas por T13 (92 → 94), T14
    // (94 → 96) e T15 (96 → 99), e aqui elas são **conferidas**, nunca acrescentadas — é isso que
    // impede a superfície de ser derivada de si mesma.
    const manipuladores = manipuladoresExaminados(aplicacaoReal);
    const comTodosOsVerbos = manipuladoresQueAtendemTodosOsVerbos(aplicacaoReal);
    const pelaComposicao =
      manipuladores -
      comTodosOsVerbos +
      comTodosOsVerbos * METODOS_DO_ENCAMINHADOR.length +
      ROTAS_FORA_DO_ARCABOUCO.length;

    // A igualdade entre os dois eixos é afirmada **explicitamente**, e ANTES da comparação com a
    // âncora: duas medições que concordassem com o valor esperado por acidente e discordassem entre
    // si passariam pela comparação de baixo, e é a concordância delas que torna cada uma verificável
    // pela outra.
    expect(
      pelaComposicao,
      'as duas medições independentes da superfície publicada divergiram entre si: o errado é a âncora, nunca a medição',
    ).toBe(cobertura.rotasEnumeradas);

    // As quatro grandezas viajam numa comparação só de propósito: se alguma divergir, a falha
    // **nomeia os números** lado a lado.
    expect(
      {
        peloRoteador: cobertura.rotasEnumeradas,
        pelaComposicao,
        manipuladores,
        comTodosOsVerbos,
      },
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toEqual({
      peloRoteador: ROTAS_PUBLICADAS_EM_PRODUCAO,
      pelaComposicao: ROTAS_PUBLICADAS_EM_PRODUCAO,
      manipuladores: MANIPULADORES_EXAMINADOS_EM_PRODUCAO,
      comTodosOsVerbos: MANIPULADORES_QUE_ATENDEM_TODOS_OS_VERBOS,
    });

    // ---------------------------------------------------------------------------------------
    // O catálogo fechado NÃO foi aberto por fatia alguma — ele é 10 × 7, e não cresce
    // ---------------------------------------------------------------------------------------
    //
    // As dez áreas de tela, por igualdade de arranjo contra a lista escrita à mão: nenhuma área nova
    // nasceu, e nenhuma saiu. É a metade executável do critério *"`catalogo-de-permissoes.ts` não foi
    // tocado por task alguma da fatia"* — a outra metade é a conferência do diff, que o Gate 2 faz.
    expect([...CHAVES_DE_TELA]).toEqual(AREAS_DE_TELA_DO_CATALOGO);

    // E o eixo das ações, na área desta fatia: `TELA:financeiro` tem exatamente as duas que já
    // existiam, reservadas para os atos sobre o boleto. É a asserção que reprova a rodada que
    // "resolvesse" um problema de autorização criando chave nova em vez de escalar.
    expect(acoesSensiveisDaArea(AREA_DO_FINANCEIRO)).toEqual(ACOES_SENSIVEIS_DO_FINANCEIRO);

    // E o catálogo continua com as 17 chaves das duas metades — a âncora que o `CT-212` usa do lado
    // da sessão, afirmada aqui do lado da declaração.
    expect(CHAVES_DE_TELA.length + Object.keys(MAPA_ACAO_TELA).length).toBe(TOTAL_DE_CHAVES);
  });

  it(
    'CT-837 — a sessão que não alcança a área recebe 403 nas três rotas, nomeando a PRIMEIRA exigência ausente, e nada é gravado',
    async () => {
      // ---------------------------------------------------------------------------------------
      // SANIDADE DO ARRANJO, no molde do `CT-836` e ANTES de exercitar qualquer rota
      // ---------------------------------------------------------------------------------------
      //
      // O laço abaixo percorre `CHAMADAS_DA_FATIA_BANCARIA`, e a linha de fecho dele compara o que
      // foi percorrido com **esse mesmo arranjo** — logo um arranjo TRUNCADO passaria por ela sem
      // acusar nada. Estas duas âncoras são o que fecha esse caminho, e elas comparam contra fontes
      // **independentes** do arranjo: a cardinalidade contra a constante da fatia, e a identidade
      // contra o inventário de pares já revisado (`PARES_DA_FATIA_BANCARIA`, composto dos donos dos
      // segmentos). É a mesma dupla que o `CT-836` usa sobre o inventário estático.
      expect(CHAMADAS_DA_FATIA_BANCARIA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_BANCARIA);
      expect(
        CHAMADAS_DA_FATIA_BANCARIA.map((chamada) => `${chamada.metodo} ${chamada.caminho}`).sort(),
        'o arranjo de chamadas divergiu do inventário revisado desta fatia',
      ).toEqual([...PARES_DA_FATIA_BANCARIA]);

      const cookie = await entrar(QUEM_NAO_ALCANCA.email, baseReal);

      // Precondição AFIRMADA, e não suposta: a matriz **padrão** de `USUARIO_EMPRESA` concede uma
      // única chave, e nenhuma delas é a área desta fatia. Sem esta linha, um `403` abaixo seria
      // indistinguível de um `403` vindo de uma sessão que perdeu o efetivo por outro motivo.
      const sessao = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie, base: baseReal });
      expect(sessao.status).toBe(200);
      expect(sessao.corpo).toMatchObject({
        perfil: 'USUARIO_EMPRESA',
        telas: [UNICA_CHAVE_DO_USUARIO_EMPRESA],
        acoes: [],
      });

      const empresaId = QUEM_NAO_ALCANCA.empresaId;
      if (empresaId === null) {
        throw new Error(`${QUEM_NAO_ALCANCA.email} não tem empresa na carga`);
      }

      const antes = await contarCertificados(empresaId);

      const respostas: Resposta[] = [];
      for (const chamada of CHAMADAS_DA_FATIA_BANCARIA) {
        respostas.push(await chamar(chamada, cookie));
      }

      const depois = await contarCertificados(empresaId);

      // ---------------------------------------------------------------------------------------
      // A GARANTIA que distingue, e por isso ela vem ANTES da igualdade que fixa o corpo
      // ---------------------------------------------------------------------------------------
      //
      // A contagem é o que separa *"recusou"* de *"recusou depois de escrever"*. Ela vem primeiro
      // porque uma igualdade de corpo que reprovasse abortaria o caso e deixaria esta linha
      // inalcançável — que é o AP-29 medido nesta fatia.
      //
      // Alcance declarado: as duas contagens correm sob o contexto da empresa da sessão, sem
      // `WHERE empresa_id` — quem recorta é a política (ADR-0008) —, e a instrução é um `count(*)`
      // cru. O valor não pode ser `0` por silêncio: tabela ausente ou política impeditiva levantam,
      // e o levantamento reprova o caso. O que ela prova é o **efeito terminal** da recusa; a
      // gravação pelo caminho legítimo é o que `certificado-do-provedor.e2e.spec.ts` mede.
      expect(
        depois,
        'a recusa por autorização foi acompanhada de escrita em negocio.certificado_do_provedor',
      ).toBe(antes);
      expect(antes).toBe(0);

      // ---------------------------------------------------------------------------------------
      // O envelope canônico da ADR-0017, corpo INTEIRO por igualdade, nas três
      // ---------------------------------------------------------------------------------------
      //
      // `detalhes.exigido` nomeia a **PRIMEIRA** chave ausente na ordem declarada (ADR-0018), e nas
      // três ela é a ÁREA — inclusive no registro, cuja conjunção declara a área antes da ação. É
      // isso que faz quem já tem a área ouvir o nome do que lhe falta, e é o que a ordem invertida
      // trocaria sem mudar quem alcança.
      const recusadas: string[] = [];
      for (const [indice, chamada] of CHAMADAS_DA_FATIA_BANCARIA.entries()) {
        const resposta = respostas[indice];

        expect(resposta?.status, `${chamada.rotulo} não recusou com 403`).toBe(403);
        expect(resposta?.corpo).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: AREA_DAS_INTEGRACOES_BANCARIAS },
        });
        recusadas.push(chamada.rotulo);
      }

      // O laço percorreu o arranjo INTEIRO, sem saída antecipada: `recusadas` recebe um rótulo por
      // volta, depois das asserções, de modo que uma volta que abortasse ou fosse pulada deixaria a
      // lista curta aqui. ⚠️ Ela compara contra o **próprio** arranjo, e por isso NÃO prova nada
      // sobre a cardinalidade — quem fecha esse caminho são as duas âncoras do topo do caso, contra
      // `PARES_PUBLICADOS_PELA_FATIA_BANCARIA` e `PARES_DA_FATIA_BANCARIA`.
      expect(recusadas).toEqual(CHAMADAS_DA_FATIA_BANCARIA.map((chamada) => chamada.rotulo));
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-838 — sem sessão, as três rotas recusam com 401 antes de tocar o banco, e a resposta não distingue empresa com certificado de empresa sem',
    async () => {
      // Sanidade do arranjo, no molde do `CT-836` e pela mesma razão do `CT-837`: a linha de fecho
      // deste caso compara o percorrido com o próprio arranjo, e só estas duas âncoras — contra a
      // constante da fatia e contra o inventário de pares revisado — pegam um arranjo truncado.
      expect(CHAMADAS_DA_FATIA_BANCARIA.length).toBe(PARES_PUBLICADOS_PELA_FATIA_BANCARIA);
      expect(
        CHAMADAS_DA_FATIA_BANCARIA.map((chamada) => `${chamada.metodo} ${chamada.caminho}`).sort(),
        'o arranjo de chamadas divergiu do inventário revisado desta fatia',
      ).toEqual([...PARES_DA_FATIA_BANCARIA]);

      const respostas: Resposta[] = [];
      for (const chamada of CHAMADAS_DA_FATIA_BANCARIA) {
        respostas.push(await chamar(chamada));
      }

      const [doRegistro, daConsulta, daVerificacao] = respostas;

      // ---------------------------------------------------------------------------------------
      // A propriedade que DISCRIMINA vem primeiro: as três respostas são idênticas byte a byte
      // ---------------------------------------------------------------------------------------
      //
      // Sem sessão, o produto não pode revelar estado de empresa nenhuma — e a consulta é a rota que
      // teria o que revelar: com sessão, ela responde `200` para a empresa que registrou e `404`
      // para a que não registrou. Se a recusa acontecesse depois da leitura, as três respostas
      // deixariam de coincidir, porque só uma delas leria. A comparação é sobre o **texto cru**, e
      // não sobre o corpo decodificado: um campo a mais que variasse com o estado apareceria aqui.
      expect(
        [daConsulta?.texto, daVerificacao?.texto],
        'a recusa sem sessão varia entre as três rotas: alguma delas respondeu depois de olhar o estado da empresa',
      ).toEqual([doRegistro?.texto, doRegistro?.texto]);

      // ---------------------------------------------------------------------------------------
      // E o envelope canônico da ADR-0017, corpo INTEIRO por igualdade, nas três
      // ---------------------------------------------------------------------------------------
      //
      // **Sem `detalhes`**: não há exigência a nomear para quem não tem sessão, e nomeá-la diria ao
      // anônimo qual chave libera a rota. O código é `NAO_AUTENTICADO` e não `RECURSO_NAO_ENCONTRADO`
      // — o `404` que a consulta produziria se a leitura tivesse acontecido —, e é essa diferença que
      // afirma que a recusa vem antes do banco.
      const recusadas: string[] = [];
      for (const [indice, chamada] of CHAMADAS_DA_FATIA_BANCARIA.entries()) {
        const resposta = respostas[indice];

        expect(resposta?.status, `${chamada.rotulo} não recusou com 401`).toBe(401);
        expect(resposta?.corpo).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });
        recusadas.push(chamada.rotulo);
      }

      // Como no `CT-837`: esta linha prova que o laço não saiu antes do fim, e **nada** sobre a
      // cardinalidade do arranjo — que as âncoras do topo do caso fixam contra fontes independentes.
      expect(recusadas).toEqual(CHAMADAS_DA_FATIA_BANCARIA.map((chamada) => chamada.rotulo));
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// As rotas de VERIFICAÇÃO — o mutante. Ver o cabeçalho deste arquivo.
// ---------------------------------------------------------------------------------------------

/**
 * A rota publicada **sem declaração alguma** — o sujeito do CT-212 e metade do mutante do CT-213.
 *
 * Ela é deliberadamente omissa, e o manipulador devolveria `200` se algum dia rodasse: é isso que
 * torna a asserção do CT-212 comportamental. Um `403` produzido por um manipulador que já levantasse
 * erro não distinguiria a guarda do próprio manipulador.
 */
@Controller(CAMINHO_SEM_DECLARACAO)
class ControladorSemDeclaracao {
  @Get()
  responder(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * A GÊMEA da anterior: mesma forma, mesmo manipulador, e **uma única diferença** — a marca explícita
 * de que a rota não exige permissão.
 *
 * O par existe para que a passagem seja atribuível à declaração, e a nada mais: com rotas de formas
 * diferentes, um `200` aqui e um `403` lá provariam que duas rotas se comportam diferente.
 */
@Controller(CAMINHO_SEM_EXIGENCIA)
class ControladorSemExigencia {
  @Get()
  @NaoExigePermissao()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * Uma rota de negócio marcada `@RotaPublica()` **indevidamente** — a outra metade do mutante.
 *
 * É a escapatória que a asserção (b) existe para fechar: ela não aparece no conjunto sem declaração,
 * porque a marca **é** a declaração dela e a guarda retorna antes de decidir qualquer coisa. Só a
 * igualdade do inventário público a pega.
 */
@RotaPublica()
@Controller(CAMINHO_PUBLICO_INDEVIDO)
class ControladorPublicoIndevido {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * O DEFEITO LITERAL que rejeitou a T5 na rodada 1: área na **classe**, ação no **método**.
 *
 * `getAllAndOverride` substitui, então este manipulador exige `ACAO:excluir_cadastro` **e mais
 * nada** — `TELA:imoveis` desaparece dele. A cobertura de autorização o classifica como
 * `comExigencia` e fica verde, porque ela audita a **existência** da declaração, não o conteúdo.
 * É por isso que o `CT-355` existe: ele é a única asserção da suíte que olha o conteúdo.
 */
@Controller('verificacao-substitui')
@ExigeChave('TELA:imoveis')
class ControladorQueSubstitui {
  @Post()
  @ExigeChave('ACAO:excluir_cadastro')
  circular(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * A GÊMEA da anterior: mesma classe, mesmo manipulador, mesma ação — e **uma única diferença**, que
 * é declarar a CONJUNÇÃO em vez de trocar a exigência.
 *
 * O par existe para que a acusação seja atribuível à substituição, e a nada mais: com controladores
 * de formas diferentes, uma acusação lá e um silêncio aqui provariam que dois controladores se
 * comportam diferente, não que a verificação discrimina o defeito.
 */
@Controller('verificacao-compoe')
@ExigeChave('TELA:imoveis')
class ControladorQueCompoe {
  @Post()
  @ExigeChaves('TELA:imoveis', 'ACAO:excluir_cadastro')
  circular(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * O recurso REST mais comum que existe: **um caminho, dois manipuladores** — `@Get()` de lista e
 * `@Post()` de criação —, e é ele que a versão anterior desta verificação não conseguia classificar.
 *
 * As declarações são deliberadamente OPOSTAS. Fossem iguais, uma classificação por caminho produziria
 * o mesmo retrato de uma por manipulador, e o caso não discriminaria nada: é a diferença entre elas
 * que só a granularidade certa consegue exprimir.
 *
 * A §5.3 do `tech_spec.md` desta fatia declara exatamente esta forma — `POST` e `GET
 * /v1/master/empresas`, na US-01 —, e a T7 vai publicá-la.
 */
@Controller(CAMINHO_DO_RECURSO)
class ControladorDeRecurso {
  @Get()
  @NaoExigePermissao()
  listar(): { readonly alcancada: true } {
    return { alcancada: true };
  }

  @Post()
  criar(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * O primeiro dos dois manipuladores que disputam o MESMO verbo do mesmo caminho.
 *
 * O caminho da classe já carrega o prefixo de versão, e o da gêmea não: montados, os dois publicam
 * caminhos DISTINTOS (`/v1/v1/…` e `/v1/…`), que é o que permite montá-los. Apresentada a tabela do
 * roteador de {@link comTabelaDoRoteador}, os dois passam a resolver para o mesmo caminho — um pela
 * forma sem prefixo, outro pela forma com prefixo —, e a disputa acontece.
 */
@Controller(`${PREFIXO_DE_VERSAO}/${CAMINHO_EM_DISPUTA}`)
class ControladorQueDisputa {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/** O segundo da disputa — mesma forma, mesmo verbo, sem o prefixo no caminho da classe. */
@Controller(CAMINHO_EM_DISPUTA)
class ControladorQueTambemDisputa {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/**
 * Uma montagem MÍNIMA: só os controladores informados, sob o prefixo de versão, sem servidor.
 *
 * `init()` basta porque o que se lê dela é a tabela do roteador do arcabouço — medido: o adaptador
 * já a imprime completa depois dele. Quem exigia `listen()` na aplicação real é o plugin de arquivos
 * estáticos do contrato, que aqui não existe.
 */
async function montarMinima(
  controladores: readonly Type<unknown>[],
): Promise<NestFastifyApplication> {
  const modulo = await Test.createTestingModule({ controllers: [...controladores] }).compile();
  const aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.init();

  return aplicacao;
}

/**
 * A MESMA aplicação, com a **tabela do roteador** apresentada em vez de lida — e nada mais.
 *
 * Existe por uma razão medida, e não por conveniência: **a disputa não é montável**. O adaptador HTTP
 * recusa registrar dois manipuladores do mesmo verbo no mesmo caminho, com
 * `Method 'GET' already declared for route '…'`, de modo que nenhuma aplicação real pode exibir a
 * situação que o levantamento existe para pegar. Ele é guarda contra defeito da **junção**, não
 * contra aplicação publicável.
 *
 * A substituição é do mínimo possível: `get` delega à aplicação REAL, e por isso o leitor de
 * metadado (a instância de `Reflector` da montagem), o prefixo global e o descobridor de
 * controladores continuam sendo os verdadeiros. O que se troca é só o texto da tabela — a única
 * entrada que a montagem não consegue produzir.
 */
function comTabelaDoRoteador(
  aplicacao: NestFastifyApplication,
  arvore: string,
): NestFastifyApplication {
  return {
    getHttpAdapter: () => ({ getInstance: () => ({ printRoutes: () => arvore }) }),
    get: (tipo: unknown, opcoes: unknown) =>
      (aplicacao.get as (alvo: unknown, opcoes: unknown) => unknown)(tipo, opcoes),
  } as unknown as NestFastifyApplication;
}

/**
 * Um manipulador cuja declaração de MÉTODO deixou de conter a da CLASSE.
 *
 * Os dois conjuntos viajam nomeados porque a mensagem da falha precisa dizer **o que sumiu**: o
 * defeito não é declarar no método, é declarar no método **menos** do que a classe já exigia.
 */
interface DeclaracaoQueSubstitui {
  readonly controlador: string;
  readonly manipulador: string;
  readonly daClasse: readonly string[];
  readonly doMetodo: readonly string[];
}

/**
 * Achata uma exigência nos **átomos** que ela impõe.
 *
 * `TODAS` é recursiva, então o achatamento também é. As duas dimensões viajam na mesma forma
 * textual que `detalhes.exigido` publica (`TELA:imoveis`, `PERFIL:SYSLOC_MASTER`), o que faz a
 * comparação de conjunto ser sobre o que o cliente de fato veria.
 */
function atomosDaExigencia(exigencia: Exigencia): readonly string[] {
  switch (exigencia.dimensao) {
    case 'CHAVE':
      return [exigencia.chave];
    case 'PERFIL':
      return [`PERFIL:${exigencia.perfil}`];
    case 'NENHUMA':
      // A abertura deliberada não impõe átomo nenhum — e é por isso que ela, declarada num método
      // de classe que exige, aparece como violação: ela REMOVE o que a classe impunha. Isso é
      // deliberado: a ADR-0011 chama a marca de "única abertura deliberada" e manda que cada uso
      // dela peça revisão explícita. Nenhum controlador de produção faz isso hoje.
      return [];
    case 'TODAS':
      return exigencia.exigencias.flatMap(atomosDaExigencia);
  }
}

/**
 * Percorre os manipuladores da aplicação e devolve os que **substituem** a declaração da classe.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora AQUI, e não em `apps/api/src/`
 * ---------------------------------------------------------------------------
 *
 * Iron Law #6: nenhum símbolo nasce em produção para um teste enxergar algo. Tudo que ela usa é a
 * API pública do arcabouço — `DiscoveryService`, `MetadataScanner` e a MESMA instância de
 * `Reflector` da aplicação —, exatamente como a sonda que o Gate 1 usou para medir o defeito. Ela
 * **não** duplica `verificarCoberturaDeAutorizacao`: não precisa da tabela do roteador nem da
 * resolução de caminho, porque a propriedade sob prova é sobre METADADO, não sobre rota.
 *
 * ---------------------------------------------------------------------------
 * O que ela fecha, e por que isso é a CLASSE e não a ocorrência
 * ---------------------------------------------------------------------------
 *
 * A T6, a T7 e a T9 publicam **as mesmas duas rotas de circulação** em mais quatro controladores.
 * Um caso de comportamento por entidade dependeria de cada autor futuro lembrar de escrevê-lo — e
 * foi precisamente um esquecimento desse tipo que produziu o defeito. Esta asserção é sobre a
 * superfície **inteira**: qualquer manipulador, de qualquer controlador, que declare menos do que a
 * classe dele exige, reprova aqui sem que ninguém precise se lembrar de nada.
 *
 * `@RotaPublica()` é exceção declarada: a marca **é** a declaração daquela rota (§5.1 da tech spec),
 * a guarda retorna antes de ler a exigência, e o inventário público do `CT-213` já a governa por
 * igualdade de conjunto.
 */
function declaracoesQueSubstituemAClasse(
  aplicacao: NestFastifyApplication,
): readonly DeclaracaoQueSubstitui[] {
  const violacoes: DeclaracaoQueSubstitui[] = [];

  for (const { classe, alvo, nome } of manipuladoresDe(aplicacao)) {
    const reflector = aplicacao.get(Reflector, { strict: false });

    if (reflector.getAllAndOverride<boolean | undefined>(ROTA_PUBLICA, [alvo, classe]) === true) {
      continue;
    }

    // O MESMO leitor da guarda, com a MESMA instância de `Reflector` — mas apontado a **um** alvo
    // de cada vez. É a única forma de ver a substituição: com os dois alvos juntos, a precedência
    // devolve o do método e o da classe some, que é exatamente o efeito sob prova.
    const doMetodo = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo]);
    const daClasse = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [classe]);

    if (daClasse === undefined || doMetodo === undefined) {
      continue;
    }

    const atomosDaClasse = atomosDaExigencia(daClasse);
    const atomosDoMetodo = atomosDaExigencia(doMetodo);

    if (atomosDaClasse.every((atomo) => atomosDoMetodo.includes(atomo))) {
      continue;
    }

    violacoes.push({
      controlador: classe.name,
      manipulador: nome,
      daClasse: [...atomosDaClasse].sort(),
      doMetodo: [...atomosDoMetodo].sort(),
    });
  }

  return violacoes.sort((um, outro) =>
    `${um.controlador}.${um.manipulador}`.localeCompare(
      `${outro.controlador}.${outro.manipulador}`,
    ),
  );
}

/** Quantos manipuladores a varredura de {@link manipuladoresDe} alcança — a âncora do CT-355. */
function manipuladoresExaminados(aplicacao: NestFastifyApplication): number {
  return [...manipuladoresDe(aplicacao)].length;
}

/**
 * Quantos manipuladores declaram atender **todos** os verbos (`@All`) — o fator da segunda medição do
 * `CT-533`.
 *
 * O metadado é lido com a chave **do próprio arcabouço** e comparado com a enumeração dele
 * (`RequestMethod.ALL`), exatamente como o módulo verificado faz: uma tabela local de números
 * envelheceria em silêncio no dia em que o arcabouço inserisse um verbo no meio da enumeração.
 */
function manipuladoresQueAtendemTodosOsVerbos(aplicacao: NestFastifyApplication): number {
  let total = 0;

  for (const { alvo } of manipuladoresDe(aplicacao)) {
    if (Reflect.getMetadata(METHOD_METADATA, alvo) === RequestMethod.ALL) {
      total += 1;
    }
  }

  return total;
}

/**
 * A exigência **efetiva** de cada rótulo informado, num objeto — o retrato que o `CT-533` compara.
 *
 * Ela delega a {@link exigenciaEfetivaDoManipulador}, que **levanta** quando o rótulo não existe na
 * varredura: um nome com erro de digitação produziria ausência, e ausência comparada a ausência
 * passaria em silêncio, que é a forma de esta auditoria apodrecer sem que ninguém perceba.
 */
function exigenciasEfetivasDe(
  aplicacao: NestFastifyApplication,
  rotulos: readonly string[],
): Record<string, readonly string[]> {
  return Object.fromEntries(
    rotulos.map((rotulo) => [rotulo, exigenciaEfetivaDoManipulador(aplicacao, rotulo)]),
  );
}

/**
 * O retrato — exigência efetiva **mais a origem da declaração** — de cada rótulo informado, num
 * objeto. É o que o `CT-635` compara.
 *
 * Ela é a irmã de {@link exigenciasEfetivasDe} e diz uma coisa a mais: **de onde** a exigência veio.
 * A distinção é conteúdo, e a razão está em {@link RetratoDaExigencia} — `getAllAndOverride`
 * substitui, de modo que herdar da classe e declarar a mesma coisa no método são estados diferentes
 * do sistema com o mesmo conjunto de átomos.
 *
 * Ela delega a {@link exigenciaEfetivaDoManipulador}, que **levanta** quando o rótulo não existe na
 * varredura: um nome com erro de digitação produziria ausência, e ausência comparada a ausência
 * passaria em silêncio, que é a forma de esta auditoria apodrecer sem que ninguém perceba.
 */
function retratoDasExigenciasDe(
  aplicacao: NestFastifyApplication,
  rotulos: readonly string[],
): Record<string, RetratoDaExigencia> {
  const noMetodo = exigenciasDeclaradasNoMetodo(aplicacao);

  return Object.fromEntries(
    rotulos.map((rotulo) => {
      const efetiva = exigenciaEfetivaDoManipulador(aplicacao, rotulo);

      return [rotulo, noMetodo.has(rotulo) ? { metodo: efetiva } : { classe: efetiva }];
    }),
  );
}

/**
 * As chaves de **ação** exigidas num retrato de exigências, cada uma com o manipulador que a exige.
 *
 * O resultado é uma lista de frases, e não um booleano nem uma contagem: a asserção do `CT-533` compara
 * essa lista com `[]`, de modo que a falha **nomeia** o manipulador e a chave encontrada. Um predicado
 * `não contém ACAO:` diria apenas que alguém passou a exigir alguma coisa, e quem lesse a falha teria
 * de ir procurar onde — e é justamente o *onde* que decide se houve escalada ou linha copiada.
 */
function chavesDeAcaoExigidasEm(
  exigencias: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  return Object.entries(exigencias)
    .flatMap(([rotulo, atomos]) =>
      atomos
        .filter((atomo) => atomo.startsWith(PREFIXO_DA_CHAVE_DE_ACAO))
        .map((atomo) => `${rotulo} exige ${atomo}`),
    )
    .sort();
}

/**
 * As ações sensíveis que o catálogo fechado enumera dentro de uma área de tela.
 *
 * Extraídas de `MAPA_ACAO_TELA`, que é a **declaração** do eixo das ações (ver o cabeçalho de
 * `packages/auth/src/catalogo-de-permissoes.ts`): uma ação existe porque tem entrada no mapa, e a área
 * que a comporta é o valor dela. Ordenadas, para que a igualdade seja sobre o conjunto e não sobre a
 * ordem de inserção do literal.
 */
function acoesSensiveisDaArea(area: string): readonly string[] {
  return Object.entries(MAPA_ACAO_TELA)
    .filter(([, tela]) => tela === area)
    .map(([acao]) => acao)
    .sort();
}

/**
 * As exigências declaradas **no MÉTODO**, por manipulador, **na ordem em que o decorador as declara**
 * — o eixo que o `CT-427` audita.
 *
 * Ela é a irmã de {@link declaracoesQueSubstituemAClasse} e prova outra coisa: aquela responde *"o
 * método declara MENOS do que a classe?"*, e esta responde *"o que exatamente o método declara, e em
 * que ordem?"*. As duas são necessárias porque a ordem é conteúdo — a recusa nomeia a **primeira**
 * chave ausente (RN-14) —, e uma conjunção com os mesmos dois átomos em ordem trocada satisfaz a
 * contenção da primeira e muda o corpo que o cliente lê.
 *
 * **A ordem não é ordenada aqui, e a ausência do `sort` é a decisão.** `atomosDaExigencia` achata na
 * ordem em que `@ExigeChaves` gravou o metadado, e é essa sequência que precisa ser afirmada;
 * ordená-la apagaria justamente o que o caso mede.
 *
 * O manipulador que **não** declara nada no método não aparece no mapa — a ausência é o resultado, e
 * não um arranjo vazio que se confundiria com `@NaoExigePermissao()`, que declara e não exige nada.
 *
 * A chave é `Controlador.manipulador`, o mesmo rótulo que a mensagem de falha do `CT-355` usa: é ele
 * que a guarda de cobertura acusa **pelo nome**.
 */
function exigenciasDeclaradasNoMetodo(
  aplicacao: NestFastifyApplication,
): Map<string, readonly string[]> {
  const reflector = aplicacao.get(Reflector, { strict: false });
  const porManipulador = new Map<string, readonly string[]>();

  for (const { alvo, classe, nome } of manipuladoresDe(aplicacao)) {
    // Um alvo de cada vez, como em `declaracoesQueSubstituemAClasse`: com os dois juntos a
    // precedência devolveria o da classe quando o método não declara nada, e a distinção sumiria.
    const doMetodo = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo]);

    if (doMetodo === undefined) {
      continue;
    }

    porManipulador.set(`${classe.name}.${nome}`, atomosDaExigencia(doMetodo));
  }

  return porManipulador;
}

/**
 * A exigência **efetiva** de um manipulador — a que a guarda de fato aplica, com a precedência dela.
 *
 * `getAllAndOverride([alvo, classe])` é a MESMA chamada da guarda, com os dois alvos e na mesma
 * ordem: é ela que faz a declaração do método substituir a da classe. Ler por aqui é o que torna a
 * asserção sobre a rota de situação de locação uma afirmação sobre o que o cliente encontra, e não
 * sobre o que está escrito no fonte.
 *
 * O manipulador ausente levanta em vez de devolver vazio: um nome com erro de digitação produziria
 * `[]`, e `[]` comparado a `[]` passaria em silêncio — que é exatamente a forma de esta asserção
 * apodrecer sem que ninguém perceba.
 */
function exigenciaEfetivaDoManipulador(
  aplicacao: NestFastifyApplication,
  rotulo: string,
): readonly string[] {
  const reflector = aplicacao.get(Reflector, { strict: false });

  for (const { alvo, classe, nome } of manipuladoresDe(aplicacao)) {
    if (`${classe.name}.${nome}` !== rotulo) {
      continue;
    }

    const efetiva = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo, classe]);

    if (efetiva === undefined) {
      throw new Error(`${rotulo} não declara exigência alguma, nem no método nem na classe`);
    }

    return atomosDaExigencia(efetiva);
  }

  throw new Error(`a varredura não encontrou o manipulador ${rotulo}`);
}

/** Os manipuladores de rota de todos os controladores montados na aplicação. */
function* manipuladoresDe(
  aplicacao: NestFastifyApplication,
): Generator<{ classe: Type<unknown>; alvo: Type<unknown>; nome: string }> {
  const descoberta = new DiscoveryService(aplicacao.get(ModulesContainer, { strict: false }));
  const varredor = new MetadataScanner();

  for (const embrulho of descoberta.getControllers()) {
    const instancia = embrulho.instance;
    const classe = embrulho.metatype;

    if (instancia === null || instancia === undefined || typeof classe !== 'function') {
      continue;
    }

    const prototipo = Object.getPrototypeOf(instancia) as object;

    for (const nome of varredor.getAllMethodNames(prototipo)) {
      const alvo = (prototipo as Record<string, unknown>)[nome];

      if (typeof alvo !== 'function' || Reflect.getMetadata(METHOD_METADATA, alvo) === undefined) {
        continue;
      }

      // A conversão é o preço de `Reflector` aceitar `Type<any> | Function`: `alvo` já foi
      // estreitado para função pela guarda de cima, e `Type<unknown>` é a forma que os dois usos
      // abaixo — o alvo e a classe — satisfazem sem um segundo tipo só para isto.
      yield { classe: classe as Type<unknown>, alvo: alvo as unknown as Type<unknown>, nome };
    }
  }
}

/** O erro que uma chamada levantou, ou `undefined` se ela não levantou nenhum. */
function capturar(acao: () => unknown): Error | undefined {
  try {
    acao();
  } catch (erro) {
    return erro as Error;
  }

  return undefined;
}

/** O resultado da conferência — o mesmo formato para o controle e para o mutante. */
interface Conferencia {
  readonly semDeclaracao: readonly RotaSemDeclaracao[];
  readonly excedentes: readonly string[];
  readonly ausentes: readonly string[];
}

/**
 * A conferência da cobertura contra um inventário — **a asserção, escrita uma vez só**.
 *
 * Ela roda sobre o controle e sobre o mutante, e é isso que faz o par ser prova de falsificação em
 * vez de duas asserções parecidas: o que muda entre os dois casos é a aplicação, nunca o critério.
 *
 * A igualdade do conjunto público é dita nos DOIS sentidos, com as diferenças nomeadas: excedente é
 * rota que passou a dispensar a decisão sem revisão, e ausente é rota que precisava dispensá-la e
 * deixou de fazê-lo. Uma igualdade só diria "diferente" sem dizer de que lado.
 */
function conferir(cobertura: CoberturaDeAutorizacao, inventario: readonly string[]): Conferencia {
  return {
    semDeclaracao: cobertura.semDeclaracao,
    excedentes: cobertura.publicas.filter((rota) => !inventario.includes(rota)),
    ausentes: inventario.filter((rota) => !cobertura.publicas.includes(rota)),
  };
}

/** Caminho absoluto de uma rota de verificação, sob o prefixo de versão. */
function caminho(rota: string): string {
  return `/${PREFIXO_DE_VERSAO}/${rota}`;
}

/**
 * Executa uma das três chamadas da fatia bancária contra a aplicação de **produção**.
 *
 * O cookie é opcional, e a ausência dele é o que separa o `CT-838` do `CT-837`: as duas provas
 * percorrem o MESMO arranjo de chamadas, e o único parâmetro que muda entre elas é a sessão. Escrever
 * dois laços com endereços copiados deixaria os dois livres para divergir, e a divergência apareceria
 * como `404` num caso que deveria medir autorização.
 */
async function chamar(chamada: ChamadaDaFatiaBancaria, cookie?: string): Promise<Resposta> {
  return await pedir(chamada.caminho, {
    metodo: chamada.metodo,
    base: baseReal,
    ...(chamada.corpo === undefined ? {} : { corpo: chamada.corpo }),
    ...(cookie === undefined ? {} : { cookie }),
  });
}

/**
 * Quantas linhas de `negocio.certificado_do_provedor` o contexto da empresa informada alcança — a
 * contagem crua do `CT-837`.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui: quem recorta é a política (ADR-0008), e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa. É a mesma forma, e a mesma razão, de
 * `contarCertificados` em `apps/api/test/certificado-do-provedor.e2e.spec.ts`.
 */
async function contarCertificados(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom({ empresaId }, async () => {
    return await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*) AS total FROM negocio.certificado_do_provedor
      `;

      return Number(linha?.total ?? 0);
    });
  });
}

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
  /**
   * Contra qual das duas montagens a requisição vai — a **mutante** por omissão.
   *
   * O padrão preserva o comportamento de todo chamador anterior a esta linha, e o parâmetro existe
   * porque as duas provas de borda da fatia `fundacao-bancaria` medem a aplicação de **produção**:
   * as três rotas do certificado são publicadas por ela, e é a recusa dela que o cliente encontra.
   */
  readonly base?: string;
}

/**
 * Executa uma requisição HTTP real contra uma das duas montagens — a mutante por omissão, a de
 * produção quando `base` a nomeia.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação alvo: é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie. Ele é
 * derivado do destino, e não fixado numa das duas — uma origem cruzada faria o arcabouço recusar a
 * entrada e o caso mediria a conferência de origem em vez da autorização.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const destino = opcoes.base ?? baseMutante;
  const cabecalhos: Record<string, string> = { connection: 'close', origin: destino };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, destino), {
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

/**
 * Entra pelo caminho REAL — a rota pública de entrada — e devolve o cookie de sessão.
 *
 * A montagem é a mesma que a requisição seguinte vai usar, e a coincidência é obrigatória: o cookie
 * vale em qualquer das duas (o registro de sessão está no banco compartilhado), mas o arcabouço
 * confere a origem contra o endereço base **configurado**, que é o da montagem que emitiu.
 */
async function entrar(email: string, base?: string): Promise<string> {
  const entrada = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
    ...(base === undefined ? {} : { base }),
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/**
 * Entra e **cumpre a exigência de segundo fator**, pelo caminho público real.
 *
 * O Master nasce da carga sem segundo fator configurado, e a sessão dele é restrita até que ele o
 * configure (RN-08). Nada é forjado: o segredo sai do endereço que a própria resposta do preparo
 * devolveu, e o código é derivado pela função de geração **do arcabouço**. A verificação emite
 * credencial de sessão nova e apaga a anterior, e é a nova que sai daqui.
 */
async function entrarComSegundoFatorCumprido(email: string): Promise<string> {
  const cookie = await entrar(email);

  const preparo = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (preparo.status !== 200) {
    throw new Error(
      `o preparo do segundo fator respondeu ${String(preparo.status)}: ${preparo.texto}`,
    );
  }

  const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
  if (typeof totpURI !== 'string') {
    throw new Error('o preparo do segundo fator não devolveu o endereço de configuração');
  }

  const ativacao = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`, {
    metodo: 'POST',
    cookie,
    corpo: { code: await codigoDoSegundoFator(totpURI) },
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação do segundo fator respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return credencialDeSessao(ativacao);
}

/** Desfaz o segundo fator pela rota pública, devolvendo a pessoa ao estado da carga. */
async function desfazerSegundoFator(cookie: string): Promise<void> {
  const desfeito = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/disable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (desfeito.status !== 200) {
    throw new Error(
      `a desativação do segundo fator respondeu ${String(desfeito.status)}: ${desfeito.texto}`,
    );
  }
}

/**
 * Deriva o código do segundo fator a partir do endereço de configuração.
 *
 * A derivação é a **do próprio arcabouço** (`api.generateTOTP`), e não uma reimplementação: uma
 * cópia do algoritmo provaria que duas implementações concordam, não que a nossa confere o código
 * que o arcabouço espera. Só a decodificação de transporte (base32 do endereço) é local, porque o
 * decodificador do arcabouço vive num pacote transitivo que `apps/api` não resolve.
 */
async function codigoDoSegundoFator(totpURI: string): Promise<string> {
  const codificado = new URL(totpURI).searchParams.get('secret');

  if (codificado === null) {
    throw new Error(`o endereço de configuração do segundo fator não trouxe segredo: ${totpURI}`);
  }

  const { code } = await identidade.autenticacao.api.generateTOTP({
    body: { secret: decodificarBase32(codificado) },
  });

  return code;
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
