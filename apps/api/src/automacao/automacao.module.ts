/**
 * Módulo da automação de cobrança — as **cinco** rotas da área, e o dono da porta de saída de
 * e-mail deste processo.
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA o módulo de identidade em vez de abrir acesso próprio
 * ---------------------------------------------------------------------------
 *
 * O controlador precisa de uma coisa que já existe no processo: a unidade de trabalho
 * (`TOKEN_ACESSO_AO_NEGOCIO`). Ela nasce em `AutenticacaoModule`, que é quem a abre e — o que
 * importa mais — quem a **encerra** no desligamento (`onApplicationShutdown`).
 *
 * Abrir aqui um segundo `abrirAcessoAoBanco` seria a saída mais curta e a errada: duas reservas de
 * conexões para o mesmo papel, duas donas do mesmo recurso, e um desligamento que só devolve parte
 * delas. Importar o módulo é o que mantém **uma** instância, com dono único — é a mesma decisão, com
 * a mesma razão, que `mora/mora.module.ts`, `cobrancas/cobrancas.module.ts` e
 * `contratos/contratos.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e não uma extensão do módulo de cobranças
 * ---------------------------------------------------------------------------
 *
 * A régua age sobre cobranças, mas não é parte do agregado delas: a política é singular por empresa,
 * não tem série nem ciclo de vida, e — o que decide — tem **área de tela própria**,
 * `TELA:automacao_de_cobranca`, contra `TELA:financeiro` das cobranças. Pendurá-la no módulo de
 * cobranças reuniria duas superfícies governadas por chaves diferentes sob um registro só, e a
 * separação por área é justamente o que permite ao Admin conceder a carteira do Financeiro sem
 * conceder o poder de mudar a régua que dispara os avisos — e vice-versa.
 *
 * É a mesma divisão que `mora/mora.module.ts` registrou para a política de mora, e a razão é
 * idêntica.
 *
 * ---------------------------------------------------------------------------
 * Ele é a COMPOSIÇÃO que constrói o adaptador de produção (T10 · CA-17)
 * ---------------------------------------------------------------------------
 *
 * O disparo manual envia de dentro deste processo, e é aqui — e em nenhum outro ponto da `api` — que
 * a porta de saída é escolhida. A escolha é **estrutural, e não configuração**: quem monta o processo
 * constrói {@link criarAdaptadorSmtp} a partir das duas variáveis que a partida já exigiu, e a
 * verificação troca o **provedor inteiro** por `overrideProvider(TOKEN_PORTA_DE_EMAIL)`, entregando o
 * capturador pela mesma interface. Não há bandeira de ambiente, não há `if (ehTeste)` e
 * `criarAplicacao()` não ganha parâmetro — as três alternativas estão recusadas por escrito no
 * cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de `TOKEN_PORTA_DE_EMAIL`.
 *
 * A construção mora **dentro do corpo da fábrica**, e a posição é asserida: `packages/db/test/
 * barreira-de-envio.spec.ts` (`CT-626 (e)`) declara este arquivo e o nome da fábrica em
 * `COMPOSICOES_QUE_CONSTROEM_O_ADAPTADOR` e reprova se a chamada escapar para o escopo de módulo —
 * onde o simples `import` deste arquivo por uma suíte construiria o transporte de produção.
 *
 * ⚠️ **O provedor é do módulo, e não global**: ele fica fora de qualquer `exports`, de modo que a
 * única superfície que alcança a porta de e-mail é a desta área. Publicá-lo daria a todo controlador
 * do produto a capacidade de mandar mensagem para a caixa de uma pessoa, que é a capacidade que este
 * arquivo existe para conter.
 */

import { Module } from '@nestjs/common';
import { criarAdaptadorSmtp, type PortaDeEnvioDeEmail } from '@sysloc/regua';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { type Ambiente, TOKEN_AMBIENTE, TOKEN_PORTA_DE_EMAIL } from '../configuracao/ambiente.js';
import { AutomacaoDeCobrancaController } from './automacao.controller.js';
import { AutomacaoDeCobrancaService } from './automacao.service.js';

/**
 * Constrói a porta de saída de produção a partir do ambiente **já validado** na partida.
 *
 * Ela recebe valores e não lê `process.env`: quem lê o ambiente é `carregarAmbiente`, num ponto só, e
 * um segundo leitor escaparia da conferência de partida. O adaptador **recusa a construção** sem as
 * duas variáveis declaradas — é a última barreira, depois da recusa de partida —, e a recusa nomeia a
 * variável, nunca o valor.
 */
function criarPortaDeEmail(ambiente: Ambiente): PortaDeEnvioDeEmail {
  return criarAdaptadorSmtp({
    urlDoTransporte: ambiente.urlDoTransporte,
    remetente: ambiente.remetenteDoAviso,
  });
}

@Module({
  imports: [AutenticacaoModule],
  controllers: [AutomacaoDeCobrancaController],
  providers: [
    AutomacaoDeCobrancaService,
    {
      provide: TOKEN_PORTA_DE_EMAIL,
      useFactory: criarPortaDeEmail,
      inject: [TOKEN_AMBIENTE],
    },
  ],
})
export class AutomacaoModule {}
