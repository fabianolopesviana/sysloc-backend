/**
 * O contrato das filas do produto — a definição de cada uma é **uma**, e é deste pacote.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | apoio  | O nome da fila e a forma da carga da confirmação são definidos em **um**
 * |       |        | arquivo só da árvore versionada — `packages/shared/src/fila.ts` —, e a lista
 * |       |        | dos arquivos que os definem é afirmada por **igualdade**, nunca por presença.
 * |       |        | Os dois símbolos saem pelo barril do pacote, de modo que produtor e consumidor
 * |       |        | os alcancem pela **fronteira** em vez de os redigitarem. |
 * | CA-09 | apoio  | Companheiro negativo do detector: a **segunda definição** é reconhecida (em
 * |       |        | cópia em memória, com o defeito reintroduzido), e a **importação** e a
 * |       |        | **menção** do mesmo símbolo **não** são — sem esta metade, um detector cego
 * |       |        | acusaria todo consumidor legítimo, e um detector frouxo não veria a cópia. |
 * | §4.3  | apoio  | **T15** · Os **quatro** símbolos das duas filas da cobrança bancária têm
 * | (T15) |        | definição única no mesmo arquivo, saem pelo barril, e os dois nomes de fila
 * |       |        | são `emissao-em-lote` e `conferencia-bancaria` — **distintos entre si e do da
 * |       |        | confirmação**, porque nome repetido faria duas naturezas de trabalho caírem
 * |       |        | na mesma fila. |
 * | CA-20 | apoio  | **T15** · As duas cargas **declaram no fonte** exatamente `{ empresaId, loteId }`
 * | (T15) |        | e `{ empresaId, conferenciaId }`, os quatro **obrigatórios** — nenhum material,
 * |       |        | senha ou envelope, e **nenhum campo opcional**, que é a forma em que um campo
 * |       |        | novo entra sem quebrar compilação alguma. Afirmado por igualdade de conjunto
 * |       |        | sobre o **texto** de `packages/shared/src/fila.ts`, com o marcador de
 * |       |        | opcionalidade dentro do conjunto; a medição da **saída real** é do `CT-935`,
 * |       |        | em `apps/api/test/segredo-nao-escapa.e2e.spec.ts`. |
 * | §4.3  | apoio  | **T15** · Companheiro negativo do detector sobre os símbolos novos, pela mesma
 * | (T15) |        | razão da linha acima: cópia reconhecida, import e menção não. |
 *
 * Rastreabilidade: `CA-09 → apoio (RN-07)` · `CA-20 → apoio (T15)`.
 *
 * ===========================================================================
 * Por que este arquivo existe ao lado do `CT-638`
 * ===========================================================================
 *
 * O `CT-638` (em `protocolo-antirregressao.spec.ts`) afirma a unicidade dos **nove símbolos que o
 * D32 mandou extrair**, e a lista dele é literal e fechada — ela descreve o débito que foi pago, e
 * crescê-la mudaria o que aquele caso registra. Os símbolos das filas que nasceram **depois** do
 * fecho, com produtor **de produção** do outro lado (a borda HTTP), ganham prova própria aqui: o que
 * se mede é a mesma propriedade, sobre outros conjuntos, sem tocar o registro histórico daquele
 * débito. Foi assim com o par da confirmação (T9), e é assim com os **quatro** símbolos das duas
 * filas da cobrança bancária (T15).
 *
 * ===========================================================================
 * A asserção é ESTÁTICA — e a prova de falsificação é permanente, não um experimento
 * ===========================================================================
 *
 * Ela inspeciona o **texto** do código, e a `.claude/rules/testing-stack.md` é literal quanto ao
 * preço disso: uma asserção que não pode falhar pelo defeito que persegue consta como feita e não
 * protege nada. O detector aqui é função **pura sobre texto**, o que permite aplicá-lo a cópias em
 * memória com o defeito de volta — o segundo caso —, sem escrever byte algum no disco.
 *
 * As duas metades do controle são exigidas juntas: um padrão que casasse a linha de import contaria
 * **todo consumidor legítimo** como redefinição e reprovaria a árvore correta; um padrão que só
 * casasse `export const` deixaria passar a cópia declarada sem `export`, que é justamente a forma
 * em que uma segunda definição nasce por reflexo.
 *
 * ---------------------------------------------------------------------------
 * São DOIS detectores de texto, e o segundo nasceu de um buraco medido
 * ---------------------------------------------------------------------------
 *
 * O primeiro é {@link definicaoDe}, que persegue a **segunda definição** de um símbolo. O segundo é
 * {@link camposDeclaradosEm}, que lê o conjunto de campos que cada carga declara — e ele existe
 * porque a forma intuitiva de afirmar a mesma coisa **não podia reprovar**: construir o literal
 * tipado `{ empresaId, loteId }` aqui e comparar `Object.keys(...)` contra uma lista escrita três
 * linhas acima é, depois de avaliado, `expect(['empresaId','loteId']).toEqual(['empresaId','loteId'])`.
 * Campo obrigatório acrescentado, removido ou renomeado é pego pelo **compilador**, não por aquela
 * linha; e o campo **opcional** — `material?: string` — compila, não entra no literal e a mantinha
 * verde. Numa superfície em que o campo a mais é o segredo (ADR-0032), o crédito errado é pior que
 * a asserção ausente: ele autoriza a rodada seguinte a confiar no que não protege.
 *
 * A divisão de crédito ficou explícita, e cada metade tem dono: o `tsc --build` do script `test`
 * deste pacote reprova o campo **renomeado ou removido** (as constantes esperadas são tipadas com
 * `keyof`); o detector de texto reprova o campo **acrescentado ou tornado opcional**; e a medição
 * da **saída real** — que nenhum dos dois faz — é do `CT-935`, em
 * `apps/api/test/segredo-nao-escapa.e2e.spec.ts`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CargaDaConferenciaBancaria,
  CargaDaConfirmacao,
  CargaDaEmissaoEmLote,
} from '../src/fila.js';
import {
  FILA_DA_CONFERENCIA_BANCARIA,
  FILA_DA_CONFIRMACAO,
  FILA_DA_EMISSAO_EM_LOTE,
} from '../src/fila.js';

/** Raiz do monorepo — dois níveis acima de `packages/shared/test`. */
const RAIZ = dirname(dirname(dirname(import.meta.dirname)));

/** Diretórios varridos em busca de definição. Os mesmos três do `CT-638`. */
const AREAS_DE_CODIGO = ['apps', 'packages', 'deploy'];

/** Onde o contrato da fila mora, desde o fecho do `D32 (F0/T6)`. */
const CASA_DO_CONTRATO_DA_FILA = 'packages/shared/src/fila.ts';

/** O barril do pacote — a fronteira pela qual os dois lados alcançam o contrato. */
const BARRIL_DO_PACOTE = 'packages/shared/src/index.ts';

/**
 * Os dois símbolos do contrato da fila da confirmação.
 *
 * O nome desencontra produtor e consumidor **em silêncio** — a tarefa é aceita, é gravada e nunca é
 * consumida —, e a carga carrega a decisão da ADR-0024: uma segunda declaração dela ficaria livre
 * para tornar `empresaId` opcional, que é o pior modo de falha da ADR-0008.
 */
const SIMBOLOS_DA_CONFIRMACAO = ['FILA_DA_CONFIRMACAO', 'CargaDaConfirmacao'];

/**
 * Os **quatro** símbolos das duas filas da cobrança bancária, publicados pela T15.
 *
 * Vale para eles, palavra por palavra, a razão do conjunto acima — o nome desencontra produtor e
 * consumidor **em silêncio**, e a carga carrega a decisão da ADR-0024. E há uma razão a mais, que é
 * própria destas duas: as cargas são o que **não** carrega segredo (ADR-0032), e uma segunda
 * declaração ficaria livre para acrescentar `material` ou `senha` "para o processo de trabalho não
 * precisar consultar o banco". A ausência é o mecanismo, e o mecanismo depende de haver **uma**
 * declaração.
 */
const SIMBOLOS_DAS_FILAS_BANCARIAS = [
  'FILA_DA_EMISSAO_EM_LOTE',
  'CargaDaEmissaoEmLote',
  'FILA_DA_CONFERENCIA_BANCARIA',
  'CargaDaConferenciaBancaria',
];

/** O valor que os dois lados precisam ver — literal, e não derivado do próprio símbolo. */
const NOME_ESPERADO_DA_FILA = 'confirmacao-de-email';

/** Os nomes das duas filas da T15 — literais, pela mesma razão do de cima. */
const NOME_ESPERADO_DA_FILA_DO_LOTE = 'emissao-em-lote';
const NOME_ESPERADO_DA_FILA_DA_CONFERENCIA = 'conferencia-bancaria';

/**
 * Os campos que cada uma das duas cargas declara — por extenso, em ordem alfabética, e **nada além
 * deles**.
 *
 * O tipo `keyof` não é ornamento: ele é a metade da prova que cabe ao **compilador**. Renomear ou
 * remover um campo da interface faz o literal abaixo deixar de compilar, e quem reprova aí é o
 * `tsc --build` do script `test` deste pacote. O que o compilador **não** vê é o campo
 * *acrescentado* — sobretudo o **opcional**, que não quebra literal nenhum —, e essa metade é do
 * detector de texto {@link camposDeclaradosEm}, que compara o conjunto inteiro, marcador de
 * opcionalidade incluído.
 */
const CAMPOS_DA_CARGA_DO_LOTE: ReadonlyArray<keyof CargaDaEmissaoEmLote> = ['empresaId', 'loteId'];
const CAMPOS_DA_CARGA_DA_CONFERENCIA: ReadonlyArray<keyof CargaDaConferenciaBancaria> = [
  'conferenciaId',
  'empresaId',
];

/**
 * Teto do caso que varre a árvore inteira — **declarado**, e não herdado do padrão de 5 s.
 *
 * A razão é **medida**, e o número importa: isolado, o caso leva ~3,6 s contra o teto padrão de 5 s
 * — margem de pouco mais de um segundo, que é o mesmo regime em que o `CT-907` vizinho já expira sob
 * a suíte completa. Sob ela — arquivos em paralelo, mais as instâncias efêmeras de banco disputando
 * CPU e disco — essa margem não sobrevive, e o caso expiraria por **tempo**, não por asserção.
 *
 * ⚠️ **Alargar o teto é a SEGUNDA metade do conserto, nunca a primeira.** O
 * `protocolo-antirregressao.spec.ts` registra a ordem, e ele registra o oposto do que este docblock
 * já afirmou: *"memoizar é o conserto da causa; alargar o teto seria conserto do sintoma"*. Este
 * arquivo faz **as duas coisas**, e nessa ordem: a caminhada é memoizada em
 * {@link memoriaDosArquivos}, de modo que os três casos a paguem uma vez só, e o teto declarado
 * cobre o custo que sobra — ler todo `.ts` de `apps`, `packages` e `deploy` uma vez, que é
 * intrínseco ao que se afirma e não sintoma de asserção mal escrita. O limite é constante nomeada no
 * topo, como a `.claude/rules/testing-stack.md` exige.
 */
const LIMITE_DA_VARREDURA_MS = 60_000;

/**
 * Reconhece a **definição** de um símbolo — nunca a menção nem o import dele.
 *
 * Mesma expressão do `CT-638`, e ela é copiada por decisão: aquele caso está sob um arquivo que
 * registra o fecho de um débito histórico, e importar dali criaria acoplamento entre uma prova viva
 * e um registro que não se reescreve. O que impede as duas de divergirem sem que nada acuse é o
 * controle de não-cegueira abaixo, que exercita as três formas discriminadas.
 */
function definicaoDe(simbolo: string): RegExp {
  return new RegExp(
    `^\\s*(?:export\\s+)?(?:(?:const|let|var)\\s+${simbolo}\\s*[:=]` +
      `|(?:function|class|interface|enum)\\s+${simbolo}\\b` +
      `|type\\s+${simbolo}\\s*=)`,
    'm',
  );
}

/**
 * Os arquivos versionados de código, sem `dist/` (saída de build) nem `node_modules/`.
 *
 * Memoizada pela mesma razão do `CT-638`: dois casos deste arquivo a consomem, e refazer a
 * caminhada em cada um custa a mesma varredura completa duas vezes, sob a suíte inteira em
 * paralelo — o custo que já fez casos expirarem no teto neste repositório.
 */
let memoriaDosArquivos: readonly string[] | undefined;

function arquivosDeCodigo(): readonly string[] {
  if (memoriaDosArquivos !== undefined) return memoriaDosArquivos;

  const encontrados: string[] = [];

  for (const area of AREAS_DE_CODIGO) {
    for (const entrada of readdirSync(join(RAIZ, area), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entrada.isFile()) continue;
      const caminho = relative(RAIZ, join(entrada.parentPath, entrada.name));
      const segmentos = caminho.split('/');
      // `dist/` espelha o fonte e contaria a mesma definição duas vezes; `node_modules/` guarda os
      // vínculos que o gerenciador cria para os pacotes do workspace, e alcançaria cada arquivo do
      // monorepo por caminhos não-canônicos.
      if (segmentos.includes('dist') || segmentos.includes('node_modules')) continue;
      if (!caminho.endsWith('.ts')) continue;
      encontrados.push(caminho);
    }
  }

  memoriaDosArquivos = encontrados;
  return encontrados;
}

/**
 * A linha sem o que for comentário, mais o estado do comentário de bloco ao fim dela.
 *
 * Existe porque o corpo das duas interfaces é majoritariamente **docblock**: sem descartá-lo, uma
 * frase de documentação que mencionasse `senha: string` seria lida como campo declarado, e o
 * detector acusaria a árvore correta. É o mesmo par de exigências do detector de definição acima —
 * enxergar o que é declaração, e **não** enxergar o que é menção.
 */
function semComentario(linha: string, dentroDeBloco: boolean): { codigo: string; aberto: boolean } {
  let codigo = '';
  let bloco = dentroDeBloco;

  for (let i = 0; i < linha.length; i += 1) {
    if (bloco) {
      if (linha.startsWith('*/', i)) {
        bloco = false;
        i += 1;
      }
      continue;
    }
    if (linha.startsWith('/*', i)) {
      bloco = true;
      i += 1;
      continue;
    }
    if (linha.startsWith('//', i)) break;
    codigo += linha.charAt(i);
  }

  return { codigo, aberto: bloco };
}

/**
 * Os campos que uma interface **declara** no fonte, em ordem alfabética e com `?` no que for
 * opcional.
 *
 * ⚠️ **O campo opcional é a razão de esta função existir.** A forma intuitiva de afirmar a forma de
 * uma carga é construir um literal tipado no teste e comparar `Object.keys(...)` — e ela **não pode
 * reprovar**: campo obrigatório acrescentado, removido ou renomeado faz o literal deixar de
 * compilar (quem acusa é o `tsc`, não a asserção), e campo **opcional** acrescentado compila, não
 * entra no literal e deixa a igualdade verde. Era exatamente esse o buraco, numa superfície em que
 * o campo a mais é `material`, `senha` ou `envelope` (ADR-0032) e em que a ausência é o mecanismo.
 *
 * Por isso o observado é lido do **texto do SUT**, e não de um objeto escrito aqui: o conjunto
 * declarado é comparado por igualdade com {@link CAMPOS_DA_CARGA_DO_LOTE} e
 * {@link CAMPOS_DA_CARGA_DA_CONFERENCIA}, de modo que campo acrescentado (opcional inclusive),
 * removido, renomeado **ou tornado opcional** reprova nomeando-o. Interface não encontrada é
 * **erro**, e não conjunto vazio — vazio comparado com vazio é a vacuidade que a
 * `.claude/rules/ancoras-de-superficie.md` proíbe.
 */
function camposDeclaradosEm(fonte: string, nomeDaInterface: string): string[] {
  const linhas = fonte.split('\n');
  const abertura = new RegExp(`^\\s*(?:export\\s+)?interface\\s+${nomeDaInterface}\\s*\\{`);
  const inicio = linhas.findIndex((linha) => abertura.test(linha));

  if (inicio < 0) {
    throw new Error(`interface ${nomeDaInterface} não encontrada no fonte lido`);
  }

  const campos: string[] = [];
  let profundidade = 0;
  let dentroDeBloco = false;

  for (let i = inicio; i < linhas.length; i += 1) {
    const { codigo, aberto } = semComentario(linhas[i] ?? '', dentroDeBloco);
    dentroDeBloco = aberto;

    // A profundidade **antes** da linha é o que decide: campo do corpo da interface está em 1, e o
    // que estiver dentro de um tipo aninhado está em 2 ou mais e não é campo desta carga.
    if (profundidade === 1) {
      const campo = /^\s*(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*(\??)\s*:/.exec(codigo);
      if (campo !== null) campos.push(`${campo[1] ?? ''}${campo[2] ?? ''}`);
    }

    for (const caractere of codigo) {
      if (caractere === '{') profundidade += 1;
      else if (caractere === '}') profundidade -= 1;
    }

    if (profundidade <= 0 && i > inicio) break;
  }

  return campos.sort();
}

/** Para cada símbolo, os arquivos que o **definem** — uma passada só sobre a árvore. */
function arquivosQueDefinem(simbolos: readonly string[]): Map<string, string[]> {
  const busca = simbolos.map((simbolo) => ({
    simbolo,
    padrao: definicaoDe(simbolo),
    arquivos: [] as string[],
  }));

  for (const caminho of arquivosDeCodigo()) {
    const conteudo = readFileSync(join(RAIZ, caminho), 'utf8');
    for (const alvo of busca) {
      if (alvo.padrao.test(conteudo)) {
        alvo.arquivos.push(caminho);
      }
    }
  }

  return new Map(busca.map((alvo) => [alvo.simbolo, alvo.arquivos.sort()]));
}

describe('apoio (T9) — o contrato da fila da confirmação tem definição única', () => {
  it(
    'cada símbolo é definido em UM arquivo só, e é o do pacote compartilhado',
    () => {
      const definicoes = arquivosQueDefinem(SIMBOLOS_DA_CONFIRMACAO);

      // Âncora antivácuo: uma varredura que não lesse arquivo algum produziria listas vazias, e as
      // igualdades abaixo reprovariam por ausência, sem dizer por quê.
      expect(
        arquivosDeCodigo().length,
        'a varredura não leu arquivo algum: a unicidade seria vácua por construção',
      ).toBeGreaterThan(0);

      for (const simbolo of SIMBOLOS_DA_CONFIRMACAO) {
        // Igualdade, e não `toContain`: o que se persegue aqui é a SEGUNDA definição, e uma asserção
        // de presença é justamente a que não a enxerga. O arquivo intruso aparece no diff da falha.
        expect(definicoes.get(simbolo), `definições de ${simbolo}`).toEqual([
          CASA_DO_CONTRATO_DA_FILA,
        ]);
      }
    },
    LIMITE_DA_VARREDURA_MS,
  );

  it('os dois símbolos saem pelo barril, e o nome da fila é o valor que os dois lados esperam', () => {
    const barril = readFileSync(join(RAIZ, BARRIL_DO_PACOTE), 'utf8');

    // A definição única não basta: um símbolo definido e não publicado obriga o consumidor a
    // redigitá-lo, que é exatamente a duplicação que o caso acima persegue pela outra ponta.
    for (const simbolo of SIMBOLOS_DA_CONFIRMACAO) {
      expect(barril, `${simbolo} não sai pelo barril do pacote`).toContain(simbolo);
    }

    // E o VALOR, por igualdade literal — escrito à mão aqui, e não derivado do próprio símbolo:
    // derivá-lo faria a asserção concordar consigo mesma, e trocar o nome da fila deixaria de
    // reprovar caso algum. É este valor que o produtor grava e o consumidor escuta.
    expect(FILA_DA_CONFIRMACAO).toBe(NOME_ESPERADO_DA_FILA);

    // A carga é interface, e existe só em tempo de compilação: a linha abaixo é o que faz o
    // consumo dela ser conferido pelo compilador em vez de ficar só no docblock. Os três campos são
    // obrigatórios — omitir qualquer um não compila.
    const carga: CargaDaConfirmacao = {
      empresaId: '00000000-0000-4000-8000-000000000001',
      locatarioId: '00000000-0000-4000-8000-000000000002',
      segredo: 'nao-e-um-segredo-de-verdade-so-preenche-o-campo',
    };
    expect(Object.keys(carga).sort()).toEqual(['empresaId', 'locatarioId', 'segredo']);
  });

  it('PROVA DE FALSIFICAÇÃO: a segunda definição é vista, e o import e a menção não são', () => {
    const padraoDoNome = definicaoDe('FILA_DA_CONFIRMACAO');
    const padraoDaCarga = definicaoDe('CargaDaConfirmacao');

    // As formas em que a SEGUNDA definição nasce por reflexo — inclusive sem `export`, que é a que
    // um detector ancorado em `export const` deixaria passar.
    for (const copia of [
      "export const FILA_DA_CONFIRMACAO = 'confirmacao-de-email';",
      "const FILA_DA_CONFIRMACAO = 'confirmacao-de-email';",
      '  const FILA_DA_CONFIRMACAO: string = obterNome();',
    ]) {
      expect(padraoDoNome.test(copia), `cópia não detectada: ${copia}`).toBe(true);
    }
    for (const copia of [
      'export interface CargaDaConfirmacao {',
      'interface CargaDaConfirmacao {',
      'export type CargaDaConfirmacao = { empresaId: string };',
    ]) {
      expect(padraoDaCarga.test(copia), `cópia não detectada: ${copia}`).toBe(true);
    }

    // E o outro lado, que é o que impede a asserção de reprovar a árvore CORRETA: consumo legítimo
    // — import numa linha, item de lista de import de várias linhas, e menção no corpo — não conta
    // como redefinição. O item de lista foi o defeito medido na construção do `CT-638`: a linha
    // `  type CargaDaRegua,` era lida como apelido de tipo.
    for (const consumo of [
      "import { FILA_DA_CONFIRMACAO } from '@sysloc/shared';",
      '  FILA_DA_CONFIRMACAO,',
      '  const fila = new Queue(FILA_DA_CONFIRMACAO, opcoes);',
    ]) {
      expect(padraoDoNome.test(consumo), `consumo contado como definição: ${consumo}`).toBe(false);
    }
    for (const consumo of [
      "import type { CargaDaConfirmacao } from '@sysloc/shared';",
      '  type CargaDaConfirmacao,',
      '  async enfileirar(carga: CargaDaConfirmacao): Promise<void> {',
    ]) {
      expect(padraoDaCarga.test(consumo), `consumo contado como definição: ${consumo}`).toBe(false);
    }
  });
});

describe('apoio (T15) — o contrato das duas filas da cobrança bancária tem definição única', () => {
  it(
    'cada um dos quatro símbolos é definido em UM arquivo só, e é o do pacote compartilhado',
    () => {
      const definicoes = arquivosQueDefinem(SIMBOLOS_DAS_FILAS_BANCARIAS);

      // Âncora antivácuo: uma varredura que não lesse arquivo algum produziria listas vazias, e as
      // igualdades abaixo reprovariam por ausência, sem dizer por quê.
      expect(
        arquivosDeCodigo().length,
        'a varredura não leu arquivo algum: a unicidade seria vácua por construção',
      ).toBeGreaterThan(0);

      for (const simbolo of SIMBOLOS_DAS_FILAS_BANCARIAS) {
        // Igualdade, e não `toContain`: o que se persegue aqui é a SEGUNDA definição, e uma asserção
        // de presença é justamente a que não a enxerga. O arquivo intruso aparece no diff da falha.
        expect(definicoes.get(simbolo), `definições de ${simbolo}`).toEqual([
          CASA_DO_CONTRATO_DA_FILA,
        ]);
      }
    },
    LIMITE_DA_VARREDURA_MS,
  );

  it('os quatro saem pelo barril, os dois nomes são os que os dois lados esperam, e as cargas têm SÓ identificadores', () => {
    const barril = readFileSync(join(RAIZ, BARRIL_DO_PACOTE), 'utf8');

    // A definição única não basta: um símbolo definido e não publicado obriga o consumidor a
    // redigitá-lo, que é exatamente a duplicação que o caso acima persegue pela outra ponta.
    for (const simbolo of SIMBOLOS_DAS_FILAS_BANCARIAS) {
      expect(barril, `${simbolo} não sai pelo barril do pacote`).toContain(simbolo);
    }

    // E os VALORES, por igualdade literal — escritos à mão aqui, e não derivados dos próprios
    // símbolos: derivá-los faria a asserção concordar consigo mesma, e trocar o nome de uma fila
    // deixaria de reprovar caso algum. São estes valores que a borda grava e o processo de trabalho
    // escuta.
    expect(FILA_DA_EMISSAO_EM_LOTE).toBe(NOME_ESPERADO_DA_FILA_DO_LOTE);
    expect(FILA_DA_CONFERENCIA_BANCARIA).toBe(NOME_ESPERADO_DA_FILA_DA_CONFERENCIA);
    // E os dois nomes são DIFERENTES entre si e do da confirmação: um nome repetido faria duas
    // naturezas de trabalho caírem na mesma fila, e o processador executaria a tarefa errada.
    expect(
      new Set([FILA_DA_EMISSAO_EM_LOTE, FILA_DA_CONFERENCIA_BANCARIA, FILA_DA_CONFIRMACAO]).size,
    ).toBe(3);

    // E as CARGAS — a ADR-0032 na superfície `fila`, afirmada sobre o **texto do fonte** e não
    // sobre um literal escrito aqui. Um literal tipado só conferiria o que o `tsc` já confere, e
    // deixaria passar justamente o campo **opcional**: `material?: string` compila, não entra no
    // literal e não muda `Object.keys` nenhum. O conjunto declarado carrega o marcador de
    // opcionalidade, de modo que acrescentar campo, removê-lo, renomeá-lo ou torná-lo opcional
    // reprova aqui, nomeando-o. ⚠️ Esta linha prova a **forma declarada**; que o segredo não sai na
    // carga REAL é medido pelo `CT-935` de `apps/api/test/segredo-nao-escapa.e2e.spec.ts` e pelo
    // `CT-928 (c)` de `apps/api/test/cobranca-bancaria.e2e.spec.ts` — as três são provas distintas,
    // e nenhuma delas empresta crédito às outras.
    const fonteDoContrato = readFileSync(join(RAIZ, CASA_DO_CONTRATO_DA_FILA), 'utf8');

    expect(camposDeclaradosEm(fonteDoContrato, 'CargaDaEmissaoEmLote')).toEqual(
      CAMPOS_DA_CARGA_DO_LOTE,
    );
    expect(camposDeclaradosEm(fonteDoContrato, 'CargaDaConferenciaBancaria')).toEqual(
      CAMPOS_DA_CARGA_DA_CONFERENCIA,
    );
  });

  it('PROVA DE FALSIFICAÇÃO: a segunda definição e o campo a mais são vistos, e o import, a menção e o comentário não são', () => {
    const padraoDoNome = definicaoDe('FILA_DA_EMISSAO_EM_LOTE');
    const padraoDaCarga = definicaoDe('CargaDaConferenciaBancaria');

    // As formas em que a SEGUNDA definição nasce por reflexo — inclusive sem `export`, que é a que
    // um detector ancorado em `export const` deixaria passar.
    for (const copia of [
      "export const FILA_DA_EMISSAO_EM_LOTE = 'emissao-em-lote';",
      "const FILA_DA_EMISSAO_EM_LOTE = 'emissao-em-lote';",
      '  const FILA_DA_EMISSAO_EM_LOTE: string = obterNome();',
    ]) {
      expect(padraoDoNome.test(copia), `cópia não detectada: ${copia}`).toBe(true);
    }
    for (const copia of [
      'export interface CargaDaConferenciaBancaria {',
      'interface CargaDaConferenciaBancaria {',
      'export type CargaDaConferenciaBancaria = { empresaId: string };',
    ]) {
      expect(padraoDaCarga.test(copia), `cópia não detectada: ${copia}`).toBe(true);
    }

    // E o outro lado, que é o que impede a asserção de reprovar a árvore CORRETA: consumo legítimo
    // — import numa linha, item de lista de import de várias linhas, e menção no corpo — não conta
    // como redefinição.
    for (const consumo of [
      "import { FILA_DA_EMISSAO_EM_LOTE } from '@sysloc/shared';",
      '  FILA_DA_EMISSAO_EM_LOTE,',
      '  const fila = new Queue(FILA_DA_EMISSAO_EM_LOTE, opcoes);',
    ]) {
      expect(padraoDoNome.test(consumo), `consumo contado como definição: ${consumo}`).toBe(false);
    }
    for (const consumo of [
      "import type { CargaDaConferenciaBancaria } from '@sysloc/shared';",
      '  type CargaDaConferenciaBancaria,',
      '  async enfileirar(carga: CargaDaConferenciaBancaria): Promise<void> {',
    ]) {
      expect(padraoDaCarga.test(consumo), `consumo contado como definição: ${consumo}`).toBe(false);
    }

    // -----------------------------------------------------------------------
    // E o detector de CAMPOS, pela mesma disciplina — ele é o que mede a ADR-0032 na superfície
    // `fila`, e uma asserção cujo poder de reprovar ninguém mediu consta como feita sem proteger
    // nada. `camposDeclaradosEm` é função pura sobre texto, então as cópias com o defeito de volta
    // vivem em memória e não escrevem byte algum no disco.
    // -----------------------------------------------------------------------

    // (1) O CAMPO OPCIONAL — o buraco que a asserção anterior tinha, e a razão desta forma. Ele
    // compila, não entra em literal nenhum, e é assim que `material`/`senha`/`envelope` entrariam.
    expect(
      camposDeclaradosEm(
        [
          'export interface CargaDaEmissaoEmLote {',
          '  readonly empresaId: string;',
          '  readonly loteId: string;',
          '  /** "para o processo de trabalho não precisar consultar o banco" */',
          '  readonly material?: string;',
          '}',
        ].join('\n'),
        'CargaDaEmissaoEmLote',
      ),
    ).toEqual(['empresaId', 'loteId', 'material?']);

    // (2) O campo OBRIGATÓRIO acrescentado, e o campo EXISTENTE tornado opcional — o segundo é
    // regressão da ADR-0024 (sem `empresaId` a política devolve vazio em silêncio) e nenhuma
    // asserção sobre `Object.keys` de um literal chegaria a vê-lo.
    expect(
      camposDeclaradosEm(
        [
          'export interface CargaDaConferenciaBancaria {',
          '  readonly empresaId?: string;',
          '  readonly conferenciaId: string;',
          '  readonly senha: string;',
          '}',
        ].join('\n'),
        'CargaDaConferenciaBancaria',
      ),
    ).toEqual(['conferenciaId', 'empresaId?', 'senha']);

    // (3) O outro lado, que é o que impede o detector de reprovar a árvore CORRETA: menção em
    // docblock, campo comentado e campo de tipo aninhado **não** são campos declarados do corpo.
    expect(
      camposDeclaradosEm(
        [
          'export interface CargaDaEmissaoEmLote {',
          '  /** Nunca acrescente `senha: string` aqui — a ausência é o mecanismo. */',
          '  // material: string;',
          '  readonly empresaId: string;',
          '  readonly loteId: string;',
          '  readonly origem: { rotulo: string };',
          '}',
        ].join('\n'),
        'CargaDaEmissaoEmLote',
      ),
    ).toEqual(['empresaId', 'loteId', 'origem']);

    // (4) E a âncora antivácuo do detector: interface ausente é ERRO, e não conjunto vazio —
    // renomear a carga faria a igualdade comparar vazio com vazio e passar por vacuidade.
    expect(() =>
      camposDeclaradosEm('export interface Outra {\n  readonly x: string;\n}', 'CargaDoEco'),
    ).toThrow(/CargaDoEco/);
  });
});
