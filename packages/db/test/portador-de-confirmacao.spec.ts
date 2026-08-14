/**
 * A porta do **portador de confirmação** — CT-727, CT-728, CT-729 e o apoio do cenário 4 da §6.4, da
 * T8 da fatia `documentos-e-confirmacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-15    | CT-727 | A função `SECURITY DEFINER` que resolve o portador recebe **exatamente**
 * |          |        | um parâmetro de entrada, `p_derivado` — **não há** parâmetro de empresa —, e
 * |          |        | devolve **exatamente** as colunas `(empresa_id, locatario_id,
 * |          |        | consumido_em)`. As duas afirmações são por **igualdade de conjunto
 * |          |        | ordenado**, no catálogo **e** na chamada real; nunca "inclui pelo menos". |
 * | CA-13    | CT-728 | Derivado que nunca existiu, portador **vencido** e portador **invalidado**
 * | RN-14    |        | devolvem o **mesmo** resultado vazio, sem exceção alguma — nenhum
 * |          |        | distinguível do outro. O controle positivo, sobre o portador vivo e no
 * |          |        | mesmo arranjo, é obrigatório: sem ele o caso ficaria verde sobre uma função
 * |          |        | que nunca resolve nada. |
 * | CA-14    | CT-729 | `gerarSegredo` produz **32 bytes** (256 bits) de `node:crypto` em base64url,
 * | RN-11    |        | dois sorteios consecutivos diferem, e o valor gravado na coluna `derivado` é
 * |          |        | **igual** a `sha256(segredo)` em hexadecimal e **diferente** do segredo. Mais
 * |          |        | a **varredura estática** sobre o módulo de gravação, com o par
 * |          |        | íntegro/mutante que a torna falsificável. |
 * | CA-12    | apoio  | O consumo é de **uso único**: sobre o MESMO portador, a 1ª apresentação
 * | RN-10    | (§6.4, | devolve `{locatarioId, confirmadoEm}` e grava o carimbo nas duas colunas
 * |          | cen. 4)| com o MESMO instante; a 2ª, em unidade de trabalho própria e com o relógio
 * |          |        | do banco comprovadamente adiantado, devolve `undefined`; e os quatro
 * |          |        | valores lidos crus do disco permanecem **byte a byte** os da primeira. |
 * | CA-12    | apoio  | O consumo confere as **três** condições de validade por conta própria, e não
 * | RN-09    | (P1 ·  | só a unicidade: portador **invalidado entre a resolução e o consumo** e
 * | RN-10    | Gate 2)| portador **vencido** devolvem `undefined` e deixam os dois carimbos **nulos**;
 * |          |        | o portador vivo do mesmo arranjo consome. |
 *
 * Rastreabilidade: `CA-15 → CT-727 (RN-12)` · `CA-13 → CT-728 (RN-14)` · `CA-14 → CT-729 (RN-11)` ·
 * `CA-12 → apoio §6.4-4 (RN-10)` · `CA-12 → apoio P1 (RN-09, RN-10)`.
 *
 * ⚠️ O apoio **não tem CT numerado de propósito**: a §6.5 da task o registra como *"6.4, cenário 4"*,
 * e o CT-724 que a mesma linha cita é da **T11**, por HTTP. Delegar-lhe esta prova subiria a
 * invariante da camada `db` para a camada da borda, contra a Iron Law #3 — a instrução que impõe a
 * unicidade vive aqui, e é aqui que ela é detectável.
 *
 * ===========================================================================
 * POR QUE O PAR É O QUE DETECTA, caso a caso
 * ===========================================================================
 *
 * **CT-727.** A introspecção do catálogo afirma o que o comportamento não dá: uma função que
 * *aceitasse* `p_empresa` e o ignorasse por dentro passaria em qualquer prova comportamental. E a
 * asserção sobre o **retorno** é o oposto — ela afirma o que a função **não** devolve, e nenhuma
 * consulta ao catálogo de parâmetros de entrada a daria: `pg_get_function_arguments`, que o `CT-406`
 * já usa, devolve **só** os parâmetros de entrada (medido na T3). É por isso que aquele caso e este
 * não se sobrepõem, e é por isso que o docblock daquele passo diz, por escrito, que quem afirma o
 * retorno é este.
 *
 * **CT-728.** A RN-14 pede **duas** propriedades, e elas são afirmadas por **duas linhas distintas**,
 * nenhuma implicando a outra — quem prova o quê está escrito no caso, linha a linha:
 *
 *   * *as três são iguais entre si* — `new Set(valores).size === 1`, que reprova a função que
 *     distingue uma causa da outra **sem pressupor qual é o valor comum**;
 *   * *e o valor comum é o vazio* — a igualdade das três posições contra `[undefined × 3]`, que
 *     reprova a função devolvendo o **mesmo objeto não vazio** para as três causas.
 *
 * ⚠️ A ordem importa e o vício é conhecido: escrever primeiro a agregada que já fixa os três em
 * `undefined` e depois compará-los **entre si** produz `expect(undefined).toEqual(undefined)` —
 * infalível em qualquer estado do SUT, e o antipadrão `tautological_assertion` (AP-29) que já custou
 * duas rodadas de gate a este projeto na fatia `regua-de-cobranca`. As três posições entram na mesma
 * comparação, e não em três asserções separadas contra o vazio, porque separadas ficariam verdes
 * mesmo que uma das chamadas tivesse levantado por outro motivo.
 *
 * O **controle positivo** no mesmo arranjo é o que separa *"a função recusa as três"* de *"a função
 * não resolve nada"* — o modo de falha que a T3 mediu na prática, com a função devolvendo `[]` em
 * 100% das chamadas por causa do `FORCE ROW LEVEL SECURITY`.
 *
 * **CT-729.** A leitura da coluna sozinha não prova que o claro não é gravável — provaria apenas que
 * *hoje* ele não está lá, e uma coluna nova em outra tabela escaparia. A varredura sozinha não prova
 * que o que **está** gravado é o derivado correto. É a conjunção que fecha, e a varredura carrega o
 * par íntegro/mutante exigido pela `.claude/rules/testing-stack.md`.
 *
 * **Apoio do P1 (Gate 2).** Ele mede o que o apoio da §6.4 **não** alcança: aquele prova que o
 * consumo não se repete; este prova que o consumo **não acontece** quando o portador deixou de ser
 * válido. A distinção é a razão de existir do caso — as duas escritas do consumo correm numa
 * transação diferente da resolução (a primeira é sem contexto por construção, ADR-0027), e a metade
 * *(a)* monta exatamente a janela entre as duas: resolve, invalida por reenvio (RN-09), e só então
 * consome. Com um `WHERE` que olhasse só `consumido_em`, o `UPDATE` bloquearia na trava de linha,
 * reavaliaria o predicado depois do commit da invalidação e o acharia verdadeiro — gravando
 * `email_confirmado_em` para um endereço que ninguém confirmou.
 *
 * A asserção sobre os **quatro valores nulos** é o que separa *"a porta devolveu `undefined`"* de
 * *"a porta não escreveu nada"*: sem ela, uma implementação que gravasse o carimbo e devolvesse
 * `undefined` por outro caminho passaria. E o **controle positivo** da metade *(c)* é obrigatório
 * pela razão do CT-728 — sem ele, o caso ficaria verde sobre uma porta que nunca consome coisa
 * alguma, que é precisamente o que um predicado escrito ao contrário produziria.
 *
 * **Apoio da §6.4, cenário 4.** As três metades são obrigatórias, e cada uma mata um mutante
 * diferente. *(a)* sozinha é caminho feliz. *(b)* sozinha ficaria verde sobre uma função que nunca
 * consome nada — a 2ª devolveria `undefined` pelo motivo errado. E *(c)* é a que reprova o consumo
 * **não idempotente**: a implementação que trocasse `WHERE … AND consumido_em IS NULL` por
 * `WHERE derivado = $1` consome de novo e **reescreve** os dois carimbos, e nenhuma asserção sobre a
 * primeira apresentação a alcança. Duas escolhas de arranjo é que dão poder a *(c)*, e nenhuma é
 * cosmética: as duas apresentações correm em **unidades de trabalho separadas** (porque
 * `pg_catalog.now()` é o instante de início da transação, e a mesma unidade faria a reescrita gravar
 * o mesmo valor), e a comparação é sobre o **texto** do banco (porque o `Date` do driver trunca em
 * milissegundo). A âncora `pg_catalog.now() > consumido_em`, avaliada dentro da segunda unidade e
 * **pelo banco**, é o que impede o caso de passar por coincidência de relógio.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — a prova de falsificação do CT-729 e a do apoio da §6.4
 * ===========================================================================
 *
 * Aplicados ao fonte de produção e medidos pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — os pacotes resolvem `"."` para
 * `dist/`, e verde de invocação avulsa se leria como "o mutante sobreviveu", invertendo a conclusão.
 *
 *   * **controle** — árvore íntegra: `22 arquivos, 165 casos, 0 falhas` na rodada 1; `166` com o
 *     apoio da §6.4 acrescentado na rodada 2;
 *   * **MT8b-1 · o segredo em claro entra no `INSERT`** — em `src/portador-de-confirmacao.ts`, a
 *     interpolação da coluna `derivado` deixa de passar por `derivarSegredo` e recebe a variável do
 *     segredo bruto: `8 failed | 157 passed`. Os três do CT-729 reprovam pelas três vias que o caso
 *     tem — a **varredura estática** falha **nomeando o arquivo**
 *     (`módulo gravando o segredo em claro: packages/db/src/portador-de-confirmacao.ts`), a prova de
 *     falsificação falha no controle (`expected true to be false`, porque o "íntegro" já é o
 *     mutante), e a leitura da coluna do disco devolve o claro onde se espera o digest. Os outros
 *     cinco caem por consequência, e a razão é instrutiva: com o claro na coluna `derivado`, o
 *     `derivado` que os arranjos calculam por `derivarSegredo` deixa de casar linha alguma, e toda
 *     resolução some — inclusive a do `CT-730` e a dos dois casos de apoio de
 *     `cadastro-de-pessoa.spec.ts`, que confirmam o endereço pelo caminho real;
 *   * **MT8b-2 · o uso único cai** — em `consumirPortador`, o `WHERE` do CTE perde
 *     `AND consumido_em IS NULL` e passa a alcançar a linha em **toda** apresentação:
 *     `1 failed | 165 passed`, e o único caso que reprova é o apoio da §6.4. Ele é o mutante que
 *     motivou este caso a existir — antes dele, a mesma troca **passava em 165/165**;
 *   * **MT8b-2 (c), medido isoladamente** — com o mesmo mutante de produção e a metade *(b)*
 *     suprimida numa **cópia do arquivo de teste**, a metade *(c)* reprova por conta própria:
 *     `expected { …(4) } to deeply equal { …(4) }`, com os textos do banco denunciando a reescrita
 *     (`…258403` na primeira apresentação contra `…27682` depois da segunda). É a medição que prova
 *     que *(c)* não depende de *(b)* ter falhado antes — sem ela, a metade que o gate apontou como
 *     a que importa ficaria sem falsificação própria, escondida atrás da asserção anterior;
 *   * **MT8b-3 · o consumo deixa de conferir a INVALIDAÇÃO** — em `consumirPortador`, o `WHERE` do
 *     CTE perde `AND invalidado_em IS NULL`: `1 failed | 166 passed`, e o único vermelho é a metade
 *     *(a)* do apoio do P1 (`spec.ts:666`), com o consumo devolvendo `{ …(2) }` onde se espera
 *     `undefined` — é o portador invalidado por reenvio sendo consumido assim mesmo, e
 *     `email_confirmado_em` gravado para um endereço que ninguém confirmou;
 *   * **MT8b-4 · o consumo deixa de conferir o PRAZO** — o mesmo `WHERE` perde
 *     `AND expira_em > pg_catalog.now()`: `1 failed | 166 passed`, e o único vermelho é a metade
 *     *(b)* (`spec.ts:684`). As duas medições são **separadas de propósito**: fossem afirmadas por
 *     uma asserção só, um dos dois predicados poderia sumir sem que nada reprovasse;
 *   * **reversão** — `src/portador-de-confirmacao.ts` e este arquivo foram restaurados e conferidos
 *     idênticos aos originais por `diff -q`, e o controle voltou a `167 passed` (`166` antes do
 *     apoio do P1).
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada até a `0014`, descartada ao fim. Nenhuma coordenada de
 * conexão é lida do ambiente. O acesso é pelo papel `sysloc_app` — o mesmo da operação — e **nenhuma
 * conexão privilegiada é aberta neste arquivo**.
 *
 * ⚠️ **A resolução corre em unidade de trabalho SEM contexto de tenant**, e isso é o caminho da
 * operação, não um atalho de teste: quem apresenta o segredo não tem sessão (ADR-0027), a unidade
 * fixa `app.empresa_id = ''`, e é justamente esse estado que a função `SECURITY DEFINER` existe para
 * atravessar. As escritas do arranjo, essas sim, correm sob o contexto da empresa — pelo par
 * `contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho`, como a borda faz.
 *
 * **Nenhum `WHERE empresa_id` é escrito neste arquivo**, nem nas leituras cruas: quem recorta é a
 * política (ADR-0008). E **nenhum símbolo foi acrescentado a `packages/db/src/**` para que estas
 * provas existam** (Iron Law #6): `derivarSegredo` é publicada porque **a borda a consome** — ela
 * deriva o segredo apresentado antes de resolvê-lo —, e `gerarSegredo` sai pelo **par simétrico**
 * dela, nunca pelo consumo (nenhum consumidor fora deste pacote a importa) nem pela prova (o
 * `CT-729` a alcança pelo caminho direto do módulo). O critério inteiro está no cabeçalho de
 * `src/index.ts`, que é a versão única dele.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { esquemaDaApresentacaoDoPortador } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  consumirPortador,
  derivarSegredo,
  gerarSegredo,
  invalidarPortadoresDoLocatario,
  type PortadorResolvido,
  resolverPortador,
} from '../src/portador-de-confirmacao.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, semearPortadorDeConfirmacao } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar os três papéis, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas idas ao banco, todas sob unidade de trabalho. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: unidade de trabalho que vazasse reserva trava o caso seguinte. */
const RESERVA_DE_UMA = 1;

/** O contexto da empresa da carga inicial — o único usado pelas escritas deste arquivo. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

// ---------------------------------------------------------------------------
// O que o catálogo tem de dizer — literais do CASO, nunca derivados do SUT
// ---------------------------------------------------------------------------

/** O nome da função sob prova, como a migração `0014` a criou. */
const FUNCAO_DE_RESOLUCAO = 'resolver_portador_de_confirmacao';

/**
 * Os parâmetros de **entrada** que a função aceita — **exatamente** um, e ele não é empresa.
 *
 * Literal do caso, e não lido do SUT: derivá-lo do catálogo faria a asserção concordar com qualquer
 * assinatura que a migração declarasse, inclusive uma com `p_empresa uuid` — que é precisamente o
 * mutante que este conjunto existe para matar (ADR-0024).
 */
const ENTRADAS_DECLARADAS = ['p_derivado'] as const;

/**
 * As colunas que a função devolve — **exatamente** três, na ordem em que a `0014` as declara.
 *
 * Uma função `SECURITY DEFINER` que atravessa a política de linha é um furo declarado: o que ela
 * publica é o que qualquer portador de segredo alcança **sem sessão**, e cada coluna a mais alarga o
 * furo. `derivado`, `expira_em` e `criado_em` **não** estão aqui, e a ausência é a asserção.
 */
const COLUNAS_DECLARADAS = ['empresa_id', 'locatario_id', 'consumido_em'] as const;

/** Como o catálogo nomeia o modo de um parâmetro de entrada. */
const MODO_DE_ENTRADA = 'IN';

/** Como o catálogo nomeia cada coluna de um `RETURNS TABLE` — **medido**, e não `TABLE`. */
const MODO_DE_SAIDA = 'OUT';

/**
 * A assinatura inteira, como o `information_schema` a descreve — entradas e saídas na ordem.
 *
 * ⚠️ O modo das colunas de `RETURNS TABLE` é **`OUT`**, e não `TABLE`, e o valor foi **medido**
 * contra a instância efêmera: o PostgreSQL as registra como parâmetros de saída, e o
 * `information_schema` reflete isso. Escrever `TABLE` aqui, por analogia com a sintaxe da migração,
 * é a leitura intuitiva e está errada.
 */
const ASSINATURA_DECLARADA = [
  { nome: 'p_derivado', modo: MODO_DE_ENTRADA, tipo: 'text' },
  { nome: 'empresa_id', modo: MODO_DE_SAIDA, tipo: 'uuid' },
  { nome: 'locatario_id', modo: MODO_DE_SAIDA, tipo: 'uuid' },
  { nome: 'consumido_em', modo: MODO_DE_SAIDA, tipo: 'timestamp with time zone' },
] as const;

// ---------------------------------------------------------------------------
// O que o CT-729 mede sobre o segredo
// ---------------------------------------------------------------------------

/** 256 bits — o tamanho decodificado que `gerarSegredo` tem de produzir. */
const BYTES_DECLARADOS_DO_SEGREDO = 32;

/** 43 caracteres — o que 32 bytes dão em base64url, sem enchimento. Literal do caso. */
const COMPRIMENTO_DECLARADO_DO_SEGREDO = 43;

/** 64 caracteres — o que o SHA-256 dá em hexadecimal. */
const COMPRIMENTO_DECLARADO_DO_DERIVADO = 64;

/** O fonte que a varredura estática do CT-729 audita — o único que grava o portador. */
const MODULO_DE_GRAVACAO = 'packages/db/src/portador-de-confirmacao.ts';

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * As duas metades de uma interpolação de template, escritas **por composição**.
 *
 * A grafia direta (`'${…}'` dentro de aspas) é o que qualquer um escreveria, e o Biome a recusa por
 * `noTemplateCurlyInString` — a regra existe porque a forma quase sempre denuncia um template que
 * alguém escreveu com aspas por engano. Aqui a cadeia é o **objeto** da varredura, e não um erro de
 * digitação, então ela é montada em vez de literal.
 */
const ABRE_INTERPOLACAO = '$';
const FECHA_INTERPOLACAO = '}';

/** O texto que o fonte íntegro tem no `INSERT` — o alvo do `replace` do mutante. */
const INTERPOLACAO_DO_DERIVADO = `${ABRE_INTERPOLACAO}{derivarSegredo(segredo)${FECHA_INTERPOLACAO}`;

/** MT8b-1 — a gravação do claro, na grafia mais provável. */
const INTERPOLACAO_DO_CLARO = `${ABRE_INTERPOLACAO}{segredo${FECHA_INTERPOLACAO}`;

/** A mesma gravação com espaços, para provar que o detector olha a expressão e não o texto exato. */
const INTERPOLACAO_DO_CLARO_ESPACADA = `${ABRE_INTERPOLACAO}{ segredo ${FECHA_INTERPOLACAO}`;

/** O controle contra falso positivo: uma escrita que deriva dentro do próprio comando. */
const ESCRITA_LEGITIMA = `await tx\`INSERT INTO t (d) VALUES (${INTERPOLACAO_DO_DERIVADO})\`;`;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-727 — a superfície da função: um parâmetro de entrada, três colunas de saída
// ===========================================================================

describe('CT-727 — a `SECURITY DEFINER` não aceita empresa e devolve o mínimo', () => {
  it(
    'CT-727 — os parâmetros são exatamente `[p_derivado]` e as colunas exatamente as três da §7.3',
    async () => {
      const assinatura = await lerAssinaturaDoCatalogo();

      // --- Passo 1: a assinatura INTEIRA, por igualdade ordenada -------------------------------
      //
      // Um item a mais — de entrada ou de saída — aparece como diferença literal, e o tipo entra
      // junto porque `p_derivado uuid` seria outra função com o mesmo nome de parâmetro.
      expect(assinatura).toEqual([...ASSINATURA_DECLARADA]);

      // --- Passo 2: os dois eixos, separados, por IGUALDADE DE CONJUNTO -------------------------
      //
      // Nunca "inclui pelo menos": é a igualdade que mata o mutante `p_empresa uuid` acrescentado
      // "para filtrar", e é ela que mata a coluna a mais devolvida "para diagnóstico".
      expect(
        assinatura.filter((item) => item.modo === MODO_DE_ENTRADA).map((item) => item.nome),
        'a função aceita parâmetro que não é o derivado (ADR-0024)',
      ).toEqual([...ENTRADAS_DECLARADAS]);
      expect(
        assinatura.filter((item) => item.modo === MODO_DE_SAIDA).map((item) => item.nome),
        'a função devolve coluna além das três declaradas na §7.3 da tech spec',
      ).toEqual([...COLUNAS_DECLARADAS]);

      // --- Passo 3: a CHAMADA real, com um derivado que existe ---------------------------------
      //
      // O catálogo diz o que foi DECLARADO; esta perna diz o que sai. As duas são necessárias: uma
      // função declarada e morta passa no passo 1 (foi o defeito medido na T3, com `FORCE ROW LEVEL
      // SECURITY` engolindo a leitura), e uma função viva com retorno alargado passaria numa prova
      // que só chamasse.
      const cenario = await semearCenario('ct727');
      const linha = await resolverCru(cenario.derivado);

      if (linha === undefined) {
        throw new Error('a função não resolveu o portador vivo do arranjo');
      }

      // As CHAVES devolvidas, por igualdade de conjunto ordenado — o mesmo eixo do passo 2, agora
      // sobre o resultado e não sobre a declaração.
      expect(Object.keys(linha)).toEqual([...COLUNAS_DECLARADAS]);

      // E os VALORES, para que o conjunto de chaves não seja satisfeito por três nulos.
      expect(linha).toEqual({
        empresa_id: EMPRESA_A.id,
        locatario_id: cenario.locatarioId,
        consumido_em: null,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-728 — as três recusas são indistinguíveis entre si, e há controle positivo
// ===========================================================================

describe('CT-728 — inexistente, vencido e invalidado devolvem o MESMO vazio', () => {
  it(
    'CT-728 — as três chamadas devolvem o mesmo resultado, sem exceção, e o vivo resolve',
    async () => {
      const cenario = await semearCenario('ct728');

      // O portador INVALIDADO nasce PRIMEIRO, e a ordem é conteúdo: ele é invalidado pela porta real
      // do reenvio (RN-09), que alcança **todos** os vivos do locatário. Emitir o vencido antes o
      // deixaria vencido **e** invalidado, e as duas recusas deixariam de discriminar uma da outra —
      // o caso passaria a provar uma coisa só, com dois nomes.
      const aInvalidar = await emUnidade(
        async (tx) => await semearPortadorDeConfirmacao(tx, cenario.locatarioId),
      );
      const invalidados = await emUnidade(
        async (tx) => await invalidarPortadoresDoLocatario(tx, cenario.locatarioId),
      );

      // A precondição, afirmada: a invalidação alcançou os DOIS portadores vivos do locatário — o do
      // cenário e o recém-emitido. Sem esta linha, uma invalidação que não alcançasse nada deixaria
      // a perna seguinte verde por outro motivo.
      expect(invalidados).toBe(2);

      // O portador VENCIDO: criado DEPOIS da invalidação — logo com `invalidado_em` nulo — e
      // retrocedido no carimbo, no molde de `semearTentativaEm`. Nenhum mecanismo novo de avançar o
      // relógio é criado: o deslocamento sai de `pg_catalog.now()`, o mesmo que a função compara.
      const vencido = await emUnidade(
        async (tx) => await semearPortadorDeConfirmacao(tx, cenario.locatarioId, { vencido: true }),
      );

      // O derivado que NUNCA foi gravado — é o SHA-256 de um segredo sorteado e descartado, e não
      // uma cadeia inventada: é assim que ele fica no mesmo formato dos demais, de modo que a recusa
      // não possa vir da FORMA em vez da ausência.
      const inexistente = derivarSegredo(gerarSegredo());

      const recusas = {
        inexistente: await resolverSemContexto(inexistente),
        vencido: await resolverSemContexto(vencido.derivado),
        invalidado: await resolverSemContexto(aInvalidar.derivado),
      };

      // As duas propriedades da RN-14 são afirmadas SEPARADAMENTE, e nenhuma implica a outra — é o
      // que garante que cada linha possa reprovar por razão própria. Uma asserção agregada única
      // (`toEqual({inexistente: undefined, …})`) diria as duas de uma vez, e qualquer companheira
      // escrita depois dela seria `expect(undefined).toEqual(undefined)`: infalível por construção,
      // inclusive no defeito que este caso persegue.
      const valores = Object.values(recusas);

      // --- Propriedade 1: as três são IGUAIS ENTRE SI, sem pressupor QUAL é o valor comum --------
      //
      // É esta linha — e só ela — que reprova a função que distingue uma causa da outra, e ela o faz
      // sem saber de antemão o que a função devolve: o conjunto dos três resultados tem
      // cardinalidade 1 exatamente quando eles são indistinguíveis, seja qual for o valor.
      expect(new Set(valores).size, 'as três recusas não são indistinguíveis entre si').toBe(1);

      // --- Propriedade 2: e o valor comum é o VAZIO ---------------------------------------------
      //
      // Independente da anterior: uma função que devolvesse o MESMO objeto não vazio para as três
      // causas — vazando pelo corpo o que não vaza pela distinção — passaria na propriedade 1 e
      // morre aqui. As três posições entram na mesma comparação porque três asserções separadas
      // contra `undefined` ficariam verdes mesmo que uma das chamadas tivesse levantado por outro
      // motivo — e levantar já teria derrubado o caso acima.
      expect(valores, 'a recusa devolve algo em vez do conjunto vazio').toEqual([
        undefined,
        undefined,
        undefined,
      ]);

      // --- O CONTROLE POSITIVO, sobre o MESMO arranjo -------------------------------------------
      //
      // Sem ele, o caso ficaria verde sobre uma função que nunca resolve nada — que não é hipótese
      // teórica: é o defeito que a T3 mediu, com `FORCE ROW LEVEL SECURITY` fazendo a função
      // devolver `[]` em 100% das chamadas. O portador do controle também nasce depois da
      // invalidação, porque ela alcançou todos os anteriores.
      const vivo = await emUnidade(
        async (tx) => await semearPortadorDeConfirmacao(tx, cenario.locatarioId),
      );

      expect(await resolverSemContexto(vivo.derivado)).toEqual({
        empresaId: EMPRESA_A.id,
        locatarioId: cenario.locatarioId,
        consumidoEm: null,
      } satisfies PortadorResolvido);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-729 — 256 bits de fonte criptográfica, e o claro nunca vai ao disco
// ===========================================================================

describe('CT-729 — o segredo é sorteado por `node:crypto` e o banco guarda só o derivado', () => {
  it('CT-729 — dois sorteios de 32 bytes diferem, e o molde publicado os aceita', () => {
    const primeiro = gerarSegredo();
    const segundo = gerarSegredo();

    // O comprimento DECODIFICADO, e não o da cadeia: é ele que mede a entropia. 43 caracteres de
    // base64url decodificam em 32 bytes, e afirmar só o comprimento textual deixaria passar um
    // gerador que produzisse 43 caracteres de um alfabeto menor.
    expect(Buffer.from(primeiro, 'base64url')).toHaveLength(BYTES_DECLARADOS_DO_SEGREDO);
    expect(Buffer.from(segundo, 'base64url')).toHaveLength(BYTES_DECLARADOS_DO_SEGREDO);
    expect(primeiro).toHaveLength(COMPRIMENTO_DECLARADO_DO_SEGREDO);

    // Dois sorteios DIFEREM: um gerador constante — o modo de falha de quem troca `randomBytes` por
    // um valor fixo "para facilitar o teste" — passaria em tudo acima e morre aqui.
    expect(segundo).not.toBe(primeiro);

    // A AMARRA COM O CONTRATO PUBLICADO. O `{43}` de `esquemaDaApresentacaoDoPortador` e o
    // `randomBytes(32)` do gerador são o mesmo fato escrito em dois pacotes, e esta linha é o que
    // faz a divergência entre eles reprovar AQUI, no pacote que sorteia — em vez de aparecer como
    // `422` em toda confirmação depois de a fatia inteira estar de pé.
    expect(esquemaDaApresentacaoDoPortador.safeParse({ segredo: primeiro }).success).toBe(true);
  });

  it(
    'CT-729 — a coluna gravada é `sha256(segredo)` em hexadecimal, e nunca o segredo',
    async () => {
      const cenario = await semearCenario('ct729');

      const gravado = await lerDerivadoCru(cenario.derivado);

      // O valor esperado é recomputado AQUI, com `node:crypto` direto — e não obtido de
      // `derivarSegredo`: derivá-lo do SUT faria a asserção concordar com qualquer derivação que o
      // fonte declarasse, inclusive uma que gravasse o claro e chamasse isso de hash.
      const esperado = createHash('sha256').update(cenario.segredo, 'utf8').digest('hex');

      expect(gravado).toBe(esperado);
      expect(gravado).toHaveLength(COMPRIMENTO_DECLARADO_DO_DERIVADO);

      // E a metade que nomeia o dano: o que está na coluna **não** é o segredo. Ela é redundante com
      // a igualdade acima enquanto o SHA-256 for o SHA-256, e existe porque é ela que reprova
      // legivelmente quando o mutante troca a interpolação.
      expect(gravado).not.toBe(cenario.segredo);
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-729 — a varredura estática não encontra gravação do segredo em claro', async () => {
    const fonte = await readFile(`${RAIZ_DO_REPOSITORIO}${MODULO_DE_GRAVACAO}`, 'utf8');

    // Âncora antivácuo: um caminho errado devolveria erro de leitura, mas um arquivo esvaziado
    // passaria com a lista de comandos vazia — e "nenhuma gravação do claro" sobre zero comandos de
    // escrita é verdade vazia. As duas âncoras medem coisas diferentes: que o arquivo tem conteúdo,
    // e que o extrator achou os comandos de escrita que ele sabidamente tem.
    expect(fonte.length).toBeGreaterThan(0);
    expect(
      comandosDeEscrita(fonte).length,
      'o extrator não achou comando de escrita no módulo do portador',
    ).toBeGreaterThan(0);

    // A IGUALDADE, e quando reprovar a mensagem NOMEIA o arquivo — é o que o card do caso exige.
    const culpados = gravamOSegredoEmClaro(fonte) ? [MODULO_DE_GRAVACAO] : [];

    expect(culpados, `módulo gravando o segredo em claro: ${culpados.join(', ')}`).toEqual([]);
  });

  it('CT-729 — PROVA DE FALSIFICAÇÃO: o mutante que grava o claro é acusado, e o íntegro passa', async () => {
    const integro = await readFile(`${RAIZ_DO_REPOSITORIO}${MODULO_DE_GRAVACAO}`, 'utf8');

    // O controle, sobre a árvore real: o módulo íntegro passa limpo. Sem ele, um detector que
    // respondesse `true` para tudo produziria um caso sempre vermelho — e um que respondesse `false`
    // para tudo produziria o caso acima sempre verde.
    expect(gravamOSegredoEmClaro(integro)).toBe(false);

    // A cópia mutante existe só em memória, pela mesma razão dos mutantes de `barreira-de-envio`:
    // gravá-la no disco deixaria como resíduo um módulo de produção capaz de persistir o claro.
    //
    // MT8b-1 — a troca EXATA que o card descreve: a coluna `derivado` passa a receber a variável do
    // segredo bruto em vez do hash dela.
    const mutante = integro.replace(INTERPOLACAO_DO_DERIVADO, INTERPOLACAO_DO_CLARO);

    // O `replace` alcançou o alvo: sem esta linha, uma mudança futura no fonte faria o mutante ser
    // idêntico ao íntegro e a asserção seguinte viraria um teste sobre nada.
    expect(mutante).not.toBe(integro);
    expect(gravamOSegredoEmClaro(mutante)).toBe(true);

    // O SEGUNDO mutante, pela outra grafia plausível — a mesma troca com espaços em volta. Ele
    // mostra que o detector olha a EXPRESSÃO interpolada, e não um literal de texto.
    const espacado = integro.replace(INTERPOLACAO_DO_DERIVADO, INTERPOLACAO_DO_CLARO_ESPACADA);

    expect(espacado).not.toBe(integro);
    expect(gravamOSegredoEmClaro(espacado)).toBe(true);

    // E os CONTROLES contra falso positivo, que são o que impede o detector de reprovar o legítimo:
    // mencionar o segredo fora de comando de escrita, e derivá-lo dentro dele, continuam limpos.
    expect(gravamOSegredoEmClaro('const segredo = gerarSegredo();')).toBe(false);
    expect(gravamOSegredoEmClaro(ESCRITA_LEGITIMA)).toBe(false);
  });
});

// ===========================================================================
// Apoio (§6.4, cenário 4) — o uso único: a segunda apresentação não escreve NADA
// ===========================================================================

describe('apoio (§6.4, cenário 4) — o segundo consumo do mesmo portador devolve nada', () => {
  it(
    'apoio (§6.4, cenário 4) — a 1ª consome, a 2ª devolve `undefined`, e nenhum carimbo é reescrito',
    async () => {
      const cenario = await semearCenario('consumo');

      // --- A PRIMEIRA apresentação: consome, e é o controle positivo do caso --------------------
      //
      // Sem ela o caso ficaria verde sobre uma função que nunca consome nada — a 2ª devolveria
      // `undefined` pelo motivo errado, e os carimbos "preservados" seriam dois nulos.
      const primeiro = await emUnidade(async (tx) => await consumirPortador(tx, cenario.derivado));

      if (primeiro === undefined) {
        throw new Error('a primeira apresentação não consumiu o portador vivo do arranjo');
      }

      const apos = await lerCarimbosCrus(cenario.derivado);

      // (a) O retorno da 1ª é o locatário mais o carimbo que **ficou no disco** — e não um valor
      // recomposto no processo. A igualdade é contra a leitura crua, e não contra `expect.any(Date)`:
      // a forma frouxa ficaria verde sobre um instante qualquer, inclusive um do relógio do Node.
      expect(primeiro).toEqual({
        locatarioId: cenario.locatarioId,
        confirmadoEm: apos.confirmadoEm,
      });

      // E as DUAS colunas receberam o MESMO instante, na precisão de microssegundo em que o banco o
      // guarda. É a propriedade *"uma instrução, um instante só"* do módulo, e ela morreria em
      // silêncio se alguém trocasse `pg_catalog.now()` por `clock_timestamp()` — que dá dois
      // instantes vizinhos e faz "quando o endereço foi confirmado" depender de qual coluna se olha.
      expect(apos.consumidoEmTexto).toBe(apos.confirmadoEmTexto);

      // --- A SEGUNDA apresentação, em unidade de trabalho PRÓPRIA -------------------------------
      //
      // A separação é o que dá poder ao caso, e não conveniência de escrita: `pg_catalog.now()` é o
      // instante de **início da transação**, de modo que reaproveitar a unidade da primeira faria
      // uma reescrita gravar exatamente o mesmo valor — e a asserção (c) passaria sobre um consumo
      // que NÃO é idempotente. Duas unidades é também o caminho real: são duas requisições.
      const segunda = await emUnidade(async (tx) => {
        // A ÂNCORA ANTIVÁCUO, medida DENTRO da unidade que vai consumir e comparada **pelo banco**,
        // sem passar por `Date` do processo — que trunca em milissegundo e apagaria justamente a
        // diferença que se quer garantir. Ela afirma que o relógio desta transação é estritamente
        // posterior ao carimbo da primeira; sem ela, dois `now()` coincidentes tornariam a reescrita
        // indistinguível da preservação, e o caso ficaria verde sobre o defeito.
        const [relogio] = await tx<{ avancou: boolean }[]>`
          SELECT pg_catalog.now() > p.consumido_em AS avancou
            FROM negocio.portador_de_confirmacao p
           WHERE p.derivado = ${cenario.derivado}
        `;

        return {
          avancou: relogio?.avancou,
          consumo: await consumirPortador(tx, cenario.derivado),
        };
      });

      expect(
        segunda.avancou,
        'o relógio do banco não avançou entre as duas unidades — o caso não discriminaria',
      ).toBe(true);

      // (b) A AUSÊNCIA DE RETORNO é ela própria o resultado (RN-10) — não há `if` prévio de leitura,
      // e o que responde pela unicidade é o `WHERE … AND consumido_em IS NULL` do CTE.
      expect(segunda.consumo).toBeUndefined();

      // (c) E NADA foi reescrito: os quatro valores permanecem os da primeira apresentação, os dois
      // textos iguais **byte a byte** na precisão em que o banco os guarda. É esta linha que reprova
      // a implementação que consome de novo — a que trocasse o `WHERE` do CTE por `derivado = $1` —,
      // e é a metade pela qual o caso existe: sem ela, um consumo NÃO idempotente que reescrevesse
      // os dois carimbos passaria em (a) e (b) sem que nada acusasse.
      expect(await lerCarimbosCrus(cenario.derivado)).toEqual(apos);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Apoio (P1 · Gate 2) — o consumo confere validade, e não só unicidade
// ===========================================================================

describe('apoio (P1 · Gate 2) — invalidado e vencido não são consumidos', () => {
  it(
    'apoio (P1) — a invalidação entre resolver e consumir impede o consumo, e o vivo continua consumindo',
    async () => {
      // --- (a) A CORRIDA REAL: resolver, invalidar, consumir -----------------------------------
      //
      // As três chamadas correm em unidades de trabalho distintas de propósito — é a topologia da
      // operação, não conveniência de escrita: a resolução é sem contexto por construção (ADR-0027),
      // e o commit da invalidação cai na janela entre ela e o consumo.
      const corrida = await semearCenario('corrida');

      // A borda chegaria até aqui: a resolução ainda encontra o portador, e é com esse resultado que
      // ela fixaria o contexto e chamaria o consumo. Sem esta linha, o caso não distinguiria "o
      // consumo recusou o inválido" de "não havia portador algum a consumir".
      expect(await resolverSemContexto(corrida.derivado)).toEqual({
        empresaId: EMPRESA_A.id,
        locatarioId: corrida.locatarioId,
        consumidoEm: null,
      } satisfies PortadorResolvido);

      // A invalidação pela porta real do reenvio (RN-09) — o mesmo caminho que o `PUT` de troca de
      // e-mail percorre antes de emitir o portador novo.
      const invalidados = await emUnidade(
        async (tx) => await invalidarPortadoresDoLocatario(tx, corrida.locatarioId),
      );

      expect(invalidados, 'a invalidação do arranjo não alcançou o portador').toBe(1);

      // O consumo em voo, chegando DEPOIS do commit da invalidação. Ele não escreve.
      expect(
        await emUnidade(async (tx) => await consumirPortador(tx, corrida.derivado)),
      ).toBeUndefined();

      // E a metade que nomeia o dano: **nada** foi gravado. Devolver `undefined` não basta — o que
      // esta linha reprova é a implementação que grava `email_confirmado_em` para um endereço que
      // ninguém confirmou, que é o desfecho inteiro do achado.
      expect(await lerCarimbosCrus(corrida.derivado)).toEqual(CARIMBOS_INTOCADOS);

      // --- (b) O VENCIDO, no mesmo eixo ---------------------------------------------------------
      //
      // Outro locatário, para que a invalidação de (a) não alcance nada daqui e as duas recusas
      // continuem discriminando uma da outra.
      const prazo = await semearCenario('prazo');
      const vencido = await emUnidade(
        async (tx) => await semearPortadorDeConfirmacao(tx, prazo.locatarioId, { vencido: true }),
      );

      expect(
        await emUnidade(async (tx) => await consumirPortador(tx, vencido.derivado)),
      ).toBeUndefined();
      expect(await lerCarimbosCrus(vencido.derivado)).toEqual(CARIMBOS_INTOCADOS);

      // --- (c) O CONTROLE POSITIVO, no MESMO arranjo --------------------------------------------
      //
      // O portador vivo do locatário de (b) — emitido por `semearCenario`, nunca invalidado e dentro
      // do prazo — consome normalmente. Sem esta metade, um predicado escrito ao contrário
      // (`invalidado_em IS NOT NULL`, ou `expira_em < now()`) faria a porta nunca consumir nada e o
      // caso ficaria verde sobre ela.
      const consumo = await emUnidade(async (tx) => await consumirPortador(tx, prazo.derivado));
      const carimbos = await lerCarimbosCrus(prazo.derivado);

      expect(carimbos.confirmadoEm, 'o controle positivo não gravou o carimbo').not.toBeNull();
      expect(consumo).toEqual({
        locatarioId: prazo.locatarioId,
        confirmadoEm: carimbos.confirmadoEm,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Acessórios — nenhum deles alcança o banco fora de uma unidade de trabalho
// ===========================================================================

/** Um cenário montado: o locatário da empresa A e o portador vivo dele. */
interface Cenario {
  readonly locatarioId: string;
  readonly segredo: string;
  readonly derivado: string;
}

/** Um item da assinatura da função, como o `information_schema` a descreve. */
interface ItemDaAssinatura {
  readonly nome: string;
  readonly modo: string;
  readonly tipo: string;
}

/**
 * Executa o trabalho sob o contexto da empresa A, dentro de uma unidade de trabalho.
 *
 * É o caminho por onde toda **escrita** deste arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    CONTEXTO_DE_A,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * Executa o trabalho **sem contexto de tenant algum** — o estado real da rota sem sessão.
 *
 * A ausência de `executarCom` é a decisão, e não esquecimento: a unidade fixa `app.empresa_id = ''`,
 * a política de isolamento vira `empresa_id = NULL` e não casa linha nenhuma. É exatamente esse
 * estado que a função `SECURITY DEFINER` da `0014` existe para atravessar (ADR-0024, ADR-0027).
 */
async function semContexto<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await acesso.emUnidadeDeTrabalho(trabalho);
}

/** A resolução pela **porta de produção**, sem contexto — o caminho que a T11 vai usar. */
async function resolverSemContexto(derivado: string): Promise<PortadorResolvido | undefined> {
  return await semContexto(async (tx) => await resolverPortador(tx, derivado));
}

/**
 * A resolução **crua**, com `SELECT *` — é ela que expõe o conjunto de colunas que a função publica.
 *
 * A porta de produção projeta apelidos, e por isso não serve a este eixo: ela devolveria as chaves
 * que o TypeScript declara, e não as que o banco devolveu. O que o `CT-727` afirma é a superfície da
 * **função**, e ela só é observável pelo `*`.
 */
async function resolverCru(derivado: string): Promise<Record<string, unknown> | undefined> {
  return await semContexto(async (tx) => {
    const [linha] = await tx<Record<string, unknown>[]>`
      SELECT * FROM negocio.resolver_portador_de_confirmacao(${derivado})
    `;

    return linha === undefined ? undefined : { ...linha };
  });
}

/** A assinatura da função como o `information_schema` a descreve, entradas e saídas na ordem. */
async function lerAssinaturaDoCatalogo(): Promise<ItemDaAssinatura[]> {
  return await semContexto(async (tx) => {
    const itens = await tx<ItemDaAssinatura[]>`
      SELECT p.parameter_name AS nome,
             p.parameter_mode AS modo,
             p.data_type      AS tipo
        FROM information_schema.parameters p
        JOIN information_schema.routines r
          ON r.specific_name = p.specific_name
         AND r.specific_schema = p.specific_schema
       WHERE r.routine_schema = 'negocio'
         AND r.routine_name = ${FUNCAO_DE_RESOLUCAO}
       ORDER BY p.ordinal_position
    `;

    return itens.map((item) => ({ nome: item.nome, modo: item.modo, tipo: item.tipo }));
  });
}

/**
 * O valor da coluna `derivado`, lido **cru** do disco, sob o contexto da empresa.
 *
 * A leitura é por igualdade com o derivado esperado, e não uma varredura da tabela: o que se observa
 * é a linha daquele portador, e uma consulta que devolvesse qualquer linha faria o caso passar sobre
 * o portador de outro cenário. `undefined` reprova adiante, porque a asserção compara valores.
 */
async function lerDerivadoCru(derivado: string): Promise<string | undefined> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ derivado: string }[]>`
      SELECT derivado FROM negocio.portador_de_confirmacao WHERE derivado = ${derivado}
    `;

    return linha?.derivado;
  });
}

/**
 * Os dois carimbos que o consumo grava, cada um em **duas formas** — e as duas têm serventia.
 *
 * O `Date` é o que o retorno da porta carrega, e é contra ele que a igualdade do retorno é escrita.
 * O **texto** é o que o banco guarda, com microssegundo: o `Date` do driver trunca em milissegundo,
 * e a asserção de que *nada foi reescrito* perderia exatamente a diferença que ela existe para pegar
 * se fosse escrita só sobre ele.
 *
 * ⚠️ Os quatro admitem **nulo**, e o tipo diz isso porque é estado alcançável e observado: o portador
 * que o consumo **recusou** tem os dois carimbos nulos, e é justamente essa leitura que o apoio do P1
 * afirma. Declarar `Date` aqui seria um tipo que mente sobre a linha lida do disco.
 */
interface CarimbosCrus {
  readonly consumidoEm: Date | null;
  readonly consumidoEmTexto: string | null;
  readonly confirmadoEm: Date | null;
  readonly confirmadoEmTexto: string | null;
}

/**
 * O portador que **não** foi consumido — os quatro valores nulos, escritos uma vez só.
 *
 * Ele é o literal do caso, e não um valor derivado da leitura: comparar a leitura com ela mesma seria
 * a tautologia que o AP-29 nomeia.
 */
const CARIMBOS_INTOCADOS: CarimbosCrus = {
  consumidoEm: null,
  consumidoEmTexto: null,
  confirmadoEm: null,
  confirmadoEmTexto: null,
};

/**
 * Os carimbos do portador e do locatário, lidos **crus** do disco, sob o contexto da empresa.
 *
 * O locatário é alcançado pelo `locatario_id` **da própria linha do portador**, e não por um
 * identificador que o caso passe: é assim que a leitura observa o vínculo que a instrução de consumo
 * usou, em vez de reconstruí-lo por fora. **Nenhum `WHERE empresa_id` é escrito** — quem recorta as
 * duas tabelas é a política (ADR-0008).
 */
async function lerCarimbosCrus(derivado: string): Promise<CarimbosCrus> {
  const carimbos = await emUnidade(async (tx) => {
    const [linha] = await tx<CarimbosCrus[]>`
      SELECT p.consumido_em              AS "consumidoEm",
             p.consumido_em::text        AS "consumidoEmTexto",
             l.email_confirmado_em       AS "confirmadoEm",
             l.email_confirmado_em::text AS "confirmadoEmTexto"
        FROM negocio.portador_de_confirmacao p
        JOIN negocio.locatario l ON l.id = p.locatario_id
       WHERE p.derivado = ${derivado}
    `;

    return linha;
  });

  if (carimbos === undefined) {
    throw new Error('a leitura crua não achou o portador do arranjo nem o locatário dele');
  }

  return carimbos;
}

/** O contador que mantém os documentos dos cenários distintos entre si. */
let sequenciaDoCenario = 0;

/**
 * Cria um locatário da empresa A e emite o portador vivo dele, pelas **portas de produção**.
 *
 * Nada aqui é `INSERT` cru: o locatário nasce por `criarPessoa` e o portador por
 * `semearPortadorDeConfirmacao`, que por sua vez chama `emitirPortador`. É o mesmo caminho que a
 * borda do disparo usa por dentro.
 */
async function semearCenario(marca: string): Promise<Cenario> {
  sequenciaDoCenario += 1;

  return await emUnidade(async (tx) => {
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(marca));
    const portador = await semearPortadorDeConfirmacao(tx, locatario.id);

    return { locatarioId: locatario.id, segredo: portador.segredo, derivado: portador.derivado };
  });
}

/** Um cadastro mínimo e válido — nada dele participa do que está sob prova. */
function pessoaDe(marca: string): DadosDaPessoa {
  return {
    nome: `Locatária ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(50_000_000_000 + sequenciaDoCenario),
    rg: null,
    email: `${marca}@exemplo.invalid`,
    telefone: '11999990000',
    logradouro: 'Rua da Confirmação',
    numero: '72',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01001000',
  };
}

// ---------------------------------------------------------------------------
// O detector da varredura estática — o MESMO para o íntegro e para o mutante
// ---------------------------------------------------------------------------

/**
 * O fonte **sem comentários** — o passo que impede a varredura de auditar prosa.
 *
 * Este módulo documenta as próprias instruções em docblock, e o texto delas contém `INSERT` e
 * `UPDATE` entre crases. Sem esta limpeza, o extrator abaixo trataria uma citação como comando e a
 * varredura passaria a depender do que os comentários dizem — que é o oposto do que ela existe para
 * medir.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * Os comandos de **escrita** do fonte: cada literal de template, já fora de comentário, que contenha
 * `INSERT` ou `UPDATE`.
 *
 * O recorte é o ponto: o segredo em claro **circula** por este módulo de propósito — ele é sorteado,
 * é derivado e é devolvido ao chamador —, e um detector que apenas procurasse a palavra reprovaria o
 * arquivo correto. O que não pode acontecer é ele **entrar num comando de escrita**, e é só ali que
 * a varredura olha.
 */
function comandosDeEscrita(fonte: string): string[] {
  const literais = semComentarios(fonte).match(/`[^`]*`/g) ?? [];

  return literais.filter((literal) => /\b(INSERT\s+INTO|UPDATE)\b/.test(literal));
}

/**
 * O detector: alguma escrita interpola o **segredo bruto** em vez do derivado dele?
 *
 * Ele olha cada interpolação `${…}` dos comandos de escrita e reprova a que mencione `segredo`
 * **sem** passar por `derivarSegredo(`. É por isso que ele acusa `${segredo}` e `${ segredo }` e
 * deixa passar `${derivarSegredo(segredo)}` — a diferença entre gravar o claro e gravar o hash é
 * exatamente essa, e é a única que importa.
 */
function gravamOSegredoEmClaro(fonte: string): boolean {
  return comandosDeEscrita(fonte).some((comando) => {
    const interpolacoes = comando.match(/\$\{[^}]*\}/g) ?? [];

    return interpolacoes.some(
      (expressao) => /\bsegredo\b/.test(expressao) && !/derivarSegredo\s*\(/.test(expressao),
    );
  });
}
