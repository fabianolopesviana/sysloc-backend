/**
 * Módulo da confirmação de endereço de e-mail — a rota `@RotaPublica()` de `/v1/confirmacoes-de-email`.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O serviço precisa de uma coisa que já existe no processo: a unidade de trabalho
 * (`TOKEN_ACESSO_AO_NEGOCIO`). Ela nasce em `AutenticacaoModule`, que é quem a abre e — o que importa
 * mais — quem a **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAoBanco` seria a saída mais curta e a errada: duas reservas de
 * conexões para o mesmo papel, duas donas do mesmo recurso, e um desligamento que só devolve parte
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com
 * a mesma razão, que `mora/mora.module.ts`, `cobrancas/cobrancas.module.ts` e
 * `imoveis/imoveis.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão do módulo de cadastros
 * ---------------------------------------------------------------------------
 *
 * A confirmação age sobre o cadastro do locatário, mas **não pertence à superfície de cadastro**: as
 * dezenove rotas de lá exigem sessão e `TELA:cadastros`, e esta não exige sessão nenhuma. Pendurá-la
 * em `CadastrosModule` reuniria, sob um registro só, a superfície governada pela área e a **única**
 * exceção de segurança do produto — e a exceção ficaria a um decorador de distância de ser lida como
 * regra. A separação é o que faz a dispensa continuar sendo um arquivo que se lê inteiro.
 *
 * O recurso também é outro: o segmento é `/v1/confirmacoes-de-email`, sem `:id`, porque quem
 * apresenta o portador **não conhece** o identificador do locatário — nem deve conhecer. Quem resolve
 * o par (empresa, locatário) é o segredo, e mais nada (ADR-0017: o portador não é recurso exposto).
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { ConfirmacaoController } from './confirmacao.controller.js';
import { ConfirmacaoService } from './confirmacao.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [ConfirmacaoController],
  providers: [ConfirmacaoService],
})
export class ConfirmacoesModule {}
