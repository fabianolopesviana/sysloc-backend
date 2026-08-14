/**
 * O registro da recusa do portador de confirmação — a **terceira ponta da RN-14**, a que não tem
 * resposta HTTP para provar. T11 da fatia `documentos-e-confirmacao`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-13 | CT-740 | Na recusa do portador, a chave `motivo` aparece **exatamente uma vez** em
 * |       | (a)    | posição executável do serviço, e o valor é a **referência à constante**
 * |       |        | `MOTIVO_DA_RECUSA` — nunca uma expressão, nunca um literal solto, nunca um
 * |       |        | segundo ponto de registro. Menção em comentário **não** conta. (RN-14, §13.1) |
 * | CA-13 | CT-740 | Companheiro pela outra ponta: `MOTIVO_DA_RECUSA` é declarada **uma vez** e o que
 * |       | (b)    | ela declara é o **literal** `'nao-resolvido'` — de modo que o valor não pode
 * |       |        | virar expressão pela lateral, com o ponto de uso intacto. (RN-14, §13.1) |
 *
 * Rastreabilidade: `CA-13 → CT-740 (RN-14)`. As duas outras pontas da mesma RN vivem em
 * `apps/api/test/confirmacao-de-email.e2e.spec.ts`: o **CT-723** prova que os três modos de recusa
 * produzem a mesma resposta byte a byte, e o **CT-724** prova que a reapresentação não reescreve o
 * instante de confirmação. Este arquivo fecha a que sobrava — a linha do journal.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE CASO EXISTE, se o código já está certo
 * ---------------------------------------------------------------------------
 *
 * A garantia é hoje **estrutural**: `MOTIVO_DA_RECUSA` é constante de módulo com valor literal
 * único, não há ramo no caminho da recusa, e nem o segredo nem o derivado entram em registro algum.
 * Construção, porém, não é prova. Trocar `motivo: MOTIVO_DA_RECUSA` por `motivo: causa` — o gesto
 * plausível de quem quer *"melhorar o diagnóstico"* — compila, atravessa a suíte inteira sem uma
 * asserção vermelha, e abre **pela lateral**, para quem lê o journal (o operador da plataforma),
 * exatamente a distinção entre inválido, vencido e invalidado que o `404` indistinguível fecha.
 *
 * A §13.1 da tech spec trata o campo como **contrato de observabilidade** (*"um único motivo,
 * sempre"*), e a §3.2 da task declara que *"o registro obedece à RN-14 tanto quanto a resposta"*.
 * Contrato declarado sem asserção é contrato que sobrevive só enquanto ninguém o edita.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE MORA AQUI, e não dentro do E2E da confirmação
 * ---------------------------------------------------------------------------
 *
 * A fronteira deste caso é o **filesystem** — ele lê o texto do serviço, e não exercita rota,
 * banco ou fila. Enxertá-lo em `confirmacao-de-email.e2e.spec.ts` o acorrentaria à montagem mais
 * cara da fatia (banco migrado, semente, fila e aplicação real, com limite de 240 s) e o faria cair
 * junto de qualquer instabilidade de infraestrutura daquele arquivo — uma rede que some justamente
 * quando o ambiente treme não é rede. O precedente do repositório para asserção estática sobre
 * `apps/api/src` é `apps/api/test/ponto-de-aplicacao.spec.ts` (CT-216), cujo molde este arquivo
 * segue: alvo declarado por caminho, comentários removidos antes da comparação, expectativa escrita
 * à mão e prova de falsificação registrada.
 *
 * ---------------------------------------------------------------------------
 * As duas defesas contra o modo de falha que a `testing-stack.md` mede
 * ---------------------------------------------------------------------------
 *
 *   * **os comentários saem antes da comparação** — `varrerArquivos` aplica `semComentarios`, e sem
 *     isso o próprio docblock do serviço (que cita `motivo: 'nao-resolvido'` por extenso, em prosa)
 *     contaria como ocorrência, e a asserção casaria **menção** em vez de **uso**. É o defeito
 *     literal registrado na rule;
 *   * **as duas alíneas se protegem** — se a varredura lesse o arquivo errado, a alínea (b)
 *     reprovaria por não achar declaração alguma, em vez de a (a) passar por vacuidade.
 *
 * ---------------------------------------------------------------------------
 * PROVA DE FALSIFICAÇÃO EXECUTADA (2026-08-13)
 * ---------------------------------------------------------------------------
 *
 * Pelo procedimento da `.claude/rules/testing-stack.md`: mutante aplicado ao **fonte de produção**,
 * suíte invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso — este arquivo alcança `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o
 * `dist/` da compilação anterior, devolvendo verde que se leria como *"o mutante sobreviveu"*.
 *
 *   1. **controle** — árvore íntegra: `29 arquivos, 226 passed`, as duas alíneas verdes;
 *   2. **mutante A (o valor vira expressão no ponto de uso)** — `motivo: MOTIVO_DA_RECUSA` trocado
 *      por ``motivo: `${MOTIVO_DA_RECUSA}:${derivado}` ``, que é o gesto plausível de quem
 *      *"acrescenta correlação"*: `1 failed | 225 passed`, a falha na alínea (a), nomeando o valor
 *      encontrado;
 *   3. **mutante B (o valor vira expressão na declaração)** — `const MOTIVO_DA_RECUSA =
 *      'nao-resolvido'` trocado por `= process.env.MOTIVO_DA_RECUSA ?? 'nao-resolvido'`:
 *      `1 failed | 225 passed`, a falha na alínea (b) — e o ponto de uso **intacto**, que é a
 *      lateral que a alínea (a) sozinha não fecharia;
 *   4. **mutante C (segundo ponto de registro)** — um `logger.info({ motivo: 'vencido' }, …)`
 *      acrescentado ao caminho da recusa: `1 failed | 225 passed`, a falha na alínea (a), com as
 *      **duas** ocorrências nomeadas por arquivo e linha;
 *   5. **reversão** — o fonte restaurado byte a byte e o controle reexecutado: `226 passed`.
 *
 * ⚠️ **Um quarto mutante foi tentado e descartado, e a razão é informação**: trocar o valor por
 * `motivo: derivado`, deixando a constante sem leitor, **não compila** — o `noUnusedLocals` do
 * `tsconfig.base.json` reprova antes da suíte (`TS6133`). O compilador é, portanto, a primeira
 * barreira, e ela cobre só o caso em que a constante fica órfã. O mutante A foi escolhido
 * justamente por **preservar** a constante: é o gesto que atravessa o compilador, e é dele que esta
 * asserção é a rede.
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada, então
//        não há dependência oculta; o que não existe é FRONTEIRA para os diretórios `test/` — e
//        este arquivo é mais um a repetir o padrão, agora para o acessório de varredura.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de três pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { varrerArquivos } from '../../../packages/db/test/varredura-de-fontes.ts';

/** O fonte sob teste, declarado por caminho: um arquivo que sumir faz a leitura levantar. */
const FONTE_DO_SERVICO = fileURLToPath(
  new URL('../src/confirmacoes/confirmacao.service.ts', import.meta.url),
);

/**
 * O nome da constante que carrega o único motivo publicável.
 *
 * Escrito à mão de propósito: ele é a **expectativa revisada**. Importá-lo do serviço faria o caso
 * concordar consigo mesmo — e o símbolo nem sequer é exportado, o que é a forma certa.
 */
const CONSTANTE_DO_MOTIVO = 'MOTIVO_DA_RECUSA';

/** O literal que a constante declara, com as aspas que o fonte usa. */
const LITERAL_DO_MOTIVO = "'nao-resolvido'";

/**
 * Casa a chave `motivo` em posição de propriedade e captura **tudo** que vier como valor, até a
 * vírgula ou a chave de fecho.
 *
 * A captura é deliberadamente larga: o que se quer reprovar não é um valor errado específico, e sim
 * **qualquer coisa que não seja a referência à constante** — um literal solto, um ternário, uma
 * chamada, uma variável de causa. Valor em outra linha produz captura vazia, que também não é a
 * constante e também reprova.
 */
const ATRIBUICAO_DO_MOTIVO = /\bmotivo\s*:\s*([^,}]*)/u;

/** Casa a declaração da constante e captura o que ela recebe, até o ponto e vírgula. */
const DECLARACAO_DO_MOTIVO = new RegExp(`\\bconst\\s+${CONSTANTE_DO_MOTIVO}\\s*=\\s*([^;]*)`, 'u');

/** O valor capturado por um dos dois moldes, já sem o espaço que a linha carrega. */
function valorCapturado(linha: string, molde: RegExp): string {
  return (molde.exec(linha)?.[1] ?? '').trim();
}

describe('CT-740 — o motivo publicado na recusa do portador é constante, e não pode deixar de ser', () => {
  it('(a) a chave `motivo` existe uma vez só em posição executável, e o valor é a referência à constante', async () => {
    const varredura = await varrerArquivos([FONTE_DO_SERVICO], (linha) =>
      ATRIBUICAO_DO_MOTIVO.test(linha),
    );

    // O alvo é um arquivo só, e a leitura aconteceu: sem esta linha, uma varredura que não lesse
    // nada produziria conjunto vazio e a igualdade abaixo reprovaria sem dizer por quê.
    expect(varredura.arquivos).toBe(1);

    expect(
      varredura.linhas,
      `a chave \`motivo\` deixou de aparecer exatamente uma vez em ${FONTE_DO_SERVICO}: ${varredura.ocorrencias.join(', ')}`,
    ).toHaveLength(1);

    const valores = varredura.linhas.map((linha) => valorCapturado(linha, ATRIBUICAO_DO_MOTIVO));

    expect(
      valores,
      'o motivo do registro deixou de ser a referência à constante — registrar a causa concreta abre pela lateral, no journal, a distinção que o 404 fecha (RN-14)',
    ).toEqual([CONSTANTE_DO_MOTIVO]);
  });

  it('(b) a constante é declarada uma vez, e o que ela declara é o literal — nunca uma expressão', async () => {
    const varredura = await varrerArquivos([FONTE_DO_SERVICO], (linha) =>
      DECLARACAO_DO_MOTIVO.test(linha),
    );

    expect(
      varredura.linhas,
      `\`${CONSTANTE_DO_MOTIVO}\` deixou de ter declaração única em ${FONTE_DO_SERVICO}: ${varredura.ocorrencias.join(', ')}`,
    ).toHaveLength(1);

    const valores = varredura.linhas.map((linha) => valorCapturado(linha, DECLARACAO_DO_MOTIVO));

    expect(
      valores,
      'a constante deixou de declarar um literal — o valor passou a poder variar em execução, com o ponto de uso intacto',
    ).toEqual([LITERAL_DO_MOTIVO]);
  });
});
