/**
 * Módulo do contrato de locação — hoje as seis rotas de cadastro de `/v1/contratos`.
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
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com a
 * mesma razão, que `imoveis/imoveis.module.ts` e `cadastros/cadastros.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão do módulo de imóveis
 * ---------------------------------------------------------------------------
 *
 * Contrato não é o mesmo agregado que conjunto, imóvel e cômodo: aqueles três são uma composição — o
 * cômodo não tem representação própria na API e volta dentro do imóvel —, enquanto o contrato tem
 * ciclo de vida próprio, chave exposta própria (o código legível) e área de tela própria
 * (`TELA:contratos`, contra `TELA:imoveis`). Pendurá-lo no módulo de imóveis reuniria duas superfícies
 * governadas por chaves diferentes sob um registro só.
 *
 * As duas transições de estado (T7 e T8) e a rota de situação de locação do imóvel (T10) entram
 * **aqui** e no módulo de imóveis, respectivamente, cada uma sob o dono do segmento que ela publica.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { ContratoController } from './contrato.controller.js';
import { ContratoService } from './contrato.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [ContratoController],
  providers: [ContratoService],
})
export class ContratosModule {}
