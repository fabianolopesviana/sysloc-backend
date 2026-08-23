/**
 * A **entrada da notícia bancária** — `POST /v1/notificacoes-bancarias`, a rota sem sessão pela qual
 * o provedor avisa. T6 da fatia `webhook-e-carne`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-02 | CT-967 | **Para os TRÊS casos da §4.1.1 e para a requisição SEM CORPO** — seis linhas
 * | CA-03 |        | de tabela, e nenhuma forma comum entre elas: o recebido é **persistido antes
 * |       |        | de qualquer interpretação**, e o desfecho do tratamento **não compõe a
 * |       |        | resposta**. `204` com corpo de comprimento **zero**, sem cabeçalho
 * |       |        | `Location`; a linha crua, lida **sem contexto de tenant**, traz `recebido`
 * |       |        | **idêntico** ao objeto enviado — campos desconhecidos inclusive, e `null`
 * |       |        | quando não houve corpo —, `desfecho = 'RECEBIDO'`, `tratado_em` nulo e
 * |       |        | `recebido_em` do relógio do **banco**, dentro da janela da requisição; e a
 * |       |        | carga enfileirada é **exatamente** `{ notificacaoId }`, uma chave e nenhuma a
 * |       |        | mais, com o `id` da linha que acabou de nascer. É a variação dos corpos que
 * |       |        | torna falsificável o invariante *"a borda não valida para aceitar ou
 * |       |        | recusar"*: um esquema capaz de aceitar as seis é a ausência de esquema.
 * |       |        | (ADR-0035 cláusulas 1 e 2, ADR-0026, ADR-0024 terceira emenda, RN-02) |
 * | CA-02 | CT-967 | **Companheiro negativo, e ele é o que discrimina "gravou ANTES" de "gravou
 * |       | (b)    | depois"**: com o produtor de fila falhando, a resposta continua `204`, o cru
 * |       |        | continua gravado em `RECEBIDO`, e o journal traz **uma** linha de `warn` com
 * |       |        | `notificacaoId` — e **nada do recebido** em campo nenhum dela. |
 * | CA-20 | CT-967 | Requisição **com sessão válida** produz resposta **idêntica** à sem sessão,
 * |       | (c)    | byte a byte, e grava do mesmo jeito: a rota é pública, e a presença de
 * |       |        | credencial não muda o comportamento dela. |
 * | CA-20 | CT-971 | A rota **nunca redireciona**: nem no caminho exato, nem no caminho com barra
 * |       |        | final — nenhuma das duas respostas é `3xx` e nenhuma emite `Location`. É o
 * |       |        | passo da barra final que barra o mutante em que o arcabouço normaliza o
 * |       |        | caminho por redirecionamento, e o provedor **reprova** `3xx`. |
 * | —     | CT-971 | Corpo que **não é JSON** é recusado pelo **transporte**, antes do manipulador:
 * |       | (b)    | a resposta não é `204`, o envelope canônico é o do produto, e a contagem crua
 * |       |        | de `plataforma.notificacao_bancaria` é **idêntica** antes e depois — nada foi
 * |       |        | gravado. É o único `4xx` desta rota, e ele não é do produto. |
 * | CA-03 | CT-968 | Três corpos **JSON válidos e semanticamente desconhecidos** — campo faltando,
 * |       |        | tipo trocado e objeto vazio — respondem `204`, são gravados **como vieram** e,
 * |       |        | tratados pela tarefa real, terminam **todos** `ILEGIVEL`, sem exceção e sem
 * |       |        | reentrega, com **zero** consultas ao provedor. O fracasso da interpretação é um
 * |       |        | **desfecho**, nunca um `4xx`, e o cru sobrevive íntegro. |
 * | CA-11 | CT-987 | O pedido de validação de endereço é respondido `204` e termina
 * | CA-20 |        | `VALIDACAO_DE_ENDERECO` **sem procurar cobrança alguma**: a linha crua fica com
 * |       |        | `identificador_perante_o_provedor` **nulo**, a consulta ao provedor não
 * |       |        | acontece, e a cobrança existente é **idêntica** antes e depois. A segunda perna
 * |       |        | é o que dá conteúdo a *"não procurou"*: o **mesmo** pedido acrescido dos campos
 * |       |        | de um aviso legítimo, cujo identificador **casa** com a cobrança semeada, cai
 * |       |        | igual — se o roteamento tivesse corrido, ele teria achado. |
 *
 * Rastreabilidade: `CA-02 → CT-967 (RN-02)`, `CA-03 → CT-967, CT-968 (RN-02)`,
 * `CA-20 → CT-967 (c), CT-987 (RN-20)`, `CA-11 → CT-987 (RN-10)`, `CA-20 → CT-971 (RN-20)`.
 *
 * ⚠️ **Os sufixos `(b)` e `(c)` não são estilo, e sim a única forma disponível**: a faixa
 * `CT-967`…`CT-1006` está inteiramente reservada pelos cards desta fatia, e reusar um identificador
 * produziria duas coisas diferentes com o mesmo nome. É a mesma escolha, e a mesma razão, de
 * `CT-918 (f)` em `cobertura-de-autorizacao.e2e.spec.ts` e de `CT-739 (b)` em
 * `produtor-de-fila.spec.ts`. **O CT-968 e o CT-987 são da T7** e não moram aqui.
 *
 * > **Emenda de 2026-08-19 (T7)** — o texto acima é preservado, e o que ele diz sobre o CT-968 e o
 * > CT-987 deixou de valer no instante em que a **tarefa** passou a existir: os dois dependem do
 * > **desfecho**, e é por isso que a T6 não podia hospedá-los. Eles moram aqui a partir da T7,
 * > exercitando a mesma rota e, adiante dela, a tarefa real.
 *
 * ===========================================================================
 * O QUE ESTA SUÍTE PODE PROVAR, E O QUE ELA DELIBERADAMENTE NÃO ALCANÇA
 * ===========================================================================
 *
 * A ADR-0035 cobra **sete** cláusulas de uma entrada de fato de terceiro. Só **três** são desta
 * camada — persistir o cru antes de interpretar, responder sem que o processamento componha a
 * resposta, e ser declarada `publicas` —, e são exatamente estas que os casos abaixo medem. As
 * outras quatro (rotear pela chave que o próprio produto emitiu, derivar a empresa do registro
 * encontrado, descartar o órfão sem consultar o terceiro, e ser idempotente pelo identificador do
 * fato) vivem no processo de trabalho e são medidas em `apps/worker/test/notificacao-bancaria.spec.ts`.
 * A terceira delas — `publicas`, `semDeclaracao` vazio — é medida pelo `CT-972`, sobre a aplicação
 * de produção montada, em `cobertura-de-autorizacao.e2e.spec.ts`.
 *
 * **Não há cobrança de arranjo, e a ausência é decisão declarada.** O card pede uma *"para que o
 * corpo seja plausível"*, e a plausibilidade é obtida pelos próprios payloads da §4.1.1,
 * reproduzidos literalmente em {@link AVISO_DO_PROVEDOR}, {@link PEDIDO_DE_VALIDACAO_DO_ENDERECO} e
 * nas três formas do Caso C — ver {@link RECEPCOES}. Criar contrato, imóvel, locatário e
 * cobrança para chegar a este `POST` seria arranjo que **nenhuma asserção consome** — a borda não
 * resolve nada, não lê o corpo e não conhece cobrança — e, pior, sugeriria ao próximo leitor que ela
 * olha para dentro do recebido, que é o oposto exato do invariante desta task. Quem exercita a
 * correspondência com cobrança real é a suíte da tarefa.
 *
 * ===========================================================================
 * POR QUE O PRODUTOR DE FILA ENTRA PELA PORTA, e não por servidor efêmero
 * ===========================================================================
 *
 * `TOKEN_PRODUTOR_DE_FILA` é substituído por {@link produtorInstrumentado}, pelo arcabouço de teste,
 * sobre o token que a composição já publica — o mesmo mecanismo, e a mesma casa
 * ({@link ./aplicacao-instrumentada.ts}), que as suítes do capturador de e-mail e do provedor
 * bancário usam. **Não é mock de fronteira real disfarçado**, e as duas razões são de prova:
 *
 *   1. o cenário *"servidor de fila indisponível na recepção"* exige que o enfileiramento **falhe**,
 *      e provocá-lo com servidor real significaria derrubar a instância no meio da suíte — o que
 *      mediria a reconexão do cliente, não a decisão da borda;
 *   2. a asserção que importa é sobre a **carga**: `{ notificacaoId }`, uma chave e nenhuma a mais,
 *      com o valor ligado à linha gravada. Ela é afirmada por igualdade de objeto sobre o argumento
 *      recebido, com a **contagem de chamadas** junto — nunca "foi chamado".
 *
 * O que o servidor de fila **real** prova — que a carga atravessa a biblioteca e chega íntegra à fila
 * nomeada — é o `CT-967 (d)` de `produtor-de-fila.spec.ts`, com instância efêmera própria. As duas
 * metades juntas cobrem a borda e o transporte, e nenhuma delas tenta cobrir a outra.
 *
 * O banco é **real e efêmero** (ADR-0006), e nenhuma coordenada de conexão vem do ambiente: o
 * ambiente do processo é MONTADO a partir do que os acessórios devolvem. `REDIS_URL` recebe um
 * endereço sintaticamente válido e **sem servidor por trás** de propósito — com o produtor
 * substituído, ninguém conecta, e subir um servidor que nenhuma asserção observa seria arranjo
 * enganoso.
 *
 * > **Emenda de 2026-08-19 (T7)** — o parágrafo acima é preservado, e a condição que o justificava
 * > mudou: com o CT-968 e o CT-987, **há** asserção que observa um servidor de fila, porque os dois
 * > exercitam a **tarefa real**. O que continua valendo, palavra por palavra, é o que a `REDIS_URL`
 * > do **processo da API** declara: ela segue apontando para lugar nenhum, e ninguém conecta a ela —
 * > o produtor da borda continua substituído, e é ele que o `CT-967 (b)` precisa poder fazer falhar.
 * > O servidor efêmero que nasce agora é o **do consumidor**, alcançado por `conectarFila` com a
 * > cadeia que o acessório devolve, exatamente como `apps/worker/src/main.ts` o faz. As duas metades
 * > não se tocam: a borda entrega a carga à porta instrumentada, e é o caso que a repassa à fila
 * > real — o que mantém observável, num arquivo só, tanto *"a borda compôs a carga"* quanto *"a
 * > tarefa chegou ao desfecho"*.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type {
  AdaptadorCobrancaBancaria,
  ConsultaDeSituacao,
  GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarBoletoDaCobranca,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerNotificacaoBancaria,
  type NotificacaoBancariaPersistida,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import {
  type CargaDaNotificacaoBancaria,
  CodigoErro,
  criarLogger,
  FILA_DA_NOTIFICACAO_BANCARIA,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
// A fiação do `worker` é alcançada pelo caminho do fonte, e não por especificador de pacote: ele é
// aplicação privada, sem `exports`. A razão de estar aqui é o que o cabeçalho declara — o CT-968 e o
// CT-987 dependem do DESFECHO, e o único caminho legítimo até ele passa pela tarefa que o processo de
// trabalho executa. Nada de `apps/api/src` importa daqui: a aresta existe só na verificação, e só
// nesta direção. É a mesma aresta, e a mesma razão, de `./confirmacao-de-email.e2e.spec.ts`, cujo
// registro vive só no relatório da fatia que a abriu:
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D13
import {
  conectarFila,
  type Fila,
  type TarefaDaNotificacaoBancaria,
} from '../../worker/src/fila.ts';
import { processarNotificacaoBancaria } from '../../worker/src/tarefas/notificacao-bancaria.ts';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../src/comum/produtor-de-fila.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_LOGGER,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DAS_NOTIFICACOES_BANCARIAS } from '../src/notificacoes-bancarias/notificacao-bancaria.controller.ts';
import { entrar, type OpcoesDoPedido, pedir, type Resposta } from './acessorios-de-borda.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';

/** Limite da montagem: banco migrado, semente com credencial e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco algumas vezes. */
const LIMITE_CASO_MS = 60_000;

/** Caminho, relativo à raiz, da rota **sem sessão** da notícia. Composto, nunca escrito à mão. */
const ROTA_DA_NOTICIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_NOTIFICACOES_BANCARIAS}`;

/**
 * Endereço do servidor de fila declarado ao processo — **sintaticamente válido, sem servidor**.
 *
 * A configuração é conferida na construção do módulo, e um valor malformado faria a aplicação nem
 * subir. Ninguém conecta a ele: o produtor é substituído pela porta instrumentada — ver o cabeçalho.
 */
const CADEIA_DE_FILA_SEM_SERVIDOR = 'redis://127.0.0.1:6379';

/**
 * O aviso do provedor, **copiado do Caso A da §4.1.1 do tech spec**, no vocabulário dele.
 *
 * Ele é escrito à mão e **não** derivado de esquema algum do produto: não existe esquema para este
 * corpo (§21.2), e derivá-lo de um faria a asserção de igualdade concordar consigo mesma. Os campos
 * que o produto não reconhece — e são quase todos, nesta camada — estão aqui **de propósito**: é a
 * preservação deles que o `CT-967` afirma.
 */
const AVISO_DO_PROVEDOR = {
  idWebhook: 990,
  tipoMovimento: 7,
  dados: {
    seuNumero: '202608000000000042',
    nossoNumero: 1234567,
    numeroCliente: 25546454,
    numeroIdentificadorBaixa: '1600100000000000001',
    codigoBarrasBoleto: '00190000090123456789012345678901234567890123456',
    codigoBarrasBaixa: '00190000090123456789012345678901234567890123456',
    valorBoleto: 1500.0,
    valorPagamento: 1500.0,
    dataHoraSituacaoBaixa: '2026-08-18T14:03:11Z',
    dataVencimento: '2026-08-20',
    cancelamentoBaixa: false,
    baixaRealizadaEmContigencia: false,
    codigoMotivoCancelamento: 2,
  },
} as const;

/**
 * O **Caso B da §4.1.1** — o pedido de validação do endereço, que o provedor envia ao cadastrar o
 * endereço, ao trocá-lo e ao reativá-lo.
 *
 * Ele não tem `tipoMovimento`, não tem `dados` e não fala de cobrança alguma: **nenhum** campo dele
 * coincide com o Caso A além de `idWebhook`. É a linha da tabela que **discrimina** um SUT opaco de
 * um SUT que valida — qualquer esquema capaz de aceitar o Caso A o recusaria com `422`, e a notícia
 * se perderia, que é a regressão que a RN-02 e a cláusula 1 da ADR-0035 proíbem.
 */
const PEDIDO_DE_VALIDACAO_DO_ENDERECO = { idWebhook: 990, validacaoWebhook: true } as const;

/**
 * O **Caso C da §4.1.1** em suas três formas — *"qualquer outra coisa que seja JSON"*.
 *
 * A spec nomeia as três, e elas **não** são a mesma prova: o objeto vazio reprova o esquema que
 * exija campo algum; o campo faltando reprova o que exija `dados`; e o tipo trocado reprova o que
 * confira **tipo** sem exigir campo novo — que é a forma de validação mais fácil de acrescentar sem
 * que ninguém note, porque ela deixa o Caso A passando.
 */
const CASO_C_OBJETO_VAZIO = {} as const;
const CASO_C_CAMPO_FALTANDO = { idWebhook: 990, tipoMovimento: 7 } as const;
const CASO_C_TIPO_TROCADO = {
  idWebhook: '990',
  tipoMovimento: 'sete',
  dados: ['não é um objeto'],
} as const;

/** O que a linha crua traz quando a requisição chega **sem corpo** — ver {@link RECEPCOES}. */
const RECEBIDO_DA_REQUISICAO_SEM_CORPO = null;

/** Uma linha da tabela do `CT-967`: o que se envia, e o que tem de estar gravado depois. */
interface RecepcaoSobTeste {
  /** O nome que entra no título do caso — é ele que nomeia a linha quando a asserção reprova. */
  readonly nome: string;
  /**
   * O que se envia, na forma que {@link pedir} consome.
   *
   * A requisição **sem corpo** é a ausência do campo `corpo`, e não um corpo vazio: é assim que ela
   * chega de fato, e é o que faz o manipulador receber `undefined` do adaptador.
   */
  readonly opcoes: OpcoesDoPedido;
  /** O `recebido` que a linha crua tem de trazer, por igualdade **profunda**. */
  readonly recebidoEsperado: unknown;
  /**
   * Valores do corpo que **não podem** aparecer no journal (§10.3).
   *
   * Por linha, e não fixo, porque asserção de ausência sobre valor que nunca entrou no sistema passa
   * por **vacuidade** — o AP-29. Só declara agulha a linha cujo corpo carrega cadeia própria; a
   * varredura com **controle positivo** (sentinela plantado e provado dentro do sistema) é o
   * `CT-967 (b)`.
   */
  readonly agulhasDoJournal: readonly string[];
}

/**
 * A tabela do `CT-967` — os **três casos da §4.1.1** mais a **requisição sem corpo**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE TABELA, e não o caso copiado uma vez por corpo
 * ---------------------------------------------------------------------------
 *
 * O que esta task existe para instalar não é *"o Caso A é gravado"* — é *"a borda **não** valida para
 * aceitar ou recusar; qualquer JSON é gravado"*. Uma propriedade sobre a **variação** do corpo só é
 * falsificável se a variação existir na prova: com um corpo só, um esquema de validação acrescentado
 * numa rodada futura que casasse a forma do Caso A deixaria a suíte inteira verde enquanto os Casos
 * B e C passassem a receber `422` e a notícia se perdesse.
 *
 * As linhas afirmam **o mesmo conjunto** de propriedades, e é isso que as torna dados em vez de
 * casos: copiar o caso por corpo seria o **AP-26** (`semantically_duplicated_test`) e deixaria as
 * cópias livres para divergir na primeira vez que uma asserção fosse endurecida.
 *
 * **O que cada linha discrimina**, e por que nenhuma é redundante com a outra:
 *
 *   * **Caso A** — a preservação do campo desconhecido, e a única com cadeia própria para a
 *     asserção de ausência no journal;
 *   * **Caso B** — o esquema que exigisse `tipoMovimento`/`dados`, isto é, a forma do Caso A;
 *   * **Caso C, objeto vazio** — o esquema que exigisse **qualquer** campo;
 *   * **Caso C, campo faltando** — o que exigisse `dados` sem exigir o resto;
 *   * **Caso C, tipo trocado** — o que conferisse **tipo** sem exigir campo novo, que é a validação
 *     mais fácil de acrescentar deixando o Caso A intacto;
 *   * **sem corpo** — o ramo `corpo ?? null` do controlador, que nenhuma das outras atravessa.
 *
 * As seis não compartilham forma alguma — não há campo presente em todas, nem tipo estável para os
 * que se repetem —, de modo que um esquema capaz de aceitar as seis é a **ausência** de esquema. É
 * esse o invariante.
 */
const RECEPCOES: readonly RecepcaoSobTeste[] = [
  {
    nome: 'Caso A — notícia de recebimento',
    opcoes: { metodo: 'POST', corpo: AVISO_DO_PROVEDOR },
    recebidoEsperado: AVISO_DO_PROVEDOR,
    agulhasDoJournal: [
      AVISO_DO_PROVEDOR.dados.numeroIdentificadorBaixa,
      AVISO_DO_PROVEDOR.dados.seuNumero,
    ],
  },
  {
    nome: 'Caso B — pedido de validação do endereço',
    opcoes: { metodo: 'POST', corpo: PEDIDO_DE_VALIDACAO_DO_ENDERECO },
    recebidoEsperado: PEDIDO_DE_VALIDACAO_DO_ENDERECO,
    agulhasDoJournal: [],
  },
  {
    nome: 'Caso C — objeto vazio',
    opcoes: { metodo: 'POST', corpo: CASO_C_OBJETO_VAZIO },
    recebidoEsperado: CASO_C_OBJETO_VAZIO,
    agulhasDoJournal: [],
  },
  {
    nome: 'Caso C — campo faltando',
    opcoes: { metodo: 'POST', corpo: CASO_C_CAMPO_FALTANDO },
    recebidoEsperado: CASO_C_CAMPO_FALTANDO,
    agulhasDoJournal: [],
  },
  {
    nome: 'Caso C — tipo trocado',
    opcoes: { metodo: 'POST', corpo: CASO_C_TIPO_TROCADO },
    recebidoEsperado: CASO_C_TIPO_TROCADO,
    agulhasDoJournal: [],
  },
  {
    // O ramo **explícito** do SUT: `corpo ?? null` no controlador. A requisição sem corpo entrega
    // `undefined` ao manipulador, e `undefined` não é valor JSON — a função de domínio o recusa por
    // construção (ela levanta). `null` é a forma JSON de dizer *"chegou nada"*, e é essa decisão que
    // esta linha fixa: sem ela, trocar `corpo ?? null` por `corpo` deixaria a suíte verde e faria a
    // rota levantar `500` diante de uma sonda sem corpo — que é o que `contexto.e2e.spec.ts` faz.
    nome: 'requisição sem corpo',
    opcoes: { metodo: 'POST' },
    recebidoEsperado: RECEBIDO_DA_REQUISICAO_SEM_CORPO,
    agulhasDoJournal: [],
  },
];

/**
 * O valor sentinela plantado no aviso do companheiro negativo.
 *
 * Improvável o bastante para que uma ocorrência dele numa linha do journal só possa ter vindo do
 * recebido: é isso que faz a asserção de ausência ser prova, e não coincidência. Ele viaja num campo
 * que o produto **não** conhece, que é a forma mais provável de o corpo inteiro escapar junto.
 */
const SENTINELA_DO_RECEBIDO = 'sentinela-do-pagador-4c7e1b9a';

/** O desfecho com que a linha nasce — o padrão da coluna, nunca escrito pela aplicação. */
const DESFECHO_AO_NASCER = 'RECEBIDO';

/**
 * O rótulo do nível de alerta, tal como o registrador do projeto o emite.
 *
 * `criarLogger` declara `level: (rotulo) => ({ nivel: rotulo })`, de modo que o evento carrega
 * `nivel: 'warn'` e **não** o `level: 40` do padrão da biblioteca. Escrito à mão de propósito: lê-lo
 * do SUT faria a asserção concordar consigo mesma.
 */
const NIVEL_DE_AVISO = 'warn';

/** A entidade que a linha de trilha desta superfície nomeia (§13.1 do tech spec). */
const ENTIDADE_DA_TRILHA = 'notificacao_bancaria';

/** Quem entra no `CT-967 (c)` — sessão válida qualquer, para provar que a rota não muda com ela. */
const QUEM_TEM_SESSAO = pessoaSemeada('admin.a@exemplo.com.br');

/** O tipo de conteúdo que faz o transporte tentar interpretar o corpo — e recusá-lo. */
const TIPO_DE_CONTEUDO_JSON = 'application/json';

/** Um corpo que **não é** JSON, entregue sob o tipo que anuncia que seria. */
const CORPO_QUE_NAO_E_JSON = '{ isto não fecha';

/**
 * Os **três** corpos do `CT-968` — JSON válido e **semanticamente desconhecido**.
 *
 * ⚠️ **Corpo sintaticamente inválido é do transporte**, e já tem caso próprio (`CT-971 (b)`): ele nem
 * chega ao manipulador, e portanto nunca vira desfecho. O que esta linha exercita é o que a fatia de
 * fato decide — o corpo que **chega**, é gravado e o produto não consegue interpretar.
 *
 * As três formas não são a mesma prova, e a razão é a mesma de {@link RECEPCOES}: o campo faltando
 * reprova o leitor que exija `dados`; o tipo trocado reprova o que confira **tipo** sem exigir campo
 * novo; e o objeto vazio reprova o que exija **qualquer** campo.
 */
const CORPOS_ININTERPRETAVEIS: readonly Record<string, unknown>[] = [
  CASO_C_CAMPO_FALTANDO,
  CASO_C_TIPO_TROCADO,
  CASO_C_OBJETO_VAZIO,
];

/** O valor da cobrança que o `CT-987` semeia — nada aqui participa do que está sob prova. */
const VALOR_DA_COBRANCA_SEMEADA = 1000;

/** Quantos dias à frente a cobrança semeada vence — folga que mantém a mora em zero. */
const DIAS_ATE_O_VENCIMENTO = 30;

/** Os termos do contrato de apoio da cobrança semeada. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA_SEMEADA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

/** Limite para a tarefa alcançar estado terminal, folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** A chave de cifra que a composição do consumidor recebe — sorteada, e nunca literal. */
const CHAVE_DE_CIFRA_DO_CONSUMIDOR = randomBytes(32);

let identidade: IdentidadeEfemera;
let instanciaDaFila: FilaEfemera;
let filaDoWorker: Fila;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let linhasDoJournal: string[];

/** As cargas que a borda entregou ao produtor, na ordem — o que o `CT-967` afirma por igualdade. */
let cargasEnfileiradas: CargaDaNotificacaoBancaria[];

/**
 * Quando definida, o enfileiramento **rejeita** com ela — é o gatilho do companheiro negativo.
 *
 * Ela é variável de suíte, e não parâmetro, porque quem dispara o enfileiramento é a **borda**, do
 * outro lado de uma requisição HTTP: não há por onde passar a instrução, e forjá-la por dentro seria
 * o *seam* que a `.claude/rules/testing-stack.md` proíbe.
 */
let falhaDoEnfileiramento: Error | undefined;

/**
 * A porta de fila instrumentada — **conta e registra**, e falha quando mandado.
 *
 * Ela implementa a interface inteira de `ProdutorDeFila`, e não só o método sob observação: um
 * objeto parcial passaria pelo injetor e falharia no desligamento, longe da causa.
 */
const produtorInstrumentado: ProdutorDeFila = {
  async enfileirarConfirmacao(): Promise<void> {
    throw new Error('a suíte da notícia bancária não enfileira confirmação');
  },
  async enfileirarEmissaoEmLote(): Promise<void> {
    throw new Error('a suíte da notícia bancária não enfileira emissão em lote');
  },
  async enfileirarConferenciaBancaria(): Promise<void> {
    throw new Error('a suíte da notícia bancária não enfileira conferência bancária');
  },
  async enfileirarReconferenciaDaEntrega(): Promise<void> {
    throw new Error('a suíte da notícia bancária não enfileira reconferência da entrega');
  },
  async enfileirarNotificacaoBancaria(carga: CargaDaNotificacaoBancaria): Promise<void> {
    // A carga é registrada ANTES da eventual falha: é ela que prova que a borda chegou a compor o
    // pedido de enfileiramento, e não que desistiu antes.
    cargasEnfileiradas.push(carga);

    if (falhaDoEnfileiramento !== undefined) {
      throw falhaDoEnfileiramento;
    }
  },
  async encerrar(): Promise<void> {
    // Nada a devolver: não há conexão. O método existe porque `FilaModule` o chama no desligamento.
  },
};

/**
 * Toda consulta que chegou ao provedor, na ordem — **zero** é o que o CT-968 e o CT-987 afirmam.
 *
 * A contagem é efeito observável do SUT, e não valor que o caso plantou: nenhum caso deste arquivo
 * exercita um caminho que **deva** consultar, e é por isso que a asserção de zero vive aqui junto do
 * ponteiro para quem prova o positivo — `apps/worker/test/notificacao-bancaria.spec.ts`, cujo
 * `CT-979` e `CT-1006` medem a mesma porta sendo chamada **uma** vez quando ela deve ser.
 */
const consultasAoProvedor: ConsultaDeSituacao[] = [];

/**
 * A porta do provedor entregue ao consumidor — implementação de verificação, nunca mock de HTTP
 * (ADR-0025).
 *
 * Ela **levanta** em toda operação: nenhum caminho exercitado por este arquivo pode alcançá-la, e
 * responder algo plausível esconderia atrás de um desfecho benigno exatamente o defeito que a
 * contagem em zero existe para pegar.
 */
const provedorQueNinguemDeveAlcancar: AdaptadorCobrancaBancaria = {
  consultarSituacao: async (consulta) => {
    consultasAoProvedor.push(consulta);

    throw new Error('nenhum caso desta suíte pode alcançar a consulta ao provedor');
  },
  emitir: () => {
    throw new Error('nenhum caso desta suíte emite boleto');
  },
  solicitarRevogacaoDeBoleto: () => {
    throw new Error('nenhum caso desta suíte revoga boleto');
  },
  confirmarRevogacaoDeBoleto: () => {
    throw new Error('nenhum caso desta suíte confirma revogação');
  },
};

/** A guarda de bytes entregue ao consumidor — apontada para um diretório efêmero e nunca tocada. */
const guardaDoConsumidor: GuardaDeBoletos = {
  gravar: () => {
    throw new Error('nenhum caso desta suíte grava bytes de boleto');
  },
  apagar: () => {
    throw new Error('nenhum caso desta suíte apaga bytes de boleto');
  },
  ler: () => {
    throw new Error('nenhum caso desta suíte lê bytes de boleto');
  },
  expurgarBoletosVencidos: () => {
    throw new Error('nenhum caso desta suíte expurga o acervo de boletos');
  },
};

beforeAll(async () => {
  identidade = await identidadeEfemera();
  instanciaDaFila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = CADEIA_DE_FILA_SEM_SERVIDOR;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  linhasDoJournal = [];
  cargasEnfileiradas = [];

  // `trace` é o nível mais baixo do vocabulário do projeto: nenhuma linha é filtrada, e a asserção
  // de ausência do recebido alcança o registro INTEIRO, não só o que passaria por `warn`.
  const registrador = criarLogger({
    nivel: 'trace',
    destino: {
      write(linha: string): void {
        linhasDoJournal.push(linha);
      },
    },
  });

  aplicacao = await montarAplicacaoInstrumentada(porta, [
    { token: TOKEN_LOGGER, valor: registrador },
    { token: TOKEN_PRODUTOR_DE_FILA, valor: produtorInstrumentado },
  ]);

  // A MESMA fiação de `apps/worker/src/main.ts`: `conectarFila` mais
  // `processar(fila.notificacaoBancaria, …)`, com a borda recebendo as portas por parâmetro. É essa
  // indistinção que faz o CT-968 e o CT-987 exercitarem o caminho de produção inteiro.
  filaDoWorker = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  filaDoWorker.processar(
    filaDoWorker.notificacaoBancaria,
    async (tarefa, logger) =>
      await processarNotificacaoBancaria(tarefa, logger, {
        banco: acessoAoNegocio,
        adaptador: provedorQueNinguemDeveAlcancar,
        guarda: guardaDoConsumidor,
        chaveDeCifra: CHAVE_DE_CIFRA_DO_CONSUMIDOR,
      }),
  );
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await filaDoWorker?.encerrar();
  await acessoAoNegocio?.encerrar();
  await instanciaDaFila?.parar();
  await identidade?.parar();

  for (const nome of Object.keys(process.env)) {
    if (!(nome in (ambienteAnterior ?? {}))) {
      delete process.env[nome];
    }
  }
  for (const [nome, valor] of Object.entries(ambienteAnterior ?? {})) {
    if (valor !== undefined) {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

/** Quantas linhas cruas existem hoje — a contagem que separa "respondeu" de "respondeu e gravou". */
async function notificacoesGravadas(): Promise<number> {
  return await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total FROM plataforma.notificacao_bancaria
    `;

    return Number.parseInt(linha?.total ?? '-1', 10);
  });
}

/**
 * Lê a linha crua pelo `id`, **sem contexto de tenant** — pelo caminho de produção.
 *
 * A unidade de trabalho não fixa `app.empresa_id`, e a leitura sucede assim mesmo: é a propriedade
 * da ADR-0031 que esta função exercita de passagem, e a razão de a suíte não precisar de empresa
 * alguma para observar o que a borda gravou.
 */
async function crua(notificacaoId: string): Promise<NotificacaoBancariaPersistida> {
  const linha = await acessoAoNegocio.emUnidadeDeTrabalho(
    async (tx) => await lerNotificacaoBancaria(tx, notificacaoId),
  );

  // O `throw` é o que estreita o `| undefined` da leitura: daqui para baixo o tipo é o publicado
  // pelo módulo de dados, sem conversão nenhuma. Tipar o retorno como `Record<string, unknown>`
  // exigiria `as unknown as`, que é a forma mais larga possível de conversão — e faria o caso deixar
  // de reprovar estaticamente o dia em que um campo da interface mudasse de nome ou de tipo.
  if (linha === undefined) {
    throw new Error(`a notificação ${notificacaoId} não foi encontrada no banco`);
  }

  return linha;
}

/** A resposta é da família `3xx`? É o que o provedor reprova, e o que o `CT-971` afirma ser falso. */
function ehRedirecionamento(resposta: Resposta): boolean {
  return resposta.status >= 300 && resposta.status < 400;
}

/** O par que o `CT-971` afirma sobre cada resposta: nem `3xx`, nem `Location`. */
function retratoDoRedirecionamento(resposta: Resposta): Record<string, unknown> {
  return {
    ehRedirecionamento: ehRedirecionamento(resposta),
    location: resposta.cabecalhos.get('location'),
  };
}

describe('a entrada da notícia bancária (T6)', () => {
  it.each(RECEPCOES)(
    'CT-967 — a borda grava o recebido e confirma de imediato, sem interpretar: $nome',
    async (recepcao) => {
      const antes = await notificacoesGravadas();
      const cargasAntes = cargasEnfileiradas.length;

      // A janela do relógio, capturada NO PROCESSO em torno da requisição — é contra ela que
      // `recebidoEm` é conferido lá embaixo.
      const antesDoEnvio = Date.now();
      const resposta = await pedir(base, ROTA_DA_NOTICIA, recepcao.opcoes);
      const depoisDaResposta = Date.now();

      // ---------------------------------------------------------------------------------------
      // A RESPOSTA: `204`, corpo de comprimento ZERO, e nenhum `Location`
      // ---------------------------------------------------------------------------------------
      //
      // O comprimento é afirmado em valor exato, e **não** por "falsy": um corpo `"null"` ou `"{}"`
      // seria falsy em nenhuma das duas leituras, mas seria corpo — e a cláusula 2 da ADR-0035 é
      // sobre não existir lugar em que o desfecho pudesse viajar, não sobre ele estar vazio hoje.
      //
      // As três valem para TODA linha da tabela: é a igualdade entre as respostas de corpos que não
      // compartilham forma alguma que prova que a borda não olhou para dentro de nenhum deles.
      expect(resposta.status).toBe(204);
      expect(resposta.texto.length).toBe(0);
      expect(resposta.cabecalhos.get('location')).toBeNull();

      // ---------------------------------------------------------------------------------------
      // A GRAVAÇÃO: exatamente uma linha nova, e ela é a que a borda acabou de criar
      // ---------------------------------------------------------------------------------------
      expect(await notificacoesGravadas()).toBe(antes + 1);

      // A carga entregue ao produtor, por igualdade de OBJETO e com a CONTAGEM junto: `toEqual`
      // sobre o objeto inteiro é o que reprova um `empresaId` acrescentado à carga — que seria a
      // violação literal da ADR-0024 (terceira emenda) e da ADR-0035.
      expect(cargasEnfileiradas.length).toBe(cargasAntes + 1);

      const carga = cargasEnfileiradas.at(-1);
      expect(carga).toEqual({ notificacaoId: expect.any(String) });
      // E a chave é UMA: `toEqual` já reprova a chave a mais, e esta linha nomeia quais são quando
      // ela reprovar — é o *onde* que separa descuido de decisão desfeita.
      expect(Object.keys(carga ?? {})).toEqual(['notificacaoId']);

      const notificacaoId = (carga as CargaDaNotificacaoBancaria).notificacaoId;
      const linha = await crua(notificacaoId);

      // ---------------------------------------------------------------------------------------
      // O RECEBIDO É IDÊNTICO AO ENVIADO — campos desconhecidos inclusive
      // ---------------------------------------------------------------------------------------
      //
      // Igualdade PROFUNDA contra o objeto enviado, e não contra uma projeção dele: é ela que
      // reprova a normalização, o descarte de campo desconhecido e o corpo duplamente codificado
      // (que voltaria como cadeia de caracteres, nomeando a diferença). Na linha sem corpo o
      // esperado é `null`, e é ela que fixa a decisão do `corpo ?? null` do controlador.
      expect(linha.recebido).toEqual(recepcao.recebidoEsperado);

      // E o estado com que a linha nasce, por igualdade de objeto sobre os cinco campos que a
      // bicondicional do banco amarra — o mesmo para todos os corpos, porque a borda não interpreta
      // nenhum deles: quem carimba desfecho é a tarefa, do outro lado da fila.
      expect({
        desfecho: linha.desfecho,
        tratadoEm: linha.tratadoEm,
        identificadorPeranteOProvedor: linha.identificadorPeranteOProvedor,
        identificadorDaLiquidacao: linha.identificadorDaLiquidacao,
        diagnostico: linha.diagnostico,
      }).toEqual({
        desfecho: DESFECHO_AO_NASCER,
        tratadoEm: null,
        identificadorPeranteOProvedor: null,
        identificadorDaLiquidacao: null,
        diagnostico: null,
      });

      // `recebidoEm` é conferido pelo TIPO **e pela ordem** contra a janela da requisição. Fixá-lo em
      // valor exigiria falsear um relógio que esta suíte não controla — ele vem do relógio do
      // **banco** (ADR-0026) —, mas a janela discrimina o que o tipo sozinho não discrimina: valor
      // constante, época zero, e a data lida de dentro do próprio recebido (o Caso A traz
      // `dataHoraSituacaoBaixa`, de 2026-08-18, que reprova no piso).
      expect(linha.recebidoEm).toBeInstanceOf(Date);
      const recebidoEm = linha.recebidoEm instanceof Date ? linha.recebidoEm.getTime() : Number.NaN;
      expect(
        {
          naoPrecedeOEnvio: recebidoEm >= antesDoEnvio,
          naoSucedeAResposta: recebidoEm <= depoisDaResposta,
        },
        `recebidoEm=${String(linha.recebidoEm)} fora da janela [${String(new Date(antesDoEnvio))}, ${String(new Date(depoisDaResposta))}]`,
      ).toEqual({ naoPrecedeOEnvio: true, naoSucedeAResposta: true });

      // ---------------------------------------------------------------------------------------
      // NADA DO RECEBIDO NO JOURNAL (§10.3) — sobre o registro INTEIRO, não sobre uma linha
      // ---------------------------------------------------------------------------------------
      //
      // O recorte é o registro todo desde o início da suíte: restringir a asserção à linha da rota
      // deixaria de fora justamente o caminho por onde um vazamento chegaria sem ninguém escrevê-lo
      // — um `catch` acima, o filtro global, o interceptador de contexto.
      const journal = linhasDoJournal.join('\n');
      for (const agulha of recepcao.agulhasDoJournal) {
        expect(journal).not.toContain(agulha);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-967 (b) — com a fila indisponível a resposta continua 204, o cru sobrevive e o warn não leva o recebido',
    async () => {
      const antes = await notificacoesGravadas();
      const linhasAntes = linhasDoJournal.length;
      const cargasAntes = cargasEnfileiradas.length;

      // O aviso leva o sentinela num campo que o produto **não** conhece: é a forma mais provável de
      // o corpo inteiro escapar junto, e é justamente ela que a asserção de ausência persegue.
      const aviso = {
        ...AVISO_DO_PROVEDOR,
        dados: { ...AVISO_DO_PROVEDOR.dados, nomeDoPagador: SENTINELA_DO_RECEBIDO },
      };

      falhaDoEnfileiramento = new Error('o servidor de fila não aceitou a tarefa');

      let resposta: Resposta;
      try {
        resposta = await pedir(base, ROTA_DA_NOTICIA, { metodo: 'POST', corpo: aviso });
      } finally {
        // Restauro incondicional: um caso que falhasse no meio deixaria a suíte inteira com a fila
        // quebrada, e a falha apareceria nos casos seguintes em vez de aqui.
        falhaDoEnfileiramento = undefined;
      }

      // A RESPOSTA NÃO MUDA — é o que impede o `5xx` de provocar a reentrega que a idempotência
      // existe para absorver (§5.2 (b) do tech spec).
      expect(resposta.status).toBe(204);
      expect(resposta.texto.length).toBe(0);

      // O CRU SOBREVIVEU, e é isto que discrimina "gravou ANTES de enfileirar" de "gravou depois":
      // com a ordem invertida, o enfileiramento teria falhado antes de haver linha, e a contagem
      // ficaria igual.
      expect(await notificacoesGravadas()).toBe(antes + 1);
      expect(cargasEnfileiradas.length).toBe(cargasAntes + 1);

      const notificacaoId = (cargasEnfileiradas.at(-1) as CargaDaNotificacaoBancaria).notificacaoId;
      const linha = await crua(notificacaoId);
      expect(linha.desfecho).toBe(DESFECHO_AO_NASCER);
      expect(linha.recebido).toEqual(aviso);

      // ---------------------------------------------------------------------------------------
      // O JOURNAL: exatamente UMA linha de `warn`, com o `notificacaoId` e SEM o recebido
      // ---------------------------------------------------------------------------------------
      const emitidas = linhasDoJournal
        .slice(linhasAntes)
        .map((linha) => JSON.parse(linha) as Record<string, unknown>);

      // Âncora antivácuo: sem linha alguma, as asserções de ausência abaixo passariam por vacuidade
      // — que é o AP-29 que a `testing-stack.md` nomeia.
      expect(
        emitidas.length,
        'a recepção com a fila indisponível não produziu linha de journal alguma',
      ).toBeGreaterThan(0);

      // O nível sai como **rótulo legível** (`nivel: 'warn'`), e não como número: é o formatador
      // declarado em `criarLogger`, e ler `level` aqui daria conjunto vazio sempre — passando por
      // vacuidade nas asserções de ausência abaixo se elas fossem as únicas.
      const avisos = emitidas.filter((evento) => evento.nivel === NIVEL_DE_AVISO);
      expect(avisos.length).toBe(1);
      expect({
        notificacaoId: avisos[0]?.notificacaoId,
        entidade: avisos[0]?.entidade,
        mensagem: avisos[0]?.mensagem,
      }).toEqual({
        notificacaoId,
        entidade: ENTIDADE_DA_TRILHA,
        mensagem: 'a notícia bancária foi gravada e não pôde ser enfileirada',
      });

      // E **nada do recebido** em campo nenhum de linha nenhuma — sobre o texto serializado, e não
      // sobre um campo escolhido: o vazamento chegaria por onde ninguém olhou.
      for (const evento of emitidas) {
        expect(JSON.stringify(evento)).not.toContain(SENTINELA_DO_RECEBIDO);
        expect(JSON.stringify(evento)).not.toContain(AVISO_DO_PROVEDOR.dados.seuNumero);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-967 (c) — a rota pública não muda de comportamento quando a requisição traz sessão',
    async () => {
      const antes = await notificacoesGravadas();
      const cookie = await entrar(base, QUEM_TEM_SESSAO.email, SENHA_DA_CARGA);

      const semSessao = await pedir(base, ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpo: AVISO_DO_PROVEDOR,
      });
      const comSessao = await pedir(base, ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpo: AVISO_DO_PROVEDOR,
        cookie,
      });

      // As duas respostas, lado a lado numa comparação só: a falha nomeia qual metade divergiu.
      expect({ status: comSessao.status, texto: comSessao.texto }).toEqual({
        status: semSessao.status,
        texto: semSessao.texto,
      });
      expect(comSessao.status).toBe(204);

      // E as duas gravaram: uma rota que "reconhecesse" a sessão e mudasse de caminho apareceria
      // aqui como delta diferente de dois.
      expect(await notificacoesGravadas()).toBe(antes + 2);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-971 — a rota nunca redireciona, nem no caminho exato nem no caminho com barra final',
    async () => {
      const exato = await pedir(base, ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpo: AVISO_DO_PROVEDOR,
      });
      const comBarra = await pedir(base, `${ROTA_DA_NOTICIA}/`, {
        metodo: 'POST',
        corpo: AVISO_DO_PROVEDOR,
      });

      // O caminho exato atende — é a âncora antivácuo do caso: sem ela, uma rota que não existisse
      // satisfaria as duas asserções de "não é 3xx" por não ser nada.
      expect(exato.status).toBe(204);

      // ---------------------------------------------------------------------------------------
      // O PASSO QUE BARRA O MUTANTE: a barra final NÃO vira redirecionamento
      // ---------------------------------------------------------------------------------------
      //
      // O provedor reprova `3xx` — ele não segue, e a notícia se perderia. O arcabouço tem uma opção
      // de normalizar a barra final, e ela é o caminho pelo qual um `301`/`308` nasceria sem ninguém
      // escrevê-lo neste repositório.
      //
      // ⚠️ **O status exato da resposta com barra final NÃO é afirmado, e a ausência é decisão**: o
      // invariante do provedor é sobre a **família** `3xx`, e prendê-lo a um valor faria o caso
      // reprovar no dia em que o arcabouço passasse a responder `405` no lugar de `404` — que é
      // mudança irrelevante para o que este caso existe para provar. O que se afirma é o par que
      // discrimina, sobre as DUAS respostas.
      expect(
        { exato: retratoDoRedirecionamento(exato), comBarra: retratoDoRedirecionamento(comBarra) },
        `a rota da notícia redirecionou: exato=${String(exato.status)} comBarra=${String(comBarra.status)}`,
      ).toEqual({
        exato: { ehRedirecionamento: false, location: null },
        comBarra: { ehRedirecionamento: false, location: null },
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-971 (b) — corpo que não é JSON é recusado pelo transporte, e nada é gravado',
    async () => {
      const antes = await notificacoesGravadas();
      const cargasAntes = cargasEnfileiradas.length;

      const recusa = await pedir(base, ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpoBruto: { texto: CORPO_QUE_NAO_E_JSON, tipoDeConteudo: TIPO_DE_CONTEUDO_JSON },
      });

      // A recusa é do TRANSPORTE, antes do manipulador — e é o único `4xx` desta rota. O valor é
      // **medido**, e coincide com o `422` que a §4.1 do tech spec declara: o adaptador recusa o
      // corpo ilegível e o filtro global o traduz no envelope canônico do produto.
      expect(recusa.status).toBe(422);
      expect((recusa.corpo as { codigo?: unknown } | undefined)?.codigo).toBe(
        CodigoErro.CAMPO_INVALIDO,
      );

      // A CONTAGEM CRUA antes e depois é o que separa "respondeu 4xx" de "respondeu 4xx e não
      // gravou": a cláusula 1 da ADR-0035 manda gravar **o que chega**, e o que não chegou a ser
      // corpo não chegou a ser fato.
      expect(await notificacoesGravadas()).toBe(antes);
      expect(cargasEnfileiradas.length).toBe(cargasAntes);
    },
    LIMITE_CASO_MS,
  );

  // =========================================================================================
  // CT-968 — o que o produto não entende vira DESFECHO, e nunca 4xx
  // =========================================================================================

  it(
    'CT-968 — os três corpos ininterpretáveis são guardados como vieram e terminam ILEGIVEL',
    async () => {
      const consultasAntes = consultasAoProvedor.length;
      const gravados: { readonly enviado: unknown; readonly notificacaoId: string }[] = [];

      for (const corpo of CORPOS_ININTERPRETAVEIS) {
        const resposta = await pedir(base, ROTA_DA_NOTICIA, { metodo: 'POST', corpo });

        // A recusa da INTERPRETAÇÃO não é recusa da requisição: a borda nem chegou a olhar.
        expect(resposta.status).toBe(204);
        expect(resposta.texto.length).toBe(0);

        const carga = cargasEnfileiradas.at(-1) as CargaDaNotificacaoBancaria;
        gravados.push({ enviado: corpo, notificacaoId: carga.notificacaoId });

        // O cru é IDÊNTICO ao enviado, por igualdade profunda — inclusive o que ninguém interpreta.
        expect((await crua(carga.notificacaoId)).recebido).toEqual(corpo);
      }

      // A tarefa REAL trata cada um, pela fila real.
      const desfechos: string[] = [];
      for (const { notificacaoId } of gravados) {
        const tarefa = await tratar(notificacaoId);

        // Sem exceção e **sem reentrega**: a tarefa conclui. Uma que falhasse aqui reentregaria para
        // sempre sobre um corpo cuja forma nunca vai mudar.
        expect(await tarefa.getState()).toBe('completed');
        desfechos.push((await crua(notificacaoId)).desfecho);
      }

      expect(desfechos).toEqual(['ILEGIVEL', 'ILEGIVEL', 'ILEGIVEL']);

      // E **zero** consultas ao provedor: o que não se interpreta não vira pergunta ao terceiro.
      expect(consultasAoProvedor.length).toBe(consultasAntes);
    },
    LIMITE_CASO_MS,
  );

  // =========================================================================================
  // CT-987 — o pedido de validação de endereço é respondido e NÃO roteia
  // =========================================================================================

  it(
    'CT-987 — a validação de endereço termina VALIDACAO_DE_ENDERECO sem procurar cobrança alguma',
    async () => {
      // A precondição que dá CONTEÚDO a "não procurou": existe cobrança real, com boleto vivo e
      // identificador conhecido. Sem ela, "não achou nada" seria vacuidade — não haveria o que achar.
      const cobranca = await semearCobrancaComBoleto();
      const antes = await retratoDaCobranca(cobranca.identificador);

      expect(antes).toBeDefined();

      const consultasAntes = consultasAoProvedor.length;

      // ---------------------------------------------------------------------------------------
      // Perna 1 — o pedido tal como o provedor o envia (Caso B da §4.1.1)
      // ---------------------------------------------------------------------------------------
      const simples = await pedir(base, ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpo: PEDIDO_DE_VALIDACAO_DO_ENDERECO,
      });

      expect(simples.status).toBe(204);
      expect(simples.texto.length).toBe(0);

      const daPerna1 = (cargasEnfileiradas.at(-1) as CargaDaNotificacaoBancaria).notificacaoId;
      expect(await (await tratar(daPerna1)).getState()).toBe('completed');

      const cru1 = await crua(daPerna1);
      expect(cru1.desfecho).toBe('VALIDACAO_DE_ENDERECO');
      // A linha crua não guarda identificador algum — nada foi extraído, e portanto nada foi
      // procurado. É o rastro que o roteamento deixaria se tivesse corrido.
      expect(cru1.identificadorPeranteOProvedor).toBeNull();

      // ---------------------------------------------------------------------------------------
      // Perna 2 — a que torna "não roteou" uma afirmação COM CONTEÚDO
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ Aqui está o discriminador do caso. O mesmo pedido de validação, **acrescido dos campos de
      // um aviso legítimo** cujo identificador **casa** com a cobrança semeada: se o roteamento
      // tivesse corrido, ele teria encontrado a cobrança, e a consulta ao provedor — que levanta —
      // faria a tarefa terminar `failed`. Sem esta perna, a perna 1 seria compatível com um produto
      // que rotea sempre e não acha nada, porque o corpo dela não carrega chave alguma.
      const armadilha = {
        ...PEDIDO_DE_VALIDACAO_DO_ENDERECO,
        tipoMovimento: 7,
        dados: {
          seuNumero: cobranca.identificador,
          nossoNumero: cobranca.numeroDoTitulo,
          numeroIdentificadorBaixa: '1600100000000000042',
        },
      };
      const comChave = await pedir(base, ROTA_DA_NOTICIA, { metodo: 'POST', corpo: armadilha });

      expect(comChave.status).toBe(204);

      const daPerna2 = (cargasEnfileiradas.at(-1) as CargaDaNotificacaoBancaria).notificacaoId;
      const tarefa2 = await tratar(daPerna2);

      expect(await tarefa2.getState()).toBe('completed');

      const cru2 = await crua(daPerna2);
      expect(cru2.desfecho).toBe('VALIDACAO_DE_ENDERECO');
      expect(cru2.identificadorPeranteOProvedor).toBeNull();

      // ---------------------------------------------------------------------------------------
      // E o que NÃO aconteceu, nas duas pernas
      // ---------------------------------------------------------------------------------------
      //
      // Zero consultas ao provedor, e a cobrança **idêntica** antes e depois, por igualdade profunda
      // da linha inteira: `to_jsonb` alcança toda coluna, inclusive as que ninguém pensou em nomear.
      expect(consultasAoProvedor.length).toBe(consultasAntes);
      expect(await retratoDaCobranca(cobranca.identificador)).toEqual(antes);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios da tarefa — a fila real, e a cobrança que dá conteúdo ao "não procurou"
// ---------------------------------------------------------------------------------------------

/**
 * Enfileira a notícia na fila **real** e espera a tarefa alcançar estado terminal, por sondagem.
 *
 * O enfileiramento é do CASO, e não da borda: o produtor da borda está substituído de propósito (ver
 * o cabeçalho), e é ele que o `CT-967 (b)` precisa poder fazer falhar. O que atravessa daqui para
 * frente é a **mesma** carga que a borda compôs — o `notificacaoId` sai de `cargasEnfileiradas`.
 */
async function tratar(notificacaoId: string): Promise<TarefaDaNotificacaoBancaria> {
  const enfileirada = await filaDoWorker.notificacaoBancaria.add(FILA_DA_NOTIFICACAO_BANCARIA, {
    notificacaoId,
  });
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await filaDoWorker.notificacaoBancaria.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await filaDoWorker.notificacaoBancaria.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/** O que o `CT-987` precisa saber da cobrança semeada. */
interface CobrancaSemeada {
  readonly identificador: string;
  readonly numeroDoTitulo: string;
}

/** O contador que mantém todo identificador do arranjo distinto. */
let sequenciaDoArranjo = 0;

function proximoDoArranjo(): number {
  sequenciaDoArranjo += 1;

  return sequenciaDoArranjo;
}

/**
 * Executa o trabalho sob o contexto da empresa A, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança `negocio`. Ele monta e lê estado;
 * **nunca** o contexto da tarefa, que nasce lá dentro, do registro que o roteamento resolveria.
 */
async function emUnidadeDeA<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * A linha **inteira** da cobrança, chaveada pelo identificador — a fotografia do `CT-987`.
 *
 * A chave é o `identificador_no_provedor`, e não o código: o código é único **por empresa**
 * (ADR-0033), e o identificador é único no SaaS inteiro, que é justamente por que ele é a chave de
 * roteamento. `to_jsonb` alcança **toda** coluna, inclusive as que ninguém pensou em nomear.
 */
async function retratoDaCobranca(
  identificador: string,
): Promise<Record<string, unknown> | undefined> {
  return await emUnidadeDeA(async (tx) => {
    const [linha] = await tx<{ retrato: Record<string, unknown> }[]>`
      SELECT to_jsonb(c) AS retrato
        FROM negocio.cobranca c
       WHERE identificador_no_provedor = ${identificador}
    `;

    return linha?.retrato;
  });
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumentoDoArranjo = 80_000_000_000;

function pessoaDoArranjo(nome: string): DadosDaPessoa {
  proximoDocumentoDoArranjo += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumentoDoArranjo),
    rg: null,
    email: `${nome.toLowerCase().replaceAll(' ', '-')}@exemplo.invalid`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Semeia **uma** cobrança com boleto vivo na empresa A, pelas portas de produção de `@sysloc/db`.
 *
 * É `gravarBoletoDaCobranca` que põe o `identificador_no_provedor` vivo, e é ele a chave pela qual o
 * roteamento **encontraria** a cobrança — que é exatamente o que o `CT-987` precisa que exista para
 * que *"não procurou"* seja afirmação com conteúdo.
 *
 * ⚠️ **Nenhum certificado é registrado, e a ausência é deliberada**: os dois casos que consomem este
 * arranjo terminam **antes** da consulta, e um certificado semeado sugeriria ao próximo leitor que
 * algum deles chega até lá.
 */
async function semearCobrancaComBoleto(): Promise<CobrancaSemeada> {
  const marca = `t7-api-${String(proximoDoArranjo())}`;

  const cadastros = await emUnidadeDeA(async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });
    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
      tipoImovel: 'RESIDENCIAL',
      logradouro: 'Rua das Acácias',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000000',
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });
    const locador = await criarPessoa(tx, 'locador', pessoaDoArranjo(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDoArranjo(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidadeDeA(lerAnoDaSerieDeContrato);
  await emUnidadeDeA(async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });
  const contrato = await emUnidadeDeA(async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano: anoDoContrato, numero },
    );
  });

  const anoDaCobranca = await emUnidadeDeA(lerAnoDaSerieDeCobranca);
  await emUnidadeDeA(async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  // O vencimento sai do relógio do BANCO (ADR-0026), e fica à frente do dia corrente para que a mora
  // seja zero — nunca de `new Date()` do processo.
  const vencimento = await emUnidadeDeA(async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${DIAS_ATE_O_VENCIMENTO}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });

  const cobranca = await emUnidadeDeA(async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel ${marca}`,
        competencia: `${vencimento.slice(0, 7)}-01`,
        dataVencimento: vencimento,
        valorOriginal: VALOR_DA_COBRANCA_SEMEADA,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  const identificador = `2026${String(proximoDoArranjo()).padStart(14, '0')}`;
  const numeroDoTitulo = String(1_000_000_000 + proximoDoArranjo());

  await emUnidadeDeA(async (tx) => {
    await gravarBoletoDaCobranca(tx, cobranca.codigo, {
      numeroDoTituloNoProvedor: numeroDoTitulo,
      linhaDigitavel: `L-${marca}`,
      codigoDeBarras: `B-${marca}`,
      identificadorNoProvedor: identificador,
      caminhoDoArquivo: `${cobranca.codigo}.pdf`,
    });
  });

  return { identificador, numeroDoTitulo };
}
