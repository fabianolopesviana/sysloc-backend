/**
 * Regras de forma das variáveis de ambiente que **mais de um processo** exige.
 *
 * ---------------------------------------------------------------------------
 * Por que a regra mora aqui, e não em cada composição raiz
 * ---------------------------------------------------------------------------
 *
 * O serviço de aplicação e o processador de trabalho sobem do **mesmo `EnvironmentFile`** e
 * exigem conjuntos de variáveis diferentes — cinco contra duas. O que eles não podem ter é
 * *definições diferentes da mesma variável*: com a regra escrita duas vezes, acrescentar um
 * esquema novo (`rediss://`, para conexão cifrada) em um dos lados faz um processo subir e o
 * outro recusar o mesmo arquivo, e a divergência aparece **no boot** — o momento mais caro para
 * descobri-la.
 *
 * Por isso o que se compartilha é a **regra**, não o esquema inteiro: cada aplicação segue dona
 * da sua lista de variáveis exigidas, e nenhuma herda exigência que não lhe diz respeito.
 *
 * A outra regra compartilhada — a lista de severidades aceitas em `LOG_LEVEL` — vive em
 * `log.ts`, junto do tipo que ela define: é o registrador que declara as severidades que
 * reconhece, e as duas composições raiz as consomem de lá.
 */

/** Esquema exigido na cadeia de conexão do servidor de fila. */
const ESQUEMA_DA_FILA = 'redis://';

/**
 * Exigência da cadeia de conexão da fila, no texto que as duas composições raiz emitem.
 *
 * O literal é compartilhado junto com o predicado de propósito: mensagem que diverge da regra
 * manda o operador procurar o problema errado, e é o tipo de divergência que nenhuma ferramenta
 * apanha.
 */
export const EXIGENCIA_DA_CADEIA_DE_FILA = `deve ser uma cadeia interpretável começando com ${ESQUEMA_DA_FILA}`;

/**
 * A cadeia tem a forma que o cliente da fila exige?
 *
 * São dois requisitos, e os dois importam: o **esquema** (um endereço de banco de dados aceito
 * aqui por engano conectaria o processo ao servidor errado) e a **interpretabilidade** (uma
 * cadeia truncada só falharia na primeira conexão, com o processo já reportado como no ar).
 */
export function ehCadeiaDeFilaValida(valor: string): boolean {
  return valor.startsWith(ESQUEMA_DA_FILA) && URL.canParse(valor);
}
