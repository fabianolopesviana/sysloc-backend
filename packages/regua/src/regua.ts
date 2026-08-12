/**
 * A **execução** da régua — o trabalho automático, o disparo manual, e a decisão num lugar só.
 *
 * ===========================================================================
 * A ADMISSÃO É UMA FUNÇÃO, e é ela que fecha o defeito de origem
 * ===========================================================================
 *
 * `executarReguaDaEmpresa` e `enviarAvisoDeCobranca` entram **na mesma** {@link admitirAviso}. O que
 * muda entre os dois é o que o caminho **dispensa** — janela de horário, trava de intervalo e
 * recorte de dias —, e a dispensa é **parâmetro**, nunca um segundo trecho de código.
 *
 * A unicidade não é elegância: é a rede do **REG-08**. No sistema antigo, `core.py` e `emailer.py`
 * decidem o mesmo fato e **discordam** — para a cobrança cancelada e vencida, o automático resolve
 * *"Fechada"* e não avisa, e o manual resolve *"Vencida"* e cobra por dívida cancelada. Duas
 * decisões coincidem na quase totalidade dos casos e divergem exatamente nas bordas, de modo que
 * nenhuma suíte comportamental razoável pega a divergência. O que a pega é **não haver duas**.
 *
 * Por isso a admissão não reimplementa o teste de estado: ela **compõe o aviso**
 * ({@link comporAvisoDeCobranca}), e é a composição que recusa o estado terminal. O discriminador de
 * estado tem um lar só no pacote — o compositor, que precisa dele para escolher o molde (RD-16) —, e
 * um segundo `if` escrito aqui seria a divergência do legado renascendo dentro de um arquivo.
 *
 * ===========================================================================
 * OS TRÊS EIXOS DE OPORTUNIDADE, e por que a dispensa precisa ser explícita
 * ===========================================================================
 *
 * *"Esta cobrança pode ser avisada?"* tem dois tipos de resposta. O **estado** é do fato financeiro e
 * nenhum caminho o dispensa (RD-02). Os outros três são de **oportunidade** — *"é hora de avisar
 * esta cobrança?"* — e o disparo manual dispensa os três (RD-07): quem clica no botão está dizendo
 * *"agora"*, e a janela, a trava e o recorte de dias existem para governar a passagem automática.
 *
 * Nenhum dos três é apurado aqui, e a assimetria é deliberada: a janela é do **job** e é conferida
 * uma vez por passagem (D4, ADR-0023), e a trava e o recorte vivem no **predicado**, no banco, porque
 * participam de seleção. O que a admissão recebe são os **vereditos** já apurados, e o que ela faz é
 * recusar o eixo que não foi nem apurado nem dispensado — ela **falha fechado**.
 *
 * Essa recusa não é ornamento defensivo: o consumidor seguinte da régua é o relógio da **F5**, e um
 * chamador novo que montasse o trabalho sem apurar a janela seria admitido em silêncio, disparando
 * avisos fora do horário que a imobiliária configurou, sem uma linha vermelha em lugar nenhum. Aqui
 * ele é recusado nomeando o eixo.
 *
 * ===========================================================================
 * O RELÓGIO NÃO É LIDO AQUI (ADR-0026)
 * ===========================================================================
 *
 * `agora` chega por parâmetro, resolvido pelo banco (`lerHoraCorrenteDaOperacao`). Não há `new
 * Date()`, `Date.now()` nem `getHours()` neste arquivo, e o CT-612 varre `packages/regua/src/**`
 * justamente porque nenhum caso comportamental pega essa classe enquanto o host acertar o fuso por
 * acidente.
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO NÃO FAZ
 * ===========================================================================
 *
 * Não abre transação, não escreve SQL, não fala com SMTP e não enfileira nada: as portas chegam por
 * parâmetro (ADR-0025). Em particular, **não há aqui escrita alguma em `negocio.cobranca`** — a falha
 * de envio não toca o fato financeiro (RD-09/ADR-0022), e a ausência é o mecanismo.
 */

import type { EnvioDeCobranca, PoliticaDeAviso } from '@sysloc/contracts';
import { dentroDaJanela } from './janela.js';
import { comporAvisoDeCobranca, type MensagemDeAviso } from './mensagem.js';
import type { CandidataAoAviso, PortaDeCandidatas, PortaDeRegistro } from './porta-de-dados.js';
import type { PortaDeEnvioDeEmail } from './porta-de-email.js';

// ---------------------------------------------------------------------------
// Os eixos de oportunidade — a lista é a FONTE, e o tipo deriva dela
// ---------------------------------------------------------------------------

/**
 * Os três eixos que um caminho pode dispensar, na ordem em que são conferidos.
 *
 * Ela é a **fonte**, e {@link DispensasDoManual} é derivado dela por tipo mapeado. A direção importa:
 * uma interface escrita à mão ao lado de uma lista escrita à mão poderia ganhar um eixo só num dos
 * dois lugares, e o eixo esquecido na lista deixaria de ser conferido **sem que nada acusasse** —
 * exatamente o modo de falha silencioso que esta camada existe para não ter.
 *
 * A ordem é conteúdo: a recusa nomeia o **primeiro** eixo não atendido, e a janela vem primeiro
 * porque é a única que o trabalho automático apura fora do banco.
 */
const EIXOS_DE_OPORTUNIDADE = Object.freeze([
  'janelaDeHorario',
  'travaDeIntervalo',
  'recorteDeDias',
] as const);

/** Um dos três eixos de oportunidade — derivado da lista acima, nunca redigitado. */
type EixoDeOportunidade = (typeof EIXOS_DE_OPORTUNIDADE)[number];

/**
 * O que o caminho **dispensa** do teste de admissão (RD-07).
 *
 * O disparo manual dispensa os três; o trabalho automático não dispensa nenhum — ele os **apura**,
 * cada um em seu lugar. Nenhum campo aqui alcança o **estado**, e a ausência é a decisão: cobrança
 * paga ou cancelada não é avisável por caminho nenhum, e um campo `estado: true` aqui seria a porta
 * por onde o defeito do legado voltaria.
 */
export type DispensasDoManual = Readonly<Record<EixoDeOportunidade, boolean>>;

/**
 * O veredito de cada eixo, **apurado por quem o apura** — nunca aqui.
 *
 * Tem o mesmo formato de {@link DispensasDoManual} e papel oposto: um diz *"não confira"*, o outro
 * diz *"conferi, e o resultado foi este"*. Os dois entram na admissão, e é o par que decide.
 */
type OportunidadeDoAviso = Readonly<Record<EixoDeOportunidade, boolean>>;

/**
 * O que o disparo manual dispensa — os três eixos de oportunidade, e nada mais (RD-07).
 *
 * **Congelada** e publicada, no molde de `POLITICA_DE_AVISO_AUSENTE`: ela é compartilhada por toda
 * borda que dispara manualmente, e uma escrita nela mudaria a admissão do processo inteiro. Ter nome
 * é o que impede cada borda de montar o próprio objeto de dispensas — e a segunda montagem seria
 * livre para dispensar um eixo a mais.
 */
export const DISPENSAS_DO_DISPARO_MANUAL: DispensasDoManual = Object.freeze({
  janelaDeHorario: true,
  travaDeIntervalo: true,
  recorteDeDias: true,
});

/**
 * O que o trabalho automático dispensa: **nada**.
 *
 * Ele confere a janela por si e recebe do predicado os outros dois já apurados. Não é publicada — a
 * borda do job não escolhe dispensa nenhuma, e dar-lhe essa escolha seria abrir o caminho para um
 * automático que dispensasse a janela.
 */
const SEM_DISPENSA: DispensasDoManual = Object.freeze({
  janelaDeHorario: false,
  travaDeIntervalo: false,
  recorteDeDias: false,
});

/**
 * O veredito dos dois eixos que o **predicado** apurou, no banco, dentro da mesma consulta.
 *
 * A constante existe para que o `true` tenha nome no ponto da chamada: escrito solto, ele pareceria
 * uma dispensa disfarçada de veredito. A candidata chegou porque passou pela trava e pelo recorte —
 * é isso que este valor afirma, e é falso para qualquer candidata que não venha do predicado.
 */
const APURADO_PELO_PREDICADO = true;

/** O que o disparo manual apurou: **nada** — ele dispensa os três, e não confere nenhum. */
const NADA_APURADO: OportunidadeDoAviso = Object.freeze({
  janelaDeHorario: false,
  travaDeIntervalo: false,
  recorteDeDias: false,
});

// ---------------------------------------------------------------------------
// Os rótulos do registro — tipados pelo contrato, nunca cadeias livres
// ---------------------------------------------------------------------------

/**
 * Os dois caminhos e os três desfechos, cada um preso ao tipo que `@sysloc/contracts` publica.
 *
 * Mesma forma, e mesma razão, de `DESFECHO_QUE_TRAVA` em `packages/db/src/envio-de-cobranca.ts`: um
 * rótulo que deixasse de existir no contrato **não compila** aqui, em vez de virar uma cadeia que o
 * banco recusa em tempo de execução, longe do ponto em que ela foi escrita.
 */
const CAMINHO_AUTOMATICO: EnvioDeCobranca['caminho'] = 'AUTOMATICO';
const CAMINHO_MANUAL: EnvioDeCobranca['caminho'] = 'MANUAL';
const DESFECHO_ENVIADA: EnvioDeCobranca['desfecho'] = 'ENVIADA';
const DESFECHO_FALHOU: EnvioDeCobranca['desfecho'] = 'FALHOU';
const DESFECHO_SEM_DESTINATARIO: EnvioDeCobranca['desfecho'] = 'SEM_DESTINATARIO';

/**
 * O que a tentativa registra quando o locatário não tem endereço de contato (RD-11).
 *
 * Constante nomeada porque é **conteúdo auditável**: é o que o operador lê no histórico meses depois
 * para saber que o aviso não saiu por cadastro incompleto, e não por falha de transporte. O CT-619 a
 * compara por igualdade de cadeia inteira.
 */
const CAUSA_SEM_DESTINATARIO = 'locatário sem endereço de contato';

/**
 * O que se grava quando a porta rejeitou **sem dizer por quê**.
 *
 * O `CHECK` bicondicional do banco recusa `FALHOU` com causa nula, de modo que uma rejeição sem
 * diagnóstico derrubaria o registro da tentativa — e a tentativa não registrada é a que volta a ser
 * enviada na passagem seguinte. Este valor é o que impede a falha de virar silêncio.
 */
const CAUSA_SEM_DIAGNOSTICO = 'falha de entrega sem diagnóstico do transporte';

/** O que se grava em `causa` quando a mensagem saiu — o pareamento que o `CHECK` do banco impõe. */
const SEM_CAUSA = null;

/** O que a recusa da admissão diz quando um eixo não foi nem apurado nem dispensado. */
const MOTIVO_DE_OPORTUNIDADE_NAO_APURADA = 'eixo de oportunidade não apurado nem dispensado';

// ---------------------------------------------------------------------------
// O que a régua recebe e o que ela devolve
// ---------------------------------------------------------------------------

/**
 * O trabalho automático de **uma** empresa — tudo o que ele precisa, e nada além.
 *
 * A política chega recortada a **três** campos por `Pick`, e o recorte é a decisão D4 escrita no
 * tipo: `diasAntesDoVencimento` e `intervaloMinimoDias` são do **predicado**, e não teriam como ser
 * lidos aqui sem que a assinatura mudasse. É a mesma disciplina do `Pick` de
 * `selecionarCandidatasAoAviso`, do outro lado da fronteira.
 */
export interface TrabalhoDaRegua {
  /** A política vigente da empresa — ou a régua desligada, quando ela nunca configurou (RD-03). */
  readonly politica: Pick<PoliticaDeAviso, 'ativo' | 'janelaInicio' | 'janelaFim'>;
  /** A hora corrente da operação no molde `HH:MM`, resolvida pelo **banco** (ADR-0026). */
  readonly agora: string;
  /** A porta que entrega as candidatas, já recortadas e ordenadas pelo predicado. */
  readonly candidatas: PortaDeCandidatas;
  /** A porta que grava cada tentativa, **uma unidade de trabalho por chamada**. */
  readonly registrar: PortaDeRegistro;
  /** A porta de saída — o adaptador de produção ou o de captura, indistintos daqui. */
  readonly email: PortaDeEnvioDeEmail;
}

/**
 * O que a passagem da régua devolve — as contagens, e o sinal de que houve falha.
 *
 * `houveFalha` é **derivado** de `falhas`, e existe porque quem levanta é a **borda** do job (T8),
 * para que a fila repita: deixar a borda recompor a condição criaria um segundo lugar onde se decide
 * o que conta como falha, e o primeiro que divergisse faria o job parar de repetir em silêncio.
 *
 * `candidatas` é o número de cobranças que o predicado devolveu, e não o de mensagens entregues: é
 * ele que responde *"a régua passou e não havia ninguém"*, que é diferente de *"passou e falhou"*.
 */
export interface ResultadoDaRegua {
  /** Quantas cobranças o predicado devolveu nesta passagem. */
  readonly candidatas: number;
  /** Quantas tentativas terminaram com a mensagem entregue. */
  readonly enviadas: number;
  /** Quantas tentativas terminaram em falha de entrega. */
  readonly falhas: number;
  /** Quantas cobranças não tinham endereço de contato para onde mandar. */
  readonly semDestinatario: number;
  /** `true` quando **qualquer** tentativa falhou — o sinal que faz a borda levantar. */
  readonly houveFalha: boolean;
}

/**
 * A passagem que **não aconteceu** — régua desligada ou fora da janela.
 *
 * Congelada e compartilhada: ela é devolvida por referência a toda empresa que não avisa ninguém, e
 * uma escrita nela contaminaria a próxima passagem no mesmo processo. Zero em tudo e `houveFalha`
 * falso é conteúdo — ausência de política **não é falha** (RD-03), e um resultado que sinalizasse
 * falha aqui faria a fila repetir para sempre o job de uma empresa que apenas não ligou a régua.
 */
const PASSAGEM_SEM_EFEITO: ResultadoDaRegua = Object.freeze({
  candidatas: 0,
  enviadas: 0,
  falhas: 0,
  semDestinatario: 0,
  houveFalha: false,
});

/**
 * O disparo manual de **uma** cobrança, por uma pessoa autorizada.
 *
 * Ele **não recebe** {@link PortaDeCandidatas}: a cobrança já foi lida pelo código, na borda, da
 * mesma `negocio.cobranca_derivada` que o automático consulta (RD-01). É essa ausência que torna a
 * dispensa da trava e do recorte um fato estrutural, e não uma escolha que alguém possa esquecer.
 *
 * `dispensas` chega por parâmetro em vez de ser fixada aqui porque é justamente o que o Aceite
 * Técnico exige que seja parâmetro — e porque é ele que faz este caminho e o automático entrarem na
 * mesma admissão.
 */
export interface DisparoManual {
  /** A cobrança a avisar, projetada como o predicado a projeta. */
  readonly candidata: CandidataAoAviso;
  /** O que este caminho dispensa — {@link DISPENSAS_DO_DISPARO_MANUAL} em operação. */
  readonly dispensas: DispensasDoManual;
  /** A porta que grava a tentativa. */
  readonly registrar: PortaDeRegistro;
  /** A porta de saída. */
  readonly email: PortaDeEnvioDeEmail;
}

// ---------------------------------------------------------------------------
// A admissão — a decisão, num lugar só
// ---------------------------------------------------------------------------

/**
 * Admite (ou recusa) o aviso de uma candidata, e devolve o aviso **já composto**.
 *
 * A ordem é conteúdo. Os eixos de **oportunidade** vêm primeiro, na ordem declarada em
 * {@link EIXOS_DE_OPORTUNIDADE}, e cada um é conferido apenas quando o caminho não o dispensa; o
 * **estado** vem por último, e quem o decide é o compositor — ver o cabeçalho deste arquivo para por
 * que ele não é reimplementado aqui.
 *
 * Levanta {@link ErroDeEstadoNaoAvisavel} (de `./mensagem.js`) para cobrança paga ou cancelada, e
 * **nenhuma mensagem é composta** nesse caso. Levanta erro nomeando o eixo quando ele não foi nem
 * apurado nem dispensado: a admissão falha fechado, porque o modo perigoso aqui é o inverso do
 * habitual — *"seguir mesmo assim"* alcança a caixa de uma pessoa real.
 */
function admitirAviso(
  candidata: CandidataAoAviso,
  oportunidade: OportunidadeDoAviso,
  dispensas: DispensasDoManual,
): MensagemDeAviso {
  for (const eixo of EIXOS_DE_OPORTUNIDADE) {
    if (!dispensas[eixo] && !oportunidade[eixo]) {
      throw new Error(`${MOTIVO_DE_OPORTUNIDADE_NAO_APURADA}: ${eixo}`);
    }
  }

  return comporAvisoDeCobranca(candidata);
}

/**
 * Descreve a falha da porta de e-mail em uma cadeia, para virar a `causa` do registro.
 *
 * Só a **mensagem** de um `Error` atravessa. Um `String(erro)` sobre valor arbitrário serializaria o
 * objeto inteiro — e o objeto de erro de um transporte carrega, entre outras coisas, as opções com
 * que ele foi construído. A cadeia vazia também é recusada: o `CHECK` do banco exige causa em toda
 * falha, e a tentativa que não é registrada é a que sai de novo na passagem seguinte.
 */
function descreverCausa(erro: unknown): string {
  if (erro instanceof Error && erro.message.trim() !== '') {
    return erro.message;
  }

  return CAUSA_SEM_DIAGNOSTICO;
}

/**
 * Entrega o aviso e devolve a causa da falha — ou `null` quando a mensagem saiu.
 *
 * A rejeição da porta é capturada **aqui**, e não no laço: é o que faz a falha de uma candidata
 * virar um **fato registrado** em vez de uma exceção que interrompe as demais (RN-11/CA-16).
 */
async function entregarOuDescreverAFalha(
  email: PortaDeEnvioDeEmail,
  destinatario: string,
  mensagem: MensagemDeAviso,
): Promise<string | null> {
  try {
    await email.enviar(destinatario, mensagem);

    return null;
  } catch (erro) {
    return descreverCausa(erro);
  }
}

/**
 * Tenta avisar **uma** cobrança e grava o desfecho — o corpo comum aos dois caminhos.
 *
 * Toda tentativa deixa registro (RD-08), inclusive a que não saiu: é o registro que sustenta, ao
 * mesmo tempo, a trava do intervalo, a idempotência da repetição do job e a auditoria do operador.
 *
 * O endereço vazio **não** é falha de entrega: ele tem rótulo próprio (`SEM_DESTINATARIO`), porque a
 * ausência de contato é do cadastro e pede correção do locatário, enquanto a falha é do transporte e
 * pede diagnóstico. Fundi-los tornaria a métrica de saúde do envio ilegível — e, pior, faria a
 * cobrança sem contato **travar** o intervalo, que é o que a RD-05 recusa.
 *
 * A rejeição da porta de **registro** não é capturada, e a ausência é deliberada: ela é falha de
 * infraestrutura, e engoli-la deixaria uma mensagem entregue sem o fato que impede o reenvio.
 */
async function tentarAvisar(
  candidata: CandidataAoAviso,
  caminho: EnvioDeCobranca['caminho'],
  mensagem: MensagemDeAviso,
  registrar: PortaDeRegistro,
  email: PortaDeEnvioDeEmail,
): Promise<EnvioDeCobranca> {
  if (candidata.destinatario === '') {
    return await registrar({
      cobrancaCodigo: candidata.codigo,
      caminho,
      desfecho: DESFECHO_SEM_DESTINATARIO,
      destinatario: candidata.destinatario,
      causa: CAUSA_SEM_DESTINATARIO,
    });
  }

  const causa = await entregarOuDescreverAFalha(email, candidata.destinatario, mensagem);

  return await registrar({
    cobrancaCodigo: candidata.codigo,
    caminho,
    desfecho: causa === null ? DESFECHO_ENVIADA : DESFECHO_FALHOU,
    destinatario: candidata.destinatario,
    causa: causa ?? SEM_CAUSA,
  });
}

// ---------------------------------------------------------------------------
// Os dois caminhos
// ---------------------------------------------------------------------------

/**
 * Executa a passagem automática da régua para **uma** empresa (RD-03, RD-06, RD-08, RD-11).
 *
 * A ordem das três decisões é conteúdo:
 *
 * 1. **Política desligada** — ausente ou `ativo: false` — termina a passagem sem enviar, sem
 *    registrar e **sem levantar**. Ausência é a régua desligada, não é erro: tratá-la como falha
 *    poluiria a auditoria com uma linha por passagem de toda empresa que nunca configurou, e faria a
 *    fila repetir para sempre um job que não tem o que fazer.
 * 2. **Fora da janela** — mesmo desfecho. A janela é conferida **uma vez, para o job inteiro** (D4):
 *    ela é propriedade da passagem, não da linha, e não discrimina uma cobrança de outra.
 * 3. Só então as candidatas são pedidas. A consulta **nem chega a acontecer** quando a régua não vai
 *    agir — é o efeito colateral desejável que o cabeçalho de `./porta-de-dados.ts` registra.
 *
 * O laço percorre na ordem que o predicado entregou (`data_vencimento`, depois `codigo`) e **não
 * reordena**: reordenar aqui criaria uma segunda regra de ordem, livre para divergir da do `ORDER BY`
 * (RD-17). E ele **não para na falha de uma** — cada desfecho é gravado, e o sinal de falha viaja no
 * resultado, para que a borda levante ao fim e a fila repita **sem perder as bem-sucedidas**.
 *
 * A candidata cujo estado não admite aviso **levanta**, e a exceção sobe: o predicado recorta o
 * estado no banco, de modo que uma terminal chegando aqui significa que a visão e o compositor
 * discordaram — a única divergência que esta fatia existe para tornar impossível. Capturá-la seria
 * silenciar exatamente o que se quer ouvir.
 */
export async function executarReguaDaEmpresa(trabalho: TrabalhoDaRegua): Promise<ResultadoDaRegua> {
  const { politica, agora, candidatas, registrar, email } = trabalho;

  if (!politica.ativo) {
    return PASSAGEM_SEM_EFEITO;
  }

  const janelaDeHorario = dentroDaJanela(agora, politica.janelaInicio, politica.janelaFim);

  if (!janelaDeHorario) {
    return PASSAGEM_SEM_EFEITO;
  }

  // O veredito da janela é calculado **uma vez** e apenas consumido pela admissão de cada candidata:
  // a conferência lá dentro não recalcula nada, ela confere que o eixo foi apurado. É o que faz o
  // automático e o manual passarem pelo mesmo teste sem que o automático confira a janela por linha.
  const oportunidade: OportunidadeDoAviso = {
    janelaDeHorario,
    travaDeIntervalo: APURADO_PELO_PREDICADO,
    recorteDeDias: APURADO_PELO_PREDICADO,
  };

  const conjunto = await candidatas();
  let enviadas = 0;
  let falhas = 0;
  let semDestinatario = 0;

  for (const candidata of conjunto) {
    const mensagem = admitirAviso(candidata, oportunidade, SEM_DISPENSA);
    const registro = await tentarAvisar(candidata, CAMINHO_AUTOMATICO, mensagem, registrar, email);

    // As contagens saem do desfecho **gravado**, e não do que a régua pretendia gravar: é o que faz
    // o resultado descrever fatos do banco, e não intenções da aplicação.
    if (registro.desfecho === DESFECHO_ENVIADA) {
      enviadas += 1;
    } else if (registro.desfecho === DESFECHO_FALHOU) {
      falhas += 1;
    } else {
      semDestinatario += 1;
    }
  }

  return {
    candidatas: conjunto.length,
    enviadas,
    falhas,
    semDestinatario,
    houveFalha: falhas > 0,
  };
}

/**
 * Dispara **um** aviso a pedido de uma pessoa autorizada (RD-02, RD-07, RD-08).
 *
 * O mesmo teste de admissão do automático, sobre o mesmo estado publicado, com os três eixos de
 * oportunidade dispensados por parâmetro. Cobrança paga ou cancelada levanta
 * `ErroDeEstadoNaoAvisavel` nomeando o estado, e **nenhuma mensagem sai nem linha nasce** — a borda
 * traduz a recusa em `422` com `detalhes.estado`.
 *
 * Devolve a linha do registro **inclusive quando o desfecho é `FALHOU`**: a requisição do operador
 * foi atendida — a tentativa foi feita e registrada —, e o que fracassou foi a comunicação com
 * terceiro. É por isso que a rota responde `200` com o desfecho, e não um `502` que esconderia dele
 * o identificador do registro que ele precisa para consultar o histórico.
 */
export async function enviarAvisoDeCobranca(disparo: DisparoManual): Promise<EnvioDeCobranca> {
  const { candidata, dispensas, registrar, email } = disparo;
  const mensagem = admitirAviso(candidata, NADA_APURADO, dispensas);

  return await tentarAvisar(candidata, CAMINHO_MANUAL, mensagem, registrar, email);
}
