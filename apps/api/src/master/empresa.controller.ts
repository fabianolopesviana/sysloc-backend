/**
 * As **oito rotas do operador do SaaS** — o ciclo de vida da empresa, a **correção cadastral**, a
 * **remoção definitiva** e a admissão de administradores.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de PERFIL
 * ---------------------------------------------------------------------------
 *
 * `@ExigePerfil('SYSLOC_MASTER')` na classe vale para os oito manipuladores — a guarda lê o
 * metadado com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método
 * não declara nada próprio. Declarar oito vezes o mesmo valor criaria oito lugares para esquecer um.
 * Vale inclusive para a **remoção definitiva** da empresa: ela é o verbo mais perigoso do arquivo —
 * apaga um tenant inteiro — e ainda assim não declara nada própria, porque declarar o mesmo perfil
 * no método **substituiria** a exigência da classe em silêncio, em vez de reforçá-la.
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
 * `/v1/master` sem violar o congelamento — o que congela é a superfície que o `@syslocbr/contracts`
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
 *
 * ---------------------------------------------------------------------------
 * As descrições de saída seguem a FORMA LOCAL deste arquivo — e isso é contenção, não licença
 * ---------------------------------------------------------------------------
 *
 * Este arquivo escreve JSON-Schema **à mão**, contra a metade categórica da `Decision` da
 * **ADR-0016** (*"Nenhuma descrição de contrato é escrita à mão em paralelo ao esquema"*). O irmão
 * {@link ./administrador.controller.js} nasceu conforme, derivando o documento do próprio Zod por
 * `esquemaPublicado(...)` — como **15 dos 22** controladores da base.
 *
 * As duas rotas da T6 (`PUT` e `DELETE` de `/empresas/:id`) seguem a forma **daqui**, e a razão é o
 * Protocolo Antirregressão: converter as seis descrições existentes reescreveria a publicação de
 * **seis rotas já entregues** sem que critério de aceite algum o peça, e a §4.5 proíbe refatorar
 * fora da causa-raiz. A divergência é **contida** — ela não cresce para arquivo novo — e está
 * agendada pelo `DÉBITO COM GATILHO — D22 · F7/T6`, logo acima de {@link ESQUEMA_DA_EMPRESA}.
 *
 * ⚠️ **Não "aproveite que está aqui" para converter as seis.** Se a conversão parecer certa, ela é
 * task própria, autorizada, com a baseline das seis rotas medida antes e depois.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
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
import { CLASSES_DE_IMPEDIMENTO } from './administrador.contrato.js';
import {
  type AdministradorAdmitido,
  type EmpresaDoContrato,
  type EmpresaListada,
  EmpresaService,
  MAIOR_PAGINA_DE_EMPRESAS,
  PAGINA_PADRAO_DE_EMPRESAS,
  type PaginaDeEmpresas,
  type ReativacaoDaEmpresa,
  type RemocaoDaEmpresa,
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

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

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
 * Corpo fechado da **correção cadastral** da empresa (R6, US-05, RN-07).
 *
 * ---------------------------------------------------------------------------
 * É o MESMO objeto da criação, e a igualdade é a decisão — não uma economia
 * ---------------------------------------------------------------------------
 *
 * As duas rotas escrevem **as mesmas duas colunas** de `identidade.empresa`, e a camada de dados já
 * declarou essa identidade: `alterarEmpresa(tx, empresaId, dados: EmpresaNova)` reusa o tipo da
 * criação. Uma segunda declaração com a mesma forma ficaria livre para divergir — o teto de `nome`
 * subiria de um lado e a borda passaria a aceitar, sobre a mesma coluna, o que a outra recusa.
 * Aqui há **uma** declaração e **dois nomes de contrato**, um por rota.
 *
 * ---------------------------------------------------------------------------
 * O que ele NÃO aceita é o conteúdo da decisão
 * ---------------------------------------------------------------------------
 *
 * `estado`, `suspensaEm` e `empresaId` **não existem** aqui, e o `strictObject` os recusa nomeando a
 * chave em vez de descartá-los em silêncio:
 *
 * - `estado` — a **ADR-0021** é categórica na primeira metade: transição de estado acontece em
 *   **rota própria**, nunca como campo gravado por uma atualização de cadastro. As rotas são
 *   `POST /v1/master/empresas/:id/suspensao` e `.../reativacao`, e elas existem. Um `z.object` no
 *   lugar deste responderia `200` **ignorando** a chave, e o operador acreditaria ter reativado uma
 *   empresa que continua suspensa — é o que o `CT-1247` reprova.
 * - `suspensaEm` — o instante é gravado pelo servidor (`coalesce(suspensa_em, now())`, ADR-0026), e
 *   aceitá-lo do corpo deixaria o cliente reescrever quando a suspensão teria acontecido.
 * - `empresaId` — a empresa alcançada é a do **caminho da rota**; aceitá-la também do corpo criaria
 *   uma segunda origem de identidade, livre para contradizer a primeira.
 *
 * ⚠️ **É `PUT` com corpo COMPLETO, e não atualização parcial**: os dois campos são obrigatórios. É a
 * forma canônica do repositório (`@Put(':id')` em 5 manipuladores, `@Patch` em nenhum), e ela evita
 * a ambiguidade de "ausente" significar ora *"não mexa"*, ora *"apague"*.
 */
export const ESQUEMA_DA_EMPRESA_ALTERADA = ESQUEMA_DA_EMPRESA_NOVA;

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

// DÉBITO COM GATILHO — D22 · F7/T6 · registrado 2026-09-02
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: as SEIS descrições de contrato escritas à mão neste arquivo — `ESQUEMA_DA_EMPRESA`,
//        `ESQUEMA_DA_PAGINA`, `ESQUEMA_DA_SUSPENSAO`, `ESQUEMA_DA_REATIVACAO`,
//        `ESQUEMA_DO_ADMINISTRADOR_ADMITIDO` e `ESQUEMA_DA_SENHA_REEMITIDA` — contrariam a metade
//        categórica da `Decision` da ADR-0016 (*"Nenhuma descrição de contrato é escrita à mão em
//        paralelo ao esquema"*). ⚠️ O débito NÃO alcança `./administrador.contrato.ts` nem
//        `./administrador.controller.ts`, que nasceram conformes.
// QUANDO FECHA: a primeira task autorizada a abrir este arquivo **para reformar a publicação do
//        contrato** — a conversão é para `esquemaPublicado(...)` (`comum/esquema-publicado.ts`),
//        que já existe e é usado por **15 dos 22** controladores da base.
// POR QUE NÃO AGORA: converter reescreveria a descrição publicada de rotas **já em produção** sem
//        que critério de aceite algum o peça, e o Protocolo Antirregressão proíbe refatorar fora da
//        causa-raiz (§4.5). As três descrições que a T6 acrescenta seguem a forma daqui pela mesma
//        razão: a divergência é contida, e não cresce para arquivo novo.
// ÍNDICE: docs/specs/features/painel-master-administradores/v1/_run/run-report.md §2, D22
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

/**
 * A **prévia de exclusão** publicada por item (US-07, ADR-0030).
 *
 * `motivo` e `alternativa` ficam fora de `required` porque **só existem quando a exclusão está
 * indisponível**: publicá-los sempre obrigaria a inventar um motivo para quem não tem impedimento
 * algum, e o cliente teria de olhar `disponivel` para saber se deve ler os outros dois. A ausência
 * já diz isso.
 *
 * ⚠️ **`impedimentos` publica o vocabulário FECHADO da RN-15, e não `string`.** O enum vem de
 * {@link CLASSES_DE_IMPEDIMENTO}, importado de {@link ./administrador.contrato.js} — que é a
 * **única** declaração publicada dele, amarrada ao domínio nas duas direções (o
 * `as const satisfies readonly ClasseDeImpedimento[]` de lá impede um valor que não seja classe, e a
 * atribuição do campo derivado impede uma classe do domínio ausente). Uma segunda tupla escrita aqui
 * não teria a segunda amarra: esquecer uma classe compilaria, e o documento entregue ao cliente
 * prometeria menos do que o servidor cumpre — que é exatamente o defeito que o Gate 2 da T4 pegou.
 */
const ESQUEMA_DA_EXCLUSAO = {
  type: 'object',
  required: ['disponivel', 'impedimentos'],
  properties: {
    disponivel: { type: 'boolean' },
    motivo: { type: 'string' },
    impedimentos: { type: 'array', items: { type: 'string', enum: [...CLASSES_DE_IMPEDIMENTO] } },
    alternativa: { type: 'string' },
  },
};

/**
 * A empresa **como a listagem e a correção cadastral a publicam** — a de cima, mais `exclusao`.
 *
 * Ela é composta a partir de {@link ESQUEMA_DA_EMPRESA}, e não redigitada: as cinco chaves têm uma
 * declaração só, e um campo acrescentado lá aparece aqui sem que ninguém precise lembrar.
 *
 * ⚠️ **A criação (`POST /empresas`) continua publicando {@link ESQUEMA_DA_EMPRESA}, sem `exclusao`**,
 * e a assimetria é decisão: uma empresa que acabou de nascer é elegível por construção, e compor a
 * prévia ali custaria a sonda — que é o próprio ato em ensaio desfeito (ADR-0030) — para responder
 * uma pergunta cuja resposta é conhecida. Publicar o campo naquela rota também mudaria o corpo de
 * uma rota entregue sem que critério de aceite algum o peça.
 */
const ESQUEMA_DA_EMPRESA_LISTADA = {
  type: 'object',
  required: [...ESQUEMA_DA_EMPRESA.required, 'exclusao'],
  properties: { ...ESQUEMA_DA_EMPRESA.properties, exclusao: ESQUEMA_DA_EXCLUSAO },
};

const ESQUEMA_DA_PAGINA = {
  type: 'object',
  required: ['itens', 'total', 'limite', 'deslocamento'],
  properties: {
    itens: { type: 'array', items: ESQUEMA_DA_EMPRESA_LISTADA },
    total: { type: 'integer', minimum: 0 },
    limite: { type: 'integer', minimum: 1 },
    deslocamento: { type: 'integer', minimum: 0 },
  },
};

/**
 * O que a **remoção definitiva** devolve (R7, US-09, ADR-0038).
 *
 * ⚠️ **Não confunda com {@link ESQUEMA_DA_EXCLUSAO}, e não troque um pelo outro**: aquele é a
 * **prévia** — o artefato derivado que a listagem publica por item, dizendo se o ato *seria* aceito
 * (ADR-0030) —, e este é o **ato consumado**. São fatos diferentes sobre momentos diferentes, e
 * fundi-los faria a resposta do `DELETE` carregar um `disponivel` que já não descreve nada.
 *
 * O corpo existe porque a rota responde `200`, e não `204`: uma resposta sem corpo obrigaria o
 * cliente a inferir o alvo do ato a partir da requisição que ele mandou, e o eco do `id` é o que
 * fecha o par pedido/efeito na mesma forma dos dois corpos de transição acima. `removida` é `const:
 * true` pela mesma razão que `estado` é enum de um valor ali: o desfecho é único — a recusa sai pelo
 * envelope de erro, nunca por um `removida: false`.
 *
 * ⚠️ **`removida`, e não `removido`.** A concordância de gênero é a convenção medida desta
 * superfície — `criadaEm`/`suspensaEm` para a empresa contra `criadoEm` para a pessoa —, e o corpo
 * irmão de `DELETE /v1/master/usuarios/:id` publica `removido`.
 */
const ESQUEMA_DA_REMOCAO = {
  type: 'object',
  required: ['id', 'removida'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    removida: { type: 'boolean', const: true },
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

  @Put('empresas/:id')
  @ApiOperation({
    summary: 'Corrige o cadastro da empresa',
    description:
      'Corpo **completo** — `nome` e `documento` são obrigatórios —, e **fechado**: `estado`, ' +
      '`suspensaEm` e `empresaId` não existem no esquema, e enviá-los recusa a requisição com ' +
      '`422` em vez de descartá-los em silêncio. Transição de estado tem **rota própria** ' +
      '(ADR-0021), de modo que corrigir uma empresa suspensa a mantém suspensa, com o mesmo ' +
      'instante de suspensão. Documento já registrado por outra empresa responde `422` nomeando ' +
      '`documento`, **sem gravar nada** — nem o `nome` válido que viajou no mesmo corpo. A ' +
      'resposta é a linha inteira da listagem, com a prévia de exclusão recomposta.',
  })
  @ApiOkResponse({
    description: 'A empresa, já corrigida, na mesma forma que a listagem publica.',
    schema: ESQUEMA_DA_EMPRESA_LISTADA,
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
  ): Promise<EmpresaListada> {
    // O `:id` é conferido ANTES do corpo, e a ordem é a das outras rotas deste arquivo: um
    // identificador malformado recusa sem que o corpo precise sequer ser lido.
    const empresaId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await this.empresas.alterar(
      empresaId,
      validar(ESQUEMA_DA_EMPRESA_ALTERADA, corpo ?? {}, CAMPO_DO_CORPO),
    );
  }

  /**
   * Remove a empresa **de fato** — é a exceção que a **ADR-0038** declara ao alcance da
   * **ADR-0014**.
   *
   * A ADR-0014 fixa que *"entidade de cadastro do domínio nunca é removida fisicamente"*, e o
   * alcance dela é o schema `negocio`. A ADR-0038 autoriza a remoção física em `identidade.empresa`
   * e `identidade.usuario`, com um critério que **não é escrito na aplicação**: a **integridade
   * referencial do banco**, *"nunca uma contagem"*.
   *
   * ⚠️ **Ela apaga um tenant inteiro, num único commit** — as pessoas da empresa e a empresa (RN-12,
   * `excluirEmpresa`). Cada administrador permanece sujeito ao **seu próprio** critério: se um só
   * for inelegível, a operação **inteira** é recusada e nada sai.
   *
   * ⚠️ **A recusa nunca vem de uma contagem.** Sob a sessão do Master, que corre com
   * `empresaId: null`, `count(*)` sobre `negocio` devolve **zero para uma empresa cheia** — a
   * política de linha é `FORCE` e a esconde. É o marcador `DECISÃO FECHADA` de
   * `IMPEDIMENTOS_DE_EXCLUSAO` (`@sysloc/db`) que registra a medição, e o `CT-1204` que a prova.
   */
  @Delete('empresas/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove uma empresa em definitivo, com os administradores dela',
    description:
      '**A empresa é removida de fato**, junto das pessoas dela e num **único commit** (RN-12) — é ' +
      'a exceção que a ADR-0038 declara ao alcance da ADR-0014, e o critério é a **integridade ' +
      'referencial do banco**, nunca uma contagem. Credencial, segundo fator e sessões de cada ' +
      'pessoa somem por cascata. Qualquer outro registro que aponte para a empresa — ou para um ' +
      'administrador dela, a começar pela **trilha de tentativas de entrada**, que esta operação ' +
      'nunca destrói — impede a remoção: a resposta é `422` nomeando a **classe** do impedimento e ' +
      'a `alternativa` executável (`SUSPENSAO`), jamais a entidade ou a quantidade. A prévia por ' +
      'item da listagem antecipa esse desfecho, e vem da **mesma** tentativa desfeita.',
  })
  @ApiOkResponse({
    description: 'A empresa deixou de existir.',
    schema: ESQUEMA_DA_REMOCAO,
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async excluir(@Param('id') identificador: string): Promise<RemocaoDaEmpresa> {
    // Nenhum corpo é conferido aqui, e a ausência é deliberada: o `DELETE` desta base não carrega
    // corpo — é a forma dos dois outros `@Delete` publicados (`imoveis/comodo.controller.ts` e
    // `master/administrador.controller.ts`) —, e o que identifica o alvo é o caminho. Conferir um
    // corpo vazio obrigatório recusaria com `422` um cliente HTTP que enviasse `{}` por conta
    // própria, sem que nada disso fosse decisão de contrato.
    return await this.empresas.excluir(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
    );
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
