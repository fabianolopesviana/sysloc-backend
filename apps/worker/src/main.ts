/**
 * Ponto de entrada do processador de trabalho.
 *
 * ---------------------------------------------------------------------------
 * Desligamento gracioso
 * ---------------------------------------------------------------------------
 *
 * O supervisor do sistema operacional encerra o processo por sinal a cada reinício, e uma tarefa
 * cortada no meio é trabalho perdido — no domínio desta aplicação, cobrança não enviada e boleto
 * não emitido. Ao receber o sinal, o processo para de aceitar tarefa nova, **espera a que está em
 * andamento terminar** e só então devolve a conexão ({@link Fila.encerrar}). Um segundo sinal
 * durante essa janela é ignorado de propósito: ele significaria abandonar exatamente a tarefa que
 * se está esperando — e a espera tem prazo próprio, declarado em `fila.ts`, de modo que ignorar o
 * segundo sinal não é abrir mão de terminar.
 *
 * No desfecho normal o processo termina sozinho quando o encerramento devolve o último recurso.
 * No desfecho anômalo — prazo estourado ou falha ao devolver — ele termina **por decisão própria**,
 * depois da linha que explica por quê: a biblioteca de fila mantém por dentro uma conexão
 * duplicada, sem endereço público, que segue tentando reconectar e segura o laço de eventos.
 * Verificado nesta máquina: sem o término explícito, o processo não morre. Terminar aqui, com o
 * motivo já no journal, é melhor do que esperar o `SIGKILL` do supervisor, que não deixa registro
 * nenhum e leva a unidade para `failed`.
 *
 * ---------------------------------------------------------------------------
 * Falha de partida
 * ---------------------------------------------------------------------------
 *
 * Configuração inválida derruba o processo na partida, com uma mensagem que **nomeia cada variável
 * com problema** — e nunca o valor recebido, porque cadeia de conexão carrega credencial e a
 * mensagem vai para o journal. Subir e quebrar no primeiro uso é o comportamento que a validação
 * existe para impedir: o supervisor reportaria um serviço `active` que não consome tarefa alguma.
 *
 * ⚠️ **Aqui o modo perigoso é o inverso do habitual** (CA-17). Desde que este processo passou a
 * falar com um servidor de e-mail, *"tentar mesmo assim"* não degrada em erro: um transporte
 * construído a partir de cadeia vazia aponta para o `localhost` que a biblioteca assume por
 * omissão, e o que estava em jogo era alcançar a caixa de uma pessoa real. A barreira **falha
 * fechado** em dois degraus, e os dois são de partida: {@link lerAmbiente} recusa a variável
 * **não declarada**, e `criarAdaptadorSmtp` recusa a que está declarada e **não serve como
 * endereço** — construído antes de qualquer recurso ser aberto, de modo que a recusa dele não
 * deixa reserva nem conexão para trás.
 *
 * ⚠️ **Para a base do link de confirmação os DOIS degraus moram aqui**, e a diferença não é
 * inconsistência: a `SMTP_URL` tem um segundo conferidor porque alguém a **constrói**
 * (`coordenadasDoTransporte`, na partida); a `URL_BASE_DA_CONFIRMACAO` não tem construtor nenhum —
 * quem a consome é uma composição **pura** de `@sysloc/documentos`, que remove barras finais e
 * concatena, de modo que qualquer cadeia não-vazia produziria link. E a `api` **deferiu a forma a
 * este processo por escrito** (`apps/api/src/configuracao/ambiente.ts`), justamente para que ela
 * seja decidida num lugar só. Sem o degrau de forma, uma base sem esquema — `app.sysloc.com.br`, a
 * digitação mais provável de um operador — sobe verde, a tarefa conclui, o journal grava
 * *"confirmação de e-mail entregue"* e o locatário recebe um endereço que não abre: falha
 * silenciosa e **posterior à entrega**, que é o pior desfecho desta borda.
 *
 * ---------------------------------------------------------------------------
 * A composição raiz escolhe as portas — e é a ÚNICA que as escolhe
 * ---------------------------------------------------------------------------
 *
 * É daqui que saem a reserva de conexões, o adaptador de produção de e-mail, o **adaptador do
 * provedor bancário** e a **guarda dos bytes do boleto**, e é por **parâmetro** que eles chegam à
 * borda do trabalho (ADR-0025). A verificação entrega os dublês pelos mesmos parâmetros, e é isso que
 * a torna incapaz de alcançar rede: não existe bandeira, variável de ambiente ou ramo que escolha
 * entre as implementações — a escolha é de quem compõe.
 *
 * ⚠️ **A chave que abre o envelope do certificado também sai daqui**, e é a mesma disciplina: as duas
 * bordas bancárias a recebem por parâmetro, e nenhuma delas lê `process.env`. É o que mantém a
 * conferência de partida como a **única** fonte da chave neste processo.
 *
 * ---------------------------------------------------------------------------
 * Por que a partida está atrás de um guarda
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina de `apps/api/src/main.ts`: o módulo só sobe o processador quando é EXECUTADO
 * como programa. Importá-lo não liga consumidor nenhum.
 */

import { accessSync, constants, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarAdaptadorSicoob, criarGuardaDeBoletos } from '@sysloc/cobranca-bancaria';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '@sysloc/db';
import { criarAdaptadorSmtp } from '@sysloc/regua';
import {
  criarLogger,
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
} from '@sysloc/shared';
import { conectarFila, type DesfechoDoEncerramento, type Fila } from './fila.js';
import { processarConferenciaBancaria } from './tarefas/conferencia-bancaria.js';
import { processarConfirmacaoDeEmail } from './tarefas/confirmacao-de-email.js';
import { processarEco } from './tarefas/eco.js';
import { processarEmissaoEmLote } from './tarefas/emissao-em-lote.js';
import { processarNotificacaoBancaria } from './tarefas/notificacao-bancaria.js';
import { processarReguaDeCobranca } from './tarefas/regua.js';

/** Sinais pelos quais o supervisor pede o encerramento. */
const SINAIS_DE_DESLIGAMENTO = ['SIGTERM', 'SIGINT'] as const;

/**
 * Prazo da devolução da reserva de conexões, **depois** de a fila já ter sido devolvida.
 *
 * Ele existe pela mesma razão medida que fez o encerramento da fila ganhar prazo próprio (ver o
 * marcador `DECISÃO FECHADA` de `./fila.ts`): recurso que não é devolvido segura o laço de eventos,
 * e o processo fica vivo sem consumir nada até o `SIGKILL` do supervisor — que não deixa registro e
 * leva a unidade para `failed`. Uma reserva com consulta pendente contra um banco que não responde
 * é exatamente esse caso, e ele acontece no desligamento do sistema.
 *
 * O valor soma com o prazo da fila (15 s) e fica **abaixo** do `TimeoutStopSec` de 30 s que as duas
 * unidades declaram: quem desiste primeiro precisa ser o processo, que sabe explicar no journal por
 * que desistiu.
 */
const LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS = 5_000;

/** Configuração validada do processador. */
export interface Ambiente {
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão da fila, de `REDIS_URL`. */
  readonly cadeiaConexaoFila: string;
  /** Cadeia de conexão do banco, de `DATABASE_URL`. */
  readonly cadeiaConexaoBanco: string;
  /** Cadeia de conexão do servidor de e-mail, de `SMTP_URL`. **Carrega credencial**. */
  readonly urlDoTransporte: string;
  /** Endereço que assina o aviso, de `EMAIL_REMETENTE`. */
  readonly remetenteDoAviso: string;
  /**
   * Endereço público do aplicativo, de `URL_BASE_DA_CONFIRMACAO` — a base do link de confirmação.
   *
   * Ele **é campo aqui**, e não é do lado do serviço de aplicação: quem monta o link é este
   * processo, e a composição da mensagem recebe a base **por parâmetro** (ADR-0025). Na `api` a
   * variável é exigida na partida e não vira campo, porque lá ela não tem consumidor — a diferença
   * está registrada no `ambiente.ts` daquele lado, e não é descuido de nenhum dos dois.
   *
   * **Não é segredo** — é o endereço público do app —, mas é exigida na partida pela mesma razão que
   * as demais: um link montado sobre base vazia chega quebrado à caixa do locatário, e nada no
   * processo acusaria. Pela **mesma** razão a **forma** dela é conferida na partida
   * ({@link ehBaseDeConfirmacaoValida}): base sem esquema tem falha idêntica, e igualmente muda.
   */
  readonly urlBaseDaConfirmacao: string;
  /**
   * A chave que abre o envelope do certificado do provedor, de `CHAVE_DE_CIFRA_DO_CERTIFICADO`.
   *
   * **É o segredo mais forte deste processo**, e ele passa a existir aqui porque a superfície que
   * pode decifrar o material do certificado passa de **um processo para dois** — o trade-off
   * declarado da §11.6 da `tech_spec.md`, aceito porque a alternativa (transportar o material na
   * carga da tarefa) é o vetor exato do achado crítico da fase anterior. O `EnvironmentFile` já é
   * **compartilhado** entre as duas unidades systemd: este processo já **recebia** a chave
   * fisicamente; o que faltava era consumo declarado.
   *
   * Ela chega **já decodificada**, exatamente como do lado do serviço de aplicação: é assim que a
   * cifra a consome, e a conferência de partida precisou decodificá-la para medir os 32 bytes — uma
   * segunda decodificação na borda seria uma segunda declaração da codificação.
   *
   * Ela não é registrada, não viaja em `argv`, não entra em carga de tarefa e não é ecoada em
   * mensagem de erro: a recusa de partida nomeia a **variável e o tamanho exigido**. Trocá-la torna
   * ilegível todo envelope já gravado, e é por isso que ela vive em `EnvironmentFile` 0600.
   */
  readonly chaveDeCifraDoCertificado: Buffer;
  /**
   * O endereço do provedor bancário, de `ENDERECO_DO_PROVEDOR_BANCARIO`.
   *
   * Ele **não é segredo** — é o endereço público de uma instituição —, e mora aqui porque é esta
   * composição que constrói o adaptador a partir dele (ADR-0025: o pacote de domínio não lê
   * `process.env`). Ele vem do ambiente, **nunca** da carga da tarefa: é essa origem que impede uma
   * entrada externa de decidir para onde o produto conecta apresentando o certificado de uma empresa.
   *
   * A **forma** não é conferida na leitura, e a ausência é decisão — o precedente é o da `SMTP_URL`:
   * quem recusa o endereço que não serve é `resolverDestino`, dentro de `criarAdaptadorSicoob`, num
   * lugar só, na **construção** do adaptador. É a mesma divisão que o serviço de aplicação já faz, e
   * com a mesma razão escrita lá.
   */
  readonly enderecoDoProvedorBancario: string;
  /**
   * O diretório onde os bytes do boleto são guardados, de `DIRETORIO_DOS_BOLETOS`.
   *
   * Ele **não é segredo** — é um caminho de sistema de arquivos —, e tem campo aqui porque **este**
   * processo grava nele: é o percurso do lote que pede à guarda para gravar os bytes que o provedor
   * devolveu. Ele chega **como veio**, sem resolução: quem o resolve, uma vez, é
   * `criarGuardaDeBoletos`.
   */
  readonly diretorioDosBoletos: string;
}

/**
 * Os esquemas que a base do link de confirmação aceita — lista **fechada**, e só os dois.
 *
 * O valor vira o endereço que o locatário abre no navegador. `mailto:`, `file:` e `javascript:` são
 * URLs absolutas legítimas para o interpretador e não levam à página de confirmação — recusar por
 * lista fechada é o que impede a barreira de ficar dependente de quais digitações erradas alguém
 * lembrou de enumerar.
 */
const ESQUEMAS_DA_BASE_DA_CONFIRMACAO = ['http:', 'https:'] as const;

/**
 * O que a recusa por **forma** diz — a exigência, e nunca o valor recebido.
 *
 * O texto é **derivado** da lista acima, e não redigitado, pela mesma razão de
 * `EXIGENCIA_DA_CADEIA_DE_FILA` em `@sysloc/shared`: mensagem que diverge da regra manda o operador
 * procurar o problema errado, e é divergência que ferramenta nenhuma apanha.
 */
const EXIGENCIA_DA_BASE_DA_CONFIRMACAO = `deve ser um endereço interpretável começando com ${ESQUEMAS_DA_BASE_DA_CONFIRMACAO.map(
  (esquema) => `${esquema}//`,
).join(' ou ')}`;

/**
 * A base declarada serve como endereço público do aplicativo?
 *
 * São dois requisitos, e os dois importam: a **interpretabilidade** (uma base sem esquema não é URL
 * absoluta, e concatenada ao caminho produz um endereço relativo que cliente de e-mail nenhum abre)
 * e o **esquema** (o interpretador aceita `javascript:` e `file:` como URLs absolutas, e nenhum dos
 * dois leva à página).
 *
 * A ordem é conteúdo: interpretar primeiro é o que dispensa um terceiro requisito. Para os dois
 * esquemas aceitos, o interpretador **exige** servidor — medido nesta máquina: `https://` e
 * `http://:8080` levantam, e não há valor aceito por `URL.parse` com esquema `http`/`https` e
 * `hostname` vazio. Um ramo para o servidor vazio seria inalcançável, e asserção que não pode falhar
 * é o que a `.claude/rules/testing-stack.md` proíbe.
 *
 * ⚠️ O valor **não é normalizado aqui**, e a ausência é decisão: quem remove barras finais é a
 * composição da mensagem (`packages/documentos/src/mensagem-de-confirmacao.ts`), num lugar só. Esta
 * função **decide**, e não transforma — devolver a forma canônica faria a configuração publicar um
 * valor diferente do que o operador escreveu, e a normalização passaria a ter duas definições.
 */
function ehBaseDeConfirmacaoValida(valor: string): boolean {
  const endereco = URL.parse(valor);

  return (
    endereco !== null &&
    ESQUEMAS_DA_BASE_DA_CONFIRMACAO.some((esquema) => esquema === endereco.protocol)
  );
}

/**
 * Comprimento **exato**, em bytes, da chave que cifra o segredo do certificado do provedor.
 *
 * É o que o AES-256-GCM exige, e por isso o piso e o teto são o mesmo número: uma chave de 31 ou de
 * 33 bytes não é "uma chave fraca", é uma chave que o algoritmo **não aceita**, e o processo que
 * subisse com ela falharia na primeira tarefa de emissão — depois de o Admin ter aberto o lote.
 */
const BYTES_DA_CHAVE_DE_CIFRA = 32;

/** A exigência que a recusa da chave publica — nomeia a variável e o tamanho, jamais o valor. */
const EXIGENCIA_DA_CHAVE_DE_CIFRA = `deve ser exatamente ${BYTES_DA_CHAVE_DE_CIFRA} bytes em base64`;

// DÉBITO COM GATILHO — D51 · F4/T16 · registrado 2026-08-18
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: {@link ehChaveDeCifraAceitavel} e {@link ehDiretorioGravavel} — com as três constantes que
//        as acompanham — existem DUAS vezes: aqui e em `apps/api/src/configuracao/ambiente.ts`. Os
//        dois processos sobem do MESMO `EnvironmentFile`, e é exatamente o caso que o cabeçalho de
//        `packages/shared/src/ambiente.ts` nomeia: com a regra escrita duas vezes, endurecer uma faz
//        um processo subir e o outro recusar o mesmo arquivo — e a divergência aparece **no boot**,
//        o momento mais caro para descobri-la.
// QUANDO FECHA: a primeira task autorizada a abrir `apps/api/src/configuracao/ambiente.ts` por outra
//        razão, ou o TERCEIRO processo que exigir qualquer uma das duas variáveis. Ali as duas
//        conferências sobem para `packages/shared/src/ambiente.ts`, que já é a casa declarada das
//        regras de forma compartilhadas (é de lá que vêm `ehCadeiaDeFilaValida` e `NIVEIS_DE_LOG`).
// POR QUE NÃO AGORA: `apps/api/src/configuracao/ambiente.ts` e `packages/shared/src/` estão fora da
//        lista de arquivos da T16, e mover a definição alteraria a composição raiz do processo que
//        atende requisição — área crítica de `secrets/config` — por uma task cujo escopo declarado é
//        o processo de trabalho. O que a T16 podia fazer sem alargar escopo era não deixar o
//        processo de trabalho SEM a conferência, que é o que a §6.1 da `tech_spec.md` cobra dele
//        nominalmente ("conferência de partida (api **e** worker)").
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D51

/**
 * A chave decodifica para **exatamente** 32 bytes, e o texto recebido é base64 canônico?
 *
 * As duas metades são uma conferência só, de propósito: `Buffer.from(valor, 'base64')` **ignora em
 * silêncio** todo caractere fora do alfabeto, de modo que uma chave copiada com um espaço no meio
 * decodificaria para outros bytes sem que nada acusasse — e o acervo cifrado com ela ficaria
 * ilegível no dia em que alguém "consertasse" o valor. A volta (`toString('base64')`) é o que torna
 * a decodificação **reversível**, e portanto o que faz o valor do arquivo de ambiente e a chave em
 * uso serem o mesmo fato.
 */
function ehChaveDeCifraAceitavel(valor: string): boolean {
  const bytes = Buffer.from(valor, 'base64');

  return bytes.length === BYTES_DA_CHAVE_DE_CIFRA && bytes.toString('base64') === valor;
}

/** A exigência que a recusa do diretório dos boletos publica — nomeia a forma, jamais o valor. */
const EXIGENCIA_DO_DIRETORIO_DOS_BOLETOS = 'deve ser o caminho absoluto de um diretório gravável';

/**
 * O caminho é absoluto **e** aponta para um diretório em que este processo consegue escrever?
 *
 * ---------------------------------------------------------------------------
 * Por que ESTE processo confere, e não só o serviço de aplicação
 * ---------------------------------------------------------------------------
 *
 * É aqui que a gravação de fato acontece: o percurso do lote pede à guarda para gravar os bytes que o
 * provedor devolveu, uma vez por cobrança. Sem a conferência de partida, o processo sobe, o provedor
 * **emite o título** e a gravação falha depois — fica um boleto vivo no banco cujo documento o
 * produto não tem, que é exatamente o estado que a CA-08 existe para rebuscar. Recusar na partida põe
 * o custo no operador, na instalação, onde ele é barato. A §6.1 da `tech_spec.md` fixa a conferência
 * nos **dois** processos, nominalmente.
 *
 * As duas metades são UMA conferência só, pela mesma razão de {@link ehChaveDeCifraAceitavel}:
 * separá-las produziria duas recusas para o mesmo defeito operacional — *o produto não tem onde
 * gravar boleto*. O caminho **relativo** é recusado antes de o disco ser tocado, e a ordem é
 * conteúdo: um caminho relativo é resolvido contra o diretório de trabalho do processo, de modo que
 * ele passaria a conferência de escrita **e** apontaria para lugares diferentes conforme quem
 * iniciasse o serviço.
 *
 * A leitura é de **permissão**, não de conteúdo: nada é criado, nada é escrito e nada é listado. Quem
 * confere o **dono** e o **modo** na máquina que atende a operação é
 * `deploy/scripts/cobranca-bancaria/verificar-guarda-de-boletos.sh`.
 */
function ehDiretorioGravavel(valor: string): boolean {
  if (!isAbsolute(valor)) {
    return false;
  }

  try {
    // As duas perguntas na ordem em que o defeito aparece: *é diretório?* antes de *dá para
    // escrever?*. Um arquivo comum gravável satisfaria a segunda sozinha, e o primeiro boleto
    // falharia ao tentar criar o intermediário dentro dele.
    if (!statSync(valor).isDirectory()) {
      return false;
    }

    accessSync(valor, constants.W_OK);
  } catch {
    // A causa concreta — ausente, sem permissão, caminho quebrado — **não** viaja: a mensagem de
    // partida nomeia a variável e a exigência, e nunca o valor recebido nem o texto do sistema
    // operacional, que carregaria o caminho dentro dele.
    return false;
  }

  return true;
}

/**
 * Lê e valida as variáveis que o processador exige.
 *
 * São **nove** desde a T16 da fatia `emissao-e-conciliacao`, e o crescimento é a natureza do
 * processo mudando: ele deixou de ser um consumidor que só fala com a fila (T6), passou a falar com o
 * **banco** e com um **servidor de e-mail** (T8), passou a **montar um link** para o titular do dado
 * (T10), e agora **emite boleto e concilia pagamento junto ao provedor bancário** — o que exige a
 * chave que abre o envelope do certificado, o endereço do provedor e o diretório onde os bytes do
 * boleto são guardados.
 * O conjunto continua PRÓPRIO deste processo (ele não escuta porta, e `PORT` não entra),
 * mas as **regras** das duas variáveis originais vêm do pacote compartilhado: os dois processos
 * sobem do mesmo `EnvironmentFile`, e duas definições independentes do que é uma severidade ou uma
 * cadeia de fila válida divergiriam em silêncio até um arquivo subir um processo e recusar o outro
 * — no boot.
 *
 * O critério que separa *"exigir presença"* de *"exigir forma"* é **onde já se decide o mesmo
 * fato**, e ele vale para as nove sem exceção. Exigem só presença e não-vacuidade as que têm um
 * segundo conferidor **na própria partida**: a `SMTP_URL`, recusada por esquema e por hospedeiro em
 * `coordenadasDoTransporte` (`@sysloc/regua`) quando o adaptador é construído, e a
 * `ENDERECO_DO_PROVEDOR_BANCARIO`, recusada por `resolverDestino` (`@sysloc/cobranca-bancaria`)
 * quando o adaptador do provedor é construído — as duas construções acontecem **antes** de qualquer
 * recurso ser aberto. Reimplementar aquelas conferências aqui criaria duas definições do mesmo fato,
 * e a segunda escaparia da primeira.
 *
 * Têm a **forma conferida aqui** as que não têm segundo conferidor: a `URL_BASE_DA_CONFIRMACAO` (ver
 * abaixo), a `CHAVE_DE_CIFRA_DO_CERTIFICADO` — cuja recusa tardia só apareceria na primeira tarefa de
 * emissão, depois de o Admin ter aberto o lote — e o `DIRETORIO_DOS_BOLETOS`, cuja recusa tardia é a
 * pior das três: o provedor já teria **emitido o título** quando a gravação falhasse. A §6.1 da
 * `tech_spec.md` da fatia `emissao-e-conciliacao` fixa a conferência do diretório nos **dois**
 * processos, nominalmente.
 *
 * A `URL_BASE_DA_CONFIRMACAO` tem a **forma conferida aqui**
 * ({@link ehBaseDeConfirmacaoValida}), e isso não contraria a divisão acima: ela a ilustra. Para a
 * base do link **não há segundo ponto** —
 * nenhum construtor a recebe, quem a consome é uma composição pura que concatena, e a `api` deferiu
 * a forma a este processo por escrito. Conferi-la na composição da mensagem seria conferir **por
 * tarefa**, depois de o processo já estar no ar e o operador já ter ido embora; conferi-la aqui é o
 * mesmo degrau que a `SMTP_URL` tem, no mesmo instante, com a mesma forma de mensagem — a exigência
 * nomeada, o valor jamais.
 *
 * Valor em branco é tratado como **ausente** porque o `.env.example` versionado declara toda
 * variável sem valor, e um arquivo copiado dele sem preenchimento entrega cadeias vazias.
 *
 * A fonte é PARÂMETRO e a falha é EXCEÇÃO, como em `apps/api/src/configuracao/ambiente.ts`: quem
 * decide abortar é o ponto de entrada, e é isso que torna a validação verificável sem subprocesso.
 *
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia
 * **todas** as variáveis com problema, e nunca ecoa o valor recebido — a cadeia da fila, a do banco,
 * a do transporte e a chave de cifra carregam segredo, e a mensagem de falha vai para o journal. A
 * disciplina vale mesmo para o que não é segredo: a regra é do formato da mensagem, e abri-la "só
 * para esta" cria a exceção que a próxima variável herda.
 */
export function lerAmbiente(fonte: Readonly<Record<string, string | undefined>>): Ambiente {
  const problemas: string[] = [];

  const nivel = fonte.LOG_LEVEL?.trim() ?? '';
  if (nivel === '') {
    problemas.push('LOG_LEVEL: ausente');
  } else if (!NIVEIS_DE_LOG.includes(nivel as NivelDeLog)) {
    problemas.push(`LOG_LEVEL: deve ser um de: ${NIVEIS_DE_LOG.join(', ')}`);
  }

  const fila = fonte.REDIS_URL?.trim() ?? '';
  if (fila === '') {
    problemas.push('REDIS_URL: ausente');
  } else if (!ehCadeiaDeFilaValida(fila)) {
    problemas.push(`REDIS_URL: ${EXIGENCIA_DA_CADEIA_DE_FILA}`);
  }

  const banco = fonte.DATABASE_URL?.trim() ?? '';
  if (banco === '') {
    problemas.push('DATABASE_URL: ausente');
  }

  const transporte = fonte.SMTP_URL?.trim() ?? '';
  if (transporte === '') {
    problemas.push('SMTP_URL: ausente');
  }

  const remetente = fonte.EMAIL_REMETENTE?.trim() ?? '';
  if (remetente === '') {
    problemas.push('EMAIL_REMETENTE: ausente');
  }

  const urlBaseDaConfirmacao = fonte.URL_BASE_DA_CONFIRMACAO?.trim() ?? '';
  if (urlBaseDaConfirmacao === '') {
    problemas.push('URL_BASE_DA_CONFIRMACAO: ausente');
  } else if (!ehBaseDeConfirmacaoValida(urlBaseDaConfirmacao)) {
    problemas.push(`URL_BASE_DA_CONFIRMACAO: ${EXIGENCIA_DA_BASE_DA_CONFIRMACAO}`);
  }

  const chaveDeCifra = fonte.CHAVE_DE_CIFRA_DO_CERTIFICADO?.trim() ?? '';
  if (chaveDeCifra === '') {
    problemas.push('CHAVE_DE_CIFRA_DO_CERTIFICADO: ausente');
  } else if (!ehChaveDeCifraAceitavel(chaveDeCifra)) {
    problemas.push(`CHAVE_DE_CIFRA_DO_CERTIFICADO: ${EXIGENCIA_DA_CHAVE_DE_CIFRA}`);
  }

  const enderecoDoProvedor = fonte.ENDERECO_DO_PROVEDOR_BANCARIO?.trim() ?? '';
  if (enderecoDoProvedor === '') {
    problemas.push('ENDERECO_DO_PROVEDOR_BANCARIO: ausente');
  }

  const diretorioDosBoletos = fonte.DIRETORIO_DOS_BOLETOS?.trim() ?? '';
  if (diretorioDosBoletos === '') {
    problemas.push('DIRETORIO_DOS_BOLETOS: ausente');
  } else if (!ehDiretorioGravavel(diretorioDosBoletos)) {
    problemas.push(`DIRETORIO_DOS_BOLETOS: ${EXIGENCIA_DO_DIRETORIO_DOS_BOLETOS}`);
  }

  if (problemas.length > 0) {
    throw new Error(
      `configuração inválida na partida: ${problemas.join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  return {
    nivelDeLog: nivel as NivelDeLog,
    cadeiaConexaoFila: fila,
    cadeiaConexaoBanco: banco,
    urlDoTransporte: transporte,
    remetenteDoAviso: remetente,
    urlBaseDaConfirmacao,
    // A transformação para `Buffer` acontece **aqui**, e a posição é conteúdo: a conferência já
    // decodificou para medir os 32 bytes, e publicar o texto obrigaria cada borda a decodificar de
    // novo — uma segunda declaração da codificação, livre para divergir da que conferiu.
    chaveDeCifraDoCertificado: Buffer.from(chaveDeCifra, 'base64'),
    enderecoDoProvedorBancario: enderecoDoProvedor,
    diretorioDosBoletos,
  };
}

/**
 * Termina o processo depois de um encerramento que NÃO devolveu tudo o que abriu.
 *
 * Só é alcançado no desfecho anômalo, e a razão é medida, não suposta: a biblioteca de fila
 * duplica a conexão por dentro para a leitura bloqueante e não publica endereço para ela, de modo
 * que uma reconexão pendurada nessa cópia segue segurando o laço de eventos mesmo depois de a
 * conexão de topo ter sido devolvida — o processo fica vivo sem consumir nada até o `SIGKILL` do
 * supervisor, que não deixa registro e leva a unidade para `failed`.
 *
 * `process.exit()` sem argumento **preserva** o `process.exitCode` já definido, em vez de o
 * sobrescrever. E não há linha a caminho para truncar: o registrador escreve de forma síncrona
 * (`packages/shared/src/log.ts`), justamente para que as últimas linhas — as que explicam a morte —
 * cheguem ao journal.
 */
function terminarPorDecisaoPropria(): never {
  process.exit();
}

/**
 * Devolve a reserva de conexões com o banco, em **tempo limitado**.
 *
 * A falha é registrada e **não sobe**: no desligamento, uma rejeição aqui derrubaria o caminho que
 * termina o processo com registro, trocando um diagnóstico por um travamento. O que o chamador
 * precisa saber é apenas se a devolução aconteceu dentro do prazo — ver
 * {@link LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS} para por que o prazo existe.
 *
 * @returns `true` quando a reserva foi devolvida dentro do prazo.
 */
async function devolverReserva(banco: AcessoAoBanco, logger: Logger): Promise<boolean> {
  let prazo: NodeJS.Timeout | undefined;
  const expirar = new Promise<false>((resolver) => {
    prazo = setTimeout(() => resolver(false), LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS);
  });

  try {
    return await Promise.race([banco.encerrar().then(() => true), expirar]);
  } catch (erro) {
    logger.error({ erro }, 'falha ao devolver a reserva de conexões com o banco');

    return false;
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * Devolve os recursos do processo, na ordem que o trabalho em voo exige.
 *
 * A **fila primeiro**: encerrá-la espera a tarefa em andamento terminar, e essa tarefa ainda
 * consulta o banco — fechar a reserva antes derrubaria no meio exatamente o trabalho que a espera
 * existe para não abandonar. A reserva depois, e **incondicionalmente**, inclusive quando o
 * encerramento da fila falhou: enquanto ela estiver de pé o processo não termina, e a falha da fila
 * deixaria de ser diagnóstico para virar travamento.
 *
 * A reserva que não é devolvida no prazo rebaixa o desfecho para `PRAZO-ESTOURADO` — é o valor que
 * o chamador consome para terminar o processo por decisão própria, e ele descreve o encerramento
 * inteiro, não só a fila.
 */
async function devolverRecursos(
  fila: Fila,
  banco: AcessoAoBanco,
  logger: Logger,
): Promise<DesfechoDoEncerramento> {
  try {
    const desfecho = await fila.encerrar();

    return (await devolverReserva(banco, logger)) ? desfecho : 'PRAZO-ESTOURADO';
  } catch (erro) {
    await devolverReserva(banco, logger);

    throw erro;
  }
}

/**
 * Atende ao sinal do supervisor encerrando a fila sem abandonar a tarefa em andamento.
 *
 * O ouvinte fica registrado em `process`, que já está vivo — ele não segura o laço de eventos, de
 * modo que o processo termina naturalmente assim que o encerramento devolver o último recurso.
 */
function instalarDesligamentoGracioso(fila: Fila, banco: AcessoAoBanco, logger: Logger): void {
  let encerrando = false;

  for (const sinal of SINAIS_DE_DESLIGAMENTO) {
    process.on(sinal, () => {
      if (encerrando) {
        return;
      }
      encerrando = true;
      logger.info({ sinal }, 'desligamento pedido — aguardando a tarefa em andamento terminar');

      devolverRecursos(fila, banco, logger).then(
        (desfecho) => {
          logger.info({ sinal, desfecho }, 'processador de trabalho encerrado');
          if (desfecho !== 'RECURSOS-DEVOLVIDOS') {
            terminarPorDecisaoPropria();
          }
        },
        (erro: unknown) => {
          logger.error({ erro, sinal }, 'falha ao encerrar o processador de trabalho');
          process.exitCode = 1;
          terminarPorDecisaoPropria();
        },
      );
    });
  }
}

async function principal(): Promise<void> {
  const ambiente = lerAmbiente(process.env);
  const logger = criarLogger({ nivel: ambiente.nivelDeLog });

  // O adaptador de produção é construído ANTES de qualquer recurso ser aberto, e a ordem é
  // conteúdo: ele **recusa a partida** quando a `SMTP_URL` não serve como endereço, e uma recusa
  // depois da reserva ou da conexão deixaria as duas para trás num processo que morre.
  const email = criarAdaptadorSmtp({
    urlDoTransporte: ambiente.urlDoTransporte,
    remetente: ambiente.remetenteDoAviso,
  });
  // Pela MESMA razão, e no mesmo instante: `criarAdaptadorSicoob` recusa a partida quando o endereço
  // do provedor não serve — é o segundo degrau que a leitura do ambiente deliberadamente não tem —, e
  // essa recusa precisa acontecer antes de a reserva e a conexão existirem.
  const provedor = criarAdaptadorSicoob({
    enderecoDoProvedor: ambiente.enderecoDoProvedorBancario,
  });
  // A guarda **resolve** o diretório-base uma vez, aqui, e não o cria nem o confere: quem o confere
  // é a partida (ver {@link ehDiretorioGravavel}), num lugar só.
  const guarda = criarGuardaDeBoletos(ambiente.diretorioDosBoletos);
  const banco = abrirAcessoAoBanco({ cadeiaDeConexao: ambiente.cadeiaConexaoBanco });
  const fila = conectarFila(ambiente.cadeiaConexaoFila, logger);

  try {
    fila.processar(fila.eco, processarEco);
    fila.processar(
      fila.regua,
      async (tarefa, registrador) =>
        await processarReguaDeCobranca(tarefa, registrador, { banco, email }),
    );
    fila.processar(
      fila.confirmacao,
      async (tarefa, registrador) =>
        await processarConfirmacaoDeEmail(tarefa, registrador, {
          banco,
          email,
          // A base do link atravessa a borda até a composição por PARÂMETRO: o domínio não lê
          // ambiente, e uma segunda leitura escaparia desta conferência de partida.
          urlBaseDaConfirmacao: ambiente.urlBaseDaConfirmacao,
        }),
    );
    fila.processar(
      fila.emissaoEmLote,
      async (tarefa, registrador) =>
        await processarEmissaoEmLote(tarefa, registrador, {
          banco,
          adaptador: provedor,
          guarda,
          // A chave atravessa a borda por PARÂMETRO: o domínio não lê ambiente, e uma segunda
          // leitura escaparia da conferência de partida.
          chaveDeCifra: ambiente.chaveDeCifraDoCertificado,
        }),
    );
    fila.processar(
      fila.conferenciaBancaria,
      async (tarefa, registrador) =>
        await processarConferenciaBancaria(tarefa, registrador, {
          banco,
          adaptador: provedor,
          guarda,
          chaveDeCifra: ambiente.chaveDeCifraDoCertificado,
        }),
    );
    // A terceira borda bancária deste processo, e a única cuja carga NÃO traz empresa: o contexto
    // nasce do registro que o roteamento resolve (ADR-0024, terceira emenda). As portas são as
    // mesmas das duas irmãs, e chegam pelo mesmo caminho — parâmetro, nunca ambiente lido lá dentro.
    fila.processar(
      fila.notificacaoBancaria,
      async (tarefa, registrador) =>
        await processarNotificacaoBancaria(tarefa, registrador, {
          banco,
          adaptador: provedor,
          guarda,
          chaveDeCifra: ambiente.chaveDeCifraDoCertificado,
        }),
    );
  } catch (erro) {
    // Devolver o que já foi aberto é o que permite ao processo terminar: uma conexão de pé
    // seguraria o laço de eventos e o processador ficaria vivo sem consumir nada. A falha da
    // devolução é registrada e não substitui a original — é a original que diz por que o processo
    // não subiu, e é ela que o ponto de entrada escreve na saída de erro.
    await devolverRecursos(fila, banco, logger).catch((falha: unknown) => {
      logger.error({ erro: falha }, 'falha ao devolver os recursos de uma partida frustrada');
    });
    throw erro;
  }

  instalarDesligamentoGracioso(fila, banco, logger);
  logger.info(
    {
      filas: [
        fila.eco.name,
        fila.regua.name,
        fila.confirmacao.name,
        fila.emissaoEmLote.name,
        fila.conferenciaBancaria.name,
        fila.notificacaoBancaria.name,
      ],
    },
    'processador de trabalho no ar',
  );
}

/** Este módulo foi executado como programa, ou apenas importado? */
function ehPontoDeEntrada(): boolean {
  const invocado = process.argv[1];
  return invocado !== undefined && import.meta.url === pathToFileURL(invocado).href;
}

if (ehPontoDeEntrada()) {
  principal().catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    // Código de saída em vez de encerramento imediato: a escrita acima ainda pode estar a caminho
    // do journal, e `process.exit` a truncaria — justamente a linha que diz por que o processador
    // não subiu.
    process.exitCode = 1;
  });
}
