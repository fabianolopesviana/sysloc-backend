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
 * Vínculo de acesso: a pessoa que alcança o sistema de uma empresa.
 *
 * A referência a `identidade.empresa` e a `identidade.usuario` é simples, e não composta, porque as
 * duas tabelas apontadas **não são tenantizadas** — elas não têm `empresa_id` a casar. A referência
 * composta é a forma canônica entre entidades de `negocio`, e é ela que a tabela-filha abaixo usa.
 */
export const acessoUsuarioApp = negocio
  .table(
    'acesso_usuario_app',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      empresaId: uuid('empresa_id')
        .notNull()
        .references(() => empresa.id),
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
    ],
  )
  .enableRLS();

/**
 * Tabela-filha do vínculo de acesso. Nasce **estrutural e vazia**: nenhuma tela ou ação é povoada
 * nesta fatia e nenhuma regra a lê. Ela existe para tornar a chave estrangeira composta verificável
 * com dado real (CA-04) — povoá-la é da fatia seguinte, e antecipar seria construir para um futuro
 * que ainda não foi decidido.
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
    },
    (tabela) => [
      unique('acesso_usuario_permissao_id_empresa_key').on(tabela.id, tabela.empresaId),
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
