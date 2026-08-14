/**
 * O adaptador de **produção** da porta de renderização — o único ponto do repositório que conhece PDF.
 *
 * ===========================================================================
 * ⚠️ `react` NESTE BACKEND NÃO É CÓDIGO DE INTERFACE, E NÃO VIOLA A FRONTEIRA
 * ===========================================================================
 *
 * A Fronteira do projeto (`CLAUDE.md`) proíbe **escrever aqui a interface que o usuário vê**: o fonte
 * React do produto vive na máquina local do usuário e é implementado lá, a partir do handoff que esta
 * base produz. O que este arquivo usa é outra coisa — `@react-pdf/renderer` emprega React como
 * **motor de renderização server-side**: sem DOM, sem navegador, sem componente entregue ao
 * frontend. O que sai daqui são **bytes de PDF**.
 *
 * A afirmação está escrita em **três** lugares, de propósito: no cabeçalho de `../package.json`
 * (campo `//`), aqui, e na §3.3 do tech spec da fatia. O risco é de **leitura** e não de
 * comportamento — um leitor futuro que veja `react` num manifesto deste repositório vai suspeitar do
 * contrário —, e por isso a mitigação é **por escrito**, nos três pontos onde a suspeita nasce.
 *
 * ===========================================================================
 * A seta aponta daqui para o domínio, nunca ao contrário (ADR-0025)
 * ===========================================================================
 *
 * Este arquivo **importa** {@link PortaDeRenderizacao} de `./porta-de-renderizacao.js` para dizer que
 * a satisfaz. A porta é propriedade de quem a **exige**, e por isso a composição não sabe que existe
 * um motor de PDF. A consequência prática é a que a fatia quer: se o motor mudar, **só este arquivo
 * se reescreve** — e enquanto ele não mudar, o domínio continua exercitável sem `@react-pdf/renderer`
 * de pé.
 *
 * Ele **não conhece** contrato, cláusula, locatário nem status: recebe {@link RepresentacaoTextual} e
 * devolve `Uint8Array`. Essa ignorância é o mecanismo, e não uma escolha de estilo — é ela que impede
 * o adaptador de tomar decisão de **conteúdo**, que é do domínio.
 *
 * ===========================================================================
 * Nada é armazenado (ADR-0030) — não existe `writeFile` neste arquivo
 * ===========================================================================
 *
 * O documento **nasce e morre no atendimento do pedido**: os bytes voltam ao chamador e não há aqui
 * caminho de escrita algum — nem arquivo, nem diretório temporário, nem cache entre chamadas. A
 * coerência entre o documento e o cadastro vem de **não haver cópia**. A gravação em disco que existe
 * na suíte é da **verificação** (ler os bytes de volta e extrair o texto), e vive lá, sob `tmpdir`
 * removido ao fim (ADR-0006).
 *
 * ===========================================================================
 * O `rotulo` do bloco NÃO É RENDERIZADO — e o motivo é o oráculo
 * ===========================================================================
 *
 * `BlocoDoDocumento.rotulo` é **identidade para a comparação**, não texto do documento: quem o
 * imprimisse injetaria no PDF conteúdo que o oráculo não tem, e a prova de equivalência passaria a
 * medir uma coisa enquanto o operador recebe outra. Tudo que o leitor deve ver — o cabeçalho
 * `CLÁUSULA PRIMEIRA:` inclusive — já vive no `texto`. Ver o cabeçalho de `./porta-de-renderizacao.ts`.
 *
 * Pela mesma razão, `normalizarParaComparacao` **não é chamada aqui**. Ela existe para a verificação;
 * aplicada ao `texto` antes de renderizar, colapsaria toda quebra de linha e todo espaço múltiplo do
 * layout **em silêncio** — e a comparação com o oráculo **não acusaria**, porque normaliza os dois
 * lados. O aviso por extenso está em `./normalizacao.ts`.
 *
 * ===========================================================================
 * A tipografia é UNIFORME, e a uniformidade é consequência da ignorância acima
 * ===========================================================================
 *
 * O legado destaca o cabeçalho da cláusula em negrito, e a alternativa idiomática seria reproduzi-lo.
 * Ela foi descartada porque exigiria **separar cabeçalho de corpo** dentro do bloco — decisão de
 * conteúdo, tomada fora do domínio, e explicitamente recusada pela porta. O mesmo vale para a marca
 * de cancelamento: dar-lhe tarja ou faixa exigiria o adaptador **reconhecer o rótulo** dela, isto é,
 * conhecer o domínio. Ela chega como um bloco de texto, e é assim que é desenhada.
 *
 * ===========================================================================
 * A hifenização automática fica DESLIGADA — o footgun é medido, não hipotético
 * ===========================================================================
 *
 * `@react-pdf/renderer` parte palavra que não cabe na linha e insere um hífen: medido nesta base,
 * `desproporcionalidade` sai do PDF como `de-` + `sproporcionalidade`. Num contrato que alguém
 * assina, isso é **caractere que o documento não tem**, e é exatamente a classe que esta fatia existe
 * para fechar (a renderização não perde, não reordena e não trunca). O calo é devolvido por
 * {@link SEM_HIFENIZACAO}, que declara a palavra indivisível: ela transborda ou desce para a linha
 * seguinte, mas nunca é partida.
 *
 * A desativação é **por propriedade do `Text`**, e não pelo registro global `Font.registerHyphenation
 * Callback`. A diferença importa: o registro global altera o motor para o processo inteiro, e
 * passaria a valer para todo documento que qualquer outro adaptador futuro renderize — configuração
 * de processo escondida num módulo de biblioteca é o oposto do que a §12 pede.
 *
 * ===========================================================================
 * NENHUMA REPETIÇÃO, NENHUM TIMEOUT E NENHUM TRATAMENTO DE FALHA MORAM AQUI
 * ===========================================================================
 *
 * Não há processo externo a esperar: a renderização é síncrona no processo que atende à requisição, e
 * a falha **sobe como rejeição**, virando `500 ERRO_INTERNO` pelo filtro global. Um adaptador que
 * tentasse de novo por conta própria multiplicaria trabalho em silêncio, e um timeout aqui mentiria
 * sobre haver uma fronteira de rede que não existe. É a mesma disciplina de
 * `packages/regua/src/adaptador-smtp.ts`, e pela mesma razão ele **jamais ganha ramo de ambiente**:
 * quem monta o processo escolhe o adaptador.
 *
 * A fonte é a **Helvetica padrão do PDF**, que o motor não embute nem busca: nenhum acesso a disco ou
 * a rede acontece no caminho do pedido. Registrar tipografia externa traria latência e um modo de
 * falha novo — e nada no documento a exige.
 */

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { PortaDeRenderizacao, RepresentacaoTextual } from './porta-de-renderizacao.js';

/** O tamanho da página — o mesmo do documento que o sistema antigo emitia. */
const TAMANHO_DA_PAGINA = 'A4';

/**
 * A palavra chega inteira ao layout, sempre.
 *
 * Devolver `[palavra]` é dizer ao motor que ela **não tem ponto de corte**; é a forma que a
 * biblioteca oferece para desligar a hifenização sem tocar o registro global. Ver o cabeçalho.
 */
const SEM_HIFENIZACAO = (palavra: string): string[] => [palavra];

/**
 * A folha de estilo do documento — constante de módulo, e por isso sem estado entre pedidos.
 *
 * `StyleSheet.create` apenas registra os objetos; nada aqui guarda conteúdo de documento algum, o que
 * mantém a promessa da ADR-0030 (nenhuma cópia sobrevive à chamada).
 */
const ESTILOS = StyleSheet.create({
  pagina: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
  },
  bloco: {
    marginBottom: 8,
  },
  texto: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    textAlign: 'justify',
  },
});

/**
 * Cria o renderizador de produção sobre `@react-pdf/renderer`.
 *
 * Sem parâmetro e sem construção cara: o custo de partida do motor (React e o reconciliador) é do
 * carregamento do módulo, **uma vez por processo**, e não por pedido — §12.3 do tech spec.
 */
export function criarRenderizadorPdf(): PortaDeRenderizacao {
  return {
    async renderizar(representacao: RepresentacaoTextual): Promise<Uint8Array> {
      // A árvore é montada por `createElement`, sem JSX: o pacote não configura transformação de
      // JSX, e introduzi-la por um arquivo é fiação sem retorno.
      const documento = createElement(
        Document,
        null,
        createElement(
          Page,
          { size: TAMANHO_DA_PAGINA, style: ESTILOS.pagina },
          // A chave é **posicional**, e nunca o `rotulo`: a árvore é construída uma vez e descartada,
          // de modo que não há reconciliação a estabilizar — e usar o rótulo aqui seria dar-lhe um
          // papel na renderização, que é justamente o que o cabeçalho recusa.
          representacao.blocos.map((bloco, posicao) =>
            createElement(
              View,
              { key: String(posicao), style: ESTILOS.bloco },
              createElement(
                Text,
                { style: ESTILOS.texto, hyphenationCallback: SEM_HIFENIZACAO },
                bloco.texto,
              ),
            ),
          ),
        ),
      );

      // `renderToBuffer` devolve um `Buffer`, que **é** um `Uint8Array`. Copiá-lo para um `Uint8Array`
      // novo só duplicaria o documento inteiro na memória do pedido, sem ganho algum de garantia.
      return renderToBuffer(documento);
    },
  };
}
