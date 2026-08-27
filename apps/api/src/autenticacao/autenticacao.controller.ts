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
 * Erro do arcabouço vira exceção — é o que faz a ADR-0012 valer aqui
 * ---------------------------------------------------------------------------
 *
 * O manipulador devolve a recusa como uma `Response` comum, no formato dele
 * (`{ code, message }`, em inglês). Repassá-la publicaria dois formatos de erro na mesma API e
 * mataria a classificação por `codigo` que a ADR-0012 comprou.
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
 * único jeito de o envelope da ADR-0012 valer para uma recusa que nasce fora deste vocabulário.
 *
 * **Isto não fechava o `D21`**, e não é aqui que ele fecha. Aquele débito é de outro eixo — a
 * barreira de ADMISSÃO (pessoa desativada, empresa suspensa) não desfazer a escrita de credencial
 * —, e a T9 desta fatia o fechou por topologia: a rota que gravava antes de conferir **deixou de
 * ser publicada** (ver a seção seguinte), e a troca do produto confere a admissão antes de
 * qualquer escrita.
 *
 * ---------------------------------------------------------------------------
 * O ENCAMINHADOR NÃO PUBLICA TUDO: a troca de senha nativa fica de fora (T9 · D21)
 * ---------------------------------------------------------------------------
 *
 * `/change-password` é recusada **antes do repasse**, e o caminho responde `404` no envelope
 * canônico — ver {@link CAMINHOS_NAO_PUBLICADOS}. Quem troca senha neste produto é
 * `POST /v1/sessao/senha` (`senha.controller.ts`), e o cabeçalho daquele arquivo carrega a razão
 * por extenso: na rota nativa a credencial é gravada e as sessões apagadas **antes** de a barreira
 * de admissão levantar, de modo que uma pessoa recusada saía sem acesso e sem saber por quê.
 *
 * Com isso, a queda da marca de senha provisória — que morava neste manipulador enquanto a rota
 * nativa era a única troca existente — mudou de casa junto com a troca: ela agora acontece no
 * controlador do produto, na mesma ordem de sempre (depois de a troca ser aceita, nunca antes).
 * Nada aqui a escreve, e nada aqui precisa do acesso a `identidade`.
 *
 * ---------------------------------------------------------------------------
 * Por que esta superfície fica FORA do contrato publicado
 * ---------------------------------------------------------------------------
 *
 * `@ApiExcludeController()` retira as rotas de identidade de `/docs` e de `/docs/json`. A decisão
 * é do encaminhador, não da superfície: anotar `@All('*')` produziria no documento uma entrada
 * `/v1/auth/{*}` **por método** — um caminho que ninguém chama, e que não descreve nenhuma das
 * rotas da §4.1. Um gerador de cliente consumiria isso como se fosse contrato, o que é pior que a
 * ausência.
 *
 * A ausência, porém, é **pendência com dono**, e não decisão fechada: o marco de entrega do
 * `CLAUDE.md` faz o `handoff-frontend.md` e o `@syslocbr/contracts` dependerem justamente deste
 * documento, e as rotas que a §4.1 declara sob este prefixo precisam estar nele — **cinco desde a
 * T9**, que desligou a sexta. Fechar exige declará-las à mão, uma anotação por rota, escrita a
 * partir do inventário que o `CT-018 (d)` fixa.
 *
 * **Dono, precisado no fechamento da F1**: a **publicação do `@syslocbr/contracts`**, e não uma task
 * genérica de fechamento. Declará-las agora produziria um documento que o congelamento
 * reescreveria dias depois, e as anotações envelheceriam sem consumidor — o gerador de cliente só
 * existe a partir daquele pacote. O que o fechamento da F1 fez foi tirar a pendência do limbo:
 * ela tem endereço no marco de entrega, e não em "alguma task futura". Sem alteração de
 * comportamento aqui.
 *
 * ---------------------------------------------------------------------------
 * O rótulo de journal, e por que ele nasce AQUI (fechamento da F1 · D27)
 * ---------------------------------------------------------------------------
 *
 * O filtro global grava o padrão da rota casada, e sob `@All('*')` esse padrão é `/v1/auth/*` para
 * as ~40 rotas de identidade — o operador não distinguia uma tentativa de ENTRADA de qualquer outra
 * recusa daquele prefixo. Este encaminhador é o único ponto que conhece a rota real, então é ele
 * quem a declara, por {@link definirRotuloDeRota}.
 *
 * A declaração é **fail-closed**: só padrões LITERAIS do registro do arcabouço viram rótulo, por
 * igualdade. Padrão com segmento variável não entra, e a razão é dura — casá-lo exigiria extrair
 * segmento do caminho concreto, e um defeito ali publicaria o token de redefinição no journal. Ver
 * {@link caminhosLiteraisDoArcabouco} e `comum/rotulo-de-rota.ts`. O `CT-106` prova a propriedade.
 */

import { All, Controller, HttpException, Inject, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { type Autenticacao, RECUSA_DE_CAMPO_INVALIDO } from '@sysloc/auth';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { definirRotuloDeRota } from '../comum/rotulo-de-rota.js';
import { TOKEN_AUTENTICACAO } from '../configuracao/ambiente.js';
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

/** Caminho da troca de senha nativa, **relativo ao prefixo do arcabouço**. */
const CAMINHO_DA_TROCA_DE_SENHA_NATIVA = '/change-password';

/**
 * Os caminhos do arcabouço que este encaminhador **deixa de publicar** (T9 · fecha o `D21`).
 *
 * ---------------------------------------------------------------------------
 * Por que a recusa mora AQUI, e não na configuração do arcabouço
 * ---------------------------------------------------------------------------
 *
 * O cartão da T9 manda preferir desligar a capacidade na própria configuração, *"para que a rota
 * deixe de existir em vez de ser barrada na borda"*, e registra a preferência como hipótese a
 * validar. **Ela foi validada, e o caminho foi recusado com razão medida** — três achados, todos
 * contra `better-auth@1.6.25` instalado:
 *
 *   1. **a opção existe**: `disabledPaths` é campo de primeira classe das opções
 *      (`@better-auth/core`, `src/types/init-options.ts`) e o roteador responde `404` a todo
 *      caminho listado, em `onRequest` (`dist/api/index.mjs`);
 *   2. **ela NÃO faz a rota deixar de existir**: `getEndpoints` monta o registro `api` com
 *      `changePassword` incondicionalmente, e `disabledPaths` só é consultado pelo ROTEADOR. A
 *      capacidade continua no registro, continua chamável por `auth.api.changePassword` — que é
 *      exatamente como a rota do produto grava a credencial — e continua aparecendo no inventário
 *      do `CT-018 (d)`. A premissa da preferência não se sustenta;
 *   3. **e ela custaria DUAS provas vivas**, ambas em `packages/auth`, que é outro pacote e outro
 *      escopo: o caso da barreira de admissão exercita `/change-password` como a **segunda rota
 *      emissora de sessão** — é o que sustenta o `REVERTER EXIGE` da `DECISÃO FECHADA — T7` —, e o
 *      `CT-236` exercita nele a perna do grupo de tetos de credencial do limitador de taxa (as
 *      outras estão inertes por configuração). Um `404` em `onRequest` apagaria as duas: ele
 *      responde antes do limitador e antes do manipulador. **E apagaria uma terceira coisa, que não
 *      é prova**: `POST /v1/sessao/senha` grava a credencial repassando ao manipulador desta mesma
 *      instância, justamente para correr sob aquele teto (ver `senha.controller.ts`). Com
 *      `disabledPaths`, a troca de senha do produto deixaria de funcionar.
 *
 * O encaminhador, por outro lado, **é** o ponto topológico onde se decide o que esta API publica
 * sob `/v1/auth`: ele é um só, é `@All('*')`, e não existe segundo caminho por onde uma requisição
 * HTTP alcance a superfície de identidade. Recusar aqui não é "instalar a propriedade por ponto" —
 * a propriedade *é* sobre a superfície HTTP, e este é o único ponto dela.
 *
 * A recusa é `404`, e não `403`: o cliente não está sendo barrado, o caminho **não é publicado por
 * esta API**. É o mesmo status que a opção do arcabouço escolheria, e o mesmo que qualquer caminho
 * inexistente sob o prefixo já devolve.
 *
 * Exportado para que o `CT-018 (d)` subtraia estes caminhos da superfície efetiva a partir do SUT,
 * em vez de manter uma segunda lista escrita à mão no caso.
 */
export const CAMINHOS_NAO_PUBLICADOS: ReadonlySet<string> = new Set([
  CAMINHO_DA_TROCA_DE_SENHA_NATIVA,
]);

/** Marca de segmento variável num padrão de rota do arcabouço (`/reset-password/:token`). */
const MARCA_DE_PARAMETRO = ':';

/**
 * Uma ponta do registro do arcabouço, no mínimo que este arquivo lê.
 *
 * Declarada por estrutura em vez de importada: o tipo do registro é inferido das opções e mudaria de
 * forma a cada bump, e o que interessa aqui — o padrão de caminho — é estável.
 */
interface PontaDoArcabouco {
  readonly path?: string;
}

/**
 * Os padrões de rota do arcabouço que **não têm segmento variável**, para rotular o journal.
 *
 * O encaminhador é `@All('*')`, então o roteador casa UM padrão (`/v1/auth/*`) para toda a
 * superfície de identidade — e o journal sairia sem distinguir uma tentativa de entrada de qualquer
 * outra recusa dali (débito D27). Este conjunto é o que permite ao filtro global gravar a rota real.
 *
 * **Só os literais entram, e a exclusão é a garantia.** Um padrão com `:` exigiria casar o caminho
 * concreto contra ele, e um defeito nesse casamento publicaria o valor do segmento — o token de
 * redefinição — no artefato que a operação lê. Sem casamento não há esse risco: a comparação é
 * igualdade literal, e o que não estiver no conjunto continua saindo como o curinga, que é o
 * comportamento anterior a esta mudança.
 *
 * Derivado do MESMO registro que o `CT-018 (d)` audita — não de uma segunda lista escrita à mão,
 * que envelheceria a cada versão do arcabouço.
 *
 * **Falha ALTA num bump que renomeie `api` é deliberada.** A leitura roda na composição, e um
 * registro ausente faria `Object.values(undefined)` levantar — a aplicação não sobe. O contrário
 * (`?? {}`) faria o conjunto nascer vazio e o journal voltar em silêncio ao rótulo curinga, que é
 * uma regressão que ninguém veria. O modo de falha barulhento chega antes de produção de qualquer
 * forma: o `CT-018 (d)` lê o mesmo `.api` e reprova no mesmo bump.
 */
function caminhosLiteraisDoArcabouco(autenticacao: Autenticacao): ReadonlySet<string> {
  const registro = (autenticacao as unknown as { readonly api: Record<string, PontaDoArcabouco> })
    .api;
  const literais = new Set<string>();

  for (const ponta of Object.values(registro)) {
    const caminho = ponta?.path;

    if (caminho !== undefined && caminho.length > 0 && !caminho.includes(MARCA_DE_PARAMETRO)) {
      literais.add(caminho);
    }
  }

  return literais;
}

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
  constructor(@Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao) {
    this.caminhosLiterais = caminhosLiteraisDoArcabouco(autenticacao);
  }

  /**
   * Padrões literais do arcabouço, calculados UMA vez na composição.
   *
   * O registro não muda depois que a instância é montada, e recalcular por requisição colocaria uma
   * varredura de ~40 pontas no caminho quente de toda chamada de identidade.
   */
  private readonly caminhosLiterais: ReadonlySet<string>;

  /**
   * Encaminha qualquer método e qualquer caminho sob `/v1/auth` ao manipulador do arcabouço.
   *
   * O curinga é **anônimo**, e isso é do adaptador HTTP em uso, não preferência: o casador de rotas
   * do Fastify exige que o curinga seja o último caractere do caminho e recusa a forma nomeada
   * (`*resto`) com `Wildcard must be the last character in the route` — medido, e não suposto. A
   * forma nomeada é a do outro adaptador, e a conversão automática do arcabouço só alcança
   * middleware, nunca rota de controlador.
   *
   * A recusa dos caminhos não publicados entra **neste** manipulador porque ele é um só:
   * `@All('*')` é o único ponto por onde toda requisição de `/v1/auth` passa, e é por isso que
   * barrar aqui vale para todo método sem que a lista precise conhecer verbo nenhum.
   */
  @All('*')
  async encaminhar(
    @Req() requisicao: FastifyRequest,
    @Res() resposta: FastifyReply,
  ): Promise<void> {
    const requisicaoWeb = comoRequisicaoWeb(requisicao, this.autenticacao.options.baseURL);
    const caminho = caminhoNoArcabouco(requisicaoWeb.url, this.autenticacao.options.basePath);

    // ANTES de qualquer outra coisa — antes do rótulo de journal, antes de resolver sessão e antes
    // do repasse: o caminho não publicado não chega ao arcabouço por via nenhuma. Ver
    // {@link CAMINHOS_NAO_PUBLICADOS} para por que a recusa mora aqui e por que ela é `404`.
    if (CAMINHOS_NAO_PUBLICADOS.has(caminho)) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    // O rótulo do journal, quando — e SÓ quando — o caminho é um padrão literal conhecido. Fora
    // disso nada é definido e o filtro global segue com o padrão do roteador (`/v1/auth/*`),
    // exatamente como antes. Ver `comum/rotulo-de-rota.ts` para por que o conjunto é fechado.
    if (this.caminhosLiterais.has(caminho)) {
      definirRotuloDeRota(requisicao, `${this.autenticacao.options.basePath ?? ''}${caminho}`);
    }

    const devolvida = await this.autenticacao.handler(requisicaoWeb);

    if (devolvida.status >= PRIMEIRO_STATUS_DE_RECUSA) {
      const diagnostico = await devolvida.text();
      // Recusa NOSSA primeiro: ela já traz o campo culpado e os motivos, e o envelope da ADR-0012
      // sai completo. O que não for nossa cai na regra geral abaixo.
      recusarComEnvelopeDoProduto(diagnostico);

      // O corpo do arcabouço vira DIAGNÓSTICO da exceção, nunca resposta: o filtro global monta o
      // envelope da ADR-0012 a partir do status e da tabela de mensagem pública.
      throw new HttpException(diagnostico, devolvida.status);
    }

    await responderCom(resposta, devolvida);
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
 * Levanta o envelope da ADR-0012 quando a recusa do arcabouço é, na verdade, uma recusa NOSSA.
 *
 * As validações de produto de `@sysloc/auth` recusam com `APIError`, porque é a única recusa que o
 * roteador do arcabouço converte em resposta em vez de tratar como falha do servidor — e o corpo
 * dela volta até aqui serializado. Sem esta leitura, o `422` cairia na classificação por faixa do
 * filtro global e chegaria ao cliente como `REQUISICAO_RECUSADA` sem `campo` nem `detalhes`, isto
 * é, sem a informação que a §6.1 existe para entregar.
 *
 * **A mensagem que sai é sempre a canônica do código**, lida de `MENSAGEM_POR_CODIGO`, nunca a que
 * viajou no corpo: quem discrimina o problema é `codigo` mais `campo` mais `detalhes`, e adotar o
 * texto de origem seria classificação por mensagem — o que a ADR-0012 existe para aposentar.
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
