/**
 * O **agregado do documento do contrato** — a porta de dados que a T7 da fatia
 * `documentos-e-confirmacao` acrescenta (`lerAgregadoDoContrato`).
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso        | Invariante |
 * |---|---|---|
 * | CA-02 | CT-736      | O agregado do documento — contrato, locador, locatário, imóvel e fiadores
 * |       |             | — sai em **UMA** consulta: o contrato com **dois** fiadores custa o mesmo
 * |       |             | número de invocações do executor que o contrato **sem nenhum**, e o valor
 * |       |             | exato é afirmado como âncora de não-vacuidade. As partes voltam com os
 * |       |             | onze campos que o documento imprime, e a coleção de fiadores vem ordenada
 * |       |             | por nome. |
 * | CA-08 | CT-736 (b)  | O contrato da empresa A **não retorna linha** sob o contexto da empresa B:
 * |       |             | a leitura devolve `undefined`, sem exceção e sem `WHERE empresa_id`
 * |       |             | escrito na aplicação. Quem recusa é a política do banco (ADR-0008). |
 * | CA-02 | CT-736 (c)  | `valorTotalContrato` sai da **consulta**, em `numeric`: o `RASCUNHO` com a
 * |       |             | coluna nula devolve `500.03 × 13 = 6500.39` **exato** — e não o produto
 * |       |             | ingênuo `6500.389999999999` do ponto flutuante —, e o contrato `ATIVO`
 * |       |             | devolve o valor **gravado**, ainda quando ele diverge do produto. |
 * | CA-02 | CT-736 (d)  | Nenhuma **aritmética monetária escrita em TypeScript** existe no fonte do
 * |       |             | agregado, e o `COALESCE` da consulta está lá — as duas metades, com a
 * |       |             | sensibilidade do predicado afirmada antes da varredura. |
 *
 * Rastreabilidade: `CA-02 → CT-736 (RN-01)`, `CA-08 → CT-736 (b) (RN-05)`,
 * `CA-02 → CT-736 (c) (RN-01)`, `CA-02 → CT-736 (d) (RN-01)`.
 *
 * ⚠️ **O identificador é o `CT-736`, e a escolha não é arbitrária.** A §6.2 da task registra os dois
 * casos desta camada como *"— (apoio)"*, sem ID atribuído, e a convenção `CA-xx → CT-xxx (RN-xx)`
 * exige o ID literal no `describe`/`it`. O **`CT-716` NÃO pode ser usado**: o vão dele é
 * **intencional e preservado** (§19 do tech spec, `_run/test-cases.json` e o `task_plan.md` §4.4 o
 * declaram nos três lugares). O último ID emitido na fatia é o `CT-735`, nascido na rodada 3 da T3,
 * e este é o seguinte.
 *
 * ===========================================================================
 * POR QUE (c) E (d) VÊM EM PAR — e por que nenhum deles sozinho serve
 * ===========================================================================
 *
 * O critério §4-2 da task proíbe recompor `valorMensal × prazoMeses` em TypeScript, e manda a
 * derivação viver no banco (ADR-0023). Os dois casos medem metades diferentes disso:
 *
 *   * o **(c)** discrimina *onde a conta correu*, e não apenas *que ela correu*. `500.03 × 13` vale
 *     `6500.39` em `numeric` e `6500.389999999999` em ponto flutuante binário — dois valores
 *     **distintos** em JavaScript. Uma implementação que lesse as duas colunas e multiplicasse aqui
 *     reprova nesta asserção, e reprova nomeando o resíduo;
 *   * o **(d)** fecha o que o (c) não alcança: a forma ingênua que **acerta** o valor. Um
 *     `Math.round(valorMensal * prazoMeses * 100) / 100` produziria `6500.39` e atravessaria o (c)
 *     intacto — e continuaria sendo aritmética monetária na aplicação, sobre valor não persistido,
 *     que é literalmente o que a `Decision` da ADR-0023 põe no banco. É a mesma razão, e o mesmo
 *     desenho, do `CT-413 (c)` sobre `apps/api/src/contratos/contrato.service.ts`.
 *
 * O recíproco também vale: o (d) sozinho seria satisfeito por um módulo que **não derivasse nada** —
 * zero ocorrências de aritmética é o que um agregado que devolvesse `null` também produz. É o
 * controle positivo do (d), somado ao (c), que fecha essa saída.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os dois reprovam, cada um por um eixo diferente
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte de
 * produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca
 * por `vitest run` avulso — este pacote resolve `"."` para `dist/`, e verde ali se leria como
 * *"sobreviveu"*, invertendo a conclusão. Controle: `21 arquivos, 156 casos, 0 falhas`.
 *
 *   * **MT-1 · o total é recomposto em TypeScript** (o `COALESCE` da consulta trocado por
 *     `contrato.valor_total_contrato` cru, e o mapeamento passando a
 *     `linha.valorTotalContrato === null ? linha.valorMensal * linha.prazoMeses : …`):
 *     `2 failed | 154 passed`, no **CT-736 (c)** — `expected 6500.389999999999 to be 6500.39` — **e**
 *     no **CT-736 (d)** — `expected [ Array(1) ] to deeply equal []`, com o caminho e a linha da
 *     ocorrência dentro do arranjo. São os dois eixos reprovando por caminhos diferentes, e é a
 *     medida de que eles não são redundantes;
 *   * **MT-2 · a leitura dos fiadores vira N+1 de verdade** (a junção lateral trocada por uma
 *     consulta pelos vínculos mais **uma por fiador**): `1 failed | 155 passed`, no **CT-736**, na
 *     **igualdade das contagens** — `expected 10 to be 8`, isto é, o cenário com dois fiadores passa
 *     a custar duas invocações a mais que o sem nenhum. É a dependência de N aparecendo.
 *
 *     ⚠️ **Uma variante mais fraca do mesmo defeito reprova por OUTRA asserção, e a distinção importa
 *     para quem editar este arquivo**: uma segunda consulta que traga **todos** os fiadores de uma
 *     vez custa o mesmo em qualquer tamanho, de modo que a igualdade das contagens continua
 *     satisfeita — quem a pega é a **âncora de valor exato** (`expected 8 to be 9`). É por isso que
 *     as duas asserções convivem no passo 3, e não apenas a igualdade.
 *
 * Cada mutante foi revertido de cópia e conferido idêntico ao original por `diff -q` antes do caso
 * seguinte, e o controle voltou a `156 passed`.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * As seis relações que a consulta toca nascem sob RLS **forçada**: ler nelas exige contexto de tenant
 * fixado. O contexto vem **exclusivamente** da API pública do pacote — `contextoDeTenant.executarCom`
 * mais `abrirAcessoAoBanco` —, que é o mesmo caminho da operação. Nenhuma conexão privilegiada é
 * aberta aqui, nenhuma cláusula compara `empresa_id`, e toda linha é gravada pelas **portas de
 * escrita** do pacote, nunca por `INSERT` escrito neste arquivo (ADR-0006, ADR-0008).
 */

import { fileURLToPath } from 'node:url';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa } from '../src/cadastro-de-pessoa.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  ativarContrato,
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import {
  type AgregadoDoDocumentoDoContrato,
  lerAgregadoDoContrato,
} from '../src/documento-de-contrato.ts';
import { criarImovel } from '../src/imovel.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { varrerArquivos } from './varredura-de-fontes.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Os casos escrevem poucas dezenas de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho dos casos correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// Os contextos e os cenários
// ---------------------------------------------------------------------------

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/**
 * Quantas invocações do executor `lerAgregadoDoContrato` emite, qualquer que seja o número de
 * fiadores.
 *
 * **Nove**, e a decomposição é exata: **uma** pela consulta que emite ao banco, mais **duas** por
 * projeção de parte (o construtor de identificador do apelido e o fragmento `json_build_object`),
 * nas **três** partes — locador, locatário e fiador —, mais **duas** pela projeção do imóvel. Seis
 * mais dois mais um.
 *
 * O valor exato é a âncora de não-vacuidade: sem ele, *"as duas contagens são iguais"* passaria
 * sobre uma medição que não observou invocação alguma. E ele é um **teto** do número de idas ao
 * banco, o que é mais severo do que contar só as consultas — uma implementação que montasse
 * fragmento por fiador também cresceria com N, e também reprovaria aqui.
 */
const INVOCACOES_DO_AGREGADO = 9;

/** Quantos fiadores cada cenário do `CT-736` carrega — a diferença é o que torna a igualdade útil. */
const CENARIO_SEM_FIADOR = 0;
const CENARIO_COM_DOIS_FIADORES = 2;

/**
 * Os termos do contrato do cenário do resíduo binário — o par que discrimina **onde** a conta correu.
 *
 * `500.03 × 13` vale `6500.39` em `numeric` (decimal exato) e `6500.389999999999` em ponto flutuante
 * binário. Os dois são números **distintos** em JavaScript, e é essa distinção que separa *"o
 * `COALESCE` correu no banco"* de *"as duas colunas foram lidas e multiplicadas aqui"*. É o mesmo par
 * que o `CT-413` já usa em `apps/api/test/contratos.e2e.spec.ts`, pela mesma razão.
 */
const VALOR_MENSAL_COM_RESIDUO = 500.03;
const PRAZO_COM_RESIDUO = 13;
const TOTAL_EXATO_DO_NUMERIC = 6500.39;
const TOTAL_INGENUO_DO_PONTO_FLUTUANTE = 6500.389999999999;

/**
 * O valor total que a ativação **grava**, escolhido para DIVERGIR do produto dos termos.
 *
 * Ele é a outra metade do `CT-736 (c)`: com um valor gravado igual ao produto, uma consulta que
 * **ignorasse** a coluna e multiplicasse sempre atravessaria o caso intacta. Divergindo, a asserção
 * afirma que o `COALESCE` prefere o que está persistido — que é a ordem exata dos argumentos dele.
 */
const TOTAL_GRAVADO_NA_ATIVACAO = 1234.56;

/** Os termos padrão dos contratos que não medem valor — nenhum caso afirma coisa alguma sobre eles. */
const TERMOS_PADRAO = {
  dataInicioLocacao: '2026-03-15',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
} as const;

/** A data de fim que a ativação do cenário grava — nenhum caso a afirma. */
const FIM_DA_ATIVACAO = '2027-03-14';

// ---------------------------------------------------------------------------
// A asserção ESTÁTICA do CT-736 (d)
// ---------------------------------------------------------------------------

/** O fonte sob varredura — o módulo do agregado, e só ele. */
const FONTE_DO_AGREGADO = fileURLToPath(
  new URL('../src/documento-de-contrato.ts', import.meta.url),
);

/**
 * O que caracteriza aritmética de **dinheiro ou de prazo** escrita em TypeScript neste módulo.
 *
 * Ela casa um dos dois nomes **camelCase** adjacente a um operador aritmético, nos dois sentidos — a
 * forma que a multiplicação inlinada teria, qualquer que fosse a ordem dos fatores. As colunas do
 * banco são `snake_case` (`valor_mensal`, `prazo_meses`), de modo que o `COALESCE` **legítimo**,
 * escrito dentro do gabarito de consulta, não é casado: é exatamente essa assimetria que faz o
 * predicado separar *"a conta corre no banco"* de *"a conta corre aqui"*.
 *
 * Os operadores de **comparação** ficam de fora de propósito, pelo mesmo motivo do `CT-413 (c)`.
 */
const ARITMETICA_DE_DINHEIRO_OU_PRAZO =
  /\b(?:valorMensal|prazoMeses)\b\s*[*+/-]|[*+/-]\s*[\w.]*\b(?:valorMensal|prazoMeses)\b/u;

/**
 * As duas linhas da sensibilidade do predicado, escritas por extenso.
 *
 * A mutante é a forma que o defeito teria — literalmente o mutante `MT-1` do cabeçalho —, e a
 * legítima é a linha que o módulo de fato tem. É o **par** que prova o predicado: sozinho, o negativo
 * seria satisfeito por um predicado que nunca casa, e o positivo, por um que casa tudo.
 */
const LINHA_MUTANTE_DO_TOTAL = 'valorTotalContrato: linha.valorMensal * linha.prazoMeses,';
const LINHA_LEGITIMA_DO_TOTAL = 'valorTotalContrato: Number(linha.valorTotalContrato),';

/**
 * Os dois lados do `COALESCE` do valor total, **como o gabarito de consulta os escreve** — o
 * controle positivo do `CT-736 (d)`.
 *
 * Sem ele, *"nenhuma aritmética aqui"* seria satisfeito por um módulo que não derivasse nada, e o
 * caso passaria enquanto o rascunho voltasse sem valor total. Com ele, a asserção diz as duas coisas
 * de uma vez: a derivação **existe** e ela está **no banco**, em `snake_case`, dentro do gabarito.
 *
 * São dois padrões e não um porque a ordem dos argumentos é conteúdo: o primeiro é a coluna
 * persistida, que o `COALESCE` **prefere**, e o segundo é o produto que só entra quando ela é nula.
 * Um `COALESCE` com os argumentos trocados devolveria o produto **sempre**, e o `CT-736 (c)` eixo 2 é
 * quem o reprova — aqui o que se afirma é que os dois lados estão lá, cada um uma vez.
 *
 * ⚠️ Um `COALESCE(` genérico **não** serve: a junção lateral dos fiadores tem o dela, e a contagem
 * passaria a depender de quantos `COALESCE` a consulta tem por outras razões.
 */
const COLUNA_PERSISTIDA_DO_TOTAL = /\bcontrato\.valor_total_contrato\b/u;
const PRODUTO_EM_NUMERIC = /\bcontrato\.valor_mensal\s*\*\s*contrato\.prazo_meses\b/u;

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

describe('CT-736 — o agregado do documento sai numa consulta só, sob a política do banco', () => {
  it(
    'CT-736 — dois cenários com números diferentes de fiadores emitem a MESMA contagem de invocações',
    async () => {
      // --- Passo 1: o contrato SEM fiador ---------------------------------------------------------
      const semFiador = await montarContrato(CONTEXTO_DE_A, CENARIO_SEM_FIADOR);
      const primeiro = await lerAgregadoContando(CONTEXTO_DE_A, semFiador.codigo);

      // As âncoras do cenário: elas são o que faz a igualdade das contagens dizer alguma coisa. Sem
      // elas, dois agregados vazios teriam a mesma contagem e o caso passaria provando nada.
      expect(primeiro.agregado?.dados.fiadores).toEqual([]);
      expect(primeiro.agregado?.status).toBe('RASCUNHO');
      expect(primeiro.agregado?.dados.locador.nome).toBe(semFiador.nomeDoLocador);
      expect(primeiro.agregado?.dados.locatario.nome).toBe(semFiador.nomeDoLocatario);
      expect(primeiro.agregado?.dados.imovel.nomeImovel).toBe(semFiador.nomeDoImovel);

      // A parte volta com os ONZE campos que o documento imprime, e com NENHUM além deles: `email`,
      // `telefone`, `id` e `retiradoEm` ficam de fora por decisão, e uma projeção que os trouxesse
      // daria ao agregado uma superfície que o tipo do domínio não declara.
      expect(Object.keys(primeiro.agregado?.dados.locador ?? {}).sort()).toEqual([
        'bairro',
        'cep',
        'cidade',
        'complemento',
        'documentoPrincipal',
        'estado',
        'logradouro',
        'nome',
        'numero',
        'rg',
        'tipoPessoa',
      ]);

      // --- Passo 2: o contrato COM dois fiadores --------------------------------------------------
      const comFiadores = await montarContrato(CONTEXTO_DE_A, CENARIO_COM_DOIS_FIADORES);
      const segundo = await lerAgregadoContando(CONTEXTO_DE_A, comFiadores.codigo);

      // Os dois fiadores vieram, na ordem declarada (`nome, id`) — a âncora que a contagem sozinha
      // não dá: ela seria idêntica sobre uma junção lateral que não casasse fiador algum.
      expect(segundo.agregado?.dados.fiadores.map((fiador) => fiador.nome)).toEqual(
        [...comFiadores.nomesDosFiadores].sort(),
      );

      // --- Passo 3: a contagem NÃO mudou ----------------------------------------------------------
      //
      // É o critério §4-1 da task: uma leitura N+1 sobre os fiadores devolve exatamente o mesmo
      // agregado, e por isso as asserções acima não a distinguem. Quem distingue é esta.
      expect(segundo.invocacoes).toBe(primeiro.invocacoes);
      // E o valor exato, âncora de não-vacuidade da igualdade acima: sem ele, uma medição que não
      // observasse invocação nenhuma (dois zeros) satisfaria a linha anterior.
      expect(primeiro.invocacoes).toBe(INVOCACOES_DO_AGREGADO);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-736 (b) — o contrato da empresa A NÃO retorna linha sob o contexto da empresa B',
    async () => {
      const daEmpresaA = await montarContrato(CONTEXTO_DE_A, CENARIO_SEM_FIADOR);

      // O controle positivo vem primeiro, e ele é o que impede o caso de passar por vacuidade: sem
      // ele, um `undefined` devolvido a TODA leitura satisfaria a asserção seguinte.
      const sobA = await sobContexto(
        CONTEXTO_DE_A,
        async (tx) => await lerAgregadoDoContrato(tx, daEmpresaA.codigo),
      );
      expect(sobA?.dados.locador.nome).toBe(daEmpresaA.nomeDoLocador);

      // A recusa é **ausência de linha**, e não exceção: quem a produz é a política do banco, e não
      // uma comparação de empresa escrita na aplicação (ADR-0008). Um `rejects` aqui significaria que
      // alguém escreveu a comparação.
      const sobB = await sobContexto(
        CONTEXTO_DE_B,
        async (tx) => await lerAgregadoDoContrato(tx, daEmpresaA.codigo),
      );
      expect(sobB).toBeUndefined();
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-736 (c) — o valor total sai da CONSULTA em numeric: o rascunho deriva exato, o ativo lê o gravado',
    async () => {
      // --- Eixo 1: o RASCUNHO, com a coluna NULA -------------------------------------------------
      const rascunho = await montarContrato(CONTEXTO_DE_A, CENARIO_SEM_FIADOR, {
        valorMensal: VALOR_MENSAL_COM_RESIDUO,
        prazoMeses: PRAZO_COM_RESIDUO,
      });

      const doRascunho = await sobContexto(
        CONTEXTO_DE_A,
        async (tx) => await lerAgregadoDoContrato(tx, rascunho.codigo),
      );

      // O estado é a âncora: sem ela, um contrato já ativado satisfaria a igualdade abaixo pelo
      // caminho errado — o valor viria da coluna, e não do `COALESCE`.
      expect(doRascunho?.status).toBe('RASCUNHO');
      // O valor EXATO do decimal. Uma implementação que multiplicasse em TypeScript devolveria
      // `6500.389999999999`, e a linha seguinte nomeia o resíduo para que a falha seja legível.
      expect(doRascunho?.dados.contrato.valorTotalContrato).toBe(TOTAL_EXATO_DO_NUMERIC);
      expect(doRascunho?.dados.contrato.valorTotalContrato).not.toBe(
        TOTAL_INGENUO_DO_PONTO_FLUTUANTE,
      );
      // Os termos que alimentaram a derivação voltam intactos — é o que torna a igualdade acima
      // atribuível a ESTE par, e não a um valor plantado em outro lugar.
      expect(doRascunho?.dados.contrato.valorMensal).toBe(VALOR_MENSAL_COM_RESIDUO);
      expect(doRascunho?.dados.contrato.prazoMeses).toBe(PRAZO_COM_RESIDUO);

      // --- Eixo 2: o ATIVO, com valor GRAVADO que diverge do produto -----------------------------
      //
      // Sem este eixo, uma consulta que ignorasse a coluna e multiplicasse sempre atravessaria o eixo
      // 1 intacta. O valor gravado é deliberadamente diferente de `500.03 × 13`.
      const ativo = await montarContrato(CONTEXTO_DE_A, CENARIO_SEM_FIADOR, {
        valorMensal: VALOR_MENSAL_COM_RESIDUO,
        prazoMeses: PRAZO_COM_RESIDUO,
      });

      await sobContexto(CONTEXTO_DE_A, async (tx) => {
        const ativado = await ativarContrato(tx, ativo.codigo, {
          dataFimLocacao: FIM_DA_ATIVACAO,
          valorTotalContrato: TOTAL_GRAVADO_NA_ATIVACAO,
        });

        if (ativado === undefined) {
          throw new Error(`o arranjo do CT-736 (c) não conseguiu ativar ${ativo.codigo}`);
        }
      });

      const doAtivo = await sobContexto(
        CONTEXTO_DE_A,
        async (tx) => await lerAgregadoDoContrato(tx, ativo.codigo),
      );

      expect(doAtivo?.status).toBe('ATIVO');
      expect(doAtivo?.dados.contrato.valorTotalContrato).toBe(TOTAL_GRAVADO_NA_ATIVACAO);
      expect(doAtivo?.dados.contrato.valorTotalContrato).not.toBe(TOTAL_EXATO_DO_NUMERIC);
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-736 (d) — nenhuma aritmética monetária em TypeScript, e o COALESCE está na consulta', async () => {
    // --- A SENSIBILIDADE do predicado, ANTES de aplicá-lo --------------------------------------
    //
    // As duas metades, e nenhuma sozinha basta: um predicado que nunca casasse nada passaria a
    // varredura em silêncio para sempre, e um que casasse tudo reprovaria o código correto.
    expect(ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(LINHA_MUTANTE_DO_TOTAL)).toBe(true);
    expect(ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(LINHA_LEGITIMA_DO_TOTAL)).toBe(false);

    // --- A varredura, com os COMENTÁRIOS FORA --------------------------------------------------
    const executavel = await varrerArquivos([FONTE_DO_AGREGADO], (linha) =>
      ARITMETICA_DE_DINHEIRO_OU_PRAZO.test(linha),
    );

    // O alvo foi lido — zero arquivo nunca é escondido: um fonte renomeado faria a varredura provar
    // nada, e a asserção abaixo passaria por vacuidade.
    expect(executavel.arquivos).toBe(1);
    // Igualdade de array, e não "está vazio": a falha NOMEIA a linha ofensora, com número.
    expect(executavel.ocorrencias).toEqual([]);

    // --- O CONTROLE POSITIVO: a derivação existe, e ela está na CONSULTA -----------------------
    //
    // Sem ele, "nenhuma aritmética aqui" seria satisfeito por um módulo que não derivasse nada. Os
    // dois lados do `COALESCE` são afirmados separadamente, cada um uma vez: a coluna persistida —
    // que ele prefere — e o produto em `numeric`, que só entra quando ela é nula.
    const persistida = await varrerArquivos([FONTE_DO_AGREGADO], (linha) =>
      COLUNA_PERSISTIDA_DO_TOTAL.test(linha),
    );
    expect(persistida.ocorrencias.length).toBe(1);

    const produto = await varrerArquivos([FONTE_DO_AGREGADO], (linha) =>
      PRODUTO_EM_NUMERIC.test(linha),
    );
    expect(produto.ocorrencias.length).toBe(1);
  });
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

/** O contador que mantém únicos o identificador municipal e o documento entre os arranjos. */
let sequencia = 0;

/** O que {@link montarContrato} devolve — o código mais os nomes que os casos afirmam. */
interface ContratoDoArranjo {
  readonly codigo: string;
  readonly nomeDoLocador: string;
  readonly nomeDoLocatario: string;
  readonly nomeDoImovel: string;
  readonly nomesDosFiadores: readonly string[];
}

/**
 * Monta conjunto, imóvel, locador, locatário, `quantosFiadores` fiadores e o contrato — **pelas
 * portas de escrita** do pacote, sob o contexto informado.
 *
 * A série é emitida pelo **protocolo das duas unidades sequenciais** que a borda usa (§7.4): a
 * primeira garante o contador e commita, a segunda emite o número e grava. Fundi-las é o desenho que
 * a ADR-0015 recusa, e um acessório que o fizesse montaria o cenário por um caminho que a operação
 * não tem.
 *
 * O identificador municipal e os documentos saem de um contador de módulo porque a unicidade é por
 * empresa e **alcança os retirados**: repetir um valor entre chamadas faria a segunda reprovar por um
 * motivo que nada tem a ver com o caso (AP-08).
 */
async function montarContrato(
  contexto: { readonly empresaId: string },
  quantosFiadores: number,
  termos: { readonly valorMensal?: number; readonly prazoMeses?: number } = {},
): Promise<ContratoDoArranjo> {
  sequencia += 1;
  const marca = String(sequencia).padStart(3, '0');

  const conjunto = await sobContexto(
    contexto,
    async (tx) => await criarConjunto(tx, { nome: `Edifício ${marca}` }),
  );

  const nomeDoImovel = `Ap ${marca}`;
  const imovel = await sobContexto(
    contexto,
    async (tx) =>
      await criarImovel(tx, {
        conjuntoId: conjunto.id,
        nomeImovel: nomeDoImovel,
        identificadorMunicipal: `DOC-${marca}`,
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

  const nomeDoLocador = `Ana ${marca}`;
  const locador = await sobContexto(
    contexto,
    async (tx) => await criarPessoa(tx, 'locador', dadosDePessoa(nomeDoLocador, `1${marca}`)),
  );

  const nomeDoLocatario = `Bruno ${marca}`;
  const locatario = await sobContexto(
    contexto,
    async (tx) => await criarPessoa(tx, 'locatario', dadosDePessoa(nomeDoLocatario, `2${marca}`)),
  );

  const nomesDosFiadores: string[] = [];
  const fiadoresIds: string[] = [];
  for (let indice = 0; indice < quantosFiadores; indice += 1) {
    const nome = `Fiador ${marca}-${String(indice)}`;
    const criado = await sobContexto(
      contexto,
      async (tx) =>
        await criarPessoa(tx, 'fiador', dadosDePessoa(nome, `${String(indice)}${marca}`)),
    );

    nomesDosFiadores.push(nome);
    fiadoresIds.push(criado.id);
  }

  const ano = await sobContexto(contexto, lerAnoDaSerieDeContrato);
  await sobContexto(contexto, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  const contrato = await sobContexto(contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);

    return await criarContrato(
      tx,
      {
        imovelId: imovel.id,
        locadorId: locador.id,
        locatarioId: locatario.id,
        fiadoresIds,
        ...TERMOS_PADRAO,
        ...termos,
      },
      { ano, numero },
    );
  });

  return {
    codigo: contrato.codigo,
    nomeDoLocador,
    nomeDoLocatario,
    nomeDoImovel,
    nomesDosFiadores,
  };
}

/** O cadastro completo de uma pessoa do arranjo — o documento é único por construção. */
function dadosDePessoa(nome: string, sufixoDoDocumento: string): Parameters<typeof criarPessoa>[2] {
  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: `2000000${sufixoDoDocumento}`,
    rg: null,
    email: `${sufixoDoDocumento}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Lê o agregado **contando as invocações do executor**.
 *
 * O executor é a fronteira real de `lerAgregadoDoContrato` — ela o **recebe**, e não o abre —, de
 * modo que envolvê-lo num `Proxy` observa exatamente o que a função emite. **Nenhum símbolo nasce em
 * `packages/db/src/**` para que a prova exista** (Iron Law #6), nenhuma opção de depuração do driver
 * é ligada e nenhuma extensão do servidor é exigida. É o mesmo mecanismo do `CT-329 (d)` e do
 * `CT-420`, em `janela.spec.ts`.
 */
async function lerAgregadoContando(
  contexto: { readonly empresaId: string },
  codigo: string,
): Promise<{ agregado: AgregadoDoDocumentoDoContrato | undefined; invocacoes: number }> {
  let invocacoes = 0;

  const agregado = await sobContexto(contexto, async (tx) => {
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

    return await lerAgregadoDoContrato(contado, codigo);
  });

  return { agregado, invocacoes };
}
