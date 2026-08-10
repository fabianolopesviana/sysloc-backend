/**
 * As **cinco rotas da cobrança** — lançar avulsa, ler a carteira, ler uma cobrança, acusar o
 * pagamento e cancelar.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e é de ÁREA — nenhuma chave de ação
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DO_FINANCEIRO)` na classe vale para os cinco manipuladores — a guarda lê o
 * metadado com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não
 * declara nada próprio. Declarar cinco vezes o mesmo valor criaria cinco lugares para esquecer um.
 *
 * **Nenhuma das cinco exige chave de ação, e a ausência é decisão registrada** (§11.2 da tech spec):
 * o catálogo fechado da ADR-0011 enumera **duas** ações sensíveis dentro de `TELA:financeiro` —
 * `ACAO:emitir_boleto` e `ACAO:solicitar_baixa_de_boleto` — e **nenhuma** para lançar, ler, pagar ou
 * cancelar cobrança. Quem fechou o catálogo tinha as operações de cobrança à vista e concedeu chave
 * própria só às que falam com o banco. Nenhuma chave nova nasce nesta fatia, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado** — precisar de uma chave nova aqui
 * seria sinal de escopo mal delimitado, e abrir o catálogo exigiria supersedê-la ADR-0011.
 *
 * **As duas transições entram por esse mesmo critério, e a classificação é decisão escalada e
 * confirmada antes da spec.** A ADR-0021 dá "apenas a área" ao ato que não transfere direito, não move
 * dinheiro e não altera o que outra entidade pode fazer: acusar pagamento **registra** dinheiro que se
 * moveu fora do sistema — não o move —, e o cancelamento tem substituta prevista, o que o torna
 * reversível. As alternativas recusadas foram abrir o catálogo com duas chaves novas (exigiria
 * supersedê-la ADR-0011, que o PRD §4.2 exclui nominalmente) e estender a ADR-0021 com uma terceira
 * instância declarada. **Não reabra.**
 *
 * Como não há declaração no método, **não existe nesta superfície o risco de substituição** que o
 * marcador `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} governa: `getAllAndOverride`
 * faz a declaração do método **substituir** a da classe, e é por isso que a rota que precisasse de uma
 * ação teria de declarar a **conjunção inteira**, nunca só a ação. O `CT-355` varre a aplicação e
 * acusa qualquer manipulador que exija menos do que a classe dele; estas cinco exigem exatamente o
 * que a classe exige, que é o que se quer.
 *
 * ---------------------------------------------------------------------------
 * A TRANSIÇÃO É ROTA PRÓPRIA, nunca campo de atualização (ADR-0021)
 * ---------------------------------------------------------------------------
 *
 * `POST :codigo/pagamento` e `POST :codigo/cancelamento` existem porque o estado da cobrança **não é
 * campo editável**: ele é derivado dos fatos gravados (ADR-0022), e `esquemaDeCobrancaNova` não tem
 * `status` — a ausência é o mecanismo, e não uma verificação. As duas são `POST` sobre um caminho
 * próprio pelo mesmo desenho das transições do contrato, e as duas abrem **uma** unidade de trabalho:
 * nenhuma emite número de série, de modo que o protocolo das duas unidades sequenciais não se aplica a
 * elas.
 *
 * ---------------------------------------------------------------------------
 * O LANÇAMENTO abre DUAS unidades de trabalho SEQUENCIAIS (ADR-0015, ADR-0020)
 * ---------------------------------------------------------------------------
 *
 * ```
 * unidade 1:  garantirSerie(tx)  → lê o ano do relógio do banco e cria o contador, e COMMITA
 * unidade 2:  conferência do contrato; emissão do número; gravação da linha; leitura pela visão
 * ```
 *
 * **A primeira unidade é obrigatória NESTA rota, e não só na ativação.**
 * `proximo_numero_de_cobranca` **consome** a sequência, nunca a cria, e a primeira cobrança de uma
 * empresa num ano pode nascer por aqui — a substituta de uma cancelada, ou uma conta de água num mês
 * em que nenhum contrato foi ativado. Omitir o passo faria a rota falhar exatamente no caso mais
 * banal (empresa nova, primeira cobrança avulsa do ano), e a falha só apareceria em produção.
 *
 * Se a criação da sequência e o `nextval` caíssem na mesma transação, o desfazimento apagaria a
 * sequência recém-criada e a cobrança seguinte tomaria `nextval = 1` outra vez — o número **seria
 * reusado**, contra a cláusula literal da ADR-0015 (*"nunca reusado, nem por criação abortada"*). Com
 * as duas unidades, a sequência já está commitada quando o `nextval` corre, e a criação abortada
 * queima o número para sempre: o furo que a ADR aceita por escrito, e que o `CT-536` mede.
 *
 * As duas **não aninham** — a segunda começa depois de a primeira fechar —, então o marcador
 * `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`, que recusa abrir uma segunda unidade
 * **de dentro** de uma aberta, **não é tocado**. É o molde literal do `criar` de
 * {@link ../contratos/contrato.controller.js}. As duas rotas de leitura abrem uma unidade só.
 *
 * O **ano** sai de dentro da primeira unidade e viaja para a segunda: ele é lido do relógio do banco
 * uma única vez, e é o mesmo valor que alimenta o contador, a emissão e o código.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor. As três passam por
 * {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta
 * própria nem chama `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a
 * sessão que a guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o ponto
 * seguinte.
 *
 * ---------------------------------------------------------------------------
 * A chave da rota é o CÓDIGO, e ele é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem **série declarada**, e por isso a chave exposta é o código legível — nunca o UUID
 * interno, que sequer sai da porta (ADR-0017). `ESQUEMA_DO_CODIGO_DE_COBRANCA`, de
 * `@sysloc/contracts`, valida a **forma** e canoniza a caixa (`trim` → maiúsculas). A validação
 * acontece antes de a unidade de trabalho abrir: um valor malformado é recusado com `422` sem tocar o
 * banco, em vez de virar `404` depois de uma ida inútil — e sem que a forma do identificador se torne
 * um oráculo de existência. **O esquema é importado, nunca redigitado**: normalizar em dois pontos
 * deixa os dois livres para divergir.
 *
 * ---------------------------------------------------------------------------
 * Nada aqui deriva estado, e o filtro por estado é PREDICADO, não conferência
 * ---------------------------------------------------------------------------
 *
 * `status` e `natureza` são recortes declarados **no esquema da janela**
 * (`esquemaDaJanelaDeCobrancas`), e por isso um rótulo fora da união fechada é `422` na borda — e não
 * uma consulta que devolve lista vazia sobre um rótulo que não existe. O valor que passa vira
 * predicado SQL sobre a visão, do lado do banco. **Não há neste arquivo uma condicional sobre estado
 * ou sobre vencimento**, e a razão está no cabeçalho de {@link CobrancaService} e no marcador
 * `DECISÃO FECHADA` de `packages/db/src/cobranca.ts`.
 *
 * ---------------------------------------------------------------------------
 * O LOG não carrega dinheiro nem dado do locatário (§13.1)
 * ---------------------------------------------------------------------------
 *
 * A linha de trilha do lançamento nomeia `empresaId`, `entidade`, `codigo` e `natureza` — e nada
 * mais. `valorOriginal`, `referencia` e `locatarioId` **ficam de fora** de propósito: a referência é
 * texto livre digitado pelo operador e pode conter qualquer coisa, e valor e locatário são o que a
 * §13.1 nomeia como sensível. As duas leituras não registram linha alguma — trilha de leitura em rota
 * de listagem é ruído por requisição, sem fato novo a registrar.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada.
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
import {
  type Cobranca,
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  envelopeDeLista,
  esquemaDaCobranca,
  esquemaDaJanelaDeCobrancas,
  esquemaDeCobrancaNova,
  esquemaDoPagamentoDeCobranca,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CobrancaService, type PaginaDeCobrancas } from './cobranca.service.js';

/** Caminho da superfície de cobranças, relativo ao prefixo de versão (§4.1: `/v1/cobrancas/…`). */
export const CAMINHO_DAS_COBRANCAS = 'cobrancas';

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal solto no decorador: o valor é **contrato publicado** — ele aparece
 * no corpo da recusa que o cliente lê, em `detalhes.exigido` —, e ter nome é o que permite ao `CT-533`
 * auditá-lo por conteúdo sem casar uma cadeia escrita em dois lugares.
 */
const AREA_DO_FINANCEIRO = 'TELA:financeiro' as const;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_CODIGO = 'codigo';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é da cadeia de consulta. */
const CAMPO_DA_CONSULTA = 'limite';

/** A entidade nomeada na linha de trilha desta superfície — escrita uma vez (§13.1). */
const ENTIDADE_DA_TRILHA = 'cobranca';

/** O envelope da carteira, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDaCobranca);

/**
 * O corpo do cancelamento é **vazio e fechado** (§3.1), e é `ESQUEMA_DO_CORPO_VAZIO`, importado de
 * `comum/esquema-de-corpo-vazio.js`.
 *
 * O instante do cancelamento é decidido pelo servidor — sai do relógio do banco —, e nenhum campo é
 * aceito. É a mesma forma, e a mesma razão, das rotas de transição de
 * {@link ../contratos/contrato.controller.js}; a razão por extenso, e por que a definição é única,
 * estão no docblock do módulo comum (débito D23).
 */

/** Os dois segmentos de transição, escritos uma vez — eles entram no par que o `CT-533` audita. */
const SEGMENTO_DO_PAGAMENTO = ':codigo/pagamento';
const SEGMENTO_DO_CANCELAMENTO = ':codigo/cancelamento';

@ApiTags('cobrancas')
@Controller(CAMINHO_DAS_COBRANCAS)
@ExigeChave(AREA_DO_FINANCEIRO)
export class CobrancaController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna o lançamento um commit só — e o que torna as DUAS unidades sequenciais
    // exprimíveis sem aninhamento.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(CobrancaService) private readonly cobrancas: CobrancaService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Lança uma cobrança avulsa',
    description:
      'A cobrança nasce na empresa **da sessão de quem lança** — a empresa nunca é aceita pelo ' +
      'corpo — e vinculada ao contrato citado pelo **código** dele. O `codigo` é emitido pelo ' +
      'servidor no formato `COB-{ano}-{7 dígitos}`, único por empresa e **nunca reusado** ' +
      '(ADR-0015). O `locatarioId` da resposta é **derivado** da junção com o contrato: ele não é ' +
      'aceito no corpo e não é gravado em coluna própria. `status`, `diasAtraso`, `valorMulta`, ' +
      '`valorJuros` e `valorTotal` também são derivados, e chegam prontos da leitura (ADR-0022). ' +
      'A `natureza` é o que distingue aluguel de água, condomínio, energia e outros — nunca o ' +
      'texto de `referencia`, que é livre. Contrato de outra empresa responde `404`, com o ' +
      '**mesmo** corpo de contrato inexistente; contrato **retirado de circulação** responde ' +
      '`422` nomeando `contratoCodigo`, com `detalhes.circulacao: RETIRADO_DE_CIRCULACAO`.',
  })
  @ApiCreatedResponse({
    description: 'A cobrança lançada, já com os cinco campos derivados.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Cobranca> {
    const entrada = validar(esquemaDeCobrancaNova, corpo, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: ela **commita** antes de a segunda abrir, e é isso que impede o número de ser
    // reusado por uma criação abortada. Ver o cabeçalho deste arquivo — não funda as duas.
    const ano = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cobrancas.garantirSerie(tx),
    );

    // SEGUNDA unidade: a conferência do contrato, a emissão do número e a gravação da linha, num
    // commit só. Ela abre depois de a primeira fechar, e por isso não aninha.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const lancada = await this.cobrancas.criar(tx, entrada, ano);

      // Os campos são os que a §13.1 nomeia para este evento. **Nenhum valor monetário e nenhum
      // dado do locatário entram na linha** — nem `referencia`, que é texto livre do operador.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: lancada.codigo,
          natureza: lancada.natureza,
        },
        'cobrança lançada',
      );

      return lancada;
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Lista a carteira de cobranças da empresa',
    description:
      'Cada item traz o código, o contrato, o locatário, os termos e os cinco campos derivados — ' +
      'sem segunda consulta. A ordem é por vencimento, com o código desempatando. Os três ' +
      'recortes são opcionais e independentes: `contrato` pelo código legível dele, `status` na ' +
      'união fechada `{A_VENCER, VENCIDA, PAGA, CANCELADA}` e `natureza` na união fechada ' +
      '`{ALUGUEL, AGUA, CONDOMINIO, ENERGIA, OUTRO}`; ausência quer dizer **sem filtro**, e um ' +
      'rótulo fora da união é `422`. A janela é declarável por `limite` e `deslocamento`, e ' +
      'pedido acima do teto **recusa** em vez de truncar em silêncio. O `total` é o da empresa ' +
      'inteira sob o recorte pedido, e não o tamanho da página.',
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
  ): Promise<PaginaDeCobrancas> {
    // O esquema vem **inteiro** de `@sysloc/contracts`, que a ADR-0016 declara fonte única: a janela
    // comum mais os três filtros da carteira. Nenhuma conferência de recorte é escrita aqui.
    const janela = validar(esquemaDaJanelaDeCobrancas, consulta, CAMPO_DA_CONSULTA);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cobrancas.listar(tx, janela),
    );
  }

  @Get(':codigo')
  @ApiOperation({
    summary: 'Lê uma cobrança pelo código',
    description:
      'Alcança a cobrança em **qualquer** estado, inclusive a paga e a cancelada — não há exclusão ' +
      'lógica nesta entidade, e o desfecho é fato gravado, não visibilidade. Os cinco campos ' +
      'derivados refletem a política de mora vigente **no instante da leitura**, e não o que valia ' +
      'quando a linha foi gravada. Cobrança de outra empresa é indistinguível de inexistente: ' +
      '`404` com o mesmo corpo. Código malformado é recusado com `422` **sem tocar o banco**.',
  })
  @ApiOkResponse({
    description: 'A cobrança pedida.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Cobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cobrancas.ler(tx, codigo),
    );
  }

  @Post(SEGMENTO_DO_PAGAMENTO)
  // `200`, e não o `201` que o arcabouço dá a todo `@Post`: a transição **não cria recurso** — ela
  // muda o que a cobrança que já existia publica —, e é o mesmo desfecho, pela mesma razão, das
  // transições de {@link ../contratos/contrato.controller.js}.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Acusa o pagamento de uma cobrança',
    description:
      'Registra dinheiro que **já se moveu fora do sistema** — não o move. Grava a data e o valor ' +
      'pagos e **carimba**, na mesma instrução, a multa, os juros e os dois percentuais vigentes no ' +
      'instante do ato (ADR-0022): os quatro saem da mesma expressão que a leitura publicava um ' +
      'instante antes, e não de um cálculo próprio. A partir daí o estado publicado passa a ser ' +
      'PAGA, e `valorMulta`, `valorJuros` e `valorTotal` deixam de acompanhar a política — alterar ' +
      'multa e juros depois disto **não move um centavo** desta cobrança, enquanto alcança as que ' +
      'seguem em aberto. Multa e juros **não são aceitos no corpo**, que tem os dois campos de fato ' +
      'e mais nenhum: quem paga não escreve o próprio recibo. Os seis campos de conciliação ' +
      'bancária permanecem **exatamente como estavam** — divergência declarada contra o sistema ' +
      'antigo, que os zerava. Sobre cobrança que já foi paga ou cancelada responde `422` com ' +
      '`campo: "codigo"` e `detalhes: { estadoAtual, transicaoPedida }`, **sem escrever nada**: a ' +
      'operação não é idempotente por decisão, porque repetir significa que quem pediu não sabia o ' +
      'estado. Cobrança de outra empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'A cobrança como ela ficou, com os quatro carimbos gravados.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async acusarPagamento(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Cobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    const entrada = validar(esquemaDoPagamentoDeCobranca, corpo, CAMPO_DO_CORPO);

    // UMA unidade de trabalho: a leitura pela visão, a guarda de estado e a escrita que carimba
    // commitam juntas ou não commitam. Nenhum número de série é emitido aqui, então não há a segunda
    // unidade que o lançamento precisa.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const paga = await this.cobrancas.acusarPagamento(tx, codigo, entrada);

      // Os campos são os que a §13.1 nomeia para este evento. **`valorPago` fica de fora**, e a
      // ausência é a decisão: nenhum valor monetário e nenhum dado do locatário entram na linha de
      // trilha. O que ela registra é que o pagamento foi acusado, não quanto foi pago.
      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: paga.codigo },
        'pagamento acusado',
      );

      return paga;
    });
  }

  @Post(SEGMENTO_DO_CANCELAMENTO)
  // `200` pela mesma razão do pagamento: nada é criado, e nada é apagado.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancela uma cobrança',
    description:
      '**Nada é apagado** (ADR-0014): a cobrança continua legível por `GET /v1/cobrancas/:codigo`, ' +
      'continua constando da carteira com os termos originais, e o código dela segue **ocupado** — ' +
      'a série nunca o reusa (ADR-0015). Cobrar de novo o mesmo fato é lançar uma substituta por ' +
      '`POST /v1/cobrancas`, que recebe código novo; **não há vínculo publicado** entre as duas. O ' +
      'estado publicado passa a ser CANCELADA, e a mora deixa de ser apurada mesmo que o vencimento ' +
      'já tenha passado. Sobre cobrança já paga ou já cancelada responde `422` com ' +
      '`campo: "codigo"` e `detalhes: { estadoAtual, transicaoPedida }`, **sem escrever nada** — a ' +
      'operação não é idempotente por decisão, e o instante do primeiro cancelamento é preservado. ' +
      'O corpo é vazio e fechado. Cobrança de outra empresa é indistinguível de inexistente: `404` ' +
      'com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'A cobrança como ela ficou, agora cancelada e ainda legível.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async cancelar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Cobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const cancelada = await this.cobrancas.cancelar(tx, codigo);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: cancelada.codigo },
        'cobrança cancelada',
      );

      return cancelada;
    });
  }
}
