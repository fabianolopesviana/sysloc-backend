/**
 * A **borda da tarefa de conferência bancária** — onde o contexto de tenant nasce da carga (ADR-0024).
 *
 * ===========================================================================
 * Vale aqui, palavra por palavra, o cabeçalho de `./emissao-em-lote.ts`
 * ===========================================================================
 *
 * A conferência é **efeito externo cujo resultado não compõe a resposta do pedido** (ADR-0029); a
 * carga é recusada por `strictObject` **antes** de qualquer leitura e **antes** de abrir contexto; o
 * contexto vem da carga, **uma vez, na borda que a recebe** (ADR-0024), pelo mesmo escritor único da
 * borda HTTP; e **nenhum segredo viaja na carga** — o certificado é resolvido pelo banco, sob o
 * contexto que a própria carga estabelece, e decifrado com a chave do ambiente deste processo
 * (ADR-0032). Leia aquele arquivo para as razões por extenso; o que segue é o que é **próprio** desta
 * borda.
 *
 * ===========================================================================
 * A REENTRÂNCIA tem a mesma pergunta e uma resposta DIFERENTE — e ela não está no erro
 * ===========================================================================
 *
 * Esta fila também é **at-least-once**, e o `conferenciaId` também viaja na carga, de modo que
 * `concluirConferencia` também pode reentrar sobre uma conferência que a tentativa anterior já
 * fechou — e levantar `ErroDeConferenciaNaoAlcancada`.
 *
 * ⚠️ **Mas essa classe carrega SÓ o `conferenciaId`** — nada que discrimine reenvio de falha. A irmã
 * do lote carrega `loteId` **e** `desfecho`, e mesmo assim o `desfecho` diz **qual porta falou**, não
 * a **causa**. E aqui não há leitura que resolva: a camada de dados publica `lerConferenciaEmCurso`,
 * que responde *"qual está em andamento"* — e a conferência já concluída, que é exatamente o caso
 * benigno, **não está em andamento**, de modo que a leitura devolveria `undefined` tanto para o
 * reenvio benigno quanto para o alvo inexistente. O critério do lote é irreplicável aqui.
 *
 * **O critério existe, e mora fora daquele pacote: o consumidor sabe se está reentrando.** É o que o
 * Gate 2 fixou na T5, e é o que {@link ehReentrada} lê — do **estado da própria tarefa**, e não do
 * erro.
 *
 * ⚠️ **São DOIS contadores, e a disjunção não é enumeração de sintaxe**: a biblioteca de fila conta
 * separadamente as tentativas que **falharam** (`attemptsMade`, incrementado no `failed`) e as vezes
 * em que a tarefa foi **ativada** (`attemptsStarted`). O percurso literal que o *at-least-once*
 * nomeia — a tentativa que comitou e cujo processo caiu **antes do reconhecimento** — não produz
 * `failed` algum: ela volta por *stall*, e só o segundo contador a enxerga. Um predicado escrito
 * sobre um dos dois deixaria de fora justamente o percurso mais alcançável.
 *
 * ⚠️ **A recusa NÃO é engolida em bloco**, pela razão que o irmão registra por extenso: engolir
 * reinstalaria uma camada acima o modo de falha que a conferência da linha alcançada existe para
 * fechar. Na **primeira** ativação, `ErroDeConferenciaNaoAlcancada` sobe intacta.
 *
 * ===========================================================================
 * SEM CERTIFICADO VIGENTE, A CONFERÊNCIA É CONCLUÍDA COM ZERO — e a decisão é declarada
 * ===========================================================================
 *
 * Decisão de projeto tomada nesta task, que é o gatilho declarado do **D12 · F4/T5**: a empresa sem
 * certificado vigente tem a conferência **concluída** com `cobrancasConferidas: 0` e `efeitos: 0`, e a
 * causa é registrada no diário do processo.
 *
 * A alternativa — deixar o erro subir — foi descartada por custo **medido e assimétrico**:
 * `negocio.conferencia_bancaria` tem `concluida_em` e **nenhuma coluna de interrupção**, de modo que a
 * conferência que não é concluída fica `concluida_em IS NULL` **para sempre**; o índice único parcial
 * `(empresa_id) WHERE concluida_em IS NULL` faz **todo** disparo seguinte da empresa reencontrá-la, e
 * o Admin recebe `iniciadaAgora: false` indefinidamente, **sem caminho pela interface**. Uma
 * conferência presa nega a conciliação inteira daquele tenant até intervenção manual em banco — e na
 * **F5**, quando o disparo é do relógio, não há Admin para reclamar.
 *
 * Concluir com zero devolve o índice à empresa e torna o disparo seguinte possível assim que o
 * certificado for cadastrado; o preço é a causa não aparecer na superfície publicada, e ele é
 * **menor e reversível**. ⚠️ **O D12 NÃO está fechado por isto**: a falha que *sobe* — banco, disco,
 * ou o provedor derrubando as três tentativas — segue deixando a conferência presa, e fechá-la de vez
 * exige coluna de desfecho de interrupção (migração) e uma quinta porta de dados, fora do escopo desta
 * task. O gatilho do débito segue valendo, agora afiado: **a F5**.
 *
 * ===========================================================================
 * O que esta borda faz, e o que ela deliberadamente NÃO faz
 * ===========================================================================
 *
 * Ela liga as pontas e **não decide nada do domínio**: quem percorre, quem decide o que cada situação
 * causa e quem conta os efeitos é `conferirCobrancas`, em `@sysloc/cobranca-bancaria`. As cinco portas
 * de dados são fechadas por **aplicação parcial** sobre o `conferenciaId` — é por isso que
 * `TrabalhoDaConferencia` não o carrega: não há por onde o domínio alcançar outra conferência.
 *
 * **Nenhuma comparação de empresa é escrita aqui** (ADR-0008): quem recorta é a política do banco. E
 * **nenhum evento nasce de tentativa** (ADR-0034): cada porta de escrita só grava evento quando o
 * desfecho que ela devolve diz que algo mudou.
 */

import {
  type AdaptadorCobrancaBancaria,
  conferirCobrancas,
  type DesfechoDaConferencia,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import { ESQUEMA_DO_IDENTIFICADOR } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  concluirConferencia,
  contextoDeTenant,
  ErroDeConferenciaNaoAlcancada,
  estornarLiquidacao,
  liquidarPeloProvedor,
  localizarCobranca,
  obterEnvelopeCifradoDoVigente,
  registrarEventoBancario,
  revogarBoleto,
  selecionarCobrancasAConferir,
} from '@sysloc/db';
import { decifrarSegredo, FILA_DA_CONFERENCIA_BANCARIA, type Logger } from '@sysloc/shared';
import { z } from 'zod';
import type { TarefaDaConferenciaBancaria } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';

/**
 * Os nomes dos dois campos da carga — constantes pela mesma razão do irmão: cada um aparece no
 * esquema **e** na razão da falha, e dois literais separados divergem sem que nada acuse.
 */
const CAMPO_DA_EMPRESA = 'empresaId';
const CAMPO_DA_CONFERENCIA = 'conferenciaId';

/** O que a carga da tarefa precisa ser — **exatamente** os dois identificadores. */
const ESQUEMA_DA_CARGA = z.strictObject({
  [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR,
  [CAMPO_DA_CONFERENCIA]: ESQUEMA_DO_IDENTIFICADOR,
});

/** A exigência publicada na razão da falha, nomeando os campos e **nada mais**. */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da conferência bancária exige os campos '${CAMPO_DA_EMPRESA}' e ` +
  `'${CAMPO_DA_CONFERENCIA}', ambos com identificador (UUID), e nada além deles`;

/**
 * As contagens com que uma conferência sem certificado vigente se fecha — ver o cabeçalho.
 *
 * Constante nomeada, e não dois zeros no meio da chamada: o par **é** a afirmação *"a apuração não
 * percorreu nada e não mudou nada"*, e ele precisa se ler como tal no ponto em que é gravado.
 */
const CONFERENCIA_SEM_PASSADA = { cobrancasConferidas: 0, efeitos: 0 } as const;

/** As portas que a composição raiz do processo entrega a esta borda (ADR-0025). */
export interface DependenciasDaConferenciaBancaria {
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
 * Executa a conferência bancária de **uma** empresa, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaConferenciaBancaria}.
 * @throws {Error} Quando a carga não traz os dois campos válidos — **antes** de qualquer leitura e sem
 * abrir contexto —, quando alguma porta de dados falha, ou quando o fecho não alcança a linha **na
 * primeira ativação da tarefa**. Nos três a fila repete pela política declarada em `@sysloc/shared`.
 */
export async function processarConferenciaBancaria(
  tarefa: TarefaDaConferenciaBancaria,
  logger: Logger,
  dependencias: DependenciasDaConferenciaBancaria,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede a passada de correr sem contexto
  // válido e concluir a conferência como se ela tivesse acontecido.
  const carga = cargaConferida(ESQUEMA_DA_CARGA, EXIGENCIA_DA_CARGA, tarefa.data);
  const { adaptador, banco, chaveDeCifra, guarda } = dependencias;
  const { conferenciaId, empresaId } = carga;

  await contextoDeTenant.executarCom({ empresaId }, async () => {
    // A unidade 1 — o certificado e o conjunto a conferir, na MESMA unidade. Ela fecha aqui; a
    // decifra e a rede correm fora dela, para não segurar a conexão física durante a passada.
    const preparo = await banco.emUnidadeDeTrabalho(async (tx) => ({
      envelopeCifrado: await obterEnvelopeCifradoDoVigente(tx),
      cobrancas: await selecionarCobrancasAConferir(tx),
    }));

    const { envelopeCifrado } = preparo;

    if (envelopeCifrado === undefined) {
      await concluirSemCertificado(banco, conferenciaId, logger, tarefa, empresaId);

      return;
    }

    const desfecho = await comReentranciaBenigna(
      tarefa,
      logger,
      empresaId,
      conferenciaId,
      async () =>
        conferirCobrancas({
          empresaId,
          // A decifra acontece DENTRO da expressão que monta o trabalho, e o claro não ganha nome
          // próprio no escopo — ver o cabeçalho de `./emissao-em-lote.ts`.
          segredo: decifrarSegredo(envelopeCifrado, chaveDeCifra),
          cobrancas: preparo.cobrancas.map(({ id, codigo, numeroDoTituloNoProvedor }) => ({
            id,
            codigo,
            numeroDoTituloNoProvedor,
          })),
          adaptador,
          guarda,
          valorEsperado: async (cobranca) =>
            await banco.emUnidadeDeTrabalho(async (tx) => {
              const linha = await localizarCobranca(tx, cobranca.codigo);

              if (linha === undefined) {
                // Estado que o predicado do conjunto torna irrepresentável — a cobrança foi
                // selecionada nesta mesma passada. O ramo existe porque a leitura é anulável.
                throw new Error(`a cobrança ${cobranca.codigo} não foi alcançada na conferência`);
              }

              // `valorTotal` é o total DERIVADO pela visão (ADR-0022) — original mais a mora vigente —,
              // e é ele que se esperava receber. Nada aqui calcula: a derivação é do banco.
              return linha.valorTotal;
            }),
          // UMA unidade: a baixa, o evento da liquidação e — quando houve divergência — o segundo
          // evento. Gravar a baixa sem o evento deixaria a trilha sem o fato que explica por que a
          // cobrança está paga; gravar o evento sem a baixa anunciaria um pagamento que não existe.
          gravarLiquidacao: async (cobranca, liquidacao) =>
            await banco.emUnidadeDeTrabalho(async (tx) => {
              const aplicada = await liquidarPeloProvedor(tx, cobranca.codigo, {
                pagoEm: liquidacao.pagoEm,
                valorPago: emCadeiaDeDinheiro(liquidacao.valorPago),
                dataDoCredito: liquidacao.dataDoCredito,
                valorCreditado: emCadeiaDeDinheiro(liquidacao.valorCreditado),
              });

              if (aplicada !== 'LIQUIDADA') {
                // O desfecho benigno: o provedor confirmou o que já era verdade. Nada mudou, e por
                // isso nenhum evento nasce (ADR-0034).
                return aplicada;
              }

              await registrarEventoBancario(tx, {
                cobrancaId: cobranca.id,
                tipo: 'COBRANCA_LIQUIDADA',
                origem: 'CONFERENCIA',
              });

              if (liquidacao.divergente) {
                // A baixa NÃO é impedida pela divergência (CA-11): o que ela provoca é um segundo
                // evento, nunca uma recusa.
                await registrarEventoBancario(tx, {
                  cobrancaId: cobranca.id,
                  tipo: 'DIVERGENCIA_DE_VALOR',
                  origem: 'CONFERENCIA',
                  valorInformado: emCadeiaDeDinheiro(liquidacao.valorPago),
                });
              }

              return aplicada;
            }),
          gravarEstorno: async (cobranca) =>
            await banco.emUnidadeDeTrabalho(async (tx) => {
              const aplicado = await estornarLiquidacao(tx, cobranca.codigo);

              if (aplicado === 'ESTORNADA') {
                await registrarEventoBancario(tx, {
                  cobrancaId: cobranca.id,
                  tipo: 'LIQUIDACAO_ESTORNADA',
                  origem: 'CONFERENCIA',
                });
              }

              return aplicado;
            }),
          gravarRevogacao: async (cobranca, motivo) =>
            await banco.emUnidadeDeTrabalho(async (tx) => {
              const aplicada = await revogarBoleto(tx, cobranca.codigo);

              if (aplicada.desfecho === 'REVOGADO') {
                await registrarEventoBancario(tx, {
                  cobrancaId: cobranca.id,
                  tipo: 'BOLETO_REVOGADO',
                  origem: 'CONFERENCIA',
                  // O motivo do provedor viaja INTACTO até a coluna de diagnóstico (RN-15).
                  diagnostico: motivo,
                });
              }

              return aplicada.desfecho;
            }),
          concluir: async (contagens) => {
            await banco.emUnidadeDeTrabalho(async (tx) => {
              await concluirConferencia(tx, conferenciaId, contagens);
            });
          },
        }),
    );

    if (desfecho !== undefined) {
      logger.info(
        {
          idTarefa: tarefa.id,
          fila: FILA_DA_CONFERENCIA_BANCARIA,
          empresaId,
          conferenciaId,
          ...desfecho,
        },
        'conferência bancária concluída',
      );
    }
  });
}

/**
 * Esta ativação da tarefa é uma **reentrada**?
 *
 * Os dois contadores da biblioteca de fila respondem a metades diferentes da pergunta, e a disjunção
 * é a união delas — ver o cabeçalho para por que nenhum dos dois basta sozinho:
 *
 *   * `attemptsMade` conta as tentativas que **falharam** e foram redistribuídas pela política de
 *     repetição;
 *   * `attemptsStarted` conta as vezes em que a tarefa foi **movida para ativa**, o que inclui a
 *     redistribuição por *stall* — a tentativa que comitou e cujo processo caiu antes do
 *     reconhecimento, que é o percurso literal que o *at-least-once* nomeia.
 *
 * Na primeira ativação os dois valem, respectivamente, `0` e `1`.
 */
function ehReentrada(tarefa: TarefaDaConferenciaBancaria): boolean {
  return tarefa.attemptsMade > 0 || tarefa.attemptsStarted > 1;
}

/**
 * Executa a passada e trata a recusa do fecho **pelo estado da tarefa** — ver o cabeçalho.
 *
 * @returns O desfecho da passada, ou `undefined` quando a recusa foi reconhecida como **reenvio
 * benigno** — caso em que não há desfecho novo a relatar, porque a passada que de fato correu foi a
 * anterior.
 * @throws Repassa o erro na **primeira ativação** da tarefa, e repassa intacto qualquer erro que não
 * seja a recusa de não-alcance.
 */
async function comReentranciaBenigna(
  tarefa: TarefaDaConferenciaBancaria,
  logger: Logger,
  empresaId: string,
  conferenciaId: string,
  passada: () => Promise<DesfechoDaConferencia>,
): Promise<DesfechoDaConferencia | undefined> {
  try {
    return await passada();
  } catch (erro) {
    if (!(erro instanceof ErroDeConferenciaNaoAlcancada) || !ehReentrada(tarefa)) {
      // Primeira ativação: a escrita não teve efeito em tentativa alguma, e engolir a recusa
      // deixaria a conferência presa para sempre com a tarefa terminando `completed`.
      throw erro;
    }

    logger.info(
      {
        idTarefa: tarefa.id,
        fila: FILA_DA_CONFERENCIA_BANCARIA,
        empresaId,
        conferenciaId,
        tentativa: tarefa.attemptsStarted,
      },
      'a tarefa da conferência reentrou sobre uma conferência já concluída — nada a refazer',
    );

    return undefined;
  }
}

/**
 * Conclui com zero a conferência da empresa sem certificado vigente — ver o cabeçalho.
 *
 * O fecho passa pela **mesma** porta que a passada usaria, de modo que não há segundo caminho de
 * desfecho: o que muda é apenas quem descobriu a causa. A reentrância é tratada pelo mesmo predicado,
 * porque este caminho tem exatamente o mesmo modo de falha do outro.
 */
async function concluirSemCertificado(
  banco: AcessoAoBanco,
  conferenciaId: string,
  logger: Logger,
  tarefa: TarefaDaConferenciaBancaria,
  empresaId: string,
): Promise<void> {
  try {
    await banco.emUnidadeDeTrabalho(async (tx) => {
      await concluirConferencia(tx, conferenciaId, CONFERENCIA_SEM_PASSADA);
    });
  } catch (erro) {
    if (!(erro instanceof ErroDeConferenciaNaoAlcancada) || !ehReentrada(tarefa)) {
      throw erro;
    }
  }

  logger.warn(
    { idTarefa: tarefa.id, fila: FILA_DA_CONFERENCIA_BANCARIA, empresaId, conferenciaId },
    'conferência bancária concluída sem passada: a empresa não tem certificado vigente',
  );
}

/**
 * Dinheiro em **cadeia**, como `numeric(15,2)` o recebe.
 *
 * A conversão mora **aqui**, em quem satisfaz a porta, e não no domínio: o vocabulário canônico
 * declara o valor como número, e é esta camada que já traduz o resto do vocabulário para o banco.
 */
function emCadeiaDeDinheiro(valor: number): string {
  return valor.toFixed(2);
}
