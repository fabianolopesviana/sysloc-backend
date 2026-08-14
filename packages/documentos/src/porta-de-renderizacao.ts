/**
 * A porta de **saída** do documento — o degrau entre a composição e os bytes.
 *
 * ===========================================================================
 * A porta sabe uma coisa só: *"transforme esta representação em bytes"*
 * ===========================================================================
 *
 * Nada de fonte, margem, página, tipo de mídia ou nome de arquivo atravessa esta fronteira. É o que
 * permite exercitar o domínio sem `@react-pdf/renderer` de pé, e é o que faz a troca do motor de
 * renderização não tocar uma linha da composição — a porta é propriedade de quem a **exige**
 * (ADR-0025), e é o adaptador que importa daqui para dizer que a satisfaz. A seta nunca se inverte.
 *
 * **A porta chega à composição por parâmetro, nunca por import.** Quem escolhe a implementação é a
 * borda que monta o processo; a composição do documento não sabe que existe um motor de PDF.
 *
 * ⚠️ **Nenhuma repetição, nenhum timeout e nenhum tratamento de falha mora aqui.** Não há processo
 * externo a esperar: a renderização acontece dentro do processo que atende a requisição, e a falha
 * sobe como rejeição, virando `500 ERRO_INTERNO` pelo filtro global. Um adaptador que tentasse de
 * novo por conta própria multiplicaria trabalho em silêncio, e um timeout aqui mentiria sobre haver
 * uma fronteira de rede que não existe.
 *
 * ===========================================================================
 * Por que o bloco tem RÓTULO, e por que o rótulo não é conteúdo
 * ===========================================================================
 *
 * A alternativa idiomática — o bloco ser uma `string` e a representação ser `readonly string[]` —
 * foi descartada por uma razão concreta: a prova de equivalência com o oráculo compara **bloco a
 * bloco** e precisa **nomear** o bloco divergente, e a lista de divergências esperadas é indexada
 * por bloco. Com blocos anônimos, a única identidade disponível seria a posição, e um bloco a mais
 * no meio deslocaria todos os seguintes, transformando uma divergência em vinte.
 *
 * ⚠️ **O `rotulo` é identidade, não texto do documento.** Ele não é renderizado: quem o imprimisse
 * injetaria no PDF conteúdo que o oráculo não tem. Tudo que o leitor do documento deve ver — o
 * cabeçalho `CLÁUSULA PRIMEIRA:` inclusive — vive no `texto`, e é por isso que não existe um campo
 * `titulo` separado: separá-lo obrigaria o adaptador a decidir como recompor cabeçalho e corpo, que
 * é decisão de conteúdo tomada fora do domínio.
 */

/**
 * Um bloco do documento — a menor unidade que a comparação com o oráculo trata como um todo.
 *
 * `rotulo` identifica o bloco de forma estável (a comparação o usa para parear e para nomear a
 * divergência); `texto` é o conteúdo integral, cabeçalho incluído.
 */
export interface BlocoDoDocumento {
  readonly rotulo: string;
  readonly texto: string;
}

/** O degrau entre a composição e os bytes: a lista ordenada de blocos que o documento é. */
export interface RepresentacaoTextual {
  readonly blocos: readonly BlocoDoDocumento[];
}

/**
 * A porta de renderização — a única forma de o domínio virar bytes.
 *
 * `renderizar` **rejeita** quando não conseguiu produzir o documento, e a rejeição sobe intacta até
 * o filtro global. Devolver um resultado de sucesso/erro seria a alternativa idiomática e foi
 * descartada: obrigaria cada chamador a decidir o que fazer com a falha, e a decisão já está tomada
 * num ponto único.
 */
export interface PortaDeRenderizacao {
  renderizar(representacao: RepresentacaoTextual): Promise<Uint8Array>;
}
