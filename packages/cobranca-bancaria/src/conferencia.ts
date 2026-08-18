/**
 * A **conferência bancária** — perguntar ao provedor pela situação de cada título e aplicar o que ele
 * responde, **liquidando, estornando ou revogando**.
 *
 * ===========================================================================
 * A REGRA CENTRAL: registra-se EFEITO, e nunca a tentativa (ADR-0034)
 * ===========================================================================
 *
 * A passada que perguntou por trinta cobranças e encontrou **tudo como estava** grava **zero**
 * eventos, e ainda assim fecha a conferência com `cobrancasConferidas: 30` e `efeitos: 0`. As duas
 * afirmações convivem porque descrevem coisas diferentes: a **execução** (que o recurso da
 * conferência publica, e a operação lê para saber que a apuração rodou) e o **fato de negócio** (que
 * a trilha publica, e a operação lê para entender *por que uma cobrança está assim*). A medição que
 * sustenta a ADR está no `Context` dela: `1.837` dos `1.864` eventos do sistema antigo — **98,6%** —
 * são consultas que nada mudaram, e é a rota de histórico que fica ilegível quando elas entram.
 *
 * Materialmente, isso é **uma** propriedade deste arquivo: cada porta de escrita é chamada **apenas**
 * quando o desfecho que ela devolve diz que algo mudou, e o desfecho benigno de cada uma
 * (`NAO_ESTAVA_EM_ABERTO`, `NAO_ESTAVA_PAGA`, `NAO_HAVIA_BOLETO`) **não** conta efeito. Não há
 * evento a suprimir depois: ele nunca é escrito.
 *
 * ⚠️ **A ADR EXCLUI do próprio alcance o registro operacional de diagnóstico** — *"nenhuma leitura
 * desta ADR autoriza apagar o segundo"*. Nada aqui proíbe a linha de `debug` do processo de trabalho;
 * o que este arquivo governa é a **trilha publicada**.
 *
 * ===========================================================================
 * O MOTIVO DO PROVEDOR NÃO DECIDE NADA — e a ausência é o mecanismo (RN-15, ADR-0001)
 * ===========================================================================
 *
 * **Não existe neste arquivo nenhum ramo que leia o motivo da revogação.** Ele atravessa da porta do
 * provedor até a porta de escrita sem ser lido, cortado, traduzido ou comparado — e é exatamente essa
 * ausência, e não uma previsão de quais motivos podem chegar, que torna um motivo **desconhecido**
 * inócuo. Um `switch` sobre ele, em qualquer camada, reintroduziria o vocabulário do provedor na
 * decisão do produto, que é o que a `Decision` da ADR-0001 fecha.
 *
 * ⚠️ **O `switch` que existe aqui é sobre `situacao`, e a distinção é toda**: `situacao` é o
 * discriminador da união **canônica** que o adaptador já traduziu (`EM_ABERTO`, `LIQUIDADO`,
 * `REVOGADO`, `ESTORNADO`), e é vocabulário do **produto**; `motivo` é texto do provedor. O primeiro é
 * fechado e o compilador cobra o ramo novo; o segundo é opaco e ninguém o interpreta.
 *
 * ===========================================================================
 * O PROVEDOR NÃO APAGA VALOR A RECEBER (RN-09, RN-10) — métrica nº 1 do PRD
 * ===========================================================================
 *
 * Quando o provedor informa que **revogou** o boleto, a cobrança perde o elo com o título e
 * **permanece em aberto**: `revogarBoleto` não nomeia `cancelado_em` no `SET` (garantia estrutural
 * daquela porta), e **nenhum caminho deste arquivo o escreve** — não há porta por onde propô-lo, e a
 * ausência é o mecanismo. É o oposto do que o sistema antigo faz, e é a razão de esta fatia existir:
 * a cobrança revogada volta ao alcance da régua e é recolhida pelo **lote seguinte**, cujo predicado é
 * *"em aberto e sem boleto"*.
 *
 * São **quatro** as colunas que a revogação zera — os três campos de emissão mais o arquivo —, e
 * `identificador_no_provedor` **fica**: ele é a chave de correlação por onde uma notícia atrasada do
 * provedor ainda se liga a esta cobrança, e não se recompõe, porque o contador do SaaS já avançou
 * (ADR-0033). Quem registra a decisão é o docblock de `revogarBoleto`, em `packages/db/src/
 * boleto-da-cobranca.ts`.
 *
 * ===========================================================================
 * O que este arquivo NÃO faz, e cada ausência é o mecanismo
 * ===========================================================================
 *
 * Ele não abre transação, não escreve SQL, não lê `process.env`, **não lê relógio** e não conhece o
 * provedor. Tudo o que toca fronteira chega **por parâmetro** (ADR-0025): o adaptador, a guarda de
 * bytes e as **cinco portas de dados** declaradas abaixo. É a mesma decisão, e a mesma razão, de
 * `./emissao-em-lote.ts` e `./reemissao.ts`.
 *
 * A ausência de relógio é literal e tem endereço: a **janela dos 30 dias** da CA-16 já foi resolvida
 * no predicado da camada de dados, contra `negocio.data_corrente_da_operacao()` (ADR-0026). Um
 * `Date.now()` aqui daria dois eixos para o mesmo dia — o do processo de trabalho, que corre a
 * apuração, e o do banco, que grava os carimbos —, e a divergência apareceria como uma cobrança que
 * sai do conjunto um dia antes ou depois, sem que nada acuse.
 *
 * E **não há comparação de empresa em lugar nenhum**: o conjunto chega já recortado pela política
 * (ADR-0008), sob o contexto que a unidade de trabalho fixou. O `empresaId` que viaja aqui é o do
 * **ato no provedor**, e é ele que impede a credencial de uma empresa de ser apresentada em chamada de
 * outra.
 *
 * ===========================================================================
 * UMA unidade de trabalho por cobrança, e a REDE corre FORA dela
 * ===========================================================================
 *
 * As três portas de escrita são satisfeitas com **uma unidade por chamada**, e `consultarSituacao` é
 * aguardada **entre** duas chamadas de porta, nunca dentro de uma. As duas propriedades são as mesmas
 * do percurso do lote, pelas mesmas razões: uma unidade única para a passada inteira faria a falha da
 * trigésima cobrança desfazer o que as vinte e nove anteriores gravaram — e o que dá a idempotência da
 * repetição é justamente o fato gravado, porque a cobrança já liquidada cai no desfecho benigno da
 * porta na passada seguinte; e uma unidade aberta enquanto se espera o provedor seguraria a conexão
 * física — recurso escasso do processo inteiro, compartilhado entre empresas — pelo tempo do aperto de
 * mão mais o da resposta.
 *
 * ===========================================================================
 * O QUE É "EFEITO" é decidido pela PORTA, e não por uma leitura escrita aqui
 * ===========================================================================
 *
 * A cobrança que o provedor reporta paga **de novo**, e o boleto que ele reporta revogado **depois**
 * de a reemissão já o ter revogado, não mudaram nada. Quem descobre isso é o **predicado de estado
 * dentro da instrução** de cada porta, que devolve o desfecho benigno — e não uma leitura escrita
 * aqui antes da escrita. A distinção é a corrida: entre o `SELECT` que dissesse *"está em aberto"* e o
 * `UPDATE`, cabe a baixa manual da rota de pagamento, e a apuração gravaria por cima de um fato que
 * ela leu antes de existir. É a mesma lei que `packages/db/src/boleto-da-cobranca.ts` registra por
 * extenso, e a razão de as três portas devolverem **desfecho** em vez de `void`.
 *
 * ===========================================================================
 * A DIVERGÊNCIA DE VALOR não impede nada (CA-11)
 * ===========================================================================
 *
 * O dinheiro entrou. A baixa acontece **assim mesmo**, com o valor **tal como o provedor o informou**,
 * e a divergência é registrada ao lado — nunca no lugar. Recusar a baixa porque o valor não era o
 * previsto inverteria a regra: o produto passaria a negar um fato do mundo por discordar dele.
 *
 * Quem **decide** que há divergência é este arquivo, e não a porta: é regra do domínio, e uma
 * comparação escrita na borda seria a segunda regra para o mesmo fato. O que atravessa a porta é o
 * veredito ({@link LiquidacaoConsultada.divergente}), e não o valor esperado — quem grava não precisa
 * saber contra o que se comparou.
 *
 * A comparação é de igualdade exata entre dois números, e isso é seguro **aqui**: os dois nascem da
 * mesma grandeza decimal de duas casas — o esperado, de `numeric(15,2)` lido pela porta; o informado,
 * do que o adaptador traduziu —, e duas leituras do mesmo decimal produzem o mesmo `double`. Nada
 * neste arquivo soma, arredonda ou converte dinheiro; a tolerância que faria sentido num cálculo não
 * faria aqui, onde qualquer diferença **é** a divergência que a CA-11 manda registrar.
 *
 * ===========================================================================
 * O CRÉDITO é derivado do PAGAMENTO, e a derivação é decisão declarada
 * ===========================================================================
 *
 * `liquidarPeloProvedor` grava quatro fatos — `pago_em`, `valor_pago`, `data_credito` e
 * `valor_creditado` —, e a consulta canônica informa **dois**: {@link SituacaoConsultada} declara
 * `pagoEm` e `valorPago`, e nada sobre o crédito. A diferença é fechada **aqui**, num ponto único, por
 * {@link creditoDaLiquidacao}: *o que o provedor informou como pago é o que ele creditou*.
 *
 * Ela é a composição que o `CT-923` da T6 já exercitou contra banco real, e é decisão de produto, não
 * omissão: modelar o crédito separadamente exigiria o **extrato** do provedor, que é fato de outra
 * conversa (a fatia (iii)) e não atravessa esta porta. Fechá-la na **borda** foi descartado — cada
 * borda que satisfizesse a porta refaria a derivação, e a segunda cópia divergiria da primeira sem que
 * nada acusasse.
 *
 * ===========================================================================
 * A FALHA DA CONSULTA reusa a classificação da RN-02, e a apuração FECHA assim mesmo
 * ===========================================================================
 *
 * `consultarSituacao` **não rejeita**: recusa, indisponibilidade e tempo esgotado chegam como desfecho
 * classificado, e o compilador obriga a tratá-los antes de ler `valor`. O que a classe causa é decidido
 * por {@link EFEITO_POR_CLASSE}, e não por um `if` sobre o literal `'DA_EMPRESA'`, pela razão que o
 * percurso do lote registra: com o `if`, uma terceira classe declarada amanhã cairia em silêncio no
 * ramo *"segue"* — e uma falha da empresa tratada como falha da cobrança consultaria o provedor por
 * todas as cobranças restantes contra uma identidade que já se sabe inservível. Com o `Record`, ela
 * **não compila** até que alguém decida o que ela causa.
 *
 * ⚠️ **A tabela é PRÓPRIA, e não uma cópia da do lote** — os efeitos são outros, e é isso que ela diz.
 * Lá, `DA_COBRANCA` **marca a cobrança**, gravando item `RECUSADO` e evento `EMISSAO_RECUSADA`; aqui
 * ela não grava nada, porque uma consulta que não obteve resposta **não mudou nada**, e a ADR-0034 é
 * literal sobre o que fazer com isso. A cobrança apenas não foi conferida, e a próxima passada tenta
 * de novo.
 *
 * ⚠️ **{@link PortaDaConclusaoDaConferencia} é chamada nos DOIS desfechos** — inclusive quando a
 * apuração cessa —, e isso não é descuido: a conferência **não tem coluna de interrupção**
 * (`negocio.conferencia_bancaria` guarda `concluida_em` e os dois contadores), e
 * `conferencia_bancaria_em_andamento_uidx` é índice único **parcial** sobre `(empresa_id) WHERE
 * concluida_em IS NULL`. Deixá-la aberta faria **todo** disparo seguinte da empresa reencontrar a
 * mesma execução, com `iniciadaAgora: false` **para sempre**, apontando uma apuração que ninguém
 * consegue fechar pela interface — que é exatamente o modo de falha grave descrito no docblock de
 * `concluirConferencia`. O que se fecha, portanto, são as contagens **do que de fato correu**, e o
 * motivo da interrupção sobe no desfecho, para a borda registrar.
 *
 * ===========================================================================
 * O QUE ACONTECE QUANDO UMA PORTA LEVANTA — e por que nada é capturado aqui
 * ===========================================================================
 *
 * Nenhuma chamada deste laço está dentro de um `try`, e a exceção **sobe**. Falha transitória
 * (conexão do banco, disco) precisa que a fila repita a tarefa, e capturá-la aqui a transformaria em
 * definitiva — a conferência ganharia `concluida_em` com contagens de uma passada que não terminou, e
 * a repetição encontraria uma apuração já desfechada. E a recusa de não-alcance
 * (`ErroDeCobrancaNaoAlcancada`, `ErroDeConferenciaNaoAlcancada`) tem causas que **esta camada não
 * separa** — o reenvio benigno da tarefa e o alvo inalcançável pelo contexto —, e reconhecê-las
 * exigiria importar símbolo da camada de dados, que é a aresta que a ADR-0025 recusa. Quem distingue é
 * a **borda da tarefa**, que sabe que está reentrando.
 */

import type { SegredoOperavel } from '@sysloc/shared';
import type { GuardaDeBoletos } from './guarda-de-boletos.js';
import type { ClasseDaFalha, SituacaoConsultada } from './modelo-canonico.js';
import type { AdaptadorCobrancaBancaria } from './porta-de-cobranca.js';

// ---------------------------------------------------------------------------
// O que a falha da CONSULTA causa — o mapa que faz o compilador cobrar o ramo novo
// ---------------------------------------------------------------------------

/** Os dois efeitos possíveis de uma consulta recusada sobre a apuração — união fechada, e só dois. */
type EfeitoDaFalha = 'SEGUE_PARA_A_PROXIMA' | 'CESSA_A_APURACAO';

/**
 * O que cada classe de falha provoca na apuração (RN-02).
 *
 * É `Record<ClasseDaFalha, …>` de propósito, e não um `if` sobre o literal — ver o cabeçalho para o
 * desfecho que o `if` deixaria passar em silêncio, e para por que esta tabela **não** é a do lote.
 *
 * Congelado pela mesma razão de `EFEITO_POR_CLASSE` em `./emissao-em-lote.ts`: ele é lido por toda
 * cobrança de toda passada, e uma escrita nele mudaria a decisão de todas as apurações seguintes.
 */
const EFEITO_POR_CLASSE: Readonly<Record<ClasseDaFalha, EfeitoDaFalha>> = Object.freeze({
  DA_COBRANCA: 'SEGUE_PARA_A_PROXIMA',
  DA_EMPRESA: 'CESSA_A_APURACAO',
});

/** O efeito que cessa a apuração — nomeado para que a comparação no laço se leia como a regra. */
const EFEITO_QUE_CESSA_A_APURACAO: EfeitoDaFalha = 'CESSA_A_APURACAO';

/**
 * A consulta **não pede os bytes** do documento, e o `false` é conteúdo.
 *
 * O sinalizador é obrigatório na assinatura da porta justamente para que quem consulta declare se
 * quer o documento (ver {@link SituacaoConsultada} e o docblock de `ConsultaDeSituacao`). A apuração
 * diária não os quer: ela decide sobre **estado**, e trazer o boleto de cada cobrança do dia
 * transformaria a passada barata na cara. Quem os pede é a re-obtenção do documento perdido (CA-08),
 * que é outra pergunta com a mesma operação.
 */
const CONFERENCIA_NAO_PEDE_O_DOCUMENTO = false;

// ---------------------------------------------------------------------------
// O vocabulário da apuração — declarado aqui, satisfeito lá fora (ADR-0025)
// ---------------------------------------------------------------------------

/**
 * Uma cobrança do conjunto a conferir — **três** campos, e cada um tem endereço.
 *
 * O `id` é o UUID interno, e é o que a escrita do evento guarda como chave estrangeira **composta**
 * `(cobranca_id, empresa_id)`; sem ele aqui, quem satisfaz as portas traduziria código→UUID por uma
 * consulta avulsa, que é o segundo caminho para o mesmo recorte. O `codigo` é a chave **exposta**
 * (ADR-0017): é por ele que as portas de escrita alcançam a linha e é por ele que a guarda deriva o
 * nome do arquivo. `numeroDoTituloNoProvedor` é o título **vivo**, e é por ele que se pergunta ao
 * provedor — não é anulável porque a não-nulidade é garantida **pelo predicado** que define este
 * conjunto, e não por uma conferência escrita depois da leitura.
 *
 * ⚠️ **Ele é declarado aqui, e não importado da camada de dados**, ainda que a projeção de lá tenha
 * hoje a mesma forma. A direção é a da ADR-0025 — o domínio declara o que atravessa a porta —, e a
 * coincidência é contingente: o dia em que a seleção passar a projetar um quarto campo, ele entra aqui
 * **por decisão**, e não por arrasto. É a mesma razão escrita em `CobrancaDoLote`.
 *
 * ⚠️ **E nada além dos três.** O valor esperado da cobrança, que a divergência da CA-11 compara,
 * chega por {@link PortaDoValorEsperado} — e só quando o provedor diz que a cobrança foi liquidada.
 * Replicá-lo aqui criaria uma segunda projeção da cobrança e pagaria a leitura da visão para **toda**
 * cobrança da passada, quando quase nenhuma delas mudou.
 */
export interface CobrancaAConferir {
  /** O UUID interno — a chave estrangeira composta que o evento guarda. */
  readonly id: string;
  /** O código legível `COB-{ano}-{7 dígitos}` — a chave exposta (ADR-0017). */
  readonly codigo: string;
  /** O número que o provedor atribuiu ao título vivo — não-nulo **por força do predicado**. */
  readonly numeroDoTituloNoProvedor: string;
}

/**
 * O que a apuração fez numa cobrança — **união fechada**, e `NADA_MUDOU` é o desfecho comum.
 *
 * Ela é o vocabulário por que se lê a passada: `efeitos` é, exatamente, quantas cobranças saíram daqui
 * com algo diferente de `NADA_MUDOU`. Modelá-la como booleano apagaria a distinção entre *"o provedor
 * confirmou o que já era verdade"* e *"o dinheiro entrou"*, que são o mesmo zero na contagem e coisas
 * opostas na leitura.
 *
 * `NADA_MUDOU` cobre **três** percursos que a ADR-0034 trata igual, e é deliberado que ela não os
 * separe: a cobrança que continua `EM_ABERTO`, o desfecho benigno de cada porta de escrita (o provedor
 * confirmando o que já é verdade) e a consulta que a classe `DA_COBRANCA` recusou. Nos três **nenhum
 * evento é gravado**, porque nos três nada mudou.
 */
export type EfeitoDaConferencia = 'NADA_MUDOU' | 'LIQUIDACAO' | 'ESTORNO' | 'REVOGACAO';

/** O efeito que a contagem **não** soma — nomeado para que o laço se leia como a regra. */
const EFEITO_QUE_NAO_CONTA: EfeitoDaConferencia = 'NADA_MUDOU';

/**
 * O que a liquidação leva à porta de escrita — os **quatro** fatos mais o veredito da divergência.
 *
 * As duas datas são cadeias `YYYY-MM-DD`, e nunca `Date`: as colunas são `date`, e um objeto de data
 * reserializado no fuso do processo desloca o dia. Os dois valores são números porque é assim que o
 * vocabulário canônico os declara — a conversão para a cadeia que `numeric(15,2)` recebe acontece
 * **em quem satisfaz a porta**, que é a mesma camada que já traduz o resto do vocabulário para o banco.
 *
 * `divergente` é **veredito**, e não dado: ele é a regra da CA-11 já decidida por este arquivo. Quem
 * grava não recebe o valor esperado, e não deve receber — com ele, a comparação poderia ser refeita na
 * borda, e a segunda regra divergiria da primeira sem que nada acusasse.
 */
export interface LiquidacaoConsultada {
  /** Quando o provedor diz que a cobrança foi paga — data de calendário `YYYY-MM-DD`. */
  readonly pagoEm: string;
  /** O valor que o provedor diz que foi pago — pode divergir do esperado, e a divergência é registrada. */
  readonly valorPago: number;
  /** Quando o crédito aconteceu — **derivado do pagamento**, ver o cabeçalho. */
  readonly dataDoCredito: string;
  /** Quanto foi creditado — **derivado do pagamento**, ver o cabeçalho. */
  readonly valorCreditado: number;
  /** `true` quando o valor informado difere do que a cobrança esperava (CA-11). */
  readonly divergente: boolean;
}

/** O que a liquidação **fez de fato** — é ele que decide se houve efeito, e não uma leitura daqui. */
export type DesfechoDaLiquidacao = 'LIQUIDADA' | 'NAO_ESTAVA_EM_ABERTO';

/** O que o estorno fez de fato, pela mesma razão de {@link DesfechoDaLiquidacao}. */
export type DesfechoDoEstorno = 'ESTORNADA' | 'NAO_ESTAVA_PAGA';

/** O que a revogação fez de fato, pela mesma razão de {@link DesfechoDaLiquidacao}. */
export type DesfechoDaRevogacao = 'REVOGADO' | 'NAO_HAVIA_BOLETO';

/**
 * A porta que lê da cobrança o **valor esperado** — o que a divergência da CA-11 compara.
 *
 * Ela é chamada **só** quando o provedor informa liquidação, e não uma vez por cobrança da passada:
 * é uma ida ao banco por cobrança que de fato mudou, em vez de uma por cobrança consultada.
 *
 * O que ela devolve é o total **derivado** (ADR-0022) — original mais a mora vigente —, que é o que a
 * cobrança publicava um instante antes da baixa e, portanto, o que se esperava receber. Nada nesta
 * camada o calcula: a derivação é do banco, e recompô-la aqui seria a segunda regra da mora.
 */
export type PortaDoValorEsperado = (cobranca: CobrancaAConferir) => Promise<number>;

/**
 * A porta que grava a liquidação — os quatro fatos, o evento `COBRANCA_LIQUIDADA` e, quando o valor
 * divergiu, o segundo evento `DIVERGENCIA_DE_VALOR`.
 *
 * As escritas vivem numa unidade de trabalho só, e é o *mesmo ato* que importa: gravar a baixa sem o
 * evento deixaria a trilha sem o fato que explica por que a cobrança está paga, e gravar o evento sem
 * a baixa anunciaria um pagamento que não existe.
 *
 * ⚠️ **O desfecho é devolvido, e não `void`** — é ele que separa *"o dinheiro entrou"* de *"o provedor
 * confirmou o que já era verdade"*, e é a segunda leitura que a ADR-0034 usa para não gravar evento.
 */
export type PortaDaLiquidacaoGravada = (
  cobranca: CobrancaAConferir,
  liquidacao: LiquidacaoConsultada,
) => Promise<DesfechoDaLiquidacao>;

/**
 * A porta que grava o estorno — os **oito** campos da liquidação de volta a `NULL` mais o evento
 * `LIQUIDACAO_ESTORNADA`, numa unidade de trabalho só.
 *
 * Ela **não** recebe nada além da cobrança: o estorno é a ausência do pagamento, e não um fato com
 * conteúdo próprio. O estado volta a **derivar** da visão — `VENCIDA` ou `A_VENCER` conforme o
 * vencimento —, sem que nada aqui decida qual (ADR-0022).
 */
export type PortaDoEstornoGravado = (cobranca: CobrancaAConferir) => Promise<DesfechoDoEstorno>;

/**
 * A porta que grava a revogação — os quatro campos do boleto zerados mais o evento `BOLETO_REVOGADO`
 * com o `diagnostico`, numa unidade de trabalho só.
 *
 * O `motivo` chega **tal como o provedor o informou** (RN-15), reconhecido ou não, e viaja até a
 * coluna de diagnóstico sem que nada o leia. É obrigatório porque a união canônica o declara
 * obrigatório: um boleto revogado sem razão informada é resposta que o adaptador deveria ter recusado.
 *
 * ⚠️ **`cancelado_em` não atravessa esta porta, e não há por onde propô-lo.** É a metade da RN-10 que
 * mora deste lado — a outra é a ausência da coluna no `SET` de `revogarBoleto`.
 */
export type PortaDaRevogacaoGravada = (
  cobranca: CobrancaAConferir,
  motivo: string,
) => Promise<DesfechoDaRevogacao>;

/** A porta que fecha a conferência com as duas contagens — o desfecho da passada. */
export type PortaDaConclusaoDaConferencia = (contagens: ContagensDaConferencia) => Promise<void>;

/**
 * As contagens com que a conferência se fecha — **duas**, e elas são distintas de propósito.
 *
 * `cobrancasConferidas` é quantas a apuração percorreu **e obteve resposta**; `efeitos`, quantas ela
 * mudou. Fundi-las apagaria exatamente a informação que a ADR-0034 mantém fora da trilha — *rodou, e
 * nada mudou* —, que aqui é legítima porque este recurso descreve a **execução**.
 *
 * ⚠️ **A consulta recusada não entra em `cobrancasConferidas`**, e a escolha é conteúdo: conferir é
 * ter perguntado **e sabido a resposta**, e contar a pergunta sem resposta faria a operação ler
 * *"trinta conferidas, nenhum efeito"* onde o fato é *"o provedor não respondeu por nenhuma delas"* —
 * dois desfechos operacionais opostos com o mesmo par de números.
 */
export interface ContagensDaConferencia {
  /** Quantas cobranças o provedor respondeu. */
  readonly cobrancasConferidas: number;
  /** Quantas dessas mudaram de fato. */
  readonly efeitos: number;
}

/**
 * A apuração de **uma** conferência — tudo o que ela precisa, e nada além.
 *
 * ⚠️ **Não há `conferenciaId` aqui, e a ausência é o mecanismo.** Quem sabe qual conferência está
 * sendo fechada é quem satisfaz {@link PortaDaConclusaoDaConferencia}, por aplicação parcial na borda
 * — exatamente como `TrabalhoDoLote` não carrega o identificador do lote. Um identificador nesta
 * assinatura daria ao domínio a peça com que alcançar **outra** conferência.
 *
 * ⚠️ **Também não há janela de dias.** O conjunto chega **já selecionado** pelo predicado, e a janela
 * é do predicado (CA-16). Aceitá-la aqui daria a quem chama o poder de mudar a regra da RN-11 por
 * chamada, e reintroduziria no domínio o relógio que a ADR-0026 mantém no banco.
 */
export interface TrabalhoDaConferencia {
  /** A empresa em nome de quem cada ato acontece — vem da carga da tarefa (ADR-0024), nunca de rota. */
  readonly empresaId: string;
  /** O material e a senha que o abrem, **opacos** (ADR-0032). Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
  /** O conjunto a conferir, na ordem em que será percorrido — recortado pelo predicado (ADR-0023). */
  readonly cobrancas: readonly CobrancaAConferir[];
  /** A porta do provedor. O de produção e o de verificação são indistintos daqui (ADR-0025). */
  readonly adaptador: AdaptadorCobrancaBancaria;
  /** A guarda dos bytes do boleto — aqui ela só apaga, quando o provedor revogou o título. */
  readonly guarda: GuardaDeBoletos;
  /** A leitura do valor esperado — só nas cobranças que o provedor diz liquidadas. */
  readonly valorEsperado: PortaDoValorEsperado;
  /** A gravação da liquidação — uma unidade de trabalho por chamada. */
  readonly gravarLiquidacao: PortaDaLiquidacaoGravada;
  /** A gravação do estorno — uma unidade de trabalho por chamada. */
  readonly gravarEstorno: PortaDoEstornoGravado;
  /** A gravação da revogação — uma unidade de trabalho por chamada. */
  readonly gravarRevogacao: PortaDaRevogacaoGravada;
  /** O fecho da conferência, com as duas contagens. */
  readonly concluir: PortaDaConclusaoDaConferencia;
}

/**
 * O que a apuração devolve — as contagens e o desfecho, para a borda registrar.
 *
 * `interrompida` é **derivado** de `motivoDaInterrupcao`, e existe pela mesma razão de `interrompido`
 * em `DesfechoDoLote`: quem lê o desfecho é a borda, e deixá-la recompor a condição criaria um segundo
 * lugar onde se decide o que conta como interrupção — o primeiro a divergir faria a borda relatar o
 * oposto do que aconteceu.
 *
 * ⚠️ **As duas contagens são as que a conferência já gravou** quando este objeto volta: quem as
 * escreveu foi {@link PortaDaConclusaoDaConferencia}, chamada logo antes. Republicá-las aqui não é a
 * segunda cópia de um fato — é o mesmo par, entregue a quem precisa registrá-lo no diário sem reler o
 * banco.
 */
export interface DesfechoDaConferencia extends ContagensDaConferencia {
  /** `true` quando uma falha da empresa cessou a apuração. */
  readonly interrompida: boolean;
  /** O motivo da interrupção, **tal como informado**; `null` quando a passada chegou ao fim. */
  readonly motivoDaInterrupcao: string | null;
}

// ---------------------------------------------------------------------------
// A aplicação de UM desfecho consultado
// ---------------------------------------------------------------------------

/**
 * Compõe o crédito a partir do pagamento — o **ponto único** da derivação declarada no cabeçalho.
 *
 * Ela existe como função nomeada, e não como duas atribuições no meio do ramo, para que a decisão
 * tenha **um** endereço: o dia em que o extrato do provedor entrar no vocabulário canônico, é aqui que
 * a derivação deixa de ser necessária, e não em cada borda que satisfaz a porta.
 */
function creditoDaLiquidacao(
  pagoEm: string,
  valorPago: number,
): {
  readonly dataDoCredito: string;
  readonly valorCreditado: number;
} {
  return { dataDoCredito: pagoEm, valorCreditado: valorPago };
}

/**
 * Aplica à cobrança o que o provedor respondeu, e devolve **o que de fato mudou**.
 *
 * O `switch` é sobre o discriminador da união **canônica**, sem ramo padrão: um estado novo declarado
 * no vocabulário não compila até que alguém decida o que ele causa. Ver o cabeçalho para por que isto
 * não é — e não pode virar — um `switch` sobre o motivo do provedor.
 */
async function aplicarSituacao(
  trabalho: TrabalhoDaConferencia,
  cobranca: CobrancaAConferir,
  situacao: SituacaoConsultada,
): Promise<EfeitoDaConferencia> {
  switch (situacao.situacao) {
    // Nada mudou: nenhuma porta de escrita é chamada, e portanto nenhum evento nasce (ADR-0034).
    case 'EM_ABERTO':
      return EFEITO_QUE_NAO_CONTA;

    case 'LIQUIDADO': {
      // A leitura do esperado corre SÓ aqui — ver `PortaDoValorEsperado`.
      const esperado = await trabalho.valorEsperado(cobranca);

      const desfecho = await trabalho.gravarLiquidacao(cobranca, {
        pagoEm: situacao.pagoEm,
        valorPago: situacao.valorPago,
        ...creditoDaLiquidacao(situacao.pagoEm, situacao.valorPago),
        // A baixa NÃO é impedida pela divergência (CA-11): o veredito acompanha o fato, e o que ele
        // provoca é um segundo evento — nunca uma recusa.
        divergente: situacao.valorPago !== esperado,
      });

      return desfecho === 'LIQUIDADA' ? 'LIQUIDACAO' : EFEITO_QUE_NAO_CONTA;
    }

    case 'ESTORNADO': {
      const desfecho = await trabalho.gravarEstorno(cobranca);

      return desfecho === 'ESTORNADA' ? 'ESTORNO' : EFEITO_QUE_NAO_CONTA;
    }

    case 'REVOGADO': {
      // O motivo atravessa INTACTO (RN-15) e nada aqui o lê — a cobrança permanece em aberto, e
      // `cancelado_em` não é tocado por caminho nenhum (RN-09, RN-10).
      const desfecho = await trabalho.gravarRevogacao(cobranca, situacao.motivo);

      if (desfecho !== 'REVOGADO') {
        return EFEITO_QUE_NAO_CONTA;
      }

      // O fato de negócio primeiro, o arquivo depois — a ordem inversa deixaria, se a escrita
      // falhasse, uma linha apontando para um arquivo que não existe. O preço da ordem escolhida é um
      // arquivo órfão, benigno: o nome é derivado do código da cobrança, de modo que a emissão
      // seguinte o sobrescreve em vez de acumular. É a ordem literal de `./reemissao.ts`.
      await trabalho.guarda.apagar(cobranca.codigo);

      return 'REVOGACAO';
    }
  }
}

// ---------------------------------------------------------------------------
// A apuração
// ---------------------------------------------------------------------------

/**
 * Pergunta ao provedor pela situação de cada cobrança do conjunto e aplica o que ele responde.
 *
 * A sequência é conteúdo, e não simplicidade: as chamadas acontecem uma de cada vez, sob a mesma
 * identidade, e a decisão de parar depende do desfecho da anterior — uma apuração concorrente teria
 * consultado as cinquenta seguintes antes de saber que o certificado da empresa não serve.
 *
 * A conferência é **fechada em todo caminho de sucesso**, inclusive no interrompido — ver o cabeçalho
 * para o modo de falha que deixá-la aberta produz.
 *
 * @throws Repassa, sem capturar, toda falha das portas de dados, da guarda e do fecho — ver o
 * cabeçalho para por que nada é capturado aqui, e em especial por que separar o reenvio benigno da
 * tarefa pertence à borda.
 */
export async function conferirCobrancas(
  trabalho: TrabalhoDaConferencia,
): Promise<DesfechoDaConferencia> {
  const { adaptador, cobrancas, empresaId, segredo } = trabalho;

  let cobrancasConferidas = 0;
  let efeitos = 0;
  let motivoDaInterrupcao: string | null = null;

  for (const cobranca of cobrancas) {
    // Fora de unidade de trabalho, por decisão — ver o cabeçalho. A consulta é montada aqui, no ponto
    // de uso, e nenhum campo dela sobrevive ao laço.
    const consultada = await adaptador.consultarSituacao({
      empresaId,
      segredo,
      numeroDoTituloNoProvedor: cobranca.numeroDoTituloNoProvedor,
      incluirDocumento: CONFERENCIA_NAO_PEDE_O_DOCUMENTO,
    });

    if (!consultada.aceito) {
      if (EFEITO_POR_CLASSE[consultada.classe] === EFEITO_QUE_CESSA_A_APURACAO) {
        // O motivo viaja intacto até o desfecho, e o que já foi aplicado PERMANECE: nada é desfeito,
        // e nenhuma cobrança posterior é consultada.
        motivoDaInterrupcao = consultada.motivo;
        break;
      }

      // A cobrança não foi conferida: nenhuma contagem sobe, nenhum evento nasce. A passada seguinte
      // tenta de novo, porque o predicado continua a alcançando.
      continue;
    }

    cobrancasConferidas += 1;

    if ((await aplicarSituacao(trabalho, cobranca, consultada.valor)) !== EFEITO_QUE_NAO_CONTA) {
      efeitos += 1;
    }
  }

  await trabalho.concluir({ cobrancasConferidas, efeitos });

  return {
    cobrancasConferidas,
    efeitos,
    interrompida: motivoDaInterrupcao !== null,
    motivoDaInterrupcao,
  };
}
