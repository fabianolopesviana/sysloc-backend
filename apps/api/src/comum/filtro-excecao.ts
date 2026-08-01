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
 * Toda exceção é normalizada em `ErroDeAplicacao` antes de virar resposta
 * ---------------------------------------------------------------------------
 *
 * `ErroDeAplicacao` (T3) já é dona da decisão "qual código implica qual status", e o status não é
 * parâmetro dela. Normalizar tudo para esse tipo — em vez de manter aqui uma segunda tabela de
 * status — garante que **o status da resposta é sempre o que o código implica**, e que uma classe
 * nova de erro não possa responder um par (status, código) incoerente com o resto do sistema.
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
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { TOKEN_LOGGER } from '../configuracao/ambiente.js';

/**
 * Código do enum fechado por status HTTP que o arcabouço levanta por conta própria.
 *
 * Só entram os status que esta fatia é capaz de produzir — o `404` de rota não mapeada e o `400`
 * de requisição malformada —, e a tabela tem exatamente essas duas entradas. Antecipar status sem
 * produtor seria pior que omissão: `ErroDeAplicacao` deriva o status DO CÓDIGO, então uma entrada
 * como `422 → CAMPO_INVALIDO` responderia `400` a um `422`, trocando em silêncio o status que o
 * arcabouço escolheu. Status fora da tabela cai em {@link CodigoErro.ERRO_INTERNO} e, portanto, em
 * `500`: responder um status cujo código não sabemos nomear quebraria a classificação por `codigo`
 * que a ADR-0007 comprou. O registro em nível de erro deixa a omissão visível no journal em vez de
 * silenciosa na resposta. Quem levantar um status novo acrescenta a linha junto com o produtor.
 */
const CODIGO_POR_STATUS: Readonly<Record<number, CodigoErro>> = {
  400: CodigoErro.CAMPO_INVALIDO,
  404: CodigoErro.RECURSO_NAO_ENCONTRADO,
};

/**
 * Mensagem pública por código. `Record<CodigoErro, string>` faz o compilador exigir uma entrada
 * por código: acrescentar valor ao enum sem mensagem **não compila**.
 */
const MENSAGEM_POR_CODIGO: Readonly<Record<CodigoErro, string>> = {
  [CodigoErro.CAMPO_INVALIDO]: 'requisição inválida',
  [CodigoErro.RECURSO_NAO_ENCONTRADO]: 'recurso não encontrado',
  [CodigoErro.ERRO_INTERNO]: 'erro interno no processamento da requisição',
  [CodigoErro.SERVICO_INDISPONIVEL]: 'serviço temporariamente indisponível',
};

/** Menor status que caracteriza falha do servidor — acima dele o registro sobe para `error`. */
const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

@Catch()
export class FiltroExcecaoGlobal implements ExceptionFilter {
  constructor(@Inject(TOKEN_LOGGER) private readonly logger: Logger) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const requisicao = contexto.getRequest<FastifyRequest>();
    const resposta = contexto.getResponse<FastifyReply>();
    const erro = normalizar(excecao);

    // O identificador de correlação é o que o adaptador HTTP já atribui a cada requisição: é ele
    // que liga esta linha do journal à requisição que o cliente fez. A exceção de origem vai por
    // campo nomeado (`erro`), e não interpolada na mensagem — é a convenção que T3 fixou, e é o
    // que faz a redação de segredo alcançá-la.
    const evento = {
      erro: excecao,
      codigo: erro.codigo,
      status: erro.status,
      metodo: requisicao.method,
      caminho: caminhoSemConsulta(requisicao),
      idCorrelacao: requisicao.id,
    };
    if (erro.status >= PRIMEIRO_STATUS_DE_SERVIDOR) {
      this.logger.error(evento, 'requisição encerrada por falha do serviço');
    } else {
      this.logger.warn(evento, 'requisição recusada');
    }

    resposta.status(erro.status).send(erro.paraCorpo());
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
 */
function caminhoSemConsulta(requisicao: FastifyRequest): string {
  const inicioDaConsulta = requisicao.url.indexOf('?');
  return (
    requisicao.routeOptions?.url ??
    (inicioDaConsulta === -1 ? requisicao.url : requisicao.url.slice(0, inicioDaConsulta))
  );
}

/**
 * Converte qualquer exceção no tipo que carrega a decisão de erro do projeto.
 *
 * A exceção de origem viaja como `causa` — ela não entra no corpo da resposta (`paraCorpo()` monta
 * os quatro campos da ADR-0007 e nada mais), mas fica disponível para o registro estruturado.
 */
function normalizar(excecao: unknown): ErroDeAplicacao {
  if (excecao instanceof ErroDeAplicacao) {
    return excecao;
  }

  const codigo =
    excecao instanceof HttpException
      ? (CODIGO_POR_STATUS[excecao.getStatus()] ?? CodigoErro.ERRO_INTERNO)
      : CodigoErro.ERRO_INTERNO;

  return new ErroDeAplicacao(codigo, MENSAGEM_POR_CODIGO[codigo], { causa: excecao });
}
