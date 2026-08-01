/**
 * As duas verificações de saúde — rasa e profunda.
 *
 * ---------------------------------------------------------------------------
 * A separação é desenho, não redundância
 * ---------------------------------------------------------------------------
 *
 * `GET /saude` é **rasa**: responde que o processo está vivo, e **não consulta banco nem fila**.
 * Quem a consome é o supervisor do sistema operacional; se ela consultasse o banco, uma oscilação
 * do banco viraria reinício da aplicação — falha em cascata a partir de uma dependência que
 * voltaria sozinha.
 *
 * `GET /saude/pronto` é **profunda**: consulta as duas dependências e devolve o estado de cada
 * uma. Quem a consome é a prova de aceitação do reinício, que precisa afirmar que **as
 * dependências subiram**, e não apenas que o processo responde.
 *
 * Fundi-las produz um de dois defeitos: ou o supervisor reinicia a aplicação quando o banco
 * oscila, ou a prova do reinício aceita verde com o banco ainda indisponível.
 *
 * ---------------------------------------------------------------------------
 * O `503` sai no envelope da ADR-0007
 * ---------------------------------------------------------------------------
 *
 * Dependência fora não é um corpo de sucesso com status de erro: é um erro, e o projeto tem um
 * formato único para erro. A rota levanta `ErroDeAplicacao` com o código `SERVICO_INDISPONIVEL`
 * — que já implica `503` — e o filtro global o traduz. O estado nominal de **cada** dependência
 * viaja em `detalhes`, e a mensagem nomeia a que falhou.
 */

import { Controller, Get, Inject } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { EstadoDasDependencias } from './saude.service.js';
import { SaudeService } from './saude.service.js';

/** Corpo da verificação rasa. Nenhuma menção a dependência — ela não consulta nenhuma. */
export interface RespostaSaudeRasa {
  readonly estado: 'disponivel';
}

/** Corpo da verificação profunda quando todas as dependências respondem. */
export interface RespostaSaudeProfunda {
  readonly estado: 'disponivel';
  readonly dependencias: EstadoDasDependencias;
}

const ESQUEMA_DA_RASA = {
  type: 'object',
  required: ['estado'],
  properties: { estado: { type: 'string', enum: ['disponivel'] } },
};

const ESQUEMA_DAS_DEPENDENCIAS = {
  type: 'object',
  required: ['banco', 'fila'],
  properties: {
    banco: { type: 'string', enum: ['disponivel', 'indisponivel'] },
    fila: { type: 'string', enum: ['disponivel', 'indisponivel'] },
  },
};

const ESQUEMA_DA_PROFUNDA = {
  type: 'object',
  required: ['estado', 'dependencias'],
  properties: {
    estado: { type: 'string', enum: ['disponivel'] },
    dependencias: ESQUEMA_DAS_DEPENDENCIAS,
  },
};

const ESQUEMA_DO_ERRO = {
  type: 'object',
  required: ['codigo', 'mensagem'],
  properties: {
    codigo: { type: 'string', enum: [CodigoErro.SERVICO_INDISPONIVEL] },
    mensagem: { type: 'string' },
    detalhes: {
      type: 'object',
      properties: { dependencias: ESQUEMA_DAS_DEPENDENCIAS },
    },
  },
};

@ApiTags('saude')
@Controller('saude')
export class SaudeController {
  constructor(@Inject(SaudeService) private readonly saude: SaudeService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificação rasa: o processo está vivo',
    description:
      'Não consulta banco nem fila. Consumida pelo supervisor do sistema operacional para ' +
      'decidir reinício.',
  })
  @ApiOkResponse({ description: 'O processo está vivo e respondendo.', schema: ESQUEMA_DA_RASA })
  verificacaoRasa(): RespostaSaudeRasa {
    return { estado: 'disponivel' };
  }

  @Get('pronto')
  @ApiOperation({
    summary: 'Verificação profunda: banco e fila alcançáveis',
    description:
      'Consulta cada dependência e devolve o estado de todas elas. Usada na prova de aceitação ' +
      'do reinício.',
  })
  @ApiOkResponse({
    description: 'Todas as dependências responderam.',
    schema: ESQUEMA_DA_PROFUNDA,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Ao menos uma dependência está inalcançável. O corpo nomeia qual, no envelope de erro ' +
      'da ADR-0007.',
    schema: ESQUEMA_DO_ERRO,
  })
  async verificacaoProfunda(): Promise<RespostaSaudeProfunda> {
    const dependencias = await this.saude.verificarDependencias();
    const indisponiveis = Object.entries(dependencias)
      .filter(([, estado]) => estado === 'indisponivel')
      .map(([nome]) => nome);

    if (indisponiveis.length > 0) {
      throw new ErroDeAplicacao(
        CodigoErro.SERVICO_INDISPONIVEL,
        `dependência inalcançável: ${indisponiveis.join(', ')}`,
        { detalhes: { dependencias } },
      );
    }

    return { estado: 'disponivel', dependencias };
  }
}
