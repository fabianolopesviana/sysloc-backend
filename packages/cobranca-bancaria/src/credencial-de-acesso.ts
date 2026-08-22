/**
 * O **cache da credencial de acesso ao provedor** — por processo, chaveado por **empresa e família de
 * escopo**, renovado por expiração.
 *
 * ===========================================================================
 * ELE NÃO SAI NO BARRIL, e a ausência é o mecanismo (D5 do tech-alignment)
 * ===========================================================================
 *
 * Publicá-lo ofereceria um **segundo caminho**, mais fraco, para a mesma política: quem importasse o
 * cache poderia guardar credencial viva fora do adaptador, sob outra chave, com outro prazo — e a
 * frase *"a credencial de uma empresa nunca é apresentada em chamada de outra"* deixaria de ser
 * propriedade do código e passaria a ser boa-fé de quem escrevesse o segundo consumidor. É a mesma
 * razão pela qual as quatro constantes de `OPCOES_PADRAO_DA_TAREFA` são privadas em
 * `@sysloc/shared`. O único consumidor é `./adaptador-sicoob.ts`, e é assim que fica.
 *
 * ===========================================================================
 * A CHAVE É A EMPRESA, e é ELA que impede a credencial de vazar de lado
 * ===========================================================================
 *
 * Não há credencial "corrente", não há última obtida, não há valor de fallback: quem não achou
 * credencial viva **daquela** empresa obtém uma nova. Um cache de um valor só — a forma ingênua —
 * apresentaria a credencial da empresa A na chamada da empresa B assim que um lote alternasse entre
 * duas, e o provedor emitiria o boleto da B na conta da A. O `CT-943` mede exatamente isso.
 *
 * ===========================================================================
 * E A CHAVE PASSOU A COMPOR A FAMÍLIA DE ESCOPO (D6) — o segundo eixo é MEDIDO
 * ===========================================================================
 *
 * A empresa sozinha deixou de bastar quando o produto ganhou a **segunda família de operação**: a
 * concessão da família da entrega da notícia exige escopos próprios, e a credencial obtida com os
 * escopos de boleto **obtém token e é recusada pelo gateway com `401`** na operação da outra família
 * (medido contra a conta real). Com a chave inalterada, uma credencial de boleto viva seria
 * apresentada numa chamada de entrega — e a recusa apareceria como falha do produto **intermitente**
 * (só quando há credencial viva da outra família) e **dependente de ordem** (só quando a chamada da
 * outra família veio antes). É a pior classe de defeito para depurar, e é a razão de a mitigação ser
 * a chave, e não um teste a mais.
 *
 * ⚠️ **A separação é estrutural, e não um filtro que alguém possa esquecer**: cada família tem
 * **tabela de associação própria**, e o registro que as reúne é fechado por {@link FamiliaDeEscopo} —
 * família nova sem tabela própria **não compila**, que é a mesma disciplina do `Record` de desfechos
 * do adaptador. Não existe caminho que leia a tabela de uma família com a chave de outra, porque não
 * existe chave textual composta que se possa montar errado.
 *
 * **Duas alternativas foram rejeitadas, e por quê** (D6 do tech-alignment):
 *
 * - **Pedir a união dos escopos numa credencial só** — não medido contra a conta real; o provedor
 *   pode recusar a união ou conceder escopo reduzido **em silêncio**, que é a forma cara do defeito.
 *   E alargaria o alcance de toda credencial do produto.
 * - **Obter credencial fresca a cada ato, sem cache** — criaria um **segundo caminho** de obtenção, e
 *   este cache é declarado logo acima como *"a única forma de uma chamada obter credencial"*. O ganho
 *   é nulo e o custo é a perda de um invariante.
 *
 * **Trade-off aceito**: o processo passa a reter **até duas** credenciais vivas por empresa. Custo
 * desprezível, e o esquecimento por invalidação continua valendo para as duas — seletivamente.
 *
 * ===========================================================================
 * A FONTE DE TEMPO CHEGA POR PARÂMETRO — este módulo não chama `Date.now()`
 * ===========================================================================
 *
 * Quem decide o que é *"agora"* é quem constrói o adaptador, e o relógio desce até aqui pela
 * assinatura de {@link criarCacheDeCredenciais}. Duas consequências, e as duas são conteúdo:
 *
 * 1. **A expiração é prova sem espera real.** Atravessar cinco minutos de validade não custa cinco
 *    minutos de suíte, e não se paga o preço de um relógio falso instalado no runtime — que a stack
 *    de teste deste projeto proíbe (`vi.useFakeTimers`) justamente por alcançar tudo o que o
 *    processo agenda, e não só o que o caso quis mover.
 * 2. **Não há duas fontes de tempo no adaptador.** `Date.now()` chamado aqui dentro seria a segunda,
 *    livre para divergir da que o resto do ato usa.
 *
 * ⚠️ **Nada aqui persiste, e nada aqui é registrado.** A credencial viva mora numa tabela de
 * associação **fechada no fecho** de {@link criarCacheDeCredenciais}: ela não é propriedade do
 * objeto devolvido, de modo que `Object.keys`, espalhamento, `JSON.stringify` e `util.inspect` sobre
 * o cache não a alcançam. É a mesma barreira estrutural que `SegredoOperavel` instala sobre o
 * material do certificado (ADR-0032), pelo mesmo motivo: o que não é enumerável não vaza por
 * serialização distraída.
 *
 * ===========================================================================
 * SEM COALESCÊNCIA DE PEDIDOS EM VOO, e a ausência é decisão
 * ===========================================================================
 *
 * Duas operações simultâneas da mesma empresa obtêm duas credenciais, e a segunda substitui a
 * primeira. Custa **uma** chamada a mais e nada mais: as duas credenciais são válidas, e o percurso
 * do lote é sequencial por decisão (D2). Partilhar a promessa em voo traria estado de promessa
 * compartilhada entre atos — inclusive a rejeitada, que precisaria ser invalidada sem que nenhum
 * caso a observe. O ganho não paga a superfície.
 */

import type { DesfechoDaOperacao } from './modelo-canonico.js';

/**
 * Quanto vale uma credencial quando o provedor não diz por quanto tempo ela vale — **300 s**.
 *
 * O número é **medido**, não estimado: a sonda de leitura da §13-A.4 do discovery obteve credencial
 * real e mediu a validade em 300 segundos. Ele é o piso da política e não o teto: quando a resposta
 * declara a própria validade, é ela que vale — o provedor pode encurtar o prazo a qualquer momento, e
 * um número fixo aqui faria o produto apresentar credencial vencida até o relógio local concordar.
 */
export const PRAZO_PADRAO_DA_CREDENCIAL_S = 300;

/**
 * Quanto antes do fim declarado uma credencial deixa de ser reaproveitada — **30 s**.
 *
 * ---------------------------------------------------------------------------
 * DUAS FOLGAS CORREM CONTRA O PRODUTO, e a margem cobre as duas
 * ---------------------------------------------------------------------------
 *
 * 1. **O prazo conta da emissão, e o instante gravado é o da chegada.** O provedor começa a contar
 *    quando concede; o cache só sabe da concessão quando a resposta chega, de modo que a validade
 *    real é sempre **menor** que a gravada — pela latência da própria obtenção.
 * 2. **A conferência precede uma chamada que pode durar até o teto de uma operação.** Uma credencial
 *    considerada viva no instante da decisão pode estar morta quando o provedor a lê.
 *
 * O custo de não ter margem não é uma repetição: a recusa de credencial é falha **`DA_EMPRESA`**, e
 * essa classe **para o percurso do lote** — um lote longo cruzaria o prazo e pararia por motivo
 * inteiramente previsível. O custo de tê-la é **uma obtenção a mais** na fronteira do prazo.
 *
 * O número é maior que o teto de uma chamada ao provedor (10 s) com folga para a latência da
 * concessão, e pequeno diante do prazo medido de 300 s: ele encurta a validade útil em 10%, e não
 * transforma o cache em obtenção por chamada. Ele é **exportado** pela mesma razão do prazo acima —
 * o que a verificação mede é o **efeito** dele, e reescrevê-lo como literal no caso faria a asserção
 * medir o teste em vez do artefato.
 */
export const MARGEM_DE_RENOVACAO_S = 30;

/** A conversão que o cache faz uma vez, para que o prazo seja declarado em segundos como o provedor o informa. */
const MILISSEGUNDOS_POR_SEGUNDO = 1_000;

/** O relógio do ato, em milissegundos desde a época — a mesma grandeza de `Date.now()`. */
export type FonteDeTempo = () => number;

/**
 * A **família de escopo** de uma operação — vocabulário do **produto**, e o segundo eixo da chave.
 *
 * ---------------------------------------------------------------------------
 * Ela vive AQUI, e os escopos concretos vivem no ADAPTADOR — a divisão é a ADR-0001
 * ---------------------------------------------------------------------------
 *
 * O que este tipo nomeia é *"que natureza de ato o produto vai praticar"*: cobrar, ou configurar por
 * onde a notícia do provedor chega. Os **escopos concretos** que cada família resolve são dialeto do
 * provedor e vivem **dentro** do adaptador, junto das demais permissões pedidas — a tradução acontece
 * na fronteira, e só nela. Trazer o nome de um escopo para cá poria vocabulário do provedor na chave
 * de um cache que o domínio inteiro atravessa.
 *
 * ⚠️ **Ele NÃO sai no barril do pacote**, e a ausência segue a régua do próprio barril — publica-se o
 * que tem consumidor nomeado fora daqui, e não há nenhum: quem escolhe a família é o adaptador, ao
 * compor cada operação. É a mesma razão pela qual `CacheDeCredenciais`, que a §1 da task também nomeia
 * entre os símbolos públicos, permanece superfície **de módulo** e não de pacote.
 */
export type FamiliaDeEscopo = 'COBRANCA' | 'ENTREGA_DA_NOTICIA';

/**
 * O que uma obtenção bem-sucedida devolve ao cache — **o segredo e o prazo**, e nada mais.
 *
 * `validaPorSegundos` é anulável porque a resposta do provedor pode omitir o prazo, e omissão não é
 * zero: quem omite cai em {@link PRAZO_PADRAO_DA_CREDENCIAL_S}. Traduzir a omissão em `0` faria o
 * cache renovar a cada chamada, que é o defeito que ele existe para evitar.
 */
export interface CredencialConcedida {
  /** O portador que a chamada seguinte apresenta. Nunca é registrado, nunca sai em desfecho. */
  readonly credencial: string;
  /** Por quantos segundos ela vale, tal como o provedor o informou — `null` quando ele não informou. */
  readonly validaPorSegundos: number | null;
}

/** Como o cache pede uma credencial nova quando não tem nenhuma viva. */
export type ObtencaoDaCredencial = () => Promise<DesfechoDaOperacao<CredencialConcedida>>;

/**
 * O cache — **uma operação**, e ela é a única forma de uma chamada obter credencial.
 *
 * A obtenção chega por parâmetro, e não por construção, porque quem sabe compor o pedido ao provedor
 * é o adaptador, e ele precisa do segredo **daquele ato** para apresentá-lo. Guardá-la na construção
 * obrigaria o cache a reter o segredo da empresa entre atos, que é exatamente o oposto da D6-b.
 */
export interface CacheDeCredenciais {
  /**
   * Devolve a credencial viva **daquela empresa naquela família**, obtendo uma nova quando não há.
   *
   * A falha da obtenção **atravessa como está**: classe e motivo são do adaptador, que é quem leu a
   * resposta do provedor. Reclassificá-la aqui apagaria a distinção entre *"a identidade desta
   * empresa não serve"* (`DA_EMPRESA`, que interrompe o lote) e o resto.
   *
   * ⚠️ `familia` é **obrigatória**, e a obrigatoriedade é a rede: com ela na assinatura, nenhuma
   * operação futura consegue ser escrita sem declarar sob que escopos a credencial vale — o
   * compilador recusa o ato omisso, em vez de a recusa chegar do gateway como `401` intermitente.
   */
  credencialDaEmpresa(
    empresaId: string,
    familia: FamiliaDeEscopo,
    obtencao: ObtencaoDaCredencial,
  ): Promise<DesfechoDaOperacao<string>>;

  /**
   * Esquece a credencial viva da empresa **naquela família** — **o prazo declarado não é promessa**.
   *
   * O provedor pode invalidar uma credencial antes do prazo que ele mesmo anunciou (identidade
   * revogada, sessão derrubada do lado de lá), e sem isto o produto apresentaria a credencial morta
   * até o relógio local concordar — **todas** as chamadas daquela empresa falhariam até lá, e as
   * repetições da fila junto com elas.
   *
   * ⚠️ O esquecimento é **seletivo por família**, e a seletividade é conteúdo: uma credencial de
   * boleto que o provedor invalidou nada diz sobre a credencial de entrega da mesma empresa, e
   * derrubar as duas custaria uma obtenção que ninguém pediu — no eixo em que a recusa de credencial
   * **para o percurso do lote**.
   *
   * ⚠️ Ela **não repete** a chamada, e a ausência de repetição é decisão: quem repete é a fila, pela
   * política de `@sysloc/shared` (§3.3). O que esta operação faz é impedir que a repetição encontre
   * a mesma credencial morta guardada.
   */
  esquecerCredencialDaEmpresa(empresaId: string, familia: FamiliaDeEscopo): void;
}

/** Uma credencial viva e o instante em que ela deixa de valer. */
interface CredencialViva {
  readonly credencial: string;
  readonly validaAte: number;
}

/**
 * Quantos segundos a credencial vale, recusando o que não serve de prazo.
 *
 * Prazo ausente, não numérico, infinito, negativo ou zero cai no padrão medido. É tradução de
 * fronteira: o número chega de um JSON de terceiro, e `NaN` propagado até a aritmética do instante
 * produziria uma credencial que **nunca** expira — a forma silenciosa do defeito.
 */
function prazoEmSegundos(declarado: number | null): number {
  return declarado !== null && Number.isFinite(declarado) && declarado > 0
    ? declarado
    : PRAZO_PADRAO_DA_CREDENCIAL_S;
}

/**
 * Cria o cache do processo — **uma tabela de associação por família**, todas fechadas no fecho.
 *
 * ⚠️ O registro é **fechado por {@link FamiliaDeEscopo}**, e não um `Map` de chave textual composta.
 * A escolha é estrutural e substitui uma promessa por uma propriedade: com chave composta, separar as
 * famílias dependeria de um separador que nenhuma das partes contivesse — boa-fé de quem monta a
 * cadeia. Com uma tabela por família, colisão entre eixos é **irrepresentável**, e uma família nova
 * sem tabela própria não compila.
 *
 * @param agora A fonte de tempo do adaptador. Ver o cabeçalho: ela chega pela assinatura.
 */
export function criarCacheDeCredenciais(agora: FonteDeTempo): CacheDeCredenciais {
  const vivas: Record<FamiliaDeEscopo, Map<string, CredencialViva>> = {
    COBRANCA: new Map(),
    ENTREGA_DA_NOTICIA: new Map(),
  };

  return {
    async credencialDaEmpresa(empresaId, familia, obtencao) {
      const daFamilia = vivas[familia];
      const viva = daFamilia.get(empresaId);

      // A margem entra na ÚNICA comparação que decide reaproveitar (ver
      // {@link MARGEM_DE_RENOVACAO_S}): nenhum caminho apresenta credencial cuja validade restante
      // seja menor que o tempo que a chamada seguinte pode custar.
      const fimDaChamadaSeguinte = agora() + MARGEM_DE_RENOVACAO_S * MILISSEGUNDOS_POR_SEGUNDO;

      if (viva !== undefined && fimDaChamadaSeguinte < viva.validaAte) {
        return { aceito: true, valor: viva.credencial };
      }

      // A vencida sai ANTES da obtenção: se a obtenção falhar, o que fica na memória do processo é
      // nada, e não uma credencial que já não vale. Nenhum caminho apresenta credencial expirada.
      daFamilia.delete(empresaId);

      const desfecho = await obtencao();

      if (!desfecho.aceito) {
        return desfecho;
      }

      const { credencial, validaPorSegundos } = desfecho.valor;
      daFamilia.set(empresaId, {
        credencial,
        validaAte: agora() + prazoEmSegundos(validaPorSegundos) * MILISSEGUNDOS_POR_SEGUNDO,
      });

      return { aceito: true, valor: credencial };
    },

    esquecerCredencialDaEmpresa(empresaId, familia) {
      // A tabela é a **daquela família**, e só ela: esquecer a credencial de uma família não derruba
      // a da outra, que segue viva e válida sob os próprios escopos.
      vivas[familia].delete(empresaId);
    },
  };
}
