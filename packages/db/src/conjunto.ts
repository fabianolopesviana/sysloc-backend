/**
 * Conjunto — o agrupamento de imóveis, e a **porta única** de leitura e escrita dele.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./pessoa.ts} e {@link ./empresa.ts} já registram: a contenção da §11.2 é de
 * **tipo** e não alcança **texto de SQL**. Um serviço de aplicação com o executor da unidade de
 * trabalho em mãos escreve `negocio.conjunto` numa cadeia sem importar nada de proibido, e o alcance
 * às tabelas do domínio deixa de ser enumerável. Toda instrução que o ciclo de vida do conjunto
 * precisa vive aqui, publicada como função de domínio.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As seis funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. A sexta é
 * {@link lerCarteira}, da T10, e ela não abre exceção: compõe as portas dos dois níveis com o
 * executor que recebeu.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO DE CIRCULAÇÃO É DA PORTA — e é isso que o CT-348 mede
 * ---------------------------------------------------------------------------
 *
 * A ADR-0014 fixa que cadastro de domínio **nunca é apagado**: retirar é retirar de circulação, e a
 * marca é `retirado_em`. Ela nomeia, entre os próprios *Cons*, o modo de falha que essa decisão
 * cria: *"toda consulta de listagem e todo seletor passa a carregar o predicado de circulação;
 * esquecê-lo é um defeito silencioso, que mostra registro retirado como se estivesse ativo"*.
 *
 * Um defeito **silencioso** não se fecha pedindo lembrança a quem escreve a próxima listagem. Ele se
 * fecha invertendo o default: {@link listarConjuntos} aplica o predicado **por padrão**, e incluir
 * retirados exige o parâmetro nomeado {@link OpcoesDeCirculacao.incluirRetirados}. Quem esquece o
 * parâmetro obtém a listagem **correta**; quem quer os retirados precisa dizê-lo por escrito, e a
 * decisão aparece no diff.
 *
 * É por isso que o predicado mora **aqui**, e não no serviço que chama esta porta. Movê-lo para lá
 * deixaria as duas leituras (a página e o total) livres para divergir, e a próxima entidade — imóvel,
 * cômodo, as três pessoas — repetiria a escolha do zero. O `CT-348` chama estas funções
 * **diretamente**, justamente para que mover o filtro para o serviço o reprove enquanto os casos de
 * rota continuam verdes.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA POR IDENTIFICADOR NÃO TEM PREDICADO, e a assimetria é deliberada
 * ---------------------------------------------------------------------------
 *
 * {@link localizarConjunto} devolve o conjunto **retirado** como devolve o que está em circulação, e
 * a razão é operacional: a recirculação é uma rota sobre `:id`, e uma leitura por identificador que
 * escondesse o retirado tornaria a volta dele **inalcançável pela interface** — quem retirou por
 * engano não teria como desfazer.
 *
 * A assimetria não reabre o defeito que o parágrafo anterior fecha: o defeito silencioso é o do
 * **seletor** — a lista que o usuário percorre sem saber que um item ali já não circula. Uma leitura
 * por identificador só é feita por quem já tem o identificador em mãos, e a marca vai no corpo.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008) — e o que isso implica no INSERT
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** `negocio.conjunto` nasce com RLS **forçada**, de modo que a
 * política decide o que cada leitura enxerga e o que cada escrita pode gravar. Não há, aqui, um
 * `WHERE empresa_id = …` — a defesa em profundidade que a `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é
 * `NOT NULL` e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a **expressão literal
 * das políticas** de `migracoes/0006_seguranca_dominio.sql`, avaliada dentro da própria instrução —
 * exatamente o desenho de `garantirVinculoDeAcesso` em {@link ./pessoa.ts}. O identificador da
 * empresa continua sem passar pela aplicação: ele sai da variável de sessão que a unidade de trabalho
 * fixou a partir do contexto que a guarda publicou **da sessão**, e o `WITH CHECK` da política segue
 * sendo quem aceita ou recusa a linha.
 */

import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts` (débito D7,
// fechado na T7 da fatia `cadastro-de-imoveis-e-pessoas`). Ele **não é filtro** sobre
// `negocio.conjunto` — nenhuma leitura deste arquivo o aplica, porque a tabela já tem política e um
// segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita. Ele existe para a **escrita**,
// onde `empresa_id` é `NOT NULL` sem padrão e a instrução precisa propor um valor.
import { empresaDoContexto } from './contexto-de-escrita.js';
// A leitura de `negocio.imovel` mora no módulo dono daquela tabela, e não aqui: é lá que vive toda
// instrução sobre ela, pela mesma razão de enumerabilidade que este cabeçalho registra. O que este
// arquivo faz é **compor** — exatamente o desenho de `imovel.ts` sobre `comodo.ts`, um nível abaixo.
// A aresta não fecha ciclo em execução: `imovel.ts` importa daqui apenas um **tipo**
// (`OpcoesDeCirculacao`), e `import type` é apagado na compilação.
import { type ImovelPersistido, lerImoveisDeConjuntos } from './imovel.js';

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDeConjuntos {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * Se a leitura de lista alcança o que **saiu de circulação**.
 *
 * Um objeto de uma propriedade, e não um booleano solto, para que a chamada carregue o nome da
 * decisão: `listarConjuntos(tx, janela, { incluirRetirados: true })` diz o que faz, e
 * `listarConjuntos(tx, janela, true)` não diria.
 */
export interface OpcoesDeCirculacao {
  readonly incluirRetirados: boolean;
}

/**
 * O padrão da porta: **só o que circula**.
 *
 * Ele é o valor omitido de {@link listarConjuntos}, e é o que faz o esquecimento produzir a listagem
 * correta em vez do defeito silencioso da ADR-0014. Congelado porque é constante compartilhada entre
 * todas as chamadas que não declaram nada.
 */
const SO_EM_CIRCULACAO: OpcoesDeCirculacao = Object.freeze({ incluirRetirados: false });

/** Os campos que o cliente informa de um conjunto — os mesmos na criação e na alteração (§4.1.1). */
export interface DadosDoConjunto {
  readonly nome: string;
}

/** Uma linha de `negocio.conjunto`, na projeção que o contrato publica. */
export interface ConjuntoPersistido {
  readonly id: string;
  readonly nome: string;
  /** A marca da exclusão lógica (ADR-0014): nula enquanto circula, o instante da retirada depois. */
  readonly retiradoEm: Date | null;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeConjuntosPersistidos {
  readonly conjuntos: readonly ConjuntoPersistido[];
  readonly total: number;
}

/** Um conjunto com os imóveis dele — o item da carteira expandida. */
export interface ConjuntoComImoveisPersistido extends ConjuntoPersistido {
  readonly imoveis: readonly ImovelPersistido[];
}

/** A página da carteira, com o total do conjunto inteiro — todos da MESMA transação. */
export interface PaginaDaCarteiraPersistida {
  readonly conjuntos: readonly ConjuntoComImoveisPersistido[];
  readonly total: number;
}

/** Os imóveis de um conjunto que não tem nenhum. Congelado — é compartilhado por toda leitura. */
const SEM_IMOVEIS: readonly ImovelPersistido[] = Object.freeze([]);

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas cinco funções.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo, sem interpolação
 * alguma. Mesmo padrão, e mesma justificativa, de `colunasDaEmpresa` em {@link ./empresa.ts}.
 *
 * O apelido `"retiradoEm"` existe porque a coluna é `retirado_em` e o contrato fala camelCase
 * (ADR-0017): traduzir aqui, num ponto só, é o que impede cinco traduções livres para divergir.
 */
function colunasDoConjunto(tx: TransactionSql): Fragment {
  return tx`id, nome, retirado_em AS "retiradoEm"`;
}

/**
 * O predicado de circulação — **o ponto único** onde "retirado some da lista" vira instrução.
 *
 * Um fragmento, e não uma comparação com parâmetro (`${incluir} OR retirado_em IS NULL`), por duas
 * razões: o índice `conjunto_empresa_retirado_idx` cobre o par `(empresa_id, retirado_em)` que a
 * forma abaixo consulta, e a disjunção com parâmetro esconderia do planejador o que a consulta de
 * fato pede. E ele é **um só** para a página e para o total: duas escritas do mesmo recorte fariam a
 * contagem descrever um conjunto do qual a página já não faz parte.
 */
function predicadoDeCirculacao(tx: TransactionSql, opcoes: OpcoesDeCirculacao): Fragment {
  return opcoes.incluirRetirados ? tx`TRUE` : tx`retirado_em IS NULL`;
}

/**
 * Grava um conjunto e devolve a linha como ela ficou.
 *
 * O conjunto nasce **em circulação** — `retirado_em` é nulo por ausência de valor, e não por um valor
 * escrito aqui: a coluna é anulável e o estado inicial é o da tabela, não o desta função.
 */
export async function criarConjunto(
  tx: TransactionSql,
  dados: DadosDoConjunto,
): Promise<ConjuntoPersistido> {
  const [conjunto] = await tx<ConjuntoPersistido[]>`
    INSERT INTO negocio.conjunto (empresa_id, nome)
    VALUES (${empresaDoContexto(tx)}, ${dados.nome})
    RETURNING ${colunasDoConjunto(tx)}
  `;

  if (conjunto === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um conjunto.
    throw new Error('o conjunto foi gravado e a linha não voltou do INSERT');
  }

  return conjunto;
}

/**
 * Lê uma página de conjuntos e o total do conjunto inteiro, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos — mesma razão de `listarPessoasDaEmpresa`, em
 * {@link ./pessoa.ts}.
 *
 * A ordem é `nome, id`, e o desempate importa: `nome` sozinho empata entre homônimos, e um empate faz
 * a mesma linha aparecer em duas páginas — ou em nenhuma.
 *
 * **O predicado de circulação é aplicado por padrão**, e o `opcoes` omitido é o caminho correto. Ver
 * o cabeçalho deste arquivo para por que o default é esse, e não o contrário.
 */
export async function listarConjuntos(
  tx: TransactionSql,
  janela: JanelaDeConjuntos,
  opcoes: OpcoesDeCirculacao = SO_EM_CIRCULACAO,
): Promise<PaginaDeConjuntosPersistidos> {
  const conjuntos = await tx<ConjuntoPersistido[]>`
    SELECT ${colunasDoConjunto(tx)}
      FROM negocio.conjunto
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
     ORDER BY nome, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.conjunto
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return { conjuntos, total: Number(contagem?.total ?? 0) };
}

/**
 * Lê a **carteira**: a mesma página de {@link listarConjuntos}, com os imóveis de cada conjunto —
 * cada um já com os cômodos ordenados por posição e a metragem total.
 *
 * ---------------------------------------------------------------------------
 * Ela CHAMA {@link listarConjuntos} em vez de repetir a consulta, e a reutilização é a decisão
 * ---------------------------------------------------------------------------
 *
 * A carteira e a lista simples são **a mesma rota** — `GET /v1/conjuntos`, com e sem
 * `expandir=imoveis` —, e escrever aqui uma segunda consulta de conjuntos deixaria as duas livres
 * para divergir justamente no que mais custa: o predicado de circulação, a ordem com desempate e o
 * fato de o total e a página saírem da MESMA transação. Divergindo, a carteira viraria um segundo
 * caminho de leitura com regras próprias — que é literalmente o que o `CT-329` existe para impedir,
 * comparando a árvore com a composição das leituras individuais por igualdade profunda.
 *
 * ---------------------------------------------------------------------------
 * QUATRO consultas na carteira inteira, e o número não depende de N
 * ---------------------------------------------------------------------------
 *
 * Duas de {@link listarConjuntos} (a página e o total), uma de imóveis e uma de cômodos, as duas
 * últimas dentro de {@link lerImoveisDeConjuntos}. Nenhuma delas corre em laço: montar a árvore com
 * uma consulta por conjunto, ou uma por imóvel, é o padrão N+1 que a §12.2 da tech spec proíbe por
 * escrito. O `CT-329 (d)`, em `packages/db/test/janela.spec.ts`, mede a contagem sobre dois cenários
 * de tamanhos diferentes e afirma que ela é a mesma.
 *
 * ---------------------------------------------------------------------------
 * A circulação é UMA decisão para os dois níveis
 * ---------------------------------------------------------------------------
 *
 * O mesmo `opcoes` recorta o conjunto e o imóvel, e é isso que faz a ADR-0014 valer em **nível
 * algum** da árvore: sem a propagação, um imóvel retirado apareceria dentro de um conjunto ativo, e
 * o `CT-315` — que lista por entidade — passaria ao largo dele. O conjunto que sobra sem imóvel
 * algum devolve `imoveis: []`, que é o resultado verdadeiro da consulta e não um padrão escrito
 * aqui.
 */
export async function lerCarteira(
  tx: TransactionSql,
  janela: JanelaDeConjuntos,
  opcoes: OpcoesDeCirculacao = SO_EM_CIRCULACAO,
): Promise<PaginaDaCarteiraPersistida> {
  const pagina = await listarConjuntos(tx, janela, opcoes);

  const porConjunto = await lerImoveisDeConjuntos(
    tx,
    pagina.conjuntos.map((conjunto) => conjunto.id),
    opcoes,
  );

  return {
    conjuntos: pagina.conjuntos.map((conjunto) => ({
      ...conjunto,
      imoveis: porConjunto.get(conjunto.id) ?? SEM_IMOVEIS,
    })),
    total: pagina.total,
  };
}

/**
 * Localiza o conjunto pelo identificador. `undefined` quando o contexto corrente não o alcança.
 *
 * As duas causas da ausência são deliberadamente **indistinguíveis**: o conjunto não existe, ou
 * existe e é de outra empresa. A borda traduz as duas no mesmo `404 RECURSO_NAO_ENCONTRADO` — a
 * recusa é consequência de não achar, e não de uma comparação de empresa escrita na aplicação
 * (ADR-0008).
 *
 * **Ela alcança o retirado de circulação**, e o cabeçalho deste arquivo registra por quê.
 */
export async function localizarConjunto(
  tx: TransactionSql,
  id: string,
): Promise<ConjuntoPersistido | undefined> {
  const [conjunto] = await tx<ConjuntoPersistido[]>`
    SELECT ${colunasDoConjunto(tx)}
      FROM negocio.conjunto
     WHERE id = ${id}
  `;

  return conjunto;
}

/**
 * Reescreve os campos informados do conjunto e devolve a linha nova. `undefined` quando não alcançado.
 *
 * O corpo é **completo** (§4.1.1): não há atualização parcial nesta superfície, e campo ausente é
 * recusa por campo obrigatório na borda — nunca "preserve o que estava lá".
 *
 * A alteração **não** consulta o predicado de circulação, pela mesma razão de
 * {@link localizarConjunto}: quem tem o identificador em mãos alcança o registro, e a marca viaja no
 * corpo. Ela também **não** toca `retirado_em` — a circulação tem porta própria, e reuni-las faria
 * uma renomeação carregar, por descuido, uma mudança de estado.
 */
export async function alterarConjunto(
  tx: TransactionSql,
  id: string,
  dados: DadosDoConjunto,
): Promise<ConjuntoPersistido | undefined> {
  const [conjunto] = await tx<ConjuntoPersistido[]>`
    UPDATE negocio.conjunto
       SET nome = ${dados.nome}
     WHERE id = ${id}
    RETURNING ${colunasDoConjunto(tx)}
  `;

  return conjunto;
}

/**
 * Retira o conjunto de circulação, ou o devolve a ela, e entrega a linha nova. `undefined` quando não
 * alcançado.
 *
 * ---------------------------------------------------------------------------
 * UMA função para os dois sentidos, e a razão é o ALCANCE
 * ---------------------------------------------------------------------------
 *
 * Retirar e recircular são o mesmo fato com valores opostos na mesma coluna. Duas instruções ficariam
 * livres para divergir justamente no `WHERE` — e é o `WHERE`, sob a política, que carrega a fronteira
 * de tenant. É a mesma decisão, com a mesma justificativa, de `definirAtivoDaPessoa` em
 * {@link ./pessoa.ts}.
 *
 * ---------------------------------------------------------------------------
 * A IDEMPOTÊNCIA É DA INSTRUÇÃO, e não de um `if` antes dela
 * ---------------------------------------------------------------------------
 *
 * `coalesce(retirado_em, now())` **preserva a marca que já existe**: repetir a retirada devolve o
 * mesmo instante, caractere a caractere, e a resposta é a mesma. A alternativa — ler antes, decidir
 * na aplicação e só então escrever — teria duas idas ao banco e uma corrida entre elas, em que duas
 * requisições concorrentes leem "ainda não retirado" e a segunda sobrescreve a marca da primeira.
 *
 * E ela preserva o que distingue "não achou" de "já estava retirado": um `WHERE … AND retirado_em IS
 * NULL` devolveria zero linhas nos **dois** casos, e a borda responderia `404` a uma repetição
 * legítima. Aqui a ausência de linha significa uma coisa só — o contexto não alcança o conjunto.
 *
 * A recirculação **zera** a marca, e é isso que faz a retirada seguinte produzir um instante
 * **novo**: sem essa metade, uma implementação que nunca reescrevesse a marca seria indistinguível
 * desta. É a última asserção do `CT-347`.
 */
export async function definirCirculacaoDoConjunto(
  tx: TransactionSql,
  id: string,
  emCirculacao: boolean,
): Promise<ConjuntoPersistido | undefined> {
  const [conjunto] = await tx<ConjuntoPersistido[]>`
    UPDATE negocio.conjunto
       SET retirado_em = CASE
                           WHEN ${emCirculacao} THEN NULL
                           ELSE coalesce(retirado_em, now())
                         END
     WHERE id = ${id}
    RETURNING ${colunasDoConjunto(tx)}
  `;

  return conjunto;
}
