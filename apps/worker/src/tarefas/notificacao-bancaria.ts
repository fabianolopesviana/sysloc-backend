/**
 * A **borda do tratamento da notícia bancária** — onde o contexto de tenant nasce do **registro
 * resolvido**, e não da carga (ADR-0024, terceira emenda · ADR-0035).
 *
 * ===========================================================================
 * ESTA BORDA É DIFERENTE DAS DUAS IRMÃS BANCÁRIAS, e a diferença é toda a fatia
 * ===========================================================================
 *
 * `./emissao-em-lote.ts` e `./conferencia-bancaria.ts` recebem `empresaId` na carga e abrem o
 * contexto como **primeira** coisa depois da recusa. Aqui não há empresa na carga, e não poderia
 * haver: quem enfileirou foi a borda HTTP que atendeu o provedor, e ela **não sabe** de que empresa o
 * fato é. Descobrir é o trabalho desta tarefa.
 *
 * A consequência é a ordem dos passos, e ela é conteúdo:
 *
 *   1. a carga é recusada por `strictObject` **antes** de qualquer leitura;
 *   2. o cru é lido **sem contexto** — `plataforma.notificacao_bancaria` não tem dono-empresa, não
 *      habilita RLS e nenhuma política a alcança (ADR-0031);
 *   3. o roteamento corre **sem contexto**, por travessia nominal (`SECURITY DEFINER`), e a empresa é
 *      o **resultado** dele;
 *   4. só a partir daí — e **apenas** para o que toca `negocio` — o contexto é aberto, uma vez, pelo
 *      mesmo escritor único de sempre.
 *
 * ⚠️ **Nenhum campo do recebido escolhe empresa, estado ou efeito.** O que o aviso faz é dizer *onde
 * olhar*; quem decide é a consulta ao provedor (RN-07). É a cláusula da ADR-0035 que a terceira
 * *Alternativa rejeitada* dela nomeia — *"aceitar a empresa declarada no recebido… faz uma origem
 * externa escolher o tenant"*.
 *
 * ===========================================================================
 * A CONFERÊNCIA TEM TRÊS RAMOS, e o do meio é decisão da fatia (ii) PRESERVADA para esta
 * ===========================================================================
 *
 * `revogarBoleto` (`packages/db/src/boleto-da-cobranca.ts`) zera o número do título e **preserva** o
 * identificador que o produto compôs, e o docblock dela diz por quê com todas as letras: *"ele é a
 * chave de correlação por onde **uma notícia atrasada do provedor ainda se liga a esta cobrança**, e
 * ele não se recompõe"*. Logo o par *identificador vivo × título nulo* **existe de propósito**.
 *
 * Por isso o gravado nulo **não confere e não recusa**: ele segue para a consulta. Comparar contra
 * `NULL` faria toda notícia atrasada de boleto revogado morrer como `DIVERGENTE` mais um evento
 * `NOTICIA_RECUSADA` — anomalia registrada na trilha para um caso que não é anomalia nenhuma, e o
 * oposto exato do que aquela chave foi preservada para permitir. É o mutante de **duas pernas** que o
 * `CT-1006` barra, e a asserção que o discrimina é a combinação *(uma consulta) × (zero
 * `NOTICIA_RECUSADA`)*.
 *
 * ===========================================================================
 * O EFEITO E O DESFECHO VÃO NA MESMA UNIDADE — e isso não contraria "uma unidade por escrita"
 * ===========================================================================
 *
 * `desfecho = 'APLICADO'` **é** o registro de que o efeito aconteceu: é ele, e só ele, que a camada 1
 * da idempotência (`houveEfeitoDaLiquidacao`) consulta para pular uma reentrega. Gravar a baixa numa
 * unidade e o carimbo em outra abriria uma janela em que o dinheiro já entrou e nada o registra — e
 * a reentrega seguinte reconsultaria o provedor e tentaria aplicar de novo. Os dois são **um** fato,
 * e por isso comitam juntos.
 *
 * O que **não** entra na unidade é a rede: `consultarSituacao` é aguardada **entre** duas unidades,
 * nunca dentro de uma. Manter `sql.begin` aberto durante o aperto de mão reservaria uma conexão
 * física da reserva que atende o produto inteiro — a mesma razão registrada por extenso nas duas
 * bordas irmãs. O apagamento dos bytes do boleto também corre **depois** do commit, na ordem literal
 * de `conferencia.ts`: o fato de negócio primeiro, o arquivo depois.
 *
 * ===========================================================================
 * DESFECHO DE NEGÓCIO NÃO É ERRO — a tarefa falha por três causas, e só por elas
 * ===========================================================================
 *
 * `VALIDACAO_DE_ENDERECO`, `ILEGIVEL`, `SEM_CORRESPONDENCIA`, `RETIDO`, `DIVERGENTE` e
 * `CONFERIDO_SEM_EFEITO` são **conclusões da passada**: a tarefa termina com sucesso e o desfecho
 * fica gravado — o que não quer dizer que todos sejam definitivos, e `RETIDO` é justamente o que
 * não é (ver {@link DESFECHOS_QUE_PEDEM_TRATAMENTO}). Fazê-la falhar em qualquer um deles a
 * reentregaria para sempre, contra um corpo que nunca vai mudar de forma.
 *
 * Ela falha em três casos, e os três são de infraestrutura ou da empresa: a carga não satisfaz o
 * esquema, a empresa não tem certificado vigente (não há como consultar), e o provedor recusou ou
 * está indisponível. Nos três a fila repete pela política declarada em `@sysloc/shared`.
 *
 * ===========================================================================
 * O que esta borda NÃO faz, e cada ausência é o mecanismo
 * ===========================================================================
 *
 * Ela **não lê relógio** (todo instante sai do banco — ADR-0026; nenhuma data do recebido entra no
 * domínio), **não escreve SQL** (as portas de dados chegam de `@sysloc/db` e recebem o `tx`), **não
 * compara empresa com coisa alguma** (quem recorta é a política — ADR-0008) e **não interpreta o
 * dialeto do provedor**: a tradução já aconteceu em `classificarNotificacaoBancaria`
 * (`@sysloc/cobranca-bancaria`), e o que atravessa daqui para baixo são os nomes **do produto**
 * (RN-18 / ADR-0001).
 *
 * ===========================================================================
 * A REENTRADA É DISCRIMINADA NA BORDA, PELO ESTADO DA LINHA CRUA — e não por `comReentranciaBenigna`
 * ===========================================================================
 *
 * A segunda ativação sobre a mesma notícia é alcançável **sem defeito nenhum**: no ramo `REVOGADO` a
 * unidade comita e só depois corre `guarda.apagar`, que engole `ENOENT` e levanta o resto — a tarefa
 * falha com o fato já gravado, e a fila reentrega. A reentrega de tarefa travada alcança igualmente
 * `LIQUIDADO` e `ESTORNADO`.
 *
 * Prosseguir numa segunda passada **regride** o desfecho: as portas de escrita recusam pelo predicado
 * de estado delas (`liquidarPeloProvedor` é `UPDATE … WHERE pago_em IS NULL`, e a ausência de retorno
 * **é** o resultado), o código cai no ramo *"nada mudou"* e `marcarDesfecho` — que é `UPDATE … WHERE
 * id = $1`, **sem predicado de estado** — reescreve `APLICADO` com `CONFERIDO_SEM_EFEITO`. Esse
 * registro é exatamente o que a camada 1 da idempotência consulta
 * (`WHERE identificador_da_liquidacao = $1 AND desfecho = 'APLICADO'`), e apagá-lo em silêncio faria
 * a reentrega seguinte reconsultar e reaplicar. Ela também **republicaria** a anomalia na trilha —
 * `negocio.evento_bancario` não tem chave única sobre `(cobranca_id, tipo, origem)`, e comitar o
 * evento junto do carimbo não fecha isso, porque quem reexecuta o caminho inteiro não lê carimbo
 * nenhum — e gastaria a cota que a RN-06 protege.
 *
 * Por isso o discriminador é o **estado da linha crua**, lido por {@link aindaPedeTratamento} como
 * primeira coisa depois de a linha existir. É o campo que `lerNotificacaoBancaria` publica **para
 * isto**, e o docblock de lá já o nomeia *"o discriminador de reentrância"*.
 *
 * ⚠️ **`comReentranciaBenigna` (de `./emissao-em-lote.ts`) NÃO serve aqui, e a diferença é de
 * natureza.** Aquele sentinela discrimina a **recusa de não-alcance de uma porta** — as irmãs
 * precisam dele porque `concluirConferencia` e `interromperLote` não alcançam a linha na segunda
 * passada. Aqui `marcarDesfecho` alcança a linha em **toda** ativação, então não há recusa a
 * traduzir: o que falta não é o discriminador genérico, é a **guarda de estado**. Isso vale como
 * medição, e não como opinião: o gatilho do `D58 · F4/T16` (*terceiro consumidor do
 * discriminador*) **segue não disparado** por esta borda.
 *
 * ===========================================================================
 * A IDEMPOTÊNCIA TEM TRÊS CAMADAS, e nenhuma delas é a garantia sozinha
 * ===========================================================================
 *
 *   1. **por identificador da liquidação** (passo B.5, `houveEfeitoDaLiquidacao`) — a mais barata:
 *      poupa a ida à rede e a linha duplicada na trilha. Ela **some com o expurgo dos 90 dias**, e
 *      isso é aceito por decisão (§9.2), porque não é ela que garante;
 *   2. **por estado**, no `UPDATE … WHERE` das portas de escrita — **estrutural e sem prazo**. É ela
 *      que sustenta a RN-08 depois de o cru ter sido expurgado: `liquidarPeloProvedor` devolve
 *      `NAO_ESTAVA_EM_ABERTO`, nenhum evento nasce, e o desfecho fica `CONFERIDO_SEM_EFEITO`;
 *   3. **por reentrância da tarefa** — {@link aindaPedeTratamento}, logo no topo do fluxo. Ver o
 *      bloco acima para por que o discriminador é o **estado da linha crua**, e a `DECISÃO FECHADA`
 *      no ponto dela para por que ele **nunca** é `tratado_em`.
 *
 * As três se compõem, e nenhuma substitui a outra: a 1 evita gastar cota, a 3 evita reexecutar o
 * caminho inteiro, e a 2 é a única que continua valendo quando as outras duas já não existem.
 *
 * ===========================================================================
 * O EXPURGO CORRE DEPOIS DE TUDO, E FORA DO DESFECHO
 * ===========================================================================
 *
 * O passo B.9 vive no corpo da função exportada, **acima** das oito saídas do tratamento, e a razão
 * está por extenso em {@link expurgarSemDerrubarODesfecho}. O que importa saber daqui: apagar o cru
 * **não toca a trilha** — `negocio.evento_bancario` não tem prazo de guarda —, e o `RETIDO` vencido é
 * apagado junto, por escolha registrada na §7.5 do tech spec.
 *
 * ⚠️ **A conferência do identificador do CLIENTE não acontece**, e a razão está no `DÉBITO COM
 * GATILHO` logo abaixo de {@link conferirNumeroDoTitulo}: não há valor gravado contra o qual comparar.
 */

import {
  type AdaptadorCobrancaBancaria,
  classificarNotificacaoBancaria,
  type GuardaDeBoletos,
  type NotificacaoBancariaClassificada,
  type SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import { ESQUEMA_DO_IDENTIFICADOR } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  type AjustesDoDesfecho,
  contextoDeTenant,
  type DesfechoDoTratamento,
  empresaSuspensa,
  estornarLiquidacao,
  expurgarNotificacoesVencidas,
  houveEfeitoDaLiquidacao,
  lerNotificacaoBancaria,
  liquidarPeloProvedor,
  localizarCobranca,
  marcarDesfecho,
  type NotificacaoBancariaPersistida,
  obterEnvelopeCifradoDoVigente,
  type RoteamentoDaNotificacao,
  registrarEventoBancario,
  revogarBoleto,
  rotearNotificacaoBancaria,
} from '@sysloc/db';
import { decifrarSegredo, FILA_DA_NOTIFICACAO_BANCARIA, type Logger } from '@sysloc/shared';
import { z } from 'zod';
import type { TarefaDaNotificacaoBancaria } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';

/**
 * O nome do **único** campo da carga — constante pela mesma razão das bordas irmãs: ele aparece no
 * esquema **e** na razão da falha, e dois literais separados divergem sem que nada acuse.
 */
const CAMPO_DA_NOTIFICACAO = 'notificacaoId';

/**
 * O que a carga da tarefa precisa ser — **exatamente** o identificador da linha crua.
 *
 * `strictObject`, e não `object`: a carga é o que uma borda sem sessão enfileirou, e ignorar o que
 * veio a mais é o começo de ela virar "o novo request". Em particular, um `empresaId` acrescentado
 * aqui é recusado **pelo nome** — e é essa recusa que impede a origem externa de escolher o tenant
 * (ADR-0024, terceira emenda · ADR-0035).
 */
const ESQUEMA_DA_CARGA = z.strictObject({
  [CAMPO_DA_NOTIFICACAO]: ESQUEMA_DO_IDENTIFICADOR,
});

/** A exigência publicada na razão da falha, nomeando o campo e **nada mais**. */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da notícia bancária exige o campo '${CAMPO_DA_NOTIFICACAO}', ` +
  'com identificador (UUID), e nada além dele';

/**
 * O nome **do produto** para o campo que a conferência compara — o que a recusa nomeia.
 *
 * Constante nomeada porque ele aparece em três lugares que precisam coincidir: o diagnóstico gravado
 * na trilha, o campo do registro estruturado e a razão que o operador lê. Três literais soltos ficam
 * livres para divergir, e o vocabulário do provedor voltaria por um deles (RN-18 / ADR-0001).
 */
const CAMPO_DO_NUMERO_DO_TITULO = 'numeroDoTituloNoProvedor';

/** O rótulo do motivo quando o erro não traz `code` nem é um `Error` — nunca cadeia vazia. */
const MOTIVO_NAO_IDENTIFICADO = 'NAO_IDENTIFICADO';

/**
 * O estado da linha crua, **derivado** do registro que o banco devolve — nunca redigitado (ADR-0016).
 *
 * Um estado que mude de nome em `plataforma.notificacao_bancaria` reprova **aqui**, no ponto de
 * consumo, em vez de produzir uma segunda descrição do mesmo vocabulário livre para divergir.
 */
type DesfechoDaLinhaCrua = NotificacaoBancariaPersistida['desfecho'];

/**
 * Os estados em que a linha crua **ainda pede tratamento** — os **dois** pendentes da §7.5.
 *
 * ⚠️ **Este é o ponto ÚNICO onde o conjunto se declara**, e é por isso que ele é uma tupla nomeada em
 * vez de um literal solto dentro da guarda: {@link DesfechoPendente} e {@link aindaPedeTratamento}
 * derivam dele, de modo que quem acrescentar um estado edita **uma** linha e não reescreve a guarda.
 *
 * O que entra aqui e o que não entra tem critério, e ele não é *"o desfecho é definitivo?"*:
 *
 *   * **`RETIDO`** (T9) **entrou**: a notícia da empresa suspensa fica pendente por decisão, e a
 *     reativação a manda tratar de novo — é o único estado que pede tratamento **sem** ser o
 *     inicial, e o único que já nasce com `tratado_em` gravado (a bicondicional do
 *     `notificacao_bancaria_tratamento_chk`). Tirá-lo daqui faria a retomada da CA-10 sair como
 *     reentrada benigna, sem efeito nenhum, e é isso que os `CT-985`/`CT-986` reprovam;
 *   * **`REENTREGA`** (T8) **não entra**: ele é conclusão — *o efeito desta liquidação já aconteceu*
 *     —, e tratar de novo o que já concluiu é exatamente o que esta guarda existe para impedir.
 */
const DESFECHOS_QUE_PEDEM_TRATAMENTO = [
  'RECEBIDO',
  'RETIDO',
] as const satisfies readonly DesfechoDaLinhaCrua[];

/** O conjunto acima como tipo — o **complemento** dele é o que a guarda entrega a {@link relatar}. */
type DesfechoPendente = (typeof DESFECHOS_QUE_PEDEM_TRATAMENTO)[number];

/**
 * O aviso de recebimento já **interpretado** — o ramo da união que carrega os três campos.
 *
 * Ele é derivado da união, e não redigitado: um campo que mude de nome lá reprova aqui, no ponto de
 * consumo, em vez de produzir uma segunda descrição do mesmo fato livre para divergir (ADR-0016).
 */
type AvisoDeRecebimento = Extract<
  NotificacaoBancariaClassificada,
  { classificacao: 'AVISO_DE_RECEBIMENTO' }
>;

/** A porta que a composição raiz entrega a esta borda (ADR-0025). */
export interface DependenciasDaNotificacaoBancaria {
  /** A porta única para transação, aberta pela composição raiz — nunca construída aqui. */
  readonly banco: AcessoAoBanco;
  /** A porta do provedor. O de produção e o de verificação são indistintos daqui (ADR-0025). */
  readonly adaptador: AdaptadorCobrancaBancaria;
  /** A guarda dos bytes do boleto — aqui ela só **apaga**, quando o provedor revogou o título. */
  readonly guarda: GuardaDeBoletos;
  /** A chave que abre o envelope do certificado. Ver a irmã em `./emissao-em-lote.ts`. */
  readonly chaveDeCifra: Buffer;
}

/**
 * Trata **uma** notícia recebida do provedor, do cru ao desfecho.
 *
 * **É seguro chamá-la mais de uma vez sobre a mesma notícia**, e a reentrada não é acidente: a fila
 * reentrega. A segunda ativação sobre linha que já concluiu **não faz nada** — nem consulta, nem
 * escreve, nem recarimba —, e a razão de o discriminador ser o estado da linha crua está no
 * cabeçalho, junto de por que `comReentranciaBenigna` não serve aqui.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaNotificacaoBancaria}.
 * @throws {Error} Quando a carga não traz o campo válido — **antes** de qualquer leitura —, quando a
 * linha crua não existe, quando a empresa dona da cobrança não tem certificado vigente, quando o
 * provedor recusa ou está indisponível, ou quando alguma porta de dados falha. Nos cinco a fila
 * repete pela política declarada em `@sysloc/shared`. **Desfecho de negócio nunca levanta** — ver o
 * cabeçalho.
 */
export async function processarNotificacaoBancaria(
  tarefa: TarefaDaNotificacaoBancaria,
  logger: Logger,
  dependencias: DependenciasDaNotificacaoBancaria,
): Promise<void> {
  await tratarNotificacao(tarefa, logger, dependencias);

  // O expurgo é o passo B.9, e ele mora **aqui fora** e não no fim de {@link tratarNotificacao}: o
  // tratamento tem oito saídas, e escrevê-lo dentro obrigaria a repeti-lo em todas — oito cópias que
  // ficariam livres para divergir, e das quais bastaria uma esquecida para a retenção não correr no
  // ramo que ela esqueceu. Fora, não há `return` que o contorne.
  //
  // ⚠️ **Ele NÃO corre quando o tratamento levanta**, e a ausência de `finally` é a decisão: a RN-11
  // manda expurgar *a cada notícia tratada*, e a passada que falhou não tratou nada — a fila
  // reentrega, e a passada que concluir expurga. Correr no `finally` acrescentaria uma escrita ao
  // caminho de falha sem que nada a peça.
  await expurgarSemDerrubarODesfecho(dependencias.banco, logger, tarefa);
}

/**
 * O tratamento propriamente dito — do cru ao desfecho, com as **oito** saídas da §5.1 B.
 *
 * Ela existe separada de {@link processarNotificacaoBancaria} por uma razão só, e ela é de forma: o
 * expurgo do passo B.9 corre **depois de qualquer** uma dessas saídas, e a única maneira de garanti-lo
 * sem repetir a chamada oito vezes é ter um ponto de retorno único acima delas.
 */
async function tratarNotificacao(
  tarefa: TarefaDaNotificacaoBancaria,
  logger: Logger,
  dependencias: DependenciasDaNotificacaoBancaria,
): Promise<void> {
  // Primeiro a recusa, e só depois qualquer leitura: é a ordem que impede a tarefa de correr sobre
  // uma carga que o esquema não aceita.
  const { notificacaoId } = cargaConferida(ESQUEMA_DA_CARGA, EXIGENCIA_DA_CARGA, tarefa.data);
  const { adaptador, banco, chaveDeCifra, guarda } = dependencias;

  // A unidade 1 — o cru, **sem contexto de tenant**. A tabela não tem dono-empresa (ADR-0031), e
  // ainda não se sabe de que empresa o fato é: descobrir é o passo seguinte.
  const cru = await banco.emUnidadeDeTrabalho(
    async (tx) => await lerNotificacaoBancaria(tx, notificacaoId),
  );

  if (cru === undefined) {
    // Estado que a borda torna irrepresentável no caminho normal — ela grava a linha ANTES de
    // enfileirar. Alcançável só pelo cru já expurgado (90 dias) ou por carga forjada, e nos dois o
    // silêncio seria pior: a tarefa concluiria anunciando um tratamento que não aconteceu.
    throw new Error(`a notícia bancária ${notificacaoId} não foi encontrada para tratamento`);
  }

  if (!aindaPedeTratamento(cru.desfecho)) {
    // **Reentrada benigna**, e ela termina aqui: uma passada anterior já concluiu, e o carimbo é o
    // registro disso. Prosseguir regrediria o desfecho, republicaria a anomalia na trilha e gastaria
    // cota do provedor — os três estão medidos no cabeçalho, junto da razão de a guarda ser de
    // estado e não de recusa de porta.
    //
    // Ela alcança **todos** os ramos, inclusive os dois que morrem na interpretação
    // (`VALIDACAO_DE_ENDERECO` e `ILEGIVEL`), e isso não perde nada: reinterpretar um corpo que não
    // muda produz o mesmo rótulo, e o que a segunda passada faria de novo seria mover `tratado_em`
    // para um instante em que nada foi tratado.
    //
    // Termina com **sucesso**, e não levantando: a reentrega não é falha, e fazê-la falhar
    // reentregaria para sempre uma notícia que já está resolvida.
    relatar(logger, tarefa, notificacaoId, cru.desfecho);

    return;
  }

  const classificada = classificarNotificacaoBancaria(cru.recebido);

  if (classificada.classificacao !== 'AVISO_DE_RECEBIMENTO') {
    // Os dois desfechos que morrem na interpretação: o pedido de validação do endereço (RN-10) e a
    // forma não reconhecida. Nenhuma cobrança é procurada, e o provedor não é consultado.
    await carimbar(banco, notificacaoId, classificada.classificacao);
    relatar(logger, tarefa, notificacaoId, classificada.classificacao);

    return;
  }

  // Os dois identificadores extraídos acompanham **todo** desfecho a partir daqui, inclusive o do
  // órfão: é o que torna a linha crua consultável por quem for medir quantas notícias não casaram
  // com cobrança alguma, e é o que a camada 1 da idempotência lerá depois.
  const identificadores: AjustesDoDesfecho = {
    identificadorPeranteOProvedor: classificada.identificadorPeranteOProvedor,
    identificadorDaLiquidacao: classificada.identificadorDaLiquidacao,
  };

  // A unidade 2 — o roteamento, também **sem contexto**: a empresa é o RESULTADO dele, e a função de
  // banco não tem por onde recebê-la (ADR-0024). É a única leitura de `negocio` sem contexto da
  // fatia, e ela atravessa por travessia nominal, não por ausência de política.
  const roteamento = await banco.emUnidadeDeTrabalho(
    async (tx) => await rotearNotificacaoBancaria(tx, classificada.identificadorPeranteOProvedor),
  );

  if (roteamento === undefined) {
    // RN-06: o que não casa morre **antes** de qualquer consulta — é isto que impede uma remessa
    // forjada em massa de consumir cota da integração.
    await carimbar(banco, notificacaoId, 'SEM_CORRESPONDENCIA', identificadores);
    relatar(logger, tarefa, notificacaoId, 'SEM_CORRESPONDENCIA');

    return;
  }

  // A unidade 3 — a **camada 1 da idempotência** (passo B.5, RN-08), e ela também corre **sem
  // contexto**: a pergunta é sobre `plataforma.notificacao_bancaria`, que não tem dono-empresa
  // (ADR-0031). A posição é conteúdo: depois do roteamento, porque só aqui se sabe que a notícia
  // casou com cobrança; e **antes** da conferência e da consulta, porque é justamente a ida à rede
  // que ela existe para poupar (RN-06).
  const jaProduziuEfeito = await banco.emUnidadeDeTrabalho(
    async (tx) => await houveEfeitoDaLiquidacao(tx, classificada.identificadorDaLiquidacao),
  );

  if (jaProduziuEfeito) {
    // ⚠️ **Ela é a camada BARATA, e não a garantia** — some junto com o cru dos 90 dias, e isso é
    // aceito por decisão (§9.2). A garantia é a camada 2, estrutural e sem prazo: o
    // `UPDATE … WHERE pago_em IS NULL` de `liquidarPeloProvedor`, que recusa a segunda liquidação
    // mesmo depois de o cru ter sido expurgado.
    //
    // O predicado da porta é `desfecho = 'APLICADO'`, e **`CONFERIDO_SEM_EFEITO` não entra**: uma
    // primeira notícia que encontrou o título ainda em aberto — a corrida entre o aviso e a baixa no
    // provedor — precisa poder ser reprocessada. Fundir os dois transformaria corrida benigna em
    // recebimento perdido.
    await carimbar(banco, notificacaoId, 'REENTREGA', identificadores);
    relatar(logger, tarefa, notificacaoId, 'REENTREGA', roteamento);

    return;
  }

  // A unidade 4 — a SUSPENSÃO (passo B.6, RN-09), lida **sem contexto**: `identidade.empresa` é
  // schema sem noção de tenant (ADR-0009), e é por isso que a pergunta cabe aqui, antes de o
  // contexto que o roteamento resolveu ser aberto por quem escreve em `negocio`.
  //
  // A empresa é a que a **função de roteamento devolveu**, e nunca um campo do recebido: nenhuma
  // origem externa escolhe de quem é o fato (ADR-0035).
  const suspensa = await banco.emUnidadeDeTrabalho(
    async (tx) => await empresaSuspensa(tx, roteamento.empresaId),
  );

  if (suspensa) {
    // ⚠️ **A posição é conteúdo, e ela é ANTES da conferência e da consulta.** O que a suspensão
    // suspende é o **efeito**, e o efeito começa na ida ao provedor: perguntar depois gastaria cota
    // (RN-06) e, no ramo divergente, publicaria uma anomalia na trilha de uma empresa que não está
    // operando. Depois da idempotência, e não antes, porque a notícia cuja liquidação **já**
    // produziu efeito não tem o que reter — ela é reentrega, e reter uma reentrega faria a
    // reativação reprocessar um fato já aplicado.
    //
    // `RETIDO` é **pendente**, e não conclusão: ele está em {@link DESFECHOS_QUE_PEDEM_TRATAMENTO},
    // de modo que a reentrega — pela fila ou pela reativação — retoma o tratamento do começo, com o
    // roteamento refeito. É o que torna a retomada **idempotente por construção**: o que continuar
    // suspenso volta a `RETIDO`, e o que já tiver produzido efeito vira `REENTREGA`.
    //
    // Nada é gravado em `negocio` aqui, e por isso o carimbo corre em unidade própria, sem contexto:
    // a linha crua não tem dono-empresa (ADR-0031).
    await carimbar(banco, notificacaoId, 'RETIDO', identificadores);
    relatar(logger, tarefa, notificacaoId, 'RETIDO', roteamento);

    return;
  }

  const divergencia = conferirNumeroDoTitulo(roteamento, classificada);

  if (divergencia !== undefined) {
    await recusarPorDivergencia(banco, notificacaoId, roteamento, identificadores, divergencia);
    logger.warn(
      {
        idTarefa: tarefa.id,
        fila: FILA_DA_NOTIFICACAO_BANCARIA,
        notificacaoId,
        desfecho: 'DIVERGENTE',
        empresaId: roteamento.empresaId,
        cobrancaId: roteamento.cobrancaId,
        // O nome do campo do PRODUTO, e nunca o valor recebido: a linha vai para o journal, que não
        // tem prazo de guarda, e o recebido carrega dado pessoal do pagador (§13.1).
        campoDivergente: CAMPO_DO_NUMERO_DO_TITULO,
      },
      'notícia bancária recusada: o número do título informado não confere com o gravado',
    );

    // Uma linha só, e é esta: ela já carrega tudo o que a linha de `info` carregaria — o desfecho
    // inclusive — mais o campo divergente. Emitir as duas diria duas vezes o mesmo fato, com a
    // segunda calada justamente sobre o que distingue este caminho.
    return;
  }

  const desfecho = await aplicarOQueOProvedorInformar({
    adaptador,
    banco,
    chaveDeCifra,
    classificada,
    guarda,
    identificadores,
    notificacaoId,
    roteamento,
  });

  relatar(logger, tarefa, notificacaoId, desfecho, roteamento);
}

/**
 * A linha crua **ainda pede tratamento**? — o discriminador de reentrada desta borda.
 *
 * É um predicado de tipo, e não um `boolean` solto, porque o **complemento** dele é o que
 * {@link relatar} recebe: negado, ele estreita o estado para `DesfechoDoTratamento`, isto é, para um
 * desfecho que já foi carimbado. Sem isso, quem chama teria de reafirmar por conversão o que a
 * própria comparação já provou.
 *
 * ⚠️ **A lista mora em {@link DESFECHOS_QUE_PEDEM_TRATAMENTO}, e o critério de entrada está no
 * docblock dela.** Aqui não há literal a acrescentar.
 */
// DECISÃO FECHADA — T8 / challenge de spec · 2026-08-18
// O QUÊ: o discriminador de reentrância desta borda é o **DESFECHO** da linha crua. `tratado_em`
//        NÃO é, e não pode virar, o discriminador.
// POR QUÊ: o `notificacao_bancaria_tratamento_chk` é bicondicional —
//        `(tratado_em IS NULL) = (desfecho = 'RECEBIDO')` —, de modo que a notícia `RETIDO` **já
//        nasce com `tratado_em` gravado**. Curto-circuitar por `tratado_em IS NOT NULL` faria a
//        notícia retida sair **sem efeito** exatamente na reentrega que a CA-10 exige que funcione,
//        derrubando os CT-985 e CT-986 da T9. `tratado_em` responde *"quando a tarefa passou por
//        aqui pela última vez"*; a pergunta *"isto acabou?"* é do desfecho. O challenge de
//        2026-08-18 fechou esta contradição, e a forma por `tratado_em` é a que a próxima passada
//        vai achar mais idiomática.
// REVERTER EXIGE: provar que a bicondicional do `check` deixou de dar `tratado_em` ao `RETIDO` — e,
//        com ela, que nenhum estado pendente carrega carimbo de tratamento.
// ⚠️ ESTE MARCADOR NÃO CONGELA O CONTEÚDO DE `DESFECHOS_QUE_PEDEM_TRATAMENTO`: acrescentar `RETIDO`
//        àquela tupla é o critério de aceitação da T9, e é a aplicação desta decisão, não a violação
//        dela. O que está fechado é **qual campo discrimina**, nunca quais estados pedem tratamento.
function aindaPedeTratamento(desfecho: DesfechoDaLinhaCrua): desfecho is DesfechoPendente {
  return DESFECHOS_QUE_PEDEM_TRATAMENTO.some((pendente) => pendente === desfecho);
}

/**
 * Compara o número do título **recebido** com o **gravado** — os três ramos da RN-05.
 *
 * @returns O valor recebido quando ele **difere** do gravado, e `undefined` quando não há divergência
 * a registrar. O `undefined` cobre **dois** ramos, e a fusão é deliberada: o gravado igual e o
 * gravado nulo levam ao mesmo lugar — a consulta —, e separá-los aqui obrigaria quem chama a decidir
 * de novo o que a RN-07 já decidiu.
 */
// DÉBITO COM GATILHO — D17 · F4/T7 · registrado 2026-08-19
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma conferência que falta, não protege o código abaixo.)
// O QUÊ: a RN-05 e a CA-08 mandam conferir o número do título **e o identificador do cliente**. Só a
//        primeira metade existe aqui: o produto não modela a identidade da empresa perante o
//        provedor, e não há valor gravado contra o qual comparar a segunda.
// QUANDO FECHA: quando o produto modelar a identidade da empresa perante o provedor (identificador
//        da aplicação, endereço de autorização, dados da conta) — **o mesmo gatilho do
//        D36 · F4/T10**, medido em 2026-08-15 e reafirmado em 2026-08-17.
// POR QUE NÃO AGORA: trazê-la exige campo novo em `esquemaDoCertificadoNovo`, isto é, **superfície
//        publicada**, às vésperas do congelamento da API — o que o próprio D36 mede como pior que
//        adiar.
// ÍNDICE: docs/specs/features/webhook-e-carne/v1/_run/run-report.md §2, D17
function conferirNumeroDoTitulo(
  roteamento: RoteamentoDaNotificacao,
  aviso: AvisoDeRecebimento,
): string | undefined {
  const gravado = roteamento.numeroDoTituloNoProvedor;

  // ⚠️ **Ausência NÃO é divergência.** O `null` é o par que `revogarBoleto` produz de propósito — ver
  // o cabeçalho deste arquivo. Trocar este `=== null` por uma comparação direta com o recebido é o
  // mutante de duas pernas que o `CT-1006` barra.
  if (gravado === null || gravado === aviso.numeroDoTituloNoProvedor) {
    return undefined;
  }

  return aviso.numeroDoTituloNoProvedor;
}

/**
 * Registra a anomalia na trilha e carimba `DIVERGENTE` — **na mesma unidade de trabalho**.
 *
 * As duas escritas comitam juntas porque descrevem **um** fato: a notícia foi recusada. Gravar o
 * evento sem o carimbo deixaria a linha crua em `RECEBIDO` com uma anomalia já publicada na trilha, e
 * a reentrega registraria a segunda anomalia sobre a mesma recusa.
 *
 * A unidade corre **sob o contexto que o roteamento resolveu** — é a primeira escrita da tarefa em
 * `negocio`, e a política de lá é que recorta o que ela alcança (ADR-0008). Nenhuma comparação de
 * empresa é escrita aqui.
 *
 * ⚠️ **O valor recebido viaja INTACTO até a coluna de diagnóstico** (RN-18/CA-21): ele não é
 * traduzido, normalizado, encurtado nem substituído por rótulo do produto. É o mesmo desenho do
 * `motivo` da revogação, e a razão é a mesma — o que torna um valor desconhecido inócuo é **nada o
 * interpretar**. Nenhum ramo de decisão o lê.
 */
async function recusarPorDivergencia(
  banco: AcessoAoBanco,
  notificacaoId: string,
  roteamento: RoteamentoDaNotificacao,
  identificadores: AjustesDoDesfecho,
  informado: string,
): Promise<void> {
  const diagnostico =
    `a notícia informou ${CAMPO_DO_NUMERO_DO_TITULO} '${informado}', ` +
    'que não confere com o gravado na cobrança';

  await contextoDeTenant.executarCom({ empresaId: roteamento.empresaId }, async () => {
    await banco.emUnidadeDeTrabalho(async (tx) => {
      await registrarEventoBancario(tx, {
        cobrancaId: roteamento.cobrancaId,
        tipo: 'NOTICIA_RECUSADA',
        origem: 'NOTICIA_DO_PROVEDOR',
        diagnostico,
      });
      await marcarDesfecho(tx, notificacaoId, 'DIVERGENTE', { ...identificadores, diagnostico });
    });
  });
}

/** O que {@link aplicarOQueOProvedorInformar} precisa — reunido para não passar sete parâmetros. */
interface TrabalhoDaConsulta {
  readonly adaptador: AdaptadorCobrancaBancaria;
  readonly banco: AcessoAoBanco;
  readonly chaveDeCifra: Buffer;
  readonly classificada: AvisoDeRecebimento;
  readonly guarda: GuardaDeBoletos;
  readonly identificadores: AjustesDoDesfecho;
  readonly notificacaoId: string;
  readonly roteamento: RoteamentoDaNotificacao;
}

/**
 * Pergunta ao provedor pela situação do título e aplica **o que ele responder** (RN-07).
 *
 * O aviso disse apenas *onde olhar*. Quando a consulta o contradiz — ele alega recebimento e o
 * provedor responde *em aberto* —, **vale a consulta, sempre**: é a CA-04, e é o que faz um aviso
 * forjado não mover dinheiro.
 *
 * O número que vai ao provedor é o **gravado**, e o recebido só entra quando não há gravado — o par
 * *identificador vivo × título nulo* do boleto revogado, único caso em que a notícia atrasada é a
 * única fonte da chave do provedor. Preferir o gravado é o que mantém a superfície de confiança no
 * mínimo: nos demais casos ele já foi conferido, e os dois são iguais por construção.
 *
 * @returns O desfecho a carimbar — `APLICADO` quando alguma porta de escrita mudou estado, e
 * `CONFERIDO_SEM_EFEITO` quando nada mudou. Os dois **não se fundem**: só o primeiro é evidência de
 * efeito para a camada 1 da idempotência, e fundi-los transformaria a corrida benigna — o aviso
 * chegando antes de a baixa existir no provedor — em recebimento perdido.
 * @throws {Error} Quando a empresa não tem certificado vigente, ou quando o provedor recusa ou está
 * indisponível. Nos dois a fila reentrega, que é o comportamento certo: nada foi decidido.
 */
async function aplicarOQueOProvedorInformar(
  trabalho: TrabalhoDaConsulta,
): Promise<'APLICADO' | 'CONFERIDO_SEM_EFEITO'> {
  const { adaptador, banco, chaveDeCifra, classificada, guarda, identificadores, notificacaoId } =
    trabalho;
  const { cobrancaId, codigo, empresaId } = trabalho.roteamento;

  return await contextoDeTenant.executarCom({ empresaId }, async () => {
    const envelopeCifrado = await banco.emUnidadeDeTrabalho(
      async (tx) => await obterEnvelopeCifradoDoVigente(tx),
    );

    if (envelopeCifrado === undefined) {
      // Levantar, e não concluir: sem certificado não há como consultar, e a consulta é quem decide
      // o efeito. Carimbar `CONFERIDO_SEM_EFEITO` aqui diria que se conferiu, o que é falso, e
      // gastaria a notícia — a reentrega deixa a decisão para depois de o certificado existir.
      throw new Error(
        `a notícia ${notificacaoId} não pôde ser tratada: a empresa da cobrança ${codigo} não tem ` +
          'certificado vigente para consultar a situação do título',
      );
    }

    const consultada = await adaptador.consultarSituacao({
      empresaId,
      // A decifra acontece DENTRO da expressão que monta a consulta, e o claro não ganha nome
      // próprio no escopo — ver o cabeçalho de `./emissao-em-lote.ts` (ADR-0032).
      segredo: decifrarSegredo(envelopeCifrado, chaveDeCifra),
      numeroDoTituloNoProvedor:
        trabalho.roteamento.numeroDoTituloNoProvedor ?? classificada.numeroDoTituloNoProvedor,
      // Os bytes não participam de decisão nenhuma aqui, e trazê-los custaria a resposta cara do
      // provedor em toda notícia recebida.
      incluirDocumento: false,
    });

    if (!consultada.aceito) {
      // A recusa do provedor **é** desfecho da porta, e não exceção — mas para esta tarefa ela é
      // falha: nada foi decidido, e a fila é quem deve tentar de novo. O motivo viaja intacto na
      // mensagem, sem nada do recebido junto.
      throw new Error(
        `a notícia ${notificacaoId} não pôde ser tratada: o provedor não respondeu a situação do ` +
          `título da cobrança ${codigo} (${consultada.classe}): ${consultada.motivo}`,
      );
    }

    const houveEfeito = await aplicarSituacao({
      banco,
      cobrancaId,
      codigo,
      guarda,
      identificadores,
      notificacaoId,
      situacao: consultada.valor,
    });

    return houveEfeito ? 'APLICADO' : 'CONFERIDO_SEM_EFEITO';
  });
}

/** O que {@link aplicarSituacao} precisa — já sob o contexto da empresa resolvida. */
interface TrabalhoDoEfeito {
  readonly banco: AcessoAoBanco;
  readonly cobrancaId: string;
  readonly codigo: string;
  readonly guarda: GuardaDeBoletos;
  readonly identificadores: AjustesDoDesfecho;
  readonly notificacaoId: string;
  readonly situacao: SituacaoConsultada;
}

/**
 * Aplica à cobrança o que o provedor respondeu, e devolve **se algo mudou**.
 *
 * O `switch` é sobre o discriminador da união **canônica**, sem ramo padrão: um estado novo declarado
 * no vocabulário não compila até que alguém decida o que ele causa. Ele **não** é — e não pode virar
 * — um `switch` sobre o motivo do provedor: é justamente nada interpretar o motivo que torna um
 * motivo desconhecido inócuo (RN-15 / ADR-0001).
 *
 * **O que é "efeito" é decidido pela PORTA**, e não por uma leitura escrita aqui: cada uma devolve o
 * desfecho benigno (`NAO_ESTAVA_EM_ABERTO`, `NAO_ESTAVA_PAGA`, `NAO_HAVIA_BOLETO`) quando o provedor
 * confirmou o que já era verdade, e nenhum evento nasce nesses casos (ADR-0034). Uma leitura de
 * estado antes da escrita seria corrida: entre o `SELECT` e o `UPDATE` cabe a baixa manual da rota de
 * pagamento.
 */
async function aplicarSituacao(trabalho: TrabalhoDoEfeito): Promise<boolean> {
  const { banco, cobrancaId, codigo, guarda, identificadores, notificacaoId, situacao } = trabalho;

  switch (situacao.situacao) {
    case 'EM_ABERTO':
      // Nada mudou: nenhuma porta de escrita é chamada, e portanto nenhum evento nasce. É o caminho
      // do aviso forjado que a consulta desmente (CA-04).
      await carimbar(banco, notificacaoId, 'CONFERIDO_SEM_EFEITO', identificadores);

      return false;

    case 'LIQUIDADO':
      return await banco.emUnidadeDeTrabalho(async (tx) => {
        // `valorTotal` é o total DERIVADO pela visão (ADR-0022) — original mais a mora vigente —, e é
        // ele que se esperava receber. Nada aqui calcula: a derivação é do banco. A leitura corre
        // ANTES da baixa, na mesma unidade, porque depois dela a mora já está carimbada.
        const esperado = await localizarCobranca(tx, codigo);

        if (esperado === undefined) {
          // Irrepresentável: o roteamento acabou de alcançar esta cobrança, e a política é a mesma.
          throw new Error(`a cobrança ${codigo} não foi alcançada para a baixa da notícia`);
        }

        const aplicada = await liquidarPeloProvedor(tx, codigo, {
          pagoEm: situacao.pagoEm,
          valorPago: emCadeiaDeDinheiro(situacao.valorPago),
          ...creditoDaLiquidacao(situacao.pagoEm, situacao.valorPago),
        });

        if (aplicada !== 'LIQUIDADA') {
          await marcarDesfecho(tx, notificacaoId, 'CONFERIDO_SEM_EFEITO', identificadores);

          return false;
        }

        await registrarEventoBancario(tx, {
          cobrancaId,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'NOTICIA_DO_PROVEDOR',
        });

        // A baixa NÃO é impedida pela divergência de valor (CA-11): o dinheiro entrou, e o que ela
        // provoca é um segundo evento — nunca uma recusa. A comparação é de igualdade exata entre
        // dois decimais de duas casas, como `conferencia.ts` a escreve pela mesma razão: nada aqui
        // soma, arredonda ou converte dinheiro, e qualquer diferença **é** a divergência.
        if (situacao.valorPago !== esperado.valorTotal) {
          await registrarEventoBancario(tx, {
            cobrancaId,
            tipo: 'DIVERGENCIA_DE_VALOR',
            origem: 'NOTICIA_DO_PROVEDOR',
            valorInformado: emCadeiaDeDinheiro(situacao.valorPago),
          });
        }

        await marcarDesfecho(tx, notificacaoId, 'APLICADO', identificadores);

        return true;
      });

    case 'ESTORNADO':
      return await banco.emUnidadeDeTrabalho(async (tx) => {
        const aplicado = await estornarLiquidacao(tx, codigo);

        if (aplicado !== 'ESTORNADA') {
          await marcarDesfecho(tx, notificacaoId, 'CONFERIDO_SEM_EFEITO', identificadores);

          return false;
        }

        await registrarEventoBancario(tx, {
          cobrancaId,
          tipo: 'LIQUIDACAO_ESTORNADA',
          origem: 'NOTICIA_DO_PROVEDOR',
        });
        await marcarDesfecho(tx, notificacaoId, 'APLICADO', identificadores);

        return true;
      });

    case 'REVOGADO': {
      const revogacao = await banco.emUnidadeDeTrabalho(async (tx) => {
        const aplicada = await revogarBoleto(tx, codigo);

        if (aplicada.desfecho !== 'REVOGADO') {
          await marcarDesfecho(tx, notificacaoId, 'CONFERIDO_SEM_EFEITO', identificadores);

          return false;
        }

        await registrarEventoBancario(tx, {
          cobrancaId,
          tipo: 'BOLETO_REVOGADO',
          origem: 'NOTICIA_DO_PROVEDOR',
          // O motivo do provedor viaja INTACTO até a coluna de diagnóstico (RN-15).
          diagnostico: situacao.motivo,
        });
        await marcarDesfecho(tx, notificacaoId, 'APLICADO', identificadores);

        return true;
      });

      if (revogacao) {
        // O fato de negócio primeiro, o arquivo depois — a ordem inversa deixaria, se a escrita
        // falhasse, uma linha apontando para um arquivo que não existe. É a ordem literal de
        // `conferencia.ts`, e o preço dela é um arquivo órfão, benigno: o nome é derivado do código
        // da cobrança, de modo que a emissão seguinte o sobrescreve em vez de acumular.
        await guarda.apagar(codigo);
      }

      return revogacao;
    }
  }
}

/**
 * Carimba o desfecho numa unidade própria — o fecho dos caminhos que **não** escrevem em `negocio`.
 *
 * Os caminhos que escrevem carimbam dentro da **mesma** unidade do efeito, e não por aqui: ver o
 * cabeçalho para por que o efeito e o desfecho comitam juntos.
 */
async function carimbar(
  banco: AcessoAoBanco,
  notificacaoId: string,
  desfecho: DesfechoDoTratamento,
  ajustes?: AjustesDoDesfecho,
): Promise<void> {
  await banco.emUnidadeDeTrabalho(async (tx) => {
    await marcarDesfecho(tx, notificacaoId, desfecho, ajustes);
  });
}

/**
 * Descarta o cru vencido dos 90 dias — passo B.9, RN-11 — **sem** que a falha dele derrube o
 * desfecho que a passada acabou de gravar.
 *
 * ===========================================================================
 * TRÊS PROPRIEDADES, e cada uma fecha um modo de falha diferente
 * ===========================================================================
 *
 *   1. **unidade própria, ao final.** O `DELETE` não divide transação com o efeito: se dividisse, um
 *      erro de expurgo abortaria a unidade e desfaria a baixa que já valeu junto ao provedor —
 *      dinheiro que entrou e que o produto deixaria de registrar;
 *   2. **a falha vira `warn` e a tarefa conclui.** É a mesma forma, e a mesma razão, do
 *      `semDerrubarODesfecho` de `apps/api/src/cobrancas/boleto.service.ts`: o fato de negócio já
 *      está commitado, e publicar falha sobre ele diria a quem opera o oposto do que aconteceu — a
 *      fila reentregaria uma notícia **já tratada**, e a passada seguinte a leria como reentrada
 *      benigna e sairia sem expurgar nada de novo;
 *   3. **granularidade determinística** (§5.1 B.9): a cada tratamento, e **não** amostrada. Amostrar
 *      poria aleatoriedade num caminho que a suíte precisa afirmar — o `CT-988` deixaria de ser um
 *      caso e passaria a ser uma aposta.
 *
 * O corte sai de `now()` **do banco** (ADR-0026), dentro da própria instrução da porta de dados:
 * nada aqui lê relógio, e nenhum instante do processo entra no prazo de guarda.
 *
 * ⚠️ **A linha só é emitida quando alguma coisa foi apagada.** Registrar `0` a cada notícia tratada
 * encheria o journal de um fato que não aconteceu, e é justamente esse ruído que faz quem opera
 * parar de ler. Zero não é silêncio por descuido: é o caso comum, e o que ele diz já está dito pela
 * ausência.
 *
 * ⚠️ **Nada do recebido entra na linha** (§13.1) — nem no caminho de sucesso, nem no de falha. O que
 * sai é a contagem, e o motivo da falha é o **código** dela, nunca a mensagem do driver, que carrega
 * fragmento de instrução e valor de parâmetro (ADR-0032).
 */
async function expurgarSemDerrubarODesfecho(
  banco: AcessoAoBanco,
  logger: Logger,
  tarefa: TarefaDaNotificacaoBancaria,
): Promise<void> {
  try {
    const apagadas = await banco.emUnidadeDeTrabalho(
      async (tx) => await expurgarNotificacoesVencidas(tx),
    );

    if (apagadas > 0) {
      logger.info(
        { idTarefa: tarefa.id, fila: FILA_DA_NOTIFICACAO_BANCARIA, apagadas },
        'notícias bancárias cruas vencidas foram descartadas',
      );
    }
  } catch (erro) {
    logger.warn(
      {
        idTarefa: tarefa.id,
        fila: FILA_DA_NOTIFICACAO_BANCARIA,
        motivo: motivoDaFalhaAcessoria(erro),
      },
      'o expurgo do recebido cru vencido falhou, e o desfecho já gravado permanece',
    );
  }
}

/**
 * O motivo de uma falha **acessória**, recortado ao que é seguro publicar: o `code` do driver, ou o
 * nome da classe do erro.
 *
 * ⚠️ **A mensagem do erro NÃO entra**, e a omissão é a decisão (ADR-0032): a do driver de banco
 * carrega fragmento da instrução e valor de parâmetro, e a do sistema de arquivos carrega o caminho
 * absoluto. O que quem opera precisa para agir é a classe da falha — `42501` diz *"o papel perdeu o
 * privilégio"*, e é ele que se procura no journal.
 *
 * É a **segunda** declaração desta função no repositório; a primeira é privada de
 * `apps/api/src/cobrancas/boleto.service.ts`. Duas cópias não disparam o limiar de três do
 * `CLAUDE.md`, e subir a primeira para casa comum pediria abrir um arquivo fora da lista desta task.
 */
function motivoDaFalhaAcessoria(erro: unknown): string {
  if (typeof erro === 'object' && erro !== null && 'code' in erro) {
    const { code } = erro;

    if (typeof code === 'string') {
      return code;
    }
  }

  return erro instanceof Error ? erro.name : MOTIVO_NAO_IDENTIFICADO;
}

/**
 * Compõe o crédito a partir do pagamento — a mesma derivação, e o mesmo ponto único, de
 * `conferencia.ts`.
 *
 * Ela existe como função nomeada, e não como duas atribuições no meio do ramo, para que a decisão
 * tenha **um** endereço nesta borda: o dia em que o extrato do provedor entrar no vocabulário
 * canônico, é aqui que a derivação deixa de ser necessária.
 */
function creditoDaLiquidacao(
  pagoEm: string,
  valorPago: number,
): { readonly dataDoCredito: string; readonly valorCreditado: string } {
  return { dataDoCredito: pagoEm, valorCreditado: emCadeiaDeDinheiro(valorPago) };
}

/**
 * Dinheiro em **cadeia**, como `numeric(15,2)` o recebe.
 *
 * A conversão mora **aqui**, em quem satisfaz a porta de dados, e não no domínio: o vocabulário
 * canônico declara o valor como número, e é esta camada que já traduz o resto do vocabulário para o
 * banco. Mesma decisão, e mesma razão, de `./conferencia-bancaria.ts`.
 */
function emCadeiaDeDinheiro(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Registra o desfecho para que ele seja observável de fora do processo (§13.1).
 *
 * ⚠️ **Nada do recebido cru entra aqui, em campo nenhum.** Ele carrega dado pessoal do pagador, e o
 * journal não tem prazo de guarda — o que atravessa são identificadores do produto e o rótulo do
 * desfecho. A recusa por divergência tem linha própria, de `warn`, escrita no ponto dela.
 */
function relatar(
  logger: Logger,
  tarefa: TarefaDaNotificacaoBancaria,
  notificacaoId: string,
  desfecho: DesfechoDoTratamento,
  roteamento?: RoteamentoDaNotificacao,
): void {
  logger.info(
    {
      idTarefa: tarefa.id,
      fila: FILA_DA_NOTIFICACAO_BANCARIA,
      notificacaoId,
      desfecho,
      ...(roteamento === undefined
        ? {}
        : { empresaId: roteamento.empresaId, cobrancaId: roteamento.cobrancaId }),
    },
    'notícia bancária tratada',
  );
}
