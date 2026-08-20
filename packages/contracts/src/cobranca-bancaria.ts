/**
 * O contrato da **emissão e da conciliação bancária** — o lote que emite, a conferência que apura
 * junto ao provedor, e a trilha que registra o que mudou.
 *
 * ===========================================================================
 * Este módulo é a FONTE ÚNICA, e o enum do banco DERIVA daqui
 * ===========================================================================
 *
 * A ADR-0016 é literal: *"o esquema declarado no pacote de contratos é a fonte única"* — a conferência
 * de entrada, o tipo da resposta e o documento publicado saem do mesmo objeto. Aqui isso tem uma
 * consequência que atravessa a fronteira do pacote: os três enums do banco
 * (`negocio.tipo_de_evento_bancario`, `negocio.origem_do_evento_bancario`,
 * `negocio.desfecho_do_item_do_lote`) **derivam** destes literais, e nenhum deles é redigitado do
 * outro lado. Um rótulo trocado aqui vira migração errada lá — e é por isso que **a ordem dos rótulos
 * é conteúdo, não estética**: um enum do PostgreSQL guarda a ordem, e é ela que governa comparação e
 * ordenação do tipo.
 *
 * `as const` fecha a união em **compilação**; `Object.freeze` fecha o arranjo em **execução**, e é a
 * segunda metade que sobrevive ao build — sem ela, um consumidor alarga a lista com um `push` e o
 * produto passa a falar de um tipo que ninguém decidiu. É a mesma forma, e a mesma razão, de
 * `ESTADOS_DA_COBRANCA` em `cobranca.ts` e de `MEIOS_DE_RECEBIMENTO` em `integracao-bancaria.ts`.
 *
 * ===========================================================================
 * A trilha registra EFEITO, e por isso não existe um tipo `CONFERENCIA`
 * ===========================================================================
 *
 * A ADR-0034 decide que a trilha publicada registra o **efeito** — mudança de estado do fato de
 * negócio, ou desfecho anômalo como divergência e recusa —, **nunca a tentativa que nada mudou**. Os
 * sete tipos abaixo são todos efeito ou anomalia, e a conferência que nada achou **não aparece na
 * trilha**: essa ausência é o `Cons` que a própria ADR já declara aceito.
 *
 * ⚠️ **A contagem era SEIS até a fatia `webhook-e-carne`**, que acrescentou `NOTICIA_RECUSADA` — e o
 * acréscimo é da segunda metade da decisão (*"ou desfecho anômalo"*), nunca da primeira. Ele não
 * reabre o parágrafo seguinte: o que a notícia **casada** produz na trilha continua sendo o efeito
 * descoberto, com `origem` dizendo quem o descobriu.
 *
 * **Não acrescente um tipo `CONFERENCIA`.** A tentação é real — a CA-13 do PRD lista
 * "conferência" entre as coisas que o histórico deve contar —, e a decisão de recusá-lo foi
 * **escalada ao usuário e registrada** (§21.1(2) do tech spec desta fatia, 2026-08-16). O que a
 * conferência descobre entra como o **efeito descoberto**, e a `origem` de cada evento diz quem o
 * produziu: `ATO_DO_ADMIN` ou `CONFERENCIA`. A CA-13 fica satisfeita na substância, e a ADR na letra.
 *
 * ===========================================================================
 * A chave exposta é o UUID — lote e conferência não têm série declarada
 * ===========================================================================
 *
 * A ADR-0017 tem três classes de chave, e o critério é verificável sem julgamento: código textual
 * quando a entidade tem **série declarada**, UUID quando não tem. Cobrança e contrato têm; a emissão
 * em lote e a conferência **não** — ninguém as cita por número fora do sistema, e inventar uma série
 * para elas criaria contador, formato e canonização de caixa para um identificador que nenhum usuário
 * pronuncia. Logo, `id` é UUID nas duas.
 *
 * Pela mesma ADR, o item do lote e o evento nomeiam a cobrança pelo **código** — que é a chave dela —,
 * e o esquema que confere esse código é o **importado** de `cobranca.ts`, nunca um molde redigitado.
 *
 * ===========================================================================
 * O que é GRAVADO e o que é DERIVADO — a ADR-0022 em forma de esquema
 * ===========================================================================
 *
 * {@link ESTADOS_DA_EMISSAO_EM_LOTE} **não tem enum no banco e não vira coluna**, e a ausência é a
 * decisão. O estado do lote é derivado das colunas de desfecho — `INTERROMPIDA` se há
 * `interrompido_em`, `CONCLUIDA` se há `concluido_em`, `EM_ANDAMENTO` quando não há nenhum dos dois —,
 * exatamente como o estado da cobrança sai da visão em vez de coluna movida por rotina. Gravá-lo
 * criaria a segunda fonte do mesmo fato, livre para divergir do desfecho que a produziu.
 *
 * ===========================================================================
 * Nenhum nome de campo aqui fala o vocabulário do provedor (ADR-0001)
 * ===========================================================================
 *
 * A `Decision` da ADR-0001 fecha: *"nenhum campo, URL ou vocabulário específico de provedor cruza a
 * porta"*, e a emenda de 2026-08-15 declara que essa cláusula é **propriedade do vocabulário**, não
 * contagem de portas — ela alcança tudo que o produto publica. Por isso a chave é
 * `numeroDoTituloNoProvedor` em `cobranca.ts`, e não `nossoNumero`; e por isso quem paga é o
 * **locatário**, nunca `pagador` ou `sacado`.
 */

import { z } from 'zod';
// Os dois vêm do módulo irmão porque descrevem o MESMO fato que ele já descreve: a forma da chave da
// cobrança e a exigência de a competência ser o primeiro dia do mês. Redigitar qualquer um dos dois
// aqui criaria a segunda fonte do mesmo fato que a ADR-0016 elimina.
import { COMPETENCIA_NO_PRIMEIRO_DIA, ESQUEMA_DO_CODIGO_DE_COBRANCA } from './cobranca.js';

/**
 * Os **sete** tipos de evento da trilha bancária (RN-13), na ordem em que o enum do banco os declara.
 *
 * Todos são **efeito ou anomalia**, e a lista é fechada por decisão da ADR-0034 — ver o cabeçalho
 * deste arquivo antes de acrescentar qualquer um, em especial um chamado `CONFERENCIA`.
 *
 * A ordem vai do ciclo do boleto (emitido, revogado, recusado) ao ciclo do dinheiro (liquidada,
 * estornada), fechando nas anomalias que não mudam estado nenhum mas precisam ficar registradas
 * (`DIVERGENCIA_DE_VALOR` — o provedor informou um valor diferente do esperado, a baixa acontece
 * assim mesmo e a divergência fica; `NOTICIA_RECUSADA` — o que o provedor notificou não confere com
 * o que está gravado, e por isso **nada** foi consultado nem mudado).
 *
 * ⚠️ **`NOTICIA_RECUSADA` é acréscimo da fatia `webhook-e-carne`, e ele NÃO contradiz a ADR-0034.**
 * A decisão dela alcança *"o efeito **ou o desfecho anômalo**"*, e a notícia cujo número de título
 * diverge do gravado é anomalia com as duas propriedades que a ADR cobra: aconteceu de fato e não se
 * repete a cada varredura. O que continuaria proibido é registrar a notícia que **casou** e nada
 * mudou — essa não entra na trilha, exatamente como a conferência que nada achou não entra.
 *
 * O valor entra no **fim** da lista, e a posição é conteúdo: `ALTER TYPE … ADD VALUE` sem `BEFORE`/
 * `AFTER` acrescenta ao fim do enum do banco, e é a igualdade posicional entre este arranjo e
 * `negocio.tipo_de_evento_bancario` que o `CT-939` afirma.
 */
export const TIPOS_DE_EVENTO_BANCARIO = Object.freeze([
  'BOLETO_EMITIDO',
  'BOLETO_REVOGADO',
  'EMISSAO_RECUSADA',
  'COBRANCA_LIQUIDADA',
  'LIQUIDACAO_ESTORNADA',
  'DIVERGENCIA_DE_VALOR',
  'NOTICIA_RECUSADA',
] as const);

/** União fechada dos tipos de evento bancário. */
export type TipoDeEventoBancario = (typeof TIPOS_DE_EVENTO_BANCARIO)[number];

/**
 * As **três** origens de um evento da trilha, na ordem em que o enum do banco as declara.
 *
 * É aqui que a conferência aparece na trilha, e **só** aqui: ela não é um tipo de evento (seria
 * registrar tentativa), e sim o **produtor** do efeito que se registrou. `ATO_DO_ADMIN` é o que
 * alguém pediu por rota; `CONFERENCIA`, o que a apuração junto ao provedor descobriu sozinha;
 * `NOTICIA_DO_PROVEDOR`, o que ele veio contar sem que ninguém perguntasse.
 *
 * Sem esta distinção, o leitor do histórico veria *o que* mudou e não *quem* o descobriu — que é
 * metade da pergunta que a CA-13 faz. E as duas últimas **não se fundem**: a conferência é varredura
 * nossa, com cota e horário; a notícia é iniciativa do provedor, e distinguí-las é o que permite
 * medir quanto do que se descobre chega por qual caminho.
 *
 * O valor entra no **fim** da lista pela mesma razão registrada em {@link TIPOS_DE_EVENTO_BANCARIO}:
 * `ALTER TYPE … ADD VALUE` acrescenta ao fim, e a igualdade é posicional.
 */
export const ORIGENS_DO_EVENTO_BANCARIO = Object.freeze([
  'ATO_DO_ADMIN',
  'CONFERENCIA',
  'NOTICIA_DO_PROVEDOR',
] as const);

/** União fechada das origens de um evento bancário. */
export type OrigemDoEventoBancario = (typeof ORIGENS_DO_EVENTO_BANCARIO)[number];

/**
 * Os **três** estados da emissão em lote (RN-14), na ordem publicada.
 *
 * ---------------------------------------------------------------------------
 * Ele é DERIVADO, e por isso não tem enum no banco nem coluna que o guarde
 * ---------------------------------------------------------------------------
 *
 * A ADR-0022 fixa que o estado publicado de um fato é derivado dos fatos gravados, nunca coluna
 * movida por rotina. Aqui os fatos são dois instantes: `INTERROMPIDA` quando há `interrompido_em`,
 * `CONCLUIDA` quando há `concluido_em`, `EM_ANDAMENTO` enquanto não há nenhum dos dois — e o `check`
 * de desfecho único do banco garante que os dois nunca coexistem. Uma coluna de status seria a
 * segunda fonte do mesmo fato, e a divergência entre ela e os instantes seria muda.
 *
 * A ordem vai do estado inicial aos dois desfecho possíveis, que é a ordem em que a vida do lote os
 * alcança.
 */
export const ESTADOS_DA_EMISSAO_EM_LOTE = Object.freeze([
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'INTERROMPIDA',
] as const);

/** União fechada dos estados da emissão em lote. */
export type EstadoDaEmissaoEmLote = (typeof ESTADOS_DA_EMISSAO_EM_LOTE)[number];

/**
 * Os **dois** desfechos de um item do lote, na ordem em que o enum do banco os declara.
 *
 * Diferente do estado do lote, este **é** gravado: ele não deriva de nada — é o desfecho que o
 * provedor deu àquela cobrança, e é o que a prestação de contas da CA-02 apresenta linha a linha.
 * `RECUSADO` anda sempre com o motivo, e o `check` bicondicional do banco recusa um sem o outro.
 */
export const DESFECHOS_DO_ITEM_DO_LOTE = Object.freeze(['EMITIDO', 'RECUSADO'] as const);

/** União fechada dos desfechos de um item do lote. */
export type DesfechoDoItemDoLote = (typeof DESFECHOS_DO_ITEM_DO_LOTE)[number];

/**
 * Corpo fechado de `POST /v1/cobranca-bancaria/emissoes` — **um** campo.
 *
 * É o **único corpo de escrita desta fatia com campo**: as outras três rotas de ato usam o
 * `ESQUEMA_DO_CORPO_VAZIO`, que já existe na borda. O Admin informa só a competência; o conjunto de
 * cobranças é decidido por predicado no banco (ADR-0023), e é isso que torna a reexecução da mesma
 * competência idempotente sem guarda escrita para ela.
 *
 * `strictObject` porque a direção decide a estritude (`.claude/rules/contrato-publicado.md`): chave
 * desconhecida na entrada é erro do cliente e precisa ser recusada **nomeando a chave**. `empresaId`
 * é o caso que mais importa — o contexto de empresa vem da **sessão**, nunca do corpo (ADR-0008 /
 * ADR-0009) —, e a recusa dele não é uma linha de verificação escrita à mão: é o `strictObject`.
 *
 * A conferência do primeiro dia do mês é **do objeto**, com `path` explícito, e não do campo: é a
 * mesma forma de `esquemaDeCobrancaNova`, e o `path` é o que impede a recusa de chegar ao cliente sem
 * nome de campo — a §6.1 manda `422 CAMPO_INVALIDO` nomeando `competencia`. O que é contrato ali é o
 * **campo nomeado**, não o texto da mensagem: o corpo do erro publicado carrega a mensagem canônica
 * de `MENSAGEM_POR_CODIGO`, e este texto só chega ao diagnóstico interno.
 */
export const esquemaDaCompetencia = z
  .strictObject({
    // Data de calendário, e não instante: a coluna é `date` e o valor viaja como `YYYY-MM-DD` (§6.2).
    // `z.iso.date()` recusa `2026-02-30` e recusa a forma com hora — as duas coisas que um `regex`
    // ingênuo deixaria passar, e as duas que precisam ser verdade antes de a expressão do primeiro
    // dia poder ler os dois últimos dígitos como o dia.
    competencia: z.iso.date(),
  })
  .refine(({ competencia }) => COMPETENCIA_NO_PRIMEIRO_DIA.test(competencia), {
    path: ['competencia'],
    message: 'a competência precisa ser o primeiro dia do mês',
  });

/** O corpo aceito ao abrir uma emissão em lote. */
export type Competencia = z.infer<typeof esquemaDaCompetencia>;

/**
 * Uma linha da prestação de contas do lote (§4.1.1) — **três** campos.
 *
 * É o que a CA-02 exige: o Admin precisa saber **qual** cobrança saiu, qual não saiu e **por quê**.
 * Um contador agregado não responderia a segunda pergunta, e é ela que decide o que fazer a seguir.
 *
 * `cobrancaCodigo` passa pelo {@link ESQUEMA_DO_CODIGO_DE_COBRANCA} **importado** — a chave exposta
 * da cobrança (ADR-0017), com a canonização de caixa que ele já faz. `motivo` é anulável porque o
 * item `EMITIDO` não tem motivo a dar; no `RECUSADO` ele carrega o que o provedor respondeu, **tal
 * como respondido**, e não decide coisa alguma (RN-15).
 */
export const esquemaDoItemDoLote = z.object({
  cobrancaCodigo: ESQUEMA_DO_CODIGO_DE_COBRANCA,
  desfecho: z.enum(DESFECHOS_DO_ITEM_DO_LOTE),
  motivo: z.string().nullable(),
});

/** Uma linha da prestação de contas do lote. */
export type ItemDoLote = z.infer<typeof esquemaDoItemDoLote>;

/**
 * A emissão em lote como a API a devolve (§4.1.1) — **dez** campos.
 *
 * `estado` é **derivado** dos dois instantes de desfecho (ver {@link ESTADOS_DA_EMISSAO_EM_LOTE}), e
 * por isso convive com eles sem redundância: os instantes dizem *quando*, o estado diz *o quê*, e o
 * cliente não precisa reimplementar a derivação para saber em que pé está o lote — que é justamente o
 * que a ADR-0017 proíbe (*`status` é calculado no servidor, nunca derivado no cliente*).
 *
 * `interrompidoEm` e `motivoDaInterrupcao` andam **juntos**, e o `check` bicondicional do banco os
 * pareia: um lote interrompido sem motivo diria ao Admin que parou sem dizer por quê, que é o pior
 * desfecho possível da CA-03.
 *
 * `emitidas` e `recusadas` são contadores da prestação de contas, e não substituem `itens`: eles
 * respondem *quanto* de relance, enquanto a lista responde *quais*. Saem com `int()` e não-negativo
 * pelo mesmo desenho já publicado em `esquemaDaAtivacaoDeContrato.efeitos.cobrancasGeradas` — a
 * restrição de valor que a assimetria entrada×saída **não** alcança é a de **escala sobre grandeza
 * derivada em ponto flutuante**, e contagem inteira não é uma delas.
 *
 * `itens` vem **vazio** enquanto o lote está em andamento, e a lista cresce à medida que o processo de
 * trabalho percorre — a leitura é sempre o retrato do instante, nunca uma promessa do total.
 */
export const esquemaDaEmissaoEmLote = z.object({
  // UUID porque o lote não tem série declarada (ADR-0017) — ver o cabeçalho deste arquivo.
  id: z.uuid(),
  competencia: z.iso.date(),
  estado: z.enum(ESTADOS_DA_EMISSAO_EM_LOTE),
  criadoEm: z.iso.datetime(),
  concluidoEm: z.iso.datetime().nullable(),
  interrompidoEm: z.iso.datetime().nullable(),
  motivoDaInterrupcao: z.string().nullable(),
  emitidas: z.number().int().nonnegative(),
  recusadas: z.number().int().nonnegative(),
  itens: z.array(esquemaDoItemDoLote),
});

/** A emissão em lote como a API a devolve. */
export type EmissaoEmLote = z.infer<typeof esquemaDaEmissaoEmLote>;

/**
 * A conferência bancária como a API a devolve (§4.1.1) — **seis** campos.
 *
 * ---------------------------------------------------------------------------
 * `iniciadaAgora` é a resposta da CA-15, e é por isso que o disparo repetido não é erro
 * ---------------------------------------------------------------------------
 *
 * Uma segunda conferência da mesma empresa é recusada **no banco**, pelo índice único parcial
 * `(empresa_id) WHERE concluida_em IS NULL`. O que a rota faz com essa recusa é devolver `200` com
 * `iniciadaAgora: false` **e o recurso da execução que já está em curso** — de modo que o Admin fica
 * sabendo qual é e desde quando, que é mais do que um envelope de erro informaria. O `POST` fica
 * idempotente, e o enum fechado de códigos de erro não precisa crescer para acomodar um desfecho que
 * **não é falha**.
 *
 * `cobrancasConferidas` e `efeitos` são contadores distintos de propósito: a conferência que perguntou
 * por trinta cobranças e nada encontrou publica `30` e `0`. Fundi-los apagaria exatamente a
 * informação que a ADR-0034 mantém fora da trilha — *rodou, e nada mudou* —, e que aqui é legítima
 * porque este recurso descreve a **execução**, não o histórico do fato de negócio.
 */
export const esquemaDaConferenciaBancaria = z.object({
  // UUID pela mesma razão do lote: não há série declarada para a conferência (ADR-0017).
  id: z.uuid(),
  iniciadaEm: z.iso.datetime(),
  concluidaEm: z.iso.datetime().nullable(),
  iniciadaAgora: z.boolean(),
  cobrancasConferidas: z.number().int().nonnegative(),
  efeitos: z.number().int().nonnegative(),
});

/** A conferência bancária como a API a devolve. */
export type ConferenciaBancaria = z.infer<typeof esquemaDaConferenciaBancaria>;

/**
 * Uma linha da trilha bancária de uma cobrança (§4.1.1) — **cinco** campos.
 *
 * O recurso **não publica `id`**, e a ausência é a decisão: a trilha é lida como lista ordenada por
 * `ocorridoEm` sob a cobrança que a rota nomeia, e nada aponta para um evento isolado — não há rota
 * que o leia, o altere ou o apague (RD-12: nada é apagado). Publicar o UUID daria ao consumidor um
 * identificador que rota nenhuma aceita.
 *
 * `diagnostico` guarda o que o provedor informou **tal como informado**, reconhecido ou não, e **não
 * decide coisa alguma** (RN-15) — por construção, já que nenhum ramo do domínio o lê. É o registro que
 * permite entender depois um desfecho que o produto não sabia classificar na hora.
 *
 * `valorInformado` só é preenchido na `DIVERGENCIA_DE_VALOR`: é o valor que o provedor disse ter
 * recebido, guardado ao lado do que se esperava. Ele segue `numeric(15,2)` no banco e sai **sem
 * restrição de escala**, como toda grandeza monetária de saída deste pacote — ver o marcador
 * `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`, em `comum.ts`.
 */
export const esquemaDoEventoBancario = z.object({
  tipo: z.enum(TIPOS_DE_EVENTO_BANCARIO),
  origem: z.enum(ORIGENS_DO_EVENTO_BANCARIO),
  // Instante de ato, e não data de calendário: viaja como ISO-8601 UTC em cadeia, nunca como `Date`.
  ocorridoEm: z.iso.datetime(),
  diagnostico: z.string().nullable(),
  valorInformado: z.number().nullable(),
});

/** Uma linha da trilha bancária de uma cobrança. */
export type EventoBancario = z.infer<typeof esquemaDoEventoBancario>;

/**
 * O **histórico bancário de uma cobrança** como a rota o publica — o envelope de `itens`.
 *
 * ---------------------------------------------------------------------------
 * Ele vive AQUI, e não composto na borda, porque a forma do corpo é contrato
 * ---------------------------------------------------------------------------
 *
 * A ADR-0016 é literal: *"a conferência de entrada, **o tipo da resposta** e o documento publicado
 * derivam"* do esquema deste pacote, e *"uma camada de contrato adicional é permitida desde que
 * **DERIVE** do esquema — nunca que o duplique"*. Composto na borda, o envelope precisava de **duas**
 * declarações desligadas — o `z.object` que alimenta o OpenAPI e o tipo de retorno do manipulador —,
 * e nada forçava a concordância entre elas: renomear `itens` num lado deixava o documento anunciando
 * a chave antiga. Declarado aqui, o esquema é a **única** origem das duas pontas, e a chave existe
 * num lugar só.
 *
 * A segunda razão é o **handoff**: `@sysloc/contracts` é o artefato que o React importa para trocar
 * tipos. Esta era a única resposta da superfície do produto cujo consumidor teria de redigitar a
 * forma do corpo.
 *
 * É objeto, e não arranjo no topo, pela mesma razão que {@link ./comum.js#envelopeDeLista} existe:
 * corpo que é lista no topo não tem onde ganhar campo sem quebrar cliente publicado. E **não** é
 * `envelopeDeLista`: aquele declara `total`, `limite` e `deslocamento`, e prometeria uma janela que
 * esta rota não oferece — a trilha de uma cobrança é pequena por construção, que é o conteúdo da
 * ADR-0034, a mesma que mantém a tentativa fora dela.
 *
 * O item é `esquemaDoEventoBancario` **por referência**, nunca por cópia dos cinco campos: um campo
 * novo no evento aparece aqui pelo compilador, e não por alguém lembrar de espelhá-lo.
 */
export const esquemaDaTrilhaDaCobranca = z.object({
  itens: z.array(esquemaDoEventoBancario),
});

/** O histórico bancário de uma cobrança, derivado do envelope acima — nunca redigitado. */
export type TrilhaDaCobranca = z.infer<typeof esquemaDaTrilhaDaCobranca>;
