/**
 * O predicado de circulação vive na **porta de leitura** — CT-348. T5 da fatia
 * `cadastro-de-imoveis-e-pessoas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-10    | CT-348 | `listarConjuntos`, chamada **sem** o parâmetro de inclusão, não devolve
 * | CA-11    |        | conjunto retirado; chamada **com** ele, devolve os dois. Os dois lados são
 * |          |        | afirmados por **igualdade de conjunto** — nomes e `total` —, porque só o lado
 * |          |        | que exclui deixaria verde uma porta que nunca inclui. |
 * | CA-11    | CT-348 | `localizarConjunto` devolve o conjunto **retirado**, com `retiradoEm` não
 * |          |        | nulo, tanto enquanto ele circula quanto depois de retirado: a leitura por
 * |          |        | identificador não tem predicado, e é isso que torna a recirculação
 * |          |        | alcançável pela interface. |
 * | CA-10    | CT-348 | Com **todos** os conjuntos retirados, a listagem sem o parâmetro devolve
 * |          |        | `[]` e `total === 0` — o predicado não é um recorte parcial que sobra alguma
 * |          |        | linha por acaso. |
 *
 * Rastreabilidade: `CA-10 → CT-348 (RN-06)`, `CA-11 → CT-348 (RN-05)`.
 *
 * ===========================================================================
 * O QUE ESTE CASO PROVA, E QUE NENHUM CASO DE ROTA PROVA
 * ===========================================================================
 *
 * A invariante aqui é o **LUGAR** do predicado, e não o comportamento da listagem. O `CT-315` e o
 * `CT-316` (T9, transversais às cinco entidades) exercitam a listagem **pela rota**: eles observam
 * que o retirado some sem o parâmetro e volta com ele. Esses dois continuariam verdes se alguém
 * movesse o filtro da porta para o serviço — a rota se comportaria igual.
 *
 * **Este caso chama a porta diretamente, e é essa a falsificação da distinção**: mover o predicado de
 * `packages/db/src/conjunto.ts` para `apps/api/src/imoveis/conjunto.service.ts` mantém o `CT-315`
 * verde e **reprova este caso**. É a diferença entre provar que a lista está certa hoje e provar que
 * a próxima entidade — imóvel, cômodo e as três pessoas — herda o default correto em vez de repetir a
 * escolha do zero (ADR-0014, entre os *Cons*: *"esquecê-lo é um defeito silencioso"*).
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os quatro reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * `packages/db/src/conjunto.ts` e a suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `7 arquivos, 45 casos, 0 falhas`, este caso verde;
 *   * **M1 · o predicado sai da porta** (`predicadoDeCirculacao` devolve sempre `` tx`TRUE` ``, que
 *     é a forma exata de *"o filtro passou a ser de quem chama"*): `1 failed | 44 passed`, na
 *     PRIMEIRA igualdade — `expected [ 'Aurora', 'Boreal', 'Crepúsculo' ] to deeply equal
 *     [ 'Aurora', 'Boreal' ]`. O retirado aparece na listagem que não o pediu;
 *   * **M2 · o default inverte** (`SO_EM_CIRCULACAO` passa a `{ incluirRetirados: true }`):
 *     `1 failed | 44 passed`, com a **mesma** mensagem e no mesmo ponto. É o mutante que mede a
 *     decisão do cabeçalho da porta — *"quem esquece o parâmetro obtém a listagem correta"* —, e ele
 *     mostra que a asserção pega as duas formas de o default se perder: o predicado sumir e o padrão
 *     mudar de lado;
 *   * **M3 · o parâmetro é inerte** (o ramo `incluirRetirados` some e o predicado é sempre
 *     `retirado_em IS NULL`): `1 failed | 44 passed`, na **SEGUNDA** igualdade —
 *     `expected [ 'Aurora', 'Boreal' ] to deeply equal [ 'Aurora', 'Boreal', 'Crepúsculo' ]`. É a
 *     medida literal de *"só o lado que exclui deixaria verde uma porta que nunca inclui"*: o M1 e o
 *     M2 não a alcançam, e ela não alcança o M1 nem o M2;
 *   * **M4 · a leitura por identificador ganha o predicado** (`AND retirado_em IS NULL` no `WHERE` de
 *     `localizarConjunto`): `1 failed | 44 passed`, na leitura do retirado —
 *     `expected undefined to be '<uuid>'`. É a metade que torna a recirculação alcançável;
 *   * **reversão** — o fonte foi restaurado e conferido idêntico ao original por `diff`, e o controle
 *     voltou a `45 passed`.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * `negocio.conjunto` nasce sob RLS **forçada**: ler e escrever nela exige contexto de tenant fixado.
 * O contexto vem **exclusivamente** da API pública do pacote — `contextoDeTenant.executarCom` mais
 * `abrirAcessoAoBanco` —, que é o mesmo caminho da operação. Nenhuma conexão privilegiada é aberta
 * neste arquivo, e nenhum símbolo foi acrescentado a `packages/db/src/**` para que a prova exista
 * (ADR-0006, ADR-0008).
 *
 * A retirada é marcada pela **porta de escrita** (`definirCirculacaoDoConjunto`), e nunca por um
 * `UPDATE` escrito aqui: escrever a coluna à mão provaria o predicado sem provar que o caminho do
 * produto chega até ele.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  criarConjunto,
  definirCirculacaoDoConjunto,
  listarConjuntos,
  localizarConjunto,
} from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso escreve meia dúzia de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho do caso correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/**
 * Os dois que ficam em circulação e o que é retirado.
 *
 * Os nomes são ordenáveis e distintos de propósito: a porta ordena por `nome, id`, e é sobre a lista
 * ordenada que as igualdades abaixo são escritas. `Crepúsculo` vem depois dos outros dois no
 * alfabeto, de modo que a inclusão dele **muda a última posição** — se ele viesse primeiro, uma
 * comparação de prefixo passaria por acidente.
 */
const EM_CIRCULACAO = ['Aurora', 'Boreal'] as const;
const RETIRADO = 'Crepúsculo';

/** A janela do caso: larga o bastante para que o recorte observado seja o do predicado, e só dele. */
const JANELA = { limite: 50, deslocamento: 0 } as const;

/** Ler **inclui** os retirados — o parâmetro explícito e nomeado da porta. */
const COM_RETIRADOS = { incluirRetirados: true } as const;

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

describe('CT-348 — o predicado de circulação vive na PORTA de leitura, aplicado por padrão', () => {
  it(
    'a listagem exclui o retirado por padrão, o inclui sob o parâmetro, e a leitura por id sempre o alcança',
    async () => {
      // --- Passo 1: três conjuntos sob o contexto de A, um deles retirado PELA PORTA -----------
      const aurora = await gravar(EM_CIRCULACAO[0]);
      const boreal = await gravar(EM_CIRCULACAO[1]);
      const crepusculo = await gravar(RETIRADO);

      // A leitura por identificador ANTES da retirada. É a primeira metade do par que torna a
      // asserção da leitura discriminante: sem ela, "devolve o retirado" seria compatível com uma
      // porta que devolve qualquer coisa, e não haveria como ver que o que mudou foi a MARCA.
      const antesDaRetirada = await localizar(crepusculo.id);
      expect(antesDaRetirada?.nome).toBe(RETIRADO);
      expect(antesDaRetirada?.retiradoEm).toBeNull();

      const retirado = await retirar(crepusculo.id);
      expect(retirado?.retiradoEm).not.toBeNull();

      // --- Passo 2: a listagem SEM o parâmetro de inclusão --------------------------------------
      //
      // Igualdade de conjunto sobre os nomes, e o `total` junto: o total é lido da MESMA transação e
      // com o MESMO predicado, e sem ele uma porta que filtrasse a página e contasse tudo passaria
      // aqui enquanto mentisse para quem pagina.
      const padrao = await listar();
      expect(padrao.conjuntos.map((conjunto) => conjunto.nome)).toEqual([...EM_CIRCULACAO]);
      expect(padrao.total).toBe(EM_CIRCULACAO.length);

      // --- Passo 3: a listagem COM o parâmetro ---------------------------------------------------
      //
      // A SEGUNDA igualdade, e ela não é simetria decorativa: só o lado que exclui deixaria verde uma
      // porta que nunca inclui — isto é, uma em que o parâmetro fosse inerte.
      const comRetirados = await listar(COM_RETIRADOS);
      expect(comRetirados.conjuntos.map((conjunto) => conjunto.nome)).toEqual([
        ...EM_CIRCULACAO,
        RETIRADO,
      ]);
      expect(comRetirados.total).toBe(EM_CIRCULACAO.length + 1);

      // --- Passo 4: a leitura por identificador do RETIRADO --------------------------------------
      //
      // Ela não tem parâmetro de inclusão, e é essa ausência que se afirma aqui: a porta devolve o
      // registro **e** a marca, do mesmo modo que devolvia antes da retirada. É o que torna a
      // recirculação alcançável — a rota que a executa é sobre este mesmo identificador.
      const depoisDaRetirada = await localizar(crepusculo.id);
      expect(depoisDaRetirada?.id).toBe(crepusculo.id);
      expect(depoisDaRetirada?.nome).toBe(RETIRADO);
      expect(depoisDaRetirada?.retiradoEm).toEqual(retirado?.retiradoEm);

      // E o que continua em circulação segue alcançável pelo mesmo caminho — o par que impede a
      // asserção acima de passar sobre uma porta que devolvesse tudo indiscriminadamente por engano
      // e a de baixo de passar sobre uma que não devolvesse nada.
      expect((await localizar(aurora.id))?.retiradoEm).toBeNull();

      // --- Passo 5: os TRÊS retirados ------------------------------------------------------------
      //
      // O cenário degenerado. Sem ele, "o retirado some" seria compatível com um predicado que
      // recortasse por qualquer outra coisa — a posição na ordenação, o limite da janela — e por
      // acaso deixasse os dois primeiros. Com todos retirados, a listagem padrão fica vazia.
      await retirar(aurora.id);
      await retirar(boreal.id);

      const tudoRetirado = await listar();
      expect(tudoRetirado.conjuntos).toEqual([]);
      expect(tudoRetirado.total).toBe(0);

      // E o parâmetro continua alcançando os três — a âncora de não-vacuidade do passo: sem ela, uma
      // porta que tivesse APAGADO as linhas passaria na asserção acima.
      const aindaAlcancaveis = await listar(COM_RETIRADOS);
      expect(aindaAlcancaveis.conjuntos.map((conjunto) => conjunto.nome)).toEqual([
        ...EM_CIRCULACAO,
        RETIRADO,
      ]);
      expect(aindaAlcancaveis.total).toBe(EM_CIRCULACAO.length + 1);
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

/** Grava um conjunto pela porta de escrita. */
async function gravar(nome: string) {
  return await sobContextoDeA(async (tx) => await criarConjunto(tx, { nome }));
}

/** Marca a retirada pela porta de escrita — nunca por um `UPDATE` escrito neste arquivo. */
async function retirar(id: string) {
  return await sobContextoDeA(async (tx) => await definirCirculacaoDoConjunto(tx, id, false));
}

/** A listagem, com ou sem o parâmetro de inclusão. Omitido, é o caminho do esquecimento. */
async function listar(opcoes?: { readonly incluirRetirados: boolean }) {
  return await sobContextoDeA(async (tx) =>
    opcoes === undefined
      ? await listarConjuntos(tx, JANELA)
      : await listarConjuntos(tx, JANELA, opcoes),
  );
}

/** A leitura por identificador — a porta que NÃO tem predicado. */
async function localizar(id: string) {
  return await sobContextoDeA(async (tx) => await localizarConjunto(tx, id));
}
