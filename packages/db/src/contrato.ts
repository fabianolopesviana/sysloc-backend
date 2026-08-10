/**
 * Contrato de locação — a **porta única** de leitura e escrita dele e do vínculo com o fiador.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./imovel.ts}, {@link ./conjunto.ts} e {@link ./cadastro-de-pessoa.ts} já
 * registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.contrato` numa cadeia sem
 * importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável. Toda
 * instrução que o ciclo de vida do contrato precisa vive aqui — **inclusive** a emissão do número da
 * série, as escritas das duas transições e a leitura dos fiadores em lote.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. Nem mesmo as duas
 * da série: elas invocam funções do banco pelo executor que receberam.
 *
 * {@link lerFiadoresDeContratos} e {@link lerContratosVigentesDeImoveis} **não saem pelo índice** do
 * pacote, pela mesma razão de `lerComodosDeImoveis`: não há rota de leitura de fiador — ele chega e
 * volta dentro do agregado do contrato —, e publicá-la ofereceria à borda um caminho para ler o
 * vínculo sem passar pelo pai. A segunda tem a razão de `lerImoveisDeConjuntos`: publicá-la ofereceria
 * a `apps/api` um caminho para ler contrato **por imóvel** fora das portas que o contrato publica.
 *
 * ---------------------------------------------------------------------------
 * A SÉRIE É EMITIDA PELO BANCO, EM DUAS FUNÇÕES SEPARADAS (ADR-0015, ADR-0020)
 * ---------------------------------------------------------------------------
 *
 * {@link garantirContadorDeContrato} e {@link emitirNumeroDeContrato} são **duas**, e a separação é
 * a decisão: a borda as chama em **duas unidades de trabalho sequenciais** (tech spec §7.4). Fundi-las
 * numa só forçaria a criação da sequência e o consumo dela a caírem na mesma transação — e o
 * desfazimento apagaria a sequência recém-criada, de modo que o contrato seguinte a recriaria e
 * tomaria `nextval = 1` **outra vez**. O número `00001` teria sido **reusado**, contra a cláusula
 * literal da ADR-0015 (*"nunca reusado, nem por registro excluído, nem por criação abortada"*).
 *
 * As duas unidades **não aninham** — a segunda começa depois de a primeira fechar —, então o
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts}, que recusa abrir uma segunda
 * unidade **de dentro** de uma aberta, **não é tocado**.
 *
 * Nenhuma das duas aceita `empresa_id` por parâmetro: elas leem o contexto por dentro e levantam sem
 * ele. Como rodam com os direitos da dona (`SECURITY DEFINER`), aceitar a empresa por argumento
 * daria à aplicação exatamente o poder que a RLS lhe tira. **A aplicação nunca toca a sequência**
 * (ADR-0020, e o marcador `DECISÃO FECHADA` de `migracoes/0008_seguranca_contrato.sql`).
 *
 * ---------------------------------------------------------------------------
 * O ANO VEM DO RELÓGIO DO BANCO — e por isso ele tem um ponto único
 * ---------------------------------------------------------------------------
 *
 * O escopo da série é `(empresa, ano)`, e o ano entra também no código legível. Lê-lo do relógio do
 * **processo** (`new Date().getFullYear()`) o amarraria ao fuso de quem executa — e a borda, a
 * unidade 1 e a unidade 2 poderiam discordar. {@link lerAnoDaSerieDeContrato} é o ponto único: ela
 * pergunta ao servidor, que é a mesma máquina que guarda o contador.
 *
 * E ela é chamada **uma vez**. O ano lido viaja daí em diante **junto do número**, em
 * {@link NumeroDaSerie}, e {@link criarContrato} **não o relê**: uma segunda leitura seria justamente
 * o que permite os dois discordarem. `current_date` é estável dentro de uma transação, mas as duas
 * unidades são **sequenciais** e a virada do ano cabe entre elas — o número teria saído do contador
 * de um ano e o código anunciaria o outro, que é um código que o contador daquele ano ainda vai
 * emitir. Recebendo o par, a discordância deixa de ser representável.
 *
 * O código sai de `formatarCodigoDeContrato`, **importado** de `@sysloc/contracts` — a forma
 * `CTR-{ano}-{5 dígitos}` tem lá o marcador `DECISÃO FECHADA` que fixa a largura, e redigitá-la aqui
 * criaria a segunda fonte do mesmo fato (ADR-0016).
 *
 * ---------------------------------------------------------------------------
 * A UNICIDADE É DO BANCO — e a leitura só acontece DEPOIS da recusa
 * ---------------------------------------------------------------------------
 *
 * Duas restrições podem recusar uma escrita deste arquivo, e cada uma tem tradução **própria**:
 *
 *   * `contrato_empresa_codigo_key` → {@link ErroDeCodigoEmUso};
 *   * `contrato_imovel_vigente_uidx` → {@link ErroDeImovelComContratoVigente}, discriminada pelo
 *     **código do contrato vigente**, lido depois da recusa.
 *
 * **Toda violação `23505` que não seja de uma dessas duas é repassada intacta.** Traduzir em bloco
 * atribuiria à entrada do cliente uma colisão que ele não causou — a de
 * `contrato_fiador_contrato_fiador_key`, por exemplo — e a esconderia atrás de um `422` plausível,
 * que é a pior forma de perder um defeito.
 *
 * **A tradução mora em TODO caminho de escrita capaz de produzir a violação, e não só no mais
 * óbvio.** O índice é `(imovel_id) WHERE status = 'ATIVO'`, de modo que **duas** colunas o alcançam:
 * o `status`, que {@link ativarContrato} escreve, e o `imovel_id`, que {@link alterarContrato}
 * escreve. Note que o alcance do segundo **não depende do `status` que a instrução escreve** — ela
 * não escreve nenhum —, e sim do `status` já gravado na linha: sobre um contrato `ATIVO`, mover o
 * imóvel para um que já tem vigente colide.
 *
 * Ficar só na ativação deixaria a alteração devolver erro de driver ao cliente — o modo de falha que
 * o docblock de `alterarImovel` em {@link ./imovel.ts} nomeia literalmente — e faria a única defesa
 * do segundo caminho ser a recusa de domínio da RD-05, que é do **serviço**. Ela não serve para
 * isso: ler o estado e só então mandar gravar é a janela de corrida descrita logo abaixo — entre o
 * `SELECT` que viu `RASCUNHO` e o `UPDATE`, outra transação ativa o contrato, e o `UPDATE` alcança
 * uma linha que já está no índice.
 *
 * **Não há, em lugar algum deste arquivo, leitura que decida se pode gravar.** Leitura-antes-de-
 * gravar é *janela de corrida disfarçada de validação*: entre o `SELECT` que não achou contrato
 * vigente e o `UPDATE` que ativa, outra transação ativa o dela, e as duas passam. Quem recusa é o
 * índice único parcial, e é o `CT-407` que o mede **sob concorrência real** — um caso sequencial não
 * distingue índice de `if`.
 *
 * ---------------------------------------------------------------------------
 * O SAVEPOINT existe porque a transação ABORTA na violação — leia antes de removê-lo
 * ---------------------------------------------------------------------------
 *
 * No PostgreSQL, um erro dentro de uma transação a coloca em estado abortado: **qualquer** instrução
 * seguinte falha com `25P02` até um `ROLLBACK`. Sem o ponto de retorno, a leitura que **descreve** o
 * conflito seria impossível na mesma unidade — ela já teria sido perdida pela própria recusa que se
 * quer descrever —, e a alternativa seria abrir uma **segunda** unidade depois, o que a decisão D1
 * (unidade aberta na borda) e o `ErroDeUnidadeAninhada` recusam.
 *
 * `tx.savepoint` reusa a transação corrente — é exatamente o mecanismo que o `REVERTER EXIGE` do
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts} nomeia como o aninhamento
 * **correto**. Ele **não** contraria aquele marcador: o que a marca recusa é abrir uma segunda
 * unidade (outra conexão, outra transação, com `COMMIT` próprio), e aqui não se abre nenhuma.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO DE CIRCULAÇÃO É DA PORTA (ADR-0014)
 * ---------------------------------------------------------------------------
 *
 * {@link listarContratos} aplica o predicado **por padrão**, e alcançar os retirados exige o
 * parâmetro nomeado `incluirRetirados`. Quem esquece obtém a listagem correta; quem quer os
 * retirados diz por escrito, e a decisão aparece no diff. É o default invertido que fecha o defeito
 * silencioso que a ADR-0014 nomeia entre os próprios *Cons*.
 *
 * {@link localizarContrato} **não** tem predicado, e a assimetria é deliberada — a recirculação é uma
 * rota sobre o mesmo identificador, e uma leitura que escondesse o retirado tornaria a volta dele
 * inalcançável pela interface.
 *
 * O **vínculo com o fiador**, esse, é removido **de fato** ({@link substituirFiadoresDoContrato}
 * emite `DELETE`). Não é inconsistência: a ADR-0014 exclui *"vínculo ou concessão, cuja linha
 * representa estado de relacionamento"* do alcance da exclusão lógica, e o discriminador dela é
 * **ser referenciável** — nada aponta para uma linha de `negocio.contrato_fiador`. A prova disso não
 * é este comentário: é a **ausência** da coluna `retirado_em` naquela tabela, afirmada pelo `CT-430`.
 *
 * ---------------------------------------------------------------------------
 * A CHAVE DA PORTA É O CÓDIGO (ADR-0017)
 * ---------------------------------------------------------------------------
 *
 * O contrato tem série declarada, então a chave exposta é o **código legível** — e é por ele que
 * {@link localizarContrato}, {@link alterarContrato}, {@link definirCirculacaoDoContrato},
 * {@link ativarContrato} e {@link cancelarContrato} alcançam a linha. O UUID permanece **interno**:
 * ele sai em {@link ContratoPersistido.id} porque é o pai do vínculo de fiador e o alvo da porta
 * estreita de `imovel.ts`, e é a borda que o deixa de fora do corpo publicado.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** As duas tabelas nascem com RLS **forçada**
 * (`migracoes/0008_seguranca_contrato.sql`): a política decide o que cada leitura enxerga e o que
 * cada escrita pode gravar. Não há aqui um `WHERE empresa_id = …` — a defesa em profundidade que a
 * `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é
 * `NOT NULL` e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal
 * das políticas, avaliada dentro da própria instrução. E o contrato que apontasse para imóvel,
 * locador, locatário ou fiador de **outra** empresa é impossível sem que nada aqui o confira: as
 * quatro chaves estrangeiras compostas recusam o par que não existe.
 */

import {
  type Contrato,
  type ContratoVigenteDoImovel,
  type EstadoDoContrato,
  formatarCodigoDeContrato,
} from '@sysloc/contracts';
import type { Fragment, TransactionSql } from 'postgres';
// O tipo é da **decisão**, e não da entidade: `{ incluirRetirados }` é o parâmetro nomeado que a
// ADR-0014 obriga toda porta de leitura a expor, e ele já nasceu publicado pelo pacote. Declarar um
// gêmeo aqui daria dois nomes ao mesmo parâmetro na superfície pública. Mesma importação, e mesma
// razão, de `./imovel.ts` e de `./cadastro-de-pessoa.ts`. O que se importa é o tipo: `conjunto.ts`
// não é tocado.
import type { OpcoesDeCirculacao } from './conjunto.js';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts`. Ele **não é
// filtro** sobre as duas tabelas — nenhuma leitura deste arquivo o aplica, porque elas já têm
// política e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a
// **escrita**, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDeContratos {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * O padrão da porta: **só o que circula**.
 *
 * Ele é o valor omitido de {@link listarContratos}, e é o que faz o esquecimento produzir a listagem
 * correta em vez do defeito silencioso da ADR-0014. Congelado porque é constante compartilhada entre
 * todas as chamadas que não declaram nada.
 */
const SO_EM_CIRCULACAO: OpcoesDeCirculacao = Object.freeze({ incluirRetirados: false });

/**
 * O fiador como o agregado do contrato o publica — o par `{ id, nome }`.
 *
 * **Derivado** de `esquemaDoContrato`, e não redigitado: o contrato de saída é a fonte única da
 * forma (ADR-0016), e duas declarações do mesmo par ficariam livres para divergir. Aqui o UUID
 * trafega legitimamente — fiador é entidade **sem** série declarada, e a ADR-0017 lhe dá o UUID como
 * chave exposta.
 */
export type FiadorDoContrato = Contrato['fiadores'][number];

/**
 * Os campos que o cliente informa de um contrato — os mesmos na montagem e na alteração (§4.1.1).
 *
 * `codigo`, `status`, `dataFimLocacao`, `valorTotalContrato` e `retiradoEm` **não estão aqui**, e a
 * ausência é o mecanismo: os cinco são decididos pelo servidor. O código é emitido pela série; o
 * estado tem rota própria (ADR-0021); as duas derivações nascem na ativação; a circulação tem porta
 * própria. Um caminho que os aceitasse por este tipo seria a segunda fonte de estado que a RN-03
 * elimina.
 *
 * `fiadoresIds` entra porque a coleção é **substituída por inteiro** junto com o corpo — não há
 * sub-recurso de fiador, e a lista ausente seria "preserve o que estava lá", que esta superfície não
 * admite.
 *
 * `dataInicioLocacao` é cadeia `YYYY-MM-DD`, e não `Date`: a coluna é `date`, e um objeto `Date`
 * reserializado com o fuso do processo desloca a data em um dia para metade dos fusos (§6.2).
 */
export interface DadosDoContrato {
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadoresIds: readonly string[];
  readonly dataInicioLocacao: string;
  readonly prazoMeses: number;
  readonly valorMensal: number;
  readonly diaVencimento: number;
  readonly gerarCobrancasAutomaticamente: boolean;
  readonly pdfContratoArquivo: string | null;
}

/**
 * O número da série **com o ano do contador que o emitiu** — os dois juntos, e nunca separados.
 *
 * Ele é um par, e não dois parâmetros, pelo mesmo motivo de {@link DerivacoesDaAtivacao}: o que
 * chega à porta é o resultado de um ato anterior — aqui, o `nextval` do contador de
 * `(empresa, ano)` —, e separar as duas metades permitiria a {@link criarContrato} compor o código
 * com um ano que não é o daquele contador. Dois `number` adjacentes na assinatura ainda teriam a
 * segunda falha, a da troca silenciosa de posição.
 *
 * O ano vem de {@link lerAnoDaSerieDeContrato}, lido **uma vez** pela borda e usado nas duas
 * unidades sequenciais; o número, de {@link emitirNumeroDeContrato}, chamado com esse mesmo ano.
 */
export interface NumeroDaSerie {
  readonly ano: number;
  readonly numero: number;
}

/**
 * O que a ativação grava além do estado — as duas derivações da RD-10, **já calculadas**.
 *
 * Elas chegam prontas de propósito: quem as produz é `derivarTerminoDaLocacao` e `derivarValorTotal`
 * de {@link ./derivacao-de-contrato.ts}, o ponto único que a RD-10 exige. Recalculá-las aqui —
 * mesmo "só a multiplicação" — criaria a segunda fonte do mesmo fato, e ela divergiria em silêncio
 * justamente nos casos que o golden fixa (a saturação da virada de mês, o resíduo binário do
 * produto).
 */
export interface DerivacoesDaAtivacao {
  /** A data de fim, em `YYYY-MM-DD`. */
  readonly dataFimLocacao: string;
  readonly valorTotalContrato: number;
}

/** Uma linha de `negocio.contrato`, na projeção que o contrato publica, com os fiadores junto. */
export interface ContratoPersistido {
  /**
   * A chave **interna**. Ela não trafega no corpo publicado (ADR-0017) — sai daqui porque é o pai de
   * `negocio.contrato_fiador` e o que a porta estreita de `./imovel.ts` precisa alcançar.
   */
  readonly id: string;
  /** A chave **exposta** (ADR-0017): `CTR-{ano}-{5 dígitos}`, único por empresa. */
  readonly codigo: string;
  readonly status: EstadoDoContrato;
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  /** Os fiadores do contrato, ordenados por nome. Ver {@link montarContrato}. */
  readonly fiadores: readonly FiadorDoContrato[];
  /** Cadeia `YYYY-MM-DD` — nunca um `Date`. Ver {@link colunasDoContrato}. */
  readonly dataInicioLocacao: string;
  readonly prazoMeses: number;
  readonly valorMensal: number;
  readonly diaVencimento: number;
  /** Nula enquanto o contrato não foi ativado (RD-10). */
  readonly dataFimLocacao: string | null;
  /** Nulo enquanto o contrato não foi ativado (RD-10). */
  readonly valorTotalContrato: number | null;
  readonly gerarCobrancasAutomaticamente: boolean;
  readonly pdfContratoArquivo: string | null;
  /** A marca da exclusão lógica (ADR-0014): nula enquanto circula, o instante da retirada depois. */
  readonly retiradoEm: Date | null;
}

/**
 * O que a consulta de fato lê da tabela.
 *
 * Os fiadores não são coluna (são a leitura em lote de {@link lerFiadoresDeContratos}), e as duas
 * grandezas monetárias voltam do driver **em texto**, porque `numeric` não cabe em ponto flutuante
 * sem perda — ver {@link contratoPublicado}.
 */
interface LinhaDoContrato
  extends Omit<ContratoPersistido, 'fiadores' | 'valorMensal' | 'valorTotalContrato'> {
  readonly valorMensal: string;
  readonly valorTotalContrato: string | null;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeContratosPersistidos {
  readonly contratos: readonly ContratoPersistido[];
  readonly total: number;
}

/**
 * O código emitido já pertence a outro contrato **desta empresa**.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de
 * API. Quem o traduz no envelope da ADR-0017 é a borda, num ponto único.
 *
 * Ele existe porque a colisão é **possível sem ser culpa do cliente**: a série pode ter sido semeada
 * para trás na virada (F7), ou o contador de um ano pode ter sido alcançado por um código gravado
 * antes dele. Sem tradução, a recusa chegaria ao cliente como erro de driver em `500`.
 *
 * **A mensagem não carrega o código recusado**, pela mesma razão de `ErroDeIdentificadorMunicipalEmUso`:
 * a mensagem chega ao registro estruturado, e o que o usuário precisa saber viaja em campo nomeado.
 */
export class ErroDeCodigoEmUso extends Error {
  override readonly name: string = 'ErroDeCodigoEmUso';

  constructor() {
    super('o código emitido já pertence a outro contrato desta empresa');
  }
}

/**
 * O imóvel já tem contrato vigente — a recusa da RD-09, vinda do **índice único parcial**.
 *
 * O discriminante é o **código do contrato vigente**, e ele é lido **depois** da recusa: é o que
 * permite à interface dizer *qual* contrato ocupa o imóvel, em vez de mandar o usuário procurar. A
 * leitura não decide se pode gravar — quando ela corre, o banco já recusou.
 */
export class ErroDeImovelComContratoVigente extends Error {
  override readonly name: string = 'ErroDeImovelComContratoVigente';

  /** O código do contrato que já vigora sobre o imóvel — é ele que discrimina a recusa. */
  readonly contratoVigente: string;

  constructor(contratoVigente: string) {
    super('o imóvel já tem contrato vigente');
    this.contratoVigente = contratoVigente;
  }
}

/**
 * O nome da restrição que impõe a unicidade do código, como o servidor a reporta.
 *
 * Ele é **discriminante**: `negocio.contrato` tem duas restrições únicas e um índice único parcial, e
 * as outras duas têm significado completamente diferente — `contrato_id_empresa_key` é o alvo das
 * chaves estrangeiras compostas do vínculo de fiador.
 */
const RESTRICAO_DO_CODIGO = 'contrato_empresa_codigo_key';

/**
 * O nome do **índice** único parcial da vigência, como o servidor o reporta.
 *
 * É índice, e não restrição, porque o PostgreSQL não admite restrição única parcial — a razão está
 * por extenso no marcador `DECISÃO FECHADA` de `src/esquema/negocio.ts`. Para o campo
 * `constraint_name` do erro isso não faz diferença: o servidor reporta o nome do índice que recusou.
 */
const INDICE_DA_VIGENCIA = 'contrato_imovel_vigente_uidx';

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar as duas acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * Os três estados que esta porta **escreve**, nomeados uma vez cada.
 *
 * `ENCERRADO` não aparece porque não tem produtor nesta fatia (a rotina agendada é da F5), e
 * inventar-lhe uma escrita aqui seria oferecer uma transição que ninguém declarou.
 *
 * A anotação é `EstadoDoContrato` de propósito: literal fora da união fechada de `@sysloc/contracts`
 * **não compila**, e é isso que impede um estado inventado de chegar ao enum do banco.
 */
const ESTADO_INICIAL: EstadoDoContrato = 'RASCUNHO';
const ESTADO_VIGENTE: EstadoDoContrato = 'ATIVO';
const ESTADO_CANCELADO: EstadoDoContrato = 'CANCELADO';

/**
 * O formato em que as duas colunas `date` viajam — **cadeia**, nunca objeto `Date`.
 *
 * Escrito uma vez e usado nas duas colunas da projeção: duas grafias ficariam livres para divergir, e
 * a divergência apareceria como uma data deslocada num campo que o CA-20 compara contra o oráculo.
 */
const FORMATO_ISO_DA_DATA = 'YYYY-MM-DD';

/**
 * A projeção publicada, escrita **uma vez** e reusada por todas as consultas deste arquivo.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo padrão, e mesma
 * justificativa, de `colunasDoImovel` em {@link ./imovel.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede seis traduções livres para divergir. E `empresa_id`
 * **não** está na lista — o que a porta devolve é o que o contrato publica, e a coluna de tenant não
 * é publicada.
 *
 * As duas datas saem por `to_char`, e a escolha é conteúdo: o driver entregaria uma coluna `date`
 * como objeto `Date` no fuso do processo, e reserializá-lo desloca a data em um dia para metade dos
 * fusos (§6.2). A cadeia atravessa da consulta até o JSON sem passar por relógio nenhum.
 */
function colunasDoContrato(tx: TransactionSql): Fragment {
  return tx`
    id,
    codigo,
    status,
    imovel_id AS "imovelId",
    locador_id AS "locadorId",
    locatario_id AS "locatarioId",
    to_char(data_inicio_locacao, ${FORMATO_ISO_DA_DATA}) AS "dataInicioLocacao",
    prazo_meses AS "prazoMeses",
    valor_mensal AS "valorMensal",
    dia_vencimento AS "diaVencimento",
    to_char(data_fim_locacao, ${FORMATO_ISO_DA_DATA}) AS "dataFimLocacao",
    valor_total_contrato AS "valorTotalContrato",
    gerar_cobrancas_automaticamente AS "gerarCobrancasAutomaticamente",
    pdf_contrato_arquivo AS "pdfContratoArquivo",
    retirado_em AS "retiradoEm"
  `;
}

/**
 * O predicado de circulação — **o ponto único** onde "retirado some da lista" vira instrução.
 *
 * Um fragmento, e não uma comparação com parâmetro (`${incluir} OR retirado_em IS NULL`), por duas
 * razões: o índice `contrato_empresa_retirado_idx` cobre o par `(empresa_id, retirado_em)` que a
 * forma abaixo consulta, e a disjunção com parâmetro esconderia do planejador o que a consulta de
 * fato pede. E ele é **um só** para a página e para o total: duas escritas do mesmo recorte fariam a
 * contagem descrever um conjunto do qual a página já não faz parte.
 */
function predicadoDeCirculacao(tx: TransactionSql, opcoes: OpcoesDeCirculacao): Fragment {
  return opcoes.incluirRetirados ? tx`TRUE` : tx`retirado_em IS NULL`;
}

/**
 * A linha crua no contrato que a porta entrega — **o ponto único** da conversão de `numeric`.
 *
 * `Number(…)` sobre o texto do driver é o que faz as duas grandezas monetárias chegarem ao consumidor
 * como número; sem esta linha o JSON sairia com `"2500.00"` entre aspas e **nada acusaria**. Mesma
 * decisão, e mesma razão medida, de `comodoPublicado` em {@link ./comodo.ts}.
 *
 * O nulo atravessa **intacto**: `Number(null)` é `0`, e um contrato em rascunho passaria a declarar
 * valor total zero em vez de "ainda não derivado" — que é exatamente a distinção que a RD-10 exige.
 *
 * Os campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna
 * que a projeção venha a ganhar, inclusive `empresa_id`.
 */
function contratoPublicado(
  linha: LinhaDoContrato,
  fiadores: readonly FiadorDoContrato[],
): ContratoPersistido {
  return {
    id: linha.id,
    codigo: linha.codigo,
    status: linha.status,
    imovelId: linha.imovelId,
    locadorId: linha.locadorId,
    locatarioId: linha.locatarioId,
    fiadores,
    dataInicioLocacao: linha.dataInicioLocacao,
    prazoMeses: linha.prazoMeses,
    valorMensal: Number(linha.valorMensal),
    diaVencimento: linha.diaVencimento,
    dataFimLocacao: linha.dataFimLocacao,
    valorTotalContrato: linha.valorTotalContrato === null ? null : Number(linha.valorTotalContrato),
    gerarCobrancasAutomaticamente: linha.gerarCobrancasAutomaticamente,
    pdfContratoArquivo: linha.pdfContratoArquivo,
    retiradoEm: linha.retiradoEm,
  };
}

/** O agregado de um contrato sem fiador algum. Congelado — é compartilhado por toda leitura. */
const SEM_FIADORES: readonly FiadorDoContrato[] = Object.freeze([]);

/**
 * Monta o agregado de **um** contrato. `undefined` atravessa intacto — é a ausência da porta.
 *
 * Ela e {@link comAgregadoEmLote} compartilham a **mesma** consulta de fiadores e o **mesmo**
 * montador, e é por isso que existem duas em vez de uma: a diferença entre elas é o número de
 * contratos, e uma listagem que chamasse esta em laço faria uma consulta por linha da página.
 */
async function comAgregado(
  tx: TransactionSql,
  linha: LinhaDoContrato | undefined,
): Promise<ContratoPersistido | undefined> {
  if (linha === undefined) {
    return undefined;
  }

  const porContrato = await lerFiadoresDeContratos(tx, [linha.id]);

  return contratoPublicado(linha, porContrato.get(linha.id) ?? SEM_FIADORES);
}

/**
 * Monta o agregado de uma página inteira com **uma** consulta de fiadores, qualquer que seja o
 * tamanho dela (§12.2).
 *
 * O contrato sem fiador nenhum não aparece no mapa — a consulta devolve linha só para quem tem —, e
 * `SEM_FIADORES` é o resultado verdadeiro dela, não um padrão que substitui a leitura.
 */
async function comAgregadoEmLote(
  tx: TransactionSql,
  linhas: readonly LinhaDoContrato[],
): Promise<ContratoPersistido[]> {
  const porContrato = await lerFiadoresDeContratos(
    tx,
    linhas.map((linha) => linha.id),
  );

  return linhas.map((linha) => contratoPublicado(linha, porContrato.get(linha.id) ?? SEM_FIADORES));
}

/**
 * Lê os fiadores de N contratos, agrupados pelo contrato de cada um — **uma** consulta para a página
 * inteira (§12.2).
 *
 * Ela recebe **a lista**, e não um contrato, pela razão de `lerComodosDeImoveis`: uma função por
 * contrato faria a paginação emitir uma consulta por linha. A lista vazia devolve o mapa vazio **sem
 * consultar** — pagar uma ida ao banco para saber que `= ANY('{}')` não casa nada é custo sem
 * informação.
 *
 * A junção com `negocio.fiador` traz o **nome**, que é o que a tela exibe; devolver só o UUID
 * obrigaria o cliente a uma chamada por fiador. Ela alcança o fiador **retirado de circulação** de
 * propósito: o contrato continua apontando para ele, e escondê-lo faria a leitura do contrato mentir
 * sobre a própria composição.
 *
 * A ordem é `nome, id`, e o desempate importa: dois fiadores homônimos são possíveis (a unicidade do
 * cadastro é por documento), e um empate faria a ordem do agregado ficar indefinida entre leituras.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: as duas tabelas já têm política, e um segundo
 * caminho para o mesmo recorte é o que a ADR-0008 rejeita.
 */
async function lerFiadoresDeContratos(
  tx: TransactionSql,
  contratosIds: readonly string[],
): Promise<Map<string, readonly FiadorDoContrato[]>> {
  const porContrato = new Map<string, FiadorDoContrato[]>();

  if (contratosIds.length === 0) {
    return porContrato;
  }

  const linhas = await tx<{ contratoId: string; id: string; nome: string }[]>`
    SELECT vinculo.contrato_id AS "contratoId",
           fiador.id,
           fiador.nome
      FROM negocio.contrato_fiador AS vinculo
      JOIN negocio.fiador AS fiador ON fiador.id = vinculo.fiador_id
     WHERE vinculo.contrato_id = ANY(${[...contratosIds]}::uuid[])
     ORDER BY vinculo.contrato_id, fiador.nome, fiador.id
  `;

  for (const linha of linhas) {
    const doContrato = porContrato.get(linha.contratoId) ?? [];
    doContrato.push({ id: linha.id, nome: linha.nome });
    porContrato.set(linha.contratoId, doContrato);
  }

  return porContrato;
}

/**
 * Lê o contrato **vigente** de N imóveis, com o locatário de cada um, agrupado pelo imóvel — **uma**
 * consulta para qualquer número de imóveis.
 *
 * ---------------------------------------------------------------------------
 * Ela recebe A LISTA, e é isso que a distingue de uma leitura por imóvel
 * ---------------------------------------------------------------------------
 *
 * Ela é o que `./imovel.ts` compõe no agregado, e o agregado serve às **três** superfícies que
 * publicam imóvel — a leitura por identificador, a listagem e a carteira expandida. Uma função por
 * imóvel faria a listagem e a carteira emitirem uma consulta por linha, que é o padrão N+1 que a
 * §12.2 nomeia com todas as letras. Recebendo a lista, o custo é **um**, e o `CT-420` o mede
 * comparando dois cenários de tamanhos diferentes.
 *
 * A lista vazia devolve o mapa vazio **sem consultar**, pela razão de `lerComodosDeImoveis`: pagar uma
 * ida ao banco para saber que `= ANY('{}')` não casa nada é custo sem informação.
 *
 * ---------------------------------------------------------------------------
 * O FILTRO É O ESTADO, e a marca de circulação NÃO entra — RN-15
 * ---------------------------------------------------------------------------
 *
 * O predicado é `status = 'ATIVO'`, e **só ele**. Acrescentar `retirado_em IS NULL` faria a retirada
 * de circulação do contrato **liberar o imóvel por via oblíqua** — exatamente o que a RN-15 proíbe e o
 * que `definirCirculacaoDoContrato` registra: a retirada é de **visibilidade**, não muda o estado e
 * não libera o imóvel. É a ADR-0014 aplicada: o contrato retirado permanece legível e continua
 * vigente, e a marca é **ortogonal** ao estado. Pelo mesmo motivo a junção não consulta a circulação
 * do **locatário**: o contrato continua apontando para ele, e escondê-lo faria a leitura mentir sobre
 * quem ocupa o imóvel.
 *
 * O resultado é um mapa de **um valor por imóvel**, e não de uma lista, porque o índice único parcial
 * `contrato_imovel_vigente_uidx` garante no máximo um vigente por imóvel — a cardinalidade é do banco,
 * e não de um `ORDER BY` mais um `[0]` escritos aqui.
 *
 * ---------------------------------------------------------------------------
 * A JUNÇÃO NÃO REPETE O RECORTE DA POLÍTICA (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * Não há `WHERE empresa_id` aqui, e a junção **não** carrega `AND locatario.empresa_id =
 * contrato.empresa_id`: as duas tabelas já têm RLS forçada, a política recorta as duas, e um segundo
 * caminho para o mesmo recorte é a defesa em profundidade que a `Decision` da ADR-0008 rejeita por
 * escrito. A coerência do par é da **chave estrangeira composta** `contrato_locatario_empresa_fkey`,
 * que torna o vínculo cruzado impossível pelo banco.
 */
export async function lerContratosVigentesDeImoveis(
  tx: TransactionSql,
  imoveisIds: readonly string[],
): Promise<Map<string, ContratoVigenteDoImovel>> {
  const porImovel = new Map<string, ContratoVigenteDoImovel>();

  if (imoveisIds.length === 0) {
    return porImovel;
  }

  const linhas = await tx<
    { imovelId: string; codigo: string; locatarioId: string; locatarioNome: string }[]
  >`
    SELECT contrato.imovel_id AS "imovelId",
           contrato.codigo,
           locatario.id AS "locatarioId",
           locatario.nome AS "locatarioNome"
      FROM negocio.contrato AS contrato
      JOIN negocio.locatario AS locatario ON locatario.id = contrato.locatario_id
     WHERE contrato.imovel_id = ANY(${[...imoveisIds]}::uuid[])
       AND contrato.status = ${ESTADO_VIGENTE}
  `;

  for (const linha of linhas) {
    porImovel.set(linha.imovelId, {
      codigo: linha.codigo,
      locatario: { id: linha.locatarioId, nome: linha.locatarioNome },
    });
  }

  return porImovel;
}

/**
 * O ano corrente **segundo o relógio do banco** — o ponto único do escopo da série.
 *
 * Ela existe porque o ano aparece em três lugares que precisam concordar: o contador que
 * {@link garantirContadorDeContrato} cria, o número que {@link emitirNumeroDeContrato} consome e o
 * código que {@link criarContrato} compõe. Lido do relógio do processo, o valor dependeria do fuso de
 * quem executa — e a borda, que abre **duas unidades sequenciais**, poderia atravessar a virada do
 * ano entre elas com dois valores diferentes em mãos.
 *
 * `current_date` é avaliado pelo servidor, que é a mesma máquina que guarda o contador. O ano cai
 * naturalmente na faixa 2000–2999 que as duas funções do banco guardam.
 */
export async function lerAnoDaSerieDeContrato(tx: TransactionSql): Promise<number> {
  const [linha] = await tx<{ ano: number }[]>`
    SELECT extract(year FROM current_date)::integer AS ano
  `;

  if (linha === undefined) {
    // Inalcançável: a consulta é um `SELECT` de expressão constante, que sempre devolve uma linha. O
    // ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele trocaria
    // uma falha nomeada por um `NaN` viajando dentro de um código de contrato.
    throw new Error('o relógio do banco não devolveu o ano da série');
  }

  return linha.ano;
}

/**
 * Garante que o contador do escopo `(empresa do contexto, ano)` existe. Idempotente.
 *
 * **A borda a chama na PRIMEIRA unidade de trabalho, que commita antes da segunda abrir** — ver o
 * cabeçalho deste arquivo para por que fundi-la com {@link emitirNumeroDeContrato} reabriria o reuso
 * do número `00001`.
 *
 * A empresa **não** é parâmetro: a função do banco a lê do contexto da transação e levanta sem ele. O
 * `::integer` no ano não é ornamento — sem ele o driver poderia enviar o valor como `bigint`, e a
 * resolução de sobrecarga não acharia a função declarada sobre `integer`.
 */
export async function garantirContadorDeContrato(tx: TransactionSql, ano: number): Promise<void> {
  await tx`SELECT negocio.garantir_contador_de_contrato(${ano}::integer)`;
}

/**
 * Consome o contador do escopo `(empresa do contexto, ano)` e devolve o número emitido.
 *
 * **O avanço não participa do desfazimento** (ADR-0020): a transação que aborta depois de chamar esta
 * função queima o número para sempre, e é exatamente esse o furo que a ADR-0015 aceita por escrito —
 * é o preço de duas criações concorrentes **não esperarem** uma pela outra. O `CT-404` mede o furo e
 * o `CT-405` mede a ausência de fila.
 *
 * O número volta como `bigint`, que o driver entrega em cadeia de caracteres; a conversão explícita é
 * o que impede o sequencial de chegar ao formatador do código como texto.
 */
export async function emitirNumeroDeContrato(tx: TransactionSql, ano: number): Promise<number> {
  const [linha] = await tx<{ numero: string }[]>`
    SELECT negocio.proximo_numero_de_contrato(${ano}::integer) AS numero
  `;

  if (linha === undefined) {
    // Inalcançável: a função ou devolve o número ou levanta. O ramo existe porque o tipo do driver
    // admite o arranjo vazio, e um `as` no lugar dele deixaria um `NaN` virar código de contrato.
    throw new Error('a série do contrato não devolveu número');
  }

  return Number(linha.numero);
}

/**
 * Grava um contrato e os fiadores dele, **no mesmo commit**, e devolve a linha como ela ficou.
 *
 * O contrato nasce `RASCUNHO` e **em circulação** — `retirado_em` é nulo por ausência de valor, e não
 * por um valor escrito aqui: a coluna é anulável e o estado inicial é o da tabela. `data_fim_locacao`
 * e `valor_total_contrato` nascem **nulos** pela mesma ausência: são derivados da ativação (RD-10), e
 * inventá-los aqui seria decidir na criação o que só a ativação sabe.
 *
 * A {@link NumeroDaSerie} chega **pronta**: o ano de {@link lerAnoDaSerieDeContrato} e o número de
 * {@link emitirNumeroDeContrato}, os dois obtidos pela borda e **entregues juntos**. Esta função
 * **não relê o ano** — a razão está no cabeçalho, e ela é o que impede o código de anunciar um
 * contador que não emitiu aquele número. O código sai de `formatarCodigoDeContrato`, importado.
 * Nenhuma das três coisas é redigitada aqui.
 *
 * A recusa por código repetido vem do **banco**, e chega ao chamador como {@link ErroDeCodigoEmUso}.
 * A violação de qualquer **outra** restrição — a do mesmo fiador citado duas vezes, entre elas — sobe
 * intacta. Ver {@link gravarSobRestricaoDoCodigo}.
 */
export async function criarContrato(
  tx: TransactionSql,
  dados: DadosDoContrato,
  serie: NumeroDaSerie,
): Promise<ContratoPersistido> {
  const codigo = formatarCodigoDeContrato(serie.ano, serie.numero);

  const contrato = await gravarSobRestricaoDoCodigo(tx, async (escrita) => {
    const [linha] = await escrita<LinhaDoContrato[]>`
      INSERT INTO negocio.contrato (
        empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
        data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento,
        gerar_cobrancas_automaticamente, pdf_contrato_arquivo
      )
      VALUES (
        ${empresaDoContexto(escrita)}, ${codigo}, ${dados.imovelId}, ${dados.locadorId},
        ${dados.locatarioId}, ${ESTADO_INICIAL},
        ${dados.dataInicioLocacao}, ${dados.prazoMeses}, ${dados.valorMensal},
        ${dados.diaVencimento}, ${dados.gerarCobrancasAutomaticamente}, ${dados.pdfContratoArquivo}
      )
      RETURNING ${colunasDoContrato(escrita)}
    `;

    if (linha !== undefined) {
      // Os vínculos entram na MESMA escrita, e sob o mesmo ponto de retorno: a composição da §7.4 é
      // "o contrato e os fiadores num commit só", e um vínculo recusado tem de desfazer o contrato
      // junto — senão nasceria um contrato com a coleção pela metade.
      await substituirFiadoresDoContrato(escrita, linha.id, dados.fiadoresIds);
    }

    return linha;
  });

  if (contrato === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um contrato.
    throw new Error('o contrato foi gravado e a linha não voltou do INSERT');
  }

  // O agregado é lido do mesmo jeito que em toda outra porta: a consulta é que devolve os fiadores, e
  // não um literal escrito aqui. Ler é o que faz a composição enxergar o que a MESMA unidade acabou
  // de gravar.
  const agregado = await comAgregado(tx, contrato);

  if (agregado === undefined) {
    // Inalcançável: `comAgregado` só devolve `undefined` quando a linha recebida é `undefined`, e o
    // ramo acima já a excluiu.
    throw new Error('o contrato foi gravado e o agregado de fiadores não o devolveu');
  }

  return agregado;
}

/**
 * Lê uma página de contratos e o total do conjunto inteiro, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos.
 *
 * **A ordem é `codigo`, e ela dispensa desempate** — diferente de `nome_imovel` em
 * {@link ./imovel.ts}: o código é único por empresa (`contrato_empresa_codigo_key`), de modo que não
 * há homônimo capaz de fazer a mesma linha aparecer em duas páginas ou em nenhuma. Ela é também a
 * ordem que o usuário reconhece, porque o código é o título do contrato nas telas.
 *
 * **O predicado de circulação é aplicado por padrão**, e o `opcoes` omitido é o caminho correto.
 */
export async function listarContratos(
  tx: TransactionSql,
  janela: JanelaDeContratos,
  opcoes: OpcoesDeCirculacao = SO_EM_CIRCULACAO,
): Promise<PaginaDeContratosPersistidos> {
  const linhas = await tx<LinhaDoContrato[]>`
    SELECT ${colunasDoContrato(tx)}
      FROM negocio.contrato
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
     ORDER BY codigo
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.contrato
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return {
    contratos: await comAgregadoEmLote(tx, linhas),
    total: Number(contagem?.total ?? 0),
  };
}

/**
 * Localiza o contrato pelo **código**. `undefined` quando o contexto corrente não o alcança.
 *
 * As duas causas da ausência são deliberadamente **indistinguíveis**: o contrato não existe, ou
 * existe e é de outra empresa. A borda traduz as duas no mesmo `404 RECURSO_NAO_ENCONTRADO` — a
 * recusa é consequência de não achar, e não de uma comparação de empresa escrita na aplicação
 * (ADR-0008).
 *
 * **Ela alcança o retirado de circulação**, e o cabeçalho deste arquivo registra por quê.
 */
export async function localizarContrato(
  tx: TransactionSql,
  codigo: string,
): Promise<ContratoPersistido | undefined> {
  const [linha] = await tx<LinhaDoContrato[]>`
    SELECT ${colunasDoContrato(tx)}
      FROM negocio.contrato
     WHERE codigo = ${codigo}
  `;

  return await comAgregado(tx, linha);
}

/**
 * Reescreve os campos informados do contrato, substitui a coleção de fiadores por inteiro e devolve a
 * linha nova. `undefined` quando não alcançado.
 *
 * O corpo é **completo** (§4.1.1): não há atualização parcial nesta superfície, e campo ausente é
 * recusa por campo obrigatório na borda — nunca "preserve o que estava lá".
 *
 * **Cinco colunas não são tocadas, e a ausência delas nesta instrução é o mecanismo**: `codigo`
 * (emitido uma vez e citado fora do sistema — a ADR-0015 existe para mantê-lo estável), `status` (a
 * transição é rota própria, ADR-0021), `retirado_em` (a circulação tem porta própria; reuni-las faria
 * uma correção de valor carregar, por descuido, uma mudança de visibilidade) e as duas derivações da
 * ativação (RD-10).
 *
 * **Quem recusa alterar um contrato que já não é rascunho é o serviço** (RD-05), num ponto único, e
 * não esta porta: a recusa é do domínio e precisa nomear o estado atual na resposta, o que esta
 * camada — que não conhece HTTP — não faz.
 *
 * **Mas a tradução do índice de vigência é DAQUI, e não daquela recusa.** Esta instrução escreve
 * `imovel_id`, que é **a chave** de `contrato_imovel_vigente_uidx`. Ela não escreve `status`, e é o
 * `status` **já gravado** na linha que decide se ela está dentro do índice: sobre um contrato
 * `ATIVO`, mover o imóvel para um que já tem vigente colide. Apoiar-se na RD-05 para que isso nunca
 * aconteça seria apoiar-se numa leitura-antes-de-gravar — entre o `SELECT` do serviço e este
 * `UPDATE` cabe uma ativação concorrente —, e o cabeçalho deste arquivo recusa esse desenho por
 * escrito. Por isso a escrita corre sob {@link gravarSobIndiceDeVigencia}, como `alterarImovel`
 * corre sob o envoltório da unicidade dele.
 *
 * A restrição do **código** continua sem tradução aqui, e a razão é de outra natureza: `codigo` não
 * está nesta instrução, e coluna que não se escreve não colide.
 */
export async function alterarContrato(
  tx: TransactionSql,
  codigo: string,
  dados: DadosDoContrato,
): Promise<ContratoPersistido | undefined> {
  // DECISÃO FECHADA — T5 / Gate 2 · 2026-08-09
  // O QUÊ: a alteração corre sob `gravarSobIndiceDeVigencia`, e não direto no `tx`.
  // POR QUÊ: `imovel_id` é a CHAVE de `contrato_imovel_vigente_uidx`, e o alcance ao índice depende
  //          do `status` já gravado na linha — não do que esta instrução escreve, que não inclui
  //          `status` nenhum. A primeira escrita desta porta omitiu o envoltório apoiada na recusa
  //          da RD-05, que é do serviço e é leitura-antes-de-gravar: entre o `SELECT` que vê
  //          `RASCUNHO` e este `UPDATE` cabe uma ativação concorrente, e o `23505` chegaria cru ao
  //          cliente como `500`. O `CT-407 (b)` mede as duas metades — a classe traduzida e o
  //          discriminante correto.
  // REVERTER EXIGE: provar que nenhuma escrita desta porta alcança o índice sem passar por aqui —
  //          o que é falso enquanto `imovel_id` estiver nesta instrução.
  const linha = await gravarSobIndiceDeVigencia(
    tx,
    { origem: 'informado', imovelId: dados.imovelId },
    async (escrita) => {
      const [alterada] = await escrita<LinhaDoContrato[]>`
        UPDATE negocio.contrato
           SET imovel_id = ${dados.imovelId},
               locador_id = ${dados.locadorId},
               locatario_id = ${dados.locatarioId},
               data_inicio_locacao = ${dados.dataInicioLocacao},
               prazo_meses = ${dados.prazoMeses},
               valor_mensal = ${dados.valorMensal},
               dia_vencimento = ${dados.diaVencimento},
               gerar_cobrancas_automaticamente = ${dados.gerarCobrancasAutomaticamente},
               pdf_contrato_arquivo = ${dados.pdfContratoArquivo}
         WHERE codigo = ${codigo}
        RETURNING ${colunasDoContrato(escrita)}
      `;

      if (alterada !== undefined) {
        // Os vínculos entram sob o MESMO ponto de retorno, pela razão de {@link criarContrato}: o
        // corpo é completo, e uma coleção recusada tem de desfazer a alteração junto — senão a linha
        // ficaria com os campos novos e os fiadores velhos.
        await substituirFiadoresDoContrato(escrita, alterada.id, dados.fiadoresIds);
      }

      return alterada;
    },
  );

  return await comAgregado(tx, linha);
}

/**
 * Substitui **por inteiro** a coleção de fiadores do contrato.
 *
 * Remove e insere, e o `DELETE` é literal: a ADR-0014 exclui **vínculo** do alcance da exclusão
 * lógica, porque a linha representa estado de relacionamento e nada aponta para ela. É o mesmo
 * mecanismo do ajuste bidirecional da matriz de permissões, e a prova de que a decisão vale aqui é a
 * **ausência** da coluna `retirado_em` em `negocio.contrato_fiador` (CT-430).
 *
 * Substituir por inteiro, e não mesclar, é o que o corpo completo da superfície implica: a lista que
 * chega **é** a coleção, e um vínculo que ela não cita deixou de existir. Mesclar exigiria distinguir
 * "não informado" de "removido", distinção que este contrato não tem.
 *
 * A lista vazia é caso legítimo — contrato sem fiador é o caso comum medido no sistema antigo — e ela
 * **não** emite o `INSERT`: o `unnest` de um arranjo vazio não produz linha alguma, e pagar a ida ao
 * banco para descobrir isso é custo sem informação.
 *
 * `empresa_id` é proposto por {@link empresaDoContexto} porque a coluna é `NOT NULL` sem padrão —
 * quem aceita ou recusa a linha continua sendo o `WITH CHECK` da política, e quem impede apontar para
 * fiador de outra empresa é a chave estrangeira composta.
 */
export async function substituirFiadoresDoContrato(
  tx: TransactionSql,
  contratoId: string,
  fiadoresIds: readonly string[],
): Promise<void> {
  await tx`
    DELETE FROM negocio.contrato_fiador
     WHERE contrato_id = ${contratoId}
  `;

  if (fiadoresIds.length === 0) {
    return;
  }

  await tx`
    INSERT INTO negocio.contrato_fiador (empresa_id, contrato_id, fiador_id)
    SELECT ${empresaDoContexto(tx)}, ${contratoId}::uuid, fiador_id
      FROM unnest(${[...fiadoresIds]}::uuid[]) AS fiador_id
  `;
}

/**
 * Retira o contrato de circulação, ou o devolve a ela, e entrega a linha nova. `undefined` quando não
 * alcançado.
 *
 * ---------------------------------------------------------------------------
 * UMA função para os dois sentidos, e a razão é o ALCANCE
 * ---------------------------------------------------------------------------
 *
 * Retirar e recircular são o mesmo fato com valores opostos na mesma coluna. Duas instruções ficariam
 * livres para divergir justamente no `WHERE` — e é o `WHERE`, sob a política, que carrega a fronteira
 * de tenant. É a mesma decisão, com a mesma justificativa, de `definirCirculacaoDoImovel`.
 *
 * ---------------------------------------------------------------------------
 * A IDEMPOTÊNCIA É DA INSTRUÇÃO, e não de um `if` antes dela
 * ---------------------------------------------------------------------------
 *
 * `coalesce(retirado_em, now())` **preserva a marca que já existe**: repetir a retirada devolve o
 * mesmo instante, caractere a caractere, e a resposta é a mesma. A alternativa — ler antes, decidir na
 * aplicação e só então escrever — teria duas idas ao banco e uma corrida entre elas, em que duas
 * requisições concorrentes leem "ainda não retirado" e a segunda sobrescreve a marca da primeira.
 *
 * E ela preserva o que distingue "não achou" de "já estava retirado": um `WHERE … AND retirado_em IS
 * NULL` devolveria zero linhas nos **dois** casos, e a borda responderia `404` a uma repetição
 * legítima. Aqui a ausência de linha significa uma coisa só — o contexto não alcança o contrato.
 *
 * ---------------------------------------------------------------------------
 * ELA NÃO TOCA `status`, E ISSO É A RD-15
 * ---------------------------------------------------------------------------
 *
 * A retirada de circulação do contrato é **de visibilidade**: ela alcança qualquer estado, **não muda
 * o estado** e **não libera o imóvel**. Um contrato ativo retirado continua vigente para o índice
 * `contrato_imovel_vigente_uidx` — que é o que impede a retirada de virar uma porta lateral para
 * destravar o imóvel sem cancelar o contrato.
 */
export async function definirCirculacaoDoContrato(
  tx: TransactionSql,
  codigo: string,
  emCirculacao: boolean,
): Promise<ContratoPersistido | undefined> {
  const [linha] = await tx<LinhaDoContrato[]>`
    UPDATE negocio.contrato
       SET retirado_em = CASE
                           WHEN ${emCirculacao} THEN NULL
                           ELSE coalesce(retirado_em, now())
                         END
     WHERE codigo = ${codigo}
    RETURNING ${colunasDoContrato(tx)}
  `;

  return await comAgregado(tx, linha);
}

/**
 * Faz o contrato valer: grava `ATIVO` com as duas derivações da ativação. `undefined` quando não
 * alcançado.
 *
 * As derivações chegam **prontas** — ver {@link DerivacoesDaAtivacao}. Esta função não calcula nada.
 *
 * **Quem recusa ativar um contrato que não é rascunho é o serviço** (RD-02), num ponto único: a
 * recusa é de domínio e nomeia o estado atual na resposta.
 *
 * **A recusa por imóvel já ocupado é do banco**, pelo índice único parcial, e chega ao chamador como
 * {@link ErroDeImovelComContratoVigente} já discriminada pelo código do vigente. Ela é imune à
 * corrida: duas ativações simultâneas sobre o mesmo imóvel disputam o índice, e exatamente uma
 * commita — que é o que o `CT-407` mede com duas transações independentes.
 */
export async function ativarContrato(
  tx: TransactionSql,
  codigo: string,
  derivacoes: DerivacoesDaAtivacao,
): Promise<ContratoPersistido | undefined> {
  const linha = await gravarSobIndiceDeVigencia(
    tx,
    { origem: 'contrato', codigo },
    async (escrita) => {
      const [alterada] = await escrita<LinhaDoContrato[]>`
      UPDATE negocio.contrato
         SET status = ${ESTADO_VIGENTE},
             data_fim_locacao = ${derivacoes.dataFimLocacao},
             valor_total_contrato = ${derivacoes.valorTotalContrato}
       WHERE codigo = ${codigo}
      RETURNING ${colunasDoContrato(escrita)}
    `;

      return alterada;
    },
  );

  return await comAgregado(tx, linha);
}

/**
 * Cancela o contrato. `undefined` quando não alcançado.
 *
 * Ela **não apaga nada e não retira de circulação**: o contrato cancelado permanece na carteira, que é
 * o histórico que a ADR-0014 preserva. O que ele deixa de ocupar é o índice de vigência — e é isso que
 * torna possível montar um contrato novo sobre o mesmo imóvel, o fluxo normal do recontrato.
 *
 * As duas derivações da ativação **não são desfeitas**: elas descrevem o que o contrato foi enquanto
 * valeu, e zerá-las apagaria o registro do que se cancelou.
 *
 * **Quem recusa cancelar um contrato que não está vigente é o serviço** (RD-02), num ponto único.
 */
export async function cancelarContrato(
  tx: TransactionSql,
  codigo: string,
): Promise<ContratoPersistido | undefined> {
  const [linha] = await tx<LinhaDoContrato[]>`
    UPDATE negocio.contrato
       SET status = ${ESTADO_CANCELADO}
     WHERE codigo = ${codigo}
    RETURNING ${colunasDoContrato(tx)}
  `;

  return await comAgregado(tx, linha);
}

/**
 * Executa a escrita e traduz **a violação da restrição de unicidade do código** — o ponto único dela.
 *
 * A escrita corre dentro de um `SAVEPOINT` pela razão que o cabeçalho deste arquivo registra. O
 * desfazimento alcança **só** o que correu dentro dele — o que a unidade gravou antes permanece, e é o
 * que faz esta tradução caber dentro de uma composição maior.
 *
 * Toda violação que **não** seja a da restrição nomeada é **repassada intacta** — inclusive a de
 * `contrato_fiador_contrato_fiador_key`, que a mesma escrita pode produzir. Traduzir `23505` em bloco
 * diria ao cliente que o código colidiu quando quem colidiu foi o vínculo.
 *
 * **Não há leitura de conflito aqui, e a ausência é a decisão.** No conflito de identificador
 * municipal, a leitura posterior diz se o registro em conflito circula ou foi retirado, e isso decide
 * entre reativar e recadastrar — há ação do usuário a informar. Aqui não há: o código foi emitido pelo
 * servidor, o cliente não o escolheu e não há nada que ele possa corrigir. Uma leitura que devolvesse o
 * contrato colidido só entregaria ao cliente o dado de outro registro.
 *
 * O tipo é **concreto**, e não genérico, pela mesma razão medida em {@link ./imovel.ts}: um parâmetro
 * de tipo obrigaria a converter o `UnwrapPromiseArray` do driver, e uma conversão no caminho da
 * tradução de erro é justamente onde ela não deve existir.
 */
async function gravarSobRestricaoDoCodigo(
  tx: TransactionSql,
  escrever: (escrita: TransactionSql) => Promise<LinhaDoContrato | undefined>,
): Promise<LinhaDoContrato | undefined> {
  try {
    return await tx.savepoint(async (escrita) => await escrever(escrita));
  } catch (erro) {
    if (!ehViolacaoDe(erro, RESTRICAO_DO_CODIGO)) {
      throw erro;
    }

    throw new ErroDeCodigoEmUso();
  }
}

/**
 * Onde o discriminante vai buscar **o imóvel em disputa** — e por que ele é parâmetro, em vez de
 * derivado do contrato pedido.
 *
 * A leitura do discriminante corre **depois** do desfazimento do `SAVEPOINT`, e por isso enxerga a
 * linha como ela estava **antes** da escrita recusada. Derivar o imóvel do contrato pedido — que foi
 * a primeira forma deste arquivo — só é correto quando a escrita **não move** `imovel_id`: na
 * alteração, o valor lido seria o imóvel **de origem**, e o erro nomearia o contrato que está sendo
 * movido em vez daquele que bloqueia o destino.
 *
 * A união obriga o ponto de chamada a **declarar** qual das duas vale, em vez de deixar a escolha
 * como precondição implícita que a próxima escrita herdaria por omissão — que é exatamente como o
 * defeito acima nasceu.
 */
type ImovelEmDisputa =
  /** O imóvel para o qual a escrita **move** o contrato — {@link alterarContrato} o tem do corpo. */
  | { readonly origem: 'informado'; readonly imovelId: string }
  /**
   * O imóvel que o contrato **já aponta**, alcançado pelo código dele. Vale só para escrita que
   * **não** toca `imovel_id` — {@link ativarContrato} escreve `status` e as duas derivações, e nada
   * mais —, e é essa precondição que faz o valor lido depois do desfazimento ser o mesmo que a
   * escrita disputou.
   */
  | { readonly origem: 'contrato'; readonly codigo: string };

/**
 * Executa a escrita e traduz **a violação do índice de vigência** — o ponto único dela.
 *
 * Mesmo `SAVEPOINT`, mesma razão, e a mesma cláusula: violação que não seja a do índice nomeado sobe
 * intacta.
 *
 * A diferença para a irmã acima é o **discriminante**: aqui a leitura posterior existe e tem função —
 * ela diz **qual** contrato ocupa o imóvel, que é o que a interface precisa exibir para que o usuário
 * saiba o que cancelar. Ela corre **depois** da recusa e não decide se pode gravar.
 *
 * **Ela envolve as DUAS escritas que alcançam o índice**, e não só a ativação: `alterarContrato`
 * escreve `imovel_id`, que é a chave dele. O cabeçalho deste arquivo registra por que a recusa de
 * domínio da RD-05 não substitui esta tradução.
 */
async function gravarSobIndiceDeVigencia(
  tx: TransactionSql,
  emDisputa: ImovelEmDisputa,
  escrever: (escrita: TransactionSql) => Promise<LinhaDoContrato | undefined>,
): Promise<LinhaDoContrato | undefined> {
  try {
    return await tx.savepoint(async (escrita) => await escrever(escrita));
  } catch (erro) {
    if (!ehViolacaoDe(erro, INDICE_DA_VIGENCIA)) {
      throw erro;
    }

    throw new ErroDeImovelComContratoVigente(await lerCodigoDoContratoVigente(tx, emDisputa));
  }
}

/**
 * Reconhece a recusa de **uma** restrição nomeada.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver, e
 * o par (`code`, `constraint_name`) é o contrato do protocolo. Casar pelo texto da mensagem seria
 * amarrar a tradução ao idioma configurado no servidor.
 *
 * O nome é **parâmetro** porque este arquivo traduz duas restrições diferentes, com discriminantes
 * diferentes. Uma função por restrição duplicaria a leitura do par; uma função sem o nome traduziria
 * `23505` em bloco, que é exatamente o que o cabeçalho recusa.
 */
function ehViolacaoDe(erro: unknown, restricao: string): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return falha?.code === VIOLACAO_DE_UNICIDADE && falha.constraint_name === restricao;
}

/**
 * Lê o código do contrato que já vigora sobre **o imóvel em disputa** — depois de o banco ter
 * recusado.
 *
 * A consulta parte do **imóvel**, e não do contrato pedido, e é essa a correção que {@link
 * ImovelEmDisputa} carrega: o imóvel disputado é o que a escrita **pretendia** ocupar, que na
 * alteração não é o que a linha aponta depois do desfazimento. O índice parcial garante haver no
 * máximo um vigente por imóvel, de modo que a consulta devolve uma linha ou nenhuma.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver — a política já recorta a leitura, e a chave
 * estrangeira composta garante que contrato e imóvel são da mesma empresa.
 *
 * A ausência de linha é estado impossível: o índice acabou de recusar porque existe um vigente. Ela
 * levanta com nome, em vez de escolher um discriminador por omissão e afirmar ao usuário um código que
 * ninguém apurou.
 */
async function lerCodigoDoContratoVigente(
  tx: TransactionSql,
  emDisputa: ImovelEmDisputa,
): Promise<string> {
  const imovelId =
    emDisputa.origem === 'informado'
      ? emDisputa.imovelId
      : await lerImovelDoContrato(tx, emDisputa.codigo);

  const [vigente] = await tx<{ codigo: string }[]>`
    SELECT codigo
      FROM negocio.contrato
     WHERE imovel_id = ${imovelId}
       AND status = ${ESTADO_VIGENTE}
  `;

  if (vigente === undefined) {
    throw new Error('o índice de vigência recusou a escrita e o contrato vigente não é alcançável');
  }

  return vigente.codigo;
}

/**
 * O imóvel que o contrato aponta hoje — a etapa que a variante `contrato` de {@link ImovelEmDisputa}
 * precisa, e **só ela**.
 *
 * Ela corre no caminho da recusa, e não no do sucesso: quem alcança a leitura já recebeu o `23505` do
 * índice. Pagar uma ida ao banco ali é o preço de o discriminante não depender de o chamador conhecer
 * um UUID que ele não tem — {@link ativarContrato} recebe o **código**, e ler o imóvel na entrada
 * custaria uma consulta em toda ativação bem-sucedida.
 */
async function lerImovelDoContrato(tx: TransactionSql, codigo: string): Promise<string> {
  const [contrato] = await tx<{ imovelId: string }[]>`
    SELECT imovel_id AS "imovelId"
      FROM negocio.contrato
     WHERE codigo = ${codigo}
  `;

  if (contrato === undefined) {
    throw new Error(
      'o índice de vigência recusou a escrita e o contrato recusado não é alcançável',
    );
  }

  return contrato.imovelId;
}
