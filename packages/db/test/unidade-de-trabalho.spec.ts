/**
 * Unidade de trabalho — vazamento entre requisições, validação do contexto e superfície do pacote.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-01    | CT-010 | A unidade de trabalho FIXA `app.empresa_id` em toda abertura, e o valor
 * | CA-02    |        | fixado morre com a transação: numa unidade aberta sobre a MESMA conexão
 * |          |        | física, o valor lido não é o da unidade anterior NEM um resíduo deixado em
 * |          |        | nível de sessão, e a leitura de negócio reflete o contexto novo. |
 * | CA-02    | CT-011 | A unidade de trabalho valida o identificador como UUID antes de compô-lo na
 * |          |        | instrução `SET LOCAL` (que não aceita parâmetro vinculado); valor que não
 * |          |        | seja UUID levanta erro nomeado e NENHUMA instrução chega ao servidor. |
 * | CA-02    | CT-012 | O índice público de `@sysloc/db` expõe um conjunto fechado e conhecido de
 * |          |        | símbolos — ACHATADO um nível, porque o índice reexporta namespaces — no
 * |          |        | qual não há cliente, reserva de conexões nem executor cru; e o OBJETO que
 * |          |        | cada fábrica de acesso devolve também não o carrega, em nenhuma das suas
 * |          |        | propriedades nem nas propriedades delas. |
 * | CA-02    | CT-013 | Unidade de trabalho aberta de dentro de outra é RECUSADA com erro nomeado,
 * |          |        | antes de reservar conexão; a unidade sequencial seguinte segue valendo. |
 * | CA-20    | CT-210 | Toda operação que altere o perfil ou os ajustes de uma pessoa incrementa
 * | CA-21    |        | `identidade.usuario.versao_permissoes` EXATAMENTE UMA VEZ, na MESMA
 * |          |        | transação da escrita em `negocio` — de modo que o desfazimento da unidade
 * |          |        | de trabalho apaga as duas pontas juntas. Operação recusada não deixa o
 * |          |        | contador incrementado nem linha gravada, e escrita que não toca permissão
 * |          |        | (o nome da pessoa) deixa o contador onde estava. |
 * | CA-02    | CT-014 | O escritor do contexto de tenant (`contextoDeTenant.executarCom`) é chamado
 * |          |        | em exatamente o conjunto declarado de arquivos de produção — exatamente um
 * |          |        | desde a T9, a guarda de CONTEXTO de `apps/api` (`GuardaDeContexto`).
 * |          |        | Qualquer outro chamador reprova. |
 * | CA-03    | CT-310 | A recusa da restrição de unicidade do identificador municipal desfaz **só a
 * | CA-02    | (c)    | instrução recusada**: numa unidade de trabalho ÚNICA, o conjunto e o imóvel
 * |          |        | gravados antes dela sobrevivem, a unidade segue utilizável depois da recusa
 * |          |        | (a leitura que discrimina o conflito corre nela) e o COMMIT preserva os
 * |          |        | dois — enquanto o imóvel recusado não nasce. |
 *
 * | CA-02    | CT-326 | O conjunto de arquivos de PRODUÇÃO que **abrem** unidade de trabalho
 * |          |        | (`emUnidadeDeTrabalho(…)`) é exatamente o conjunto declarado das bordas —
 * |          |        | a guarda de contexto, o ponto único do domínio de locação
 * |          |        | (`sobContextoDaSessao`) e os dois chamadores já legítimos da F1. Nenhum
 * |          |        | serviço abre unidade própria, e qualquer arquivo novo que passe a abrir
 * |          |        | aparece nomeado como excedente. |
 *
 * Rastreabilidade acrescida pela T6 da fatia `cadastro-de-imoveis-e-pessoas`:
 * `CA-03 → CT-310 (c) (RN-03)`. Pela T11 da mesma fatia: `CA-02 → CT-326 (RN-03)`.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * Nenhuma constrói o estado sob teste. Os casos observam pelo **boundary real**, sem instrumentar
 * o alvo:
 *
 *   * o CT-010 lê `pg_backend_pid()` por consulta comum, de dentro da própria unidade de trabalho.
 *     A quarta unidade usa uma conexão crua (`abrirConexao`) apenas como **observatório** de um
 *     comportamento do servidor — que `SET` sem `LOCAL` sobrevive ao `COMMIT` —, controle sem o
 *     qual a asserção da unidade seguinte seria vazia. O dado do caso continua vindo todo de
 *     `abrirAcessoAoBanco`;
 *   * o CT-011 interpõe uma **sentinela de porta** entre o cliente e o servidor e conta o que
 *     efetivamente trafegou — o mesmo padrão de `apps/api/test/saude.e2e.spec.ts`. Nenhum contador,
 *     gancho ou bandeira foi acrescentado a `packages/db/src/unidade-de-trabalho.ts` para que isso
 *     fosse observável;
 *   * o CT-012 resolve o pacote pelo **especificador público**, num processo Node de verdade, como
 *     um consumidor externo o resolveria — imitando `packages/shared/test/superficie-publica.spec.ts`.
 *     O eixo do OBJETO DEVOLVIDO abre os acessos pela fábrica pública, contra a instância efêmera,
 *     e inspeciona o valor que um consumidor teria em mãos — sem instrumentar `src/` em nada;
 *   * o CT-013 exercita o aninhamento pela API pública, com reserva de DUAS conexões — para que a
 *     recusa seja atribuível à guarda, e não ao esgotamento da reserva;
 *   * o CT-014 é asserção ESTÁTICA sobre o fonte de produção e, por
 *     `.claude/rules/testing-stack.md`, carrega prova de falsificação com as duas pernas;
 *   * o CT-326 é a irmã do CT-014 um símbolo adiante — ESTÁTICA pela mesma razão, com as mesmas
 *     duas pernas, e sobre a mesma fonte descoberta no disco. Ele não instrumenta nada: o que
 *     observa é o texto do fonte de produção, e a cópia defeituosa é escrita em diretório temporário
 *     e removida no `finally`;
 *   * o CT-210 cruza as duas fronteiras de schema — o ajuste em `negocio` (sob RLS forçada) e o
 *     contador em `identidade` (sem RLS) — pela **unidade de trabalho publicada**, com o contexto
 *     escrito por `contextoDeTenant.executarCom`. Nunca por duas conexões: é exatamente a
 *     atomicidade entre as duas que o caso existe para provar, e duas conexões a perderiam em
 *     silêncio. A regra de coerência do domínio entra por parâmetro, como em produção (ver o
 *     comentário do caso); nenhum símbolo foi acrescentado a `packages/db/src/**` para o caso
 *     existir;
 *   * o CT-310 (c) monta todo o estado pelas funções públicas da porta (`criarConjunto`,
 *     `criarImovel`), sob `contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho` — o mesmo par
 *     da operação. Nenhuma conexão privilegiada, nenhum `INSERT` escrito no caso, e a recusa vem da
 *     restrição do banco, nunca de uma bandeira. Ver a nota logo acima do caso para a razão de ele
 *     morar neste arquivo.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { connect, createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirAcessoAIdentidade } from '../src/acesso-identidade.ts';
import { abrirConexao } from '../src/conexao.ts';
import { criarConjunto, localizarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { empresa } from '../src/esquema/identidade.ts';
import {
  criarImovel,
  type DadosDoImovel,
  ErroDeIdentificadorMunicipalEmUso,
  listarImoveis,
} from '../src/imovel.ts';
import {
  type AjustePersistido,
  escreverAjustes,
  type PerfilDaPessoa,
  trocarPerfilDaPessoa,
} from '../src/permissao.ts';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  EMPRESA_A,
  EMPRESA_B,
  USUARIOS,
} from '../src/semente.ts';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  ErroDeContextoInvalido,
  ErroDeUnidadeAninhada,
} from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { listarFontesTs, type VarreduraDeFontes, varrerArquivos } from './varredura-de-fontes.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas consultas ou um subprocesso curto; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Endereço de retorno — o único em que a instância efêmera escuta. */
const HOSPEDEIRO = '127.0.0.1';

const IDENTIFICADORES_DE_A = ACESSOS_DA_EMPRESA_A.map((acesso) => acesso.id);
const IDENTIFICADORES_DE_B = ACESSOS_DA_EMPRESA_B.map((acesso) => acesso.id);

const CONSULTA_ACESSOS = 'SELECT id FROM negocio.acesso_usuario_app ORDER BY id';

const CONSULTA_DA_UNIDADE =
  "SELECT pg_backend_pid() AS pid, current_setting('app.empresa_id', true) AS bruto";

function ordenado(valores: readonly string[]): string[] {
  return [...valores].sort();
}

// ===========================================================================
// CT-010 — o contexto não sobrevive à transação que o fixou
// ===========================================================================

interface ObservacaoDaUnidade {
  readonly pid: number;
  readonly bruto: string | null;
  readonly acessos: readonly string[];
}

async function observarUnidade(acesso: AcessoAoBanco): Promise<ObservacaoDaUnidade> {
  return acesso.emUnidadeDeTrabalho(async (tx) => {
    const [cabecalho] =
      await tx.unsafe<{ pid: number; bruto: string | null }[]>(CONSULTA_DA_UNIDADE);
    const linhas = await tx.unsafe<{ id: string }[]>(CONSULTA_ACESSOS);
    return {
      pid: Number(cabecalho?.pid ?? -1),
      bruto: cabecalho?.bruto ?? null,
      acessos: linhas.map((linha) => linha.id),
    };
  });
}

// ===========================================================================
// CT-011 — sentinela de porta: o que de fato trafegou entre cliente e servidor
// ===========================================================================

interface Sentinela {
  readonly porta: number;
  /** Quantas conexões de cliente foram aceitas desde a abertura. */
  conexoesAceitas(): number;
  /** Quantas vezes o texto apareceu no fluxo cliente → servidor. */
  ocorrenciasDe(texto: string): number;
  parar(): Promise<void>;
}

/**
 * Interpõe uma sentinela entre o cliente e o servidor.
 *
 * O que ela observa é o tráfego real: se a unidade de trabalho recusa o contexto antes de compor a
 * instrução, o cliente sequer abre conexão — e `conexoesAceitas() === 0` é uma afirmação que nenhum
 * detalhe interno do alvo consegue satisfazer por acaso.
 */
async function abrirSentinela(portaDeDestino: number): Promise<Sentinela> {
  let conexoes = 0;
  const capturado: Buffer[] = [];
  const abertos = new Set<Socket>();

  const servidor = createServer((doCliente) => {
    conexoes += 1;
    const paraOServidor = connect({ host: HOSPEDEIRO, port: portaDeDestino });
    abertos.add(doCliente);
    abertos.add(paraOServidor);

    doCliente.on('data', (pedaco: Buffer) => capturado.push(pedaco));
    doCliente.pipe(paraOServidor);
    paraOServidor.pipe(doCliente);

    const encerrar = (): void => {
      doCliente.destroy();
      paraOServidor.destroy();
    };
    doCliente.on('error', encerrar);
    paraOServidor.on('error', encerrar);
    doCliente.on('close', encerrar);
  });

  await new Promise<void>((resolver, rejeitar) => {
    servidor.once('error', rejeitar);
    servidor.listen(0, HOSPEDEIRO, resolver);
  });

  const endereco = servidor.address();
  if (endereco === null || typeof endereco === 'string') {
    throw new Error('a sentinela não recebeu porta TCP');
  }

  return {
    porta: endereco.port,
    conexoesAceitas: () => conexoes,
    ocorrenciasDe: (texto) => {
      // `latin1` preserva a correspondência byte a byte com o texto ASCII da instrução, sem que
      // uma fronteira de multibyte no meio de um pacote invente ou destrua uma ocorrência.
      const fluxo = Buffer.concat(capturado).toString('latin1');
      return fluxo.split(texto).length - 1;
    },
    parar: async () => {
      for (const socket of abertos) {
        socket.destroy();
      }
      await new Promise<void>((resolver) => servidor.close(() => resolver()));
    },
  };
}

/** Reescreve a cadeia de conexão para passar pela sentinela, preservando credencial e banco. */
function pelaSentinela(cadeiaDeConexao: string, porta: number): string {
  const endereco = new URL(cadeiaDeConexao);
  endereco.hostname = HOSPEDEIRO;
  endereco.port = String(porta);
  return endereco.toString();
}

/**
 * Quatro valores que não são UUID, incluindo a tentativa de injeção — e o de controle.
 *
 * O par com o controle é obrigatório: um validador que recusasse TUDO passaria o eixo negativo
 * inteiro e quebraria a operação.
 */
const VALORES_INVALIDOS = [
  '',
  'nao-e-uuid',
  `${EMPRESA_A.id}'; DROP TABLE negocio.acesso_usuario_app; --`,
  '11111111-1111-4111-8111-11111111111',
] as const;

const INSTRUCAO_DE_FIXACAO = 'SET LOCAL app.empresa_id';

// ===========================================================================
// CT-012 — superfície pública do pacote
// ===========================================================================

const RAIZ_DO_PACOTE = dirname(import.meta.dirname);
const ESPECIFICADOR_PUBLICO = '@sysloc/db';

/**
 * O conjunto fechado, **achatado um nível**. Igualdade, e não contenção: contenção deixaria passar
 * o export acrescentado por descuido, que é exatamente o defeito que este caso existe para pegar.
 *
 * O achatamento não é refinamento estético — é o que torna a frase acima verdadeira. O índice usa
 * `export * as …` três vezes, e um conjunto de nomes de TOPO veria cada namespace como UM nome:
 * todo símbolo acrescentado a `contexto.ts` ou a `esquema/*.ts` entraria na superfície pública sem
 * mudar o conjunto, e um `export const sql = postgres(…)` dentro de qualquer um deles passaria
 * pelos dois eixos do caso — o do conjunto e o das marcas de cliente, que eram procuradas só no
 * valor de topo.
 *
 * Exceção declarada: `semear` é dado de carga inicial, não acesso a dado. Ele está aqui porque hoje
 * é o caminho real de povoamento (não há rotas de administração, §4.1 do PRD) e o Gate 1 o anotou
 * como tensionando o aceite 1; a resolução está no débito **D4**, não neste conjunto.
 */
const SIMBOLOS_ESPERADOS = [
  'ACESSOS_DA_EMPRESA_A',
  'ACESSOS_DA_EMPRESA_B',
  'EMPRESAS',
  'EMPRESA_A',
  'EMPRESA_B',
  'ErroDeContextoInvalido',
  // T7 da fatia `autorizacao-e-ciclo-de-acesso` — as OITO operações do ciclo de vida da empresa,
  // ordenadas no conjunto pela posição de cada nome (a comparação é sobre a lista ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a correção da T7 publica oito símbolos novos no índice por decisão
  // declarada — a Revisão Técnica mediu que as nove instruções sobre `identidade` que viviam em
  // `apps/api/src/master/empresa.service.ts` tornavam o alcance às sete tabelas daquele schema
  // **não enumerável**, porque a contenção da §11.2 é de tipo e não alcança texto de SQL. Movê-las
  // para `packages/db/src/empresa.ts` é o que devolve a enumerabilidade, e publicá-las é o preço.
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Elas entram pelo mesmo critério das quatro de `permissao.js`: **recebem** o executor de quem já
  // abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem executor. Os tipos
  // que publicam (`AlvoDeReemissao`, `EmpresaNova`, `EmpresaPersistida`, `JanelaDeEmpresas`,
  // `MarcaDeSuspensao`, `PaginaDeEmpresasPersistidas`) não aparecem aqui porque não existem em
  // tempo de execução, e este caso observa o módulo carregado.
  'admitirEmpresa',
  'encerrarSessoesDaEmpresa',
  'lerAlvoDeReemissao',
  'listarEmpresas',
  'localizarEmpresa',
  'localizarPessoaPorEmail',
  'reativarEmpresa',
  'suspenderEmpresa',
  // T3 da fatia `autorizacao-e-ciclo-de-acesso` — a recusa de escrita de permissão para pessoa cujo
  // vínculo o contexto corrente não alcança. Entra pelo mesmo critério de `ErroDeUnidadeAninhada`:
  // é classe de erro, não caminho para dado.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica cinco símbolos novos no índice por decisão declarada na
  // §5.2 da task. O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido —
  // que é o defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não
  // conhecia. Nenhuma entrada anterior sai, e a igualdade (nunca contenção) segue sendo asserida.
  'ErroDePessoaForaDoContexto',
  'ErroDeUnidadeAninhada',
  // T5 da fatia `cadastro-de-imoveis-e-pessoas` — as CINCO operações do ciclo de vida do conjunto,
  // ordenadas no conjunto pela posição de cada nome (a comparação é sobre a lista ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica cinco símbolos novos no índice por decisão declarada na
  // §5.2 da task. O critério é o mesmo das quatro de `permissao.js`, das oito de `empresa.js` e das
  // seis de `pessoa.js`: elas **recebem** o executor de quem já abriu a unidade de trabalho, não
  // abrem conexão, não reservam e não devolvem executor. Elas existem para que o alcance a
  // `negocio.conjunto` seja enumerável — a contenção da §11.2 é de tipo e não alcança texto de SQL —
  // e para que o **predicado de circulação da ADR-0014** tenha um lugar só, aplicado por padrão, em
  // vez de ser reescrito por cada listagem que venha a existir.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`ConjuntoPersistido`, `DadosDoConjunto`, `JanelaDeConjuntos`,
  // `OpcoesDeCirculacao`, `PaginaDeConjuntosPersistidos`) não aparecem aqui porque não existem em
  // tempo de execução, e este caso observa o módulo carregado.
  'alterarConjunto',
  'criarConjunto',
  'definirCirculacaoDoConjunto',
  'listarConjuntos',
  'localizarConjunto',
  // T6 da fatia `cadastro-de-imoveis-e-pessoas` — as CINCO operações do ciclo de vida do imóvel,
  // mais a classe de erro que a tradução da unicidade publica.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T6 publica seis símbolos novos no índice por decisão declarada na
  // §5.2 da task. As cinco operações entram pelo critério de sempre — **recebem** o executor de quem
  // já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem executor —, com
  // uma razão a mais, própria desta entidade: a **tradução da violação de unicidade** exige ler o
  // estado do registro em conflito depois da recusa, de dentro da mesma transação e atrás de um
  // `SAVEPOINT`, o que só é possível de dentro do pacote.
  //
  // `ErroDeIdentificadorMunicipalEmUso` entra pelo MESMO critério de `ErroDeUnidadeAninhada` e de
  // `ErroDePessoaForaDoContexto`: é classe de erro, não caminho para dado. Ela precisa sair daqui
  // porque quem a traduz no envelope da ADR-0017 é `apps/api/src/imoveis/imovel.service.ts`, e a
  // alternativa — reconhecer a recusa pelo texto da mensagem — amarraria a borda ao idioma do
  // servidor.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`ConflitoDeIdentificador`, `DadosDoImovel`, `ImovelPersistido`,
  // `JanelaDeImoveis`, `PaginaDeImoveisPersistidos`) não aparecem aqui porque não existem em tempo
  // de execução, e este caso observa o módulo carregado.
  'ErroDeIdentificadorMunicipalEmUso',
  'alterarImovel',
  'criarImovel',
  'definirCirculacaoDoImovel',
  'listarImoveis',
  'localizarImovel',
  // T7 da fatia `cadastro-de-imoveis-e-pessoas` — as TRÊS escritas do cômodo, mais a soma da
  // metragem.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T7 publica quatro símbolos novos no índice por decisão declarada na
  // §5.2 da task. As três escritas entram pelo critério de sempre — **recebem** o executor de quem
  // já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem executor —, com
  // uma razão a mais, própria desta entidade: a **atribuição de posição** (`max(posicao) + 1`)
  // acontece dentro da própria instrução de gravação, e escrevê-la fora do pacote reabriria a
  // janela de corrida que ela existe para não ter.
  //
  // `somarMetragem` entra por critério diferente das demais, e é o que a torna admissível: ela é
  // função **pura** sobre os cômodos já lidos — não recebe executor, não toca banco e não é caminho
  // para dado nenhum. Ela é publicada porque é a materialização do *ponto único de soma* que a
  // decisão D2 do tech_spec exige, e ter o ponto com nome é o que torna a afirmação verificável: uma
  // segunda soma apareceria como um segundo símbolo, e não como uma linha escondida numa consulta.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `lerComodosDeImoveis`, consumida por
  // `src/imovel.ts` para montar o agregado. Publicá-la ofereceria a `apps/api` um caminho para ler
  // cômodo **sem** passar pelo imóvel — que é justamente o que o contrato recusa, já que não há rota
  // de leitura de cômodo. `empresaDoContexto`, de `src/contexto-de-escrita.ts`, fica fora pelo mesmo
  // critério: é fragmento de SQL, e publicá-lo daria à borda um pedaço de instrução para compor.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`ComodoPersistido`, `DadosDoComodo`) não aparecem aqui porque não
  // existem em tempo de execução, e este caso observa o módulo carregado.
  'acrescentarComodo',
  'alterarComodo',
  'removerComodo',
  'somarMetragem',
  // T8 da fatia `cadastro-de-imoveis-e-pessoas` — as CINCO operações do ciclo de vida dos três
  // cadastros de pessoa, mais a união fechada dos papéis.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T8 publica seis símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados`). As cinco operações entram pelo critério de sempre —
  // **recebem** o executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e
  // não devolvem executor —, com uma razão a mais, própria destas três entidades: o **papel é
  // parâmetro**, e publicar UMA porta para os três é o que impede a borda de escolher a tabela por
  // conta própria.
  //
  // `PAPEIS_DE_PESSOA` entra por critério diferente das demais, e é o que o torna admissível: é a
  // união fechada dos papéis, declaração de vocabulário e não caminho para dado — mesmo critério de
  // `esquemaNegocio.tipoPessoa`. Ele precisa sair daqui porque é com ele que cada controlador da T9
  // fixa o próprio papel, sem redigitar os três nomes.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `TABELA_POR_PAPEL`, a declaração interna
  // da parametrização. Publicá-lo daria a `apps/api` o nome físico da tabela, que é justamente o que
  // a contenção da §11.2 mantém dentro — mesmo critério de `lerComodosDeImoveis` e de
  // `empresaDoContexto`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`DadosDaPessoa`, `JanelaDePessoasCadastradas`, `PapelDePessoa`,
  // `PaginaDePessoasCadastradas`, `PessoaCadastrada`) não aparecem aqui porque não existem em tempo
  // de execução, e este caso observa o módulo carregado.
  'PAPEIS_DE_PESSOA',
  'alterarPessoa',
  'criarPessoa',
  'definirCirculacaoDaPessoa',
  'listarPessoas',
  'localizarPessoa',
  // T9 da fatia `cadastro-de-imoveis-e-pessoas` — a tradução da violação de unicidade do documento:
  // a classe de erro do domínio e o envoltório que a produz.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T9 publica DOIS símbolos novos no índice por decisão declarada. Eles
  // são o par que faltava para que um `23505` de documento repetido chegasse à borda como recusa
  // nomeada em vez de subir cru ao filtro de exceção e virar `500` — a herança que a T8 deixou com
  // dono escrito no cabeçalho de `src/cadastro-de-pessoa.ts`.
  //
  // `ErroDeDocumentoEmUso` entra pelo MESMO critério de `ErroDeUnidadeAninhada`, de
  // `ErroDePessoaForaDoContexto` e de `ErroDeIdentificadorMunicipalEmUso`: é classe de erro, não
  // caminho para dado. Ela precisa sair daqui porque quem a traduz no envelope da ADR-0017 é
  // `apps/api/src/cadastros/cadastro-de-pessoa.service.ts`, e a alternativa — reconhecer a recusa
  // pelo texto da mensagem — amarraria a borda ao idioma do servidor.
  //
  // `gravarCadastroSobRestricaoDeUnicidade` entra pelo critério das operações — **recebe** o executor
  // de quem já abriu a unidade, não abre conexão nem transação e não devolve executor —, com a razão
  // própria desta tradução: ler o estado do registro em conflito **depois** da recusa exige a mesma
  // transação e um `SAVEPOINT`, o que só é possível de dentro do pacote. Ele é PÚBLICO, e não
  // privado como o gêmeo de `./imovel.ts`, porque `criarPessoa` e `alterarPessoa` seguem subindo o
  // `23505` cru — é o que o `CT-349` e o `CT-352` afirmam, e é essa prova que demonstra que o
  // mecanismo da unicidade é a restrição do banco. A composição das duas coisas é da borda.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `RESTRICAO_DO_DOCUMENTO`, pelo mesmo
  // critério de `TABELA_POR_PAPEL` (nome físico de objeto do banco), e `lerConflitoDoDocumento`,
  // porque publicá-la daria à borda uma leitura por documento **sem** a recusa que a justifica —
  // exatamente a leitura-antes-de-gravar que o cabeçalho daquele arquivo recusa.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // O tipo que ela publica (`ConflitoDeDocumento`) não aparece aqui porque não existe em tempo de
  // execução, e este caso observa o módulo carregado.
  'ErroDeDocumentoEmUso',
  'gravarCadastroSobRestricaoDeUnicidade',
  // T10 da fatia `cadastro-de-imoveis-e-pessoas` — a leitura composta da carteira.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T10 publica UM símbolo novo no índice por decisão declarada na §1 da
  // task (`Símbolos públicos criados: lerCarteira`). Ela entra pelo critério de sempre — **recebe** o
  // executor de quem já abriu a unidade de trabalho, não abre conexão, não reserva e não devolve
  // executor —, com a razão própria desta leitura: o número de idas ao banco que a carteira custa é
  // decisão da camada de dados (tech spec §12.2), e deixá-la à borda devolveria à aplicação a
  // liberdade de montar a árvore com uma consulta por conjunto.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `lerImoveisDeConjuntos`, de
  // `src/imovel.ts`, consumida por `src/conjunto.ts` para compor a árvore. Publicá-la ofereceria a
  // `apps/api` uma listagem de imóveis por conjunto **sem janela**, fora das duas portas que o
  // contrato publica — mesmo critério de `lerComodosDeImoveis` um nível abaixo.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que ela publica (`ConjuntoComImoveisPersistido`, `PaginaDaCarteiraPersistida`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado.
  'lerCarteira',
  // T6 — dado da carga inicial, no mesmo critério dos identificadores literais que já estão aqui:
  // são constantes de carga, não acesso a dado. `SENHA_DA_CARGA` só vira credencial quando o
  // chamador passa a derivação a `semear`, e nenhum caminho de operação o faz (ver o cabeçalho de
  // `semente.ts`).
  'PROVEDOR_DE_CREDENCIAL',
  'SENHA_DA_CARGA',
  'USUARIOS',
  'USUARIO_MASTER',
  // T6 — o acesso tipado restrito ao schema `identidade`, que a §3.3 da tech spec nomeia como parte
  // da fronteira desde sempre ("a unidade de trabalho, o schema e um acesso tipado restrito ao
  // schema `identidade`") e que a T3 não chegou a materializar. Ele entra pelo mesmo critério do
  // `verificarCoberturaDeIsolamento` abaixo: é FÁBRICA, não executor — o valor exportado é uma
  // função, e o eixo das marcas de cliente continua valendo sobre ela. O executor que ela devolve é
  // declarado sobre as sete tabelas de `identidade` e não publica `$client`.
  // Os tipos que ela publica (`AcessoAIdentidade`, `BancoDeIdentidade`, `TabelasDeIdentidade`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado.
  'abrirAcessoAIdentidade',
  'abrirAcessoAoBanco',
  'contextoDeTenant.corrente',
  'contextoDeTenant.executarCom',
  // T3 da fatia `autorizacao-e-ciclo-de-acesso` — as quatro operações sobre ajuste de permissão.
  // Elas RECEBEM o executor de quem já abriu a unidade de trabalho: não abrem conexão, não
  // reservam, não devolvem executor. Os tipos que elas publicam (`AjustePersistido`,
  // `AjustesDaPessoa`, `ChaveDeAjuste`, `EfeitoDoAjuste`, `EscritaDeAjustes`, `PerfilDaPessoa`,
  // `TrocaDePerfil`) não aparecem aqui porque não existem em tempo de execução, e este caso observa
  // o módulo carregado.
  'escreverAjustes',
  'esquemaIdentidade.conta',
  'esquemaIdentidade.desfechoTentativa',
  'esquemaIdentidade.doisFatores',
  'esquemaIdentidade.empresa',
  'esquemaIdentidade.identidade',
  'esquemaIdentidade.perfilUsuario',
  'esquemaIdentidade.sessao',
  'esquemaIdentidade.tentativaLogin',
  'esquemaIdentidade.usuario',
  'esquemaIdentidade.verificacao',
  'esquemaNegocio.acessoUsuarioApp',
  'esquemaNegocio.acessoUsuarioPermissao',
  // T1 da fatia `autorizacao-e-ciclo-de-acesso` — o enum que a migração `0003` acrescentou. Ele
  // entra aqui pela mesma razão de `tipoPermissao`: é declaração de tipo do schema, não caminho
  // para dado. O inventário é EXATO de propósito, então símbolo novo no schema tem de ser
  // declarado — é o que faz este caso reprovar quando a superfície do pacote cresce sem que
  // ninguém decida que ela deveria crescer.
  'esquemaNegocio.efeitoPermissao',
  'esquemaNegocio.negocio',
  'esquemaNegocio.tipoPermissao',
  // T2 da fatia `cadastro-de-imoveis-e-pessoas` — as SEIS tabelas do domínio de locação e os TRÊS
  // enums que elas usam, todos criados pela migração `0005`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T2 publica nove símbolos novos no schema por decisão declarada na
  // §1 da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério de
  // `acessoUsuarioApp` e `tipoPermissao`: são **declaração de estrutura**, não caminho para dado —
  // quem os tem em mãos ainda precisa de um executor para chegar ao banco, e o executor não sai do
  // índice. O eixo das marcas de cliente continua valendo sobre cada um deles.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'esquemaNegocio.comodo',
  'esquemaNegocio.conjunto',
  'esquemaNegocio.fiador',
  'esquemaNegocio.imovel',
  'esquemaNegocio.locador',
  'esquemaNegocio.locatario',
  'esquemaNegocio.statusLocacao',
  'esquemaNegocio.tipoImovel',
  'esquemaNegocio.tipoPessoa',
  'incrementarVersaoPermissoes',
  'lerAjustesDaPessoa',
  // T8 da fatia `autorizacao-e-ciclo-de-acesso` — as SEIS operações do ciclo de vida das pessoas de
  // uma empresa, ordenadas no conjunto pela posição de cada nome (a comparação é sobre a lista
  // ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T8 publica seis símbolos novos no índice por decisão declarada. O
  // critério é o mesmo das quatro de `permissao.js` e das oito de `empresa.js`: elas **recebem** o
  // executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem
  // executor. Elas existem para que o alcance a `identidade` volte a ser enumerável — a contenção da
  // §11.2 é de tipo e não alcança texto de SQL — e para que a resolução de pessoa **pelo vínculo**,
  // que é a fronteira de tenant das sete rotas do Admin, tenha um lugar só.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`JanelaDePessoas`, `PaginaDePessoasPersistidas`, `PessoaDoContexto`,
  // `PessoaPersistida`) não aparecem aqui porque não existem em tempo de execução, e este caso
  // observa o módulo carregado. `PerfilDaPessoa`, que a T8 moveu de `permissao.ts` para
  // `esquema/identidade.ts`, também não: ele é tipo, e a reexportação preserva o nome no índice.
  'contarAjustesDaPessoa',
  'definirAtivoDaPessoa',
  'encerrarSessoesDaPessoa',
  'garantirVinculoDeAcesso',
  'listarPessoasDaEmpresa',
  'localizarPessoaDoContexto',
  'semear',
  'trocarPerfilDaPessoa',
  // T4 — a guarda de cobertura de isolamento. Ela é PERGUNTA sobre o catálogo, não caminho para
  // dado de negócio: não devolve cliente nem transação, e abre e encerra por dentro a conexão que
  // usa. Os tipos que ela publica (`CoberturaDeIsolamento`, `ExcecaoDeIsolamento`,
  // `MotivoDeExcecao`) não aparecem aqui porque não existem em tempo de execução, e este caso
  // observa o módulo carregado.
  'verificarCoberturaDeIsolamento',
] as const;

/** As propriedades que denunciam um cliente `postgres.js` — a marca do executor cru. */
const MARCAS_DE_CLIENTE = ['unsafe', 'begin', 'reserve', 'listen'] as const;

interface SuperficieObservada {
  readonly nomes: string[];
  readonly comMarcas: Record<string, string[]>;
}

interface AuditoriaDeSuperficie {
  readonly excedentes: string[];
  readonly ausentes: string[];
  readonly comMarcasDeCliente: string[];
}

/**
 * A MESMA função para o índice íntegro e para a cópia defeituosa — é o par que detecta, e não a
 * asserção isolada.
 */
function auditarSuperficie(
  superficie: SuperficieObservada,
  esperados: readonly string[],
): AuditoriaDeSuperficie {
  return {
    excedentes: superficie.nomes.filter((nome) => !esperados.includes(nome)).sort(),
    ausentes: esperados.filter((nome) => !superficie.nomes.includes(nome)).sort(),
    comMarcasDeCliente: Object.keys(superficie.comMarcas).sort(),
  };
}

const executar = promisify(execFile);

/**
 * O roteiro observa a superfície **achatada um nível**: um namespace de módulo (`export * as …`)
 * não entra como nome próprio; entram os símbolos de dentro dele, com o nome qualificado, e as
 * marcas de cliente são procuradas nesses valores internos também. Sem isso, o namespace é um saco
 * opaco: o conjunto não muda quando o módulo de origem ganha export, e um cliente exportado lá
 * dentro nunca é alcançado pelas marcas.
 *
 * `[object Module]` é a etiqueta que o próprio motor dá ao objeto de namespace — é o que distingue
 * "namespace reexportado" de "objeto que o pacote exporta como valor" (que continua sendo UM nome,
 * comparado e inspecionado como sempre).
 */
const ROTEIRO = `
  const marcas = ${JSON.stringify(MARCAS_DE_CLIENTE)};
  const modulo = await import(process.env.ESPECIFICADOR);
  const nomes = [];
  const comMarcas = {};
  const ehNamespace = (v) =>
    v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Module]';
  const registrar = (nome, valor) => {
    nomes.push(nome);
    if (valor === null || (typeof valor !== 'object' && typeof valor !== 'function')) return;
    const achadas = marcas.filter((marca) => marca in valor);
    if (achadas.length > 0) comMarcas[nome] = achadas;
  };
  for (const nome of Object.keys(modulo)) {
    const valor = modulo[nome];
    if (ehNamespace(valor)) {
      for (const interno of Object.keys(valor)) registrar(nome + '.' + interno, valor[interno]);
    } else {
      registrar(nome, valor);
    }
  }
  nomes.sort();
  process.stdout.write(JSON.stringify({ nomes, comMarcas }));
`;

async function observarSuperficie(especificador: string): Promise<SuperficieObservada> {
  const { stdout } = await executar(process.execPath, ['--input-type=module', '-e', ROTEIRO], {
    cwd: RAIZ_DO_PACOTE,
    env: { ...process.env, ESPECIFICADOR: especificador },
  });

  return JSON.parse(stdout) as SuperficieObservada;
}

// ===========================================================================
// CT-012 — o OBJETO DEVOLVIDO por cada fábrica de acesso
// ===========================================================================

/**
 * O eixo que o exame do índice **não** alcança, e por que ele precisa existir.
 *
 * O caso acima audita o VALOR EXPORTADO: `abrirAcessoAIdentidade` é uma função, e função não tem
 * `unsafe` nem `begin`. Isso deixava sem asserção o que ela devolve — e é ali que o cliente cru
 * estava: `drizzle-orm/postgres-js/driver.js` faz `db.$client = client` incondicionalmente, de modo
 * que declarar o tipo sem `$client` não removia a propriedade do valor. Uma conversão de uma linha
 * devolvia o cliente `postgres.js` inteiro a qualquer pacote que dependa de `@sysloc/db`.
 *
 * É a mesma cegueira que as duas falsificações do exame do índice existem para fechar — um eixo
 * adiante: lá o buraco era o namespace reexportado, aqui é o objeto devolvido pela fábrica.
 */
interface AuditoriaDeAcesso {
  /** Os nomes cujo valor carrega marca de cliente, qualificados e ordenados. */
  readonly comMarcasDeCliente: string[];
  /** Quais marcas foram achadas em cada um deles. */
  readonly marcasPorNome: Record<string, string[]>;
}

/**
 * Audita o objeto devolvido por uma fábrica de acesso, **achatado um nível**.
 *
 * O achatamento é a parte que discrimina, pela mesma razão que o achatamento do índice: o cliente
 * não fica no objeto de topo — o acesso é `{ identidade, encerrar }`, e nenhum dos dois tem marca
 * alguma. Ele fica pendurado numa propriedade DA propriedade (`identidade.$client`), e um exame que
 * só olhasse o topo aprovaria o defeito sem tocá-lo.
 *
 * A MESMA função serve o objeto íntegro e o objeto com o defeito reintroduzido — é o par que
 * detecta, não a asserção isolada.
 */
function auditarAcesso(raiz: object): AuditoriaDeAcesso {
  const marcasPorNome: Record<string, string[]> = {};

  const examinar = (nome: string, valor: unknown): void => {
    if (valor === null || (typeof valor !== 'object' && typeof valor !== 'function')) {
      return;
    }
    const achadas = MARCAS_DE_CLIENTE.filter((marca) => marca in (valor as object));
    if (achadas.length > 0) {
      marcasPorNome[nome] = achadas;
    }
  };

  for (const [nome, valor] of Object.entries(raiz)) {
    examinar(nome, valor);
    if (valor !== null && typeof valor === 'object') {
      for (const [interno, valorInterno] of Object.entries(valor as object)) {
        examinar(`${nome}.${interno}`, valorInterno);
      }
    }
  }

  return { comMarcasDeCliente: Object.keys(marcasPorNome).sort(), marcasPorNome };
}

/** Auditoria de um acesso limpo, escrita por extenso — é contra ela que a igualdade compara. */
const ACESSO_SEM_CLIENTE: AuditoriaDeAcesso = { comMarcasDeCliente: [], marcasPorNome: {} };

/** A propriedade que o driver do drizzle instala, e que a fábrica remove. */
const PROPRIEDADE_DO_CLIENTE = '$client';

// ===========================================================================
// CT-014 — quem chama o escritor do contexto de tenant
// ===========================================================================

/**
 * A superfície pública do pacote é auditada pelo CT-012; este caso audita **quem a consome**.
 *
 * `contextoDeTenant.executarCom` é o escritor do contexto de tenant, e o docblock de `contexto.ts`
 * justifica a separação escritor/leitor dizendo que um símbolo único "convidaria qualquer camada
 * intermediária a reescrever o contexto no meio do caminho". A separação, sozinha, não sustenta a
 * afirmação: o escritor é público, e qualquer módulo pode escrever
 * `contextoDeTenant.executarCom({ empresaId: pedido.headers['x-empresa'] }, …)` — a empresa da
 * transação deixa de ser a da sessão, o invariante 2 do `CLAUDE.md` cai, e nada quebra: nem a
 * compilação, nem a execução, nem a suíte. É o defeito que a ADR-0008 declara impossível de pegar
 * por revisão: *"os 28 escapes do backend anterior nasceram exatamente assim, um por vez, cada um
 * legítimo quando foi escrito"*.
 *
 * O que fecha a classe é enumerar o conjunto PERMITIDO, e não os caminhos de vazamento.
 */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** Onde mora fonte de produção. Testes não entram: eles escrevem contexto por ofício. */
const AREAS_DE_PRODUCAO = ['apps', 'packages'] as const;

/**
 * Os arquivos de produção que podem chamar o escritor. Igualdade de conjunto.
 *
 * **Exatamente um, desde a T9**: a guarda de contexto de `apps/api`, que deriva a empresa da sessão
 * autenticada. Até a T8 o conjunto era vazio — a fatia entregava a unidade de trabalho e ninguém
 * ainda estabelecia contexto —, e a entrada abaixo é literalmente a que este comentário previa
 * ("na T9 entra exatamente um"). O crescimento é a mudança que o caso existe para **exigir
 * revisão**, não para impedir: um SEGUNDO chamador continua reprovando aqui, e é essa a rede.
 *
 * O caminho é composto a partir da raiz do repositório, e não escrito absoluto: a varredura devolve
 * caminho absoluto, e um literal amarraria o caso ao diretório em que a máquina o hospeda.
 */
const CHAMADORES_LEGITIMOS: readonly string[] = [
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/autenticacao/contexto.guard.ts'),
];

/**
 * A chamada, e não a declaração: `export function executarCom<T>(…` traz `<T>` entre o nome e o
 * parêntese e não casa. A perna de controle da falsificação prova isso sobre o arquivo real.
 */
const CHAMADA_AO_ESCRITOR = /\bexecutarCom\s*\(/;

interface FontesDeProducao {
  readonly arquivos: string[];
  /** Quantos `.ts` cada pacote com `src/` rendeu. Alvo vazio é visível, não silencioso. */
  readonly porPacote: Record<string, number>;
}

/**
 * Descobre os alvos no disco, em vez de listá-los à mão.
 *
 * Uma lista fixa de diretórios envelhece: pacote renomeado ou acrescentado sai da varredura sem
 * alarme, e a auditoria segue verde cobrindo menos do que promete.
 */
async function fontesDeProducao(): Promise<FontesDeProducao> {
  const arquivos: string[] = [];
  const porPacote: Record<string, number> = {};

  for (const area of AREAS_DE_PRODUCAO) {
    const entradas = await readdir(join(RAIZ_DO_REPOSITORIO, area), { withFileTypes: true });
    for (const entrada of entradas) {
      if (!entrada.isDirectory()) {
        continue;
      }
      const fonte = join(RAIZ_DO_REPOSITORIO, area, entrada.name, 'src');
      if (!existsSync(fonte)) {
        continue;
      }
      const encontrados = await listarFontesTs(fonte);
      porPacote[`${area}/${entrada.name}`] = encontrados.length;
      arquivos.push(...encontrados);
    }
  }

  return { arquivos, porPacote };
}

function varrerChamadasAoEscritor(arquivos: readonly string[]): Promise<VarreduraDeFontes> {
  return varrerArquivos(arquivos, (linha) => CHAMADA_AO_ESCRITOR.test(linha));
}

/** Os arquivos distintos de uma lista de `<caminho>:<linha>`. */
function arquivosDe(ocorrencias: readonly string[]): string[] {
  return [...new Set(ocorrencias.map((o) => o.slice(0, o.lastIndexOf(':'))))].sort();
}

/** Âncora contra descobridor quebrado: estes existem hoje e têm de aparecer na varredura. */
const PACOTES_QUE_EXISTEM_HOJE = ['apps/api', 'apps/worker', 'packages/db', 'packages/shared'];

// ===========================================================================
// CT-326 — quem ABRE unidade de trabalho: só a borda
// ===========================================================================

/**
 * A **segunda metade** da prova de atomicidade da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * A primeira é o `CT-325` (T7), que prova pela borda que imóvel e cômodos entram num commit só. Ela
 * é comportamental e, sozinha, **não cobre o invariante**: ela observa a composição que existe hoje,
 * e ficaria verde no dia em que um serviço novo abrisse unidade própria — o defeito só apareceria
 * quando alguém compusesse esse serviço com outro, e aí como `ErroDeUnidadeAninhada` em produção.
 *
 * A decisão D1 do tech_spec é *"a unidade abre na BORDA, e o serviço recebe o executor"*, e os
 * cabeçalhos de `imoveis/conjunto.service.ts`, `imoveis/imovel.service.ts`,
 * `imoveis/comodo.service.ts` e `cadastros/cadastro-de-pessoa.service.ts` afirmam, cada um por
 * extenso, que *"nenhum deles chama `emUnidadeDeTrabalho`"*. Comentário não é prova: um serviço novo
 * que a chamasse compilaria, passaria a suíte funcional inteira e desmentiria os quatro cabeçalhos em
 * silêncio.
 *
 * O que fecha a classe é o mesmo movimento do `CT-014`, um símbolo adiante: enumerar o conjunto
 * **PERMITIDO** de arquivos que abrem unidade, por igualdade de conjunto, sobre a fonte descoberta no
 * disco — e não os caminhos pelos quais o vazamento aconteceria.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — MT11-1 (2026-08-06)
 * ---------------------------------------------------------------------------
 *
 * Asserção estática ⇒ prova de falsificação obrigatória (`.claude/rules/testing-stack.md`). Além da
 * falsificação PERMANENTE na suíte (o caso logo abaixo do principal, com as duas pernas), o defeito
 * foi reintroduzido **no fonte de produção** e medido. A suíte foi invocada pelo **script do
 * pacote** (`pnpm --filter @sysloc/db test -t "CT-326"`), nunca por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `2 passed | 62 skipped`;
 *   * **MT11-1 · um serviço da fatia abre a própria unidade** — acrescentado a
 *     `apps/api/src/imoveis/conjunto.service.ts` o corpo
 *     `export async function listarPorContaPropria(banco: AcessoAoBanco) { await
 *     banco.emUnidadeDeTrabalho(async () => undefined); }`: `1 failed | 1 passed`, no caso
 *     principal, com a mensagem nomeando o culpado —
 *     `"excedentes": ["/…/apps/api/src/imoveis/conjunto.service.ts"]`. É o modo de falha desejado:
 *     ele aponta o ARQUIVO, e não uma contagem;
 *   * **reversão** — o fonte foi restaurado e conferido idêntico ao original por `diff` e por
 *     `git diff` vazio, e o controle voltou a `2 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — MT11-6 (2026-08-08), sobre o EIXO POSITIVO
 * ---------------------------------------------------------------------------
 *
 * O eixo positivo do caso principal ganhou prova própria na rodada 2, depois que o Gate 1 mediu que
 * a forma anterior (reaplicar {@link ABERTURA_DE_UNIDADE} a `varredura.linhas`) era tautológica. As
 * duas mutações abaixo são **complementares**: a primeira mostra que este eixo reprova por caminho
 * PRÓPRIO, com o exame de conjunto intacto; a segunda é o defeito que ele existe para pegar.
 *
 *   * **MT11-6a · o varredor deixa de restringir `linhas` às linhas casadas** —
 *     `packages/db/test/varredura-de-fontes.ts` com `linhasCasadas.push` movido para FORA do
 *     `if (casa(linha))`. `ocorrencias` fica intacto, e portanto o exame de conjunto seguiria verde;
 *     reprova só aqui, com `expected 'emUnidadeDeTrabalho<T>(trabalho: (tx: TransactionSql) =>
 *     Promise<T>): Promise<T>;' not to match /\bemUnidadeDeTrabalho\s*</`. Reversão conferida por
 *     `sha256sum` e `git diff` vazio no arquivo mutado (que estava limpo no índice);
 *   * **MT11-6b · o predicado deixa de discriminar** — {@link ABERTURA_DE_UNIDADE} afrouxado para
 *     `/\bemUnidadeDeTrabalho\s*[<(]/`. É o mutante que separa a rodada 2 da rodada 1: a asserção
 *     antiga passaria (ela reaplicava o predicado mutado, que por construção casa o que selecionou),
 *     e esta reprova nomeando `ocorrência em …/packages/db/src/unidade-de-trabalho.ts:177`. Reversão
 *     conferida por `sha256sum` idêntico ao estado pré-mutante e por `diff` vazio contra a cópia.
 *
 * A âncora destes registros é **simbólica** — {@link ABRIDORES_LEGITIMOS}, {@link ABERTURA_DE_UNIDADE},
 * {@link DECLARACAO_DE_UNIDADE} e o nome do arquivo mutado —, e nunca número de linha: a linha se
 * move na primeira edição do serviço, e o registro passaria a apontar para o lugar errado. O
 * `:177` acima é a única exceção, e é citação do modo de falha medido, não âncora.
 */
const ABRIDORES_LEGITIMOS: readonly string[] = [
  // A borda de CONTEXTO: a guarda que resolve a sessão e a empresa antes de qualquer rota.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/autenticacao/contexto.guard.ts'),
  // A borda do DOMÍNIO DE LOCAÇÃO: o ponto único por onde os oito controladores da fatia abrem a
  // unidade sob o contexto da sessão (`sobContextoDaSessao`). É por ele existir que nenhum dos
  // cinco serviços novos precisa abrir a sua — e é o fecho do débito D12.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/comum/contexto-da-sessao.ts'),
  // Os dois chamadores JÁ LEGÍTIMOS da F1, anteriores à decisão D1. Eles abrem a unidade dentro do
  // serviço porque as rotas do Master e do Admin nasceram assim, e nenhuma delas compõe dois
  // serviços — a decisão D1 governa a superfície do domínio de locação, e não os reescreve.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/master/empresa.service.ts'),
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/usuarios/usuario.service.ts'),
].sort();

/**
 * A CHAMADA, e não a declaração.
 *
 * `emUnidadeDeTrabalho<T>(trabalho: …` — que é como `packages/db/src/unidade-de-trabalho.ts` a
 * declara, nas duas ocorrências — traz `<T>` entre o nome e o parêntese e **não** casa. A perna de
 * controle da falsificação prova isso sobre o arquivo real, e não sobre um exemplo escrito à mão.
 */
const ABERTURA_DE_UNIDADE = /\bemUnidadeDeTrabalho\s*\(/;

/**
 * A forma da DECLARAÇÃO — o que {@link ABERTURA_DE_UNIDADE} existe para **não** casar.
 *
 * Ela não é a negação do predicado acima: é um predicado **independente** sobre a mesma linha, e é
 * só isso que a torna capaz de reprovar. Reaplicar a uma linha o predicado que a selecionou compara
 * o valor com o próprio critério de seleção e não pode falhar em árvore nenhuma — foi o defeito da
 * primeira rodada desta task, e a razão de esta constante existir.
 *
 * A classe que ela fecha é a do predicado que **deixa de discriminar** chamada de declaração. Hoje
 * um afrouxamento (`/\bemUnidadeDeTrabalho\s*[<(]/`, por exemplo) casaria as duas linhas de
 * `packages/db/src/unidade-de-trabalho.ts`; e no dia em que um arquivo JÁ LEGÍTIMO declarar a
 * assinatura — uma porta estreitada em `comum/contexto-da-sessao.ts` é o caso plausível —, o exame
 * de conjunto ficaria verde com uma DECLARAÇÃO contada como abertura, e este eixo é o único que
 * veria.
 */
const DECLARACAO_DE_UNIDADE = /\bemUnidadeDeTrabalho\s*</;

interface AuditoriaDeAberturas {
  /** Arquivos que abrem unidade e não deveriam — nomeados, nunca contados. */
  readonly excedentes: string[];
  /** Arquivos declarados legítimos que deixaram de abrir unidade. */
  readonly ausentes: string[];
}

/**
 * A MESMA função para a árvore íntegra e para a cópia defeituosa — é o par que detecta, e não a
 * asserção isolada.
 *
 * `ausentes` existe pela razão que o `CT-012` registra do lado dele: sem ele a auditoria seria de
 * CONTENÇÃO, e continuaria verde se a borda parasse de abrir a unidade e um serviço entrasse no
 * lugar dela — troca que mantém a contagem e destrói a propriedade.
 */
function auditarAberturas(
  chamadores: readonly string[],
  legitimos: readonly string[],
): AuditoriaDeAberturas {
  return {
    excedentes: chamadores.filter((arquivo) => !legitimos.includes(arquivo)).sort(),
    ausentes: legitimos.filter((arquivo) => !chamadores.includes(arquivo)).sort(),
  };
}

function varrerAberturasDeUnidade(arquivos: readonly string[]): Promise<VarreduraDeFontes> {
  return varrerArquivos(arquivos, (linha) => ABERTURA_DE_UNIDADE.test(linha));
}

/**
 * O serviço da fatia cuja cópia carrega o defeito reintroduzido.
 *
 * É um dos quatro cujo cabeçalho afirma não abrir unidade — de modo que o mutante é literalmente o
 * desmentido daquela frase, e não um arquivo inventado para o caso.
 */
const SERVICO_QUE_NAO_ABRE_UNIDADE = join(
  RAIZ_DO_REPOSITORIO,
  'apps/api/src/imoveis/conjunto.service.ts',
);

/** O fonte que DECLARA a unidade — a perna de controle: declarar não é chamar. */
const DECLARACAO_DA_UNIDADE = fileURLToPath(
  new URL('../src/unidade-de-trabalho.ts', import.meta.url),
);

/** O defeito literal: um serviço abrindo a própria unidade em vez de receber o executor. */
const ABERTURA_REINTRODUZIDA = [
  '',
  'export async function listarPorContaPropria(banco: AcessoAoBanco): Promise<void> {',
  '  await banco.emUnidadeDeTrabalho(async () => undefined);',
  '}',
  '',
].join('\n');

// ===========================================================================
// CT-210 — o contador de versão e a escrita de permissão, num commit só
// ===========================================================================

/** A pessoa da empresa A cujo perfil e ajustes o caso movimenta. */
const PESSOA_DO_CASO = ACESSOS_DA_EMPRESA_A[1] ?? { id: '', usuarioId: '', empresaId: '' };

/** O perfil com que ela é semeada — a origem do primeiro valor que a validação deve receber. */
const PERFIL_SEMEADO: PerfilDaPessoa =
  USUARIOS.find((pessoa) => pessoa.id === PESSOA_DO_CASO.usuarioId)?.perfil ?? 'USUARIO_EMPRESA';

/** O perfil para o qual ela é trocada. Diferente do semeado, de propósito. */
const PERFIL_TROCADO: PerfilDaPessoa = 'ADMIN_EMPRESA';

const CONTEXTO_DA_EMPRESA_A = { empresaId: EMPRESA_A.id } as const;

/** O ajuste coerente: uma área de tela concedida, que não exige nada além de si mesma. */
const AJUSTE_COERENTE: readonly AjustePersistido[] = [
  { chave: 'TELA:financeiro', efeito: 'CONCEDIDA' },
];

/**
 * O ajuste incoerente: a ação sensível sem a área de tela que a comporta (RN-02).
 *
 * A DUPLA é deliberada — a ação órfã e um ajuste perfeitamente válido no mesmo pedido. Com um item
 * só, "nenhuma linha foi gravada" já discriminaria; com dois, discrimina também a implementação que
 * gravasse o que dá para gravar e recusasse o resto, que é a saída cômoda que a RN-02 proíbe.
 */
const AJUSTE_INCOERENTE: readonly AjustePersistido[] = [
  { chave: 'TELA:relatorios', efeito: 'CONCEDIDA' },
  { chave: 'ACAO:emitir_boleto', efeito: 'CONCEDIDA' },
];

/** O que a validação de coerência recusou. Instância única, para a asserção ser por identidade. */
const RECUSA_DE_COERENCIA = new Error('a ação sensível concedida exige a área de tela');

/** O erro com que o caso derruba uma unidade de trabalho de propósito. */
const DESFAZIMENTO_PEDIDO = new Error('desfazimento pedido pelo caso');

/** O que a regra de domínio recebeu, chamada a chamada — argumentos exatos, não "foi chamada". */
interface ChamadaDeValidacao {
  readonly perfil: PerfilDaPessoa;
  readonly ajustes: readonly string[];
}

function comoTextoOsAjustes(ajustes: readonly AjustePersistido[]): string[] {
  return ajustes.map((ajuste) => `${ajuste.chave}=${ajuste.efeito}`);
}

/**
 * A regra de coerência entra por PARÂMETRO em produção — `@sysloc/auth` depende de `@sysloc/db`, e
 * não o contrário. O caso passa a sua, e é isso que ele observa: **o perfil com que ela é chamada
 * vem do banco**, lido dentro da transação, e muda quando o perfil da pessoa muda.
 *
 * A regra de verdade (`validarCoerenciaDeAjustes`) é provada no CT-205, em `@sysloc/auth`. Reescrevê-la
 * aqui seria a "reimplementação do leitor no próprio verificador" que
 * `.claude/rules/testing-stack.md` registra como antipadrão — por isso a daqui apenas **registra e
 * recusa**, e o que se afirma são os argumentos recebidos e o efeito da recusa.
 */
function regraQueRegistra(
  registro: ChamadaDeValidacao[],
  recusa?: Error,
): (perfil: PerfilDaPessoa, ajustes: readonly AjustePersistido[]) => void {
  return (perfil, ajustes) => {
    registro.push({ perfil, ajustes: comoTextoOsAjustes(ajustes) });
    if (recusa !== undefined) {
      throw recusa;
    }
  };
}

interface LinhaDeAjusteGravada {
  readonly tipo: string;
  readonly chave: string;
  readonly efeito: string;
}

/** O estado observável da pessoa: contador, perfil e as linhas de ajuste do vínculo dela. */
interface EstadoDaPessoa {
  readonly versao: number;
  readonly perfil: string;
  readonly ajustes: LinhaDeAjusteGravada[];
}

async function lerEstadoDaPessoa(tx: TransactionSql): Promise<EstadoDaPessoa> {
  const [pessoa] = await tx<{ versao: number; perfil: string }[]>`
    SELECT versao_permissoes AS versao, perfil AS perfil
      FROM identidade.usuario
     WHERE id = ${PESSOA_DO_CASO.usuarioId}
  `;
  // A ordenação é por `tipo::text` pelo mesmo motivo de `permissao.spec.ts`: `ORDER BY` sobre
  // coluna de enum segue a ordem de DECLARAÇÃO do tipo, não a alfabética.
  const ajustes = await tx<LinhaDeAjusteGravada[]>`
    SELECT tipo::text AS tipo, chave AS chave, efeito::text AS efeito
      FROM negocio.acesso_usuario_permissao
     WHERE acesso_id = ${PESSOA_DO_CASO.id}
     ORDER BY tipo::text, chave
  `;
  return {
    versao: Number(pessoa?.versao ?? -1),
    perfil: pessoa?.perfil ?? '',
    ajustes: ajustes.map((linha) => ({ ...linha })),
  };
}

/** Devolve a pessoa ao estado semeado, para que os dois casos sejam independentes da ordem. */
async function restaurarPessoa(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        DELETE FROM negocio.acesso_usuario_permissao WHERE acesso_id = ${PESSOA_DO_CASO.id}
      `;
      await tx`
        UPDATE identidade.usuario
           SET versao_permissoes = 0, perfil = ${PERFIL_SEMEADO}::identidade.perfil_usuario
         WHERE id = ${PESSOA_DO_CASO.usuarioId}
      `;
    }),
  );
}

// ===========================================================================
// CT-310 (c) — o alcance do desfazimento da recusa por unicidade, DENTRO da unidade
// ===========================================================================

/**
 * **Por que este caso mora AQUI, e não num arquivo do imóvel.**
 *
 * O SUT é a porta do imóvel (`packages/db/src/imovel.ts`), mas a invariante não é sobre o imóvel: é
 * sobre **o que a unidade de trabalho preserva e o que ela commita** quando uma instrução dela é
 * recusada. Ela é a irmã exata do `CT-210 (atomicidade)`, logo abaixo — lá se prova que o
 * desfazimento da unidade inteira leva as duas pontas juntas; aqui se prova o complemento, que o
 * desfazimento **parcial** (o `ROLLBACK TO` do savepoint) **não** alcança o que a unidade gravou
 * antes. As duas metades da mesma pergunta em arquivos diferentes ficariam livres para divergir, e a
 * segunda subiria um Postgres efêmero a mais para observar a mesma superfície.
 *
 * Ele **não** é o `CT-325` da T7, e não o antecipa: aquele prova a **composição** (imóvel mais
 * cômodos, num commit só, pela borda). Este prova a propriedade da porta de que aquele depende —
 * e é justamente por isso que ele existe antes.
 *
 * **O que ele prova, e que nenhum caso de rota prova.** O docblock de `gravarSobRestricaoDeUnicidade`
 * afirma que *"o desfazimento alcança só a instrução recusada — o que a unidade já gravou antes dela
 * permanece, e é o que faz esta tradução caber dentro de uma composição maior"*. Pela rota, cada
 * requisição abre a sua unidade e a recusa a derruba inteira, de modo que o `CT-310` e o `CT-310 (b)`
 * não conseguem distinguir *"desfez só a instrução"* de *"desfez tudo"*: nas contagens deles os dois
 * desenhos dão o mesmo resultado. Aqui a unidade é **uma só** e ela **commita**, e é isso que torna a
 * distinção observável.
 *
 * **Precondição privilegiada**: nenhuma. O contexto vem de `contextoDeTenant.executarCom` e o banco
 * de `abrirAcessoAoBanco` — o mesmo par da operação —, e todo estado é montado pelas funções
 * públicas da porta. Nenhuma conexão privilegiada, nenhum `INSERT` escrito aqui, e nenhum símbolo
 * acrescentado a `packages/db/src/**` para o caso existir (Iron Law #6).
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — MT6-6 (2026-08-06)
 * ---------------------------------------------------------------------------
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicado ao fonte de `packages/db/src/imovel.ts`,
 * com a suíte invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca por
 * `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `7 arquivos, 46 casos, 0 falhas`;
 *   * **MT6-6 · o `SAVEPOINT` da porta desaparece** (`tx.savepoint(cb)` trocado por `cb(tx)`, em
 *     `gravarSobRestricaoDeUnicidade`): `1 failed | 45 passed`, **neste caso** — a unidade rejeita
 *     inteira com `PostgresError: duplicate key value violates unique constraint
 *     "imovel_empresa_identificador_municipal_key"`, levantada da linha do `INSERT`. Sem o ponto de
 *     retorno não há desfazimento parcial: a violação derruba a unidade toda, e com ela o conjunto e
 *     o primeiro imóvel — que é exatamente a metade que o docblock afirma e que nenhum caso provava;
 *   * **por que ele NÃO é o MT6-4** — a mutação do fonte é a mesma, a prova é outra. O MT6-4 mede a
 *     **forma da resposta HTTP** (`500` no lugar do `422` discriminado, em `apps/api`), e ficaria
 *     verde sobre uma implementação que traduzisse a recusa corretamente e ainda assim perdesse tudo
 *     o que a unidade gravou antes — porque, pela rota, cada requisição abre a sua unidade e a recusa
 *     a derruba de qualquer jeito. É esse par que separa as duas propriedades;
 *   * **reversão** — o fonte foi restaurado e conferido idêntico ao original por `diff`, e o controle
 *     voltou a `46 passed`.
 */
const NOME_DO_CONJUNTO_DA_COMPOSICAO = 'Edifício da composição — CT-310 (c)';

/**
 * O identificador municipal em disputa **deste** caso, e só dele.
 *
 * A unicidade alcança os retirados (ADR-0014), então um valor reaproveitado por outro caso criaria
 * dependência de ordem (AP-08). Nenhum outro caso deste arquivo escreve em `negocio.imovel`.
 */
const IDENTIFICADOR_DA_COMPOSICAO = '98765.432.1098-7';

/** Janela larga o bastante para que o recorte observado seja o do filtro por identificador. */
const JANELA_DA_COMPOSICAO = { limite: 50, deslocamento: 0 } as const;

/** O corpo completo de um imóvel, com o conjunto e o nome por parâmetro. */
function dadosDoImovel(conjuntoId: string, nomeImovel: string): DadosDoImovel {
  return {
    conjuntoId,
    nomeImovel,
    identificadorMunicipal: IDENTIFICADOR_DA_COMPOSICAO,
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

/**
 * Os identificadores dos imóveis que ocupam o identificador municipal do caso.
 *
 * Pela porta de leitura pública, e não por um `SELECT` escrito aqui: o que se observa é o que o
 * produto enxerga. O filtro é do caso — a porta lista a empresa inteira — e existe para que a
 * asserção não dependa do que os outros casos deste arquivo gravaram.
 */
async function imoveisComOIdentificadorDoCaso(tx: TransactionSql): Promise<string[]> {
  const { imoveis } = await listarImoveis(tx, JANELA_DA_COMPOSICAO);

  return imoveis
    .filter((imovel) => imovel.identificadorMunicipal === IDENTIFICADOR_DA_COMPOSICAO)
    .map((imovel) => imovel.id);
}

// ===========================================================================
// Os casos
// ===========================================================================

describe('unidade de trabalho', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-010 — contexto de tenant não vaza entre unidades de trabalho na conexão reaproveitada',
    async () => {
      // Reserva de UMA conexão: opção legítima de configuração, a mesma que a operação usa com
      // outro valor. É ela que garante que as três unidades correm sobre a mesma conexão física —
      // sem isso o caso passaria por sorte, provando nada.
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });

      try {
        const primeira = await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, () =>
          observarUnidade(acesso),
        );
        const segunda = await observarUnidade(acesso);
        const terceira = await contextoDeTenant.executarCom({ empresaId: EMPRESA_B.id }, () =>
          observarUnidade(acesso),
        );

        // A asserção que transforma o caso de "passou por sorte" em prova.
        expect(segunda.pid).toBe(primeira.pid);
        expect(terceira.pid).toBe(primeira.pid);

        expect(ordenado(primeira.acessos)).toEqual(ordenado(IDENTIFICADORES_DE_A));

        // A unidade sem contexto, sobre a conexão que acabou de atender a empresa A: o valor da
        // unidade anterior não sobreviveu ao `COMMIT`. E é a cadeia VAZIA, não nulo — a fixação é
        // emitida mesmo sem contexto (P1 do Gate 2), e é isso que a quarta unidade explora.
        expect(segunda.bruto).toBe('');
        expect(segunda.bruto).not.toBe(EMPRESA_A.id);
        expect(segunda.acessos).toEqual([]);

        expect(ordenado(terceira.acessos)).toEqual(ordenado(IDENTIFICADORES_DE_B));
        // Em particular: nenhum identificador de A sobrou da primeira unidade.
        expect(terceira.acessos.filter((id) => IDENTIFICADORES_DE_A.includes(id))).toEqual([]);

        // -------------------------------------------------------------------
        // Quarta unidade — o resíduo de SESSÃO, que a morte do `SET LOCAL` não cobre
        // -------------------------------------------------------------------
        //
        // O `tx` cru é entregue ao `trabalho`, e nada impede que ele emita `SET` — sem `LOCAL` —
        // numa transação que COMMITA. O valor então sobrevive na conexão física, e não há
        // `SET LOCAL` que morra para desfazê-lo: as três unidades acima provam que a fixação da
        // transação some, não que não exista fixação de sessão. Se a unidade seguinte não emitisse
        // a sua, ela leria este resíduo — "sem contexto" viraria leitura da empresa A, sem erro.
        // Controle do mecanismo, numa conexão crua: o `SET` sem `LOCAL` REALMENTE sobrevive ao
        // `COMMIT`. Sem esta perna, "a quarta unidade leu vazio" não distinguiria "a fixação
        // sobrescreveu o resíduo" de "o resíduo nunca existiu", e a quarta unidade não provaria
        // nada. A conexão crua é observatório do comportamento do servidor, não caminho de acesso
        // ao dado do caso — as unidades continuam vindo todas de `abrirAcessoAoBanco`.
        const cru = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });
        try {
          await cru.begin(async (tx) => {
            await tx.unsafe(`SET app.empresa_id = '${EMPRESA_A.id}'`);
          });
          const [depoisDoCommit] = await cru.unsafe<{ bruto: string | null }[]>(
            "SELECT current_setting('app.empresa_id', true) AS bruto",
          );
          expect(depoisDoCommit?.bruto).toBe(EMPRESA_A.id);
        } finally {
          await cru.end();
        }

        // O mesmo resíduo, agora deixado sobre a conexão da reserva pelo próprio `trabalho`.
        await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => {
            await tx.unsafe(`SET app.empresa_id = '${EMPRESA_A.id}'`);
          }),
        );

        const quarta = await observarUnidade(acesso);
        expect(quarta.pid).toBe(primeira.pid);
        expect(quarta.bruto).toBe('');
        expect(quarta.bruto).not.toBe(EMPRESA_A.id);
        expect(quarta.acessos).toEqual([]);
      } finally {
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-011 — valor de contexto que não é UUID é recusado antes de compor o SET LOCAL',
    async () => {
      const sentinela = await abrirSentinela(banco.porta);
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: pelaSentinela(banco.cadeiaConexao, sentinela.porta),
        maximoDeConexoes: 1,
      });

      try {
        for (const invalido of VALORES_INVALIDOS) {
          const abertura = contextoDeTenant.executarCom({ empresaId: invalido }, () =>
            acesso.emUnidadeDeTrabalho(async (tx) => {
              await tx`SELECT 1`;
            }),
          );

          await expect(abertura).rejects.toThrow(ErroDeContextoInvalido);
          await expect(abertura).rejects.toThrow(
            'identificador de empresa inválido para app.empresa_id: [REDIGIDO]',
          );
          // O valor recusado é entrada não confiável: ele não pode aparecer na mensagem, ou a
          // redação do registro estruturado seria contornada por este caminho.
          if (invalido !== '') {
            await expect(abertura).rejects.not.toThrow(invalido);
          }
        }

        // Nenhuma instrução chegou ao servidor — nem sequer uma conexão foi aberta.
        expect(sentinela.conexoesAceitas()).toBe(0);
        expect(sentinela.ocorrenciasDe(INSTRUCAO_DE_FIXACAO)).toBe(0);

        // O controle: com um valor válido, a unidade abre e a instrução é emitida exatamente uma vez.
        await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => {
            await tx`SELECT 1`;
          }),
        );

        expect(sentinela.conexoesAceitas()).toBe(1);
        expect(sentinela.ocorrenciasDe(`${INSTRUCAO_DE_FIXACAO} = '${EMPRESA_A.id}'`)).toBe(1);
        expect(sentinela.ocorrenciasDe(INSTRUCAO_DE_FIXACAO)).toBe(1);
      } finally {
        await acesso.encerrar();
        await sentinela.parar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-012 — `@sysloc/db` não oferece caminho de acesso a dado fora da unidade de trabalho',
    async () => {
      const superficie = await observarSuperficie(ESPECIFICADOR_PUBLICO);
      const auditoria = auditarSuperficie(superficie, SIMBOLOS_ESPERADOS);

      expect(auditoria).toEqual({ excedentes: [], ausentes: [], comMarcasDeCliente: [] });
      // Igualdade de conjunto, dita também de forma direta.
      expect(superficie.nomes).toEqual(ordenado(SIMBOLOS_ESPERADOS));
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-012 (falsificação) — a auditoria reprova o índice que reexporta o executor cru',
    async () => {
      // A cópia defeituosa mora DENTRO do pacote: é de lá que `postgres` e `./dist/index.js`
      // resolvem, e é lá que o defeito real moraria.
      const copia = join(RAIZ_DO_PACOTE, `superficie-falsificada-${process.pid}.mjs`);

      try {
        await writeFile(
          copia,
          "import postgres from 'postgres';\n" +
            "export * from './dist/index.js';\n" +
            "export const sql = postgres('postgresql://ninguem:nada@127.0.0.1:1/nada');\n",
          'utf8',
        );

        const superficie = await observarSuperficie(pathToFileURL(copia).href);
        const auditoria = auditarSuperficie(superficie, SIMBOLOS_ESPERADOS);

        // A asserção commitada, aplicada à cópia com o defeito reintroduzido, nomeia `sql` como
        // excedente — e o reconhece como executor pelas marcas do cliente.
        expect(auditoria.excedentes).toEqual(['sql']);
        expect(auditoria.ausentes).toEqual([]);
        expect(auditoria.comMarcasDeCliente).toEqual(['sql']);
        expect(superficie.comMarcas.sql).toEqual([...MARCAS_DE_CLIENTE]);
      } finally {
        await rm(copia, { force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-012 (falsificação) — a auditoria reprova o executor exportado DENTRO do namespace',
    async () => {
      // O caminho que a versão anterior deste caso não alcançava. O índice reexporta módulos com
      // `export * as …`: um `export const sql = postgres(…)` acrescentado a `contexto.ts` entra na
      // superfície pública sem mudar nenhum nome de topo, e as marcas de cliente, procuradas só no
      // valor de topo, encontrariam um namespace — que não tem `unsafe` nem `begin`.
      const modulo = join(RAIZ_DO_PACOTE, `contexto-falsificado-${process.pid}.mjs`);
      const copia = join(RAIZ_DO_PACOTE, `superficie-falsificada-ns-${process.pid}.mjs`);

      try {
        await writeFile(
          modulo,
          "import postgres from 'postgres';\n" +
            "export * from './dist/contexto.js';\n" +
            "export const sql = postgres('postgresql://ninguem:nada@127.0.0.1:1/nada');\n",
          'utf8',
        );
        // O export nomeado tem precedência sobre o `export *`, então este namespace substitui o do
        // índice íntegro — que é exatamente o que aconteceria se o defeito estivesse no fonte.
        await writeFile(
          copia,
          "export * from './dist/index.js';\n" +
            `export * as contextoDeTenant from './${basename(modulo)}';\n`,
          'utf8',
        );

        const superficie = await observarSuperficie(pathToFileURL(copia).href);
        const auditoria = auditarSuperficie(superficie, SIMBOLOS_ESPERADOS);

        expect(auditoria.excedentes).toEqual(['contextoDeTenant.sql']);
        expect(auditoria.ausentes).toEqual([]);
        expect(auditoria.comMarcasDeCliente).toEqual(['contextoDeTenant.sql']);
        expect(superficie.comMarcas['contextoDeTenant.sql']).toEqual([...MARCAS_DE_CLIENTE]);
      } finally {
        await rm(copia, { force: true });
        await rm(modulo, { force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-012 — o objeto devolvido por cada fábrica de acesso não carrega o executor cru',
    async () => {
      const acessoAIdentidade = abrirAcessoAIdentidade({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });
      const acessoAoBanco = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });

      try {
        // As duas fábricas de acesso que o índice publica. Nenhuma propriedade do objeto que elas
        // devolvem — nem nenhuma propriedade dessas propriedades — carrega marca de cliente.
        expect(auditarAcesso(acessoAIdentidade)).toEqual(ACESSO_SEM_CLIENTE);
        expect(auditarAcesso(acessoAoBanco)).toEqual(ACESSO_SEM_CLIENTE);

        // Dito também de forma direta, sobre a propriedade exata que o driver instala: ela não
        // existe mais no valor, e não apenas está ausente do tipo.
        expect(PROPRIEDADE_DO_CLIENTE in acessoAIdentidade.identidade).toBe(false);

        // O eixo positivo, sem o qual a auditoria acima passaria por vacuidade sobre um executor
        // quebrado: depois da remoção o executor continua executando consulta de verdade contra a
        // instância efêmera, e devolve a carga inicial inteira.
        const empresas = await acessoAIdentidade.identidade
          .select({ id: empresa.id })
          .from(empresa);
        expect(ordenado(empresas.map((linha) => linha.id))).toEqual(
          ordenado([EMPRESA_A.id, EMPRESA_B.id]),
        );
      } finally {
        await acessoAIdentidade.encerrar();
        await acessoAoBanco.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-012 (falsificação) — a auditoria reprova o acesso cujo executor devolve o cliente cru',
    async () => {
      const acesso = abrirAcessoAIdentidade({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });
      const cru = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });

      try {
        // O defeito reintroduzido na forma EXATA em que ele existia: a atribuição que
        // `drizzle-orm/postgres-js/driver.js` faz por conveniência, e que a fábrica desfaz.
        Object.assign(acesso.identidade, { [PROPRIEDADE_DO_CLIENTE]: cru });

        const auditoria = auditarAcesso(acesso);

        // A asserção commitada, aplicada ao objeto com o defeito de volta, nomeia o caminho exato e
        // o reconhece como executor pelas quatro marcas do cliente.
        expect(auditoria.comMarcasDeCliente).toEqual(['identidade.$client']);
        expect(auditoria.marcasPorNome['identidade.$client']).toEqual([...MARCAS_DE_CLIENTE]);
        // E o que o defeito concedia, dito por extenso: o cliente devolvido é o mesmo objeto que
        // abre transação e emite SQL literal — não um resíduo inerte.
        expect(auditoria).not.toEqual(ACESSO_SEM_CLIENTE);
      } finally {
        await cru.end();
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-013 — unidade de trabalho aninhada é recusada com erro nomeado, e a sequencial segue valendo',
    async () => {
      // Reserva de DUAS conexões: com uma só, o aninhamento travaria esperando conexão e o caso
      // provaria o esgotamento da reserva, não a recusa. Com duas, o `sql.begin` de dentro TERIA
      // conexão disponível — e é justamente por isso que a recusa é atribuível à guarda.
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 2,
      });

      try {
        let pidExterno = -1;
        let capturado: unknown;

        await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => {
            const [linha] = await tx.unsafe<{ pid: number }[]>('SELECT pg_backend_pid() AS pid');
            pidExterno = Number(linha?.pid ?? -1);

            // O caso NORMAL a partir da fatia de autorização: serviço A chamando serviço B, cada
            // um abrindo "a sua" unidade de trabalho.
            capturado = await acesso
              .emUnidadeDeTrabalho(async (interna) => {
                await interna`SELECT 1`;
              })
              .then(
                () => undefined,
                (erro: unknown) => erro,
              );
          }),
        );

        expect(capturado).toBeInstanceOf(ErroDeUnidadeAninhada);
        expect((capturado as Error).name).toBe('ErroDeUnidadeAninhada');
        expect((capturado as Error).message).toContain('unidade de trabalho aninhada');
        expect(pidExterno).toBeGreaterThan(0);

        // O controle, obrigatório: uma guarda que recusasse SEMPRE passaria o eixo negativo inteiro
        // e quebraria a operação. Depois que a unidade externa fecha, a próxima abre normalmente —
        // e enxerga a empresa do contexto, o que prova que a marca da transação saiu da cadeia sem
        // levar junto o contexto de tenant.
        const depois = await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, () =>
          observarUnidade(acesso),
        );
        expect(ordenado(depois.acessos)).toEqual(ordenado(IDENTIFICADORES_DE_A));
      } finally {
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-014 — o escritor do contexto de tenant é chamado em exatamente um conjunto de arquivos',
    async () => {
      const fontes = await fontesDeProducao();

      // A varredura viu todo pacote com `src/`, e nenhum deles rendeu zero arquivo. É a diferença
      // entre "não há chamador" e "não se olhou onde ele estaria" — a contagem por pacote existe
      // exatamente para que a segunda hipótese não passe por verde.
      expect(Object.keys(fontes.porPacote).sort()).toEqual(
        expect.arrayContaining(PACOTES_QUE_EXISTEM_HOJE),
      );
      for (const [pacote, quantos] of Object.entries(fontes.porPacote)) {
        expect({ pacote, temFonte: quantos > 0 }).toEqual({ pacote, temFonte: true });
      }

      const varredura = await varrerChamadasAoEscritor(fontes.arquivos);

      // Igualdade de CONJUNTO sobre os arquivos CHAMADORES, e não contagem: o conjunto é hoje
      // exatamente a guarda de contexto de `apps/api`, e um SEGUNDO chamador reprova aqui. Qualquer
      // outra camada que passe a escrever o contexto — a forma pela qual o invariante 2 do
      // CLAUDE.md cai sem quebrar compilação — muda o conjunto e reprova; contagem não faria isso,
      // porque continuaria em um se a guarda saísse e a camada intrusa entrasse no lugar dela.
      expect(arquivosDe(varredura.ocorrencias)).toEqual(CHAMADORES_LEGITIMOS);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-014 (falsificação) — a auditoria reprova a camada intermediária que reescreve o contexto',
    async () => {
      const raiz = await mkdtemp(join(tmpdir(), 'sysloc-escritor-contexto-'));

      try {
        // Controle: o arquivo que DECLARA o escritor não é chamador. Sem esta perna, um detector
        // que casasse a própria declaração reprovaria o código correto — e seria desligado.
        const declaracao = join(raiz, 'contexto.ts');
        await writeFile(
          declaracao,
          await readFile(fileURLToPath(new URL('../src/contexto.ts', import.meta.url)), 'utf8'),
          'utf8',
        );

        const limpa = await varrerChamadasAoEscritor([declaracao]);
        expect(limpa.arquivos).toBe(1);
        expect(limpa.ocorrencias).toEqual([]);

        // O defeito: uma camada intermediária derivando o contexto do PEDIDO — a escalação
        // horizontal que a ADR-0008 descreve como impossível de pegar por revisão.
        const intruso = join(raiz, 'servico-de-contratos.ts');
        await writeFile(
          intruso,
          "import { contextoDeTenant } from '@sysloc/db';\n" +
            'export async function listar(pedido: { headers: Record<string, string> }) {\n' +
            "  return contextoDeTenant.executarCom({ empresaId: pedido.headers['x-empresa'] },\n" +
            '    async () => []);\n' +
            '}\n',
          'utf8',
        );

        const suja = await varrerChamadasAoEscritor([declaracao, intruso]);
        expect(suja.arquivos).toBe(2);
        expect(arquivosDe(suja.ocorrencias)).toEqual([intruso]);
        expect(suja.linhas[0]).toContain('executarCom(');
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-326 — a unidade de trabalho é aberta em exatamente o conjunto declarado de bordas',
    async () => {
      const fontes = await fontesDeProducao();

      // A varredura viu todo pacote com `src/`, e nenhum deles rendeu zero arquivo — a mesma âncora
      // do `CT-014`, e pela mesma razão: é a diferença entre "nenhum serviço abre unidade" e "não se
      // olhou onde ele estaria". Sem ela, um descobridor quebrado passaria por verde.
      expect(Object.keys(fontes.porPacote).sort()).toEqual(
        expect.arrayContaining(PACOTES_QUE_EXISTEM_HOJE),
      );
      for (const [pacote, quantos] of Object.entries(fontes.porPacote)) {
        expect({ pacote, temFonte: quantos > 0 }).toEqual({ pacote, temFonte: true });
      }

      const varredura = await varrerAberturasDeUnidade(fontes.arquivos);
      const chamadores = arquivosDe(varredura.ocorrencias);

      // Eixo POSITIVO da varredura — vem ANTES da igualdade de conjunto porque é **precondição**
      // dela: o predicado achou alguma coisa, e o que ele achou são CHAMADAS, nunca declarações.
      //
      // A ordem não é estética. Um predicado afrouxado a ponto de casar a DECLARAÇÃO faz
      // `packages/db/src/unidade-de-trabalho.ts` — que declara a assinatura duas vezes — entrar como
      // excedente, e o exame de conjunto reprovaria acusando o arquivo CORRETO, como se o pacote de
      // dados abrisse unidade indevida. Aqui a mesma mutação reprova nomeando a linha e o predicado,
      // que é a causa. O mesmo vale para o piso de ocorrências: `ausentes` também pega o regexp que
      // não casa nada, mas relatando quatro bordas sumidas em vez do fato, que é a varredura vazia.
      //
      // SUT_IS_CORRECT_BECAUSE: a rodada 1 fechava este eixo reaplicando `ABERTURA_DE_UNIDADE` a
      // `varredura.linhas`, e `varrerArquivos` só põe em `linhas` a linha para a qual **esse mesmo**
      // predicado já respondeu verdadeiro (`if (casa(linha))`, e o `trim` intermediário não muda
      // casamento). A asserção comparava o valor com o critério que o selecionou e não podia
      // reprovar em árvore nenhuma. O fonte de produção e o varredor estavam certos — vazia era a
      // prova, e o comentário lhe atribuía uma rede que ela não tinha.
      expect(varredura.ocorrencias.length).toBeGreaterThanOrEqual(ABRIDORES_LEGITIMOS.length);
      for (const [indice, linha] of varredura.linhas.entries()) {
        expect(linha, `ocorrência em ${varredura.ocorrencias[indice]}`).not.toMatch(
          DECLARACAO_DE_UNIDADE,
        );
      }

      // Igualdade de CONJUNTO nos dois sentidos, e não contagem. `excedentes` pega o serviço novo
      // que passe a abrir a própria unidade — o defeito que a decisão D1 existe para impedir, e que
      // hoje só está afirmado em quatro cabeçalhos de arquivo. `ausentes` pega a troca que a
      // contagem não veria: a borda deixar de abrir e um serviço entrar no lugar dela.
      expect(
        auditarAberturas(chamadores, ABRIDORES_LEGITIMOS),
        `quem abre unidade de trabalho hoje: ${chamadores.join(', ')}`,
      ).toEqual({ excedentes: [], ausentes: [] });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-326 (falsificação) — a auditoria reprova o serviço que abre a própria unidade',
    async () => {
      const raiz = await mkdtemp(join(tmpdir(), 'sysloc-abertura-de-unidade-'));

      try {
        // Controle: o arquivo que DECLARA a unidade não é chamador. Sem esta perna, um detector que
        // casasse a própria declaração acusaria `packages/db/src/unidade-de-trabalho.ts` — o código
        // correto — e seria desligado por ruído.
        const declaracao = join(raiz, 'unidade-de-trabalho.ts');
        await writeFile(declaracao, await readFile(DECLARACAO_DA_UNIDADE, 'utf8'), 'utf8');

        const limpa = await varrerAberturasDeUnidade([declaracao]);
        expect(limpa.arquivos).toBe(1);
        expect(auditarAberturas(arquivosDe(limpa.ocorrencias), [])).toEqual({
          excedentes: [],
          ausentes: [],
        });

        // O defeito: um dos serviços da fatia — cujo cabeçalho afirma, por extenso, que ele **não**
        // chama `emUnidadeDeTrabalho` — com a chamada reintroduzida. É o desmentido literal daquela
        // frase, e a forma pela qual a decisão D1 cai sem quebrar compilação nem suíte funcional.
        const intruso = join(raiz, 'conjunto.service.ts');
        await writeFile(
          intruso,
          (await readFile(SERVICO_QUE_NAO_ABRE_UNIDADE, 'utf8')) + ABERTURA_REINTRODUZIDA,
          'utf8',
        );

        const suja = await varrerAberturasDeUnidade([declaracao, intruso]);
        expect(suja.arquivos).toBe(2);
        expect(auditarAberturas(arquivosDe(suja.ocorrencias), [])).toEqual({
          excedentes: [intruso],
          ausentes: [],
        });
        expect(suja.linhas[0]).toContain('emUnidadeDeTrabalho(');
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-210 — cada operação que altera o efetivo incrementa o contador uma vez; recusa e nome, nenhuma',
    async () => {
      // Reserva de UMA conexão: as quatro operações correm sobre a mesma conexão física, como a
      // requisição faria — e é sobre ela que a atomicidade entre os dois schemas tem de valer.
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });
      const validacoes: ChamadaDeValidacao[] = [];

      try {
        await restaurarPessoa(acesso);

        // --- Passo 1: o estado inicial -----------------------------------------------------
        const inicial = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        expect(inicial).toEqual({ versao: 0, perfil: PERFIL_SEMEADO, ajustes: [] });

        // --- Passo 2: o ajuste válido ------------------------------------------------------
        const versaoDoAjuste = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            escreverAjustes(tx, {
              usuarioId: PESSOA_DO_CASO.usuarioId,
              ajustes: AJUSTE_COERENTE,
              validarCoerencia: regraQueRegistra(validacoes),
            }),
          ),
        );
        expect(versaoDoAjuste).toBe(1);

        const depoisDoAjuste = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        // O conjunto de linhas por extenso, e não a contagem: é o que prova a DECOMPOSIÇÃO da chave
        // canônica `TELA:financeiro` nas duas colunas do trio — `tipo` e `chave` separados, sem o
        // prefixo repetido dentro de `chave`.
        expect(depoisDoAjuste).toEqual({
          versao: 1,
          perfil: PERFIL_SEMEADO,
          ajustes: [{ tipo: 'TELA', chave: 'financeiro', efeito: 'CONCEDIDA' }],
        });

        // --- Passo 3: a troca de perfil ----------------------------------------------------
        const versaoDaTroca = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            trocarPerfilDaPessoa(tx, {
              usuarioId: PESSOA_DO_CASO.usuarioId,
              perfil: PERFIL_TROCADO,
            }),
          ),
        );
        expect(versaoDaTroca).toBe(2);

        const depoisDaTroca = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        expect(depoisDaTroca).toEqual({ versao: 2, perfil: PERFIL_TROCADO, ajustes: [] });

        // --- Passo 4: o ajuste incoerente, RECUSADO ----------------------------------------
        const capturado = await contextoDeTenant
          .executarCom(CONTEXTO_DA_EMPRESA_A, () =>
            acesso.emUnidadeDeTrabalho((tx) =>
              escreverAjustes(tx, {
                usuarioId: PESSOA_DO_CASO.usuarioId,
                ajustes: AJUSTE_INCOERENTE,
                validarCoerencia: regraQueRegistra(validacoes, RECUSA_DE_COERENCIA),
              }),
            ),
          )
          .then(
            () => undefined,
            (erro: unknown) => erro,
          );

        // A recusa do domínio atravessa INTACTA — a mesma instância, não um erro genérico que a
        // camada de dados tenha embrulhado e cuja causa a rota não conseguiria classificar.
        expect(capturado).toBe(RECUSA_DE_COERENCIA);

        const depoisDaRecusa = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        // Contador onde estava, e NENHUMA das duas linhas do pedido gravada — nem a coerente.
        expect(depoisDaRecusa).toEqual(depoisDaTroca);

        // --- Passo 5: a escrita que NÃO toca permissão -------------------------------------
        // Emitida à mão de propósito: o que se prova é que o incremento é da OPERAÇÃO de permissão,
        // e não um gatilho pendurado na tabela que qualquer atualização dispararia.
        await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => {
            await tx`
              UPDATE identidade.usuario
                 SET nome = ${'Artur Amaral (renomeado pelo CT-210)'}
               WHERE id = ${PESSOA_DO_CASO.usuarioId}
            `;
          }),
        );

        const depoisDoNome = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        expect(depoisDoNome).toEqual(depoisDaTroca);

        // --- A regra de domínio: chamadas e ARGUMENTOS exatos ------------------------------
        // O perfil não é escolhido pelo caso: ele é lido do banco DENTRO da transação. A prova é
        // que o segundo valor é o perfil TROCADO no passo 3 — uma implementação que recebesse o
        // perfil do chamador, ou que o lesse antes da transação, não teria como acompanhá-lo.
        expect(validacoes).toEqual([
          { perfil: PERFIL_SEMEADO, ajustes: comoTextoOsAjustes(AJUSTE_COERENTE) },
          { perfil: PERFIL_TROCADO, ajustes: comoTextoOsAjustes(AJUSTE_INCOERENTE) },
        ]);
      } finally {
        await restaurarPessoa(acesso);
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-210 (atomicidade) — desfeita a unidade, o ajuste em `negocio` e o contador em `identidade` somem juntos',
    async () => {
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });
      const validacoes: ChamadaDeValidacao[] = [];

      try {
        await restaurarPessoa(acesso);

        let dentroDaTransacao: EstadoDaPessoa | undefined;

        const capturado = await contextoDeTenant
          .executarCom(CONTEXTO_DA_EMPRESA_A, () =>
            acesso.emUnidadeDeTrabalho(async (tx) => {
              const versao = await escreverAjustes(tx, {
                usuarioId: PESSOA_DO_CASO.usuarioId,
                ajustes: AJUSTE_COERENTE,
                validarCoerencia: regraQueRegistra(validacoes),
              });
              expect(versao).toBe(1);

              // O eixo POSITIVO, sem o qual "sumiu tudo" também ficaria verde sobre uma
              // implementação que não escreve nada: dentro da transação, as duas pontas já estão
              // gravadas — o contador em `identidade` e a linha em `negocio`.
              dentroDaTransacao = await lerEstadoDaPessoa(tx);

              throw DESFAZIMENTO_PEDIDO;
            }),
          )
          .then(
            () => undefined,
            (erro: unknown) => erro,
          );

        expect(capturado).toBe(DESFAZIMENTO_PEDIDO);
        expect(dentroDaTransacao).toEqual({
          versao: 1,
          perfil: PERFIL_SEMEADO,
          ajustes: [{ tipo: 'TELA', chave: 'financeiro', efeito: 'CONCEDIDA' }],
        });

        // E depois do desfazimento, as DUAS pontas voltaram — o que só é possível se elas
        // estiverem no mesmo commit. Duas conexões perderiam a atomicidade aqui, em silêncio: o
        // contador de `identidade`, escrito fora desta transação, sobreviveria ao `ROLLBACK`.
        const depois = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        expect(depois).toEqual({ versao: 0, perfil: PERFIL_SEMEADO, ajustes: [] });
      } finally {
        await restaurarPessoa(acesso);
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-210 (conjunto vazio) — escrever nenhum ajuste remove todos e incrementa o contador uma vez',
    async () => {
      // O pedido que zera os ajustes de uma pessoa é entrada LEGÍTIMA da escrita — é como o Admin
      // desfaz todos os desvios sobre a matriz do perfil. Ele exercita a inserção em massa com
      // arranjos vazios, que é o caminho em que uma implementação por `unnest` falharia sem que
      // nenhum outro caso passasse por ali; e continua sendo alteração do efetivo, logo incrementa.
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });
      const validacoes: ChamadaDeValidacao[] = [];

      try {
        await restaurarPessoa(acesso);

        await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            escreverAjustes(tx, {
              usuarioId: PESSOA_DO_CASO.usuarioId,
              ajustes: AJUSTE_COERENTE,
              validarCoerencia: regraQueRegistra(validacoes),
            }),
          ),
        );

        const versaoDoVazio = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho((tx) =>
            escreverAjustes(tx, {
              usuarioId: PESSOA_DO_CASO.usuarioId,
              ajustes: [],
              validarCoerencia: regraQueRegistra(validacoes),
            }),
          ),
        );
        expect(versaoDoVazio).toBe(2);

        const depois = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(lerEstadoDaPessoa),
        );
        expect(depois).toEqual({ versao: 2, perfil: PERFIL_SEMEADO, ajustes: [] });

        // A regra de domínio é consultada TAMBÉM no conjunto vazio — retirar tudo é uma decisão de
        // permissão como qualquer outra, e pular a validação nela abriria o caminho de escrever sem
        // passar pela regra.
        expect(validacoes).toEqual([
          { perfil: PERFIL_SEMEADO, ajustes: comoTextoOsAjustes(AJUSTE_COERENTE) },
          { perfil: PERFIL_SEMEADO, ajustes: [] },
        ]);
      } finally {
        await restaurarPessoa(acesso);
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-310 (c) — a recusa por unicidade desfaz só a instrução recusada, e a unidade segue e commita',
    async () => {
      // Reserva de UMA conexão: tudo corre sobre a mesma conexão física, como a requisição faria — e
      // é sobre ela que o alcance do `ROLLBACK TO` tem de valer.
      const acesso = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: 1,
      });

      try {
        // --- UMA unidade de trabalho, do começo ao fim, e ela COMMITA ----------------------------
        const naUnidade = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => {
            // As escritas ANTERIORES à recusa — são elas que têm de sobreviver ao desfazimento.
            const conjunto = await criarConjunto(tx, { nome: NOME_DO_CONJUNTO_DA_COMPOSICAO });
            const primeiro = await criarImovel(tx, dadosDoImovel(conjunto.id, 'Ap 101'));

            // A instrução RECUSADA, na MESMA unidade: o identificador municipal já é do primeiro.
            const recusado = await criarImovel(tx, dadosDoImovel(conjunto.id, 'Ap 102')).then(
              () => undefined,
              (erro: unknown) => erro,
            );

            // As leituras abaixo correm DEPOIS da recusa e dentro da mesma unidade. Elas são metade
            // da prova: sem o ponto de retorno, a violação teria abortado a transação e qualquer
            // instrução daqui em diante falharia com `25P02` — o caso reprovaria aqui, e não numa
            // asserção adiante.
            return {
              conjuntoId: conjunto.id,
              primeiroId: primeiro.id,
              recusado,
              conjuntoDepoisDaRecusa: await localizarConjunto(tx, conjunto.id),
              imoveisDepoisDaRecusa: await imoveisComOIdentificadorDoCaso(tx),
            };
          }),
        );

        // --- A recusa é a NOMEADA, e discriminada -----------------------------------------------
        //
        // O tipo específico, e não "algum erro": o que a porta publica é a classe de domínio, e é
        // por ela que a borda decide o `422`. Um erro de driver subindo cru reprova aqui.
        expect(naUnidade.recusado).toBeInstanceOf(ErroDeIdentificadorMunicipalEmUso);
        expect((naUnidade.recusado as ErroDeIdentificadorMunicipalEmUso).conflito).toBe(
          'EM_CIRCULACAO',
        );

        // --- Dentro da unidade: o que veio antes da recusa continua lá, e só ele -----------------
        expect(naUnidade.conjuntoDepoisDaRecusa?.nome).toBe(NOME_DO_CONJUNTO_DA_COMPOSICAO);
        expect(naUnidade.imoveisDepoisDaRecusa).toEqual([naUnidade.primeiroId]);

        // --- Depois do COMMIT: as escritas anteriores sobreviveram, a recusada não nasceu --------
        //
        // É esta metade que separa "desfez só a instrução" de "desfez tudo": pela rota, cada
        // requisição abre a sua unidade e a recusa a derruba inteira, de modo que os dois desenhos
        // dariam a mesma contagem. Aqui a unidade é uma só, e ela commitou.
        const depoisDoCommit = await contextoDeTenant.executarCom(CONTEXTO_DA_EMPRESA_A, () =>
          acesso.emUnidadeDeTrabalho(async (tx) => ({
            conjunto: await localizarConjunto(tx, naUnidade.conjuntoId),
            imoveis: await imoveisComOIdentificadorDoCaso(tx),
          })),
        );

        expect(depoisDoCommit.conjunto?.id).toBe(naUnidade.conjuntoId);
        expect(depoisDoCommit.conjunto?.nome).toBe(NOME_DO_CONJUNTO_DA_COMPOSICAO);
        // Igualdade de conjunto, e não contagem: um imóvel a mais com o mesmo identificador — a
        // unicidade tendo falhado — e um a menos — o primeiro tendo sido desfeito junto — reprovam
        // os dois aqui.
        expect(depoisDoCommit.imoveis).toEqual([naUnidade.primeiroId]);
      } finally {
        await acesso.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});
