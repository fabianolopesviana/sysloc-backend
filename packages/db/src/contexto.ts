/**
 * Contexto de tenant da requisição corrente — quem escreve e quem lê são símbolos diferentes.
 *
 * ---------------------------------------------------------------------------
 * Por que `AsyncLocalStorage`, e não um parâmetro
 * ---------------------------------------------------------------------------
 *
 * A ADR-0008 é literal: *"o contexto que a RLS consome é fixado por transação com `SET LOCAL`, e
 * sua origem nunca é o request"*. Um parâmetro `empresaId` atravessando as camadas seria a origem
 * errada duas vezes: ele pode ser esquecido numa chamada nova (e o esquecimento não quebra
 * compilação em nenhum ponto que o compilador consiga apontar), e pode ser forjado por quem montar
 * a chamada. O armazenamento por continuação torna o contexto **ambiente**: quem abre a unidade de
 * trabalho não escolhe a empresa, ele a herda de quem admitiu a requisição.
 *
 * ---------------------------------------------------------------------------
 * Escritor e leitor separados — a assimetria é o ponto
 * ---------------------------------------------------------------------------
 *
 * `executarCom` é do lado de quem **estabelece** o contexto: a guarda de contexto de `apps/api`,
 * que o deriva da sessão autenticada. `corrente` é do lado de quem **consome**: a unidade de
 * trabalho. Um símbolo único que fizesse as duas coisas convidaria qualquer camada intermediária a
 * reescrever o contexto no meio do caminho — que é exatamente o caminho pelo qual a empresa da
 * sessão deixaria de ser a empresa da transação.
 *
 * ---------------------------------------------------------------------------
 * Ausência de empresa é valor de domínio, não sentinela
 * ---------------------------------------------------------------------------
 *
 * O Sysloc Master não pertence a empresa alguma (§4.2 da tech spec: `empresaId` é nulo para ele), e
 * o tipo representa isso com `null` — não com cadeia vazia, não com um UUID reservado, não com um
 * `'MASTER'` mágico. A diferença é observável: um UUID reservado casaria a política e devolveria as
 * linhas de uma "empresa zero"; `null` não casa política nenhuma e devolve vazio, que é o
 * comportamento que a RN-04 exige.
 *
 * Note que **ausência de contexto** (ninguém chamou `executarCom`) e **contexto sem empresa**
 * (`empresaId` nulo) são estados distintos e ambos legítimos — o primeiro é o processo fora de uma
 * requisição, o segundo é o Master dentro de uma. Os dois terminam em leitura vazia, por caminhos
 * diferentes: ver `unidade-de-trabalho.ts`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A empresa da sessão corrente.
 *
 * `empresaId` nulo significa **sessão sem empresa** — o Sysloc Master. Não é "desconhecido" nem
 * "ainda não resolvido": é o valor que o domínio atribui a quem opera o SaaS de fora das empresas.
 */
export interface ContextoDeTenant {
  readonly empresaId: string | null;
}

const armazenamento = new AsyncLocalStorage<ContextoDeTenant>();

/**
 * Executa `trabalho` com o contexto informado — o **escritor**.
 *
 * Consumidor legítimo: a guarda de contexto de `apps/api`, uma vez por requisição, com o valor
 * derivado da sessão. O contexto vale para toda a cadeia assíncrona iniciada aqui dentro e some
 * quando ela termina, o que é o que impede uma requisição de herdar o contexto de outra.
 */
export function executarCom<T>(contexto: ContextoDeTenant, trabalho: () => T): T {
  return armazenamento.run(contexto, trabalho);
}

/**
 * O contexto da cadeia assíncrona corrente, ou `undefined` fora de qualquer uma — o **leitor**.
 *
 * Consumidor legítimo: a unidade de trabalho. `undefined` não é erro: é o processo operando fora de
 * uma requisição, e a unidade de trabalho o resolve fixando nada, o que a política lê como nulo.
 */
export function corrente(): ContextoDeTenant | undefined {
  return armazenamento.getStore();
}
