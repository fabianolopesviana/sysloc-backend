/**
 * O contrato da **confirmação de endereço de e-mail do locatário** — o corpo pelo qual o portador é
 * apresentado e as duas respostas que a superfície publica.
 *
 * ===========================================================================
 * O molde do segredo mora no ESQUEMA, e não numa conferência escrita à mão
 * ===========================================================================
 *
 * A rota que consome {@link esquemaDaApresentacaoDoPortador} é a **única do produto sem sessão**
 * (ADR-0027: o ato é do titular do dado, que nunca terá sessão, e a contrapartida é o portador de
 * segredo). Numa rota assim, cada instrução que o pedido malformado consegue disparar é superfície
 * exposta ao mundo — e o molde declarado aqui é o que faz o segredo malformado morrer como `422` do
 * arcabouço, **antes** de virar consulta ao banco, sem uma linha de verificação escrita.
 *
 * A alternativa descartada era `z.string().min(1)` mais uma conferência no serviço: ela produziria a
 * mesma recusa **depois** de a borda já ter derivado o digest e consultado a tabela, e deixaria a
 * forma do segredo escrita em dois pontos livres para divergir (ADR-0016).
 *
 * O molde é **fechado nas duas pontas e no comprimento exato**: 43 caracteres do alfabeto base64url
 * são exatamente o que `randomBytes(32).toString('base64url')` produz — 32 bytes, sem enchimento. A
 * consequência que importa, e ela é **exata quanto à grafia**: o **digest** do segredo é o que o
 * banco guarda, e **na forma em que ele o guarda** — hexadecimal, 64 caracteres — é **recusado por
 * este molde**, de modo que apresentá-lo no lugar do original não vira consulta alguma.
 *
 * O **mesmo** digest reencodado em base64url é outra história, e o comentário aqui já foi mais forte
 * do que o esquema: 32 bytes produzem **43** caracteres, ele **passa** por este molde e morre uma
 * camada adiante, **na busca** — porque o guardado é `sha256(segredo)`, e não `sha256(digest)`. É o
 * desenho, não uma folga: as duas camadas são exercitadas de propósito, pelo **`CT-725`** (T11) no
 * eixo da rota (`422` sem ida ao banco para a forma hexadecimal, `404` para a base64url) e pelo
 * **`CT-731 (b)`** deste pacote no eixo do esquema. Não endureça o molde para alcançar a segunda: o
 * comprimento exato é o que discrimina as formas vizinhas, e quem recusa o derivado é a busca.
 *
 * ===========================================================================
 * As duas respostas são `strictObject`, e AQUI a estritude é a decisão
 * ===========================================================================
 *
 * A convenção deste pacote é entrada fechada e **saída aberta** — está por extenso no cabeçalho de
 * `./configuracao-de-mora.ts`: pela ADR-0016 o documento publicado deriva do esquema, e um
 * `strictObject` de saída emite `additionalProperties: false`, fazendo um cliente gerado recusar o
 * campo que a rota vier a acrescentar no futuro.
 *
 * {@link esquemaDaConfirmacao} e {@link esquemaDoReenvioDeConfirmacao} são a exceção **deliberada**,
 * porque nos dois o conjunto fechado de chaves **é** o conteúdo do contrato, e não um efeito
 * colateral da forma:
 *
 *   * o `202` do reenvio afirma só o que **já** aconteceu — portador gravado, anteriores
 *     invalidados — e **cala sobre a entrega**, que corre fora da requisição (ADR-0029). Uma chave
 *     de desfecho de e-mail acrescentada aqui não seria evolução tolerável do corpo: seria a borda
 *     afirmando o que ela não sabe, que é precisamente a decisão que o `202` fecha;
 *   * a confirmação publica um fato consumado, e o crescimento do corpo é decisão de contrato — o
 *     `additionalProperties: false` diz a verdade sobre estas duas rotas.
 *
 * ⚠️ `confirmado` é `z.literal(true)`, e **não** `z.boolean()`. Não existe `{ confirmado: false }`
 * nesta superfície: quem não confirma recebe o `404` da recusa indistinguível, e um booleano livre
 * publicaria um estado que rota nenhuma emite — o mesmo defeito de forma que o `false` literal de
 * `efeitos.cobrancasGeradas` custou uma task para desfazer.
 *
 * ===========================================================================
 * O portador NÃO é recurso exposto, e a ausência é o mecanismo
 * ===========================================================================
 *
 * Não há esquema de portador aqui, nem `id`, nem `expiraEm` do lado da apresentação: pela ADR-0017 a
 * chave exposta é do **recurso**, e o portador não é um — ele é resolvido pelo segredo e nunca
 * aparece na superfície. `empresaId` também não é campo, como em toda entrada deste pacote: o
 * contexto de tenant vem do registro que o portador resolve (ADR-0027), e o `strictObject` converte
 * a tentativa de propô-lo pelo corpo em recusa por chave desconhecida.
 */

import { z } from 'zod';

/**
 * O molde do segredo do portador — base64url de 32 bytes, sem enchimento, **ancorado nas duas
 * pontas**.
 *
 * `[A-Za-z0-9_-]` é o alfabeto base64url (`-` e `_` no lugar de `+` e `/`), e `{43}` é o
 * comprimento exato que 32 bytes produzem nessa codificação. A âncora `^…$` é o que impede
 * casamento parcial: sem ela, qualquer texto que **contivesse** 43 caracteres do alfabeto passaria,
 * inclusive o segredo com espaço ou quebra de linha em volta.
 *
 * O comprimento é **exato**, e não um piso: `{43,}` aprovaria o digest hexadecimal de 64 caracteres
 * — o valor que o banco guarda — e a rota pública passaria a aceitar o derivado como se fosse o
 * original.
 */
const EXPRESSAO_DO_SEGREDO = /^[A-Za-z0-9_-]{43}$/;

/**
 * O corpo de `POST /v1/confirmacoes-de-email` — o segredo, e nada mais.
 *
 * O segredo viaja no **corpo**, nunca no caminho nem na cadeia de consulta: caminho e consulta
 * entram na trilha do servidor de borda e no histórico do navegador, e um segredo de uso único que
 * vaza para o registro deixa de ser de uso único.
 */
export const esquemaDaApresentacaoDoPortador = z.strictObject({
  segredo: z.string().regex(EXPRESSAO_DO_SEGREDO),
});

/** O corpo aceito ao apresentar o portador de confirmação. */
export type ApresentacaoDoPortador = z.infer<typeof esquemaDaApresentacaoDoPortador>;

/**
 * A resposta da confirmação bem-sucedida — a afirmação de um fato, não um resultado variável.
 *
 * O instante da confirmação **não** volta aqui: quem apresenta o portador é o locatário, que não tem
 * sessão nem alcance ao próprio cadastro. O instante é publicado por `esquemaDoLocatario`, nas seis
 * rotas de locatário, para quem tem sessão e a chave da tela (ADR-0022 — grava-se o fato e
 * publica-se o instante, nunca um booleano gravado).
 */
export const esquemaDaConfirmacao = z.strictObject({
  confirmado: z.literal(true),
});

/** A resposta da confirmação bem-sucedida. */
export type Confirmacao = z.infer<typeof esquemaDaConfirmacao>;

/**
 * A resposta do reenvio — **exatamente** duas chaves, as duas sobre o portador que acabou de nascer.
 *
 * `reenviadoEm` é quando o portador foi gravado e `expiraEm` é até quando ele resolve; as duas são
 * instantes carimbados pelo relógio **do banco** (ADR-0026), e por isso viajam como
 * `z.iso.datetime()`, como todo `timestamptz` publicado por este pacote.
 *
 * Nenhuma chave de desfecho de e-mail — ver o cabeçalho deste arquivo: a entrega corre fora da
 * requisição (ADR-0029), e a borda não tem como afirmá-la sem mentir.
 */
export const esquemaDoReenvioDeConfirmacao = z.strictObject({
  reenviadoEm: z.iso.datetime(),
  expiraEm: z.iso.datetime(),
});

/** A resposta do reenvio da confirmação. */
export type ReenvioDeConfirmacao = z.infer<typeof esquemaDoReenvioDeConfirmacao>;
