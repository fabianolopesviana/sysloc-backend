/**
 * A superfície HTTP da identidade — encaminha `/v1/auth/*` ao manipulador do arcabouço.
 *
 * ---------------------------------------------------------------------------
 * Por que um encaminhador, e não uma rota por ação
 * ---------------------------------------------------------------------------
 *
 * O arcabouço de identidade publica as próprias rotas — entrada, saída, troca de senha, segundo
 * fator — e o §4.1 da tech spec decidiu **preservar os caminhos nativos** sob `/v1/auth`, para que
 * o cliente oficial funcione sem tradução. É exceção consciente ao invariante 6 do `CLAUDE.md`,
 * limitada às rotas de autenticação: todo recurso do produto fala camelCase em português.
 *
 * Uma rota por ação obrigaria a manter à mão uma lista que o arcabouço já tem, e a lista
 * envelheceria a cada versão dele — que é a classe de defeito que a barreira de admissão da T7
 * fechou por topologia, e não por enumeração.
 *
 * ---------------------------------------------------------------------------
 * A ponte entre o `Request`/`Response` do arcabouço e o adaptador HTTP
 * ---------------------------------------------------------------------------
 *
 * O manipulador fala o par `Request`/`Response` da plataforma web; o adaptador HTTP do serviço fala
 * o objeto do Fastify. Este controlador é a tradução, e ela tem três pontos que não são mecânicos:
 *
 *   1. **O corpo** já foi interpretado pelo adaptador antes de chegar aqui, e é reescrito em JSON
 *      para o manipulador. Sem isso ele receberia um corpo vazio e recusaria toda entrada.
 *   2. **`Set-Cookie` é copiado à parte.** A iteração padrão de cabeçalhos junta valores repetidos
 *      numa cadeia só, e a credencial de sessão viaja justamente num cabeçalho que pode repetir —
 *      juntar dois cookies numa linha entrega ao navegador um cookie com o nome do primeiro e o
 *      valor de todos.
 *   3. **A resposta de erro NÃO é repassada.** Ver abaixo.
 *
 * ---------------------------------------------------------------------------
 * Erro do arcabouço vira exceção — é o que faz a ADR-0007 valer aqui
 * ---------------------------------------------------------------------------
 *
 * O manipulador devolve a recusa como uma `Response` comum, no formato dele
 * (`{ code, message }`, em inglês). Repassá-la publicaria dois formatos de erro na mesma API e
 * mataria a classificação por `codigo` que a ADR-0007 comprou.
 *
 * Por isso a resposta de erro é convertida em exceção do arcabouço HTTP e **o filtro global**
 * (`comum/filtro-excecao.ts`, registrado por `APP_FILTER`) faz a tradução para o envelope canônico
 * — o mesmo filtro, a mesma tabela de código por status, sem um segundo caminho para o mesmo
 * problema.
 *
 * Para a recusa **do arcabouço**, a conversão olha apenas o status, nunca o `code` nem a `message`.
 * Isso não é economia: é a RN-10. As quatro causas de recusa de entrada — credencial incorreta,
 * conta bloqueada, pessoa desativada e empresa suspensa — chegam aqui com o MESMO status, e derivar
 * a resposta só dele torna estruturalmente impossível que uma delas se distinga das outras. O
 * motivo fica onde serve: na trilha de auditoria, que a T7 escreve.
 *
 * A recusa **nossa** é o outro caso, e ela é reconhecida pelo `code`: as validações de produto de
 * `@sysloc/auth` recusam com `RECUSA_DE_CAMPO_INVALIDO`, e é ali que nascem o campo culpado e os
 * motivos que a §6.1 manda entregar em `detalhes`. Não há tensão com o parágrafo acima: o que a
 * RN-10 proíbe é distinguir CAUSAS DE RECUSA DE ENTRADA entre si, e as duas recusas de campo não
 * são recusa de entrada — nenhuma delas confere credencial, e uma delas (a senha fraca) sequer
 * chega ao manipulador. Ler o código de uma recusa que este sistema mesmo emitiu é a única forma de
 * `campo` e `detalhes` sobreviverem à travessia, e a alternativa — classificar por status — os
 * perderia, devolvendo `REQUISICAO_RECUSADA` sem culpado nomeado.
 *
 * O corpo original do arcabouço acompanha a exceção como diagnóstico — o filtro o entrega ao
 * registro estruturado por campo nomeado, que é onde a redação de segredo o alcança, e nunca ao
 * cliente.
 *
 * **Status que o filtro não sabe nomear não viram `500`.** O filtro classifica por faixa: recusa de
 * cliente sai como recusa, com o status que o arcabouço escolheu preservado. A decisão está em
 * `comum/filtro-excecao.ts`; aqui basta saber que este encaminhador pode entregar ao filtro
 * qualquer status que o arcabouço venha a emitir, hoje ou numa versão futura, sem que isso vire
 * falha de servidor na resposta nem no journal.
 *
 * ---------------------------------------------------------------------------
 * As duas validações do PRODUTO **não moram aqui** — e por quê (T10 / Gate 2)
 * ---------------------------------------------------------------------------
 *
 * A §6.1 da tech spec exige duas coisas que o arcabouço não faz — a força da senha nova (RN-05) e
 * o formato do código do segundo fator —, e a primeira versão da T10 as instalou **neste
 * encaminhador**, comparando o caminho do pedido com um literal. Estava errado por topologia: a
 * §6.1 escreve a regra da senha por CLASSE ("toda definição de senha"), e um ponto de instalação
 * num adaptador HTTP alcança um caminho e nenhuma das chamadas `auth.api.*` que nascem dentro do
 * servidor. As duas passaram para o `hooks.before` de `packages/auth/src/autenticacao.ts`, que é o
 * lugar por onde TODO endpoint do arcabouço passa e onde a política já mora; a justificativa
 * completa está lá, junto das constantes.
 *
 * O que sobrou aqui é a tradução da recusa — ver o parágrafo seguinte —, e ela continua sendo o
 * único jeito de o envelope da ADR-0007 valer para uma recusa que nasce fora deste vocabulário.
 *
 * **Isto não fecha o `D21`.** Aquele débito é de outro eixo — a barreira de ADMISSÃO (pessoa
 * desativada, empresa suspensa) não desfazer a escrita de credencial —, tem dono declarado na
 * fatia `autorizacao-e-ciclo-de-acesso` e segue aberto no marcador de `packages/auth/src/
 * autenticacao.ts`.
 *
 * ---------------------------------------------------------------------------
 * A marca de senha provisória cai DEPOIS da troca, e só depois
 * ---------------------------------------------------------------------------
 *
 * `identidade.usuario.senha_provisoria` é coluna do produto: o arcabouço não a conhece e não a
 * baixaria nunca. Sem alguém a baixar, a sessão restrita da RN-09 seria permanente e a troca
 * obrigatória não teria desfecho. Quem escreve é `@sysloc/auth`
 * (`limparMarcaDeSenhaProvisoria`), pelo mesmo motivo pelo qual a leitura de `identidade` mora lá
 * — esta aplicação não conhece o schema nem o construtor de consulta do ORM (§11.2).
 *
 * A escrita acontece **depois** de o manipulador responder sem recusa. Antes seria liberar a
 * sessão de quem teve a senha recusada; e a marca cai **sem novo login** porque a guarda relê a
 * pessoa a cada requisição — nada precisa ser invalidado para a restrição sumir.
 *
 * ---------------------------------------------------------------------------
 * Por que esta superfície fica FORA do contrato publicado
 * ---------------------------------------------------------------------------
 *
 * `@ApiExcludeController()` retira as rotas de identidade de `/docs` e de `/docs/json`. A decisão
 * é do encaminhador, não da superfície: anotar `@All('*')` produziria no documento uma entrada
 * `/v1/auth/{*}` **por método** — um caminho que ninguém chama, e que não descreve nenhuma das seis
 * rotas da §4.1. Um gerador de cliente consumiria isso como se fosse contrato, o que é pior que a
 * ausência.
 *
 * A ausência, porém, é **pendência com dono**, e não decisão fechada: o marco de entrega do
 * `CLAUDE.md` faz o `handoff-frontend.md` e o `@sysloc/contracts` dependerem justamente deste
 * documento, e as seis rotas da §4.1 precisam estar nele. Fechar exige declará-las à mão, uma
 * anotação por rota, escrita a partir do inventário que o `CT-018 (d)` fixa — e isso pertence à
 * **task de fechamento da F1**, junto da publicação do `@sysloc/contracts`, que é o momento em que
 * a superfície da API é congelada. Sem alteração de comportamento aqui.
 */

import { All, Controller, HttpException, Inject, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  type Autenticacao,
  limparMarcaDeSenhaProvisoria,
  RECUSA_DE_CAMPO_INVALIDO,
} from '@sysloc/auth';
import type { AcessoAIdentidade } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_ACESSO_A_IDENTIDADE, TOKEN_AUTENTICACAO } from '../configuracao/ambiente.js';
import { RotaPublica } from './rota-publica.decorator.js';

/**
 * Caminho em que a superfície de identidade é montada, **relativo ao prefixo de versão**.
 *
 * Exportado porque o módulo o compõe com `PREFIXO_DE_VERSAO` para dizer ao arcabouço em que
 * endereço ele está montado. Se os dois divergissem, o arcabouço interpretaria os caminhos a partir
 * de um prefixo que ninguém atende, e toda rota dele responderia "não encontrado".
 */
export const CAMINHO_DA_IDENTIDADE = 'auth';

/** Menor status que caracteriza recusa. Abaixo dele a resposta do arcabouço é repassada. */
const PRIMEIRO_STATUS_DE_RECUSA = 400;

/** Métodos que não carregam corpo — reescrevê-lo para eles é erro de protocolo. */
const METODOS_SEM_CORPO = new Set(['GET', 'HEAD']);

/** Caminho da troca de senha, **relativo ao prefixo do arcabouço** (§4.1). */
const CAMINHO_DA_TROCA_DE_SENHA = '/change-password';

// A marca vale para o encaminhador INTEIRO, e não poderia ser mais fina: o `@All('*')` abaixo é UM
// manipulador, e a guarda decide por manipulador. É exceção consciente, e o que a torna aceitável é
// que a superfície liberada **não fica sem dono**: o arcabouço confere a própria sessão em cada rota
// que a exige, e o inventário do `CT-018 (d)` (T8) fixa por asserção quais rotas ele publica. A
// prova de que "público na guarda" não é "aberto" mora em `test/contexto.e2e.spec.ts`, que exercita
// uma rota do inventário sem sessão e afirma `401 CREDENCIAL_INVALIDA` — a recusa do arcabouço, e
// não a da guarda.
//
// Sem a marca, a ENTRADA seria impossível: `POST /v1/auth/sign-in/email` responderia `401` por
// falta da sessão que ela existe para criar.
@RotaPublica()
@ApiExcludeController()
@Controller(CAMINHO_DA_IDENTIDADE)
export class AutenticacaoController {
  constructor(
    @Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao,
    // O acesso restrito a `identidade` entra apenas para que a marca de senha provisória possa ser
    // baixada pela capacidade que `@sysloc/auth` publica. Nenhuma consulta é escrita aqui: o que
    // este controlador conhece é a função, não o schema.
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
  ) {}

  /**
   * Encaminha qualquer método e qualquer caminho sob `/v1/auth` ao manipulador do arcabouço.
   *
   * O curinga é **anônimo**, e isso é do adaptador HTTP em uso, não preferência: o casador de rotas
   * do Fastify exige que o curinga seja o último caractere do caminho e recusa a forma nomeada
   * (`*resto`) com `Wildcard must be the last character in the route` — medido, e não suposto. A
   * forma nomeada é a do outro adaptador, e a conversão automática do arcabouço só alcança
   * middleware, nunca rota de controlador.
   *
   * A queda da marca de senha provisória entra **neste** manipulador porque ele é um só:
   * `@All('*')` é o único ponto por onde toda requisição de `/v1/auth` passa. O cabeçalho deste
   * arquivo diz por que a ordem — encaminhar, e só então baixar a marca — é o que importa.
   */
  @All('*')
  async encaminhar(
    @Req() requisicao: FastifyRequest,
    @Res() resposta: FastifyReply,
  ): Promise<void> {
    const requisicaoWeb = comoRequisicaoWeb(requisicao, this.autenticacao.options.baseURL);
    const caminho = caminhoNoArcabouco(requisicaoWeb.url, this.autenticacao.options.basePath);

    // A pessoa é resolvida ANTES do encaminhamento, e não depois: a troca pode rotacionar a sessão
    // (`revokeOtherSessions`) — depois dela, o cookie do pedido pode já não resolver ninguém.
    // Sessão ausente devolve `undefined` e o pedido segue para o arcabouço, que é quem recusa.
    const donoDaTroca =
      caminho === CAMINHO_DA_TROCA_DE_SENHA ? await this.pessoaDaSessao(requisicaoWeb) : undefined;

    const devolvida = await this.autenticacao.handler(requisicaoWeb);

    if (devolvida.status >= PRIMEIRO_STATUS_DE_RECUSA) {
      const diagnostico = await devolvida.text();
      // Recusa NOSSA primeiro: ela já traz o campo culpado e os motivos, e o envelope da ADR-0007
      // sai completo. O que não for nossa cai na regra geral abaixo.
      recusarComEnvelopeDoProduto(diagnostico);

      // O corpo do arcabouço vira DIAGNÓSTICO da exceção, nunca resposta: o filtro global monta o
      // envelope da ADR-0007 a partir do status e da tabela de mensagem pública.
      throw new HttpException(diagnostico, devolvida.status);
    }

    if (donoDaTroca !== undefined) {
      // Só aqui: a linha acima já levantou para toda recusa, então alcançar este ponto é a troca
      // ter sido aceita. Baixar a marca antes seria liberar a sessão de quem teve a senha nova
      // recusada — e é exatamente esse o defeito que o CT-022 procura.
      await limparMarcaDeSenhaProvisoria(this.acesso.identidade, donoDaTroca);
    }

    await responderCom(resposta, devolvida);
  }

  /**
   * Quem está por trás do cookie desta requisição, ou `undefined` quando não há sessão.
   *
   * A conferência é a **do arcabouço** (`getSession`), a mesma que a guarda de contexto usa: um
   * segundo jeito de decidir "há sessão aqui?" seria um segundo jeito de errar. Os cabeçalhos são
   * os da requisição já convertida — sem uma segunda cópia deles, que poderia divergir da que o
   * manipulador vai receber.
   *
   * O que sai daqui é o mínimo: o identificador, porque é dele que a marca de senha provisória cai.
   */
  private async pessoaDaSessao(requisicao: Request): Promise<string | undefined> {
    const autenticada = await this.autenticacao.api.getSession({ headers: requisicao.headers });

    return autenticada === null ? undefined : autenticada.user.id;
  }
}

/**
 * O caminho do pedido **relativo ao prefixo em que o arcabouço está montado**.
 *
 * O prefixo vem de `options.basePath` — o mesmo valor que o arcabouço usa para casar as próprias
 * rotas, e não uma segunda composição escrita aqui. Não é economia: uma cópia divergente faria as
 * comparações abaixo nunca casarem, e o efeito seria **silencioso** — a troca de senha seguiria sem
 * política de força e a marca nunca cairia, sem que nada acusasse.
 *
 * Por isso a ausência do prefixo **levanta** em vez de devolver o caminho inteiro: um pedido que
 * chegue a este encaminhador fora do prefixo do arcabouço é defeito de composição, e responder
 * "não é a rota de troca de senha" a ele seria falhar aberto exatamente onde não se pode.
 */
function caminhoNoArcabouco(alvo: string, prefixo: string | undefined): string {
  const caminho = new URL(alvo).pathname;

  if (prefixo === undefined || !caminho.startsWith(prefixo)) {
    throw new ErroDeAplicacao(
      CodigoErro.ERRO_INTERNO,
      'o encaminhador de identidade recebeu requisição fora do prefixo em que o arcabouço está montado',
    );
  }

  return caminho.slice(prefixo.length);
}

/**
 * Levanta o envelope da ADR-0007 quando a recusa do arcabouço é, na verdade, uma recusa NOSSA.
 *
 * As validações de produto de `@sysloc/auth` recusam com `APIError`, porque é a única recusa que o
 * roteador do arcabouço converte em resposta em vez de tratar como falha do servidor — e o corpo
 * dela volta até aqui serializado. Sem esta leitura, o `422` cairia na classificação por faixa do
 * filtro global e chegaria ao cliente como `REQUISICAO_RECUSADA` sem `campo` nem `detalhes`, isto
 * é, sem a informação que a §6.1 existe para entregar.
 *
 * **A mensagem que sai é sempre a canônica do código**, lida de `MENSAGEM_POR_CODIGO`, nunca a que
 * viajou no corpo: quem discrimina o problema é `codigo` mais `campo` mais `detalhes`, e adotar o
 * texto de origem seria classificação por mensagem — o que a ADR-0007 existe para aposentar.
 *
 * Corpo que não é JSON, ou que é JSON de outra forma, sai daqui sem efeito: a recusa segue para a
 * regra geral, que preserva o status de quem recusou.
 */
function recusarComEnvelopeDoProduto(corpoDaResposta: string): void {
  let interpretado: unknown;

  try {
    interpretado = JSON.parse(corpoDaResposta);
  } catch {
    return;
  }

  if (typeof interpretado !== 'object' || interpretado === null) {
    return;
  }

  const corpo = interpretado as Record<string, unknown>;

  if (corpo.code !== RECUSA_DE_CAMPO_INVALIDO.code || typeof corpo.campo !== 'string') {
    return;
  }

  throw new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    {
      campo: corpo.campo,
      // Ausente é ausente, e não presente valendo indefinido: `paraCorpo()` omite o opcional não
      // informado, e é o que faz a recusa do código do segundo fator sair sem `detalhes`.
      ...(ehDetalhes(corpo.detalhes) ? { detalhes: corpo.detalhes } : {}),
    },
  );
}

/** `detalhes` é objeto simples, ou não é `detalhes`. */
function ehDetalhes(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Monta o `Request` da plataforma web a partir da requisição do adaptador HTTP.
 *
 * O que o arcabouço extrai deste endereço é o **caminho**, que ele compara com o prefixo em que foi
 * montado. A origem confiável, essa sim, ele confere contra o endereço base — pelo cabeçalho
 * `Origin`, que atravessa nos cabeçalhos copiados acima.
 *
 * Por isso a base vem da **configuração do próprio arcabouço** (`options.baseURL`, o mesmo valor
 * que a composição lhe entregou), e não do cabeçalho `Host`: `Host` é entrada arbitrária do
 * cliente, e embora um valor forjado não contorne a conferência de origem, um valor sintaticamente
 * inválido faria `new URL` levantar `TypeError` — erro de servidor produzido por um cabeçalho que
 * nem sequer é lido. A base configurada não tem essa aresta e não pode divergir da que o arcabouço
 * usa, porque é literalmente a mesma.
 */
function comoRequisicaoWeb(requisicao: FastifyRequest, enderecoBase: string): Request {
  const cabecalhos = new Headers();
  for (const [nome, valor] of Object.entries(requisicao.headers)) {
    if (valor === undefined) {
      continue;
    }
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      cabecalhos.append(nome, item);
    }
  }

  const semCorpo =
    METODOS_SEM_CORPO.has(requisicao.method.toUpperCase()) || requisicao.body === undefined;

  return new Request(new URL(requisicao.url, enderecoBase), {
    method: requisicao.method,
    headers: cabecalhos,
    ...(semCorpo ? {} : { body: JSON.stringify(requisicao.body) }),
  });
}

/** Copia status, cabeçalhos e corpo da resposta do arcabouço para a resposta do adaptador. */
async function responderCom(resposta: FastifyReply, devolvida: Response): Promise<void> {
  devolvida.headers.forEach((valor, nome) => {
    // `set-cookie` é copiado abaixo, do arranjo — a iteração o entregaria já concatenado.
    if (nome.toLowerCase() !== 'set-cookie') {
      resposta.header(nome, valor);
    }
  });

  const cookies = devolvida.headers.getSetCookie();
  if (cookies.length > 0) {
    resposta.header('set-cookie', cookies);
  }

  // O corpo é copiado em bytes, e não reserializado: o que o arcabouço escreveu é o que o cliente
  // oficial dele espera ler, byte a byte.
  const corpo = Buffer.from(await devolvida.arrayBuffer());
  resposta.status(devolvida.status).send(corpo);
}
