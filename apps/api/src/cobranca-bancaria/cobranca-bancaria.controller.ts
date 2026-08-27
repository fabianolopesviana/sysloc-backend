/**
 * As **três rotas de `/v1/cobranca-bancaria`** — abrir a emissão em lote de uma competência,
 * acompanhá-la, e disparar a conferência junto ao provedor.
 *
 * ---------------------------------------------------------------------------
 * O CAMINHO é próprio, e não um sub-recurso de `/v1/cobrancas`
 * ---------------------------------------------------------------------------
 *
 * As três rotas atuam sobre **execuções** — o lote e a apuração —, e não sobre uma cobrança. Não há
 * `:codigo` em nenhuma delas, e pendurá-las sob a coleção de cobranças daria a entender que existe
 * uma cobrança dona do ato, quando o conjunto é decidido por **predicado no banco** (ADR-0023) e o
 * Admin não escolhe cobrança (RN-01).
 *
 * A **área de autorização**, no entanto, é a mesma: `TELA:financeiro`. Caminho de URL e chave de
 * permissão são vocabulários diferentes, e é por isso que a área aqui não deriva do caminho —
 * são constantes separadas, como já são em `../integracoes-bancarias/certificado.controller.js`.
 *
 * ---------------------------------------------------------------------------
 * A EXIGÊNCIA das três, e por que a conferência pede APENAS a área
 * ---------------------------------------------------------------------------
 *
 * O `POST` da emissão declara no método a **conjunção inteira** — `TELA:financeiro` +
 * `ACAO:emitir_boleto` —, porque é o mesmo ato de emitir da rota unitária, agora sobre um conjunto:
 * ele **move dinheiro**, registrando no mundo títulos cobráveis. A chave já existe no catálogo
 * fechado da ADR-0011, reservada exatamente para isso.
 *
 * ⚠️ **Nunca declare só a ação.** `getAllAndOverride` faz a declaração do método **substituir** a da
 * classe, de modo que `@ExigeChave(ACAO_DE_EMISSAO_DE_BOLETO)` apagaria a área **sem erro nenhum** —
 * e a coerência do catálogo esconderia o defeito, porque `MAPA_ACAO_TELA` liga essa ação à própria
 * `TELA:financeiro`. A ordem também é conteúdo: a recusa nomeia a **primeira** ausente (ADR-0018), e
 * a área vem antes para que quem já a tem ouça o nome da ação.
 *
 * O `GET` do lote **nada declara no método**, e a ausência é a decisão: é leitura, e a exigência da
 * classe é o que a guarda encontra. Declarar aqui a mesma área instalaria um segundo lugar por onde
 * ela pode sumir em silêncio.
 *
 * O `POST` da conferência **também nada declara**, e esse é o ponto que merece a justificativa
 * literal. O único desfecho que ela grava é **acusar pagamento de cobrança**, e a `Decision` da
 * ADR-0021 nomeia esse ato **por escrito** entre as instâncias que exigem apenas a área — *"o ato
 * registra dinheiro que se moveu fora do sistema; ele não o move"*. Uma rota não pode exigir mais do
 * que o efeito que ela causa exige, e o catálogo é fechado: uma chave nova para a conferência
 * exigiria supersedê-la a ADR-0011.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM que torna o pior caso inofensivo: COMMIT, depois fila (§5.1, §9.3)
 * ---------------------------------------------------------------------------
 *
 * O controlador valida, abre a unidade de trabalho sob o contexto da sessão, grava — e a unidade
 * **commita**. Só então ele enfileira. É esta ordem, e não uma tabela de *outbox*, que fecha o modo
 * de falha: se o enfileiramento falhar, o registro fica gravado, o `503` informa, e a próxima
 * tentativa **reencontra o mesmo** pelo índice único parcial. A falha oposta — enfileirar e o commit
 * desfazer — é **impossível**, porque nada é enfileirado antes do commit. Introduzir outbox seria
 * maquinaria para um modo de falha que a ordem já fecha.
 *
 * ⚠️ **O `await` do enfileiramento vive FORA de `sobContextoDaSessao`, e a posição é a garantia.**
 * Movê-lo para dentro do trabalho — a forma mais curta — reabriria exatamente a janela acima, e
 * nada no tipo acusaria: a chamada compila igual nos dois lugares.
 *
 * A conferência já em curso é o único caso em que **nada é enfileirado**: a tarefa daquela execução
 * já foi despachada quando ela nasceu, e enfileirar de novo poria duas apurações concorrentes sobre
 * a mesma linha.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o
 * **mesmo objeto** que confere a entrada e tipa a resposta. As três rotas passam por
 * {@link sobContextoDaSessao}, e nenhuma chama `contextoDeTenant.executarCom`: a única origem
 * legítima do contexto de tenant é a sessão que a guarda publicou (ADR-0008).
 */

import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
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
  type ConferenciaBancaria,
  type EmissaoEmLote,
  ESQUEMA_DO_IDENTIFICADOR,
  esquemaDaCompetencia,
  esquemaDaConferenciaBancaria,
  esquemaDaEmissaoEmLote,
} from '@syslocbr/contracts';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { ConferenciaBancariaService } from './conferencia-bancaria.service.js';
import { EmissaoEmLoteService } from './emissao-em-lote.service.js';

/**
 * Caminho da superfície da cobrança bancária, relativo ao prefixo de versão
 * (`/v1/cobranca-bancaria`).
 *
 * Exportado porque a suíte compõe o endereço a partir daqui, em vez de reescrever a cadeia: caminho
 * escrito duas vezes é livre para divergir, e a divergência apareceria como `404` num caso que
 * deveria medir outra coisa.
 */
export const CAMINHO_DA_COBRANCA_BANCARIA = 'cobranca-bancaria';

/** O segmento das emissões em lote — plural, porque é coleção de execuções. */
export const SEGMENTO_DAS_EMISSOES = 'emissoes';

/** O segmento das conferências — plural, pela mesma razão. */
export const SEGMENTO_DAS_CONFERENCIAS = 'conferencias';

/**
 * A área de tela que governa esta superfície.
 *
 * Constante nomeada, e não literal solto no decorador: o valor é **contrato publicado** — ele aparece
 * no corpo da recusa que o cliente lê, em `detalhes.exigido` —, e ter nome é o que permite à
 * auditoria de conteúdo examiná-lo sem casar uma cadeia escrita em dois lugares.
 *
 * ⚠️ **Ela é a mesma de `../cobrancas/cobranca.controller.js`, e a repetição é deliberada.** As
 * constantes de lá são privadas de propósito, e importá-las daqui criaria acoplamento entre dois
 * controladores para economizar uma linha — enquanto o que garante a coincidência é o **catálogo
 * fechado** de `packages/auth/src/catalogo-de-permissoes.ts`, que uma chave inventada não atravessa.
 */
const AREA_DO_FINANCEIRO = 'TELA:financeiro' as const;

/**
 * A ação sensível que governa a abertura do lote — a **mesma** da emissão unitária.
 *
 * Ela é a chave do catálogo fechado da ADR-0011, e o valor aparece em **três** pontos que precisam
 * coincidir: o catálogo, a declaração do método e o `detalhes.exigido` que a recusa publica. A
 * coincidência entre os três é o que faz a exigência ser verdade.
 */
const ACAO_DE_EMISSAO_DE_BOLETO = 'ACAO:emitir_boleto' as const;

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome do campo que a recusa do identificador do lote nomeia — o do caminho. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** As entidades nomeadas nas linhas de trilha desta superfície (§13.1). */
const ENTIDADE_DO_LOTE = 'emissao_em_lote';
const ENTIDADE_DA_CONFERENCIA = 'conferencia_bancaria';

@ApiTags('cobranca-bancaria')
@Controller(CAMINHO_DA_COBRANCA_BANCARIA)
@ExigeChave(AREA_DO_FINANCEIRO)
export class CobrancaBancariaController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos dos serviços recebem.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(EmissaoEmLoteService) private readonly lotes: EmissaoEmLoteService,
    @Inject(ConferenciaBancariaService)
    private readonly conferencias: ConferenciaBancariaService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post(SEGMENTO_DAS_EMISSOES)
  // A CONJUNÇÃO INTEIRA, e nunca só a ação — ver o cabeçalho para por que a forma curta apagaria a
  // área da classe em silêncio, e por que a ordem das duas chaves é conteúdo.
  @ExigeChaves(AREA_DO_FINANCEIRO, ACAO_DE_EMISSAO_DE_BOLETO)
  @ApiOperation({
    summary: 'Abre a emissão em lote dos boletos de uma competência',
    description:
      'Grava o lote e manda o processo de trabalho executá-lo. O corpo tem **um** campo: a ' +
      '`competencia`, que precisa ser o **primeiro dia do mês** — outro dia é `422` nomeando ' +
      '`competencia`, e chave desconhecida é recusada nomeando a chave. **O Admin não escolhe ' +
      'cobrança**: o conjunto é decidido no banco, e são as cobranças da competência em aberto e ' +
      '**sem boleto** — o que torna a reexecução da mesma competência idempotente sem guarda ' +
      'escrita para isso. A resposta é `201` com o lote `EM_ANDAMENTO`, `emitidas` e `recusadas` em ' +
      'zero e `itens` vazio: a prestação de contas cresce enquanto o percurso acontece, e é lida ' +
      'pelo `GET`. Uma empresa tem **um** lote em andamento por vez — pedir outro responde `422` ' +
      'com `detalhes.loteEmCurso` informando qual está acontecendo, e **nada é gravado**. O lote é ' +
      'gravado **antes** de ser enfileirado: se o servidor de fila não aceitar a tarefa, a resposta ' +
      'é `503` e o lote **permanece**, de modo que repetir o pedido reencontra o mesmo.',
  })
  @ApiCreatedResponse({
    description: 'O lote recém-aberto, com a prestação de contas ainda vazia.',
    schema: esquemaPublicado(esquemaDaEmissaoEmLote, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async abrirEmissao(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<EmissaoEmLote> {
    const entrada = validar(esquemaDaCompetencia, corpo, CAMPO_DO_CORPO);

    const { lote, empresaId } = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => ({
        lote: await this.lotes.abrir(tx, entrada.competencia, sessao.usuarioId),
        empresaId: sessao.empresaId,
      }),
    );

    // A partir daqui o lote está COMMITADO. A linha de trilha vem antes do enfileiramento de
    // propósito: ela registra o fato que já aconteceu, e registrá-la depois a perderia justamente no
    // caminho em que o operador mais precisa dela — o do `503`.
    this.logger.info(
      {
        empresaId,
        entidade: ENTIDADE_DO_LOTE,
        loteId: lote.id,
        competencia: lote.competencia,
      },
      'emissão em lote aberta',
    );

    // FORA da unidade de trabalho, e a posição é a garantia — ver o cabeçalho. A rejeição vira `503`
    // e o lote permanece gravado.
    await this.lotes.enfileirar({ empresaId, loteId: lote.id });

    return lote;
  }

  @Get(`${SEGMENTO_DAS_EMISSOES}/:${CAMPO_DO_IDENTIFICADOR}`)
  // NADA é declarado neste método, e a ausência é a decisão: acompanhar um lote é leitura, e a
  // exigência da classe — a área — é o que a guarda encontra. Declarar aqui a mesma área criaria um
  // segundo lugar para esquecê-la; declarar a ação faria quem acompanha a emissão precisar do poder
  // de emitir só para ver onde ela parou.
  @ApiOperation({
    summary: 'Acompanha uma emissão em lote',
    description:
      'Devolve o lote com a **prestação de contas inteira**: cada cobrança tentada, o desfecho ' +
      '(`EMITIDO` ou `RECUSADO`) e, no recusado, o motivo **tal como o provedor o informou**. Não ' +
      'há janela sobre os itens — o conjunto é o de uma competência, conhecido antes de o percurso ' +
      'começar. `estado` é **derivado** dos instantes de desfecho, nunca uma coluna de status: ' +
      '`EM_ANDAMENTO` enquanto nenhum dos dois existe, `CONCLUIDA` ou `INTERROMPIDA` depois. O lote ' +
      '**interrompido é devolvido** com o motivo e com os itens que chegaram a ser gravados — é o ' +
      'que permite ver onde parou e por quê. Lote de outra empresa é indistinguível de inexistente: ' +
      '`404` com o mesmo corpo. Identificador malformado é `422` **sem tocar o banco**.',
  })
  @ApiOkResponse({
    description: 'O lote pedido, com a prestação de contas do instante da leitura.',
    schema: esquemaPublicado(esquemaDaEmissaoEmLote, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async lerEmissao(
    @Param(CAMPO_DO_IDENTIFICADOR) identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<EmissaoEmLote> {
    // O esquema **canoniza a caixa do UUID** além de conferir a forma — caixa não canonizada já foi
    // vetor de escalada nesta base, e é por isso que o identificador não vai cru ao banco.
    const loteId = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.lotes.ler(tx, loteId),
    );
  }

  @Post(SEGMENTO_DAS_CONFERENCIAS)
  // NADA é declarado neste método, e a ausência é a decisão — a justificativa literal está no
  // cabeçalho: o único desfecho que a conferência grava é *acusar pagamento de cobrança*, que a
  // `Decision` da ADR-0021 nomeia por escrito entre as instâncias que exigem apenas a área. Uma rota
  // não pode exigir mais do que o efeito que ela causa exige, e o catálogo é fechado.
  //
  // `200`, e não o `201` que o arcabouço dá a todo `@Post`: o disparo repetido **não cria recurso**
  // — ele devolve a execução que já está em curso —, e um `201` diria ao cliente que uma segunda
  // apuração nasceu.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Dispara a conferência bancária da empresa',
    description:
      'Manda apurar junto ao provedor o que aconteceu com os boletos vivos — é por aqui que o ' +
      'produto descobre pagamento feito fora dele. O corpo é **vazio e fechado**. Uma empresa tem ' +
      '**uma** conferência em curso por vez, e o disparo repetido **não é erro**: responde `200` ' +
      'com `iniciadaAgora: false` e o recurso da execução que já está acontecendo, informando qual ' +
      'é e desde quando — o `POST` é **idempotente**, e nada é enfileirado de novo. Quando a ' +
      'conferência nasce, `iniciadaAgora` é `true`, `concluidaEm` é nulo e os dois contadores estão ' +
      'em zero. `cobrancasConferidas` e `efeitos` são distintos de propósito: a apuração que ' +
      'perguntou por trinta cobranças e nada mudou publica `30` e `0`. Se o servidor de fila não ' +
      'aceitar a tarefa, a resposta é `503` e a conferência **permanece** aberta.',
  })
  @ApiOkResponse({
    description: 'A conferência aberta agora, ou a que já estava em curso.',
    schema: esquemaPublicado(esquemaDaConferenciaBancaria, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async dispararConferencia(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<ConferenciaBancaria> {
    // `corpo ?? {}` porque um `POST` sem corpo chega como `undefined`, e o que se exige é o objeto
    // **vazio e fechado**: qualquer chave é recusada nomeando-a. É a mesma forma das outras rotas de
    // ato de corpo vazio desta base.
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    const { conferencia, empresaId } = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => ({
        conferencia: await this.conferencias.abrir(tx, sessao.usuarioId),
        empresaId: sessao.empresaId,
      }),
    );

    // A execução que JÁ estava em curso sai daqui sem trilha e sem tarefa: nada aconteceu neste
    // pedido, e enfileirar de novo poria duas apurações concorrentes sobre a mesma linha. Registrar
    // uma linha de trilha por disparo repetido encheria o journal de prosa sem fato novo.
    if (!conferencia.iniciadaAgora) {
      return conferencia;
    }

    this.logger.info(
      { empresaId, entidade: ENTIDADE_DA_CONFERENCIA, conferenciaId: conferencia.id },
      'conferência bancária aberta',
    );

    // FORA da unidade de trabalho, pela mesma ordem da rota acima.
    await this.conferencias.enfileirar({ empresaId, conferenciaId: conferencia.id });

    return conferencia;
  }
}
