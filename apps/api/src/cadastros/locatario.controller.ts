/**
 * As **seis rotas do locatário** — um dos três papéis de cadastro de pessoa, no molde que a T5
 * estabeleceu.
 *
 * ---------------------------------------------------------------------------
 * O COMPORTAMENTO mora em `superficie-de-cadastro.ts`; aqui moram os DECORADORES
 * ---------------------------------------------------------------------------
 *
 * Os três papéis têm a mesma forma, e o que os separa é o caminho da rota e o papel fixado. As seis
 * operações estão escritas **uma vez** em {@link SuperficieDeCadastro}, e este arquivo as declara: o
 * caminho, a etiqueta do documento, a exigência de autorização e a forma publicada de cada resposta.
 * A razão de a divisão ser exatamente esta — comportamento compartilhado, decoradores por extenso —
 * está no cabeçalho daquele módulo, e ela não é estética: a exigência é auditada por **conteúdo**, e
 * conteúdo que não está escrito não se audita.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DO_CADASTRO)` na classe vale para os seis manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar seis vezes o mesmo valor criaria seis lugares para esquecer um.
 *
 * A dimensão é a de **chave**, e nunca a de perfil (§11.2): é o que permite ao Admin conceder e
 * retirar o alcance ao cadastro de pessoas por ajuste individual, com a negação individual vencendo a
 * matriz do perfil (ADR-0010).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ AS DUAS ROTAS DE CIRCULAÇÃO DECLARAM A CONJUNÇÃO INTEIRA — e aqui a armadilha é INVISÍVEL
 * ---------------------------------------------------------------------------
 *
 * Elas declaram `@ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)` — a **conjunção inteira**, e não
 * apenas a ação. A forma intuitiva (`@ExigeChave` no método, contando com a área da classe) está
 * errada e o erro é **silencioso**: `getAllAndOverride` faz a declaração do método **substituir** a da
 * classe (ADR-0018).
 *
 * **Nesta superfície o defeito seria invisível por comportamento**, e é por isso que ele é mais
 * perigoso aqui do que onde foi descoberto: a área da classe é `TELA:cadastros`, que é exatamente
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`. Declarar só a ação produziria, por coincidência, a mesma
 * área exigida — e nenhuma prova comportamental reprovaria. O marcador `DECISÃO FECHADA` de
 * `imoveis/conjunto.controller.ts` **antecipa este arquivo por escrito** e nega expressamente que a
 * coincidência satisfaça o `REVERTER EXIGE` dele; **é ele que governa esta escolha aqui também**, e
 * por isso não é copiado — marcador replicado apodrece, porque o original é corrigido e a cópia não.
 * A rede que acusa a substituição é o `CT-355`, que varre a aplicação por **estrutura** e nomeia
 * qualquer manipulador que exija menos do que a classe dele.
 *
 * **A ordem das duas chaves é conteúdo, e não estilo**: a recusa nomeia a **primeira** ausente
 * (RN-14). Com a área declarada antes da ação, quem tem a área e não tem a ação recebe
 * `detalhes.exigido: 'ACAO:excluir_cadastro'`.
 *
 * ---------------------------------------------------------------------------
 * O PAPEL É FIXADO AQUI, e nunca decidido pela requisição
 * ---------------------------------------------------------------------------
 *
 * `'locatario'` entra como argumento na construção da superfície, a partir da união fechada
 * {@link PAPEIS_DE_PESSOA}. Nenhum segmento de caminho, cabeçalho ou campo de corpo escolhe tabela: a
 * rota é o que decide, e a rota é este arquivo.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada.
 */

import {
  Body,
  Controller,
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
import { esquemaDaPessoa, type Pessoa } from '@sysloc/contracts';
import { type AcessoAoBanco, PAPEIS_DE_PESSOA } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CadastroDePessoaService, type PaginaDePessoas } from './cadastro-de-pessoa.service.js';
import {
  ACAO_DE_CIRCULACAO,
  AREA_DO_CADASTRO,
  DESCRICOES,
  ESQUEMA_DA_PAGINA,
  SuperficieDeCadastro,
} from './superficie-de-cadastro.js';

/** Caminho da superfície de locatários, relativo ao prefixo de versão (§4.1: `/v1/locatarios/…`). */
export const CAMINHO_DOS_LOCATARIOS = 'locatarios';

/**
 * O papel que este controlador serve, tirado da união **fechada** que `@sysloc/db` publica.
 *
 * Indexado, e não redigitado: um literal solto aqui compilaria mesmo depois de o papel deixar de
 * existir na porta, e a escrita cairia numa tabela que ninguém mais mantém.
 */
const PAPEL = PAPEIS_DE_PESSOA[1];

@ApiTags('locatarios')
@Controller(CAMINHO_DOS_LOCATARIOS)
@ExigeChave(AREA_DO_CADASTRO)
export class LocatarioController {
  /** As seis operações, com o papel já fixado. Ver `superficie-de-cadastro.ts`. */
  private readonly superficie: SuperficieDeCadastro;

  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) banco: AcessoAoBanco,
    @Inject(CadastroDePessoaService) cadastros: CadastroDePessoaService,
    @Inject(TOKEN_LOGGER) logger: Logger,
  ) {
    this.superficie = new SuperficieDeCadastro(PAPEL, banco, cadastros, logger);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um locatário', description: DESCRICOES.criar })
  @ApiCreatedResponse({
    description: 'O cadastro foi criado.',
    schema: esquemaPublicado(esquemaDaPessoa, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Pessoa> {
    return await this.superficie.criar(corpo, requisicao);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os locatários da empresa', description: DESCRICOES.listar })
  @ApiOkResponse({
    description: 'A página pedida.',
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listar(
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PaginaDePessoas> {
    return await this.superficie.listar(consulta, requisicao);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lê um locatário pelo identificador', description: DESCRICOES.ler })
  @ApiOkResponse({
    description: 'O cadastro pedido.',
    schema: esquemaPublicado(esquemaDaPessoa, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Pessoa> {
    return await this.superficie.ler(identificador, requisicao);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Reescreve um locatário', description: DESCRICOES.alterar })
  @ApiOkResponse({
    description: 'O cadastro como ele ficou.',
    schema: esquemaPublicado(esquemaDaPessoa, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Pessoa> {
    return await this.superficie.alterar(identificador, corpo, requisicao);
  }

  @Post(':id/retirada')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem. Ver o cabeçalho deste arquivo e, por extenso,
  // o marcador `DECISÃO FECHADA` de `imoveis/conjunto.controller.ts`, que nomeia ESTE controlador:
  // declarar aqui apenas a ação SUBSTITUIRIA a exigência da classe, e a substituição seria **muda por
  // comportamento**, porque `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é a mesma `TELA:cadastros`.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Retira um locatário de circulação',
    description: DESCRICOES.retirar,
  })
  @ApiOkResponse({
    description: 'O cadastro, agora com a marca de retirada.',
    schema: esquemaPublicado(esquemaDaPessoa, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async retirar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Pessoa> {
    return await this.superficie.definirCirculacao(identificador, corpo, requisicao, false);
  }

  @Post(':id/recirculacao')
  @HttpCode(200)
  // A MESMA conjunção da retirada, e pela mesma razão. As duas rotas movem a mesma coluna em sentidos
  // opostos; exigir coisas diferentes delas seria abrir um caminho para desfazer o que a outra exige.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Devolve um locatário à circulação',
    description: DESCRICOES.recircular,
  })
  @ApiOkResponse({
    description: 'O cadastro, de volta à circulação.',
    schema: esquemaPublicado(esquemaDaPessoa, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async recircular(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Pessoa> {
    return await this.superficie.definirCirculacao(identificador, corpo, requisicao, true);
  }
}
