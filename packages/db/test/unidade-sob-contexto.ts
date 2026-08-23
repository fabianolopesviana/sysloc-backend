/**
 * A unidade de trabalho sob contexto de empresa — **casa compartilhada do acessório de arranjo**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE
 * ---------------------------------------------------------------------------
 *
 * É a convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`: antes de escrever num
 * arquivo de teste um acessório de arranjo — cliente, entrada de sessão, **abertura de unidade de
 * trabalho** —, procura-se a casa compartilhada do diretório (os `.ts` sem `.spec` ao lado, no molde
 * de `./conjuntos.ts` e `./relogio-da-operacao.ts`): *"se existir, importe; se não existir,
 * **crie-a**"*. Ela não existia para a unidade de trabalho, e nasce aqui.
 *
 * ⚠️ **Medição de 2026-08-23, e ela é o argumento — não a impressão.** `packages/db/test/` tem **15**
 * declarações locais de `emUnidade`, e o primeiro parâmetro delas já se partiu em **quatro** formas:
 * `contexto: Contexto` (7), `empresaId: string` (4), `contexto: contextoDeTenant.ContextoDeTenant`
 * (1) e `cenario: { readonly empresaId: string }` (1) — mais 2 que não recebem contexto algum. É
 * exatamente o que o Limiar de Três prevê e o que a convenção explica: *"quem escreve uma suíte nova
 * copia de **uma** vizinha — para ele é a segunda cópia, nunca a enésima, e o gatilho nunca
 * dispara"*. A suíte de `execucao-de-rotina` copiou a **maioria** sem saber que havia minoria.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE MÓDULO **NÃO** FAZ, E É DELIBERADO
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **As 14 cópias restantes NÃO foram migradas**, e a ausência é decisão: elas não pertencem ao
 * escopo desta task, e a proibição 5 do Protocolo Antirregressão — *"nunca aproveitar que estou
 * aqui"* — vale com força num diretório de 35 arquivos. O que a casa impede é a **16ª** nascer solta;
 * quem abrir uma das 14 por outra razão troca a declaração local por um `import` daqui, e a contagem
 * cai de uma em uma. Mesmo encaminhamento, e mesma razão, de {@link ./relogio-da-operacao.ts}.
 *
 * Ele **não abre** o acesso ao banco e **não o encerra**: quem o faz é o `beforeAll`/`afterAll` da
 * suíte, que é quem conhece a instância efêmera. `acesso` chega **por parâmetro** porque é o único
 * símbolo local que a função capturava nas 15 cópias — passá-lo é o que torna a casa possível sem
 * estado de módulo, e é a mesma escolha que a ADR-0025 faz para as portas do produto.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar
 * os tipos dele.
 */

import type { TransactionSql } from 'postgres';
import * as contextoDeTenant from '../src/contexto.ts';
import type { AcessoAoBanco } from '../src/unidade-de-trabalho.ts';

/**
 * O contexto de uma empresa **conhecida**, como a guarda o publica a partir da sessão.
 *
 * É o subconjunto não-nulo de `contextoDeTenant.ContextoDeTenant`, cujo `empresaId` é
 * `string | null` porque o processo também opera fora de qualquer empresa. Aqui ele é `string` sem
 * alternativa, e a diferença é conteúdo: toda suíte de domínio monta o arranjo **sob uma empresa**,
 * e o identificador dela é usado também fora da unidade (para conferir o `empresa_id` gravado, para
 * envelhecer a linha em `identidade.empresa`). Um `null` atravessando essas posições viraria
 * `WHERE id = NULL`, que não casa linha alguma e faria o arranjo falhar longe da causa.
 */
export interface Contexto {
  readonly empresaId: string;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de **uma** unidade de trabalho.
 *
 * É o par `executarCom` + `emUnidadeDeTrabalho` — o mesmo que a guarda e o controlador usam em
 * operação, e o único caminho legítimo por onde uma suíte alcança o banco. Ele **não** emite
 * `SET LOCAL` nem toca a variável de sessão: quem a fixa é o escritor único de
 * `src/unidade-de-trabalho.ts`, sob duas `DECISÃO FECHADA`, e um atalho escrito aqui seria o
 * contorno que o `CT-624 (b)` varre nominalmente.
 */
export async function emUnidadeSobContexto<T>(
  acesso: AcessoAoBanco,
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}
