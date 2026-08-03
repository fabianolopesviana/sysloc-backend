/**
 * Schema `identidade` — as tabelas que existem ANTES de haver empresa no contexto.
 *
 * ---------------------------------------------------------------------------
 * Por que este schema não tem tenant nem RLS (ADR-0009)
 * ---------------------------------------------------------------------------
 *
 * A autenticação precisa operar antes de existir contexto de empresa: conferir credencial, contar
 * tentativa malsucedida e registrar quem tentou entrar acontecem quando ainda não há tenant. Um
 * regime único, com uma via privilegiada para o login escapar da política, foi rejeitado pela
 * ADR-0009 — ele criaria o segundo caminho para o dado que a ADR-0008 proíbe, e esse escape
 * passaria a ser o ponto de maior valor para qualquer defeito futuro.
 *
 * A consequência é declarada, não escondida (§11.2 da tech spec): **nada no banco impede que uma
 * consulta a `identidade` alcance usuários ou empresas de outros tenants**. O que impede o alcance
 * nesta fatia é não existir rota que exponha identidade além da própria sessão de quem pede. Quem
 * reencontrar a ausência de política aqui deve ler esta linha antes de tratá-la como esquecimento.
 *
 * Nenhuma tabela deste arquivo declara `enableRLS()`, e isso é a decisão acima — não omissão. A
 * guarda de catálogo (T4) audita a cobertura de `negocio`, não a deste schema, exatamente porque a
 * fronteira entre os dois é o que a ADR-0009 fixa.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  inet,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * O schema em si. Ele NÃO é criado pela migração: `provisionar-base.sh` o cria com dono
 * `sysloc_migracao` e concede uso ao `sysloc_app` (§7.3 da tech spec). A declaração aqui é o que
 * qualifica cada tabela — `identidade.usuario` e não `public.usuario`.
 */
export const identidade = pgSchema('identidade');

/**
 * Os três perfis são união fechada e, nesta fatia, apenas rótulo de identidade (RN-13): nenhuma
 * decisão de permissão é tomada a partir deles aqui. Os valores são os literais que a API publica
 * (§19.3, `perfil: 'ADMIN_EMPRESA'`), de modo que não exista tradução de vocabulário entre o que
 * o banco guarda e o que o contrato mostra.
 */
export const perfilUsuario = identidade.enum('perfil_usuario', [
  'SYSLOC_MASTER',
  'ADMIN_EMPRESA',
  'USUARIO_EMPRESA',
]);

/**
 * Desfecho de uma tentativa de entrada (RN-11). O conjunto é fechado e cobre os quatro caminhos
 * que os fluxos da fatia produzem, mais a recusa por pessoa desativada ou empresa suspensa.
 *
 * ---------------------------------------------------------------------------
 * `ACESSO_RECUSADO` é o valor SOBRECARREGADO — leia a fronteira antes de usá-lo
 * ---------------------------------------------------------------------------
 *
 * Ele é escrito por **três origens distintas**, e o valor **não as distingue**:
 *
 *   1. **Recusa de política** (RN-10) — pessoa desativada ou empresa suspensa. É o caso para o qual
 *      o valor nasceu, e passa a ser o volume normal da coluna quando a barreira única de admissão
 *      (T7) entrar. Para fora, os dois predicados produzem resposta idêntica à de credencial
 *      incorreta; a indistinguibilidade é deliberada (§5.2 da tech spec) e a trilha é o único lugar
 *      em que eles ficam separados do resto.
 *   2. **Defeito de servidor** — `FAILED_TO_CREATE_SESSION`, que o manipulador de entrada emite
 *      **depois** da conferência bem-sucedida da senha. Ver a `DECISÃO FECHADA` do gancho `depois`
 *      em `packages/auth/src/autenticacao.ts`: erro que não é de credencial **não** incrementa o
 *      contador de bloqueio, mas a RN-11 manda registrar toda tentativa, e ela cai aqui.
 *   3. **Pedido malformado** — `INVALID_EMAIL` e afins, recusados pela validação do arcabouço antes
 *      de qualquer derivação de senha.
 *
 * **A fronteira, por escrito**: quem lê a coluna **não** consegue separar recusa de política de
 * defeito de servidor. A consequência é concreta — uma indisponibilidade parcial do banco produz um
 * pico de `ACESSO_RECUSADO` indistinguível de um pico de tentativas contra contas desativadas, que
 * é precisamente o sinal de ataque que a RN-11 existe para tornar legível. Separá-los **exige valor
 * novo no enum**: nenhuma outra coluna desta tabela carrega o discriminante. Acrescentar código a
 * enum fechado é retrocompatível pela ADR-0007 e renomear não é, então o momento barato é **antes**
 * de o volume existir — pendência **`P-T6-1`**, escrita por extenso em
 * `docs/specs/features/fundacao-multitenancy-identidade/v1/tasks/T8.md` §7.
 *
 * **Dono: a task de fechamento da F1**, e não a T8. O gatilho de escopo disparou na T8 e a resposta
 * registrada (`_run/workflow-report.md`, D-E3) foi NÃO fechar ali: separar o desfecho exige valor
 * novo neste enum mais uma migração `0003`, e somar migração de schema ao diff que move todas as
 * rotas seria a "correção grande com regressão embutida" da §5 do Protocolo. O que o adiamento
 * **não** custa: este banco não tem dado de produção até a virada da F7, então a mudança de enum
 * segue sendo migração sobre banco vazio.
 *
 * **Quem lê a trilha, e por onde** (a frase anterior a esta dizia "a trilha não é consultável nesta
 * fatia", o que contradizia o texto do gancho): as duas coisas são verdadeiras em planos diferentes.
 * Nenhuma **rota do produto** expõe esta tabela — não há superfície de consulta sobre ela, aqui nem
 * nas tasks seguintes. Quem a lê é a **operação**, por consulta direta ao banco, e é para esse
 * leitor que o desfecho precisa ser legível. "Não consultável" é sobre a API; "é essa trilha que a
 * operação lê para decidir se houve ataque" é sobre o banco.
 */
export const desfechoTentativa = identidade.enum('desfecho_tentativa', [
  'SUCESSO',
  'CREDENCIAL_INCORRETA',
  'EMAIL_INEXISTENTE',
  'CONTA_BLOQUEADA',
  'ACESSO_RECUSADO',
]);

/** A imobiliária atendida pelo produto. É a entidade a que todo dado de negócio se vincula. */
// Sem índice declarado para `documento`: a restrição de unicidade abaixo já cria o índice que a
// §7.2 pede. Declarar os dois produziria duas estruturas idênticas para manter na escrita.
export const empresa = identidade.table('empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  documento: text('documento').notNull().unique(),
  /** Instante da suspensão. Nulo é o estado normal; preenchido, ninguém da empresa entra (RN-10). */
  suspensaEm: timestamp('suspensa_em', { withTimezone: true }),
  criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A pessoa que entra no sistema.
 *
 * `email` é `text` normalizado para minúsculas na borda (§6.1), e não `citext`: o tipo insensível a
 * caixa é extensão, exigiria tipo customizado no gerador de schema e esbarra na propriedade do
 * banco — a normalização num ponto único da borda alcança o mesmo resultado sem nada disso.
 *
 * O contador de tentativas e o instante de liberação moram AQUI, na própria conta (RN-06), e não
 * numa tabela de janela por rota: a regra é por conta, e o limitador nativo do arcabouço de
 * identidade não a cumpre (§11.5).
 *
 * ---------------------------------------------------------------------------
 * As três colunas que o arcabouço de identidade EXIGE (migração `0002`)
 * ---------------------------------------------------------------------------
 *
 * `email_verificado`, `atualizado_em` e `imagem` não são campos do produto — são o que o modelo
 * `user` do arcabouço declara. As duas primeiras ele marca como **obrigatórias** e a terceira ele
 * oferece. Sem coluna, os dois modos de falha são distintos e ambos ruins (medidos contra o pacote
 * publicado, e não supostos):
 *
 *   * na **criação** de pessoa, o adaptador confere campo por coluna e levanta
 *     `BetterAuthError: The field "<x>" does not exist in the "<model>" Drizzle schema`. Como
 *     `email_verificado` e `atualizado_em` têm padrão declarado, elas viajam em **toda** criação —
 *     o convite de pessoa (T7/T8) detonaria na primeira;
 *   * na **atualização**, o adaptador **não** confere: o campo simplesmente não chega ao banco. O
 *     arcabouço acrescenta `atualizado_em` a todo update, então a coluna nunca se moveria — falha
 *     silenciosa, que é a pior das duas.
 *
 * Estão aqui porque a coluna é a única forma de o mapeamento existir — o nome em inglês fica na
 * configuração de `@sysloc/auth`, nunca no banco.
 */
export const usuario = identidade.table(
  'usuario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    /**
     * Se o endereço foi confirmado. Obrigatório no modelo do arcabouço, com padrão falso.
     *
     * Nenhum fluxo desta fatia o move: o convite do Master/Admin (fatia seguinte) é que decide se
     * a confirmação por e-mail entra. Falso é o padrão do próprio arcabouço, e mantê-lo idêntico
     * evita que o banco e o modelo discordem sobre o estado inicial de uma pessoa.
     */
    emailVerificado: boolean('email_verificado').notNull().default(false),
    nome: text('nome').notNull(),
    /** Retrato da pessoa. Opcional no modelo do arcabouço; nenhum fluxo desta fatia o escreve. */
    imagem: text('imagem'),
    perfil: perfilUsuario('perfil').notNull(),
    /** Nulo apenas para o Sysloc Master, que não pertence a empresa alguma (§4.2). */
    empresaId: uuid('empresa_id').references(() => empresa.id),
    ativo: boolean('ativo').notNull().default(true),
    senhaProvisoria: boolean('senha_provisoria').notNull().default(false),
    doisFatoresAtivo: boolean('dois_fatores_ativo').notNull().default(false),
    tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
    bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Instante da última alteração. O arcabouço a marca como obrigatória e a reescreve em **todo**
     * update — é a coluna cuja ausência fazia a atualização de pessoa perder o instante em silêncio.
     */
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    // `email` não ganha índice próprio: a restrição de unicidade acima já o cria.
    index('usuario_empresa_id_idx').on(tabela.empresaId),
    // A equivalência é exigida nos DOIS sentidos, e não apenas "Master não tem empresa": sem o
    // segundo lado, uma pessoa de perfil de empresa poderia nascer sem empresa alguma e o contexto
    // da sessão dela ficaria vazio — o mesmo alcance do Master, obtido por omissão de dado.
    check(
      'usuario_master_sem_empresa_chk',
      sql`(${tabela.perfil} = 'SYSLOC_MASTER') = (${tabela.empresaId} IS NULL)`,
    ),
  ],
);

/**
 * Credencial derivada, no formato que o adaptador de identidade opera (T6): um registro por meio de
 * entrada da pessoa. A derivação da senha é do arcabouço (`scrypt`, §11.3) — nada em texto claro
 * chega a esta tabela.
 */
export const conta = identidade.table(
  'conta',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    /** Identificador da pessoa no provedor. Para credencial local, o próprio identificador dela. */
    contaId: text('conta_id').notNull(),
    /** Provedor da credencial. `credential` é o valor do arcabouço para senha local. */
    provedorId: text('provedor_id').notNull(),
    /** Resultado da derivação da senha. Nulo em provedor que não usa senha. */
    senhaDerivada: text('senha_derivada'),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadaEm: timestamp('atualizada_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index('conta_usuario_id_idx').on(tabela.usuarioId),
    index('conta_provedor_conta_idx').on(tabela.provedorId, tabela.contaId),
  ],
);

/** Sessão estabelecida, com validade de 8 h renovada por atividade (RN-07). */
export const sessao = identidade.table(
  'sessao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    /**
     * Endereço de origem como o arcabouço o apurou. É `text`, e não `inet` como em
     * `tentativa_login`: aqui o valor vem de cabeçalho de requisição e é escrito pelo arcabouço,
     * sem passar por validação nossa — um valor malformado recusado pelo tipo derrubaria a criação
     * da sessão, que é o caminho de sucesso. Na trilha de tentativas o valor é escrito por código
     * nosso (T6), e ali o tipo estrito é a decisão da §7.2.
     */
    origem: text('origem'),
    agente: text('agente'),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadaEm: timestamp('atualizada_em', { withTimezone: true }).notNull().defaultNow(),
  },
  // `token` não ganha índice próprio: a restrição de unicidade acima já o cria, e é ela que atende
  // à leitura por chave da §12.2.
  (tabela) => [index('sessao_usuario_id_idx').on(tabela.usuarioId)],
);

/** Valor de uso único e prazo curto emitido pelo arcabouço de identidade. */
export const verificacao = identidade.table(
  'verificacao',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identificador: text('identificador').notNull(),
    valor: text('valor').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadaEm: timestamp('atualizada_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [index('verificacao_identificador_idx').on(tabela.identificador)],
);

/**
 * Segundo fator TOTP: obrigatório para o Sysloc Master e opcional para o Admin Empresa (RN-08).
 *
 * As três últimas colunas são do plugin de segundo fator do arcabouço (migração `0002`), e as três
 * são escritas **pelo próprio adaptador** — o plugin as declara com `input: false`, isto é, quem
 * chama não as informa. Sem elas, ligar o segundo fator (T10) levantaria
 * `BetterAuthError: The field "verified" does not exist in the "twoFactor" Drizzle schema` na
 * primeira criação de linha. Mesmo critério da `usuario`: a coluna existe em português, o nome em
 * inglês fica no mapeamento de `@sysloc/auth`.
 */
export const doisFatores = identidade.table(
  'dois_fatores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    segredo: text('segredo').notNull(),
    codigosRecuperacao: text('codigos_recuperacao').notNull(),
    /**
     * Se o segundo fator já foi confirmado pela pessoa.
     *
     * O padrão é **verdadeiro** porque é o padrão declarado pelo plugin, e não porque "confirmado"
     * seja o estado natural: o plugin grava o valor explicitamente a cada criação de linha (com
     * falso quando a confirmação é exigida), de modo que este padrão nunca é usado na prática.
     * Divergir dele só criaria uma diferença entre o que o modelo assume e o que o banco faria.
     */
    verificado: boolean('verificado').notNull().default(true),
    /** Confirmações malsucedidas do código. Contador do plugin — não é o bloqueio da RN-06. */
    falhasVerificacao: integer('falhas_verificacao').notNull().default(0),
    /** Instante de liberação do segundo fator, quando o plugin o tranca. Nulo é o estado normal. */
    bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [index('dois_fatores_usuario_id_idx').on(tabela.usuarioId)],
);

/**
 * Trilha de tentativas de entrada (RN-11) — bem-sucedidas, malsucedidas e recusadas.
 *
 * `usuario_id` é **anulável de propósito**: tentativa com e-mail inexistente precisa ser registrada
 * e não tem a quem se vincular. `email_informado` guarda o que foi digitado, que é o único dado de
 * autoria disponível nesse caso.
 */
export const tentativaLogin = identidade.table(
  'tentativa_login',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    emailInformado: text('email_informado').notNull(),
    usuarioId: uuid('usuario_id').references(() => usuario.id),
    desfecho: desfechoTentativa('desfecho').notNull(),
    origem: inet('origem'),
    agente: text('agente'),
    ocorridaEm: timestamp('ocorrida_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    index('tentativa_login_ocorrida_em_idx').on(tabela.ocorridaEm),
    index('tentativa_login_email_informado_idx').on(tabela.emailInformado),
  ],
);
