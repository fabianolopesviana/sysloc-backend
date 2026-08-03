/**
 * A marca de exceção da guarda de contexto — **a única forma de uma rota dispensar sessão**.
 *
 * ---------------------------------------------------------------------------
 * Por que a exceção mora no controlador, e não numa lista
 * ---------------------------------------------------------------------------
 *
 * A alternativa óbvia — uma lista de caminhos liberados, mantida dentro da guarda — é a topologia
 * que este repositório já pagou para aprender a evitar (`.claude/rules/nao-regressao.md` §7):
 * propriedade instalada **por ponto**, num arquivo distante daquele em que a tentação acontece.
 * Quem publica uma rota nova edita o controlador; quem esquece de editar a lista descobre o
 * esquecimento em produção, e o modo de falha é **superfície aberta**, que é silencioso.
 *
 * Com a marca no próprio controlador, o default é o oposto: **rota nova nasce protegida por
 * omissão**, e o esquecimento produz `401`. A §11.1 da tech spec fixa exatamente isso — *"o default
 * importa"*.
 *
 * ---------------------------------------------------------------------------
 * O que a marca NÃO significa
 * ---------------------------------------------------------------------------
 *
 * Ela diz *"a guarda de contexto não exige sessão aqui"*, e **nada além disso**. Não diz que a rota
 * é anônima: a superfície de identidade (`/v1/auth/*`) é marcada porque a entrada precisa acontecer
 * antes de existir sessão, e as rotas dela que exigem sessão continuam exigindo — quem as recusa é
 * o próprio arcabouço, com o vocabulário dele. A distinção é observável e está afirmada no
 * inventário de `test/contexto.e2e.spec.ts`: uma rota marcada pública responde `401` com
 * `CREDENCIAL_INVALIDA` (recusa do arcabouço), nunca com `NAO_AUTENTICADO` (recusa da guarda).
 *
 * Ela também **não** publica contexto de tenant: numa rota marcada, `contextoDeTenant.corrente()` é
 * indefinido, e a unidade de trabalho resolve isso como leitura vazia — o mesmo modo do Sysloc
 * Master, sem ramo condicional (`packages/db/src/unidade-de-trabalho.ts`).
 */

import { type CustomDecorator, SetMetadata } from '@nestjs/common';

/**
 * Chave do metadado que a guarda lê.
 *
 * Símbolo, e não cadeia de caracteres, pela mesma razão dos tokens de injeção da composição raiz:
 * colisão com o metadado de outra biblioteca deixa de ser possível. O valor gravado é `true`, e a
 * guarda o lê por presença — nunca há um `@RotaPublica(false)` a interpretar.
 */
export const ROTA_PUBLICA = Symbol('RotaPublica');

/**
 * Marca um controlador — ou um manipulador — como exceção explícita da guarda de contexto.
 *
 * Aplicada na **classe**, vale para todos os manipuladores dela; aplicada no método, vale só para
 * ele. As duas formas são lidas pela guarda com a mesma consulta (`getAllAndOverride`), de modo que
 * a granularidade é escolha de quem publica a rota, e não do mecanismo.
 */
export const RotaPublica = (): CustomDecorator<symbol> => SetMetadata(ROTA_PUBLICA, true);
