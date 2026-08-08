/**
 * A cobertura de autorização como **propriedade consultada sobre a superfície publicada** — T5 da
 * fatia `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * O que esta verificação responde, e por que são DUAS perguntas
 * ---------------------------------------------------------------------------
 *
 * A ADR-0011 fecha o modo de falha "superfície aberta silenciosa" por construção: *"a rota que não
 * declara nada é recusada"*. A guarda materializa isso **por requisição** — quem chamar uma rota sem
 * declaração recebe `403`. O que a guarda **não** consegue dizer é se existe alguma: ela só é
 * consultada quando alguém bate na rota, e uma rota esquecida que ninguém chama fica indetectável até
 * ser chamada. Daí esta verificação, que percorre a superfície inteira de uma vez.
 *
 * São duas perguntas, e a segunda não é ornamento:
 *
 *   * **(a)** entre as rotas que a guarda governa, o conjunto **sem declaração** é vazio;
 *   * **(b)** o conjunto das rotas **públicas** é exatamente o inventário esperado.
 *
 * Sem a (b), `@RotaPublica()` viraria porta sem contador: bastaria marcar uma rota de negócio como
 * pública para ela escapar da autorização inteira, e a (a) não veria nada — a guarda **retorna
 * antes** para rota pública, sem sequer resolver sessão, e por isso uma rota marcada não tem, nem
 * pode ter, declaração de exigência a inspecionar. O que a (a) mede é a ausência de esquecimento; o
 * que a (b) mede é a ausência de escapatória.
 *
 * ---------------------------------------------------------------------------
 * A superfície vem do ROTEADOR MONTADO, e a razão é a mesma do `CT-020 (d)`
 * ---------------------------------------------------------------------------
 *
 * A alternativa óbvia — percorrer apenas os controladores que o arcabouço conhece — descreveria o
 * que **o arcabouço** publica, e não o que o **processo** atende. Tudo o que a montagem registra
 * direto no adaptador HTTP (hoje as nove rotas do contrato, por `SwaggerModule.setup`; amanhã um
 * plugin novo, uma página, uma rota escrita à mão em `getHttpAdapter().getInstance().get(...)`)
 * nasce **fora do alcance da guarda** — o global guard do arcabouço só corre para manipulador dele —
 * e ficaria sem classificação nenhuma. Não é que essas rotas sejam privadas: é que ninguém olharia.
 *
 * Por isso a enumeração primária é a **tabela do roteador já montado**, exatamente como a §11.1 da
 * tech spec da fatia anterior fixou para o inventário de rotas públicas efetivas. O que o
 * `CT-020 (d)` faz por **comportamento** (sondar cada rota e ver quem recusa), esta função faz por
 * **declaração** (ler o metadado de cada manipulador). Os dois se cobrem: um pega a proteção que não
 * existe, o outro pega a declaração que não foi escrita.
 *
 * ---------------------------------------------------------------------------
 * A declaração é lida pelo LEITOR DA PRODUÇÃO — não por um segundo leitor escrito aqui
 * ---------------------------------------------------------------------------
 *
 * A consulta é `Reflector.getAllAndOverride(chave, [manipulador, classe])`, com a **mesma instância**
 * de `Reflector` que a guarda usa, na **mesma ordem de precedência** (método vence classe). Isso é
 * deliberado e a `.claude/rules/testing-stack.md` diz por quê: um dos defeitos medidos neste
 * repositório foi uma tabela que exercitava a **reimplementação do leitor dentro do próprio
 * verificador**, aprovando 5/5 um SUT com o defeito de volta. Aqui não há segundo leitor: se a
 * precedência do metadado mudar, esta verificação muda junto, porque é a mesma chamada.
 *
 * ---------------------------------------------------------------------------
 * A unidade é o MANIPULADOR — isto é, o par método+caminho
 * ---------------------------------------------------------------------------
 *
 * A guarda decide **por manipulador**: ela consulta `getAllAndOverride(EXIGENCIA, [manipulador,
 * classe])` uma vez para cada manipulador que atende, e dois manipuladores do mesmo caminho podem
 * declarar coisas diferentes — o desenho REST mais comum que existe, `@Get()` de lista e `@Post()`
 * de criação no mesmo `@Controller`, é exatamente isso. Uma verificação que classificasse por
 * CAMINHO auditaria numa granularidade mais grossa do que aquela em que a decisão acontece, e teria
 * de escolher uma das declarações para representar as duas — ou desistir. **Por isso tudo aqui é
 * chaveado pelo par**: a reivindicação de cada manipulador, o laço de classificação, os quatro
 * conjuntos do retrato e o próprio tipo do achado.
 *
 * Duas consequências que valem dizer:
 *
 *   * **`HEAD` derivado do `GET` não é entrada própria.** O adaptador HTTP publica `HEAD` sozinho a
 *     partir de todo `GET` (`exposeHeadRoutes`), e o manipulador é o mesmo — a marca lida é a
 *     dele. Contá-lo dobraria o inventário sem acrescentar um único manipulador. É a mesma
 *     normalização que o `CT-020 (d)` já faz do outro lado, ao sondar `HEAD` como `GET`. O `HEAD`
 *     que **não** vem de um `GET` (um `@Head()` sozinho) continua sendo entrada, porque aí ele é
 *     um manipulador de verdade;
 *   * **um manipulador que atende TODOS os verbos reivindica todos os que o roteador publica no
 *     caminho dele.** É o caso do encaminhador de identidade (`@All('*')`): um manipulador, sete
 *     pares. O inventário fica mais longo e mais honesto — ele passa a dizer, nome por nome, que
 *     `POST` naquele caminho também atende sem passar pela decisão da guarda.
 *
 * ---------------------------------------------------------------------------
 * A junção entre roteador e manipulador é EXATA, e o desencontro é BARULHENTO
 * ---------------------------------------------------------------------------
 *
 * O roteador conhece caminhos; o metadado mora nos manipuladores. Ligar os dois exige compor o
 * caminho de cada manipulador — e compor caminho é justamente o tipo de reimplementação que
 * envelhece em silêncio. Duas decisões contêm esse risco:
 *
 *   1. **o prefixo global é PERGUNTADO** (`ApplicationConfig.getGlobalPrefix()`), nunca escrito aqui,
 *      e a lista de exclusões dele nem precisa ser lida: um manipulador é aceito se o roteador tiver
 *      o caminho **com** o prefixo ou **sem** ele — as duas únicas formas que o arcabouço produz —,
 *      e ter as duas ao mesmo tempo é ambiguidade, não escolha;
 *   2. **desencontro LEVANTA**. Manipulador cujo caminho composto não existe no roteador, caminho
 *      ambíguo entre as duas formas, **par método+caminho disputado por dois manipuladores** e
 *      **verbo declarado que o roteador não publica naquele caminho**: os quatro interrompem a
 *      verificação nomeando o culpado. É o que impede um erro de composição de se disfarçar de
 *      resultado — sem isso, um caminho composto errado tiraria a rota do conjunto governado e a
 *      empurraria para o conjunto público, que é uma aprovação onde deveria haver uma falha.
 *
 * A composição conhece hoje os fatores que **este** projeto usa: prefixo global, caminho da classe e
 * caminho do método. Um fator novo do arcabouço — versionamento por URI, `host` por controlador —
 * mudaria o caminho publicado sem mudar o que se compõe aqui, e a junção passaria a não achar
 * candidato nenhum. O resultado disso é o levantamento acima, e não classificação errada: a fronteira
 * é conhecida e **falha para o lado barulhento**.
 *
 * ---------------------------------------------------------------------------
 * Risco residual, nomeado
 * ---------------------------------------------------------------------------
 *
 * Isto cobre o que passa pelo **roteador do adaptador HTTP**, que é onde a guarda atua. Fica de fora
 * quem responde sem passar por ele: um ouvinte instalado direto no servidor do runtime, um
 * manipulador de "não encontrado" que passe a atender, ou um segundo servidor em outra porta.
 * Nenhum deles existe hoje, nenhum é alcançável pela guarda, e detectá-los exigiria varrer o fonte
 * em vez de perguntar ao roteador.
 */

// As chaves de metadado do próprio arcabouço, importadas do módulo em que ele as declara — nunca
// redigitadas como literais aqui. São `'path'` e `'method'` hoje; um bump que as renomeie quebra a
// COMPILAÇÃO deste arquivo, que é o modo de falha barulhento. Cópias locais falhariam em silêncio,
// classificando toda rota como "sem manipulador" e transformando a superfície inteira em pública.
// O especificador carrega a extensão porque o pacote não declara `exports` e o projeto é ESM.
// O verbo HTTP de um manipulador é traduzido pela enumeração do PRÓPRIO arcabouço — `RequestMethod`
// —, e nunca por uma tabela local de números para nomes. O metadado guarda o número; a tradução
// local envelheceria em silêncio no dia em que o arcabouço inserisse um verbo no meio da enumeração.
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import {
  ApplicationConfig,
  DiscoveryService,
  MetadataScanner,
  ModulesContainer,
  Reflector,
} from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Exigencia } from '@sysloc/auth';
import { EXIGENCIA } from './exigencia.decorator.js';
import { ROTA_PUBLICA } from './rota-publica.decorator.js';

/** Largura de um nível na árvore que o roteador imprime — `'│   '`, `'    '`, `'├── '`, `'└── '`. */
const LARGURA_DO_NIVEL_DA_ARVORE = 4;

/**
 * Uma rota publicada que a guarda governa e que **não declara nada** — nem exigência, nem a marca de
 * "não exige", nem a de rota pública.
 *
 * Ela nomeia o **par método+caminho** porque é assim que quem lê a falha encontra o defeito: o
 * caminho diz onde publicar a declaração, e o método diz qual manipulador é. A classe e o método
 * viajam junto porque o caminho sozinho não basta quando o mesmo controlador publica várias rotas.
 */
export interface RotaSemDeclaracao {
  /** O método HTTP deste manipulador — um só, porque a unidade governada é o par, não o caminho. */
  readonly metodo: string;
  /** O caminho publicado, exatamente como o roteador o registrou. */
  readonly caminho: string;
  /** Nome da classe do controlador que a publica. */
  readonly controlador: string;
  /** Nome do método que a atende. */
  readonly manipulador: string;
}

/**
 * O retrato da cobertura sobre a superfície publicada.
 *
 * Os três primeiros conjuntos guardam **pares método+caminho** na forma que {@link chaveDaRota}
 * produz (`'GET /v1/sessao'`), e os quatro **particionam** as rotas enumeradas: cada par aparece em
 * exatamente um de {@link comExigencia}, {@link publicas} e {@link semDeclaracao} — e
 * {@link foraDoArcabouco} é subconjunto de `publicas`, destacado para que a falha diga **por que**
 * uma rota não passa pela decisão: porque foi marcada, ou porque nem manipulador do arcabouço ela
 * tem.
 */
export interface CoberturaDeAutorizacao {
  /**
   * Quantos pares método+caminho o roteador publica.
   *
   * Existe para ser **afirmado**: um enumerador quebrado devolveria conjuntos vazios, e "nenhuma rota
   * sem declaração" sobre zero rotas é verdade vazia.
   */
  readonly rotasEnumeradas: number;
  /** Os pares cujo manipulador declara exigência — inclusive a marca de "não exige". */
  readonly comExigencia: readonly string[];
  /** Os pares que **não** passam pela decisão da guarda: marcados públicos ou sem manipulador. */
  readonly publicas: readonly string[];
  /** Subconjunto de {@link publicas}: os registrados direto no adaptador, fora do alcance da guarda. */
  readonly foraDoArcabouco: readonly string[];
  /** As rotas governadas que não declaram coisa alguma. **Vazio é o único resultado aceitável.** */
  readonly semDeclaracao: readonly RotaSemDeclaracao[];
}

/** Um caminho publicado, como o roteador do adaptador HTTP o registrou. */
/**
 * Uma rota como o roteador a imprime: o par de métodos e o caminho já com o prefixo desfatorado.
 *
 * Exportada porque `apps/api/test/contexto.e2e.spec.ts` a consome junto de
 * {@link rotasDaTabelaDoRoteador} — ver a razão no docblock daquela função.
 */
export interface RotaDoRoteador {
  readonly metodos: readonly string[];
  readonly url: string;
}

/** Um manipulador do arcabouço, com a declaração que a guarda leria nele. */
interface ManipuladorPublicado {
  readonly controlador: string;
  readonly manipulador: string;
  readonly exigencia: Exigencia | undefined;
  readonly publica: boolean;
}

// DECISÃO FECHADA — T5 / Gate 2 · 2026-08-04
// O QUÊ: a unidade de classificação desta verificação é o PAR método+caminho, e não o caminho. Esta
//        função é a chave única disso, e todo conjunto do retrato é indexado por ela.
// POR QUÊ: a guarda decide por MANIPULADOR — `getAllAndOverride(EXIGENCIA, [manipulador, classe])`
//          roda uma vez por manipulador —, e auditar por caminho é auditar numa granularidade mais
//          grossa do que a da decisão auditada. Chaveada por caminho, a verificação LEVANTAVA diante
//          do recurso REST mais banal que existe (`@Get()` de lista mais `@Post()` de criação no
//          mesmo `@Controller`), e a §5.3 da tech spec desta fatia já declara esse par em
//          `/v1/master/empresas`: a verificação abortaria na primeira montagem da T7.
// REVERTER EXIGE: provar que a guarda passou a decidir por CAMINHO, e não mais por manipulador —
//          isto é, que dois manipuladores do mesmo caminho não podem mais declarar exigências
//          diferentes. Enquanto puderem, voltar a chavear por caminho reabre o aborto. Verbosidade
//          do inventário NÃO é razão: ela é a cardinalidade real da superfície publicada.
/** A identidade de uma rota nesta verificação: o par método+caminho, como `'GET /v1/sessao'`. */
function chaveDaRota(metodo: string, caminho: string): string {
  return `${metodo} ${caminho}`;
}

/**
 * Consulta a cobertura de autorização sobre a superfície que **esta** aplicação publica.
 *
 * A aplicação precisa estar **montada** (`init()` ou `listen()` já executados): antes disso o
 * roteador ainda não tem as rotas dos controladores, e a enumeração descreveria uma superfície que
 * não existe. A função não emite requisição, não toca banco e não altera estado — ela lê a tabela do
 * roteador e o metadado dos manipuladores.
 *
 * @throws Error quando um manipulador não pode ser ligado a exatamente um caminho do roteador. É
 *   defeito da própria junção, não achado de cobertura, e confundir os dois transformaria um erro de
 *   composição numa aprovação silenciosa.
 */
export function verificarCoberturaDeAutorizacao(
  aplicacao: NestFastifyApplication,
): CoberturaDeAutorizacao {
  const metodosPublicados = metodosPorCaminho(
    rotasDaTabelaDoRoteador(aplicacao.getHttpAdapter().getInstance().printRoutes()),
  );
  const publicados = manipuladoresPublicados(aplicacao, metodosPublicados);

  const comExigencia: string[] = [];
  const publicas: string[] = [];
  const foraDoArcabouco: string[] = [];
  const semDeclaracao: RotaSemDeclaracao[] = [];
  let rotasEnumeradas = 0;

  for (const [caminho, metodos] of metodosPublicados) {
    for (const metodo of metodos) {
      rotasEnumeradas += 1;

      const chave = chaveDaRota(metodo, caminho);
      const publicado = publicados.get(chave);

      if (publicado === undefined) {
        // Sem manipulador do arcabouço: o global guard não corre aqui, e a rota atende sem passar por
        // decisão alguma. Ela não pode declarar — e é justamente por isso que precisa ser inventariada.
        foraDoArcabouco.push(chave);
        publicas.push(chave);
        continue;
      }

      if (publicado.publica) {
        // A marca de rota pública **é** a declaração dela (§5.1 da tech spec): a guarda retorna antes
        // de resolver sessão, e uma segunda marca no mesmo manipulador nunca seria lida. Por isso a
        // exigência nem é consultada neste ramo.
        publicas.push(chave);
        continue;
      }

      if (publicado.exigencia === undefined) {
        semDeclaracao.push({
          metodo,
          caminho,
          controlador: publicado.controlador,
          manipulador: publicado.manipulador,
        });
        continue;
      }

      comExigencia.push(chave);
    }
  }

  return {
    rotasEnumeradas,
    comExigencia: comExigencia.sort(),
    publicas: publicas.sort(),
    foraDoArcabouco: foraDoArcabouco.sort(),
    semDeclaracao: semDeclaracao.sort((um, outro) =>
      chaveDaRota(um.metodo, um.caminho).localeCompare(chaveDaRota(outro.metodo, outro.caminho)),
    ),
  };
}

/**
 * Extrai a tabela de rotas a partir da árvore que o adaptador HTTP imprime.
 *
 * Cada linha é um **nó**, e o caminho de uma rota é a concatenação dos rótulos dos ancestrais — a
 * impressão fatora prefixo comum, de modo que `/v1/auth/*` aparece como `v1/` → `auth/` → `*`. O
 * nível é dado pela coluna em que o traço da ramificação começa. Só os nós que declaram métodos entre
 * parênteses são rota; os demais são apenas prefixo.
 *
 * A forma com prefixo fatorado é a que se lê, e não `printRoutes({ commonPrefix: false })`: medido
 * nesta aplicação, a segunda imprime o encaminhador de identidade como `*`, sem o `/v1/auth` que o
 * roteador de fato casa — isto é, ela perde o caminho justamente da rota mais larga da superfície.
 *
 * ---------------------------------------------------------------------------
 * Por que é exportada — o fecho do débito D21 (F1/T5)
 * ---------------------------------------------------------------------------
 *
 * Ela viveu em **duas cópias verbatim**: esta e uma em `apps/api/test/contexto.e2e.spec.ts`, ambas
 * mantidas à mão. O que se analisa aqui é um formato de **impressão para humanos** (`printRoutes()`)
 * do adaptador HTTP — justamente o tipo de dependência que muda sem aviso num bump. Quando mudar,
 * muda para os dois consumidores; com duas cópias, nada obrigava quem consertasse uma a consertar a
 * outra, e o modo de falha era **uma rota governada caindo no balde público sem que ninguém visse**.
 *
 * A duplicação era consequência de uma decisão correta do executor da T5 — `contexto.e2e.spec.ts`
 * não estava no escopo declarado daquela task —, e por isso foi anotada em vez de bloqueada.
 */
export function rotasDaTabelaDoRoteador(arvore: string): RotaDoRoteador[] {
  const rotulos: string[] = [];
  const rotas: RotaDoRoteador[] = [];

  for (const linha of arvore.split('\n')) {
    const coluna = linha.search(/[├└]/u);
    if (coluna < 0 || coluna % LARGURA_DO_NIVEL_DA_ARVORE !== 0) {
      continue;
    }

    const conteudo = linha.slice(coluna + LARGURA_DO_NIVEL_DA_ARVORE).trimEnd();
    const casamento = /^(.*?)(?: \(([^()]+)\))?$/u.exec(conteudo);
    if (casamento === null) {
      continue;
    }

    // Trunca em vez de sobrescrever: sair de um ramo profundo para um raso tem de descartar os
    // rótulos do ramo anterior, senão um caminho herdaria segmento de rota vizinha.
    rotulos.length = coluna / LARGURA_DO_NIVEL_DA_ARVORE;
    rotulos.push(casamento[1] ?? '');

    const metodos = casamento[2];
    if (metodos !== undefined) {
      rotas.push({ metodos: metodos.split(', '), url: rotulos.join('') });
    }
  }

  return rotas;
}

/**
 * Os métodos que o roteador atende em cada caminho, sem repetição e **sem o `HEAD` derivado**.
 *
 * Duas normalizações, cada uma fechando um modo de falha:
 *
 *   1. **um registro por caminho.** A impressão da árvore emite hoje uma linha por caminho, com
 *      todos os métodos entre parênteses; depender disso é frágil, e garantir a unicidade aqui custa
 *      uma passada. Sem ela, um caminho emitido em duas linhas contaria duas vezes e apareceria
 *      duplicado nos conjuntos, fazendo a igualdade do inventário reprovar por um motivo que não é o
 *      dela;
 *   2. **`HEAD` que veio de um `GET` sai.** O adaptador publica `HEAD` a partir de todo `GET`
 *      (`exposeHeadRoutes`) — mesmo manipulador, mesma declaração —, e mantê-lo dobraria o
 *      inventário sem acrescentar manipulador nenhum. A supressão é condicionada à presença do
 *      `GET`, e não à posição na lista: a árvore imprime ora `(GET, HEAD)`, ora `(HEAD, GET)`, e o
 *      `HEAD` publicado **sem** `GET` é manipulador de verdade, que continua sendo entrada.
 *
 * **Fronteira conhecida (débito D26):** a supressão do item 2 é incondicional sobre o caminho, e por
 * isso um `@Head()` **explícito** que conviva com um `@Get()` no mesmo caminho perde o par que
 * reivindica — a verificação então ABORTA. Aborta, não aprova: o modo de falha é barulhento e do
 * lado seguro, e nenhum `@Head()` existe hoje nem é declarado em spec alguma. O que se corrigiu foi
 * o **diagnóstico**, que atribuía a ausência ao roteador; ver o `throw` dedicado em
 * {@link metodosDoManipulador}. Fechar a fronteira exige condicionar a supressão à ausência de
 * manipulador que declare `HEAD`, o que hoje pediria inverter a ordem entre esta função e a
 * enumeração dos manipuladores — mudança estrutural num módulo cuja granularidade está sob
 * `DECISÃO FECHADA`, e sem defeito presente que a motive.
 */
function metodosPorCaminho(rotas: readonly RotaDoRoteador[]): Map<string, readonly string[]> {
  const porUrl = new Map<string, string[]>();

  for (const rota of rotas) {
    const metodos = porUrl.get(rota.url) ?? [];

    for (const metodo of rota.metodos) {
      if (!metodos.includes(metodo)) {
        metodos.push(metodo);
      }
    }

    porUrl.set(rota.url, metodos);
  }

  const semHeadDerivado = new Map<string, readonly string[]>();

  for (const [url, metodos] of porUrl) {
    semHeadDerivado.set(
      url,
      metodos.includes('GET') ? metodos.filter((metodo) => metodo !== 'HEAD') : metodos,
    );
  }

  return semHeadDerivado;
}

/**
 * Liga cada manipulador de controlador aos **pares método+caminho** que ele atende no roteador, com
 * a declaração dele.
 *
 * `DiscoveryService` é a via publicada do arcabouço para enumerar controladores da aplicação
 * montada, e `MetadataScanner` a via publicada para enumerar métodos de um protótipo. Só entram os
 * que carregam o metadado de método HTTP — é o mesmo filtro pelo qual o arcabouço decide o que
 * publicar, de modo que método auxiliar de controlador não vira rota fantasma.
 *
 * A chave do resultado é a de {@link chaveDaRota}. **Dois manipuladores no mesmo caminho convivem**
 * — é o recurso REST comum, e cada um é classificado pela própria declaração; o que não convive é o
 * mesmo VERBO no mesmo caminho, porque aí não há como dizer qual declaração vale.
 */
function manipuladoresPublicados(
  aplicacao: NestFastifyApplication,
  metodosPublicados: ReadonlyMap<string, readonly string[]>,
): Map<string, ManipuladorPublicado> {
  const descoberta = new DiscoveryService(aplicacao.get(ModulesContainer, { strict: false }));
  const varredor = new MetadataScanner();
  const reflector = aplicacao.get(Reflector, { strict: false });
  const prefixo = aplicacao.get(ApplicationConfig, { strict: false }).getGlobalPrefix();

  const publicados = new Map<string, ManipuladorPublicado>();

  for (const embrulho of descoberta.getControllers()) {
    const instancia = embrulho.instance;
    const classe = embrulho.metatype;

    if (instancia === null || instancia === undefined || typeof classe !== 'function') {
      continue;
    }

    const prototipo = Object.getPrototypeOf(instancia) as object;
    const caminhosDaClasse = caminhosDeclarados(classe);

    for (const nome of varredor.getAllMethodNames(prototipo)) {
      const alvo = (prototipo as Record<string, unknown>)[nome];

      if (typeof alvo !== 'function' || Reflect.getMetadata(METHOD_METADATA, alvo) === undefined) {
        continue;
      }

      // A MESMA consulta da guarda, com a MESMA instância de `Reflector` e a MESMA ordem de
      // precedência (método vence classe). Ver o cabeçalho: não existe um segundo leitor aqui.
      const exigencia = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [
        alvo,
        classe,
      ]);
      const publica =
        reflector.getAllAndOverride<boolean | undefined>(ROTA_PUBLICA, [alvo, classe]) === true;

      for (const daClasse of caminhosDaClasse) {
        for (const doMetodo of caminhosDeclarados(alvo)) {
          const [caminho, metodosDoCaminho] = caminhoDoManipulador(
            metodosPublicados,
            prefixo,
            daClasse,
            doMetodo,
            classe.name,
            nome,
          );

          for (const metodo of metodosDoManipulador(
            alvo,
            caminho,
            metodosDoCaminho,
            classe.name,
            nome,
          )) {
            const chave = chaveDaRota(metodo, caminho);
            const anterior = publicados.get(chave);

            if (anterior !== undefined) {
              throw new Error(
                `${chave} é reivindicado por dois manipuladores — ` +
                  `${anterior.controlador}.${anterior.manipulador} e ${classe.name}.${nome}: ` +
                  'a cobertura não tem como dizer qual declaração vale',
              );
            }

            publicados.set(chave, {
              controlador: classe.name,
              manipulador: nome,
              exigencia,
              publica,
            });
          }
        }
      }
    }
  }

  return publicados;
}

/**
 * Os métodos HTTP que um manipulador reivindica no caminho que ele atende.
 *
 * Três casos, e os dois últimos são levantamento porque a alternativa seria silêncio:
 *
 *   * o manipulador declara **um verbo** — reivindica esse verbo, e só ele;
 *   * o manipulador declara **todos** (`@All`) — reivindica todos os que o roteador publica naquele
 *     caminho. Ele de fato atende cada um deles, e a declaração dele é a única que existe ali;
 *   * o verbo declarado **não é publicado** naquele caminho, ou é um número que o arcabouço não
 *     nomeia — **levanta**. Sem isso, a declaração ficaria pendurada numa chave que nenhum par
 *     consulta, e o par publicado apareceria como rota sem manipulador do arcabouço, isto é, entraria
 *     no conjunto PÚBLICO. Um erro de leitura viraria uma rota liberada em silêncio.
 */
function metodosDoManipulador(
  alvo: object,
  caminho: string,
  metodosDoCaminho: readonly string[],
  controlador: string,
  manipulador: string,
): readonly string[] {
  const declarado = Reflect.getMetadata(METHOD_METADATA, alvo) as unknown;
  const verbo =
    typeof declarado === 'number' ? (RequestMethod[declarado] as string | undefined) : undefined;

  if (verbo === undefined) {
    throw new Error(
      `${controlador}.${manipulador} declara um método HTTP que o arcabouço não nomeia ` +
        `(${String(declarado)}): a cobertura não sabe que rota do roteador é esta.`,
    );
  }

  if (declarado === RequestMethod.ALL) {
    return metodosDoCaminho;
  }

  if (!metodosDoCaminho.includes(verbo)) {
    // O `HEAD` explícito num caminho que também publica `GET` é o ÚNICO desencontro cujo culpado é
    // este módulo, e não o roteador: a normalização de {@link metodosPorCaminho} suprime o `HEAD`
    // derivado sempre que há `GET`, e a supressão não distingue o derivado do declarado à mão. O
    // roteador PUBLICA o par; quem o retirou fomos nós. Acusar o roteador aqui mandaria quem
    // depurasse procurar o defeito no lugar errado — e a doutrina deste módulo é levantar NOMEANDO
    // o culpado. Ver o débito D26 na §2 do run-report da fatia `autorizacao-e-ciclo-de-acesso`: a
    // coexistência é fronteira conhecida e declarada, não defeito silencioso.
    if (verbo === 'HEAD' && metodosDoCaminho.includes('GET')) {
      throw new Error(
        `${controlador}.${manipulador} declara ${chaveDaRota(verbo, caminho)} explicitamente, e ` +
          'esta verificação não sabe representá-lo: a normalização suprime o `HEAD` de todo ' +
          'caminho que publica `GET`, porque o adaptador o deriva sozinho. O roteador publica o ' +
          'par; quem o retirou foi esta função. Condicione a supressão à ausência de manipulador ' +
          'que declare `HEAD` antes de publicar esta rota.',
      );
    }

    throw new Error(
      `${controlador}.${manipulador} declara ${chaveDaRota(verbo, caminho)}, que o roteador não ` +
        `publica — ali ele atende ${metodosDoCaminho.join(', ')}. A cobertura descreveria uma ` +
        'superfície diferente da publicada.',
    );
  }

  return [verbo];
}

/**
 * Os caminhos declarados num alvo — classe ou método —, sempre como lista.
 *
 * O arcabouço aceita `@Controller(['a', 'b'])` e `@Get(['x', 'y'])`, e um alvo assim publica o
 * produto cartesiano dos dois. Tratar a forma de lista aqui é o que impede a junção de perder rota
 * no dia em que alguém a usar — o modo de falha seria uma rota governada sumindo do conjunto e
 * reaparecendo como pública.
 */
function caminhosDeclarados(alvo: object): readonly string[] {
  const declarado = Reflect.getMetadata(PATH_METADATA, alvo) as unknown;

  if (Array.isArray(declarado)) {
    return declarado.map((item) => String(item));
  }

  return [declarado === undefined ? '/' : String(declarado)];
}

/**
 * O caminho do roteador que este manipulador atende — **com** o prefixo global ou **sem** ele —, e
 * os métodos que o roteador publica ali.
 *
 * Os dois saem juntos porque o segundo é o que decide o que um manipulador `@All` reivindica, e
 * devolvê-lo aqui evita uma segunda consulta ao mapa cujo "e se não achar" seria ramo morto: quem
 * chega ao fim desta função já provou que o caminho existe.
 *
 * As duas formas são as únicas que o arcabouço produz: a rota nasce sob o prefixo, salvo quando a
 * composição a excluiu dele (`setGlobalPrefix(prefixo, { exclude })`). Aceitar as duas dispensa ler a
 * lista de exclusões — que seria uma segunda cópia dela, livre para divergir da que a composição
 * usa. **Encontrar as duas ao mesmo tempo é ambiguidade, e ambiguidade levanta**: escolher uma seria
 * decidir por conta própria de qual rota é a declaração que se acabou de ler.
 */
function caminhoDoManipulador(
  metodosPublicados: ReadonlyMap<string, readonly string[]>,
  prefixo: string,
  caminhoDaClasse: string,
  caminhoDoMetodo: string,
  controlador: string,
  manipulador: string,
): readonly [caminho: string, metodos: readonly string[]] {
  const semPrefixo = comporCaminho(caminhoDaClasse, caminhoDoMetodo);
  const comPrefixo = comporCaminho(prefixo, caminhoDaClasse, caminhoDoMetodo);

  const candidatas = [...metodosPublicados].filter(
    ([url]) => url === semPrefixo || url === comPrefixo,
  );

  if (candidatas.length === 1 && candidatas[0] !== undefined) {
    return candidatas[0];
  }

  throw new Error(
    `${controlador}.${manipulador} não pôde ser ligado a um caminho do roteador: ` +
      `${String(candidatas.length)} candidatos entre ${semPrefixo} e ${comPrefixo}. ` +
      'A cobertura descreveria uma superfície diferente da publicada.',
  );
}

/**
 * Compõe segmentos num caminho absoluto, como o roteador o registra: barra inicial, sem barras
 * repetidas e sem barra final.
 */
function comporCaminho(...segmentos: readonly string[]): string {
  const junto = `/${segmentos.join('/')}`.replaceAll(/\/+/gu, '/').replace(/(?!^)\/$/u, '');

  return junto.length === 0 ? '/' : junto;
}
