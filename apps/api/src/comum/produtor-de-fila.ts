/**
 * O **produtor de fila** da borda HTTP — o único ponto desta aplicação que conhece a biblioteca de
 * fila.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe, e por que num módulo só
 * ---------------------------------------------------------------------------
 *
 * A ADR-0029 manda o efeito externo de um ato de negócio sair **por fila**, nunca em linha na
 * borda. Isso torna a `api` produtora, e não só o processador de trabalho consumidor. O que se
 * segue disso é a razão deste arquivo: a conexão com o servidor de fila, o objeto produtor e a
 * política de repetição precisam de **um dono**, com um encerramento só, ou a aplicação passa a ter
 * tantas conexões quanto forem os serviços que quiserem enfileirar — e um desligamento que devolve
 * parte delas. É a mesma decisão, com a mesma razão, do acesso ao banco em
 * `autenticacao/autenticacao.module.ts`.
 *
 * O nome da fila, a forma da carga e as opções de repetição **não moram aqui**: vêm de
 * `@sysloc/shared` (`FILA_DA_CONFIRMACAO`, `FILA_DA_EMISSAO_EM_LOTE`,
 * `FILA_DA_CONFERENCIA_BANCARIA`, `FILA_DA_NOTIFICACAO_BANCARIA`,
 * `FILA_DA_RECONFERENCIA_DA_ENTREGA`, {@link CargaDaConfirmacao},
 * {@link CargaDaEmissaoEmLote}, {@link CargaDaConferenciaBancaria},
 * {@link CargaDaNotificacaoBancaria}, {@link CargaDaReconferenciaDaEntrega} e
 * {@link OPCOES_PADRAO_DA_TAREFA}), que é o fecho do
 * `D32 (F0/T6)`. Escrevê-los aqui à mão
 * reabriria exatamente o defeito daquele débito: `defaultJobOptions` vale **só para a instância que
 * as declara**, de modo que uma política escrita neste processo divergiria em silêncio da do
 * consumidor — a tarefa é aceita, roda, e apenas a repetição se comporta diferente.
 *
 * ---------------------------------------------------------------------------
 * A BORDA FALHA RÁPIDO — e é isso que separa uma mensagem perdida de um cadastro perdido
 * ---------------------------------------------------------------------------
 *
 * `apps/worker/src/fila.ts` reconecta **para sempre** e declara `maxRetriesPerRequest: null`, e ali
 * isso é correto: o consumidor bloqueia numa leitura de duração indefinida e um teto por comando a
 * cancelaria no meio. Aqui a exigência é a **oposta**, e copiar aquelas opções seria o defeito: um
 * `add` emitido com o servidor de fila fora ficaria na fila de espera local **até o servidor
 * voltar**, e quem espera por ele é uma requisição HTTP que já commitou o cadastro. O cliente veria
 * o pedido pendurar; o supervisor veria um serviço `active` que não responde.
 *
 * Três peças, e as três na mesma direção:
 *
 *   1. `enableOfflineQueue: false` — comando emitido sem conexão **falha na hora**, em vez de ser
 *      guardado para quando ela voltar;
 *   2. `maxRetriesPerRequest` finito — o comando desiste em vez de esperar reconexão indefinida;
 *   3. {@link LIMITE_DE_ENFILEIRAMENTO_MS} — o prazo que fecha o caso restante, em que a conexão
 *      existe e o servidor não responde. É o mesmo desenho do encerramento gracioso do processador:
 *      quem desiste primeiro é quem sabe explicar por que desistiu.
 *
 * O desfecho de qualquer uma das três é o mesmo, e é o exigido: o método de enfileiramento
 * **rejeita**, e quem chama a trata — a §10.2 da tech spec é literal em que a falha do
 * enfileiramento nunca derruba a resposta do cadastro, e a rede de produto é o reenvio manual
 * (RN-13). O que **quem chama** faz com a rejeição varia por ato, e a diferença é de produto, não
 * de infraestrutura: a confirmação a **absorve** e registra (o cadastro já commitou e o reenvio
 * manual é a rede); o lote e a conferência a traduzem em `503`, porque ali o pedido do Admin foi
 * justamente *"execute isto"* e dizer `201` sem ter enfileirado seria mentir sobre o desfecho.
 *
 * ---------------------------------------------------------------------------
 * CINCO FILAS, UM DESPACHO — e a unicidade é o que mantém a decisão fechada de pé
 * ---------------------------------------------------------------------------
 *
 * A T15 acrescentou a emissão em lote e a conferência bancária (ADR-0029), a T6 da fatia
 * `webhook-e-carne` acrescentou a notícia bancária (ADR-0035) e a T8 da fatia
 * `integracao-bancaria-autonoma` acrescentou a reconferência da entrega (ADR-0029). As cinco passam
 * pelo **mesmo**
 * {@link despachar}, e nenhuma tem corpo próprio: uma cópia por fila deixaria livre para divergir
 * exatamente o `catch` que a `DECISÃO FECHADA — T9 / Gate 2` instalou, e a cópia que nascesse sem
 * ele publicaria `err.command.args` no diário. É o **limiar de três** do `CLAUDE.md` chegando dentro
 * de um módulo — com o agravante de que o que se duplicaria aqui é a garantia, e não o estilo.
 *
 * ⚠️ **A quarta é a primeira cuja carga não carrega empresa**, e isso não muda nada deste módulo: o
 * despacho é genérico em `C`, e a decisão sobre a forma da carga é da ADR-0024 (terceira emenda) e
 * vive em `@sysloc/shared`, não aqui. A **quinta volta a carregá-la**, pela mesma ADR e pela mesma
 * razão — quem enfileira é a borda que atendeu a sessão do Admin —, e a alternância entre as duas
 * classes é exatamente o que este módulo **não** decide.
 *
 * ---------------------------------------------------------------------------
 * O ouvinte de `error` não é ornamento
 * ---------------------------------------------------------------------------
 *
 * O cliente e o produtor emitem `error` a cada tentativa de conexão frustrada. **Sem ouvinte a
 * falha não some — ela sai pior**: o cliente cai no caminho de último recurso e despeja a pilha
 * crua na saída de erro (`[ioredis] Unhandled error event`), fora do formato estruturado e fora da
 * redação de credencial; o produtor descarta o evento em silêncio. É o mesmo par de ouvintes, com a
 * mesma justificativa, de `apps/worker/src/fila.ts`.
 *
 * ---------------------------------------------------------------------------
 * NENHUM ERRO DA BIBLIOTECA SAI DAQUI — e a razão é a carga
 * ---------------------------------------------------------------------------
 *
 * A carga da confirmação carrega o **segredo em claro**, e a decisão de carregá-lo tem como
 * fundamento declarado a mitigação (b) da §13.1 da tech spec: *o segredo nunca é registrado*. A
 * cadeia que a desfazia foi **medida** nesta base, não inferida:
 *
 *   1. a carga viaja como **argumento de comando** do servidor de fila (`job.data` serializado);
 *   2. a biblioteca de acesso anexa `err.command = { name, args }` a **qualquer** erro de resposta
 *      (`MISCONF`, `OOM`, `NOSCRIPT`, `LOADING`) e ao aborto por queda de conexão com comando em
 *      voo — que é justamente o modo de falha para o qual este produtor foi desenhado;
 *   3. a redação única de `@sysloc/shared` alcança chave sensível **pelo nome** — e `command` não
 *      casa radical algum — e cadeia de caracteres **pela forma de endereço** — e um JSON com o
 *      campo `segredo` não tem `?`, `&` nem `#` antes do nome, e atravessa byte a byte.
 *
 * O desfecho era o segredo em claro no journal, publicado pelo próprio `catch` que existe para
 * protegê-lo. O saneamento mora **aqui**, e não no ponto de registro, porque este é o único módulo
 * da aplicação que conhece a biblioteca: fechar no chamador cobriria um `catch` e deixaria abertos o
 * ouvinte de `error` ao lado e todo consumidor futuro do produtor. Ver {@link semRastroDeComando}.
 */

import {
  type CargaDaConferenciaBancaria,
  type CargaDaConfirmacao,
  type CargaDaEmissaoEmLote,
  type CargaDaNotificacaoBancaria,
  type CargaDaReconferenciaDaEntrega,
  FILA_DA_CONFERENCIA_BANCARIA,
  FILA_DA_CONFIRMACAO,
  FILA_DA_EMISSAO_EM_LOTE,
  FILA_DA_NOTIFICACAO_BANCARIA,
  FILA_DA_RECONFERENCIA_DA_ENTREGA,
  type Logger,
  OPCOES_PADRAO_DA_TAREFA,
} from '@sysloc/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Token de injeção do produtor.
 *
 * Ele mora **aqui**, e não em `configuracao/ambiente.ts` como os seis tokens de infraestrutura,
 * porque a razão que levou aqueles para lá não se aplica: eles eram declarados **no módulo que os
 * provê**, e o decorador do consumidor era avaliado enquanto aquele módulo ainda carregava. Este
 * arquivo é folha — não importa módulo nenhum da aplicação —, de modo que não há ciclo a fechar, e
 * mantê-lo ao lado do tipo que ele publica é o que faz os dois serem lidos juntos.
 */
export const TOKEN_PRODUTOR_DE_FILA = Symbol('ProdutorDeFila');

/**
 * Espera entre tentativas de conexão do cliente, e o teto dela.
 *
 * Os valores são os do processador de trabalho de propósito — o que muda entre os dois processos é
 * a **desistência**, não a cadência. Divergir na cadência só tornaria mais difícil comparar o
 * comportamento dos dois no mesmo journal.
 */
const PASSO_DE_RECONEXAO_MS = 200;
const MAIOR_ESPERA_DE_RECONEXAO_MS = 5_000;

/**
 * Quantas vezes um comando é reenviado antes de desistir.
 *
 * Finito, e o oposto do `null` do consumidor — ver o cabeçalho. Três é a mesma ordem de grandeza da
 * repetição da tarefa: o suficiente para atravessar uma reconexão curta, e curto o bastante para
 * não segurar a requisição.
 */
const REENVIOS_POR_COMANDO = 3;

/**
 * Prazo do enfileiramento inteiro, medido pela borda.
 *
 * Ele fecha o caso que as opções do cliente não fecham: a conexão estabelecida com um servidor que
 * aceita a conexão e **não responde**. Sem ele, a requisição HTTP ficaria presa por tempo
 * indeterminado depois de o cadastro já ter sido gravado — trocando uma mensagem perdida por uma
 * resposta perdida, que é o desfecho pior dos dois.
 *
 * Constante nomeada no topo, e não número solto no meio da chamada, pela mesma razão que a
 * `.claude/rules/testing-stack.md` cobra dos limites de espera: um prazo sem nome não se revisa.
 */
const LIMITE_DE_ENFILEIRAMENTO_MS = 5_000;

// DECISÃO FECHADA — T9 da fatia `webhook-e-carne` / Gate 2 rodada 4 · 2026-08-19
// ⚠️ TERCEIRO marcador deste arquivo, e os três são independentes: o de 2026-08-13 é de OUTRA
//    fatia (`autorizacao-e-ciclo-de-acesso`) e trata de redação de credencial; o do `encerrar()`
//    abaixo fixa a ORDEM do fecho. Este fixa a EXISTÊNCIA do prazo, e não altera nenhum dos dois.
// O QUÊ: a espera pelo assentamento das inicializações corre contra um prazo. Ela NÃO pode voltar
//        a ser um `await` sem limite, por mais que a leitura do encerramento sugira que a conexão
//        já derrubada baste.
// POR QUÊ: essa exata leitura estava escrita aqui e é FALSA — a medição a refutou. Com o servidor
//          de fila ausente desde antes da conexão, o cliente fica em reconexão; a promessa de
//          aptidão da biblioteca só resolve em `ready`, `end` ou `error`, e o `disconnect()` não
//          produz nenhum dos três. Medido: `encerrar()` sem retorno em 10 s, fecho da aplicação
//          sem retorno em 35 s, e o `CT-002 'fila fora'` de `saude.e2e.spec.ts` reprovando o
//          hook de 90 s em 3 execuções de 4 sob carga. É a MESMA CLASSE que a `DECISÃO FECHADA —
//          T6 / Gate 2` de `apps/worker/src/fila.ts` fechou no processo irmão, chegando à borda
//          por caminho novo — e é por isso que este marcador existe.
// REVERTER EXIGE: provar que a biblioteca de acesso passou a resolver a espera de aptidão quando
//                 a conexão é encerrada durante a reconexão, e que o `CT-1007` de
//                 `apps/api/test/produtor-de-fila.spec.ts` sai verde com o prazo retirado — hoje
//                 ele mede o desligamento batendo no prazo, e sem o prazo ele não termina.
/**
 * Prazo da espera pelo assentamento das inicializações, no desligamento.
 *
 * Ele existe porque a premissa que o dispensava era **falsa**, e a refutação é medida — ver
 * {@link assentarInicializacoes}. É a mesma forma, com a mesma razão, da `DECISÃO FECHADA — T6 /
 * Gate 2` de `apps/worker/src/fila.ts`: nenhuma etapa de encerramento deste produto pode esperar
 * indefinidamente por um servidor de fila ausente, porque quem desiste primeiro precisa ser o
 * processo — ele sabe explicar no diário por que desistiu, e o supervisor só sabe mandar `SIGKILL`.
 *
 * Cinco segundos, e não os quinze do processo de trabalho, porque as duas esperas guardam coisas
 * diferentes: lá o prazo cobre a devolução de tarefas **em voo**; aqui, um aperto de mão que já
 * assentou em ~3 ms em toda medição desta base — o teto é folga de três ordens de grandeza, e o
 * caminho em que ele age é o que jamais assentaria.
 */
const LIMITE_DO_ASSENTAMENTO_MS = 5_000;

/**
 * A fila como este módulo a usa — carga `C`, resultado vazio e nome de tarefa em cadeia livre.
 *
 * Os **seis** parâmetros de tipo são escritos por extenso, e a verbosidade é o preço de não escrever
 * uma conversão. A biblioteca deriva `NameType` de `DataTypeOrJob` por tipo condicional, e um
 * condicional sobre parâmetro genérico **não resolve** dentro de {@link despachar} — o compilador
 * recusa `fila.add(nome, carga)` com um nome em cadeia. Fixá-los aqui, uma vez, mantém o despacho
 * único **e** o `add` conferido pelo compilador; a alternativa idiomática (`as never` no nome) daria
 * o mesmo binário e apagaria a conferência.
 */
type FilaDe<C> = Queue<C, void, string, C, void, string>;

/**
 * O que uma fila é para o **ciclo de vida** deste produtor: um nome, um nascimento e um fecho.
 *
 * Ele existe para que a lista de filas seja declarada uma vez só, sem parâmetro de carga — as duas
 * pontas do ciclo (o assentamento das inicializações e {@link ProdutorDeFila.encerrar}) tratam as
 * cinco filas do mesmo jeito, e nenhuma delas olha a carga.
 */
type FilaNoCicloDeVida = {
  readonly name: string;
  close(): Promise<void>;
  waitUntilReady(): Promise<unknown>;
};

/** O que o chamador vê quando o servidor de fila não aceita a tarefa. */
const RECUSA_DA_TAREFA = 'o servidor de fila não aceitou a tarefa';

/** O que o chamador vê quando a conexão com o servidor de fila falha. */
const FALHA_DA_CONEXAO = 'a conexão com o servidor de fila falhou';

/** O que o diário registra quando uma das filas não fecha no desligamento. */
const FALHA_DO_FECHO = 'o fecho de uma fila falhou no desligamento';

// DECISÃO FECHADA — T9 / Gate 2 (P1, CRÍTICO de segurança) · 2026-08-13
// O QUÊ: nenhum objeto de exceção vindo da biblioteca de fila atravessa a fronteira deste módulo.
//        Tudo que sai daqui — rejeição de `enfileirarConfirmacao` e linha dos dois ouvintes de
//        `error` — é erro CONSTRUÍDO aqui, com mensagem própria e a causa reduzida a TEXTO.
// POR QUÊ: `err.command = { name, args }` carrega a carga da tarefa serializada, e a carga carrega
//          o segredo em claro. Medido nesta base: com o servidor recusando escrita, a linha de
//          `warn` do disparo saía com o segredo legível — desfazendo a mitigação (b) da §13.1, que
//          é o que AUTORIZA a carga a levar o claro. A alternativa idiomática (registrar só
//          `erro.message` no ponto de registro) foi descartada por fechar uma ocorrência e deixar
//          a classe aberta: o ouvinte ao lado e todo consumidor futuro continuariam expostos.
// REVERTER EXIGE: (1) provar que nenhum caminho de erro da biblioteca anexa a carga ao objeto de
//                 exceção — o CT-738 de `apps/api/test/produtor-de-fila.spec.ts` exibe o contrário
//                 com servidor real; (2) retirar antes o CT-739, com a linha `SUT_IS_CORRECT_BECAUSE:`
//                 que o P5 da `.claude/rules/nao-regressao.md` exige.
/**
 * Converte uma falha da biblioteca de fila num erro **próprio** — nome, mensagem e nada mais.
 *
 * A causa entra como **cadeia de caracteres**, e não como o objeto original: passar o objeto o
 * traria de volta inteiro pela chave `causa` do registro, com o `command` junto, e o saneamento
 * seria aparente. É a armadilha mais provável de quem editar esta função.
 *
 * O valor rejeitado que **não** é `Error` não tem mensagem em que confiar — ele é descrito pelo
 * tipo, e não convertido em texto: `String(valor)` de um objeto qualquer pode arrastar conteúdo
 * que ninguém inspecionou, que é exatamente o que esta função existe para impedir.
 */
function semRastroDeComando(oQueFalhou: string, erro: unknown): Error {
  const causa =
    erro instanceof Error
      ? `${erro.name}: ${erro.message}`
      : `rejeição que não é exceção (${typeof erro})`;

  return new Error(oQueFalhou, { cause: causa });
}

/** A porta de saída para a fila, como a borda a consome. */
export interface ProdutorDeFila {
  /**
   * Enfileira a entrega de uma confirmação de endereço de e-mail.
   *
   * **Rejeita** quando o servidor de fila não aceita a tarefa dentro do prazo — e a rejeição é
   * informação para quem chama, não motivo para derrubar a resposta de quem já gravou.
   */
  enfileirarConfirmacao(carga: CargaDaConfirmacao): Promise<void>;
  /**
   * Enfileira a execução de uma emissão em lote **já gravada**.
   *
   * A ordem é conteúdo, e a §9.3 da tech spec a registra: a unidade de trabalho commita o lote e
   * **só então** a borda enfileira. A falha oposta — enfileirar e o commit desfazer — é impossível
   * por construção, e é o que dispensa a tabela de *outbox*. **Rejeita** como a irmã acima, e o que
   * quem chama faz com a rejeição é dizer `503`: o lote fica `EM_ANDAMENTO`, e a próxima tentativa
   * reusa o mesmo pelo índice único parcial.
   */
  enfileirarEmissaoEmLote(carga: CargaDaEmissaoEmLote): Promise<void>;
  /** Enfileira a execução de uma conferência bancária **já aberta**. Mesma disciplina da anterior. */
  enfileirarConferenciaBancaria(carga: CargaDaConferenciaBancaria): Promise<void>;
  /**
   * Enfileira o tratamento de uma notícia bancária **já gravada**.
   *
   * A ordem é conteúdo, e a §5.1-A da tech spec a registra: a unidade de trabalho commita o cru e
   * **só então** a borda enfileira. **Rejeita** como as irmãs acima — e o que quem chama faz com a
   * rejeição é o oposto do lote: ele a **absorve**, porque a resposta ao provedor já é `204` e um
   * `5xx` provocaria a reentrega que a idempotência existe para absorver, não para causar.
   */
  enfileirarNotificacaoBancaria(carga: CargaDaNotificacaoBancaria): Promise<void>;
  /**
   * Enfileira a **reconferência** da entrega da notícia de uma empresa, depois de o certificado dela
   * ter sido substituído.
   *
   * A ordem é conteúdo, e vale aqui o que as irmãs registram: a unidade de trabalho commita o
   * certificado e **só então** a borda enfileira. **Rejeita** como elas — e o que quem chama faz com
   * a rejeição é o mesmo da notícia: **absorve** e registra em `warn`. A diferença é de produto: o
   * pedido do Admin foi *"registre este certificado"*, e ele foi atendido; a reconferência é efeito
   * secundário cujo resultado não compõe a resposta (ADR-0029), e derrubar o registro por causa dela
   * desfaria o ato que o Admin pediu por causa do que ele não pediu.
   */
  enfileirarReconferenciaDaEntrega(carga: CargaDaReconferenciaDaEntrega): Promise<void>;
  /** Devolve o produtor e a conexão. Chamadas repetidas devolvem o mesmo encerramento. */
  encerrar(): Promise<void>;
}

/**
 * Conecta ao servidor de fila e devolve o lado produtor desta aplicação.
 *
 * @param cadeiaConexao Endereço do servidor de fila, na forma `redis://HOSPEDEIRO:PORTA`. Vem do
 * ambiente **já validado** na partida — este módulo não lê `process.env`, que é o que mantém a
 * conferência de configuração num ponto só.
 * @param logger Registrador do processo. Recebe as falhas de conexão, já sob a redação única.
 */
export function conectarProdutorDeFila(cadeiaConexao: string, logger: Logger): ProdutorDeFila {
  const conexao = new Redis(cadeiaConexao, {
    // As três peças que fazem a borda falhar rápido — ver o cabeçalho. Elas são o oposto
    // deliberado das do consumidor, e não um descuido de cópia.
    enableOfflineQueue: false,
    maxRetriesPerRequest: REENVIOS_POR_COMANDO,
    retryStrategy: (tentativa: number): number =>
      Math.min(tentativa * PASSO_DE_RECONEXAO_MS, MAIOR_ESPERA_DE_RECONEXAO_MS),
  });

  // A cadeia de conexão NÃO é registrada: ela pode carregar credencial. O que o operador precisa
  // saber é que o produtor está em falha — a mensagem da exceção nomeia o endereço, e a redação
  // única de `@sysloc/shared` cuida do que houver de sensível nela.
  //
  // O saneamento também aqui, e não só na rejeição do `add`: a biblioteca de acesso anexa o comando
  // em voo ao erro de aborto de conexão, e é por este ouvinte que ele sairia.
  conexao.on('error', (erro: Error) => {
    logger.warn(
      { erro: semRastroDeComando(FALHA_DA_CONEXAO, erro) },
      'o produtor de fila reportou falha de conexão',
    );
  });

  /**
   * Cria uma fila desta conexão, já com o ouvinte de `error` instalado.
   *
   * Ela existe para que **as cinco filas** nasçam do mesmo jeito. A alternativa — repetir as opções e
   * o ouvinte por fila — é a que faz a política divergir em silêncio: a terceira cópia nasceria sem
   * `defaultJobOptions`, ou sem ouvinte, e nada acusaria. É o **limiar de três** do `CLAUDE.md`
   * aplicado dentro do módulo, e a razão vale ainda mais aqui do que num símbolo qualquer, porque o
   * que se duplicaria é comportamento de infraestrutura.
   *
   * Nível de diagnóstico, e não de alerta: o que a fila emite aqui é o MESMO defeito de conexão que
   * o cliente acima já reportou uma vez, repassado adiante. Sem o ouvinte, a biblioteca descarta o
   * evento em silêncio.
   */
  function criarFila<C>(nome: string): FilaDe<C> {
    const fila: FilaDe<C> = new Queue(nome, {
      connection: conexao,
      defaultJobOptions: OPCOES_PADRAO_DA_TAREFA,
    });

    fila.on('error', (erro: Error) => {
      logger.debug(
        { erro: semRastroDeComando(FALHA_DA_CONEXAO, erro), origem: 'fila', fila: fila.name },
        'a fila repassou uma falha da conexão',
      );
    });

    return fila;
  }

  const confirmacao = criarFila<CargaDaConfirmacao>(FILA_DA_CONFIRMACAO);
  const emissaoEmLote = criarFila<CargaDaEmissaoEmLote>(FILA_DA_EMISSAO_EM_LOTE);
  const conferenciaBancaria = criarFila<CargaDaConferenciaBancaria>(FILA_DA_CONFERENCIA_BANCARIA);
  const notificacaoBancaria = criarFila<CargaDaNotificacaoBancaria>(FILA_DA_NOTIFICACAO_BANCARIA);
  const reconferenciaDaEntrega = criarFila<CargaDaReconferenciaDaEntrega>(
    FILA_DA_RECONFERENCIA_DA_ENTREGA,
  );

  /**
   * As filas abertas por esta conexão, na ordem em que nasceram — a lista que o encerramento fecha.
   *
   * Ela é declarada **uma vez**, ao lado da criação, e não repetida no `encerrar`: uma fila nova que
   * não entrasse na lista ficaria de pé depois do desligamento, e o sintoma seria um processo que não
   * termina — o mesmo modo de falha que o `disconnect()` incondicional abaixo existe para fechar.
   *
   * ⚠️ Ela é **também** a lista que {@link assentarInicializacoes} espera, e as duas pontas do ciclo
   * de vida derivam daqui de propósito. Uma lista própria para cada ponta é a alternativa óbvia, e é
   * a que envelhece: a que for reescrita nasce um dia sem a fila nova, e nada acusa — o parágrafo
   * acima diz isso da ponta do fecho, e vale palavra por palavra da ponta do nascimento. Derivando
   * as duas do mesmo lugar, elas não têm como discordar sobre quais filas existem.
   */
  const filas: readonly FilaNoCicloDeVida[] = [
    confirmacao,
    emissaoEmLote,
    conferenciaBancaria,
    notificacaoBancaria,
    reconferenciaDaEntrega,
  ];

  /**
   * O DESPACHO ÚNICO — o prazo, o saneamento e a corrida, escritos **uma vez** para as cinco filas.
   *
   * Ele é a razão de as cinco rotas de enfileiramento desta borda não terem corpo próprio. Uma
   * cópia por fila deixaria livre para divergir exatamente o que a `DECISÃO FECHADA — T9 / Gate 2`
   * fixou: o `catch` que embrulha a rejeição da biblioteca. A sexta fila que nascesse com um `add`
   * direto publicaria `err.command.args` no diário, e nada acusaria — é a mesma classe de defeito que
   * aquele marcador registra, chegando por caminho novo.
   *
   * O nome da tarefa é o **nome da fila**, como já era na confirmação: um segundo vocabulário para o
   * mesmo fato só daria ao consumidor um discriminador a mais para desencontrar.
   */
  async function despachar<C>(fila: FilaDe<C>, carga: C): Promise<void> {
    let prazo: NodeJS.Timeout | undefined;
    const expirar = new Promise<never>((_, rejeitar) => {
      prazo = setTimeout(
        () =>
          rejeitar(new Error(`${RECUSA_DA_TAREFA} em ${String(LIMITE_DE_ENFILEIRAMENTO_MS)} ms`)),
        LIMITE_DE_ENFILEIRAMENTO_MS,
      );
    });

    // O SANEAMENTO NA FRONTEIRA — ver o cabeçalho e {@link semRastroDeComando}. Ele envolve a
    // rejeição AQUI, e não em quem chama, porque a partir desta linha o erro já é da aplicação:
    // nem a corrida abaixo, nem o `catch` do disparo, nem consumidor futuro algum tem como
    // alcançar o objeto que a biblioteca levantou.
    const enfileirada = fila.add(fila.name, carga).catch((erro: unknown) => {
      throw semRastroDeComando(RECUSA_DA_TAREFA, erro);
    });
    // Rejeição TARDIA — depois de o prazo ter estourado e a espera ter sido abandonada — não pode
    // virar rejeição não tratada e derrubar o processo. Quando a rejeição chega DENTRO do prazo,
    // é a corrida abaixo que a propaga a quem pediu; este ouvinte apenas a consome.
    enfileirada.catch(() => undefined);

    try {
      await Promise.race([enfileirada, expirar]);
    } finally {
      clearTimeout(prazo);
    }
  }

  /**
   * Espera **toda** inicialização de fila assentar — o primeiro passo do encerramento, e o que
   * permite a ele fechar as filas sem deixar rejeição órfã para trás.
   *
   * ---------------------------------------------------------------------------
   * ELA É INTERNA DE PROPÓSITO — e a alternativa foi medida antes de ser descartada
   * ---------------------------------------------------------------------------
   *
   * Esta espera já foi um membro de {@link ProdutorDeFila} (`pronto()`), e a publicação foi
   * recolhida: **nenhum** dos consumidores do produtor a chamava, e o único chamador externo era
   * arquivo de verificação — símbolo de produção não nasce para o teste enxergar algo. Publicá-la
   * de volta é pior do que ocioso: pedi-la com o servidor de fila fora e a conexão viva é esperar
   * por uma reconexão que este módulo tenta para sempre, e uma subida de aplicação que a
   * aguardasse ficaria pendurada exatamente no cenário em que a rota de prontidão precisa
   * responder que a fila caiu.
   *
   * ---------------------------------------------------------------------------
   * ELA TEM PRAZO — e a premissa que o dispensava foi REFUTADA por medição
   * ---------------------------------------------------------------------------
   *
   * A redação anterior declarava a ausência de prazo como deliberada, com o argumento de que, no
   * encerramento, *"o limite vem da conexão já derrubada — sem reconexão não há espera
   * indefinida"*. **Isso é falso**, e o caminho é este: quando o servidor cai **durante** a
   * inicialização das filas, o cliente entra em reconexão; a promessa de aptidão da biblioteca só
   * resolve em `ready`, `end` ou `error`, e o `disconnect()` de um cliente já em reconexão não
   * produz nenhum dos três. A espera então **nunca** termina — e com ela o desligamento inteiro.
   *
   * Medido nesta base, de forma determinística na primeira aplicação de um arquivo de verificação
   * (a que paga a partida a frio), com a fila derrubada logo após o `listen`: `encerrar()` não
   * retornou em 10 s e o fecho da aplicação não retornou em 35 s. Fora da verificação, o mesmo é o
   * `SIGTERM` na borda com o servidor de fila já parado — a ordem de unidades que o desligamento
   * do sistema produz —, e o desfecho seria o supervisor matando um processo que não explica por
   * que não terminou. É **a mesma classe** que a `DECISÃO FECHADA — T6 / Gate 2` fechou no
   * processo de trabalho; a borda era o irmão que ficara sem o prazo.
   *
   * O teto age **só** no caminho patológico: o assentamento normal, depois da conexão derrubada,
   * mede ~3 ms. Ver {@link LIMITE_DO_ASSENTAMENTO_MS}.
   *
   * ---------------------------------------------------------------------------
   * O que ela afirma, e o que ela não afirma
   * ---------------------------------------------------------------------------
   *
   * A lista percorrida é `filas` — a MESMA que o encerramento fecha, e não um arranjo escrito aqui.
   * É o que faz a sexta fila entrar **por construção**: as duas pontas do ciclo de vida saem da
   * mesma declaração e não têm como discordar sobre quais filas existem.
   *
   * **Nunca rejeita**, e o que ela afirma é o **fim** da inicialização, não o sucesso dela: a falha
   * de conexão já é registrada pelo ouvinte de `error` que cada fila carrega, e quem responde por
   * disponibilidade é a rota de prontidão do serviço. `allSettled`, e não `all`, pela razão que
   * esta função existe para fechar: com `all`, a primeira rejeição resolveria a espera e deixaria
   * as **demais** sem tratamento — a barreira viraria fonte da rejeição não tratada que ela veio
   * impedir. É a mesma escolha, com a mesma razão, do fecho abaixo.
   *
   * ⚠️ **Quem fecha a classe é a ORDEM do encerramento, não esta espera** — ver o bloco de
   * comentário em {@link ProdutorDeFila.encerrar}. Lá a conexão cai **antes** do fecho das filas, e
   * é a queda que faz a inicialização em voo assentar com os ouvintes ainda instalados; esta espera
   * é apenas o passo seguinte dela.
   *
   * Medido nesta base, com registro em arquivo (o `console` de encerramento é descartado pelo
   * arcabouço de verificação): a primeira aplicação de um arquivo de verificação fecha ~480 ms
   * depois de conectar, com as filas ainda em `initializing` e a conexão em `connect`, e o desfecho
   * — sem a ordem do fecho e sem esta espera — é **uma rejeição não tratada por fila em voo**. ⚠️ A
   * medição foi feita quando eram **quatro** filas, e o número dela é o daquele dia; a grandeza,
   * porém, é *uma por fila*, e é ela que cresce junto com a lista.
   */
  async function assentarInicializacoes(): Promise<void> {
    let prazo: NodeJS.Timeout | undefined;
    const expirar = new Promise<'PRAZO-ESTOURADO'>((resolver) => {
      prazo = setTimeout(() => resolver('PRAZO-ESTOURADO'), LIMITE_DO_ASSENTAMENTO_MS);
    });

    // Quais filas efetivamente assentaram — preenchido NO PONTO em que cada uma assenta, que é o
    // único lugar onde esse fato existe. Ver o alerta abaixo para por que ele é registrado.
    const assentadas = new Set<string>();

    // `allSettled` NUNCA rejeita, e é o que dispensa aqui o ouvinte de rejeição tardia que o
    // despacho acima precisa ter: a espera abandonada pelo prazo não vira rejeição sem dono.
    const assentado = Promise.allSettled(
      filas.map(async (fila) => {
        await fila.waitUntilReady();
        // Depois do `await`, e nunca antes: a fila cuja espera REJEITA não passa por aqui, e é
        // assim que a rejeição continua contando como "não assentou" sem ramo próprio.
        assentadas.add(fila.name);
      }),
    ).then((): 'ASSENTOU' => 'ASSENTOU');

    try {
      if ((await Promise.race([assentado, expirar])) === 'PRAZO-ESTOURADO') {
        // A única pista de que o fecho seguinte pode produzir rejeição órfã. Alerta, e não
        // diagnóstico como as demais linhas do desligamento: as outras dizem que algo já
        // registrado falhou de novo, esta diz que uma garantia foi ABANDONADA.
        //
        // DECISÃO FECHADA — D22 · F4/T9 · fechado na intervenção dirigida de 2026-08-22
        // O QUÊ: o campo `filas` nomeia as que **não assentaram**, e não todas as que existem.
        // POR QUÊ: publicar `filas.map(f => f.name)` respondia *"quantas filas existem"* — a mesma
        //          lista, idêntica em todo estouro —, quando a pergunta do operador é *"quantas
        //          ficaram para trás, e qual"*. Ele não distinguia "as cinco estavam pendentes" de
        //          "uma só travou", que é a diferença entre o servidor de fila fora do ar e uma
        //          fila doente. Numa linha que existe para dizer que uma garantia foi abandonada, o
        //          dado que falta é justamente o que a abandonou.
        // REVERTER EXIGE: mostrar que o conjunto observado pode divergir do fecho — e ele não pode:
        //          `pendentes` é derivado de `filas`, a MESMA lista que o encerramento percorre, de
        //          modo que fila nova entra por construção e nenhuma lista paralela existe.
        const pendentes = filas.filter((fila) => !assentadas.has(fila.name));

        logger.warn(
          {
            limiteMs: LIMITE_DO_ASSENTAMENTO_MS,
            filas: pendentes.map((fila) => fila.name),
            // A contagem vai junto do nome porque ela é o que se lê primeiro num alerta, e porque
            // ela sobrevive a um `filas` vazio — que é o desfecho em que todas assentaram no
            // instante do prazo, e que sem ela seria indistinguível de campo perdido.
            pendentes: pendentes.length,
          },
          'o assentamento das inicializações excedeu o limite — seguindo com o desligamento',
        );
      }
    } finally {
      clearTimeout(prazo);
    }
  }

  /** O encerramento já pedido, se houver. Ver {@link ProdutorDeFila.encerrar}. */
  let encerramento: Promise<void> | undefined;

  return {
    async enfileirarConfirmacao(carga: CargaDaConfirmacao): Promise<void> {
      await despachar(confirmacao, carga);
    },

    async enfileirarEmissaoEmLote(carga: CargaDaEmissaoEmLote): Promise<void> {
      await despachar(emissaoEmLote, carga);
    },

    async enfileirarConferenciaBancaria(carga: CargaDaConferenciaBancaria): Promise<void> {
      await despachar(conferenciaBancaria, carga);
    },

    async enfileirarNotificacaoBancaria(carga: CargaDaNotificacaoBancaria): Promise<void> {
      await despachar(notificacaoBancaria, carga);
    },

    async enfileirarReconferenciaDaEntrega(carga: CargaDaReconferenciaDaEntrega): Promise<void> {
      await despachar(reconferenciaDaEntrega, carga);
    },

    encerrar(): Promise<void> {
      // Um pedido de encerramento, um encerramento: o segundo chamador recebe o mesmo, em vez de
      // reabrir a espera.
      encerramento ??= (async (): Promise<void> => {
        try {
          // DECISÃO FECHADA — T9 da fatia `webhook-e-carne` / Gate 1 rodada 3 · 2026-08-19
          // ⚠️ NÃO CONFUNDA com a `DECISÃO FECHADA — T9 / Gate 2 · 2026-08-13` acima: aquele "T9" é
          //    de OUTRA fatia (`autorizacao-e-ciclo-de-acesso`) e trata de redação de credencial.
          //    São marcadores homônimos e independentes; nenhum dos dois se toca por causa do outro.
          // O QUÊ: a conexão é derrubada ANTES do fecho das filas, e a espera pelo assentamento das
          //        inicializações vem entre as duas. A devolução do `finally` continua onde estava.
          // POR QUÊ: o Gate 1 reprovou o mesmo item DUAS vezes, e as duas leituras anteriores
          //          erraram o ponto — a primeira atribuiu a `segredo-nao-escapa.e2e.spec.ts`, a
          //          segunda ao `parar()` do CT-002 de `saude.e2e.spec.ts`. Medido na rodada 3, com
          //          registro em arquivo: quem produz as quatro rejeições é ESTE fecho, quando ele
          //          corre com as quatro filas em `initializing`. A barreira posta só na suíte
          //          fechava um arquivo e deixava os outros ~30 que levantam aplicação real — foi
          //          medido, e `segredo-nao-escapa.e2e.spec.ts` continuou reprovando 1 em 5.
          // REVERTER EXIGE: provar que a biblioteca de fila passou a suprimir a rejeição tardia da
          //                 inicialização TAMBÉM na conexão compartilhada (hoje o `close()` dela
          //                 condiciona a supressão a `!shared`), e que o bloco
          //                 `'com as dependências de pé'` de `apps/api/test/saude.e2e.spec.ts` sai 0
          //                 em execuções repetidas com a ordem invertida de volta — ele saía 1 em
          //                 8 de 8 antes desta linha.
          //
          // A CONEXÃO CAI PRIMEIRO, E A ORDEM É CONTEÚDO — não é a devolução do `finally`, que
          // continua onde estava e por que estava.
          //
          // O fecho de uma fila retira os ouvintes de `error` dela. Se ele acontecer com o aperto
          // de mão ainda em voo, a inicialização pendente rejeita DEPOIS, e a biblioteca a reemite
          // como `error` num emissor que já não tem quem escute — o `emit` lança de dentro dela
          // mesma, e sobra **uma rejeição não tratada por fila**. A supressão que a biblioteca traz
          // para esse caminho é explicitamente condicionada à conexão NÃO ser compartilhada, e a
          // deste módulo é compartilhada por desenho: aqui ela não vale.
          //
          // Derrubar a conexão antes inverte as duas pontas: é a queda que faz toda inicialização
          // em voo assentar, e ela assenta ENQUANTO os ouvintes ainda estão instalados — a falha
          // sai pela linha de diagnóstico que já existe, em vez de virar rejeição órfã. É também o
          // que torna a espera seguinte **limitada por construção**, sem prazo nenhum: com a
          // conexão fora, não há reconexão que a faça esperar para sempre — que é o caso contra o
          // qual {@link assentarInicializacoes} adverte (servidor fora E conexão viva).
          //
          // ⚠️ EMENDA de 2026-08-19 (mesma task, rodada 4). O parágrafo acima está preservado na
          // íntegra, com uma única alteração — o alvo do `{@link}` final, que apontava para um
          // símbolo removido nesta rodada. Os quatro campos desta decisão estão INTOCADOS. A última
          // frase do parágrafo é FALSA — a medição a refutou. Quando o servidor já está fora ANTES
          // da conexão, o cliente entra em reconexão com as inicializações pendentes, e o
          // `disconnect()` não produz o evento que a espera aguarda: ela não termina, e o
          // desligamento inteiro fica preso (medido: `encerrar()` sem retorno em 10 s). Quem fecha
          // isso é o prazo de {@link assentarInicializacoes}, sob marcador próprio. **A ORDEM que
          // esta decisão fixa segue valendo palavra por palavra** — é ela que mantém os ouvintes
          // instalados quando a inicialização assenta, e nada nesta emenda a toca.
          //
          // Medido nesta base: sem esta ordem, uma aplicação que sobe e fecha em menos de meio
          // segundo — o que toda suíte de borda faz — produzia QUATRO rejeições não tratadas, uma
          // por fila, sem reprovar caso algum e fazendo o comando do pacote sair 1.
          conexao.disconnect();
          await assentarInicializacoes();

          // TODAS as filas, e a falha de uma não impede o fecho das outras: `allSettled`, e não
          // `all`. Com `all`, a primeira rejeição abandonaria as demais abertas — e o desligamento
          // com o servidor de fila fora, que é justamente quando isto corre, faria o processo ficar
          // de pé segurando o que ele acabou de pedir para fechar. A lista percorrida é `filas`, e
          // não um arranjo escrito aqui: é ela que faz a fila nova entrar no fecho por construção.
          const fechos = await Promise.allSettled(filas.map(async (fila) => await fila.close()));

          // ...E OS RESULTADOS SÃO LIDOS. `allSettled` nunca rejeita: descartá-los devolveria ao
          // caminho de fecho exatamente o silêncio que o ouvinte de `error` existe para impedir —
          // *"o produtor descarta o evento em silêncio"*, no cabeçalho. Enquanto havia uma fila só,
          // a rejeição subia até `onApplicationShutdown` e o arcabouço a registrava; com três, e
          // sob `allSettled`, quem não ler aqui não fica sabendo em lugar nenhum.
          //
          // ⚠️ A causa entra reduzida a TEXTO, por {@link semRastroDeComando}, e não como o objeto
          // que a biblioteca rejeitou: é o que a `DECISÃO FECHADA — T9 / Gate 2` exige de tudo que
          // sai deste módulo, e passar o objeto de `close()` cru ao registrador reabriria o vetor
          // `err.command.args`. É a armadilha mais provável de quem editar este bloco.
          //
          // Nível de diagnóstico, e não de alerta, pela mesma razão do ouvinte de `criarFila`: o
          // processo está descendo, o desfecho não muda, e o operador que investiga um desligamento
          // demorado é quem precisa da linha. A ORDEM de `allSettled` é a de entrada — é ela que
          // liga cada resultado à fila que o produziu.
          for (const [indice, fecho] of fechos.entries()) {
            if (fecho.status !== 'rejected') continue;

            logger.debug(
              {
                erro: semRastroDeComando(FALHA_DO_FECHO, fecho.reason),
                origem: 'fila',
                fila: filas[indice]?.name,
              },
              'uma fila não fechou no desligamento',
            );
          }
        } finally {
          // Devolução INCONDICIONAL da conexão: enquanto ela estiver de pé, o temporizador de
          // reconexão segura o laço de eventos e o processo não termina. Encerramento incondicional
          // (`disconnect()`), e não o gracioso: um `QUIT` emitido com o servidor fora ficaria na
          // fila de espera local, e o cenário em que isso acontece é justamente o desligamento com
          // a fila caída — a mesma razão registrada em `apps/worker/src/fila.ts`.
          conexao.disconnect();
        }
      })();

      return encerramento;
    },
  };
}
