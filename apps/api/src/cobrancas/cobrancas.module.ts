/**
 * Módulo da cobrança — hoje as três primeiras rotas de `/v1/cobrancas`.
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
 * a mesma razão, que `contratos/contratos.module.ts`, `imoveis/imoveis.module.ts` e
 * `cadastros/cadastros.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão do módulo de contratos
 * ---------------------------------------------------------------------------
 *
 * A cobrança nasce de um contrato, mas não é parte do agregado dele: ela tem ciclo de vida próprio,
 * chave exposta própria (o código da série `COB`), série própria no banco e **área de tela própria**
 * — `TELA:financeiro`, contra `TELA:contratos`. Pendurá-la no módulo de contratos reuniria duas
 * superfícies governadas por chaves diferentes sob um registro só, e a separação por área é o que
 * permite ao Admin conceder a carteira de contratos sem conceder o Financeiro, e vice-versa.
 *
 * As rotas de pagamento e de cancelamento (T7) e as da política de mora (T6) entram depois — as duas
 * primeiras **aqui**, e as de mora sob o dono do próprio segmento, que tem outra área.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { CobrancaController } from './cobranca.controller.js';
import { CobrancaService } from './cobranca.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [CobrancaController],
  providers: [CobrancaService],
})
export class CobrancasModule {}
