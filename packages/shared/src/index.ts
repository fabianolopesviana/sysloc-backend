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
export {
  type CargaDaRegua,
  type CargaDoEco,
  ESPERA_ENTRE_TENTATIVAS_MS,
  FILA_DA_REGUA,
  FILA_DO_ECO,
  OPCOES_PADRAO_DA_TAREFA,
  TAREFAS_CONCLUIDAS_RETIDAS,
  TAREFAS_FALHAS_RETIDAS,
  TENTATIVAS_POR_TAREFA,
} from './fila.js';
export {
  criarLogger,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
  type OpcoesDeLogger,
} from './log.js';
