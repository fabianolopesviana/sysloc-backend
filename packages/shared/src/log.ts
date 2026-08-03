/**
 * Registro estruturado de eventos.
 *
 * Toda linha emitida é um objeto JSON completo — nunca texto livre —, com nível legível,
 * horário em ISO-8601 e os campos que quem registra informar. O identificador de correlação
 * por requisição viaja como campo do evento (`idCorrelacao`) ou como vínculo de um logger
 * filho (`logger.child({ idCorrelacao })`), que é como T5 vai propagá-lo.
 *
 * ## Redação: o que ela alcança e o que ela não alcança
 *
 * Campos sensíveis são mascarados **na origem** — no momento em que a linha é montada, antes
 * de qualquer escrita — e não filtrados depois por quem consome o registro. A garantia tem
 * fronteira, e conhecê-la é condição de uso:
 *
 * 1. **Alcança os CAMPOS do evento, em qualquer profundidade — inclusive a 0.** Primeiro
 *    nível, objeto aninhado, item de vetor, propriedade de exceção, vínculo de logger filho
 *    e o **próprio objeto do evento** (`logger.info(buffer)`, `logger.info(url)`). O
 *    reconhecimento é por **nome de chave** ({@link RADICAIS_SENSIVEIS}) e por duas **formas
 *    do valor** — a credencial embutida numa cadeia de conexão
 *    ({@link CREDENCIAL_EM_CADEIA_DE_CONEXAO}) e o valor de parâmetro de endereço cujo nome
 *    case um radical sensível ({@link PARAMETRO_DE_ENDERECO}) —, de modo que a senha embutida
 *    numa cadeia de conexão e o `?token=…` de um endereço são mascarados mesmo sob uma chave
 *    de nome inocente.
 *
 *    "Qualquer profundidade" é propriedade de **estrutura**, não de cobertura: existe uma
 *    entrada única de despacho por tipo ({@link redigirValor}), e todo valor que vira campo
 *    de uma linha passa por ela — o objeto do evento e os vínculos do filho entram por
 *    {@link redigirRegistro}, o resto por recursão. A profundidade 0 não é caso especial,
 *    é a primeira chamada. Enquanto a redação esteve instalada em pontos, cada correção
 *    fechava o caminho apontado e o seguinte aparecia noutro lugar. O que T5 vier a acrescentar
 *    ao evento — `mixin`, contexto de requisição — chega como parte do mesmo objeto e entra
 *    pela mesma porta; não há segunda porta a fechar depois.
 * 2. **Alcança a MENSAGEM do evento pelos eixos da forma do valor, e só por eles.** A mensagem
 *    não passa pelo formatador de campos — o pino a monta por rota própria —, então ela é
 *    interceptada onde é escrita ({@link CHAVE_DA_MENSAGEM}). Isso vale para as três formas
 *    em que ela nasce: texto livre (`logger.info('conectado a postgres://u:senha@h/db')`),
 *    interpolação (`logger.info('conectado a %s', cadeia)`) e **promoção a partir de
 *    `erro.message`** quando o chamador não informa mensagem própria (`logger.error({ err })`
 *    e `logger.error(err)` — o caso canônico da falha de conexão). O que a mensagem NÃO ganha
 *    é o eixo por nome de chave, porque ela não tem chaves: `logger.info('senha do
 *    certificado: X')` emite `X`. Daí a convenção que T5 herda e que vale para toda fatia
 *    seguinte: **contexto sensível vai como campo nomeado, nunca interpolado na mensagem**.
 * 3. **Nome de chave desconhecido não é adivinhado.** O casamento é por **radical** contido na
 *    chave normalizada ({@link RADICAIS_SENSIVEIS}), de modo que `novaSenha`, `senhaDoBanco` e
 *    `senha-atual` caem junto com `senha`; mas radical novo entra na lista junto com o recurso
 *    que o introduz. O mesmo casamento por radical decide o **nome do parâmetro** no eixo de
 *    endereço ({@link RADICAIS_SENSIVEIS_EM_ENDERECO}), para que radical novo entre num lugar
 *    só. O eixo da cadeia de conexão existe justamente para não depender só do acerto do nome.
 *
 * ## Idioma do envelope
 *
 * Decisão registrada: traduzimos o que o **produto** decide registrar e o que uma pessoa lê
 * primeiro na linha — `nivel` e `mensagem`. Ficam em inglês as três chaves que o **núcleo do
 * pino** carimba em toda linha sem que a fatia peça: `time`, `pid` e `hostname`. O motivo é
 * assimetria de custo e de risco: `messageKey` e o formatador de `level` são opções nomeadas
 * da fábrica, enquanto o trio do núcleo exigiria substituir a função de horário e o formatador
 * de vínculos para renomear chaves que nenhuma fatia escreve — divergindo, de quebra, do
 * formato que qualquer leitor de pino já sabe ler. Campo novo de domínio nasce em português.
 *
 * A terceira chave escrita por este pacote é {@link CHAVE_DO_VALOR_AVULSO} (`valor`), e ela
 * só aparece quando o evento registrado não é um registro de campos.
 */

import { URL } from 'node:url';
import pino from 'pino';

/**
 * Severidades aceitas pela variável `LOG_LEVEL` (ver `.env.example`), na ordem crescente.
 *
 * É a lista que as composições raiz do serviço de aplicação e do processador de trabalho validam
 * — as duas a consomem daqui, e não de uma cópia própria: severidade nova acrescentada em um dos
 * lados faria um processo subir e o outro recusar o mesmo `EnvironmentFile`.
 */
export const NIVEIS_DE_LOG = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

/**
 * Severidade aceita pela variável `LOG_LEVEL`.
 *
 * Derivada da lista acima de propósito: é o que garante que o tipo e a validação de ambiente
 * nunca digam coisas diferentes sobre o que é uma severidade válida.
 */
export type NivelDeLog = (typeof NIVEIS_DE_LOG)[number];

/** O registrador devolvido por {@link criarLogger}. */
export type Logger = pino.Logger;

export interface OpcoesDeLogger {
  /**
   * Severidade mínima registrada. Evento abaixo dela não produz linha alguma.
   * Vem de `LOG_LEVEL` pela composição raiz — o pacote não lê ambiente por conta própria.
   */
  readonly nivel?: NivelDeLog;

  /**
   * Para onde as linhas vão. Ausente = saída padrão do processo, que é o que a unidade
   * systemd entrega ao journal. Caminho de arquivo é o outro destino que a unidade prevê.
   */
  readonly destino?: string | pino.DestinationStream;
}

const NIVEL_PADRAO: NivelDeLog = 'info';

/**
 * Chave de topo sob a qual a mensagem do evento é escrita.
 *
 * Declarada uma vez porque é usada em **dois** lugares que não podem divergir: a opção que
 * renomeia a chave e o interceptador que mascara o valor escrito nela. Se divergirem, o
 * interceptador deixa de ser chamado e a mensagem volta a sair crua — em silêncio.
 */
const CHAVE_DA_MENSAGEM = 'mensagem';

/**
 * Chave sob a qual o evento é escrito quando o chamador registra um **valor avulso** em vez de
 * um registro de campos — `logger.info(url)`, `logger.info(vetor)`, `logger.info(data)`.
 *
 * Nasce em português pelo mesmo critério de `nivel` e `mensagem`: é chave que o **produto**
 * decide escrever, não carimbo do núcleo do registrador. `valor` e não `objeto` porque o que
 * chega aqui frequentemente não é objeto nenhum — a cadeia de um `URL` já mascarado, um vetor,
 * uma data. Nomear pelo que a chave **carrega** (um valor único, no lugar de campos) descreve
 * as três; nomear pelo tipo descreveria uma.
 *
 * Não há colisão possível com campo do chamador: a chave só existe quando o evento inteiro é
 * o valor avulso e, portanto, quando não há campo nenhum do chamador na linha.
 */
const CHAVE_DO_VALOR_AVULSO = 'valor';

/** Valor que substitui o conteúdo de um campo sensível. */
const SENTINELA_REDIGIDO = '[REDIGIDO]';

/** Valor que substitui uma referência já visitada no caminho atual. */
const SENTINELA_CICLO = '[CICLO]';

/**
 * Primeiro eixo do reconhecimento: **o nome da chave**.
 *
 * A comparação é por **radical contido** na chave normalizada (minúscula, sem separador), e
 * não por igualdade: `senhaCertificado`, `senha_certificado`, `SENHA-CERTIFICADO`, `novaSenha`
 * e `senhaDoBanco` casam todos o radical `senha`. A assimetria de custo é o que decide a
 * escolha — falso positivo custa mascarar um campo inócuo, falso negativo custa um vazamento.
 *
 * Cada radical corresponde a um segredo que este projeto realmente manuseia (CLAUDE.md,
 * invariante 3) ou a dado pessoal: senha do certificado `.pfx`, chave de cifra, credencial
 * de API, **cookie de sessão** e CPF. Não é lista de tudo que existe — é a lista do que
 * existe aqui.
 *
 * O critério é a stack declarada, não o código já escrito: `authorization`, `token` e `apikey`
 * entraram antes de existir uma linha de autenticação, e `cookie`/`sessao`/`session` entram
 * pelo mesmo motivo — o `CLAUDE.md` fixa **better-auth**, que é sessão por cookie httpOnly, e
 * o token de sessão em texto claro no journal é material de sequestro de sessão com agravante
 * de persistência: o journal é lido por operador e sobrevive ao rodízio do token. Um radical
 * `cookie` cobre `cookie` e `set-cookie` (a normalização remove o hífen); `sessao` e `session`
 * são radicais distintos porque a biblioteca fala inglês e o produto fala português, e a chave
 * pode nascer de qualquer dos dois lados.
 *
 * **O que esta lista deliberadamente NÃO cobre**: a senha do PostgreSQL, que neste projeto não
 * chega sob chave chamada `senha` — chega dentro de `DATABASE_URL`, cujo formato o
 * `.env.example` versionado documenta como `postgres://USUARIO:SEGREDO@HOSPEDEIRO:PORTA/BANCO`
 * (o `REDIS_URL` do mesmo arquivo é `redis://HOSPEDEIRO:PORTA`, sem credencial — mas a forma
 * credenciada existe e é aceita pelo eixo abaixo). Casar o nome nunca alcançaria essa forma;
 * quem a alcança é o segundo eixo.
 */
const RADICAIS_SENSIVEIS: readonly string[] = [
  'senha',
  'password',
  'authorization',
  'cookie',
  'sessao',
  'session',
  'token',
  'apikey',
  'secret',
  'segredo',
  'chavecifra',
  'cpf',
];

/**
 * Segundo eixo do reconhecimento: **a forma do valor**.
 *
 * Casa a credencial embutida numa cadeia de conexão (`esquema://usuario:senha@hospedeiro/…`).
 * É o eixo que alcança o segredo mais manuseado deste projeto: o `.env.example` versionado
 * documenta `DATABASE_URL` como `postgres://USUARIO:SEGREDO@HOSPEDEIRO:PORTA/BANCO`, e o
 * `turbo.json` declara a variável na tarefa `test`. A primeira linha de log de partida
 * ("conectado a X") é exatamente onde essa cadeia aparece.
 *
 * Reconhecer a forma independe do nome que o chamador escolheu para a chave — `databaseUrl`,
 * `dsn`, `conexao` ou `url` mascaram igual, e chave nova não exige revisitar a lista.
 *
 * O grupo capturado preserva **esquema e usuário**: quem lê o registro precisa saber a qual
 * serviço e com que identidade o processo se conectou. O que não pode sair é a senha. O
 * padrão é aplicado a toda cadeia de caracteres do evento, não só ao valor de primeiro nível,
 * porque a cadeia costuma aparecer também dentro da mensagem de uma exceção de conexão.
 *
 * As classes de caractere excluem os quatro delimitadores que **encerram a autoridade** de um
 * URI: `/` (caminho), espaço, `?` (query) e `#` (fragmento) — mais `:` na porção do usuário,
 * que é o separador do próprio par. Sem `?` e `#` o padrão mutilava URL legítima: em
 * `http://hospedeiro:8080?redirect=alguem@exemplo.com` ele lia `hospedeiro` como usuário e
 * `8080?redirect=alguem` como senha, emitindo `http://hospedeiro:[REDIGIDO]@exemplo.com` —
 * perdia a porta, perdia o parâmetro e inventava um hospedeiro. Não vazava nada; corrompia em
 * silêncio o diagnóstico que o registro existe para preservar, num formato que é o normal do
 * fluxo de autenticação (URL de retorno com `redirect=`/`callbackURL=`).
 */
const CREDENCIAL_EM_CADEIA_DE_CONEXAO = /\b([a-z][a-z0-9+.-]*:\/\/[^/@\s:?#]*):[^/@\s?#]*@/gi;

/**
 * Radicais que tornam sensível o **nome de um parâmetro de endereço** — os de
 * {@link RADICAIS_SENSIVEIS} mais `code`.
 *
 * A lista é derivada, e não paralela: o nome de parâmetro é uma das formas em que o mesmo
 * segredo é nomeado (`?token=`, `?senha=`, `?apiKey=`), e manter duas listas faria radical novo
 * entrar num lado só. O acréscimo de `code` vale **apenas aqui** de propósito: em cadeia de
 * consulta ele é o código de autorização de um fluxo OAuth — credencial de uso único, trocável
 * por sessão —, enquanto como **chave de evento** ele casaria `statusCode` e `errorCode`, que
 * são diagnóstico e não segredo. O identificador legível do produto (`codigo`, CLAUDE.md
 * invariante 5) não contém o radical `code` e segue legível.
 *
 * **`callback` NÃO entra**, e a ausência é deliberada — ver a `DECISÃO FECHADA` de
 * {@link redigirValorEmCadeiaDeConsulta}.
 */
const RADICAIS_SENSIVEIS_EM_ENDERECO: readonly string[] = [...RADICAIS_SENSIVEIS, 'code'];

/**
 * Terceiro eixo do reconhecimento: **o par `nome=valor` de um endereço**.
 *
 * Casa um parâmetro de cadeia de consulta (`?token=SEGREDO`, `&senha=SEGREDO`) e a mesma forma
 * quando ela viaja no fragmento (`#access_token=SEGREDO`, o fluxo implícito). É o eixo que
 * alcança o segredo do **arcabouço de identidade**: `token` e código de autorização viajam na
 * consulta, e o vazamento medido não veio de campo nenhum — veio da mensagem que o arcabouço
 * monta para rota não casada interpolando o alvo bruto (`Cannot GET /rota?token=…`), de onde o
 * segredo saía quatro vezes numa linha só.
 *
 * Os três grupos existem para que a substituição alcance **só o valor**: o separador e o nome
 * são devolvidos intactos, porque o diagnóstico depende de saber que houve um `token` — não do
 * valor dele.
 *
 * A delimitação é o ponto de risco, e cada classe de caractere responde por uma fronteira:
 *
 * - **Início** — o par só é reconhecido depois de `?`, `&` ou `#`. Sem essa âncora, qualquer
 *   `nome=valor` de texto livre seria redigido, e a mensagem viraria refém do acaso.
 * - **Nome** — sem `?`, `&`, `#`, `=` nem espaço: são os delimitadores que **encerram** o nome.
 * - **Valor** — as mesmas fronteiras, mais **todo caractere que um URI não pode carregar sem
 *   codificação percentual**: os excluídos do RFC 3986 §2 (`"`, `<`, `>`, `\`, `^`, crase, `{`,
 *   `|`, `}`) e os gen-delims `[` e `]`, que só são válidos dentro do hospedeiro. Excluir `?`
 *   custa nada em endereço legítimo (o parâmetro seguinte é reconhecido no lugar) e impede que
 *   um `?senha=` aninhado num valor escape por estar depois de um `?` já consumido.
 *
 *   **Esta fronteira não é ornamento**: sem ela o valor engolia o delimitador do TEXTO em volta
 *   e o substituía junto — `at alvo [ENDERECO]` saía sem o `]`, que é a mutilação silenciosa
 *   que o eixo da cadeia de conexão já custou uma rodada para aprender a evitar. Fazer o valor
 *   terminar onde o próprio URI termina é o que preserva o texto em volta.
 *
 * O valor exige **ao menos um caractere**: `?token=` sem valor não carrega segredo, e trocá-lo
 * pelo sentinela inventaria conteúdo onde não havia — mascarar não é apagar, nem preencher.
 *
 * ---------------------------------------------------------------------------
 * A fronteira do VALOR, declarada — e não afirmada como absoluto
 * ---------------------------------------------------------------------------
 *
 * A âncora (acima) é fronteira **fechada**: sem `?`, `&` ou `#` antes, nada é reconhecido. A do
 * valor **não é**, e dizer que fosse seria a promessa que este arquivo existe para não fazer. Duas
 * entradas foram medidas e atravessam:
 *
 * - `?token=SEG]REDO` → `?token=[REDIGIDO]]REDO`. O `]` encerra o valor, então a **cauda**
 *   (`]REDO`) sobrevive. É o preço direto da exclusão que protege o texto em volta: sem ela, o
 *   caso legítimo `at alvo [http://h/x?token=ABC]` sairia sem o `]` final.
 * - `?a=1;token=SEGREDO` → intacto. O `;` **não delimita** — o par casado é `a=1;token=SEGREDO`,
 *   cujo nome (`a`) não denuncia nada, e o `token` aninhado nunca é visto como parâmetro próprio.
 *
 * **Nenhuma das duas é corrigível por aqui.** Admitir `]` como delimitador de valor reabre a
 * mutilação; admitir `;` obrigaria a tratá-lo como separador de parâmetro, que ele não é em
 * endereço deste produto. As duas são fronteira conhecida do eixo, não defeito a fechar — e ambas
 * exigem que o segredo já venha malformado, o que nenhum produtor deste sistema faz.
 */
const PARAMETRO_DE_ENDERECO = /([?&#])([^?&#=\s]+)=([^?&#\s"<>{}|\\^`[\]]+)/g;

type Registro = Record<string, unknown>;

/**
 * Cria o registrador estruturado do processo.
 *
 * @param opcoes Nível e destino — ambos configuráveis por ambiente pela composição raiz.
 */
export function criarLogger(opcoes: OpcoesDeLogger = {}): Logger {
  const logger = pino(
    {
      level: opcoes.nivel ?? NIVEL_PADRAO,
      messageKey: CHAVE_DA_MENSAGEM,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        // Nível como rótulo legível, não como número: quem lê o journal não deveria
        // precisar de uma tabela para saber que 30 é `info`.
        level: (rotulo: string) => ({ nivel: rotulo }),
        log: redigirRegistro,
      },
      serializers: {
        // A MENSAGEM tem rota de montagem PRÓPRIA, que não atravessa `formatters.log` — e
        // portanto não atravessa o redator de campos. Fechar só os campos deixava a linha
        // sair com o erro mascarado e a mensagem crua ao lado, com a senha legível:
        //
        //   {"err":{"mensagem":"connect ECONNREFUSED postgres://u:[REDIGIDO]@h/db"},
        //    "mensagem":"connect ECONNREFUSED postgres://u:SENHA-REAL@h/db"}
        //
        // O interceptador é instalado aqui, no ÚNICO ponto por onde a mensagem é escrita,
        // e não no ponto de entrada da chamada. A diferença importa: aqui ele alcança a
        // mensagem já montada — inclusive a promovida de `erro.message` quando o chamador
        // não informa uma, e o resultado da interpolação (`'conectado a %s', cadeia`) —
        // sem que este pacote precise reimplementar as regras de promoção do registrador,
        // que são detalhe interno dele e mudam sem aviso.
        [CHAVE_DA_MENSAGEM]: mascararMensagem,
      },
    },
    resolverDestino(opcoes.destino),
  );

  return comVinculosRedigidos(logger);
}

type CriarFilho = (vinculos: pino.Bindings, opcoes?: pino.ChildLoggerOptions) => Logger;

/**
 * Faz a redação alcançar também os vínculos de um logger filho.
 *
 * O pino **zera** o formatador de vínculos ao criar um filho: a redação declarada em `formatters`
 * não alcança `logger.child({ ... })` — justamente o caminho por onde o contexto da requisição
 * vai viajar. Redigir os vínculos antes de repassá-los fecha essa porta; o filho devolvido é
 * envolvido de novo para que a garantia valha em qualquer profundidade.
 *
 * O método original é capturado uma única vez e repassado adiante em vez de relido a cada nível:
 * um filho herda a propriedade do pai, e reler `logger.child` faria o neto nascer vinculado ao
 * avô, perdendo os vínculos do pai.
 */
function comVinculosRedigidos(
  logger: Logger,
  // A conversão descarta apenas o parâmetro de níveis personalizados de `child`, que este
  // pacote não usa — os argumentos e o retorno são os mesmos.
  criarFilho: CriarFilho = logger.child as unknown as CriarFilho,
): Logger {
  const envolver: CriarFilho = (vinculos, opcoesDoFilho) =>
    comVinculosRedigidos(
      criarFilho.call(logger, redigirRegistro(vinculos), opcoesDoFilho),
      criarFilho,
    );

  Object.defineProperty(logger, 'child', {
    value: envolver,
    configurable: true,
    writable: true,
  });

  return logger;
}

function resolverDestino(destino: OpcoesDeLogger['destino']): pino.DestinationStream {
  // Escrita síncrona em toda linha: perder as últimas linhas justamente quando o processo
  // está morrendo é perder as que explicam a morte.
  //
  // O custo é pago em regime permanente para resolver um problema que só existe no
  // encerramento. A alternativa é `sync: false` (escrita em lote) somada a `flushSync()` nos
  // manipuladores de `SIGTERM`/`SIGINT` e no `uncaughtException`. **A troca pertence a T5**,
  // que é quem instala o desligamento gracioso e o amarra ao `KillSignal`/`TimeoutStopSec`
  // da unidade systemd — trocar aqui, sem esses manipuladores, seria abrir a janela de perda
  // sem ter quem a feche.
  if (destino === undefined) {
    return pino.destination({ sync: true });
  }
  if (typeof destino === 'string') {
    return pino.destination({ dest: destino, sync: true, append: true });
  }
  return destino;
}

/**
 * **Entrada única do mascaramento por forma do valor.** Todo texto que vira campo, mensagem,
 * pilha ou valor de raiz passa por aqui — nenhum eixo de forma mora num ponto de escrita.
 *
 * Os dois eixos são aplicados em ordem fixa: primeiro a credencial de cadeia de conexão, depois
 * o parâmetro de endereço. A ordem é indiferente ao resultado (o primeiro produz
 * `:[REDIGIDO]@`, que não contém `=`, e portanto não fabrica par para o segundo), e é fixada
 * apenas para que a saída não dependa de detalhe de implementação.
 */
function mascararCredencial(texto: string): string {
  return redigirValorEmCadeiaDeConsulta(
    texto.replace(CREDENCIAL_EM_CADEIA_DE_CONEXAO, `$1:${SENTINELA_REDIGIDO}@`),
  );
}

// DECISÃO FECHADA — T1 (F1) / Gate 1 (CRIT-001) + decisão do usuário · 2026-08-02
// O QUÊ: o eixo de endereço é delimitado pelo NOME do parâmetro, e `callback` NÃO é um nome
//        sensível: `?callbackURL=…` atravessa o registro intacto.
// POR QUÊ: decisão tomada por veredito explícito do Gate 1 (CRIT-001, 2026-08-02) e pelo
//          usuário, e materializada na correção do cartão da T1 — `callbackURL` saiu do
//          Invariant e do Resultado esperado do CT-027 (§6.2 e §6.6), com a razão registrada
//          inline no arquivo da task. O mérito: `callbackURL` é ALVO DE RETORNO, não credencial
//          — redigi-lo não tira segredo nenhum e apaga para onde o usuário foi mandado, que é
//          justamente o diagnóstico que o registro existe para preservar. A credencial do fluxo
//          é o `token` (e o `code`), e essas o eixo alcança. Duas asserções independentes
//          sustentam a delimitação: o caso CT-008 da F0 exige, desde antes desta task, que
//          `https://app.exemplo.com:8443?callbackURL=x#a@b` saia byte a byte idêntico — o
//          mutante que inclui `callback` na lista o REPROVA, o que seria regressão R1 pelo
//          Protocolo Antirregressão —, e o endereço 2 do CT-028 repete a exigência para o alvo
//          de retorno ao lado de um destino com `@`.
// REVERTER EXIGE: (1) demonstrar que o valor de `callbackURL` é credencial neste produto;
//                 (2) escalar ao usuário por `AskUserQuestion` e obter nova decisão — a vigente
//                 é dele, e nenhum agente a substitui sozinho; (3) retirar, ANTES de incluir o
//                 radical, as duas asserções que a defendem — o caso CT-008 'não mutila URL
//                 legítima sem credencial' (`packages/shared/test/log.spec.ts`) e o endereço 2
//                 do CT-028 —, cada retirada acompanhada da linha `SUT_IS_CORRECT_BECAUSE:`
//                 exigida pelo P5 da `.claude/rules/nao-regressao.md`.
/**
 * Substitui pelo sentinela o **valor** de parâmetro de endereço cujo nome case um radical de
 * {@link RADICAIS_SENSIVEIS_EM_ENDERECO}, preservando o separador, o nome e todo o resto do
 * endereço — esquema, hospedeiro, porta, caminho, fragmento e os parâmetros não sensíveis.
 *
 * Parâmetro de nome inocente é devolvido **verbatim**, e é isso que impede a mutilação: a
 * varredura percorre todos os pares do endereço, mas só reescreve os que o nome denuncia.
 */
function redigirValorEmCadeiaDeConsulta(texto: string): string {
  return texto.replace(
    PARAMETRO_DE_ENDERECO,
    (casamento: string, separador: string, nome: string) =>
      contemRadicalSensivel(nome, RADICAIS_SENSIVEIS_EM_ENDERECO)
        ? `${separador}${nome}=${SENTINELA_REDIGIDO}`
        : casamento,
  );
}

/**
 * Aplica os eixos por forma do valor à mensagem do evento.
 *
 * Só os eixos por forma: a mensagem não tem chaves, então o eixo por nome de chave não se aplica
 * a ela — o nome que o eixo de endereço casa é o do **parâmetro**, que viaja dentro do texto.
 * Valor não textual atravessa intacto — o registrador aceita mensagem de outros tipos, e
 * convertê-la aqui mudaria o formato da linha sem ganho de segurança.
 */
function mascararMensagem(mensagem: unknown): unknown {
  return typeof mensagem === 'string' ? mascararCredencial(mensagem) : mensagem;
}

/**
 * **Entrada única do despacho por tipo.** Todo valor que vira campo de uma linha entra por
 * aqui: o objeto do evento (`formatters.log`) e os vínculos de um logger filho.
 *
 * A delegação a {@link redigirValor} — e não direto a {@link redigirObjeto} — é o que faz a
 * garantia valer na **profundidade 0**. `redigirObjeto` é a etapa POSTERIOR ao despacho: ele
 * copia chaves. Todo o reconhecimento — a lista fechada de tipos, o mascaramento por forma do
 * valor e o guarda de ciclo — mora em `redigirValor`. Chamar o copiador direto deixava o
 * objeto que o chamador entrega sem classificação nenhuma: `logger.info(buffer)` despejava os
 * bytes um por chave e `logger.info(url)` emitia a linha vazia, porque nenhum dos dois tem
 * chave própria enumerável. Com a delegação, a profundidade 0 deixa de ser caso especial —
 * é a mesma função que classifica a raiz e cada nível abaixo dela.
 *
 * O retorno precisa ser um **registro de campos**, porque é o que o registrador itera para
 * montar a linha. Devolver a cadeia de um `URL` faria a iteração percorrer índices de
 * caractere — trocaria um defeito por outro. Daí a normalização abaixo.
 */
function redigirRegistro(registro: Registro): Registro {
  const redigido = redigirValor(registro, new WeakSet<object>());
  return ehRegistroDeCampos(redigido) ? redigido : { [CHAVE_DO_VALOR_AVULSO]: redigido };
}

/**
 * Responde se o despacho produziu um **registro de campos** — o que o registrador sabe iterar.
 *
 * A pergunta é sobre o protótipo porque tudo que vira campo da linha é objeto literal
 * construído aqui dentro — a cópia redigida, o objeto de exceção e o resumo de uma visão de
 * memória. Tudo mais que o despacho pode devolver — cadeia, vetor, `Date`, `undefined` — é um
 * valor avulso, e valor avulso vira o conteúdo de UMA chave, nunca o conjunto de chaves da
 * linha. Perguntar apenas `typeof === 'object'` deixaria `Date` (e qualquer outro tipo de
 * representação própria que a lista fechada venha a aceitar) escorrer para a iteração de
 * chaves, que não encontra nenhuma — o evento sairia vazio.
 */
function ehRegistroDeCampos(valor: unknown): valor is Registro {
  return (
    typeof valor === 'object' && valor !== null && Object.getPrototypeOf(valor) === Object.prototype
  );
}

function redigirObjeto(objeto: Registro, emVisita: WeakSet<object>): Registro {
  const saida: Registro = {};
  for (const chave of Object.keys(objeto)) {
    saida[chave] = ehChaveSensivel(chave)
      ? SENTINELA_REDIGIDO
      : redigirValor(objeto[chave], emVisita);
  }
  return saida;
}

function redigirValor(valor: unknown, emVisita: WeakSet<object>): unknown {
  if (typeof valor === 'function') {
    // Função não é dado, e o `JSON.stringify` do pino a descartaria de qualquer forma.
    // Descartá-la aqui é o que impede que a CÓPIA REDIGIDA herde um `toJSON` próprio do
    // objeto de origem: se herdasse, o serializador chamaria de volta o objeto original e
    // desfaria, na última etapa, toda a redação feita antes.
    return undefined;
  }
  if (typeof valor === 'string') {
    return mascararCredencial(valor);
  }
  if (valor === null || typeof valor !== 'object') {
    return valor;
  }
  if (emVisita.has(valor)) {
    return SENTINELA_CICLO;
  }

  // Lista FECHADA dos tipos cuja representação própria é preservada — reconstruí-los campo a
  // campo destruiria a representação que eles definem. A lista é fechada de propósito: a
  // versão anterior perguntava se o objeto tinha um método `toJSON`, e essa pergunta é um
  // predicado ABERTO — toda entidade de domínio que ganhasse um serializador próprio saía
  // inteira do alcance da redação, com CPF e senha legíveis.
  if (valor instanceof Date) {
    return valor;
  }
  if (valor instanceof URL) {
    // `URL.toJSON()` devolve o href COM usuário e senha embutidos — é a forma exata em que a
    // cadeia de conexão do banco chegaria ao journal.
    return mascararCredencial(valor.href);
  }
  if (ArrayBuffer.isView(valor)) {
    // `Buffer` e demais visões de memória: forma e tamanho, nunca os bytes. Sem isto, o
    // `.pfx` do Sicoob (CLAUDE.md, invariante 3) sairia inteiro como vetor de inteiros.
    return { tipo: valor.constructor.name, bytes: valor.byteLength };
  }

  emVisita.add(valor);
  const redigido = Array.isArray(valor)
    ? valor.map((item) => redigirValor(item, emVisita))
    : valor instanceof Error
      ? redigirErro(valor, emVisita)
      : redigirObjeto(valor as Registro, emVisita);
  // Sai do caminho ao terminar: o mesmo objeto referenciado duas vezes lado a lado é
  // repetição legítima, não ciclo.
  emVisita.delete(valor);

  return redigido;
}

/**
 * Converte a exceção em objeto simples, já redigido.
 *
 * As chaves são em português por necessidade, não por estilo: um objeto com `message` de
 * texto é reconhecido pelo serializador de erro padrão do pino, que reanexaria a exceção
 * crua à linha (campo `raw`) e desfaria a redação feita aqui.
 *
 * A mensagem e a pilha passam pelo mascaramento de credencial porque falha de conexão é
 * justamente o erro que carrega a cadeia inteira no texto ("could not connect to
 * postgres://…"). Isto cobre o **campo** do erro; a mesma cadeia sai uma segunda vez pela
 * chave de topo, promovida de `erro.message` quando o chamador não passa mensagem própria —
 * essa outra saída é fechada por {@link mascararMensagem}, não aqui. As duas são necessárias:
 * fechar só uma deixa a linha com metade da cadeia mascarada e metade legível.
 */
function redigirErro(erro: Error, emVisita: WeakSet<object>): Registro {
  const saida: Registro = { tipo: erro.name, mensagem: mascararCredencial(erro.message) };
  if (erro.stack !== undefined) {
    saida.pilha = mascararCredencial(erro.stack);
  }
  if (erro.cause !== undefined) {
    saida.causa = redigirValor(erro.cause, emVisita);
  }
  // Sub-erros de um `AggregateError` — a forma em que uma falha de conexão chega quando o
  // resolvedor tentou vários endereços (`ECONNREFUSED` por endereço). A varredura de
  // propriedades abaixo não os alcança: `.errors` é própria mas **não-enumerável**, e
  // `Object.keys` só lista enumeráveis. Descartá-los perderia justamente o diagnóstico da
  // falha — mascarar não é apagar.
  const subErros = (erro as Partial<AggregateError>).errors;
  if (Array.isArray(subErros)) {
    saida.erros = subErros.map((sub) => redigirValor(sub, emVisita));
  }

  // Propriedades próprias da exceção (`codigo`, `status`, o que quem levantou tenha anexado).
  const proprias = erro as unknown as Registro;
  for (const chave of Object.keys(proprias)) {
    if (chave in saida) {
      continue;
    }
    saida[chave] = ehChaveSensivel(chave)
      ? SENTINELA_REDIGIDO
      : redigirValor(proprias[chave], emVisita);
  }

  return saida;
}

function ehChaveSensivel(chave: string): boolean {
  return contemRadicalSensivel(chave, RADICAIS_SENSIVEIS);
}

/**
 * Normaliza o nome (minúscula, sem separador) e responde se ele contém algum dos radicais.
 *
 * É o **único** normalizador do projeto, compartilhado pela chave do evento e pelo nome do
 * parâmetro de endereço: duas cópias divergiriam no dia em que um radical ganhasse hífen ou
 * caixa, e a divergência só apareceria como vazamento.
 */
function contemRadicalSensivel(nome: string, radicais: readonly string[]): boolean {
  const normalizado = nome.toLowerCase().replace(/[^a-z0-9]/g, '');
  return radicais.some((radical) => normalizado.includes(radical));
}
