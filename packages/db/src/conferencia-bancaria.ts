/**
 * Conferência bancária — o **predicado do conjunto a conferir** e a recusa da conferência concorrente.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./evento-bancario.ts} e {@link ./emissao-em-lote.ts}
 * já registram: a contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `negocio.conferencia_bancaria` numa
 * cadeia sem importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da unidade
 * de trabalho? NÃO.** As quatro funções **recebem** o executor (`tx`) de quem já abriu a unidade;
 * nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * O CONJUNTO A CONFERIR É **UM** PREDICADO, e a janela sai do RELÓGIO DO BANCO
 * ---------------------------------------------------------------------------
 *
 * {@link selecionarCobrancasAConferir} é uma consulta só, e o predicado dela é a união literal da
 * CA-16 — *toda cobrança em aberto com boleto emitido* mais *toda cobrança paga há 30 dias ou menos
 * com boleto emitido*:
 *
 * ```
 * numero_do_titulo_no_provedor IS NOT NULL
 *   AND ((pago_em IS NULL AND cancelado_em IS NULL)
 *        OR pago_em >= negocio.data_corrente_da_operacao() - INTERVAL '30 days')
 * ```
 *
 * ⚠️ **Os parênteses do segundo termo são conteúdo, não estilo.** `AND` liga mais forte que `OR`,
 * de modo que escrevê-lo sem eles produz
 * `(numero_do_titulo_no_provedor IS NOT NULL AND em aberto) OR (paga há ≤30 dias)` — e a cobrança
 * **paga e sem boleto** entra no conjunto, isto é, o produto passa a perguntar ao provedor por um
 * título que nunca existiu. O arranjo do `CT-929` carrega
 * exatamente essa intrusa, para que a perda dos parênteses apareça nomeada em vez de passar.
 *
 * **A janela dos 30 dias é medida contra `negocio.data_corrente_da_operacao()`, e não contra
 * `new Date()`** (ADR-0026): o instante que decide comportamento é fato do banco. Um relógio do
 * processo daria dois eixos para o mesmo dia — o do `apps/worker`, que corre a conferência, e o do
 * servidor, que grava os carimbos —, e a divergência entre eles apareceria como uma cobrança que sai
 * do conjunto um dia antes ou depois, sem que nada acuse.
 *
 * ⚠️ **Este caminho NÃO acrescenta consumidor da constante de fuso declarada em código**, e a
 * distinção é o que mantém o `D25 · F4/T7` onde está: o fuso é resolvido **dentro** da função do banco
 * (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`, migração `0010`), e nada aqui declara fuso algum
 * — nem por constante, nem por literal. O gatilho daquele débito é o **quarto consumidor do fuso
 * declarado em código** (hoje são `./certificado-do-provedor.ts` e `./envio-de-cobranca.ts`);
 * consultar a função do banco é o caminho que **não** dispara, e é por isso que o identificador
 * daquela constante não aparece escrito aqui: uma varredura por nome contaria este arquivo como
 * consumidor e faria o débito parecer disparado.
 *
 * **A borda dos 30 dias é INCLUSIVA**, e é a comparação `>=` que a produz. `pago_em` é `date` e
 * `data_corrente_da_operacao()` também, de modo que `data - INTERVAL '30 days'` vale a meia-noite do
 * trigésimo dia anterior e o `date` do pagamento é promovido à meia-noite do próprio dia: paga há 30
 * dias **entra**, paga há 31 **fica fora**. É a leitura literal da RN-11 (*"30 dias ou menos"*), e as
 * três bordas — 29, 30 e 31 — são afirmadas uma a uma pelo `CT-929`.
 *
 * A ADR-0023 manda o predicado morar **no banco** porque ele *participa de seleção*: ler a carteira e
 * decidir em memória traria o conjunto inteiro para o processo antes de recortar, e daria ao percurso
 * a peça com que recompor o recorte por fora — a segunda regra para o mesmo fato que o cabeçalho de
 * {@link ./emissao-em-lote.ts} recusa por escrito.
 *
 * ⚠️ **Cobrança SEM boleto está fora do conjunto por construção, e a consequência tem endereço.** A
 * cobrança que ficou sem boleto (CA-06) é recolhida pelo **lote seguinte**, cujo predicado é
 * exatamente *"em aberto e sem boleto"*, e **não** por esta conferência. A §5.2 da tech spec corrige
 * nesse ponto o `D3` do tech-alignment, que dizia o contrário: o desfecho prático — *resolvido sem
 * intervenção* — continua verdadeiro, e o mecanismo é o outro.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA DA CONFERÊNCIA CONCORRENTE NÃO É ERRO — e é por isso que ela não passa por exceção
 * ---------------------------------------------------------------------------
 *
 * {@link abrirConferencia} **não lê nada antes de inserir**, e a ausência é a mesma decisão de
 * `abrirEmissaoEmLote`, em {@link ./emissao-em-lote.ts}: a forma intuitiva — perguntar se há conferência aberta e só então gravar
 * — passa em todos os casos felizes e perde a corrida, porque entre o `SELECT` que não achou e o
 * `INSERT` outra transação grava. Quem recusa é `conferencia_bancaria_em_andamento_uidx`, índice único
 * **parcial** sobre `(empresa_id)` onde `concluida_em IS NULL`.
 *
 * ⚠️ **O que muda em relação à irmã é o DESFECHO, e a diferença é deliberada.** No lote, a recusa vira
 * `ErroDeLoteEmCurso` e a borda compõe `422`: o Admin pediu um lote e não o teve. Aqui, a conferência
 * que ele quis **já está acontecendo** — a borda (T15) responde `200` com `iniciadaAgora: false` e o
 * recurso da execução em curso (§4.1.1 da tech spec), o `POST` fica idempotente, e o enum fechado de
 * `CodigoErro` não precisa crescer para acomodar um desfecho que **não é falha**.
 *
 * Por isso a instrução é `ON CONFLICT … DO NOTHING`, e **não** um `INSERT` cru cuja violação é
 * capturada:
 *
 *   * **não há `23505` a absorver**, logo não há transação abortada, logo **não é preciso `SAVEPOINT`**
 *     — a maquinaria de {@link ./emissao-em-lote.ts} existe porque *lá* a violação acontece e a leitura
 *     do discriminante precisa correr depois dela, na mesma unidade. Aqui não acontece;
 *   * **a discriminação é do arbiter**, e é tão nomeada quanto a de lá: `(empresa_id) WHERE
 *     concluida_em IS NULL` infere **aquele** índice parcial e nenhum outro, de modo que toda outra
 *     violação da tabela — a de `conferencia_bancaria_id_empresa_key`, a da chave estrangeira composta
 *     do usuário — **sobe intacta**. Absorver `23505` em bloco é o que este desenho evita, exatamente
 *     como a irmã evita ao casar pelo nome do índice;
 *   * **a exceção deixa de ser fluxo normal.** O disparo repetido é o caminho esperado (o Admin clica
 *     duas vezes), e levantar para depois traduzir em `200` seria usar exceção para o desfecho de
 *     sucesso.
 *
 * Isto **não** contraria a decisão da irmã, e a distinção é a natureza da recusa: lá ela é erro de
 * domínio e precisa chegar à borda **como recusa**; aqui ela é um dos dois desfechos legítimos da
 * mesma porta, e chega como o campo que os separa.
 *
 * A leitura que descreve a conferência em curso corre **depois** de o banco ter recusado a inserção, e
 * ela não decide se pode gravar — quando ela roda, a linha já não foi criada.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação.** A tabela nasce com RLS **forçada**
 * (`migracoes/0018_seguranca_emissao_e_conciliacao.sql`), de modo que a política é avaliada com os
 * direitos de quem consulta. Acrescentar `empresaId` a uma assinatura seria escrever em código a
 * comparação que a política já faz — a "defesa em profundidade" que a `Decision` da ADR-0008 rejeita
 * por escrito, e o segundo caminho para o mesmo dado que ela nomeia.
 *
 * A escrita precisa **propor** um valor para a coluna, porque `empresa_id` é `NOT NULL` e não tem
 * padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal das políticas avaliada
 * dentro da própria instrução. E a conferência que apontasse para usuário de **outra** empresa é
 * impossível sem que nada aqui a confira: `conferencia_bancaria_usuario_empresa_fkey` é **composta**, e
 * recusa o par que não existe.
 *
 * ---------------------------------------------------------------------------
 * NADA AQUI GRAVA ESTADO DE COBRANÇA
 * ---------------------------------------------------------------------------
 *
 * Este módulo **seleciona** e **presta contas da execução**. Quem aplica o desfecho que o provedor
 * informou — liquidar, estornar, revogar — é o domínio (T12) pelas portas da T6, e quem registra o
 * efeito é `registrarEventoBancario`. A conferência que perguntou por trinta cobranças e encontrou
 * tudo como estava grava **zero** eventos e ainda assim publica `30` em `cobrancasConferidas` e `0` em
 * `efeitos`: é este recurso que descreve a **execução**, enquanto a trilha descreve o **fato de
 * negócio** (ADR-0034).
 *
 * ---------------------------------------------------------------------------
 * AS CHAVES, e a ausência de conversão de `numeric`
 * ---------------------------------------------------------------------------
 *
 * A conferência **não tem série declarada** — ninguém a pronuncia por número fora do sistema —, então
 * a chave exposta dela é o **UUID**, que é a classe que a ADR-0017 reserva para exatamente esse caso.
 * A cobrança é o contrário: ela tem série, e é o **código** que {@link CobrancaAConferir} carrega ao
 * lado do UUID interno — ver o docblock daquele tipo para por que os dois viajam juntos.
 *
 * **Não há conversão de `numeric` neste arquivo, e a ausência é conteúdo.** A convenção da fase é
 * *cadeia na escrita, número na projeção publicada* (cabeçalho de {@link ./evento-bancario.ts}), e ela
 * alcança dinheiro: aqui não há nenhum. `cobrancas_conferidas` e `efeitos` são `integer`, que o driver
 * entrega como número sem passar por texto, e é `z.number().int().nonnegative()` que o esquema
 * publica. Um `Number(…)` sobre eles seria conversão de uma coisa que já é a outra.
 */

import type { ConferenciaBancaria } from '@syslocbr/contracts';
import type { Fragment, TransactionSql } from 'postgres';
// O fragmento da empresa do contexto tem lar único em `./contexto-de-escrita.ts`; ele **não é filtro**
// (nenhuma leitura deste arquivo o aplica, porque a tabela já tem política), e existe só para a
// escrita, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// O molde do INSTANTE tem casa única em `./moldes-de-formatacao.ts`, e é importado em vez de
// recopiado — ver o cabeçalho daquele módulo. Ele **não** entra no barril, por decisão registrada lá.
import { FORMATO_ISO_DO_INSTANTE } from './moldes-de-formatacao.js';

/**
 * O que é preciso para abrir uma conferência — **um** campo, e ele é anulável.
 *
 * Não há `empresaId`, e a ausência é o mecanismo (ADR-0008). Não há `iniciadaEm`: o instante é fato do
 * banco (ADR-0026), e um parâmetro daria a quem chama — e a quem verifica — o poder de escolher quando
 * a conferência começou. E não há conjunto de cobranças: **a seleção é do sistema**, decidida pelo
 * predicado de {@link selecionarCobrancasAConferir}.
 *
 * `solicitadaPor` é **anulável**, e o nulo não é descuido: na F5 quem dispara a conferência é o
 * relógio, sem usuário nenhum por trás. A coluna acompanha (`solicitada_por uuid`, sem `NOT NULL`), e
 * a chave estrangeira composta continua valendo **quando há usuário** — `MATCH SIMPLE` não cobra o par
 * cujo primeiro membro é nulo.
 */
export interface ConferenciaNova {
  /** Quem disparou, ou `null` quando o disparo é do relógio. Amarrado à empresa pela FK composta. */
  readonly solicitadaPor: string | null;
}

/**
 * As contagens com que a conferência se fecha — **duas**, e elas são distintas de propósito.
 *
 * `cobrancasConferidas` é quantas a apuração percorreu; `efeitos`, quantas ela mudou. A conferência que
 * perguntou por trinta e nada encontrou fecha `30` e `0`, e fundi-las apagaria exatamente a informação
 * que a ADR-0034 mantém fora da trilha — *rodou, e nada mudou* —, que aqui é legítima porque este
 * recurso descreve a execução.
 *
 * **Não há guarda de sinal escrita aqui**, e a ausência é decisão: as duas nascem do percurso do
 * processo de trabalho contando o que ele mesmo fez, e não de corpo de requisição algum — não há
 * caminho por onde um cliente as proponha. O `integer` da coluna recusa o não-inteiro e o estouro, e o
 * esquema publicado (`z.number().int().nonnegative()`) é quem descreve a saída.
 */
export interface ContagensDaConferencia {
  readonly cobrancasConferidas: number;
  readonly efeitos: number;
}

/**
 * Uma cobrança do conjunto a conferir — **três** campos, e cada um tem endereço.
 *
 * O `id` é o **UUID interno**, e ele é deliberado pela razão que `CobrancaSemBoleto`, em {@link ./emissao-em-lote.ts}, já registra:
 * `registrarEventoBancario` guarda a chave estrangeira **composta** `(cobranca_id, empresa_id)`, de
 * modo que quem percorre precisa tê-lo em mãos. Sem ele aqui, o percurso traduziria código→UUID por uma
 * consulta avulsa, que é o segundo caminho para o mesmo recorte que a ADR-0017 fecha.
 *
 * O `codigo` é a chave **exposta** (ADR-0017), por onde o percurso alcança as portas da cobrança
 * (`liquidarPeloProvedor`, `estornarLiquidacao`, `revogarBoleto`, todas por código) e por onde a
 * prestação de contas a nomeia.
 *
 * `numeroDoTituloNoProvedor` é a coluna `numero_do_titulo_no_provedor`, publicada aqui **com o nome
 * do produto**: é por ele que se pergunta ao provedor pela situação do título, e é o campo que o
 * primeiro termo do predicado exige não-nulo. Por isso o tipo é `string`, e não `string | null`: a
 * não-nulidade é garantida **pelo predicado**, não por uma conferência escrita depois da leitura.
 *
 * **E nada além dos três.** Replicar aqui valor, vencimento ou locatário criaria uma segunda projeção
 * da cobrança ao lado de `colunasDaCobranca`, livre para divergir dela — é a razão literal que o
 * cabeçalho de {@link ./emissao-em-lote.ts} registra para `CobrancaSemBoleto`. **`pago_em`
 * também fica de fora**, e a ausência é decisão de fronteira: a guarda *"cobrança já paga não é
 * repaga"* vive na porta de liquidação da T6 (§3.3.5 daquela task), e trazer o carimbo para cá daria
 * ao domínio um segundo lugar para reavaliar o mesmo estado — dentro de uma unidade de trabalho
 * diferente daquela em que a escrita acontece, o que é a corrida que a guarda na porta não tem.
 */
export interface CobrancaAConferir {
  readonly id: string;
  readonly codigo: string;
  /**
   * A coluna `numero_do_titulo_no_provedor` — não-nula **por força do predicado** que define este
   * conjunto.
   */
  readonly numeroDoTituloNoProvedor: string;
}

/**
 * A conferência na projeção que o contrato publica, **menos** o campo que só a abertura conhece.
 *
 * Ela é `ConferenciaBancaria` sem `iniciadaAgora`, e não uma redigitação dela: um campo novo no recurso
 * publicado faz {@link conferenciaPublicada} deixar de compilar, que é o alarme desejado — em vez de um
 * corpo que a rota publica com o campo faltando.
 *
 * `iniciadaAgora` sai daqui porque **não é coluna**: ele é o fato de esta chamada ter criado a linha ou
 * ter encontrado a que já existia, e só {@link abrirConferencia} o conhece. {@link lerConferenciaEmCurso}
 * não pode respondê-lo — ela lê o que está lá, sem ter iniciado nada.
 */
export type LinhaDaConferencia = Omit<ConferenciaBancaria, 'iniciadaAgora'>;

/**
 * A conferência **não foi alcançada** pela escrita de conclusão — a recusa que a porta levanta.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de API.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA É CLASSE NOMEADA, e não um `Error` de texto
 * ---------------------------------------------------------------------------
 *
 * Zero linhas tem **duas** causas, e esta camada não pode separá-las — ver {@link concluirConferencia}.
 * Uma é grave (alvo errado, ou contexto de tenant montado de outro modo na unidade que fecha) e outra é
 * **benigna e prevista**: o reenvio da tarefa.
 *
 * ⚠️ **A premissa foi MEDIDA, e não suposta.** O `conferenciaId` **vem de fora**: ele viaja na carga da
 * tarefa (`CargaDaConferenciaBancaria`, `{ empresaId, conferenciaId }` — §3.4 da T15), a entrega da
 * fila é **at-least-once** (§9.1 da tech spec), e a borda não desfaz a conferência quando o
 * enfileiramento falha. Logo o reenvio é **alcançável**, e dizer que zero linhas é *"estado
 * impossível"* seria escrever uma premissa que a própria fatia contradiz.
 *
 * Quem sabe qual das duas está acontecendo é o **chamador** — ele conhece a tentativa em curso, e a
 * camada de dados não —, e é por isso que a recusa precisa ser reconhecível **em runtime** por quem
 * decide: com um `Error` de texto, a borda do processo de trabalho teria de casar mensagem para
 * distinguir *"a tarefa já rodou"* de uma falha de driver, e tratar o reenvio como falha queima as
 * tentativas e termina dizendo ao operador o oposto da verdade. É a mesma razão, medida na mesma fatia,
 * de `ErroDeLoteNaoAlcancado`, em {@link ./emissao-em-lote.ts}.
 *
 * O que ela carrega é o **fato que a própria instrução deu**: qual conferência a escrita não alcançou.
 * Não há leitura para enriquecê-la, e a ausência é decisão — ela seria uma segunda regra sobre o mesmo
 * fato, e exigiria ponto de retorno para compor uma mensagem.
 */
export class ErroDeConferenciaNaoAlcancada extends Error {
  override readonly name: string = 'ErroDeConferenciaNaoAlcancada';

  /** A conferência que a escrita **não** alcançou — o único fato que a instrução dá sobre a recusa. */
  readonly conferenciaId: string;

  constructor(conferenciaId: string) {
    super('a conferência foi concluída e não foi alcançada');
    this.conferenciaId = conferenciaId;
  }
}

/**
 * O índice único **parcial** que recusa a segunda conferência em andamento da mesma empresa.
 *
 * Ele é o **arbiter** de `ON CONFLICT`, e escrevê-lo por coluna e predicado — em vez de pelo nome — é o
 * que a sintaxe do PostgreSQL exige e o que mantém a discriminação: a inferência alcança **aquele**
 * índice e nenhum outro, de modo que a violação de `conferencia_bancaria_id_empresa_key` ou da chave
 * estrangeira composta do usuário continua subindo intacta. Ver o cabeçalho deste arquivo.
 */
function arbitroDaConferenciaEmAndamento(tx: TransactionSql): Fragment {
  return tx`(empresa_id) WHERE concluida_em IS NULL`;
}

/**
 * A projeção da conferência, escrita **uma vez** e reusada pela abertura e pela leitura.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo padrão, e mesma
 * justificativa, de `colunasDoLote` em {@link ./emissao-em-lote.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede duas traduções livres para divergir. E `empresa_id` e
 * `solicitada_por` **não** estão na lista — o que a porta devolve é o que o contrato publica.
 *
 * Os dois instantes saem em ISO-8601 UTC compostos **pelo servidor**, com `AT TIME ZONE 'UTC'` fixando
 * o deslocamento no objeto em vez de no fuso da sessão — e `to_char` de nulo é nulo, de modo que a
 * conferência ainda em andamento atravessa com `concluidaEm` vazio, que é o que a distingue.
 */
function colunasDaConferencia(tx: TransactionSql): Fragment {
  return tx`
    id,
    to_char(iniciada_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "iniciadaEm",
    to_char(concluida_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "concluidaEm",
    cobrancas_conferidas AS "cobrancasConferidas",
    efeitos
  `;
}

/**
 * A conferência copiada campo a campo — **o ponto único** da tradução da consulta em contrato.
 *
 * Os cinco campos gravados são copiados um a um, e não por espalhamento: o espalhamento publicaria
 * qualquer coluna que a projeção venha a ganhar — a começar por `empresa_id` e por `solicitada_por`.
 * Mesma decisão de `eventoPublicado` em {@link ./evento-bancario.ts} e de `lotePublicado` em
 * {@link ./emissao-em-lote.ts}.
 *
 * A cópia tem um segundo efeito, e ele é medido: o objeto que o driver devolve carrega protótipo
 * próprio, montado a partir da descrição das colunas, e devolvê-lo direto faria a comparação estrita da
 * suíte reprovar por **classe** do objeto em vez de por valor.
 *
 * `iniciadaAgora` entra **por parâmetro**, e é o sexto campo: ele não é coluna, e sim o fato de a
 * chamada ter criado a linha — ver {@link LinhaDaConferencia}.
 */
function conferenciaPublicada(
  linha: LinhaDaConferencia,
  iniciadaAgora: boolean,
): ConferenciaBancaria {
  return {
    id: linha.id,
    iniciadaEm: linha.iniciadaEm,
    concluidaEm: linha.concluidaEm,
    iniciadaAgora,
    cobrancasConferidas: linha.cobrancasConferidas,
    efeitos: linha.efeitos,
  };
}

/**
 * Lê a conferência em andamento da empresa do contexto, se houver.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a política já recorta a leitura (ADR-0008). O
 * índice único parcial garante que `concluida_em IS NULL` alcança **no máximo uma** linha por empresa,
 * de modo que a consulta devolve uma ou nenhuma — não há ordenação a declarar, porque não há empate
 * possível.
 *
 * `undefined` tem **duas** causas deliberadamente indistinguíveis: não há conferência em andamento, ou
 * a que existe é de outra empresa e a política a esconde. É o que permite à borda dizer *qual*
 * conferência está acontecendo e desde quando, sem que nada aqui compare empresa com coisa alguma.
 */
export async function lerConferenciaEmCurso(
  tx: TransactionSql,
): Promise<LinhaDaConferencia | undefined> {
  const [linha] = await tx<LinhaDaConferencia[]>`
    SELECT ${colunasDaConferencia(tx)}
      FROM negocio.conferencia_bancaria
     WHERE concluida_em IS NULL
  `;

  return linha;
}

/**
 * Abre a conferência bancária da empresa, **ou devolve a que já está em curso**.
 *
 * **Não há leitura antes da escrita**, e a recusa da segunda é do índice único parcial — ver o
 * cabeçalho deste arquivo para as três razões de o desenho ser `ON CONFLICT … DO NOTHING` em vez do
 * `SAVEPOINT` da irmã: a recusa aqui **não é erro**, a discriminação é do arbiter, e não há violação a
 * absorver.
 *
 * Os **dois** desfechos são legítimos, e o que os separa é `iniciadaAgora`:
 *
 *   * `true` — a linha foi criada por esta chamada, com os dois contadores em zero e `concluidaEm`
 *     nulo. Isso é fato, e não estimativa: nenhuma cobrança pode ter sido percorrida por uma
 *     conferência que a instrução acabou de inserir;
 *   * `false` — o índice recusou porque a empresa já tem uma em andamento, e o que volta é **ela**,
 *     com o instante em que começou. A borda (T15) publica `200`, o `POST` fica idempotente, e o Admin
 *     fica sabendo *qual* execução está acontecendo em vez de receber um envelope de erro.
 *
 * Toda violação que **não** seja a do índice inferido pelo arbiter é **repassada intacta** — a da chave
 * estrangeira composta do usuário, por exemplo. É a mesma disciplina de discriminar em vez de absorver
 * `23505` em bloco que {@link ./emissao-em-lote.ts} registra, obtida por outro mecanismo.
 *
 * A ausência de linha nos **dois** caminhos é estado impossível — ou a inserção criou a linha, ou o
 * índice recusou porque existe uma em andamento —, e ela levanta com nome, em vez de deixar a porta
 * devolver um corpo que ninguém apurou.
 */
// DÉBITO COM GATILHO — D12 · F5/T6 · registrado 2026-08-23
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege a função abaixo.)
// O QUÊ: a conferência abandonada por **esgotamento das repetições** da tarefa fica irrecuperável.
//        Quando não há mais ativação, não há reentrada: a linha fica `concluida_em IS NULL` para
//        sempre, o índice único parcial recusa toda abertura seguinte, e nem a passagem diária nem o
//        botão do Admin destravam — a recuperação exige intervenção direta no banco. A metade (a) do
//        achado JÁ FECHOU na T6 (a reentrada refaz a passada); esta é a metade (b).
// QUANDO FECHA: a fatia que decidir o **limiar de obsolescência** de uma conferência em andamento —
//        é decisão de produto, não de implementação. Fecha por UM dos dois caminhos: janela de
//        obsolescência aqui (recolher ou reabrir a que está aberta há mais que o limiar) **ou**
//        varredura de recolhimento na rotina de manutenção (`MANUTENCAO`, que já corre por empresa).
// POR QUE NÃO AGORA: as duas formas mudam comportamento de produção sem CA nem CT declarados, e a
//        primeira toca o desenho que o cabeçalho deste arquivo registra por extenso — *"não há
//        leitura antes da escrita"*, que existe porque a forma intuitiva perde a corrida. A T11, que
//        recebeu o débito, é a task de **rede e escrituração** da fatia: a superfície da API congela
//        nela, e improvisar limiar sem decisão registrada trocaria um estado travado raro por uma
//        conferência recolhida no meio da passada.
// ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D12
export async function abrirConferencia(
  tx: TransactionSql,
  dados: ConferenciaNova,
): Promise<ConferenciaBancaria> {
  const [aberta] = await tx<LinhaDaConferencia[]>`
    INSERT INTO negocio.conferencia_bancaria (empresa_id, solicitada_por)
    VALUES (${empresaDoContexto(tx)}, ${dados.solicitadaPor})
    ON CONFLICT ${arbitroDaConferenciaEmAndamento(tx)} DO NOTHING
    RETURNING ${colunasDaConferencia(tx)}
  `;

  if (aberta !== undefined) {
    return conferenciaPublicada(aberta, true);
  }

  const emCurso = await lerConferenciaEmCurso(tx);

  if (emCurso === undefined) {
    throw new Error('a conferência não foi inserida e não há conferência em andamento a devolver');
  }

  return conferenciaPublicada(emCurso, false);
}

/**
 * O conjunto a conferir: **um** predicado, com a janela dos 30 dias contra o relógio do banco (CA-16).
 *
 * Os termos são o predicado inteiro, e não há um quarto escrito em lugar nenhum:
 * `numero_do_titulo_no_provedor IS NOT NULL` mais a união de *em aberto* com *paga há 30 dias ou
 * menos*. Ver o cabeçalho deste arquivo para por que os parênteses do segundo termo são conteúdo,
 * por que a borda é inclusiva, e por que a cobrança sem boleto fica de fora **por construção** —
 * com a consequência de a que ficou sem boleto ser recolhida pelo lote seguinte, e não por aqui.
 *
 * **Não há parâmetro nenhum além do executor**, e a ausência é decisão: o conjunto é do sistema, e uma
 * janela de dias recebida de fora daria a quem chama o poder de mudar a regra da RN-11 por chamada.
 *
 * Não há `WHERE empresa_id`: a política recorta (ADR-0008), e é por isso que a mesma chamada, sob outro
 * contexto, devolve o conjunto **daquela** empresa sem que nada aqui compare coisa alguma.
 *
 * ⚠️ **A consulta é sobre a TABELA, e não sobre `negocio.cobranca_derivada`, e isso não contraria a
 * fonte única do estado.** O que o predicado lê são **fatos gravados** — dois carimbos e um
 * identificador —, e não o estado publicado: nenhum dos quatro rótulos de `negocio.status_cobranca`
 * aparece aqui. A visão existe para quem precisa do **estado** e da **mora**; pedi-la aqui pagaria as
 * junções laterais dela para não usar nenhuma das colunas que só ela tem — e sugeriria que a
 * elegibilidade depende do estado derivado, quando ela depende de haver boleto e de quando o pagamento
 * aconteceu. Mesma razão, escrita nos mesmos termos, de `selecionarCobrancasSemBoleto`.
 *
 * A ordem é por **código**, e o que ela entrega é determinismo: o percurso é sequencial e a retomada
 * precisa reencontrar a mesma sucessão, e um conjunto sem ordem declarada deixaria a sequência ao
 * critério do plano de execução. Ela não é prioridade de negócio — ninguém declarou uma —, e o código é
 * único por empresa, de modo que não há empate a desfazer.
 */
export async function selecionarCobrancasAConferir(
  tx: TransactionSql,
): Promise<readonly CobrancaAConferir[]> {
  const linhas = await tx<CobrancaAConferir[]>`
    SELECT id,
           codigo,
           numero_do_titulo_no_provedor AS "numeroDoTituloNoProvedor"
      FROM negocio.cobranca
     WHERE numero_do_titulo_no_provedor IS NOT NULL
       AND ((pago_em IS NULL AND cancelado_em IS NULL)
            OR pago_em >= negocio.data_corrente_da_operacao() - INTERVAL '30 days')
     ORDER BY codigo
  `;

  return linhas.map((linha) => ({
    id: linha.id,
    codigo: linha.codigo,
    numeroDoTituloNoProvedor: linha.numeroDoTituloNoProvedor,
  }));
}

/**
 * Fecha a conferência — o instante do desfecho e as **duas** contagens, numa instrução só.
 *
 * As três colunas mudam juntas porque descrevem o mesmo fato: uma execução que terminou, e o que ela
 * percorreu e mudou. Escrevê-las em instruções separadas deixaria uma janela em que a conferência
 * consta concluída com contadores de outra passada.
 *
 * O segundo termo da cláusula, `concluida_em IS NULL`, **não é leitura prévia**: não há `SELECT`, o
 * predicado do estado é avaliado dentro da própria instrução, e por isso não existe janela entre
 * decidir e gravar. Ele é o que impede a repetição de reescrever contagens já fechadas — e é ele,
 * também, que devolve o índice parcial à empresa uma vez só.
 *
 * ---------------------------------------------------------------------------
 * A LINHA ALCANÇADA É CONFERIDA — e zero linhas tem DUAS causas, uma grave e uma benigna
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **O identificador VEM DE FORA, e a reentrância é desenho declarado desta fatia — não acidente.**
 * Quem fecha a conferência é o processo de trabalho, e o `conferenciaId` viaja **na carga da tarefa**
 * (`CargaDaConferenciaBancaria`, `{ empresaId, conferenciaId }`), com entrega **at-least-once**. Some-se
 * a isso que a borda não desfaz a conferência quando o enfileiramento falha — ela fica em andamento, e
 * *o disparo seguinte reencontra a mesma pelo índice parcial*. Logo esta instrução alcança zero linhas
 * por **dois** percursos, e nenhum deles é impossível:
 *
 *   * **benigno — o reenvio da tarefa**: a tentativa anterior executou, o desfecho **comitou**, e o
 *     processo caiu antes do reconhecimento, que é exatamente o que *at-least-once* significa. Na
 *     redistribuição, a tentativa seguinte corre com o **mesmo** `conferenciaId` e `concluida_em IS
 *     NULL` deixa de alcançar a linha porque o desfecho **já está gravado**. Nada se perdeu — o fato
 *     existe, com as contagens da passada que de fato correu;
 *   * **grave — o alvo errado**: identificador que não corresponde a conferência alguma, ou **contexto
 *     de tenant montado de outro modo na unidade que fecha** (ADR-0024, risco concreto justamente no
 *     processo de trabalho, onde o contexto vem da carga e não da requisição), em que a política esconde
 *     a linha. Aqui a escrita não teve efeito em **tentativa alguma**: a conferência fica para sempre em
 *     andamento, `conferencia_bancaria_em_andamento_uidx` faz **todo** disparo seguinte da empresa
 *     reencontrá-la em vez de iniciar uma nova, e o Admin passa a receber `iniciadaAgora: false` para
 *     sempre, apontando uma execução que ninguém consegue fechar pela interface.
 *
 * **Esta camada não separa os dois, e não deve tentar.** Separá-los exigiria ler a linha — antes, e
 * seria segunda regra sobre o mesmo fato numa corrida; ou depois, e exigiria ponto de retorno para
 * enriquecer uma mensagem. O que a instrução dá é o fato, e é o que a recusa carrega: **a linha não foi
 * alcançada**. Quem decide se isso é benigno é o **chamador**, que sabe se está reentrando — e por isso
 * a recusa é {@link ErroDeConferenciaNaoAlcancada}, classe nomeada, que a borda pode tratar como
 * desfecho terminal benigno em vez de queimar as tentativas, sem confundi-la com falha de driver.
 *
 * O que **não** se admite é resolver em silêncio, e é isso que a conferência fecha: sem ela, o percurso
 * do alvo errado seguiria acreditando que fechou, e o modo de falha descrito acima ficaria mudo. Mesmo
 * mecanismo, e mesma razão, de `definirSituacaoDeLocacaoDoImovel` em {@link ./imovel.ts} e de
 * `concluirLote` em {@link ./emissao-em-lote.ts} — a escrita não ter efeito **em silêncio** é o modo de
 * falha desta operação.
 *
 * Não há `WHERE empresa_id`, e não pode haver: a política recorta a escrita (ADR-0008). A
 * indistinguibilidade que {@link lerConferenciaEmCurso} preserva **não** se estende a esta escrita, e a
 * distinção é a origem do identificador: lá a ausência descreve o que a política escondeu de um
 * cliente; aqui ele vem de uma carga que o próprio sistema compôs a partir de uma linha que ele gravou,
 * e o silêncio não protege ninguém — apenas esconde um percurso sem efeito.
 */
export async function concluirConferencia(
  tx: TransactionSql,
  conferenciaId: string,
  contagens: ContagensDaConferencia,
): Promise<void> {
  const resultado = await tx`
    UPDATE negocio.conferencia_bancaria
       SET concluida_em = pg_catalog.now(),
           cobrancas_conferidas = ${contagens.cobrancasConferidas},
           efeitos = ${contagens.efeitos}
     WHERE id = ${conferenciaId}
       AND concluida_em IS NULL
  `;

  if (resultado.count !== 1) {
    throw new ErroDeConferenciaNaoAlcancada(conferenciaId);
  }
}
