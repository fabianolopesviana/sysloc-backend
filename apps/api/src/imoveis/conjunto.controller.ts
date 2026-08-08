/**
 * As **seis rotas do conjunto** — o agrupamento de imóveis, e o molde que as quatro entidades
 * seguintes repetem.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave('TELA:imoveis')` na classe vale para os seis manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar seis vezes o mesmo valor criaria seis lugares para esquecer um.
 *
 * A dimensão é a de **chave**, e nunca a de perfil (§11.2): é o que permite ao Admin conceder e
 * retirar o alcance ao cadastro de imóveis por ajuste individual, com a negação individual vencendo
 * a matriz do perfil (ADR-0010). Uma exigência de perfil tornaria a matriz uma promessa vazia
 * exatamente na área que ela governa.
 *
 * ---------------------------------------------------------------------------
 * As DUAS rotas de circulação exigem a ÁREA **E** a AÇÃO — conjunção, não substituição
 * ---------------------------------------------------------------------------
 *
 * Retirar de circulação e recircular são as duas operações sensíveis desta superfície, e a §4.1 da
 * tech spec as marca com `+ ACAO:excluir_cadastro`. Elas declaram, no método,
 * `@ExigeChaves('TELA:imoveis', 'ACAO:excluir_cadastro')` — a **conjunção inteira**, e não apenas a
 * ação.
 *
 * A forma intuitiva — `@ExigeChave('ACAO:excluir_cadastro')` no método, contando com a área da
 * classe — **está errada, e o erro é silencioso**: `getAllAndOverride` faz a declaração do método
 * **substituir** a da classe, e `TELA:imoveis` desaparece daquelas duas rotas. A cobertura de
 * autorização segue verde, porque ela audita a **existência** da declaração, não o conteúdo dela.
 *
 * **A coerência do catálogo NÃO cobre essa lacuna**, e é o erro que custou o primeiro `REJEITADO`
 * desta task: a RN-02 garante que quem tem `ACAO:excluir_cadastro` tem também a área que a
 * **comporta** — e `MAPA_ACAO_TELA` mapeia essa ação para `TELA:cadastros`, **nunca** para
 * `TELA:imoveis`. Uma pessoa com `{TELA:cadastros, ACAO:excluir_cadastro}` — conjunto perfeitamente
 * coerente, concedido no uso normal a quem administra locador, locatário e fiador — recebia `403` em
 * `GET /v1/conjuntos` e **`200`** em `POST /v1/conjuntos/:id/retirada`: retirava e recirculava
 * qualquer conjunto da empresa numa área que lhe era negada, sem sequer conseguir listar o que
 * retirou.
 *
 * A decisão que torna isso exprimível — a conjunção, a semântica de "primeira ausente" e a cobertura
 * por conteúdo — é a **ADR-0018**, nascida deste defeito.
 *
 * **A ordem das duas chaves é conteúdo, e não estilo**: a recusa nomeia a **primeira** ausente
 * (RN-14). Com a área declarada antes da ação, quem tem a área e não tem a ação recebe
 * `detalhes.exigido: 'ACAO:excluir_cadastro'` — que é literalmente o que o `CT-320` exige, *"e não a
 * área, que a sessão possui"* —, e quem tem a ação e não tem a área recebe `'TELA:imoveis'`, que é a
 * direção que estava aberta.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que chama `emUnidadeDeTrabalho`, e o serviço recebe o executor. A razão está no
 * cabeçalho de `conjunto.service.ts` e no docblock de `ErroDeUnidadeAninhada`: enquanto cada serviço
 * abrir a própria unidade, a composição de dois serviços — o imóvel e os cômodos dele, que a fatia
 * traz em seguida — bate no aninhamento recusado, e a saída seria fundir serviços para satisfazer o
 * mecanismo de transação. Abrir na borda é a saída que o próprio marcador nomeia como preferível, e
 * por isso **ele não é tocado**.
 *
 * Todas as seis passam por {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma
 * abre unidade por conta própria: propriedade instalada por ponto sobrevive só até o ponto seguinte.
 * Ela era um método privado copiado byte a byte por três controladores — o débito **D12**, fechado
 * pela T9 no mesmo desenho de `comum/validacao.ts`.
 *
 * ---------------------------------------------------------------------------
 * A transição de estado é SUB-RECURSO, e o corpo é FECHADO
 * ---------------------------------------------------------------------------
 *
 * Retirar e recircular são **sub-recursos** de `POST` (`/retirada`, `/recirculacao`), e não campos
 * opcionais de um `PATCH`. A forma torna a operação nomeável na trilha e no contrato — e é o que
 * permite a cada uma declarar a própria exigência, que é precisamente o que a §4.1 pede delas.
 *
 * Os esquemas de entrada são `strictObject`: **chave desconhecida no corpo recusa a requisição**.
 * `empresaId` não aparece em nenhum deles porque é decidido pelo servidor a partir da sessão, e um
 * corpo que o carregasse seria fuga de tenant (ADR-0008). **Não há atualização parcial nesta
 * superfície**: o `PUT` carrega o corpo completo, e campo ausente é recusa por campo obrigatório,
 * nunca "preserve o que estava lá" (§4.1.1).
 *
 * O corpo das duas rotas de circulação é o objeto **vazio e fechado**: a marca de retirada é decidida
 * pelo servidor, e aceitá-la do cliente daria a ele o poder de datar a própria exclusão.
 *
 * ---------------------------------------------------------------------------
 * O `:id` é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * `ESQUEMA_DO_IDENTIFICADOR`, de `@sysloc/contracts`, valida a **forma** e canoniza a caixa. A
 * validação acontece antes de a unidade de trabalho abrir: um valor malformado é recusado com `422`
 * sem tocar o banco, em vez de virar `404` depois de uma ida inútil — e sem que a forma do
 * identificador se torne um oráculo de existência.
 *
 * A canonização não é cosmética, e a razão está por extenso naquele esquema e no marcador
 * `DECISÃO FECHADA` de `usuarios/usuario.controller.ts`: o Postgres renderiza `uuid` em minúsculas e
 * parseia hexadecimal sem distinguir caixa, enquanto `z.uuid()` devolve o valor verbatim — as duas
 * pontas concordam sobre a identidade e discordam sobre a grafia. **O esquema é importado, nunca
 * redigitado**: normalizar em dois pontos deixa os dois livres para divergir.
 *
 * ---------------------------------------------------------------------------
 * A CARTEIRA é expansão da listagem, e NÃO uma rota nova
 * ---------------------------------------------------------------------------
 *
 * `GET /v1/conjuntos?expandir=imoveis` devolve cada conjunto com os imóveis dele, e cada imóvel com
 * os cômodos e a metragem total. É a **mesma** rota da lista simples, sob a **mesma** exigência
 * (`TELA:imoveis`, declarada na classe): a superfície da API congela no marco de entrega, e uma
 * entrada a mais para congelar é uma a mais para o frontend religar e para o handoff descrever. As
 * seis rotas continuam seis, e o inventário do `CT-355` não muda.
 *
 * O parâmetro nasce no **esquema** (`esquemaDaJanelaDaCarteira`), e não numa descrição escrita à mão
 * aqui — é o que a ADR-0016 fixa. Consequência direta: `expandir=qualquercoisa` é recusado com `422`
 * nomeando o parâmetro sem que este arquivo escreva uma linha de conferência.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada. É a diferença entre estas rotas e as 15 da F1, que descrevem à mão —
 * o débito com gatilho que a própria ADR-0016 registra.
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
import {
  type Conjunto,
  ESQUEMA_DO_IDENTIFICADOR,
  EXPANSAO_DE_IMOVEIS,
  envelopeDeLista,
  esquemaDaJanelaDaCarteira,
  esquemaDeConjuntoNovo,
  esquemaDoConjunto,
  esquemaDoConjuntoComImoveis,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import {
  ConjuntoService,
  type PaginaDaCarteira,
  type PaginaDeConjuntos,
} from './conjunto.service.js';

/** Caminho da superfície de conjuntos, relativo ao prefixo de versão (§4.1: `/v1/conjuntos/…`). */
export const CAMINHO_DOS_CONJUNTOS = 'conjuntos';

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal repetido em três decoradores: ela aparece na classe **e** dentro
 * da conjunção das duas rotas de circulação, e é justamente a coincidência entre os três que faz o
 * "além disso" da §3 ser verdade. Três literais ficariam livres para divergir — e a divergência
 * seria muda, porque a cobertura de autorização audita a existência da declaração, não o conteúdo.
 */
const AREA_DO_CADASTRO = 'TELA:imoveis' as const;

/** A ação sensível que as duas rotas de circulação exigem **além** da área (ADR-0011, §4.1). */
const ACAO_DE_CIRCULACAO = 'ACAO:excluir_cadastro' as const;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é da cadeia de consulta. */
const CAMPO_DA_CONSULTA = 'limite';

/**
 * O corpo das duas rotas de circulação: **vazio e fechado** (§4.1.1).
 *
 * A marca de retirada é decidida pelo servidor; nenhum campo é aceito. Um corpo com qualquer chave é
 * recusado com `422` nomeando o corpo — o Zod reporta chave desconhecida de um `strictObject` com
 * caminho vazio, e é por isso que a recusa cai no campo padrão deste ponto de chamada.
 */
const ESQUEMA_DO_CORPO_VAZIO = z.strictObject({});

/** O envelope de lista de conjuntos, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDoConjunto);

/**
 * O envelope da carteira: o **mesmo** envelope, com o item expandido (ADR-0017).
 *
 * A rota é uma só e devolve uma das duas formas conforme `expandir`, e por isso o documento publicado
 * declara a **união** delas: descrever apenas a simples faria o documento mentir sobre a resposta
 * expandida, e descrever apenas a expandida prometeria ao cliente uma chave que a resposta padrão não
 * traz. As duas derivam dos esquemas de `@sysloc/contracts`, e nenhuma é escrita à mão (ADR-0016).
 */
const ESQUEMA_DA_PAGINA_OU_CARTEIRA = z.union([
  ESQUEMA_DA_PAGINA,
  envelopeDeLista(esquemaDoConjuntoComImoveis),
]);

@ApiTags('conjuntos')
@Controller(CAMINHO_DOS_CONJUNTOS)
@ExigeChave(AREA_DO_CADASTRO)
export class ConjuntoController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(ConjuntoService) private readonly conjuntos: ConjuntoService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um conjunto de imóveis',
    description:
      'O conjunto nasce na empresa **da sessão de quem cria** — a empresa nunca é aceita pelo ' +
      'corpo — e **em circulação**: `retiradoEm` sai nulo.',
  })
  @ApiCreatedResponse({
    description: 'O conjunto foi criado.',
    schema: esquemaPublicado(esquemaDoConjunto, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Conjunto> {
    const entrada = validar(esquemaDeConjuntoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const criado = await this.conjuntos.criar(tx, entrada);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: 'conjunto', id: criado.id },
        'cadastro criado',
      );

      return criado;
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Lista os conjuntos da empresa, com a carteira sob demanda',
    description:
      'Devolve apenas os conjuntos **em circulação**; `incluirRetirados=true` alcança também os ' +
      'que foram retirados (ADR-0014). A janela é declarável por `limite` e `deslocamento`, e ' +
      'pedido acima do teto **recusa** em vez de truncar em silêncio.\n\n' +
      '`expandir=imoveis` devolve a **carteira**: cada conjunto com os imóveis dele, e cada imóvel ' +
      'com os cômodos ordenados por posição e a `metragemTotal` — numa consulta só, e idêntica à ' +
      'composição das leituras individuais. Sem `expandir`, o item **não traz a chave `imoveis`**. ' +
      'A decisão de circulação vale para os dois níveis: nenhum retirado aparece em nível algum da ' +
      'árvore, e `incluirRetirados=true` alcança os dois.',
  })
  @ApiOkResponse({
    description: 'A página pedida — simples, ou expandida quando `expandir=imoveis`.',
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA_OU_CARTEIRA, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listar(
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PaginaDeConjuntos | PaginaDaCarteira> {
    // O esquema vem **inteiro** de `@sysloc/contracts` e não é composto aqui. Ele nasceu declarado
    // neste arquivo e foi copiado byte a byte para `imovel.controller.ts`; os três controladores de
    // pessoa seriam a terceira, a quarta e a quinta cópias **de uma vez**, e a ADR-0016 fixa o
    // esquema como fonte única do contrato. A razão de `incluirRetirados` ser união fechada de dois
    // literais, e não `z.coerce.boolean()`, está por extenso no docblock de
    // `esquemaDaJanelaComCirculacao` — é lá que ela passou a morar (fecho da metade
    // `incluirRetirados` do débito D7).
    //
    // `esquemaDaJanelaDaCarteira` é aquele mesmo, **estendido** com `expandir`: o teto que recusa, o
    // padrão da página e a união fechada de `incluirRetirados` continuam vindo de um lugar só, e
    // nenhuma recusa que existia deixou de existir. `expandir` é união fechada de um literal, de
    // modo que um valor inventado é recusado com `422` nomeando o parâmetro — o Zod reporta o
    // caminho `['expandir']`, e é ele que `validar()` publica em `campo`.
    //
    // A comparação abaixo é contra `EXPANSAO_DE_IMOVEIS`, **importado** de `@sysloc/contracts` e
    // nunca redigitado nem lido por posição do arranjo: um literal escrito aqui ficaria livre para
    // divergir do que o esquema aceita, e a divergência seria muda — o esquema aprovaria
    // `expandir=imoveis` e o manipulador devolveria a lista simples. O arranjo publicado deriva
    // daquela constante, e por isso acrescentar uma expansão nova não move o valor comparado.
    const { incluirRetirados, expandir, ...janela } = validar(
      esquemaDaJanelaDaCarteira,
      consulta,
      CAMPO_DA_CONSULTA,
    );

    return await sobContextoDaSessao(this.banco, requisicao, async (tx) =>
      expandir === EXPANSAO_DE_IMOVEIS
        ? await this.conjuntos.listarCarteira(tx, janela, { incluirRetirados })
        : await this.conjuntos.listar(tx, janela, { incluirRetirados }),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lê um conjunto pelo identificador',
    description:
      'Alcança também o conjunto **retirado de circulação**, que responde `200` com `retiradoEm` ' +
      'preenchido — sem isso a recirculação ficaria inalcançável pela interface. Conjunto de outra ' +
      'empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'O conjunto pedido.',
    schema: esquemaPublicado(esquemaDoConjunto, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Conjunto> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.conjuntos.ler(tx, id),
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Reescreve um conjunto',
    description:
      'O corpo é **completo**: não há atualização parcial nesta superfície, e campo ausente é ' +
      'recusa por campo obrigatório. A marca de circulação não é tocada por esta rota.',
  })
  @ApiOkResponse({
    description: 'O conjunto como ele ficou.',
    schema: esquemaPublicado(esquemaDoConjunto, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Conjunto> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const entrada = validar(esquemaDeConjuntoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.conjuntos.alterar(tx, id, entrada),
    );
  }

  @Post(':id/retirada')
  @HttpCode(200)
  // DECISÃO FECHADA — T5 / Gate 1 · 2026-08-06
  // O QUÊ: as duas rotas de circulação declaram a CONJUNÇÃO `TELA:imoveis` + `ACAO:excluir_cadastro`
  //        por `@ExigeChaves`, nesta ordem — nunca `@ExigeChave` só com a ação.
  // POR QUÊ: `getAllAndOverride` SUBSTITUI. Com só a ação declarada aqui, `TELA:imoveis` desaparecia
  //          destas duas rotas, e a mitigação "a coerência do catálogo garante a área" é FALSA neste
  //          controlador: `MAPA_ACAO_TELA['ACAO:excluir_cadastro'] === 'TELA:cadastros'`. Uma sessão
  //          com `{TELA:cadastros, ACAO:excluir_cadastro}` — conjunto coerente, concedido no uso
  //          normal — recebia `403` na listagem e `200` na retirada. Foi o CRÍTICO de segurança que
  //          rejeitou esta task na rodada 1.
  // REVERTER EXIGE: provar que a declaração do MÉTODO deixou de substituir a da CLASSE — isto é,
  //                 que a guarda passou a COMPOR as duas —, OU que este controlador deixou de
  //                 declarar exigência na classe. **Coincidência entre a área da classe e
  //                 `MAPA_ACAO_TELA[ACAO]` NÃO satisfaz esta condição**, e a ressalva é o ponto: a
  //                 T9 publica estas mesmas duas rotas em `/locadores`, `/locatarios` e
  //                 `/fiadores`, cuja classe declara `TELA:cadastros` — exatamente a área que o mapa
  //                 associa à ação. Um `REVERTER EXIGE` escrito sobre essa coincidência estaria
  //                 SATISFEITO lá, e autorizaria declarar só a ação — reabrindo a vulnerabilidade
  //                 num controlador onde ela é ainda mais difícil de ver. Duas razões para a
  //                 coincidência não bastar: ela contradiria o `CT-355`, que acusa a substituição
  //                 por ESTRUTURA (e marcador que discorda da rede empurra quem o segue a
  //                 "consertar" a rede); e a garantia passaria a ser a coerência do catálogo, que é
  //                 **validação de aplicação** — a mesma classe de garantia que a ADR-0008 rejeita
  //                 por escrito, e a mesma premissa falsa que rejeitou esta task na rodada 1. A
  //                 exigência de uma rota não pode depender de um mapa que outra decisão governa.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Retira o conjunto de circulação',
    description:
      '**Nada é apagado** (ADR-0014): o conjunto some dos seletores e continua legível por quem já ' +
      'o referencia. A operação é **idempotente** — repetir mantém a MESMA marca e responde `200`. ' +
      'O corpo é vazio e fechado: a marca é decidida pelo servidor.',
  })
  @ApiOkResponse({
    description: 'O conjunto, agora com a marca de retirada.',
    schema: esquemaPublicado(esquemaDoConjunto, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async retirar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Conjunto> {
    return await this.definirCirculacao(identificador, corpo, requisicao, false);
  }

  @Post(':id/recirculacao')
  @HttpCode(200)
  // A MESMA conjunção da retirada, e pela mesma razão — ver o marcador `DECISÃO FECHADA` acima. As
  // duas rotas movem a mesma coluna em sentidos opostos; exigir coisas diferentes delas seria abrir
  // um caminho para desfazer o que o outro exige.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Devolve o conjunto à circulação',
    description:
      'Zera a marca de retirada. É o que torna a retirada reversível — e é por ela existir que ' +
      '`GET /v1/conjuntos/:id` alcança o conjunto retirado. O corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O conjunto, de volta à circulação.',
    schema: esquemaPublicado(esquemaDoConjunto, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async recircular(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Conjunto> {
    return await this.definirCirculacao(identificador, corpo, requisicao, true);
  }

  /**
   * As duas rotas de circulação, num ponto só — elas diferem em **um** valor.
   *
   * Escrever as duas por extenso deixaria livres para divergir a validação do identificador, a do
   * corpo fechado e a linha de trilha; e o que separa retirar de recircular é o sentido, que é
   * justamente o argumento.
   */
  private async definirCirculacao(
    identificador: string,
    corpo: unknown,
    requisicao: FastifyRequest,
    emCirculacao: boolean,
  ): Promise<Conjunto> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const conjunto = await this.conjuntos.definirCirculacao(tx, id, emCirculacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: 'conjunto',
          id: conjunto.id,
          acao: emCirculacao ? 'recirculacao' : 'retirada',
        },
        'circulação de cadastro alterada',
      );

      return conjunto;
    });
  }
}
