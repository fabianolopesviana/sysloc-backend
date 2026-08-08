/**
 * A empresa do contexto, **na expressão literal das políticas** — o lar único do fragmento.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE
 * ---------------------------------------------------------------------------
 *
 * Este fragmento tinha **três** definições byte a byte idênticas — em {@link ./pessoa.ts},
 * {@link ./conjunto.ts} e {@link ./imovel.ts} — e a escrita de cômodo seria a quarta. Ele não é
 * conveniência de quem escreve consulta: é a **transcrição literal** da expressão que as políticas
 * de `migracoes/0006_seguranca_dominio.sql` avaliam em `USING` e em `WITH CHECK`, e a razão de ela
 * aparecer na aplicação está registrada abaixo. Quatro transcrições da mesma expressão são quatro
 * lugares livres para divergir, e a divergência **não faz barulho** — ela aparece como uma escrita
 * recusada pela política num caminho só, meses depois.
 *
 * É o mesmo desenho, e a mesma razão, de `apps/api/src/comum/validacao.ts` e de
 * `apps/api/src/comum/esquema-de-erro.ts`, que deram lar único a símbolos destinados a N cópias na
 * borda. Aqui a decisão é a metade do **débito D7** cujo dono declarado é a T7 da fatia
 * `cadastro-de-imoveis-e-pessoas`.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO É FILTRO — e a distinção é a ADR-0008 inteira
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma leitura o aplica.** As tabelas de `negocio` têm política com RLS **forçada**, e um
 * segundo caminho para o mesmo recorte é exatamente a "defesa em profundidade" que a `Decision` da
 * ADR-0008 rejeita por escrito: dois caminhos para o mesmo dado divergem com o tempo, e o filtro
 * redundante ensina a confiar nele.
 *
 * Ele existe para a **escrita**, e ali não duplica caminho nenhum: `empresa_id` é `NOT NULL` e não
 * tem padrão, de modo que a instrução precisa **propor** um valor — e o único valor legítimo é o
 * que a própria política leria. Em `identidade.usuario`, que por decisão da ADR-0009 nunca teve
 * política, ele não duplica coisa alguma: ali ele **é** o caminho.
 *
 * ---------------------------------------------------------------------------
 * A FORMA é conteúdo — leia antes de "simplificar"
 * ---------------------------------------------------------------------------
 *
 * É um **fragmento** do driver (`tx`...``), e não uma cadeia interpolada: ele é montado pelo mesmo
 * mecanismo da consulta que o hospeda, e **nada aqui vem de fora** — é constante deste módulo, sem
 * interpolação alguma. A extração não abre superfície de SQL nova.
 *
 * O segundo argumento `true` de `current_setting` faz a variável **não fixada** devolver nulo em vez
 * de levantar erro; o `nullif(…, '')` trata o outro caminho, o da variável fixada em cadeia vazia.
 * Nos dois casos a comparação vira `empresa_id = NULL`, que não casa linha alguma — a mesma escolha,
 * e a mesma razão, da migração: **contexto ausente resulta em vazio, nunca em dado alheio.**
 */

import type { Fragment, TransactionSql } from 'postgres';

/**
 * O identificador da empresa do contexto corrente, como as políticas o leem.
 *
 * Usado **apenas** na cláusula de valores de um `INSERT`, para propor o `empresa_id` que o
 * `WITH CHECK` da política vai aceitar ou recusar. Ver o cabeçalho deste arquivo para por que ele
 * nunca aparece num `WHERE`.
 */
export function empresaDoContexto(tx: TransactionSql): Fragment {
  return tx`nullif(current_setting('app.empresa_id', true), '')::uuid`;
}
