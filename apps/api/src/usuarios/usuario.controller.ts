/**
 * As **sete rotas do Admin** — o ciclo de vida das pessoas da própria empresa.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave('TELA:usuarios')` na classe vale para os sete manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar sete vezes o mesmo valor criaria sete lugares para esquecer um.
 *
 * A **dimensão** é a de chave, e não a de perfil, e a diferença é o produto inteiro: quem administra
 * pessoas é quem alcança a área de tela `Usuários`, e não quem tem um rótulo. É isso que permite ao
 * Admin **retirar** a administração de pessoas de outro Admin por ajuste individual — a matriz do
 * perfil concede a chave, e a negação individual vence (ADR-0010). Se a exigência fosse de perfil, a
 * retirada não teria efeito nenhum, e a bidirecionalidade da matriz seria uma promessa vazia
 * exatamente na área mais sensível.
 *
 * **E a direção oposta — a CONCESSÃO — é o que torna a recusa do auto-alvo obrigatória.** O
 * parágrafo acima raciocina sobre retirar a chave de quem já a tem pela matriz; o caso simétrico é
 * conceder `TELA:usuarios`, por ajuste individual, a uma pessoa `USUARIO_EMPRESA`. Ela passa a
 * alcançar estas sete rotas com **uma** chave, e sem a recusa do auto-alvo aplicá-las-ia a si mesma:
 * por `POST /:id/perfil` tomaria `ADMIN_EMPRESA` e, por `POST /:id/permissoes`, as outras dezesseis
 * chaves — dois caminhos independentes para a mesma escalada. A escolha da dimensão de chave é
 * **certa**, e é ela que paga essa conta; quem a paga é `UsuarioService.sobreAPessoa`, no ponto único
 * por onde as cinco rotas de `:id` abrem a unidade de trabalho, e nunca aqui, manipulador a
 * manipulador. As cinco recusam o auto-alvo com `422 CAMPO_INVALIDO`, `campo: 'id'` — a mesma forma
 * com que `POST /v1/master/usuarios/:id/senha-provisoria` recusa o alvo de perfil errado.
 *
 * **Nenhuma destas rotas reavalia a autorização** (CT-216). Quem decide é a guarda, uma vez, com a
 * exigência declarada aqui; os manipuladores abaixo já rodam depois da decisão — e sob o contexto de
 * tenant que ela publicou a partir da sessão.
 *
 * ---------------------------------------------------------------------------
 * Estas rotas ENTRAM na superfície que congela no marco de entrega
 * ---------------------------------------------------------------------------
 *
 * Ao contrário das do operador do SaaS, elas são a superfície que o `@sysloc/contracts` entrega ao
 * frontend da imobiliária: é a partir delas que a tela de usuários é religada. Acrescentar, remover
 * ou alterar rota aqui depois do congelamento quebra o handoff.
 *
 * ---------------------------------------------------------------------------
 * A transição de estado é SUB-RECURSO, e o corpo é FECHADO
 * ---------------------------------------------------------------------------
 *
 * Desativar, reativar, trocar perfil, ajustar permissões e reemitir senha são **sub-recursos** de
 * `POST`, e não campos opcionais de um `PATCH`. Cada transição declara a própria exigência e tem
 * payload fechado ou vazio; **nenhuma rota desta superfície aceita atualização parcial**. A forma
 * torna a operação nomeável na trilha e no contrato, e tira do cliente a possibilidade de mudar duas
 * coisas por engano numa requisição só.
 *
 * Os esquemas abaixo são `strictObject`: **chave desconhecida no corpo recusa a requisição**. Não é
 * rigor decorativo — `empresaId` é decidido pelo servidor a partir da sessão, e um corpo que o
 * carregasse seria fuga de tenant. `perfil` **é** aceito na criação, e a diferença em relação à rota
 * do Master é deliberada: lá ele é fixo por decisão da ADR-0013; aqui ele é escolha legítima de quem
 * já administra a própria empresa, restrita ao conjunto administrável (§6.1).
 *
 * O identificador de rota é validado como **UUID antes de qualquer consulta** (§6.1): um valor
 * malformado é recusado com `422` sem tocar o banco, em vez de virar `404` depois de uma ida inútil
 * — e sem que a forma do identificador se torne um oráculo de existência. Validado **e canonizado**:
 * a caixa é normalizada no mesmo esquema, porque o banco é insensível a ela e a aplicação não —
 * ver `ESQUEMA_DO_IDENTIFICADOR`, que carrega a razão por extenso e o marcador que a protege.
 *
 * ---------------------------------------------------------------------------
 * O campo `descartarAjustes` NÃO é atualização parcial
 * ---------------------------------------------------------------------------
 *
 * Ele é o único campo opcional desta superfície, e é **declaração de intenção**, não campo a
 * preservar: `perfil` continua obrigatório na mesma requisição. Ausente vale `false` — **nunca**
 * consentimento —, e o `.default(false)` do esquema é onde essa regra vira código, num ponto só.
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
import { CHAVES_DE_ACAO, CHAVES_DE_TELA, ehChaveDoCatalogo } from '@sysloc/auth';
import { CodigoErro } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sessaoDaRequisicao } from '../autenticacao/contexto.guard.js';
import { ExigeChave } from '../autenticacao/exigencia.decorator.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { validar } from '../comum/validacao.js';
import {
  type JanelaDaListagem,
  MAIOR_PAGINA_DE_PESSOAS,
  PAGINA_PADRAO_DE_PESSOAS,
  type PaginaDePessoas,
  PERFIS_ADMINISTRAVEIS,
  type PerfilTrocado,
  type PermissoesAjustadas,
  type PessoaAdmitida,
  type PessoaDesativada,
  type PessoaReativada,
  type SenhaProvisoriaDaPessoa,
  UsuarioService,
} from './usuario.service.js';

/** Caminho da superfície de pessoas, relativo ao prefixo de versão (§4.1: `/v1/usuarios/…`). */
export const CAMINHO_DOS_USUARIOS = 'usuarios';

/** Maior comprimento aceito para o nome de uma pessoa. */
const MAIOR_NOME = 200;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/**
 * O identificador que chega no caminho, **na forma canônica**.
 *
 * A validação é de **forma**, e acontece antes de qualquer consulta. Ela não diz nada sobre
 * existência: um UUID bem formado que não corresponda a pessoa alcançável segue produzindo `404`.
 *
 * ---------------------------------------------------------------------------
 * Por que a minúscula é imposta AQUI, e por que ela não é cosmética
 * ---------------------------------------------------------------------------
 *
 * `z.uuid()` valida a **forma** e devolve o valor **verbatim** — `3F2504E0-…` passa e sai como
 * `3F2504E0-…`. O Fastify captura o `:id` sem alterar a caixa (`caseSensitive` é o padrão, e o
 * adaptador é criado sem opções). Do outro lado, o Postgres **sempre** renderiza `uuid` em
 * minúsculas, e `uuid_in` parseia hexadecimal **sem distinguir caixa**. O resultado é um sistema em
 * que as duas pontas concordam sobre a **identidade** e discordam sobre a **grafia**: a consulta
 * acha a mesma linha com qualquer caixa, e uma comparação de string entre o valor do caminho e o
 * valor lido do banco responde `false` sobre a mesma pessoa.
 *
 * Foi exatamente por aí que a recusa do auto-alvo de `UsuarioService.sobreAPessoa` — que compara o
 * identificador do alvo com o de quem age — se tornou contornável: bastava pedir a própria rota com
 * o próprio identificador **em maiúsculas** para a guarda não disparar e a escalada de privilégio
 * consumar-se. A correção mora aqui, e não lá, porque o defeito não é da comparação: é do
 * identificador entrar em forma não canônica. Canonizar na borda vale para **todo** consumidor do
 * `:id` — a comparação, as consultas, o registro estruturado e o corpo ecoado —, e não só para o
 * que reprovou.
 *
 * É o mesmo desenho de `ESQUEMA_DA_PESSOA_NOVA`, e pela mesma razão escrita ali: **normalizar em
 * dois pontos deixa os dois livres para divergir**.
 */
// DECISÃO FECHADA — T8 / Gate 2 · 2026-08-05
// O QUÊ: o identificador de rota é canonizado (minúsculas) NA BORDA, num ponto único, e nenhum
//        consumidor a jusante vê a forma que o cliente enviou.
// POR QUÊ: a escalada de privilégio dentro da empresa foi fechada TRÊS vezes nesta task, cada uma
//          por um caminho diferente — o alcance das rotas (rodada 2), o auto-alvo (rodada 3) e a
//          FORMA do identificador (rodada 4, verificada empiricamente pelo gate: `z.uuid()` aceita
//          maiúsculas e devolve verbatim, `uuid_in` do Postgres acha a linha assim mesmo, e a
//          igualdade de string responde `false`). Enquanto a canonicidade for pressuposta em vez de
//          estabelecida, toda comparação futura sobre o `:id` reabre o mesmo defeito.
// REVERTER EXIGE: provar que NENHUM consumidor do identificador de rota — comparação de identidade,
//                 consulta, registro ou eco no corpo — depende de as duas pontas concordarem sobre a
//                 grafia, E que o Postgres deixou de aceitar `uuid` em caixa mista. Enquanto o banco
//                 for insensível à caixa e a aplicação comparar strings, a transformação fica.
const ESQUEMA_DO_IDENTIFICADOR = z.uuid().transform((valor) => valor.toLowerCase());

/**
 * Corpo fechado da criação de pessoa (§4.1: `{ nome, email, perfil }`).
 *
 * O endereço é normalizado para minúsculas **aqui, na borda**, e num lugar só: a coluna guarda
 * minúsculas (§6.1), e normalizar em dois pontos deixaria os dois livres para divergir — o resultado
 * seria uma pessoa criada com `Ana@…` que não entra com `ana@…`.
 *
 * `empresaId` **não** aparece: é o da sessão de quem age. O esquema é estrito, então enviá-lo recusa
 * a requisição em vez de ignorá-lo em silêncio.
 */
const ESQUEMA_DA_PESSOA_NOVA = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_NOME),
  // Normaliza **antes** de validar, e não depois: `z.email()` recusaria ` ana@exemplo.com ` por
  // causa dos espaços, e o cliente receberia "endereço inválido" para um endereço que é válido.
  email: z
    .string()
    .trim()
    .transform((endereco) => endereco.toLowerCase())
    .pipe(z.email()),
  perfil: z.enum(PERFIS_ADMINISTRAVEIS),
});

/**
 * A janela da listagem.
 *
 * `limite` e `deslocamento` são campos do envelope de lista da **ADR-0012**, e por isso são
 * declaráveis. É a mesma emenda que a T7 aplicou à listagem de empresas, e pela mesma razão:
 * publicá-los na resposta e ignorá-los no pedido faria a resposta afirmar uma janela que o cliente
 * não pediu — e deixaria a segunda página inalcançável numa empresa com mais pessoas que o padrão.
 * O teto é explícito, e pedido acima dele **recusa** em vez de truncar em silêncio: truncar faria o
 * cliente acreditar que viu todas as pessoas da empresa.
 */
const ESQUEMA_DA_JANELA = z.strictObject({
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAIOR_PAGINA_DE_PESSOAS)
    .default(PAGINA_PADRAO_DE_PESSOAS),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

/**
 * Corpo fechado do ajuste de permissões (§4.1: `{ ajustes: [{ tipo, chave, efeito }] }`).
 *
 * ---------------------------------------------------------------------------
 * As duas recusas que acontecem AQUI, antes de qualquer escrita
 * ---------------------------------------------------------------------------
 *
 * 1. **Chave fora do catálogo** (§6.1, RN-15). O par `(tipo, chave)` é composto na forma canônica do
 *    domínio e conferido contra `ehChaveDoCatalogo` — o predicado de `@sysloc/auth`, e não uma lista
 *    reescrita aqui. É a borda que fecha o catálogo, porque a coluna `chave` é `text` e o banco não
 *    tem como recusar `TELA:inventada`.
 * 2. **A mesma chave duas vezes** no mesmo corpo. A unicidade `(acesso_id, tipo, chave)` recusaria a
 *    segunda linha, mas a recusa chegaria como erro de driver — `500` sobre um corpo malformado, que
 *    é recusa de cliente. Conferir aqui é o que a mantém `422` com o campo nomeado.
 *
 * O conjunto é o **completo**: a escrita substitui todos os ajustes da pessoa. Um corpo com o arranjo
 * vazio é legítimo e significa "remover todos" — e por isso não há `.min(1)`.
 *
 * A coerência ação→tela **não** é conferida aqui, e é deliberado: ela depende do perfil da pessoa,
 * que só é conhecido dentro da transação. Conferi-la na borda exigiria uma leitura prévia e deixaria
 * a janela em que uma troca de perfil concorrente a valida contra um perfil que já não vale.
 */
const ESQUEMA_DOS_AJUSTES = z
  .strictObject({
    ajustes: z.array(
      z.strictObject({
        tipo: z.enum(['TELA', 'ACAO']),
        chave: z.string().trim().min(1),
        efeito: z.enum(['CONCEDIDA', 'NEGADA']),
      }),
    ),
  })
  .refine(
    (corpo) => corpo.ajustes.every((ajuste) => ehChaveDoCatalogo(`${ajuste.tipo}:${ajuste.chave}`)),
    { error: 'chave fora do catálogo de permissões', path: ['ajustes'] },
  )
  .refine(
    (corpo) =>
      new Set(corpo.ajustes.map((ajuste) => `${ajuste.tipo}:${ajuste.chave}`)).size ===
      corpo.ajustes.length,
    { error: 'a mesma chave aparece mais de uma vez', path: ['ajustes'] },
  );

/** Corpo fechado da troca de perfil (§4.1: `{ perfil, descartarAjustes? }`). */
const ESQUEMA_DA_TROCA_DE_PERFIL = z.strictObject({
  perfil: z.enum(PERFIS_ADMINISTRAVEIS),
  // Ausente é `false`, **nunca** consentimento (RN-11). O padrão mora aqui, num ponto só.
  descartarAjustes: z.boolean().default(false),
});

const ESQUEMA_DA_PESSOA = {
  type: 'object',
  required: ['usuarioId', 'nome', 'email', 'perfil', 'ativo'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    nome: { type: 'string' },
    email: { type: 'string', format: 'email' },
    perfil: { type: 'string', enum: [...PERFIS_ADMINISTRAVEIS] },
    ativo: { type: 'boolean' },
  },
};

const ESQUEMA_DA_PAGINA = {
  type: 'object',
  required: ['itens', 'total', 'limite', 'deslocamento'],
  properties: {
    itens: { type: 'array', items: ESQUEMA_DA_PESSOA },
    total: { type: 'integer', minimum: 0 },
    limite: { type: 'integer', minimum: 1 },
    deslocamento: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DA_PESSOA_ADMITIDA = {
  type: 'object',
  required: ['usuarioId', 'email', 'perfil', 'senhaProvisoria'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    perfil: { type: 'string', enum: [...PERFIS_ADMINISTRAVEIS] },
    senhaProvisoria: { type: 'string' },
  },
};

const ESQUEMA_DAS_PERMISSOES = {
  type: 'object',
  required: ['usuarioId', 'telas', 'acoes', 'versaoPermissoes'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    // Os dois enums saem do CATÁLOGO exportado, e não de uma lista redigitada: ele é fechado nas 17
    // chaves (RN-15), e uma cópia aqui deixaria o contrato publicado divergir do que a rota aceita.
    telas: { type: 'array', items: { type: 'string', enum: [...CHAVES_DE_TELA] } },
    acoes: { type: 'array', items: { type: 'string', enum: [...CHAVES_DE_ACAO] } },
    versaoPermissoes: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DO_PERFIL_TROCADO = {
  type: 'object',
  required: ['usuarioId', 'perfil', 'versaoPermissoes'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    perfil: { type: 'string', enum: [...PERFIS_ADMINISTRAVEIS] },
    versaoPermissoes: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DA_DESATIVACAO = {
  type: 'object',
  required: ['usuarioId', 'ativo', 'sessoesEncerradas'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    ativo: { type: 'boolean', enum: [false] },
    sessoesEncerradas: { type: 'integer', minimum: 0 },
  },
};

const ESQUEMA_DA_REATIVACAO = {
  type: 'object',
  required: ['usuarioId', 'ativo'],
  properties: {
    usuarioId: { type: 'string', format: 'uuid' },
    ativo: { type: 'boolean', enum: [true] },
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

@ApiTags('usuarios')
@Controller(CAMINHO_DOS_USUARIOS)
@ExigeChave('TELA:usuarios')
export class UsuarioController {
  constructor(@Inject(UsuarioService) private readonly usuarios: UsuarioService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria uma pessoa da empresa, com Senha provisória',
    description:
      'A pessoa nasce na empresa **da sessão de quem cria** — a empresa nunca é aceita pelo ' +
      'corpo. A Senha provisória é devolvida **uma única vez**: nenhuma consulta posterior a ' +
      'recupera. O perfil é escolhido entre `ADMIN_EMPRESA` e `USUARIO_EMPRESA`.',
  })
  @ApiCreatedResponse({
    description: 'A pessoa foi criada; a Senha provisória vai no corpo.',
    schema: ESQUEMA_DA_PESSOA_ADMITIDA,
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criarPessoa(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PessoaAdmitida> {
    return await this.usuarios.criarPessoa(
      // A sessão sai da GUARDA, nunca do corpo nem de um cabeçalho: é dela que vêm a empresa em que
      // a pessoa nasce e a autoria da emissão da Senha provisória (ADR-0013).
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DA_PESSOA_NOVA, corpo, 'corpo'),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista as pessoas da empresa',
    description:
      'Devolve **todas** as pessoas da empresa da sessão, de qualquer perfil — inclusive outros ' +
      'administradores e inclusive as desativadas, que é o que torna a reativação alcançável. ' +
      'A janela é declarável por `limite` e `deslocamento`.',
  })
  @ApiOkResponse({ description: 'A página pedida.', schema: ESQUEMA_DA_PAGINA })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listarPessoas(
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PaginaDePessoas> {
    return await this.usuarios.listarPessoas(
      sessaoDaRequisicao(requisicao),
      validar<JanelaDaListagem>(ESQUEMA_DA_JANELA, consulta, 'limite'),
    );
  }

  @Post(':id/permissoes')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Substitui os ajustes individuais de permissão da pessoa',
    description:
      'O corpo carrega o conjunto **completo**: os ajustes anteriores são substituídos, e um ' +
      'arranjo vazio remove todos. Uma ação sensível concedida sem a área de tela correspondente ' +
      'é recusada com `422` nomeando a tela exigida, **antes de qualquer escrita**. A resposta ' +
      'traz o efetivo novo e a versão de permissão que passa a datá-lo. **O alvo não pode ser ' +
      'quem age**: ajustar as próprias permissões responde `422` com ' +
      '`detalhes.motivo: "ALVO_E_QUEM_AGE"`.',
  })
  @ApiOkResponse({ description: 'O efetivo novo da pessoa.', schema: ESQUEMA_DAS_PERMISSOES })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ajustarPermissoes(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PermissoesAjustadas> {
    return await this.usuarios.ajustarPermissoes(
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      validar(ESQUEMA_DOS_AJUSTES, corpo, 'ajustes').ajustes,
    );
  }

  @Post(':id/perfil')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Troca o perfil da pessoa, descartando os ajustes individuais dela',
    description:
      'A troca **descarta todos** os ajustes individuais, porque eles são desvios sobre a matriz ' +
      'de um perfil. Havendo o que descartar, ela exige `descartarAjustes: true`: sem a intenção ' +
      'declarada, responde `422` com `detalhes.ajustesDescartados` e **nada muda** — nem o ' +
      'perfil, nem os ajustes, nem a versão de permissão. **O alvo não pode ser quem age**: trocar ' +
      'o próprio perfil responde `422` com `detalhes.motivo: "ALVO_E_QUEM_AGE"`.',
  })
  @ApiOkResponse({ description: 'O perfil novo da pessoa.', schema: ESQUEMA_DO_PERFIL_TROCADO })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async trocarPerfil(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PerfilTrocado> {
    return await this.usuarios.trocarPerfil(
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      validar(ESQUEMA_DA_TROCA_DE_PERFIL, corpo, 'perfil'),
    );
  }

  @Post(':id/desativacao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desativa a pessoa e encerra as sessões dela',
    description:
      'O encerramento acontece **no próprio ato**, na mesma transação da marcação, e alcança ' +
      'apenas as sessões **desta pessoa** — as demais pessoas da empresa seguem operando. ' +
      '`sessoesEncerradas` diz quantos registros foram apagados; repetir a desativação devolve ' +
      '`0`. Nada é apagado: os ajustes individuais permanecem, e a reativação os devolve. **O alvo ' +
      'não pode ser quem age**: a autodesativação responde `422` com ' +
      '`detalhes.motivo: "ALVO_E_QUEM_AGE"` — ela trancaria a administração da empresa.',
  })
  @ApiOkResponse({ description: 'A pessoa está desativada.', schema: ESQUEMA_DA_DESATIVACAO })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async desativar(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<PessoaDesativada> {
    return await this.usuarios.desativar(
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
  }

  @Post(':id/reativacao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reativa a pessoa',
    description:
      'Devolve a capacidade de entrar, e **não** as sessões que a desativação encerrou: os ' +
      'cookies anteriores continuam inválidos. O efetivo volta inteiro, com os ajustes ' +
      'individuais — nada havia sido apagado. **O alvo não pode ser quem age**: `422` com ' +
      '`detalhes.motivo: "ALVO_E_QUEM_AGE"`.',
  })
  @ApiOkResponse({ description: 'A pessoa está ativa.', schema: ESQUEMA_DA_REATIVACAO })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async reativar(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<PessoaReativada> {
    return await this.usuarios.reativar(
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
  }

  @Post(':id/senha-provisoria')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reemite a Senha provisória de uma pessoa da empresa',
    description:
      'A senha anterior deixa de servir no mesmo ato, e a recusa dela é **indistinguível** da ' +
      'recusa por credencial incorreta. A sessão da pessoa passa a ser restrita até que ela ' +
      'troque a senha. O alvo é qualquer pessoa da empresa, de qualquer perfil, **menos quem age**: ' +
      'reemitir a própria senha responde `422` com `detalhes.motivo: "ALVO_E_QUEM_AGE"` — para ' +
      'isso existe a troca de senha da própria sessão.',
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
  ): Promise<SenhaProvisoriaDaPessoa> {
    return await this.usuarios.reemitirSenha(
      sessaoDaRequisicao(requisicao),
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
  }
}
