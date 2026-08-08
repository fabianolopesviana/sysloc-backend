/**
 * O contrato do **conjunto** — o agrupamento de imóveis (condomínio, edifício, loteamento).
 *
 * Duas formas, e a razão de serem duas está no cabeçalho de `imovel.ts`, que é onde a assimetria
 * entre entrada e saída morde de fato: aqui elas só diferem no que o servidor produz (`id`,
 * `retiradoEm`) e o cliente nunca informa.
 */

import { z } from 'zod';
import { esquemaDaJanelaComCirculacao, MAIOR_TEXTO_CURTO } from './comum.js';
// A carteira é a listagem de conjuntos **expandida**, e o item dela carrega os imóveis inteiros —
// com cômodos e metragem. O esquema do imóvel vem do módulo dono dele, e nunca é redigitado aqui: a
// ADR-0016 fixa o esquema como fonte única, e uma segunda declaração da mesma forma divergiria no
// primeiro campo que o imóvel ganhar. A direção da aresta é `conjunto.ts → imovel.ts`, e ela não
// fecha ciclo: `imovel.ts` não importa este módulo.
import { esquemaDoImovel } from './imovel.js';

/**
 * Corpo fechado da criação e da alteração de conjunto (§4.1: `{ nome }`).
 *
 * As duas rotas compartilham o corpo porque **não há atualização parcial nesta fatia** (§4.1.1): o
 * `PUT` carrega o corpo completo, e um esquema separado para ele seria uma cópia idêntica com
 * liberdade de divergir.
 *
 * `empresaId` **não** aparece — nem aqui nem em nenhum esquema de entrada deste pacote. Ele sai da
 * sessão (ADR-0008), e o `strictObject` o recusa como chave desconhecida em vez de ignorá-lo em
 * silêncio; ignorar seria oferecer ao cliente um campo que parece funcionar e não funciona, que é o
 * caminho por onde a fuga de tenant costuma entrar.
 */
export const esquemaDeConjuntoNovo = z.strictObject({
  nome: z.string().trim().min(1).max(MAIOR_TEXTO_CURTO),
});

/** O corpo aceito na criação e na alteração de conjunto. */
export type ConjuntoNovo = z.infer<typeof esquemaDeConjuntoNovo>;

/**
 * O conjunto como a API o devolve.
 *
 * `z.object` e não `z.strictObject`, e a diferença é deliberada: a saída **descarta** chave que não
 * esteja declarada, de modo que uma coluna acrescentada ao banco não vaza para o cliente por
 * distração. Na entrada a mesma chave desconhecida precisa **recusar**, porque ali ela é erro do
 * cliente; na saída ela é erro nosso, e descartar é o que impede o vazamento.
 *
 * `retiradoEm` é a marca da exclusão lógica (ADR-0014): `null` enquanto o conjunto está em
 * circulação, e o instante da retirada depois. Nada é apagado.
 */
export const esquemaDoConjunto = z.object({
  id: z.uuid(),
  nome: z.string(),
  retiradoEm: z.iso.datetime().nullable(),
});

/** O conjunto como a API o devolve. */
export type Conjunto = z.infer<typeof esquemaDoConjunto>;

/**
 * O valor de `expandir` que pede a **carteira** — o conjunto com os imóveis dele.
 *
 * Ele existe com **nome próprio** porque quem o consome tem de compará-lo: o manipulador de
 * `GET /v1/conjuntos` decide entre a lista simples e a carteira por igualdade contra este valor. A
 * forma anterior lia a **primeira posição** de {@link EXPANSOES_DA_CARTEIRA}, e a diferença não é
 * estilo: o docblock daquele arranjo declara que a dimensão **vai crescer** na fatia seguinte
 * (contratos de um imóvel, cobranças de um contrato), e uma expansão acrescentada **antes** de
 * `'imoveis'` faria o manipulador comparar contra o valor errado **sem erro de compilação** — a
 * suíte reprovaria, mas apontando para a expansão, e não para a ordem do arranjo, que é a causa.
 *
 * Publicá-lo aqui, e derivar o arranjo dele, resolve as duas pontas de uma vez: nada é redigitado
 * (o esquema continua com uma fonte única) e nada depende de ordem.
 *
 * **Medido**, e por isso está escrito aqui: com uma expansão acrescentada **antes** de `'imoveis'` no
 * arranjo, a forma derivada do valor passa limpa (`121 passed` em `@sysloc/api`) e a forma derivada
 * da posição reprova em `3 failed | 118 passed` — `CT-329`, `CT-329 (b)` e `CT-331`, que é o **mesmo**
 * modo de falha do mutante `MT10-5` (*a expansão é ignorada*). É a medida literal de que a suíte
 * acusaria o sintoma e não a causa: quem lesse aquelas três falhas iria depurar a expansão, e não a
 * ordem do arranjo. Reverter para `EXPANSOES_DA_CARTEIRA[0]` reabre exatamente isso — com **um** só
 * elemento as duas formas são indistinguíveis, e nenhum caso reprova hoje.
 */
// DECISÃO FECHADA — T10 / Gate 2 (P1) · 2026-08-06
// O QUÊ: o valor que o manipulador de `GET /v1/conjuntos` compara tem **nome próprio**, e
//        {@link EXPANSOES_DA_CARTEIRA} deriva dele — nunca o contrário. A forma idiomática
//        (`Object.freeze(['imoveis'] as const)` mais `EXPANSOES_DA_CARTEIRA[0]`) foi descartada.
// POR QUÊ: a forma posicional acopla o manipulador à **ordem** do arranjo, e o docblock daquele
//          arranjo declara que a dimensão **vai crescer** na fatia seguinte (contratos de um imóvel,
//          cobranças de um contrato). Uma expansão inserida **antes** de `'imoveis'` faria o
//          manipulador comparar contra o valor errado **sem erro de compilação** — medido, a suíte
//          reprova em `CT-329`, `CT-329 (b)` e `CT-331`, apontando para a expansão e não para a
//          ordem, que é a causa (o mesmo modo de falha do mutante `MT10-5`). E com **um** só
//          elemento as duas formas são indistinguíveis: **nenhum caso reprova hoje**, de modo que a
//          decisão é estruturalmente invisível à suíte e este marcador é a rede possível (P4 da
//          `.claude/rules/nao-regressao.md`). O docblock acima é a medição por extenso.
// REVERTER EXIGE: provar as DUAS coisas. Primeira, que {@link EXPANSOES_DA_CARTEIRA} tem **um só**
//                 elemento. Segunda, que nenhuma expansão nova pode ser inserida **antes** de
//                 `'imoveis'` — não que nenhuma tenha sido inserida ainda.
export const EXPANSAO_DE_IMOVEIS = 'imoveis' as const;

/**
 * As expansões que a listagem de conjuntos aceita — hoje uma só, e a união é fechada.
 *
 * ---------------------------------------------------------------------------
 * Por que uma união fechada de UM valor, e não um booleano `expandirImoveis`
 * ---------------------------------------------------------------------------
 *
 * `expandir` nomeia **o que** se expande, e é a mesma dimensão que a próxima fatia vai alargar
 * (contratos de um imóvel, cobranças de um contrato). Um booleano por expansão obrigaria a cadeia de
 * consulta a crescer um parâmetro a cada nível, e cada um deles repetiria a decisão de coerção de
 * texto que `incluirRetirados` já pagou caro em {@link esquemaDaJanelaComCirculacao}.
 *
 * A união fechada dá o que o card exige de graça: `expandir=qualquercoisa` é recusado com `422`
 * **nomeando o parâmetro**, porque o Zod reporta o `invalid_value` com `path: ['expandir']`. Um
 * parâmetro ignorado em silêncio devolveria a lista simples a quem pediu a árvore, e o cliente não
 * teria como saber que a expansão não aconteceu.
 *
 * `Object.freeze` fecha o arranjo em tempo de execução, e `as const` fecha a união em tempo de
 * compilação — a mesma forma, e a mesma razão, de `TIPOS_DE_IMOVEL` em {@link ./imovel.js}.
 *
 * Ele **deriva** de {@link EXPANSAO_DE_IMOVEIS}, e não o contrário: quem compara precisa do valor
 * com nome, e quem valida precisa do arranjo — tirar o arranjo do valor dá os dois de um literal só.
 */
export const EXPANSOES_DA_CARTEIRA = Object.freeze([EXPANSAO_DE_IMOVEIS] as const);

/** União fechada das expansões da carteira. */
export type ExpansaoDaCarteira = (typeof EXPANSOES_DA_CARTEIRA)[number];

/**
 * A janela da listagem de conjuntos: a de circulação **mais** o parâmetro de expansão.
 *
 * Ela estende {@link esquemaDaJanelaComCirculacao} em vez de redeclarar os três parâmetros, de modo
 * que o teto que recusa, o padrão da página e a união fechada de `incluirRetirados` continuam tendo
 * **um** lugar. `expandir` é opcional, e a ausência dele é a lista simples — a rota é a mesma, e é
 * isso que mantém a superfície da API com uma entrada a menos para congelar no marco.
 *
 * Ela é a única entrada do pacote que declara `expandir`: as listagens de imóvel e das três pessoas
 * seguem em {@link esquemaDaJanelaComCirculacao}, porque nenhuma delas tem nível filho a expandir.
 */
export const esquemaDaJanelaDaCarteira = esquemaDaJanelaComCirculacao.extend({
  expandir: z.enum(EXPANSOES_DA_CARTEIRA).optional(),
});

/** A janela da listagem de conjuntos, com os padrões já aplicados. */
export type JanelaDaCarteira = z.infer<typeof esquemaDaJanelaDaCarteira>;

/**
 * O conjunto **com os imóveis dele** — o item da carteira expandida.
 *
 * Ele estende {@link esquemaDoConjunto} e reusa {@link esquemaDoImovel} inteiro: a árvore devolvida
 * tem de ser **idêntica** à composição das leituras individuais, e um esquema que descrevesse um
 * imóvel "resumido" aqui autorizaria a carteira a divergir da leitura por identificador — que é
 * exatamente o segundo caminho de leitura que esta forma existe para impedir.
 *
 * `imoveis` só existe na resposta expandida. Sem `expandir=imoveis`, o item é o
 * {@link esquemaDoConjunto} puro e **a chave não aparece** — não é `imoveis: []`, que diria ao
 * cliente que o conjunto não tem imóvel nenhum.
 */
export const esquemaDoConjuntoComImoveis = esquemaDoConjunto.extend({
  imoveis: z.array(esquemaDoImovel),
});

/** O conjunto com os imóveis dele, como a carteira expandida o devolve. */
export type ConjuntoComImoveis = z.infer<typeof esquemaDoConjuntoComImoveis>;
