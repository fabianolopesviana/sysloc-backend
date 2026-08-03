/**
 * `GET /v1/sessao` — a sessão corrente **no modelo de domínio do produto**.
 *
 * ---------------------------------------------------------------------------
 * Por que esta rota existe, e por que ela não é a do arcabouço
 * ---------------------------------------------------------------------------
 *
 * A superfície de identidade sob `/v1/auth` já publica uma leitura de sessão, e ela fala o
 * vocabulário do arcabouço (`{ user, session }`, em inglês, com os campos do modelo dele). O
 * invariante 6 do `CLAUDE.md` e a §4.2 da tech spec fixam o oposto para todo recurso do produto:
 * camelCase e português, com os campos que o frontend consome. As duas coexistem porque respondem a
 * perguntas diferentes — a do arcabouço é o contrato do cliente oficial dele (§4.1 preserva os
 * caminhos nativos), esta é o contrato do produto.
 *
 * ---------------------------------------------------------------------------
 * O controlador não decide nada — e essa é a decisão
 * ---------------------------------------------------------------------------
 *
 * A sessão devolvida é **exatamente** a que a guarda de contexto resolveu para esta requisição.
 * Nenhuma leitura de banco acontece aqui, nenhum campo é recalculado e nenhum perfil é comparado. Se
 * este manipulador resolvesse a sessão por conta própria, passariam a existir **duas** respostas
 * para "quem é o dono desta requisição" — a que fixa o contexto de tenant e a que o cliente vê —, e
 * elas seriam livres para divergir. Uma fonte, dois consumidores.
 *
 * É também por isso que não há `try`/`catch` aqui: a rota não é pública, e a requisição sem sessão
 * válida já foi recusada com `401` pela guarda, no envelope da ADR-0007.
 *
 * ---------------------------------------------------------------------------
 * O que a sessão desta fatia NÃO carrega
 * ---------------------------------------------------------------------------
 *
 * Telas e ações permitidas, e `versaoPermissoes`. A §4.2 da tech spec atribui os três à fatia
 * `autorizacao-e-ciclo-de-acesso`. Antecipá-los aqui publicaria campos cuja regra de preenchimento
 * ainda não existe — e a superfície da API, uma vez congelada no marco de entrega, não é
 * retrocompatível a remoção.
 */

import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { PERFIS } from '@sysloc/auth';
import { CodigoErro } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { type SessaoDoProduto, sessaoDaRequisicao } from './contexto.guard.js';

/** Caminho da rota, relativo ao prefixo de versão (§4.1: `GET /v1/sessao`). */
export const CAMINHO_DA_SESSAO = 'sessao';

/**
 * Esquema do objeto de sessão publicado no contrato.
 *
 * Os oito campos são obrigatórios — inclusive os dois anuláveis: `empresaId` e `empresaNome` são
 * `null` para o Sysloc Master, e **nulo não é ausência**. Um cliente que os tratasse como opcionais
 * não distinguiria "operador do SaaS" de "campo que o servidor esqueceu de mandar".
 */
const ESQUEMA_DA_SESSAO = {
  type: 'object',
  required: [
    'usuarioId',
    'nome',
    'email',
    'perfil',
    'empresaId',
    'empresaNome',
    'senhaProvisoria',
    'segundoFatorPendente',
  ],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    nome: { type: 'string' },
    email: { type: 'string', format: 'email' },
    // Os valores vêm do enum do schema, pelo `PERFIS` de `@sysloc/auth` — nunca de uma lista
    // redigitada aqui, que envelheceria em silêncio quando um perfil novo entrasse no banco.
    perfil: { type: 'string', enum: [...PERFIS] },
    empresaId: { type: 'string', format: 'uuid', nullable: true },
    empresaNome: { type: 'string', nullable: true },
    senhaProvisoria: { type: 'boolean' },
    segundoFatorPendente: { type: 'boolean' },
  },
};

const ESQUEMA_DO_ERRO = {
  type: 'object',
  required: ['codigo', 'mensagem'],
  properties: {
    codigo: { type: 'string', enum: [CodigoErro.NAO_AUTENTICADO] },
    mensagem: { type: 'string' },
  },
};

@ApiTags('sessao')
@Controller(CAMINHO_DA_SESSAO)
export class SessaoController {
  @Get()
  @ApiOperation({
    summary: 'A sessão corrente, no modelo de domínio do produto',
    description:
      'Devolve quem está autenticado e a empresa da sessão. `empresaId` e `empresaNome` são ' +
      'nulos apenas para o Sysloc Master, que não pertence a empresa alguma.',
  })
  @ApiOkResponse({ description: 'A sessão corrente.', schema: ESQUEMA_DA_SESSAO })
  @ApiUnauthorizedResponse({
    description:
      'Não há sessão válida na requisição — ausente, encerrada ou vencida. Corpo no envelope ' +
      'de erro da ADR-0007.',
    schema: ESQUEMA_DO_ERRO,
  })
  sessaoCorrente(@Req() requisicao: FastifyRequest): SessaoDoProduto {
    return sessaoDaRequisicao(requisicao);
  }
}
