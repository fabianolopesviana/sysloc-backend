/**
 * A **borda da tarefa de reconferência da entrega da notícia** — o contexto nasce da carga (ADR-0024).
 *
 * ===========================================================================
 * Por que ela existe: o certificado trocou, e o que o produto sabia deixou de descrever o mundo
 * ===========================================================================
 *
 * A linha de `negocio.entrega_da_noticia` é a **cópia durável** do que a última verificação apurou
 * junto ao provedor. Registrar um certificado novo troca a identidade com que a empresa se apresenta
 * ao banco — e, com ela, o que o provedor responde sobre a entrega daquela conta. A cópia durável
 * passa a descrever um aperto de mão que já não acontece, e o Admin lê na tela um estado que ninguém
 * reconferiu.
 *
 * Reconferir é **efeito externo cujo resultado não compõe a resposta do pedido** de registro, e por
 * isso ele sai **por fila** e não em linha na borda (ADR-0029). A ativação manual é o outro lado da
 * mesma ADR e permanece síncrona, porque ali o Admin espera o desfecho na própria resposta.
 *
 * ===========================================================================
 * A ORDEM É: recusar a carga, abrir contexto, ler, perguntar, e só então gravar
 * ===========================================================================
 *
 * Vale aqui, palavra por palavra, o cabeçalho de `./conferencia-bancaria.ts`: a carga é recusada por
 * `strictObject` **antes** de qualquer leitura e **antes** de abrir contexto — é essa ordem que
 * impede a passada de correr sem contexto válido e devolver vazio como se fosse sucesso; **nenhum
 * segredo viaja na carga**, porque o certificado e a identidade são resolvidos pelo banco sob o
 * contexto que a própria carga estabelece e decifrados com a chave do ambiente deste processo
 * (ADR-0032); e **nenhuma comparação de empresa é escrita aqui** (ADR-0008), porque quem recorta é a
 * política do banco.
 *
 * ⚠️ **A carga desta tarefa LEVA `empresaId`, e isso é conformidade** — a **terceira emenda da
 * ADR-0024** (2026-08-18) declara o alcance: o identificador viaja quando quem enfileirou já detinha
 * direito a ele, e aqui quem enfileirou foi a borda que atendeu a **sessão do Admin**. Não a leia por
 * analogia com `./notificacao-bancaria.ts`, cuja carga NÃO tem empresa porque lá a empresa é o
 * **resultado** da travessia nominal de um fato de terceiro (ADR-0035). As duas convivem neste
 * processo, e copiar a forma de uma na outra é violação nas duas direções.
 *
 * ===========================================================================
 * GRAVA SÓ QUANDO O DESFECHO MUDA — e é isto que a RN-15 pede (ADR-0034)
 * ===========================================================================
 *
 * A reconferência é **releitura**, e releitura que confirma o que já se sabia **não é fato novo**. O
 * que a ADR-0034 fixa é que o registro nasce do **efeito**, não da tentativa; aqui o vaso é a própria
 * linha de estado, e regravá-la sem mudança avançaria `verificada_em` — o carimbo que a tela do Admin
 * lê como *"foi verificado agora"* — sem que verificação alguma tivesse mudado o que se sabe.
 *
 * A comparação é feita **antes** de abrir a segunda unidade de trabalho, e é por isso que a linha
 * permanece idêntica **campo a campo, inclusive o instante**, quando nada muda.
 *
 * ⚠️ **A empresa sem linha SEMPRE grava**, e não é exceção da regra acima: `verificada_em` nulo é o
 * estado *"nunca houve tentativa"* (CA-19), e ele é **distinto** de uma tentativa que apurou
 * desabilitada. Tratar os dois como iguais faria a primeira reconferência de uma empresa nova não
 * deixar rastro nenhum.
 *
 * ===========================================================================
 * O PROVEDOR QUE NÃO RESPONDE FAZ A TAREFA FALHAR — e a alternativa foi medida
 * ===========================================================================
 *
 * `consultarEntrega` **resolve em todos os desfechos e nunca rejeita** (ver `./porta-de-entrega-da-
 * noticia.ts`, em `@sysloc/cobranca-bancaria`), e o desfecho da indisponibilidade é
 * `{ aceito: false, motivo: null }`. Aqui esse desfecho **levanta**, e a tarefa termina em falha
 * declarada: a fila a repete pela política de `@sysloc/shared`, e a linha do estado fica **intacta**.
 *
 * A alternativa idiomática — gravar `habilitada: false` com motivo nulo — está descartada por razão
 * concreta: ela apagaria, por causa de uma indisponibilidade momentânea, o motivo íntegro que o Admin
 * ainda precisa ler, e faria a tela anunciar uma desabilitação **que ninguém decidiu**. É a mesma
 * leitura que `apps/api/src/integracoes-bancarias/entrega-da-noticia.service.ts` faz do cadastro.
 *
 * ⚠️ **O preço está declarado, e ele é o `D35 · F5/T7`**: `{ aceito: false, motivo: null }` também é
 * o que a porta devolve quando o provedor **respondeu e não encontrou cadastro nosso** — o caminho
 * principal de desabilitação. Enquanto a porta não distinguir os dois, a reconferência **não
 * desabilita por ausência de cadastro**; ela falha e repete. O desfecho conservador foi escolhido de
 * propósito: aqui não há Admin esperando resposta, e um estado preservado a mais custa menos que uma
 * habilitação apagada por engano. Quando o `D35` fechar, é este ramo que ganha o terceiro desfecho.
 *
 * ===========================================================================
 * SEM PRÉ-CONDIÇÃO, NADA É PERGUNTADO E NADA É GRAVADO
 * ===========================================================================
 *
 * Certificado vigente e identidade são as duas pré-condições do ato externo, e a empresa pode não ter
 * nenhuma delas — o registro que disparou esta tarefa pode ter sido o primeiro da empresa, sem que a
 * identidade tenha sido informada. Faltando qualquer uma, a passada **não acontece** e a linha
 * permanece como está, com a causa no diário do processo. Desabilitar por falta de configuração
 * nossa seria inventar um fato sobre o provedor.
 */

import type { LeituraDaEntrega, PortaDeEntregaDaNoticia } from '@sysloc/cobranca-bancaria';
import { ESQUEMA_DO_IDENTIFICADOR } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  contextoDeTenant,
  type EstadoDaEntregaGravado,
  gravarDesfechoDaEntrega,
  type IdentidadeParaUso,
  lerEstadoDaEntrega,
  lerIdentidadeParaUso,
  type MotivoDaRecusaDoProvedor,
  obterEnvelopeCifradoDoVigente,
  type SituacaoDaEntrega,
} from '@sysloc/db';
import { decifrarSegredo, FILA_DA_RECONFERENCIA_DA_ENTREGA, type Logger } from '@sysloc/shared';
import { z } from 'zod';
import type { TarefaDaReconferenciaDaEntrega } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';

/**
 * O nome do único campo da carga — constante pela razão das irmãs: ele aparece no esquema **e** na
 * razão da falha, e dois literais separados divergem sem que nada acuse.
 */
const CAMPO_DA_EMPRESA = 'empresaId';

/** O que a carga da tarefa precisa ser — **exatamente** o identificador da empresa. */
const ESQUEMA_DA_CARGA = z.strictObject({
  [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR,
});

/** A exigência publicada na razão da falha, nomeando o campo e **nada mais**. */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da reconferência da entrega da notícia exige o campo ` +
  `'${CAMPO_DA_EMPRESA}', com identificador (UUID), e nada além dele`;

/**
 * A razão com que a tarefa falha quando o provedor não respondeu — cadeia **fixa**.
 *
 * Ela não carrega nada do que chegou: o que o provedor devolveu, quando devolveu alguma coisa, é o
 * `motivo` — e nesse desfecho ele é nulo por definição. A razão fica gravada no servidor de fila e
 * alcança o journal, e é por isso que ela nomeia o fato e nunca um valor.
 */
const RECUSA_SEM_RESPOSTA =
  'a reconferência da entrega da notícia não obteve resposta do provedor — o estado permanece';

/** As portas que a composição raiz do processo entrega a esta borda (ADR-0025). */
export interface DependenciasDaReconferenciaDaEntrega {
  /** A porta única para transação, aberta pela composição raiz — nunca construída aqui. */
  readonly banco: AcessoAoBanco;
  /** A porta da entrega junto ao provedor. O de produção e o de verificação são indistintos daqui. */
  readonly entrega: PortaDeEntregaDaNoticia;
  /** A chave que abre o envelope do certificado. Ver a irmã em `./conferencia-bancaria.ts`. */
  readonly chaveDeCifra: Buffer;
}

/**
 * O que a primeira unidade de trabalho apura — o estado guardado e as duas pré-condições do ato.
 *
 * `estado` é `undefined` quando a empresa **nunca tentou** — e essa ausência é conteúdo, não falha:
 * ver a seção do cabeçalho sobre a empresa sem linha.
 */
interface PreparoDaReconferencia {
  readonly estado: EstadoDaEntregaGravado | undefined;
  readonly envelopeCifrado: string | undefined;
  readonly identidade: IdentidadeParaUso | undefined;
}

/** O que a reconsulta apurou — a forma em que ele é comparado com o guardado e gravado. */
interface DesfechoApurado {
  readonly situacao: SituacaoDaEntrega;
  readonly motivo: MotivoDaRecusaDoProvedor | null;
  /** Preservada como estava: a reconferência **não cria** cadastro, e portanto não a produz. */
  readonly referenciaNoProvedor: string | null;
}

/**
 * Reconfere a entrega da notícia de **uma** empresa, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaReconferenciaDaEntrega}.
 * @throws {Error} Quando a carga não traz o campo válido — **antes** de qualquer leitura e sem abrir
 * contexto —, quando alguma porta de dados falha, ou quando o provedor **não respondeu**. Nos três a
 * fila repete pela política declarada em `@sysloc/shared`, e a linha do estado permanece intacta.
 */
export async function processarReconferenciaDaEntrega(
  tarefa: TarefaDaReconferenciaDaEntrega,
  logger: Logger,
  dependencias: DependenciasDaReconferenciaDaEntrega,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede a reconsulta de correr sem
  // contexto válido e ler `undefined` como se fosse *"esta empresa nunca tentou"*.
  const { empresaId } = cargaConferida(ESQUEMA_DA_CARGA, EXIGENCIA_DA_CARGA, tarefa.data);
  const { banco, chaveDeCifra, entrega } = dependencias;

  await contextoDeTenant.executarCom({ empresaId }, async () => {
    // A unidade 1 — o estado guardado e as duas pré-condições, na MESMA unidade. Ela fecha aqui; a
    // decifra e a rede correm fora dela, para não segurar a conexão física durante o aperto de mão.
    const preparo = await banco.emUnidadeDeTrabalho<PreparoDaReconferencia>(async (tx) => ({
      estado: await lerEstadoDaEntrega(tx),
      envelopeCifrado: await obterEnvelopeCifradoDoVigente(tx),
      identidade: await lerIdentidadeParaUso(tx, chaveDeCifra),
    }));

    const { envelopeCifrado, identidade } = preparo;

    if (envelopeCifrado === undefined || identidade === undefined) {
      // Sem pré-condição não há o que perguntar, e nada é gravado — ver o cabeçalho. `warn`, e não
      // `error`: é configuração pendente da empresa, não defeito do serviço.
      logger.warn(
        {
          idTarefa: tarefa.id,
          fila: FILA_DA_RECONFERENCIA_DA_ENTREGA,
          empresaId,
          semCertificado: envelopeCifrado === undefined,
          semIdentidade: identidade === undefined,
        },
        'a reconferência da entrega não correu: a empresa não tem as pré-condições do ato',
      );

      return;
    }

    const leitura = await entrega.consultarEntrega(
      {
        empresaId,
        // A decifra acontece DENTRO da expressão que monta o ato, e o claro não ganha nome próprio no
        // escopo — ver o cabeçalho de `./emissao-em-lote.ts`.
        segredo: decifrarSegredo(envelopeCifrado, chaveDeCifra),
        identidade,
      },
      preparo.estado?.referenciaNoProvedor ?? undefined,
    );

    if (leitura.tipo === 'NAO_RESPONDEU' && leitura.motivo === null) {
      // O provedor não respondeu. A recusa **sobe** em vez de virar gravação — ver o cabeçalho.
      // ⚠️ **Só quando o motivo é NULO.** Motivo presente é o provedor tendo respondido e recusado,
      // e isso é um fato dele sobre a nossa pergunta — não uma falha de transporte a repetir. A
      // leitura da presença é a mesma que a borda faz, e é o que o `D35` instalou.
      throw new Error(RECUSA_SEM_RESPOSTA);
    }

    const apurado = apurarDaLeitura(leitura, preparo.estado?.referenciaNoProvedor ?? null);

    if (apurado === undefined) {
      // ⚠️ **A reconferência NÃO EXECUTA ATO CORRETIVO**, e a ausência é a decisão. Cadastrar,
      // corrigir endereço ou reativar são atos de **configuração**, e o Admin é quem os dispara — a
      // rota de ativação existe para isso. Uma tarefa de fundo que os executasse sozinha mudaria a
      // conta do cliente sem ninguém ter pedido, e faria isso periodicamente.
      //
      // O que ela faz nesses casos é **não gravar**: o estado anterior permanece, e é o mesmo
      // conservador do provedor que não responde. A diferença é que aqui não se levanta — não há
      // falha a repetir, há apenas um estado que só um ato do Admin muda.
      logger.debug(
        {
          idTarefa: tarefa.id,
          fila: FILA_DA_RECONFERENCIA_DA_ENTREGA,
          empresaId,
          leitura: leitura.tipo,
        },
        'a reconferência da entrega encontrou um estado que só um ato do Admin resolve — nada a gravar',
      );

      return;
    }

    if (nadaMudou(preparo.estado, apurado)) {
      // Nenhum registro nasce, e o instante da linha **não avança** (RN-15, ADR-0034). O diário
      // registra em `debug` porque o fato é a ausência de fato: subir o degrau encheria o journal de
      // uma linha por reconferência de rotina.
      logger.debug(
        { idTarefa: tarefa.id, fila: FILA_DA_RECONFERENCIA_DA_ENTREGA, empresaId },
        'a reconferência da entrega confirmou o desfecho já guardado — nada a gravar',
      );

      return;
    }

    // A unidade 2, e só ela grava. `verificada_em` nasce do relógio do BANCO, dentro da mesma
    // instrução (ADR-0026), e a gravação **substitui** o desfecho anterior (RN-04).
    await banco.emUnidadeDeTrabalho(async (tx) => {
      await gravarDesfechoDaEntrega(tx, {
        situacao: apurado.situacao,
        motivo: apurado.motivo,
        referenciaNoProvedor: apurado.referenciaNoProvedor,
        // `null` porque **não há usuário à frente**: quem pediu foi o registro do certificado, e a
        // reconferência corre no processo de trabalho. A coluna admite o nulo exatamente para isto.
        verificadaPor: null,
      });
    });

    logger.info(
      {
        idTarefa: tarefa.id,
        fila: FILA_DA_RECONFERENCIA_DA_ENTREGA,
        empresaId,
        situacao: apurado.situacao,
        // O **código** da recusa, e nunca a mensagem nem o diagnóstico: o código é rótulo do
        // provedor, enquanto os outros dois carregam texto livre de terceiro.
        motivo: apurado.motivo?.codigo ?? null,
      },
      'reconferência da entrega da notícia gravada',
    );
  });
}

/**
 * O que a reconsulta apurou é **o mesmo** que já está guardado?
 *
 * A empresa **sem linha** nunca satisfaz este predicado, e a assimetria é conteúdo: `verificada_em`
 * nulo é *"nunca houve tentativa"*, distinto de uma tentativa que apurou o mesmo — ver o cabeçalho.
 *
 * ⚠️ **O `diagnostico` fica deliberadamente FORA da comparação**, e a razão é medida: ele é portador
 * sem esquema, e o que se grava é o que o teto anti-abuso de `gravarDesfechoDaEntrega` deixa passar
 * (`limitarDiagnostico`, **privado** de `@sysloc/db`). Compará-lo faria o **recebido** ser confrontado
 * com o **truncado**, e um provedor verboso produziria "mudou" em toda reconferência — regravando a
 * linha e avançando o instante justamente no caso em que a RN-15 mais importa. O par
 * `(codigo, mensagem)` é o que a `CHECK` de coerência amarra, e **nenhum ramo do produto lê dentro do
 * diagnóstico**, de modo que a informação que escapa da comparação não decide comportamento algum.
 */
// DÉBITO COM GATILHO — D37 · F5/T8 · registrado 2026-08-22
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: a comparação do desfecho não alcança o `diagnostico`. Uma recusa cujo código e mensagem
//        repetem, e cujo diagnóstico mudou, é lida como *"nada mudou"* e a linha guardada continua
//        exibindo o diagnóstico anterior.
// QUANDO FECHA: quando o teto anti-abuso (`limitarDiagnostico`, hoje privado de
//        `packages/db/src/entrega-da-noticia.ts`) virar símbolo publicado do pacote — aí o apurado
//        pode ser normalizado ANTES de comparar, e o eixo entra sem falso positivo —, ou quando o
//        primeiro ramo do produto passar a LER dentro do diagnóstico, momento em que a informação
//        deixa de ser só de exibição.
// POR QUE NÃO AGORA: `packages/db/src/entrega-da-noticia.ts` está fora da lista de arquivos da T8, e
//        comparar o recebido com o truncado faria um provedor verboso regravar a linha em toda
//        reconferência — quebrando a RN-15 justamente onde ela mais importa.
// ÍNDICE: docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md §2, D37
function nadaMudou(
  guardado: EstadoDaEntregaGravado | undefined,
  apurado: DesfechoApurado,
): boolean {
  if (guardado === undefined) {
    return false;
  }

  return (
    guardado.situacao === apurado.situacao &&
    (guardado.motivo?.codigo ?? null) === (apurado.motivo?.codigo ?? null) &&
    (guardado.motivo?.mensagem ?? null) === (apurado.motivo?.mensagem ?? null)
  );
}

/**
 * Traduz a leitura no desfecho a gravar — ou `undefined` quando **não há o que a reconferência faça**.
 *
 * ⚠️ **Só três das sete leituras produzem gravação**, e o recorte é deliberado: a reconferência
 * **observa**, e não configura. Ela promove *em validação → habilitada* quando o provedor conclui a
 * validação, e é essa promoção que fecha o ciclo assíncrono que a rota de ativação abre.
 *
 * As leituras que pedem **ato** — cadastro ausente, endereço divergente, cadastro inativado — saem
 * `undefined`: executá-las aqui mudaria a conta do cliente sem ninguém ter pedido, e periodicamente.
 * Elas são resolvidas quando o Admin ativa, que é o gesto em que ele pede exatamente isso.
 */
function apurarDaLeitura(
  leitura: LeituraDaEntrega,
  referenciaGuardada: string | null,
): DesfechoApurado | undefined {
  switch (leitura.tipo) {
    case 'ATIVA':
      return { situacao: 'HABILITADA', motivo: null, referenciaNoProvedor: referenciaGuardada };

    case 'EM_VALIDACAO':
      return { situacao: 'EM_VALIDACAO', motivo: null, referenciaNoProvedor: referenciaGuardada };

    // O provedor **respondeu e recusou** — a outra metade da linha 7. O caminho sem resposta já
    // levantou antes de chegar aqui; o que sobra é um fato dele, e ele se grava com a causa.
    case 'NAO_RESPONDEU':
      return leitura.motivo === null
        ? undefined
        : { situacao: 'DESABILITADA', motivo: leitura.motivo, referenciaNoProvedor: null };

    // ⚠️ **ESTE é o ramo que o `D1` existia para abrir.** O provedor inativou o cadastro — o exemplo
    // oficial mostra `"Erro ao enviar notificação"` como causa —, e antes desta correção a consulta
    // devolvia *"existe registro"* e o produto gravava **habilitada**: ele afirmava saúde
    // precisamente no cenário em que a entrega estava morta. Agora a reconferência **desabilita, com
    // a causa que o provedor deu**, e é assim que o Admin fica sabendo sem ninguém olhar.
    //
    // ⚠️ E ela **não reativa**: reativar é ato de configuração, e quem o dispara é o Admin pela rota
    // de ativação — que é exatamente o que ele fará ao ver a tela dizendo o que houve.
    case 'INATIVA':
      // ⚠️ **Sem causa, não se desabilita** — e a restrição não é burocracia da `CHECK`: uma
      // desabilitação sem explicação chega à tela do Admin como *"parou de funcionar e não sabemos
      // por quê"*, que é pior que o estado anterior preservado. O provedor que inativa sem dizer por
      // quê deixa o estado como estava, e a próxima reconferência olha de novo.
      return leitura.motivo === null
        ? undefined
        : {
            situacao: 'DESABILITADA',
            motivo: leitura.motivo,
            referenciaNoProvedor: leitura.referencia,
          };

    default:
      return undefined;
  }
}
