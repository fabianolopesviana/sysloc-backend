/**
 * Emissão em lote — o **predicado** que define o conjunto, os dois desfechos e a prestação de contas.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./envio-de-cobranca.ts} e {@link ./evento-bancario.ts}
 * já registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.emissao_em_lote` numa
 * cadeia sem importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da unidade
 * de trabalho? NÃO.** As seis funções **recebem** o executor (`tx`) de quem já abriu a unidade;
 * nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * A IDEMPOTÊNCIA É DO PREDICADO, e uma segunda guarda é uma segunda regra (ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * {@link selecionarCobrancasSemBoleto} é **um predicado SQL** — `competencia = …` mais os três
 * `IS NULL` —, e é dele, e de mais nada, que sai a idempotência da reexecução: a cobrança que já
 * recebeu boleto tem `nosso_numero` preenchido e **sai do conjunto por construção**, de modo que o
 * segundo lote da mesma competência seleciona exatamente o complemento.
 *
 * Escrever, além dele, uma verificação de *"esta cobrança já foi emitida?"* no percurso seria a
 * segunda regra para o mesmo fato — livre para divergir da primeira, e sem nada que acuse quando
 * divergir. É o defeito que a §5.2 D da tech spec nomeia, e o precedente literal está em
 * `apps/worker/src/tarefas/regua.ts`.
 *
 * A ADR-0023 manda o predicado morar **no banco** porque ele *participa de seleção*: ler a carteira da
 * competência e filtrar em memória traria o conjunto inteiro para o processo antes de decidir, e
 * daria ao percurso a peça com que recompor o recorte por fora.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA DO LOTE CONCORRENTE É DO ÍNDICE — nunca de um `SELECT` antes do `INSERT`
 * ---------------------------------------------------------------------------
 *
 * {@link abrirEmissaoEmLote} **não lê nada antes de inserir**, e a ausência é a decisão. A forma
 * intuitiva — perguntar se há lote aberto e só então gravar — passa em todos os casos felizes e perde
 * a corrida: entre o `SELECT` que não achou e o `INSERT`, outra transação grava, e a empresa passa a
 * ter dois lotes em andamento com nada que decida qual vale. Quem recusa é
 * `emissao_em_lote_em_andamento_uidx`, índice único **parcial** sobre `(empresa_id)` onde os dois
 * instantes de desfecho são nulos. É a mesma lei registrada em `configuracao_de_mora_empresa_key` e em
 * `certificado_do_provedor_vigente_uidx`.
 *
 * A violação (`23505`) é **caminho normal de execução**, e não defeito: ela acontece toda vez que o
 * Admin clica duas vezes. Ela é traduzida em {@link ErroDeLoteEmCurso}, que carrega o **`id` do lote
 * em curso** para a borda compor `422` com `detalhes: { loteEmCurso: '…' }`. Capturar `23505` em bloco
 * seria pior que não capturar: `item_da_emissao_em_lote` tem a sua própria `UNIQUE (lote_id,
 * cobranca_id)`, e `emissao_em_lote_id_empresa_key` é o alvo das chaves estrangeiras compostas — um
 * `23505` sozinho não diz qual delas falou. Por isso a tradução discrimina **pelo nome do índice**, e
 * toda outra violação sobe intacta.
 *
 * A leitura do discriminante corre **depois** da recusa, de dentro de um `SAVEPOINT`, e não decide se
 * pode gravar — quando ela roda, o banco já recusou. Ver a seção seguinte.
 *
 * ---------------------------------------------------------------------------
 * O SAVEPOINT existe porque a transação ABORTA na violação — leia antes de removê-lo
 * ---------------------------------------------------------------------------
 *
 * No PostgreSQL, um erro dentro de uma transação a coloca em estado abortado: **qualquer** instrução
 * seguinte falha com `25P02` até um `ROLLBACK`. Sem o ponto de retorno, a leitura que **descreve** o
 * conflito — o `id` do lote em curso — seria impossível na mesma unidade, e a alternativa seria abrir
 * uma **segunda** unidade depois, o que a decisão D1 (unidade aberta na borda) e o
 * `ErroDeUnidadeAninhada` recusam.
 *
 * `tx.savepoint` reusa a transação corrente — é exatamente o mecanismo que o `REVERTER EXIGE` do
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts} nomeia como o aninhamento
 * **correto**. Ele **não** contraria aquele marcador: o que a marca recusa é abrir uma segunda unidade
 * (outra conexão, outra transação, com `COMMIT` próprio), e aqui não se abre nenhuma. Mesma forma, e
 * mesma razão, de `gravarSobIndiceDeVigencia` em {@link ./contrato.ts}.
 *
 * ---------------------------------------------------------------------------
 * O ESTADO É DERIVADO, e as contagens saem dos ITENS (ADR-0022, ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * **Não existe coluna `estado`**, e a ausência é a decisão da ADR-0022: o estado publicado sai dos
 * dois instantes de desfecho, e o `check` `emissao_em_lote_desfecho_unico_chk` garante que eles nunca
 * coexistem. Uma coluna seria a segunda fonte do mesmo fato, e a divergência entre ela e os instantes
 * seria muda.
 *
 * A derivação é avaliada **na aplicação**, em {@link estadoDoLote}, e isso é a ADR-0023 aplicada à
 * letra, não uma exceção a ela: aquela ADR manda a derivação para o banco quando ela *participa de
 * seleção* — filtro, ordenação, paginação — ou quando compõe *aritmética monetária*. O estado do lote
 * não faz nem uma coisa nem outra: nada nesta fatia filtra, ordena ou pagina lote por estado (a
 * leitura é por `id`), e não há dinheiro envolvido. É *"apresentação do registro já selecionado"*, que
 * é o lado da aplicação.
 *
 * **`emitidas` e `recusadas` são agregação sobre os itens** — nunca contadores mantidos numa coluna,
 * que seriam dois lugares gravando o mesmo fato. E eles são contados sobre **a mesma lista que a
 * leitura publica**, e não por um `count(… ) FILTER` numa segunda consulta: o nível de isolamento é
 * `READ COMMITTED`, em que cada instrução enxerga o próprio retrato, de modo que duas consultas
 * poderiam devolver uma contagem que não corresponde à lista exibida ao lado dela. Da forma escolhida,
 * `emitidas + recusadas === itens.length` é verdade **por construção**.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação.** As duas tabelas nascem com RLS **forçada**
 * (`migracoes/0018_seguranca_emissao_e_conciliacao.sql`), de modo que a política é avaliada com os
 * direitos de quem consulta. Acrescentar `empresaId` à assinatura seria escrever em código a
 * comparação que a política já faz — a "defesa em profundidade" que a `Decision` da ADR-0008 rejeita
 * por escrito, e o segundo caminho para o mesmo dado que ela nomeia.
 *
 * As duas escritas precisam **propor** um valor para a coluna, porque `empresa_id` é `NOT NULL` e não
 * tem padrão. Elas o obtêm de {@link empresaDoContexto}, que é a expressão literal das políticas
 * avaliada dentro da própria instrução. E o lote que apontasse para usuário de **outra** empresa, ou o
 * item que apontasse para lote ou cobrança alheios, são impossíveis sem que nada aqui os confira: as
 * três chaves estrangeiras **compostas** recusam o par que não existe.
 *
 * Por isso {@link lerLote} devolve `undefined` tanto para o lote inexistente quanto para o de outra
 * empresa — as duas ausências são deliberadamente **indistinguíveis**, e a borda traduz a segunda no
 * mesmo `404` da primeira, **num ponto único**. Traduzi-la aqui daria ao cliente a informação de que
 * aquele identificador existe em algum lugar.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS CHAVES DA COBRANÇA, e por que a SELEÇÃO entrega o UUID (ADR-0017)
 * ---------------------------------------------------------------------------
 *
 * O lote **não tem série declarada** — ninguém o pronuncia por número fora do sistema —, então a chave
 * exposta dele é o **UUID**, que é a classe que a ADR-0017 reserva para exatamente esse caso. É por
 * UUID que {@link lerLote}, {@link concluirLote} e {@link interromperLote} alcançam a linha, e é o
 * UUID que `esquemaDaEmissaoEmLote.id` publica.
 *
 * A cobrança é o contrário: ela tem série, então a chave dela é o **código** — e é o código que
 * {@link LinhaDoItemDoLote} publica, com a junção fazendo a tradução dentro da instrução, no mesmo
 * desenho de `lerTrilhaDaCobranca` e de `lerEnviosDaCobranca`.
 *
 * ⚠️ **{@link CobrancaSemBoleto} entrega as DUAS chaves da cobrança, e o `id` ali é deliberado.** O
 * cabeçalho de {@link ./evento-bancario.ts} afirma que *"nenhum símbolo publicado deste pacote entrega
 * o UUID interno de uma cobrança"*, e o alcance daquela frase é a **leitura publicada** que chega à
 * borda: as duas saídas que ela recusa são alargar `LinhaDeCobranca` com uma chave que rota nenhuma
 * aceita, e escrever uma consulta de tradução avulsa. Esta seleção não é nem uma nem outra — ela é a
 * leitura do **percurso do worker**, e é justamente a leitura que aquele arquivo pressupõe ao dizer que
 * *"quem grava um efeito já leu a cobrança"*: `registrarEventoBancario` e {@link registrarItemDoLote}
 * guardam a chave estrangeira **composta** `(cobranca_id, empresa_id)`, de modo que o UUID precisa
 * estar em mãos de quem percorre. Sem ele aqui, o percurso teria de traduzir código→UUID por uma
 * consulta avulsa, que é exatamente o segundo caminho para o mesmo recorte que a ADR-0017 fecha.
 *
 * O `codigo` viaja junto porque é a chave por onde o percurso alcança as portas da cobrança
 * (`gravarBoletoDaCobranca`) e é o que a prestação de contas nomeia. **E nada além dos dois**: a
 * seleção define o **conjunto**, não carrega o pedido de emissão. Replicar aqui valor, vencimento e
 * locatário criaria uma segunda projeção da cobrança ao lado de `colunasDaCobranca` — livre para
 * divergir dela —, e ainda assim não bastaria, porque o pedido precisa do cadastro do locatário, que
 * esta consulta não alcança.
 */

import type {
  DesfechoDoItemDoLote,
  EmissaoEmLote,
  EstadoDaEmissaoEmLote,
  ItemDoLote,
} from '@sysloc/contracts';
import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem lar único em `./contexto-de-escrita.ts`; ele **não é filtro**
// (nenhuma leitura deste arquivo o aplica, porque as duas tabelas já têm política), e existe só para a
// escrita, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// Os DOIS moldes têm casa única em `./moldes-de-formatacao.ts`, e são importados em vez de
// recopiados — ver o cabeçalho daquele módulo. O da DATA chegava aqui por exportação lateral de
// `./contrato.js` enquanto o débito `D7 · F4/T3` estava aberto; ele foi fechado descendo as três
// declarações para lá, e o import passou a apontar para a casa.
import { FORMATO_ISO_DA_DATA, FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * O que é preciso para abrir um lote — **dois** campos, e nada mais.
 *
 * Não há `empresaId`, e a ausência é o mecanismo (ADR-0008). Não há `criadoEm`: o instante é fato do
 * banco (ADR-0026), e um parâmetro daria a quem chama — e a quem verifica — o poder de escolher quando
 * o lote foi aberto. E não há conjunto de cobranças: **a seleção é do sistema** (RN-01), decidida pelo
 * predicado de {@link selecionarCobrancasSemBoleto}; o Admin informa só a competência.
 */
export interface EmissaoEmLoteNova {
  /** O mês que o lote cobre, sempre no primeiro dia — o `check` do banco o impõe. `YYYY-MM-DD`. */
  readonly competencia: string;
  /** Quem disparou. Amarrado à empresa pela chave estrangeira composta, nunca só pelo `id`. */
  readonly solicitadoPor: string;
}

/**
 * Uma cobrança do conjunto do lote — as **duas chaves**, e mais nada.
 *
 * O `id` é a chave estrangeira que o item e o evento guardam; o `codigo` é a chave exposta (ADR-0017)
 * por onde o percurso alcança as portas da cobrança e por onde a prestação de contas a nomeia. Ver o
 * cabeçalho deste arquivo para por que o UUID sai daqui, e por que nada além dos dois.
 */
export interface CobrancaSemBoleto {
  readonly id: string;
  readonly codigo: string;
}

/**
 * O que se registra por cobrança tentada — a prestação de contas da CA-02, linha a linha.
 *
 * `motivo` é omitido no desfecho `EMITIDO` e obrigatório no `RECUSADO`, e quem impõe as duas direções
 * é o `check` bicondicional `item_da_emissao_em_lote_motivo_chk` — não uma verificação escrita aqui,
 * que valeria só para este caminho de escrita. O que ele carrega é o que o provedor respondeu **tal
 * como respondido** (RN-15): texto opaco, que nada lê para decidir.
 */
export interface ItemDoLoteNovo {
  readonly loteId: string;
  /** O **UUID** da cobrança: a linha guarda a chave estrangeira composta `(cobranca_id, empresa_id)`. */
  readonly cobrancaId: string;
  readonly desfecho: DesfechoDoItemDoLote;
  readonly motivo?: string | null;
}

/**
 * Uma linha da prestação de contas, na projeção que o contrato publica — **três** campos.
 *
 * Ela **é** `ItemDoLote`, e não uma redigitação dele: um campo novo no recurso publicado faz
 * {@link itemPublicado} deixar de compilar, que é o alarme desejado — em vez de uma linha que a rota
 * publica com o campo faltando.
 */
export type LinhaDoItemDoLote = ItemDoLote;

/**
 * O lote na projeção que o contrato publica — **dez** campos, três deles derivados.
 *
 * Ele **é** `EmissaoEmLote` pela mesma razão do irmão acima: o compilador é quem amarra a projeção ao
 * recurso publicado. `estado`, `emitidas` e `recusadas` não são colunas — ver o cabeçalho.
 */
export type LinhaDoLote = EmissaoEmLote;

/**
 * O que a consulta do lote de fato lê — {@link LinhaDoLote} **menos** os três derivados e os itens.
 *
 * Declarar os dois tipos é o que impede a linha crua de escapar pela porta: quem sai daqui é
 * {@link LinhaDoLote}, e a travessia obriga a passar por {@link lotePublicado}. Mesmo desenho de
 * `LinhaBrutaDeCobranca` em {@link ./cobranca.ts} e de `LinhaBrutaDoEvento` em
 * {@link ./evento-bancario.ts}.
 */
type LinhaBrutaDoLote = Omit<EmissaoEmLote, 'estado' | 'emitidas' | 'recusadas' | 'itens'>;

/**
 * A empresa já tem uma emissão em lote em andamento — a recusa vinda do **índice único parcial**.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de API.
 * Quem o traduz no envelope da ADR-0017 — `422` com `detalhes: { loteEmCurso: '…' }` — é a borda, num
 * ponto único.
 *
 * O discriminante é o **`id` do lote em curso**, e ele é lido **depois** da recusa: é o que permite à
 * interface dizer *qual* emissão está acontecendo, em vez de mandar o Admin procurar. A leitura não
 * decide se pode gravar — quando ela corre, o banco já recusou.
 *
 * Sem esta tradução, o Admin que clicasse duas vezes receberia `500` com erro de driver — o modo de
 * falha que o Gate 2 da T2 nomeou por escrito ao aprovar o índice.
 */
export class ErroDeLoteEmCurso extends Error {
  override readonly name: string = 'ErroDeLoteEmCurso';

  /** O identificador do lote que já está em andamento — é ele que discrimina a recusa. */
  readonly loteEmCurso: string;

  constructor(loteEmCurso: string) {
    super('a empresa já tem uma emissão em lote em andamento');
    this.loteEmCurso = loteEmCurso;
  }
}

/**
 * As duas recusas de não-alcance, escritas **uma vez cada** e escolhidas pelo desfecho.
 *
 * O mapa é a fonte única do texto: ele mora ao lado da classe que o compõe, e não nos pontos de
 * `throw`, porque um literal por ponto de chamada é a segunda declaração do mesmo fato — ver o
 * cabeçalho de {@link ErroDeLoteNaoAlcancado} para por que a assinatura recusa a prosa.
 *
 * As chaves são os dois desfechos do lote, e são elas que dão o tipo do discriminante do construtor.
 */
const RECUSA_POR_DESFECHO = {
  CONCLUSAO: 'o lote foi concluído e não foi alcançado',
  INTERRUPCAO: 'o lote foi interrompido e não foi alcançado',
} as const;

/**
 * A instrução de desfecho **não alcançou a linha do lote** — a recusa que as duas portas levantam.
 *
 * É erro de **domínio**, e não de transporte, pela mesma razão de {@link ErroDeLoteEmCurso}: esta
 * camada não conhece HTTP nem código de erro de API.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE É CLASSE NOMEADA, e não um `Error` de texto
 * ---------------------------------------------------------------------------
 *
 * Zero linhas tem **duas** causas, e esta camada não pode separá-las — ver {@link concluirLote}. Uma é
 * grave (alvo errado, ou contexto de tenant montado de outro modo na unidade que fecha) e outra é
 * **benigna e prevista**: o reenvio da tarefa, que a entrega *at-least-once* torna alcançável.
 *
 * Quem sabe qual delas está acontecendo é o **chamador** — ele conhece a tentativa em curso, e a
 * camada de dados não —, e é por isso que a recusa precisa ser reconhecível **em runtime** por quem
 * decide: com um `Error` de texto, a borda do processo de trabalho teria de casar mensagem para
 * distinguir *"a tarefa já rodou"* de uma falha de driver, e tratar o reenvio como falha queima as
 * três tentativas e termina em `failed` dizendo ao operador o oposto da verdade.
 *
 * O que ele carrega são os **fatos que a própria instrução deu**: qual lote a escrita não alcançou e
 * qual das duas portas recusou. Não há leitura para enriquecê-lo, e a ausência é decisão — ela seria
 * uma segunda regra sobre o mesmo fato, e depois da recusa exigiria ponto de retorno, maquinaria
 * desproporcional para compor uma mensagem.
 *
 * ---------------------------------------------------------------------------
 * O CONSTRUTOR RECEBE O DESFECHO, e nunca a prosa — a mensagem é composta AQUI
 * ---------------------------------------------------------------------------
 *
 * A forma intuitiva — receber a mensagem pronta de quem levanta — passa em todos os casos e cria **duas
 * fontes do mesmo texto**, uma por ponto de `throw`, livres para divergir sem que nada acuse. É a mesma
 * *"segunda regra livre para divergir da primeira"* que o cabeçalho deste arquivo usa para recusar a
 * guarda de emissão no percurso, e é a razão pela qual as outras classes de erro deste pacote —
 * {@link ErroDeLoteEmCurso} à frente delas — recebem **o discriminante do fato** e compõem o próprio
 * texto.
 *
 * O discriminante é a união fechada dos dois desfechos, e não um texto livre: um valor fora dela **não
 * compila**, de modo que não existe caminho de construção — inclusive os que ainda não existem — capaz
 * de produzir uma terceira mensagem. E ele fica legível em runtime, que é o que permite a quem trata a
 * recusa saber qual porta falou sem casar mensagem.
 */
export class ErroDeLoteNaoAlcancado extends Error {
  override readonly name: string = 'ErroDeLoteNaoAlcancado';

  /** O lote que a escrita **não** alcançou — o primeiro fato que a instrução dá sobre a recusa. */
  readonly loteId: string;

  /** Qual porta recusou — o segundo fato, e o que escolhe a mensagem sem que ela venha de fora. */
  readonly desfecho: 'CONCLUSAO' | 'INTERRUPCAO';

  constructor(loteId: string, desfecho: 'CONCLUSAO' | 'INTERRUPCAO') {
    super(RECUSA_POR_DESFECHO[desfecho]);
    this.loteId = loteId;
    this.desfecho = desfecho;
  }
}

/**
 * O nome do **índice** único parcial do lote em andamento, como o servidor o reporta.
 *
 * Ele é **discriminante**: as duas tabelas desta fatia têm outras restrições únicas —
 * `emissao_em_lote_id_empresa_key`, alvo das chaves estrangeiras compostas, e
 * `item_da_emissao_em_lote_lote_cobranca_key`, que impede a mesma cobrança de entrar duas vezes no
 * mesmo lote —, e um `23505` sozinho não diz qual delas falou.
 *
 * É índice, e não restrição, porque o PostgreSQL não admite restrição única parcial. Para o campo
 * `constraint_name` do erro isso não faz diferença: o servidor reporta o nome do índice que recusou.
 */
const INDICE_DO_LOTE_EM_ANDAMENTO = 'emissao_em_lote_em_andamento_uidx';

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar o índice acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * Os três estados que esta porta **publica**, nomeados uma vez cada.
 *
 * A anotação é `EstadoDaEmissaoEmLote` de propósito: literal fora da união fechada de
 * `@sysloc/contracts` **não compila** (ADR-0016), e é isso que impede um estado inventado de chegar ao
 * recurso publicado. Eles não têm enum no banco, e não devem ter — ver o cabeçalho.
 */
const ESTADO_EM_ANDAMENTO: EstadoDaEmissaoEmLote = 'EM_ANDAMENTO';
const ESTADO_CONCLUIDA: EstadoDaEmissaoEmLote = 'CONCLUIDA';
const ESTADO_INTERROMPIDA: EstadoDaEmissaoEmLote = 'INTERROMPIDA';

/** Os dois desfechos que a agregação conta, pelo mesmo critério de tipo dos estados acima. */
const DESFECHO_EMITIDO: DesfechoDoItemDoLote = 'EMITIDO';
const DESFECHO_RECUSADO: DesfechoDoItemDoLote = 'RECUSADO';

/**
 * A prestação de contas de um lote recém-aberto — **vazia**, e é fato, não ausência de informação.
 *
 * Nenhum item pode existir para um lote que a instrução acabou de inserir: a chave estrangeira composta
 * de `item_da_emissao_em_lote` só aceita lote já gravado. Ler os itens depois do `INSERT` seria uma ida
 * ao banco para descobrir o que a própria instrução acabou de determinar.
 *
 * **Congelada — é compartilhada por toda abertura**, no molde de `POLITICA_AUSENTE`
 * ({@link ./configuracao-de-mora.ts}) e de `SEM_FIADORES` ({@link ./contrato.ts}). O congelamento age
 * sobre o **valor** e não sobre o tipo, e por isso vale em qualquer camada: {@link lotePublicado} ainda
 * copia a lista antes de publicá-la, de modo que nem o alias escapa.
 */
const SEM_ITENS: readonly LinhaDoItemDoLote[] = Object.freeze([]);

/**
 * A projeção do lote, escrita **uma vez** e reusada pela abertura e pela leitura.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo padrão, e mesma
 * justificativa, de `colunasDaCobranca` em {@link ./cobranca.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede duas traduções livres para divergir. E `empresa_id` e
 * `solicitado_por` **não** estão na lista — o que a porta devolve é o que o contrato publica.
 *
 * A competência sai por `to_char` e a escolha é conteúdo: o driver entregaria uma coluna `date` como
 * objeto `Date` no fuso do processo, e reserializá-lo desloca a data em um dia para metade dos fusos.
 * Os três instantes saem em ISO-8601 UTC composto **pelo servidor**, com `AT TIME ZONE 'UTC'` fixando o
 * deslocamento no objeto em vez de no fuso da sessão — e `to_char` de nulo é nulo, de modo que o lote
 * ainda em andamento atravessa com os dois carimbos vazios.
 */
function colunasDoLote(tx: TransactionSql): Fragment {
  return tx`
    id,
    to_char(competencia, ${FORMATO_ISO_DA_DATA}) AS "competencia",
    to_char(criado_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "criadoEm",
    to_char(concluido_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "concluidoEm",
    to_char(interrompido_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "interrompidoEm",
    motivo_da_interrupcao AS "motivoDaInterrupcao"
  `;
}

/**
 * O estado publicado, **derivado** dos dois instantes de desfecho (ADR-0022).
 *
 * A ordem dos ramos não decide nada, e é essa a garantia: `emissao_em_lote_desfecho_unico_chk` torna
 * *concluído E interrompido* irrepresentável, de modo que no máximo um dos dois carimbos existe. Ela
 * segue a ordem em que o contrato descreve a derivação, para que as duas leituras coincidam palavra
 * por palavra.
 *
 * Ela é a única fonte do estado neste pacote: uma segunda derivação — no serviço, na borda ou numa
 * consulta — apareceria como um segundo lugar decidindo o mesmo fato, que é o que a ADR-0022 fecha.
 */
function estadoDoLote(linha: LinhaBrutaDoLote): EstadoDaEmissaoEmLote {
  if (linha.interrompidoEm !== null) {
    return ESTADO_INTERROMPIDA;
  }

  if (linha.concluidoEm !== null) {
    return ESTADO_CONCLUIDA;
  }

  return ESTADO_EM_ANDAMENTO;
}

/**
 * O item copiado campo a campo — **o ponto único** da tradução da consulta em contrato.
 *
 * Os três campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer
 * coluna que a projeção venha a ganhar — a começar por `empresa_id`, por `lote_id` e pelo `id` que o
 * recurso declaradamente não expõe. Mesma decisão de `eventoPublicado` em
 * {@link ./evento-bancario.ts}.
 *
 * A cópia tem um segundo efeito, e ele é medido: o objeto que o driver devolve carrega protótipo
 * próprio, montado a partir da descrição das colunas, e devolvê-lo direto faria a comparação estrita da
 * suíte reprovar por **classe** do objeto em vez de por valor.
 *
 * **Não há conversão de `numeric` aqui, e a ausência é conteúdo**: nenhum dos três campos é dinheiro —
 * a prestação de contas nomeia a cobrança e a razão, e o valor dela mora na própria cobrança.
 */
function itemPublicado(linha: LinhaDoItemDoLote): LinhaDoItemDoLote {
  return {
    cobrancaCodigo: linha.cobrancaCodigo,
    desfecho: linha.desfecho,
    motivo: linha.motivo,
  };
}

/**
 * O lote publicado — **o ponto único** onde a linha crua, os itens e os três derivados viram contrato.
 *
 * Os campos gravados são copiados um a um pela razão de {@link itemPublicado}; os três derivados são
 * compostos aqui, e em lugar nenhum mais. As contagens saem **desta mesma lista de itens**, e não de
 * uma segunda consulta agregada: ver o cabeçalho para por que isso é o que faz
 * `emitidas + recusadas === itens.length` valer por construção.
 *
 * A lista é **copiada** antes de sair. Sem a cópia, quem chama receberia um alias — e, no caso do lote
 * recém-aberto, um alias de {@link SEM_ITENS}, que é objeto de módulo compartilhado por toda abertura.
 */
function lotePublicado(linha: LinhaBrutaDoLote, itens: readonly LinhaDoItemDoLote[]): LinhaDoLote {
  return {
    id: linha.id,
    competencia: linha.competencia,
    estado: estadoDoLote(linha),
    criadoEm: linha.criadoEm,
    concluidoEm: linha.concluidoEm,
    interrompidoEm: linha.interrompidoEm,
    motivoDaInterrupcao: linha.motivoDaInterrupcao,
    emitidas: itens.filter((item) => item.desfecho === DESFECHO_EMITIDO).length,
    recusadas: itens.filter((item) => item.desfecho === DESFECHO_RECUSADO).length,
    itens: [...itens],
  };
}

/**
 * Reconhece a recusa de **uma** restrição nomeada.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver, e
 * o par (`code`, `constraint_name`) é o contrato do protocolo. Casar pelo texto da mensagem seria
 * amarrar a tradução ao idioma configurado no servidor.
 *
 * O nome é **parâmetro** pelo mesmo desenho de {@link ./contrato.ts}: uma função sem ele traduziria
 * `23505` em bloco, que é exatamente o que o cabeçalho recusa.
 */
function ehViolacaoDe(erro: unknown, restricao: string): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return falha?.code === VIOLACAO_DE_UNICIDADE && falha.constraint_name === restricao;
}

/**
 * Lê o `id` do lote que já está em andamento — **depois** de o banco ter recusado.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a política já recorta a leitura (ADR-0008). O
 * índice único parcial garante que a condição alcança no máximo uma linha por empresa, de modo que a
 * consulta devolve uma ou nenhuma.
 *
 * A ausência de linha é estado impossível: o índice acabou de recusar porque existe um lote em
 * andamento. Ela levanta com nome, em vez de escolher um discriminador por omissão e afirmar ao Admin
 * um identificador que ninguém apurou. Mesmo desenho de `lerCodigoDoContratoVigente` em
 * {@link ./contrato.ts}.
 */
async function lerLoteEmCurso(tx: TransactionSql): Promise<string> {
  const [emCurso] = await tx<{ id: string }[]>`
    SELECT id
      FROM negocio.emissao_em_lote
     WHERE concluido_em IS NULL
       AND interrompido_em IS NULL
  `;

  if (emCurso === undefined) {
    throw new Error('o índice do lote em andamento recusou a escrita e o lote não é alcançável');
  }

  return emCurso.id;
}

/**
 * Abre uma emissão em lote para a competência informada, ou recusa se já houver uma em andamento.
 *
 * **Não há leitura antes da escrita**, e a recusa do segundo lote é do índice único parcial — ver o
 * cabeçalho deste arquivo para as duas razões (a corrida que a leitura prévia perde, e a
 * discriminação pelo nome do índice). A escrita corre dentro de um `SAVEPOINT` porque a transação
 * aborta na violação, e a leitura do discriminante precisa correr depois dela, na mesma unidade.
 *
 * Toda violação que **não** seja a do índice nomeado é **repassada intacta** — a da chave estrangeira
 * composta do usuário, por exemplo, ou a de qualquer restrição que a tabela venha a ganhar. Traduzir
 * `23505` em bloco diria ao Admin que já existe lote em andamento quando quem falou foi outra coisa.
 *
 * O lote devolvido está `EM_ANDAMENTO` com a prestação de contas vazia, e isso é fato e não estimativa:
 * item nenhum pode existir para um lote que a instrução acabou de inserir.
 */
export async function abrirEmissaoEmLote(
  tx: TransactionSql,
  dados: EmissaoEmLoteNova,
): Promise<LinhaDoLote> {
  try {
    const linha = await tx.savepoint(async (escrita) => {
      const [aberto] = await escrita<LinhaBrutaDoLote[]>`
        INSERT INTO negocio.emissao_em_lote (empresa_id, competencia, solicitado_por)
        VALUES (${empresaDoContexto(escrita)},
                ${dados.competencia}::date,
                ${dados.solicitadoPor})
        RETURNING ${colunasDoLote(escrita)}
      `;

      return aberto;
    });

    if (linha === undefined) {
      // Inalcançável: um `INSERT … RETURNING` de uma linha ou devolve a linha ou levanta. O ramo
      // existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele trocaria uma
      // falha nomeada por um `undefined` viajando como se fosse o lote aberto.
      throw new Error('a emissão em lote foi aberta e a linha não voltou');
    }

    return lotePublicado(linha, SEM_ITENS);
  } catch (erro) {
    if (!ehViolacaoDe(erro, INDICE_DO_LOTE_EM_ANDAMENTO)) {
      throw erro;
    }

    throw new ErroDeLoteEmCurso(await lerLoteEmCurso(tx));
  }
}

/**
 * O conjunto do lote: as cobranças da competência **em aberto e sem boleto** — o predicado da ADR-0023.
 *
 * Os quatro termos são o predicado inteiro, e não há um quinto escrito em lugar nenhum: a competência
 * pedida, `pago_em IS NULL`, `cancelado_em IS NULL` e `nosso_numero IS NULL`. É deste último que sai a
 * idempotência da reexecução — ver o cabeçalho para por que uma segunda guarda no percurso seria uma
 * segunda regra livre para divergir desta.
 *
 * **Nada além da competência entra**: o Admin não escolhe cobrança (RN-01), e um parâmetro a mais aqui
 * seria a seleção deixando de ser do sistema.
 *
 * ⚠️ **A consulta é sobre a TABELA, e não sobre `negocio.cobranca_derivada`, e isso não contraria a
 * fonte única do estado.** O que o predicado lê são **fatos gravados** — dois carimbos e um
 * identificador —, e não o estado publicado: nenhum dos quatro rótulos de `negocio.status_cobranca`
 * aparece aqui, e é essa ausência que o `CT-510` mede. A visão existe para quem precisa do **estado**
 * e da **mora**, que ela deriva no banco (ADR-0022, ADR-0023); pedi-la aqui pagaria as três junções
 * laterais dela e o vínculo com o contrato para não usar nenhuma das colunas que só ela tem — e
 * sugeriria que a elegibilidade depende do estado derivado, quando ela depende de a cobrança ainda não
 * ter boleto.
 *
 * Não há `WHERE empresa_id`: a política recorta (ADR-0008), e é por isso que a mesma chamada, sob outro
 * contexto, devolve o conjunto **daquela** empresa sem que nada aqui compare coisa alguma.
 *
 * A ordem é por **código**, e o que ela entrega é determinismo: o percurso é sequencial e a retomada
 * precisa reencontrar a mesma sucessão, e um conjunto sem ordem declarada deixaria a sequência ao
 * critério do plano de execução. Ela não é prioridade de negócio — ninguém declarou uma —, e o código é
 * único por empresa, de modo que não há empate a desfazer.
 */
export async function selecionarCobrancasSemBoleto(
  tx: TransactionSql,
  competencia: string,
): Promise<readonly CobrancaSemBoleto[]> {
  const linhas = await tx<CobrancaSemBoleto[]>`
    SELECT id, codigo
      FROM negocio.cobranca
     WHERE competencia = ${competencia}::date
       AND pago_em IS NULL
       AND cancelado_em IS NULL
       AND nosso_numero IS NULL
     ORDER BY codigo
  `;

  return linhas.map((linha) => ({ id: linha.id, codigo: linha.codigo }));
}

/**
 * Registra o desfecho de **uma** cobrança tentada no lote.
 *
 * ---------------------------------------------------------------------------
 * O que a instrução NÃO tem, e cada ausência é decisão
 * ---------------------------------------------------------------------------
 *
 *   * **`registrado_em` não aparece na lista de colunas**: ele nasce do `DEFAULT now()` da tabela
 *     (ADR-0026). Abrir um parâmetro de instante daria a quem chama o poder de escolher quando a
 *     tentativa aconteceu, e é por esse instante que a prestação de contas ordena;
 *   * **nenhuma comparação de empresa**: `empresa_id` é *proposto* por {@link empresaDoContexto} e
 *     *aceito ou recusado* pelo `WITH CHECK` da política (ADR-0008);
 *   * **nenhuma conferência de que o lote ou a cobrança existem**. Quem as impõe são as duas chaves
 *     estrangeiras compostas, que recusam tanto o identificador inexistente quanto o de outra empresa
 *     — e recusam **toda** escrita, inclusive as que ainda não existem;
 *   * **nenhuma conferência de que `RECUSADO` traz motivo**. Quem a impõe é
 *     `item_da_emissao_em_lote_motivo_chk`, bicondicional, que recusa também a direção contrária —
 *     motivo em item emitido. Uma verificação escrita aqui valeria só para este caminho.
 *
 * Ela devolve `void`: o que a camada de cima faz com o item registrado é lê-lo pela prestação de
 * contas, e um retorno existiria apenas para ser conferido contra o que a própria chamada informou.
 */
export async function registrarItemDoLote(tx: TransactionSql, item: ItemDoLoteNovo): Promise<void> {
  await tx`
    INSERT INTO negocio.item_da_emissao_em_lote
                (empresa_id, lote_id, cobranca_id, desfecho, motivo)
    VALUES (${empresaDoContexto(tx)},
            ${item.loteId},
            ${item.cobrancaId},
            ${item.desfecho}::negocio.desfecho_do_item_do_lote,
            ${item.motivo ?? null})
  `;
}

/**
 * Marca o lote como **concluído** — o desfecho do percurso que chegou ao fim.
 *
 * ---------------------------------------------------------------------------
 * O QUE A `CHECK` COBRE, e o que ela deixa passar
 * ---------------------------------------------------------------------------
 *
 * `emissao_em_lote_desfecho_unico_chk` recusa a combinação dos **dois** desfechos — concluir um lote já
 * interrompido —, e é ela que os torna mutuamente exclusivos para **todo** caminho de escrita,
 * inclusive os que ainda não existem. **E é só isso que ela cobre**: a repetição do **mesmo** desfecho
 * ela aprova, porque a linha continua coerente consigo mesma.
 *
 * Quem fecha a repetição é o segundo termo da cláusula, `concluido_em IS NULL`. Ele **não é leitura
 * prévia**: não há `SELECT`, o predicado do estado é avaliado dentro da própria instrução, e por isso
 * não existe janela entre decidir e gravar — uma interrupção gravada no intervalo não é perdida numa
 * corrida, ela simplesmente faz a linha deixar de ser alcançada.
 *
 * ---------------------------------------------------------------------------
 * A LINHA ALCANÇADA É CONFERIDA — e zero linhas tem DUAS causas, uma grave e uma benigna
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **O identificador VEM DE FORA, e a reentrância é desenho declarado desta fatia — não acidente.**
 * Quem fecha o lote é o processo de trabalho, e o `loteId` viaja **na carga da tarefa**
 * (`CargaDaEmissaoEmLote`, `{ empresaId, loteId }`), com entrega **at-least-once** e **três**
 * tentativas com espera exponencial. Some-se a isso que a borda não desfaz o lote quando o
 * enfileiramento falha — ele fica `EM_ANDAMENTO`, e *a próxima tentativa reusa o mesmo lote pelo índice
 * parcial*. Logo esta instrução alcança zero linhas por **dois** percursos, e nenhum deles é impossível:
 *
 *   * **benigno — o reenvio da tarefa**: a tentativa anterior executou, o desfecho **comitou**, e o
 *     processo caiu antes do reconhecimento, que é exatamente o que *at-least-once* significa. Na
 *     redistribuição, a tentativa seguinte corre com o **mesmo** `loteId`,
 *     {@link selecionarCobrancasSemBoleto} devolve o complemento **vazio** (a idempotência do predicado
 *     funcionando), e `concluido_em IS NULL` deixa de alcançar a linha porque o desfecho **já está
 *     gravado**. Nada se perdeu — o fato existe;
 *   * **grave — o alvo errado**: identificador que não corresponde a lote nenhum, ou **contexto de
 *     tenant montado de outro modo na unidade que fecha** (ADR-0024, risco concreto justamente no
 *     processo de trabalho, onde o contexto vem da carga e não da requisição), em que a política esconde
 *     a linha. Aqui a escrita não teve efeito em **tentativa alguma**: o lote fica para sempre com os
 *     dois carimbos nulos, `emissao_em_lote_em_andamento_uidx` recusa **toda** abertura seguinte da
 *     empresa, e o único sinal seria um {@link ErroDeLoteEmCurso} apontando um lote que ninguém consegue
 *     fechar pela interface.
 *
 * ⚠️ **A justificativa da idempotência que a tech spec registra alcança o PREDICADO, e não este passo
 * terminal**: *"a repetição é segura porque o predicado do conjunto já exclui quem tem boleto"* é
 * verdade sobre a seleção, e não diz nada sobre o desfecho. É por isso que a distinção acima precisa
 * estar escrita aqui, no ponto em que quem for ligar o processo de trabalho vai lê-la.
 *
 * **Esta camada não separa os dois, e não deve tentar.** Separá-los exigiria ler a linha — antes, e
 * seria segunda regra sobre o mesmo fato numa corrida; ou depois, e exigiria ponto de retorno para
 * enriquecer uma mensagem. O que a instrução dá é o fato, e é o que a recusa carrega: **a linha não foi
 * alcançada**. Quem decide se isso é benigno é o **chamador**, que sabe se está reentrando — e por isso
 * a recusa é {@link ErroDeLoteNaoAlcancado}, classe nomeada, que a borda pode tratar como desfecho
 * terminal benigno em vez de queimar as três tentativas, sem confundi-la com falha de driver.
 *
 * O que **não** se admite é resolver em silêncio, e é isso que a conferência fecha: sem ela, o percurso
 * do alvo errado seguiria acreditando que fechou. Mesmo mecanismo, e mesma razão, de
 * `definirSituacaoDeLocacaoDoImovel` em {@link ./imovel.ts} — a escrita não ter efeito **em silêncio** é
 * o modo de falha desta operação.
 *
 * Não há `WHERE empresa_id`, e não pode haver: a política recorta a escrita (ADR-0008). ⚠️ **A
 * indistinguibilidade que {@link lerLote} preserva NÃO se estende a esta escrita**, e a distinção é a
 * origem do identificador: lá ele vem do **cliente**, e revelar que ele existe em outra empresa seria o
 * vazamento que a ADR-0008 fecha; aqui ele vem de uma carga que o próprio sistema compôs a partir de um
 * lote que ele gravou, e o silêncio não protege ninguém — apenas esconde um percurso sem efeito.
 */
export async function concluirLote(tx: TransactionSql, loteId: string): Promise<void> {
  const resultado = await tx`
    UPDATE negocio.emissao_em_lote
       SET concluido_em = pg_catalog.now()
     WHERE id = ${loteId}
       AND concluido_em IS NULL
  `;

  if (resultado.count !== 1) {
    throw new ErroDeLoteNaoAlcancado(loteId, 'CONCLUSAO');
  }
}

/**
 * Marca o lote como **interrompido**, com o motivo — o desfecho da falha que é da empresa (RN-02).
 *
 * As duas colunas mudam **na mesma instrução**, e é `emissao_em_lote_interrupcao_coerente_chk` que
 * torna qualquer outra combinação irrepresentável: interromper sem dizer por quê é o pior desfecho da
 * CA-03, e o motivo não é recuperável depois. Escrever as duas em instruções separadas deixaria uma
 * janela em que a linha viola a bicondicional.
 *
 * O motivo entra **tal como informado** (RN-15) — texto opaco, que nada lê para decidir.
 *
 * ---------------------------------------------------------------------------
 * A REPETIÇÃO NÃO REESCREVE O MOTIVO — e é por isso que a cláusula tem dois termos
 * ---------------------------------------------------------------------------
 *
 * Quem recusa a interrupção de um lote já **concluído** é `emissao_em_lote_desfecho_unico_chk`, no
 * banco — a mesma exclusividade de {@link concluirLote}. **Ela não alcança a repetição do mesmo
 * desfecho**: sobre um lote já interrompido, o `check` de desfecho único aprova (`concluido_em` segue
 * nulo) e o de coerência também (as duas colunas continuam coerentes entre si), de modo que as duas
 * colunas seriam reescritas e o motivo original desapareceria **sem deixar rastro** — o pior desfecho
 * possível num arquivo que declara, logo acima, que o motivo *não é recuperável depois*.
 *
 * Quem fecha isso é `interrompido_em IS NULL` na própria instrução: o primeiro motivo sobrevive, e a
 * segunda interrupção não alcança linha alguma — o que a conferência abaixo transforma em falha
 * **nomeada**, em vez de sobrescrita silenciosa. Não é leitura prévia, e não há janela: o predicado do
 * estado é avaliado dentro do `UPDATE`.
 *
 * A conferência da linha alcançada tem a mesma razão de {@link concluirLote} — **leia-a lá**, e leia
 * junto as **duas causas** de zero linhas que ela nomeia: aqui elas são as mesmas, porque o `loteId`
 * também chega **pela carga da tarefa** e a entrega é *at-least-once*. A segunda interrupção do reenvio
 * é o percurso **benigno** (o motivo já está gravado, e é ele que se quis preservar); o alvo errado ou o
 * contexto de tenant montado de outro modo é o **grave**. Esta camada não os separa, e por isso a recusa
 * é {@link ErroDeLoteNaoAlcancado} — classe nomeada, para que quem sabe se está reentrando decida. Lá
 * está também por que a indistinguibilidade de {@link lerLote} não se estende a esta escrita.
 */
export async function interromperLote(
  tx: TransactionSql,
  loteId: string,
  motivo: string,
): Promise<void> {
  const resultado = await tx`
    UPDATE negocio.emissao_em_lote
       SET interrompido_em = pg_catalog.now(),
           motivo_da_interrupcao = ${motivo}
     WHERE id = ${loteId}
       AND interrompido_em IS NULL
  `;

  if (resultado.count !== 1) {
    throw new ErroDeLoteNaoAlcancado(loteId, 'INTERRUPCAO');
  }
}

/**
 * Lê **um** lote com a prestação de contas inteira — o que a CA-02 publica.
 *
 * ---------------------------------------------------------------------------
 * NÃO HÁ JANELA sobre os itens, e a ausência é conteúdo
 * ---------------------------------------------------------------------------
 *
 * A lista é o conjunto do lote, que é o conjunto das cobranças em aberto de **uma** competência —
 * pequeno por construção, e conhecido antes de o percurso começar. Paginá-la acrescentaria ao contrato
 * um envelope que ninguém precisa, e às contagens um segundo retrato: `emitidas` e `recusadas`
 * descrevem o lote inteiro, e ficariam ao lado de uma página que não é ele.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM é a do PERCURSO, e o desempate é pelo código
 * ---------------------------------------------------------------------------
 *
 * `registrado_em` crescente é a ordem em que o lote aconteceu, que é a que o Admin lê para saber **onde
 * parou** quando a emissão foi interrompida. O desempate por `codigo` não é ornamento: `now()` é o
 * instante do **início da transação**, de modo que dois itens gravados na mesma unidade de trabalho
 * carregam carimbos idênticos, e sem ele duas leituras da mesma prestação de contas poderiam devolver
 * ordens diferentes. Mesmo mecanismo de `lerTrilhaDaCobranca`, com o desempate por uma chave que o
 * leitor reconhece em vez de por um UUID que ele não vê.
 *
 * ---------------------------------------------------------------------------
 * O LOTE INTERROMPIDO É DEVOLVIDO, e é essa a metade que importa
 * ---------------------------------------------------------------------------
 *
 * Nada aqui recorta por estado: o lote interrompido volta com `interrompidoEm`, `motivoDaInterrupcao` e
 * os itens que chegaram a ser gravados. É o que permite ao Admin ver onde parou e por quê — o oposto de
 * uma leitura que escondesse o desfecho ruim.
 *
 * `undefined` tem **duas** causas deliberadamente indistinguíveis: o lote não existe, ou é de outra
 * empresa e a política o esconde. Quem as traduz no mesmo `404` é a borda, num ponto único (ADR-0008).
 */
export async function lerLote(
  tx: TransactionSql,
  loteId: string,
): Promise<LinhaDoLote | undefined> {
  const [linha] = await tx<LinhaBrutaDoLote[]>`
    SELECT ${colunasDoLote(tx)}
      FROM negocio.emissao_em_lote
     WHERE id = ${loteId}
  `;

  if (linha === undefined) {
    return undefined;
  }

  // A junção é o tradutor da chave da cobrança (ADR-0017), e ela **não** carrega cláusula de empresa: a
  // política forçada recorta as duas relações, e `item_da_emissao_em_lote.cobranca_id` só pode apontar
  // para cobrança da mesma empresa porque a chave estrangeira é composta.
  const itens = await tx<LinhaDoItemDoLote[]>`
    SELECT c.codigo AS "cobrancaCodigo",
           i.desfecho,
           i.motivo
      FROM negocio.item_da_emissao_em_lote i
      JOIN negocio.cobranca c ON c.id = i.cobranca_id
     WHERE i.lote_id = ${loteId}
     ORDER BY i.registrado_em, c.codigo
  `;

  return lotePublicado(linha, itens.map(itemPublicado));
}
