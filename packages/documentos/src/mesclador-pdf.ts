/**
 * O adaptador de **produção** da porta de mesclagem — o único ponto do repositório que conhece
 * `pdf-lib`.
 *
 * ===========================================================================
 * ELE COPIA PÁGINAS. NÃO RE-RENDERIZA, NÃO RASTERIZA, NÃO RECONSTRÓI (ADR-0030)
 * ===========================================================================
 *
 * O que entra aqui são os **boletos que o provedor emitiu**, e a cláusula de exclusão da ADR-0030 é
 * explícita: *"fato recebido de terceiro — boleto emitido pelo provedor, retorno bancário,
 * documento assinado recebido — não é artefato derivado: é dado de entrada, ninguém o recompõe"*.
 * Reimprimir esse documento — rasterizando as páginas em imagem, ou remontando o layout a partir do
 * que se conseguiu extrair — produziria um papel **parecido** com o que o banco emitiu, e é o
 * parecido que arruína: um código de barras redesenhado que não lê, um dígito verificador que se
 * perdeu na conversão, uma linha digitável meio pixel torta. Quem paga descobre no caixa.
 *
 * `copyPages` é o mecanismo que evita isso: ele traz o **objeto de página** de origem — o fluxo de
 * conteúdo, as fontes embutidas, as imagens, o vetorial do código de barras — para o documento
 * novo, sem interpretar nada disso. A hipótese de que ele de fato preserva o conteúdo **foi medida
 * antes de a dependência ser fixada**, e não assumida: é o `CT-1002` de
 * `../test/mesclador-pdf.spec.ts`, que extrai o texto de volta página a página e o compara com o da
 * origem. Era o risco R4 do tech spec da fatia, cuja conduta em caso de falha era **parar a
 * fatia**, porque não existe plano B dentro da stack.
 *
 * ===========================================================================
 * Por que `pdf-lib`, e por que ele não contradiz a recusa do `undici`
 * ===========================================================================
 *
 * `@react-pdf/renderer`, que este pacote já usa, **não serve aqui**: ele renderiza *layout* a
 * partir de uma árvore de componentes e não sabe importar página de documento externo — usá-lo
 * obrigaria, exatamente, a reconstruir o boleto. O critério que separa esta dependência nova da
 * recusa do `undici` (registrada no docblock de
 * `packages/cobranca-bancaria/src/adaptador-sicoob.ts`) é **substituto equivalente**: lá havia um
 * cliente HTTP nativo que faz o mesmo; aqui não há nada, no monorepo nem na plataforma, que copie
 * página de PDF. A alternativa não era outra biblioteca — era violar a ADR-0030.
 *
 * ===========================================================================
 * A seta aponta daqui para o domínio, nunca ao contrário (ADR-0025)
 * ===========================================================================
 *
 * Este arquivo **importa** {@link PortaDeMesclagem} de `./porta-de-mesclagem.js` para dizer que a
 * satisfaz. Quem consome a porta a recebe **por parâmetro**, e por isso não sabe que existe um
 * `pdf-lib`: se a biblioteca mudar, **só este arquivo se reescreve**. Ele não conhece carnê,
 * cobrança, competência nem contrato — recebe bytes, devolve bytes —, e essa ignorância é o
 * mecanismo que o impede de tomar decisão de conteúdo, que é do domínio.
 *
 * ===========================================================================
 * Nada é armazenado (ADR-0030) — e nada sobrevive à chamada
 * ===========================================================================
 *
 * Não existe caminho de escrita neste arquivo: nem arquivo, nem diretório temporário, nem cache
 * entre chamadas. O documento composto nasce e morre no atendimento do pedido, e é isso que faz o
 * mesmo recorte, pedido duas vezes, responder o que o cadastro diz **hoje** (CA-17). O adaptador
 * também não guarda estado entre chamadas — {@link criarMescladorPdf} devolve um objeto sem campo
 * algum, de modo que duas requisições simultâneas não têm o que compartilhar.
 *
 * ===========================================================================
 * NENHUMA REPETIÇÃO, NENHUM TIMEOUT E NENHUM TRATAMENTO DE FALHA MORAM AQUI
 * ===========================================================================
 *
 * Não há processo externo a esperar: a composição é feita sobre bytes que já estão em memória, e a
 * falha **sobe como rejeição** — nomeada, e traduzida no vocabulário da porta. Repetir por conta
 * própria multiplicaria trabalho em silêncio, e um timeout mentiria sobre haver uma fronteira de
 * rede que não existe. É a mesma disciplina de `./renderizador-pdf.ts`.
 */

import { PDFDocument } from 'pdf-lib';
import type { PortaDeMesclagem } from './porta-de-mesclagem.js';
import { ErroDeDocumentoIlegivel, ErroDeMesclagemSemDocumentos } from './porta-de-mesclagem.js';

/**
 * O documento composto **não ganha carimbo de instante** — e isso é medido, não estético.
 *
 * Com o padrão da biblioteca (`updateMetadata: true`), cada salvamento grava `ModDate` e
 * `CreationDate` com o relógio da máquina, de modo que o **mesmo** recorte, pedido duas vezes,
 * produz arquivos de bytes diferentes. Medido nesta base: com o padrão, duas mesclagens das mesmas
 * origens divergem; com esta opção, elas são **idênticas byte a byte**. A CA-17 promete que pedir o
 * mesmo carnê duas vezes devolve o mesmo documento, e é mais barato cumpri-la aqui — onde a
 * diferença nasce — do que explicar depois por que dois downloads do mesmo recorte não conferem.
 *
 * Ela alcança só a **metadata do documento composto**; o conteúdo das páginas de origem não é
 * tocado nem por esta opção nem por nenhuma outra — ver o cabeçalho.
 */
const SEM_CARIMBO_DE_INSTANTE = { updateMetadata: false } as const;

/**
 * Cria o mesclador de produção sobre `pdf-lib`.
 *
 * Sem parâmetro e sem construção cara: o objeto devolvido não guarda estado, e o custo de partida
 * da biblioteca é do carregamento do módulo, **uma vez por processo**, e não por pedido.
 */
export function criarMescladorPdf(): PortaDeMesclagem {
  return {
    async mesclar(documentos: readonly Uint8Array[]): Promise<Uint8Array> {
      // A recusa vem ANTES de qualquer trabalho: sem ela, o caminho abaixo devolveria um PDF de
      // zero páginas, que é indistinguível de um carnê que perdeu as parcelas. Ver o docblock de
      // `ErroDeMesclagemSemDocumentos`.
      if (documentos.length === 0) {
        throw new ErroDeMesclagemSemDocumentos();
      }

      const composto = await PDFDocument.create(SEM_CARIMBO_DE_INSTANTE);

      // O laço é sequencial de propósito, e não um `Promise.all`: `addPage` escreve na mesma
      // estrutura, e a ordem das páginas do resultado É a ordem dos documentos de entrada — ela é
      // conteúdo (a primeira parcela vem primeiro), não detalhe de implementação. Concorrência aqui
      // não compraria nada: não há espera de E/S a sobrepor, só CPU sobre bytes já em memória.
      for (const [posicao, documento] of documentos.entries()) {
        // A leitura de CADA origem é embrulhada, e a posição vem do índice: quem chamou conhece a
        // ordem que montou e consegue dizer qual documento ofendeu. Pular a origem ilegível e
        // seguir entregaria um carnê com uma parcela a menos, sem ninguém perceber.
        //
        // `load` recusa por si o documento cifrado (`ignoreEncryption` fica no padrão `false`) —
        // ignorar a cifra produziria páginas em branco no lugar do boleto. `throwOnInvalidObject`
        // também fica no padrão (`false`), e é deliberado: o objeto malformado que a biblioteca
        // tolera é o que os geradores de boleto de fato emitem, e recusá-lo transformaria carnê
        // legítimo em erro.
        let origem: PDFDocument;
        try {
          origem = await PDFDocument.load(documento);
        } catch (causa) {
          throw new ErroDeDocumentoIlegivel(posicao, causa);
        }

        // `copyPages` traz o objeto de página inteiro — fluxo de conteúdo, fontes embutidas,
        // imagens e vetorial —, sem interpretar nada. É o que faz o boleto chegar ao carnê como o
        // provedor o emitiu.
        const paginas = await composto.copyPages(origem, origem.getPageIndices());

        for (const pagina of paginas) {
          composto.addPage(pagina);
        }
      }

      return composto.save();
    },
  };
}
