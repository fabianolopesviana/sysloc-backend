/**
 * A **emissão em lote** vista da borda: abrir o lote, recusar o concorrente e mandar executar.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * {@link EmissaoEmLoteService.abrir} e {@link EmissaoEmLoteService.ler} tomam o `tx` de quem já abriu
 * a unidade de trabalho — o controlador, pela borda única de `../comum/contexto-da-sessao.js`. Este
 * serviço **não tem `AcessoAoBanco` no construtor**, e a ausência é o mecanismo, não um esquecimento:
 * é ela que impede uma unidade aninhada de nascer aqui.
 *
 * ---------------------------------------------------------------------------
 * O ENFILEIRAMENTO É MÉTODO SEPARADO, e a separação é a ordem da §9.3
 * ---------------------------------------------------------------------------
 *
 * {@link EmissaoEmLoteService.enfileirar} **não recebe `tx`**, e não pode receber: ele corre
 * **depois** do `COMMIT`. Enfileirar dentro da transação abriria a janela oposta e pior — a tarefa
 * nasceria visível ao processo de trabalho **antes** de o lote existir para quem a fosse consumir, e
 * um desfazimento da unidade deixaria na fila a execução de um lote que nunca existiu.
 *
 * A ordem escolhida torna o pior caso inofensivo por construção, e é por isso que **não há tabela de
 * outbox** (§9.3): se o enfileiramento falhar, o lote fica `EM_ANDAMENTO`, o `503` informa, e a
 * próxima tentativa **reusa o mesmo lote** pelo índice único parcial. A falha oposta — enfileirar e o
 * commit desfazer — é impossível, porque nada é enfileirado antes do commit.
 *
 * ⚠️ **A falha de enfileiramento NÃO é absorvida aqui**, e a assimetria com
 * `../cadastros/confirmacao-de-email.service.js` é deliberada. Lá, engolir é o certo: o cadastro já
 * commitou, responder `500` faria o cliente repetir e receber `422` por documento em uso, e a rede
 * de produto é o reenvio manual. Aqui o pedido do Admin **é** *"execute esta emissão"*: um `201`
 * silencioso diria que o lote vai rodar quando ninguém foi avisado de que ele existe, e o Admin ficaria
 * esperando boletos que não saem. O `503` é a informação que resolve — ele diz o que aconteceu, e a
 * repetição do mesmo pedido reencontra o mesmo lote.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.emissao_em_lote` vive em `packages/db/src/emissao-em-lote.ts`,
 * publicada como função de domínio. Não existe, em lugar algum deste arquivo, uma comparação de
 * empresa: o lote de outra empresa não é achado — a política do banco o esconde —, e a ausência vira
 * `404 RECURSO_NAO_ENCONTRADO` num ponto único ({@link EmissaoEmLoteService.exigir}), com o **mesmo
 * corpo** do lote inexistente (ADR-0008).
 */

import { Inject, Injectable } from '@nestjs/common';
import type { EmissaoEmLote } from '@sysloc/contracts';
import { abrirEmissaoEmLote, ErroDeLoteEmCurso, lerLote } from '@sysloc/db';
import {
  type CargaDaEmissaoEmLote,
  CodigoErro,
  ErroDeAplicacao,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../comum/produtor-de-fila.js';
import { TOKEN_LOGGER } from '../configuracao/ambiente.js';

/**
 * O discriminador que a recusa do lote concorrente publica dentro de `detalhes`.
 *
 * Constante nomeada, e não literal solto: o valor é **contrato publicado** — ele chega ao cliente no
 * corpo do `422`, e é por ele que a interface oferece ao Admin o lote que já está acontecendo. Um
 * literal repetido entre o `throw` e a suíte ficaria livre para divergir.
 */
const DISCRIMINADOR_DO_LOTE_EM_CURSO = 'loteEmCurso';

/**
 * A entidade nomeada nas linhas de trilha desta superfície (§13.1).
 *
 * ⚠️ **Há uma declaração irmã em `conferencia-bancaria.service.ts`**, com valor diferente e a mesma
 * razão. As duas ficam **enquanto forem duas**: no dia em que um **terceiro** ponto desta área
 * precisar da mesma constante, ela sobe para um módulo do próprio diretório. É o limiar de três do
 * `CLAUDE.md`, e o mesmo arranjo — com a mesma justificativa — de `CAMPO_DO_CORPO` entre
 * `../integracoes-bancarias/certificado.controller.js` e o serviço dele.
 */
const ENTIDADE_DA_TRILHA = 'emissao_em_lote';

/** O que o Admin lê quando o servidor de fila não aceitou a execução do lote já gravado. */
const MENSAGEM_DO_LOTE_NAO_ENFILEIRADO =
  'a emissão em lote foi aberta e não pôde ser posta em execução';

@Injectable()
export class EmissaoEmLoteService {
  constructor(
    @Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Abre o lote da competência, ou recusa nomeando o que já está em andamento.
   *
   * **Nada é lido antes da escrita**: quem recusa o segundo lote em andamento é o índice único
   * parcial do banco, e a razão está por extenso em `packages/db/src/emissao-em-lote.ts` — entre um
   * `SELECT` que não achasse e o `INSERT`, outra transação grava. O `id` do lote em curso chega aqui
   * dentro de {@link ErroDeLoteEmCurso}, lido **depois** da recusa, e serve para enriquecer a
   * mensagem — nunca para decidir se pode gravar.
   *
   * A recusa é `422`, e **não** `409`: o enum de códigos é fechado, `STATUS_POR_CODIGO` é
   * `Record<CodigoErro, number>` e cobraria o par no compilador. Acrescentar código é decisão de
   * contrato, não de implementação.
   *
   * ⚠️ **A recusa não nomeia campo**, e a ausência é decisão: a competência enviada está válida — quem
   * impede o ato é o **estado da empresa**, não um campo do corpo. Nomear `competencia` mandaria o
   * Admin corrigir o único dado que ele acertou. O que a recusa carrega é o que resolve a situação: o
   * lote que está acontecendo.
   */
  async abrir(
    tx: TransactionSql,
    competencia: string,
    solicitadoPor: string,
  ): Promise<EmissaoEmLote> {
    try {
      return await abrirEmissaoEmLote(tx, { competencia, solicitadoPor });
    } catch (erro) {
      if (!(erro instanceof ErroDeLoteEmCurso)) {
        throw erro;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { detalhes: { [DISCRIMINADOR_DO_LOTE_EM_CURSO]: erro.loteEmCurso } },
      );
    }
  }

  /** Lê o lote com a prestação de contas inteira, ou recusa com o `404` indistinguível. */
  async ler(tx: TransactionSql, loteId: string): Promise<EmissaoEmLote> {
    return this.exigir(await lerLote(tx, loteId));
  }

  /**
   * Manda o processo de trabalho executar o lote — **depois** do `COMMIT`.
   *
   * A carga leva **dois identificadores e nada mais** ({@link CargaDaEmissaoEmLote}): nenhum
   * material, senha, envelope cifrado ou credencial atravessa a fila. Ver o cabeçalho daquela
   * interface para o vetor exato que a ausência fecha, e o `CT-935` para a medição que o prova.
   *
   * A falha vira `503` **construído aqui**, com a causa reduzida a texto pelo produtor — nenhum
   * objeto de exceção da biblioteca de fila atravessa aquela fronteira (`DECISÃO FECHADA — T9 /
   * Gate 2`). O que sai ao Admin é o envelope canônico; o diagnóstico fica no diário.
   */
  async enfileirar(carga: CargaDaEmissaoEmLote): Promise<void> {
    try {
      await this.produtor.enfileirarEmissaoEmLote(carga);
    } catch (erro) {
      // O `erro` que chega aqui já é da aplicação — construído pelo produtor, com a causa em texto.
      // Registrá-lo é o que permite ao operador distinguir "o servidor de fila caiu" de "o servidor
      // recusou a escrita", e nenhuma das duas informações cabe no corpo que o Admin lê.
      this.logger.warn(
        {
          erro,
          empresaId: carga.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          loteId: carga.loteId,
        },
        'a emissão em lote foi aberta e não pôde ser enfileirada',
      );

      throw new ErroDeAplicacao(CodigoErro.SERVICO_INDISPONIVEL, MENSAGEM_DO_LOTE_NAO_ENFILEIRADO, {
        detalhes: { [DISCRIMINADOR_DO_LOTE_EM_CURSO]: carga.loteId },
      });
    }
  }

  /**
   * Traduz a ausência no `404` canônico — **ponto único** da recusa por lote inalcançável.
   *
   * As duas causas da ausência são deliberadamente **indistinguíveis**: o lote não existe, ou existe
   * e é de outra empresa. Um corpo diferente para cada uma faria da borda um oráculo de existência
   * sobre o dado alheio, que é justamente o que a política do banco esconde (ADR-0008).
   */
  private exigir(lote: EmissaoEmLote | undefined): EmissaoEmLote {
    if (lote === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return lote;
  }
}
