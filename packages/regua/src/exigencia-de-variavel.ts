/**
 * A **última barreira** contra transporte não declarado — a guarda que recusa a construção do
 * adaptador quando a variável que a alimenta chegou vazia.
 *
 * ===========================================================================
 * Por que ela mora AQUI, e não dentro de `./adaptador-smtp.ts`
 * ===========================================================================
 *
 * Ela nasceu lá, e o Gate 1 da T6 a anotou como **inalcançável por teste** (`AP-28`,
 * `untestable_fail_fast`): alcançá-la exigia que algum arquivo de teste nomeasse `criarAdaptadorSmtp`
 * ou o caminho daquele módulo, e é exatamente isso que a barreira da CA-17 proíbe **por igualdade**
 * sobre os quatro diretórios de teste (`packages/db/test/barreira-de-envio.spec.ts`, `CT-626`). Não
 * havia posição legítima de onde chamá-la, e ela atravessou duas tasks como afirmação de docblock —
 * o débito **D34 (F3/T8)**, com dono declarado na T10.
 *
 * O fecho é este arquivo, e ele é exatamente o que o marcador prescrevia: o módulo **não se chama**
 * `adaptador-smtp` e o símbolo **não é** `criarAdaptadorSmtp`, de modo que um arquivo de teste pode
 * importá-lo sem tropeçar em nenhum dos dois fatos que o detector da CA-17 persegue. A guarda
 * continua sendo chamada de lá, no mesmo ponto e com os mesmos dois argumentos — o que mudou foi o
 * endereço dela, e com ele a possibilidade de haver prova.
 *
 * ⚠️ **Ela não é a primeira barreira, e a distinção importa.** O degrau que a antecede é a validação
 * de partida de cada processo (`lerAmbiente` no processador, `carregarAmbiente` no serviço de
 * aplicação), que recusa a subida nomeando a variável — `CT-625` e `CT-639`. Esta guarda é o que
 * **sobra** se um dos dois divergir: for menos exigente, aceitar cadeia de espaços, ou um terceiro
 * processo montar o adaptador sem passar por validação nenhuma. Aqui o modo perigoso é o inverso do
 * habitual: *"construir mesmo assim"* produz um transporte apontado para o `localhost` que a
 * biblioteca assume por omissão, e mensagem entregue não volta.
 */

/**
 * O que a recusa de construção diz, com o nome da variável ausente acrescentado ao fim.
 *
 * O motivo é **genérico de propósito**: {@link exigirDeclarada} guarda as duas variáveis do
 * transporte, e um motivo que nomeasse o servidor descreveria o eixo errado quando quem falta é o
 * remetente. Quem discrimina é o nome da variável acrescentado ao fim — e é ele, **nunca o valor**, o
 * que a recusa publica: a `SMTP_URL` carrega credencial, e esta mensagem alcança o journal.
 */
export const MOTIVO_DE_VARIAVEL_NAO_DECLARADA =
  'o adaptador de e-mail não é construído sem esta variável declarada';

/**
 * Recusa a construção quando a variável não foi declarada — a barreira que **falha fechado**.
 *
 * A cadeia vazia e a cadeia de espaços são recusadas junto com a ausência: um `EnvironmentFile` com
 * `SMTP_URL=` produz a cadeia vazia, e um transporte construído a partir dela apontaria para o
 * `localhost` que o `nodemailer` assume por omissão — o modo de falha exato que ela existe para não
 * ter. O `trim()` é o mecanismo, e não zelo: `'   '` é o que um arquivo de ambiente preenchido à mão
 * entrega, e uma comparação com a cadeia vazia o deixaria passar.
 *
 * ⚠️ **Ela fecha a AUSÊNCIA, e só ela.** A cadeia não-vazia que não serve como endereço —
 * `localhost:2525` sem esquema, um valor com as aspas retidas pelo `EnvironmentFile` — atravessa
 * aqui, porque o parse do `nodemailer` é tolerante e não levanta; quem fecha essa outra metade é
 * `coordenadasDoTransporte`, que recusa **por forma**. As duas convivem: esta vem primeiro e nomeia a
 * variável **não declarada**, que é um diagnóstico diferente.
 *
 * @param valor    O valor lido do ambiente, como a composição do processo o entregou.
 * @param variavel O **nome** da variável de ambiente — é ele que a recusa publica.
 * @throws {Error} Quando o valor é vazio, ausente ou só espaços, nomeando a variável.
 */
export function exigirDeclarada(valor: string, variavel: string): void {
  if (valor.trim() === '') {
    throw new Error(`${MOTIVO_DE_VARIAVEL_NAO_DECLARADA}: ${variavel}`);
  }
}
