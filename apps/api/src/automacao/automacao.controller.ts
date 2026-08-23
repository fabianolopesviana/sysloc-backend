/**
 * As **cinco rotas da automação de cobrança** — `GET` e `PUT /v1/automacao-de-cobranca`, para ler a
 * régua que a empresa configurou e definir a que passa a valer; o `GET` e o `POST` de
 * `.../cobrancas/:codigo/avisos`, para ver o que já saiu e disparar um aviso agora; e o
 * `GET .../rotinas`, que publica ao Admin o **estado das rotinas agendadas** da empresa dele.
 *
 * ---------------------------------------------------------------------------
 * O CAMINHO sai da lista fixa de áreas de tela, e não de uma taxonomia inventada
 * ---------------------------------------------------------------------------
 *
 * É `/v1/automacao-de-cobranca`, e não `/v1/configuracoes/regua`. O glossário de domínio nomeia a
 * área de tela **"Automação de cobrança"**, o catálogo fechado da ADR-0011 a registra como
 * `TELA:automacao_de_cobranca`, e o caminho é a transcrição dela. É a mesma escolha, e a mesma
 * razão, de {@link ../mora/mora.controller.js}.
 *
 * O recurso é **singular**: uma política por empresa, e a chave é a própria sessão. Por isso não há
 * `:id` nestas duas rotas, e por isso a escrita é `PUT` sobre a coleção — não há o que criar nem o
 * que apagar, só o que definir.
 *
 * ---------------------------------------------------------------------------
 * AS CINCO ROTAS MORAM NA MESMA CLASSE, e o disparo PRECISA morar aqui
 * ---------------------------------------------------------------------------
 *
 * Ela se chama `AutomacaoDeCobrancaController`, e não `PoliticaDeAvisoController`, porque o
 * histórico de envios e o **disparo manual** moram nela — e o disparo **precisa** morar aqui. Ele
 * exige a conjunção `TELA:automacao_de_cobranca` + `ACAO:enviar_cobranca_manual`; num controlador
 * cuja classe declarasse outra área — `CobrancaController`, por exemplo —, a declaração do método
 * **substituiria** a da classe (`getAllAndOverride`), e o `CT-355` acusaria um manipulador exigindo
 * coisa diferente da classe dele. Um segundo controlador para as rotas de aviso reabriria
 * exatamente essa armadilha.
 *
 * ---------------------------------------------------------------------------
 * A exigência é da CLASSE, e só o DISPARO declara — e declara a CONJUNÇÃO INTEIRA
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DA_AUTOMACAO_DE_COBRANCA)` na classe vale para os manipuladores que não declaram
 * nada próprio — a guarda lê o metadado com `getAllAndOverride`, e a declaração da classe é o que ela
 * encontra. **Quatro** das cinco rotas são assim, e declarar quatro vezes o mesmo valor criaria
 * quatro lugares para esquecer um.
 *
 * **Quatro não exigem chave de ação, e a ausência é decisão registrada** (§11.2 da tech spec): ler e
 * definir a configuração da própria imobiliária são atos operacionais do cadastro, **consultar o
 * histórico não é ato sensível** (RN-12) — é leitura do que já aconteceu, e negá-la a quem tem a área
 * esconderia dele por que um aviso não saiu — e **ler o estado das rotinas é leitura pela mesma
 * régua**: ele diz por que um aviso não saiu, um degrau acima. Governá-lo por chave de ação exigiria
 * uma chave nova, e o catálogo da ADR-0011 é **fechado** em 10 telas × 7 ações.
 *
 * O **disparo manual** é o único ato sensível da área, e ele declara
 * `@ExigeChaves(AREA_DA_AUTOMACAO_DE_COBRANCA, ACAO_DE_ENVIO_MANUAL)` — o decorador **plural**, com a
 * **conjunção inteira**.
 *
 * > ⚠️ **Nunca declare só a ação.** `getAllAndOverride` é **override**, não união: `@ExigeChave(ACAO…)`
 * > no método **apaga** a área da classe, em silêncio, e o manipulador passa a exigir **menos** que a
 * > classe dele. Foi defeito explorável nas duas rotas de circulação de conjunto, é o que o marcador
 * > `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} governa, e é o que o `CT-355`
 * > reprova por conteúdo. **A ordem também é conteúdo**: a recusa nomeia a **primeira** chave ausente
 * > (ADR-0018), e a área vem antes da ação para que quem tem a área ouça o nome do que lhe falta.
 *
 * **Nenhuma chave nasce aqui**, e `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado**: a
 * área e a ação já existem, e o catálogo é fechado — abrir exigiria supersedê-la ADR-0011.
 * `ACAO:enviar_cobranca_manual` **preserva o nome histórico**, e a coerência do catálogo já a mapeia
 * para esta mesma área.
 *
 * ---------------------------------------------------------------------------
 * O DISPARO é rota própria, e NÃO é transição de estado (ADR-0021)
 * ---------------------------------------------------------------------------
 *
 * `POST :codigo/avisos` não move `status` da cobrança, não escreve em `negocio.cobranca` e não toca a
 * mora: o que ele cria é uma **tentativa registrada**. A ADR-0021 o alcança pela cláusula de **ato de
 * negócio governado pela natureza** — ele fala com o mundo em nome da imobiliária, e é isso que o põe
 * atrás de chave de ação —, e não pela de transição. É por isso que a recusa dele não publica
 * `transicaoPedida`, e por isso que o corpo é **vazio e fechado**: não há o que parametrizar num ato
 * cujo conteúdo inteiro é derivado do estado que já está publicado (ADR-0022).
 *
 * **Ele responde `200`, e não `201`.** A linha do registro é consequência do ato, não o recurso que o
 * cliente foi criar — mesma escolha, e mesma razão, das transições de
 * {@link ../cobrancas/cobranca.controller.js}. E responde `200` **inclusive quando a entrega falhou**:
 * o desfecho viaja no corpo, e a razão está no serviço.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA DAS ROTINAS mora AQUI, e não sob `/saude` nem em caminho próprio
 * ---------------------------------------------------------------------------
 *
 * `GET .../rotinas` é a **última rota que este repositório publica antes do congelamento da
 * superfície**, e o lugar dela é decisão de três partes:
 *
 *   1. **Caminho próprio exigiria chave nova.** O catálogo da ADR-0011 é fechado — 10 telas e 7 ações
 *      —, e nenhuma delas se chama "automações". Uma área nova é alteração de catálogo, que esta
 *      fatia não tem mandato para fazer.
 *   2. **`/saude` é de outra natureza.** `apps/api/src/saude/` existe, é `@RotaPublica()` e responde
 *      a liveness/readiness de **infraestrutura**, ao supervisor do sistema operacional. O estado das
 *      rotinas é dado de **negócio**, por empresa, sob sessão e sob política de linha. Mesma palavra,
 *      naturezas opostas: pendurá-lo ali daria a quem não tem sessão o retrato operacional de toda
 *      empresa do SaaS.
 *   3. **É aqui que a régua já mora**, e a régua é a rotina de maior cadência do roster — quem
 *      administra a automação de cobrança é exatamente quem precisa saber se ela passou.
 *
 * A resposta é `{ itens }` e **nunca `404`**: a empresa que ainda não teve passagem alguma recebe
 * `200` com `ultimaExecucao: null`, `resumo: null` e `historicoRecente: []`, no mesmo molde da
 * leitura da política — e a leitura **não cria linha alguma**. *"Ainda não rodou"* e *"não existe"*
 * são a mesma coisa publicada.
 *
 * ⚠️ **Não há corpo, não há esquema de entrada e não há parâmetro de consulta**, e a tríplice ausência
 * é conteúdo: a empresa vem da sessão, e **nunca** do pedido (ADR-0008/ADR-0024). Um `?empresaId=` na
 * cadeia de consulta é simplesmente ignorado pelo roteador porque **esta rota não lê parâmetro
 * nenhum** — não há por onde ele entrar, que é mais forte do que haver um ramo que o recuse.
 *
 * ⚠️ **A saída é contrato ABERTO** (`z.object`), e é isso que torna reversível a decisão D3 da fatia
 * — publicar **uma** leitura em vez de duas. Campo novo no estado nasce sem quebrar cliente
 * publicado; uma segunda rota publicada "por precaução" congelaria o que não se provou necessário, e
 * essa direção **não** é reversível depois do congelamento.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor. As duas passam por
 * {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta
 * própria nem chama `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é
 * a sessão que a guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o
 * ponto seguinte.
 *
 * ---------------------------------------------------------------------------
 * O corpo do `PUT` é COMPLETO — campo ausente é RECUSA
 * ---------------------------------------------------------------------------
 *
 * `esquemaDaPoliticaDeAvisoNova` é `strictObject` de seis campos, nenhum opcional, e a conferência é
 * a única desta rota: campo ausente é `422` nomeando o campo que falta, **nunca** "preserve o valor
 * atual". A razão está no cabeçalho de `packages/contracts/src/automacao-de-cobranca.ts`, e é o
 * defeito do `PUT` parcial que copia o `required` do `POST` — o cliente que envia só `ativo`
 * acredita ter zerado o resto, e o servidor mantém o anterior sem que nada acuse. A ausência de
 * campo opcional é também o que torna a rota **idempotente por construção**.
 *
 * `empresaId` **nunca** vem do corpo: o `strictObject` o recusa por chave desconhecida, sem uma
 * linha de verificação escrita à mão (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * A LEITURA DA POLÍTICA NUNCA RESPONDE `404` (RD-03) — as de aviso respondem
 * ---------------------------------------------------------------------------
 *
 * Empresa que nunca configurou lê `200` com a régua **desligada**, e **a leitura não cria linha
 * alguma**. As duas metades da regra têm razão própria, e as duas estão no cabeçalho de
 * `packages/db/src/politica-de-aviso.ts`; a que se enxerga daqui é a primeira: um `404` faria esta
 * rota discordar do que a passagem da régua faz na mesma empresa — nada — e obrigaria o cliente a
 * tratar como erro o estado inicial de toda empresa nova. Não há neste arquivo, portanto, um
 * `@ApiNotFoundResponse` para as duas rotas da **política** — a ausência é contrato publicado, e não
 * esquecimento.
 *
 * As duas rotas de **aviso** declaram o `404`, e a assimetria tem causa: ali existe recurso
 * identificado no caminho, e a cobrança que o contexto não alcança é ausência de recurso. As duas
 * causas — inexistente e de outra empresa — respondem o **mesmo** corpo, byte a byte (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * O `:codigo` é validado e CANONIZADO antes de qualquer consulta (ADR-0017)
 * ---------------------------------------------------------------------------
 *
 * A cobrança tem série declarada, e por isso a chave exposta é o código legível — nunca o UUID
 * interno. `ESQUEMA_DO_CODIGO_DE_COBRANCA`, de `@sysloc/contracts`, valida a **forma** e canoniza a
 * caixa (`trim` → maiúsculas), e é **importado, nunca redigitado**. A validação acontece **antes** de
 * a unidade de trabalho abrir: valor malformado é `422` sem tocar o banco, em vez de virar `404`
 * depois de uma ida inútil — e sem que a forma do identificador vire um oráculo de existência.
 *
 * ---------------------------------------------------------------------------
 * O LOG não carrega os valores da política (§13.1)
 * ---------------------------------------------------------------------------
 *
 * A linha de trilha da definição nomeia `empresaId` e `entidade` — e nada mais. Os seis campos
 * **ficam de fora** de propósito: o que a trilha precisa registrar é que a régua daquela empresa
 * mudou e quando, e o que vigora se lê pela rota, sob autorização. **A leitura não registra linha
 * alguma** — trilha de leitura é ruído por requisição, sem fato novo a registrar (o mesmo critério
 * de `mora.controller.ts`).
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type EnvioDeCobranca,
  ESQUEMA_DO_CODIGO_DE_COBRANCA,
  type EstadoDasRotinas,
  envelopeDeLista,
  esquemaDaJanela,
  esquemaDaPoliticaDeAviso,
  esquemaDaPoliticaDeAvisoNova,
  esquemaDoEnvioDeCobranca,
  esquemaDoEstadoDasRotinas,
  type PoliticaDeAviso,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { AutomacaoDeCobrancaService, type PaginaDeEnvios } from './automacao.service.js';

/**
 * Caminho da superfície da automação de cobrança, relativo ao prefixo de versão (§4.1:
 * `/v1/automacao-de-cobranca`).
 *
 * A grafia com hífens é a do caminho HTTP; a da chave do catálogo é `TELA:automacao_de_cobranca`,
 * com sublinhado. As duas descrevem a mesma área e vivem em vocabulários diferentes — caminho de URL
 * e identificador de permissão —, e por isso são constantes separadas em vez de uma derivada da
 * outra.
 */
export const CAMINHO_DA_AUTOMACAO_DE_COBRANCA = 'automacao-de-cobranca';

/**
 * A área de tela que governa esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal solto no decorador: o valor é **contrato publicado** — ele
 * aparece no corpo da recusa que o cliente lê, em `detalhes.exigido` —, e ter nome é o que permite à
 * auditoria de conteúdo examiná-lo sem casar uma cadeia escrita em dois lugares. A T10 declara a
 * conjunção do disparo manual a partir desta mesma constante, que é o que impede a área de divergir
 * entre a classe e o método.
 */
const AREA_DA_AUTOMACAO_DE_COBRANCA = 'TELA:automacao_de_cobranca' as const;

/**
 * A ação sensível que governa o **disparo manual** (RN-12, ADR-0021).
 *
 * Constante nomeada pela mesma razão da área acima, e por uma que só vale para ela: este valor
 * aparece em **três** pontos que precisam coincidir — a chave do catálogo fechado, a declaração do
 * método e o `detalhes.exigido` que a recusa publica. A coincidência entre os três é o que faz a
 * exigência ser verdade, e três literais soltos ficariam livres para divergir.
 *
 * ⚠️ **O nome é histórico e não se "corrige"**: o catálogo o registra assim desde a ADR-0011, e ele
 * não redefine o termo "cobrança" do glossário — mesmo caso de `ACAO:excluir_cadastro`.
 */
const ACAO_DE_ENVIO_MANUAL = 'ACAO:enviar_cobranca_manual' as const;

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é do identificador da rota. */
const CAMPO_DO_CODIGO = 'codigo';

/** Nome de campo usado quando a recusa é da cadeia de consulta — o mesmo de toda janela. */
const CAMPO_DA_CONSULTA = 'limite';

/** A entidade nomeada na linha de trilha da política — escrita uma vez (§13.1). */
const ENTIDADE_DA_TRILHA = 'politica_de_aviso';

/**
 * A entidade nomeada na linha de trilha do disparo manual.
 *
 * É `envio_de_cobranca`, e não `cobranca`: o que o ato registra é uma **tentativa de envio**, e a
 * cobrança não é tocada por ele (ADR-0022). Nomear a cobrança faria a trilha sugerir uma escrita que
 * não aconteceu.
 */
const ENTIDADE_DA_TRILHA_DO_AVISO = 'envio_de_cobranca';

/**
 * O segmento das duas rotas de aviso, escrito **uma vez** — ele entra no par que as âncoras auditam.
 *
 * O caminho é `cobrancas/:codigo/avisos` **dentro** da área, e não sob `/v1/cobrancas`: a razão é a
 * exigência, e está no cabeçalho deste arquivo. O recurso é a coleção de tentativas **daquela**
 * cobrança, de modo que o `GET` lê a coleção e o `POST` acrescenta um item a ela — que é exatamente o
 * que o disparo faz.
 */
const SEGMENTO_DOS_AVISOS = 'cobrancas/:codigo/avisos';

/**
 * O segmento da leitura do estado das rotinas — escrito **uma vez**, e exportado.
 *
 * Ele é exportado, ao contrário de {@link SEGMENTO_DOS_AVISOS}, porque a **âncora de superfície** o
 * consome: `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts` compõe o par auditado a partir do dono
 * do segmento, e não de uma cadeia crua — um segmento que mudasse aqui sem passar por lá faria a
 * âncora procurar um caminho que a aplicação não publica, e reprovar dizendo *"a rota sumiu"* quando
 * ela só mudou de nome. É a mesma escolha, e a mesma razão, de `SEGMENTO_DA_ENTREGA_DA_NOTICIA`.
 *
 * ⚠️ Ele **não colide** com `SEGMENTO_DOS_AVISOS` nem com o recurso singular da raiz: `rotinas` é
 * literal, e o roteador do arcabouço casa literal antes de parâmetro.
 */
export const SEGMENTO_DAS_ROTINAS = 'rotinas';

/** O envelope do histórico, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA_DE_ENVIOS = envelopeDeLista(esquemaDoEnvioDeCobranca);

@ApiTags('automacao-de-cobranca')
@Controller(CAMINHO_DA_AUTOMACAO_DE_COBRANCA)
@ExigeChave(AREA_DA_AUTOMACAO_DE_COBRANCA)
export class AutomacaoDeCobrancaController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(AutomacaoDeCobrancaService) private readonly automacao: AutomacaoDeCobrancaService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lê a política de aviso da empresa',
    description:
      'Devolve a régua vigente na empresa **da sessão**. A empresa que nunca configurou recebe ' +
      '`200` com a régua **desligada** (`"ativo": false`, janela `00:00`–`23:59`) — **nunca ' +
      '`404`** —, e a leitura **não cria linha alguma**: a ausência de política e a régua ' +
      'explicitamente desligada são a mesma coisa publicada, e é isso que faz esta leitura ' +
      'concordar com o que a passagem da régua faz numa empresa sem política, que é nada.',
  })
  @ApiOkResponse({
    description: 'A política vigente — desligada quando a empresa nunca a definiu.',
    schema: esquemaPublicado(esquemaDaPoliticaDeAviso, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  async lerPolitica(@Req() requisicao: FastifyRequest): Promise<PoliticaDeAviso> {
    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.automacao.lerPolitica(tx),
    );
  }

  @Put()
  @ApiOperation({
    summary: 'Define a política de aviso da empresa',
    description:
      'O corpo é **completo**: os seis campos são obrigatórios, e campo ausente é `422` — nunca ' +
      '"preserve o valor atual". A antecedência vive em `[0, 90]` dias e o intervalo mínimo entre ' +
      'dois avisos da mesma cobrança em `[1, 90]` dias; a janela é um par `HH:MM` que precisa ' +
      'terminar em hora igual ou posterior à de início, e o único canal implementado é `EMAIL`. A ' +
      'política nasce na empresa **da sessão** — a empresa nunca é aceita pelo corpo —, e a ' +
      'chamada é idempotente: o mesmo corpo aplicado duas vezes deixa a empresa com **uma** ' +
      'política, nunca duas. **Nenhum aviso é disparado por esta rota**: o que ela define é o que a ' +
      'passagem seguinte da régua vai obedecer.',
  })
  @ApiOkResponse({
    description: 'A política que passou a valer.',
    schema: esquemaPublicado(esquemaDaPoliticaDeAviso, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async definirPolitica(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PoliticaDeAviso> {
    const entrada = validar(esquemaDaPoliticaDeAvisoNova, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const vigente = await this.automacao.definirPolitica(tx, entrada);

      // Os campos são os que a §13.1 nomeia para este evento. **Os seis valores ficam de fora** — a
      // trilha registra que a régua mudou, não qual é ela.
      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA },
        'política de aviso definida',
      );

      return vigente;
    });
  }

  @Get(SEGMENTO_DOS_AVISOS)
  // NADA é declarado neste método, e a ausência é a decisão: consultar o histórico não é ato sensível
  // (RN-12), e a exigência da classe — a área — é o que a guarda encontra. Declarar aqui a mesma área
  // criaria um segundo lugar para esquecê-la; declarar a ação faria a leitura pedir a chave do
  // disparo, e quem só administra a régua deixaria de conseguir descobrir por que um aviso não saiu.
  @ApiOperation({
    summary: 'Lê o histórico de avisos de uma cobrança',
    description:
      'Devolve **todas** as tentativas de aviso daquela cobrança — as do trabalho automático e as ' +
      'disparadas por uma pessoa —, da mais recente para a mais antiga. Cada item traz o instante, ' +
      'o `caminho` (`AUTOMATICO` ou `MANUAL`), o `desfecho` (`ENVIADA`, `FALHOU` ou ' +
      '`SEM_DESTINATARIO`), o endereço para onde se tentou entregar e a `causa` — nula quando a ' +
      'mensagem saiu, preenchida quando não saiu. A janela é declarável por `limite` e ' +
      '`deslocamento`, e pedido acima do teto **recusa** em vez de truncar em silêncio; o `total` é ' +
      'o de todas as tentativas da cobrança, e não o tamanho da página. Cobrança sem tentativa ' +
      'alguma responde `200` com a lista vazia — **nunca `404`**. Cobrança de outra empresa é ' +
      'indistinguível de inexistente: `404` com o mesmo corpo. Código malformado é recusado com ' +
      '`422` **sem tocar o banco**.',
  })
  @ApiOkResponse({
    description: 'A página pedida do histórico.',
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA_DE_ENVIOS, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async lerHistorico(
    @Param('codigo') identificador: string,
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PaginaDeEnvios> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    // A janela vem INTEIRA de `@sysloc/contracts` (ADR-0016): o teto que recusa em vez de truncar e o
    // padrão da página são fatos do contrato, e nenhum esquema de paginação nasce nesta superfície.
    const janela = validar(esquemaDaJanela, consulta, CAMPO_DA_CONSULTA);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.automacao.lerHistorico(tx, codigo, janela),
    );
  }

  @Post(SEGMENTO_DOS_AVISOS)
  // A CONJUNÇÃO INTEIRA, e nunca só a ação: `getAllAndOverride` faz esta declaração **substituir** a
  // da classe, de modo que `@ExigeChave(ACAO_DE_ENVIO_MANUAL)` apagaria a área em silêncio e este
  // manipulador passaria a exigir MENOS que a classe dele. A ordem é conteúdo — a recusa nomeia a
  // PRIMEIRA ausente (ADR-0018), e a área vem antes para que quem já a tem ouça o nome da ação.
  @ExigeChaves(AREA_DA_AUTOMACAO_DE_COBRANCA, ACAO_DE_ENVIO_MANUAL)
  // `200`, e não o `201` que o arcabouço dá a todo `@Post`: o ato **registra** um envio, e a linha do
  // registro é consequência dele, não o recurso que o cliente foi criar. Mesma escolha, e mesma
  // razão, das transições de {@link ../cobrancas/cobranca.controller.js}.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Dispara agora o aviso de uma cobrança',
    description:
      'Envia o aviso **na hora**, a pedido de quem tem a ação `ACAO:enviar_cobranca_manual` além da ' +
      'área. Ele **ignora a janela de horário, o intervalo mínimo entre avisos e o recorte de dias ' +
      'de antecedência** — os três governam a passagem automática, e quem clica está dizendo ' +
      '"agora" —, mas **não ignora o estado**: cobrança **paga** ou **cancelada** é recusada com ' +
      '`422`, `campo: "codigo"` e `detalhes.estadoAtual`, e **nenhuma mensagem sai nem linha ' +
      'nasce**. O estado lido é o **mesmo** que a passagem automática consulta, e não um segundo ' +
      'cálculo. A resposta é a linha do registro, **inclusive quando a entrega falhou**: ali o ' +
      '`desfecho` é `FALHOU` e a `causa` diz por quê, e ainda assim o código é `200` — a ' +
      'requisição foi atendida, a tentativa foi feita e registrada, e o que fracassou foi a ' +
      'comunicação com terceiro. Locatário sem endereço de contato registra `SEM_DESTINATARIO`. O ' +
      'corpo é **vazio e fechado**. Cobrança de outra empresa é indistinguível de inexistente: ' +
      '`404` com o mesmo corpo.',
  })
  @ApiOkResponse({
    description: 'A tentativa registrada — com o desfecho, mesmo quando a entrega falhou.',
    schema: esquemaPublicado(esquemaDoEnvioDeCobranca, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async dispararAviso(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<EnvioDeCobranca> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_COBRANCA, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const registrado = await this.automacao.dispararAviso(tx, codigo);

      // Os campos são os que a §13.1 nomeia para este evento. **O destinatário fica de fora**, e a
      // ausência é a decisão: ele é o endereço de contato de uma pessoa, e a trilha registra que o
      // aviso foi disparado e como terminou — a quem ele foi é a tabela de envios, sob autorização.
      // A `causa` também não entra: ela é texto vindo do transporte.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA_DO_AVISO,
          codigo: registrado.cobrancaCodigo,
          desfecho: registrado.desfecho,
        },
        'aviso de cobrança disparado manualmente',
      );

      return registrado;
    });
  }

  @Get(SEGMENTO_DAS_ROTINAS)
  // NADA é declarado neste método, e a ausência é a decisão: ler o estado das rotinas é leitura pela
  // mesma régua do histórico de avisos (RN-12), e a exigência da classe — a área — é o que a guarda
  // encontra. ⚠️ Declarar aqui `@ExigeChave(...)` seria SUBSTITUIÇÃO, e não união
  // (`getAllAndOverride`): com a área repetida, criaria um segundo lugar para esquecê-la; com uma
  // ação, apagaria a área em silêncio e este manipulador exigiria MENOS que a classe dele. O catálogo
  // é fechado (ADR-0011) e nenhuma chave nasce para esta rota.
  @ApiOperation({
    summary: 'Lê o estado das rotinas agendadas da empresa',
    description:
      'Devolve, em `itens`, **uma entrada por rotina publicada** — a régua de aviso, o encerramento ' +
      'de contratos e a conferência de liquidação —, sempre as três e sempre na mesma ordem. Cada ' +
      'entrada traz a `cadencia` declarada, a `ultimaExecucao` que produziu efeito, o `resumo` ' +
      'daquela passagem, a `proximaEsperada`, se ela está `atrasada` e o `impedimento` corrente — o ' +
      'que está na alçada do Admin e ele consegue resolver sozinho (régua desligada, avisos ' +
      'recusados pelo provedor, integração bancária pendente), ou `null` quando nada impede. O ' +
      '`historicoRecente` traz as últimas passagens daquela rotina, da mais recente para a mais ' +
      'antiga. A empresa que ainda não teve passagem alguma recebe `200` com `ultimaExecucao` e ' +
      '`resumo` nulos e `historicoRecente` vazio — **nunca `404`** —, e a leitura **não cria linha ' +
      'alguma**. O alcance é a empresa **da sessão**: não há corpo, não há parâmetro de consulta e ' +
      'a empresa nunca é aceita pelo pedido.',
  })
  @ApiOkResponse({
    description: 'O estado corrente das rotinas publicadas, na ordem do roster.',
    schema: esquemaPublicado(esquemaDoEstadoDasRotinas, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  async lerRotinas(@Req() requisicao: FastifyRequest): Promise<EstadoDasRotinas> {
    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.automacao.lerEstadoDasRotinas(tx),
    );
  }
}
