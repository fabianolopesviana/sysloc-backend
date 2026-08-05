/**
 * A **declaração de exigência** de uma rota — as duas dimensões da ADR-0011, mais a única abertura
 * deliberada.
 *
 * ---------------------------------------------------------------------------
 * Por que a declaração mora no controlador, e por que a AUSÊNCIA dela recusa
 * ---------------------------------------------------------------------------
 *
 * É o mesmo mecanismo de `@RotaPublica()` — metadado por reflexão, lido pela guarda com
 * `getAllAndOverride` —, e pela mesma razão escrita naquele arquivo: uma lista de rotas mantida
 * dentro da guarda é propriedade instalada **por ponto**, num arquivo distante daquele em que a
 * tentação acontece. Quem publica uma rota nova edita o controlador; quem esquece de editar a lista
 * descobre o esquecimento em produção, e o modo de falha é **superfície aberta**.
 *
 * A ADR-0011 fecha esse modo de falha por construção: *"a rota que não declara nada é recusada"*.
 * O default, portanto, não é "passa" nem "exige alguma coisa razoável" — é **`403`**. Rota nova
 * nasce recusando, e o esquecimento produz uma recusa barulhenta em vez de uma abertura silenciosa.
 * Não há terceiro estado: ou a rota declara uma das duas dimensões, ou declara explicitamente que
 * não exige permissão, ou não atende ninguém.
 *
 * ---------------------------------------------------------------------------
 * `@RotaPublica()` NÃO precisa (nem pode) declarar exigência
 * ---------------------------------------------------------------------------
 *
 * A guarda **retorna antes** para rota marcada pública — ela nem resolve sessão. A §5.1 da tech
 * spec registra isso literalmente: `@RotaPublica()` **é** a declaração daquela rota, e uma segunda
 * marca no mesmo manipulador nunca seria lida. Marcá-la aqui criaria um metadado morto que sugere
 * uma proteção inexistente.
 *
 * ---------------------------------------------------------------------------
 * A marca de "não exige" é o alvo de maior valor — e é por isso que ela é EXPLÍCITA
 * ---------------------------------------------------------------------------
 *
 * A própria ADR-0011 nomeia a contrapartida: *"a marca de 'não exige' é a única abertura
 * deliberada, e por isso vira o alvo de maior valor para qualquer defeito futuro — cada uso dela
 * pede revisão explícita"*. Ela é um **valor** de `Exigencia`, e não a ausência de um: quem a usa
 * escreve `@NaoExigePermissao()` no manipulador, o que aparece no diff e é grepável. Uma abertura
 * obtida por omissão não apareceria em lugar nenhum.
 *
 * Hoje ela vale para `GET /v1/sessao`: a rota que devolve **a própria sessão de quem pede** não tem
 * chave a exigir — exigir uma tornaria a leitura da própria identidade condicionada a uma
 * permissão de negócio, e a pessoa sem nenhuma chave deixaria de conseguir descobrir por quê.
 */

import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import type { ChaveDoCatalogo, Exigencia, Perfil } from '@sysloc/auth';

/**
 * Chave do metadado que a guarda lê.
 *
 * `Symbol`, e não cadeia de caracteres, pela mesma razão de `ROTA_PUBLICA` e dos tokens de injeção
 * da composição raiz: colisão com o metadado de outra biblioteca deixa de ser possível.
 *
 * O valor gravado é sempre uma {@link Exigencia} — inclusive no caso de "não exige", que é
 * {@link NAO_EXIGE}. **A ausência da chave é que é significativa**, e ela significa recusa.
 */
export const EXIGENCIA = Symbol('Exigencia');

/**
 * A marca de "esta rota legitimamente não exige permissão".
 *
 * Um valor congelado de {@link Exigencia}, e não um sentinela de outro tipo: assim a guarda passa
 * **toda** exigência declarada pela mesma função de decisão, sem um desvio próprio para este caso.
 * Existir um único lugar onde se responde "isto passa?" é o que o CT-216 afirma, e um desvio aqui
 * seria a segunda avaliação que ele reprova.
 */
export const NAO_EXIGE: Exigencia = Object.freeze({ dimensao: 'NENHUMA' } as const);

/**
 * Declara que a rota exige um **perfil** — a dimensão por onde o operador do SaaS alcança as rotas
 * dele.
 *
 * É esta dimensão, e não uma chave sintética no catálogo, que governa `/v1/master/*`: o catálogo é
 * declarado fechado nas 17 áreas e ações do app da imobiliária, e a ADR-0011 rejeita por escrito a
 * alternativa de inflá-lo — *"o catálogo deixaria de ser a matriz do produto e viraria um índice de
 * rotas"*.
 *
 * Aplicada na **classe**, vale para todos os manipuladores dela; aplicada no método, vale só para
 * ele. As duas formas são lidas pela guarda com a mesma consulta (`getAllAndOverride`), de modo que
 * a granularidade é escolha de quem publica a rota, e não do mecanismo.
 */
export const ExigePerfil = (perfil: Perfil): CustomDecorator<symbol> =>
  SetMetadata(EXIGENCIA, { dimensao: 'PERFIL', perfil } satisfies Exigencia);

/**
 * Declara que a rota exige uma **chave do catálogo** — a dimensão do app da imobiliária.
 *
 * O parâmetro é `ChaveDoCatalogo`, a união fechada das 17: uma chave inventada não compila, em vez
 * de virar uma exigência que ninguém jamais alcança e que ninguém nota até alguém reclamar de
 * `403`. É a mesma razão pela qual o catálogo é união de literais e não constante em tempo de
 * execução.
 */
export const ExigeChave = (chave: ChaveDoCatalogo): CustomDecorator<symbol> =>
  SetMetadata(EXIGENCIA, { dimensao: 'CHAVE', chave } satisfies Exigencia);

/**
 * Declara que a rota **não exige permissão** — a abertura deliberada, e a única.
 *
 * Ela não dispensa sessão: quem chega sem cookie continua recebendo `401` da guarda. O que ela diz
 * é que, tendo sessão válida, nenhuma chave e nenhum perfil são exigidos para prosseguir.
 */
export const NaoExigePermissao = (): CustomDecorator<symbol> => SetMetadata(EXIGENCIA, NAO_EXIGE);
