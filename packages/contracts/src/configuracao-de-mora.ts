/**
 * O contrato da **política de multa e juros** de uma empresa — a substituta do `Atraso` Single
 * global do sistema antigo.
 *
 * ===========================================================================
 * O corpo é COMPLETO, e campo ausente é RECUSA — nunca "preserve o valor atual"
 * ===========================================================================
 *
 * {@link esquemaDaConfiguracaoDeMoraNova} é `strictObject` de **dois campos, nenhum opcional**, e é
 * essa ausência de opcionalidade que define o `PUT` desta superfície. A alternativa — declarar os
 * dois opcionais e preservar o que não veio — é o defeito clássico do `PUT` parcial que copia o
 * `required` do `POST`: o cliente que envia só `multaPercentual` acredita ter zerado os juros, e o
 * servidor mantém o valor anterior sem que nada acuse. Aqui o corpo incompleto é `422` nomeando o
 * campo que falta, e a intenção do cliente nunca precisa ser adivinhada.
 *
 * A ausência de campo opcional é também o que faz a rota ser **idempotente por construção**: o
 * mesmo corpo aplicado duas vezes descreve o mesmo estado final, independentemente do que havia
 * antes. É a propriedade que o `upsert` da porta materializa (última escrita vence).
 *
 * ===========================================================================
 * A faixa é FECHADA nos dois extremos, e a escala é a da coluna
 * ===========================================================================
 *
 * Os dois percentuais vivem em `[0, 100]`, com escala `0.01` — que é a escala de
 * `numeric(5,2)`, a coluna que os guarda (§7.2 da tech spec). As três restrições cobrem coisas
 * diferentes, e nenhuma delas é redundante:
 *
 *   * o **piso** `0` é o que faz *"não cobro mora"* ser exprimível sem um campo de ligar/desligar —
 *     a ausência de política e a política zerada são a mesma coisa (RD-21);
 *   * o **teto** `100` é a fronteira do que a coluna representa **e** do que a regra admite, e as
 *     duas coincidirem é o que impede um valor aprovado aqui de estourar o `CHECK
 *     configuracao_de_mora_faixa_chk` como erro de driver em `500`;
 *   * a **escala** fecha a metade que o teto sozinho deixaria aberta: `2.555` cabe na coluna e
 *     **muda de valor** ao entrar nela, voltando ao cliente como `2.56` — aprovado, gravado
 *     diferente do enviado, sem erro e sem aviso.
 *
 * ===========================================================================
 * A restrição de faixa e escala vale na ENTRADA e NÃO é replicada na SAÍDA
 * ===========================================================================
 *
 * {@link esquemaDaConfiguracaoDeMora} declara os mesmos dois campos como `z.number()` puro, e a
 * assimetria é deliberada: é a mesma que o marcador `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`
 * registra em `./comum.ts` — **leia-o antes de qualquer tentativa de simetrizar**. A razão (1) de lá
 * é a que governa aqui: esquema de saída que recusa **não produz `422`**, ele levanta na
 * serialização e **derruba a rota**. Quem impede o valor fora da faixa de existir é a entrada, mais
 * o `CHECK` do banco — dois pontos que produzem recusa legível; a saída apenas descreve o que já
 * está gravado.
 *
 * ===========================================================================
 * `empresaId` não é campo, e a ausência é o mecanismo (ADR-0008)
 * ===========================================================================
 *
 * A empresa sai do contexto da sessão, e o `strictObject` converte a tentativa de propô-la pelo
 * corpo em recusa por chave desconhecida — sem uma linha de verificação escrita à mão. É o mesmo
 * desenho de toda entrada deste pacote, e é o que a varredura de `packages/contracts/test/
 * esquemas.spec.ts` afirma sobre **todos** eles de uma vez.
 */

import { z } from 'zod';

/**
 * O piso e o teto dos dois percentuais — a faixa **fechada** `[0, 100]`.
 *
 * Não são exportados: o que os consumidores precisam é do esquema, que é o ponto único da
 * conferência. Publicar os limites crus convidaria a uma segunda conferência escrita à mão em algum
 * controlador, e é a repetição — não o número — que reabriria a divergência.
 */
const MENOR_PERCENTUAL_DE_MORA = 0;
const MAIOR_PERCENTUAL_DE_MORA = 100;

/**
 * A escala dos percentuais — duas casas decimais, o `2` de `numeric(5,2)` (§7.2).
 *
 * Ela é declarada aqui, e **não** importada de `ESCALA_MONETARIA`: os dois valem `0.01` hoje, e a
 * coincidência é acidente das colunas. Percentual não é dinheiro — `numeric(5,2)` contra
 * `numeric(15,2)` —, e amarrar um ao outro faria uma mudança de escala monetária alcançar em
 * silêncio a política de mora.
 */
const ESCALA_DO_PERCENTUAL = 0.01;

/**
 * Corpo fechado de `PUT /v1/multa-e-juros` — **dois** campos, nenhum opcional.
 *
 * `multaPercentual` é aplicado **uma vez** sobre o valor original; `jurosPercentual` é **ao mês**,
 * simples, sobre base de mês comercial de trinta dias (RD-07). Os dois significados vivem na view
 * que apura, e não aqui: este esquema fixa a **forma** do que se aceita, e a aritmética é do banco
 * (ADR-0023).
 */
export const esquemaDaConfiguracaoDeMoraNova = z.strictObject({
  multaPercentual: z
    .number()
    .min(MENOR_PERCENTUAL_DE_MORA)
    .max(MAIOR_PERCENTUAL_DE_MORA)
    .multipleOf(ESCALA_DO_PERCENTUAL),
  jurosPercentual: z
    .number()
    .min(MENOR_PERCENTUAL_DE_MORA)
    .max(MAIOR_PERCENTUAL_DE_MORA)
    .multipleOf(ESCALA_DO_PERCENTUAL),
});

/** O corpo aceito ao definir a política de multa e juros da empresa. */
export type ConfiguracaoDeMoraNova = z.infer<typeof esquemaDaConfiguracaoDeMoraNova>;

/**
 * A política de multa e juros como a API a publica — os **mesmos dois campos**.
 *
 * **Não há `id`, e não há `empresaId`.** O recurso é singular por empresa (uma linha, imposta por
 * `configuracao_de_mora_empresa_key`), de modo que não existe o que identificar: a chave é a própria
 * sessão. Publicar o UUID daria ao consumidor um identificador que rota nenhuma aceita.
 *
 * A empresa que **nunca configurou** lê este mesmo recurso com os dois campos em zero, e não um
 * `404`: a ausência de linha e a política explicitamente zerada são a mesma coisa publicada
 * (RD-21). É o que faz a leitura concordar com a apuração, onde o `LEFT JOIN` com `COALESCE(…, 0)`
 * já produz mora zero (RD-08).
 */
export const esquemaDaConfiguracaoDeMora = z.strictObject({
  multaPercentual: z.number(),
  jurosPercentual: z.number(),
});

/** A política de multa e juros vigente na empresa da sessão. */
export type ConfiguracaoDeMora = z.infer<typeof esquemaDaConfiguracaoDeMora>;
