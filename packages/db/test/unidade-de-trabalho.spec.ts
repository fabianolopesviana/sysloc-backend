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
 * |          |        | em exatamente o conjunto declarado de arquivos de produção — **um por
 * |          |        | BORDA**: a guarda de CONTEXTO de `apps/api` (`GuardaDeContexto`), a borda
 * |          |        | do trabalho enfileirado da régua (`apps/worker/src/tarefas/regua.ts`, T8 da
 * |          |        | fatia `regua-de-cobranca`), a da entrega da confirmação
 * |          |        | (`apps/worker/src/tarefas/confirmacao-de-email.ts`, T10 da fatia
 * |          |        | `documentos-e-confirmacao`) e a do **ato do titular**
 * |          |        | (`apps/api/src/confirmacoes/confirmacao.service.ts`, T11 da mesma fatia) —
 * |          |        | as três pela ADR-0024. Qualquer outro reprova. |
 * | CA-02    | CT-014 | Um degrau ABAIXO do escritor: a **variável** `app.empresa_id` é ESCRITA
 * |          | (b)    | (`SET LOCAL` ou `set_config`) em exatamente dois arquivos de produção — a
 * |          |        | implementação do escritor único (`unidade-de-trabalho.ts`) e a carga
 * |          |        | inicial (`semente.ts`). É o eixo que o CT-014 não alcança: quem recebe o
 * |          |        | `tx` cru de `emUnidadeDeTrabalho` pode refixar a variável DENTRO da
 * |          |        | transação já aberta, e a RLS obedece ao valor novo até o COMMIT. LEITURA
 * |          |        | (`current_setting`) não é escrita e não pode casar — é como toda política
 * |          |        | consulta o contexto. Fecho do `D10 · F1/T3`. |
 * | CA-03    | CT-310 | A recusa da restrição de unicidade do identificador municipal desfaz **só a
 * | CA-02    | (c)    | instrução recusada**: numa unidade de trabalho ÚNICA, o conjunto e o imóvel
 * |          |        | gravados antes dela sobrevivem, a unidade segue utilizável depois da recusa
 * |          |        | (a leitura que discrimina o conflito corre nela) e o COMMIT preserva os
 * |          |        | dois — enquanto o imóvel recusado não nasce. |
 *
 * | CA-02    | CT-326 | O conjunto de arquivos de PRODUÇÃO que **abrem** unidade de trabalho
 * |          |        | (`emUnidadeDeTrabalho(…)`) é exatamente o conjunto declarado das bordas —
 * |          |        | a guarda de contexto, o ponto único do domínio de locação
 * |          |        | (`sobContextoDaSessao`), os dois chamadores já legítimos da F1, as **duas**
 * |          |        | bordas de trabalho enfileirado e a do **ato do titular**, a rota sem sessão.
 * |          |        | Nenhum serviço abre unidade própria, e qualquer arquivo novo que passe a
 * |          |        | abrir aparece nomeado como excedente. |
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
  // T6 da fatia `contratos-de-locacao`, rodada 2 — a leitura EM LOTE por papel.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a correção do bloqueante `P1` da Revisão Técnica publica UM símbolo
  // novo no índice por decisão declarada. Ela entra pelo critério de sempre — **recebe** o executor
  // de quem já abriu a unidade de trabalho, não abre conexão, não reserva e não devolve executor —,
  // com a razão própria desta leitura: a coleção de fiadores de um contrato **não tem teto** (RD-06),
  // e a conferência de alcance e circulação escrita como uma leitura por item fazia o número de idas
  // ao banco ser escolhido pela requisição, dentro de uma transação que segura conexão de um pool
  // compartilhado entre empresas. O custo passa a ser UMA consulta por papel, independente de N.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'localizarPessoas',
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
  'esquemaNegocio.identidadeNoProvedor',
  'esquemaNegocio.imovel',
  'esquemaNegocio.locador',
  'esquemaNegocio.locatario',
  'esquemaNegocio.statusLocacao',
  'esquemaNegocio.tipoImovel',
  'esquemaNegocio.tipoPessoa',
  // T3 da fatia `contratos-de-locacao` — as DUAS tabelas do contrato e o enum de estado, criados
  // pela migração `0007`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica três símbolos novos no schema por decisão declarada na
  // §1 da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério das nove da T2: são
  // **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda precisa de um
  // executor para chegar ao banco, e o executor não sai do índice.
  //
  // As duas funções `SECURITY DEFINER` da mesma task (`garantir_contador_de_contrato` e
  // `proximo_numero_de_contrato`) **não aparecem aqui**, e a ausência não é esquecimento: elas são
  // objetos do BANCO, criados pela migração `0008`, e não símbolos deste pacote. Quem as publicará
  // como função de domínio é a T5, em `packages/db/src/contrato.ts`.
  'esquemaNegocio.contrato',
  'esquemaNegocio.contratoFiador',
  'esquemaNegocio.statusContrato',
  // T3 da fatia `cobranca-e-mora` — as DUAS tabelas da cobrança e os DOIS enums, criados pela
  // migração `0009`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica quatro símbolos novos no schema por decisão declarada na
  // §1 da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério das três da T3
  // anterior: são **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda
  // precisa de um executor para chegar ao banco, e o executor não sai do índice.
  //
  // `statusCobranca` é declarado sem que coluna de tabela alguma o use, e a assimetria é a decisão:
  // o estado é DERIVADO (ADR-0022), e o tipo é o da coluna `status` da VISÃO `cobranca_derivada`,
  // criada pela `0010`. A visão, a função `data_corrente_da_operacao` e as duas funções da série da
  // cobrança **não aparecem aqui** pela mesma razão que as duas do contrato não apareciam: são
  // objetos do BANCO, e não símbolos deste pacote. Quem as publicará como função de domínio é a T4,
  // em `packages/db/src/cobranca.ts`.
  'esquemaNegocio.cobranca',
  'esquemaNegocio.configuracaoDeMora',
  'esquemaNegocio.naturezaCobranca',
  'esquemaNegocio.statusCobranca',
  // T3 da fatia `regua-de-cobranca` — as DUAS tabelas da régua e os TRÊS enums, criados pela
  // migração `0011`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica cinco símbolos novos no schema por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério dos quatro da T3
  // anterior: são **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda
  // precisa de um executor para chegar ao banco, e o executor não sai do índice.
  //
  // O `FORCE ROW LEVEL SECURITY`, as duas políticas e os três `GRANT USAGE ON TYPE` **não aparecem
  // aqui** pela mesma razão que a visão e as funções da cobrança não apareciam: são objetos e
  // atributos do BANCO, criados pela migração autoral `0012`, e não símbolos deste pacote. Quem
  // publicará a PORTA destas duas tabelas como função de domínio é a T5, em
  // `packages/db/src/automacao-de-cobranca.ts`.
  'esquemaNegocio.caminhoDoAviso',
  'esquemaNegocio.canalDeAviso',
  'esquemaNegocio.desfechoDoAviso',
  'esquemaNegocio.envioDeCobranca',
  'esquemaNegocio.politicaDeAviso',
  // T3 da fatia `documentos-e-confirmacao` — a tabela do portador da confirmação, criada pela
  // migração `0013`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica UM símbolo novo no schema por decisão declarada na §1 da
  // task (`Símbolos públicos criados`). Ele entra pelo mesmo critério dos cinco da T3 anterior: é
  // **declaração de estrutura**, não caminho para dado — quem o tem em mãos ainda precisa de um
  // executor para chegar ao banco, e o executor não sai do índice.
  //
  // A coluna nova de `locatario` (`email_confirmado_em`) **não aparece aqui**, e não é esquecimento:
  // ela é campo de uma tabela já declarada, e `esquemaNegocio.locatario` já consta do conjunto desde
  // a T2 da fatia de cadastro. O `FORCE ROW LEVEL SECURITY`, a política e a função
  // `resolver_portador_de_confirmacao` também não aparecem, pela mesma razão que a visão e as
  // funções da cobrança não apareciam: são objetos e atributos do BANCO, criados pela migração
  // autoral `0014`, e não símbolos deste pacote. Quem publicará a PORTA desta tabela como função de
  // domínio é a T8, em `packages/db/src/portador-de-confirmacao.ts`.
  //
  // **Nenhuma entrada anterior sai por acréscimo**; a única saída desta task é de CAMPO, não de
  // símbolo (`pdfContratoArquivo`, ADR-0030), e campo não é observável por este caso.
  'esquemaNegocio.portadorDeConfirmacao',
  // T4 da fatia `fundacao-bancaria` — a tabela do certificado do provedor, criada pela migração
  // `0015`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica UM símbolo novo no schema por decisão declarada na §1 da
  // task (`Símbolos públicos criados`). Ele entra pelo mesmo critério do símbolo da T3 anterior: é
  // **declaração de estrutura**, não caminho para dado — quem o tem em mãos ainda precisa de um
  // executor para chegar ao banco, e o executor não sai do índice.
  //
  // Os objetos que a migração autoral `0016` cria **não aparecem aqui**, e não é esquecimento: o
  // `FORCE ROW LEVEL SECURITY`, a política, a sequência `plataforma.identificador_bancario_seq` e a
  // função `plataforma.proximo_identificador_bancario()` são objetos e atributos do BANCO, e não
  // símbolos deste pacote — a mesma razão pela qual a visão e as funções da cobrança nunca
  // apareceram. **O schema `plataforma` também não é declarado no Drizzle**: ele não tem tabela
  // alguma (o roster da ADR-0031 é vazio nesta fatia), e declarar um `pgSchema` sem tabela publicaria
  // um símbolo que não descreve estrutura nenhuma. Quem publicará a PORTA desta tabela como função de
  // domínio é a T7, em `packages/db/src/certificado-do-provedor.ts`.
  //
  // **Nenhuma entrada anterior sai.**
  'esquemaNegocio.certificadoDoProvedor',
  // T2 da fatia `emissao-e-conciliacao` — as QUATRO tabelas da emissão e da conciliação e os TRÊS
  // enums que elas usam, criados pela migração `0017`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T2 publica sete símbolos novos no schema por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério do símbolo da T4
  // anterior: são **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda
  // precisa de um executor para chegar ao banco, e o executor não sai do índice.
  //
  // O QUARTO arranjo que a T1 publicou em `@syslocbr/contracts` — `ESTADOS_DA_EMISSAO_EM_LOTE` — **não
  // tem símbolo aqui**, e a ausência é a decisão, não esquecimento: o estado do lote é DERIVADO dos
  // dois instantes de desfecho (ADR-0022), de modo que não há tipo enumerado no banco a declarar. É
  // a mesma assimetria de `statusCobranca`, na direção oposta: lá o tipo existe sem coluna de tabela
  // porque a VISÃO o usa; aqui não existe tipo algum porque nada o guarda.
  //
  // Os objetos que a migração autoral `0018` cria **não aparecem aqui**, pela razão de sempre: o
  // `FORCE ROW LEVEL SECURITY`, as quatro políticas e os três `GRANT USAGE ON TYPE` são objetos e
  // atributos do BANCO, e não símbolos deste pacote. A coluna nova de `cobranca`
  // (`identificador_no_provedor`) também não: ela é campo de uma tabela já declarada, e
  // `esquemaNegocio.cobranca` consta do conjunto desde a T3 da fatia `cobranca-e-mora`.
  //
  // **Nenhuma entrada anterior sai.**
  'esquemaNegocio.conferenciaBancaria',
  'esquemaNegocio.desfechoDoItemDoLote',
  'esquemaNegocio.emissaoEmLote',
  'esquemaNegocio.eventoBancario',
  'esquemaNegocio.itemDaEmissaoEmLote',
  'esquemaNegocio.origemDoEventoBancario',
  'esquemaNegocio.tipoDeEventoBancario',
  // T2 da fatia `webhook-e-carne` — o TERCEIRO schema do produto (`plataforma`, ADR-0031) e os dois
  // símbolos da notícia crua do provedor, criados pela migração `0019`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T2 publica três símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério de todos os anteriores:
  // são **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda precisa de um
  // executor para chegar ao banco, e o executor não sai do índice. O eixo das marcas de cliente
  // continua valendo sobre cada um deles.
  //
  // ⚠️ **O namespace se chama `esquemaPlataforma`, e não `esquemaNegocio`**, porque a tabela que ele
  // declara vive fora do schema de negócio por decisão da ADR-0031: ela é gravada antes do
  // roteamento e, quando o recebido não casa com cobrança alguma, não tem empresa derivável. Ela é a
  // ÚNICA tabela deste pacote sem `empresa_id` e sem RLS, e as duas ausências são afirmadas contra o
  // catálogo pelo `CT-994`.
  //
  // O `RENAME COLUMN` que a mesma migração aplica a `negocio.cobranca` (`nosso_numero` →
  // `numero_do_titulo_no_provedor`) **não acrescenta símbolo algum aqui**: é campo de uma tabela já
  // declarada, e `esquemaNegocio.cobranca` consta do conjunto desde a T3 da fatia `cobranca-e-mora`.
  // Mesma leitura que a coluna `identificador_no_provedor` recebeu na fatia anterior.
  //
  // **Nenhuma entrada anterior sai.**
  // T4 da fatia `integracao-bancaria-autonoma` — a tabela do estado da entrega da notícia, criada
  // pela migração `0023`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica UM símbolo novo no schema por decisão declarada na §1 da
  // task (`Símbolos públicos criados`). Ele entra pelo mesmo critério de todos os anteriores: é
  // **declaração de estrutura**, não caminho para dado — quem o tem em mãos ainda precisa de um
  // executor para chegar ao banco, e o executor não sai do índice. O eixo das marcas de cliente
  // continua valendo sobre ele.
  //
  // ⚠️ **O namespace é `esquemaNegocio`, e não `esquemaPlataforma`**: a tabela tem dono-empresa, e a
  // ADR-0031 pela CONTRAPOSITIVA a manda para `negocio`. O roster de `plataforma` permanece com as
  // mesmas entradas que a fatia anterior lhe deu.
  //
  // Os objetos que a migração autoral `0024` cria **não aparecem aqui**, pela razão de sempre: o
  // `FORCE ROW LEVEL SECURITY` e a política são objetos e atributos do BANCO, não símbolos deste
  // pacote. **Nenhum enum novo**: a tabela não tem coluna de união fechada — o estado é um booleano
  // e o motivo é texto do provedor, verbatim.
  //
  // **Nenhuma entrada anterior sai.**
  'esquemaNegocio.entregaDaNoticia',
  'esquemaPlataforma.desfechoDaNotificacao',
  'esquemaPlataforma.notificacaoBancaria',
  'esquemaPlataforma.plataforma',
  // T3 da fatia `webhook-e-carne` — as SETE operações da notícia crua do provedor, ordenadas no
  // conjunto pela posição de cada nome (a comparação é sobre a lista ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica sete símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Elas entram pelo critério de sempre — **recebem** o
  // executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem
  // executor —, com duas razões a mais, próprias desta entidade.
  //
  // A primeira é a **ausência de dono**: `plataforma.notificacao_bancaria` não tem `empresa_id`, não
  // habilita RLS e nenhuma política a alcança (ADR-0031), de modo que não há política a recortar o
  // que uma consulta escrita fora do pacote veria — o alcance à tabela só é enumerável por símbolo, e
  // é este conjunto que o torna verificável.
  //
  // A segunda é a **assimetria de contexto**: `rotearNotificacaoBancaria` corre fora de qualquer
  // contexto de tenant — a empresa é o RESULTADO dela — e invoca, pelo executor recebido, a função
  // `SECURITY DEFINER` da migração `0020`. Publicá-la é o que impede a borda de compor por fora um
  // `SELECT … WHERE identificador_no_provedor = $1` contra `negocio.cobranca`, que é o segundo
  // caminho para o dado que a ADR-0008 recusa.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `DIAS_DE_RETENCAO_DO_CRU`, pelo mesmo
  // critério de `empresaDoContexto` e das constantes do portador — é mecanismo interno do expurgo.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que elas publicam (`AjustesDoDesfecho`, `DesfechoDoTratamento`,
  // `NotificacaoBancariaPersistida`, `NotificacaoRecebida`, `NotificacaoRetida`,
  // `RoteamentoDaNotificacao`) não aparecem aqui porque não existem em tempo de execução, e este caso
  // observa o módulo carregado.
  'expurgarNotificacoesVencidas',
  'houveEfeitoDaLiquidacao',
  'lerNotificacaoBancaria',
  'listarRetidas',
  'marcarDesfecho',
  'registrarNotificacaoBancaria',
  'rotearNotificacaoBancaria',
  // T4 da fatia `cobranca-e-mora` — a PORTA da cobrança: as três operações do ciclo de vida, as DUAS
  // da série e a classe de erro da tradução de unicidade, ordenadas no conjunto pela posição de cada
  // nome (a comparação é sobre a lista ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica seis símbolos novos no índice por decisão declarada na §1 e
  // na §5.2 da task. O critério é o mesmo de todas as portas anteriores: elas **recebem** o executor
  // de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem executor.
  // Isso vale inclusive para as duas da série (`garantirContadorDeCobranca`, `emitirNumeroDeCobranca`),
  // que invocam pelo executor recebido as funções `SECURITY DEFINER` da migração `0010` — a aplicação
  // nunca alcança a sequência, e o `CT-535` afirma que ela sequer tem privilégio para tanto.
  //
  // `ErroDeCodigoDeCobrancaEmUso` entra pelo MESMO critério de `ErroDeCodigoEmUso`, de
  // `ErroDeUnidadeAninhada` e de `ErroDeIdentificadorMunicipalEmUso`: é classe de erro, não caminho
  // para dado. Ela sai daqui porque quem a traduz no envelope da ADR-0017 (`422 CAMPO_INVALIDO` com
  // `campo: "codigo"`) é a borda, na T5.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `gravarSobRestricaoDoCodigo` e
  // `ehViolacaoDe`, de `src/cobranca.ts`. Elas são compostas por dentro da própria porta — ao
  // contrário de `gravarCadastroSobRestricaoDeUnicidade`, cuja publicação existe para preservar as
  // provas que observam a violação crua. `colunasDaCobranca` e `predicadoDaCarteira` ficam dentro pelo
  // critério de `empresaDoContexto`: são fragmentos de SQL, e publicá-los daria à borda pedaços de
  // instrução para compor.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que ela publica (`DadosDaCobranca`, `FiltrosDaCarteira`, `JanelaDaCarteira`,
  // `LinhaDeCobranca`, `PaginaDeCobrancasPersistidas`) não aparecem aqui porque não existem em tempo
  // de execução, e este caso observa o módulo carregado.
  //
  // SUT_IS_CORRECT_BECAUSE: a T5 publica **um** símbolo novo — `lerAnoDaSerieDeCobranca` —, e o
  // conjunto é EXATO de propósito. Ele entra pelo MESMO critério das duas da série: recebe o executor
  // de quem já abriu a unidade, não abre conexão, não reserva e não devolve executor. Ele é publicado
  // porque é o **eixo único de data** da série da cobrança — o mesmo
  // `negocio.data_corrente_da_operacao()` que a visão consulta para classificar a linha —, e ter o
  // eixo com nome é o que torna verificável a afirmação de que o contador, o número, o código e o
  // estado concordam: um segundo eixo apareceria aqui como símbolo excedente, e não como um
  // `current_date` escondido numa consulta. Ele fecha o débito **D7 (F3/T4)**, cujo gatilho declarado
  // era esta task. **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo
  // asserida.
  //
  // SUT_IS_CORRECT_BECAUSE: a T7 publica **dois** símbolos novos — `acusarPagamentoDeCobranca` e
  // `cancelarCobranca`, as duas transições da cobrança —, e o conjunto é EXATO de propósito. As duas
  // entram pelo critério de todas as portas anteriores: **recebem** o executor de quem já abriu a
  // unidade, não abrem conexão, não reservam e não devolvem executor, e nenhuma recebe `empresaId`.
  //
  // A do pagamento é publicada porque a gravação dos dois fatos e o carimbo dos **quatro** valores são
  // **uma instrução só**, que lê `negocio.cobranca_derivada` no `FROM`: publicá-la é o que impede a
  // borda de compor o par "ler a mora, gravar o pagamento", em que a mora carimbada seria a de uma
  // leitura anterior e a fórmula acabaria reescrita fora da visão (ADR-0022, ADR-0023). A do
  // cancelamento é publicada porque **não é idempotente** por decisão — quem recusa a repetição é a
  // guarda de estado da borda, com o estado atual nomeado —, e um `UPDATE` condicional escrito por fora
  // silenciaria a segunda tentativa.
  //
  // Nenhuma das duas confere estado: a guarda é da aplicação, e o que impede a linha incoerente de
  // existir são os dois `CHECK` do banco. O tipo que a primeira publica (`DesfechoDoPagamento`) não
  // aparece aqui porque não existe em tempo de execução, e este caso observa o módulo carregado.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // SUT_IS_CORRECT_BECAUSE: a T9 publica **dois** símbolos novos — `emitirNumerosDeCobranca` e
  // `criarCobrancasEmLote` —, e o conjunto é EXATO de propósito. Eles entram pelo critério de todas as
  // portas anteriores: **recebem** o executor de quem já abriu a unidade, não abrem conexão, não
  // reservam, não devolvem executor e não recebem `empresaId`.
  //
  // O primeiro não abre exceção ao que as duas da série já registram: ele invoca a MESMA função
  // `SECURITY DEFINER` da migração `0010`, **uma vez por número**, e o que muda é quantas idas ao banco
  // isso custa — uma, e não N. A aplicação continua sem alcançar a sequência, e o `CT-535` afirma que
  // ela sequer tem privilégio para tanto. O segundo é publicado porque a escrita das parcelas é **um
  // `INSERT` de N linhas**: publicar a porta é o que impede a borda de compor o laço "emitir número,
  // gravar, reler a visão" por parcela — em que o número de idas ao banco passaria a ser escolhido pelo
  // prazo que o cliente contratou, e em que o `SAVEPOINT` da tradução da colisão do código, que é ponto
  // único DENTRO da porta, nasceria esquecido.
  //
  // Os dois são o que a ativação do contrato consome para fechar o débito **D28 (F2/T7)**, cujo gatilho
  // declarado era esta fatia. `gravarSobRestricaoDoCodigo` continua **dentro** do pacote, como os gêmeos
  // de `./contrato.ts`: ela é composta por dentro das próprias portas. **Nenhuma entrada anterior sai**,
  // e a igualdade (nunca contenção) segue sendo asserida.
  //
  // SUT_IS_CORRECT_BECAUSE: a T10 publica **um** símbolo novo — `cancelarCobrancasDoContrato`, a
  // cascata do cancelamento do contrato —, e o conjunto é EXATO de propósito. Ela entra pelo critério
  // de todas as portas anteriores: **recebe** o executor de quem já abriu a unidade, não abre conexão,
  // não reserva, não devolve executor e não recebe `empresaId`.
  //
  // Ela é publicada porque o **predicado é a regra de negócio**: cancelar as cobranças canceláveis de
  // um contrato é `pago_em IS NULL AND cancelado_em IS NULL`, e publicar a porta é o que impede a borda
  // de compor o par "listar as em aberto pela visão, cancelar uma a uma" — que seria a segunda
  // avaliação do estado que o marcador `DECISÃO FECHADA` de `src/cobranca.ts` existe para tornar
  // impossível, e que gravaria com base numa leitura anterior à escrita. Ela devolve **quantas linhas o
  // banco alcançou**, e conjunto vazio é resultado legítimo — a recusa por estado do contrato continua
  // sendo da guarda da aplicação. **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção)
  // segue sendo asserida.
  'ErroDeCodigoDeCobrancaEmUso',
  'acusarPagamentoDeCobranca',
  'cancelarCobranca',
  'cancelarCobrancasDoContrato',
  'criarCobranca',
  'criarCobrancasEmLote',
  'emitirNumeroDeCobranca',
  'emitirNumerosDeCobranca',
  'garantirContadorDeCobranca',
  'lerAnoDaSerieDeCobranca',
  'listarCobrancas',
  'localizarCobranca',
  // T6 da fatia `cobranca-e-mora` — a PORTA da política de multa e juros: a leitura e o `upsert`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T6 publica dois símbolos novos no índice por decisão declarada na §1 e
  // na §5.2 da task. As duas entram pelo critério de todas as portas anteriores: **recebem** o
  // executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem
  // executor, e nenhuma recebe `empresaId` — o escopo é da política do banco (ADR-0008).
  //
  // `gravarConfiguracaoDeMora` é publicada porque a escrita é um `INSERT … ON CONFLICT (empresa_id)
  // DO UPDATE` de **um comando só**: publicar a porta é o que impede a borda de escrever por conta
  // própria o par "ler, decidir, gravar", que passa em todos os casos felizes e perde escrita sob
  // concorrência. `lerConfiguracaoDeMora` é publicada porque é ela que traduz a **ausência de linha**
  // nos zeros que a apuração da view já produz por `COALESCE` — é a RD-21 concordando com a RD-08 —,
  // e um segundo tradutor apareceria aqui como símbolo excedente, e não como um `?? 0` escondido num
  // serviço.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `colunasDaConfiguracao`, pelo critério de
  // `colunasDaCobranca` e de `empresaDoContexto` — é fragmento de SQL, e publicá-lo daria à borda
  // pedaços de instrução para compor. `POLITICA_AUSENTE` e `configuracaoPublicada` ficam dentro pelo
  // mesmo motivo de `cobrancaPublicada`: são o mecanismo interno da tradução, não caminho para dado.
  //
  // O tipo que elas publicam (`ConfiguracaoDeMoraPersistida`) não aparece aqui porque não existe em
  // tempo de execução, e este caso observa o módulo carregado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'gravarConfiguracaoDeMora',
  'lerConfiguracaoDeMora',
  // T5 da fatia `regua-de-cobranca` — as DUAS portas da régua: a política de aviso
  // (`src/politica-de-aviso.ts`) e o predicado, o relógio, o registro e o histórico
  // (`src/envio-de-cobranca.ts`).
  //
  // ⚠️ O comentário da T3, acima, antecipava um arquivo único chamado `automacao-de-cobranca.ts`. A
  // T5 os partiu em DOIS, e o corte é por objeto: a política é configuração singular por empresa (o
  // molde de `configuracao-de-mora.ts`), o envio é fato registrado mais o predicado que o consome.
  // Fundi-los poria a leitura de `GET /v1/automacao-de-cobranca` no mesmo arquivo da consulta mais
  // cara da fatia, e nenhum dos dois cabeçalhos poderia declarar uma decisão só.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica OITO símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Sete entram pelo critério de todas as portas anteriores:
  // **recebem** o executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam,
  // não devolvem executor e nenhuma recebe `empresaId` — o escopo é da política do banco (ADR-0008).
  //
  // `selecionarCandidatasAoAviso` é publicada porque a elegibilidade **participa de seleção**, e a
  // ADR-0023 manda a derivação que participa morar no banco: publicar a porta é o que impede o job de
  // compor por fora o par "listar a carteira, decidir quem entra", que seria a segunda avaliação do
  // estado que o marcador `DECISÃO FECHADA` de `src/cobranca.ts` existe para tornar impossível. Ela é
  // também o que **satisfaz** `PortaDeCandidatas`, declarada em `@sysloc/regua` (ADR-0025) — a seta é
  // `db → regua`, e a inversa fecha um ciclo que o Turborepo aborta.
  //
  // `lerHoraCorrenteDaOperacao` entra pelo MESMO critério de `lerAnoDaSerieDeCobranca`: é o **eixo
  // único de hora do dia** da fatia (ADR-0026), e ter o eixo com nome é o que torna verificável a
  // afirmação de que não há segundo relógio — ele apareceria aqui como símbolo excedente, e não como
  // um `new Date()` escondido no job.
  //
  // `POLITICA_DE_AVISO_AUSENTE` entra por critério diferente das sete, e é o que o torna admissível:
  // é **contrato publicado** — o corpo que a leitura devolve a toda empresa que nunca configurou —, e
  // não caminho para dado nenhum. Ele diverge do gêmeo `POLITICA_AUSENTE` de
  // `src/configuracao-de-mora.ts`, que fica dentro, porque aqui há consumidores fora do pacote: o job
  // e a borda dizem *"a régua está desligada"* pelo mesmo objeto congelado, em vez de cada um
  // recompor os seis campos.
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `colunasDaPolitica`,
  // `politicaPublicada`, `candidataPublicada`, `envioPublicado`, `DESFECHO_QUE_TRAVA` e os quatro
  // formatos de projeção. Pelo critério de `colunasDaCobranca` e de `empresaDoContexto`, são
  // fragmentos de SQL e mecanismo interno da tradução — e publicar o desfecho que trava daria a quem
  // chama a peça com que recompor o predicado por fora, que é o que a ADR-0023 mantém no banco.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // O tipo que elas publicam (`JanelaDeEnvios`) não aparece aqui porque não existe em tempo de
  // execução, e este caso observa o módulo carregado.
  //
  // SUT_IS_CORRECT_BECAUSE: a **T10** publica o NONO símbolo desta seção,
  // `localizarCandidataAoAviso`, e ele entra pelo mesmo critério das sete portas acima: recebe o
  // executor de quem já abriu a unidade, não abre conexão, não devolve executor e não recebe
  // `empresaId` — o escopo é da política do banco. Ele é a leitura do **disparo manual**, e é
  // publicado porque entrega a **mesma** `CandidataAoAviso` que o predicado entrega, do mesmo
  // fragmento de colunas e das mesmas quatro junções: fosse escrito na borda, a projeção do manual
  // ficaria livre para divergir da do automático, que é exatamente o defeito de origem da fatia
  // (REG-08). Os dois fragmentos que a igualdade produziu — `colunasDaCandidata` e
  // `origemDaCandidata` — **não** saem do pacote, pelo critério de `colunasDaCobranca`. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'POLITICA_DE_AVISO_AUSENTE',
  'contarEnviosDaCobranca',
  'gravarPoliticaDeAviso',
  'lerEnviosDaCobranca',
  'lerHoraCorrenteDaOperacao',
  'lerPoliticaDeAviso',
  'localizarCandidataAoAviso',
  'registrarEnvioDeCobranca',
  'selecionarCandidatasAoAviso',
  // T4 da fatia `contratos-de-locacao` — as DUAS derivações puras da ativação.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica dois símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados: derivarTerminoDaLocacao, derivarValorTotal`). Elas entram
  // pelo MESMO critério de `somarMetragem`, e não pelo das portas: são funções **puras** sobre valor
  // já em mãos — não recebem executor, não abrem conexão, não tocam o banco e não leem relógio.
  //
  // Elas são publicadas porque são a materialização do *ponto único de derivação* que a RD-10 exige,
  // e ter o ponto com nome é o que torna a afirmação verificável: uma segunda derivação da data de
  // fim ou do valor total apareceria aqui como um símbolo excedente, e não como uma linha a mais
  // escondida no serviço que ativa o contrato.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `ultimoDiaDoMes`, `ehBissexto` e
  // `formatarEmUtc`, os três acessórios de `src/derivacao-de-contrato.ts`. Eles são o mecanismo
  // interno das duas derivações; publicá-los daria à borda pedaços da aritmética para recompor, que
  // é exatamente o vazamento que a §7 da task proíbe — quem ativa chama as duas e não recalcula
  // nada. Mesmo critério de `empresaDoContexto` e de `lerComodosDeImoveis`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'derivarTerminoDaLocacao',
  'derivarValorTotal',
  // T8 da fatia `cobranca-e-mora` — a derivação PURA das parcelas de aluguel de um contrato.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T8 publica UM símbolo novo no índice por decisão declarada na §1 e na
  // §3.5 da task (`Símbolos públicos criados: derivarParcelasDoContrato, ParcelaDerivada`). Ela entra
  // pelo MESMO critério das duas acima e de `somarMetragem`, e não pelo das portas: é função **pura**
  // sobre valor já em mãos — não recebe executor, não abre conexão, não toca o banco e não lê relógio.
  //
  // Ela é publicada porque é a materialização do *ponto único de derivação das parcelas* que a RD-18 e
  // a RD-19 exigem, e ter o ponto com nome é o que torna a afirmação verificável: uma segunda
  // derivação de competência, de vencimento ou de referência apareceria aqui como símbolo excedente, e
  // não como um laço a mais escondido no serviço que ativa o contrato.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `ultimoDiaDoMes`, `ehBissexto`,
  // `avancarUmMesComSaturacao`, `recuarUmDia`, `montarReferencia`, `lerData`, `formatarEmIso` e
  // `formatarEmDiaMesAno`, os acessórios de `src/derivacao-de-cobranca.ts`. Eles são o mecanismo
  // interno da derivação; publicá-los daria à borda pedaços da aritmética para recompor, que é
  // exatamente o vazamento que a §7 da task proíbe — quem ativa chama a função e não recalcula nada.
  // Mesmo critério dos três acessórios de `src/derivacao-de-contrato.ts`. Os tipos que ela publica
  // (`ParcelaDerivada`, `ContratoParaParcelas`) não aparecem aqui porque não existem em tempo de
  // execução, e este caso observa o módulo carregado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'derivarParcelasDoContrato',
  // T5 da fatia `contratos-de-locacao` — a PORTA do contrato (treze símbolos) mais a porta estreita
  // da situação de locação do imóvel (um), ordenados no conjunto pela posição de cada nome (a
  // comparação é sobre a lista ordenada).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica catorze símbolos novos no índice por decisão declarada na
  // §1 e na §5.2 da task. O critério é o mesmo de todas as portas anteriores: elas **recebem** o
  // executor de quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem
  // executor. Isso vale inclusive para as DUAS da série (`garantirContadorDeContrato`,
  // `emitirNumeroDeContrato`) e para `lerAnoDaSerieDeContrato`: elas invocam, pelo executor recebido,
  // funções `SECURITY DEFINER` do banco — a aplicação nunca alcança a sequência, e o `CT-431` afirma
  // que ela sequer tem privilégio para tanto.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `lerFiadoresDeContratos`, de
  // `src/contrato.ts`. Ela é a leitura em lote que o próprio módulo consome para montar o agregado, e
  // publicá-la ofereceria a `apps/api` um caminho para ler o vínculo de fiador **sem passar pelo
  // contrato** — mesmo critério de `lerComodosDeImoveis` e de `lerImoveisDeConjuntos`. As duas
  // traduções de unicidade (`gravarSobRestricaoDoCodigo`, `gravarSobIndiceDeVigencia`) também ficam
  // dentro: elas são compostas por dentro das portas, ao contrário de
  // `gravarCadastroSobRestricaoDeUnicidade`, cuja publicação existe para preservar as provas que
  // observam a violação crua.
  //
  // Os tipos que elas publicam (`ContratoPersistido`, `DadosDoContrato`, `DerivacoesDaAtivacao`,
  // `FiadorDoContrato`, `JanelaDeContratos`, `NumeroDaSerie`, `PaginaDeContratosPersistidos`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado.
  'ErroDeCodigoEmUso',
  'ErroDeImovelComContratoVigente',
  'alterarContrato',
  'ativarContrato',
  'cancelarContrato',
  'criarContrato',
  'definirCirculacaoDoContrato',
  'definirSituacaoDeLocacaoDoImovel',
  'emitirNumeroDeContrato',
  'garantirContadorDeContrato',
  'lerAnoDaSerieDeContrato',
  'listarContratos',
  'localizarContrato',
  'substituirFiadoresDoContrato',
  // T7 da fatia `documentos-e-confirmacao` — a leitura do AGREGADO do documento do contrato.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T7 publica UM símbolo novo no índice por decisão declarada na §1 e na
  // §5.2 da task (`Símbolos públicos criados: lerAgregadoDoContrato`). Ela entra pelo MESMO critério
  // de todas as portas anteriores: **recebe** o executor de quem já abriu a unidade de trabalho, não
  // abre conexão, não reserva e não devolve executor. O eixo das marcas de cliente continua valendo
  // sobre ela.
  //
  // Ela é publicada porque é a materialização da *consulta única* que a §12.2 do tech spec exige: o
  // documento imprime cinco entidades, e sem esta porta a borda comporia por fora o laço "ler o
  // contrato, ler cada parte", em que o número de idas ao banco passaria a ser escolhido por quantos
  // fiadores o contrato tem. Uma segunda leitura do mesmo agregado apareceria aqui como símbolo
  // excedente, e não como um laço a mais escondido no serviço que responde a rota.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `parteEmJson` e `imovelEmJson`, de
  // `src/documento-de-contrato.ts`. São o mecanismo interno da projeção, pelo mesmo critério de
  // `colunasDoContrato`. E o tipo `AgregadoDoDocumentoDoContrato` não aparece aqui porque não existe
  // em tempo de execução, e este caso observa o módulo carregado.
  'lerAgregadoDoContrato',
  // T8 da fatia `documentos-e-confirmacao` — a PORTA do portador da confirmação: as QUATRO operações
  // sobre a tabela, mais as DUAS funções puras do segredo.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T8 publica seis símbolos novos no índice por decisão declarada na §1
  // da task (`Símbolos públicos criados`). As quatro operações entram pelo critério de todas as
  // portas anteriores: **recebem** o executor de quem já abriu a unidade de trabalho, não abrem
  // conexão, não reservam, não devolvem executor e nenhuma recebe `empresaId` — o escopo é da
  // política do banco (ADR-0008). `resolverPortador` não abre exceção: ela invoca, pelo executor
  // recebido, a função `SECURITY DEFINER` da migração `0014`, exatamente como as quatro da série
  // invocam as delas.
  //
  // `derivarSegredo` e `gerarSegredo` entram por critério diferente das quatro, e é o que as torna
  // admissíveis: são funções **puras** — não recebem executor, não abrem conexão, não tocam o banco
  // e não leem relógio —, mesmo critério de `somarMetragem` e das três derivações. A primeira é
  // publicada porque é o **ponto único de derivação** do produto: a borda precisa derivar o segredo
  // apresentado antes de resolvê-lo, e uma segunda derivação apareceria aqui como símbolo excedente,
  // e não como um `createHash` escondido num serviço. A segunda sai pelo **par simétrico** da
  // primeira: o sorteio e a derivação do mesmo segredo são um fato só, e publicar metade dele
  // deixaria o índice sugerindo que sortear em outro lugar é legítimo — um segundo `randomBytes` de
  // segredo apareceria aqui como símbolo excedente, exatamente como uma segunda derivação
  // apareceria. Ela **não** é publicada por prova: nenhum consumidor fora deste pacote a importa, e
  // o `CT-729` a alcança pelo caminho direto do módulo (Iron Law #6).
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `BYTES_DO_SEGREDO` e
  // `PRAZO_DE_VALIDADE`, de `src/portador-de-confirmacao.ts`. São o mecanismo interno da emissão,
  // pelo critério de `empresaDoContexto` e dos acessórios de calendário — e publicá-los daria à borda
  // as peças com que recompor o sorteio e o prazo por fora, que é justamente o que a porta mantém
  // dentro. O que a borda precisa saber sobre a **forma** do segredo já é contrato publicado, e vive
  // em `@syslocbr/contracts`.
  //
  // Os tipos que elas publicam (`ConsumoDoPortador`, `PortadorEmitido`, `PortadorResolvido`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado —
  // o mesmo vale para `PessoaAlterada`, o crescimento que a mesma task deu ao retorno de
  // `alterarPessoa`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'consumirPortador',
  'derivarSegredo',
  'emitirPortador',
  'gerarSegredo',
  'invalidarPortadoresDoLocatario',
  'resolverPortador',
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
  // T5 da fatia `fundacao-bancaria` — a guarda de admissão do schema `plataforma`, a SEGUNDA metade
  // da ADR-0031 (a primeira é `verificarCoberturaDeIsolamento`, logo acima).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica UM símbolo de tempo de execução novo no índice por decisão
  // declarada na §5.2 da task. Ela entra pelo MESMO critério da guarda de cobertura: é PERGUNTA sobre
  // o catálogo do sistema, não caminho para dado de negócio — não devolve cliente nem transação, e
  // abre e encerra por dentro a conexão que usa. O caso reprovaria por `excedentes` não porque a
  // superfície cresceu por descuido — que é o defeito que ele existe para pegar —, mas porque cresceu
  // por decisão que ele ainda não conhecia. **Nenhuma entrada anterior sai**, e a igualdade (nunca
  // contenção) segue sendo asserida.
  //
  // Os tipos que ela publica (`AdmissaoDePlataforma`, `ExcecaoDeAdmissao`, `MotivoDeAdmissao`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado.
  // `ROSTER_DE_PLATAFORMA` **não** é publicado pelo índice, e a ausência é deliberada: ele é
  // declaração interna da guarda, sem consumidor fora do pacote — o cabeçalho de `../src/index.ts`
  // registra por quê.
  'conferirAdmissaoDePlataforma',
  // T6 da fatia `fundacao-bancaria` — o mecanismo do identificador perante o provedor: o consumo do
  // contador do SaaS e a composição das 18 posições.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T6 publica QUATRO símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task. `proximoIdentificadorBancario` entra pelo critério de sempre — **recebe** o
  // executor de quem já abriu a unidade de trabalho, não abre conexão, não reserva e não devolve
  // executor —, e não abre exceção ao que as funções de série já registram: ela invoca, pelo executor
  // recebido, a função `SECURITY DEFINER` que a migração `0016` criou, e é por isso que a aplicação
  // nunca precisa (nem pode) tocar a sequência (ADR-0020). `comporIdentificadorBancario` e
  // `LARGURA_DO_CONTADOR_BANCARIO` entram pelo critério de `somarMetragem`: são **puros** sobre valor
  // já em mãos, não recebem executor e não são caminho para dado nenhum.
  // `ErroDeContadorForaDaLargura` entra pelo MESMO critério de `ErroDeUnidadeAninhada` e de
  // `ErroDeCodigoDeCobrancaEmUso`: é classe de erro, não caminho para dado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // `FORMATO_DA_COMPETENCIA` **não** é publicado, e a ausência é deliberada: ele é o mecanismo
  // interno da composição — o cabeçalho de `../src/index.ts` registra por quê. As larguras vêm
  // importadas de `@syslocbr/contracts`, e por isso não há símbolo de largura a mais para publicar aqui
  // além de `LARGURA_DO_CONTADOR_BANCARIO`. O conjunto abaixo é o MESMO da rodada 1 — quatro entradas,
  // nenhuma acrescentada e nenhuma retirada.
  'ErroDeContadorForaDaLargura',
  'LARGURA_DO_CONTADOR_BANCARIO',
  'comporIdentificadorBancario',
  'proximoIdentificadorBancario',
  // T7 da fatia `fundacao-bancaria` — as QUATRO operações do certificado do provedor, mais a única
  // recusa nomeada do módulo.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T7 publica cinco símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task. As quatro operações entram pelo critério de sempre — **recebem** o executor de
  // quem já abriu a unidade de trabalho, não abrem conexão, não reservam e não devolvem executor —,
  // com duas razões próprias desta fatia: a **substituição atômica** (anular o anterior e inserir o
  // novo é um commit só, e compor o par por fora deixaria a empresa sem identidade e sem substituto
  // quando a segunda metade falha) e a **separação do envelope** (`obterEnvelopeCifradoDoVigente` é a
  // única das quatro que devolve `segredo_cifrado`, e ter o caminho com nome é o que torna
  // verificável a afirmação de que ele é um só).
  //
  // `ErroDeCertificadoVencido` entra pelo MESMO critério de `ErroDeUnidadeAninhada` e de
  // `ErroDeContadorForaDaLargura`: é classe de erro, não caminho para dado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // `colunasDoCertificado` **não** é publicado, e a ausência é deliberada: é o mecanismo interno da
  // projeção — o cabeçalho de `../src/index.ts` registra por quê. Os tipos que as portas publicam
  // (`CertificadoGravado`, `DadosDoCertificado`) não aparecem aqui porque não existem em tempo de
  // execução, e este caso observa o módulo carregado.
  'ErroDeCertificadoVencido',
  'lerCertificadoVigente',
  'lerIdentidadeVigente',
  'lerIdentidadeParaUso',
  'lerHistoricoDeCertificados',
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a **T11** publica `lerVigenciaObservada` por decisão registrada no
  // cabeçalho de `../src/index.ts`. Ela entra pelo mesmo critério das quatro acima — recebe o
  // executor de quem já abriu a unidade, não abre conexão, não reserva e não devolve executor — e
  // por uma razão própria: é o eixo de data da operação chegando à borda *"já resolvido, por
  // parâmetro"* (ADR-0026), com a redução do instante a dia feita onde o fuso da operação já mora.
  // Sem ela, a derivação do estado publicado declararia aquele fuso do outro lado da fronteira, e as
  // duas declarações fariam a recusa do registro e o estado da consulta divergirem no mesmo dia.
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida. O tipo
  // `VigenciaObservada` não aparece aqui porque não existe em tempo de execução.
  'lerVigenciaObservada',
  'obterEnvelopeCifradoDoVigente',
  'obterEnvelopeCifradoDaIdentidade',
  'registrarCertificado',
  'registrarIdentidadeNoProvedor',
  // T3 da fatia `emissao-e-conciliacao` — a PORTA da trilha bancária: a escrita do efeito e a
  // leitura da trilha de uma cobrança, criadas em `../src/evento-bancario.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica DOIS símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task. Eles entram pelo critério de todas as portas anteriores: **recebem** o
  // executor de quem já abriu a unidade, não abrem conexão, não reservam, não devolvem executor e
  // — o que é a ADR-0008 aplicada à letra — **não recebem `empresaId`**.
  //
  // A razão própria delas é a ADR-0034: a trilha publicada registra EFEITO, nunca a tentativa que
  // nada mudou, e publicar a porta é o que torna verificável a afirmação de que existe UM caminho
  // para escrever nela — um segundo apareceria aqui como excedente, e não como um `INSERT` a mais
  // escondido no serviço que conversa com o provedor. `lerTrilhaDaCobranca` devolve lista vazia
  // tanto para a cobrança sem trilha quanto para a de outra empresa, e a tradução da ausência em
  // `404` continua sendo da borda, num ponto único.
  //
  // `eventoPublicado` **não** é publicado, e a ausência é deliberada: é o mecanismo interno da
  // tradução, pelo mesmo critério de `envioPublicado` e de `cobrancaPublicada`. Os tipos que a porta
  // publica (`EventoBancarioNovo`, `LinhaDeEventoBancario`) não aparecem aqui porque não existem em
  // tempo de execução, e este caso observa o módulo carregado. `FORMATO_ISO_DO_INSTANTE`, que a T3
  // passou a hospedar em `../src/moldes-de-formatacao.ts` (casa única do molde, no terceiro
  // consumidor), também não: é módulo **interno** do pacote e **não** chega ao índice — se chegasse,
  // apareceria aqui como excedente.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'lerTrilhaDaCobranca',
  'registrarEventoBancario',
  // T4 da fatia `emissao-e-conciliacao` — as SEIS operações do lote e a classe de erro da recusa do
  // lote concorrente, criadas em `../src/emissao-em-lote.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica OITO símbolos novos no índice — os SETE declarados na §1 e
  // na §5.2 da task, mais `ErroDeLoteNaoAlcancado`, prescrito pelo Gate 2 na rodada 3 e publicado no
  // MESMO diff que o cria, que é o que a `.claude/rules/ancoras-de-superficie.md` cobra.
  // As seis operações entram pelo critério de todas as portas anteriores:
  // **recebem** o executor de quem já abriu a unidade, não abrem conexão, não reservam, não devolvem
  // executor e — o que é a ADR-0008 aplicada à letra — **não recebem `empresaId`**.
  //
  // São TRÊS as razões próprias desta porta. A primeira é o **predicado do conjunto**:
  // `selecionarCobrancasSemBoleto` é uma consulta só, e é dela que sai a idempotência da reexecução
  // (`numero_do_titulo_no_provedor IS NULL`) — publicá-la é o que impede o percurso de compor por fora o par "listar a
  // carteira, decidir quem entra", que seria a segunda regra para o mesmo fato e traria o conjunto
  // inteiro para a memória antes de filtrar (ADR-0023). A segunda é o **estado derivado**: não há
  // coluna de estado (ADR-0022), e a derivação dos dois instantes de desfecho tem lar único no módulo
  // — uma segunda apareceria aqui como excedente, e não como um `if` escondido no serviço.
  //
  // A terceira são as DUAS classes de erro, que entram pelo MESMO critério de `ErroDeUnidadeAninhada`,
  // de `ErroDeIdentificadorMunicipalEmUso` e de `ErroDeImovelComContratoVigente`: são classe de erro,
  // não caminho para dado. `ErroDeLoteEmCurso` precisa sair daqui porque quem a traduz no envelope da
  // ADR-0017 — `422` com `detalhes: { loteEmCurso: '…' }` — é a borda, e a alternativa (reconhecer a
  // recusa pelo texto da mensagem, ou capturar `23505` em bloco) amarraria a borda ao idioma do
  // servidor e esconderia as outras duas restrições únicas destas tabelas.
  //
  // `ErroDeLoteNaoAlcancado` é a recusa dos DOIS desfechos quando a escrita não alcança a linha, e ela
  // entrou no índice na rodada 3 por veredito do Gate 2. A razão de ser reconhecível FORA do pacote:
  // zero linhas tem duas causas que a camada de dados não separa — o **reenvio** da tarefa, benigno e
  // previsto (a entrega da fila é *at-least-once*, com o `loteId` viajando na carga), e o alvo errado
  // ou o contexto de tenant montado de outro modo, que é grave. Quem sabe qual delas está acontecendo
  // é o chamador; sem a classe, a borda do processo de trabalho teria de casar TEXTO de mensagem para
  // distinguir o reenvio de uma falha de driver, e trataria o reenvio como falha — queimando as três
  // tentativas. Ela é classe (existe em runtime), e por isso o caso a enxerga, diferente dos tipos.
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `lotePublicado`, `itemPublicado`,
  // `estadoDoLote`, `colunasDoLote` e `lerLoteEmCurso` — mecanismo interno da projeção, da derivação e
  // do discriminante, pelo mesmo critério de `cobrancaPublicada` e de `colunasDaCobranca`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que a porta publica (`CobrancaSemBoleto`, `EmissaoEmLoteNova`, `ItemDoLoteNovo`,
  // `LinhaDoItemDoLote`, `LinhaDoLote`) não aparecem aqui porque não existem em tempo de execução, e
  // este caso observa o módulo carregado.
  'ErroDeLoteEmCurso',
  'ErroDeLoteNaoAlcancado',
  'abrirEmissaoEmLote',
  'concluirLote',
  'interromperLote',
  'lerLote',
  'registrarItemDoLote',
  'selecionarCobrancasSemBoleto',
  // T5 da fatia `emissao-e-conciliacao` — as QUATRO operações da conferência bancária e a classe de
  // erro da conclusão que não alcança a linha, criadas em `../src/conferencia-bancaria.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica CINCO símbolos novos no índice — os QUATRO declarados na §1
  // e na §5.2 da task, mais `ErroDeConferenciaNaoAlcancada`, publicado no MESMO diff que o cria, que é
  // o que a `.claude/rules/ancoras-de-superficie.md` cobra. As quatro operações entram pelo critério
  // de todas as portas anteriores: **recebem** o executor de quem já abriu a unidade, não abrem
  // conexão, não reservam, não devolvem executor e — o que é a ADR-0008 aplicada à letra — **não
  // recebem `empresaId`**.
  //
  // São TRÊS as razões próprias desta porta. A primeira é o **predicado do conjunto a conferir**:
  // `selecionarCobrancasAConferir` é uma consulta só, com a janela dos 30 dias medida contra
  // `negocio.data_corrente_da_operacao()` (ADR-0026) — publicá-la é o que impede o percurso de compor
  // por fora o par "listar a carteira, decidir quem entra", que traria o conjunto inteiro para a
  // memória antes de filtrar (ADR-0023) e daria ao processo de trabalho um SEGUNDO relógio com que
  // recompor a janela.
  //
  // A segunda é o **desfecho duplo da abertura**: `abrirConferencia` devolve `iniciadaAgora`, que
  // separa "abri agora" de "já estava acontecendo" sem que a borda releia coisa alguma — e é isso que
  // permite ao `POST` ser idempotente e responder `200` em vez de um erro que o enum fechado de
  // `CodigoErro` teria de crescer para acomodar. `lerConferenciaEmCurso` é a leitura que responde
  // QUAL execução está em curso e desde quando, e é o mecanismo do desfecho `false`.
  //
  // A terceira é `ErroDeConferenciaNaoAlcancada`, que entra pelo MESMO critério de
  // `ErroDeUnidadeAninhada` e de `ErroDeLoteNaoAlcancado`: é classe de erro, não caminho para dado.
  // Zero linhas na conclusão tem duas causas que a camada de dados não separa — o **reenvio** da
  // tarefa, benigno e previsto (a entrega da fila é *at-least-once*, com o `conferenciaId` viajando na
  // carga `{ empresaId, conferenciaId }`), e o alvo errado ou o contexto de tenant montado de outro
  // modo, que é grave. Quem sabe qual delas está acontecendo é o chamador; sem a classe, a borda do
  // processo de trabalho teria de casar TEXTO de mensagem para distinguir o reenvio de uma falha de
  // driver. Ela é classe (existe em runtime), e por isso o caso a enxerga, diferente dos tipos.
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `conferenciaPublicada`,
  // `colunasDaConferencia` e `arbitroDaConferenciaEmAndamento` — mecanismo interno da projeção e da
  // recusa, pelo mesmo critério de `lotePublicado` e de `colunasDaCobranca`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que a porta publica (`CobrancaAConferir`, `ConferenciaNova`, `ContagensDaConferencia`,
  // `LinhaDaConferencia`) não aparecem aqui porque não existem em tempo de execução, e este caso
  // observa o módulo carregado.
  'ErroDeConferenciaNaoAlcancada',
  'abrirConferencia',
  'concluirConferencia',
  'lerConferenciaEmCurso',
  'selecionarCobrancasAConferir',
  // T6 da fatia `emissao-e-conciliacao` — as CINCO operações do fato bancário da cobrança e a classe
  // de erro da escrita que não alcança a linha, criadas em `../src/boleto-da-cobranca.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T6 publica SEIS símbolos novos no índice — os CINCO declarados na §1 e
  // na §5.2 da task, mais `ErroDeCobrancaNaoAlcancada`, publicado no MESMO diff que o cria, que é o
  // que a `.claude/rules/ancoras-de-superficie.md` cobra. As cinco operações entram pelo critério de
  // todas as portas anteriores: **recebem** o executor de quem já abriu a unidade, não abrem conexão,
  // não reservam, não devolvem executor e — o que é a ADR-0008 aplicada à letra — **não recebem
  // `empresaId`**.
  //
  // São TRÊS as razões próprias desta porta. A primeira é a **RN-07**: `liquidarPeloProvedor` chama
  // `acusarPagamentoDeCobranca` sem alterá-la, de modo que os quatro carimbos de mora da baixa vinda
  // do provedor são, por construção, os mesmos da baixa manual — publicar a porta é o que impede a
  // borda de compor por fora o par "ler a mora, gravar o pagamento", e o que mantém a guarda
  // *"cobrança já paga não é repaga"* dentro da instrução que grava, em vez de num `SELECT` que perde
  // a corrida.
  //
  // A segunda são os **desfechos benignos** que as três escritas condicionais devolvem: a ADR-0034
  // manda não registrar efeito quando nada mudou, e quem percorre precisa saber disso sem reler o
  // estado — um `void` obrigaria a uma segunda avaliação do mesmo fato.
  //
  // A terceira é `ErroDeCobrancaNaoAlcancada`, que entra pelo MESMO critério de
  // `ErroDeUnidadeAninhada`, de `ErroDeLoteNaoAlcancado` e de `ErroDeConferenciaNaoAlcancada`: é
  // classe de erro, não caminho para dado. A recusa que ela carrega é **definitiva** — repetir a
  // tarefa não muda nada —, e sem a classe a borda do processo de trabalho teria de casar TEXTO de
  // mensagem para distingui-la de uma falha de driver. Ela é classe (existe em runtime), e por isso o
  // caso a enxerga, diferente dos tipos.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `exigirCobrancaAlcancavel` e
  // `RECUSA_POR_ATO` — mecanismo interno da separação entre a recusa grave e a benigna, pelo mesmo
  // critério de `lerLoteEmCurso` e de `cobrancaPublicada`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // Os tipos que a porta publica (`AtoSobreOBoleto`, `BoletoDaCobranca`, `BoletoEmitido`,
  // `DesfechoDaLiquidacao`, `DesfechoDoEstorno`, `LiquidacaoInformada`, `RevogacaoAplicada`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado — o
  // mesmo vale para os CINCO campos que a mesma task acrescentou a `LinhaDeCobranca`, que são
  // crescimento de tipo e não de símbolo.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a **T13** da fatia `emissao-e-conciliacao` publica **um** símbolo novo
  // por decisão declarada: `localizarAlvoDoBoleto`, a leitura que devolve o **UUID interno** da
  // cobrança pelo código. Ela entra pelo critério de sempre — **recebe** o executor de quem já abriu
  // a unidade, não abre conexão, não reserva e não devolve executor —, e existe porque
  // `registrarEventoBancario` exige o UUID e nenhuma das duas leituras publicadas o carrega: a
  // projeção da cobrança não tem `id` (não é campo do contrato) e `lerBoletoDaCobranca` é afirmada
  // por igualdade de objeto inteiro em cinco pontos da suíte daquele módulo, de modo que estendê-la
  // seria fazer prova alheia mudar para acomodar consumidor novo. O caso reprovaria por
  // `excedentes` não porque a superfície cresceu por descuido — que é o defeito que ele existe para
  // pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma entrada anterior
  // sai**, e a igualdade (nunca contenção) segue sendo asserida. O tipo `AlvoDoBoleto` **não**
  // aparece abaixo pela razão de sempre: tipo não existe em tempo de execução.
  'ErroDeCobrancaNaoAlcancada',
  'estornarLiquidacao',
  'gravarBoletoDaCobranca',
  'lerBoletoDaCobranca',
  'liquidarPeloProvedor',
  'localizarAlvoDoBoleto',
  'revogarBoleto',
  // T9 da fatia `webhook-e-carne` — a leitura do estado de suspensão da empresa, acrescentada a
  // `../src/empresa.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T9 publica **um** símbolo novo no índice por decisão declarada: a
  // borda do tratamento da notícia precisa saber, no passo B.6, se a empresa dona da cobrança está
  // suspensa (RN-09/CA-10), e a alternativa seria o processo de trabalho escrever
  // `identidade.empresa` numa cadeia de texto — exatamente o alcance não-enumerável que o cabeçalho
  // de `../src/empresa.ts` fecha, e que a contenção de TIPO da §11.2 não alcança.
  //
  // Ela entra pelo critério de todas as portas anteriores: **recebe** o executor de quem já abriu a
  // unidade, não abre conexão, não reserva, não devolve executor — e a razão de **não** haver
  // contexto de tenant a fixar é a ADR-0009 (`identidade` não tem política a aplicar), a mesma que
  // já sustenta as oito operações irmãs deste módulo.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'empresaSuspensa',
  // T10 da fatia `webhook-e-carne` — a seleção do RECORTE do carnê, acrescentada a
  // `../src/cobranca.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T10 publica **um** símbolo novo no índice por decisão declarada: o
  // carnê precisa das cobranças de um contrato num intervalo de competências, **filtradas e
  // ordenadas pelo banco** (ADR-0023), e a alternativa seria a borda listar a carteira inteira do
  // contrato e recortá-la em memória — o segundo caminho para o mesmo recorte que o cabeçalho
  // daquele módulo fecha, e que faria o número de linhas trazidas ser o do contrato inteiro.
  //
  // Ela entra pelo critério de todas as portas anteriores: **recebe** o executor de quem já abriu a
  // unidade, não abre conexão, não reserva, não devolve executor e — a ADR-0008 aplicada à letra —
  // **não recebe `empresaId`**. Ela lê a **visão** `negocio.cobranca_derivada`, como toda leitura de
  // cobrança desta camada.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida. Os dois
  // tipos que a porta publica (`RecorteDeCompetencias`, `CobrancaDoRecorte`) **não** aparecem aqui
  // pela razão de sempre: tipo não existe em tempo de execução.
  'selecionarCobrancasDoRecorte',
  // T4 da fatia `integracao-bancaria-autonoma` — as DUAS operações do estado da entrega da notícia,
  // criadas em `../src/entrega-da-noticia.ts`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica DOIS símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task. Elas entram pelo critério de todas as portas anteriores: **recebem** o
  // executor de quem já abriu a unidade, não abrem conexão, não reservam, não devolvem executor e —
  // o que é a ADR-0008 aplicada à letra — **não recebem `empresaId`**.
  //
  // A razão própria desta porta é a **substituição sem corrida** (RN-04): `gravarDesfechoDaEntrega`
  // é uma instrução só, com `ON CONFLICT` sobre a restrição única de `empresa_id`, e publicá-la é o
  // que torna verificável a afirmação de que existe UM caminho para escrever o estado — um segundo
  // apareceria aqui como excedente, e é justamente nele que a leitura-antes-de-gravar (e a corrida
  // junto) reapareceria. O instante da verificação **não é parâmetro**: ele nasce de
  // `pg_catalog.now()` dentro da mesma instrução (ADR-0026), e não há `new Date()` no caminho.
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `colunasDoEstado` e `comporEstado`
  // — mecanismo interno da projeção e da tradução, pelo mesmo critério de `colunasDoCertificado` e
  // de `eventoPublicado`.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida. Os três
  // tipos que a porta publica (`DadosDoDesfechoDaEntrega`, `EstadoDaEntregaGravado`,
  // `MotivoDaRecusaDoProvedor`) **não** aparecem aqui pela razão de sempre: tipo não existe em tempo
  // de execução.
  'gravarDesfechoDaEntrega',
  'lerEstadoDaEntrega',
  // ⚠️ A `0025` publica o vocabulário do terceiro estado da entrega, e a lista cresce **no mesmo
  // diff** que o publica — é o que a `.claude/rules/ancoras-de-superficie.md` exige. `SituacaoDaEntrega`
  // não entra pela razão de sempre: tipo não existe em tempo de execução. Nenhuma entrada saiu, e a
  // igualdade (nunca contenção) segue sendo asserida.
  'SITUACOES_DA_ENTREGA',
  // T3 da fatia `automacoes-agendadas` — o enum e a tabela do registro de execução das rotinas
  // agendadas, criados pela migração `0026` e forçados pela `0027`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T3 publica DOIS símbolos novos no schema por decisão declarada na §1
  // da task (`Símbolos públicos criados`). Eles entram pelo mesmo critério de todos os anteriores:
  // são **declaração de estrutura**, não caminho para dado — quem os tem em mãos ainda precisa de
  // um executor para chegar ao banco, e o executor não sai do índice. O eixo das marcas de cliente
  // continua valendo sobre cada um deles.
  //
  // ⚠️ **O namespace é `esquemaNegocio`, e não `esquemaPlataforma`**: a tabela tem dono-empresa, e a
  // ADR-0031 pela CONTRAPOSITIVA a manda para `negocio`. O roster de `plataforma` permanece com as
  // mesmas entradas que a fatia do webhook lhe deu.
  //
  // Os objetos que a migração autoral `0027` cria **não aparecem aqui**, pela razão de sempre: o
  // `FORCE ROW LEVEL SECURITY` e a política são objetos e atributos do BANCO, não símbolos deste
  // pacote. E **nenhuma porta de domínio entra nesta task**: a T3 faz nascer a tabela, não o caminho
  // para o dado dela.
  //
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'esquemaNegocio.execucaoDeRotina',
  'esquemaNegocio.rotinaAgendada',
  // T4 da fatia `automacoes-agendadas` — a PORTA do registro de execução: a gravação sob contexto, a
  // leitura com a derivação corrida no banco, o histórico recente e o expurgo por idade.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T4 publica QUATRO símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task (`Símbolos públicos criados`). O critério é o mesmo de todas as portas
  // anteriores: as quatro **recebem** o executor de quem já abriu a unidade de trabalho, não abrem
  // conexão, não reservam e não devolvem executor.
  //
  // Duas razões próprias desta entidade se somam. A primeira é que `lerEstadoDasRotinas` é a **mesma**
  // derivação que os dois consumidores independentes consomem — a rotina de vigilância, que filtra as
  // atrasadas, e a rota do Admin —, e ter o ponto com nome é o que torna verificável a afirmação de
  // que existe UM lugar onde `atrasada` e `proximaEsperada` são derivadas: uma segunda derivação
  // apareceria aqui como símbolo excedente, e não como um `CASE` a mais escondido no serviço.
  //
  // A segunda é que `registrarExecucaoDeRotina` é o **único** caminho de escrita do histórico, e por
  // isso o único ponto em que a RN-15 pode ser desrespeitada. Publicar a porta é o que torna
  // enumerável quem grava — e é o que faz um segundo `INSERT` sobre `negocio.execucao_de_rotina`,
  // escrito fora do pacote, ser impossível sem que este conjunto mude.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `lerFatosDeImpedimento`,
  // `MENSAGEM_POR_IMPEDIMENTO`, `IMPEDIMENTOS_POR_ROTINA`, `DIAS_DE_RETENCAO_DO_HISTORICO`,
  // `PASSAGENS_NO_HISTORICO_RECENTE` e `HORAS_DA_RECUSA_RECENTE`, de `src/execucao-de-rotina.ts`.
  // São o mecanismo interno da derivação e do expurgo, pelo mesmo critério de `empresaDoContexto` e
  // de `DIAS_DE_RETENCAO_DO_CRU` — publicar o limite do histórico daria à borda um tamanho de página
  // para escolher, e é justamente o limite POR CONSTRUÇÃO que dispensa a segunda rota da decisão D3.
  //
  // Os tipos que elas publicam (`ExecucaoDeRotinaNova`, `PassagemRegistrada`, `ResumoDaPassagem`) não
  // aparecem aqui porque não existem em tempo de execução, e este caso observa o módulo carregado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'expurgarExecucoesVencidas',
  'lerEstadoDasRotinas',
  'lerHistoricoRecenteDeRotinas',
  'registrarExecucaoDeRotina',
  // T5 da fatia `automacoes-agendadas` — a PASSAGEM do encerramento do contrato vencido: seleção
  // sob `FOR UPDATE … SKIP LOCKED`, transição sob predicado e liberação condicional do imóvel pela
  // porta estreita, tudo na unidade de trabalho que ela recebe.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T5 publica UM símbolo novo no índice por decisão declarada na §1 e na
  // §5.2 da task (`Símbolos públicos criados`). O critério é o de todas as portas anteriores: ela
  // **recebe** o executor de quem já abriu a unidade, não abre conexão, não reserva e não devolve
  // executor.
  //
  // Duas razões próprias desta fatia se somam. A primeira é a **atomicidade do par**: encerrar o
  // contrato e liberar o imóvel são um ato (RN-03), e publicar a passagem como UMA função é o que
  // impede a composição por fora — "selecione lá, encerre aqui, libere depois" —, em que a segunda
  // escrita cairia noutra transação e um contrato ficaria `ENCERRADO` com o imóvel ainda `LOCADO`.
  //
  // A segunda é a **enumerabilidade de quem escreve `contrato.status`**: com ela publicada, os
  // produtores dos quatro estados do contrato são exatamente quatro símbolos deste conjunto —
  // `criarContrato` (`RASCUNHO`), `ativarContrato` (`ATIVO`), `cancelarContrato` (`CANCELADO`) e
  // esta (`ENCERRADO`) —, e um quinto apareceria aqui como excedente. É o que torna verificável a
  // frase de que o `ENCERRADO` só nasce por vencimento.
  //
  // O que **não** sai do pacote, e as ausências são deliberadas: `selecionarCandidatos` e
  // `encerrarContrato`, de `src/encerramento-de-contratos.ts`. São as duas metades internas do par,
  // e publicá-las ofereceria justamente a composição por fora que o parágrafo acima fecha — a
  // primeira, ainda por cima, **trava linha de contrato** e a devolveria para alguém decidir o que
  // fazer com ela. O tipo que ela publica (`ResultadoDoEncerramento`) não aparece aqui porque não
  // existe em tempo de execução, e este caso observa o módulo carregado.
  //
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o defeito
  // que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia. **Nenhuma
  // entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  'encerrarContratosVencidos',
  // T8 da fatia `automacoes-agendadas` — as DUAS leituras SEM CONTEXTO que o despachante efêmero
  // consome: a enumeração de tenants e as notícias paradas em `RECEBIDO`.
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T8 publica DOIS símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task (`Símbolos públicos criados`). As duas entram pelo critério de todas as portas
  // anteriores: **recebem** o executor de quem já abriu a unidade, não abrem conexão, não reservam e
  // não devolvem executor. O caso reprovaria por `excedentes` não porque a superfície cresceu por
  // descuido — que é o defeito que ele existe para pegar —, mas porque cresceu por decisão que ele
  // ainda não conhecia. **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue
  // sendo asserida.
  //
  // A razão própria das duas é a **assimetria de contexto**, e é ela que torna a publicação
  // indispensável em vez de conveniente. `listarEmpresasAtivas` é a leitura legítima **#1** da
  // ADR-0024 — a enumeração de tenants, em `identidade`, schema que nunca teve política (ADR-0009) —,
  // e é dela que sai **todo** `empresaId` que viaja em carga de rotina agendada. `listarNaoTratadas`
  // corre igualmente sem contexto, por razão diferente: `plataforma.notificacao_bancaria` não tem
  // dono-empresa (ADR-0031). Publicá-las é o que impede o despachante de compor por fora um
  // `SELECT id FROM identidade.empresa WHERE suspensa_em IS NULL` — um segundo caminho para o mesmo
  // dado, com a própria ideia do que é *ativa* e do que é *não tratada*. Um segundo caminho
  // apareceria aqui como símbolo excedente, e não como um `WHERE` escondido num ponto de entrada.
  //
  // O que **não** sai do pacote, e a ausência é deliberada: `DIAS_DE_RETENCAO_DO_CRU` segue interno,
  // e a **folga** da retomada nem sequer mora neste pacote — ela é cadência da unidade `systemd`, e
  // chega a `listarNaoTratadas` por parâmetro.
  'listarEmpresasAtivas',
  'listarNaoTratadas',
  // T1 da fatia `painel-master-administradores` — as DOZE da camada de acesso do operador do SaaS:
  // as sete de `administrador-do-master.js`, o vocabulário `IMPEDIMENTOS_DE_EXCLUSAO`, e as quatro
  // de `empresa.js` (correção cadastral, remoção definitiva, prévia de elegibilidade e a classe de
  // erro de domínio da colisão de documento).
  //
  // SUT_IS_CORRECT_BECAUSE: o conjunto é EXATO de propósito (ver o comentário de
  // `SIMBOLOS_ESPERADOS`), e a T1 publica DOZE símbolos novos no índice por decisão declarada na §1
  // e na §5.2 da task (`Símbolos públicos criados`, e a base **216 → 228** medida em 2026-09-01).
  // As onze funções entram pelo critério de todas as portas anteriores: **recebem** o executor de
  // quem já abriu a unidade, não abrem conexão, não reservam e não devolvem executor.
  // `IMPEDIMENTOS_DE_EXCLUSAO` entra por ser **vocabulário** — o mapa que traduz a recusa que o
  // banco já deu —, e `ErroDeDocumentoDeEmpresaEmUso` pelo mesmo critério de
  // `ErroDePessoaForaDoContexto` e `ErroDeUnidadeAninhada`: é classe de erro, não caminho para dado.
  // O caso reprovaria por `excedentes` não porque a superfície cresceu por descuido — que é o
  // defeito que ele existe para pegar —, mas porque cresceu por decisão que ele ainda não conhecia.
  // **Nenhuma entrada anterior sai**, e a igualdade (nunca contenção) segue sendo asserida.
  //
  // ⚠️ **A mecânica compartilhada da exclusão NÃO entra**, e a ausência é decisão registrada no
  // índice: `RecusaDeExclusao`, `classeDoImpedimento`, `ensaiarExclusao` e
  // `semDeixarEfeitoNaRecusa` são exportados por `administrador-do-master.ts` apenas para que
  // `empresa.ts` os reuse **dentro** do pacote, e o barril não os republica — publicá-los criaria um
  // segundo lugar onde o ensaio de exclusão pode ser montado, que é a segunda definição do critério
  // que a decisão D2-b existe para impedir. Se algum deles aparecer aqui, foi o barril que cresceu.
  'IMPEDIMENTOS_DE_EXCLUSAO',
  'alterarAdministrador',
  'alterarEmpresa',
  'definirAtivoDoAdministrador',
  'elegibilidadeDeExclusaoDaEmpresa',
  'elegibilidadeDeExclusaoDoAdministrador',
  'encerrarSessoesDoAdministrador',
  'ErroDeDocumentoDeEmpresaEmUso',
  'excluirAdministrador',
  'excluirEmpresa',
  'lerAdministrador',
  'listarAdministradoresDaEmpresa',
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
 * **Exatamente quatro, desde a T11 da fatia `documentos-e-confirmacao`**: um escritor por **borda**.
 * O crescimento é a mudança que o caso existe para **exigir revisão**, não para impedir — um QUINTO
 * chamador continua reprovando aqui, e é essa a rede.
 *
 * O caminho é composto a partir da raiz do repositório, e não escrito absoluto: a varredura devolve
 * caminho absoluto, e um literal amarraria o caso ao diretório em que a máquina o hospeda.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha **um** elemento porque, até aqui, toda execução do produto
 * nascia de uma requisição — e a ADR-0008 não dizia qual é a origem do contexto quando **não há
 * requisição**. A **ADR-0024** (`accepted`, 2026-08-11) fecha essa lacuna e o faz **nomeando esta
 * consequência**: *"acrescenta um segundo escritor legítimo a um símbolo cujo cabeçalho hoje nomeia
 * um só — exige emenda desse cabeçalho e marcador no ponto"*. O segundo elemento é a borda do
 * trabalho enfileirado, que abre o contexto **uma vez**, a partir da carga, pelo **mesmo** escritor
 * único. As duas alternativas que evitariam esta linha estão descartadas por nome na mesma ADR — a
 * sessão de serviço sintética e o papel de banco sem RLS. A asserção **não foi afrouxada**: ela
 * continua sendo IGUALDADE de conjunto, com `excedentes` e `ausentes` nomeados, e o caso segue
 * reprovando qualquer chamador fora desta lista.
 */
const CHAMADORES_LEGITIMOS: readonly string[] = [
  // A borda HTTP: a guarda que deriva a empresa da sessão autenticada.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/autenticacao/contexto.guard.ts'),
  // A borda do TRABALHO ENFILEIRADO: o processador da régua, que deriva a empresa da carga do
  // próprio trabalho (ADR-0024). Não há sessão aqui, e nenhuma é simulada.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/regua.ts'),
  // A segunda borda de trabalho enfileirado: a entrega da confirmação de endereço (T10 da fatia
  // `documentos-e-confirmacao`).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e esta é uma — a tarefa chega do servidor de
  // fila, o `empresaId` vem da carga já conferida por esquema, e o contexto é aberto UMA vez pelo
  // mesmo escritor único, exatamente como a ADR-0024 manda. O que ela NÃO é: um serviço abrindo
  // contexto próprio — o domínio que ela compõe (`@sysloc/documentos`) é função pura e não conhece
  // banco. A asserção **não foi afrouxada**: continua sendo igualdade de conjunto, com
  // `excedentes` e `ausentes` nomeados, e um quarto chamador segue reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/confirmacao-de-email.ts'),
  // A borda do ATO DO TITULAR: a rota sem sessão que confirma o endereço de e-mail (T11 da mesma
  // fatia).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e esta é a terceira classe delas — nem sessão,
  // nem carga de fila. A ADR-0027 institui o portador de segredo como governança do ato do titular,
  // e a ADR-0024 dá a origem do contexto quando não há requisição autenticada: aqui ele vem do
  // **registro que o portador resolve**, descoberto por uma função `SECURITY DEFINER` chamada
  // deliberadamente **fora** de contexto, e é aberto UMA vez, na entrada. O que ela NÃO é: um
  // serviço reabrindo contexto no meio de um fluxo que já o tinha — não existe contexto anterior a
  // ela neste caminho, e é essa ausência que a ADR-0024 endereça. A asserção **não foi afrouxada**:
  // continua sendo igualdade de conjunto, com `excedentes` e `ausentes` nomeados, e um quinto
  // chamador segue reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/confirmacoes/confirmacao.service.ts'),
  // As duas bordas da COBRANÇA BANCÁRIA (T16 da fatia `emissao-e-conciliacao`).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e estas são duas — a tarefa chega do servidor de
  // fila, o `empresaId` vem da carga já conferida por `strictObject` **antes de qualquer leitura**, e
  // o contexto é aberto UMA vez pelo mesmo escritor único (ADR-0024 / ADR-0029). O que elas NÃO são:
  // serviços abrindo contexto próprio — o domínio que elas orquestram (`@sysloc/cobranca-bancaria`)
  // não conhece banco, não importa `@sysloc/db` e recebe todas as portas por parâmetro (ADR-0025). A
  // asserção **não foi afrouxada**: continua sendo igualdade de conjunto, com `excedentes` e
  // `ausentes` nomeados, e um sétimo chamador segue reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/emissao-em-lote.ts'),
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/conferencia-bancaria.ts'),
  // A TERCEIRA borda de trabalho enfileirado da cobrança bancária — o tratamento da notícia recebida
  // do provedor (T7 da fatia `webhook-e-carne`).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e esta é uma — a tarefa chega do servidor de
  // fila. O que é PRÓPRIO dela, e a distingue das seis anteriores, é **de onde vem a empresa**: a
  // carga desta fila é a única do produto sem `empresaId`, e o contexto nasce do **registro que o
  // roteamento resolve** — a segunda origem legítima que a ADR-0024 institui, e cujo alcance a
  // **terceira emenda** dela (2026-08-18) declara. As duas leituras que precedem a resolução (o cru
  // e o próprio roteamento) correm **fora** de contexto de propósito: a primeira porque
  // `plataforma.notificacao_bancaria` não tem dono-empresa (ADR-0031), e a segunda porque a empresa
  // é o **resultado** dela, e a função de banco não tem por onde recebê-la.
  //
  // ⚠️ **São dois pontos de chamada no arquivo, e o contexto continua sendo aberto UMA vez por
  // execução**: eles vivem em ramos mutuamente exclusivos — a recusa por divergência **retorna**, e
  // a consulta só corre quando ela não aconteceu. Nenhum deles reabre contexto sobre um contexto já
  // aberto, e nenhum é alcançável a partir do outro.
  //
  // O que ela NÃO é: um serviço abrindo contexto próprio — nem `packages/db/src/
  // notificacao-bancaria.ts` nem `@sysloc/cobranca-bancaria` conhecem `AcessoAoBanco`, e as duas
  // recebem tudo por parâmetro (ADR-0025). E o que ela não faz é ler empresa do recebido: fazê-lo é
  // a terceira *Alternativa rejeitada* da ADR-0035. A asserção **não foi afrouxada**: continua sendo
  // igualdade de conjunto, com `excedentes` e `ausentes` nomeados, e um oitavo chamador segue
  // reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/notificacao-bancaria.ts'),
  // A borda da RECONFERÊNCIA DA ENTREGA DA NOTÍCIA (T8 da fatia `integracao-bancaria-autonoma`).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e esta é uma — a tarefa chega do servidor de fila, o
  // `empresaId` vem da carga **já conferida por `strictObject` antes de qualquer leitura**, e o contexto é aberto UMA vez pelo mesmo escritor único (ADR-0024 / ADR-0029).
  // Ela volta à classe das bordas cuja empresa **vem da carga**, e não à da vizinha imediatamente
  // acima: quem enfileirou foi a borda HTTP que atendeu a sessão do Admin ao registrar o certificado
  // — é literalmente o alcance que a terceira emenda da ADR-0024 declara. O que ela NÃO é: um
  // serviço abrindo contexto próprio — a porta de entrega (`@sysloc/cobranca-bancaria`) não conhece
  // banco, não importa `@sysloc/db` e chega por parâmetro (ADR-0025). A asserção **não foi
  // afrouxada**: continua sendo igualdade de conjunto, com `excedentes` e `ausentes` nomeados, e
  // qualquer arquivo fora desta lista segue reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/reconferencia-da-entrega.ts'),
  // A borda das QUATRO ROTINAS POR EMPRESA (T6 da fatia `automacoes-agendadas`).
  //
  // SUT_IS_CORRECT_BECAUSE: a lista enumera BORDAS, e esta é uma — a tarefa chega do servidor de
  // fila, o `empresaId` vem da carga **já conferida por `strictObject` antes de qualquer leitura**, e
  // o contexto é aberto UMA vez pelo mesmo escritor único (ADR-0024 / ADR-0029). ⚠️ **A abertura é
  // ÚNICA e acontece ANTES do despacho**: o `switch` das quatro rotinas corre inteiro dentro dela, e
  // a passada da conferência que ela executa (`executarConferenciaDaEmpresa`) foi escrita para rodar
  // sob contexto **já aberto**, sem `executarCom` próprio — é o que impede a sétima borda de virar a
  // primeira que reabre contexto no meio do trabalho.
  //
  // O que é PRÓPRIO dela é **quem produziu o identificador**: a enumeração de tenants do despachante,
  // que lê `identidade.empresa` sem noção de tenant — a primeira das duas origens legítimas que a
  // `Decision` da ADR-0024 nomeia, e cujo alcance a emenda de 2026-08-18 declara. O que ela NÃO é: um
  // serviço abrindo contexto próprio — `packages/db/src/encerramento-de-contratos.ts` e
  // `packages/db/src/execucao-de-rotina.ts` **recebem** o `tx` e não conhecem `AcessoAoBanco`, e as
  // portas bancárias chegam por parâmetro (ADR-0025). A asserção **não foi afrouxada**: continua
  // sendo igualdade de conjunto, com `excedentes` e `ausentes` nomeados, e um décimo chamador segue
  // reprovando nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/rotina-agendada.ts'),
].sort();

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

// ---------------------------------------------------------------------------
// CT-014 (b) — quem ESCREVE a variável de contexto, um degrau abaixo do escritor
// ---------------------------------------------------------------------------

/**
 * O segundo eixo do `CT-014`, e a razão de ele existir — fecho do `D10 · F1/T3`, em 2026-08-19.
 *
 * O `CT-014` acima audita quem chama `contextoDeTenant.executarCom`, que é o escritor **do
 * arcabouço**. Ele não alcança o degrau de baixo: `emUnidadeDeTrabalho` entrega ao `trabalho` o
 * `tx` **cru**, e quem tem o `tx` em mãos pode emitir `SET LOCAL app.empresa_id` para **outro
 * valor dentro da transação já fixada** — a RLS obedece ao valor novo até o `COMMIT`, e o
 * invariante 2 do `CLAUDE.md` cai sem que compilação, execução ou o `CT-014` acusem.
 *
 * ⚠️ Quando o débito foi registrado (F1/T3) o risco era **latente**: não havia consumidor de
 * `emUnidadeDeTrabalho` no fonte de produção. A higienização de 2026-08-08 mediu que a latência
 * acabou — passou a **9 chamadas em 4 arquivos**, todas recebendo o `tx` cru —, e nenhum eixo
 * estático sobre a variável havia sido acrescentado. O `CT-326` cobre *quem abre a unidade*, não
 * *o contexto dentro dela*.
 *
 * A discriminação é ESCRITA contra LEITURA, e ela é o ponto: `current_setting('app.empresa_id')`
 * é como o produto **lê** o contexto (`contexto-de-escrita.ts`, e as políticas de RLS), e um
 * detector que a casasse reprovaria o código correto — o defeito literal que a
 * `.claude/rules/testing-stack.md` registra. Só `SET LOCAL` e `set_config(...)` escrevem.
 */
const ESCRITA_DA_VARIAVEL_DE_CONTEXTO =
  /(?:\bSET\s+LOCAL\s+(?:app\.empresa_id|\$\{VARIAVEL_DE_CONTEXTO\})|\bset_config\(\s*'app\.empresa_id')/i;

/**
 * Os dois arquivos de produção que podem ESCREVER a variável de contexto. Igualdade de conjunto.
 *
 * **Exatamente dois**, e cada um por uma razão que a ADR-0008 nomeia:
 *
 * - `unidade-de-trabalho.ts` é a implementação do escritor único — é ele que compõe o
 *   `SET LOCAL` da abertura, e o `CT-014` acima é que governa quem o aciona;
 * - `semente.ts` é a carga inicial, que fixa a variável por `set_config` com parâmetro vinculado
 *   porque o identificador chega de fora e `SET LOCAL` não aceita vínculo.
 *
 * Um TERCEIRO escritor reprova aqui, nominalmente — que é a rede que faltava. Ele não é proibido:
 * é a mudança que este caso existe para **exigir revisão**, exatamente como o `CT-014`.
 */
const ESCRITORES_DA_VARIAVEL_DE_CONTEXTO: readonly string[] = [
  join(RAIZ_DO_REPOSITORIO, 'packages/db/src/unidade-de-trabalho.ts'),
  join(RAIZ_DO_REPOSITORIO, 'packages/db/src/semente.ts'),
].sort();

function varrerEscritasDaVariavel(arquivos: readonly string[]): Promise<VarreduraDeFontes> {
  return varrerArquivos(arquivos, (linha) => ESCRITA_DA_VARIAVEL_DE_CONTEXTO.test(linha));
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
  // O TERCEIRO chamador da mesma superfície — o ciclo de vida do Admin Empresa (T4 da fatia
  // `painel-master-administradores`).
  //
  // SUT_IS_CORRECT_BECAUSE: ele é o irmão direto de `master/empresa.service.ts`, uma linha acima, e
  // a exceção que aquela entrada declara é **nominal e da superfície do Master** — *"as rotas do
  // Master e do Admin nasceram assim, e nenhuma delas compõe dois serviços; a decisão D1 governa a
  // superfície do domínio de locação"*. Este serviço está do mesmo lado dessa fronteira, e por uma
  // razão de mecanismo: as rotas do operador correm **sem contexto de tenant** (`empresaId: null`),
  // de modo que `sobContextoDaSessao` — o ponto único que abre a unidade para o domínio de locação —
  // não tem o que fixar aqui. A §5.1 da tech spec daquela fatia o prescreve literalmente: *"Serviço
  // abre `emUnidadeDeTrabalho` (sem contexto de tenant)"*. Ele também não compõe serviço nenhum: as
  // três operações abrem **uma** unidade cada, e nenhuma delas chama outro serviço.
  //
  // A asserção **não foi afrouxada**: continua sendo igualdade de conjunto com `excedentes` e
  // `ausentes` nomeados, nenhuma entrada anterior saiu, e qualquer arquivo fora desta lista reprova
  // — inclusive um serviço do domínio de locação que abrisse a sua, que é o defeito que este caso
  // existe para pegar.
  //
  // ⚠️ **Este arquivo não está na §5.2 da T4** — divergência declarada: a âncora afirma por
  // igualdade de conjunto, e uma borda nova a faz reprovar, que é exatamente o que ela existe para
  // fazer. A âncora **sobe**; ela não vira contenção.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/master/administrador.service.ts'),
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/usuarios/usuario.service.ts'),
  // A borda do TRABALHO ENFILEIRADO (T8 da fatia `regua-de-cobranca`).
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Até a T7 toda borda do produto era HTTP; a
  // ADR-0024 acrescenta a primeira execução sem requisição, e o arquivo abaixo é a borda dela — ele
  // abre a unidade e entrega o `tx` às portas que o domínio (`@sysloc/regua`) recebe por parâmetro,
  // que é exatamente o desenho que este caso existe para preservar. O que ele NÃO é: um serviço
  // abrindo unidade própria — `@sysloc/regua` não abre nenhuma, não conhece `AcessoAoBanco` e não
  // importa `@sysloc/db`. A asserção **não foi afrouxada**: continua sendo igualdade de conjunto
  // com `excedentes` e `ausentes` nomeados, e qualquer arquivo fora desta lista reprova.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/regua.ts'),
  // A segunda borda de trabalho enfileirado — a entrega da confirmação de endereço (T10 da fatia
  // `documentos-e-confirmacao`). Ela abre a unidade para UMA leitura, sob o contexto que acabou de
  // estabelecer a partir da carga, e entrega o resto — composição e envio — a portas que recebe por
  // parâmetro. Vale, palavra por palavra, o `SUT_IS_CORRECT_BECAUSE` do vizinho acima.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/confirmacao-de-email.ts'),
  // A borda do ATO DO TITULAR — a PRIMEIRA rota de negócio sem sessão do produto (T11 da mesma
  // fatia). Ela deixou de ser a única com a T6 da fatia `webhook-e-carne`, logo adiante.
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e esta é uma — ela é o ponto onde o pedido
  // entra, e não uma camada intermediária. Ela abre **duas** unidades, e as duas são propriedade da
  // borda, não do domínio: a primeira **sem contexto**, porque a empresa é o resultado da resolução
  // (a função `SECURITY DEFINER` existe justamente para atravessar esse estado), e a segunda **sob**
  // o contexto descoberto, para o consumo. O caminho de `sobContextoDaSessao` — o abridor único das
  // rotas com sessão, logo acima — **não a alcança**: ele lê a sessão que a guarda publicou, e aqui
  // não existe sessão nenhuma a ler (ADR-0027). O que ela NÃO é: um serviço de domínio abrindo
  // unidade própria — `packages/db/src/portador-de-confirmacao.ts` **recebe** o `tx` nas quatro
  // operações e não conhece `AcessoAoBanco`. A asserção **não foi afrouxada**: continua sendo
  // igualdade de conjunto com `excedentes` e `ausentes` nomeados, e qualquer arquivo fora desta
  // lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/confirmacoes/confirmacao.service.ts'),
  // A terceira e a quarta bordas de trabalho enfileirado — a emissão em lote e a conferência
  // bancária (T16 da fatia `emissao-e-conciliacao`).
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Cada uma abre a unidade do preparo — o lote, o
  // certificado e o conjunto, lidos juntos — e depois **uma por escrita**, entregando o `tx` às
  // portas que o domínio recebe por parâmetro; a rede corre FORA de qualquer unidade, para não
  // segurar a conexão física durante o aperto de mão com o provedor. O que elas NÃO são: serviços
  // abrindo unidade própria — `@sysloc/cobranca-bancaria` não abre nenhuma, não conhece
  // `AcessoAoBanco` e não importa `@sysloc/db`. A asserção **não foi afrouxada**: continua sendo
  // igualdade de conjunto com `excedentes` e `ausentes` nomeados, e qualquer arquivo fora desta
  // lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/emissao-em-lote.ts'),
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/conferencia-bancaria.ts'),
  // A borda da ENTRADA DE FATO DE TERCEIRO — a recepção da notícia bancária (T6 da fatia
  // `webhook-e-carne`). É a SEGUNDA rota de negócio sem sessão do produto, e a primeira em que quem
  // age não é titular de dado nenhum.
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e esta é uma — o ponto onde o pedido entra,
  // e não uma camada intermediária. O critério que a põe aqui é o mesmo do vizinho
  // `confirmacao.service.ts`: `sobContextoDaSessao` é o abridor único das rotas COM sessão, e ele
  // **não a alcança**, porque ele lê a sessão que a guarda publicou e nesta rota não há sessão
  // nenhuma a ler — o provedor não é usuário do sistema, não porta segredo e não é titular de dado
  // algum (ADR-0035). Não existe, portanto, contexto de tenant a estabelecer:
  // `plataforma.notificacao_bancaria` não tem coluna de empresa, não habilita RLS e nenhuma política
  // a alcança (ADR-0031), e de que empresa o fato é só se descobre na tarefa, por travessia nominal
  // — reconstituí-lo aqui a partir do recebido é a terceira *Alternativa rejeitada* da ADR-0035. É
  // por isso que esta borda entra AQUI e **não** em {@link CHAMADORES_LEGITIMOS}: ela abre unidade,
  // e não escreve contexto.
  //
  // O que ela NÃO é: um serviço de domínio abrindo unidade própria —
  // `packages/db/src/notificacao-bancaria.ts` **recebe** o `tx` e não conhece `AcessoAoBanco`. E a
  // abertura não podia subir para o controlador: o enfileiramento tem de acontecer **depois do
  // `COMMIT`** — enfileirar antes daria à tarefa um identificador que a transação ainda pode
  // desfazer —, e essa ordenação é decisão sobre o que acontece depois do commit, que a camada de
  // apresentação não contém. A diferença para o vizinho é que aqui não há segunda unidade nem
  // `contextoDeTenant.executarCom`.
  //
  // A asserção **não foi afrouxada**: continua sendo igualdade de conjunto com `excedentes` e
  // `ausentes` nomeados, e qualquer arquivo fora desta lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/api/src/notificacoes-bancarias/notificacao-bancaria.service.ts'),
  // A borda que TRATA a notícia recebida — a tarefa da fila `notificacao-bancaria` (T7 da mesma
  // fatia). Ela é a outra metade da borda acima: aquela guarda o cru e responde; esta o interpreta.
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Ela abre **uma unidade por escrita** e nunca uma
  // que envolva a rede: o cru e o roteamento saem de unidades próprias, **sem contexto**; a consulta
  // ao provedor é aguardada **entre** duas unidades; e o efeito na cobrança comita junto do carimbo
  // do desfecho, porque os dois são um fato só — `APLICADO` **é** o registro de que o efeito
  // aconteceu, e separá-los abriria a janela em que o dinheiro entrou e nada o registra.
  //
  // O que ela NÃO é: um serviço de domínio abrindo unidade própria — `packages/db/src/
  // notificacao-bancaria.ts` e `packages/db/src/boleto-da-cobranca.ts` **recebem** o `tx` e não
  // conhecem `AcessoAoBanco`, e `@sysloc/cobranca-bancaria` não importa `@sysloc/db`. Diferente da
  // borda de recepção logo acima, esta **também** escreve contexto, e por isso ela entra nas DUAS
  // listas — ver {@link CHAMADORES_LEGITIMOS}. A asserção **não foi afrouxada**: continua sendo
  // igualdade de conjunto com `excedentes` e `ausentes` nomeados, e qualquer arquivo fora desta lista
  // reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/notificacao-bancaria.ts'),
  // A borda da RECONFERÊNCIA DA ENTREGA DA NOTÍCIA (T8 da fatia `integracao-bancaria-autonoma`).
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Ela abre **duas** unidades — a do preparo, que lê
  // o estado guardado e as duas pré-condições juntas, e a da gravação —, e a consulta ao provedor é
  // aguardada **entre** as duas, para não segurar a conexão física durante o aperto de mão. O que ela
  // NÃO é: um serviço de domínio abrindo unidade própria — `packages/db/src/entrega-da-noticia.ts`
  // **recebe** o `tx` nas duas operações e não conhece `AcessoAoBanco`, e a porta de entrega
  // (`@sysloc/cobranca-bancaria`) chega por parâmetro e não importa `@sysloc/db` (ADR-0025). Ela
  // **também** escreve contexto, e por isso entra nas DUAS listas — ver {@link CHAMADORES_LEGITIMOS}.
  // A asserção **não foi afrouxada**: continua sendo igualdade de conjunto com `excedentes` e
  // `ausentes` nomeados, e qualquer arquivo fora desta lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/reconferencia-da-entrega.ts'),
  // A borda das QUATRO ROTINAS POR EMPRESA (T6 da fatia `automacoes-agendadas`).
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Ela abre **uma unidade por rotina despachada** —
  // e, no encerramento e no expurgo, o trabalho e o registro da passagem correm na **mesma**, porque
  // o resumo devolvido não sobrevive ao desfazimento e não haveria o que registrar (RN-15). Na
  // conferência a unidade única é impossível por desenho da F4 (uma por cobrança, para que a falha da
  // trigésima não desfaça as vinte e nove anteriores), e por isso o registro dela corre em unidade
  // própria, depois — consequência declarada no docblock daquele ramo.
  //
  // O que ela NÃO é: um serviço de domínio abrindo unidade própria —
  // `packages/db/src/encerramento-de-contratos.ts`, `packages/db/src/execucao-de-rotina.ts` e
  // `packages/db/src/conferencia-bancaria.ts` **recebem** o `tx` e não conhecem `AcessoAoBanco`, e
  // `@sysloc/cobranca-bancaria` não importa `@sysloc/db` (ADR-0025). Ela **também** escreve contexto,
  // e por isso entra nas DUAS listas — ver {@link CHAMADORES_LEGITIMOS}. A asserção **não foi
  // afrouxada**: continua sendo igualdade de conjunto com `excedentes` e `ausentes` nomeados, e
  // qualquer arquivo fora desta lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/rotina-agendada.ts'),
  // A borda da MANUTENÇÃO DO ACERVO (T7 da mesma fatia) — a única do produto SEM empresa alguma.
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Ela abre **uma** unidade, para o expurgo do
  // recebido cru; o segundo alvo dela — o acervo de boletos — não é banco, é sistema de arquivos, e
  // corre FORA de qualquer unidade, para não segurar a conexão física durante o `fs`.
  //
  // ⚠️ **Ela entra AQUI e NÃO em `BORDAS_QUE_ESCREVEM_CONTEXTO`** (`../fonte-unica-do-estado.spec.ts`),
  // e a assimetria é a decisão: `plataforma.notificacao_bancaria` vive no schema sem noção de tenant,
  // que não carrega `empresa_id`, não habilita RLS e não tem política que o alcance (ADR-0031) — não
  // há contexto a estabelecer, e fixá-lo "para facilitar" daria à varredura a aparência de correr sob
  // tenant. É o mesmo critério que põe o serviço de recepção da notícia só nesta lista, por razão
  // vizinha: quem abre unidade sem escrever contexto pertence a uma lista, e não às duas.
  //
  // O que ela NÃO é: um serviço de domínio abrindo unidade própria —
  // `packages/db/src/notificacao-bancaria.ts` **recebe** o `tx` e não conhece `AcessoAoBanco`, e a
  // guarda do acervo (`@sysloc/cobranca-bancaria`) chega por parâmetro e não importa `@sysloc/db`
  // (ADR-0025). A asserção **não foi afrouxada**: continua sendo igualdade de conjunto com
  // `excedentes` e `ausentes` nomeados, e qualquer arquivo fora desta lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/tarefas/manutencao-do-acervo.ts'),
  // O DESPACHANTE EFÊMERO (T8 da mesma fatia) — o segundo ponto de entrada de `apps/worker`.
  //
  // SUT_IS_CORRECT_BECAUSE: o elenco enumera **bordas**, e a decisão D1 é literalmente *"a unidade
  // abre na BORDA, e o serviço recebe o executor"*. Ele é composição raiz, e abre **uma** unidade por
  // leitura: a da enumeração de empresas ativas e — na retomada — a das notícias paradas. As duas
  // fecham antes de qualquer enfileiramento, e nenhuma envolve o servidor de fila: enfileirar dentro
  // da unidade daria à tarefa um identificador que a transação ainda pode desfazer.
  //
  // ⚠️ **Ele entra AQUI e NÃO em `BORDAS_QUE_ESCREVEM_CONTEXTO`** (`../fonte-unica-do-estado.spec.ts`),
  // e a assimetria é a decisão: as duas leituras dele correm **sem** contexto de tenant, porque
  // `identidade.empresa` nunca teve política (ADR-0009) e `plataforma.notificacao_bancaria` não tem
  // dono-empresa (ADR-0031). Fixar `app.empresa_id` ali daria à enumeração a aparência de correr sob
  // tenant, e a primeira leitura tenantizada acrescentada depois encontraria o contexto já aberto com
  // a empresa de ninguém — a política devolvendo vazio em silêncio. É o mesmo critério que põe a
  // manutenção do acervo só nesta lista.
  //
  // O que ele NÃO é: um serviço de domínio abrindo unidade própria — `packages/db/src/empresa.ts` e
  // `packages/db/src/notificacao-bancaria.ts` **recebem** o `tx` e não conhecem `AcessoAoBanco`. A
  // asserção **não foi afrouxada**: continua sendo igualdade de conjunto com `excedentes` e
  // `ausentes` nomeados, e qualquer arquivo fora desta lista reprova nominalmente.
  join(RAIZ_DO_REPOSITORIO, 'apps/worker/src/despachante.ts'),
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
    'CT-014 (b) — a variável de contexto é ESCRITA em exatamente dois arquivos de produção',
    async () => {
      const fontes = await fontesDeProducao();

      // A mesma âncora antivácuo do caso irmão, e pela mesma razão: sem ela, um descobridor
      // quebrado provaria "ninguém escreve a variável" com a varredura vazia.
      expect(Object.keys(fontes.porPacote).sort()).toEqual(
        expect.arrayContaining(PACOTES_QUE_EXISTEM_HOJE),
      );
      for (const [pacote, quantos] of Object.entries(fontes.porPacote)) {
        expect({ pacote, temFonte: quantos > 0 }).toEqual({ pacote, temFonte: true });
      }

      const varredura = await varrerEscritasDaVariavel(fontes.arquivos);

      // Igualdade de CONJUNTO, nunca contenção: ela reprova tanto o TERCEIRO escritor que apareceu
      // — a camada que emite `SET LOCAL` com o `tx` cru dentro de uma transação já fixada — quanto
      // o legítimo que deixou de escrever. Contagem não faria isso: continuaria em dois se um
      // saísse e um intruso entrasse no lugar.
      expect(arquivosDe(varredura.ocorrencias)).toEqual(ESCRITORES_DA_VARIAVEL_DE_CONTEXTO);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-014 (b, falsificação) — o detector pega a reescrita com o `tx` cru e NÃO pega a leitura',
    async () => {
      const raiz = await mkdtemp(join(tmpdir(), 'sysloc-escrita-contexto-'));

      try {
        // Controle NEGATIVO, e é ele que impede o detector de reprovar o código correto: o módulo
        // que LÊ a variável não é escritor. `current_setting` é como toda política de RLS e o
        // `contexto-de-escrita.ts` consultam o contexto — um detector que a casasse condenaria o
        // produto inteiro, que é o defeito literal registrado na `.claude/rules/testing-stack.md`.
        const leitor = join(raiz, 'contexto-de-escrita.ts');
        await writeFile(
          leitor,
          await readFile(
            fileURLToPath(new URL('../src/contexto-de-escrita.ts', import.meta.url)),
            'utf8',
          ),
          'utf8',
        );

        const limpa = await varrerEscritasDaVariavel([leitor]);
        expect(limpa.arquivos).toBe(1);
        expect(limpa.ocorrencias).toEqual([]);

        // Controle POSITIVO: o detector tem de casar as DUAS formas de escrita que a árvore usa.
        // Sem esta perna, uma expressão que nunca casa aprovaria um repositório cheio de escritas.
        //
        // O VALOR é irrelevante nos dois sintéticos, e a escolha é deliberada: o detector casa a
        // FORMA da escrita (`SET LOCAL <variável>` e `set_config('<variável>'`), nunca o que se
        // escreve. Um literal no lugar da interpolação mantém a forma idêntica à do defeito real e
        // evita `${` solto dentro de cadeia — que o Biome sinaliza, e com razão, como template
        // literal provavelmente mal escrito.
        const porSetLocal = join(raiz, 'repositorio-de-contratos.ts');
        await writeFile(
          porSetLocal,
          'export async function listar(tx: Executor, empresaDoPedido: string) {\n' +
            '  await tx.unsafe("SET LOCAL app.empresa_id = \'" + empresaDoPedido + "\'");\n' +
            '  return [];\n' +
            '}\n',
          'utf8',
        );
        const porSetConfig = join(raiz, 'carga-alternativa.ts');
        await writeFile(
          porSetConfig,
          'export async function semear(tx: Executor) {\n' +
            "  await tx`SELECT set_config('app.empresa_id', 'alguma-empresa', true)`;\n" +
            '}\n',
          'utf8',
        );

        const suja = await varrerEscritasDaVariavel([leitor, porSetLocal, porSetConfig]);
        expect(suja.arquivos).toBe(3);
        expect(arquivosDe(suja.ocorrencias)).toEqual([porSetConfig, porSetLocal].sort());
      } finally {
        await rm(raiz, { recursive: true, force: true });
      }
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
