/**
 * As **três rotas do cômodo** — o detalhe editável do imóvel, no molde que a T5 estabeleceu.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DO_CADASTRO)` na classe vale para os três manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar três vezes o mesmo valor criaria três lugares para esquecer um.
 *
 * **Nenhum dos três métodos declara exigência própria**, e a ausência é decisão, não descuido: a
 * ADR-0018 e o marcador `DECISÃO FECHADA` de {@link ./conjunto.controller.ts} fixam que a declaração
 * do método **substitui** a da classe em vez de somar-se a ela. Se alguma destas rotas precisasse
 * exigir algo além da área, a forma seria `@ExigeChaves` com a **conjunção inteira** — nunca só o
 * acréscimo. O `CT-355` varre a aplicação e acusa qualquer manipulador que exija menos que a classe.
 *
 * **Remover cômodo NÃO exige `ACAO:excluir_cadastro`**, e a assimetria com a retirada do imóvel é
 * deliberada. A ação sensível existe para a *saída de circulação de um cadastro* — o que a §4.1 da
 * tech spec atribui às seis rotas de circulação de conjunto, imóvel e pessoa. O cômodo não é
 * cadastro nesse sentido: a ADR-0014 o exclui nominalmente do alcance da exclusão lógica por não ser
 * referenciável, e remover um cômodo é **corrigir a planta**, exatamente como alterá-lo. Exigir a
 * ação aqui tornaria a correção de uma metragem digitada errada mais privilegiada do que a alteração
 * do endereço do imóvel inteiro. A tabela da §4.1 registra as três rotas com `TELA:imoveis` e nada
 * mais, e é ela que o inventário de `cobertura-de-autorizacao.e2e.spec.ts` afirma.
 *
 * ---------------------------------------------------------------------------
 * O caminho é COMPOSTO a partir do dono do segmento
 * ---------------------------------------------------------------------------
 *
 * `CAMINHO_DOS_COMODOS` deriva de `CAMINHO_DOS_IMOVEIS`, e não é escrito à mão: o cômodo é
 * sub-recurso do imóvel, e duas cadeias literais ficariam livres para divergir num renomeio que o
 * compilador não veria. É a mesma razão pela qual as suítes compõem os pares em vez de os digitar.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que chama `emUnidadeDeTrabalho`, e o serviço recebe o executor. É o que faz a
 * escrita do cômodo e a releitura do imóvel — que devolve o agregado recalculado — caberem num
 * commit só, sem tocar o marcador que recusa aninhamento em
 * `packages/db/src/unidade-de-trabalho.ts`.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS identificadores são validados e CANONIZADOS antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * `ESQUEMA_DO_IDENTIFICADOR`, de `@sysloc/contracts`, valida a **forma** e canoniza a caixa dos
 * dois: o do imóvel e o do cômodo. A validação acontece antes de a unidade de trabalho abrir — um
 * valor malformado é recusado com `422` sem tocar o banco, em vez de virar `404` depois de uma ida
 * inútil, e sem que a forma do identificador se torne um oráculo de existência. **O esquema é
 * importado, nunca redigitado.**
 *
 * ---------------------------------------------------------------------------
 * NÃO existe rota de LEITURA de cômodo
 * ---------------------------------------------------------------------------
 *
 * As três respondem com o **imóvel inteiro**, já recalculado. O cômodo é detalhe de composição, e
 * não entidade com ciclo de vida próprio: publicá-lo isoladamente criaria uma segunda projeção do
 * mesmo dado — e, com ela, uma segunda oportunidade de a `metragemTotal` divergir.
 */

import { Body, Controller, Delete, HttpCode, Inject, Param, Post, Put, Req } from '@nestjs/common';
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
import {
  ESQUEMA_DO_IDENTIFICADOR,
  esquemaDeComodoNovo,
  esquemaDoImovel,
  type Imovel,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { ComodoService } from './comodo.service.js';
import { CAMINHO_DOS_IMOVEIS } from './imovel.controller.js';

/**
 * Caminho da superfície de cômodos, relativo ao prefixo de versão
 * (§4.1: `/v1/imoveis/:id/comodos/…`).
 *
 * Composto a partir do dono do segmento — ver o cabeçalho deste arquivo.
 */
export const CAMINHO_DOS_COMODOS = `${CAMINHO_DOS_IMOVEIS}/:id/comodos`;

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * É a **mesma** de `imovel.controller.ts`, e o valor é repetido em vez de importado de lá porque a
 * exigência é propriedade declarada de **cada** controlador: importá-la faria trocar a área do
 * imóvel trocar, em silêncio, a do cômodo junto. A coincidência entre as duas é afirmada pelo
 * inventário de `cobertura-de-autorizacao.e2e.spec.ts`, que é escrito à mão exatamente por isso.
 */
const AREA_DO_CADASTRO = 'TELA:imoveis' as const;

/** Nome de campo usado quando a recusa é do identificador do imóvel na rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo usado quando a recusa é do identificador do cômodo na rota. */
const CAMPO_DO_COMODO = 'comodoId';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

@ApiTags('imoveis')
@Controller(CAMINHO_DOS_COMODOS)
@ExigeChave(AREA_DO_CADASTRO)
export class ComodoController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a escrita do cômodo e a releitura do imóvel um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(ComodoService) private readonly comodos: ComodoService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Acrescenta um cômodo ao imóvel',
    description:
      'A resposta é o **imóvel inteiro**, com `comodos` ordenados por posição e `metragemTotal` ' +
      'já recalculada — o cômodo não tem representação própria na API. A `posicao` é atribuída ' +
      'pelo servidor (`max(posicao) + 1`) e **não é aceita no corpo**. `metragem` ausente vale ' +
      '`0` (RN-02); `null` explícito é recusado com `422`. Imóvel de outra empresa é ' +
      'indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiCreatedResponse({
    description: 'O imóvel, com o cômodo novo e a metragem recalculada.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async acrescentar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const imovelId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const entrada = validar(esquemaDeComodoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const imovel = await this.comodos.acrescentar(tx, imovelId, entrada);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: 'comodo', imovelId, acao: 'acrescentado' },
        'cômodo do imóvel alterado',
      );

      return imovel;
    });
  }

  @Put(':comodoId')
  @ApiOperation({
    summary: 'Reescreve um cômodo do imóvel',
    description:
      'O corpo é **completo**: não há atualização parcial nesta superfície, e campo ausente é ' +
      'recusa por campo obrigatório. A `posicao` **não é tocada** — alterar a metragem não ' +
      'reordena a planta. A resposta é o imóvel inteiro, com `metragemTotal` já recalculada, o ' +
      'que dispensa uma segunda ida. Cômodo que não pertence a este imóvel responde `404`, com o ' +
      'mesmo corpo de cômodo inexistente.',
  })
  @ApiOkResponse({
    description: 'O imóvel, com o cômodo alterado e a metragem recalculada.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Param('comodoId') identificadorDoComodo: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const imovelId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const comodoId = validar(ESQUEMA_DO_IDENTIFICADOR, identificadorDoComodo, CAMPO_DO_COMODO);
    const entrada = validar(esquemaDeComodoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const imovel = await this.comodos.alterar(tx, imovelId, comodoId, entrada);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: 'comodo',
          id: comodoId,
          imovelId,
          acao: 'alterado',
        },
        'cômodo do imóvel alterado',
      );

      return imovel;
    });
  }

  @Delete(':comodoId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove um cômodo do imóvel',
    description:
      '**O cômodo é removido de fato** — é a exceção que a ADR-0014 declara, porque ele é detalhe ' +
      'de composição e nada o referencia. As posições dos cômodos remanescentes **não são ' +
      'reatribuídas**: remover o do meio deixa `1` e `3`. A resposta é o imóvel inteiro, já sem ' +
      'ele e com `metragemTotal` recalculada.',
  })
  @ApiOkResponse({
    description: 'O imóvel, sem o cômodo removido e com a metragem recalculada.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async remover(
    @Param('id') identificador: string,
    @Param('comodoId') identificadorDoComodo: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const imovelId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const comodoId = validar(ESQUEMA_DO_IDENTIFICADOR, identificadorDoComodo, CAMPO_DO_COMODO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const imovel = await this.comodos.remover(tx, imovelId, comodoId);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: 'comodo',
          id: comodoId,
          imovelId,
          acao: 'removido',
        },
        'cômodo do imóvel alterado',
      );

      return imovel;
    });
  }
}
