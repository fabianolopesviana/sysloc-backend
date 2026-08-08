/**
 * A janela de listagem e o custo da carteira — CT-330 e CT-329 (d). T10 da fatia
 * `cadastro-de-imoveis-e-pessoas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-15    | CT-330 | `listarConjuntos` devolve o `total` do conjunto inteiro e a página pedida
 * |          |        | lidos na MESMA transação: sobre cinco registros **homônimos** paginados de
 * |          |        | dois em dois, cada uma das três páginas afirma `total === 5`, os tamanhos
 * |          |        | são `2, 2, 1`, e a união dos identificadores é **exatamente** o conjunto
 * |          |        | dos cinco, sem repetição e sem omissão. |
 * | CA-15    | CT-330 | E a ordem é a do **desempate por identificador**: a concatenação das três
 * |          | (b)    | páginas, na ordem em que foram lidas, é a lista dos cinco identificadores
 * |          |        | em ordem crescente. |
 * | CA-15    | CT-329 | O número de invocações do executor que `lerCarteira` emite **não depende**
 * |          | (d)    | do número de conjuntos nem do de imóveis: dois cenários de tamanhos
 * |          |        | diferentes produzem a MESMA contagem, e ela é o valor exato declarado. |
 *
 * Rastreabilidade: `CA-15 → CT-330 (RN-13)`, `CA-15 → CT-330 (b) (RN-13)`,
 * `CA-15 → CT-329 (d) (RN-13)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T10 — leia antes de comparar com a §5.1
 * ===========================================================================
 *
 * 1. **A §5.1 declara este arquivo como "suíte da paginação", e ele hospeda também o `CT-329 (d)`.**
 *    O `CT-329 (d)` não existe na §6.6: ele nasceu do item 4 do **aceite técnico** da task
 *    (*"número de consultas independente do número de conjuntos e imóveis"*), que a §6.5 não atribui
 *    a caso algum — o `CT-329` prova a **corretude** da árvore, e uma implementação N+1 devolve a
 *    árvore certa. Sem ele, aquele item ficaria sem prova nenhuma.
 *
 *    Ele mora **aqui**, e não num terceiro arquivo, por uma razão medida: cada suíte de
 *    `packages/db/test/` sobe uma instância própria de PostgreSQL, e um arquivo a mais custaria uma
 *    subida inteira para uma invariante que compartilha com o `CT-330` a mesma montagem e o mesmo
 *    contexto. A forma segue a que esta base já usa para sub-caso com letra (`CT-310 (b)`,
 *    `CT-333 (b)`, `CT-305 (b)`).
 *
 *    **A letra é `(d)`, e não `(b)`**: a sequência de sub-casos de um `CT` é **única no
 *    repositório**, e não por arquivo. As letras `(b)` e `(c)` já são da suíte
 *    `apps/api/test/carteira.e2e.spec.ts` — os retirados marcados e a recusa da cadeia de consulta —,
 *    de modo que reusar `(b)` aqui daria a dois casos de **critérios e regras distintos**
 *    (`CA-11 → RN-05` lá, `CA-15 → RN-13` aqui) o mesmo identificador. O mapa `CA → CT` da fatia é
 *    consumido pela task de fechamento como dado, e identificador ambíguo entra nela como ambiguidade.
 * 2. **Os dois casos correm em empresas diferentes** — o `CT-330` na A, o `CT-329 (d)` na B. Não é
 *    ornamento: o `CT-330` afirma `total === 5`, que é a contagem da empresa inteira, e um conjunto
 *    criado pelo outro caso a quebraria. O recorte é o **real** (a política de `negocio.conjunto`),
 *    e não uma cláusula escrita aqui — é o mesmo mecanismo que separa as duas sessões da operação.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-330 — os HOMÔNIMOS são o que discrimina.** Com nomes distintos, qualquer ordenação estável
 * passa, e a ausência de desempate por identificador só apareceria em produção. A lição está escrita
 * por extenso no docblock de `listarPessoasDaEmpresa` e repetida no de `listarConjuntos`: *"`nome`
 * sozinho empata entre homônimos, e um empate faz a mesma linha aparecer em duas páginas — ou em
 * nenhuma"*. Os cinco registros deste caso têm o **mesmo nome**, de modo que `nome` não decide nada e
 * quem ordena é, necessariamente, o desempate.
 *
 * **CT-330 (b) — a ordem crescente de identificador é a asserção LITERAL do desempate.** A união dos
 * identificadores, sozinha, é uma asserção de conjunto: ela pega a repetição e a omissão, e é o que o
 * card pede. Ela **não** pega uma ordenação que, por acaso da varredura física, não repita nem omita
 * — e é justamente esse acaso que uma consulta sem desempate produz num cenário pequeno. Afirmar a
 * ordem concreta que `ORDER BY nome, id` produz fecha essa saída: a comparação textual do UUID
 * canônico é equivalente à comparação binária que o servidor faz (os dígitos hexadecimais preservam
 * a ordem e os hifens ocupam posições fixas), e a probabilidade de uma ordenação arbitrária de cinco
 * elementos coincidir com a crescente é de uma em cento e vinte.
 *
 * **CT-329 (d) — a contagem é do EXECUTOR, e a instrumentação não toca a produção.** `lerCarteira`
 * **recebe** o executor de quem abriu a unidade de trabalho — é a fronteira real da função —, e o
 * caso passa um `Proxy` que conta as invocações e delega ao executor verdadeiro. Nenhum símbolo
 * nasce em `packages/db/src/**` para que a prova exista (Iron Law #6), nenhuma opção de depuração do
 * driver é ligada e nenhuma extensão do servidor é exigida.
 *
 * **O que a contagem mede, literalmente**: toda invocação do executor, o que inclui as **seis** que
 * constroem **fragmento** — a projeção de colunas das **três** tabelas (`colunasDoConjunto`,
 * `colunasDoImovel` e `colunasDoComodo`) e o predicado de circulação nas **três** vezes em que ele
 * entra (a página de conjuntos, o total de conjuntos e a consulta de imóveis; a de cômodos não o
 * aplica, porque a ADR-0014 põe **detalhe de composição** fora do alcance da retirada de circulação
 * — parte que não tem vida própria e cujo ciclo de vida é o do agregado que a contém — e nomeia o
 * cômodo de um imóvel como o caso conhecido) — além das **quatro** que emitem consulta. Seis mais quatro é a decomposição das dez, e é a
 * mesma que o docblock de `INVOCACOES_DA_CARTEIRA` enumera adiante, dividida por nível em vez de por
 * espécie. O número é, portanto, um teto do número de idas ao banco — e é exatamente a grandeza que
 * o aceite pede, porque a invariante afirmada é *"não depende de N"*, não *"vale k"*. Ele é mais
 * severo do que contar só as consultas: um laço que construísse fragmento por item também cresceria
 * com N, e também reprovaria aqui.
 *
 * **Os DOIS cenários são o que discrimina, e a diferença de tamanho é o ponto.** Com um conjunto só,
 * a implementação por nível e a N+1 emitem o mesmo número de consultas, e uma contagem sobre um
 * cenário único não separaria as duas. Os cenários deste caso diferem no número de conjuntos **e** no
 * de imóveis, e a asserção é a **igualdade entre eles** — a âncora de valor exato vem junto para que
 * "as duas contagens são iguais" não passe sobre uma medição que não observou nada.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os dois reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca
 * por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `10 arquivos, 62 casos, 0 falhas`;
 *   * **MT10-1 · a carteira vira N+1** (`lerCarteira` chamando `lerImoveisDeConjuntos` **por
 *     conjunto**, num laço sobre a página, em vez de uma vez para a página inteira — a árvore
 *     devolvida continua **idêntica**): `1 failed | 61 passed`, no **CT-329 (d)** —
 *     `expected 30 to be 15`. Os dois números medem o mutante, e não o SUT: com o laço, o cenário
 *     pequeno custa `5 + 2 × 5 = 15` invocações e o grande custa `5 + 5 × 5 = 30` — é a dependência
 *     de N aparecendo. É a medida literal de que o `CT-329` prova a corretude e não o custo: aquele
 *     caso, pela rota, atravessa este mutante inteiro sem uma falha sequer;
 *   * **MT10-2 · a ordenação perde o desempate** (`ORDER BY nome` no lugar de `ORDER BY nome, id`
 *     na consulta de página de `listarConjuntos` — o total não ordena): `1 failed | 61 passed`, no
 *     **CT-330 (b)** —
 *     `AssertionError: expected [ …(5) ] to deeply equal [ …(5) ]`: a concatenação das três páginas
 *     deixa de ser a lista crescente de identificadores. O
 *     `CT-330` **atravessa o mutante verde** nesta medição, e é por isso que a metade (b) existe:
 *     com cinco linhas e nenhuma escrita concorrente, a ordenação sem desempate não chega a repetir
 *     nem a omitir — o defeito só apareceria em produção, que é exatamente o que o docblock da porta
 *     adverte;
 *   * **reversão** — os fontes foram restaurados e conferidos idênticos ao original por `diff`, e o
 *     controle voltou a `62 passed`.
 *
 * ===========================================================================
 * ISOLAMENTO DE ORDEM — cada caso passa sozinho (Gate 1, rodada 2)
 * ===========================================================================
 *
 * O `CT-330 (b)` lia o cenário que o `it` do `CT-330` gravava **dentro do próprio corpo**, e por isso
 * só passava se o caso anterior tivesse corrido antes: rodado sozinho, ele reprovava com
 * `expected [] to have a length of 5`. A rede do desempate — que é a **única** prova do
 * `MT10-2`, já que o `CT-330` atravessa aquele mutante verde — ficava pendurada numa ordem de
 * execução que nada declarava nem verificava (AP-08).
 *
 * O arranjo passou para o **`beforeAll` do `describe` do `CT-330`**, onde é propriedade da suíte e
 * corre antes de qualquer caso que ela contenha. Nenhuma asserção foi tocada.
 *
 * **Medido depois da correção**, caso a caso, com o filtro por nome (`-t`) sobre este arquivo:
 *
 *   * `CT-330` isolado — `1 passed | 2 skipped`;
 *   * `CT-330 (b)` isolado — `1 passed | 2 skipped`;
 *   * `CT-329 (d)` isolado — `1 passed | 2 skipped`;
 *   * **`MT10-2` reconfirmado** sobre o arranjo novo: `1 failed | 61 passed`, no **CT-330 (b)** —
 *     a concatenação das três páginas deixa de ser a lista crescente de identificadores.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * `negocio.conjunto`, `negocio.imovel` e `negocio.comodo` nascem sob RLS **forçada**: ler e escrever
 * nelas exige contexto de tenant fixado. O contexto vem **exclusivamente** da API pública do pacote —
 * `contextoDeTenant.executarCom` mais `abrirAcessoAoBanco` —, que é o mesmo caminho da operação.
 * Nenhuma conexão privilegiada é aberta neste arquivo, e nenhuma cláusula compara `empresa_id`
 * (ADR-0006, ADR-0008). Toda linha é gravada pelas portas de escrita do pacote, nunca por `INSERT`
 * escrito aqui.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acrescentarComodo } from '../src/comodo.ts';
import { criarConjunto, lerCarteira, listarConjuntos } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { criarImovel } from '../src/imovel.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Os casos escrevem algumas dezenas de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho dos casos correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário do CT-330 — cinco homônimos na empresa A
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * O nome que os cinco compartilham.
 *
 * Ele é **o mesmo** nos cinco de propósito: é o empate que torna o desempate observável. Com nomes
 * distintos, qualquer ordenação estável passaria e o caso não provaria nada sobre `ORDER BY`.
 */
const NOME_HOMONIMO = 'Residencial Homônimo';

/** Quantos homônimos o caso cria — o `total` que cada página tem de afirmar. */
const QUANTIDADE_DE_HOMONIMOS = 5;

/** A janela do caso: páginas de dois em dois. */
const LIMITE_DA_PAGINA = 2;

/** Os três deslocamentos que percorrem os cinco registros sem sobra. */
const DESLOCAMENTOS = [0, 2, 4] as const;

/** Os tamanhos esperados das três páginas — a última é a parcial. */
const TAMANHOS_ESPERADOS = [2, 2, 1] as const;

/** Ler **só** o que circula: nenhum registro deste arquivo é retirado, e o padrão é o da operação. */
const SO_EM_CIRCULACAO = { incluirRetirados: false } as const;

// ---------------------------------------------------------------------------
// O cenário do CT-329 (d) — dois tamanhos de carteira na empresa B
// ---------------------------------------------------------------------------

/**
 * Quantas invocações do executor `lerCarteira` emite, qualquer que seja o tamanho da carteira.
 *
 * Duas pela página de conjuntos (a projeção de colunas, o predicado) mais a consulta, duas pelo total
 * (o predicado e a consulta), três pelos imóveis (a projeção, o predicado e a consulta) e duas pelos
 * cômodos (a projeção e a consulta) — **dez**. O valor exato é a âncora de não-vacuidade: sem ele,
 * *"as duas contagens são iguais"* passaria sobre uma medição que não observou invocação alguma.
 */
const INVOCACOES_DA_CARTEIRA = 10;

/** A janela dos dois cenários do custo: larga o bastante para conter os dois inteiros. */
const JANELA_LARGA = { limite: 50, deslocamento: 0 } as const;

/** O primeiro cenário: dois conjuntos, com um e dois imóveis. */
const CARTEIRA_PEQUENA = [1, 2] as const;

/** O segundo cenário: três conjuntos a mais, com três, dois e um imóveis. */
const CARTEIRA_ACRESCIDA = [3, 2, 1] as const;

/** Quantos conjuntos e imóveis cada cenário observa — as âncoras que provam que eles diferem. */
const CONJUNTOS_DO_CENARIO_PEQUENO = CARTEIRA_PEQUENA.length;
const CONJUNTOS_DO_CENARIO_GRANDE = CARTEIRA_PEQUENA.length + CARTEIRA_ACRESCIDA.length;
const IMOVEIS_DO_CENARIO_PEQUENO = somar(CARTEIRA_PEQUENA);
const IMOVEIS_DO_CENARIO_GRANDE = somar(CARTEIRA_PEQUENA) + somar(CARTEIRA_ACRESCIDA);

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

describe('CT-330 — a janela devolve página e total da mesma transação, sem repetir nem omitir', () => {
  /**
   * Os cinco homônimos do cenário, gravados pela PORTA de escrita.
   *
   * O arranjo é do **`describe`**, e não do corpo de um dos casos: os dois `it` desta suíte leem o
   * mesmo cenário, e um `it` que gravasse para o outro faria o segundo depender da ordem de
   * execução (AP-08) — some sob `-t`, sob execução particionada, e se o primeiro for renomeado ou
   * movido. O `beforeAll` corre antes de **qualquer** caso que a suíte contenha, e é isso que
   * mantém o cenário disponível para os dois em qualquer ordem.
   */
  const criados: string[] = [];

  beforeAll(async () => {
    for (let indice = 0; indice < QUANTIDADE_DE_HOMONIMOS; indice += 1) {
      const conjunto = await sobContexto(
        CONTEXTO_DE_A,
        async (tx) => await criarConjunto(tx, { nome: NOME_HOMONIMO }),
      );
      criados.push(conjunto.id);
    }
  }, LIMITE_DO_CASO_MS);

  it(
    'as três páginas de cinco homônimos afirmam o mesmo total e cobrem o conjunto exatamente uma vez',
    async () => {
      // --- Passo 1: as três páginas sobre o cenário do arranjo -----------------------------------
      const paginas = [];
      for (const deslocamento of DESLOCAMENTOS) {
        paginas.push(
          await sobContexto(
            CONTEXTO_DE_A,
            async (tx) =>
              await listarConjuntos(
                tx,
                { limite: LIMITE_DA_PAGINA, deslocamento },
                SO_EM_CIRCULACAO,
              ),
          ),
        );
      }

      // --- Passo 2: o total é o do conjunto INTEIRO, em CADA página ------------------------------
      //
      // Ele é lido na MESMA transação que a página. Sem esta linha, uma porta que contasse tudo e
      // paginasse outro recorte — ou que lesse os dois em transações diferentes — passaria aqui
      // enquanto mentisse para quem pagina.
      for (const [indice, pagina] of paginas.entries()) {
        expect(pagina.total, `total da página ${String(indice)}`).toBe(QUANTIDADE_DE_HOMONIMOS);
      }

      // --- Passo 3: os tamanhos, 2, 2 e 1 --------------------------------------------------------
      expect(paginas.map((pagina) => pagina.conjuntos.length)).toEqual([...TAMANHOS_ESPERADOS]);

      // --- Passo 4: a união é EXATAMENTE o conjunto dos cinco, sem repetição ----------------------
      //
      // É a asserção que o empate torna discriminante: sem desempate, a mesma linha pode aparecer em
      // duas páginas — e então a união teria quatro identificadores distintos, não cinco — ou em
      // nenhuma, e então a união teria quatro elementos.
      const uniao = paginas.flatMap((pagina) => pagina.conjuntos.map((conjunto) => conjunto.id));
      expect(uniao).toHaveLength(QUANTIDADE_DE_HOMONIMOS);
      expect(new Set(uniao).size).toBe(QUANTIDADE_DE_HOMONIMOS);
      expect([...uniao].sort()).toEqual([...criados].sort());
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-330 (b) — a ordem das páginas é a crescente de identificador, que é o desempate declarado',
    async () => {
      // Os cinco vêm do arranjo do `describe`, e não do caso anterior: este `it` afirma sobre o
      // mesmo cenário a propriedade que a asserção de conjunto não alcança — a ORDEM.
      const paginas = [];
      for (const deslocamento of DESLOCAMENTOS) {
        paginas.push(
          await sobContexto(
            CONTEXTO_DE_A,
            async (tx) =>
              await listarConjuntos(
                tx,
                { limite: LIMITE_DA_PAGINA, deslocamento },
                SO_EM_CIRCULACAO,
              ),
          ),
        );
      }

      const lidos = paginas.flatMap((pagina) => pagina.conjuntos.map((conjunto) => conjunto.id));

      // A âncora de não-vacuidade: sem ela, uma listagem vazia satisfaria a igualdade abaixo contra
      // uma lista ordenada também vazia.
      expect(lidos).toHaveLength(QUANTIDADE_DE_HOMONIMOS);
      // `nome` é o mesmo nos cinco, de modo que a única coisa que pode ter produzido esta ordem é o
      // desempate por identificador. A comparação textual do UUID canônico é equivalente à binária
      // que o servidor faz — dígitos hexadecimais preservam a ordem, e os hifens ocupam posições
      // fixas.
      expect(lidos).toEqual([...lidos].sort());
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-329 (d) — a carteira custa o mesmo número de idas ao banco em qualquer tamanho', () => {
  it(
    'dois cenários com quantidades diferentes de conjuntos e imóveis emitem a MESMA contagem',
    async () => {
      // --- Passo 1: o cenário pequeno, gravado pelas PORTAS de escrita ---------------------------
      await povoar(CARTEIRA_PEQUENA);

      const pequeno = await lerCarteiraContando();

      // As âncoras do tamanho: elas são o que faz a igualdade das contagens dizer alguma coisa. Sem
      // elas, dois cenários vazios teriam a mesma contagem e o caso passaria provando nada.
      expect(pequeno.carteira.conjuntos).toHaveLength(CONJUNTOS_DO_CENARIO_PEQUENO);
      expect(contarImoveis(pequeno.carteira.conjuntos)).toBe(IMOVEIS_DO_CENARIO_PEQUENO);

      // --- Passo 2: o cenário acrescido ----------------------------------------------------------
      await povoar(CARTEIRA_ACRESCIDA);

      const grande = await lerCarteiraContando();

      expect(grande.carteira.conjuntos).toHaveLength(CONJUNTOS_DO_CENARIO_GRANDE);
      expect(contarImoveis(grande.carteira.conjuntos)).toBe(IMOVEIS_DO_CENARIO_GRANDE);

      // --- Passo 3: a contagem NÃO mudou ---------------------------------------------------------
      //
      // É o item 4 do aceite técnico, e é o que o `CT-329` — que prova a corretude da árvore pela
      // rota — não consegue afirmar: uma implementação N+1 devolve exatamente a mesma árvore.
      expect(grande.invocacoes).toBe(pequeno.invocacoes);
      // E o valor exato, que é a âncora de não-vacuidade da igualdade acima: sem ele, uma medição que
      // não observasse invocação nenhuma (dois zeros) satisfaria a linha anterior.
      expect(pequeno.invocacoes).toBe(INVOCACOES_DA_CARTEIRA);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — todo acesso pela API pública do pacote, sob o contexto de tenant
// ---------------------------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par que a guarda e o controlador usam em operação.
 */
async function sobContexto<T>(
  contexto: { readonly empresaId: string },
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém o identificador municipal exclusivo entre as chamadas de {@link povoar}. */
let sequenciaDoIdentificador = 0;

/**
 * Grava, na empresa B, um conjunto por posição do arranjo, cada um com o número de imóveis que a
 * posição declara, e um cômodo por imóvel.
 *
 * Os cômodos existem porque a carteira os lê: sem nenhum, a consulta de cômodos seria dispensada
 * pela guarda de lista vazia de `lerComodosDeImoveis`, e a contagem observada deixaria de ser a da
 * carteira povoada — que é o cenário que o aceite descreve.
 *
 * O identificador municipal é composto a partir de um contador de módulo porque a unicidade é por
 * empresa e **alcança os retirados**: repetir um valor entre chamadas faria a segunda reprovar por um
 * motivo que nada tem a ver com o caso (AP-08).
 */
async function povoar(imoveisPorConjunto: readonly number[]): Promise<void> {
  for (const [indice, quantidade] of imoveisPorConjunto.entries()) {
    const conjunto = await sobContexto(
      CONTEXTO_DE_B,
      async (tx) => await criarConjunto(tx, { nome: `Carteira ${String(indice)}` }),
    );

    for (let posicao = 0; posicao < quantidade; posicao += 1) {
      sequenciaDoIdentificador += 1;
      const identificador = `CT329-${String(sequenciaDoIdentificador)}`;

      const imovel = await sobContexto(
        CONTEXTO_DE_B,
        async (tx) =>
          await criarImovel(tx, {
            conjuntoId: conjunto.id,
            nomeImovel: `Ap ${String(posicao)}`,
            identificadorMunicipal: identificador,
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
          }),
      );

      await sobContexto(
        CONTEXTO_DE_B,
        async (tx) =>
          await acrescentarComodo(tx, imovel.id, {
            nomeComodo: 'Sala',
            metragem: 25.5,
            observacoes: null,
          }),
      );
    }
  }
}

/**
 * Lê a carteira inteira da empresa B **contando as invocações do executor**.
 *
 * O executor é a fronteira real de `lerCarteira` — ela o **recebe**, e não o abre —, de modo que
 * envolvê-lo num `Proxy` observa exatamente o que a função emite, sem que nada nasça em
 * `packages/db/src/**` para isso (Iron Law #6). O `Proxy` intercepta apenas a **chamada**: tudo o
 * mais é encaminhado ao executor verdadeiro, e a consulta corre contra o banco de verdade.
 *
 * O objeto envolvido é o executor, e nunca a consulta que ele devolve: `Query` do driver estende
 * `Promise`, e um `Proxy` sobre ela quebraria `Promise.prototype.then`, que exige o receptor
 * original.
 */
async function lerCarteiraContando(): Promise<{
  readonly carteira: Awaited<ReturnType<typeof lerCarteira>>;
  readonly invocacoes: number;
}> {
  let invocacoes = 0;

  const carteira = await sobContexto(CONTEXTO_DE_B, async (tx) => {
    const contado = new Proxy(tx, {
      apply(alvo, esteObjeto, argumentos) {
        invocacoes += 1;

        return Reflect.apply(
          alvo as unknown as (...parametros: unknown[]) => unknown,
          esteObjeto,
          argumentos,
        );
      },
    });

    return await lerCarteira(contado, JANELA_LARGA, SO_EM_CIRCULACAO);
  });

  return { carteira, invocacoes };
}

/** Quantos imóveis a árvore inteira carrega — a âncora de tamanho de cada cenário. */
function contarImoveis(conjuntos: Awaited<ReturnType<typeof lerCarteira>>['conjuntos']): number {
  return conjuntos.reduce((total, conjunto) => total + conjunto.imoveis.length, 0);
}

/** A soma de um arranjo de contagens — usada só para declarar o tamanho esperado dos cenários. */
function somar(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0);
}
