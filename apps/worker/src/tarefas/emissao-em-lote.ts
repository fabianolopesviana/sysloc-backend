/**
 * A **borda da tarefa de emissão em lote** — onde o contexto de tenant nasce da carga (ADR-0024).
 *
 * ===========================================================================
 * A decisão que este arquivo materializa (ADR-0024 / ADR-0029)
 * ===========================================================================
 *
 * A emissão de boletos é **efeito externo cujo resultado não compõe a resposta do pedido**, e por isso
 * ela sai por fila (ADR-0029) e é executada aqui. Fora do ciclo de uma requisição não existe sessão, e
 * a ADR-0008 já fixara que a origem do contexto **nunca** é o request; a ADR-0024 fecha a lacuna que
 * sobrava: o contexto vem da **carga do próprio trabalho**, aberto **uma vez, na borda que a recebe**,
 * pelo **mesmo escritor único** que a borda HTTP usa (`contextoDeTenant.executarCom`). Nada abaixo
 * daqui reescreve o contexto, e **nenhuma sessão de serviço sintética é criada**.
 *
 * O `empresaId` que viaja na carga foi produzido por quem **já detinha direito a ele** — a sessão que
 * abriu o lote. Essa procedência **não é verificável pelo banco**: ela é disciplina de quem enfileira,
 * e é por isso que não há rota que aceite `empresaId` de fora.
 *
 * ===========================================================================
 * Por que a carga é RECUSADA antes de qualquer leitura
 * ===========================================================================
 *
 * Sem esta recusa o modo de falha é o **pior possível**: sem contexto, a política do banco não casa
 * linha alguma e devolve conjunto vazio **em silêncio** — a tarefa termina CONCLUÍDA, sem emitir nada,
 * e o lote *parece* ter rodado. Nenhum alarme, nenhuma linha vermelha, e a imobiliária descobre pelo
 * locatário que não recebeu boleto.
 *
 * A conferência é do **esquema**, e o identificador vem de `@sysloc/contracts` (ADR-0016): ele valida
 * a forma **e canoniza a caixa do UUID** (ADR-0017), que já foi vetor de escalada. A canonização não é
 * ornamento — é este valor que a unidade de trabalho compõe no `SET LOCAL`. A razão da falha nomeia o
 * **campo**, nunca o valor recebido: ela fica gravada no servidor de fila e chega ao journal, e valor
 * de campo pode ser dado de outra empresa.
 *
 * ===========================================================================
 * NENHUM SEGREDO CHEGA PELA CARGA — o certificado é resolvido AQUI (ADR-0032)
 * ===========================================================================
 *
 * A carga leva **dois identificadores e nada mais**. O material e a senha do certificado são
 * resolvidos pelo **banco**, sob o contexto que esta mesma carga estabelece, e decifrados com a chave
 * do **ambiente deste processo** — que é por que `lerAmbiente` passou a exigi-la. A alternativa
 * intuitiva (mandar o material junto) é o vetor exato do achado crítico da fase anterior: a carga
 * viaja como argumento de comando do servidor de fila, a biblioteca de acesso anexa `err.command` a
 * qualquer erro, e a redação única alcança chave sensível **pelo nome** — que ali não existe.
 *
 * A decifra acontece **dentro da expressão que monta o trabalho**, e o claro não ganha nome próprio no
 * escopo: uma variável com o segredo aberto é exatamente o que um registro de diagnóstico futuro
 * acharia à mão. É a mesma disciplina, e a mesma escrita, de `apps/api/src/cobrancas/boleto.service.ts`.
 *
 * ===========================================================================
 * UMA unidade para o preparo, e uma por cobrança — a rede corre FORA delas
 * ===========================================================================
 *
 * A unidade 1 lê o lote (de onde sai a competência), o envelope cifrado e o conjunto do lote: os três
 * descrevem a mesma passada, e lê-los juntos é o que impede o conjunto de descrever um instante e o
 * certificado outro. **Ela fecha antes de a decifra e a rede começarem** — o que se protege é a
 * conexão física, recurso escasso do processo inteiro: uma unidade aberta durante o aperto de mão com
 * o provedor seguraria a conexão por lote inteiro, e cem cobranças esgotariam a reserva.
 *
 * Cada escrita do percurso abre unidade própria, e isso é decisão do domínio (`executarEmissaoEmLote`):
 * uma unidade única para o lote faria a falha da décima cobrança desfazer o registro das nove
 * anteriores, e é justamente o registro que dá a idempotência da repetição.
 *
 * ===========================================================================
 * O QUE FAZER QUANDO A EMPRESA NÃO TEM CERTIFICADO VIGENTE
 * ===========================================================================
 *
 * O lote é **interrompido**, nomeando a causa, e a tarefa termina bem-sucedida. É o que a §5.2 J da
 * `tech_spec.md` fixa — *"no lote, é falha `DA_EMPRESA` e **interrompe** (RN-02)"* —, e a alternativa
 * (deixar o erro subir) tem custo medido: as três tentativas queimam, o lote fica `EM_ANDAMENTO` para
 * sempre e o **índice único parcial** recusa toda abertura seguinte da empresa. O Admin ficaria sem
 * emitir e sem saber por quê. Interrompido, ele lê o motivo na prestação de contas e reabre depois de
 * cadastrar o certificado.
 *
 * ⚠️ **O certificado VENCIDO não é conferido aqui**, e a ausência é decisão: quem o recusa é o
 * provedor, no aperto de mão, e é o **adaptador** quem classifica a recusa como `DA_EMPRESA` — o que
 * já interrompe o lote pelo caminho do domínio. Uma conferência de vigência escrita nesta borda seria
 * a segunda regra sobre o mesmo fato, livre para divergir da primeira.
 *
 * ===========================================================================
 * A REENTRÂNCIA É DESFECHO TERMINAL BENIGNO — e a distinção é do CHAMADOR
 * ===========================================================================
 *
 * A entrega desta fila é **at-least-once** e o `loteId` viaja na carga, de modo que a tarefa **pode
 * reentrar sobre um lote que a tentativa anterior já concluiu** — o caso clássico é a tentativa 1
 * comitar e o processo cair antes do reconhecimento. Nesse reenvio, `concluirLote` e `interromperLote`
 * não alcançam a linha (o desfecho já está gravado) e levantam `ErroDeLoteNaoAlcancado`.
 *
 * ⚠️ **É UMA classe para DUAS causas, e isso é decisão declarada da camada de dados — não lacuna.**
 * Zero linhas tem dois percursos: o **reenvio benigno** e o **grave** (alvo inexistente, ou contexto de
 * tenant montado de outro modo). Separá-los lá exigiria uma leitura que seria segunda regra sobre o
 * mesmo fato. Quem distingue é esta borda, porque ela tem o que a camada de dados não tem: o
 * conhecimento de que está reentrando.
 *
 * **O critério, e ele é o fato gravado**: capturada a recusa, abre-se uma unidade nova **sob o mesmo
 * contexto** e relê-se o lote com `lerLote`. Linha presente e com desfecho já gravado (`estado` ≠
 * `EM_ANDAMENTO`) é reenvio benigno — a tentativa anterior fez o trabalho, e a tarefa termina
 * bem-sucedida. Linha ausente, ou ainda `EM_ANDAMENTO`, é o caso grave, e **o erro sobe**.
 *
 * ⚠️ **A recusa NÃO é engolida em bloco.** `catch (e) { if (e instanceof ErroDeLoteNaoAlcancado)
 * return; }` é a leitura mais natural de *"trate o reenvio como sucesso"* e é **errada**: ela engole o
 * caso grave como sucesso, reinstalando uma camada acima exatamente o modo de falha que a conferência
 * da linha alcançada existe para fechar. O lote ficaria para sempre com os dois carimbos nulos, o
 * índice único recusaria toda abertura seguinte, e a tarefa terminaria dizendo ao operador o **oposto**
 * da verdade.
 *
 * ⚠️ **Os DOIS percursos que gravam desfecho nesta borda passam pelo MESMO discriminador**, e a
 * simetria é a decisão: o percurso do domínio e o da empresa sem certificado vigente chamam portas
 * diferentes, mas gravam o mesmo tipo de fato e têm **o mesmo modo de falha** no reenvio — o
 * `interromper` da segunda passada não alcança a linha pela mesma razão que o `concluir` não
 * alcança. Tratar a reentrância em **um** deles e não no outro deixa a metade não tratada terminando
 * `failed` sobre um lote correto, que é o inverso do que este cabeçalho combate; e tratá-la por dois
 * critérios distintos seria a segunda regra sobre o mesmo fato, livre para divergir da primeira.
 *
 * ===========================================================================
 * O que esta borda faz, e o que ela deliberadamente NÃO faz
 * ===========================================================================
 *
 * Ela liga as pontas e **não decide nada do domínio**: quem percorre, quem decide o que a falha causa
 * e quem carimba o desfecho é `executarEmissaoEmLote`, em `@sysloc/cobranca-bancaria`. As portas
 * chegam a ele **por parâmetro** (ADR-0025), e as seis portas de dados são fechadas por **aplicação
 * parcial** sobre o `loteId` — é por isso que `TrabalhoDoLote` não tem `loteId`: não há por onde o
 * domínio alcançar outro lote.
 *
 * **Nenhuma comparação de empresa é escrita aqui** (ADR-0008): quem recorta é a política do banco.
 */

import {
  type AdaptadorCobrancaBancaria,
  type DesfechoDoLote,
  executarEmissaoEmLote,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import { ESQUEMA_DO_IDENTIFICADOR } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  concluirLote,
  contextoDeTenant,
  ErroDeLoteNaoAlcancado,
  gravarBoletoDaCobranca,
  interromperLote,
  lerLote,
  localizarCobranca,
  localizarPessoa,
  obterEnvelopeCifradoDoVigente,
  proximoIdentificadorBancario,
  registrarEventoBancario,
  registrarItemDoLote,
  selecionarCobrancasSemBoleto,
} from '@sysloc/db';
import { decifrarSegredo, FILA_DA_EMISSAO_EM_LOTE, type Logger } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { z } from 'zod';
import type { TarefaDaEmissaoEmLote } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';

/**
 * Os nomes dos dois campos da carga — constantes porque cada um aparece em **dois** contratos.
 *
 * Eles são as chaves do esquema e são as cadeias que a razão da falha publica, e é por essas cadeias
 * que a verificação reconhece a recusa. Literais separados divergiriam sem que nada acusasse: o
 * esquema passaria a exigir um campo e a mensagem a nomear outro.
 */
const CAMPO_DA_EMPRESA = 'empresaId';
const CAMPO_DO_LOTE = 'loteId';

/**
 * O que a carga da tarefa precisa ser — **exatamente** os dois identificadores.
 *
 * `strictObject`, e não `object`: campo desconhecido é **recusado**, em vez de ignorado. A carga é a
 * origem do contexto de tenant, e ignorar o que veio a mais é o começo de ela virar "o novo request"
 * — a alternativa que a ADR-0024 rejeita por nome.
 */
const ESQUEMA_DA_CARGA = z.strictObject({
  [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR,
  [CAMPO_DO_LOTE]: ESQUEMA_DO_IDENTIFICADOR,
});

/** A exigência publicada na razão da falha, nomeando os campos e **nada mais**. */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da emissão em lote exige os campos '${CAMPO_DA_EMPRESA}' e ` +
  `'${CAMPO_DO_LOTE}', ambos com identificador (UUID), e nada além deles`;

/** O estado do lote que ainda **não** tem desfecho gravado — ver o cabeçalho, sobre a reentrância. */
const LOTE_EM_ANDAMENTO = 'EM_ANDAMENTO';

/**
 * O motivo com que o lote é interrompido quando a empresa não tem certificado vigente.
 *
 * Ele é texto **do produto**, e não do provedor: nenhuma chamada chegou a acontecer. Ele nomeia a
 * causa e nada mais — nem identificador, nem caminho, nem valor.
 */
const MOTIVO_SEM_CERTIFICADO =
  'a empresa não tem certificado vigente do provedor bancário: nenhuma cobrança foi tentada';

/**
 * O que o percurso da interrupção devolve quando ele **de fato** gravou o desfecho.
 *
 * Ele existe porque {@link comReentranciaBenigna} reserva `undefined` para o reenvio benigno, e este
 * percurso — diferente do percurso do domínio — não produz desfecho algum a relatar. Sem um valor
 * presente não haveria como separar *"interrompeu agora"* de *"reentrou sobre lote já interrompido"*,
 * e a segunda linha do diário diria ao operador que a emissão parou **nesta** passada.
 */
const INTERROMPIDO_NESTA_PASSADA = true;

/** As portas que a composição raiz do processo entrega a esta borda (ADR-0025). */
export interface DependenciasDaEmissaoEmLote {
  /**
   * A porta única para transação, aberta pela composição raiz e encerrada por ela no desligamento.
   *
   * Ela é **recebida**, e não construída aqui: quem conhece `DATABASE_URL` é `lerAmbiente`, e uma
   * segunda abertura por tarefa criaria uma reserva de conexões por job.
   */
  readonly banco: AcessoAoBanco;
  /** A porta do provedor. O de produção e o de verificação são indistintos daqui (ADR-0025). */
  readonly adaptador: AdaptadorCobrancaBancaria;
  /** A guarda dos bytes do boleto — grava e devolve o nome do arquivo, relativo à base. */
  readonly guarda: GuardaDeBoletos;
  /**
   * A chave que abre o envelope do certificado, de `CHAVE_DE_CIFRA_DO_CERTIFICADO`.
   *
   * Ela chega **já decodificada**, pela mesma razão da composição raiz do serviço de aplicação: é
   * assim que a cifra a consome, e uma segunda decodificação nesta borda seria uma segunda declaração
   * da codificação. Ela **não** é registrada, não viaja em carga e não é ecoada em mensagem alguma.
   */
  readonly chaveDeCifra: Buffer;
}

/**
 * Executa a emissão em lote de **uma** empresa, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaEmissaoEmLote}.
 * @throws {Error} Quando a carga não traz os dois campos válidos — **antes** de qualquer leitura e sem
 * abrir contexto —, quando alguma porta de dados falha, ou quando o desfecho do lote não alcança a
 * linha **e a releitura não confirma o reenvio**. Nos três a fila repete pela política declarada em
 * `@sysloc/shared`.
 */
export async function processarEmissaoEmLote(
  tarefa: TarefaDaEmissaoEmLote,
  logger: Logger,
  dependencias: DependenciasDaEmissaoEmLote,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede o trabalho de correr sem contexto
  // válido e devolver vazio como se fosse sucesso.
  const carga = cargaConferida(ESQUEMA_DA_CARGA, EXIGENCIA_DA_CARGA, tarefa.data);
  const { adaptador, banco, chaveDeCifra, guarda } = dependencias;
  const { empresaId, loteId } = carga;

  await contextoDeTenant.executarCom({ empresaId }, async () => {
    // A unidade 1 — o lote, o certificado e o conjunto, na MESMA unidade. Ela fecha aqui; a decifra e
    // a rede correm fora dela.
    const preparo = await banco.emUnidadeDeTrabalho(async (tx) => {
      const lote = await lerLote(tx, loteId);

      if (lote === undefined) {
        // Duas causas deliberadamente indistinguíveis para a camada de dados — o lote não existe, ou
        // é de outra empresa e a política o esconde —, e as duas são **graves** aqui: o identificador
        // veio de uma carga que o próprio sistema compôs a partir de um lote que ele gravou. O erro
        // sobe, a fila repete, e o operador lê a razão no journal.
        throw new Error(`a tarefa da emissão em lote não alcançou o lote ${loteId}`);
      }

      return {
        competencia: lote.competencia,
        envelopeCifrado: await obterEnvelopeCifradoDoVigente(tx),
        cobrancas: await selecionarCobrancasSemBoleto(tx, lote.competencia),
      };
    });

    const { envelopeCifrado } = preparo;

    if (envelopeCifrado === undefined) {
      await interromperSemCertificado(banco, loteId, logger, tarefa.id, empresaId);

      return;
    }

    const desfecho = await comReentranciaBenigna(
      banco,
      loteId,
      logger,
      tarefa.id,
      empresaId,
      async () =>
        await executarEmissaoEmLote({
          empresaId,
          // A decifra acontece DENTRO da expressão que monta o trabalho, e o claro não ganha nome
          // próprio no escopo — ver o cabeçalho.
          segredo: decifrarSegredo(envelopeCifrado, chaveDeCifra),
          cobrancas: preparo.cobrancas.map(({ id, codigo }) => ({ id, codigo })),
          adaptador,
          guarda,
          // Unidade PRÓPRIA, e a razão é a ADR-0020: o avanço do contador não participa do
          // desfazimento da unidade que grava, e o número queimado nunca volta.
          identificador: async () =>
            await banco.emUnidadeDeTrabalho(async (tx) => await proximoIdentificadorBancario(tx)),
          dados: async (cobranca) =>
            await banco.emUnidadeDeTrabalho(
              async (tx) => await dadosDaEmissao(tx, cobranca.codigo),
            ),
          // UMA unidade, TRÊS escritas: os campos de conciliação, o item do lote e o evento. Gravar o
          // boleto sem o item deixaria a prestação de contas mentindo sobre o que aconteceu, e gravar
          // o item sem o boleto faria a cobrança voltar ao conjunto do lote seguinte com o título já
          // emitido no provedor.
          gravarEmissao: async (cobranca, boleto) => {
            await banco.emUnidadeDeTrabalho(async (tx) => {
              await gravarBoletoDaCobranca(tx, cobranca.codigo, boleto);
              await registrarItemDoLote(tx, {
                loteId,
                cobrancaId: cobranca.id,
                desfecho: 'EMITIDO',
              });
              await registrarEventoBancario(tx, {
                cobrancaId: cobranca.id,
                tipo: 'BOLETO_EMITIDO',
                origem: 'ATO_DO_ADMIN',
              });
            });
          },
          // O motivo do provedor viaja INTACTO até as duas escritas (RN-15) — nada aqui o lê.
          gravarRecusa: async (cobranca, motivo) => {
            await banco.emUnidadeDeTrabalho(async (tx) => {
              await registrarItemDoLote(tx, {
                loteId,
                cobrancaId: cobranca.id,
                desfecho: 'RECUSADO',
                motivo,
              });
              await registrarEventoBancario(tx, {
                cobrancaId: cobranca.id,
                tipo: 'EMISSAO_RECUSADA',
                origem: 'ATO_DO_ADMIN',
                diagnostico: motivo,
              });
            });
          },
          concluir: async () => {
            await banco.emUnidadeDeTrabalho(async (tx) => {
              await concluirLote(tx, loteId);
            });
          },
          interromper: async (motivo) => {
            await banco.emUnidadeDeTrabalho(async (tx) => {
              await interromperLote(tx, loteId, motivo);
            });
          },
        }),
    );

    if (desfecho !== undefined) {
      registrarDesfecho(logger, tarefa.id, empresaId, loteId, desfecho);
    }
  });
}

/**
 * Executa o percurso e trata a recusa do desfecho **relendo o lote** — ver o cabeçalho.
 *
 * Ela é a **entrada única** da reentrância desta borda, e serve aos dois percursos que gravam
 * desfecho: o do domínio, que devolve as contagens, e o da empresa sem certificado vigente, que
 * devolve apenas o sinal de que interrompeu. Daí o parâmetro de tipo — o que a função decide é sobre
 * a **recusa**, e não sobre o que o percurso produziu.
 *
 * ⚠️ **O critério é o FATO GRAVADO, e não o estado da tarefa.** A borda irmã da conferência
 * (`conferencia-bancaria.ts`) discrimina por `ehReentrada`, o contador de ativações da biblioteca de
 * fila, **por não haver leitura que resolva**; aqui há: `lerLote` publica o desfecho, e ele separa o
 * reenvio benigno do caso grave pelo que está no banco. O contador aprovaria como benigna qualquer
 * recusa ocorrida numa reativação — inclusive a do lote que não existe.
 *
 * @returns O que o percurso devolveu, ou `undefined` quando a recusa foi confirmada como **reenvio
 * benigno** — caso em que não há nada novo a relatar, porque a passada que de fato correu foi a
 * anterior.
 * @throws Repassa o erro quando a releitura **não** confirma o reenvio, e repassa intacto qualquer
 * erro que não seja a recusa de não-alcance.
 */
// DÉBITO COM GATILHO — D58 · F4/T16 · registrado 2026-08-18
// O QUÊ: o parâmetro de tipo é irrestrito, e a reserva de `undefined` como sentinela exclusivo de
//        reenvio benigno vive só no docblock acima — não no tipo.
// QUANDO FECHA: o TERCEIRO consumidor de `comReentranciaBenigna`, ou a primeira alteração do
//        contrato do sentinela. Um `percurso` que devolva `X | undefined` faz `T | undefined`
//        colapsar em `T`, e o caso GRAVE passa a ser lido como reenvio benigno, em silêncio.
// POR QUE NÃO AGORA: os dois consumidores atuais estão medidos e corretos — `DesfechoDoLote` é
//        interface (nunca `undefined`) e `INTERROMPIDO_NESTA_PASSADA` preserva o literal `true`;
//        o impacto hoje é inexistente, e o tipo mudaria depois de os dois gates aprovarem.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D58
async function comReentranciaBenigna<T>(
  banco: AcessoAoBanco,
  loteId: string,
  logger: Logger,
  idTarefa: string | undefined,
  empresaId: string,
  percurso: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await percurso();
  } catch (erro) {
    if (!(erro instanceof ErroDeLoteNaoAlcancado)) {
      throw erro;
    }

    // A releitura corre sob o MESMO contexto que já estava aberto — este bloco vive dentro do
    // `executarCom` da borda —, e é ela que separa as duas causas de zero linhas.
    const lote = await banco.emUnidadeDeTrabalho(async (tx) => await lerLote(tx, loteId));

    if (lote === undefined || lote.estado === LOTE_EM_ANDAMENTO) {
      // O caso GRAVE: a escrita não teve efeito em tentativa alguma. O erro sobe — engoli-lo aqui
      // deixaria o lote com os dois carimbos nulos para sempre, e o índice único parcial recusaria
      // toda abertura seguinte da empresa, com a tarefa terminando `completed`.
      throw erro;
    }

    logger.info(
      { idTarefa, fila: FILA_DA_EMISSAO_EM_LOTE, empresaId, loteId, estado: lote.estado },
      'a tarefa da emissão em lote reentrou sobre um lote já desfechado — nada a refazer',
    );

    return undefined;
  }
}

/**
 * Interrompe o lote da empresa sem certificado vigente — ver o cabeçalho para por que interromper.
 *
 * A interrupção passa pela **mesma** porta que o percurso usaria, de modo que não há segundo caminho
 * de desfecho: o que muda é apenas quem descobriu a causa. E ela passa pelo **mesmo discriminador de
 * reentrância**, pela mesma razão: este caminho tem exatamente o mesmo modo de falha do outro — a
 * empresa que ainda não cadastrou certificado é o estado operacional mais banal do produto, e o
 * reenvio sobre o lote que a passada anterior já interrompeu recusa em `interromperLote` (o
 * `interrompido_em IS NULL` da instrução deixa de alcançar a linha). Sem o tratamento, as três
 * tentativas queimam e a tarefa termina `failed` sobre um lote corretamente `INTERROMPIDA`.
 *
 * O aviso só sai quando a interrupção **aconteceu nesta passada**: no reenvio, quem já relatou foi
 * {@link comReentranciaBenigna}, e repetir o aviso diria que a emissão parou agora.
 */
async function interromperSemCertificado(
  banco: AcessoAoBanco,
  loteId: string,
  logger: Logger,
  idTarefa: string | undefined,
  empresaId: string,
): Promise<void> {
  const interrompidoAgora = await comReentranciaBenigna(
    banco,
    loteId,
    logger,
    idTarefa,
    empresaId,
    async () => {
      await banco.emUnidadeDeTrabalho(async (tx) => {
        await interromperLote(tx, loteId, MOTIVO_SEM_CERTIFICADO);
      });

      return INTERROMPIDO_NESTA_PASSADA;
    },
  );

  if (interrompidoAgora === undefined) {
    return;
  }

  logger.warn(
    { idTarefa, fila: FILA_DA_EMISSAO_EM_LOTE, empresaId, loteId },
    'emissão em lote interrompida: a empresa não tem certificado vigente',
  );
}

/**
 * Registra o término para que ele seja observável de fora do processo.
 *
 * As contagens e o desfecho entram; **nenhum código de cobrança, nome, documento ou linha digitável**
 * entra — a prestação de contas por cobrança é a rota do lote, e é lá que ela é lida. O
 * `motivoDaInterrupcao` entra porque é o que diz ao operador **por que** a emissão parou, e ele é
 * texto que o provedor informou sobre a **empresa**, nunca sobre um pagador.
 */
function registrarDesfecho(
  logger: Logger,
  idTarefa: string | undefined,
  empresaId: string,
  loteId: string,
  desfecho: DesfechoDoLote,
): void {
  logger.info(
    { idTarefa, fila: FILA_DA_EMISSAO_EM_LOTE, empresaId, loteId, ...desfecho },
    'emissão em lote concluída',
  );
}

/**
 * Lê da cobrança o que o pedido de emissão precisa e a seleção não trouxe.
 *
 * `valorTotal` é o total **derivado pela visão** (ADR-0022) — o original mais a mora vigente —, e é
 * ele que se cobra: nada aqui calcula, e a derivação é do banco. O locatário sai do cadastro pelo
 * identificador que a própria cobrança publica, e a projeção é montada **campo a campo**: espalhar o
 * cadastro inteiro mandaria ao provedor tudo o que ele venha a ganhar — inclusive dado que o provedor
 * não precisa ver.
 *
 * ⚠️ **Ela é a segunda escrita desta projeção no produto** — a primeira é
 * `BoletoService.lerDadosDaEmissao`, em `apps/api`, para o ato unitário. As duas não podem ser uma só
 * hoje: aquela é método privado de um serviço do NestJS, e este processo não importa `apps/api`
 * (seria aresta app→app, que o grafo de dependências recusa). O limiar de três do `CLAUDE.md` marca o
 * ponto em que ela sobe para casa compartilhada, e o `DÉBITO COM GATILHO` abaixo o agenda.
 */
// DÉBITO COM GATILHO — D50 · F4/T16 · registrado 2026-08-18
// O QUÊ: a projeção do pedido de emissão (valor derivado, vencimento e os nove campos do locatário)
//        existe DUAS vezes: aqui e em `apps/api/src/cobrancas/boleto.service.ts`
//        (`lerDadosDaEmissao`). Endurecer uma — acrescentar um campo que o provedor passe a exigir —
//        deixa a outra para trás, e a divergência sai como pedido aceito por um caminho e recusado
//        pelo outro, sem que nada acuse por leitura.
// QUANDO FECHA: o TERCEIRO consumidor da projeção (a fatia (iii), do carnê, é a candidata), ou a
//        primeira alteração dos campos que o pedido leva ao provedor.
// POR QUE NÃO AGORA: a casa compartilhada seria `@sysloc/db` (as duas leituras são de lá), e
//        publicá-la exige decidir se a projeção é do vocabulário canônico ou da fronteira de dados —
//        decisão de contrato, com efeito em `packages/cobranca-bancaria`, fora da lista da T16.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D50
async function dadosDaEmissao(
  tx: TransactionSql,
  codigo: string,
): Promise<{
  readonly valor: number;
  readonly vencimento: string;
  readonly locatario: {
    readonly nome: string;
    readonly documento: string;
    readonly logradouro: string;
    readonly numero: string;
    readonly complemento: string | null;
    readonly bairro: string;
    readonly cidade: string;
    readonly estado: string;
    readonly cep: string;
  };
}> {
  const cobranca = await localizarCobranca(tx, codigo);

  if (cobranca === undefined) {
    // Estado que o predicado do conjunto torna irrepresentável — a cobrança foi selecionada nesta
    // mesma passada. O ramo existe porque a leitura é anulável, e um `!` aqui mandaria `undefined` ao
    // provedor dentro do pedido.
    throw new Error(`a cobrança ${codigo} do lote não foi alcançada na leitura do pedido`);
  }

  const locatario = await localizarPessoa(tx, 'locatario', cobranca.locatarioId);

  if (locatario === undefined) {
    // Estado que a chave estrangeira composta torna irrepresentável — cobrança aponta para contrato,
    // e contrato para locatário, os dois na mesma empresa.
    throw new Error(`a cobrança ${codigo} do lote não alcançou o cadastro do locatário`);
  }

  return {
    valor: cobranca.valorTotal,
    vencimento: cobranca.dataVencimento,
    locatario: {
      nome: locatario.nome,
      documento: locatario.documentoPrincipal,
      logradouro: locatario.logradouro,
      numero: locatario.numero,
      complemento: locatario.complemento,
      bairro: locatario.bairro,
      cidade: locatario.cidade,
      estado: locatario.estado,
      cep: locatario.cep,
    },
  };
}
