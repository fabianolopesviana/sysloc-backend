/**
 * As **sete rotas do imóvel** — as seis do cadastro, no molde que a T5 estabeleceu, mais a de
 * **situação de locação**, que a fatia `contratos-de-locacao` acrescenta (T10).
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DO_CADASTRO)` na classe vale para os sete manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar sete vezes o mesmo valor criaria sete lugares para esquecer um.
 *
 * A dimensão é a de **chave**, e nunca a de perfil (§11.2): é o que permite ao Admin conceder e
 * retirar o alcance ao cadastro de imóveis por ajuste individual, com a negação individual vencendo
 * a matriz do perfil (ADR-0010).
 *
 * ---------------------------------------------------------------------------
 * As DUAS rotas de circulação exigem a ÁREA **E** a AÇÃO — conjunção, não substituição
 * ---------------------------------------------------------------------------
 *
 * Elas declaram `@ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)` — a **conjunção inteira**, e
 * não apenas a ação. A forma intuitiva (`@ExigeChave` no método, contando com a área da classe)
 * está errada e o erro é **silencioso**: `getAllAndOverride` faz a declaração do método
 * **substituir** a da classe, e a área desaparece daquelas duas rotas.
 *
 * A razão por extenso, com o defeito medido e explorável que a produziu, está no marcador
 * `DECISÃO FECHADA` de {@link ./conjunto.controller.ts} — **é ele que governa esta escolha aqui
 * também**, e por isso não é copiado: marcador replicado apodrece, porque o original é corrigido e a
 * cópia não. A decisão que o torna exprimível é a **ADR-0018**, e a rede que impede a substituição
 * de renascer nesta superfície é o `CT-355`, que varre a aplicação inteira e acusa qualquer
 * manipulador que exija **menos** do que a classe dele.
 *
 * **A ordem das duas chaves é conteúdo, e não estilo**: a recusa nomeia a **primeira** ausente
 * (RN-14). Com a área declarada antes da ação, quem tem a área e não tem a ação recebe
 * `detalhes.exigido: 'ACAO:excluir_cadastro'`, e quem tem a ação e não tem a área recebe o nome da
 * área — que é a direção pela qual o defeito da T5 era explorável.
 *
 * ---------------------------------------------------------------------------
 * A rota de SITUAÇÃO DE LOCAÇÃO exige apenas a ÁREA — e a leitura da ADR-0019 fica AQUI
 * ---------------------------------------------------------------------------
 *
 * `POST /:id/situacao-de-locacao` não declara nada no método: vale a exigência da classe,
 * `TELA:imoveis`, e nada além dela. A `Decision` da ADR-0019 diz *"rota própria, governada pela
 * chave de ação sensível correspondente do catálogo fechado"*, e **não existe ação sensível para
 * esta transição** — o catálogo é fechado nas sete, e a própria ADR registra entre os *Cons* que ele
 * não cresce sem decisão explícita (ADR-0011: nenhuma chave nova é criada nesta fatia).
 *
 * **A leitura adotada**: a ADR-0019 alcança **transição governada** — ativar, cancelar, retirar de
 * circulação —, e alternar entre disponível e indisponível é **atributo operacional do cadastro**,
 * não ato sensível. Ela se apoia nos *Neutros* da própria ADR (*"quais estados cada entidade tem é
 * decisão da fatia dela; esta ADR fixa a forma da transição"*), e a metade que importa — **rota
 * própria, nunca campo em atualização do recurso** — é obedecida ao pé da letra.
 *
 * **Isto é interpretação do texto, e não conformidade literal.** Fica declarado como tal para que um
 * gate futuro reconheça a decisão em vez de reabri-la, e para que a fatia que quiser rigor saiba
 * exatamente o que emendar: a `Decision` da ADR-0019, por `/agent-spec-adr-supersede 0019`.
 *
 * **Reusar `ACAO:excluir_cadastro` foi avaliado e descartado**: a ADR-0019 rejeita nominalmente esse
 * reuso nas Alternativas (*"são efeitos diferentes"*), e quem marca um imóvel em reforma passaria a
 * precisar da concessão de excluir cadastro.
 *
 * DÉBITO COM GATILHO — D43 · F2/T10 · registrado 2026-08-09
 * (Este marcador **agenda**, e não protege — ele é o oposto do `DECISÃO FECHADA` citado na seção
 *  anterior, que governa a conjunção das chaves de circulação e é intocável. Aqui a leitura acima é
 *  provisória por prazo declarado; lá a forma é definitiva.)
 * O QUÊ: esta rota governa uma **transição de estado sem chave de ação correspondente**. A metade da
 *        `Decision` da ADR-0019 que exige *"governada pela chave de ação sensível correspondente do
 *        catálogo fechado"* **não** é satisfeita — só a metade da forma (rota própria) é.
 * QUANDO FECHA: **antes do congelamento da superfície da API para o handoff**. É o instante em que o
 *        documento publicado passa a ser o contrato entregue ao frontend, e uma divergência entre a
 *        ADR e a superfície deixa de ser corrigível sem custo de contrato.
 * POR QUE NÃO AGORA: a emenda foi **oferecida e adiada por decisão do usuário** na sessão de
 *        challenge desta fatia (`_run/workflow-report.md`), e o catálogo de chaves é fechado pela
 *        ADR-0011 — criar `ACAO:*` nova aqui contrariaria uma ADR ativa para satisfazer outra.
 * ÍNDICE: docs/specs/features/contratos-de-locacao/v1/_run/run-report.md §2, D43
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que chama `emUnidadeDeTrabalho`, e o serviço recebe o executor. É o que torna a
 * composição da T7 — o imóvel e os cômodos dele — um commit só, sem tocar o marcador que recusa
 * aninhamento em `packages/db/src/unidade-de-trabalho.ts`.
 *
 * Todas as sete passam por {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma
 * abre unidade por conta própria: propriedade instalada por ponto sobrevive só até o ponto seguinte.
 * Ela era um método privado copiado byte a byte por três controladores — o débito **D12**, fechado
 * pela T9 no mesmo desenho de `comum/validacao.ts`.
 *
 * ---------------------------------------------------------------------------
 * NÃO existe sub-recurso para trocar o imóvel de conjunto
 * ---------------------------------------------------------------------------
 *
 * `conjuntoId` é campo do corpo como qualquer outro, e o `PUT` completo o altera (§5.2): corrigir o
 * agrupamento é operação de cadastro, sem efeito colateral que justifique nomeá-la. O destino passa
 * pela **mesma** conferência de alcance da criação — conjunto de outra empresa responde `404`, com
 * corpo idêntico ao de conjunto inexistente.
 *
 * ---------------------------------------------------------------------------
 * O `:id` é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * `ESQUEMA_DO_IDENTIFICADOR`, de `@sysloc/contracts`, valida a **forma** e canoniza a caixa. A
 * validação acontece antes de a unidade de trabalho abrir: um valor malformado é recusado com `422`
 * sem tocar o banco, em vez de virar `404` depois de uma ida inútil — e sem que a forma do
 * identificador se torne um oráculo de existência. **O esquema é importado, nunca redigitado**:
 * normalizar em dois pontos deixa os dois livres para divergir.
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
import {
  ESQUEMA_DO_IDENTIFICADOR,
  envelopeDeLista,
  esquemaDaJanelaComCirculacao,
  esquemaDaSituacaoDeLocacao,
  esquemaDeImovelAlterado,
  esquemaDeImovelNovo,
  esquemaDoImovel,
  type Imovel,
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
import { ImovelService, type PaginaDeImoveis } from './imovel.service.js';

/** Caminho da superfície de imóveis, relativo ao prefixo de versão (§4.1: `/v1/imoveis/…`). */
export const CAMINHO_DOS_IMOVEIS = 'imoveis';

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal repetido em três decoradores: ela aparece na classe **e** dentro
 * da conjunção das duas rotas de circulação, e é justamente a coincidência entre os três que faz o
 * "além disso" ser verdade. Três literais ficariam livres para divergir — e a divergência seria
 * muda para a verificação de existência, ainda que o `CT-355` a pegue por conteúdo.
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

/** O envelope de lista de imóveis, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDoImovel);

@ApiTags('imoveis')
@Controller(CAMINHO_DOS_IMOVEIS)
@ExigeChave(AREA_DO_CADASTRO)
export class ImovelController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(ImovelService) private readonly imoveis: ImovelService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Cria um imóvel',
    description:
      'O imóvel nasce na empresa **da sessão de quem cria** — a empresa nunca é aceita pelo ' +
      'corpo — e **em circulação**: `retiradoEm` sai nulo. O `conjuntoId` precisa ser alcançável ' +
      'no contexto da sessão: conjunto de outra empresa responde `404`, com o **mesmo** corpo de ' +
      'conjunto inexistente. O `identificadorMunicipal` é único por empresa e a unicidade ' +
      '**alcança os imóveis retirados de circulação**; a recusa é `422` nomeando o campo, com ' +
      '`detalhes.conflito` dizendo se o imóvel em conflito está `EM_CIRCULACAO` ou ' +
      '`RETIRADO_DE_CIRCULACAO`.',
  })
  @ApiCreatedResponse({
    description: 'O imóvel foi criado.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Imovel> {
    const entrada = validar(esquemaDeImovelNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const criado = await this.imoveis.criar(tx, entrada);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: 'imovel', id: criado.id },
        'cadastro criado',
      );

      return criado;
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Lista os imóveis da empresa',
    description:
      'Devolve apenas os imóveis **em circulação**; `incluirRetirados=true` alcança também os ' +
      'que foram retirados (ADR-0014). A janela é declarável por `limite` e `deslocamento`, e ' +
      'pedido acima do teto **recusa** em vez de truncar em silêncio.',
  })
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
  ): Promise<PaginaDeImoveis> {
    // O esquema vem **inteiro** de `@sysloc/contracts`. Ele estava aqui em cópia byte a byte da que
    // vivia em `conjunto.controller.ts`, e o docblock desta linha reconhecia a duplicação e a
    // reagendava; a T8 a fechou promovendo a composição ao pacote que a ADR-0016 declara fonte
    // única. A razão de `incluirRetirados` ser união fechada de dois literais, e não
    // `z.coerce.boolean()`, está por extenso no docblock de `esquemaDaJanelaComCirculacao`.
    const { incluirRetirados, ...janela } = validar(
      esquemaDaJanelaComCirculacao,
      consulta,
      CAMPO_DA_CONSULTA,
    );

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.imoveis.listar(tx, janela, { incluirRetirados }),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lê um imóvel pelo identificador',
    description:
      'Alcança também o imóvel **retirado de circulação**, que responde `200` com `retiradoEm` ' +
      'preenchido — sem isso a recirculação ficaria inalcançável pela interface. Imóvel de outra ' +
      'empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'O imóvel pedido.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('id') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.imoveis.ler(tx, id),
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Reescreve um imóvel',
    description:
      'O corpo é **completo**: não há atualização parcial nesta superfície, e campo ausente é ' +
      'recusa por campo obrigatório. **Mudar o imóvel de conjunto acontece por aqui** — ' +
      '`conjuntoId` é campo como outro qualquer, e o destino passa pela mesma conferência de ' +
      'alcance da criação. A marca de circulação **não** é tocada por esta rota, e a **situação ' +
      'de locação também não**: `statusLocacao` não pertence a este corpo e é recusado como chave ' +
      'desconhecida (`422`) — ela tem rota própria, `POST /v1/imoveis/:id/situacao-de-locacao`.',
  })
  @ApiOkResponse({
    description: 'O imóvel como ele ficou.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    // O esquema é o **derivado**, e não o da criação: `statusLocacao` sai daqui e o `strictObject`
    // o recusa como chave desconhecida. Ver o marcador `DECISÃO FECHADA` de `esquemaDeImovelAlterado`
    // em `packages/contracts/src/imovel.ts` — é ele que governa esta linha.
    const entrada = validar(esquemaDeImovelAlterado, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.imoveis.alterar(tx, id, entrada),
    );
  }

  @Post(':id/situacao-de-locacao')
  @HttpCode(200)
  // NENHUMA declaração no método, e a ausência é conteúdo: vale a exigência da classe,
  // `TELA:imoveis`, e nada além. A leitura da ADR-0019 que sustenta isso — e o reuso de
  // `ACAO:excluir_cadastro` que foi avaliado e descartado — está no cabeçalho deste arquivo.
  @ApiOperation({
    summary: 'Informa a situação de locação do imóvel',
    description:
      'Alterna o imóvel entre `DISPONIVEL` e `INDISPONIVEL` — *"não ofereça nas buscas"*. É a ' +
      '**única** porta por onde uma requisição escreve a situação de locação: ela saiu do corpo do ' +
      '`PUT`, e `LOCADO` **não é informável** (é produzido pela ativação de contrato, e informá-lo ' +
      'aqui é `422` por valor fora da união). Imóvel com **contrato vigente** é recusado com `422`, ' +
      '`campo: "statusLocacao"` e `detalhes: { conflito: "IMOVEL_COM_CONTRATO_VIGENTE" }` — o ' +
      '`LOCADO` que um contrato sustenta não se desfaz por atributo operacional; para liberá-lo, ' +
      'cancele o contrato. O corpo é fechado num campo só: qualquer outra chave é `422`.',
  })
  @ApiOkResponse({
    description: 'O imóvel como ele ficou.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async definirSituacaoDeLocacao(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const { statusLocacao } = validar(esquemaDaSituacaoDeLocacao, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const imovel = await this.imoveis.definirSituacaoDeLocacao(tx, id, statusLocacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: 'imovel',
          id: imovel.id,
          acao: 'situacao-de-locacao',
          statusLocacao: imovel.statusLocacao,
        },
        'situação de locação informada',
      );

      return imovel;
    });
  }

  @Post(':id/retirada')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem. Ver o cabeçalho deste arquivo e, por
  // extenso, o marcador `DECISÃO FECHADA` de `conjunto.controller.ts`: declarar aqui apenas a ação
  // SUBSTITUIRIA a exigência da classe, e `TELA:imoveis` sumiria desta rota em silêncio.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Retira o imóvel de circulação',
    description:
      '**Nada é apagado** (ADR-0014): o imóvel some dos seletores e continua legível por quem já ' +
      'o referencia — e continua ocupando o `identificadorMunicipal` dele. A operação é ' +
      '**idempotente**: repetir mantém a MESMA marca e responde `200`. O corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O imóvel, agora com a marca de retirada.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async retirar(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
    return await this.definirCirculacao(identificador, corpo, requisicao, false);
  }

  @Post(':id/recirculacao')
  @HttpCode(200)
  // A MESMA conjunção da retirada, e pela mesma razão. As duas rotas movem a mesma coluna em
  // sentidos opostos; exigir coisas diferentes delas seria abrir um caminho para desfazer o que a
  // outra exige.
  @ExigeChaves(AREA_DO_CADASTRO, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Devolve o imóvel à circulação',
    description:
      'Zera a marca de retirada. É o que torna a retirada reversível — e é por ela existir que ' +
      '`GET /v1/imoveis/:id` alcança o imóvel retirado. É também a saída de quem recebeu ' +
      '`detalhes.conflito: RETIRADO_DE_CIRCULACAO` ao tentar recadastrar. O corpo é vazio e ' +
      'fechado.',
  })
  @ApiOkResponse({
    description: 'O imóvel, de volta à circulação.',
    schema: esquemaPublicado(esquemaDoImovel, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async recircular(
    @Param('id') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Imovel> {
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
  ): Promise<Imovel> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const imovel = await this.imoveis.definirCirculacao(tx, id, emCirculacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: 'imovel',
          id: imovel.id,
          acao: emCirculacao ? 'recirculacao' : 'retirada',
        },
        'circulação de cadastro alterada',
      );

      return imovel;
    });
  }
}
