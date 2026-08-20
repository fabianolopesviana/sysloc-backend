/**
 * Composição raiz do serviço de aplicação.
 *
 * ---------------------------------------------------------------------------
 * O que nasce aqui, e por que aqui
 * ---------------------------------------------------------------------------
 *
 * Três decisões do processo inteiro vivem neste módulo, e não no ponto de entrada:
 *
 *   1. **A configuração** é lida e validada na construção do módulo. Configuração incompleta faz
 *      a criação da aplicação falhar — antes de qualquer porta ser aberta.
 *   2. **O registrador estruturado** é criado uma vez, com a severidade que a configuração fixa.
 *   3. **O filtro global de erro** é registrado por `APP_FILTER`. Montá-lo no ponto de entrada
 *      faria a verificação ter de repetir o registro para provar a ADR-0012 — e um dia repetir
 *      diferente. Aqui, toda aplicação criada a partir deste módulo nasce com ele.
 *   4. **A guarda de contexto** é registrada por `APP_GUARD` **e** por `APP_INTERCEPTOR`, pela
 *      mesma razão do item anterior e mais uma: é o registro global que faz o default ser
 *      **fechado**. Rota nova nasce protegida por omissão, e a exceção é explícita no controlador
 *      (`@RotaPublica()`) — o esquecimento produz `401`, nunca superfície aberta (§11.1 da tech
 *      spec).
 *
 * O módulo é **global**: a configuração e o registrador são infraestrutura de processo, e exigir
 * que cada módulo novo os importe só produziria uma lista para manter em dia.
 *
 * ---------------------------------------------------------------------------
 * Duas entradas, UMA instância de guarda
 * ---------------------------------------------------------------------------
 *
 * `useExisting`, e não `useClass`: as duas metades da guarda — decidir e publicar o contexto —
 * precisam ser o **mesmo objeto**, porque a segunda lê o que a primeira resolveu. `useClass` daria
 * duas instâncias, cada uma com a própria reserva de conexões, e a metade que publica encontraria
 * sempre uma sessão ausente. A razão de existirem duas metades está por extenso em
 * `autenticacao/contexto.guard.ts`; em resumo: uma guarda não tem continuação a envolver, e
 * `AsyncLocalStorage.run` só existe envolvendo uma.
 */

import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { criarLogger, type Logger } from '@sysloc/shared';
import { AutenticacaoModule } from './autenticacao/autenticacao.module.js';
import { GuardaDeContexto } from './autenticacao/contexto.guard.js';
import { AutomacaoModule } from './automacao/automacao.module.js';
import { CadastrosModule } from './cadastros/cadastros.module.js';
import { CobrancaBancariaModule } from './cobranca-bancaria/cobranca-bancaria.module.js';
import { CobrancasModule } from './cobrancas/cobrancas.module.js';
import { FiltroExcecaoGlobal } from './comum/filtro-excecao.js';
import {
  type Ambiente,
  carregarAmbiente,
  TOKEN_AMBIENTE,
  TOKEN_LOGGER,
} from './configuracao/ambiente.js';
import { ConfirmacoesModule } from './confirmacoes/confirmacoes.module.js';
import { ContratosModule } from './contratos/contratos.module.js';
import { ImoveisModule } from './imoveis/imoveis.module.js';
import { IntegracoesBancariasModule } from './integracoes-bancarias/integracoes-bancarias.module.js';
import { MasterModule } from './master/master.module.js';
import { MoraModule } from './mora/mora.module.js';
import { NotificacoesBancariasModule } from './notificacoes-bancarias/notificacoes-bancarias.module.js';
import { SaudeModule } from './saude/saude.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Global()
@Module({
  imports: [
    SaudeModule,
    AutenticacaoModule,
    MasterModule,
    UsuariosModule,
    ImoveisModule,
    CadastrosModule,
    ContratosModule,
    CobrancasModule,
    CobrancaBancariaModule,
    MoraModule,
    AutomacaoModule,
    IntegracoesBancariasModule,
    // AS DUAS superfícies de negócio sem sessão do produto, e cada uma tem a ADR que a autoriza:
    //
    //   * `ConfirmacoesModule` — o **ato do titular do dado** (ADR-0027): o locatário confirma o
    //     próprio endereço, apresentando um portador de segredo de uso único;
    //   * `NotificacoesBancariasModule` — a **entrada de fato de terceiro** (ADR-0035): o provedor
    //     bancário envia uma notícia, sem ser usuário do sistema, sem portador e sem ser titular de
    //     dado algum. É por não haver titular nem portador que a ADR-0027 **não** a alcança.
    //
    // Os dois são registrados aqui como qualquer outro módulo, e é isso que importa: a dispensa não
    // vem de um caminho de composição próprio, vem de `@RotaPublica()` no manipulador — de modo que
    // a guarda global continua correndo para eles, e o inventário de rotas públicas continua sendo a
    // única lista onde eles aparecem.
    ConfirmacoesModule,
    NotificacoesBancariasModule,
  ],
  providers: [
    {
      provide: TOKEN_AMBIENTE,
      // O ambiente do processo é lido aqui, e em nenhum outro lugar do serviço: quem precisa de
      // configuração a recebe por injeção, com os tipos já convertidos e validados.
      useFactory: (): Ambiente => carregarAmbiente(process.env),
    },
    {
      provide: TOKEN_LOGGER,
      useFactory: (ambiente: Ambiente): Logger => criarLogger({ nivel: ambiente.nivelDeLog }),
      inject: [TOKEN_AMBIENTE],
    },
    {
      provide: APP_FILTER,
      useClass: FiltroExcecaoGlobal,
    },
    {
      provide: APP_GUARD,
      useExisting: GuardaDeContexto,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: GuardaDeContexto,
    },
  ],
  exports: [TOKEN_AMBIENTE, TOKEN_LOGGER],
})
export class AppModule {}
