/**
 * Acesso tipado **restrito ao schema `identidade`** — o segundo, e último, caminho público para
 * dado deste pacote.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe (§3.3 da tech spec, invariante 1)
 * ---------------------------------------------------------------------------
 *
 * A fronteira do pacote diz que `@sysloc/db` "exporta a unidade de trabalho, o schema e **um acesso
 * tipado restrito ao schema `identidade`**; **não exporta** cliente, reserva de conexões nem
 * executor com alcance a `negocio`". A unidade de trabalho (T3) entrega o primeiro; este módulo
 * entrega o terceiro, e a razão está escrita na própria §3.3:
 *
 * > o adaptador oficial tem assinatura `drizzleAdapter(db, config)` e **exige a instância** para
 * > operar as tabelas de identidade — que não são tenantizadas por definição (ADR-0009). Sem ele, a
 * > autenticação não é montável.
 *
 * A alternativa — `@sysloc/auth` (ou o `apps/api`) abrir a própria conexão — foi rejeitada pela
 * mesma razão que mantém `conexao.ts` fora do índice: seria o segundo caminho para o dado que a
 * ADR-0008 proíbe, e o caminho por onde `negocio` voltaria a ser alcançável sem contexto de tenant.
 *
 * ---------------------------------------------------------------------------
 * O que a restrição alcança, e o que ela NÃO alcança
 * ---------------------------------------------------------------------------
 *
 * O executor devolvido é declarado sobre `TabelasDeIdentidade`, que enumera **apenas** as sete
 * tabelas de `identidade`. Três consequências valem por escrito, e a terceira é fronteira declarada
 * em vez de absoluto falso:
 *
 * 1. **Alcança, e só a partir da T6 de verdade**: o cliente cru não viaja no objeto devolvido.
 *    Declarar o tipo sem `$client` **não bastava** — `drizzle-orm/postgres-js/driver.js` faz
 *    `db.$client = client` incondicionalmente, e a propriedade sobrevive à declaração de tipo: uma
 *    conversão de uma linha (`(acesso.identidade as { $client: Sql }).$client`) devolvia o cliente
 *    `postgres.js` inteiro — `unsafe`, `begin`, `reserve`, `listen` — a qualquer pacote que dependa
 *    de `@sysloc/db`. Por isso a fábrica **remove a propriedade** antes de devolver o acesso (ver
 *    `abrirAcessoAIdentidade`), e o CT-012 passou a auditar **o objeto devolvido**, não só o valor
 *    exportado.
 * 2. **Alcança**: `banco.query.<algo>` só oferece as sete tabelas, e nenhuma delas é de `negocio`.
 * 3. **Não alcança**: `banco.execute(sql\`select … from negocio.…\`)` compila, porque SQL literal
 *    não passa pelo sistema de tipos. Isso é o que a restrição de tipo pode dar — a garantia vale
 *    sobre o construtor de consulta, não sobre texto de SQL. O que fecha o restante é a ausência de
 *    concessão: o schema `negocio` é alcançável, mas cada linha continua sujeita à política de RLS,
 *    que sem `SET LOCAL app.empresa_id` não casa nada. A porta única para dado de negócio segue
 *    sendo a unidade de trabalho — este acesso não a duplica, porque o que ele destrava é
 *    `identidade`, e `identidade` nunca teve política a contornar (ADR-0009).
 *
 * ---------------------------------------------------------------------------
 * Reserva própria, e por quê
 * ---------------------------------------------------------------------------
 *
 * Este acesso abre a própria reserva em vez de compartilhar a de `abrirAcessoAoBanco`. Fundi-las
 * exigiria acrescentar um executor ao objeto `AcessoAoBanco`, cujo docblock declara, e a T3 fechou,
 * que ele NÃO tem executor algum — e um executor lá dentro seria escolhido por engano no primeiro
 * `acesso.` seguido de autocompletar, que é a classe de defeito que aquele confinamento evita.
 * Duas reservas pequenas custam menos do que reabrir aquela decisão.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { abrirConexao } from './conexao.js';
import {
  conta,
  doisFatores,
  empresa,
  sessao,
  tentativaLogin,
  usuario,
  verificacao,
} from './esquema/identidade.js';
import type { OpcoesDeAcessoAoBanco } from './unidade-de-trabalho.js';

/**
 * As sete tabelas de `identidade`, e nada mais.
 *
 * Enumeradas à mão, e não por `import * as`: o namespace do módulo também carrega o objeto de
 * schema e os dois tipos enumerados, e entregá-lo inteiro ao executor faria o conjunto crescer
 * sozinho a cada símbolo novo daquele arquivo. A lista explícita é o que torna "enumera apenas as
 * tabelas de identidade" uma afirmação verificável.
 */
const TABELAS_DE_IDENTIDADE = {
  empresa,
  usuario,
  conta,
  sessao,
  verificacao,
  doisFatores,
  tentativaLogin,
} as const;

/** O conjunto de tabelas sobre o qual o executor restrito é declarado. */
export type TabelasDeIdentidade = typeof TABELAS_DE_IDENTIDADE;

/**
 * Executor com alcance declarado às tabelas de `identidade`.
 *
 * Sem `$client` de propósito — ver o item 1 do cabeçalho. A ausência é dupla, e as duas metades são
 * necessárias: aqui, no tipo, para que o alcance não seja **escrevível**; e na fábrica, no valor,
 * para que ele não seja **alcançável** por conversão.
 */
export type BancoDeIdentidade = PostgresJsDatabase<TabelasDeIdentidade>;

/** O acesso a `identidade` que o pacote publica. */
export interface AcessoAIdentidade {
  /** O executor restrito. É ele que a instância do arcabouço de identidade recebe. */
  readonly identidade: BancoDeIdentidade;
  /** Encerra a reserva. Quem abriu é dono do recurso, inclusive no caminho de falha. */
  encerrar(): Promise<void>;
}

/**
 * Abre o acesso restrito a `identidade`.
 *
 * Mesma forma de `abrirAcessoAoBanco`: fábrica em vez de estado de módulo, porque estado global de
 * conexão exige um caminho de reconfiguração, e todo caminho de reconfiguração é um caminho pelo
 * qual o acesso passa a apontar para outro banco no meio da execução.
 */
export function abrirAcessoAIdentidade(opcoes: OpcoesDeAcessoAoBanco): AcessoAIdentidade {
  // O condicional, e não `{ maximoDeConexoes: opcoes.maximoDeConexoes }`: com
  // `exactOptionalPropertyTypes`, passar a propriedade com valor indefinido não é o mesmo que não
  // passá-la — e é a segunda forma que preserva o padrão da biblioteca.
  const sql = abrirConexao(
    opcoes.cadeiaDeConexao,
    opcoes.maximoDeConexoes === undefined ? {} : { maximoDeConexoes: opcoes.maximoDeConexoes },
  );

  const identidade = drizzle(sql, { schema: TABELAS_DE_IDENTIDADE });

  // DECISÃO FECHADA — T6 / Gate 2 (P1) · 2026-08-02
  // O QUÊ: a propriedade `$client` é removida do executor ANTES de ele sair desta função. É o
  //        único ponto em que um `BancoDeIdentidade` nasce, e é aqui que ele deixa de carregar o
  //        cliente cru.
  // POR QUÊ: `drizzle-orm/postgres-js/driver.js` faz `db.$client = client` incondicionalmente. O
  //          tipo publicado omitia a propriedade, mas o VALOR a carregava — e o Gate 2 mostrou que
  //          uma conversão de uma linha bastava para qualquer pacote dependente alcançar `unsafe`,
  //          `begin`, `reserve` e `listen`. Com o executor cru em mãos, um `set app.empresa_id`
  //          arbitrário seguido de leitura em `negocio` devolve dado alheio: a RLS continua
  //          imposta, mas o contexto que ela consome passa a poder vir de qualquer lugar — que é
  //          exatamente o que a ADR-0008 e a unidade de trabalho existem para impedir.
  // REVERTER EXIGE: provar que nenhum consumidor de `@sysloc/db` alcança o cliente cru por outro
  //                 caminho — e o CT-012 de `test/unidade-de-trabalho.spec.ts` audita o objeto
  //                 devolvido por cada fábrica de acesso justamente para que a prova exista.
  //
  // Remover não afeta o executor: nem `drizzle-orm` nem `@better-auth/drizzle-adapter` leem
  // `$client` em lugar nenhum (verificado no pacote publicado), e a sessão interna do drizzle
  // guarda o cliente à parte — é ela, e não esta propriedade, que executa as instruções.
  Reflect.deleteProperty(identidade, '$client');

  return {
    identidade,
    encerrar: () => sql.end(),
  };
}
