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
 * | CA-02    | CT-014 | O escritor do contexto de tenant (`contextoDeTenant.executarCom`) é chamado
 * |          |        | em exatamente o conjunto declarado de arquivos de produção — exatamente um
 * |          |        | desde a T9, a guarda de CONTEXTO de `apps/api` (`GuardaDeContexto`).
 * |          |        | Qualquer outro chamador reprova. |
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
 *     `.claude/rules/testing-stack.md`, carrega prova de falsificação com as duas pernas.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { connect, createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirAcessoAIdentidade } from '../src/acesso-identidade.ts';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { empresa } from '../src/esquema/identidade.ts';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  EMPRESA_A,
  EMPRESA_B,
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
  'ErroDeUnidadeAninhada',
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
  'esquemaNegocio.negocio',
  'esquemaNegocio.tipoPermissao',
  'semear',
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
});
