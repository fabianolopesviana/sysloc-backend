/**
 * Extração de texto de PDF — a casa comum das suítes deste pacote.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe — o fecho do D8 · F4/T5 (fatia `webhook-e-carne`)
 * ---------------------------------------------------------------------------
 *
 * O miolo `getDocument` + percurso de `TextItem` tinha **três** cópias na árvore, e o Limiar de
 * Três do `CLAUDE.md` dispara exatamente aí. Duas viviam neste diretório, sem fronteira de pacote
 * entre elas — `extrairPaginasDePdf` (`mesclador-pdf.spec.ts`) e `extrairTextoDoPdf`
 * (`renderizador-pdf.spec.ts`) —, e é essa duplicação que este arquivo fecha. A terceira é
 * `extrairTextoDePdf`, em `apps/api/test/documento.ts`: ela atravessa fronteira de pacote e
 * **fica onde está**, porque promovê-la exigiria acessório compartilhado entre pacotes, que é o
 * que o `D28` (F0/T5) governa.
 *
 * ⚠️ **O custo da duplicação não era estético, e isto foi MEDIDO em 2026-08-19**: as três cópias
 * já haviam divergido no **comportamento**, não só na forma. As duas daqui faziam cópia defensiva
 * do buffer (`new Uint8Array(bytes)`); a de `apps/api` passava `data: bytes` direto. Como o
 * extrator **assume a posse** do buffer e o transfere, a cópia de `apps/api` deixava o arranjo do
 * chamador com `byteLength: 0` — e o que salvava aquela suíte era só a **ordem das linhas**
 * (`textoInicialDe(bytes)` roda antes da extração). É o dano que o D5 · F3/T7 previu por escrito:
 * *"uma cópia endurecida deixaria a outra para trás em silêncio"*.
 *
 * ⚠️ **Isto é arranjo, e não asserção**: nada aqui é comparado contra o SUT. Quem compara é o
 * caso, entre o texto extraído e o que ele plantou na origem — e é por isso que o extrator não
 * pode ter duas versões, uma por suíte.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
// A construção `legacy` é a que o próprio `pdfjs-dist` exige fora do navegador — a de entrada
// alcança `DOMMatrix` na carga do módulo e derruba a suíte antes do primeiro caso.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * O diretório das fontes padrão do extrator, resolvido pelo **próprio pacote instalado**.
 *
 * Sem ele o `pdfjs-dist` avisa que não consegue carregar `LiberationSans-Regular.ttf` e a extração
 * passa a depender do que estiver instalado no host. Resolver pelo `package.json` da biblioteca é o
 * que sobrevive ao arranjo de diretórios do pnpm, onde o caminho relativo aparente não é o real.
 */
const DIRETORIO_DAS_FONTES_PADRAO = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'standard_fonts/',
);

/**
 * O percurso, uma entrada por página, com o separador que o chamador escolher para a quebra de
 * layout.
 *
 * ⚠️ **A cópia do buffer é a defesa, e ela não é ornamento** — ver o bloco medido no topo. O
 * extrator transfere a posse do que recebe; sem `new Uint8Array(bytes)` o arranjo do chamador
 * fica com `byteLength: 0` e a segunda leitura levanta
 * `DOMException: Cannot transfer object of unsupported type`. O custo é do arranjo — o produto
 * não o paga.
 *
 * `useSystemFonts: false` é determinismo, não ornamento: com fontes do sistema operacional em
 * jogo, a extração passaria a depender do host, e o resultado deixaria de ser propriedade do PDF.
 */
async function percorrerPaginas(bytes: Uint8Array, separadorDeQuebra: string): Promise<string[]> {
  const tarefa = getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: DIRETORIO_DAS_FONTES_PADRAO,
    useSystemFonts: false,
  });

  const paginas: string[] = [];

  try {
    const documento = await tarefa.promise;

    for (let pagina = 1; pagina <= documento.numPages; pagina += 1) {
      const conteudo = await (await documento.getPage(pagina)).getTextContent();

      let texto = '';
      for (const item of conteudo.items) {
        // `TextMarkedContent` não carrega texto; só os `TextItem` têm `str`.
        if (!('str' in item)) continue;

        texto += item.str;
        if (item.hasEOL) texto += separadorDeQuebra;
      }

      paginas.push(texto);
    }
  } finally {
    // Sem isto o processo do extrator fica de pé e a suíte não encerra sozinha.
    await tarefa.destroy();
  }

  return paginas;
}

/**
 * Extrai o texto de um PDF **em bytes**, devolvendo uma entrada por página.
 *
 * A granularidade é o ponto: um extrator que concatenasse o documento inteiro numa cadeia só não
 * conseguiria dizer se a página 3 do mesclado é a página 3 da origem — e é exatamente essa a
 * afirmação do CT-1002 (a). O texto de cada página sai **com o espaço em branco colapsado**, porque
 * o extrator o quebra pelo layout e a comparação é sobre **conteúdo**; a normalização incide sobre
 * os dois lados, de modo que ela não esconde divergência entre eles.
 */
export async function extrairPaginasDePdf(bytes: Uint8Array): Promise<string[]> {
  const paginas = await percorrerPaginas(bytes, ' ');

  return paginas.map((pagina) => pagina.replace(/\s+/gu, ' ').trim());
}

/**
 * Lê o PDF do disco e devolve o texto **cru**, com uma quebra de linha onde o layout quebrou.
 *
 * O texto sai **sem normalizar** de propósito: é o CT-708 (d) que precisa contar as linhas para
 * provar que a palavra longa de fato encontrou o fim da linha. Quem compara conteúdo normaliza
 * depois.
 */
export async function extrairTextoDeArquivoPdf(caminho: string): Promise<string> {
  const bytes = await readFile(caminho);

  return (await percorrerPaginas(bytes, '\n')).join('');
}
