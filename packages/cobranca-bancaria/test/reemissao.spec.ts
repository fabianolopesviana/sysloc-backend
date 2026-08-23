/**
 * A **reemissão de boleto** — a ordem do ato composto, e os dois desfechos que não são sucesso.
 * T11 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso       | Invariante |
 * |----------|------------|------------|
 * | CA-05    | CT-917     | Sobre cobrança com boleto vivo, `reemitirBoleto` invoca
 * |          |            | `solicitarRevogacaoDeBoleto`, depois `confirmarRevogacaoDeBoleto` e **só
 * |          |            | depois** `emitir` — e **nunca** invoca `emitir` antes de a confirmação ter
 * |          |            | retornado positiva. A sequência é afirmada por **igualdade de lista**, e no
 * |          |            | instante em que `emitir` foi invocado a cobrança **já não tinha boleto**. |
 * | CA-06    | CT-917 (b) | Revogação confirmada e emissão recusada deixam a cobrança **sem boleto**:
 * |          |            | a revogação foi gravada, o arquivo foi apagado, nenhuma emissão foi
 * |          |            | gravada, e o ato falha com `ErroDeReemissaoIncompleta` **nomeando a
 * |          |            | cobrança**, com `detalhes` igual a `{ boleto: 'SEM_BOLETO', revogacao:
 * |          |            | 'CONFIRMADA' }` — objeto inteiro. |
 * | CA-05    | CT-917 (c) | A revogação que não confirma dentro do teto **não apaga nada**: `emitir`
 * |          |            | não é invocado, efeito de dados nenhum acontece, o boleto anterior segue
 * |          |            | intacto, e a falha declara `{ revogacao: 'PEDIDA_NAO_CONFIRMADA' }`. A
 * |          |            | contagem de sondagens é **exatamente** a que os dois limites publicados
 * |          |            | produzem. |
 * | CA-18    | CT-917 (d) | Sem boleto vivo **não há etapa de revogação**: a sequência de operações
 * |          |            | recebidas pela porta é **exatamente** `['emitir']`. |
 * | CA-05    | CT-917 (e) | O **pedido** de revogação recusado encerra o ato na primeira operação: não
 * |          |            | se sonda, não se emite, efeito de dados nenhum acontece, e a falha declara
 * |          |            | `{ revogacao: 'PEDIDA_NAO_CONFIRMADA' }` com o motivo do provedor **byte a
 * |          |            | byte**. |
 * | CA-05    | CT-917 (f) | O desfecho **não aceito** da sondagem **interrompe** o laço em vez de
 * |          |            | insistir: a lista tem exatamente as sondagens até a recusa, e o motivo do
 * |          |            | provedor sobe intacto em lugar do `null` do teto. |
 * | CA-06    | CT-917 (g) | Vencido o **teto duro do ato composto**, `emitir` não é invocado ainda que a
 * |          |            | revogação já tenha confirmado: a cobrança fica sem boleto, o motivo é `null`
 * |          |            | porque quem interrompeu foi o teto, e a falha declara `{ boleto:
 * |          |            | 'SEM_BOLETO', revogacao: 'CONFIRMADA' }`. |
 * | CA-18    | CT-917 (h) | Sem boleto vivo, a emissão recusada declara a **terceira forma** dos
 * |          |            | detalhes — `{ boleto: 'SEM_BOLETO' }`, **sem** `revogacao`, objeto inteiro —
 * |          |            | e efeito de dados nenhum acontece. |
 *
 * Rastreabilidade: `CA-05 → CT-917 (RN-04)` · `CA-06 → CT-917 (b) (RN-04)` ·
 * `CA-05 → CT-917 (c) (RN-04)` · `CA-18 → CT-917 (d) (RN-04)` · `CA-05 → CT-917 (e) (RN-15)` ·
 * `CA-05 → CT-917 (f) (RN-15)` · `CA-06 → CT-917 (g) (RN-04)` · `CA-18 → CT-917 (h) (RN-04)`.
 *
 * ⚠️ **Os sete casos com sufixo são o companheiro negativo do CT-917 dentro desta task**, e não uma
 * antecipação do CT-918 (T13) — aquele mede a mesma invariante **atravessando HTTP e banco reais**,
 * que é o companheiro de integração exigido pela Mock Budget Rule. O sufixo segue o precedente do
 * próprio pacote (`CT-809 (b)`, `(c)`, `(d)` em `./vocabulario-canonico.spec.ts`): asserção adicional
 * do mesmo critério não inventa identificador que pertence a outra task.
 *
 * ⚠️ **Os quatro últimos existem porque o SUT declara SEIS desfechos de falha, e a rodada anterior
 * exercitava dois.** Ramo de falha sem caso é buraco de prova (R2), e três deles são comportamento
 * **deliberado e documentado no cabeçalho do SUT** — nomeadamente a interrupção da sondagem diante de
 * um desfecho não aceito, à qual aquele arquivo dedica uma seção inteira e que um `continue` no lugar
 * do `return` desfaria em silêncio. **Todos os seis ramos têm caso agora**; nenhum ficou por fechar.
 *
 * ===========================================================================
 * Qual asserção DISCRIMINA cada defeito (prova do P4 — aqui é de RACIOCÍNIO)
 * ===========================================================================
 *
 * As asserções deste arquivo são **comportamentais**: exercitam `reemitirBoleto` e observam o
 * resultado. A `.claude/rules/testing-stack.md` não lhes cobra prova de falsificação por execução, e
 * o **P4 do Protocolo Antirregressão a PROÍBE** para elas (2026-08-17) — reintroduzir defeito
 * comportamental "para conferir" é campanha de mutantes com outro nome, e mutation testing está fora
 * da stack deste projeto. O que se declara é qual asserção discrimina:
 *
 *   * **"emitiu depois da confirmação" vs "emitiu antes dela"** — o **retrato da cobrança no instante
 *     de `emitir`** (`retratosAoEmitir`, CT-917). Ele é lido pelo adaptador **de dentro** da chamada,
 *     do mesmo estado que as portas de dados mutam, e por isso é o único ponto de onde se observa a
 *     janela em que os dois boletos coexistiriam. A igualdade de lista da sequência, sozinha, **não**
 *     discrimina esse defeito: um ato que pedisse a revogação, emitisse em seguida e só então
 *     gravasse produziria uma sequência plausível com a janela aberta.
 *   * **"sondou até confirmar" vs "emitiu na primeira resposta"** — a igualdade de lista com as
 *     **três** confirmações do CT-917. Uma asserção por presença de `'confirmarRevogacaoDeBoleto'`
 *     passaria num ato que perguntasse uma vez e seguisse.
 *   * **"a cobrança ficou sem boleto" vs "nada aconteceu"** — a lista de **efeitos de dados** do
 *     CT-917 (b), `['REVOGACAO_GRAVADA','ARQUIVO_APAGADO']`, contra a lista **vazia** do CT-917 (c).
 *     É o par que separa os dois desfechos de falha: sem ele, os dois seriam "o ato levantou".
 *   * **"o teto encerra a sondagem" vs "o teto é decorativo"** — a **contagem exata** de sondagens do
 *     CT-917 (c), derivada dos dois limites publicados. Alterar qualquer um deles reprova ali.
 *   * **"não há revogação supérflua" vs "pede revogação de boleto que não existe"** — a igualdade de
 *     lista `['emitir']` do CT-917 (d). Uma asserção de que `'emitir'` está presente passaria num ato
 *     que pedisse a revogação de um título nulo.
 *   * **"o pedido recusado encerra o ato" vs "sonda um pedido que o provedor não aceitou"** — a
 *     igualdade de lista de **um** item do CT-917 (e), somada ao `motivo` byte a byte. Sondar um
 *     pedido recusado acrescentaria confirmações à lista; ignorar a recusa trocaria o motivo do
 *     provedor pelo `null` do teto.
 *   * **"o desfecho não aceito INTERROMPE" vs "insiste até o teto"** — a igualdade de lista com
 *     **duas** confirmações do CT-917 (f), somada ao `motivo`. Trocar o `return` de
 *     `sondarAConfirmacao` por um `continue` faz a sondagem seguinte voltar a responder *"ainda não"*,
 *     o laço correr até o teto, e a lista passar a ter nove confirmações com `motivo` nulo.
 *   * **"o teto duro barra a emissão" vs "o teto duro é decorativo"** — a ausência de `'emitir'` na
 *     igualdade de lista do CT-917 (g), num arranjo em que a revogação **já confirmou**. Sem o teto,
 *     o ato seguiria e emitiria: a lista ganharia `'emitir'`, os efeitos ganhariam `BOLETO_GRAVADO`, e
 *     o ato devolveria desfecho em vez de levantar.
 *   * **"não havia o que revogar" vs "a revogação confirmou"** — o `detalhes` **inteiro** do CT-917
 *     (h), `{ boleto: 'SEM_BOLETO' }` sem `revogacao`, contra o do CT-917 (b). É a distinção que a
 *     borda da T13 vai ramificar, e uma asserção sobre a chave `boleto` sozinha aprovaria as duas.
 *
 * ===========================================================================
 * O que este arquivo NÃO afirma duas vezes — a regra que evita o AP-29
 * ===========================================================================
 *
 * **A ordem das operações é provada por igualdade de lista, e só por ela.** Nenhum caso deriva uma
 * segunda asserção do **mesmo** array já fixado por igualdade — nem índice contra índice, nem
 * contagem, nem presença. A igualdade de lista é estritamente mais forte que qualquer uma das três:
 * ela reprova a operação a mais, a que falta e a que trocou de lugar, e a asserção derivada dela é
 * consequência aritmética, incapaz de reprovar sozinha (**AP-29**).
 *
 * Pela mesma regra, **nenhum caso afirma `retratosAoEmitir` vazio a partir de uma lista de operações
 * sem `'emitir'`**: o retrato só nasce dentro daquela operação, e a igualdade de lista já o implica.
 * O retrato é asserido **onde discrimina** — nos casos em que `emitir` **foi** invocado (CT-917 e
 * CT-917 (d)), onde ele mede o estado da cobrança no instante da chamada, que nenhuma outra asserção
 * alcança.
 *
 * ===========================================================================
 * O DUBLÊ é IMPLEMENTAÇÃO das portas — nunca `vi.mock`
 * ===========================================================================
 *
 * O adaptador, a guarda e as quatro portas de dados são satisfeitos com as mesmas assinaturas pelas
 * quais a produção é exercitada, no molde de `./emissao-em-lote.spec.ts`. O que se substitui é a
 * **fronteira externa** — o HTTP do provedor, o banco e o disco —, que é exatamente o que a porta da
 * ADR-0001 e as portas da ADR-0025 existem para permitir trocar. Nenhuma bandeira, ramo ou parâmetro
 * de teste foi acrescentado ao código de produção.
 *
 * ⚠️ **`consultarSituacao` e `ler` LEVANTAM.** Não é zelo: é asserção. Um ato que consultasse a
 * situação durante a reemissão, ou que lesse os bytes do boleto antigo, derrubaria o caso no ponto em
 * vez de passar despercebido por ninguém ter olhado.
 *
 * ⚠️ **O acessório de arranjo é AGNÓSTICO**: ele registra **toda** operação e **todo** efeito, na
 * ordem em que acontecem, sem filtrar por tipo. Quem discrimina é a asserção — um acessório que
 * colhesse só o que o caso espera tornaria a igualdade de lista infalível (AP-29), que foi o
 * bloqueante da T9 desta fatia.
 *
 * ===========================================================================
 * `real_execution_boundary: none` é DELIBERADO
 * ===========================================================================
 *
 * A invariante é de **ordem de composição**, e ela é observável sem I/O: o que se mede é o que o ato
 * pede à porta, em que ordem, e em que estado a cobrança está quando ele pede. O companheiro de
 * integração exigido pela Mock Budget Rule é o **CT-931** (T13), que mede a mesma invariante
 * atravessando HTTP e banco reais.
 *
 * ⚠️ **O relógio e a espera vêm pela ASSINATURA**, e a espera do arranjo **avança o relógio** em vez
 * de dormir. É o que torna o teto de doze segundos atravessável em milissegundos sem `vi.useFakeTimers`
 * — que está fora da stack deste projeto — e sem pausa fixa, que a convenção de determinismo proíbe.
 *
 * ⚠️ **O arranjo também sabe avançar o relógio a cada chamada à porta**, e isso não é um artifício: em
 * produção o relógio avança **durante** as chamadas ao provedor, e é assim, e só assim, que o teto
 * duro do ato composto é alcançado. Sem esse eixo, o relógio deste arquivo só andaria pelas esperas
 * da sondagem, que somam no máximo o teto da confirmação — e o teto duro ficaria fora do alcance de
 * qualquer caso. Omitido, ele vale zero, e os casos que não o declaram medem exatamente o que mediam.
 *
 * ⚠️ **Este arquivo NÃO afirma quantas colunas a camada de dados apaga.** O que o domínio garante é
 * *chamar* a porta de revogação antes de emitir; qual `UPDATE` ela executa é da T6, e a contagem de
 * campos nulos é medida na borda, contra banco real (T13). O estado em memória aqui **espelha**
 * `revogarBoleto`, que preserva o identificador perante o provedor.
 */

import { criarSegredoOperavel } from '@sysloc/shared';
import { describe, expect, it } from 'vitest';
import type { DadosDaCobrancaAEmitir } from '../src/emissao-em-lote.ts';
import type { GuardaDeBoletos } from '../src/guarda-de-boletos.ts';
import type { AdaptadorCobrancaBancaria } from '../src/porta-de-cobranca.ts';
import {
  type DesfechoDaReemissao,
  ErroDeReemissaoIncompleta,
  INTERVALO_ENTRE_SONDAS_MS,
  reemitirBoleto,
  TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS,
  type TrabalhoDaReemissao,
} from '../src/reemissao.ts';
import { IDENTIDADE_DE_TESTE } from './material-de-teste.ts';

// ---------------------------------------------------------------------------
// Os limites da verificação — constantes nomeadas, nunca número no meio do caso
// ---------------------------------------------------------------------------

/**
 * Quantas vezes o ato pergunta pela confirmação antes de desistir, com os limites de **produção**.
 *
 * O número é escrito à mão, e não derivado das constantes importadas: derivá-lo poria o artefato sob
 * prova nos dois lados da igualdade, e a asserção passaria a não poder falhar (AP-29). Ele sai da
 * aritmética dos dois limites publicados — `12_000 / 1_500` dá **oito** esperas, e a primeira
 * pergunta acontece antes da primeira espera —, e é por isso que alterar qualquer um dos dois reprova
 * o CT-917 (c).
 */
const SONDAGENS_ATE_O_TETO = 9;

/** Em qual sondagem a confirmação vira positiva no CT-917 — o dado que o card fixa. */
const SONDAGEM_QUE_CONFIRMA_NO_CT917 = 3;

/** Em qual sondagem o provedor **recusa a pergunta** no CT-917 (f) — a segunda, não a primeira. */
const SONDAGEM_QUE_RECUSA_NO_CT917F = 2;

/**
 * Quanto o relógio avança a cada chamada à porta no CT-917 (g) — o que estoura o **teto duro**.
 *
 * O número é escrito à mão, e não derivado do artefato, pela mesma razão de {@link
 * SONDAGENS_ATE_O_TETO}: o teto do ato composto **não é publicado** — e não deve ser, por decisão
 * registrada no docblock dele —, de modo que derivá-lo aqui exigiria republicá-lo e poria o artefato
 * nos dois lados da igualdade.
 *
 * Ele vale mais da metade do teto duro de trinta segundos: duas chamadas ao provedor bastam para
 * atravessá-lo, e nenhuma delas depende da espera entre sondagens. É por isso que **afrouxar o teto
 * duro reprova o CT-917 (g)** — com um teto maior, o ato seguiria e emitiria.
 */
const AVANCO_QUE_ESTOURA_O_TETO_DURO_MS = 20_000;

// ---------------------------------------------------------------------------
// O arranjo — a cobrança, o cadastro e os textos, escritos por extenso
// ---------------------------------------------------------------------------

/** O código da cobrança sob ato — a chave exposta, na forma que o produto publica (ADR-0017). */
const CODIGO_DA_COBRANCA = 'COB-2026-0000917';

/** O número que o provedor atribuíra ao boleto **anterior** — o que a revogação retira. */
const TITULO_ANTERIOR = 'T-000000000000000917';

/** O identificador que o produto compusera para o boleto anterior — 18 posições (ADR-0033). */
const IDENTIFICADOR_ANTERIOR = '000000000000000917';

/** O identificador que o contador devolve para o boleto **novo** — distinto do anterior. */
const IDENTIFICADOR_NOVO = '000000000000000918';

/** O nome do arquivo que a guarda devolve — derivado do código, como a guarda de produção o deriva. */
const ARQUIVO_DO_BOLETO = `${CODIGO_DA_COBRANCA}.pdf`;

/** O que o dublê antepõe aos bytes do documento, para que eles sejam reconhecíveis. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** O texto com que o provedor recusa a emissão no CT-917 (b) — preservado byte a byte (RN-15). */
const RECUSA_DA_EMISSAO = 'valor do titulo abaixo do minimo aceito';

/** O texto com que o provedor recusa o **pedido** de revogação no CT-917 (e) — byte a byte (RN-15). */
const RECUSA_DO_PEDIDO_DE_REVOGACAO = 'titulo ja liquidado nao admite baixa';

/** O texto com que o provedor recusa a **pergunta** pela confirmação no CT-917 (f) — RN-15. */
const RECUSA_DA_SONDAGEM = 'consulta indisponivel para o convenio informado';

/** O que o pedido de emissão carrega da cobrança — os três fatos que a seleção não traz. */
const DADOS_DA_COBRANCA: DadosDaCobrancaAEmitir = {
  valor: 1500,
  vencimento: '2026-06-10',
  locatario: {
    nome: 'Locatário da reemissão',
    documento: '12345678901',
    logradouro: 'Rua das Acácias',
    numero: '300',
    complemento: null,
    bairro: 'Centro',
    cidade: 'Teresina',
    estado: 'PI',
    cep: '64000000',
  },
};

/**
 * O segredo que atravessa a porta, opaco (ADR-0032).
 *
 * Construído pelo caminho público de `@sysloc/shared`, e nada aqui o abre: quem o abriria é o
 * adaptador de produção, que este arquivo não constrói.
 */
const SEGREDO_DA_EMPRESA = criarSegredoOperavel({
  material: Buffer.from('material-de-verificacao'),
  senha: 'senha-de-verificacao',
});

/** A empresa em nome de quem o ato acontece — o ato no provedor, jamais um filtro de consulta. */
const EMPRESA_DO_ATO = '11111111-1111-4111-8111-111111111111';

// ---------------------------------------------------------------------------
// O que se registra — agnóstico, sem filtrar por tipo
// ---------------------------------------------------------------------------

/** Uma operação da porta, no nome pelo qual a interface a declara. */
type OperacaoDaPorta = keyof AdaptadorCobrancaBancaria;

/** Um efeito sobre o dado ou sobre os bytes — o que o ato mandou gravar ou apagar. */
type EfeitoDeDados = 'REVOGACAO_GRAVADA' | 'ARQUIVO_APAGADO' | 'BOLETO_GRAVADO';

/**
 * O que a cobrança carrega de boleto, como a linha do banco o carregaria.
 *
 * Ela é **mutável de propósito**: são as portas de dados que a alteram, e é essa alteração — feita
 * porque o ato as chamou — que o retrato do instante de `emitir` observa.
 */
interface EstadoDaCobranca {
  numeroDoTituloNoProvedor: string | null;
  linhaDigitavel: string | null;
  codigoDeBarras: string | null;
  identificadorNoProvedor: string | null;
  caminhoDoArquivo: string | null;
}

/**
 * O que o caso escolhe do arranjo — e nada além.
 *
 * Os três últimos são **opcionais e valem o caminho normal quando omitidos**, e a assimetria é
 * deliberada: eles existem para alcançar ramos de falha que só três dos oito casos exercitam, e
 * torná-los obrigatórios faria cada caso repetir o desfecho que ele não está medindo — ruído que
 * esconde justamente o eixo que o caso escolheu.
 */
interface ArranjoDaReemissao {
  /** O boleto vivo, ou `null` quando a cobrança não tem nenhum. */
  readonly numeroDoTituloVivo: string | null;
  /** Em qual sondagem a confirmação vira positiva; `null` quando ela nunca vira. */
  readonly sondagemQueConfirma: number | null;
  /** O que o provedor responde ao pedido de emissão. */
  readonly emissao: 'ACEITA' | 'RECUSADA';
  /** O que o provedor responde ao **pedido** de revogação; omitido, ele aceita. */
  readonly pedidoDeRevogacao?: 'ACEITO' | 'RECUSADO';
  /**
   * Em qual sondagem o provedor **recusa a pergunta**; omitido, ele nunca recusa.
   *
   * ⚠️ Ele recusa **naquela** sondagem, e não a partir dela: as seguintes voltam a responder *"ainda
   * não"*. A escolha é o que torna o caso do ramo seguro — um ato que ignorasse a recusa e seguisse
   * perguntando chegaria ao teto e reprovaria pela contagem, em vez de girar sem fim.
   */
  readonly sondagemQueRecusa?: number;
  /** Quanto o relógio avança a **cada chamada à porta**; omitido, ele só avança pelas esperas. */
  readonly avancoPorChamadaMs?: number;
}

/** O ambiente montado — o trabalho pronto e tudo o que o caso observa depois. */
interface AmbienteDaReemissao {
  readonly trabalho: TrabalhoDaReemissao;
  /** Toda operação recebida pela porta, na ordem — **sem filtro**. */
  readonly operacoes: OperacaoDaPorta[];
  /** Todo efeito sobre dado ou bytes, na ordem — **sem filtro**. */
  readonly efeitos: EfeitoDeDados[];
  /** O estado da cobrança **no instante** de cada `emitir` — a janela dos dois boletos. */
  readonly retratosAoEmitir: EstadoDaCobranca[];
  /** O estado da cobrança ao fim do ato. */
  readonly cobranca: EstadoDaCobranca;
  /** Os bytes guardados, por código de cobrança. */
  readonly arquivos: Map<string, Buffer>;
}

/**
 * A operação que o ato **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: ver o cabeçalho.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`a reemissão chamou uma operação que ela não deve chamar: ${nome}`);
  };
}

/**
 * Monta o ambiente inteiro — as portas, o relógio e a cobrança em memória.
 *
 * O relógio começa em zero e **só avança pela espera**, que é o que a assinatura injeta: nenhum
 * `Date.now`, nenhum agendamento do runtime, nenhuma pausa real. O teto de doze segundos é
 * atravessado em milissegundos porque cada espera adianta o relógio pelo intervalo pedido.
 */
function montarAmbiente(arranjo: ArranjoDaReemissao): AmbienteDaReemissao {
  const operacoes: OperacaoDaPorta[] = [];
  const efeitos: EfeitoDeDados[] = [];
  const retratosAoEmitir: EstadoDaCobranca[] = [];
  const arquivos = new Map<string, Buffer>();

  const cobranca: EstadoDaCobranca = {
    numeroDoTituloNoProvedor: arranjo.numeroDoTituloVivo,
    linhaDigitavel: arranjo.numeroDoTituloVivo === null ? null : `L-${IDENTIFICADOR_ANTERIOR}`,
    codigoDeBarras: arranjo.numeroDoTituloVivo === null ? null : `B-${IDENTIFICADOR_ANTERIOR}`,
    identificadorNoProvedor: arranjo.numeroDoTituloVivo === null ? null : IDENTIFICADOR_ANTERIOR,
    caminhoDoArquivo: arranjo.numeroDoTituloVivo === null ? null : ARQUIVO_DO_BOLETO,
  };

  if (arranjo.numeroDoTituloVivo !== null) {
    arquivos.set(
      CODIGO_DA_COBRANCA,
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${IDENTIFICADOR_ANTERIOR}`),
    );
  }

  let instante = 0;
  let sondagens = 0;

  /**
   * O tempo que a chamada ao provedor consumiu — cobrado **depois** de a operação ser registrada.
   *
   * Em produção o relógio anda durante a chamada; aqui ele anda pelo que o caso declarou, e zero é o
   * padrão. É este avanço, e não a espera entre sondagens, que alcança o teto duro do ato composto.
   */
  const cobrarOTempoDaChamada = (): void => {
    instante += arranjo.avancoPorChamadaMs ?? 0;
  };

  const adaptador: AdaptadorCobrancaBancaria = {
    solicitarRevogacaoDeBoleto: async () => {
      operacoes.push('solicitarRevogacaoDeBoleto');
      cobrarOTempoDaChamada();

      if (arranjo.pedidoDeRevogacao === 'RECUSADO') {
        return { aceito: false, classe: 'DA_COBRANCA', motivo: RECUSA_DO_PEDIDO_DE_REVOGACAO };
      }

      return { aceito: true, valor: undefined };
    },
    confirmarRevogacaoDeBoleto: async () => {
      operacoes.push('confirmarRevogacaoDeBoleto');
      cobrarOTempoDaChamada();
      sondagens += 1;

      // A recusa acontece NAQUELA sondagem, e não a partir dela — ver o docblock do arranjo.
      if (sondagens === arranjo.sondagemQueRecusa) {
        return { aceito: false, classe: 'DA_EMPRESA', motivo: RECUSA_DA_SONDAGEM };
      }

      return { aceito: true, valor: sondagens === arranjo.sondagemQueConfirma };
    },
    emitir: async (pedido) => {
      operacoes.push('emitir');
      cobrarOTempoDaChamada();
      // O retrato é tirado DE DENTRO da chamada, do mesmo estado que as portas de dados mutam: é
      // daqui, e de nenhum outro ponto, que se observa se os dois boletos coexistiram.
      retratosAoEmitir.push({ ...cobranca });

      if (arranjo.emissao === 'RECUSADA') {
        return { aceito: false, classe: 'DA_COBRANCA', motivo: RECUSA_DA_EMISSAO };
      }

      // O boleto é derivado do identificador RECEBIDO no pedido, e não de um valor combinado: é isso
      // que permite afirmar que o identificador devolvido é o que foi enviado.
      return {
        aceito: true,
        valor: {
          numeroDoTituloNoProvedor: `T-${pedido.identificadorNoProvedor}`,
          linhaDigitavel: `L-${pedido.identificadorNoProvedor}`,
          codigoDeBarras: `B-${pedido.identificadorNoProvedor}`,
          documento: Buffer.from(`${PREFIXO_DO_DOCUMENTO}${pedido.identificadorNoProvedor}`),
        },
      };
    },
    consultarSituacao: operacaoNaoEsperada('consultarSituacao'),
  };

  const guarda: GuardaDeBoletos = {
    gravar: async (codigo, bytes) => {
      arquivos.set(codigo, Buffer.from(bytes));
      return `${codigo}.pdf`;
    },
    ler: operacaoNaoEsperada('ler'),
    apagar: async (codigo) => {
      arquivos.delete(codigo);
      efeitos.push('ARQUIVO_APAGADO');
    },
    // A reemissão apaga UM boleto, pelo código; o expurgo do acervo é rotina agendada e não tem o
    // que fazer aqui. Levantar nomeando é o que faz uma passada que o chamasse reprovar no ponto.
    expurgarBoletosVencidos: operacaoNaoEsperada('expurgarBoletosVencidos'),
  };

  const trabalho: TrabalhoDaReemissao = {
    empresaId: EMPRESA_DO_ATO,
    segredo: SEGREDO_DA_EMPRESA,
    identidade: IDENTIDADE_DE_TESTE,
    cobranca: {
      codigo: CODIGO_DA_COBRANCA,
      numeroDoTituloNoProvedor: arranjo.numeroDoTituloVivo,
    },
    adaptador,
    guarda,
    identificador: async () => IDENTIFICADOR_NOVO,
    dados: async () => DADOS_DA_COBRANCA,
    // Espelha `revogarBoleto` da camada de dados: apaga os campos do boleto e **preserva** o
    // identificador perante o provedor. Ver o cabeçalho para por que este arquivo não afirma a
    // contagem de colunas.
    gravarRevogacao: async () => {
      cobranca.numeroDoTituloNoProvedor = null;
      cobranca.linhaDigitavel = null;
      cobranca.codigoDeBarras = null;
      cobranca.caminhoDoArquivo = null;
      efeitos.push('REVOGACAO_GRAVADA');
    },
    gravarEmissao: async (boleto) => {
      cobranca.numeroDoTituloNoProvedor = boleto.numeroDoTituloNoProvedor;
      cobranca.linhaDigitavel = boleto.linhaDigitavel;
      cobranca.codigoDeBarras = boleto.codigoDeBarras;
      cobranca.identificadorNoProvedor = boleto.identificadorNoProvedor;
      cobranca.caminhoDoArquivo = boleto.caminhoDoArquivo;
      efeitos.push('BOLETO_GRAVADO');
    },
    esperar: async (milissegundos) => {
      instante += milissegundos;
    },
    agora: () => instante,
  };

  return { trabalho, operacoes, efeitos, retratosAoEmitir, cobranca, arquivos };
}

/** A cobrança recém-emitida, como o ambiente a deixa no caminho feliz — escrita por extenso. */
const COBRANCA_COM_BOLETO_NOVO: EstadoDaCobranca = {
  numeroDoTituloNoProvedor: `T-${IDENTIFICADOR_NOVO}`,
  linhaDigitavel: `L-${IDENTIFICADOR_NOVO}`,
  codigoDeBarras: `B-${IDENTIFICADOR_NOVO}`,
  identificadorNoProvedor: IDENTIFICADOR_NOVO,
  caminhoDoArquivo: ARQUIVO_DO_BOLETO,
};

/**
 * A cobrança **intacta**, com o boleto anterior — o estado que todo desfecho sem revogação preserva.
 *
 * Escrita por extenso, e **não** derivada do que `montarAmbiente` monta: derivá-la faria a asserção
 * comparar a montagem consigo mesma e perderia a metade que importa — que o ato **não mutou** o que
 * não devia. É o mesmo molde de {@link COBRANCA_COM_BOLETO_NOVO}.
 */
const COBRANCA_COM_O_BOLETO_ANTERIOR: EstadoDaCobranca = {
  numeroDoTituloNoProvedor: TITULO_ANTERIOR,
  linhaDigitavel: `L-${IDENTIFICADOR_ANTERIOR}`,
  codigoDeBarras: `B-${IDENTIFICADOR_ANTERIOR}`,
  identificadorNoProvedor: IDENTIFICADOR_ANTERIOR,
  caminhoDoArquivo: ARQUIVO_DO_BOLETO,
};

/**
 * A cobrança **sem boleto** — o que a revogação confirmada deixa quando a emissão não sai (CA-06).
 *
 * ⚠️ `identificadorNoProvedor` **sobrevive**, e a sobrevivência é conteúdo: ela espelha
 * `revogarBoleto` da camada de dados, que o preserva por ser a chave de correlação por onde uma
 * notícia atrasada do provedor ainda se liga a esta cobrança — e que não se recompõe.
 */
const COBRANCA_SEM_BOLETO: EstadoDaCobranca = {
  numeroDoTituloNoProvedor: null,
  linhaDigitavel: null,
  codigoDeBarras: null,
  identificadorNoProvedor: IDENTIFICADOR_ANTERIOR,
  caminhoDoArquivo: null,
};

// ===========================================================================
// CT-917 — revogar, confirmar e só então emitir, nesta ordem
// ===========================================================================

describe('CT-917 — a reemissão revoga o boleto, confirma e só então emite — nesta ordem', () => {
  it('CT-917 — a sequência é revogar, três confirmações e emitir, e o anterior não vive mais', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: SONDAGEM_QUE_CONFIRMA_NO_CT917,
      emissao: 'ACEITA',
    });

    const desfecho: DesfechoDaReemissao = await reemitirBoleto(ambiente.trabalho);

    // Igualdade de LISTA, e não de conjunto: a ordem é o invariante, e um conjunto perderia
    // exatamente o que este caso existe para provar. Reprova nas duas direções — a operação a mais,
    // a que falta, e a que trocou de lugar.
    //
    // ⚠️ É ELA, sozinha, que prova o passo 3 do card (`emitir` depois do último confirmar): fixada a
    // lista inteira, os dois índices estão fixados junto, e uma segunda asserção sobre eles seria
    // consequência aritmética desta — incapaz de reprovar, que é o AP-29.
    expect(ambiente.operacoes).toEqual([
      'solicitarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
      'emitir',
    ]);

    // ⚠️ ESTA é a asserção que discrimina "emitiu depois da confirmação" de "emitiu antes dela": o
    // retrato foi tirado DENTRO da chamada a `emitir`, e mostra a cobrança já sem título. Sem ela, um
    // ato que pedisse a revogação, emitisse em seguida e só então gravasse produziria a mesma
    // sequência acima com a janela dos dois boletos aberta.
    expect(ambiente.retratosAoEmitir).toEqual([
      {
        numeroDoTituloNoProvedor: null,
        linhaDigitavel: null,
        codigoDeBarras: null,
        identificadorNoProvedor: IDENTIFICADOR_ANTERIOR,
        caminhoDoArquivo: null,
      },
    ]);

    // Os efeitos, na ordem: o fato de negócio, o arquivo antigo, e só então o boleto novo.
    expect(ambiente.efeitos).toEqual(['REVOGACAO_GRAVADA', 'ARQUIVO_APAGADO', 'BOLETO_GRAVADO']);

    // O ato devolve os DOIS números do boleto novo — objeto inteiro, e o identificador é exatamente o
    // que o contador entregou e o pedido levou.
    expect(desfecho).toEqual({
      numeroDoTituloNoProvedor: `T-${IDENTIFICADOR_NOVO}`,
      identificadorNoProvedor: IDENTIFICADOR_NOVO,
    });

    // E o boleto anterior NÃO consta como vivo: o estado inteiro, campo a campo, é o do novo.
    expect(ambiente.cobranca).toEqual(COBRANCA_COM_BOLETO_NOVO);

    // Os bytes guardados são os do boleto novo — o arquivo do anterior não sobreviveu ao ato.
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toEqual(
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${IDENTIFICADOR_NOVO}`),
    );
  });
});

// ===========================================================================
// CT-917 (b) — revogação confirmada e emissão recusada: a cobrança fica SEM boleto
// ===========================================================================

describe('CT-917 (b) — revogação confirmada e emissão recusada deixam a cobrança sem boleto', () => {
  it('CT-917 (b) — a revogação foi gravada, o arquivo apagado, e a falha nomeia a cobrança', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: 1,
      emissao: 'RECUSADA',
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    // O tipo específico, nunca "ocorreu um erro".
    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // A falha NOMEIA a cobrança, e declara o estado em que ela ficou — objeto inteiro.
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.detalhes).toEqual({ boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' });

    // O motivo do provedor viaja BYTE A BYTE como diagnóstico (RN-15) — e não entra na mensagem.
    expect(falha.motivo).toBe(RECUSA_DA_EMISSAO);
    expect(falha.message).toBe(
      `a reemissão do boleto não se completou para a cobrança ${CODIGO_DA_COBRANCA}`,
    );

    // ⚠️ A lista de efeitos é o que separa este desfecho do CT-917 (c): a revogação foi gravada e o
    // arquivo apagado, e emissão nenhuma foi gravada.
    expect(ambiente.efeitos).toEqual(['REVOGACAO_GRAVADA', 'ARQUIVO_APAGADO']);

    // A cobrança ficou SEM boleto — é o desfecho declarado da CA-06, e o lote seguinte a recolhe.
    expect(ambiente.cobranca).toEqual(COBRANCA_SEM_BOLETO);

    // E os bytes do boleto revogado saíram da guarda.
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toBeUndefined();

    // A sequência inteira, por igualdade de lista: uma confirmação bastou, e a emissão foi tentada
    // uma vez só — nada é repetido depois da recusa.
    expect(ambiente.operacoes).toEqual([
      'solicitarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
      'emitir',
    ]);
  });
});

// ===========================================================================
// CT-917 (c) — a revogação que não confirma no teto não apaga NADA
// ===========================================================================

describe('CT-917 (c) — a revogação não confirmada dentro do teto não apaga nada', () => {
  it('CT-917 (c) — nove sondagens, nenhum emitir, nenhum efeito, e o desfecho é declarado', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: null,
      emissao: 'ACEITA',
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // O desfecho DECLARADO: a revogação foi pedida e não confirmou. Nada sobre boleto — porque o
    // anterior continua sendo o único.
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.detalhes).toEqual({ revogacao: 'PEDIDA_NAO_CONFIRMADA' });

    // Quem interrompeu foi o TETO, e não o provedor: não há motivo a preservar.
    expect(falha.motivo).toBeNull();

    // ⚠️ A CONTAGEM EXATA é o que separa "o teto encerra a sondagem" de "o teto é decorativo": ela é
    // a que os dois limites publicados produzem, e alterar qualquer um deles reprova aqui.
    expect(ambiente.operacoes).toEqual([
      'solicitarRevogacaoDeBoleto',
      ...Array.from({ length: SONDAGENS_ATE_O_TETO }, () => 'confirmarRevogacaoDeBoleto'),
    ]);

    // Âncora do que os limites valem: a espera consumiu o teto em passos do intervalo publicado. Sem
    // esta linha, a contagem acima poderia ser lida como número mágico.
    expect(INTERVALO_ENTRE_SONDAS_MS * (SONDAGENS_ATE_O_TETO - 1)).toBe(
      TETO_DA_CONFIRMACAO_DA_REVOGACAO_MS,
    );

    // ⚠️ NADA foi apagado, e é isto que distingue este desfecho do CA-06: efeito de dados nenhum, e o
    // boleto anterior intacto, campo a campo.
    expect(ambiente.efeitos).toEqual([]);
    expect(ambiente.cobranca).toEqual(COBRANCA_COM_O_BOLETO_ANTERIOR);

    // Os bytes do boleto anterior continuam guardados.
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toEqual(
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${IDENTIFICADOR_ANTERIOR}`),
    );

    // Nenhum retrato foi tirado, e isso NÃO ganha asserção própria: o retrato só nasce dentro de
    // `emitir`, e a igualdade de lista acima já afirma uma sequência sem ele — ver a regra no
    // cabeçalho, "O que este arquivo NÃO afirma duas vezes".
  });
});

// ===========================================================================
// CT-917 (d) — sem boleto vivo, o ato emite como da primeira vez (CA-18)
// ===========================================================================

describe('CT-917 (d) — sem boleto vivo não há etapa de revogação', () => {
  it('CT-917 (d) — a porta recebe exatamente [emitir], e nada é revogado nem apagado', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: null,
      sondagemQueConfirma: null,
      emissao: 'ACEITA',
    });

    const desfecho = await reemitirBoleto(ambiente.trabalho);

    // ⚠️ Igualdade de lista com UM item: uma asserção de que `emitir` está presente passaria num ato
    // que pedisse a revogação de um título nulo antes de emitir.
    expect(ambiente.operacoes).toEqual(['emitir']);

    // O único efeito é a gravação do boleto — nada foi revogado, nada foi apagado.
    expect(ambiente.efeitos).toEqual(['BOLETO_GRAVADO']);

    // E no instante de emitir a cobrança estava vazia, como uma que nunca teve boleto.
    expect(ambiente.retratosAoEmitir).toEqual([
      {
        numeroDoTituloNoProvedor: null,
        linhaDigitavel: null,
        codigoDeBarras: null,
        identificadorNoProvedor: null,
        caminhoDoArquivo: null,
      },
    ]);

    expect(desfecho).toEqual({
      numeroDoTituloNoProvedor: `T-${IDENTIFICADOR_NOVO}`,
      identificadorNoProvedor: IDENTIFICADOR_NOVO,
    });
    expect(ambiente.cobranca).toEqual(COBRANCA_COM_BOLETO_NOVO);
  });
});

// ===========================================================================
// CT-917 (e) — o PEDIDO de revogação recusado encerra o ato na primeira operação
// ===========================================================================

describe('CT-917 (e) — o pedido de revogação recusado encerra o ato sem sondar e sem emitir', () => {
  it('CT-917 (e) — a porta recebe só o pedido, o motivo do provedor sobe intacto, e nada muda', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: null,
      emissao: 'ACEITA',
      pedidoDeRevogacao: 'RECUSADO',
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // ⚠️ Igualdade de lista com UM item: um ato que sondasse a confirmação de um pedido que o
    // provedor não aceitou acrescentaria confirmações aqui, e um que seguisse para a emissão
    // acrescentaria `emitir`.
    expect(ambiente.operacoes).toEqual(['solicitarRevogacaoDeBoleto']);

    // O desfecho declarado é o MESMO da revogação não confirmada — e é a leitura correta: a
    // revogação foi pedida e não se confirmou. O que separa os dois é o `motivo`.
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.detalhes).toEqual({ revogacao: 'PEDIDA_NAO_CONFIRMADA' });

    // ⚠️ O motivo do provedor viaja BYTE A BYTE (RN-15) — é ele que distingue "o provedor recusou o
    // pedido" de "o teto venceu", que devolve `null`. Nada aqui o interpreta.
    expect(falha.motivo).toBe(RECUSA_DO_PEDIDO_DE_REVOGACAO);
    expect(falha.message).toBe(
      `a reemissão do boleto não se completou para a cobrança ${CODIGO_DA_COBRANCA}`,
    );

    // NADA foi apagado nem gravado: o boleto anterior continua sendo o único, campo a campo.
    expect(ambiente.efeitos).toEqual([]);
    expect(ambiente.cobranca).toEqual(COBRANCA_COM_O_BOLETO_ANTERIOR);
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toEqual(
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${IDENTIFICADOR_ANTERIOR}`),
    );
  });
});

// ===========================================================================
// CT-917 (f) — o desfecho NÃO ACEITO da sondagem interrompe o laço, em vez de insistir
// ===========================================================================

describe('CT-917 (f) — o desfecho não aceito da sondagem interrompe o laço', () => {
  it('CT-917 (f) — a segunda pergunta é a última, e o motivo do provedor sobe em lugar do nulo', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: null,
      sondagemQueRecusa: SONDAGEM_QUE_RECUSA_NO_CT917F,
      emissao: 'ACEITA',
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // ⚠️ ESTA é a asserção que discrimina "interrompe" de "insiste": a sondagem parou na segunda
    // pergunta, e o dublê volta a responder "ainda não" da terceira em diante — de modo que um laço
    // que ignorasse a recusa correria até o teto e colheria NOVE confirmações aqui.
    expect(ambiente.operacoes).toEqual([
      'solicitarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
    ]);

    // ⚠️ E o motivo é a segunda metade da mesma discriminação: quem interrompeu foi o provedor, e o
    // texto dele sobe intacto (RN-15). Chegar ao teto devolveria `null`, como no CT-917 (c).
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.detalhes).toEqual({ revogacao: 'PEDIDA_NAO_CONFIRMADA' });
    expect(falha.motivo).toBe(RECUSA_DA_SONDAGEM);

    // Nada foi apagado — a recusa da pergunta não é confirmação de coisa alguma.
    expect(ambiente.efeitos).toEqual([]);
    expect(ambiente.cobranca).toEqual(COBRANCA_COM_O_BOLETO_ANTERIOR);
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toEqual(
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${IDENTIFICADOR_ANTERIOR}`),
    );
  });
});

// ===========================================================================
// CT-917 (g) — vencido o TETO DURO do ato, não se emite nem com a revogação confirmada
// ===========================================================================

describe('CT-917 (g) — o teto duro do ato composto barra a emissão', () => {
  it('CT-917 (g) — a revogação confirmou, o teto venceu, e emitir não é invocado', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: TITULO_ANTERIOR,
      sondagemQueConfirma: 1,
      emissao: 'ACEITA',
      // O relógio anda durante as chamadas ao provedor, como anda em produção: duas chamadas bastam
      // para atravessar o teto duro, e nenhuma espera entre sondagens participa disso.
      avancoPorChamadaMs: AVANCO_QUE_ESTOURA_O_TETO_DURO_MS,
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // ⚠️ ESTA é a asserção que discrimina "o teto duro barra" de "o teto duro é decorativo": a
    // confirmação foi POSITIVA na primeira pergunta, e ainda assim `emitir` não aparece. Sem o teto,
    // o ato seguiria e a lista teria um terceiro item.
    expect(ambiente.operacoes).toEqual([
      'solicitarRevogacaoDeBoleto',
      'confirmarRevogacaoDeBoleto',
    ]);

    // A revogação, essa, já tinha acontecido — e é isso que faz o desfecho ser o da CA-06.
    expect(ambiente.efeitos).toEqual(['REVOGACAO_GRAVADA', 'ARQUIVO_APAGADO']);
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.detalhes).toEqual({ boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' });

    // Quem interrompeu foi o TETO, e não o provedor: não há texto a preservar.
    expect(falha.motivo).toBeNull();

    // A cobrança ficou sem boleto, e os bytes do revogado saíram da guarda.
    expect(ambiente.cobranca).toEqual(COBRANCA_SEM_BOLETO);
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toBeUndefined();
  });
});

// ===========================================================================
// CT-917 (h) — sem boleto vivo, a emissão recusada declara a TERCEIRA forma dos detalhes
// ===========================================================================

describe('CT-917 (h) — sem boleto vivo, a emissão recusada não declara revogação alguma', () => {
  it('CT-917 (h) — os detalhes são exatamente { boleto: SEM_BOLETO }, sem revogacao', async () => {
    const ambiente = montarAmbiente({
      numeroDoTituloVivo: null,
      sondagemQueConfirma: null,
      emissao: 'RECUSADA',
    });

    const falha = await reemitirBoleto(ambiente.trabalho).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroDeReemissaoIncompleta);
    if (!(falha instanceof ErroDeReemissaoIncompleta)) {
      throw new Error('o ato precisa falhar com ErroDeReemissaoIncompleta');
    }

    // ⚠️ O OBJETO INTEIRO é o que separa esta forma da CA-06: a chave `revogacao` está **ausente**,
    // porque revogação alguma aconteceu, e declarar uma seria mentir sobre o que o ato fez. Uma
    // asserção sobre a chave `boleto` sozinha aprovaria as duas formas — e é sobre esta distinção
    // que a borda da T13 ramifica.
    expect(falha.detalhes).toEqual({ boleto: 'SEM_BOLETO' });
    expect(falha.codigoDaCobranca).toBe(CODIGO_DA_COBRANCA);
    expect(falha.motivo).toBe(RECUSA_DA_EMISSAO);

    // Não houve etapa de revogação, e a emissão recusada não grava nada.
    expect(ambiente.operacoes).toEqual(['emitir']);
    expect(ambiente.efeitos).toEqual([]);
    expect(ambiente.cobranca).toEqual({
      numeroDoTituloNoProvedor: null,
      linhaDigitavel: null,
      codigoDeBarras: null,
      identificadorNoProvedor: null,
      caminhoDoArquivo: null,
    });
    expect(ambiente.arquivos.get(CODIGO_DA_COBRANCA)).toBeUndefined();
  });
});
