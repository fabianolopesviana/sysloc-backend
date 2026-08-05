/**
 * Tratamento global de erro — o ponto em que a ADR-0007 vira código.
 *
 * ---------------------------------------------------------------------------
 * O que a decisão fixa, e como este filtro a cumpre
 * ---------------------------------------------------------------------------
 *
 * A ADR-0007 fixa que todo erro sai como **status HTTP semântico** mais o corpo
 * `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de enum fechado. O formato padrão
 * do arcabouço (`{ statusCode, error, message }`) é o que a decisão existe para eliminar — deixá-lo
 * ativo em qualquer rota devolve ao cliente a classificação por texto que a ADR aposentou.
 *
 * Por isso o filtro é registrado como filtro **global do módulo raiz** (`APP_FILTER` em
 * `app.module.ts`), e não montado à mão no ponto de entrada: toda aplicação criada a partir de
 * `AppModule` — a de operação e a da verificação — nasce com ele, sem depender de alguém repetir
 * o registro.
 *
 * ---------------------------------------------------------------------------
 * Erro NOSSO é normalizado em `ErroDeAplicacao`; recusa ALHEIA preserva o status
 * ---------------------------------------------------------------------------
 *
 * `ErroDeAplicacao` (T3) já é dona da decisão "qual código implica qual status", e o status não é
 * parâmetro dela. Todo erro que nasce **neste** sistema passa por ela — em vez de uma segunda
 * tabela de status aqui —, e é isso que garante que uma classe nova de erro não responda um par
 * (status, código) incoerente com o resto do sistema.
 *
 * A recusa que nasce **fora** dele é o outro caso, e tem tratamento próprio: o status vem de quem
 * recusou e é preservado; o código vem de uma classificação **por faixa**, que é total por
 * construção. A razão está por extenso na decisão fechada de {@link recusaSemNomeNoVocabulario} —
 * em resumo: recusa de cliente jamais é reclassificada como falha do servidor, nem na resposta nem
 * no journal.
 *
 * ---------------------------------------------------------------------------
 * A mensagem que sai é NOSSA, nunca a da exceção de origem
 * ---------------------------------------------------------------------------
 *
 * Para tudo que não é `ErroDeAplicacao`, a mensagem da resposta vem de {@link MENSAGEM_POR_CODIGO}.
 * A exceção original nunca é reencapsulada no corpo: é dela que vazariam cadeia de conexão,
 * caminho de arquivo e nome de coluna. O diagnóstico não se perde — ele vai inteiro para o
 * registro estruturado, que redige segredo na origem (T3) e que só o operador lê.
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
} from '@nestjs/common';
import { CodigoErro, type CorpoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { rotuloDeRota } from './rotulo-de-rota.js';

/**
 * Código do enum fechado por status HTTP que o arcabouço levanta por conta própria.
 *
 * Só entram os status que esta fatia sabe **nomear** — e hoje são quatro. Antecipar status sem
 * produtor seria pior que omissão: `ErroDeAplicacao` deriva o status DO CÓDIGO, então uma entrada
 * como `422 → CAMPO_INVALIDO` responderia `400` a um `422`, trocando em silêncio o status que o
 * arcabouço escolheu. Quem levantar um status novo e souber nomeá-lo acrescenta a linha junto com
 * o produtor.
 *
 * **Esta tabela é a via do status NOMEADO, não a única via.** Status fora dela NÃO cai mais em
 * {@link CodigoErro.ERRO_INTERNO}: a classificação é fechada por faixa em
 * {@link recusaSemNomeNoVocabulario} — ver a decisão fechada ali. A tabela pode, portanto, seguir
 * enxuta sem que a omissão vire mentira.
 */
const CODIGO_POR_STATUS: Readonly<Record<number, CodigoErro>> = {
  400: CodigoErro.CAMPO_INVALIDO,
  // O produtor dos dois abaixo é `autenticacao/autenticacao.controller.ts` (T8), que converte a
  // recusa do arcabouço de identidade em exceção do arcabouço HTTP — e é ele quem acrescenta a
  // linha, como este comentário exige de quem levantar um status novo. `401` é `CREDENCIAL_INVALIDA`
  // e não `NAO_AUTENTICADO` porque o produtor é a superfície de ENTRADA: quem recusa por falta de
  // sessão é a guarda de contexto (T9), que levanta `ErroDeAplicacao` já com o código certo e
  // portanto nunca passa por esta tabela.
  401: CodigoErro.CREDENCIAL_INVALIDA,
  403: CodigoErro.ACESSO_NEGADO,
  404: CodigoErro.RECURSO_NAO_ENCONTRADO,
};

// DECISÃO FECHADA — T9 / Gate 2 (P3) · 2026-08-02
// O QUÊ: `MENSAGEM_POR_CODIGO` é PÚBLICO. A T8 o despublicou por veredito de gate (`export` sem
//        consumidor, reprovado como `dead_code`); a condição que justificava aquilo deixou de
//        valer na T9, quando `autenticacao/contexto.guard.ts` passou a ler daqui a mensagem de
//        `NAO_AUTENTICADO` em vez de reescrever o literal.
// POR QUÊ: enquanto o literal existia nos dois arquivos, "as duas cadeias precisam coincidir" era
//          um comentário — nada reprovava a divergência, e a resposta do cliente passava a
//          depender de qual produtor a montou. Com uma fonte só, a coincidência é consequência.
// REVERTER EXIGE: provar que NENHUM módulo fora deste arquivo lê a tabela — hoje é falso
//                 (`grep -rn "MENSAGEM_POR_CODIGO" apps/api/src`). Se um dia voltar a ser
//                 verdade, despublicar de novo é correto; despublicar com consumidor vivo não é.
/**
 * Mensagem pública por código. `Record<CodigoErro, string>` faz o compilador exigir uma entrada
 * por código: acrescentar valor ao enum sem mensagem **não compila**.
 *
 * É a **fonte única** da mensagem de cada código, e é ela que a ADR-0007 governa: quem levanta um
 * `ErroDeAplicacao` com mensagem própria a compõe daqui, em vez de escrever um segundo literal.
 */
export const MENSAGEM_POR_CODIGO: Readonly<Record<CodigoErro, string>> = {
  [CodigoErro.CAMPO_INVALIDO]: 'requisição inválida',
  [CodigoErro.RECURSO_NAO_ENCONTRADO]: 'recurso não encontrado',
  [CodigoErro.ERRO_INTERNO]: 'erro interno no processamento da requisição',
  [CodigoErro.SERVICO_INDISPONIVEL]: 'serviço temporariamente indisponível',
  // Uma única cadeia para as quatro causas de recusa da entrada (RN-10): credencial incorreta,
  // conta bloqueada, pessoa desativada e empresa suspensa. Nomear a causa aqui confirmaria ao
  // atacante que a conta existe.
  [CodigoErro.CREDENCIAL_INVALIDA]: 'credencial inválida',
  // Literal fixado pela §10.1 da tech spec da fatia.
  [CodigoErro.NAO_AUTENTICADO]: 'sessão inválida ou expirada',
  [CodigoErro.ACESSO_NEGADO]: 'acesso negado para esta sessão',
  // Genérica de propósito: quem recusou não é deste sistema, e inventar uma causa aqui seria
  // afirmar ao cliente algo que não sabemos. O diagnóstico do que de fato aconteceu vai inteiro
  // para o registro estruturado, por campo nomeado, como o de qualquer outra recusa.
  [CodigoErro.REQUISICAO_RECUSADA]: 'requisição recusada',
};

/** Menor status que caracteriza recusa do cliente. Abaixo dele nada é recusa. */
const PRIMEIRO_STATUS_DE_RECUSA = 400;

/** Menor status que caracteriza falha do servidor — acima dele o registro sobe para `error`. */
const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

/**
 * O par (status da resposta, corpo canônico) que o filtro escreve.
 *
 * O status é campo PRÓPRIO, e não derivado do corpo, porque nem todo status que sai daqui nasce de
 * um código nosso: a recusa de um componente externo traz o status que ELE escolheu. Ver
 * {@link recusaSemNomeNoVocabulario}.
 */
interface RespostaDeErro {
  readonly status: number;
  readonly corpo: CorpoErro;
}

@Catch()
export class FiltroExcecaoGlobal implements ExceptionFilter {
  constructor(@Inject(TOKEN_LOGGER) private readonly logger: Logger) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const requisicao = contexto.getRequest<FastifyRequest>();
    const resposta = contexto.getResponse<FastifyReply>();
    const erro = traduzir(excecao);

    // O identificador de correlação é o que o adaptador HTTP já atribui a cada requisição: é ele
    // que liga esta linha do journal à requisição que o cliente fez. A exceção de origem vai por
    // campo nomeado (`erro`), e não interpolada na mensagem — é a convenção que T3 fixou, e é o
    // que faz a redação de segredo alcançá-la.
    const evento = {
      erro: excecao,
      codigo: erro.corpo.codigo,
      status: erro.status,
      metodo: requisicao.method,
      caminho: caminhoSemConsulta(requisicao),
      idCorrelacao: requisicao.id,
    };
    // O nível é derivado do status QUE SAI, e não de um status re-derivado: é o que garante que a
    // linha do journal fale da mesma resposta que o cliente recebeu. Recusa de cliente é `warn`;
    // `error` fica reservado ao que é, de fato, falha do serviço — sem isso o artefato que a
    // operação lê para decidir se houve ataque passa a afirmar falha do servidor justamente
    // quando o serviço está se defendendo.
    if (erro.status >= PRIMEIRO_STATUS_DE_SERVIDOR) {
      this.logger.error(evento, 'requisição encerrada por falha do serviço');
    } else {
      this.logger.warn(evento, 'requisição recusada');
    }

    resposta.status(erro.status).send(erro.corpo);
  }
}

/**
 * Caminho da requisição SEM a cadeia de consulta.
 *
 * `requisicao.url` é o alvo bruto, cadeia de consulta inclusa, e este valor vai para o journal.
 * A redação de segredo de T3 opera por **nome de chave** (`caminho` não é um deles) e por **forma**
 * (credencial em cadeia de conexão) — nenhum dos dois eixos alcança um parâmetro de consulta, de
 * modo que o que viajasse ali seria gravado em claro. Hoje nada trafega dessa forma; a fatia de
 * autenticação traz um arcabouço cujos fluxos carregam credencial e endereço de retorno em
 * consulta, e este filtro é global — o vazamento nasceria já instalado em toda rota.
 *
 * O padrão da rota casada (`/contratos/:id`) é preferido ao caminho concreto: ele agrupa o journal
 * por rota em vez de por instância. Requisição que não casou rota alguma — o `404` — não tem
 * padrão, e aí sobra o alvo bruto truncado antes do `?`.
 *
 * **O rótulo explícito vem antes das duas.** Um manipulador curinga casa um padrão só para muitas
 * rotas — é o caso do encaminhador de `/v1/auth`, cujas ~40 rotas sairiam todas como `/v1/auth/*` —,
 * e quem conhece a rota real pode declará-la por {@link definirRotuloDeRota}. O contrato daquele
 * módulo é que o rótulo seja **padrão de rota tirado de conjunto fechado**, nunca caminho concreto:
 * sem isso, esta função voltaria a ser a via pela qual um segmento sensível chega ao journal, que é
 * exatamente o que o parágrafo acima existe para impedir.
 */
function caminhoSemConsulta(requisicao: FastifyRequest): string {
  const inicioDaConsulta = requisicao.url.indexOf('?');
  return (
    rotuloDeRota(requisicao) ??
    requisicao.routeOptions?.url ??
    (inicioDaConsulta === -1 ? requisicao.url : requisicao.url.slice(0, inicioDaConsulta))
  );
}

/**
 * Converte qualquer exceção no par (status, corpo canônico) que sai na resposta.
 *
 * Três origens, e só três, porque a função é **total** — nenhum ramo cai fora:
 *
 *   1. `ErroDeAplicacao` — a decisão já está tomada por quem levantou: o código é dele e o status
 *      é o que o código implica (T3). Nada a inferir.
 *   2. `HttpException` — a recusa nasceu FORA deste vocabulário. É o caminho de
 *      {@link recusaDeOutrem}.
 *   3. Qualquer outra coisa — exceção que ninguém previu é, por definição, falha do serviço.
 *
 * A exceção de origem viaja como `causa` — ela não entra no corpo da resposta (`paraCorpo()` monta
 * os quatro campos da ADR-0007 e nada mais), mas fica disponível para o registro estruturado.
 */
function traduzir(excecao: unknown): RespostaDeErro {
  if (excecao instanceof ErroDeAplicacao) {
    return { status: excecao.status, corpo: excecao.paraCorpo() };
  }

  if (excecao instanceof HttpException) {
    return recusaDeOutrem(excecao.getStatus(), excecao);
  }

  return doNossoCodigo(CodigoErro.ERRO_INTERNO, excecao);
}

/** Monta a resposta a partir de um código NOSSO — o status é o que o código implica (T3). */
function doNossoCodigo(codigo: CodigoErro, causa: unknown): RespostaDeErro {
  const erro = new ErroDeAplicacao(codigo, MENSAGEM_POR_CODIGO[codigo], { causa });
  return { status: erro.status, corpo: erro.paraCorpo() };
}

/**
 * Traduz a recusa levantada por um componente que não é deste vocabulário.
 *
 * O status conhecido segue pela tabela, que é a via precisa. O resto é
 * {@link recusaSemNomeNoVocabulario}.
 */
function recusaDeOutrem(statusDeOrigem: number, excecao: HttpException): RespostaDeErro {
  const codigo = CODIGO_POR_STATUS[statusDeOrigem];
  return codigo === undefined
    ? recusaSemNomeNoVocabulario(statusDeOrigem, excecao)
    : doNossoCodigo(codigo, excecao);
}

// DECISÃO FECHADA — T8 / Gate 2 (P1) · 2026-08-02
// O QUÊ: a classificação de status é fechada por FAIXA, e não por enumeração. Status de recusa
//        que a tabela não nomeia sai como {@link CodigoErro.REQUISICAO_RECUSADA} **com o status de
//        origem preservado** — nunca como `ERRO_INTERNO`, nunca como `500`, nunca em `logger.error`.
// POR QUÊ: a versão anterior derivava `CODIGO_POR_STATUS[status] ?? ERRO_INTERNO`, e a tabela
//          conhecia quatro status. TODA recusa de cliente emitida por um componente externo cujo
//          status não estivesse ali virava `500 ERRO_INTERNO` — e, porque o nível do registro é
//          derivado do status, virava também uma linha `error` afirmando "requisição encerrada por
//          falha do serviço". O produtor medido era o limitador nativo do arcabouço de identidade,
//          que sobe sozinho em produção e emite `429` (que a T6 da fatia
//          `autorizacao-e-ciclo-de-acesso` passou a ligar explicitamente, com política própria) —
//          mas o limitador era A OCORRÊNCIA, não a classe: a classe é
//          "todo status que o arcabouço venha a emitir e que ninguém tenha lembrado de tabelar", e
//          cada versão nova dele reabre a lista. Acrescentar `429` à tabela fecharia o caminho
//          apontado e deixaria a classe aberta — exatamente o laço longo que a §5 de
//          `.claude/rules/nao-regressao.md` descreve. Por faixa, não sobra caminho: `[400, 500)` é
//          recusa e sai como recusa; `>= 500` e o que não é status de erro são falha do serviço.
//          É por isso que nenhum status FUTURO volta a cair aqui — não existe status de recusa
//          fora de `[400, 500)`.
// REVERTER EXIGE: provar que a tabela de código por status é EXAUSTIVA sobre os status que todo
//                 componente externo montado sob a API pode emitir, hoje e nas versões seguintes
//                 dele. Enumerar os status de uma versão específica NÃO satisfaz: foi assim que o
//                 defeito nasceu.
//
// (Adjacente, e não parte da decisão.) O status de origem preservado é o único ponto do sistema em
// que a resposta NÃO usa o status que `STATUS_POR_CODIGO` associa ao código — e é deliberado: o
// código diz "isto é recusa e não sabemos nomear a causa"; o status é a informação PRECISA, e ela
// vem de quem recusou. Reclassificá-lo para o `400` padrão do código destruiria justamente o que a
// tradução existe para preservar (um `429` vira "tente de novo mais tarde"; um `400`, não).
//
// O "único ponto" acima só continua verdadeiro sob uma condição, e ela agora está fixada:
// **`REQUISICAO_RECUSADA` é código de FECHO deste filtro, não código de negócio levantável.**
// Ele é exportado no enum público de `@sysloc/shared`, e um `new ErroDeAplicacao(
// CodigoErro.REQUISICAO_RECUSADA, …)` numa fatia futura faria o MESMO código sair com `400` num
// ponto e `415`/`429` noutro — um cliente que combine `codigo` com semântica de repetição deixaria
// de conseguir decidir só pelo código. Quem precisar recusar por regra de negócio usa o código que
// nomeia a causa; se nenhum servir, o caminho é acrescentar valor ao enum, não reaproveitar este.
// **A rede automatizada foi avaliada no fechamento da F1 e RECUSADA — as duas formas possíveis, e
// por que cada uma é pior que a regra escrita acima:**
//
//   * **Impor pelo tipo** (`codigo: Exclude<CodigoErro, CodigoErro.REQUISICAO_RECUSADA>` no
//     construtor de `ErroDeAplicacao`) seria a forma estrutural, e é a que o invariante 1 do
//     `CLAUDE.md` prefere. Mas o `CT-005` de `packages/shared/test/erros.spec.ts` é
//     `it.each(Object.values(CodigoErro))` construindo TODO valor do enum para provar que cada um
//     tem status na faixa de erro — estreitar o construtor obrigaria a excluir um código daquela
//     tabela, isto é, a ENFRAQUECER uma prova tabular existente para instalar outra. A proibição 2
//     da `.claude/rules/nao-regressao.md` fecha esse caminho.
//   * **Varrer o fonte** reprovando `new ErroDeAplicacao(CodigoErro.REQUISICAO_RECUSADA` seria
//     asserção estática sobre texto, e o texto onde ela rodaria inclui ESTE comentário — que cita a
//     construção literalmente. Distinguir menção de construção exige remoção de comentário com
//     consciência de literal, que é exatamente o defeito D9 registrado noutro varredor deste
//     repositório. A `.claude/rules/testing-stack.md` já nomeia asserção estática frágil como a
//     causa de três das cinco reprovações da T2.
//
// Fica, portanto, a regra escrita — e o gatilho concreto: se algum dia um código de negócio
// precisar de status variável, é sinal de que o enum tem uma lacuna, e a resposta é o valor novo.
/**
 * A recusa cujo status o vocabulário não nomeia.
 *
 * @param statusDeOrigem status escolhido por quem recusou.
 */
function recusaSemNomeNoVocabulario(
  statusDeOrigem: number,
  excecao: HttpException,
): RespostaDeErro {
  const ehRecusaDeCliente =
    statusDeOrigem >= PRIMEIRO_STATUS_DE_RECUSA && statusDeOrigem < PRIMEIRO_STATUS_DE_SERVIDOR;

  if (!ehRecusaDeCliente) {
    // `>= 500` é falha do serviço mesmo quando vem de fora; abaixo de `400` não é erro nenhum, e
    // uma exceção carregando esse status é defeito NOSSO — os dois pertencem ao mesmo ramo.
    return doNossoCodigo(CodigoErro.ERRO_INTERNO, excecao);
  }

  const codigo = CodigoErro.REQUISICAO_RECUSADA;
  return {
    status: statusDeOrigem,
    corpo: { codigo, mensagem: MENSAGEM_POR_CODIGO[codigo] },
  };
}
