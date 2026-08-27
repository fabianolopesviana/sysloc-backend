/**
 * O esquema OpenAPI do envelope de erro da ADR-0012 — declaração única da borda.
 *
 * ## Por que existe
 *
 * A forma do envelope é canônica por decisão (ADR-0012): `{ codigo, mensagem, campo?, detalhes? }`,
 * quatro campos e nada mais, com `codigo` de enum fechado. Em tempo de EXECUÇÃO essa forma já tinha
 * fonte única — `apps/api/src/comum/filtro-excecao.ts`, que monta toda resposta de erro. No
 * DOCUMENTO, não tinha: três controladores nascidos em três tasks distintas (T7, T8 e T9)
 * escreveram, cada um, uma cópia byte a byte da mesma função, porque cada executor partiu do
 * controlador anterior e não havia lugar de onde importar.
 *
 * As três concordavam. O risco era de congelamento: a superfície da API fecha no marco de entrega e
 * o `@syslocbr/contracts` nasce dela, de modo que a partir dali cada ajuste no envelope teria cinco
 * pontos para acertar e **nenhum mecanismo que acusasse a divergência** — e o que diverge primeiro
 * neste molde é o campo padrão e a escolha entre `issues[0].path` e o caminho completo, isto é, a
 * forma da recusa que o cliente vê. É o débito **D40** da §2 do run-report da fatia
 * `autorizacao-e-ciclo-de-acesso`, e é a mesma classe de defeito que a ADR-0012 existe para fechar,
 * só que na **definição** em vez de na forma.
 *
 * ## O que este módulo NÃO alcança, e por quê
 *
 * As constantes `ESQUEMA_DO_ERRO` de `autenticacao/sessao.controller.ts` e de
 * `saude/saude.controller.ts` **continuam onde estão**, e isso é decisão, não esquecimento. Elas têm
 * papel parecido e forma DIFERENTE: declaram apenas `codigo` e `mensagem`, sem `campo` nem
 * `detalhes`, porque as rotas delas não produzem recusa de campo. Trocá-las por esta função
 * acrescentaria dois campos opcionais ao documento publicado daquelas rotas — mudança de superfície
 * numa superfície que congela, para ganhar coerência de definição. O ganho não paga o preço.
 */

import type { CodigoErro } from '@sysloc/shared';

/**
 * Monta o esquema do envelope de erro para o conjunto de códigos que a rota pode devolver.
 *
 * `codigo` é enumerado com os códigos passados — é o que faz o documento dizer QUAIS recusas aquela
 * rota produz, em vez de anunciar o enum inteiro. `campo` e `detalhes` são declarados sempre, e
 * opcionais sempre: a ADR-0012 os define como presentes conforme a natureza da recusa, e `required`
 * lista só os dois que toda recusa carrega.
 *
 * @param codigos Os códigos que a rota pode devolver, na ordem em que devem aparecer no documento.
 */
export function esquemaDoErro(codigos: readonly CodigoErro[]): Record<string, unknown> {
  return {
    type: 'object',
    required: ['codigo', 'mensagem'],
    properties: {
      codigo: { type: 'string', enum: [...codigos] },
      mensagem: { type: 'string' },
      campo: { type: 'string' },
      detalhes: { type: 'object' },
    },
  };
}
