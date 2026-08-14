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
 *
 * ---------------------------------------------------------------------------
 * Ele IMPORTA `CobrancasModule` porque a ativação garante o contador da COBRANÇA
 * ---------------------------------------------------------------------------
 *
 * A partir da F3 a ativação gera as parcelas do contrato, e a primeira das duas unidades de trabalho
 * dela precisa garantir o contador da série da cobrança. Quem sabe fazê-lo — e, o que importa mais,
 * quem sabe de **qual relógio** o ano daquela série sai — é `CobrancaService.garantirSerie`, que já
 * existe. O módulo é importado para **consumir** esse símbolo, e não para recriá-lo: uma segunda
 * garantia escrita nesta superfície seria a segunda fonte do mesmo fato, com liberdade para escolher o
 * eixo de data errado, que é exatamente o débito **D7 (F3/T4)** que a T5 fechou.
 *
 * **Importar o módulo, e não prover o serviço aqui**, é a mesma decisão do parágrafo de cima: dois
 * `providers` do mesmo serviço são duas instâncias, e a superfície de cobrança teria dois donos. O
 * `CobrancasModule` o exporta por isso.
 *
 * Ele **não** publica rota de cobrança nem toca a área de tela dela: `TELA:financeiro` continua
 * governando `/v1/cobrancas`, e esta superfície continua exigindo `TELA:contratos`. O que atravessa a
 * fronteira é uma garantia de contador, não autorização.
 *
 * ---------------------------------------------------------------------------
 * É AQUI que o motor de renderização do documento é ESCOLHIDO (ADR-0025)
 * ---------------------------------------------------------------------------
 *
 * A partir da T7 da fatia `documentos-e-confirmacao`, este módulo compõe `criarRenderizadorPdf()` e
 * o entrega ao serviço pelo token `TOKEN_PORTA_DE_RENDERIZACAO`. **Quem monta o processo escolhe o
 * adaptador**: nem o serviço, nem o controlador, nem a composição do documento sabem que existe um
 * motor de PDF — o que eles conhecem é a `PortaDeRenderizacao`, que o **domínio** declara e o
 * adaptador satisfaz.
 *
 * É o mesmo desenho, e a mesma razão, de `automacao/automacao.module.ts` compor o adaptador de SMTP
 * atrás de `TOKEN_PORTA_DE_EMAIL`. A alternativa — o serviço importar `criarRenderizadorPdf`
 * diretamente — faria a regra de domínio depender do motor e daria ao processo um **segundo** lugar
 * onde escolhê-lo.
 *
 * A fábrica **não recebe nada do ambiente**, e a ausência é fato do adaptador, não omissão daqui:
 * o custo de partida do motor (React e o reconciliador) é do carregamento do módulo, uma vez por
 * processo, e não há coordenada, credencial ou destino a configurar. Por isso ela entra como
 * `useFactory` sem `inject`, e não como `useValue`: `useValue` construiria o adaptador no momento em
 * que **este arquivo** fosse carregado, e não quando o contêiner monta o módulo.
 */

import { Module } from '@nestjs/common';
import { criarRenderizadorPdf, type PortaDeRenderizacao } from '@sysloc/documentos';
import { AutenticacaoModule } from '../autenticacao/autenticacao.module.js';
import { CobrancasModule } from '../cobrancas/cobrancas.module.js';
import { TOKEN_PORTA_DE_RENDERIZACAO } from '../configuracao/ambiente.js';
import { ContratoController } from './contrato.controller.js';
import { ContratoService } from './contrato.service.js';

/**
 * Constrói a porta de renderização de produção — o adaptador sobre `@react-pdf/renderer`.
 *
 * Ela é o **único** ponto da composição que nomeia o motor, e não há bandeira, variável de ambiente
 * ou ramo `if (ehTeste)` no meio: a verificação exercita este mesmo adaptador, porque os bytes do
 * documento são a coisa sob prova e dublar o renderizador seria dublar exatamente o que se quer
 * medir.
 */
function criarPortaDeRenderizacao(): PortaDeRenderizacao {
  return criarRenderizadorPdf();
}

@Module({
  imports: [AutenticacaoModule, CobrancasModule],
  controllers: [ContratoController],
  providers: [
    ContratoService,
    {
      provide: TOKEN_PORTA_DE_RENDERIZACAO,
      useFactory: criarPortaDeRenderizacao,
    },
  ],
})
export class ContratosModule {}
