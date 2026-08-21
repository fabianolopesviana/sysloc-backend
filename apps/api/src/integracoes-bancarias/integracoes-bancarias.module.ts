/**
 * Módulo das **integrações bancárias** — as rotas de registro e consulta do certificado do provedor.
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
 * a mesma razão, que `automacao/automacao.module.ts`, `mora/mora.module.ts` e
 * `contratos/contratos.module.ts` registram.
 *
 * ---------------------------------------------------------------------------
 * Ele é módulo PRÓPRIO, e a área é o que decide
 * ---------------------------------------------------------------------------
 *
 * O certificado serve à cobrança, mas não é parte do agregado dela: ele não tem série, não tem
 * ciclo de vida governado por transição e — o que decide — tem **área de tela própria**,
 * `TELA:integracoes_bancarias`, contra `TELA:financeiro` das cobranças. Pendurá-lo no módulo de
 * cobranças reuniria duas superfícies governadas por chaves diferentes sob um registro só, e a
 * separação por área é justamente o que permite ao Admin conceder a carteira do Financeiro sem
 * conceder o poder de trocar a identidade com que a empresa cobra — e vice-versa.
 *
 * ---------------------------------------------------------------------------
 * Ele é a COMPOSIÇÃO que constrói o adaptador do provedor (T12 · CA-07)
 * ---------------------------------------------------------------------------
 *
 * A T11 registrou aqui, por escrito, que **nenhum** provedor para
 * `TOKEN_PORTA_DE_IDENTIDADE_BANCARIA` nascia ainda, porque construir o adaptador antes de haver quem
 * o chamasse faria toda aplicação montada criar um cliente de provedor bancário sem consumidor. A rota
 * de verificação chegou, e com ela o consumidor: é **aqui, e em nenhum outro ponto da `api`**, que a
 * porta de identidade é escolhida.
 *
 * A escolha é **estrutural, e não configuração**: quem monta o processo constrói
 * {@link criarAdaptadorSicoob} a partir do endereço que a partida já exigiu e conferiu, e a
 * verificação troca o **provedor inteiro** por `overrideProvider(TOKEN_PORTA_DE_IDENTIDADE_BANCARIA)`,
 * entregando pela mesma interface um adaptador apontado para um par TLS do laço local. Não há bandeira
 * de ambiente, não há `if (ehTeste)` e `criarAplicacao()` não ganha parâmetro — as três alternativas
 * estão recusadas por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts` e no docblock de
 * `TOKEN_PORTA_DE_EMAIL`, e a razão vale igual aqui: uma opção de composição que só a suíte passasse
 * seria símbolo de produção a serviço do teste, e uma bandeira seria um segundo caminho para escolher
 * o adaptador.
 *
 * A construção mora **dentro do corpo da fábrica**, como em `automacao/automacao.module.ts`, e a
 * posição é conteúdo: no escopo de módulo, o simples `import` deste arquivo por uma suíte construiria
 * o cliente do provedor — e, com endereço malformado, **derrubaria a importação** em vez de recusar a
 * resolução do provedor, porque {@link criarAdaptadorSicoob} falha fechado na construção.
 *
 * ⚠️ **O provedor é do módulo, e não global**: ele fica fora de qualquer `exports`, de modo que a
 * única superfície que alcança a porta de identidade é a desta área. Publicá-lo daria a todo
 * controlador do produto a capacidade de abrir uma conexão mútua com o material decifrado de uma
 * empresa, que é precisamente a capacidade que este arquivo existe para conter.
 */

import { Module } from '@nestjs/common';
import { criarAdaptadorSicoob, type PortaDeIdentidadeBancaria } from '@sysloc/cobranca-bancaria';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import {
  type Ambiente,
  TOKEN_AMBIENTE,
  TOKEN_PORTA_DE_IDENTIDADE_BANCARIA,
} from '../configuracao/ambiente.js';
import { CertificadoDoProvedorController } from './certificado.controller.js';
import { CertificadoDoProvedorService } from './certificado.service.js';
import { IdentidadeNoProvedorController } from './identidade.controller.js';
import { IdentidadeNoProvedorService } from './identidade.service.js';

/**
 * Constrói a porta de identidade de produção a partir do ambiente **já validado** na partida.
 *
 * Ela recebe valor e não lê `process.env`: quem lê o ambiente é `carregarAmbiente`, num ponto só, e um
 * segundo leitor escaparia da conferência de partida — e, pior aqui do que em qualquer outra porta,
 * faria uma alteração do ambiente em execução mudar o destino de um processo já de pé. O adaptador
 * **recusa a construção** com endereço que não seja `https:` absoluta com servidor nomeado, e a recusa
 * nomeia a **variável**, jamais o valor.
 *
 * Nenhum teto de tempo e nenhuma credencial entram aqui: o teto é decisão do próprio adaptador
 * (`TETO_DO_APERTO_DE_MAO_MS`), e credencial de habilitação é da fatia (ii).
 */
function criarPortaDeIdentidade(ambiente: Ambiente): PortaDeIdentidadeBancaria {
  return criarAdaptadorSicoob({
    enderecoDoProvedor: ambiente.enderecoDoProvedorBancario,
    enderecoDeAutorizacao: ambiente.enderecoDeAutorizacaoBancaria,
  });
}

@Module({
  imports: [AutenticacaoModule],
  controllers: [CertificadoDoProvedorController, IdentidadeNoProvedorController],
  providers: [
    IdentidadeNoProvedorService,
    CertificadoDoProvedorService,
    {
      provide: TOKEN_PORTA_DE_IDENTIDADE_BANCARIA,
      useFactory: criarPortaDeIdentidade,
      inject: [TOKEN_AMBIENTE],
    },
  ],
})
export class IntegracoesBancariasModule {}
