/**
 * Superfície pública do pacote compartilhado.
 *
 * Só entra aqui o que outro pacote do workspace consome. O que é detalhe de construção —
 * a tabela de status por código, a lista de campos sensíveis do registro — fica fora de
 * propósito: exportá-lo convidaria a duplicar a decisão em vez de usá-la.
 */

export { EXIGENCIA_DA_CADEIA_DE_FILA, ehCadeiaDeFilaValida } from './ambiente.js';
export { conferirDocumento, somenteDigitos } from './documento.js';
export { CodigoErro, type CorpoErro, ErroDeAplicacao, type OpcoesDeErro } from './erros.js';
// As quatro peças da política de repetição (tentativas, espera, retenções) NÃO são publicadas, e a
// ausência é a decisão — ver o docblock delas em `fila.ts`. `OPCOES_PADRAO_DA_TAREFA` é o único
// caminho publicado.
export {
  type CargaDaConferenciaBancaria,
  type CargaDaConfirmacao,
  type CargaDaEmissaoEmLote,
  type CargaDaRegua,
  type CargaDoEco,
  FILA_DA_CONFERENCIA_BANCARIA,
  FILA_DA_CONFIRMACAO,
  FILA_DA_EMISSAO_EM_LOTE,
  FILA_DA_REGUA,
  FILA_DO_ECO,
  OPCOES_PADRAO_DA_TAREFA,
} from './fila.js';
export {
  criarLogger,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
  type OpcoesDeLogger,
} from './log.js';
// `SENTINELA_REDIGIDO` fica de fora por ser detalhe de construção da redação — quem precisa dela é
// código deste pacote, e publicá-la convidaria a duplicar a decisão em vez de usá-la. Pela mesma
// razão, `SegredoOperavel` sai como **tipo**: construir o invólucro é ato de `criarSegredoOperavel`
// e de `decifrarSegredo`, e publicar o construtor abriria uma segunda entrada para o claro.
export {
  cifrarSegredo,
  criarSegredoOperavel,
  decifrarSegredo,
  ErroDeChaveDeCifraInvalida,
  ErroDeSegredoAdulterado,
  ErroDeVersaoDeEnvelopeDesconhecida,
  type SegredoEmClaro,
  type SegredoOperavel,
} from './segredo-operavel.js';
