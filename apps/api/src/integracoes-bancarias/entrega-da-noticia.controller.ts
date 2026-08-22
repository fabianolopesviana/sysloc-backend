/**
 * As **duas rotas da entrega da notícia do provedor** —
 * `POST /v1/integracoes-bancarias/entrega-da-noticia/ativacao`, para pedir ao banco que passe a
 * avisar este produto, e `GET /v1/integracoes-bancarias/entrega-da-noticia`, para ver o que a última
 * tentativa apurou.
 *
 * ---------------------------------------------------------------------------
 * A ativação responde `200`, e o número é conteúdo
 * ---------------------------------------------------------------------------
 *
 * `200`, e não o `201` que o arcabouço dá a todo `@Post`: o ato é **idempotente** e **não cria
 * recurso endereçável**. Repetir a ativação não produz um segundo objeto — produz o mesmo estado da
 * empresa, reescrito. Um `201` prometeria ao cliente um recurso novo com endereço próprio, que não
 * existe: o estado é singular por empresa, e a chave dele é a própria sessão. É o mesmo precedente, e
 * a mesma razão, do `@HttpCode(200)` já aplicado à verificação de identidade nesta superfície.
 *
 * ---------------------------------------------------------------------------
 * A recusa do provedor NÃO vira exceção — é a decisão central desta rota
 * ---------------------------------------------------------------------------
 *
 * O provedor recusar o cadastro, estar fora do ar ou não concluir no prazo **não são falhas do
 * serviço**: são respostas à pergunta que o Admin fez, e chegam como **estado com motivo**, sempre
 * com `200`. Convertê-las em `5xx` faria o Admin ler *"o sistema falhou"* onde o fato é *"a vaga está
 * ocupada"* — dois desfechos operacionais opostos (RN-06). É o mesmo desenho da verificação de
 * identidade, e a porta o garante por construção: as duas operações dela **resolvem em todos os
 * desfechos e nunca rejeitam**.
 *
 * ⚠️ **Nada altera cadastro de terceiro** (RN-07). O produto cadastra **o seu** e lê; não remove, não
 * substitui, não desativa. Vaga ocupada por sistema de terceiro é recusa informada, nunca disputa.
 *
 * ⚠️ **Não existe desabilitar** (RN-14): a operação não existe no provedor — não há escopo de
 * exclusão, e a concessão dele é recusada nomeando o escopo inválido —, e o produto **não modela o
 * que não pode cumprir**. Uma terceira rota aqui publicaria uma promessa que nenhuma chamada cumpre.
 *
 * ---------------------------------------------------------------------------
 * A CONSULTA não fala com o provedor, e a ausência de ida é a decisão
 * ---------------------------------------------------------------------------
 *
 * O `GET` lê a linha persistida. A consulta ao vivo a cada leitura foi **podada no discovery**, e a
 * razão sustenta o módulo inteiro: *a recusa precisa sobreviver à requisição*. Sem a cópia durável, o
 * Admin que fechasse a tela perderia o motivo pelo qual a habilitação falhou — e cada abertura de
 * tela custaria um aperto de mão mútuo e uma concessão de credencial.
 *
 * Empresa que **nunca tentou** recebe `200` com `habilitada: false` e `verificadaEm: null`, e
 * **nunca `404`**: a ausência de tentativa é estado declarado, não recurso inexistente. É a
 * assimetria deliberada em relação ao certificado e à identidade, em que a ausência **é** a ausência
 * do recurso pedido.
 *
 * ---------------------------------------------------------------------------
 * A exigência é a CONJUNÇÃO INTEIRA nos DOIS manipuladores
 * ---------------------------------------------------------------------------
 *
 * As duas rotas declaram `@ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)` — as
 * **mesmas** chaves do certificado e da identidade, **importadas de lá em vez de redigitadas**: duas
 * declarações da mesma exigência são duas regras livres para divergir. **Nenhuma chave nasce aqui**,
 * e `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado**: as duas já existem, e o catálogo
 * é fechado — abri-lo exigiria supersedê-la ADR-0011.
 *
 * A **consulta** declara a conjunção junto com a ativação, e a simetria é decisão, não descuido: o
 * que ela devolve é o **motivo íntegro** que o provedor emitiu sobre a conta daquela empresa —
 * diagnóstico de terceiro sobre a configuração bancária dela —, e não um atributo de leitura comum.
 * Quem administra a integração é quem lê o porquê de ela não ter subido.
 *
 * > **Quem governa a exigência destas duas rotas é a ADR-0011 com a ADR-0018.** A primeira manda toda
 * > rota declarar as duas dimensões, e é por isso que `semDeclaracao` permanece vazio; a segunda fixa
 * > que a conjunção é conferida por **conteúdo** e que a recusa nomeia a **primeira** chave ausente na
 * > ordem declarada — a área vem antes da ação para que quem já tem a área ouça o nome do que lhe
 * > falta. **A ADR-0021 não é invocada aqui, nem como fundamento nem em oração normativa**: o
 * > marcador `DECISÃO FECHADA — T12` de {@link ./certificado.controller.js} fixa que as rotas desta
 * > superfície se apoiam em 0011+0018, o achado já voltou por caminho novo uma vez, e o
 * > `REVERTER EXIGE` dele é uma **emenda da própria 0021** — escalada ao usuário, nunca decisão de
 * > executor ou de gate.
 *
 * ⚠️ **Nunca declare só a ação.** `getAllAndOverride` é **override**, não união: `@ExigeChave(ACAO…)`
 * num método **apaga** a área da classe, em silêncio, e o manipulador passa a exigir **menos** que a
 * classe dele. Foi defeito explorável nas duas rotas de circulação de conjunto. Aqui a classe **não
 * declara nada**, e os dois métodos declaram a conjunção inteira — o que torna a forma imune àquele
 * modo de falha por construção, e não por lembrança.
 *
 * ---------------------------------------------------------------------------
 * A unidade de trabalho abre AQUI, e o serviço a recebe por parâmetro
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre (decisão D1), e a ativação entrega ao serviço uma **abertura** em vez de
 * uma transação: o ciclo dela precisa de **duas** unidades, com o ato externo no meio, e é ele que
 * decide quantas. Todas passam por {@link sobContextoDaSessao}, e nenhuma chama
 * `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a sessão que a
 * guarda publicou (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * O corpo da ativação é VAZIO e FECHADO, e o esquema vem do PACOTE DE CONTRATOS
 * ---------------------------------------------------------------------------
 *
 * `esquemaDaAtivacaoDaEntrega`, de `@sysloc/contracts`, e **não** o `ESQUEMA_DO_CORPO_VAZIO` da
 * borda. A forma é a mesma, e a razão de não reusar aquele está escrita no docblock deste: aquele é a
 * forma **anônima** que a borda aplica a ato sem elemento de contrato próprio; este é elemento
 * **nomeado** da superfície publicada, e é dele que o documento OpenAPI da rota deriva (ADR-0016). O
 * pacote de contratos é a fonte única, e ele é folha — reusar a constante da borda faria a fonte do
 * contrato depender da aplicação, que é a aresta que a topologia do monorepo não admite.
 *
 * Ele **não é dispensável por ser vazio**: sem esquema declarado a rota não teria com o que recusar
 * `{ empresaId: … }`, e a chave passaria em silêncio — a ausência de campos é o que se quer, e o
 * `strictObject` é o que converte a tentativa de acrescentar um em recusa **nomeando a chave**.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo de resposta é escrita à mão aqui: `esquemaPublicado` traduz o **mesmo**
 * objeto que confere a entrada.
 *
 * ---------------------------------------------------------------------------
 * O LOG não carrega nada do motivo
 * ---------------------------------------------------------------------------
 *
 * A linha de trilha da ativação nomeia a empresa, a entidade, se a entrega ficou habilitada e quanto
 * o ato demorou — é o par que permite ao operador distinguir *"o provedor recusou"* de *"o provedor
 * está lento"*. O **motivo não entra**: ele é texto do terceiro para a tela do Admin, já persistido
 * na linha de estado, e repeti-lo no journal encheria a trilha de prosa sem fato novo — além de levar
 * para lá um portador aberto que veio de fora. **A leitura não registra linha alguma**: trilha de
 * leitura é ruído por requisição, sem fato novo a registrar (o mesmo critério de `mora.controller.ts`).
 */

import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type EstadoDaEntrega,
  esquemaDaAtivacaoDaEntrega,
  esquemaDoEstadoDaEntrega,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import {
  ACAO_DE_CONFIGURACAO,
  AREA_DAS_INTEGRACOES_BANCARIAS,
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
} from './certificado.controller.js';
import { EntregaDaNoticiaService } from './entrega-da-noticia.service.js';

/**
 * O segmento do recurso — **singular**, porque a entrega vigente é uma só por empresa.
 *
 * Exportado porque a suíte compõe o endereço a partir daqui, em vez de reescrever a cadeia: caminho
 * escrito duas vezes é livre para divergir, e a divergência apareceria como `404` num caso que
 * deveria medir outra coisa.
 */
export const SEGMENTO_DA_ENTREGA_DA_NOTICIA = 'entrega-da-noticia';

/**
 * O segmento do **ato**, pendurado no do recurso: `entrega-da-noticia/ativacao`.
 *
 * Ele é sufixo do recurso singular, e não caminho irmão, porque o ato incide sobre **aquela**
 * entrega — a da empresa da sessão. É a mesma forma das transições do produto (`:codigo/ativacao`,
 * `:codigo/cancelamento`) e da verificação de identidade desta mesma superfície, com a diferença de
 * que aqui a chave do recurso é a própria sessão e por isso não há `:id` no meio.
 */
export const SEGMENTO_DA_ATIVACAO = 'ativacao';

/** A entidade nomeada na linha de trilha deste ato (§13.1). */
const ENTIDADE_DA_TRILHA = 'entrega_da_noticia';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

@ApiTags('integracoes-bancarias')
@Controller(CAMINHO_DAS_INTEGRACOES_BANCARIAS)
export class EntregaDaNoticiaController {
  constructor(
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
    @Inject(EntregaDaNoticiaService) private readonly entregas: EntregaDaNoticiaService,
  ) {}

  @Post(`${SEGMENTO_DA_ENTREGA_DA_NOTICIA}/${SEGMENTO_DA_ATIVACAO}`)
  @ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)
  // `200`, e não o `201` do arcabouço: o ato é idempotente e não cria recurso endereçável — ver o
  // cabeçalho. Mesmo precedente da verificação de identidade, três rotas acima nesta superfície.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ativa a entrega da notícia do provedor para a empresa',
    description:
      'Cadastra, junto ao provedor, o canal por onde ele avisa este produto do que acontece com os ' +
      'títulos da empresa **da sessão**, e em seguida **consulta** para confirmar que o cadastro ' +
      'está de pé. A entrega só fica habilitada com os **dois** positivos, e é a consulta que ' +
      'decide: cadastro recusado porque a vaga já está ocupada, com consulta positiva, é ' +
      '**habilitada**. A recusa do provedor **não é falha**: ela sai com `200` e ' +
      '`habilitada: false`, com o `motivo` que ele emitiu preservado íntegro — código, mensagem e ' +
      'os campos que variam por recusa. Provedor fora do ar ou que não conclua no prazo degrada do ' +
      'mesmo jeito, e ali o **estado anterior permanece**: nada é gravado quando não houve resposta ' +
      'a registrar. O ato é **idempotente** — repetir substitui o desfecho anterior, sem acumular ' +
      'histórico. A empresa sem certificado vigente, com a validade já encerrada, ou sem identidade ' +
      'registrada é recusada **antes de qualquer chamada externa**, e a recusa diz qual das três ' +
      'configurações falta. **Nada do cadastro de terceiro é alterado**, e **não existe ' +
      'desabilitar**: a operação não existe no provedor. O corpo é **vazio e fechado**.',
  })
  @ApiOkResponse({
    description: 'O estado resultante da tentativa — inclusive quando o provedor recusou.',
    schema: esquemaPublicado(esquemaDoEstadoDaEntrega, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ativar(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<EstadoDaEntrega> {
    validar(esquemaDaAtivacaoDaEntrega, corpo ?? {}, CAMPO_DO_CORPO);

    // A sessão é lida numa unidade própria e curta, **antes** do ciclo: o serviço precisa de quem
    // tentou para gravar a autoria, e o ciclo dele abre as unidades que precisar pela abertura que
    // recebe. Ler a sessão aqui é o que mantém a origem do contexto num lugar só.
    const { empresaId, usuarioId } = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (_tx, sessao) => ({ empresaId: sessao.empresaId, usuarioId: sessao.usuarioId }),
    );

    // ⚠️ O relógio é o **monotônico** (`performance.now`), e a escolha não é para escapar de asserção
    // nenhuma: `Date.now()` é o instrumento errado para medir duração, porque um ajuste de relógio do
    // sistema durante a espera produziria uma duração inflada — ou negativa. Nada aqui é **data**: o
    // carimbo da tentativa nasce do BANCO, dentro da instrução que grava (ADR-0026).
    const comecouEm = performance.now();
    const estado = await this.entregas.ativar(
      async (trabalho) => await sobContextoDaSessao(this.banco, requisicao, trabalho),
      usuarioId,
    );
    const duracaoMs = Math.round(performance.now() - comecouEm);

    // Os campos são os que a §13.1 nomeia para este evento. **O motivo não entra** — ver o cabeçalho.
    this.logger.info(
      { empresaId, entidade: ENTIDADE_DA_TRILHA, habilitada: estado.habilitada, duracaoMs },
      'entrega da notícia do provedor reconferida',
    );

    return estado;
  }

  @Get(SEGMENTO_DA_ENTREGA_DA_NOTICIA)
  @ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)
  @ApiOperation({
    summary: 'Consulta o estado da entrega da notícia da empresa',
    description:
      'Devolve o que a **última tentativa** apurou para a empresa da sessão: se a entrega está ' +
      'habilitada, quando ela foi verificada, e — quando não está — o `motivo` que o provedor ' +
      'emitiu, preservado íntegro. **Esta rota não fala com o provedor**: ela lê o estado ' +
      'persistido, e é por isso que a recusa sobrevive à requisição em que aconteceu. A empresa que ' +
      '**nunca tentou** recebe `200` com `habilitada: false`, `verificadaEm: null` e `motivo: ' +
      'null` — e **nunca `404`**: a ausência de tentativa é estado declarado, não recurso ' +
      'inexistente.',
  })
  @ApiOkResponse({
    description: 'O estado persistido da entrega da notícia.',
    schema: esquemaPublicado(esquemaDoEstadoDaEntrega, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  async consultar(@Req() requisicao: FastifyRequest): Promise<EstadoDaEntrega> {
    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.entregas.consultar(tx),
    );
  }
}
