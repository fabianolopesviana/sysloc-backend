/**
 * Os moldes de `to_char` que as projeções deste pacote compartilham — **casa única, não terceira cópia**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE MÓDULO EXISTE
 * ---------------------------------------------------------------------------
 *
 * É o **limiar de três** do `CLAUDE.md` aplicado à letra: *"ao terceiro consumidor, o símbolo
 * duplicado sobe para casa compartilhada em vez de ganhar a terceira cópia. Por quê: com duas cópias,
 * endurecer uma deixa a outra para trás; com três, elas já divergiram."*
 *
 * `FORMATO_ISO_DO_INSTANTE` chegou ao terceiro consumidor — {@link ./cobranca.ts} (o `canceladoEm`),
 * {@link ./envio-de-cobranca.ts} (o `criadoEm` da tentativa) e {@link ./evento-bancario.ts} (o
 * `ocorridoEm` da trilha). A primeira tentativa de remédio foi **exportar de `./cobranca.ts` para os
 * vizinhos**, e ela não satisfaz o limiar: a declaração de `./envio-de-cobranca.ts` continuava viva, e
 * duas declarações é exatamente o estado que o gatilho existe para sair. Endurecer o molde — trocar a
 * escala do milissegundo, mudar a marca do fuso — mexeria numa e deixaria a outra para trás, e o mesmo
 * instante sairia com formas diferentes conforme o recurso, **num campo que ninguém confere por
 * leitura**.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO ENTRA EM `./index.ts`, E A AUSÊNCIA É A DECISÃO
 * ---------------------------------------------------------------------------
 *
 * Este é um módulo **interno do pacote**: quem o importa é a camada de dados, e mais ninguém.
 * Publicá-lo no barril daria a `apps/api` um formato de instante **para escolher** — e a borda que
 * escolhe formato é a borda que compõe o segundo. A razão é a mesma que já governava a exportação
 * lateral que este módulo substitui, e ela é preservada, não afrouxada: o `CT-012` audita o barril por
 * **igualdade**, de modo que a publicação apareceria ali como excedente.
 */

/**
 * O molde do **instante** — ISO-8601 em UTC, com milissegundos e `Z` literal.
 *
 * É a forma que os esquemas de saída aceitam (`z.iso.datetime()`), e ela é composta **pelo servidor**
 * em vez de por um `Date.toISOString()` na aplicação: o valor atravessa da consulta até o JSON sem
 * passar por relógio nenhum (ADR-0026). O `AT TIME ZONE 'UTC'` que acompanha cada uso fixa o
 * deslocamento no **objeto** em vez de no fuso da sessão, de modo que dois processos com `TZ`
 * diferentes leem o mesmo carimbo.
 */
export const FORMATO_ISO_DO_INSTANTE = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/**
 * O molde da **data de calendário** — ISO-8601 sem hora, sem fuso e sem instante.
 *
 * É a forma em que toda coluna `date` deste pacote viaja: **cadeia**, nunca objeto `Date`. O driver
 * entregaria a coluna como `Date` no fuso do processo, e reserializá-lo desloca a data em um dia para
 * metade dos fusos — que é o defeito que este molde existe para impedir, num campo que ninguém
 * confere por leitura.
 *
 * Ele desceu para cá no fecho do débito **D7** (F4/T3), cujo gatilho — o quarto consumidor — já havia
 * disparado duas vezes. Antes disso o mesmo literal tinha TRÊS declarações executáveis: uma em
 * {@link ./cobranca.ts} (as três colunas da carteira), uma em {@link ./envio-de-cobranca.ts} (o
 * vencimento da candidata) e uma em {@link ./contrato.ts}, exportada lateralmente para
 * {@link ./documento-de-contrato.ts} e {@link ./emissao-em-lote.ts}. Com três declarações, endurecer
 * uma — outra escala, outro separador — deixava duas para trás; com esta, não há outra a deixar.
 *
 * Vale para ele a mesma razão de ausência do barril declarada no cabeçalho deste módulo: publicá-lo
 * em `./index.ts` daria a `apps/api` um formato de data **para escolher**, e o `CT-012` audita o
 * barril por igualdade.
 */
export const FORMATO_ISO_DA_DATA = 'YYYY-MM-DD';
