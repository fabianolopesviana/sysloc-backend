/**
 * Instância efêmera de banco de dados para a verificação — T4 da fatia
 * `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * A suíte de verificação nunca executa contra o ambiente que atende a operação. A ADR fixa a
 * SEPARAÇÃO como invariante, e rejeitou explicitamente "fixar o ambiente novo como o de
 * verificação" porque esse ambiente passa a atender a operação depois da virada — a regra se
 * autodestruiria. Instância efêmera própria é o que impede essa autodestruição: depois da
 * virada, nada muda aqui.
 *
 * ---------------------------------------------------------------------------
 * O helper IGNORA a configuração de conexão do ambiente — por construção
 * ---------------------------------------------------------------------------
 *
 * Não existe leitura da cadeia de conexão do ambiente (nem de qualquer outra coordenada de
 * conexão) neste arquivo, e isso é requisito, não coincidência. O modo de falha clássico é o
 * helper que devolve "a variável de ambiente quando ela existir, senão a instância efêmera":
 * numa máquina onde a variável esteja definida, a suíte inteira passa a executar contra o banco
 * que opera, em silêncio, e todos os casos continuam verdes. O `turbo.json` (T1) declara essa
 * variável no ambiente da tarefa `test`, então ela CHEGA até aqui — o que impede o dano é este
 * arquivo não olhar para ela. `.claude/rules/testing-stack.md` registra o grep canônico que
 * audita a ausência dessa leitura (e o texto deste comentário é escrito para não casar com ele),
 * e o CT-003 é a prova positiva: com a variável apontando para um servidor sentinela, o
 * sentinela não recebe conexão nenhuma.
 *
 * ---------------------------------------------------------------------------
 * Descarte
 * ---------------------------------------------------------------------------
 *
 * `parar()` é o caminho normal e é idempotente. O caminho de FALHA — asserção que quebra,
 * exceção não capturada, sinal de término — é coberto pelo gancho de encerramento registrado
 * em `efemero-comum.ts`, que mata o processo e apaga o diretório de dados de forma síncrona.
 */

import { randomBytes } from 'node:crypto';
import { realpathSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { processoVivo, registrarDescarte, reservarPorta, sondarAte } from './efemero-comum.ts';

/** Prefixo do diretório de dados, sob a raiz temporária do sistema. */
const PREFIXO_DIRETORIO_BANCO = 'sysloc-banco-';

/** Papel e banco criados pela instância. Nenhum dos dois existe no banco que atende a operação. */
const PAPEL = 'verificacao';
const BANCO = 'verificacao';

/** Limite para o processo do banco desaparecer depois do pedido de parada. */
const LIMITE_MORTE_DO_PROCESSO_MS = 15_000;

/** Últimas linhas de diagnóstico preservadas por instância, para compor mensagem de erro. */
const LINHAS_DE_DIAGNOSTICO = 10;

export interface BancoEfemero {
  /** Cadeia de conexão completa da instância — o único endereço que a suíte deve usar. */
  readonly cadeiaConexao: string;
  /** Porta TCP em que a instância escuta, sorteada dentro da faixa efêmera. */
  readonly porta: number;
  /** Identificador do processo que atende (o `postmaster`), lido do `postmaster.pid`. */
  readonly pid: number;
  /** Diretório de dados, sob `os.tmpdir()`, criado e apagado por esta instância. */
  readonly diretorioDados: string;
  /** Encerra a instância e apaga o diretório de dados. Idempotente. */
  parar(): Promise<void>;
}

/**
 * Sobe uma instância efêmera de banco, com diretório de dados temporário e porta dinâmica.
 *
 * Nenhum parâmetro: o que decide diretório e porta é o helper, e é isso que torna impossível
 * apontá-lo, por descuido ou por configuração, para uma instância que já exista na máquina.
 */
export async function postgresEfemero(): Promise<BancoEfemero> {
  // `realpath` porque o CT-001 compara este valor com o `data_directory` que a própria
  // instância reporta, e o servidor devolve o caminho resolvido. Sem isso, um `os.tmpdir()`
  // que passe por ligação simbólica faria a comparação falhar por caminho equivalente.
  const diretorioDados = realpathSync(await mkdtemp(join(tmpdir(), PREFIXO_DIRETORIO_BANCO)));
  const porta = await reservarPorta();
  // Credencial descartável, gerada por instância: ela vive apenas na memória deste processo e
  // no diretório que morre junto. Nada aqui é lido de configuração nem versionado.
  const senha = randomBytes(24).toString('base64url');

  const diagnostico: string[] = [];
  const anotar = (mensagem: unknown): void => {
    diagnostico.push(String(mensagem).trimEnd());
    if (diagnostico.length > LINHAS_DE_DIAGNOSTICO) {
      diagnostico.shift();
    }
  };

  const instancia = new EmbeddedPostgres({
    databaseDir: diretorioDados,
    port: porta,
    user: PAPEL,
    password: senha,
    authMethod: 'password',
    // `persistent: true` mantém o diretório sob NOSSO controle: a biblioteca apagaria os dados
    // dentro de `stop()`, e aí o caminho de falha (que nunca chega ao `stop()`) ficaria sem
    // dono. Aqui há um só responsável pelo diretório, nos dois caminhos.
    persistent: true,
    onLog: anotar,
    onError: anotar,
  });

  // O descarte é pendurado ANTES da subida: se `initialise()` ou `start()` morrerem no meio,
  // o diretório já criado e o processo já nascido têm quem os apague.
  let pidAtual = 0;
  // O descarte é UMA função, com dois chamadores: o gancho de encerramento e o caminho de falha
  // de subida logo abaixo. Reimplementá-lo no segundo faria uma mudança futura aplicada só ao
  // primeiro deixar o caminho de falha com o comportamento antigo — e é justamente o caminho que
  // nenhum caso exercita (o CT-004 exercita término anômalo DEPOIS da subida, não falha durante).
  const descartar = (): void => {
    if (pidAtual > 0 && processoVivo(pidAtual)) {
      // `SIGQUIT` é o desligamento imediato do PostgreSQL: o `postmaster` derruba os processos
      // filhos e sai sem ponto de controle. Numa instância que vai ser apagada em seguida,
      // esperar por ponto de controle só atrasaria o encerramento.
      try {
        process.kill(pidAtual, 'SIGQUIT');
      } catch {
        // Já morreu entre a checagem e o sinal — nada a fazer.
      }
    }
    rmSync(diretorioDados, { recursive: true, force: true });
  };
  const soltarDescarte = registrarDescarte(descartar);

  try {
    await instancia.initialise();
    await instancia.start();
    await instancia.createDatabase(BANCO);
  } catch (erro) {
    // Descarta agora, com o mesmo código do gancho, e devolve o erro com o diagnóstico que a
    // biblioteca produziu — sem ele, a falha chega como "exit code 1" e não se depura.
    soltarDescarte();
    descartar();
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new Error(
      `instância efêmera de banco não subiu na porta ${porta} (${diretorioDados}): ${motivo}` +
        (diagnostico.length > 0 ? `\n${diagnostico.join('\n')}` : ''),
    );
  }

  pidAtual = await lerPidDoPostmaster(diretorioDados);

  let parada = false;

  const banco: BancoEfemero = {
    cadeiaConexao: `postgresql://${PAPEL}:${senha}@127.0.0.1:${porta}/${BANCO}`,
    porta,
    pid: pidAtual,
    diretorioDados,
    async parar(): Promise<void> {
      if (parada) {
        return;
      }
      parada = true;

      try {
        await instancia.stop();
      } catch {
        // A parada graciosa depende do processo ainda estar de pé. Se ele já caiu, o objetivo
        // desta chamada — nenhum processo, nenhum diretório — segue alcançável pelo sinal
        // abaixo e pela remoção do diretório.
        if (processoVivo(pidAtual)) {
          process.kill(pidAtual, 'SIGQUIT');
        }
      }

      await sondarAte(
        `o processo ${pidAtual} do banco efêmero desaparecer`,
        () => !processoVivo(pidAtual),
        LIMITE_MORTE_DO_PROCESSO_MS,
      );

      await rm(diretorioDados, { recursive: true, force: true });
      soltarDescarte();
    },
  };

  return banco;
}

/**
 * Lê o identificador do processo que atende, do arquivo que o próprio servidor escreve.
 *
 * A biblioteca não expõe o processo filho, e um identificador inventado pelo teste não provaria
 * nada. O `postmaster.pid` é a fonte que o próprio banco mantém, e a primeira linha dele é o
 * identificador — é a mesma fonte que as ferramentas do PostgreSQL consultam.
 */
async function lerPidDoPostmaster(diretorioDados: string): Promise<number> {
  const caminho = join(diretorioDados, 'postmaster.pid');
  const conteudo = await readFile(caminho, 'utf8');
  const primeiraLinha = conteudo.split('\n')[0] ?? '';
  const pid = Number.parseInt(primeiraLinha.trim(), 10);

  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`${caminho} não trouxe um identificador de processo utilizável: ${conteudo}`);
  }
  return pid;
}
