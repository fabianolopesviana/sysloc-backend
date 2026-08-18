/**
 * A **reemissão de boleto** — revogar, sondar a confirmação, e só então emitir.
 *
 * ===========================================================================
 * A forma óbvia é a ERRADA, e esta é a razão registrada por escrito
 * ===========================================================================
 *
 * A forma que um leitor deste arquivo esperaria — pedir a revogação e emitir o novo em seguida — foi
 * **considerada e rejeitada** (alternativa C1 do D3 do tech-alignment). O provedor não revoga na
 * mesma resposta, e durante a janela em que ele *"ainda não refletiu"* **os dois boletos ficam
 * pagáveis**. A janela não é hipótese: o sistema antigo a documenta como desfecho normal e a trata
 * como sucesso com confirmação negativa. Preservar o invariante *"em nenhum instante existem dois
 * boletos pagáveis"* — a métrica de sucesso nº 1 do PRD — custa sondar antes de prosseguir.
 *
 * A terceira alternativa (C3), persistir um estado intermediário de *"revogação pendente"* com
 * retomada posterior, foi rejeitada por contrariar a **ADR-0022**: ela gravaria marca de processo
 * onde o produto deriva estado dos fatos, e criaria um estado que a operação precisaria aprender a
 * interpretar.
 *
 * ⚠️ **Isto é um candidato PARCIAL a ADR — 4 dos 5 critérios** (tech spec §21.3): *"o ato composto
 * contra terceiro assíncrono sonda a confirmação antes de prosseguir"*. O que falha é o **C3**
 * (custo de reversão): hoje reverter é trocar o corpo de uma função, sem refactor em vários lugares.
 * O registro mora aqui, e não só na spec, porque é aqui que a tentação acontece — e porque **se a
 * fatia (iii) repetir a forma para a notificação recebida, o C3 muda de resposta** e o candidato
 * deve ser reavaliado. Sem esta prosa, aquela fatia decidiria do zero sem saber que houve decisão.
 *
 * ===========================================================================
 * O que este arquivo NÃO faz, e cada ausência é o mecanismo
 * ===========================================================================
 *
 * Ele não abre transação, não escreve SQL, não conhece o provedor, **não lê relógio e não chama
 * `setTimeout`**. Tudo o que toca fronteira chega **por parâmetro** (ADR-0025): o adaptador, a guarda
 * de bytes, as quatro portas de dados e — o que é próprio deste ato — a **espera** e o **relógio**.
 *
 * A injeção do tempo não é ponto de extensão criado para o teste: é a fronteira que esta fatia
 * declara legítima, no molde de `ConfiguracaoDoProvedorBancario.agora` (fatia (i)). Sem ela, a
 * verificação da ordem de composição dormiria três intervalos reais a cada execução, e a alternativa
 * idiomática — o relógio falso instalado no runtime — está **fora da stack de teste deste projeto**:
 * ela alcança tudo o que o processo agenda, inclusive o teto do próprio ato.
 *
 * ⚠️ **A espera e o relógio são OBRIGATÓRIOS na assinatura, e não opcionais com padrão do runtime.**
 * A assimetria com o adaptador da fatia (i) é deliberada: lá o tempo decide **uma** validade de
 * cache; aqui ele decide **quando o segundo boleto pode nascer**, e um padrão silencioso poria
 * `Date.now` dentro do domínio — que é exatamente o que a §3.3.4 da task proíbe.
 *
 * ⚠️ **Os LIMITES, ao contrário do tempo, NÃO são injetáveis — e isto é divergência declarada.** A
 * §3.1 da task os descreve como *"os valores padrão da composição raiz"*, o que sugeriria dois campos
 * opcionais no trabalho. Medido: **não há consumidor** para eles — nem aqui, nem na borda da T13, que
 * monta o trabalho e não escolhe teto —, e campo opcional sem consumidor é capacidade para um futuro
 * hipotético. O que a verificação precisa para não dormir é o **tempo**, que é injetado; o efeito dos
 * dois limites fica medido pela contagem exata de sondagens até o teto, de modo que alterar qualquer
 * um deles reprova — garantia mais forte do que a que "ser sobreponível" daria. O dia em que alguém
 * precisar de outro teto, ele entra **com o consumidor junto**.
 *
 * ===========================================================================
 * A ORDEM DAS ESCRITAS é o que torna a CA-06 um desfecho, e não um acidente
 * ===========================================================================
 *
 * A revogação é gravada **assim que confirmada**, antes de emitir. Consequência direta: se a emissão
 * falhar depois disso, a cobrança já está **sem boleto** e com o evento `BOLETO_REVOGADO` na trilha —
 * que é literalmente o desfecho que a CA-06 declara, sem nenhum caminho de compensação. Não há
 * compensação a escrever: a revogação já confirmada junto ao provedor **não se desfaz**, e é por isso
 * que este ato não é modelado como saga (tech spec §9.3).
 *
 * ⚠️ **A cobrança que ficou sem boleto é recolhida pelo LOTE seguinte, nunca pela conferência.** A
 * conferência seleciona apenas cobranças **com** boleto, e uma sem título está fora do conjunto por
 * construção; o predicado do lote é exatamente *"em aberto e sem boleto"*. O D3 do tech-alignment
 * escreve *"conferência"* e foi **corrigido pela nota da §5.2 da tech spec** — o desfecho prático que
 * ele descreve continua verdadeiro, o mecanismo é outro, e escrevê-lo errado faria a correção ser
 * procurada no lugar errado.
 *
 * Dentro da revogação, o **fato de negócio vem antes do arquivo**: a linha perde os campos e só então
 * os bytes são apagados. A ordem inversa deixaria, se a escrita falhasse, uma linha apontando para um
 * arquivo que não existe — que é o defeito que a CA-08 tem de rebuscar do provedor. Aqui o preço da
 * ordem escolhida é um arquivo órfão, **benigno**: o nome é derivado do código da cobrança, de modo
 * que a emissão seguinte o sobrescreve em vez de acumular.
 *
 * ===========================================================================
 * A SONDAGEM não gera evento — e isso é a ADR-0034, não economia
 * ===========================================================================
 *
 * Nenhuma das sondagens registra coisa alguma na trilha, e a ausência é a decisão: a ADR-0034 fixa
 * que a trilha publicada registra **efeito** — mudança de estado ou desfecho anômalo —, nunca a
 * tentativa que nada mudou. Quem grava evento neste ato são as duas portas de escrita, e elas são
 * chamadas exatamente onde houve efeito: a revogação confirmada e a emissão aceita. Uma sondagem que
 * gravasse encheria a trilha que a operação lê para responder *"por que esta cobrança está assim"*.
 *
 * ===========================================================================
 * SEM BOLETO VIVO, não há etapa de revogação (CA-18)
 * ===========================================================================
 *
 * `numeroDoTituloNoProvedor` nulo significa *"nunca emitida, ou já revogada"*, e nesse caso a
 * sequência de operações que a porta recebe é **exatamente `['emitir']`** — emitir de novo depois de
 * uma revogação acontece como a primeira vez. A decisão mora **aqui**, e não em quem chama, para que
 * exista um lugar só onde se decide se há boleto a revogar: uma segunda guarda na borda seria a
 * segunda regra para o mesmo fato, livre para divergir da primeira.
 *
 * ===========================================================================
 * Por que o desfecho da porta INTERROMPE a sondagem em vez de insistir
 * ===========================================================================
 *
 * `confirmarRevogacaoDeBoleto` devolvendo `false` é a resposta *"ainda não"*, e é ela que a sondagem
 * espera receber até o teto. Já um desfecho **não aceito** é outra coisa: o adaptador o classificou
 * como falha da cobrança ou da empresa, e **nenhuma das duas melhora repetindo dentro de doze
 * segundos** — insistir gastaria o teto do ato composto para chegar ao mesmo lugar, com o boleto
 * anterior imobilizado por mais tempo. O ato falha declarando que a revogação foi pedida e não
 * confirmada, que é literalmente verdadeiro nos dois casos, e o texto do provedor viaja intacto
 * (RN-15) como diagnóstico — **nada aqui o interpreta para decidir**.
 */

import type { SegredoOperavel } from '@sysloc/shared';
// O relógio tem **uma** declaração neste pacote, e ela mora onde o primeiro consumidor a criou. Uma
// segunda `() => number` batizada aqui seria a forma exata do débito D14 da fase anterior: dois
// fatos executáveis dizendo a mesma coisa, livres para divergir sem que nada acuse.
import type { FonteDeTempo } from './credencial-de-acesso.js';
// Os três tipos abaixo são vocabulário da **emissão**, e não do lote — a casa deles é aquele arquivo
// porque foi ali que nasceram, com o primeiro consumidor. Este é o **segundo**, e o `CLAUDE.md`
// declara o limiar em **três**: com duas cópias, endurecer uma deixa a outra para trás; com três,
// elas já divergiram. Importar é o que mantém uma declaração só até o limiar disparar.
import type {
  BoletoParaConciliar,
  DadosDaCobrancaAEmitir,
  PortaDoIdentificador,
} from './emissao-em-lote.js';
import type { GuardaDeBoletos } from './guarda-de-boletos.js';
import type { AtoSobreBoleto } from './modelo-canonico.js';
import type { AdaptadorCobrancaBancaria } from './porta-de-cobranca.js';

// ---------------------------------------------------------------------------
// Os limites do ato — constantes nomeadas, nunca número no meio do corpo
// ---------------------------------------------------------------------------

/**
 * Quanto se espera entre duas perguntas ao provedor sobre a mesma revogação.
 *
 * Ele é o único dos três limites que a tech spec **não** fixa (§8 declara os outros dois), e o valor
 * sai da razão entre eles: com o teto de {@link TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS}, cabem **oito**
 * perguntas na janela. Menos intervalo transformaria a espera normal do provedor numa rajada de
 * chamadas contra a mesma identidade; mais intervalo deixaria a janela com duas ou três perguntas, e
 * a confirmação que chegasse logo depois da primeira esperaria metade do teto para ser vista.
 *
 * Publicado pelo barril pela mesma razão de `TETO_DO_APERTO_DE_MAO_MS` na fatia (i): limite privado
 * obriga quem verifica a **reescrever o número**, e a asserção passa a medir o teste em vez do
 * artefato.
 */
export const INTERVALO_ENTRE_SONDAS_MS = 1_500;

/**
 * Por quanto tempo a confirmação da revogação é esperada — tech spec §8.
 *
 * Vencido o teto **nada é apagado**: o boleto anterior continua sendo o único, e a conferência
 * seguinte apura junto ao provedor o desfecho real do pedido. É a metade do desenho que preserva o
 * invariante — não emitir é sempre preferível a emitir sobre uma revogação incerta.
 */
export const TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS = 12_000;

/**
 * O teto **duro** do ato composto inteiro — tech spec §8, §3.3.3 da task.
 *
 * Ele não é a soma dos outros dois: é o limite acima do qual o ato deixa de fazer sentido para quem
 * está esperando a resposta na borda. Ele **não é publicado** e **não é configurável**: nenhum
 * consumidor precisa nomeá-lo, e um teto do ato escolhido por quem chama seria a segunda regra para
 * o mesmo fato. É a régua pela qual `TETO_DA_OPERACAO_MS` também ficou privado no adaptador.
 */
const TETO_DA_REEMISSAO_MS = 30_000;

// ---------------------------------------------------------------------------
// O que a falha declara — os dois desfechos que não são sucesso
// ---------------------------------------------------------------------------

/**
 * O que o ato incompleto declara sobre o estado em que a cobrança ficou — **três formas, fechadas**.
 *
 * Elas não são texto livre: é este objeto que a borda repassa em `detalhes` do envelope da ADR-0017,
 * e é por ele que quem opera distingue *"nada mudou"* de *"a cobrança ficou sem boleto"*. Colapsá-las
 * numa só apagaria justamente a distinção que a CA-06 existe para publicar.
 *
 * ⚠️ A terceira forma **omite** `revogacao`, e a omissão é conteúdo: quando não havia boleto vivo,
 * revogação alguma aconteceu, e declarar uma seria mentir sobre o que o ato fez. Nenhum literal novo
 * é inventado aqui — os três textos são os que a §5.2 da tech spec declara.
 */
export type DetalhesDaReemissaoIncompleta =
  /** A revogação foi pedida e não confirmou dentro do teto — **nada foi apagado**. */
  | { readonly revogacao: 'PEDIDA_NAO_CONFIRMADA' }
  /** A revogação confirmou e a emissão falhou — a cobrança ficou **sem boleto** (CA-06). */
  | { readonly boleto: 'SEM_BOLETO'; readonly revogacao: 'CONFIRMADA' }
  /** Não havia boleto a revogar e a emissão falhou — a cobrança continua como estava. */
  | { readonly boleto: 'SEM_BOLETO' };

/** A revogação não se confirmou — o boleto anterior continua sendo o único. */
const DETALHES_DA_REVOGACAO_NAO_CONFIRMADA: DetalhesDaReemissaoIncompleta = Object.freeze({
  revogacao: 'PEDIDA_NAO_CONFIRMADA',
});

/** A revogação confirmou e a emissão não saiu — o desfecho declarado da CA-06. */
const DETALHES_DA_COBRANCA_SEM_BOLETO: DetalhesDaReemissaoIncompleta = Object.freeze({
  boleto: 'SEM_BOLETO',
  revogacao: 'CONFIRMADA',
});

/** Não havia o que revogar e a emissão não saiu — a cobrança continua sem boleto, como estava. */
const DETALHES_DA_EMISSAO_QUE_NAO_SAIU: DetalhesDaReemissaoIncompleta = Object.freeze({
  boleto: 'SEM_BOLETO',
});

/** O texto da falha — a cobrança é nomeada pelo **código**, que é a chave exposta (ADR-0017). */
const MENSAGEM_DA_REEMISSAO_INCOMPLETA = 'a reemissão do boleto não se completou para a cobrança';

/**
 * O ato composto não chegou ao fim — e o que ficou para trás está **declarado**, não implícito.
 *
 * Ela é levantada, e não devolvida como desfecho, porque aqui a distinção que
 * {@link ../modelo-canonico.ts} faz para a porta se inverte: a porta responde a uma **pergunta** do
 * domínio, e recusa é resposta; este ato é uma **ordem** do Admin, e uma ordem que não se cumpre é
 * falha — a borda a traduz em `503`, nunca em `200` com um corpo que finge sucesso.
 *
 * ⚠️ **Ela nomeia a cobrança e preserva o motivo do provedor, e as duas coisas têm regras
 * diferentes**: o código é chave exposta, já validada, e é o que a operação precisa ler para agir; o
 * `motivo` é **texto opaco** (RN-15), guardado como diagnóstico e **jamais** interpretado por ramo de
 * decisão algum. Quem decide o que sai no corpo da resposta é a borda, e o que ela publica é
 * {@link detalhes} — nunca o texto do provedor, que é vocabulário de lá.
 */
export class ErroDeReemissaoIncompleta extends Error {
  override readonly name: string = 'ErroDeReemissaoIncompleta';

  /** O código da cobrança que ficou no estado declarado — a chave que a operação usa para agir. */
  readonly codigoDaCobranca: string;

  /** O estado em que a cobrança ficou. É ele, e só ele, que a borda publica. */
  readonly detalhes: DetalhesDaReemissaoIncompleta;

  /** O texto **tal como o provedor o informou**; `null` quando quem interrompeu foi o teto. */
  readonly motivo: string | null;

  constructor(
    codigoDaCobranca: string,
    detalhes: DetalhesDaReemissaoIncompleta,
    motivo: string | null,
  ) {
    super(`${MENSAGEM_DA_REEMISSAO_INCOMPLETA} ${codigoDaCobranca}`);
    this.codigoDaCobranca = codigoDaCobranca;
    this.detalhes = detalhes;
    this.motivo = motivo;
  }
}

// ---------------------------------------------------------------------------
// O vocabulário do ato — declarado aqui, satisfeito lá fora (ADR-0025)
// ---------------------------------------------------------------------------

/**
 * A cobrança sobre a qual o ato incide — **o código e o que ela tem de boleto**, e nada além.
 *
 * O `codigo` é a chave exposta (ADR-0017): é por ele que a guarda deriva o nome do arquivo e é por
 * ele que a falha nomeia a cobrança. `numeroDoTituloNoProvedor` é o boleto **vivo**, e `null` é
 * *"nunca emitida, ou já revogada"* — a distinção que decide se existe etapa de revogação.
 *
 * ⚠️ **Não há `id` aqui, e a ausência é o mecanismo.** Quem grava o evento é quem satisfaz as portas
 * de escrita, por aplicação parcial na borda; um UUID nesta assinatura daria ao domínio a peça com
 * que alcançar **outra** cobrança. É a mesma razão, palavra por palavra, pela qual `TrabalhoDoLote`
 * não carrega o identificador do lote.
 */
export interface CobrancaAReemitir {
  /** O código legível `COB-{ano}-{7 dígitos}` — a chave exposta (ADR-0017). */
  readonly codigo: string;
  /** O número que o provedor atribuiu ao título vivo; `null` quando não há boleto a revogar. */
  readonly numeroDoTituloNoProvedor: string | null;
}

/**
 * A espera entre duas sondagens — **injetada**, nunca agendada aqui dentro.
 *
 * Ela recebe milissegundos porque é a grandeza de {@link FonteDeTempo}, e devolve promessa porque é o
 * que o laço aguarda. Quem a satisfaz em produção é a composição raiz, com um agendamento do runtime;
 * quem a satisfaz na verificação resolve na hora e faz o relógio avançar — e é isso que torna a
 * ordem de composição observável **sem espera real**.
 */
export type PortaDeEspera = (milissegundos: number) => Promise<void>;

/** A porta que lê da cobrança o que o pedido de emissão precisa — fechada na cobrança pela borda. */
export type PortaDosDadosDaEmissao = () => Promise<DadosDaCobrancaAEmitir>;

/**
 * A porta que grava a revogação — os campos de conciliação apagados mais o evento `BOLETO_REVOGADO`.
 *
 * As duas escritas vivem numa unidade de trabalho só, e é o *mesmo ato* que importa: apagar os campos
 * sem o evento deixaria a trilha sem o fato que explica por que a cobrança perdeu o boleto, e gravar
 * o evento sem apagar os campos publicaria uma cobrança revogada com boleto vivo.
 */
export type PortaDaRevogacaoGravada = () => Promise<void>;

/**
 * A porta que grava o boleto novo — os cinco campos de conciliação mais o evento `BOLETO_EMITIDO`.
 *
 * Os cinco viajam juntos porque são gravados no mesmo ato: uma linha com parte deles é uma cobrança
 * com boleto pela metade.
 */
export type PortaDoBoletoGravado = (boleto: BoletoParaConciliar) => Promise<void>;

/**
 * O ato de reemissão de **uma** cobrança — tudo o que ele precisa, e nada além.
 *
 * ⚠️ **Não há `empresaId` nas portas de dados**, e não deve haver: quem recorta por empresa é a
 * política do banco (ADR-0008), sob o contexto que a unidade de trabalho fixa. O `empresaId` que
 * viaja aqui é o do **ato no provedor**, e é ele que impede a credencial de uma empresa de ser
 * apresentada em chamada de outra.
 */
export interface TrabalhoDaReemissao {
  /** A empresa em nome de quem o ato acontece — nunca lida de requisição (ADR-0008/0009). */
  readonly empresaId: string;
  /** O material e a senha que o abrem, **opacos** (ADR-0032). Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
  /** Sobre qual cobrança o ato incide, e o que ela tem de boleto. */
  readonly cobranca: CobrancaAReemitir;
  /** A porta do provedor. O de produção e o de verificação são indistintos daqui (ADR-0025). */
  readonly adaptador: AdaptadorCobrancaBancaria;
  /** A guarda dos bytes do boleto — grava, e apaga o do boleto revogado. */
  readonly guarda: GuardaDeBoletos;
  /** O contador do SaaS, em unidade própria (ADR-0020/0033). */
  readonly identificador: PortaDoIdentificador;
  /** A leitura do que o pedido precisa da cobrança. */
  readonly dados: PortaDosDadosDaEmissao;
  /** A gravação da revogação — uma unidade de trabalho. */
  readonly gravarRevogacao: PortaDaRevogacaoGravada;
  /** A gravação do boleto novo — uma unidade de trabalho. */
  readonly gravarEmissao: PortaDoBoletoGravado;
  /** A espera entre sondagens. **Obrigatória** — ver o cabeçalho. */
  readonly esperar: PortaDeEspera;
  /** O relógio do ato. **Obrigatório** — ver o cabeçalho. */
  readonly agora: FonteDeTempo;
}

/**
 * O que o ato bem-sucedido devolve — **os dois números, de donos distintos**.
 *
 * `numeroDoTituloNoProvedor` é o que o **provedor** atribuiu ao título novo;
 * `identificadorNoProvedor` é o que **o produto** compôs e enviou (ADR-0033), e é a chave de
 * correlação que não se recupera depois, já que o contador não volta atrás. Devolver só um deles
 * obrigaria quem chama a reler a cobrança para descobrir o outro.
 *
 * Ele não repete os cinco campos de conciliação: quem os gravou foi {@link PortaDoBoletoGravado}, e
 * republicá-los aqui daria a quem chama uma segunda cópia do mesmo fato, livre para divergir da que
 * está no banco.
 */
export interface DesfechoDaReemissao {
  /** O número que o **provedor** atribuiu ao título novo. */
  readonly numeroDoTituloNoProvedor: string;
  /** As 18 posições que **o produto** compôs e enviou — única no SaaS (ADR-0033). */
  readonly identificadorNoProvedor: string;
}

// ---------------------------------------------------------------------------
// A sondagem — o laço que espera a confirmação, sem pausa fixa e sem relógio próprio
// ---------------------------------------------------------------------------

/** O que a sondagem apurou: se confirmou, e o texto do provedor quando ele recusou a pergunta. */
interface DesfechoDaSondagem {
  readonly confirmada: boolean;
  /** O motivo **tal como o provedor o informou**; `null` quando quem interrompeu foi o teto. */
  readonly motivo: string | null;
}

/** Tudo o que o laço de sondagem precisa — reunido para que a função não receba oito parâmetros. */
interface Sondagem {
  readonly adaptador: AdaptadorCobrancaBancaria;
  readonly ato: AtoSobreBoleto;
  readonly esperar: PortaDeEspera;
  readonly agora: FonteDeTempo;
  readonly intervaloMs: number;
  /** O instante a partir do qual não se pergunta mais — **já resolvido** pelo chamador. */
  readonly limite: number;
}

/**
 * Pergunta ao provedor se a revogação se concretizou, até confirmar ou até o limite.
 *
 * A primeira pergunta acontece **imediatamente**, e a espera fica **entre** duas perguntas: uma
 * espera antes da primeira gastaria um intervalo inteiro num provedor que já tivesse refletido.
 *
 * O limite chega **resolvido** de fora, e é o mais apertado entre o teto da confirmação e o que resta
 * do teto duro do ato composto. Resolvê-lo aqui dentro obrigaria esta função a conhecer o instante em
 * que o ato começou, que é fato do chamador.
 */
async function sondarAConfirmacao(sondagem: Sondagem): Promise<DesfechoDaSondagem> {
  const { adaptador, agora, ato, esperar, intervaloMs, limite } = sondagem;

  for (;;) {
    const desfecho = await adaptador.confirmarRevogacaoDeBoleto(ato);

    // O desfecho NÃO aceito interrompe — ver o cabeçalho para por que insistir não melhora nenhuma
    // das duas classes de falha. O texto do provedor sobe intacto (RN-15).
    if (!desfecho.aceito) {
      return { confirmada: false, motivo: desfecho.motivo };
    }

    // `false` é a resposta "ainda não", e é o que a sondagem existe para esperar.
    if (desfecho.valor) {
      return { confirmada: true, motivo: null };
    }

    // O teto é conferido DEPOIS da pergunta e ANTES da espera: uma confirmação que chegasse na
    // última pergunta possível ainda é vista, e nenhuma espera acontece para além do limite.
    if (agora() >= limite) {
      return { confirmada: false, motivo: null };
    }

    await esperar(intervaloMs);
  }
}

// ---------------------------------------------------------------------------
// O ato composto
// ---------------------------------------------------------------------------

/**
 * Revoga o boleto vivo, espera a confirmação e **só então** emite o novo — num ato só.
 *
 * Sobre cobrança **sem** boleto vivo, a etapa de revogação não existe e a porta recebe exatamente
 * `['emitir']` (CA-18).
 *
 * @throws {ErroDeReemissaoIncompleta} quando o ato não chega ao fim — com {@link
 * ErroDeReemissaoIncompleta.detalhes} declarando o estado em que a cobrança ficou.
 * @throws Repassa, sem capturar, toda falha das portas de dados e da guarda: elas são transitórias
 * (banco, disco) e quem repete é a borda ou a pessoa, nunca este laço. Capturá-las aqui as
 * transformaria em desfecho declarado do ato, e a operação leria *"a cobrança ficou sem boleto"*
 * onde o fato é *"o banco não respondeu"*.
 */
export async function reemitirBoleto(trabalho: TrabalhoDaReemissao): Promise<DesfechoDaReemissao> {
  const { adaptador, agora, cobranca, empresaId, esperar, guarda, segredo } = trabalho;

  const inicioDoAto = agora();
  const fimDoAto = inicioDoAto + TETO_DA_REEMISSAO_MS;
  const numeroDoTituloVivo = cobranca.numeroDoTituloNoProvedor;
  let revogouOAnterior = false;

  if (numeroDoTituloVivo !== null) {
    const ato: AtoSobreBoleto = {
      empresaId,
      segredo,
      numeroDoTituloNoProvedor: numeroDoTituloVivo,
    };

    const pedido = await adaptador.solicitarRevogacaoDeBoleto(ato);
    if (!pedido.aceito) {
      throw new ErroDeReemissaoIncompleta(
        cobranca.codigo,
        DETALHES_DA_REVOGACAO_NAO_CONFIRMADA,
        pedido.motivo,
      );
    }

    const sondado = await sondarAConfirmacao({
      adaptador,
      ato,
      esperar,
      agora,
      intervaloMs: INTERVALO_ENTRE_SONDAS_MS,
      // O mais apertado dos dois tetos: o da confirmação nunca empurra o ato composto para além do
      // teto duro dele. Sem o mínimo, uma revogação lenta poderia ser sondada depois de o ato já ter
      // estourado o próprio limite.
      limite: Math.min(agora() + TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS, fimDoAto),
    });

    if (!sondado.confirmada) {
      // NADA é apagado: o boleto anterior continua sendo o único, e a conferência seguinte apura o
      // desfecho real junto ao provedor.
      throw new ErroDeReemissaoIncompleta(
        cobranca.codigo,
        DETALHES_DA_REVOGACAO_NAO_CONFIRMADA,
        sondado.motivo,
      );
    }

    // O fato de negócio primeiro, o arquivo depois — ver o cabeçalho para o defeito que a ordem
    // inversa trocaria pelo arquivo órfão benigno.
    await trabalho.gravarRevogacao();
    await guarda.apagar(cobranca.codigo);
    revogouOAnterior = true;
  }

  // A partir daqui a cobrança está SEM boleto, e é isso que torna a falha da emissão o desfecho
  // declarado da CA-06 em vez de um acidente.
  const detalhesDaFalha = revogouOAnterior
    ? DETALHES_DA_COBRANCA_SEM_BOLETO
    : DETALHES_DA_EMISSAO_QUE_NAO_SAIU;

  if (agora() >= fimDoAto) {
    throw new ErroDeReemissaoIncompleta(cobranca.codigo, detalhesDaFalha, null);
  }

  // A leitura vem ANTES do contador, pela mesma razão escrita no percurso do lote: entre as duas,
  // ler primeiro evita queimar um número quando o cadastro do locatário não pode ser lido. O furo
  // continua **aceito** (ADR-0020) — o que se evita é o furo desnecessário.
  const dados = await trabalho.dados();
  const identificadorNoProvedor = await trabalho.identificador();

  const emissao = await adaptador.emitir({
    empresaId,
    segredo,
    identificadorNoProvedor,
    valor: dados.valor,
    vencimento: dados.vencimento,
    locatario: dados.locatario,
  });

  if (!emissao.aceito) {
    throw new ErroDeReemissaoIncompleta(cobranca.codigo, detalhesDaFalha, emissao.motivo);
  }

  // Os bytes primeiro, porque é a guarda que produz o caminho que a unidade grava.
  const caminhoDoArquivo = await guarda.gravar(cobranca.codigo, emissao.valor.documento);

  await trabalho.gravarEmissao({
    numeroDoTituloNoProvedor: emissao.valor.numeroDoTituloNoProvedor,
    linhaDigitavel: emissao.valor.linhaDigitavel,
    codigoDeBarras: emissao.valor.codigoDeBarras,
    identificadorNoProvedor,
    caminhoDoArquivo,
  });

  return {
    numeroDoTituloNoProvedor: emissao.valor.numeroDoTituloNoProvedor,
    identificadorNoProvedor,
  };
}
