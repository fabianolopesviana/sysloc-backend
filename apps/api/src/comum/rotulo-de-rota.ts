/**
 * O rótulo com que uma requisição aparece no journal, quando o padrão casado pelo roteador é
 * grosseiro demais para ser útil — fechamento da F1 (débito D27).
 *
 * ---------------------------------------------------------------------------
 * O problema que isto resolve
 * ---------------------------------------------------------------------------
 *
 * `comum/filtro-excecao.ts` grava no journal o **padrão** da rota casada, e não o alvo concreto:
 * agrupa por rota em vez de por instância, e — decisivo — não carrega segmento sensível, porque a
 * redação de T1 opera por nome de chave e por forma, e nenhum dos dois eixos alcança um segmento de
 * caminho.
 *
 * Sob o encaminhador `@All('*')` de `/v1/auth`, porém, o padrão casado das ~40 rotas de identidade é
 * **um só** (`/v1/auth/*`). O operador que lê o journal não distingue uma tentativa de entrada de
 * qualquer outra recusa daquela superfície — que é degradar justamente o artefato que a operação lê
 * para decidir se houve ataque.
 *
 * ---------------------------------------------------------------------------
 * Por que o rótulo sai de um CONJUNTO FECHADO, e não de um casador de padrões
 * ---------------------------------------------------------------------------
 *
 * A saída óbvia — casar o caminho concreto contra os padrões do registro do arcabouço e usar o
 * padrão vencedor — resolveria também as rotas parametrizadas (`/reset-password/:token` em vez de
 * `/reset-password/abc…`). Ela foi **recusada**: exige um casador de segmentos escrito à mão, e um
 * defeito nele publica o valor concreto no journal — isto é, o token de redefinição, em claro, no
 * artefato que a operação lê. O ganho não paga a classe de risco.
 *
 * O que está implementado é a versão **fail-closed**: o rótulo só pode ser um dos padrões do
 * registro que **não têm parâmetro**, comparado por igualdade literal. Não há casamento, não há
 * extração de segmento, não há reescrita. O conjunto de valores possíveis é, por construção:
 *
 *     { padrões literais do registro do arcabouço } ∪ { o padrão do roteador (`/v1/auth/*`) }
 *
 * Nenhum deles contém dado do pedido. Uma rota parametrizada simplesmente não recebe rótulo e
 * continua saindo como o curinga — comportamento idêntico ao de antes desta mudança, que é o
 * desfecho seguro.
 *
 * ---------------------------------------------------------------------------
 * Por que `WeakMap`, e não uma propriedade na requisição
 * ---------------------------------------------------------------------------
 *
 * Acrescentar campo ao objeto do adaptador HTTP exige aumentar o tipo dele globalmente, e o campo
 * passa a existir para todo código que toque uma requisição — inclusive o que não deveria escrevê-lo.
 * O `WeakMap` mantém a associação fora do objeto, publica exatamente duas operações, e libera a
 * entrada quando a requisição é coletada.
 */

import type { FastifyRequest } from 'fastify';

/**
 * Rótulo por requisição. Chaveado pelo próprio objeto da requisição — sem identificador sintético,
 * que precisaria ser gerado, propagado e limpo.
 */
const ROTULOS = new WeakMap<FastifyRequest, string>();

/**
 * Define o rótulo desta requisição para o journal.
 *
 * Quem chama é o produtor que conhece a rota real por trás de um manipulador curinga — hoje, só
 * `autenticacao/autenticacao.controller.ts`. O valor DEVE ser um padrão de rota, nunca um caminho
 * concreto: ver o cabeçalho deste arquivo.
 */
export function definirRotuloDeRota(requisicao: FastifyRequest, rotulo: string): void {
  ROTULOS.set(requisicao, rotulo);
}

/** O rótulo desta requisição, ou `undefined` quando ninguém o definiu. */
export function rotuloDeRota(requisicao: FastifyRequest): string | undefined {
  return ROTULOS.get(requisicao);
}
