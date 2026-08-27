/**
 * Boleto da cobrança — a regra de aplicação dos **dois atos unitários** sobre o título de uma
 * cobrança (emitir, ou reemitir, e revogar) e das **duas leituras** sobre ele: os bytes do documento
 * e o histórico bancário (T14 da fatia `emissao-e-conciliacao`).
 *
 * ===========================================================================
 * AS DUAS LEITURAS são LEITURA, e a diferença alcança as três camadas
 * ===========================================================================
 *
 * Elas não movem dinheiro, não falam com o provedor no caminho comum e não gravam nada — nem no
 * banco, nem na trilha. Por isso exigem **apenas a área** na borda (a ADR-0021 governa transição de
 * estado, e não alcança o que não é transição), e por isso {@link BoletoService.historico} recebe o
 * executor da unidade que o controlador abriu, em vez de a abertura dela: uma leitura não tem por que
 * abrir unidade no meio do caminho.
 *
 * A exceção é a **rebusca** da CA-08, e ela é a única: quando os bytes sumiram do disco, a entrega
 * pergunta ao provedor. Isso a torna, no caminho raro, um ato externo — que corre **fora** de
 * transação alguma, como os dois de escrita, e cuja única ida ao banco (a leitura do certificado)
 * abre unidade própria pela {@link AberturaDeUnidade} que a borda entrega.
 *
 * ===========================================================================
 * O ATO É PARTIDO EM DUAS METADES, e o corte é onde a transação FECHA
 * ===========================================================================
 *
 * {@link BoletoService.prepararAto} corre **dentro** da unidade de trabalho que o controlador abriu e
 * faz três leituras e nenhuma escrita: a cobrança alvo, o certificado vigente da empresa e — só na
 * emissão — o estado publicado, de que sai a recusa de cobrança já liquidada. É a metade curta, e é
 * ela que produz **todas** as recusas que não custam uma ida ao provedor.
 *
 * {@link BoletoService.emitir} e {@link BoletoService.revogar} correm **fora** de transação alguma, e é
 * onde o segredo é decifrado e a conversa com o provedor acontece. A separação não é estética: o ato é
 * chamada de rede a **terceiro**, e mantê-lo dentro de `sql.begin` reservaria uma conexão física da
 * reserva que atende todo o produto durante a espera — que aqui pode chegar aos doze segundos da
 * sondagem da revogação. É o achado da T7 da fatia `documentos-e-confirmacao` (*"o que se protege não
 * é o tempo de resposta, e sim a conexão física, que é o recurso escasso"*), já aplicado em
 * {@link ../integracoes-bancarias/certificado.service.js} sobre uma espera dez vezes menor.
 *
 * ===========================================================================
 * ELE NÃO RECEBE `AcessoAoBanco`, e as unidades do meio do ato vêm da BORDA
 * ===========================================================================
 *
 * A **ausência de `AcessoAoBanco` no construtor** é o mecanismo, e não uma promessa de docblock: o
 * acesso não é injetado aqui porque injetá-lo daria a este serviço exatamente a capacidade que ele não
 * pode ter — abrir unidade própria, sob contexto próprio (decisão D1, ADR-0008). É a mesma decisão, e
 * a mesma razão, de {@link ./cobranca.service.js} e de
 * {@link ../integracoes-bancarias/certificado.service.js}.
 *
 * Só que este ato, diferente de todos os anteriores desta base, **escreve no banco entre duas idas ao
 * provedor**: a revogação é gravada assim que confirmada, e a emissão do título novo vem depois dela.
 * As duas escritas não podem estar na mesma transação — se estivessem, a falha da emissão desfaria a
 * revogação já confirmada junto ao provedor, e o desfecho declarado da CA-06 (*"a cobrança fica sem
 * boleto"*) deixaria de existir. Elas também não podem estar na unidade da borda, porque a rede corre
 * entre elas.
 *
 * A saída é {@link AberturaDeUnidade}: o controlador entrega, **por parâmetro**, a mesma
 * `sobContextoDaSessao` que ele já usa. Consequências, e é por elas que a forma foi escolhida:
 *
 *   * toda unidade continua nascendo na **borda**, pela função única de `comum/contexto-da-sessao.ts`,
 *     e o contexto de tenant continua vindo **da sessão** — não há aqui um segundo caminho para
 *     abri-la, nem forma alguma de escolher outra empresa;
 *   * este serviço continua **sem** o executor cru e sem a porta de conexão: o que ele recebe é o
 *     direito de pedir *"corra isto numa unidade"*, nunca o de decidir contra o quê;
 *   * nenhuma delas aninha — todas são chamadas **fora** de qualquer `sql.begin` —, de modo que a
 *     `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts` **não é tocada**.
 *
 * A alternativa recusada foi o controlador satisfazer as portas do ato: ele passaria a conhecer
 * `revogarBoleto`, `gravarBoletoDaCobranca` e `registrarEventoBancario`, isto é, a regra de domínio
 * inteira, num arquivo cuja fronteira é *validar, abrir a unidade e publicar o contrato*.
 *
 * ===========================================================================
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ===========================================================================
 *
 * Toda instrução vive em `packages/db/src/`, publicada como função de domínio. Não existe, em lugar
 * algum deste arquivo, uma comparação de empresa: a cobrança de outra empresa **não é achada** — a
 * política do banco a esconde (ADR-0008) —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num ponto
 * único ({@link BoletoService.exigir}), com corpo idêntico ao de cobrança inexistente.
 *
 * ===========================================================================
 * O ATO É EM LINHA, e isso NÃO é exceção à ADR-0029
 * ===========================================================================
 *
 * A ADR-0029 manda para a fila o efeito externo *"cujo resultado não compõe a resposta do pedido"*.
 * Aqui o solicitante espera o boleto: a resposta é a própria cobrança com os campos de conciliação
 * preenchidos, e a `Decision` diz que essa classe *"permanece em linha, e não é exceção"*. Quem sai por
 * fila é o **lote**, cujo resultado é uma prestação de contas lida depois.
 *
 * ===========================================================================
 * A SONDAGEM da revogação é a SEGUNDA declaração do laço — e isso é deliberado
 * ===========================================================================
 *
 * {@link BoletoService.confirmarRevogacao} repete a forma de `sondarAConfirmacao`, que é privada de
 * `packages/cobranca-bancaria/src/reemissao.ts`. Ela não é copiada por descuido, e as duas
 * alternativas foram consideradas:
 *
 *   * **publicar a sondagem do pacote** exigiria reabrir o arquivo daquele ato composto, cujo desenho
 *     e cujos casos já foram fechados — mudança de superfície de um artefato aprovado, para servir a
 *     um consumidor que ainda não existia quando ele foi escrito;
 *   * **não sondar** — pedir a revogação e gravar — foi recusado por razão medida: o provedor não
 *     revoga na mesma resposta, e a cobrança que perde `nosso_numero` **sai do conjunto da
 *     conferência** (o predicado dela é *"com boleto vivo"*). Um pagamento que chegasse na janela
 *     ficaria invisível para o produto, que é pior do que o ato falhar.
 *
 * O que **não** se duplica são os números: {@link INTERVALO_ENTRE_SONDAS_MS} e
 * {@link TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS} são importados do pacote, que os publica exatamente para
 * isso. São **duas** declarações do laço, e o limiar deste repositório é **três**: com duas, endurecer
 * uma deixa a outra para trás; a terceira — a fatia do carnê, se ela revogar por outro caminho — é
 * quem paga a promoção do laço para `@sysloc/cobranca-bancaria`.
 *
 * ===========================================================================
 * A trilha registra EFEITO, nunca tentativa (ADR-0034)
 * ===========================================================================
 *
 * São gravados: `BOLETO_EMITIDO` (o título novo existe), `BOLETO_REVOGADO` (o título deixou de
 * existir) e `EMISSAO_RECUSADA` — que é *desfecho anômalo*, a segunda metade literal da `Decision`.
 * **Não** é gravado o ato que nada mudou: a revogação pedida e não confirmada dentro do teto não move
 * estado nenhum, e registrá-la encheria a trilha que a operação lê para responder *"por que esta
 * cobrança está assim"*. O que ela produz é uma linha de diagnóstico no registro estruturado, que a
 * mesma `Decision` mantém fora do alcance dela.
 *
 * ===========================================================================
 * O texto do provedor NÃO entra na resposta (RN-15)
 * ===========================================================================
 *
 * O `motivo` que chega do adaptador é vocabulário de lá, e viaja **apenas** para dois destinos: o
 * `diagnostico` do evento e a linha do journal. O corpo do erro leva mensagem **do produto** e o
 * `detalhes` que a fatia declarou — nunca o texto do runtime, nunca o do terceiro.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type AdaptadorCobrancaBancaria,
  type AtoSobreBoleto,
  ErroDeReemissaoIncompleta,
  type GuardaDeBoletos,
  INTERVALO_ENTRE_SONDAS_MS,
  reemitirBoleto,
  TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS,
} from '@sysloc/cobranca-bancaria';
import {
  gravarBoletoDaCobranca,
  type IdentidadeParaUso,
  type LinhaDeCobranca,
  lerBoletoDaCobranca,
  lerCertificadoVigente,
  lerIdentidadeParaUso,
  lerTrilhaDaCobranca,
  lerVigenciaObservada,
  localizarAlvoDoBoleto,
  localizarCobranca,
  localizarPessoa,
  obterEnvelopeCifradoDoVigente,
  proximoIdentificadorBancario,
  registrarEventoBancario,
  revogarBoleto,
} from '@sysloc/db';
import { CodigoErro, decifrarSegredo, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { Cobranca, EstadoDaCobranca, TrilhaDaCobranca } from '@syslocbr/contracts';
import { ESTADOS_EM_ABERTO } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import type { SessaoComEmpresa } from '../comum/contexto-da-sessao.js';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import {
  type Ambiente,
  TOKEN_AMBIENTE,
  TOKEN_GUARDA_DE_BOLETOS,
  TOKEN_LOGGER,
  TOKEN_PORTA_DE_COBRANCA_BANCARIA,
} from '../configuracao/ambiente.js';
// A derivação da vigência é **importada**, e não reescrita: ela é pura, mora ao lado da superfície que
// publica o certificado, e uma segunda comparação de datas escrita aqui divergiria dela na virada do
// dia. Ver `exigirCertificadoVigente`.
import { derivarEstadoDaVigencia } from '../integracoes-bancarias/certificado.service.js';

/**
 * A abertura de uma unidade de trabalho **da borda**, entregue por parâmetro.
 *
 * Ela é sempre `(trabalho) => sobContextoDaSessao(banco, requisicao, trabalho)`, montada no
 * controlador: o contexto de tenant continua saindo da sessão, e este serviço não conhece a porta de
 * conexão. Ver o cabeçalho para as três alternativas consideradas.
 */
export type AberturaDeUnidade = <T>(
  trabalho: (tx: TransactionSql, sessao: SessaoComEmpresa) => Promise<T>,
) => Promise<T>;

/** O nome de campo que as recusas destes dois atos nomeiam — o identificador da rota. */
const CAMPO_DO_CODIGO = 'codigo';

/** A entidade nomeada nas linhas de trilha destes atos (§13.1). */
const ENTIDADE_DA_TRILHA = 'cobranca';

/**
 * O discriminador do certificado dentro de `detalhes`, e o valor da ausência (§10.1).
 *
 * Constantes nomeadas porque são **contrato publicado**: o cliente as lê para saber que o que falta é
 * configuração da empresa, e não algo no pedido. O nome da validade é o **mesmo** que
 * {@link ../integracoes-bancarias/certificado.service.js} já publica ao recusar material vencido — as
 * duas recusas descrevem o mesmo fato, e um segundo vocabulário para ele faria o cliente aprender dois.
 */
const DISCRIMINADOR_DO_CERTIFICADO = 'certificado';
const CERTIFICADO_AUSENTE = 'AUSENTE';
const DISCRIMINADOR_DA_VALIDADE = 'validoAte';

/**
 * O discriminador do boleto dentro de `detalhes`, e o que ele carrega quando não há título vivo.
 *
 * O nome e o valor são os **mesmos** que `DetalhesDaReemissaoIncompleta` publica no pacote de domínio
 * — é a mesma frase sobre a mesma cobrança, dita por dois desfechos diferentes.
 */
const DISCRIMINADOR_DO_BOLETO = 'boleto';
const SEM_BOLETO = 'SEM_BOLETO';

/**
 * O que o `detalhes` da entrega declara quando a cobrança **nunca teve** título (CA-09).
 *
 * Ele é **outro** valor que {@link SEM_BOLETO}, e a distinção é conteúdo: aquele descreve o desfecho
 * de um ato que derrubou o título e não pôs outro no lugar — a cobrança ficou sem boleto **agora** —,
 * enquanto este descreve a cobrança sobre a qual não há o que entregar. Colapsar os dois faria o
 * cliente ler *"a emissão falhou"* onde o fato é *"ninguém emitiu"*.
 */
const NUNCA_EMITIDO = 'NUNCA_EMITIDO';

/** O discriminador da revogação, e o desfecho que a sondagem sem confirmação declara (§5.2 C). */
const DISCRIMINADOR_DA_REVOGACAO = 'revogacao';
const REVOGACAO_NAO_CONFIRMADA = 'PEDIDA_NAO_CONFIRMADA';

/**
 * Os estados de que a emissão parte — e a razão de a revogação não ter lista própria.
 *
 * Emitir boleto para cobrança **liquidada ou cancelada** é cobrar o que não se deve, e a recusa
 * nomeia o estado atual. Revogar, ao contrário, tem de alcançar os dois: a cobrança cancelada é
 * justamente quem tem título vivo a derrubar, e deixá-la de fora manteria o boleto pagável no mundo —
 * é a mesma razão, palavra por palavra, pela qual `revogarBoleto` não recebe predicado de estado.
 *
 * O rótulo não é escrito por extenso: {@link ESTADOS_EM_ABERTO} é a partição publicada por
 * `@syslocbr/contracts`, e o `CT-510` varre `apps/api/src/**` acusando literal de
 * `negocio.status_cobranca` em posição executável.
 */
const ESTADOS_EMITIVEIS: readonly EstadoDaCobranca[] = ESTADOS_EM_ABERTO;

/**
 * Os dois atos que esta borda executa — **união fechada**, e nunca um booleano posicional.
 *
 * `prepararAto` decide por ele se a guarda de estado corre, e um `exigirEstado: boolean` na chamada
 * do controlador diria `true`/`false` sem dizer *o quê*: quem lesse a rota da revogação veria um
 * `false` solto, e a razão de não haver guarda ali — a cobrança cancelada é justamente quem tem
 * título vivo a derrubar — não estaria em lugar nenhum da chamada.
 *
 * O literal da emissão é também o `transicaoPedida` que a recusa de estado publica: é o mesmo fato,
 * e uma segunda cadeia para nomeá-lo ficaria livre para divergir daquela que o cliente lê.
 */
const EMISSAO_DE_BOLETO = 'EMISSAO_DE_BOLETO';
const REVOGACAO_DE_BOLETO = 'REVOGACAO_DE_BOLETO';

export type AtoPedido = typeof EMISSAO_DE_BOLETO | typeof REVOGACAO_DE_BOLETO;

/** Os dois valores publicados, para que quem chama não redigite o literal. */
export const ATO_DE_EMISSAO: AtoPedido = EMISSAO_DE_BOLETO;
export const ATO_DE_REVOGACAO: AtoPedido = REVOGACAO_DE_BOLETO;

/**
 * As mensagens **do produto** dos dois atos que não se completam — nunca o texto do provedor (RN-15).
 *
 * Cada uma nomeia a cobrança pelo **código**, que é a chave exposta (ADR-0017) e o que a operação usa
 * para agir. Elas não vêm de `MENSAGEM_POR_CODIGO`: aquela tabela publica *"serviço temporariamente
 * indisponível"* para todo `503`, e aqui a resposta precisa dizer **qual** cobrança ficou em que
 * estado — que é o que a CA-06 exige para a operação saber o que fazer em seguida.
 */
const MENSAGEM_DA_EMISSAO_INCOMPLETA = 'a emissão do boleto não se completou para a cobrança';
const MENSAGEM_DA_REVOGACAO_INCOMPLETA = 'a revogação do boleto não se completou para a cobrança';

/** A mensagem da recusa por empresa sem certificado — nomeia o que falta, sem identificador. */
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';

/**
 * A recusa por identidade ausente — irmã da de cima, e **distinta** dela.
 *
 * Distinta de propósito: são duas configurações diferentes, corrigidas em pontos diferentes da tela
 * de integrações. Uma mensagem comum mandaria o Admin conferir o certificado quando o que falta é a
 * identidade da empresa perante o provedor.
 */
const MENSAGEM_SEM_IDENTIDADE = 'esta empresa não tem identidade registrada no provedor';
const DISCRIMINADOR_DA_IDENTIDADE = 'identidade';
const IDENTIDADE_AUSENTE = 'AUSENTE';

/** A mensagem da recusa por certificado vencido — a mesma do registro, pelo mesmo fato. */
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';

/** A mensagem da revogação pedida sobre cobrança que não tem título vivo. */
const MENSAGEM_SEM_BOLETO_A_REVOGAR = 'esta cobrança não tem boleto a revogar';

/**
 * A mensagem da entrega pedida sobre cobrança que nunca teve boleto — ela **nomeia a cobrança**.
 *
 * ⚠️ **Nomear aqui não contraria a indistinguibilidade da ADR-0008**, e a diferença é qual fato a
 * recusa revela: {@link BoletoService.naoEncontrada} cala porque a cobrança pode ser de outra empresa,
 * e dizer o nome dela transformaria a borda num oráculo de existência sobre dado alheio. Esta recusa
 * só acontece **depois** de a política ter casado a linha — a cobrança é da empresa da sessão, e quem
 * pediu já a lê inteira por `GET /v1/cobrancas/:codigo`. O que se acrescenta é o *porquê* de não haver
 * documento, que é o que a CA-09 exige para a recusa não ser confundida com rota errada.
 */
const MENSAGEM_SEM_BOLETO_EMITIDO = 'não há boleto emitido para a cobrança';

/**
 * A mensagem da entrega que não se completou porque os bytes não puderam ser re-obtidos.
 *
 * Ela é do **produto** e nomeia a cobrança, como as duas irmãs de ato incompleto, e **não** carrega o
 * texto do provedor (RN-15) — aquele viaja só para o journal. Não há `detalhes` a declarar, e a
 * ausência é decisão: as outras duas declaram em que **estado** a cobrança ficou, e aqui nada mudou —
 * o título continua vivo, os campos de conciliação intactos, e uma repetição depois do provedor
 * voltar entrega o documento.
 */
const MENSAGEM_DA_ENTREGA_INCOMPLETA = 'o documento do boleto não pôde ser obtido para a cobrança';

/** O rótulo do estado que a derivação da vigência devolve quando a validade já terminou. */
const VIGENCIA_ENCERRADA = 'VENCIDO';

/**
 * O que a metade transacional entrega ao ato externo — e nada além disso.
 *
 * ⚠️ **O envelope viaja CIFRADO daqui até a decifra** (ADR-0032), que acontece dentro de
 * `@sysloc/shared`, no instante em que o trabalho é montado. Carregar aqui o invólucro **já aberto**
 * estenderia a janela de residência do claro para além do ato — a mesma decisão, e a mesma razão, de
 * `IdentidadeGuardada` em {@link ../integracoes-bancarias/certificado.service.js}.
 *
 * `cobrancaId` é o **UUID interno**, e ele existe aqui porque a trilha o exige: é a chave estrangeira
 * composta que `registrarEventoBancario` guarda. Ele **não** sai por superfície alguma — a chave
 * exposta da cobrança é o `codigo`.
 */
export interface PreparoDoAtoSobreBoleto {
  /** A empresa em nome de quem o ato acontece — lida da sessão, nunca do pedido (ADR-0008/0009). */
  readonly empresaId: string;
  /** A chave exposta da cobrança (ADR-0017). */
  readonly codigo: string;
  /** O UUID interno, que só a trilha consome. */
  readonly cobrancaId: string;
  /** O título vivo; `null` é *nunca emitida, ou já revogada* — e decide se há o que revogar. */
  readonly numeroDoTituloNoProvedor: string | null;
  /** O material do certificado vigente, **cifrado**. */
  readonly envelopeCifrado: string;
  /**
   * A identidade da empresa perante o provedor, **pronta para uso**.
   *
   * Viaja no preparo, e não é lida em cada ato, porque é a mesma pré-condição do envelope acima: as
   * duas são exigidas na abertura da unidade, e uma segunda leitura mais adiante abriria a janela
   * entre elas.
   */
  readonly identidade: IdentidadeParaUso;
}

/**
 * O que a metade transacional da **entrega** apura, e nada além disso.
 *
 * ⚠️ **`numeroDoTituloNoProvedor` é NÃO-ANULÁVEL aqui, e a não-anulabilidade É a autorização.** Quem
 * monta este preparo é {@link BoletoService.prepararEntrega}, que já produziu o `404` da cobrança
 * inalcançável e o da cobrança sem título — de modo que a existência deste objeto significa, pelo
 * tipo, *"há boleto emitido para esta cobrança, segundo o BANCO"*. É o que impede a entrega de
 * decidir pelo disco.
 *
 * O caminho gravado **não** está aqui, e a ausência é conteúdo: o nome do arquivo é derivado do
 * código pela guarda, num ponto só (`packages/cobranca-bancaria/src/guarda-de-boletos.ts`), e
 * carregar a coluna até aqui abriria um segundo caminho para compor o alvo — exatamente o poder que
 * aquele módulo existe para negar.
 */
export interface PreparoDaEntregaDoBoleto {
  /** A empresa em nome de quem a consulta ao provedor acontece — lida da sessão (ADR-0008/0009). */
  readonly empresaId: string;
  /** A chave exposta da cobrança (ADR-0017), de que a guarda deriva o nome do arquivo. */
  readonly codigo: string;
  /** O título **vivo**. Não é anulável: a ausência dele já virou `404` no preparo. */
  readonly numeroDoTituloNoProvedor: string;
}

/**
 * A espera entre duas sondagens — o agendamento do runtime, num lugar só.
 *
 * Ela é constante de módulo, e não parâmetro injetável, porque **não há consumidor** que precise de
 * outra: o efeito dela sobre o ato é medido pelo desfecho, e um ponto de injeção existente só para a
 * verificação seria símbolo de produção a serviço do teste. Quem controla o tempo nos casos é o
 * adaptador — confirmando na primeira pergunta, nenhuma espera acontece.
 */
async function esperar(milissegundos: number): Promise<void> {
  await new Promise<void>((resolver) => {
    // O temporizador é desreferenciado do laço de eventos: uma espera pendente no desligamento
    // gracioso seguraria o processo por até um intervalo inteiro sem nada a fazer.
    setTimeout(resolver, milissegundos).unref();
  });
}

/** O rótulo do motivo quando a falha acessória não traz código nem nome — nunca a mensagem dela. */
const MOTIVO_NAO_IDENTIFICADO = 'NAO_IDENTIFICADO';

/**
 * O que o sistema de arquivos responde quando o alvo não existe — a condição da re-obtenção (CA-08).
 *
 * É a **segunda** declaração deste rótulo no produto: a primeira é privada de
 * `packages/cobranca-bancaria/src/guarda-de-boletos.ts`, onde ela decide o que `apagar` engole por
 * idempotência. As duas descrevem o mesmo fato do sistema operacional e decidem coisas opostas — lá
 * *"não havia o que apagar, e está tudo certo"*, aqui *"o cache sumiu, e é preciso rebuscar"* —, e
 * publicar a de lá para consumir aqui alargaria a superfície do pacote com um detalhe de `fs`. São
 * duas, e o limiar deste repositório é **três**: a terceira paga a promoção para casa compartilhada.
 */
const CODIGO_DE_AUSENCIA_DO_ARQUIVO = 'ENOENT';

/** Verdadeiro quando a falha do sistema de arquivos é *"o alvo não existe"* — sem asserção de tipo. */
function ehArquivoAusente(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === CODIGO_DE_AUSENCIA_DO_ARQUIVO
  );
}

/**
 * O rótulo diagnóstico de uma falha **acessória** — o código dela, e jamais a mensagem.
 *
 * A mensagem do sistema de arquivos carrega o caminho absoluto do alvo (*"EACCES: permission
 * denied, unlink '/var/lib/…/COB-2026-0000001.pdf'"*), e texto de mensagem sobrevive em `mensagem` e
 * em `pilha`, onde a redação do registrador não o alcança — é a mesma disciplina, e a mesma razão,
 * de `ErroDeBoletoForaDaGuarda`, que nomeia o campo e nunca o valor recebido.
 *
 * O que sai é o código do erro (`EACCES`, `EROFS`, `EIO`), que é o que diz a quem opera **o que**
 * aconteceu sem dizer **onde**. Sem código, o nome do tipo; sem nenhum dos dois, a constante — o
 * objeto do erro nunca é espalhado numa linha de registro.
 */
function motivoDaFalhaAcessoria(erro: unknown): string {
  if (typeof erro === 'object' && erro !== null && 'code' in erro) {
    const { code } = erro;

    if (typeof code === 'string') {
      return code;
    }
  }

  return erro instanceof Error ? erro.name : MOTIVO_NAO_IDENTIFICADO;
}

@Injectable()
export class BoletoService {
  constructor(
    // O ambiente **já validado** na partida. É dele que sai a chave que abre o envelope, e ele é a
    // única fonte: um `process.env` lido aqui escaparia da conferência de partida.
    @Inject(TOKEN_AMBIENTE) private readonly ambiente: Ambiente,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
    // A porta chega **por injeção**, e este arquivo não conhece provedor algum (ADR-0025): quem
    // escolhe o adaptador é a composição (`cobrancas.module.ts`), e é ela que sabe de endereço.
    @Inject(TOKEN_PORTA_DE_COBRANCA_BANCARIA)
    private readonly provedor: AdaptadorCobrancaBancaria,
    // A guarda dos bytes, pela mesma razão: o diretório-base é decisão da composição, e este serviço
    // não lê caminho de lugar nenhum.
    @Inject(TOKEN_GUARDA_DE_BOLETOS) private readonly guarda: GuardaDeBoletos,
  ) {}

  /**
   * Lê tudo o que o ato precisa e produz **todas** as recusas que não custam uma ida ao provedor.
   *
   * Ela é a última coisa que corre dentro da unidade de trabalho da borda: quem chama fecha a
   * transação com o que ela devolveu, e só então conversa com o provedor. Nada aqui decifra — o que
   * sai é o envelope como a coluna o guarda.
   *
   * A ordem das três conferências é conteúdo:
   *
   *   1. **a cobrança** — dela sai o `404`, e é o alcance do contexto que decide (ADR-0008). Vir
   *      primeiro é o que impede a rota de dizer *"esta empresa não tem certificado"* sobre uma
   *      cobrança que ela nem alcança, que seria informação sobre o dado alheio;
   *   2. **o estado**, só quando o ato é a emissão — ver {@link ESTADOS_EMITIVEIS} para por que a
   *      revogação não tem lista própria;
   *   3. **o certificado**, do qual saem as duas recusas de configuração da empresa.
   *
   * As duas leituras do certificado correm na **mesma** transação de propósito: pedir a vigência numa
   * e o envelope noutra abriria a janela em que a renovação de outra sessão acontece entre elas.
   */
  async prepararAto(
    tx: TransactionSql,
    empresaId: string,
    codigo: string,
    ato: AtoPedido,
  ): Promise<PreparoDoAtoSobreBoleto> {
    const alvo = await localizarAlvoDoBoleto(tx, codigo);

    if (alvo === undefined) {
      throw this.naoEncontrada();
    }

    if (ato === EMISSAO_DE_BOLETO) {
      this.exigirEstadoQueAdmiteEmissao(this.exigir(await localizarCobranca(tx, codigo)));
    }

    return {
      empresaId,
      codigo: alvo.codigo,
      cobrancaId: alvo.id,
      numeroDoTituloNoProvedor: alvo.numeroDoTituloNoProvedor,
      envelopeCifrado: await this.exigirCertificadoVigente(tx),
      identidade: await this.exigirIdentidadeVigente(tx),
    };
  }

  /**
   * Emite o boleto — **fora de transação alguma** —, ou o reemite quando já existe título vivo.
   *
   * Quem decide se há etapa de revogação é `reemitirBoleto`, e a decisão mora **lá**, num lugar só: uma
   * segunda guarda escrita aqui seria a segunda regra para o mesmo fato, livre para divergir da
   * primeira. Sobre cobrança sem título vivo a sequência que a porta recebe é exatamente `['emitir']`
   * (CA-18).
   *
   * As três portas de escrita abrem **uma unidade cada**, pela abertura que a borda entregou, e é isso
   * que faz a revogação já confirmada permanecer gravada quando a emissão seguinte falha — o desfecho
   * declarado da CA-06, e não um acidente.
   *
   * A leitura final é uma unidade nova, e não a mesma das escritas: o que ela publica são os campos que
   * o ato acabou de gravar, relidos da visão com os derivados no instante da resposta.
   */
  async emitir(
    preparo: PreparoDoAtoSobreBoleto,
    abrirUnidade: AberturaDeUnidade,
  ): Promise<Cobranca> {
    try {
      await reemitirBoleto({
        empresaId: preparo.empresaId,
        identidade: preparo.identidade,
        // A decifra acontece **dentro** da expressão que monta o trabalho, e o claro não ganha nome
        // próprio no escopo: uma variável com o segredo aberto é exatamente o que um registro de
        // diagnóstico futuro acharia à mão, e a ADR-0032 é sobre não haver o que redigir.
        segredo: decifrarSegredo(preparo.envelopeCifrado, this.ambiente.chaveDeCifraDoCertificado),
        cobranca: {
          codigo: preparo.codigo,
          numeroDoTituloNoProvedor: preparo.numeroDoTituloNoProvedor,
        },
        adaptador: this.provedor,
        guarda: this.guarda,
        // Unidade PRÓPRIA, e a razão é a ADR-0020: o avanço do contador **não** participa do
        // desfazimento da unidade que grava, e o número queimado nunca volta.
        identificador: async () =>
          await abrirUnidade(async (tx) => await proximoIdentificadorBancario(tx)),
        // A leitura corre no instante do pedido, e não no preparo: entre um e outro a mora avança, e o
        // valor cobrado tem de ser o que a visão deriva agora (ADR-0022).
        dados: async () =>
          await abrirUnidade(async (tx) => await this.lerDadosDaEmissao(tx, preparo)),
        // UMA unidade, DUAS escritas: apagar os campos sem o evento deixaria a trilha sem o fato que
        // explica por que a cobrança perdeu o boleto.
        gravarRevogacao: async () => {
          await abrirUnidade(async (tx) => {
            await revogarBoleto(tx, preparo.codigo);
            await registrarEventoBancario(tx, {
              cobrancaId: preparo.cobrancaId,
              tipo: 'BOLETO_REVOGADO',
              origem: 'ATO_DO_ADMIN',
            });
          });
        },
        // UMA unidade, DUAS escritas, pela mesma razão: uma linha com os campos de conciliação e sem
        // o evento é um boleto que ninguém sabe de onde veio.
        gravarEmissao: async (boleto) => {
          await abrirUnidade(async (tx) => {
            await gravarBoletoDaCobranca(tx, preparo.codigo, boleto);
            await registrarEventoBancario(tx, {
              cobrancaId: preparo.cobrancaId,
              tipo: 'BOLETO_EMITIDO',
              origem: 'ATO_DO_ADMIN',
            });
          });
        },
        esperar,
        agora: Date.now,
      });
    } catch (erro) {
      await this.traduzirEmissaoIncompleta(erro, preparo, abrirUnidade);
    }

    return await abrirUnidade(async (tx) =>
      this.exigir(await localizarCobranca(tx, preparo.codigo)),
    );
  }

  /**
   * Revoga o boleto vivo — pedido, sondagem da confirmação e **só então** a gravação.
   *
   * A ordem é a mesma da metade de revogação de `reemitirBoleto`, e pela mesma razão: o provedor não
   * revoga na mesma resposta, e apagar os campos antes da confirmação publicaria uma cobrança sem
   * boleto enquanto o título segue pagável — com o agravante de que, sem `nosso_numero`, ela **sai do
   * conjunto da conferência** e o pagamento que chegasse depois ficaria invisível.
   *
   * O fato de negócio vem **antes** do arquivo: a linha perde os campos e só então os bytes são
   * apagados. A ordem inversa deixaria, se a escrita falhasse, uma linha apontando para um arquivo que
   * não existe; o preço da escolhida é um arquivo órfão benigno, cujo nome a emissão seguinte
   * sobrescreve.
   *
   * ⚠️ **E esse preço é do arquivo, nunca da resposta**: a remoção dos bytes corre por
   * {@link BoletoService.semDerrubarODesfecho}, de modo que uma falha dela — montagem somente
   * leitura, NFS, mídia — não derruba um ato que já se completou junto ao provedor e no banco.
   * Antes disso ela escapava como erro não traduzido e virava `500`, sobre uma revogação que valeu,
   * cuja retentativa cairia no `422` de *"esta cobrança não tem boleto a revogar"* — que diz o
   * oposto do que aconteceu.
   */
  async revogar(
    preparo: PreparoDoAtoSobreBoleto,
    abrirUnidade: AberturaDeUnidade,
  ): Promise<Cobranca> {
    const numeroDoTituloVivo = preparo.numeroDoTituloNoProvedor;

    if (numeroDoTituloVivo === null) {
      // A cobrança existe e o ato não se aplica ao estado dela: é `422`, e não `404`. O recurso da
      // rota é a cobrança, e um `404` aqui diria que ela não foi encontrada, o que é falso.
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_BOLETO_A_REVOGAR, {
        campo: CAMPO_DO_CODIGO,
        detalhes: { [DISCRIMINADOR_DO_BOLETO]: SEM_BOLETO },
      });
    }

    // O claro ganha nome próprio aqui, diferente de {@link BoletoService.emitir}, e o vínculo é
    // **inevitável**: o mesmo `ato` atravessa duas chamadas do adaptador separadas pela sondagem, e
    // remontá-lo a cada volta do laço decifraria o segredo a cada sonda em vez de uma vez só.
    // ⚠️ Por isso a disciplina fica escrita, já que a forma não a garante sozinha: **nenhuma linha
    // de registro deste método recebe `ato`**, inteiro ou espalhado. O que viaja para o journal é o
    // número do título e o motivo — ver {@link BoletoService.registrarRecusaDoProvedor} e
    // {@link BoletoService.semDerrubarODesfecho}, que recorta o contexto campo a campo (ADR-0032).
    const ato: AtoSobreBoleto = {
      empresaId: preparo.empresaId,
      segredo: decifrarSegredo(preparo.envelopeCifrado, this.ambiente.chaveDeCifraDoCertificado),
      identidade: preparo.identidade,
      numeroDoTituloNoProvedor: numeroDoTituloVivo,
    };

    const pedido = await this.provedor.solicitarRevogacaoDeBoleto(ato);

    if (!pedido.aceito) {
      throw this.revogacaoIncompleta(preparo.codigo, pedido.motivo);
    }

    if (!(await this.confirmarRevogacao(ato))) {
      // NADA é apagado: o boleto anterior continua sendo o único, e a conferência seguinte apura o
      // desfecho real junto ao provedor — ela ainda alcança a cobrança, porque o título continua lá.
      throw this.revogacaoIncompleta(preparo.codigo, null);
    }

    await abrirUnidade(async (tx) => {
      await revogarBoleto(tx, preparo.codigo);
      await registrarEventoBancario(tx, {
        cobrancaId: preparo.cobrancaId,
        tipo: 'BOLETO_REVOGADO',
        origem: 'ATO_DO_ADMIN',
      });
    });

    // Os bytes são **acessórios** ao fato de negócio, que a unidade acima já commitou: daqui em
    // diante nada mais pode transformar um ato concluído em falha publicada.
    await this.semDerrubarODesfecho(
      async () => await this.guarda.apagar(preparo.codigo),
      preparo,
      'bytes do boleto revogado não puderam ser apagados',
    );

    return await abrirUnidade(async (tx) =>
      this.exigir(await localizarCobranca(tx, preparo.codigo)),
    );
  }

  /**
   * Lê o que a **entrega dos bytes** precisa, e produz as duas recusas que não custam ida alguma.
   *
   * ===========================================================================
   * A AUTORIZAÇÃO SAI DO ESTADO NO BANCO, e JAMAIS da presença do arquivo em disco
   * ===========================================================================
   *
   * ⚠️ **É a decisão mais importante desta rota, e ela mora aqui porque é aqui que a tentação
   * acontece.** A pergunta *"existe boleto a entregar?"* é respondida por `nosso_numero`, lido da
   * tabela sob a política do banco — nunca por *"o arquivo `<codigo>.pdf` está lá?"*, que é a forma
   * curta e a errada.
   *
   * A razão é um estado **real e alcançável**, e não uma hipótese: a revogação apaga a coluna dentro
   * da unidade de trabalho e só depois remove os bytes, por
   * {@link BoletoService.semDerrubarODesfecho} — de modo que uma falha do sistema de arquivos
   * (montagem somente leitura, NFS, mídia) deixa a cobrança **sem título e com o arquivo em disco**.
   * É o órfão benigno que {@link BoletoService.revogar} declara por escrito, e que o `CT-918 (g)`
   * mede. Uma entrega que decidisse pelo disco serviria esse arquivo a quem guardou o endereço — o
   * boleto **revogado** continuaria pagável no mundo pela mão do próprio produto.
   *
   * Decidindo pelo estado, o caminho fecha **de forma**: o disco só é consultado depois de o banco já
   * ter dito que há título vivo, e nenhum arquivo órfão — deste ou de qualquer caminho futuro — é
   * alcançável. Não é confiança no `apagar`, que é justamente o que pode falhar.
   *
   * As duas recusas, e por que são `404` as duas:
   *
   *   1. **a cobrança não é alcançável** — não existe, ou é de outra empresa e a política a esconde:
   *      o `404` do ponto único ({@link BoletoService.naoEncontrada}), com corpo idêntico nas duas
   *      causas (ADR-0008);
   *   2. **a cobrança existe e nunca teve boleto** (CA-09) — `404` também, e não `422`: o recurso
   *      desta rota **é o documento**, e ele de fato não existe. É o inverso da revogação, cujo
   *      recurso é a cobrança e cuja recusa por estado é `422`.
   */
  async prepararEntrega(
    tx: TransactionSql,
    empresaId: string,
    codigo: string,
  ): Promise<PreparoDaEntregaDoBoleto> {
    const boleto = await lerBoletoDaCobranca(tx, codigo);

    if (boleto === undefined) {
      throw this.naoEncontrada();
    }

    const numeroDoTituloVivo = boleto.numeroDoTituloNoProvedor;

    if (numeroDoTituloVivo === null) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        `${MENSAGEM_SEM_BOLETO_EMITIDO} ${codigo}`,
        {
          campo: CAMPO_DO_CODIGO,
          detalhes: { [DISCRIMINADOR_DO_BOLETO]: NUNCA_EMITIDO },
        },
      );
    }

    return { empresaId, codigo, numeroDoTituloNoProvedor: numeroDoTituloVivo };
  }

  /**
   * Entrega os bytes do boleto — **fora da unidade de trabalho** —, rebuscando-os quando sumiram.
   *
   * O caminho comum é uma leitura de arquivo e nada mais. Quando ela responde *"o alvo não existe"*, a
   * CA-08 manda rebuscar do provedor e entregar **sem que quem pediu perceba diferença**: o arquivo é
   * cache recuperável, e a perda dele não é desfecho de negócio.
   *
   * ⚠️ **Só a ausência leva à rebusca**, e a distinção é conteúdo: qualquer outra falha do sistema de
   * arquivos — permissão, entrada e saída, o alvo virou diretório — **atravessa intacta**. Tratá-las
   * em bloco mandaria uma consulta ao provedor a cada erro de infraestrutura do host, e esconderia
   * atrás de um `200` o defeito de instalação que o verificador de infraestrutura existe para pegar.
   *
   * ⚠️ **Nada aqui grava evento na trilha, e a ausência é a ADR-0034 lida ao pé da letra**: rebuscar o
   * cache não é **efeito** — o título é o mesmo, a linha digitável é a mesma, o estado da cobrança é o
   * mesmo. Registrá-la encheria a trilha que a operação lê para responder *"por que esta cobrança está
   * assim"* com linhas sobre nada ter acontecido.
   *
   * Ela corre **fora de transação alguma**, pela razão do cabeçalho deste arquivo: é conversa de rede
   * com terceiro, e mantê-la dentro de `sql.begin` reservaria uma conexão física da reserva que atende
   * o produto inteiro durante a espera. A **única** ida ao banco do caminho de rebusca — a leitura do
   * certificado — abre unidade própria pela abertura que a borda entregou.
   */
  async entregar(
    preparo: PreparoDaEntregaDoBoleto,
    abrirUnidade: AberturaDeUnidade,
  ): Promise<Uint8Array> {
    try {
      return await this.guarda.ler(preparo.codigo);
    } catch (erro) {
      if (!ehArquivoAusente(erro)) {
        throw erro;
      }
    }

    return await this.rebuscarDoProvedor(preparo, abrirUnidade);
  }

  /**
   * Pede ao provedor o documento que sumiu do disco, regrava o cache e devolve os bytes (CA-08).
   *
   * A leitura do certificado acontece **aqui**, e não no preparo, e a posição é decisão: no caminho
   * comum — o arquivo está lá — ela nunca corre, de modo que a entrega **não** exige identidade
   * vigente para servir um boleto já emitido. Uma empresa cujo certificado venceu continua entregando
   * os documentos que tem; só a rebusca, que é conversa com o provedor, precisa de identidade que ele
   * aceite. Quando ela falta, a recusa é a **mesma** que a emissão publica, pelo mesmo fato —
   * traduzi-la aqui em indisponibilidade esconderia do Admin que o que falta é renovar o certificado.
   *
   * ⚠️ **A falha da rebusca NÃO é engolida, e a assimetria com
   * {@link BoletoService.semDerrubarODesfecho} é o ponto**: aquilo é para o efeito **acessório**, o
   * que acontece depois de o desfecho já estar decidido. Aqui os bytes **são** o desfecho — engoli-la
   * responderia `200` com corpo vazio, que é exatamente o *"documento em branco"* que a RN-05 proíbe.
   * O que é acessório é a **regravação** do cache, e é só ela que passa por lá: obtidos os bytes, um
   * disco que recuse a escrita não pode impedir a entrega — o preço é a próxima leitura rebuscar de
   * novo, e a alternativa seria negar o documento por causa do cache.
   */
  private async rebuscarDoProvedor(
    preparo: PreparoDaEntregaDoBoleto,
    abrirUnidade: AberturaDeUnidade,
  ): Promise<Uint8Array> {
    // As duas pré-condições são exigidas na MESMA unidade — lê-las em unidades distintas abriria a
    // janela em que uma existe e a outra já não.
    const { envelopeCifrado, identidade } = await abrirUnidade(async (tx) => ({
      envelopeCifrado: await this.exigirCertificadoVigente(tx),
      identidade: await this.exigirIdentidadeVigente(tx),
    }));

    const consultada = await this.provedor.consultarSituacao({
      empresaId: preparo.empresaId,
      identidade,
      // A decifra acontece **dentro** da expressão que monta a consulta, e o claro não ganha nome
      // próprio no escopo — a mesma disciplina, e a mesma razão, de {@link BoletoService.emitir}.
      segredo: decifrarSegredo(envelopeCifrado, this.ambiente.chaveDeCifraDoCertificado),
      numeroDoTituloNoProvedor: preparo.numeroDoTituloNoProvedor,
      // `true` porque é justamente o documento que falta. O sinalizador é obrigatório na porta, e a
      // consulta da conferência passa `false` — é ele que evita uma quinta operação só para isto.
      incluirDocumento: true,
    });

    // Os dois desfechos sem bytes chegam ao mesmo lugar, e a fusão é deliberada: o provedor recusou a
    // pergunta, ou aceitou e não mandou documento. Nos dois não há o que entregar, e quem pediu não
    // age de forma diferente diante de um ou de outro — o que os separa viaja para o journal.
    if (!consultada.aceito) {
      throw this.entregaIncompleta(preparo.codigo, consultada.motivo);
    }

    const { documento } = consultada.valor;

    if (documento === null) {
      throw this.entregaIncompleta(preparo.codigo, null);
    }

    await this.semDerrubarODesfecho(
      async () => {
        await this.guarda.gravar(preparo.codigo, documento);
      },
      preparo,
      'bytes do boleto rebuscado não puderam ser regravados na guarda',
    );

    return documento;
  }

  /**
   * Publica o **histórico bancário** de uma cobrança, na ordem em que os efeitos ocorreram (CA-13).
   *
   * ===========================================================================
   * A existência da cobrança é conferida ANTES da trilha, e é dela que sai o `404`
   * ===========================================================================
   *
   * `lerTrilhaDaCobranca` devolve **lista vazia** para três estados que não se parecem: a cobrança de
   * outra empresa, que a política esconde; a inexistente; e a que existe e ainda não teve efeito
   * bancário nenhum. As duas primeiras são `404` — com o corpo do ponto único, indistinguíveis entre
   * si (ADR-0008, CA-14) —, e a terceira é `200` com `itens: []`. Sem a leitura da cobrança, as três
   * responderiam igual, e o produto diria *"não existe"* sobre uma cobrança que existe, ou publicaria
   * lista vazia sobre uma cobrança alheia.
   *
   * A conferência usa {@link localizarAlvoDoBoleto}, e não a projeção publicada: as duas passam pela
   * mesma política, e esta lê **três colunas da tabela** enquanto aquela paga as junções laterais da
   * visão derivada para publicar mora e estado, que esta rota não usa.
   *
   * ===========================================================================
   * A ORDEM É INVERTIDA AQUI, e a porta de dados NÃO é tocada
   * ===========================================================================
   *
   * A CA-13 pede *"na ordem em que aconteceram"* — crescente. A porta lê `ocorrido_em DESC, id DESC`,
   * que é a ordem de **exibição** declarada no cabeçalho da tabela e a do índice
   * `evento_bancario_trilha_idx`, com a medição do plano registrada no docblock dela. Mudar a porta
   * para servir esta rota desfaria uma decisão medida de outra task e mudaria a ordem para todo
   * consumidor dela, inclusive as suítes que a leem.
   *
   * ===========================================================================
   * O envelope de retorno vem do PACOTE, e não é declarado aqui
   * ===========================================================================
   *
   * `TrilhaDaCobranca` é `z.infer<typeof esquemaDaTrilhaDaCobranca>`, de `@syslocbr/contracts`. Ele já
   * foi uma `interface` deste arquivo, e a forma do corpo passou a existir em **duas** declarações
   * desligadas — esta e o `z.object` que alimenta o OpenAPI na borda —, contra a ADR-0016. Não
   * redeclare a forma aqui: o esquema do pacote é a única origem das duas pontas, e é o que o
   * frontend importa.
   *
   * A inversão é `reverse()`, e **não** uma reordenação por chave: reverter uma lista já totalmente
   * ordenada por `(ocorrido_em DESC, id DESC)` produz exatamente `(ocorrido_em ASC, id ASC)`,
   * preservando o desempate que o banco decidiu. Reordenar por `ocorridoEm` aqui seria a segunda
   * regra de ordenação — e ela não teria como desempatar, porque o `id` não é publicado.
   */
  async historico(tx: TransactionSql, codigo: string): Promise<TrilhaDaCobranca> {
    if ((await localizarAlvoDoBoleto(tx, codigo)) === undefined) {
      throw this.naoEncontrada();
    }

    const trilha = await lerTrilhaDaCobranca(tx, codigo);

    return { itens: [...trilha].reverse() };
  }

  /**
   * A recusa da entrega cujos bytes não puderam ser re-obtidos — `503`, e o motivo só no journal.
   *
   * `503` e não `500`: o que falhou é o **terceiro**, e a condição é transitória — repetir depois de o
   * provedor voltar entrega o documento. Nada mudou no banco, e por isso não há `detalhes` declarando
   * estado: o título continua vivo e a cobrança continua exatamente como estava.
   */
  private entregaIncompleta(codigo: string, motivo: string | null): ErroDeAplicacao {
    this.logger.warn(
      { entidade: ENTIDADE_DA_TRILHA, codigo, motivo },
      'documento do boleto não pôde ser re-obtido do provedor',
    );

    return new ErroDeAplicacao(
      CodigoErro.SERVICO_INDISPONIVEL,
      `${MENSAGEM_DA_ENTREGA_INCOMPLETA} ${codigo}`,
    );
  }

  /**
   * Pergunta ao provedor se a revogação se concretizou, até confirmar ou até o teto.
   *
   * A primeira pergunta acontece **imediatamente**, e a espera fica **entre** duas: uma espera antes da
   * primeira gastaria um intervalo inteiro num provedor que já tivesse refletido. O desfecho **não
   * aceito** interrompe em vez de insistir — o adaptador o classificou como falha da cobrança ou da
   * empresa, e nenhuma das duas melhora repetindo dentro de doze segundos.
   *
   * O teto é conferido **depois** da pergunta e **antes** da espera: uma confirmação que chegasse na
   * última pergunta possível ainda é vista, e nenhuma espera acontece para além do limite.
   */
  private async confirmarRevogacao(ato: AtoSobreBoleto): Promise<boolean> {
    const limite = Date.now() + TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS;

    for (;;) {
      const desfecho = await this.provedor.confirmarRevogacaoDeBoleto(ato);

      if (!desfecho.aceito) {
        this.registrarRecusaDoProvedor(ato.numeroDoTituloNoProvedor, desfecho.motivo);

        return false;
      }

      // `false` é a resposta "ainda não", e é o que esta sondagem existe para esperar.
      if (desfecho.valor) {
        return true;
      }

      if (Date.now() >= limite) {
        return false;
      }

      await esperar(INTERVALO_ENTRE_SONDAS_MS);
    }
  }

  /**
   * Corre um efeito **acessório** — o que acontece depois de o fato de negócio já estar commitado —
   * sem deixar que a falha dele determine o desfecho publicado.
   *
   * É **forma**, e não um `try/catch` no ponto, porque a classe tem dois ocupantes nesta borda e o
   * mesmo desfecho errado: apagar os bytes do boleto revogado ({@link BoletoService.revogar}) e
   * registrar a recusa na trilha ({@link BoletoService.traduzirEmissaoIncompleta}). Nos dois, a
   * falha escapava como erro não traduzido e o filtro global a publicava como `ERRO_INTERNO`/`500`
   * — sobre um ato **cujo desfecho já estava decidido e gravado**. Quem opera recebia *"erro
   * interno"* sobre o que se completou, retentava, e recebia uma segunda resposta que o contradizia.
   * Um terceiro efeito acessório futuro entra aqui em vez de repetir o defeito.
   *
   * O que se engole é **só** a falha do acessório, e ela não some: vai para o journal, com o código
   * dela. O que não se engole é falha alguma anterior ao commit — quem chama aqui já tem o fato de
   * negócio gravado, e é isso que torna a resposta verdadeira em vez de otimista.
   *
   * ⚠️ **Nada do preparo entra na linha além do que ela nomeia**: o contexto é lido campo a campo,
   * o objeto do erro nunca é espalhado, e o motivo é o código da falha (ADR-0032) — nunca a
   * mensagem do sistema operacional, que carrega o caminho absoluto do arquivo.
   */
  private async semDerrubarODesfecho(
    efeito: () => Promise<void>,
    contexto: { readonly empresaId: string; readonly codigo: string },
    mensagem: string,
  ): Promise<void> {
    try {
      await efeito();
    } catch (erro) {
      this.logger.warn(
        {
          empresaId: contexto.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: contexto.codigo,
          motivo: motivoDaFalhaAcessoria(erro),
        },
        mensagem,
      );
    }
  }

  /**
   * Lê da cobrança o que o pedido de emissão precisa — o valor devido, o vencimento e quem paga.
   *
   * `valorTotal` é o total **derivado pela visão** (ADR-0022) — o original mais a mora vigente —, e é
   * ele que se cobra: nada aqui calcula, e a derivação é do banco. É a mesma escolha, com a mesma
   * razão, que o percurso do lote faz.
   *
   * O locatário sai do cadastro pelo identificador que a própria cobrança publica, e a projeção é
   * montada campo a campo: espalhar o cadastro inteiro mandaria ao provedor tudo o que o cadastro
   * venha a ganhar — inclusive dado que ele não precisa ver.
   */
  private async lerDadosDaEmissao(
    tx: TransactionSql,
    preparo: PreparoDoAtoSobreBoleto,
  ): Promise<{
    readonly valor: number;
    readonly vencimento: string;
    readonly locatario: {
      readonly nome: string;
      readonly documento: string;
      readonly logradouro: string;
      readonly numero: string;
      readonly complemento: string | null;
      readonly bairro: string;
      readonly cidade: string;
      readonly estado: string;
      readonly cep: string;
    };
  }> {
    const cobranca = this.exigir(await localizarCobranca(tx, preparo.codigo));
    const locatario = await localizarPessoa(tx, 'locatario', cobranca.locatarioId);

    if (locatario === undefined) {
      // Estado que a chave estrangeira composta torna irrepresentável — cobrança aponta para contrato,
      // e contrato para locatário, os dois na mesma empresa. O ramo existe porque a leitura é
      // anulável, e um `!` aqui mandaria `undefined` ao provedor dentro do pedido.
      throw new ErroDeAplicacao(
        CodigoErro.ERRO_INTERNO,
        'a cobrança a emitir não alcançou o cadastro do locatário',
      );
    }

    return {
      valor: cobranca.valorTotal,
      vencimento: cobranca.dataVencimento,
      locatario: {
        nome: locatario.nome,
        documento: locatario.documentoPrincipal,
        logradouro: locatario.logradouro,
        numero: locatario.numero,
        complemento: locatario.complemento,
        bairro: locatario.bairro,
        cidade: locatario.cidade,
        estado: locatario.estado,
        cep: locatario.cep,
      },
    };
  }

  /**
   * Traduz o ato de emissão que não se completou — a trilha primeiro, a resposta depois.
   *
   * O evento `EMISSAO_RECUSADA` é gravado **apenas** quando a emissão de fato não saiu, que é o que os
   * dois desfechos com `boleto: 'SEM_BOLETO'` declaram. O terceiro — revogação pedida e não confirmada
   * — não mudou estado nenhum, e a ADR-0034 mantém a tentativa fora da trilha publicada: o que ela
   * produz é a linha de diagnóstico logo abaixo.
   *
   * O `motivo` do provedor viaja **intacto** para o `diagnostico` e para o journal (RN-15), e **não**
   * entra no corpo: o que sai para quem pediu é a mensagem do produto mais o `detalhes` que declara em
   * que estado a cobrança ficou.
   *
   * Toda outra falha atravessa intacta. Traduzir em bloco atribuiria ao provedor uma recusa que ele
   * não deu — um erro de banco ou de disco viraria `503` dizendo que a cobrança ficou sem boleto.
   *
   * ⚠️ **A gravação da trilha é acessória ao desfecho**, e corre por
   * {@link BoletoService.semDerrubarODesfecho}: o estado que o `detalhes` declara é o que as
   * unidades de `reemitirBoleto` já commitaram, e ele não deixa de ser verdade porque a linha da
   * trilha não entrou. Deixá-la propagar mascarava o `ErroDeReemissaoIncompleta` original e trocava
   * o `503` com o `detalhes` que a CA-06 exige por um `500` que não diz nada a quem opera — e a
   * falha do banco continua visível, no journal, em vez de descrita errado na resposta.
   */
  private async traduzirEmissaoIncompleta(
    erro: unknown,
    preparo: PreparoDoAtoSobreBoleto,
    abrirUnidade: AberturaDeUnidade,
  ): Promise<never> {
    if (!(erro instanceof ErroDeReemissaoIncompleta)) {
      throw erro;
    }

    const { detalhes, motivo } = erro;

    if (DISCRIMINADOR_DO_BOLETO in detalhes) {
      await this.semDerrubarODesfecho(
        async () => {
          await abrirUnidade(async (tx) => {
            await registrarEventoBancario(tx, {
              cobrancaId: preparo.cobrancaId,
              tipo: 'EMISSAO_RECUSADA',
              origem: 'ATO_DO_ADMIN',
              diagnostico: motivo,
            });
          });
        },
        preparo,
        'trilha não registrou a recusa da emissão do boleto',
      );
    }

    this.logger.warn(
      {
        empresaId: preparo.empresaId,
        entidade: ENTIDADE_DA_TRILHA,
        codigo: preparo.codigo,
        motivo,
      },
      'emissão de boleto não completada',
    );

    throw new ErroDeAplicacao(
      CodigoErro.SERVICO_INDISPONIVEL,
      `${MENSAGEM_DA_EMISSAO_INCOMPLETA} ${preparo.codigo}`,
      { detalhes },
    );
  }

  /**
   * A recusa da revogação que não se completou — `503` com o estado em que a cobrança ficou.
   *
   * O estado é sempre o mesmo, e é literalmente verdadeiro nos dois caminhos que levam aqui: o pedido
   * foi feito e a confirmação não veio — porque o provedor recusou a pergunta, ou porque o teto
   * chegou. Nada foi apagado, e é isso que `PEDIDA_NAO_CONFIRMADA` diz a quem opera.
   */
  private revogacaoIncompleta(codigo: string, motivo: string | null): ErroDeAplicacao {
    this.logger.warn(
      { entidade: ENTIDADE_DA_TRILHA, codigo, motivo },
      'revogação de boleto não confirmada',
    );

    return new ErroDeAplicacao(
      CodigoErro.SERVICO_INDISPONIVEL,
      `${MENSAGEM_DA_REVOGACAO_INCOMPLETA} ${codigo}`,
      { detalhes: { [DISCRIMINADOR_DA_REVOGACAO]: REVOGACAO_NAO_CONFIRMADA } },
    );
  }

  /**
   * Recusa a empresa sem certificado vigente, e a que tem um já vencido (§10.1).
   *
   * As duas recusas são **distintas de propósito**: na primeira falta configuração, e na segunda ela
   * existe e envelheceu — mandar o Admin registrar um certificado que ele já registrou o faria
   * procurar defeito onde há renovação pendente. As mensagens são as **mesmas** que a superfície do
   * certificado já publica, pelo mesmo fato.
   *
   * O estado da vigência **não é derivado aqui**: ele vem de `derivarEstadoDaVigencia`, a função pura
   * que a superfície do certificado publica, alimentada pelo par de datas que o **banco** resolveu
   * (ADR-0026). Uma comparação de datas escrita neste arquivo seria a segunda avaliação do mesmo fato,
   * e as duas divergiriam na virada do dia em torno do fuso.
   */
  private async exigirCertificadoVigente(tx: TransactionSql): Promise<string> {
    const vigente = await lerCertificadoVigente(tx);

    if (vigente === undefined) {
      // **Sem `campo`**, e a ausência é decisão: as duas recusas desta função não têm culpado no
      // pedido — o corpo é vazio e o código no caminho está correto. Nomear `codigo` mandaria o
      // Admin conferir a cobrança quando o que falta é configuração da empresa.
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_CERTIFICADO, {
        detalhes: { [DISCRIMINADOR_DO_CERTIFICADO]: CERTIFICADO_AUSENTE },
      });
    }

    const observada = await lerVigenciaObservada(tx, vigente.validoAte);

    if (
      derivarEstadoDaVigencia(observada.fimDaValidade, observada.dataCorrente).estado ===
      VIGENCIA_ENCERRADA
    ) {
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_DO_CERTIFICADO_VENCIDO, {
        detalhes: { [DISCRIMINADOR_DA_VALIDADE]: vigente.validoAte.toISOString() },
      });
    }

    const envelopeCifrado = await obterEnvelopeCifradoDoVigente(tx);

    if (envelopeCifrado === undefined) {
      // Estado que a `CHECK` da RN-13 torna irrepresentável — vigente sem segredo não existe no banco.
      // A recusa é a **mesma** da ausência, e não um `500`: um erro de servidor aqui diria ao cliente
      // que existe uma linha em estado esquisito, que é informação sobre o dado guardado.
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_CERTIFICADO, {
        detalhes: { [DISCRIMINADOR_DO_CERTIFICADO]: CERTIFICADO_AUSENTE },
      });
    }

    return envelopeCifrado;
  }

  /**
   * A identidade vigente da empresa, **pronta para uso** — ou a recusa que diz o que falta.
   *
   * Espelha {@link exigirCertificadoVigente} porque a pré-condição é da mesma natureza: sem ela o
   * provedor recusa a concessão, e o ato falharia mais adiante com mensagem do provedor em vez da
   * do produto. Recusar aqui é o que faz o Admin saber **qual** configuração falta.
   */
  private async exigirIdentidadeVigente(tx: TransactionSql): Promise<IdentidadeParaUso> {
    const identidade = await lerIdentidadeParaUso(tx, this.ambiente.chaveDeCifraDoCertificado);

    if (identidade === undefined) {
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_IDENTIDADE, {
        detalhes: { [DISCRIMINADOR_DA_IDENTIDADE]: IDENTIDADE_AUSENTE },
      });
    }

    return identidade;
  }

  /**
   * Recusa a emissão sobre cobrança que não está em aberto — a guarda de estado deste ato.
   *
   * A forma da recusa é a **mesma** das duas transições de {@link ./cobranca.service.js} — `422`
   * nomeando `codigo`, com `detalhes: { estadoAtual, transicaoPedida }` —, e a coincidência é
   * deliberada: as três recusas descrevem o mesmo fato, *o recurso está num estado que não admite o ato
   * pedido*, e um terceiro vocabulário faria o cliente aprender dois. É a segunda escrita desta forma
   * nesta superfície, e o limiar deste repositório é três.
   *
   * Ela é **leitura-antes-de-gravar**, e por isso não é defesa de integridade: entre a leitura e a
   * emissão cabe outra transação. O que ela compra é a **forma** da recusa — e o que impede de fato o
   * segundo título é o `WHERE nosso_numero IS NULL` de `gravarBoletoDaCobranca`.
   */
  private exigirEstadoQueAdmiteEmissao(cobranca: Cobranca): void {
    if (ESTADOS_EMITIVEIS.includes(cobranca.status)) {
      return;
    }

    throw new ErroDeAplicacao(
      CodigoErro.CAMPO_INVALIDO,
      MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
      {
        campo: CAMPO_DO_CODIGO,
        detalhes: { estadoAtual: cobranca.status, transicaoPedida: EMISSAO_DE_BOLETO },
      },
    );
  }

  /** Registra a recusa do provedor no journal — o texto dele **nunca** sai na resposta (RN-15). */
  private registrarRecusaDoProvedor(numeroDoTitulo: string, motivo: string): void {
    this.logger.warn(
      { entidade: ENTIDADE_DA_TRILHA, numeroDoTitulo, motivo },
      'provedor recusou a pergunta pela confirmação da revogação',
    );
  }

  /**
   * Traduz a ausência no `404` canônico — **ponto único** da recusa por cobrança inalcançável.
   *
   * As duas causas são deliberadamente **indistinguíveis**: a cobrança não existe, ou existe e é de
   * outra empresa. Um corpo diferente para cada uma faria da borda um oráculo de existência sobre o
   * dado alheio, que é justamente o que a política do banco esconde (ADR-0008).
   */
  private exigir(linha: LinhaDeCobranca | undefined): Cobranca {
    if (linha === undefined) {
      throw this.naoEncontrada();
    }

    return linha;
  }

  /** O `404` desta superfície, escrito uma vez — o corpo é idêntico nas duas causas. */
  private naoEncontrada(): ErroDeAplicacao {
    return new ErroDeAplicacao(
      CodigoErro.RECURSO_NAO_ENCONTRADO,
      MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      { campo: CAMPO_DO_CODIGO },
    );
  }
}
