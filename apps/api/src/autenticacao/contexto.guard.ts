/**
 * A guarda de contexto — **o ponto exato em que o invariante 2 do `CLAUDE.md` se materializa**.
 *
 * ---------------------------------------------------------------------------
 * A empresa vem da SESSÃO, e de mais lugar nenhum (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * A ADR-0008 é literal: *"o contexto que a RLS consome é fixado por transação com `SET LOCAL`, e
 * sua origem **nunca é o request**"*. Aqui isso é propriedade de **construção**, não de disciplina:
 * o único valor de empresa que este arquivo conhece é o que sai de `identidade.usuario`, resolvido a
 * partir do identificador que a sessão autenticada carrega. Não existe leitura de parâmetro de
 * rota, de cadeia de consulta, de cabeçalho ou de campo de corpo — e não há como acrescentá-la sem
 * que o acréscimo apareça no diff deste arquivo.
 *
 * O que trafega na requisição é o **cookie de sessão**, que é credencial conferida pelo arcabouço
 * contra `identidade.sessao`, e não um identificador de empresa informado pelo cliente. A diferença
 * é a que a ADR nomeia: um valor forjado no cookie não vira contexto — vira ausência de sessão.
 *
 * ---------------------------------------------------------------------------
 * Duas metades, e por que a segunda EXISTE
 * ---------------------------------------------------------------------------
 *
 * Esta classe é **guarda e interceptador ao mesmo tempo**, registrada duas vezes na composição raiz
 * sobre a MESMA instância (`useExisting`). A repartição não é estilo:
 *
 *   * **`canActivate` decide.** Rota marcada `@RotaPublica()` passa direto; qualquer outra exige
 *     sessão válida, sob pena de `401` no envelope da ADR-0012. É aqui, e só aqui, que a sessão do
 *     produto é montada — uma vez por requisição.
 *   * **`intercept` publica.** `contextoDeTenant.executarCom` é `AsyncLocalStorage.run`, e `run`
 *     **envolve uma continuação**: o contexto vale para a cadeia assíncrona iniciada dentro do
 *     retorno de chamada e morre com ela. Uma guarda não tem continuação a envolver — ela devolve
 *     um booleano e o manipulador roda depois, fora de qualquer `run`. O interceptador tem: ele
 *     recebe o manipulador como observável **diferido** e decide quando assiná-lo.
 *
 * A alternativa idiomática seria `AsyncLocalStorage.enterWith` dentro da própria guarda, que
 * dispensaria a segunda metade. Ela foi **rejeitada**: `enterWith` muta o quadro de contexto
 * corrente em vez de criar um filho, e a garantia de que essa mutação não sobrevive à requisição
 * depende de detalhe de implementação do runtime — exatamente o tipo de garantia que o
 * `contexto.ts` da T3 diz existir para eliminar (*"o contexto vale para toda a cadeia assíncrona
 * iniciada aqui dentro e some quando ela termina, o que é o que impede uma requisição de herdar o
 * contexto de outra"*). Num sistema cujo isolamento entre empresas é a propriedade central, "quase
 * certamente não vaza" não é resposta. `executarCom` é o escritor que a T3 publicou, e é ele que
 * está aqui.
 *
 * ---------------------------------------------------------------------------
 * O repasse entre as duas metades NÃO é "ler o contexto do request"
 * ---------------------------------------------------------------------------
 *
 * A sessão resolvida é pendurada no objeto da requisição sob um símbolo privado deste módulo, e o
 * interceptador a lê de lá. Isso é **entrega interna de um valor que esta classe acabou de derivar
 * da sessão**, dentro de uma requisição — não entrada do cliente. O invariante 2 proíbe que a
 * empresa **venha** do pedido; ele não proíbe que o objeto de pedido carregue, por um instante,
 * aquilo que o servidor já decidiu. A chave é um `Symbol` de módulo justamente para que nada de
 * fora — nem um corpo JSON, nem um cabeçalho — consiga escrevê-la.
 *
 * ---------------------------------------------------------------------------
 * O Sysloc Master não tem ramo próprio — e é isso que se prova
 * ---------------------------------------------------------------------------
 *
 * Para o Master, `empresaId` é nulo em `identidade.usuario` (restrição
 * `usuario_master_sem_empresa_chk`), e o nulo atravessa daqui até `SET LOCAL app.empresa_id = ''`
 * sem passar por condicional nenhum. Não existe, em lugar algum deste arquivo, um `if (perfil ===
 * 'SYSLOC_MASTER')`: quem devolve vazio é a política do banco, porque contexto sem empresa não casa
 * política alguma. Um ramo aqui seria a forma mais barata de transformar isso numa decisão de
 * aplicação — e é justamente o defeito que o CT-020 persegue.
 *
 * ---------------------------------------------------------------------------
 * Por que a identidade é LIDA, e por que a consulta NÃO mora neste arquivo
 * ---------------------------------------------------------------------------
 *
 * `perfil` e `empresa_id` são colunas do **produto**, não campos do modelo `user` do arcabouço — o
 * débito **D7**, cujo marcador vive em `packages/auth/src/autenticacao.ts`, registra por que
 * declará-los como campos adicionais é decisão da fatia seguinte, e por que abri-los à escrita
 * seria fuga de tenant. A consequência prática é que a sessão devolvida pelo arcabouço **não**
 * carrega a empresa, e a única fonte dela é a linha de `identidade.usuario` que a sessão aponta.
 *
 * Essa leitura acontece pelo acesso restrito a `identidade` que a ADR-0009 autoriza — uma consulta
 * por chave primária, indexada, por requisição autenticada —, mas **a consulta em si vive em
 * `@sysloc/auth`** (`carregarPessoaDaSessao`), e não aqui. A Revisão Técnica da T9 rejeitou a forma
 * anterior, em que ela estava escrita neste arquivo: eram duas leituras da mesma linha, em pacotes
 * diferentes, iguais na intenção e livres para divergir em critério, `JOIN` e limite — e, para
 * escrevê-la, `apps/api` passava a conhecer `esquemaIdentidade` e o construtor de consulta do ORM,
 * o que deixava **qualquer** arquivo desta aplicação a uma linha de ler `identidade`. A contenção
 * que a §11.2 da tech spec exige na ausência de RLS naquele schema — *"nenhuma rota expõe
 * identidade além da própria sessão de quem pede"* — só é estrutural enquanto a leitura for uma só
 * e viver do outro lado da fronteira do pacote. Este arquivo consome a leitura publicada; ele não
 * sabe montar outra.
 *
 * ---------------------------------------------------------------------------
 * O alcance da sessão restrita é CONSULTADO aqui, e decidido em outro lugar
 * ---------------------------------------------------------------------------
 *
 * A sessão do produto já carrega as duas exigências que podem estar pendentes (`senhaProvisoria` e
 * `segundoFatorPendente`), porque `GET /v1/sessao` precisa reportá-las. **Quem elas impedem de
 * alcançar o quê é decisão de `sessao-restrita.ts`** (T10), e esta guarda a **consulta** — em
 * {@link admitir}, com a sessão já resolvida e **antes** de a requisição prosseguir. A regra não é
 * reescrita aqui: uma segunda definição de "o que a sessão restrita permite", dentro do ponto onde
 * ela é aplicada, é exatamente a topologia que a §5 de `.claude/rules/nao-regressao.md` nomeia — a
 * propriedade instalada por ponto sobrevive só até o ponto seguinte.
 *
 * O `403` `ACESSO_NEGADO` sai daqui com a mensagem que aquele módulo compôs, e é ela que *"nomeia a
 * exigência pendente"* (§10.1 da tech spec). A mensagem fixa de `MENSAGEM_POR_CODIGO` para esse
 * código continua sendo o **padrão do filtro global**, para quem levantá-lo sem mensagem própria.
 *
 * ---------------------------------------------------------------------------
 * A AUTORIZAÇÃO é consultada aqui, e decidida em outro lugar (ADR-0010, ADR-0011)
 * ---------------------------------------------------------------------------
 *
 * A T4 da fatia `autorizacao-e-ciclo-de-acesso` acrescenta o **ponto de aplicação único** da
 * autorização, e ele obedece exatamente ao parágrafo acima: a regra não é reescrita aqui. Quem
 * decide é `decidirAcesso` (`@sysloc/auth`), consultado como `sessaoRestritaPermite` já é. Uma
 * segunda avaliação em qualquer manipulador seria a topologia que a §5 de
 * `.claude/rules/nao-regressao.md` nomeia — e o **CT-216** a reprova por varredura de fontes,
 * afirmando que este é o **único** arquivo de `apps/api/src` que consome o símbolo de decisão.
 *
 * A ordem dos passos é a da **§5.1 da tech spec**, e ela é observável:
 *
 *   1. **exigência declarada** — lida por reflexão, sem tocar banco nem arcabouço. **Ausente
 *      recusa** (ADR-0011): rota que não declara nada não atende ninguém, e o esquecimento produz
 *      `403` em vez de superfície aberta. É o primeiro passo porque é o mais barato e porque a rota
 *      sem declaração está quebrada independentemente de quem a chama;
 *   2. **sessão válida** — `401`, como antes;
 *   3. **versão de permissão** — o contador corrente chega na leitura de identidade que já
 *      acontece, e é comparado com o retrato gravado no registro de sessão;
 *   4. **divergiu: relê, reescreve e ATENDE** — a ADR-0010 é literal sobre isto (*"o servidor relê o
 *      efetivo e atende — em vez de recusar"*), e rejeita por escrito as duas alternativas: recusar
 *      a requisição transferiria ao cliente um retry que o servidor resolve sozinho, e encerrar a
 *      sessão apagaria a distinção entre **mudar permissão** e **revogar acesso**, que esta
 *      arquitetura separa deliberadamente;
 *   5. **alcance da sessão restrita** — inalterado;
 *   6. **decisão de autorização** — `403 ACESSO_NEGADO` com `detalhes.exigido`, que é o que a RN-14
 *      exige: a recusa **nomeia** o que faltou, distinguindo as duas dimensões pelo próprio valor;
 *   7. **pendurar** — e só então, pela razão do bloco anterior.
 *
 * ---------------------------------------------------------------------------
 * A reescrita do registro de sessão é a ÚNICA escrita no caminho de leitura
 * ---------------------------------------------------------------------------
 *
 * E ela acontece por **mudança**, não por requisição: só quando a versão diverge. O CT-219 prova os
 * dois lados — que a divergência reescreve as três colunas, e que as requisições seguintes, sem
 * mudança, não as tocam. Reescrever a cada requisição passaria nos casos positivos e transformaria
 * toda leitura autenticada numa escrita, que é o custo que a ADR-0010 evita ao guardar o efetivo na
 * sessão em primeiro lugar.
 *
 * A releitura dos ajustes corre **sob o contexto de tenant** (`executarCom` + unidade de trabalho),
 * e não com um filtro por empresa escrito aqui: o escopo é a política do banco (ADR-0008). Para o
 * Master, `empresaId` é nulo e o contexto vazio não casa política alguma — a leitura devolve vazio,
 * pelo mesmo caminho de todo mundo, **sem ramo condicional por perfil**. Some-se que a matriz dele é
 * vazia, de modo que ele atravessa apenas pela dimensão de perfil. Continua valendo, portanto, o que
 * o bloco do Sysloc Master acima afirma: não existe, em lugar algum deste arquivo, um
 * `if (perfil === 'SYSLOC_MASTER')`.
 *
 * ---------------------------------------------------------------------------
 * O que esta task NÃO decide (2): a REVOGAÇÃO de sessão já emitida
 * ---------------------------------------------------------------------------
 *
 * A barreira de admissão (`@sysloc/auth`) corre **no login**, e é lá que `ativo`, `bloqueadoAte`,
 * `tentativasFalhas` e `empresaSuspensaEm` recusam. Esta guarda **não os reavalia por requisição**:
 * pessoa desativada, conta bloqueada ou empresa suspensa **depois** da entrada mantêm a sessão de
 * pé até ela vencer. A janela é o vencimento da sessão — `DURACAO_DA_SESSAO_EM_SEGUNDOS` são 8 h,
 * mas **renovadas por atividade**, de modo que quem segue usando o sistema não a alcança. Isso é
 * **escopo declarado** da fatia `autorizacao-e-ciclo-de-acesso` (*"invalidação de sessão por
 * evento"*), não lacuna desta.
 *
 * Os quatro campos chegam aqui mesmo assim, e é deliberado: {@link SessaoDoProduto} monta
 * `segundoFatorPendente` chamando o predicado da barreira, que é declarado sobre
 * `EstadoDeAdmissao` inteiro — a leitura os carrega porque o **tipo** os exige, e é essa obrigação
 * que faz um dado novo da decisão de admissão passar a obrigar a leitura a trazê-lo, sob pena de
 * não compilar. **Removê-los por parecerem sem uso quebra essa obrigação**; e avaliá-los aqui
 * criaria uma segunda definição de recusa ao lado da barreira, livre para divergir dela — os dois
 * caminhos que a fatia seguinte precisa encontrar fechados.
 */

import {
  type CallHandler,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  type Autenticacao,
  type ChaveDeAcao,
  type ChaveDeTela,
  calcularEfetivo,
  carregarPessoaDaSessao,
  carregarRetratoDaSessao,
  decidirAcesso,
  type EfetivoDaSessao,
  type Exigencia,
  ehChaveDoCatalogo,
  type Perfil,
  type PessoaDaSessao,
  regravarEfetivoDaSessao,
  segundoFatorExigido,
} from '@sysloc/auth';
import {
  type AcessoAIdentidade,
  type AcessoAoBanco,
  contextoDeTenant,
  lerAjustesDaPessoa,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { Observable, type Subscription } from 'rxjs';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import {
  TOKEN_ACESSO_A_IDENTIDADE,
  TOKEN_ACESSO_AO_NEGOCIO,
  TOKEN_AUTENTICACAO,
  TOKEN_LOGGER,
} from '../configuracao/ambiente.js';
import { EXIGENCIA } from './exigencia.decorator.js';
import { ROTA_PUBLICA } from './rota-publica.decorator.js';
import { sessaoRestritaPermite } from './sessao-restrita.js';

/**
 * Mensagem pública da recusa por falta de sessão.
 *
 * **Lida da tabela, e não escrita aqui.** Os produtores da recusa são dois — a guarda, que levanta
 * o código com mensagem, e o filtro global, para quem levantar o código sem ela —, e a resposta do
 * cliente não pode depender de qual caminho a produziu. Enquanto o literal estava escrito nos dois
 * lugares, "elas precisam coincidir" era um comentário; agora é uma consequência de só existir uma.
 * A tabela é a fonte porque é ela que a ADR-0012 governa: o corpo de erro sai dali em todo caminho
 * que não passa por aqui.
 */
const MENSAGEM_SEM_SESSAO = MENSAGEM_POR_CODIGO[CodigoErro.NAO_AUTENTICADO];

/**
 * Mensagem pública da recusa por falta de permissão.
 *
 * É a **canônica do código**, lida da mesma tabela pela mesma razão da constante acima — a §10.1 da
 * tech spec fixa *"canônica + `detalhes.exigido`"*. O que nomeia a exigência é o campo estruturado,
 * e não a prosa: um cliente que precisasse extrair a chave do texto voltaria a classificar erro por
 * prefixo de mensagem, que é exatamente o que a ADR-0012 aposentou.
 */
const MENSAGEM_SEM_PERMISSAO = MENSAGEM_POR_CODIGO[CodigoErro.ACESSO_NEGADO];

/**
 * Recusa da rota que **não declara exigência alguma** (ADR-0011).
 *
 * Ela é distinta da mensagem acima de propósito: a recusa por falta de permissão é sobre **quem
 * pede**, e esta é sobre **a rota**. Quem a receber está diante de um defeito de publicação, não de
 * uma permissão que lhe falta — e nenhuma concessão do Admin a resolveria. Não há `detalhes.exigido`
 * aqui: não há exigência a nomear, e inventar uma diria ao cliente que existe uma chave que o
 * liberaria.
 *
 * O código continua sendo `ACESSO_NEGADO`: a ADR-0012 fixa que **nenhum código novo entra no enum**,
 * porque cada um é superfície versionada.
 */
const MENSAGEM_SEM_DECLARACAO = 'acesso negado: a rota não declara exigência de autorização';

/**
 * Onde a sessão resolvida viaja entre `canActivate` e `intercept`.
 *
 * `Symbol` de módulo: a chave não é enumerável por nome, não colide com propriedade do adaptador
 * HTTP e — o que importa — **não é escrevível de fora**. Nenhum corpo, cabeçalho ou parâmetro
 * alcança este slot; só esta classe escreve nele.
 */
const CHAVE_DA_SESSAO = Symbol('SessaoDoProduto');

/**
 * A sessão corrente **no modelo de domínio do produto** (§4.2 da tech spec).
 *
 * camelCase e português, sem o vocabulário do arcabouço: é este objeto que `GET /v1/sessao`
 * devolve, campo a campo, e é ele que o frontend consome (invariante 6 do `CLAUDE.md`).
 *
 * `empresaId` e `empresaNome` são nulos **apenas** para o Sysloc Master — a restrição
 * `usuario_master_sem_empresa_chk` do schema torna a recíproca impossível, de modo que "nulo"
 * identifica o Master sem que perfil nenhum precise ser comparado.
 *
 * **São ONZE campos**, e a contagem é afirmada por igualdade no CT-220: os oito da fatia anterior
 * mais o efetivo repartido nos dois eixos e a versão que o datou. Os três últimos chegaram com a
 * fatia `autorizacao-e-ciclo-de-acesso` (CA-19), e existem para o cliente desenhar o menu sem uma
 * segunda chamada — que é metade da razão pela qual a ADR-0010 põe o efetivo na sessão.
 *
 * Este objeto é devolvido **campo a campo** por `GET /v1/sessao`, sem projeção intermediária: um
 * campo interno acrescentado aqui vaza para o contrato publicado. Ele é, portanto, exatamente a
 * superfície da rota, e nada além dela.
 */
export interface SessaoDoProduto {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: Perfil;
  readonly empresaId: string | null;
  readonly empresaNome: string | null;
  /** A senha ainda é a provisória: a sessão entra restrita até a troca (RN-09). */
  readonly senhaProvisoria: boolean;
  /** O segundo fator é exigido desta pessoa e ainda não está ativo (RN-08). */
  readonly segundoFatorPendente: boolean;
  /** As áreas de tela que esta sessão alcança — o efetivo, já repartido (RN-01). */
  readonly telas: readonly ChaveDeTela[];
  /** As ações sensíveis que esta sessão alcança. */
  readonly acoes: readonly ChaveDeAcao[];
  /**
   * A versão de permissão que datou o efetivo acima.
   *
   * Publicada porque o cliente precisa distinguir "o menu mudou" de "a resposta veio de um cache":
   * ela é o mesmo contador que a guarda compara a cada requisição, e é o único campo desta sessão
   * que muda sem que a pessoa faça nada.
   */
  readonly versaoPermissoes: number;
}

/**
 * A sessão que a guarda resolveu para esta requisição.
 *
 * Só é chamável de dentro de uma rota protegida — em rota pública nada foi pendurado, e a ausência
 * é tratada como defeito de composição, não como "sem sessão": a rota que chega aqui sem sessão foi
 * publicada sem a guarda, e responder `401` esconderia isso. A postura é a do resto da fatia: na
 * dúvida, recusa, e a recusa nomeia o que aconteceu no registro (o filtro global grava a exceção
 * por campo nomeado).
 */
export function sessaoDaRequisicao(requisicao: FastifyRequest): SessaoDoProduto {
  const sessao = Reflect.get(requisicao, CHAVE_DA_SESSAO) as SessaoDoProduto | undefined;

  if (sessao === undefined) {
    throw new ErroDeAplicacao(
      CodigoErro.ERRO_INTERNO,
      'rota que consome a sessão corrente foi publicada fora do alcance da guarda de contexto',
    );
  }

  return sessao;
}

@Injectable()
export class GuardaDeContexto implements CanActivate, NestInterceptor {
  constructor(
    // `@Inject` explícito também aqui: este projeto não emite metadado de decorador (o
    // `tsconfig.base.json` o mantém desligado, e o transformador da verificação o acompanha), de
    // modo que o tipo do parâmetro NÃO chega ao arcabouço em tempo de execução. Sem o token
    // explícito, a injeção falha na montagem — é o mesmo motivo pelo qual `SaudeController` anota
    // `@Inject(SaudeService)`.
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao,
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
    // A releitura do efetivo precisa de `negocio` sob o contexto de tenant, e a unidade de trabalho
    // é a única porta para lá (ADR-0008). Este token e o de identidade **saem** no `exports` do
    // módulo desde a T7 — e a razão por extenso mora lá, no bloco de `exports` de
    // `autenticacao.module.ts`, que é onde a decisão foi tomada. O que muda com o export é o
    // SUSTENTÁCULO da contenção, não a contenção: a instância continua única por token, e o alcance
    // a `negocio` e a `identidade` segue enumerável porque o consumidor **repassa o executor sem
    // escrever consulta** — verificável, e não declarado.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly negocio: AcessoAoBanco,
    // A §10.3 da tech spec exige que a recusa de autorização seja registrada em `warn` com a
    // exigência que faltou e o identificador da pessoa — dado que o filtro global não tem, porque
    // ele só vê a exceção. O efetivo INTEIRO fica de fora do registro, também por decisão da §10.3:
    // ruído e superfície de vazamento sem ganho diagnóstico.
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Decide se a requisição prossegue, e resolve a sessão do produto quando ela prossegue.
   *
   * O retorno é síncrono para rota pública de propósito: a marca é lida do metadado, sem tocar
   * banco nem arcabouço, e é o caminho da entrada — que acontece antes de existir sessão.
   */
  canActivate(contexto: ExecutionContext): boolean | Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    return publica === true ? true : this.admitir(contexto);
  }

  /**
   * Envolve o manipulador no contexto de tenant da sessão — a outra metade, e a razão dela está no
   * cabeçalho deste arquivo.
   *
   * O observável é construído à mão, e não devolvido direto de `proximo.handle()`, porque o
   * manipulador do arcabouço é **diferido**: ele só roda quando alguém assina. Devolver
   * `executarCom(contexto, () => proximo.handle())` publicaria o contexto durante a montagem do
   * observável e o descartaria antes de a assinatura acontecer — o manipulador rodaria fora dele, e
   * a unidade de trabalho leria contexto ausente. Assinar **de dentro** do `executarCom` é o que faz
   * a execução do manipulador, e toda a cadeia assíncrona dela, herdarem o contexto.
   *
   * Rota pública não publica contexto algum: `corrente()` fica indefinido e a unidade de trabalho o
   * resolve como leitura vazia, pelo mesmo caminho do Sysloc Master — sem ramo condicional.
   */
  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const requisicao = contexto.switchToHttp().getRequest<FastifyRequest>();
    const sessao = Reflect.get(requisicao, CHAVE_DA_SESSAO) as SessaoDoProduto | undefined;

    if (sessao === undefined) {
      return proximo.handle();
    }

    return new Observable<unknown>((assinante) => {
      let inscricao: Subscription | undefined;
      contextoDeTenant.executarCom({ empresaId: sessao.empresaId }, () => {
        inscricao = proximo.handle().subscribe(assinante);
      });
      return () => inscricao?.unsubscribe();
    });
  }

  /**
   * Aplica a exigência da rota, exige sessão válida, confere o alcance dela e monta a sessão do
   * produto.
   *
   * A ordem dos passos é o que importa, e ela é observável — a listagem por extenso, com a razão de
   * cada posição, está no cabeçalho deste arquivo (§5.1 da tech spec). Em resumo:
   *
   *   1. **exigência declarada** — ausente, `403`, antes de qualquer I/O. Rota que não declara nada
   *      é recusada (ADR-0011), e recusá-la aqui é o que faz o esquecimento ser barulhento.
   *   2. **resolver** — sem sessão válida a resposta é `401`, e a exigência pendente nem é
   *      consultada: quem não entrou não tem exigência a cumprir.
   *   3. **conferir o alcance** — `sessaoRestritaPermite()` decide, e a recusa é `403`
   *      `ACESSO_NEGADO` com a mensagem que **nomeia a exigência pendente** (§10.1). O par de
   *      status é o da ADR-0012: `401` é *"quem é você?"*, `403` é *"você é quem diz e ainda não
   *      alcança isto"*.
   *   4. **decidir a autorização** — `decidirAcesso()` decide, e a recusa nomeia o que faltou em
   *      `detalhes.exigido` (RN-14). Ela vem **depois** do alcance da sessão restrita porque uma
   *      exigência pendente é mais fundamental que uma permissão: quem ainda deve trocar a senha
   *      provisória não deve descobrir, primeiro, que também lhe falta uma chave.
   *   5. **pendurar** — e só então, porque a sessão pendurada é o que o interceptador usa para
   *      publicar o contexto de tenant. Recusar **antes** de pendurar é o que garante que nenhuma
   *      requisição recusada abra unidade de trabalho com contexto: o `intercept` encontra o slot
   *      vazio e não chama `executarCom`.
   */
  private async admitir(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<FastifyRequest>();

    // O padrão da rota casada, e não o alvo bruto: é o mesmo valor que o filtro global grava no
    // journal, já sem cadeia de consulta. Ausência é tratada como rota desconhecida — e rota
    // desconhecida não está no conjunto permitido, de modo que a sessão restrita é recusada em vez
    // de liberada por falta de informação.
    const rota = requisicao.routeOptions?.url ?? '';

    // `getAllAndOverride`, como a marca de rota pública: a declaração no método vence a da classe,
    // e a granularidade fica com quem publica a rota. `undefined` é a AUSÊNCIA de declaração — e é
    // ela, e não um valor, que a ADR-0011 manda recusar.
    const exigencia = this.reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (exigencia === undefined) {
      this.logger.warn({ rota }, 'rota governada pela guarda não declara exigência de autorização');
      throw new ErroDeAplicacao(CodigoErro.ACESSO_NEGADO, MENSAGEM_SEM_DECLARACAO);
    }

    const sessao = await this.resolverSessao(requisicao);

    const alcance = sessaoRestritaPermite(sessao, rota);

    if (!alcance.permite) {
      throw new ErroDeAplicacao(CodigoErro.ACESSO_NEGADO, alcance.mensagem);
    }

    // A REGRA NÃO É REESCRITA AQUI. `decidirAcesso` decide; esta linha aplica. Ver o cabeçalho —
    // e o CT-216, que afirma por varredura de fontes que este é o único ponto de `apps/api/src` que
    // consome o símbolo.
    const decisao = decidirAcesso(exigencia, sessao);

    if (!decisao.alcanca) {
      this.logger.warn(
        {
          rota,
          exigido: decisao.exigido,
          usuarioId: sessao.usuarioId,
          empresaId: sessao.empresaId,
        },
        'acesso negado: a sessão não alcança a exigência declarada pela rota',
      );
      throw new ErroDeAplicacao(CodigoErro.ACESSO_NEGADO, MENSAGEM_SEM_PERMISSAO, {
        detalhes: { exigido: decisao.exigido },
      });
    }

    Reflect.set(requisicao, CHAVE_DA_SESSAO, sessao);
    return true;
  }

  /**
   * Confere a credencial de sessão e resolve a pessoa por trás dela.
   *
   * Duas recusas, e as duas com o MESMO código e a MESMA mensagem: sessão que o arcabouço não
   * reconhece (ausente, encerrada ou vencida) e sessão cuja pessoa não é mais resolvível. Distingui-
   * las diria ao cliente que aquele token um dia existiu, que é a mesma indistinguibilidade que a
   * RN-10 exige da entrada.
   */
  private async resolverSessao(requisicao: FastifyRequest): Promise<SessaoDoProduto> {
    const autenticada = await this.autenticacao.api.getSession({
      headers: cabecalhosDe(requisicao),
    });

    if (autenticada === null) {
      throw new ErroDeAplicacao(CodigoErro.NAO_AUTENTICADO, MENSAGEM_SEM_SESSAO);
    }

    // A leitura de `identidade` é a que `@sysloc/auth` publica — ver o cabeçalho deste arquivo. Ela
    // traz `versaoPermissoes` na MESMA consulta por chave primária: o contador é coluna daquela
    // linha, e uma segunda leitura seria a forma que a Revisão Técnica da T9 rejeitou.
    const pessoa = await carregarPessoaDaSessao(this.acesso.identidade, autenticada.user.id);

    if (pessoa === undefined) {
      throw new ErroDeAplicacao(CodigoErro.NAO_AUTENTICADO, MENSAGEM_SEM_SESSAO);
    }

    const efetivo = await this.efetivoCorrente(pessoa, autenticada.session.id);

    return {
      usuarioId: pessoa.usuarioId,
      nome: pessoa.nome,
      email: pessoa.email,
      perfil: pessoa.perfil,
      empresaId: pessoa.empresaId,
      empresaNome: pessoa.empresaNome,
      senhaProvisoria: pessoa.senhaProvisoria,
      // O predicado vem da BARREIRA (`@sysloc/auth`), e não é reescrito aqui: ele já responde por
      // "o segundo fator é exigido desta pessoa e ainda não está ativo" (RN-08) desde a T7, e uma
      // segunda comparação escrita neste arquivo seria uma segunda definição da mesma regra, livre
      // para divergir daquela que decide a admissão da sessão.
      segundoFatorPendente: segundoFatorExigido(pessoa),
      telas: efetivo.telas,
      acoes: efetivo.acoes,
      versaoPermissoes: efetivo.versaoPermissoes,
    };
  }

  /**
   * O efetivo desta sessão, **revalidado por versão** (ADR-0010).
   *
   * O caso comum é o retrato gravado no registro de sessão estar em dia, e então nada é lido de
   * `negocio` e **nada é escrito**: a leitura por requisição é a comparação de um inteiro, que é
   * exatamente a economia que a ADR-0010 compra ao pôr o efetivo na sessão.
   *
   * Recalcula em três casos, e os três são "não há retrato confiável a servir":
   *
   *   * **o contador da pessoa mudou** — alguém ajustou permissão ou trocou o perfil dela. É o caso
   *     da ADR-0010, e é o do CT-217 e do CT-218;
   *   * **o retrato ainda não foi montado** — a linha de sessão nasce com as três colunas no padrão
   *     do schema, porque quem a cria é o arcabouço de identidade, que não as conhece. O docblock
   *     de `RetratoDaSessao` explica por que isso NÃO pode ser lido como "efetivo vazio";
   *   * **a sessão não foi encontrada** — sumiu entre a conferência do arcabouço e esta leitura.
   *
   * **Divergiu, atende.** Não recusa e não desconecta: a ADR-0010 rejeita as duas alternativas por
   * escrito, e o CT-217 afirma que a pessoa segue operando o que ainda alcança, com a sessão de pé.
   */
  private async efetivoCorrente(
    pessoa: PessoaDaSessao,
    sessaoId: string,
  ): Promise<EfetivoDaSessao> {
    const retrato = await carregarRetratoDaSessao(this.acesso.identidade, sessaoId);

    if (retrato?.montado === true && retrato.efetivo.versaoPermissoes === pessoa.versaoPermissoes) {
      return retrato.efetivo;
    }

    return await this.recalcularEfetivo(pessoa, sessaoId, retrato?.efetivo);
  }

  /**
   * Relê os ajustes sob o contexto de tenant, recalcula o efetivo e reescreve o registro de sessão.
   *
   * **Sem filtro por empresa escrito aqui** (ADR-0008): o escopo é a política do banco, e o que a
   * estabelece é o `executarCom` mais o `SET LOCAL` que a unidade de trabalho emite. Para o Master,
   * `empresaId` é nulo, a política não casa nada e a leitura volta vazia — pelo mesmo caminho de
   * todo mundo, sem condicional por perfil.
   *
   * O predicado do catálogo entra por parâmetro em `lerAjustesDaPessoa` por **inversão de
   * dependência**: `@sysloc/auth` depende de `@sysloc/db`, e o inverso fecharia ciclo entre os
   * pacotes. Quem compõe as duas camadas é esta borda.
   */
  private async recalcularEfetivo(
    pessoa: PessoaDaSessao,
    sessaoId: string,
    gravado: EfetivoDaSessao | undefined,
  ): Promise<EfetivoDaSessao> {
    const { ajustes, chavesDesconhecidas } = await contextoDeTenant.executarCom(
      { empresaId: pessoa.empresaId },
      async () =>
        await this.negocio.emUnidadeDeTrabalho(
          async (tx) => await lerAjustesDaPessoa(tx, pessoa.usuarioId, ehChaveDoCatalogo),
        ),
    );

    // `@sysloc/db` devolve as chaves órfãs em vez de registrá-las — ele não tem registrador, por
    // decisão, e a obrigação de tornar o descarte observável é da borda. Este é o ÚNICO lugar em que
    // uma chave gravada quando o catálogo a tinha, e removida dele depois, fica visível: sem esta
    // linha, uma migração incompleta sumiria sem rastro.
    if (chavesDesconhecidas.length > 0) {
      this.logger.warn(
        {
          usuarioId: pessoa.usuarioId,
          empresaId: pessoa.empresaId,
          chavesDesconhecidas,
        },
        'ajustes de permissão fora do catálogo corrente foram descartados no cálculo do efetivo',
      );
    }

    return await regravarEfetivoDaSessao(this.acesso.identidade, sessaoId, {
      // A precedência da negação é de `calcularEfetivo` (ADR-0010, RN-01), e não é reescrita aqui:
      // uma segunda aritmética nesta borda ficaria livre para divergir da que o CT-203 prova.
      efetivo: calcularEfetivo(pessoa.perfil, ajustes),
      versaoPermissoes: pessoa.versaoPermissoes,
      // O que a leitura encontrou, para que um recálculo que chegue ao MESMO retrato não vire uma
      // escrita. É o que faz "requisição sem mudança não altera as colunas" valer também no caminho
      // em que o retrato não estava montado (CT-219, companheiro negativo).
      gravado,
    });
  }
}

/**
 * Converte os cabeçalhos do adaptador HTTP na forma que o arcabouço de identidade consome.
 *
 * Valor repetido é **anexado**, e não sobrescrito: `cookie` pode chegar em mais de uma linha, e
 * ficar com a última perderia justamente a credencial de sessão quando o cliente enviar outros
 * cookies antes dela.
 *
 * **Exportada a partir da T9 da fatia `autorizacao-e-ciclo-de-acesso`**, e não copiada para lá:
 * `senha.controller.ts` precisa falar com o arcabouço pela mesma requisição (`changePassword` e
 * `revokeOtherSessions` resolvem a sessão pelos cabeçalhos), e uma segunda conversão escrita naquele
 * arquivo estaria livre para divergir desta — o modo de falha seria a rota do produto enxergar uma
 * sessão diferente da que a guarda resolveu, no mesmo pedido.
 */
export function cabecalhosDe(requisicao: FastifyRequest): Headers {
  const cabecalhos = new Headers();

  for (const [nome, valor] of Object.entries(requisicao.headers)) {
    if (valor === undefined) {
      continue;
    }
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      cabecalhos.append(nome, item);
    }
  }

  return cabecalhos;
}
