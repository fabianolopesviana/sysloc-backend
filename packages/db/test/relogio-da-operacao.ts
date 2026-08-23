/**
 * O relógio da operação **lido do banco** — a casa compartilhada do que a suíte não pode redigitar.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE É LIDO, E NÃO ESCRITO NO ARQUIVO DE TESTE
 * ---------------------------------------------------------------------------
 *
 * O fuso da operação é propriedade do **objeto** que serve o valor (ADR-0026), e o objeto canônico é
 * `negocio.data_corrente_da_operacao()`. Um caso que precise ancorar um instante na hora local — o
 * horário marcado de uma rotina diária, a meia-noite do dia da operação — tem duas opções, e só uma
 * delas prova alguma coisa:
 *
 *   * **redigitar o literal** no arquivo de teste: a asserção passa a concordar com uma cópia
 *     própria, e o caso fica cego justamente à divergência que ele deveria pegar — o SUT poderia
 *     usar UTC, ou um fuso errado, e o esperado escrito à mão erraria junto;
 *   * **ler do corpo da função no catálogo**, que é o que este módulo faz: o esperado passa a vir do
 *     mesmo eixo que a cobrança, a régua e o certificado usam, e um SUT que compusesse o instante em
 *     outro fuso reprova.
 *
 * ---------------------------------------------------------------------------
 * POR QUE NUM ARQUIVO PRÓPRIO
 * ---------------------------------------------------------------------------
 *
 * É a convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`: antes de escrever um
 * acessório de arranjo num arquivo de teste, procura-se a casa compartilhada do diretório (os `.ts`
 * sem `.spec` ao lado, no molde de `./conjuntos.ts`) — *"se existir, importe; se não existir,
 * **crie-a**"*. Ela não existia para o relógio, e nasce aqui.
 *
 * ⚠️ **Medição de 2026-08-23, e ela é a premissa que não deve envelhecer sem ser remedida**: existe
 * **uma** outra declaração deste acessório na suíte deste pacote — a função homônima privada de
 * `./certificado-do-provedor.spec.ts`, escrita na T11 da fatia `fundacao-bancaria`. São **duas**
 * ocorrências, e o Limiar de Três **não** disparou; a primeira task autorizada a abrir aquele
 * arquivo por outra razão deve trocar a cópia de lá por um `import` daqui, e aí a contagem volta a
 * um. Não migre aquele arquivo só por isso: ele não pertence ao escopo desta fatia.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar
 * os tipos dele. Mesma forma, e mesma razão, de `./conjuntos.ts`.
 */

import type { TransactionSql } from 'postgres';

/** O schema e o nome da função canônica do eixo de data — ver {@link lerFusoDaOperacao}. */
const SCHEMA_DA_OPERACAO = 'negocio';
const FUNCAO_DA_DATA_CORRENTE = 'data_corrente_da_operacao';

/** O que se extrai do corpo da função: o fuso nomeado no `AT TIME ZONE`. */
const FUSO_NO_CORPO = /AT TIME ZONE '([^']+)'/;

/**
 * O fuso da operação, **lido do corpo de `negocio.data_corrente_da_operacao()`** no catálogo.
 *
 * Ela **recebe** o executor de quem já abriu a unidade de trabalho, como toda porta deste pacote, e
 * lê apenas catálogo do PostgreSQL — nenhuma tabela de negócio, nenhum recorte por empresa.
 *
 * A ausência do fuso no corpo é falha **nomeada**, e não `undefined` silencioso: um esperado montado
 * sobre fuso indefinido produziria uma comparação que passa por acaso, que é o defeito que este
 * módulo existe para não ter.
 */
export async function lerFusoDaOperacao(tx: TransactionSql): Promise<string> {
  const [linha] = await tx<{ definicao: string }[]>`
    SELECT pg_catalog.pg_get_functiondef(p.oid) AS definicao
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = ${SCHEMA_DA_OPERACAO}
       AND p.proname = ${FUNCAO_DA_DATA_CORRENTE}
  `;

  if (linha === undefined) {
    throw new Error(
      `o catálogo não tem a função ${SCHEMA_DA_OPERACAO}.${FUNCAO_DA_DATA_CORRENTE}()`,
    );
  }

  const fuso = FUSO_NO_CORPO.exec(linha.definicao)?.[1];

  if (fuso === undefined) {
    throw new Error(
      `o corpo de ${SCHEMA_DA_OPERACAO}.${FUNCAO_DA_DATA_CORRENTE}() não nomeia fuso algum`,
    );
  }

  return fuso;
}
