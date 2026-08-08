/**
 * A tradução de recusa de esquema na borda — CT-340, CT-341 e CT-343 —, e a **cardinalidade dos
 * importadores** que mantém viva a composição de ponto único — CT-356.
 * T4 da fatia `cadastro-de-imoveis-e-pessoas`, que fecha o débito **D38**.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-16 | CT-340 | `validar()` devolve o dado ANALISADO quando o esquema aprova — com a
 * |       |        | transformação dele aplicada — e, quando recusa, levanta `ErroDeAplicacao` com
 * |       |        | `codigo === CAMPO_INVALIDO`, `status === 422`, a mensagem canônica do código e
 * |       |        | `campo` igual ao caminho do PRIMEIRO problema unido por ponto — ou ao campo
 * |       |        | padrão daquele ponto de chamada, quando o caminho é vazio. (ADR-0017) |
 * | CA-16 | CT-341 | O corpo público do erro, serializado por inteiro, **não contém o valor
 * |       |        | recusado** em nenhuma grafia, e tem exatamente as chaves
 * |       |        | `{ codigo, mensagem, campo }` — a `causa` do `ErroDeAplicacao` não é
 * |       |        | publicada. Entrada não confiável nunca é repetida ao cliente. |
 * | CA-16 | CT-343 | A varredura de `apps/api/src/**`, com os comentários removidos, encontra
 * |       |        | exatamente UMA definição de `validar` — em `comum/validacao.ts` — e encontra a
 * |       |        | importação dela **exatamente** no conjunto revisado de bordas que a
 * |       |        | consomem. Nenhuma cópia nova nasce, qualquer que seja a forma sintática
 * |       |        | (D38). |
 * | CA-09 | CT-356 | A varredura de `apps/api/src/**`, com os comentários removidos, encontra a
 * |       |        | importação de `criarPessoa`/`alterarPessoa` **a partir de `@sysloc/db`**
 * |       |        | exatamente em UM módulo — `cadastros/cadastro-de-pessoa.service.ts` —, que é o
 * |       |        | único ponto onde as duas escritas cruas são compostas com
 * |       |        | `gravarCadastroSobRestricaoDeUnicidade`. O homônimo de `@sysloc/auth` é
 * |       |        | separado por asserção própria, e não por acidente do padrão. |
 *
 * Rastreabilidade: `CA-16 → CT-340, CT-341, CT-343` e `CA-09 → CT-356`. A equivalência **pela
 * borda** — as rotas que
 * já consumiam as três cópias respondendo o mesmo corpo depois da extração — é o `CT-342`, em
 * `apps/api/test/campos-fechados.e2e.spec.ts`; os dois são complementares e nenhum substitui o
 * outro: aqui se prova a função, lá se prova o que o cliente recebe.
 *
 * ---------------------------------------------------------------------------
 * A mensagem é IMPORTADA, e o literal é ancorado uma vez, noutro lugar
 * ---------------------------------------------------------------------------
 *
 * {@link MENSAGEM_POR_CODIGO} é a fonte única da mensagem de cada código, e está sob
 * `DECISÃO FECHADA` (T9 / Gate 2) em `comum/filtro-excecao.ts` justamente porque um segundo literal
 * escrito à mão faria a resposta do cliente depender de qual produtor a montou. Por isso ela é
 * **importada** aqui, e não redigitada. O literal `'requisição inválida'` continua ancorado por
 * extenso **uma vez**, no `CT-342`, que o observa pela borda — que é onde uma troca de mensagem
 * seria mudança de contrato.
 *
 * ---------------------------------------------------------------------------
 * CT-343 — asserção ESTÁTICA, e a prova de falsificação que a `testing-stack.md` exige
 * ---------------------------------------------------------------------------
 *
 * A varredura inspeciona o **texto** do código sob teste, e a rule é literal quanto ao preço disso.
 * As duas defesas estão instaladas, como no `CT-216`:
 *
 *   * **os comentários saem antes da comparação** — `varrerArquivos` aplica `semComentarios` a cada
 *     arquivo, e é o que impede a prosa dos docblocks de `usuario.controller.ts` e de
 *     `empresa.controller.ts`, que citam `validar()` por extenso, de contar como definição. Sem
 *     isso a asserção reprovaria o código **correto**, que é o defeito literal registrado na
 *     `.claude/rules/testing-stack.md`;
 *   * **a lista de arquivos é afirmada não vazia** antes das igualdades, porque uma varredura que
 *     não lesse nada produziria dois conjuntos vazios e reprovaria por ausência, sem dizer por quê.
 *
 * **As DUAS pontas do primeiro caso são afirmadas por igualdade de conjunto**, e nenhuma sozinha
 * detecta: só a definição deixaria verde um controlador que parou de importar; só a importação
 * deixaria verde uma quarta cópia dormente.
 *
 * ---------------------------------------------------------------------------
 * A TERCEIRA igualdade — por que as duas pontas fecham o caminho, e não a classe
 * ---------------------------------------------------------------------------
 *
 * As duas pontas acima reconhecem a cópia pela **forma sintática** em que ela é declarada, e por
 * isso não fecham a classe. Uma quarta cópia escrita como **membro de classe** —
 * `private validar<T>(…)` no corpo de um `@Controller`, que é a forma que um autor de controlador
 * NestJS escreve por reflexo — passa entre as duas: ela não casa
 * `function|const|let|var validar` (o `\b` exige uma dessas quatro palavras antes do nome), e o
 * arquivo que a tem **não importa nada**, de modo que o conjunto de importadores segue sendo os três
 * esperados. **Medido**: com o mutante-método aplicado e só as duas pontas instaladas, a suíte
 * inteira ficou verde em `97 passed` — o D38 reabriria em silêncio, com o caso que existe para
 * impedi-lo aprovado. É a §5 da `.claude/rules/nao-regressao.md` em estado puro: *"corrigir o caso
 * apontado não é corrigir a classe"*, e a resposta dela é atacar a topologia, não a ocorrência.
 *
 * A propriedade que a forma de declaração **não** contorna é a operação: toda tradução de recusa
 * precisa chamar `safeParse`. Daí a terceira igualdade de conjunto, sobre
 * {@link ANALISADORES_ESPERADOS} — e é ela que impede a quarta cópia de nascer em qualquer forma,
 * inclusive nas ~33 rotas que as tasks seguintes desta fatia acrescentam.
 *
 * **PROVA DE FALSIFICAÇÃO EXECUTADA** (2026-08-05), pelo procedimento da rule — mutante no fonte,
 * suíte invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por
 * `vitest run` avulso:
 *
 *   1. **controle** — árvore íntegra: `14 arquivos, 97 casos, 0 falhas`, este caso verde;
 *   2. **mutante A (quarta cópia plantada)** — `apps/api/src/saude/saude.controller.ts` ganhou uma
 *      `export function validar<T>(…)` no escopo do módulo. Aplicação **conferida no fonte** antes
 *      da execução (`grep -c 'function validar'` = 1 naquele arquivo). Resultado:
 *      `1 failed | 96 passed`, e a mensagem nomeou o arquivo —
 *      `a definição de validar() deixou de ser única: comum/validacao.ts, saude/saude.controller.ts`;
 *   3. **mutante B (importador removido, e SÓ ele)** — em
 *      `apps/api/src/master/empresa.controller.ts`, a importação nomeada virou importação de espaço
 *      de nomes (`import * as validacaoComum from '../comum/validacao.js'`) e as sete chamadas
 *      passaram a ser `validacaoComum.validar(…)`. **Nenhuma cópia local foi restaurada**, de
 *      propósito: com uma cópia, a ponta da DEFINIÇÃO reprovaria primeiro e a ponta dos
 *      IMPORTADORES nunca chegaria a ser exercitada — e é justamente ela que este mutante existe
 *      para exercitar. Aplicação conferida no fonte (`import { validar }` = 0 ocorrências, sete
 *      chamadas qualificadas). Resultado: `1 failed | 96 passed`, com a definição **verde** e a
 *      mensagem nomeando o conjunto reduzido —
 *      `os importadores de validar() deixaram de ser os três controladores:
 *       autenticacao/senha.controller.ts, usuarios/usuario.controller.ts`;
 *   4. **mutante C (quarta cópia como MEMBRO DE CLASSE)** — o mutante da rodada 2, e o único que
 *      exercita a terceira igualdade. `apps/api/src/saude/saude.controller.ts` ganhou, **dentro do
 *      corpo da classe**, `private validar<T>(esquema: ZodType<T>, valor: unknown)` chamando
 *      `esquema.safeParse(valor)` — mais um `void this.validar;` no manipulador raso, sem o qual
 *      `noUnusedLocals` recusaria a compilação. Aplicação conferida no fonte antes de cada execução
 *      (`private validar` = 1 ocorrência, e `\b(function|const|let|var)\s+validar\b` = **0**, que é
 *      o ponto). Duas execuções, e é o par que prova:
 *        * **com apenas as duas pontas instaladas** — `14 arquivos, 97 casos, 0 falhas`. O caso
 *          ficou **VERDE** com uma quarta cópia viva no fonte. É a demonstração do buraco, e sem
 *          ela a terceira igualdade seria acréscimo sem defeito medido que a justifique;
 *        * **com a terceira igualdade instalada** — `1 failed | 97 passed`, com o caso das duas
 *          pontas ainda verde (o que confirma que ele não a detecta) e a mensagem nomeando o
 *          intruso: `a análise de entrada com Zod deixou de acontecer em dois pontos:
 *          comum/validacao.ts, configuracao/ambiente.ts, saude/saude.controller.ts`;
 *   5. **reversão** — os arquivos foram restaurados dos respectivos backups, a ausência de resíduo
 *      foi conferida por `grep` (`safeParse` de volta aos dois pontos esperados), e o controle
 *      reexecutou verde em `98 passed`.
 *
 * A varredura roda sobre `apps/api/src`, e arquivo de teste **não entra nesse conjunto**: este
 * próprio arquivo cita `validar` por extenso e vive em `apps/api/test/`.
 *
 * ---------------------------------------------------------------------------
 * CT-356 — por que a invariante de COMPOSIÇÃO mora neste arquivo
 * ---------------------------------------------------------------------------
 *
 * `packages/db/src/cadastro-de-pessoa.ts` publica `gravarCadastroSobRestricaoDeUnicidade` **e**
 * mantém `criarPessoa` e `alterarPessoa` subindo o `23505` cru — desenho inverso ao de `./imovel.ts`,
 * e deliberado: são o `CT-349` e o `CT-352` que observam o erro cru para demonstrar que o mecanismo
 * da unicidade é a restrição do banco, e traduzir por dentro os apagaria. O preço da inversão é uma
 * invariante nova: *"toda escrita nas três tabelas atravessa o envoltório"*. Três docblocks a
 * declaram — *"quem compõe as duas coisas é a borda, num ponto só"* — e, até este caso, **nada a
 * impunha**. Uma escrita nova que chamasse `criarPessoa` direto, com documento repetido na empresa,
 * produziria `23505` do driver; `comum/filtro-excecao.ts` só reconhece `ErroDeAplicacao` e
 * `HttpException`, e o cliente receberia `500 ERRO_INTERNO` onde o contrato promete `422
 * CAMPO_INVALIDO` com `detalhes.conflito`.
 *
 * **A escolha do arquivo é pelo assunto, e o assunto é a BORDA.** Quem pode violar a invariante é um
 * módulo de `apps/api/src` — o pacote `@sysloc/db` publica as duas funções por decisão auditada em
 * `packages/db/test/unidade-de-trabalho.spec.ts`, e ali a asserção certa já existe e continua certa.
 * O que faltava é do lado de cá, e é exatamente a forma que este arquivo já hospeda: a igualdade de
 * conjunto sobre quem importa o quê, com o acessório de varredura, a âncora de não-vacuidade e a
 * expectativa escrita à mão que {@link DEFINIDOR_ESPERADO} e {@link IMPORTADORES_ESPERADOS}
 * estabeleceram. Pô-la em `packages/db/test/` inverteria a camada — o teste do pacote de dados
 * passaria a conhecer o layout de `apps/api/src` para auditar consumidores que ele não governa.
 *
 * **A colisão de nome é tratada explicitamente, e essa é a razão de o padrão exigir o especificador
 * do módulo.** Existem DUAS funções `criarPessoa` exportadas no monorepo: a de `@sysloc/auth`
 * (`packages/auth/src/onboarding.ts`, onboarding de identidade), consumida por
 * `usuarios/usuario.service.ts` e por `master/empresa.service.ts`, e a de `@sysloc/db` (cadastro de
 * pessoa do domínio). São pacotes distintos, então não há conflito de compilação — e é isso que torna
 * um `import` do pacote errado plausível **e silencioso**. Um padrão que casasse só o nome poria
 * cinco módulos no conjunto e reprovaria o código correto. Daí a segunda asserção, sobre
 * {@link HOMONIMOS_DE_IDENTIDADE_ESPERADOS}: ela afirma que o homônimo **existe, é visto e é separado
 * de propósito**. Sem ela, um padrão cujo especificador de módulo estivesse quebrado — casando nada —
 * seria indistinguível de um que discrimina corretamente.
 *
 * **PROVA DE FALSIFICAÇÃO EXECUTADA** (2026-08-06), registrada como **MT9-8**, pelo procedimento da
 * `.claude/rules/testing-stack.md` — mutante no fonte, suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso. Âncoras simbólicas, nunca número
 * de linha:
 *
 *   1. **controle** — árvore íntegra: `17 arquivos, 117 casos, 0 falhas`, este caso verde;
 *   2. **mutante (importador ilegítimo plantado)** — `apps/api/src/imoveis/imovel.service.ts`, que já
 *      importa de `@sysloc/db`, teve `criarPessoa` acrescentado à lista de nomeados daquela
 *      importação, mais um `void criarPessoa;` no corpo de `ImovelService.criar` — sem o qual
 *      `noUnusedLocals` recusaria a compilação, e o mutante nunca chegaria a ser executado. É
 *      **exatamente o defeito descrito**: um módulo novo alcançando a escrita crua sem passar pelo
 *      compositor. Aplicação conferida no fonte antes da execução. Resultado: `1 failed | 116 passed`,
 *      com a mensagem nomeando o intruso — `as escritas cruas de cadastro ganharam importador fora do
 *      compositor: cadastros/cadastro-de-pessoa.service.ts, imoveis/imovel.service.ts`;
 *   3. **reversão** — o arquivo foi restaurado do backup, a identidade com o original foi conferida
 *      por `diff` (saída vazia), e o controle reexecutou verde em `117 passed`.
 *
 * Sem colaborador algum e sem fronteira real de execução nos CT-340 e CT-341 — a função é pura. O
 * CT-343 e o CT-356 atravessam o **filesystem**, que é a fronteira dos dois.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
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
import {
  listarFontesTs,
  semComentarios,
  varrerArquivos,
} from '../../../packages/db/test/varredura-de-fontes.ts';
import { MENSAGEM_POR_CODIGO } from '../src/comum/filtro-excecao.ts';
import { validar } from '../src/comum/validacao.ts';

/** O status que `CodigoErro.CAMPO_INVALIDO` implica (`STATUS_POR_CODIGO`, `@sysloc/shared`). */
const STATUS_DE_CAMPO_INVALIDO = 422;

/** Campo padrão de quem valida um CORPO — o que as bordas passam nas rotas de escrita. */
const CAMPO_PADRAO_DO_CORPO = 'corpo';

/** Campo padrão de quem valida o IDENTIFICADOR de rota — um escalar, sem caminho a nomear. */
const CAMPO_PADRAO_DO_IDENTIFICADOR = 'id';

/** Campo padrão das linhas do CT-341, escolhido para não coincidir com valor sentinela nenhum. */
const CAMPO_PADRAO_DO_DOCUMENTO = 'documento';

/** Objeto estrito de um nível — a forma mais comum de corpo desta superfície. */
const ESQUEMA_DE_UM_NIVEL = z.strictObject({ nome: z.string().min(1) });

/** Objeto com arranjo aninhado — a forma do ajuste de permissões, que produz caminho composto. */
const ESQUEMA_ANINHADO = z.strictObject({
  ajustes: z.array(z.strictObject({ chave: z.string().min(1) })),
});

/** Escalar de rota. Recusa **sem caminho**, e é ele que exercita o ramo do campo padrão. */
const ESQUEMA_ESCALAR = z.uuid();

/**
 * Escalar **com transformação declarada** — a forma de `ESQUEMA_DO_IDENTIFICADOR` da borda de
 * pessoas, que canoniza a caixa do UUID sob `DECISÃO FECHADA` (T8 / Gate 2).
 */
const ESQUEMA_COM_TRANSFORMACAO = z.uuid().transform((valor) => valor.toLowerCase());

/** O identificador aprovado, em caixa MISTA — é a caixa que torna a transformação observável. */
const UUID_EM_CAIXA_MISTA = '3F2504E0-4F89-41D3-9A0C-0305E82C3301';

/** O mesmo identificador na forma canônica que a transformação do esquema produz. */
const UUID_CANONICO = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** Uma linha da tabela de recusas do CT-340. */
interface LinhaRecusada {
  readonly rotulo: string;
  /** O campo que a recusa deve nomear — declarado por linha, nunca derivado da chamada. */
  readonly campo: string;
  /** A chamada sob prova. Guardar o esquema e o valor exigiria apagar o tipo do esquema. */
  readonly chamar: () => unknown;
}

/**
 * As três formas de caminho que as bordas produzem hoje, mais a chave desconhecida.
 *
 * A linha `sem_caminho` é a que discrimina o ramo do campo padrão — sem ela, uma extração que
 * sempre usasse o caminho passaria. E a linha `chave_desconhecida` é a que discrimina o
 * **argumento**: o campo padrão dela é outro (`'corpo'`, e não `'id'`), de modo que uma
 * implementação que fixasse um literal no lugar do parâmetro reprovaria numa das duas.
 *
 * **`chave_desconhecida` cai no campo padrão, e isso é MEDIDO.** O Zod v4 reporta a chave
 * desconhecida de um `strictObject` como `unrecognized_keys` com `path: []` — o nome da chave viaja
 * em `keys`, que `validar()` não lê, e nunca leu nas três cópias. Esperar `'empresaId'` aqui
 * exigiria MUDAR o comportamento da função extraída, e a §3 da task é literal: *"esta é uma
 * extração, não uma melhoria"*.
 */
const RECUSADAS: readonly LinhaRecusada[] = [
  {
    rotulo: 'caminho_de_um_nivel',
    campo: 'nome',
    chamar: () => validar(ESQUEMA_DE_UM_NIVEL, { nome: '' }, CAMPO_PADRAO_DO_CORPO),
  },
  {
    rotulo: 'caminho_aninhado',
    campo: 'ajustes.0.chave',
    chamar: () => validar(ESQUEMA_ANINHADO, { ajustes: [{ chave: '' }] }, CAMPO_PADRAO_DO_CORPO),
  },
  {
    rotulo: 'sem_caminho',
    campo: CAMPO_PADRAO_DO_IDENTIFICADOR,
    chamar: () => validar(ESQUEMA_ESCALAR, 'nao-e-uuid', CAMPO_PADRAO_DO_IDENTIFICADOR),
  },
  {
    rotulo: 'chave_desconhecida',
    campo: CAMPO_PADRAO_DO_CORPO,
    chamar: () =>
      validar(ESQUEMA_DE_UM_NIVEL, { nome: 'Fulana', empresaId: 'alheia' }, CAMPO_PADRAO_DO_CORPO),
  },
];

/**
 * Valores recusados escolhidos para serem **reconhecíveis se vazarem** — documento, endereço,
 * marcação e uma cadeia que só existe para este caso.
 */
const SENSIVEIS: readonly { readonly rotulo: string; readonly valor: string }[] = [
  { rotulo: 'documento', valor: '529.982.247-25xxx' },
  { rotulo: 'email', valor: 'Pessoa.Sensivel+marca@exemplo.com.br' },
  { rotulo: 'marcacao', valor: '<script>alerta</script>' },
  { rotulo: 'cadeia_longa', valor: 'AAAA-VALOR-QUE-NAO-PODE-SAIR-AAAA' },
];

/** O diretório varrido pelo CT-343 — o fonte da aplicação, e só ele. */
const FONTE_DA_APLICACAO = fileURLToPath(new URL('../src', import.meta.url));

/**
 * Casa a **definição** de `validar` no escopo do módulo, como função ou como constante.
 *
 * As âncoras `\b` impedem `validarCoerenciaDeAjustes` de contar. Os comentários já saíram antes de
 * a linha chegar aqui, então menção em prosa não alcança este ponto.
 */
const DEFINICAO_DE_VALIDAR = /\b(?:function|const|let|var)\s+validar\b/u;

/** Casa a **importação** do símbolo `validar` a partir do módulo comum, na mesma linha. */
const IMPORTACAO_DE_VALIDAR = /^\s*import\s.*\bvalidar\b.*['"][^'"]*comum\/validacao\.js['"]/u;

/**
 * O único definidor legítimo, relativo a `apps/api/src`.
 *
 * Literal e escrito à mão de propósito: ele é a **expectativa revisada**, e derivá-lo da mesma
 * varredura que o caso classifica faria o caso concordar consigo mesmo.
 */
const DEFINIDOR_ESPERADO = 'comum/validacao.ts';

/**
 * Os importadores legítimos, relativos a `apps/api/src`, em ordem estável.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e é esta lista que descrevia o estado
 * anterior. Ela é a **expectativa revisada** de quantas bordas consomem a tradução única, e a T5 da
 * fatia `cadastro-de-imoveis-e-pessoas` publica a quarta — as seis rotas de `/v1/conjuntos`. O que o
 * `CT-343` existe para reprovar é a **segunda definição**, e a ponta que a mede é
 * {@link DEFINIDOR_ESPERADO}, que **não muda**: continua sendo `['comum/validacao.ts']`, um só. O
 * conjunto que cresce é o dos **consumidores**, e ele crescer é precisamente o desfecho desejado —
 * cada borda nova que importa em vez de copiar é o débito D38 continuando fechado.
 *
 * A marca de que a edição é legítima, e não afrouxamento: a ponta da DEFINIÇÃO permanece em um
 * elemento, a igualdade (nunca contenção) segue sendo asserida nas três pontas, e
 * {@link ANALISADORES_ESPERADOS} — que é a que fecha a CLASSE, independente da forma sintática —
 * **também não muda**: o controlador novo chama `validar`, e não `safeParse`.
 */
const IMPORTADORES_ESPERADOS = [
  'autenticacao/senha.controller.ts',
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e é esta lista que descrevia o estado
  // anterior. A T9 publica a **sétima** borda — as dezoito rotas de `/v1/locadores`,
  // `/v1/locatarios` e `/v1/fiadores` —, e ela **importa** a tradução única em vez de copiá-la, que é
  // exatamente o desfecho que o `CT-343` existe para premiar.
  //
  // Ela entra como UMA linha, e não três, e a diferença é conteúdo: as seis operações dos três papéis
  // estão escritas uma vez em `cadastros/superficie-de-cadastro.ts`, e os três controladores só
  // declaram decoradores e delegam. Três importadores aqui significariam três cópias do
  // comportamento — que é o defeito irmão do D12, fechado nesta mesma task.
  //
  // Vale o resto do parágrafo acima: a ponta da DEFINIÇÃO permanece em um elemento,
  // {@link ANALISADORES_ESPERADOS} não muda (a superfície nova chama `validar`, e não `safeParse`), e
  // a igualdade (nunca contenção) segue sendo asserida nas três pontas.
  'cadastros/superficie-de-cadastro.ts',
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e é esta lista que descrevia o estado
  // anterior. A T7 publica a **sexta** borda — as três rotas de `/v1/imoveis/:id/comodos` —, e ela
  // **importa** a tradução única em vez de copiá-la, que é exatamente o desfecho que o `CT-343`
  // existe para premiar. Vale aqui, palavra por palavra, o parágrafo acima: a ponta da DEFINIÇÃO
  // permanece em um elemento, {@link ANALISADORES_ESPERADOS} não muda (o controlador novo chama
  // `validar`, e não `safeParse`), e a igualdade (nunca contenção) segue sendo asserida nas três
  // pontas.
  'imoveis/comodo.controller.ts',
  'imoveis/conjunto.controller.ts',
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e é esta lista que descrevia o estado
  // anterior. A T6 publica a **quinta** borda — as seis rotas de `/v1/imoveis` —, e ela **importa**
  // a tradução única em vez de copiá-la, que é exatamente o desfecho que o `CT-343` existe para
  // premiar. Vale aqui, palavra por palavra, o parágrafo acima: a ponta da DEFINIÇÃO permanece em um
  // elemento, {@link ANALISADORES_ESPERADOS} não muda (o controlador novo chama `validar`, e não
  // `safeParse`), e a igualdade (nunca contenção) segue sendo asserida nas três pontas.
  'imoveis/imovel.controller.ts',
  'master/empresa.controller.ts',
  'usuarios/usuario.controller.ts',
];

/**
 * Casa a **chamada** de `safeParse` — a operação que toda tradução de recusa faz, seja qual for a
 * forma sintática em que ela é declarada.
 *
 * É esta a ponta que fecha a CLASSE, e não apenas o caminho: {@link DEFINICAO_DE_VALIDAR} reconhece
 * definição no **escopo do módulo**, e uma quarta cópia escrita como **membro de classe**
 * (`private validar<T>(…)` dentro de um `@Controller`) não casa nenhuma das quatro alternativas
 * dela — nem a ponta dos importadores a pega, porque quem tem cópia local justamente **não
 * importa**. Método privado é a forma que um autor de controlador NestJS escreve por reflexo, e as
 * tasks seguintes desta fatia acrescentam ~33 rotas em controladores novos.
 */
const CHAMADA_DE_SAFE_PARSE = /\bsafeParse\s*\(/u;

/**
 * Os únicos dois pontos de `apps/api/src` que analisam entrada com Zod, relativos àquele diretório.
 *
 * Não são a mesma coisa, e conviver não é acidente: `comum/validacao.ts` traduz recusa de
 * **requisição** no envelope da ADR-0017, e `configuracao/ambiente.ts` valida a **configuração de
 * arranque**, que não tem cliente a quem responder e falha o processo em vez de recusar. O que a
 * igualdade abaixo fixa é a **cardinalidade**: qualquer terceiro ponto que passe a analisar entrada
 * é, por construção, ou uma cópia da tradução ou uma decisão nova — e as duas precisam ser vistas.
 *
 * Literal e escrito à mão, pelo mesmo critério de {@link DEFINIDOR_ESPERADO}: é a **expectativa
 * revisada**, e derivá-la da varredura que o caso classifica faria o caso concordar consigo mesmo.
 */
const ANALISADORES_ESPERADOS = ['comum/validacao.ts', 'configuracao/ambiente.ts'];

/**
 * Casa uma **declaração de importação inteira** a partir de `@sysloc/db`, capturando os nomeados.
 *
 * Ela é aplicada ao arquivo INTEIRO, e não linha a linha como as três acima, e a diferença não é
 * estilo: a importação sob prova é **multilinha** — `cadastros/cadastro-de-pessoa.service.ts` traz
 * dez nomeados, um por linha, e o especificador do módulo fica dez linhas abaixo de `criarPessoa`.
 * Um predicado de linha que exigisse o símbolo e o módulo no mesmo texto **nunca casaria**, e a
 * asserção seria daquelas que não podem falhar pelo defeito que perseguem — o modo de falha que a
 * `.claude/rules/testing-stack.md` nomeia como causa de três das cinco reprovações da T2.
 *
 * O especificador do módulo é parte do padrão **por exigência**, não por completude: ver a seção da
 * colisão de nome no cabeçalho.
 */
const IMPORTACAO_DE_SYSLOC_DB = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@sysloc\/db['"]/gu;

/** A gêmea da anterior para `@sysloc/auth`, que publica o **homônimo** de identidade. */
const IMPORTACAO_DE_SYSLOC_AUTH =
  /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@sysloc\/auth['"]/gu;

/**
 * As duas escritas **cruas** de cadastro de pessoa — as que sobem o `23505` do driver sem traduzir.
 *
 * Elas seguem exportadas por decisão declarada: o `CT-349` e o `CT-352` observam o erro cru para
 * demonstrar que o mecanismo da unicidade é a restrição do banco. É por seguirem exportadas que a
 * cardinalidade dos importadores precisa ser afirmada.
 */
const ESCRITAS_CRUAS_DE_CADASTRO = ['alterarPessoa', 'criarPessoa'];

/**
 * O único módulo de `apps/api/src` autorizado a alcançar as duas escritas cruas — o compositor.
 *
 * Literal e escrito à mão, pelo mesmo critério de {@link DEFINIDOR_ESPERADO}: é a **expectativa
 * revisada**, e derivá-la da varredura que o caso classifica faria o caso concordar consigo mesmo.
 * É ele que compõe `gravarCadastroSobRestricaoDeUnicidade` com a escrita, num ponto só.
 */
const COMPOSITOR_ESPERADO = ['cadastros/cadastro-de-pessoa.service.ts'];

/**
 * Os dois módulos que consomem o **homônimo** `criarPessoa` de `@sysloc/auth` — onboarding de
 * identidade, e não cadastro de domínio.
 *
 * Eles são legítimos e nada têm a ver com a invariante acima. Afirmá-los é o que impede a asserção do
 * compositor de passar por acidente: um padrão cujo especificador de módulo estivesse quebrado
 * casaria nada aqui, e a colisão deixaria de estar sob prova.
 */
const HOMONIMOS_DE_IDENTIDADE_ESPERADOS = [
  'master/empresa.service.ts',
  'usuarios/usuario.service.ts',
];

describe('CT-340 — a tradução nomeia o campo pelo caminho, ou pelo campo padrão quando não há', () => {
  it.each(RECUSADAS)('$rotulo recusa nomeando $campo', ({ chamar, campo }) => {
    const erro = capturarRecusa(chamar);

    // O status vem do CÓDIGO, e não é parâmetro de quem levanta — afirmá-lo é o que impede a
    // extração de trocar o código por um cujo status seja outro.
    expect(erro.status).toBe(STATUS_DE_CAMPO_INVALIDO);

    // Corpo INTEIRO por igualdade, e não presença de campo: um envelope que ganhasse `detalhes`
    // — com o `ZodError` dentro, que é por onde a entrada recusada vazaria — reprova aqui.
    expect(erro.paraCorpo()).toEqual({
      codigo: CodigoErro.CAMPO_INVALIDO,
      mensagem: MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
      campo,
    });
  });

  it('a linha aprovada devolve o dado ANALISADO, com a transformação do esquema aplicada', () => {
    // O companheiro positivo, e ele não é decorativo: a extração não pode virar um `parse` que
    // descarte `transform`. Uma implementação que devolvesse o valor de ENTRADA em vez de
    // `resultado.data` passaria em todas as linhas recusadas e quebraria a canonização da caixa do
    // UUID na borda de pessoas — que está sob `DECISÃO FECHADA` por ter fechado uma escalada de
    // privilégio.
    expect(validar(ESQUEMA_COM_TRANSFORMACAO, UUID_EM_CAIXA_MISTA, CAMPO_PADRAO_DO_CORPO)).toBe(
      UUID_CANONICO,
    );

    // E as duas formas são MESMO diferentes: sem esta linha, um esquema cuja transformação fosse
    // inerte tornaria a igualdade acima infalsificável.
    expect(UUID_EM_CAIXA_MISTA).not.toBe(UUID_CANONICO);
  });
});

describe('CT-341 — o valor recusado não vaza para a mensagem, para o campo nem para os detalhes', () => {
  it.each(SENSIVEIS)('o corpo da recusa de $rotulo não carrega o valor informado', ({ valor }) => {
    // Duas formas da MESMA recusa: o valor como escalar de rota (campo vindo do padrão) e o mesmo
    // valor dentro de um objeto (campo vindo do caminho). A segunda existe porque é ali que o
    // caminho é composto a partir da chave — e uma implementação que compusesse o campo a partir do
    // VALOR, em vez da chave, só reprovaria nela.
    const comoEscalar = capturarRecusa(() =>
      validar(ESQUEMA_ESCALAR, valor, CAMPO_PADRAO_DO_DOCUMENTO),
    );
    const dentroDeObjeto = capturarRecusa(() =>
      validar(
        z.strictObject({ [CAMPO_PADRAO_DO_DOCUMENTO]: z.uuid() }),
        { [CAMPO_PADRAO_DO_DOCUMENTO]: valor },
        CAMPO_PADRAO_DO_CORPO,
      ),
    );

    for (const erro of [comoEscalar, dentroDeObjeto]) {
      const corpo = erro.paraCorpo();

      // As chaves publicadas, por igualdade de conjunto — o COMPLEMENTO obrigatório do caso: é por
      // `detalhes` que o vazamento reentraria, e a `causa` do `ErroDeAplicacao` (que carrega o
      // `ZodError`, e nele o valor recusado) NÃO é publicada.
      expect(Object.keys(corpo).sort()).toEqual(['campo', 'codigo', 'mensagem']);

      // Âncora de não-vacuidade: o corpo é o esperado, e não um objeto vazio que passaria as duas
      // negativas abaixo por construção.
      expect(corpo.campo).toBe(CAMPO_PADRAO_DO_DOCUMENTO);

      // A asserção é sobre o CORPO INTEIRO serializado, e não só sobre `mensagem` — um campo novo
      // que ecoasse a entrada seria pego aqui.
      const serializado = JSON.stringify(corpo);
      expect(serializado).not.toContain(valor);
      expect(serializado.toLowerCase()).not.toContain(valor.toLowerCase());
    }
  });
});

describe('CT-343 — `validar` é definida num arquivo só e importada pelas bordas que a consomem', () => {
  it('não restou cópia: uma definição em comum/validacao.ts e o conjunto revisado de importadores', async () => {
    const arquivos = await listarFontesTs(FONTE_DA_APLICACAO);
    const definicoes = await varrerArquivos(arquivos, (linha) => DEFINICAO_DE_VALIDAR.test(linha));
    const importacoes = await varrerArquivos(arquivos, (linha) =>
      IMPORTACAO_DE_VALIDAR.test(linha),
    );

    // Âncora: sem ela, uma varredura que não lesse arquivo algum produziria conjuntos vazios e as
    // igualdades abaixo reprovariam por ausência, sem dizer por quê.
    expect(
      definicoes.arquivos,
      'a varredura não leu arquivo algum: a cardinalidade seria zero por construção',
    ).toBeGreaterThan(0);

    const definidores = [...new Set(definicoes.ocorrencias.map(arquivoDaOcorrencia))].sort();
    expect(
      definidores,
      `a definição de validar() deixou de ser única: ${definidores.join(', ')}`,
    ).toEqual([DEFINIDOR_ESPERADO]);

    const importadores = [...new Set(importacoes.ocorrencias.map(arquivoDaOcorrencia))].sort();
    expect(
      importadores,
      `os importadores de validar() deixaram de ser o conjunto revisado: ${importadores.join(', ')}`,
    ).toEqual(IMPORTADORES_ESPERADOS);
  });

  it('nem por outra forma sintática: a análise de entrada acontece em dois pontos, e só neles', async () => {
    const arquivos = await listarFontesTs(FONTE_DA_APLICACAO);
    const analises = await varrerArquivos(arquivos, (linha) => CHAMADA_DE_SAFE_PARSE.test(linha));

    expect(
      analises.arquivos,
      'a varredura não leu arquivo algum: a cardinalidade seria zero por construção',
    ).toBeGreaterThan(0);

    // A ponta que fecha a CLASSE. As duas asserções do caso acima fecham o CAMINHO — a definição no
    // escopo do módulo e a importação —, e uma cópia declarada como MEMBRO DE CLASSE escapa das
    // duas: ela não casa `function|const|let|var validar`, e o arquivo que a tem não importa nada.
    // `safeParse` é a operação que ela **precisa** fazer para existir, e por isso a igualdade abaixo
    // não depende da forma em que a cópia foi escrita.
    const analisadores = [...new Set(analises.ocorrencias.map(arquivoDaOcorrencia))].sort();
    expect(
      analisadores,
      `a análise de entrada com Zod deixou de acontecer em dois pontos: ${analisadores.join(', ')}`,
    ).toEqual(ANALISADORES_ESPERADOS);
  });
});

describe('CT-356 — as escritas cruas de cadastro têm UM importador, e ele é o compositor', () => {
  it('nenhum módulo alcança criarPessoa/alterarPessoa de @sysloc/db fora do serviço de cadastro', async () => {
    const arquivos = await listarFontesTs(FONTE_DA_APLICACAO);

    const consumidoresDeDb = await modulosQueImportam(
      arquivos,
      IMPORTACAO_DE_SYSLOC_DB,
      () => true,
    );

    // Âncora de não-vacuidade E de discriminação, numa asserção só. Ela barra os dois modos de
    // aprovação vazia: um padrão quebrado, que não casasse importação alguma, produziria conjunto
    // vazio e a igualdade abaixo reprovaria por ausência sem dizer por quê; e um filtro de símbolo
    // que aceitasse tudo tornaria os DOIS conjuntos iguais, o que aqui é impossível por construção.
    expect(
      consumidoresDeDb.length,
      'a varredura não casou importação alguma de @sysloc/db: o conjunto seria vazio por construção',
    ).toBeGreaterThan(COMPOSITOR_ESPERADO.length);

    const compositores = await modulosQueImportam(
      arquivos,
      IMPORTACAO_DE_SYSLOC_DB,
      importaAlguma(ESCRITAS_CRUAS_DE_CADASTRO),
    );

    // Igualdade, nunca contenção: é o que faz o consumidor futuro REPROVAR em vez de passar em
    // silêncio. Um módulo novo que chamasse `criarPessoa` direto responderia `500 ERRO_INTERNO` a um
    // documento repetido, onde o contrato promete `422` com `detalhes.conflito`.
    expect(
      compositores,
      `as escritas cruas de cadastro ganharam importador fora do compositor: ${compositores.join(', ')}`,
    ).toEqual(COMPOSITOR_ESPERADO);

    // O homônimo de `@sysloc/auth`, afirmado por igualdade própria: ele existe, é visto, e é
    // separado de propósito — e não porque o especificador de módulo do padrão casaria nada.
    const homonimos = await modulosQueImportam(
      arquivos,
      IMPORTACAO_DE_SYSLOC_AUTH,
      importaAlguma(ESCRITAS_CRUAS_DE_CADASTRO),
    );
    expect(
      homonimos,
      `os consumidores do homônimo de identidade deixaram de ser os dois serviços: ${homonimos.join(', ')}`,
    ).toEqual(HOMONIMOS_DE_IDENTIDADE_ESPERADOS);
  });
});

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/**
 * Os módulos, relativos a `apps/api/src`, que têm ao menos uma declaração de importação casada por
 * `declaracao` cuja lista de nomeados o predicado `aceita`.
 *
 * Lê o arquivo INTEIRO com os comentários fora, e não linha a linha: a declaração sob prova é
 * multilinha. Ver {@link IMPORTACAO_DE_SYSLOC_DB}.
 */
async function modulosQueImportam(
  arquivos: readonly string[],
  declaracao: RegExp,
  aceita: (nomeados: string) => boolean,
): Promise<string[]> {
  const modulos: string[] = [];

  for (const caminho of arquivos) {
    const fonte = semComentarios(await readFile(caminho, 'utf8'));

    for (const [, nomeados] of fonte.matchAll(declaracao)) {
      if (aceita(nomeados ?? '')) {
        modulos.push(caminho.slice(FONTE_DA_APLICACAO.length + 1));
        break;
      }
    }
  }

  return [...new Set(modulos)].sort();
}

/** Aceita a lista de nomeados que traga **qualquer** um dos símbolos, como palavra inteira. */
function importaAlguma(simbolos: readonly string[]): (nomeados: string) => boolean {
  return (nomeados) =>
    simbolos.some((simbolo) => new RegExp(`\\b${simbolo}\\b`, 'u').test(nomeados));
}

/**
 * Executa a chamada e devolve o `ErroDeAplicacao` que ela levantou.
 *
 * A chamada que **não** recusa é falha do caso, e não silêncio: sem este ramo, uma implementação
 * que aprovasse tudo deixaria o `it.each` inteiro sem asserção nenhuma a executar.
 */
function capturarRecusa(chamar: () => unknown): ErroDeAplicacao {
  let devolvido: unknown;

  try {
    devolvido = chamar();
  } catch (erro) {
    if (erro instanceof ErroDeAplicacao) {
      return erro;
    }
    throw erro;
  }

  throw new Error(`a chamada não recusou: devolveu ${JSON.stringify(devolvido)}`);
}

/** `…/apps/api/src/comum/validacao.ts:50` → `comum/validacao.ts`. */
function arquivoDaOcorrencia(ocorrencia: string): string {
  const semLinha = ocorrencia.slice(0, ocorrencia.lastIndexOf(':'));
  return semLinha.slice(FONTE_DA_APLICACAO.length + 1);
}
