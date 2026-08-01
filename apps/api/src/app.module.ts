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
 *      faria a verificação ter de repetir o registro para provar a ADR-0007 — e um dia repetir
 *      diferente. Aqui, toda aplicação criada a partir deste módulo nasce com ele.
 *
 * O módulo é **global**: a configuração e o registrador são infraestrutura de processo, e exigir
 * que cada módulo novo os importe só produziria uma lista para manter em dia.
 */

import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { criarLogger, type Logger } from '@sysloc/shared';
import { FiltroExcecaoGlobal } from './comum/filtro-excecao.js';
import {
  type Ambiente,
  carregarAmbiente,
  TOKEN_AMBIENTE,
  TOKEN_LOGGER,
} from './configuracao/ambiente.js';
import { SaudeModule } from './saude/saude.module.js';

@Global()
@Module({
  imports: [SaudeModule],
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
  ],
  exports: [TOKEN_AMBIENTE, TOKEN_LOGGER],
})
export class AppModule {}
