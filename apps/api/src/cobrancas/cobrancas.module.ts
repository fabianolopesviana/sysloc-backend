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
 *
 * ---------------------------------------------------------------------------
 * Ele EXPORTA `CobrancaService`, e o consumidor é a ativação do contrato (T9)
 * ---------------------------------------------------------------------------
 *
 * A ativação abre duas unidades de trabalho sequenciais, e a primeira garante o contador da série da
 * **cobrança** — `CobrancaService.garantirSerie`, que é quem sabe de qual relógio o ano daquela série
 * sai. Exportar é o que permite a `ContratosModule` **consumir** o símbolo em vez de recriá-lo; provê-lo
 * lá também daria duas instâncias e dois donos da mesma regra.
 *
 * O que a exportação **não** move é autorização: `TELA:financeiro` continua governando as cinco rotas
 * desta superfície, e nada da exigência declarada aqui alcança quem importa o módulo.
 */

import { Module } from '@nestjs/common';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { CobrancaController } from './cobranca.controller.js';
import { CobrancaService } from './cobranca.service.js';

@Module({
  imports: [AutenticacaoModule],
  controllers: [CobrancaController],
  providers: [CobrancaService],
  exports: [CobrancaService],
})
export class CobrancasModule {}
