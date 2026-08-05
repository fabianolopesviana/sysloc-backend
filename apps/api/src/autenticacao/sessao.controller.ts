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
 * válida já foi recusada com `401` pela guarda, no envelope da ADR-0012.
 *
 * ---------------------------------------------------------------------------
 * O efetivo de permissão viaja AQUI — e é por isso que ele existe na sessão
 * ---------------------------------------------------------------------------
 *
 * A fatia `autorizacao-e-ciclo-de-acesso` acrescentou `telas`, `acoes` e `versaoPermissoes`, e o
 * contrato passou de oito para **onze** campos (§4.2 da tech spec, CA-19). Eles não são enfeite: a
 * **ADR-0010** registra que deixar a sessão sem o efetivo *"obrigaria o cliente a uma chamada extra
 * só para desenhar o menu"*, e essa chamada extra é a alternativa que ela rejeita.
 *
 * O parágrafo acima continua valendo inteiro para eles: **nada é calculado aqui**. Os três campos
 * saem da mesma sessão que a guarda resolveu — inclusive a revalidação por versão, que já
 * aconteceu antes de a requisição chegar a este manipulador. Recalcular o efetivo neste ponto
 * criaria a segunda resposta para "o que esta sessão alcança", livre para divergir daquela que
 * autoriza as rotas.
 *
 * ---------------------------------------------------------------------------
 * O que esta rota exige: NADA — e a marca é explícita
 * ---------------------------------------------------------------------------
 *
 * A ADR-0011 recusa a rota que não declara exigência, então esta declara `@NaoExigePermissao()`. A
 * escolha é de desenho: a rota devolve **a própria sessão de quem pede**, e condicioná-la a uma
 * chave do catálogo faria a pessoa sem nenhuma chave perder justamente o meio de descobrir por quê.
 * Ela **não** é pública — quem chega sem cookie continua recebendo `401` da guarda.
 */

import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CHAVES_DE_ACAO, CHAVES_DE_TELA, PERFIS } from '@sysloc/auth';
import { CodigoErro } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { type SessaoDoProduto, sessaoDaRequisicao } from './contexto.guard.js';
import { NaoExigePermissao } from './exigencia.decorator.js';

/** Caminho da rota, relativo ao prefixo de versão (§4.1: `GET /v1/sessao`). */
export const CAMINHO_DA_SESSAO = 'sessao';

/**
 * Esquema do objeto de sessão publicado no contrato.
 *
 * Os onze campos são obrigatórios — inclusive os dois anuláveis: `empresaId` e `empresaNome` são
 * `null` para o Sysloc Master, e **nulo não é ausência**. Um cliente que os tratasse como opcionais
 * não distinguiria "operador do SaaS" de "campo que o servidor esqueceu de mandar".
 *
 * `telas` e `acoes` são obrigatórios pelo mesmo motivo levado ao caso do conjunto vazio: o Master
 * recebe `[]` nos dois, porque a matriz do perfil dele é vazia por decisão estrutural (§4.2), e um
 * arranjo ausente seria indistinguível de "o servidor não sabe".
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
    'telas',
    'acoes',
    'versaoPermissoes',
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
    // Os dois enums saem do CATÁLOGO exportado, pela mesma razão de `PERFIS`: o catálogo é fechado
    // nas 17 chaves (RN-15), e uma lista redigitada aqui deixaria o contrato publicado divergir do
    // que a guarda de fato exige na primeira chave nova.
    telas: { type: 'array', items: { type: 'string', enum: [...CHAVES_DE_TELA] } },
    acoes: { type: 'array', items: { type: 'string', enum: [...CHAVES_DE_ACAO] } },
    versaoPermissoes: { type: 'integer', minimum: 0 },
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
  @NaoExigePermissao()
  @ApiOperation({
    summary: 'A sessão corrente, no modelo de domínio do produto',
    description:
      'Devolve quem está autenticado, a empresa da sessão e o efetivo de permissão dela. ' +
      '`empresaId` e `empresaNome` são nulos apenas para o Sysloc Master, que não pertence a ' +
      'empresa alguma — e é também por isso que `telas` e `acoes` são vazios para ele. ' +
      '`versaoPermissoes` muda quando alguém ajusta as permissões da pessoa, e a operação ' +
      'seguinte já reflete o ajuste sem que a sessão seja encerrada.',
  })
  @ApiOkResponse({ description: 'A sessão corrente.', schema: ESQUEMA_DA_SESSAO })
  @ApiUnauthorizedResponse({
    description:
      'Não há sessão válida na requisição — ausente, encerrada ou vencida. Corpo no envelope ' +
      'de erro da ADR-0012.',
    schema: ESQUEMA_DO_ERRO,
  })
  sessaoCorrente(@Req() requisicao: FastifyRequest): SessaoDoProduto {
    return sessaoDaRequisicao(requisicao);
  }
}
