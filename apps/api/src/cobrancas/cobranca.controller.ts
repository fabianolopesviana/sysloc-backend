/**
 * As **nove rotas da cobrança** — lançar avulsa, ler a carteira, ler uma cobrança, acusar o
 * pagamento, cancelar, os **dois atos sobre o boleto** (emitir/reemitir e revogar, T13 da fatia
 * `emissao-e-conciliacao`) e as **duas leituras** sobre ele: os bytes do documento e o histórico
 * bancário (T14 da mesma fatia).
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e é de ÁREA — nenhuma chave de ação nas CINCO primeiras
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DO_FINANCEIRO)` na classe vale para os manipuladores que não declaram nada — a
 * guarda lê o metadado com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o
 * método é silencioso. Declarar cinco vezes o mesmo valor criaria cinco lugares para esquecer um.
 *
 * **Nenhuma das cinco primeiras exige chave de ação, e a ausência é decisão registrada** (§11.2 da
 * tech spec da fatia `cobranca-e-mora`):
 * o catálogo fechado da ADR-0011 enumera **duas** ações sensíveis dentro de `TELA:financeiro` —
 * `ACAO:emitir_boleto` e `ACAO:solicitar_baixa_de_boleto` — e **nenhuma** para lançar, ler, pagar ou
 * cancelar cobrança. Quem fechou o catálogo tinha as operações de cobrança à vista e concedeu chave
 * própria só às que falam com o banco. Nenhuma chave nova nasce nesta fatia, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado** — precisar de uma chave nova aqui
 * seria sinal de escopo mal delimitado, e abrir o catálogo exigiria supersedê-la ADR-0011.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS ATOS SOBRE O BOLETO exigem a CONJUNÇÃO — e é a mesma frase acima que os governa
 * ---------------------------------------------------------------------------
 *
 * As duas chaves que o parágrafo anterior nomeia — `ACAO:emitir_boleto` e
 * `ACAO:solicitar_baixa_de_boleto` — estavam **reservadas** justamente para estas duas rotas: são as
 * únicas ações sensíveis que o catálogo enumera dentro de `TELA:financeiro`, e são as que *"falam com
 * o banco"*. Elas entram como a **segunda** classe da ADR-0021, e não como a primeira: o ato **move
 * dinheiro** — registra um título cobrável no mundo, ou o derruba — e não tem substituta prevista.
 *
 * Cada uma declara no método a **conjunção inteira** (`@ExigeChaves(área, ação)`), e **nunca só a
 * ação**: `getAllAndOverride` substitui, e uma declaração só com a ação apagaria `TELA:financeiro`
 * destas duas rotas em silêncio. A coerência do catálogo esconderia o defeito — `MAPA_ACAO_TELA` liga
 * as duas ações à própria área do Financeiro, de modo que a rota continuaria exigindo-a *por
 * acidente*, e o `CT-355` existe exatamente para acusar o manipulador que exige menos que a classe.
 * A **ordem** é área antes de ação, porque a recusa nomeia a primeira chave ausente (ADR-0018).
 *
 * **As duas transições entram por esse mesmo critério, e a classificação é decisão escalada e
 * confirmada antes da spec.** A ADR-0021 dá "apenas a área" ao ato que não transfere direito, não move
 * dinheiro e não altera o que outra entidade pode fazer: acusar pagamento **registra** dinheiro que se
 * moveu fora do sistema — não o move —, e o cancelamento tem substituta prevista, o que o torna
 * reversível. As alternativas recusadas foram abrir o catálogo com duas chaves novas (exigiria
 * supersedê-la ADR-0011, que o PRD §4.2 exclui nominalmente) e estender a ADR-0021 com uma terceira
 * instância declarada. **Não reabra.**
 *
 * Nas **cinco primeiras** não há declaração no método, e por isso o risco de substituição que o
 * marcador `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} governa não as alcança;
 * nas **duas de ato** ele é real, e o que o fecha é a conjunção declarada por extenso. O `CT-355`
 * varre a aplicação e acusa qualquer manipulador que exija menos do que a classe dele: as cinco
 * exigem exatamente o que a classe exige, e as duas exigem a classe **mais** a ação.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS LEITURAS SOBRE O BOLETO exigem SÓ A ÁREA, e a ausência é decisão (T14)
 * ---------------------------------------------------------------------------
 *
 * `GET :codigo/boleto` e `GET :codigo/historico-bancario` **nada declaram no método**, e entram no
 * grupo das que valem pela classe. A régua é a da ADR-0021 lida ao pé da letra: ela governa
 * **transição de estado**, e nenhuma das duas é transição — não movem dinheiro, não gravam, não
 * alteram o que outra entidade pode fazer. Quem alcança `TELA:financeiro` já lê a cobrança inteira
 * por `GET :codigo`, com `linhaDigitavel` e `codigoDeBarras` dentro; exigir uma ação sensível para
 * baixar o documento negaria a segunda via a quem enxerga o número que ela imprime.
 *
 * As duas ações que o catálogo fechado enumera nesta área — `ACAO:emitir_boleto` e
 * `ACAO:solicitar_baixa_de_boleto` — são das rotas de **ato**, e nenhuma chave nova nasce aqui:
 * `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado** por esta task.
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
 * É o controlador que a abre, e o serviço **recebe** o executor. Todas passam por
 * {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta
 * própria nem chama `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a
 * sessão que a guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o ponto
 * seguinte.
 *
 * **Os dois atos sobre o boleto abrem VÁRIAS unidades, e todas nascem aqui.** Eles escrevem no banco
 * *entre* duas idas ao provedor — a revogação é gravada assim que confirmada, e a emissão do título
 * novo vem depois —, e as duas escritas não podem estar na mesma transação: se estivessem, a falha da
 * emissão desfaria a revogação já confirmada junto ao provedor, apagando o desfecho que a CA-06
 * declara. Por isso o controlador entrega ao serviço a **própria** `sobContextoDaSessao`, aplicada a
 * esta requisição, e o serviço a chama quando precisa de uma unidade. Nada disso o aproxima da porta
 * de conexão: ele continua sem `AcessoAoBanco`, e a unidade continua nascendo na borda, sob a sessão.
 * Nenhuma delas aninha — todas correm **fora** de qualquer `sql.begin` —, de modo que a
 * `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts` não é tocada.
 *
 * ---------------------------------------------------------------------------
 * A chave da rota é o CÓDIGO, e ele é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem **série declarada**, e por isso a chave exposta é o código legível — nunca o UUID
 * interno, que sequer sai da porta (ADR-0017). `ESQUEMA_DO_CODIGO_DE_COBRANCA`, de
 * `@syslocbr/contracts`, valida a **forma** e canoniza a caixa (`trim` → maiúsculas). A validação
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

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import {
  type Cobranca,
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  envelopeDeLista,
  esquemaDaCobranca,
  esquemaDaJanelaDeCobrancas,
  esquemaDaTrilhaDaCobranca,
  esquemaDeCobrancaNova,
  esquemaDoPagamentoDeCobranca,
  type TrilhaDaCobranca,
} from '@syslocbr/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar, validarConsulta } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { ATO_DE_EMISSAO, ATO_DE_REVOGACAO, BoletoService } from './boleto.service.js';
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

/**
 * Os dois segmentos dos **atos sobre o boleto** (T13 da fatia `emissao-e-conciliacao`).
 *
 * Escritos uma vez, como os dois de cima, porque são **contrato publicado**: eles entram no par
 * método+caminho que a cobertura de autorização audita, e um literal repetido no decorador e no
 * documento seria livre para divergir.
 *
 * O vocabulário é **revogação**, e não *baixa* nem *retirada de circulação*: o glossário já usa
 * *retirada de circulação* para visibilidade de cadastro, e reusá-lo aqui daria dois conceitos sem
 * parentesco ao mesmo nome. A chave de permissão continua sendo
 * {@link ACAO_DE_BAIXA_DE_BOLETO} — ela é do catálogo **persistido** e não se renomeia.
 */
const SEGMENTO_DA_EMISSAO_DE_BOLETO = ':codigo/emissao-de-boleto';
const SEGMENTO_DA_REVOGACAO_DE_BOLETO = ':codigo/revogacao-de-boleto';

/**
 * Os dois segmentos das **leituras** sobre o boleto (T14 da fatia `emissao-e-conciliacao`).
 *
 * Escritos uma vez, como os quatro de cima, e pela mesma razão: eles entram no par método+caminho que
 * a cobertura de autorização audita, e um literal repetido no decorador e no documento seria livre
 * para divergir.
 *
 * O vocabulário é o do **produto**: `boleto` para o documento, e `historico-bancario` para a trilha —
 * nunca *extrato* nem *eventos*, que o glossário reserva a outros conceitos.
 */
const SEGMENTO_DO_BOLETO = ':codigo/boleto';
const SEGMENTO_DO_HISTORICO_BANCARIO = ':codigo/historico-bancario';

/**
 * O que a rota dos bytes declara, conforme a **ADR-0028** — os três valores, nomeados uma vez.
 *
 * Eles são **contrato publicado**, e aparecem em **dois** lugares cada: no documento OpenAPI, que o
 * frontend lê para gerar o cliente, e no cabeçalho que a resposta de fato escreve. É a coincidência
 * entre os dois que faz a declaração ser verdade — dois literais ficariam livres para divergir, e o
 * modo de falha é o pior possível: o documento anunciaria um tipo de mídia e a resposta traria outro,
 * sem que nada acusasse.
 *
 * São os **mesmos** valores que {@link ../contratos/contrato.controller.js} já declara na rota do
 * documento do contrato, e a repetição é deliberada: as duas superfícies publicam o mesmo tipo de
 * mídia por acaso de domínio — o provedor manda PDF, e o contrato é composto em PDF —, e uma casa
 * comum para eles ligaria duas decisões que podem mudar em separado. O limiar deste repositório é
 * **três**, e esta é a segunda.
 *
 * Os nomes dos cabeçalhos são escritos em minúsculas porque é assim que o adaptador HTTP os
 * normaliza; o valor de `Content-Disposition` é composto no ponto da resposta, porque metade dele é
 * o código da cobrança.
 */
const TIPO_DE_MIDIA_DO_BOLETO = 'application/pdf';
const CABECALHO_DO_TIPO = 'content-type';
const CABECALHO_DA_DISPOSICAO = 'content-disposition';

/** A extensão do nome de arquivo sugerido — a outra metade de `attachment; filename="…"`. */
const EXTENSAO_DO_BOLETO = '.pdf';

/**
 * As duas ações sensíveis que o catálogo fechado enumera dentro de `TELA:financeiro`.
 *
 * Constantes nomeadas, e não literais nos decoradores: os valores são **contrato publicado** — eles
 * aparecem em `detalhes.exigido` no corpo da recusa —, e ter nome é o que permite ao caso de cobertura
 * auditá-los por conteúdo sem casar uma cadeia escrita em dois lugares.
 *
 * ⚠️ **`ACAO:solicitar_baixa_de_boleto` NÃO é renomeada** para acompanhar o vocabulário da revogação:
 * ela é chave do catálogo **persistido** (`packages/auth/src/catalogo-de-permissoes.ts`), preserva o
 * sentido do legado, e o catálogo é fechado em 10 × 7 — renomeá-la exigiria migração sobre as
 * concessões já gravadas e supersedimento da ADR-0011.
 */
const ACAO_DE_EMISSAO_DE_BOLETO = 'ACAO:emitir_boleto' as const;
const ACAO_DE_BAIXA_DE_BOLETO = 'ACAO:solicitar_baixa_de_boleto' as const;

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
    // Os dois atos sobre o boleto (T13). Ele é serviço próprio, e não mais métodos em
    // `CobrancaService`: aquele arquivo declara por escrito que **não conhece provedor**, e injetar
    // nele o adaptador e a guarda daria à superfície inteira da cobrança a capacidade de falar com o
    // banco de fora.
    @Inject(BoletoService) private readonly boletos: BoletoService,
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
      'sem segunda consulta. A ordem é por vencimento, com o código desempatando. Os cinco ' +
      'recortes são opcionais e independentes: `contrato` pelo código legível dele, `status` na ' +
      'união fechada `{A_VENCER, VENCIDA, PAGA, CANCELADA}`, `natureza` na união fechada ' +
      '`{ALUGUEL, AGUA, CONDOMINIO, ENERGIA, OUTRO}` e a janela `vencimentoDe`/`vencimentoAte` ' +
      'sobre `dataVencimento` (`YYYY-MM-DD`, **pontas inclusive**, cada uma válida sozinha); ' +
      'ausência quer dizer **sem filtro**, e rótulo fora da união, data malformada ou janela ' +
      'invertida são `422` nomeando o parâmetro. ⚠️ A janela recorta a **data gravada**, e não o ' +
      'estado derivado: a cobrança que vence **hoje** ainda **não** está vencida, de modo que ' +
      '"vencem hoje" é `vencimentoDe=vencimentoAte=hoje`, e não um recorte por estado. A janela ' +
      'de página é declarável ' +
      'por `limite` e `deslocamento`, e ' +
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
    // O esquema vem **inteiro** de `@syslocbr/contracts`, que a ADR-0016 declara fonte única: a janela
    // comum mais os três filtros da carteira. Nenhuma conferência de recorte é escrita aqui.
    const janela = validarConsulta(esquemaDaJanelaDeCobrancas, consulta);

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

  @Post(SEGMENTO_DA_EMISSAO_DE_BOLETO)
  // A **conjunção inteira** no método, e nunca só a ação: `getAllAndOverride` faz a declaração do
  // método **substituir** a da classe, de modo que `@ExigeChave(ACAO_DE_EMISSAO_DE_BOLETO)` apagaria
  // `TELA:financeiro` desta rota em silêncio. É o defeito explorável que a `DECISÃO FECHADA` de
  // {@link ../imoveis/conjunto.controller.js} registra, e a ordem — área antes da ação — é conteúdo:
  // a recusa nomeia a **primeira** chave ausente (ADR-0018), e quem tem a área precisa ouvir o nome
  // da ação, que é o que lhe falta.
  @ExigeChaves(AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO)
  // `200`, e não o `201` que o arcabouço dá a todo `@Post`: o ato **não cria recurso** — ele muda o
  // que a cobrança que já existia publica —, mesma razão do pagamento e do cancelamento.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Emite (ou reemite) o boleto de uma cobrança',
    description:
      'Ato de **primeira classe** — ele move dinheiro —, e por isso exige a área do Financeiro **e** ' +
      'a ação `emitir_boleto` (ADR-0021). Sobre cobrança **sem** boleto vivo, emite direto; sobre ' +
      'cobrança **com** boleto vivo, revoga o anterior, **espera a confirmação do provedor** e só ' +
      'então emite o novo — em nenhum instante existem dois boletos pagáveis. O corpo é vazio e ' +
      'fechado. A resposta é a cobrança inteira, já com `numeroDoTituloNoProvedor`, `linhaDigitavel` ' +
      'e `codigoDeBarras` preenchidos; `dataDoCredito` e `valorCreditado` seguem `null` até a ' +
      'conferência apurar o crédito. Cobrança já paga ou cancelada responde `422` nomeando o estado ' +
      'atual, **sem falar com o provedor**; empresa sem certificado vigente — ou com um vencido — ' +
      'responde `422` dizendo o que falta. Se a revogação for confirmada e a emissão falhar, a ' +
      'cobrança fica **sem boleto** e a resposta é `503` nomeando a cobrança, com ' +
      '`detalhes: { boleto: "SEM_BOLETO", revogacao: "CONFIRMADA" }` — o estado é declarado, não ' +
      'adivinhado. Cobrança de outra empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'A cobrança como ela ficou, com os campos de emissão preenchidos.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async emitirBoleto(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Cobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: as leituras e **todas** as recusas que não custam uma ida ao provedor. Ela
    // **commita** antes de a conversa começar — a chamada de rede não segura conexão física.
    const preparo = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) =>
        await this.boletos.prepararAto(tx, sessao.empresaId, codigo, ATO_DE_EMISSAO),
    );

    // O ato externo, FORA de transação. As unidades que ele precisa no meio do caminho nascem por
    // esta mesma função — a única origem de contexto continua sendo a sessão (ADR-0008).
    const emitida = await this.boletos.emitir(preparo, (trabalho) =>
      sobContextoDaSessao(this.banco, requisicao, trabalho),
    );

    // Os campos são os que a §13.1 nomeia: **nenhum valor monetário e nenhum dado do locatário**, e
    // tampouco o número do título — vocabulário do provedor, que a trilha guarda e o journal não.
    this.logger.info(
      { empresaId: preparo.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: emitida.codigo },
      'boleto emitido',
    );

    return emitida;
  }

  @Post(SEGMENTO_DA_REVOGACAO_DE_BOLETO)
  // A conjunção inteira, pela mesma razão da rota acima — e com a chave do catálogo persistido, que
  // **não** é renomeada para acompanhar o vocabulário da revogação. Ver {@link ACAO_DE_BAIXA_DE_BOLETO}.
  @ExigeChaves(AREA_DO_FINANCEIRO, ACAO_DE_BAIXA_DE_BOLETO)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Revoga o boleto de uma cobrança',
    description:
      'Derruba o título junto ao provedor e **espera a confirmação** antes de apagar qualquer coisa: ' +
      'o provedor não revoga na mesma resposta, e apagar antes deixaria o boleto pagável no mundo ' +
      'enquanto o produto já o considera morto. Confirmada a revogação, os campos de emissão voltam ' +
      'a `null`, o arquivo é apagado e a trilha ganha `BOLETO_REVOGADO`. **A cobrança continua em ' +
      'aberto** — revogar boleto não cancela cobrança —, e emitir de novo depois disto acontece como ' +
      'a primeira vez. O corpo é vazio e fechado. Cobrança **sem** boleto vivo responde `422` com ' +
      '`detalhes: { boleto: "SEM_BOLETO" }`; confirmação que não vem dentro do teto responde `503` ' +
      'com `detalhes: { revogacao: "PEDIDA_NAO_CONFIRMADA" }`, e **nada é apagado**. Cobrança de ' +
      'outra empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'A cobrança como ela ficou, sem boleto e ainda em aberto.',
    schema: esquemaPublicado(esquemaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async revogarBoleto(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Cobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // A guarda de estado **não** se aplica aqui, e a ausência é decisão: a cobrança cancelada é
    // justamente quem tem título vivo a derrubar, e recusá-la manteria o boleto pagável no mundo.
    const preparo = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) =>
        await this.boletos.prepararAto(tx, sessao.empresaId, codigo, ATO_DE_REVOGACAO),
    );

    const revogada = await this.boletos.revogar(preparo, (trabalho) =>
      sobContextoDaSessao(this.banco, requisicao, trabalho),
    );

    this.logger.info(
      { empresaId: preparo.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: revogada.codigo },
      'boleto revogado',
    );

    return revogada;
  }

  @Get(SEGMENTO_DO_BOLETO)
  // NADA é declarado aqui, e a ausência é o mecanismo: a exigência de `TELA:financeiro` vem da
  // CLASSE, e `getAllAndOverride` é override — não união. Baixar o boleto é **leitura** do que a área
  // já dá, e a ADR-0021 governa transição de estado: ela não alcança o que não é transição. As duas
  // ações sensíveis que o catálogo fechado enumera dentro desta área governam **emitir** e
  // **revogar** — os atos que movem dinheiro —, e exigir uma delas aqui negaria a segunda via a quem
  // pode ver a cobrança inteira. É a mesma forma, e a mesma razão, da rota do documento de
  // {@link ../contratos/contrato.controller.js}.
  //
  // ⚠️ **Declarar `@ExigeChave(AREA_DO_FINANCEIRO)` seria pior do que redundante**: instalaria um
  // segundo lugar por onde a área desta rota pode sumir em silêncio.
  @ApiOperation({
    summary: 'Baixa o boleto de uma cobrança em PDF',
    description:
      'Devolve os bytes que o **provedor** emitiu, tal como ele os entregou (ADR-0030 — o boleto é ' +
      'fato recebido de terceiro, e não artefato derivado). Se o arquivo tiver sumido do disco, ele ' +
      'é **rebuscado do provedor e regravado**, de forma transparente: a resposta é a mesma, e nada ' +
      'é registrado no histórico bancário, porque rebuscar cache não é efeito (ADR-0034). ' +
      'Cobrança que **nunca teve** boleto responde `404` nomeando a cobrança, com ' +
      '`detalhes: { boleto: "NUNCA_EMITIDO" }` — jamais um documento em branco. ⚠️ **A existência do ' +
      'boleto é decidida pelo estado no banco, nunca pela presença do arquivo**: boleto revogado ' +
      'cujo arquivo tenha sobrado em disco responde `404` como qualquer outro nunca emitido. ' +
      'Provedor indisponível na rebusca responde `503`, sem alterar coisa alguma. A resposta é ' +
      '`application/pdf` com `Content-Disposition: attachment` sugerindo `<codigo>.pdf`. Cobrança de ' +
      'outra empresa é indistinguível de inexistente: `404` com o mesmo corpo. Código malformado é ' +
      'recusado com `422` **sem tocar o banco**.',
  })
  // A ÚNICA declaração de resposta desta superfície que não deriva de um esquema, e a ADR-0028 é
  // quem a autoriza: a rota permanece no contrato publicado e declara **mídia**, **nome sugerido de
  // arquivo** e o **mesmo envelope de erro** das demais.
  //
  // ⚠️ `format: 'binary'` NÃO é declaração de forma — é o idioma que o OpenAPI tem para dizer *"isto
  // é uma sequência de bytes opaca"*, isto é, a declaração da AUSÊNCIA de forma. O que a `Decision`
  // proíbe, e o que esta rota não faz, é declarar a ESTRUTURA do sucesso: não há `esquemaPublicado`
  // aqui, nem objeto, nem campo. É o precedente literal da rota do documento do contrato, com a
  // leitura conjunta já registrada na §21.3 (1) do tech spec da fatia anterior.
  @ApiOkResponse({
    description: 'O boleto em PDF, tal como o provedor o emitiu.',
    content: { [TIPO_DE_MIDIA_DO_BOLETO]: { schema: { type: 'string', format: 'binary' } } },
    headers: {
      [CABECALHO_DA_DISPOSICAO]: {
        schema: { type: 'string' },
        description: 'attachment; filename="COB-2026-0000001.pdf"',
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async boleto(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
    // `passthrough: true` porque o corpo continua sendo o **valor devolvido** — o que a resposta
    // precisa da instância é apenas dois cabeçalhos que dependem do `:codigo`. Sem `passthrough`, o
    // manipulador passaria a ser responsável por escrever a resposta inteira, e a forma dele
    // divergiria das outras oito desta classe sem ganho algum. É o molde literal da rota do
    // documento do contrato.
    @Res({ passthrough: true }) resposta: FastifyReply,
  ): Promise<Uint8Array> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);

    // A unidade de trabalho cobre **apenas a leitura do estado**, e a repartição é a mesma da rota do
    // documento do contrato — cuja `DECISÃO FECHADA — T7 / Gate 2` registra a medição que a motivou:
    // `sobContextoDaSessao` é um `sql.begin` real, e o que corre depois dela aqui é leitura de disco
    // e, no caminho raro, **conversa de rede com o provedor**, que pode custar segundos. Dentro da
    // unidade, cada download reservaria uma conexão física da reserva que atende o produto inteiro.
    // ⚠️ Não "uniformize" isto de volta para uma continuação só.
    const preparo = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => await this.boletos.prepararEntrega(tx, sessao.empresaId, codigo),
    );

    // A entrega corre FORA da unidade. A abertura vai por parâmetro porque a rebusca da CA-08 precisa
    // ler o certificado da empresa — a única ida ao banco do caminho raro —, e ela nasce aqui, na
    // borda, sob a sessão: a única origem legítima do contexto de tenant (ADR-0008).
    const bytes = await this.boletos.entregar(preparo, (trabalho) =>
      sobContextoDaSessao(this.banco, requisicao, trabalho),
    );

    // Os DOIS cabeçalhos são escritos **depois** de os bytes existirem, e a ordem é conteúdo: o
    // filtro global responde pela MESMA instância de `FastifyReply`, de modo que um
    // `Content-Type: application/pdf` definido antes da leitura sobreviveria à recusa e o envelope de
    // erro da ADR-0017 sairia anunciando-se como PDF — o `MT-2` daquela rota mediu pior ainda: o
    // `404` virava `500`. É o que o `CT-921` afirma nesta.
    resposta.header(CABECALHO_DO_TIPO, TIPO_DE_MIDIA_DO_BOLETO);
    // O nome sugerido é o **código canonizado** — `ESQUEMA_DO_CODIGO_DE_COBRANCA` já validou a forma
    // `COB-{ano}-{7 dígitos}` e passou a caixa para maiúsculas —, e por isso não há aqui aspa, quebra
    // de linha ou caractere de controle a escapar: o que chega do cliente não atravessa esta linha.
    resposta.header(
      CABECALHO_DA_DISPOSICAO,
      `attachment; filename="${codigo}${EXTENSAO_DO_BOLETO}"`,
    );

    return bytes;
  }

  @Get(SEGMENTO_DO_HISTORICO_BANCARIO)
  // NADA é declarado aqui, pela mesma razão da rota acima: ler o histórico é leitura do que a área já
  // dá, e a ADR-0021 não alcança o que não é transição de estado.
  @ApiOperation({
    summary: 'Lê o histórico bancário de uma cobrança',
    description:
      'Os efeitos que de fato aconteceram com o boleto desta cobrança — emissão, revogação, ' +
      'liquidação, estorno, divergência de valor e recusa de emissão —, **na ordem em que ' +
      'ocorreram**, do mais antigo para o mais recente. Cada item traz o instante, a origem (ato do ' +
      'Admin ou conferência) e o `diagnostico` que o provedor informou, preservado tal como veio. ' +
      '⚠️ **A trilha registra efeito, nunca tentativa** (ADR-0034): a passada da conferência que ' +
      'nada mudou, e a revogação pedida e não confirmada, não aparecem aqui. Cobrança que ainda não ' +
      'teve efeito bancário algum responde `200` com `itens` vazio — que é diferente de `404`. ' +
      'Cobrança de outra empresa é indistinguível de inexistente: `404` com o mesmo corpo.',
  })
  // O envelope vem INTEIRO do pacote, e não é composto aqui como {@link ESQUEMA_DA_PAGINA}: aquele é
  // `envelopeDeLista` — helper exportado — aplicado ao item; este seria a forma do corpo **escrita à
  // mão**, e o mesmo objeto que dá o documento dá o tipo de retorno do manipulador (ADR-0016). Não
  // volte a compor `z.object({ itens })` nesta borda: a chave passaria a existir em dois lugares.
  @ApiOkResponse({
    description: 'O histórico da cobrança, do efeito mais antigo para o mais recente.',
    schema: esquemaPublicado(esquemaDaTrilhaDaCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async historicoBancario(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<TrilhaDaCobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);

    // UMA unidade de trabalho, que cobre o manipulador inteiro: aqui não há rede nem disco depois da
    // leitura, de modo que a exceção que a rota dos bytes faz não tem razão de ser nesta.
    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.boletos.historico(tx, codigo),
    );
  }
}
