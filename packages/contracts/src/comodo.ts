/**
 * O contrato do **cômodo** — detalhe de composição do imóvel, e não entidade de cadastro própria.
 *
 * Duas consequências que este arquivo materializa e que valem a leitura antes de editá-lo:
 *
 * - **Não existe `retiradoEm`.** A ADR-0014 exclui o cômodo do alcance da exclusão lógica, porque
 *   ele é parte da descrição do imóvel: remover um cômodo é corrigir a planta, não retirar um
 *   cadastro de circulação. A ausência do campo é o que torna a decisão verificável.
 * - **Não existe rota de leitura de cômodo.** Ele chega e volta dentro do imóvel, que é o seu
 *   agregado (§4.1) — e por isso não há envelope de lista de cômodos neste pacote.
 */

import { z } from 'zod';
import {
  ESCALA_DA_METRAGEM,
  MAIOR_METRAGEM,
  MAIOR_TEXTO_CURTO,
  MAIOR_TEXTO_LIVRE,
} from './comum.js';

/**
 * Corpo fechado de acrescentar e de alterar cômodo (§4.1: `{ nomeComodo, metragem?, observacoes? }`).
 *
 * **`metragem` ausente vale zero** (RN-02), e o valor entra no corpo validado em vez de ser
 * completado adiante: a soma que produz a metragem total é derivada na leitura, com um ponto único
 * de avaliação, e um cômodo que chegasse à camada de dados com `undefined` obrigaria aquele ponto a
 * decidir de novo o que fazer com a ausência. `null` **explícito** é recusado — quem não sabe a
 * metragem omite o campo; quem envia `null` está afirmando um valor que não existe.
 *
 * `posicao` **não** é campo de entrada: é atribuída pelo servidor como `max(posicao) + 1` dentro da
 * transação (§6.2). Aceitá-la do cliente daria a ele o poder de colidir com a restrição
 * `unique(imovel_id, posicao)` de outro cômodo.
 *
 * **A metragem tem piso, teto E escala** — as três restrições espelham a coluna, e nenhuma das três
 * é decorativa:
 *
 * - **piso**: a RN-02 (`metragem >= 0`, §6.1);
 * - **teto**: {@link MAIOR_METRAGEM}, a precisão de `numeric(10,2)`. Sem ele, `{"metragem": 1e30}`
 *   atravessava o contrato e virava `22003` no banco, isto é, `500` no lugar do `422` que a §6.1
 *   manda;
 * - **escala**: {@link ESCALA_DA_METRAGEM}, o `2` da mesma coluna. Sem ela, `25.555` era aprovado,
 *   gravado como `25.56` e devolvido ao cliente **alterado**, sem erro nenhum. É o defeito gêmeo do
 *   anterior, e mais silencioso: cabe na coluna, mas muda de valor ao entrar nela.
 *
 * `multipleOf` foi **medido** antes de ser escolhido, porque a aresta de ponto flutuante é o risco
 * óbvio: o zod deste pacote aprova `0.29`, `0.07`, `8.11`, `12345.67` e o próprio
 * {@link MAIOR_METRAGEM}, e recusa `25.555` e `0.001` — ele usa resto seguro para decimal, e não
 * `%` de binário, que reprovaria valores legítimos. A alternativa idiomática seria conferir a
 * representação textual do número, e ela é pior aqui: obrigaria o contrato a decidir sobre notação
 * exponencial (`2.5e1`) e a duplicar a regra que a coluna já declara.
 *
 * As razões por extenso estão nas constantes; o par de fronteira que prova as três é o CT-340.
 */
export const esquemaDeComodoNovo = z.strictObject({
  nomeComodo: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
  metragem: z.number().min(0).max(MAIOR_METRAGEM).multipleOf(ESCALA_DA_METRAGEM).default(0),
  observacoes: z.string().trim().max(MAIOR_TEXTO_LIVRE).nullable().default(null),
});

/** O corpo aceito ao acrescentar e ao alterar um cômodo, com os padrões já aplicados. */
export type ComodoNovo = z.infer<typeof esquemaDeComodoNovo>;

/**
 * O cômodo como a API o devolve, sempre embutido no imóvel.
 *
 * `metragem` é **número**, e não texto: a coluna é `numeric(10,2)` e o driver a devolve como texto,
 * convertida na porta de leitura num ponto único (§6.2, CA-16). O contrato declara o tipo que o
 * consumidor recebe — é ele que torna a conversão obrigatória em vez de opcional.
 *
 * Ela **não** repete o piso, o teto nem a escala do esquema de entrada, e a assimetria é deliberada:
 * o motivo está no marcador `DECISÃO FECHADA` de {@link ESCALA_DA_METRAGEM}, em `comum.ts`. Leia-o
 * antes de simetrizar — a razão não é a que parece.
 */
export const esquemaDoComodo = z.object({
  id: z.uuid(),
  nomeComodo: z.string(),
  metragem: z.number(),
  posicao: z.number().int(),
  observacoes: z.string().nullable(),
});

/** O cômodo como a API o devolve. */
export type Comodo = z.infer<typeof esquemaDoComodo>;
