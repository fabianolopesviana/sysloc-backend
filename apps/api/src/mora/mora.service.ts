/**
 * Mora — a regra de aplicação das duas rotas de `/v1/multa-e-juros`: ler a política e defini-la.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO APURA MORA, e a ausência é o que a fatia inteira existe para garantir
 * ---------------------------------------------------------------------------
 *
 * **Não existe neste arquivo uma multiplicação, uma divisão ou uma comparação de data.** O que ele
 * move são os dois **percentuais**; quem os transforma em multa, juros e total é a visão
 * `negocio.cobranca_derivada`, sobre `numeric`, e a razão está por extenso no cabeçalho de
 * `packages/db/src/cobranca.ts`: a ADR-0023 é literal sobre a aritmética monetária viver no banco, e
 * uma segunda apuração escrita aqui devolveria o dinheiro ao ponto flutuante do JavaScript.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO REESCREVE COBRANÇA ALGUMA (RD-10, ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * {@link MoraService.definir} grava **uma** linha e nada mais. Não há aqui varredura da carteira,
 * recálculo de cobrança aberta nem correção de cobrança paga, e a ausência é a propriedade central
 * desta task: a mora em aberto é **derivada**, e por isso passa a refletir a política nova na
 * leitura seguinte, sem que nada precise ser reescrito; a mora já liquidada está **carimbada** na
 * linha do pagamento, e por isso a política nova não a alcança. As duas metades são provadas em T7,
 * onde as cobranças com pagamento existem — aqui a garantia é a ausência de escrita.
 *
 * Uma implementação que "atualizasse as cobranças afetadas" quebraria as duas de uma vez: recalcular
 * o aberto seria a segunda derivação do mesmo fato, e tocar o liquidado reescreveria um recibo já
 * emitido.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Os dois métodos tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. Nenhum deles
 * chama `emUnidadeDeTrabalho`, e a **ausência de construtor** é o mecanismo: o acesso ao banco não é
 * injetado aqui, porque injetá-lo daria a este serviço exatamente a capacidade que ele não pode ter.
 * É a mesma decisão, com a mesma razão, de {@link ../cobrancas/cobranca.service.js} e de
 * {@link ../contratos/contrato.service.js}, e é a saída que o próprio marcador `DECISÃO FECHADA` de
 * `packages/db/src/unidade-de-trabalho.ts` aponta como preferível. **A decisão fechada não é
 * tocada.**
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO TRADUZ ERRO, e a ausência também é decisão
 * ---------------------------------------------------------------------------
 *
 * Não há aqui um `404`, e não pode haver: a leitura de empresa que nunca configurou devolve **zeros
 * com `200`** (RD-21), porque a ausência de linha e a política explicitamente zerada são a mesma
 * coisa publicada. Um `404` faria a rota discordar da view sobre o mesmo fato — lá o `LEFT JOIN` com
 * `COALESCE(…, 0)` já apura mora zero para a mesma empresa (RD-08).
 *
 * Também não há tradução de conflito: a escrita é um `upsert`, e a única restrição de unicidade em
 * jogo — `configuracao_de_mora_empresa_key` — é o **alvo** do `ON CONFLICT`, e não uma recusa que
 * possa chegar ao cliente. A faixa `[0, 100]` é conferida no esquema, na borda, com o campo culpado
 * nomeado; o `CHECK` do banco é a rede para os caminhos de escrita que não passam pela rota.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.configuracao_de_mora` vive em
 * `packages/db/src/configuracao-de-mora.ts`, publicada como função de domínio — a razão é a
 * enumerabilidade, e está por extenso no cabeçalho daquele arquivo. E não existe, em lugar algum
 * deste, uma comparação de empresa: o `empresa_id` sai do contexto que a guarda publicou a partir da
 * sessão, e nunca do corpo (ADR-0008).
 */

import { Injectable } from '@nestjs/common';
import type { ConfiguracaoDeMora, ConfiguracaoDeMoraNova } from '@sysloc/contracts';
import { gravarConfiguracaoDeMora, lerConfiguracaoDeMora } from '@sysloc/db';
import type { TransactionSql } from 'postgres';

@Injectable()
export class MoraService {
  // Sem construtor, e a ausência é o ponto: ver o cabeçalho deste arquivo.

  /**
   * Lê a política vigente da empresa do contexto.
   *
   * A empresa que nunca configurou devolve `{ multaPercentual: 0, jurosPercentual: 0 }`, e **nenhuma
   * linha nasce** desta leitura: a tradução da ausência acontece na porta, sem escrita. Um `GET` que
   * criasse a linha zerada mudaria o que ele mede, e a primeira leitura de toda empresa passaria a
   * ser uma escrita.
   */
  async ler(tx: TransactionSql): Promise<ConfiguracaoDeMora> {
    return await lerConfiguracaoDeMora(tx);
  }

  /**
   * Define a política da empresa do contexto e devolve a que passou a valer.
   *
   * A entrada é o corpo **completo** — os dois percentuais, nenhum opcional —, de modo que o que se
   * grava é um estado final inteiro, e não uma fusão com o que havia antes. É isso que torna a
   * escrita exprimível como um `upsert` de um comando só, e é isso que faz "última escrita vence"
   * ser a semântica correta sob concorrência.
   *
   * **Nada além desta linha é escrito.** Ver o cabeçalho para por que recalcular cobrança aqui
   * quebraria as duas metades da RD-10.
   */
  async definir(tx: TransactionSql, entrada: ConfiguracaoDeMoraNova): Promise<ConfiguracaoDeMora> {
    return await gravarConfiguracaoDeMora(tx, entrada);
  }
}
