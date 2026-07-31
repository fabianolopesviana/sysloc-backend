/**
 * Superfície pública do pacote compartilhado.
 *
 * Só entra aqui o que outro pacote do workspace consome. O que é detalhe de construção —
 * a tabela de status por código, a lista de campos sensíveis do registro — fica fora de
 * propósito: exportá-lo convidaria a duplicar a decisão em vez de usá-la.
 */

export { CodigoErro, type CorpoErro, ErroDeAplicacao, type OpcoesDeErro } from './erros.js';
export { criarLogger, type Logger, type NivelDeLog, type OpcoesDeLogger } from './log.js';
