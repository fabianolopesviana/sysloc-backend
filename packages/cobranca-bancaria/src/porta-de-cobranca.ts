/**
 * A porta de **cobrança bancária** — a que a ADR-0001 reserva pelo nome, declarada pelo domínio.
 *
 * ===========================================================================
 * A direção da dependência parece invertida, e é ela que está certa (ADR-0025)
 * ===========================================================================
 *
 * Quem declara a interface e os tipos que a atravessam é este pacote; é o adaptador do provedor
 * (`adaptador-sicoob.ts`) que **importa daqui** para dizer que a satisfaz, e é a composição raiz que
 * escolhe qual implementação injetar. A porta chega a quem a usa **por parâmetro**, nunca por
 * import. É o que torna literalmente verdadeira a frase *"o domínio não conhece o provedor"*, em vez
 * de meia-verdade, e o que faz trocar de banco não tocar uma linha deste arquivo.
 *
 * ===========================================================================
 * QUATRO operações, e a `Decision` da ADR-0001 lista CINCO — isto é registro
 * ===========================================================================
 *
 * A `Decision` diz: *"O núcleo conversa apenas com a porta `AdaptadorCobrancaBancaria`
 * (`obter_token`, `emitir`, `solicitar_baixa`, `confirmar_baixa`, `consultar`)"*. Esta porta declara
 * **quatro** — a obtenção da credencial de acesso acontece **dentro** do adaptador. A divergência foi
 * **escalada ao usuário e decidida por ele** em 2026-08-16, está registrada na §21.1(1) do tech spec
 * da fatia `emissao-e-conciliacao`, e vai reproduzida aqui de propósito: **é a `Decision` que se abre
 * ao citar**, e sem esta prosa a rodada seguinte "corrige" para cinco e reabre o debate. As três
 * razões:
 *
 * 1. A **emenda de 2026-08-15** da própria ADR declara que a exclusividade é *"de critério, e não de
 *    contagem de portas"*, e que o que ela garante é que nenhuma das cinco fique *"alcançável **por
 *    fora** da porta que esta ADR reserva"*. Dentro do adaptador não é por fora.
 * 2. A mesma `Decision` fecha: *"Nenhum campo, URL ou vocabulário específico de provedor cruza a
 *    porta"*. Uma credencial de acesso `client_credentials` **é** vocabulário do provedor. Pô-la na
 *    porta satisfaria o parentético contradizendo a cláusula que a emenda declara ser *"propriedade
 *    do vocabulário"*.
 * 3. A operação **não teria chamador no domínio**. A fatia (i) recusou por escrito declarar
 *    assinatura sem quem a chame — *"seria escolher quatro assinaturas sem quem as chame, e a fatia
 *    (ii) as reescreveria contra a API real"* (`./porta-de-identidade.ts`). Reintroduzir o mesmo
 *    defeito agora seria regressão de decisão.
 *
 * ===========================================================================
 * NENHUMA operação rejeita — todas resolvem em `DesfechoDaOperacao<T>`
 * ===========================================================================
 *
 * Recusa, indisponibilidade e tempo esgotado são **desfechos da pergunta que o domínio faz**, e cada
 * um chega distinguido pela classe e pelo motivo. É a mesma decisão, e a mesma razão, do cabeçalho de
 * `./porta-de-identidade.ts`: levantar seria a alternativa idiomática e está descartada porque a
 * borda traduziria a exceção em `500`, e quem opera leria *"o sistema falhou"* onde o fato é *"o
 * provedor recusou esta cobrança"* (RN-06).
 *
 * No lote o preço seria maior ainda: uma exceção derrubaria o percurso inteiro num ponto em que a
 * decisão correta, para a falha que é **da cobrança**, é seguir para a próxima (RN-02, CA-03).
 *
 * ===========================================================================
 * Esta porta e a de IDENTIDADE não se fundem, e a separação é a decisão
 * ===========================================================================
 *
 * `PortaDeIdentidadeBancaria` responde *"esta identidade serve?"*, que é ato de **configuração**, do
 * Admin, na área de integrações. Esta responde pelos atos de **cobrança**. Fundi-las obrigaria toda
 * implementação de uma a satisfazer a outra — a verificação de identidade passaria a exigir cinco
 * operações que ela não exerce, e o cadastro de certificado carregaria a superfície inteira da
 * emissão. Quem satisfaz as duas hoje é o mesmo adaptador, e isso é escolha dele, não da fronteira.
 *
 * ⚠️ **Nada de transporte atravessa estas assinaturas**: nem endereço, nem teto de tempo, nem
 * cabeçalho, nem credencial de habilitação. Endereço e teto são propriedade de quem constrói o
 * adaptador; o segredo chega opaco (ADR-0032), e só o adaptador o abre.
 */

import type {
  AtoSobreBoleto,
  BoletoEmitido,
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  PedidoDeEmissao,
  SituacaoConsultada,
} from './modelo-canonico.js';

/**
 * A porta de cobrança bancária — a única forma de o domínio agir sobre um título no provedor.
 *
 * As quatro operações são as que têm **chamador no domínio** desta fatia: a emissão (unitária e em
 * lote), as duas metades da revogação — que a reemissão compõe num ato só, para que em nenhum
 * instante dois boletos sejam pagáveis — e a consulta, que serve tanto à conferência diária quanto à
 * re-obtenção do documento perdido.
 */
export interface AdaptadorCobrancaBancaria {
  /** Emite o boleto e devolve os três identificadores dele mais os bytes do documento. */
  emitir(pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>>;

  /**
   * Pede a revogação do boleto — o **pedido**, e não o desfecho dele.
   *
   * O provedor não revoga na mesma resposta, e por isso as duas metades são operações distintas:
   * fundi-las numa só obrigaria esta a sondar por dentro, com um teto de tempo que ela não conhece e
   * que pertence a quem compõe a reemissão. `void` porque o que se sabe aqui é apenas que o pedido
   * foi aceito.
   */
  solicitarRevogacaoDeBoleto(boleto: AtoSobreBoleto): Promise<DesfechoDaOperacao<void>>;

  /**
   * Pergunta se a revogação pedida já se concretizou — `true` quando sim.
   *
   * `false` **não é falha**: é a resposta *"ainda não"*, e é o que a sondagem da reemissão espera
   * receber até o teto. Modelá-la como desfecho negativo faria a espera normal parecer erro, e a
   * reemissão desistiria na primeira pergunta.
   */
  confirmarRevogacaoDeBoleto(boleto: AtoSobreBoleto): Promise<DesfechoDaOperacao<boolean>>;

  /** Consulta a situação do título, com os bytes do documento quando a consulta os pedir. */
  consultarSituacao(consulta: ConsultaDeSituacao): Promise<DesfechoDaOperacao<SituacaoConsultada>>;
}
