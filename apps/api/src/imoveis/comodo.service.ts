/**
 * Cômodo — a regra de domínio das três rotas de `/v1/imoveis/:id/comodos`.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos deste serviço tomam o `tx` de quem já abriu a unidade de trabalho — o
 * controlador. Nenhum deles chama `emUnidadeDeTrabalho`, e é essa ausência que faz a escrita do
 * cômodo e a releitura do imóvel caberem num **commit só**. Se este serviço abrisse a própria
 * unidade, a composição bateria em `ErroDeUnidadeAninhada`, e a saída seria fundir serviços para
 * satisfazer o mecanismo de transação — a topologia às avessas.
 *
 * **A decisão fechada que instala a recusa de aninhamento, em
 * `packages/db/src/unidade-de-trabalho.ts`, não é tocada** — esta é a saída que ela própria aponta,
 * e o `CT-325` afirma que a recusa continua valendo.
 *
 * ---------------------------------------------------------------------------
 * TODA ESCRITA RESPONDE COM O IMÓVEL INTEIRO, JÁ RECALCULADO
 * ---------------------------------------------------------------------------
 *
 * O cômodo não tem rota de leitura própria: ele chega e volta **dentro do imóvel**, que é o agregado
 * dele (§4.1). Por isso os três métodos terminam em {@link ImovelService.ler} — e não numa projeção
 * montada aqui. São duas consequências, e as duas são o motivo de a releitura existir:
 *
 *   * o cliente vê o efeito na `metragemTotal` **na mesma resposta**, sem uma segunda ida; e
 *   * a soma continua tendo **um** ponto de avaliação, que é o agregado de
 *     `packages/db/src/imovel.ts`. Um corpo montado aqui seria a segunda soma que o `CT-307` existe
 *     para detectar.
 *
 * A releitura corre na **mesma unidade de trabalho** da escrita, de modo que ela enxerga o que a
 * escrita acabou de gravar e o par inteiro desfaz junto se algo falhar depois.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.comodo` vive em `packages/db/src/comodo.ts`, publicada como função
 * de domínio. A razão é a enumerabilidade, e está por extenso no cabeçalho daquele arquivo.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. O cômodo de outra empresa não
 * é achado — a política do banco o esconde —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num
 * ponto único ({@link ComodoService.exigirEscrito}). **A mesma ausência cobre o imóvel pai
 * inalcançável e o cômodo que não pertence àquele imóvel**, e a indistinção é deliberada: a borda
 * não pode virar um oráculo de existência sobre o cadastro alheio.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ComodoNovo, Imovel } from '@sysloc/contracts';
import { acrescentarComodo, alterarComodo, type ComodoPersistido, removerComodo } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { ImovelService } from './imovel.service.js';

@Injectable()
export class ComodoService {
  // O acesso ao banco **não** é injetado aqui, porque quem abre a unidade de trabalho é o
  // controlador (D1). O que entra é o serviço do imóvel — é dele a leitura que devolve o agregado
  // recalculado, e reimplementá-la aqui criaria a segunda tradução do imóvel para o contrato.
  constructor(@Inject(ImovelService) private readonly imoveis: ImovelService) {}

  /**
   * Acrescenta um cômodo ao imóvel e devolve o imóvel inteiro, já recalculado.
   *
   * A posição é atribuída pelo servidor, dentro da instrução de gravação — este serviço não a
   * calcula, não a lê e não a recebe. Ver `packages/db/src/comodo.ts`.
   */
  async acrescentar(tx: TransactionSql, imovelId: string, entrada: ComodoNovo): Promise<Imovel> {
    this.exigirEscrito(await acrescentarComodo(tx, imovelId, entrada));

    return await this.imoveis.ler(tx, imovelId);
  }

  /**
   * Reescreve o cômodo com o corpo completo (§4.1.1) e devolve o imóvel inteiro, já recalculado.
   *
   * É esta rota que muda a metragem total **sem reenviar o imóvel** — o `CT-308` mede exatamente
   * isso, comparando o total antes e depois com o vetor de cômodos inalterado no resto.
   */
  async alterar(
    tx: TransactionSql,
    imovelId: string,
    comodoId: string,
    entrada: ComodoNovo,
  ): Promise<Imovel> {
    this.exigirEscrito(await alterarComodo(tx, imovelId, comodoId, entrada));

    return await this.imoveis.ler(tx, imovelId);
  }

  /**
   * Remove o cômodo **de fato** e devolve o imóvel inteiro, já recalculado.
   *
   * A remoção é física — é a exceção que a ADR-0014 declara para o cômodo, e a **ausência** da
   * coluna de retirada em `negocio.comodo` é o que a torna verificável (`CT-317`).
   */
  async remover(tx: TransactionSql, imovelId: string, comodoId: string): Promise<Imovel> {
    this.exigirEscrito(await removerComodo(tx, imovelId, comodoId));

    return await this.imoveis.ler(tx, imovelId);
  }

  /**
   * Traduz a ausência em `404` — **ponto único** das três rotas.
   *
   * É aqui, e em nenhum outro lugar, que a fronteira de tenant do cômodo vira resposta. Três
   * traduções da mesma ausência ficariam livres para divergir no código e no status, e a forma do
   * erro é contrato: o cômodo de outra empresa, o cômodo de outro imóvel da mesma empresa e o cômodo
   * que não existe respondem `404` com o corpo **idêntico** — a borda não tem como distinguir os
   * três, e não deve ter.
   */
  private exigirEscrito(comodo: ComodoPersistido | undefined): ComodoPersistido {
    if (comodo === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return comodo;
  }
}
