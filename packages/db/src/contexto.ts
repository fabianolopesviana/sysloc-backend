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
 * `executarCom` é do lado de quem **estabelece** o contexto; `corrente` é do lado de quem
 * **consome**: a unidade de trabalho. Um símbolo único que fizesse as duas coisas convidaria
 * qualquer camada intermediária a reescrever o contexto no meio do caminho — que é exatamente o
 * caminho pelo qual a empresa da sessão deixaria de ser a empresa da transação.
 *
 * ---------------------------------------------------------------------------
 * O escritor é único POR BORDA — e as bordas são duas (ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * Até a fatia `regua-de-cobranca` havia **um** chamador legítimo, e este cabeçalho o nomeava como
 * *"a guarda de contexto de `apps/api`"*. A **ADR-0024** acrescenta o segundo, e a emenda é exigida
 * por ela mesma, no `Cons`: sem esta linha, o próximo leitor trataria a borda nova como violação.
 *
 * Os dois, e a razão de cada um:
 *
 * 1. **A borda HTTP** — `apps/api/src/autenticacao/contexto.guard.ts`, que deriva a empresa da
 *    **sessão autenticada**, uma vez por requisição.
 * 2. **A borda do trabalho enfileirado** — `apps/worker/src/tarefas/regua.ts`, que a deriva da
 *    **carga do próprio trabalho**, uma vez por tarefa. Fora do ciclo de uma requisição não existe
 *    sessão, e a ADR-0024 declara que a origem legítima passa a ser a carga — cujo identificador é
 *    produzido por quem já detinha direito a ele, e **nunca aceito de fonte externa**. As duas
 *    saídas alternativas estão descartadas por nome naquela ADR: a **sessão de serviço sintética**
 *    (credencial de longa duração, ato de auditoria atribuído a um usuário que não existe) e o
 *    **papel de banco sem RLS** (contorna o isolamento em vez de usá-lo).
 *
 * O que **não** mudou é o que importa: continua sendo **um escritor por borda**, e nada abaixo de
 * uma borda reescreve o contexto. O conjunto é auditado por igualdade — `CT-014`
 * (`test/unidade-de-trabalho.spec.ts`) e `CT-624` (`test/fonte-unica-do-estado.spec.ts`) —, de modo
 * que um terceiro chamador reprova nomeando o arquivo.
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
 * Consumidores legítimos: **um por borda** — a guarda de contexto de `apps/api`, uma vez por
 * requisição, com o valor derivado da sessão; e a borda do trabalho enfileirado de `apps/worker`,
 * uma vez por tarefa, com o valor derivado da carga (ADR-0024). Ver o cabeçalho deste módulo. O
 * contexto vale para toda a cadeia assíncrona iniciada aqui dentro e some quando ela termina, o que
 * é o que impede uma requisição — ou uma tarefa — de herdar o contexto de outra.
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
