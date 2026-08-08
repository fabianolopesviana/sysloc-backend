/**
 * Metragem total derivada e cômodos — CT-305, CT-305 (b), CT-306, CT-307, CT-309, CT-317 e CT-325.
 * T7 da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-04    | CT-305 | Para os **quatro** cenários capturados do sistema antigo, a metragem total
 * | CA-05    |        | derivada na leitura é exatamente `0`, `25.5`, `67.75` e `58.5`, entregue
 * | CA-16    |        | como `number` (nunca o texto que `numeric` devolve pelo driver), e o vetor
 * |          |        | de cômodos bate um a um — nome, metragem e posição — com
 * |          |        | `comodos_persistidos` do golden, **na ordem de posição**. |
 * | CA-04    | CT-305 | A soma é **exata** para combinações de centésimos que o ponto flutuante não
 * | CA-05    | (b)    | representa: `10.06 + 10.07` vale `20.13` e `18.21 + 12.13 + 9.07` vale
 * |          |        | `39.41`, e as duas somas **diretas** dos mesmos valores são MEDIDAS como
 * |          |        | diferentes desses resultados. Nenhum cenário do golden discrimina isto —
 * |          |        | os quatro são exatos em binário. A soma de nenhum cômodo é `0`. |
 * | CA-05    | CT-306 | Cômodo criado sem metragem informada persiste `0.00` na COLUNA
 * |          |        | `negocio.comodo.metragem`, lida crua, e não nulo; a coluna é
 * |          |        | `NOT NULL DEFAULT 0` e a tentativa de gravar nulo é recusada pelo servidor
 * |          |        | com `SQLSTATE 23502`. A soma do imóvel continua `58.5`. |
 * | CA-04    | CT-307 | Para o mesmo imóvel, a `metragemTotal` devolvida pela leitura do item, pela
 * | CA-15    |        | listagem e pela porta de circulação é o **mesmo** valor, nos quatro
 * |          |        | cenários — não existe segunda soma escrita por consulta. |
 * | CA-04    | CT-309 | Cômodos são devolvidos ordenados por `posicao` crescente, e o vetor
 * |          |        | devolvido **difere** da ordem em que o banco os entrega sem `ORDER BY` —
 * |          |        | a ordem é propriedade da consulta, não do retorno do servidor. |
 * | CA-06    | CT-317 | `negocio.comodo` **não tem** coluna de retirada de circulação, e a remoção
 * |          |        | apaga a linha: a contagem cai de 3 para 2, o identificador removido some,
 * |          |        | a metragem passa de `67.75` para `37.5` e as posições remanescentes
 * |          |        | continuam `1` e `3` — a remoção **não** renumera. |
 * | CA-02    | CT-325 | Criar imóvel com N cômodos é atômico: a falha no enésimo não deixa gravados
 * | CA-04    |        | nem o imóvel nem os cômodos anteriores. E `emUnidadeDeTrabalho` chamada de
 * |          |        | dentro de outra **continua** rejeitando com `ErroDeUnidadeAninhada`. |
 *
 * Rastreabilidade: `CA-04 → CT-305 (RN-02)`, `CA-05 → CT-305 (RN-02)`, `CA-16 → CT-305 (RN-12)`,
 * `CA-04 → CT-305 (b) (RN-02)`, `CA-05 → CT-305 (b) (RN-02)`,
 * `CA-05 → CT-306 (RN-02)`, `CA-04 → CT-307 (RN-02)`, `CA-15 → CT-307 (RN-02)`,
 * `CA-04 → CT-309 (RN-07)`, `CA-06 → CT-317 (RN-05)`, `CA-02 → CT-325 (RN-01)`,
 * `CA-04 → CT-325 (RN-02)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T7 — leia antes de comparar com a §5 e a §6.6
 * ===========================================================================
 *
 * 1. **Os cards da §6.6 propõem `packages/db/test/imovel.spec.ts` e
 *    `packages/db/test/unidade-na-borda.spec.ts`; a §5.1 declara `metragem.spec.ts`.** Vence a §5, e
 *    a razão é a mesma que a T6 registrou: os seis casos precisam da **mesma** montagem (uma
 *    instância efêmera migrada e semeada), e um segundo arquivo subiria outro PostgreSQL para provar
 *    a mesma superfície. O card do `CT-325` já admite "ou o próprio `imovel.spec.ts`"; o que ele
 *    **proíbe** é acrescentar ao `CT-013` de `unidade-de-trabalho.spec.ts`, cujo eixo é a recusa de
 *    aninhamento e não a composição — e essa proibição é respeitada: nada foi acrescentado lá.
 * 2. **O card do `CT-307` fala em "carteira expandida"; ela não existe nesta fatia.** O
 *    `expandir=imoveis` da §4.1 chega numa task posterior, e afirmar um caminho inexistente seria
 *    asserção vazia. O terceiro caminho de leitura que **existe hoje** é
 *    {@link definirCirculacaoDoImovel}, que tem `RETURNING` próprio e monta o agregado por conta —
 *    isto é, é exatamente um terceiro lugar onde uma segunda soma poderia nascer, que é o que o caso
 *    persegue. Quando a carteira existir, ela entra aqui como quarto mapa.
 * 3. **O card do `CT-309` pede inserção com posições embaralhadas (`3, 1, 2`); isso é
 *    irrepresentável pelo caminho legítimo.** A posição é atribuída pelo servidor como
 *    `max(posicao) + 1` (§6.2), de modo que a ordem de inserção e a de posição **coincidem sempre**
 *    numa sequência de acréscimos — o setup do card produziria um caso que não discrimina. O que
 *    discrimina, e é o que o caso faz, é separar a ordem de posição da **ordem de armazenamento**:
 *    uma alteração no primeiro cômodo, numa página já cheia, grava a versão nova da linha adiante, e
 *    a consulta sem `ORDER BY` passa a devolver aquele cômodo por último. A asserção de diferença
 *    que o card exige está lá, medida contra essa ordem — e a consequência concreta (o cômodo de
 *    posição 1 é o último) é ela mesma afirmada, para que o caso reprove **alto** no dia em que
 *    deixar de discriminar, em vez de ficar verde sem prova. Ver "COMO A ORDEM FÍSICA É POSTA EM
 *    DESACORDO", em {@link ENCHIMENTO}, para as duas medições que fixaram o desenho.
 * 4. **O `valor_sentinela_de_entrada: -1.0` do golden NÃO vira caso.** Ele é marca de *"não
 *    informado"* na **captura do sistema antigo** — um artefato de como o Server Script do Frappe
 *    representava a ausência —, e não um valor que algum usuário digitou. A entrada equivalente no
 *    produto novo é a **ausência do campo**, que é o que os cenários com `metragem: null` exercitam
 *    aqui. Reintroduzi-lo como entrada seria provar o comportamento do legado em vez do nosso — e,
 *    pior, seria recusado pelo `check(metragem >= 0)` do esquema, produzindo um caso que "passa"
 *    afirmando a coisa errada. **Não o reintroduza.**
 *
 * ===========================================================================
 * O GOLDEN É LIDO DO ARQUIVO VERSIONADO, NUNCA REDIGITADO
 * ===========================================================================
 *
 * Ele é o **oráculo** — o registro capturado do sistema antigo, em
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/metragem.json`. Redigitá-lo aqui
 * faria a asserção concordar com quem a escreveu, e o valor de equivalência com o legado
 * desapareceria em silêncio no primeiro erro de transcrição.
 *
 * A contagem de cenários exercitados é **ela mesma afirmada em 4**: sem essa linha, um golden
 * truncado — ou um `for` que parasse cedo — deixaria o caso verde tendo provado dois cenários.
 *
 * ===========================================================================
 * PRECONDIÇÃO PRIVILEGIADA — tudo pela API pública do pacote
 * ===========================================================================
 *
 * `negocio.imovel` e `negocio.comodo` nascem sob RLS **forçada**: ler e escrever nelas exige contexto
 * de tenant fixado. O contexto vem **exclusivamente** de `contextoDeTenant.executarCom` mais
 * `abrirAcessoAoBanco` — o mesmo par que a guarda e o controlador usam em operação. Nenhuma conexão
 * privilegiada é aberta neste arquivo, nenhuma consulta compara `empresa_id`, e **nenhum símbolo foi
 * acrescentado a `packages/db/src/**` para que estas provas existam** (Iron Law #6, ADR-0006,
 * ADR-0008).
 *
 * A entrada de cômodo é montada por `esquemaDeComodoNovo`, de `@sysloc/contracts`, e **não** por um
 * objeto literal: é ele que aplica a RN-02 (*metragem ausente vale zero*) na borda, e é o caminho
 * real do produto. O `CT-306` depende disso para que "sem metragem informada" signifique aqui o que
 * significa numa requisição.
 *
 * As leituras cruas — a coluna do `CT-306`, o catálogo do `CT-317`, a ordem física do `CT-309` e as
 * contagens do `CT-325` — são **observação de estado**, não caminho de escrita, e correm sob o mesmo
 * contexto de tenant. É o mesmo padrão de `contarConjuntos` em
 * `apps/api/test/cadastro-de-imoveis.e2e.spec.ts`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os seis reprovam, mais o MT7-9
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca
 * por `vitest run` avulso — os casos daqui carregam o SUT por caminho relativo, mas a regra é
 * "sempre pelo script" e ela não se negocia caso a caso.
 *
 *   * **controle** — árvore íntegra: `8 arquivos, 52 casos, 0 falhas`;
 *   * **MT7-1 · a soma é escrita DUAS vezes** — `localizarImovel` passa a somar por conta própria,
 *     com um laço que ignora o primeiro cômodo (a forma que uma "otimização" produziria):
 *     `5 failed | 47 passed`, e o **CT-307** reprova nomeando o par que discorda —
 *     *"a leitura do item divergiu da listagem"*. É o caso que existe para isto: as outras quatro
 *     falhas são consequência, e nenhuma delas nomearia a causa;
 *   * **MT7-2 · a normalização vai só para a SOMA** — a coluna perde o `NOT NULL` na migração, a
 *     escrita grava `null` no lugar do zero e a leitura trata nulo como zero: `1 failed | 51 passed`,
 *     **só** no `CT-306`, na leitura crua da coluna (`['Deposito', null]` onde se espera
 *     `['Deposito', '0.00']`). O `CT-305` fica **verde** — os quatro cenários do golden continuam
 *     dando 0, 25.5, 67.75 e 58.5 —, e é exatamente essa assimetria que justifica os dois casos
 *     existirem separados. Sem o `CT-306`, este defeito atravessaria a suíte inteira;
 *   * **MT7-3 · a consulta perde o `ORDER BY imovel_id, posicao, id`**: `1 failed | 51 passed`, no
 *     **CT-309**. **A primeira redação do caso não o matava**, e a medição é a razão do desenho
 *     atual: sem forçar a varredura sequencial numa conexão nova, o percurso do índice
 *     `comodo_empresa_imovel_posicao_idx` entrega a ordem de posição de graça e o mutante sobrevive.
 *     Ver "COMO A ORDEM FÍSICA É POSTA EM DESACORDO", em {@link ENCHIMENTO};
 *   * **MT7-4 · `negocio.comodo` ganha `retirado_em` "por simetria"** — coluna acrescentada à
 *     migração, `removerComodo` virando `UPDATE … SET retirado_em = now()` e a leitura filtrando por
 *     `retirado_em IS NULL`: `1 failed | 51 passed`, no **CT-317**, na igualdade das colunas do
 *     catálogo (seis esperadas, sete encontradas). Note que a marcação **imita** a remoção em todo o
 *     resto — a contagem por leitura cai, a metragem vira 37.5 —, e é a asserção sobre a AUSÊNCIA da
 *     coluna que discrimina;
 *   * **MT7-5 · a conversão de `numeric` some** (`Number(linha.metragem)` virando conversão de tipo
 *     sem efeito em execução): `2 failed | 50 passed`, no **CT-305** e no **CT-317**, na igualdade
 *     profunda do vetor de cômodos — `'25.50'` onde se espera `25.5`. É a falha silenciosa que o
 *     `typeof` do card persegue, e ela aparece antes mesmo daquela linha;
 *   * **MT7-6 · a composição sai de UMA unidade** — `acrescentarComodo` passa a envolver o `INSERT`
 *     num `SAVEPOINT` com captura por fora, de modo que a falha do enésimo cômodo desfaz **só ele** e
 *     a unidade externa segue e commita: `1 failed | 51 passed`, no **CT-325** — a recusa nomeada
 *     deixa de chegar ao chamador (`expected undefined to be '23514'`), e o imóvel com dois cômodos
 *     sobrevive. **A primeira forma deste mutante foi ineficaz** e está registrada porque a lição
 *     vale: capturar o erro DENTRO do `savepoint`, sem deixar o driver desfazer, mantém a transação
 *     em estado abortado e o `COMMIT` falha do mesmo jeito — o desfazimento continuava acontecendo,
 *     e o mutante não mudava comportamento nenhum;
 *   * **reversão** — os três fontes (`src/comodo.ts`, `src/imovel.ts` e a migração `0005`) foram
 *     restaurados e conferidos idênticos ao original por `diff`, e o controle voltou a `52 passed`.
 *
 * ---------------------------------------------------------------------------
 * MT7-9 (2026-08-06) — a aritmética da soma, que nenhum dos seis alcançava
 * ---------------------------------------------------------------------------
 *
 * Ele nasceu de uma **lacuna medida**: {@link somarMetragem} soma em centésimos justamente para não
 * deixar resíduo binário, e o docblock dela declarava o defeito fechado *"e, na mesma frase, que a
 * prova não existe"* — os quatro cenários do golden são todos exatos em binário. Nenhum dos seis
 * mutantes acima ataca a aritmética: o **MT7-1 troca o PONTO de soma** (uma segunda soma em
 * `localizarImovel`), não a conta. Antes do `CT-305 (b)`, a função aparecia em teste num único lugar
 * — a lista `SIMBOLOS_ESPERADOS` de `test/unidade-de-trabalho.spec.ts`, que afirma a superfície
 * publicada do pacote e não observa comportamento algum.
 *
 *   * **controle** — árvore íntegra: `8 arquivos, 53 casos, 0 falhas`;
 *   * **MT7-9 · a soma volta a ser feita em ponto flutuante** — o corpo trocado pela "simplificação"
 *     idiomática (`comodos.reduce((total, comodo) => total + comodo.metragem, 0)`), com
 *     `CENTESIMOS_POR_UNIDADE` removido junto, que é o que o compilador obriga e o que aquela
 *     simplificação faria: `1 failed | 52 passed`, no **CT-305 (b)** —
 *     `expected 20.130000000000003 to be 20.13`. A suíte de `@sysloc/api` fica **inteira verde**
 *     (`110 passed`), medida em separado: os valores que ela exercita (`67.75`, `77.75`, `25.5`) são
 *     exatos em binário, e é exatamente essa cegueira que o caso novo fecha;
 *   * **reversão** — `src/imovel.ts` foi restaurado e conferido idêntico ao original por `diff -q`, e
 *     o controle voltou a `53 passed`.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { esquemaDeComodoNovo } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acrescentarComodo,
  alterarComodo,
  type ComodoPersistido,
  removerComodo,
} from '../src/comodo.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  criarImovel,
  type DadosDoImovel,
  definirCirculacaoDoImovel,
  type ImovelPersistido,
  listarImoveis,
  localizarImovel,
  somarMetragem,
} from '../src/imovel.ts';
import { EMPRESA_A } from '../src/semente.ts';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  ErroDeUnidadeAninhada,
} from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso escreve poucas dezenas de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho do arquivo correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O golden — o oráculo, lido do arquivo versionado
// ---------------------------------------------------------------------------

/** O registro capturado do sistema antigo. Caminho relativo a este arquivo, nunca ao processo. */
const CAMINHO_DO_GOLDEN = fileURLToPath(
  new URL(
    '../../../docs/specs/features/caracterizacao-regras-legadas/v1/golden/metragem.json',
    import.meta.url,
  ),
);

/** Quantos cenários o golden traz — a âncora contra arquivo truncado ou laço que para cedo. */
const CENARIOS_DO_GOLDEN = 4;

/** Um cômodo como o golden o registra, na entrada e na persistência. */
interface ComodoDoGolden {
  readonly nome_comodo: string;
  /** `null` na entrada significa **não informado**; na persistência o golden já traz `0.0`. */
  readonly metragem: number | null;
  /** A posição, presente só nos persistidos. */
  readonly idx?: number;
}

interface CenarioDoGolden {
  readonly comodos_entrada: readonly ComodoDoGolden[];
  readonly comodos_persistidos: readonly ComodoDoGolden[];
  readonly imovel_ref: string;
  readonly valor_agregado: number;
}

interface Golden {
  readonly cenarios: Readonly<Record<string, CenarioDoGolden>>;
  readonly valor_sentinela_de_entrada: number;
}

/** Um cômodo na forma que os casos comparam — o que o contrato publica, menos o identificador. */
interface ComodoComparavel {
  readonly nomeComodo: string;
  readonly metragem: number;
  readonly posicao: number;
}

let golden: Golden;
let cenarios: readonly (readonly [string, CenarioDoGolden])[];

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/** A janela das listagens do arquivo: larga o bastante para alcançar todos os imóveis criados. */
const JANELA_LARGA = { limite: 500, deslocamento: 0 } as const;

/** Os três cômodos do cenário `varios_comodos`, usados pelos casos que não vêm do golden. */
const SALA = { nomeComodo: 'Sala', metragem: 25.5 } as const;
const QUARTO = { nomeComodo: 'Quarto', metragem: 30.25 } as const;
const COZINHA = { nomeComodo: 'Cozinha', metragem: 12 } as const;

/**
 * Os dez cômodos do `CT-309`, na ordem em que são acrescentados — e, portanto, de posição.
 *
 * A ordem é **anti-alfabética** de propósito: um `ORDER BY nome_comodo`, que é a troca mais provável
 * de quem "arruma" a consulta, produziria um vetor diferente deste e reprovaria. Dez, e não três,
 * pela razão de encaixe explicada em {@link ENCHIMENTO}.
 */
const COMODOS_DA_ORDEM: readonly string[] = [
  'Sala',
  'Quarto',
  'Cozinha',
  'Varanda',
  'Lavabo',
  'Escritório',
  'Despensa',
  'Closet',
  'Banheiro',
  'Adega',
];

/**
 * Texto de observação **grande**, e é o tamanho dele que faz o `CT-309` discriminar.
 *
 * ---------------------------------------------------------------------------
 * COMO A ORDEM FÍSICA É POSTA EM DESACORDO COM A DE POSIÇÃO
 * ---------------------------------------------------------------------------
 *
 * A posição é atribuída como `max(posicao) + 1`, de modo que ela é **monotônica com a ordem de
 * inserção** — e a ordem de inserção é, numa tabela recém-escrita, também a ordem física. As duas
 * coincidem por construção, e é por isso que a inserção embaralhada que o card propõe não é
 * representável (divergência 3 do cabeçalho): uma consulta **sem** `ORDER BY` devolveria a ordem
 * certa por acidente, e o caso não provaria nada.
 *
 * O que separa as duas é uma **alteração que não cabe na página onde a linha está**. Com dez linhas
 * de ~1,6 KB, o armazenamento ocupa mais de uma página, e a primeira delas fica cheia — por
 * definição: o servidor só passa para a página seguinte quando a linha corrente não cabe mais na
 * atual. Alterar o cômodo de posição 1 obriga o servidor a gravar a versão nova **adiante**, porque
 * o espaço livre na página dele é menor que a linha. Medido nesta base: o identificador físico da
 * linha vai de `(0,1)` para `(2,3)`, e ela passa a ser a última de uma varredura sequencial.
 *
 * Com poucas linhas pequenas isso **não** acontece: a página tem folga, a versão nova cabe nela, o
 * servidor a encadeia no mesmo lugar e a ordem de varredura não muda — foi o que a primeira redação
 * deste caso mediu, e é a razão do encaixe.
 *
 * O tamanho é folgadamente inferior ao teto de `observacoes` do contrato (2.000) e também ao limiar
 * a partir do qual o servidor tentaria comprimir a linha ou movê-la para fora dela — se comprimisse,
 * as linhas encolheriam, a página não encheria e o caso reprovaria **alto** na asserção de
 * diferença, em vez de passar sem prova.
 *
 * ---------------------------------------------------------------------------
 * E POR QUE O PLANO PRECISA SER LEVADO À VARREDURA SEQUENCIAL
 * ---------------------------------------------------------------------------
 *
 * Deslocar a linha **não basta**, e isto foi medido antes de virar código: deixado à vontade, o
 * planejador escolhe `comodo_empresa_imovel_posicao_idx` — `(empresa_id, imovel_id, posicao)` —, e o
 * percurso desse índice **já sai ordenado por posição**. Uma consulta sem `ORDER BY` devolveria a
 * ordem certa de graça, e o caso ficaria verde sobre um produto sem a cláusula.
 *
 * É exatamente o ponto que a decisão registra: *a ordem seria a do retorno do banco, que não é
 * garantida por cláusula nenhuma*. O que garante hoje é um índice que ninguém prometeu manter, e o
 * `ORDER BY` é o que torna a ordem propriedade da **consulta**. Por isso o caso desliga o percurso
 * por índice na própria transação (`SET LOCAL enable_indexscan/enable_bitmapscan = off`): é ajuste
 * do **plano**, não do produto — a consulta que corre é a mesma da operação —, e é ele que expõe a
 * diferença que o card manda afirmar.
 */
const ENCHIMENTO = 'a'.repeat(1_600);

/** O texto da alteração — do mesmo tamanho, e diferente, para que a linha nova não caiba. */
const OUTRO_ENCHIMENTO = 'b'.repeat(1_600);

/** `SQLSTATE` de violação de `NOT NULL` — o que o servidor devolve ao recusar a coluna nula. */
const VIOLACAO_DE_NAO_NULO = '23502';

/** `SQLSTATE` de violação de restrição de verificação — o `check(metragem >= 0)` do esquema. */
const VIOLACAO_DE_VERIFICACAO = '23514';

/** A restrição que recusa metragem negativa, pelo nome com que o servidor a reporta. */
const RESTRICAO_DA_METRAGEM = 'comodo_metragem_nao_negativa_chk';

/**
 * As colunas de `negocio.comodo`, por igualdade de conjunto — a asserção do `CT-317`.
 *
 * Escritas à mão, e **não** derivadas do esquema Drizzle: derivá-las faria a asserção concordar com
 * o mesmo lugar onde a coluna de retirada seria acrescentada. A ausência de `retirado_em` aqui é o
 * conteúdo do caso.
 */
const COLUNAS_DO_COMODO: readonly string[] = [
  'empresa_id',
  'id',
  'imovel_id',
  'metragem',
  'nome_comodo',
  'observacoes',
  'posicao',
];

/** A marca da exclusão lógica nas entidades que a têm — o controle positivo do `CT-317`. */
const COLUNA_DE_RETIRADA = 'retirado_em';

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let conjuntoId: string;

beforeAll(async () => {
  golden = JSON.parse(await readFile(CAMINHO_DO_GOLDEN, 'utf8')) as Golden;
  cenarios = Object.entries(golden.cenarios);

  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });

  conjuntoId = (await sobContextoDeA(async (tx) => await criarConjunto(tx, { nome: 'Metragem' })))
    .id;
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-305 — os quatro cenários do golden, contra a implementação nova
// ===========================================================================

describe('CT-305 — a metragem total derivada reproduz os quatro cenários do golden', () => {
  it(
    'devolve 0, 25.5, 67.75 e 58.5 como número, com os cômodos batendo na ordem de posição',
    async () => {
      // A âncora contra golden truncado, ANTES de qualquer asserção sobre valores: sem ela, um
      // arquivo com dois cenários deixaria o caso verde tendo provado metade.
      expect(cenarios).toHaveLength(CENARIOS_DO_GOLDEN);

      let exercitados = 0;

      for (const [nome, cenario] of cenarios) {
        const imovelId = await semearCenario(`CT-305 ${nome}`, cenario);
        const imovel = await ler(imovelId);

        // O valor exato do golden, e o TIPO. As duas asserções são independentes: `'58.5' == 58.5`
        // é verdadeiro em JavaScript com `toBe`? Não — `toBe` é `Object.is`, e o texto reprovaria.
        // A linha do `typeof` está aqui mesmo assim porque ela nomeia o defeito: `numeric` volta do
        // driver como texto, e o modo de falha é SILENCIOSO no JSON, onde `"58.50"` sai com aspas.
        expect(imovel?.metragemTotal, nome).toBe(cenario.valor_agregado);
        expect(typeof imovel?.metragemTotal, nome).toBe('number');

        // O vetor INTEIRO por igualdade profunda, na ordem — e não a soma sozinha. Sem ele, uma
        // implementação que somasse certo e embaralhasse, perdesse ou duplicasse cômodos passaria.
        expect(comparaveis(imovel), nome).toEqual(
          cenario.comodos_persistidos.map((comodo) => ({
            nomeComodo: comodo.nome_comodo,
            metragem: comodo.metragem ?? 0,
            posicao: comodo.idx ?? 0,
          })),
        );

        // A metragem de CADA cômodo também é número: o agregado poderia ser convertido num ponto e
        // o item não, e o cliente receberia `metragemTotal` certo com `comodos[i].metragem` em
        // texto. É a mesma falha silenciosa, um nível abaixo.
        for (const comodo of imovel?.comodos ?? []) {
          expect(typeof comodo.metragem, `${nome} · ${comodo.nomeComodo}`).toBe('number');
        }

        exercitados += 1;
      }

      // A segunda metade da âncora: o laço percorreu os quatro, e não saiu na primeira volta.
      expect(exercitados).toBe(CENARIOS_DO_GOLDEN);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-305 (b) — a soma é exata onde a soma direta em ponto flutuante NÃO é
// ===========================================================================

describe('CT-305 (b) — a soma em centésimos é exata para metragens que o binário não representa', () => {
  it('devolve 20.13 e 39.41 onde a soma direta deixa resíduo, e os pares são medidos, não supostos', () => {
    // --- O controle NEGATIVO, e ele vem PRIMEIRO ----------------------------------------------
    //
    // É esta linha que prova que os pares DISCRIMINAM. Sem ela, o caso poderia estar afirmando
    // valores que a soma ingênua acerta — e ficaria verde sobre o defeito. Não é hipótese: o par
    // `0.29 + 0.07`, que era o exemplo escrito no docblock de `somarMetragem`, **é exato** nesta
    // aritmética (`0.35999999999999998668`, que é o próprio dobro mais próximo de `0.36`), e um
    // caso construído sobre ele não mataria mutante nenhum. Os dois abaixo foram medidos.
    expect(10.06 + 10.07).not.toBe(20.13);
    expect(18.21 + 12.13 + 9.07).not.toBe(39.41);

    // --- E a soma do produto acerta os dois ----------------------------------------------------
    //
    // Valores exatos, e não aproximação com tolerância: `toBeCloseTo` deixaria passar exatamente o
    // resíduo que o desenho existe para eliminar, e é ele que viajaria no JSON de `metragemTotal`.
    expect(somarMetragem(comodosDeMetragem(10.06, 10.07))).toBe(20.13);
    expect(somarMetragem(comodosDeMetragem(18.21, 12.13, 9.07))).toBe(39.41);

    // O conjunto vazio é `0` — a RN-02 aplicada a nenhum cômodo, e o cenário `sem_comodo` do golden
    // visto na função pura.
    expect(somarMetragem(comodosDeMetragem())).toBe(0);
  });
});

// ===========================================================================
// CT-306 — a normalização acontece na ESCRITA, e a coluna guarda zero
// ===========================================================================

describe('CT-306 — cômodo sem metragem informada persiste 0.00 na coluna, nunca nulo', () => {
  it(
    'a coluna crua vale 0.00, o nulo explícito é recusado com 23502, e a soma continua 58.5',
    async () => {
      const cenario = golden.cenarios.varios_comodos_com_metragem_nula;
      expect(cenario, 'o cenário do golden com metragem não informada sumiu').toBeDefined();

      const imovelId = await semearCenario('CT-306', cenario as CenarioDoGolden);

      // --- Passo 1: a COLUNA, lida crua ---------------------------------------------------------
      //
      // É esta asserção que discrimina a decisão D2, e é por ela que este caso existe separado do
      // CT-305: uma implementação que normalizasse apenas na SOMA (tratando nulo como zero no
      // agregado) produziria os MESMOS 58.5 e passaria o CT-305 inteiro. `'0.00'` é o texto que
      // `numeric(10,2)` devolve — dois lugares decimais, o que prova de quebra a escala da coluna.
      const metragensCruas = await sobContextoDeA(
        async (tx) =>
          await tx<{ nomeComodo: string; metragem: string | null }[]>`
            SELECT nome_comodo AS "nomeComodo", metragem
              FROM negocio.comodo
             WHERE imovel_id = ${imovelId}
             ORDER BY posicao
          `,
      );

      expect(metragensCruas.map((linha) => [linha.nomeComodo, linha.metragem])).toEqual([
        ['Sala', '40.00'],
        ['Deposito', '0.00'],
        ['Quarto', '18.50'],
      ]);

      // --- Passo 2: o nulo EXPLÍCITO é recusado pelo servidor ------------------------------------
      //
      // A escrita corre em unidade PRÓPRIA porque a violação aborta a transação: emiti-la junto das
      // leituras acima derrubaria as seguintes com `25P02`, e o caso reprovaria pelo motivo errado.
      // A empresa entra pela MESMA expressão que as políticas avaliam — nenhuma comparação de
      // `empresa_id` é escrita aqui.
      const recusa = await sobContextoDeA(
        async (tx) =>
          await tx`
            INSERT INTO negocio.comodo (empresa_id, imovel_id, nome_comodo, metragem, posicao)
            VALUES (
              nullif(current_setting('app.empresa_id', true), '')::uuid,
              ${imovelId}, 'Nulo Explícito', NULL, 99
            )
          `,
      ).then(
        () => undefined,
        (erro: unknown) => erro as { code?: unknown; column_name?: unknown },
      );

      expect(recusa?.code).toBe(VIOLACAO_DE_NAO_NULO);
      // A coluna NOMEADA, e não só o código: um `NOT NULL` de outra coluna produziria o mesmo
      // `23502` e faria a asserção passar provando outra coisa.
      expect(recusa?.column_name).toBe('metragem');

      // --- Passo 3: a soma continua a do golden -------------------------------------------------
      //
      // O eixo POSITIVO: sem ele, "a coluna vale 0.00" ficaria verde sobre uma implementação que
      // gravasse zero e depois somasse errado.
      const imovel = await ler(imovelId);
      expect(imovel?.metragemTotal).toBe(cenario?.valor_agregado);
      expect(imovel?.metragemTotal).toBe(58.5);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-307 — a soma tem um ponto único de avaliação
// ===========================================================================

describe('CT-307 — item, listagem e porta de circulação devolvem a MESMA metragem', () => {
  it(
    'os três mapas são profundamente iguais entre si e iguais aos valores do golden',
    async () => {
      const esperado: Record<string, number> = {};

      for (const [nome, cenario] of cenarios) {
        esperado[await semearCenario(`CT-307 ${nome}`, cenario)] = cenario.valor_agregado;
      }

      const daCaso = Object.keys(esperado);
      expect(daCaso).toHaveLength(CENARIOS_DO_GOLDEN);

      // As TRÊS leituras correm na MESMA unidade de trabalho, para que a comparação não sofra de
      // retratos diferentes: uma divergência aqui é da soma, e não do instante em que cada consulta
      // rodou.
      const { porItem, porListagem, porCirculacao } = await sobContextoDeA(async (tx) => {
        const item: Record<string, number> = {};
        for (const id of daCaso) {
          item[id] = (await localizarImovel(tx, id))?.metragemTotal ?? Number.NaN;
        }

        // A listagem alcança todos os imóveis da empresa A — inclusive os dos demais casos deste
        // arquivo. O recorte aos quatro do caso é feito AQUI, e não por um filtro na consulta: o
        // que está sob prova é a soma que a listagem devolve, e não o recorte dela.
        const pagina = await listarImoveis(tx, JANELA_LARGA);
        const listagem: Record<string, number> = {};
        for (const imovel of pagina.imoveis) {
          if (imovel.id in esperado) {
            listagem[imovel.id] = imovel.metragemTotal;
          }
        }

        // O terceiro caminho: a porta de circulação tem `RETURNING` próprio e monta o agregado por
        // conta. Recircular um imóvel que já circula é operação sem efeito — `retirado_em` já é
        // nulo —, e é justamente por isso que ela serve de leitura aqui.
        const circulacao: Record<string, number> = {};
        for (const id of daCaso) {
          circulacao[id] =
            (await definirCirculacaoDoImovel(tx, id, true))?.metragemTotal ?? Number.NaN;
        }

        return { porItem: item, porListagem: listagem, porCirculacao: circulacao };
      });

      // A âncora de não-vacuidade: sem ela, uma listagem que não alcançasse os imóveis do caso
      // faria os dois mapas vazios serem "profundamente iguais".
      expect(Object.keys(porListagem)).toHaveLength(CENARIOS_DO_GOLDEN);

      // Os três comparados dois a dois, e os três contra o golden. Divergência em qualquer par
      // reprova nomeando as duas leituras que discordam.
      expect(porItem, 'a leitura do item divergiu da listagem').toEqual(porListagem);
      expect(porItem, 'a leitura do item divergiu da porta de circulação').toEqual(porCirculacao);
      expect(porItem, 'a leitura do item divergiu do golden').toEqual(esperado);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-309 — a ordem é da posição, e não a do retorno do banco
// ===========================================================================

describe('CT-309 — os cômodos vêm ordenados por posição, e não na ordem física do banco', () => {
  it(
    'o vetor devolvido é o da posição, e difere do que o servidor entrega sem ORDER BY',
    async () => {
      const imovelId = await criarImovelDoCaso('CT-309');

      for (const nome of COMODOS_DA_ORDEM) {
        await acrescentar(imovelId, { nomeComodo: nome, metragem: 1, observacoes: ENCHIMENTO });
      }

      // A alteração do PRIMEIRO cômodo é o que separa a ordem de posição da ordem FÍSICA. Ver a
      // seção "COMO A ORDEM FÍSICA É POSTA EM DESACORDO" no cabeçalho: a página do primeiro está
      // cheia, de modo que a versão nova da linha **não cabe** nela e o servidor a grava adiante —
      // e a partir daqui uma consulta sem `ORDER BY` devolve o primeiro cômodo por ÚLTIMO.
      const primeiro = (await ler(imovelId))?.comodos[0];
      expect(primeiro?.nomeComodo).toBe(COMODOS_DA_ORDEM[0]);
      await sobContextoDeA(
        async (tx) =>
          await alterarComodo(tx, imovelId, primeiro?.id ?? '', {
            nomeComodo: primeiro?.nomeComodo ?? '',
            metragem: 1,
            observacoes: OUTRO_ENCHIMENTO,
          }),
      );

      // --- As duas leituras, na MESMA transação, sob o MESMO plano e em conexão PRÓPRIA ----------
      //
      // Duas decisões, as duas medidas contra o mutante MT7-3 (ver o cabeçalho):
      //
      //   * **o planejador é levado à varredura sequencial.** Deixado à vontade, ele escolhe
      //     `comodo_empresa_imovel_posicao_idx`, cujo percurso **já sai ordenado por posição** — e aí
      //     uma consulta sem `ORDER BY` devolveria a ordem certa sem que a cláusula existisse;
      //   * **a conexão é nova**, e não a compartilhada do arquivo. O driver prepara cada consulta na
      //     conexão, e o servidor passa a reusar um plano genérico depois das primeiras execuções —
      //     de modo que, numa conexão que já leu imóvel dezenas de vezes nos casos anteriores, o
      //     `SET LOCAL` chega tarde e não muda plano nenhum. Numa conexão nova a consulta é planejada
      //     do zero, já sob o ajuste. **Sem esta metade o caso ficava verde sobre o mutante** — foi
      //     medido antes de virar código.
      //
      // Os dois ajustes são do PLANO, e não do produto: a consulta que corre é a mesma que a operação
      // emite, e nada foi acrescentado a `packages/db/src/**` para que a prova exista.
      const medicao = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      let imovel: ImovelPersistido | undefined;
      let nomesFisicos: string[];

      try {
        const lido = await contextoDeTenant.executarCom(
          CONTEXTO_DE_A,
          async () =>
            await medicao.emUnidadeDeTrabalho(async (tx) => {
              await tx`SET LOCAL enable_indexscan = off`;
              await tx`SET LOCAL enable_bitmapscan = off`;

              const doPorto = await localizarImovel(tx, imovelId);
              const semOrdenacao = await tx<{ nomeComodo: string }[]>`
                SELECT nome_comodo AS "nomeComodo"
                  FROM negocio.comodo
                 WHERE imovel_id = ANY(${[imovelId]}::uuid[])
              `;

              return { doPorto, fisicos: semOrdenacao.map((linha) => linha.nomeComodo) };
            }),
        );

        imovel = lido.doPorto;
        nomesFisicos = lido.fisicos;
      } finally {
        await medicao.encerrar();
      }

      // Igualdade exata do vetor inteiro, nome a nome e posição a posição. Os nomes estão em ordem
      // **anti-alfabética** de propósito: um `ORDER BY nome_comodo` — a troca mais provável — sai
      // diferente daqui, e um `ORDER BY id` sai numa ordem de UUID que também não é esta.
      const nomesDevolvidos = imovel?.comodos.map((comodo) => comodo.nomeComodo) ?? [];
      expect(nomesDevolvidos).toEqual([...COMODOS_DA_ORDEM]);
      expect(imovel?.comodos.map((comodo) => comodo.posicao)).toEqual(
        COMODOS_DA_ORDEM.map((_, indice) => indice + 1),
      );

      // A asserção de DIFERENÇA, que é o que o card exige: a MESMA consulta, sem a cláusula de
      // ordenação, devolve outra coisa. Sem esta linha, remover o `ORDER BY` do produto passaria por
      // coincidência — e passava mesmo, medido: com o índice à disposição, o percurso dele entrega a
      // ordem de posição de graça.
      expect(nomesFisicos).not.toEqual(nomesDevolvidos);

      // E a consequência CONCRETA da construção, afirmada para que o caso reprove **alto** no dia em
      // que ela deixar de discriminar, em vez de ficar verde sem prova nenhuma: o cômodo de posição
      // 1 é o ÚLTIMO que o servidor entrega sem ordenação, porque a alteração o gravou adiante.
      expect(nomesFisicos).toHaveLength(COMODOS_DA_ORDEM.length);
      expect(nomesFisicos.at(-1)).toBe(COMODOS_DA_ORDEM[0]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-317 — o cômodo é removido de fato: a exceção declarada da ADR-0014
// ===========================================================================

describe('CT-317 — cômodo não tem marca de retirada, e a remoção apaga a linha', () => {
  it(
    'o catálogo não tem coluna de retirada, a contagem cai de 3 para 2 e as posições viram 1 e 3',
    async () => {
      // --- Passo 1: o catálogo ------------------------------------------------------------------
      //
      // A asserção sobre a AUSÊNCIA da coluna é o que impede uma implementação bem-intencionada de
      // dar `retirado_em` ao cômodo "por simetria" com as demais entidades — o que criaria uma
      // segunda semântica de remoção sem que nada acusasse. Igualdade de conjunto, e não
      // `not.toContain`: uma coluna a mais com outro nome também é revisão devida.
      const doComodo = await colunasDe('comodo');
      expect(doComodo).toEqual([...COLUNAS_DO_COMODO]);
      expect(doComodo).not.toContain(COLUNA_DE_RETIRADA);

      // O controle POSITIVO, sem o qual "não tem a coluna" ficaria verde sobre uma consulta ao
      // catálogo que não achasse nada — inclusive uma com o nome da marca escrito errado.
      expect(await colunasDe('imovel')).toContain(COLUNA_DE_RETIRADA);

      // --- Passo 2: o estado antes --------------------------------------------------------------
      const imovelId = await criarImovelDoCaso('CT-317');
      await acrescentar(imovelId, SALA);
      const quarto = await acrescentar(imovelId, QUARTO);
      await acrescentar(imovelId, COZINHA);

      const antes = await ler(imovelId);
      expect(antes?.comodos).toHaveLength(3);
      expect(antes?.metragemTotal).toBe(67.75);
      expect(await contarComodos(imovelId)).toBe(3);

      // --- Passo 3: remover o do MEIO -----------------------------------------------------------
      const removido = await sobContextoDeA(
        async (tx) => await removerComodo(tx, imovelId, quarto?.id ?? ''),
      );
      expect(removido?.nomeComodo).toBe('Quarto');

      // --- Passo 4: a linha SUMIU, e não foi marcada --------------------------------------------
      //
      // A contagem crua é o que separa "some da leitura" de "some do banco": uma marca de retirada
      // faria a leitura devolver dois cômodos com a linha ainda lá.
      expect(await contarComodos(imovelId)).toBe(2);
      expect(await existeComodo(quarto?.id ?? '')).toBe(false);

      const depois = await ler(imovelId);
      expect(depois?.metragemTotal).toBe(37.5);

      // --- Passo 5: as posições remanescentes NÃO foram reescritas ------------------------------
      //
      // `1` e `3`, e não `1` e `2`: a posição é monotônica, não densa, e a decisão está escrita na
      // §6.2 da tech spec. O caso afirma a decisão registrada — não a descobre.
      expect(comparaveis(depois)).toEqual([
        { nomeComodo: 'Sala', metragem: 25.5, posicao: 1 },
        { nomeComodo: 'Cozinha', metragem: 12, posicao: 3 },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-325 — a composição grava num commit só, com a unidade aberta na borda
// ===========================================================================

describe('CT-325 — imóvel e cômodos são atômicos, e o aninhamento continua recusado', () => {
  it(
    'a composição íntegra grava tudo, a que falha não deixa nada, e a unidade aninhada rejeita',
    async () => {
      const inicial = await contagensDoNegocio();

      // --- Passo 1: a composição ÍNTEGRA, numa unidade só ---------------------------------------
      //
      // Dois serviços de domínio novos — o do imóvel e o do cômodo — chamados em sequência DENTRO
      // da mesma unidade, que é a decisão D1 (unidade aberta na borda). Nenhum erro é levantado, e
      // é isso que prova que a composição não precisa de aninhamento.
      const integro = await sobContextoDeA(async (tx) => {
        const imovel = await criarImovel(tx, dadosDoImovel('CT-325 íntegro'));
        for (const comodo of [SALA, QUARTO, COZINHA]) {
          await acrescentarComodo(tx, imovel.id, entradaDeComodo(comodo));
        }
        return imovel.id;
      });

      const depoisDoIntegro = await contagensDoNegocio();
      expect(depoisDoIntegro.imoveis).toBe(inicial.imoveis + 1);
      expect(depoisDoIntegro.comodos).toBe(inicial.comodos + 3);
      expect((await ler(integro))?.metragemTotal).toBe(67.75);

      // --- Passo 2: a composição que ABORTA no terceiro cômodo ----------------------------------
      //
      // A falha vem do DADO, e não de uma bandeira: o terceiro cômodo viola
      // `check(metragem >= 0)`, que é restrição real do esquema. Nenhum gancho, contador ou ramo
      // condicional foi acrescentado a `packages/db/src/**` nem aos serviços para que esta prova
      // exista (Iron Law #6). A entrada negativa não vem do contrato — ela é irrepresentável lá,
      // e é justamente por isso que a prova mora nesta camada (tech_spec §7.4).
      const abortada = await sobContextoDeA(async (tx) => {
        const imovel = await criarImovel(tx, dadosDoImovel('CT-325 abortado'));
        await acrescentarComodo(tx, imovel.id, entradaDeComodo(SALA));
        await acrescentarComodo(tx, imovel.id, entradaDeComodo(QUARTO));
        await acrescentarComodo(tx, imovel.id, {
          nomeComodo: 'Metragem impossível',
          metragem: -1,
          observacoes: null,
        });
        return imovel.id;
      }).then(
        () => undefined,
        (erro: unknown) => erro as { code?: unknown; constraint_name?: unknown },
      );

      // A recusa é a NOMEADA, e não "algum erro": outra restrição produziria outro `SQLSTATE`, e a
      // asserção genérica deixaria o caso verde tendo abortado por motivo diferente do que ele diz.
      expect(abortada?.code).toBe(VIOLACAO_DE_VERIFICACAO);
      expect(abortada?.constraint_name).toBe(RESTRICAO_DA_METRAGEM);

      // --- Passo 3: NADA da tentativa sobreviveu ------------------------------------------------
      //
      // Nem o imóvel, nem os DOIS cômodos que já haviam sido gravados antes do terceiro. As
      // contagens voltam ao valor de antes da tentativa — que é o de depois da composição íntegra,
      // e não o inicial: comparar com o inicial esconderia a íntegra tendo desfeito junto.
      expect(await contagensDoNegocio()).toEqual(depoisDoIntegro);

      // --- Passo 4: o aninhamento CONTINUA recusado ---------------------------------------------
      //
      // A saída escolhida pela D1 é "unidade na borda", e NÃO "relaxar a recusa de aninhamento". O
      // marcador `DECISÃO FECHADA` de `src/unidade-de-trabalho.ts` é intocável, e esta é a linha
      // que prova que a composição acima não o afrouxou para caber.
      const aninhada = await sobContextoDeA(
        async () => await acesso.emUnidadeDeTrabalho(async () => 'não deveria chegar aqui'),
      ).then(
        () => undefined,
        (erro: unknown) => erro,
      );

      expect(aninhada).toBeInstanceOf(ErroDeUnidadeAninhada);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — todo acesso pela API pública do pacote, sob o contexto de A
// ---------------------------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto da empresa A, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function sobContextoDeA<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    CONTEXTO_DE_A,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * Contador de identificadores municipais deste arquivo.
 *
 * A unicidade é por empresa e **alcança os retirados**, de modo que um valor reaproveitado entre
 * dois casos faria o segundo depender da ordem de execução do primeiro (AP-08). O contador dá um
 * valor exclusivo a cada imóvel criado, sem que os casos precisem coordenar literais entre si.
 */
let sequenciaDoIdentificador = 0;

/** O corpo completo de um imóvel do arquivo, com identificador municipal exclusivo. */
function dadosDoImovel(nomeImovel: string): DadosDoImovel {
  sequenciaDoIdentificador += 1;

  return {
    conjuntoId,
    nomeImovel,
    identificadorMunicipal: `MET-${String(sequenciaDoIdentificador).padStart(4, '0')}`,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: null,
  };
}

/** Cria um imóvel do caso pela porta de escrita e devolve o identificador dele. */
async function criarImovelDoCaso(nomeImovel: string): Promise<string> {
  return (await sobContextoDeA(async (tx) => await criarImovel(tx, dadosDoImovel(nomeImovel)))).id;
}

/**
 * Monta a entrada de um cômodo **pelo esquema do contrato** — o caminho real do produto.
 *
 * `metragem` ausente é o que a RN-02 normaliza para zero, e é `esquemaDeComodoNovo` quem o faz na
 * borda. Montar um literal aqui pularia essa normalização e faria o `CT-306` provar outra coisa.
 */
function entradaDeComodo(comodo: EntradaDoCaso) {
  return esquemaDeComodoNovo.parse({
    nomeComodo: comodo.nomeComodo,
    ...(comodo.metragem === undefined ? {} : { metragem: comodo.metragem }),
    ...(comodo.observacoes === undefined ? {} : { observacoes: comodo.observacoes }),
  });
}

/** O que um caso informa ao acrescentar um cômodo — os campos omitidos são os que a RN-02 preenche. */
interface EntradaDoCaso {
  readonly nomeComodo: string;
  readonly metragem?: number | undefined;
  readonly observacoes?: string | undefined;
}

/** Acrescenta um cômodo pela porta de escrita, sob o contexto de A. */
async function acrescentar(
  imovelId: string,
  comodo: EntradaDoCaso,
): Promise<ComodoPersistido | undefined> {
  return await sobContextoDeA(
    async (tx) => await acrescentarComodo(tx, imovelId, entradaDeComodo(comodo)),
  );
}

/**
 * Cria o imóvel de um cenário do golden e acrescenta os cômodos de `comodos_entrada`, na ordem.
 *
 * `metragem: null` no golden significa **não informado** na captura do legado, e a entrada
 * equivalente no produto novo é a **ausência do campo** — ver a divergência 4 no cabeçalho.
 */
async function semearCenario(rotulo: string, cenario: CenarioDoGolden): Promise<string> {
  const imovelId = await criarImovelDoCaso(rotulo);

  for (const comodo of cenario.comodos_entrada) {
    await acrescentar(imovelId, {
      nomeComodo: comodo.nome_comodo,
      ...(comodo.metragem === null ? {} : { metragem: comodo.metragem }),
    });
  }

  return imovelId;
}

/** A leitura por identificador — a porta única do item. */
async function ler(imovelId: string): Promise<ImovelPersistido | undefined> {
  return await sobContextoDeA(async (tx) => await localizarImovel(tx, imovelId));
}

/**
 * Cômodos na forma publicada, com as metragens informadas — a entrada do `CT-305 (b)`.
 *
 * A soma é uma função **pura** e exportada: ela não toca o banco, e prová-la aqui não exige imóvel
 * nem transação. Os campos que ela não lê (`id`, `nomeComodo`, `posicao`, `observacoes`) existem
 * porque o tipo publicado os exige, e são constantes de propósito — variá-los sugeriria que a soma
 * depende deles.
 */
function comodosDeMetragem(...metragens: readonly number[]): ComodoPersistido[] {
  return metragens.map((metragem, indice) => ({
    id: `00000000-0000-4000-8000-00000000000${String(indice)}`,
    nomeComodo: `Cômodo ${String(indice + 1)}`,
    metragem,
    posicao: indice + 1,
    observacoes: null,
  }));
}

/** Os cômodos do imóvel na forma que os casos comparam — sem o identificador gerado. */
function comparaveis(imovel: ImovelPersistido | undefined): ComodoComparavel[] {
  return (imovel?.comodos ?? []).map((comodo) => ({
    nomeComodo: comodo.nomeComodo,
    metragem: comodo.metragem,
    posicao: comodo.posicao,
  }));
}

/** As colunas de uma tabela de `negocio`, pelo catálogo do sistema, em ordem alfabética. */
async function colunasDe(tabela: string): Promise<string[]> {
  const linhas = await sobContextoDeA(
    async (tx) =>
      await tx<{ coluna: string }[]>`
        SELECT column_name AS coluna
          FROM information_schema.columns
         WHERE table_schema = 'negocio'
           AND table_name = ${tabela}
         ORDER BY column_name
      `,
  );

  return linhas.map((linha) => linha.coluna);
}

/** Quantas linhas de `negocio.comodo` o imóvel tem — contagem crua, sem recorte nenhum. */
async function contarComodos(imovelId: string): Promise<number> {
  const [linha] = await sobContextoDeA(
    async (tx) =>
      await tx<{ total: string }[]>`
        SELECT count(*) AS total FROM negocio.comodo WHERE imovel_id = ${imovelId}
      `,
  );

  return Number(linha?.total ?? 0);
}

/** Se a linha do cômodo ainda existe — a asserção que separa "some da leitura" de "some do banco". */
async function existeComodo(comodoId: string): Promise<boolean> {
  const [linha] = await sobContextoDeA(
    async (tx) =>
      await tx<{ total: string }[]>`
        SELECT count(*) AS total FROM negocio.comodo WHERE id = ${comodoId}
      `,
  );

  return Number(linha?.total ?? 0) > 0;
}

/**
 * As contagens cruas das duas tabelas que a composição toca, lidas na **mesma** unidade.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e as duas saem
 * do mesmo retrato para que a comparação do `CT-325` não sofra de instantes diferentes.
 */
async function contagensDoNegocio(): Promise<{ imoveis: number; comodos: number }> {
  return await sobContextoDeA(async (tx) => {
    const [linha] = await tx<{ imoveis: string; comodos: string }[]>`
      SELECT (SELECT count(*) FROM negocio.imovel) AS imoveis,
             (SELECT count(*) FROM negocio.comodo) AS comodos
    `;

    return { imoveis: Number(linha?.imoveis ?? 0), comodos: Number(linha?.comodos ?? 0) };
  });
}
