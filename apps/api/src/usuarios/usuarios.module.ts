/**
 * Módulo de administração de pessoas — as sete rotas de `/v1/usuarios`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O serviço precisa de três coisas que já existem no processo: a instância do arcabouço de
 * identidade, o acesso restrito a `identidade` (que as duas funções de onboarding de `@sysloc/auth`
 * exigem por assinatura) e a unidade de trabalho. As três nascem em `AutenticacaoModule`, que é quem
 * as abre e — o que importa mais — quem as **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAIdentidade` ou um segundo `abrirAcessoAoBanco` seria a saída
 * mais curta e a errada: duas reservas de conexões para o mesmo papel, duas donas do mesmo recurso, e
 * um desligamento que só devolve parte delas. Importar o módulo é o que mantém **uma** instância de
 * cada, com dono único — é a mesma decisão, com a mesma razão, que `master/master.module.ts`
 * registra, e o export dos dois tokens foi feito na T7 nomeando literalmente esta task.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { UsuarioController } from './usuario.controller.js';
import { UsuarioService } from './usuario.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [UsuarioController],
  providers: [UsuarioService],
})
export class UsuariosModule {}
