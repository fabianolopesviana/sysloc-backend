/**
 * Boleto da cobrança — o **fato bancário** que a emissão grava, que a conferência aplica e que a
 * revogação desfaz.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./evento-bancario.ts}, {@link ./emissao-em-lote.ts} e
 * {@link ./conferencia-bancaria.ts} já registram: a contenção da §11.2 é de **tipo** e não alcança
 * **texto de SQL**. Um serviço de aplicação com o executor da unidade de trabalho em mãos escreve
 * `negocio.cobranca` numa cadeia sem importar nada de proibido, e o alcance às tabelas do domínio
 * deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da unidade
 * de trabalho? NÃO.** As **seis** funções **recebem** o executor (`tx`) de quem já abriu a unidade;
 * nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. Eram cinco até a T13 da
 * fatia `emissao-e-conciliacao`, que acrescentou {@link localizarAlvoDoBoleto} — a leitura de que o
 * ato unitário da borda precisa para nomear a cobrança na trilha. Corrigir o número é obrigatório
 * mesmo sendo prosa: contagem desatualizada convida a próxima rodada a "corrigir" para menos.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM MÓDULO NOVO, E NÃO MAIS CINCO FUNÇÕES EM `./cobranca.ts`
 * ---------------------------------------------------------------------------
 *
 * O que se escreve aqui é o **fato de terceiro**: o que o provedor atribuiu, o que ele creditou e o
 * que ele desfez. É outro ciclo de vida — o da cobrança nasce da série e termina no desfecho, este
 * nasce da emissão e é revogável **pelo provedor** —, e é outra fronteira de alcance: nenhuma destas
 * funções emite número, nenhuma delas cria linha, e todas alcançam uma cobrança que já existe.
 *
 * A separação também é o que mantém `./cobranca.ts` legível: aquele arquivo carrega a
 * `DECISÃO FECHADA` da unicidade da derivação, e cada função a mais ali é uma a mais para conferir
 * contra ela.
 *
 * ---------------------------------------------------------------------------
 * A LIQUIDAÇÃO REUSA `acusarPagamentoDeCobranca` — é isso, e só isso, que torna a RN-07 verdadeira
 * ---------------------------------------------------------------------------
 *
 * {@link liquidarPeloProvedor} **chama a porta da F3 sem alterá-la**, e não reescreve nem uma linha do
 * carimbo de mora. A consequência é a regra: multa, juros e os dois percentuais carimbados pela baixa
 * vinda da conferência são, **por construção**, os mesmos centavos que a baixa manual carimbaria — a
 * mesma expressão, no mesmo lugar, referenciada e não recopiada (ADR-0022, ADR-0023).
 *
 * Reescrever a conta aqui produziria uma **segunda regra**, que concordaria com a primeira hoje e
 * divergiria na primeira mudança da política — e a divergência não faria barulho, porque as duas
 * baixas nunca são comparadas em produção. O `CT-922` é quem as compara, e o oráculo dele é a baixa
 * manual, nunca um valor recalculado pelo caso.
 *
 * ---------------------------------------------------------------------------
 * O ESTADO É DERIVADO, e nenhuma coluna de status é escrita (ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma instrução deste arquivo nomeia `status`, e não há `status` a nomear: a coluna não existe. A
 * cobrança liquidada publica `PAGA` porque `pago_em` está preenchido, e a estornada volta a publicar
 * `VENCIDA` ou `A_VENCER` **conforme o vencimento**, sem que nada aqui decida qual. É por isso que o
 * estorno apaga fato e carimbo **juntos**: apagar só o fato deixaria a linha com carimbo de mora de um
 * pagamento que não existe mais, e o `cobranca_carimbo_coerente_chk` a recusaria em voz alta.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO DE ESTADO MORA DENTRO DA INSTRUÇÃO — nunca num `SELECT` antes dela
 * ---------------------------------------------------------------------------
 *
 * As quatro escritas trazem o estado admissível na própria cláusula (`pago_em IS NULL AND
 * cancelado_em IS NULL`, `pago_em IS NOT NULL`, `nosso_numero IS NULL`, `nosso_numero IS NOT NULL`), e
 * **nenhuma lê antes de gravar**. A forma intuitiva — perguntar em que estado a cobrança está e só então escrever — passa em
 * todos os casos felizes e perde a corrida: entre o `SELECT` e o `UPDATE` cabe a baixa manual da rota
 * de pagamento, e o percurso da conferência gravaria por cima de um fato que ele leu antes de existir.
 * É a mesma lei que `concluirLote`, `interromperLote` e `concluirConferencia` já aplicam.
 *
 * A leitura que existe aqui — {@link exigirCobrancaAlcancavel} — corre **depois** de o predicado ter
 * recusado, e não decide se pode gravar: quando ela roda, a escrita já não aconteceu. Ela serve a uma
 * coisa só, e é a que a camada de cima não consegue fazer sozinha: separar a recusa **grave** (a
 * cobrança não é alcançável pelo contexto corrente) da **benigna** (a cobrança está lá, e o estado
 * dela não admitia o ato). Mesmo desenho, e mesma razão, de `lerLoteEmCurso` em
 * {@link ./emissao-em-lote.ts}.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS DESFECHOS BENIGNOS EXISTEM PORQUE A ADR-0034 OS EXIGE
 * ---------------------------------------------------------------------------
 *
 * A trilha registra **efeito, nunca tentativa**. A cobrança que o provedor reporta paga **de novo**, e
 * o boleto que ele reporta revogado **depois** de a reemissão já o ter revogado, não mudaram nada — e
 * quem percorre precisa saber disso para **não** gravar evento e **não** contar efeito (§9.2 da tech
 * spec, §3.3.3 da T12). Um `void` obrigaria o percurso a redescobrir o desfecho por uma leitura extra,
 * que seria a segunda avaliação do mesmo estado; um `throw` transformaria o caminho normal — o
 * provedor confirmando o que já é verdade — em falha, e queimaria as tentativas da fila.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação.** `negocio.cobranca` nasce com RLS **forçada**
 * (`migracoes/0010_seguranca_cobranca.sql`), de modo que a política é avaliada com os direitos de quem
 * consulta, e é ela que decide quais linhas o `UPDATE` alcança. Acrescentar `empresaId` a uma
 * assinatura seria escrever em código a comparação que a política já faz — a "defesa em profundidade"
 * que a `Decision` da ADR-0008 rejeita por escrito.
 *
 * **Nenhuma escrita daqui propõe `empresa_id`**, e a ausência de {@link empresaDoContexto} é
 * consequência: elas são todas `UPDATE` sobre linha existente, e a coluna de tenant não está em nenhum
 * `SET`. Mudá-la seria mover a cobrança de empresa, que é irrepresentável por desenho.
 *
 * Por isso {@link lerBoletoDaCobranca} devolve `undefined` tanto para a cobrança inexistente quanto
 * para a de outra empresa — as duas ausências são deliberadamente **indistinguíveis**, e a borda (T14)
 * traduz as duas no mesmo `404` que `localizarCobranca` já produz, **num ponto único**. Traduzi-la aqui
 * daria ao cliente a informação de que aquele identificador existe em algum lugar.
 *
 * ---------------------------------------------------------------------------
 * A CHAVE É O **CÓDIGO** (ADR-0017), e o UUID não entra em assinatura nenhuma
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem série declarada, então a chave exposta dela é o código legível — é o que a rota
 * nomeia, é o que `LinhaDeCobranca` publica, e é o que `CobrancaSemBoleto` e `CobrancaAConferir` levam
 * ao percurso ao lado do UUID. Receber o UUID aqui deixaria estas portas inalcançáveis a partir da
 * borda, que nunca o tem em mãos.
 *
 * ---------------------------------------------------------------------------
 * DINHEIRO ATRAVESSA EM **CADEIA**, e a única conversão tem endereço
 * ---------------------------------------------------------------------------
 *
 * É a convenção da fase, fixada no cabeçalho de {@link ./evento-bancario.ts}: *cadeia na escrita,
 * número na projeção publicada*. O valor que o provedor declarou entra tal como veio, sem passar por
 * ponto flutuante, e é assim que `valor_creditado` chega a `numeric(15,2)`.
 *
 * ⚠️ **A exceção é `valorPago`, e ela é o preço de reusar a porta da F3 sem alterá-la**:
 * `DesfechoDoPagamento.valorPago` é `number` desde a F3, e a RN-07 proíbe mexer naquela função. A
 * conversão acontece **num ponto único**, em {@link liquidarPeloProvedor}, e não se espalha: a
 * assinatura daqui recebe cadeia, como as irmãs. O `CT-922` afirma `valor_pago` e `valor_creditado`
 * lidos crus do banco, e a igualdade entre os dois é o que mostra que a travessia não deformou o valor.
 */

import type { TransactionSql } from 'postgres';
import { acusarPagamentoDeCobranca } from './cobranca.js';

/**
 * O que a emissão devolveu — os três campos do boleto, o identificador que o produto enviou e o
 * arquivo.
 *
 * ⚠️ **`identificadorNoProvedor` é obrigatório, e a obrigatoriedade é a decisão.** São **dois**
 * identificadores de sentidos opostos: `numeroDoTituloNoProvedor` é o que o **provedor atribui** e
 * devolve (a coluna `nosso_numero`), e `identificadorNoProvedor` é o que o **produto compõe** — 18
 * posições, `AAAAMM` mais o contador do SaaS — e envia. Gravar só o primeiro descartaria a chave de
 * correlação por onde a fatia do carnê descobre a que empresa uma notificação pertence, e **ela não se
 * recupera depois**: o contador já avançou, e a única saída seria migração sobre tabela com dado. Ver
 * o cabeçalho da coluna em {@link ./esquema/negocio.ts} e a ADR-0033.
 *
 * `caminhoDoArquivo` é **caminho**, nunca bytes: o boleto é fato recebido de terceiro, que a cláusula
 * de exclusão da ADR-0030 mantém fora do *"artefato derivado se compõe sob demanda"*. Quem escreve e
 * apaga os bytes é a guarda (T9); esta porta só guarda por onde alcançá-los.
 *
 * Não há campo anulável aqui, e a ausência é conteúdo: quem chama é quem acabou de emitir, e uma
 * emissão sem linha digitável ou sem código de barras não é um boleto pela metade — é uma resposta que
 * o adaptador deveria ter recusado antes de chegar ao banco.
 */
export interface BoletoEmitido {
  /** A coluna `nosso_numero` — o identificador que o **provedor** atribuiu ao título. */
  readonly numeroDoTituloNoProvedor: string;
  readonly linhaDigitavel: string;
  readonly codigoDeBarras: string;
  /** As 18 posições que **o produto** compôs e enviou — chave de correlação, única no SaaS. */
  readonly identificadorNoProvedor: string;
  /** Onde a guarda gravou os bytes. Caminho, nunca conteúdo. */
  readonly caminhoDoArquivo: string;
}

/**
 * O que o provedor informou ao confirmar o pagamento — **quatro** fatos, e nenhum a mais.
 *
 * Multa, juros e os dois percentuais **não estão aqui**, e a ausência é o mecanismo do carimbo: eles
 * são copiados da visão dentro da própria instrução que grava o pagamento, de modo que não existe
 * caminho pelo qual o provedor — ou quem interpreta a resposta dele — proponha um valor de mora. É a
 * mesma razão de `DesfechoDoPagamento` ter dois campos e não seis.
 *
 * As duas datas são cadeias `YYYY-MM-DD`, e não `Date`: as colunas são `date`, e um objeto `Date`
 * reserializado com o fuso do processo desloca a data em um dia para metade dos fusos.
 *
 * Os dois valores são **cadeias**, pela convenção da fase — ver o cabeçalho deste arquivo para a
 * exceção que `valorPago` paga ao atravessar a porta da F3.
 */
export interface LiquidacaoInformada {
  readonly pagoEm: string;
  readonly valorPago: string;
  readonly dataDoCredito: string;
  readonly valorCreditado: string;
}

/**
 * O que a liquidação **fez de fato** — é o que a conferência conta em `efeitos` e o que decide se há
 * evento a gravar.
 *
 * `NAO_ESTAVA_EM_ABERTO` é o desfecho **benigno e previsto**, e ele cobre os **dois** estados que não
 * são *em aberto*, exatamente como {@link ./conferencia-bancaria.ts} define o conjunto a conferir
 * (`pago_em IS NULL AND cancelado_em IS NULL`): o provedor reporta paga uma cobrança que **já estava
 * paga**, ou uma que a operação **cancelou** entre a seleção e a escrita. Nos dois nada mudou. A
 * ADR-0034 é literal sobre o que fazer com isso — nenhum evento —, e é por isso que ele volta como
 * valor em vez de exceção.
 */
export type DesfechoDaLiquidacao = 'LIQUIDADA' | 'NAO_ESTAVA_EM_ABERTO';

/** O que o estorno fez de fato, pela mesma razão de {@link DesfechoDaLiquidacao}. */
export type DesfechoDoEstorno = 'ESTORNADA' | 'NAO_ESTAVA_PAGA';

/**
 * O desfecho da revogação, mais **o caminho do arquivo que a guarda precisa apagar**.
 *
 * O caminho é lido da linha **antes** da escrita (ver {@link revogarBoleto}) porque, depois dela, a
 * coluna é nula — e sem ele os bytes ficariam órfãos no disco, com a cobrança já sem boleto e nada
 * apontando para o arquivo.
 *
 * `caminhoDoArquivo` é `null` em dois casos, e o `desfecho` os separa: o boleto foi revogado e não
 * tinha arquivo gravado, ou não havia boleto algum a revogar.
 */
export interface RevogacaoAplicada {
  readonly desfecho: 'REVOGADO' | 'NAO_HAVIA_BOLETO';
  readonly caminhoDoArquivo: string | null;
}

/**
 * O boleto de uma cobrança, como a entrega de bytes (T14) precisa dele.
 *
 * São os **três campos de emissão** mais o caminho, e nada além: quem lê isto está decidindo entre
 * entregar o arquivo e rebuscá-lo no provedor, e valor, vencimento e locatário não participam dessa
 * decisão. Replicá-los aqui criaria uma segunda projeção da cobrança ao lado de `colunasDaCobranca`,
 * livre para divergir dela — é a razão literal que `CobrancaSemBoleto` e `CobrancaAConferir` já
 * registram.
 *
 * Os quatro são anuláveis porque a cobrança nasce sem boleto, e porque o boleto pode ter sido revogado
 * depois: `numeroDoTituloNoProvedor` nulo é *"nunca emitida, ou já revogada"*, que é o `404` nomeado da
 * CA-09; `caminhoDoArquivo` nulo com título presente é *"emitida e sem os bytes em disco"*, que é a
 * re-obtenção da CA-08. Fundi-los num único campo apagaria justamente a distinção entre os dois.
 */
export interface BoletoDaCobranca {
  readonly numeroDoTituloNoProvedor: string | null;
  readonly linhaDigitavel: string | null;
  readonly codigoDeBarras: string | null;
  readonly caminhoDoArquivo: string | null;
}

/**
 * A cobrança sobre a qual um **ato unitário de boleto** incide — três campos, e nenhum a mais.
 *
 * O `id` é o **UUID interno**, e é ele a razão de este tipo existir: a trilha guarda a chave
 * estrangeira composta e {@link ./evento-bancario.ts} a exige, enquanto a projeção publicada da
 * cobrança não a carrega (ela não é campo do contrato). O `codigo` é a chave exposta (ADR-0017), por
 * onde a guarda de bytes deriva o nome do arquivo e por onde a recusa nomeia a cobrança.
 *
 * `numeroDoTituloNoProvedor` é o boleto **vivo**, e `null` quer dizer *nunca emitida, ou já revogada*
 * — a distinção que decide se o ato tem etapa de revogação (CA-18). Aqui ele é anulável, diferente do
 * homônimo de `CobrancaAConferir`, cuja não-nulidade vem do predicado daquele conjunto.
 *
 * Valor, vencimento e locatário **não estão aqui**, e a ausência é conteúdo: eles mudam com a política
 * de mora e são lidos no instante do pedido de emissão, já dentro do ato — replicá-los nesta leitura
 * criaria uma segunda projeção da cobrança ao lado de `colunasDaCobranca`, livre para divergir dela.
 */
export interface AlvoDoBoleto {
  readonly id: string;
  readonly codigo: string;
  readonly numeroDoTituloNoProvedor: string | null;
}

/**
 * Os quatro atos que esta porta escreve — a união fechada que discrimina a recusa.
 *
 * Ela é `type`, e não texto livre: um valor fora dela **não compila**, de modo que não existe caminho
 * de construção — inclusive os que ainda não existem — capaz de produzir uma quinta mensagem.
 */
export type AtoSobreOBoleto = 'EMISSAO' | 'LIQUIDACAO' | 'ESTORNO' | 'REVOGACAO';

/**
 * As quatro recusas de não-alcance, escritas **uma vez cada** e escolhidas pelo ato.
 *
 * O mapa é a fonte única do texto, e mora ao lado da classe que o compõe — não nos pontos de `throw`.
 * Um literal por ponto de chamada é a segunda declaração do mesmo fato, livre para divergir sem que
 * nada acuse. Mesmo desenho de `RECUSA_POR_DESFECHO` em {@link ./emissao-em-lote.ts}.
 *
 * Nenhuma das quatro carrega o **código** da cobrança, pela razão que `ErroDeCodigoDeCobrancaEmUso` já
 * registra: a mensagem alcança o registro estruturado, e o que quem trata a recusa precisa saber viaja
 * em campo nomeado.
 */
const RECUSA_POR_ATO: Record<AtoSobreOBoleto, string> = {
  EMISSAO: 'a emissão não alcançou uma cobrança sem boleto',
  LIQUIDACAO: 'a liquidação não alcançou a cobrança',
  ESTORNO: 'o estorno não alcançou a cobrança',
  REVOGACAO: 'a revogação não alcançou a cobrança',
};

/**
 * A escrita **não alcançou a cobrança** — a recusa grave das quatro portas de escrita.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de API.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA É CLASSE NOMEADA, e não um `Error` de texto
 * ---------------------------------------------------------------------------
 *
 * Quem chama é o **processo de trabalho** (o lote, a conferência) e a **borda** da emissão unitária, e
 * os dois precisam separar esta recusa de uma falha de driver **em runtime**: a primeira é definitiva
 * — repetir a tarefa não muda nada, porque a cobrança segue inalcançável pelo contexto daquela carga —
 * e a segunda é transitória, e a fila deve mesmo repeti-la. Com um `Error` de texto, essa decisão
 * dependeria de casar mensagem, e tratar a definitiva como transitória queima as três tentativas para
 * terminar dizendo ao operador o oposto da verdade. É a mesma razão, medida na mesma fatia, de
 * `ErroDeLoteNaoAlcancado` e de `ErroDeConferenciaNaoAlcancada`.
 *
 * O que ela carrega são os **fatos que a própria instrução deu**: qual cobrança a escrita não alcançou
 * e qual ato recusou. Não há leitura para enriquecê-la além da que já separou o grave do benigno.
 *
 * ⚠️ **Ela NÃO é a recusa do estado que não admitia o ato.** Essa volta como desfecho
 * ({@link DesfechoDaLiquidacao}, {@link DesfechoDoEstorno}, {@link RevogacaoAplicada}), porque é
 * caminho normal de execução. A única exceção é a **emissão**, e ela é deliberada — ver
 * {@link gravarBoletoDaCobranca}.
 */
export class ErroDeCobrancaNaoAlcancada extends Error {
  override readonly name: string = 'ErroDeCobrancaNaoAlcancada';

  /** A cobrança que a escrita **não** alcançou, pela chave exposta (ADR-0017). */
  readonly codigo: string;

  /** Qual ato recusou — o que escolhe a mensagem sem que ela venha de fora. */
  readonly ato: AtoSobreOBoleto;

  constructor(codigo: string, ato: AtoSobreOBoleto) {
    super(RECUSA_POR_ATO[ato]);
    this.codigo = codigo;
    this.ato = ato;
  }
}

// DÉBITO COM GATILHO — D13 · F4/T6 · registrado 2026-08-17
// O QUÊ: nada no banco pareia os campos de conciliação entre si. `linha_digitavel` sem
//        `nosso_numero` — e qualquer outra combinação meio preenchida — é representável, e o que a
//        impede hoje é só estas quatro escritas nomearem os campos em bloco.
// QUANDO FECHA: a fatia que criar no banco a restrição pareando `linha_digitavel` com
//        `nosso_numero` (a bicondicional dos CINCO campos está descartada por medição: `data_credito`
//        e `valor_creditado` nascem depois dos três de emissão, e ela recusaria o estado legítimo
//        *emitido e ainda não pago*). Mesma classe do D44 · F2/T10.
// POR QUE NÃO AGORA: a `0017` já foi gerada e a restrição exigiria migração própria fora do escopo
//        declarado desta task, sobre uma tabela cuja migração de segurança (`0010`) é imutável.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D13

/**
 * Separa a recusa **grave** da **benigna** — e roda **depois** de o predicado ter recusado.
 *
 * Ela não decide se pode gravar: quando corre, a escrita já não aconteceu. O que ela responde é a
 * pergunta que a camada de cima não consegue responder sozinha — *a cobrança está lá e o estado não
 * admitia o ato, ou o contexto corrente não a alcança?* —, e a resposta muda o que quem chama faz: a
 * primeira é caminho normal (nada mudou, nenhum evento), a segunda é definitiva e precisa de nome.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política (ADR-0008). A leitura é
 * sobre a **tabela**, e não sobre `negocio.cobranca_derivada`: o que se pergunta é se a linha existe, e
 * pedir a visão pagaria as três junções laterais dela para não usar nenhuma coluna que só ela tem.
 *
 * A ausência de linha tem as duas causas deliberadamente indistinguíveis de sempre — a cobrança não
 * existe, ou é de outra empresa e a política a esconde —, e as duas levantam a **mesma** recusa. A
 * distinção não é desta camada, e revelá-la diria a quem chama que aquele código existe em algum lugar.
 */
async function exigirCobrancaAlcancavel(
  tx: TransactionSql,
  codigo: string,
  ato: AtoSobreOBoleto,
): Promise<void> {
  const [linha] = await tx<{ alcancada: boolean }[]>`
    SELECT true AS alcancada
      FROM negocio.cobranca
     WHERE codigo = ${codigo}
  `;

  if (linha === undefined) {
    throw new ErroDeCobrancaNaoAlcancada(codigo, ato);
  }
}

/**
 * Grava o boleto emitido: os **três** campos que o provedor devolveu, o identificador que o produto
 * enviou e o caminho do arquivo — numa instrução só.
 *
 * ---------------------------------------------------------------------------
 * O IDENTIFICADOR ENTRA NO MESMO ATO, e é isso que o torna recuperável
 * ---------------------------------------------------------------------------
 *
 * `identificador_no_provedor` é gravado **aqui**, junto dos demais, e não numa escrita anterior ou
 * posterior: ele é a chave por onde a fatia (iii) casa a notificação recebida com a empresa dona da
 * cobrança, e uma segunda instrução deixaria a janela em que o boleto existe e a chave de correlação
 * não. Ele é **interno** e não é publicado por esquema algum de `@sysloc/contracts` — ver
 * {@link BoletoEmitido}.
 *
 * A unicidade dele é **global** (`cobranca_identificador_no_provedor_key`, sem `empresa_id`, ADR-0033),
 * e a violação dela **sobe intacta**: traduzi-la aqui atribuiria à emissão em curso uma colisão que ela
 * não causou, e não há nada que quem chama possa corrigir — o número veio do contador do SaaS, que
 * ninguém escolhe.
 *
 * ---------------------------------------------------------------------------
 * A CLÁUSULA EXIGE COBRANÇA **SEM BOLETO**, e a exigência é o invariante financeiro da fatia
 * ---------------------------------------------------------------------------
 *
 * `AND nosso_numero IS NULL` é o que impede a emissão de escrever por cima de um boleto **vivo**. Sem
 * ele, uma segunda emissão sobre a mesma cobrança substituiria em silêncio o título registrado no
 * banco — e o boleto anterior continuaria pagável no mundo, sem que o produto tivesse mais o elo por
 * onde reconciliá-lo. É o *"em nenhum instante os dois são pagáveis"* da CA-05 imposto no ponto onde a
 * escrita acontece, e não apenas na composição que a antecede (a reemissão revoga e **confirma** antes
 * de emitir — T11).
 *
 * Ele **não é leitura prévia**: não há `SELECT`, o predicado é avaliado dentro da própria instrução, e
 * por isso não existe janela entre decidir e gravar.
 *
 * ---------------------------------------------------------------------------
 * ZERO LINHAS TEM DUAS CAUSAS, e as duas são falha — diferente das irmãs
 * ---------------------------------------------------------------------------
 *
 * Ou a cobrança não é alcançável pelo contexto, ou ela já tem boleto vivo. **Esta camada não as
 * separa, e aqui isso é deliberado**: nas irmãs a segunda causa é caminho normal (o provedor confirma
 * o que já é verdade), e na emissão ela é anomalia — o conjunto do lote exclui quem tem boleto pelo
 * predicado, e a reemissão revoga antes. As duas terminam, portanto, na mesma recusa nomeada, e o que
 * **não** se admite é resolver em silêncio: sem a conferência, o percurso seguiria acreditando que
 * emitiu, e o `identificador_no_provedor` teria sido queimado por nada.
 *
 * Ela devolve `void`: o que a camada de cima faz com o boleto gravado é lê-lo por
 * {@link lerBoletoDaCobranca} ou publicá-lo pela leitura da cobrança, e um retorno existiria apenas
 * para ser conferido contra o que a própria chamada acabou de informar.
 */
export async function gravarBoletoDaCobranca(
  tx: TransactionSql,
  codigo: string,
  boleto: BoletoEmitido,
): Promise<void> {
  const resultado = await tx`
    UPDATE negocio.cobranca
       SET nosso_numero = ${boleto.numeroDoTituloNoProvedor},
           linha_digitavel = ${boleto.linhaDigitavel},
           codigo_barras = ${boleto.codigoDeBarras},
           identificador_no_provedor = ${boleto.identificadorNoProvedor},
           boleto_arquivo = ${boleto.caminhoDoArquivo}
     WHERE codigo = ${codigo}
       AND nosso_numero IS NULL
  `;

  if (resultado.count !== 1) {
    throw new ErroDeCobrancaNaoAlcancada(codigo, 'EMISSAO');
  }
}

/**
 * Liquida a cobrança com o que o provedor informou — **reusando a baixa da F3, sem alterá-la**.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DAS DUAS INSTRUÇÕES É CONTEÚDO
 * ---------------------------------------------------------------------------
 *
 * O crédito vem **primeiro**, e ele é quem carrega o predicado de estado. São **duas** condições, e
 * juntas elas são a definição literal de *em aberto* que esta fatia já escreveu em
 * `selecionarCobrancasAConferir` ({@link ./conferencia-bancaria.ts}): `AND pago_em IS NULL` é a guarda
 * *"cobrança já paga não é repaga"* (§3.3.5 da task, §9.2 da tech spec), e `AND cancelado_em IS NULL`
 * é a outra metade da mesma definição. As duas são avaliadas **dentro da instrução**, sem leitura
 * prévia e sem janela. Como o `UPDATE` trava a linha até o fim da unidade de trabalho, a baixa que vem
 * em seguida escreve sobre uma linha que ninguém mais pode mover — e a baixa manual concorrente, ou o
 * cancelamento pelo Admin, esperam em vez de se intercalar entre a decisão e a escrita.
 *
 * ⚠️ **A segunda condição é o que mantém {@link DesfechoDaLiquidacao} uma união FECHADA.** Sem ela a
 * cobrança **cancelada** satisfaz o predicado — `pago_em` dela é nulo —, o crédito grava com
 * `count 1`, e `acusarPagamentoDeCobranca`, que **não** condiciona por estado, escreve `pago_em` sobre
 * uma linha com `cancelado_em` preenchido: `cobranca_desfecho_unico_chk`
 * (`migracoes/0009_dominio_cobranca.sql` — `pago_em IS NULL OR cancelado_em IS NULL`) recusa, a
 * unidade inteira aborta, e quem chama recebe `23514` **cru**, que não é nenhum dos dois desfechos
 * declarados. O dano não é de integridade — o banco recusa estruturalmente e nada fica gravado pela
 * metade —, é de **taxonomia**: sob fila, um erro de driver é indistinguível de falha transitória, a
 * tarefa é repetida três vezes e o operador termina informado do oposto da verdade. É a mesma razão,
 * palavra por palavra, que faz {@link ErroDeCobrancaNaoAlcancada} ser classe nomeada.
 *
 * A janela é estreita e **real**: `cancelarCobranca` (F3) **não** revoga o boleto, de modo que a
 * cobrança cancelada conserva `nosso_numero` e permanece elegível ao conjunto que o percurso já
 * selecionou. O cancelamento pelo Admin **entre a seleção e a escrita** é a corrida que este arquivo
 * declara existir para fechar — *o predicado de estado mora dentro da instrução, nunca num `SELECT`
 * antes dela*. Com a condição, a cancelada cai no desfecho benigno, que é **literalmente verdadeiro**
 * para ela: não estava em aberto.
 *
 * ⚠️ **As portas irmãs NÃO recebem a mesma condição, e a assimetria é conteúdo.**
 * {@link estornarLiquidacao} já exige `pago_em IS NOT NULL`, e *paga e cancelada* é irrepresentável
 * pelo mesmo `check` — acrescentá-la ali seria uma cláusula que nenhuma linha pode falsificar.
 * {@link revogarBoleto} **precisa** alcançar a cobrança cancelada: ela é justamente quem tem boleto
 * vivo a revogar, e excluí-la deixaria o título pagável no mundo.
 *
 * A ordem inversa — chamar a baixa e depois gravar o crédito — não teria onde pôr a guarda:
 * `acusarPagamentoDeCobranca` **não** condiciona por estado (a guarda dela é do serviço, na borda), e
 * o `WHERE` dela pareia a derivada com o alvo pelo código, sem predicado algum sobre `pago_em`. Sem a
 * cláusula desta porta, portanto, a repetição reescreveria `pago_em` e `valor_pago` — mais
 * `data_credito` e `valor_creditado`, do `UPDATE` daqui — pelos valores da tentativa que não deveria
 * ter corrido, e o fato original se perderia sem que nada acusasse. **É por esses quatro campos que a
 * guarda continua necessária**, e é neles que o mutante `MT-T6-D` morre.
 *
 * ⚠️ **Os quatro carimbos de mora NÃO estão entre o que se perderia** — e o contrário já esteve
 * escrito aqui, até a medição do `MT-T6-D` (ver `boleto-da-cobranca.spec.ts`) mostrar que eles chegam
 * **preservados** (`40.00`, `34.67`, `2.00`, `1.00`) com a guarda apagada. A causa é o `COALESCE` de
 * `negocio.cobranca_derivada` (`0010_seguranca_cobranca.sql:345`): `valor_multa` é
 * `COALESCE(c.multa_aplicada, CASE WHEN status = 'VENCIDA' THEN … ELSE 0.00 END)`, e `valor_juros` é
 * idêntico. Depois do pagamento o status derivado é `'PAGA'` (linha 329) e o `CASE` interno de fato
 * renderia `0.00` — mas o `COALESCE` externo devolve o carimbo **já gravado**, de modo que repetir a
 * baixa é **ponto fixo** sobre a mora: lê `40.00` e regrava `40.00`. A mora sobrevive por essa
 * propriedade da visão; o fato do pagamento e o do crédito, não — e é o segundo grupo que a guarda
 * protege.
 *
 * São **duas** instruções e não uma, e a distinção em relação ao estorno é do banco:
 * `cobranca_carimbo_coerente_chk` pareia `pago_em` com os quatro carimbos e com `valor_pago`, e
 * **não** alcança `data_credito` nem `valor_creditado` (§7.2 da tech spec — nenhum `check` novo nesta
 * fatia). Não há, portanto, estado intermediário que o banco recuse, e as duas correm na mesma unidade
 * de trabalho: ou as duas valem, ou nenhuma vale.
 *
 * ---------------------------------------------------------------------------
 * O CARIMBO DE MORA NÃO É ESCRITO AQUI — e é essa ausência que é a RN-07
 * ---------------------------------------------------------------------------
 *
 * Multa, juros e os dois percentuais vigentes são copiados da visão dentro da instrução de
 * `acusarPagamentoDeCobranca`, exatamente como na baixa manual. **Nenhuma fórmula existe neste
 * arquivo**, e é por isso que os carimbos das duas baixas são idênticos por construção, e não por
 * coincidência mantida à mão. Ver o cabeçalho deste arquivo.
 *
 * ---------------------------------------------------------------------------
 * A DIVERGÊNCIA DE VALOR NÃO É TRATADA AQUI (CA-11)
 * ---------------------------------------------------------------------------
 *
 * O valor que o provedor informou é gravado **como ele informou**, e nada nesta porta o compara com o
 * esperado. A comparação é do percurso (T12), que grava o segundo evento `DIVERGENCIA_DE_VALOR` — e a
 * baixa **não é impedida** por ela. Uma recusa escrita aqui inverteria a regra: o dinheiro entrou, e o
 * produto passaria a negar o fato porque o valor não era o previsto.
 *
 * `undefined` vindo da porta da F3 é **estado impossível** neste ponto — a instrução anterior acabou de
 * alcançar a linha, na mesma unidade e sob o mesmo contexto —, e o ramo existe para que a falha tenha
 * nome em vez de um `undefined` atravessando como se fosse liquidação bem-sucedida.
 */
export async function liquidarPeloProvedor(
  tx: TransactionSql,
  codigo: string,
  liquidacao: LiquidacaoInformada,
): Promise<DesfechoDaLiquidacao> {
  const credito = await tx`
    UPDATE negocio.cobranca
       SET data_credito = ${liquidacao.dataDoCredito}::date,
           valor_creditado = ${liquidacao.valorCreditado}::numeric
     WHERE codigo = ${codigo}
       AND pago_em IS NULL
       AND cancelado_em IS NULL
  `;

  if (credito.count !== 1) {
    await exigirCobrancaAlcancavel(tx, codigo, 'LIQUIDACAO');

    return 'NAO_ESTAVA_EM_ABERTO';
  }

  // A conversão do valor pago é a exceção declarada no cabeçalho: `DesfechoDoPagamento.valorPago` é
  // `number` desde a F3, e a RN-07 proíbe alterar aquela porta. Ela acontece aqui e em lugar nenhum
  // mais.
  const paga = await acusarPagamentoDeCobranca(tx, codigo, {
    pagoEm: liquidacao.pagoEm,
    valorPago: Number(liquidacao.valorPago),
  });

  if (paga === undefined) {
    throw new ErroDeCobrancaNaoAlcancada(codigo, 'LIQUIDACAO');
  }

  return 'LIQUIDADA';
}

/**
 * Desfaz a liquidação: apaga os **oito** campos que ela escreveu, numa instrução só.
 *
 * ---------------------------------------------------------------------------
 * SÃO OITO, E ELES VÃO JUNTOS PORQUE O BANCO NÃO ADMITE METADE
 * ---------------------------------------------------------------------------
 *
 * `pago_em`, `valor_pago`, os **quatro** carimbos de mora — e `data_credito` e `valor_creditado`,
 * porque o crédito foi desfeito junto com o pagamento. Deixar os dois de crédito para trás publicaria
 * uma cobrança **em aberto com data de crédito**, que é exatamente a incoerência que o estorno existe
 * para desfazer (§5.2 H da tech spec).
 *
 * Os seis primeiros vão numa instrução só porque `cobranca_carimbo_coerente_chk` é **bicondicional**:
 * ele exige `(pago_em IS NULL) = (<carimbo> IS NULL)` para os quatro carimbos e para `valor_pago`, de
 * modo que qualquer ordem em duas instruções deixaria a linha meio apagada — e o banco a recusaria no
 * meio do caminho, com a transação abortada.
 *
 * ---------------------------------------------------------------------------
 * OS TRÊS CAMPOS DE EMISSÃO **PERMANECEM** — estorno não é revogação
 * ---------------------------------------------------------------------------
 *
 * `nosso_numero`, `linha_digitavel` e `codigo_barras` não aparecem no `SET`, e a ausência é a
 * garantia: coluna que não é nomeada não é escrita. O estorno diz *"o pagamento foi desfeito"*, e não
 * *"o título deixou de existir"* — apagar o elo com o provedor aqui destruiria a chave por onde a
 * conferência seguinte pergunta pela situação daquele mesmo boleto, que continua vivo. Quem apaga os
 * campos de emissão é {@link revogarBoleto}, e só ele.
 *
 * `identificador_no_provedor` fica de fora pela mesma razão, com um agravante: ele não se recompõe —
 * o contador do SaaS já avançou.
 *
 * ---------------------------------------------------------------------------
 * A CLÁUSULA EXIGE COBRANÇA PAGA, e zero linhas tem duas causas
 * ---------------------------------------------------------------------------
 *
 * `AND pago_em IS NOT NULL` faz duas coisas. A primeira é impedir a **reescrita da tupla** de uma
 * cobrança que já está em aberto: um `UPDATE` sem ele gravaria `NULL` sobre `NULL` nos oito campos, o
 * que passa em qualquer comparação de valores e ainda assim reescreve a linha — a distinção entre *não
 * alterou* e *reescreveu com o mesmo valor* que o par de `IS NULL` de `cancelarCobrancasDoContrato` já
 * registra, e que só o `xmin` separa. A segunda é dar ao percurso o desfecho benigno: o provedor que
 * informa estorno de algo que já fora estornado não mudou nada, e a ADR-0034 manda não gravar evento.
 *
 * A separação entre o benigno e o grave é de {@link exigirCobrancaAlcancavel}, e roda **depois** da
 * recusa.
 */
export async function estornarLiquidacao(
  tx: TransactionSql,
  codigo: string,
): Promise<DesfechoDoEstorno> {
  const resultado = await tx`
    UPDATE negocio.cobranca
       SET pago_em = NULL,
           valor_pago = NULL,
           multa_aplicada = NULL,
           juros_aplicados = NULL,
           multa_percentual_aplicado = NULL,
           juros_percentual_aplicado = NULL,
           data_credito = NULL,
           valor_creditado = NULL
     WHERE codigo = ${codigo}
       AND pago_em IS NOT NULL
  `;

  if (resultado.count !== 1) {
    await exigirCobrancaAlcancavel(tx, codigo, 'ESTORNO');

    return 'NAO_ESTAVA_PAGA';
  }

  return 'ESTORNADA';
}

/**
 * Revoga o boleto: zera os **três campos de emissão** e o arquivo, e devolve o caminho a apagar.
 *
 * ---------------------------------------------------------------------------
 * `cancelado_em` NÃO APARECE NO `SET`, e a garantia é ESTRUTURAL (RN-09, RN-10)
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **Não troque a ausência por uma atribuição explícita a `NULL`.** Coluna que não é nomeada não é
 * escrita — é uma propriedade da instrução, verificável por leitura, e vale para todo estado de origem.
 * Escrever `cancelado_em = NULL` pareceria equivalente e não é: passaria a **escrever** a coluna, e uma
 * cobrança cancelada pela operação perderia o cancelamento porque o provedor revogou um boleto.
 *
 * Isto é o oposto do que o sistema antigo faz, e é métrica de sucesso do PRD: **o provedor não apaga
 * valor a receber**. A cobrança revogada continua em aberto, volta ao alcance da régua e é recolhida
 * pelo lote seguinte da competência (CA-06) — o predicado daquele conjunto é *"em aberto e sem
 * boleto"*, e é `nosso_numero IS NULL` que a devolve a ele.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS CAMPOS DE CRÉDITO **NÃO** SÃO ZERADOS, e o alcance de "campos de emissão" é o da task
 * ---------------------------------------------------------------------------
 *
 * `data_credito` e `valor_creditado` são fato do **pagamento**, e quem os desfaz é
 * {@link estornarLiquidacao}. Zerá-los aqui faria a revogação de um boleto apagar o crédito de uma
 * cobrança paga, que é estorno disfarçado. No cenário que a §5.2 B da tech spec descreve — a cobrança
 * está **em aberto** — os dois já são nulos, de modo que o comportamento observável coincide; o que
 * muda é o que acontece nos cenários que aquela linha não descreve.
 *
 * `identificador_no_provedor` também fica de fora: ele é a chave de correlação por onde uma notícia
 * atrasada do provedor ainda se liga a esta cobrança, e ele não se recompõe.
 *
 * ---------------------------------------------------------------------------
 * O CAMINHO DO ARQUIVO SAI DA LINHA **ANTES** DA ESCRITA
 * ---------------------------------------------------------------------------
 *
 * `RETURNING` devolve os valores **novos**, e o novo aqui é `NULL` — de modo que ele não serve. A
 * auto-junção `FROM negocio.cobranca AS antes` é avaliada contra a fotografia do início da instrução,
 * que é a mesma propriedade do PostgreSQL que `acusarPagamentoDeCobranca` usa para copiar a mora
 * apurada *antes* do pagamento. É por isso que o caminho volta preenchido mesmo depois de a coluna ter
 * sido zerada, e sem ele os bytes ficariam órfãos no disco.
 *
 * A junção é por `id`, e não por código: o `WHERE` já recorta a linha pelo código, e igualar o
 * identificador interno das duas relações é o que declara que a fotografia lida é a **daquela** linha.
 * Não há `empresa_id` em ponto nenhum — quem recorta as duas pontas é a política (ADR-0008).
 *
 * A cláusula exige `nosso_numero IS NOT NULL` pelas duas razões de {@link estornarLiquidacao}: não
 * reescrever a tupla de quem já está sem boleto, e dar ao percurso o desfecho benigno de quando o
 * provedor informa a revogação de um boleto que a reemissão já revogou.
 *
 * ⚠️ **Ela NÃO recebe o diagnóstico do provedor, e a ausência é medida.** A §3.1 da task escreve
 * `revogarBoleto(tx, codigo, { diagnostico })`, e não há onde gravá-lo: `negocio.cobranca` não tem
 * coluna de diagnóstico (§7.2 da tech spec), e o motivo *tal como o provedor o informou* é carga do
 * **evento** — `EventoBancarioNovo.diagnostico`, em {@link ./evento-bancario.ts}. Quem grava o evento é
 * quem chama: a T11, a T12 e a T13 declaram, cada uma, consumir `registrarEventoBancario`, e a T12
 * declara literalmente o evento `BOLETO_REVOGADO` *"com `diagnostico` = o motivo tal como o provedor o
 * informou"*. Aceitar o parâmetro aqui exigiria esta porta registrar o efeito por dentro — e então a
 * revogação gravaria o próprio evento enquanto a liquidação e o estorno o deixam ao chamador, com a
 * `origem` (que a trilha exige e a assinatura da task não traz) escolhida por omissão.
 */
export async function revogarBoleto(
  tx: TransactionSql,
  codigo: string,
): Promise<RevogacaoAplicada> {
  const [linha] = await tx<{ caminhoDoArquivo: string | null }[]>`
    UPDATE negocio.cobranca AS alvo
       SET nosso_numero = NULL,
           linha_digitavel = NULL,
           codigo_barras = NULL,
           boleto_arquivo = NULL
      FROM negocio.cobranca AS antes
     WHERE antes.id = alvo.id
       AND alvo.codigo = ${codigo}
       AND alvo.nosso_numero IS NOT NULL
    RETURNING antes.boleto_arquivo AS "caminhoDoArquivo"
  `;

  if (linha === undefined) {
    await exigirCobrancaAlcancavel(tx, codigo, 'REVOGACAO');

    return { desfecho: 'NAO_HAVIA_BOLETO', caminhoDoArquivo: null };
  }

  return { desfecho: 'REVOGADO', caminhoDoArquivo: linha.caminhoDoArquivo };
}

/**
 * Lê o boleto de uma cobrança — os três campos de emissão e o caminho do arquivo.
 *
 * É o que a entrega de bytes (T14) consulta para decidir entre **entregar** e **rebuscar**:
 * `numeroDoTituloNoProvedor` nulo é *"nunca emitida, ou já revogada"*, e responde o `404` nomeado da
 * CA-09; `caminhoDoArquivo` nulo com título presente é *"emitida e sem os bytes em disco"*, e leva à
 * re-obtenção da CA-08, que corre **fora** da unidade de trabalho.
 *
 * A leitura é sobre a **tabela**, e não sobre `negocio.cobranca_derivada`, e isso não contraria a fonte
 * única do estado: o que se lê são **fatos gravados**, e nenhum dos quatro rótulos de
 * `negocio.status_cobranca` aparece aqui. A visão existe para quem precisa do estado e da mora, que ela
 * deriva no banco (ADR-0022, ADR-0023) — pedi-la aqui pagaria as junções laterais dela para não usar
 * nenhuma das colunas que só ela tem. Mesma razão, nos mesmos termos, de `selecionarCobrancasSemBoleto`
 * e de `selecionarCobrancasAConferir`.
 *
 * `undefined` tem **duas** causas deliberadamente indistinguíveis: a cobrança não existe, ou é de outra
 * empresa e a política a esconde. Quem as traduz no mesmo `404` é a borda, num ponto único (ADR-0008).
 * Ele é diferente do boleto ausente: ali a cobrança existe, e a recusa nomeia a ausência do documento.
 */
export async function lerBoletoDaCobranca(
  tx: TransactionSql,
  codigo: string,
): Promise<BoletoDaCobranca | undefined> {
  const [linha] = await tx<BoletoDaCobranca[]>`
    SELECT nosso_numero AS "numeroDoTituloNoProvedor",
           linha_digitavel AS "linhaDigitavel",
           codigo_barras AS "codigoDeBarras",
           boleto_arquivo AS "caminhoDoArquivo"
      FROM negocio.cobranca
     WHERE codigo = ${codigo}
  `;

  // A cópia campo a campo tem duas razões, e as duas são medidas: o objeto que o driver devolve carrega
  // protótipo próprio, montado a partir da descrição das colunas, e devolvê-lo direto faria a
  // comparação estrita da suíte reprovar por **classe** em vez de por valor; e o espalhamento
  // publicaria qualquer coluna que a projeção venha a ganhar. Mesma decisão de `eventoPublicado`.
  return linha === undefined
    ? undefined
    : {
        numeroDoTituloNoProvedor: linha.numeroDoTituloNoProvedor,
        linhaDigitavel: linha.linhaDigitavel,
        codigoDeBarras: linha.codigoDeBarras,
        caminhoDoArquivo: linha.caminhoDoArquivo,
      };
}

/**
 * Localiza o **alvo de um ato unitário sobre o boleto** — o UUID interno e o título vivo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA EXISTE, sendo que já há duas leituras de cobrança por código
 * ---------------------------------------------------------------------------
 *
 * O ato unitário da borda (emitir, reemitir, revogar) precisa de **uma** coisa que nenhuma das duas
 * leituras publicadas entrega: o **UUID interno** da cobrança. `registrarEventoBancario` o exige por
 * decisão registrada em {@link ./evento-bancario.ts} — *"a tradução da chave exposta acontece de fora,
 * em quem já leu a cobrança para produzir o efeito"* —, e nem {@link ./cobranca.ts#localizarCobranca}
 * (a projeção publicada, que não tem `id` porque `id` não é campo do contrato) nem
 * {@link lerBoletoDaCobranca} (os três campos de emissão mais o caminho) o carregam.
 *
 * As duas alternativas foram consideradas e recusadas por razão medida:
 *
 *   * **acrescentar `id` a {@link BoletoDaCobranca}** — a projeção é afirmada por igualdade de objeto
 *     inteiro em cinco pontos de `packages/db/test/boleto-da-cobranca.spec.ts`, e um campo a mais
 *     reprovaria os cinco. Fazer prova alheia mudar para acomodar consumidor novo é regressão de prova;
 *   * **selecionar pelo conjunto da conferência** ({@link ./conferencia-bancaria.ts}) — aquele
 *     predicado é *"com boleto vivo, e em aberto ou paga há menos de trinta dias"*, e o ato unitário
 *     incide justamente sobre a cobrança **sem** boleto. O conjunto errado responderia `undefined`
 *     para o caso mais comum da rota.
 *
 * A forma devolvida é a **mesma** de `CobrancaAConferir`, campo a campo, e a coincidência é do
 * domínio: os dois percursos precisam exatamente do trio *chave interna, chave exposta e título*.
 * Aqui, porém, `numeroDoTituloNoProvedor` é **anulável** — não há predicado que o garanta —, e é essa
 * anulabilidade que a borda lê para decidir se existe boleto a revogar (CA-18).
 *
 * A leitura é sobre a **tabela**, e não sobre `negocio.cobranca_derivada`, pela razão que
 * {@link lerBoletoDaCobranca} já registra: o que se lê são fatos gravados, e nenhum rótulo de
 * `negocio.status_cobranca` aparece aqui. Quem precisa do estado publicado o pede à visão.
 *
 * `undefined` tem as **duas** causas deliberadamente indistinguíveis de sempre — a cobrança não
 * existe, ou é de outra empresa e a política a esconde (ADR-0008). Quem as traduz no mesmo `404` é a
 * borda, num ponto único.
 */
export async function localizarAlvoDoBoleto(
  tx: TransactionSql,
  codigo: string,
): Promise<AlvoDoBoleto | undefined> {
  const [linha] = await tx<AlvoDoBoleto[]>`
    SELECT id,
           codigo,
           nosso_numero AS "numeroDoTituloNoProvedor"
      FROM negocio.cobranca
     WHERE codigo = ${codigo}
  `;

  // A cópia campo a campo, e não o repasse: mesma razão medida de {@link lerBoletoDaCobranca} — o
  // objeto do driver carrega protótipo próprio, e o espalhamento publicaria qualquer coluna que a
  // projeção venha a ganhar.
  return linha === undefined
    ? undefined
    : {
        id: linha.id,
        codigo: linha.codigo,
        numeroDoTituloNoProvedor: linha.numeroDoTituloNoProvedor,
      };
}
