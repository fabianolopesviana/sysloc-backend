/**
 * Schema `negocio` — toda tabela daqui nasce isolada, ou não nasce.
 *
 * ---------------------------------------------------------------------------
 * As quatro propriedades, e por que são quatro (ADR-0008 e ADR-0009)
 * ---------------------------------------------------------------------------
 *
 * Toda tabela deste arquivo declara, sem exceção:
 *
 *   1. **`empresa_id` não nulo** — é a coluna que a política compara;
 *   2. **`enableRLS()`** — sem isso a política existe e não é consultada;
 *   3. **restrição única `(id, empresa_id)`** — é o alvo que torna a chave estrangeira composta
 *      escrevível: o PostgreSQL exige unicidade no par referenciado;
 *   4. **chave estrangeira composta `(id_alheio, empresa_id)`** em toda referência a outra entidade
 *      tenantizada — é o que torna a referência cruzada entre empresas *estruturalmente impossível*,
 *      e não apenas verificada.
 *
 * Falta a quinta, que **não mora neste arquivo**: `FORCE ROW LEVEL SECURITY` e as políticas
 * `USING`/`WITH CHECK` vivem em migração de segurança escrita à mão. São **três**, e quem
 * acrescentar tabela aqui precisa saber qual delas emendar — a resposta é sempre *nenhuma*, e a
 * lista existe para dizer onde cada tabela já protegida foi protegida:
 *
 *   * `migracoes/0001_seguranca.sql` — as duas tabelas herdadas da F1 (`acesso_usuario_app` e
 *     `acesso_usuario_permissao`);
 *   * `migracoes/0006_seguranca_dominio.sql` — as seis entidades do domínio de locação
 *     (`conjunto`, `imovel`, `comodo`, `locador`, `locatario`, `fiador`);
 *   * `migracoes/0008_seguranca_contrato.sql` — o contrato e o vínculo de fiador (`contrato` e
 *     `contrato_fiador`), mais o mecanismo de emissão da série declarada (ADR-0020).
 *
 * São três porque **gerado e autoral nunca convivem no mesmo arquivo** — uma regeração futura da
 * gerada sobrescreveria o trecho autoral em silêncio. O que **obriga** a parceira autoral não é a
 * predecessora ser gerada: é **nascer tabela em `negocio`**, porque o gerador não emite `FORCE` nem
 * política. Toda migração que criar tabela aqui leva junto uma parceira autoral própria — nunca um
 * acréscimo à `0001`, à `0006` ou à `0008`, que descrevem schemas já aplicados e são, portanto,
 * imutáveis.
 *
 * O diretório de migrações é a conferência da regra, e ele recusa a forma mais larga dela: a
 * `0002_campos_do_arcabouco.sql` e a `0003_autorizacao.sql` são **geradas e não têm parceira** —
 * nenhuma das duas cria tabela, elas só alteram o que já existia —, e a `0004_desfecho_de_recusa.sql`
 * é **autoral avulsa**, sem gerada a quem se parear. Só a `0000`, a `0005` e a `0007` criam tabela
 * em `negocio`, e são exatamente elas que têm parceira. Ler o gatilho como "toda gerada ganha uma
 * parceira" produziria uma migração de segurança vazia, sem `FORCE` nem política a declarar.
 *
 * O gerador de migração declara RLS e a política que se declare aqui, mas **não emite `FORCE`** — e
 * sem `FORCE` o dono das tabelas ignora a política, o que faria a suíte de isolamento ficar verde
 * sem provar nada (ADR-0009, seção Neutros). A autoridade sobre o estado real é a consulta ao
 * catálogo, não a declaração: é a guarda da T4 que reprova a tabela que nasça sem qualquer uma das
 * propriedades.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO existe aqui, de propósito
 * ---------------------------------------------------------------------------
 *
 * Nenhum filtro por empresa em consulta, em repositório ou em serviço. A ADR-0008 rejeitou
 * explicitamente a defesa em profundidade "RLS somada ao filtro da aplicação": dois caminhos para o
 * mesmo dado divergem com o tempo, e o filtro redundante ensina a confiar nele — quando ele deixar
 * de existir num ponto novo, nenhum teste acusa. Há um caminho só, e ele é o banco.
 */

import {
  ESTADOS_DO_CONTRATO,
  SITUACOES_DE_LOCACAO,
  TIPOS_DE_IMOVEL,
  TIPOS_DE_PESSOA,
} from '@sysloc/contracts';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { empresa, usuario } from './identidade.js';

/**
 * O schema em si. Como o de identidade, ele NÃO é criado pela migração: vem do provisionamento,
 * com dono `sysloc_migracao` e uso concedido ao `sysloc_app` (§7.3 da tech spec).
 */
export const negocio = pgSchema('negocio');

/**
 * Natureza da permissão registrada. União fechada: área de tela ou ação sensível — as duas classes
 * que a matriz da fatia seguinte enumera. O enum vive no schema de negócio porque só é usado aqui.
 */
export const tipoPermissao = negocio.enum('tipo_permissao', ['TELA', 'ACAO']);

/**
 * O que a linha de permissão FAZ com a chave que ela nomeia — o que torna o ajuste **bidirecional**
 * representável: a mesma tabela concede e retira.
 *
 * União fechada de dois valores, e não uma coluna booleana: o vocabulário do banco é o mesmo que a
 * API publica, e um `boolean concedida` obrigaria a traduzir `false` para "negada" em toda leitura —
 * a tradução de vocabulário que o schema de identidade já recusa para `perfil_usuario`.
 *
 * A coluna é **não nula e sem padrão**: quem escreve um ajuste declara o efeito dele. Um padrão
 * escolheria por omissão entre conceder e negar, que é exatamente a decisão que não pode ser
 * implícita.
 */
export const efeitoPermissao = negocio.enum('efeito_permissao', ['CONCEDIDA', 'NEGADA']);

/**
 * Vínculo de acesso: a pessoa que alcança o sistema de uma empresa.
 *
 * A referência a `identidade.empresa` é simples porque a tabela apontada **não é tenantizada** —
 * ela não tem `empresa_id` a casar.
 *
 * A referência a `identidade.usuario`, essa, **é composta**, e a razão não é simetria com o schema
 * de negócio: é que o par `(usuario_id, empresa_id)` desta tabela afirma um fato — *"esta pessoa
 * pertence a esta empresa"* — que o banco tem como conferir, porque `identidade.usuario` carrega a
 * própria `empresa_id`. Sem a referência composta, a coerência entre as duas pontas dependia de
 * validação de aplicação, e a ADR-0008 tira exatamente essa decisão da aplicação. É a conciliação
 * estrutural do débito **D5** (decisão D6 do tech-alignment), provada pelo CT-207.
 *
 * A pessoa **sem empresa** (o Sysloc Master) continua existindo e simplesmente não é alvo de
 * vínculo: `MATCH SIMPLE`, que é o padrão, só aplica a referência quando **nenhuma** das colunas
 * referenciadoras é nula — e aqui as duas são não nulas, de modo que a referência vale sempre e
 * nunca encontra o par `(master, NULL)`.
 */
export const acessoUsuarioApp = negocio
  .table(
    'acesso_usuario_app',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      // A referência SIMPLES permanece, ao lado da composta abaixo. Ela é implicada pela composta e
      // não recusa nada que a composta já não recuse — mas retirá-la seria remover uma garantia que
      // esta task não introduziu, e o Protocolo Antirregressão (§4.3) proíbe isso. O custo é uma
      // verificação a mais por escrita numa tabela de baixíssimo volume.
      usuarioId: uuid('usuario_id')
        .notNull()
        .references(() => usuario.id),
      criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta da tabela-filha. Redundante com a chave primária no
      // que diz respeito à unicidade de `id` — e é justamente essa redundância que o PostgreSQL
      // exige para aceitar a referência ao par.
      unique('acesso_usuario_app_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Uma pessoa tem no máximo um vínculo por empresa. O índice que a §12.2 pede para
      // `(empresa_id, usuario_id)` é o desta restrição.
      unique('acesso_usuario_app_empresa_usuario_key').on(tabela.empresaId, tabela.usuarioId),
      // A conciliação estrutural do D5 — ver o cabeçalho desta tabela. O alvo é
      // `usuario_id_empresa_key`, declarada em `identidade.ts`; ela **não** tenantiza aquela tabela,
      // é apenas o que o PostgreSQL exige para aceitar a referência ao par.
      foreignKey({
        name: 'acesso_usuario_app_usuario_empresa_fkey',
        columns: [tabela.usuarioId, tabela.empresaId],
        foreignColumns: [usuario.id, usuario.empresaId],
      }),
    ],
  )
  .enableRLS();

/**
 * Tabela-filha do vínculo de acesso: um **ajuste** por linha — a permissão que foi concedida a esta
 * pessoa além do padrão do perfil dela, ou retirada dele.
 *
 * Ela nasceu estrutural e vazia na fatia anterior, para tornar a chave estrangeira composta
 * verificável com dado real (CA-04). É esta task que a torna **escrevível com significado**: a
 * coluna `efeito` diz o que a linha faz, e a unicidade do trio impede que duas linhas digam coisas
 * opostas sobre a mesma chave.
 */
export const acessoUsuarioPermissao = negocio
  .table(
    'acesso_usuario_permissao',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      acessoId: uuid('acesso_id').notNull(),
      tipo: tipoPermissao('tipo').notNull(),
      chave: text('chave').notNull(),
      /** Conceder ou retirar. Sem padrão: ver o comentário de {@link efeitoPermissao}. */
      efeito: efeitoPermissao('efeito').notNull(),
    },
    (tabela) => [
      unique('acesso_usuario_permissao_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A unicidade que torna o CONFLITO IRREPRESENTÁVEL: um vínculo tem, no máximo, uma linha por
      // chave. Concessão e negação da mesma chave para a mesma pessoa não coexistem porque o banco
      // recusa a segunda, e não porque alguém se lembrou de conferir antes de gravar.
      //
      // A consequência é sobre a regra que lê, e não sobre esta tabela: a precedência da negação
      // **nunca precisa arbitrar dado inconsistente** — ela nunca encontra o par contraditório que
      // teria de desempatar. Regra que arbitra é regra que pode arbitrar errado; regra que nunca
      // encontra o caso não tem como. Provado pelo CT-206.
      //
      // `empresa_id` fica FORA do trio de propósito: ele é funcionalmente determinado por
      // `acesso_id`, que a chave estrangeira composta abaixo amarra a um único vínculo — e um
      // vínculo pertence a uma empresa só. Acrescentá-lo alargaria a chave sem recusar nada a mais.
      unique('acesso_usuario_permissao_acesso_tipo_chave_key').on(
        tabela.acessoId,
        tabela.tipo,
        tabela.chave,
      ),
      // ESTA é a chave estrangeira composta da ADR-0008. Ela recusa, no banco, apontar uma
      // permissão da empresa A para um vínculo da empresa B: o par `(acesso_id, empresa_id)` teria
      // de existir em `acesso_usuario_app (id, empresa_id)`, e não existe.
      //
      // Note que `empresa_id` NÃO ganha uma chave estrangeira própria para `identidade.empresa`:
      // ela seria implicada por esta, que só aceita pares já existentes no pai — e o pai já
      // referencia a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação
      // a cada escrita sem recusar nada que esta já não recuse.
      foreignKey({
        name: 'acesso_usuario_permissao_acesso_empresa_fkey',
        columns: [tabela.acessoId, tabela.empresaId],
        foreignColumns: [acessoUsuarioApp.id, acessoUsuarioApp.empresaId],
      }),
      index('acesso_usuario_permissao_empresa_acesso_idx').on(tabela.empresaId, tabela.acessoId),
    ],
  )
  .enableRLS();

// ===========================================================================
// O domínio de locação — as seis entidades de cadastro da fatia
// ===========================================================================
//
// Os três enums abaixo derivam dos literais de `@sysloc/contracts`, e a direção da dependência é
// deliberada: o contrato é **folha** (ADR-0016), e é ele que o frontend importa no marco de entrega
// do backend. Declarados aqui e importados de lá, o contrato precisaria conhecer `@sysloc/db` — e o
// React arrastaria `drizzle-orm` e `postgres` para saber o tipo de um imóvel. Declarados lá e
// consumidos aqui, o custo é zero: o servidor já depende de tudo.
//
// Redigitar os literais seria a segunda fonte do mesmo fato, que é exatamente o que a ADR-0016
// fecha: o dia em que o contrato ganhar um tipo de imóvel, o banco o recusaria sem que nada
// acusasse antes da primeira gravação em operação.
//
// **Nenhuma das SEIS entidades de cadastro tem contador sequencial** (ADR-0015): nenhuma delas expõe
// código legível — a chave exposta é o UUID, e a ADR-0015 só se aplica a série declarada. O
// `identificador_municipal` do imóvel não é série do produto: é dado do cliente, informado por ele.
//
// **O contrato, esse, TEM** — ele é a primeira entidade do produto com série declarada, e a única
// até aqui. O `codigo` dele (`CTR-{ano}-{5 dígitos}`) é emitido pelas duas funções
// `SECURITY DEFINER` de `migracoes/0008_seguranca_contrato.sql`, com escopo `(empresa, ano)`, cujo
// avanço não participa do desfazimento (ADR-0020). Nada disso é declarável em Drizzle: o que mora
// aqui é a coluna `codigo` e a unicidade `(empresa_id, codigo)` que a torna estável.
//
// Os dois candidatos que NÃO são série ficam nomeados, porque o bloco acima sozinho não os alcança
// e é aqui que quem procurar vai olhar:
//
//   * **`imovel.identificador_municipal`** — parece código legível e não é série NOSSA. Quem o emite
//     é a prefeitura; o produto apenas o guarda e o torna único por empresa. Não há número a
//     reservar, e a ADR-0015 governa a emissão, não o armazenamento;
//   * **`comodo.posicao`** — é atribuída pelo servidor (`max(posicao) + 1`, §6.2 da tech spec), o
//     que é a única coisa que ela tem em comum com uma série. Ela **não** é série no sentido da
//     ADR-0015: aquela decisão ancora no *código legível citável fora do sistema* — o `CTR-2026-0001`
//     de um e-mail —, e a posição não identifica registro nenhum, apenas **ordena parte dentro do
//     agregado**. Daí decorrem as duas diferenças que o leitor apressado toma por violação: o escopo
//     é o **imóvel** e não a empresa, e remover o último cômodo **libera a posição** para o próximo.
//     O reuso é consistente justamente porque nada aponta para posição de cômodo — é o mesmo
//     discriminador da ADR-0014, que exclui o cômodo por não ser referenciável. Numa série da
//     ADR-0015 o reuso seria proibido porque o número foi citado fora do sistema; aqui, não há
//     citação possível a preservar.

/** Os três tipos de imóvel (RN-11). Ordem e valores vêm do contrato, nunca redigitados. */
export const tipoImovel = negocio.enum('tipo_imovel', TIPOS_DE_IMOVEL);

/**
 * As três situações de locação.
 *
 * O enum do banco tem os **três** valores, embora a entrada da API aceite só dois: `LOCADO` é
 * produzido pela ativação de contrato, que é fatia seguinte, e a coluna precisa poder guardá-lo. A
 * assimetria mora no contrato (`SITUACOES_INFORMAVEIS`), não aqui.
 */
export const statusLocacao = negocio.enum('status_locacao', SITUACOES_DE_LOCACAO);

/** Os dois tipos de pessoa (RN-11), comuns a locador, locatário e fiador. */
export const tipoPessoa = negocio.enum('tipo_pessoa', TIPOS_DE_PESSOA);

/**
 * Os sete campos de endereço, iguais para imóvel e para os três cadastros de pessoa.
 *
 * É uma **função** que devolve as colunas, e não uma constante compartilhada, porque cada tabela
 * precisa das **próprias** instâncias de construtor de coluna — uma instância partilhada seria
 * atribuída a duas tabelas e a segunda sobrescreveria a primeira. É a mesma forma, e pela mesma
 * razão de fonte única, que `camposDeEndereco()` de `@sysloc/contracts` adota do lado do contrato.
 *
 * `complemento` é o único anulável, exatamente como no contrato.
 */
function camposDeEndereco() {
  return {
    logradouro: text('logradouro').notNull(),
    numero: text('numero').notNull(),
    complemento: text('complemento'),
    bairro: text('bairro').notNull(),
    cidade: text('cidade').notNull(),
    estado: text('estado').notNull(),
    cep: text('cep').notNull(),
  };
}

/**
 * Agrupamento de imóveis — condomínio, edifício, loteamento.
 *
 * É a raiz do agregado de imóveis, e por isso a referência a `identidade.empresa` é **simples**: a
 * tabela apontada não é tenantizada, não tem `empresa_id` a casar. Mesmo caso de
 * `acesso_usuario_app`.
 *
 * `retirado_em` é a marca da exclusão lógica (ADR-0014): nulo enquanto o conjunto está em
 * circulação, o instante da retirada depois. Nada é apagado.
 */
export const conjunto = negocio
  .table(
    'conjunto',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
      nome: text('nome').notNull(),
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      // O alvo da chave estrangeira composta de `imovel`. Redundante com a chave primária quanto à
      // unicidade de `id` — e é essa redundância que o PostgreSQL exige para aceitar a referência
      // ao par.
      unique('conjunto_id_empresa_key').on(tabela.id, tabela.empresaId),
      // A listagem padrão esconde o que saiu de circulação (§12.2): o índice cobre o par que ela
      // filtra, e não `empresa_id` sozinho.
      index('conjunto_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
    ],
  )
  .enableRLS();

/**
 * O imóvel — a entidade central do cadastro.
 *
 * `empresa_id` **não** ganha chave estrangeira própria para `identidade.empresa`: ela seria
 * implicada pela composta abaixo, que só aceita pares já existentes em `conjunto`, e o conjunto já
 * referencia a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação a cada
 * escrita sem recusar nada que esta já não recuse — o mesmo desenho de `acesso_usuario_permissao`.
 *
 * **A unicidade do identificador municipal é TOTAL, e não parcial** (decisão D4 da tech spec): ela
 * alcança também o imóvel retirado de circulação. Uma restrição parcial
 * (`WHERE retirado_em IS NULL`) pareceria mais permissiva e criaria um defeito na direção oposta —
 * dois imóveis passariam a poder ocupar o mesmo identificador, e a **recirculação** do retirado
 * colidiria com o que nasceu depois dele, num ponto em que o usuário não tem como desfazer nada. A
 * ADR-0014 registra a consequência entre os *Cons*: o registro retirado continua ocupando o valor.
 */
export const imovel = negocio
  .table(
    'imovel',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      conjuntoId: uuid('conjunto_id').notNull(),
      nomeImovel: text('nome_imovel').notNull(),
      identificadorMunicipal: text('identificador_municipal').notNull(),
      tipoImovel: tipoImovel('tipo_imovel').notNull(),
      ...camposDeEndereco(),
      /**
       * Sem padrão, de propósito: quem cria o imóvel declara a situação dele. Um padrão escolheria
       * por omissão entre disponível e indisponível, que é decisão do usuário, não do schema —
       * mesmo critério de `efeito` em {@link efeitoPermissao}.
       */
      statusLocacao: statusLocacao('status_locacao').notNull(),
      observacoes: text('observacoes'),
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      unique('imovel_id_empresa_key').on(tabela.id, tabela.empresaId),
      unique('imovel_empresa_identificador_municipal_key').on(
        tabela.empresaId,
        tabela.identificadorMunicipal,
      ),
      // ESTA é a chave estrangeira composta da ADR-0008. Ela recusa, no banco, apontar um imóvel da
      // empresa A para um conjunto da empresa B: o par `(conjunto_id, empresa_id)` teria de existir
      // em `conjunto (id, empresa_id)`, e não existe. É recusa ESTRUTURAL — nenhuma validação de
      // aplicação é consultada no caminho.
      foreignKey({
        name: 'imovel_conjunto_empresa_fkey',
        columns: [tabela.conjuntoId, tabela.empresaId],
        foreignColumns: [conjunto.id, conjunto.empresaId],
      }),
      index('imovel_empresa_conjunto_idx').on(tabela.empresaId, tabela.conjuntoId),
      index('imovel_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
    ],
  )
  .enableRLS();

/**
 * Cômodo — **detalhe de composição do imóvel**, e não entidade de cadastro própria.
 *
 * ---------------------------------------------------------------------------
 * A coluna que NÃO existe aqui, e a ausência é a decisão
 * ---------------------------------------------------------------------------
 *
 * Não há `retirado_em`. A ADR-0014 exclui o cômodo **nominalmente** do alcance da exclusão lógica:
 * o discriminador dela é *ser referenciável*, e nada aponta para cômodo — corrigir a planta é
 * remover a parte, não retirar um cadastro de circulação. Não há leitura do passado a preservar.
 *
 * A **ausência** da coluna é o que torna a decisão verificável: o CT-317 consulta o catálogo e
 * afirma que ela não está lá. Acrescentá-la "por simetria" com as outras cinco desfaria a decisão
 * em silêncio, e a guarda de cobertura não acusaria — ela não cobra `retirado_em` de ninguém.
 *
 * `metragem` é `NOT NULL DEFAULT 0` porque a RN-02 diz que metragem ausente **vale zero**: o
 * contrato já aplica o padrão na entrada, e o `NOT NULL` é o que impede que um caminho futuro grave
 * a ausência como nulo — a soma que produz a metragem total do imóvel teria de decidir de novo o
 * que fazer com ela. O `check` repete no banco o piso que o contrato declara.
 */
export const comodo = negocio
  .table(
    'comodo',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      imovelId: uuid('imovel_id').notNull(),
      nomeComodo: text('nome_comodo').notNull(),
      metragem: numeric('metragem', { precision: 10, scale: 2 }).notNull().default('0'),
      /**
       * Ordem do cômodo dentro do imóvel. Atribuída pelo servidor, nunca informada pelo cliente —
       * aceitá-la daria a ele o poder de colidir com a `unique(imovel_id, posicao)` de outro cômodo.
       *
       * **Não é série no sentido da ADR-0015**, apesar de ser sequencial e atribuída pelo servidor:
       * ela ordena parte dentro do agregado, não identifica registro citável fora do sistema. Ver o
       * bloco da ADR-0015 no cabeçalho desta seção — é lá que a distinção está por extenso, com a
       * razão de o escopo ser o imóvel e de a última posição poder ser reusada.
       */
      posicao: integer('posicao').notNull(),
      observacoes: text('observacoes'),
    },
    (tabela) => [
      unique('comodo_id_empresa_key').on(tabela.id, tabela.empresaId),
      // Dois cômodos do mesmo imóvel não ocupam a mesma posição. `empresa_id` fica FORA do par de
      // propósito: ele é funcionalmente determinado por `imovel_id`, que a chave estrangeira
      // composta abaixo amarra a um único imóvel — e um imóvel pertence a uma empresa só.
      // Acrescentá-lo alargaria a chave sem recusar nada a mais. Mesmo desenho de
      // `acesso_usuario_permissao_acesso_tipo_chave_key`.
      unique('comodo_imovel_posicao_key').on(tabela.imovelId, tabela.posicao),
      foreignKey({
        name: 'comodo_imovel_empresa_fkey',
        columns: [tabela.imovelId, tabela.empresaId],
        foreignColumns: [imovel.id, imovel.empresaId],
      }),
      check('comodo_metragem_nao_negativa_chk', sql`${tabela.metragem} >= 0`),
      index('comodo_empresa_imovel_posicao_idx').on(
        tabela.empresaId,
        tabela.imovelId,
        tabela.posicao,
      ),
    ],
  )
  .enableRLS();

/**
 * As colunas de um cadastro de pessoa — locador, locatário e fiador.
 *
 * As três tabelas têm a **mesma forma**: o que as separa é a rota e o papel, não o corpo (a mesma
 * pessoa do mundo pode existir nos três papéis, e o documento é único **por papel** dentro da
 * empresa). Escrever quinze colunas três vezes criaria três fontes do mesmo fato, e a primeira
 * emenda a uma delas já as faria divergir — é a razão pela qual `@sysloc/contracts` tem **um**
 * `esquemaDePessoaNova` para os três.
 *
 * As restrições ficam de fora desta função, e não é descuido: cada tabela nomeia as suas com o
 * próprio nome, e é esse nome que a resposta de erro do PostgreSQL devolve — derivá-lo por
 * interpolação tornaria o nome ilegível no ponto em que ele importa (o `grep` que responde "quem
 * recusou esta escrita?").
 */
function camposDeCadastroDePessoa() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id),
    nome: text('nome').notNull(),
    tipoPessoa: tipoPessoa('tipo_pessoa').notNull(),
    /** Guardado em **dígitos**, sem máscara (§6.2) — é o contrato que a remove na entrada. */
    documentoPrincipal: text('documento_principal').notNull(),
    /** Anulável: pessoa jurídica não tem um. */
    rg: text('rg'),
    email: text('email').notNull(),
    telefone: text('telefone').notNull(),
    ...camposDeEndereco(),
    retiradoEm: timestamp('retirado_em', { withTimezone: true }),
  };
}

/**
 * Locador — quem cede o imóvel.
 *
 * A unicidade do documento é **total**, alcançando o retirado de circulação, pela mesma razão
 * escrita no cabeçalho de {@link imovel}: parcial, a recirculação colidiria.
 */
export const locador = negocio
  .table('locador', camposDeCadastroDePessoa(), (tabela) => [
    unique('locador_id_empresa_key').on(tabela.id, tabela.empresaId),
    unique('locador_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
    index('locador_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
  ])
  .enableRLS();

/** Locatário — quem ocupa o imóvel. Mesma forma do locador; ver {@link camposDeCadastroDePessoa}. */
export const locatario = negocio
  .table('locatario', camposDeCadastroDePessoa(), (tabela) => [
    unique('locatario_id_empresa_key').on(tabela.id, tabela.empresaId),
    unique('locatario_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
    index('locatario_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
  ])
  .enableRLS();

/** Fiador — quem garante o contrato. Mesma forma do locador; ver {@link camposDeCadastroDePessoa}. */
export const fiador = negocio
  .table('fiador', camposDeCadastroDePessoa(), (tabela) => [
    unique('fiador_id_empresa_key').on(tabela.id, tabela.empresaId),
    unique('fiador_empresa_documento_key').on(tabela.empresaId, tabela.documentoPrincipal),
    index('fiador_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
  ])
  .enableRLS();

// ===========================================================================
// O contrato de locação — a primeira entidade com série declarada e ciclo governado
// ===========================================================================

/**
 * Os quatro estados do contrato (RD-02). Ordem e valores vêm do contrato, **nunca redigitados**.
 *
 * A direção da dependência é a mesma dos três enums do cadastro, e pela mesma razão (ADR-0016):
 * redigitar os literais seria a segunda fonte do mesmo fato, e o dia em que o contrato ganhasse um
 * estado o banco o recusaria sem que nada acusasse antes da primeira gravação em operação.
 *
 * A ORDEM é conteúdo, e não estética: um enum do PostgreSQL guarda a ordem dos rótulos, e é ela que
 * governa comparação e ordenação do tipo. Reordenar aqui mudaria o significado de `ORDER BY status`
 * sem tocar em consulta nenhuma.
 */
export const statusContrato = negocio.enum('status_contrato', ESTADOS_DO_CONTRATO);

/**
 * O contrato de locação.
 *
 * `empresa_id` **não** ganha chave estrangeira própria para `identidade.empresa`: ela seria
 * implicada pelas três compostas abaixo, que só aceitam pares já existentes nos pais, e os pais já
 * referenciam a empresa. Uma segunda restrição sobre a mesma coluna custaria uma verificação a cada
 * escrita sem recusar nada que estas já não recusem — o mesmo desenho de {@link imovel}.
 *
 * `data_fim_locacao` e `valor_total_contrato` são **anuláveis** porque são derivados na ativação
 * (RD-10): o contrato nasce `RASCUNHO` com os dois nulos, e declará-los obrigatórios obrigaria a
 * criação a inventar valores que só a ativação decide.
 *
 * `gerar_cobrancas_automaticamente` é `NOT NULL DEFAULT true`, mesmo desenho de `comodo.metragem`: o
 * contrato já aplica o padrão na entrada, e o `NOT NULL` é o que impede um caminho futuro de gravar
 * a ausência como nulo — quem lesse a coluna teria de decidir de novo o que fazer com ela.
 *
 * **A unicidade do código é TOTAL, e não parcial**: ela alcança o contrato retirado de circulação,
 * pela mesma razão escrita no cabeçalho de {@link imovel} para o identificador municipal. Parcial, a
 * recirculação de um retirado colidiria com o que nasceu depois dele — e aqui o preço seria maior,
 * porque o código é a referência citada fora do sistema que a ADR-0015 existe para manter estável.
 */
export const contrato = negocio
  .table(
    'contrato',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      /**
       * A chave **exposta** (ADR-0017): o contrato tem série declarada, então o UUID não trafega.
       *
       * O valor é emitido pelas duas funções `SECURITY DEFINER` de
       * `migracoes/0008_seguranca_contrato.sql`, com escopo `(empresa, ano)` e avanço fora do
       * desfazimento (ADR-0020) — nada disso é declarável aqui. O que esta coluna traz é o lugar do
       * número e, com a restrição abaixo, a unicidade que o torna referência estável.
       */
      codigo: text('codigo').notNull(),
      imovelId: uuid('imovel_id').notNull(),
      locadorId: uuid('locador_id').notNull(),
      locatarioId: uuid('locatario_id').notNull(),
      /**
       * Sem padrão, de propósito: quem cria o contrato declara o estado dele — o serviço grava
       * `RASCUNHO`. Um padrão escolheria por omissão o ponto de partida do ciclo de vida, que é
       * decisão de domínio e não do schema. Mesmo critério de `status_locacao` em {@link imovel}.
       */
      status: statusContrato('status').notNull(),
      /**
       * Data de calendário, e não instante: o valor viaja como `YYYY-MM-DD` da consulta até o JSON,
       * sem passar por `Date` com fuso (§6.2). O `mode` padrão de `date()` é `'string'`, que é
       * exatamente isso — trocá-lo por `'date'` reintroduziria o fuso no caminho.
       */
      dataInicioLocacao: date('data_inicio_locacao').notNull(),
      prazoMeses: integer('prazo_meses').notNull(),
      /** Dinheiro em `numeric(15,2)`, nunca ponto flutuante — invariante 4 do projeto. */
      valorMensal: numeric('valor_mensal', { precision: 15, scale: 2 }).notNull(),
      diaVencimento: integer('dia_vencimento').notNull(),
      /** Anulável: derivado na ativação (RD-10). */
      dataFimLocacao: date('data_fim_locacao'),
      /** Anulável: derivado na ativação (RD-10). */
      valorTotalContrato: numeric('valor_total_contrato', { precision: 15, scale: 2 }),
      gerarCobrancasAutomaticamente: boolean('gerar_cobrancas_automaticamente')
        .notNull()
        .default(true),
      /** Guarda **caminho**, nunca bytes (§7.2). */
      pdfContratoArquivo: text('pdf_contrato_arquivo'),
      retiradoEm: timestamp('retirado_em', { withTimezone: true }),
    },
    (tabela) => [
      // O alvo das chaves estrangeiras compostas de `contrato_fiador`, e o que a guarda de cobertura
      // de `src/catalogo.ts` cobra de toda tabela deste schema.
      unique('contrato_id_empresa_key').on(tabela.id, tabela.empresaId),
      unique('contrato_empresa_codigo_key').on(tabela.empresaId, tabela.codigo),
      // As TRÊS chaves estrangeiras compostas da ADR-0008. Cada uma recusa, no banco, apontar um
      // contrato da empresa A para um imóvel, um locador ou um locatário da empresa B: o par
      // `(alheio_id, empresa_id)` teria de existir no pai, e não existe. É recusa ESTRUTURAL —
      // nenhuma validação de aplicação é consultada no caminho.
      foreignKey({
        name: 'contrato_imovel_empresa_fkey',
        columns: [tabela.imovelId, tabela.empresaId],
        foreignColumns: [imovel.id, imovel.empresaId],
      }),
      foreignKey({
        name: 'contrato_locador_empresa_fkey',
        columns: [tabela.locadorId, tabela.empresaId],
        foreignColumns: [locador.id, locador.empresaId],
      }),
      foreignKey({
        name: 'contrato_locatario_empresa_fkey',
        columns: [tabela.locatarioId, tabela.empresaId],
        foreignColumns: [locatario.id, locatario.empresaId],
      }),
      // Os três limites de RD-08 repetidos no banco. O contrato de entrada já os declara, e é ele
      // que produz a recusa com nome de campo; estes são o que impede um caminho de escrita futuro
      // — carga, correção manual, fatia nova — de gravar o que a regra não admite.
      check('contrato_dia_vencimento_chk', sql`${tabela.diaVencimento} BETWEEN 1 AND 28`),
      check('contrato_prazo_positivo_chk', sql`${tabela.prazoMeses} > 0`),
      check('contrato_valor_mensal_positivo_chk', sql`${tabela.valorMensal} > 0`),
      // ---------------------------------------------------------------------------
      // A vigência única por imóvel — ÍNDICE PARCIAL, e a forma NÃO é escolha de estilo
      // ---------------------------------------------------------------------------
      //
      // É `uniqueIndex(...).where(...)`, e não `unique(...)`, porque **o PostgreSQL não admite
      // restrição única parcial**: `ALTER TABLE … ADD CONSTRAINT … UNIQUE (…) WHERE …` não existe na
      // gramática. Só `CREATE UNIQUE INDEX … WHERE` alcança a condição.
      //
      // Quem "corrigir" isto para restrição, por consistência com as vizinhas, **remove a condição**
      // — e a tabela passa a impedir dois contratos em QUALQUER estado sobre o mesmo imóvel, o que
      // quebra montar contrato novo depois de cancelar o anterior, que é o fluxo normal do negócio.
      // A conversão é silenciosa: o schema fica "mais uniforme" e o defeito só aparece no primeiro
      // recontrato.
      //
      // Ele é o MECANISMO da RN-09, não uma otimização: é o que torna a dupla locação
      // irrepresentável, pela mesma escolha estrutural do isolamento entre empresas — recusa do
      // banco, não conferência da aplicação.
      //
      // `empresa_id` fica FORA do índice de propósito: ele é funcionalmente determinado por
      // `imovel_id`, que a chave estrangeira composta acima amarra a um único imóvel — e um imóvel
      // pertence a uma empresa só. Acrescentá-lo alargaria a chave sem recusar nada a mais. Mesmo
      // desenho de `comodo_imovel_posicao_key`.
      //
      // Ele **não** satisfaz a guarda de cobertura, e não precisa: ela cobra restrição NOMEADA sobre
      // `(id, empresa_id)`, que é `contrato_id_empresa_key`. As duas coexistem sem se substituir.
      //
      // DECISÃO FECHADA — T3 · 2026-08-09
      // O QUÊ: a vigência única por imóvel é ÍNDICE ÚNICO PARCIAL
      //        (`uniqueIndex(...).where(sql`status = 'ATIVO'`)`), e não `unique(...)`.
      // POR QUÊ: o PostgreSQL não admite restrição única parcial — não existe `ADD CONSTRAINT …
      //          UNIQUE (…) WHERE …`. Converter para restrição, "por consistência" com as seis
      //          vizinhas deste arquivo, **remove a condição junto**, e a tabela passa a impedir dois
      //          contratos em QUALQUER estado sobre o mesmo imóvel — o que quebra montar contrato
      //          novo depois de cancelar o anterior, que é o fluxo normal do negócio. A conversão é
      //          silenciosa: o schema fica mais uniforme e o defeito só aparece no primeiro
      //          recontrato, em operação.
      // REVERTER EXIGE: exibir uma forma de restrição do PostgreSQL que aceite predicado parcial —
      //                 ou provar que impedir dois contratos em qualquer estado sobre o mesmo imóvel
      //                 é a regra pretendida, o que contraria a RN-09 e o ciclo de vida da ADR-0019.
      uniqueIndex('contrato_imovel_vigente_uidx').on(tabela.imovelId).where(sql`status = 'ATIVO'`),
      // A listagem padrão esconde o que saiu de circulação (§12.2): o índice cobre o par que ela
      // filtra, e não `empresa_id` sozinho.
      index('contrato_empresa_retirado_idx').on(tabela.empresaId, tabela.retiradoEm),
      index('contrato_empresa_imovel_idx').on(tabela.empresaId, tabela.imovelId),
    ],
  )
  .enableRLS();

/**
 * Vínculo entre contrato e fiador — **vínculo puro**, e não entidade de cadastro.
 *
 * ---------------------------------------------------------------------------
 * A coluna que NÃO existe aqui, e a ausência é a decisão
 * ---------------------------------------------------------------------------
 *
 * Não há `retirado_em`. A ADR-0014 exclui do alcance da exclusão lógica *"vínculo ou concessão, cuja
 * linha representa estado de relacionamento"*, e o discriminador dela é **ser referenciável** —
 * nada aponta para uma linha de `contrato_fiador`. Substituir a lista de fiadores de um rascunho
 * **remove** e **insere** linhas, que é o mecanismo legítimo, o mesmo do ajuste bidirecional da
 * matriz de permissões (§7.5).
 *
 * A **ausência** da coluna é o que torna a decisão verificável: o CT-430 consulta o catálogo e
 * afirma que ela não está lá, com as seis entidades de cadastro como controle positivo.
 * Acrescentá-la "por simetria" com elas desfaria a decisão em silêncio, e a guarda de cobertura
 * **não acusaria** — ela não cobra `retirado_em` de ninguém. É o mesmo desenho, e a mesma razão, do
 * que {@link comodo} já registra.
 *
 * A tabela não tem coluna livre alguma além das quatro: medido no sistema antigo, a tabela-filha
 * `Fiadores` tem **um único campo**, `fiador` — nenhum percentual, nenhuma data, nenhuma ordem de
 * negócio. Inventar uma aqui seria inventar regra que ninguém declarou.
 */
export const contratoFiador = negocio
  .table(
    'contrato_fiador',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id').notNull(),
      contratoId: uuid('contrato_id').notNull(),
      fiadorId: uuid('fiador_id').notNull(),
    },
    (tabela) => [
      unique('contrato_fiador_id_empresa_key').on(tabela.id, tabela.empresaId),
      // O mesmo fiador não entra duas vezes no mesmo contrato. `empresa_id` fica FORA do par pela
      // mesma razão do índice de vigência: ele é funcionalmente determinado por `contrato_id`.
      unique('contrato_fiador_contrato_fiador_key').on(tabela.contratoId, tabela.fiadorId),
      // As duas chaves estrangeiras compostas da ADR-0008 — ver o comentário gêmeo em
      // {@link contrato}.
      foreignKey({
        name: 'contrato_fiador_contrato_empresa_fkey',
        columns: [tabela.contratoId, tabela.empresaId],
        foreignColumns: [contrato.id, contrato.empresaId],
      }),
      foreignKey({
        name: 'contrato_fiador_fiador_empresa_fkey',
        columns: [tabela.fiadorId, tabela.empresaId],
        foreignColumns: [fiador.id, fiador.empresaId],
      }),
      index('contrato_fiador_empresa_contrato_idx').on(tabela.empresaId, tabela.contratoId),
    ],
  )
  .enableRLS();
