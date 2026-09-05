/**
 * As **cinco rotas do ciclo de vida do Admin Empresa** vistas pelo operador do SaaS — a listagem por
 * empresa, a suspensão, a reativação, a correção cadastral e a **remoção definitiva**.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de PERFIL
 * ---------------------------------------------------------------------------
 *
 * `@ExigePerfil('SYSLOC_MASTER')` na classe vale para os cinco manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar cinco vezes o mesmo valor criaria cinco lugares para esquecer um; e declarar
 * algo **no método** de uma classe que já declara **substitui** a exigência da classe, em silêncio.
 * Vale inclusive para a **remoção definitiva**: ela é destrutiva e irreversível, e ainda assim não
 * declara nada própria — declarar o mesmo perfil no método apagaria a exigência da classe em vez de
 * reforçá-la, e o verbo mais perigoso do arquivo seria o único fora do metadado que a guarda lê.
 *
 * A **dimensão** é a de perfil, e não uma chave do catálogo, porque o catálogo é declarado fechado
 * nas 17 áreas e ações do app da imobiliária: a ADR-0011 rejeita por escrito a alternativa de
 * inflá-lo com chaves sintéticas para as rotas do operador. É a forma literal do
 * {@link ./empresa.controller.js} irmão.
 *
 * **Nenhuma destas rotas reavalia a autorização.** Quem decide é a guarda, uma vez, com a exigência
 * declarada aqui.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas — este arquivo NASCE conforme à ADR-0016
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de resposta é escrita à mão aqui: `esquemaPublicado` (de
 * `comum/esquema-publicado.ts`, `z.toJSONSchema`) traduz **o mesmo objeto** que descreve o contrato,
 * de modo que não existe caminho pelo qual os dois divirjam sem que alguém tenha alterado o esquema.
 * A `Decision` da ADR-0016 é categórica na segunda metade: *"Nenhuma descrição de contrato é escrita
 * à mão em paralelo ao esquema"*.
 *
 * ⚠️ **O arquivo irmão desta pasta escreve JSON-Schema à mão, e ele NÃO é o molde.** Aquilo é a
 * minoria da base — **15 dos 22** controladores derivam — e é débito registrado da fatia, com gatilho
 * próprio; copiar a forma dele propagaria a divergência para código que ainda não existia. O molde
 * imitado aqui é `imoveis/imovel.controller.ts`. **Nada em `empresa.controller.ts` foi tocado**: a
 * conversão daquelas seis descrições reescreveria a publicação de rotas já entregues sem defeito que
 * a motive, e o Protocolo Antirregressão proíbe refatorar fora da causa-raiz.
 *
 * ---------------------------------------------------------------------------
 * Os esquemas são LOCAIS — e moram em {@link ./administrador.contrato.js}
 * ---------------------------------------------------------------------------
 *
 * Locais, e não de `@syslocbr/contracts`, pela razão da **ADR-0039** que aquele módulo registra por
 * extenso. E **fora deste arquivo**, porque a `Decision` da ADR-0016 enumera **três** derivados — a
 * conferência de entrada, **o tipo da resposta** e o documento publicado —, e o do meio é do serviço.
 * Declará-los aqui obrigava o serviço a redigitar os tipos à mão, que é o que a rodada 1 fez e o que
 * o `P1` do Gate 2 reprovou: `impedimentos` era `z.array(z.string())` no documento publicado e
 * `readonly ClasseDeImpedimento[]` no tipo, e nada tinha como acusar a divergência.
 *
 * ⚠️ **A regra alcança TODO esquema da rota, entrada inclusive** — não apenas os de saída. A janela
 * da listagem é entrada e mora lá; o corpo da correção cadastral
 * (`ESQUEMA_DO_ADMINISTRADOR_ALTERADO`) também. A **única** exceção é o corpo vazio compartilhado
 * (`comum/esquema-de-corpo-vazio.ts`), que não é desta superfície e já tem casa única na base. Se
 * uma rota nova precisar de um esquema, ele nasce no módulo de contrato, com o tipo derivado ao
 * lado — nunca aqui, e nunca duas vezes.
 *
 * ---------------------------------------------------------------------------
 * O `:id` é validado antes de qualquer consulta — e NÃO é canonizado
 * ---------------------------------------------------------------------------
 *
 * `z.uuid()` valida a **forma**, e a validação acontece antes de o banco ser tocado: um valor
 * malformado é recusado com `422` sem uma ida inútil, em vez de virar `404` — e sem que a forma do
 * identificador se torne um oráculo de existência.
 *
 * A ausência do `.toLowerCase()` que o `ESQUEMA_DO_IDENTIFICADOR` de `@syslocbr/contracts` aplica é
 * **deliberada, e é a propriedade que a superfície do Master já tem**: o marcador `DÉBITO COM
 * GATILHO — D37 · F1/T8`, em {@link ./empresa.controller.js}, declara essa assimetria por escrito e
 * fixa o gatilho dela na *primeira comparação do `:id` do Master com identidade da sessão*. Nenhuma
 * rota deste arquivo compara — o eco do corpo sai do valor validado e a coluna é do tipo `uuid`, que
 * o servidor compara sem sensibilidade a caixa. Canonizar só aqui instalaria **dentro** de
 * `/v1/master` a divergência que aquele marcador declara não existir.
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
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar, validarConsulta } from '../comum/validacao.js';
import {
  type AdministradorDoContrato,
  ESQUEMA_DA_JANELA,
  ESQUEMA_DA_PAGINA,
  ESQUEMA_DA_REATIVACAO,
  ESQUEMA_DA_REMOCAO,
  ESQUEMA_DA_SUSPENSAO,
  ESQUEMA_DO_ADMINISTRADOR_ALTERADO,
  ESQUEMA_DO_ADMINISTRADOR_DO_MASTER,
  type PaginaDeAdministradores,
  type ReativacaoDoAdministrador,
  type RemocaoDoAdministrador,
  type SuspensaoDoAdministrador,
} from './administrador.contrato.js';
import { AdministradorService } from './administrador.service.js';
import { CAMINHO_DO_MASTER } from './empresa.controller.js';

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/**
 * O identificador que chega no caminho — validado antes de qualquer consulta.
 *
 * Ver o cabeçalho para por que ele **não** canoniza a caixa do UUID.
 */
const ESQUEMA_DO_IDENTIFICADOR = z.uuid();

// TODOS os esquemas destas cinco rotas — a janela e o corpo da correção, que são **entrada**; a
// prévia de exclusão, o item, o envelope, os dois corpos de transição e o da remoção, que são
// saída — vivem em `./administrador.contrato.ts`, com o tipo derivado ao lado de cada um. O
// corpo das duas transições é **vazio e fechado** (`ESQUEMA_DO_CORPO_VAZIO`, de
// `comum/esquema-de-corpo-vazio.js`): o estado novo é decidido pelo servidor e nenhum campo é
// aceito, de modo que um cliente que enviasse `{"estado":"ATIVO"}` recebe `422` nomeando o corpo em
// vez de um `200` que descarta o que ele mandou em silêncio. A razão por extenso, e por que a
// definição é única na base, estão no docblock daquele módulo (débito D23).

@ApiTags('master')
@Controller(CAMINHO_DO_MASTER)
@ExigePerfil('SYSLOC_MASTER')
export class AdministradorController {
  constructor(
    @Inject(AdministradorService) private readonly administradores: AdministradorService,
  ) {}

  @Get('empresas/:id/administradores')
  @ApiOperation({
    summary: 'Lista os Admin Empresa de uma empresa',
    description:
      'Devolve identificação, estado e a **prévia de exclusão** de cada administrador, e ' +
      '**nenhum dado de negócio** da empresa (RN-13). Só o perfil `ADMIN_EMPRESA` é alcançado: o ' +
      'Usuário Empresa e o próprio operador não aparecem. O `usuarioId` de cada linha é o que a ' +
      'reemissão de Senha provisória consome — nada precisa ter sido anotado antes. A janela é ' +
      'declarável por `limite` e `deslocamento`, e pedido acima do teto **recusa** em vez de ' +
      'truncar em silêncio. Empresa inexistente responde `404`, nunca uma página vazia.',
  })
  @ApiOkResponse({
    description: 'A página pedida.',
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listar(
    @Param('id') identificador: string,
    @Query() consulta: unknown,
  ): Promise<PaginaDeAdministradores> {
    const empresaId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await this.administradores.listar(
      empresaId,
      validarConsulta(ESQUEMA_DA_JANELA, consulta),
    );
  }

  @Post('usuarios/:id/suspensao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Suspende o acesso de um Admin Empresa e encerra as sessões dele',
    description:
      'O encerramento acontece **no próprio ato**, na mesma transação da marcação: os registros ' +
      'de sessão da pessoa são apagados, e `sessoesEncerradas` diz quantos foram. O alcance é por ' +
      '**pessoa**, e não por empresa — a colega ativa da mesma empresa continua operando no mesmo ' +
      'instante. Repetir a suspensão de quem já está suspenso devolve o mesmo corpo, com ' +
      '`sessoesEncerradas: 0`. Alvo de outro perfil responde `422` nomeando o perfil exigido e o ' +
      'do alvo (ADR-0013), **sem encerrar sessão alguma**. O corpo é **vazio e fechado**: o ' +
      'estado novo é decidido pelo servidor, e qualquer campo enviado é recusado com `422` ' +
      'nomeando o corpo, em vez de descartado em silêncio.',
  })
  @ApiOkResponse({
    description: 'O administrador está suspenso.',
    schema: esquemaPublicado(ESQUEMA_DA_SUSPENSAO, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async suspender(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<SuspensaoDoAdministrador> {
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await this.administradores.suspender(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      // A autoria do ato sai da SESSÃO que a guarda resolveu — nunca do corpo nem de um cabeçalho.
      // É o que torna a trilha uma afirmação sobre quem agiu, e não sobre quem disse ter agido.
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }

  @Post('usuarios/:id/reativacao')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reativa o acesso de um Admin Empresa suspenso',
    description:
      'Devolve a capacidade de entrar, e **não** as sessões que a suspensão encerrou (RN-04): os ' +
      'cookies anteriores continuam inválidos, e a pessoa entra de novo. Nenhum trabalho é ' +
      'enfileirado — a retomada de notícias bancárias retidas é efeito da reativação de ' +
      '**empresa**, não desta. Repetir sobre quem já está ativo devolve o mesmo corpo. O corpo ' +
      'da requisição é **vazio e fechado**, como o da suspensão.',
  })
  @ApiOkResponse({
    description: 'O administrador está ativo.',
    schema: esquemaPublicado(ESQUEMA_DA_REATIVACAO, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async reativar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<ReativacaoDoAdministrador> {
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await this.administradores.reativar(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }

  @Put('usuarios/:id')
  @ApiOperation({
    summary: 'Corrige o cadastro de um Admin Empresa',
    description:
      'Corpo **completo** — `nome` e `email` são obrigatórios —, e **fechado**: `estado`, ' +
      '`ativo`, `perfil` e `empresaId` não existem no esquema, e enviá-los recusa a requisição com ' +
      '`422` em vez de descartá-los em silêncio. Transição de estado tem **rota própria** ' +
      '(ADR-0021), de modo que editar quem está suspenso o mantém suspenso. A pessoa **entra com a ' +
      'Senha provisória que já recebeu** mesmo depois de o endereço ser corrigido: a credencial ' +
      'ancora no `usuarioId`, não no e-mail. Endereço já registrado por outra pessoa responde ' +
      '`422` nomeando `email`, **sem gravar nada**. Alvo de outro perfil responde `422` nomeando o ' +
      'perfil exigido e o do alvo (ADR-0013), **antes de qualquer escrita**. A resposta é a linha ' +
      'inteira da listagem, com a prévia de exclusão recomposta.',
  })
  @ApiOkResponse({
    description: 'O administrador, já corrigido, na mesma forma que a listagem publica.',
    schema: esquemaPublicado(ESQUEMA_DO_ADMINISTRADOR_DO_MASTER, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<AdministradorDoContrato> {
    // O `:id` é conferido ANTES do corpo, e a ordem é a das outras rotas deste arquivo: um
    // identificador malformado recusa sem que o corpo precise sequer ser lido.
    const usuarioId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await this.administradores.alterar(
      usuarioId,
      validar(ESQUEMA_DO_ADMINISTRADOR_ALTERADO, corpo ?? {}, CAMPO_DO_CORPO),
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }

  /**
   * Remove o Admin Empresa **de fato** — é a exceção que a **ADR-0038** declara ao alcance da
   * **ADR-0014**.
   *
   * A ADR-0014 fixa que *"entidade de cadastro do domínio nunca é removida fisicamente"*, e o
   * discriminador dela é **ser referenciável**. A ADR-0038 declara o **alcance** daquela decisão —
   * o schema `negocio` — e autoriza a remoção física em `identidade.empresa` e
   * `identidade.usuario`, com um critério que não é escrito na aplicação: a **integridade
   * referencial do banco**, *"nunca uma contagem"*. É a **segunda** ocorrência de `@Delete` desta
   * base; a primeira é o cômodo do imóvel, e a exceção dele é declarada pela própria ADR-0014
   * (detalhe de composição). Esta é de outra natureza, e por isso precisou de ADR própria.
   *
   * ⚠️ **A remoção é irreversível e não tem contrapartida lógica**: `identidade.usuario` não tem
   * `retirado_em` e não participa de listagem de circulação. Quando o banco recusa, a resposta
   * nomeia a **classe** do impedimento e a **alternativa** — e a alternativa é a suspensão, que é
   * onde mora o estado reversível.
   *
   * ⚠️ **A trilha de tentativas de entrada é IMPEDIMENTO, e nunca colateral** (RN-16): a ADR-0013 a
   * declara a mitigação do poder desta persona, e a ADR-0038 é literal — *"esta decisão nunca
   * destrói auditoria"*. `conta`, `dois_fatores` e `sessao` somem por cascata declarada no schema;
   * tudo o mais que aponta para a pessoa **recusa**.
   */
  @Delete('usuarios/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove um Admin Empresa em definitivo',
    description:
      '**A pessoa é removida de fato** — é a exceção que a ADR-0038 declara ao alcance da ' +
      'ADR-0014, e o critério é a **integridade referencial do banco**, nunca uma contagem. ' +
      'Credencial, segundo fator e sessões somem por cascata. Qualquer outro registro que aponte ' +
      'para a pessoa — a começar pela **trilha de tentativas de entrada**, que esta operação nunca ' +
      'destrói — impede a remoção: a resposta é `422` nomeando a **classe** do impedimento e a ' +
      '`alternativa` executável (`SUSPENSAO`), jamais a entidade ou a quantidade. A prévia por ' +
      'item da listagem antecipa esse desfecho, e vem da **mesma** tentativa desfeita. Alvo de ' +
      'outro perfil responde `422` nomeando o perfil exigido e o do alvo, **sem remover nada**.',
  })
  @ApiOkResponse({
    description: 'O administrador deixou de existir.',
    schema: esquemaPublicado(ESQUEMA_DA_REMOCAO, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async remover(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<RemocaoDoAdministrador> {
    // Nenhum corpo é conferido aqui, e a ausência é deliberada: o `DELETE` desta base não carrega
    // corpo — é a forma do único outro `@Delete` publicado (`imoveis/comodo.controller.ts`) —, e o
    // que identifica o alvo é o caminho. Conferir um corpo vazio obrigatório recusaria com `422`
    // um cliente HTTP que enviasse `{}` por conta própria, sem que nada disso fosse decisão de
    // contrato.
    return await this.administradores.excluir(
      validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR),
      sessaoDaRequisicao(requisicao).usuarioId,
    );
  }
}
