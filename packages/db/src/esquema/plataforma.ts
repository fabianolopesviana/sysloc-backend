/**
 * O schema `plataforma` — o lugar do que **não é dado de empresa nenhuma** (ADR-0031).
 *
 * ===========================================================================
 * Por que este arquivo existe, e por que ele é o TERCEIRO schema
 * ===========================================================================
 *
 * A ADR-0009 parte as tabelas em dois: `identidade`, sem noção de tenant, e `negocio`, onde tudo tem
 * dono e a RLS é forçada. A notificação crua do provedor não cabe em nenhum dos dois, e a razão é
 * medida, não estética: ela é gravada **antes** do roteamento, precisamente porque a RN-08 manda
 * registrar o que chegou mesmo quando ele **não casa com cobrança alguma** — e nesse caso não há
 * empresa derivável. Pô-la em `negocio` com `empresa_id` nulo falsificaria o predicado de catálogo
 * da ADR-0009 (a linha sem tenant fica invisível a todos ou visível a todos), e é exatamente a
 * alternativa que a ADR-0031 rejeita por escrito.
 *
 * ===========================================================================
 * O que este arquivo NÃO tem, e as duas ausências são a decisão
 * ===========================================================================
 *
 *   1. **Nenhuma coluna `empresa_id`.** A guarda de `../catalogo-de-plataforma.ts` reprova a tabela
 *      que a carregasse com o motivo `CARREGA_COLUNA_DE_EMPRESA`, **antes** de olhar o roster — e a
 *      ordem é normativa lá, porque `FORA_DO_ROSTER` convidaria à correção errada (acrescentá-la ao
 *      roster) em vez da certa (tirá-la deste schema).
 *   2. **Nenhum `enableRLS()`.** Em `plataforma` não há política de linha a impor: a ADR-0031 declara
 *      nos `Cons` que *"a proteção do que mora ali é papel de conexão e privilégio, não RLS"*.
 *      Habilitá-la aqui seria pior que inútil — `ENABLE` sem política faz o PostgreSQL negar tudo a
 *      quem não é dono, e a tabela pararia de aceitar a notícia que ela existe para guardar.
 *
 * As duas ausências são **afirmadas** contra o catálogo do banco, e não só declaradas aqui: a
 * primeira pela guarda de admissão (`conferirAdmissaoDePlataforma`), a segunda pela guarda de
 * cobertura de isolamento de `../catalogo.ts`, cujo alcance é `negocio` e por isso **não** exige
 * `FORCE` daqui.
 *
 * ===========================================================================
 * O schema NÃO nasce na migração, e o gerador vai propor que ele nasça
 * ===========================================================================
 *
 * `plataforma` é criado por `deploy/scripts/instalacao/provisionar-base.sh` (`SCHEMA_PLATAFORMA`) e,
 * na verificação, por `../../test/banco-efemero.ts` (a lista `SCHEMAS` já o traz). Criá-lo na
 * migração exigiria conceder ao papel de migração o privilégio `CREATE` sobre um banco cujo dono é
 * outro papel — poder maior do que a tarefa pede, e a razão está no cabeçalho da `0000_fundacao.sql`.
 *
 * ⚠️ **Este arquivo é o que faz `drizzle-kit generate` propor `CREATE SCHEMA "plataforma"`**: até
 * ele existir, nenhum objeto do schema era declarado no Drizzle, e os cabeçalhos da `0015` e da
 * `0017` avisavam disso como hipótese. A supressão manual da instrução é **obrigatória** a cada
 * regeração, está declarada no cabeçalho da `0019_dominio_webhook_e_carne.sql`, e o detector é
 * executável: `verificar-migracao.sh`, asserção `(e)`, exige **zero** `CREATE SCHEMA` em código.
 * Acrescentar `plataforma` ao `schemaFilter` de `drizzle.config.ts` **não** evita a proposta — a
 * medição registrada lá mostra que aquela lista governa `pull`/`push`, nunca a saída de `generate`.
 *
 * ===========================================================================
 * Os literais do enum nascem AQUI, e não em `@sysloc/contracts` — e por quê
 * ===========================================================================
 *
 * Os nove enums de negócio deste produto derivam do pacote de contratos, porque a ADR-0016 fixa o
 * esquema publicado como fonte única do que **atravessa a API**. O desfecho da notificação não
 * atravessa: a rota que recebe a notícia responde `204` **sem corpo**, nenhum esquema o publica, e
 * nenhuma consulta o devolve a cliente algum. Declará-lo no pacote de contratos o tornaria parte da
 * superfície que o frontend importa no marco de entrega — alargar o que se publica para um valor que
 * ninguém lê é o oposto do que a ADR pede. Ele é **estado interno do roteamento**, e mora junto da
 * tabela que o guarda.
 */

import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * O schema em si. Ele NÃO é criado pela migração — ver o cabeçalho. A declaração aqui é o que
 * qualifica a tabela: `plataforma.notificacao_bancaria`, e não `public.notificacao_bancaria`.
 */
export const plataforma = pgSchema('plataforma');

/**
 * Os **nove** desfechos possíveis de uma notícia recebida, na ordem em que o enum do banco os
 * declara — e a ordem é conteúdo, porque um enum do PostgreSQL a guarda e é ela que governa
 * comparação e ordenação do tipo.
 *
 * ---------------------------------------------------------------------------
 * Sete são DEFINITIVOS e dois são PENDENTES, e a distinção não é rótulo
 * ---------------------------------------------------------------------------
 *
 * Os pendentes são `RECEBIDO` (gravado, ainda não tratado) e `RETIDO` (a empresa da cobrança está
 * suspensa, e a notícia espera a reativação). É essa partição que a idempotência do tratamento
 * consome — e é por isso que `tratado_em` **não serve** como discriminador de reentrância: o `check`
 * da tabela o amarra a `RECEBIDO` apenas, de modo que o `RETIDO` **tem** `tratado_em` gravado.
 *
 * ---------------------------------------------------------------------------
 * `CONFERIDO_SEM_EFEITO` e `APLICADO` NÃO se fundem, e a separação é a idempotência
 * ---------------------------------------------------------------------------
 *
 * Só a notícia cujo identificador de liquidação já produziu **efeito** é pulada na reentrega. Uma
 * primeira notícia que encontrou o título ainda em aberto — a corrida entre o aviso e a baixa no
 * provedor — precisa poder ser reprocessada pela reentrega seguinte. Fundir os dois transformaria a
 * corrida benigna em recebimento perdido.
 */
export const desfechoDaNotificacao = plataforma.enum('desfecho_da_notificacao', [
  /** Gravado, ainda não tratado — o estado inicial, e o ÚNICO com `tratado_em` nulo. */
  'RECEBIDO',
  /** Era o pedido de validação do endereço, e não uma notícia; nada foi procurado. */
  'VALIDACAO_DE_ENDERECO',
  /** A forma não foi reconhecida; nada foi procurado. */
  'ILEGIVEL',
  /** A chave não achou cobrança alguma; NENHUMA consulta ao provedor foi feita. */
  'SEM_CORRESPONDENCIA',
  /** Casou a cobrança e a conferência reprovou; NENHUMA consulta, e nada mudou. */
  'DIVERGENTE',
  /** A empresa da cobrança está suspensa; PENDENTE até a reativação — não é definitivo. */
  'RETIDO',
  /** O mesmo identificador de liquidação já produziu efeito. */
  'REENTREGA',
  /** O provedor foi consultado e não havia nada a mudar. */
  'CONFERIDO_SEM_EFEITO',
  /** O provedor foi consultado e o estado da cobrança mudou. */
  'APLICADO',
]);

/** Os nove desfechos como união fechada, derivados do enum acima — nunca redigitados. */
export type DesfechoDaNotificacao = (typeof desfechoDaNotificacao.enumValues)[number];

/**
 * O que o provedor notificou, **como chegou** — o registro cru, anterior a qualquer interpretação.
 *
 * ---------------------------------------------------------------------------
 * `recebido` é `jsonb` OPACO, e a opacidade é a decisão
 * ---------------------------------------------------------------------------
 *
 * Nenhuma coluna projeta campo do corpo, e nenhum esquema o valida na entrada. A RN-02 obriga a
 * guardar e confirmar **o que não se entende**: recusar por forma desconhecida seria perder a
 * notícia, que é o defeito que esta tabela existe para não ter. O que se extrai do corpo é lido no
 * tratamento, tolerantemente, e o que se aprendeu vira as colunas de desfecho abaixo — nunca uma
 * segunda cópia do recebido.
 *
 * ⚠️ **O corpo fala o vocabulário do PROVEDOR**, e é o único lugar do produto onde isso é correto
 * (ADR-0001): ele é fato de terceiro, gravado na fronteira. Nenhum nome de campo dele vira
 * identificador aqui — as três colunas de correlação abaixo têm nomes do **produto**.
 *
 * ---------------------------------------------------------------------------
 * `recebido_em` sai do BANCO, nunca do processo (ADR-0026)
 * ---------------------------------------------------------------------------
 *
 * O padrão é `now()`, avaliado pelo servidor. É esse instante que a retenção de 90 dias mede, e uma
 * leitura de relógio do processo faria o prazo depender de qual máquina atendeu a requisição.
 *
 * ---------------------------------------------------------------------------
 * O `check` é BICONDICIONAL, e as duas direções importam
 * ---------------------------------------------------------------------------
 *
 * `(tratado_em IS NULL) = (desfecho = 'RECEBIDO')` torna irrepresentáveis os dois estados
 * incoerentes de uma vez: *tratado sem desfecho* (a linha que alguém carimbou e deixou dizendo que
 * nunca foi olhada) e *desfecho sem carimbo* (o desfecho que não se sabe quando aconteceu, e que a
 * retenção não consegue datar). Escrevê-la como duas restrições soltas deixaria passar exatamente um
 * deles, conforme qual fosse esquecida — mesma forma, e mesma razão, de
 * `certificado_do_provedor_segredo_chk` e de `envio_de_cobranca_causa_chk`.
 *
 * ---------------------------------------------------------------------------
 * Os TRÊS índices, e por que dois são PARCIAIS
 * ---------------------------------------------------------------------------
 *
 *   * **expurgo** — `(recebido_em)`, total, porque a varredura da retenção alcança **toda** linha
 *     vencida, inclusive a retida (a RN-11 é incondicional);
 *   * **retida** — `(recebido_em) WHERE desfecho = 'RETIDO'`, parcial, porque a reativação de uma
 *     empresa precisa das retidas **na ordem de chegada** e nada mais. Um índice total sobre a
 *     coluna de desfecho obrigaria a varrer todo o cru dos 90 dias para achar um punhado de linhas;
 *   * **efeito** — `(identificador_da_liquidacao) WHERE desfecho = 'APLICADO'`, parcial, porque a
 *     pergunta que ele responde é *"este identificador já produziu efeito?"*. Restringi-lo a
 *     `APLICADO` é o que impede a reentrega de ser confundida com a conferência sem efeito — ver o
 *     parágrafo de {@link desfechoDaNotificacao} sobre a fusão que não se faz.
 *
 * Nenhum deles é único: a mesma notícia chegando de novo **é gravada de novo** (RN-08), e a
 * idempotência é do estado, não do registro.
 */
export const notificacaoBancaria = plataforma.table(
  'notificacao_bancaria',
  {
    /**
     * A chave é UUID, e não código legível: a notícia **não tem série declarada** (ADR-0017) — ela
     * não é citada por número fora do sistema, e não há usuário que a pronuncie.
     */
    id: uuid('id').primaryKey().defaultRandom(),
    /** O corpo, como chegou. Opaco por decisão — ver o cabeçalho da tabela. */
    recebido: jsonb('recebido').notNull(),
    /** Instante do **banco** (ADR-0026). É o eixo da retenção de 90 dias. */
    recebidoEm: timestamp('recebido_em', { withTimezone: true }).notNull().defaultNow(),
    /** O que aconteceu com esta notícia. Nasce `RECEBIDO`; ver o `check` abaixo. */
    desfecho: desfechoDaNotificacao('desfecho').notNull().default('RECEBIDO'),
    /**
     * O número que o **provedor** atribuiu ao título, extraído do corpo — com o nome do produto.
     *
     * Nulo quando o corpo não o trouxe ou não foi legível. É por ele que a notícia acha a cobrança,
     * e é ele que a conferência compara com o que está gravado.
     */
    identificadorPeranteOProvedor: text('identificador_perante_o_provedor'),
    /**
     * O identificador da liquidação anunciada, extraído do corpo. Nulo quando ausente.
     *
     * É a chave da primeira camada de idempotência: uma notícia cujo identificador já consta de uma
     * linha `APLICADO` é reentrega. Não é único — ver o cabeçalho.
     */
    identificadorDaLiquidacao: text('identificador_da_liquidacao'),
    /**
     * Por que o desfecho foi este, em texto livre, para quem for ler depois. Nulo quando não há o
     * que dizer. **Não é mensagem de erro devolvida a ninguém**: a rota responde `204` sem corpo.
     */
    diagnostico: text('diagnostico'),
    /** Instante do tratamento. A bicondicional abaixo o amarra ao desfecho. */
    tratadoEm: timestamp('tratado_em', { withTimezone: true }),
  },
  (tabela) => [
    check(
      'notificacao_bancaria_tratamento_chk',
      sql`(${tabela.tratadoEm} IS NULL) = (${tabela.desfecho} = 'RECEBIDO')`,
    ),
    index('notificacao_bancaria_expurgo_idx').on(tabela.recebidoEm),
    index('notificacao_bancaria_retida_idx').on(tabela.recebidoEm).where(sql`desfecho = 'RETIDO'`),
    index('notificacao_bancaria_efeito_idx')
      .on(tabela.identificadorDaLiquidacao)
      .where(sql`desfecho = 'APLICADO'`),
  ],
);
