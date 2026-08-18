/**
 * A **conferência bancária** vista da borda: abrir a apuração, ou devolver a que já está em curso.
 *
 * ---------------------------------------------------------------------------
 * A CONCORRÊNCIA NÃO É ERRO AQUI, e é isso que separa este serviço do irmão
 * ---------------------------------------------------------------------------
 *
 * `EmissaoEmLoteService.abrir` traduz o lote concorrente em `422`: o Admin pediu um lote e não o
 * teve. Aqui o desfecho é outro, e a diferença é do **ato**, não de gosto: o que o Admin pede é *"vá
 * conferir"*, e quando já há uma apuração em curso o que ele pediu **está acontecendo**. Devolver
 * `200` com `iniciadaAgora: false` e o recurso da execução viva informa mais do que um envelope de
 * erro informaria — qual é e desde quando —, e torna o `POST` **idempotente**.
 *
 * Há uma segunda razão, e ela é de contrato: um `409` exigiria código de erro **novo**, e
 * `STATUS_POR_CODIGO` é `Record<CodigoErro, number>` — o enum fechado de oito não cresce para
 * acomodar um desfecho que **não é falha**. Acrescentar código é decisão de contrato, não de
 * implementação.
 *
 * Quem recusa a segunda apuração é o **índice único parcial** `(empresa_id) WHERE concluida_em IS
 * NULL`, no banco, e não uma leitura prévia — ver `packages/db/src/conferencia-bancaria.ts` para as
 * três razões do `ON CONFLICT … DO NOTHING`. **Nada é enfileirado** quando `iniciadaAgora` é `false`,
 * e a decisão é do controlador, que é quem conhece a ordem em relação ao `COMMIT`.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * {@link ConferenciaBancariaService.abrir} toma o `tx` de quem já abriu a unidade de trabalho — o
 * controlador, pela borda única de `../comum/contexto-da-sessao.js`. Este serviço **não tem
 * `AcessoAoBanco` no construtor**, e a ausência é o mecanismo.
 *
 * {@link ConferenciaBancariaService.enfileirar} **não recebe `tx`**: ele corre depois do `COMMIT`,
 * pela mesma ordem da §9.3 que o irmão registra por extenso. Falha ao enfileirar **não** desfaz a
 * conferência aberta — ela fica em curso, o `503` informa, e o disparo seguinte reencontra a mesma
 * pelo índice parcial, agora com `iniciadaAgora: false`.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ConferenciaBancaria } from '@sysloc/contracts';
import { abrirConferencia } from '@sysloc/db';
import {
  type CargaDaConferenciaBancaria,
  CodigoErro,
  ErroDeAplicacao,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../comum/produtor-de-fila.js';
import { TOKEN_LOGGER } from '../configuracao/ambiente.js';

/**
 * A entidade nomeada nas linhas de trilha desta superfície (§13.1).
 *
 * ⚠️ Declaração irmã em `emissao-em-lote.service.ts`, com valor diferente e a mesma razão — ver o
 * docblock de lá para por que as duas ficam **enquanto forem duas**, e o que dispara a promoção.
 */
const ENTIDADE_DA_TRILHA = 'conferencia_bancaria';

/** O discriminador que a recusa de enfileiramento publica dentro de `detalhes`. */
const DISCRIMINADOR_DA_CONFERENCIA = 'conferenciaEmCurso';

/** O que o Admin lê quando o servidor de fila não aceitou a conferência já aberta. */
const MENSAGEM_DA_CONFERENCIA_NAO_ENFILEIRADA =
  'a conferência bancária foi aberta e não pôde ser posta em execução';

@Injectable()
export class ConferenciaBancariaService {
  constructor(
    @Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Abre a conferência da empresa do contexto, **ou devolve a que já está em curso**.
   *
   * Os dois desfechos são legítimos, e o que os separa é `iniciadaAgora` — ver o cabeçalho. Nenhuma
   * tradução de erro acontece aqui, e a ausência é o conteúdo: não há recusa a traduzir.
   */
  async abrir(tx: TransactionSql, solicitadaPor: string): Promise<ConferenciaBancaria> {
    return await abrirConferencia(tx, { solicitadaPor });
  }

  /**
   * Manda o processo de trabalho executar a conferência — **depois** do `COMMIT`.
   *
   * A carga leva **dois identificadores e nada mais** ({@link CargaDaConferenciaBancaria}): nenhum
   * material, senha, envelope cifrado ou credencial atravessa a fila. O processo de trabalho resolve
   * o certificado pelo banco, sob o contexto que esta mesma carga estabelece.
   *
   * A falha vira `503` **construído aqui**, com a causa reduzida a texto pelo produtor — nenhum
   * objeto de exceção da biblioteca de fila atravessa aquela fronteira (`DECISÃO FECHADA — T9 /
   * Gate 2`).
   */
  async enfileirar(carga: CargaDaConferenciaBancaria): Promise<void> {
    try {
      await this.produtor.enfileirarConferenciaBancaria(carga);
    } catch (erro) {
      this.logger.warn(
        {
          erro,
          empresaId: carga.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          conferenciaId: carga.conferenciaId,
        },
        'a conferência bancária foi aberta e não pôde ser enfileirada',
      );

      throw new ErroDeAplicacao(
        CodigoErro.SERVICO_INDISPONIVEL,
        MENSAGEM_DA_CONFERENCIA_NAO_ENFILEIRADA,
        { detalhes: { [DISCRIMINADOR_DA_CONFERENCIA]: carga.conferenciaId } },
      );
    }
  }
}
