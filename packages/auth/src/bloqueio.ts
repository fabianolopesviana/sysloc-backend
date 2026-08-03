/**
 * Bloqueio por conta (RN-06) — contador e instante de liberação na própria conta.
 *
 * ---------------------------------------------------------------------------
 * Por que não o limitador do arcabouço
 * ---------------------------------------------------------------------------
 *
 * O arcabouço traz limitação **por rota e janela**, em memória ou armazenamento secundário. Ela não
 * cumpre a RN-06: cinco tentativas suficientemente espaçadas passariam ilesas, e a regra fala de
 * **conta**, não de janela. Ele permanece disponível como camada adicional, e não como substituto
 * (§11.5 da tech spec).
 *
 * O estado mora em `identidade.usuario` — nas colunas `tentativas_falhas` e `bloqueado_ate` — e não
 * numa tabela de janela nem no armazenamento de fila. A alternativa em cache foi rejeitada no
 * tech-alignment (D5): o bloqueio de uma conta viraria dado sem dono, fora do banco onde a trilha de
 * auditoria vive, e expiração de cache não é a mesma coisa que decisão de negócio revogável.
 *
 * ---------------------------------------------------------------------------
 * O incremento acontece no próprio `UPDATE`
 * ---------------------------------------------------------------------------
 *
 * Sem leitura prévia: o novo valor é `tentativas_falhas + 1` calculado pelo servidor, e a decisão de
 * gravar o instante de liberação é um `CASE` sobre esse mesmo valor, na mesma instrução. É o que
 * torna a contagem correta sob concorrência **sem bloqueio explícito** (§7.4 da tech spec) — a forma
 * "ler, somar em JavaScript, escrever de volta" perde incrementos quando duas tentativas correm ao
 * mesmo tempo, e perde exatamente no cenário que a regra existe para cobrir: o ataque paralelo.
 */

import { type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';
import { eq, sql } from 'drizzle-orm';

/** Quantas falhas consecutivas bloqueiam a conta. A quarta não bloqueia; a quinta bloqueia. */
export const LIMITE_DE_FALHAS_CONSECUTIVAS = 5;

/**
 * Por quanto tempo a conta fica bloqueada.
 *
 * Nem o PRD nem a tech spec fixam a duração — a RN-06 só exige que a quinta falha grave "instante de
 * liberação no futuro". Quinze minutos é a escolha desta implementação: longo o bastante para que
 * uma tentativa exaustiva deixe de compensar, curto o bastante para que a pessoa legítima que errou
 * cinco vezes não precise abrir chamado. É constante exportada, e não número solto, porque a
 * verificação do decurso do prazo precisa usar **a mesma** duração que a operação usa.
 */
export const DURACAO_DO_BLOQUEIO_EM_MINUTOS = 15;

/** O estado de bloqueio de uma conta, como ele ficou depois da operação. */
export interface EstadoDeBloqueio {
  readonly tentativasFalhas: number;
  readonly bloqueadoAte: Date | null;
}

/**
 * Conta a falha e, na `LIMITE_DE_FALHAS_CONSECUTIVAS`-ésima, grava o instante de liberação.
 *
 * Devolve o estado **como o banco o deixou** — lido do `RETURNING` da mesma instrução, e não
 * recalculado aqui. Recalcular seria devolver o que este processo acha que gravou, que sob
 * concorrência não é o que está gravado.
 *
 * Conta inexistente devolve `undefined`: quem chama decide o que isso significa. Nesta fatia o
 * caminho não é alcançável (só se chama isto com pessoa resolvida), e devolver `undefined` em vez de
 * levantar erro mantém a decisão com quem tem contexto.
 */
export async function registrarFalha(
  banco: BancoDeIdentidade,
  usuarioId: string,
): Promise<EstadoDeBloqueio | undefined> {
  const { usuario } = esquemaIdentidade;

  // O `CASE` preserva `bloqueado_ate` quando o limite ainda não foi alcançado, em vez de escrevê-lo
  // como nulo: uma conta já bloqueada que receba tentativa nova não pode ter o prazo APAGADO pela
  // própria tentativa — seria o bloqueio se desfazendo por insistência.
  const [linha] = await banco
    .update(usuario)
    .set({
      tentativasFalhas: sql`${usuario.tentativasFalhas} + 1`,
      bloqueadoAte: sql`
        CASE
          WHEN ${usuario.tentativasFalhas} + 1 >= ${LIMITE_DE_FALHAS_CONSECUTIVAS}
          THEN now() + make_interval(mins => ${DURACAO_DO_BLOQUEIO_EM_MINUTOS})
          ELSE ${usuario.bloqueadoAte}
        END
      `,
    })
    .where(eq(usuario.id, usuarioId))
    .returning({
      tentativasFalhas: usuario.tentativasFalhas,
      bloqueadoAte: usuario.bloqueadoAte,
    });

  return linha;
}

/**
 * Zera o contador e limpa o instante de liberação. É o que uma entrada bem-sucedida faz.
 *
 * Escrita incondicional, sem ler antes se há o que limpar: a leitura prévia acrescentaria uma ida ao
 * banco para poupar uma escrita barata, e abriria a janela em que outra tentativa incrementa o
 * contador entre a leitura e a decisão de não escrever.
 */
export async function limparBloqueio(banco: BancoDeIdentidade, usuarioId: string): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await banco
    .update(usuario)
    .set({ tentativasFalhas: 0, bloqueadoAte: null })
    .where(eq(usuario.id, usuarioId));
}

/**
 * A conta está bloqueada no instante informado.
 *
 * O predicado olha para o **instante de liberação**, e não para o contador: é o instante que expira
 * sozinho com a passagem do tempo, e é ele que a RN-06 manda gravar. Uma conta com cinco falhas e
 * prazo vencido está liberada — o contador só volta a zero na entrada bem-sucedida, e usá-lo como
 * critério manteria a conta trancada para sempre.
 */
export function estaBloqueada(estado: EstadoDeBloqueio, agora: Date): boolean {
  return estado.bloqueadoAte !== null && estado.bloqueadoAte.getTime() > agora.getTime();
}
