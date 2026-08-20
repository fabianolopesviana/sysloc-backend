/**
 * A travessia nominal do roteamento — a única leitura desta fatia sem contexto de empresa. Caso
 * CT-973 (T3) da fatia `webhook-e-carne`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-06    | CT-973 | Chamada pelo **papel de aplicação e SEM `app.empresa_id` fixado**,
 * | CA-07    |  (a)   | `negocio.rotear_notificacao_bancaria` devolve **uma** linha, com o
 * |          |        | `empresa_id` da empresa dona — e as **quatro** colunas declaradas, afirmadas
 * |          |        | por igualdade de conjunto contra a lista escrita à mão, com controle
 * |          |        | antivácuo. Uma quinta coluna alarga o furo que a função é. |
 * | CA-06    | CT-973 | A leitura DIRETA de `negocio.cobranca` sem contexto devolve **zero** linhas,
 * |          |  (b)   | e com contexto devolve a cobrança daquela empresa. É o par que impede (a) de
 * |          |        | ser lido como *"a política afrouxou"* — ela continua fechada, e o que
 * |          |        | atravessa é a função. |
 * | CA-07    | CT-973 | O identificador da empresa **B** devolve a linha de **B**, e não a primeira
 * |          |  (c)   | linha da tabela nem a de A. Sem esta perna, uma função que devolvesse sempre
 * |          |        | a primeira cobrança passaria em (a). |
 * | CA-05    | CT-973 | Identificador **sem correspondência** devolve zero linhas, e não erro — a
 * |          |  (d)   | notícia órfã morre antes de qualquer consulta ao provedor (RN-06). |
 * | CA-06    | CT-973 | O mecanismo, pelo catálogo, numa igualdade só: **um** parâmetro, `STABLE`,
 * | CA-07    |  (e)   | `SECURITY DEFINER`, `search_path` fixado, dono `sysloc_roteamento`,
 * |          |        | `EXECUTE` **revogado de `PUBLIC`** e concedido a `sysloc_app`, a política
 * |          |        | `FOR SELECT TO sysloc_roteamento` em `negocio.cobranca`, e o privilégio de
 * |          |        | estado final do papel (`USAGE` sim, `CREATE` não, `SELECT` sim, `UPDATE`
 * |          |        | não, zero tabelas de que é dono, não conecta, não contorna política). |
 * | —        | CT-973 | A `0020` **confere** o papel e **não o cria**: aplicada a um agrupamento
 * |          |  (f)   | provisionado sem `sysloc_roteamento`, ela aborta nomeando o passo **P15** do
 * |          |        | `provisionar-base.sh` e o nome do papel. |
 *
 * Rastreabilidade: `CA-06 → CT-973 (RN-06)` · `CA-07 → CT-973 (RN-06)` · `CA-05 → CT-973 (RN-06)`.
 *
 * ===========================================================================
 * O modo de falha que este caso existe para pegar tem precedente exato
 * ===========================================================================
 *
 * A rodada 1 da task da `0014` copiou o molde da travessia **sem** a posse pelo papel nominal, e a
 * função devolveu **zero linhas em 100% das chamadas** — silenciosamente, porque zero linhas é
 * resposta válida. O que existia era cobertura de catálogo, e ela passou integralmente sobre uma
 * função morta. A lição está registrada porque ela se repete: **asserção de catálogo sobre um
 * mecanismo prova que ele foi DECLARADO, nunca que ele FUNCIONA.**
 *
 * Por isso a ordem das pernas é conteúdo: as comportamentais (a, b, c, d) vêm primeiro e afirmam que
 * a resolução **acontece**; a de catálogo (e) vem depois e serve para **nomear a peça** que caiu
 * quando o comportamento cair — posse trocada, política alargada, `CREATE` esquecido concedido.
 *
 * ===========================================================================
 * Precondição privilegiada — PRESENTE, e o caminho legítimo é o provisionamento real
 * ===========================================================================
 *
 * O caso precisa que o papel `sysloc_roteamento` e a posse da função existam. Eles são montados pelo
 * **provisionamento** (`banco-efemero.ts`, a mesma frente que o `provisionar-base.sh` espelha) e pela
 * **migração `0020` lida do disco** — nunca por instrução escrita neste arquivo.
 *
 * A suíte **nunca** assume a identidade de `sysloc_roteamento`, **nunca** concede `EXECUTE` a
 * `PUBLIC` e **nunca** chama a função como superusuária: ela chama pelo papel de aplicação, como
 * qualquer consulta da operação. A cadeia privilegiada não aparece neste arquivo em ponto algum.
 * Análogos: `plataforma.proximo_identificador_bancario()` (`0016`) e
 * `negocio.resolver_portador_de_confirmacao` (`0014`, `CT-735`).
 *
 * Nenhum símbolo de produção foi acrescentado para o caso existir (Iron Law #6). O acessório
 * `erroAoMigrarSemPapelDeRoteamento`, que a perna (f) consome, é **de teste**, mora na casa
 * compartilhada do diretório e percorre o mesmo caminho de `bancoEfemero` — menos um `CREATE ROLE`.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gravarBoletoDaCobranca } from '../src/boleto-da-cobranca.ts';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  lerAnoDaSerieDeCobranca,
} from '../src/cobranca.ts';
import { abrirConexao } from '../src/conexao.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import { criarImovel } from '../src/imovel.ts';
import { rotearNotificacaoBancaria } from '../src/notificacao-bancaria.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import {
  type BancoMigrado,
  bancoEfemero,
  erroAoMigrarSemPapelDeRoteamento,
} from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas unidades de trabalho e consultas de catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** A perna (f) sobe uma instância PRÓPRIA e aplica as migrações do zero — teto do arranjo inteiro. */
const LIMITE_DA_MIGRACAO_MS = 120_000;

/** Uma conexão basta: os casos correm em série dentro do arquivo. */
const RESERVA_DE_UMA = 1;

/** O papel `NOLOGIN` que a `0020` instala como dono da função, e nada mais. */
const PAPEL_ROTEAMENTO = 'sysloc_roteamento';

/** O papel que a aplicação usa para atender requisição — o único que este arquivo utiliza. */
const PAPEL_APLICACAO = 'sysloc_app';

/**
 * As **quatro** colunas que a função publica, em ordem alfabética.
 *
 * Escritas por extenso, e não derivadas do resultado: derivá-las do artefato que elas conferem faria
 * a asserção concordar consigo mesma, e uma quinta coluna acrescentada à função passaria verde. Cada
 * coluna a mais alarga o furo que uma função `SECURITY DEFINER` é — é a propriedade 2 da §7.3 do tech
 * spec, e é ela que esta lista mede.
 */
const COLUNAS_DO_ROTEAMENTO: readonly string[] = [
  'cobranca_id',
  'codigo',
  'empresa_id',
  'numero_do_titulo_no_provedor',
];

/** O identificador que este banco nunca guardou — o companheiro negativo da perna (d). */
const IDENTIFICADOR_INEXISTENTE = '202699999999999999';

/** O que cada empresa recebe no arranjo: a cobrança e as duas chaves do provedor. */
interface CobrancaSemeada {
  readonly empresaId: string;
  readonly codigo: string;
  readonly cobrancaId: string;
  readonly identificadorNoProvedor: string;
  readonly numeroDoTituloNoProvedor: string;
}

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let daEmpresaA: CobrancaSemeada;
let daEmpresaB: CobrancaSemeada;

/** Abre a unidade de trabalho real, sob o contexto da empresa — o mesmo par que a borda usa. */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 47_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: 'contato@exemplo.com.br',
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
 * Semeia, **pelas portas de produção**, uma cobrança com boleto emitido para a empresa dada.
 *
 * Nenhuma instrução crua: conjunto, imóvel, pessoas, contrato, cobrança e boleto nascem das mesmas
 * funções que a borda chama por dentro. É o que impede o arranjo de montar um estado que a operação
 * não alcança — e, aqui, importa em particular que `identificador_no_provedor` seja gravado por
 * `gravarBoletoDaCobranca`, que é quem o grava em produção.
 *
 * As duas chaves do provedor são **distintas entre si e entre as empresas**: valores repetidos
 * deixariam passar duas colunas trocadas, e é justamente a distinção entre as duas empresas que a
 * perna (c) mede.
 */
async function semearCobrancaComBoleto(empresaId: string, marca: string): Promise<CobrancaSemeada> {
  const cadastros = await emUnidade(empresaId, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });

    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-ROTEAMENTO-${marca}`,
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
    });

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  // As duas unidades sequenciais da série (ADR-0020): a primeira garante o contador e commita, a
  // segunda emite o número e grava. Fundi-las é o desenho que aquela ADR recusa.
  const anoDoContrato = await emUnidade(empresaId, lerAnoDaSerieDeContrato);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });

  const contrato = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        dataInicioLocacao: '2026-01-15',
        prazoMeses: 12,
        valorMensal: 1500,
        diaVencimento: 10,
        gerarCobrancasAutomaticamente: false,
      },
      { ano: anoDoContrato, numero },
    );
  });

  const anoDaCobranca = await emUnidade(empresaId, lerAnoDaSerieDeCobranca);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  const cobranca = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel de janeiro/2026 (${marca})`,
        competencia: '2026-01-01',
        dataVencimento: '2026-01-10',
        valorOriginal: 1500,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  const identificadorNoProvedor = `20260800000000000${marca}`;
  const numeroDoTituloNoProvedor = `0000000000012345${marca}`;

  await emUnidade(empresaId, async (tx) => {
    await gravarBoletoDaCobranca(tx, cobranca.codigo, {
      numeroDoTituloNoProvedor,
      linhaDigitavel: `75690.00001 00000.0000${marca}0 00000.000000 1 00000000200000`,
      codigoDeBarras: `7569100000000020000000001000000000000000000${marca}`,
      identificadorNoProvedor,
      caminhoDoArquivo: `boletos/2026/${cobranca.codigo}.pdf`,
    });
  });

  const [cobrancaId] = await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ id: string }[]>`
      SELECT id FROM negocio.cobranca WHERE codigo = ${cobranca.codigo}
    `;
    return [linha?.id];
  });

  if (cobrancaId === undefined) {
    throw new Error(`o arranjo não conseguiu ler o identificador da cobrança ${cobranca.codigo}`);
  }

  return {
    empresaId,
    codigo: cobranca.codigo,
    cobrancaId,
    identificadorNoProvedor,
    numeroDoTituloNoProvedor,
  };
}

/**
 * Chama a função **pelo papel de aplicação e sem contexto algum** — o estado exato de uma conexão
 * que ninguém preparou, e o que a borda da notícia terá em mãos.
 *
 * `SELECT *`, e não as quatro colunas nomeadas: é o `*` que permite afirmar o **conjunto** de colunas
 * devolvidas. Nomeá-las na consulta faria o caso pedir exatamente o que espera e ficar cego a uma
 * quinta.
 */
async function rotearCruSemContexto(identificador: string): Promise<Record<string, unknown>[]> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const linhas = await sql<Record<string, unknown>[]>`
      SELECT * FROM negocio.rotear_notificacao_bancaria(${identificador})
    `;
    return linhas.map((linha) => ({ ...linha }));
  } finally {
    await sql.end();
  }
}

/** A mesma chamada, **pela porta de produção** — é ela que a tarefa da Fase 2 vai consumir. */
async function rotearPelaPorta(identificador: string) {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [linha] = await sql.begin(async (tx) => [
      await rotearNotificacaoBancaria(tx, identificador),
    ]);
    return linha;
  } finally {
    await sql.end();
  }
}

/** Quantas cobranças a leitura DIRETA alcança, com o contexto dado ou sem nenhum. */
async function contarCobrancas(empresaId: string | null): Promise<number> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });
  try {
    const [total] = await sql.begin(async (tx) => {
      if (empresaId !== null) {
        await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      }
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*)::text AS total FROM negocio.cobranca
      `;
      return [Number(linha?.total ?? '-1')];
    });
    return total ?? -1;
  } finally {
    await sql.end();
  }
}

/** O mecanismo inteiro, tal como o catálogo o guarda — função, privilégio, política e papel. */
interface RetratoDoMecanismo {
  readonly funcao: {
    readonly parametros: number;
    readonly volatilidade: string;
    readonly definidoPeloDono: boolean;
    readonly configuracao: readonly string[];
    readonly dono: string;
  };
  readonly executaPublic: boolean;
  readonly executaAplicacao: boolean;
  readonly politicas: readonly string[];
  readonly papel: {
    readonly conecta: boolean;
    readonly superusuario: boolean;
    readonly contornaPolitica: boolean;
    readonly usaSchema: boolean;
    readonly criaNoSchema: boolean;
    readonly leCobranca: boolean;
    readonly escreveCobranca: boolean;
    readonly leOutraTabela: boolean;
    readonly tabelasDeQueEhDono: number;
  };
}

/**
 * Lê do catálogo as peças de que a travessia depende, para afirmá-las numa igualdade só.
 *
 * Elas estão juntas de propósito: separadas, cada uma seria uma asserção de catálogo do tipo que já
 * ficou verde sobre uma função morta (ver o cabeçalho). Aqui elas vêm DEPOIS das pernas
 * comportamentais, e o que fazem é nomear QUAL peça caiu quando o comportamento cair.
 *
 * `has_function_privilege` é consultado para `public` e para `sysloc_app` **separadamente**: é a
 * leitura efetiva do `proacl`, e ela responde à pergunta que importa — *quem pode executar* —, ao
 * contrário de comparar o texto da lista de controle, que muda de forma entre versões do servidor.
 */
async function retratoDoMecanismo(): Promise<RetratoDoMecanismo> {
  const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: RESERVA_DE_UMA });

  try {
    const [funcao] = await sql<
      {
        parametros: number;
        volatilidade: string;
        definidoPeloDono: boolean;
        configuracao: string[] | null;
        dono: string;
      }[]
    >`
      SELECT p.pronargs                     AS parametros,
             p.provolatile::text            AS volatilidade,
             p.prosecdef                    AS "definidoPeloDono",
             p.proconfig                    AS configuracao,
             pg_get_userbyid(p.proowner)    AS dono
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'negocio' AND p.proname = 'rotear_notificacao_bancaria'
    `;

    const [privilegio] = await sql<{ executaPublic: boolean; executaAplicacao: boolean }[]>`
      SELECT has_function_privilege(
               'public', 'negocio.rotear_notificacao_bancaria(text)', 'EXECUTE') AS "executaPublic",
             has_function_privilege(
               ${PAPEL_APLICACAO}, 'negocio.rotear_notificacao_bancaria(text)', 'EXECUTE')
                                                                                AS "executaAplicacao"
    `;

    // As políticas da tabela, inteiras: nome, comando, papéis alcançados e as duas expressões. É a
    // lista que CRESCEU nesta migração, e ela é cobrada por igualdade — uma terceira política, ou um
    // `TO` alargado para `public`, aparece como diferença literal.
    const politicas = await sql<{ linha: string }[]>`
      SELECT policyname || ' | ' || cmd || ' | ' || array_to_string(roles, ',') ||
             ' | usando=' || coalesce(qual, '(nenhum)') ||
             ' | checando=' || coalesce(with_check, '(nenhum)') AS linha
        FROM pg_catalog.pg_policies
       WHERE schemaname = 'negocio' AND tablename = 'cobranca'
       ORDER BY policyname
    `;

    const [papel] = await sql<
      {
        conecta: boolean;
        superusuario: boolean;
        contornaPolitica: boolean;
        usaSchema: boolean;
        criaNoSchema: boolean;
        leCobranca: boolean;
        escreveCobranca: boolean;
        leOutraTabela: boolean;
        tabelasDeQueEhDono: string;
      }[]
    >`
      SELECT r.rolcanlogin  AS conecta,
             r.rolsuper     AS "superusuario",
             r.rolbypassrls AS "contornaPolitica",
             has_schema_privilege(${PAPEL_ROTEAMENTO}, 'negocio', 'USAGE')  AS "usaSchema",
             has_schema_privilege(${PAPEL_ROTEAMENTO}, 'negocio', 'CREATE') AS "criaNoSchema",
             has_table_privilege(${PAPEL_ROTEAMENTO}, 'negocio.cobranca', 'SELECT') AS "leCobranca",
             has_table_privilege(${PAPEL_ROTEAMENTO}, 'negocio.cobranca', 'UPDATE')
                                                                            AS "escreveCobranca",
             has_table_privilege(${PAPEL_ROTEAMENTO}, 'negocio.contrato', 'SELECT')
                                                                            AS "leOutraTabela",
             (SELECT count(*)::text FROM pg_tables
               WHERE schemaname = 'negocio' AND tableowner = ${PAPEL_ROTEAMENTO})
                                                                            AS "tabelasDeQueEhDono"
        FROM pg_catalog.pg_roles r
       WHERE r.rolname = ${PAPEL_ROTEAMENTO}
    `;

    if (funcao === undefined || privilegio === undefined || papel === undefined) {
      throw new Error(
        'o catálogo não devolveu a função `rotear_notificacao_bancaria` ou o papel ' +
          `'${PAPEL_ROTEAMENTO}' — sem eles este caso não teria o que examinar`,
      );
    }

    return {
      funcao: {
        parametros: funcao.parametros,
        volatilidade: funcao.volatilidade,
        definidoPeloDono: funcao.definidoPeloDono,
        configuracao: funcao.configuracao ?? [],
        dono: funcao.dono,
      },
      executaPublic: privilegio.executaPublic,
      executaAplicacao: privilegio.executaAplicacao,
      politicas: politicas.map((politica) => politica.linha),
      papel: {
        conecta: papel.conecta,
        superusuario: papel.superusuario,
        contornaPolitica: papel.contornaPolitica,
        usaSchema: papel.usaSchema,
        criaNoSchema: papel.criaNoSchema,
        leCobranca: papel.leCobranca,
        escreveCobranca: papel.escreveCobranca,
        leOutraTabela: papel.leOutraTabela,
        tabelasDeQueEhDono: Number(papel.tabelasDeQueEhDono),
      },
    };
  } finally {
    await sql.end();
  }
}

/** A expressão de isolamento por empresa, tal como as migrações de segurança a escrevem. */
const EXPRESSAO_DE_ISOLAMENTO =
  "(empresa_id = (NULLIF(current_setting('app.empresa_id'::text, true), ''::text))::uuid)";

describe('CT-973 — `negocio.rotear_notificacao_bancaria` roteia sem receber empresa', () => {
  beforeAll(async () => {
    banco = await bancoEfemero();
    acesso = abrirAcessoAoBanco({ cadeiaDeConexao: banco.cadeiaConexao });
    daEmpresaA = await semearCobrancaComBoleto(EMPRESA_A.id, 'A');
    daEmpresaB = await semearCobrancaComBoleto(EMPRESA_B.id, 'B');
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await acesso?.encerrar();
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-973 — sem contexto, a função devolve a linha da empresa dona, com as quatro colunas; a política direta continua fechada',
    async () => {
      // --- (b) A política continua fechada para a leitura direta ------------------------------
      expect(await contarCobrancas(null)).toBe(0);

      // …e as linhas existem — sem isto, a asserção acima seria vácuo.
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(1);
      expect(await contarCobrancas(EMPRESA_B.id)).toBe(1);

      // --- (a) A travessia, e o conjunto de colunas -------------------------------------------
      const linhasDeA = await rotearCruSemContexto(daEmpresaA.identificadorNoProvedor);

      // Igualdade sobre a linha inteira, e não `toHaveLength(1)`: o que a borda sem sessão precisa é
      // do `empresa_id` CERTO — um caso que só contasse linhas ficaria verde diante de uma função
      // que devolvesse a cobrança de outra empresa.
      expect(linhasDeA).toEqual([
        {
          empresa_id: EMPRESA_A.id,
          cobranca_id: daEmpresaA.cobrancaId,
          codigo: daEmpresaA.codigo,
          numero_do_titulo_no_provedor: daEmpresaA.numeroDoTituloNoProvedor,
        },
      ]);

      // O conjunto de colunas, por igualdade e com controle antivácuo — a propriedade 2 da §7.3.
      const colunas = Object.keys(linhasDeA[0] ?? {}).sort();
      expect(colunas.length).toBe(COLUNAS_DO_ROTEAMENTO.length);
      expect(colunas).toEqual(COLUNAS_DO_ROTEAMENTO);

      // --- (c) O identificador de B devolve a linha de B ---------------------------------------
      //
      // Sem esta perna, uma função que devolvesse sempre a primeira linha da tabela passaria em (a).
      expect(await rotearCruSemContexto(daEmpresaB.identificadorNoProvedor)).toEqual([
        {
          empresa_id: EMPRESA_B.id,
          cobranca_id: daEmpresaB.cobrancaId,
          codigo: daEmpresaB.codigo,
          numero_do_titulo_no_provedor: daEmpresaB.numeroDoTituloNoProvedor,
        },
      ]);

      // --- A porta de produção devolve o mesmo, em camelCase -----------------------------------
      //
      // Ela é o SUT que a Fase 2 consome; a consulta crua acima existe para ver o conjunto de
      // colunas, que a porta necessariamente esconde ao projetar.
      expect(await rotearPelaPorta(daEmpresaA.identificadorNoProvedor)).toEqual({
        empresaId: EMPRESA_A.id,
        cobrancaId: daEmpresaA.cobrancaId,
        codigo: daEmpresaA.codigo,
        numeroDoTituloNoProvedor: daEmpresaA.numeroDoTituloNoProvedor,
      });

      // --- (d) O companheiro negativo: sem correspondência é vazio, e não erro ------------------
      expect(await rotearCruSemContexto(IDENTIFICADOR_INEXISTENTE)).toEqual([]);
      expect(await rotearPelaPorta(IDENTIFICADOR_INEXISTENTE)).toBeUndefined();

      // --- (e) O mecanismo, pelo catálogo, para NOMEAR a peça quando ela cair -------------------
      //
      // Igualdade sobre o retrato inteiro. As duas políticas aparecem como lista, e é ela que
      // cresceu: a de isolamento por empresa continua `ALL` para `public`, com `USING` e
      // `WITH CHECK` idênticos, e a nova alcança **um papel só**, em `SELECT`. Alargar o `TO` para
      // `public`, ou dar-lhe `ALL`, aparece como diferença literal — e seria o furo real, porque
      // `USING (true)` fora de um papel nominal é a política de isolamento desligada.
      expect(await retratoDoMecanismo()).toEqual({
        funcao: {
          // UM parâmetro: com um segundo, de empresa, pedir roteamento em nome de uma empresa
          // voltaria a ser representável — que é o que a ADR-0024 fecha.
          parametros: 1,
          // `s` é `STABLE`: ela apenas lê, e não avança contador algum.
          volatilidade: 's',
          definidoPeloDono: true,
          configuracao: ['search_path=pg_catalog, pg_temp'],
          // O dono é a METADE da travessia que `SECURITY DEFINER` não dá sozinho.
          dono: PAPEL_ROTEAMENTO,
        },
        // `EXECUTE` revogado de `PUBLIC` e concedido nominalmente. O segundo é o companheiro
        // POSITIVO do primeiro: sem ele, "PUBLIC não executa" também seria verdade sobre uma função
        // que ninguém pode chamar — e as pernas comportamentais acima estariam impossíveis.
        executaPublic: false,
        executaAplicacao: true,
        politicas: [
          `cobranca_isolamento_empresa | ALL | public | usando=${EXPRESSAO_DE_ISOLAMENTO} | checando=${EXPRESSAO_DE_ISOLAMENTO}`,
          `cobranca_roteamento_sem_contexto | SELECT | ${PAPEL_ROTEAMENTO} | usando=true | checando=(nenhum)`,
        ],
        papel: {
          // Ele não conecta e não contorna política nenhuma: a travessia é NOMINAL, dada pela
          // política acima, e não um `BYPASSRLS` disfarçado — que é o que a ADR-0008 rejeita.
          conecta: false,
          superusuario: false,
          contornaPolitica: false,
          // O privilégio de estado final: `USAGE` no schema e `SELECT` em UMA tabela. O `CREATE`
          // que o `ALTER … OWNER` exige é emprestado e devolvido dentro da própria `0020`, e é esta
          // linha que prova a devolução. `leOutraTabela` é o que mede *"a única tabela alcançada"*
          // da emenda da ADR-0024 — sem ele, o `GRANT` teria podido ser `ON ALL TABLES`.
          usaSchema: true,
          criaNoSchema: false,
          leCobranca: true,
          escreveCobranca: false,
          leOutraTabela: false,
          tabelasDeQueEhDono: 0,
        },
      } satisfies RetratoDoMecanismo);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-973 (f) — sem o papel `sysloc_roteamento`, a migração aborta nomeando o passo P15 do provisionamento',
    async () => {
      const erro = await erroAoMigrarSemPapelDeRoteamento();

      // As três agulhas, cada uma fechando um modo de falha diferente da mensagem: o ARQUIVO da
      // migração que recusou, o PAPEL que falta, e o PASSO que o cria. Uma recusa que dissesse
      // apenas "permission denied" satisfaria "houve erro" e deixaria quem lê sem o que fazer.
      expect(erro.message).toContain('0020_seguranca_webhook_e_carne.sql');
      expect(erro.message).toContain(PAPEL_ROTEAMENTO);
      expect(erro.message).toContain('P15');
      expect(erro.message).toContain('provisionar-base.sh');
    },
    LIMITE_DA_MIGRACAO_MS,
  );
});
