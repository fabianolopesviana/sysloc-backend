/**
 * Acessórios de arranjo das suítes de borda que lidam com **documento**: a geração de CPF válido e a
 * extração de texto de PDF.
 *
 * ---------------------------------------------------------------------------
 * O segundo acessório chegou na T10 da fatia `webhook-e-carne` — o fecho do D5
 * ---------------------------------------------------------------------------
 *
 * `extrairTextoDePdf` vinha privado de `./documento-do-contrato.e2e.spec.ts`, com um
 * `DÉBITO COM GATILHO` (D5 · F3/T7) cujo `QUANDO FECHA` era literal: *"o TERCEIRO consumidor de
 * extração de texto de PDF — o **carnê da F4** —, ou a primeira alteração das opções do extrator"*.
 * O carnê chegou, e ele desceu para cá **antes** de a terceira cópia nascer.
 *
 * O que a duplicação custava não é estética: as opções do extrator (`standardFontDataUrl`,
 * `useSystemFonts`) são o que torna a extração **propriedade do PDF** e não do host, e uma cópia
 * endurecida deixaria a outra para trás em silêncio — as duas suítes continuariam verdes medindo
 * coisas ligeiramente diferentes. A primeira leitura de PDF da verificação continua sendo
 * `extrairTextoDoPdf`, privada de `packages/documentos/test/renderizador-pdf.spec.ts`: ela lê de
 * **arquivo em disco**, atravessa fronteira de pacote e fica onde está — promovê-la exigiria um
 * acessório compartilhado entre pacotes, que é o que o `D28` (F0/T5) governa, e nada disto acontece
 * aqui.
 *
 * ---------------------------------------------------------------------------
 * O CPF válido — por que num arquivo próprio
 * ---------------------------------------------------------------------------
 *
 * Ele nasceu duplicado palavra por palavra em `autorizacao-do-dominio.e2e.spec.ts` e
 * `contrato-publicado.e2e.spec.ts` — dois arquivos do MESMO diretório, sem fronteira de pacote
 * entre eles, **ambos introduzidos pela T11 da fatia `cadastro-de-imoveis-e-pessoas`**. O grep da
 * época confirmou que eram as únicas duas ocorrências de `digitoDeControle` no monorepo: as cópias
 * não herdaram de um precedente, nasceram juntas.
 *
 * O que separa este caso da duplicação inofensiva de acessório de transporte (o cliente HTTP, a
 * rotina de entrada) é que aqui está **regra de domínio**: o algoritmo de dígito de controle que
 * `packages/shared/src/documento.ts` implementa em produção, sob a RN-04. Duas cópias corrigidas em
 * momentos diferentes produzem suítes que discordam sobre o que é um CPF válido, e a discordância
 * aparece como `422` de arranjo — falha no lugar errado, com o diagnóstico mais enganoso possível.
 *
 * É o débito **D18** (F2/T11), e este módulo é o fecho dele.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não em `packages/shared/test/`
 * ---------------------------------------------------------------------------
 *
 * Porque **não precisa** atravessar fronteira de pacote: os dois consumidores são irmãos deste
 * arquivo, e a importação é `./documento.ts`. O Tech Review da T11 registrou o `D28` (F0/T5) como
 * "condição habilitante" deste débito, e essa leitura estava errada — o `D28` é sobre importar
 * `packages/shared/test/` por caminho relativo profundo, ATRAVESSANDO a fronteira do pacote, e nada
 * disso acontece aqui. O precedente é `./base32.ts`, que resolveu a mesma classe de duplicação
 * entre irmãos, com o mesmo raciocínio escrito no cabeçalho dele.
 *
 * Se um terceiro pacote vier a precisar do gerador, aí sim o `D28` vira condição — e a carga migra
 * junto com os demais acessórios.
 *
 * ---------------------------------------------------------------------------
 * O que este módulo NÃO é
 * ---------------------------------------------------------------------------
 *
 * Isto é **arranjo**, e não asserção: nada aqui é comparado contra o SUT. Quem prova que a
 * conferência recusa documento inválido é o `CT-312`, com vetores próprios. Este gerador só produz
 * entrada que a borda deve aceitar — e a rota reprovaria em voz alta (`422 CAMPO_INVALIDO`) se ele
 * estivesse errado, nunca em silêncio.
 *
 * **Não é uma segunda implementação de `conferirDocumento`.** Uma cópia do conferidor provaria que
 * duas implementações concordam, não que a borda aceita o que deve — pela mesma razão que
 * `./base32.ts` declara no cabeçalho dele.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço não tenta executá-lo
 * como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar os tipos dele.
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
// A construção `legacy` é a que o próprio `pdfjs-dist` exige fora do navegador — a de entrada
// alcança `DOMMatrix` na carga do módulo e derruba a suíte antes do primeiro caso.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Um CPF **válido**, derivado do sequencial que o chamador fornece.
 *
 * O sequencial entra por parâmetro, e não por estado deste módulo, porque cada suíte mantém o seu
 * próprio contador: compartilhá-lo faria a numeração de um arquivo depender da ordem de execução do
 * outro. A RN-04 exige que o documento seja conferido, e `cadastro-de-pessoa.service.ts` o confere
 * com `conferirDocumento` — de modo que um número qualquer de onze dígitos é recusado com `422`. Os
 * dois dígitos de controle são calculados porque os casos precisam de **dezenas** de documentos
 * distintos, e uma lista literal envelheceria ao primeiro caso novo.
 */
export function cpfValido(sequencial: number): string {
  const base = String(100_000_000 + ((sequencial * 7_919) % 800_000_000));
  const digitos = [...base].map((caractere) => Number(caractere));
  const primeiro = digitoDeControle(digitos, 10);
  const segundo = digitoDeControle([...digitos, primeiro], 11);

  return `${base}${String(primeiro)}${String(segundo)}`;
}

/** Um dígito de controle de CPF: soma ponderada decrescente, resto da multiplicação por dez. */
function digitoDeControle(digitos: readonly number[], pesoInicial: number): number {
  const soma = digitos.reduce((acumulado, digito, indice) => {
    return acumulado + digito * (pesoInicial - indice);
  }, 0);
  const resto = (soma * 10) % 11;

  return resto >= 10 ? 0 : resto;
}

// ---------------------------------------------------------------------------
// Extração de texto de PDF — o segundo acessório deste módulo
// ---------------------------------------------------------------------------

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
 * Extrai o texto de um PDF recebido **em bytes**, com uma quebra de linha onde o layout quebrou.
 *
 * `useSystemFonts: false` é determinismo, não ornamento: com fontes do sistema operacional em jogo, a
 * extração passaria a depender do host, e o resultado deixaria de ser propriedade do PDF.
 *
 * ⚠️ **Isto é arranjo, e não asserção**: nada aqui é comparado contra o SUT. Quem compara é o caso,
 * entre o texto extraído e o que ele plantou na origem — e é por isso que o extrator não pode ter
 * duas versões, uma por suíte.
 */
export async function extrairTextoDePdf(bytes: Uint8Array): Promise<string> {
  const tarefa = getDocument({
    // ⚠️ A cópia é a **defesa**, e não ornamento — endurecimento propagado da casa irmã
    // (`packages/documentos/test/pdf.ts`) ao fechar o `D8 · F4/T5` em 2026-08-19. O extrator
    // **assume a posse** do buffer que recebe e o transfere: sem a cópia, o arranjo do chamador
    // fica com `byteLength` **0** e a segunda leitura dos mesmos bytes levanta
    // `DOMException: Cannot transfer object of unsupported type`. Aqui isto era um defeito
    // **latente**: o que salvava a suíte era só a ORDEM das linhas em
    // `documento-do-contrato.e2e.spec.ts`, onde `textoInicialDe(bytes)` corre ANTES da extração.
    // O custo é do arranjo — o produto não o paga.
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
