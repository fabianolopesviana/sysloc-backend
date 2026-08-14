/**
 * A **segunda ponta do D3** — o PDF é renderizado de fato, e o texto é extraído de volta dele.
 *
 * Rastreabilidade: CA-03 → CT-708 (RN-15).
 *
 * INVARIANTES
 * - CT-708 (a): renderizado o documento do contrato de referência e extraído o texto do PDF **lido
 *   do disco**, cada um dos **24 marcos** — o título, os dois rótulos do preâmbulo e os **21**
 *   cabeçalhos de cláusula — aparece **exatamente uma vez**. A contagem é afirmada por objeto
 *   inteiro, de modo que a reprovação **nomeia** o marco que sumiu ou dobrou; e o `21` é afirmado
 *   como número, nunca como *"pelo menos alguns"*.
 * - CT-708 (b): os 24 marcos saem na **ordem crescente** da composição — a sequência lida do PDF é
 *   afirmada por **igualdade** contra a ordem canônica, e não por comparação de posições duas a
 *   duas. Um bloco deslocado reprova nomeando a sequência inteira.
 * - CT-708 (c): **companheiro negativo** (`ct_id: self`) — a mesma representação **sem** o bloco da
 *   `CLÁUSULA DÉCIMA QUARTA` produz um PDF em que o cabeçalho **não aparece**, a contagem cai a
 *   **20**, e a asserção de (b) **reprova** de fato. Sem ele, a asserção de presença poderia estar
 *   contando outra coisa e ficaria verde para sempre.
 * - CT-708 (d): palavra que **não cabe** na linha não é partida com hífen — e a afirmação vale para
 *   **oito deslocamentos** da quebra, não para uma posição de sorte. O caso traz o próprio controle
 *   de não-vacuidade: cada deslocamento tem de ocupar **mais de uma linha**, sem o que a asserção
 *   passaria mesmo com a hifenização ligada (foi medido: com uma posição só, o mutante sobrevive).
 * - CT-708 (e): **nenhum `rotulo` de bloco** aparece no texto extraído. É a única asserção que
 *   apanha o adaptador que imprimisse a identidade do bloco — (a) e (b) ficariam verdes, porque os
 *   24 marcos continuariam saindo uma vez cada e na mesma ordem.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe, e por que ele renderiza de verdade
 * ---------------------------------------------------------------------------
 *
 * O CT-709 prova a **representação intermediária** contra o oráculo. O que o operador de fato baixa
 * é o **PDF**, e entre um e outro há um motor de layout que quebra linha, justifica e pagina. Sem
 * esta prova, esse último passo — o único que produz o artefato entregue — ficaria **sem oráculo
 * nenhum**, e o que restaria seria fé. Por isso aqui não há dublê: dublar o renderizador seria
 * dublar exatamente o que está sob prova (AP-10, *mock-driven confidence*).
 *
 * **Real execution boundary**: `filesystem`. Os bytes vão a disco num `tmpdir` **próprio**, são
 * **lidos de volta** e só então extraídos — o caminho curto (extrair do `Uint8Array` em memória)
 * deixaria de fora justamente a gravação, que é o que a borda fará com eles.
 *
 * ---------------------------------------------------------------------------
 * O `tmpdir` é da VERIFICAÇÃO, e não do produto (ADR-0030 e ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * O adaptador **não escreve arquivo algum**: o documento nasce e morre no atendimento do pedido, e
 * não existe caminho de escrita nele. Quem grava é este arquivo, num diretório criado por `mkdtemp`
 * e **removido no encerramento** — a suíte não deixa resíduo (o disco do host já esteve em ~93%).
 * Nenhuma coordenada de conexão é lida aqui, e nada toca o ambiente que atende à operação.
 *
 * ---------------------------------------------------------------------------
 * `normalizarParaComparacao` entra AQUI, e é aqui que ela pode entrar
 * ---------------------------------------------------------------------------
 *
 * O extrator de PDF devolve o texto **quebrado pelo layout**: o mesmo cabeçalho pode chegar partido
 * entre duas linhas, e a justificação separa palavras por larguras, não por espaços iguais. Colapsar
 * espaço em branco é o que torna a comparação uma afirmação sobre **conteúdo**, e é exatamente o uso
 * para o qual aquela função foi escrita.
 *
 * ⚠️ **O adaptador não a chama, e não pode chamar** — aplicada ao texto **antes** de renderizar, ela
 * colapsaria toda quebra de linha e todo espaço múltiplo do documento em silêncio, e a comparação
 * **não acusaria**, porque normaliza os dois lados. O aviso por extenso está em `../src/normalizacao.ts`
 * e no cabeçalho de `../src/renderizador-pdf.ts`.
 *
 * ---------------------------------------------------------------------------
 * O `rotulo` do bloco não é renderizado — e é isto que (a) apanharia
 * ---------------------------------------------------------------------------
 *
 * `BlocoDoDocumento.rotulo` é identidade para a comparação, não texto do documento. Um adaptador que
 * o imprimisse injetaria no PDF conteúdo que o oráculo não tem — e **nem (a) nem (b) o apanhariam**:
 * um documento que abrisse cada bloco com `titulo `, `locador `, `clausula-primeira ` traria os 24
 * marcos uma vez cada, na mesma ordem, e ficaria verde. Por isso a asserção existe separada, em (e).
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// A construção `legacy` é a que o próprio `pdfjs-dist` exige fora do navegador — a de entrada
// alcança `DOMMatrix` na carga do módulo e derruba a suíte antes do primeiro caso.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECALHOS_DAS_CLAUSULAS } from '../src/contrato/clausulas.ts';
import { comporDocumentoDoContrato } from '../src/contrato/composicao.ts';
import type { DadosDoContratoParaDocumento, ParteDoContrato } from '../src/contrato/dados.ts';
import { normalizarParaComparacao } from '../src/normalizacao.ts';
import type { BlocoDoDocumento, RepresentacaoTextual } from '../src/porta-de-renderizacao.ts';
import { criarRenderizadorPdf } from '../src/renderizador-pdf.ts';

// ---------------------------------------------------------------------------
// Os limites de tempo, nomeados (nunca número solto no meio do caso)
// ---------------------------------------------------------------------------

/**
 * O teto de um caso que renderiza e extrai.
 *
 * O padrão de 5 s do arcabouço foi dimensionado para função pura, e o `vitest.config.ts` deste
 * pacote registra por escrito que não alarga teto nenhum. Ele continua não alargando: o teto sobe
 * **no caso**, que é onde a fronteira real existe, e não no arquivo de configuração, que vale para
 * as outras quatro suítes — as quais seguem sem fronteira alguma a atravessar.
 */
const TETO_DA_RENDERIZACAO = 30_000;

// ---------------------------------------------------------------------------
// A extração — o único ponto do repositório que conhece `pdfjs-dist`
// ---------------------------------------------------------------------------

/**
 * O diretório das fontes padrão do extrator, resolvido pelo **próprio pacote instalado**.
 *
 * Sem ele o `pdfjs-dist` avisa que não consegue carregar `LiberationSans-Regular.ttf` e a suíte
 * passa a depender do que estiver instalado no host. Resolver pelo `package.json` da biblioteca é o
 * que sobrevive ao arranjo de diretórios do pnpm, onde o caminho relativo aparente não é o real.
 */
const DIRETORIO_DAS_FONTES_PADRAO = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'standard_fonts/',
);

/**
 * Lê o PDF do disco e devolve o texto **cru**, com uma quebra de linha onde o layout quebrou.
 *
 * O texto sai **sem normalizar** de propósito: é o CT-708 (d) que precisa contar as linhas para
 * provar que a palavra longa de fato encontrou o fim da linha. Quem compara conteúdo normaliza
 * depois.
 *
 * `useSystemFonts: false` é determinismo, não ornamento: com fontes do sistema operacional em jogo,
 * a extração passaria a depender do host, e o resultado deixaria de ser propriedade do PDF.
 */
async function extrairTextoDoPdf(caminho: string): Promise<string> {
  const bytes = await readFile(caminho);
  const tarefa = getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: DIRETORIO_DAS_FONTES_PADRAO,
    useSystemFonts: false,
  });

  let texto = '';

  try {
    const documento = await tarefa.promise;

    for (let pagina = 1; pagina <= documento.numPages; pagina += 1) {
      const conteudo = await (await documento.getPage(pagina)).getTextContent();

      for (const item of conteudo.items) {
        // `TextMarkedContent` não carrega texto; só os `TextItem` têm `str`.
        if (!('str' in item)) continue;

        texto += item.str;
        if (item.hasEOL) texto += '\n';
      }
    }
  } finally {
    // Sem isto o processo do extrator fica de pé e a suíte não encerra sozinha.
    await tarefa.destroy();
  }

  return texto;
}

// ---------------------------------------------------------------------------
// Os marcos do documento — escritos à MÃO, e por isso independentes do SUT
// ---------------------------------------------------------------------------

/**
 * O título e os dois rótulos que abrem o preâmbulo, literais neste arquivo.
 *
 * Lê-los da composição faria a asserção comparar o SUT consigo mesmo (AP-29): um título trocado
 * mudaria os dois lados ao mesmo tempo e o caso continuaria verde. Os 21 cabeçalhos, ao contrário,
 * vêm de `CABECALHOS_DAS_CLAUSULAS` **de propósito** — é a lista publicada justamente para que o
 * cabeçalho tenha uma declaração única, e é o texto do golden que a fixa (CT-709).
 */
const MARCOS_DO_PREAMBULO = [
  'CONTRATO DE LOCAÇÃO RESIDENCIAL',
  'LOCADOR (A):',
  'LOCATÁRIO (A) (S):',
] as const;

/** A ordem canônica em que o documento apresenta os marcos, do topo ao fim. */
const MARCOS_EM_ORDEM: readonly string[] = [...MARCOS_DO_PREAMBULO, ...CABECALHOS_DAS_CLAUSULAS];

/** Quantas cláusulas o contrato tem — o número que o card exige por igualdade, nunca "pelo menos". */
const CLAUSULAS_DO_CONTRATO = 21;

/** O rótulo do bloco que o companheiro negativo remove, e o cabeçalho que ele leva junto. */
const ROTULO_DA_CLAUSULA_OMITIDA = 'clausula-decima-quarta';
const CABECALHO_DA_CLAUSULA_OMITIDA = 'CLÁUSULA DÉCIMA QUARTA:';

// ---------------------------------------------------------------------------
// A entrada do CT-708 (d) — palavras longas, e a quebra varrendo posições
// ---------------------------------------------------------------------------

/**
 * A frase cujas palavras o layout não consegue acomodar sem decidir onde quebrar.
 *
 * Ela tem forma de texto de contrato de propósito: o defeito que persegue é o do documento real, e
 * uma cadeia artificial de uma palavra só nunca exercitaria a escolha entre quebrar no espaço ou
 * partir a palavra seguinte.
 */
const FRASE_DE_PALAVRAS_LONGAS =
  'O objeto do presente contrato é o imóvel residencial anticonstitucionalissimamente ' +
  'identificado como inconstitucionalissimamente desproporcionalidade eletroencefalografista ' +
  'otorrinolaringologista e mais nada';

/**
 * O que se antepõe à frase para **deslocar** onde a linha quebra.
 *
 * ⚠️ Sem isto o caso seria frágil de um jeito silencioso, e a medição o mostrou: com a hifenização
 * religada, a mesma frase **sem** deslocamento sai íntegra, porque a quebra calha de cair num
 * espaço. Uma asserção que só exercita uma posição de quebra deixa de discriminar assim que uma
 * margem ou um corpo de fonte mudar — e não avisa. Varrer os deslocamentos faz a quebra passar por
 * dentro das palavras longas, que é onde a decisão de partir existe.
 */
const ENCHIMENTO = 'x ';

/** Quantos deslocamentos o caso varre — o suficiente para a quebra atravessar as palavras longas. */
const DESLOCAMENTOS_DA_QUEBRA = 8;

/** Quantas vezes a agulha aparece no palheiro — contagem, e não presença. */
function contarOcorrencias(texto: string, agulha: string): number {
  return texto.split(agulha).length - 1;
}

/** Os marcos presentes no texto, ordenados pela posição em que aparecem. */
function marcosNaOrdemDoTexto(texto: string, marcos: readonly string[]): string[] {
  return marcos
    .map((marco) => ({ marco, posicao: texto.indexOf(marco) }))
    .filter((achado) => achado.posicao >= 0)
    .sort((um, outro) => um.posicao - outro.posicao)
    .map((achado) => achado.marco);
}

// ---------------------------------------------------------------------------
// O agregado — o cenário do golden: pessoa física, com RG, sem fiador
// ---------------------------------------------------------------------------

/** O locador do contrato de referência. */
const MARIA_LOCADORA: ParteDoContrato = {
  nome: 'Maria Locadora',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '11122233344',
  rg: 'MG-1234567',
  logradouro: 'Avenida Central',
  numero: '1000',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300001',
};

/** O locatário do contrato de referência. */
const JOAO_LOCATARIO: ParteDoContrato = {
  nome: 'Joao Locatario',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '55566677788',
  rg: 'MG-7654321',
  logradouro: 'Rua B',
  numero: '55',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300002',
};

/** O agregado do contrato de referência do golden — o mesmo cenário que o CT-709 compara. */
const AGREGADO_DE_REFERENCIA: DadosDoContratoParaDocumento = {
  contrato: { prazoMeses: 12, valorMensal: 2500, diaVencimento: 10, valorTotalContrato: 30000 },
  locador: MARIA_LOCADORA,
  locatario: JOAO_LOCATARIO,
  imovel: {
    nomeImovel: 'Imovel PDF-001',
    logradouro: 'Rua das Flores',
    numero: '120',
    complemento: 'Fundos',
    bairro: 'Centro',
    cidade: 'Caratinga',
    estado: 'MG',
    cep: '35300000',
  },
  fiadores: [],
  dataDeEmissao: '2026-08-13',
};

// ---------------------------------------------------------------------------
// A fronteira real — `tmpdir` próprio, criado no início e removido no fim
// ---------------------------------------------------------------------------

const renderizador = criarRenderizadorPdf();

let diretorioTemporario = '';

/** Renderiza a representação, grava os bytes e devolve o texto **cru** lido de volta do disco. */
async function renderizarEExtrair(
  representacao: RepresentacaoTextual,
  nomeDoArquivo: string,
): Promise<string> {
  const bytes = await renderizador.renderizar(representacao);
  const caminho = join(diretorioTemporario, nomeDoArquivo);

  await writeFile(caminho, bytes);

  return extrairTextoDoPdf(caminho);
}

describe('CT-708 — o PDF é renderizado de fato, e o texto extraído de volta prova o conteúdo', () => {
  let textoDoDocumento = '';

  beforeAll(async () => {
    diretorioTemporario = await mkdtemp(join(tmpdir(), 'sysloc-documentos-'));

    const representacao = comporDocumentoDoContrato(AGREGADO_DE_REFERENCIA, { cancelado: false });

    textoDoDocumento = normalizarParaComparacao(
      await renderizarEExtrair(representacao, 'contrato-de-referencia.pdf'),
    );
  }, TETO_DA_RENDERIZACAO);

  afterAll(async () => {
    // O produto não guarda o artefato (ADR-0030); a verificação também não deixa resíduo.
    await rm(diretorioTemporario, { recursive: true, force: true });
  });

  it('CT-708 (a) — cada um dos 24 marcos aparece EXATAMENTE uma vez no PDF renderizado', () => {
    // A lista publicada tem de ter 21 itens: se ela encolhesse, a contagem abaixo continuaria
    // batendo consigo mesma e o caso passaria medindo menos do que promete.
    expect(CABECALHOS_DAS_CLAUSULAS).toHaveLength(CLAUSULAS_DO_CONTRATO);

    const contagens = Object.fromEntries(
      MARCOS_EM_ORDEM.map((marco) => [marco, contarOcorrencias(textoDoDocumento, marco)]),
    );
    const esperado = Object.fromEntries(MARCOS_EM_ORDEM.map((marco) => [marco, 1]));

    // Objeto inteiro, e não `every(...)`: a reprovação nomeia o marco que sumiu ou dobrou.
    expect(contagens).toEqual(esperado);

    // A contagem exigida pelo card, afirmada como número — nunca como "pelo menos alguns".
    expect(
      CABECALHOS_DAS_CLAUSULAS.filter((cabecalho) => textoDoDocumento.includes(cabecalho)),
    ).toHaveLength(CLAUSULAS_DO_CONTRATO);
  });

  it('CT-708 (b) — os 24 marcos saem na ordem crescente da composição', () => {
    expect(marcosNaOrdemDoTexto(textoDoDocumento, MARCOS_EM_ORDEM)).toEqual(MARCOS_EM_ORDEM);
  });

  it(
    'CT-708 (c) — companheiro negativo: omitida a cláusula décima quarta, o caso REPROVA',
    async () => {
      const completa = comporDocumentoDoContrato(AGREGADO_DE_REFERENCIA, { cancelado: false });
      const mutilada: RepresentacaoTextual = {
        blocos: completa.blocos.filter(
          (bloco: BlocoDoDocumento) => bloco.rotulo !== ROTULO_DA_CLAUSULA_OMITIDA,
        ),
      };

      // Controle de não-vacuidade: o filtro precisa ter incidido em EXATAMENTE um bloco, senão o
      // resto do caso mediria um documento idêntico ao íntegro.
      expect(mutilada.blocos).toHaveLength(completa.blocos.length - 1);

      const textoMutilado = normalizarParaComparacao(
        await renderizarEExtrair(mutilada, 'contrato-sem-decima-quarta.pdf'),
      );

      expect(contarOcorrencias(textoMutilado, CABECALHO_DA_CLAUSULA_OMITIDA)).toBe(0);
      expect(
        CABECALHOS_DAS_CLAUSULAS.filter((cabecalho) => textoMutilado.includes(cabecalho)),
      ).toHaveLength(CLAUSULAS_DO_CONTRATO - 1);

      // E a asserção de (b) — a que prova o documento íntegro — reprova de fato sobre este PDF.
      // É o que impede a presença dos 24 marcos de ser uma afirmação que não pode falhar.
      expect(() =>
        expect(marcosNaOrdemDoTexto(textoMutilado, MARCOS_EM_ORDEM)).toEqual(MARCOS_EM_ORDEM),
      ).toThrow();

      // O que sobra é a sequência íntegra **menos** o cabeçalho omitido, e nada mais se deslocou.
      expect(marcosNaOrdemDoTexto(textoMutilado, MARCOS_EM_ORDEM)).toEqual(
        MARCOS_EM_ORDEM.filter((marco) => marco !== CABECALHO_DA_CLAUSULA_OMITIDA),
      );
    },
    TETO_DA_RENDERIZACAO,
  );

  it('CT-708 (e) — nenhum `rotulo` de bloco vaza para dentro do PDF', () => {
    const representacao = comporDocumentoDoContrato(AGREGADO_DE_REFERENCIA, { cancelado: false });
    const vazados = representacao.blocos
      .map((bloco: BlocoDoDocumento) => bloco.rotulo)
      .filter((rotulo: string) => textoDoDocumento.includes(rotulo));

    // Controle de não-vacuidade: se a composição parasse de emitir blocos, a lista acima ficaria
    // vazia por ausência de sujeito e a asserção passaria sem medir nada.
    expect(representacao.blocos.length).toBeGreaterThan(CLAUSULAS_DO_CONTRATO);

    // O rótulo é identidade para a comparação, e imprimi-lo injetaria no PDF conteúdo que o oráculo
    // não tem — é o erro mais fácil de cometer neste adaptador, e o único que a contagem de marcos
    // de (a) NÃO apanharia: um documento com `titulo CONTRATO DE LOCAÇÃO…` traz cada marco uma vez
    // do mesmo jeito. A lista nomeia o rótulo ofensor.
    expect(vazados).toEqual([]);
  });

  it(
    'CT-708 (d) — palavra que não cabe na linha NÃO é partida com hífen, em nenhum deslocamento',
    async () => {
      const semUmaLinha: number[] = [];
      const comHifen: number[] = [];
      const divergentes: number[] = [];

      for (let deslocamento = 0; deslocamento < DESLOCAMENTOS_DA_QUEBRA; deslocamento += 1) {
        const texto = `${ENCHIMENTO.repeat(deslocamento)}${FRASE_DE_PALAVRAS_LONGAS}`;
        const cru = await renderizarEExtrair(
          { blocos: [{ rotulo: 'palavras-longas', texto }] },
          `palavras-longas-${deslocamento}.pdf`,
        );
        const extraido = normalizarParaComparacao(cru);

        // Sem mais de uma linha o layout nunca teve de decidir se partia palavra alguma, e as
        // asserções abaixo passariam com a hifenização LIGADA.
        if (cru.split('\n').length < 2) semUmaLinha.push(deslocamento);
        // Nenhum hífen: a entrada não tem nenhum, logo todo hífen que apareça foi o motor que
        // inseriu. Medido nesta base: com a hifenização padrão, sai `incon-` + `stitucionalissima…`.
        if (extraido.includes('-')) comHifen.push(deslocamento);
        // O positivo do par, e o mais forte dos três: o parágrafo INTEIRO, por igualdade literal.
        if (extraido !== texto) divergentes.push(deslocamento);
      }

      // Os três por igualdade de lista, e não por `every(...)`: a reprovação nomeia **qual**
      // deslocamento ofendeu, que é o que separa "reprovou" de "reprovou por quê".
      expect({ semUmaLinha, comHifen, divergentes }).toEqual({
        semUmaLinha: [],
        comHifen: [],
        divergentes: [],
      });
    },
    TETO_DA_RENDERIZACAO,
  );
});
