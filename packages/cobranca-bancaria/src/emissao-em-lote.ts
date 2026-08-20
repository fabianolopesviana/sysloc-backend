/**
 * O **percurso da emissão em lote** — o laço em sequência, a distinção da RN-02 e a prestação de
 * contas por cobrança.
 *
 * ===========================================================================
 * O que este arquivo NÃO faz, e cada ausência é o mecanismo
 * ===========================================================================
 *
 * Ele não abre transação, não escreve SQL, não lê `process.env`, não lê relógio e não conhece o
 * provedor. Tudo o que toca fronteira chega **por parâmetro** (ADR-0025): o adaptador, a guarda de
 * bytes e as **seis portas de dados** declaradas abaixo. É a mesma decisão, e a mesma razão, de
 * `packages/regua/src/regua.ts` e de `./porta-de-cobranca.ts` — e é ela que torna literalmente
 * verdadeira a frase *"o domínio não conhece o banco nem o provedor"*, em vez de meia-verdade.
 *
 * A consequência mais importante é sobre a **unidade de trabalho**: quem a abre é quem satisfaz cada
 * porta, e não este laço. Uma porta que abrisse transação aqui dentro faria o domínio decidir o que
 * é da borda, e a decisão D1 (unidade aberta na borda) deixaria de valer para este caminho.
 *
 * ===========================================================================
 * UMA unidade por cobrança — e por que não uma para o lote
 * ===========================================================================
 *
 * As portas {@link PortaDaEmissaoGravada} e {@link PortaDaRecusaGravada} são satisfeitas com **uma
 * unidade de trabalho por chamada**. Uma unidade única para o lote inteiro faria a falha da décima
 * cobrança desfazer o registro das nove anteriores — e é justamente o registro que dá a idempotência
 * da repetição, porque a cobrança que já recebeu boleto **sai do conjunto por construção** na
 * seleção seguinte. É o precedente literal de `apps/worker/src/tarefas/regua.ts`, escrito lá com
 * estas mesmas palavras.
 *
 * ===========================================================================
 * A REDE corre FORA da unidade de trabalho
 * ===========================================================================
 *
 * `adaptador.emitir(...)` é aguardado entre duas chamadas de porta, e nunca dentro de uma. O que se
 * protege é a **conexão física** — recurso escasso do processo inteiro, compartilhado entre empresas
 * (tech spec §3.3): uma unidade aberta enquanto se espera o provedor segura a conexão pelo tempo do
 * aperto de mão mais o da resposta, e um lote de cem cobranças esgotaria a reserva do processo com
 * um trabalho só.
 *
 * ===========================================================================
 * A IDEMPOTÊNCIA É DO PREDICADO — e não há guarda escrita aqui (ADR-0023)
 * ===========================================================================
 *
 * **Não existe neste arquivo nenhuma verificação de *"esta cobrança já foi emitida?"***, e a ausência
 * é a decisão. O conjunto chega já recortado pelo predicado da camada de dados (`competencia = …`
 * mais `pago_em IS NULL`, `cancelado_em IS NULL` e `numero_do_titulo_no_provedor IS NULL`), e é dele, e de mais nada,
 * que sai a idempotência: o segundo lote da mesma competência seleciona exatamente o **complemento**
 * do primeiro. Uma guarda aqui seria a **segunda regra para o mesmo fato**, livre para divergir da
 * primeira e sem nada que acuse quando divergir.
 *
 * ===========================================================================
 * O ADAPTADOR CLASSIFICA; este arquivo decide o que a classificação CAUSA (RN-02)
 * ===========================================================================
 *
 * `DA_COBRANCA` marca aquela cobrança e o laço **segue**; `DA_EMPRESA` interrompe o lote no ponto, e
 * o que já saiu **permanece** (CA-03). Nada aqui **reclassifica**: só o adaptador lê a resposta do
 * provedor e só ele sabe distinguir as duas, e mover a decisão para cá reintroduziria o vocabulário
 * do provedor dentro do domínio — que é o que a ADR-0001 existe para impedir.
 *
 * A escolha do efeito passa por {@link EFEITO_POR_CLASSE}, e não por um `if` sobre o literal
 * `'DA_EMPRESA'`. A diferença é conteúdo: com o `if`, uma terceira classe declarada amanhã cairia em
 * silêncio no ramo *"segue"* — o pior desfecho, porque uma falha da empresa tratada como falha da
 * cobrança tenta as cem cobranças restantes contra um certificado que já se sabe inservível. Com o
 * `Record`, ela **não compila** até que alguém decida o que ela causa. É a promessa que o docblock de
 * {@link ClasseDaFalha} faz, materializada.
 *
 * ===========================================================================
 * O MOTIVO É PRESERVADO BYTE A BYTE (RN-15)
 * ===========================================================================
 *
 * O texto que o adaptador informou atravessa até a porta de escrita **sem ser lido, cortado,
 * traduzido ou normalizado**. É o que a prestação de contas da CA-02 publica, e é a inocuidade de um
 * motivo desconhecido que depende de nada o interpretar: nenhum ramo de decisão deste arquivo olha o
 * conteúdo dele.
 *
 * ===========================================================================
 * O QUE ACONTECE QUANDO UMA PORTA LEVANTA — e por que nada é capturado aqui
 * ===========================================================================
 *
 * Nenhuma chamada deste laço está dentro de um `try`. A exceção **sobe**, e isso é decisão, não
 * omissão:
 *
 *   * **falha transitória** (conexão do banco, disco, o provedor rejeitando a promessa contra o
 *     contrato da porta) precisa que a fila repita a tarefa. Capturá-la e interromper o lote
 *     transformaria o transitório em **definitivo**: o lote ganharia `interrompido_em`, e a
 *     repetição encontraria um lote já desfechado, sem nada a fazer;
 *   * **a recusa do desfecho do lote** — a que a camada de dados levanta quando `concluir` ou
 *     `interromper` não alcança a linha — tem **duas** causas que ela não separa: o reenvio benigno
 *     da tarefa (a entrega é *at-least-once*, e o identificador do lote viaja **na carga**) e o caso
 *     grave (alvo inexistente, ou contexto de tenant montado de outro modo). **Este arquivo não pode
 *     distingui-las**, e não deve tentar: o critério exige reler o lote sob o mesmo contexto, que é
 *     porta de dados que ele não tem, e reconhecer a classe do erro exigiria importar um símbolo da
 *     camada de dados — a aresta que a ADR-0025 recusa. Quem distingue é a **borda da tarefa**, que
 *     sabe que está reentrando; o critério dela está escrito na `T16.md` §3.1, e é lá que ele mora.
 *     Engolir a recusa aqui reinstalaria, uma camada acima, exatamente o modo de falha que a
 *     conferência da linha alcançada existe para fechar.
 *
 * ⚠️ Na repetição, o que já foi gravado **não é refeito**: as cobranças emitidas saem do conjunto
 * pelo predicado, e o laço percorre só o complemento.
 *
 * ===========================================================================
 * OS BYTES SÃO GRAVADOS ANTES DA UNIDADE, e o arquivo órfão é o preço aceito
 * ===========================================================================
 *
 * A guarda grava primeiro porque é ela que produz o **caminho**, e é o caminho que a unidade grava
 * junto dos campos de conciliação — a coluna guarda por onde alcançar os bytes, nunca os bytes
 * (ADR-0030, cláusula de exclusão: o boleto é fato recebido de terceiro). Se a unidade falhar depois
 * disso, sobra um arquivo sem linha que o aponte. É **benigno e transitório**: o nome do arquivo é
 * derivado do código da cobrança, de modo que a emissão seguinte da mesma cobrança o **sobrescreve**
 * em vez de acumular. A ordem inversa — gravar a linha e depois os bytes — trocaria isso por uma
 * cobrança com boleto anunciado e sem documento em disco, que é o defeito que a CA-08 tem de
 * rebuscar do provedor.
 */

import type { SegredoOperavel } from '@sysloc/shared';
import type { GuardaDeBoletos } from './guarda-de-boletos.js';
import type { ClasseDaFalha, LocatarioDaCobranca } from './modelo-canonico.js';
// `DesfechoDaOperacao` NÃO é citado, e a ausência é conteúdo: quem estreita a união é o `if` sobre
// `aceito`, e o compilador o faz sozinho a partir da assinatura da porta. Nomeá-lo aqui seria
// redigitar o que a porta já declara.
import type { AdaptadorCobrancaBancaria } from './porta-de-cobranca.js';

// ---------------------------------------------------------------------------
// O que a falha de cada classe CAUSA — o mapa que faz o compilador cobrar o ramo novo
// ---------------------------------------------------------------------------

/** Os dois efeitos possíveis de uma falha sobre o percurso — união fechada, e só dois. */
type EfeitoDaFalha = 'MARCA_A_COBRANCA' | 'INTERROMPE_O_LOTE';

/**
 * O que cada classe de falha provoca no percurso (RN-02).
 *
 * É `Record<ClasseDaFalha, …>` de propósito, e não um `if` sobre o literal: uma classe nova
 * declarada no vocabulário canônico **não compila** enquanto ninguém decidir o que ela causa. Ver o
 * cabeçalho para o desfecho que o `if` deixaria passar em silêncio.
 *
 * Congelado pela mesma razão de `DISPENSAS_DO_DISPARO_MANUAL` em `@sysloc/regua`: ele é lido por todo
 * percurso do processo, e uma escrita nele mudaria a decisão de todos os lotes seguintes.
 */
const EFEITO_POR_CLASSE: Readonly<Record<ClasseDaFalha, EfeitoDaFalha>> = Object.freeze({
  DA_COBRANCA: 'MARCA_A_COBRANCA',
  DA_EMPRESA: 'INTERROMPE_O_LOTE',
});

/** O efeito que cessa o percurso — nomeado para que a comparação no laço se leia como a regra. */
const EFEITO_QUE_CESSA_O_PERCURSO: EfeitoDaFalha = 'INTERROMPE_O_LOTE';

// ---------------------------------------------------------------------------
// O vocabulário do percurso — declarado aqui, satisfeito lá fora (ADR-0025)
// ---------------------------------------------------------------------------

/**
 * Uma cobrança do conjunto do lote — as **duas chaves**, e nada além.
 *
 * O `codigo` é a chave exposta (ADR-0017): é por ele que a guarda deriva o nome do arquivo e é por
 * ele que a porta de conciliação alcança a linha. O `id` é o UUID interno, que o item do lote e o
 * evento guardam como chave estrangeira **composta** — sem ele, quem grava teria de traduzir
 * código→UUID por uma consulta avulsa, que é o segundo caminho para o mesmo recorte.
 *
 * ⚠️ **Ele é declarado aqui, e não importado da camada de dados**, ainda que a projeção de lá tenha
 * hoje a mesma forma. A direção é a da ADR-0025 — o domínio declara o que atravessa a porta —, e a
 * coincidência é contingente: o dia em que a seleção passar a projetar um terceiro campo, ele entra
 * aqui **por decisão**, e não por arrasto. É a mesma razão escrita em `CandidataAoAviso`, no pacote
 * da régua.
 *
 * ⚠️ **Nada além das duas chaves.** O que a emissão precisa da cobrança — valor, vencimento,
 * locatário — chega por {@link PortaDosDadosDaCobranca}, porque o pedido depende do **cadastro do
 * locatário**, que a seleção do conjunto não alcança. Replicar os campos aqui criaria uma segunda
 * projeção da cobrança, livre para divergir da primeira.
 */
export interface CobrancaDoLote {
  /** O UUID interno — a chave estrangeira que o item e o evento guardam. */
  readonly id: string;
  /** O código legível `COB-{ano}-{7 dígitos}` — a chave exposta (ADR-0017). */
  readonly codigo: string;
}

/**
 * O que a cobrança acrescenta ao pedido de emissão — os três fatos que a seleção não carrega.
 *
 * `valor` e `vencimento` chegam **já decididos**: nada nesta camada calcula mora, e o vencimento é
 * data de calendário `YYYY-MM-DD`, nunca um `Date` — objeto de data reserializado no fuso do
 * processo desloca o dia, que é o defeito que a fronteira de dados deste produto já evita.
 *
 * O locatário é o do vocabulário canônico: **quem paga tem um nome só no produto**, e a tradução
 * para o dialeto do provedor morre no adaptador (ADR-0001).
 */
export interface DadosDaCobrancaAEmitir {
  /** O valor a cobrar, na mesma grandeza que a fronteira de dados publica. */
  readonly valor: number;
  /** Data de calendário `YYYY-MM-DD` — nunca um `Date`. */
  readonly vencimento: string;
  /** Quem paga, no vocabulário do produto. */
  readonly locatario: LocatarioDaCobranca;
}

/**
 * Os cinco fatos de conciliação que a emissão bem-sucedida deixa para gravar.
 *
 * Os três primeiros vêm do **provedor**; `identificadorNoProvedor` é o que **o produto** compôs e
 * enviou (ADR-0033) — a chave de correlação da fatia do carnê, que **não se recupera depois**, já que
 * o contador já avançou; e `caminhoDoArquivo` é o que a guarda devolveu ao gravar os bytes.
 *
 * Ele é o que atravessa {@link PortaDaEmissaoGravada}, e os cinco viajam juntos porque são gravados
 * no **mesmo ato**: uma linha com parte deles é uma cobrança com boleto pela metade.
 */
export interface BoletoParaConciliar {
  /** O número que o **provedor** atribuiu ao título. */
  readonly numeroDoTituloNoProvedor: string;
  readonly linhaDigitavel: string;
  readonly codigoDeBarras: string;
  /** As 18 posições que **o produto** compôs e enviou — única no SaaS (ADR-0033). */
  readonly identificadorNoProvedor: string;
  /** Onde a guarda gravou os bytes. Caminho, nunca conteúdo. */
  readonly caminhoDoArquivo: string;
}

/**
 * A porta que consome o contador do SaaS e devolve o identificador já composto (ADR-0020/0033).
 *
 * Ela é satisfeita **em unidade de trabalho própria**, e isso é conteúdo: o avanço do contador é
 * imune ao desfazimento, de modo que furo na sequência é aceito e o número **nunca** é reusado. Uma
 * porta que o emitisse dentro da unidade que grava faria a falha da escrita devolver o número — e
 * dois boletos poderiam nascer com a mesma chave de correlação.
 *
 * Não recebe argumento algum, pela mesma razão de {@link PortaDeCandidatas} no pacote da régua: a
 * série declara o escopo do **SaaS**, e pedir o próximo identificador em nome de uma empresa é
 * irrepresentável.
 */
export type PortaDoIdentificador = () => Promise<string>;

/** A porta que lê da cobrança o que o pedido de emissão precisa e a seleção não trouxe. */
export type PortaDosDadosDaCobranca = (cobranca: CobrancaDoLote) => Promise<DadosDaCobrancaAEmitir>;

/**
 * A porta que grava, **numa unidade de trabalho só**, tudo o que a emissão produziu.
 *
 * São três escritas no mesmo ato — os campos de conciliação da cobrança, o item `EMITIDO` do lote e
 * o evento `BOLETO_EMITIDO` da trilha —, e é o *mesmo ato* que importa: gravar o boleto sem o item
 * deixaria a prestação de contas mentindo sobre o que aconteceu, e gravar o item sem o boleto faria
 * a cobrança voltar ao conjunto do lote seguinte com o título já emitido no provedor.
 */
export type PortaDaEmissaoGravada = (
  cobranca: CobrancaDoLote,
  boleto: BoletoParaConciliar,
) => Promise<void>;

/**
 * A porta que grava a recusa **daquela** cobrança — item `RECUSADO` mais evento `EMISSAO_RECUSADA`.
 *
 * O `motivo` chega **tal como o adaptador o informou** (RN-15), e é ele que a prestação de contas
 * publica. Ele é obrigatório: item recusado sem motivo é a única forma de a CA-02 nomear a cobrança
 * e não a razão.
 */
export type PortaDaRecusaGravada = (cobranca: CobrancaDoLote, motivo: string) => Promise<void>;

/** A porta que carimba o lote como concluído — o desfecho do percurso que chegou ao fim. */
export type PortaDaConclusaoDoLote = () => Promise<void>;

/** A porta que carimba o lote como interrompido, com o motivo **tal como informado** (RN-02). */
export type PortaDaInterrupcaoDoLote = (motivo: string) => Promise<void>;

/**
 * O percurso de **um** lote — tudo o que ele precisa, e nada além.
 *
 * ⚠️ **Não há `loteId` aqui, e a ausência é o mecanismo.** Quem sabe qual lote está sendo percorrido
 * é quem satisfaz as quatro portas de escrita, por aplicação parcial na borda — exatamente como
 * `regua.ts` fecha a empresa dentro de `candidatas` e `registrar`. Um identificador de lote nesta
 * assinatura daria ao domínio a peça com que alcançar **outro** lote, e criaria um segundo lugar
 * onde se decide sobre qual linha as escritas incidem.
 *
 * ⚠️ **Também não há `competencia`.** O conjunto chega **já selecionado** pelo predicado, e a
 * competência é do predicado. Aceitá-la aqui sugeriria que este arquivo participa da seleção — que é
 * precisamente o que a ADR-0023 mantém no banco.
 */
export interface TrabalhoDoLote {
  /** A empresa em nome de quem cada ato acontece — vem da carga da tarefa (ADR-0024), nunca de rota. */
  readonly empresaId: string;
  /** O material e a senha que o abrem, **opacos** (ADR-0032). Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
  /** O conjunto do lote, na ordem em que será percorrido — recortado pelo predicado (ADR-0023). */
  readonly cobrancas: readonly CobrancaDoLote[];
  /** A porta do provedor. O de produção e o de verificação são indistintos daqui (ADR-0025). */
  readonly adaptador: AdaptadorCobrancaBancaria;
  /** A guarda dos bytes do boleto — grava e devolve o caminho relativo à base. */
  readonly guarda: GuardaDeBoletos;
  /** O contador do SaaS, em unidade própria — ver {@link PortaDoIdentificador}. */
  readonly identificador: PortaDoIdentificador;
  /** A leitura do que o pedido precisa da cobrança. */
  readonly dados: PortaDosDadosDaCobranca;
  /** A gravação da emissão — uma unidade de trabalho por chamada. */
  readonly gravarEmissao: PortaDaEmissaoGravada;
  /** A gravação da recusa — uma unidade de trabalho por chamada. */
  readonly gravarRecusa: PortaDaRecusaGravada;
  /** O carimbo de conclusão, quando o percurso chega ao fim. */
  readonly concluir: PortaDaConclusaoDoLote;
  /** O carimbo de interrupção, quando a falha é da empresa. */
  readonly interromper: PortaDaInterrupcaoDoLote;
}

/**
 * O que o percurso devolve — as contagens e o desfecho, para a borda registrar e decidir.
 *
 * `cobrancas` é o tamanho do **conjunto**, e não o número de tentativas: é ele que responde *"o lote
 * correu e não havia nada a emitir"*, que é diferente de *"correu e recusou tudo"*. Num lote
 * interrompido, `emitidas + recusadas` é menor que ele — e a diferença é exatamente o que **não foi
 * tentado**, que é a afirmação central da CA-03.
 *
 * `interrompido` é **derivado** de `motivoDaInterrupcao`, e existe pela mesma razão de `houveFalha`
 * em `ResultadoDaRegua`: quem lê o desfecho é a borda, e deixá-la recompor a condição criaria um
 * segundo lugar onde se decide o que conta como interrupção — o primeiro a divergir faria a borda
 * relatar o oposto do que aconteceu.
 */
export interface DesfechoDoLote {
  /** Quantas cobranças o conjunto trazia. */
  readonly cobrancas: number;
  /** Quantas terminaram com boleto emitido e gravado. */
  readonly emitidas: number;
  /** Quantas o provedor recusou por causa própria delas. */
  readonly recusadas: number;
  /** `true` quando uma falha da empresa cessou o percurso. */
  readonly interrompido: boolean;
  /** O motivo da interrupção, **tal como informado**; `null` quando o lote chegou ao fim. */
  readonly motivoDaInterrupcao: string | null;
}

/**
 * Percorre o conjunto do lote **em sequência** e grava o desfecho de cada cobrança.
 *
 * A sequência é conteúdo, e não simplicidade: as chamadas ao provedor acontecem uma de cada vez, sob
 * a mesma identidade, e a decisão de parar depende do desfecho da anterior — um percurso concorrente
 * teria emitido as cinco seguintes antes de saber que o certificado da empresa não serve, que é o
 * oposto da CA-03.
 *
 * Para cada cobrança, nesta ordem: lê o que falta do pedido, consome o contador, emite pelo provedor
 * **fora de qualquer unidade de trabalho**, e grava o desfecho.
 *
 * ⚠️ **A leitura vem ANTES do contador**, e a ordem é deliberada. A tech spec numera o contador como
 * primeiro passo, e a leitura não aparece lá porque a spec não a enumera; entre as duas, ler primeiro
 * é o que evita queimar um número quando o cadastro do locatário não pode ser lido. O furo continua
 * **aceito** (ADR-0020) — o que se evita é o furo desnecessário, e nenhuma decisão depende disso.
 *
 * @throws Repassa, sem capturar, toda falha das portas e da guarda — ver o cabeçalho para por que
 * nada é capturado aqui, e em especial por que a recusa do desfecho do lote pertence à borda.
 */
export async function executarEmissaoEmLote(trabalho: TrabalhoDoLote): Promise<DesfechoDoLote> {
  const { adaptador, cobrancas, empresaId, guarda, segredo } = trabalho;

  let emitidas = 0;
  let recusadas = 0;
  let motivoDaInterrupcao: string | null = null;

  for (const cobranca of cobrancas) {
    const dados = await trabalho.dados(cobranca);
    const identificadorNoProvedor = await trabalho.identificador();

    // Fora de unidade de trabalho, por decisão — ver o cabeçalho. O pedido é montado aqui, no ponto
    // de uso, e nenhum campo dele sobrevive ao laço.
    const desfecho = await adaptador.emitir({
      empresaId,
      segredo,
      identificadorNoProvedor,
      valor: dados.valor,
      vencimento: dados.vencimento,
      locatario: dados.locatario,
    });

    if (!desfecho.aceito) {
      if (EFEITO_POR_CLASSE[desfecho.classe] === EFEITO_QUE_CESSA_O_PERCURSO) {
        // O que já saiu PERMANECE (CA-03): nada é desfeito, e nenhuma cobrança posterior é tentada —
        // nem esta, que não ganha item. O motivo viaja intacto até o carimbo do lote.
        motivoDaInterrupcao = desfecho.motivo;
        break;
      }

      await trabalho.gravarRecusa(cobranca, desfecho.motivo);
      recusadas += 1;
      continue;
    }

    // DÉBITO COM GATILHO — D34 · F4/T11 · registrado 2026-08-17
    // (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo. A ORDEM das
    //  três chamadas está CERTA e não se altera — ver o cabeçalho.)
    // O QUÊ: a sequência `adaptador.emitir` → `guarda.gravar` → `trabalho.gravarEmissao` tem uma
    //        janela NÃO-TRANSACIONAL. Morrendo o processo entre a primeira e a terceira, o provedor
    //        tem título vivo e o banco tem as colunas nulas; o `identificadorNoProvedor` do título
    //        nasceu em unidade própria e NUNCA foi persistido, de modo que não há chave de correlação
    //        para o órfão. A cobrança volta ao conjunto do lote seguinte (*"em aberto e sem boleto"*)
    //        e um SEGUNDO título nasce — dois pagáveis, que é o que a métrica nº 1 do PRD proíbe. A
    //        mesma sequência existe em `./reemissao.ts`; a origem é aqui.
    // QUANDO FECHA: quando existir caminho para RECONCILIAR o órfão. Medido na T12 e registrado ali:
    //        a conferência NÃO pode fazê-lo hoje — `ConsultaDeSituacao` pergunta pelo
    //        `numeroDoTituloNoProvedor`, que é atribuído PELO provedor e que o órfão nunca recebeu, e
    //        perguntar pelo identificador que o produto enviou seria uma QUINTA operação na porta,
    //        que a emenda de 2026-08-17 da ADR-0001 fixa em quatro. O gatilho é, portanto, a fatia
    //        que trouxer a notícia recebida do provedor (a (iii)) ou a que ampliar o modelo canônico
    //        para perguntar pelo identificador enviado.
    // ⚠️ QUANDO FECHA — EMENDADO em 2026-08-19 (texto original preservado acima, byte a byte).
    //        A PRIMEIRA metade do gatilho VENCEU e foi REFUTADA por medição: a fatia (iii)
    //        (`webhook-e-carne`) chegou na T7, e a notícia recebida dá ao órfão OBSERVABILIDADE, não
    //        RECONCILIAÇÃO — a T7 grava `identificador_perante_o_provedor` na linha crua em todo
    //        desfecho, inclusive `SEM_CORRESPONDENCIA` (é o que o `CT-974` afirma), de modo que o
    //        órfão deixa de ser invisível; mas segue sem caminho para virar cobrança conciliada,
    //        porque a notícia só chega para título que o provedor conhece, e o órfão é justamente
    //        aquele cujo `identificadorNoProvedor` nunca foi persistido.
    //        O gatilho vigente é o que SOBRA das duas metades, e só ele:
    //        **a fatia que persistir o identificador enviado ANTES da chamada ao provedor, ou a que
    //        ampliar o modelo canônico para perguntar por ele.**
    //        Não reponha a fatia (iii) aqui — ela já passou, e anunciar como futuro um gatilho já
    //        chegado ensina a próxima fatia a não procurá-lo. Medição na §2 (D18) da (iii).
    // POR QUE NÃO AGORA: fechá-lo exigiria persistir o identificador ANTES da chamada ao provedor
    //        (migração sobre `negocio.cobranca` depois da `0017`), alterar o predicado de
    //        `selecionarCobrancasAConferir` (T5, fechada) e acrescentar operação à porta — três
    //        mudanças fora do escopo de qualquer task aberta, uma delas contra ADR ativa.
    // ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D34
    //
    // Os bytes primeiro, porque é a guarda que produz o caminho que a unidade grava — ver o
    // cabeçalho para o arquivo órfão que a ordem inversa trocaria por um defeito pior.
    const caminhoDoArquivo = await guarda.gravar(cobranca.codigo, desfecho.valor.documento);

    await trabalho.gravarEmissao(cobranca, {
      numeroDoTituloNoProvedor: desfecho.valor.numeroDoTituloNoProvedor,
      linhaDigitavel: desfecho.valor.linhaDigitavel,
      codigoDeBarras: desfecho.valor.codigoDeBarras,
      identificadorNoProvedor,
      caminhoDoArquivo,
    });
    emitidas += 1;
  }

  // O desfecho é gravado UMA vez, no fim, e os dois carimbos se excluem no banco. O lote vazio
  // conclui — percorrer nada e não desfechar deixaria a empresa com um lote em andamento para
  // sempre, e o índice único parcial recusaria toda abertura seguinte.
  if (motivoDaInterrupcao === null) {
    await trabalho.concluir();
  } else {
    await trabalho.interromper(motivoDaInterrupcao);
  }

  return {
    cobrancas: cobrancas.length,
    emitidas,
    recusadas,
    interrompido: motivoDaInterrupcao !== null,
    motivoDaInterrupcao,
  };
}
