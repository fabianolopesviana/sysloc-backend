/**
 * `@sysloc/documentos` — o **domínio** do documento do contrato e da mensagem de confirmação.
 *
 * ---------------------------------------------------------------------------
 * O que este pacote é, e o que ele deliberadamente não conhece
 * ---------------------------------------------------------------------------
 *
 * Ele decide **o que o documento diz**, e para nisso. Não abre transação, não escreve SQL, não fala
 * com SMTP e não sabe HTTP. De PDF ele conhece exatamente **um ponto**: declara a porta de
 * renderização e hospeda o único arquivo que fala com o motor (`renderizador-pdf.ts`, T6) — a
 * composição continua recebendo a porta **por parâmetro** (ADR-0025), e o instante chega já
 * resolvido, do banco (ADR-0026). É o que a torna exercitável sem o motor de pé: quatro das cinco
 * suítes deste pacote não atravessam fronteira real alguma, e só `test/renderizador-pdf.spec.ts`
 * atravessa `filesystem`, porque a prova exige o PDF de fato.
 *
 * A única dependência de **workspace** é `@sysloc/contracts`, o pacote folha; `@react-pdf/renderer`
 * e `react` entraram com o adaptador, e a razão de eles não violarem a Fronteira do projeto está
 * escrita no manifesto. A ausência de `@sysloc/db` é a decisão, não uma omissão: é a camada de dados
 * que traduz linha de banco no agregado que este pacote declara. A aresta de volta fecha um ciclo e
 * o Turborepo aborta antes de compilar qualquer coisa. Ver o cabeçalho de `../tsconfig.json`.
 *
 * ---------------------------------------------------------------------------
 * A superfície é declarada símbolo a símbolo, e não por `export *`
 * ---------------------------------------------------------------------------
 *
 * Mesma decisão, e mesma razão, de `@sysloc/contracts` e `@sysloc/regua`: um `export *` publicaria
 * por descuido toda composição interna que um arquivo de `src/` exporte para o vizinho, e retirar
 * depois o que se publicou sem querer é mudança incompatível. Listar é o que mantém a decisão de
 * publicar explícita.
 *
 * É convenção dos pacotes de domínio, e **não** uma regra universal desta base nem decisão de ADR
 * alguma: `packages/db/src/index.ts` publica três namespaces por `export * as`, de propósito e com
 * a razão registrada no docblock dele.
 *
 * O que **fica de fora** também é decisão, e ela é conservadora: o molde dos parágrafos, a
 * interpolação nomeada, a montagem do endereço e a aritmética monetária em centavos são composição
 * interna de `contrato/` e **não têm consumidor** fora deste pacote — publicá-los agora seria
 * capacidade para um futuro hipotético, e retirar depois o que se publicou sem querer é mudança
 * incompatível. Já `CABECALHOS_DAS_CLAUSULAS` sai porque tem consumidor concreto: o CT-708 percorre
 * os 21 sobre o PDF renderizado, em `test/renderizador-pdf.spec.ts` (T6).
 *
 * `comporMensagemDeConfirmacao` e `MensagemDeEmail` saem pela mesma régua, e o consumidor dos dois é
 * o **processador de trabalho** (T10), que compõe a mensagem antes de entregá-la pela porta que
 * `@sysloc/regua` declara. `DadosDaConfirmacao` — o tipo do **parâmetro** — fica de fora de
 * propósito: quem chama monta um objeto literal, e o compilador confere a forma pela assinatura da
 * função. Publicá-lo seria alargar a superfície sem consumidor, e retirar depois o que se publicou
 * sem querer é mudança incompatível.
 *
 * `criarRenderizadorPdf` sai pela mesma régua, e o consumidor dele é a **borda** (T7): quem monta o
 * processo é quem escolhe o adaptador, e a composição continua recebendo a porta por parâmetro
 * (ADR-0025). O que **não** sai é qualquer peça interna da renderização — folha de estilo, tamanho de
 * página, árvore de componentes: publicá-las convidaria um segundo lugar a decidir a forma do
 * documento, e o ponto único que conhece PDF deixaria de ser único.
 */

export { CABECALHOS_DAS_CLAUSULAS } from './contrato/clausulas.js';
export {
  comporDocumentoDoContrato,
  ErroDeDataDeEmissaoInvalida,
  MARCA_DE_CANCELAMENTO,
} from './contrato/composicao.js';
export type {
  DadosDoContratoParaDocumento,
  ImovelDoContrato,
  OpcoesDoDocumentoDoContrato,
  ParteDoContrato,
  TermosDoContrato,
} from './contrato/dados.js';
export { ErroDeValorForaDeAlcance, valorPorExtenso } from './contrato/extenso.js';
export { ErroDeTipoDePessoaDesconhecido, qualificarParte } from './contrato/qualificacao.js';
export type { MensagemDeEmail } from './mensagem-de-confirmacao.js';
export { comporMensagemDeConfirmacao } from './mensagem-de-confirmacao.js';
export { normalizarParaComparacao } from './normalizacao.js';
export type {
  BlocoDoDocumento,
  PortaDeRenderizacao,
  RepresentacaoTextual,
} from './porta-de-renderizacao.js';
export { criarRenderizadorPdf } from './renderizador-pdf.js';
