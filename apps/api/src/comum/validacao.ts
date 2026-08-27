/**
 * A tradução de recusa de esquema no envelope de erro — **ponto único da borda**.
 *
 * ## Por que existe, e por que num módulo só
 *
 * Toda rota desta superfície valida a entrada antes de qualquer consulta, e a recusa precisa sair
 * na forma canônica que a **ADR-0017** fixa: status HTTP semântico mais
 * `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de enum fechado. Um `safeParse` com
 * tratamento por manipulador colocaria **dezenas** de traduções livres para divergir no código, no
 * status e no campo nomeado — e a forma do erro é contrato, não detalhe de implementação.
 *
 * O ponto único já existia; o que não existia era **um** ponto. As três bordas nascidas em T7, T8 e
 * T9 escreveram, cada uma, uma cópia byte a byte desta função, porque cada executor partiu do
 * controlador anterior e não havia lugar de onde importar. As três concordavam, e o risco era de
 * congelamento: a superfície da API fecha no marco de entrega e o `@syslocbr/contracts` nasce dela, de
 * modo que a partir dali cada ajuste teria três pontos para acertar e **nenhum mecanismo que
 * acusasse a divergência** — e o que diverge primeiro neste molde é justamente o campo padrão e a
 * escolha entre `issues[0].path` e o caminho completo, isto é, a forma da recusa que o cliente vê.
 * É o débito **D38**, e este módulo é o fecho dele; a rede que impede a quarta cópia é o `CT-343` de
 * `apps/api/test/validacao.spec.ts`, que afirma por igualdade de conjunto que há **uma** definição e
 * **três** importadores.
 *
 * É o mesmo desenho, e a mesma razão, de {@link ./esquema-de-erro.js}, que fez pelo DOCUMENTO o que
 * este faz pela EXECUÇÃO.
 *
 * ## O que sai para o cliente, e o que nunca sai
 *
 * Sai o **campo culpado**, e nada do valor recusado: entrada não confiável repetida na mensagem
 * chega ao registro estruturado por outro caminho — é a razão pela qual a unidade de trabalho já
 * redige o identificador inválido em vez de ecoá-lo. O `ZodError` viaja como `causa`, que é
 * diagnóstico interno e **não** entra em `paraCorpo()` (a ADR-0017 fixa o corpo em quatro campos).
 */

import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { ZodType } from 'zod';
import { MENSAGEM_POR_CODIGO } from './filtro-excecao.js';

/**
 * Valida a entrada e traduz a recusa no envelope da ADR-0017.
 *
 * @param esquema  O esquema que decide. A transformação dele é **preservada**: o que volta é
 *                 `resultado.data`, e não o valor de entrada — uma normalização declarada no
 *                 esquema (caixa do UUID, minúscula do endereço) só existe porque este retorno a
 *                 carrega.
 * @param valor    O que chegou do cliente, sem confiança nenhuma.
 * @param campoPadrao Nome de campo usado quando a recusa **não tem caminho a nomear** — o caso do
 *                 escalar de rota (`id`) e o da chave desconhecida em objeto estrito, que o Zod
 *                 reporta com caminho vazio.
 */
export function validar<T>(esquema: ZodType<T>, valor: unknown, campoPadrao: string): T {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    return resultado.data;
  }

  const caminho = resultado.error.issues[0]?.path ?? [];

  throw new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    { campo: caminho.length > 0 ? caminho.join('.') : campoPadrao, causa: resultado.error },
  );
}
