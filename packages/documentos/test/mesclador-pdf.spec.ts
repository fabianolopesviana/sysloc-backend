/**
 * O **portão de risco R4** da fatia `webhook-e-carne` — a hipótese do `pdf-lib`, medida antes de o
 * carnê ser construído sobre ela.
 *
 * Rastreabilidade: CA-14 → CT-1002 (RN-12), CA-17 → CT-1002 (RN-12), CA-18 → CT-1002 (RN-13).
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-14 | CT-1002 (a) | O texto de cada página do documento mesclado é **idêntico** ao da página
 * |       |             | de origem correspondente, **na mesma ordem**, e a contagem de páginas do
 * |       |             | resultado é exatamente a **soma** das contagens de origem — nenhuma
 * |       |             | página a mais, nenhuma a menos. É o que significa *"copia páginas, não
 * |       |             | re-renderiza"*: re-renderizar altera o texto extraído. |
 * | CA-14 | CT-1002 (b) | A ordem do resultado é a ordem **do arranjo de entrada**, e não uma
 * |       |             | ordem interna qualquer: mesclada a mesma tripla ao contrário, a
 * |       |             | sequência de páginas sai invertida — e **difere** da direta. Sem este
 * |       |             | eixo, (a) ficaria verde num mesclador que ordenasse por conta própria e
 * |       |             | calhasse de acertar. |
 * | CA-14 | CT-1002 (c) | Um documento **só** atravessa sem degradar: mesmo texto, mesma contagem
 * |       |             | de páginas. É o carnê de uma parcela. |
 * | CA-17 | CT-1002 (d) | O **mesmo** arranjo, mesclado duas vezes, produz bytes **idênticos** —
 * |       |             | não apenas conteúdo equivalente. É a promessa de reimpressão da CA-17,
 * |       |             | e ela só é verdadeira porque o adaptador desliga o carimbo de instante. |
 * | CA-18 | CT-1002 (e) | Mesclar **coisa nenhuma** rejeita com `ErroDeMesclagemSemDocumentos`, e
 * |       |             | a porta **não inventa** documento em branco. |
 * | —     | CT-1002 (f) | Origem **ilegível** — lixo, bytes truncados ou arranjo vazio de bytes —
 * |       |             | rejeita com `ErroDeDocumentoIlegivel` **nomeando a posição**, e nunca
 * |       |             | devolve documento parcial. Pular a origem quebrada entregaria um carnê
 * |       |             | com uma parcela a menos, sem ninguém perceber. |
 * | —     | CT-1002 (g) | **Asserção estática**: `pdf-lib` é importado por **um** arquivo do
 * |       |             | repositório, e ele é o adaptador. É o que mantém verdadeira a frase que
 * |       |             | permite trocar a biblioteca reescrevendo um arquivo só (ADR-0025). |
 * | —     | CT-1002 (h) | O extrator do arranjo **preserva o buffer do chamador**: extrair duas
 * |       |             | vezes os MESMOS bytes devolve o mesmo resultado, e o `byteLength` não
 * |       |             | vai a zero. É a rede do `D8 · F4/T5` — o extrator transfere a posse do
 * |       |             | que recebe, e sem a cópia defensiva a segunda leitura levanta
 * |       |             | `DOMException`. Discrimina por CONSTRUÇÃO: trocada a cópia por
 * |       |             | `data: bytes`, a segunda chamada rejeita e o caso reprova. |
 *
 * ===========================================================================
 * Por que este arquivo é o portão, e não uma preliminar
 * ===========================================================================
 *
 * O `pdf-lib` entra no produto para copiar páginas de documentos que **o provedor emitiu**, e a
 * ADR-0030 exclui esse fato do que pode ser recomposto (*"fato recebido de terceiro … não é
 * artefato derivado"*). Se a biblioteca re-renderizasse, rasterizasse ou perdesse conteúdo, a
 * conduta declarada no §20-R4 do tech spec era **parar a fatia e escalar** — não substituir por
 * rasterização, porque não existe plano B dentro da stack. Por isso a medição roda **antes** de o
 * `CarneService` existir: depois dele, o que era decisão viraria retrabalho.
 *
 * **Medição do portão, feita nesta base em 2026-08-18**: as três origens saem com `1 + 7 + 1 = 9`
 * páginas, o mesclado sai com **9**, e o texto de cada uma das nove confere com o da origem
 * correspondente — a hipótese se sustenta, e a dependência foi fixada depois de medida, não antes.
 *
 * **A discriminação está no eixo (a)**, e ela é comportamental: a comparação é **página a página e
 * em sequência**, contra o texto extraído das origens. Re-renderizar muda o texto que sai do
 * extrator (quebra de linha, ligadura, hifenização); reordenar troca a posição; perder ou duplicar
 * página muda a contagem afirmada por igualdade. Nenhuma das três sobrevive à asserção.
 *
 * ===========================================================================
 * Nenhum dublê — a fronteira exercitada É a biblioteca
 * ===========================================================================
 *
 * **Real execution boundary**: `pdf-lib` real compondo, `pdfjs-dist` real extraindo, e
 * `@react-pdf/renderer` real produzindo as origens pelo caminho normal do pacote. Substituir
 * qualquer um dublaria exatamente o que está sob prova (AP-10) — a hipótese é sobre a biblioteca, e
 * uma biblioteca dublada confirma o que se programou nela.
 *
 * **Nada vai a disco.** Diferente de `renderizador-pdf.spec.ts`, que grava e lê de volta porque a
 * borda faz isso com os bytes do contrato, aqui a fronteira do SUT é a memória: o adaptador não tem
 * caminho de escrita (ADR-0030), e passar pelo `tmpdir` só acrescentaria uma fronteira que o
 * produto não atravessa.
 *
 * ===========================================================================
 * As origens são construídas pelo CAMINHO NORMAL do pacote
 * ===========================================================================
 *
 * Elas nascem de `criarRenderizadorPdf()` sobre representações escritas aqui — nenhum símbolo de
 * produção existe para este arquivo enxergar coisa alguma (Iron Law #6), e nenhum PDF de fixture
 * entra na árvore. A origem do meio tem **muitas páginas** de propósito: sem ela, a ordem *interna*
 * de um documento nunca seria afirmada, e um mesclador que embaralhasse páginas dentro do mesmo
 * documento passaria.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { criarMescladorPdf } from '../src/mesclador-pdf.ts';
import {
  ErroDeDocumentoIlegivel,
  ErroDeMesclagemSemDocumentos,
} from '../src/porta-de-mesclagem.ts';
import type { RepresentacaoTextual } from '../src/porta-de-renderizacao.ts';
import { criarRenderizadorPdf } from '../src/renderizador-pdf.ts';
import { extrairPaginasDePdf } from './pdf.ts';

// ---------------------------------------------------------------------------
// Os limites de tempo, nomeados (nunca número solto no meio do caso)
// ---------------------------------------------------------------------------

/**
 * O teto de um caso que renderiza, mescla e extrai.
 *
 * O padrão de 5 s do arcabouço foi dimensionado para função pura, e o `vitest.config.ts` deste
 * pacote registra por escrito que não alarga teto nenhum. Ele continua não alargando: o teto sobe
 * **no caso**, que é onde a fronteira real existe — mesma escolha, e mesma razão, de
 * `renderizador-pdf.spec.ts`.
 */
const TETO_DA_COMPOSICAO = 60_000;

// ---------------------------------------------------------------------------
// A extração — o texto de volta, PÁGINA A PÁGINA
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// As origens — representações escritas aqui, renderizadas pelo caminho normal
// ---------------------------------------------------------------------------

/**
 * Quantos parágrafos a origem do meio tem.
 *
 * O número é grande o bastante para o layout **transbordar em várias páginas**, que é o que faz a
 * ordem interna de um documento ser afirmável. O caso não confia nesta estimativa: ele mede a
 * contagem de páginas e **reprova** se ela não passar de uma (ver o controle antivácuo do (a)).
 */
const PARAGRAFOS_DA_ORIGEM_LONGA = 140;

/** Monta uma representação cujos parágrafos são todos distintos e reconhecíveis. */
function representacaoDe(marca: string, paragrafos: number): RepresentacaoTextual {
  return {
    blocos: Array.from({ length: paragrafos }, (_, posicao) => ({
      rotulo: `${marca}-${posicao}`,
      texto:
        `${marca} PARAGRAFO ${String(posicao).padStart(3, '0')} — ` +
        'conteudo reconhecivel deste documento de origem, escrito para que a comparacao pagina a ' +
        'pagina consiga discriminar qualquer troca de posicao.',
    })),
  };
}

/** Os três documentos de origem, na ordem em que o caso os mescla. */
const ORIGENS = [
  { marca: 'ALFA', paragrafos: 6 },
  { marca: 'BRAVO', paragrafos: PARAGRAFOS_DA_ORIGEM_LONGA },
  { marca: 'CHARLIE', paragrafos: 3 },
] as const;

// ---------------------------------------------------------------------------
// A entrada ilegível — bytes que não são PDF, montados aqui
// ---------------------------------------------------------------------------

/** Bytes que não têm cabeçalho de PDF nenhum — o caso mais óbvio, e o mais provável. */
const BYTES_QUE_NAO_SAO_PDF = new TextEncoder().encode('isto nao e um documento pdf');

/** Nenhum byte — o download que veio vazio sem ninguém perceber. */
const BYTES_VAZIOS = new Uint8Array(0);

/**
 * Quantos bytes do início de um PDF de verdade o caso preserva ao truncá-lo.
 *
 * O prefixo mantém o cabeçalho `%PDF-`, e é isso que torna o caso interessante: o documento
 * **parece** um PDF e só se revela quebrado quando o corpo é lido. É a forma que um download
 * interrompido tem, e a que passaria por uma conferência que só olhasse os primeiros bytes.
 */
const BYTES_DO_PREFIXO_TRUNCADO = 200;

// ---------------------------------------------------------------------------
// A varredura estática do CT-1002 (g)
// ---------------------------------------------------------------------------

/** A raiz do repositório, a partir deste arquivo (`packages/documentos/test/`). */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));

/** Os dois diretórios de código do monorepo — os mesmos que o `grep` do aceite técnico varre. */
const DIRETORIOS_DE_CODIGO: readonly string[] = ['apps', 'packages'];

/**
 * O que a varredura nunca desce: derivado (`dist`, `.turbo`, `coverage`) ou de terceiro
 * (`node_modules`).
 *
 * O `dist/` fica de fora porque espelha o fonte que já está no conjunto — contá-lo faria **cada**
 * achado aparecer duas vezes e a igualdade abaixo reprovaria o código correto.
 */
const DIRETORIOS_PODADOS: readonly string[] = ['.turbo', 'coverage', 'dist', 'node_modules'];

/**
 * As extensões de fonte TypeScript reconhecidas.
 *
 * É uma **lista**, e não o sufixo `.ts`, por medição alheia que vale aqui:
 * `'ponte.mts'.endsWith('.ts')` é **falso** — os três últimos caracteres são `mts`. Com o sufixo
 * único, um módulo `.mts` que importasse a biblioteca ficaria invisível dentro de um diretório
 * declarado como varrido.
 */
const EXTENSOES_DE_FONTE: readonly string[] = ['.cts', '.mts', '.ts', '.tsx'];

/**
 * O nome do módulo, montado em **duas partes** de propósito.
 *
 * O controle positivo do caso precisa de uma **linha de import completa** para provar que o padrão
 * casa; escrita por extenso, ela faria este arquivo casar a varredura abaixo, e o caso teria de
 * abrir uma exceção para si — exceção que, uma vez aberta, esconderia também o import de verdade
 * que alguém acrescentasse aqui. Montar o nome mantém a igualdade **sem exceção nenhuma**, que é a
 * forma que não apodrece. Citá-lo em prosa, como fazem o cabeçalho e a tabela acima, é inofensivo:
 * o padrão exige a forma do import, e não a menção.
 */
const MODULO_DA_BIBLIOTECA = ['pdf', 'lib'].join('-');

/**
 * O que conta como *ligar-se à biblioteca*: `import … from`, `import(…)` e `require(…)`.
 *
 * A varredura **não** remove comentários, e a escolha é conservadora: prosa que cite o nome em
 * crases (como fazem os cabeçalhos do adaptador e do barril) não casa este padrão, e prosa que
 * escrevesse um `import` completo casaria — reprovando o código correto, que é o lado seguro de
 * errar. O oposto, deixar de ver um import de verdade, é o que não se pode admitir.
 */
const LIGACAO_COM_A_BIBLIOTECA = new RegExp(
  `(?:from|import|require)\\s*\\(?\\s*['"\`]${MODULO_DA_BIBLIOTECA}['"\`]`,
  'u',
);

/** O único arquivo do repositório que pode conhecer a biblioteca — ver a §3.b da T5. */
const ADAPTADOR = 'packages/documentos/src/mesclador-pdf.ts';

/**
 * O piso de arquivos varridos — controle antivácuo.
 *
 * Sem ele, uma poda que zerasse o caminhamento (diretório renomeado, extensão trocada) deixaria a
 * igualdade abaixo comparando conjunto vazio com conjunto vazio, e o caso passaria provando nada. O
 * valor é folgado de propósito: ele existe para pegar o **colapso**, não para medir o repositório.
 */
const MINIMO_DE_FONTES_VARRIDAS = 200;

/** Lista recursivamente o fonte TypeScript de `apps/` e `packages/`, podando o derivado. */
async function listarFontes(diretorio: string): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const caminhos: string[] = [];

  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      if (DIRETORIOS_PODADOS.includes(entrada.name)) continue;
      caminhos.push(...(await listarFontes(caminho)));
    } else if (EXTENSOES_DE_FONTE.some((extensao) => entrada.name.endsWith(extensao))) {
      caminhos.push(caminho);
    }
  }

  return caminhos;
}

// ---------------------------------------------------------------------------
// O arranjo — renderizado uma vez, comparado por todos os eixos
// ---------------------------------------------------------------------------

const renderizador = criarRenderizadorPdf();
const mesclador = criarMescladorPdf();

/** Os bytes de cada origem, na ordem de {@link ORIGENS}. */
const bytesDasOrigens: Uint8Array[] = [];

/** As páginas de texto de cada origem, na mesma ordem. */
const paginasDasOrigens: string[][] = [];

/**
 * Lê uma posição do arranjo **exigindo** que ela exista.
 *
 * `noUncheckedIndexedAccess` devolve `T | undefined` em toda indexação, e as duas saídas
 * idiomáticas são ruins aqui: `!` apaga a conferência, e `?? padrão` transformaria um arranjo que
 * não foi montado num caso que passa medindo cadeia vazia. Levantar é o que faz o defeito do
 * arranjo aparecer como falha, e não como verde.
 */
function naPosicao<T>(lista: readonly T[], posicao: number, oQue: string): T {
  const valor = lista[posicao];
  if (valor === undefined) {
    throw new Error(`arranjo incompleto: ${oQue} na posição ${posicao}`);
  }
  return valor;
}

describe('CT-1002 — a mesclagem preserva as páginas de origem sem re-renderizar', () => {
  beforeAll(async () => {
    for (const origem of ORIGENS) {
      const bytes = await renderizador.renderizar(representacaoDe(origem.marca, origem.paragrafos));

      bytesDasOrigens.push(bytes);
      paginasDasOrigens.push(await extrairPaginasDePdf(bytes));
    }
  }, TETO_DA_COMPOSICAO);

  it(
    'CT-1002 (a) — cada página do mesclado é a página de origem correspondente, na mesma ordem',
    async () => {
      const esperado = paginasDasOrigens.flat();

      const contagens = paginasDasOrigens.map((paginas) => paginas.length);

      // Controles de não-vacuidade, os quatro ANTES da asserção principal. Sem eles a igualdade
      // abaixo compararia listas vazias e o caso passaria provando nada.
      // 1. as três origens foram de fato renderizadas e extraídas;
      expect(contagens).toHaveLength(ORIGENS.length);
      // 2. nenhuma delas saiu sem página alguma — a reprovação nomeia qual;
      expect(contagens.filter((paginas) => paginas === 0)).toEqual([]);
      // 3. a origem do meio TRANSBORDOU, senão a ordem INTERNA de um documento nunca é exercitada;
      expect(naPosicao(contagens, 1, 'contagem da origem longa')).toBeGreaterThan(1);
      // 4. as páginas são distintas duas a duas — sem isto, uma permutação passaria despercebida,
      // e nenhuma página é vazia, o que faria a comparação medir cadeias vazias.
      expect(new Set(esperado).size).toBe(esperado.length);
      expect(esperado.filter((pagina) => pagina === '')).toEqual([]);

      const mesclado = await mesclador.mesclar(bytesDasOrigens);
      const obtido = await extrairPaginasDePdf(mesclado);

      // A contagem primeiro, por igualdade contra a SOMA: é o que apanha a página a mais e a página
      // a menos nomeando o número, antes de a comparação de conteúdo falar de posição.
      expect(obtido).toHaveLength(esperado.length);
      // E o conteúdo por igualdade de sequência — não por conjunto, não por contenção. Uma
      // re-renderização mudaria o texto extraído; uma troca de posição mudaria o índice.
      expect(obtido).toEqual(esperado);
    },
    TETO_DA_COMPOSICAO,
  );

  it(
    'CT-1002 (b) — a ordem do resultado é a ordem do arranjo de entrada, e não outra',
    async () => {
      const aoContrario = [...bytesDasOrigens].reverse();
      const esperado = [...paginasDasOrigens].reverse().flat();

      const obtido = await extrairPaginasDePdf(await mesclador.mesclar(aoContrario));

      expect(obtido).toEqual(esperado);
      // O par que impede a asserção acima de ser satisfeita por um mesclador de ordem fixa: as duas
      // sequências têm de ser DIFERENTES entre si. Se fossem iguais, (a) e (b) provariam o mesmo.
      expect(esperado).not.toEqual(paginasDasOrigens.flat());
    },
    TETO_DA_COMPOSICAO,
  );

  it(
    'CT-1002 (c) — um documento só atravessa sem degradar',
    async () => {
      const bytes = naPosicao(bytesDasOrigens, 0, 'bytes da primeira origem');
      const paginas = naPosicao(paginasDasOrigens, 0, 'páginas da primeira origem');

      const obtido = await extrairPaginasDePdf(await mesclador.mesclar([bytes]));

      expect(obtido).toHaveLength(paginas.length);
      expect(obtido).toEqual(paginas);
    },
    TETO_DA_COMPOSICAO,
  );

  it(
    'CT-1002 (d) — o mesmo arranjo, mesclado duas vezes, produz bytes idênticos (CA-17)',
    async () => {
      const primeiro = await mesclador.mesclar(bytesDasOrigens);
      const segundo = await mesclador.mesclar(bytesDasOrigens);

      // Controle de não-vacuidade: dois documentos vazios também seriam "idênticos".
      expect(primeiro.byteLength).toBeGreaterThan(0);
      // Igualdade byte a byte, e não "mesmo conteúdo": é a asserção que apanha o carimbo de
      // instante que a biblioteca grava por padrão — e que faria dois downloads do mesmo recorte
      // não conferirem.
      expect(Buffer.from(segundo).equals(Buffer.from(primeiro))).toBe(true);
    },
    TETO_DA_COMPOSICAO,
  );

  it('CT-1002 (e) — mesclar coisa nenhuma REJEITA, e não inventa documento em branco', async () => {
    const recusa: unknown = await mesclador.mesclar([]).catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(ErroDeMesclagemSemDocumentos);

    // O tipo é o que discrimina; nome e mensagem são afirmados por valor exato porque é assim que a
    // falha chega ao registro estruturado, e um erro renomeado deixaria de ser reconhecível lá.
    const recusado = recusa as ErroDeMesclagemSemDocumentos;
    expect({ nome: recusado.name, mensagem: recusado.message }).toEqual({
      nome: 'ErroDeMesclagemSemDocumentos',
      mensagem: 'mesclagem pedida sem documento algum',
    });
  });

  it(
    'CT-1002 (f) — origem ilegível REJEITA nomeando a posição, e nunca devolve documento parcial',
    async () => {
      // ⚠️ A biblioteca escreve no `stderr` ao topar com o documento truncado (*"Trying to parse
      // invalid object"*) ANTES de levantar. O ruído é dela e é esperado neste caso; o que importa
      // é que ela levanta, e que a falha chega traduzida. Silenciar o console daqui esconderia
      // diagnóstico legítimo — ver a pendência registrada na T5.
      const alfa = naPosicao(bytesDasOrigens, 0, 'bytes da primeira origem');
      const bravo = naPosicao(bytesDasOrigens, 1, 'bytes da segunda origem');
      const truncado = alfa.slice(0, BYTES_DO_PREFIXO_TRUNCADO);

      // As três formas de ilegível, cada uma numa posição DIFERENTE do arranjo: a posição relatada
      // tem de acompanhar a entrada, e não ser um número fixo que calha de bater uma vez.
      const arranjos: readonly { documentos: readonly Uint8Array[]; posicao: number }[] = [
        { documentos: [BYTES_QUE_NAO_SAO_PDF], posicao: 0 },
        { documentos: [alfa, truncado], posicao: 1 },
        { documentos: [alfa, bravo, BYTES_VAZIOS], posicao: 2 },
      ];

      const observado: { posicao: number; nome: string }[] = [];

      for (const arranjo of arranjos) {
        const recusa: unknown = await mesclador
          .mesclar(arranjo.documentos)
          .catch((erro: unknown) => erro);

        expect(recusa).toBeInstanceOf(ErroDeDocumentoIlegivel);

        const recusado = recusa as ErroDeDocumentoIlegivel;
        observado.push({ posicao: recusado.posicao, nome: recusado.name });
      }

      // Por igualdade de lista, e não caso a caso dentro do laço: a reprovação nomeia QUAL arranjo
      // relatou a posição errada, em vez de apenas dizer que um deles falhou.
      expect(observado).toEqual(
        arranjos.map((arranjo) => ({
          posicao: arranjo.posicao,
          nome: 'ErroDeDocumentoIlegivel',
        })),
      );
    },
    TETO_DA_COMPOSICAO,
  );

  it(
    'CT-1002 (g) — a biblioteca é importada por UM arquivo do repositório: o adaptador',
    async () => {
      // Controle positivo do detector: o padrão tem de casar uma ligação de verdade. Sem isto, uma
      // expressão que nunca casa aprovaria um repositório inteiro cheio de imports.
      expect(LIGACAO_COM_A_BIBLIOTECA.test(`import { X } from '${MODULO_DA_BIBLIOTECA}';`)).toBe(
        true,
      );
      expect(LIGACAO_COM_A_BIBLIOTECA.test(`const y = require('${MODULO_DA_BIBLIOTECA}');`)).toBe(
        true,
      );
      // E o negativo: citar o nome não é importá-lo, senão a igualdade abaixo acusaria toda prosa.
      expect(
        LIGACAO_COM_A_BIBLIOTECA.test(`a biblioteca ${MODULO_DA_BIBLIOTECA} copia páginas`),
      ).toBe(false);

      const fontes = (
        await Promise.all(
          DIRETORIOS_DE_CODIGO.map((diretorio) =>
            listarFontes(join(RAIZ_DO_REPOSITORIO, diretorio)),
          ),
        )
      ).flat();

      // Controle antivácuo: o caminhamento não pode ter colapsado.
      expect(fontes.length).toBeGreaterThan(MINIMO_DE_FONTES_VARRIDAS);
      expect(fontes.map((caminho) => relative(RAIZ_DO_REPOSITORIO, caminho))).toContain(ADAPTADOR);

      const ligados: string[] = [];
      for (const caminho of fontes) {
        if (LIGACAO_COM_A_BIBLIOTECA.test(await readFile(caminho, 'utf8'))) {
          ligados.push(relative(RAIZ_DO_REPOSITORIO, caminho));
        }
      }

      // Igualdade de conjunto, nunca contenção: ela reprova tanto o arquivo novo que se ligou à
      // biblioteca quanto o adaptador que deixou de se ligar a ela.
      expect(ligados.sort()).toEqual([ADAPTADOR]);
    },
    TETO_DA_COMPOSICAO,
  );

  it(
    'CT-1002 (h) — o extrator do arranjo NÃO destrói o buffer que recebe',
    async () => {
      const bytes = naPosicao(bytesDasOrigens, 0, 'bytes da primeira origem');

      // Controle antivácuo: sem bytes de verdade o caso provaria a preservação do nada.
      expect(bytes.byteLength).toBeGreaterThan(0);
      const tamanhoAntes = bytes.byteLength;

      const primeira = await extrairPaginasDePdf(bytes);
      expect(primeira.length).toBeGreaterThan(0);

      // A DISCRIMINAÇÃO está aqui: o extrator assume a posse do buffer e o transfere. Com
      // `data: bytes` — a forma que `apps/api/test/documento.ts` carregava até o fecho do
      // `D8 · F4/T5` — o arranjo fica com `byteLength` 0 depois da primeira extração, e esta
      // segunda chamada levanta `DOMException: Cannot transfer object of unsupported type`.
      // Nenhum eixo mais frouxo pega isso: uma extração só passa nas duas formas.
      const segunda = await extrairPaginasDePdf(bytes);

      expect(bytes.byteLength).toBe(tamanhoAntes);
      expect(segunda).toEqual(primeira);
    },
    TETO_DA_COMPOSICAO,
  );
});
