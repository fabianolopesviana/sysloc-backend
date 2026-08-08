/**
 * As **seis rotas do operador do SaaS** — o ciclo de vida da empresa e a admissão de
 * administradores.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de PERFIL
 * ---------------------------------------------------------------------------
 *
 * `@ExigePerfil('SYSLOC_MASTER')` na classe vale para os seis manipuladores — a guarda lê o
 * metadado com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método
 * não declara nada próprio. Declarar seis vezes o mesmo valor criaria seis lugares para esquecer um.
 *
 * A **dimensão** é a de perfil, e não uma chave do catálogo, porque o catálogo é declarado fechado
 * nas 17 áreas e ações do app da imobiliária: a ADR-0011 rejeita por escrito a alternativa de
 * inflá-lo com chaves sintéticas para as rotas do operador (*"o catálogo deixaria de ser a matriz do
 * produto e viraria um índice de rotas"*). O Master atravessa por perfil; a matriz dele é vazia, e
 * por isso ele não alcança rota alguma pela outra dimensão.
 *
 * **Nenhuma destas rotas reavalia a autorização** (CT-216). Quem decide é a guarda, uma vez, com a
 * exigência declarada aqui; os manipuladores abaixo já rodam depois da decisão.
 *
 * ---------------------------------------------------------------------------
 * Estas rotas ficam FORA da superfície que congela no marco de entrega
 * ---------------------------------------------------------------------------
 *
 * Decisão registrada da fatia: o painel do operador, pós-F7, pode acrescentar rotas sob
 * `/v1/master` sem violar o congelamento — o que congela é a superfície que o `@sysloc/contracts`
 * entrega ao frontend da imobiliária, e o operador do SaaS não é aquele cliente.
 *
 * ---------------------------------------------------------------------------
 * A validação acontece na BORDA, e o corpo é FECHADO
 * ---------------------------------------------------------------------------
 *
 * Os esquemas abaixo são `strictObject`: **chave desconhecida no corpo recusa a requisição**. Não é
 * rigor decorativo — é a segunda metade da superfície de escrita fechada do **D7**. `perfil` e
 * `empresaId` são decididos pelo servidor, e um corpo que os carregasse seria elevação de privilégio
 * (perfil) e fuga de tenant (empresa). O `input: false` do arcabouço fecha o analisador de corpo
 * dele; isto fecha o desta rota, que é server-side e não passa por lá.
 *
 * O identificador de rota é validado como **UUID antes de qualquer consulta** (§6.1): um valor
 * malformado é recusado com `422` sem tocar o banco, em vez de virar `404` depois de uma ida
 * inútil — e sem que a forma do identificador se torne um oráculo de existência.
 */

import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
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
import { CodigoErro } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sessaoDaRequisicao } from '../autenticacao/contexto.guard.js';
import { ExigePerfil } from '../autenticacao/exigencia.decorator.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { validar } from '../comum/validacao.js';
import {
  type AdministradorAdmitido,
  type EmpresaDoContrato,
  EmpresaService,
  MAIOR_PAGINA_DE_EMPRESAS,
  PAGINA_PADRAO_DE_EMPRESAS,
  type PaginaDeEmpresas,
  type ReativacaoDaEmpresa,
  type SenhaProvisoriaReemitida,
  type SuspensaoDaEmpresa,
} from './empresa.service.js';

/** Caminho da superfície do operador, relativo ao prefixo de versão (§4.1: `/v1/master/…`). */
export const CAMINHO_DO_MASTER = 'master';

/** Maior comprimento aceito para nome de empresa e de pessoa. */
const MAIOR_NOME = 200;

/** Maior comprimento aceito para o documento da empresa. */
const MAIOR_DOCUMENTO = 64;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/**
 * O identificador que chega no caminho.
 *
 * A validação é de **forma**, e acontece antes de qualquer consulta. Ela não diz nada sobre
 * existência: um UUID bem formado que não corresponda a empresa alguma segue produzindo `404`.
 */
// DÉBITO COM GATILHO — D37 · F1/T8 · registrado 2026-08-05
// O QUÊ: este identificador NÃO é canonizado para minúsculas, ao contrário do homônimo da borda de
//        usuários (`usuarios/usuario.controller.ts`, sob `DECISÃO FECHADA`); a assimetria é
//        deliberada, e até aqui não estava escrita no arquivo onde ela se lê.
// QUANDO FECHA: na primeira comparação do `:id` do Master com identidade da sessão — é ali que a
//               grafia passa a discriminar, e o `.toLowerCase()` da outra borda vem junto.
// POR QUE NÃO AGORA: medido — nenhum consumidor compara este identificador, e o eco do corpo e o
//                    registro de `suspensao`/`reativacao` saem do `RETURNING id`, isto é, do valor
//                    canônico devolvido pelo banco. Canonizar por simetria seria mudança de
//                    comportamento em superfície que congela, sem defeito que a motive.
// ÍNDICE: docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/_run/run-report.md §2, D37
const ESQUEMA_DO_IDENTIFICADOR = z.uuid();

/** Corpo fechado da criação de empresa (§4.1: `{ nome, documento }`). */
const ESQUEMA_DA_EMPRESA_NOVA = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_NOME),
  documento: z.string().trim().min(1).max(MAIOR_DOCUMENTO),
});

/**
 * Corpo fechado da admissão de administrador (§4.1: `{ nome, email }`).
 *
 * O endereço é normalizado para minúsculas **aqui, na borda**, e num lugar só: a coluna guarda
 * minúsculas (§6.1), e normalizar em dois pontos deixaria os dois livres para divergir — o
 * resultado seria uma pessoa criada com `Ana@…` que não entra com `ana@…`.
 *
 * `perfil` e `empresaId` **não** aparecem: o primeiro é fixo (o Master admite administrador, e nada
 * além disso — ADR-0013), e o segundo é o do caminho da rota. O esquema é estrito, então enviá-los
 * recusa a requisição em vez de ignorá-los em silêncio.
 */
const ESQUEMA_DO_ADMINISTRADOR = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_NOME),
  // Normaliza **antes** de validar, e não depois: `z.email()` recusaria ` ana@exemplo.com ` por
  // causa dos espaços, e o cliente receberia "endereço inválido" para um endereço que é válido.
  email: z
    .string()
    .trim()
    .transform((endereco) => endereco.toLowerCase())
    .pipe(z.email()),
});

/**
 * A janela da listagem.
 *
 * `limite` e `deslocamento` são campos do envelope de lista da **ADR-0012**, e por isso são
 * declaráveis: publicá-los na resposta e ignorá-los no pedido faria a resposta afirmar uma janela
 * que o cliente não pediu — e deixaria a segunda página inalcançável. O teto é explícito, e pedido
 * acima dele **recusa** em vez de truncar em silêncio: truncar faria o cliente acreditar que viu
 * tudo.
 */
const ESQUEMA_DA_JANELA = z.strictObject({
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAIOR_PAGINA_DE_EMPRESAS)
    .default(PAGINA_PADRAO_DE_EMPRESAS),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

const ESQUEMA_DA_EMPRESA = {
  type: 'object',
  required: ['id', 'nome', 'documento', 'estado', 'criadaEm'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    nome: { type: 'string' },
    documento: { type: 'string' },
    estado: { type: 'string', enum: ['ATIVA', 'SUSPENSA'] },
    criadaEm: { type: 'string', format: 'date-time' },
  },
};

const ESQUEMA_DA_PAGINA = {
  type: 'object',
  required: ['itens', 'total', 'limite', 'deslocamento'],
  properties: {
    itens: { type: 'array', items: ESQUEMA_DA_EMPRESA },
    total: { type: 'integer', minimum: 0 },
    limite: { type: 'integer', minimum: 1 },
    deslocamento: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DA_SUSPENSAO = {
  type: 'object',
  required: ['id', 'estado', 'suspensaEm', 'sessoesEncerradas'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    estado: { type: 'string', enum: ['SUSPENSA'] },
    suspensaEm: { type: 'string', format: 'date-time' },
    sessoesEncerradas: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DA_REATIVACAO = {
  type: 'object',
  required: ['id', 'estado'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    estado: { type: 'string', enum: ['ATIVA'] },
  },
};

const ESQUEMA_DO_ADMINISTRADOR_ADMITIDO = {
  type: 'object',
  required: ['usuarioId', 'email', 'senhaProvisoria'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    senhaProvisoria: { type: 'string' },
  },
};

const ESQUEMA_DA_SENHA_REEMITIDA = {
  type: 'object',
  required: ['usuarioId', 'senhaProvisoria'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    senhaProvisoria: { type: 'string' },
  },
};

/** Envelope de erro da ADR-0012, para as respostas de recusa do documento publicado. */

@ApiTags('master')
@Controller(CAMINHO_DO_MASTER)
@ExigePerfil('SYSLOC_MASTER')
export class EmpresaController {
  constructor(@Inject(EmpresaService) private readonly empresas: EmpresaService) {}

  @Post('empresas')
  @ApiOperation({
    summary: 'Registra uma empresa nova, ativa',
    description:
      'O documento é único: a repetição é recusada com `422`, e nenhuma empresa nasce. A empresa ' +
      'criada aparece imediatamente na listagem, sem intervenção fora da API.',
  })
  @ApiCreatedResponse({ description: 'A empresa foi registrada.', schema: ESQUEMA_DA_EMPRESA })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async admitirEmpresa(@Body() corpo: unknown): Promise<EmpresaDoContrato> {
    return await this.empresas.admitirEmpresa(validar(ESQUEMA_DA_EMPRESA_NOVA, corpo, 'corpo'));
  }

  @Get('empresas')
  @ApiOperation({
    summary: 'Lista as empresas com o estado corrente de cada uma',
    description:
      'Devolve identificação e estado, e **nenhum dado de negócio** de empresa alguma (RN-13). ' +
      'A janela é declarável por `limite` e `deslocamento`.',
  })
  @ApiOkResponse({ description: 'A página pedida.', schema: ESQUEMA_DA_PAGINA })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listarEmpresas(@Query() consulta: unknown): Promise<PaginaDeEmpresas> {
    return await this.empresas.listarEmpresas(validar(ESQUEMA_DA_JANELA, consulta, 'limite'));
  }

  @Post('empresas/:id/admin')
  @ApiOperation({
    summary: 'Admite um administrador para a empresa, com Senha provisória',
    description:
      'Atende tanto o primeiro Admin da empresa quanto o socorro de uma empresa cujo único Admin ' +
      'está desativado. A Senha provisória é devolvida **uma única vez** — nenhuma consulta ' +
      'posterior a recupera. O perfil é fixo (`ADMIN_EMPRESA`) e a empresa é a do caminho: ' +
      'nenhum dos dois é aceito pelo corpo.',
  })
  @ApiCreatedResponse({
    description: 'O administrador foi admitido; a Senha provisória vai no corpo.',
    schema: ESQUEMA_DO_ADMINISTRADOR_ADMITIDO,
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async admitirAdministrador(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<AdministradorAdmitido> {
    const empresaId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await this.empresas.admitirAdministrador(
      empresaId,
      validar(ESQUEMA_DO_ADMINISTRADOR, corpo, 'corpo'),
      // A autoria da emissão sai da SESSÃO que a guarda resolveu — nunca do corpo nem de um
      // cabeçalho. É o que torna a trilha da ADR-0013 uma afirmação sobre quem emitiu, e não sobre
      // quem disse ter emitido.
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }

  @Post('empresas/:id/suspensao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suspende a empresa e encerra as sessões de todas as pessoas dela',
    description:
      'O encerramento acontece **no próprio ato**, na mesma transação da marcação: os registros ' +
      'de sessão são apagados, e `sessoesEncerradas` diz quantos. Repetir a suspensão de uma ' +
      'empresa já suspensa devolve o mesmo corpo, com `sessoesEncerradas: 0`.',
  })
  @ApiOkResponse({ description: 'A empresa está suspensa.', schema: ESQUEMA_DA_SUSPENSAO })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async suspender(@Param('id') identificador: string): Promise<SuspensaoDaEmpresa> {
    return await this.empresas.suspender(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
  }

  @Post('empresas/:id/reativacao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reativa a empresa',
    description:
      'Devolve a capacidade de entrar, e **não** as sessões que a suspensão encerrou (RN-05): os ' +
      'cookies anteriores continuam inválidos, e todos entram de novo.',
  })
  @ApiOkResponse({ description: 'A empresa está ativa.', schema: ESQUEMA_DA_REATIVACAO })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async reativar(@Param('id') identificador: string): Promise<ReativacaoDaEmpresa> {
    return await this.empresas.reativar(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
  }

  @Post('usuarios/:id/senha-provisoria')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reemite a Senha provisória de um administrador',
    description:
      'A senha anterior deixa de servir no mesmo ato, e a recusa dela é **indistinguível** da ' +
      'recusa por credencial incorreta. O alvo é restrito ao perfil `ADMIN_EMPRESA` (ADR-0013): ' +
      'alvo de outro perfil responde `422`.',
  })
  @ApiOkResponse({
    description: 'A Senha provisória nova, entregue uma única vez.',
    schema: ESQUEMA_DA_SENHA_REEMITIDA,
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async reemitirSenha(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<SenhaProvisoriaReemitida> {
    return await this.empresas.reemitirSenha(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }
}
