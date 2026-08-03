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
 *     sessão válida, sob pena de `401` no envelope da ADR-0007. É aqui, e só aqui, que a sessão do
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
  carregarPessoaDaSessao,
  type Perfil,
  segundoFatorExigido,
} from '@sysloc/auth';
import { type AcessoAIdentidade, contextoDeTenant } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { Observable, type Subscription } from 'rxjs';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_ACESSO_A_IDENTIDADE, TOKEN_AUTENTICACAO } from '../configuracao/ambiente.js';
import { ROTA_PUBLICA } from './rota-publica.decorator.js';
import { sessaoRestritaPermite } from './sessao-restrita.js';

/**
 * Mensagem pública da recusa por falta de sessão.
 *
 * **Lida da tabela, e não escrita aqui.** Os produtores da recusa são dois — a guarda, que levanta
 * o código com mensagem, e o filtro global, para quem levantar o código sem ela —, e a resposta do
 * cliente não pode depender de qual caminho a produziu. Enquanto o literal estava escrito nos dois
 * lugares, "elas precisam coincidir" era um comentário; agora é uma consequência de só existir uma.
 * A tabela é a fonte porque é ela que a ADR-0007 governa: o corpo de erro sai dali em todo caminho
 * que não passa por aqui.
 */
const MENSAGEM_SEM_SESSAO = MENSAGEM_POR_CODIGO[CodigoErro.NAO_AUTENTICADO];

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
 * A sessão desta fatia **não** carrega telas nem ações: isso é da fatia
 * `autorizacao-e-ciclo-de-acesso`, junto de `versaoPermissoes`.
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
   * Exige sessão válida, confere o alcance dela e monta a sessão do produto.
   *
   * A ordem dos três passos é o que importa, e ela é observável:
   *
   *   1. **resolver** — sem sessão válida a resposta é `401`, e a exigência pendente nem é
   *      consultada: quem não entrou não tem exigência a cumprir.
   *   2. **conferir o alcance** — `sessaoRestritaPermite()` decide, e a recusa é `403`
   *      `ACESSO_NEGADO` com a mensagem que **nomeia a exigência pendente** (§10.1). O par de
   *      status é o da ADR-0007: `401` é *"quem é você?"*, `403` é *"você é quem diz e ainda não
   *      alcança isto"*.
   *   3. **pendurar** — e só então, porque a sessão pendurada é o que o interceptador usa para
   *      publicar o contexto de tenant. Recusar **antes** de pendurar é o que garante que nenhuma
   *      requisição recusada abra unidade de trabalho com contexto: o `intercept` encontra o slot
   *      vazio e não chama `executarCom`.
   */
  private async admitir(contexto: ExecutionContext): Promise<boolean> {
    const requisicao = contexto.switchToHttp().getRequest<FastifyRequest>();
    const sessao = await this.resolverSessao(requisicao);

    // O padrão da rota casada, e não o alvo bruto: é o mesmo valor que o filtro global grava no
    // journal, já sem cadeia de consulta. Ausência é tratada como rota desconhecida — e rota
    // desconhecida não está no conjunto permitido, de modo que a sessão restrita é recusada em vez
    // de liberada por falta de informação.
    const alcance = sessaoRestritaPermite(sessao, requisicao.routeOptions?.url ?? '');

    if (!alcance.permite) {
      throw new ErroDeAplicacao(CodigoErro.ACESSO_NEGADO, alcance.mensagem);
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

    // A leitura de `identidade` é a que `@sysloc/auth` publica — ver o cabeçalho deste arquivo.
    const pessoa = await carregarPessoaDaSessao(this.acesso.identidade, autenticada.user.id);

    if (pessoa === undefined) {
      throw new ErroDeAplicacao(CodigoErro.NAO_AUTENTICADO, MENSAGEM_SEM_SESSAO);
    }

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
    };
  }
}

/**
 * Converte os cabeçalhos do adaptador HTTP na forma que o arcabouço de identidade consome.
 *
 * Valor repetido é **anexado**, e não sobrescrito: `cookie` pode chegar em mais de uma linha, e
 * ficar com a última perderia justamente a credencial de sessão quando o cliente enviar outros
 * cookies antes dela.
 */
function cabecalhosDe(requisicao: FastifyRequest): Headers {
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
