/**
 * Tarefa de ida e volta — recebe um valor e devolve o mesmo valor.
 *
 * ---------------------------------------------------------------------------
 * Para que ela existe
 * ---------------------------------------------------------------------------
 *
 * Ela é a prova de que o caminho **fila → processador** funciona de ponta a ponta: um valor que
 * atravessa serialização, gravação no servidor de fila, leitura e execução, e volta idêntico. Não
 * é código descartável — continua na suíte depois que houver tarefas reais, e não deve ser
 * removida quando a primeira tarefa de negócio nascer (scope §5).
 *
 * ---------------------------------------------------------------------------
 * Por que ela VALIDA a carga útil
 * ---------------------------------------------------------------------------
 *
 * Quem enfileira é outro processo, e a carga chega desserializada de um armazenamento externo — o
 * tipo declarado descreve o contrato, não garante o que veio. Sem a validação, uma carga sem o
 * campo esperado terminaria **concluída** com resultado indefinido: o pior desfecho possível, uma
 * falha registrada como sucesso. A razão da falha nomeia o campo que faltou, porque é ela que fica
 * gravada no servidor de fila e é o que o operador lê ao descobrir o problema.
 *
 * A razão descreve os campos RECEBIDOS pelo nome, nunca pelo conteúdo: nome de campo não é
 * segredo, valor de campo pode ser.
 *
 * ---------------------------------------------------------------------------
 * Por que o término é REGISTRADO
 * ---------------------------------------------------------------------------
 *
 * O registro é o que torna a conclusão observável de fora do processo — sem ele, "a tarefa
 * terminou" só é verificável espiando o estado interno do servidor de fila. A linha carrega o
 * identificador que o servidor de fila atribuiu, que é o que liga o registro à tarefa enfileirada.
 */

import { type CargaDoEco, FILA_DO_ECO, type Logger } from '@sysloc/shared';
import type { TarefaDeEco } from '../fila.js';

/** Nome do campo que a carga útil precisa trazer. */
const CAMPO_DO_VALOR = 'valor';

/**
 * Executa a tarefa de ida e volta.
 *
 * @param tarefa A tarefa, como o servidor de fila a entregou.
 * @param logger Registrador do processo, recebido do consumidor que a executa.
 * @returns O mesmo valor que a carga útil trouxe.
 * @throws {Error} Quando a carga útil não traz {@link CAMPO_DO_VALOR} com texto não vazio. A
 * mensagem nomeia o campo ausente e os campos recebidos — nunca o conteúdo deles.
 */
export async function processarEco(tarefa: TarefaDeEco, logger: Logger): Promise<string> {
  // A conversão é deliberada: `data` chega de fora do processo, e o tipo declarado é o contrato
  // que esta função verifica — não uma garantia que ela possa assumir.
  const { valor } = (tarefa.data ?? {}) as Partial<CargaDoEco>;

  if (typeof valor !== 'string' || valor.length === 0) {
    throw new Error(
      `a carga da tarefa de eco não traz o campo '${CAMPO_DO_VALOR}' com texto não vazio ` +
        `(campos recebidos: ${descreverCampos(tarefa.data)})`,
    );
  }

  logger.info({ idTarefa: tarefa.id, fila: FILA_DO_ECO, valor }, 'tarefa de eco concluída');

  return valor;
}

/** Lista os nomes dos campos presentes na carga — jamais os valores. */
function descreverCampos(carga: unknown): string {
  if (typeof carga !== 'object' || carga === null) {
    return `nenhum (a carga veio como ${carga === null ? 'nulo' : typeof carga})`;
  }
  const campos = Object.keys(carga);
  return campos.length > 0 ? campos.join(', ') : 'nenhum';
}
