/**
 * `@sysloc/cobranca-bancaria` — o **domínio** da cobrança bancária, e o sétimo pacote do monorepo.
 *
 * ---------------------------------------------------------------------------
 * O que este pacote é, e o que ele deliberadamente não conhece
 * ---------------------------------------------------------------------------
 *
 * Ele declara o **vocabulário canônico** da integração e a **porta** que o adaptador do provedor
 * satisfaz, e para nisso. Não abre transação, não escreve SQL, não sabe HTTP e não conhece rota. Do
 * provedor ele conhece exatamente **um ponto** — o adaptador que chega com a T10 e hospeda toda a
 * tradução do dialeto do banco —, e a porta continua chegando a quem a usa **por parâmetro**
 * (ADR-0025).
 *
 * As dependências de workspace são `@syslocbr/contracts`, o pacote folha de onde vem a fonte única do
 * vocabulário publicado (ADR-0016), e `@sysloc/shared`, de onde vem o invólucro opaco do segredo
 * (ADR-0032). A ausência de `@sysloc/db` é a decisão, não uma omissão: é a camada de dados que
 * guarda o **envelope cifrado**, sem saber o que há dentro dele. A aresta de volta fecha um ciclo e
 * o Turborepo aborta antes de compilar qualquer coisa. Ver o cabeçalho de `../tsconfig.json`.
 *
 * ⚠️ **EMENDA DA T10 da fatia (ii), 2026-08-17** — o parágrafo acima fica preservado, e duas frases
 * dele **não valem mais**. A do **ciclo** foi falsificada por medição (`pnpm turbo run build
 * --dry=json` monta o grafo sem ciclo, porque `@sysloc/db` não cita este pacote em lista alguma), e
 * a da **ausência** vale hoje só para `dependencies` e para as `references`: `@sysloc/db` entrou em
 * `devDependencies`, porque o percurso do lote é provado contra banco real (tech spec §19.2). Como
 * o pnpm não distingue as duas listas na resolução de módulo, o `src/` **passou a resolver** a
 * camada de dados, e a contenção deixou de ser de construção. Quem impõe a propriedade da ADR-0025 a
 * partir daqui é o **CT-809 (d)** de `test/vocabulario-canonico.spec.ts`. Ver o `"//"` do
 * `../package.json` para a medição com controle.
 *
 * ---------------------------------------------------------------------------
 * A superfície é declarada símbolo a símbolo, e não por `export *`
 * ---------------------------------------------------------------------------
 *
 * Mesma decisão, e mesma razão, de `@syslocbr/contracts`, `@sysloc/regua` e `@sysloc/documentos`: um
 * `export *` publicaria por descuido toda composição interna que um arquivo de `src/` exporte para o
 * vizinho, e retirar depois o que se publicou sem querer é mudança incompatível. Listar é o que
 * mantém a decisão de publicar explícita.
 *
 * É convenção dos pacotes de domínio, e **não** uma regra universal desta base nem decisão de ADR
 * alguma: `packages/db/src/index.ts` publica três namespaces por `export * as`, de propósito e com a
 * razão registrada no docblock dele.
 *
 * ---------------------------------------------------------------------------
 * A superfície é de TIPO e, desde a T9, também de VALOR
 * ---------------------------------------------------------------------------
 *
 * O vocabulário e o contrato de fronteira não existem em execução — interface de TypeScript some na
 * emissão —, e é por isso que o CT-809, o CT-834 e o CT-835 examinam a superfície pelo **texto
 * declarado**, que é o único modo de introspectá-los. A leitura do material (T9) acrescentou os
 * primeiros valores: uma função e duas classes de erro, que a borda do registro consome pela
 * fronteira do pacote. O adaptador (T10) entra nesta lista pela mesma régua — publica-se o que tem
 * consumidor nomeado, e nada além.
 *
 * ---------------------------------------------------------------------------
 * O que o adaptador (T10) publica, e o que ele NÃO publica
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a fábrica, o tipo da configuração que ela recebe, o **teto de tempo** e os **cinco
 * textos de desfecho**. O teto é publicado porque a verificação o importa para medir o efeito dele —
 * limite privado obriga o caso a reescrever o número, e a asserção passa a medir o teste em vez do
 * artefato (o defeito de cinco rodadas de `packages/regua/src/coordenadas-do-transporte.ts`). Os
 * cinco textos, porque é a borda que os repassa ao Admin.
 *
 * ⚠️ **O quinto (`DETALHE_NAO_INICIADO`) entra pela MESMA régua, e não por simetria decorativa**: o
 * consumidor nomeado dos textos de desfecho é um só para todos eles — a borda da T12, que repassa o
 * `detalhe` do resultado. Publicar quatro dos cinco deixaria a superfície com uma assimetria sem
 * critério que a explicasse, e é a assimetria sem critério que faz a fatia seguinte adivinhar.
 *
 * ⚠️ **A verificação NÃO importa os textos daqui**: ela os copia como literais, de propósito.
 * Importá-los faria o caso aprovar qualquer texto, inclusive um que colapsasse dois desfechos num só
 * — é o precedente da `DECISÃO FECHADA` do CT-642. O teto é a exceção declarada, e a razão é a
 * inversa: ali o que se mede é o **efeito** da constante sobre o transporte.
 *
 * O nome da variável de ambiente do endereço **não** sai: ele é o texto da recusa de construção, e
 * publicá-lo convidaria a verificação a compor o esperado a partir do módulo sob prova.
 *
 * ---------------------------------------------------------------------------
 * O que a porta de COBRANÇA acrescenta, e o que ela deliberadamente não publica
 * ---------------------------------------------------------------------------
 *
 * Sai daqui a porta `AdaptadorCobrancaBancaria` — o nome que a ADR-0001 reserva, e que a fatia
 * anterior protegeu para esta usar — mais o vocabulário que a atravessa: o pedido, o boleto, a
 * consulta, a situação, o desfecho e a classe de falha. O consumidor de cada um tem nome e existe
 * nesta fatia: quem percorre o lote, quem reemite, quem confere e a composição raiz que injeta a
 * implementação.
 *
 * ⚠️ **Os quatro ramos de `SituacaoConsultada` não saem**, e a assimetria tem critério: quem consulta
 * estreita o tipo pelo discriminador `situacao`, sem precisar nomeá-los. Publicá-los seria alargar a
 * superfície sem consumidor que a peça — a mesma régua pela qual os cinco textos de desfecho saem.
 *
 * ⚠️ **`DetalheDaVerificacao` sai como tipo, e os textos dele continuam saindo pelos cinco nomes do
 * adaptador.** O tipo é derivado da fonte única de `@syslocbr/contracts`, que é onde os textos passaram
 * a morar quando o débito **D27 · F4/T8** foi fechado — publicar aqui uma segunda cópia do arranjo
 * daria ao produto dois caminhos para o mesmo vocabulário.
 *
 * ---------------------------------------------------------------------------
 * O que a T8 da fatia (ii) acrescentou ao pacote, e por que a superfície NÃO cresceu
 * ---------------------------------------------------------------------------
 *
 * A implementação das quatro operações e o cache da credencial de acesso entraram no pacote, e este
 * barril continua com os mesmos símbolos. As três razões, uma por artefato:
 *
 * - **`credencial-de-acesso.ts` não sai, e a ausência é o mecanismo.** Publicá-lo ofereceria um
 *   segundo caminho, mais fraco, para a mesma política — credencial viva guardada fora do adaptador,
 *   sob outra chave, com outro prazo —, e a frase *"a credencial de uma empresa nunca é apresentada
 *   em chamada de outra"* deixaria de ser propriedade do código. É a mesma régua das quatro
 *   constantes privadas de `OPCOES_PADRAO_DA_TAREFA` em `@sysloc/shared`.
 * - **`criarAdaptadorSicoob` passou a satisfazer as duas portas**, e o nome publicado é o mesmo: quem
 *   recebe continua recebendo **a porta que usa**, por parâmetro (ADR-0025).
 * - **`TETO_DA_OPERACAO_MS` não sai**, e o teto publicado continua sendo `TETO_DO_APERTO_DE_MAO_MS`,
 *   que agora **deriva** dele — é um teto só, com o nome antigo preservado porque está na superfície
 *   e é importado pelo CT-842. Publicar o nome novo alargaria a superfície sem consumidor que o peça,
 *   que é a régua pela qual os cinco textos de desfecho saem e os ramos de `SituacaoConsultada` não.
 *
 * ---------------------------------------------------------------------------
 * O que a GUARDA DE BOLETOS (T9 da fatia (ii)) acrescenta — dois símbolos, e só dois
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a fábrica `criarGuardaDeBoletos` e o contrato `GuardaDeBoletos`. Os consumidores têm
 * nome e existem nesta fatia: a composição raiz, que lê `DIRETORIO_DOS_BOLETOS` e injeta a guarda
 * (ADR-0025 — o diretório-base chega **por parâmetro**, e este pacote não lê `process.env`); o
 * percurso do lote (T10), que grava; e a entrega do boleto (T14), que lê e regrava.
 *
 * ⚠️ **`ErroDeBoletoForaDaGuarda` NÃO sai**, e a assimetria com `ErroDeMaterialIlegivel` /
 * `ErroDeSenhaQueNaoAbre` tem critério: aqueles dois são **desfechos de negócio** que a borda
 * traduz em recusa para o Admin, e por isso ela precisa distingui-los pelo tipo. A recusa da guarda
 * é outra coisa — o código chega a ela **já validado**, vindo de coluna do banco, de modo que uma
 * recusa ali é defeito de programação e não desfecho que alguém trate. Publicá-la alargaria a
 * superfície sem consumidor que a peça, que é a mesma régua de `credencial-de-acesso.ts`.
 *
 * ---------------------------------------------------------------------------
 * O que o PERCURSO DO LOTE (T10 da fatia (ii)) acrescenta — três símbolos
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a função `executarEmissaoEmLote`, o desfecho que ela devolve (`DesfechoDoLote`) e o
 * **tipo de entrada** dela (`TrabalhoDoLote`). O consumidor tem nome e existe nesta fatia: a borda
 * da tarefa do processo de trabalho (T16), que satisfaz as portas por aplicação parcial e registra o
 * desfecho.
 *
 * ⚠️ **A task nomeia dois símbolos, e são três — a divergência é declarada.** `TrabalhoDoLote` sai
 * pela razão que o barril de `@sysloc/regua` escreve por extenso ao publicar `TrabalhoDaRegua`:
 * *"sem eles, a borda não tem como nomear o que monta, e o `.d.ts` da função referenciaria um tipo
 * inalcançável de fora do pacote"*. É o precedente literal do único percurso de domínio que este
 * repositório já publicou.
 *
 * ⚠️ **As seis portas e os três tipos que elas carregam NÃO saem** — `PortaDoIdentificador`,
 * `PortaDosDadosDaCobranca`, `PortaDaEmissaoGravada`, `PortaDaRecusaGravada`,
 * `PortaDaConclusaoDoLote`, `PortaDaInterrupcaoDoLote`, `CobrancaDoLote`, `DadosDaCobrancaAEmitir` e
 * `BoletoParaConciliar`. A assimetria com o barril da régua — que publica `PortaDeCandidatas` e
 * `PortaDeRegistro` — tem critério, e ele é o consumidor: lá quem satisfaz as portas é
 * `@sysloc/db`, que **importa os tipos** para dizer que as satisfaz; aqui quem as satisfaz é a borda
 * da tarefa, montando um objeto literal que o compilador confere **estruturalmente** contra
 * `TrabalhoDoLote`. Publicar nome que ninguém precisa escrever alargaria a superfície sem consumidor
 * que a peça, que é a mesma régua pela qual os quatro ramos de `SituacaoConsultada` não saem.
 *
 * ---------------------------------------------------------------------------
 * O que a REEMISSÃO (T11 da fatia (ii)) acrescenta — seis símbolos
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a função `reemitirBoleto`, o **tipo de entrada** (`TrabalhoDaReemissao`) e o desfecho
 * (`DesfechoDaReemissao`), mais a classe de erro `ErroDeReemissaoIncompleta` e os **dois limites**
 * (`INTERVALO_ENTRE_SONDAS_MS`, `TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS`). O consumidor tem nome e
 * existe nesta fatia: o `BoletoService` da borda (T13), que monta o trabalho, injeta a espera e o
 * relógio, e traduz a falha em resposta.
 *
 * - **A classe de erro sai** pela mesma régua de `ErroDeMaterialIlegivel` e `ErroDeSenhaQueNaoAbre`:
 *   ela é **desfecho de negócio** que a borda distingue **pelo tipo** para escolher o corpo da
 *   resposta e os `detalhes` que a operação lê. Não é a régua de `ErroDeBoletoForaDaGuarda`, que é
 *   defeito de programação e ninguém trata.
 * - **Os dois limites saem** pela razão que `TETO_DO_APERTO_DE_MAO_MS` já escreve: limite privado
 *   obriga quem verifica a **reescrever o número**, e a asserção passa a medir o teste em vez do
 *   artefato. ⚠️ **`TETO_DA_REEMISSAO_MS` NÃO sai** — o teto duro do ato composto não tem consumidor
 *   que precise nomeá-lo, e publicá-lo convidaria quem chama a escolher outro, que é a segunda regra
 *   para o mesmo fato. É a mesma assimetria de `TETO_DA_OPERACAO_MS` no adaptador.
 *
 * ⚠️ **As quatro portas do ato e os dois tipos que elas carregam NÃO saem** — `PortaDeEspera`,
 * `PortaDosDadosDaEmissao`, `PortaDaRevogacaoGravada`, `PortaDoBoletoGravado`, `CobrancaAReemitir` e
 * `DetalhesDaReemissaoIncompleta`. O critério é o mesmo do percurso do lote: quem as satisfaz monta
 * um objeto literal que o compilador confere **estruturalmente** contra `TrabalhoDaReemissao`, e
 * quem lê os detalhes da falha os **repassa** ao envelope sem precisar nomear o tipo.
 *
 * ---------------------------------------------------------------------------
 * O que a CONFERÊNCIA (T12 da fatia (ii)) acrescenta — quatro símbolos
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a função `conferirCobrancas`, o **tipo de entrada** (`TrabalhoDaConferencia`), o desfecho
 * (`DesfechoDaConferencia`) e o vocabulário do efeito (`EfeitoDaConferencia`). O consumidor dos três
 * primeiros tem nome e existe nesta fatia: a borda da tarefa da conferência (T16), que satisfaz as
 * portas por aplicação parcial, fecha a conferência e registra o desfecho no diário.
 *
 * ⚠️ **`EfeitoDaConferencia` é o único que NÃO aparece na assinatura de `conferirCobrancas`, e a
 * divergência fica declarada em vez de resolvida por adivinhação.** O que sai daquela função são as
 * **contagens**; este tipo é a união fechada por que se lê o que a apuração fez em **uma** cobrança, e
 * `efeitos` é a soma dela. Ele sai porque a §1 da task o nomeia entre os símbolos públicos, e porque
 * publicá-lo é a escolha conservadora diante da alternativa — divergir da task por um tipo, sem ganho
 * medido. Se a borda da T16 não precisar nomeá-lo, ele é candidato a sair no fecho da fatia.
 *
 * ⚠️ **As cinco portas da apuração e os seis tipos que elas carregam NÃO saem** —
 * `PortaDoValorEsperado`, `PortaDaLiquidacaoGravada`, `PortaDoEstornoGravado`,
 * `PortaDaRevogacaoGravada`, `PortaDaConclusaoDaConferencia`, `CobrancaAConferir`,
 * `LiquidacaoConsultada`, `ContagensDaConferencia`, `DesfechoDaLiquidacao`, `DesfechoDoEstorno` e
 * `DesfechoDaRevogacao`. O critério é o do percurso do lote e o do ato de reemissão: quem as satisfaz
 * monta um objeto literal que o compilador confere **estruturalmente** contra `TrabalhoDaConferencia`.
 *
 * ⚠️ **`PortaDaRevogacaoGravada` é homônima da porta da reemissão, e as duas são distintas** — aquela
 * não recebe argumento e devolve `void`, esta recebe a cobrança e o motivo e devolve o desfecho, que é
 * o que separa *"revogou"* de *"não havia boleto"*. Nenhuma das duas é publicada, de modo que a
 * homonímia não alcança a superfície; ela existe porque cada percurso declara o **seu** vocabulário
 * (ADR-0025), e fundi-las obrigaria um dos dois a carregar o que só o outro precisa.
 *
 * ---------------------------------------------------------------------------
 * O que o TRATAMENTO DA NOTÍCIA (T4 da fatia (iii)) acrescenta — três símbolos
 * ---------------------------------------------------------------------------
 *
 * Saem daqui as **duas decisões puras** do recebido — `classificarNotificacaoBancaria` e
 * `ehReentregaDeEfeitoAplicado` — e o tipo do que a primeira devolve
 * (`NotificacaoBancariaClassificada`). O consumidor de cada uma tem nome e existe nesta fatia: a
 * tarefa da fila que trata a notícia consome a classificação no passo B.3 e o predicado no passo B.5.
 *
 * O **tipo** sai junto porque ele é o que atravessa a fronteira do pacote — mesmo critério de
 * `DesfechoDoLote`, `DesfechoDaReemissao` e `DesfechoDaConferencia`, e não o dos quatro ramos de
 * `SituacaoConsultada`: aqui o valor devolvido é **um só objeto** que a borda guarda antes de
 * ramificar, e não uma união que ela estreita no mesmo `switch` em que a recebe.
 *
 * ---------------------------------------------------------------------------
 * O que a CONVERSÃO DO MATERIAL (T1 da fatia `integracao-bancaria-autonoma`) acrescenta — cinco
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a operação `converterMaterialSeNecessario`, o desfecho dela (`MaterialPreparado`), a
 * classe de erro `ErroDeFormatoDoMaterial` e **duas constantes** — `MOTIVO_DO_FORMATO_NAO_SUPORTADO`
 * e `RADICAL_DE_SENHA_DO_CONVERSOR`. O consumidor tem nome e existe nesta fatia: a borda de registro
 * do certificado (T2), que prepara o material antes de cifrá-lo e guardá-lo (ADR-0036).
 *
 * - **A classe de erro sai** pela mesma régua de `ErroDeMaterialIlegivel` e `ErroDeSenhaQueNaoAbre`:
 *   é **desfecho de negócio** que a borda distingue **pelo tipo** para escolher o corpo da recusa.
 *   Não é a régua de `ErroDeBoletoForaDaGuarda`, que é defeito de programação e ninguém trata.
 * - **`MOTIVO_DO_FORMATO_NAO_SUPORTADO` sai** porque é o motivo interno que a borda registra no
 *   diário estruturado, e que a verificação compara **por igualdade** contra o que o SUT exporta —
 *   motivo privado obriga quem verifica a reescrever o literal, e a asserção passa a medir o teste em
 *   vez do artefato. É a razão que `TETO_DO_APERTO_DE_MAO_MS` já escreve por extenso.
 * - **`RADICAL_DE_SENHA_DO_CONVERSOR` sai pela MESMA régua, e a exceção é declarada.** O docblock do
 *   barril adverte que a verificação **copia** os textos de desfecho em vez de importá-los, para não
 *   aprovar qualquer texto; aqui o que se mede não é um texto apresentado a alguém, e sim o **efeito**
 *   do radical sobre a classificação — o par CT-1015/CT-1022 exige que ele seja o do **executável**
 *   (`mac verify`) e **não** o `SINAL_DE_SENHA_QUE_NAO_ABRE` da biblioteca, que é privado de
 *   `leitura-do-material.ts` e assim permanece. Duas constantes com o mesmo nome de papel e redações
 *   diferentes é precisamente o que a publicação torna verificável.
 *
 * ⚠️ **O teto da conversão NÃO sai**, e a assimetria com os dois limites da reemissão tem critério:
 * ninguém mede o efeito dele — não há caso que exerça o estouro, e o débito que registra essa
 * ausência vive no ponto do código. Publicá-lo convidaria quem chama a escolher outro, que é a
 * segunda regra para o mesmo fato.
 *
 * ⚠️ **`DesfechoDaNotificacaoBancaria` NÃO sai.** Ela é a união dos nove desfechos que o enum do
 * banco declara, e existe aqui apenas para dar tipo ao parâmetro do predicado: quem o chama passa o
 * valor que leu da camada de dados, sem precisar escrever este nome. Publicá-la ofereceria um segundo
 * lugar de onde declarar o mesmo conjunto — e a duplicação com o enum já é deliberada e amarrada pelo
 * ponto de consumo, como o docblock de `tratamento-de-notificacao.ts` registra.
 *
 * ---------------------------------------------------------------------------
 * O que a ENTREGA DA NOTÍCIA (T5 da fatia `integracao-bancaria-autonoma`) acrescenta — quatro
 * ---------------------------------------------------------------------------
 *
 * Sai daqui a porta irmã `PortaDeEntregaDaNoticia` — a das **duas** operações de configuração — mais
 * o vocabulário que a atravessa: o que se cadastra (`EntregaParaCadastrar`), o desfecho
 * (`ResultadoDaOperacaoDeEntrega`) e o motivo que ele carrega (`MotivoDaRecusaDoProvedor`). O
 * consumidor de cada um tem nome e existe nesta fatia: o adaptador, que diz satisfazê-la (T6), e o
 * serviço da entrega, que a recebe **por parâmetro** e compõe a projeção publicada (T7).
 *
 * ⚠️ **`MotivoDaRecusaDoProvedor` sai, embora nenhum ramo do produto leia dentro dele.** A régua é a
 * mesma dos desfechos que já saem: ele é o que **atravessa a fronteira** do pacote — quem grava o
 * estado precisa nomear o que recebeu para repassá-lo à camada de dados. Não lê-lo é propriedade do
 * uso (D5), e não razão para o tipo ser inalcançável de fora.
 *
 * ⚠️ **A porta irmã é a segunda deste pacote, e o nome que a ADR-0001 reserva continua nomeando
 * exatamente a porta de cobrança.** A régua que a admite aqui são as três condições cumulativas da
 * emenda de 2026-08-15, escritas por extenso no cabeçalho de `porta-de-entrega-da-noticia.ts`.
 */

export type { ConfiguracaoDoProvedorBancario } from './adaptador-sicoob.js';
export {
  criarAdaptadorSicoob,
  DETALHE_ACEITE,
  DETALHE_INDISPONIVEL,
  DETALHE_NAO_INICIADO,
  DETALHE_RECUSA_PELO_PAR,
  DETALHE_TEMPO_ESGOTADO,
  TETO_DO_APERTO_DE_MAO_MS,
} from './adaptador-sicoob.js';
export type {
  DesfechoDaConferencia,
  EfeitoDaConferencia,
  TrabalhoDaConferencia,
} from './conferencia.js';
export { conferirCobrancas } from './conferencia.js';
export type { MaterialPreparado } from './conversao-do-material.js';
export {
  converterMaterialSeNecessario,
  ErroDeFormatoDoMaterial,
  MOTIVO_DO_FORMATO_NAO_SUPORTADO,
  RADICAL_DE_SENHA_DO_CONVERSOR,
} from './conversao-do-material.js';
export type { DesfechoDoLote, TrabalhoDoLote } from './emissao-em-lote.js';
export { executarEmissaoEmLote } from './emissao-em-lote.js';
export type { GuardaDeBoletos } from './guarda-de-boletos.js';
export { criarGuardaDeBoletos } from './guarda-de-boletos.js';
export type { MaterialLido } from './leitura-do-material.js';
export {
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
} from './leitura-do-material.js';
export type {
  AtoSobreBoleto,
  BoletoEmitido,
  ClasseDaFalha,
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  DetalheDaVerificacao,
  EntregaParaCadastrar,
  IdentidadeDoProvedor,
  IdentidadeParaVerificar,
  LeituraDaEntrega,
  LocatarioDaCobranca,
  MeioDeRecebimento,
  MotivoDaRecusaDoProvedor,
  PedidoDeEmissao,
  ReferenciaDoCadastroDaEntrega,
  ResultadoDaOperacaoDeEntrega,
  ResultadoDaVerificacaoDeIdentidade,
  SituacaoConsultada,
} from './modelo-canonico.js';
export type { AdaptadorCobrancaBancaria } from './porta-de-cobranca.js';
export type { PortaDeEntregaDaNoticia } from './porta-de-entrega-da-noticia.js';
export type { PortaDeIdentidadeBancaria } from './porta-de-identidade.js';
export type { DesfechoDaReemissao, TrabalhoDaReemissao } from './reemissao.js';
export {
  ErroDeReemissaoIncompleta,
  INTERVALO_ENTRE_SONDAS_MS,
  reemitirBoleto,
  TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS,
} from './reemissao.js';
export type { NotificacaoBancariaClassificada } from './tratamento-de-notificacao.js';
export {
  classificarNotificacaoBancaria,
  ehReentregaDeEfeitoAplicado,
} from './tratamento-de-notificacao.js';
