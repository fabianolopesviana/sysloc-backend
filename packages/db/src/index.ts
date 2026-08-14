/**
 * Superfície pública da camada de dados.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO entra aqui, e é a parte que importa
 * ---------------------------------------------------------------------------
 *
 * `./conexao.js` fica de fora **de propósito**. A §3.3 da tech spec faz da fronteira do pacote um
 * invariante de compilação: nada fora daqui abre conexão nem executa consulta com alcance ao schema
 * `negocio`. Exportar o cliente criaria o segundo caminho para o dado que a ADR-0008 rejeita
 * explicitamente — e é o caminho pelo qual todo filtro por empresa esquecido devolveria dado
 * alheio, em vez de vazio.
 *
 * Os dois schemas, sim, são exportados: eles são declaração de estrutura, não capacidade de acesso.
 * Quem os tem em mãos ainda precisa de um executor para chegar ao banco, e o executor não sai daqui.
 *
 * `./unidade-de-trabalho.js` entra, e é o que torna a ausência acima sustentável: ele publica o
 * acesso a dado sem publicar o executor. O objeto devolvido por `abrirAcessoAoBanco` oferece a
 * transação com contexto já fixado e o encerramento da reserva — e nada mais. É o conjunto fechado
 * que o CT-012 audita por igualdade, e não por contenção: contenção deixaria passar o export
 * acrescentado por descuido, que é exatamente o defeito a barrar.
 *
 * `./acesso-identidade.js` entra, e é a exceção que a própria §3.3 nomeia: a fronteira ali declarada
 * é "a unidade de trabalho, o schema **e um acesso tipado restrito ao schema `identidade`**". Ele
 * não contradiz a ausência acima porque o que ele destrava é `identidade`, que por decisão da
 * ADR-0009 nunca teve política a contornar — e porque o tipo publicado enumera apenas as sete
 * tabelas daquele schema, sem `$client`. O detalhe do que a restrição alcança, e do que ela
 * declaradamente não alcança, está no cabeçalho daquele arquivo.
 *
 * `./catalogo.js` entra pelo mesmo critério, e não o contradiz: a guarda de cobertura publica uma
 * PERGUNTA sobre o catálogo do sistema, não um caminho para dado de negócio. Ela não devolve
 * cliente nem transação, não alcança linha de tabela alguma, e abre e encerra por dentro a conexão
 * que usa. Ela precisa sair daqui porque tem dois consumidores fora do pacote — a suíte e o
 * verificador de infraestrutura, que a invoca pelo especificador público e traduz as exceções em
 * código de saída. A alternativa seria o verificador reimplementar a consulta, que é o antipadrão
 * registrado em `.claude/rules/testing-stack.md`.
 *
 * `./empresa.js` entra pela mesma pergunta, e com a mesma resposta: as oito operações **recebem** o
 * executor de quem já abriu a unidade, não abrem conexão nem transação e não devolvem executor. Elas
 * existem por uma razão a mais, e ela é a que este índice serve: a contenção da §11.2 impede
 * `apps/api` de **importar** `esquemaIdentidade` e o construtor de consulta, mas — como o cabeçalho
 * de `./acesso-identidade.ts` declara no item 3 — não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `identidade.usuario` numa cadeia
 * sem importar nada de proibido, e o alcance às sete tabelas deixa de ser enumerável. Publicá-las
 * aqui é o que devolve a enumerabilidade: o nome físico de tabela e de coluna existe num lugar só,
 * o mesmo em que mora a migração que os renomeia.
 *
 * `./permissao.js` entra, e a pergunta que este índice existe para forçar foi feita: **isto é um
 * caminho para dado de negócio fora da unidade de trabalho? NÃO.** As quatro operações **recebem** o
 * executor (`tx`) de quem já abriu a unidade — nenhuma delas abre conexão, reserva ou transação, e
 * nenhuma devolve executor. Elas são o oposto de um atalho: existem para que a leitura e a escrita
 * de ajuste de permissão tenham UM lugar, sob a política, em vez de serem reescritas em cada rota
 * que precise delas. Publicá-las é o que dispensa `apps/api` de conhecer o schema `negocio` e de
 * escrever, por conta própria, a instrução em que um `WHERE` por empresa reapareceria.
 *
 * `./pessoa.js` entra pela mesma pergunta, e com a mesma resposta: as seis operações do ciclo de
 * vida das pessoas **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas existem pelas duas razões que já sustentam `./empresa.js` e
 * `./permissao.js`, somadas: devolver a **enumerabilidade** do alcance a `identidade` (a contenção da
 * §11.2 é de tipo e não alcança texto de SQL), e dar UM lugar — sob a política — à resolução de
 * pessoa pelo vínculo, em vez de reescrevê-la em cada uma das sete rotas do Admin, onde um `WHERE`
 * por empresa reapareceria.
 *
 * `./conjunto.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do ciclo de
 * vida do conjunto **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas existem pelas duas razões que já sustentam as anteriores, somadas a
 * uma terceira que é própria do domínio de locação: devolver a **enumerabilidade** do alcance a
 * `negocio` (a contenção da §11.2 é de tipo e não alcança texto de SQL); dar UM lugar, sob a
 * política, à leitura e à escrita do agregado; e — a terceira — instalar o **predicado de circulação
 * por padrão** na porta, em vez de deixá-lo por conta de cada listagem que venha a ser escrita. A
 * ADR-0014 nomeia esse esquecimento entre os próprios *Cons*, e o cabeçalho de `./conjunto.ts`
 * registra por que o default invertido é o que o fecha.
 *
 * De lá sai também, pela T10, `lerCarteira` — a leitura composta que devolve a página de conjuntos
 * com os imóveis de cada um. Ela entra pelo mesmo critério das cinco: **recebe** o executor de quem
 * já abriu a unidade, não abre conexão nem transação e não devolve executor. Ela precisa sair porque
 * é o que `apps/api/src/imoveis/conjunto.service.ts` consome para servir `?expandir=imoveis`, e a
 * alternativa — a borda montar a árvore chamando as portas dos dois níveis — devolveria à aplicação
 * a decisão de quantas idas ao banco a carteira custa, que é precisamente o que a §12.2 fixa aqui.
 *
 * `./imovel.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do ciclo de
 * vida do imóvel **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas repetem as três razões de `./conjunto.js` — enumerabilidade do
 * alcance a `negocio`, um lugar único sob a política, e o predicado de circulação por padrão — e
 * acrescentam uma quarta, que é própria desta entidade: a **tradução da violação de unicidade**. A
 * restrição `unique(empresa_id, identificador_municipal)` é o mecanismo que impede a repetição, e
 * traduzi-la exige ler o estado do registro em conflito **depois** da recusa, de dentro da mesma
 * transação. Isso só é possível de dentro do pacote — a leitura corre atrás de um `SAVEPOINT`, sobre
 * a tabela que só daqui é alcançável — e é por isso que `ErroDeIdentificadorMunicipalEmUso` sai
 * daqui: ele é **classe de erro**, no mesmo critério de `ErroDeUnidadeAninhada` e de
 * `ErroDePessoaForaDoContexto`, e não um caminho para dado.
 *
 * De lá sai também, pela fatia de contratos, `definirSituacaoDeLocacaoDoImovel` — a **porta
 * estreita** que escreve `status_locacao`. Ela entra pelo mesmo critério das cinco, e existe para
 * que o **único** caminho que grava `LOCADO` seja enumerável: a porta de alteração continua tipada em
 * `SituacaoInformavel`, e a assimetria entre as duas é decisão fechada da fatia anterior, com prova
 * dedicada. Publicá-la é o que dispensa a ativação de contrato de escrever a coluna por fora — e o
 * que faz "há três produtores de `status_locacao`, todos por porta" ser uma afirmação verificável em
 * vez de uma promessa.
 *
 * De lá **não** sai `lerImoveisDeConjuntos`, e a ausência é deliberada — a mesma de
 * `lerComodosDeImoveis` um nível abaixo. Quem a consome é `./conjunto.js`, para compor a carteira, e
 * publicá-la ofereceria a `apps/api` um caminho para ler imóvel **por conjunto** fora das duas
 * portas que o contrato publica (a listagem paginada e a leitura por identificador) — isto é, uma
 * listagem sem janela, cujo tamanho de resposta ninguém declara.
 *
 * `./comodo.js` entra pela mesma pergunta, e com a mesma resposta: as três escritas do cômodo
 * **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação e não devolvem
 * executor. Elas repetem as razões de `./imovel.js` — enumerabilidade do alcance a `negocio`, um
 * lugar único sob a política — e acrescentam a que é própria desta entidade: a **atribuição de
 * posição** (`max(posicao) + 1`) acontece dentro da própria instrução de gravação, e escrevê-la fora
 * do pacote reabriria a janela de corrida que ela existe para não ter.
 *
 * Duas coisas de lá **não** saem, e as ausências são deliberadas. `lerComodosDeImoveis` fica dentro:
 * quem a consome é `./imovel.js`, para montar o agregado, e publicá-la ofereceria a `apps/api` um
 * caminho para ler cômodo **sem** passar pelo imóvel — que é justamente o que o contrato recusa (não
 * há rota de leitura de cômodo; ele chega e volta dentro do agregado). E `./contexto-de-escrita.js`
 * fica dentro porque é fragmento de SQL: publicá-lo daria à borda um pedaço de instrução para
 * compor, que é o oposto do que a §11.2 mantém.
 *
 * `somarMetragem`, de `./imovel.js`, sai — e ela não é caminho para dado nenhum: é função **pura**
 * sobre os cômodos já lidos. Ela é publicada porque é a materialização do *ponto único de soma* que
 * a decisão D2 do tech_spec exige, e ter o ponto com nome é o que torna a afirmação verificável: uma
 * segunda soma apareceria como um segundo símbolo, e não como uma linha a mais escondida numa
 * consulta.
 *
 * `./contrato.js` entra pela mesma pergunta, e com a mesma resposta: as operações do ciclo de vida do
 * contrato — inclusive as **duas da série** — **recebem** o executor de quem já abriu a unidade, não
 * abrem conexão nem transação e não devolvem executor. As duas da série não abrem exceção: elas
 * invocam pelo executor recebido as funções `SECURITY DEFINER` que a migração `0008` criou, e é
 * justamente por isso que a aplicação nunca precisa — nem pode — tocar a sequência (ADR-0020).
 *
 * Elas repetem as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar único sob a
 * política, o predicado de circulação por padrão, a tradução da violação de unicidade — e acrescentam
 * a que é própria desta entidade: **a chave da porta é o código legível** (ADR-0017), e o UUID
 * interno, que sai em `ContratoPersistido.id`, só existe para o vínculo de fiador e para a porta
 * estreita do imóvel.
 *
 * São **duas** traduções de unicidade, e não uma: `ErroDeCodigoEmUso` e
 * `ErroDeImovelComContratoVigente` saem daqui pelo mesmo critério de `ErroDeIdentificadorMunicipalEmUso`
 * — são classes de erro, não caminho para dado. Traduzir `23505` em bloco esconderia uma colisão atrás
 * da outra.
 *
 * De lá **não** sai `lerFiadoresDeContratos`, e a ausência é deliberada — a mesma de
 * `lerComodosDeImoveis` e de `lerImoveisDeConjuntos`: não há rota de leitura de fiador, ele chega e
 * volta dentro do agregado do contrato, e publicá-la ofereceria a `apps/api` um caminho para ler o
 * vínculo sem passar pelo pai.
 *
 * `./cobranca.js` entra pela mesma pergunta, e com a mesma resposta: as oito operações da cobrança —
 * inclusive as **duas transições**, as **duas da série** e o leitor do ano do escopo dela —
 * **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação e não devolvem
 * executor. As duas da série não
 * abrem exceção, pela razão que as do contrato já registram: elas invocam pelo executor recebido as
 * funções `SECURITY DEFINER` que a migração `0010` criou, e é por isso que a aplicação nunca precisa
 * — nem pode — tocar a sequência (ADR-0020).
 *
 * `lerAnoDaSerieDeCobranca` sai daqui pelo mesmo critério das duas: ela recebe o executor e devolve
 * um número. Ela é publicada porque é o **eixo único de data** da série da cobrança — o mesmo
 * `negocio.data_corrente_da_operacao()` que a visão consulta para classificar a linha —, e ter o eixo
 * com nome é o que torna verificável a afirmação de que o contador, o número, o código e o estado
 * concordam: um segundo eixo apareceria como um segundo símbolo neste índice, e não como um
 * `current_date` escondido numa consulta. Reusar aqui o leitor do contrato, que deriva do fuso da
 * **sessão**, é o defeito que esse nome existe para tornar visível.
 *
 * Elas repetem as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar único sob
 * a política, a chave da porta sendo o código legível (ADR-0017), a tradução da violação de unicidade
 * — e acrescentam a que é própria desta entidade: **a assimetria entre escrita e leitura**. A escrita
 * vai na tabela e **toda** leitura vai na visão `negocio.cobranca_derivada`, que é o lugar único onde
 * o estado e a mora são derivados (ADR-0022, ADR-0023). Publicar a porta é o que dispensa `apps/api`
 * de escrever a consulta por conta própria — e é o que torna *"não há segunda avaliação do estado"*
 * uma afirmação verificável, e não uma promessa de disciplina.
 *
 * Pela T9 saem daqui `emitirNumerosDeCobranca` e `criarCobrancasEmLote`, e as duas entram pelo critério
 * das anteriores: **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação,
 * não devolvem executor e não recebem `empresaId`. A primeira não abre exceção ao que as duas da série
 * já registram — ela invoca a MESMA função `SECURITY DEFINER`, uma vez por número, e o que muda é
 * quantas viagens ao banco isso custa (uma, e não N). A segunda é publicada porque a escrita das
 * parcelas é **um `INSERT` de N linhas**: publicar a porta é o que impede a borda de compor o laço
 * "emitir número, gravar, reler a visão" por parcela, em que o número de idas ao banco passaria a ser
 * escolhido pelo prazo que o cliente contratou — e em que o `SAVEPOINT` da tradução da colisão de
 * código, que é ponto único dentro da porta, nasceria esquecido.
 *
 * As **duas transições** (`acusarPagamentoDeCobranca`, `cancelarCobranca`) saem daqui pelo critério
 * das demais escritas, e cada uma acrescenta uma razão própria. A do pagamento é publicada porque o
 * carimbo dos **quatro** valores e a gravação dos dois fatos são **uma instrução só**, que lê a visão
 * no `FROM`: publicá-la é o que impede a borda de compor o par "ler a mora, gravar o pagamento", em
 * que a mora carimbada seria a de uma leitura anterior e a fórmula acabaria reescrita fora da visão
 * (ADR-0022, ADR-0023). A do cancelamento é publicada porque **não é idempotente** por decisão — quem
 * recusa a repetição é a guarda de estado da borda, com o estado atual nomeado —, e um `UPDATE`
 * condicional escrito por fora silenciaria a segunda tentativa. Nenhuma das duas recebe `empresaId`, e
 * nenhuma confere estado: o escopo é da política do banco e a guarda é da aplicação.
 *
 * Pela T10 sai daqui `cancelarCobrancasDoContrato`, a **cascata**, e ela entra pelo critério das demais
 * escritas: recebe o executor de quem já abriu a unidade, não abre conexão nem transação, não devolve
 * executor e não recebe `empresaId`. A razão própria dela é o **predicado**: cancelar as cobranças de um
 * contrato é `pago_em IS NULL AND cancelado_em IS NULL`, e publicar a porta é o que impede a borda de
 * compor o par "listar as em aberto pela visão, cancelar uma a uma" — que seria a segunda avaliação do
 * estado que o marcador `DECISÃO FECHADA` daquele arquivo existe para tornar impossível, e que gravaria
 * com base numa leitura anterior à escrita. Ela devolve **quantas linhas o banco alcançou**, e não a
 * lista: quem chama publica a contagem numa linha de trilha, e conjunto vazio é resultado legítimo.
 *
 * `ErroDeCodigoDeCobrancaEmUso` sai daqui pelo mesmo critério de `ErroDeCodigoEmUso`: é **classe de
 * erro**, não caminho para dado. Ela precisa sair porque quem a traduz no envelope da ADR-0017 é a
 * borda, e a alternativa — reconhecer a recusa pelo texto da mensagem — amarraria a tradução ao
 * idioma configurado no servidor. `gravarSobRestricaoDoCodigo` e `ehViolacaoDe` ficam **dentro**,
 * como os gêmeos de `./contrato.ts`: são compostos por dentro da própria porta.
 *
 * `./configuracao-de-mora.js` entra pela mesma pergunta, e com a mesma resposta: as **duas**
 * operações da política de multa e juros **recebem** o executor de quem já abriu a unidade, não abrem
 * conexão nem transação e não devolvem executor. Elas repetem as razões das anteriores —
 * enumerabilidade do alcance a `negocio`, um lugar único sob a política — e acrescentam a que é
 * própria desta entidade: **a escrita é um `upsert` de um comando só**. Publicar a porta é o que
 * impede a borda de escrever por conta própria o par "ler, decidir, gravar", que passa em todos os
 * casos felizes e perde escrita sob concorrência; e a leitura tem lar único porque é ela que traduz a
 * ausência de linha nos zeros que a apuração da view já produz por `COALESCE` (RD-21 concordando com
 * a RD-08). Nenhuma das duas recebe `empresaId`: o escopo é da política do banco.
 *
 * `./politica-de-aviso.js` entra pela mesma pergunta, e com a mesma resposta: as **duas** operações
 * da política da régua **recebem** o executor de quem já abriu a unidade, não abrem conexão nem
 * transação e não devolvem executor. Elas repetem as razões de `./configuracao-de-mora.js`, que é o
 * molde exato — a escrita é um `upsert` de um comando só, e a leitura tem lar único porque é ela que
 * traduz a **ausência de linha** na régua desligada (RD-03) —, e acrescentam a que é própria desta
 * entidade: a **projeção `to_char(coluna, 'HH24:MI')`** dos dois horários. Ela não é detalhe de quem
 * consulta: sem ela o driver devolve `'09:00:00'`, o esquema de SAÍDA recusa, e a recusa de um esquema
 * de saída **não produz `422`** — ela levanta na serialização e derruba a rota de leitura. Publicar a
 * porta é o que faz a projeção existir num lugar só; o `CT-608` prova a obrigação, e este é o ponto
 * onde ela é cumprida.
 *
 * `POLITICA_DE_AVISO_AUSENTE` sai junto, e é a única constante de valor deste índice fora das da carga
 * inicial. Ela entra por critério próprio: é **contrato publicado** — o corpo que a leitura devolve a
 * toda empresa que nunca configurou —, e não caminho para dado nenhum. Publicá-la é o que permite ao
 * job e à borda dizerem *"a régua está desligada"* pelo mesmo objeto congelado que a porta devolve, em
 * vez de cada um recompor os seis campos. Ela diverge do gêmeo `POLITICA_AUSENTE` de
 * `./configuracao-de-mora.js`, que fica **dentro**, e a diferença tem causa: lá o único consumidor é a
 * própria leitura, aqui há dois fora do pacote.
 *
 * `./envio-de-cobranca.js` entra pela mesma pergunta, e com a mesma resposta: as **seis** operações
 * da régua **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação e não
 * devolvem executor. Elas repetem as razões das anteriores — enumerabilidade do alcance a `negocio`,
 * um lugar único sob a política, a chave da porta sendo o código legível (ADR-0017) — e acrescentam
 * **duas** que são próprias desta fatia.
 *
 * A primeira é o **predicado de elegibilidade**. `selecionarCandidatasAoAviso` é uma consulta só,
 * ancorada em `negocio.cobranca_derivada`, e é lá que a ADR-0023 manda a derivação que participa de
 * seleção morar. Publicar a porta é o que impede o job de compor por fora o par "listar a carteira,
 * decidir quem entra" — que seria a segunda avaliação do estado que o marcador `DECISÃO FECHADA` de
 * `./cobranca.ts` existe para tornar impossível, e que traria a carteira inteira para a memória antes
 * de filtrar. A **trava do intervalo é apurada no mesmo predicado**, e ela tem marcador
 * `DECISÃO FECHADA` próprio: conta apenas o desfecho `ENVIADA`, contra o texto literal da RN-06, por
 * medição contra o oráculo. Leia-o antes de tocar a consulta.
 *
 * A segunda é a **direção da dependência** (ADR-0025): este módulo importa `CandidataAoAviso` e
 * `TentativaDeEnvio` de `@sysloc/regua` para **satisfazer** as portas que o domínio declarou. A seta é
 * `db → regua`, e não a inversa — o cabeçalho de `packages/regua/src/porta-de-dados.ts` registra as
 * três consequências de "corrigi-la", uma delas um ciclo medido que o Turborepo aborta.
 *
 * `lerHoraCorrenteDaOperacao` sai daqui pelo mesmo critério de `lerAnoDaSerieDeCobranca`: recebe o
 * executor e devolve um texto. Ela é publicada porque é o **eixo único de hora do dia** da fatia
 * (ADR-0026) — e ter o eixo com nome é o que torna verificável a afirmação de que não há segundo
 * relógio: ele apareceria como um segundo símbolo neste índice, e não como um `new Date()` escondido
 * no job. `registrarEnvioDeCobranca` é publicada porque **toda** tentativa deixa registro, e é o
 * registro que entrega a idempotência da repetição do job; ela não abre parâmetro de instante, de modo
 * que quando a tentativa aconteceu é fato do banco e de mais ninguém. `lerEnviosDaCobranca` e
 * `contarEnviosDaCobranca` são o par que serve o histórico do operador, e o `total` é o do conjunto
 * inteiro — as duas correm na mesma unidade pela razão que `listarCobrancas` registra.
 *
 * `localizarCandidataAoAviso` (T10) é a sexta, e entra pelo mesmo critério das outras cinco. Ela é a
 * leitura do **disparo manual**, e o que a torna publicável — em vez de uma consulta escrita na borda
 * — é a projeção: ela devolve a **mesma** `CandidataAoAviso` que o predicado devolve, do mesmo
 * fragmento de colunas e das mesmas quatro junções, de modo que os dois caminhos entregam ao domínio
 * objetos indistinguíveis. Ela **não** aplica os três eixos de oportunidade nem recorta estado — a
 * dispensa é parâmetro da admissão, e a recusa da cobrança terminal é do compositor, que é o lar
 * único do discriminador de estado (REG-08).
 *
 * De lá **não** saem `candidataPublicada`, `envioPublicado`, `DESFECHO_QUE_TRAVA` nem os quatro
 * formatos, e as ausências são deliberadas: são o mecanismo interno da tradução e do predicado, pelo
 * mesmo critério de `cobrancaPublicada`, de `colunasDaCobranca` e de `empresaDoContexto`. Publicar o
 * desfecho que trava daria a quem chama a peça com que recompor o predicado por fora, que é
 * exatamente o que a ADR-0023 mantém no banco.
 *
 * `./derivacao-de-cobranca.js` entra pelo MESMO critério de `somarMetragem` e das duas derivações do
 * contrato, e não pelo das portas: `derivarParcelasDoContrato` é **pura** sobre valor já em mãos — não
 * recebe executor, não toca o banco, não lê relógio e não é caminho para dado nenhum. Ela sai daqui
 * porque é a materialização do *ponto único de derivação das parcelas* que a RD-18/RD-19 exigem, e ter
 * o ponto com nome é o que torna a afirmação verificável: uma segunda derivação de competência, de
 * vencimento ou de referência apareceria como um segundo símbolo neste índice — que o `CT-012` audita
 * por igualdade —, e não como um laço a mais escondido no serviço que ativa o contrato. A parcela que
 * ela devolve é **fato** e nada mais (ADR-0022): sem estado, sem mora e sem código, os três derivados
 * ou emitidos noutro lugar.
 *
 * De lá **não** sai `ContratoParaParcelas`, e a ausência é deliberada — mesmo critério dos acessórios
 * de calendário: ele é a declaração dos quatro campos que a derivação consome, e quem chama passa o
 * contrato que já tem em mãos, sem precisar nomear o tipo. `ParcelaDerivada`, sim, sai: é o que a porta
 * de escrita em lote recebe, e o consumidor precisa nomeá-lo para transportar a lista.
 *
 * `./documento-de-contrato.js` entra pela mesma pergunta, e com a mesma resposta: a operação
 * **recebe** o executor de quem já abriu a unidade, não abre conexão nem transação e não devolve
 * executor. Ela repete as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar
 * único sob a política, a chave da porta sendo o código legível (ADR-0017) — e acrescenta **duas**
 * que são próprias desta fatia.
 *
 * A primeira é a **consulta única**. O documento imprime cinco entidades, e a forma idiomática — ler
 * o contrato pela porta que já existe e depois cada parte pela porta dela — poria o número de idas ao
 * banco nas mãos de quantos fiadores o contrato tem. Publicar esta porta é o que impede a borda de
 * compor o laço por fora, pelo mesmo motivo de `lerFiadoresDeContratos` e de
 * `lerContratosVigentesDeImoveis` existirem em lote.
 *
 * A segunda é o **`COALESCE` do valor total**, e ela é a ADR-0023 aplicada à letra: a coluna é
 * anulável e nasce nula em `RASCUNHO`, estado que o documento compõe, de modo que a derivação do que
 * falta corre **no banco**, em `numeric`. Recompor `valorMensal × prazoMeses` em TypeScript faria o
 * mesmo contrato publicar `null` no JSON da rota e um valor no documento — textualmente o defeito que
 * o `Context` daquela ADR nomeia como origem dela. `derivarValorTotal` **não** é reusada ali, e o
 * cabeçalho daquele módulo registra por quê.
 *
 * A **direção da dependência** é a mesma de `./envio-de-cobranca.js` (ADR-0025): o módulo importa
 * `DadosDoContratoParaDocumento` de `@sysloc/documentos` para **satisfazer** a forma que o domínio
 * declarou. A seta é `db → documentos`, e não a inversa — o cabeçalho de
 * `packages/documentos/tsconfig.json` registra o ciclo que a inversão fecha.
 *
 * De lá **não** saem `parteEmJson` nem `imovelEmJson`, e a ausência é deliberada: são o mecanismo
 * interno da projeção, pelo mesmo critério de `colunasDoContrato` e de `cobrancaPublicada`.
 *
 * `./portador-de-confirmacao.js` entra pela mesma pergunta, e com a mesma resposta: as **quatro**
 * operações do portador **recebem** o executor de quem já abriu a unidade, não abrem conexão nem
 * transação e não devolvem executor. `resolverPortador` não abre exceção ao que as funções de série
 * já registram: ela invoca, pelo executor recebido, a função `SECURITY DEFINER` que a migração `0014`
 * criou — e é justamente por isso que a aplicação nunca precisa (nem pode) ler a tabela sem contexto.
 *
 * Elas repetem as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar único sob
 * a política — e acrescentam **duas** que são próprias desta entidade.
 *
 * A primeira é o **ponto único da derivação**. `derivarSegredo` sai daqui pelo critério de
 * `somarMetragem` e das duas derivações do contrato: é função **pura**, não recebe executor e não é
 * caminho para dado nenhum. Ela é publicada porque a borda precisa derivar o segredo apresentado
 * antes de resolvê-lo, e ter o ponto com nome é o que torna verificável a afirmação de que não há
 * uma segunda derivação: ela apareceria como um segundo símbolo neste índice — que o `CT-012` audita
 * por igualdade —, e não como um `createHash` escondido num serviço. `gerarSegredo` sai junto pelo
 * **mesmo critério**, e por ser o par simétrico dela: o sorteio e a derivação do mesmo segredo são um
 * fato só, e publicar metade dele deixaria o índice sugerindo que sortear em outro lugar é legítimo —
 * um segundo `randomBytes` de segredo apareceria como símbolo a mais aqui, exatamente como uma
 * segunda derivação apareceria.
 *
 * ⚠️ **A publicação de `gerarSegredo` NÃO é justificada por prova**, e o registro disso é deliberado:
 * hoje **nenhum** consumidor fora deste pacote a importa — a borda recebe o claro já pronto de
 * `emitirPortador` —, e o `CT-729` a alcança pelo caminho direto do módulo
 * (`../src/portador-de-confirmacao.ts`), não por esta fronteira. Publicar símbolo para o teste
 * enxergar é o que a Iron Law #6 proíbe, e seria o que este parágrafo estaria confessando se a razão
 * fosse a prova.
 *
 * A segunda é a **assimetria de contexto**. `resolverPortador` corre **fora** de qualquer contexto de
 * tenant — a empresa é o resultado dela, e não a entrada (ADR-0024, ADR-0027) —, enquanto as outras
 * três correm sob o contexto que ela descobriu. Publicar a porta é o que impede a borda de compor por
 * fora o par "ler o portador, decidir se já foi usado, gravar", que passa em todos os casos felizes e
 * perde a corrida entre duas apresentações do mesmo segredo: o consumo é
 * `UPDATE … WHERE consumido_em IS NULL RETURNING`, e a ausência de retorno é ela própria o resultado.
 *
 * De lá **não** sai constante alguma — nem os 32 bytes do sorteio, nem o prazo de validade —, e a
 * ausência é deliberada: são o mecanismo interno da emissão, pelo mesmo critério de
 * `empresaDoContexto` e de `colunasDaCobranca`. O que a borda precisa saber sobre a forma do segredo
 * já é contrato publicado, e vive em `@sysloc/contracts`.
 *
 * `./derivacao-de-contrato.js` entra pelo MESMO critério de `somarMetragem`, e não pelo das portas:
 * as duas funções são **puras** sobre valor já em mãos — não recebem executor, não tocam o banco,
 * não leem relógio e não são caminho para dado nenhum. Elas saem daqui porque são a materialização
 * do *ponto único de derivação* que a RD-10 exige, e ter o ponto com nome é o que torna a afirmação
 * verificável: uma segunda derivação da data de fim ou do valor total apareceria como um segundo
 * símbolo neste índice, e não como uma linha a mais escondida no serviço que ativa o contrato.
 *
 * `./cadastro-de-pessoa.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do
 * ciclo de vida dos três cadastros de pessoa — locador, locatário e fiador — **recebem** o executor
 * de quem já abriu a unidade, não abrem conexão nem transação e não devolvem executor. Elas repetem
 * as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar único sob a política, o
 * predicado de circulação por padrão — e acrescentam a que é própria destas três: **o papel é
 * parâmetro, e a parametrização é por tabela**. Publicar UMA porta para os três papéis é o que
 * impede a borda de escolher a tabela por conta própria; e `PAPEIS_DE_PESSOA` sai junto porque é a
 * união fechada que a borda usa para fixar o papel de cada controlador, sem redigitar os três nomes.
 *
 * De lá sai também `localizarPessoas`, a leitura **em lote** por papel, e ela entra pelo critério das
 * demais — recebe o executor, não abre conexão, não devolve executor — com uma razão própria: a
 * coleção de fiadores de um contrato **não tem teto** (RD-06), e conferi-la com uma leitura por item
 * faria o número de idas ao banco ser escolhido pela requisição. Publicá-la é o que dá à borda um
 * caminho para conferir N cadastros num custo que **não depende de N** — e é o que impede a próxima
 * conferência de nascer como laço, na T7 ou depois. Ela devolve um **mapa** por identificador, e não
 * uma lista, porque quem chama precisa iterar os identificadores na ordem em que o cliente os enviou
 * para nomear o primeiro problema; o docblock dela registra por quê.
 *
 * De lá saem também, pela T9, `ErroDeDocumentoEmUso` e `gravarCadastroSobRestricaoDeUnicidade`. A
 * classe entra pelo MESMO critério de `ErroDeUnidadeAninhada`, de `ErroDePessoaForaDoContexto` e de
 * `ErroDeIdentificadorMunicipalEmUso`: é classe de erro, não caminho para dado. O envoltório entra
 * porque a tradução da violação de unicidade exige **ler o estado do registro em conflito depois da
 * recusa, na mesma transação e atrás de um `SAVEPOINT`** — o que só é possível de dentro do pacote —,
 * e porque as duas escritas cruas seguem observáveis pelos casos da T8, que afirmam o `23505` e o
 * nome da restrição. Ele **não** é caminho para dado: recebe o executor de quem já abriu a unidade e
 * devolve o que a função envolvida devolver.
 *
 * O que de lá **não** sai é `TABELA_POR_PAPEL`, e a ausência é deliberada: ele é a declaração
 * **interna** da parametrização — o mapa de papel para nome físico de tabela —, e publicá-lo ofereceria
 * a `apps/api` o nome da tabela, que é justamente o que a §11.2 mantém dentro. `RESTRICAO_DO_DOCUMENTO`
 * fica dentro pelo mesmo critério, e `lerConflitoDoDocumento` também: publicá-la daria à borda uma
 * leitura por documento sem passar pela recusa que a justifica. `somenteDigitos` de `@sysloc/shared`
 * também não é reexportado: quem precisa dele fora daqui o importa de lá.
 *
 * A igualdade é sobre a superfície ACHATADA, e a distinção não é detalhe: as três linhas
 * `export * as …` abaixo publicam tudo o que o módulo de origem exporta, hoje e no futuro. Um
 * conjunto que só comparasse os nomes de topo veria `contextoDeTenant` como UM nome e deixaria
 * passar qualquer símbolo acrescentado a `contexto.ts` — inclusive um cliente. Por isso o CT-012
 * compara `contextoDeTenant.executarCom`, `esquemaNegocio.negocio` e afins, um a um, e procura as
 * marcas do executor também nos valores de dentro do namespace.
 */

export {
  type AcessoAIdentidade,
  abrirAcessoAIdentidade,
  type BancoDeIdentidade,
  type TabelasDeIdentidade,
} from './acesso-identidade.js';
export {
  alterarPessoa,
  type ConflitoDeDocumento,
  criarPessoa,
  type DadosDaPessoa,
  definirCirculacaoDaPessoa,
  ErroDeDocumentoEmUso,
  gravarCadastroSobRestricaoDeUnicidade,
  type JanelaDePessoasCadastradas,
  listarPessoas,
  localizarPessoa,
  localizarPessoas,
  PAPEIS_DE_PESSOA,
  type PaginaDePessoasCadastradas,
  type PapelDePessoa,
  type PessoaAlterada,
  type PessoaCadastrada,
} from './cadastro-de-pessoa.js';
export {
  type CoberturaDeIsolamento,
  type ExcecaoDeIsolamento,
  type MotivoDeExcecao,
  verificarCoberturaDeIsolamento,
} from './catalogo.js';
export {
  acusarPagamentoDeCobranca,
  cancelarCobranca,
  cancelarCobrancasDoContrato,
  criarCobranca,
  criarCobrancasEmLote,
  type DadosDaCobranca,
  type DesfechoDoPagamento,
  ErroDeCodigoDeCobrancaEmUso,
  emitirNumeroDeCobranca,
  emitirNumerosDeCobranca,
  type FiltrosDaCarteira,
  garantirContadorDeCobranca,
  type JanelaDaCarteira,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
  listarCobrancas,
  localizarCobranca,
  type PaginaDeCobrancasPersistidas,
} from './cobranca.js';
export {
  acrescentarComodo,
  alterarComodo,
  type ComodoPersistido,
  type DadosDoComodo,
  removerComodo,
} from './comodo.js';
export {
  type ConfiguracaoDeMoraPersistida,
  gravarConfiguracaoDeMora,
  lerConfiguracaoDeMora,
} from './configuracao-de-mora.js';
export {
  alterarConjunto,
  type ConjuntoComImoveisPersistido,
  type ConjuntoPersistido,
  criarConjunto,
  type DadosDoConjunto,
  definirCirculacaoDoConjunto,
  type JanelaDeConjuntos,
  lerCarteira,
  listarConjuntos,
  localizarConjunto,
  type OpcoesDeCirculacao,
  type PaginaDaCarteiraPersistida,
  type PaginaDeConjuntosPersistidos,
} from './conjunto.js';
export * as contextoDeTenant from './contexto.js';
export {
  alterarContrato,
  ativarContrato,
  type ContratoPersistido,
  cancelarContrato,
  criarContrato,
  type DadosDoContrato,
  type DerivacoesDaAtivacao,
  definirCirculacaoDoContrato,
  ErroDeCodigoEmUso,
  ErroDeImovelComContratoVigente,
  emitirNumeroDeContrato,
  type FiadorDoContrato,
  garantirContadorDeContrato,
  type JanelaDeContratos,
  lerAnoDaSerieDeContrato,
  listarContratos,
  localizarContrato,
  type NumeroDaSerie,
  type PaginaDeContratosPersistidos,
  substituirFiadoresDoContrato,
} from './contrato.js';
export {
  derivarParcelasDoContrato,
  type ParcelaDerivada,
} from './derivacao-de-cobranca.js';
export { derivarTerminoDaLocacao, derivarValorTotal } from './derivacao-de-contrato.js';
export {
  type AgregadoDoDocumentoDoContrato,
  lerAgregadoDoContrato,
} from './documento-de-contrato.js';
export {
  type AlvoDeReemissao,
  admitirEmpresa,
  type EmpresaNova,
  type EmpresaPersistida,
  encerrarSessoesDaEmpresa,
  type JanelaDeEmpresas,
  lerAlvoDeReemissao,
  listarEmpresas,
  localizarEmpresa,
  localizarPessoaPorEmail,
  type MarcaDeSuspensao,
  type PaginaDeEmpresasPersistidas,
  reativarEmpresa,
  suspenderEmpresa,
} from './empresa.js';
export {
  contarEnviosDaCobranca,
  type JanelaDeEnvios,
  lerEnviosDaCobranca,
  lerHoraCorrenteDaOperacao,
  localizarCandidataAoAviso,
  registrarEnvioDeCobranca,
  selecionarCandidatasAoAviso,
} from './envio-de-cobranca.js';
export * as esquemaIdentidade from './esquema/identidade.js';
export * as esquemaNegocio from './esquema/negocio.js';
export {
  alterarImovel,
  type ConflitoDeIdentificador,
  criarImovel,
  type DadosDaAlteracaoDoImovel,
  type DadosDoImovel,
  definirCirculacaoDoImovel,
  definirSituacaoDeLocacaoDoImovel,
  ErroDeIdentificadorMunicipalEmUso,
  type ImovelPersistido,
  type JanelaDeImoveis,
  listarImoveis,
  localizarImovel,
  type PaginaDeImoveisPersistidos,
  somarMetragem,
} from './imovel.js';
export {
  type AjustePersistido,
  type AjustesDaPessoa,
  type ChaveDeAjuste,
  type EfeitoDoAjuste,
  ErroDePessoaForaDoContexto,
  type EscritaDeAjustes,
  escreverAjustes,
  incrementarVersaoPermissoes,
  lerAjustesDaPessoa,
  type PerfilDaPessoa,
  type TrocaDePerfil,
  trocarPerfilDaPessoa,
} from './permissao.js';
export {
  contarAjustesDaPessoa,
  definirAtivoDaPessoa,
  encerrarSessoesDaPessoa,
  garantirVinculoDeAcesso,
  type JanelaDePessoas,
  listarPessoasDaEmpresa,
  localizarPessoaDoContexto,
  type PaginaDePessoasPersistidas,
  type PessoaDoContexto,
  type PessoaPersistida,
} from './pessoa.js';
export {
  gravarPoliticaDeAviso,
  lerPoliticaDeAviso,
  POLITICA_DE_AVISO_AUSENTE,
} from './politica-de-aviso.js';
export {
  type ConsumoDoPortador,
  consumirPortador,
  derivarSegredo,
  emitirPortador,
  gerarSegredo,
  invalidarPortadoresDoLocatario,
  type PortadorEmitido,
  type PortadorResolvido,
  resolverPortador,
} from './portador-de-confirmacao.js';
export {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  type AcessoSemeado,
  EMPRESA_A,
  EMPRESA_B,
  EMPRESAS,
  type EmpresaSemeada,
  type OpcoesDeSemente,
  PROVEDOR_DE_CREDENCIAL,
  SENHA_DA_CARGA,
  semear,
  USUARIO_MASTER,
  USUARIOS,
  type UsuarioSemeado,
} from './semente.js';
export {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  ErroDeContextoInvalido,
  ErroDeUnidadeAninhada,
  type OpcoesDeAcessoAoBanco,
} from './unidade-de-trabalho.js';
