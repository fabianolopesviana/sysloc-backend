/**
 * Ambiente efêmero da verificação — T4 da fatia `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-6 | CT-001 | A cadeia de conexão devolvida por `postgresEfemero` aceita conexão, e a
 * |      |        | instância que atende reporta como diretório de dados e porta exatamente os
 * |      |        | valores que o helper devolveu. |
 * | CA-6 | CT-002 | Nenhuma instância efêmera coincide com a provisionada: porta, diretório de
 * |      |        | dados e CONTEÚDO são de instância recém-criada, não da operação. |
 * | CA-6 | CT-003 | Os helpers não consomem a configuração de conexão do ambiente: com as
 * |      |        | variáveis ausentes ou apontando para um sentinela, as instâncias sobem e o
 * |      |        | endereço apontado não recebe conexão nenhuma. |
 * | CA-7 | CT-004 | Término anômalo da suíte (asserção, exceção não capturada, sinal) não deixa
 * |      |        | processo órfão nem diretório de dados. |
 * | CA-7 | CT-005 | Depois de `parar()`, o processo não existe, o diretório sumiu, a porta recusa
 * |      |        | conexão — e uma segunda chamada de `parar()` não lança. |
 * | CA-6 | CT-006 | A fila efêmera sobe do binário provisionado e responde ao protocolo; sem o
 * |      |        | binário no `PATH`, a subida falha NOMEANDO o binário e sem deixar resíduo. |
 *
 * ADR-0006 é o que estes casos materializam: a suíte nunca executa contra o ambiente que atende
 * a operação. CT-002 e CT-003 são os dois casos que provam a separação — subir não é o mesmo
 * que ser OUTRA instância.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { type AddressInfo, createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { describe, expect, it, onTestFinished } from 'vitest';
import { FAIXA_PORTAS_EFEMERAS, processoVivo, sondarAte } from './efemero-comum.ts';
import { postgresEfemero } from './postgres-efemero.ts';
import { BINARIO_FILA, comandoFila, redisEfemero } from './redis-efemero.ts';

/** Limite de cada caso que sobe instância própria. Subir banco e fila leva alguns segundos. */
const LIMITE_CASO_MS = 90_000;

/** Limite dos casos que atravessam um subprocesso, que sobe as duas instâncias por conta. */
const LIMITE_CASO_COM_SUBPROCESSO_MS = 150_000;

/** Limite para o estado observável do descarte (processo morto, diretório removido). */
const LIMITE_DESCARTE_MS = 30_000;

/** Limite de vida do subprocesso de cenário, contado pelo processo-pai. */
const LIMITE_SUBPROCESSO_MS = 120_000;

const RAIZ_DO_PACOTE = fileURLToPath(new URL('..', import.meta.url));
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const CENARIO = fileURLToPath(new URL('./cenario-subprocesso.ts', import.meta.url));
const SCRIPT_DE_PROVISIONAMENTO = join(
  RAIZ_DO_REPOSITORIO,
  'deploy/scripts/instalacao/provisionar-base.sh',
);

/** Portas padrão dos serviços, usadas pelo ambiente legado desta máquina. */
const PORTA_PADRAO_DO_BANCO = 5432;
const PORTA_PADRAO_DA_FILA = 6379;

interface ResultadoDoCenario {
  codigo: number | null;
  sinal: NodeJS.Signals | null;
  saida: string;
  erro: string;
}

/**
 * Executa um cenário em subprocesso com o ambiente MONTADO EXPLICITAMENTE.
 *
 * O ambiente não é herdado: ele é construído variável a variável. É o que permite provar
 * ausência (CT-003, cenário sem as variáveis de conexão) e é o que impede a montagem de um
 * cenário de vazar para os casos vizinhos.
 */
function executarCenario(
  cenario: string,
  ambiente: NodeJS.ProcessEnv,
): Promise<ResultadoDoCenario> {
  return new Promise((resolver, rejeitar) => {
    const filho = spawn(process.execPath, [CENARIO, cenario], {
      cwd: RAIZ_DO_PACOTE,
      env: ambiente,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let saida = '';
    let erro = '';
    filho.stdout.setEncoding('utf8');
    filho.stderr.setEncoding('utf8');
    filho.stdout.on('data', (pedaco: string) => {
      saida += pedaco;
    });
    filho.stderr.on('data', (pedaco: string) => {
      erro += pedaco;
    });

    const limite = setTimeout(() => {
      filho.kill('SIGKILL');
      rejeitar(
        new Error(`o cenário '${cenario}' não terminou em ${LIMITE_SUBPROCESSO_MS} ms:\n${erro}`),
      );
    }, LIMITE_SUBPROCESSO_MS);

    filho.on('error', (falha: Error) => {
      clearTimeout(limite);
      rejeitar(falha);
    });
    filho.on('close', (codigo, sinal) => {
      clearTimeout(limite);
      resolver({ codigo, sinal, saida, erro });
    });
  });
}

/** Ambiente mínimo de um subprocesso: nada de configuração de conexão, tudo declarado. */
function ambienteBase(diretorioTemporario: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    // O subprocesso recebe uma raiz temporária SÓ DELE. É assim que o processo-pai afirma, ao
    // fim, que nenhuma instância deixou arquivo para trás: o diretório inteiro tem de estar
    // vazio.
    TMPDIR: diretorioTemporario,
  };
}

/**
 * Cria uma raiz temporária do CASO e a apaga no encerramento registrado.
 *
 * A disciplina que a T4 cobra dos helpers vale também para o andaime do teste: num servidor
 * acima de 75% de ocupação, um diretório por execução deixado para trás é resíduo igual.
 */
async function raizTemporariaDoCaso(prefixo: string): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), prefixo));
  onTestFinished(() => rm(raiz, { recursive: true, force: true }));
  return raiz;
}

/** Lê a linha `RESULTADO=` que o cenário imprime. */
function resultadoDoCenario(saida: string): Record<string, unknown> {
  const linha = saida.split('\n').find((candidata) => candidata.startsWith('RESULTADO='));
  if (linha === undefined) {
    throw new Error(`o cenário não imprimiu a linha RESULTADO=; saída completa:\n${saida}`);
  }
  return JSON.parse(linha.slice('RESULTADO='.length)) as Record<string, unknown>;
}

/**
 * Lê uma constante declarada no script de provisionamento.
 *
 * É a leitura do que está VERSIONADO — o caminho legítimo para conhecer as coordenadas da
 * instância provisionada sem abrir conexão contra ela, que a ADR-0006 proíbe. Nada foi
 * acrescentado ao script para o teste enxergar esses valores: as constantes já eram declaradas
 * assim quando T2 foi aprovada.
 */
function constanteDoProvisionamento(nome: string): string | undefined {
  const texto = readFileSync(SCRIPT_DE_PROVISIONAMENTO, 'utf8');
  const casamento = new RegExp(`^readonly ${nome}="?([^"\\n]+)"?$`, 'm').exec(texto);
  return casamento?.[1];
}

interface CoordenadasProvisionadas {
  porta: number;
  diretorio: string;
  origem: string;
}

/** Coordenadas da instância provisionada, com a origem declarada para entrar na asserção. */
function coordenadasProvisionadas(recurso: 'banco' | 'fila'): CoordenadasProvisionadas {
  if (recurso === 'fila') {
    const porta = constanteDoProvisionamento('PORTA_FILA');
    const diretorio = constanteDoProvisionamento('DIR_FILA_DADOS');
    if (porta !== undefined && diretorio !== undefined) {
      return { porta: Number.parseInt(porta, 10), diretorio, origem: 'provisionar-base.sh' };
    }
    return {
      porta: PORTA_PADRAO_DA_FILA,
      diretorio: '/var/lib/redis',
      origem: 'padrão do serviço (fallback: provisionar-base.sh não declarou as constantes)',
    };
  }

  // O provisionamento abre porta TCP para o banco (`listen_addresses = '${HOSPEDEIRO_DB}'`, o
  // endereço de retorno), mas não a FIXA: a porta é a que o empacotamento da distribuição declara
  // no `postgresql.conf` do cluster. Não há, portanto, constante de porta a ler — o valor
  // comparável é o padrão do serviço. O diretório de dados é o do empacotamento da distribuição,
  // derivado da versão que o script fixa.
  const versao = constanteDoProvisionamento('VERSAO_POSTGRES');
  if (versao !== undefined) {
    return {
      porta: PORTA_PADRAO_DO_BANCO,
      diretorio: `/var/lib/postgresql/${versao}/main`,
      origem: `padrão do serviço + VERSAO_POSTGRES=${versao} lida de provisionar-base.sh`,
    };
  }
  return {
    porta: PORTA_PADRAO_DO_BANCO,
    diretorio: '/var/lib/postgresql',
    origem: 'padrão do serviço (fallback: provisionar-base.sh não declarou VERSAO_POSTGRES)',
  };
}

/** Código do erro de sinalização — `ESRCH` quando o processo não existe mais. */
function codigoAoSinalizar(pid: number): string {
  try {
    process.kill(pid, 0);
    return 'SEM-ERRO';
  } catch (erro) {
    return (erro as NodeJS.ErrnoException).code ?? 'SEM-CODIGO';
  }
}

/** Código do erro de conexão — `ECONNREFUSED` quando ninguém escuta a porta. */
function codigoAoConectar(porta: number): Promise<string> {
  return new Promise((resolver) => {
    const soquete = createConnection({ host: '127.0.0.1', port: porta });
    soquete.setTimeout(LIMITE_DESCARTE_MS, () => {
      soquete.destroy();
      resolver('TEMPO-ESGOTADO');
    });
    soquete.on('error', (erro: NodeJS.ErrnoException) => {
      soquete.destroy();
      resolver(erro.code ?? 'SEM-CODIGO');
    });
    soquete.on('connect', () => {
      soquete.destroy();
      resolver('CONECTOU');
    });
  });
}

interface RecursoEfemero {
  cadeiaConexao: string;
  porta: number;
  pid: number;
  diretorioDados: string;
  parar: () => Promise<void>;
}

/** Sobe o recurso da linha e pendura o descarte no encerramento REGISTRADO do caso. */
async function subirRecurso(recurso: 'banco' | 'fila'): Promise<RecursoEfemero> {
  if (recurso === 'banco') {
    const banco = await postgresEfemero();
    onTestFinished(() => banco.parar());
    return banco;
  }
  const fila = await redisEfemero();
  onTestFinished(() => fila.parar());
  return {
    cadeiaConexao: fila.cadeiaConexao,
    porta: fila.porta,
    get pid(): number {
      return fila.pid;
    },
    diretorioDados: fila.diretorioDados,
    parar: () => fila.parar(),
  };
}

describe('ambiente efêmero da verificação (T4 · ADR-0006)', () => {
  it(
    'CT-001 — instância efêmera de banco sobe, responde e atende no diretório e na porta que o helper devolveu',
    async () => {
      const banco = await postgresEfemero();
      onTestFinished(() => banco.parar());

      const sql = postgres(banco.cadeiaConexao, { max: 1, onnotice: () => {} });
      onTestFinished(() => sql.end());

      const linhas = await sql`SELECT 1 AS um`;
      expect(linhas.length).toBe(1);
      expect(linhas[0]?.um).toBe(1);

      // `data_directory` e `port` vêm da PRÓPRIA instância — não são o valor que o teste
      // plantou repetido de volta. É a instância que atende quem confirma onde ela atende.
      const diretorio = await sql`SHOW data_directory`;
      const porta = await sql`SHOW port`;
      expect(diretorio[0]?.data_directory).toBe(banco.diretorioDados);
      expect(porta[0]?.port).toBe(String(banco.porta));

      expect(Number.isInteger(banco.pid)).toBe(true);
      expect(banco.pid).toBeGreaterThan(0);
      expect(codigoAoSinalizar(banco.pid)).toBe('SEM-ERRO');
      expect(existsSync(banco.diretorioDados)).toBe(true);
    },
    LIMITE_CASO_MS,
  );

  it.each([{ recurso: 'banco' as const }, { recurso: 'fila' as const }])(
    'CT-002 — a instância efêmera de $recurso não coincide com a provisionada em porta, diretório nem conteúdo',
    async ({ recurso }) => {
      const provisionada = coordenadasProvisionadas(recurso);
      const instancia = await subirRecurso(recurso);
      const contexto = `coordenadas da instância provisionada resolvidas por: ${provisionada.origem}`;

      expect(instancia.porta, contexto).not.toBe(provisionada.porta);
      expect(instancia.porta, contexto).not.toBe(
        recurso === 'banco' ? PORTA_PADRAO_DO_BANCO : PORTA_PADRAO_DA_FILA,
      );
      expect(instancia.porta).toBeGreaterThan(1024);
      expect(instancia.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
      expect(instancia.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

      expect(instancia.diretorioDados, contexto).not.toBe(provisionada.diretorio);
      expect(resolve(instancia.diretorioDados).startsWith(resolve(tmpdir()))).toBe(true);

      if (recurso === 'banco') {
        const sql = postgres(instancia.cadeiaConexao, { max: 1, onnotice: () => {} });
        onTestFinished(() => sql.end());

        const bancos = await sql`SELECT datname FROM pg_database WHERE datistemplate = false`;
        const nomes = bancos.map((linha) => String(linha.datname)).sort();
        expect(nomes).toEqual(['postgres', 'verificacao']);

        // A agulha vem do que está versionado. O guarda de tamanho existe porque um
        // `not.toContain(undefined)` passaria sozinho se a leitura da constante deixasse de
        // casar — a asserção seguinte ficaria decorativa sem ninguém notar.
        const bancoDaOperacao = constanteDoProvisionamento('BANCO_DB') ?? '';
        expect(
          bancoDaOperacao.length,
          'provisionar-base.sh precisa declarar `readonly BANCO_DB=...`',
        ).toBeGreaterThan(0);
        expect(nomes).not.toContain(bancoDaOperacao);
      } else {
        expect(await comandoFila(instancia.porta, 'DBSIZE')).toBe(0);
        expect(await comandoFila(instancia.porta, 'CONFIG', 'GET', 'dir')).toEqual([
          'dir',
          instancia.diretorioDados,
        ]);
      }
    },
    LIMITE_CASO_MS,
  );

  it.each([{ cenario: 'sem as variáveis de conexão' }, { cenario: 'variáveis no sentinela' }])(
    'CT-003 — com $cenario, os helpers sobem instância própria e o endereço apontado não recebe conexão',
    async ({ cenario }) => {
      const sentinela = createServer();
      let conexoesAceitas = 0;
      sentinela.on('connection', (soquete) => {
        conexoesAceitas += 1;
        soquete.destroy();
      });
      await new Promise<void>((resolver) => {
        sentinela.listen(0, '127.0.0.1', resolver);
      });
      onTestFinished(
        () =>
          new Promise<void>((resolver) => {
            sentinela.close(() => resolver());
          }),
      );
      const portaSentinela = (sentinela.address() as AddressInfo).port;

      const raizTemporaria = await raizTemporariaDoCaso('sysloc-cenario-');
      const ambiente = ambienteBase(raizTemporaria);
      if (cenario === 'variáveis no sentinela') {
        ambiente.DATABASE_URL = `postgresql://sentinela:sentinela@127.0.0.1:${portaSentinela}/sentinela`;
        ambiente.REDIS_URL = `redis://127.0.0.1:${portaSentinela}`;
      }

      const resultado = await executarCenario('sondas', ambiente);

      expect(resultado.codigo, `stderr do cenário:\n${resultado.erro}`).toBe(0);
      const sondas = resultadoDoCenario(resultado.saida);
      expect(sondas.um).toBe(1);
      expect(sondas.pong).toBe('PONG');
      expect(sondas.portaBanco).not.toBe(portaSentinela);
      expect(sondas.portaFila).not.toBe(portaSentinela);

      // A prova: o endereço que o ambiente apontava não recebeu conexão nenhuma.
      expect(conexoesAceitas).toBe(0);
      expect(readdirSync(raizTemporaria)).toEqual([]);
    },
    LIMITE_CASO_COM_SUBPROCESSO_MS,
  );

  it.each([
    { modo: 'asercao', termino: 'codigo' as const },
    { modo: 'excecao', termino: 'codigo' as const },
    { modo: 'sigterm', termino: 'sinal' as const },
  ])(
    'CT-004 — término anômalo por $modo não deixa processo órfão nem diretório de dados',
    async ({ modo, termino }) => {
      const raizTemporaria = await raizTemporariaDoCaso('sysloc-cenario-');
      const raizDoRastro = await raizTemporariaDoCaso('sysloc-rastro-');
      const rastro = join(raizDoRastro, 'instancias.json');

      const ambiente = ambienteBase(raizTemporaria);
      ambiente.SYSLOC_RASTRO = rastro;

      const resultado = await executarCenario(`rastro-${modo}`, ambiente);

      if (termino === 'codigo') {
        expect(resultado.sinal).toBeNull();
        expect(resultado.codigo).not.toBe(0);
      } else {
        expect(resultado.sinal).toBe('SIGTERM');
      }

      const registrado = JSON.parse(readFileSync(rastro, 'utf8')) as Record<
        'banco' | 'fila',
        { pid: number; porta: number; diretorioDados: string }
      >;

      for (const recurso of ['banco', 'fila'] as const) {
        const { pid, porta, diretorioDados } = registrado[recurso];

        await sondarAte(
          `o processo ${pid} do(a) ${recurso} desaparecer depois do término anômalo`,
          () => !processoVivo(pid),
          LIMITE_DESCARTE_MS,
        );
        await sondarAte(
          `o diretório de dados do(a) ${recurso} sumir depois do término anômalo`,
          () => !existsSync(diretorioDados),
          LIMITE_DESCARTE_MS,
        );

        expect(codigoAoSinalizar(pid)).toBe('ESRCH');
        expect(existsSync(diretorioDados)).toBe(false);
        expect(await codigoAoConectar(porta)).toBe('ECONNREFUSED');
      }

      expect(readdirSync(raizTemporaria)).toEqual([]);
    },
    LIMITE_CASO_COM_SUBPROCESSO_MS,
  );

  it.each([{ recurso: 'banco' as const }, { recurso: 'fila' as const }])(
    'CT-005 — parar() do(a) $recurso remove processo e diretório, libera a porta e é idempotente',
    async ({ recurso }) => {
      const instancia = await subirRecurso(recurso);
      const { pid, porta, diretorioDados } = instancia;

      expect(codigoAoSinalizar(pid)).toBe('SEM-ERRO');
      expect(existsSync(diretorioDados)).toBe(true);

      await instancia.parar();

      await sondarAte(
        `o processo ${pid} do(a) ${recurso} desaparecer depois de parar()`,
        () => !processoVivo(pid),
        LIMITE_DESCARTE_MS,
      );
      expect(codigoAoSinalizar(pid)).toBe('ESRCH');
      expect(existsSync(diretorioDados)).toBe(false);
      expect(await codigoAoConectar(porta)).toBe('ECONNREFUSED');

      // Segunda chamada: o encerramento pode vir do caso E do gancho de encerramento da suíte;
      // uma segunda parada que lançasse transformaria suíte verde em vermelha por ruído.
      await expect(instancia.parar()).resolves.toBeUndefined();
      expect(existsSync(diretorioDados)).toBe(false);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-006 — a fila efêmera sobe do binário provisionado e responde ao protocolo',
    async () => {
      const fila = await redisEfemero();
      onTestFinished(() => fila.parar());

      expect(await comandoFila(fila.porta, 'PING')).toBe('PONG');
      expect(await comandoFila(fila.porta, 'SET', 'chave-eco-t4', 'valor-eco-t4')).toBe('OK');
      expect(await comandoFila(fila.porta, 'GET', 'chave-eco-t4')).toBe('valor-eco-t4');
      expect(await comandoFila(fila.porta, 'CONFIG', 'GET', 'dir')).toEqual([
        'dir',
        fila.diretorioDados,
      ]);
      expect(await comandoFila(fila.porta, 'CONFIG', 'GET', 'port')).toEqual([
        'port',
        String(fila.porta),
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-006 — sem o binário da fila no PATH, a subida falha nomeando o binário e não deixa resíduo',
    async () => {
      const raizTemporaria = await raizTemporariaDoCaso('sysloc-cenario-');
      const semBinario = await raizTemporariaDoCaso('sysloc-sem-binario-');

      const ambiente = ambienteBase(raizTemporaria);
      // `PATH` montado explicitamente com um diretório vazio: nenhum helper ganhou parâmetro de
      // "caminho do binário" para o teste poder apontá-lo a lugar nenhum.
      ambiente.PATH = semBinario;

      const resultado = await executarCenario('fila-sem-binario', ambiente);

      expect(resultado.codigo).not.toBe(0);
      expect(resultado.erro).toContain(BINARIO_FILA);
      expect(resultado.erro).toContain('provisionar-base.sh');
      expect(readdirSync(raizTemporaria)).toEqual([]);
    },
    LIMITE_CASO_COM_SUBPROCESSO_MS,
  );

  it(
    'T4 §4 — parar({ preservarDados: true }) e religar() devolvem a fila com o mesmo diretório e o trabalho gravado',
    async () => {
      // Este caso não vem da tabela de CT: ele prova o requisito de §4 que T6 consome para
      // escrever a CA-10 ("trabalho enfileirado sobrevive à queda do servidor de fila"). Sem
      // prova aqui, T6 herdaria um par parar()/religar() que ninguém nunca exercitou.
      const fila = await redisEfemero();
      onTestFinished(() => fila.parar());

      expect(await comandoFila(fila.porta, 'SET', 'trabalho-t4', 'enfileirado')).toBe('OK');
      const pidAntes = fila.pid;
      const diretorioAntes = fila.diretorioDados;

      await fila.parar({ preservarDados: true });

      await sondarAte(
        `o processo ${pidAntes} da fila desaparecer depois da queda simulada`,
        () => !processoVivo(pidAntes),
        LIMITE_DESCARTE_MS,
      );
      expect(codigoAoSinalizar(pidAntes)).toBe('ESRCH');
      expect(await codigoAoConectar(fila.porta)).toBe('ECONNREFUSED');
      // A diferença para `parar()` sem opção: o diretório de dados CONTINUA lá.
      expect(existsSync(diretorioAntes)).toBe(true);

      await fila.religar();

      expect(fila.diretorioDados).toBe(diretorioAntes);
      expect(fila.pid).not.toBe(pidAntes);
      expect(await comandoFila(fila.porta, 'PING')).toBe('PONG');
      expect(await comandoFila(fila.porta, 'GET', 'trabalho-t4')).toBe('enfileirado');
    },
    LIMITE_CASO_MS,
  );
});
