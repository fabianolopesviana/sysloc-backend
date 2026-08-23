/**
 * A recepção da notícia bancária — **gravar o cru, e só então enfileirar**.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DOS DOIS PASSOS É O CONTEÚDO (§5.1-A da tech spec, cláusula 1 da ADR-0035)
 * ---------------------------------------------------------------------------
 *
 *   a) `banco.emUnidadeDeTrabalho` → `registrarNotificacaoBancaria(tx, { recebido })`. O corpo vai
 *      para `jsonb` **sem que nada olhe para dentro**; `recebido_em` vem de `now()` do **banco**
 *      (ADR-0026) e `desfecho` nasce `'RECEBIDO'`, os dois como padrão da coluna;
 *   b) **fora** da unidade — isto é, depois do `COMMIT` —, `enfileirarNotificacaoBancaria`.
 *
 * Inverter os dois seria enfileirar um identificador que a transação ainda pode desfazer: a tarefa
 * correria contra o `COMMIT` e leria uma linha que não existe. A ordem escolhida tem a falha oposta,
 * e ela é **benigna e recuperável**: o cru fica gravado sem tarefa, e isso é exatamente o que o
 * ramo de falha abaixo trata. É a mesma leitura, e a mesma razão, da §9.3 da fatia anterior — é ela
 * que dispensa uma tabela de *outbox*.
 *
 * ---------------------------------------------------------------------------
 * NENHUM CONTEXTO DE TENANT — e a ausência não é descuido (ADR-0031, ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * A unidade de trabalho do passo (a) corre **sem** `app.empresa_id` fixado, e não poderia ser
 * diferente: quando ela corre, ainda não se sabe de que empresa o fato é — descobrir é o trabalho da
 * tarefa, por travessia nominal. `plataforma.notificacao_bancaria` não tem coluna de empresa, não
 * habilita RLS e nenhuma política a alcança (ADR-0031), de modo que a inserção sucede assim mesmo.
 *
 * ⚠️ **`sobContextoDaSessao` não se aplica**, e a razão é a mesma de `confirmacao.service.ts`: ele lê
 * a sessão que a guarda publicou, e nesta rota não há sessão nenhuma. A diferença para aquele
 * arquivo é que aqui **não há segunda unidade** e **não há `contextoDeTenant.executarCom`** — a
 * empresa não é descoberta nesta camada, e escrever qualquer coisa a respeito dela aqui seria
 * reconstituir o recebido como origem do tenant, que é o que a ADR-0024 proíbe.
 *
 * ---------------------------------------------------------------------------
 * NADA DO RECEBIDO VAI PARA O REGISTRO (§10.3 da tech spec)
 * ---------------------------------------------------------------------------
 *
 * O corpo carrega **dado pessoal do pagador** — nome, documento, valores, códigos de barras —, e o
 * lugar dele é a coluna `jsonb`, que tem prazo de guarda de 90 dias e expurgo. O journal **não tem
 * prazo**: uma linha que copiasse o recebido criaria retenção indefinida do que a RN-11 manda
 * descartar, e a redação única de `@sysloc/shared` não a alcançaria — ela redige por **nome de
 * chave**, e o vocabulário do provedor não casa radical nenhum.
 *
 * Por isso o que sai daqui é o `notificacaoId` e, no ramo de falha, o erro **já saneado** pelo
 * produtor. É a armadilha mais provável de quem editar este arquivo: acrescentar `{ recebido }` a
 * um dos `logger.*` abaixo parece diagnóstico e é vazamento.
 */

import { Inject, Injectable } from '@nestjs/common';
import { type AcessoAoBanco, registrarNotificacaoBancaria } from '@sysloc/db';
import type { CargaDaNotificacaoBancaria, Logger } from '@sysloc/shared';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../comum/produtor-de-fila.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';

/**
 * A entidade nomeada nas linhas de trilha desta superfície (§13.1 da tech spec).
 *
 * Constante nomeada porque o rótulo é **contrato de observabilidade**: é por ele que o operador
 * filtra o journal, e um literal repetido em dois pontos de registro diverge na primeira emenda.
 */
const ENTIDADE_DA_TRILHA = 'notificacao_bancaria';

@Injectable()
export class NotificacaoBancariaService {
  constructor(
    // A porta única para transação. Ela é **recebida**, e não construída aqui: o dono da instância é
    // `AutenticacaoModule`, que também a encerra no desligamento. Este serviço a recebe — em vez de
    // o `tx` chegar do controlador, como manda a decisão D1 — pela mesma razão declarada em
    // `confirmacao.service.ts`: a borda é outra, não há sessão de onde a unidade nasceria, e é aqui
    // que mora a decisão de **o que acontece depois do `COMMIT`**, que a camada de apresentação não
    // pode conter.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Grava o recebido como chegou e manda o processo de trabalho tratá-lo.
   *
   * @param recebido O corpo, **opaco**. Ele não é validado, não é normalizado e não é inspecionado —
   * ver o cabeçalho do controlador para por que a ausência de validação é a decisão.
   */
  async receber(recebido: unknown): Promise<void> {
    const notificacaoId = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await registrarNotificacaoBancaria(tx, { recebido }),
    );

    await this.enfileirar({ notificacaoId });
  }

  /**
   * Enfileira o tratamento — e **absorve** a falha, em vez de propagá-la.
   *
   * ⚠️ **Engolir aqui é a decisão certa, e ela é o oposto do que a emissão em lote faz** (§5.2 (b) e
   * §7.4 do tech spec). Propagar devolveria `5xx` ao provedor, e o provedor **reenviaria** — de modo
   * que a resposta de erro *causaria* a reentrega que a idempotência da fatia existe para
   * **absorver**. O que não pode se perder já não se perdeu: o cru está gravado, e a notícia
   * permanece em `RECEBIDO`, consultável e reprocessável.
   *
   * ⚠️ **E quem a reprocessa tem nome desde a F5**: a rotina `RETOMADA_DE_NOTICIAS` do despachante
   * (`apps/worker/src/despachante.ts`) varre, de dez em dez minutos, toda notícia parada em
   * `RECEBIDO` além da folga e a reenfileira na **mesma** fila — pela porta `listarNaoTratadas` de
   * `@sysloc/db`. É o fecho do `D13 · F4/T6`, que registrava justamente que absorver aqui deixava a
   * notícia sem ninguém para alcançá-la sozinha. **Não pendure um varredor próprio neste serviço**:
   * seria um segundo mecanismo de agendamento, e o primeiro já existe.
   *
   * A diferença para o lote é de produto, não de infraestrutura: lá o pedido do Admin foi *"execute
   * isto"*, e dizer `201` sem ter enfileirado seria mentir sobre o desfecho; aqui o pedido do
   * terceiro foi *"tome nota disto"*, e a nota foi tomada.
   *
   * O `erro` que chega já é da aplicação — construído pelo produtor, com a causa reduzida a texto
   * (`DECISÃO FECHADA — T9 / Gate 2` de `../comum/produtor-de-fila.js`). Nenhum objeto de exceção da
   * biblioteca de fila atravessa aquela fronteira, e é isso que permite registrá-lo aqui.
   */
  private async enfileirar(carga: CargaDaNotificacaoBancaria): Promise<void> {
    try {
      await this.produtor.enfileirarNotificacaoBancaria(carga);
    } catch (erro) {
      // `warn`, e não `error`: o dado está a salvo e a resposta ao provedor não muda. O que o
      // operador precisa é do par (identificador, causa) para reprocessar — e **nada do recebido**
      // entra, pela razão do cabeçalho.
      this.logger.warn(
        { erro, entidade: ENTIDADE_DA_TRILHA, notificacaoId: carga.notificacaoId },
        'a notícia bancária foi gravada e não pôde ser enfileirada',
      );
    }
  }
}
