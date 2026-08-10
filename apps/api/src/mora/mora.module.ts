/**
 * Módulo da política de mora — as duas rotas de `/v1/multa-e-juros`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O controlador precisa de uma coisa que já existe no processo: a unidade de trabalho
 * (`TOKEN_ACESSO_AO_NEGOCIO`). Ela nasce em `AutenticacaoModule`, que é quem a abre e — o que importa
 * mais — quem a **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAoBanco` seria a saída mais curta e a errada: duas reservas de
 * conexões para o mesmo papel, duas donas do mesmo recurso, e um desligamento que só devolve parte
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com
 * a mesma razão, que `cobrancas/cobrancas.module.ts`, `contratos/contratos.module.ts` e
 * `imoveis/imoveis.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão do módulo de cobranças
 * ---------------------------------------------------------------------------
 *
 * A política de mora governa o que a cobrança apura, mas não é parte do agregado dela: ela é
 * singular por empresa, não tem série nem ciclo de vida, e — o que decide — tem **área de tela
 * própria**, `TELA:multa_e_juros`, contra `TELA:financeiro` das cobranças. Pendurá-la no módulo de
 * cobranças reuniria duas superfícies governadas por chaves diferentes sob um registro só, e a
 * separação por área é justamente o que permite ao Admin conceder a carteira do Financeiro sem
 * conceder o poder de mudar a política que ela cobra — e vice-versa.
 *
 * O cabeçalho de `cobrancas/cobrancas.module.ts` já registrava esta divisão por antecipação: *"as de
 * mora sob o dono do próprio segmento, que tem outra área"*.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { MoraController } from './mora.controller.js';
import { MoraService } from './mora.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [MoraController],
  providers: [MoraService],
})
export class MoraModule {}
