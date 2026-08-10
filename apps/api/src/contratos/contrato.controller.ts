/**
 * As **seis rotas de cadastro do contrato de locação** — montar, listar, ler, alterar, retirar de
 * circulação e recircular — mais as **duas transições de estado governadas do produto**
 * (`POST /:codigo/ativacao` e `POST /:codigo/cancelamento`). Com a segunda, a máquina de estados
 * fecha.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DOS_CONTRATOS)` na classe vale para os seis manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar seis vezes o mesmo valor criaria seis lugares para esquecer um.
 *
 * A dimensão é a de **chave**, e nunca a de perfil (§11.2): é o que permite ao Admin conceder e
 * retirar o alcance à carteira de contratos por ajuste individual, com a negação individual vencendo a
 * matriz do perfil (ADR-0010). O Sysloc Master **não alcança** estas rotas, e é por construção: a
 * matriz de perfil dele é vazia e a exigência aqui é por chave (ADR-0013).
 *
 * ---------------------------------------------------------------------------
 * As DUAS rotas de circulação exigem a ÁREA **E** a AÇÃO — conjunção, não substituição
 * ---------------------------------------------------------------------------
 *
 * Elas declaram `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)` — a **conjunção inteira**, e
 * não apenas a ação. A forma intuitiva (`@ExigeChave` no método, contando com a área da classe) está
 * errada e o erro é **silencioso**: `getAllAndOverride` faz a declaração do método **substituir** a da
 * classe, e a área desaparece daquelas duas rotas.
 *
 * A razão por extenso, com o defeito medido e explorável que a produziu, está no marcador
 * `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} — **é ele que governa esta escolha
 * aqui também**, e por isso não é copiado: marcador replicado apodrece, porque o original é corrigido
 * e a cópia não. A decisão que o torna exprimível é a **ADR-0018**, e a rede que impede a substituição
 * de renascer nesta superfície é o `CT-355`, que varre a aplicação inteira e acusa qualquer
 * manipulador que exija **menos** do que a classe dele.
 *
 * **A ordem das duas chaves é conteúdo, e não estilo**: a recusa nomeia a **primeira** ausente
 * (RN-14). Com a área declarada antes da ação, quem tem a área e não tem a ação recebe
 * `detalhes.exigido: 'ACAO:excluir_cadastro'`, e quem tem a ação e não tem a área recebe o nome da
 * área — que é a direção pela qual o defeito da fatia anterior era explorável. Aqui a distinção é
 * ainda mais material do que em `/v1/imoveis`: `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é
 * `TELA:cadastros`, que **não** é a área desta classe, de modo que declarar só a ação daria a quem
 * administra locador, locatário e fiador o poder de retirar contratos de circulação numa área que lhe
 * é negada.
 *
 * ---------------------------------------------------------------------------
 * As DUAS TRANSIÇÕES são rotas PRÓPRIAS, e cada uma tem a SUA ação (ADR-0021, ADR-0018)
 * ---------------------------------------------------------------------------
 *
 * `POST /:codigo/ativacao` declara `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_ATIVACAO)` e
 * `POST /:codigo/cancelamento` declara `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)`. A
 * forma é a mesma das duas rotas de circulação, e a razão por extenso está no marcador
 * `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} — declarar aqui só a ação
 * **substituiria** a exigência da classe, e `TELA:contratos` sumiria destas rotas em silêncio.
 *
 * **A ação é outra a cada ato, e a diferença é o ponto da ADR-0021**: transitar estado não é
 * cadastrar, e `ACAO:ativar_contrato` e `ACAO:cancelar_contrato` existem no catálogo fechado desde a
 * fase de autorização exatamente para separar quem monta, de quem faz valer, de quem desfaz. Exigir
 * qualquer uma delas na rota de **criação** desfaria essa separação — é a alternativa que a ADR
 * rejeita por escrito. Nenhuma chave nova é criada (ADR-0011).
 *
 * **Os dois atos desta superfície estão NOMINALMENTE na primeira classe da ADR-0021** — a que exige
 * a chave de ação —, e é por isso que a exigência aqui não é julgamento local: a `Decision` cita
 * *"a ativação de contrato, o cancelamento de CONTRATO e a retirada de circulação"*, as três com
 * chave própria já existente. A 0021 recortou a regra mecânica da 0019 em duas classes, e o que
 * decide é a **natureza do ato**: quem é atributo operacional do cadastro — não transfere direito,
 * não move dinheiro, não altera o que outra entidade pode fazer — exige apenas a área. Aqui não é
 * o caso, e a distância entre as classes é curta: o cancelamento de **cobrança** está na segunda,
 * por nome, e confundir os dois é o erro que a T7 desta fatia custou uma rodada de gate.
 *
 * **As três ações desta superfície são independentes, e a mais tentadora das confusões é reaproveitar
 * `ACAO:excluir_cadastro` para cancelar.** A rejeição segue **nominal e vigente**: ela está escrita
 * no `Context` da **ADR-0021**, que a herda da 0019 ao supersedê-la, e a `Decision` fecha o assunto
 * pelo outro lado ao dar ao cancelamento de contrato a **sua** chave. A razão é de
 * efeito: retirar de circulação é visibilidade e **não libera o imóvel**; cancelar é transição e
 * **libera**. Quem administra a circulação de cadastros não pode, por isso, destravar um imóvel. As
 * quatro rotas que declaram no método são adjacentes neste fonte, e a linha copiada da vizinha é o
 * erro provável — o `CT-320 (b)` e o `CT-320 (c)` de `test/autorizacao-do-dominio.e2e.spec.ts` medem
 * exatamente essa escalada, com uma sessão que **tem** as outras ações.
 *
 * A ordem é área **antes** da ação, e ela é conteúdo: a recusa nomeia a **primeira** ausente, de modo
 * que quem tem a área e não tem a ação recebe `detalhes.exigido: 'ACAO:cancelar_contrato'` — o nome
 * do que de fato lhe falta. Invertida, quem só cadastra receberia o nome de uma área que já possui.
 *
 * O estado **não é escolhido pelo cliente**: o corpo das duas é vazio e fechado, e `status` sequer
 * existe no esquema de entrada de contrato. Sem o corpo fechado, quem enviasse `{"status":"ATIVO"}`
 * receberia `200` e acreditaria ter escolhido o estado.
 *
 * ---------------------------------------------------------------------------
 * A CRIAÇÃO e a ATIVAÇÃO abrem DUAS unidades de trabalho SEQUENCIAIS (ADR-0015, ADR-0020)
 * ---------------------------------------------------------------------------
 *
 * ```
 * criar    · unidade 1:  contratos.garantirSerie(tx) → ano do CONTRATO, e COMMITA
 *            unidade 2:  conferências; emissão do número; gravação do contrato e dos fiadores
 *
 * ativar   · unidade 1:  cobrancas.garantirSerie(tx) → ano da COBRANÇA, e COMMITA
 *            unidade 2:  conferências; transição; ocupação do imóvel; emissão dos N números e
 *                        gravação das N parcelas
 * ```
 *
 * **A razão não é estilo, e este é o ponto mais fácil de "simplificar" desta superfície.** Se a
 * criação da sequência e o `nextval` ficassem na mesma transação, o desfazimento apagaria a sequência
 * recém-criada e o registro seguinte tomaria `nextval = 1` outra vez — o número **seria reusado**,
 * contra a cláusula literal da ADR-0015 (*"nunca reusado, nem por criação abortada"*). Com as duas
 * unidades, a sequência já está commitada quando o `nextval` corre, e a criação abortada queima o
 * número para sempre: o furo que a ADR aceita por escrito, e que o `CT-404` e o `CT-536` medem.
 *
 * Nas duas rotas as unidades **não aninham** — a segunda começa depois de a primeira fechar —, então o
 * marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`, que recusa abrir uma segunda
 * unidade **de dentro** de uma aberta, **não é tocado**. As demais rotas abrem uma unidade só.
 *
 * O **ano** sai de dentro da primeira unidade e viaja para a segunda: ele é lido do relógio do banco
 * uma única vez, e é o mesmo valor que alimenta o contador, a emissão e o código. Ver
 * {@link ContratoService.garantirSerie} e {@link CobrancaService.garantirSerie}.
 *
 * **São contadores diferentes, e os dois anos saem de relógios diferentes de propósito.** A criação
 * garante o contador do CONTRATO (`lerAnoDaSerieDeContrato`, fuso da sessão); a ativação garante o da
 * COBRANÇA (`lerAnoDaSerieDeCobranca`, `negocio.data_corrente_da_operacao()`, fuso do objeto — o mesmo
 * eixo que a visão `negocio.cobranca_derivada` consulta para classificar a linha). Reusar um pelo outro
 * poria o código de um ano no contador do outro nas horas em torno da virada, e a razão por extenso está
 * no docblock de `lerAnoDaSerieDeCobranca`. A ativação **não** garante o contador do contrato: o código
 * do contrato foi emitido na criação e não muda.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor. É o que torna a composição — o
 * contrato e os fiadores dele — um commit só. Todas as seis passam por {@link sobContextoDaSessao}, de
 * `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta própria nem chama
 * `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a sessão que a
 * guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o ponto seguinte.
 *
 * ---------------------------------------------------------------------------
 * A chave da rota é o CÓDIGO, e ele é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * O contrato tem **série declarada**, e por isso a chave exposta é o código legível — nunca o UUID
 * interno (ADR-0017). `ESQUEMA_DO_CODIGO_DE_CONTRATO`, de `@sysloc/contracts`, valida a **forma** e
 * canoniza a caixa (`trim` → maiúsculas). A validação acontece antes de a unidade de trabalho abrir:
 * um valor malformado é recusado com `422` sem tocar o banco, em vez de virar `404` depois de uma ida
 * inútil — e sem que a forma do identificador se torne um oráculo de existência. **O esquema é
 * importado, nunca redigitado**: normalizar em dois pontos deixa os dois livres para divergir.
 *
 * ---------------------------------------------------------------------------
 * O `PUT` carrega o corpo COMPLETO, e o corpo dos atos é VAZIO e FECHADO
 * ---------------------------------------------------------------------------
 *
 * Não há atualização parcial nesta superfície: o `PUT` usa o **mesmo** `esquemaDeContratoNovo` do
 * `POST`, campo ausente é recusa por campo obrigatório, e `fiadoresIds` é substituída por inteiro. O
 * `codigo` não está no corpo e não muda; `status`, `dataFimLocacao` e `valorTotalContrato` são
 * recusados como chave desconhecida pelo `strictObject` — a **ausência** deles no esquema é o
 * mecanismo (ADR-0021 — transição é rota própria, **nunca** campo gravado por atualização parcial do
 * recurso), e não uma conferência escrita aqui.
 *
 * O corpo das duas rotas de circulação é o objeto **vazio e fechado**: a marca de retirada é decidida
 * pelo servidor, e aceitá-la do cliente daria a ele o poder de datar a própria exclusão.
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
  type AtivacaoDeContrato,
  type Contrato,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  envelopeDeLista,
  esquemaDaAtivacaoDeContrato,
  esquemaDaJanelaComCirculacao,
  esquemaDeContratoNovo,
  esquemaDoContrato,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { CobrancaService } from '../cobrancas/cobranca.service.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { ContratoService, type PaginaDeContratos } from './contrato.service.js';

/** Caminho da superfície de contratos, relativo ao prefixo de versão (§4.1: `/v1/contratos/…`). */
export const CAMINHO_DOS_CONTRATOS = 'contratos';

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal repetido em três decoradores: ela aparece na classe **e** dentro da
 * conjunção das duas rotas de circulação, e é justamente a coincidência entre os três que faz o "além
 * disso" ser verdade. Três literais ficariam livres para divergir — e a divergência seria muda para a
 * verificação de existência, ainda que o `CT-355` a pegue por conteúdo.
 */
const AREA_DOS_CONTRATOS = 'TELA:contratos' as const;

/** A ação sensível que as duas rotas de circulação exigem **além** da área (ADR-0011, §4.1). */
const ACAO_DE_CIRCULACAO = 'ACAO:excluir_cadastro' as const;

/**
 * A ação sensível que a rota de ativação exige **além** da área (ADR-0011, ADR-0021, §4.1).
 *
 * Ela **já existe** no catálogo fechado desde a fase de autorização, e nenhuma chave nova é criada
 * nesta fatia — precisar de uma seria sinal de escopo mal delimitado. Constante nomeada porque o
 * literal é contrato: ele aparece no decorador **e** no corpo da recusa que o cliente lê.
 */
const ACAO_DE_ATIVACAO = 'ACAO:ativar_contrato' as const;

/**
 * A ação sensível que a rota de cancelamento exige **além** da área (ADR-0011, ADR-0021, §4.1).
 *
 * Ela também **já existe** no catálogo fechado, e é **outra** que não a de ativar: o cancelamento de
 * CONTRATO está nominalmente na primeira classe da ADR-0021 e leva a **sua** chave, de modo que
 * conceder o poder de fazer valer não concede o de desfazer. Reaproveitar `ACAO:excluir_cadastro`
 * aqui é a alternativa que a ADR rejeita nominalmente — retirar de circulação e cancelar têm efeitos
 * diferentes sobre o imóvel. ⚠️ **Não leia isto como regra para toda transição**: a 0021 exige a
 * chave conforme a natureza do ato, e o cancelamento de **cobrança** — outra entidade — está na
 * segunda classe, exigindo apenas a área.
 */
const ACAO_DE_CANCELAMENTO = 'ACAO:cancelar_contrato' as const;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_CODIGO = 'codigo';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é da cadeia de consulta. */
const CAMPO_DA_CONSULTA = 'limite';

/** A entidade nomeada na linha de trilha desta superfície — escrita uma vez, usada nas duas. */
const ENTIDADE_DA_TRILHA = 'contrato';

// O corpo das duas rotas de circulação **e** o das duas transições — **vazio e fechado** (§4.1.1) —
// é `ESQUEMA_DO_CORPO_VAZIO`, importado de `comum/esquema-de-corpo-vazio.js`. A marca de retirada e
// o estado são decididos pelo servidor, e nenhum campo é aceito; a razão por extenso, e por que a
// definição é única, estão no docblock daquele módulo (débito D23).

/** O envelope de lista de contratos, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDoContrato);

@ApiTags('contratos')
@Controller(CAMINHO_DOS_CONTRATOS)
@ExigeChave(AREA_DOS_CONTRATOS)
export class ContratoController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só — e, na criação e na ativação, o que torna as DUAS
    // unidades sequenciais exprimíveis sem aninhamento.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(ContratoService) private readonly contratos: ContratoService,
    // O serviço da COBRANÇA entra aqui por **uma** razão: a garantia do contador da série dela, na
    // primeira unidade da ativação. Ele é **consumido**, e não recriado — `garantirSerie` já existe e é
    // quem sabe de qual relógio o ano da cobrança sai. Uma segunda garantia escrita nesta superfície
    // seria a segunda fonte do mesmo fato, com liberdade para escolher o eixo errado; e é ele que faz
    // `contratos.module.ts` importar `CobrancasModule`, em vez de prover o serviço duas vezes.
    @Inject(CobrancaService) private readonly cobrancas: CobrancaService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Monta um contrato de locação',
    description:
      'O contrato nasce na empresa **da sessão de quem monta** — a empresa nunca é aceita pelo ' +
      'corpo —, **em circulação** e como `RASCUNHO`: ele ainda **não vale**, e não ocupa o imóvel. ' +
      'O `codigo` é emitido pelo servidor no formato `CTR-{ano}-{5 dígitos}`, único por empresa e ' +
      '**nunca reusado** (ADR-0015). `dataFimLocacao` e `valorTotalContrato` saem **nulos**: são ' +
      'derivados na ativação. Imóvel, locador, locatário e cada fiador precisam ser alcançáveis no ' +
      'contexto da sessão — cadastro de outra empresa responde `404`, com o **mesmo** corpo de ' +
      'cadastro inexistente — e precisam estar **em circulação**: o retirado responde `422` ' +
      'nomeando o campo, com `detalhes.circulacao: RETIRADO_DE_CIRCULACAO`.',
  })
  @ApiCreatedResponse({
    description: 'O contrato foi montado, como rascunho.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Contrato> {
    const entrada = validar(esquemaDeContratoNovo, corpo, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: ela **commita** antes de a segunda abrir, e é isso que impede o número de ser
    // reusado por uma criação abortada. Ver o cabeçalho deste arquivo — não funda as duas.
    const ano = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.garantirSerie(tx),
    );

    // SEGUNDA unidade: as conferências, a emissão do número e a gravação do contrato com os fiadores,
    // num commit só. Ela abre depois de a primeira fechar, e por isso não aninha.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const criado = await this.contratos.criar(tx, entrada, ano);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: criado.codigo },
        'contrato montado',
      );

      return criado;
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Lista a carteira de contratos da empresa',
    description:
      'Cada item traz código, partes, termos e estado — sem segunda consulta. Devolve apenas os ' +
      'contratos **em circulação**; `incluirRetirados=true` alcança também os que foram retirados ' +
      '(ADR-0014). A janela é declarável por `limite` e `deslocamento`, e pedido acima do teto ' +
      '**recusa** em vez de truncar em silêncio.',
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
  ): Promise<PaginaDeContratos> {
    // O esquema vem **inteiro** de `@sysloc/contracts`, que a ADR-0016 declara fonte única. A razão de
    // `incluirRetirados` ser união fechada de dois literais, e não `z.coerce.boolean()`, está por
    // extenso no docblock de `esquemaDaJanelaComCirculacao`.
    const { incluirRetirados, ...janela } = validar(
      esquemaDaJanelaComCirculacao,
      consulta,
      CAMPO_DA_CONSULTA,
    );

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.listar(tx, janela, { incluirRetirados }),
    );
  }

  @Get(':codigo')
  @ApiOperation({
    summary: 'Lê um contrato pelo código',
    description:
      'Alcança também o contrato **retirado de circulação**, que responde `200` com `retiradoEm` ' +
      'preenchido — sem isso a recirculação ficaria inalcançável pela interface. Contrato de outra ' +
      'empresa é indistinguível de inexistente: `404` com o mesmo corpo. Código malformado é ' +
      'recusado com `422` **sem tocar o banco**.',
  })
  @ApiOkResponse({
    description: 'O contrato pedido.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.ler(tx, codigo),
    );
  }

  @Put(':codigo')
  @ApiOperation({
    summary: 'Altera um contrato em rascunho',
    description:
      'Aceito **somente enquanto `RASCUNHO`** (RD-05): sobre um contrato `ATIVO` ou `CANCELADO` a ' +
      'resposta é `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`, e ' +
      'nada é gravado — mudar os termos de um contrato que já vale exige cancelar e montar outro. ' +
      'O corpo é **completo** e idêntico ao da montagem: não há atualização parcial, campo ausente ' +
      'é recusa por campo obrigatório, e `fiadoresIds` é **substituída por inteiro**, nunca ' +
      'mesclada. O `codigo` **não muda**, e a marca de circulação não é tocada por esta rota.',
  })
  @ApiOkResponse({
    description: 'O contrato como ele ficou.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    const entrada = validar(esquemaDeContratoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.alterar(tx, codigo, entrada),
    );
  }

  @Post(':codigo/ativacao')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem —, e a ação é a de ATIVAR, não a de circulação.
  // Ver o cabeçalho deste arquivo e, por extenso, o marcador `DECISÃO FECHADA` de
  // `imoveis/conjunto.controller.ts`: declarar aqui apenas a ação SUBSTITUIRIA a exigência da classe,
  // e `TELA:contratos` sumiria desta rota em silêncio.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_ATIVACAO)
  @ApiOperation({
    summary: 'Faz o contrato valer',
    description:
      'Transita `RASCUNHO → ATIVO` **num commit só** (ADR-0021): confere o estado e as condições ' +
      'de entrada, reconfere que imóvel, locador, locatário e fiadores continuam **em circulação** ' +
      '— a montagem pode ter sido há semanas —, deriva `dataFimLocacao` e `valorTotalContrato`, ' +
      'grava o contrato como `ATIVO` e marca o imóvel como `LOCADO`. Falha em qualquer etapa deixa ' +
      'o contrato `RASCUNHO` e o imóvel **exatamente como estava**. Sobre um contrato que não é ' +
      '`RASCUNHO` responde `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`; ' +
      'sobre um imóvel que já tem contrato vigente, `422` com `campo: "imovelId"` e ' +
      '`detalhes: { conflito: "IMOVEL_COM_CONTRATO_VIGENTE", contratoVigente }` — é o código do ' +
      'vigente que diz ao usuário o que cancelar. Um imóvel `INDISPONIVEL` **é ativável**: a ' +
      'situação significa "não ofereça nas buscas", não "proibido de locar". O corpo é vazio e ' +
      'fechado — o estado nunca é escolhido pelo cliente. **A ativação gera as parcelas de aluguel ' +
      'do contrato na MESMA unidade de trabalho**: são `prazoMeses` cobranças de natureza `ALUGUEL`, ' +
      'com código próprio da série `COB-{ano}-{7 dígitos}`, competência no primeiro dia de cada mês ' +
      'e vencimento no `diaVencimento` — e a resposta traz o contrato acrescido de `efeitos`, com ' +
      '`cobrancasGeradas` igual a **quantas nasceram**. Um contrato com ' +
      '`gerarCobrancasAutomaticamente: false` gera **zero** e responde `cobrancasGeradas: 0`. Recusa ' +
      'em qualquer etapa deixa o contrato `RASCUNHO`, o imóvel como estava e **nenhuma** cobrança.',
  })
  @ApiOkResponse({
    description:
      'O contrato como ele ficou, mais a declaração de quantas cobranças a ativação gerou.',
    schema: esquemaPublicado(esquemaDaAtivacaoDeContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ativar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<AtivacaoDeContrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: ela **commita** antes de a segunda abrir, e é isso que impede o número da
    // cobrança de ser reusado por uma ativação abortada. O contador é o da COBRANÇA, e a garantia é a
    // do serviço dela — ver o cabeçalho deste arquivo. Não funda as duas.
    const ano = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cobrancas.garantirSerie(tx),
    );

    // SEGUNDA unidade: as três escritas da ativação — o estado do contrato, a situação do imóvel e as
    // N parcelas — commitam juntas ou não commitam. Ela abre depois de a primeira fechar, e por isso
    // não aninha. Ver o cabeçalho do serviço.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const ativado = await this.contratos.ativar(tx, codigo, ano);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: ativado.codigo,
          acao: 'ativacao',
          cobrancasGeradas: ativado.efeitos.cobrancasGeradas,
        },
        'contrato ativado',
      );

      return ativado;
    });
  }

  @Post(':codigo/cancelamento')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem —, e a ação é a de CANCELAR: nem a de ativar,
  // que é a vizinha logo acima, nem a de circulação, que é a vizinha logo abaixo. Ver o cabeçalho
  // deste arquivo e, por extenso, o marcador `DECISÃO FECHADA` de `imoveis/conjunto.controller.ts`.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)
  @ApiOperation({
    summary: 'Faz o contrato deixar de valer',
    description:
      'Transita `ATIVO → CANCELADO` **num commit só** (ADR-0021): confere o estado, grava o ' +
      'contrato como `CANCELADO`, devolve o imóvel a `DISPONIVEL`, liberando-o para um contrato ' +
      'novo, e **cancela em cascata as cobranças do contrato que ainda podem ser canceladas** — as ' +
      'que não foram pagas nem canceladas. As **pagas** e as **já canceladas** ficam exatamente ' +
      'como estavam: valor pago, instante do cancelamento e os carimbos de multa e juros **não são ' +
      'reescritos**. Um contrato sem cobrança alguma responde `200` do mesmo jeito — cascata sobre ' +
      'conjunto vazio não é erro. Falha em qualquer etapa deixa o contrato `ATIVO`, o imóvel ' +
      '**exatamente como estava** e **nenhuma** cobrança cancelada. ' +
      '**O contrato permanece na carteira** (ADR-0014): nada é apagado, ele continua ' +
      'listado e legível como histórico, e `dataFimLocacao` e `valorTotalContrato` **não são ' +
      'zerados** — eles descrevem o que o contrato foi enquanto valeu. Sobre um contrato que não é ' +
      '`ATIVO` responde `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`: ' +
      'um rascunho abandonado se **retira de circulação**, não se cancela, e as duas operações têm ' +
      'efeitos distintos. A operação **não é idempotente por decisão** — repetir recebe `422` com ' +
      '`estadoAtual: "CANCELADO"`, porque o segundo pedido significa que quem o fez não sabia o ' +
      'estado. O corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato como ele ficou, agora cancelado.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async cancelar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // UMA unidade de trabalho, aberta aqui: as TRÊS escritas do cancelamento — o estado do contrato, a
    // situação do imóvel e a cascata nas cobranças — commitam juntas ou não commitam. Ver o cabeçalho
    // do serviço.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const { contrato: cancelado, cobrancasCanceladas } = await this.contratos.cancelar(
        tx,
        codigo,
      );

      // Os campos são os que a §13.1 da tech spec nomeia para este evento — `imovelId` entre eles,
      // porque é ele que diz **qual** imóvel voltou a ficar disponível. Nenhum valor monetário e
      // nenhum identificador de pessoa entram na linha.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: cancelado.codigo,
          imovelId: cancelado.imovelId,
          acao: 'cancelamento',
        },
        'contrato cancelado',
      );

      // A SEGUNDA linha, e ela é evento próprio na §13.1 — não um campo a mais na de cima. Ela é
      // **sempre** emitida, inclusive com `quantidade: 0`: condicioná-la a haver cobrança faria a
      // ausência da linha significar tanto *"cascata de conjunto vazio"* quanto *"cascata não
      // executada"*, e a contagem é justamente o que separa as duas.
      //
      // O campo se chama `quantidade`, como a §13.1 o declara, e **não** `cobrancasCanceladas`: o
      // irmão da ativação usa `cobrancasGeradas` porque aquele nome é o do **efeito publicado**
      // (`efeitos.cobrancasGeradas`), e a linha espelha o contrato. Aqui não há efeito publicado — a
      // resposta é o contrato no root, por decisão registrada —, e um nome que sugerisse campo de
      // corpo anunciaria contrato que não existe.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: cancelado.codigo,
          quantidade: cobrancasCanceladas,
        },
        'cobranças canceladas em cascata',
      );

      return cancelado;
    });
  }

  @Post(':codigo/retirada')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem. Ver o cabeçalho deste arquivo e, por extenso,
  // o marcador `DECISÃO FECHADA` de `imoveis/conjunto.controller.ts`: declarar aqui apenas a ação
  // SUBSTITUIRIA a exigência da classe, e `TELA:contratos` sumiria desta rota em silêncio.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Retira o contrato de circulação',
    description:
      '**Nada é apagado** (ADR-0014): o contrato some das listagens e continua legível por quem já ' +
      'o referencia. A retirada é de **visibilidade** — ela alcança qualquer estado, **não muda o ' +
      'estado** e **não libera o imóvel**: um contrato ativo retirado continua vigente, e é isso ' +
      'que impede a retirada de virar porta lateral para destravar o imóvel sem cancelar o ' +
      'contrato. A operação é **idempotente**: repetir mantém a MESMA marca e responde `200`. O ' +
      'corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato, agora com a marca de retirada.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async retirar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    return await this.definirCirculacao(identificador, corpo, requisicao, false);
  }

  @Post(':codigo/recirculacao')
  @HttpCode(200)
  // A MESMA conjunção da retirada, e pela mesma razão. As duas rotas movem a mesma coluna em sentidos
  // opostos; exigir coisas diferentes delas seria abrir um caminho para desfazer o que a outra exige.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Devolve o contrato à circulação',
    description:
      'Zera a marca de retirada, sem tocar o estado. É o que torna a retirada reversível — e é por ' +
      'ela existir que `GET /v1/contratos/:codigo` alcança o contrato retirado. O corpo é vazio e ' +
      'fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato, de volta à circulação.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async recircular(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    return await this.definirCirculacao(identificador, corpo, requisicao, true);
  }

  /**
   * As duas rotas de circulação, num ponto só — elas diferem em **um** valor.
   *
   * Escrever as duas por extenso deixaria livres para divergir a validação do código, a do corpo
   * fechado e a linha de trilha; e o que separa retirar de recircular é o sentido, que é justamente o
   * argumento.
   */
  private async definirCirculacao(
    identificador: string,
    corpo: unknown,
    requisicao: FastifyRequest,
    emCirculacao: boolean,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const contrato = await this.contratos.definirCirculacao(tx, codigo, emCirculacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: contrato.codigo,
          acao: emCirculacao ? 'recirculacao' : 'retirada',
        },
        'circulação de cadastro alterada',
      );

      return contrato;
    });
  }
}
