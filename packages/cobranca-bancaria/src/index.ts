/**
 * `@sysloc/cobranca-bancaria` — o **domínio** da cobrança bancária, e o sétimo pacote do monorepo.
 *
 * ---------------------------------------------------------------------------
 * O que este pacote é, e o que ele deliberadamente não conhece
 * ---------------------------------------------------------------------------
 *
 * Ele declara o **vocabulário canônico** da integração e a **porta** que o adaptador do provedor
 * satisfaz, e para nisso. Não abre transação, não escreve SQL, não sabe HTTP e não conhece rota. Do
 * provedor ele conhece exatamente **um ponto** — o adaptador que chega com a T10 e hospeda toda a
 * tradução do dialeto do banco —, e a porta continua chegando a quem a usa **por parâmetro**
 * (ADR-0025).
 *
 * As dependências de workspace são `@sysloc/contracts`, o pacote folha de onde vem a fonte única do
 * vocabulário publicado (ADR-0016), e `@sysloc/shared`, de onde vem o invólucro opaco do segredo
 * (ADR-0032). A ausência de `@sysloc/db` é a decisão, não uma omissão: é a camada de dados que
 * guarda o **envelope cifrado**, sem saber o que há dentro dele. A aresta de volta fecha um ciclo e
 * o Turborepo aborta antes de compilar qualquer coisa. Ver o cabeçalho de `../tsconfig.json`.
 *
 * ---------------------------------------------------------------------------
 * A superfície é declarada símbolo a símbolo, e não por `export *`
 * ---------------------------------------------------------------------------
 *
 * Mesma decisão, e mesma razão, de `@sysloc/contracts`, `@sysloc/regua` e `@sysloc/documentos`: um
 * `export *` publicaria por descuido toda composição interna que um arquivo de `src/` exporte para o
 * vizinho, e retirar depois o que se publicou sem querer é mudança incompatível. Listar é o que
 * mantém a decisão de publicar explícita.
 *
 * É convenção dos pacotes de domínio, e **não** uma regra universal desta base nem decisão de ADR
 * alguma: `packages/db/src/index.ts` publica três namespaces por `export * as`, de propósito e com a
 * razão registrada no docblock dele.
 *
 * ---------------------------------------------------------------------------
 * A superfície é de TIPO e, desde a T9, também de VALOR
 * ---------------------------------------------------------------------------
 *
 * O vocabulário e o contrato de fronteira não existem em execução — interface de TypeScript some na
 * emissão —, e é por isso que o CT-809, o CT-834 e o CT-835 examinam a superfície pelo **texto
 * declarado**, que é o único modo de introspectá-los. A leitura do material (T9) acrescentou os
 * primeiros valores: uma função e duas classes de erro, que a borda do registro consome pela
 * fronteira do pacote. O adaptador (T10) entra nesta lista pela mesma régua — publica-se o que tem
 * consumidor nomeado, e nada além.
 *
 * ---------------------------------------------------------------------------
 * O que o adaptador (T10) publica, e o que ele NÃO publica
 * ---------------------------------------------------------------------------
 *
 * Saem daqui a fábrica, o tipo da configuração que ela recebe, o **teto de tempo** e os **cinco
 * textos de desfecho**. O teto é publicado porque a verificação o importa para medir o efeito dele —
 * limite privado obriga o caso a reescrever o número, e a asserção passa a medir o teste em vez do
 * artefato (o defeito de cinco rodadas de `packages/regua/src/coordenadas-do-transporte.ts`). Os
 * cinco textos, porque é a borda que os repassa ao Admin.
 *
 * ⚠️ **O quinto (`DETALHE_NAO_INICIADO`) entra pela MESMA régua, e não por simetria decorativa**: o
 * consumidor nomeado dos textos de desfecho é um só para todos eles — a borda da T12, que repassa o
 * `detalhe` do resultado. Publicar quatro dos cinco deixaria a superfície com uma assimetria sem
 * critério que a explicasse, e é a assimetria sem critério que faz a fatia seguinte adivinhar.
 *
 * ⚠️ **A verificação NÃO importa os textos daqui**: ela os copia como literais, de propósito.
 * Importá-los faria o caso aprovar qualquer texto, inclusive um que colapsasse dois desfechos num só
 * — é o precedente da `DECISÃO FECHADA` do CT-642. O teto é a exceção declarada, e a razão é a
 * inversa: ali o que se mede é o **efeito** da constante sobre o transporte.
 *
 * O nome da variável de ambiente do endereço **não** sai: ele é o texto da recusa de construção, e
 * publicá-lo convidaria a verificação a compor o esperado a partir do módulo sob prova.
 */

export type { ConfiguracaoDoProvedorBancario } from './adaptador-sicoob.js';
export {
  criarAdaptadorSicoob,
  DETALHE_ACEITE,
  DETALHE_INDISPONIVEL,
  DETALHE_NAO_INICIADO,
  DETALHE_RECUSA_PELO_PAR,
  DETALHE_TEMPO_ESGOTADO,
  TETO_DO_APERTO_DE_MAO_MS,
} from './adaptador-sicoob.js';
export type { MaterialLido } from './leitura-do-material.js';
export {
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
} from './leitura-do-material.js';
export type {
  IdentidadeParaVerificar,
  MeioDeRecebimento,
  ResultadoDaVerificacaoDeIdentidade,
} from './modelo-canonico.js';
export type { PortaDeIdentidadeBancaria } from './porta-de-identidade.js';
