/**
 * O **agregado do documento do contrato** — a porta única que lê contrato, locador, locatário,
 * imóvel e fiadores numa consulta só, sob RLS, e o entrega já traduzido no tipo que o domínio
 * declara.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE, EM VEZ DE `localizarContrato` MAIS QUATRO LEITURAS
 * ---------------------------------------------------------------------------
 *
 * O documento imprime **cinco** entidades, e a forma idiomática — ler o contrato pela porta que já
 * existe e depois cada parte pela porta dela — custaria de quatro a `N + 3` idas ao banco por
 * documento, com o número escolhido por quantos fiadores o contrato tem. É o padrão N+1 que a §12.2
 * da tech spec nomeia com todas as letras, e é o mesmo defeito que `lerFiadoresDeContratos` e
 * `lerContratosVigentesDeImoveis` já fecharam em {@link ./contrato.ts} e {@link ./imovel.ts}.
 *
 * Aqui ele é **uma** consulta, sempre: as três partes e o imóvel entram por junção, e a coleção de
 * fiadores por junção lateral agregada. O custo de um contrato com dez fiadores é o mesmo de um sem
 * nenhum, e é isso que o caso de apoio de `test/documento-de-contrato.spec.ts` mede — comparando a
 * contagem de invocações do executor entre dois cenários de tamanhos diferentes.
 *
 * ---------------------------------------------------------------------------
 * A TRADUÇÃO ACONTECE AQUI — e o domínio nunca recebe linha de banco
 * ---------------------------------------------------------------------------
 *
 * `DadosDoContratoParaDocumento` é declarado por `@sysloc/documentos`, e não aqui: quem **exige** o
 * dado declara a forma dele (ADR-0025), e esta camada importa daquele pacote para dizer que a
 * satisfaz. A aresta é `@sysloc/db → @sysloc/documentos`, e ela **não** fecha ciclo — aquele pacote
 * referencia só `@sysloc/contracts`, e o cabeçalho do `tsconfig.json` dele registra que a aresta de
 * volta abortaria o build inteiro do Turborepo.
 *
 * O tipo é importado **como tipo**: nada de `@sysloc/documentos` é executado por este módulo.
 *
 * ---------------------------------------------------------------------------
 * O VALOR TOTAL SAI DO `COALESCE`, EM `numeric` — e nunca é recomposto em TypeScript
 * ---------------------------------------------------------------------------
 *
 * `valor_total_contrato` é **anulável**, e nasce nulo em `RASCUNHO` (RD-10): quem o deriva é a
 * ativação. O documento, porém, compõe também o rascunho, e `TermosDoContrato.valorTotalContrato`
 * é `NonNullable<>` — de modo que o campo faltando **não compila**.
 *
 * A derivação do que falta vive **no banco**, por
 * `COALESCE(valor_total_contrato, valor_mensal * prazo_meses)`, avaliado em `numeric`. É a
 * **ADR-0023** aplicada à letra (*"a derivação de um valor não persistido vive no banco … quando
 * compõe aritmética monetária"*), e a alternativa — multiplicar em TypeScript depois de ler as duas
 * colunas — é textualmente o defeito que o `Context` daquela ADR nomeia como origem dela: o mesmo
 * contrato publicaria `valorTotalContrato: null` no JSON da rota e `R$ 30.000,00` no documento.
 *
 * ⚠️ **`derivarValorTotal` de {@link ./derivacao-de-contrato.ts} NÃO é reusada aqui**, e a ausência
 * é a decisão. Ela é a função pura que a **ativação** consome para **gravar** o valor, e chamá-la
 * nesta leitura poria a multiplicação de volta na aplicação — exatamente o que o parágrafo acima
 * proíbe —, com a agravante de parecer conformidade por reusar o ponto único da RD-10. O ponto
 * único da RD-10 é sobre **o que se grava**; este `COALESCE` é sobre **o que se lê quando nada foi
 * gravado**, e os dois são fatos diferentes.
 *
 * A rede desta decisão tem **duas** metades, e nenhuma sozinha basta. A comportamental é o
 * `CT-736 (c)`, que mede *onde* a conta correu — `500.03 × 13` vale `6500.39` em `numeric` e
 * `6500.389999999999` em ponto flutuante binário. A estática é o `CT-736 (d)`, que varre este fonte e
 * acusa qualquer aritmética de dinheiro escrita em TypeScript, inclusive a forma arredondada que
 * **acerta** o valor e atravessaria a primeira — o mesmo desenho, e a mesma razão, do `CT-413 (c)`
 * sobre `apps/api/src/contratos/contrato.service.ts`.
 *
 * ---------------------------------------------------------------------------
 * O INSTANTE VEM DO BANCO (ADR-0026), e o fuso é o da operação
 * ---------------------------------------------------------------------------
 *
 * `dataDeEmissao` sai de `negocio.data_corrente_da_operacao()` — a mesma função `STABLE` que a visão
 * `negocio.cobranca_derivada` consulta para classificar a linha, com o fuso do **objeto**
 * (`America/Sao_Paulo`, fixado no corpo dela pela migração `0010`). Um `new Date()` na composição
 * leria o relógio do processo e o fuso do host, e faria o documento deixar de ser função pura da
 * entrada — que é a propriedade que a T5 existe para instalar.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Não há `empresaId` por parâmetro e não há comparação de empresa escrita aqui.** As seis relações
 * que a consulta toca — `contrato`, `locador`, `locatario`, `imovel`, `contrato_fiador` e `fiador` —
 * nascem com RLS **forçada**, e é a política que decide o que cada junção enxerga. Contrato de outra
 * empresa **não retorna linha**, e a ausência vira `404` num ponto único da borda; um `WHERE
 * empresa_id = …` acrescentado aqui seria a defesa em profundidade que a `Decision` da ADR-0008
 * rejeita por escrito.
 *
 * ---------------------------------------------------------------------------
 * ELA RECEBE O EXECUTOR, e não abre nada
 * ---------------------------------------------------------------------------
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** A função recebe o `tx` de quem já abriu a unidade na borda, não abre
 * conexão, reserva ou transação, e não devolve executor.
 */

import type { EstadoDoContrato } from '@sysloc/contracts';
import type {
  DadosDoContratoParaDocumento,
  ImovelDoContrato,
  ParteDoContrato,
} from '@sysloc/documentos';
import type { Fragment, TransactionSql } from 'postgres';
// O formato das duas colunas `date` da projeção do contrato tem **lar único** em `./contrato.ts`, e
// é ele que atravessa daqui. Uma segunda grafia da mesma cadeia ficaria livre para divergir, e a
// divergência apareceria como uma data deslocada dentro do documento — que é o campo mais difícil de
// conferir por leitura.
import { FORMATO_ISO_DA_DATA } from './contrato.js';

/**
 * O agregado do documento **mais o estado**, que a composição deliberadamente não conhece.
 *
 * São dois campos, e a separação é conteúdo. `DadosDoContratoParaDocumento` **não carrega `status`**
 * de propósito (ver o docblock dele em `@sysloc/documentos`): a marca de cancelamento é **parâmetro**
 * da composição, e a ignorância é o que impede a marca de virar consequência de outra coisa — de um
 * `retiradoEm`, de uma data de fim, de um valor zerado (RN-02).
 *
 * Quem deriva `{ cancelado: status === 'CANCELADO' }` é a **borda**, e é por isso que o estado viaja
 * ao lado do agregado em vez de dentro dele: fundir os dois num objeto só devolveria à composição
 * exatamente o campo que ela não pode ter.
 */
export interface AgregadoDoDocumentoDoContrato {
  /** O agregado já resolvido, na forma que `@sysloc/documentos` declara. */
  readonly dados: DadosDoContratoParaDocumento;
  /** O estado corrente do contrato — a origem única da marca de cancelamento (RN-02). */
  readonly status: EstadoDoContrato;
}

/**
 * O que a consulta de fato lê.
 *
 * As duas grandezas monetárias voltam do driver **em texto**, porque `numeric` não cabe em ponto
 * flutuante sem perda — mesma razão, e mesmo tratamento, de `LinhaDoContrato` em {@link ./contrato.ts}.
 * As partes, o imóvel e a coleção de fiadores voltam como `json` já composto pelo servidor, e o
 * driver os entrega desserializados.
 */
interface LinhaDoAgregado {
  readonly status: EstadoDoContrato;
  readonly prazoMeses: number;
  readonly valorMensal: string;
  readonly diaVencimento: number;
  readonly valorTotalContrato: string;
  readonly dataDeEmissao: string;
  readonly locador: ParteDoContrato;
  readonly locatario: ParteDoContrato;
  readonly imovel: ImovelDoContrato;
  readonly fiadores: readonly ParteDoContrato[];
}

/**
 * Os apelidos das relações dentro da consulta, nomeados uma vez cada.
 *
 * Eles chegam ao SQL pelo construtor de **identificador** do driver (`tx(nome)`), que os escapa —
 * nunca por interpolação de cadeia. Nada aqui vem de fora: são constantes deste módulo.
 */
const APELIDO_DO_LOCADOR = 'locador';
const APELIDO_DO_LOCATARIO = 'locatario';
const APELIDO_DO_FIADOR = 'fiador';
const APELIDO_DO_IMOVEL = 'imovel';

/**
 * A projeção de uma **parte** do contrato como objeto JSON, escrita **uma vez** para os três papéis.
 *
 * Locador, locatário e fiador compartilham a forma — é a mesma razão registrada em
 * `packages/contracts/src/pessoa.ts` para haver um `esquemaDaPessoa` único, e em
 * `@sysloc/documentos` para haver um `ParteDoContrato` único. Três cópias de uma lista de onze
 * campos ficariam livres para divergir, e a divergência sairia como um campo faltando **em um dos
 * papéis** dentro do documento.
 *
 * As chaves são as de `ParteDoContrato`, em camelCase (ADR-0017): a tradução `snake_case →
 * camelCase` mora aqui, e em lugar nenhum mais. `email` e `telefone` **não entram**, e a ausência é
 * conteúdo — o documento não os imprime, e o tipo do domínio não os declara.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda. Mesmo padrão, e mesma justificativa, de `colunasDoContrato` em
 * {@link ./contrato.ts}.
 */
function parteEmJson(tx: TransactionSql, apelido: string): Fragment {
  const parte = tx(apelido);

  return tx`json_build_object(
    'nome', ${parte}.nome,
    'tipoPessoa', ${parte}.tipo_pessoa,
    'documentoPrincipal', ${parte}.documento_principal,
    'rg', ${parte}.rg,
    'logradouro', ${parte}.logradouro,
    'numero', ${parte}.numero,
    'complemento', ${parte}.complemento,
    'bairro', ${parte}.bairro,
    'cidade', ${parte}.cidade,
    'estado', ${parte}.estado,
    'cep', ${parte}.cep
  )`;
}

/**
 * A projeção do **imóvel** como objeto JSON — o nome e o endereço, e nada além.
 *
 * As chaves são as de `ImovelDoContrato`. `identificadorMunicipal`, `tipoImovel`, `statusLocacao` e
 * `observacoes` **não entram**: o documento não os imprime, e publicar coluna que ninguém lê seria
 * dar ao agregado uma superfície que o tipo do domínio não declara.
 */
function imovelEmJson(tx: TransactionSql): Fragment {
  const imovel = tx(APELIDO_DO_IMOVEL);

  return tx`json_build_object(
    'nomeImovel', ${imovel}.nome_imovel,
    'logradouro', ${imovel}.logradouro,
    'numero', ${imovel}.numero,
    'complemento', ${imovel}.complemento,
    'bairro', ${imovel}.bairro,
    'cidade', ${imovel}.cidade,
    'estado', ${imovel}.estado,
    'cep', ${imovel}.cep
  )`;
}

/**
 * Lê o agregado do documento pelo **código** do contrato. `undefined` quando o contexto corrente não
 * o alcança.
 *
 * As duas causas da ausência são deliberadamente **indistinguíveis**: o contrato não existe, ou
 * existe e é de outra empresa e a política o esconde. A borda traduz as duas no mesmo
 * `404 RECURSO_NAO_ENCONTRADO` — a recusa é consequência de não achar, e não de uma comparação de
 * empresa escrita na aplicação (ADR-0008).
 *
 * **Ela alcança o contrato retirado de circulação**, pela mesma razão de `localizarContrato`: a
 * retirada é de visibilidade em listagem, e um documento inalcançável para o contrato retirado faria
 * a marca de circulação apagar o histórico que a ADR-0014 existe para preservar.
 *
 * A coleção de fiadores é ordenada por `nome, id`, e o desempate importa: dois fiadores homônimos
 * são possíveis — a unicidade do cadastro é por documento —, e um empate faria a ordem dentro do
 * documento ficar indefinida entre leituras do **mesmo** contrato. É a mesma ordem, e a mesma razão,
 * de `lerFiadoresDeContratos`.
 *
 * O contrato sem fiador algum devolve a lista **vazia**, e não nulo: `json_agg` sobre conjunto vazio
 * devolve `NULL`, e o `COALESCE` para `'[]'` é o que faz a ausência ser representada como ausência —
 * a composição distingue os dois casos, e o bloco de fiadores simplesmente não existe no documento.
 */
export async function lerAgregadoDoContrato(
  tx: TransactionSql,
  codigo: string,
): Promise<AgregadoDoDocumentoDoContrato | undefined> {
  const [linha] = await tx<LinhaDoAgregado[]>`
    SELECT
      contrato.status,
      contrato.prazo_meses AS "prazoMeses",
      contrato.valor_mensal AS "valorMensal",
      contrato.dia_vencimento AS "diaVencimento",
      COALESCE(
        contrato.valor_total_contrato,
        contrato.valor_mensal * contrato.prazo_meses
      ) AS "valorTotalContrato",
      to_char(negocio.data_corrente_da_operacao(), ${FORMATO_ISO_DA_DATA}) AS "dataDeEmissao",
      ${parteEmJson(tx, APELIDO_DO_LOCADOR)} AS "locador",
      ${parteEmJson(tx, APELIDO_DO_LOCATARIO)} AS "locatario",
      ${imovelEmJson(tx)} AS "imovel",
      fiadores.lista AS "fiadores"
      FROM negocio.contrato AS contrato
      JOIN negocio.locador AS locador ON locador.id = contrato.locador_id
      JOIN negocio.locatario AS locatario ON locatario.id = contrato.locatario_id
      JOIN negocio.imovel AS imovel ON imovel.id = contrato.imovel_id
      CROSS JOIN LATERAL (
        SELECT COALESCE(
                 json_agg(
                   ${parteEmJson(tx, APELIDO_DO_FIADOR)}
                   ORDER BY fiador.nome, fiador.id
                 ),
                 '[]'::json
               ) AS lista
          FROM negocio.contrato_fiador AS vinculo
          JOIN negocio.fiador AS fiador ON fiador.id = vinculo.fiador_id
         WHERE vinculo.contrato_id = contrato.id
      ) AS fiadores
     WHERE contrato.codigo = ${codigo}
  `;

  if (linha === undefined) {
    return undefined;
  }

  return {
    status: linha.status,
    dados: {
      contrato: {
        prazoMeses: linha.prazoMeses,
        // `Number(…)` sobre o texto do driver é o **ponto único** da conversão de `numeric` deste
        // módulo — mesma decisão, e mesma razão medida, de `contratoPublicado` em `./contrato.ts`.
        // Nenhuma das duas linhas abaixo é uma conta: a única aritmética monetária do caminho corre
        // dentro da consulta, em `numeric`.
        valorMensal: Number(linha.valorMensal),
        diaVencimento: linha.diaVencimento,
        valorTotalContrato: Number(linha.valorTotalContrato),
      },
      locador: linha.locador,
      locatario: linha.locatario,
      imovel: linha.imovel,
      fiadores: linha.fiadores,
      dataDeEmissao: linha.dataDeEmissao,
    },
  };
}
