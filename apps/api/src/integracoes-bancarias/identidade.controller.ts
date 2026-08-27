/**
 * A identidade da empresa perante o provedor bancário — `POST` e `GET`
 * `/v1/integracoes-bancarias/identidade`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA É RECURSO PRÓPRIO, e não parte do certificado
 * ---------------------------------------------------------------------------
 *
 * Os ciclos de vida diferem: o certificado vale um ano e é substituído inteiro a cada renovação; a
 * identidade não muda quando o material é trocado. Recurso único faria cada renovação exigir que a
 * identidade fosse reinformada — e esquecê-la quebraria a obtenção de credencial em silêncio.
 * A razão longa está no docblock de `identidadeNoProvedor`, em `@sysloc/db`.
 *
 * ---------------------------------------------------------------------------
 * O IDENTIFICADOR NÃO VOLTA — nem aqui, nem em erro
 * ---------------------------------------------------------------------------
 *
 * A ADR-0032 exige que o segredo operável não alcance superfície alguma, e que a ausência seja
 * afirmada por **medição da saída real**. Nada neste arquivo lê o identificador de volta: o serviço
 * devolve a projeção publicável, montada campo a campo, e o esquema de saída é **estrito** — de modo
 * que um campo a mais derruba a rota em vez de vazar (a mesma exceção deliberada do certificado).
 *
 * As duas rotas exigem sessão e as chaves da tela de integrações — as MESMAS do certificado, e
 * importadas de lá em vez de redigitadas: duas declarações da mesma exigência são duas regras livres
 * para divergir.
 */

import { Body, Controller, Get, Inject, Post, Req } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { esquemaDaIdentidade, esquemaDaIdentidadeNova, type Identidade } from '@syslocbr/contracts';
import type { FastifyRequest } from 'fastify';
import { ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO } from '../configuracao/ambiente.js';
import {
  ACAO_DE_CONFIGURACAO,
  AREA_DAS_INTEGRACOES_BANCARIAS,
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
} from './certificado.controller.js';
import { IdentidadeNoProvedorService } from './identidade.service.js';

/** Segmento do recurso, relativo ao prefixo de versão e à área. */
export const SEGMENTO_DA_IDENTIDADE = 'identidade';

/** Nome do campo apontado quando a recusa é do corpo. */
const CAMPO_DO_CORPO = 'corpo';

@ApiTags('integracoes-bancarias')
@Controller(CAMINHO_DAS_INTEGRACOES_BANCARIAS)
export class IdentidadeNoProvedorController {
  constructor(
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(IdentidadeNoProvedorService)
    private readonly identidades: IdentidadeNoProvedorService,
  ) {}

  @Post(SEGMENTO_DA_IDENTIDADE)
  @ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)
  @ApiOperation({
    summary: 'Registra ou substitui a identidade da empresa perante o provedor',
    description:
      'Recebe o identificador da aplicação e os dados da conta, e grava a identidade da empresa ' +
      '**da sessão**. O corpo é **completo e fechado**: campo ausente é `422` — nunca "preserve o ' +
      'valor atual" —, e chave desconhecida é recusada. Registrar de novo **substitui**: a ' +
      'anterior permanece no histórico e o identificador dela deixa de existir no mesmo ato, de ' +
      'modo que a resposta é `201` e não `200`. **O identificador não volta em resposta alguma.**',
  })
  @ApiCreatedResponse({
    description: 'A identidade registrada, sem o identificador.',
    schema: esquemaPublicado(esquemaDaIdentidade, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async registrar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Identidade> {
    const entrada = validar(esquemaDaIdentidadeNova, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      return await this.identidades.registrar(tx, entrada, sessao.usuarioId);
    });
  }

  @Get(SEGMENTO_DA_IDENTIDADE)
  @ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)
  @ApiOperation({
    summary: 'Consulta a identidade vigente da empresa perante o provedor',
    description:
      'Devolve os dados da conta e a autoria do registro. **O identificador da aplicação não sai ' +
      'aqui** — ele existe cifrado e é usado apenas na composição do pedido de credencial. Sem ' +
      'identidade registrada, `404`.',
  })
  @ApiOkResponse({
    description: 'A identidade vigente.',
    schema: esquemaPublicado(esquemaDaIdentidade, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  async consultar(@Req() requisicao: FastifyRequest): Promise<Identidade> {
    return await sobContextoDaSessao(this.banco, requisicao, async (tx) => {
      return await this.identidades.consultar(tx);
    });
  }
}
