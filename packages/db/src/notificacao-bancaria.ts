/**
 * A **notícia crua** que o provedor envia — gravação, leitura, roteamento, carimbo do desfecho,
 * idempotência por liquidação, listagem das retidas e expurgo da retenção.
 *
 * ===========================================================================
 * ESTE MÓDULO É ACESSO A DADO, E NÃO TEM REGRA DE NEGÓCIO ALGUMA
 * ===========================================================================
 *
 * Nada aqui interpreta o recebido, decide desfecho, fala com o provedor ou conhece a forma do corpo
 * que o terceiro envia. A interpretação é **pura** e vive em
 * `packages/cobranca-bancaria/src/tratamento-de-notificacao.ts`; a orquestração vive na tarefa do
 * processo de trabalho. O que este arquivo publica são as **oito** instruções que aquelas duas
 * camadas precisam, e nenhuma a mais.
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./boleto-da-cobranca.ts} e
 * {@link ./portador-de-confirmacao.ts} já registram, o SQL mora aqui e não no serviço que chama: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço com o executor da
 * unidade de trabalho em mãos escreve `plataforma.notificacao_bancaria` numa cadeia sem importar
 * nada de proibido, e o alcance à tabela deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As **oito** funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 * {@link rotearNotificacaoBancaria} não abre exceção — ela invoca, pelo executor recebido, a função
 * `SECURITY DEFINER` que a migração `0020` criou.
 *
 * ===========================================================================
 * A TABELA NÃO É DADO DE EMPRESA NENHUMA — nenhuma função daqui fixa contexto (ADR-0031)
 * ===========================================================================
 *
 * `plataforma.notificacao_bancaria` não carrega `empresa_id`, não habilita RLS e **nenhuma política a
 * alcança**. As **sete** funções que a tocam gravam e leem sem contexto de tenant algum, e essa
 * ausência é a decisão, não um descuido: a notícia é gravada **antes** do roteamento — inclusive
 * quando não casa com cobrança alguma, que é justamente o caso em que não há empresa derivável. A
 * oitava ({@link rotearNotificacaoBancaria}) também corre sem contexto, mas por outra razão e por
 * outro mecanismo: ela alcança `negocio.cobranca`, que **tem** dono e RLS forçada, e atravessa pela
 * travessia nominal da `0020`.
 *
 * A consequência prática, e ela vale para quem escrever o próximo caso: ler o cru sob o contexto da
 * empresa A e sob o da empresa B devolve **a mesma linha**. Isso não é vazamento — é a ausência de
 * dono. O isolamento desta fatia mora na `negocio.cobranca`, e é a política forçada de lá que decide
 * o que a tarefa alcança depois de o contexto ter sido fixado com o valor que o roteamento devolveu.
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro.** Não há coluna de empresa a
 * comparar, e {@link rotearNotificacaoBancaria} é justamente a função em que a empresa é o
 * **resultado**, nunca a entrada — ver o docblock dela.
 *
 * ===========================================================================
 * TODO INSTANTE SAI DO BANCO, NUNCA DO PROCESSO (ADR-0026)
 * ===========================================================================
 *
 * `recebido_em`, `tratado_em` e o corte dos 90 dias do expurgo saem de `now()`, avaliado pelo
 * servidor. Ler o relógio do Node faria o prazo de retenção depender de qual máquina atendeu a
 * requisição, e faria a ordem de chegada das retidas depender de dois relógios em vez de um.
 *
 * ===========================================================================
 * A ESCASSEZ DE COLUNAS É POR FUNÇÃO, e o critério é quem consome
 * ===========================================================================
 *
 * {@link lerNotificacaoBancaria} devolve o registro **inteiro**, e {@link listarRetidas} devolve
 * **apenas identificadores**. A diferença não é inconsistência: a primeira serve à tarefa que vai
 * tratar aquela notícia — para a qual o corpo recebido **é** o objeto —, e a segunda serve ao
 * `EmpresaService` do Master, cuja sessão a ADR-0013 restringe. Publicar o corpo recebido em
 * {@link listarRetidas} daria à sessão do Master acesso a dado que ela não tem por nenhum outro
 * caminho, e é a mesma razão pela qual {@link rotearNotificacaoBancaria} devolve quatro colunas e não
 * a cobrança inteira.
 */

import type { TransactionSql } from 'postgres';
import type { DesfechoDaNotificacao } from './esquema/plataforma.js';

/**
 * Os desfechos que {@link marcarDesfecho} aceita — todos menos `RECEBIDO`.
 *
 * A exclusão é o que torna **irrepresentável** violar o `notificacao_bancaria_tratamento_chk`, que é
 * bicondicional: `(tratado_em IS NULL) = (desfecho = 'RECEBIDO')`. Carimbar `RECEBIDO` exigiria
 * `tratado_em` nulo, isto é, desfazer o tratamento — e `RECEBIDO` não é um desfecho, é o estado em
 * que a linha nasce. Com este tipo, {@link marcarDesfecho} pode gravar `now()` incondicionalmente e
 * a restrição do banco nunca é exercida por engano da aplicação.
 */
export type DesfechoDoTratamento = Exclude<DesfechoDaNotificacao, 'RECEBIDO'>;

/** O que a borda tem em mãos para gravar: o corpo, como chegou, e nada mais. */
export interface NotificacaoRecebida {
  /**
   * O corpo recebido, **opaco**. Ele vai para `jsonb` sem que nada aqui olhe para dentro — a RN-02
   * obriga a guardar o que não se entende, e recusar por forma desconhecida seria perder a notícia
   * que esta tabela existe para não perder.
   */
  readonly recebido: unknown;
}

/** O registro cru, como o banco o guarda — as oito colunas da tabela. */
export interface NotificacaoBancariaPersistida {
  readonly id: string;
  readonly recebido: unknown;
  readonly recebidoEm: Date;
  readonly desfecho: DesfechoDaNotificacao;
  readonly identificadorPeranteOProvedor: string | null;
  readonly identificadorDaLiquidacao: string | null;
  readonly diagnostico: string | null;
  readonly tratadoEm: Date | null;
}

/**
 * O que a travessia nominal devolve: a empresa dona, a cobrança e o número que o provedor atribuiu.
 *
 * Quatro campos, e nenhum a mais — a razão está no bloco 4 da `0020` e é a mesma que governa a
 * assinatura da função de banco: uma função `SECURITY DEFINER` é um furo declarado na política, e
 * cada coluna a mais alarga o furo.
 */
export interface RoteamentoDaNotificacao {
  /** A empresa dona da cobrança — o **resultado** do roteamento, e a origem do contexto de tenant. */
  readonly empresaId: string;
  /** A chave interna da cobrança encontrada. */
  readonly cobrancaId: string;
  /** O código legível dela (ADR-0017) — é o que a trilha e o diagnóstico nomeiam. */
  readonly codigo: string;
  /**
   * O número que o **provedor** atribuiu ao título. Nulo quando a cobrança nunca teve boleto vivo —
   * caso em que a conferência recusa a notícia como divergente, e não como sem correspondência.
   */
  readonly numeroDoTituloNoProvedor: string | null;
}

/** O que {@link listarRetidas} publica: só o identificador e o instante que o ordena (ADR-0013). */
export interface NotificacaoRetida {
  readonly id: string;
  readonly recebidoEm: Date;
}

/** O que {@link marcarDesfecho} aprendeu sobre a notícia enquanto a tratava. */
export interface AjustesDoDesfecho {
  /** O número do título extraído do corpo, com o nome do produto. */
  readonly identificadorPeranteOProvedor?: string;
  /** O identificador da liquidação anunciada — a chave da idempotência por efeito. */
  readonly identificadorDaLiquidacao?: string;
  /** Por que o desfecho foi este, para quem for ler depois. Nunca sai em resposta a ninguém. */
  readonly diagnostico?: string;
}

/** Os ajustes omitidos — congelado porque é constante compartilhada por toda chamada sem opção. */
const SEM_AJUSTES: AjustesDoDesfecho = Object.freeze({});

/**
 * A retenção do recebido cru, em dias (RN-11).
 *
 * Constante nomeada, e não literal no `interval`, porque o prazo é contrato com a §7.5 da tech spec
 * — e um número solto no meio de uma instrução é o que diverge da política que ele deveria aplicar.
 */
const DIAS_DE_RETENCAO_DO_CRU = 90;

/**
 * Grava o que chegou, **antes de qualquer interpretação**, e devolve o `id` da linha.
 *
 * A gravação **não exige contexto de tenant**, e não poderia exigir: quando ela corre, ainda não se
 * sabe de que empresa o fato é — descobrir é o trabalho da tarefa que virá depois. Nenhuma política
 * alcança esta tabela (ADR-0031), de modo que a inserção sucede numa unidade de trabalho em que
 * `app.empresa_id` nunca foi fixado.
 *
 * `recebido_em` e `desfecho` não aparecem no `INSERT`: os dois são **padrões da coluna** (`now()` do
 * banco e `'RECEBIDO'`), e escrevê-los aqui criaria uma segunda declaração de cada um, livre para
 * divergir da que a `0019` fixou. A linha nasce, portanto, com `tratado_em` nulo — que é o único
 * estado que a bicondicional do `check` admite para `RECEBIDO`.
 */
export async function registrarNotificacaoBancaria(
  tx: TransactionSql,
  notificacao: NotificacaoRecebida,
): Promise<string> {
  // A serialização é EXPLÍCITA, e o parâmetro viaja como TEXTO. A razão é o tipo: o corpo chega da
  // borda como `unknown` (ele é opaco por decisão), e o `json()` do driver cobra uma união de
  // valores serializáveis que só se satisfaz com conversão larga — exatamente o `as` que esta base
  // recusa. Aqui a conversão é uma chamada com nome, e o que ela não consegue serializar aparece
  // como recusa, não como cast.
  const corpo = JSON.stringify(notificacao.recebido);

  if (corpo === undefined) {
    // `JSON.stringify` devolve `undefined` para `undefined`, função e símbolo — nada disso vem de
    // um corpo que a borda leu como JSON, então este ramo é defeito de chamada. Gravar `'null'` no
    // lugar seria pior: `null` é um corpo JSON legítimo, e o Caso C da §4.1.1 (objeto vazio) ficaria
    // indistinguível de uma chamada errada.
    throw new Error('o corpo recebido não é serializável como JSON e não pode ser gravado cru');
  }

  // ⚠️ **`::text::jsonb`, e não `::jsonb` nem parâmetro sem cast — os dois foram MEDIDOS e gravam o
  // corpo DUAS VEZES codificado.** O driver infere o tipo do parâmetro pelo destino (o cast escrito,
  // ou a coluna do `INSERT`); vendo `jsonb`, ele aplica o serializador de JSON à cadeia que já é
  // JSON, e o que fica no banco é a *string* `"{\"idWebhook\":990,…}"` em vez do objeto. O
  // `::text` intermediário fixa o tipo do parâmetro em texto, e o segundo cast é o servidor
  // interpretando esse texto como JSON — que é exatamente o que se quer.
  //
  // O defeito é silencioso na escrita e só aparece na leitura, como um corpo que voltou cadeia. A
  // rede é o `CT-969`, que compara o `recebido` lido com o objeto enviado por **igualdade**: um
  // corpo duplamente codificado reprova ali nomeando a diferença.
  const [linha] = await tx<{ id: string }[]>`
    INSERT INTO plataforma.notificacao_bancaria (recebido)
    VALUES (${corpo}::text::jsonb)
    RETURNING id
  `;

  if (linha === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque `noUncheckedIndexedAccess` cobra a possibilidade, e devolver um
    // identificador vazio adiante seria pior do que falhar aqui.
    throw new Error('o INSERT da notificação bancária não devolveu o identificador gravado');
  }

  return linha.id;
}

/**
 * Lê o registro cru pelo `id`, **sem contexto de tenant** — devolve `undefined` quando não existe.
 *
 * As oito colunas saem daqui, e a amplitude é deliberada: quem chama é a tarefa que vai **tratar**
 * esta notícia, e para ela o corpo recebido é o objeto, o desfecho já gravado é o discriminador de
 * reentrância, e os dois identificadores são o que uma passada anterior porventura já extraiu. É o
 * oposto do critério de {@link listarRetidas} — ver o cabeçalho.
 */
export async function lerNotificacaoBancaria(
  tx: TransactionSql,
  notificacaoId: string,
): Promise<NotificacaoBancariaPersistida | undefined> {
  const [linha] = await tx<NotificacaoBancariaPersistida[]>`
    SELECT id,
           recebido,
           recebido_em                      AS "recebidoEm",
           desfecho,
           identificador_perante_o_provedor AS "identificadorPeranteOProvedor",
           identificador_da_liquidacao      AS "identificadorDaLiquidacao",
           diagnostico,
           tratado_em                       AS "tratadoEm"
      FROM plataforma.notificacao_bancaria
     WHERE id = ${notificacaoId}::uuid
  `;

  return linha;
}

/**
 * Descobre a que empresa pertence a cobrança que o provedor identificou — a **única** leitura desta
 * fatia sem contexto de empresa, e ela é nominal e auditável por construção.
 *
 * ---------------------------------------------------------------------------
 * A EMPRESA É O RESULTADO, NUNCA A ENTRADA (ADR-0024, emendas de 2026-08-13 e de 2026-08-18)
 * ---------------------------------------------------------------------------
 *
 * Quem envia a notícia não tem sessão e não é ninguém do produto: é o provedor, e a origem é
 * literalmente não confiável. Não existe contexto de empresa a fixar antes desta leitura — sob a
 * política forçada da `0010`, ler `negocio.cobranca` sem contexto devolve zero linhas, corretamente.
 *
 * A assinatura desta função **não tem por onde receber empresa**, e a irrepresentabilidade é a
 * decisão: aceitar a empresa que a origem externa declara é exatamente o que a cláusula de
 * procedência da ADR-0024 proíbe. É por isso, também, que a carga da fila desta borda não carrega
 * `empresaId` — o contexto vem do registro que esta função resolve, uma vez só, na borda que o
 * resolve.
 *
 * ---------------------------------------------------------------------------
 * O QUE ATRAVESSA A RLS FORÇADA NÃO É `SECURITY DEFINER` SOZINHO
 * ---------------------------------------------------------------------------
 *
 * São **duas** coisas, e nenhuma basta: a função pertence a `sysloc_roteamento`, papel `NOLOGIN` de
 * propósito único que não conecta e não é dono de tabela alguma, e `negocio.cobranca` tem uma
 * política `FOR SELECT` endereçada exatamente a esse papel. Com o dono errado, a função devolve
 * **zero linhas em 100% das chamadas** — foi o defeito medido na rodada 1 da task da `0014`, e ele é
 * silencioso, porque zero linhas é resposta válida. O bloco 3 da `0020` registra o mecanismo por
 * extenso, e o `CT-973` afirma as duas propriedades junto com o resultado.
 *
 * A chave é o `identificador_no_provedor` — o que **o próprio produto** compôs e enviou, único no
 * SaaS (ADR-0033). É essa unicidade global que torna o roteamento sem empresa possível: um
 * identificador por empresa exigiria saber a empresa antes de procurar.
 *
 * Identificador sem correspondência devolve `undefined`, e não erro: notícia que não casa com
 * cobrança alguma é o caminho normal da RN-08 — ela é gravada, carimbada `SEM_CORRESPONDENCIA` e
 * morre ali, **sem que nenhuma consulta ao provedor aconteça**.
 */
export async function rotearNotificacaoBancaria(
  tx: TransactionSql,
  identificadorNoProvedor: string,
): Promise<RoteamentoDaNotificacao | undefined> {
  const [linha] = await tx<RoteamentoDaNotificacao[]>`
    SELECT empresa_id                       AS "empresaId",
           cobranca_id                      AS "cobrancaId",
           codigo,
           numero_do_titulo_no_provedor     AS "numeroDoTituloNoProvedor"
      FROM negocio.rotear_notificacao_bancaria(${identificadorNoProvedor})
  `;

  return linha;
}

/**
 * Carimba o desfecho do tratamento e o instante em que ele aconteceu.
 *
 * As duas colunas mudam na **mesma instrução**, porque é a bicondicional
 * `notificacao_bancaria_tratamento_chk` que as amarra: escrevê-las em instruções separadas deixaria
 * uma janela em que a linha viola a restrição, e a violação abortaria a transação inteira longe da
 * causa. `tratado_em` recebe `now()` **do banco** (ADR-0026), e o tipo {@link DesfechoDoTratamento}
 * é o que torna irrepresentável carimbar `RECEBIDO` — ver o docblock dele.
 *
 * ⚠️ **Os três ajustes são gravados como vieram, e o ausente vira nulo** — esta função não preserva
 * o que uma passada anterior gravou. É deliberado, e é o que a mantém sem regra: quem carimba é o
 * tratamento, que tem em mãos tudo o que aprendeu sobre aquela notícia. Um `COALESCE` que preservasse
 * o valor antigo esconderia, dentro de uma instrução de acesso a dado, a decisão de qual passada
 * ganha — decisão que pertence a quem trata.
 *
 * A linha alcançada é conferida: um carimbo que não achasse a notícia deixaria a tarefa concluir
 * anunciando um desfecho que ninguém gravou, e o silêncio não protege ninguém.
 */
export async function marcarDesfecho(
  tx: TransactionSql,
  notificacaoId: string,
  desfecho: DesfechoDoTratamento,
  ajustes: AjustesDoDesfecho = SEM_AJUSTES,
): Promise<void> {
  const resultado = await tx`
    UPDATE plataforma.notificacao_bancaria
       SET desfecho                         = ${desfecho},
           tratado_em                       = now(),
           identificador_perante_o_provedor = ${ajustes.identificadorPeranteOProvedor ?? null},
           identificador_da_liquidacao      = ${ajustes.identificadorDaLiquidacao ?? null},
           diagnostico                      = ${ajustes.diagnostico ?? null}
     WHERE id = ${notificacaoId}::uuid
  `;

  if (resultado.count !== 1) {
    // `Error` simples, e não classe de erro exportada: nenhuma camada acima **decide** com base
    // nesta falha — ela é defeito de chamada (um `id` que este banco não guarda), não desfecho de
    // domínio. As classes que este pacote publica existem porque a borda as traduz no envelope da
    // ADR-0017; publicar mais uma aqui alargaria a superfície do índice sem consumidor.
    throw new Error(
      `a notificação bancária ${notificacaoId} não foi alcançada para carimbo de desfecho`,
    );
  }
}

/**
 * Já existe uma notícia com este identificador de liquidação que **produziu efeito**?
 *
 * É a primeira das três camadas de idempotência (§9.2 da tech spec), e a mais barata: ela evita a
 * consulta ao provedor e a linha duplicada na trilha quando a mesma liquidação é reentregue. Ela
 * **não é a garantia** — a garantia é o `WHERE` de estado da baixa, que não tem prazo. Esta camada
 * some com o expurgo dos 90 dias, e isso é aceito.
 *
 * `desfecho = 'APLICADO'` no predicado não é filtro por conveniência: é o que consome o índice
 * parcial `notificacao_bancaria_efeito_idx` e o que separa a reentrega da **conferência sem efeito**.
 * Fundir os dois desfechos transformaria a corrida benigna — a primeira notícia que encontrou o
 * título ainda em aberto — em recebimento perdido.
 *
 * `LIMIT 1` porque a pergunta é de existência: nada aqui conta linhas, e trazer todas para descobrir
 * que há ao menos uma seria transporte sem consumidor.
 *
 * A pergunta é sobre **outra** notícia, e a assinatura não precisa do `id` da corrente para isso: a
 * linha que está sendo tratada ainda é `RECEBIDO` (ou `RETIDO`) quando este predicado corre, e o
 * `desfecho = 'APLICADO'` a exclui por construção. Receber o `id` para excluí-lo daria a impressão
 * de que a ordem entre carimbar e perguntar é livre — e ela não é: perguntar depois de carimbar
 * `APLICADO` faria toda notícia responder que ela mesma já produziu efeito.
 */
export async function houveEfeitoDaLiquidacao(
  tx: TransactionSql,
  identificadorDaLiquidacao: string,
): Promise<boolean> {
  const linhas = await tx`
    SELECT 1
      FROM plataforma.notificacao_bancaria
     WHERE identificador_da_liquidacao = ${identificadorDaLiquidacao}
       AND desfecho = 'APLICADO'
     LIMIT 1
  `;

  return linhas.length === 1;
}

/**
 * As notícias **retidas**, na ordem de chegada — só o identificador e o instante que as ordena.
 *
 * ⚠️ **Duas colunas, e a escassez é a ADR-0013.** Quem chama é o `EmpresaService` do Master, na
 * reativação de uma empresa suspensa, e a garantia é propriedade da sessão dele: publicar o corpo
 * recebido daria àquela sessão acesso a dado que ela não alcança por nenhum outro caminho. O `id`
 * basta — quem for tratar cada uma o faz pela tarefa, que lê o cru por
 * {@link lerNotificacaoBancaria} sob o contexto que o roteamento descobrir.
 *
 * `recebido_em` sai junto porque é ele que **ordena**, e devolver a ordem sem o eixo dela obrigaria
 * quem chama a confiar numa ordenação que não pode conferir.
 *
 * A ordem é **crescente**: a notícia mais antiga é tratada primeiro, que é o que a RN-09 quer dizer
 * por *na ordem de chegada*. O predicado `desfecho = 'RETIDO'` consome o índice parcial
 * `notificacao_bancaria_retida_idx`, cuja razão de ser é exatamente esta consulta — um índice total
 * obrigaria a varrer todo o cru dos 90 dias para achar um punhado de linhas.
 */
export async function listarRetidas(tx: TransactionSql): Promise<readonly NotificacaoRetida[]> {
  return await tx<NotificacaoRetida[]>`
    SELECT id, recebido_em AS "recebidoEm"
      FROM plataforma.notificacao_bancaria
     WHERE desfecho = 'RETIDO'
     ORDER BY recebido_em ASC
  `;
}

/**
 * As notícias **não tratadas** e vencidas — as que ficaram em `RECEBIDO` além da folga declarada.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA EXISTE, e por que {@link listarRetidas} não serve
 * ---------------------------------------------------------------------------
 *
 * Ela fecha o `D13 · F4/T6` da fatia `webhook-e-carne`, cujo gatilho literal é *"a **F5**, que traz o
 * agendamento"*. O débito registrava que a notícia que fica em `RECEBIDO` porque o enfileiramento
 * falhou **não tem quem a reprocesse**: o cru está gravado e é alcançável, mas nada o alcança
 * sozinho. A única varredura que existia é a da reativação de empresa suspensa, e ela consulta
 * {@link listarRetidas}, que só devolve `RETIDO` — outro desfecho, outra causa e outro momento.
 *
 * Os dois predicados são **disjuntos** de propósito, e não uma generalização de um deles: `RETIDO` é
 * decisão do produto (a empresa está suspensa, e a notícia espera a reativação), enquanto `RECEBIDO`
 * vencida é **ausência de decisão** — ninguém a tratou. Fundi-las num filtro por lista de desfechos
 * faria a reativação reenfileirar o que nunca foi dela, e a retomada esperar por um evento que não
 * vem.
 *
 * ---------------------------------------------------------------------------
 * A FOLGA É PARÂMETRO, e o corte sai do relógio do BANCO (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * O prazo chega de quem chama porque ele é **cadência**, não retenção: quem o conhece é o despachante,
 * que sabe de quanto em quanto tempo o relógio do sistema o acorda. Escrevê-lo aqui o transformaria
 * na terceira constante de prazo deste pacote, livre para divergir da unidade `systemd` que a governa.
 *
 * O corte é `now()` **avaliado pelo servidor**, e não um instante composto na aplicação: a notícia é
 * gravada com `recebido_em` do banco, e comparar dois relógios faria a retomada disparar cedo ou
 * tarde conforme a máquina que executou o despachante.
 *
 * O intervalo sai de `make_interval(mins => …::integer)` pela razão medida em
 * {@link expurgarNotificacoesVencidas}: o `inferType` do driver devolve `0` para todo `number` de
 * JavaScript, e `n * interval '1 minute'` deixaria o resolvedor escolher a multiplicação.
 *
 * ---------------------------------------------------------------------------
 * A PROJEÇÃO É O IDENTIFICADOR, e nada além dele
 * ---------------------------------------------------------------------------
 *
 * Ela devolve **só** o `id`, e a escassez é maior do que a de {@link listarRetidas} por uma razão
 * concreta: lá o instante sai junto porque quem chama **publica** a ordem numa resposta e precisaria
 * poder conferi-la; aqui quem chama apenas **reenfileira**, e a carga da tarefa é `{ notificacaoId }`
 * — um campo. Devolver `recebido_em` seria transporte sem consumidor, pelo mesmo critério que dispensa
 * o `RETURNING` do expurgo.
 *
 * ⚠️ **A carga reenfileirada não leva empresa, e a ausência é conformidade** (ADR-0035 + ADR-0024,
 * emenda de 2026-08-18): na entrada de fato de terceiro a empresa é o **resultado** da travessia
 * nominal, e o único valor disponível aqui viria do recebido. Esta função é justamente a que não tem
 * empresa a devolver — como nenhuma outra deste módulo.
 *
 * A ordem é **crescente**, como a da irmã: a notícia mais antiga volta à fila primeiro, que é o que
 * *retomar* quer dizer. O **desempate pelo `id`** existe pela razão que `listarEmpresas` e
 * `listarEmpresasAtivas` já registram, e ela é transponível palavra por palavra: `recebido_em` empata
 * com facilidade — o provedor entrega em rajada, e uma indisponibilidade da fila deixa dezenas de
 * notícias com o mesmo instante —, e o empate faria a ordem do reenfileiramento depender do
 * planejador. O `id` é único, de modo que ele desempata sempre.
 *
 * ⚠️ **Não há índice parcial sobre `RECEBIDO`, e a ausência é decisão medida.** `RECEBIDO` é estado
 * **transitório** — toda notícia entra nele e sai —, de modo que um índice parcial sobre ele pagaria
 * manutenção em **toda** gravação e em **todo** carimbo de desfecho para servir a uma varredura de dez
 * em dez minutos. O que a consulta percorre é o cru dos 90 dias, que a RN-11 mantém pequeno, com a
 * faixa de `recebido_em` já coberta por `notificacao_bancaria_expurgo_idx`. O par oposto —
 * `notificacao_bancaria_retida_idx` — existe porque `RETIDO` é estado **estável** e raro.
 */
export async function listarNaoTratadas(
  tx: TransactionSql,
  folgaEmMinutos: number,
): Promise<readonly string[]> {
  const linhas = await tx<{ id: string }[]>`
    SELECT id
      FROM plataforma.notificacao_bancaria
     WHERE desfecho = 'RECEBIDO'
       AND recebido_em < now() - make_interval(mins => ${folgaEmMinutos}::integer)
     ORDER BY recebido_em ASC, id
  `;

  return linhas.map((linha) => linha.id);
}

/**
 * Apaga todo cru com mais de {@link DIAS_DE_RETENCAO_DO_CRU} dias e devolve quantas linhas saíram.
 *
 * O corte sai de `now()` **do banco** (ADR-0026): um corte medido pelo relógio do processo faria o
 * prazo de retenção depender de qual máquina executou a tarefa.
 *
 * ⚠️ **O expurgo alcança a notícia `RETIDO` vencida também, e isso é escolha registrada.** A RN-11 é
 * incondicional, e excluir as retidas criaria retenção **sem prazo** de dado pessoal de terceiro
 * exatamente no caso que a regra existe para fechar. A rede para a suspensão que durar mais de 90
 * dias é a conferência diária da fatia anterior, que descobre a liquidação de qualquer maneira: o
 * que se perde é a *origem* na trilha, não o recebimento.
 *
 * Não há `RETURNING`: quem chama publica a contagem numa linha de trilha, e trazer N corpos crus para
 * descartá-los seria transporte sem consumidor. A devolução sai de `count` do driver — quantas linhas
 * o **servidor** apagou —, e não do comprimento de uma lista que a aplicação montou.
 *
 * O intervalo sai de `make_interval(days => …::integer)`, e não de `n * interval '1 day'`: o
 * `inferType` do driver devolve `0` para todo `number` de JavaScript, de modo que a segunda forma
 * deixaria o **resolvedor** escolher qual multiplicação de `interval` aplicar. É o idioma que
 * `envio-de-cobranca.ts` já usa no caso semanticamente idêntico — o tipo é declarado, não inferido.
 */
export async function expurgarNotificacoesVencidas(tx: TransactionSql): Promise<number> {
  const resultado = await tx`
    DELETE FROM plataforma.notificacao_bancaria
     WHERE recebido_em < now() - make_interval(days => ${DIAS_DE_RETENCAO_DO_CRU}::integer)
  `;

  return resultado.count;
}
