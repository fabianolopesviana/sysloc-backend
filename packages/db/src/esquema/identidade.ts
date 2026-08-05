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
  unique,
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
 * Os três perfis como união fechada, derivados do enum acima — nunca redigitados.
 *
 * **A declaração mora aqui, junto do enum que a origina**, e não no módulo de ajustes de permissão,
 * que foi onde ela nasceu. A troca é a resolução do **D35** da T7: o perfil é vocabulário do domínio
 * de *identidade* e já tinha dois consumidores sem relação alguma com ajuste (`empresa.ts`, para
 * `lerAlvoDeReemissao`) — o módulo de ajustes virava dono de um vocabulário compartilhado sem que
 * ninguém tivesse decidido isso, e cada consumidor novo herdava o desvio por imitação.
 *
 * `permissao.ts` continua **reexportando** o nome, de modo que a superfície pública do pacote não
 * muda: quem já importava de lá segue importando, e quem chega importa da origem.
 */
export type PerfilDaPessoa = (typeof perfilUsuario.enumValues)[number];

/**
 * Desfecho de uma tentativa de entrada (RN-11). O conjunto é fechado. **Este comentário é o oráculo
 * do vocabulário**: quem for escrever um desfecho novo, ou interpretar um gravado, decide por aqui.
 *
 * ---------------------------------------------------------------------------
 * A fronteira que a migração `0004` instalou — `ACESSO_RECUSADO_POR_POLITICA` vs `ACESSO_RECUSADO`
 * ---------------------------------------------------------------------------
 *
 * Até a fatia anterior, `ACESSO_RECUSADO` era escrito por **três origens** e não distinguia
 * nenhuma delas. A consequência era medida e estava escrita aqui: uma indisponibilidade parcial do
 * banco produzia um pico de `ACESSO_RECUSADO` **indistinguível** de um pico de tentativas contra
 * contas desativadas — que é precisamente o sinal de ataque que a RN-11 existe para tornar legível.
 * Era a pendência **`P-T6-1`**, e a migração `0004` a fecha, separando a primeira origem das outras
 * duas:
 *
 *   1. **`ACESSO_RECUSADO_POR_POLITICA` — recusa de política** (RN-10): pessoa desativada ou
 *      empresa suspensa. É decisão do produto sobre **quem** pode entrar, tomada pela barreira única
 *      de admissão, e é o volume normal da coluna. Para fora, os dois predicados produzem resposta
 *      idêntica à de credencial incorreta; a indistinguibilidade é deliberada (§5.2 da tech spec) e
 *      a trilha segue sendo o único lugar em que eles ficam separados do resto.
 *   2. **`ACESSO_RECUSADO` — o que NÃO é decisão de política.** Sobram as duas origens que dizem
 *      respeito ao servidor ou ao pedido, e não à pessoa:
 *      * **defeito de servidor** — `FAILED_TO_CREATE_SESSION`, que o manipulador de entrada emite
 *        **depois** da conferência bem-sucedida da senha. Ver a `DECISÃO FECHADA` do gancho
 *        `depois` em `packages/auth/src/autenticacao.ts`: erro que não é de credencial **não**
 *        incrementa o contador de bloqueio, mas a RN-11 manda registrar toda tentativa;
 *      * **pedido malformado** — `INVALID_EMAIL` e afins, recusados pela validação do arcabouço
 *        antes de qualquer derivação de senha.
 *
 * **O valor antigo não mudou de nome nem de significado para o que ele já cobria** — ele apenas
 * deixou de cobrir a recusa de política. Acrescentar valor a enum fechado é retrocompatível pela
 * ADR-0012; **renomear ou remover não é**, e por isso nenhum dos cinco valores anteriores foi
 * tocado. Provado pelo CT-208, que afirma os seis rótulos pelo catálogo do banco.
 *
 * O momento foi escolhido: enquanto a coluna não tem volume, a separação é migração sobre tabela
 * vazia. Depois do volume existir, seria migração sobre dados que ninguém consegue reclassificar —
 * a linha antiga não carrega o discriminante que a distinguiria.
 *
 * **Quem lê a trilha, e por onde**: nenhuma **rota do produto** expõe esta tabela — não há
 * superfície de consulta sobre ela. Quem a lê é a **operação**, por consulta direta ao banco, e é
 * para esse leitor que o desfecho precisa ser legível.
 */
export const desfechoTentativa = identidade.enum('desfecho_tentativa', [
  'SUCESSO',
  'CREDENCIAL_INCORRETA',
  'EMAIL_INEXISTENTE',
  'CONTA_BLOQUEADA',
  'ACESSO_RECUSADO',
  // O valor NOVO vai no fim da união, e não perto do irmão semântico: o `0004` o acrescenta com
  // `ALTER TYPE ... ADD VALUE` sem `BEFORE`/`AFTER`, o que o coloca no fim da ordenação do tipo no
  // banco. Declarar aqui noutra posição faria o schema e o banco discordarem da ordem, e a próxima
  // regeração emitiria uma migração para "corrigir" o que está certo.
  'ACESSO_RECUSADO_POR_POLITICA',
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
    /**
     * Quantas vezes o efetivo de permissão desta pessoa mudou. É o discriminante que faz a sessão
     * saber que o retrato que ela carrega ficou velho: divergiu do valor daqui, o efetivo é relido.
     *
     * **Mora na pessoa, e não no vínculo de acesso** (decisão D3 do tech-alignment). A razão não é
     * preferência: o Sysloc Master **não tem** vínculo de acesso, e pôr o contador lá obrigaria um
     * ramo condicional por perfil no caminho da comparação — exatamente o que o ponto de aplicação
     * declara não conter e trata como invariante. Aqui, toda pessoa tem contador, e o Master não é
     * exceção a tratar.
     *
     * Começa em zero e só cresce. Nada nesta task o incrementa — quem o move é a escrita de ajuste,
     * na mesma transação do ajuste (§7.4 da tech spec).
     */
    versaoPermissoes: integer('versao_permissoes').notNull().default(0),
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
    // ---------------------------------------------------------------------------------------
    // ESTA RESTRIÇÃO NÃO TENANTIZA A TABELA — leia antes de tratá-la como violação da ADR-0009
    // ---------------------------------------------------------------------------------------
    //
    // Ela **não** introduz política de isolamento, não habilita RLS e não muda o regime deste
    // schema: `identidade` continua sem tenant, pela mesma razão do cabeçalho deste arquivo — a
    // autenticação opera antes de existir contexto de empresa. A guarda de cobertura audita
    // `negocio`, e o conjunto que ela examina não muda com esta linha.
    //
    // O que ela é: o **alvo** que o PostgreSQL exige para aceitar a referência ao par. Sem
    // unicidade sobre `(id, empresa_id)`, a chave estrangeira composta de
    // `negocio.acesso_usuario_app` não é sequer escrevível. É exatamente o mesmo papel que
    // `acesso_usuario_app_id_empresa_key` já cumpre do lado do negócio.
    //
    // A unicidade é redundante com a chave primária no que diz respeito a `id`, e essa redundância
    // é o ponto — não um descuido. E a pessoa sem empresa continua existindo: no PostgreSQL,
    // unicidade não compara nulos entre si, de modo que múltiplos Masters seriam admitidos aqui;
    // quem limita o Master a um é o e-mail único, não esta restrição.
    unique('usuario_id_empresa_key').on(tabela.id, tabela.empresaId),
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
    /**
     * O efetivo de permissão desta sessão — as áreas de tela e as ações sensíveis que quem a
     * carrega alcança, no instante em que ela foi montada.
     *
     * As duas colunas são arranjos de texto, e não referência à tabela de ajustes: o que fica
     * gravado aqui é o **resultado** já calculado (padrão do perfil mais os ajustes, com a
     * precedência da negação aplicada), não a entrada do cálculo. É o que permite atender uma
     * requisição sem recalcular a matriz a cada chamada.
     *
     * O padrão é o arranjo **vazio**, e não nulo: sessão sem efetivo escrito não alcança nada, que
     * é o lado seguro. Nulo obrigaria todo leitor a decidir o que a ausência significa, e a decisão
     * errada num único leitor abre acesso.
     *
     * `versao_permissoes` é o retrato do contador de `usuario` no momento da montagem. Divergiu do
     * valor de lá, o efetivo aqui está velho e é relido — é a comparação que torna o ajuste
     * perceptível na operação seguinte sem derrubar a sessão.
     */
    telas: text('telas').array().notNull().default([]),
    acoes: text('acoes').array().notNull().default([]),
    versaoPermissoes: integer('versao_permissoes').notNull().default(0),
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
