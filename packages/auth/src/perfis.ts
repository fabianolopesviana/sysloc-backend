/**
 * Os três perfis, como união fechada.
 *
 * O conjunto é **derivado do schema**, e não redigitado: `identidade.perfil_usuario` já é a fonte
 * de verdade, e uma segunda lista escrita à mão teria de ser mantida em sincronia com ela por
 * disciplina — que é exatamente o tipo de dependência que este projeto substitui por estrutura.
 * Assim, acrescentar um perfil no banco quebra a compilação de quem trata os casos aqui, em vez de
 * produzir um valor que ninguém previu.
 *
 * Nesta fatia o perfil é **apenas rótulo de identidade** (RN-13): nenhuma decisão de permissão é
 * tomada a partir dele. A matriz de telas e ações é da fatia `autorizacao-e-ciclo-de-acesso`.
 */

import { esquemaIdentidade } from '@sysloc/db';

/** Os valores literais que a API publica, na ordem em que o schema os declara. */
export const PERFIS = esquemaIdentidade.perfilUsuario.enumValues;

/** União fechada dos três perfis. */
export type Perfil = (typeof PERFIS)[number];
