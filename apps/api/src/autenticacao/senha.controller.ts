/**
 * `POST /v1/sessao/senha` — a troca de senha **na forma do produto**, e a única que existe.
 *
 * ---------------------------------------------------------------------------
 * A ENTREGA DESTA ROTA É A ORDEM, e não a recusa (T9 · fecha o D21)
 * ---------------------------------------------------------------------------
 *
 * Quatro conferências acontecem **antes** de qualquer escrita, nesta ordem:
 *
 *   1. **sessão válida** — da guarda de contexto, que já recusou com `401` quem chegou sem cookie
 *      reconhecível. Nada é reconferido aqui;
 *   2. **política de admissão** — pessoa ativa, conta não bloqueada, empresa não suspensa. É a
 *      barreira de `@sysloc/auth` (`admitirSessao`), consultada e não reescrita;
 *   3. **senha atual correta** — do arcabouço, dentro de {@link SenhaController.trocar};
 *   4. **força da senha nova** — do gancho `hooks.before` de `packages/auth/src/autenticacao.ts`,
 *      que alcança a CLASSE "definição de senha" e não um caminho HTTP.
 *
 * Só então a credencial é gravada, a marca de senha provisória cai e **as demais sessões são
 * encerradas**.
 *
 * **O que o `D21` mediu, e por que a ordem é o que importa.** Na rota nativa do arcabouço a
 * gravação da credencial e o apagamento das sessões acontecem **antes** de a barreira levantar:
 * `updateAccount` precede `deleteUserSessions` e `createSession`, e é no terceiro que a barreira
 * corre (medido em `better-auth@1.6.25`, `dist/api/routes/update-user.mjs`). Uma pessoa desativada,
 * ou de empresa suspensa, saía da requisição com a **senha trocada**, com **zero sessões** e com um
 * `401` que a RN-10 torna indistinguível de "a senha atual estava errada" — perda de acesso
 * irreversível com a resposta afirmando que nada aconteceu.
 *
 * Aqui a admissão é conferida **antes do repasse**, de modo que a recusa acontece com a credencial
 * intacta e as sessões preservadas. Um `401` sozinho não prova isso: o defeito **também** respondia
 * `401`. O que discrimina é `identidade.conta.senha_derivada` inalterada **e** a contagem de sessões
 * preservada, e é isso que o `CT-234` assere.
 *
 * ---------------------------------------------------------------------------
 * Por que a escrita é DELEGADA ao arcabouço, e não escrita aqui
 * ---------------------------------------------------------------------------
 *
 * A gravação da credencial é o endpoint `changePassword` do arcabouço, alcançado pelo
 * **manipulador** dele (ver a seção seguinte). As três razões, e nenhuma delas é economia:
 *
 *   * **a derivação é a do arcabouço** — a mesma que a entrada confere. Uma derivação escrita nesta
 *     borda seria um segundo formato, e a conta ficaria impossível de conferir;
 *   * **a política de força alcança este caminho por construção**. O gancho `hooks.before` corre
 *     para todo endpoint do arcabouço, venha ele do roteador HTTP ou de `auth.api.*` — e o
 *     discriminador dele é o CAMPO `newPassword`, não uma lista de caminhos. Reimplementar a
 *     política aqui exigiria publicar `avaliarForcaDeSenha` de `@sysloc/auth`, que o índice daquele
 *     pacote recusa por escrito **justamente** porque ela é aplicada por dentro;
 *   * **a conferência da senha atual é a do arcabouço**, e um segundo jeito de decidir "esta é a
 *     senha em uso?" seria um segundo jeito de errar.
 *
 * **A ordem interna entre (3) e (4) é a do arcabouço, e ela é a INVERSA da lista acima** — medido:
 * o gancho de política corre antes do manipulador, e é o manipulador que confere `currentPassword`.
 * A consequência observável é qual recusa chega primeiro quando as duas valem, e ela é inofensiva:
 * quem manda senha nova fraca **e** senha atual errada recebe `422` em vez de `422` sem `detalhes`.
 * O que a §3 do cartão exige — *"confira antes de escrever"* — vale para as quatro, porque **as
 * quatro precedem `updateAccount`**. Impor a ordem literal obrigaria esta borda a conferir a senha
 * atual por conta própria, que é a segunda definição do parágrafo acima.
 *
 * ---------------------------------------------------------------------------
 * Por que o repasse é pelo MANIPULADOR, e não por `auth.api.changePassword` (T9 / Gate 2 · P1)
 * ---------------------------------------------------------------------------
 *
 * `auth.api.*` é uma **porta lateral ao roteador**: ela entrega o manipulador do endpoint e deixa
 * para trás tudo o que vive no `onRequest` — inclusive o **limitador de taxa**. Medido em
 * `better-auth@1.6.25`: `onRequestRateLimit` é invocado num ponto único (`dist/api/index.mjs`,
 * dentro do `onRequest` que `createRouter` recebe), alcançado só por `auth.handler(request)`; o
 * registro `api` que `to-auth-endpoints.mjs` monta não tem referência alguma ao limitador. A
 * primeira versão desta rota gravava por `auth.api.changePassword` e, com isso, a conferência de
 * `senhaAtual` ficou **sem teto nenhum** — adivinhação ilimitada da senha em vigor a partir de uma
 * sessão válida, num caminho que, ao acertar, ainda encerra as demais sessões e expulsa o titular.
 *
 * O repasse pelo manipulador devolve a política inteira de `packages/auth` a este caminho, sem
 * escrever número novo em lugar nenhum: a regra `'/change-password'` de `customRules` volta a casar,
 * com {@link TETO_DE_CREDENCIAL_POR_JANELA} — o teto mais estreito da configuração, dimensionado
 * justamente por ser o caminho que confere credencial **e onde o contador por conta da RN-06 não
 * existe** (o bloqueio por conta cobre a ENTRADA, não este caminho).
 *
 * **Nada disso conflita com {@link CAMINHOS_NAO_PUBLICADOS}**, e a distinção é entre borda e
 * instância: aquela lista vive no encaminhador `@All('*')` de `autenticacao.controller.ts` e
 * responde `404` ao que chega de FORA sob `/v1/auth`. Uma chamada interna ao manipulador não passa
 * por controlador nenhum. O efeito líquido é o desejado: o balde de `'/change-password'` passa a
 * ser alimentado **só** por esta rota do produto.
 *
 * **O que chega ao cliente quando o teto estoura** é o `429` que o próprio limitador emite,
 * traduzido pelo filtro global no envelope canônico `REQUISICAO_RECUSADA` com o status de origem
 * preservado (a `DECISÃO FECHADA — T8 / Gate 2 (P1)` de `comum/filtro-excecao.ts`). Nenhum código
 * novo entra no enum, e o corpo de sucesso da rota não muda.
 *
 * **A ordem do `D21` é preservada, e é ela que decide onde o repasse entra**: `exigirAdmissao` corre
 * ANTES de montar o pedido, de modo que a pessoa não admitida continua recusada sem que requisição
 * alguma alcance o arcabouço — inclusive sem consumir o teto da janela.
 *
 * ---------------------------------------------------------------------------
 * As demais sessões caem — e a DESTA requisição sobrevive
 * ---------------------------------------------------------------------------
 *
 * O encerramento é `auth.api.revokeOtherSessions`, e **não** o campo `revokeOtherSessions` do corpo
 * de `changePassword`. Os dois não fazem a mesma coisa (medido no pacote publicado):
 *
 *   * o **campo** apaga TODAS as sessões da pessoa, cria uma nova e reemite o cookie — a sessão
 *     corrente é substituída, e o cliente precisa adotar a credencial nova;
 *   * o **endpoint** apaga apenas as que não são a desta requisição, e não toca em cookie nenhum.
 *
 * A segunda forma é a que cumpre o CA-10 da fatia anterior — *"a restrição cai COM O MESMO COOKIE,
 * sem novo login"* —, e é ela que o `CT-021` afirma por asserção direta (a troca não devolve
 * credencial de sessão nova). Trocar uma pela outra reabriria aquele caso.
 *
 * ---------------------------------------------------------------------------
 * O que esta rota exige: NADA — e a marca é explícita (ADR-0011)
 * ---------------------------------------------------------------------------
 *
 * `@NaoExigePermissao()`, pela mesma razão de `GET /v1/sessao`: ela é alcançável por **sessão
 * restrita** — é a rota que a pessoa com Senha provisória pendente precisa alcançar para deixar de
 * estar restrita —, e condicioná-la a uma chave do catálogo trancaria a saída da restrição atrás de
 * uma permissão de negócio. Ela **não** é pública: quem chega sem cookie recebe `401` da guarda.
 *
 * O que a torna alcançável pela sessão restrita não é esta marca, e sim
 * {@link ROTAS_DA_SESSAO_RESTRITA} (`sessao-restrita.ts`) — a marca responde pela autorização, a
 * lista responde pelo alcance. As duas são necessárias, e o `CT-238` afirma as duas.
 */

import { Body, Controller, HttpCode, HttpException, Inject, Post, Req } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type Autenticacao,
  admitirSessao,
  carregarPessoaDaSessao,
  limparMarcaDeSenhaProvisoria,
  RECUSA_DE_CAMPO_INVALIDO,
} from '@sysloc/auth';
import type { AcessoAIdentidade } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_ACESSO_A_IDENTIDADE, TOKEN_AUTENTICACAO } from '../configuracao/ambiente.js';
import { cabecalhosDe, sessaoDaRequisicao } from './contexto.guard.js';
import { NaoExigePermissao } from './exigencia.decorator.js';

/**
 * Caminho da troca de senha do produto, **relativo ao prefixo de versão**.
 *
 * Ele é o segmento inteiro (`sessao/senha`) e não apenas `senha` porque este controlador é o dono
 * do caminho completo: `SessaoController` publica `sessao` como recurso próprio, e aninhar um
 * `@Post('senha')` lá misturaria a leitura da sessão com a troca de credencial num controlador só —
 * duas responsabilidades com riscos distintos sob a mesma classe.
 *
 * Exportado para que o `CT-238` amarre {@link ROTAS_DA_SESSAO_RESTRITA} ao DONO do segmento, em vez
 * de a um literal escrito no caso.
 */
export const CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO = 'sessao/senha';

/**
 * Corpo fechado da troca (§4.1: `{ senhaAtual, senhaNova }`).
 *
 * **Não é atualização parcial**: os dois campos são obrigatórios, e o objeto é estrito — chave
 * desconhecida recusa a requisição em vez de ser ignorada em silêncio. Isso importa mais aqui do
 * que em qualquer outro corpo desta superfície: o vocabulário do arcabouço tem um campo
 * `revokeOtherSessions`, e um corpo tolerante deixaria o cliente pedir a rotação de sessão que esta
 * rota decidiu não fazer (ver o cabeçalho).
 *
 * Nenhum piso de comprimento é declarado aqui, e é deliberado: quem responde por "que senha é
 * aceitável" é a política de força (RN-05), num ponto único, e um `min` nesta borda seria uma
 * segunda regra de senha — mais frouxa, sem motivo nomeado, e livre para divergir daquela. O
 * `.min(1)` que existe é de **presença**, e nada além disso.
 */
const ESQUEMA_DA_TROCA = z.strictObject({
  senhaAtual: z.string().min(1),
  senhaNova: z.string().min(1),
});

/** Nome de campo usado quando a recusa da borda não tem um caminho a nomear. */
const CAMPO_PADRAO_DA_TROCA = 'senha';

/**
 * O caminho da troca **no arcabouço**, relativo ao prefixo em que ele está montado.
 *
 * É o mesmo literal que `customRules` usa como chave da regra do limitador em
 * `packages/auth/src/autenticacao.ts`, e é por essa igualdade que o repasse abaixo cai sob o teto de
 * credencial. Ele não é importado de `autenticacao.controller.ts`: lá o literal homônimo nomeia o
 * que a BORDA deixa de publicar, e amarrar os dois faria uma decisão sobre a superfície HTTP mudar,
 * de graça, o alvo de uma chamada interna.
 */
const CAMINHO_DA_TROCA_NO_ARCABOUCO = '/change-password';

/** Menor status que caracteriza recusa. Abaixo dele a resposta do arcabouço é aceitação. */
const PRIMEIRO_STATUS_DE_RECUSA = 400;

/** O que a troca devolve (§4.1). Um objeto, e não corpo vazio, porque o contrato o declara. */
export interface SenhaTrocada {
  readonly trocada: true;
}

const ESQUEMA_DA_RESPOSTA = {
  type: 'object',
  required: ['trocada'],
  properties: { trocada: { type: 'boolean', enum: [true] } },
};

/** Envelope de erro da ADR-0012, para as respostas de recusa do documento publicado. */

@ApiTags('sessao')
@Controller(CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO)
export class SenhaController {
  constructor(
    @Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao,
    // O acesso restrito a `identidade` entra para as duas capacidades que `@sysloc/auth` publica e
    // que exigem o executor por assinatura — a leitura do estado de admissão e a queda da marca de
    // senha provisória. Nenhuma consulta é escrita aqui: o que este controlador conhece é a função,
    // não o schema (§11.2 da tech spec).
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
  ) {}

  @Post()
  // `200`, e não o `201` que o arcabouço HTTP dá a todo `POST`: nada é criado — uma credencial que
  // já existia passou a ter outro valor. O contrato da §4.1 declara `200`.
  @HttpCode(200)
  @NaoExigePermissao()
  @ApiOperation({
    summary: 'Troca a senha da própria sessão',
    description:
      'A troca é a única forma de encerrar a exigência da Senha provisória: concluída, a marca ' +
      'cai e a **mesma** sessão passa a alcançar tudo o que as permissões da pessoa comportam, ' +
      'sem novo login. As demais sessões da pessoa são encerradas no mesmo ato; a desta ' +
      'requisição permanece. **Toda recusa acontece antes de qualquer escrita** — pessoa ' +
      'desativada, conta bloqueada, empresa suspensa, senha atual incorreta e senha nova fraca ' +
      'deixam a credencial intacta e as sessões preservadas.',
  })
  @ApiOkResponse({ description: 'A senha foi trocada.', schema: ESQUEMA_DA_RESPOSTA })
  @ApiUnauthorizedResponse({
    description:
      'Não há sessão válida, ou a política de admissão não admite mais esta pessoa. Corpo no ' +
      'envelope de erro da ADR-0012.',
    schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]),
  })
  @ApiUnprocessableEntityResponse({
    description:
      'A senha atual está incorreta, ou a senha nova não passa na política de força — neste caso ' +
      'com `campo: "senha"` e `detalhes.motivos`.',
    schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]),
  })
  // DECISÃO FECHADA — T9 / Gate 2 · 2026-08-05
  // (Ele PROTEGE, ao contrário do `DÉBITO COM GATILHO` do D38 mais abaixo neste mesmo arquivo, que
  //  AGENDA. Alcance: o bloco de comentário abaixo e o decorador `@ApiTooManyRequestsResponse` que
  //  ele explica, até o fecho dele.)
  // O QUÊ: o `429` desta rota declara STATUS e CORPO, e CABEÇALHO NENHUM.
  // POR QUÊ: duas rodadas de gate fecharam sobre afirmação não medida NESTE MESMO bloco — o Gate 2
  //          da rodada 1 rejeitou "é alcançável hoje" e "a única perna alcançável", que a task
  //          tornara falsas; o Gate 1 da rodada 2 achou o custo atribuído a um mecanismo de janela
  //          inexistente, afirmado como "medido"; e o Gate 2 da rodada 2 rejeitou o `x-retry-after`
  //          anunciado aqui e nunca emitido ao cliente. O texto abaixo é o que sobrou depois de
  //          cada afirmação ser conferida no caminho real, e a leitura previsível dele é "faltou
  //          declarar o cabeçalho do limitador".
  // REVERTER EXIGE: provar que a borda copia cabeçalhos no caminho de RECUSA, o que hoje exigiria
  //                 mudar `comoRecusa()` ou o filtro global.
  //
  // A recusa do limitador de taxa é resposta OBSERVÁVEL desta rota desde que a gravação passou a
  // ser repassada ao manipulador (ver o cabeçalho), e por isso ela é declarada aqui. Não é
  // superfície nova: o código é o `REQUISICAO_RECUSADA` que o enum já publica e o corpo é o mesmo
  // envelope da ADR-0012 — o que se acrescenta é a VERDADE sobre o que o cliente pode receber. Um
  // documento que omitisse este status descreveria uma rota que não existe.
  //
  // **E CABEÇALHO NENHUM é declarado** — o mesmo critério com o sinal trocado, e a razão é medida no
  // caminho: em recusa, a borda entrega ao cliente apenas o par (status, corpo). {@link comoRecusa}
  // reduz a resposta do manipulador a `{ statusCode, body }`, o tradutor levanta a exceção com o
  // corpo, e o filtro global responde com `send(corpo)` sem escrever cabeçalho algum — a única cópia
  // de cabeçalhos da borda é `responderCom` de `autenticacao.controller.ts`, e ela só corre no
  // caminho de ACEITAÇÃO. O `x-retry-after` que o limitador escreve existe na INSTÂNCIA do arcabouço
  // (é o que `packages/auth/test/bloqueio.spec.ts` observa) e morre nessa travessia; anunciá-lo aqui
  // descreveria uma resposta que o cliente não recebe, e este texto vira o documento OpenAPI, o
  // `@sysloc/contracts` e o handoff do frontend. A ADR-0012 fixa o envelope no CORPO e não fala de
  // cabeçalhos — nada se perde.
  @ApiTooManyRequestsResponse({
    description:
      'A janela de tentativas do caminho de credencial foi esgotada. Corpo no envelope de erro da ' +
      'ADR-0012, com `REQUISICAO_RECUSADA`.',
    schema: esquemaDoErro([CodigoErro.REQUISICAO_RECUSADA]),
  })
  async trocar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<SenhaTrocada> {
    // Passo 1 — a sessão. Ela vem da GUARDA, nunca do corpo nem de um cabeçalho lido aqui.
    const sessao = sessaoDaRequisicao(requisicao);
    const pedido = validar(ESQUEMA_DA_TROCA, corpo, CAMPO_PADRAO_DA_TROCA);

    // Passo 2 — a política de admissão, ANTES do repasse. É o passo que fecha o D21.
    await this.exigirAdmissao(sessao.usuarioId);

    const cabecalhos = cabecalhosDe(requisicao);

    // Passos 3 e 4, e só então a escrita — pelo MANIPULADOR, que é onde o limitador de taxa mora
    // (ver o cabeçalho). As recusas voltam como RESPOSTA, e não como exceção: o roteador converte o
    // `APIError` em resposta antes de devolver. As três formas possíveis — a nossa (senha fraca), a
    // do arcabouço (senha atual incorreta) e a do limitador (`429`) — atravessam o mesmo tradutor.
    const devolvida = await this.autenticacao.handler(this.pedidoDaTroca(cabecalhos, pedido));

    if (devolvida.status >= PRIMEIRO_STATUS_DE_RECUSA) {
      throw traduzirRecusaDoArcabouco(await comoRecusa(devolvida));
    }

    // A marca cai DEPOIS de a troca ser aceita, e só depois: baixá-la antes liberaria a sessão de
    // quem teve a senha nova recusada, que é escalação de privilégio silenciosa. É a mesma ordem, e
    // a mesma razão, que o encaminhador de identidade praticava enquanto a rota nativa existia.
    await limparMarcaDeSenhaProvisoria(this.acesso.identidade, sessao.usuarioId);

    // E as demais sessões caem por último: a credencial nova já vale, então nenhuma janela sobra em
    // que uma sessão antiga siga viva com a senha velha ainda aceita.
    await this.autenticacao.api.revokeOtherSessions({ headers: cabecalhos });

    return { trocada: true };
  }

  /**
   * Monta o pedido que atravessa o manipulador do arcabouço.
   *
   * ---------------------------------------------------------------------------
   * O endereço vem da CONFIGURAÇÃO da instância, e os cabeçalhos são os do cliente
   * ---------------------------------------------------------------------------
   *
   * `baseURL` e `basePath` saem de `options`, que é o mesmo par que o roteador usa para casar as
   * próprias rotas. Uma segunda composição escrita aqui poderia divergir, e o efeito seria
   * silencioso: o pedido cairia fora do prefixo, o arcabouço responderia "não encontrado" e a troca
   * deixaria de funcionar sem que se soubesse por quê.
   *
   * Os cabeçalhos do cliente são **copiados**, e não sintetizados: é deles que saem o cookie de
   * sessão (sem o qual `changePassword` não resolve a pessoa) e o `x-forwarded-for` que o limitador
   * usa como eixo de origem — o eixo que o `D27` de `packages/auth/src/autenticacao.ts` registra
   * como ausente hoje e que a F7 instala. A cópia é sobre um `Headers` NOVO porque o original segue
   * em uso no encerramento das demais sessões, mais abaixo.
   *
   * Três ajustes, e cada um tem razão própria:
   *
   *   * **`content-length` sai** — o corpo que vai daqui é outro (o vocabulário do arcabouço), e um
   *     comprimento herdado do corpo do produto descreveria coisa nenhuma;
   *   * **`content-type` é fixado** — o roteador só aceita `application/json`
   *     (`allowedMediaTypes`), e o cliente não decide o formato de um pedido que não é dele;
   *   * **`origin` é o da PRÓPRIA instância**. Este é o ponto que exige leitura: fora de teste, o
   *     `originCheckMiddleware` do roteador recusa com `403 INVALID_ORIGIN` toda requisição que
   *     carregue cookie sem `Origin`/`Referer` confiável (medido em
   *     `dist/api/middlewares/origin-check.mjs`). Repassar o `Origin` do navegador submeteria
   *     `POST /v1/sessao/senha` a uma conferência que **nenhuma outra rota do produto tem** — e a um
   *     `403` que o contrato da §4.1 não declara —, enquanto encaminhar-lhe nada produziria esse
   *     mesmo `403` em produção **sem que a suíte o visse**, porque em `NODE_ENV=test` o arcabouço
   *     desliga a conferência por padrão (`skipOriginCheck`). A origem declarada é a verdadeira:
   *     quem emite este pedido é este servidor. A postura de CSRF da rota fica exatamente a que era
   *     antes desta correção — a do resto da superfície do produto —, e o repasse acrescenta o
   *     limitador sem acrescentar mais nada.
   */
  private pedidoDaTroca(
    cabecalhosDoCliente: Headers,
    pedido: { readonly senhaAtual: string; readonly senhaNova: string },
  ): Request {
    const { baseURL, basePath } = this.autenticacao.options;
    const cabecalhos = new Headers(cabecalhosDoCliente);

    cabecalhos.delete('content-length');
    cabecalhos.set('content-type', 'application/json');
    cabecalhos.set('origin', new URL(baseURL).origin);

    return new Request(new URL(`${basePath ?? ''}${CAMINHO_DA_TROCA_NO_ARCABOUCO}`, baseURL), {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({
        currentPassword: pedido.senhaAtual,
        newPassword: pedido.senhaNova,
      }),
    });
  }

  /**
   * Recusa a troca quando a política de admissão não admite mais esta pessoa (RN-10).
   *
   * **A leitura é feita AGORA, e não herdada da sessão que a guarda montou.** `SessaoDoProduto` não
   * carrega o estado de admissão — `EstadoDeAdmissao` é fechado no que a barreira decide, e os
   * campos de exibição da sessão são outra coisa —, mas o motivo de reler não é só esse: a decisão
   * precisa ser sobre o estado do **instante da escrita**. Decidir sobre um retrato tomado antes
   * reabriria, em menor escala, exatamente a janela que esta rota existe para fechar.
   *
   * A recusa é a **mesma** que a guarda emite para sessão que não resolve mais — mesmo código,
   * mesma mensagem, mesmo conjunto de campos. Não é economia de vocabulário: uma sessão cuja pessoa
   * a barreira não admite mais é, pela definição da própria barreira, uma sessão que não deveria
   * existir; e distinguir "sua empresa foi suspensa" de "sua sessão venceu" diria ao cliente qual
   * das duas coisas aconteceu, que é a distinção que a RN-10 recusa em toda a superfície de
   * identidade.
   */
  // DECISÃO FECHADA — T9 / Gate 2 · 2026-08-05
  // O QUÊ: esta conferência FICA, mesmo que hoje nenhum caminho do produto a alcance.
  // POR QUÊ: a suspensão pela rota do Master e a desativação pela rota do Admin encerram as sessões
  //          da pessoa no mesmo commit, de modo que o estado que ela guarda — sessão viva sob pessoa
  //          não admitida — só é alcançável se um daqueles caminhos falhar ou se um caminho novo
  //          esquecer de encerrar. É defesa em profundidade sobre a janela que o `D21` mediu, e a
  //          leitura previsível dela é "código morto, remova".
  // REVERTER EXIGE: provar que NENHUM caminho do sistema deixa uma sessão viva sob pessoa que a
  //                 barreira de admissão não admite — hoje e em toda fatia que crie caminho novo de
  //                 desativação, suspensão ou expiração. Enumerar os caminhos de hoje não satisfaz.
  private async exigirAdmissao(usuarioId: string): Promise<void> {
    const pessoa = await carregarPessoaDaSessao(this.acesso.identidade, usuarioId);

    // Pessoa que não é mais resolvível cai no MESMO ramo de quem não é admitida: é a postura
    // fail-closed da barreira — na dúvida, nada acontece.
    if (pessoa === undefined || !admitirSessao(pessoa, new Date()).admitida) {
      throw new ErroDeAplicacao(
        CodigoErro.NAO_AUTENTICADO,
        MENSAGEM_POR_CODIGO[CodigoErro.NAO_AUTENTICADO],
      );
    }
  }
}

/**
 * A ponta do `APIError` do arcabouço que esta borda lê.
 *
 * Declarada por estrutura, e não importada: a classe vive em `better-call`, que é dependência
 * **transitiva** — declará-la no manifesto só para nomear um tipo acrescentaria ao pacote uma
 * dependência que o código não usa, que é o mesmo critério de `ContextoDeEndpoint` em
 * `packages/auth/src/autenticacao.ts`.
 */
interface RecusaDoArcabouco {
  readonly statusCode: number;
  readonly body: Record<string, unknown> | undefined;
}

/**
 * Lê a recusa que o manipulador devolveu na forma que {@link traduzirRecusaDoArcabouco} interpreta.
 *
 * O corpo é lido como JSON porque é assim que o arcabouço recusa; o que não for JSON de objeto sai
 * daqui como ausente, e a tradução segue pela regra geral, preservando o status de quem recusou. É
 * o mesmo cuidado de `recusarComEnvelopeDoProduto` no encaminhador — e o motivo de a leitura não
 * levantar: um corpo inesperado não pode transformar uma recusa de cliente em falha do serviço.
 */
async function comoRecusa(devolvida: Response): Promise<RecusaDoArcabouco> {
  const texto = await devolvida.text();
  let interpretado: unknown;

  try {
    interpretado = JSON.parse(texto);
  } catch {
    interpretado = undefined;
  }

  return {
    statusCode: devolvida.status,
    body: ehDetalhes(interpretado) ? interpretado : undefined,
  };
}

/**
 * Traduz a recusa do arcabouço na exceção que o filtro global sabe responder.
 *
 * É a **mesma regra**, na mesma ordem, que `autenticacao.controller.ts` aplica à recusa que volta do
 * encaminhador; a diferença é apenas de forma — lá ela é lida do texto da resposta, aqui ela chega
 * já normalizada por {@link comoRecusa}. Os dois ramos:
 *
 *   1. **recusa NOSSA** — reconhecida pelo `code` que `@sysloc/auth` publica
 *      (`RECUSA_DE_CAMPO_INVALIDO`), e não por um segundo literal escrito à mão. Sem esta leitura,
 *      o `campo` e os `detalhes.motivos` que a §6.1 manda entregar se perderiam na travessia, e a
 *      recusa por senha fraca chegaria ao cliente sem dizer QUAL regra foi violada;
 *   2. **recusa do arcabouço** — a conferência da senha atual, que recusa com `BAD_REQUEST`, e o
 *      **limitador de taxa**, que recusa com `429`. As duas viram `HttpException` com o status de
 *      origem, e quem classifica é o **filtro global**, pela tabela de código por status. Repetir a
 *      tabela aqui seria uma segunda classificação livre para divergir dela, e é justamente por
 *      isso que a primeira chega ao cliente como o mesmo `422 CAMPO_INVALIDO` que a rota nativa
 *      produzia antes de deixar de ser publicada, e a segunda como o `429 REQUISICAO_RECUSADA` que
 *      a `DECISÃO FECHADA — T8 / Gate 2 (P1)` do filtro fixa por faixa — nenhum código novo, nenhum
 *      status reclassificado.
 *
 * O corpo do arcabouço acompanha a exceção como **diagnóstico**, e nunca como resposta: o filtro
 * monta os quatro campos da ADR-0012 e entrega o resto ao registro estruturado, onde a redação de
 * segredo o alcança.
 *
 * O que não é recusa do arcabouço — uma falha de banco, por exemplo — sai daqui **como veio**, para
 * que o filtro a trate como falha do serviço em vez de disfarçá-la de recusa de cliente.
 */
function traduzirRecusaDoArcabouco(falha: unknown): unknown {
  const recusa = comoRecusaDoArcabouco(falha);

  if (recusa === undefined) {
    return falha;
  }

  const corpo = recusa.body;

  if (corpo?.code === RECUSA_DE_CAMPO_INVALIDO.code && typeof corpo.campo === 'string') {
    return new ErroDeAplicacao(
      CodigoErro.CAMPO_INVALIDO,
      MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
      {
        campo: corpo.campo,
        // Ausente é ausente, e não presente valendo indefinido — o mesmo cuidado do encaminhador.
        ...(ehDetalhes(corpo.detalhes) ? { detalhes: corpo.detalhes } : {}),
      },
    );
  }

  return new HttpException({ ...corpo }, recusa.statusCode);
}

/** A falha é uma recusa do arcabouço? Reconhecida por forma, não por classe. */
function comoRecusaDoArcabouco(falha: unknown): RecusaDoArcabouco | undefined {
  if (typeof falha !== 'object' || falha === null) {
    return undefined;
  }

  const candidata = falha as { statusCode?: unknown; body?: unknown };

  if (typeof candidata.statusCode !== 'number') {
    return undefined;
  }

  return {
    statusCode: candidata.statusCode,
    body: ehDetalhes(candidata.body) ? candidata.body : undefined,
  };
}

/** `detalhes` é objeto simples, ou não é `detalhes`. */
function ehDetalhes(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Valida a entrada e traduz a recusa no envelope da ADR-0012.
 *
 * **Terceira ocorrência desta função na borda** — as outras duas são `master/empresa.controller.ts`
 * e `usuarios/usuario.controller.ts`, e aquela última registra por escrito que *"quando o terceiro
 * controlador chegar, a extração passa a valer a pena"*. Ela chegou, e a extração **não** foi feita
 * aqui: ver o débito abaixo.
 */
// DÉBITO COM GATILHO — D38 · F1/T9 · registrado 2026-08-05
// (Fatia `autorizacao-e-ciclo-de-acesso`. Ele AGENDA, não protege: editar esta função é normal — o
//  que não se pode é editá-la sem saber que ela tem duas irmãs idênticas.)
// O QUÊ: `validar()` existe em TRÊS cópias literais na borda — aqui,
//        `apps/api/src/master/empresa.controller.ts` e `apps/api/src/usuarios/usuario.controller.ts`
//        —, e o gatilho declarado pela segunda ("quando o terceiro controlador chegar") já disparou.
// QUANDO FECHA: no próximo controlador de borda a precisar dela — a quarta cópia —, ou na primeira
//        task cujo escopo já inclua os três arquivos. Fechar é extrair um módulo de borda comum e
//        fazer os três importarem dele.
// POR QUE NÃO AGORA: extrair sem editar os dois controladores existentes deixaria TRÊS definições
//        em vez de duas, e editá-los é mudança fora do escopo desta task — o §4.5 do Protocolo
//        Antirregressão é literal sobre "aproveitar que estou aqui", e cada linha de diff que não
//        serve à causa-raiz é superfície de regressão de graça.
// ÍNDICE: docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/_run/run-report.md §2, D38
function validar<T>(esquema: z.ZodType<T>, valor: unknown, campoPadrao: string): T {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    return resultado.data;
  }

  const caminho = resultado.error.issues[0]?.path ?? [];

  throw new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    { campo: caminho.length > 0 ? caminho.join('.') : campoPadrao, causa: resultado.error },
  );
}
