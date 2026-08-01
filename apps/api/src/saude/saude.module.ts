/**
 * Módulo das verificações de saúde.
 *
 * A configuração e o registrador que o serviço consome não são importados aqui: eles são
 * publicados pela composição raiz, que é um módulo global. É o que permite que qualquer módulo
 * novo os alcance sem repetir importação — e, principalmente, que exista **uma** instância de
 * cada um por processo.
 */

import { Module } from '@nestjs/common';
import { SaudeController } from './saude.controller.js';
import { SaudeService } from './saude.service.js';

@Module({
  controllers: [SaudeController],
  providers: [SaudeService],
})
export class SaudeModule {}
