/**
 * Cômodo — detalhe de composição do imóvel, e a **porta única** de leitura e escrita dele.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./imovel.ts}, {@link ./conjunto.ts} e {@link ./pessoa.ts} já registram: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de aplicação com o
 * executor da unidade de trabalho em mãos escreve `negocio.comodo` numa cadeia sem importar nada de
 * proibido, e o alcance às tabelas do domínio deixa de ser enumerável. Toda instrução sobre esta
 * tabela vive aqui — **inclusive a leitura**, que {@link ./imovel.ts} consome para montar o
 * agregado.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As quatro funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * CÔMODO É REMOVIDO DE FATO — a exceção declarada da ADR-0014
 * ---------------------------------------------------------------------------
 *
 * {@link removerComodo} emite `DELETE`, e a linha some. Não é descuido nem inconsistência com a
 * regra de que **cadastro de domínio nunca é apagado**: a ADR-0014 exclui o cômodo *nominalmente* do
 * alcance da exclusão lógica, e o discriminador que ela usa é **ser referenciável**. Nada aponta
 * para cômodo — nem contrato, nem cobrança, nem relatório —, e remover um cômodo é *corrigir a
 * planta*, não retirar um cadastro de circulação.
 *
 * A prova disso não é este comentário: é a **ausência da coluna** `retirado_em` em
 * `negocio.comodo`, declarada em `migracoes/0005_dominio_locacao.sql` e afirmada pelo `CT-317`
 * contra o catálogo do sistema. Acrescentá-la "por simetria" com as demais entidades criaria uma
 * segunda semântica de remoção sem que nada acusasse.
 *
 * ---------------------------------------------------------------------------
 * A POSIÇÃO É DO SERVIDOR, e é atribuída DENTRO da transação
 * ---------------------------------------------------------------------------
 *
 * {@link acrescentarComodo} calcula `max(posicao) + 1` numa **subconsulta correlacionada da própria
 * instrução de gravação** (§6.2). Não há uma leitura anterior cujo resultado a aplicação carregue
 * até o `INSERT`: entre ela e a gravação caberia outra transação, e a janela seria a mesma que o
 * cabeçalho de {@link ./imovel.ts} descreve para a unicidade.
 *
 * Duas consequências **declaradas**, e nenhuma delas é defeito:
 *
 *   * duas inserções concorrentes no mesmo imóvel leem o mesmo máximo e colidem em
 *     `unique(imovel_id, posicao)`; a transação perdedora desfaz, sem perda de dado, num cenário
 *     raro (dois usuários editando a planta do mesmo imóvel ao mesmo tempo). **O desfecho na borda é
 *     `500 ERRO_INTERNO`, e ele também é aceito, não esquecido**: o `23505` do cômodo não tem
 *     tradução nomeada — {@link ./imovel.ts} tem a dele, `ErroDeIdentificadorMunicipalEmUso`, para a
 *     unicidade do identificador municipal, e o cômodo não tem equivalente —, de modo que a violação
 *     cai no terceiro ramo de `traduzir()` em `apps/api/src/comum/filtro-excecao.ts` e sai como
 *     `500`, acompanhada de uma linha `error` que afirma falha do serviço. É o preço de não
 *     introduzir um desfecho de contrato para um caso cuja ação do usuário é *"tente de novo"*; dar
 *     nome a ele é **mudança de contrato**, e cabe à fatia que decidir que a colisão merece uma
 *     resposta própria — não a esta;
 *   * as posições remanescentes **não são reatribuídas** na remoção — remover o cômodo do meio
 *     deixa `1` e `3` —, e remover o **último** libera aquela posição para o próximo. É reuso de
 *     posição, não de identificador, e nada aponta para posição de cômodo. O bloco da ADR-0015 no
 *     cabeçalho de `src/esquema/negocio.ts` registra por que a posição **não** é série no sentido
 *     daquela decisão.
 *
 * ---------------------------------------------------------------------------
 * O IMÓVEL PAI É A GUARDA DE ALCANCE, e ele entra pelo `FROM`
 * ---------------------------------------------------------------------------
 *
 * As três escritas só produzem linha quando o imóvel indicado é alcançável no contexto corrente:
 * a inserção lê `negocio.imovel` no `FROM` (a política recorta, e imóvel alheio devolve zero
 * linhas), e a alteração e a remoção casam `imovel_id` no `WHERE`. Nas três, "não alcançou" e "não
 * existe" produzem o mesmo `undefined`, que a borda traduz num `404` indistinguível — é o que a
 * §6.4 pede do cômodo de imóvel alheio.
 *
 * O `AND imovel_id = …` da alteração e da remoção **não é filtro de tenant**: quem separa empresas é
 * a política, e a chave estrangeira composta `(imovel_id, empresa_id)` torna o vínculo cruzado
 * impossível pelo banco (ADR-0008). Ele é a **contenção do sub-recurso** — o `:comodoId` de
 * `/v1/imoveis/:id/comodos/:comodoId` tem de pertencer àquele `:id`, e sem ele o cômodo de um imóvel
 * seria alterável pela rota de outro imóvel da mesma empresa.
 *
 * **A rede dele são as metades 4 e 5 do `CT-332`**, em `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`
 * — dois imóveis da MESMA empresa, o cômodo de um endereçado pela rota do outro, `404` no `PUT` e no
 * `DELETE`. O caso de cômodo de **outra empresa** que existe ali (metade 3) **não** cobre esta
 * cláusula: lá quem devolve zero linhas é a política, e apagar o `AND imovel_id` das duas instruções
 * deixava aquela metade — e toda a suíte — verde. Isso é medido, e está registrado como MT7-8 no
 * cabeçalho daquela suíte, com as duas instruções mutadas em separado, porque uma metade só deixaria
 * a outra sem rede.
 *
 * ---------------------------------------------------------------------------
 * A METRAGEM É NORMALIZADA NA ESCRITA, e convertida num ponto único na LEITURA
 * ---------------------------------------------------------------------------
 *
 * `metragem` chega aqui como **número**, nunca `undefined`: quem aplica a RN-02 (*metragem ausente
 * vale zero*) é `esquemaDeComodoNovo`, em `@syslocbr/contracts`, e o docblock dele declara a razão —
 * *"um cômodo que chegasse à camada de dados com `undefined` obrigaria aquele ponto a decidir de
 * novo o que fazer com a ausência"*. A coluna é `NOT NULL DEFAULT 0` e tem
 * `check(metragem >= 0)`, de modo que a normalização é **verificável no banco**, e não uma promessa
 * da aplicação: o `CT-306` lê a coluna crua e tenta gravar nulo explicitamente.
 *
 * Na volta, `numeric` chega do driver como **texto**. A conversão para número acontece em
 * {@link comodoPublicado}, e ali só: o contrato declara `metragem: z.number()`, o modo de falha é
 * silencioso (o consumidor recebe `"25.50"` onde espera `25.5`) e o `CT-305` o persegue afirmando
 * `typeof`.
 */

import type { Comodo } from '@syslocbr/contracts';
import type { Fragment, TransactionSql } from 'postgres';
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * Os campos que o cliente informa de um cômodo — os mesmos ao acrescentar e ao alterar (§4.1.1).
 *
 * `posicao` **não** está aqui, e a ausência é a decisão: ela é atribuída pelo servidor. Aceitá-la
 * daria ao cliente o poder de colidir com a `unique(imovel_id, posicao)` de outro cômodo.
 *
 * `metragem` é `number` e não `number | undefined`: a ausência já foi resolvida no contrato de
 * entrada, e admiti-la aqui recriaria o segundo ponto de decisão que a RN-02 fechou.
 */
export interface DadosDoComodo {
  readonly nomeComodo: string;
  readonly metragem: number;
  readonly observacoes: string | null;
}

/**
 * Um cômodo como a camada de dados o entrega — **a mesma forma que o contrato publica**.
 *
 * O apelido existe para que as portas deste pacote falem de `ComodoPersistido` como falam de
 * `ImovelPersistido` e de `ConjuntoPersistido`, sem que exista uma segunda declaração dos cinco
 * campos livre para divergir do `esquemaDoComodo`.
 */
export type ComodoPersistido = Comodo;

/** Uma linha crua de `negocio.comodo` — `metragem` ainda em texto, e o pai junto para o lote. */
interface LinhaDoComodo {
  readonly id: string;
  readonly imovelId: string;
  readonly nomeComodo: string;
  /** `numeric` volta do driver em texto. Ver {@link comodoPublicado}. */
  readonly metragem: string;
  readonly posicao: number;
  readonly observacoes: string | null;
}

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas quatro funções.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo, sem interpolação
 * alguma. Mesmo padrão, e mesma justificativa, de `colunasDoImovel` em {@link ./imovel.ts}.
 *
 * `imovel_id` entra porque {@link lerComodosDeImoveis} agrupa por ele; ele **não** sai no contrato,
 * e é {@link comodoPublicado} que o deixa de fora.
 */
function colunasDoComodo(tx: TransactionSql): Fragment {
  return tx`
    id,
    imovel_id AS "imovelId",
    nome_comodo AS "nomeComodo",
    metragem,
    posicao,
    observacoes
  `;
}

/**
 * A linha crua no cômodo que o contrato publica — **o ponto único** da conversão de `numeric`.
 *
 * `Number(…)` sobre o texto do driver é o que faz `metragem` chegar ao consumidor como número, e o
 * `CT-305` afirma `typeof === 'number'` exatamente porque a ausência desta linha seria **silenciosa**
 * — o JSON sairia com `"25.50"` entre aspas e nada acusaria. Ela é uma só: quatro conversões
 * ficariam livres para divergir, e a soma da metragem passaria a depender de qual porta leu.
 *
 * Os campos são copiados um a um, e não por espalhamento: o espalhamento publicaria `imovelId` — e
 * qualquer coluna que a projeção venha a ganhar — num corpo cujo formato é contrato congelado.
 */
function comodoPublicado(linha: LinhaDoComodo): ComodoPersistido {
  return {
    id: linha.id,
    nomeComodo: linha.nomeComodo,
    metragem: Number(linha.metragem),
    posicao: linha.posicao,
    observacoes: linha.observacoes,
  };
}

/**
 * Lê os cômodos de N imóveis, **ordenados por posição**, agrupados pelo imóvel de cada um.
 *
 * ---------------------------------------------------------------------------
 * O `ORDER BY posicao` é conteúdo, e não estilo
 * ---------------------------------------------------------------------------
 *
 * Sem ele, a ordem seria a do retorno do banco — que **nenhuma cláusula garante** e que, na prática,
 * é a ordem física do heap. Ela coincide com a ordem de inserção numa tabela recém-escrita e deixa
 * de coincidir na primeira alteração, porque o PostgreSQL grava a versão nova da linha no fim. O
 * `CT-309` explora exatamente isso: ele altera o primeiro cômodo e afirma que o vetor devolvido
 * **difere** da ordem física, o que uma consulta sem ordenação não conseguiria produzir.
 *
 * O desempate é o `id`, e ele importa por uma razão estrutural: `unique(imovel_id, posicao)` torna o
 * empate impossível *hoje*, e o desempate é o que impede a ordem de virar indefinida se aquela
 * restrição algum dia mudar de forma. `imovel_id` vem primeiro porque a consulta serve a uma página
 * inteira, e o índice `comodo_empresa_imovel_posicao_idx` cobre o prefixo.
 *
 * ---------------------------------------------------------------------------
 * UMA consulta para a página inteira
 * ---------------------------------------------------------------------------
 *
 * Ela recebe **a lista** de imóveis, e não um imóvel, porque a listagem de imóveis a chama uma vez
 * por página: uma função por imóvel faria a paginação emitir uma consulta por linha. O imóvel sem
 * cômodo algum simplesmente **não aparece** no mapa — é o resultado verdadeiro da consulta, e é
 * {@link ./imovel.ts} que traduz a ausência no agregado vazio.
 *
 * A lista vazia devolve o mapa vazio **sem consultar**: `= ANY('{}')` não casaria linha alguma, e
 * pagar uma ida ao banco para saber isso é custo sem informação.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a política de `negocio.comodo` já recorta a
 * leitura, e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita (§ ADR-0008).
 */
export async function lerComodosDeImoveis(
  tx: TransactionSql,
  imoveisIds: readonly string[],
): Promise<Map<string, readonly ComodoPersistido[]>> {
  const porImovel = new Map<string, ComodoPersistido[]>();

  if (imoveisIds.length === 0) {
    return porImovel;
  }

  const linhas = await tx<LinhaDoComodo[]>`
    SELECT ${colunasDoComodo(tx)}
      FROM negocio.comodo
     WHERE imovel_id = ANY(${[...imoveisIds]}::uuid[])
     ORDER BY imovel_id, posicao, id
  `;

  for (const linha of linhas) {
    const doImovel = porImovel.get(linha.imovelId) ?? [];
    doImovel.push(comodoPublicado(linha));
    porImovel.set(linha.imovelId, doImovel);
  }

  return porImovel;
}

/**
 * Acrescenta um cômodo ao imóvel e devolve a linha como ela ficou. `undefined` quando o contexto
 * corrente não alcança o imóvel.
 *
 * A posição sai da subconsulta correlacionada `max(posicao) + 1` **da própria instrução**, e o
 * imóvel entra pelo `FROM`: as duas decisões estão no cabeçalho deste arquivo, e nenhuma das duas é
 * substituível por uma leitura anterior sem abrir uma janela de corrida.
 *
 * `empresa_id` é proposto por {@link empresaDoContexto} porque a coluna é `NOT NULL` sem padrão —
 * quem aceita ou recusa a linha continua sendo o `WITH CHECK` da política.
 */
export async function acrescentarComodo(
  tx: TransactionSql,
  imovelId: string,
  dados: DadosDoComodo,
): Promise<ComodoPersistido | undefined> {
  const [linha] = await tx<LinhaDoComodo[]>`
    INSERT INTO negocio.comodo (
      empresa_id, imovel_id, nome_comodo, metragem, posicao, observacoes
    )
    SELECT ${empresaDoContexto(tx)},
           imovel.id,
           ${dados.nomeComodo},
           ${dados.metragem},
           (SELECT coalesce(max(existente.posicao), 0) + 1
              FROM negocio.comodo AS existente
             WHERE existente.imovel_id = imovel.id),
           ${dados.observacoes}
      FROM negocio.imovel AS imovel
     WHERE imovel.id = ${imovelId}
    RETURNING ${colunasDoComodo(tx)}
  `;

  return linha === undefined ? undefined : comodoPublicado(linha);
}

/**
 * Reescreve os campos informados do cômodo e devolve a linha nova. `undefined` quando não alcançado.
 *
 * O corpo é **completo** (§4.1.1): não há atualização parcial nesta superfície, e campo ausente é
 * recusa por campo obrigatório na borda — nunca "preserve o que estava lá".
 *
 * Ela **não toca `posicao`**, e a omissão é a decisão: alterar a metragem de um cômodo não pode
 * reordenar a planta, e a ordem é a única coisa que a posição significa. Não existe, nesta fatia,
 * operação de reordenar — quem quiser mudar a ordem remove e acrescenta.
 */
export async function alterarComodo(
  tx: TransactionSql,
  imovelId: string,
  comodoId: string,
  dados: DadosDoComodo,
): Promise<ComodoPersistido | undefined> {
  const [linha] = await tx<LinhaDoComodo[]>`
    UPDATE negocio.comodo
       SET nome_comodo = ${dados.nomeComodo},
           metragem = ${dados.metragem},
           observacoes = ${dados.observacoes}
     WHERE id = ${comodoId}
       AND imovel_id = ${imovelId}
    RETURNING ${colunasDoComodo(tx)}
  `;

  return linha === undefined ? undefined : comodoPublicado(linha);
}

/**
 * Remove o cômodo **de fato** e devolve a linha que deixou de existir. `undefined` quando não
 * alcançado.
 *
 * É `DELETE`, e o cabeçalho deste arquivo registra por que a ADR-0014 não alcança o cômodo. Ela
 * devolve a linha removida em vez de um booleano pela mesma razão que as duas acima devolvem a
 * linha gravada: o chamador precisa distinguir *"removeu"* de *"não alcançou"*, e um booleano diria
 * a mesma coisa com menos informação para o registro de trilha.
 *
 * As posições remanescentes **não** são reescritas — ver o cabeçalho.
 */
export async function removerComodo(
  tx: TransactionSql,
  imovelId: string,
  comodoId: string,
): Promise<ComodoPersistido | undefined> {
  const [linha] = await tx<LinhaDoComodo[]>`
    DELETE FROM negocio.comodo
     WHERE id = ${comodoId}
       AND imovel_id = ${imovelId}
    RETURNING ${colunasDoComodo(tx)}
  `;

  return linha === undefined ? undefined : comodoPublicado(linha);
}
