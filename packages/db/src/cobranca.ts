/**
 * Cobrança — a **porta única** de leitura e escrita do fato financeiro do produto.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./contrato.ts}, {@link ./imovel.ts} e {@link ./cadastro-de-pessoa.ts} já
 * registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.cobranca` numa cadeia sem
 * importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável. Toda
 * instrução que o ciclo de vida da cobrança precisa vive aqui — **inclusive** a emissão do número da
 * série.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. Nem mesmo as duas
 * da série: elas invocam funções do banco pelo executor que receberam.
 *
 * ---------------------------------------------------------------------------
 * A ASSIMETRIA É O MECANISMO: escreve na TABELA, lê na VISÃO
 * ---------------------------------------------------------------------------
 *
 * {@link criarCobranca}, {@link criarCobrancasEmLote}, {@link acusarPagamentoDeCobranca},
 * {@link cancelarCobranca} e {@link cancelarCobrancasDoContrato} gravam em
 * `negocio.cobranca`; {@link listarCobrancas} e {@link localizarCobranca} leem
 * `negocio.cobranca_derivada`. **Não há neste arquivo uma única leitura de cobrança que selecione da
 * tabela**, e é essa ausência que torna a unicidade da derivação verificável em vez de prometida —
 * ver o marcador `DECISÃO FECHADA` adiante.
 *
 * O pagamento é a única escrita que **lê a visão dentro da própria instrução**, e a assimetria é o
 * mecanismo do carimbo: ver {@link acusarPagamentoDeCobranca}.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA DERIVAÇÃO DE ESTADO OU DE MORA EXISTE EM TypeScript (ADR-0022, ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * `status`, `dias_atraso`, `valor_multa`, `valor_juros` e `valor_total` chegam **prontos** da visão,
 * e este arquivo não os recalcula, não os corrige e não os compõe. A ADR-0023 é literal: a derivação
 * que participa de seleção — filtrar as vencidas, ordenar por vencimento, paginar — e que compõe
 * aritmética monetária **vive no banco**. Reproduzi-la aqui teria os dois preços que ela nomeia:
 * trazer a carteira inteira para a memória antes de filtrar, e devolver o dinheiro ao ponto
 * flutuante do JavaScript, onde `1234.56 * 0.01 / 30 * 17` não é o que o `numeric` calcula.
 *
 * A única aritmética deste arquivo é a conversão de `numeric` em número na saída
 * ({@link cobrancaPublicada}), que é transporte e não derivação.
 *
 * ---------------------------------------------------------------------------
 * A SÉRIE É EMITIDA PELO BANCO, EM DUAS FUNÇÕES SEPARADAS (ADR-0015, ADR-0020)
 * ---------------------------------------------------------------------------
 *
 * {@link garantirContadorDeCobranca} e {@link emitirNumeroDeCobranca} são **duas**, e a separação é
 * a decisão — mais {@link emitirNumerosDeCobranca}, que é a **mesma** emissão pedida N vezes numa ida
 * ao banco só, para a ativação do contrato (T9). O raciocínio inteiro está no cabeçalho de
 * {@link ./contrato.ts} e na §4 de
 * `migracoes/0008_seguranca_contrato.sql`, **referenciado daqui e não recopiado**: a borda as chama
 * em duas unidades de trabalho sequenciais, e fundi-las faria o desfazimento apagar a sequência
 * recém-criada, de modo que a cobrança seguinte tomaria `nextval = 1` **outra vez** — número
 * reusado, contra a cláusula literal da ADR-0015.
 *
 * Nenhuma das duas aceita `empresa_id` por parâmetro: elas leem o contexto por dentro e levantam sem
 * ele. Como rodam com os direitos da dona (`SECURITY DEFINER`), aceitar a empresa por argumento
 * daria à aplicação exatamente o poder que a RLS lhe tira. **A aplicação nunca toca a sequência**
 * (ADR-0020, e o marcador `DECISÃO FECHADA` de `migracoes/0010_seguranca_cobranca.sql` §6).
 *
 * O ano do escopo é o da **emissão**, e ele viaja **junto do número** em `NumeroDaSerie`:
 * {@link criarCobranca} **não o relê**. Uma segunda leitura seria justamente o que permite os dois
 * discordarem na virada do ano, que cabe entre as duas unidades sequenciais.
 *
 * ---------------------------------------------------------------------------
 * A UNICIDADE É DO BANCO — e não há leitura que decida se pode gravar
 * ---------------------------------------------------------------------------
 *
 * Uma restrição recusa a escrita deste arquivo, e ela tem tradução própria:
 * `cobranca_empresa_codigo_key` → {@link ErroDeCodigoDeCobrancaEmUso}. **Toda violação `23505` que
 * não seja dela é repassada intacta** — traduzir em bloco atribuiria à entrada do cliente uma
 * colisão que ele não causou, escondida atrás de um `422` plausível.
 *
 * **Não há leitura de conflito**, e a ausência é a decisão: o código foi emitido pelo servidor, o
 * cliente não o escolheu, e não há nada que ele possa corrigir — mesma razão, palavra por palavra,
 * de `gravarSobRestricaoDoCodigo` em {@link ./contrato.ts}. A escrita corre sob um `SAVEPOINT`
 * porque, no PostgreSQL, o erro coloca a transação em estado abortado e **qualquer** instrução
 * seguinte falha com `25P02`: sem o ponto de retorno, a composição maior que hospeda esta gravação
 * (a ativação que emite doze parcelas, na T9) morreria junto com a primeira recusa.
 *
 * ---------------------------------------------------------------------------
 * A CHAVE DA PORTA É O CÓDIGO (ADR-0017), e o UUID não sai daqui
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem série declarada, então a chave exposta é o **código legível**, e é por ele que
 * {@link localizarCobranca} alcança a linha. Diferente de `ContratoPersistido`, {@link LinhaDeCobranca}
 * **não publica `id`**: nada aponta para a cobrança — não há filha, não há porta estreita —, e um
 * segundo identificador que rota nenhuma aceita só existiria para ser confundido com o primeiro.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** As duas tabelas nascem com RLS **forçada**
 * (`migracoes/0010_seguranca_cobranca.sql`), e a visão é `security_invoker`, de modo que a política
 * é avaliada com os direitos de quem consulta. Não há aqui um `WHERE empresa_id = …` — a defesa em
 * profundidade que a `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é
 * `NOT NULL` e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal
 * das políticas, avaliada dentro da própria instrução. E a cobrança que apontasse para contrato de
 * **outra** empresa é impossível sem que nada aqui o confira: a chave estrangeira composta
 * `cobranca_contrato_empresa_fkey` recusa o par que não existe.
 */

// `ESTADOS_EM_ABERTO` é importado pela MESMA razão de `formatarCodigoDeCobranca`: a classificação
// *"quais estados estão em aberto"* é fato do contrato, e tem lar único ao lado do enum que o
// declara. Redigitar os dois rótulos aqui poria literal de `negocio.status_cobranca` em posição
// executável num fonte deste pacote — exatamente o que a unicidade da derivação (o marcador
// `DECISÃO FECHADA` adiante) existe para tornar verificável.
import {
  ESTADOS_EM_ABERTO,
  type EstadoDaCobranca,
  formatarCodigoDeCobranca,
  type NaturezaDeCobranca,
} from '@syslocbr/contracts';
import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** sobre as duas tabelas — nenhuma leitura deste arquivo o aplica, porque elas já têm
// política e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a
// **escrita**, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O tipo é da **decisão**, e não da entidade: `{ ano, numero }` é o par que a ADR-0020 obriga toda
// série declarada a fazer viajar junto, e ele já nasceu publicado pela porta do contrato. Declarar um
// gêmeo aqui daria dois nomes ao mesmo fato na superfície pública — a mesma razão pela qual
// `./contrato.ts` importa `OpcoesDeCirculacao` de `./conjunto.ts` em vez de redeclará-lo. O que se
// importa é o tipo: `contrato.ts` não é tocado.
import type { NumeroDaSerie } from './contrato.js';
// Mesmo critério da importação acima, e a mesma razão: `ParcelaDerivada` é o nome que o pacote **já
// publica** para os cinco fatos com que uma parcela de aluguel nasce, e o docblock dela declara por
// extenso que é *"exatamente `DadosDaCobranca` menos o `contratoId`"* — a coincidência foi deliberada
// na T8, justamente para que quem grava em lote receba o contrato uma vez e as parcelas N vezes.
// Declarar um gêmeo aqui daria dois nomes ao mesmo fato na superfície pública. O que se importa é o
// tipo: `derivacao-de-cobranca.ts` não é tocado, e a direção do grafo não muda — aquele módulo é puro
// e não importa nada deste.
import type { ParcelaDerivada } from './derivacao-de-cobranca.js';
// Os DOIS moldes têm **casa única** em `./moldes-de-formatacao.ts` — é o limiar de três do
// `CLAUDE.md` fechado no terceiro consumidor, e não a exportação lateral que deixava a declaração de
// `./envio-de-cobranca.ts` viva. O do instante desceu na T3 da fatia `emissao-e-conciliacao`; o da
// DATA desceu no fecho do débito `D7 · F4/T3`, e as três declarações que ele registrava — esta, a de
// `./envio-de-cobranca.ts` e a exportada por `./contrato.ts` — saíram no mesmo diff. Nenhum dos dois
// entra em `./index.ts`: são detalhe da camada de dados, e publicá-los daria a `apps/api` um formato
// para escolher.
import { FORMATO_ISO_DA_DATA, FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * A janela pedida da carteira, já validada na borda.
 *
 * O nome diverge do padrão `JanelaDe<Entidade>` das portas irmãs de propósito: `JanelaDeCobrancas` já
 * é **nome publicado** por `@syslocbr/contracts` (o esquema da janela com os três filtros), e dois
 * símbolos homônimos vindos de pacotes diferentes se encontrariam no mesmo `import` da borda.
 */
export interface JanelaDaCarteira {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * Os três recortes que a carteira admite (§4.1.1), todos **opcionais**.
 *
 * Ausência é *sem filtro*, e não um valor implícito. Os três são conferidos **no esquema** da borda
 * (`esquemaDaJanelaDeCobrancas`), de modo que o que chega aqui já pertence às uniões fechadas — esta
 * camada não repete a conferência, ela apenas compõe o predicado.
 *
 * O contrato é alcançado pelo **código legível**, e não pelo UUID: é a chave exposta dele (ADR-0017),
 * é o que a borda recebe na cadeia de consulta, e é a coluna que a visão publica na junção.
 */
export interface FiltrosDaCarteira {
  readonly contratoCodigo?: string;
  readonly status?: EstadoDaCobranca;
  readonly natureza?: NaturezaDeCobranca;
  /** Ponta inicial da janela de vencimento, **inclusiva** — `YYYY-MM-DD`. */
  readonly vencimentoDe?: string;
  /** Ponta final da janela de vencimento, **inclusiva** — `YYYY-MM-DD`. */
  readonly vencimentoAte?: string;
}

/**
 * Os campos que o lançamento informa — os mesmos da cobrança avulsa e da parcela derivada da
 * ativação.
 *
 * `codigo`, `status` e todo o desfecho (`pagoEm`, `valorPago`, `canceladoEm` e os quatro carimbos)
 * **não estão aqui**, e a ausência é o mecanismo: o código é emitido pela série, o estado é derivado
 * (ADR-0022) e o desfecho é escrito pelo ato que liquida — {@link acusarPagamentoDeCobranca} e
 * {@link cancelarCobranca}. Um caminho que os aceitasse por este tipo seria a segunda fonte de estado
 * que a fatia inteira existe para eliminar.
 *
 * `locatarioId` **também não está**, e essa ausência é a mais importante: ele sai da junção com o
 * contrato. A tabela do legado guarda as duas pontas e admite que elas discordem; aqui a incoerência
 * é estruturalmente impossível, porque não há segunda ponta a divergir.
 *
 * `contratoId` é o **UUID**, e não o código: a coluna é `uuid` e a chave estrangeira composta é
 * `(contrato_id, empresa_id)`. Quem traduz o código recebido do cliente no identificador interno é a
 * borda, com `localizarContrato` — e é essa tradução que produz o `404` de contrato inalcançável, que
 * esta camada não sabe emitir.
 *
 * As três datas são cadeias `YYYY-MM-DD`, e não `Date`: as colunas são `date`, e um objeto `Date`
 * reserializado com o fuso do processo desloca a data em um dia para metade dos fusos (§6.2).
 */
export interface DadosDaCobranca {
  readonly contratoId: string;
  readonly natureza: NaturezaDeCobranca;
  readonly referencia: string;
  readonly competencia: string;
  readonly dataVencimento: string;
  readonly valorOriginal: number;
}

/**
 * Os **dois** fatos que o ato de pagar informa — e nada mais.
 *
 * Multa, juros e os dois percentuais **não estão aqui**, e a ausência é o mecanismo do carimbo: eles
 * são copiados da visão dentro da própria instrução que grava o pagamento
 * ({@link acusarPagamentoDeCobranca}), de modo que não existe caminho pelo qual a borda — ou o cliente
 * dela — proponha um valor de mora. Aceitá-los por este tipo daria a quem paga o poder de escrever o
 * próprio recibo, e é a razão de `esquemaDoPagamentoDeCobranca` ter dois campos e não seis.
 *
 * `pagoEm` é cadeia `YYYY-MM-DD`, e não `Date`: a coluna é `date`, e um objeto `Date` reserializado
 * com o fuso do processo desloca a data em um dia para metade dos fusos (§6.2) — a mesma razão das
 * três datas de {@link DadosDaCobranca}.
 */
export interface DesfechoDoPagamento {
  readonly pagoEm: string;
  readonly valorPago: number;
}

/**
 * Uma linha de `negocio.cobranca_derivada`, na projeção que o contrato publica — **vinte e três
 * campos**.
 *
 * Os cinco derivados (`status`, `diasAtraso`, `valorMulta`, `valorJuros`, `valorTotal`) chegam da
 * visão e não são recalculados em lugar nenhum; os cinco anuláveis do **desfecho** têm `null` querendo
 * dizer *cobrança ainda aberta*.
 *
 * Os **cinco últimos** são a conciliação bancária, e eles chegaram na T6 da fatia
 * `emissao-e-conciliacao`: `esquemaDaCobranca` já os publicava desde a T1 (18 → 23 campos), e até aqui
 * a borda os compunha como `null` fixo, sob o débito que a T1 daquela fatia registrou e que esta
 * extensão fecha.
 * Com eles na linha, o recurso publicado sai **inteiro** do ponto único da projeção, e não de duas
 * fontes que precisariam concordar.
 *
 * ⚠️ **`identificadorNoProvedor` NÃO está aqui, e a ausência é a decisão.** A coluna existe desde a
 * `0017`, é única no SaaS (ADR-0033) e é **interna**: ela é a chave por onde a fatia do carnê casa a
 * notificação recebida com a empresa dona da cobrança, e esquema nenhum de `@syslocbr/contracts` a
 * publica. Publicá-la aqui a levaria ao JSON pela porta dos fundos, já que o recurso é composto por
 * espalhamento da linha na borda.
 *
 * **Não há `id`** — ver o cabeçalho deste arquivo. E não há `empresaId`: o que a porta devolve é o que
 * o contrato publica, e a coluna de tenant não é publicada.
 */
export interface LinhaDeCobranca {
  /** A chave **exposta** (ADR-0017): `COB-{ano}-{7 dígitos}`, única por empresa. */
  readonly codigo: string;
  /** O contrato pela chave **dele** — código, porque contrato tem série declarada (ADR-0017). */
  readonly contratoCodigo: string;
  /** O locatário pela chave **dele** — UUID, porque locatário não tem série declarada (ADR-0017). */
  readonly locatarioId: string;
  readonly natureza: NaturezaDeCobranca;
  readonly referencia: string;
  /** Cadeia `YYYY-MM-DD` — nunca um `Date`. Ver {@link colunasDaCobranca}. */
  readonly competencia: string;
  readonly dataVencimento: string;
  readonly valorOriginal: number;
  /** Derivado pela visão (ADR-0022). Nada nesta camada o calcula. */
  readonly status: EstadoDaCobranca;
  /** Derivado pela visão: zero em todo estado que não seja `VENCIDA`. */
  readonly diasAtraso: number;
  /** Derivado pela visão a partir da política vigente (RD-07). */
  readonly valorMulta: number;
  readonly valorJuros: number;
  readonly valorTotal: number;
  /** Fato: nulo enquanto a cobrança não foi paga. Cadeia `YYYY-MM-DD`. */
  readonly pagoEm: string | null;
  readonly valorPago: number | null;
  /** Fato: nulo enquanto não foi cancelada. Instante em ISO-8601 UTC — ver {@link colunasDaCobranca}. */
  readonly canceladoEm: string | null;
  /** Carimbo da política vigente no ato do pagamento (ADR-0022). */
  readonly multaPercentualAplicado: number | null;
  readonly jurosPercentualAplicado: number | null;
  /**
   * A coluna `numero_do_titulo_no_provedor` — o número que o **provedor** atribuiu ao título.
   *
   * *Nosso número* é vocabulário do provedor, a ADR-0001 fixa que nenhum dele cruza o que o produto
   * publica, e o glossário global o lista entre os termos a evitar. **A coluna física se chamava
   * `nosso_numero` até a migração `0019`**, que a renomeou e fechou o `D14 · F4/T6`: desde então o
   * nome do provedor não existe mais nem no esquema, e não há mais tradução a fazer aqui. Nulo quer
   * dizer *sem boleto emitido*.
   */
  readonly numeroDoTituloNoProvedor: string | null;
  readonly linhaDigitavel: string | null;
  readonly codigoDeBarras: string | null;
  /** Fato do provedor: data de calendário `YYYY-MM-DD`, nula até o crédito acontecer. */
  readonly dataDoCredito: string | null;
  readonly valorCreditado: number | null;
}

/**
 * O que a consulta de fato lê da visão.
 *
 * As **oito** grandezas `numeric` voltam do driver **em texto**, porque `numeric` não cabe em ponto
 * flutuante sem perda — ver {@link cobrancaPublicada}. `diasAtraso` não está aqui porque é a
 * subtração de duas datas, que o servidor devolve como `integer`, e as datas não estão porque saem da
 * consulta já formatadas por `to_char`.
 */
interface LinhaBrutaDeCobranca
  extends Omit<
    LinhaDeCobranca,
    | 'valorOriginal'
    | 'valorMulta'
    | 'valorJuros'
    | 'valorTotal'
    | 'valorPago'
    | 'multaPercentualAplicado'
    | 'jurosPercentualAplicado'
    | 'valorCreditado'
  > {
  readonly valorOriginal: string;
  readonly valorMulta: string;
  readonly valorJuros: string;
  readonly valorTotal: string;
  readonly valorPago: string | null;
  readonly multaPercentualAplicado: string | null;
  readonly jurosPercentualAplicado: string | null;
  readonly valorCreditado: string | null;
}

/**
 * O intervalo **fechado** de competências que o carnê recorta (§4.1 da fatia `webhook-e-carne`).
 *
 * As duas cadeias são `YYYY-MM-DD` no primeiro dia do mês, e não `Date`: a coluna é `date`, e um
 * objeto `Date` reserializado com o fuso do processo desloca a data em um dia para metade dos fusos
 * — que num par de pontas viraria um mês a mais ou a menos no recorte. Quem confere a forma, a ordem
 * entre as pontas e a largura é o esquema da borda (`esquemaDoRecorteDoCarne`); esta camada compõe o
 * predicado com o que já foi conferido, e não repete a conferência.
 */
export interface RecorteDeCompetencias {
  /** A competência da primeira ponta, **inclusive**. */
  readonly de: string;
  /** A competência da última ponta, **inclusive**. */
  readonly ate: string;
}

/**
 * O par que a composição do carnê precisa saber de cada cobrança do recorte.
 *
 * Ver {@link selecionarCobrancasDoRecorte} para por que são **duas** colunas e não a linha inteira.
 */
export interface CobrancaDoRecorte {
  /** A chave **exposta** (ADR-0017), de que a guarda dos bytes deriva o nome do arquivo. */
  readonly codigo: string;
  /** O título vivo; `null` é *nunca emitida, ou já revogada* — e é dele que sai o `BOLETO_AUSENTE`. */
  readonly numeroDoTituloNoProvedor: string | null;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeCobrancasPersistidas {
  readonly cobrancas: readonly LinhaDeCobranca[];
  readonly total: number;
}

/**
 * O código emitido já pertence a outra cobrança **desta empresa**.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de
 * API. Quem o traduz no envelope da ADR-0017 — `422 CAMPO_INVALIDO` com `campo: "codigo"` e o
 * discriminador em `detalhes` — é a borda, num ponto único.
 *
 * Ele existe porque a colisão é **possível sem ser culpa do cliente**: a série pode ter sido semeada
 * para trás na virada (F7), ou o contador de um ano pode ter sido alcançado por um código gravado
 * antes dele. Sem tradução, a recusa chegaria ao cliente como erro de driver em `500`.
 *
 * **A mensagem não carrega o código recusado**, pela mesma razão de `ErroDeCodigoEmUso`: a mensagem
 * chega ao registro estruturado, e o que o usuário precisa saber viaja em campo nomeado.
 */
export class ErroDeCodigoDeCobrancaEmUso extends Error {
  override readonly name: string = 'ErroDeCodigoDeCobrancaEmUso';

  constructor() {
    super('o código emitido já pertence a outra cobrança desta empresa');
  }
}

/**
 * O nome da restrição que impõe a unicidade do código, como o servidor a reporta.
 *
 * Ele é **discriminante**: `negocio.cobranca` tem duas restrições únicas, e a outra
 * (`cobranca_id_empresa_key`) é o alvo das chaves estrangeiras compostas de quem vier a apontar para
 * a cobrança. Um `23505` sozinho não diz qual delas falou.
 */
const RESTRICAO_DO_CODIGO = 'cobranca_empresa_codigo_key';

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar a restrição acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas duas leituras deste arquivo.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo padrão, e mesma
 * justificativa, de `colunasDoContrato` em {@link ./contrato.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede vinte e três traduções livres para divergir. E `id`,
 * `empresa_id` e `identificador_no_provedor` **não** estão na lista — o que a porta devolve é o que o
 * contrato publica, e a chave de correlação com o provedor é interna (ver {@link LinhaDeCobranca}).
 *
 * ⚠️ **O apelido de `numero_do_titulo_no_provedor` deixou de traduzir VOCABULÁRIO — e continua
 * traduzindo CAIXA.** Este parágrafo dizia que a coluna se chamava `nosso_numero` e que era *"neste
 * ponto — e em nenhum outro — que o vocabulário do provedor para de existir"*. A migração `0019` a
 * renomeou e fechou o `D14 · F4/T6`, de modo que a segunda metade da frase se resolveu **um degrau
 * abaixo**: o termo do provedor não chega mais até aqui. O `AS` permanece porque a coluna é
 * `snake_case` e o contrato fala camelCase, exatamente como nas vinte e duas linhas vizinhas — a
 * prescrição da task previa que ele sumisse, e a medição a refuta: sem o apelido, o driver devolveria
 * a chave `numero_do_titulo_no_provedor` e nenhuma leitura casaria com {@link LinhaDeCobranca}.
 *
 * O parágrafo fica, e não some, porque apagá-lo levaria a próxima passada a reintroduzir a tradução
 * de vocabulário por consistência com o que a memória guarda — a regressão de decisão (R3) que o
 * Protocolo Antirregressão nomeia. A fronteira do vocabulário continua existindo, um pacote adiante:
 * `packages/cobranca-bancaria/`, onde `nossoNumero` é o dialeto legítimo do adaptador (RN-18).
 *
 * As **quatro** datas saem por `to_char`, e a escolha é conteúdo: o driver entregaria uma coluna
 * `date` como objeto `Date` no fuso do processo, e reserializá-lo desloca a data em um dia para
 * metade dos fusos (§6.2). A cadeia atravessa da consulta até o JSON sem passar por relógio nenhum, e
 * `to_char` de nulo é nulo — a cobrança sem crédito atravessa com o campo vazio.
 */
function colunasDaCobranca(tx: TransactionSql): Fragment {
  return tx`
    codigo,
    contrato_codigo AS "contratoCodigo",
    locatario_id AS "locatarioId",
    natureza,
    referencia,
    to_char(competencia, ${FORMATO_ISO_DA_DATA}) AS "competencia",
    to_char(data_vencimento, ${FORMATO_ISO_DA_DATA}) AS "dataVencimento",
    valor_original AS "valorOriginal",
    status,
    dias_atraso AS "diasAtraso",
    valor_multa AS "valorMulta",
    valor_juros AS "valorJuros",
    valor_total AS "valorTotal",
    to_char(pago_em, ${FORMATO_ISO_DA_DATA}) AS "pagoEm",
    valor_pago AS "valorPago",
    to_char(cancelado_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "canceladoEm",
    multa_percentual_aplicado AS "multaPercentualAplicado",
    juros_percentual_aplicado AS "jurosPercentualAplicado",
    numero_do_titulo_no_provedor AS "numeroDoTituloNoProvedor",
    linha_digitavel AS "linhaDigitavel",
    codigo_barras AS "codigoDeBarras",
    to_char(data_credito, ${FORMATO_ISO_DA_DATA}) AS "dataDoCredito",
    valor_creditado AS "valorCreditado"
  `;
}

/**
 * O predicado da carteira — **o ponto único** onde os três filtros da §4.1.1 viram instrução.
 *
 * Ele é **um só** para a página e para o total: duas escritas do mesmo recorte fariam a contagem
 * descrever um conjunto do qual a página já não faz parte, e o cliente pagina sobre dois retratos.
 *
 * ---------------------------------------------------------------------------
 * O par de `IS NULL` é redundante para a SEMÂNTICA e decisivo para o PLANEJADOR
 * ---------------------------------------------------------------------------
 *
 * O filtro por estado em aberto acompanha `AND pago_em IS NULL AND cancelado_em IS NULL`, e isso não
 * muda conjunto algum: a precedência da visão só publica `A_VENCER` ou `VENCIDA` quando os dois
 * carimbos são nulos, de modo que o par já está implicado pelo estado pedido.
 *
 * O que ele muda é o **plano**. `cobranca_aberta_idx` é índice PARCIAL sobre exatamente essa
 * condição, e o provador de implicação de predicado do PostgreSQL — que é quem autoriza o uso de
 * índice parcial — resolve conjunção, disjunção, `IS NULL`/`IS NOT NULL` e comparação btree, mas
 * **não decompõe `CASE`**; e `status` é produzido por um `CASE` num `CROSS JOIN LATERAL`. Medido com
 * `EXPLAIN (ANALYZE, BUFFERS)` sobre 60.000 cobranças (T3, 2026-08-10): sem o par, o plano escolhe
 * `cobranca_empresa_vencimento_idx` e resolve o `CASE` como `Filter`, e **com `enable_seqscan = off`
 * o plano não muda** — o índice é inalcançável, não preterido por custo; com o par, passa a
 * `Bitmap Index Scan on cobranca_aberta_idx`. A medição por extenso está no comentário homônimo de
 * `migracoes/0009_dominio_cobranca.sql`, e não é recopiada aqui: cópia de justificativa apodrece.
 *
 * Ele **não** acompanha `PAGA` nem `CANCELADA`: para esses o índice parcial não serve (a linha está
 * fora dele por construção), e escrever `pago_em IS NOT NULL` seria reimplementar a precedência do
 * estado nesta camada, que é o que a ADR-0023 proíbe.
 *
 * **Quais estados recebem o par não se decide aqui**: a partição vem de `ESTADOS_EM_ABERTO`,
 * publicada por `@syslocbr/contracts` ao lado do enum que a governa. Esta camada consome o nome e não
 * conhece os rótulos — é o que impede um literal de estado de existir em posição executável neste
 * pacote, e o que faz um estado novo em aberto alcançar o recorte pelo contrato, e não por uma
 * segunda lista livre para divergir. A implicação de que o par depende — *estado em aberto ⇒ os dois
 * carimbos são nulos* — é propriedade da precedência do `CASE` da visão, e tem rede no passo 6 do
 * `CT-524`, que a exercita com uma cobrança paga e outra cancelada.
 *
 * Não há `empresa_id` aqui, e não pode haver: quem recorta é a política, e a visão é
 * `security_invoker` justamente para que ela seja avaliada com os direitos de quem consulta.
 *
 * ---------------------------------------------------------------------------
 * A JANELA DE VENCIMENTO recorta a COLUNA, e não o estado derivado
 * ---------------------------------------------------------------------------
 *
 * `vencimentoDe` e `vencimentoAte` comparam `data_vencimento`, que é coluna gravada e é o eixo do
 * índice `cobranca_empresa_vencimento_idx` — o mesmo par `(empresa_id, data_vencimento)` que a
 * medição da T3 registra logo acima. Elas são **independentes** do recorte por `status`, e a
 * composição das duas é o que responde à pergunta que nenhum dos dois responde sozinho: *"o que
 * vence hoje"* é `vencimentoDe = vencimentoAte = hoje`, e **não** `status=VENCIDA` — pela definição
 * da visão, a cobrança que vence hoje ainda é `A_VENCER`.
 *
 * As duas pontas são **inclusivas** (`>=` e `<=`), e a conversão `::date` é explícita porque a
 * coluna é `date`: sem ela, a comparação dependeria de coerção implícita em algum caminho do driver.
 *
 * ---------------------------------------------------------------------------
 * Ele devolve conjunções, e quem o hospeda abre com `WHERE TRUE`
 * ---------------------------------------------------------------------------
 *
 * Cada recorte é um `AND …` independente, e nenhum precisa saber se é o primeiro. A alternativa —
 * montar a lista e decidir quem leva o `WHERE` — faria a **ordem** dos filtros virar conteúdo, e o
 * filtro acrescentado na fatia seguinte nasceria com uma condição a mais para acertar. `WHERE TRUE` é
 * eliminado pelo planejador antes de qualquer plano ser considerado.
 */
function predicadoDaCarteira(tx: TransactionSql, filtros: FiltrosDaCarteira): Fragment {
  const emAberto =
    filtros.status !== undefined && ESTADOS_EM_ABERTO.includes(filtros.status)
      ? tx`AND pago_em IS NULL AND cancelado_em IS NULL`
      : tx``;

  return tx`
    ${filtros.contratoCodigo === undefined ? tx`` : tx`AND contrato_codigo = ${filtros.contratoCodigo}`}
    ${filtros.status === undefined ? tx`` : tx`AND status = ${filtros.status}::negocio.status_cobranca`}
    ${emAberto}
    ${filtros.natureza === undefined ? tx`` : tx`AND natureza = ${filtros.natureza}::negocio.natureza_cobranca`}
    ${filtros.vencimentoDe === undefined ? tx`` : tx`AND data_vencimento >= ${filtros.vencimentoDe}::date`}
    ${filtros.vencimentoAte === undefined ? tx`` : tx`AND data_vencimento <= ${filtros.vencimentoAte}::date`}
  `;
}

/**
 * A linha crua na cobrança que a porta entrega — **o ponto único** da conversão de `numeric`.
 *
 * `Number(…)` sobre o texto do driver é o que faz as **oito** grandezas monetárias chegarem ao
 * consumidor como número; sem esta função o JSON sairia com `"1266.25"` entre aspas e **nada
 * acusaria**. Mesma decisão, e mesma razão medida, de `contratoPublicado` em {@link ./contrato.ts}.
 *
 * O nulo atravessa **intacto**: `Number(null)` é `0`, e uma cobrança em aberto passaria a declarar
 * valor pago zero em vez de "ainda não paga" — que é exatamente a distinção que o
 * `cobranca_carimbo_coerente_chk` do banco impõe na escrita. O mesmo vale para `valorCreditado`, que
 * o banco **não** pareia com carimbo algum: uma cobrança emitida e ainda não creditada passaria a
 * declarar que o provedor creditou zero, que é o oposto de *"ainda não creditou"*.
 *
 * Os campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna
 * que a projeção venha a ganhar, inclusive `empresa_id` — e a visão expande `c.*`.
 */
function cobrancaPublicada(linha: LinhaBrutaDeCobranca): LinhaDeCobranca {
  return {
    codigo: linha.codigo,
    contratoCodigo: linha.contratoCodigo,
    locatarioId: linha.locatarioId,
    natureza: linha.natureza,
    referencia: linha.referencia,
    competencia: linha.competencia,
    dataVencimento: linha.dataVencimento,
    valorOriginal: Number(linha.valorOriginal),
    status: linha.status,
    diasAtraso: linha.diasAtraso,
    valorMulta: Number(linha.valorMulta),
    valorJuros: Number(linha.valorJuros),
    valorTotal: Number(linha.valorTotal),
    pagoEm: linha.pagoEm,
    valorPago: linha.valorPago === null ? null : Number(linha.valorPago),
    canceladoEm: linha.canceladoEm,
    multaPercentualAplicado:
      linha.multaPercentualAplicado === null ? null : Number(linha.multaPercentualAplicado),
    jurosPercentualAplicado:
      linha.jurosPercentualAplicado === null ? null : Number(linha.jurosPercentualAplicado),
    numeroDoTituloNoProvedor: linha.numeroDoTituloNoProvedor,
    linhaDigitavel: linha.linhaDigitavel,
    codigoDeBarras: linha.codigoDeBarras,
    dataDoCredito: linha.dataDoCredito,
    valorCreditado: linha.valorCreditado === null ? null : Number(linha.valorCreditado),
  };
}

/**
 * O ano do escopo da série da cobrança — **segundo o relógio do banco e o fuso do OBJETO**.
 *
 * ---------------------------------------------------------------------------
 * O EIXO É `negocio.data_corrente_da_operacao()`, e a escolha é conteúdo
 * ---------------------------------------------------------------------------
 *
 * Ela existe porque o ano aparece em **quatro** lugares que precisam concordar: o contador que
 * {@link garantirContadorDeCobranca} cria, o número que {@link emitirNumeroDeCobranca} consome, o
 * código que {@link criarCobranca} compõe — e a **classificação** que a visão faz da linha gravada.
 * Os três primeiros são da série; o quarto é do estado, e é ele que decide o eixo.
 *
 * O leitor irmão da porta do contrato (`lerAnoDaSerieDeContrato`) deriva de `current_date`, que é o
 * fuso da **sessão**. A visão `negocio.cobranca_derivada` deriva de
 * `negocio.data_corrente_da_operacao()`, cujo fuso é do **objeto** (`America/Sao_Paulo`, fixado na
 * migração `0010`) justamente para que quem consulta não possa mudá-lo. Ler o ano por um eixo e
 * classificar a cobrança pelo outro põe o código de um ano no contador do outro — nas horas em torno
 * da virada os dois discordam —, e o defeito seria raro, mudo e sobre **código legível**, que a
 * ADR-0015 proíbe reusar. Reusar aqui o leitor do contrato seria exatamente isso.
 *
 * **Ela é o leitor ÚNICO do ano desta série**, e é por isso que ela mora ao lado das duas funções que
 * consomem o valor: um segundo eixo alcançável é o que faz duas unidades sequenciais discordarem.
 *
 * O ano é lido **uma vez** pela borda, na primeira unidade de trabalho, e viaja daí em diante junto
 * do número, em {@link NumeroDaSerie}. Ele cai naturalmente na faixa 2000–2999 que as duas funções do
 * banco guardam.
 */
export async function lerAnoDaSerieDeCobranca(tx: TransactionSql): Promise<number> {
  const [linha] = await tx<{ ano: number }[]>`
    SELECT extract(year FROM negocio.data_corrente_da_operacao())::integer AS ano
  `;

  if (linha === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado. O ramo existe porque o tipo do driver
    // admite o arranjo vazio, e um `as` no lugar dele deixaria um `undefined` virar ano da série.
    throw new Error('o relógio do banco não devolveu o ano da série da cobrança');
  }

  return linha.ano;
}

/**
 * Garante que o contador do escopo `(empresa do contexto, ano)` existe. Idempotente.
 *
 * **A borda a chama na PRIMEIRA unidade de trabalho, que commita antes da segunda abrir** — ver o
 * cabeçalho deste arquivo para por que fundi-la com {@link emitirNumeroDeCobranca} reabriria o reuso
 * do número `0000001`.
 *
 * A empresa **não** é parâmetro: a função do banco a lê do contexto da transação e levanta sem ele. O
 * `::integer` no ano não é ornamento — sem ele o driver poderia enviar o valor como `bigint`, e a
 * resolução de sobrecarga não acharia a função declarada sobre `integer`.
 *
 * O segundo parâmetro da função do banco (`p_inicio`) **não é exposto aqui**, e a ausência é a
 * decisão: ele existe para a semeadura da virada (F7), que é operação de migração e não de produto.
 * Publicá-lo daria à borda o poder de reposicionar a série de uma empresa, que é exatamente o que
 * produz código repetido.
 */
export async function garantirContadorDeCobranca(tx: TransactionSql, ano: number): Promise<void> {
  await tx`SELECT negocio.garantir_contador_de_cobranca(${ano}::integer)`;
}

/**
 * Consome o contador do escopo `(empresa do contexto, ano)` e devolve o número emitido.
 *
 * **O avanço não participa do desfazimento** (ADR-0020): a transação que aborta depois de chamar esta
 * função queima o número para sempre, e é exatamente esse o furo que a ADR-0015 aceita por escrito —
 * é o preço de duas criações concorrentes **não esperarem** uma pela outra. O `CT-536` mede o furo.
 *
 * O número volta como `bigint`, que o driver entrega em cadeia de caracteres; a conversão explícita é
 * o que impede o sequencial de chegar ao formatador do código como texto.
 */
export async function emitirNumeroDeCobranca(tx: TransactionSql, ano: number): Promise<number> {
  const [linha] = await tx<{ numero: string }[]>`
    SELECT negocio.proximo_numero_de_cobranca(${ano}::integer) AS numero
  `;

  if (linha === undefined) {
    // Inalcançável: a função ou devolve o número ou levanta. O ramo existe porque o tipo do driver
    // admite o arranjo vazio, e um `as` no lugar dele deixaria um `NaN` virar código de cobrança.
    throw new Error('a série da cobrança não devolveu número');
  }

  return Number(linha.numero);
}

/**
 * Consome `quantidade` números do contador do escopo `(empresa do contexto, ano)` e devolve os pares
 * emitidos, na ordem em que a série os entregou.
 *
 * ---------------------------------------------------------------------------
 * É UMA CHAMADA À FUNÇÃO POR NÚMERO, NUMA IDA AO BANCO SÓ
 * ---------------------------------------------------------------------------
 *
 * `negocio.proximo_numero_de_cobranca` é `VOLATILE` (o padrão de `plpgsql`, e o que `nextval` exige),
 * de modo que o `generate_series` a invoca **uma vez por linha** — são `quantidade` avanços do
 * contador, exatamente como `quantidade` chamadas de {@link emitirNumeroDeCobranca} produziriam. O que
 * a forma economiza é **ida ao banco**, e não avanço: a ativação de doze meses passa de doze viagens a
 * uma. Dentro de uma unidade de trabalho aberta, com `SET LOCAL`, cada viagem segura uma conexão de um
 * pool compartilhado entre empresas — o isolamento de *dado* é do banco (ADR-0008), o de **recurso**
 * não é de ninguém.
 *
 * **A aplicação continua sem tocar a sequência** (ADR-0020): o único caminho para o número é a função
 * `SECURITY DEFINER`, e `generate_series` só decide **quantas vezes** ela é chamada. A empresa não é
 * parâmetro nem aqui — quem a lê é a função, por dentro.
 *
 * ---------------------------------------------------------------------------
 * O ANO VIAJA JUNTO DE CADA NÚMERO, e a repetição é deliberada
 * ---------------------------------------------------------------------------
 *
 * A devolução é uma lista de {@link NumeroDaSerie}, e não de números crus, pela razão que a ADR-0020
 * fixa e que o cabeçalho de {@link ./contrato.ts} registra por extenso: o par tem de viajar junto para
 * que {@link criarCobrancasEmLote} **não releia o ano**. Doze cópias do mesmo inteiro custam nada, e o
 * que elas compram é a impossibilidade de o código anunciar um contador que não emitiu aquele número —
 * a virada do ano cabe entre a unidade que garante o contador e a que grava.
 *
 * **A quantidade é conferida antes da ida ao banco**, e a lista vazia **não** emite instrução alguma:
 * `generate_series(1, 0)` não produz linha, e pagar a viagem para descobrir isso é custo sem
 * informação — mesma decisão de `substituirFiadoresDoContrato` em {@link ./contrato.ts}. Quantidade
 * negativa ou fracionária levanta em vez de virar lista curta: ela produziria menos parcelas do que o
 * contrato prevê **sem nada acusando**, que é a mesma classe de silêncio que
 * `derivarParcelasDoContrato` recusa no prazo.
 */
export async function emitirNumerosDeCobranca(
  tx: TransactionSql,
  ano: number,
  quantidade: number,
): Promise<readonly NumeroDaSerie[]> {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    // Sem o valor na mensagem, de propósito: ela pode alcançar o registro estruturado.
    throw new RangeError('a quantidade de números da série precisa ser um inteiro não negativo');
  }

  if (quantidade === 0) {
    return [];
  }

  const linhas = await tx<{ numero: string }[]>`
    SELECT negocio.proximo_numero_de_cobranca(${ano}::integer) AS numero
      FROM generate_series(1, ${quantidade}::integer)
  `;

  if (linhas.length !== quantidade) {
    // Inalcançável: `generate_series` produz exatamente `quantidade` linhas e a função ou devolve o
    // número ou levanta. A conferência existe porque uma lista mais curta que a pedida faria a
    // gravação em lote emitir menos parcelas do que o contrato prevê, em silêncio.
    throw new Error('a série da cobrança não devolveu um número para cada parcela pedida');
  }

  return linhas.map((linha) => ({ ano, numero: Number(linha.numero) }));
}

/**
 * Grava uma cobrança e devolve a linha como a **visão** a publica.
 *
 * ---------------------------------------------------------------------------
 * A ESCRITA VAI NA TABELA; a leitura de volta vai na VISÃO
 * ---------------------------------------------------------------------------
 *
 * O `INSERT` alcança `negocio.cobranca` — a visão não é gravável, e não deveria ser. O que ele
 * devolve por `RETURNING` é o `codigo`, e **só ele**: os cinco campos derivados não existem na tabela,
 * e compô-los aqui a partir das colunas gravadas seria a segunda avaliação do estado que esta fatia
 * existe para eliminar. A linha publicada sai de {@link localizarCobranca}, na mesma unidade de
 * trabalho — é o que faz a composição enxergar o que ela acabou de gravar, já derivado pela política
 * vigente.
 *
 * A {@link NumeroDaSerie} chega **pronta**: o ano e o número obtidos pela borda e **entregues
 * juntos**. Esta função **não relê o ano** — a razão está no cabeçalho, e ela é o que impede o código
 * de anunciar um contador que não emitiu aquele número. O código sai de `formatarCodigoDeCobranca`,
 * importado de `@syslocbr/contracts`: a forma `COB-{ano}-{7 dígitos}` tem lá o marcador
 * `DECISÃO FECHADA` que fixa a largura, e redigitá-la aqui criaria a segunda fonte do mesmo fato
 * (ADR-0016).
 *
 * **`locatario_id` não é gravado**, e a ausência é a decisão de desenho da fatia: a coluna não existe.
 * O locatário chega ao consumidor pela junção da visão com o contrato.
 *
 * Os seis campos de conciliação bancária e os cinco do desfecho nascem **nulos por ausência de
 * valor**, e não por um nulo escrito aqui: quem os preenche são a F4 e a T7.
 */
export async function criarCobranca(
  tx: TransactionSql,
  dados: DadosDaCobranca,
  serie: NumeroDaSerie,
): Promise<LinhaDeCobranca> {
  const codigo = formatarCodigoDeCobranca(serie.ano, serie.numero);

  // O envoltório devolve **os** códigos gravados — um, aqui; N, no lote —, e é essa uniformidade que
  // mantém a tradução da colisão num ponto só. Ver {@link gravarSobRestricaoDoCodigo}.
  const [gravado] = await gravarSobRestricaoDoCodigo(tx, async (escrita) => {
    const [linha] = await escrita<{ codigo: string }[]>`
      INSERT INTO negocio.cobranca (
        empresa_id, codigo, contrato_id, natureza, referencia,
        competencia, data_vencimento, valor_original
      )
      VALUES (
        ${empresaDoContexto(escrita)}, ${codigo}, ${dados.contratoId}, ${dados.natureza},
        ${dados.referencia}, ${dados.competencia}, ${dados.dataVencimento}, ${dados.valorOriginal}
      )
      RETURNING codigo
    `;

    return linha === undefined ? [] : [linha.codigo];
  });

  if (gravado === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse uma cobrança.
    throw new Error('a cobrança foi gravada e a linha não voltou do INSERT');
  }

  const publicada = await localizarCobranca(tx, gravado);

  if (publicada === undefined) {
    // Inalcançável: a leitura corre na MESMA unidade que acabou de gravar, sob o mesmo contexto. O
    // ramo existe para que a falha tenha nome em vez de um `undefined` atravessando a borda.
    throw new Error('a cobrança foi gravada e a visão derivada não a devolveu');
  }

  return publicada;
}

/**
 * Grava **as N parcelas de um contrato numa instrução só** e devolve os códigos que o banco escreveu.
 *
 * ---------------------------------------------------------------------------
 * UM `INSERT` DE N LINHAS, e não N `INSERT`s — a forma é conteúdo
 * ---------------------------------------------------------------------------
 *
 * As colunas variáveis chegam como **arranjos paralelos** e são recompostas por `unnest`, que é o
 * mesmo mecanismo de `substituirFiadoresDoContrato` em {@link ./contrato.ts}. A ativação de doze meses
 * paga **uma** ida ao banco em vez de doze, e a razão é a mesma de
 * {@link emitirNumerosDeCobranca}: dentro de uma unidade de trabalho aberta cada viagem segura uma
 * conexão de um pool compartilhado entre empresas, e o número de viagens passaria a ser escolhido pelo
 * prazo que o cliente contratou — que não tem teto pequeno (`prazoMeses` admite dezenas).
 *
 * A alternativa — um laço de {@link criarCobranca} na borda — teria um segundo preço, e ele é pior que
 * o custo: cada iteração relê a **visão** para publicar a linha, de modo que a ativação de doze meses
 * faria vinte e quatro consultas para devolver um número que é a contagem das linhas gravadas.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA DEVOLVE, e por que não é a linha publicada
 * ---------------------------------------------------------------------------
 *
 * Os **códigos**, colhidos do `RETURNING` — e não as linhas da visão. Quem chama é a ativação, e o que
 * a resposta dela publica é **quantas** cobranças nasceram (`efeitos.cobrancasGeradas`), não a carteira:
 * a lista completa é a rota de leitura `GET /v1/cobrancas?contrato=…`, que já existe. Usar o
 * comprimento desta devolução em vez de `parcelas.length` é o que faz o efeito publicado ser o número
 * de linhas que o **banco** escreveu, e não o de linhas que a aplicação pretendia escrever.
 *
 * A ordem da devolução não é contratada — quem precisa de ordem lê a carteira, que ordena por
 * `data_vencimento, codigo`.
 *
 * ---------------------------------------------------------------------------
 * O CONTRATO ENTRA UMA VEZ; o par `(ano, número)` entra N vezes
 * ---------------------------------------------------------------------------
 *
 * `contratoId` é o **UUID** — a coluna é `uuid` e a chave estrangeira composta é
 * `(contrato_id, empresa_id)` —, e ele é o mesmo para todas as parcelas por construção: a parcela
 * cruzada é irrepresentável porque não há caminho para propor um contrato por linha. Quem traduziu o
 * código recebido do cliente no identificador interno foi a borda, e é essa tradução que produz o `404`
 * de contrato inalcançável, que esta camada não sabe emitir.
 *
 * Cada código sai de `formatarCodigoDeCobranca` sobre o par que {@link emitirNumerosDeCobranca}
 * devolveu — **o ano não é relido aqui**, pela mesma razão de {@link criarCobranca}. A conferência de
 * que há um número por parcela vem antes de qualquer escrita: emitir doze números e gravar onze linhas
 * queimaria um número em silêncio, e a ADR-0015 proíbe reusá-lo.
 *
 * A lista vazia **não** emite instrução alguma — `unnest` de arranjos vazios não produz linha, e pagar
 * a viagem para descobrir isso é custo sem informação. É o caminho da RD-20, em que o contrato declara
 * `gerarCobrancasAutomaticamente: false` e a ativação grava zero parcelas.
 *
 * `empresa_id` é proposto por {@link empresaDoContexto} porque a coluna é `NOT NULL` sem padrão — quem
 * aceita ou recusa cada linha continua sendo o `WITH CHECK` da política (ADR-0008), e não há aqui um
 * `WHERE empresa_id = …`. A colisão de código é traduzida pelo **mesmo** ponto único da gravação
 * avulsa, e o `SAVEPOINT` dele é o que impede a recusa de uma parcela de abortar a ativação inteira com
 * `25P02` — ver {@link gravarSobRestricaoDoCodigo}.
 */
export async function criarCobrancasEmLote(
  tx: TransactionSql,
  contratoId: string,
  parcelas: readonly ParcelaDerivada[],
  numeros: readonly NumeroDaSerie[],
): Promise<readonly string[]> {
  if (parcelas.length !== numeros.length) {
    // Sem os valores na mensagem, de propósito: ela pode alcançar o registro estruturado.
    throw new RangeError('o lote recebeu uma quantidade de números diferente da de parcelas');
  }

  if (parcelas.length === 0) {
    return [];
  }

  const codigos = numeros.map((serie) => formatarCodigoDeCobranca(serie.ano, serie.numero));

  return await gravarSobRestricaoDoCodigo(tx, async (escrita) => {
    const linhas = await escrita<{ codigo: string }[]>`
      INSERT INTO negocio.cobranca (
        empresa_id, codigo, contrato_id, natureza, referencia,
        competencia, data_vencimento, valor_original
      )
      SELECT ${empresaDoContexto(escrita)},
             parcela.codigo,
             ${contratoId}::uuid,
             parcela.natureza::negocio.natureza_cobranca,
             parcela.referencia,
             parcela.competencia::date,
             parcela.data_vencimento::date,
             parcela.valor_original::numeric
        FROM unnest(
               ${codigos}::text[],
               ${parcelas.map((parcela) => parcela.natureza)}::text[],
               ${parcelas.map((parcela) => parcela.referencia)}::text[],
               ${parcelas.map((parcela) => parcela.competencia)}::text[],
               ${parcelas.map((parcela) => parcela.dataVencimento)}::text[],
               ${parcelas.map((parcela) => parcela.valorOriginal)}::numeric[]
             ) AS parcela(
               codigo, natureza, referencia, competencia, data_vencimento, valor_original
             )
      RETURNING codigo
    `;

    return linhas.map((linha) => linha.codigo);
  });
}

// DECISÃO FECHADA — F3/fatia 1 · 2026-08-10
// O QUÊ: toda leitura de cobrança atravessa `negocio.cobranca_derivada`. Nenhuma leitura seleciona
//        de `negocio.cobranca` diretamente.
// POR QUÊ: é a unicidade ESTRUTURAL que fecha o defeito de origem — o sistema antigo tem TRÊS
//          avaliações divergentes do mesmo estado, a ponto de o envio manual cobrar por uma dívida
//          cancelada (golden `regua-de-cobranca.json`, cenário `cobranca_cancelada_e_vencida`).
//          Disciplina de chamada não fecha essa classe; um único lugar que calcula, fecha.
// REVERTER EXIGE: provar que nenhum caminho de leitura alcança a cobrança sem passar pela view —
//                 e a prova é o CT-510, que varre os fontes por literal de estado em posição
//                 executável.

/**
 * Lê uma página da carteira e o total do conjunto filtrado, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos. O total é o da **empresa inteira** sob o recorte pedido — e não
 * o tamanho da página —, que é o que o envelope `{ itens, total, limite, deslocamento }` da ADR-0017
 * declara; quem o recorta por empresa é a política, nunca uma cláusula escrita aqui.
 *
 * **A ordem é `data_vencimento, codigo`**, e o desempate não é ornamento: dezenas de parcelas
 * compartilham o mesmo vencimento (a ativação de doze meses gera doze com o mesmo dia), e um empate
 * faz a mesma linha aparecer em duas páginas — ou em nenhuma. O `codigo` é único por empresa
 * (`cobranca_empresa_codigo_key`), de modo que ele desempata sempre, e é a ordem que o usuário
 * reconhece: o vencimento é o eixo da tela do Financeiro.
 *
 * O filtro por `status` é **predicado SQL sobre a coluna derivada**, e é exatamente essa
 * possibilidade que justifica a ADR-0023: derivado na aplicação, o recorte exigiria trazer a carteira
 * inteira para a memória antes de filtrar, e a janela deixaria de ser janela.
 */
export async function listarCobrancas(
  tx: TransactionSql,
  janela: JanelaDaCarteira,
  filtros: FiltrosDaCarteira = {},
): Promise<PaginaDeCobrancasPersistidas> {
  const linhas = await tx<LinhaBrutaDeCobranca[]>`
    SELECT ${colunasDaCobranca(tx)}
      FROM negocio.cobranca_derivada
     WHERE TRUE ${predicadoDaCarteira(tx, filtros)}
     ORDER BY data_vencimento, codigo
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.cobranca_derivada
     WHERE TRUE ${predicadoDaCarteira(tx, filtros)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return {
    cobrancas: linhas.map(cobrancaPublicada),
    total: Number(contagem?.total ?? 0),
  };
}

/**
 * As cobranças do contrato cujas competências caem no recorte, **ordenadas por vencimento**.
 *
 * ---------------------------------------------------------------------------
 * O recorte e a ordem são do BANCO, e a posição é a ADR-0023 lida ao pé da letra
 * ---------------------------------------------------------------------------
 *
 * Filtrar em memória exigiria trazer a carteira inteira do contrato para depois descartar quase
 * tudo, e ordenar em memória faria a ordem do carnê depender do arranjo do arranjo — quando ela é
 * **conteúdo**: quem recebe o caderno paga a primeira parcela primeiro. O desempate por `codigo`
 * acompanha {@link listarCobrancas} pela mesma razão que ela registra: doze parcelas de uma ativação
 * compartilham o dia do vencimento, e sem o desempate a ordem entre elas é a que o planejador
 * escolher — de modo que dois pedidos do mesmo recorte poderiam produzir documentos com as parcelas
 * trocadas.
 *
 * ---------------------------------------------------------------------------
 * Ela devolve DUAS colunas, e a escassez é a decisão
 * ---------------------------------------------------------------------------
 *
 * O consumidor é a composição do carnê, e o que ela precisa saber de cada cobrança é o par *"que
 * boleto pedir"* — a chave exposta, de que a guarda deriva o nome do arquivo, e o título vivo, que
 * decide se **há** boleto. Devolver a linha inteira daria à borda todo o resto do recurso sem
 * consumidor, incluindo os valores derivados que ela não publica aqui; e o alvo gravado do arquivo
 * continua **fora**, pela mesma razão de {@link ../../apps/api/src/cobrancas/boleto.service.ts}: o
 * nome do arquivo é composto num ponto só, dentro da guarda.
 *
 * Nulo em `numeroDoTituloNoProvedor` quer dizer *sem boleto emitido* — e é dele que sai o
 * `404 BOLETO_AUSENTE` que o carnê publica, nomeando a **primeira** na ordem que esta consulta fixa.
 *
 * Ela lê a **visão**, como toda leitura de cobrança desta camada (ver a `DECISÃO FECHADA` acima), e
 * não há `WHERE empresa_id` aqui: o recorte por empresa é da política, e um segundo caminho para o
 * mesmo recorte é o que a ADR-0008 rejeita. Contrato de outra empresa simplesmente não devolve linha
 * alguma — mas quem produz o `404` daquele caso é a borda, com {@link ./contrato.ts localizarContrato},
 * **antes** de chegar aqui: sem essa conferência, o contrato alheio responderia a recusa do recorte
 * vazio, que é distinguível.
 *
 * As duas pontas são **inclusivas**, e o intervalo é fechado nas duas: o recorte de janeiro a março
 * alcança as três competências, que é o que o cliente lê ao pedir *"de janeiro a março"*.
 */
export async function selecionarCobrancasDoRecorte(
  tx: TransactionSql,
  contratoCodigo: string,
  recorte: RecorteDeCompetencias,
): Promise<readonly CobrancaDoRecorte[]> {
  return await tx<CobrancaDoRecorte[]>`
    SELECT codigo,
           numero_do_titulo_no_provedor AS "numeroDoTituloNoProvedor"
      FROM negocio.cobranca_derivada
     WHERE contrato_codigo = ${contratoCodigo}
       AND competencia BETWEEN ${recorte.de}::date AND ${recorte.ate}::date
     ORDER BY data_vencimento, codigo
  `;
}

/**
 * Localiza a cobrança pelo **código**. `undefined` quando o contexto corrente não a alcança.
 *
 * As duas causas da ausência são deliberadamente **indistinguíveis**: a cobrança não existe, ou existe
 * e é de outra empresa. A borda traduz as duas no mesmo `404 RECURSO_NAO_ENCONTRADO` — a recusa é
 * consequência de não achar, e não de uma comparação de empresa escrita na aplicação (ADR-0008).
 *
 * Ela lê a **visão**, de modo que `status`, `valorMulta` e `valorJuros` chegam já derivados pela
 * política vigente **no instante da leitura** — e não pelo que valia quando a linha foi gravada.
 */
export async function localizarCobranca(
  tx: TransactionSql,
  codigo: string,
): Promise<LinhaDeCobranca | undefined> {
  const [linha] = await tx<LinhaBrutaDeCobranca[]>`
    SELECT ${colunasDaCobranca(tx)}
      FROM negocio.cobranca_derivada
     WHERE codigo = ${codigo}
  `;

  return linha === undefined ? undefined : cobrancaPublicada(linha);
}

/**
 * Grava os fatos do pagamento e os **quatro carimbos**, numa instrução só, e devolve a linha
 * publicada.
 *
 * ---------------------------------------------------------------------------
 * OS QUATRO CARIMBOS SAEM DA VISÃO, DENTRO DA MESMA INSTRUÇÃO QUE OS GRAVA
 * ---------------------------------------------------------------------------
 *
 * O `UPDATE` lê `negocio.cobranca_derivada` no `FROM` e copia dela `valor_multa`, `valor_juros` e os
 * dois percentuais vigentes. **Nenhuma fórmula é escrita aqui**, e é isso que a torna impossível de
 * divergir: multa e juros carimbados são, por construção, os mesmos centavos que a visão publicava —
 * a mesma expressão, no mesmo lugar, referenciada e não recopiada (ADR-0022, ADR-0023). Escrever a
 * conta de novo neste `UPDATE` produziria dois cálculos que concordariam hoje e divergiriam na
 * primeira mudança da política, e a divergência não faria barulho.
 *
 * **A visão enxerga a linha ANTES desta escrita**, e a propriedade é do PostgreSQL, não uma sutileza
 * a lembrar: a relação do `FROM` é avaliada contra a fotografia do início da instrução, de modo que
 * `pago_em` ainda é nulo para ela e a mora vem apurada pela política vigente. É a razão de o carimbo
 * caber numa instrução só, e a razão de ele congelar o instante imediatamente anterior ao ato.
 *
 * Os **quatro** vão juntos, e não só os dois valores: `multa_percentual_aplicado` e
 * `juros_percentual_aplicado` são a **configuração vigente** que a ADR-0022 manda gravar junto, e sem
 * eles a releitura de uma cobrança paga não diria mais sob qual política ela foi cobrada. O
 * `cobranca_carimbo_coerente_chk` os amarra ao pagamento pelos dois lados — carimbo sem `pago_em` e
 * `pago_em` sem carimbo são igualmente irrepresentáveis —, de modo que gravá-los em duas instruções
 * seria recusado pelo banco no meio do caminho.
 *
 * A junção é por `id`, e não por código: o `WHERE` já recorta a linha pelo código, e igualar o
 * identificador interno das duas relações é o que declara que a visão consultada é a **daquela**
 * linha. Não há `empresa_id` em lugar nenhum desta instrução — quem recorta as duas pontas é a
 * política, e a visão é `security_invoker` justamente para que ela seja avaliada com os direitos de
 * quem consulta (ADR-0008).
 *
 * **Os seis campos de conciliação bancária não aparecem no `SET`**, e a ausência é a decisão — ver o
 * marcador `DECISÃO FECHADA` de `apps/api/src/cobrancas/cobranca.service.ts`, que registra a
 * divergência declarada contra o sistema antigo. Aqui a garantia é estrutural: uma coluna que não é
 * nomeada não é escrita.
 *
 * `undefined` quando o contexto corrente não alcança a cobrança — mesma indistinguibilidade de
 * {@link localizarCobranca}, traduzida pela borda no `404` canônico. A guarda de estado **não** mora
 * aqui: quem recusa pagar o que já está liquidado é o serviço, com a recusa que nomeia o estado atual.
 */
export async function acusarPagamentoDeCobranca(
  tx: TransactionSql,
  codigo: string,
  desfecho: DesfechoDoPagamento,
): Promise<LinhaDeCobranca | undefined> {
  const [linha] = await tx<{ codigo: string }[]>`
    UPDATE negocio.cobranca AS alvo
       SET pago_em = ${desfecho.pagoEm},
           valor_pago = ${desfecho.valorPago},
           multa_aplicada = derivada.valor_multa,
           juros_aplicados = derivada.valor_juros,
           multa_percentual_aplicado = derivada.multa_percentual_vigente,
           juros_percentual_aplicado = derivada.juros_percentual_vigente
      FROM negocio.cobranca_derivada AS derivada
     WHERE derivada.id = alvo.id
       AND alvo.codigo = ${codigo}
    RETURNING alvo.codigo
  `;

  return linha === undefined ? undefined : await localizarCobranca(tx, linha.codigo);
}

/**
 * Carimba o cancelamento da cobrança e devolve a linha publicada.
 *
 * **Nada é apagado** (ADR-0014): a linha permanece, o código continua ocupado na unicidade
 * `(empresa_id, codigo)` — de modo que a série nunca o reusa — e a leitura por código segue
 * alcançando-a. O que muda é um fato gravado, e é a precedência da visão que o traduz no estado
 * publicado.
 *
 * O instante sai de `now()`, do relógio do **banco**, e não de um `Date` da aplicação: a coluna é
 * `timestamptz` e o valor é comparado com os demais carimbos do mesmo servidor.
 *
 * **Ela NÃO é idempotente, e a ausência de `AND cancelado_em IS NULL` é deliberada.** Um `UPDATE`
 * condicional responderia sobre a cobrança já cancelada sem escrever nada, e a borda não teria como
 * distinguir *"cancelei agora"* de *"já estava cancelada"* — a segunda tentativa passaria em silêncio.
 * Quem recusa a repetição é a guarda de estado do serviço, que responde `422` nomeando o estado atual:
 * repetir **informa**. A consequência é que esta instrução nunca alcança uma linha já liquidada, e o
 * instante original é preservado por não haver segunda escrita.
 *
 * `undefined` quando o contexto corrente não alcança a cobrança, como em {@link localizarCobranca}.
 */
export async function cancelarCobranca(
  tx: TransactionSql,
  codigo: string,
): Promise<LinhaDeCobranca | undefined> {
  const [linha] = await tx<{ codigo: string }[]>`
    UPDATE negocio.cobranca
       SET cancelado_em = now()
     WHERE codigo = ${codigo}
    RETURNING codigo
  `;

  return linha === undefined ? undefined : await localizarCobranca(tx, linha.codigo);
}

/**
 * Cancela **as cobranças canceláveis de um contrato** e devolve **quantas linhas o banco alcançou**.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO É A REGRA DE NEGÓCIO, SEM TRADUÇÃO — e isso é o dividendo do estado derivado
 * ---------------------------------------------------------------------------
 *
 * *"Cancele as que ainda podem ser canceladas"* escreve-se, em SQL,
 * `pago_em IS NULL AND cancelado_em IS NULL` — e não há entre as duas frases nenhuma tradução, nenhuma
 * lista de rótulos e nenhuma máquina de estados própria. É consequência direta de o estado ser
 * derivado dos fatos gravados (ADR-0022): a precedência da visão publica `A_VENCER` ou `VENCIDA`
 * exatamente quando os dois carimbos são nulos, de modo que *"em aberto"* e *"cancelável"* são o mesmo
 * conjunto, escrito uma vez.
 *
 * A alternativa — selecionar por `status IN ('A_VENCER','VENCIDA')` sobre a visão e cancelar a lista —
 * seria uma **segunda** avaliação do estado nesta camada, contra o marcador `DECISÃO FECHADA` acima, e
 * teria de reproduzir aqui a precedência do `CASE`. Ela também gravaria com base numa leitura anterior,
 * e entre a leitura e a escrita cabe o pagamento de uma das linhas.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELA NÃO ALCANÇA — e por que a diferença é FÍSICA, não de valor
 * ---------------------------------------------------------------------------
 *
 * A paga e a já cancelada ficam **fora do conjunto**, e por isso não são reescritas: `pago_em`,
 * `valor_pago`, os quatro carimbos de mora e o `cancelado_em` original permanecem, com a **tupla
 * intacta** — o `xmin` delas não muda. A distinção que importa é entre *não alterou* e *reescreveu com
 * o mesmo valor*: a segunda passaria em qualquer comparação de campos, e é o que a RN-13 proíbe.
 *
 * **Os dois `IS NULL` protegem coisas diferentes, e a medição está registrada no cabeçalho de
 * `apps/api/test/contratos.e2e.spec.ts`.** Sem `pago_em IS NULL`, a escrita alcança uma linha paga e o
 * banco a **recusa em voz alta**: `cobranca_desfecho_unico_chk` proíbe os dois carimbos na mesma linha, e
 * o `23514` chega ao cliente como `500`. Sem `cancelado_em IS NULL`, não há recusa alguma — o instante
 * original do cancelamento é sobrescrito **em silêncio**, e uma variante que o preservasse
 * (`COALESCE(cancelado_em, now())`) reescreveria a tupla sem mudar valor nenhum. É esta que só o `xmin`
 * distingue, e é por ela que o par existe inteiro.
 *
 * ---------------------------------------------------------------------------
 * CONJUNTO VAZIO NÃO É ERRO — e a assimetria com a porta estreita do imóvel é deliberada
 * ---------------------------------------------------------------------------
 *
 * `0` linhas afetadas é resultado legítimo, e não falha: o contrato pode não ter cobrança alguma
 * (`gerarCobrancasAutomaticamente: false`), ou tê-las todas já liquidadas. Ela devolve zero e o
 * cancelamento do contrato responde `200`.
 *
 * É o oposto de `definirSituacaoDeLocacaoDoImovel`, que **levanta** quando não alcança exatamente uma
 * linha — e a diferença não é estilo: lá a ausência de linha é estado impossível (o imóvel existe, foi
 * alcançado pela chave estrangeira composta, e um `UPDATE` sem efeito deixaria um imóvel `LOCADO` sem
 * contrato vigente); aqui a quantidade é **dado do contrato**, e um teto ou piso escrito nesta camada
 * recusaria o caso mais banal do produto.
 *
 * ---------------------------------------------------------------------------
 * ELA NÃO CONFERE ESTADO DO CONTRATO, e não abre unidade de trabalho
 * ---------------------------------------------------------------------------
 *
 * Quem recusa cancelar um contrato que não é `ATIVO` é a guarda de estado do serviço, que nomeia o
 * estado atual na resposta — esta camada não conhece HTTP. E ela **recebe** o executor de quem já abriu
 * a unidade: é isso, e nada mais, que faz a cascata, a transição do contrato e a liberação do imóvel
 * commitarem juntas ou não commitarem. Não existe cascata parcial porque não existe segunda unidade.
 *
 * `contratoId` é o **UUID**, e não o código: a coluna é `uuid`, e a chave estrangeira composta é
 * `(contrato_id, empresa_id)` — mesma razão de {@link criarCobrancasEmLote}. Quem traduziu o código
 * recebido do cliente no identificador interno foi a borda.
 *
 * Não há `empresa_id` na instrução, e não pode haver: quem recorta é a política forçada (ADR-0008), e
 * o índice `cobranca_empresa_contrato_idx` — `(empresa_id, contrato_id)` — é quem a resolve com o
 * recorte que a política acrescenta. Uma cobrança de outra empresa apontando para este contrato é
 * irrepresentável: a chave estrangeira composta recusa o par que não existe.
 *
 * A devolução sai de `count` do driver, que é **quantas linhas o servidor escreveu** — e não o
 * comprimento de uma lista que a aplicação montou. Não há `RETURNING`: quem chama publica a contagem
 * numa linha de trilha, e trazer N códigos para descartá-los seria transporte sem consumidor.
 */
export async function cancelarCobrancasDoContrato(
  tx: TransactionSql,
  contratoId: string,
): Promise<number> {
  const resultado = await tx`
    UPDATE negocio.cobranca
       SET cancelado_em = now()
     WHERE contrato_id = ${contratoId}::uuid
       AND pago_em IS NULL
       AND cancelado_em IS NULL
  `;

  return resultado.count;
}

/**
 * Executa a escrita e traduz **a violação da restrição de unicidade do código** — o ponto único dela.
 *
 * A escrita corre dentro de um `SAVEPOINT` pela razão que o cabeçalho deste arquivo registra. O
 * desfazimento alcança **só** o que correu dentro dele — o que a unidade gravou antes permanece, e é o
 * que faz esta tradução caber dentro de uma composição maior: a ativação do contrato grava as parcelas
 * na mesma unidade que transita o estado, e uma recusa da escrita não pode apagar a leitura do contrato
 * que a antecedeu.
 *
 * **A devolução é a LISTA de códigos gravados**, e é ela que mantém a tradução num ponto só para as
 * **duas** escritas que emitem código: a avulsa ({@link criarCobranca}) devolve um elemento — ou zero,
 * se a linha não voltar —, e o lote ({@link criarCobrancasEmLote}) devolve N. Uma lista onde antes havia
 * `string | undefined` é a menor mudança que serve às duas: um segundo envoltório para o lote nasceria
 * com a liberdade de traduzir `23505` em bloco, ou de esquecer o `SAVEPOINT` — que é exatamente o modo
 * de falha que este ponto único existe para não ter. O tipo **não** é genérico de propósito:
 * `tx.savepoint` devolve `UnwrapPromiseArray<T>`, que sobre um parâmetro de tipo não se resolve, e a
 * saída seria um `as` largo em cima da única escrita deste arquivo que o cliente não controla.
 *
 * Toda violação que **não** seja a da restrição nomeada é **repassada intacta** — inclusive a de
 * `cobranca_id_empresa_key` e as de `check`, que a mesma escrita pode produzir. Traduzir `23505` em
 * bloco diria ao cliente que o código colidiu quando quem colidiu foi outra coisa.
 *
 * `tx.savepoint` reusa a transação corrente — é exatamente o mecanismo que o `REVERTER EXIGE` do
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts} nomeia como o aninhamento
 * **correto**. Ele **não** contraria aquele marcador: o que a marca recusa é abrir uma segunda
 * unidade (outra conexão, outra transação, com `COMMIT` próprio), e aqui não se abre nenhuma.
 */
async function gravarSobRestricaoDoCodigo(
  tx: TransactionSql,
  escrever: (escrita: TransactionSql) => Promise<readonly string[]>,
): Promise<readonly string[]> {
  try {
    return await tx.savepoint(async (escrita) => await escrever(escrita));
  } catch (erro) {
    if (!ehViolacaoDe(erro, RESTRICAO_DO_CODIGO)) {
      throw erro;
    }

    throw new ErroDeCodigoDeCobrancaEmUso();
  }
}

/**
 * Reconhece a recusa de **uma** restrição nomeada.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver, e
 * o par (`code`, `constraint_name`) é o contrato do protocolo. Casar pelo texto da mensagem seria
 * amarrar a tradução ao idioma configurado no servidor.
 *
 * O nome é **parâmetro** ainda havendo uma tradução só, pela mesma razão de `./contrato.ts`: uma
 * função sem o nome traduziria `23505` em bloco, que é exatamente o que o cabeçalho recusa.
 */
function ehViolacaoDe(erro: unknown, restricao: string): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return falha?.code === VIOLACAO_DE_UNICIDADE && falha.constraint_name === restricao;
}
