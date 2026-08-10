/**
 * `@sysloc/contracts` — a **fonte única do contrato** da API (ADR-0016).
 *
 * O mesmo esquema confere a entrada, tipa a resposta e é de onde o documento publicado deriva.
 * Nenhuma descrição de contrato é escrita à mão em paralelo a ele: duas escritas do mesmo fato são
 * livres para divergir sem que nada acuse, e foi essa a divergência que a ADR fechou.
 *
 * ---------------------------------------------------------------------------
 * O pacote é FOLHA, e isso é a propriedade que ele existe para ter
 * ---------------------------------------------------------------------------
 *
 * Ele não depende de `@sysloc/db` nem de `apps/api` — nem sequer de `@sysloc/shared`. É este pacote
 * que o frontend importa no marco de entrega do backend, e qualquer aresta para dentro do servidor
 * arrastaria o servidor junto: o React passaria a resolver `drizzle-orm`, `postgres` e o arcabouço
 * HTTP para conhecer o tipo de um imóvel. O CT-339 afirma a ausência dessas arestas sobre o fonte e
 * sobre o manifesto, e a `tsconfig.json` daqui não declara referência de projeto alguma.
 *
 * A direção é, portanto, sempre para cá: `packages/db` consome os enums declarados aqui, e não o
 * contrário.
 *
 * ---------------------------------------------------------------------------
 * A superfície é declarada símbolo a símbolo, e não por `export *`
 * ---------------------------------------------------------------------------
 *
 * O que sai daqui é contrato com o consumidor — inclusive um consumidor fora deste repositório. Um
 * `export *` publicaria, por descuido, toda composição interna que um arquivo de `src/` exportar
 * para o vizinho (é o caso de `camposDeEndereco`), e retirar depois o que se publicou sem querer é
 * mudança incompatível. Listar é o que mantém a decisão de publicar explícita.
 */

export type {
  Cobranca,
  CobrancaNova,
  CodigoDeCobranca,
  EstadoDaCobranca,
  JanelaDeCobrancas,
  NaturezaDeCobranca,
  PagamentoDeCobranca,
} from './cobranca.js';
export {
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  ESTADOS_DA_COBRANCA,
  ESTADOS_EM_ABERTO,
  esquemaDaCobranca,
  esquemaDaJanelaDeCobrancas,
  esquemaDeCobrancaNova,
  esquemaDoPagamentoDeCobranca,
  formatarCodigoDeCobranca,
  LARGURA_DO_SEQUENCIAL_DE_COBRANCA,
  NATUREZAS_DE_COBRANCA,
  PREFIXO_DO_CODIGO_DE_COBRANCA,
} from './cobranca.js';
export type { Comodo, ComodoNovo } from './comodo.js';
export { esquemaDeComodoNovo, esquemaDoComodo } from './comodo.js';
export type {
  EnvelopeDeLista,
  Identificador,
  Janela,
  JanelaComCirculacao,
} from './comum.js';
export {
  ESCALA_DA_METRAGEM,
  ESQUEMA_DO_IDENTIFICADOR,
  envelopeDeLista,
  esquemaDaJanela,
  esquemaDaJanelaComCirculacao,
  MAIOR_METRAGEM,
  MAIOR_PAGINA,
  PAGINA_PADRAO,
} from './comum.js';
export type { ConfiguracaoDeMora, ConfiguracaoDeMoraNova } from './configuracao-de-mora.js';
export {
  esquemaDaConfiguracaoDeMora,
  esquemaDaConfiguracaoDeMoraNova,
} from './configuracao-de-mora.js';
export type {
  Conjunto,
  ConjuntoComImoveis,
  ConjuntoNovo,
  ExpansaoDaCarteira,
  JanelaDaCarteira,
} from './conjunto.js';
export {
  EXPANSAO_DE_IMOVEIS,
  EXPANSOES_DA_CARTEIRA,
  esquemaDaJanelaDaCarteira,
  esquemaDeConjuntoNovo,
  esquemaDoConjunto,
  esquemaDoConjuntoComImoveis,
} from './conjunto.js';
export type {
  AtivacaoDeContrato,
  CodigoDeContrato,
  Contrato,
  ContratoNovo,
  EstadoDoContrato,
} from './contrato.js';
export {
  ESCALA_MONETARIA,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  ESTADOS_DO_CONTRATO,
  esquemaDaAtivacaoDeContrato,
  esquemaDeContratoNovo,
  esquemaDoContrato,
  formatarCodigoDeContrato,
  LARGURA_DO_SEQUENCIAL_DE_CONTRATO,
  MAIOR_PRAZO_EM_MESES,
  MAIOR_VALOR_MONETARIO,
  PREFIXO_DO_CODIGO_DE_CONTRATO,
} from './contrato.js';
export type {
  ContratoVigenteDoImovel,
  Imovel,
  ImovelAlterado,
  ImovelNovo,
  SituacaoDeLocacao,
  SituacaoDeLocacaoInformada,
  SituacaoInformavel,
  TipoDeImovel,
} from './imovel.js';
export {
  esquemaDaSituacaoDeLocacao,
  esquemaDeImovelAlterado,
  esquemaDeImovelNovo,
  esquemaDoImovel,
  SITUACOES_DE_LOCACAO,
  SITUACOES_INFORMAVEIS,
  TIPOS_DE_IMOVEL,
} from './imovel.js';
export type { Pessoa, PessoaNova, TipoDePessoa } from './pessoa.js';
export { esquemaDaPessoa, esquemaDePessoaNova, TIPOS_DE_PESSOA } from './pessoa.js';
