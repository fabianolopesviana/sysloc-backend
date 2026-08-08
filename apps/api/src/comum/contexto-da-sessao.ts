/**
 * A abertura da unidade de trabalho sob o contexto da sessão — **ponto único da borda**.
 *
 * ## Por que existe, e por que num módulo só
 *
 * Toda rota de negócio desta superfície faz exatamente a mesma coisa antes de tocar o banco: lê a
 * sessão que a guarda publicou, recusa a sessão **sem empresa** e abre a unidade de trabalho (decisão
 * D1 — a unidade abre na borda, e o serviço recebe o executor). O método que fazia isso nasceu em
 * `imoveis/conjunto.controller.ts` (T5) e foi copiado **byte a byte** para `imovel.controller.ts`
 * (T6) e `comodo.controller.ts` (T7). O docblock da terceira cópia declarou a duplicação e a
 * reagendou; ela virou o débito **D12**, com dono nomeado: a T9, que publica **três** controladores
 * de cadastro de pessoa e faria nascer as cópias quatro, cinco e seis de uma vez.
 *
 * É o mesmo desenho, e a mesma razão, de {@link ./validacao.js} (débito D38) e de
 * {@link ./esquema-de-erro.js} (débito D40): seis escritas do mesmo fato são livres para divergir sem
 * que nada acuse, e o que diverge primeiro neste molde é justamente **a recusa da sessão sem
 * empresa** — a guarda que impede a criação de bater na coluna `empresa_id NOT NULL` e devolver erro
 * de driver ao cliente.
 *
 * ## O que ela garante, e o que ela deliberadamente NÃO faz
 *
 * O contexto de tenant que a política do banco consome **já está publicado** pela guarda, a partir da
 * sessão; a unidade apenas o fixa com `SET LOCAL`. Nada aqui chama `contextoDeTenant.executarCom`, e
 * não pode chamar: seria a segunda origem de contexto, e a única legítima é a que a guarda derivou
 * (ADR-0008). Manter isso verdadeiro num ponto só é o ganho principal da extração — uma sétima cópia
 * escrita por reflexo é onde a segunda origem entraria.
 *
 * A recusa da sessão sem empresa é `ERRO_INTERNO`, e não recusa de entrada: o Sysloc Master não
 * alcança estas rotas — a matriz dele é vazia (ADR-0011) —, e chegar aqui com `empresaId` nulo é
 * defeito de composição, não pedido inválido.
 *
 * **A mensagem construída abaixo VAI no corpo do `500`, e é por isso que ela é o que é.** O filtro
 * global (`comum/filtro-excecao.ts`) devolve `excecao.paraCorpo()` para todo `ErroDeAplicacao`, sem
 * passar pela tabela de mensagem canônica — a substituição pela mensagem canônica só acontece no ramo
 * do que **não** é `ErroDeAplicacao` —, e `paraCorpo()` publica `{ codigo, mensagem }` com a mensagem
 * literal de quem levantou. Daí a forma dela: uma frase que descreve a **classe** do defeito e **não
 * nomeia sessão, pessoa, empresa nem controlador**. Enriquecê-la com identificador de sessão, com o
 * `usuarioId` ou com o nome do controlador de origem seria publicá-los ao cliente. Quem nomeia a
 * origem é a **pilha da exceção**, que fica no registro estruturado e não sai na resposta.
 */

import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import type { TransactionSql } from 'postgres';
import { type SessaoDoProduto, sessaoDaRequisicao } from '../autenticacao/contexto.guard.js';

/**
 * Abre a unidade de trabalho da operação sob a sessão corrente e entrega o executor ao trabalho.
 *
 * @param banco       A porta única para transação, injetada no controlador por
 *                    `TOKEN_ACESSO_AO_NEGOCIO`. Ela é recebida, e não importada: o dono da instância
 *                    é `AutenticacaoModule`, que também a encerra no desligamento.
 * @param requisicao  A requisição corrente, de onde a sessão publicada pela guarda é lida.
 * @param trabalho    O que corre dentro da unidade. Recebe o executor **e** a sessão, porque a linha
 *                    de trilha de cada rota nomeia a empresa.
 */
export async function sobContextoDaSessao<T>(
  banco: AcessoAoBanco,
  requisicao: FastifyRequest,
  trabalho: (tx: TransactionSql, sessao: SessaoDoProduto) => Promise<T>,
): Promise<T> {
  const sessao = sessaoDaRequisicao(requisicao);

  if (sessao.empresaId === null) {
    throw new ErroDeAplicacao(
      CodigoErro.ERRO_INTERNO,
      'rota de cadastro alcançada por sessão sem empresa',
    );
  }

  return await banco.emUnidadeDeTrabalho(async (tx) => await trabalho(tx, sessao));
}
