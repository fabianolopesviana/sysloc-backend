/**
 * Configuração de mora — a **porta única** de leitura e escrita da política de multa e juros de uma
 * empresa.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS DUAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./cobranca.ts}, {@link ./contrato.ts} e {@link ./imovel.ts} já registram: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de aplicação com o
 * executor da unidade de trabalho em mãos escreve `negocio.configuracao_de_mora` numa cadeia sem
 * importar nada de proibido, e o alcance às tabelas do domínio deixa de ser enumerável.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As duas funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * A ESCRITA É UM `upsert` DE UM COMANDO SÓ — e a alternativa é corrida disfarçada
 * ---------------------------------------------------------------------------
 *
 * {@link gravarConfiguracaoDeMora} é `INSERT … ON CONFLICT (empresa_id) DO UPDATE`, **uma só ida ao
 * banco**, sem leitura prévia. A forma intuitiva — ler, decidir entre `INSERT` e `UPDATE`, gravar —
 * passaria em todos os casos felizes e perderia escrita sob concorrência: entre o `SELECT` que não
 * achou e o `INSERT`, outra transação grava, e a empresa passaria a ter duas políticas com nada que
 * decida qual vale. É a mesma lei que governa toda unicidade desta base: **quem impede é a
 * restrição, e não a leitura** — aqui `configuracao_de_mora_empresa_key`, que existe para ser o
 * alvo do `ON CONFLICT` e não como índice de leitura (ver o cabeçalho da tabela em
 * `./esquema/negocio.ts`).
 *
 * A semântica resultante é **última escrita vence**, e ela é a correta para esta entidade: o corpo
 * do `PUT` é completo e sem campo opcional, de modo que duas escritas concorrentes descrevem, cada
 * uma, um estado final inteiro — não há fusão parcial possível a que se perder.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA NÃO ESCREVE, e a ausência de linha vira ZEROS (RD-21)
 * ---------------------------------------------------------------------------
 *
 * {@link lerConfiguracaoDeMora} não cria linha alguma. A empresa que nunca configurou devolve
 * {@link POLITICA_AUSENTE}, e a ausência de linha e a política explicitamente zerada passam a ser
 * **a mesma coisa publicada**. As duas metades da regra têm razão própria:
 *
 *   * **não criar** — porque uma leitura que grava é uma leitura que muda o que ela mede, e o `GET`
 *     da borda deixaria de ser seguro de repetir;
 *   * **zerar em vez de faltar** — porque é o que faz a leitura concordar com a **apuração**: a view
 *     `negocio.cobranca_derivada` usa `LEFT JOIN` com `COALESCE(…, 0)` (RD-08), de modo que a
 *     empresa sem linha já apura mora zero. Um `undefined` propagado daqui obrigaria cada leitor a
 *     decidir de novo o que fazer com ele, e o primeiro que decidisse diferente faria a rota
 *     discordar da view sobre o mesmo fato.
 *
 * Os zeros são compostos **aqui**, e não por um `COALESCE` sobre uma junção artificial: o que falta
 * é a linha inteira, e não um valor dentro dela. As colunas são `NOT NULL DEFAULT 0`, então nulo em
 * coluna é irrepresentável — traduzir a ausência da linha é a única tradução que sobra, e ela é
 * mais legível como o ramo explícito abaixo.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma das duas funções recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação.** A tabela nasce com RLS **forçada**, e não há aqui um
 * `WHERE empresa_id = …` — a defesa em profundidade que a `Decision` da ADR-0008 rejeita por
 * escrito. A leitura alcança, no máximo, a linha da empresa do contexto; a escrita **propõe** o
 * `empresa_id` porque a coluna é `NOT NULL` sem padrão, e o valor sai de {@link empresaDoContexto},
 * que é a expressão literal das políticas avaliada dentro da própria instrução.
 *
 * O `ON CONFLICT` também é escopado pela política, e não por uma cláusula: a única linha com que a
 * inserção pode colidir é a da empresa do contexto — é a `UNIQUE (empresa_id)` sobre o valor que a
 * própria expressão acabou de propor.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA APURAÇÃO DE MORA EXISTE AQUI (ADR-0022, ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * Este arquivo guarda e devolve **percentuais**, e não calcula multa, juros nem total. Quem os apura
 * é a view, sobre `numeric`, e a razão está por extenso no cabeçalho de {@link ./cobranca.ts}:
 * devolver o dinheiro ao ponto flutuante do JavaScript faria `1234.56 * 0.01 / 30 * 17` deixar de
 * ser o que o `numeric` calcula. A única aritmética deste arquivo é a conversão de `numeric` em
 * número na saída, que é transporte e não derivação.
 */

import type { Fragment, TransactionSql } from 'postgres';
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * A política de mora vigente, como a porta a entrega.
 *
 * Não há `id` e não há `empresaId`: o recurso é **singular por empresa** — a `UNIQUE (empresa_id)`
 * garante uma linha só —, de modo que não existe o que identificar, e a coluna de tenant não é
 * publicada. É o mesmo critério de {@link ./cobranca.ts}, onde a ausência de `id` também é decisão e
 * não esquecimento.
 */
export interface ConfiguracaoDeMoraPersistida {
  /** Percentual da multa, aplicado UMA vez sobre o valor original (RD-07). */
  readonly multaPercentual: number;
  /** Percentual de juros **ao mês**, simples, sobre base de mês comercial de 30 dias (RD-07). */
  readonly jurosPercentual: number;
}

/**
 * O que a consulta de fato lê.
 *
 * As duas grandezas `numeric` voltam do driver **em texto**, porque `numeric` não cabe em ponto
 * flutuante sem perda — mesma razão, e mesmo tratamento, de `LinhaBrutaDeCobranca`.
 */
interface LinhaBrutaDaConfiguracao {
  readonly multaPercentual: string;
  readonly jurosPercentual: string;
}

/**
 * A política publicada quando a empresa **nunca configurou** — os dois percentuais em zero (RD-21).
 *
 * Constante nomeada, e não um objeto literal no ponto de retorno: ela é **contrato publicado** — é o
 * corpo que `GET /v1/multa-e-juros` devolve a toda empresa nova —, e ter nome é o que deixa
 * explícito que a ausência de linha tem uma tradução declarada, em vez de parecer um valor de
 * conveniência escolhido na hora.
 *
 * **Congelado — é compartilhado por toda leitura**, no molde de `SEM_FIADORES`
 * ({@link ./contrato.ts}), `SEM_COMODOS` ({@link ./imovel.ts}) e `SEM_IMOVEIS`
 * ({@link ./conjunto.ts}). `lerConfiguracaoDeMora` o devolve **por referência**, e o `readonly` da
 * interface protege só dentro deste pacote: na fronteira do serviço o tipo passa a vir de `z.infer`
 * de `z.number()`, que não o carrega, e o consumidor recebe um alias mutável do objeto de módulo.
 * Uma escrita nele mudaria a política publicada a **toda** empresa que nunca configurou, no processo
 * inteiro — a política de uma empresa vazando para outra por estado compartilhado, que é a classe
 * que a RD-21 e a ADR-0008 fecham no banco. O congelamento age sobre o **valor** e não sobre o tipo,
 * e por isso vale em qualquer camada, independente da anotação que ela enxergue.
 */
const POLITICA_AUSENTE: ConfiguracaoDeMoraPersistida = Object.freeze({
  multaPercentual: 0,
  jurosPercentual: 0,
});

/**
 * A projeção publicada, escrita **uma vez** e reusada pela leitura e pelo `RETURNING` da escrita.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada por `unsafe`: ele é montado pelo mesmo
 * mecanismo da consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo. Mesmo
 * padrão, e mesma justificativa, de `colunasDaCobranca` em {@link ./cobranca.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede duas traduções livres para divergir. E `id` e
 * `empresa_id` **não** estão na lista — o que a porta devolve é o que o contrato publica.
 */
function colunasDaConfiguracao(tx: TransactionSql): Fragment {
  return tx`
    multa_percentual AS "multaPercentual",
    juros_percentual AS "jurosPercentual"
  `;
}

/**
 * A linha crua na política que a porta entrega — **o ponto único** da conversão de `numeric`.
 *
 * `Number(…)` sobre o texto do driver é o que faz os dois percentuais chegarem ao consumidor como
 * número; sem esta função o JSON sairia com `"2.00"` entre aspas e **nada acusaria**. Mesma decisão,
 * e mesma razão medida, de `cobrancaPublicada` em {@link ./cobranca.ts}.
 *
 * Os campos são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna
 * que a projeção venha a ganhar, inclusive `empresa_id`.
 */
function configuracaoPublicada(linha: LinhaBrutaDaConfiguracao): ConfiguracaoDeMoraPersistida {
  return {
    multaPercentual: Number(linha.multaPercentual),
    jurosPercentual: Number(linha.jurosPercentual),
  };
}

/**
 * Lê a política de mora da empresa do contexto, **ou os zeros** quando ela nunca configurou.
 *
 * Ela **não cria linha alguma** — ver o cabeçalho deste arquivo para as duas razões da RD-21. Não há
 * recorte por empresa escrito aqui: a política do banco é quem o faz, e é ela que garante que a
 * consulta alcança no máximo uma linha.
 */
export async function lerConfiguracaoDeMora(
  tx: TransactionSql,
): Promise<ConfiguracaoDeMoraPersistida> {
  const [linha] = await tx<LinhaBrutaDaConfiguracao[]>`
    SELECT ${colunasDaConfiguracao(tx)}
      FROM negocio.configuracao_de_mora
  `;

  return linha === undefined ? POLITICA_AUSENTE : configuracaoPublicada(linha);
}

/**
 * Grava a política de mora da empresa do contexto e devolve a que passou a valer.
 *
 * **Uma só ida ao banco**, sem leitura prévia: `ON CONFLICT (empresa_id) DO UPDATE` é o que torna a
 * escrita atômica e a torna correta sob concorrência. Ver o cabeçalho deste arquivo para por que a
 * forma "ler, decidir, gravar" é corrida disfarçada.
 *
 * A cláusula de conflito nomeia a **coluna**, e não a restrição: é `empresa_id` que decide a
 * identidade da política, e nomear a coluna deixa a intenção legível no ponto — uma linha por
 * empresa. O valor novo vem de `EXCLUDED`, que é a linha que a inserção **teria** gravado: repetir
 * os parâmetros no `SET` daria dois lugares por onde o valor chega, e o segundo poderia divergir.
 *
 * O `RETURNING` é o que dispensa a leitura de volta: o que a rota publica é exatamente o que a
 * instrução gravou, na mesma unidade de trabalho, e não uma segunda consulta que já poderia
 * enxergar outra escrita.
 */
export async function gravarConfiguracaoDeMora(
  tx: TransactionSql,
  dados: ConfiguracaoDeMoraPersistida,
): Promise<ConfiguracaoDeMoraPersistida> {
  const [linha] = await tx<LinhaBrutaDaConfiguracao[]>`
    INSERT INTO negocio.configuracao_de_mora (empresa_id, multa_percentual, juros_percentual)
    VALUES (${empresaDoContexto(tx)}, ${dados.multaPercentual}, ${dados.jurosPercentual})
        ON CONFLICT (empresa_id) DO UPDATE
       SET multa_percentual = EXCLUDED.multa_percentual,
           juros_percentual = EXCLUDED.juros_percentual
     RETURNING ${colunasDaConfiguracao(tx)}
  `;

  if (linha === undefined) {
    // Inalcançável: o `INSERT … ON CONFLICT DO UPDATE … RETURNING` de uma linha ou devolve a linha
    // ou levanta — o `DO UPDATE` sempre atua, diferente de um `DO NOTHING`, que devolveria vazio na
    // colisão. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar
    // dele trocaria uma falha nomeada por um `undefined` viajando como se fosse a política vigente.
    throw new Error('a política de mora foi gravada e a linha não voltou');
  }

  return configuracaoPublicada(linha);
}
