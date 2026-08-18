/**
 * O **alcance da capacidade de enfileirar** — quem, em `apps/api/src`, consegue pôr trabalho na
 * fila desta aplicação.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | §9.3  | apoio  | **T15** · O conjunto dos arquivos de `apps/api/src` que nomeiam `FilaModule`
 * | (T15) | (a)    | é **exatamente** o dono mais **dois** módulos de área — afirmado por igualdade
 * |       |        | de conjunto, com o excedente NOMEADO —, e nos dois a menção é ligação real: a
 * |       |        | linha traz o especificador do módulo dono. Módulo que acrescente
 * |       |        | `imports: [FilaModule]` entra no conjunto e **reprova**. (ADR-0029) |
 * | §9.3  | apoio  | **T15** · O conjunto que nomeia `TOKEN_PRODUTOR_DE_FILA` é **exatamente** a
 * | (T15) | (b)    | fronteira, o dono e os **três** serviços que enfileiram; o que chama
 * |       |        | `conectarProdutorDeFila` é **exatamente** a fronteira e o dono; e o que nomeia
 * |       |        | o **especificador da biblioteca de fila** é **exatamente** a fronteira. O
 * |       |        | primeiro fecha o serviço novo que injete o produtor **dentro** de uma área que
 * |       |        | já o alcança (onde o caso (a) não reprovaria); o segundo fecha a **segunda
 * |       |        | conexão**, que o cabeçalho de `produtor-de-fila.ts` recusa por escrito; e o
 * |       |        | terceiro fecha a fila aberta **direto sobre `bullmq`**, que não nomeia símbolo
 * |       |        | algum deste repositório e por isso é invisível para os outros três eixos.
 * |       |        | (T17, fecho do `D47 · F4/T15`) |
 * | §9.3  | apoio  | **T15** · O módulo dono da fila **não é global**: os decoradores de topo de
 * | (T15) | (c)    | `comum/fila.module.ts` são, por igualdade, `['Module']`. É o único caminho de
 * |       |        | alcance que **não** exige nomear coisa alguma em módulo alheio — com
 * |       |        | `@Global()`, os 14 módulos passariam a resolver o token e as listas dos casos
 * |       |        | (a) e (b) continuariam intactas. |
 *
 * Rastreabilidade: o invariante **não** desce de um CA da T15 — ele é de arquitetura, e nasce do
 * veredito do Gate 2 sobre a rodada 2 desta task (`P1`, `MEDIO`, `architecture`). O par metodológico
 * dele é o `CT-216` de `ponto-de-aplicacao.spec.ts`, que fixa pela mesma forma a cardinalidade de
 * consumo da decisão de autorização.
 *
 * ===========================================================================
 * POR QUE ESTE ARQUIVO EXISTE — a contenção trocou de mecanismo, e o novo precisa de rede
 * ===========================================================================
 *
 * Até a T15 o provedor da fila morava em `cadastros/cadastros.module.ts`, deliberadamente **fora**
 * de qualquer `exports`, e a contenção era imposta pelo **contêiner de injeção**: para um terceiro
 * módulo alcançar a fila era preciso editar o módulo alheio e contrariar por escrito o docblock
 * dele. A T15 trouxe o segundo e o terceiro produtores em outra área, e o dono passou a ser
 * `comum/fila.module.ts`, que **exporta** o token — o desenho está registrado no cabeçalho de lá, e
 * as duas alternativas foram descartadas com razão escrita.
 *
 * A troca tem uma consequência que o desenho não cobre: **a barreira deixou de ser do contêiner e
 * passou a ser de revisão**. Acrescentar `imports: [FilaModule]` ao módulo do próprio autor é uma
 * linha, não toca arquivo alheio e não contraria docblock nenhum — que é a definição do crescimento
 * **silencioso** que a `.claude/rules/ancoras-de-superficie.md` existe para impedir. E os cabeçalhos
 * de `comum/fila.module.ts` e de `cadastros/cadastros.module.ts` **afirmam por escrito** que a
 * capacidade "continua enumerável, agora pela lista dos módulos que declaram `imports:
 * [FilaModule]`": sem uma asserção que fixe essa lista, a afirmação escrita passaria a mentir sobre
 * o estado do código no dia do quarto módulo, e nada acusaria.
 *
 * Hoje o alcance é de **2** módulos de área em 14. Este arquivo é o que faz o terceiro custar uma
 * revisão deliberada — a mesma disciplina que a ADR-0011 impõe a quem publica rota.
 *
 * ---------------------------------------------------------------------------
 * O QUARTO EIXO, e por que a prosa de abertura só passou a ser verdade com ele (T17)
 * ---------------------------------------------------------------------------
 *
 * A primeira linha deste arquivo declara o objeto como *"quem consegue **pôr trabalho na fila** desta
 * aplicação"*, e o cabeçalho de `comum/fila.module.ts` **credita a esta âncora** a veracidade da
 * própria frase dele. Até a T17 as asserções fixavam quem nomeia **três símbolos** — e havia um
 * quarto caminho, que os dois gates da T15 acharam **independentemente**: `import { Queue } from
 * 'bullmq'` num módulo de área, abrindo **fila própria sobre conexão própria**, põe trabalho na fila
 * sem tocar nenhum dos três.
 *
 * O crédito estava **encadeado** — o módulo cita a âncora, a âncora afirmava alcance total —, e é a
 * classe que custou seis AP-29 a esta fatia: *crédito escrito acima do que a linha prova é o que
 * autoriza a rodada seguinte a confiar nele*. A T17 fecha o `D47` pela saída que o próprio Gate 2
 * chamou de *"tornar executável o que ele já afirma"*: o eixo entra no caso (b), pela mesma forma
 * (`varrerPor` sobre um padrão), e a prosa passa a descrever o que as asserções entregam.
 *
 * ===========================================================================
 * A FORMA MEDIDA — por que a varredura do fonte, e não o retrato do injetor
 * ===========================================================================
 *
 * As duas foram consideradas. O retrato do injetor Nest sobre a aplicação montada mediria o alcance
 * **efetivo**, o que é atraente; ele foi descartado por medição, e por duas razões concretas:
 *
 *   1. **A enumeração dos módulos teria de vir de uma lista escrita aqui.** O `get` do arcabouço com
 *      `strict` resolve no injetor do módulo **que declara** o provedor, e não em quem o alcança por
 *      importação: perguntar "este módulo alcança o token?" exigiria reimplementar no teste a
 *      resolução do contêiner (importações, reexportações, módulo global). Com a lista escrita à
 *      mão, o **módulo novo** — que é exatamente o modo de falha perseguido — não seria interrogado,
 *      e a asserção passaria verde: seria o AP-29 plantado dentro da âncora criada para fechá-lo.
 *   2. **O alcance nasce no fonte, não no grafo montado.** O que se quer conter é a *linha que
 *      alguém escreve*, e ela é observável antes de a aplicação subir — sem banco, sem servidor de
 *      fila e sem os 240 s de montagem que um caso E2E cobraria por isso.
 *
 * A varredura do fonte também alcança o que o grafo montado **não** distingue: quem chama a fábrica
 * `conectarProdutorDeFila` para abrir uma **segunda** conexão sob token próprio aparece no caso (b),
 * e no injetor ele seria apenas mais um provedor legítimo.
 *
 * ===========================================================================
 * A asserção é ESTÁTICA — e a prova de falsificação foi EXECUTADA
 * ===========================================================================
 *
 * Ela inspeciona o **texto** do código sob teste, e a `.claude/rules/testing-stack.md` e o P4 da
 * `.claude/rules/nao-regressao.md` cobram o preço disso: asserção estática exige prova de
 * falsificação por execução. As duas defesas contra o modo de falha clássico estão instaladas, e são
 * as mesmas do `CT-216`:
 *
 *   * **os comentários saem antes da comparação** — quem os remove é `semComentarios`, o acessório
 *     comum de `packages/db/test/varredura-de-fontes.ts`, e é o que impede a prosa deste próprio
 *     invariante (que nomeia os três símbolos por extenso, nos cabeçalhos dos módulos) de contar
 *     como alcance;
 *   * **a lista de arquivos é afirmada não vazia** antes de qualquer igualdade, porque uma varredura
 *     que não lesse nada produziria conjuntos vazios e reprovaria por ausência, sem dizer por quê.
 *
 * **PROVA DE FALSIFICAÇÃO EXECUTADA** (2026-08-18), pelo procedimento da rule — mutante no fonte,
 * suíte invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso:
 *
 *   1. **controle** — árvore íntegra: os três casos verdes;
 *   2. **mutante A (quarto módulo enfileirando)** — `apps/api/src/mora/mora.module.ts` ganhou
 *      `import { FilaModule } from '../comum/fila.module.js';` e `FilaModule` na lista de `imports`:
 *      o caso (a) **reprovou**, nomeando `mora/mora.module.ts` como excedente;
 *   3. **mutante B (menção só em comentário)** — a mesma linha, em comentário de linha e em
 *      comentário de bloco: os três casos permaneceram **VERDES**. Sem este segundo mutante, uma
 *      varredura que casasse comentário passaria o mutante A e pareceria boa — é o defeito literal
 *      registrado na `testing-stack.md`;
 *   4. **mutante C (`@Global()` no dono)** — o decorador acrescentado a `comum/fila.module.ts`: o
 *      caso (c) **reprovou** com `['Global', 'Module']`, e os casos (a) e (b) seguiram verdes, que é
 *      a razão de (c) existir em separado;
 *   5. **mutante D (serviço novo injetando o token)** — `TOKEN_PRODUTOR_DE_FILA` injetado em
 *      `cobrancas/boleto.service.ts`: o caso (b) **reprovou** nomeando o arquivo, e o caso (a)
 *      seguiu verde — `CobrancasModule` não nomeia `FilaModule`;
 *   6. **mutante E (segunda conexão pela fábrica)** — um provedor em `mora/mora.module.ts` chamando
 *      `conectarProdutorDeFila` sob token próprio: o caso (b) **reprovou** pelo eixo da fábrica,
 *      nomeando `mora/mora.module.ts`, e o caso (a) seguiu verde — nem `FilaModule` nem o token são
 *      nomeados ali. É a forma de alcance que nenhuma das outras duas listas enxerga;
 *   7. **reversão** — as cópias foram desfeitas e o controle reexecutado.
 *
 * O detalhe de cada rodada está no relatório da rodada 3 desta task.
 *
 * **PROVA DE FALSIFICAÇÃO DO QUARTO EIXO** (2026-08-18, T17), pelo mesmo procedimento e pelo mesmo
 * comando (`pnpm --filter @sysloc/api test`):
 *
 *   * **mutante F (fila própria sobre a biblioteca)** — `apps/api/src/mora/mora.service.ts` ganhou
 *     `import { Queue } from 'bullmq';` e um uso do símbolo: o caso (b) **reprovou** pelo eixo novo,
 *     nomeando `mora/mora.service.ts` — e os casos (a) e (c) seguiram **verdes**, porque nem
 *     `FilaModule`, nem o token, nem a fábrica são nomeados ali. É exatamente o caminho que os três
 *     eixos anteriores não enxergavam, e a razão de o quarto existir;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `diff -q` idêntico ao original,
 *     e o controle voltou ao verde.
 */

import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada, então
//        não há dependência oculta; o que não existe é FRONTEIRA para o diretório `test/` — e este
//        arquivo é mais um a repetir o padrão, pelo mesmo acessório de varredura que o `CT-216` já
//        consome por aqui.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` no manifesto e importar por `@sysloc/db/test`, ou extrair um
//        `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  listarFontesTs,
  semComentarios,
  type VarreduraDeFontes,
  varrerArquivos,
} from '../../../packages/db/test/varredura-de-fontes.ts';

/** O diretório varrido — o fonte da aplicação, e só ele. Rota de teste não entra neste conjunto. */
const FONTE_DA_APLICACAO = fileURLToPath(new URL('../src', import.meta.url));

/** O dono único da conexão com o servidor de fila, relativo a `apps/api/src`. */
const MODULO_DA_FILA = 'comum/fila.module.ts';

/** A fronteira com a biblioteca de fila — quem define o token e a fábrica. */
const FRONTEIRA_DA_FILA = 'comum/produtor-de-fila.ts';

/**
 * Os **dois** módulos de área que alcançam a fila hoje — a expectativa REVISADA.
 *
 * Escrita à mão de propósito: derivá-la da mesma varredura que o caso classifica faria a asserção
 * concordar consigo mesma, que é a forma canônica de âncora que não pode reprovar.
 */
const IMPORTADORES_DO_MODULO_DA_FILA: readonly string[] = [
  'cadastros/cadastros.module.ts',
  'cobranca-bancaria/cobranca-bancaria.module.ts',
];

/** Quem nomeia `FilaModule`: os dois importadores mais o arquivo que declara a classe. */
const ARQUIVOS_QUE_NOMEIAM_O_MODULO: readonly string[] = [
  ...IMPORTADORES_DO_MODULO_DA_FILA,
  MODULO_DA_FILA,
].sort();

/**
 * Quem nomeia o token — a fronteira que o define, o dono que o provê e os **três** serviços que
 * enfileiram.
 *
 * O eixo é diferente do de cima, e não redundante: um serviço novo **dentro** de `cadastros/` ou de
 * `cobranca-bancaria/` injeta o produtor sem que módulo algum ganhe `imports: [FilaModule]`.
 */
const ARQUIVOS_QUE_NOMEIAM_O_TOKEN: readonly string[] = [
  'cadastros/confirmacao-de-email.service.ts',
  'cobranca-bancaria/conferencia-bancaria.service.ts',
  'cobranca-bancaria/emissao-em-lote.service.ts',
  MODULO_DA_FILA,
  FRONTEIRA_DA_FILA,
].sort();

/**
 * Quem chama a fábrica — a fronteira que a exporta e o dono que a invoca, e mais ninguém.
 *
 * É o terceiro caminho de alcance, e o que o retrato do contêiner não distinguiria: uma **segunda**
 * conexão aberta sob token próprio é, para o injetor, apenas mais um provedor legítimo. O cabeçalho
 * de `produtor-de-fila.ts` a recusa por escrito, e esta é a linha que reprova quem a escrever.
 */
const ARQUIVOS_QUE_CHAMAM_A_FABRICA: readonly string[] = [MODULO_DA_FILA, FRONTEIRA_DA_FILA].sort();

/** O especificador pelo qual um módulo de área importa o dono — o que separa ligação de menção. */
const ESPECIFICADOR_DO_MODULO_DA_FILA = 'comum/fila.module.js';

/** Os decoradores de topo que o módulo dono declara. `Global` aqui abriria o alcance aos 14. */
const DECORADORES_DO_MODULO_DA_FILA: readonly string[] = ['Module'];

/**
 * Quem nomeia a **biblioteca de fila** — a fronteira, e mais ninguém.
 *
 * É o **quarto** caminho de alcance, e o único que não passa por símbolo algum deste repositório:
 * `import { Queue } from 'bullmq'` num módulo de área abre **fila própria sobre conexão própria** e
 * põe trabalho na fila sem tocar o módulo dono, o token nem a fábrica — de modo que os três eixos
 * acima ficam verdes.
 *
 * ⚠️ **Ele contorna duas garantias vivas ao mesmo tempo**, e é por isso que ele é asserção e não
 * prosa: (i) o **fecho incondicional** das filas no desligamento, cujo modo de falha declarado é o
 * processo que não termina; e (ii) a **entrada única** `semRastroDeComando`, protegida por
 * `DECISÃO FECHADA` em `comum/produtor-de-fila.ts`, cujo vetor é `err.command.args` **com a carga
 * serializada**. Uma fila aberta por fora não passa por nenhuma das duas.
 *
 * O cabeçalho de `produtor-de-fila.ts` **já afirma por escrito** ser a fronteira única com a
 * biblioteca; esta lista apenas torna executável o que ele afirma. É o fecho do `D47 · F4/T15`, que
 * os dois gates acharam independentemente: até aqui a prosa deste arquivo declarava alcance sobre
 * *"quem consegue pôr trabalho na fila"* e as três asserções cobriam três símbolos, e não o caminho.
 */
const ARQUIVOS_QUE_NOMEIAM_A_BIBLIOTECA: readonly string[] = [FRONTEIRA_DA_FILA];

/** Casa cada símbolo como IDENTIFICADOR: as âncoras impedem `MeuFilaModuleFalso` de contar. */
const NOME_DO_MODULO = /\bFilaModule\b/u;
const NOME_DO_TOKEN = /\bTOKEN_PRODUTOR_DE_FILA\b/u;
const NOME_DA_FABRICA = /\bconectarProdutorDeFila\b/u;

/**
 * Casa o **especificador** da biblioteca de fila, e não um identificador dela.
 *
 * `Queue`, `Worker` e `Job` são nomes genéricos demais para servirem de agulha — `Queue` casaria uma
 * variável local qualquer —, e o que se quer conter é a **ligação**: nenhuma delas chega a um módulo
 * de área sem que o nome do pacote apareça numa linha de importação. As aspas fazem parte do padrão
 * exatamente por isso.
 */
const ESPECIFICADOR_DA_BIBLIOTECA = /['"]bullmq['"]/u;

/** Casa o decorador aplicado no TOPO do arquivo — o de parâmetro vem sempre indentado. */
const DECORADOR_DE_TOPO = /^@([A-Za-z][A-Za-z0-9]*)/u;

/** Varre o fonte da aplicação inteiro por um identificador, com os comentários já fora. */
async function varrerPor(padrao: RegExp): Promise<VarreduraDeFontes> {
  return await varrerArquivos(await listarFontesTs(FONTE_DA_APLICACAO), (linha) =>
    padrao.test(linha),
  );
}

/** `<caminho>:<linha>` → o caminho relativo a `apps/api/src`. */
function arquivoDaOcorrencia(ocorrencia: string): string {
  return relative(FONTE_DA_APLICACAO, ocorrencia.slice(0, ocorrencia.lastIndexOf(':')));
}

/** Os arquivos distintos em que a varredura casou, ordenados. */
function arquivosDa(varredura: VarreduraDeFontes): string[] {
  return [...new Set(varredura.ocorrencias.map(arquivoDaOcorrencia))].sort();
}

/** As linhas que casaram, agrupadas por arquivo — é o que permite afirmar a ligação real. */
function linhasPorArquivo(varredura: VarreduraDeFontes): Map<string, string[]> {
  const porArquivo = new Map<string, string[]>();

  varredura.ocorrencias.forEach((ocorrencia, indice) => {
    const arquivo = arquivoDaOcorrencia(ocorrencia);
    const linhas = porArquivo.get(arquivo) ?? [];
    linhas.push(varredura.linhas[indice] ?? '');
    porArquivo.set(arquivo, linhas);
  });

  return porArquivo;
}

describe('alcance da capacidade de enfileirar (T15)', () => {
  it('apoio (T15) (a) — só o dono e DOIS módulos de área nomeiam o FilaModule, e os dois o importam', async () => {
    const varredura = await varrerPor(NOME_DO_MODULO);

    // Âncora antivácuo: sem ela, uma varredura que não lesse arquivo algum produziria conjunto
    // vazio e a igualdade abaixo reprovaria por ausência, sem dizer por quê.
    expect(
      varredura.arquivos,
      'a varredura não leu arquivo algum: o alcance seria vazio por construção',
    ).toBeGreaterThan(0);

    const alcance = arquivosDa(varredura);

    // Igualdade sobre o CONJUNTO, com a diferença NOMEADA na mensagem: é ela que faz a falha dizer
    // QUEM passou a alcançar a fila, em vez de apenas "esperava 3, obteve 4".
    expect(
      alcance,
      'a capacidade de enfileirar deixou de ser a lista revisada: ' + alcance.join(', '),
    ).toEqual([...ARQUIVOS_QUE_NOMEIAM_O_MODULO]);

    // E a menção é LIGAÇÃO, e não uma cadeia de caracteres com o nome dentro: cada módulo de área
    // traz o especificador do dono. Sem esta âncora, a igualdade acima valeria sobre um conjunto
    // cujos elementos poderiam não importar coisa alguma.
    const linhas = linhasPorArquivo(varredura);
    for (const importador of IMPORTADORES_DO_MODULO_DA_FILA) {
      expect(
        linhas.get(importador)?.some((linha) => linha.includes(ESPECIFICADOR_DO_MODULO_DA_FILA)),
        `${importador} nomeia FilaModule sem importar ${ESPECIFICADOR_DO_MODULO_DA_FILA}`,
      ).toBe(true);
    }
  });

  it('apoio (T15) (b) — o token e a fábrica têm alcance fixado, e ele não passa pelos módulos', async () => {
    const doToken = await varrerPor(NOME_DO_TOKEN);
    const daFabrica = await varrerPor(NOME_DA_FABRICA);

    expect(
      doToken.arquivos,
      'a varredura não leu arquivo algum: o alcance seria vazio por construção',
    ).toBeGreaterThan(0);

    // O produtor injetado: um serviço novo dentro de uma área que JÁ alcança a fila não faz módulo
    // algum ganhar `imports`, e por isso esta igualdade não é a de cima por outro nome.
    const consumidores = arquivosDa(doToken);
    expect(
      consumidores,
      'os consumidores do produtor de fila deixaram de ser os revisados: ' +
        consumidores.join(', '),
    ).toEqual([...ARQUIVOS_QUE_NOMEIAM_O_TOKEN]);

    // A fábrica: a SEGUNDA conexão que o cabeçalho de `produtor-de-fila.ts` recusa por escrito
    // nasceria aqui, e sob token próprio ela não apareceria em nenhuma das outras duas listas.
    const chamadores = arquivosDa(daFabrica);
    expect(
      chamadores,
      'a fábrica do produtor passou a ser chamada fora do dono: ' + chamadores.join(', '),
    ).toEqual([...ARQUIVOS_QUE_CHAMAM_A_FABRICA]);

    // O QUARTO eixo: a biblioteca em si. Ele é independente dos três acima — uma fila aberta direto
    // sobre `bullmq` não nomeia o módulo, nem o token, nem a fábrica —, e é o que faz a frase de
    // abertura deste arquivo (*"quem consegue pôr trabalho na fila"*) deixar de prometer mais do que
    // as asserções entregam. Ver {@link ARQUIVOS_QUE_NOMEIAM_A_BIBLIOTECA}.
    const daBiblioteca = await varrerPor(ESPECIFICADOR_DA_BIBLIOTECA);

    expect(
      daBiblioteca.arquivos,
      'a varredura não leu arquivo algum: o alcance seria vazio por construção',
    ).toBeGreaterThan(0);

    const importadores = arquivosDa(daBiblioteca);
    expect(
      importadores,
      'a biblioteca de fila passou a ser importada fora da fronteira: ' + importadores.join(', '),
    ).toEqual([...ARQUIVOS_QUE_NOMEIAM_A_BIBLIOTECA]);
  });

  it('apoio (T15) (c) — o módulo dono da fila NÃO é global', async () => {
    const fonte = semComentarios(await readFile(join(FONTE_DA_APLICACAO, MODULO_DA_FILA), 'utf8'));

    const decoradores = fonte
      .split('\n')
      .flatMap((linha) => {
        const casado = DECORADOR_DE_TOPO.exec(linha);
        return casado === null ? [] : [casado[1] ?? ''];
      })
      .sort();

    // Igualdade, e não ausência de `Global`: o esperado é NÃO VAZIO, de modo que a asserção também
    // é o seu próprio controle — um arquivo lido em branco, ou um caminho que deixasse de existir,
    // reprovaria em vez de passar por vacuidade.
    expect(
      decoradores,
      'os decoradores de topo do módulo dono da fila mudaram: ' + decoradores.join(', '),
    ).toEqual([...DECORADORES_DO_MODULO_DA_FILA]);
  });
});
