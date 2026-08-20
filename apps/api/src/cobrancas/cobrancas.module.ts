/**
 * Módulo da cobrança — as **sete** rotas de `/v1/cobrancas`.
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
 * O que a exportação **não** move é autorização: `TELA:financeiro` continua governando as rotas desta
 * superfície, e nada da exigência declarada aqui alcança quem importa o módulo.
 *
 * **EMENDA — T10 da fatia `webhook-e-carne` (2026-08-19).** O texto acima é preservado; o que segue
 * o estende. A exportação passou a ser de **três** serviços: `CobrancaService`, `BoletoService` e
 * `CarneService`. O consumidor concreto é `ContratoController`, que injeta o **carnê** para atender
 * `GET /v1/contratos/:codigo/carne` — e `CarneService` vive aqui, e não sob contratos, porque o que
 * ele compõe são **boletos de cobrança**: pendurá-lo lá o obrigaria a receber a porta do provedor e
 * a guarda dos bytes numa superfície governada por `TELA:contratos`.
 *
 * ⚠️ **`BoletoService` sai na lista por prescrição declarada da task e da §3.6 do tech spec**, e não
 * por necessidade de resolução: `CarneService` o injeta **de dentro** deste módulo, onde ele já é
 * provedor. A distinção fica escrita porque ela é o que um leitor futuro precisa para decidir se
 * pode retirá-lo: **hoje ele não tem consumidor fora daqui**, e retirá-lo não quebraria o carnê.
 * O que a exportação dele **não** faz é abrir a emissão a quem quer que seja — os dois provedores do
 * parágrafo abaixo (`TOKEN_PORTA_DE_COBRANCA_BANCARIA` e `TOKEN_GUARDA_DE_BOLETOS`) continuam
 * **fora** de `exports`, e a autorização de cada rota segue declarada na borda, sob a chave da área
 * dela.
 *
 * ---------------------------------------------------------------------------
 * Ele é a COMPOSIÇÃO que constrói o adaptador de cobrança e a guarda de bytes (T13)
 * ---------------------------------------------------------------------------
 *
 * É **aqui, e em nenhum outro ponto da `api`**, que a porta de cobrança bancária e a guarda de boletos
 * são escolhidas. A forma é a mesma, e a razão é a mesma, de
 * {@link ../integracoes-bancarias/integracoes-bancarias.module.ts}, que já compõe a porta de
 * **identidade**: quem monta o processo constrói a implementação a partir do ambiente já conferido, e
 * a verificação troca o **provedor inteiro** por `overrideProvider`, entregando pela mesma interface
 * um adaptador instrumentado. Não há bandeira de ambiente, não há `if (ehTeste)` e `criarAplicacao()`
 * não ganha parâmetro — as três alternativas estão recusadas por escrito no cabeçalho de
 * `packages/regua/src/adaptador-smtp.ts` e no docblock de `TOKEN_PORTA_DE_EMAIL`.
 *
 * ⚠️ **A §3.3 da T13 escreve `main.ts` como a casa desta composição, e a divergência é declarada e
 * medida.** O ponto de entrada deste produto **não constrói provedor nenhum**: ele monta o
 * `AppModule`, publica o contrato e escuta. Compor ali exigiria dar parâmetro a `criarAplicacao()` —
 * o seam que os docblocks dos tokens recusam nominalmente — e tiraria da suíte o
 * `overrideProvider`, que é como as três portas anteriores desta base são substituídas. O precedente
 * literal é a fatia (i), cuja §3.6 dizia o mesmo e cuja composição terminou no módulo da área. O que
 * a task pede — *"constrói o adaptador de cobrança e a guarda, e os injeta"* — está cumprido; o que
 * muda é **onde**, e a escolha é a que preserva o mecanismo de substituição.
 *
 * ⚠️ **Os dois provedores são do módulo, e não globais**: ficam fora de qualquer `exports`, de modo
 * que a única superfície que alcança a porta de cobrança é a desta área. Publicá-los daria a todo
 * controlador do produto a capacidade de emitir título em nome de uma empresa.
 *
 * **EMENDA — T10 (2026-08-19).** O parágrafo acima continua verdadeiro palavra por palavra, e o
 * provedor que a T10 acrescenta o respeita: `TOKEN_PORTA_DE_MESCLAGEM` é do módulo e **não** entra
 * em `exports`. Ele é a terceira porta desta composição e a mais inócua das três — não fala com
 * terceiro, não lê disco e não guarda estado —, mas a régua é a mesma, e abrir exceção para a porta
 * barata ensina a abri-la para a cara.
 *
 * A construção mora **dentro do corpo da fábrica**, e a posição é conteúdo: no escopo de módulo, o
 * simples `import` deste arquivo por uma suíte construiria o cliente do provedor — e, com endereço
 * malformado, **derrubaria a importação** em vez de recusar a resolução do provedor, porque
 * `criarAdaptadorSicoob` falha fechado na construção.
 */

import { Module } from '@nestjs/common';
import {
  type AdaptadorCobrancaBancaria,
  criarAdaptadorSicoob,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import { criarMescladorPdf } from '@sysloc/documentos';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import {
  type Ambiente,
  TOKEN_AMBIENTE,
  TOKEN_GUARDA_DE_BOLETOS,
  TOKEN_PORTA_DE_COBRANCA_BANCARIA,
  TOKEN_PORTA_DE_MESCLAGEM,
} from '../configuracao/ambiente.js';
import { BoletoService } from './boleto.service.js';
import { CarneService } from './carne.service.js';
import { CobrancaController } from './cobranca.controller.js';
import { CobrancaService } from './cobranca.service.js';

/**
 * Constrói a porta de cobrança de produção a partir do ambiente **já validado** na partida.
 *
 * Ela recebe valor e não lê `process.env`: quem lê o ambiente é `carregarAmbiente`, num ponto só, e um
 * segundo leitor escaparia da conferência de partida — e, pior aqui do que em qualquer outra porta,
 * faria uma alteração do ambiente em execução mudar o destino de um processo já de pé. O endereço é
 * resolvido **uma vez**, na construção, e o adaptador **recusa** o que não for `https:` absoluta com
 * servidor nomeado, nomeando a **variável** e jamais o valor (ADR-0032).
 *
 * Nenhum teto de tempo e nenhuma credencial entram aqui: o teto é decisão do próprio adaptador, e a
 * credencial de acesso é obtida **dentro** dele, por `client_credentials`, que é vocabulário do
 * provedor (emenda de 2026-08-17 da ADR-0001).
 */
function criarPortaDeCobranca(ambiente: Ambiente): AdaptadorCobrancaBancaria {
  return criarAdaptadorSicoob({ enderecoDoProvedor: ambiente.enderecoDoProvedorBancario });
}

/**
 * Constrói a guarda dos bytes do boleto sobre o diretório que a partida já conferiu.
 *
 * O diretório-base chega **por parâmetro** (ADR-0025): `@sysloc/cobranca-bancaria` não lê
 * `process.env`, e a guarda **não cria nem confere** o diretório — quem o exige presente, absoluto e
 * gravável é `carregarAmbiente`, e quem o provisiona com dono e modo é
 * `deploy/scripts/instalacao/provisionar-base.sh`.
 */
function criarGuardaDosBoletos(ambiente: Ambiente): GuardaDeBoletos {
  return criarGuardaDeBoletos(ambiente.diretorioDosBoletos);
}

@Module({
  imports: [AutenticacaoModule],
  controllers: [CobrancaController],
  providers: [
    CobrancaService,
    BoletoService,
    CarneService,
    {
      provide: TOKEN_PORTA_DE_COBRANCA_BANCARIA,
      useFactory: criarPortaDeCobranca,
      inject: [TOKEN_AMBIENTE],
    },
    {
      provide: TOKEN_GUARDA_DE_BOLETOS,
      useFactory: criarGuardaDosBoletos,
      inject: [TOKEN_AMBIENTE],
    },
    {
      provide: TOKEN_PORTA_DE_MESCLAGEM,
      // Sem `inject`, e a ausência é o contrato do adaptador: `criarMescladorPdf` não recebe
      // parâmetro nenhum — não há endereço, diretório nem credencial a resolver, porque a composição
      // acontece em memória e nada é armazenado (ADR-0030).
      useFactory: criarMescladorPdf,
    },
  ],
  exports: [CobrancaService, BoletoService, CarneService],
})
export class CobrancasModule {}
