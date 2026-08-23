/**
 * A **manutenção do acervo** — a única borda de trabalho do produto que não tem empresa alguma.
 *
 * ===========================================================================
 * A UNIDADE ABRE SEM CONTEXTO, e a ausência é conformidade — não lacuna
 * ===========================================================================
 *
 * Os dois alvos desta passagem não têm dono-empresa: `plataforma.notificacao_bancaria` vive no schema
 * da plataforma, que por decisão **não carrega `empresa_id`**, não habilita RLS e não tem política
 * que o alcance (ADR-0031); e o acervo de boletos é **sistema de arquivos**. Não há tenant a
 * atravessar, e por isso `contextoDeTenant.executarCom` **não aparece neste arquivo**.
 *
 * ⚠️ **Fixar `app.empresa_id` "para facilitar" seria violação, não conformidade.** A variável não
 * recortaria nada — nenhuma política a consulta nestes alvos —, e o que ela criaria é a impressão de
 * que a varredura corre sob tenant. O dia em que alguém acrescentasse a esta fila um alvo tenantizado
 * encontraria o contexto já aberto, com a empresa de ninguém, e a política devolveria vazio em
 * silêncio: o pior modo de falha da ADR-0008, com o trabalho terminando CONCLUÍDO sem fazer nada.
 *
 * ⚠️ **O expurgo do histórico de execução NÃO corre aqui**, e é a leitura errada mais provável deste
 * arquivo. `negocio.execucao_de_rotina` **é** tenantizada: o expurgo dela viaja como
 * `EXPURGO_DO_HISTORICO` na fila da rotina agendada, **sob contexto** (`./rotina-agendada.ts`).
 * Trazê-lo para cá faria uma varredura sem `app.empresa_id` alcançar dado de empresa.
 *
 * ===========================================================================
 * A CARGA NÃO TEM CAMPO ALGUM, e o `strictObject` vazio é o mecanismo
 * ===========================================================================
 *
 * `CargaDaManutencaoDoAcervo` é `Record<string, never>` em `@sysloc/shared`, de modo que o produtor
 * que acrescentasse `empresaId` por analogia com a vizinha {@link CargaDaRotinaAgendada} **não
 * compila**. Este esquema é a **segunda** rede, do lado do consumidor: `z.strictObject({})` recusa
 * campo desconhecido **nomeando a chave**, em vez de ignorá-lo.
 *
 * ⚠️ **A ausência do campo é o que a terceira emenda da ADR-0024 (2026-08-18) autoriza**, e por razão
 * PRÓPRIA — diferente da fila da notícia bancária, onde a empresa é o *resultado* de uma travessia
 * ainda por fazer. Aqui a resposta a *"quem tinha direito a este identificador"* é *"ninguém, nunca"*:
 * não há empresa a resolver. Ver o cabeçalho de `packages/shared/src/fila.ts`.
 *
 * ===========================================================================
 * O EXPURGO DO CRU É REUSADO, jamais reescrito
 * ===========================================================================
 *
 * `expurgarNotificacoesVencidas` já existe desde a fatia `webhook-e-carne`, com o corte derivado de
 * `now()` **do banco** (ADR-0026) e o idioma de `make_interval`. Ela é **chamada** daqui, e nenhum
 * `DELETE` sobre `plataforma.notificacao_bancaria` é escrito neste arquivo: uma segunda instrução
 * teria a própria ideia do prazo de guarda, e a primeira a divergir venceria em silêncio — sobre dado
 * pessoal de terceiro, que é o que a RN-11 existe para limitar.
 *
 * O que muda com esta fatia é **quem a provoca**. Até aqui ela corria **de carona** no tratamento de
 * cada notícia (`./notificacao-bancaria.ts`), e a decisão D8 do tech-alignment nomeia o defeito disso:
 * com a Entrega da notícia desabilitada, nenhuma notícia chega — e o expurgo para junto, sem que nada
 * acuse, exatamente quando o acervo cru mais cresce. A carona **permanece** onde está: ela não faz
 * mal, e removê-la seria mexer em arquivo que esta task não tem razão para tocar.
 *
 * ===========================================================================
 * NENHUM RELÓGIO DE PROCESSO É LIDO AQUI — os dois cortes moram no alvo
 * ===========================================================================
 *
 * O corte do cru sai de `now()` do banco; o corte do acervo sai do **relógio do sistema de arquivos**,
 * dentro de `expurgarBoletosVencidos`, que é onde o `mtime` também nasce. Nenhuma data é composta
 * neste arquivo, e nenhuma decisão dele deriva de `Date.now()` (ADR-0026).
 *
 * ⚠️ **O prazo dos boletos chega POR PARÂMETRO** (ADR-0025), da composição raiz — que é onde ele é
 * declarado por constante. Escrevê-lo aqui o transformaria em constante enterrada numa borda, e a
 * reversão declarada no tech spec (§7.5, decisão A1) deixaria de ser *"uma linha na composição raiz"*.
 *
 * ===========================================================================
 * OS DOIS ALVOS SÃO INDEPENDENTES, e a falha de um NÃO cancela o outro
 * ===========================================================================
 *
 * Eles não dividem transação nem destino: um é `DELETE` no banco, o outro é `unlink` no disco. Cada um
 * corre na sua e o resultado sai numa linha por alvo, com `{ alvo, removidos }`. A tarefa **falha**
 * quando qualquer um deles falha — a política de repetição da fila a retenta, e as duas operações são
 * idempotentes —, mas o que já foi expurgado antes da falha **permanece** expurgado, que é o desfecho
 * correto: nada aqui é reversível, e nada precisa ser.
 */

import type { GuardaDeBoletos } from '@sysloc/cobranca-bancaria';
import { type AcessoAoBanco, expurgarNotificacoesVencidas } from '@sysloc/db';
import { FILA_DA_MANUTENCAO_DO_ACERVO, type Logger } from '@sysloc/shared';
import { z } from 'zod';
import type { TarefaDaManutencaoDoAcervo } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';

/**
 * O que a carga desta tarefa precisa ser — **um objeto sem campo algum**.
 *
 * `strictObject` vazio, e não `object`: com `object`, a chave excedente seria **ignorada em silêncio**
 * e o `empresaId` que alguém acrescentasse por analogia com a fila irmã atravessaria sem um ruído.
 * Aqui ele é recusado **nomeando a chave**, que é o que a `.claude/rules/contrato-publicado.md` cobra.
 */
export const esquemaDaCargaDaManutencaoDoAcervo = z.strictObject({});

/** A exigência publicada na razão da falha — ela nomeia o que a carga é, e nada além disso. */
const EXIGENCIA_DA_CARGA =
  'a carga da tarefa da manutenção do acervo é um objeto vazio: ela não leva empresa, porque os ' +
  'alvos da manutenção não têm dono-empresa, e nenhum outro campo é aceito';

/**
 * Os dois alvos da passagem, como o diário os nomeia — constantes porque o rótulo é **contrato com
 * quem lê o journal**, e dois literais separados divergem sem que nada acuse.
 */
const ALVO_DO_RECEBIDO_CRU = 'RECEBIDO_CRU';
const ALVO_DOS_BOLETOS_GUARDADOS = 'BOLETOS_GUARDADOS';

/**
 * As portas que a composição raiz do processo entrega a esta borda (ADR-0025).
 *
 * ⚠️ **Não há adaptador do provedor aqui, e a ausência é a fronteira**: esta passagem não fala com o
 * banco do cliente, não abre certificado e não decifra segredo algum. O que ela precisa é do acesso ao
 * banco, da guarda do acervo e do prazo — e um conjunto maior daria a uma rotina de limpeza alcance
 * sobre operação de título.
 */
export interface DependenciasDaManutencaoDoAcervo {
  /** O acesso ao banco. A unidade abre aqui, na borda, e a porta de dados **recebe** o `tx`. */
  readonly banco: AcessoAoBanco;
  /** A guarda do acervo de boletos, já apontada para o diretório-base da instalação. */
  readonly guarda: GuardaDeBoletos;
  /**
   * Quantos dias inteiros um boleto guardado sobrevive.
   *
   * Chega por parâmetro, da composição raiz, e não é escrito aqui — ver o cabeçalho.
   */
  readonly diasDeRetencaoDosBoletos: number;
}

/**
 * Executa **uma** passagem de manutenção do acervo — sem tenant, e sobre os dois alvos.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaManutencaoDoAcervo}.
 * @throws {Error} Quando a carga não é o objeto vazio — **antes** de qualquer leitura —, quando a
 * porta de dados falha, ou quando o acervo contém entrada que a guarda não consegue conferir. Nos
 * três a fila repete pela política declarada em `@sysloc/shared`, e as duas operações são
 * idempotentes.
 */
export async function processarManutencaoDoAcervo(
  tarefa: TarefaDaManutencaoDoAcervo,
  logger: Logger,
  dependencias: DependenciasDaManutencaoDoAcervo,
): Promise<void> {
  // Primeiro a recusa, e só depois o trabalho: é a mesma ordem das bordas irmãs. Aqui ela não protege
  // contexto nenhum — não há —, mas protege o contrato: a carga com campo a mais é sinal de um
  // produtor que entendeu esta fila como outra coisa, e prosseguir apagaria dado obedecendo a um
  // pedido que ninguém formulou.
  cargaConferida(esquemaDaCargaDaManutencaoDoAcervo, EXIGENCIA_DA_CARGA, tarefa.data);

  // A unidade abre SEM contexto de empresa — ver o cabeçalho. A porta de dados **recebe** o `tx`, e
  // o corte dos 90 dias é dela: nada aqui compõe data.
  const cruRemovido = await dependencias.banco.emUnidadeDeTrabalho(
    async (tx) => await expurgarNotificacoesVencidas(tx),
  );

  registrarAlvo(logger, tarefa, ALVO_DO_RECEBIDO_CRU, cruRemovido);

  // O segundo alvo, em operação independente da primeira: o disco não participa da transação acima, e
  // a unidade já foi devolvida antes de o `fs` ser tocado.
  const boletosRemovidos = await dependencias.guarda.expurgarBoletosVencidos(
    dependencias.diasDeRetencaoDosBoletos,
  );

  registrarAlvo(logger, tarefa, ALVO_DOS_BOLETOS_GUARDADOS, boletosRemovidos);
}

/**
 * Publica o resultado de **um** alvo no diário, com o nível decidido pelo que a passagem fez.
 *
 * ⚠️ **Zero sai em diagnóstico, e não em informação.** O caso comum de uma rotina diária é não haver
 * nada a expurgar, e uma linha de informação por alvo por dia é o ruído que faz quem opera parar de
 * ler o journal — a mesma decisão que `./notificacao-bancaria.ts` registra para a carona.
 *
 * O que sai é a **contagem**, e nada mais: nenhum identificador de notícia, nenhum nome de arquivo,
 * nenhum caminho. A auditoria por entidade são as tabelas do domínio.
 */
function registrarAlvo(
  logger: Logger,
  tarefa: TarefaDaManutencaoDoAcervo,
  alvo: string,
  removidos: number,
): void {
  const evento = {
    idTarefa: tarefa.id,
    fila: FILA_DA_MANUTENCAO_DO_ACERVO,
    alvo,
    removidos,
  };

  if (removidos > 0) {
    logger.info(evento, 'a manutenção do acervo expurgou o que venceu');

    return;
  }

  logger.debug(evento, 'a manutenção do acervo não encontrou nada vencido');
}
