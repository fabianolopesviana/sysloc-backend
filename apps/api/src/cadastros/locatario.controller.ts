/**
 * As **sete rotas do locatário** — as seis do cadastro de pessoa, no molde que a T5 estabeleceu,
 * mais o **reenvio da confirmação de e-mail**, que é só dele.
 *
 * ---------------------------------------------------------------------------
 * A SÉTIMA rota, e por que ela mora aqui em vez de num controlador próprio
 * ---------------------------------------------------------------------------
 *
 * `POST /v1/locatarios/:id/confirmacao-de-email` age sobre o **cadastro do locatário**, é governada
 * pela **mesma área** (`TELA:cadastros`) e alcança o mesmo recurso pelo mesmo `:id`. Um controlador
 * próprio teria de redeclarar a etiqueta, a exigência e a leitura do identificador — três lugares
 * novos para divergir —, e a rota deixaria de herdar a exigência da classe, que é justamente o
 * mecanismo que a ADR-0018 governa aqui.
 *
 * Ela é o **gatilho manual** da RN-13. O gatilho automático não é rota: é o gancho que este
 * controlador supre à superfície compartilhada, e os dois convergem no **mesmo** caminho —
 * `ConfirmacaoDeEmailService.disparar`.
 *
 * ---------------------------------------------------------------------------
 * A superfície publicada do locatário é `esquemaDoLocatario`, e não `esquemaDaPessoa`
 * ---------------------------------------------------------------------------
 *
 * As seis rotas de cadastro deste arquivo declaram `esquemaDoLocatario`, que é o cadastro de pessoa
 * **mais** `emailConfirmadoEm`. Locador e fiador seguem com `esquemaDaPessoa`, e a assimetria é o
 * conteúdo: a coluna existe só em `negocio.locatario`, e publicar o campo para os outros dois seria
 * um recurso afirmando um fato que não existe para ele.
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
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { type AcessoAoBanco, PAPEIS_DE_PESSOA } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import {
  ESQUEMA_DO_IDENTIFICADOR,
  envelopeDeLista,
  esquemaDoLocatario,
  esquemaDoReenvioDeConfirmacao,
  type Pessoa,
  type ReenvioDeConfirmacao,
} from '@syslocbr/contracts';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CadastroDePessoaService, type PaginaDePessoas } from './cadastro-de-pessoa.service.js';
import { ConfirmacaoDeEmailService } from './confirmacao-de-email.service.js';
import {
  ACAO_DE_CIRCULACAO,
  AREA_DO_CADASTRO,
  DESCRICOES,
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

/**
 * O segmento da rota de reenvio, relativo ao `:id` do locatário.
 *
 * Constante nomeada porque o literal é **contrato publicado**: ele aparece no decorador e é o que a
 * âncora de superfície de `test/cobertura-de-autorizacao.e2e.spec.ts` compõe para conferir o par
 * método+caminho.
 */
const SEGMENTO_DA_CONFIRMACAO = 'confirmacao-de-email';

/** Nome de campo da recusa que não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo da recusa do corpo, quando o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/**
 * O envelope de lista **do locatário**, derivado do esquema dele — nunca redigitado (ADR-0016).
 *
 * Ele não reusa o `ESQUEMA_DA_PAGINA` da superfície compartilhada, e a diferença é o conteúdo: aquele
 * deriva de `esquemaDaPessoa` e serve a locador e fiador, que **não** publicam a confirmação. Um
 * envelope só para os três faria a listagem de locatários declarar menos do que ela devolve.
 */
const ESQUEMA_DA_PAGINA_DE_LOCATARIOS = envelopeDeLista(esquemaDoLocatario);

@ApiTags('locatarios')
@Controller(CAMINHO_DOS_LOCATARIOS)
@ExigeChave(AREA_DO_CADASTRO)
export class LocatarioController {
  /** As seis operações, com o papel já fixado. Ver `superficie-de-cadastro.ts`. */
  private readonly superficie: SuperficieDeCadastro;

  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(CadastroDePessoaService) cadastros: CadastroDePessoaService,
    @Inject(TOKEN_LOGGER) logger: Logger,
    // O disparo da confirmação — a única dependência que **não** é dos três papéis. Ver o gancho
    // logo abaixo: ele é suprido aqui, e em nenhum outro controlador.
    @Inject(ConfirmacaoDeEmailService) private readonly confirmacao: ConfirmacaoDeEmailService,
  ) {
    this.superficie = new SuperficieDeCadastro(
      PAPEL,
      banco,
      cadastros,
      logger,
      // O GANCHO do disparo automático (RN-07), e este é o único lugar do produto onde ele é
      // suprido. `SuperficieDeCadastro` é compartilhada pelos três papéis e **não sabe** o que ele
      // faz — a ignorância dela é o que impede o disparo de alcançar locador e fiador sem que uma
      // linha de comportamento específico de papel tenha de ser escrita lá dentro.
      async (tx, locatarioId, empresaId) => {
        const disparo = await this.confirmacao.disparar(tx, locatarioId, empresaId, 'cadastro');

        return disparo.entregar;
      },
    );
  }

  @Post()
  @ApiOperation({ summary: 'Cria um locatário', description: DESCRICOES.criar })
  @ApiCreatedResponse({
    description: 'O cadastro foi criado.',
    schema: esquemaPublicado(esquemaDoLocatario, 'output'),
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
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA_DE_LOCATARIOS, 'output'),
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
    schema: esquemaPublicado(esquemaDoLocatario, 'output'),
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
    schema: esquemaPublicado(esquemaDoLocatario, 'output'),
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
    schema: esquemaPublicado(esquemaDoLocatario, 'output'),
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
    schema: esquemaPublicado(esquemaDoLocatario, 'output'),
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

  @Post(`:id/${SEGMENTO_DA_CONFIRMACAO}`)
  @HttpCode(202)
  // ⚠️ **NENHUMA declaração de exigência aqui, e a ausência é a decisão.** `TELA:cadastros` vem da
  // CLASSE, e `getAllAndOverride` é substituição, não união (ADR-0018): declarar `@ExigeChave` no
  // método — mesmo repetindo a área — trocaria a exigência herdada por uma cópia dela, e nesta
  // superfície o erro seria **invisível por comportamento**, porque `TELA:cadastros` é exatamente
  // `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`. Ver o cabeçalho deste arquivo.
  //
  // E **nenhuma chave de ação nasce**: o catálogo 10×7 permanece fechado (RN-13). Reenviar a
  // confirmação é o mesmo ato de cadastro que a área já governa —
  // `packages/auth/src/catalogo-de-permissoes.ts` não é tocado.
  @ApiOperation({
    summary: 'Reenvia a confirmação de e-mail de um locatário',
    description:
      'Emite um portador novo, com prazo de 72 h, e **invalida todos os anteriores** do locatário ' +
      '(RN-09) — é a saída de quem não recebeu a mensagem. O corpo é vazio e fechado. A resposta é ' +
      '`202`, e não `200`, porque ela afirma só o que **já** aconteceu: o portador foi gravado e os ' +
      'anteriores foram invalidados. A **entrega corre fora da requisição** (ADR-0029), e por isso ' +
      'nenhuma chave do corpo fala sobre ela — um `200` prometeria um desfecho que a borda não tem.',
  })
  @ApiAcceptedResponse({
    description: 'O reenvio foi aceito; a entrega corre fora da requisição.',
    schema: esquemaPublicado(esquemaDoReenvioDeConfirmacao, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async reenviarConfirmacao(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<ReenvioDeConfirmacao> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    const disparo = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => await this.confirmacao.reenviar(tx, id, sessao.empresaId),
    );

    // DEPOIS do `COMMIT`, exatamente como no disparo automático: o portador já existe quando a
    // tarefa nasce, e a falha do servidor de fila não desfaz o que foi gravado.
    await disparo.entregar();

    // As DUAS chaves, e nenhuma outra. O corpo é montado aqui campo a campo, e não por espalhamento
    // do que o serviço devolveu: `ConfirmacaoDisparada` carrega também a continuação, e um
    // espalhamento a publicaria. O `CT-719` afirma o conjunto de chaves por igualdade.
    return {
      reenviadoEm: disparo.reenviadoEm.toISOString(),
      expiraEm: disparo.expiraEm.toISOString(),
    };
  }
}
