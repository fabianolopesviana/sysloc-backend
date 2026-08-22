/**
 * O **vocabulário canônico** da cobrança bancária — o que o produto fala, e não o que o banco fala.
 *
 * ===========================================================================
 * A cláusula que este módulo existe para tornar verdadeira
 * ===========================================================================
 *
 * A ADR-0001 fixa que *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"*. É
 * uma propriedade do **vocabulário**, não do número de operações: ela vale igual para a porta de
 * identidade (`./porta-de-identidade.ts`, uma operação) e para a de cobrança
 * (`./porta-de-cobranca.ts`, quatro). Este módulo carrega o vocabulário das **duas**, e é por isso
 * que a varredura que o protege é uma só.
 *
 * Na prática, isto é o que este arquivo NÃO tem: nada que se chame como um campo do provedor, nada
 * que carregue código de banco, nada que nomeie recurso da API de lá. Quem traduz o dialeto do
 * provedor é o adaptador, e a tradução morre nele.
 *
 * ===========================================================================
 * O ENUM É IMPORTADO, e a ausência de uma segunda declaração é a decisão
 * ===========================================================================
 *
 * `MEIOS_DE_RECEBIMENTO` tem **definição única** em `@sysloc/contracts` (ADR-0016), e este módulo o
 * importa para derivar a união — não o redeclara. Duas declarações do mesmo fato é a forma exata do
 * débito **D14** que a fase anterior deixou aberta sobre o fuso da operação: dois fatos executáveis
 * dizendo a mesma coisa, livres para divergir, com nada que acuse quando divergirem.
 *
 * A derivação por `typeof` **não** é uma segunda declaração: ela não escolhe membro nenhum, e
 * acrescentar um meio no contrato alarga esta união sozinho. O que se cria aqui é o **nome** pelo
 * qual o domínio se refere ao vocabulário, e a origem dele fica visível no próprio import.
 *
 * ---------------------------------------------------------------------------
 * `PIX` é declarado e não tem operação — e isso NÃO é bandeira desligada
 * ---------------------------------------------------------------------------
 *
 * A RN-11 declara os dois meios e implementa só o boleto. Bandeira desligada esconde código pronto;
 * aqui **não há código a esconder** — nenhum caminho de execução deste pacote consome `PIX`, e o
 * CT-835 afirma essa ausência por lista vazia, que é o que separa uma coisa da outra.
 */

import type { DETALHES_DA_VERIFICACAO, MEIOS_DE_RECEBIMENTO } from '@sysloc/contracts';
import type { SegredoOperavel } from '@sysloc/shared';

/**
 * Os meios pelos quais o produto recebe, como união fechada — derivada da fonte única do contrato.
 *
 * Quem precisar do arranjo (para percorrer, para conferir em execução) importa
 * `MEIOS_DE_RECEBIMENTO` de `@sysloc/contracts`, que é onde ele mora congelado. Este pacote publica
 * o **tipo** porque é o tipo que o domínio manipula; republicar o valor daria ao produto dois
 * caminhos para o mesmo arranjo, e o segundo escaparia do `Object.freeze` da origem se algum dia
 * alguém o copiasse em vez de reexportá-lo.
 *
 * ⚠️ **A derivação por `typeof` NÃO é intercambiável com `export type { MeioDeRecebimento } from
 * '@sysloc/contracts'`, e a diferença foi MEDIDA — não argumentada.** O reexport publica o mesmo
 * nome com uma definição só, e o argumento acima (que é sobre o *valor*) de fato não o desautoriza:
 * tipo não existe em execução e não há `Object.freeze` a escapar. O que o desautoriza é o efeito
 * sobre a prova. Com o reexport, este pacote deixa de citar `MEIOS_DE_RECEBIMENTO` no vocabulário
 * executável, e a **âncora antivácuo** do CT-835 (`citacoesDe`) reprova — medido na T8, rodada 3:
 * `AssertionError: expected [] to deeply equal [ 'modelo-canonico.ts' ]`. A âncora existe porque a
 * asserção vizinha — *"nenhuma ligação local do enum"* — passa a ser satisfeita **por vacuidade**
 * num pacote que simplesmente não usa o nome: a metade *"importado"* da ADR-0016 ficaria sem prova,
 * e a limpeza teria custado cobertura. **É o import que mantém a varredura com o que examinar.**
 */
export type MeioDeRecebimento = (typeof MEIOS_DE_RECEBIMENTO)[number];

/**
 * O que o `detalhe` de uma verificação de identidade pode dizer — **união fechada**.
 *
 * ---------------------------------------------------------------------------
 * A união é DERIVADA da fonte única, e a derivação é o que fecha o D27
 * ---------------------------------------------------------------------------
 *
 * Os textos têm declaração única em `@sysloc/contracts` (ADR-0016), pela mesma razão escrita no
 * docblock de {@link MeioDeRecebimento}: duas declarações do mesmo fato divergem sem que nada
 * acuse. A derivação por `typeof` **não** é uma segunda declaração — ela não escolhe texto nenhum, e
 * um desfecho novo declarado lá alarga esta união sozinho.
 *
 * Enquanto o campo era `string`, a restrição *"o texto sai de um conjunto fechado"* valia por
 * boa-fé de quem escrevesse o adaptador, e o `CT-834` não podia cobrá-la: ele varre **nomes** —
 * chaves de tipo, símbolos, literais declarados —, nunca valores em execução. Agora quem cobra é o
 * compilador, em **todo** caminho de atribuição, e alargar o conjunto obriga a editar o mesmo objeto
 * que o esquema publicado enumera.
 *
 * ⚠️ **Ela não amarra este tipo ao contrato publicado**, e a distinção é a da `DECISÃO FECHADA`
 * abaixo: o que se importa daqui é o **vocabulário**, e não a forma do corpo que a API devolve. Uma
 * mudança da projeção publicada segue sem alcançar a assinatura da porta.
 */
export type DetalheDaVerificacao =
  (typeof DETALHES_DA_VERIFICACAO)[keyof typeof DETALHES_DA_VERIFICACAO];

/**
 * O que a porta recebe para verificar uma identidade — **o invólucro opaco, e nada mais**.
 *
 * ---------------------------------------------------------------------------
 * Por que um tipo de um campo só, em vez do invólucro cru na assinatura
 * ---------------------------------------------------------------------------
 *
 * Porque é este tipo que a fatia (ii) alarga. O tech spec §8 já registra que `client_id` e `scope`
 * entram no **que se cifra**, e não na tabela nem no contrato: quando isso acontecer, o dado
 * continuará chegando por aqui, e a assinatura da operação não muda. Um `SegredoOperavel` solto na
 * assinatura faria o acréscimo de qualquer outro dado de identidade virar mudança de assinatura,
 * arrastando o adaptador e a borda junto.
 *
 * ⚠️ **Nenhum endereço, nenhuma URL e nenhuma credencial de habilitação entram aqui.** Para onde a
 * verificação conecta é decisão de quem monta o processo — o adaptador recebe o endereço na
 * construção, lido do ambiente num ponto só (tech spec §3.9 da T10). Aceitá-lo por este tipo faria
 * uma entrada de usuário decidir o destino da conexão, que é a forma canônica do defeito de
 * requisição forjada do lado do servidor.
 *
 * O campo se chama `segredo`, e não `certificado`, `pfx` ou `material`: o domínio não sabe que
 * formato o adaptador vai apresentar ao provedor — sabe apenas que carrega um segredo operável.
 */
export interface IdentidadeParaVerificar {
  /** O material e a senha que o abrem, opacos (ADR-0032). Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
}

/**
 * O desfecho de uma verificação de identidade — **três campos, e nenhum deles do provedor**.
 *
 * ---------------------------------------------------------------------------
 * A recusa do provedor é um DESFECHO, nunca uma exceção
 * ---------------------------------------------------------------------------
 *
 * `aceito: false` é resposta: a pergunta do Admin — *"esta identidade serve?"* — foi respondida, e a
 * resposta é "não". Modelar a recusa como rejeição da promessa obrigaria quem chama a distinguir
 * "não serve" de "o serviço falhou" pelo tipo do erro, e a borda traduziria a primeira em `500`
 * (RN-06). O mesmo vale para indisponibilidade e tempo esgotado: são desfechos, e o `detalhe` os
 * separa.
 *
 * ---------------------------------------------------------------------------
 * Ele NÃO é um alias de `ResultadoDaVerificacao` de `@sysloc/contracts`
 * ---------------------------------------------------------------------------
 *
 * Os dois coincidem hoje, campo a campo, e a coincidência é **contingente**. Este é o que atravessa
 * a **porta**, e pertence ao domínio (ADR-0025); aquele é o que a **API publica**, e pertence ao
 * contrato (ADR-0016). Amarrá-los faria uma mudança da superfície publicada reescrever a assinatura
 * da porta e, com ela, o adaptador — que não tem nada com o que o frontend lê. Quem os aproxima é o
 * serviço da borda, num ponto só, e é o esquema publicado que confere a saída lá.
 *
 * A duplicação aparente, portanto, não é o débito D14: ali eram dois fatos **executáveis** dizendo a
 * mesma coisa (um limiar, um fuso), livres para divergir sem que nada acusasse. Aqui são dois fatos
 * **distintos** que hoje têm a mesma forma, e a divergência entre eles é justamente o que a fatia
 * (ii) prevê — o `detalhe` do desfecho positivo perde a ressalva de alcance quando a sonda subir.
 */
// DECISÃO FECHADA — T8 / Gate 2 · 2026-08-15
// O QUÊ: `ResultadoDaVerificacaoDeIdentidade` é declarado aqui, e NÃO é alias, `Pick` nem
//        reexportação de `ResultadoDaVerificacao` de `@sysloc/contracts`.
// POR QUÊ: a alternativa idiomática — um alias, já que as formas coincidem — foi descartada por
//          razão concreta: este tipo atravessa a PORTA e pertence ao domínio (ADR-0025); aquele é o
//          que a API PUBLICA e pertence ao contrato (ADR-0016). Amarrá-los faria uma mudança da
//          superfície publicada reescrever a assinatura da porta e, com ela, o adaptador — que não
//          tem nada com o que o frontend lê. A coincidência já nem é total: o esquema publicado
//          declara `verificadoEm` como `z.iso.datetime()`, e aqui ele é `string`.
// REVERTER EXIGE: provar que o desfecho da porta e o corpo publicado não podem mais divergir — o
//                 que a fatia (ii) já contradiz ao zerar `detalhe` no desfecho positivo.
export interface ResultadoDaVerificacaoDeIdentidade {
  /** O par aceitou a identidade apresentada. */
  readonly aceito: boolean;
  /**
   * Quando o ato aconteceu, como instante ISO-8601 em UTC — **cadeia, nunca `Date`**.
   *
   * A forma segue o que o produto já pratica na fronteira de dados (`packages/db/src/`): objeto de
   * data reserializado no fuso do processo desloca o valor, e a cadeia atravessa da origem até a
   * resposta sem ninguém reinterpretá-la.
   *
   * ⚠️ Ele é **carimbo do ato externo**, e não relógio de decisão de negócio. A ADR-0026 continua
   * valendo onde ela incide: a vigência do certificado é comparada com
   * `negocio.data_corrente_da_operacao()`, e nada neste desfecho decide comportamento do produto.
   */
  readonly verificadoEm: string;
  /**
   * O alcance do desfecho, em português do produto — **união fechada**, e anulável.
   *
   * Ele carrega, **inclusive no desfecho positivo**, o que a sonda desta fatia afirma e o que ela
   * não afirma (tech spec §8), para que a tela do Admin não prometa mais do que foi medido. É
   * anulável porque a fatia que subir a sonda para o `client_credentials` (débito **D36 · F4/T10**)
   * o zera no positivo, quando ela passar a responder a pergunta inteira — sem a anulabilidade,
   * aquela fatia mudaria contrato publicado para fazer o que já está decidido.
   *
   * ⚠️ **Nenhum detrito do runtime de transporte entra aqui** — nem código de erro de biblioteca,
   * nem texto de OpenSSL, nem nome de recurso do provedor. Isso deixou de depender de boa-fé quando
   * o tipo subiu de `string` para {@link DetalheDaVerificacao}: quem escolhe o texto é o adaptador,
   * e só pode escolhê-lo do conjunto fechado que `@sysloc/contracts` declara. Foi o que fechou o
   * **D27 · F4/T8**, cuja saída estrutural o `CT-834` não alcançava por varrer **nomes**, e nunca
   * valores em execução.
   */
  readonly detalhe: DetalheDaVerificacao | null;
}

// ===========================================================================
// O vocabulário das QUATRO operações de cobrança — o que atravessa a porta
// ===========================================================================

/**
 * As duas classes de falha (RN-02) — **o adaptador classifica, o domínio decide o que ela causa**.
 *
 * `DA_COBRANCA` é a falha que pertence àquela cobrança e a nenhuma outra: o percurso do lote marca a
 * cobrança como recusada e **segue**. `DA_EMPRESA` é a falha que valeria igual para a próxima —
 * certificado vencido, identidade recusada, provedor fora do ar —, e o percurso **para**, deixando
 * de pé o que já saiu (CA-03).
 *
 * A divisão do trabalho é conteúdo, e não estilo: só o adaptador tem como **distinguir** as duas,
 * porque só ele lê a resposta do provedor; e só o domínio tem como decidir **o que a distinção
 * provoca**, porque só ele conhece o lote. Reclassificar no domínio traria o vocabulário do provedor
 * de volta para dentro dele, que é o que a ADR-0001 existe para impedir.
 *
 * São **duas**, e não um enum aberto com um ramo padrão: um terceiro valor obrigaria quem percorre o
 * lote a decidir entre parar e seguir sem que nada o cobrasse. A união fechada faz o compilador
 * cobrar o ramo novo em todo consumidor.
 */
export type ClasseDaFalha = 'DA_COBRANCA' | 'DA_EMPRESA';

/**
 * O desfecho de uma operação da porta — **a operação resolve sempre, e nunca rejeita**.
 *
 * ---------------------------------------------------------------------------
 * A recusa do provedor é um DESFECHO, e a alternativa idiomática foi descartada
 * ---------------------------------------------------------------------------
 *
 * É a mesma decisão, e a mesma razão, de {@link ResultadoDaVerificacaoDeIdentidade}: levantar faria
 * a borda traduzir *"o provedor recusou esta cobrança"* em `500`, e quem opera leria *"o sistema
 * falhou"* onde o fato é *"a emissão foi recusada"* — dois desfechos operacionais opostos (RN-06).
 * Pior no lote: uma exceção derrubaria o percurso inteiro num ponto em que a decisão correta, na
 * metade dos casos, é **seguir** para a próxima cobrança.
 *
 * A união é **discriminada por `aceito`**, e é isso que impede ler `valor` de um desfecho negativo —
 * o compilador estreita o tipo no `if`, sem que nada precise ser lembrado por quem escreve.
 *
 * `motivo` é **texto opaco**: entra tal como o provedor o informou (RN-15) e nada o interpreta para
 * decidir. É o mesmo desenho de `diagnostico` em `packages/db/src/evento-bancario.ts`, e a razão é
 * a mesma — a inocuidade de um motivo desconhecido vem de nada o traduzir. Ele é **valor**, não
 * nome, e por isso não colide com a cláusula de vocabulário da ADR-0001, que alcança nome de campo,
 * URL e termo declarado.
 */
export type DesfechoDaOperacao<T> =
  | { readonly aceito: true; readonly valor: T }
  | { readonly aceito: false; readonly classe: ClasseDaFalha; readonly motivo: string };

/**
 * O que **toda** operação da porta carrega: de quem é a identidade, e o segredo que a habilita.
 *
 * O adaptador é um só para o processo inteiro, e a empresa muda a cada cobrança de um lote — por
 * isso a identidade viaja no **ato**, e não na construção. É `empresaId` que chaveia o cache de
 * credencial do adaptador, e é ele que impede a credencial de uma empresa de ser apresentada em
 * chamada de outra.
 *
 * ⚠️ **O segredo chega opaco** (ADR-0032), e quem o abre é o adaptador, no instante do ato. Nada
 * aqui carrega material decifrado, senha em claro, endereço de destino ou credencial de habilitação:
 * endereço é propriedade de quem constrói o adaptador — aceitá-lo por aqui faria uma entrada de
 * usuário decidir o destino da conexão —, e a credencial de habilitação é vocabulário do provedor.
 */
/**
 * A identidade da empresa perante o provedor — o que o certificado sozinho não diz.
 *
 * Nasceu do fechamento do `D36 · F4/T10`, em 2026-08-20. Antes dela, o pedido de credencial saía
 * **sem `client_id`** e a emissão **sem os dados da conta**: o provedor recusava os dois, e o
 * produto não tinha de onde tirá-los.
 *
 * ⚠️ Ela viaja no ATO, e não na configuração do adaptador, porque é **por empresa** — cada
 * imobiliária tem a própria aplicação e a própria conta no provedor. O endereço de autorização, que
 * é do provedor e igual para todas, mora do outro lado, em `ConfiguracaoDoProvedorBancario`.
 */
export interface IdentidadeDoProvedor {
  /**
   * O identificador da aplicação, **em claro**.
   *
   * ⚠️ É segredo operável (ADR-0032): ele vive cifrado no banco e só é decifrado no ponto que vai
   * usá-lo. Chegar aqui em claro é o uso legítimo — o que não pode é voltar por superfície alguma.
   */
  readonly identificadorDaAplicacao: string;
  readonly numeroDoCliente: number;
  readonly numeroDaContaCorrente: number;
  readonly codigoDaModalidade: number;
}

interface AtoNoProvedor {
  /** A empresa em nome de quem o ato acontece — nunca lida de requisição (ADR-0008/0009). */
  readonly empresaId: string;
  /** O material e a senha que o abrem, opacos. Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
  /**
   * A identidade da empresa perante o provedor.
   *
   * Obrigatória, e a obrigatoriedade é a rede: com ela no tipo, **nenhuma operação futura consegue
   * ser escrita sem os dados** que o provedor exige — o compilador recusa o ato incompleto, em vez
   * de a recusa chegar do banco, semanas depois, como emissão negada.
   */
  readonly identidade: IdentidadeDoProvedor;
}

/**
 * O ato sobre um boleto que **já existe** no provedor — as duas revogações e a consulta partem daqui.
 *
 * `numeroDoTituloNoProvedor` é o nome do **produto** para o número que o provedor atribuiu ao
 * título. O termo do dialeto dele está no glossário global entre os que se evitam, e publicá-lo faria
 * a varredura de vocabulário reprovar a própria porta que ela protege. A coluna física herdada
 * continua com o nome antigo, e o mapeamento morre na fronteira de dados.
 *
 * ⚠️ **Não o confunda com o identificador que o produto compõe** e envia na emissão
 * ({@link PedidoDeEmissao.identificadorNoProvedor}). São dois números distintos, de donos distintos:
 * este é atribuído **pelo provedor**; aquele é composto **pelo produto** e é a chave de correlação.
 */
export interface AtoSobreBoleto extends AtoNoProvedor {
  /** O número que o provedor atribuiu ao título — devolvido por {@link BoletoEmitido}. */
  readonly numeroDoTituloNoProvedor: string;
}

/**
 * Quem paga a cobrança, no vocabulário do **produto**.
 *
 * ⚠️ **O nome é `locatario`, e a escolha é vinculante**: `pagador` e `sacado` são termos do dialeto
 * do provedor, e o primeiro permanece na lista de termos que a varredura de vocabulário reprova.
 * Quem traduz para o nome que a API do banco espera é o adaptador, e a tradução morre nele.
 *
 * Os campos são os do cadastro de pessoa que o produto já guarda, e nenhum a mais: o provedor exige
 * nome, documento e endereço de quem paga para emitir o título — foi medido no dado do sistema
 * antigo, cujo registro de entrada carrega exatamente esses três grupos.
 */
export interface LocatarioDaCobranca {
  readonly nome: string;
  /** O documento principal **em dígitos**, como o cadastro o guarda — remascarar é apresentação. */
  readonly documento: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
}

/**
 * O que o domínio pede para emitir um boleto.
 *
 * `identificadorNoProvedor` é o número de 18 posições que o **produto** compõe a partir do contador
 * declarado pela ADR-0033 e envia junto do pedido. Ele é a chave de correlação que a fatia do carnê
 * usa para reencontrar o título, e não se recupera depois — por isso ele é gravado no mesmo ato em
 * que o boleto é gravado.
 *
 * `valor` e `vencimento` chegam **já decididos**: nada nesta camada calcula mora, e o vencimento é
 * data de calendário `YYYY-MM-DD`, nunca um `Date` — objeto de data reserializado no fuso do
 * processo desloca o dia, que é o defeito que a fronteira de dados deste produto já evita.
 */
export interface PedidoDeEmissao extends AtoNoProvedor {
  /** As 18 posições que o produto compôs — **enviadas**, e não recebidas (ADR-0033). */
  readonly identificadorNoProvedor: string;
  /** O valor a cobrar, na mesma grandeza que a fronteira de dados publica. */
  readonly valor: number;
  /** Data de calendário `YYYY-MM-DD` — nunca um `Date`. */
  readonly vencimento: string;
  readonly locatario: LocatarioDaCobranca;
}

/**
 * O boleto que o provedor emitiu — os três identificadores dele mais os bytes do documento.
 *
 * Os bytes vêm no mesmo ato, e não numa segunda chamada, porque é o desfecho da emissão que os
 * produz: buscá-los depois abriria uma janela em que a cobrança tem título e não tem documento, e
 * quem a atravessasse publicaria um boleto pela metade.
 *
 * `linhaDigitavel` e `codigoDeBarras` são o **meio de pagamento**, e não vocabulário do provedor:
 * quem os lê é a pessoa que paga, em qualquer banco.
 */
export interface BoletoEmitido {
  /** O número que o provedor atribuiu ao título — a chave dele, e não a do produto. */
  readonly numeroDoTituloNoProvedor: string;
  readonly linhaDigitavel: string;
  readonly codigoDeBarras: string;
  /** Os bytes do documento, tal como o provedor os entregou. Quem os grava é a guarda de boletos. */
  readonly documento: Buffer;
}

/**
 * O que o domínio pergunta ao consultar um título — e `incluirDocumento` é o que evita a quinta
 * operação.
 *
 * A re-obtenção do documento cujo arquivo sumiu do disco (CA-08) é a **mesma** pergunta que a
 * conferência diária faz, com uma diferença de grau: ali os bytes importam, aqui não. Um sinalizador
 * no pedido cobre as duas, e uma operação dedicada a "obter o documento" seria uma quinta assinatura
 * dizendo o que esta já diz — com o custo de a conferência poder chamá-la por engano e trazer o
 * documento de cada cobrança do dia.
 *
 * Ele é **obrigatório**, e não opcional com padrão: quem consulta declara se quer os bytes. O padrão
 * silencioso decidiria por omissão a única coisa que separa uma consulta barata de uma cara.
 */
export interface ConsultaDeSituacao extends AtoSobreBoleto {
  /** `true` traz os bytes do documento; `false` responde só a situação. */
  readonly incluirDocumento: boolean;
}

/** O documento acompanha qualquer situação, e é nulo quando a consulta não o pediu. */
interface ComDocumento {
  readonly documento: Buffer | null;
}

/** O título está de pé e ninguém o pagou. */
interface SituacaoEmAberto extends ComDocumento {
  readonly situacao: 'EM_ABERTO';
}

/** O título foi pago — com a data e o valor **que o provedor informou**, e não os esperados. */
interface SituacaoLiquidada extends ComDocumento {
  readonly situacao: 'LIQUIDADO';
  /** Data de calendário `YYYY-MM-DD` do pagamento, como o provedor a informou. */
  readonly pagoEm: string;
  /** O valor efetivamente pago — pode divergir do esperado, e a divergência é registrada. */
  readonly valorPago: number;
}

/**
 * O título foi revogado, e o motivo chega como **texto opaco**.
 *
 * O produto não tem — e não deve ter — enum que reconheça os motivos do provedor: é justamente nada
 * os interpretar que torna um motivo desconhecido inócuo (RN-15). Ele é preservado byte a byte como
 * diagnóstico da trilha, e nenhum ramo de decisão o lê.
 */
interface SituacaoRevogada extends ComDocumento {
  readonly situacao: 'REVOGADO';
  readonly motivo: string;
}

/** O pagamento foi desfeito depois de informado — o oposto de {@link SituacaoLiquidada}. */
interface SituacaoEstornada extends ComDocumento {
  readonly situacao: 'ESTORNADO';
}

/**
 * A situação do título no provedor, **traduzida** — união discriminada por `situacao`.
 *
 * Os quatro estados são os que produzem efeito no produto, e a união fechada é o que faz o
 * compilador cobrar o ramo de quem os consome: um estado novo não passa despercebido por um `switch`
 * com ramo padrão. Os ramos não são publicados individualmente porque quem consulta estreita o tipo
 * pelo discriminador, sem precisar nomeá-los — publicar os quatro alargaria a superfície sem
 * consumidor que a peça.
 *
 * ⚠️ **Nada aqui é código, sigla ou situação do dialeto do provedor.** Quem traduz é o adaptador, e
 * a tradução morre nele (ADR-0001).
 */
export type SituacaoConsultada =
  | SituacaoEmAberto
  | SituacaoLiquidada
  | SituacaoRevogada
  | SituacaoEstornada;

// ===========================================================================
// O vocabulário da ENTREGA DA NOTÍCIA — o que atravessa a porta irmã
// ===========================================================================

/**
 * O que o provedor respondeu ao recusar o cadastro da entrega — **diagnóstico, e nunca autoridade**.
 *
 * ---------------------------------------------------------------------------
 * A tensão entre a RN-02 e a ADR-0001, e por que ela NÃO é conflito
 * ---------------------------------------------------------------------------
 *
 * O PRD exige o motivo **íntegro** — código, mensagem e os campos que variam por recusa —, e a
 * ADR-0001 proíbe *"campo, URL ou vocabulário específico de provedor"* de cruzar a porta. As duas se
 * conciliam porque a cláusula é do **vocabulário**, e vocabulário é **nome**, não valor: é a mesma
 * leitura que a emenda de 2026-08-17 aplica à credencial de acesso. A ancoragem direta é o
 * `Consequences → Neutros` da ADR-0034 — *"o que o terceiro informou continua preservado como
 * diagnóstico no evento que houve, inclusive quando o produto não reconhece o que ele disse"*.
 *
 * Por isso os **três nomes são do produto** e os **três valores são do provedor, verbatim**. O
 * precedente de forma é o *recebido cru* do glossário, e o irmão executável é `motivo` de
 * {@link DesfechoDaOperacao}: guardado como chegou, lido por ninguém.
 *
 * ---------------------------------------------------------------------------
 * A consequência exigível, e é ela que fecha a classe: o motivo NÃO DECIDE NADA
 * ---------------------------------------------------------------------------
 *
 * Nenhum ramo do produto lê **dentro** dele. O que decide habilitada/desabilitada é o desfecho
 * canônico da porta ({@link ResultadoDaOperacaoDeEntrega.aceito}), e é por isso que um código de
 * recusa que ninguém previu é inócuo: não há tabela que o traduza, nem `switch` que o consulte.
 *
 * ⚠️ **Ler a PRESENÇA do motivo não é ler dentro dele**, e a distinção é o que separa esta decisão
 * de um contorno dela. Quem orquestra distingue *"o provedor recusou"* de *"o provedor não
 * respondeu"* pela anulabilidade declarada em {@link ResultadoDaOperacaoDeEntrega}; o que
 * permanece proibido é qualquer ramo que compare `codigo`, case `mensagem` ou alcance uma chave de
 * `diagnostico`.
 */
export interface MotivoDaRecusaDoProvedor {
  /** O código que o provedor devolveu, **íntegro**. Não se traduz, não se normaliza, não se compara. */
  readonly codigo: string;
  /** A mensagem que o provedor devolveu, **íntegra**. Idem. */
  readonly mensagem: string;
  /**
   * Os campos que **variam por código de recusa**, guardados como chegaram — portador **opaco**.
   *
   * Ele é `Record<string, unknown>` porque a premissa do produto é que a forma varia, e declará-la
   * seria a alternativa A2 do D5: publicar o objeto do provedor como tipo declarado, o que **viola**
   * a cláusula de fecho da ADR-0001 e a varredura de vocabulário pega.
   *
   * ⚠️ **As chaves aqui dentro são do provedor em EXECUÇÃO, e isso não conflita com a varredura**,
   * que é estática sobre o **texto do fonte** — nome de tipo, membro de tipo, símbolo declarado e
   * literal de cadeia. Nenhuma dessas quatro posições existe para uma chave que só aparece em
   * execução, e o eixo negativo do controle positivo do `CT-1032` é o que afirma a ausência de
   * conflito em vez de prometê-la.
   *
   * ⚠️ **Ele é ANULÁVEL, e o nulo é conteúdo**: *"o provedor recusou e não mandou campo variável
   * nenhum"*, **distinto de `{}`**. Variar inclui não haver nenhum — é o que
   * `negocio.entrega_da_noticia.motivo_diagnostico` admite (`jsonb` anulável, com a `CHECK` da `0023`
   * exigindo apenas `motivo_diagnostico IS NULL OR motivo_codigo IS NOT NULL`), é o que
   * `MotivoDaRecusaDoProvedor` de `@sysloc/db` declara, e é o que o contrato publicado passou a
   * declarar. **Quem compõe não escreve `?? {}`**: isso converteria *"não mandou campo nenhum"* em
   * *"mandou objeto vazio"*, que é a mesma mentira sobre a origem que {@link
   * ResultadoDaOperacaoDeEntrega} proíbe um nível acima.
   *
   * ---------------------------------------------------------------------------
   * O NÚMERO do teto é do contrato publicado; a VIGÊNCIA dele é da camada que grava
   * ---------------------------------------------------------------------------
   *
   * `MAIOR_DIAGNOSTICO_EM_CHAVES` e `MAIOR_DIAGNOSTICO_EM_CARACTERES` vivem em `@sysloc/contracts`
   * porque são contrato publicado e o número mora num lugar só — mas **não é o esquema que os faz
   * valer**: esquema de saída não é `parse`ado em execução, e os `.refine()` de lá não sobrevivem ao
   * documento publicado. Quem aplica o teto é `limitarDiagnostico`, chamada por
   * `gravarDesfechoDaEntrega` em `packages/db/src/entrega-da-noticia.ts` — o único ponto que escreve
   * a coluna —, e lá ele **trunca**, nunca recusa.
   *
   * ⚠️ **Quem constrói este valor no adaptador não precisa clampar**, e não deve: um segundo ponto de
   * aplicação seria a segunda declaração da mesma regra, livre para divergir da que grava.
   */
  readonly diagnostico: Record<string, unknown> | null;
}

/**
 * O que a porta recebe para cadastrar — e para consultar — a entrega da notícia desta empresa.
 *
 * ---------------------------------------------------------------------------
 * Ele estende o ato no provedor, e o acréscimo VAZIO é a decisão
 * ---------------------------------------------------------------------------
 *
 * As duas operações precisam exatamente do que todo ato no provedor precisa: de quem é a identidade,
 * o segredo que a habilita e os dados da conta que a entrega endereça. **Nada além disso atravessa**
 * — nem endereço de destino, nem teto de tempo, nem cabeçalho, nem credencial de habilitação. Para
 * onde o provedor entrega a notícia é propriedade de quem constrói o adaptador, lida do ambiente num
 * ponto só; aceitá-la por aqui faria uma entrada de usuário decidir o destino do que se cadastra,
 * que é a forma canônica do defeito de requisição forjada do lado do servidor.
 *
 * Ele é **tipo próprio**, e não `AtoNoProvedor` cru na assinatura, pela mesma razão registrada em
 * {@link IdentidadeParaVerificar}: é este tipo que uma fatia futura alarga, e alargar o ato-base
 * arrastaria junto a emissão, as duas revogações e a consulta de título, que não têm nada com a
 * entrega.
 *
 * ⚠️ **O nome diz `ParaCadastrar` e `consultarEntrega` o recebe igual**, e a assimetria aparente é
 * deliberada: o que este tipo carrega é **qual** entrega — a desta empresa, sob esta identidade —, e
 * as duas operações agem sobre a mesma. Um segundo tipo idêntico para a consulta seria duas
 * declarações do mesmo fato, livres para divergir, que é a forma exata do débito **D14**.
 */
export interface EntregaParaCadastrar extends AtoNoProvedor {}

/**
 * O desfecho de uma operação de entrega — **resolve sempre, e nunca rejeita**.
 *
 * ---------------------------------------------------------------------------
 * A recusa do provedor é um DESFECHO, e a alternativa idiomática foi descartada
 * ---------------------------------------------------------------------------
 *
 * É a mesma decisão, e a mesma razão, de {@link ResultadoDaVerificacaoDeIdentidade} e de
 * {@link DesfechoDaOperacao}: levantar faria a borda traduzir *"a vaga já está ocupada"* em `500`, e
 * o Admin leria *"o sistema falhou"* onde o fato é uma resposta à pergunta que ele fez — dois
 * desfechos operacionais opostos (RN-06). Recusa pelo par, indisponibilidade e tempo esgotado são
 * **respostas**, e chegam como este valor.
 *
 * A união é **discriminada por `aceito`**, e é ele — e só ele — que o produto lê para decidir o
 * estado. É a consequência exigível do D5, e o que impede o vocabulário do provedor de virar regra:
 * *"habilitada"* exige o cadastro **e** a consulta positivos (RN-01), e quem prevalece é a consulta.
 *
 * ---------------------------------------------------------------------------
 * `motivo` é ANULÁVEL, e a anulabilidade carrega conteúdo
 * ---------------------------------------------------------------------------
 *
 * Nulo significa *"não houve o que preservar íntegro"* — o provedor não chegou a responder
 * (indisponibilidade, tempo esgotado). Preenchê-lo com texto do produto nesses casos faria os três
 * campos mentirem sobre a própria origem, que é justamente o que preservá-los verbatim existe para
 * garantir; e omitir a anulabilidade obrigaria o adaptador a inventar um código de recusa que
 * provedor nenhum emitiu.
 *
 * É essa distinção que a fatia da borda lê para **preservar o estado anterior** quando o provedor
 * está fora do ar, em vez de gravar uma desabilitação que ninguém decidiu — e ela é leitura da
 * **presença**, nunca do conteúdo.
 */
export type ResultadoDaOperacaoDeEntrega =
  | {
      readonly aceito: true;
      /**
       * A referência ao cadastro, quando a operação a produziu — **só o cadastro produz**.
       *
       * É a única vez em que o produto obtém a referência de um ato de **escrita**, e é ela que, na
       * tentativa seguinte, prova que a vaga é nossa quando o endereço tiver mudado. As demais
       * operações devolvem `null`: elas agem sobre um cadastro cuja referência quem chamou já tinha.
       */
      readonly referencia: ReferenciaDoCadastroDaEntrega | null;
    }
  | { readonly aceito: false; readonly motivo: MotivoDaRecusaDoProvedor | null };

/**
 * A referência ao cadastro junto ao provedor — **opaca**, e a opacidade é a decisão.
 *
 * O produto não a interpreta, não a compara com nada e não decide por ela. Ela responde **uma**
 * pergunta — *"a vaga é ocupada por um cadastro que este produto criou?"* — e é essa resposta que
 * autoriza corrigir o endereço dele, ou reativá-lo, **sem tocar cadastro de terceiro**.
 *
 * ⚠️ **Ela não é vocabulário do provedor atravessando a porta** (ADR-0001): o que atravessa é um
 * valor sem significado deste lado, cujo único uso é ser devolvido à mesma porta que o emitiu. O
 * nome é do produto, e nenhum ramo do domínio, do serviço ou da tela lê dentro dele.
 */
export type ReferenciaDoCadastroDaEntrega = string;

/**
 * O que a consulta encontrou junto ao provedor — **o desfecho é ternário, e o quarto não é desfecho**.
 *
 * ===========================================================================
 * Por que a consulta deixou de responder um booleano
 * ===========================================================================
 *
 * `{ aceito: boolean }` respondia *"existe registro?"*, e a pergunta certa é *"existe registro
 * **ativo**, do tipo de movimento certo, apontando para o **meu** endereço — e, se não, o que
 * exatamente há lá?"*. As respostas são operacionalmente distintas e pedem **atos distintos**, e
 * colapsá-las foi o que produziu os dois defeitos que este tipo existe para fechar: um webhook
 * **inativado** contava como ativo (o produto afirmava saúde no exato cenário em que a entrega
 * estava morta), e um cadastro apontando para **outro endereço** também.
 *
 * ===========================================================================
 * `EM_VALIDACAO` é o estado NORMAL de saída de toda ação corretiva
 * ===========================================================================
 *
 * A documentação do provedor declara que **três** atos levam à mesma situação — cadastrar, alterar
 * a URL e reativar. Quem o tratar como caso de borda vai reescrevê-lo três vezes. Ele **não** é
 * habilitada (a entrega ainda não entrega) nem desabilitada (ela vai entregar): é transitório, e
 * quem o promove é a reconferência periódica, que já existe e já consulta.
 *
 * ===========================================================================
 * `NAO_RESPONDEU` NÃO é um desfecho — é a ausência de leitura
 * ===========================================================================
 *
 * Ele é o que o `D35` nomeava: *"o provedor não respondeu"* e *"o provedor respondeu e não há
 * cadastro nosso"* chegavam iguais, e a borda gravava **desabilitada** para os dois — apagando o
 * estado de uma entrega que podia estar de pé só porque a rede falhou. Nenhum ramo do produto pode
 * gravar desabilitação a partir dele.
 */
export type LeituraDaEntrega =
  /** O provedor não respondeu — indisponibilidade, tempo esgotado, ou recusa da concessão. */
  | { readonly tipo: 'NAO_RESPONDEU'; readonly motivo: MotivoDaRecusaDoProvedor | null }
  /** Ele respondeu, e **não há cadastro algum** no tipo de movimento que este produto usa. */
  | { readonly tipo: 'SEM_CADASTRO' }
  /** Cadastro nosso, validado e não inativado — a entrega **está de pé**. */
  | { readonly tipo: 'ATIVA' }
  /** Cadastro nosso, ainda aguardando a validação do endereço pelo provedor. */
  | { readonly tipo: 'EM_VALIDACAO' }
  /**
   * Cadastro nosso, **inativado** pelo provedor — pede reativação, e traz a causa que ele deu.
   *
   * ⚠️ **O motivo é verbatim do provedor** (ADR-0034), e é o que torna esta leitura acionável: o
   * exemplo oficial traz `"Erro ao enviar notificação"`, que diz ao Admin exatamente o que houve. É
   * também o que permite à reconferência periódica **desabilitar com causa** quando encontra a
   * entrega morta — sem ele, ela teria de escolher entre gravar desabilitação sem explicação e não
   * gravar nada, e as duas são piores.
   */
  | {
      readonly tipo: 'INATIVA';
      readonly referencia: ReferenciaDoCadastroDaEntrega;
      readonly motivo: MotivoDaRecusaDoProvedor | null;
    }
  /** Cadastro nosso, mas apontando para um endereço que não é o atual — pede correção. */
  | { readonly tipo: 'ENDERECO_DIVERGENTE'; readonly referencia: ReferenciaDoCadastroDaEntrega }
  /**
   * A vaga está ocupada por cadastro que **não é nosso** — e nele o produto não toca.
   *
   * Sem referência, de propósito: não havendo prova de propriedade, não há ato autorizado, e
   * carregar o identificador aqui convidaria alguém a usá-lo.
   */
  | { readonly tipo: 'DE_TERCEIRO' };
