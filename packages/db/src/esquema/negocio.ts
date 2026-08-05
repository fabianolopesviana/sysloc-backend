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
 * `USING`/`WITH CHECK` vivem em `migracoes/0001_seguranca.sql`, escrito à mão. O gerador de
 * migração declara RLS e a política que se declare aqui, mas **não emite `FORCE`** — e sem `FORCE`
 * o dono das tabelas ignora a política, o que faria a suíte de isolamento ficar verde sem provar
 * nada (ADR-0009, seção Neutros). A autoridade sobre o estado real é a consulta ao catálogo, não a
 * declaração: é a guarda da T4 que reprova a tabela que nasça sem qualquer uma das propriedades.
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

import { foreignKey, index, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
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
